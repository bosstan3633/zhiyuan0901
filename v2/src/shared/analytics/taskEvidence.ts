/**
 * V4.7.8 · 任务证据链 / 资源引用聚合（纯函数）。
 *
 * 关键边界：
 *  - 有效支撑只算“活任务 × 活资源 × 有可用链接”，快照不替代资源真身；
 *  - 引用计数读当前关系表（supportLinks / topicResourceLinks / curioSupportLinks），
 *    只要两端仍存活就计入，不要求资源一定有链接；解绑后立即回落，不把关系表当历史墓碑；
 *  - 同一任务重复关联同一资源只计一次；同一资源被多类卡引用时分别列数，不能相加。
 */
import type {
  AppData,
  CuriosityCard,
  ID,
  ResourceCard,
  SupportLink,
  TaskCard,
  TopicCard,
  TopicResourceLink,
} from '@/shared/models'
import { hasUsableResourceLink } from './cardInventory'

export interface ResourceReferences {
  resource: ResourceCard
  taskIds: Set<ID>
  topicIds: Set<ID>
  curioIds: Set<ID>
  totalRefs: number
}

export interface TaskEvidenceIndex {
  resourceById: Map<ID, ResourceCard>
  taskById: Map<ID, TaskCard>
  topicById: Map<ID, TopicCard>
  curioById: Map<ID, CuriosityCard>
  effectiveResourceIds: Set<ID>
  taskResourceIds: Map<ID, Set<ID>>
  taskSupportLinks: Map<ID, SupportLink[]>
  topicResourceIds: Map<ID, Set<ID>>
  curioResourceIds: Map<ID, Set<ID>>
  resourceRefs: Map<ID, ResourceReferences>
  taskIdsWithEffectiveSupport: Set<ID>
  topicIdsWithEffectiveSupport: Set<ID>
  curioIdsWithEffectiveSupport: Set<ID>
  zeroReferenceResourceIds: Set<ID>
  effectiveTaskSupportCount: number
  effectiveTaskSupportRate: number
  taskReferencedResourceCount: number
  highFrequencyResources: ResourceReferences[]
}

function addRef(
  refs: Map<ID, ResourceReferences>,
  resource: ResourceCard,
  kind: 'task' | 'topic' | 'curio',
  cardId: ID,
): void {
  const row = refs.get(resource.id) || {
    resource,
    taskIds: new Set<ID>(),
    topicIds: new Set<ID>(),
    curioIds: new Set<ID>(),
    totalRefs: 0,
  }
  row[kind === 'task' ? 'taskIds' : kind === 'topic' ? 'topicIds' : 'curioIds'].add(cardId)
  refs.set(resource.id, row)
}

