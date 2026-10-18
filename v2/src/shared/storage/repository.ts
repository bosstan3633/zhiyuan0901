/**
 * 数据存储层 · 封装 chrome.storage.local
 * 所有数据读写通过此模块，提供响应式订阅
 */
import type { AppData, UIPrefs } from '@/shared/models'
import { STORAGE_KEY, UI_KEY } from '@/shared/models'
// R148-P0b：热度统计独立键（口径见 hotStats.ts 顶部三条）
import { HOT_KEY, applyHot, pickHot, writeHot, extractHot } from './hotStats'
import { setCoolingDefaultDays } from '@/shared/utils/lifecycle'
import { K } from './keys'
import { createDefaultData, defaultThesisFieldDefs } from './defaults'
import { safeDecodeText } from '@/shared/utils'
import { pruneDanglingProjections, scrubHubMirrorMarkers } from './hub'
// 第卌四轮 T-05：卡片操作事件日志——保存链路快照 diff 自动产出 create/delete/restore/purge
import { rebuildEventSnapshot, flushCardEvents, takeEventLogPatch, initEventLog, EVENT_LOG_KEY } from '@/shared/utils/eventLog'
// R174-3：按日聚合快照落盘（热力图不褪色的数据地基，时间闸小载荷，见 dailyStatsStore.ts）
import { scheduleDailyStatsWrite } from './dailyStatsStore'

type Listener = (data: AppData) => void
type ErrorListener = (err: SaveError) => void

/** 第卅六轮 REQ-038：保存失败事件总线（配额超限 / 序列化失败 / 未知 IO 错误） */
export interface SaveError {
  at: number
  kind: 'quota' | 'serial' | 'unknown'
  message: string
  bytesInUse?: number
}

let cache: AppData | null = null
const listeners = new Set<Listener>()
const errorListeners = new Set<ErrorListener>()
let lastSaveError: SaveError | null = null
/** R159（T3）：落盘状态（顶栏极轻量状态点消费）——idle/saving/saved/error */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
const stateListeners = new Set<(s: SaveState) => void>()
function emitSaveState(s: SaveState): void { stateListeners.forEach((fn) => fn(s)) }
export function subscribeSaveState(fn: (s: SaveState) => void): () => void {
  stateListeners.add(fn)
  return () => stateListeners.delete(fn)
}
let saveTimer: ReturnType<typeof setTimeout> | null = null
/**
 * R148-P1b：内存脏计数——每次 persist 意图（saveData/saveDataNow/外部合并）同步 +1。
 * 为什么不用 dataVersion：那个只在**写盘成功后**自增，防抖窗口内会读到旧值，
 * 派生缓存拿它当失效依据会算出过期结果（现存隐患，本项顺手修掉）。
 */
let mutationSeq = 0
export function getMutationSeq(): number { return mutationSeq }
export function markDataDirty(): void { mutationSeq++ }

// REQ-031 P-031-6 + R70 + R131-C1a：自身写入标记。
// 原实现是时间戳比较（守卫从未生效），R70 改内容指纹（每次 onChanged 对整树 stringify 一次，千卡 40–100ms）。
// R131-C1a：写入载荷带全局唯一 `__wid`（上下文随机前缀 + 自增序号），onChanged 只比一个字符串——
// 判定退化为 O(1)。跨上下文序号独立不碰撞（前缀不同）；旧存量数据无 __wid → 判为外部写入（保守正确）。
const SELF_CTX_ID = Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36)
let selfWriteSeq = 0
let lastSelfWriteId = ''

// R56-PERF-c：数据版本号——每次成功写入/外部同步自增（重计算 memo 的失效键）
let dataVersion = 0
export function getDataVersion(): number { return dataVersion }
/** 判断一次 storage 变更是否由本上下文写入（writeId 比对，O(1)；非本页写入返回 false，走合并路径） */
export function isSelfWrite(newValue: unknown): boolean {
  if (!lastSelfWriteId) return false
  return (newValue as { __wid?: unknown } | null)?.__wid === lastSelfWriteId
}

