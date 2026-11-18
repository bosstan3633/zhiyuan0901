import type { Metric, Project, TopicCard } from '@/shared/models'

/** 项目选题唯一口径：projectId / topic.metricId / metric.topicIds 三路并集。 */
export function topicsOfProject(proj: Project, topics: TopicCard[]): TopicCard[] {
  const metricIds = new Set(proj.metrics.map(metric => metric.id))
  const linkedIds = new Set(proj.metrics.flatMap(metric => metric.topicIds || []))
  const seen = new Set<string>()
  const out: TopicCard[] = []
  for (const topic of topics) {
    if (topic.deletedAt) continue
    if (topic.projectId !== proj.id && !(topic.metricId && metricIds.has(topic.metricId)) && !linkedIds.has(topic.id)) continue
    if (seen.has(topic.id)) continue
    seen.add(topic.id)
    out.push(topic)
  }
  return out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

/** 指标选题唯一口径：topic.metricId / metric.topicIds 双路并集，按 id 去重。 */
export function topicsOfMetric(metric: Metric, topics: TopicCard[]): TopicCard[] {
  const linkedIds = new Set(metric.topicIds || [])
  return dedupeTopics(topics.filter(topic => !topic.deletedAt && (topic.metricId === metric.id || linkedIds.has(topic.id))), metric)
}

/** 选题卡去重与排序：指标 topicIds 的轨道序优先，未在轨道者按创建时间兜底。 */
export function dedupeTopics(topics: TopicCard[], metric?: Metric): TopicCard[] {
  const seen = new Set<string>()
  const out: TopicCard[] = []
  for (const topic of topics) {
    if (seen.has(topic.id)) continue
    seen.add(topic.id)
    out.push(topic)
  }
  const rank = metric ? new Map((metric.topicIds || []).map((id, index) => [id, index] as const)) : null
  return out.sort((a, b) => {
    const ra = rank?.get(a.id)
    const rb = rank?.get(b.id)
    return ra !== undefined && rb !== undefined ? ra - rb : ra !== undefined ? -1 : rb !== undefined ? 1 : (a.createdAt || 0) - (b.createdAt || 0)
  })
}
