<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { useConfirm } from '@/shared/components/confirm'
import type { Project, Direction, TaskCard, Metric } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import { loadUIPrefs, saveUIPrefs } from '@/shared/storage/repository'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress } = useCompass()

/** R49-D6：任务详情 = 共享 TaskDetailDrawer（R48 重设计组件） */
const detailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function openTaskDetail(t: TaskCard) { detailRef.value?.open(t) }

/* ================= 数据 ================= */
const projects = computed(() => {
  const list = allProjects()
  list.forEach((p, i) => { if (p.order == null) p.order = i })
  return list
})
function goalOf(p: Project): Direction | null {
  for (const dir of d.value.compass.directions) {
    if (dir.projects.some(x => x.id === p.id)) return dir
  }
  return null
}
function projectTasksCount(p: Project): number {
  return d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id).length
}
/** 14 天无任务更新视为停滞 */
function isStalled(p: Project): boolean {
  const tasks = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id)
  const recent = tasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  return recent ? Date.now() - (recent.updatedAt || 0) > 14 * 86400_000 : tasks.length > 0
}

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

async function removeMetric(m: Metric) {
  if (!currentProject.value) return
  const taskCount = d.value.tasks.filter(t => !t.deletedAt && t.metricId === m.id).length
  const okFlag = await useConfirm({ title: '删除成功指标', message: taskCount ? `确定删除「${m.title}」？\n其下 ${taskCount} 个任务将转为未归类任务（可拖回任意指标）。` : `确定删除「${m.title}」？`, confirmText: '确认删除' })
  if (!okFlag) return
  d.value.tasks.forEach(t => { if (!t.deletedAt && t.metricId === m.id) t.metricId = undefined })
  currentProject.value.metrics = currentProject.value.metrics.filter(x => x.id !== m.id)
  store.persist()
  showToast('已删除指标' + (taskCount ? `，${taskCount} 个任务转为未归类` : ''))
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
/* ================= R55-G1：左栏项目目录树（拖任务跨指标 / 拖指标排序 / 定位） ================= */
/* ================= R67-F5：左栏宽/高拖拽（持久化 UIPrefs.projRailW/projRailH） ================= */
const railW = ref<number | undefined>(undefined)
const railH = ref<number | undefined>(undefined)
const railStyle = computed(() => ({
  width: railW.value ? railW.value + 'px' : undefined,
  height: railH.value ? railH.value + 'px' : undefined,
  maxHeight: railH.value ? railH.value + 'px' : undefined
}))
let railDrag: { mode: 'w' | 'h'; startX: number; startY: number; baseW: number; baseH: number } | null = null
function startRailResize(e: MouseEvent, mode: 'w' | 'h') {
  e.preventDefault()
  const el = (e.currentTarget as HTMLElement).parentElement
  if (!el) return
  const rect = el.getBoundingClientRect()
  railDrag = { mode, startX: e.clientX, startY: e.clientY, baseW: rect.width, baseH: rect.height }
  document.body.classList.add('rail-resizing', mode === 'w' ? 'rail-w' : 'rail-h')
  window.addEventListener('mousemove', onRailResizeMove)
  window.addEventListener('mouseup', onRailResizeUp)
}
function onRailResizeMove(e: MouseEvent) {
  if (!railDrag) return
  if (railDrag.mode === 'w') {
    railW.value = Math.round(Math.min(560, Math.max(230, railDrag.baseW + (e.clientX - railDrag.startX))))
  } else {
    railH.value = Math.round(Math.min(window.innerHeight - 90, Math.max(240, railDrag.baseH + (e.clientY - railDrag.startY))))
  }
}
function onRailResizeUp() {
  window.removeEventListener('mousemove', onRailResizeMove)
  window.removeEventListener('mouseup', onRailResizeUp)
  document.body.classList.remove('rail-resizing', 'rail-w', 'rail-h')
  if (railDrag && railW.value != null) saveUIPrefs({ projRailW: railW.value })
  if (railDrag && railH.value != null) saveUIPrefs({ projRailH: railH.value })
  railDrag = null
}
onMounted(async () => {
  try {
    const ui = await loadUIPrefs()
    if (ui.projRailW) railW.value = ui.projRailW
    if (ui.projRailH) railH.value = ui.projRailH
  } catch { /* 偏好读取失败按默认布局 */ }
})
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
function toggleFocus(p: Project) {
  if (!p.isFocused) {
    const focused = allProjects().filter(x => x.isFocused && x.id !== p.id)
    if (focused.length >= 2) { showToast('主攻项目最多 2 个，请先取消其他主攻'); return }
  }
  p.isFocused = !p.isFocused
  store.persist()
  showToast(p.isFocused ? '🎯 已设为主攻，同步今日行动' : '已取消主攻')
}
/** R52-F6：头部级「＋添加成功指标」——与「＋添加任务」并置，输入名后创建（同步方向树） */
const headerMetricAdding = ref(false)
const headerMetricTitle = ref('')
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
function startHeaderAddMetric() { headerMetricAdding.value = true; headerMetricTitle.value = '' }
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
/* R60：原「投射至灯塔」开关已取消，重心语义统一由「🎯 主攻 isFocused」承担 */

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
  const dir = d.value.compass.directions.find(x => x.id === createDirId.value)
  if (!dir) { showToast('请选择所属战略目标'); return }
  const proj: Project = {
    id: uid('proj'), name, isFocused: false,
    progress: 0, status: 'active', order: dir.projects.length, metrics: []
  }
  dir.projects.push(proj)
  store.persist()
  createOpen.value = false
  showToast(`✓ 项目「${name}」已创建`)
  openProject(proj) // 直接进入全屏展板
}