function chromeStore(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

/**
 * R162/R165/R166：已退役的卡间关系字段——**载入与导入两条路都要过一遍**。
 *
 * 为什么两处：`loadData` 只净化"启动时库里已有的数据"；而设置页导入是 `mergeById`
 * 用 `{...existing, ...incoming}` 覆盖，**导入发生在载入之后** ⇒ 旧导出包里的退役字段会
 * 从导入这条路重新钻进内存并立刻写回存储，loadData 那道剥离完全拦不住（R166 实测 K5 抓到）。
 * 清单是"只增不减"的历史账：每退役一个字段就往里加一项。
 */
export const RETIRED_CARD_KEYS = ['mountedResourceIds', 'mountedCuriosityIds', 'relatedResourceIds', 'fromCuriosityId'] as const
export function stripRetiredCardKeys<T>(arr: unknown): T[] {
  const list = Array.isArray(arr) ? arr : []
  for (const o of list) {
    if (o && typeof o === 'object') for (const k of RETIRED_CARD_KEYS) { if (k in (o as object)) delete (o as Record<string, unknown>)[k] }
  }
  return list as T[]
}

/**
 * R166 定案 2（D5）：存量 `parentId` 子卡 → 折叠进父卡的 `subtasks` 清单。
 *
 * 为什么要迁：子任务从「独立卡 + 父指针」改成「卡内嵌字段」（定案 1）——它像说明/标签一样属于本卡，
 * 不进任务池 / 指标 taskIds / 看板拖拽 / 周报 / 回收站，完成也不计分（定案 3）。
 * 原卡**软删进回收站**（可撤销，不硬删用户数据）。
 *
 * 三条边界：
 *  · **已软删的子卡不折叠**——否则回收站里的东西会复活成清单上的一行；只把它的 parentId 摘掉。
 *  · **无父可折升为普通任务**（父不存在 / 父已软删 / 自环脏数据）。
 *  · **多层用摊平收敛**：模型只有一层，D→C→P 的孙子最终落在 P 的清单里；
 *    所以按"折完一轮再看还有没有 parentId"最多跑 3 轮，而不是假设数据只有一层深。
 * 幂等：`subtasksFoldedAt` 有值即整体跳过（同 `hubMigratedAt` 一族）。
 */
function foldParentIdSubtasks(data: AppData): void {
  if (data.subtasksFoldedAt) return
  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  const byId = new Map(tasks.map(t => [t.id, t] as const))
  const detachMetric = (taskId: string) => {
    for (const dir of data.compass?.directions || []) for (const p of dir.projects || []) for (const m of p.metrics || [])
      if (Array.isArray(m.taskIds) && m.taskIds.includes(taskId)) m.taskIds = m.taskIds.filter(x => x !== taskId)
  }
  type Legacy = { parentId?: string; subtasks?: { id: string; title: string; done: boolean; note?: string }[] }
  for (let pass = 0; pass < 3 && tasks.some(t => (t as Legacy).parentId); pass++) {
    for (const t of tasks) {
      const legacy = t as Legacy
      const pid = legacy.parentId
      if (!pid) continue
      const parent = byId.get(pid)
      if (!parent || parent.deletedAt || parent.id === t.id || t.deletedAt) { legacy.parentId = undefined; continue }
      const pLeg = parent as Legacy
      pLeg.subtasks = pLeg.subtasks || []
      if (!pLeg.subtasks.some(s => s.id === t.id))
        pLeg.subtasks.push({ id: t.id, title: t.title, done: t.status === 'done', note: (t.description || '').trim() || undefined })
      for (const k of legacy.subtasks || []) if (!pLeg.subtasks.some(s => s.id === k.id)) pLeg.subtasks.push({ ...k })
      legacy.parentId = undefined
      legacy.subtasks = undefined
      t.deletedAt = Date.now()
      detachMetric(t.id)
    }
  }
  data.subtasksFoldedAt = Date.now()
}

/**
 * ★★P0-2（V3.8.41）加载期字段归一化 —— 单一真源，`loadData` 与设置页 JSON 导入**共用**
 *
 * ## 为什么要抽成独立函数（本批最贵的一处结构性决定）
 * V3.8.40 已在 `loadData` 里加了四条归一化（`fixTaskStatus`/`fixCurioStatus`/
 * `fixCurioLegacyFields`/`fixCardLegacyFields`），实测有效。但盘点复查发现一个结构性缺口：
 *
 *   **设置页「导入数据」走 `mergeImport`，它把导入的卡直接塞进 `d.resources/tasks/curiosities`，
 *     从不经过 `loadData`。** 而老备份导入恰恰是"老库"的主要来源——
 *     用户导入一份 V2.x 的 JSON，合并进当前库，`status`/`question`/`linkType` 一个都没补，
 *     当场就可能炸在 `STATUS_UI[t.status].cls` 上。
 *   ⇒ 归一化写在 `loadData` 里 = 只能治"启动读老库"，治不了"导入老库"。
 *     只要归一化是某个流程的私有步骤，绕过那个流程的路就都是漏的。
 *
 * ## 为什么是「纯归一化」而不是「版本迁移」
 * 不写迁移戳，每次判一次成本极低（对几百张卡是几十微秒）。写戳反而会在用户
 * 手改备份 / 从旧版导出再导入后失效——那正是我们要治的场景。
 *
 * ## 幂等
 * 全部按「只在缺失时补」写，不覆盖已有值 ⇒ 重复调用安全，
 * 所以 `loadData` 与 `mergeImport` 各调一次不会互相打架。
 */
export function normalizeLegacyCards(d: AppData): void {
  // N4：老数据补齐 tagTree 与任务/好奇心卡 tags 字段行
  if (!d.tagTree) d.tagTree = []
  // B35：卡片 tags 字段归一化——迁移/历史数据中存在非数组 tags（对象/数字等），
  // 会让 .includes/.join 崩溃（标签管理白屏、网页端搜索空白）。
  const fixTags = (cards: { tags?: unknown }[] | undefined) => (cards || []).forEach((c: { tags?: unknown }) => {
    if (!c) return
    if (!Array.isArray(c.tags)) {
      c.tags = typeof c.tags === 'string' && c.tags.trim()
        ? c.tags.split(/[,，、\s]+/).filter(Boolean)
        : []
    }
  })
  fixTags(d.resources as { tags?: unknown }[])
  fixTags(d.tasks as { tags?: unknown }[])
  fixTags(d.curiosities as { tags?: unknown }[])
  /*B7-e（2026-10-18）任务卡 `status` / `priority` 兜底 —— 实拍抓到的**既有崩溃**：
     打开任务详情抽屉即崩「Cannot read properties of undefined (reading 'cls')」，
     根因是 `TaskDetailDrawer` 的 `STATUS_UI[selectedTask.status].cls` 在 status 缺失时取到 undefined。
     ★为什么模型声明 `status: 'todo'|'doing'|'done'`（必填）却仍会缺：**类型只在编译期兜**，
       真实来源是用户历年的 JSON 导入 / 手改备份 / 早期版本写库，那条路没有任何校验。
     症状形态极具误导性：TS 绿 · build 绿 · vue-tsc 0 错 · 门禁全绿，**只有拿一份真实老库点开那张卡才炸**。
     ★教训并入记忆：**"接口声明必填"不等于"运行时一定有"——凡是拿 `MAP[key].x` 的地方，
       都要问一句"这个 key 会不会不在 Map 里"，老库是最容易被跳过的输入源。 */
  const fixTaskStatus = (cards: { status?: unknown; priority?: unknown }[] | undefined) => (cards || []).forEach((c) => {
    if (!c) return
    if (c.status !== 'todo' && c.status !== 'doing' && c.status !== 'done') c.status = 'todo'
    if (c.priority !== 'high' && c.priority !== 'medium' && c.priority !== 'low') c.priority = 'medium'
  })
  fixTaskStatus(d.tasks as { status?: unknown; priority?: unknown }[])
  /* 同源第三处（B7-e 实拍）：**好奇心卡旧字段结构改名**——这一条不是"缺字段"，是"字段叫另一个名字"。
     实测老库里好奇卡长这样：
       { id, kind?, title: "为什么 ZIP 装了全部产物…", desc: "", done: false, tags: [], createdAt, updatedAt }
     而模型要的是 `question` / `description` / `status` / `pinned` / `customFields`。
     ★为什么迁移层一直没人写这段：**改名发生在模型定型之前，而当时的库已经写出去了**——
       改代码的人看到的是"库里都有 question"，于是判定无需迁移；被改名的那些老库用户却永远走不到这里。
     ★为什么不能只给 `maturity.ts` 的 `c.question.trim()` 加 `|| ''` 兜底：**那样只是不崩，内容全空**——
       用户打开自己的旧卡，看到一张没有问题的白卡，还以为内容丢了。加 `|| ''` 是止血，字段映射才是治本。
     三条映射各自独立判有无，互不覆盖：
       title→question · desc→description · done:boolean→status（true→done / false→todo）。
     `done` 只在 `status` 缺失时才读，**不覆盖已有 status**（后来的版本可能已写过 status，留着它更真）。 */
  const fixCurioLegacyFields = (cards: Record<string, unknown>[] | undefined) => (cards || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (typeof c.question !== 'string' || !c.question) {
      if (typeof c.title === 'string' && c.title) c.question = c.title
      else c.question = ''
    }
    if (typeof c.description !== 'string' && typeof c.desc === 'string') c.description = c.desc
    if (c.status === undefined && typeof c.done === 'boolean') c.status = c.done ? 'done' : 'todo'
    if (!Array.isArray(c.customFields)) c.customFields = {}
  })
  /* ★★执行顺序是一条真缺陷，不是排版问题（P0-2 夹具实跑抓出来的）：
     本函数**必须在 `fixCurioStatus` 之前跑**。原来 `fixCurioStatus` 在前，它看到 `status` 缺失
     就先兜成 `'todo'`；轮到 `fixCurioLegacyFields` 时 `c.status !== undefined` 已经成立，
     于是 `done` 字段**永远读不到**——老库里每张 `done:true` 的已完成好奇卡，
     导入后都被静默改成"待探索"。用户不会看到任何报错，只是他的完成记录凭空清零。
     ⇒ 这类"兜底先跑、映射后跑"的错，看源码完全看不出问题（两段逻辑各自都对），
       只有把真实旧结构喂进去看输出才会现形。**兜底必须排在映射之后**。 */
  fixCurioLegacyFields(d.curiosities as unknown as Record<string, unknown>[])
  /* 同源第二处：好奇心卡状态（第四档 `shelf` 已搁置）。`CuriosityPanel` 的
     `STATUS_MAP[c.status].cls` 与任务卡那条是同一个写法（curiosity.ts 的 CURIOSITY_STATUS 四档），
     缺 status 时同样炸在 `.cls` 上——一并兜住，免得修完任务卡又在这里崩一次。 */
  const fixCurioStatus = (cards: { status?: unknown }[] | undefined) => (cards || []).forEach((c) => {
    if (!c) return
    if (c.status !== 'todo' && c.status !== 'doing' && c.status !== 'done' && c.status !== 'shelf') c.status = 'todo'
  })
  fixCurioStatus(d.curiosities as { status?: unknown }[])
  /* 同源第四处：**三类卡统一的旧字段改名**（`desc`→`description` / `dueAt`→`dueDate` / `customFields` 兜底）。
     实测老库里三类卡都带 `desc`，任务卡还带 `dueAt`——不映射的后果有两层：
     ① 摘要位在卡面/导出/AI 投料里全空（用户在老库里明明写过说明）；
     ② 成熟度里 `t.dueDate` 计 10 分，老库字段叫 `dueAt`，**每张老任务卡白丢 10 分**，
        「无截止日」提示还会误报——这种"分数悄悄少一截"的错比崩溃更难被发现。
     ★三类卡走同一个函数而不是各写一遍：字段重命名是**跨卡型**的规则，
       按卡型各写一份必然漏掉其中一个（第一版就漏了资源卡，回读时才发现）。 */
  const fixCardLegacyFields = (cards: Record<string, unknown>[] | undefined) => (cards || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (typeof c.description !== 'string' && typeof c.desc === 'string') c.description = c.desc
    if (!c.dueDate && typeof c.dueAt === 'number') c.dueDate = c.dueAt
    if (!Array.isArray(c.customFields)) c.customFields = {}
  })
  fixCardLegacyFields(d.tasks as unknown as Record<string, unknown>[])
  fixCardLegacyFields(d.curiosities as unknown as Record<string, unknown>[])
  fixCardLegacyFields(d.resources as unknown as Record<string, unknown>[])
  /* P0-2 新增第五处：**资源卡 `linkType` 兜底 + 旧字段 `url` 映射**。
     这一条与前四处性质不同——它**不会崩**，所以任何"点开就炸"的实拍都抓不到它，
     是一次纯静态盘点才发现的**行为缺陷**：
     `linkType` 是必填枚举（'url'|'file'|'obsidian'），消费点遍布全站十余处
     （`toOpenableUrl` / `linkStateOf` / `linkIcon` / `linkLabel` / `linkPlaceholderFor`
     / 双击打开 / ⌘K 打开 / CSV·MD 导出 / AI 抓正文）。缺省时：
       · `toOpenableUrl` 走 url 分支 ⇒ **本地文件卡被当网页打开**（走错通道，且没有 file:// 编码）；
       · `linkStateOf` 判不出 incomplete ⇒ 「⚠ 待补全路径」提示永不出现，用户双击才发现打不开；
       · `linkIcon`/`linkLabel` 落到兜底档，卡面显示成"卡片"而不是"文件"。
     老库里这两种形状都真实存在：① V2.0 之前只有 `url` 一个字段（无 linkType）；
        ② 早期本地文件导入的卡 linkType 没落上。
     ⇒ 映射两段：先 `url` 字段 → `link` + `linkType='url'`；再按 link 形状**推断** linkType：
       盘符/绝对路径/`file://` → file（这条最要紧，能救回本地文件的打开通道）；
       `obsidian://` → obsidian；其余按协议白名单判 url；判不出来兜底 'url'（原行为不变，只把未定义变确定）。 */
  const fixResourceLinkType = (cards: Record<string, unknown>[] | undefined) => (cards || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (typeof c.link !== 'string') c.link = typeof c.link === 'number' ? String(c.link) : ''
    /* 旧字段 `url` → `link`。★此处**只搬 link、绝不顺手把 linkType 定成 'url'**——
       第一版就是这么写的（`c.link = c.url; c.linkType = 'url'`），
       后果是下面那段按形状推断 linkType 的代码**永远轮不到**：
       老库里存 Windows 盘符的本地文件（`D:\资料\讲义.pdf`）与 `obsidian://` 笔记
       都被标成网页链接 ⇒ 双击走错打开通道、卡片显示"网页"徽标、路径不做 file:// 编码。
       症状是"打开打不开"，没有任何报错。⇒ 搬完字段，让推断器统一判。 */
    if (!c.link && typeof c.url === 'string' && c.url) c.link = c.url
    /* c.link 的静态类型是 unknown（老库里可能是数字/对象/数组），TS 不认 .trim()，
       所以这里先窄化成 string 而不是强转——窄化同时也是一次真实校验：
       非字符串的 link 在老库里意味着脏数据，落成空串比拿对象去 startsWith 安全。 */
    const t = (typeof c.link === 'string' ? c.link : '').trim()
    const already = c.linkType === 'url' || c.linkType === 'file' || c.linkType === 'obsidian'
    if (already) return
    if (!t) { c.linkType = 'url'; return }
    if (/^zy-asset:\/\//i.test(t) || /^file:\/\//i.test(t) || /^[a-zA-Z]:[\\/]/.test(t) || t.startsWith('/')) c.linkType = 'file'
    else if (/^obsidian:\/\//i.test(t)) c.linkType = 'obsidian'
    else c.linkType = 'url'
  })
  fixResourceLinkType(d.resources as unknown as Record<string, unknown>[])
  /* P0-2 新增第六处：`kind` 兜底 —— 三卡池各自靠 `kind` 分流（筛选、统计、导出列、AI 投料），
     而老库/手改备份里存在缺 kind 的卡：这类卡不崩，但会**从所有 kind 视角里消失**
     （"筛选资源卡"看不到它、三卡统计少算它、导出丢列），是一种更安静的错。 */
  const fixCardKind = (cards: Record<string, unknown>[], kind: string) => (cards || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (c.kind !== 'resource' && c.kind !== 'task' && c.kind !== 'curiosity' && c.kind !== 'argument') c.kind = kind
  })
  fixCardKind(d.resources as unknown as Record<string, unknown>[], 'resource')
  fixCardKind(d.tasks as unknown as Record<string, unknown>[], 'task')
  fixCardKind(d.curiosities as unknown as Record<string, unknown>[], 'curiosity')
  /* P0-2 新增第七处：`id` 兜底 —— 卡 id 是全库关联的锚（指标 taskIds、supportLinks、
     curationProjections.cardId、回收站恢复）。缺 id 的卡一旦被编辑，它就**复制不出关联**，
     且 `mergeById` 用它做 key 会把多张无 id 卡折叠成一张（静默丢卡）。
     只在缺失时用 createdAt 派生，**不改任何已有 id**（改 id 等于改用户的引用关系）。 */
  const fixCardId = (cards: Record<string, unknown>[] | undefined) => (cards || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (typeof c.id === 'string' && c.id) return
    const born = typeof c.createdAt === 'number' && c.createdAt ? c.createdAt : 0
    c.id = `r${born.toString(36)}${Math.random().toString(36).slice(2, 8)}`
  })
  fixCardId(d.resources as unknown as Record<string, unknown>[])
  fixCardId(d.tasks as unknown as Record<string, unknown>[])
  fixCardId(d.curiosities as unknown as Record<string, unknown>[])
  /* P0-2 新增第八处：`title` 兜底 —— 三卡的标题字段虽在模型里必填，但老库里存在空串/缺字段的卡。
     空标题不会崩，可它在**卡面、⌘K 结果、导出、回收站**里都是一个空白可点区域，
     用户会以为数据丢了。兜底成「未命名」——宁可给个占位名，也不给一处空白。 */
  const fixCardTitle = (cards: Record<string, unknown>[] | undefined) => (cards || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    const title = typeof c.title === 'string' ? c.title.trim() : ''
    const question = typeof c.question === 'string' ? c.question.trim() : ''
    const text = typeof c.text === 'string' ? c.text.trim() : ''
    if (title) return
    if (question) { c.title = question; return }
    if (text) { c.title = text; return }
    c.title = '未命名'
  })
  fixCardTitle(d.resources as unknown as Record<string, unknown>[])
  fixCardTitle(d.tasks as unknown as Record<string, unknown>[])
  // 好奇卡的"标题"就是 question 本身，映射在上面 fixCurioLegacyFields 已做，这里不重复改名
  // P0-2 新增第九处：策展台必填字段兜底（`order`/`archived`/`icon`/`coverTheme`）。
  // `hub.ts` 与 `app.ts` 都按 `a.order - b.order` 排序、`filter(w => !w.archived)` 取活动台——
  // 缺 order ⇒ NaN 参与比较 ⇒ **台序错乱且每次载入都可能不同**；缺 archived ⇒ 未归档判定不确定。
  const fixWorkspaces = (ws: Record<string, unknown>[] | undefined) => (ws || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (typeof c.order !== 'number') c.order = 0
    c.archived = !!c.archived
    if (typeof c.name !== 'string' || !c.name) c.name = '未命名台'
  })
  fixWorkspaces(d.workspaces as unknown as Record<string, unknown>[])
  /* P0-2 新增第十处：分类 `order` 兜底 —— 同上，`catIndex.ts` / `catTree.ts` 排序口径
     `a.order ?? 0`（有兜底，但 `hub.ts` 的 maxOrder 推算与若干消费点用 `a.order` 裸取），
     缺 order 会让新分类的 order 推算从 NaN 起步。 */
  const fixCategories = (cs: Record<string, unknown>[] | undefined) => (cs || []).forEach((c) => {
    if (!c || typeof c !== 'object') return
    if (typeof c.order !== 'number') c.order = 0
    if (typeof c.name !== 'string' || !c.name) c.name = '未命名分类'
  })
  fixCategories(d.categories as unknown as Record<string, unknown>[])
}

