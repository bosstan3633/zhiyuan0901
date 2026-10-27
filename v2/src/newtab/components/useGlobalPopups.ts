import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted, shallowRef, defineAsyncComponent } from 'vue'
import { wsNameById } from '@/shared/utils/wsName'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import { useCuriosity } from '@/newtab/stores/curiosity'
import { showToast } from '@/shared/components/toast'
import { uid, normalizeUrl } from '@/shared/utils'
import { CURATION_WS_ID } from '@/shared/models'
import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { recordResourceOpen, recordCardOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, toOpenableRawLink, openExternalLink, linkPlaceholderFor } from '@/shared/utils/link'
import { useConfirm } from '@/shared/components/confirm'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { markRank } from '@/shared/utils/marksort'
import { saveUIPrefs } from '@/shared/storage/repository'
import { getRecentWebTab } from '@/shared/utils/recentWebTab'
import GlobalPopupsShortcuts from './GlobalPopupsShortcuts.vue'
import GlobalPopupsQuickAdd from './GlobalPopupsQuickAdd.vue'
import { AI_ENTRIES } from '@/shared/ai/jobs/registry'
import { useGlobalPopupsSearch } from './useGlobalPopupsSearch'
import { useGlobalPopupsCapture } from './useGlobalPopupsCapture'
import { useGlobalPopupsRows } from './useGlobalPopupsRows'

export type PanelType = 'search' | 'capture' | 'curio' | 'shortcuts' | 'taskcapture' | 'ai-advice' | null
export interface SearchResult {
  id: string
  // 第卅二轮 REQ-008：新增 'ws' 策展台实体命中；R49-G：新增 'proj' 项目实体命中
  type: 'res'|'task'|'curio'|'ws'|'proj'
  iconClass: string
  iconText: string
  title: string
  ws: string
  cat: string
  badges: {type: string, text: string}[]
  link?: {type: string, text: string}
  due?: string
  dueOverdue?: boolean
  summary?: string
  /** R110-LC（T3）：已归档卡（默认检索结果集排除，仅用于「另有 N 张」降级提示计数） */
  archived?: boolean
  /**
   * R4-Pa：命中判据要用的三份字符串**建行时算一次**（此前每次键入对每张卡现算）——
   *   bl＝命中字段拼接后转小写、nb＝bl 的归一化（R117-F6 那套 NFKC+去分隔符）、nt＝标题归一化。
   *   实测理由：合成库 2,548 行、键入 6 字的尾部重算 16~38ms（perf M5d），CPU 谱里
   *   `RegExp: [\s\-_/\\.,·、|]+` 就是 normKey 的那条正则——归一化本身被重复付了 n 遍。
   *   建表按数据缓存（见 resultTable），所以这几份只在数据真变过才算第二次。
   */
  bl: string
  nb: string
  nt: string
  /** R4-Pa：标题转小写（hitRank 每行都要，改前每行现算） */
  tl: string
  /** R4-Pa：标题里有没有汉字——没有就不可能有拼音通道，连 pinyinOf 都不必进 */
  cjk: boolean
  raw: ResourceCard | TaskCard | CuriosityCard | Workspace
}
export type SearchResultSeed = Omit<SearchResult, 'bl' | 'nb' | 'nt' | 'tl' | 'cjk'>
export type AiCand = { id: string; type: string; title: string; ws: string; cat: string; summary?: string; tags?: string[]; callCount?: number; updatedAt?: number; fields?: string; link?: string }
export type AiHit = { id: string; why: string; confidence: number; weak: boolean }
export type AiOut = { hits: AiHit[]; note: string; scanned: number; total: number; dropped: number; batches: number; scope: string }
export interface PaletteToggle { label: string; icon: string; on: boolean; hint: string; run: () => void }
export type AiPanelEntry = typeof AI_ENTRIES[number] & { panel: NonNullable<typeof AI_ENTRIES[number]['panel']> }
export type BrowseTab = 'common' | 'ai'
export type DormantVerdictGP = { cardId?: string; verdict: string; reason?: string; actionHint?: string }