/* ================= 单项目展板 ================= */
const currentProject = ref<Project | null>(null)
let currentDir: Direction | null = null
function openProject(p: Project) {
  currentProject.value = p
  currentDir = goalOf(p)
  // R49：保留 ?p 参数（刷新后仍定位到该项目详情）
  if (route.query.p !== p.id) router.replace({ path: route.path, query: { p: p.id } })
}
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
  if (document.querySelector('.task-sidebar, .overlay, .modal-mask')) return
  e.preventDefault()
  goBack()
}
onMounted(() => document.addEventListener('keydown', onPageEsc, true))
onUnmounted(() => document.removeEventListener('keydown', onPageEsc, true))
watch(() => route.query.p, (pid) => {
  if (!pid || typeof pid !== 'string') { if (!route.query.p) currentProject.value = null; return }
  const p = projects.value.find(x => x.id === pid)
  if (p) { currentProject.value = p; currentDir = goalOf(p) }
}, { immediate: true })

function renameProject(e: FocusEvent) {
  const v = (e.target as HTMLElement).textContent?.trim()
  if (v && currentProject.value) { currentProject.value.name = v; store.persist() }
  else if (currentProject.value) { (e.target as HTMLElement).textContent = currentProject.value.name }
}
function onNameEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }

/* ---- 指标/任务操作 ---- */
/** 第卅三轮 REQ-016：添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAddMetric = ref<Metric | null>(null)
function openTaskAdd(m: Metric) { taskAddMetric.value = m }
/** R51-B6：创建成功后直接打开 R48 详情抽屉（与调度台新建任务口径一致） */
function onTaskCreated(t: TaskCard) { openTaskDetail(t) }
function removeTask(task: TaskCard) {
  task.deletedAt = Date.now()
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const m of proj.metrics) m.taskIds = m.taskIds.filter(id => id !== task.id)
    }
  }
  store.persist()
  showToast('已删除任务')
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
  return pr === 'high' ? '🔴 高优先级' : pr === 'mid' || pr === 'medium' ? '🟡 中优先级' : '🟢 低优先级'
}
function prTag(pr: string) {
  return pr === 'high' ? 'danger' : pr === 'mid' || pr === 'medium' ? 'warn' : 'ok'
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
  <div class="page">
    <div class="page-head">
      <div class="crumb"><span class="crumb-up" title="返回方向台" @click="router.push('/compass')">方向台</span><span class="crumb-sep"> / </span><b>项目详情</b><span v-if="currentProject"> · {{ currentProject.name }}</span></div>
      <div class="spacer" />
      <!-- R59-T1：返回按钮恒为方向台（旧来源感知分支已退役） -->
      <button class="mini-btn" @click="goBack">← 返回方向台</button>
      <div class="hint-chip">任务可拖拽排序 / 跨指标归属 · 点击任务开详情</div>
    </div>

    <!-- ===== 项目选择（无 ?p 时的落地视图；全景墙管理已由方向台·项目总览承接） ===== -->
    <div v-if="!currentProject">
      <div class="sel-grid">
        <div v-for="p in projects" :key="p.id" class="sel-item" @click="openProject(p)">
          <div class="sel-name">{{ p.name }}<span v-if="p.isFocused" class="tag accent">🎯 主攻</span></div>
          <div class="sel-goal">{{ goalOf(p)?.name || '—' }}</div>
          <div class="sel-meta">🎯 {{ p.metrics.length }} · 📋 {{ projectTasksCount(p) }} · {{ projectProgress(p).pct }}%</div>
        </div>
        <div class="wall-add" @click="openCreateProject">
          <span style="font-size:20px">＋</span><span>新建 / 规划项目</span>
        </div>
      </div>
      <div v-if="!projects.length" class="empty-state">点击上方「新建 / 规划项目」，选择战略目标后开始</div>
    </div>

    <!-- ===== 单项目全屏展板 ===== -->
    <div v-else class="board-layout">
    <!-- R55-G1：左栏双列联动目录——第一列全部项目（单击切换），第二列当前项目目录树（拖任务跨指标/拖指标排序）
         ｜ R67-F5：栏体宽/高可拖拽（右缘调宽、底缘调高），右侧展板自适应重排 -->
    <aside class="proj-rail" :style="railStyle">
      <div class="pr-col pr-projects">
        <div class="pt-title">📦 全部项目</div>
        <div v-for="p in projects.slice().sort((a,b)=>(a.order||0)-(b.order||0))" :key="p.id"
          class="pt-item" :class="{active: currentProject.id === p.id}" @click="openProject(p)">
          <span class="pt-name">{{ p.name }}</span>
          <span class="pt-pct">{{ projectProgress(p).pct }}%</span>
        </div>
      </div>
      <div class="pr-col pr-tree">
        <div class="pt-title">📐 项目目录</div>
        <div class="prt-root">
          <span class="prt-root-name">{{ currentProject.name }}</span>
          <span class="prt-root-pct">{{ projectProgress(currentProject).pct }}%</span>
        </div>
        <template v-for="(m, mi) in currentProject.metrics" :key="m.id">
          <div class="prt-metric" :class="{'drop-line-t': treeDrop?.id === m.id && treeDrop?.mode === 't', 'drop-line-b': treeDrop?.id === m.id && treeDrop?.mode === 'b', 'drop-into': treeDrop?.id === m.id && treeDrop?.mode === 'in' }"
            draggable="true" @dragstart="treeMetricDragStart($event, m)" @dragover.prevent="treeMetricDragOver($event, m)" @dragleave="treeDrop = null" @drop.prevent="treeMetricDrop($event, m)">
            <div class="prt-mrow" :title="'🎯 ' + m.title + ' · 单击定位 · 拖动排序'" @click="scrollToMetric(m.id)">
              <span class="prt-dot">🎯</span><span class="prt-name">{{ m.title }}</span>
              <span class="prt-meta">{{ metricPct(m.id) }}% · {{ tasksForMetric(m.id).length }}</span>
            </div>
            <div v-for="t in tasksForMetric(m.id)" :key="t.id" class="prt-task"
              :class="{ flash: taskFlashId === t.id }"
              draggable="true" @dragstart.stop="treeTaskDragStart($event, t)" @dragover.stop.prevent
              @drop.stop.prevent="treeTaskDropOnMetric($event, m)"
              :title="t.title + ' · 拖到其他指标 = 变更归属'" @click.stop="scrollToTask(t.id)">
              <span class="prt-task-dot" :class="'st-' + t.status">{{ t.status==='done'?'✓':t.status==='doing'?'◐':'○' }}</span>
              <span class="prt-task-name">{{ t.title }}</span>
            </div>
          </div>
        </template>
        <div v-if="orphanTasks.length" class="prt-metric orphan">
          <div class="prt-mrow" title="原指标已删除的任务">
            <span class="prt-dot">⚠</span><span class="prt-name">未归类任务</span>
            <span class="prt-meta">{{ orphanTasks.length }}</span>
          </div>
          <div v-for="t in orphanTasks" :key="t.id" class="prt-task"
            draggable="true" @dragstart.stop="treeTaskDragStart($event, t)" @dragover.stop.prevent
            @drop.stop.prevent="treeTaskDropOnMetric($event, null)"
            @click.stop="scrollToTask(t.id)">
            <span class="prt-task-dot">○</span>
            <span class="prt-task-name">{{ t.title }}</span>
          </div>
        </div>
        <div v-if="!currentProject.metrics.length" class="prt-empty">暂无成功指标——点上方「🎯 添加成功指标」</div>
      </div>
      <!-- R67-F5：宽/高拖拽手柄（右缘调宽 · 底缘调高） -->
      <span class="rail-grip rail-grip-w" title="拖拽调宽" @mousedown="startRailResize($event, 'w')" />
      <span class="rail-grip rail-grip-h" title="拖拽调高" @mousedown="startRailResize($event, 'h')" />
    </aside>
    <div class="board">
      <div class="back-row">
        <span class="tag">ID · {{ currentProject.id.slice(0, 12) }}</span>
        <span class="tag accent">{{ goalOf(currentProject)?.name || '—' }}</span>
        <span v-if="currentProject.isFocused" class="tag accent">🎯 主攻</span>
        <div style="flex:1" />
        <!-- R52-F6：添加成功指标与添加任务并置 -->
        <button class="mini-btn" @click="startHeaderAddMetric">🎯 添加成功指标</button>
        <button class="mini-btn primary" @click="addTaskFromHeader">＋ 添加任务</button>
        <button class="mini-btn" @click="goTreeLocated">🌳 完整方向树</button>
      </div>
      <!-- R52-F6：成功指标名输入行 -->
      <div v-if="headerMetricAdding" class="metric-add-row">
        <input v-model="headerMetricTitle" placeholder="成功指标名称，回车确认（同步完整方向树）" v-focus
          @keydown.enter.prevent="confirmHeaderAddMetric" @keydown.esc="headerMetricAdding=false" />
        <button class="mini-btn primary" @click="confirmHeaderAddMetric">确定</button>
        <button class="mini-btn" @click="headerMetricAdding=false">取消</button>
      </div>

      <!-- 愿景 → 使命 → 战略目标 → 项目 归属链（D2：四段可点击，前三段跳完整方向树） -->
      <div class="chain-box">
        <div class="chain-line">
          <div class="ch-node clickable" title="在完整方向树中查看" @click="goTreeLocated">
            <div class="ch-ic">🔭</div>
            <div class="ch-body"><div class="ch-lab">愿景 · Vision</div><div class="ch-txt">{{ visionText || '尚未设定愿景' }}</div></div>
          </div>
          <div class="ch-link" />
          <div class="ch-node clickable" title="在完整方向树中查看" @click="goTreeLocated">
            <div class="ch-ic">💡</div>
            <div class="ch-body"><div class="ch-lab">使命 · Mission</div><div class="ch-txt">{{ missionText || '尚未设定使命' }}</div></div>
          </div>
          <div class="ch-link" />
          <div class="ch-node clickable hi" title="在完整方向树中定位此战略目标" @click="goTreeLocated">
            <div class="ch-ic">🎯</div>
            <div class="ch-body"><div class="ch-lab">战略目标 · Direction</div><div class="ch-txt">{{ goalOf(currentProject)?.name }}（{{ goalOf(currentProject)?.term==='long'?'远期':goalOf(currentProject)?.term==='short'?'近期':'中期' }}）</div></div>
          </div>
          <div class="ch-link" />
          <div class="ch-node current">
            <div class="ch-ic">📦</div>
            <div class="ch-body" style="padding-bottom:2px"><div class="ch-lab">攻坚项目 · Project</div><div class="ch-txt">{{ currentProject.name }}</div></div>
          </div>
        </div>
      </div>

      <!-- 项目 Hero -->
      <div class="hero">
        <div class="hero-top">
          <div class="hero-pname" contenteditable="true" spellcheck="false" @blur="renameProject" @keydown.enter.prevent="onNameEnter">{{ currentProject.name }}</div>
          <span v-if="currentProject.startDate || currentProject.endDate" class="tag info">⏱ {{ currentProject.startDate || '—' }} → {{ currentProject.endDate || '—' }}</span>
          <span class="tag" :class="isStalled(currentProject) ? 'warn' : 'ok'">{{ isStalled(currentProject) ? '⚠ 存在停滞' : '● 推进中' }}</span>
          <button class="pin-toggle" :class="{on: currentProject.isFocused}" @click="toggleFocus(currentProject)">🎯 {{ currentProject.isFocused ? '主攻中' : '设为主攻' }}</button>
        </div>
        <div class="hero-progress">
          <span class="big">{{ projectProgress(currentProject).pct }}%</span>
          <span class="progress bar"><i :style="{width: projectProgress(currentProject).pct + '%'}" /></span>
        </div>
        <div class="hero-stats">
          <div class="hstat"><div class="v">{{ currentProject.metrics.length }}</div><div class="l">成功指标</div></div>
          <div class="hstat"><div class="v">{{ projectProgress(currentProject).total }}</div><div class="l">任务总数</div></div>
          <div class="hstat"><div class="v">{{ projectProgress(currentProject).done }}</div><div class="l">已完成</div></div>
          <div class="hstat"><div class="v">{{ projectProgress(currentProject).total - projectProgress(currentProject).done }}</div><div class="l">进行中</div></div>
        </div>
        <div class="hero-tip">💡 项目名可编辑 · 任务可拖拽排序 / 跨指标拖拽归属 / 点击任务名打开详情抽屉 · 全部实时同步罗盘</div>
      </div>

      <!-- 成功指标 → 任务 -->
      <div class="layer-header"><div class="layer-num">5</div><div class="layer-name">成功指标 → 任务</div><div class="layer-desc">· 拖拽 ⋮⋮ 排序或跨指标归属</div></div>
      <div v-for="(m, mi) in currentProject.metrics" :key="m.id" class="metric-sec" :id="'metric-sec-' + m.id" :class="{ 'sec-flash': metricFlashId === m.id }"
        @dragover.prevent="onMetricDragOver($event, m.id)" @dragleave="onMetricDragLeave" @drop="onMetricDrop($event, m.id)">
        <div class="metric-head2">
          <span class="tag ok" style="flex-shrink:0">🎯 指标 {{ mi+1 }}</span>
          <span class="mname" contenteditable="true" spellcheck="false"
            @blur="renameMetric(m, $event)" @keydown.enter.prevent="($event.target as HTMLElement).blur()">{{ m.title }}</span>
          <span class="pct">{{ metricPct(m.id) }}%</span>
          <span class="progress" style="width:100px"><i :style="{width: metricPct(m.id) + '%'}" /></span>
          <button class="icon-btn-sm" title="添加任务（新建 / 关联）" @click="openTaskAdd(m)">＋</button>
          <button class="icon-btn-sm del" title="删除指标" @click="removeMetric(m)">🗑</button>
        </div>
        <div class="task-rows">
          <div v-for="task in tasksForMetric(m.id)" :key="task.id" class="btask" :class="{done: task.status==='done', 'task-flash': taskFlashId === task.id}" draggable="true"
            :data-task-id="task.id"
            @dragstart="onTaskDragStart($event, task, m.id)" @dragend="onTaskDragEnd"
            @dragover.prevent.stop @drop.stop="onTaskDrop($event, task)">
            <span class="bdrag" title="拖拽排序 / 跨指标归属">⋮⋮</span>
            <span class="bcheck" :class="{done: task.status==='done'}" @click="toggleTaskDone(task)">{{ task.status==='done'?'✓':'' }}</span>
            <span class="bt" @click="openTaskDetail(task)" title="点击打开任务详情">{{ task.title }}</span>
            <span class="tag" :class="prTag(task.priority)">{{ prLabel(task.priority) }}</span>
            <AssetBadge v-if="task.assets?.length" :assets="task.assets" />
            <button class="icon-btn-sm del" title="删除任务（进回收站）" @click="removeTask(task)">🗑</button>
          </div>
          <div class="task-add" @click="openTaskAdd(m)">＋ 添加任务（新建 / 关联）</div>
        </div>
      </div>
      <div v-if="!currentProject.metrics.length" class="empty-state">该项目暂无成功指标——点击上方「🎯 添加成功指标」开始</div>
      <!-- B27：未归类任务（指标已删除的孤儿任务） -->
      <div v-if="orphanTasks.length" class="metric-sec">
        <div class="metric-head2">
          <span class="tag warn" style="flex-shrink:0">⚠ 未归类任务</span>
          <span class="mname">原指标已删除 · 可拖回任意指标或删除</span>
        </div>
        <div class="task-rows">
          <div v-for="t in orphanTasks" :key="t.id" class="btask" :class="{done: t.status==='done', 'task-flash': taskFlashId === t.id}" draggable="true"
            :data-task-id="t.id"
            @dragstart="onTaskDragStart($event, t, '__orphan__')" @dragend="onTaskDragEnd" @dragover.prevent @drop="onTaskDrop($event, t)">
            <span class="bdrag" title="拖拽到指标归属">⋮⋮</span>
            <span class="bcheck" :class="{done: t.status==='done'}" @click="toggleTaskDone(t)">{{ t.status==='done'?'✓':'' }}</span>
            <span class="bt" @click="openTaskDetail(t)" title="点击打开任务详情">{{ t.title }}</span>
            <span class="tag" :class="prTag(t.priority)">{{ prLabel(t.priority) }}</span>
            <button class="icon-btn-sm del" title="删除任务（进回收站）" @click="removeTask(t)">🗑</button>
          </div>
        </div>
      </div>
      <!-- R52-F6：添加成功指标入口上移至头部操作区（原底部通栏按钮移除） -->

      <!-- R49-D4：任务附件区（按任务聚合，复用 AssetBadge 打开逻辑；资源卡本体在资源台管理，此处不呈现） -->
      <div class="metric-sec asset-sec">
        <div class="metric-head2">
          <span class="tag ok" style="flex-shrink:0">📎 任务附件</span>
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


    <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
    <TaskAddDrawer :open="!!taskAddMetric" :metric-id="taskAddMetric?.id || ''" :project-id="currentProject?.id || ''"
      :metric-title="taskAddMetric?.title" @close="taskAddMetric = null" @created="onTaskCreated" />

    
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 48px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-left: 22px; }
.page-head .crumb { font-size: 12.5px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 19px; letter-spacing: .3px; }
.page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
/* R54-A1：面包屑上级可点 */
.page-head .crumb .crumb-up { cursor: pointer; color: var(--text-3); }
.page-head .crumb .crumb-up:hover { color: var(--accent); }
.page-head .crumb .crumb-sep { color: var(--text-4); }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }

