<script setup lang="ts">
// R148-P1a：显式实例名——纳入 KeepAlive（切模块免重挂载与免重算首屏）
defineOptions({ name: 'CompassTreeView' })

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
// R146（回退契约）：罗盘节点删除走真源（确认报数 + 3 秒撤销），与策展台/项目抽屉同一口径
import { compassNodeCounts, removeCompassNode, restoreCompassNode, type CompassNodeKind } from '@/shared/utils/compassCrud'
import { useConfirm } from '@/shared/components/confirm'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { taskMaturity, metricMaturity, projectMaturity, directionMaturity } from '@/shared/utils/maturity'
import { recordResourceOpen } from '@/shared/storage/stats'
import Drawer from '@/shared/components/Drawer.vue'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
// W11（V3.8.11）战略金字塔：骨架控制条 / 层级展开面板 / 项目舱 / 项目全景 四件套（原型 v1 视觉基准）
import CompassSpine from '../components/compass/CompassSpine.vue'
import CompassLayerPanel from '../components/compass/CompassLayerPanel.vue'
import CompassTower from '../components/compass/CompassTower.vue'
import CompassPano from '../components/compass/CompassPano.vue'
import { buildCompassMeta } from './compassMeta'
import type { ProjectMeta } from './compassMeta'
import ImportTemplateModal from '../components/ImportTemplateModal.vue'
import type { GoalParseResult } from '@/shared/utils/mdImport'

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
  if (!job) { showToast('⚠ 锚点实体已不存在，请刷新后重试'); return }
  aiJob.value = job
}

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
  // R3-B1：一级台面没有上级可回——Esc 交回给浮层/浏览器默认行为
  if (!fromProjId.value) return
  if (document.querySelector('.task-sidebar, .overlay, .modal-mask')) return
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
function expandAllNodes() {
  for (const dir of d.value.compass.directions) for (const proj of dir.projects) {
    projFoldOverride.value[proj.id] = true
    expandMetricsOf(proj)
  }
  writeProjFold()
}

/** R49-C7：一键展开/收起全部（R3-B′ 起两级一起管：项目卡 + 指标） */
function collapseAllNodes() {
  for (const dir of d.value.compass.directions) for (const proj of dir.projects) projFoldOverride.value[proj.id] = false
  writeProjFold()
  expandedMetrics.value.clear()
}

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
  showToast(p.pinned ? `📌 「${p.name}」置顶到该目标前排` : '已取消置顶')
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
    metrics += dir.projects.reduce((s, p) => s + p.metrics.length, 0)
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
  showToast('横向全景 · 一根泳道就是一条成功指标')
}
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
const layerOpen = ref<1 | 2 | 3 | null>(null)
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

