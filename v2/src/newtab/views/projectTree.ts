import type { AppData, Direction, Metric, Project, TaskCard, TopicCard } from '@/shared/models'
import { tasksOfMetric, tasksOfProject } from './compassTaskMeta'
import { topicsOfMetric, topicsOfProject } from './compassTopicMeta'
import { isTaskDone } from '@/shared/utils/taskStatus'

export interface ProjectTreeMetric {
  id: string
  title: string
  metric: Metric
  tasks: TaskCard[]
  topics: TopicCard[]
  total: number
  done: number
}

export interface ProjectTree {
  project: Project
  direction: Direction | null
  metrics: ProjectTreeMetric[]
  orphanTasks: TaskCard[]
  orphanTopics: TopicCard[]
  allTasks: TaskCard[]
  allTopics: TopicCard[]
  total: number
  done: number
  progress: number
}

/**
 * 项目全貌树的唯一取数入口：项目 → 指标 → 任务 / 选题。
 *
 * 任务与选题都走既有双写口径（task.metricId / metric.taskIds、
 * topic.metricId / metric.topicIds），并在这里按项目指标认领一次：
 * 没有被任何指标认领的条目进入“未归属”，不再由模板各自 filter。
 */
export function buildProjectTree(d: AppData, project: Project): ProjectTree {
  const allTasks = tasksOfProject(project, d.tasks || [])
  const allTopics = topicsOfProject(project, d.topics || [])
  const metrics: ProjectTreeMetric[] = (project.metrics || []).map(metric => {
    const tasks = tasksOfMetric(metric, d.tasks || [])
    const topics = topicsOfMetric(metric, d.topics || [])
    return {
      id: metric.id,
      title: metric.title,
      metric,
      tasks,
      topics,
      total: tasks.length,
      done: tasks.filter(task => isTaskDone(d, task)).length,
    }
  })

  const ownedTaskIds = new Set(metrics.flatMap(row => row.tasks.map(task => task.id)))
  const ownedTopicIds = new Set(metrics.flatMap(row => row.topics.map(topic => topic.id)))
  const orphanTasks = allTasks.filter(task => !ownedTaskIds.has(task.id))
  const orphanTopics = allTopics.filter(topic => !ownedTopicIds.has(topic.id))
  const done = allTasks.filter(task => isTaskDone(d, task)).length

  return {
    project,
    direction: d.compass.directions.find(dir => dir.projects.some(row => row.id === project.id)) || null,
    metrics,
    orphanTasks,
    orphanTopics,
    allTasks,
    allTopics,
    total: allTasks.length,
    done,
    progress: allTasks.length ? Math.round(done / allTasks.length * 100) : (project.progress || 0),
  }
}
