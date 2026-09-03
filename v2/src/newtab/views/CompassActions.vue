<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useTaHeight } from '@/shared/utils/taHeight'
import { onOpenDrawer } from '@/shared/utils/bus'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import type { TaskCard, Project, FocusSlot, FieldDef, AssetMeta } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { d, allProjects, projectProgress } = useCompass()

// ---- 日期工具 ----
function formatDate(dt: Date): string {
  const week = ['周日','周一','周二','周三','周四','周五','周六']
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${week[dt.getDay()]}`
}
function dateStr(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}

// ---- 主攻项目速览条 ----
const focusProjects = computed(() => allProjects().filter(p => p.isFocused).slice(0, 2))
function projectDirName(projId: string): string {
  for (const dir of d.value.compass.directions) {
    if (dir.projects.some(p => p.id === projId)) return dir.name
  }
  return '未分类'
}
function gotoProjectCuration(projId: string) {
  router.push({ path: '/compass/projects', query: { p: projId } })
}

// ---- 今日三件事 ----
const todayDate = ref(new Date())
function shiftDate(n: number) { todayDate.value = new Date(todayDate.value.getTime() + n * 86400_000) }
const todayFocusList = computed<FocusSlot[]>(() => {
  const key = dateStr(todayDate.value)
  return (d.value.dailyFocus?.[key] || []).slice(0, 3)
})
function todayTaskForSlot(slot: FocusSlot): TaskCard | null {
  if (slot.sourceType === 'task' && slot.sourceId) {
    return d.value.tasks.find(t => !t.deletedAt && t.id === slot.sourceId) || null
  }
  return null
}

// 任务选取弹窗
const pickerOpen = ref(false)
const pickerSlot = ref(0)
const pickerSearch = ref('')
function openPicker(slot: number) {
  pickerSlot.value = Math.min(slot, 2)
  pickerSearch.value = ''
  pickerOpen.value = true
}
function selectTaskForSlot(task: TaskCard) {
  const key = dateStr(todayDate.value)
  if (!d.value.dailyFocus[key]) d.value.dailyFocus[key] = []
  const list = d.value.dailyFocus[key]
  const slot: FocusSlot = {
    id: uid('focus'),
    sourceType: 'task',
    sourceId: task.id,
    text: task.title,
    done: task.status === 'done',
    doneAt: task.completedAt
  }
  if (list[pickerSlot.value]) list[pickerSlot.value] = slot
  else list.push(slot)
  store.persist()
  pickerOpen.value = false
  showToast('✓ 已添加到今日三件事')
}
const pickerCandidates = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  return d.value.tasks
    .filter(t => !t.deletedAt)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) // 第十七轮：置顶优先
    .slice(0, 30)
})
/** B25：已完成或已选入今日三件事的任务置灰不可选 */
const pickedIds = computed(() => new Set(todayFocusList.value.map(s => s.sourceId)))
function pickerDisabled(t: TaskCard): boolean {
  return t.status === 'done' || pickedIds.value.has(t.id)
}
function selectTaskGuarded(t: TaskCard) {
  if (pickerDisabled(t)) { showToast(t.status === 'done' ? '该任务已完成' : '该任务已选入今日三件事'); return }
  selectTaskForSlot(t)
}
function removeTodaySlot(idx: number) {
  const key = dateStr(todayDate.value)
  if (d.value.dailyFocus[key]) {
    d.value.dailyFocus[key].splice(idx, 1)
    store.persist()
  }
}
function copyYesterday() {
  const today = dateStr(todayDate.value)
  const yesterday = dateStr(new Date(todayDate.value.getTime() - 86400_000))
  const yesterdayList = d.value.dailyFocus[yesterday]
  if (!yesterdayList || !yesterdayList.length) {
    showToast('昨日无三件事记录')
    return
  }
  d.value.dailyFocus[today] = JSON.parse(JSON.stringify(yesterdayList))
  d.value.dailyFocus[today].forEach(s => { s.done = false; s.doneAt = undefined })
  store.persist()
  showToast('✓ 已复制昨日三件事')
}
// ---- 第十七轮：导出弹窗（自定义时间范围 + 6 字段 CSV） ----
const exportOpen = ref(false)
const exportFrom = ref(dateStr(new Date()))
const exportTo = ref(dateStr(new Date()))
function openExportModal() {
  exportFrom.value = dateStr(new Date())
  exportTo.value = dateStr(new Date())
  exportOpen.value = true
}
function statusLabelOf(t?: TaskCard | null, done?: boolean): string {
  if (t) return t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始'
  return done ? '已完成' : '未完成'
}
const exportBusy = ref(false)
function doExport() {
  const from = exportFrom.value
  const to = exportTo.value
  if (!from || !to) { showToast('请选择起止日期'); return }
  if (from > to) { showToast('开始日期不能晚于结束日期'); return }
  const rows: string[][] = []
  for (const key of Object.keys(d.value.dailyFocus || {}).sort()) {
    if (key < from || key > to) continue
    for (const slot of d.value.dailyFocus[key] || []) {
      const t = slot.sourceType === 'task' && slot.sourceId
        ? d.value.tasks.find(x => x.id === slot.sourceId && !x.deletedAt) : null
      const proj = t ? projectName(t.projectId) : ''
      const met = t && t.metricId ? metricName(t.metricId) : ''
      rows.push([
        slot.text || (t?.title ?? ''),
        proj,
        proj && met !== '未关联' ? `${proj} / ${met}` : '',
        statusLabelOf(t, slot.done),
        key,
        t?.createdAt ? new Date(t.createdAt).toLocaleString('zh-CN') : '',
        t?.pinned ? '是' : '',
        t?.starred ? '是' : ''
      ])
    }
  }
  if (!rows.length) { showToast('所选范围内没有三件事记录'); return }
  exportBusy.value = true
  const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"'
  const csv = '任务内容,所属项目,项目→成功指标,任务状态,安排时间,创建时间,置顶,星标\n'
    + rows.map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `任务导出_${from}_${to}.csv`
  a.click(); URL.revokeObjectURL(url)
  exportOpen.value = false
  exportBusy.value = false
  showToast(`✓ 已导出 ${rows.length} 条记录`)
}
function toggleTodayDone(slot: FocusSlot) {
  slot.done = !slot.done
  slot.doneAt = slot.done ? Date.now() : undefined
  if (slot.sourceType === 'task' && slot.sourceId) {
    const t = d.value.tasks.find(x => x.id === slot.sourceId)
    if (t) {
      t.status = slot.done ? 'done' : 'todo'
      t.completedAt = slot.doneAt
      t.updatedAt = Date.now()
    }
  }
  store.persist()
}

// ---- 全域任务管理 ----
const viewMode = ref<'list' | 'kanban'>('list')
const groupByProject = ref(false)
const sortBy = ref('manual')
// 第卅二轮 REQ-007：任务时间/优先级排序方向（默认倒序）+ 排序偏好本地记忆（UIPrefs.sortPrefs.task）
const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.task?.dir === 'asc') ? 'asc' : 'desc')
if (store.ui?.sortPrefs?.task?.by) sortBy.value = store.ui.sortPrefs.task.by
// 第卅五轮 REQ-036：状态筛选偏好持久化（UIPrefs.sortPrefs.task.filter）
type TaskFilter = 'all' | 'todo' | 'doing' | 'done'
const savedFilter = store.ui?.sortPrefs?.task?.filter
const filterBy = ref<TaskFilter>(savedFilter === 'todo' || savedFilter === 'doing' || savedFilter === 'done' ? savedFilter : 'all')
watch([sortBy, sortDir, filterBy], () => {
  const sp = { ...(store.ui?.sortPrefs || {}), task: { by: sortBy.value, dir: sortDir.value, filter: filterBy.value } }
  if (store.ui) store.ui.sortPrefs = sp
  saveUIPrefs({ sortPrefs: sp })
})
function toggleSortDir() { sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc' }
const searchQuery = ref('')
const batchMode = ref(false)

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selectedTaskIds.value.clear()
}

const filteredTasks = computed(() => {
  let tasks = (d.value.tasks || []).filter(t => !t.deletedAt)
  // 第卅五轮 REQ-036：状态筛选枚举（全部状态/待办/推进中/已完成），与搜索、排序、分组多维叠加
  if (filterBy.value !== 'all') tasks = tasks.filter(t => t.status === filterBy.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    tasks = tasks.filter(t => t.title.toLowerCase().includes(q))
  }
  // 第卅二轮 REQ-007 + bug 修复：排序下拉此前未实际生效，此处补齐排序逻辑（manual=保持原顺序）
  if (sortBy.value !== 'manual') {
    const dirMul = sortDir.value === 'asc' ? 1 : -1
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 }
    tasks = [...tasks].sort((a, b) => {
      if (sortBy.value === 'recent') return dirMul * ((a.createdAt || 0) - (b.createdAt || 0))
      if (sortBy.value === 'priority') return dirMul * ((rank[a.priority || 'low'] || 0) - (rank[b.priority || 'low'] || 0))
      return 0
    })
  }
  return tasks
})
// R43-2 任务总数双值展示：当前筛选 N 条 / 全部 M（M 不随 filterBy/searchQuery 变化）
const totalTaskCount = computed(() => (d.value.tasks || []).filter(t => !t.deletedAt).length)
function clearTaskFilter() {
  filterBy.value = 'all'
  searchQuery.value = ''
}
// O14：按所属项目分组
const groupedTasks = computed(() => {
  const tasks = filteredTasks.value
  const groups: { key: string; name: string; pct: number; tasks: TaskCard[] }[] = []
  const used = new Set<string>()
  for (const p of allProjects()) {
    const ts = tasks.filter(t => t.projectId === p.id)
    if (ts.length) { groups.push({ key: p.id, name: p.name, pct: projectProgress(p).pct, tasks: ts }); ts.forEach(t => used.add(t.id)) }
  }
  const orphan = tasks.filter(t => !used.has(t.id))
  if (orphan.length) groups.push({ key: '__none__', name: '未关联项目', pct: -1, tasks: orphan })
  return groups
})
const todoTasks = computed(() => filteredTasks.value.filter(t => t.status === 'todo'))
const doingTasks = computed(() => filteredTasks.value.filter(t => t.status === 'doing'))
const doneTasks = computed(() => filteredTasks.value.filter(t => t.status === 'done'))
// 第卅三轮 BUG-D 修复 + REQ-020：置顶独立分区（源数组顺序权威不变，仅渲染分流）
const pinnedTasks = computed(() => filteredTasks.value.filter(t => t.pinned))
const normalTasks = computed(() => filteredTasks.value.filter(t => !t.pinned))

const selectedTaskIds = ref<Set<string>>(new Set())
function toggleSelect(taskId: string) {
  if (selectedTaskIds.value.has(taskId)) selectedTaskIds.value.delete(taskId)
  else selectedTaskIds.value.add(taskId)
}
function selectAll() {
  if (selectedTaskIds.value.size === filteredTasks.value.length) selectedTaskIds.value.clear()
  else filteredTasks.value.forEach(t => selectedTaskIds.value.add(t.id))
}
function batchDelete() {
  const removed: TaskCard[] = []
  selectedTaskIds.value.forEach(id => {
    const t = d.value.tasks.find(x => x.id === id)
    if (t) { t.deletedAt = Date.now(); removed.push(t) }
  })
  store.persist()
  showToast(`已删除 ${removed.length} 个任务`, { label: '撤销', cb: () => {
    // REQ-030：按 id 从当前数据树查找（persist 后 onChanged 整树替换，removed 中的旧引用已失效）
    removed.forEach(t => {
      const cur = d.value.tasks.find(x => x.id === t.id)
      if (cur && cur.deletedAt) {
        cur.deletedAt = undefined
        if (cur.metricId) {
          for (const dir of d.value.compass.directions) for (const proj of dir.projects) for (const m of proj.metrics)
            if (m.id === cur.metricId && !m.taskIds.includes(cur.id)) m.taskIds.push(cur.id)
        }
      }
    })
    store.persist()
  } })
  selectedTaskIds.value.clear()
}
function batchSetStatus(status: 'todo'|'doing'|'done') {
  selectedTaskIds.value.forEach(id => {
    const t = d.value.tasks.find(x => x.id === id)
    if (t) { t.status = status; t.updatedAt = Date.now(); if (status==='done') t.completedAt=Date.now() }
  })
  store.persist()
  showToast(`已将 ${selectedTaskIds.value.size} 个任务设为${status==='done'?'已完成':status==='doing'?'进行中':'待开始'}`)
  selectedTaskIds.value.clear()
}
function batchSetPriority(priority: 'low'|'medium'|'high') {
  selectedTaskIds.value.forEach(id => {
    const t = d.value.tasks.find(x => x.id === id)
    if (t) { t.priority = priority; t.updatedAt = Date.now() }
  })
  store.persist()
  showToast(`已将 ${selectedTaskIds.value.size} 个任务设为${priority==='high'?'高':priority==='medium'?'中':'低'}优先级`)
  selectedTaskIds.value.clear()
}

// ---- 批量挂载（O3）：挂到项目→指标 ----
const mountModalOpen = ref(false)
const mountProjId = ref('')
const mountMetId = ref('')
const mountProjectOptions = computed(() => allProjects())
const mountMetricOptions = computed(() =>
  mountProjectOptions.value.find(p => p.id === mountProjId.value)?.metrics || []
)
function openBatchMount() {
  if (!selectedTaskIds.value.size) return
  mountProjId.value = ''
  mountMetId.value = ''
  mountModalOpen.value = true
}
function confirmBatchMount() {
  if (!mountProjId.value) { showToast('请选择项目'); return }
  let count = 0
  selectedTaskIds.value.forEach(id => {
    const t = d.value.tasks.find(x => x.id === id)
    if (!t) return
    const oldMetric = t.metricId
    t.projectId = mountProjId.value
    t.metricId = mountMetId.value || undefined
    // 同步指标 taskIds
    for (const dir of d.value.compass.directions) {
      for (const proj of dir.projects) {
        for (const m of proj.metrics) {
          if (oldMetric && m.id === oldMetric) m.taskIds = m.taskIds.filter(x => x !== id)
          if (t.metricId && m.id === t.metricId && !m.taskIds.includes(id)) m.taskIds.push(id)
        }
      }
    }
    t.updatedAt = Date.now()
    count++
  })
  store.persist()
  mountModalOpen.value = false
  showToast(`✓ 已将 ${count} 个任务挂载到所选指标`)
  selectedTaskIds.value.clear()
}

// ---- 任务操作 ----
/** B22：状态统一出口（completedAt 卫生清理） */
function setTaskStatusOf(t: TaskCard, status: 'todo' | 'doing' | 'done') {
  t.status = status
  t.completedAt = status === 'done' ? Date.now() : undefined
  t.updatedAt = Date.now()
  store.persist()
}
function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  setTaskStatusOf(t, t.status === 'done' ? 'todo' : 'done')
}
function cycleTaskStatus(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const order: Array<'todo'|'doing'|'done'> = ['todo', 'doing', 'done']
  setTaskStatusOf(t, order[(order.indexOf(t.status as any) + 1) % 3])
}
/** 第卅二轮 REQ-006：任务详情面板时间戳可见 */
function fmtTaskTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
/** B22：抽屉内状态三选 chips */
function setTaskStatus(t: TaskCard, status: 'todo' | 'doing' | 'done') {
  if (t.status === status) return
  setTaskStatusOf(t, status)
  showToast('✓ 状态已切换为「' + (status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始') + '」')
}
async function deleteTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  t.deletedAt = Date.now()
  store.persist()
  closeTaskSidebar()
  // REQ-030：撤销（含指标 taskIds 回填，按 id 定位当前树）
  showToast(`已删除「${t.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = d.value.tasks.find(x => x.id === taskId)
    if (cur && cur.deletedAt) {
      cur.deletedAt = undefined
      if (cur.metricId) {
        for (const dir of d.value.compass.directions) for (const proj of dir.projects) for (const m of proj.metrics)
          if (m.id === cur.metricId && !m.taskIds.includes(cur.id)) m.taskIds.push(cur.id)
      }
    }
    store.persist()
  } })
}
function createNewTask() {
  const task: TaskCard = {
    id: uid('tk'),
    kind: 'task',
    title: '新任务',
    status: 'todo',
    priority: 'medium',
    mountedResourceIds: [],
    mountedCuriosityIds: [],
    customFields: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  d.value.tasks.unshift(task)
  store.persist()
  openTaskSidebar(task)
  showToast('✓ 新任务已创建')
  // 第卅一轮：自动聚焦标题并全选（此前焦点落在按钮上，默认标题「新任务」易堆积）
  nextTick(() => {
    const el = document.querySelector('.ts-title') as HTMLTextAreaElement | null
    if (el) { el.focus(); el.select() }
  })
}
function projectName(projId?: string): string {
  if (!projId) return '未关联'
  return allProjects().find(x => x.id === projId)?.name || '未关联'
}
function metricName(metricId?: string): string {
  if (!metricId) return '未关联'
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return m.title
    }
  }
  return '未关联'
}