export function useGlobalPopups() {
type FlatItem = { kind: 'ai'; entry: AiPanelEntry } | { kind: 'qa'; qa: typeof QUICK_ACTIONS[number] } | { kind: 'tgl'; tg: PaletteToggle } | { kind: 'res'; item: SearchResult } | { kind: 'result'; item: SearchResult }
/* R4-Dk：「转化为资源卡/任务」的唯一实现（CuriosityPanel 那条路一直在用它）——
   面板此前自己手搓一份卡，公共字段与出路记账全丢，见 convertCurio 的注释。 */
// V2.21：拼音字典改为按需加载（约 296KB），未就绪时降级为纯文本匹配
// R146-b：AI 入口统一徽标（真源 AiMark.vue，零 AI 字面量，可进启动链）
// R146（回退契约）：检索浮层删任务改走软删真源（同时摘 metric.taskIds，守 R141 双向不变量）
// ★V3.9.20：getRecentWebTab 升为共享工具（采集预填与好奇来源捕获两个消费方分家后不再私有）
// ★V3.9.6：快捷键速查面板已拆出为 `GlobalPopupsShortcuts.vue`，
//   清单真源（shared/utils/shortcuts.ts，与设置页、手册同源）随之搬进那个组件。
// ★V3.9.20 拆分第二块：快速添加家族（任务速记 + 好奇采集）
// R158：命令面板 AI 分组数据源——只引注册表**纯声明**（零 import 红线：registry.ts 不拉任何工厂，
// 入口 chunk 触达的只是静态常量，启动零 AI 不变；真正的 AI 栈仍由各宿主懒加载）

const router = useRouter()
const store = useAppStore()
const { convertToResource, convertToTask } = useCuriosity()
const d = computed(() => store.data!)

// 弹窗状态
const activePanel = ref<PanelType>(null)
const quickAddRef = ref<InstanceType<typeof GlobalPopupsQuickAdd> | null>(null)
/** openPanel 时的预填（R172-T11：复盘「生成任务」→ 任务速记；随面板拆分改经 props 传递） */
const panelPrefill = ref<{ title?: string; description?: string } | undefined>()
const searchInput = ref<HTMLInputElement | null>(null)
const capTitleInput = ref<HTMLInputElement | null>(null)
const resultsEl = ref<HTMLDivElement | null>(null)

let lastFocused: HTMLElement | null = null
function openPanel(p: PanelType, prefill?: { title?: string; description?: string }) {
  lastFocused = document.activeElement as HTMLElement | null
  panelPrefill.value = prefill
  activePanel.value = p
  if (p === 'capture') {
    capSaved.value = false
    // R138-H1′：入口宿主必须全懒——读 AI 配置仅同步勾选态展示，失败静默
    void import('@/shared/ai/config').then(m => { m.loadAiConfig().then(() => { capEnrichOn.value = m.aiConfig.value.captureEnrich }) })
  }
  // V2.21：字典按需加载——仅在搜索面板被打开时才拉取，不进新标签页首屏同步路径
  // R47-A4：每次唤起清空上次查询词，恢复浏览态（无输入=近期热度排序）
  // R60-2：selectedId 与 searchQuery 必须同时清空，否则下次唤起会锚定到上一次选中的卡
  if (p === 'search') { currentType.value = 'all'; setSearchQuery(''); selectedId.value = ''; void ensurePinyin() }
  /* ★V3.9.20：taskcapture / curio 的开面板初始化（预填、选中文本捕获、来源补全、聚焦）
     随面板拆进 GlobalPopupsQuickAdd 的 active watcher——宿主不再触达面板内部状态。 */
  nextTick(() => {
    if (p === 'search') { searchInput.value?.focus(); runSearch() }
    if (p === 'capture') {
      prefillCapture()
      if (capSaved.value) return
      capTitleInput.value?.focus(); capTitleInput.value?.select()
    }
  })
}
function closeAll() {
  // R161-②：这次检索真有结果也算"用过"——不是每个人都会点开某一行；同句只记一次（recordSearch 内幂等）
  if (searchQuery.value.trim() && filteredResults.value.length) recordSearch(searchQuery.value)
  activePanel.value = null
  convertMenuId.value = null
  capSaved.value = false
  if (savedTimer.value) { clearTimeout(savedTimer.value); savedTimer.value = null }
  // B8：焦点返还，关闭浮层后原地继续输入
  lastFocused?.focus?.()
  lastFocused = null
}

/** 已保存状态：按 Enter 打开看板定位新卡（G：走 background 单例定位） */
function openSavedBoard() {
  if (!savedWsId.value || !savedResourceId.value) { closeAll(); return }
  chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: savedWsId.value, hl: savedResourceId.value })
  resetCaptureForm()
  closeAll()
}

function onSavedKeydown(e: KeyboardEvent) {
  /* ★V3.9.20：taskcapture 的 saved 态键盘随面板拆走，经 defineExpose 转发（消费即返回） */
  if (quickAddRef.value?.savedKey(e)) return
  if (activePanel.value !== 'capture' || !capSaved.value) return
  if (e.key === 'Enter') { e.preventDefault(); openSavedBoard() }
  else if (e.key === 'Escape') { e.preventDefault(); closeAll() }
}

// 暴露给外部
/** 打开采集弹窗时自动预填最近网页的标题与链接 */
async function prefillCapture() {
  if (capForm.title || capForm.link) return
  const tab = await getRecentWebTab()
  if (tab) {
    capForm.title = tab.title || ''
    capForm.link = tab.url || ''
  }
}

// ===== 全局搜索 =====
// R131-C2：查询词防抖 120ms——输入框 v-model 绑 searchQueryRaw（即时回显），
// 整链 computed（counts/wsTree/filteredResults/archivedMatchCount/热度）只读防抖后的 searchQuery，
// 连续快打不再每键重算全库管线（原实现每击一键全链重跑）。
const searchQueryRaw = ref('')
const searchQuery = ref('')
let qDebounce: ReturnType<typeof setTimeout> | null = null
watch(searchQueryRaw, v => {
  if (qDebounce) clearTimeout(qDebounce)
  qDebounce = setTimeout(() => { qDebounce = null; searchQuery.value = v }, 120)
})
/** 程序化设置查询词（打开复位 / Tab 关键词消费）：raw 与防抖值同步落定，取消在途防抖 */
function setSearchQuery(v: string) {
  if (qDebounce) { clearTimeout(qDebounce); qDebounce = null }
  searchQueryRaw.value = v; searchQuery.value = v
}
onUnmounted(() => { if (qDebounce) clearTimeout(qDebounce) })

/* R181：常用检索词状态（SEARCH_HIST_MAX / searchHistory / topSearches / recordedQ / recordSearch）
   随「检索域」整体下沉到 useGlobalPopupsSearch.ts，宿主只在不改文本的前提下转出这些读数。 */
/** 点历史词 = 把当时那句话放回检索框（走 setSearchQuery，raw 与防抖值同步落定） */
function useHistory(q: string): void {
  setSearchQuery(q)
  searchInput.value?.focus()
}
// R131-C2：浮层关闭 = 检索管线整体停摆。gp-overlay 恒挂载（opacity 隐藏），
// 模板绑定让整链在面板关闭时仍随全库每次变更重算；此守卫把关闭态的全部重计算压到 O(1)。
const searchActive = computed(() => activePanel.value === 'search')
/**
 * V2.21：拼音字典就绪状态（响应式）。
 * filteredResults 通过读取它建立依赖——字典异步加载完成后，
 * computed 自动重算一次，把拼音/首字母命中补进结果，无需用户重新输入。
 */