/** 加载数据（含首次初始化） */
export async function loadData(prefetched?: Record<string, unknown>): Promise<AppData> {
  if (cache) return cache
  const cs = chromeStore()
  if (!cs) {
    cache = createDefaultData()
    return cache
  }
  // R112 冷启动：允许调用方把**已经读到的** raw 快照传进来，省掉一次同 key 的
  //   chrome.storage.local 往返（启动链路里 STORAGE_KEY 曾被串行读 3 次，medium 实测单次
  //   197~229ms）。预取只跳过 IO，**归一化一律照常执行**。
  let raw = prefetched ? (prefetched[STORAGE_KEY] as AppData | undefined) : undefined
  let hotRaw: Record<string, unknown> | undefined
  // R128-A1：统一接线跨上下文同步——此前 onChanged→合并 只在新标签页 store 里手工接，
  // popup / content 各自裸读写 storage（既无合并、也不产事件）。改为仓库自身挂一次全局监听，
  // 凡走本模块的上下文自动获得合并保护。
  attachStorageSync()
  if (raw === undefined) {
    // R148-P0b：主键与热度键**同一次 get**取回——拆键不能变成多一次启动 IO
    const result = await cs.get([STORAGE_KEY, HOT_KEY])
    raw = result[STORAGE_KEY] as AppData | undefined
    hotRaw = result as Record<string, unknown>
  } else if (prefetched) {
    // R160（P6）：boot 批量读已带热度键则直接复用（原每次补一次 IO）
    hotRaw = (prefetched[HOT_KEY] !== undefined ? prefetched : await cs.get([HOT_KEY])) as Record<string, unknown>
  }
  let data = raw
  if (!data) {
    data = createDefaultData()
    await cs.set({ [STORAGE_KEY]: data })
  }
  /* B7-e 的四条归一化 + P0-2 新增六条，全部收进 `normalizeLegacyCards`（上方导出）——
     为什么搬：它们原本是 `loadData` 的内联私有步骤，于是「设置页导入」这条路完全没被覆盖。
     抽出后本处只剩一次调用，`mergeImport` 调同一份 ⇒ 两条入口同一套口径。
     ★纪律：**归一化必须挂在"数据入库的那一层"，不能挂在"某条读路径上"**——
       挂在读路径上，每新增一个读入口就漏一个；而入库层是唯一的。 */
  normalizeLegacyCards(data)
  // R162/R165：卡间挂载全量退役——清存量字段（幂等；旧库/旧导出包里可能残留，D4 静默剥离不弹迁移提示）
  // R166：清单与"导入那条路"共用 RETIRED_CARD_KEYS 单一真源（见文件头 stripRetiredCardKeys 备案）
  stripRetiredCardKeys(data.tasks)
  stripRetiredCardKeys(data.curiosities)
  stripRetiredCardKeys(data.resources)
  /* R166 定案 2（D5）：存量 `parentId` 子卡折叠进父卡的 `subtasks` 清单——子任务从"独立卡 + 父指针"
     改为"卡内嵌字段"（不进池/指标/看板/周报/回收站，完成不计分）。
     ⚠ 折叠必须发生在 stripKeys 之后、且**读 parentId 走 cast**：模型里该字段已删，
        但存量数据仍带着它——这正是"字段退役了、数据还在"的窗口，迁移函数是唯一读它的地方。
     幂等：`subtasksFoldedAt` 有值即跳过（同 `hubMigratedAt` 一族）。 */
  foldParentIdSubtasks(data)
  // 第廿九轮：分类名/标签名 URL 编码归一化——导入场景曾把 percent-encoding 的名称直接存库
  // （表现为界面上出现「%E5%AE%8B...」乱码分类）。此处一次性解码并在下次 persist 固化。
  const fixEncoded = (name: string): string => safeDecodeText(name);
  (data.categories || []).forEach(c => { if (c) c.name = fixEncoded(c.name) })
  const fixTagNames = (cards: { tags?: string[] }[] | undefined) => (cards || []).forEach(c => {
    if (!c || !Array.isArray(c.tags)) return
    c.tags = c.tags.map(t => (typeof t === 'string' ? fixEncoded(t) : t))
  })
  fixTagNames(data.resources as { tags?: string[] }[])
  fixTagNames(data.tasks as { tags?: string[] }[])
  fixTagNames(data.curiosities as { tags?: string[] }[])
  for (const key of ['task', 'curiosity'] as const) {
    if (data.fieldConfig?.[key] && !data.fieldConfig[key].some(f => f.key === 'tags')) {
      data.fieldConfig[key].push({ key: 'tags', label: '标签', type: 'tags', visible: false, order: data.fieldConfig[key].length })
    }
  }
  // R62-3：策展主题卡字段组——老数据无 thesis 组则补默认（幂等）
  if (data.fieldConfig && !data.fieldConfig.thesis) data.fieldConfig.thesis = defaultThesisFieldDefs()
  // 第卌轮 REQ-049：老数据字段配置补 assets（附件展示；字段目录 base 字段，目录化兜底迁移）
  for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const) {
    if (data.fieldConfig?.[key] && !data.fieldConfig[key].some(f => f.key === 'assets')) {
      data.fieldConfig[key].push({ key: 'assets', label: '附件', type: 'text', visible: true, order: data.fieldConfig[key].length })
    }
  }
  // R80（R1 遗留）：资源卡标签默认可见——一次性幂等迁移。
  // 背景：字段池四组的 tags 自建立起就是 visible:false，导致 R1「补齐 #标签」在存量数据上
  // 从未真正生效（用户不知道要去设置里打开）。此处对 resource 组一次性置 true。
  // ⚠ 取舍：若用户此前**主动**关掉过标签，本次会被重新打开——R1 是 P0 且标签是资源卡核心元数据，
  //   判"不知道能开"的概率远高于"主动关掉"。回退只需在设置里再关一次（或删掉标记后重启）。
  if (!data.tagsVisibleMigratedAt) {
    const res = data.fieldConfig?.resource
    const tag = res?.find(f => f.key === 'tags')
    if (tag) tag.visible = true
    data.tagsVisibleMigratedAt = Date.now()
  }
  // R58-B5：activityLogs 已无写入方（事件日志迁 zy_event_log 独立键）——启动期清空瘦身
  if (Array.isArray(data.activityLogs) && data.activityLogs.length) data.activityLogs = []
  // R63：Airtable 同步状态归一化（老数据无则补默认；log 截断防膨胀；map 保证为对象）
  if (!data.airtableSync) {
    data.airtableSync = { pat: '', baseId: '', tableId: '', pollEnabled: false }
  } else {
    const s = data.airtableSync
    if (typeof s.pat !== 'string') s.pat = ''
    if (typeof s.baseId !== 'string') s.baseId = ''
    if (typeof s.tableId !== 'string') s.tableId = ''
    if (!s.pollEnabled) s.pollEnabled = false
    if (Array.isArray(s.log) && s.log.length > 40) s.log = s.log.slice(-40)
  }
  if (!data.airtableMap || typeof data.airtableMap !== 'object') data.airtableMap = {}
  // R70：悬空投射清理——源卡被硬删（回收站清空）后指向它的投射记录会永久留存、无界增长。幂等，启动期一次。
  try { pruneDanglingProjections(data) } catch { /* noop */ }
  // R110-BUG1：资源台镜像标记净化——视图模型标记（__mirrorProjId/__mirrorCat）误持久化 + 指向资源台的投射
  // 记录，都是历史脏数据，启动期幂等剥离（资源台指标格不再出现「⚠ 镜像 N 条待清理」）。一次净化后下次 persist 固化。
  try { scrubHubMirrorMarkers(data) } catch { /* noop */ }
  // R148-P0b：热度段以独立键为权威覆盖回主树（视图读法一字不改）；
  //  老数据没有本键 → 首次以主树落一次并打戳，幂等（重启不会抽第二遍）。
  const hot = pickHot(hotRaw)
  if (hot) applyHot(data, hot)
  else if (!data.hotStatsSplitAt) { data.hotStatsSplitAt = Date.now(); writeHot(data) }
  cache = data
  markStorageMirror(data)
  // 第卌四轮 T-05：初始化快照（静默，不产生历史事件）
  rebuildEventSnapshot(data)
  markSaveOk()
  return data
}

