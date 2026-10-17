<script setup lang="ts">
// 第卌五轮 T-03：全域任务管理面板（自 CompassActions.vue 整体抽离，迁入「资源罗盘 → 好奇心培育」专区 Tab；V2.20.1 改名任务调度）
// 全量能力保留：批量管理 / 状态筛选 / 排序+方向 / 按项目分组 / 搜索 / 拖拽排序（跨组=改归属）/ 看板 / 右键菜单 / 键盘导航
// 第卌五轮新增：卡片视图（默认），与好奇心卡片视觉一致
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { uid } from '@/shared/utils'
import { saveUIPrefs } from '@/shared/storage/repository'
import { onOpenDrawer } from '@/shared/utils/bus'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import { useBatchSelect, addTagToCards } from '../../composables/useBatchSelect'
import DeckBatchBar from './DeckBatchBar.vue'
import DeckControls from './DeckControls.vue'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import type { TaskCard, Subtask, FieldDef } from '@/shared/models'
import { recordCardOpen } from '@/shared/storage/stats'
// R129-B5：链接协议白名单与打开通道全站唯一实现
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity } from '@/shared/utils/maturity'
// R117（04-61 C3）：当日新增角标（自然日口径）——卡片 / 列表 / 看板三视图同一枚
import NewBadge from '@/shared/components/NewBadge.vue'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { useCardCols } from '@/shared/utils/cardCols'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
// R147-d：任务行「知」AI 辅助菜单（与项目详情页同一组件）
import TaskAiMenu from '@/newtab/components/TaskAiMenu.vue'
// W6（V3.8.6）#3：卡片视图右上角 AI 入口 —— 点击直接跑补全（详情走单击卡片）
import TaskAiCorner from '@/newtab/components/TaskAiCorner.vue'
import SubtaskList from '@/shared/components/SubtaskList.vue'
// R113-N2：LifecyclePanel / useLifecycle 移除——生命周期入口收敛到 设置→总览

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { d, allProjects, projectProgress, taskArchiveIssue } = useCompass()

const drawerRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)

