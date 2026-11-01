/**
 * V3.9.31（F4）：方向台项目塔 / 项目全景的任务拖拽 —— 指标内排序 + 同项目跨指标改归属。
 *
 * 口径照抄展板 useProjectCurationDnd.treeTaskDropOnMetric（R55-17「树任务双写归属」判据把守）：
 *   - 数据只落在任务卡 projectId / metricId 与 metric.taskIds（六层归属，非卡间挂载）；
 *   - 同指标拖拽 = 只 splice 该指标 taskIds（该数组序即展板/塔/全景三处共同渲染序，见 compassMeta.dedupeSorted）；
 *   - 跨指标（同项目）= metricId 改写 + 双侧 taskIds 更新 + updatedAt + persist；
 *   - 跨项目目标一律拒绝（用户 2026-11-01 拍板：不做跨项目拖拽）。
 *
 * Tree 实例化一份并 provide（TASK_DND_KEY），两条泳道组件（PanoLane / CompassLane）
 * inject 同一份状态——拖拽源与落点跨组件实例共享；返回值经 reactive 包装，
 * 模板里可直接读 dragTaskId / dropTip（自动解包）。
 * 行上既有点击/键盘行为不受影响——dragstart 只在真实拖动时触发，点按仍走原按钮。
 */
import { reactive, ref, type InjectionKey } from 'vue'
import type { Metric, TaskCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'

export type TaskDropMode = 't' | 'b' | 'in'
export interface TaskDropTip { id: string; mode: TaskDropMode }

/** V3.9.31（W11-12 拆件配套）：拖拽态经 provide/inject 下发而非 props 逐级透传——
 *  Tower/Pano 本已顶在 400 行帽上，prop 链会把两个宿主再度顶爆；两 Lane 是唯二消费者。 */
export const TASK_DND_KEY: InjectionKey<TaskRelocationDnd> = Symbol('zy-task-dnd')

export interface TaskRelocationDndCtx {
  /** 全库数据取值器（Tree 传 () => d.value，避开 Ref/ComputedRef 型差） */
  d: () => import('@/shared/models').AppData
  persist: () => void
}

export function useTaskRelocationDnd({ d, persist }: TaskRelocationDndCtx) {
  const dragTaskId = ref('')
  const dropTip = ref<TaskDropTip | null>(null)
  let dragTask: TaskCard | null = null

  function findMetric(metricId: string): { projId: string; projName: string; metric: Metric } | null {
    for (const dir of d().compass.directions) {
      for (const proj of dir.projects) {
        const metric = proj.metrics.find(m => m.id === metricId)
        if (metric) return { projId: proj.id, projName: proj.name, metric }
      }
    }
    return null
  }

  function reset() {
    dragTask = null
    dragTaskId.value = ''
    dropTip.value = null
  }

  /** 双写归属 + 落位插入；返回是否发生跨指标。调用方已保证同项目。 */
  function writeTo(t: TaskCard, dst: { projId: string; metric: Metric }, ref: { refId: string | null; mode: TaskDropMode }): boolean {
    const src = t.metricId ? findMetric(t.metricId) : null
    const metricChanged = !src || src.metric.id !== dst.metric.id
    if (src && metricChanged) src.metric.taskIds = src.metric.taskIds.filter(x => x !== t.id)
    if (metricChanged) {
      t.metricId = dst.metric.id
      t.projectId = dst.projId
    }
    const list = dst.metric.taskIds
    const fromIdx = list.indexOf(t.id)
    if (fromIdx >= 0) list.splice(fromIdx, 1)
    if (ref.mode === 'in' || !ref.refId) {
      if (!list.includes(t.id)) list.push(t.id)
    } else {
      const ti = list.indexOf(ref.refId)
      if (ti >= 0) list.splice(ref.mode === 'b' ? ti + 1 : ti, 0, t.id)
      else if (!list.includes(t.id)) list.push(t.id)
    }
    return metricChanged
  }

  function rejectCrossProject(t: TaskCard, srcProjName: string | null): boolean {
    if (srcProjName) {
      showToast(`「${t.title}」属于「${srcProjName}」，不能跨项目拖拽——如需移交，先在任务详情里改归属项目`)
      return true
    }
    return false
  }

  function onTaskDragStart(e: DragEvent, t: TaskCard) {
    dragTask = t
    dragTaskId.value = t.id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', 'task:' + t.id)
    }
  }

  /** 悬停任务行：上半 t / 下半 b（相对目标行的落位），行上 .stop 防止泳道 in 提示覆盖 */
  function onRowDragOver(e: DragEvent, target: TaskCard) {
    if (!dragTask || dragTask.id === target.id) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mode: TaskDropMode = (e.clientY - rect.top) / rect.height > 0.5 ? 'b' : 't'
    const cur = dropTip.value
    if (!cur || cur.id !== target.id || cur.mode !== mode) dropTip.value = { id: target.id, mode }
  }

  /** 悬停泳道非行区（泳道头 / 空泳道 / 行间空隙）：in = 落到该指标尾部 */
  function onLaneDragOver(e: DragEvent, metricId: string) {
    if (!dragTask) return
    const cur = dropTip.value
    if (!cur || cur.id !== metricId || cur.mode !== 'in') dropTip.value = { id: metricId, mode: 'in' }
  }

  function onLaneDragLeave(e: DragEvent, metricId: string) {
    const cur = dropTip.value
    if (cur && cur.mode === 'in' && cur.id === metricId) dropTip.value = null
  }

  function onRowDrop(e: DragEvent, target: TaskCard, metricId: string) {
    const tip = dropTip.value
    const t = dragTask
    reset()
    if (!t || !tip || tip.mode === 'in' || t.id === target.id) return
    const src = t.metricId ? findMetric(t.metricId) : null
    const dst = findMetric(metricId)
    if (!dst) return
    if (src && src.projId !== dst.projId) { rejectCrossProject(t, src.projName); return }
    const metricChanged = writeTo(t, dst, { refId: target.id, mode: tip.mode })
    t.updatedAt = Date.now()
    persist()
    showToast(metricChanged ? `任务已归属「${dst.metric.title}」` : `已调整「${t.title}」在本指标内的顺序`)
  }

  function onLaneDrop(e: DragEvent, metricId: string) {
    const t = dragTask
    reset()
    if (!t) return
    const src = t.metricId ? findMetric(t.metricId) : null
    const dst = findMetric(metricId)
    if (!dst) return
    if (src && src.projId !== dst.projId) { rejectCrossProject(t, src.projName); return }
    const metricChanged = writeTo(t, dst, { refId: null, mode: 'in' })
    t.updatedAt = Date.now()
    persist()
    showToast(metricChanged ? `任务已归属「${dst.metric.title}」` : `已调整「${t.title}」顺序`)
  }

  function onDragEnd() { reset() }

  return reactive({
    dragTaskId, dropTip,
    onTaskDragStart, onRowDragOver, onLaneDragOver, onLaneDragLeave, onRowDrop, onLaneDrop, onDragEnd,
  })
}

export type TaskRelocationDnd = ReturnType<typeof useTaskRelocationDnd>
