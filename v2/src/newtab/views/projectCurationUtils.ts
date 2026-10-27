import type { Direction, Metric, Project, TaskCard } from '@/shared/models'

export function goalOfProject(directions: Direction[], projectId: string): Direction | null {
  for (const dir of directions) {
    if (dir.projects.some(x => x.id === projectId)) return dir
  }
  return null
}

/** 14 天无任务更新视为停滞。 */
export function isProjectStalled(tasks: TaskCard[], project: Project): boolean {
  const rows = tasks.filter(t => !t.deletedAt && t.projectId === project.id)
  const recent = rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  return recent ? Date.now() - (recent.updatedAt || 0) > 14 * 86400_000 : rows.length > 0
}

/** 指标下的任务，按卡池顺序稳定排列并去重。 */
export function tasksForMetricId(tasks: TaskCard[], metricId: string): TaskCard[] {
  const seen = new Set<string>()
  const order = new Map(tasks.map((t, i) => [t.id, i]))
  return tasks
    .filter(t => !t.deletedAt && t.metricId === metricId)
    .filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    .sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0))
}

export function metricProgress(tasks: TaskCard[], metricId: string): number {
  const rows = tasksForMetricId(tasks, metricId)
  return rows.length ? Math.round(rows.filter(t => t.status === 'done').length / rows.length * 100) : 0
}

/** 指标列表与删除确认使用同一标题回退，避免空标题显示成空白。 */
export function metricDisplayTitle(metric: Metric): string {
  return metric.title || '未命名指标'
}

export function directionTermLabel(dir: Direction): string {
  return dir.term === 'long' ? '远期' : dir.term === 'short' ? '近期' : dir.term === 'mid' ? '中期' : ''
}

export function priorityLabel(pr: string): string {
  return pr === 'high' ? '高优' : pr === 'mid' || pr === 'medium' ? '中优' : '低优'
}

export function priorityTag(pr: string): string {
  return pr === 'high' ? 'danger' : 'plain'
}

export function taskAssetCount(task: TaskCard): number {
  return (task.assets || []).length
}

export function taskAssetSize(task: TaskCard): string {
  const total = (task.assets || []).reduce((sum, asset) => sum + (asset.size || 0), 0)
  return assetSizeLabel(total)
}

export function assetSizeLabel(size?: number): string {
  if (!size) return ''
  return size > 1024 * 1024 ? (size / 1024 / 1024).toFixed(1) + 'MB' : Math.max(1, Math.round(size / 1024)) + 'KB'
}