// ---- 拖拽：列表排序 / 看板跨列 ----
let draggedTask: TaskCard | null = null
function onTaskDragStart(e: DragEvent, t: TaskCard) {
  draggedTask = t
  e.dataTransfer?.setData('text/plain', t.id)
}
function onTaskDrop(target: TaskCard, grouped?: boolean) {
  if (!draggedTask || draggedTask.id === target.id) { clearTaskDrop(); return }
  sortBy.value = 'manual'
  const after = taskDropAfter.value
  const moved = draggedTask
  const fromIdx = d.value.tasks.findIndex(x => x.id === moved.id)
  const toIdx = d.value.tasks.findIndex(x => x.id === target.id)
  if (fromIdx < 0 || toIdx < 0) { clearTaskDrop(); return }
  // 第廿八轮：分组列表跨组落卡 = 改项目归属（指标从属项目，跨组必然清空原指标）
  const notes: string[] = []
  if (grouped) {
    const projectKey = target.projectId || '__none__'
    if (projectKey !== '__none__' && moved.projectId !== projectKey) {
      const oldMetric = moved.metricId
      moved.projectId = projectKey
      moved.metricId = undefined
      syncMetricTaskIds(moved.id, oldMetric, undefined)
      moved.updatedAt = Date.now()
      notes.push('已归属「' + projectName(projectKey) + '」（原指标已清空）')
    }
  }
  const [item] = d.value.tasks.splice(fromIdx, 1)
  const newIdx = d.value.tasks.findIndex(x => x.id === target.id)
  d.value.tasks.splice(after ? newIdx + 1 : newIdx, 0, item)
  store.persist()
  draggedTask = null
  clearTaskDrop()
  showToast(notes.length ? `✓ ${notes.join('；')}` : '✓ 已调整排序')
}
// O8：看板列内卡片拖拽排序；第廿八轮：跨列落卡=改状态，分组模式跨组落卡=改项目归属（清空原指标）
// 状态/归属均从目标卡推导：目标卡所在的列与分组即落点语义，模板无需按列传参
function onTaskCardDrop(e: DragEvent, target: TaskCard, grouped: boolean) {
  e.preventDefault(); e.stopPropagation()
  const after = taskDropAfter.value
  clearTaskDrop()
  if (!draggedTask || draggedTask.id === target.id) return
  const moved = draggedTask
  draggedTask = null
  const fromIdx = d.value.tasks.findIndex(x => x.id === moved.id)
  const toIdx = d.value.tasks.findIndex(x => x.id === target.id)
  if (fromIdx < 0 || toIdx < 0) return
  const notes: string[] = []
  // 状态随列（completedAt 卫生走统一出口）
  const status = target.status
  if (moved.status !== status) {
    setTaskStatusOf(moved, status)
    notes.push(`已移至「${status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'}」`)
  }
  // 分组模式：跨项目组落卡 = 改项目归属（指标从属项目，跨组必然清空原指标）
  if (grouped) {
    const projectKey = target.projectId || '__none__'
    if (projectKey !== '__none__' && moved.projectId !== projectKey) {
      const oldMetric = moved.metricId
      moved.projectId = projectKey
      moved.metricId = undefined
      syncMetricTaskIds(moved.id, oldMetric, undefined)
      moved.updatedAt = Date.now()
      notes.push('已归属「' + projectName(projectKey) + '」（原指标已清空）')
    }
  }
  const [item] = d.value.tasks.splice(fromIdx, 1)
  const newToIdx = d.value.tasks.findIndex(x => x.id === target.id)
  d.value.tasks.splice(after ? newToIdx + 1 : newToIdx, 0, item)
  store.persist()
  showToast(notes.length ? `✓ ${notes.join('；')}` : '✓ 已调整排序')
}
function onKanbanDrop(status: 'todo' | 'doing' | 'done') {
  if (!draggedTask) return
  const t = d.value.tasks.find(x => x.id === draggedTask!.id)
  if (t && t.status !== status) {
    setTaskStatusOf(t, status)
    showToast(`✓ 已移至「${status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'}」`)
  }
  draggedTask = null
}

