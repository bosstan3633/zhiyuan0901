import type { AppData, ResourceCard, TopicCard, TopicResourceLink } from '@/shared/models'
import { uid } from '@/shared/utils'

export interface TopicResourceIndex {
  byTopic: Map<string, TopicResourceLink[]>
  byResource: Map<string, TopicResourceLink[]>
}

export function buildTopicResourceIndex(data: AppData): TopicResourceIndex {
  const byTopic = new Map<string, TopicResourceLink[]>()
  const byResource = new Map<string, TopicResourceLink[]>()
  const liveTopic = new Set((data.topics || []).filter(card => !card.deletedAt).map(card => card.id))
  const liveResource = new Set((data.resources || []).filter(card => !card.deletedAt).map(card => card.id))
  for (const link of data.topicResourceLinks || []) {
    if (!link || !liveTopic.has(link.topicId)) continue
    if (!liveResource.has(link.resourceId) && !link.snapshot) continue
    push(byTopic, link.topicId, link)
    push(byResource, link.resourceId, link)
  }
  for (const map of [byTopic, byResource]) {
    for (const list of map.values()) list.sort((a, b) => b.createdAt - a.createdAt)
  }
  return { byTopic, byResource }
}

function push(map: Map<string, TopicResourceLink[]>, key: string, link: TopicResourceLink): void {
  const list = map.get(key)
  if (list) list.push(link)
  else map.set(key, [link])
}

export function topicResourcesOf(data: AppData, topicId: string): Array<{ link: TopicResourceLink; resource: ResourceCard }> {
  const idx = buildTopicResourceIndex(data)
  return (idx.byTopic.get(topicId) || [])
    .map(link => ({
      link,
      resource: (data.resources || []).find(card => !card.deletedAt && card.id === link.resourceId) || link.snapshot,
    }))
    .filter((row): row is { link: TopicResourceLink; resource: ResourceCard } => !!row.resource)
}

export function addTopicResourceLink(
  data: AppData,
  input: { topic: TopicCard; resource: ResourceCard; from?: 'ai' | 'manual'; why?: string },
): { link?: TopicResourceLink; dup: boolean } {
  const list = (data.topicResourceLinks = data.topicResourceLinks || [])
  const existing = list.find(link => link.topicId === input.topic.id && link.resourceId === input.resource.id)
  if (existing) return { link: existing, dup: true }
  const link: TopicResourceLink = {
    id: uid('trl'),
    topicId: input.topic.id,
    resourceId: input.resource.id,
    from: input.from || 'manual',
    why: input.why?.trim() || undefined,
    createdAt: Date.now(),
    snapshot: JSON.parse(JSON.stringify(input.resource)) as ResourceCard,
  }
  list.push(link)
  return { link, dup: false }
}

export function removeTopicResourceLink(data: AppData, linkId: string): boolean {
  const list = data.topicResourceLinks || []
  const before = list.length
  data.topicResourceLinks = list.filter(link => link.id !== linkId)
  return data.topicResourceLinks.length !== before
}

export function purgeTopicResourceLinks(
  data: AppData,
  opts: { topicIds?: Set<string>; resourceIds?: Set<string> },
): number {
  const list = data.topicResourceLinks || []
  const next = list.filter(link =>
    !(opts.topicIds?.has(link.topicId) || opts.resourceIds?.has(link.resourceId)))
  const removed = list.length - next.length
  if (removed) data.topicResourceLinks = next
  return removed
}
