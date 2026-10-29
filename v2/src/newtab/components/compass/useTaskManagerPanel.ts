
// 第卌五轮 T-03：全域任务管理面板（自 CompassActions.vue 整体抽离，迁入「资源罗盘 → 好奇心培育」专区 Tab；V2.20.1 改名任务调度）
// 全量能力保留：批量管理 / 状态筛选 / 排序+方向 / 按项目分组 / 搜索 / 拖拽排序（跨组=改归属）/ 看板 / 右键菜单 / 键盘导航
// 第卌五轮新增：卡片视图（默认），与好奇心卡片视觉一致
// R129-B5：链接协议白名单与打开通道全站唯一实现
// R117（04-61 C3）：当日新增角标（自然日口径）——卡片 / 列表 / 看板三视图同一枚
// R147-d：任务行「知」AI 辅助菜单（与项目详情页同一组件）
// W6（V3.8.6）#3：卡片视图右上角 AI 入口 —— 点击直接跑补全（详情走单击卡片）
// R113-N2：LifecyclePanel / useLifecycle 移除——生命周期入口收敛到 设置→总览

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { uid } from '@/shared/utils'
import { saveUIPrefs } from '@/shared/storage/repository'
import { onOpenDrawer } from '@/shared/utils/bus'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import { useBatchSelect, addTagToCards } from '../../composables/useBatchSelect'
import { useTaskPanelBatch } from './taskPanelBatch'
import DeckBatchBar from './DeckBatchBar.vue'
import DeckControls from './DeckControls.vue'
import { visibleFields, fieldValue } from '@/shared/utils/fields'
import type { TaskCard, Subtask, FieldDef } from '@/shared/models'
import { recordCardOpen } from '@/shared/storage/stats'
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity } from '@/shared/utils/maturity'
import NewBadge from '@/shared/components/NewBadge.vue'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { useCardCols } from '@/shared/utils/cardCols'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
import TaskAiMenu from '@/newtab/components/TaskAiMenu.vue'
import TaskAiCorner from '@/newtab/components/TaskAiCorner.vue'
import SubtaskList from '@/shared/components/SubtaskList.vue'

export interface TaskManagerPanelProps {
  /** 独立二级页：隐藏所有新建入口；空态主行动改为清空筛选。 */
  secondaryMode?: boolean
}

/** R127：分组三档（默认按项目；列表视图用） */ // R181：模板以 as TaskGroupMode 断言，需模块级导出
export type TaskGroupMode = 'project' | 'status' | 'pin'
/** R58-O2：状态筛选五档（含「未归档」快速采集沉淀池入口） */ // R181：同上
export type TaskFilter = 'all' | 'todo' | 'doing' | 'done' | 'unarchived'

export function useTaskManagerPanel(props: TaskManagerPanelProps) {
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
const groupMode = ref<TaskGroupMode>((store.ui?.sortPrefs?.task as { group?: TaskGroupMode } | undefined)?.group || 'project')
/** 看板沿用「按项目分组」开关语义（映射自 groupMode） */
const groupByProject = computed(() => groupMode.value === 'project')
const sortBy = ref('manual')
// 第卅二轮 REQ-007：任务时间/优先级排序方向（默认倒序）+ 排序偏好本地记忆（UIPrefs.sortPrefs.task）
const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.task?.dir === 'asc') ? 'asc' : 'desc')
if (store.ui?.sortPrefs?.task?.by) sortBy.value = store.ui.sortPrefs.task.by
// 第卅五轮 REQ-036：状态筛选偏好持久化（UIPrefs.sortPrefs.task.filter）｜ R58-O2：新增「未归档」维度（快速采集沉淀池的就地治理入口）
const savedFilter = store.ui?.sortPrefs?.task?.filter
const filterBy = ref<TaskFilter>(savedFilter === 'todo' || savedFilter === 'doing' || savedFilter === 'done' || savedFilter === 'unarchived' ? savedFilter : 'all')
// V3.9.1：首页「未归档」读数进入二级页时带筛选，不把用户丢在全量列表里再找一次。
if (route.query.filter === 'unarchived') filterBy.value = 'unarchived'
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
/* ★W17-C05（2026-10-20 用户拍板）分组折叠：状态**只存在组件内**（切分组 / 刷新 / 离开一律回全展开），
 * 与「折叠记忆不持久化」的拍板一致。空集合 = 全部展开。 */
