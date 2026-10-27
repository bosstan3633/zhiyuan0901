import '../components/compass/hotzone.css'
import { ref, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { wsNameById } from '@/shared/utils/wsName'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { K } from '@/shared/storage/keys'
import { matchPinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { toOpenableRawLink, toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { compassNodeCounts, removeCompassNode, restoreCompassNode, removeMetricWithConfirm, type CompassNodeKind } from '@/shared/utils/compassCrud'
import { useConfirm } from '@/shared/components/confirm'
import { taskMaturity, metricMaturity, projectMaturity, directionMaturity } from '@/shared/utils/maturity'
import { recordResourceOpen } from '@/shared/storage/stats'
import Drawer from '@/shared/components/Drawer.vue'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import CompassSpine from '../components/compass/CompassSpine.vue'
import CompassLayerList from '../components/compass/CompassLayerList.vue'
import CompassPano from '../components/compass/CompassPano.vue'
import { buildCompassMeta } from './compassMeta'
import type { ProjectMeta } from './compassMeta'
import CompassRiskModal, { type RiskProjectGroup } from '../components/compass/CompassRiskModal.vue'
import type { GoalParseResult } from '@/shared/utils/mdImport'
import { useProjectDiag } from '../composables/useProjectDiag'
import { onOpenDrawer } from '@/shared/utils/bus'
import { useCompassTreeProjects } from './useCompassTreeProjects'
import { useCompassTreeSpine } from './useCompassTreeSpine'



export function useCompassTree() {

// R146（回退契约）：罗盘节点删除走真源（确认报数 + 3 秒撤销），与策展台/项目抽屉同一口径
// W11（V3.8.11）战略金字塔：骨架控制条 / 层级展开面板 / 项目舱 / 项目全景 四件套（原型 v1 视觉基准）

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress, toggleFocusProject, addProjectToDir, isProjectDone, isProjectStalled, showDone, toggleShowDone } = useCompass()

// ---- R135：罗盘链式生成（directions/projects/metrics/tasks 四层入口共用一个评审抽屉） ----
const AiDrawer = defineAsyncComponent(() => import('@/newtab/components/AiSuggestionDrawer.vue'))
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const aiPersonaId = ref('default')
let aiChainLast: { level: import('@/shared/ai/scenarios').ChainLevel; anchorId: string } = { level: 'directions', anchorId: '' }
async function aiChain(level: import('@/shared/ai/scenarios').ChainLevel, anchorId: string) {
  const [{ loadAiConfig, aiReady, aiConfig }, { buildChainJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/chain')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (!d.value) return
  // R141（反馈 #2）：默认执笔专家取自设置；抽屉内换人 → 记住选择并重建重跑
  if (aiPersonaId.value === 'default' && aiConfig.value.defaultPersona) aiPersonaId.value = aiConfig.value.defaultPersona
  aiChainLast = { level, anchorId }
  const job = buildChainJob(level, anchorId, { d: d.value, depth: aiConfig.value.depth, persist: () => store.persist(), addProject: (id, name) => addProjectToDir(id, name), personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; void aiChain(aiChainLast.level, aiChainLast.anchorId) } })
  if (!job) { showToast('锚点实体已不存在，请刷新后重试'); return }
  aiJob.value = job
}

// ---- N2（V3.8.18）单项目 AI 诊断：跑（AI 抽屉）→ 存（会话缓存）→ 看（中央弹窗） ----
/** ★F4（2026-10-15）：宿主逻辑下沉 useProjectDiag（三处消费：塔/全景/项目详情共用一份会话缓存）。
 *  这里只保留「把 job 交给本页 AiDrawer」这一条宿主职责。 */
const ProjectDiagnoseModal = defineAsyncComponent(() => import('../components/compass/ProjectDiagnoseModal.vue'))
const { diagFor, diagStale, startProjectDiag, openDiagReport, rerunDiag, diagOpen, diagProjId, diagReport } = useProjectDiag({ d, setJob: (job) => { aiJob.value = job } })

// ---- R54-A1：来源感知返回（?from=proj&p= → 项目详情；默认方向台）+ A3 定位 + A4 Esc ----
const fromProjId = computed(() => route.query.from === 'proj' && typeof route.query.p === 'string' ? route.query.p : '')
const fromProjName = computed(() => fromProjId.value ? allProjects().find(p => p.id === fromProjId.value)?.name || '项目详情' : '')
function goBack() {
  // R3-B1：树就是方向台一级，一级台面没有「回上一级」这回事——只有从项目详情带 from=proj 进来才有一级可回
  if (fromProjId.value) router.push({ path: '/compass/projects', query: { p: fromProjId.value } })
}
function locateHlGoal() {
  const dirId = route.query.hl
  if (!dirId || typeof dirId !== 'string') return
  // R121：目标列常显——定位无需先展开
  nextTick(() => {
    const el = document.querySelector(`[data-dir-id="${dirId}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('goal-flash')
    setTimeout(() => el.classList.remove('goal-flash'), 1500)
  })
}
function onPageEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  // V3.9.1：KeepAlive 只暂停渲染、不卸载监听。若当前已离开本页，旧实例不得再处理 Esc，
  // 否则会与当前页的返回监听形成竞态（项目详情 → 方向树时最终可能多退一级）。
  if (route.name !== 'compass') return
  // R3-B1：一级台面没有上级可回——Esc 交回给浮层/浏览器默认行为
  if (!fromProjId.value) return
  // V3.9.1：全局 GP 浮层恒挂载，不能用裸 `.overlay` 判断——它会让来源感知返回永远让位。
  // 同时把方向台自己的关联卡片弹窗 `.lm-mask` 与共享抽屉遮罩算进来，Esc 先关上层。
  if (document.querySelector('.task-sidebar, .overlay:not(.gp-overlay), .modal-mask, .drawer-overlay, .drawer, .picker-modal, .md-panel, .lm-mask')) return
  e.preventDefault()
  goBack()
}
onMounted(() => {
  document.addEventListener('keydown', onPageEsc, true)
  locateHlGoal()
})
onUnmounted(() => document.removeEventListener('keydown', onPageEsc, true))
watch(() => route.query.hl, () => locateHlGoal())

// ---- 展开状态 ----

const expandedMetrics = ref<Set<string>>(new Set())

/* ================= R3-B′：项目层折叠（「树即首屏」的前置） =================
   原状态：B26 把指标层默认全展开，一棵大方向树在首屏全摊开——既看不动也摸不准层次。
   新口径：战略目标与项目卡头常显，**主攻项目自动展开、非主攻折叠成卡头**，点卡头开合。
   开合态走 **会话记忆**（sessionStorage：跨页面切换保住，关浏览器即忘）——它是浏览态不是偏好，
   不该进 UIPrefs 跟着导出/同步跑掉。 */
const PROJ_FOLD_KEY = K.TREE_PROJ_FOLD_SS
function readProjFold(): Record<string, boolean> {
  try { return JSON.parse(sessionStorage.getItem(PROJ_FOLD_KEY) || '{}') as Record<string, boolean> } catch { return {} }
}
const projFoldOverride = ref<Record<string, boolean>>(readProjFold())
function writeProjFold() {
  try { sessionStorage.setItem(PROJ_FOLD_KEY, JSON.stringify(projFoldOverride.value)) } catch { /* 隐私模式写不进就算了 */ }
}
function projOpen(p: Project): boolean {
  const o = projFoldOverride.value[p.id]
  return o === undefined ? !!p.isFocused : o
}
function expandMetricsOf(p: Project) { for (const m of p.metrics) expandedMetrics.value.add(m.id) }
function toggleProjectFold(p: Project) {
  const next = !projOpen(p)
  projFoldOverride.value[p.id] = next
  writeProjFold()
  if (next) expandMetricsOf(p)
}
/** B26 口径保留（数据变化补齐展开），但只摊**展开中的项目**——折叠项目里的指标不必先渲染再隐藏 */
function expandMetricsOfOpenProjects() {
  for (const dir of d.value.compass.directions) for (const proj of dir.projects) if (projOpen(proj)) expandMetricsOf(proj)
}
watch(() => d.value?.compass.directions, () => expandMetricsOfOpenProjects(), { deep: true, immediate: true })

/** R49-C7：一键展开/收起全部（R3-B′ 起两级一起管：项目卡 + 指标）
    W1.1 修「收起后展开没反应」：收起把每个项目显式写 projFoldOverride=false 落盘（显式值压过主攻默认），
    而旧实现只补指标层、不复位项目层 ⇒ 点展开循环体被 projOpen 守卫挡在门外，零副作用。
    修复＝与 collapseAllNodes 对称：展开把每个项目写 override=true 并全摊指标，按钮才真的反向。 */
/** 一键展开/收起只作用于“当前可见项目”：
 *  受战略目标筛选、断链模式、已完成项目显隐共同收窄。
 *  否则筛到 1 个目标后点“全部展开”，会顺手把其它不可见目标也写开，
 *  清除筛选后看起来像“我没点过它们，却全展开了”。 */
function visibleProjectsForBulk(): Project[] {
  return towerGroups.value.flatMap(g => g.projs.map(r => r.proj))
}
function expandAllNodes() {
  for (const proj of visibleProjectsForBulk()) {
    projFoldOverride.value[proj.id] = true
    expandMetricsOf(proj)
  }
  writeProjFold()
}

/** R49-C7：一键展开/收起全部（R3-B′ 起两级一起管：项目卡 + 指标） */
function collapseAllNodes() {
  for (const proj of visibleProjectsForBulk()) projFoldOverride.value[proj.id] = false
  writeProjFold()
  for (const proj of visibleProjectsForBulk()) for (const m of proj.metrics) expandedMetrics.value.delete(m.id)
}

/** ★V3.8.18（N11）：合并开关的当前状态 —— 「全部项目舱是否都处于展开」。
 *  一个项目都没有时判 false：空库点一下应该是"展开"而不是"收起"（无物可收）。
 *  ★判据只读 projFoldOverride，不读 projOpen —— 后者带「主攻默认展开」兜底，
 *  那个兜底会让「全部收起」之后仍被算成已展开，按钮就永远弹回同一个状态（死按钮）。 */
const allExpanded = computed(() => {
  const projs = towerGroups.value.flatMap(g => g.projs.map(r => r.proj))
  if (!projs.length) return false
  return projs.every(p => projFoldOverride.value[p.id] === true)
})
/** 反向开关：点一次反向。正反都可达，不做单向门。 */
function toggleAllNodes() { if (allExpanded.value) collapseAllNodes(); else expandAllNodes() }

/* ══ ★V3.8.20（用户拍板 2026-10-15）「⚙ 工具」下拉 —— ★F6 二次翻转退役（用户拍板 2026-10-16）══
 * 两枚次级开关（↕ 展开收起 / 👁 已完成）随 F6 恢复为 .hero-acts 常驻按钮：下拉形态让高频操作
 * 变两跳、且「👁 已完成项目：显示/隐藏」这种状态开关藏进菜单后当前状态不可见（V3.8.20 收纳
 * 决策的代价，二次翻转理由见模板 .hero-tools 处备案）。
 * toolsOpen state 与外点关闭监听（onDocClickCloseTools / capture 阶段 click）随下拉一并退役。
 * ★N4 页头文案就地编辑（眉标/大标题/副标 + ✎ + UIPrefs.compassCopy）随左文案栏一并退役：
 * 方向台是工作台面不是宣传页，定调语由骨架条 .spine-h「上层定方向 · 下层见动作」承担。 */

/* R3-B′：项目卡头入口收敛（6 枚 → 全景 / AI / ▾），其余四项进折叠菜单 */
const projMenu = ref<string | null>(null)
function toggleProjMenu(id: string) { projMenu.value = projMenu.value === id ? null : id }
function closeProjMenu() { projMenu.value = null }
function onDocClickCloseProjMenu(e: MouseEvent) {
  if (!projMenu.value) return
  if ((e.target as HTMLElement | null)?.closest('.tp-acts')) return
  projMenu.value = null
}
onMounted(() => document.addEventListener('click', onDocClickCloseProjMenu, true))
onUnmounted(() => document.removeEventListener('click', onDocClickCloseProjMenu, true))

/* ================= R3-B2：同一战略目标内的手动排序与置顶 =================
   这两项原本活在主航线项目行卡的右键菜单里，随 CompassShell 退役一度归零；用户拍板保留，
   落回方向树（**不跨目标**——跨目标改归属是另一件事，走项目详情）。
   排序键：主攻 → 置顶 → order。置顶只决定"非主攻组的第一位"，不写 order；
   拖拽落位即手动位置，落完清掉 pinned（否则排序键会把它弹回前排，看着像"拖不动"）。 */
const dragProj = ref<{ dirId: string; id: string } | null>(null)
const dropTargetId = ref('')
function onProjDragStart(dirId: string, p: Project, e: DragEvent) {
  dragProj.value = { dirId, id: p.id }
  e.dataTransfer?.setData('text/plain', p.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onProjDragOver(dirId: string, p: Project) {
  const drag = dragProj.value
  if (!drag || drag.dirId !== dirId || drag.id === p.id) return
  dropTargetId.value = p.id
}
function onProjDragLeave(id: string) { if (dropTargetId.value === id) dropTargetId.value = '' }
function onProjDragEnd() { dragProj.value = null; dropTargetId.value = '' }
function onProjDrop(dirId: string, target: Project) {
  const drag = dragProj.value
  dropTargetId.value = ''
  dragProj.value = null
  if (!drag || drag.dirId !== dirId || drag.id === target.id) return
  const dir = d.value.compass.directions.find(x => x.id === dirId)
  if (!dir) return
  const list = visibleProjectsOf(dir)
  const from = list.findIndex(p => p.id === drag.id)
  const to = list.findIndex(p => p.id === target.id)
  if (from < 0 || to < 0) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  if (!moved) return
  moved.pinned = false
  list.forEach((p, i) => { p.order = i })
  /* ★W12(V3.8.12)真缺陷修复（E2E-29 实跑抓到）：`visibleProjectsOf` 返回的是
     `.slice().sort()` 的**新数组**，上面的 splice 只改了那个副本 —— `dir.projects`
     原数组的**元素顺序从未变过**。而项目舱的渲染顺序走 compassMeta →
     `dir.projects.map(...)`（不排序，按原数组序）⇒ 数据层 order 写了、toast 也报了
     「排到第 N 位」，**但视觉顺序一动不动**，用户会觉得"拖了没反应"。
     这里把同一份顺序写回原数组，渲染侧与数据侧口径才一致。
     （排序键「主攻 → 置顶 → order」由 visibleProjectsOf 单点承担，不在这里重复实现。） */
  const orderedIds = list.map((p) => p.id)
  dir.projects.sort((a, b) => {
    const ia = orderedIds.indexOf(a.id)
    const ib = orderedIds.indexOf(b.id)
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
  })
  store.persist()
  showToast(`↕ 「${moved.name}」排到该目标第 ${to + 1} 位（同目标内拖拽，主攻项目恒在前排）`)
}
function toggleProjectPin(dir: Direction, p: Project) {
  p.pinned = !p.pinned
  if (p.pinned) {
    const minOrder = Math.min(0, ...dir.projects.filter(x => !x.isFocused && x.id !== p.id).map(x => x.order ?? 999))
    p.order = minOrder - 1
  }
  store.persist()
  showToast(p.pinned ? `「${p.name}」置顶到该目标前排` : '已取消置顶')
}

// R86（T0）：已完成项目显隐改由 store 提供（showDone / toggleShowDone）——三处模块共用同一份实现。
function visibleProjectsOf(dir: Direction): Project[] {
  // R52-BUG-2：口径统一 isProjectDone（手动 done/archived 或全任务完成派生），修复「已完成项目显隐」开关失效
  // R59-T3：主攻项目置前（稳定排序，组内保持原有顺序）
  // R3-B2：主攻 → 置顶 → order（order 由同目标内拖拽落位；置顶是"非主攻组第一位"的快捷方式）
  return dir.projects
    .filter(p => showDone.value || !isProjectDone(p))
    .slice()
    .sort((a, b) => (Number(b.isFocused) - Number(a.isFocused)) || (Number(!!b.pinned) - Number(!!a.pinned)) || ((a.order ?? 999) - (b.order ?? 999)))
}
const treeStats = computed(() => {
  // R3-B1：主攻/停滞两项随 CompassShell 页头退役搬进来（状态**筛选**按 R3 计划退役，读数不留失）
  let focused = 0, stalled = 0
  let projects = 0, metrics = 0
  for (const dir of d.value.compass.directions) {
    const vis = visibleProjectsOf(dir)
    projects += vis.length
    // ★C1（V3.8.28）口径修正：原实现用 dir.projects（**含已隐藏的已完成项目**）累加指标，
    // 与同行的「项目」用 visibleProjectsOf 不是同一把尺子 —— 隐藏已完成后会出现
    // 「项目 3 · 指标 20」而树上只数得到 12 个指标的两份真相。四项状态读数（项目/指标/主攻/停滞）
    // 统一按可见项目算；「任务」仍按全库未删计（不同维度，tooltip 已写清）。
    metrics += vis.reduce((s, p) => s + p.metrics.length, 0)
    for (const p of vis) {
      if (p.isFocused) focused++
      if (isProjectStalled(p)) stalled++
    }
  }
  return {
    dirs: d.value.compass.directions.length,
    projects, metrics,
    focused, stalled,
    tasks: d.value.tasks.filter(t => !t.deletedAt).length
  }
})

/** R3-B1：树升首屏后补上项目级预计算表——R83-7 性能红线（模板内不逐项调 projectProgress）
 *  此前只管主航线面板，树里每张卡头调 4 次、任务数还在模板里现算一次 filter。 */
const projMeta = computed(() => {
  const m = new Map<string, { pct: number; done: number; total: number; tasks: number; stall: boolean }>()
  for (const dir of d.value.compass.directions) for (const p of dir.projects) {
    const pr = projectProgress(p)
    m.set(p.id, { pct: pr.pct, done: pr.done, total: pr.total, stall: isProjectStalled(p), tasks: d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id).length })
  }
  return m
})

/* ══════════════════════════════════════════════════════════════
   W11（V3.8.11）战略金字塔 —— 骨架条 ⇄ 项目塔 双向联动
   ══════════════════════════════════════════════════════════════ */
/** 集中取数：骨架条数字、舱体计数、指标任务全部吃这一份（判据 W11-7 / W11-11） */
const compassMeta = computed(() => buildCompassMeta(d.value, isProjectStalled))

/**
 * ★视图形态（判据 D3 已拍板：方向台内第二视图，不新建路由与页面文件）。
 * 'tower' 纵向项目舱列 —— 「我在哪个位置」；
 * 'pano'  横向泳道全景 —— 「这一个项目的完整链路长什么样」。
 * 两者是**同一份 compassMeta 的两种投影**，不是两个实体世界 ⇒ 切换不重算、不丢筛选。
 */
const viewMode = ref<'tower' | 'pano'>('tower')
/** 全景视图当前聚焦的项目 id（双向：点选择条换主体 / 舱头点进来定主体） */
const panoId = ref('')

/** 切到全景并定住主体（舱头「全景」与「⇅ 回项目塔」的落点都走这里） */
function openPano(projId: string) {
  panoId.value = projId
  viewMode.value = 'pano'
  layerOpen.value = null
  layerView.value = null
  showToast('横向全景 · 一根泳道就是一条成功指标')
}

/** ★F4：全景当前实际聚焦的项目 —— 与 CompassPano 内部 current 的兜底口径一致
 *  （activeId 失效时兜底到第一个项目，避免诊断态错挂在空 id 上）。 */
const panoEffectiveId = computed(() => {
  const g = compassMeta.value.dirs
  for (const grp of g) for (const pm of grp.projects) if (pm.id === panoId.value) return panoId.value
  return g[0]?.projects[0]?.id || ''
})
/** 从全景回到项目塔：带着 dirFilter 定位（不做「回来就丢上下文」的假双向） */
function backToTower(projId: string) {
  viewMode.value = 'tower'
  const pm = compassMeta.value.byProject.get(projId)
  const owner = compassMeta.value.dirs.find(g => g.projects.some(p => p.id === projId))
  if (owner && owner.dir.id !== dirFilter.value) dirFilter.value = owner.dir.id
  if (pm) projFoldOverride.value[projId] = false
  nextTick(() => {
    const el = document.querySelector(`[data-tower="${projId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  showToast(pm ? `回到项目塔 · ${pm.metrics.length} 指标 · ${pm.total} 任务` : '回到项目塔')
}

/** 当前聚焦的战略目标 id；'' ＝全部 */
const dirFilter = ref('')
/** 当前展开的层级 1|2|3；null ＝全收起 */
/** ★F7（2026-10-16）：层级两种驻留形态互斥——layerOpen 层面板（1/2）· layerView 层级专属列表（3/5/6）；
 *  层 4 走定位不驻留（项目舱本身已是独立全貌）。 */
const layerOpen = ref<1 | 2 | null>(null)
const layerView = ref<3 | 5 | 6 | null>(null)
/** 断链模式：只留有缺口的部分 */
const riskOnly = ref(false)

/** 筛选态提示条要显示的目标名（拿不到就显示 id 兜底，绝不留空） */
const dirFilterName = computed(() =>
  d.value.compass.directions.find(x => x.id === dirFilter.value)?.name || dirFilter.value || ''
)
/** 一键清空筛选（判据 W11-9：过滤必须有显式出口，不能"点了就回不去"） */
function clearFilters() {
  const had = dirFilter.value || riskOnly.value
  dirFilter.value = ''
  riskOnly.value = false
  if (had) showToast('已清除全部筛选 · 恢复完整六层视图')
}

/** 舱色六档（判据 D2：从 --accent 派生，不新增色系令牌） */
const HUES = [88, 70, 52, 38, 26, 16]
function hueAt(i: number): string {
  return `color-mix(in srgb, var(--accent) ${HUES[i % HUES.length]}%, var(--surface))`
}

/**
 * 舱列数据：按战略目标分组，串上色相与聚合结果。
 * ★过滤放在这一层做——分组头与舱同时消失，不会留下"有头无舱"的空壳。
 */
const towerGroups = computed(() => {
  const out: {
    dir: Direction; i: number; hue: string
    projs: { proj: Project; meta: import('./compassMeta').ProjectMeta; hue: string }[]
    metaCount: number; taskCount: number
  }[] = []
  let gi = 0
  for (const g of compassMeta.value.dirs) {
    if (dirFilter.value && g.dir.id !== dirFilter.value) continue
    /* 断链模式下整个目标都没缺口 ⇒ 连头带舱一起藏 */
    if (riskOnly.value && g.projects.every(p => p.risk === 0)) continue
    const rows = g.projects.map((pm, pi) => {
      const proj = findProject(pm.id)
      return proj ? { proj, meta: pm, hue: hueAt(gi + pi) } : null
    }).filter((x): x is { proj: Project; meta: import('./compassMeta').ProjectMeta; hue: string } => !!x)
    if (!rows.length) continue
    out.push({
      dir: g.dir, i: gi, hue: hueAt(gi),
      projs: rows,
      metaCount: rows.reduce((s, r) => s + r.meta.metrics.length, 0),
      taskCount: rows.reduce((s, r) => s + r.meta.total, 0)
    })
    gi++
  }
  return out
})

/**
 * ★视觉聚焦（方向台优化）：当前主攻 = 第一个可见主攻项目；没有主攻时回落到第一个可见项目。
 * 它只做"我在哪 + 推进到哪 + 下一步往哪走"的一条摘要，不新增任何数据源——
 * 全部取自 towerGroups（同一份 compassMeta），与项目塔、骨架条口径一致。
 */
const focusTower = computed(() => {
  const all = towerGroups.value.flatMap(g => g.projs.map(r => ({ ...r, dir: g.dir })))
  return all.find(r => r.proj.isFocused) || all[0] || null
})
function gotoFocusTower() {
  if (focusTower.value) gotoTower(focusTower.value.proj.id)
}

/** 按 id 找项目（供子组件 emit 回传给 store 层动作） */
function findProject(id: string): Project | undefined {
  for (const dir of d.value.compass.directions) {
    const p = dir.projects.find(x => x.id === id)
    if (p) return p
  }
  return undefined
}
/** 按 metricId 找 { proj, metric }，供「建第一条任务」带出项目 id */
function findMetric(metricId: string): { proj: Project; metric: import('@/shared/models').Metric } | undefined {
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return { proj, metric: m }
    }
  }
  return undefined
}

/* ══ ★F7 层级专属列表行数据（2026-10-16）══
   纪律同 W11-5：单一真源取自 compassMeta（第 3/5 层）与 d.tasks 未删除口径（第 6 层，
   与 counts.tasks 一致，含无归属孤儿）——组件 props-only 零 store 零再聚合。
   由模板 layerRows3/5/6 表达式引用，仅在 <CompassLayerList v-if="layerView"> 挂载时求值。 */
const layerRows3 = computed(() => compassMeta.value.dirs.map((g, i) => {
  let done = 0, total = 0
  for (const pm of g.projects) { done += pm.done; total += pm.total }
  return {
    id: g.dir.id, i, name: g.dir.name,
    done, total, pct: total ? Math.round((done / total) * 100) : 0,
    stall: g.projects.some(p => p.stall),
    projs: g.projects.map(pm => ({ t: pm.total, risk: !!pm.risk }))
  }
}))
const activeLayer = ref(1)
  const { layerRows5, layerRows6, onLayerOpen, onLayerList, onLocateLayer, spineRef, heroToSpine, locateCompassTarget, flashLocated, locationTaskPool, onListLocate, onListEditDir, onDirFilter, toggleRiskOnly, gotoOrphans, riskOpen, riskGroups, showRiskReport, showTaskGrade, bindOrphan, toggleMetric, editingField, focusEditField, startEdit, saveEdit, cancelEdit, directionForm, openDirectionCreate, openDirectionEdit, saveDirectionForm } = useCompassTreeProjects({ compassMeta, findProject, d, layerOpen, layerView, activeLayer, ensureTower, projFoldOverride, writeProjFold, expandedMetrics, viewMode, dirFilter, riskOnly, router, panoId, openPano, visionText, missionText, allProjects, store })
function addProject(dirId: string) {
  const proj = addProjectToDir(dirId, '新攻坚项目')
  if (proj) showToast('项目已创建')
}

/** R108（T2）：战略目标 · Markdown 模板批量导入——项目/指标/任务一次生成。
 *  同名跳过在写入层执行（需要本目标上下文）：同名项目整体跳过（幂等防重复导入），
 *  同名指标/任务在各自层级跳过；确认前弹窗内已可见全部将创建的结构（预览即确认）。 */
  const { goalImport, openGoalImport, confirmGoalImport, projImport, openProjImport, confirmProjImport, onToggleFocus, addMetric, delMetricById, taskAdd, openTaskAdd, detailRef, onTaskCreated, openTaskDetail, metricDetailId, metricDetailOpen, openMetricDetail, taskAddMetricTitle, toggleTask, NODE_KIND, nodeNameOf, deleteNode, unbindTask, unbindTaskById } = useCompassTreeSpine({ d, addProjectToDir, store, allProjects, toggleFocusProject, expandedMetrics, findMetric })
function isStagnant(dir: Direction): boolean {
  const projIds = dir.projects.map(p => p.id)
  const recentTask = d.value.tasks
    .filter(t => !t.deletedAt && projIds.includes(t.projectId || ''))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  if (!recentTask && dir.projects.length > 0) return true
  return recentTask ? Date.now() - (recentTask.updatedAt || 0) > 14 * 86400_000 : false
}

// ---- 左侧项目导航（W12：由六层数字目录改为项目清单，对齐原型 .navside） ----
/**
 * ★为什么左栏不再放「1~6 六层目录」：
 * 六层目录是一排纯数字，看不出层级关系，而且它做的事（定位到某一层）骨架条的 1~6 按钮已经在做了 ——
 * 同一件事摆两处，第二处就变成"看着像导航、点了其实是另一套"。
 * 原型的 .navside 是**项目清单**（序号 + 项目名 + 指标/任务数），并随滚动高亮当前所在舱。
 */
const activeTowerId = ref('')
/** 点左栏舱 → 定位到该舱（与项目塔的定位动作同一入口，不另起一条路） */
function gotoTower(projId: string) {
  activeTowerId.value = projId
  /* 全景 → 左栏项目导航也走这里：必须先把视图切回项目塔，
     否则 querySelector 在泳道 DOM 里找不到 [data-tower]，点了像没反应。 */
  if (viewMode.value === 'pano') {
    viewMode.value = 'tower'
    layerView.value = null
    layerOpen.value = null
  }
  ensureTower('定位项目舱').then(() => {
    const el = document.querySelector(`[data-tower="${projId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('w11-flash')
    setTimeout(() => el?.classList.remove('w11-flash'), 1400)
  })
}
const canvasEl = ref<HTMLElement | null>(null)
/**
 * ★定位动作前先确保在项目塔视图。
 * 为什么要这一步：全景视图里第 4/5/6 层不再是纵向排布的 DOM（它们变成了一根根横向泳道），
 * 于是"点骨架条第 5 层"在全景下会静默失灵 —— 点了没反应，看起来像坏了。
 * 正确行为是**先切回纵向再定位**（双向可达的反向：任何定位都能抵达，不挑视图）。
 */
function ensureTower(hint: string): Promise<void> {
  if (viewMode.value === 'tower') return Promise.resolve()
  viewMode.value = 'tower'
  showToast(`${hint} · 已自动切回项目塔视图`)
  return nextTick()
}
function onCanvasScroll() {
  /* 全景视图是横向泳道，纵向滚动不再对应舱序列 ⇒ 左栏高亮保持不动，
     否则会随页面微滚乱跳（判据 W11-9 的一部分：联动不许制造假信号） */
  if (viewMode.value === 'pano') return
  const canvas = canvasEl.value
  if (!canvas) return
  const canvasTop = canvas.getBoundingClientRect().top
  /* 高亮"当前视野顶部所在的舱"。遍历 DOM 顺序取最后一个已越线的，
     比反向查找 first 更快，且与阅读顺序一致（上方舱先命中）。 */
  const towers = canvas.querySelectorAll('[data-tower]')
  let current = ''
  for (const el of towers) {
    if (el.getBoundingClientRect().top - canvasTop <= 120) {
      current = (el as HTMLElement).dataset.tower || ''
    }
  }
  if (current) activeTowerId.value = current
  /* 当前舱所属的层（第 4/5/6）仍对外可见：定位 toast 与骨架条高亮共用它 */
  activeLayer.value = activeTowerId.value ? 4 : 1
}

// ---- 战略目标 / 推进项目（R70：原 DHI 口径已于 R64 退役） ----
const dhiStatus = computed(() => {
  const dirs = d.value.compass.directions
  if (!dirs.length) return { label: '待聚焦', cls: 'warning' }
  const active = dirs.filter(d => !isStagnant(d)).length
  if (active === dirs.length) return { label: '清晰', cls: '' }
  if (active >= dirs.length / 2) return { label: '关注', cls: 'warning' }
  return { label: '需聚焦', cls: 'warning' }
})

// ---- N1：愿景/使命关联资源卡/好奇心卡 ----
// R59-T4：关联卡片升级为居中弹窗选择器（关键词+拼音过滤、全量滚动、勾选即存）
const pinyinOn = ref(isPinyinReady())
onPinyinReady(() => { pinyinOn.value = true })
const linkModal = ref<{ node: 'vision' | 'mission' } | null>(null)
const linkQ = ref('')
function toggleLinkPop(node: 'vision' | 'mission') {
  linkModal.value = linkModal.value?.node === node ? null : { node }
  linkQ.value = ''
}
function closeLinkModal() { linkModal.value = null }
function linkIds(node: 'vision' | 'mission', kind: 'res' | 'curio'): ID[] {
  const c = d.value.compass[node]
  if (!c) return []
  return (kind === 'res' ? c.linkedResourceIds : c.linkedCuriosityIds) || []
}
function linkCount(node: 'vision' | 'mission'): number {
  return linkIds(node, 'res').length + linkIds(node, 'curio').length
}
function isLinked(node: 'vision' | 'mission', kind: 'res' | 'curio', id: string): boolean {
  return linkIds(node, kind).includes(id)
}
function toggleLinked(node: 'vision' | 'mission', kind: 'res' | 'curio', id: string) {
  const c = d.value.compass[node]
  if (!c) return
  const key = kind === 'res' ? 'linkedResourceIds' : 'linkedCuriosityIds'
  const arr: ID[] = c[key] || []
  c[key] = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]
  store.persist()
}
/** V3.9.25：关联芯片上的取消入口只摘关系，不删来源卡；3 秒内可恢复。 */
function unlinkChip(node: 'vision' | 'mission', kind: 'res' | 'curio', id: string) {
  const c = d.value.compass[node]
  if (!c) return
  const key = kind === 'res' ? 'linkedResourceIds' : 'linkedCuriosityIds'
  const arr: ID[] = c[key] || []
  if (!arr.includes(id)) return
  const next = arr.filter(x => x !== id)
  c[key] = next
  store.persist()
  const title = kind === 'res' ? resTitle(id) : curioTitle(id)
  showToast(`已取消关联「${title.slice(0, 18)}」`, { label: '撤销', cb: () => {
    const current = d.value.compass[node]
    if (!current) return
    const currentIds: ID[] = current[key] || []
    if (currentIds.includes(id)) return
    current[key] = [...currentIds, id]
    store.persist()
    showToast('✓ 已恢复关联')
  } }, { undoWindowMs: 3000 })
}
function resTitle(id: string): string {
  return d.value.resources.find(r => r.id === id && !r.deletedAt)?.title || '(已删除资源)'
}
function curioTitle(id: string): string {
  return d.value.curiosities.find(c => c.id === id && !c.deletedAt)?.question || '(已删除好奇)'
}
/** B24：点击关联卡片标题 → 右侧滑出通用详情抽屉；第卅二轮 REQ-012：双击按统一通道打开链接 */
const peek = ref<{ kind: 'res' | 'curio'; id: string } | null>(null)
function openChipLink(kind: 'res' | 'curio', id: string) {
  if (kind === 'res') {
    const r = d.value.resources.find(x => x.id === id && !x.deletedAt)
    const url = r ? toOpenableUrl(r.linkType, r.link) : ''
    if (!r || !url) { showToast('该卡片没有可打开的链接'); return }
    // WRR 口径：关联卡片打开同样计入调用统计（与资源卡池/搜索/北极星一致）
    recordResourceOpen(d.value, r)
    store.persistHot()
    openExternalLink(url)
  } else {
    const c = d.value.curiosities.find(x => x.id === id && !x.deletedAt)
    const url = toOpenableRawLink(c?.sourceUrl)
    if (!url) { showToast('该好奇心没有来源链接'); return }
    openExternalLink(url)
  }
}
const peekData = computed(() => {
  if (!peek.value) return null
  if (peek.value.kind === 'res') {
    const r = d.value.resources.find(x => x.id === peek.value!.id && !x.deletedAt)
    if (!r) return null
    const lt = r.linkType === 'file' ? '本地文件' : r.linkType === 'obsidian' ? 'Obsidian' : '网页链接'
    return { kind: 'res' as const, title: r.title, src: wsNameById(d.value.workspaces, r.workspaceId) || '资源卡池', link: r.link || '', linkType: lt, desc: r.description || '', tags: r.tags || [] }
  }
  const c = d.value.curiosities.find(x => x.id === peek.value!.id && !x.deletedAt)
  if (!c) return null
  const lt = !c.sourceUrl ? '' : c.sourceUrl.startsWith('file:') ? '本地文件' : c.sourceUrl.startsWith('obsidian:') ? 'Obsidian' : '网页链接'
  return { kind: 'curio' as const, title: c.question, link: c.sourceUrl || '', linkType: lt, desc: '', tags: c.tags || [] }
})
/** REQ-010：peek 抽屉链接统一走打开通道（chrome.tabs 优先，file 盘符归一化） */
function openPeekLink() {
  const c = peekData.value
  if (!c || !c.link) return
  const url = toOpenableRawLink(c.link)
  if (!url) { showToast('链接不可打开（本地文件缺少完整路径）'); return }
  openExternalLink(url)
}
function linkCandidates(kind: 'res' | 'curio') {
  const q = linkQ.value.trim().toLowerCase()
  const hit = (text: string) => !!text && (!q || text.toLowerCase().includes(q) || (pinyinOn.value && matchPinyin(text, q)))
  if (kind === 'res') {
    return d.value.resources.filter(r => !r.deletedAt && hit(r.title)).map(r => ({ id: r.id, title: r.title }))
  }
  return d.value.curiosities.filter(c => !c.deletedAt && hit(c.question)).map(c => ({ id: c.id, title: c.question }))
}
// R60：愿景/使命/项目的「灯塔投射」开关与数据字段均已移除；重心语义由「🚀 主攻 isFocused」承担

// 第卅二轮 REQ-003：项目卡"打开项目"→ 项目全景透视抽屉（可增删改指标与任务，实时同步方向树）
const projDrawerOpen = ref(false)
const projDrawerId = ref<string | null>(null)
function openProjectDrawer(projId: string) {
  projDrawerId.value = projId
  projDrawerOpen.value = true
  /* 项目详情是“当前项目”的另一种读法：左栏高亮必须同步，
     否则打开 A 项目详情时左栏仍停在滚动命中的 B 舱，制造两个当前项目。 */
  activeTowerId.value = projId
}

// 第卅六轮 REQ-039：搜索浮层单击 → 项目详情抽屉
let unsubProjDrawer: (() => void) | null = null
onMounted(() => {
  unsubProjDrawer = onOpenDrawer((p) => {
    if (p.kind === 'project') openProjectDrawer(p.id)
  })
})
onUnmounted(() => { unsubProjDrawer?.() })

// 滚动监听挂到外层滚动容器（罗盘容器的 .comp-content）
let scrollParent: HTMLElement | null = null
onMounted(() => {
  scrollParent = (canvasEl.value?.closest('.comp-content') as HTMLElement) || null
  scrollParent?.addEventListener('scroll', onCanvasScroll, { passive: true })
})
onUnmounted(() => {
  scrollParent?.removeEventListener('scroll', onCanvasScroll)
})


  return {
    router, route, store, d, visionText,
    missionText, allProjects, projectProgress, toggleFocusProject, addProjectToDir,
    isProjectDone, isProjectStalled, showDone, toggleShowDone, AiDrawer,
    aiJob, aiPersonaId, aiChainLast, aiChain, ProjectDiagnoseModal,
    diagFor, diagStale, startProjectDiag, openDiagReport, rerunDiag,
    diagOpen, diagProjId, diagReport, fromProjId, fromProjName,
    goBack, locateHlGoal, onPageEsc, expandedMetrics, PROJ_FOLD_KEY,
    readProjFold, projFoldOverride, writeProjFold, projOpen, expandMetricsOf,
    toggleProjectFold, expandMetricsOfOpenProjects, visibleProjectsForBulk, expandAllNodes, collapseAllNodes,
    allExpanded, toggleAllNodes, projMenu, toggleProjMenu, closeProjMenu,
    onDocClickCloseProjMenu, dragProj, dropTargetId, onProjDragStart, onProjDragOver,
    onProjDragLeave, onProjDragEnd, onProjDrop, toggleProjectPin, visibleProjectsOf,
    treeStats, projMeta, compassMeta, viewMode, panoId,
    openPano, panoEffectiveId, backToTower, dirFilter, layerOpen,
    layerView, riskOnly, dirFilterName, clearFilters, HUES,
    hueAt, towerGroups, focusTower, gotoFocusTower, findProject,
    findMetric, layerRows3, layerRows5, layerRows6, onLayerOpen,
    onLayerList, onLocateLayer, spineRef, heroToSpine, locateCompassTarget,
    flashLocated, locationTaskPool, onListLocate, onListEditDir, onDirFilter,
    toggleRiskOnly, gotoOrphans, riskOpen, riskGroups, showRiskReport,
    showTaskGrade, bindOrphan, toggleMetric, editingField, focusEditField,
    startEdit, saveEdit, cancelEdit, directionForm, openDirectionCreate,
    openDirectionEdit, saveDirectionForm, addProject, goalImport, openGoalImport,
    confirmGoalImport, projImport, openProjImport, confirmProjImport, onToggleFocus,
    addMetric, delMetricById, taskAdd, openTaskAdd, detailRef,
    onTaskCreated, openTaskDetail, metricDetailId, metricDetailOpen, openMetricDetail,
    taskAddMetricTitle, toggleTask, NODE_KIND, nodeNameOf, deleteNode,
    unbindTask, unbindTaskById, isStagnant, activeTowerId, gotoTower,
    activeLayer, canvasEl, ensureTower, onCanvasScroll, dhiStatus,
    pinyinOn, linkModal, linkQ, toggleLinkPop, closeLinkModal,
  linkIds, linkCount, isLinked, toggleLinked, unlinkChip, resTitle,
    curioTitle, peek, openChipLink, peekData, openPeekLink,
    linkCandidates, projDrawerOpen, projDrawerId, openProjectDrawer, unsubProjDrawer,
    scrollParent,
  }
}
