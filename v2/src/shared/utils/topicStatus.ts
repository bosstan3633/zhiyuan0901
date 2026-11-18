import type { AppData, ID, TopicCard, TopicStatusDef } from '@/shared/models'
import { defaultTopicStatuses } from '@/shared/storage/defaults'

/** 选题状态按用户配置顺序返回副本，渲染层不直接排序。 */
export function sortedTopicStatuses(data: Pick<AppData, 'topicStatuses'>): TopicStatusDef[] {
  return [...(data.topicStatuses || [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'))
}

export function topicStatusOf(data: Pick<AppData, 'topicStatuses'>, statusId?: ID): TopicStatusDef | undefined {
  const list = data.topicStatuses || []
  return list.find(status => status.id === statusId) || sortedTopicStatuses(data)[0]
}

export function topicTerminalStatus(data: Pick<AppData, 'topicStatuses'>): TopicStatusDef | undefined {
  return sortedTopicStatuses(data).find(status => status.terminal) || sortedTopicStatuses(data).at(-1)
}

export function topicInProgressStatus(data: Pick<AppData, 'topicStatuses'>): TopicStatusDef | undefined {
  const ordered = sortedTopicStatuses(data)
  return ordered.find(status => !status.terminal && status.order > (ordered[0]?.order ?? -1))
    || ordered.find(status => !status.terminal)
    || ordered[0]
}

export function isTopicDone(data: Pick<AppData, 'topicStatuses'>, topic?: Pick<TopicCard, 'statusId'>): boolean {
  if (!topic) return false
  return !!topicStatusOf(data, topic.statusId)?.terminal
}

/** 进入今日重点后，选题从构思态推进到第一个非终点状态。 */
export function markTopicInProgress(data: AppData, topic: TopicCard, stamp = Date.now()): boolean {
  if (topic.deletedAt || isTopicDone(data, topic)) return false
  const next = topicInProgressStatus(data)
  if (!next || topic.statusId === next.id) return false
  topic.statusId = next.id
  topic.updatedAt = stamp
  return true
}

export function setTopicStatus(data: AppData, topic: TopicCard, statusId: ID, stamp = Date.now()): boolean {
  if (topic.statusId === statusId) return false
  if (!data.topicStatuses.some(status => status.id === statusId)) return false
  const wasDone = isTopicDone(data, topic)
  const nextDone = !!data.topicStatuses.find(status => status.id === statusId)?.terminal
  if (!wasDone && nextDone) topic.statusBeforeDoneId = topic.statusId
  topic.statusId = statusId
  topic.updatedAt = stamp
  topic.completedAt = nextDone ? (topic.completedAt || stamp) : undefined
  if (!nextDone) topic.statusBeforeDoneId = undefined
  return true
}

export function toggleTopicDone(data: AppData, topic: TopicCard, restoreStatusId?: ID): boolean {
  if (isTopicDone(data, topic)) {
    const fallback = restoreStatusId && data.topicStatuses.some(status => status.id === restoreStatusId)
      ? restoreStatusId
      : (topic.statusBeforeDoneId || topicInProgressStatus(data)?.id)
    if (!fallback) return false
    return setTopicStatus(data, topic, fallback)
  }
  const terminal = topicTerminalStatus(data)
  if (!terminal) return false
  return setTopicStatus(data, topic, terminal.id)
}

/**
 * V4.5.0：入库边界统一收敛选题状态。
 *
 * UI 只能保证用户从界面操作时的唯一完成态；导入、云恢复与三方合并都可能带来
 * 零个或多个 terminal。这里把业务真源收敛成“有且只有一个完成态”，并把选题卡
 * 的悬空状态引用迁移到第一个合法状态。函数只修非法值，不覆盖用户已有改名/改色。
 */
export function normalizeTopicStatusDomain(data: AppData): void {
  data.topics = Array.isArray(data.topics) ? data.topics : []
  data.topicStatuses = Array.isArray(data.topicStatuses) && data.topicStatuses.length
    ? data.topicStatuses
    : defaultTopicStatuses()

  const seen = new Set<string>()
  data.topicStatuses = data.topicStatuses.filter(status => {
    if (!status || typeof status.id !== 'string' || !status.id || seen.has(status.id)) return false
    seen.add(status.id)
    status.name = typeof status.name === 'string' && status.name.trim() ? status.name.trim() : '未命名状态'
    status.color = /^#[0-9a-f]{6}$/i.test(status.color || '') ? status.color : '#6F7C86'
    status.order = Number.isFinite(status.order) ? Number(status.order) : 0
    status.terminal = !!status.terminal
    return true
  })
  if (!data.topicStatuses.length) data.topicStatuses = defaultTopicStatuses()

  const ordered = sortedTopicStatuses(data)
  const terminal = ordered.find(status => status.terminal) || ordered.at(-1)!
  for (const status of data.topicStatuses) status.terminal = status.id === terminal.id

  const statusById = new Map(data.topicStatuses.map(status => [status.id, status] as const))
  const fallbackId = ordered[0]?.id || 'topic-idea'
  for (const topic of data.topics) {
    if (!statusById.has(topic.statusId)) topic.statusId = fallbackId
    if (topic.statusBeforeDoneId && !statusById.has(topic.statusBeforeDoneId)) topic.statusBeforeDoneId = undefined
    if (isTopicDone(data, topic)) {
      if (!topic.completedAt) topic.completedAt = topic.updatedAt || Date.now()
    } else if (topic.completedAt) {
      topic.completedAt = undefined
    }
  }
}