export function buildTaskEvidence(data: AppData): TaskEvidenceIndex {
  const resources = (data.resources || []).filter(resource => !resource.deletedAt)
  const tasks = (data.tasks || []).filter(task => !task.deletedAt)
  const topics = (data.topics || []).filter(topic => !topic.deletedAt)
  const curiosities = (data.curiosities || []).filter(curio => !curio.deletedAt)
  const resourceById = new Map(resources.map(resource => [resource.id, resource] as const))
  const taskById = new Map(tasks.map(task => [task.id, task] as const))
  // 子任务不是独立卡：只有仍挂在同一张活任务的 subtasks 里，subId 才算有效。
  const taskIdBySubId = new Map<ID, ID>()
  for (const task of tasks) {
    for (const sub of task.subtasks || []) taskIdBySubId.set(sub.id, task.id)
  }
  const topicById = new Map(topics.map(topic => [topic.id, topic] as const))
  const curioById = new Map(curiosities.map(curio => [curio.id, curio] as const))
  const effectiveResourceIds = new Set(
    resources.filter(hasUsableResourceLink).map(resource => resource.id),
  )
  const taskResourceIds = new Map<ID, Set<ID>>()
  const taskSupportLinks = new Map<ID, SupportLink[]>()
  const topicResourceIds = new Map<ID, Set<ID>>()
  const curioResourceIds = new Map<ID, Set<ID>>()
  const resourceRefs = new Map<ID, ResourceReferences>()

  for (const link of data.supportLinks || []) {
    if (!link || !taskById.has(link.taskId) || !resourceById.has(link.resourceId)) continue
    if (link.subId && taskIdBySubId.get(link.subId) !== link.taskId) continue
    const rows = taskSupportLinks.get(link.taskId)
    if (rows) rows.push(link)
    else taskSupportLinks.set(link.taskId, [link])
    addRef(resourceRefs, resourceById.get(link.resourceId)!, 'task', link.taskId)
    if (effectiveResourceIds.has(link.resourceId)) {
      const ids = taskResourceIds.get(link.taskId)
      if (ids) ids.add(link.resourceId)
      else taskResourceIds.set(link.taskId, new Set([link.resourceId]))
    }
  }

  for (const link of data.topicResourceLinks || []) {
    if (!link || !topicById.has(link.topicId) || !resourceById.has(link.resourceId)) continue
    addRef(resourceRefs, resourceById.get(link.resourceId)!, 'topic', link.topicId)
    if (effectiveResourceIds.has(link.resourceId)) {
      const ids = topicResourceIds.get(link.topicId)
      if (ids) ids.add(link.resourceId)
      else topicResourceIds.set(link.topicId, new Set([link.resourceId]))
    }
  }

  for (const link of data.curioSupportLinks || []) {
    if (!link || !curioById.has(link.curioId) || !resourceById.has(link.resourceId)) continue
    addRef(resourceRefs, resourceById.get(link.resourceId)!, 'curio', link.curioId)
    if (effectiveResourceIds.has(link.resourceId)) {
      const ids = curioResourceIds.get(link.curioId)
      if (ids) ids.add(link.resourceId)
      else curioResourceIds.set(link.curioId, new Set([link.resourceId]))
    }
  }

  for (const row of resourceRefs.values()) {
    row.totalRefs = row.taskIds.size + row.topicIds.size + row.curioIds.size
  }

  const taskIdsWithEffectiveSupport = new Set(taskResourceIds.keys())
  const topicIdsWithEffectiveSupport = new Set(topicResourceIds.keys())
  const curioIdsWithEffectiveSupport = new Set(curioResourceIds.keys())
  const zeroReferenceResourceIds = new Set(
    resources.filter(resource => !resourceRefs.has(resource.id)).map(resource => resource.id),
  )
  const taskReferencedResourceCount = resources.filter(resource => {
    const row = resourceRefs.get(resource.id)
    return !!row && row.taskIds.size > 0
  }).length
  const effectiveTaskSupportCount = taskIdsWithEffectiveSupport.size
  const effectiveTaskSupportRate = tasks.length
    ? Math.round((effectiveTaskSupportCount / tasks.length) * 100)
    : 0
  const highFrequencyResources = [...resourceRefs.values()]
    .sort((a, b) =>
      b.totalRefs - a.totalRefs
      || (b.resource.callCount || 0) - (a.resource.callCount || 0)
      || a.resource.title.localeCompare(b.resource.title, 'zh-CN'))

  return {
    resourceById,
    taskById,
    topicById,
    curioById,
    effectiveResourceIds,
    taskResourceIds,
    taskSupportLinks,
    topicResourceIds,
    curioResourceIds,
    resourceRefs,
    taskIdsWithEffectiveSupport,
    topicIdsWithEffectiveSupport,
    curioIdsWithEffectiveSupport,
    zeroReferenceResourceIds,
    effectiveTaskSupportCount,
    effectiveTaskSupportRate,
    taskReferencedResourceCount,
    highFrequencyResources,
  }
}

export function effectiveSupportCountOfTask(index: TaskEvidenceIndex, taskId: ID): number {
  return index.taskResourceIds.get(taskId)?.size || 0
}

export function referencesOfResource(index: TaskEvidenceIndex, resourceId: ID): ResourceReferences | undefined {
  return index.resourceRefs.get(resourceId)
}