// ---- O17：看板列内按项目分组 + 拖拽改归属 ----
const kgDragOver = ref('')
const tgDragOver = ref('')
/** O21：分组列表跨组拖拽 = 改项目归属 */
function onListGroupDrop(e: DragEvent, projectKey: string) {
  e.preventDefault(); e.stopPropagation()
  tgDragOver.value = ''
  if (!draggedTask) return
  const t = draggedTask
  draggedTask = null
  if (projectKey === '__none__' || t.projectId === projectKey) return
  const oldMetric = t.metricId
  t.projectId = projectKey
  t.metricId = undefined
  syncMetricTaskIds(t.id, oldMetric, undefined)
  t.updatedAt = Date.now()
  store.persist()
  showToast('✓ 已归属「' + projectName(projectKey) + '」')
}
function kanbanGroups(status: 'todo' | 'doing' | 'done') {
  const src = status === 'todo' ? todoTasks.value : status === 'doing' ? doingTasks.value : doneTasks.value
  const groups: { key: string; name: string; tasks: TaskCard[] }[] = []
  const used = new Set<string>()
  for (const p of allProjects()) {
    const ts = src.filter(t => t.projectId === p.id)
    if (ts.length) { groups.push({ key: p.id, name: p.name, tasks: ts }); ts.forEach(t => used.add(t.id)) }
  }
  const orphan = src.filter(t => !used.has(t.id))
  if (orphan.length) groups.push({ key: '__none__', name: '未关联项目', tasks: orphan })
  return groups
}
/** 拖到项目小节 = 改项目归属（清空原指标），状态随所在列 */
function onKanbanGroupDrop(e: DragEvent, status: 'todo' | 'doing' | 'done', projectKey: string) {
  e.preventDefault(); e.stopPropagation()
  kgDragOver.value = ''
  if (!draggedTask) return
  const t = d.value.tasks.find(x => x.id === draggedTask!.id)
  draggedTask = null
  if (!t) return
  const notes: string[] = []
  if (projectKey !== '__none__' && t.projectId !== projectKey) {
    const oldMetric = t.metricId
    t.projectId = projectKey
    t.metricId = undefined
    syncMetricTaskIds(t.id, oldMetric, undefined)
    notes.push('已归属「' + projectName(projectKey) + '」（原指标已清空）')
  }
  if (t.status !== status) {
    setTaskStatusOf(t, status)
    notes.push(`已移至「${status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'}」`)
  } else {
    t.updatedAt = Date.now()
    store.persist()
  }
  if (notes.length) showToast('✓ ' + notes.join('；'))
}

// ---- 字段渲染 ----
const tFields = computed(() => visibleFields(d.value.fieldConfig, 'task'))
// R40 REQ-051：列表字段链排除 assets（正面改走 AssetBadge 徽章，不重复渲染文本摘要）
const tListFields = computed(() =>
  tFields.value.filter(f => !['title', 'description', 'assets'].includes(f.key)).slice(0, 4)
)
// R40 REQ-051：assets 字段是否可见（驱动任务卡正面徽章显隐）
const taskAssetsOn = computed(() => tFields.value.some(f => f.key === 'assets'))
function tVal(t: TaskCard, key: string): string {
  return fieldValue(t, key, { projectName, metricName })
}
function tShort(t: TaskCard, f: FieldDef): string {
  const v = tVal(t, f.key)
  if (f.key === 'priority') return t.priority === 'high' ? '🔴高' : t.priority === 'medium' ? '🟡中' : '🟢低'
  return v.length > 10 ? v.slice(0, 10) + '…' : v
}