const pinyinReady = ref(isPinyinReady())
onPinyinReady(() => { pinyinReady.value = true })
/** B29：类型过滤单一状态源——搜索框 chip 与类型 Tab 行共用，Tab 切换两者同步
 *  R49-G：新增 'ws' 策展台（分类树定位）/ 'proj' 项目（直达项目详情）两类型 */
const currentType = ref<'all'|'res'|'task'|'curio'|'ws'|'proj'>('all')
const selIndex = ref(0)
/**
 * R60-1/2：选中项锚点 = 卡片 id。
 * 原实现以「下标」为锚，而下标会随结果重排漂移（拼音补跑 / 类型过滤 / 分组渲染顺序），
 * 导致「点 A 开 B」。改为 id 锚定后：点击、hover、Enter 三者永不脱钩。
 */
const selectedId = ref('')
/** 由下标反推 id（键盘上下键后调用）；ai/qa 行无卡片 id，置空 */
function syncIdFromIndex() {
  const it = flatList.value[selIndex.value]
  selectedId.value = it && (it.kind === 'res' || it.kind === 'result') ? it.item.id : ''
}
/** 由 id 反推下标（点击 / hover 后调用，保证 Enter 打开的与高亮的是同一条） */
function syncIndexFromId() {
  selectedId.value = selectedId.value || ''
  selIndex.value = flatList.value.findIndex(x => (x.kind === 'res' || x.kind === 'result') && x.item.id === selectedId.value)
}
const convertMenuId = ref<string | null>(null)

function typeLabel(t: 'all'|'res'|'task'|'curio'|'ws'|'proj'): string {
  return t === 'res' ? '资源卡' : t === 'task' ? '任务卡' : t === 'curio' ? '好奇心' : t === 'ws' ? '策展台' : t === 'proj' ? '项目' : '搜全部'
}
const filterLabel = computed(() => typeLabel(currentType.value))

const counts = computed(() => {
  if (!searchActive.value) return { all: 0, res: 0, task: 0, curio: 0, ws: 0, proj: 0 }
  const all = d.value
  return {
    all: all.resources.filter(r=>!r.deletedAt).length + all.tasks.filter(t=>!t.deletedAt).length + all.curiosities.filter(c=>!c.deletedAt).length + all.workspaces.filter(w=>!w.archived && w.id !== CURATION_WS_ID).length,
    res: all.resources.filter(r=>!r.deletedAt).length,
    task: all.tasks.filter(t=>!t.deletedAt).length,
    curio: all.curiosities.filter(c=>!c.deletedAt).length,
    ws: all.workspaces.filter(w=>!w.archived && w.id !== CURATION_WS_ID).length,
    proj: allProjects().filter(p => showDoneProjects.value || !isProjectDone(p)).length
  }
})

/** 建行时的形状：匹配用的派生字段由 withMatchFields 补齐 */

/** R4-Pa：面板关着时 allResults 返回的共享空表（不新建数组，免得把依赖关系写活） */
const EMPTY_RESULTS: SearchResult[] = []

/** R4-Pa：建行时把命中判据要的三份字符串一次算完（blobOf 仍是「命中字段清单」的唯一定义处） */
function withMatchFields(x: SearchResultSeed): SearchResult {
  const bl = blobOf(x).toLowerCase()
  return { ...x, bl, nb: normKey(bl), nt: normKey(x.title), tl: x.title.toLowerCase(), cjk: /[\u4e00-\u9fff]/.test(x.title) }
}

/**
 * R4-Pa（#71 第一刀）：结果表**按数据建、按开合露出**，两层拆开。
 * 改前 `allResults` 直接把 `searchActive` 读进 computed，于是「关面板」也算一次依赖变化——
 * 每次开 ⌘K 都把整表重建（2,548 行 × 建对象 + 台名/分类查表 + 链接截断正则）。
 * 实测对照：空库开面板 48ms、满库开 100ms 且连开五次不衰减（48/100 都是墙钟，/tmp/zy_pa_attr.cjs）。
 * 拆开后：关着不读 → 不建；开着时读的是按 d 缓存的那份 → 第二次开直接吃缓存，
 * 只有数据真变过（任何一次写库）才重建。
 */