/** 层级 1/2/3：同层再点收起（★双向可达，判据 W11-3） */
function onLayerOpen(lv: 1 | 2 | 3) {
  layerOpen.value = layerOpen.value === lv ? null : lv
  if (layerOpen.value) {
    nextTick(() => document.getElementById('layer-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}
/** 层级 4/5/6：定位到第一处对应实体并闪一下（★先切回纵向视图，定位不许挑视图） */
function onLocateLayer(lv: 4 | 5 | 6) {
  layerOpen.value = null
  activeLayer.value = lv
  ensureTower(`定位第 ${lv} 层`).then(() => {
    if (lv === 4) {
      document.querySelector('[data-tower]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      showToast('第 4 层 · 每个项目一个独立舱，色条即项目身份')
    } else if (lv === 5) {
      const el = document.querySelector('.metric-card')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('w11-flash')
      setTimeout(() => el?.classList.remove('w11-flash'), 1400)
      showToast('第 5 层 · 成功指标成卡，任务内嵌在指标里')
    } else {
      const el = document.querySelector('.tk-row')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('w11-flash')
      setTimeout(() => el?.classList.remove('w11-flash'), 1400)
      showToast('第 6 层 · 每条任务都隶属某个成功指标，悬停看完整归属路径')
    }
  })
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
  showToast(riskOnly.value ? '⚠ 只看断链：缺任务指标 + 无归属任务' : '已恢复全部内容')
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
        if (m.orphanMetric) lines.push(`- ⚠ 指标「${m.title}」零任务（验收：${m.acceptance || '未写'}）`)
      }
      for (const t of pm.orphanTasks) lines.push(`- ⚠ 任务「${t.title}」未挂任何成功指标`)
    }
  }
  if (lines.length === 2) { showToast('✓ 当前无断链'); return }
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
  showToast('✓ 已保存')
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
  showToast('✓ 战略目标已创建，点击标题编辑')
}

/**
 * R85（T0-B）：改调共享 `addProjectToDir`——改前这里**缺 `pinned` 与 `order`**，
 * 导致方向树新建的项目在主航线排序（`chipsOf` 的 `a.order ?? 999`）里永远排在最后。
 * 「新攻坚项目」这个默认名是方向树的既有行为，保留（改名属范围外）。
 */
function addProject(dirId: string) {
  const proj = addProjectToDir(dirId, '新攻坚项目')
  if (proj) showToast('✓ 项目已创建')
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
  showToast(`✓ 已导入：项目 ${pc} · 指标 ${mc} · 任务 ${tc}${sk ? `（跳过同名 ${sk}）` : ''}`)
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
  showToast('✓ 指标已创建')
}

/** 第卅三轮 REQ-016：添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAdd = ref<{ metricId: string; projId: string } | null>(null)
function openTaskAdd(metricId: string, projId: string) {
  taskAdd.value = { metricId, projId }
}
/** R51-B6：创建成功后直接打开详情抽屉 */
const detailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function onTaskCreated(t: TaskCard) { detailRef.value?.open(t) }
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
  if (!snap) { showToast('⚠ 该节点已不存在'); return }
  store.persist()
  showToast(`已删除${c.label}「${name.slice(0, 14)}」`, { label: '撤销', cb: () => {
    if (restoreCompassNode(d.value, snap)) { store.persist(); showToast(`✓ 已恢复${c.label}「${name.slice(0, 14)}」`) }
    else showToast(`⚠ 上级节点已不在，无法单独恢复「${name.slice(0, 14)}」`)
  } })
}
/** R141（反馈 #1）：指标下任务行的 ✕ = 解绑回任务调度模块，删除本体收进任务详情 */
function unbindTask(task: TaskCard) {
  unbindTaskFromMetric(d.value, task)
  store.persist()
  showToast(`✓ 已从本指标移除：「${task.title.slice(0, 16)}」回到任务调度模块`)
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

// ---- 六层悬浮目录（左侧，快速定位 + 滚动高亮） ----
const tocItems = [
  { n: 1, name: '愿景' },
  { n: 2, name: '使命' },
  { n: 3, name: '战略目标' },
  { n: 4, name: '攻坚项目' },
  { n: 5, name: '成功指标' },
  { n: 6, name: '任务' }
]
const activeLayer = ref(1)
const canvasEl = ref<HTMLElement | null>(null)
/**
 * ★定位动作前先确保在项目塔视图。
 * 为什么要这一步：全景视图里第 4/5/6 层不再是纵向排布的 DOM（它们变成了一根根横向泳道），
 * 于是"点左侧目录第 5 层"在全景下会静默失灵 —— 目录点了没反应，看起来像坏了。
 * 正确行为是**先切回纵向再定位**（双向可达的反向：任何定位都能抵达，不挑视图）。
 */
function ensureTower(hint: string): Promise<void> {
  if (viewMode.value === 'tower') return Promise.resolve()
  viewMode.value = 'tower'
  showToast(`${hint} · 已自动切回项目塔视图`)
  return nextTick()
}
function scrollToLayer(n: number) {
  activeLayer.value = n
  if (n <= 2) {
    // 1/2 层的正文常驻 HERO 卡，定位即打开层级面板（原来只滚不展开，等于点了没反应）
    if (layerOpen.value !== (n as 1 | 2)) onLayerOpen(n as 1 | 2)
    document.getElementById('layer-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  if (n === 3) {
    if (!layerOpen.value) layerOpen.value = 3
    document.getElementById('layer-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  ensureTower(`定位第 ${n} 层`).then(() => {
    if (n === 4) {
      const el = document.querySelector('[data-tower]')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      showToast('第 4 层 · 每个攻坚项目一个独立舱，左侧色条即项目身份')
    } else if (n === 5) {
      const el = document.querySelector('.metric-card')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('w11-flash')
      setTimeout(() => el?.classList.remove('w11-flash'), 1400)
      showToast('第 5 层 · 成功指标成卡，任务内嵌在指标里')
    } else {
      const el = document.querySelector('.tk-row')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('w11-flash')
      setTimeout(() => el?.classList.remove('w11-flash'), 1400)
      showToast('第 6 层 · 每条任务都隶属某个成功指标，悬停看完整归属路径')
    }
  })
}
function onCanvasScroll() {
  /* 全景视图是横向泳道，纵向滚动不再对应六层 ⇒ 目录高亮保持不动，
     否则会随页面微滚乱跳（判据 W11-9 的一部分：联动不许制造假信号） */
  if (viewMode.value === 'pano') return
  const canvas = canvasEl.value
  if (!canvas) return
  const canvasTop = canvas.getBoundingClientRect().top
  let current = 1
  for (const item of tocItems) {
    const el = document.getElementById('layer-' + item.n)
    if (el && el.getBoundingClientRect().top - canvasTop <= 80) current = item.n
  }
  activeLayer.value = current
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
  <div class="compass-layout">
    <!-- 六层悬浮目录 -->

      <div class="tree-page-head">
        <!-- R3-B1：树升一级——面包屑由「方向台 / 完整方向树」收成「方向台」，六层全深度成了台面本身 -->
        <div class="crumb"><b>方向台</b> · 六层思维链全深度<span v-if="fromProjName"> · 来自项目「{{ fromProjName }}」</span></div>
        <div class="spacer"></div>
        <!-- R54-A1：来源感知返回（?from=proj&p= 进来才有「返回项目详情」；一级台面不放返回钮） -->
        <button v-if="fromProjId" class="tree-tool accent" @click="goBack" title="返回刚才那个项目的详情页">← 返回项目详情</button>
        <div class="tree-stats">愿景 1 · 使命 1 · 战略目标 {{ treeStats.dirs }} · 项目 {{ treeStats.projects }} · 🚀 主攻 {{ treeStats.focused }} · ⚠ 停滞 {{ treeStats.stalled }} · 指标 {{ treeStats.metrics }} · 任务 {{ treeStats.tasks }}</div>
        <!-- ★W11 视图切换（D3：方向台内第二视图）。双向可达：两个按钮都在，任何时候都能来回切 -->
        <div class="view-seg" role="tablist" aria-label="方向台视图形态">
          <button class="vs-b" :class="{ on: viewMode === 'tower' }" :aria-selected="viewMode === 'tower'" title="纵向项目舱列 · 看我在哪个位置" @click="viewMode = 'tower'">项目塔</button>
          <button class="vs-b" :class="{ on: viewMode === 'pano' }" :aria-selected="viewMode === 'pano'" title="横向泳道全景 · 看这一个项目的完整链路" @click="viewMode = 'pano'">项目全景</button>
        </div>
        <button class="tree-tool" @click="expandAllNodes" title="展开全部层级">⊞ 展开</button>
        <button class="tree-tool" @click="collapseAllNodes" title="收起全部战略目标与指标">⊟ 收起</button>
        <!-- R3-B′：目标级入口上收页头（原先埋在第 3 层卡头里，新建战略目标要先把视线降到层内） -->
        <button class="tree-tool accent" @click="addDirection" title="添加战略目标">＋ 添加战略目标</button>
        <span class="node-action ai-chain-act" title="AI 依愿景/使命建议本阶段战略目标（同层查重后采纳才创建）" @click="aiChain('directions', '')"><AiEntryButton variant="inline" label="建议目标" /></span>
        <button class="tree-tool" :class="{ off: !showDone }" @click="toggleShowDone" title="与方向台页头同一开关（同一偏好，一处切换全台生效）">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}</button>
        <div class="dhi-badge" :class="dhiStatus.cls">
          <span>🧭</span>
          <span>方向健康度：{{ dhiStatus.label }}</span>
        </div>
      </div>

      <!-- 画布 -->
      <div class="tree-layout">
      <aside class="layer-toc">
        <div class="lt-title">🧭 六层思维链<span class="en">SIX-LAYER CHAIN</span></div>
        <div v-for="item in tocItems" :key="item.n" class="lt-item"
          :class="{active: activeLayer === item.n}" @click="scrollToLayer(item.n)">
          <span class="lt-num">{{ item.n }}</span>
          <span class="lt-name">{{ item.name }}</span>
        </div>
        <div class="lt-hint">点击快速定位</div>
      </aside>
      <div class="canvas" ref="canvasEl" @scroll="onCanvasScroll">
        <div class="canvas-inner">

          <!-- 第1-2层：愿景 / 使命 锚点卡（R121：两张 node 卡 → 单卡紧凑；编辑与关联卡片保留） -->
          <div class="tree-level-card hero" id="layer-1">
            <span class="tl-badge">1 愿景 · 终极方向</span>
            <div class="tl-text">
              <span class="node-title editable" :class="{editing: editingField === 'vision'}" :data-edit="'vision'" :contenteditable="editingField === 'vision'"
                @click="startEdit('vision', $event)" @blur="saveEdit('vision', $event)" @keydown.enter.ctrl.prevent="saveEdit('vision', $event)" @keydown.esc="cancelEdit">{{ visionText || '点击设定你的核心愿景…' }}</span>
            </div>
            <div class="tl-links">
              <span class="proj-toggle" @click.stop="toggleLinkPop('vision')">🔗 关联卡片 <span class="link-count">{{ linkCount('vision') }}</span></span>
              <template v-if="linkCount('vision')">
                <span v-for="rid in linkIds('vision', 'res')" :key="'vr' + rid" class="linked-chip" :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico">📄</span><span class="lc-text">{{ resTitle(rid) }}</span></span>
                <span v-for="cid in linkIds('vision', 'curio')" :key="'vc' + cid" class="linked-chip" :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico">💡</span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
              </template>
            </div>
            <span class="tl-badge ghost" id="layer-2">2 使命 · 行动准则</span>
            <div class="tl-text sub">
              <span class="node-title editable" :class="{editing: editingField === 'mission'}" :data-edit="'mission'" :contenteditable="editingField === 'mission'"
                @click="startEdit('mission', $event)" @blur="saveEdit('mission', $event)" @keydown.enter.ctrl.prevent="saveEdit('mission', $event)" @keydown.esc="cancelEdit">{{ missionText || '点击设定你的核心使命…' }}</span>
            </div>
            <div class="tl-links">
              <span class="proj-toggle" @click.stop="toggleLinkPop('mission')">🔗 关联卡片 <span class="link-count">{{ linkCount('mission') }}</span></span>
              <template v-if="linkCount('mission')">
                <span v-for="rid in linkIds('mission', 'res')" :key="'mr' + rid" class="linked-chip" :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico">📄</span><span class="lc-text">{{ resTitle(rid) }}</span></span>
                <span v-for="cid in linkIds('mission', 'curio')" :key="'mc' + cid" class="linked-chip" :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico">💡</span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
              </template>
            </div>
          </div>
          <!-- W11 ★战略骨架控制条：六层按钮 + 战略目标芯片 + 断链行。
               它不是"另一张架构展示图"，而是下方项目塔的导航/过滤/联动中枢——
               六层数字吃 compassMeta.counts（与舱体同源），点层级即定位或过滤。判据 W11-7 钉住数字不得散落现算。 -->
          <CompassSpine
            :meta="compassMeta"
            :dir-filter="dirFilter"
            :layer-open="layerOpen"
            :risk-only="riskOnly"
            @layer="onLayerOpen"
            @locate="onLocateLayer"
            @dir="onDirFilter"
            @risk="toggleRiskOnly"
            @orphan="gotoOrphans"
            @risk-bar="showRiskReport"
          />

          <!-- W11 ★层级展开面板：点 1/2/3 摊开该层完整内容 + 推导链 + 下挂实体。
               再点同层收起（判据 W11-3 双向可达，绝不做单向门）。 -->
          <CompassLayerPanel
            v-if="layerOpen"
            :meta="compassMeta"
            :layer="layerOpen"
            :vision="visionText"
            :mission="missionText"
            :vision-links="linkCount('vision')"
            :mission-links="linkCount('mission')"
            :dir-filter="dirFilter"
            @goto="onLayerOpen"
            @locate="onLocateLayer"
            @dir="onDirFilter"
            @close="layerOpen = null"
          />


          <!-- 第3-6层：战略目标 → 攻坚项目 → 成功指标 → 任务（W11：纵向项目舱序列 + 归属轨道） -->
            <div class="tl-head-row">
              <span class="tl-badge">3 战略目标 → 4 攻坚项目 → 5 成功指标 → 6 任务</span>
              <span class="tl-hint">主攻项目默认展开 · 其余折叠成卡头（点 ▸ 展开）· 卡头 ⠿ 拖拽可在本目标内排序 · 缺任务指标实时警示</span>
              <!-- W1.1（V3.8.1）：项目详情通用直达入口——此前只有钻进项目卡折叠菜单才有「进入项目详情页」，
                   用户拍板在攻坚项目区右上放一枚通用按钮；默认项目=主攻项目（无主攻兜底第一个未完成，
                   落点口径见 W1.1 交付说明） -->
              <button class="tree-tool accent" title="打开项目详情（默认落主攻项目）" @click="router.push({ path: '/compass/projects' })">📄 项目详情</button>
            </div>

            <!-- ★W11 筛选态提示条：过滤是隐形的就会让人以为项目丢了。
                 只要 dirFilter / riskOnly 任一开着就常驻，并给一个一键全清的出口（判据 W11-9）。 -->
            <div v-if="dirFilter || riskOnly" class="filter-bar" role="status">
              <span class="fb-t">
                <template v-if="dirFilter">正在只看战略目标「{{ dirFilterName }}」</template>
                <template v-if="dirFilter && riskOnly"> · </template>
                <template v-if="riskOnly">⚠ 只看断链</template>
              </span>
              <span class="fb-n">
                命中 {{ towerGroups.length }} 个目标 · {{ towerGroups.reduce((s, g) => s + g.projs.length, 0) }} 个项目舱
              </span>
              <button class="fb-clear" title="清除全部筛选，恢复完整视图" @click="clearFilters">✕ 清除筛选</button>
            </div>

            <!-- ★W11 项目全景（横向泳道）。与项目塔同一份数据、两种投影，切换不重算。 -->
            <CompassPano
              v-if="viewMode === 'pano'"
              :meta="compassMeta"
              :active-id="panoId"
              @pick="panoId = $event"
              @to-tower="backToTower"
              @toggle-task="toggleTask"
              @task-grade="showTaskGrade"
              @add-task="(mid, pid) => openTaskAdd(mid, pid)"
              @add-metric="addMetric"
              @ai-metric="(id) => aiChain('metrics', id)"
              @bind-orphan="bindOrphan"
              @goto-detail="(pid) => router.push({ path: '/compass/projects', query: { p: pid, from: 'tree' } })"
            />

            <!-- W11（V3.8.11）★纵向项目舱序列 —— 替换原三列并排网格（.tree-columns-grid）
                 为什么换：三列并排时项目之间只靠列边界，扫视易串行，归属靠"在哪一列"推断。
                 改成纵向舱：每舱独占容器 + 左侧 4px 色条 + 舱间 22px 间距，归属由色条与面包屑显式承担。
                 判据 W11-1 钉住"纵向舱序列存在 + .tree-columns-grid 消失"。 -->
            <div v-if="viewMode === 'tower'" class="tower-list" id="layer-4">
              <div v-if="!d.compass.directions.length" class="empty-state">
                <div class="empty-icon">🎯</div>
                <div>还没有战略目标，点击上方"添加战略目标"开始</div>
              </div>

              <template v-for="dg in towerGroups" :key="dg.dir.id">
                <!-- 战略目标分组头：★与骨架条芯片、层级面板目标卡三处同源同色 -->
                <div class="dir-head" :class="dg.hue" :data-dir-id="dg.dir.id">
                  <div class="dh-l">
                    <span class="dh-i">{{ dg.i + 1 }}</span>
                    <span class="node-title editable dh-n" :class="{editing: editingField === 'dir-' + dg.dir.id}" :data-edit="'dir-' + dg.dir.id" :contenteditable="editingField === 'dir-' + dg.dir.id"
                      @click="startEdit('dir-' + dg.dir.id, $event)" @blur="saveEdit('dir-' + dg.dir.id, $event)" @keydown.enter.prevent="saveEdit('dir-' + dg.dir.id, $event)" @keydown.esc="cancelEdit">{{ dg.dir.name }}</span>
                    <span v-if="isStagnant(dg.dir)" class="stagnant-tag" title="该目标下项目近 14 天无推进">⚠ 停滞</span>
                    <MaturityBadge :m="directionMaturity(d, dg.dir)" />
                    <span class="dh-meta">{{ dg.projs.length }} 攻坚项目 · {{ dg.metaCount }} 成功指标 · {{ dg.taskCount }} 任务</span>
                  </div>
                  <div class="dh-acts" @click.stop>
                    <span class="node-action" @click="addProject(dg.dir.id)" title="添加攻坚项目">＋</span>
                    <span class="node-action" @click="aiChain('projects', dg.dir.id)" title="AI 建议攻坚项目（补路径依赖，查重后采纳才创建）"><AiEntryButton /></span>
                    <span class="node-action" @click="openGoalImport(dg.dir)" title="导入模板（Markdown 批量生成项目/指标/任务）">📋</span>
                    <span class="node-action" :class="{ on: dirFilter === dg.dir.id }" @click="onDirFilter(dg.dir.id)" title="只看这个战略目标的项目舱">{{ dirFilter === dg.dir.id ? '✓ 正在只看' : '只看我' }}</span>
                    <span class="node-action danger" @click="deleteNode('dir', dg.dir.id)" title="删除目标">🗑</span>
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
                  @add-task="(mid) => { const r = findMetric(mid); if (r) openTaskAdd(mid, r.proj.id) }"
                  @unbind="(tid) => { const t = d.tasks.find(x => x.id === tid); if (t) unbindTask(t) }"
                  @ai-task="(mid) => aiChain('tasks', mid)"
                  @add-metric="addMetric"
                  @edit-title="(mid, ev) => startEdit('metric-' + mid, ev)"
                  @save-title="(mid, ev) => saveEdit('metric-' + mid, ev)"
                  @cancel-title="cancelEdit"
                  @edit-project="() => openProjectDrawer(row.proj.id)"
                  @ai-metric="(id) => aiChain('metrics', id)"
                  @open-pano="openPano"
                  @goto-detail="(pid) => { toggleProjMenu(pid); router.push({ path: '/compass/projects', query: { p: pid, from: 'tree' } }) }"
                  @bind-orphan="bindOrphan"
                />
              </template>
          </div>

          <!-- 底部说明 -->
          <div class="footer-hint">
            💡 点击标题即可编辑 · Enter 保存 / Esc 取消 · 点击指标展开/收起任务 · 空指标会亮 ⚠ 警示
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
              <span>🔗 关联卡片 · {{ linkModal.node === 'vision' ? '愿景' : '使命' }}</span>
              <span class="lm-count">已选 {{ linkCount(linkModal.node) }}</span>
              <div class="pm-close" @click="closeLinkModal">×</div>
            </div>
            <div class="lm-body">
              <input v-model="linkQ" class="lm-search" placeholder="关键词或拼音首字母过滤（如 sj）…" v-focus @keydown.esc.stop="closeLinkModal">
              <div class="link-pop-sec">📄 资源卡（{{ linkCandidates('res').length }}）</div>
              <div class="lm-list">
                <label v-for="r in linkCandidates('res')" :key="r.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'res', r.id)" @change="toggleLinked(linkModal.node, 'res', r.id)">
                  <span :title="r.title">{{ r.title }}</span>
                </label>
                <div v-if="!linkCandidates('res').length" class="link-pop-empty">无匹配资源卡</div>
              </div>
              <div class="link-pop-sec">💡 好奇心卡（{{ linkCandidates('curio').length }}）</div>
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
    <Drawer :open="!!peekData" :title="peek?.kind === 'res' ? '📄 资源卡详情' : '💡 好奇心卡详情'" @close="peek = null">
      <template v-if="peekData">
        <div class="peek-row"><span class="peek-label">标题</span><div class="peek-val strong">{{ peekData.title }}</div></div>
        <div class="peek-row"><span class="peek-label">来源</span><div class="peek-val">{{ peekData.kind === 'res' ? peekData.src : '我的好奇心' }}{{ peekData.linkType ? ' · ' + peekData.linkType : '' }}</div></div>
        <div v-if="peekData.link" class="peek-row"><span class="peek-label">链接</span><div class="peek-val link">{{ peekData.link }}</div></div>
        <div v-if="peekData.desc" class="peek-row"><span class="peek-label">描述</span><div class="peek-val">{{ peekData.desc }}</div></div>
        <div v-if="peekData.tags.length" class="peek-row"><span class="peek-label">标签</span><div class="peek-val"><span v-for="t in peekData.tags" :key="t" class="peek-tag">#{{ t }}</span></div></div>
        <button v-if="peekData.link" class="peek-open" @click="openPeekLink">↗ 打开链接</button>
      </template>
    </Drawer>

    <!-- 第卅二轮 REQ-003：项目全景透视抽屉 -->
    <ProjectDetailDrawer :open="projDrawerOpen" :project-id="projDrawerId" @close="projDrawerOpen = false" />

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
  <!-- R135：罗盘链式生成评审抽屉（目标/项目/指标/任务四层建议共用） -->
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
.compass-layout { display: block; min-height: 100%; padding: 20px 36px 64px; max-width: 1440px; margin: 0 auto; }
.tree-layout { display: flex; gap: 20px; align-items: flex-start; }
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
.dhi-badge { display: flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 99px; background: var(--accent-light); font-size: var(--fs-sub); font-weight: 500; color: var(--accent-ink); }
.dhi-badge.warning { background: var(--tag-warn-bg); color: var(--tag-warn-text); }

/* 画布（左侧为悬浮目录预留空间） */
.canvas { flex: 1; min-width: 0; padding: 0 4px 20px; }
.canvas-inner { max-width: 1000px; margin: 0 auto; min-width: 700px; }

.tree-page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.tree-page-head .crumb { font-size: var(--fs-body); color: var(--text-2); }
/* ⑤ 层级倒置的修法**不是**降面包屑，而是抬内容标题：原状面包屑 16px > 内容标题 11px。
   ★R123 定案「工作台/项目详情/方向台三页页头统一 16px」是跨页一致性决策，用户 2026-10-12 拍板
   **保三页一致**，故 crumb 维持 16px 不动，改把「六层思维链」提到 --fs-headline(17px) ——
   层级变成愿景 22 › 区块标题 17 › 面包屑 16 › 正文 13，单调递减，倒置同样被消除，
   且不需要随迁 R51-6 / R123-10 两条判据。 */
.tree-page-head .crumb b { color: var(--text); font-weight: 700; font-size: 16px; letter-spacing: .2px; }
.tree-page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
.tree-page-head .spacer { flex: 1; }
/* R49-C7：顶部统计 + 展开收起/显隐工具 */
.tree-stats { font-size: var(--fs-caption); color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.tree-tool { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); border-radius: 8px; padding: 5px 11px; cursor: pointer; font-family: inherit; transition: all var(--dur); white-space: nowrap; }
.tree-tool:hover { border-color: var(--accent); color: var(--accent); }
.tree-tool.off { opacity: .6; }
/* R52-F8/R54-A1：返回入口（accent 强调）+ 面包屑上级可点 */
.tree-tool.accent { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
/* R54-A3：?hl 定位闪烁 */
/* ★随迁备案（W11）：原锚 .tc-strategic-branch 三列网格已退役，改指新结构 .dir-head */
.dir-head.goal-flash { animation: treeGoalFlash 1.4s ease; }
@keyframes treeGoalFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); border-color: var(--accent); } }

/* D8：六层目录 = 布局内左栏 + sticky 跟随（目录在左，内容在右，随滚动吸附） */
.layer-toc { position: sticky; top: 16px; align-self: flex-start; width: 200px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 10px; display: flex; flex-direction: column; gap: 3px; box-shadow: var(--shadow); max-height: calc(100vh - 120px); overflow-y: auto; }
.lt-title { font-size: var(--fs-headline); font-weight: 600; color: var(--text); letter-spacing: -.01em; padding: 0 2px 12px; display: flex; align-items: baseline; gap: 8px; }
.lt-title .en { font-size: var(--fs-micro); color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; }
.lt-item { display: flex; align-items: center; gap: 8px; padding: 8px 9px; border-radius: 8px; cursor: pointer; transition: all var(--dur); border: 1px solid transparent; }
.lt-item:hover { background: var(--surface-3); }
.lt-item.active { background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 25%, transparent); }
.lt-item.active .lt-name { color: var(--accent); font-weight: 600; }
.lt-num { width: 20px; height: 20px; border-radius: 6px; background: var(--surface-3); color: var(--text-2); font-size: var(--fs-tiny); font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all var(--dur); }
.lt-item.active .lt-num { background: var(--accent); color: #fff; }
.lt-name { font-size: var(--fs-body); color: var(--text-2); }
.lt-hint { margin-top: auto; font-size: var(--fs-tiny); color: var(--text-4); text-align: center; padding-top: 12px; }

/* 层标题 */
.layer-header { display: flex; align-items: center; gap: 9px; margin: 20px 0 10px; }
.layer-header:first-child { margin-top: 0; }
.layer-num { width: 24px; height: 24px; border-radius: 6px; background: var(--accent); color: #fff; font-size: var(--fs-sub); font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.layer-name { font-size: 14px; font-weight: 600; color: var(--text); }
.layer-desc { font-size: var(--fs-caption); color: var(--text-3); margin-left: 3px; }
.node .node-title { font-size: var(--fs-body); font-weight: 500; color: var(--text); line-height: 1.5; flex: 1; min-width: 0; }
.node .node-title.editable { cursor: text; outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; transition: background var(--dur); }
.node .node-title.editable:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.node .node-title.editable.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
/* R68-F4：操作按钮主题感知——原硬编码不透明白底 + 浅灰图标，深色主题（近黑画布）下对比度崩坏看不到入口 */
.node-action { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: var(--fs-caption); cursor: pointer; color: var(--text-2); transition: all var(--dur); background: var(--surface-3); border: 1px solid var(--border); }
/* R135：文字型 AI 入口（添加战略目标旁的「知 建议目标」） */
.ai-chain-act { width: auto; padding: 0 8px; gap: 3px; font-size: var(--fs-caption); white-space: nowrap; }
.node-action:hover { background: var(--accent-light); color: var(--accent-ink); border-color: var(--accent); }
.node-action.danger:hover { color: var(--danger); }
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
.empty-state { text-align: center; padding: 40px 20px; color: var(--text-3); font-size: var(--fs-body); }
.empty-icon { font-size: 32px; opacity: .4; margin-bottom: 8px; }

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
.tl-hint { font-size: var(--fs-sub); color: var(--text-3); }

/* ── W11 视图切换段（项目塔 / 项目全景）── */
/* ★两个按钮都必须常驻可点：切过去容易、切回来难是典型的单向门 */
.view-seg {
  display: inline-flex; align-items: center; gap: 2px;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 999px; padding: 2px;
}
.vs-b {
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-3);
  background: transparent; border: none; cursor: pointer;
  padding: 4px 11px; border-radius: 999px; transition: all var(--dur); white-space: nowrap;
}
.vs-b:hover { color: var(--text-2); }
.vs-b.on { color: var(--accent-ink); background: var(--accent-light); }

/* ── W11 筛选态提示条：过滤是隐形的就会让人以为项目丢了 ── */
.filter-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-bottom: 12px; padding: 7px 12px;
  border: 1px solid var(--accent-light); border-radius: var(--radius-sm);
  background: var(--accent-light);
}
.fb-t { font-size: var(--fs-sub); font-weight: 600; color: var(--accent-ink); }
.fb-n { font-size: var(--fs-micro); color: var(--text-3); }
.fb-clear {
  margin-left: auto; font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
  background: var(--surface); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 999px; cursor: pointer; transition: all var(--dur);
}
.fb-clear:hover { color: var(--accent-ink); border-color: var(--accent-light); }
/* ══ W11：纵向项目舱序列 ══
   .tree-columns-grid 三列并排已退役（判据 W11-1 钉住它不许复活）——
   三列时项目之间只靠列边界，扫视易串行，归属靠"在哪一列"推断。 */