// ---- 任务详情抽屉（B1 级联关联 + B2 Ctrl+Enter） ----
const sidebarOpen = ref(false)
// B7：抽屉宽度记忆（UIPrefs.drawerWs.task，360~640px）
const drawerW = ref(store.ui?.drawerWs?.task || 440)
function startDrawerResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startW = drawerW.value
  const move = (ev: MouseEvent) => {
    drawerW.value = Math.min(680, Math.max(360, startW + (startX - ev.clientX)))
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    if (!store.ui) return
    store.ui.drawerWs = { ...(store.ui.drawerWs || {}), task: Math.round(drawerW.value) }
    saveUIPrefs({ drawerWs: store.ui.drawerWs })
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
const selectedTask = ref<TaskCard | null>(null)
const taskTitleDraft = ref('')
/** 第卅三轮 REQ-024：任务备注文本框高度（默认 180px，拖拽记忆） */
const { taH: taskNoteH, startTaResize: startTaskNoteResize } = useTaHeight('task-note', store.ui)
const selProjectId = ref('')
const selMetricId = ref('')
const mountSearchR = ref('')
const mountSearchC = ref('')

function openTaskSidebar(task: TaskCard) {
  // R43-0 BUG-1 修复：selectedTask 必须指向 store 内的 reactive Proxy 元素。
  // 新建任务传入的是 unshift 前的原始对象——直接持有它会绕过 Proxy 的 set trap，
  // Ctrl+Enter 保存（selectedTask.value.title = val）不触发 trigger，列表不响应更新
  // （数据其实已入库，二次从列表点开才"看起来正常"）。find 取 Proxy 引用后一切赋值走响应式。
  selectedTask.value = d.value.tasks.find(x => x.id === task.id) || task
  taskTitleDraft.value = selectedTask.value.title
  selProjectId.value = selectedTask.value.projectId || ''
  selMetricId.value = selectedTask.value.metricId || ''
  mountSearchR.value = ''
  mountSearchC.value = ''
  sidebarOpen.value = true
}
function closeTaskSidebar() { sidebarOpen.value = false; selectedTask.value = null }

// ---- 第十三轮：三卡交互统一（单击详情 / 双击打开卡内链接） ----
function toOpenableLinkUrl(link?: string): string {
  const t = (link || '').trim()
  if (!t) return ''
  if (/^file:\/\//i.test(t)) return t
  if (/^[a-zA-Z]:[\\/]/.test(t)) return 'file:///' + encodeURI(t.replace(/\\/g, '/')).replace(/#/g, '%23')
  return t
}
function openCardLink(link?: string) {
  const url = toOpenableLinkUrl(link)
  if (!url) { showToast('该卡片还没有链接，可在详情中添加'); return }
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url })
  else window.open(url, '_blank')
}
let taskClickTimer: ReturnType<typeof setTimeout> | null = null
function onTaskRowClick(t: TaskCard) {
  if (taskClickTimer) { clearTimeout(taskClickTimer); taskClickTimer = null; return }
  taskClickTimer = setTimeout(() => { taskClickTimer = null; openTaskSidebar(t) }, 260)
}
function onTaskRowDblClick(t: TaskCard) {
  if (taskClickTimer) { clearTimeout(taskClickTimer); taskClickTimer = null }
  openCardLink(t.link)
}
/** 第十七轮：任务置顶切换 */
function toggleTaskPin(t: TaskCard) {
  t.pinned = !t.pinned
  t.updatedAt = Date.now()
  // 第卅三轮 BUG-D 修复：不再物理 unshift 改源数组顺序（那会破坏用户手动拖拽排序），
  // 置顶呈现交给模板独立分区（pinnedTasks / normalTasks），顺序权威仍是源数组。
  store.persist()
  showToast(t.pinned ? '📌 已置顶，将展示在置顶分区' : '已取消置顶')
}
/** 第卅三轮 REQ-020：任务星标切换（独立于置顶，可叠加） */
function toggleTaskStar(t: TaskCard) {
  t.starred = !t.starred
  t.updatedAt = Date.now()
  store.persist()
  showToast(t.starred ? '⭐ 已星标，搜索时优先展示' : '已取消星标')
}
/** 链接/备注就地保存 */
function touchTask() {
  if (!selectedTask.value) return
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
/** REQ-048：任务附件变更即时持久化 */
function onTaskAssetsChange(v: AssetMeta[]) {
  if (!selectedTask.value) return
  selectedTask.value.assets = v
  touchTask()
}
/** 第卌二轮 REQ-061：任务卡 HTML 上传联动——标题取文件名（仅空标题/旧文件名时覆盖，q-2 拍板）；第卌四轮 T-08 泛化支持 PDF */
function onTaskHtmlAdded(meta: AssetMeta, replacedOld: AssetMeta | null) {
  if (!selectedTask.value) return
  const stem = (meta.name || '').replace(/\.(html?|pdf)$/i, '')
  const oldStems = [replacedOld, ...(selectedTask.value.assets || []).filter(a => a.kind === meta.kind && a.id !== meta.id)]
    .filter((a): a is AssetMeta => !!a)
    .map(a => (a.name || '').replace(/\.(html?|pdf)$/i, ''))
  const cur = (selectedTask.value.title || '').trim()
  if (!cur || oldStems.includes(cur)) {
    if (stem) { selectedTask.value.title = stem; taskTitleDraft.value = stem }
  } else {
    showToast(`已替换原 ${meta.kind === 'pdf' ? 'PDF' : 'HTML'}；标题保留手打内容，可自行编辑`)
  }
  touchTask()
}
function saveTaskTitle() {
  if (!selectedTask.value) return
  const val = taskTitleDraft.value.trim()
  if (!val) { showToast('标题不能为空'); return }
  // R43-0 BUG-1 兜底：优先对 store 内 Proxy 元素写入（响应式），防 selectedTask 持有原始对象引用导致列表不更新
  const inStore = d.value.tasks.find(x => x.id === selectedTask.value!.id)
  const t = inStore || selectedTask.value
  t.title = val
  t.updatedAt = Date.now()
  selectedTask.value = t
  store.persist()
  showToast('✓ 已保存') // 第卅三轮 REQ-015：与资源/好奇抽屉一致补 Toast
}
function saveTaskTitleAndClose() {
  saveTaskTitle()
  closeTaskSidebar()
}

// B1：级联选择项目 → 指标
const sidebarProjects = computed(() => allProjects())
const sidebarMetrics = computed(() =>
  sidebarProjects.value.find(p => p.id === selProjectId.value)?.metrics || []
)
function onSelProjectChange() {
  selMetricId.value = ''
  if (!selectedTask.value) return
  const oldMetric = selectedTask.value.metricId
  selectedTask.value.projectId = selProjectId.value || undefined
  selectedTask.value.metricId = undefined
  syncMetricTaskIds(selectedTask.value.id, oldMetric, undefined)
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
function onSelMetricChange() {
  if (!selectedTask.value) return
  const oldMetric = selectedTask.value.metricId
  selectedTask.value.metricId = selMetricId.value || undefined
  syncMetricTaskIds(selectedTask.value.id, oldMetric, selectedTask.value.metricId)
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
function syncMetricTaskIds(taskId: string, oldMetricId?: string, newMetricId?: string) {
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const m of proj.metrics) {
        if (oldMetricId && m.id === oldMetricId) m.taskIds = m.taskIds.filter(x => x !== taskId)
        if (newMetricId && m.id === newMetricId && !m.taskIds.includes(taskId)) m.taskIds.push(taskId)
      }
    }
  }
}
function cyclePriority() {
  if (!selectedTask.value) return
  const order: Array<'low'|'medium'|'high'> = ['low', 'medium', 'high']
  selectedTask.value.priority = order[(order.indexOf(selectedTask.value.priority) + 1) % 3]
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}

// ---- 单向挂载：任务 → 资源 / 好奇心 ----
function resourceTitle(id: string): string {
  return d.value.resources.find(r => r.id === id && !r.deletedAt)?.title || ''
}
function curiosityTitle(id: string): string {
  return d.value.curiosities.find(c => c.id === id && !c.deletedAt)?.question || ''
}
function toggleMountResource(rid: string) {
  if (!selectedTask.value) return
  const arr = selectedTask.value.mountedResourceIds || []
  selectedTask.value.mountedResourceIds = arr.includes(rid) ? arr.filter(x => x !== rid) : [...arr, rid]
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
function toggleMountCuriosity(cid: string) {
  if (!selectedTask.value) return
  const arr = selectedTask.value.mountedCuriosityIds || []
  selectedTask.value.mountedCuriosityIds = arr.includes(cid) ? arr.filter(x => x !== cid) : [...arr, cid]
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
const mountResourceCandidates = computed(() => {
  const q = mountSearchR.value.trim().toLowerCase()
  return d.value.resources
    .filter(r => !r.deletedAt)
    .filter(r => !q || r.title.toLowerCase().includes(q))
    .slice(0, 8)
})
const mountCuriosityCandidates = computed(() => {
  const q = mountSearchC.value.trim().toLowerCase()
  return d.value.curiosities
    .filter(c => !c.deletedAt)
    .filter(c => !q || c.question.toLowerCase().includes(q))
    .slice(0, 8)
})

// ---- 高亮定位（B4：搜索任务结果跳转） ----
const highlightId = ref<string | null>(null)
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  highlightId.value = hl
  setTimeout(() => {
    document.querySelector(`[data-tid="${hl}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => { highlightId.value = null }, 2000)
  }, 350)
  router.replace({ path: route.path })
}, { immediate: true })

// 第卅六轮 REQ-039：搜索浮层单击 → 任务行高亮（已有 highlightId 即可响应）
onMounted(() => {
  const off = onOpenDrawer((p) => {
    if (p.kind === 'task') {
      highlightId.value = p.id
      setTimeout(() => document.querySelector(`[data-tid="${p.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      setTimeout(() => { highlightId.value = (highlightId.value === p.id ? null : highlightId.value) }, 2000)
    }
  })
  onUnmounted(() => { off() })
})

// B23：抽屉快捷键挂文档级（焦点在 TagPicker 浮层等 Teleport 内容内也能生效）
function onSidebarDocKey(e: KeyboardEvent) {
  if (!sidebarOpen.value) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveTaskTitleAndClose() }
  else if (e.key === 'Escape') { e.preventDefault(); closeTaskSidebar() }
}
// ---- B5：任务行右键菜单 + B6 拖拽插入线 ----
const taskCtx = ref({ open: false, x: 0, y: 0 })
const taskCtxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
const taskCtxTarget = ref<TaskCard | null>(null)
function openTaskCtx(e: MouseEvent, t: TaskCard) {
  taskCtxTarget.value = t
  taskCtxItems.value = [
    { label: '打开详情', icon: 'arrowright', cb: () => openTaskSidebar(t) },
    { label: t.pinned ? '取消置顶' : '置顶', icon: 'pin', cb: () => toggleTaskPin(t) },
    { label: t.starred ? '取消星标' : '星标', icon: 'star', cb: () => toggleTaskStar(t) },
    { label: '删除', icon: 'trash', danger: true, cb: () => deleteTask(t.id) }
  ]
  taskCtx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 200) }
}
const taskDropAfter = ref(false)
const taskDropKey = ref('')
function markTaskDrop(e: DragEvent, key: string) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  taskDropAfter.value = (e.clientY - rect.top) / rect.height > 0.5
  taskDropKey.value = key + (taskDropAfter.value ? '-b' : '-t')
}
function clearTaskDrop() { taskDropKey.value = '' }

// ---- B4：任务列表键盘导航（↑↓ 选择 / Enter 打开 / 空格批量勾选） ----
const taskNavIndex = ref(-1)
function onTaskNavKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if (sidebarOpen.value || exportOpen || pickerOpen || mountModalOpen) return
  if (viewMode.value !== 'list' || !filteredTasks.value.length) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const max = filteredTasks.value.length - 1
    taskNavIndex.value = e.key === 'ArrowDown'
      ? Math.min(taskNavIndex.value + 1, max)
      : Math.max(taskNavIndex.value - 1, 0)
    document.querySelector(`.trow[data-nav="${taskNavIndex.value}"]`)?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter' && taskNavIndex.value >= 0) {
    e.preventDefault()
    openTaskSidebar(filteredTasks.value[taskNavIndex.value])
  } else if (e.code === 'Space' && taskNavIndex.value >= 0) {
    e.preventDefault()
    toggleSelect(filteredTasks.value[taskNavIndex.value].id)
  }
}

// B9：Ctrl+←/→ 切换三件事日期（非输入焦点时）
function onDateKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); shiftDate(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
}
onMounted(() => {
  document.addEventListener('keydown', onSidebarDocKey, true)
  document.addEventListener('keydown', onDateKey, true)
  document.addEventListener('keydown', onTaskNavKey, true)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onSidebarDocKey, true)
  document.removeEventListener('keydown', onDateKey, true)
  document.removeEventListener('keydown', onTaskNavKey, true)
})
</script>

