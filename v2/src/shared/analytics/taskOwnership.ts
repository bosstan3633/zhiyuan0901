/**
 * V4.7.8 · 任务归属解析（纯函数）。
 *
 * 唯一解析顺序：
 *  1. 有效 `metricId`；
 *  2. 唯一 `metric.taskIds` 命中；
 *  3. 有效 `projectId`；
 *  4. 未归属。
 *
 * 多条指标同时把任务列入 taskIds 时，归属结果记为 `ambiguous`，不按任一条重复计数；
 * 显式项目与解析出的指标项目不一致、悬空 id 等写入 conflictReasons，供“归属冲突”筛选。
 */
import type { AppData, ID, Metric, Project, TaskCard } from '@/shared/models'

export type TaskOwnershipSource = 'metric-id' | 'metric-taskIds' | 'project-id' | 'unassigned' | 'ambiguous'
export type OwnershipConflictReason =
  | 'multiple-metric-matches'
  | 'project-metric-mismatch'
  | 'orphan-project'
  | 'orphan-metric'

export interface TaskOwnership {
  taskId: ID
  task: TaskCard
  status: TaskOwnershipSource
  projectId?: ID
  projectName?: string
  directionName?: string
  metricId?: ID
  metricTitle?: string
  metricIdsFromTaskIds: ID[]
  conflict: boolean
  conflictReasons: OwnershipConflictReason[]
}

export interface OwnershipBucket {
  id: ID
  name: string
  count: number
  directionName?: string
}

export interface MetricBucket {
  id: ID
  title: string
  count: number
  projectId: ID
  projectName: string
}

export interface TaskOwnershipIndex {
  byTask: Map<ID, TaskOwnership>
  projectBuckets: OwnershipBucket[]
  metricBuckets: MetricBucket[]
  unassignedIds: Set<ID>
  ambiguousIds: Set<ID>
  conflictIds: Set<ID>
  projectAttachedCount: number
  metricAttachedCount: number
}

interface FlatProject {
  project: Project
  directionName: string
}

interface FlatMetric {
  metric: Metric
  project: Project
  directionName: string
}

function uniqueIds(ids: ID[]): ID[] {
  return [...new Set(ids)]
}

export function buildTaskOwnership(data: AppData): TaskOwnershipIndex {
  const liveTasks = (data.tasks || []).filter(task => !task.deletedAt)
  const liveTaskIds = new Set(liveTasks.map(task => task.id))
  const projects: FlatProject[] = []
  const metrics: FlatMetric[] = []
  const projectById = new Map<ID, FlatProject>()
  const metricById = new Map<ID, FlatMetric>()
  const metricIdsByTask = new Map<ID, ID[]>()

  for (const direction of data.compass?.directions || []) {
    for (const project of direction.projects || []) {
      const flatProject: FlatProject = { project, directionName: direction.name }
      projects.push(flatProject)
      projectById.set(project.id, flatProject)
      for (const metric of project.metrics || []) {
        const flatMetric: FlatMetric = { metric, project, directionName: direction.name }
        metrics.push(flatMetric)
        metricById.set(metric.id, flatMetric)
        for (const taskId of metric.taskIds || []) {
          if (!liveTaskIds.has(taskId)) continue
          const list = metricIdsByTask.get(taskId)
          if (list) list.push(metric.id)
          else metricIdsByTask.set(taskId, [metric.id])
        }
      }
    }
  }
  for (const [taskId, ids] of metricIdsByTask) metricIdsByTask.set(taskId, uniqueIds(ids))

  const byTask = new Map<ID, TaskOwnership>()
  const projectCount = new Map<ID, number>()
  const metricCount = new Map<ID, number>()
  const unassignedIds = new Set<ID>()
  const ambiguousIds = new Set<ID>()
  const conflictIds = new Set<ID>()
  let projectAttachedCount = 0
  let metricAttachedCount = 0

  for (const task of liveTasks) {
    const explicitProject = task.projectId ? projectById.get(task.projectId) : undefined
    const explicitMetric = task.metricId ? metricById.get(task.metricId) : undefined
    const metricIdsFromTaskIds = metricIdsByTask.get(task.id) || []
    const conflictReasons = new Set<OwnershipConflictReason>()

    if (task.projectId && !explicitProject) conflictReasons.add('orphan-project')
    if (task.metricId && !explicitMetric) conflictReasons.add('orphan-metric')
    if (metricIdsFromTaskIds.length > 1) conflictReasons.add('multiple-metric-matches')

    let status: TaskOwnershipSource = 'unassigned'
    let metric: FlatMetric | undefined
    let project: FlatProject | undefined

    if (explicitMetric) {
      status = 'metric-id'
      metric = explicitMetric
      project = projectById.get(explicitMetric.project.id)
    } else if (metricIdsFromTaskIds.length === 1) {
      status = 'metric-taskIds'
      metric = metricById.get(metricIdsFromTaskIds[0])
      project = metric ? projectById.get(metric.project.id) : undefined
    } else if (metricIdsFromTaskIds.length > 1) {
      status = 'ambiguous'
      ambiguousIds.add(task.id)
    } else if (explicitProject) {
      status = 'project-id'
      project = explicitProject
    }

    if (explicitProject && project && explicitProject.project.id !== project.project.id) {
      conflictReasons.add('project-metric-mismatch')
    }

    const conflict = conflictReasons.size > 0
    if (conflict) conflictIds.add(task.id)
    if (status === 'unassigned') unassignedIds.add(task.id)
    if (project) {
      projectAttachedCount += 1
      projectCount.set(project.project.id, (projectCount.get(project.project.id) || 0) + 1)
    }
    if (metric) {
      metricAttachedCount += 1
      metricCount.set(metric.metric.id, (metricCount.get(metric.metric.id) || 0) + 1)
    }

    byTask.set(task.id, {
      taskId: task.id,
      task,
      status,
      projectId: project?.project.id,
      projectName: project?.project.name,
      directionName: project?.directionName,
      metricId: metric?.metric.id,
      metricTitle: metric?.metric.title,
      metricIdsFromTaskIds,
      conflict,
      conflictReasons: [...conflictReasons],
    })
  }

  const projectBuckets = [...projectCount.entries()]
    .map(([id, count]) => {
      const flat = projectById.get(id)
      return {
        id,
        name: flat?.project.name || '未知项目',
        directionName: flat?.directionName,
        count,
      }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
  const metricBuckets = [...metricCount.entries()]
    .map(([id, count]) => {
      const flat = metricById.get(id)
      return {
        id,
        title: flat?.metric.title || '未知指标',
        projectId: flat?.project.id || '',
        projectName: flat?.project.name || '',
        count,
      }
    })
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'zh-CN'))

  return {
    byTask,
    projectBuckets,
    metricBuckets,
    unassignedIds,
    ambiguousIds,
    conflictIds,
    projectAttachedCount,
    metricAttachedCount,
  }
}
