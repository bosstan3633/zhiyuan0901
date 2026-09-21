<script setup lang="ts">
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'ProjectCurationView' })

import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { saveUIPrefs } from '@/shared/storage/repository'
import { uid } from '@/shared/utils'
import { softDeleteTaskToTrash, unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { useConfirm } from '@/shared/components/confirm'
import type { Project, Direction, TaskCard, Metric } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
// R121：左栏退役（原型：消除冗余侧栏）——原左栏宽/高偏好读写一并移除
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import ZhiMark from '@/shared/components/ZhiMark.vue'
// R147-d：任务级「知」菜单抽成共享组件（与任务面板/看板同一套动作）
import TaskAiMenu from '@/newtab/components/TaskAiMenu.vue'
import { removeMetricWithConfirm } from '@/shared/utils/compassCrud'
import MountCountBadge from '../components/MountCountBadge.vue'
import { taskMaturity, metricMaturity } from '@/shared/utils/maturity'

/**
 * R117（04-61 C）双态：
 * - `embedded` = 内嵌于方向台一级（/compass）：不渲染自身页头与「返回方向台」，页边距交给宿主，
 *   `?p` 缺省/失效时**默认落在第一个项目**（不经项目选择墙）；
 * - 默认 false = 聚焦态深链（/compass/projects，搜索/内容浮层直达）：页头 + 返回按钮照旧。
 */
const props = defineProps<{ embedded?: boolean }>()
const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress, toggleFocusProject, addProjectToDir } = useCompass()

/** R49-D6：任务详情 = 共享 TaskDetailDrawer（R48 重设计组件） */
const detailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function openTaskDetail(t: TaskCard) { detailRef.value?.open(t) }

/* ================= 数据 ================= */
const projects = computed(() => {
  const list = allProjects()
  list.forEach((p, i) => { if (p.order == null) p.order = i })
  return list
})

/* ================= R117（04-61 C）承接「项目总览」退役的能力 =================
 * 原「模块三 · 项目总览」整块退役（拍板：整体项目情况由主航线体现），但它承担的三件**管理能力**
 * 不能随之静默丢失，按零行为变更边界 1:1 迁到项目详情左栏「全部项目」列：
 *   ① 置顶分组（📌 已置顶 / 📦 全部项目两组呈现）——`Project.pinned`（与 🚀 主攻 isFocused 独立）；
 *   ② 组内拖拽排序——`order` 全量规整回写（与策展台 Tab 同模式）；
 *   ③ 跨区拖拽自动切换 pinned（R99 D-E，替代更早的「跨区拦截 toast」）。
 * 口径逐行沿用原 CompassShell 实现，仅宿主组件变更。 */
/** 原位改名（contenteditable blur 保存）进行中禁用该项拖拽，防「拖拽与编辑抢焦点」 */
const editingProjId = ref<string | null>(null)
function goalOf(p: Project): Direction | null {
  for (const dir of d.value.compass.directions) {
    if (dir.projects.some(x => x.id === p.id)) return dir
  }
  return null
}
/** 14 天无任务更新视为停滞 */
function isStalled(p: Project): boolean {
  const tasks = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id)
  const recent = tasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  return recent ? Date.now() - (recent.updatedAt || 0) > 14 * 86400_000 : tasks.length > 0
}

/* ================= R131-N2：项目详情页左侧「项目目录」（独立态呈现；宽度拖拽记忆 UIPrefs.projRailW） =================
 * 目录 = 战略目标分组 → 项目条目，单击切换项目（走 openProject，深链 ?p 口径不变）；
 * 拖拽右缘分隔条调宽（180–420px），双击复位——沿用资源台分类树（useCatSidebar）同款交互。 */