<template>
  <div class="actions-page">
    <div class="page-head">
      <div class="crumb">知源引擎 <span class="sep">/</span> <b>今日行动</b> · 让轨迹被自己看见</div>
      <div class="spacer" />
      <div class="hint-chip">今日三件事呼吸灯 · 聚焦不抢眼</div>
    </div>

    <!-- 主攻项目速览条 -->
    <div class="focus-strip">
      <span class="flab">🎯 主攻项目</span>
      <div v-for="proj in focusProjects" :key="proj.id" class="focus-chip" @click="gotoProjectCuration(proj.id)">
        <span class="fcn">{{ proj.name }}</span>
        <span class="progress bar"><i :style="{width: projectProgress(proj).pct + '%'}" /></span>
        <span class="fp">{{ projectProgress(proj).pct }}%</span>
        <span class="go">进入策展 →</span>
      </div>
      <div v-if="!focusProjects.length" class="focus-empty">暂无主攻项目，去方向树标记</div>
      <span class="all-link" @click="router.push('/compass/projects')">全部项目 → 项目策展</span>
    </div>

    <!-- 今日三件事 -->
    <div class="card module">
      <div class="card-head">
        <span class="ic"><Icon name="flame" :size="17" /></span><span class="nm">今日三件事</span><span class="en">TODAY'S FOCUS</span><span class="ds">锁定今日最重要的 3 件事</span>
        <div class="date-nav">
          <div class="dn" @click="shiftDate(-1)">‹</div>
          <div class="dd">{{ formatDate(todayDate) }}</div>
          <div class="dn" @click="shiftDate(1)">›</div>
        </div>
      </div>
      <div class="today-body">
        <div class="today-toolbar">
          <button class="mini-btn" @click="openPicker(todayFocusList.length)"><Icon name="clipboard" :size="13" />从库选取</button>
          <button class="mini-btn" @click="copyYesterday"><Icon name="copy" :size="13" />复制昨日</button>
          <button class="mini-btn" @click="openExportModal"><Icon name="download" :size="13" />导出</button>
        </div>
        <div class="today-cards">
          <template v-for="(slot, idx) in todayFocusList" :key="idx">
            <div v-if="todayTaskForSlot(slot)" class="today-card" :class="{done: slot.done}" @click="onTaskRowClick(todayTaskForSlot(slot)!)" @dblclick="onTaskRowDblClick(todayTaskForSlot(slot)!)">
              <div class="tc-num">{{ String(idx+1).padStart(2,'0') }}</div>
              <div class="tc-check" :class="{done: slot.done}" @click.stop="toggleTodayDone(slot)">{{ slot.done?'✓':'' }}</div>
              <div class="tc-title">{{ slot.text }}</div>
              <div class="tc-meta">
                <span class="tag accent">📦 {{ projectName(todayTaskForSlot(slot)?.projectId) }}</span>
                <span class="tag warn">🎯 {{ metricName(todayTaskForSlot(slot)?.metricId) }}</span>
                <AssetBadge v-if="taskAssetsOn && todayTaskForSlot(slot)?.assets?.length" :assets="todayTaskForSlot(slot)!.assets" />
              </div>
              <div class="tc-remove" @click.stop="removeTodaySlot(idx)" title="移除">×</div>
            </div>
          </template>
          <div v-for="n in (3 - todayFocusList.length)" :key="'empty-'+n" class="today-card empty-card" @click="openPicker(todayFocusList.length)">
            <div class="tc-num">{{ String(todayFocusList.length + n).padStart(2,'0') }}</div>
            <div class="tc-title empty-t">＋ 从任务库选取</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 全域任务管理 -->
    <div class="card module">
      <div class="card-head">
        <span class="ic"><Icon name="clipboard" :size="17" /></span><span class="nm">全域任务管理</span><span class="en">TASK MANAGER</span><span class="ds">所有任务的多维管理</span>
        <div class="head-actions">
          <button class="mini-btn" :class="{active: batchMode}" @click="toggleBatchMode">{{ batchMode ? '✓ 完成' : '☑ 批量管理' }}</button>
          <button class="mini-btn primary" @click="createNewTask"><span>＋</span>新建任务</button>
        </div>
      </div>
      <div class="mgr-body" :class="{batch: batchMode}">
        <div class="mgr-toolbar">
          <div class="view-tabs">
            <div class="view-tab" :class="{active: viewMode==='list'}" @click="viewMode='list'">☰ 列表</div>
            <div class="view-tab" :class="{active: viewMode==='kanban'}" @click="viewMode='kanban'">▦ 看板</div>
          </div>
          <select v-model="sortBy" class="sel">
            <option value="manual">手动排序</option>
            <option value="recent">最近添加</option>
            <option value="priority">优先级</option>
          </select>
          <!-- 第卅二轮 REQ-007：排序方向切换（默认倒序，偏好本地记忆） -->
          <button v-if="sortBy==='recent' || sortBy==='priority'" class="sel sort-dir-btn" :title="sortDir==='desc' ? '当前倒序，点击切换正序' : '当前正序，点击切换倒序'" @click="toggleSortDir">{{ sortDir==='desc' ? '↓ 倒序' : '↑ 正序' }}</button>
          <select v-model="filterBy" class="sel">
            <option value="all">全部状态</option>
            <option value="todo">待办</option>
            <option value="doing">推进中</option>
            <option value="done">已完成</option>
          </select>
          <button class="mini-btn" :class="{active: groupByProject}" @click="groupByProject = !groupByProject" title="列表视图按所属项目分组">📂 按项目分组</button>
          <div class="search-box"><span>🔍</span><input v-model="searchQuery" placeholder="搜索任务..."></div>
          <!-- R43-2 任务总数：当前筛选 N 条 / 全部 M，点击"全部 M"清除筛选 -->
          <span class="mgr-count"><span class="cur">{{ filteredTasks.length }} 条</span><span class="total" :class="{act: filterBy !== 'all' || searchQuery.trim()}" @click="clearTaskFilter" :title="filterBy !== 'all' || searchQuery.trim() ? '点击查看全部任务' : '全部任务数'">/ 全部 {{ totalTaskCount }}</span></span>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="batchMode && selectedTaskIds.size" class="batch-bar">
          <span class="batch-count">已选 {{ selectedTaskIds.size }} 项</span>
          <button class="mini-btn" @click="selectAll">全选/反选</button>
          <button class="mini-btn" @click="batchSetStatus('todo')">待开始</button>
          <button class="mini-btn" @click="batchSetStatus('doing')">进行中</button>
          <button class="mini-btn" @click="batchSetStatus('done')">已完成</button>
          <button class="mini-btn" @click="batchSetPriority('high')">🔴 高优</button>
          <button class="mini-btn" @click="batchSetPriority('medium')">🟡 中优</button>
          <button class="mini-btn" @click="batchSetPriority('low')">🟢 低优</button>
          <button class="mini-btn" @click="openBatchMount">📦 挂到项目→指标</button>
          <button class="mini-btn danger" @click="batchDelete">🗑 删除</button>
          <button class="mini-btn" @click="selectedTaskIds.clear()">取消</button>
        </div>

        <!-- 列表视图 · 按项目分组（O14） -->
        <div v-if="viewMode==='list' && groupByProject" class="task-list">
          <div v-for="grp in groupedTasks" :key="grp.key" class="tgroup">
            <div class="tg-head" :class="{'drag-over': tgDragOver === grp.key}"
              @dragover.prevent.stop="tgDragOver = grp.key"
              @dragleave="tgDragOver === grp.key && (tgDragOver = '')"
              @drop.stop="onListGroupDrop($event, grp.key)">
              <span class="tg-name" :class="{none: grp.key==='__none__'}">📦 {{ grp.name }}</span>
              <span v-if="grp.pct >= 0" class="tg-pct">{{ grp.pct }}%</span>
              <span class="tg-count">{{ grp.tasks.length }} 任务</span>
            </div>
            <div v-for="task in grp.tasks" :key="task.id" class="trow" :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, navsel: taskNavIndex>=0 && filteredTasks[taskNavIndex]?.id===task.id}"
              :data-tid="task.id"
              draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task, true)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
              <div v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)">{{ selectedTaskIds.has(task.id)?'✓':'' }}</div>
              <span v-else class="t-drag">⋮⋮</span>
              <div class="check-sm" :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)">{{ task.status==='done'?'✓':task.status==='doing'?'◐':'' }}</div>
              <span class="tname">{{ task.title }}</span>
              <div class="row-tags">
                <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
                <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              </div>
              <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button>
              <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button>
              <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务">🗑</button>
            </div>
          </div>
          <div v-if="!filteredTasks.length" class="list-empty">暂无任务</div>
        </div>

        <!-- 列表视图（拖拽排序 + 字段设计生效；第卅三轮 BUG-D 修复：置顶独立分区） -->
        <div v-else-if="viewMode==='list'" class="task-list">
          <template v-if="pinnedTasks.length">
            <div class="section-label">📌 置顶 · {{ pinnedTasks.length }}</div>
            <div v-for="(task, navIdx) in pinnedTasks" :key="task.id" class="trow pinned" :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, navsel: navIdx===taskNavIndex}"
              :data-tid="task.id"
              draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
              <div v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)">{{ selectedTaskIds.has(task.id)?'✓':'' }}</div>
              <span v-else class="t-drag">⋮⋮</span>
              <div class="check-sm" :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)">{{ task.status==='done'?'✓':task.status==='doing'?'◐':'' }}</div>
              <span class="tname">{{ task.title }}</span>
              <div class="row-tags">
                <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
                <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              </div>
              <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button>
              <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button>
              <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务">🗑</button>
            </div>
          </template>
          <div v-for="(task, navIdx) in normalTasks" :key="task.id" class="trow" :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, navsel: navIdx===taskNavIndex}"
            :data-tid="task.id"
            draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
            <div v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)">{{ selectedTaskIds.has(task.id)?'✓':'' }}</div>
            <span v-else class="t-drag">⋮⋮</span>
            <div class="check-sm" :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)">{{ task.status==='done'?'✓':task.status==='doing'?'◐':'' }}</div>
            <span class="tname">{{ task.title }}</span>
            <div class="row-tags">
              <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
            </div>
            <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button>
            <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button>
            <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务">🗑</button>
          </div>
          <EmptyState v-if="!filteredTasks.length" icon="clipboard" title="暂无任务"
            desc="点击下方按钮新建，或在方向树的成功指标下添加任务"
            action-label="＋ 新建任务" @action="createNewTask" />
        </div>

        <!-- 看板视图（跨列改状态 · 列内按项目分组 · 拖拽改归属 O17） -->
        <div v-else class="kanban-board">
          <div class="kcol" @dragover.prevent @drop="onKanbanDrop('todo')">
            <div class="khead"><span>待开始</span><span class="kcount">{{ todoTasks.length }}</span></div>
            <template v-if="groupByProject">
              <div v-for="grp in kanbanGroups('todo')" :key="grp.key" class="kgroup"
                :class="{'drag-over': kgDragOver === 'todo-' + grp.key}"
                @dragover.prevent.stop="kgDragOver = 'todo-' + grp.key"
                @dragleave="kgDragOver === 'todo-' + grp.key && (kgDragOver = '')"
                @drop.stop="onKanbanGroupDrop($event, 'todo', grp.key)">
                <div class="kg-head">
                  <span class="kg-name">📦 {{ grp.name }}</span>
                  <span class="kg-count">{{ grp.tasks.length }}</span>
                </div>
                <div v-for="task in grp.tasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                  @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
                  <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button><div class="kt">{{ task.title }}</div>
                  <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
                </div>
                <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
              </div>
              <div v-if="!kanbanGroups('todo').length" class="kg-empty" style="padding:20px">暂无任务</div>
            </template>
            <template v-else>
              <div v-for="task in todoTasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button><div class="kt">{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              </div>
            </template>
          </div>
          <div class="kcol" @dragover.prevent @drop="onKanbanDrop('doing')">
            <div class="khead"><span>进行中</span><span class="kcount">{{ doingTasks.length }}</span></div>
            <template v-if="groupByProject">
              <div v-for="grp in kanbanGroups('doing')" :key="grp.key" class="kgroup"
                :class="{'drag-over': kgDragOver === 'doing-' + grp.key}"
                @dragover.prevent.stop="kgDragOver = 'doing-' + grp.key"
                @dragleave="kgDragOver === 'doing-' + grp.key && (kgDragOver = '')"
                @drop.stop="onKanbanGroupDrop($event, 'doing', grp.key)">
                <div class="kg-head">
                  <span class="kg-name">📦 {{ grp.name }}</span>
                  <span class="kg-count">{{ grp.tasks.length }}</span>
                </div>
                <div v-for="task in grp.tasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                  @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
                  <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button><div class="kt">{{ task.title }}</div>
                  <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
                </div>
                <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
              </div>
              <div v-if="!kanbanGroups('doing').length" class="kg-empty" style="padding:20px">暂无任务</div>
            </template>
            <template v-else>
              <div v-for="task in doingTasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button><div class="kt">{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              </div>
            </template>
          </div>
          <div class="kcol" @dragover.prevent @drop="onKanbanDrop('done')">
            <div class="khead"><span>已完成</span><span class="kcount">{{ doneTasks.length }}</span></div>
            <template v-if="groupByProject">
              <div v-for="grp in kanbanGroups('done')" :key="grp.key" class="kgroup"
                :class="{'drag-over': kgDragOver === 'done-' + grp.key}"
                @dragover.prevent.stop="kgDragOver = 'done-' + grp.key"
                @dragleave="kgDragOver === 'done-' + grp.key && (kgDragOver = '')"
                @drop.stop="onKanbanGroupDrop($event, 'done', grp.key)">
                <div class="kg-head">
                  <span class="kg-name">📦 {{ grp.name }}</span>
                  <span class="kg-count">{{ grp.tasks.length }}</span>
                </div>
                <div v-for="task in grp.tasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                  @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
                  <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button><div class="kt">{{ task.title }}</div>
                  <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
                </div>
                <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
              </div>
              <div v-if="!kanbanGroups('done').length" class="kg-empty" style="padding:20px">暂无任务</div>
            </template>
            <template v-else>
              <div v-for="task in doneTasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶">📌</button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标">⭐</button><div class="kt">{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 任务选取弹窗 ===== -->
    <Transition name="fade">
      <div v-if="pickerOpen" class="overlay" @click="pickerOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="pickerOpen" class="picker-modal">
        <div class="pm-head">
          <span>📋 从任务库选取</span>
          <div class="pm-close" @click="pickerOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="pickerSearch" placeholder="搜索任务..."></div>
          <div v-for="task in pickerCandidates" :key="task.id" class="picker-item"
            :class="{disabled: pickerDisabled(task)}" @click="selectTaskGuarded(task)">
            <div class="pi-check">{{ pickerDisabled(task) ? '—' : '＋' }}</div>
            <div class="pi-info">
              <div class="pi-title">{{ task.title }}</div>
              <div class="pi-meta">
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
                <span class="tag" :class="{ok: task.status==='done'}">{{ task.status==='done'?'✅ 已完成':task.status==='doing'?'◐ 进行中':'○ 待开始' }}</span>
                <span v-if="pickedIds.has(task.id)" class="tag">已选入</span>
              </div>
            </div>
          </div>
          <div v-if="!pickerCandidates.length" class="list-empty">暂无任务</div>
        </div>
      </div>
    </Transition>

    <!-- ===== 第十七轮：三件事导出弹窗（时间范围） ===== -->
    <Transition name="fade">
      <div v-if="exportOpen" class="overlay" @click="exportOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="exportOpen" class="picker-modal" style="width:400px">
        <div class="pm-head">
          <span>⬇ 导出三件事任务（CSV）</span>
          <div class="pm-close" @click="exportOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="ts-label">时间范围（按三件事安排日期）</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="date" v-model="exportFrom" class="ts-select" style="flex:1">
            <span style="color:var(--text-3)">→</span>
            <input type="date" v-model="exportTo" class="ts-select" style="flex:1">
          </div>
          <div class="ts-goto" style="margin-top:10px">导出字段：任务内容 / 所属项目 / 项目→成功指标 / 任务状态 / 安排时间 / 创建时间</div>
        </div>
        <div class="modal-footer-row" style="display:flex;gap:8px;padding:14px 20px;border-top:1px solid var(--border);justify-content:flex-end">
          <button class="mini-btn" @click="exportOpen=false">取消</button>
          <button class="mini-btn primary" :disabled="exportBusy" @click="doExport">{{ exportBusy ? "导出中…" : "✓ 导出 CSV" }}</button>
        </div>
      </div>
    </Transition>

    <!-- ===== 批量挂载弹窗（O3） ===== -->
    <Transition name="fade">
      <div v-if="mountModalOpen" class="overlay" @click="mountModalOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="mountModalOpen" class="picker-modal" style="width:420px">
        <div class="pm-head">
          <span>📦 挂载 {{ selectedTaskIds.size }} 个任务到项目→指标</span>
          <div class="pm-close" @click="mountModalOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="ts-label">📦 所属项目</div>
          <select v-model="mountProjId" class="ts-select">
            <option value="">请选择项目…</option>
            <option v-for="p in mountProjectOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <div class="ts-label" style="margin-top:12px">🎯 成功指标（可选）</div>
          <select v-model="mountMetId" class="ts-select" :disabled="!mountProjId">
            <option value="">暂不归属指标</option>
            <option v-for="m in mountMetricOptions" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
            <button class="mini-btn" @click="mountModalOpen=false">取消</button>
            <button class="mini-btn primary" @click="confirmBatchMount">✓ 确认挂载</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ===== 任务详情抽屉（B1 级联 + B2 Ctrl+Enter） ===== -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="overlay" @click="closeTaskSidebar" />
    </Transition>
    <Transition name="slide">
      <div v-if="sidebarOpen && selectedTask" class="task-sidebar" :style="{ width: drawerW + 'px' }" @keydown.ctrl.enter.prevent="saveTaskTitleAndClose" @keydown.meta.enter.prevent="saveTaskTitleAndClose">
        <div class="ts-resize" @mousedown="startDrawerResize" />
        <div class="ts-head">
          <div class="check-lg" :class="{done: selectedTask.status==='done'}" @click="toggleTask(selectedTask.id)">{{ selectedTask.status==='done'?'✓':'' }}</div>
          <textarea v-model="taskTitleDraft" class="ts-title" rows="2" placeholder="任务标题..."
            @blur="saveTaskTitle" />
          <AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" class="ts-title-assets" />
          <div class="ts-close" @click="closeTaskSidebar">×</div>
        </div>
        <div class="ts-body">
          <div class="ts-section">
            <div class="ts-time-text">🕐 创建 {{ fmtTaskTs(selectedTask.createdAt) }} ｜ 更新 {{ fmtTaskTs(selectedTask.updatedAt) }}</div>
          </div>
          <div class="ts-section">
            <div class="ts-label">📦 所属项目（级联选择）</div>
            <select v-model="selProjectId" class="ts-select" @change="onSelProjectChange">
              <option value="">未关联项目</option>
              <option v-for="p in sidebarProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="ts-section">
            <div class="ts-label">🎯 成功指标（随项目级联）</div>
            <select v-model="selMetricId" class="ts-select" :disabled="!selProjectId" @change="onSelMetricChange">
              <option value="">暂不归属指标</option>
              <option v-for="m in sidebarMetrics" :key="m.id" :value="m.id">{{ m.title }}</option>
            </select>
            <div class="ts-goto" @click="router.push('/compass/tree')">🧭 没有合适的项目/指标？前往方向树创建 ›</div>
          </div>
          <div class="ts-section">
            <div class="ts-label">⚡ 优先级</div>
            <div class="ts-field" @click="cyclePriority">
              <span class="fv">{{ selectedTask.priority==='high'?'🔴 高优先级':selectedTask.priority==='medium'?'🟡 中优先级':'🟢 低优先级' }}</span>
              <span class="fh">点击切换 ›</span>
            </div>
          </div>
          <div class="ts-section">
            <div class="ts-label">📌 状态</div>
            <div class="ts-status-row">
              <button class="ts-status-chip" :class="{active: selectedTask.status==='todo'}" @click="setTaskStatus(selectedTask, 'todo')">○ 待开始</button>
              <button class="ts-status-chip" :class="{active: selectedTask.status==='doing'}" @click="setTaskStatus(selectedTask, 'doing')">◐ 进行中</button>
              <button class="ts-status-chip" :class="{active: selectedTask.status==='done'}" @click="setTaskStatus(selectedTask, 'done')">✅ 已完成</button>
            </div>
          </div>
          <div class="ts-section">
            <div class="ts-label">🔗 链接（网页 / 本地路径 / obsidian:// · 双击卡片直达）</div>
            <input v-model="selectedTask.link" class="ts-input" placeholder="https://… 或 D:\path\file.pdf" @blur="touchTask" @keydown.enter.prevent="($event.target as HTMLElement).blur()">
          </div>
          <div class="ts-section">
            <div class="ts-label ts-label-row">
              <span>📎 附件（图片弹窗预览 / HTML 新标签打开）</span>
              <AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" />
            </div>
            <AssetManager v-model="selectedTask.assets" @update:model-value="onTaskAssetsChange" @html-added="onTaskHtmlAdded" />
          </div>
          <div class="ts-section">
            <div class="ts-label">📝 备注（可拖拽右下角调整高度）</div>
            <div class="ta-wrap">
              <textarea v-model="selectedTask.description" class="ts-note" :style="{ height: taskNoteH + 'px' }" placeholder="补充说明、上下文、验收标准…" @blur="touchTask"></textarea>
              <div class="ta-resize" @mousedown="startTaskNoteResize" title="拖拽调节高度（记忆保存）"></div>
            </div>
          </div>
          <div class="ts-section">
            <div class="ts-label">🏷 标签（来自标签管理体系）</div>
            <TagPicker v-model="selectedTask.tags" />
          </div>
          <div class="ts-section">
            <div class="ts-label">🔗 挂载资源卡（单向挂载）</div>
            <div class="ts-mount-list">
              <div v-for="rid in selectedTask.mountedResourceIds.filter(id => resourceTitle(id))" :key="rid" class="ts-mount-item" @click="toggleMountResource(rid)" title="点击取消挂载">
                📄 {{ resourceTitle(rid) }} <span class="remove">×</span>
              </div>
              <div v-if="!selectedTask.mountedResourceIds.filter(id => resourceTitle(id)).length" class="ts-mount-empty">暂未挂载资源</div>
            </div>
            <div class="ts-mount-wrap">
              <input v-model="mountSearchR" class="ts-mount-search" placeholder="🔍 输入关键词搜索并挂载资源卡…">
              <div v-if="mountSearchR.trim()" class="ts-mount-pop">
                <div v-for="r in mountResourceCandidates" :key="r.id" class="ts-mount-cand"
                  :class="{on: selectedTask.mountedResourceIds.includes(r.id)}" @click="toggleMountResource(r.id)">
                  {{ selectedTask.mountedResourceIds.includes(r.id) ? '✓' : '＋' }} {{ r.title }}
                </div>
                <div v-if="!mountResourceCandidates.length" class="ts-mount-empty" style="padding:10px">无匹配资源</div>
              </div>
            </div>
          </div>
          <div class="ts-section">
            <div class="ts-label">💡 挂载好奇心卡（单向挂载）</div>
            <div class="ts-mount-list">
              <div v-for="cid in selectedTask.mountedCuriosityIds.filter(id => curiosityTitle(id))" :key="cid" class="ts-mount-item" @click="toggleMountCuriosity(cid)" title="点击取消挂载">
                💡 {{ curiosityTitle(cid) }} <span class="remove">×</span>
              </div>
              <div v-if="!selectedTask.mountedCuriosityIds.filter(id => curiosityTitle(id)).length" class="ts-mount-empty">暂未挂载好奇心</div>
            </div>
            <div class="ts-mount-wrap">
              <input v-model="mountSearchC" class="ts-mount-search" placeholder="🔍 输入关键词搜索并挂载好奇心…">
              <div v-if="mountSearchC.trim()" class="ts-mount-pop">
                <div v-for="c in mountCuriosityCandidates" :key="c.id" class="ts-mount-cand"
                  :class="{on: selectedTask.mountedCuriosityIds.includes(c.id)}" @click="toggleMountCuriosity(c.id)">
                  {{ selectedTask.mountedCuriosityIds.includes(c.id) ? '✓' : '＋' }} {{ c.question }}
                </div>
                <div v-if="!mountCuriosityCandidates.length" class="ts-mount-empty" style="padding:10px">无匹配好奇心</div>
              </div>
            </div>
          </div>
        </div>
        <div class="ts-foot">
          <button class="mini-btn danger" @click="deleteTask(selectedTask.id)">🗑 删除任务</button>
          <button class="mini-btn primary" @click="saveTaskTitleAndClose">✓ 完成并关闭（Ctrl+Enter）</button>
        </div>
      </div>
    </Transition>

    <ContextMenu :state="taskCtx" :items="taskCtxItems" @close="taskCtx.open = false" />

    
  </div>