const collapsedGroups = ref<Set<string>>(new Set())
function isGroupCollapsed(key: string): boolean { return collapsedGroups.value.has(key) }
function toggleGroupCollapsed(key: string): void {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}
/** 全局开关：任一组展开时给「全部折叠」，全收起时给「全部展开」 */
const allGroupsCollapsed = computed(() => listGroups.value.length > 0 && listGroups.value.every(g => collapsedGroups.value.has(g.key)))
function toggleAllGroups(): void {
  collapsedGroups.value = allGroupsCollapsed.value ? new Set() : new Set(listGroups.value.map(g => g.key))
}
watch([groupMode, viewMode], () => { collapsedGroups.value = new Set() })

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
// R181：批量操作 + 批量挂载子域外提（见 taskPanelBatch.ts）
const { batchAddTag, batchDelete, batchSetStatus, batchSetPriority, mountModalOpen, mountProjId, mountMetId, mountProjectOptions, mountMetricOptions, openBatchMount, confirmBatchMount } =
  useTaskPanelBatch({ d, store, allProjects, selectedTaskIds })

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
  if (props.secondaryMode) return
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
/** ★W17-C05：折叠组仍是合法落点——拖拽悬停 300ms 自动展开，让用户看见要放进哪一组 */
let tgHoverTimer: ReturnType<typeof setTimeout> | null = null
function onGroupHeadDragOver(key: string) {
  if (groupMode.value === 'project') tgDragOver.value = key
  if (collapsedGroups.value.has(key)) {
    if (tgHoverTimer) clearTimeout(tgHoverTimer)
    tgHoverTimer = setTimeout(() => {
      tgHoverTimer = null
      const next = new Set(collapsedGroups.value)
      next.delete(key)
      collapsedGroups.value = next
    }, 300)
  }
}
function onGroupHeadDragLeave(key: string) {
  if (tgDragOver.value === key) tgDragOver.value = ''
  if (tgHoverTimer) { clearTimeout(tgHoverTimer); tgHoverTimer = null }
}
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
/** 二级页深链 `?hl=`：让独立页也能直接展开右侧任务详情（与列表点击同一抽屉）。 */
function openDetail(id: string) {
  const t = d.value.tasks.find(x => x.id === id && !x.deletedAt)
  if (t) drawerRef.value?.open(t)
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
  // 二级页不依赖首页三页签；深链直接由本面板渲染并滚动到目标。
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
  // 任务行本身已有 v-pressable 的 Enter/Space 通道；文档级导航只在行外接管，
  // 否则一次按键会同时“打开当前行”和“执行行内动作”。
  if (el?.closest?.('[data-tid]') && (e.key === 'Enter' || e.key === ' ')) return
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


  return {
    route,
    router,
    store,
    d,
    allProjects,
    projectProgress,
    taskArchiveIssue,
    drawerRef,
    viewMode,
    taskCols,
    groupMode,
    groupByProject,
    sortBy,
    sortDir,
    savedFilter,
    filterBy,
    toggleSortDir,
    searchQuery,
    TASK_VIEWS,
    TASK_FILTERS,
    TASK_SORTS,
    TASK_GROUPS,
    batchMode,
    toggleBatchMode,
    applyTaskFilters,
    filteredTasks,
    totalTaskCount,
    archivedHintCount,
    clearTaskFilter,
    groupedTasks,
    todoTasks,
    doingTasks,
    doneTasks,
    pinnedTasks,
    normalTasks,
    collapsedGroups,
    isGroupCollapsed,
    toggleGroupCollapsed,
    allGroupsCollapsed,
    toggleAllGroups,
    listGroups,
    selectedTaskIds,
    allTasksSelected,
    toggleSelect,
    selectAll,
    invertSelect,
    clearSelection,
    setBatchMode,
    batchAddTag,
    batchDelete,
    batchSetStatus,
    batchSetPriority,
    mountModalOpen,
    mountProjId,
    mountMetId,
    mountProjectOptions,
    mountMetricOptions,
    openBatchMount,
    confirmBatchMount,
    setTaskStatusOf,
    cycleTaskStatus,
    deleteTask,
    createNewTask,
    projNameById,
    metricTitleById,
    projectName,
    metricName,
    subProgress,
    subExpanded,
    toggleSubExpand,
    writeSubtasks,
    draggedTask,
    onTaskDragStart,
    onTaskDrop,
    onTaskCardDrop,
    onKanbanDrop,
    kgDragOver,
    tgDragOver,
    tgHoverTimer,
    onGroupHeadDragOver,
    onGroupHeadDragLeave,
    onListGroupDrop,
    kanbanMap,
    kanbanGroups,
    onKanbanGroupDrop,
    tFields,
    tShow,
    T_SKELETON_KEYS,
    tListFields,
    taskAssetsOn,
    tVal,
    tShort,
    fmtCardDate,
    openCardLink,
    taskClickTimer,
    openTaskFromAi,
    onTaskRowClick,
    openDetail,
    onTaskRowDblClick,
    toggleTaskPin,
    toggleTaskStar,
    syncMetricTaskIds,
    highlightId,
    taskCtx,
    taskCtxItems,
    taskCtxTarget,
    openTaskCtx,
    taskDropAfter,
    taskDropKey,
    markTaskDrop,
    clearTaskDrop,
    taskNavIndex,
    onTaskNavKey,
  }
}