const DIR_W_MIN = 180
const DIR_W_MAX = 420
const DIR_W_DEF = 220
const projDirW = ref<number>(Math.min(DIR_W_MAX, Math.max(DIR_W_MIN, (store.ui?.projRailW as number | undefined) || DIR_W_DEF)))
const projDirGroups = computed(() => d.value.compass.directions
  .map(dir => ({ dir, projects: [...dir.projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }))
  .filter(g => g.projects.length))
function dirTermLabel(dir: Direction): string {
  return dir.term === 'long' ? '远期' : dir.term === 'short' ? '近期' : dir.term === 'mid' ? '中期' : ''
}
let dirDrag: { startX: number; startW: number } | null = null
function onDirResizeMove(e: MouseEvent) {
  if (!dirDrag) return
  projDirW.value = Math.min(DIR_W_MAX, Math.max(DIR_W_MIN, dirDrag.startW + (e.clientX - dirDrag.startX)))
}
function onDirResizeUp() {
  document.removeEventListener('mousemove', onDirResizeMove)
  document.removeEventListener('mouseup', onDirResizeUp)
  if (dirDrag) { saveUIPrefs({ projRailW: projDirW.value }); dirDrag = null }
}
function startDirResize(e: MouseEvent) {
  dirDrag = { startX: e.clientX, startW: projDirW.value }
  document.addEventListener('mousemove', onDirResizeMove)
  document.addEventListener('mouseup', onDirResizeUp)
}
function resetDirWidth() {
  projDirW.value = DIR_W_DEF
  saveUIPrefs({ projRailW: DIR_W_DEF })
}
// R129-B6 同款兜底：拖拽中途组件卸载时摘除 document 监听
onUnmounted(() => {
  document.removeEventListener('mousemove', onDirResizeMove)
  document.removeEventListener('mouseup', onDirResizeUp)
  dirDrag = null
})

/** 指标下的任务（真实任务卡） */
function tasksForMetric(metricId: string): TaskCard[] {
  // REQ-034：按 id 去重双保险
  const seen = new Set<string>()
  const order = new Map(d.value.tasks.map((t, i) => [t.id, i]))
  return d.value.tasks
    .filter(t => !t.deletedAt && t.metricId === metricId)
    .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
    .sort((a, b) => (order.get(a.id)||0) - (order.get(b.id)||0))
}
function metricPct(metricId: string): number {
  const ts = tasksForMetric(metricId)
  return ts.length ? Math.round(ts.filter(t => t.status === 'done').length / ts.length * 100) : 0
}

/** R146：删指标并到真源（确认报数 + 3 秒撤销），与项目抽屉/调度台/方向树同一口径 */
function removeMetric(m: Metric) {
  if (!currentProject.value) return
  void removeMetricWithConfirm(d.value, m.id, () => store.persist())
}
/** B27：孤儿任务——所属指标已删除的任务 */
const orphanTasks = computed(() => {
  if (!currentProject.value) return []
  const mids = new Set(currentProject.value.metrics.map(m => m.id))
  return d.value.tasks.filter(t => !t.deletedAt && t.projectId === currentProject.value!.id && (!t.metricId || !mids.has(t.metricId)))
})
function renameMetric(m: Metric, e: FocusEvent) {
  const v = (e.target as HTMLElement).textContent?.trim()
  if (v && v !== m.title) { m.title = v; store.persist(); showToast('✓ 指标已更新，同步方向树') }
  else if (!v) { (e.target as HTMLElement).textContent = m.title }
}
const treeDrop = ref<{ id: string; mode: 't' | 'b' | 'in' } | null>(null)
let treeDragMetric: Metric | null = null
let treeDragTask: TaskCard | null = null
const taskFlashId = ref('')
const metricFlashId = ref('')
function treeMetricDragStart(e: DragEvent, m: Metric) {
  treeDragMetric = m
  treeDragTask = null
  e.dataTransfer?.setData('text/plain', 'metric:' + m.id)
}
function treeMetricDragOver(e: DragEvent, m: Metric) {
  // R59-T5：任务拖拽悬停 = drop-into 高亮（整节点为落点，空指标同样可见）
  if (treeDragTask) { treeDrop.value = { id: m.id, mode: 'in' }; return }
  if (!treeDragMetric || treeDragMetric.id === m.id) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  treeDrop.value = { id: m.id, mode: (e.clientY - rect.top) / rect.height > 0.5 ? 'b' : 't' }
}
function treeMetricDrop(e: DragEvent, target: Metric) {
  // R59-T5：任务拖到指标节点（含空指标）= 变更归属（此前任务拖拽在节点上被静默忽略，
  // 只有拖到已有任务行上才生效——空指标因此无法接收）
  if (treeDragTask) { treeTaskDropOnMetric(e, target); return }
  const mode = treeDrop.value?.mode
  const drag = treeDragMetric
  treeDragMetric = null
  treeDrop.value = null
  if (!drag || drag.id === target.id || !currentProject.value) return
  const arr = currentProject.value.metrics
  const fi = arr.findIndex(x => x.id === drag.id)
  const ti = arr.findIndex(x => x.id === target.id)
  if (fi < 0 || ti < 0) return
  const [moved] = arr.splice(fi, 1)
  const tj = arr.findIndex(x => x.id === target.id)
  arr.splice(mode === 'b' ? tj + 1 : tj, 0, moved)
  store.persist()
  showToast(`✓ 指标「${drag.title}」已排序（同步调度台项目调度）`)
}
function treeTaskDragStart(e: DragEvent, t: TaskCard) {
  treeDragTask = t
  treeDragMetric = null
  e.dataTransfer?.setData('text/plain', 'task:' + t.id)
}
function treeTaskDropOnMetric(e: DragEvent, m: Metric | null) {
  const t = treeDragTask
  treeDragTask = null
  if (!t || !currentProject.value) return
  const oldMetric = t.metricId
  if (m) {
    if (t.metricId === m.id) return
    t.metricId = m.id
    t.projectId = currentProject.value.id
  } else {
    // 拖到「未归类」= 摘除指标（保留项目）
    if (!t.metricId) return
    t.metricId = undefined
  }
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const mt of proj.metrics) {
        if (oldMetric && mt.id === oldMetric) mt.taskIds = mt.taskIds.filter(x => x !== t.id)
        if (m && mt.id === m.id && !mt.taskIds.includes(t.id)) mt.taskIds.push(t.id)
      }
    }
  }
  t.updatedAt = Date.now()
  store.persist()
  showToast(m ? `✓ 任务已归属「${m.title}」` : '✓ 任务已转为未归类')
}
function scrollToMetric(id: string) {
  const el = document.getElementById('metric-sec-' + id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  metricFlashId.value = id
  setTimeout(() => { metricFlashId.value = '' }, 1500)
}
function scrollToTask(id: string) {
  const el = document.querySelector(`.btask[data-task-id="${id}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  taskFlashId.value = id
  setTimeout(() => { taskFlashId.value = '' }, 1500)
}
/**
 * R85（T0-A）：本地那份「上限 2」校验**删除**，改调 store——方向树与主航线共用同一口径。
 * 改前只有这一处拦着，store（方向树在用）直通 ⇒ 方向树能设出任意多个主攻，
 * 违反 models/index.ts:65「最多2个」与手册 manual-data.ts:229。
 * 成功后仍用原文案——「同步今日行动」这个信息不能丢。
 */
function toggleFocus(p: Project) {
  const res = toggleFocusProject(p.id)
  if (!res.ok) { showToast(res.msg); return }
  showToast(p.isFocused ? '🚀 已设为主攻，同步今日行动' : '已取消主攻')
}
/** R52-F6：头部级「＋添加成功指标」——与「＋添加任务」并置，输入名后创建（同步方向树） */
const headerMetricAdding = ref(false)
const headerMetricTitle = ref('')
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
function startHeaderAddMetric() { headerMetricAdding.value = true; headerMetricTitle.value = '' }
// R135：项目详情页页头「知 建议指标」——与方向树同一链式生成地基，锚点=当前项目
const AiDrawer = defineAsyncComponent(() => import('@/newtab/components/AiSuggestionDrawer.vue'))
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const aiPersonaId = ref('default')
async function aiChainMetrics() {
  const p = currentProject.value
  if (!p) return
  const [{ loadAiConfig, aiReady, aiConfig }, { buildChainJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/chain')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (!store.data) return
  if (aiPersonaId.value === 'default' && aiConfig.value.defaultPersona) aiPersonaId.value = aiConfig.value.defaultPersona
  const job = buildChainJob('metrics', p.id, { d: store.data, depth: aiConfig.value.depth, persist: () => store.persist(), personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; void aiChainMetrics() } })
  if (!job) { showToast('⚠ 项目已不存在'); return }
  aiJob.value = job
}
/** R146（用户反馈）：AI 入口下沉到行——每个指标一颗「按此指标拆任务」、每个任务一颗「本任务 AI 辅助」。
 *  常态可见（不再 hover 才出现），且跑动时徽标自转补上 pending 反馈。 */
async function aiChainAt(level: 'tasks', anchorId: string) {
  if (!store.data) return
  const [{ loadAiConfig, aiReady, aiConfig }, { buildChainJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/chain')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (aiPersonaId.value === 'default' && aiConfig.value.defaultPersona) aiPersonaId.value = aiConfig.value.defaultPersona
  const job = buildChainJob(level, anchorId, { d: store.data, depth: aiConfig.value.depth, persist: () => store.persist(), personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; void aiChainAt(level, anchorId) } })
  if (!job) { showToast('⚠ 锚点已不存在（可能刚被删除）'); return }
  aiJob.value = job
}
function confirmHeaderAddMetric() {
  const p = currentProject.value
  const title = headerMetricTitle.value.trim()
  if (!p) { headerMetricAdding.value = false; return }
  if (!title) { headerMetricAdding.value = false; return }
  p.metrics.push({ id: uid('met'), title, taskIds: [] })
  store.persist()
  showToast('✓ 成功指标已创建，同步方向树')
  headerMetricAdding.value = false
}
/* R60：原「投射至灯塔」开关已取消，重心语义统一由「🚀 主攻 isFocused」承担 */

/* ================= 第十七轮：创建项目弹窗（愿景→使命→战略目标 → 选目标创建） ================= */
const createOpen = ref(false)
const createDirId = ref('')
const createName = ref('')
const hasDirs = computed(() => d.value.compass.directions.length > 0)
function openCreateProject() {
  if (!hasDirs.value) { showToast('还没有战略目标——请先到方向树创建'); router.push('/compass/tree'); return }
  createDirId.value = d.value.compass.directions[0]!.id
  createName.value = ''
  createOpen.value = true
}
function confirmCreateProject() {
  const name = createName.value.trim()
  if (!name) { showToast('请输入项目名称'); return }
  // R85（T0-B）：改调共享 addProjectToDir——改前这里缺 `pinned`（另外三处出口字段各不一致）
  const proj = addProjectToDir(createDirId.value, name)
  if (!proj) { showToast('请选择所属战略目标'); return }
  createOpen.value = false
  showToast(`✓ 项目「${name}」已创建`)
  openProject(proj) // 直接进入全屏展板
}

/* ================= 单项目展板 ================= */
/** R121：展板 ⋯ 菜单（主攻 / 方向树定位 / 删除项目） */
const projMenuOpen = ref(false)
/** R121：面包屑里的战略目标期限标签 */
const goalTerm = computed(() => {
  const t = goalOf(currentProject.value!)?.term
  return t === 'long' ? '远期' : t === 'short' ? '近期' : t === 'mid' ? '中期' : ''
})
const currentProject = ref<Project | null>(null)
let currentDir: Direction | null = null
function openProject(p: Project) {
  currentProject.value = p
  currentDir = goalOf(p)
  // R132-T5：全景选台后自动收起并回到目录顶部锚点
  projPanOpen.value = false
  tocActive.value = 'pd-sec-overview'
  // R49：保留 ?p 参数（刷新后仍定位到该项目详情）
  if (route.query.p !== p.id) router.replace({ path: route.path, query: { p: p.id } })
}
/* ================= R132-T4/T5：左栏两段式——「项目全景」可折叠块（切换项目）+ 本项目详情目录（锚点导航） =================
 * 用户反馈：左栏主体应是当前项目的详情目录，而非整体项目目录；全景地图折叠在顶部、点开即切项目。 */
const projPanOpen = ref(false)
const tocActive = ref('pd-sec-overview')
interface TocItem { id: string; icon: string; label: string; pct: number | null }
const projToc = computed<TocItem[]>(() => {
  const p = currentProject.value
  if (!p) return []
  const items: TocItem[] = [{ id: 'pd-sec-overview', icon: '📦', label: '项目概览', pct: projectProgress(p).pct }]
  p.metrics.forEach((m, mi) => items.push({ id: 'metric-sec-' + m.id, icon: '🎯', label: `指标 ${mi + 1} · ${m.title}`, pct: metricPct(m.id) }))
  if (orphanTasks.value.length) items.push({ id: 'pd-sec-orphan', icon: '⚠', label: '未归类任务', pct: null })
  items.push({ id: 'pd-sec-assets', icon: '📎', label: '任务附件', pct: null })
  return items
})
function scrollToSec(id: string) {
  tocActive.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function onTocScroll() {
  if (props.embedded || !currentProject.value) return
  let cur = projToc.value[0]?.id || 'pd-sec-overview'
  for (const it of projToc.value) {
    const el = document.getElementById(it.id)
    if (el && el.getBoundingClientRect().top <= 140) cur = it.id
  }
  tocActive.value = cur
}
onMounted(() => window.addEventListener('scroll', onTocScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onTocScroll))
// R52-F5：「返回项目列表」按钮移除——右上角「← 返回方向台」为唯一返回路径；项目切换走左侧目录
// R59-T1：返回按钮恒为「返回方向台」（完整方向树已有独立入口，见操作区「🌲 完整方向树」）
const fromTree = computed(() => false)
function goBack() {
  if (fromTree.value) router.push('/compass/tree')
  else router.push('/compass')
}
/** R54-A3：跳完整方向树并定位到本项目战略目标（?hl=<dirId> 滚动+闪烁） */
function goTreeLocated() {
  const p = currentProject.value
  if (!p) { router.push('/compass/tree'); return }
  const dir = goalOf(p)
  router.push({ path: '/compass/tree', query: { from: 'proj', p: p.id, ...(dir ? { hl: dir.id } : {}) } })
}
/** R54-A4：Esc = 返回上级（抽屉/弹层打开时让位其自关） */
function onPageEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  // R117（04-61 C）：一级内嵌态没有「上级」可回——Esc 让位抽屉/弹层后不再跳转
  if (props.embedded) return
  if (document.querySelector('.task-sidebar, .overlay, .modal-mask')) return
  e.preventDefault()
  goBack()
}
// R129-B6：原为匿名函数且从不移除——视图实例销毁后闭包仍挂在 document 上，每次点击都往已卸载
// 组件的 ref 里写值。改为具名 + onUnmounted 一并摘除。
function onDocCloseProjMenu() { projMenuOpen.value = false }
onMounted(() => document.addEventListener('keydown', onPageEsc, true))
onMounted(() => document.addEventListener('click', onDocCloseProjMenu))
onUnmounted(() => {
  document.removeEventListener('keydown', onPageEsc, true)
  document.removeEventListener('click', onDocCloseProjMenu)
})
watch(() => route.query.p, (pid) => {
  if (!pid || typeof pid !== 'string') { if (!route.query.p) currentProject.value = null; return }
  const p = projects.value.find(x => x.id === pid)
  if (p) { currentProject.value = p; currentDir = goalOf(p) }
}, { immediate: true })
// R117（04-61 C）：无有效 `?p` 时一律默认落在第一个项目（拍板「项目详情直接提出为一级」）——
// 内嵌态与聚焦态同口径：项目详情永远有项目，不再经「项目选择墙」（与左栏目录重复，已退役）。
// ⚠ 只落内存、不写 URL：避免在 setup 期发起导航（组件由路由渲染时 replace 有竞态）；
//   用户主动切换项目时仍由 openProject 写 `?p`，深链 / 前进后退口径不变。
const pid0 = typeof route.query.p === 'string' ? route.query.p : ''
if (!(pid0 && projects.value.some(x => x.id === pid0)) && projects.value.length) {
  currentProject.value = projects.value[0]!
  currentDir = goalOf(currentProject.value)
}

function renameProject(e: FocusEvent) {
  editingProjId.value = null
  const v = (e.target as HTMLElement).textContent?.trim()
  if (v && currentProject.value) { currentProject.value.name = v; store.persist() }
  else if (currentProject.value) { (e.target as HTMLElement).textContent = currentProject.value.name }
}
function onNameEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }

/**
 * R117（04-61 C）：项目级删除入口随「项目总览」退役一并迁到项目详情——口径 1:1 沿用原 CompassShell.removeProject：
 * **摘除式**：其下任务转「未归档任务」（不删除、可重新关联），指标随项目移除，不进回收站（D1 拍板口径）。
 */
async function removeProject(p: Project) {
  const taskCount = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id).length
  const ok = await useConfirm({
    title: '删除项目',
    message: taskCount ? `确定删除「${p.name}」？\n其下 ${taskCount} 个任务将转为「未归档任务」（不删除，可重新关联），${p.metrics.length} 个成功指标随项目移除。` : `确定删除「${p.name}」？`,
    confirmText: '确认删除',
    danger: true
  })
  if (!ok) return
  const metricIds = new Set(p.metrics.map(m => m.id))
  for (const t of d.value.tasks) {
    if (t.projectId === p.id) { t.projectId = undefined; t.metricId = undefined; t.updatedAt = Date.now() }
    else if (t.metricId && metricIds.has(t.metricId)) { t.metricId = undefined; t.updatedAt = Date.now() }
  }
  for (const dir of d.value.compass.directions) {
    const idx = dir.projects.findIndex(x => x.id === p.id)
    if (idx >= 0) { dir.projects.splice(idx, 1); break }
  }
  store.persist()
  showToast(`已删除「${p.name}」` + (taskCount ? `，${taskCount} 个任务转为未归档` : ''))
  // 删的若正是当前项目 → 顺落到下一个；没有别的项目则清空（内嵌态回选择墙 / 聚焦态回项目列表）
  const next = projects.value.find(x => x.id !== p.id)
  if (next) openProject(next)
  else { currentProject.value = null; currentDir = null; router.replace({ path: route.path, query: {} }) }
}

/* ---- 指标/任务操作 ---- */
/** 第卅三轮 REQ-016：添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAddMetric = ref<Metric | null>(null)
function openTaskAdd(m: Metric) { taskAddMetric.value = m }
/** R51-B6：创建成功后直接打开 R48 详情抽屉（与调度台新建任务口径一致） */
function onTaskCreated(t: TaskCard) { openTaskDetail(t) }
function removeTask(task: TaskCard) {
  softDeleteTaskToTrash(d.value, task)
  store.persist()
  showToast('已删除任务（回收站可恢复）')
}
/** R141（反馈 #1）：指标下任务行只做解绑——✕ 回任务调度模块，删除本体收进任务详情 */
function unbindTask(task: TaskCard) {
  unbindTaskFromMetric(d.value, task)
  store.persist()
  showToast(`✓ 已从本指标移除：「${task.title.slice(0, 16)}」回到任务调度模块`)
}
function toggleTaskDone(task: TaskCard) {
  task.status = task.status === 'done' ? 'todo' : 'done'
  task.completedAt = task.status === 'done' ? Date.now() : undefined
  task.updatedAt = Date.now()
  store.persist()
}

/* ---- 任务拖拽：同指标排序 / 跨指标归属 ---- */
let dragTask: TaskCard | null = null
let dragFromMetric: string | null = null
function onTaskDragStart(e: DragEvent, task: TaskCard, metricId: string) {
  dragTask = task
  dragFromMetric = metricId
  ;(e.currentTarget as HTMLElement).classList.add('dragging')
  e.dataTransfer!.effectAllowed = 'move'
}
function onTaskDragEnd(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('dragging')
}
function onTaskDrop(e: DragEvent, target: TaskCard) {
  e.preventDefault(); e.stopPropagation()
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  if (!dragTask || dragTask.id === target.id) return
  // 第廿八轮：落点 before/after 按指针位置判定；目标下标在移除后重算（修 off-by-one）；补落库
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const after = (e.clientY - rect.top) / rect.height > 0.5
  const fromIdx = d.value.tasks.findIndex(x => x.id === dragTask!.id)
  if (fromIdx < 0) { dragTask = null; return }
  const [item] = d.value.tasks.splice(fromIdx, 1)
  const toIdx = d.value.tasks.findIndex(x => x.id === target.id)
  if (toIdx < 0) { d.value.tasks.splice(fromIdx, 0, item); dragTask = null; return }
  d.value.tasks.splice(after ? toIdx + 1 : toIdx, 0, item)
  item.updatedAt = Date.now()
  store.persist()
  dragTask = null
  showToast('✓ 已调整任务排序')
}
function onMetricDrop(e: DragEvent, metricId: string) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  if (!dragTask || dragFromMetric === metricId) { dragTask = null; return }
  const oldMetric = dragTask.metricId
  dragTask.metricId = metricId
  dragTask.updatedAt = Date.now()
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const m of proj.metrics) {
        if (oldMetric && m.id === oldMetric) m.taskIds = m.taskIds.filter(id => id !== dragTask!.id)
        if (m.id === metricId && !m.taskIds.includes(dragTask.id)) m.taskIds.push(dragTask.id)
      }
    }
  }
  const targetName = currentProject.value?.metrics.find(m => m.id === metricId)?.title || ''
  store.persist()
  dragTask = null
  showToast(`✓ 任务已归属「${targetName}」`)
}
function onMetricDragOver(e: DragEvent, _metricId: string) {
  (e.currentTarget as HTMLElement).classList.add('drag-over')
}
function onMetricDragLeave(e: DragEvent) {
  (e.currentTarget as HTMLElement).classList.remove('drag-over')
}

function prLabel(pr: string) {
  return pr === 'high' ? '高优' : pr === 'mid' || pr === 'medium' ? '中优' : '低优'
}
function prTag(pr: string) {
  return pr === 'high' ? 'danger' : 'plain'
}

/* ================= R49-D4：任务附件区（按任务聚合，AssetBadge 复用现有打开逻辑） ================= */
const tasksWithAssets = computed(() => {
  const p = currentProject.value
  if (!p) return []
  return d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id && t.assets && t.assets.length)
})
const assetSizeLabel = (n?: number) => !n ? '' : n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'
function taskAssetCount(t: TaskCard): number {
  return (t.assets || []).length
}
function taskAssetSize(t: TaskCard): string {
  const total = (t.assets || []).reduce((s, a) => s + (a.size || 0), 0)
  return assetSizeLabel(total)
}

/** D1：头部级「＋添加任务」——有指标选第一个，无指标先建一个 */
function addTaskFromHeader() {
  const p = currentProject.value
  if (!p) return
  if (!p.metrics.length) {
    p.metrics.push({ id: uid('met'), title: '新成功指标', taskIds: [] })
    store.persist()
    showToast('✓ 已创建首个成功指标，继续添加任务')
  }
  taskAddMetric.value = p.metrics[0]!
}
</script>

<template>
  <div class="page" :class="{ 'is-embedded': embedded }">
    <!-- 聚焦态深链（/compass/projects）页头；R117 起本视图主要是方向台一级的内嵌体，
         内嵌态由宿主页头（方向台 · 主航线与项目详情）代替，不再重复一层面包屑与返回按钮 -->
    <div v-if="!embedded" class="page-head">
      <div class="crumb"><span class="crumb-up" title="返回方向台" @click="router.push('/compass')">方向台</span><span class="crumb-sep"> / </span><b>项目详情</b><span v-if="currentProject"> · {{ currentProject.name }}</span></div>
      <div class="spacer" />
      <!-- R59-T1：返回按钮恒为方向台（旧来源感知分支已退役） -->
      <button class="mini-btn" @click="goBack">← 返回方向台</button>
      <div class="hint-chip">任务可拖拽排序 / 跨指标归属 · 点击任务开详情</div>
    </div>
    <!-- 内嵌态（方向台一级）：R121 起不再重复小节头（面包屑在展板内） -->
    <div v-else></div>

    <!-- ===== 零项目兜底（R117：原「项目选择墙」退役——无 ?p 时一律默认落在第一个项目，
         选择墙与左栏「📦 全部项目」功能重复；此处只保留真·零项目时的新建引导） ===== -->
    <div v-if="!currentProject" class="empty-state">
      还没有项目——<span class="empty-act" @click="openCreateProject">新建 / 规划项目</span>：选择战略目标后开始
    </div>

    <!-- ===== 单项目展板（R131-N2：独立态恢复左侧项目目录，可拖拽调宽；内嵌态维持单列满宽） ===== -->
    <div v-else class="board-layout" :class="{ 'with-dir': !embedded }">
    <aside v-if="!embedded" class="pd-dir" :style="{ width: projDirW + 'px' }">
      <div class="pd-dir-title pd-pan-head" @click="projPanOpen = !projPanOpen">🗺 项目全景<span class="pd-caret">{{ projPanOpen ? '▾' : '▸' }}</span></div>
      <div v-show="projPanOpen" class="pd-pan">
        <div v-for="g in projDirGroups" :key="g.dir.id" class="pd-group">
          <div class="pd-goal" :title="g.dir.name">🎯 {{ g.dir.name }}<span v-if="dirTermLabel(g.dir)" class="pd-term">{{ dirTermLabel(g.dir) }}</span></div>
          <div v-for="p in g.projects" :key="p.id" class="pd-item" :class="{ active: p.id === currentProject?.id }" :title="p.name" @click="openProject(p)">
            <span class="pd-dot" :class="{ focus: p.isFocused }" />
            <span class="pd-name">{{ p.name }}</span>
            <span class="pd-pct">{{ projectProgress(p).pct }}%</span>
          </div>
        </div>
        <div v-if="!projDirGroups.length" class="pd-empty">还没有项目</div>
      </div>
      <div class="pd-dir-title">📁 项目目录</div>
      <div v-for="it in projToc" :key="it.id" class="pd-item toc-item" :class="{ active: tocActive === it.id }" :title="it.label" @click="scrollToSec(it.id)">
        <span class="pd-name">{{ it.icon }} {{ it.label }}</span>
        <span v-if="it.pct !== null" class="pd-pct">{{ it.pct }}%</span>
      </div>
    </aside>
    <span v-if="!embedded" class="pd-split" title="拖拽调整目录宽度 · 双击复位" @mousedown.prevent="startDirResize" @dblclick="resetDirWidth" />
    <div class="board">
      <!-- R121：单行面包屑 + 操作区（原型：面包屑 + 添加按钮；⋯ 收敛 主攻 / 树定位 / 删除项目） -->
      <div class="pb-head-row" id="pd-sec-overview">
        <div class="pb-crumb">
          <span class="pc-seg" title="在完整方向树中查看" @click="goTreeLocated">愿景</span>
          <span class="pc-sep">›</span>
          <span class="pc-seg" title="在完整方向树中查看" @click="goTreeLocated">使命</span>
          <span class="pc-sep">›</span>
          <span class="pc-seg" title="在完整方向树中定位此战略目标" @click="goTreeLocated">{{ goalOf(currentProject)?.name || '—' }}<template v-if="goalTerm">（{{ goalTerm }}）</template></span>
          <span class="pc-sep">›</span>
          <b class="pc-current">{{ currentProject.name }}</b>
        </div>
        <div class="pb-acts">
          <button class="mini-btn" @click="startHeaderAddMetric">＋ 添加成功指标</button>
          <button class="mini-btn" @click="aiChainMetrics" title="AI 基于上游目标链建议可量化成功指标（查重后采纳才创建）"><ZhiMark :size="13" /> 建议指标</button>
          <button class="mini-btn primary" @click="addTaskFromHeader">＋ 添加任务</button>
          <span class="pb-more-wrap">
            <button class="mini-btn icon" title="更多：主攻 / 方向树定位 / 删除项目" @click.stop="projMenuOpen = !projMenuOpen">⋯</button>
            <div v-if="projMenuOpen" class="pb-menu" @click.stop>
              <div class="pm-item" @click="toggleFocus(currentProject); projMenuOpen = false">🚀 {{ currentProject.isFocused ? '取消主攻' : '设为主攻' }}</div>
              <div class="pm-item" @click="goTreeLocated(); projMenuOpen = false">🌳 在完整方向树中定位</div>
              <div class="pm-item danger" @click="removeProject(currentProject); projMenuOpen = false">🗑 删除项目</div>
            </div>
          </span>
        </div>
      </div>
      <!-- R52-F6：成功指标名输入行 -->
      <div v-if="headerMetricAdding" class="metric-add-row">
        <input v-model="headerMetricTitle" placeholder="成功指标名称，回车确认（同步完整方向树）" v-focus
          @keydown.enter.prevent="confirmHeaderAddMetric" @keydown.esc="headerMetricAdding=false" />
        <button class="mini-btn primary" @click="confirmHeaderAddMetric">确定</button>
        <button class="mini-btn" @click="headerMetricAdding=false">取消</button>
      </div>
      <!-- 标题行：项目名（可编辑）+ 主攻 badge + 大号进度 -->
      <div class="pb-title-row">
        <div class="pb-title">
          <span class="pb-picon" title="项目">📦</span>
          <span class="hero-pname" contenteditable="true" spellcheck="false" @focus="editingProjId = currentProject?.id ?? null" @blur="renameProject" @keydown.enter.prevent="($event.target as HTMLElement).blur()">{{ currentProject.name }}</span>
          <span v-if="currentProject.isFocused" class="tag accent">🚀 主攻</span>
        </div>
        <span class="pb-pct">{{ projectProgress(currentProject).pct }}%</span>
      </div>
      <!-- 统计条（原型：成功指标 / 任务总数 / 已完成 / 进行中）+ 尾部日期与健康（信息保留·低占位） -->
      <div class="pb-stats">
        <span class="pbs">成功指标：<b>{{ currentProject.metrics.length }}</b></span>
        <span class="pbs">任务总数：<b>{{ projectProgress(currentProject).total }}</b></span>
        <span class="pbs">已完成：<b>{{ projectProgress(currentProject).done }}</b></span>
        <span class="pbs">进行中：<b>{{ projectProgress(currentProject).total - projectProgress(currentProject).done }}</b></span>
        <span class="pb-tail">
          <template v-if="currentProject.startDate || currentProject.endDate">⏱ {{ currentProject.startDate || '—' }} → {{ currentProject.endDate || '—' }} · </template>
          <span :class="isStalled(currentProject) ? 'warn' : 'ok'">{{ isStalled(currentProject) ? '⚠ 存在停滞' : '● 推进中' }}</span>
        </span>
      </div>
      <div class="pb-hint">💡 任务可拖拽排序 / 跨指标拖拽归属 · 点击任务名打开详情抽屉 · 全部实时同步罗盘</div>

      <div v-for="(m, mi) in currentProject.metrics" :key="m.id" class="metric-sec" :id="'metric-sec-' + m.id" :class="{ 'sec-flash': metricFlashId === m.id }"
        @dragover.prevent="onMetricDragOver($event, m.id)" @dragleave="onMetricDragLeave" @drop="onMetricDrop($event, m.id)">
        <div class="metric-head2">
          <span class="mh-idx">🎯 指标 {{ mi+1 }}</span>
          <span class="mname" contenteditable="true" spellcheck="false"
            @blur="renameMetric(m, $event)" @keydown.enter.prevent="($event.target as HTMLElement).blur()">{{ m.title }}</span>
          <span class="mh-meta">{{ metricPct(m.id) }}% · {{ tasksForMetric(m.id).filter(t=>t.status==='done').length }}/{{ tasksForMetric(m.id).length }} 任务</span>
          <MaturityBadge :m="metricMaturity(d, m)" />
          <span class="mh-acts">
            <button class="icon-btn-sm ai" title="AI 按本指标缺口建议近两周任务（勾选采纳才创建，可换执笔专家）" @click="aiChainAt('tasks', m.id)"><ZhiMark :size="13" /></button>
            <button class="icon-btn-sm" title="添加任务（新建 / 关联）" @click="openTaskAdd(m)">＋</button>
            <button class="icon-btn-sm del" title="删除指标" @click="removeMetric(m)">🗑</button>
          </span>
        </div>
        <div class="task-rows">
          <div v-for="task in tasksForMetric(m.id)" :key="task.id" class="btask" :class="{done: task.status==='done', 'task-flash': taskFlashId === task.id}" draggable="true"
            :data-task-id="task.id"
            @dragstart="onTaskDragStart($event, task, m.id)" @dragend="onTaskDragEnd"
            @dragover.prevent.stop @drop.stop="onTaskDrop($event, task)">
            <span class="bdrag" title="拖拽排序 / 跨指标归属">⋮⋮</span>
            <span class="bcheck" :class="{done: task.status==='done'}" @click="toggleTaskDone(task)">{{ task.status==='done'?'✓':'' }}</span>
            <span class="bt" @click="openTaskDetail(task)" title="点击打开任务详情">{{ task.title }}</span>
            <span class="tag" :class="prTag(task.priority)"><i class="tag-dot" /><span class="tag-txt">{{ prLabel(task.priority) }}</span></span>
            <AssetBadge v-if="task.assets?.length" :assets="task.assets" />
            <MaturityBadge :m="taskMaturity(task)" />
            <MountCountBadge :t="task" />
            <TaskAiMenu :task="task" @detail="openTaskDetail" />
            <button class="icon-btn-sm" title="从本指标移除（解绑回任务调度模块；删除本体请进任务详情）" @click="unbindTask(task)">✕</button>
          </div>
          <div class="task-add" @click="openTaskAdd(m)">＋ 添加任务（新建 / 关联）</div>
        </div>
      </div>
      <div v-if="!currentProject.metrics.length" class="empty-state">该项目暂无成功指标——点击上方「🎯 添加成功指标」开始</div>
      <!-- B27：未归类任务（指标已删除的孤儿任务） -->
      <div v-if="orphanTasks.length" class="metric-sec" id="pd-sec-orphan">
        <div class="metric-head2">
          <span class="tag" style="flex-shrink:0">⚠ 未归类任务</span>
          <span class="mname">原指标已删除 · 可拖回任意指标或删除</span>
        </div>
        <div class="task-rows">
          <div v-for="t in orphanTasks" :key="t.id" class="btask" :class="{done: t.status==='done', 'task-flash': taskFlashId === t.id}" draggable="true"
            :data-task-id="t.id"
            @dragstart="onTaskDragStart($event, t, '__orphan__')" @dragend="onTaskDragEnd" @dragover.prevent @drop="onTaskDrop($event, t)">
            <span class="bdrag" title="拖拽到指标归属">⋮⋮</span>
            <span class="bcheck" :class="{done: t.status==='done'}" @click="toggleTaskDone(t)">{{ t.status==='done'?'✓':'' }}</span>
            <span class="bt" @click="openTaskDetail(t)" title="点击打开任务详情">{{ t.title }}</span>
            <span class="tag" :class="prTag(t.priority)"><i class="tag-dot" /><span class="tag-txt">{{ prLabel(t.priority) }}</span></span>
            <MaturityBadge :m="taskMaturity(t)" />
            <MountCountBadge :t="t" />
            <TaskAiMenu :task="t" @detail="openTaskDetail" />
            <button class="icon-btn-sm del" title="删除任务（进回收站）" @click="removeTask(t)">🗑</button>
          </div>
        </div>
      </div>
      <!-- R52-F6：添加成功指标入口上移至头部操作区（原底部通栏按钮移除） -->

      <!-- R49-D4：任务附件区（按任务聚合，复用 AssetBadge 打开逻辑；资源卡本体在资源台管理，此处不呈现） -->
      <div class="metric-sec asset-sec" id="pd-sec-assets">
        <div class="metric-head2">
          <span class="tag" style="flex-shrink:0">📎 任务附件</span>
          <span class="mname">按任务聚合 · 🖼 图片弹窗预览 / 🌐 HTML / 📕 PDF 新标签打开</span>
        </div>
        <div class="task-rows">
          <div v-for="t in tasksWithAssets" :key="t.id" class="btask asset-row" @click="openTaskDetail(t)">
            <span class="bt">{{ t.title }}</span>
            <span class="tag">{{ taskAssetCount(t) }} 个 · {{ taskAssetSize(t) }}</span>
            <AssetBadge :assets="t.assets || []" />
          </div>
          <div v-if="!tasksWithAssets.length" class="empty-asset">该项目下暂无任务附件——在任务详情中上传后在此聚合呈现</div>
        </div>
      </div>
      <!-- R49-D5：好奇心规则提示条（好奇心卡通过「转为任务/归档为资源」进入项目） -->
      <div class="board-foot-hint">💡 好奇心卡通过「转为任务 / 归档为资源」进入项目 · 本页与完整方向树实时双向同步 · 任务完成自动回流指标与战略目标进度</div>
    </div>
    </div>

    <!-- ===== 第十七轮：创建项目弹窗 ===== -->
    <Transition name="fade">
      <div v-if="createOpen" class="drawer-overlay" @click="createOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="createOpen" class="create-modal" @click.stop>
        <div class="cm-head">
          <span>📦 新建 / 规划项目</span>
          <div class="cm-close" @click="createOpen=false">×</div>
        </div>
        <div class="cm-body">
          <!-- 愿景 → 使命 → 战略目标 视觉链 -->
          <div class="cm-chain">
            <div class="cm-node"><span class="cm-ic">🔭</span><div class="cm-txt"><i>愿景</i>{{ visionText || '尚未设定' }}</div></div>
            <div class="cm-link" />
            <div class="cm-node"><span class="cm-ic">💡</span><div class="cm-txt"><i>使命</i>{{ missionText || '尚未设定' }}</div></div>
            <div class="cm-link" />
            <div class="cm-node"><span class="cm-ic">🎯</span><div class="cm-txt"><i>战略目标（选择归属）</i></div></div>
          </div>
          <select v-model="createDirId" class="cm-select">
            <option v-for="dir in d.compass.directions" :key="dir.id" :value="dir.id">
              🎯 {{ dir.name }}{{ dir.term==='long' ? '（远期）' : dir.term==='short' ? '（近期）' : '（中期）' }}
            </option>
          </select>
          <input v-model="createName" class="cm-input" placeholder="项目名称，如「产品视觉重构」…"
            @keydown.enter.prevent="confirmCreateProject" @keydown.esc="createOpen=false" autofocus>
        </div>
        <div class="cm-foot">
          <button class="mini-btn" @click="createOpen=false">取消</button>
          <button class="mini-btn primary" @click="confirmCreateProject">✓ 创建并进入展板</button>
        </div>
      </div>
    </Transition>

    <!-- R49-D6：任务详情 = 共享 TaskDetailDrawer（R48 重设计组件，宿主于此页） -->
    <TaskDetailDrawer ref="detailRef" />
    <!-- R135：页头「建议指标」评审抽屉 -->
    <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />


    <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
    <TaskAddDrawer :open="!!taskAddMetric" :metric-id="taskAddMetric?.id || ''" :project-id="currentProject?.id || ''"
      :metric-title="taskAddMetric?.title" @close="taskAddMetric = null" @created="onTaskCreated" />

    
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 36px 64px; }
/* R117（04-61 C）：内嵌于方向台一级时去掉自身页边距与宽度上限，避免与宿主 .page 双层缩进 */
.page.is-embedded { max-width: none; margin: 0; padding: 0; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-left: 22px; }
.page-head .crumb { font-size: 12.5px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 16px; letter-spacing: .2px; }
.page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
/* R54-A1：面包屑上级可点 */
.page-head .crumb .crumb-up { cursor: pointer; color: var(--text-3); }
.page-head .crumb .crumb-up:hover { color: var(--accent); }
.page-head .crumb .crumb-sep { color: var(--text-4); }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }
/* R117（04-61 C）：内嵌态轻量小节头——项目切换与目录都在左栏，此处只交代「这是什么」 */

/* R117（04-61 C）：原「项目总览」的选择墙 / 项目卡（.section-label·.wall-section·.wall-grid·.pcard·
   .ptop·.pname·.pin-btn·.chain·.mrows·.mrow·.pfoot）随模块退役整块删除——置顶/拖拽/新建能力已迁到
   左栏「全部项目」列（见下方 .pt-sec-label / .pt-pin / .pt-item.dragging|.drag-over）。 */

/* R49-D4：任务附件区 */
.asset-sec { margin-top: 12px; }
.asset-row { cursor: pointer; }
.empty-asset { text-align: center; padding: 16px; font-size: 11.5px; color: var(--text-4); }
.empty-state { text-align: center; padding: 48px 20px; color: var(--text-3); font-size: 13px; }
/* R117（04-61 C）：零项目兜底里的可点动作 */
.empty-act { color: var(--accent); cursor: pointer; text-decoration: underline; }

/* 展板 */
.board-layout { display: block; } /* 内嵌态维持单列满宽（R121 口径） */
/* R131-N2：独立态 = 左目录 + 分隔条 + 右展板三列；展板 flex:1 撑满（防 R130-T7 收缩类 BUG） */
.board-layout.with-dir { display: flex; align-items: flex-start; }
.board-layout.with-dir .board { flex: 1; min-width: 0; }
.pd-dir { flex-shrink: 0; position: sticky; top: 64px; max-height: calc(100vh - 96px); overflow-y: auto; padding: 2px 4px 8px 0; }
.pd-dir-title { font-size: 12px; font-weight: 600; color: var(--text-3); padding: 6px 8px; letter-spacing: .3px; }
.pd-group { margin-bottom: 10px; }
.pd-goal { display: flex; align-items: baseline; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-2); padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pd-term { font-size: 10px; color: var(--text-3); font-weight: 400; flex-shrink: 0; }
.pd-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 14px; border-radius: 6px; cursor: pointer; font-size: 12.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; transition: background var(--dur-fast); }
.pd-item:hover { background: var(--surface-2); }
.pd-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.pd-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border-strong); flex-shrink: 0; }
.pd-dot.focus { background: var(--accent); }
.pd-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pd-pct { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.pd-empty { font-size: 12px; color: var(--text-3); padding: 6px 8px; }
.pd-split { width: 4px; flex-shrink: 0; align-self: stretch; margin: 4px 0 4px 4px; cursor: col-resize; border-radius: 2px; transition: background var(--dur-fast); z-index: 5; }
.pd-split:hover { background: var(--accent-light); }
/* R132-T4/T5：左栏两段式——全景折叠块头 + 目录锚点项；锚点滚动留出顶栏高度 */
.pb-head-row, .metric-sec { scroll-margin-top: 72px; }
.pd-pan-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
.pd-pan-head:hover { color: var(--text-2); }
.pd-caret { font-size: 10px; color: var(--text-4); }
.pd-pan { margin-bottom: 6px; }
.toc-item { padding-left: 8px; }
.board { min-width: 0; }
.metric-sec .mname { outline: none; border-radius: 5px; padding: 2px 5px; margin: -2px -5px; cursor: text; }
.metric-sec .mname:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.metric-sec .mname:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.back-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
/* R52-F6：成功指标名输入行 */
.metric-add-row { display: flex; gap: 8px; margin: -6px 0 14px; }
.metric-add-row input { flex: 1; border: 1px solid var(--border); background: var(--surface-2); border-radius: 8px; padding: 8px 12px; font-size: 12.5px; color: var(--text); outline: none; font-family: inherit; }
.metric-add-row input:focus { border-color: var(--accent); }

.metric-sec { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 12px; transition: border-color var(--dur), box-shadow var(--dur); }
/* R55-G1：目录树定位闪烁 */
.metric-sec.sec-flash { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.btask.task-flash { background: var(--accent-light); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent); }
.btask.task-flash .bt { color: var(--accent); }
.metric-sec.drag-over { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
.metric-head2 { display: flex; align-items: center; gap: 10px; }
.metric-head2 .mname { font-size: 13.5px; font-weight: 600; flex: 1; min-width: 0; }
.metric-head2 .pct { font-size: 12px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.icon-btn-sm { width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--text-3); cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; font-family: inherit; flex-shrink: 0; }
.icon-btn-sm:hover { background: var(--surface-3); color: var(--text); }
.icon-btn-sm.del:hover { color: var(--danger); }
/* R146：行内 AI 入口常态可见（审计：hover 才现=触屏与键盘 100% 摸不到），强调色只给"AI 可点"这一层 */
.icon-btn-sm.ai { color: var(--accent); opacity: .78; }
.icon-btn-sm.ai:hover { color: var(--accent); opacity: 1; background: var(--accent-light); }
.task-rows { margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 4px; min-height: 20px; }
.btask { display: flex; align-items: center; gap: 9px; padding: 6px 8px; border-radius: 8px; transition: background var(--dur-fast); }
.btask:hover { background: var(--surface-2); }
.btask.dragging { opacity: .35; }
.btask .bdrag { color: var(--text-4); font-size: 11px; cursor: grab; flex-shrink: 0; }
.bcheck { width: 16px; height: 16px; border-radius: 5px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; background: var(--surface); }
.bcheck:hover { border-color: var(--accent); }
.bcheck.done { background: var(--success); border-color: var(--success); }
.btask .bt { flex: 1; font-size: 12.5px; cursor: pointer; min-width: 0; }
.btask:hover .bt { color: var(--accent); }
.btask.done .bt { text-decoration: line-through; color: var(--text-3); }
.task-add { display: flex; align-items: center; gap: 8px; padding: 6px 8px; color: var(--text-3); font-size: 11.5px; cursor: pointer; border-radius: 8px; }
.task-add:hover { color: var(--accent); background: var(--accent-light); }
.board-foot-hint { margin-top: 14px; font-size: 11px; color: var(--text-3); text-align: center; padding: 10px; background: var(--surface-2); border-radius: var(--radius-xs); }

/* ===== R121：展板头部（面包屑 + 标题行 + 统计条） ===== */
.pb-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); margin-bottom: 14px; flex-wrap: wrap; }
.pb-crumb { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; color: var(--text-3); flex-wrap: wrap; }
.pc-seg { cursor: pointer; }
.pc-seg:hover { color: var(--accent); text-decoration: underline; }
.pc-sep { color: var(--text-4); }
.pc-current { color: var(--text); font-weight: 700; }
.pb-acts { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.pb-more-wrap { position: relative; display: inline-flex; }
.mini-btn.icon { padding: 5px 10px; }
.pb-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 176px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-lg); padding: 4px; }
.pb-menu .pm-item { padding: 7px 10px; border-radius: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; white-space: nowrap; }
.pb-menu .pm-item:hover { background: var(--accent-light); color: var(--accent); }
.pb-menu .pm-item.danger:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.pb-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.pb-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pb-title .hero-pname { font-size: 18px; font-weight: 700; letter-spacing: .2px; outline: none; border-radius: 6px; padding: 2px 6px; margin: -2px -6px; cursor: text; }
.pb-title .hero-pname:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.pb-title .hero-pname:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.pb-pct { flex-shrink: 0; font-size: 18px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.pb-stats { display: flex; align-items: center; gap: 20px; background: var(--surface-2); padding: 10px 16px; border-radius: var(--radius-md); margin-bottom: 16px; font-size: 12px; color: var(--text-2); flex-wrap: wrap; }
.pb-stats .pbs b { font-size: 14px; color: var(--text); font-variant-numeric: tabular-nums; }
.pb-tail { margin-left: auto; font-size: 11px; color: var(--text-3); }
.pb-tail .ok { color: var(--success); }
.pb-tail .warn { color: var(--warning); }
.pb-hint { font-size: 11px; color: var(--text-3); margin-bottom: 12px; }

/* ===== R121：指标块与任务行（Linear 极简发丝线，对齐原型） ===== */
.metric-sec { padding: 0; overflow: hidden; }
.metric-head2 { background: var(--surface-2); padding: 9px 14px; border-bottom: 1px solid var(--border); }
.mh-idx { flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--accent); background: var(--accent-light); padding: 2px 7px; border-radius: 4px; }
.mh-meta { flex-shrink: 0; font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.mh-acts { display: none; gap: 2px; margin-left: auto; }
.metric-sec:hover .mh-acts { display: inline-flex; }
.metric-head2 .mname { font-size: 12.5px; font-weight: 600; }
.task-rows { margin-top: 0; border-top: none; padding-top: 0; gap: 0; }
.btask { border-radius: 0; border-bottom: 1px solid var(--hairline); padding: 9px 14px; }
.btask:last-of-type { border-bottom: none; }
.btask .bdrag { opacity: 0; }
.btask:hover .bdrag { opacity: 1; }
.btask .bcheck { width: 15px; height: 15px; border-radius: 4px; }
.btask .bcheck.done { background: var(--text-3); border-color: var(--text-3); }

/* 抽屉 */
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 400; }

.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.tag { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; white-space: nowrap; }
.tag.accent { background: var(--accent-light); color: var(--accent); }
.tag.warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.tag.danger { background: var(--tag-danger-bg); color: var(--tag-danger-text); }
.tag.info { background: var(--accent-light); color: var(--accent); }
.progress { height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; }
.progress > i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s ease; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--dur-slow); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform .2s cubic-bezier(.16,1,.3,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

/* ===== R124（提案）：中性优先级退色——默认 4px 灰点，行 hover 才显标签；仅高优保留警示色 ===== */
.tag.plain { background: transparent; color: var(--text-4); padding: 2px 2px; gap: 4px; }
.tag.plain .tag-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--text-4); }
.tag.plain .tag-txt { display: none; }
.btask:hover .tag.plain .tag-dot { display: none; }
.btask:hover .tag.plain .tag-txt { display: inline; }
.btask:hover .tag.plain { padding: 2px 6px; }
/* ===== R124（提案）：展板上下文沉浸——聚焦项目展板顶部极低纯度紫调光带 + 内阴影提层 ===== */
/* R126（诉求 1）：内嵌展板 = 模块框线（对齐 ModuleCard 视觉；内边距 22 与主航线标题左缘对齐） */
.page.is-embedded { background-color: var(--surface); background-image: linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, transparent), transparent 150px); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); padding: 14px 22px 18px; }

/* R126（诉求 1）：展板项目图标（主攻与普通统一普通项目图标；🚀 表示主攻（🎯 只留成功指标）） */
.pb-title .pb-picon { font-size: 16px; flex-shrink: 0; }
</style>