// ---- 视图与工具栏状态 ----
// 第卌五轮：卡片视图默认（card | list | kanban）
/** W6（V3.8.6）#3：默认列表视图（用户拍板；R176 曾改 card，本轮随卡片视图 AI 入口重构改回 list） */
const viewMode = ref<'card' | 'list' | 'kanban'>('list')
// R72：卡片视图横向列数（4/5/6/7，记忆 UIPrefs.cardCols.task；网格模板由 --grid-cols 驱动）
const taskCols = useCardCols('task', store.ui)
/** R127：分组三档（默认按项目；列表视图用） */
type TaskGroupMode = 'project' | 'status' | 'pin'
const groupMode = ref<TaskGroupMode>((store.ui?.sortPrefs?.task as { group?: TaskGroupMode } | undefined)?.group || 'project')
/** 看板沿用「按项目分组」开关语义（映射自 groupMode） */
const groupByProject = computed(() => groupMode.value === 'project')
const sortBy = ref('manual')
// 第卅二轮 REQ-007：任务时间/优先级排序方向（默认倒序）+ 排序偏好本地记忆（UIPrefs.sortPrefs.task）
const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.task?.dir === 'asc') ? 'asc' : 'desc')
if (store.ui?.sortPrefs?.task?.by) sortBy.value = store.ui.sortPrefs.task.by
// 第卅五轮 REQ-036：状态筛选偏好持久化（UIPrefs.sortPrefs.task.filter）｜ R58-O2：新增「未归档」维度（快速采集沉淀池的就地治理入口）
type TaskFilter = 'all' | 'todo' | 'doing' | 'done' | 'unarchived'
const savedFilter = store.ui?.sortPrefs?.task?.filter
const filterBy = ref<TaskFilter>(savedFilter === 'todo' || savedFilter === 'doing' || savedFilter === 'done' || savedFilter === 'unarchived' ? savedFilter : 'all')
watch([sortBy, sortDir, filterBy, groupMode], () => {
  const sp = { ...(store.ui?.sortPrefs || {}), task: { by: sortBy.value, dir: sortDir.value, filter: filterBy.value, group: groupMode.value } }
  if (store.ui) store.ui.sortPrefs = sp
  saveUIPrefs({ sortPrefs: sp })
})
function toggleSortDir() { sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc' }
const searchQuery = ref('')
/** R3-Cc2：控制行值域配置（视图/筛选/排序/分组），模板里不再各写一份 option 列表 */
const TASK_VIEWS = [{ id: 'card', label: '卡片' }, { id: 'list', label: '列表' }, { id: 'kanban', label: '看板' }]
const TASK_FILTERS = [{ id: 'all', label: '全部状态' }, { id: 'todo', label: '待办' }, { id: 'doing', label: '推进中' }, { id: 'done', label: '已完成' }, { id: 'unarchived', label: '未归档' }]
const TASK_SORTS = [{ id: 'manual', label: '手动排序' }, { id: 'recent', label: '最近添加' }, { id: 'priority', label: '优先级' }]
const TASK_GROUPS = [{ id: 'project', label: '按项目分组' }, { id: 'status', label: '按任务状态分组' }, { id: 'pin', label: '按置顶与否分组' }]
const batchMode = ref(false)

function toggleBatchMode() { batchMode.value = setBatchMode(!batchMode.value) }

/** R110-LC（T3）：统一任务过滤管线（软删 → 状态/未归档 → 搜索）——归档提示与默认列表复用同一口径 */
function applyTaskFilters(list: TaskCard[]): TaskCard[] {
  let out = list.filter(t => !t.deletedAt)
  // R58-O2：未归档口径与北极星 O23 一致（taskArchiveIssue：未挂项目/指标或引用失效）
  if (filterBy.value === 'unarchived') out = out.filter(t => !!taskArchiveIssue(t))
  else if (filterBy.value !== 'all') out = out.filter(t => t.status === filterBy.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    out = out.filter(t => t.title.toLowerCase().includes(q))
  }
  return out
}
const filteredTasks = computed(() => {
  // R110-LC（T3）：默认视图排除已归档任务（只在 ⏳ 生命周期面板中查看 / 恢复）
  let tasks = applyTaskFilters(d.value.tasks || []).filter(t => !t.lifecycleArchived)
  // 第卅二轮 REQ-007 + bug 修复：排序下拉实际生效
  // R56-V1：manual（默认）= 拖拽序（sortOrder）优先，无拖拽序 = 最新创建在前；选其他排序即覆盖
  if (sortBy.value !== 'manual') {
    const dirMul = sortDir.value === 'asc' ? 1 : -1
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 }
    tasks = [...tasks].sort((a, b) => {
      if (sortBy.value === 'recent') return dirMul * ((a.createdAt || 0) - (b.createdAt || 0))
      if (sortBy.value === 'priority') return dirMul * ((rank[a.priority || 'low'] || 0) - (rank[b.priority || 'low'] || 0))
      return 0
    })
  } else {
    const hasDrag = tasks.some(t => t.sortOrder != null)
    tasks = [...tasks].sort((a, b) => hasDrag
      ? (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      : (b.createdAt || 0) - (a.createdAt || 0))
  }
  // R127：已完成任务自动沉底（任何排序/分组下均最后，保持组内相对顺序）
  const nonDone = tasks.filter(t => t.status !== 'done')
  const done = tasks.filter(t => t.status === 'done')
  return [...nonDone, ...done]
})
// R43-2 任务总数双值展示：当前筛选 N 条 / 全部 M
const totalTaskCount = computed(() => (d.value.tasks || []).filter(t => !t.deletedAt).length)
/** R110-LC（T3）：当前筛选/搜索口径命中的归档任务数——底部降级提示（≥1 才显示） */
const archivedHintCount = computed(() => applyTaskFilters((d.value.tasks || []).filter(t => t.lifecycleArchived)).length)

// R113-N2：生命周期入口收敛到 设置→总览（原 R110-LC 面板接线移除）
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
/** R127：列表视图三档分组（按项目 / 按任务状态 / 按置顶与否） */
const listGroups = computed<{ key: string; name: string; icon: string; pct: number; tasks: TaskCard[] }[]>(() => {
  const tasks = filteredTasks.value
  if (groupMode.value === 'project') {
    return groupedTasks.value.map(g => ({ key: g.key, name: g.name, icon: '', pct: g.pct, tasks: g.tasks }))
  }
  if (groupMode.value === 'status') {
    const defs: Array<{ k: TaskCard['status']; name: string; icon: string }> = [
      { k: 'todo', name: '待开始', icon: '○' },
      { k: 'doing', name: '进行中', icon: '◐' },
      { k: 'done', name: '已完成', icon: '' }
    ]
    return defs
      .map(d => ({ key: d.k, name: d.name, icon: d.icon, pct: -1, tasks: tasks.filter(t => t.status === d.k) }))
      .filter(g => g.tasks.length)
  }
  const pin = tasks.filter(t => t.pinned)
  const rest = tasks.filter(t => !t.pinned)
  return [
    { key: 'pin', name: '置顶', icon: '', pct: -1, tasks: pin },
    { key: 'rest', name: '其他', icon: '', pct: -1, tasks: rest }
  ].filter(g => g.tasks.length)
})

/* R3-Cb：批量选择收归 useBatchSelect 一份实现——改前这里的按钮文案写「全选/反选」，
   函数体却只做满选↔清空（反选从来没实现过）。 */
const { selected: selectedTaskIds, allSelected: allTasksSelected, toggle: toggleSelect, selectAll, invert: invertSelect, clear: clearSelection, setMode: setBatchMode } =
  useBatchSelect(() => filteredTasks.value.map(t => t.id))
function batchAddTag(t: string) {
  const n = addTagToCards(d.value.tasks, selectedTaskIds.value, t)
  store.persist()
  showToast(`已给 ${n} 个任务加标签「${t}」（只加不减，去标签到任务详情里改）`)
}
function batchDelete() {
  const removed: TaskCard[] = []
  selectedTaskIds.value.forEach(id => {
    const t = d.value.tasks.find(x => x.id === id)
    // R141：软删统一走 softDeleteTaskToTrash——同时摘净 metric.taskIds 引用（撤销回填）
    if (t) { softDeleteTaskToTrash(d.value, t); removed.push(t) }
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
  showToast(`已将 ${count} 个任务挂载到所选指标`)
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
function cycleTaskStatus(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const order: Array<'todo'|'doing'|'done'> = ['todo', 'doing', 'done']
  setTaskStatusOf(t, order[(order.indexOf(t.status as any) + 1) % 3])
}
async function deleteTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  softDeleteTaskToTrash(d.value, t)
  store.persist()
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
    customFields: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  d.value.tasks.unshift(task)
  store.persist()
  drawerRef.value?.open(task)
  showToast('新任务已创建')
  // 第卅一轮：自动聚焦标题并全选（此前焦点落在按钮上，默认标题「新任务」易堆积）
  nextTick(() => {
    const el = document.querySelector('.ts-title') as HTMLTextAreaElement | null
    if (el) { el.focus(); el.select() }
  })
}
// R131-C4：项目/指标名 O(1) 查表——改前每行渲染都调 projectName/metricName（内部 flatMap+find 全表扫），
// 数百行任务 = 数百次全表遍历；两个 Map 只在库变更时重建一次。
const projNameById = computed(() => { const m = new Map<string, string>(); for (const dir of d.value.compass.directions) for (const p of dir.projects) m.set(p.id, p.name); return m })
const metricTitleById = computed(() => { const m = new Map<string, string>(); for (const dir of d.value.compass.directions) for (const p of dir.projects) for (const x of p.metrics) m.set(x.id, x.title); return m })
function projectName(projId?: string): string {
  if (!projId) return '未关联'
  return projNameById.value.get(projId) || '未关联'
}
function metricName(metricId?: string): string {
  if (!metricId) return '未关联'
  return metricTitleById.value.get(metricId) || '未关联'
}
/** R166 定案 1：子任务就地标注——卡内嵌清单的「done/total」进度（原 R144 的父标题记号随 parentId 退役）。
 *  零子任务返回空串，卡面因此零噪音（F2 验收口径）。 */
function subProgress(t: TaskCard): string {
  const s = t.subtasks
  if (!s || !s.length) return ''
  return `${s.filter(x => x.done).length}/${s.length}`
}
/**
 * F2：列表视图点胶囊**就地展开清单**（不跳详情、可直接勾选）。
 * 只给列表视图用——卡片/看板空间小，胶囊在那里是纯读数（丙版定案）。
 * 展开态按任务 id 记，切台/筛选后自然失效（不残留 DOM）。
 */
const subExpanded = ref<Set<string>>(new Set())
function toggleSubExpand(id: string) {
  const next = new Set(subExpanded.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  subExpanded.value = next
}
function writeSubtasks(t: TaskCard, v: Subtask[]) {
  t.subtasks = v
  t.updatedAt = Date.now()
  store.persist()
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
  // R56-V1：拖拽序物化——全量重写 sortOrder（否则「无拖拽序=最新在前」会吞掉拖拽结果）
  d.value.tasks.filter(t => !t.deletedAt).forEach((t, i) => { t.sortOrder = i })
  store.persist()
  draggedTask = null
  clearTaskDrop()
  showToast(notes.length ? `${notes.join('；')}` : '已调整排序')
}
// O8：看板列内卡片拖拽排序；第廿八轮：跨列落卡=改状态，分组模式跨组落卡=改项目归属（清空原指标）
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
  showToast(notes.length ? `${notes.join('；')}` : '已调整排序')
}
function onKanbanDrop(status: 'todo' | 'doing' | 'done') {
  if (!draggedTask) return
  const t = d.value.tasks.find(x => x.id === draggedTask!.id)
  if (t && t.status !== status) {
    setTaskStatusOf(t, status)
    showToast(`已移至「${status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'}」`)
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
  showToast('已归属「' + projectName(projectKey) + '」')
}
// R131-C4：看板分组改 computed（一次成型三列）——改前是普通函数，模板 6 处调用各重算一遍
const kanbanMap = computed(() => {
  const build = (src: TaskCard[]) => {
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
  return { todo: build(todoTasks.value), doing: build(doingTasks.value), done: build(doneTasks.value) }
})
function kanbanGroups(status: 'todo' | 'doing' | 'done') { return kanbanMap.value[status] }
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
  if (notes.length) showToast('' + notes.join('；'))
}

// ---- 字段渲染 ----
const tFields = computed(() => visibleFields(d.value.fieldConfig, 'task'))
/**
 * R117（04-61 D）：骨架字段可见性查询——「卡片与字段管理」的显隐设置必须真正落到卡片上。
 * 此前状态/项目/指标/日期这些骨架字段直接硬编码渲染，设置里关掉也照样显示（用户报「设置无效」）。
 */
function tShow(key: string): boolean { return tFields.value.some(f => f.key === key) }
/** 骨架区已渲染的 key（不再重复进扩展行） */
const T_SKELETON_KEYS = ['title', 'projectId', 'metricId', 'status', 'assets', 'dueDate']
// R40 REQ-051 保留（assets 走徽章、不重复渲染文本摘要）；
// R117（04-61 D）取消原 slice(0, 4) 截断与 description 排除——设置里可见的字段必须都能显示
const tListFields = computed(() => tFields.value.filter(f => !T_SKELETON_KEYS.includes(f.key)))
// R40 REQ-051：assets 字段是否可见（驱动任务卡正面徽章显隐）
const taskAssetsOn = computed(() => tFields.value.some(f => f.key === 'assets'))
function tVal(t: TaskCard, key: string): string {
  return fieldValue(t, key, { projectName, metricName })
}
function tShort(t: TaskCard, f: FieldDef): string {
  const v = tVal(t, f.key)
  if (f.key === 'priority') return t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'
  return v.length > 10 ? v.slice(0, 10) + '…' : v
}
/** 第卌五轮：卡片视图日期角标
 *  R117（04-61 D）：入参放宽到 `number | string`——`dueDate` 是 ISO 日期串（非时间戳），
 *  日期角标优先吃截止时间时必须能吃字符串；顺手挡掉无效日期（渲染出 NaN-NaN 更糟）。 */
function fmtCardDate(ts?: number | string): string {
  if (!ts) return ''
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return ''
  return `${dt.getMonth()+1}-${String(dt.getDate()).padStart(2,'0')}`
}

// ---- 三卡交互统一（单击详情 / 双击打开卡内链接） ----
function openCardLink(link?: string) {
  // R129-B5：协议白名单 + 打开通道统一走 shared/utils/link（此处原为自建 toOpenableLinkUrl，
  // 与 link.ts 两份实现并存——R128-A4 补的黑名单只是把它拉齐，没消灭分叉）
  const url = toOpenableRawLink(link)
  if (!url) { showToast('该卡片还没有可打开的链接，可在详情中添加'); return }
  openExternalLink(url)
}
let taskClickTimer: ReturnType<typeof setTimeout> | null = null
/** R147-d：「知」菜单里的「打开任务详情」——与行单击同一个抽屉 */
function openTaskFromAi(t: TaskCard) { drawerRef.value?.open(t) }
function onTaskRowClick(t: TaskCard) {
  if (taskClickTimer) { clearTimeout(taskClickTimer); taskClickTimer = null; return }
  taskClickTimer = setTimeout(() => {
    taskClickTimer = null
    // R47-B4：调起详情 = 一次「调用」，计入热度
    recordCardOpen(d.value, t)
    store.persistHot()
    drawerRef.value?.open(t)
  }, 260)
}
function onTaskRowDblClick(t: TaskCard) {
  if (taskClickTimer) { clearTimeout(taskClickTimer); taskClickTimer = null }
  recordCardOpen(d.value, t)
  store.persistHot()
  openCardLink(t.link)
}
/** 第十七轮：任务置顶切换 */
function toggleTaskPin(t: TaskCard) {
  t.pinned = !t.pinned
  t.updatedAt = Date.now()
  // 第卅三轮 BUG-D 修复：不物理 unshift 改源数组顺序，置顶呈现交给独立分区
  store.persist()
  showToast(t.pinned ? '已置顶，将展示在置顶分区' : '已取消置顶')
}
/** 第卅三轮 REQ-020：任务星标切换（独立于置顶，可叠加） */
function toggleTaskStar(t: TaskCard) {
  t.starred = !t.starred
  t.updatedAt = Date.now()
  store.persist()
  showToast(t.starred ? '已星标，搜索时优先展示' : '已取消星标')
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

// ---- 高亮定位（B4：搜索任务结果跳转）
// R117（04-61 B）：调度台首页同时挂着任务卡与好奇心卡两个 `?hl=` 消费者，靠 `?hk=` **认领**——
// hk 指向别的卡型时本组件直接让路；只有真正滚到目标才清 query（否则会把另一个消费者要用的 hl 清掉）。
const highlightId = ref<string | null>(null)
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk && hk !== 'task') return
  highlightId.value = hl
  setTimeout(() => {
    const el = document.querySelector(`[data-tid="${hl}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => { highlightId.value = null }, 2000)
      router.replace({ path: route.path })
    } else if (hk === 'task') {
      // 目标确实是任务卡但当前没渲染（视图/筛选挡住）→ 依然清 query，避免残留
      router.replace({ path: route.path })
    }
  }, 350)
}, { immediate: true })
// 第卅六轮 REQ-039：搜索浮层单击 → 任务卡高亮
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

// B5：任务行右键菜单 + B6 拖拽插入线
const taskCtx = ref({ open: false, x: 0, y: 0 })
const taskCtxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
const taskCtxTarget = ref<TaskCard | null>(null)
function openTaskCtx(e: MouseEvent, t: TaskCard) {
  taskCtxTarget.value = t
  taskCtxItems.value = [
    { label: '打开详情', icon: 'arrowright', cb: () => drawerRef.value?.open(t) },
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

// ---- B4：任务列表键盘导航（↑↓ 选择 / Enter 打开 / 空格批量勾选，仅列表视图） ----
const taskNavIndex = ref(-1)
function onTaskNavKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if (mountModalOpen.value) return
  if (viewMode.value !== 'list') return
  // R129-B9：taskNavIndex 必须随 filteredTasks 收缩钳制——搜索/过滤把列表变短后，
  // 旧索引会指向 undefined（Enter 传 undefined 给抽屉、空格取 .id 直接抛错）。
  const list = filteredTasks.value
  if (!list.length) { taskNavIndex.value = -1; return }
  if (taskNavIndex.value > list.length - 1) taskNavIndex.value = list.length - 1
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const max = list.length - 1
    taskNavIndex.value = e.key === 'ArrowDown'
      ? Math.min(taskNavIndex.value + 1, max)
      : Math.max(taskNavIndex.value - 1, 0)
    document.querySelector(`.trow[data-nav="${taskNavIndex.value}"]`)?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter' && taskNavIndex.value >= 0) {
    e.preventDefault()
    drawerRef.value?.open(list[taskNavIndex.value])
  } else if (e.code === 'Space' && taskNavIndex.value >= 0) {
    e.preventDefault()
    toggleSelect(list[taskNavIndex.value].id)
  }
}
onMounted(() => { document.addEventListener('keydown', onTaskNavKey, true) })
onUnmounted(() => { document.removeEventListener('keydown', onTaskNavKey, true) })
</script>

<template>
  <!-- R176（原型 1:1）：模块标题行退役（原型工作台面板直接以工具条开篇）；批量管理/新建任务移入工具条右端 -->
  <ModuleCard title="">

    <div class="mgr-body" :class="{batch: batchMode}">
      <!-- R3-Cc2：控制行收归 DeckControls——顺序与样式一份实现，任务的值域（三视图 / 五状态 / 三排序 / 三分组）以数据传入 -->
      <DeckControls panel="task" search :query="searchQuery" @search="searchQuery = $event"
        :filters="TASK_FILTERS" filter-kind="select" :filter="filterBy" @filter="filterBy = $event as TaskFilter" filter-title="状态筛选"
        :views="TASK_VIEWS" :view="viewMode" @view="viewMode = $event as 'card' | 'list' | 'kanban'"
        :sorts="TASK_SORTS" :sort="sortBy" @sort="sortBy = $event"
        :sort-dir="(sortBy === 'recent' || sortBy === 'priority') ? sortDir : ''"
        :sort-dir-titles="['当前倒序，点击切换正序', '当前正序，点击切换倒序']" @sort-dir="toggleSortDir"
        :groups="viewMode === 'list' ? TASK_GROUPS : []" :group="groupMode" @group="groupMode = $event as TaskGroupMode"
        :batch-on="batchMode" @batch="toggleBatchMode" new-label="＋新建任务" @create="createNewTask">
        <!-- R72：卡片视图横向列数（4/5/6/7，仅卡片视图出现） -->
        <ColsPicker v-if="viewMode === 'card'" v-model="taskCols" label="列数" />
        <template #count><span class="mgr-count"><span class="cur">{{ filteredTasks.length }} 条</span><span class="total" :class="{ act: filterBy !== 'all' || searchQuery.trim() }" @click="clearTaskFilter" :title="filterBy !== 'all' || searchQuery.trim() ? '点击查看全部任务' : '全部任务数'">/ 全部 {{ totalTaskCount }}</span></span></template>
      </DeckControls>

      <!-- R110-LC（T3）：归档卡已从默认视图隐藏——降级提示（R113-N2 起点击跳 设置→总览·资源生命周期） -->
      <div v-if="archivedHintCount" class="tm-archived-hint" @click="router.push('/profile#lifecycle')">
        <Icon name="package" :size="13"/> 另有 {{ archivedHintCount }} 张已归档任务未显示（点此在 设置 › 总览 · 资源生命周期 中查看 / 恢复）
      </div>

      <!-- R3-Cc：批量栏收归 DeckBatchBar（三张卡同一份「已选/全选/反选/打标」DOM） -->
      <DeckBatchBar v-if="batchMode" :size="selectedTaskIds.size" :total="filteredTasks.length" :all-selected="allTasksSelected"
        @select-all="selectAll" @invert="invertSelect" @apply-tag="batchAddTag">
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetStatus('todo')">待开始</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetStatus('doing')">进行中</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetStatus('done')">已完成</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetPriority('high')"><Icon name="dot" :size="9" class="zy-dot zy-dot-hi"/> 高优</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetPriority('medium')"><Icon name="dot" :size="9" class="zy-dot zy-dot-mi"/> 中优</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="batchSetPriority('low')"><Icon name="dot" :size="9" class="zy-dot zy-dot-lo"/> 低优</button>
        <button class="mini-btn" :disabled="!selectedTaskIds.size" @click="openBatchMount"><Icon name="package" :size="13"/> 挂到项目›指标</button>
        <button class="mini-btn danger" :disabled="!selectedTaskIds.size" @click="batchDelete"><Icon name="trash" :size="13"/> 删除</button>
        <button class="mini-btn" @click="clearSelection()">取消选择</button>
      </DeckBatchBar>

      <!-- 卡片视图（第卌五轮新增 · 默认；R47-A3：置顶/非置顶分组区块渲染，与好奇心培育同款） -->
      <div v-if="viewMode==='card'" class="tm-grid" :style="{ '--grid-cols': String(taskCols) }">
        <div v-if="!filteredTasks.length" class="tm-grid-empty">
          <EmptyState icon="clipboard" title="暂无任务"
            desc="点击右上角按钮新建，或在方向树的成功指标下添加任务"
            action-label="＋ 新建任务" @action="createNewTask" />
        </div>
        <template v-if="pinnedTasks.length">
          <div class="tm-group-label"><Icon name="pin" :size="13"/> 已置顶 · {{ pinnedTasks.length }}</div>
          <div class="tm-grid-inner">
            <div v-for="task in pinnedTasks" :key="task.id" class="tm-card"
              :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}"
              :data-tid="task.id"
              draggable="true"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.prevent.stop="onTaskDrop(task)"
              @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <span v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></span>
              <!-- R117（04-61 D）：状态胶囊受「状态」字段显隐控制（批量态仍让位给勾选框） -->
              <span v-else-if="tShow('status')" class="tm-status" :class="'st-'+task.status"><Icon :name="task.status==='done'?'check':task.status==='doing'?'half':'circle'" :size="12"/>{{ task.status==='done'?'已完成':task.status==='doing'?'进行中':'待开始' }}</span>
              <button class="tm-corner pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
              <button class="tm-corner star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
              <!-- W6 #3：卡片视图 AI 入口改右上角角标直跑补全（详情走单击卡片）；TaskAiMenu 菜单形态留列表/看板 -->
              <TaskAiCorner :task="task" />
              <div class="tm-title"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub" :title="'子任务 ' + subProgress(task) + ' 已完成（不进成熟度与周报计分）'"><Icon name="corner" :size="13"/> {{ subProgress(task) }}</span>{{ task.title }}</div>
              <!-- R117（04-61 D）：项目/指标/附件逐项受字段设置控制（原先无条件渲染） -->
              <div v-if="tShow('projectId') || tShow('metricId') || (taskAssetsOn && task.assets?.length)" class="tm-tags">
                <span v-if="tShow('projectId')" class="tag accent"><Icon name="package" :size="13"/> {{ projectName(task.projectId) }}</span>
                <span v-if="tShow('metricId') && task.metricId" class="tag warn"><Icon name="target" :size="13"/> {{ metricName(task.metricId) }}</span>
                <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              </div>
              <div v-if="tListFields.length" class="tm-ext">
                <span v-for="f in tListFields" :key="f.key" class="tm-ext-item">{{ tShort(task, f) }}</span>
              </div>
              <!-- R117（04-61 D）：日期角标优先吃「截止时间」字段（任务卡字段池里没有 createdAt）；
                   截止时间不可见时回落创建时间（骨架兜底，避免卡片零日期信息） -->
              <div class="tm-meta">
                <span v-if="tShow('dueDate') && task.dueDate"><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.dueDate) }}</span>
                <span v-else><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.createdAt) }}</span>
                <button class="tm-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
              </div>
            </div>
          </div>
          <div class="tm-group-label">全部任务 · {{ normalTasks.length }}</div>
          <div class="tm-grid-inner">
            <div v-for="task in normalTasks" :key="task.id" class="tm-card"
              :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}"
              :data-tid="task.id"
              draggable="true"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.prevent.stop="onTaskDrop(task)"
              @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <span v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></span>
              <!-- R117（04-61 D）：状态胶囊受「状态」字段显隐控制（批量态仍让位给勾选框） -->
              <span v-else-if="tShow('status')" class="tm-status" :class="'st-'+task.status"><Icon :name="task.status==='done'?'check':task.status==='doing'?'half':'circle'" :size="12"/>{{ task.status==='done'?'已完成':task.status==='doing'?'进行中':'待开始' }}</span>
              <button class="tm-corner pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
              <button class="tm-corner star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
              <!-- W6 #3：卡片视图 AI 入口改右上角角标直跑补全（详情走单击卡片）；TaskAiMenu 菜单形态留列表/看板 -->
              <TaskAiCorner :task="task" />
              <div class="tm-title"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub" :title="'子任务 ' + subProgress(task) + ' 已完成（不进成熟度与周报计分）'"><Icon name="corner" :size="13"/> {{ subProgress(task) }}</span>{{ task.title }}</div>
              <!-- R117（04-61 D）：项目/指标/附件逐项受字段设置控制（原先无条件渲染） -->
              <div v-if="tShow('projectId') || tShow('metricId') || (taskAssetsOn && task.assets?.length)" class="tm-tags">
                <span v-if="tShow('projectId')" class="tag accent"><Icon name="package" :size="13"/> {{ projectName(task.projectId) }}</span>
                <span v-if="tShow('metricId') && task.metricId" class="tag warn"><Icon name="target" :size="13"/> {{ metricName(task.metricId) }}</span>
                <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              </div>
              <div v-if="tListFields.length" class="tm-ext">
                <span v-for="f in tListFields" :key="f.key" class="tm-ext-item">{{ tShort(task, f) }}</span>
              </div>
              <!-- R117（04-61 D）：日期角标优先吃「截止时间」字段（任务卡字段池里没有 createdAt）；
                   截止时间不可见时回落创建时间（骨架兜底，避免卡片零日期信息） -->
              <div class="tm-meta">
                <span v-if="tShow('dueDate') && task.dueDate"><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.dueDate) }}</span>
                <span v-else><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.createdAt) }}</span>
                <button class="tm-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="tm-grid-inner">
          <div v-for="task in normalTasks" :key="task.id" class="tm-card"
            :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}"
            :data-tid="task.id"
            draggable="true"
            @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.prevent.stop="onTaskDrop(task)"
            @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
            <span v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></span>
            <span v-else class="tm-status" :class="'st-'+task.status"><Icon :name="task.status==='done'?'check':task.status==='doing'?'half':'circle'" :size="12"/>{{ task.status==='done'?'已完成':task.status==='doing'?'进行中':'待开始' }}</span>
            <button class="tm-corner pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
            <button class="tm-corner star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
            <TaskAiCorner :task="task" />
            <div class="tm-title"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub" :title="'子任务 ' + subProgress(task) + ' 已完成（不进成熟度与周报计分）'"><Icon name="corner" :size="13"/> {{ subProgress(task) }}</span>{{ task.title }}</div>
            <div class="tm-tags">
              <span class="tag accent"><Icon name="package" :size="13"/> {{ projectName(task.projectId) }}</span>
              <span v-if="task.metricId" class="tag warn"><Icon name="target" :size="13"/> {{ metricName(task.metricId) }}</span>
              <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
            </div>
            <div v-if="tListFields.length" class="tm-ext">
              <span v-for="f in tListFields" :key="f.key" class="tm-ext-item" :class="{['status-'+task.status]: f.key==='status'}">{{ tShort(task, f) }}</span>
            </div>
            <div class="tm-meta">
              <span><Icon name="calendar" :size="13"/> {{ fmtCardDate(task.createdAt) }}</span>
              <button class="tm-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图（R127：默认视图 · 三档分组 + 已完成沉底） -->
      <div v-else-if="viewMode==='list'" class="task-list">
        <div v-for="grp in listGroups" :key="grp.key" class="tgroup">
          <div class="tg-head" :class="{'drag-over': groupMode==='project' && tgDragOver === grp.key}"
            @dragover.prevent.stop="groupMode==='project' && (tgDragOver = grp.key)"
            @dragleave="tgDragOver === grp.key && (tgDragOver = '')"
            @drop.stop="groupMode==='project' && onListGroupDrop($event, grp.key)">
            <span class="tg-name" :class="{none: grp.key==='__none__'}">{{ grp.icon }} {{ grp.name }}</span>
            <span v-if="grp.pct >= 0" class="tg-pct">{{ grp.pct }}%</span>
            <span class="tg-count">{{ grp.tasks.length }} 任务</span>
          </div>
          <div v-for="task in grp.tasks" :key="task.id" class="trow" :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id}"
            :data-tid="task.id"
            draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task, true)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
            <div v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></div>
            <span v-else class="t-drag">⋮⋮</span>
            <div class="check-sm" :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)"><Icon v-if="task.status==='done'" name="check" :size="11"/><template v-else>{{ task.status==='doing'?'◐':'' }}</template></div>
            <span class="tname"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub exp" :title="'子任务 ' + subProgress(task) + ' · 点开就地勾选（不跳详情）'" @click.stop="toggleSubExpand(task.id)"><Icon name="corner" :size="13"/> {{ subProgress(task) }} {{ subExpanded.has(task.id) ? '▴' : '▾' }}</span>{{ task.title }}</span>
            <!-- F2：就地展开的子任务清单（浮层定位，不挤行高；勾选即写回本卡） -->
          <div v-if="subExpanded.has(task.id)" class="trow-subs">
            <SubtaskList :subtasks="task.subtasks || []" @update="writeSubtasks(task, $event)" />
          </div>
          <div class="row-tags">
              <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
              <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
            </div>
            <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
            <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
            <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
          </div>
        </div>
        <div v-if="!filteredTasks.length" class="list-empty">暂无任务</div>
      </div>

      <!-- 列表视图（旧平铺分支已由 R127 统一分组取代） -->
      <div v-else-if="false" class="task-list">
        <template v-if="pinnedTasks.length">
          <div class="section-label"><Icon name="pin" :size="13"/> 置顶 · {{ pinnedTasks.length }}</div>
          <div v-for="task in pinnedTasks" :key="task.id" class="trow pinned" :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id}"
            :data-tid="task.id"
            draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
            <div v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></div>
            <span v-else class="t-drag">⋮⋮</span>
            <div class="check-sm" :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)"><Icon v-if="task.status==='done'" name="check" :size="11"/><template v-else>{{ task.status==='doing'?'◐':'' }}</template></div>
            <span class="tname"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub exp" :title="'子任务 ' + subProgress(task) + ' · 点开就地勾选（不跳详情）'" @click.stop="toggleSubExpand(task.id)"><Icon name="corner" :size="13"/> {{ subProgress(task) }} {{ subExpanded.has(task.id) ? '▴' : '▾' }}</span>{{ task.title }}</span>
            <!-- F2：就地展开的子任务清单（浮层定位，不挤行高；勾选即写回本卡） -->
          <div v-if="subExpanded.has(task.id)" class="trow-subs">
            <SubtaskList :subtasks="task.subtasks || []" @update="writeSubtasks(task, $event)" />
          </div>
          <div class="row-tags">
              <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
              <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
              <MaturityBadge :m="taskMaturity(task)" />
            </div>
            <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
            <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
            <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
          </div>
        </template>
        <div v-for="task in normalTasks" :key="task.id" class="trow" :class="{done: task.status==='done', selected: selectedTaskIds.has(task.id), flash: highlightId===task.id}"
          :data-tid="task.id"
          draggable="true" @dragstart="onTaskDragStart($event, task)" @dragover.prevent="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop="onTaskDrop(task)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)">
          <div v-if="batchMode" class="batch-check" :class="{checked: selectedTaskIds.has(task.id)}" @click.stop="toggleSelect(task.id)"><Icon v-if="selectedTaskIds.has(task.id)" name="check" :size="12"/></div>
          <span v-else class="t-drag">⋮⋮</span>
          <div class="check-sm" :class="{done: task.status==='done'}" @click.stop="cycleTaskStatus(task.id)"><Icon v-if="task.status==='done'" name="check" :size="11"/><template v-else>{{ task.status==='doing'?'◐':'' }}</template></div>
          <span class="tname"><NewBadge :at="task.createdAt" /><span v-if="subProgress(task)" class="tm-sub exp" :title="'子任务 ' + subProgress(task) + ' · 点开就地勾选（不跳详情）'" @click.stop="toggleSubExpand(task.id)"><Icon name="corner" :size="13"/> {{ subProgress(task) }} {{ subExpanded.has(task.id) ? '▴' : '▾' }}</span>{{ task.title }}</span>
          <!-- F2：就地展开的子任务清单（浮层定位，不挤行高；勾选即写回本卡） -->
          <div v-if="subExpanded.has(task.id)" class="trow-subs">
            <SubtaskList :subtasks="task.subtasks || []" @update="writeSubtasks(task, $event)" />
          </div>
          <div class="row-tags">
            <span v-for="f in tListFields" :key="f.key" class="tag" :class="{'accent': f.key==='projectId', [ 'status-'+task.status ]: f.key==='status'}">{{ tShort(task, f) }}</span>
          </div>
          <button class="t-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button>
          <button class="t-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button>
          <TaskAiMenu :task="task" @detail="openTaskFromAi" />
          <button class="t-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="13"/></button>
        </div>
        <EmptyState v-if="!filteredTasks.length" icon="clipboard" title="暂无任务"
          desc="点击右上角按钮新建，或在方向树的成功指标下添加任务"
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
                <span class="kg-name"><Icon name="package" :size="13"/> {{ grp.name }}</span>
                <span class="kg-count">{{ grp.tasks.length }}</span>
              </div>
              <div v-for="task in grp.tasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
              </div>
              <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
            </div>
            <div v-if="!kanbanGroups('todo').length" class="kg-empty" style="padding:20px">暂无任务</div>
          </template>
          <template v-else>
            <div v-for="task in todoTasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
              <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
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
                <span class="kg-name"><Icon name="package" :size="13"/> {{ grp.name }}</span>
                <span class="kg-count">{{ grp.tasks.length }}</span>
              </div>
              <div v-for="task in grp.tasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
              </div>
              <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
            </div>
            <div v-if="!kanbanGroups('doing').length" class="kg-empty" style="padding:20px">暂无任务</div>
          </template>
          <template v-else>
            <div v-for="task in doingTasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
              <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
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
                <span class="kg-name"><Icon name="package" :size="13"/> {{ grp.name }}</span>
                <span class="kg-count">{{ grp.tasks.length }}</span>
              </div>
              <div v-for="task in grp.tasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
                @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
                <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
              </div>
              <div v-if="!grp.tasks.length" class="kg-empty">拖入任务归到此项目</div>
            </div>
            <div v-if="!kanbanGroups('done').length" class="kg-empty" style="padding:20px">暂无任务</div>
          </template>
          <template v-else>
            <div v-for="task in doneTasks" :key="task.id" class="kcard" :class="{done: task.status==='done', flash: highlightId===task.id, 'drop-line-t': taskDropKey===task.id+'-t', 'drop-line-b': taskDropKey===task.id+'-b'}" draggable="true" :data-tid="task.id"
              @dragstart="onTaskDragStart($event, task)" @dragover.prevent.stop="markTaskDrop($event, task.id)" @dragleave="clearTaskDrop" @drop.stop="onTaskCardDrop($event, task, groupByProject)" @click="onTaskRowClick(task)" @dblclick="onTaskRowDblClick(task)" @contextmenu.prevent="openTaskCtx($event, task)">
              <button class="k-pin" :class="{on: task.pinned}" @click.stop="toggleTaskPin(task)" title="置顶"><Icon name="pin" :size="13"/></button><button class="k-star" :class="{on: task.starred}" @click.stop="toggleTaskStar(task)" title="星标"><Icon name="star" :size="13"/></button><button class="k-del" @click.stop="deleteTask(task.id)" title="删除任务"><Icon name="trash" :size="12" /></button><div class="kt"><NewBadge :at="task.createdAt" />{{ task.title }}</div>
              <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
              <MaturityBadge :m="taskMaturity(task)" />
              <TaskAiMenu :task="task" @detail="openTaskFromAi" />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ===== 批量挂载弹窗（O3） ===== -->
    <Transition name="fade">
      <div v-if="mountModalOpen" class="overlay" @click="mountModalOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="mountModalOpen" class="picker-modal" style="width:420px">
        <div class="pm-head">
          <span><Icon name="package" :size="13"/> 挂载 {{ selectedTaskIds.size }} 个任务到项目›指标</span>
          <div class="pm-close" @click="mountModalOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="ts-label-pm"><Icon name="package" :size="13"/> 所属项目</div>
          <select v-model="mountProjId" class="ts-select-pm">
            <option value="">请选择项目…</option>
            <option v-for="p in mountProjectOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <div class="ts-label-pm" style="margin-top:12px"><Icon name="target" :size="13"/> 成功指标（可选）</div>
          <select v-model="mountMetId" class="ts-select-pm" :disabled="!mountProjId">
            <option value="">暂不归属指标</option>
            <option v-for="m in mountMetricOptions" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
            <button class="mini-btn" @click="mountModalOpen=false">取消</button>
            <button class="mini-btn primary" @click="confirmBatchMount"><Icon name="check" :size="13"/> 确认挂载</button>
          </div>
        </div>
      </div>
    </Transition>

    <ContextMenu :state="taskCtx" :items="taskCtxItems" @close="taskCtx.open = false" />
    <TaskDetailDrawer ref="drawerRef" />
    <!-- R113-N2：生命周期面板移除——入口收敛到 设置→总览 -->
  </ModuleCard>
</template>

<style scoped>
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.active { background: var(--accent-light); color: var(--accent-ink); border-color: var(--accent); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }

.mini-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.mini-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.tag { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-tiny); padding: 2px 8px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; white-space: nowrap; }
.tag.accent { background: var(--accent-light); color: var(--accent-ink); }
.tag.warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.status-doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.status-done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.kc-assets { margin-left: 2px; }

.mgr-body { padding-bottom: 4px; }
.mgr-body.batch .check-sm { display: none; }
/* R176（原型 panel-toolbar）：模块标题行退役 ⇒ 工具条自带顶部内距；批量/新建动作组贴右 */
/* R175（原型 macos-segmented）：视图三态改连体分段（subtle 底 + 选中浮起白片），类名与交互一字未动 */
.view-tabs { display: flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px; gap: 2px; }
.view-tab { padding: 5px 12px; border-radius: var(--radius-xs); font-size: var(--fs-sub); cursor: pointer; color: var(--text-2); transition: all var(--dur); border: none; background: transparent; font-family: inherit; }
.view-tab.active { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: var(--shadow-sm); }
.sel { padding: 5px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-2); font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; outline: none; font-family: inherit; }
.sort-dir-btn { white-space: nowrap; font-size: var(--fs-sub); }
.sort-dir-btn:hover { border-color: var(--accent); color: var(--text); }
.mgr-count { display: flex; align-items: center; gap: 2px; font-size: var(--fs-sub); color: var(--text-3); white-space: nowrap; flex-shrink: 0; padding-right: 4px; }
.mgr-count .cur { color: var(--text-2); font-weight: 600; }
.mgr-count .total { cursor: default; }
.mgr-count .total.act { cursor: pointer; color: var(--accent); font-weight: 600; }
.mgr-count .total.act:hover { text-decoration: underline; }
.batch-check { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: var(--fs-caption); color: #fff; background: var(--surface); }
.batch-check.checked { background: var(--accent); border-color: var(--accent); }

/* ===== 卡片视图（第卌五轮） ===== */
.tm-grid { padding-bottom: 4px; }
.tm-group-label { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin: 2px 0 8px; }
/* R72：卡片视图列数由 --grid-cols 驱动（4/5/6/7）；容器放不下 N 列时自动降列，卡片最小 240px */
.tm-grid-inner { display: grid; /* R106（F3）：精确 N 列（生产反馈：auto-fill+精确分数宽在 6/7 列因取整差一位永远少一） */ grid-template-columns: repeat(var(--grid-cols, 5), minmax(0, 1fr)); gap: 12px; }
.tm-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; min-height: 94px; cursor: pointer; transition: all var(--dur) ease; display: flex; flex-direction: column; gap: 6px; min-width: 0; overflow: hidden; }
.tm-card:hover { border-color: var(--border-strong); background: var(--surface); box-shadow: var(--shadow-sm); }
.tm-card.done { opacity: .62; }
.tm-card.done .tm-title { text-decoration: line-through; color: var(--text-3); }
.tm-card.selected { background: var(--accent-light); border-color: var(--accent); }
.tm-card.flash { animation: tflash 2s ease-out; }
@keyframes tflash { 0%,60% { background: var(--accent-light); box-shadow: inset 3px 0 0 var(--accent); } 100% { background: transparent; } }
.tm-card.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.tm-card.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.tm-status { font-size: var(--fs-tiny); font-weight: 600; padding: 2px 8px; border-radius: 99px; align-self: flex-start; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.tm-status.st-todo { background: var(--tag-neutral-bg); color: var(--tag-neutral-text); }
.tm-status.st-doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tm-status.st-done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.tm-corner { position: absolute; top: 8px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; opacity: 0; transition: all var(--dur) ease; z-index: 1; }
.tm-corner.pin { right: 8px; }
.tm-corner.star { right: 32px; }
.tm-card:hover .tm-corner { opacity: .6; }
.tm-corner:hover { opacity: 1 !important; background: var(--surface-3); }
.tm-corner.on { opacity: 1; }
.tm-sub { color: var(--text-3); font-weight: 400; margin-right: 3px; cursor: default; }
.tm-title { font-size: var(--fs-body); font-weight: 600; line-height: 1.45; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tm-tags { display: flex; flex-wrap: wrap; gap: 5px; }
/* R176（原型 task-item-card footer）：卡片标签统一中性灰（项目/指标不分色；字段显隐体系不动） */
.tm-tags .tag.accent, .tm-tags .tag.warn { background: var(--surface-3); color: var(--text-2); }
.tm-ext { display: flex; flex-wrap: wrap; gap: 5px; }
.tm-ext-item { font-size: var(--fs-caption); color: var(--text-3); }
.tm-ext-item.status-doing { color: var(--tag-warn-text); }
.tm-ext-item.status-done { color: var(--tag-ok-text); }
.tm-meta { display: flex; align-items: center; justify-content: space-between; margin-top: auto; font-size: var(--fs-caption); color: var(--text-3); }
.tm-del { width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; opacity: 0; transition: all var(--dur) ease; }
.tm-card:hover .tm-del { opacity: .6; }
.tm-del:hover { opacity: 1 !important; background: var(--danger-light, rgba(231,76,60,.12)); }
.tm-grid-empty { grid-column: 1 / -1; }

/* ===== 列表 / 看板（自 CompassActions 原样迁入） ===== */
.task-list { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.section-label { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 9px 16px 0; }
.trow { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border); transition: background .1s; }
/* F2：就地展开清单——绝对定位浮在行下，不改行高（改行高会让整列在展开瞬间重排，点击点会跳走） */
.trow-subs { position: absolute; left: 14px; right: 14px; top: calc(100% - 2px); z-index: var(--z-dropdown, 30); background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 4px; }
.tm-sub.exp { cursor: pointer; }
.tm-sub.exp:hover { color: var(--accent); border-color: var(--accent); }
.trow:last-child { border-bottom: none; }
.trow:hover { background: var(--surface); }
.trow.selected { background: var(--accent-light); }
.trow.done { opacity: .6; }
.trow.done .tname { text-decoration: line-through; color: var(--text-3); }
.trow.flash { animation: tflash 2s ease-out; }
.trow.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.trow.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.t-drag { color: var(--text-4); font-size: var(--fs-caption); cursor: grab; flex-shrink: 0; }
.check-sm { width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--border-strong); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: var(--fs-tiny); color: #fff; background: var(--surface); cursor: pointer; }
.check-sm.done { background: var(--success); border-color: var(--success); }
.tname { font-size: var(--fs-body); flex: 1; min-width: 0; cursor: pointer; }
.tname:hover { color: var(--accent); }
.row-tags { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
.list-empty { text-align: center; padding: 30px; font-size: var(--fs-body); color: var(--text-3); }
.tgroup { border-bottom: 1px solid var(--border); }
.tgroup:last-child { border-bottom: none; }
.tg-head { display: flex; align-items: center; gap: 8px; padding: 9px 16px; background: var(--surface-3); position: sticky; top: 0; cursor: default; transition: background var(--dur-fast); }
.tg-head.drag-over { background: var(--accent-light); box-shadow: inset 0 2px 0 var(--accent); }
.tg-name { font-size: var(--fs-sub); font-weight: 700; color: var(--text); }
.tg-name.none { color: var(--text-3); }
.tg-pct { font-size: var(--fs-caption); font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
.tg-count { margin-left: auto; font-size: var(--fs-tiny); color: var(--text-3); background: var(--surface); padding: 1px 8px; border-radius: 99px; }
.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.kcol { background: var(--surface-2); border-radius: var(--radius-sm); padding: 12px; min-height: 220px; }
.khead { position: sticky; top: 0; z-index: 1; background: var(--surface-2); display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 0; font-size: var(--fs-body); font-weight: 600; }
.kcount { font-size: var(--fs-tiny); background: var(--surface); color: var(--text-3); padding: 1px 7px; border-radius: 99px; font-weight: 500; }
.kgroup { background: var(--surface-2); border-radius: var(--radius-xs); padding: 8px; margin-bottom: 10px; border: 1px dashed transparent; transition: border-color var(--dur); }
.kgroup.drag-over { border-color: var(--accent); background: var(--accent-light); }
.kg-head { display: flex; align-items: center; gap: 6px; padding: 4px 6px 8px; }
.kg-name { font-size: var(--fs-caption); font-weight: 700; color: var(--text-2); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kg-count { font-size: var(--fs-micro); color: var(--text-3); background: var(--surface); padding: 1px 7px; border-radius: 99px; }
.kg-empty { font-size: var(--fs-caption); color: var(--text-4); text-align: center; padding: 10px; border: 1px dashed var(--border); border-radius: 6px; }
.kcard { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 10px 13px; margin-bottom: 8px; cursor: pointer; transition: all var(--dur); }
.kcard:hover { border-color: var(--border-strong); background: var(--surface-2); }
.kcard.done { opacity: .6; }
.kcard.done .kt { text-decoration: line-through; }
.kcard.flash { animation: tflash 2s ease-out; }
.kcard.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.kcard.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.kt { font-size: var(--fs-body); font-weight: 500; line-height: 1.5; margin-bottom: 6px; }
.k-pin { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; opacity: 0; transition: all var(--dur) ease; z-index: 1; }
.k-star { position: absolute; top: 6px; right: 32px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; opacity: 0; transition: all var(--dur) ease; z-index: 1; }
/* R68-F2：删除按钮 emoji → 主题色线性图标（深色主题下 🗑 深灰单色 emoji 在近黑卡上不可见） */
.k-del { position: absolute; top: 6px; right: 58px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; opacity: 0; transition: all var(--dur) ease; z-index: 1; color: var(--text-3); display: flex; align-items: center; justify-content: center; }
.kcard:hover .k-pin, .kcard:hover .k-star, .kcard:hover .k-del { opacity: .85; }
.k-pin:hover, .k-star:hover { opacity: 1 !important; background: var(--surface-3); }
.k-del:hover { opacity: 1 !important; background: var(--tag-danger-bg); color: var(--danger, #e74c3c); }
.k-pin.on, .k-star.on { opacity: 1; }
.t-pin { width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; opacity: 0; transition: all var(--dur) ease; flex-shrink: 0; }
.t-star { width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; opacity: 0; transition: all var(--dur) ease; flex-shrink: 0; }
.t-del { width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; opacity: 0; transition: all var(--dur) ease; flex-shrink: 0; }
.trow:hover .t-pin, .trow:hover .t-star, .trow:hover .t-del { opacity: .6; }
.t-pin:hover, .t-star:hover { opacity: 1 !important; background: var(--surface-3); }
.t-pin.on, .t-star.on { opacity: 1; }
.t-del:hover { opacity: 1 !important; background: var(--danger-light, rgba(231,76,60,.12)); color: var(--danger, #e74c3c); }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: var(--z-overlay); }
.picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-width: 92vw; max-height: 70vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: calc(var(--z-overlay) + 1); display: flex; flex-direction: column; overflow: hidden; }
.pm-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.pm-head span:first-child { flex: 1; }
.pm-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: var(--fs-headline); }
.pm-close:hover { background: var(--surface-3); color: var(--text); }
.pm-body { flex: 1; overflow-y: auto; padding: 14px 20px; }
.ts-label-pm { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 7px; }
.ts-select-pm { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: var(--fs-body); color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; }
.ts-select-pm:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--dur-slow); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
/* R110-LC（T3）：归档降级提示条 */
.tm-archived-hint { margin: 8px 0 0; padding: 7px 12px; border: 1px dashed var(--border-strong); border-radius: 8px; font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; transition: all var(--dur); }
.tm-archived-hint:hover { border-color: var(--accent); color: var(--accent); }
.modal-enter-active, .modal-leave-active { transition: all var(--dur) ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.95); }
</style>
