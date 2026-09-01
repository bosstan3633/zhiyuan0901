<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { useConfirm } from '@/shared/components/confirm'
import type { Project, Direction, TaskCard, Metric } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress } = useCompass()

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
function pinnedProjects() { return projects.value.filter(p => p.pinnedToLighthouse).sort((a, b) => (a.order||0) - (b.order||0)) }
function unpinnedProjects() { return projects.value.filter(p => !p.pinnedToLighthouse).sort((a, b) => (a.order||0) - (b.order||0)) }

/** 指标下的任务（真实任务卡） */
function tasksForMetric(metricId: string): TaskCard[] {
  const order = new Map(d.value.tasks.map((t, i) => [t.id, i]))
  return d.value.tasks
    .filter(t => !t.deletedAt && t.metricId === metricId)
    .sort((a, b) => (order.get(a.id)||0) - (order.get(b.id)||0))
}
function metricPct(metricId: string): number {
  const ts = tasksForMetric(metricId)
  return ts.length ? Math.round(ts.filter(t => t.status === 'done').length / ts.length * 100) : 0
}

/* ================= 全景墙 ================= */
let dragWallId: string | null = null
function onWallDragStart(e: DragEvent, id: string) {
  dragWallId = id
  ;(e.currentTarget as HTMLElement).classList.add('dragging')
  e.dataTransfer!.effectAllowed = 'move'
}
function onWallDragEnd(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('dragging')
  dragWallId = null
}
function onWallDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!dragWallId || dragWallId === targetId) return
  const from = projects.value.find(p => p.id === dragWallId)
  const to = projects.value.find(p => p.id === targetId)
  if (!from || !to) return
  if (!!from.pinnedToLighthouse !== !!to.pinnedToLighthouse) {
    showToast('跨区移动请先用 📡 投射/取消投射')
    return
  }
  // 直接按目标位置重排 order（splice 在 computed 副本上不生效，必须回写 order 字段）
  const sectionIds = (from.pinnedToLighthouse ? pinnedProjects() : unpinnedProjects()).map(p => p.id)
  const fi = sectionIds.indexOf(from.id)
  const ti = sectionIds.indexOf(to.id)
  if (fi < 0 || ti < 0) return
  sectionIds.splice(ti, 0, sectionIds.splice(fi, 1)[0])
  sectionIds.forEach((id, i) => {
    const p = projects.value.find(x => x.id === id)
    if (p) p.order = i
  })
  store.persist()
  dragWallId = null
  showToast('✓ 已调整排序')
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
function toggleFocus(p: Project) {
  if (!p.isFocused) {
    const focused = allProjects().filter(x => x.isFocused && x.id !== p.id)
    if (focused.length >= 2) { showToast('主攻项目最多 2 个，请先取消其他主攻'); return }
  }
  p.isFocused = !p.isFocused
  store.persist()
  showToast(p.isFocused ? '🎯 已设为主攻，同步今日行动' : '已取消主攻')
}
function addMetric() {
  if (!currentProject.value) return
  currentProject.value.metrics.push({ id: uid('met'), title: '新成功指标', taskIds: [] })
  store.persist()
  showToast('✓ 成功指标已创建，同步方向树')
}
function togglePin(p: Project) {
  p.pinnedToLighthouse = !p.pinnedToLighthouse
  store.persist()
  showToast(p.pinnedToLighthouse ? '📡 已投射至知源灯塔，自动置顶' : '已取消投射')
}

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
    id: uid('proj'), name, isFocused: false, pinnedToLighthouse: false,
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
}
function closeProject() { currentProject.value = null }
watch(() => route.query.p, (pid) => {
  if (!pid || typeof pid !== 'string') return
  const p = projects.value.find(x => x.id === pid)
  if (p) openProject(p)
  router.replace({ path: route.path })
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

/* ---- 任务详情抽屉（Ctrl+Enter / Esc） ---- */
const drawerOpen = ref(false)
const drawerTask = ref<TaskCard | null>(null)
const drawerTitle = ref('')
const drawerNote = ref('')
function openDrawer(task: TaskCard) {
  drawerTask.value = task
  drawerTitle.value = task.title
  drawerNote.value = task.description || ''
  drawerOpen.value = true
}
function closeDrawer() { drawerOpen.value = false; drawerTask.value = null }
function saveDrawer() {
  if (!drawerTask.value) return
  const v = drawerTitle.value.trim()
  if (v) drawerTask.value.title = v
  drawerTask.value.description = drawerNote.value.trim()
  drawerTask.value.updatedAt = Date.now()
  store.persist()
  closeDrawer()
  showToast('✓ 已保存，同步罗盘')
}
function drawerToggleDone() {
  if (!drawerTask.value) return
  drawerTask.value.status = drawerTask.value.status === 'done' ? 'todo' : 'done'
  drawerTask.value.completedAt = drawerTask.value.status === 'done' ? Date.now() : undefined
  drawerTask.value.updatedAt = Date.now()
  store.persist()
}
function drawerCyclePriority() {
  if (!drawerTask.value) return
  const order: Array<'low'|'medium'|'high'> = ['low', 'medium', 'high']
  drawerTask.value.priority = order[(order.indexOf(drawerTask.value.priority) + 1) % 3]
  drawerTask.value.updatedAt = Date.now()
  store.persist()
}
async function drawerDelete() {
  if (!drawerTask.value) return
  removeTask(drawerTask.value)
  closeDrawer()
}
function prLabel(pr: string) {
  return pr === 'high' ? '🔴 高优先级' : pr === 'mid' || pr === 'medium' ? '🟡 中优先级' : '🟢 低优先级'
}
function prTag(pr: string) {
  return pr === 'high' ? 'danger' : pr === 'mid' || pr === 'medium' ? 'warn' : 'ok'
}
/** 模板用提示 */
function hint(msg: string) { showToast(msg) }

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (drawerOpen.value) { closeDrawer(); return }
    if (currentProject.value) closeProject()
  }
})
</script>

