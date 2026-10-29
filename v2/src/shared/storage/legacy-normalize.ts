import type { AppData } from '@/shared/models'
import { safeDecodeText } from '@/shared/utils'

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
export function foldParentIdSubtasks(data: AppData): void {
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
  /* V3.9.2：项目“下一步”是新增可选字段——旧库/旧备份不需要写迁移戳，
     这里只把非字符串脏值收敛为空串，避免模板把对象/数字直接渲染成 [object Object]。 */
  for (const dir of d.compass?.directions || []) {
    for (const p of dir.projects || []) {
      if (p.nextStep !== undefined && typeof p.nextStep !== 'string') p.nextStep = ''
    }
  }
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
    // customFields 是键值对象，不是数组。旧判据误用 Array.isArray 会把所有正常的
    // 对象形式自定义字段清空（转卡时整片字段静默丢失），这里只挡缺失与非对象形状。
    if (!c.customFields || typeof c.customFields !== 'object' || Array.isArray(c.customFields)) c.customFields = {}
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
    if (!c.customFields || typeof c.customFields !== 'object' || Array.isArray(c.customFields)) c.customFields = {}
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
