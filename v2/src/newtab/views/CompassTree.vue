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

// ---- 任务数据 ----
function tasksForMetric(metricId: string): TaskCard[] {
  // REQ-034：按 id 去重双保险
  const seen = new Set<string>()
  return d.value.tasks
    .filter(t => !t.deletedAt && t.metricId === metricId)
    .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}
/* R166 定案 1：子任务改成卡内嵌 subtasks，不再是独立卡 ⇒ R144 的 flattenTaskTree 展平与 ⤴ 升顶层退役 */
function metricTaskRows(metricId: string) { return tasksForMetric(metricId) }

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
function scrollToLayer(n: number) {
  activeLayer.value = n
  const el = document.getElementById('layer-' + n)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function onCanvasScroll() {
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
        <div class="lt-title">🧭 六层思维链</div>
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
          <div class="tree-level-card" id="layer-1">
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

          <!-- 第3-6层：战略目标 → 攻坚项目 → 成功指标 → 任务（R121：三列分支网格 + 发丝缩进） -->
          <div class="tree-level-card" id="layer-3">
            <div class="tl-head-row">
              <span class="tl-badge">3 战略目标 → 4 攻坚项目 → 5 成功指标 → 6 任务</span>
              <span class="tl-hint">主攻项目默认展开 · 其余折叠成卡头（点 ▸ 展开）· 卡头 ⠿ 拖拽可在本目标内排序 · 缺任务指标实时警示</span>
              <!-- W1.1（V3.8.1）：项目详情通用直达入口——此前只有钻进项目卡折叠菜单才有「进入项目详情页」，
                   用户拍板在攻坚项目区右上放一枚通用按钮；默认项目=主攻项目（无主攻兜底第一个未完成，
                   落点口径见 W1.1 交付说明） -->
              <button class="tree-tool accent" title="打开项目详情（默认落主攻项目）" @click="router.push({ path: '/compass/projects' })">📄 项目详情</button>
            </div>

            <div v-if="!d.compass.directions.length" class="empty-state">
              <div class="empty-icon">🎯</div>
              <div>还没有战略目标，点击上方"添加战略目标"开始</div>
            </div>

            <div class="tree-columns-grid" id="layer-4">
              <div v-for="dir in d.compass.directions" :key="dir.id" class="tc-strategic-branch" :data-dir-id="dir.id">
                <div class="tc-strategic-title">
                  <div class="tct-name">
                    <span class="node-title editable" :class="{editing: editingField === 'dir-' + dir.id}" :data-edit="'dir-' + dir.id" :contenteditable="editingField === 'dir-' + dir.id"
                      @click="startEdit('dir-' + dir.id, $event)" @blur="saveEdit('dir-' + dir.id, $event)" @keydown.enter.prevent="saveEdit('dir-' + dir.id, $event)" @keydown.esc="cancelEdit">{{ dir.name }}</span>
                    <span v-if="isStagnant(dir)" class="stagnant-tag" title="该目标下项目近 14 天无推进">⚠ 停滞</span>
                    <MaturityBadge :m="directionMaturity(d, dir)" />
                  </div>
                  <div class="tct-meta">
                    <span>{{ visibleProjectsOf(dir).length }} 攻坚项目 · {{ dir.projects.reduce((s,p)=>s+p.metrics.length,0) }} 成功指标</span>
                    <span class="tct-acts" @click.stop>
                      <span class="node-action" @click="addProject(dir.id)" title="添加项目">＋</span>
                      <span class="node-action" @click="aiChain('projects', dir.id)" title="AI 建议攻坚项目（补路径依赖，查重后采纳才创建）"><AiEntryButton /></span>
                      <span class="node-action" @click="openGoalImport(dir)" title="导入模板（Markdown 批量生成项目/指标/任务）">📋</span>
                      <span class="node-action danger" @click="deleteNode('dir', dir.id)" title="删除目标">🗑</span>
                    </span>
                  </div>
                </div>

                <div v-for="proj in visibleProjectsOf(dir)" :key="proj.id" class="tree-project-branch" :class="{ 'is-focused': proj.isFocused, 'is-dragging': dragProj?.id === proj.id }">
                  <!-- R3-B2：drop 目标=同目标的另一张卡头（跨目标不接受，改归属走项目详情） -->
                  <div class="tp-head" :class="{ folded: !projOpen(proj), 'drop-on': dropTargetId === proj.id }"
                    @dragover.prevent="onProjDragOver(dir.id, proj)" @dragleave="onProjDragLeave(proj.id)" @drop.prevent="onProjDrop(dir.id, proj)">
                    <div class="tp-title">
                      <span class="tp-caret" :title="projOpen(proj) ? '折叠该项目（指标与任务）' : '展开该项目的指标与任务'" @click.stop="toggleProjectFold(proj)">{{ projOpen(proj) ? '▾' : '▸' }}</span>
                      <span v-if="proj.isFocused" class="tp-mark" title="主攻项目">🚀</span>
                      <span v-if="proj.pinned" class="tp-pin" title="已置顶到该目标前排">📌</span>
                      <span v-if="projMeta.get(proj.id)?.stall" class="tp-flag" title="有任务但近 14 天无推进/完成活动">停滞</span>
                      <span class="node-title editable" :class="{editing: editingField === 'proj-' + proj.id}" :data-edit="'proj-' + proj.id" :contenteditable="editingField === 'proj-' + proj.id"
                        @click="startEdit('proj-' + proj.id, $event)" @blur="saveEdit('proj-' + proj.id, $event)" @keydown.enter.prevent="saveEdit('proj-' + proj.id, $event)" @keydown.esc="cancelEdit">{{ proj.name }}</span>
                    </div>
                    <span class="tp-pct" :class="{ ok: (projMeta.get(proj.id)?.pct || 0) === 100 }">{{ projMeta.get(proj.id)?.pct || 0 }}% · {{ projMeta.get(proj.id)?.done || 0 }}/{{ projMeta.get(proj.id)?.total || 0 }}</span>
                    <MaturityBadge :m="projectMaturity(d, proj)" />
                  </div>
                  <div class="tp-meta">
                    <span>📊 {{ proj.metrics.length }} 指标 · 📋 {{ projMeta.get(proj.id)?.tasks || 0 }} 任务</span>
                    <!-- R3-B′：卡头 6 入口 → 「⠿ / 全景 / AI / ▾」，设主攻·置顶·添加指标·进详情·删除进折叠菜单
                         （删除仍走 compassNodeCounts 报数 + useConfirm + 3 秒撤销，防呆不因收敛而降级） -->
                    <span class="tp-acts" @click.stop>
                      <span class="tp-grip" draggable="true" title="拖拽排序（仅同一战略目标内；主攻恒在前排）" @dragstart="onProjDragStart(dir.id, proj, $event)" @dragend="onProjDragEnd">⠿</span>
                      <span class="node-action" @click="openProjectDrawer(proj.id)" title="打开项目全景">📦</span>
                      <span class="node-action" @click="aiChain('metrics', proj.id)" title="AI 建议成功指标（可量化验收，查重后采纳才创建）"><AiEntryButton /></span>
                      <span class="node-action" :class="{ on: projMenu === proj.id }" @click="toggleProjMenu(proj.id)" title="更多操作（主攻 / 置顶 / 指标 / 详情 / 删除）">▾</span>
                      <div v-if="projMenu === proj.id" class="tp-menu">
                        <div class="tpm-item" @click="onToggleFocus(proj.id); closeProjMenu()">{{ proj.isFocused ? '☆ 取消主攻' : '🚀 设为主攻' }}</div>
                        <div class="tpm-item" @click="toggleProjectPin(dir, proj); closeProjMenu()">{{ proj.pinned ? '☆ 取消置顶' : '📌 置顶到本目标前排' }}</div>
                        <div class="tpm-item" @click="addMetric(proj.id); closeProjMenu()">＋ 添加成功指标</div>
                        <div class="tpm-item" @click="closeProjMenu(); router.push({ path: '/compass/projects', query: { p: proj.id, from: 'tree' } })">📄 进入项目详情页</div>
                        <div class="tpm-item danger" @click="closeProjMenu(); deleteNode('proj', proj.id)">🗑 删除项目</div>
                      </div>
                    </span>
                  </div>

                  <!-- 第5-6层：指标（发丝缩进）与任务叶——R3-B′：折叠态的项目只留卡头 -->
                  <div v-for="metric in (projOpen(proj) ? proj.metrics : [])" :key="metric.id" class="tree-metric-branch">
                    <div class="tm-title-row" @click="toggleMetric(metric.id)">
                      <span class="tm-dot" :class="{doing: tasksForMetric(metric.id).some(t=>t.status==='doing'), done: tasksForMetric(metric.id).length && tasksForMetric(metric.id).every(t=>t.status==='done')}">{{ tasksForMetric(metric.id).length && tasksForMetric(metric.id).every(t=>t.status==='done') ? '✓' : tasksForMetric(metric.id).some(t=>t.status==='doing') ? '◐' : '○' }}</span>
                      <span class="node-title editable" :class="{editing: editingField === 'metric-' + metric.id}" :data-edit="'metric-' + metric.id" :contenteditable="editingField === 'metric-' + metric.id"
                        @click.stop="startEdit('metric-' + metric.id, $event)" @blur="saveEdit('metric-' + metric.id, $event)" @keydown.enter.prevent="saveEdit('metric-' + metric.id, $event)" @keydown.esc="cancelEdit">{{ metric.title }}</span>
                      <span class="tm-count">({{ tasksForMetric(metric.id).filter(t=>t.status==='done').length }}/{{ tasksForMetric(metric.id).length }})</span>
                      <MaturityBadge :m="metricMaturity(d, metric)" />
                      <span class="tm-caret">{{ expandedMetrics.has(metric.id) ? '▾' : '▸' }}</span>
                      <span class="tm-acts" @click.stop>
                        <span class="node-action" @click="openTaskAdd(metric.id, proj.id)" title="添加任务（新建 / 关联）">＋</span>
                        <span class="node-action" @click="aiChain('tasks', metric.id)" title="AI 按指标缺口建议近两周任务（查重后采纳才创建）"><AiEntryButton /></span>
                        <span class="node-action danger" @click="deleteNode('metric', metric.id)" title="删除指标">🗑</span>
                      </span>
                    </div>
                    <div v-if="tasksForMetric(metric.id).length && expandedMetrics.has(metric.id)" class="tm-task-checklist">
                      <div v-for="task in metricTaskRows(metric.id)" :key="task.id" class="tm-task-leaf" :class="{done: task.status==='done'}">
                        <span class="tml-check" :class="{done: task.status==='done'}" @click.stop="toggleTask(task.id)">{{ task.status==='done' ? '✓' : task.status==='doing' ? '◐' : '○' }}</span>
                        <span class="node-title editable" :class="{editing: editingField === 'task-' + task.id}" :data-edit="'task-' + task.id" :contenteditable="editingField === 'task-' + task.id"
                          @click.stop="startEdit('task-' + task.id, $event)" @blur="saveEdit('task-' + task.id, $event)" @keydown.enter.prevent="saveEdit('task-' + task.id, $event)" @keydown.esc="cancelEdit">{{ task.title }}</span>
                        <span class="tml-pri">{{ task.priority==='high'?'高优':task.priority==='medium'?'中优':'低优' }}</span>
                        <MaturityBadge :m="taskMaturity(task)" />
                        <span class="tml-del node-action" @click.stop="unbindTask(task)" title="从本指标移除（解绑回任务调度模块；删除本体请进任务详情）">✕</span>
                      </div>
                    </div>
                    <div v-else-if="!tasksForMetric(metric.id).length" class="tm-empty-alert">⚠ 暂无支撑任务（线索断开）</div>
                  </div>
                  <div v-if="!proj.metrics.length" class="empty-sub">暂无成功指标</div>
                </div>

                <div v-if="!visibleProjectsOf(dir).length" class="empty-sub">暂无可见攻坚项目（已完成项目可能已隐藏），点上方「＋」创建</div>
              </div>
            </div>
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
.tc-strategic-branch.goal-flash { animation: treeGoalFlash 1.4s ease; }
@keyframes treeGoalFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); border-color: var(--accent); } }