<template>
  <div>
    <div class="page-head">
      <div class="crumb">知源罗盘 <span class="sep">/</span> <b>项目策展</b> · 以项目为单位的全景展览</div>
      <div class="spacer" />
      <div class="hint-chip">拖拽排序 · 📡 投射灯塔自动置顶 · 点击展板进入全屏策展</div>
    </div>

    <!-- ===== 全景墙 ===== -->
    <div v-if="!currentProject">
      <div v-if="pinnedProjects().length" class="wall-section">
        <div class="section-label">📡 已投射灯塔 · 置顶 <span class="sl-count">{{ pinnedProjects().length }}</span></div>
        <div class="wall-grid">
          <div v-for="p in pinnedProjects()" :key="p.id" class="pcard" draggable="true"
            @dragstart="onWallDragStart($event, p.id)" @dragend="onWallDragEnd" @dragover.prevent @drop="onWallDrop($event, p.id)"
            @click="openProject(p)">
            <div class="ptop">
              <span v-if="p.isFocused" class="tag accent">主攻</span>
              <span v-if="isStalled(p)" class="tag warn">⚠ 停滞</span>
              <span class="pname">{{ p.name }}</span>
              <span class="pin-btn" :class="{on: p.pinnedToLighthouse}" title="取消投射灯塔" @click.stop="togglePin(p)">📡</span>
            </div>
            <div class="chain">愿景<span class="sep">→</span>使命<span class="sep">→</span><b>{{ goalOf(p)?.name || '—' }}</b></div>
            <div class="mrows">
              <div v-for="m in p.metrics" :key="m.id" class="mrow">
                <span class="mn">🎯 {{ m.title }}</span>
                <span class="progress bar"><i :style="{width: metricPct(m.id) + '%'}" /></span>
                <span class="pct">{{ metricPct(m.id) }}%</span>
              </div>
            </div>
            <div class="pfoot">
              <span style="cursor:grab" title="拖拽排序">⋮⋮</span>
              <span>📋 {{ projectTasksCount(p) }}</span>
              <span v-if="p.endDate">🕐 {{ p.endDate }}</span>
              <span class="enter">进入策展 →</span>
            </div>
          </div>
        </div>
      </div>
      <div class="wall-section">
        <div class="section-label" :style="pinnedProjects().length ? '' : 'margin-top:0'">📦 全部项目 <span class="sl-count">{{ unpinnedProjects().length }}</span></div>
        <div class="wall-grid">
          <div v-for="p in unpinnedProjects()" :key="p.id" class="pcard" draggable="true"
            @dragstart="onWallDragStart($event, p.id)" @dragend="onWallDragEnd" @dragover.prevent @drop="onWallDrop($event, p.id)"
            @click="openProject(p)">
            <div class="ptop">
              <span v-if="p.isFocused" class="tag accent">主攻</span>
              <span v-if="isStalled(p)" class="tag warn">⚠ 停滞</span>
              <span class="pname">{{ p.name }}</span>
              <span class="pin-btn" :class="{on: p.pinnedToLighthouse}" title="投射至知源灯塔（自动置顶）" @click.stop="togglePin(p)">📡</span>
            </div>
            <div class="chain">愿景<span class="sep">→</span>使命<span class="sep">→</span><b>{{ goalOf(p)?.name || '—' }}</b></div>
            <div class="mrows">
              <div v-for="m in p.metrics" :key="m.id" class="mrow">
                <span class="mn">🎯 {{ m.title }}</span>
                <span class="progress bar"><i :style="{width: metricPct(m.id) + '%'}" /></span>
                <span class="pct">{{ metricPct(m.id) }}%</span>
              </div>
            </div>
            <div class="pfoot">
              <span style="cursor:grab" title="拖拽排序">⋮⋮</span>
              <span>📋 {{ projectTasksCount(p) }}</span>
              <span v-if="p.endDate">🕐 {{ p.endDate }}</span>
              <span class="enter">进入策展 →</span>
            </div>
          </div>
          <div class="wall-add" @click="openCreateProject">
            <span style="font-size:20px">＋</span><span>新建 / 规划项目</span>
          </div>
        </div>
      </div>
      <div v-if="!projects.length" class="empty-state">点击上方「新建 / 规划项目」，选择战略目标后开始</div>
    </div>

    <!-- ===== 单项目全屏展板 ===== -->
    <div v-else class="board-layout">
    <!-- O12/D8：左侧项目目录（sticky 跟随） -->
    <aside class="proj-toc">
      <div class="pt-title">📦 全部项目</div>
      <div v-for="p in projects.slice().sort((a,b)=>(a.order||0)-(b.order||0))" :key="p.id"
        class="pt-item" :class="{active: currentProject.id === p.id}" @click="openProject(p)">
        <span class="pt-name">{{ p.name }}</span>
        <span class="pt-pct">{{ projectProgress(p).pct }}%</span>
      </div>
    </aside>
    <div class="board">
      <div class="back-row">
        <button class="back-btn" @click="closeProject">← 返回全景墙</button>
        <span class="tag accent">{{ goalOf(currentProject)?.name || '—' }}</span>
        <span v-if="currentProject.isFocused" class="tag accent">主攻</span>
        <span v-if="currentProject.pinnedToLighthouse" class="tag info">📡 已投射灯塔</span>
        <div style="flex:1" />
        <button class="mini-btn" @click="router.push('/compass/tree')">🌳 在方向树中查看</button>
      </div>

      <!-- 愿景 → 使命 → 战略目标 视觉链 -->
      <div class="chain-box">
        <div class="chain-line">
          <div class="ch-node">
            <div class="ch-ic">🔭</div>
            <div class="ch-body"><div class="ch-lab">愿景 · Vision</div><div class="ch-txt">{{ visionText || '尚未设定愿景' }}</div></div>
          </div>
          <div class="ch-link" />
          <div class="ch-node">
            <div class="ch-ic">💡</div>
            <div class="ch-body"><div class="ch-lab">使命 · Mission</div><div class="ch-txt">{{ missionText || '尚未设定使命' }}</div></div>
          </div>
          <div class="ch-link" />
          <div class="ch-node hi">
            <div class="ch-ic">🎯</div>
            <div class="ch-body" style="padding-bottom:2px"><div class="ch-lab">战略目标 · Direction</div><div class="ch-txt">{{ goalOf(currentProject)?.name }}（{{ goalOf(currentProject)?.term==='long'?'远期':goalOf(currentProject)?.term==='short'?'近期':'中期' }}）</div></div>
          </div>
        </div>
      </div>

      <!-- 项目 Hero -->
      <div class="hero">
        <div class="hero-top">
          <div class="hero-pname" contenteditable="true" spellcheck="false" @blur="renameProject" @keydown.enter.prevent="onNameEnter">{{ currentProject.name }}</div>
          <span v-if="currentProject.startDate || currentProject.endDate" class="tag info">⏱ {{ currentProject.startDate || '—' }} → {{ currentProject.endDate || '—' }}</span>
          <span class="tag" :class="isStalled(currentProject) ? 'warn' : 'ok'">{{ isStalled(currentProject) ? '⚠ 存在停滞' : '● 推进中' }}</span>
          <button class="pin-toggle" :class="{on: currentProject.pinnedToLighthouse}" @click="togglePin(currentProject)">📡 {{ currentProject.pinnedToLighthouse ? '已投射灯塔' : '投射灯塔' }}</button>
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
      <div v-for="(m, mi) in currentProject.metrics" :key="m.id" class="metric-sec"
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
          <div v-for="task in tasksForMetric(m.id)" :key="task.id" class="btask" :class="{done: task.status==='done'}" draggable="true"
            @dragstart="onTaskDragStart($event, task, m.id)" @dragend="onTaskDragEnd"
            @dragover.prevent.stop @drop.stop="onTaskDrop($event, task)">
            <span class="bdrag" title="拖拽排序 / 跨指标归属">⋮⋮</span>
            <span class="bcheck" :class="{done: task.status==='done'}" @click="toggleTaskDone(task)">{{ task.status==='done'?'✓':'' }}</span>
            <span class="bt" @click="openDrawer(task)" title="点击打开任务详情">{{ task.title }}</span>
            <span class="tag" :class="prTag(task.priority)">{{ prLabel(task.priority) }}</span>
            <button class="icon-btn-sm del" @click="removeTask(task)">×</button>
          </div>
          <div class="task-add" @click="openTaskAdd(m)">＋ 添加任务（新建 / 关联）</div>
        </div>
      </div>
      <div v-if="!currentProject.metrics.length" class="empty-state">该项目暂无成功指标，点击下方添加</div>
      <!-- B27：未归类任务（指标已删除的孤儿任务） -->
      <div v-if="orphanTasks.length" class="metric-sec">
        <div class="metric-head2">
          <span class="tag warn" style="flex-shrink:0">⚠ 未归类任务</span>
          <span class="mname">原指标已删除 · 可拖回任意指标或删除</span>
        </div>
        <div class="task-rows">
          <div v-for="t in orphanTasks" :key="t.id" class="btask" :class="{done: t.status==='done'}" draggable="true"
            @dragstart="onTaskDragStart($event, t, '__orphan__')" @dragend="onTaskDragEnd" @dragover.prevent @drop="onTaskDrop($event, t)">
            <span class="bdrag" title="拖拽到指标归属">⋮⋮</span>
            <span class="bcheck" :class="{done: t.status==='done'}" @click="toggleTaskDone(t)">{{ t.status==='done'?'✓':'' }}</span>
            <span class="bt" @click="openDrawer(t)" title="点击打开任务详情">{{ t.title }}</span>
            <span class="tag" :class="prTag(t.priority)">{{ prLabel(t.priority) }}</span>
            <button class="icon-btn-sm del" @click="removeTask(t)">×</button>
          </div>
        </div>
      </div>
      <button class="mini-btn primary" style="width:100%;padding:10px;justify-content:center" @click="addMetric()">＋ 添加成功指标（同步方向树）</button>
      <div class="board-foot-hint">本展板与知源罗盘 · 方向树实时双向同步 · 任务完成自动回流指标进度与北极星 DHI</div>
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

    <!-- ===== 任务详情抽屉 ===== -->
    <Transition name="fade">
      <div v-if="drawerOpen" class="drawer-overlay" @click="closeDrawer" />
    </Transition>
    <Transition name="slide">
      <aside v-if="drawerOpen && drawerTask" class="tdrawer" @keydown.ctrl.enter.prevent="saveDrawer" @keydown.meta.enter.prevent="saveDrawer">
        <div class="td-head">
          <div class="td-check" :class="{done: drawerTask.status==='done'}" @click="drawerToggleDone">{{ drawerTask.status==='done'?'✓':'' }}</div>
          <textarea v-model="drawerTitle" class="td-title" rows="2" placeholder="任务标题..." />
          <div class="td-close" @click="closeDrawer">×</div>
        </div>
        <div class="td-body">
          <div class="td-label">📂 归属</div>
          <div class="td-field"><span>📦</span><span class="fv">{{ currentProject?.name }}</span></div>
          <div class="td-field"><span>🎯</span><span class="fv">{{ currentProject?.metrics.find(m=>m.id===drawerTask?.metricId)?.title || '—' }}</span></div>
          <div class="td-label">⚡ 优先级</div>
          <div class="td-field" @click="drawerCyclePriority">
            <span class="fv">{{ prLabel(drawerTask.priority) }}</span><span class="fh">点击切换 ›</span>
          </div>
          <div class="td-label">📌 状态</div>
          <div class="td-field" @click="drawerToggleDone">
            <span class="fv">{{ drawerTask.status==='done' ? '✅ 已完成' : drawerTask.status==='doing' ? '◐ 进行中' : '○ 待开始' }}</span><span class="fh">点击切换 ›</span>
          </div>
          <div class="td-label">📝 备注</div>
          <textarea v-model="drawerNote" class="td-note" placeholder="补充说明、验收标准、上下文链接…" />
          <div class="td-hint">💡 Ctrl+Enter 快速保存并关闭 · Esc 关闭</div>
        </div>
        <div class="td-foot">
          <button class="mini-btn danger" @click="drawerDelete">🗑 删除任务</button>
          <button class="mini-btn primary" @click="saveDrawer">✓ 保存并关闭（Ctrl+Enter）</button>
        </div>
      </aside>
    </Transition>

    <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
    <TaskAddDrawer :open="!!taskAddMetric" :metric-id="taskAddMetric?.id || ''" :project-id="currentProject?.id || ''"
      :metric-title="taskAddMetric?.title" @close="taskAddMetric = null" />

    
  </div>
