import type { AppData, TopicCard } from '@/shared/models'

/** 从全树指标摘除选题引用；选题本体仍保留 metricId 作为恢复锚。 */
export function detachTopicFromMetrics(data: AppData, topicId: string): number {
  let removed = 0
  for (const direction of data.compass.directions || []) {
    for (const project of direction.projects || []) {
      for (const metric of project.metrics || []) {
        const next = (metric.topicIds || []).filter(id => id !== topicId)
        removed += (metric.topicIds?.length || 0) - next.length
        metric.topicIds = next
      }
    }
  }
  return removed
}

export function unbindTopicFromMetric(data: AppData, topic: TopicCard): void {
  topic.projectId = undefined
  topic.metricId = undefined
  detachTopicFromMetrics(data, topic.id)
  topic.updatedAt = Date.now()
}

export function softDeleteTopicToTrash(data: AppData, topic: TopicCard): void {
  topic.deletedAt = Date.now()
  topic.updatedAt = topic.deletedAt
  detachTopicFromMetrics(data, topic.id)
}

export function sanitizeMetricTopicIds(data: AppData): boolean {
  const live = new Set((data.topics || []).filter(topic => !topic.deletedAt).map(topic => topic.id))
  let changed = false
  for (const direction of data.compass.directions || []) {
    for (const project of direction.projects || []) {
      for (const metric of project.metrics || []) {
        const current = metric.topicIds || []
        const next = current.filter(id => live.has(id))
        if (next.length !== current.length) {
          metric.topicIds = next
          changed = true
        }
      }
    }
  }
  // 策展节点的选题引用保留到硬删为止：软删进回收站后恢复时，节点关系应原样回来。
  const existing = new Set((data.topics || []).map(topic => topic.id))
  if (sanitizeCategoryTopicIds(data, existing)) changed = true
  return changed
}

/** 摘除策展节点上的选题引用；只改引用，不删除选题本体。 */
export function unlinkTopicFromCategories(data: AppData, topicIds: Set<string>): number {
  let removed = 0
  for (const category of data.categories || []) {
    if (!category.linkedTopicIds?.length) continue
    const next = category.linkedTopicIds.filter(id => !topicIds.has(id))
    removed += category.linkedTopicIds.length - next.length
    category.linkedTopicIds = next.length ? next : undefined
  }
  return removed
}

function sanitizeCategoryTopicIds(data: AppData, liveTopicIds: Set<string>): boolean {
  let changed = false
  for (const category of data.categories || []) {
    if (!Array.isArray(category.linkedTopicIds)) continue
    const next = [...new Set(category.linkedTopicIds.filter(id => liveTopicIds.has(id)))]
    if (next.length !== category.linkedTopicIds.length) {
      category.linkedTopicIds = next.length ? next : undefined
      changed = true
    }
  }
  return changed
}

export function attachTopicToMetric(data: AppData, topic: TopicCard, projectId?: string, metricId?: string): void {
  detachTopicFromMetrics(data, topic.id)
  topic.projectId = projectId || undefined
  topic.metricId = metricId || undefined
  topic.updatedAt = Date.now()
  if (!metricId) return
  for (const direction of data.compass.directions || []) {
    for (const project of direction.projects || []) {
      const metric = project.metrics.find(row => row.id === metricId)
      if (!metric) continue
      metric.topicIds = metric.topicIds || []
      if (!metric.topicIds.includes(topic.id)) metric.topicIds.push(topic.id)
      topic.projectId = project.id
      return
    }
  }
}