const resultTable = computed<SearchResult[]>(() => {
  const results: SearchResult[] = []
  const all = d.value
  // R131-C2：查表索引一次成型——改前逐卡对全表 find（900 卡 × 200 台/类 ≈ 18 万次比较/轮）
  const wsById = new Map(all.workspaces.map(w => [w.id, w]))
  const catById = new Map(all.categories.map(c => [c.id, c]))
  const projById = new Map<string, { id: string; name: string }>()
  const projDirName = new Map<string, string>()
  for (const dir of all.compass.directions) for (const p of dir.projects) { projById.set(p.id, p); projDirName.set(p.id, dir.name) }
  const wsCardCount = new Map<string, number>()
  for (const r of all.resources) if (!r.deletedAt) wsCardCount.set(r.workspaceId, (wsCardCount.get(r.workspaceId) || 0) + 1)

  // 资源卡
  all.resources.filter(r=>!r.deletedAt).forEach(r => {
    const ws = wsById.get(r.workspaceId)
    const cat = catById.get(r.categoryId || "")
    const rlink = r.link
    results.push(withMatchFields({
      id: r.id, type: 'res', iconClass: 'res', iconText: '',
      title: r.title, ws: wsNameById(all.workspaces, r.workspaceId) || '未知', cat: cat?.name || '待分类',
      badges: [],
      link: rlink ? { type: r.linkType, text: linkShort(rlink as string) } : undefined,
      summary: r.description,
      archived: !!r.lifecycleArchived,
      raw: r
    }))
  })

  // 任务卡
  all.tasks.filter(t=>!t.deletedAt).forEach(t => {
    const proj = projById.get(t.projectId || '')
    const statusIcon = t.status==='done'?'':t.status==='doing'?'◐':'○'
    const statusClass = t.status==='done'?'task-done':t.status==='doing'?'task-doing':'task-todo'
    const badges: {type:string,text:string}[] = []
    if (t.priority==='high') badges.push({type:'prio-high', text:'高'})
    else if (t.priority==='medium') badges.push({type:'prio-mid', text:'中'})
    badges.push({type:`status-${t.status}`, text: t.status==='done'?'已完成':t.status==='doing'?'进行中':'待开始'})
    results.push(withMatchFields({
      id: t.id, type: 'task', iconClass: statusClass, iconText: statusIcon,
      title: t.title, ws: '任务中心', cat: proj?.name || '未归属',
      badges,
      summary: t.description,
      archived: !!t.lifecycleArchived,
      raw: t
    }))
  })

  // 好奇心
  all.curiosities.filter(c=>!c.deletedAt).forEach(c => {
    const statusText = c.status==='todo'?'待探索':c.status==='doing'?'探索中':c.status==='done'?'已求证':'已搁置'
    results.push(withMatchFields({
      id: c.id, type: 'curio', iconClass: 'curio', iconText: '',
      title: c.question, ws: '调度台', cat: '好奇心',
      badges: [{type:'curio-status', text: statusText}],
      archived: !!c.lifecycleArchived,
      raw: c
    }))
  })

  // 第卅二轮 REQ-008：检索范围扩展至策展台实体（模糊匹配策展台名称，专属图标区分类别）
  // R70：补 CURATION_WS_ID 过滤——R68 修口径时计数（counts）与类型树（wsTree）都排除了资源台本体，
  // 唯独结果集漏了（此处直读 d.value.workspaces，绕过了 store 的 workspaces getter）。
  d.value.workspaces.filter(w => !w.archived && w.id !== CURATION_WS_ID).forEach(w => {
    const cardCount = wsCardCount.get(w.id) || 0
    results.push(withMatchFields({
      id: w.id, type: 'ws', iconClass: 'ws', iconText: '',
      title: w.name, ws: '策展台', cat: `${cardCount} 张资源卡`,
      badges: [{ type: 'ws-badge', text: '策展台' }],
      summary: '',
      raw: w
    }))
  })

  // R49-G：项目实体（点击直达项目详情 /compass/projects?p=；受已完成显隐开关约束）
  allProjects().filter(p => showDoneProjects.value || !isProjectDone(p)).forEach(p => {
    const dir = { name: projDirName.get(p.id) || '—' }
    const badges: {type:string,text:string}[] = []
    if (p.isFocused) badges.push({ type: 'prio-high', text: '主攻' })
    if (p.status === 'archived') badges.push({ type: 'curio-status', text: '已完成' })
    results.push(withMatchFields({
      id: p.id, type: 'proj', iconClass: 'ws', iconText: '',
      title: p.name, ws: '方向台', cat: dir?.name || '—',
      badges,
      summary: '',
      raw: p as any
    }))
  })

  return results
})
const allResults = computed<SearchResult[]>(() => searchActive.value ? resultTable.value : EMPTY_RESULTS)

/** R49-G4：项目类型受已完成显隐开关约束（与主航线/项目总览/完整方向树共用 UIPrefs） */
const showDoneProjects = computed(() => (store.ui as any)?.showDoneProjects !== false)

/** R49-G2：策展台类型 → 策展台→分类树（含分类卡片数；关键字过滤策展台名/分类名） */
const wsTree = computed(() => {
  if (!searchActive.value) return []
  const q = searchQuery.value.trim().toLowerCase()
  // R131-C2：计数 bucket 一次成型——改前每个分类都全表 filter 一遍资源/子分类（O(台×类×卡)）
  const byWs = new Map<string, number>()
  const byCat = new Map<string, number>()
  const catWsOf = new Map(d.value.categories.map(c => [c.id, c.workspaceId]))
  for (const r of d.value.resources) {
    if (r.deletedAt) continue
    byWs.set(r.workspaceId, (byWs.get(r.workspaceId) || 0) + 1)
    // 与改前判据一致：卡须同时满足「属本台」且「分类在族内」（悬空/跨台脏数据不串计）
    if (r.categoryId && catWsOf.get(r.categoryId) === r.workspaceId) byCat.set(r.categoryId, (byCat.get(r.categoryId) || 0) + 1)
  }
  const childIds = new Map<string, string[]>()
  for (const c of d.value.categories) if (c.parentId) { const a = childIds.get(c.parentId) || []; a.push(c.id); childIds.set(c.parentId, a) }
  // R68-F1：口径对齐台签栏——排除资源台本体实体（固定 Tab，非台签策展台），历史遗留实体不再混入
  return d.value.workspaces.filter(w => !w.archived && w.id !== CURATION_WS_ID)
    .filter(w => !q || w.name.toLowerCase().includes(q))
    .map(w => {
      const cats = d.value.categories.filter(c => c.workspaceId === w.id)
        .filter(c => !q || c.name.toLowerCase().includes(q))
        .map(c => ({ id: c.id, name: c.name, count: (byCat.get(c.id) || 0) + (childIds.get(c.id) || []).reduce((n, cid) => n + (byCat.get(cid) || 0), 0) }))
      return { id: w.id, name: w.name, cards: byWs.get(w.id) || 0, cats }
    })
})
function wsNameOf(id: string): string {
  return wsNameById(d.value.workspaces, id)
}
/** R49-G3：点击分类 → 定位策展台该分类（有卡=高亮第一张；无卡=高亮分类行） */
function locateCat(wsId: string, cat: { id: string; name: string }) {
  recordWorkspaceOpen(d.value, d.value.workspaces.find(w => w.id === wsId))
  // R173-T3：只动台热度（ws 段在热度键载荷里）——整库写盘留给真改数据的动作
  store.persistHot()
  closeAll()
  router.push({ path: `/workspace/${wsId}`, query: { cat: cat.id } })
  showToast(`↗ 定位到「${cat.name}」`)
}