</template>

<style scoped>
.actions-page { max-width: 1180px; margin: 0 auto; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.page-head .crumb { font-size: 12.5px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 600; }
.page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }

.card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid rgba(0,0,0,.025); }
.card-head { display: flex; align-items: center; gap: 8px; padding: 16px 20px 10px; flex-wrap: wrap; }
.card-head .ic { font-size: 16px; color: var(--accent); display: flex; align-items: center; }
.card-head .nm { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
.card-head .en { font-size: 9px; color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; }
.card-head .ds { font-size: 11.5px; color: var(--text-3); margin-left: 6px; flex: 1; }
.card-head .head-actions { display: flex; gap: 8px; }
.module { margin-bottom: 18px; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.mini-btn.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.tag { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; white-space: nowrap; }
/* R40 REQ-051：任务卡看板/选取弹窗附件徽章与项目 tag 并排时的垂直对齐 */
.kc-assets { margin-left: 2px; }
.tag.accent { background: var(--accent-light); color: var(--accent); }
.tag.warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.tag.status-doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.status-done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.progress { height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; }
.progress > i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s ease; }

/* 主攻速览条 */
.focus-strip { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 13px 18px; margin-bottom: 18px; flex-wrap: wrap; }
.focus-strip .flab { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: .5px; display: flex; align-items: center; gap: 5px; }
.focus-chip { display: flex; align-items: center; gap: 9px; background: var(--accent-light); border-radius: 8px; padding: 7px 13px; cursor: pointer; transition: all .15s; }
.focus-chip:hover { background: var(--accent); }
.focus-chip .fcn { font-size: 12.5px; font-weight: 600; color: var(--accent); }
.focus-chip .bar { width: 64px; }
.focus-chip .fp { font-size: 11px; font-weight: 700; color: var(--accent); }
.focus-chip .go { font-size: 10.5px; color: var(--text-3); }
.focus-strip .all-link { margin-left: auto; font-size: 11.5px; color: var(--accent); cursor: pointer; font-weight: 500; }
.focus-strip .all-link:hover { text-decoration: underline; }
.focus-empty { font-size: 11.5px; color: var(--text-3); }

/* 今日三件事 */
.date-nav { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.date-nav .dn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); font-size: 14px; }
.date-nav .dn:hover { background: var(--surface-3); }
.date-nav .dd { padding: 0 12px; font-size: 12px; font-weight: 500; border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-width: 128px; text-align: center; }
.today-body { padding: 0 20px 16px; }
.today-toolbar { display: flex; gap: 6px; margin-bottom: 10px; }
.today-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
/* R43-3 紧凑化：取消 min-height、收紧 padding/间距，高度随内容自适应 */
.today-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px 11px; cursor: pointer; transition: all .15s ease; position: relative; display: flex; flex-direction: column; }
.today-card:not(.empty-card) { animation: tcBreathe 4s ease-in-out infinite; }
@keyframes tcBreathe { 0%,100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 6%, transparent); } }
.today-card:hover { border-color: var(--border-strong); background: var(--surface); }
.today-card.done { opacity: .6; }
.today-card.done .tc-title { text-decoration: line-through; color: var(--text-3); }
.today-card.empty-card { opacity: .55; border-style: dashed; background: transparent; align-items: center; justify-content: center; }
.today-card.empty-card:hover { opacity: .9; border-color: var(--accent); color: var(--accent); }
.tc-num { position: absolute; top: 10px; right: 12px; font-size: 11px; color: var(--text-3); font-weight: 600; }
.tc-check { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; flex-shrink: 0; font-size: 11px; color: #fff; background: var(--surface); }
.tc-check.done { background: var(--success); border-color: var(--success); }
.tc-title { font-size: 14px; font-weight: 600; line-height: 1.4; flex: 1; }
.tc-title.empty-t { color: var(--text-3); font-weight: 400; }
.tc-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.tc-meta .tag { font-size: 11px; padding: 1px 7px; }
.tc-remove { position: absolute; top: 8px; left: 12px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 13px; color: var(--text-3); cursor: pointer; opacity: 0; transition: all .15s; }
.today-card:hover .tc-remove { opacity: 1; }
.tc-remove:hover { background: var(--danger); color: #fff; }

/* 全域任务 */
.mgr-body { padding: 0 20px 20px; }
.mgr-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.view-tabs { display: flex; background: var(--surface-2); border-radius: 8px; padding: 3px; gap: 2px; }
.view-tab { padding: 6px 13px; border-radius: 6px; font-size: 12px; cursor: pointer; color: var(--text-2); transition: all .15s; }
.view-tab.active { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.sel { padding: 6px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; color: var(--text-2); cursor: pointer; outline: none; font-family: inherit; }
.sort-dir-btn { white-space: nowrap; font-size: 11.5px; }
.sort-dir-btn:hover { border-color: var(--accent); color: var(--text-1); }
.search-box { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.search-box:focus-within { border-color: var(--accent); }
.search-box input { border: none; outline: none; font-size: 12px; width: 150px; background: transparent; color: var(--text); font-family: inherit; }
/* R43-2 任务总数双值展示 */
.mgr-count { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--text-3); white-space: nowrap; flex-shrink: 0; padding-right: 4px; }
.mgr-count .cur { color: var(--text-2); font-weight: 600; }
.mgr-count .total { cursor: default; }
.mgr-count .total.act { cursor: pointer; color: var(--accent); font-weight: 600; }
.mgr-count .total.act:hover { text-decoration: underline; }
.batch-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: var(--accent-light); border-radius: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.batch-count { font-size: 12px; font-weight: 700; color: var(--accent); margin-right: 4px; }
.task-list { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.trow { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border); transition: background .1s; }
.trow:last-child { border-bottom: none; }
.trow:hover { background: var(--surface); }
.trow.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.trow.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.trow.selected { background: var(--accent-light); }
.trow.navsel { box-shadow: inset 2px 0 0 var(--accent); background: var(--surface); }
.trow.done { opacity: .6; }
.trow.done .tname { text-decoration: line-through; color: var(--text-3); }
.trow.flash { animation: tflash 2s ease-out; }
@keyframes tflash { 0%,60% { background: var(--accent-light); box-shadow: inset 3px 0 0 var(--accent); } 100% { background: transparent; } }
.t-drag { color: var(--text-4); font-size: 11px; cursor: grab; flex-shrink: 0; }
.batch-check { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; background: var(--surface); }
.batch-check.checked { background: var(--accent); border-color: var(--accent); }
.check-sm { width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--border-strong); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; background: var(--surface); cursor: pointer; }
/* R43-1 批量模式只保留勾选框：隐藏状态切换 check-sm，避免双复选框 */
.mgr-body.batch .check-sm { display: none; }
.check-sm.done { background: var(--success); border-color: var(--success); }
.tname { font-size: 13px; flex: 1; min-width: 0; cursor: pointer; }
.tname:hover { color: var(--accent); }
.row-tags { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
.list-empty { text-align: center; padding: 30px; font-size: 13px; color: var(--text-3); }
/* B22：状态三选 chips */
.ts-status-row { display: flex; gap: 6px; }
.ts-status-chip { flex: 1; padding: 8px 4px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); font-size: 11.5px; cursor: pointer; font-family: inherit; color: var(--text-2); transition: all .12s; white-space: nowrap; }
.ts-status-chip:hover { border-color: var(--accent); color: var(--accent); }
.ts-status-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
.list-empty-rich { padding: 40px 20px; }
.list-empty-rich .le-icon { font-size: 34px; opacity: .4; margin-bottom: 8px; }
.list-empty-rich .le-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
.list-empty-rich .le-desc { font-size: 11.5px; line-height: 1.8; color: var(--text-3); }
.tgroup { border-bottom: 1px solid var(--border); }
.tgroup:last-child { border-bottom: none; }
.tg-head { display: flex; align-items: center; gap: 8px; padding: 9px 16px; background: var(--surface-3); position: sticky; top: 0; cursor: default; transition: background .12s; }
.tg-head.drag-over { background: var(--accent-light); box-shadow: inset 0 2px 0 var(--accent); }
.tg-name { font-size: 12px; font-weight: 700; color: var(--text); }
.tg-name.none { color: var(--text-3); }
.tg-pct { font-size: 10.5px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.tg-count { margin-left: auto; font-size: 10px; color: var(--text-3); background: var(--surface); padding: 1px 8px; border-radius: 99px; }
.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.kgroup { background: var(--surface-2); border-radius: var(--radius-xs); padding: 8px; margin-bottom: 10px; border: 1px dashed transparent; transition: border-color .15s; }
.kgroup.drag-over { border-color: var(--accent); background: var(--accent-light); }
.kg-head { display: flex; align-items: center; gap: 6px; padding: 4px 6px 8px; }
.kg-name { font-size: 11px; font-weight: 700; color: var(--text-2); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kg-count { font-size: 9.5px; color: var(--text-3); background: var(--surface); padding: 1px 7px; border-radius: 99px; }
.kg-empty { font-size: 10.5px; color: var(--text-4); text-align: center; padding: 10px; border: 1px dashed var(--border); border-radius: 6px; }
.kcol { background: var(--surface-2); border-radius: var(--radius-sm); padding: 12px; min-height: 220px; }
.khead { position: sticky; top: 0; z-index: 1; background: var(--surface-2); display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 0; font-size: 12.5px; font-weight: 600; }
.kcount { font-size: 10px; background: var(--surface); color: var(--text-3); padding: 1px 7px; border-radius: 99px; font-weight: 500; }
.kcard { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 10px 13px; margin-bottom: 8px; cursor: pointer; transition: all .15s; }
.kcard:hover { border-color: var(--border-strong); background: var(--surface-2); }
.kcard.done { opacity: .6; }
.kcard.done .kt { text-decoration: line-through; }
.kcard.flash { animation: tflash 2s ease-out; }
.trow.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.trow.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.kcard.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.kcard.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.kt { font-size: 12.5px; font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
/* 第十七轮：看板卡置顶右上角 */
.k-pin { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: 11px; cursor: pointer; opacity: 0; transition: all .15s ease; z-index: 1; }
/* 第卅三轮 REQ-020：看板卡星标（与置顶并排，右移错位） */
.k-star { position: absolute; top: 6px; right: 32px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: 11px; cursor: pointer; opacity: 0; transition: all .15s ease; z-index: 1; }
.kcard { position: relative; }
.kcard:hover .k-pin, .kcard:hover .k-star { opacity: .6; }
.k-pin:hover, .k-star:hover { opacity: 1 !important; background: var(--surface-3); }
.k-pin.on, .k-star.on { opacity: 1; }
/* 列表行置顶按钮 */
.t-pin { width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: 0; transition: all .15s ease; flex-shrink: 0; }
.t-star { width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: 0; transition: all .15s ease; flex-shrink: 0; }
.t-del { width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: 0; transition: all .15s ease; flex-shrink: 0; }
.trow:hover .t-pin, .trow:hover .t-star, .trow:hover .t-del { opacity: .6; }
.t-pin:hover, .t-star:hover { opacity: 1 !important; background: var(--surface-3); }
.t-pin.on, .t-star.on { opacity: 1; }
/* R43-2 卡片 hover 删除按钮：悬停变红警示 */
.t-del:hover { opacity: 1 !important; background: var(--danger-light, rgba(231,76,60,.12)); color: var(--danger, #e74c3c); }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 200; }
.picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-width: 92vw; max-height: 70vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 201; display: flex; flex-direction: column; overflow: hidden; }
.pm-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.pm-head span:first-child { flex: 1; }
.pm-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; }
.pm-close:hover { background: var(--surface-3); color: var(--text); }
.pm-body { flex: 1; overflow-y: auto; padding: 14px 20px; }
.picker-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-2); border-radius: 8px; margin-bottom: 6px; cursor: pointer; transition: all .1s; }
.picker-item:hover { background: var(--accent-light); }
.picker-item.disabled { opacity: .38; cursor: not-allowed; }
.picker-item.disabled:hover { background: var(--surface-2); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.picker-item.disabled { opacity: .38; cursor: not-allowed; }
.picker-item.disabled:hover { background: var(--surface-2); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.pi-check { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.pi-info { flex: 1; min-width: 0; }
.pi-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.pi-meta { display: flex; gap: 5px; flex-wrap: wrap; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.modal-enter-active, .modal-leave-active { transition: all .15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.95); }
.slide-enter-active, .slide-leave-active { transition: transform .2s cubic-bezier(.16,1,.3,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

/* 任务抽屉 */
.ts-time-text { font-size: 11px; color: var(--text-3); }
.task-sidebar { position: fixed; top: 0; right: 0; width: 440px; max-width: 94vw; height: 100%; background: var(--surface); border-left: 1px solid var(--border); z-index: 201; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.ts-resize { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 3; }
.ts-resize:hover { background: var(--accent); opacity: .4; }
.ts-head { padding: 18px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; }
.check-lg { width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; font-size: 13px; color: #fff; background: var(--surface); }
.check-lg.done { background: var(--success); border-color: var(--success); }
.ts-title { flex: 1; font-size: 16px; font-weight: 600; color: var(--text); border: none; outline: none; background: transparent; font-family: inherit; line-height: 1.5; resize: none; min-height: 44px; }
.ts-title-assets { flex-shrink: 0; }
.ts-close { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; color: var(--text-3); font-size: 18px; flex-shrink: 0; }
.ts-close:hover { background: var(--surface-3); color: var(--text); }
.ts-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.ts-section { margin-bottom: 16px; }
.ts-label { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 7px; }
.ts-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ts-select { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; }
.ts-select:focus { border-color: var(--accent); }
.ts-select:disabled { opacity: .5; cursor: not-allowed; }
.ts-goto { margin-top: 7px; font-size: 11px; color: var(--accent); cursor: pointer; }
.ts-input { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; font-family: inherit; }
.ts-input:focus { border-color: var(--accent); }
.ts-note { width: 100%; min-height: 64px; max-height: 320px; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; font-family: inherit; resize: vertical; line-height: 1.7; }
.ts-note:focus { border-color: var(--accent); }
/* 第卅三轮 REQ-024：文本框拖拽手柄（高度经 UIPrefs.taHeights 记忆） */
.ta-wrap { position: relative; }
.ta-resize { position: absolute; right: 3px; bottom: 3px; width: 16px; height: 12px; cursor: ns-resize; z-index: 2; opacity: .45; border-right: 3px solid var(--text-3); border-bottom: 3px solid var(--text-3); border-bottom-right-radius: 3px; }
.ta-resize:hover { opacity: .9; }
.ts-goto:hover { text-decoration: underline; }
.ts-field { padding: 10px 13px; background: var(--surface-2); border-radius: 8px; font-size: 13px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 8px; border: 1px solid transparent; }
.ts-field:hover { border-color: var(--border); background: var(--surface); }
.ts-field .fv { flex: 1; }
.ts-field .fh { font-size: 10px; color: var(--text-4); }
.ts-mount-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.ts-mount-item { display: flex; align-items: center; gap: 5px; padding: 4px 10px; background: var(--accent-light); border-radius: 99px; font-size: 11.5px; color: var(--accent); cursor: pointer; max-width: 100%; }
.ts-mount-item:hover { background: var(--danger); color: #fff; }
.ts-mount-item .remove { font-size: 10px; opacity: .6; }
.ts-mount-empty { font-size: 11px; color: var(--text-3); padding: 2px 0; }
.ts-mount-search { width: 100%; margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 7px 11px; font-size: 12px; font-family: inherit; outline: none; background: var(--surface); color: var(--text); }
.ts-mount-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.ts-mount-wrap { position: relative; margin-top: 8px; }
.ts-mount-pop { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-lg); max-height: 240px; overflow-y: auto; padding: 4px; }
.ts-mount-cands { margin-top: 6px; display: flex; flex-direction: column; gap: 3px; max-height: 150px; overflow-y: auto; }
.ts-mount-cand { padding: 6px 10px; border-radius: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ts-mount-cand:hover { background: var(--accent-light); color: var(--accent); }
.ts-mount-cand.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.ts-foot { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
.ts-foot .mini-btn { flex: 1; justify-content: center; padding: 9px; }
@media (max-width: 1080px) { .today-cards { grid-template-columns: 1fr; } }
</style>
