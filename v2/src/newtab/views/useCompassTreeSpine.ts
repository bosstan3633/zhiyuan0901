import { ref, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent, shallowRef } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { uid } from '@/shared/utils'
import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { compassNodeCounts, removeCompassNode, restoreCompassNode, removeMetricWithConfirm, type CompassNodeKind } from '@/shared/utils/compassCrud'
import { useConfirm } from '@/shared/components/confirm'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import type { GoalParseResult } from '@/shared/utils/mdImport'
import type { useCompassTree } from './useCompassTree'

export function useCompassTreeSpine(deps: Pick<ReturnType<typeof useCompassTree>, 'd' | 'addProjectToDir' | 'store' | 'allProjects' | 'toggleFocusProject' | 'expandedMetrics' | 'findMetric'>): {
  goalImport: Ref<{ open: boolean; dirId: string; dirName: string }>
  openGoalImport: (dir: Direction) => void
  confirmGoalImport: (payload: { goal?: GoalParseResult }) => void
  projImport: Ref<{ open: boolean; projId: string; projName: string }>
  openProjImport: (projId: string) => void
  confirmProjImport: (payload: { proj?: import('@/shared/utils/mdImport').ProjImportResult }) => void
  onToggleFocus: (id: string) => void
  addMetric: (projId: string) => void
  delMetricById: (metricId: string) => void
  taskAdd: Ref<{ metricId: string; projId: string } | null>
  openTaskAdd: (metricId: string, projId: string) => void
  detailRef: Ref<any>
  onTaskCreated: (t: TaskCard) => void
  openTaskDetail: (taskId: string) => void
  metricDetailId: Ref<string | null>
  metricDetailOpen: Ref<boolean>
  openMetricDetail: (metricId: string) => void
  taskAddMetricTitle: ComputedRef<string>
  toggleTask: (taskId: string) => void
  NODE_KIND: Record<string, CompassNodeKind>
  nodeNameOf: (type: string, id: string) => string
  deleteNode: (type: string, id: string) => Promise<void>
  unbindTask: (task: TaskCard) => void
  unbindTaskById: (taskId: string) => void
} {
  const { d, addProjectToDir, store, allProjects, toggleFocusProject, expandedMetrics, findMetric } = deps
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
  showToast(`已解除关联：「${task.title.slice(0, 16)}」已回任务池`)
}

/** V3.9.22：方向台只解绑，不删除任务本体；真删除只在任务详情/任务卡池。 */
function unbindTaskById(taskId: string) {
  const task = d.value.tasks.find(t => t.id === taskId)
  if (!task || task.deletedAt) return
  unbindTask(task)
}

/* ★W11 二批清账：tasksForMetric() / metricTaskRows() 已退役。
   它们是"任务数据在视图里现算"的最后一处残留 —— W11 集中取数层（compassMeta.ts）落地后，
   指标的任务列表、总数、完成数、状态点全部走 byMetric 的 O(1) 取值。
   ★为什么必须真删而不是留着：留着的唯一后果是"以后有人顺手又用回它"，
   于是那 6 次/指标 的 filter+sort 悄悄复活，而回归/typecheck/build 全绿。
   同批 R166 定案 1 已把 flattenTaskTree 展平退役；metricTaskRows 当时的转发壳一并归零。 */

// ---- 停滞检测 ----

  return {
    goalImport, openGoalImport, confirmGoalImport, projImport, openProjImport, confirmProjImport, onToggleFocus, addMetric, delMetricById, taskAdd, openTaskAdd, detailRef, onTaskCreated, openTaskDetail, metricDetailId, metricDetailOpen, openMetricDetail, taskAddMetricTitle, toggleTask, NODE_KIND, nodeNameOf, deleteNode, unbindTask, unbindTaskById,
  }
}