/**
 * R117（04-61 F6）：检索归一化 —— 字符级精确匹配不再是唯一判据。
 * 归一化链：NFKC（全角→半角）+ 去零宽/BOM + 小写 + **去空白与常见分隔符**（空格 - _ / \ . · 、 |）。
 * 收益：「db skill」≡「dbskill」≡「DB_Skill」≡「ｄｂｓｋｉｌｌ」等价命中——对应反馈
 * 「关键词一样但中间有空格也要检索出来」。归一化只放宽**召回**，排序仍按命中强度分级。
 */
function normKey(s: string): string {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .toLowerCase()
    .replace(/[\s\-_/\\.,·、|]+/g, '')
}
/** 命中字段拼接（R58-B4 两端同构：搜索面板与网页浮层一致；raw 为原始卡） */
function blobOf(r: SearchResultSeed): string {
  const rawTags = Array.isArray((r.raw as { tags?: string[] })?.tags) ? ((r.raw as { tags?: string[] }).tags as string[]).join('') : ''
  return r.title + '' + r.ws + '' + r.cat + '' + (r.summary || '') + '' + (r.link?.text || '') + '' + rawTags
}
/**
 * R4-Pa：同一查询词的"每词派生量"只算一份（一轮键入 2,548 行传的是同一个 parts）。
 *   np[i] = normKey(parts[i]) —— 改前每行每词各跑一遍 normalize + 两条正则；
 *   py[i] = 这个词还**可能**有拼音命中吗——拼音串只由小写字母组成（full 形态再多加空格），
 *     而 parts 来自 `q.toLowerCase()`，所以含汉字/数字/全角的词面永远不可能是它的子串。
 *     改前这些词照样逐行进 pinyinOf（LRU 命中也要 delete+set 各一次）——中文查询时整条
 *     拼音通道都是白付（实测见 /tmp/zy_pa_attr.cjs 的词扫）。判据放宽的是召回，
 *     这一刀不改任何召回结果，只砍掉不可能成立的调用。
 */
let partsKey = ''
let partsNp: string[] = []
let partsPy: boolean[] = []
function normedParts(parts: string[]): { np: string[]; py: boolean[] } {
  // 缓存键必须带分隔符：join('') 会让 ['ab','c'] 与 ['a','bc'] 撞成同一个 'abc'，
  // 而两者的 np/py 数组并不相同 ⇒ 第二次查询会拿到另一组词的归一结果（静默错召回）。
  const key = parts.join(' ')
  if (key !== partsKey) {
    partsKey = key
    partsNp = parts.map(p => normKey(p))
    partsPy = parts.map(p => /^[a-z]+$/.test(p))
  }
  return { np: partsNp, py: partsPy }
}

/**
 * R110-LC（T3）：检索命中判据——默认结果集与归档提示计数共用同一实现（两处必须同口径）。
 * R117（04-61 F6）两层判据：
 *   ① 整串归一命中（最强）：「db skill」→ nq="dbskill"，字段归一后含之即命中；
 *   ② 分词 AND 命中（原语义）+ 每词归一兜底 + 拼音（V2.21 懒加载就绪后自动补跑）。
 */
function hitResult(r: SearchResult, parts: string[]): boolean {
  if (!parts.length) return true
  // R4-Pa：bl/nb 建行时已算好（见 withMatchFields）——这里只做子串比较，不再碰 normalize 与正则
  const blob = r.bl
  const nb = r.nb
  // ① 整串归一：允许用户输入的词间空格/分隔符与数据不一致
  const nq = parts.join('')
  if (nq && nb.includes(nq)) return true
  // ② 分词 AND：每词「原文子串 或 归一子串」命中；中文标题另有拼音通道
  const { np, py } = normedParts(parts)
  const pinyinOn = pinyinReady.value && r.cjk
  return parts.every((p, i) => blob.includes(p) || (!!np[i] && nb.includes(np[i])) || (pinyinOn && py[i] && matchPinyin(r.title, p)))
}
const filteredResults = computed<SearchResult[]>(() => {
  // R110-LC（T3）：归档卡从默认检索结果消失（只在「另有 N 张」提示里报数）
  let list = allResults.value.filter(r => !r.archived)
  if (currentType.value !== 'all') list = list.filter(r => r.type === currentType.value)
  const q = searchQuery.value.trim().toLowerCase()
  const parts = q ? q.split(/\s+/) : []
  if (q) list = list.filter(r => hitResult(r, parts))
  // 第卅三轮 REQ-020：置顶 > 星标 ｜ R58-O1 + R117（F6）：命中强度分级 > 调用热度 > 最近调出
  // R131-C2：hitRank 装饰-排序-去装饰——比较器内不再重复计算（改前 O(n log n) 次 × 每次归一化+拼音匹配）
  const decorated = list.map(r => ({ r, mr: markRank(r.raw as AnyCard), hr: parts.length ? hitRank(r, parts) : 0 }))
  decorated.sort((a, b) => {
    const mr = b.mr - a.mr
    if (mr) return mr
    if (a.hr !== b.hr) return b.hr - a.hr
    const dc = (((b.r.raw as AnyCard).callCount || 0) - ((a.r.raw as AnyCard).callCount || 0))
    if (dc) return dc
    return (((b.r.raw as AnyCard).lastCalledAt || 0) - ((a.r.raw as AnyCard).lastCalledAt || 0))
  })
  return decorated.map(x => x.r)
})
/**
 * R117（04-61 F6）：命中强度分级（只影响排序，不决定是否命中）
 * 2 = 标题整串归一命中（正是用户要找的）· 1 = 标题分词/拼音命中 · 0 = 仅字段/摘要命中
 */