/** 获取当前数据缓存（必须先 loadData） */
export function getData(): AppData {
  if (!cache) throw new Error('Data not loaded. Call loadData() first.')
  return cache
}

/** 保存数据（防抖 300ms，自动持久化） */
export function saveData(): void {
  emitSaveState('saving')
  markDataDirty() // R148-P1b：先让派生缓存作废，再排防抖写盘
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    // 第卌四轮 T-05：保存前快照 diff 产出操作事件（fire-and-forget，失败不影响主数据）
    if (cache) { try { flushCardEvents(cache) } catch { /* noop */ } }
    // R174-3：按日聚合快照走独立时间闸（45s 小载荷，页隐藏由模块内监听补写），不进本包 set
    if (cache) { try { scheduleDailyStatsWrite(cache) } catch { /* noop */ } }
    // V2.17.1 修复：JSON 纯净清洗后再入存储——reactive 树中可能残留 Vue Proxy（如编辑表单展开出的
    // assets Proxy 数组），chrome.storage 序列化 Proxy 时会把数组降级为类数组对象 {"0":…}，
    // 读回后 .length 为 undefined → 卡片正面附件徽章永不渲染。JSON round-trip 保证入存储永远是 plain 结构。
    // R53-E3：序列化包 try——异常走 SaveError('serial')（此前在定时器内未捕获会静默丢保存）
    let payload: Record<string, unknown>
    let payloadJson = ''
    try {
      // R71 性能治理：原实现是「序列化 → 解析 → 再序列化」三重往返 —— 整树 2 次序列化 + 1 次多余解析。
      // 但 JSON.stringify(JSON.parse(X)) ≡ X（键序由插入序保持），中间那趟往返纯属冗余。
      // 现在：一次 stringify 得到「存储实际内容」（同时充当自身写入指纹），再一次 parse 得到纯净 plain 树。
      // 语义完全等价（reactive Proxy → plain JSON 的净化仍然发生），成本减半。
      payloadJson = JSON.stringify(cache)
      const wid = SELF_CTX_ID + '-' + (++selfWriteSeq)
      // R160（P5）：热度键 + 待写事件日志并入同一次 set——一次用户动作 = 1 次 IPC（原 3 次）
      payload = { [STORAGE_KEY]: Object.assign(JSON.parse(payloadJson), { __wid: wid }), [HOT_KEY]: extractHot(cache!), ...(takeEventLogPatch() || {}) }
      lastSelfWriteId = wid  // R131-C1a：onChanged 以 writeId 做 O(1) 自身写入判定
    } catch (e) { emitSaveError(e); return }
    const p = cs!.set(payload)
    if (p && typeof (p as Promise<void>).then === 'function') {
      ;(p as Promise<void>)
        .then(() => {
          dataVersion++
          lastPersistedJson = payloadJson
          markSaveOk()
          if (lastSaveError) { lastSaveError = null; listeners.forEach((fn) => fn(cache!)) }
          listeners.forEach((fn) => fn(cache!))
        })
        .catch((e: unknown) => emitSaveError(e))
    } else {
      markSaveOk()
      listeners.forEach((fn) => fn(cache!))
    }
  }, 300)
}