.section-label { font-size: 12px; font-weight: 600; color: var(--text-2); margin: 4px 0 12px; }
.section-label .sl-count { font-size: 10px; color: var(--text-3); font-weight: 500; }
.wall-section { margin-bottom: 8px; }
.wall-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
.pcard { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; cursor: pointer; transition: all .15s ease; position: relative; display: flex; flex-direction: column; gap: 10px; }
.pcard:hover { border-color: var(--border-strong); background: var(--surface-2); }
.pcard.dragging { opacity: .4; }
.ptop { display: flex; align-items: center; gap: 8px; }
.pname { font-size: 15px; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pin-btn { width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; cursor: pointer; font-size: 13px; color: var(--text-4); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
.pin-btn:hover { background: var(--surface-3); }
.pin-btn.on { color: var(--accent); background: var(--accent-light); }
.chain { font-size: 10.5px; color: var(--text-3); display: flex; align-items: center; gap: 5px; white-space: nowrap; overflow: hidden; }
.chain b { color: var(--text-2); font-weight: 500; }
.chain .sep { color: var(--text-4); }
.mrows { display: flex; flex-direction: column; gap: 7px; }
.mrow { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-2); }
.mrow .mn { width: 118px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
.mrow .bar { flex: 1; }
.mrow .pct { width: 34px; text-align: right; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
.pfoot { display: flex; align-items: center; gap: 8px; border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 2px; font-size: 10.5px; color: var(--text-3); }
.pfoot .enter { margin-left: auto; color: var(--accent); font-weight: 600; opacity: 0; transition: opacity .15s; }
.pcard:hover .pfoot .enter { opacity: 1; }
.wall-add { border: 1.5px dashed var(--border-strong); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; min-height: 130px; cursor: pointer; color: var(--text-3); font-size: 12.5px; transition: all .15s; flex-direction: column; gap: 6px; }
.wall-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
/* R49-D：项目选择列表（无 ?p 落地视图） */
.sel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.sel-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 7px; }
.sel-item:hover { border-color: var(--border-strong); background: var(--surface-2); transform: translateY(-1px); }
.sel-name { font-size: 14px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sel-goal { font-size: 11px; color: var(--text-3); }
.sel-meta { font-size: 11px; color: var(--text-2); font-variant-numeric: tabular-nums; }
/* R49-D2：归属链可点击 */
.ch-node.clickable { cursor: pointer; border-radius: 8px; padding: 3px 6px; margin: -3px -6px; transition: background .12s; }
.ch-node.clickable:hover { background: var(--surface-2); }
.ch-node.current .ch-ic { background: var(--accent); }
.ch-node.current .ch-txt { color: var(--text); font-weight: 700; font-size: 14px; }
/* R49-D4：任务附件区 */
.asset-sec { margin-top: 12px; }
.asset-row { cursor: pointer; }
.empty-asset { text-align: center; padding: 16px; font-size: 11.5px; color: var(--text-4); }
.empty-state { text-align: center; padding: 48px 20px; color: var(--text-3); font-size: 13px; }

/* 展板 */
.board-layout { display: flex; gap: 16px; align-items: flex-start; }
/* R55-G1：左栏双列联动目录——第一列全部项目 + 第二列当前项目目录树 */
.proj-rail { position: sticky; top: 16px; display: flex; gap: 8px; flex-shrink: 0; width: 302px; max-height: calc(100vh - 200px); }
/* R67-F5：宽/高拖拽手柄——悬停微亮提示可拖，拖拽中全局锁定光标 */
.rail-grip { position: absolute; z-index: 6; }
.rail-grip-w { top: 0; right: -5px; width: 9px; height: 100%; cursor: col-resize; border-radius: 99px; }
.rail-grip-w:hover { background: var(--accent-light); box-shadow: inset 1px 0 0 var(--accent); }
.rail-grip-h { left: 0; bottom: -5px; height: 9px; width: 100%; cursor: row-resize; border-radius: 99px; }
.rail-grip-h:hover { background: var(--accent-light); box-shadow: inset 0 1px 0 var(--accent); }
body.rail-resizing { user-select: none; }
body.rail-resizing.rail-w { cursor: col-resize; }
body.rail-resizing.rail-h { cursor: row-resize; }
.pr-col { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 10px 8px; box-shadow: var(--shadow); overflow-y: auto; }
.pr-projects { width: 126px; flex-shrink: 0; }
.pr-tree { flex: 1; min-width: 0; }
.pt-title { font-size: 10.5px; font-weight: 700; color: var(--accent); letter-spacing: .5px; padding: 0 8px 8px; }
.pt-item { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 8px; cursor: pointer; transition: all .12s; border: 1px solid transparent; }
.pt-item:hover { background: var(--surface-3); }
.pt-item.active { background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 25%, transparent); }
.pt-item.active .pt-name { color: var(--accent); font-weight: 600; }
.pt-name { flex: 1; min-width: 0; font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pt-pct { font-size: 10px; color: var(--text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
/* 第二列 · 项目目录树 */
.prt-root { display: flex; align-items: center; gap: 6px; padding: 7px 9px; margin-bottom: 4px; background: var(--accent-light); border-radius: 8px; }
.prt-root-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prt-root-pct { font-size: 10.5px; color: var(--accent); font-variant-numeric: tabular-nums; font-weight: 600; }
.prt-metric { border-radius: 8px; padding: 2px 0; }
.prt-metric + .prt-metric { margin-top: 2px; }
.prt-metric.drop-into { outline: 2px dashed var(--accent); outline-offset: -2px; background: var(--accent-light); }
.prt-metric.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.prt-metric.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.prt-metric[draggable="true"] > .prt-mrow { cursor: grab; }
.prt-mrow { display: flex; align-items: center; gap: 6px; padding: 8px 8px; border-radius: 6px; cursor: pointer; transition: background .12s; }
.prt-mrow:hover { background: var(--surface-2); }
.prt-dot { font-size: 11px; flex-shrink: 0; }
.prt-name { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 600; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prt-meta { font-size: 9.5px; color: var(--text-4); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.prt-task { display: flex; align-items: center; gap: 6px; padding: 7px 8px 7px 26px; border-radius: 6px; cursor: pointer; transition: background .12s; }
.prt-task:hover { background: var(--surface-2); }
.prt-task[draggable="true"] { cursor: grab; }
.prt-task-dot { font-size: 9px; width: 14px; text-align: center; flex-shrink: 0; color: var(--text-3); border-radius: 99px; }
.prt-task-dot.st-doing { color: var(--tag-warn-text); }
.prt-task-dot.st-done { color: var(--success); }
.prt-task-name { flex: 1; min-width: 0; font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prt-task.flash { background: var(--accent-light); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent); }
.prt-task.flash .prt-task-name { color: var(--accent); }
.prt-metric.sec-flash { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); }
.prt-empty { font-size: 10.5px; color: var(--text-4); padding: 8px; text-align: center; }
.board { flex: 1; min-width: 0; max-width: 920px; }
.metric-sec .mname { outline: none; border-radius: 5px; padding: 2px 5px; margin: -2px -5px; cursor: text; }
.metric-sec .mname:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.metric-sec .mname:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.back-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
/* R52-F6：成功指标名输入行 */
.metric-add-row { display: flex; gap: 8px; margin: -6px 0 14px; }
.metric-add-row input { flex: 1; border: 1px solid var(--border); background: var(--surface-2); border-radius: 8px; padding: 8px 12px; font-size: 12.5px; color: var(--text); outline: none; font-family: inherit; }
.metric-add-row input:focus { border-color: var(--accent); }
.chain-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 16px; }
/* R55-G2：归属链横向化——愿景→使命→战略目标→项目 一行呈现，压缩纵向空间 */
.chain-line { display: flex; flex-direction: row; align-items: stretch; gap: 10px; }
.ch-node { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; }
.ch-ic { width: 28px; height: 28px; border-radius: 8px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.ch-node.hi .ch-ic { background: var(--accent-light); }
.ch-body { flex: 1; min-width: 0; padding-bottom: 0; }
.ch-lab { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: var(--text-3); text-transform: uppercase; }
.ch-txt { font-size: 12px; color: var(--text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ch-node.hi .ch-txt { color: var(--accent); font-weight: 600; font-size: 12.5px; }
.ch-link { width: 18px; height: 2px; align-self: center; flex-shrink: 0; margin: 0; background: linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 25%, transparent)); border-radius: 2px; }
.hero { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 16px; }
.hero-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.hero-pname { font-size: 20px; font-weight: 700; letter-spacing: .2px; outline: none; border-radius: 6px; padding: 2px 6px; margin: -2px -6px; cursor: text; }
.hero-pname:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.hero-pname:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.pin-toggle { border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-3); font-size: 11px; padding: 0 9px; height: 24px; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 4px; }
.pin-toggle.on { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.hero-progress { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.hero-progress .big { font-size: 26px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; letter-spacing: -.2px; }
.hero-progress .bar { flex: 1; height: 8px; }
.hero-progress .bar > i { height: 8px; }
.hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
.hstat { background: var(--surface-2); border-radius: var(--radius-xs); padding: 12px 8px; text-align: center; }
.hstat .v { font-size: 18px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.hstat .l { font-size: 10px; color: var(--text-3); margin-top: 2px; }
.hero-tip { margin-top: 12px; font-size: 10.5px; color: var(--text-3); }
.layer-header { display: flex; align-items: center; gap: 9px; margin: 6px 0 12px; }
.layer-num { width: 24px; height: 24px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 11.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.layer-name { font-size: 14px; font-weight: 600; }
.layer-desc { font-size: 11px; color: var(--text-3); }

.metric-sec { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 12px; transition: border-color .15s, box-shadow .15s; }
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
.task-rows { margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 4px; min-height: 20px; }
.btask { display: flex; align-items: center; gap: 9px; padding: 6px 8px; border-radius: 8px; transition: background .12s; }
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

/* 抽屉 */
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 400; }

.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; user-select: none; }
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
.tag.info { background: var(--info-light); color: var(--info-blue); }
.progress { height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; }
.progress > i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s ease; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform .2s cubic-bezier(.16,1,.3,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