function hitRank(x: SearchResult, parts: string[]): number {
  if (!parts.length) return 0
  const title = x.tl          // R4-Pa：标题小写与归一化都建行时算好
  const nt = x.nt
  const nq = parts.join('')
  if (nq && nt.includes(nq)) return 2
  const { np, py } = normedParts(parts)
  const pinyinOn = pinyinReady.value && x.cjk
  if (parts.every((p, i) => title.includes(p) || (!!np[i] && nt.includes(np[i])) || (pinyinOn && py[i] && matchPinyin(x.title, p)))) return 1
  return 0
}

/**
 * R110-LC（T3）：归档卡命中数——归档卡已从默认结果集排除，这里用**同一命中判据**报「另有 N 张」。
 * 只在有关键词时计数（浏览模式不提示）。
 */
const archivedMatchCount = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return 0
  const parts = q.split(/\s+/)
  let list = allResults.value.filter(r => r.archived)
  if (currentType.value !== 'all') list = list.filter(r => r.type === currentType.value)
  return list.filter(r => hitResult(r, parts)).length
})

// R60-2：换查询词 / 换类型 = 换了条件，选中态重置（必须在下一条 watch 之前注册）
watch([searchQuery, currentType], () => { selectedId.value = '' })
// R60-2：结果集变化（含「拼音字典就绪后补跑命中」）→ 优先锚定回原选中项。
// 原实现无条件 `selIndex = 0`，补跑一发生就把用户当前选中弹回第一条，且顺序已变 → 点 A 开 B。
watch(filteredResults, () => {
  if (selectedId.value) {
    const i = flatList.value.findIndex(x => (x.kind === 'res' || x.kind === 'result') && x.item.id === selectedId.value)
    if (i >= 0) { selIndex.value = i; return }
  }
  // 无锚点或锚点已消失 → 默认选中第一条（需求：默认选中检索结果到第一个）
  selIndex.value = flatList.value.length ? 0 : -1
  syncIdFromIndex()
})

// ---- B1：命令面板升级（分组 / 高亮 / 快捷操作 / 最近打开） ----
const isBrowseMode = computed(() => !searchQuery.value.trim() && currentType.value === 'all')

// ============== R150：AI 检索（自然语言 → 三类卡语义召回，只读）· 沿用 R146-d 实测骨架：流式早停 + 30s 硬超时 + 可取消 + 同词缓存 ==============
// ★本组件被 App.vue 静态挂载（入口 chunk）：AI 依赖只在点击时 dynamic import，绝不静态引 '@/shared/ai/'。
// 键入路径零参与：不发请求、不参与 filteredResults 计算；结果只活内存态，改词即清。
  const { aiSearch, aiBusy, aiSecs, aiChars, aiTook, aiScanned, aiTotal, aiFound, aiDur, aiAbortCtl, aiTick, aiCancelMsg, aiCache, aiStopTick, aiAbort, cardFieldText, aiCands, aiProgress, aiMoreBatches, aiSearchRun, aiHitById, aiTopRows, SEARCH_HIST_MAX, searchHistory, topSearches, recordedQ, recordSearch } = useGlobalPopupsSearch({ activePanel, currentType, allResults, searchQuery, store })

