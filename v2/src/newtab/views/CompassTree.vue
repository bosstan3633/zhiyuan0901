<script setup lang="ts">
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'CompassTreeView' })
import Icon from '@/shared/components/Icon.vue'
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
import { softDeleteTaskToTrash, unbindTaskFromMetric } from '@/shared/utils/taskLinks'
// R146（回退契约）：罗盘节点删除走真源（确认报数 + 3 秒撤销），与策展台/项目抽屉同一口径
import { compassNodeCounts, removeCompassNode, restoreCompassNode, removeMetricWithConfirm, type CompassNodeKind } from '@/shared/utils/compassCrud'
import { useConfirm } from '@/shared/components/confirm'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { taskMaturity, metricMaturity, projectMaturity, directionMaturity } from '@/shared/utils/maturity'
import { recordResourceOpen } from '@/shared/storage/stats'
import Drawer from '@/shared/components/Drawer.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import MetricDetailDrawer from '../components/compass/MetricDetailDrawer.vue'
// W11（V3.8.11）战略金字塔：骨架控制条 / 层级展开面板 / 项目舱 / 项目全景 四件套（原型 v1 视觉基准）
import CompassSpine from '../components/compass/CompassSpine.vue'
import CompassLayerPanel from '../components/compass/CompassLayerPanel.vue'
import CompassLayerList from '../components/compass/CompassLayerList.vue'
import CompassTower from '../components/compass/CompassTower.vue'
import CompassPano from '../components/compass/CompassPano.vue'
import { buildCompassMeta } from './compassMeta'
import type { ProjectMeta } from './compassMeta'
import ImportTemplateModal from '../components/ImportTemplateModal.vue'
import type { GoalParseResult } from '@/shared/utils/mdImport'
import { useProjectDiag } from '../composables/useProjectDiag'

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
const layerRows5 = computed(() => {
  const out: { id: string; title: string; dirName: string; projName: string; projId: string; total: number; done: number; pct: number; orphan: boolean }[] = []
  for (const g of compassMeta.value.dirs) {
    for (const pm of g.projects) {
      const proj = findProject(pm.id)
      for (const m of pm.metrics) out.push({
        id: m.id, title: m.title, dirName: g.dir.name,
        projName: proj?.name || pm.id, projId: pm.id,
        total: m.total, done: m.done, pct: m.pct, orphan: m.orphanMetric
      })
    }
  }
  return out
})
const layerRows6 = computed(() => {
  const meta = compassMeta.value
  /* metricId → 归属路径（dirs 一次遍历建表，行内不再各自 find） */
  const path = new Map<string, { dirName: string; projName: string; projId: string; metricTitle: string }>()
  for (const g of meta.dirs) for (const pm of g.projects) {
    const proj = findProject(pm.id)
    for (const m of pm.metrics) path.set(m.id, { dirName: g.dir.name, projName: proj?.name || pm.id, projId: pm.id, metricTitle: m.title })
  }
  return d.value.tasks.filter(t => !t.deletedAt).map(t => {
    const p = t.metricId ? path.get(t.metricId) : undefined
    return {
      id: t.id, title: t.title, status: t.status,
      metricTitle: p?.metricTitle || null,
      projName: p?.projName || null,
      projId: p?.projId || t.projectId || '',
      dirName: p?.dirName || null,
      orphan: !p
    }
  })
})