/** 立即保存（用于关键操作） */
export async function saveDataNow(): Promise<void> {
  emitSaveState('saving')
  markDataDirty()
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  // 第卌四轮 T-05：同 saveData——保存前 diff 产出操作事件
  try { flushCardEvents(cache) } catch { /* noop */ }
  // R174-3：同 saveData——按日聚合快照独立时间闸
  try { scheduleDailyStatsWrite(cache) } catch { /* noop */ }
  try {
    // V2.17.1 修复：同 saveData——JSON 纯净清洗防 reactive Proxy 泄漏入存储（数组降级类数组对象）
    // R71：同 saveData，去掉冗余的中间往返（1 次 stringify + 1 次 parse）
    const payloadJson = JSON.stringify(cache)
    const wid = SELF_CTX_ID + '-' + (++selfWriteSeq)
    lastSelfWriteId = wid  // R131-C1a：同上
    // R160（P5）：同上——热度键与待写日志并入同一次 set
    await cs.set({ [STORAGE_KEY]: Object.assign(JSON.parse(payloadJson), { __wid: wid }), [HOT_KEY]: extractHot(cache), ...(takeEventLogPatch() || {}) })
    dataVersion++
    lastPersistedJson = payloadJson
    markSaveOk()
    if (lastSaveError) { lastSaveError = null }
    emitSaveState('saved')
    listeners.forEach((fn) => fn(cache!))
  } catch (e) {
    emitSaveError(e)
    emitSaveState('error')
    throw e
  }
}