.tower-list { display: flex; flex-direction: column; gap: 4px; }

/* 战略目标分组头：与骨架条芯片、层级面板目标卡三处同源 */
.dir-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 14px 2px 10px; margin-top: 10px;
  border-bottom: 1px solid var(--border);
}
.dir-head:first-of-type { margin-top: 0; }
.dh-l { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; min-width: 0; }
.dh-i {
  width: 20px; height: 20px; border-radius: 7px; flex: none;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--text-2); font-size: var(--fs-micro); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
/* ★目标名 --fs-title(15px)：它是"分岔源头"，比项目重一档；使命/愿景仍是更高层（判据 W8-2 备案延续） */
.dh-n { font-size: var(--fs-title); font-weight: 700; color: var(--text); letter-spacing: -.01em; }
.dh-meta { font-size: var(--fs-micro); color: var(--text-3); margin-left: 2px; }
.dh-acts { display: flex; align-items: center; gap: 4px; flex: none; }
.dh-acts .node-action.on { color: var(--accent-ink); background: var(--accent-light); }

/* 层级定位闪烁：让"我点的这层实体在这儿"一眼可见 */
@keyframes w11Flash {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  22%, 62% { box-shadow: 0 0 0 3px var(--accent); }
}
.w11-flash { animation: w11Flash 1.4s ease; border-radius: var(--radius-md); }

/* ★判据 W11-13 的版式补偿（D1 拍板：愿景保持 fs-display 22px，主角感靠版式）：
   独占整行 + 上下大留白 + 重边框，三者缺一就是"只降字号不改版式"＝变相没实现。 */
.tree-level-card.hero {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-lg);
  padding: 30px 26px 30px 30px;
  margin-bottom: 22px;
  gap: 10px;
}

</style>