const QUICK_ACTIONS = [
  { label: '打开方向台', icon: 'compass', run: () => { closeAll(); router.push('/compass') } },
  { label: '打开项目详情', icon: 'layout', run: () => { closeAll(); router.push('/compass/projects') } },
  // R3-B1：「打开方向树」与「打开方向台」在树即首屏后是同一个目的地，重复项退役（老 /compass/tree 深链由路由重定向兜住）
  { label: '打开回收站', icon: 'trash', run: () => { closeAll(); router.push('/recycle') } },
  { label: '打开使用手册', icon: 'arrowright', run: () => { closeAll(); router.push('/manual') } },
  { label: '打开设置', icon: 'settings', run: () => { closeAll(); router.push('/settings') } },
  { label: '采集资源卡（Ctrl+Shift+J）', icon: 'download', run: () => openPanel('capture') },
  { label: '采集好奇心（Ctrl+Shift+I）', icon: 'bulb', run: () => openPanel('curio') },
]
// R171-C1：快速开关组——04-63 任务书「全部开关收进命令面板」的收口（R158 拍板留设置页，本轮兑现）。
// 只收「点了立即生效、无需确认」的轻开关，写盘类重设置仍留设置页；computed 而非常量：行内要明示当前态。
// ⚠ store.ui 必须同步手改（repository 的 uiCache 与 store.ui 是两份引用，R170 工具盲区同源教训）。
const PALETTE_TOGGLES = computed<PaletteToggle[]>(() => {
  const ui = store.ui as Record<string, unknown> | null
  const resolvedDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return [
    {
      label: '暗色主题', icon: 'bulb',
      on: ui?.theme === 'dark' || (ui?.theme === 'auto' && resolvedDark),
      hint: '亮色/暗色一键切换（「跟随系统」的细粒度选择在设置页；auto 下点击会落为固定主题）',
      run: () => { store.setTheme(resolvedDark ? 'linear' : 'dark') }
    },
    {
      label: '紧凑密度', icon: 'layout',
      on: ui?.density === 'compact',
      hint: '卡片列表紧凑/舒适密度切换',
      run: () => {
        const next = (ui?.density === 'compact' ? 'cozy' : 'compact') as 'compact' | 'cozy'
        if (store.ui) (store.ui as { density?: string }).density = next
        saveUIPrefs({ density: next })
        if (next === 'compact') document.documentElement.setAttribute('data-density', 'compact')
        else document.documentElement.removeAttribute('data-density')
      }
    },
    {
      label: '已完成项目', icon: 'check',
      on: ui?.showDoneProjects !== false,
      hint: '项目列表是否显示「已完成」的项目',
      run: () => {
        const next = ui?.showDoneProjects === false
        if (store.ui) (store.ui as { showDoneProjects?: boolean }).showDoneProjects = next
        saveUIPrefs({ showDoneProjects: next })
      }
    },
    {
      label: '备份提醒', icon: 'settings',
      on: ui?.backupReminderEnabled !== false,
      hint: '30 天未导出备份/存储超限时右上角红点提醒',
      run: () => {
        const next = ui?.backupReminderEnabled === false
        if (store.ui) (store.ui as { backupReminderEnabled?: boolean }).backupReminderEnabled = next
        saveUIPrefs({ backupReminderEnabled: next })
      }
    },
  ]
})
// R158：命令面板 AI 分组——注册表 panel 声明的两个视图（proactive=AI 动作 / passive=AI 建议）。
// hidden（global-search=面板本体、mirror-search=弹窗内入口）不进列表；条目顺序即注册表声明序。
const aiPanelRows = computed(() => ({
  proactive: AI_ENTRIES.filter(e => e.family === 'proactive' && e.panel && e.panel.mode !== 'hidden') as AiPanelEntry[],
  passive: AI_ENTRIES.filter(e => e.family === 'passive' && e.panel && e.panel.mode !== 'hidden') as AiPanelEntry[],
}))
const aiProLen = computed(() => aiPanelRows.value.proactive.length)
// W3（需求 #6，用户已确认两案）：⌘K 浏览态顶部加「常用内容 / AI 动作」双 Tab 切换控件。
// - 常用内容 Tab = 近期最常用置顶（用户拍板②）+ 快捷操作 + 快速开关；AI 动作 Tab = AI 动作 + AI 建议（用户拍板①「独立 Tab」）。
// - flatList 按当前 tab 过滤构建 ⇒ 模板渲染序天然等于扁平序（R60-1 纪律零破坏），selIndex 只在当前 tab 可见集合内连续。
const browseTab = ref<BrowseTab>('common')
/** 切 Tab = 重开视图：选中回第一条、清掉旧 tab 的卡片选中（否则 selIndex 指向另一个 tab 的集合并错位） */
function setBrowseTab(t: BrowseTab) { if (browseTab.value === t) return; browseTab.value = t; selIndex.value = 0; selectedId.value = '' }
/** R158：AI 分组行执行——nav=跳台面（hint 告诉用户到哪用）；popup=打开全局弹窗（AI 建议面板） */
function runAiEntry(e: AiPanelEntry) {
  closeAll()
  const p = e.panel
  if (p.mode === 'nav' && p.route) { router.push(p.route); showToast(p.hint ? `→ ${p.hint}` : `→ ${e.title}`) }
  else if (p.mode === 'popup' && p.popup) { openPanel(p.popup as PanelType) }
}
// R47-B4：浏览模式热度列表——全类型（资源/任务/好奇/策展台）按调用次数降序，次数并列按最近打开时间
const recentResources = computed<SearchResult[]>(() => {
  const heat = allResults.value.filter(x => !x.archived && (x.raw as AnyCard | Workspace).callCount)
  heat.sort((a, b) => {
    const dc = ((b.raw as any).callCount || 0) - ((a.raw as any).callCount || 0)
    return dc !== 0 ? dc : ((b.raw as any).lastCalledAt || 0) - ((a.raw as any).lastCalledAt || 0)
  })
  return heat.slice(0, 8)
})
/** 浏览模式的扁平列表（按当前 tab 过滤构建）——顺序必须与模板渲染序逐项一致（R60-1 教训）
 *  W3：常用内容 Tab = 近期最常用(置顶) + 快捷操作 + 快速开关；AI 动作 Tab = AI 动作 + AI 建议。 */