/** 第卅六轮 REQ-038：保存失败时分类告警（含最近一次写入的容量水位） */
function emitSaveError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)
  const kind: SaveError['kind'] =
    /quota|QUOTA_EXCEEDED|maxBytes/i.test(msg) ? 'quota' :
    /circular|JSON|stringify|serializ/i.test(msg) ? 'serial' : 'unknown'
  lastSaveError = { at: Date.now(), kind, message: msg }
  // 异步取一次当前已用字节（best-effort，配额错误才有意义，但容错写入）
  try {
    chromeStore()?.getBytesInUse?.((bytes) => {
      if (lastSaveError) lastSaveError.bytesInUse = bytes
      errorListeners.forEach((fn) => fn(lastSaveError!))
    })
  } catch {
    errorListeners.forEach((fn) => fn(lastSaveError!))
  }
}

/** 订阅保存失败事件（用于触发 Toast / 设置页红点 / 顶栏告警） */
export function subscribeSaveError(fn: ErrorListener): () => void {
  errorListeners.add(fn)
  if (lastSaveError) fn(lastSaveError)
  return () => errorListeners.delete(fn)
}

/** 取最近一次保存失败（用于设置页诊断） */
export function getLastSaveError(): SaveError | null { return lastSaveError }

/** R50-F2：最近一次成功写入时间戳（0 = 本次会话尚无成功写入；loadData 成功也会置位） */
let lastSaveOkAt = 0
export function getLastSaveOkAt(): number { return lastSaveOkAt }
function markSaveOk(): void { lastSaveOkAt = Date.now() }

/** 清除最近一次保存失败标记（恢复后调用） */
export function clearLastSaveError(): void { lastSaveError = null }

/** R159（T5）：启动期清理遗留键（V1 时代 lm_data_v5*，迁移完成后一次性移除；幂等） */
export function cleanupLegacyKeys(): void {
  try { chromeStore()?.remove([...K.LEGACY]) } catch { /* 无 storage 权限：忽略 */ }
}

/** 第卅六轮 REQ-038：当前 chrome.storage.local 已用字节（同步回调包装成 Promise） */
export function getBytesInUse(): Promise<number> {
  return new Promise((resolve) => {
    const cs = chromeStore()
    if (!cs || !cs.getBytesInUse) return resolve(0)
    cs.getBytesInUse([STORAGE_KEY], (bytes) => resolve(bytes || 0))
  })
}

/** 第卅六轮 REQ-038：是否已申请 unlimitedStorage（直接读运行时 manifest，零依赖） */
export function hasUnlimitedStorage(): boolean {
  try {
    const m = (chrome as { runtime?: { getManifest?: () => { permissions?: string[] } } }).runtime?.getManifest?.()
    const perms = m?.permissions || []
    return Array.isArray(perms) && perms.includes('unlimitedStorage')
  } catch {
    return false
  }
}

/** 订阅数据变更 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 替换全部数据（导入用） */
export async function replaceData(newData: AppData): Promise<void> {
  // R70：纵深校验——本函数此前零校验直接落盘（调用方虽然有 version 校验，但函数本身不设防）。
  // 非法结构一旦进库，会被后续每一次 persist 固化，且分类树等递归路径会直接卡死页面。
  if (!newData || typeof newData !== 'object' || (newData as { version?: unknown }).version !== 2) {
    throw new Error('replaceData: 数据版本不兼容（需 v2 格式），已拒绝写入')
  }
  cache = newData
  await saveDataNow()
}

