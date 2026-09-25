/**
 * R141：任务两种「离开」语义的统一真源（用户拍板）——
 * 挂载语境（指标/项目视图里的行操作）只做**解绑**：任务回任务调度模块，绝不删本体；
 * 本体语境（任务详情抽屉/任务面板/回收站链路）才**软删进回收站**，且顺手摘净 metric.taskIds 引用
 * （保留 t.metricId 字段作恢复真源，restore/撤销仍按它回填）。
 */
import type { AppData, TaskCard } from '@/shared/models'

/** 从全树所有指标摘除该任务引用，返回摘掉的条数 */
export function detachTaskFromMetrics(d: AppData, taskId: string): number {
  let n = 0
  for (const dir of d.compass.directions || []) {
    for (const p of dir.projects) {
      for (const m of p.metrics) {
        if (m.taskIds.includes(taskId)) { m.taskIds = m.taskIds.filter(x => x !== taskId); n++ }
      }
    }
  }
  return n
}

/**
 * R166 定案 1/2：`detachChildren` 与 `flattenTaskTree` 随「parentId 父子软层级」整体退役——
 * 子任务改成卡内嵌 `subtasks` 字段（不是独立卡），因此不再需要"父指针"这一概念，
 * 也就不需要解绑时摘子、也不需要把树展平成显示行。存量 parentId 由 repository 的
 * `foldParentIdSubtasks` 启动期一次性折叠进父卡清单。
 */

/** 解绑：摘除项目/指标归属（任务回任务调度模块未归属区），不删本体 */
export function unbindTaskFromMetric(d: AppData, t: TaskCard) {
  t.projectId = undefined
  t.metricId = undefined
  detachTaskFromMetrics(d, t.id)
  t.updatedAt = Date.now()
}

/** 软删进回收站：置 deletedAt + 摘净指标引用（t.metricId 保留，恢复时回填 taskIds 的锚） */
export function softDeleteTaskToTrash(d: AppData, t: TaskCard) {
  t.deletedAt = Date.now()
  detachTaskFromMetrics(d, t.id)
  t.updatedAt = Date.now()
}

/** 启动期一次性消毒：taskIds 里不存在的/已软删的 id 清掉（历史脏数据收口，幂等） */
export function sanitizeMetricTaskIds(d: AppData): boolean {
  const live = new Set((d.tasks || []).filter(t => !t.deletedAt).map(t => t.id))
  let changed = false
  for (const dir of d.compass.directions || []) {
    for (const p of dir.projects) {
      for (const m of p.metrics) {
        const kept = m.taskIds.filter(id => live.has(id))
        if (kept.length !== m.taskIds.length) { m.taskIds = kept; changed = true }
      }
    }
  }
  return changed
}