const flatList = computed<FlatItem[]>(() => {
  if (!isBrowseMode.value) {
    // R60-1：搜索模式下的展开顺序必须与模板「按类型分组渲染」的顺序完全一致。
    // 原实现直接 map(filteredResults)，而模板按 res/task/curio/ws/proj 分组渲染，
    // 两者顺序不同 → selIndex 指向的条目与用户看到的条目不是同一条（键盘/Enter 错位）。
    const out: FlatItem[] = []
    // R152：AI 命中已并入主列表行（每张卡只有一行），扁平列表随之只按渲染顺序走——
    // 旧的"AI 组前置"是为了对齐当时那组重复行，现在留着反而会让同一个 id 出现两次。
    for (const g of groupedResults.value) for (const item of g.items) out.push({ kind: 'result' as const, item })
    return out
  }
  const out: FlatItem[] = []
  if (browseTab.value === 'ai') {
    aiPanelRows.value.proactive.forEach(e => out.push({ kind: 'ai', entry: e }))
    aiPanelRows.value.passive.forEach(e => out.push({ kind: 'ai', entry: e }))
  } else {
    // 常用内容 Tab：近期最常用置顶（用户拍板②）→ 快捷操作 → 快速开关
    recentResources.value.forEach(item => out.push({ kind: 'res', item }))
    QUICK_ACTIONS.forEach(qa => out.push({ kind: 'qa', qa }))
    PALETTE_TOGGLES.value.forEach(tg => out.push({ kind: 'tgl', tg }))
  }
  return out
})
const groupedResults = computed(() => {
  const defs: { type: 'res'|'task'|'curio'|'ws'|'proj'; label: string }[] = [
    { type: 'res', label: '资源卡' }, { type: 'task', label: '任务卡' }, { type: 'curio', label: '好奇心' },
    { type: 'ws', label: '策展台' }, { type: 'proj', label: '项目' }
  ]
  // REQ-046 速度优化：每组最多渲染 30 条，防超大结果集首屏卡顿
  const MAX_PER_GROUP = 30
  let offset = 0
  const out: { label: string; items: SearchResult[]; offset: number; total: number }[] = []
  for (const d0 of defs) {
    const all = filteredResults.value.filter(r => r.type === d0.type)
    // R152：AI 命中并入本组、顶到最前（每卡只有一行）。但**字面零命中的卡根本不在 filteredResults 里**——
    // 只排序不补入就会把 AI 唯一捞回来的那几张丢掉，等于把"换个说法也召得回"这个功能本身删了。
    const hits = aiSearch.value?.hits || []
    // R4-Pa：没跑 AI 时（绝大多数键入）这五组扫描全是空转——改前每组都要 new Set(全组 id) +
    //   全表再 filter 一遍（5 组 × 2,548 行 ≈ 1.3 万次比较）。有 AI 命中才付这笔。
    const rank = hits.length ? new Map(hits.map((h, i) => [h.id, i])) : null
    const seenIds = rank ? new Set(all.map(r => r.id)) : null
    const extra = rank && seenIds
      ? (allResults.value || []).filter(r => r.type === d0.type && rank.has(r.id) && !seenIds.has(r.id))
      : []
    const pool = extra.length ? [...all, ...extra] : all
    // R161-①：**星标/置顶在同组内永远是第一顺位**，AI 命中次序只在标记之后才决定。
    //   改前只按 AI 次序排，"星标卡会被 AI 结果挤到组尾"，与"置顶>星标>普通"的既有口径打架（真机反馈）。
    //   同标记且同非命中时比较器返回 0，稳定排序保持 filteredResults 的既有次序（命中强度>热度>最近）。
    const ordered = rank
      ? [...pool].sort((a, b) => {
        const mr = markRank(b.raw as AnyCard) - markRank(a.raw as AnyCard)
        if (mr) return mr
        return (rank.has(a.id) ? rank.get(a.id)! : 1e9) - (rank.has(b.id) ? rank.get(b.id)! : 1e9)
      })
      : pool
    if (ordered.length) { out.push({ label: d0.label, items: ordered.slice(0, MAX_PER_GROUP), offset, total: ordered.length }); offset += ordered.length }
  }
  return out
})
  const { escapeHtmlTitle, hlTitle, runFlat, runFlatLocator, openLinkOrLocate, locateOnly, runSearch, setType, clearFilter, onSearchKeydown, scrollToSelected, pickRow, selectHover, lastOpenId, lastOpenTs, openItem, openResLink, editItem, isStarred, toggleStar, deleteItem, toggleConvertMenu, convertCurio } = useGlobalPopupsRows({ searchQuery, flatList, runAiEntry, recordSearch, d, store, closeAll, router, currentType, selIndex, syncIdFromIndex, searchQueryRaw, setSearchQuery, typeLabel, resultsEl, selectedId, syncIndexFromId, convertMenuId, convertToResource, convertToTask })
  const { capForm, capSaved, savedResourceId, savedWsId, savedTimer, capLinkPlaceholder, resetCaptureForm, saveCapture, AiDrawerGP, aiEnrichJob, aiAdviceJob, gpAiJob, gpAiJobClose, capEnrichOn, capEnrichReady, lastEnrichCard, runCardEnrich, aiReopenEnrich, capEnrichSave, aiAdviceBusy, aiAdviceDormantDays, aiAdviceRun, linkShort, linkIconName, allProjects, isProjectDone } = useGlobalPopupsCapture({ d, closeAll, store, onSavedKeydown })

  return {
    router, store, convertToResource, convertToTask, d,
    activePanel, quickAddRef, panelPrefill, searchInput, capTitleInput,
    resultsEl, lastFocused, openPanel, closeAll, openSavedBoard,
    onSavedKeydown, prefillCapture, searchQueryRaw, searchQuery, qDebounce,
    setSearchQuery, SEARCH_HIST_MAX, searchHistory, topSearches, recordedQ,
    recordSearch, useHistory, searchActive, pinyinReady, currentType,
    selIndex, selectedId, syncIdFromIndex, syncIndexFromId, convertMenuId,
    typeLabel, filterLabel, counts, EMPTY_RESULTS, withMatchFields,
    resultTable, allResults, showDoneProjects, wsTree, wsNameOf,
    locateCat, normKey, blobOf, partsKey, partsNp,
    partsPy, normedParts, hitResult, filteredResults, hitRank,
    archivedMatchCount, isBrowseMode, aiSearch, aiBusy, aiSecs,
    aiChars, aiTook, aiScanned, aiTotal, aiFound,
    aiDur, aiAbortCtl, aiTick, aiCancelMsg, aiCache,
    aiStopTick, aiAbort, cardFieldText, aiCands, aiProgress,
    aiMoreBatches, aiSearchRun, aiHitById, aiTopRows, QUICK_ACTIONS,
    PALETTE_TOGGLES, aiPanelRows, aiProLen, browseTab, setBrowseTab,
    runAiEntry, recentResources, flatList, groupedResults, escapeHtmlTitle,
    hlTitle, runFlat, runFlatLocator, openLinkOrLocate, locateOnly,
    runSearch, setType, clearFilter, onSearchKeydown, scrollToSelected,
    pickRow, selectHover, lastOpenId, lastOpenTs, openItem,
    openResLink, editItem, isStarred, toggleStar, deleteItem,
    toggleConvertMenu, convertCurio, capForm, capSaved, savedResourceId,
    savedWsId, savedTimer, capLinkPlaceholder, resetCaptureForm, saveCapture,
    AiDrawerGP, aiEnrichJob, aiAdviceJob, gpAiJob, gpAiJobClose,
    capEnrichOn, capEnrichReady, lastEnrichCard, runCardEnrich, aiReopenEnrich,
    capEnrichSave, aiAdviceBusy, aiAdviceDormantDays, aiAdviceRun, linkShort,
    linkIconName, allProjects, isProjectDone,
  }
}