/* D8：六层目录 = 布局内左栏 + sticky 跟随（目录在左，内容在右，随滚动吸附） */
.layer-toc { position: sticky; top: 16px; align-self: flex-start; width: 200px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 10px; display: flex; flex-direction: column; gap: 3px; box-shadow: var(--shadow); max-height: calc(100vh - 120px); overflow-y: auto; }
.lt-title { font-size: var(--fs-caption); font-weight: 700; color: var(--accent); letter-spacing: .5px; padding: 0 8px 10px; }
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
   （R4-Ev 孤儿 CSS 第二批）——今天的主攻标记在 .tree-project-branch.is-focused 与 .tp-mark 🚀 上 */
.metric-item.expanded { background: var(--surface); border-color: color-mix(in srgb, var(--accent) 20%, var(--border)); border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; }
.metric-status.done { background: var(--success); }
.metric-status.doing { background: var(--warning); }
.metric-status.todo { background: var(--text-3); }
.metric-name.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.metric-item.expanded .metric-expand-icon { transform: rotate(90deg); }
.task-item { display: flex; align-items: center; gap: 7px; padding: 5px 9px 5px 20px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; transition: all var(--dur); border-radius: 5px; position: relative; }
.task-item::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0; width: 1px; background: var(--border); }
.task-item::after { content: ''; position: absolute; left: 10px; top: 50%; width: 6px; height: 1px; background: var(--border-strong); }
.task-item:hover { background: var(--surface-2); color: var(--text); }
.task-check { width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; transition: all var(--dur); display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; font-size: var(--fs-micro); }
.task-check:hover { border-color: var(--accent); }
.task-check.done { background: var(--success); border-color: var(--success); color: #fff; }
.task-item.done .task-text { text-decoration: line-through; color: var(--text-3); }
.task-text { flex: 1; outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; cursor: text; transition: background var(--dur); }
.task-text:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.task-text.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.task-meta { font-size: var(--fs-micro); color: var(--text-3); }
.task-actions { display: flex; gap: 2px; opacity: 0; transition: opacity var(--dur); }
.task-item:hover .task-actions { opacity: 1; }
.empty-sub { text-align: center; padding: 16px; font-size: var(--fs-caption); color: var(--text-3); }
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
.tl-text { font-size: 14px; font-weight: 700; color: var(--text); }
.tl-text.sub { font-size: var(--fs-body); font-weight: 500; color: var(--text-2); }
.tl-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--fs-sub); color: var(--text-3); }
.tl-head-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.tl-hint { font-size: var(--fs-sub); color: var(--text-3); }
.tree-columns-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-items: start; }
.tc-strategic-branch { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.tc-strategic-title { padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.tct-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.tct-name .node-title { font-size: var(--fs-body); font-weight: 700; color: var(--text); }
.tct-meta { display: flex; align-items: center; gap: 8px; margin-top: 3px; font-size: var(--fs-caption); color: var(--text-3); font-variant-numeric: tabular-nums; }
.tct-acts { display: none; gap: 2px; margin-left: auto; }
.tc-strategic-branch:hover .tct-acts { display: inline-flex; }
.tree-project-branch { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.tree-project-branch.is-focused { border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent); }
.tp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tp-title { display: flex; align-items: center; gap: 5px; min-width: 0; }
.tp-title .node-title { font-size: var(--fs-body); font-weight: 700; color: var(--text); }
.tp-mark { flex-shrink: 0; color: var(--accent); font-size: var(--fs-caption); }
/* R3-B1：停滞标随主航线项目行卡退役搬进树卡头（原 .pr-flag 同色同形，令牌取色） */
.tp-flag { flex-shrink: 0; font-size: var(--fs-micro); padding: 1px 4px; border-radius: 3px; background: var(--tag-warn-bg); color: var(--warning); }
.tp-pct { flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-3); font-variant-numeric: tabular-nums; }
.tp-pct.ok { color: var(--success); font-weight: 600; }
.tp-caret { flex: none; width: 14px; text-align: center; font-size: var(--fs-caption); color: var(--text-3); cursor: pointer; user-select: none; }
.tp-caret:hover { color: var(--accent); }
/* R3-B2：置顶徽标 + 拖拽手柄 + 落位指示（指示用 inset box-shadow，不占布局——落位时不许把版面挤动） */
.tp-pin { flex-shrink: 0; font-size: var(--fs-caption); }
.tp-grip { flex: none; width: 16px; text-align: center; font-size: var(--fs-caption); color: var(--text-4); cursor: grab; user-select: none; }
.tp-grip:hover { color: var(--accent); }
.tp-grip:active { cursor: grabbing; }
.tree-project-branch.is-dragging { opacity: var(--opacity-disabled); }
.tp-head.drop-on { box-shadow: inset 0 2px 0 0 var(--accent); }
.tp-head.folded { border-bottom: 1px dashed var(--border); }
.tp-acts { position: relative; }
.tp-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 168px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow); padding: 4px; }
.tpm-item { font-size: var(--fs-sub); color: var(--text-2); padding: 7px 10px; border-radius: var(--radius-xs); cursor: pointer; white-space: nowrap; }
.tpm-item:hover { background: var(--surface-2); color: var(--text); }
.tpm-item.danger { color: var(--danger); }
.tpm-item.danger:hover { background: var(--danger-bg-soft); }
.tp-meta { display: flex; align-items: center; gap: 8px; font-size: var(--fs-caption); color: var(--text-3); }
.tp-acts { display: none; gap: 2px; margin-left: auto; }
.tree-project-branch:hover .tp-acts { display: inline-flex; }
/* 第5-6层：发丝缩进（原型：border-left 引导线） */
.tree-metric-branch { margin-left: 8px; padding-left: 10px; border-left: 1.5px solid var(--border); margin-top: 8px; }
.tm-title-row { display: flex; align-items: center; gap: 6px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; }
.tm-dot { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-4); }
.tm-dot.doing { color: var(--tag-warn-text); }
.tm-dot.done { color: var(--success); }
.tm-title-row .node-title { font-weight: 600; min-width: 0; }
.tm-count { flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-4); font-variant-numeric: tabular-nums; }
.tm-caret { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-4); }
.tm-acts { display: none; gap: 2px; margin-left: auto; }
.tree-metric-branch:hover .tm-acts { display: inline-flex; }
.tm-task-checklist { margin-left: 4px; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.tm-task-leaf { display: flex; align-items: flex-start; gap: 6px; padding: 2px 0; font-size: var(--fs-sub); color: var(--text); line-height: 1.35; }
.tm-task-leaf.done .node-title { text-decoration: line-through; color: var(--text-4); }
.tml-check { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-4); cursor: pointer; }
.tml-check.done { color: var(--text-4); }
.tml-pri { flex-shrink: 0; margin-left: auto; font-size: var(--fs-tiny); color: var(--text-4); }
.tml-del { display: none; flex-shrink: 0; }
.tm-task-leaf:hover .tml-del { display: inline-flex; }
/* 空指标警示（原型：⚠ 暂无支撑任务） */
.tm-empty-alert { margin-top: 4px; font-size: var(--fs-caption); color: var(--warning); background: var(--warning-bg-soft); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
@media (max-width: 1180px) { .tree-columns-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 980px) { .tree-columns-grid { grid-template-columns: 1fr; } }

</style>
