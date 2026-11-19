import type { TopicCard } from '@/shared/models'
import { openExternalLink } from '@/shared/utils/link'

export type TopicOutcomeKind = 'url' | 'obsidian'

export interface TopicOutcomeLink {
  kind: TopicOutcomeKind
  url: string
  label: '网页' | 'Obsidian'
}

/**
 * 选题成果链接只接受互联网网页与 Obsidian URI。
 * 裸域名按 https 补全，避免用户粘贴 `example.com/result` 后无法打开。
 */
export function topicOutcomeLink(topic: Pick<TopicCard, 'link'>): TopicOutcomeLink | null {
  const raw = String(topic.link || '').trim()
  if (!raw) return null
  if (/^obsidian:\/\//i.test(raw)) {
    return { kind: 'obsidian', url: raw, label: 'Obsidian' }
  }
  if (/^https?:\/\//i.test(raw)) {
    return { kind: 'url', url: raw, label: '网页' }
  }
  if (/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/:?#].*)?$/i.test(raw)) {
    return { kind: 'url', url: `https://${raw}`, label: '网页' }
  }
  return null
}

/** 保存时把可识别的成果链接同步到 linkType，避免详情与导出各自推断。 */
export function normalizeTopicOutcome(topic: TopicCard): boolean {
  const outcome = topicOutcomeLink(topic)
  if (!outcome) {
    topic.linkType = undefined
    return false
  }
  topic.link = outcome.url
  topic.linkType = outcome.kind
  return true
}

export function openTopicOutcome(topic: TopicCard): boolean {
  const outcome = topicOutcomeLink(topic)
  if (!outcome) return false
  return openExternalLink(outcome.url)
}
