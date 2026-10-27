/**
 * R181 结构优化：从 ProjectCuration.vue 抽出的「项目展板树」拖拽排序 / 归属变更 + 定位闪烁。
 *
 * 为什么单独成文件：宿主早已是结构债务候选（≥800 行）。这段是**单一职责**的自足块——
 * 只依赖 currentProject（当前项目）/ d（全库）/ store.persist()（落库）三件外部状态，
 * 与页面其余逻辑无耦合，但历史回归 R55-17 以**字符串锚点**（`treeTaskDropOnMetric` /
 * `任务已转为未归类`）锁定了 G1「树任务双写归属」口径 ⇒ 只搬不改，靠 read() 聚合表
 * （helpers.cjs COMPONENT_AGGREGATES）把本文件并回宿主读数，断言一处不动。
 */
import { ref, type Ref } from 'vue'
import type { AppData, Metric, Project, TaskCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'

export interface ProjectCurationDndCtx {
  currentProject: Ref<Project | null>
  d: Ref<AppData>
  store: { persist: () => void }
}

export function useProjectCurationDnd({ currentProject, d, store }: ProjectCurationDndCtx) {
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
    showToast(`指标「${drag.title}」已排序（同步调度台项目调度）`)
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
    showToast(m ? `任务已归属「${m.title}」` : '任务已转为未归类')
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

  return {
    treeDrop,
    taskFlashId,
    metricFlashId,
    treeMetricDragStart,
    treeMetricDragOver,
    treeMetricDrop,
    treeTaskDragStart,
    treeTaskDropOnMetric,
    scrollToMetric,
    scrollToTask,
  }
}
