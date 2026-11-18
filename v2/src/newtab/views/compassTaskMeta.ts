import type { Metric, Project, TaskCard } from '@/shared/models'

/** 项目任务唯一口径：projectId / task.metricId / metric.taskIds 三路并集。 */
export function tasksOfProject(proj: Project, tasks: TaskCard[]): TaskCard[] {
  const metricIds = new Set(proj.metrics.map(metric => metric.id))
  const taskIds = new Set(proj.metrics.flatMap(metric => metric.taskIds))
  const seen = new Set<string>()
  const out: TaskCard[] = []
  for (const task of tasks) {
    if (task.deletedAt) continue
    if (task.projectId !== proj.id && !(task.metricId && metricIds.has(task.metricId)) && !taskIds.has(task.id)) continue
    if (seen.has(task.id)) continue
    seen.add(task.id)
    out.push(task)
  }
  return out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

/** 指标任务唯一口径：task.metricId / metric.taskIds 双路并集，按 id 去重。 */
export function tasksOfMetric(metric: Metric, tasks: TaskCard[]): TaskCard[] {
  const linkedIds = new Set(metric.taskIds || [])
  return dedupeSorted(tasks.filter(task => !task.deletedAt && (task.metricId === metric.id || linkedIds.has(task.id))), metric)
}

/** 任务去重双保险；有 metric 时按 taskIds 轨道序排，新数组 sort 不修改入参。 */
export function dedupeSorted(tasks: TaskCard[], metric?: Metric): TaskCard[] {
  const seen = new Set<string>()
  const out: TaskCard[] = []
  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    out.push(task)
  }
  const rank = metric ? new Map((metric.taskIds || []).map((id, index) => [id, index] as const)) : null
  return out.sort((a, b) => {
    const ra = rank?.get(a.id)
    const rb = rank?.get(b.id)
    return ra !== undefined && rb !== undefined ? ra - rb : ra !== undefined ? -1 : rb !== undefined ? 1 : (a.createdAt || 0) - (b.createdAt || 0)
  })
}