/** 同步缓存引用（外部 storage 变更时调用，保持 cache 与最新数据一致） */
export function syncCache(newData: AppData): void {
  cache = newData
  markDataDirty() // R148-P1b：整份缓存被换掉（外部写入/合并/导入）= 派生缓存一律作废
  dataVersion++
  markStorageMirror(newData)
  // 第卌四轮 T-05：外部写入静默重建快照——事件由执行写入的上下文记录，避免双记
  rebuildEventSnapshot(newData)
}

// ============ R58-B2 · 跨上下文并发写合并 ============
// 旧语义：外部写入到达 → syncCache 整树替换 → 本页 300ms 防抖窗口内（以及表单直改树、尚未落盘）的
// 修改被静默吞掉（双标签页/新标签页+网页浮层组合实机复现丢改）。新语义：本页有未落盘改动时做
// 卡片级 LWW 合并；非卡段「本页相对存储镜像有改动则保留本页，否则取外部」。
// lastPersistedJson 恒等「storage 当前内容」的镜像：本地保存成功=载荷，外部接收=外部树，合并后=外部树
//（合并结果随后经 saveData 落盘时再刷新）。
let lastPersistedJson = ''
function markStorageMirror(data: AppData): void {
  try { lastPersistedJson = JSON.stringify(data) } catch { lastPersistedJson = '' }
}
function jsonEq(a: unknown, b: unknown): boolean {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}
interface MergeCard { id: string; updatedAt?: number }
/** 卡片数组合并：以本页数组顺序为骨架；本页未动的卡取外部；本页动过的卡与外部按 updatedAt LWW（平手取本地，保护正在输入的表单）；外部新建收编；外部物理移除（回收站清空）且本页未动 → 尊重外部 */
function mergeCardArr<T extends MergeCard>(localArr: T[], snapArr: T[], extArr: T[]): T[] {
  const snapById = new Map(snapArr.map(c => [c.id, c]))
  const extById = new Map(extArr.map(c => [c.id, c]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const l of localArr) {
    seen.add(l.id)
    const e = extById.get(l.id)
    const sn = snapById.get(l.id)
    const localDirty = !sn || !jsonEq(l, sn)
    if (!e) { if (localDirty) out.push(l); continue }
    if (!localDirty) { out.push(e); continue }
    out.push(((e.updatedAt || 0) > (l.updatedAt || 0)) ? e : l)
  }
  for (const e of extArr) if (!seen.has(e.id)) out.push(e)
  return out
}
/** R70：通用「按 id 并集」合并——用于**无 updatedAt 的实体段**（策展台/分类/标签树/投射）。
 *  此前这些段走的是「全有或全无」：只要本页与外部都动过就整段取本地，
 *  外部新建的策展台/分类/投射会被静默丢弃（本页只改了一个字段，代价却是别人新建的整段消失）。
 *  规则：本页没动 → 取外部；本页动过外部也动过 → 取本地（无版本可比，保护正在输入的表单）；
 *  外部新增收编；外部已删且本页没动 → 尊重外部删除。 */
/** R151：标签树合并——整树替换过的一侧胜出（靠 tagTreeRevision），同版本才按 id 并集（保留旧行为）。
 *  没有这条，「整体梳理」换的新树会被另一个 popup 里的旧节点并回来，"完全替换"就是空话。 */
function mergeTagTree(cur: AppData, snap: AppData, ext: AppData) {
  const rc = cur.tagTreeRevision || 0, re = ext.tagTreeRevision || 0, rs = snap.tagTreeRevision || 0
  if (rc > rs && rc >= re) return cur.tagTree || []
  if (re > rs) return ext.tagTree || []
  return mergeByIdArr(cur.tagTree || [], snap.tagTree || [], ext.tagTree || [])
}

function mergeByIdArr<T extends { id: string }>(localArr: T[], snapArr: T[], extArr: T[]): T[] {
  const snapById = new Map(snapArr.map(c => [c.id, c]))
  const extById = new Map(extArr.map(c => [c.id, c]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const l of localArr) {
    seen.add(l.id)
    const e = extById.get(l.id)
    const sn = snapById.get(l.id)
    if (!e) { if (!sn || !jsonEq(l, sn)) out.push(l); continue }
    if (!sn || jsonEq(l, sn)) { out.push(e); continue }
    out.push(l)
  }
  for (const e of extArr) if (!seen.has(e.id)) out.push(e)
  return out
}
/** dailyFocus 按日期键合并：单边改动整键取该侧；双边同键都改过 → 槽级 LWW（按槽 id，FocusSlot 无 updatedAt，平手取本地） */
function mergeDailyFocus(curD: AppData['dailyFocus'], snapD: AppData['dailyFocus'], extD: AppData['dailyFocus']): AppData['dailyFocus'] {
  const out: AppData['dailyFocus'] = { ...(extD || {}) }
  const keys = new Set([...Object.keys(curD || {}), ...Object.keys(snapD || {})])
  for (const k of keys) {
    const c = (curD || {})[k], sn = (snapD || {})[k], e = (extD || {})[k]
    if (jsonEq(c, sn)) { if (e) out[k] = e; else delete out[k]; continue }
    if (jsonEq(e, sn) || !e) { if (c && c.length) out[k] = c; else delete out[k]; continue }
    out[k] = mergeCardArr(c || [], sn || [], e || []).slice(0, 3)
  }
  return out
}
/** 外部写入合并入口：无未落盘修改时走原整树替换（零开销快路径）；有则按段合并；合并结果与外部全等时不再回写（切断「回声→合并→写→回声」环） */
export function mergeExternalData(ext: AppData): AppData {
  const cur = cache
  if (!cur || !saveTimer) { syncCache(ext); return ext }
  let snap: AppData | null = null
  try { snap = lastPersistedJson ? (JSON.parse(lastPersistedJson) as AppData) : null } catch { snap = null }
  if (!snap) { syncCache(ext); return ext }
  const merged: AppData = {
    ...ext,
    resources: mergeCardArr(cur.resources || [], snap.resources || [], ext.resources || []),
    tasks: mergeCardArr(cur.tasks || [], snap.tasks || [], ext.tasks || []),
    curiosities: mergeCardArr(cur.curiosities || [], snap.curiosities || [], ext.curiosities || []),
    dailyFocus: mergeDailyFocus(cur.dailyFocus, snap.dailyFocus, ext.dailyFocus),
    compass: jsonEq(cur.compass, snap.compass) ? ext.compass : cur.compass,
    // R70：数组型实体段改「按 id 并集」；compass（三层嵌套）/ fieldConfig / stats 仍是对象型，
    // 深度合并风险大于收益，保留原判据（单边改动时取改动侧）。
    workspaces: mergeByIdArr(cur.workspaces || [], snap.workspaces || [], ext.workspaces || []),
    categories: mergeByIdArr(cur.categories || [], snap.categories || [], ext.categories || []),
    // R151：标签树有两个写入面——逐节点增删改（可并集）与整体梳理的整树替换（不可并集）。
    // 替换会给 tagTreeRevision +1，谁号大听谁的；同版本才退回按 id 并集。
    tagTree: mergeTagTree(cur, snap, ext),
    tagTreeRevision: Math.max(cur.tagTreeRevision || 0, ext.tagTreeRevision || 0),
    fieldConfig: jsonEq(cur.fieldConfig, snap.fieldConfig) ? ext.fieldConfig : cur.fieldConfig,
    stats: jsonEq(cur.stats, snap.stats) ? ext.stats : cur.stats,
    curationProjections: mergeByIdArr(cur.curationProjections || [], snap.curationProjections || [], ext.curationProjections || []),
    /* R166 定案 5：SupportLink 是"无 updatedAt 的实体段"，与 curationProjections 同法按 id 取并集。
       不能走卡片那条 LWW 骨架——它没有 updatedAt 可比，按时间戳合并会把另一端的关联整段冲掉。 */
    supportLinks: mergeByIdArr(cur.supportLinks || [], snap.supportLinks || [], ext.supportLinks || []),
    /* V3.7.0：论证节点卡——同为"无 updatedAt 必比"的实体段（新建/改名/排序），按 id 并集。 */
    argCards: mergeByIdArr(cur.argCards || [], snap.argCards || [], ext.argCards || [])
  }
  // 合并结果与外部全等 = 本页没有需要保全的改动（例如自有写入的回声）→ 只同步不回写，杜绝写环
  if (jsonEq(merged, ext)) { syncCache(ext); return ext }
  cache = merged
  dataVersion++
  // 存储镜像仍指向 storage 实际内容（ext）——本页未落盘改动在后续外部事件到达时保持「脏」判定
  markStorageMirror(ext)
  rebuildEventSnapshot(merged)
  saveData()
  return merged
}

// ============ R128-A1 · 跨上下文同步统一接线 ============
/**
 * 外部写入的唯一消费点。注册一次即覆盖 newtab / popup / content / options 全上下文：
 *  - 数据键：非本页写入 → mergeExternalData（本页无未落盘改动时整树替换）→ 通知订阅者；
 *  - UI 键：逐键合并（见 mergeExternalUIPrefs）。
 * 此前该链路只在新标签页 store 内手工注册，其余上下文的「读—改—整树写」没有任何合并保护。
 */
let syncAttached = false
export function attachStorageSync(): void {
  if (syncAttached) return
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged || !chromeStore()) return
  syncAttached = true
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const dch = changes[STORAGE_KEY]
    if (dch) {
      const ext = dch.newValue as AppData | undefined
      // 键被删除（清库/重置）时 newValue 为 undefined：保持既有语义，不触发合并
      if (ext && !isSelfWrite(ext)) {
        try { mergeExternalData(ext) } catch { /* 合并失败保持本页树，下次写入仍按本页为准 */ }
        if (cache) listeners.forEach((fn) => fn(cache!))
      }
    }
    const uch = changes[UI_KEY]
    if (uch) mergeExternalUIPrefs(uch.newValue as UIPrefs | undefined)
    // R160（P5）：外部上下文写入事件日志时刷新内存缓存（本地有待写事件则不覆盖）
    const ech = changes[EVENT_LOG_KEY]
    if (ech) initEventLog(ech.newValue)
  })
}