/** 层级 1/2 面板：同层再点收起（★双向可达，判据 W11-3；★F7 收窄：第 3 层迁出改走 layerView） */
function onLayerOpen(lv: 1 | 2) {
  layerOpen.value = layerOpen.value === lv ? null : lv
  if (layerOpen.value) {
    /* 与专属列表互斥：开面板即关列表（层板与列表都占同一条视线路径） */
    layerView.value = null
    /* ★W12：面板开在骨架条之下（第 1/2 层正文已搬进面板），滚到面板而不是"愿景卡" */
    nextTick(() => document.getElementById('lvpanel-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
}
/** ★F7 新增（用户拍板 2026-10-16）：层级专属列表视图 3/5/6 —— 同层再点收起（双向可达），
 *  收起即恢复打开列表前的 viewMode（viewMode 本就不被改，占位靠模板 v-if/v-else-if 链互斥）。 */
function onLayerList(lv: 3 | 5 | 6) {
  layerView.value = layerView.value === lv ? null : lv
  if (layerView.value) {
    layerOpen.value = null
    nextTick(() => document.getElementById('lvlist-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
}
/** 层级 4：定位到项目舱并闪一下（★F7 收窄：5/6 的定位语义由专属列表行内「定位」入口承担） */
function onLocateLayer(lv: 4) {
  layerOpen.value = null
  layerView.value = null
  activeLayer.value = lv
  ensureTower(`定位第 ${lv} 层`).then(() => {
    document.querySelector('[data-tower]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    showToast('第 4 层 · 每个项目一个独立舱，色条即项目身份')
  })
}
/** ★F7 列表行「定位」：关列表回项目塔，定位到该行所属项目舱（与左栏项目导航同一入口 gotoTower） */
function onListLocate(projId: string, label: string) {
  layerView.value = null
  nextTick(() => { gotoTower(projId); showToast(`${label} · 已定位所属项目舱`) })
}
/** 战略目标过滤：芯片 / 目标卡 / 分组头 三处同源 */
function onDirFilter(id: string) {
  dirFilter.value = dirFilter.value === id ? '' : id
  const nm = dirFilter.value
    ? (d.value.compass.directions.find(x => x.id === id)?.name || '')
    : ''
  showToast(nm ? `已聚焦「${nm}」· 其余目标的项目舱已隐藏` : '已恢复全部战略目标')
  if (nm) nextTick(() => document.querySelector('.dir-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function toggleRiskOnly() {
  riskOnly.value = !riskOnly.value
  showToast(riskOnly.value ? '只看断链：缺任务指标 + 无归属任务' : '已恢复全部内容')
}
/** 跳到第一条无归属收容区（全景下则先把主体切到那个有缺口的项目，再进全景的收容泳道） */
function gotoOrphans() {
  riskOnly.value = false
  /* 优先在当前全景主体里找 —— 不然会出现"点了收容却跳去别的项目"的错觉 */
  const pool: ProjectMeta[] = viewMode.value === 'pano' && panoId.value
    ? compassMeta.value.byProject.get(panoId.value)
      ? [compassMeta.value.byProject.get(panoId.value) as ProjectMeta]
      : []
    : compassMeta.value.dirs.flatMap(g => g.projects)
  const hit = pool.find(p => p.orphanTasks.length) || compassMeta.value.dirs.flatMap(g => g.projects).find(p => p.orphanTasks.length)
  if (!hit) { showToast('当前没有无归属任务'); return }
  openPano(hit.id)
  nextTick(() => {
    const el = document.querySelector('.lane.orph')
    if (!el) { showToast('已切到该项目 · 它没有无归属任务'); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('w11-flash')
    setTimeout(() => el.classList.remove('w11-flash'), 1400)
    showToast(`${hit.orphanTasks.length} 条任务在本项目内但没挂任何成功指标 · 泳道区最右侧的红色收容道`)
  })
}
/** 断链清单：报数 + 导出（口径来自集中取数，与骨架条同源） */
function showRiskReport() {
  const lines: string[] = ['# 方向台断链清单（W11）', '']
  for (const g of compassMeta.value.dirs) {
    for (const pm of g.projects) {
      if (!pm.risk) continue
      const p = findProject(pm.id)
      lines.push(`## ${g.dir.name} › ${p?.name || pm.id}`)
      for (const m of pm.metrics) {
        if (m.orphanMetric) lines.push(`-  指标「${m.title}」零任务（验收：${m.acceptance || '未写'}）`)
      }
      for (const t of pm.orphanTasks) lines.push(`-  任务「${t.title}」未挂任何成功指标`)
    }
  }
  if (lines.length === 2) { showToast('当前无断链'); return }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `方向台断链清单_${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(a.href)
  showToast(`已导出断链清单（${compassMeta.value.counts.risk} 处）`)
}
/** 任务成熟度详情（从任务行的小徽标点进来） */
function showTaskGrade(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const m = taskMaturity(t)
  showToast(`${m.grade} · ${m.label}${m.reasons.length ? '｜' + m.reasons.slice(0, 3).join('；') : '｜四维齐备'}`)
}
/** 给无归属任务挂指标：进任务抽屉让用户选，本函数只做引导（写入口径唯一在任务侧） */
function bindOrphan(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  showToast(`「${t.title.slice(0, 14)}」尚无成功指标：请先在指标卡里新建一条，或用任务详情挂载`)
}

function toggleMetric(id: string) {
  if (expandedMetrics.value.has(id)) expandedMetrics.value.delete(id)
  else expandedMetrics.value.add(id)
}

// ---- 编辑状态（contenteditable方案）----
const editingField = ref<string | null>(null)

function startEdit(field: string, e: MouseEvent) {
  e.stopPropagation()
  editingField.value = field
  nextTick(() => {
    const el = document.querySelector('[data-edit="' + field + '"]') as HTMLElement | null
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

function saveEdit(field: string, e: FocusEvent | KeyboardEvent) {
  const el = e.target as HTMLElement
  const val = el.innerText.trim()
  if (!val) {
    // 恢复原值
    editingField.value = null
    return
  }
  if (field === 'vision') {
    visionText.value = val
  } else if (field === 'mission') {
    missionText.value = val
  } else {
    const [type, id] = field.split('-')
    if (type === 'dir') {
      const dir = d.value.compass.directions.find(x => x.id === id)
      if (dir) dir.name = val
    } else if (type === 'proj') {
      const p = allProjects().find(x => x.id === id)
      if (p) p.name = val
    } else if (type === 'metric') {
      for (const dir of d.value.compass.directions) {
        for (const proj of dir.projects) {
          const m = proj.metrics.find(x => x.id === id)
          if (m) { m.title = val; break }
        }
      }
    } else if (type === 'task') {
      const t = d.value.tasks.find(x => x.id === id)
      if (t) { t.title = val; t.updatedAt = Date.now() }
    }
    store.persist()
  }
  editingField.value = null
  showToast('已保存')
}

function cancelEdit() {
  editingField.value = null
}

// ---- CRUD（不自动进入编辑模式）----
function addDirection() {
  const dir: Direction = {
    id: uid('dir'),
    name: '新战略目标',
    status: 'active',
    term: 'mid',
    projects: []
  }
  d.value.compass.directions.push(dir)
  store.persist()
  showToast('战略目标已创建，点击标题编辑')
}

/**
 * R85（T0-B）：改调共享 `addProjectToDir`——改前这里**缺 `pinned` 与 `order`**，
 * 导致方向树新建的项目在主航线排序（`chipsOf` 的 `a.order ?? 999`）里永远排在最后。
 * 「新攻坚项目」这个默认名是方向树的既有行为，保留（改名属范围外）。
 */
function addProject(dirId: string) {
  const proj = addProjectToDir(dirId, '新攻坚项目')
  if (proj) showToast('项目已创建')
}

/** R108（T2）：战略目标 · Markdown 模板批量导入——项目/指标/任务一次生成。
 *  同名跳过在写入层执行（需要本目标上下文）：同名项目整体跳过（幂等防重复导入），
 *  同名指标/任务在各自层级跳过；确认前弹窗内已可见全部将创建的结构（预览即确认）。 */
const goalImport = ref<{ open: boolean; dirId: string; dirName: string }>({ open: false, dirId: '', dirName: '' })
function openGoalImport(dir: Direction) {
  goalImport.value = { open: true, dirId: dir.id, dirName: dir.name }
}
function confirmGoalImport(payload: { goal?: GoalParseResult }) {
  const g = payload.goal
  if (!g) return
  const dir = d.value.compass.directions.find(x => x.id === goalImport.value.dirId)
  if (!dir) { showToast('未找到目标战略目标'); return }
  let pc = 0, mc = 0, tc = 0, sk = 0
  for (const p of g.projects) {
    let proj: Project | undefined = dir.projects.find(x => x.name === p.name)
    if (proj) { sk++; continue }
    const created = addProjectToDir(dir.id, p.name)
    if (!created) { sk++; continue }
    proj = created
    pc++
    for (const m of p.metrics) {
      let met = proj.metrics.find(x => x.title === m.name)
      if (met) { sk++; continue }
      met = { id: uid('met'), title: m.name, taskIds: [] }
      proj.metrics.push(met)
      mc++
      for (const t of m.tasks) {
        if (d.value.tasks.some(x => !x.deletedAt && x.projectId === proj!.id && x.metricId === met!.id && x.title === t.name)) { sk++; continue }
        const task: TaskCard = {
          id: uid('task'), kind: 'task', title: t.name,
          projectId: proj.id, metricId: met.id,
          status: 'todo', priority: 'medium',
          description: t.detail || undefined,
          tags: [], customFields: {}, pinned: false,
          createdAt: Date.now(), updatedAt: Date.now()
        }
        d.value.tasks.unshift(task)
        met.taskIds.push(task.id)
        tc++
      }
    }
  }
  store.persist()
  goalImport.value.open = false
  showToast(`已导入：项目 ${pc} · 指标 ${mc} · 任务 ${tc}${sk ? `（跳过同名 ${sk}）`: ''}`)
}

/** ★F2（2026-10-15）：项目层模板导入 —— 入口在项目舱「⋯」菜单与全景项目头 📋。
 *  解析粒度比 R108 下移一级（# 成功指标 / ## 任务），项目名恒等于当前项目，不新建项目。
 *  幂等口径与 R108 同源：同名指标在本项目内跳过、同名任务在各自指标内跳过。 */
const projImport = ref<{ open: boolean; projId: string; projName: string }>({ open: false, projId: '', projName: '' })
function openProjImport(projId: string) {
  const proj = allProjects().find(x => x.id === projId)
  if (!proj) { showToast('项目已不在'); return }
  projImport.value = { open: true, projId, projName: proj.name }
}
function confirmProjImport(payload: { proj?: import('@/shared/utils/mdImport').ProjImportResult }) {
  const g = payload.proj
  if (!g) return
  const proj = allProjects().find(x => x.id === projImport.value.projId)
  if (!proj) { showToast('项目已不在'); return }
  let mc = 0, tc = 0, sk = 0
  for (const m of g.metrics) {
    let met = proj.metrics.find(x => x.title === m.name)
    if (met) { sk++; continue }
    met = { id: uid('met'), title: m.name, taskIds: [] }
    proj.metrics.push(met)
    mc++
    for (const t of m.tasks) {
      if (d.value.tasks.some(x => !x.deletedAt && x.projectId === proj.id && x.metricId === met!.id && x.title === t.name)) { sk++; continue }
      const task: TaskCard = {
        id: uid('task'), kind: 'task', title: t.name,
        projectId: proj.id, metricId: met.id,
        status: 'todo', priority: 'medium',
        description: t.detail || undefined,
        tags: [], customFields: {}, pinned: false,
        createdAt: Date.now(), updatedAt: Date.now()
      }
      d.value.tasks.unshift(task)
      met.taskIds.push(task.id)
      tc++
    }
  }
  store.persist()
  projImport.value.open = false
  showToast(`已导入：指标 ${mc} · 任务 ${tc}${sk ? `（跳过同名 ${sk}）`: ''}`)
}
/** R85（T0-A）：store 现返回结构化结果（超限会被拒绝），由调用方 toast——方向树此前无任何提示 */
function onToggleFocus(id: string) {
  showToast(toggleFocusProject(id).msg)
}

function addMetric(projId: string) {
  const proj = allProjects().find(x => x.id === projId)
  if (!proj) return
  const metric: Metric = {
    id: uid('met'),
    title: '新成功指标',
    taskIds: []
  }
  proj.metrics.push(metric)
  store.persist()
  expandedMetrics.value.add(metric.id)
  showToast('指标已创建')
}

/** ★F1：删除成功指标 —— 四视图共用真源流程（报数确认 → 摘除 → 撤销），本函数只接线。
 *  指标卡 hover 🗑、「⋯」菜单都走这里；项目舱菜单不放指标删除（菜单只管项目级动作）。 */
function delMetricById(metricId: string) {
  void removeMetricWithConfirm(d.value, metricId, () => store.persist())
}

/** 第卅三轮 REQ-016：添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAdd = ref<{ metricId: string; projId: string } | null>(null)
function openTaskAdd(metricId: string, projId: string) {
  taskAdd.value = { metricId, projId }
}
/** R51-B6：创建成功后直接打开详情抽屉 */
const detailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function onTaskCreated(t: TaskCard) { detailRef.value?.open(t) }
/** ★W12-C：任务行 / 项目塔任务标题单击 → 右侧滑出任务详情抽屉。
 *  修的是「抽屉在位却永远没人叫它」这个接线缺失——此前 `detailRef.open()` 的唯一调用点
 *  是 `onTaskCreated`（新建任务成功后），于是用户点任务行、点「详情」都没反应
 *  （2026-10-13 真机反馈）。项目塔与全景两条路径都走这一处，单一实现。 */
function openTaskDetail(taskId: string): void {
  const t = d.value.tasks.find((x) => x.id === taskId)
  if (!t) { showToast('该任务已不在'); return }
  detailRef.value?.open(t)
}
/* 项目 → 指标 → 任务连续下钻：
   指标详情由本页单一实例承载，项目详情里的指标行也走这里，
   不另造一套指标详情。Esc 层级由 Drawer.vue 的抽屉栈统一裁决。 */
const metricDetailId = ref<string | null>(null)
const metricDetailOpen = ref(false)
function openMetricDetail(metricId: string) {
  if (!findMetric(metricId)) { showToast('该指标已不在'); return }
  metricDetailId.value = metricId
  metricDetailOpen.value = true
}
const taskAddMetricTitle = computed(() => {
  if (!taskAdd.value) return ''
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === taskAdd.value!.metricId)
      if (m) return m.title
    }
  }
  return ''
})

function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  t.status = t.status === 'done' ? 'todo' : 'done'
  t.completedAt = t.status === 'done' ? Date.now() : undefined
  t.updatedAt = Date.now()
  store.persist()
}

/** R146（回退契约）：删节点先报数确认、删后 3 秒可撤销（真源 compassCrud，四视图同一口径） */
const NODE_KIND: Record<string, CompassNodeKind> = { dir: 'direction', proj: 'project', metric: 'metric' }
function nodeNameOf(type: string, id: string): string {
  for (const x of d.value.compass.directions) {
    if (type === 'dir' && x.id === id) return x.name
    for (const p of x.projects) {
      if (type === 'proj' && p.id === id) return p.name
      if (type === 'metric') { const m = p.metrics.find(y => y.id === id); if (m) return m.title }
    }
  }
  return ''
}
async function deleteNode(type: string, id: string) {
  const kind = NODE_KIND[type]
  if (!kind) return
  const name = nodeNameOf(type, id)
  const c = compassNodeCounts(d.value, kind, id)
  const tail = kind === 'direction' ? `\n其下 ${c.projects} 个项目 · ${c.metrics} 个指标 · ${c.tasks} 个任务将一并摘除`
    : kind === 'project' ? `\n其下 ${c.metrics} 个指标 · ${c.tasks} 个任务将一并摘除`
    : (c.tasks ? `\n其下 ${c.tasks} 个任务将回落「未关联指标」（任务本体不删）` : '\n该指标下还没有任务')
  if (!(await useConfirm({ title: `删除${c.label}`, message: `确定删除${c.label}「${name}」？${tail}`, confirmText: '确认删除' }))) return
  const snap = removeCompassNode(d.value, kind, id)
  if (!snap) { showToast('该节点已不存在'); return }
  store.persist()
  showToast(`已删除${c.label}「${name.slice(0, 14)}」`, { label: '撤销', cb: () => {
    if (restoreCompassNode(d.value, snap)) { store.persist(); showToast(`已恢复${c.label}「${name.slice(0, 14)}」`) }
    else showToast(`上级节点已不在，无法单独恢复「${name.slice(0, 14)}」`)
  } })
}
/** R141（反馈 #1）：指标下任务行的 ✕ = 解绑回任务调度模块，删除本体收进任务详情 */
function unbindTask(task: TaskCard) {
  unbindTaskFromMetric(d.value, task)
  store.persist()
  showToast(`已从本指标移除：「${task.title.slice(0, 16)}」回到任务调度模块`)
}

/** V3.9.15：方向台任务行直接软删进回收站；软删无需二次确认，回执保留撤销。 */
function deleteTaskDirect(taskId: string) {
  const task = d.value.tasks.find(t => t.id === taskId)
  if (!task || task.deletedAt) return
  const projectId = task.projectId
  const metricId = task.metricId
  const linkedMetricIds = new Set<string>()
  for (const dir of d.value.compass.directions) {
    for (const project of dir.projects) {
      for (const metric of project.metrics) {
        if (metric.taskIds.includes(taskId)) linkedMetricIds.add(metric.id)
      }
    }
  }
  if (metricId) linkedMetricIds.add(metricId)
  softDeleteTaskToTrash(d.value, task)
  const deletedAt = task.deletedAt
  store.persist()
  showToast(`已删除「${task.title.slice(0, 18)}」· 可在回收站恢复`, {
    label: '撤销',
    cb: () => {
      const current = d.value.tasks.find(t => t.id === taskId)
      // 只撤销这一次删除；若任务已在回收站被恢复或再次删除，回执不应改写后来的状态。
      if (!current || !current.deletedAt || current.deletedAt !== deletedAt) return
      current.deletedAt = undefined
      current.updatedAt = Date.now()
      for (const dir of d.value.compass.directions) {
        for (const project of dir.projects) {
          for (const metric of project.metrics) {
            if (linkedMetricIds.has(metric.id) && !metric.taskIds.includes(current.id)) metric.taskIds.push(current.id)
          }
        }
      }
      if (projectId && !current.projectId) current.projectId = projectId
      if (metricId && !current.metricId) current.metricId = metricId
      store.persist()
    },
  })
}

/* ★W11 二批清账：tasksForMetric() / metricTaskRows() 已退役。
   它们是"任务数据在视图里现算"的最后一处残留 —— W11 集中取数层（compassMeta.ts）落地后，
   指标的任务列表、总数、完成数、状态点全部走 byMetric 的 O(1) 取值。
   ★为什么必须真删而不是留着：留着的唯一后果是"以后有人顺手又用回它"，
   于是那 6 次/指标 的 filter+sort 悄悄复活，而回归/typecheck/build 全绿。
   同批 R166 定案 1 已把 flattenTaskTree 展平退役；metricTaskRows 当时的转发壳一并归零。 */

// ---- 停滞检测 ----
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
const activeLayer = ref(1)
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
import { onOpenDrawer } from '@/shared/utils/bus'
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
</script>

<template>
  <div class="compass-layout" :class="{ 'is-pano': viewMode === 'pano' }">
    <!-- ══ W12 HERO 区（V3.8.22 F6 收口）：上=动作行（视图切换主焦点 + 两枚常驻开关），下=读数行（左对齐） ══
         ★V3.8.20（用户拍板 2026-10-15）：左上标题文案区（.hero-l：面包屑/眉标/大标题/副标 + N4 就地编辑）
         整块退役 —— 方向台是工作台面不是宣传页，首屏直接给「动作 + 状态」；定调语由骨架条
         .spine-h「战略骨架 · 上层定方向 · 下层见动作」承担，不摆两处。
         健康度徽章并入读数行首位（原在左栏标题下，N13 的意图是"状态不参与动作区竞争"，
          挪到读数行同样满足 —— 它与计数同属"这页现在什么状况"）。
          ★F6（2026-10-16 二次翻转）：「全部展开/收起」「👁 已完成」恢复动作行常驻，⚙ 下拉整壳退役。
          ★fromProjId / goBack / Esc 返回保留（R54-A1 深链来路感知），来路文本随行显示。 -->
    <section class="hero" aria-label="方向台状态与操作">
      <div class="hero-acts">
        <!-- ★V3.9.7：项目塔 / 项目全景的选择已移到下方项目模块。页头只保留全页级别操作。 -->
        <span v-if="fromProjName" class="hero-from">来自项目「{{ fromProjName }}」</span>
        <!-- ★C2（V3.8.33 B5-c）：筛选态提示条从画布内提到这里，压成 hero 动作行里的一枚胶囊。
             病根＝它原来横在引导条与项目舱之间，把树区从中间拦了一刀；而它本质是"当前视图正被什么收窄"，
             属于页头状态，不属于树内容。移走后树区从引导条到舱列一路连续，主角面才立得住。
             能力一件不少：只要任一筛选开着就常驻（隐形筛选会让人以为项目丢了），命中数照旧，清除出口照旧（W11-9）。 -->
        <div v-if="dirFilter || riskOnly" class="hero-filter" role="status">
          <span class="hf-t">
            <template v-if="dirFilter">只看战略目标「{{ dirFilterName }}」</template>
            <template v-if="dirFilter && riskOnly"> · </template>
            <template v-if="riskOnly"><Icon name="warn" :size="12"/> 只看断链</template>
          </span>
          <span class="hf-n">命中 {{ towerGroups.length }} 个目标 · {{ towerGroups.reduce((s, g) => s + g.projs.length, 0) }} 个项目舱</span>
          <button class="hf-clear" title="清除全部筛选，恢复完整视图" @click="clearFilters"><Icon name="x" :size="12"/> 清除筛选</button>
        </div>
        <div class="hero-tools">
          <!-- ★F6 翻转（用户拍板 2026-10-16，二次翻转 V3.8.20 N11 收纳决策）：「↕ 展开/收起」「👁 已完成」
               从 ⚙ 工具下拉恢复为动作行常驻按钮——高频操作变两跳 + 状态开关藏菜单后当前状态不可见。
               视图切换仍是实底唯一主焦点（N10 不撤销），两枚为次级 tree-tool 形态；⚙ 下拉整壳退役。
               ★V3.8.18（N11）语义保留：反向开关自带当前状态，点一次反向，正反都可达（不做单向门）。
               ★W12-E 退役带备案（用户 2026-10-13 拍板 C1「只删入口」）：「← 返回项目详情」按钮退役，
               但 fromProjId / goBack / Esc 返回**保留**——那是「从项目详情深链进来后按 Esc 送回原处」的
               来路感知（R54-A1），不是"进项目详情"的入口，两者语义不同。 -->
          <button class="tree-tool"
            :title="allExpanded ? '当前：全部展开。点击收起全部战略目标与指标' : '当前：默认收起。点击展开全部层级'" @click="toggleAllNodes"><Icon name="arrowupdown" :size="13"/> {{ allExpanded ? '全部收起' : '全部展开' }}</button>
          <button class="tree-tool" :class="{ off: !showDone }" @click="toggleShowDone"
            title="与方向台页头同一开关（同一偏好，一处切换全台生效）"><Icon name="eye" :size="13"/> 已完成项目：{{ showDone ? '显示' : '隐藏' }}</button>
        </div>
        <!-- ★V3.9.15（用户 2026-10-23 拍板）：读数并入动作行，页头只占一条状态带。
           健康度与八项计数仍在原位置语义上（方向台第一眼判断现状），但不再另起一行，
           把省下的 40px 留给下方项目塔。 -->
        <div class="hero-stats">
        <!-- ★C1（V3.8.28）：每个读数都要能悬停看到口径 —— 镜面不评价，但必须说清这个数字怎么来的
             （A2 同一口径：数值 + 单位 + 口径 tooltip）。 -->
        <span class="dhi-badge" :class="dhiStatus.cls"
          title="方向健康度 = 未停滞的战略目标数 ÷ 战略目标总数（某个目标下最近一次任务更新距今超过 14 天，记为停滞）· 只描述现状，不是评分">
          <span aria-hidden="true"><Icon name="compass" :size="13"/></span>
          <span>方向健康度：{{ dhiStatus.label }}</span>
        </span>
        <i class="hs-sep" aria-hidden="true"></i>
        <span title="愿景 = 终极方向（第 1 层），全库一条">愿景 {{ compassMeta.counts.vision }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="使命 = 行动准则（第 2 层），由愿景派生">使命 {{ compassMeta.counts.mission }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="战略目标 = 第 3 层方向数（使命下拆解出的推进方向）">战略目标 {{ treeStats.dirs }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="项目 = 第 4 层攻坚项目数 · 仅统计当前可见项目（受「已完成项目：显示/隐藏」影响）">项目 {{ treeStats.projects }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="主攻 = 标记为战略重心的可见项目数（上限 2 个）"><Icon name="main-focus" :size="13"/> 主攻 {{ treeStats.focused }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="停滞 = 近 14 天无任务推进、且已有任务的可见项目数"><Icon name="stall" :size="13"/> 停滞 {{ treeStats.stalled }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="指标 = 第 5 层成功指标数 · 与「项目」同口径，只统计当前可见项目下的指标">指标 {{ treeStats.metrics }}</span><i class="hs-sep" aria-hidden="true"></i>
        <span title="任务 = 第 6 层任务数 · 全库未删除任务都算（含尚未挂到项目的）">任务 {{ treeStats.tasks }}</span>
        </div>
      </div>
    </section>

    <!-- ══ ★V3.8.18（N14）战略骨架条提到全宽 ══
         原型首屏顺序是「战略骨架在上 → 下方才是左右结构」；实际实现把骨架条塞在右列
         （.canvas-inner）里，于是左导航与骨架条**并排起排**，左栏那 210px 从骨架条高度
         就开始往下悬着、下面全空。本次把骨架条从右列抽出来横跨整个内容宽度单独成条 ——
         它是「这一页的地图」，本就不该被当成右列里的一个区块；下方 .tree-layout 才是「左导航 + 右内容」。
         ★能力一项未少：六层按钮 / 目标芯片 / 断链行与 @locate 定位逻辑原封不动，
         只是挂载点从右列换到全宽条；定位滚动仍作用于 .canvas（onLocateLayer 走 canvasEl）。
         ★W12-2 判据「骨架条在层级面板之前」依然成立（全宽条仍在 .canvas-inner 之前）。 -->
    <div class="spine-bar">
      <CompassSpine
        :meta="compassMeta"
        :dir-filter="dirFilter"
        :layer-open="layerOpen"
        :layer-view="layerView"
        :risk-only="riskOnly"
        @layer="onLayerOpen"
        @list="onLayerList"
        @locate="onLocateLayer"
        @dir="onDirFilter"
        @risk="toggleRiskOnly"
        @orphan="gotoOrphans"
        @risk-bar="showRiskReport"
      >
        <!-- ★V3.8.18（N12）：「＋战略目标」「建议目标」落到骨架条第 3 层旁边。
             它们本来就是第 3 层的操作，此前摆在一排全局按钮里，用户得先跨过视图切换才够得到。 -->
        <template #actions>
          <button class="tree-tool accent" @click="addDirection" title="添加战略目标">＋ 战略目标</button>
          <span class="node-action ai-chain-act" title="AI 依愿景/使命建议本阶段战略目标（同层查重后采纳才创建）" @click="aiChain('directions', '')"><AiEntryButton variant="inline" label="建议目标" /></span>
        </template>
      </CompassSpine>
    </div>

    <!-- ══ 视觉聚焦条（方向台优化）：把"当前主攻 / 推进到哪 / 下一步"收成一条摘要 ══
         为什么加：原首屏把注意力先给了页头读数与六层导航，真正要动手的项目要往下滚才看得见。
         这条不是新模块，而是项目塔里那个主攻项目的一行投影 —— 数据全部取自 towerGroups，
         点击直接定位到对应舱，与左栏项目导航是同一个 gotoTower 入口（不新增第二条路）。 -->
    <section v-if="focusTower && viewMode === 'tower' && !layerView" class="focus-strip" aria-label="当前主攻">
      <span class="fs-label">{{ focusTower.proj.isFocused ? '当前主攻' : '当前项目' }}</span>
      <button class="fs-name" :title="`定位到项目舱：${focusTower.proj.name}`" @click="gotoFocusTower">{{ focusTower.proj.name }}</button>
      <span class="fs-detail">{{ focusTower.dir.name }} · {{ focusTower.meta.metrics.length }} 指标 · {{ focusTower.meta.total }} 任务</span>
      <span class="fs-progress" aria-hidden="true"><i :style="{ width: focusTower.meta.pct + '%' }" /></span>
      <span class="fs-count">{{ focusTower.meta.done }} / {{ focusTower.meta.total }} 项任务</span>
      <button class="fs-go" @click="gotoFocusTower">继续推进 ↓</button>
    </section>

    <!-- 画布：左栏 = 项目导航（原型 .navside，吸顶常驻），右侧 = 项目塔 -->
    <div class="tree-layout" :class="{ 'is-pano': viewMode === 'pano' }">
      <!-- ★W12：左栏由「六层数字目录」改为「项目导航」。
           病根＝六层目录是 1~6 的纯数字，看不出层级关系；而原型的 .navside 是**项目清单**
           （序号 + 项目名 + 指标/任务数），滚动时自动跟随当前视野所在项目。
           六层定位能力没有丢——它本来就由骨架条的 1~6 按钮承担（点 4/5/6 定位、点 1/2/3 展开面板），
           左栏只是把同一件事重复了一遍。滚动联动从"层高亮"改为"舱高亮"。 -->
      <aside class="navside">
        <div class="ns-t">项目塔 {{ towerGroups.reduce((s, g) => s + g.projs.length, 0) }} 个舱</div>
        <!-- ★序号用**全局舱序号**（原型 .ns-idx 是 1~N 连号），不用「目标·项目」复合号：
             复合号在左栏只有 210px 宽时会挤掉项目名，而项目名才是这一栏唯一要读的东西。
             全局号还能与舱头的 tw-idx 对上，两处是同一把尺子。 -->
        <template v-for="dg in towerGroups" :key="dg.dir.id">
          <button
            v-for="(row, pi) in dg.projs"
            :key="row.proj.id"
            class="ns-item"
            :class="{ on: activeTowerId === row.proj.id }"
            :style="{ '--pc': row.hue }"
            @click="gotoTower(row.proj.id)"
          >
            <span class="ns-idx">{{ dg.i + 1 }}.{{ pi + 1 }}</span>
            <span class="ns-body">
              <span class="ns-n">{{ row.proj.name }}</span>
              <span class="ns-m">{{ row.meta.metrics.length }} 指标 · {{ row.meta.total }} 任务<span v-if="row.proj.isFocused" class="ns-f"><Icon name="main-focus" :size="13"/></span></span>
            </span>
          </button>
        </template>
        <div class="ns-hint">点任意舱直达；滚动时左侧自动跟随当前视野所在舱</div>
      </aside>
      <div class="canvas" ref="canvasEl" @scroll="onCanvasScroll">
        <div class="canvas-inner">

          <!-- ★V3.8.20：这里原有第二份 <CompassSpine>（挂在 .canvas-inner 顶部），本轮删除 ——
               它与全宽 .spine-bar 那份事件同源（@locate 都走 canvasEl），两份并存只产生双倍
               DOM 与"到底点的是哪一份"的困惑；保留的是全宽条那份（含 #actions 插槽的「＋战略目标」）。
               W12-2 判据「骨架条在层级面板之前」仍成立（spine-bar 那份在 .canvas-inner 之前）。 -->

          <!-- W11 ★层级展开面板（原型 .lvpanel）：点 1/2/3 摊开该层完整内容 + 推导链 + 下挂实体。
               再点同层收起（判据 W11-3 双向可达，绝不做单向门）。

               ★W12 结构归位（1:1 还原）：第 1/2 层的**正文**（愿景 22px / 使命 / 关联卡片 / 就地编辑）
               从"骨架条上方独占一整块常驻卡"搬进本面板的 entity 槽。
               原型的层级关系是 spine → lvpanel → towers，第 1/2 层内容只在 lvpanel 里出现；
               之前把愿景卡摆在 spine 之上，等于在六层链条之外另开了一个平级区块，
               于是首屏被一块大字卡吃掉、"逐层收窄"在版面上断掉。
               判据 W8-1 / W8-2 / W11-11 守的是"愿景仍是唯一主体且独占一行 + 重框"，
               面板位同样满足，承重未丢，只是位置回到链条之内。
               ★默认收起（layerOpen 初值 null）与原型一致：原型 .lvpanel 的 max-height 初值就是 0，
               脚本也没有默认展开的调用—— 原型首屏同样是骨架条直接接分组头。
               点骨架条「1 愿景 / 2 使命 / 3 战略目标」才滑出。判据 W12-12 钉这一条。 -->
          <CompassLayerPanel
            v-if="layerOpen"
            :meta="compassMeta"
            :layer="layerOpen"
            :dir-filter="dirFilter"
            @goto="onLayerOpen"
            @list="onLayerList"
            @locate="onLocateLayer"
            @dir="onDirFilter"
            @close="layerOpen = null"
          >
            <!-- ★第 1/2 层正文插槽：就地编辑与关联卡片能力全在这一段（判据随迁备案见上方注释） -->
            <template #entity>
              <div class="tree-level-card hero" id="layer-1">
                <template v-if="layerOpen === 1">
                  <span class="tl-badge">1 愿景 · 终极方向</span>
                  <div class="tl-text">
                    <span class="node-title editable" :class="{editing: editingField === 'vision'}" :data-edit="'vision'" :contenteditable="editingField === 'vision'"
                      @click="startEdit('vision', $event)" @blur="saveEdit('vision', $event)" @keydown.enter.ctrl.prevent="saveEdit('vision', $event)" @keydown.esc="cancelEdit">{{ visionText || '点击设定你的核心愿景…' }}</span>
                  </div>
                  <div class="tl-links">
                    <span class="proj-toggle" @click.stop="toggleLinkPop('vision')"><Icon name="link" :size="13"/> 关联卡片 <span class="link-count">{{ linkCount('vision') }}</span></span>
                    <template v-if="linkCount('vision')">
                      <span v-for="rid in linkIds('vision', 'res')" :key="'vr' + rid" class="linked-chip" :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico"><Icon name="filetext" :size="13"/></span><span class="lc-text">{{ resTitle(rid) }}</span></span>
                      <span v-for="cid in linkIds('vision', 'curio')" :key="'vc' + cid" class="linked-chip" :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico"><Icon name="bulb" :size="13"/></span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
                    </template>
                  </div>
                </template>
                <template v-else>
                  <span class="tl-badge ghost" id="layer-2">2 使命 · 行动准则</span>
                  <div class="tl-text sub">
                    <span class="node-title editable" :class="{editing: editingField === 'mission'}" :data-edit="'mission'" :contenteditable="editingField === 'mission'"
                      @click="startEdit('mission', $event)" @blur="saveEdit('mission', $event)" @keydown.enter.ctrl.prevent="saveEdit('mission', $event)" @keydown.esc="cancelEdit">{{ missionText || '点击设定你的核心使命…' }}</span>
                  </div>
                  <div class="tl-links">
                    <span class="proj-toggle" @click.stop="toggleLinkPop('mission')"><Icon name="link" :size="13"/> 关联卡片 <span class="link-count">{{ linkCount('mission') }}</span></span>
                    <template v-if="linkCount('mission')">
                      <span v-for="rid in linkIds('mission', 'res')" :key="'mr' + rid" class="linked-chip" :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico"><Icon name="filetext" :size="13"/></span><span class="lc-text">{{ resTitle(rid) }}</span></span>
                      <span v-for="cid in linkIds('mission', 'curio')" :key="'mc' + cid" class="linked-chip" :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico"><Icon name="bulb" :size="13"/></span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
                    </template>
                  </div>
                </template>
              </div>
            </template>
          </CompassLayerPanel>

          <!-- ★W12-E 退役带备案（用户 2026-10-13 拍板 C1「只删入口」）：项目塔与项目全景两个视图已能就地
         纵览一个项目的全貌，这枚「📄 项目详情」直达入口由此退役。/compass/projects 整页与其余
         消费方（⌘K 项目搜索、ProjectDetailDrawer 等）本轮不动，只是不再从方向台把用户引过去。 -->
          <!-- ★V3.8.18（N3）：三层引导带从「一排带底色的小徽章」缩成一条**极窄引导条**。
     病根＝它原来用 .tl-badge（accent 底色 + 加粗 + 圆角），和下方项目舱头是同一套视觉件，
     权重几乎一样高 —— 于是一句"3战略目标→4攻坚项目→5成功指标→6任务"的导航提示，
     抢走了本该属于"战略目标 → 项目舱"的注意力。**它是路牌，不是招牌。**
     现在只保留「层号 + 层名 + 计数 + 一句灰字说明」：字号降一档、去底色、发丝分隔，默认安静。
     ★保留 .tl-head-row 容器类名（R3-B′ 判据靠它切片定位层内区域）。 -->
<div class="tl-head-row">
            <!-- ★V3.9.7：紧贴它实际改变的项目画布，不再占页头首屏焦点。 -->
            <div class="view-seg" role="tablist" aria-label="项目视图形态">
              <button class="vs-b" :class="{ on: viewMode === 'tower' }" :aria-selected="viewMode === 'tower'" title="纵向项目舱列 · 看我在哪个位置" @click="viewMode = 'tower'; layerView = null">项目塔</button>
              <button class="vs-b" :class="{ on: viewMode === 'pano' }" :aria-selected="viewMode === 'pano'" title="横向泳道全景 · 看这一个项目的完整链路" @click="viewMode = 'pano'; layerView = null">项目全景</button>
            </div>
            <span class="gs-i"><i class="gs-n">3</i>战略目标 <b>{{ treeStats.dirs }}</b></span>
            <span class="gs-d">方向要往哪走</span>
            <span class="gs-sep" aria-hidden="true" />
            <span class="gs-i"><i class="gs-n">4</i>攻坚项目 <b>{{ treeStats.projects }}</b></span>
            <span class="gs-d">落地靠哪些舱</span>
            <span class="gs-sep" aria-hidden="true" />
            <span class="gs-i"><i class="gs-n">5</i>成功指标 <b>{{ treeStats.metrics }}</b></span>
            <span class="gs-d">怎么算做成</span>
            <span class="gs-sep" aria-hidden="true" />
            <span class="gs-i"><i class="gs-n">6</i>任务 <b>{{ treeStats.tasks }}</b></span>
            <span class="gs-d">今天动哪一件</span>
          </div>

            <!-- ★C2（V3.8.33 B5-c）：筛选态提示条已上提到 hero 动作行（页头状态，不是树内容），
                 这里不再有横幅占位 —— 树区从引导条到舱列连续，不再被拦腰截断。 -->

            <!-- ★F7 层级专属列表（用户拍板 2026-10-16）：第 3/5/6 层各占一个专属列表视图，
                 与项目塔/项目全景**互斥占位**（v-if / v-else-if 链）——打开列表即整体切换下方形态，
                 ✕ 返回或同层再点收起，viewMode 不被改所以关闭即原样恢复记忆。 -->
            <!-- ★C3（V3.8.31）：视图形态切换加 150ms 内容过渡（淡入 + 8px 上浮）。
                 病根：点「项目塔 / 项目全景」时画布是**瞬间换整体**，没有任何空间关系交代，
                 用户会以为"点错了、页面跳走了"。过渡只给**同一容器内的形态切换**，
                 路由级切换仍零动画（R13 纪律不变）。reduced-motion 下平滑降级为无动画。
                 三个分支是 v-if / v-else-if 链——Transition 每次只渲染其中一个，key 保证
                 Vue 认得出"换的是另一个形态"，否则同标签 div 会被复用、过渡不触发。 -->
            <Transition name="viewfade" mode="out-in">
            <CompassLayerList
              v-if="layerView"
              :key="'lv-' + layerView"
              :layer="layerView"
              :back-label="viewMode === 'pano' ? '全景' : '项目塔'"
              :dir-filter="dirFilter"
              :rows3="layerRows3"
              :rows5="layerRows5"
              :rows6="layerRows6"
              @close="layerView = null"
              @dir="onDirFilter"
              @locate="onListLocate"
            />

            <!-- ★W11 项目全景（横向泳道）。与项目塔同一份数据、两种投影，切换不重算。 -->
            <CompassPano
              v-else-if="viewMode === 'pano'"
              key="pano"
              :meta="compassMeta"
              :active-id="panoId"
              :diag="diagFor(panoEffectiveId)"
              :diag-stale="diagStale(panoEffectiveId)"
              @pick="panoId = $event"
              @to-tower="backToTower"
              @toggle-task="toggleTask"
              @task-grade="showTaskGrade"
              @open-detail="openTaskDetail"
              @delete-task="deleteTaskDirect"
              @open-metric="openMetricDetail"
              @add-task="(mid, pid) => openTaskAdd(mid, pid)"
              @add-metric="addMetric"
              @ai-metric="(id) => aiChain('metrics', id)"
              @bind-orphan="bindOrphan"
              @del-metric="delMetricById"
              @import-template="openProjImport"
              @diag-run="(id) => startProjectDiag(id)"
              @diag-report="(id) => openDiagReport(id)"
            />

            <!-- W11（V3.8.11）★纵向项目舱序列 —— 替换原三列并排网格（.tree-columns-grid）
                 为什么换：三列并排时项目之间只靠列边界，扫视易串行，归属靠"在哪一列"推断。
                 改成纵向舱：每舱独占容器 + 左侧 4px 色条 + 舱间 22px 间距，归属由色条与面包屑显式承担。
                 判据 W11-1 钉住"纵向舱序列存在 + .tree-columns-grid 消失"。 -->
            <!-- ★W12-E 退役带备案：下面两个视图挂载点上的 @goto-detail 绑定已随「进项目详情」入口退役一并移除（子组件已无此 emit）。
           /compass/projects 整页与 ⌘K 项目搜索等其它消费方未动，只是不再从方向台把用户引过去。 -->
            <div v-else-if="viewMode === 'tower'" class="tower-list" id="layer-4" key="tower">
              <!-- G3（V3.8.27）：方向台零方向兜底改走 EmptyState（是什么 / 怎么开始）。
                   ★C5（V3.8.37）改两处：
                   ① 图标 target → compass。原文点名 Icon(compass)：这是「还没有方向」而不是
                      「差一个目标数」——前者说的是处境，后者说的是指标，后者带考核味。
                   ② 补主行动按钮（原文验收「空态有主行动」）。
                   ★★关于 R3-B′ 的裁定（V3.8.27 曾判「不给主行动」）：
                      当初的理由是「层内再放一个＋战略目标等于开第二入口，用户不知道点哪个」。
                      这条顾虑在**非空态**成立，但零方向时不成立——页头那个按钮挂在骨架条第 3 层，
                      零方向时骨架条本身没有内容要铺，用户首屏视线落在项目塔的空态区，
                      那个按钮既不在视野内、也因为骨架空而无参照，等于「有入口但够不到」。
                      因此本批给的解法不是复制按钮，而是**主行动直接调同一个 addDirection()**：
                      同一个函数、同一 toast、同一落地位置，不存在两份实现、也不会写歪。
                      非空态下空态不渲染，R3-B′ 的顾虑照旧成立，两条纪律互不覆盖。 -->
              <EmptyState v-if="!d.compass.directions.length" size="page" icon="compass"
                title="方向台还空着"
                desc="战略目标是你真正想推进的那件事——它下面会长出项目、指标与任务。"
                hint="写下第一个战略目标，方向树就从这里长出来；想先看整体骨架，先写愿景与使命也行。"
                action-label="＋ 写下第一个战略目标" @action="addDirection" />

              <template v-for="dg in towerGroups" :key="dg.dir.id">
                <!-- 战略目标分组头：★与骨架条芯片、层级面板目标卡三处同源同色 -->
                <div class="dir-head" :class="dg.hue" :data-dir-id="dg.dir.id">
                  <div class="dh-l">
                    <!-- ★W12：原型的 .dh-i 是纯数字方块，但原型同时有一枚「N 战略目标」pill 承担
                         "这是第几层、点它即过滤"的语义。数字方块看不出层，pill 能。
                         两者合并：pill 收在左（点即过滤，与骨架条芯片同源同色），方块退为序号。 -->
                    <button class="dir-badge" :class="{ on: dirFilter === dg.dir.id }" @click.stop="onDirFilter(dg.dir.id)"
                      :title="dirFilter === dg.dir.id ? '正在只看这个目标 · 再点取消' : '只看这个战略目标的项目舱'">
                      {{ dg.i + 1 }} 战略目标
                    </button>
                    <span class="dh-i">{{ dg.i + 1 }}</span>
                    <span class="node-title editable dh-n" :class="{editing: editingField === 'dir-' + dg.dir.id}" :data-edit="'dir-' + dg.dir.id" :contenteditable="editingField === 'dir-' + dg.dir.id"
                      @click="startEdit('dir-' + dg.dir.id, $event)" @blur="saveEdit('dir-' + dg.dir.id, $event)" @keydown.enter.prevent="saveEdit('dir-' + dg.dir.id, $event)" @keydown.esc="cancelEdit">{{ dg.dir.name }}</span>
                    <span v-if="isStagnant(dg.dir)" class="stagnant-tag" title="该目标下项目近 14 天无推进"><Icon name="warn" :size="13"/> 停滞</span>
                    <MaturityBadge :m="directionMaturity(d, dg.dir)" />
                    <span class="dh-meta">{{ dg.projs.length }} 攻坚项目 · {{ dg.metaCount }} 成功指标 · {{ dg.taskCount }} 任务</span>
                    <!-- ★发丝线（原型 .dir-line）：把一行读数在右侧收口，别让按钮组孤零零吊在行尾 -->
                    <span class="dh-line" />
                  </div>
                  <div class="dh-acts" @click.stop>
                    <!-- ★V3.8.18（N5）动作**三级分层**：
                         病根＝五枚按钮共用 .node-action 的固定 22×22 方块，字号/底色/字重完全一样，
                         于是「只看我」这个**文字型**按钮被硬塞进 22px 方块里，文字逐字折行变成竖排一列
                         （真 bug，不是观感问题）。修法不是单给它加 white-space，
                         而是承认"这五枚不是同一类东西"，按操作性质分三级：
                           t1 主操作 —— 往这个目标里加东西，最常见意图
                           t2 次操作 —— 图标化能力（AI / 导入），方块形态成立
                           t3 文字型 —— 状态开关（只看我），本质是"我在哪个视图"而不是"做什么" -->
                    <span class="node-action t1" @click="addProject(dg.dir.id)" title="添加攻坚项目">＋</span>
                    <span class="node-action t2" @click="aiChain('projects', dg.dir.id)" title="AI 建议攻坚项目（补路径依赖，查重后采纳才创建）"><AiEntryButton /></span>
                    <span class="node-action t2" @click="openGoalImport(dg.dir)" title="导入模板（Markdown 批量生成项目/指标/任务）"><Icon name="filetext" :size="13"/></span>
                    <span class="node-action t3" :class="{ on: dirFilter === dg.dir.id }" @click="onDirFilter(dg.dir.id)"
                      :title="dirFilter === dg.dir.id ? '正在只看这个目标 · 再点取消' : '只看这个战略目标的项目舱'"><Icon v-if="dirFilter === dg.dir.id" name="eye" :size="13"/>{{ dirFilter === dg.dir.id ? '正在只看' : '只看我' }}</span>
                    <span class="node-action t3 danger" @click="deleteNode('dir', dg.dir.id)" title="删除目标"><Icon name="trash" :size="13"/></span>
                  </div>
                </div>

                <!-- ★项目舱列 -->
                <CompassTower
                  v-for="(row, pi) in dg.projs"
                  :key="row.proj.id"
                  :dir="dg.dir"
                  :proj="row.proj"
                  :meta="row.meta"
                  :idx="pi + 1"
                  :hue="row.hue"
                  :open="projOpen(row.proj)"
                  :open-metrics="expandedMetrics"
                  :risk-only="riskOnly"
                  :dragging="dragProj?.id === row.proj.id"
                  :drop-on="dropTargetId === row.proj.id"
                  :menu-on="projMenu === row.proj.id"
                  :editing-field="editingField"
                  :diag="diagFor(row.proj.id)"
                  :diag-stale="diagStale(row.proj.id)"
                  @diag-run="(id) => startProjectDiag(id)"
                  @diag-report="(id) => openDiagReport(id)"
                  @menu="toggleProjMenu"
                  @dragstart="(dirId, pid, ev) => { const p = findProject(pid); if (p) onProjDragStart(dirId, p, ev) }"
                  @dragover="(dirId, pid) => { const p = findProject(pid); if (p) onProjDragOver(dirId, p) }"
                  @dragleave="onProjDragLeave"
                  @drop="(dirId, pid) => { const p = findProject(pid); if (p) onProjDrop(dirId, p) }"
                  @pin="(dirId, pid) => { const dir = d.compass.directions.find(x => x.id === dirId); const p = findProject(pid); if (dir && p) toggleProjectPin(dir, p) }"
                  @focus="onToggleFocus"
                  @del="(id) => deleteNode('proj', id)"
                  @fold="(id) => { const p = findProject(id); if (p) toggleProjectFold(p) }"
                  @toggle-metric="toggleMetric"
                  @toggle-task="toggleTask"
                  @task-grade="showTaskGrade"
                  @open-detail="openTaskDetail"
                  @delete-task="deleteTaskDirect"
                  @open-metric="openMetricDetail"
                  @add-task="(mid) => { const r = findMetric(mid); if (r) openTaskAdd(mid, r.proj.id) }"
                  @unbind="(tid) => { const t = d.tasks.find(x => x.id === tid); if (t) unbindTask(t) }"
                  @ai-task="(mid) => aiChain('tasks', mid)"
                  @add-metric="addMetric"
                  @del-metric="delMetricById"
                  @import-template="openProjImport"
                  @edit-title="(mid, ev) => startEdit('metric-' + mid, ev)"
                  @save-title="(mid, ev) => saveEdit('metric-' + mid, ev)"
                  @cancel-title="cancelEdit"
                  @edit-project="() => openProjectDrawer(row.proj.id)"
                  @ai-metric="(id) => aiChain('metrics', id)"
                  @open-pano="openPano"
                  @bind-orphan="bindOrphan"
                />
              </template>
          </div>
            </Transition>

          <!-- 底部说明 -->
          <div class="footer-hint">
            <Icon name="bulb" :size="13"/> 点击标题即可编辑 · Enter 保存 / Esc 取消 · 点击指标展开/收起任务 · 空指标会亮 <Icon name="warn" :size="13"/> 警示
          </div>

        </div>
      </div>
      </div>

    <!-- R59-T4：关联卡片选择器（居中弹窗：关键词+拼音过滤 / 资源+好奇分区 / 全量滚动 / 勾选即存） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="linkModal" class="lm-mask" @click.self="closeLinkModal">
          <div class="lm-box">
            <div class="lm-head">
              <span><Icon name="link" :size="13"/> 关联卡片 · {{ linkModal.node === 'vision' ? '愿景' : '使命' }}</span>
              <span class="lm-count">已选 {{ linkCount(linkModal.node) }}</span>
              <div class="pm-close" @click="closeLinkModal">×</div>
            </div>
            <div class="lm-body">
              <input v-model="linkQ" class="lm-search" placeholder="关键词或拼音首字母过滤（如 sj）…" v-focus @keydown.esc.stop="closeLinkModal">
              <div class="link-pop-sec"><Icon name="filetext" :size="13"/> 资源卡（{{ linkCandidates('res').length }}）</div>
              <div class="lm-list">
                <label v-for="r in linkCandidates('res')" :key="r.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'res', r.id)" @change="toggleLinked(linkModal.node, 'res', r.id)">
                  <span :title="r.title">{{ r.title }}</span>
                </label>
                <div v-if="!linkCandidates('res').length" class="link-pop-empty">无匹配资源卡</div>
              </div>
              <div class="link-pop-sec"><Icon name="bulb" :size="13"/> 好奇心卡（{{ linkCandidates('curio').length }}）</div>
              <div class="lm-list">
                <label v-for="c in linkCandidates('curio')" :key="c.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'curio', c.id)" @change="toggleLinked(linkModal.node, 'curio', c.id)">
                  <span :title="c.title">{{ c.title }}</span>
                </label>
                <div v-if="!linkCandidates('curio').length" class="link-pop-empty">无匹配好奇心卡</div>
              </div>
            </div>
            <div class="lm-foot">
              <span class="lm-tip">勾选即时保存 · 单击已关联卡片可在下方芯片处查看（双击打开）</span>
              <button class="mini-btn primary" @click="closeLinkModal">完成</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- B24：关联卡片详情抽屉 -->
    <Drawer :open="!!peekData" :icon="peek?.kind === 'res' ? 'filetext' : 'bulb'" :title="peek?.kind === 'res' ? '资源卡详情' : '好奇心卡详情'" @close="peek = null">
      <template v-if="peekData">
        <div class="peek-row"><span class="peek-label">标题</span><div class="peek-val strong">{{ peekData.title }}</div></div>
        <div class="peek-row"><span class="peek-label">来源</span><div class="peek-val">{{ peekData.kind === 'res' ? peekData.src : '我的好奇心' }}{{ peekData.linkType ? ' · ' + peekData.linkType : '' }}</div></div>
        <div v-if="peekData.link" class="peek-row"><span class="peek-label">链接</span><div class="peek-val link">{{ peekData.link }}</div></div>
        <div v-if="peekData.desc" class="peek-row"><span class="peek-label">描述</span><div class="peek-val">{{ peekData.desc }}</div></div>
        <div v-if="peekData.tags.length" class="peek-row"><span class="peek-label">标签</span><div class="peek-val"><span v-for="t in peekData.tags" :key="t" class="peek-tag">#{{ t }}</span></div></div>
        <button v-if="peekData.link" class="peek-open" @click="openPeekLink"><Icon name="external" :size="13"/> 打开链接</button>
      </template>
    </Drawer>

    <!-- 第卅二轮 REQ-003：项目全景透视抽屉 -->
    <ProjectDetailDrawer :open="projDrawerOpen" :project-id="projDrawerId" enable-metric-drill @close="projDrawerOpen = false" />
    <MetricDetailDrawer :open="metricDetailOpen" :metric-id="metricDetailId" @close="metricDetailOpen = false" />

    <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
    <TaskAddDrawer :open="!!taskAdd" :metric-id="taskAdd?.metricId || ''" :project-id="taskAdd?.projId || ''"
      :metric-title="taskAddMetricTitle" @close="taskAdd = null" @created="onTaskCreated" />

  <!-- R51-B6：创建成功后直接打开详情抽屉 -->
  <TaskDetailDrawer ref="detailRef" />

    
  </div>
  <ImportTemplateModal
    :open="goalImport.open"
    mode="goal"
    :target-name="goalImport.dirName"
    @close="goalImport.open = false"
    @confirm="confirmGoalImport"
  />
  <!-- ★F2：项目层模板导入（# 成功指标 / ## 任务 —— 下移一级解析） -->
  <ImportTemplateModal
    :open="projImport.open"
    mode="project"
    :target-name="projImport.projName"
    @close="projImport.open = false"
    @confirm="confirmProjImport"
  />
  <!-- R135：罗盘链式生成评审抽屉（目标/项目/指标/任务四层建议共用） -->
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
  <!-- N2：诊断报告中央弹窗（采纳后自动顶开；过期条与导出都在组件内） -->
  <ProjectDiagnoseModal
    v-if="diagOpen"
    :open="diagOpen"
    :report="diagReport"
    :stale="diagStale(diagProjId)"
    @close="diagOpen = false"
    @rerun="rerunDiag"
  />
</template>

<style scoped>
/* ══ W12 HERO 区（V3.8.20 收口版）：上=动作行，下=读数行 ══
   ★V3.8.20（用户拍板 2026-10-15）：左文案栏（.hero-l：面包屑/眉标/大标题/副标）与
   N4 就地编辑（.cp-edit/.cp-pen）整块退役 —— 定调语由骨架条 .spine-h 承担。
   ★.hero-crumb 的消失意味着「三页页头统一 16px」在方向台侧不再有活体载体：
   R51-6 / R123-10 随翻转为「工作台/项目详情两页守 16px + 方向台侧负锚」（翻转理由在判据正文）。 */
.hero {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.hero-acts {
  display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap;
  flex: 1 1 auto; min-width: 0;
}
.hero-from { font-size: var(--fs-micro); color: var(--text-3); }
.hero-tools { position: relative; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
/* ★F6 二次翻转（2026-10-16）：.hero-tools-menu / .menu-item 下拉壳随「⚙ 工具」整壳退役，
   两枚开关回 .hero-tools 内常驻（回流下拉形态即 dead-css + 判据红）。 */

/* ★C2（V3.8.33 B5-c）：筛选态提示条并入 hero 工具行后压成胶囊。
   原来是画布内一条整宽横幅（accent 浅底 + 边框 + 12px 内边距），把引导条与舱列之间撑出一道横带；
   收进动作行后宽度由内容决定，与 view-seg、两枚 tree-tool 同一基线，页头只多一枚小件，
   树区不再被横向色块切断。三件事仍就地可见：被什么收窄（.hf-t）、命中多少（.hf-n）、怎么退出（.hf-clear）。 */
.hero-filter {
  display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 3px 4px 3px 10px; border-radius: 999px;
  background: var(--accent-light);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
}
.hf-t {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--fs-caption); font-weight: 600; color: var(--accent-ink);
}
/* 命中数是这一行的"口径"，不是结论：比筛选名弱一档（micro + text-3），读起来是注脚。
   口径里两个数字分别在 .hf-n 与骨架条计数各自成立，不合并成第三个真源。 */
.hf-n { font-size: var(--fs-micro); color: var(--text-3); }
.hf-clear {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
  background: var(--surface); border: 1px solid var(--border);
  padding: 2px 9px; border-radius: 999px; cursor: pointer; transition: all var(--dur);
}
.hf-clear:hover { color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }


/* ══ ★V3.8.18（N14）战略骨架条的全宽承载容器 ══
   .spine-bar 只负责"占满一行并给下方左右结构留出间距"，卡片本体仍是 CompassSpine 自己的
   .spine（带自己的边框/圆角/阴影）—— 容器不接管卡片样式，避免两处各画一半边框。 */
.spine-bar { margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.spine-bar .spine { margin-bottom: 0; }

/* ══ 视觉聚焦条（方向台优化）：一条摘要承担"我在哪、推进到哪、下一步" ══
   为什么用「左侧实轨 + 无底色」而不是再套一张卡：项目塔里已经有舱（卡）与指标（卡），
   首屏再叠一张强调卡，等于让容器层级先于内容说话 —— 焦点条只承担一条信息，
   所以用 3px accent 实轨 + 与页面同底色，焦点由位置和那条轨承担，不靠阴影。 */
.focus-strip {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 0 8px 12px; margin-bottom: 14px;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.fs-label {
  flex: none; font-size: var(--fs-micro); font-weight: 700; letter-spacing: .04em;
  color: var(--accent-ink);
}
.fs-name {
  font-size: var(--fs-title); font-weight: 700; color: var(--text);
  background: transparent; border: 0; padding: 0; cursor: pointer;
  font-family: inherit; text-align: left; letter-spacing: -.01em;
}
.fs-name:hover { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.fs-detail { font-size: var(--fs-micro); color: var(--text-3); }
.fs-progress {
  margin-left: auto; flex: none; width: 96px; height: 4px; border-radius: 2px;
  background: color-mix(in srgb, var(--accent) 16%, transparent); overflow: hidden;
}
.fs-progress i { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width var(--dur); }
.fs-count { flex: none; font-size: var(--fs-micro); color: var(--text-2); font-variant-numeric: tabular-nums; }
.fs-go {
  flex: none; font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 4px 9px; cursor: pointer; font-family: inherit; transition: all var(--dur);
}
.fs-go:hover { color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
@media (max-width: 800px) {
  .focus-strip { gap: 8px; padding-left: 11px; }
  .fs-progress { width: 64px; }
}
@media (max-width: 480px) {
  .focus-strip { align-items: flex-start; }
  .fs-detail { flex-basis: 100%; }
  .fs-progress { margin-left: 0; }
}

/* ══ ★V3.8.18（N3）三层引导条：极窄路牌 ══ */
.tl-head-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 14px; padding: 5px 4px;
  border-bottom: 1px solid var(--border);
}
.gs-i {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-3);
}
.gs-i .gs-n {
  width: 15px; height: 15px; border-radius: 5px; flex: none;
  background: var(--surface-2); color: var(--text-4);
  font-size: 9px; font-weight: 700; font-style: normal;
  display: flex; align-items: center; justify-content: center;
}
.gs-i b { color: var(--text-2); font-weight: 700; font-variant-numeric: tabular-nums; }
.gs-d { font-size: var(--fs-micro); color: var(--text-4); }
.gs-sep { width: 1px; height: 11px; background: var(--border); margin: 0 3px; }
.tl-head-row:hover .gs-i { color: var(--text-2); }
.tl-head-row:hover .gs-i .gs-n { background: var(--accent-light); color: var(--accent-ink); }
/* ★V3.8.20：.hero-r / .hero-meta 随左文案栏一并退役（hero 改纵向单列：acts 行 + stats 行）。
   ★F6（2026-10-16）：读数行由右对齐改**左对齐**——右对齐时健康度徽章（行首元素）被推到最右，
   视线要横跨整行才读到；健康度是这行的第一个判断，应该在视线落点上。 */
.hero-stats {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-start;
  min-width: 0; flex: 1 1 640px;
  font-size: var(--fs-micro); color: var(--text-4);
  font-variant-numeric: tabular-nums;
}
/* ★C1（V3.8.28）：分隔符由「·」中点改 1px 发丝线 —— 中点夹在 9px 读数之间像正文标点，
   发丝线才是刻度（沿用骨架条 .gs-sep 的既有语言）；gap 同时收上 8px 网格。 */
.hs-sep { width: 1px; height: 10px; background: var(--border); flex: none; }
/* 健康度徽章在读数行首位：★C1（V3.8.28）镜面口径 —— 健康度是「这页现在什么状况」，不是评分。
   原 accent 实底药丸让它在 9px 计数行里像一枚按钮/徽章，视线先落颜色再读数字；改中性浅底 +
   text-2，字号落 caption，只比计数重一档。warning 态不再用琥珀催促色：语义由「关注 / 需聚焦」
   这三个字承担，颜色不参与评价（与 A2 同批口径）。 */
.hero-stats .dhi-badge { cursor: default; }

/* ★W12：容器 padding 完全不动（`20px 36px 64px`）——
   R125「骨架 1440+36」把四页页边距拍成一条跨页一致性纪律，方向台侧的内缩就落在这条规则上；
   原型的 .page 32px 是原型自己的值，拿它覆盖会让另外三页不动的情况下方向台单独"对齐"，
   那正是 R123/R125 要挡的事。HERO 区的呼吸由 .hero 自身的 margin-bottom 承担，不动容器。 */
.compass-layout { display: block; min-height: 100%; padding: 20px 36px 64px; max-width: 1440px; margin: 0 auto; }

/* V3.9.12 项目全景工作态：保留页头与战略骨架，但把两者从“两张连续说明牌”
   压成一条状态尺。全景的主角是当前项目摘要与泳道，先验层不应先吃掉半屏。 */
.compass-layout.is-pano .hero {
  align-items: center; gap: 12px; margin-bottom: 10px;
}
.compass-layout.is-pano .hero-acts { flex: 0 1 auto; }
.compass-layout.is-pano .spine-bar {
  margin-bottom: 10px; padding-bottom: 0; border-bottom: 0;
}
.compass-layout.is-pano :deep(.spine-h) { padding: 7px 12px 6px; }
.compass-layout.is-pano :deep(.spine-hint) { display: none; }
/* V3.9.14：收起态那枚 badge 是“六层仍在”的唯一可见凭据，不能被一起藏掉。
   全景页只隐藏展开态的定位语，保留 1 愿景 · … · 6 任务的压缩摘要。 */
.compass-layout.is-pano :deep(.spine-badge:not(.compact)) { display: none; }
.compass-layout.is-pano :deep(.spine-toggle) { min-height: 28px; }
.compass-layout.is-pano :deep(.spine-b) { padding: 7px 12px 9px; gap: 7px; }
.compass-layout.is-pano :deep(.spine-lv) { min-height: 30px; padding: 5px 10px; }
.compass-layout.is-pano :deep(.spine-risk.zero) { display: none; }
.compass-layout.is-pano :deep(.spine-dirs) { gap: 5px; }
.tree-layout { display: flex; gap: 36px; align-items: flex-start; }
.link-count { font-size: var(--fs-tiny); color: var(--accent-ink); background: var(--accent-light); padding: 1px 7px; border-radius: 99px; font-weight: 600; }
/* R59-T4：关联卡片选择器（居中弹窗） */
.lm-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: var(--z-mask-lg); display: flex; align-items: center; justify-content: center; }
.lm-box { width: 520px; max-width: 94vw; max-height: 82vh; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.lm-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; font-size: 14px; font-weight: 700; color: var(--text); }
.lm-count { font-size: var(--fs-caption); font-weight: 500; color: var(--accent-ink); background: var(--accent-light); border-radius: 99px; padding: 2px 10px; }
.lm-head .pm-close { margin-left: auto; cursor: pointer; color: var(--text-3); font-size: 18px; padding: 0 4px; }
.lm-head .pm-close:hover { color: var(--text); }
.lm-body { padding: 0 18px 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; flex: 1; }
.lm-search { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px; font-size: var(--fs-body); outline: none; font-family: inherit; background: var(--surface-2); color: var(--text); margin-bottom: 6px; }
.lm-search:focus { border-color: var(--accent); }
.lm-list { max-height: 30vh; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; padding: 4px; margin-bottom: 6px; }
.lm-foot { display: flex; align-items: center; gap: 10px; padding: 10px 18px 14px; border-top: 1px solid var(--border); }
.lm-tip { flex: 1; font-size: var(--fs-caption); color: var(--text-4); }
.mini-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); border-radius: 8px; padding: 5px 12px; cursor: pointer; font-family: inherit; }
.mini-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.link-pop-sec { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 6px 4px 3px; }
.link-pop-item { display: flex; align-items: center; gap: 8px; padding: 6px 6px; border-radius: 6px; cursor: pointer; font-size: var(--fs-sub); color: var(--text-2); }
.link-pop-item:hover { background: var(--surface-2); color: var(--text); }
.link-pop-item span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link-pop-empty { padding: 12px; text-align: center; color: var(--text-4); font-size: var(--fs-sub); }
/* 第卅三轮 REQ-017：关联卡片由胶囊 chip 改为卡片形态（两行截断 + 卡片圆角） */
.linked-chip { display: inline-flex; align-items: flex-start; gap: 5px; width: 168px; min-height: 34px; padding: 6px 9px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--fs-sub); line-height: 1.45; color: var(--text-2); cursor: pointer; transition: all var(--dur-fast); overflow: hidden; }
.linked-chip:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.lc-ico { flex-shrink: 0; font-size: var(--fs-sub); }
.lc-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }
.peek-row { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--border); }
.peek-label { width: 42px; flex-shrink: 0; font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding-top: 2px; }
.peek-val { flex: 1; min-width: 0; font-size: var(--fs-body); color: var(--text); line-height: 1.6; word-break: break-all; }
.peek-val.strong { font-weight: 700; font-size: var(--fs-title); }
.peek-val.link { color: var(--accent); }
.peek-tag { display: inline-block; font-size: var(--fs-caption); color: var(--accent-ink); background: var(--accent-light); padding: 1px 8px; border-radius: 99px; margin: 0 4px 4px 0; }
.peek-open { width: 100%; margin-top: 14px; padding: 10px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; }
.peek-open:hover { background: var(--accent-hover); }
.topbar { height: 48px; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; gap: 12px; flex-shrink: 0; }
/* ★C1（V3.8.28）：健康度徽章退成药丸形"读数"——中性浅底 + text-2 字，不再用强调色实底；
   warning 态只加深一档表面，不换色相（琥珀是催促，镜面不催促）。 */
.dhi-badge { display: flex; align-items: center; gap: 5px; padding: 1px 8px; border-radius: 99px; background: var(--surface-2); font-size: var(--fs-caption); font-weight: 600; color: var(--text-2); }
.dhi-badge.warning { background: var(--surface-3); color: var(--text); }

/* 画布（左侧为项目导航预留空间） */
.canvas { flex: 1; min-width: 0; padding: 0 4px 20px; }
/* ★W12：放开原先 1000px/700px 的窄栏约束。原型 .page 是 1440px 满宽 + 210px 侧栏，
   1000px 会让右侧项目舱被压扁、舱头按钮挤成两行（就是实际截图里的那个问题）。 */
/* ★C2（V3.8.31）：树区成为「主角面」——大板 + xl 圆角 + 发丝边。
   为什么底色用 color-mix 而不是直接用 --surface：树板里躺着的项目舱/泳道/层级列表本身
   就是 --surface，直接铺 --surface 会让"卡在板上"变成"卡与板同色"，层级反而消失。
   55% 的混合在两套光向（暗色提亮 / 亮色压灰）下都与 bg 有可辨差、又不吃掉卡的亮度。
   圆角取 xl（18）是本页层级的第一档，C4 的「板 xl / 舱 lg / 子卡 sm」从这里往下排。 */
.canvas-inner {
  max-width: 1180px; margin: 0;
  background: color-mix(in srgb, var(--surface) 55%, var(--bg));
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 18px 20px 20px;
}

/* ══ W12 左侧项目导航（原型 .navside）：项目清单 + 滚动跟随高亮 ══
   ★V3.8.18（N15）吸顶常驻**本轮复核为已满足**：sticky + align-self:flex-start + top 偏移
   三件套齐备（align-self 不加的话 flex 子项会按默认 stretch 拉满高度，sticky 直接失效，
   这是 sticky 在 flex 布局里最常见的静默失效原因）。骨架条提到全宽后 .tree-layout 整体下移，
   吸顶基准不变，仍以视口顶为参照 —— 项目舱涨到 20+ 时左栏也不会把地图推到屏幕外。
   max-height + overflow-y 同时在位：舱数多到超过一屏时左栏自己滚，不把整页撑出第二条滚动条。 */
.navside {
  position: sticky; top: 16px; align-self: flex-start;
  width: 176px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 8px;
  max-height: calc(100vh - 120px); overflow-y: auto;
}

/* 响应式：保留“左项目导航 + 右方向画布”的架构，只按可用宽度逐级压缩。
   1024 先收页边距和列间距；800 以下左栏改为横向项目条，避免 176px 常驻把主画布挤窄；
   390 下所有工具与读数允许换行，不出现横向滚动。 */
@media (max-width: 1100px) {
  .compass-layout { padding-left: 24px; padding-right: 24px; }
  .compass-layout.is-pano .hero {
    align-items: flex-start; gap: 8px;
  }
  .tree-layout { gap: 24px; }
  .navside { width: 160px; }
}
/* 项目全景已有自己的项目切换器；左栏项目清单只服务项目塔，继续常驻会多出一套重复导航。 */
.tree-layout.is-pano { display: block; }
.tree-layout.is-pano .navside { display: none; }
/* 全景没有左栏，画布应吃满 1440 页轴；沿用项目塔的 1180px 上限会在右侧留下整片空板。 */
.tree-layout.is-pano .canvas-inner { width: 100%; max-width: none; }
@media (max-width: 800px) {
  .compass-layout { padding: 16px 16px 48px; }
  .tree-layout { display: block; }
  .navside {
    position: static; width: 100%; max-height: none;
    flex-direction: row; gap: 6px; overflow-x: auto;
    padding-bottom: 8px; margin-bottom: 14px;
    scroll-snap-type: x proximity;
  }
  .navside .ns-t, .navside .ns-hint { display: none; }
  .ns-item { flex: 0 0 164px; width: 164px; scroll-snap-align: start; }
  .canvas-inner { padding: 14px 14px 16px; }
  .hero-tools { margin-left: 0; }
}
@media (max-width: 480px) {
  .compass-layout { padding: 12px 10px 40px; }
  .hero { align-items: flex-start; gap: 8px; margin-bottom: 12px; }
  .hero-acts { gap: 7px; }
  .hero-stats { flex-basis: 100%; gap: 6px; }
  .hs-sep { display: none; }
  .view-seg { width: 100%; }
  .vs-b { flex: 1; padding-left: 8px; padding-right: 8px; }
  .hero-tools { width: 100%; display: flex; flex-wrap: wrap; gap: 6px; }
  .tree-tool { flex: 1; text-align: center; }
  .canvas-inner { padding: 12px 10px 14px; border-radius: var(--radius-lg); }
  .ns-item { flex-basis: 148px; width: 148px; }
  .footer-hint { margin-top: 20px; padding: 12px 8px; }
}
.ns-t {
  font-size: var(--fs-micro); font-weight: 700; letter-spacing: .14em;
  color: var(--text-4); padding: 0 4px 6px;
}
.ns-item {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 9px 11px; border-radius: var(--radius-sm);
  background: transparent; border: 1px solid transparent;
  cursor: pointer; transition: all var(--dur); text-align: left;
  font-family: inherit; width: 100%;
}
.ns-item:hover { background: var(--surface-2); }
/* ★视觉聚焦（方向台优化）：当前项用"左侧细轨 + 纸面白底"标记，不用彩色底 + 彩色边框。
   原来选中态是一块带色边框的彩色块，未选中项在 hover 时也变色，
   一栏五六个项目扫下去最先看到的是"色块"，而不是项目名。 */
.ns-item.on {
  background: var(--surface);
  border-color: transparent;
  box-shadow: inset 2px 0 var(--pc, var(--accent));
}
.ns-idx {
  width: 20px; height: 20px; border-radius: 6px; flex: none; margin-top: 1px;
  /* 序号是刻度不是徽章：常驻中性色，选中也不反白 */
  background: transparent;
  color: var(--text-4);
  font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  font-variant-numeric: tabular-nums;
}
.ns-item.on .ns-idx { background: transparent; color: var(--text-3); }
.ns-body { min-width: 0; flex: 1; }
.ns-n {
  display: block;
  font-size: var(--fs-sub); font-weight: 700; color: var(--text-2);
  line-height: 1.4; word-break: break-word;
}
.ns-item.on .ns-n { color: var(--text); }
.ns-m {
  display: block;
  font-size: var(--fs-micro); color: var(--text-4); margin-top: 2px;
}
.ns-f { margin-left: 3px; }
.ns-hint {
  font-size: var(--fs-micro); color: var(--text-4);
  padding: 10px 11px 0; line-height: 1.7;
  border-top: 1px solid var(--border); margin-top: 4px;
}

/* ★V3.8.41（P0-1 真 census 后首次浮出的真死 CSS）：`.tree-page-head` 三条（自身 / `.crumb` /
   `.crumb .sep` / `.spacer`）与 `.tree-stats` 随 W12 页头退役即零挂载——模板里全库 `class=` 零命中。
   ★为什么此前一直"绿"：\`dead-css-scan\` 取的是「最新一个日期目录」的 census 快照，
     实测读到两周前那份，其间下线的类名仍被 census 票救活 ⇒「零死样式」是**看着绿、其实没查**。
     本批改为只认全量实拍写下的权威 census 后，它们才第一次浮出来。
   ★同族的 `.tree-tool` 三条**仍活着**（工具钮还在用），故只删上面四条，不连坐。
   ★保留下面这段备案：它记的是「16px 档在方向台侧不再有载体」这条 R51-6/R123-10 翻转理由，
     判据正文要用，删样式不许连带删掉理由。 */
/* R49-C7：顶部统计 + 展开收起/显隐工具（★V3.8.41：`.tree-stats` 随上方一并退役，同族的 `.tree-tool` 三条仍活着） */
.tree-tool { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); border-radius: 8px; padding: 5px 11px; cursor: pointer; font-family: inherit; transition: all var(--dur); white-space: nowrap; }


.tree-tool:hover { border-color: var(--accent); color: var(--accent); }
.tree-tool.off { opacity: .6; }
/* R52-F8/R54-A1：返回入口（accent 强调）+ 面包屑上级可点 */
.tree-tool.accent { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
/* R54-A3：?hl 定位闪烁 */
/* ★随迁备案（W11）：原锚 .tc-strategic-branch 三列网格已退役，改指新结构 .dir-head */
.dir-head.goal-flash { animation: treeGoalFlash 1.4s ease; }
@keyframes treeGoalFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); border-color: var(--accent); } }

/* ══ W12：.tree-page-head / .layer-toc / .lt-* 六层数字目录整族退役 ══
   ★随迁备案：① 六层目录的定位能力由骨架条 1~6 按钮承担（同一入口，不摆两处）；
   ② .tree-page-head 的密排工具行由 HERO 右栏（.hero-acts / .hero-meta / .hero-stats）接走，
      能力一项未少，只是从「一行密排」变成「两栏分组」。③ .layer-header/.layer-num/.layer-name/.layer-desc
      四条随之成为孤儿（模板零引用），本轮一并清 —— 删选择器容易，删完不跑扫描器就会留下一笔看不见的债。 */

.node .node-title { font-size: var(--fs-body); font-weight: 500; color: var(--text); line-height: 1.5; flex: 1; min-width: 0; }
.node .node-title.editable { cursor: text; outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; transition: background var(--dur); }
.node .node-title.editable:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.node .node-title.editable.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
/* R68-F4：操作按钮主题感知——原硬编码不透明白底 + 浅灰图标，深色主题（近黑画布）下对比度崩坏看不到入口 */
.node-action { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: var(--fs-caption); cursor: pointer; color: var(--text-2); transition: all var(--dur); background: var(--surface-3); border: 1px solid var(--border); }
/* R135：文字型 AI 入口（骨架条上的「知 建议目标」）—— 与 .t3 同一套文字型规则 */
.ai-chain-act { width: auto; padding: 0 8px; gap: 3px; font-size: var(--fs-caption); white-space: nowrap; }
.node-action:hover { background: var(--accent-light); color: var(--accent-ink); border-color: var(--accent); }
.node-action.danger:hover { color: var(--danger); }
/* ★V3.8.18（N5）三级分层。t1/t2 的差异只在底色与描边；t3 解除固定方块。
   ★t3 必须显式 width:auto + white-space:nowrap —— 22px 方块 + 中文字符是竖排 bug 的成因，
   文字型若继续继承 22px 就等于没修。 */
.node-action.t1 { background: var(--accent-light); color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 32%, var(--border)); }
.node-action.t1:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.node-action.t3 {
  width: auto; min-width: 22px; height: 22px; padding: 0 9px;
  white-space: nowrap; background: transparent; border-color: transparent;
  font-size: var(--fs-caption);
}
.node-action.t3:hover { background: var(--surface-3); color: var(--text); border-color: var(--border); }
.node-action.t3.on { color: var(--accent-ink); background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 32%, var(--border)); }
.stagnant-tag { background: var(--tag-danger-bg); color: var(--danger); font-size: var(--fs-micro); padding: 2px 7px; border-radius: 99px; font-weight: 500; }
.status-active { color: var(--success); }
.status-paused { color: var(--warning); }
/* R59-T3 的「主攻项目强调」（.project-node.primary / .project-node.primary .node-title）随旧树节点类族一并退役
   （R4-Ev 孤儿 CSS 第二批）——★随迁备案（W11）：主攻标记已迁到 .tower 的 is-focused 结构与 tw-badge.focus */
.metric-item.expanded { background: var(--surface); border-color: color-mix(in srgb, var(--accent) 20%, var(--border)); border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; }
.metric-status.done { background: var(--success); }
.metric-status.doing { background: var(--warning); }
.metric-status.todo { background: var(--text-3); }
.metric-name.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.metric-item.expanded .metric-expand-icon { transform: rotate(90deg); }
/* ★W11 随迁清账（2026-10-13）：下方 .task-item/.task-check/.task-text/.task-meta/.task-actions/.empty-sub 六族
   共 15 条是 R3-B2 时期的任务行样式，W11 起任务行已迁到 CompassLane 的 .tk-row（判死 13 + 祖先断 2，
   由 dead-css-scan 实跑坐实）。四票全零 = 模板零引用 + 全站 class 属性零引用 + 全站字符串零引用 + 104 场景普查零命中。
   同批不删 .metric-*（投影弹窗仍用）与 .proj-toggle/.toggle（R4-Ev① 的活体票载体，删了那条判据会假红）。 */
/* G3（V3.8.27）：零方向兜底原用的裸容器类与图标位样式，随改走 EmptyState 组件一并退役
   —— 留着会让下一个写空态的人"照着旧样式再写一遍"，正是本轮要断的那条路。 */

/* 节点链接弹窗开关（愿景/使命关联资源） */
.proj-toggle { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.toggle { position: relative; width: 30px; height: 16px; border-radius: 99px; background: var(--border-strong); cursor: pointer; transition: background .2s; flex-shrink: 0; }
.toggle.on { background: var(--accent); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.toggle.on::after { transform: translateX(14px); }

/* 底部 */
.footer-hint { margin-top: 28px; padding: 14px; text-align: center; font-size: var(--fs-caption); color: var(--text-3); line-height: 1.8; border-top: 1px solid var(--border); }

/* 动画 */
.expand-enter-active, .expand-leave-active { transition: all var(--dur) ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; margin-top: 0; padding-top: 0; }

/* ===== R121：方向树重构（对齐原型：锚点卡 + 三列分支 + 发丝缩进） ===== */
.tree-level-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 18px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 6px; }
.tl-badge { align-self: flex-start; font-size: var(--fs-caption); font-weight: 700; color: var(--accent-ink); background: var(--accent-light); padding: 2px 6px; border-radius: 4px; }
.tl-badge.ghost { background: var(--surface-2); color: var(--text-2); margin-top: 6px; }
/* ★V3.8.8 方向台焦点契约（用户拍板：主角=愿景、攻坚项目 17px）：
   原状全页最大字是页头面包屑（16px 字面量），而真内容标题「六层思维链」只有 11px（caption）
   ⇒ 层级倒置。以下五条把方向台拉回「一处主角 + 六层可辨」。判据 W8-1~W8-5 把守。

   ① 愿景 = 本页**唯一** display 级主体（语义根：产品名与 Slogan「自有我方向」都指向它） */
.tree-level-card.hero { border-color: var(--border-strong); box-shadow: var(--shadow-lg); padding: 18px 20px 16px; }
.tl-text { font-size: var(--fs-display); font-weight: 700; color: var(--text); letter-spacing: -.02em; line-height: 1.24; }
/* ② 使命降一档到 headline（它是准则不是方向本身） */
.tl-text.sub { font-size: var(--fs-headline); font-weight: 500; color: var(--text-2); line-height: 1.4; }
.tl-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--fs-sub); color: var(--text-3); }
.tl-head-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.tl-head-row > .view-seg { order: 99; margin-left: auto; }
/* ★V3.8.41（B8）：本行下方原有一条辅助提示样式判死——全库仅此一处字面量、无模板挂载点、
   判据零命中。同族的愿景正文与其副形态、链接行、头行四段仍在用，未连坐。
   ★备案：这是"删样式"与"删掉一个提示"是两回事——那条提示连同它的语义早已在层级重构里被更好的
   头部结构取代，留着样式只会在下一次 census 换真时又被捞出来，徒增一轮判死。
   同段判据仍在：.tl-text 的 display 档与其 .sub 的 headline 档由 03-w11-pyramid / 02-w8 钉死。 */

/* ── W11 视图切换段（项目塔 / 项目全景）── */
/* ★两个按钮都必须常驻可点：切过去容易、切回来难是典型的单向门。
   ★V3.8.18（N10）：改为**页头唯一主焦点** —— 容器加 accent 描边、选中态实底白字、字重 700、
   上下留白略增。理由：视图选择是这一页的第一个决策，其余页头按钮都是它的从属开关；
   六枚同权重按钮并排时没有任何一枚"是入口"，用户只能逐个试。 */
.view-seg {
  display: inline-flex; align-items: center; gap: 2px;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 999px; padding: 3px;
  box-shadow: none;
}
.vs-b {
  font-size: var(--fs-sub); font-weight: 700; color: var(--text-2);
  background: transparent; border: none; cursor: pointer;
  padding: 5px 14px; border-radius: 999px; transition: all var(--dur); white-space: nowrap;
  /* M6（B7-e · V3.8.40）：热区下限 28px（实测 26.5px）——只撑盒子，胶囊形态与字号不变 */
  min-height: 28px;
}
.vs-b:hover { color: var(--text); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.vs-b.on { color: #fff; background: var(--accent); }
/* ★C3（V3.8.31）：视图形态切换的 150ms 内容过渡。
   进：淡入 + 从下 8px 升起（新形态"从画布里长出来"）；出：淡出 + 上移 4px（旧形态退场）。
   ⚠ 只给形态切换，路由切换仍零动画；reduced-motion 下全部归零（不是"缩短到 1ms"，
     而是彻底不加过渡——前庭敏感用户要的是没有位移，不是一个看不出来的位移）。 */
.viewfade-enter-active, .viewfade-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.viewfade-enter-from { opacity: 0; transform: translateY(8px); }
.viewfade-leave-to { opacity: 0; transform: translateY(-4px); }
@media (prefers-reduced-motion: reduce) {
  .viewfade-enter-active, .viewfade-leave-active { transition: none; }
  .viewfade-enter-from, .viewfade-leave-to { opacity: 1; transform: none; }
}
/* N11 合并开关：开着时给一点 accent 提示，让"当前是展开态"一眼可见 */
/* ★V3.8.20：原 .fold-toggle（页头常驻展开收起钮）随 N11 反向开关 + 本轮工具下拉退役，
   展开态强调色下沉为通用 .tree-tool.on。 */
.tree-tool.on { color: var(--accent-ink); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); background: var(--accent-light); }

/* ── W11 筛选态提示条：已随 C2（V3.8.33）并入 hero 动作行，见上方 .hero-filter 三档 ── */
/* ══ W11：纵向项目舱序列 ══
   .tree-columns-grid 三列并排已退役（判据 W11-1 钉住它不许复活）——
   三列时项目之间只靠列边界，扫视易串行，归属靠"在哪一列"推断。 */
.tower-list { display: flex; flex-direction: column; gap: 40px; }

/* 战略目标分组头：与骨架条芯片、层级面板目标卡三处同源 */
.dir-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 0 4px 2px; margin-top: 10px;
}
.dir-head:first-of-type { margin-top: 0; }
.dh-l { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; min-width: 0; }
/* ★W12：「N 战略目标」pill（原型 .dir-badge）—— 点即过滤，与骨架条芯片同源同色。
   纯数字方块看不出"这是第几层"，pill 同时回答了"第 3 层"与"怎么过滤"两个问题。 */
.dir-badge {
  font-size: var(--fs-micro); font-weight: 700; letter-spacing: .1em;
  color: var(--text-4); background: transparent;
  border: 1px solid var(--border-strong); border-radius: 999px;
  padding: 3px 11px; cursor: pointer; transition: all var(--dur);
  font-family: inherit; white-space: nowrap;
}
.dir-badge:hover { color: var(--accent-ink); border-color: var(--accent); }
.dir-badge.on {
  color: var(--text); border-color: var(--accent);
  background: var(--accent-light);
}
/* 发丝线：把行内读数在右侧收口，动作组因此不再孤零零吊在行尾（原型 .dir-line） */
.dh-line { flex: 1; height: 1px; background: var(--border); min-width: 24px; }
.dh-i {
  width: 20px; height: 20px; border-radius: 7px; flex: none;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--text-2); font-size: var(--fs-micro); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
/* ★目标名 --fs-title(15px)：它是"分岔源头"，比项目重一档；使命/愿景仍是更高层（判据 W8-2 备案延续） */
.dh-n { font-size: var(--fs-title); font-weight: 700; color: var(--text); letter-spacing: -.01em; }
.dh-meta { font-size: var(--fs-micro); color: var(--text-3); margin-left: 2px; }
.dh-acts { display: flex; align-items: center; gap: 5px; flex: none; }
.dh-acts .node-action.on { color: var(--accent-ink); background: var(--accent-light); }

/* 层级定位闪烁：让"我点的这层实体在这儿"一眼可见 */
@keyframes w11Flash {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  22%, 62% { box-shadow: 0 0 0 3px var(--accent); }
}
.w11-flash { animation: w11Flash 1.4s ease; border-radius: var(--radius-md); }

/* ★判据 W11-13 的版式补偿（D1 拍板：愿景保持 fs-display 22px，主角感靠版式）：
   独占一行 + 上下大留白 + 强调框，三者缺一就是"只降字号不改版式"＝变相没实现。
   ★W12：外框改为「左侧 2px accent 实轨 + 大留白」——
   本块现在住在层级面板里（骨架条之下），套一层带底色的卡会变成"面板里再套一张卡"的双层框，
   主角反而被面板抢走；改用实轨后主角感由 accent 承担，且不再与面板争底色。 */
.tree-level-card.hero {
  background: transparent;
  border: none;
  border-left: 2px solid var(--accent);
  border-radius: 0;
  box-shadow: none;
  padding: 14px 0 16px 16px;
  margin-bottom: 2px;
  gap: 10px;
}

</style>