</template>

<style scoped>
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.page-head .crumb { font-size: 12.5px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 600; }
.page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
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
.empty-state { text-align: center; padding: 48px 20px; color: var(--text-3); font-size: 13px; }

/* 展板 */
.board-layout { display: flex; gap: 20px; align-items: flex-start; }
.proj-toc { position: sticky; top: 16px; width: 200px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 8px; box-shadow: var(--shadow); max-height: calc(100vh - 200px); overflow-y: auto; }
.pt-title { font-size: 10.5px; font-weight: 700; color: var(--accent); letter-spacing: .5px; padding: 0 8px 8px; }
.pt-item { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 8px; cursor: pointer; transition: all .12s; border: 1px solid transparent; }
.pt-item:hover { background: var(--surface-3); }
.pt-item.active { background: var(--accent-light); border-color: rgba(14,122,78,.25); }
.pt-item.active .pt-name { color: var(--accent); font-weight: 600; }
.pt-name { flex: 1; min-width: 0; font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pt-pct { font-size: 10px; color: var(--text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.board { flex: 1; min-width: 0; max-width: 920px; }
.metric-sec .mname { outline: none; border-radius: 5px; padding: 2px 5px; margin: -2px -5px; cursor: text; }
.metric-sec .mname:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.metric-sec .mname:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.back-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.back-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12.5px; cursor: pointer; font-family: inherit; transition: all .15s; }
.back-btn:hover { border-color: var(--accent); color: var(--accent); }
.chain-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 22px; margin-bottom: 16px; }
.chain-line { display: flex; flex-direction: column; }
.ch-node { display: flex; align-items: flex-start; gap: 12px; }
.ch-ic { width: 30px; height: 30px; border-radius: 8px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.ch-node.hi .ch-ic { background: var(--accent-light); }
.ch-body { flex: 1; min-width: 0; padding-bottom: 14px; }
.ch-lab { font-size: 9.5px; font-weight: 700; letter-spacing: 1px; color: var(--text-3); text-transform: uppercase; }
.ch-txt { font-size: 13px; color: var(--text-2); line-height: 1.6; }
.ch-node.hi .ch-txt { color: var(--accent); font-weight: 600; font-size: 14px; }
.ch-link { width: 2px; height: 16px; margin-left: 14px; background: linear-gradient(to bottom, var(--accent), color-mix(in srgb, var(--accent) 25%, transparent)); border-radius: 2px; }
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
.create-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; max-width: 94vw; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 401; }
.cm-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.cm-head span:first-child { flex: 1; }
.cm-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; }
.cm-close:hover { background: var(--surface-3); color: var(--text); }
.cm-body { padding: 18px 20px; }
.cm-chain { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; }
.cm-node { display: flex; align-items: flex-start; gap: 9px; padding: 6px 0; }
.cm-node .cm-ic { font-size: 14px; padding-top: 1px; }
.cm-txt { font-size: 12.5px; color: var(--text-2); line-height: 1.5; min-width: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.cm-txt i { font-style: normal; font-size: 10px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-right: 8px; text-transform: uppercase; }
.cm-link { width: 2px; height: 12px; margin-left: 6px; background: linear-gradient(to bottom, var(--accent), color-mix(in srgb, var(--accent) 25%, transparent)); border-radius: 2px; }
.cm-select { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 12.5px; color: var(--text); border: 1px solid var(--border); outline: none; cursor: pointer; font-family: inherit; margin-bottom: 12px; }
.cm-select:focus { border-color: var(--accent); }
.cm-input { width: 100%; padding: 10px 13px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 13px; color: var(--text); border: 1px solid var(--border); outline: none; font-family: inherit; }
.cm-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.cm-foot { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border); }
.tdrawer { position: fixed; top: 0; right: 0; width: 400px; max-width: 94vw; height: 100%; background: var(--surface); border-left: 1px solid var(--border); z-index: 401; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.td-head { padding: 16px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; }
.td-check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; font-size: 12px; color: #fff; background: var(--surface); }
.td-check.done { background: var(--success); border-color: var(--success); }
.td-title { flex: 1; font-size: 15px; font-weight: 600; border: none; outline: none; background: transparent; font-family: inherit; line-height: 1.5; resize: none; color: var(--text); min-height: 44px; }
.td-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; flex-shrink: 0; }
.td-close:hover { background: var(--surface-3); color: var(--text); }
.td-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
.td-label { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin: 14px 0 7px; }
.td-label:first-child { margin-top: 0; }
.td-field { padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); cursor: pointer; display: flex; align-items: center; gap: 8px; border: 1px solid transparent; }
.td-field:hover { border-color: var(--border); background: var(--surface); }
.td-field .fv { flex: 1; }
.td-field .fh { font-size: 10px; color: var(--text-4); }
.td-note { width: 100%; min-height: 72px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; outline: none; font-family: inherit; resize: vertical; line-height: 1.6; background: var(--surface); color: var(--text); }
.td-note:focus { border-color: var(--accent); }
.td-hint { font-size: 10px; color: var(--text-4); text-align: center; margin-top: 10px; }
.td-foot { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
.td-foot .mini-btn { flex: 1; justify-content: center; padding: 9px; }

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