// ============ UI 偏好 ============

let uiCache: UIPrefs | null = null
/**
 * R128-A1：本上下文对某键的最后一次写入值（JSON 串）。
 * saveUIPrefs 是整对象覆盖写，多上下文各持一份 uiCache → A 改主题、B 改列数时，
 * B 的整对象写会把 A 的主题回退成 B 内存里的旧值。策略：外部事件里**只接受本上下文没写过的键**，
 * 我方写过的键在外部确认收到之前保持本地值；外部值一旦等于我方值即解除保护（回声落地），此后跟随外部。
 */
const uiSelfWritten = new Map<string, string>()

function mergeExternalUIPrefs(ext: UIPrefs | undefined): void {
  if (!uiCache || !ext || typeof ext !== 'object') return
  const next = { ...uiCache } as Record<string, unknown>
  const src = ext as unknown as Record<string, unknown>
  let changed = false
  for (const k of Object.keys(src)) {
    const extJson = JSON.stringify(src[k])
    const mine = uiSelfWritten.get(k)
    if (mine !== undefined) {
      if (mine === extJson) uiSelfWritten.delete(k)
      continue
    }
    if (extJson !== JSON.stringify(next[k])) { next[k] = src[k]; changed = true }
  }
  if (changed) uiCache = next as unknown as UIPrefs
}

export async function loadUIPrefs(prefetchedUI?: unknown): Promise<UIPrefs> {
  if (uiCache) return uiCache
  const cs = chromeStore()
  const defaults: UIPrefs = {
    theme: 'linear',
    viewMode: 'card',
    tcSplitRatio: 50,
    wsSwitchMod: 'alt'
  }
  if (!cs) {
    uiCache = defaults
    return uiCache
  }
  // R160（P6）：允许调用方传入已取回的 UI 偏好（boot 批量读），省一次往返
  const uiRaw = prefetchedUI !== undefined ? prefetchedUI : (await cs.get([UI_KEY]))[UI_KEY]
  uiCache = { ...defaults, ...(uiRaw as UIPrefs | undefined) }
  // O18：旧默认 ctrl 迁移为 alt
  if (uiCache.wsSwitchMod === 'ctrl') { uiCache.wsSwitchMod = 'alt'; saveUIPrefs({ wsSwitchMod: 'alt' }) }
  // 视觉重构（V2.3）：旧默认 green 迁移为 linear；R53-D：主题精简四套——已删除的 green/night 一并迁移（幂等）
  if (uiCache.theme === 'green' || uiCache.theme === 'night') { uiCache.theme = 'linear'; saveUIPrefs({ theme: 'linear' }) }
  // R126（诉求 5）：应用全局默认冷却天数（缺省 30）
  setCoolingDefaultDays(uiCache.coolingDaysDefault ?? 30)
  return uiCache
}

export function getUIPrefs(): UIPrefs {
  if (!uiCache) throw new Error('UI prefs not loaded.')
  return uiCache
}

export function saveUIPrefs(patch: Partial<UIPrefs>): void {
  if (!uiCache) return
  uiCache = { ...uiCache, ...patch }
  // R128-A1：记下我方写过的键与值，供 mergeExternalUIPrefs 判定「哪些键不许被外部旧值回退」
  for (const k of Object.keys(patch)) {
    try { uiSelfWritten.set(k, JSON.stringify((uiCache as unknown as Record<string, unknown>)[k])) } catch { /* 不可序列化值不保护 */ }
  }
  chromeStore()?.set({ [UI_KEY]: uiCache })
}
