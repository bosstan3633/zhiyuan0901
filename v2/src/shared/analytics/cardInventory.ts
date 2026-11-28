/**
 * V4.7.8 · 画像卡片库存聚合（纯函数，不做持久化）。
 *
 * 口径：
 *  - 存活卡 = `!deletedAt`；回收站卡不进入任何画像读数；
 *  - “活跃资产”按最近一次真实活动时间回看 12 个月，不把 lifecycleState 的 30 天窗口偷换成年度；
 *  - 高价值冷却卡统一走 lifecycleState，并要求历史调用 ≥ 3；
 *  - 链接有效 = 当前 `link` 或任一 `linkSlots` 槽位非空。
 */
import type {
  AppData,
  CuriosityCard,
  ResourceCard,
  TaskCard,
  TopicCard,
} from '@/shared/models'
import { lifecycleState } from '@/shared/utils/lifecycle'

export const DAY_MS = 86_400_000
export const ACTIVE_ASSET_DAYS = 365

export type AnyLiveCard = ResourceCard | TaskCard | CuriosityCard | TopicCard
export type CardKind = AnyLiveCard['kind']
export type ResourceLinkKind = 'url' | 'file' | 'obsidian' | 'none'

export interface CardKindCounts {
  resource: number
  task: number
  curiosity: number
  topic: number
}

export interface TagCount {
  tag: string
  count: number
}

export interface CardInventoryIndex {
  live: {
    resources: ResourceCard[]
    tasks: TaskCard[]
    curiosities: CuriosityCard[]
    topics: TopicCard[]
  }
  counts: CardKindCounts
  total: number
  monthAdded: number
  monthAddedByKind: CardKindCounts
  active12m: number
  highValueCooling: number
  linkedResources: number
  tagDistribution: TagCount[]
  linkKindById: Map<string, ResourceLinkKind>
  lastActivityById: Map<string, number>
}

export function isLiveCard(card: { deletedAt?: number } | null | undefined): boolean {
  return !!card && !card.deletedAt
}

/** 任一链接槽有值即视为“有可用链接”（命令可达性由打开动作再做协议校验）。 */
export function hasUsableResourceLink(
  resource: Pick<ResourceCard, 'link' | 'linkSlots'> | Pick<TopicCard, 'link' | 'linkSlots'> | null | undefined,
): boolean {
  if (!resource) return false
  if (String(resource.link || '').trim()) return true
  const slots = resource.linkSlots || {}
  return Boolean(
    String(slots.url || '').trim()
    || String(slots.file || '').trim()
    || String(slots.obsidian || '').trim(),
  )
}

/** 一张资源卡当前展示的链接类型；空卡返回 none。 */
export function resourceLinkKindOf(resource: Pick<ResourceCard, 'link' | 'linkType' | 'linkSlots'>): ResourceLinkKind {
  const slots = resource.linkSlots || {}
  const currentHasLink = String(resource.link || '').trim()
  if (currentHasLink) return resource.linkType || 'url'
  if (String(slots.url || '').trim()) return 'url'
  if (String(slots.file || '').trim()) return 'file'
  if (String(slots.obsidian || '').trim()) return 'obsidian'
  return 'none'
}

export function lastActivityAt(card: AnyLiveCard): number {
  const row = card as AnyLiveCard & { lastCalledAt?: number; completedAt?: number }
  return Math.max(
    Number(row.lastCalledAt) || 0,
    Number(row.completedAt) || 0,
    Number(row.updatedAt) || 0,
    Number(row.createdAt) || 0,
  )
}

export function monthStartAt(now = Date.now()): number {
  const date = new Date(now)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

function emptyCounts(): CardKindCounts {
  return { resource: 0, task: 0, curiosity: 0, topic: 0 }
}

/**
 * 一次遍历四张卡池并建立画像所需的只读索引。
 * 调用方复用返回的 live 数组和 Map，不要在渲染路径里反复 filter / find。
 */
export function buildCardInventory(data: AppData, now = Date.now()): CardInventoryIndex {
  const resources = (data.resources || []).filter(isLiveCard)
  const tasks = (data.tasks || []).filter(isLiveCard)
  const curiosities = (data.curiosities || []).filter(isLiveCard)
  const topics = (data.topics || []).filter(isLiveCard)
  const counts = emptyCounts()
  const monthAddedByKind = emptyCounts()
  const monthStart = monthStartAt(now)
  const activeFrom = now - ACTIVE_ASSET_DAYS * DAY_MS
  const tagCounts = new Map<string, number>()
  const lastActivityById = new Map<string, number>()
  let monthAdded = 0
  let active12m = 0
  let highValueCooling = 0

  const visit = (cards: AnyLiveCard[], kind: CardKind): void => {
    counts[kind] = cards.length
    for (const card of cards) {
      const last = lastActivityAt(card)
      lastActivityById.set(card.id, last)
      if (last >= activeFrom) active12m += 1
      if ((card.createdAt || 0) >= monthStart) {
        monthAdded += 1
        monthAddedByKind[kind] += 1
      }
      if ((card.callCount || 0) >= 3 && lifecycleState(card, now) === 'cooling') highValueCooling += 1
      const uniqueTags = new Set((card.tags || []).map(tag => tag.trim()).filter(Boolean))
      for (const tag of uniqueTags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    }
  }

  visit(resources, 'resource')
  visit(tasks, 'task')
  visit(curiosities, 'curiosity')
  visit(topics, 'topic')

  const tagDistribution = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'))
  const linkKindById = new Map(resources.map(resource => [resource.id, resourceLinkKindOf(resource)] as const))

  return {
    live: { resources, tasks, curiosities, topics },
    counts,
    total: resources.length + tasks.length + curiosities.length + topics.length,
    monthAdded,
    monthAddedByKind,
    active12m,
    highValueCooling,
    linkedResources: resources.filter(hasUsableResourceLink).length,
    tagDistribution,
    linkKindById,
    lastActivityById,
  }
}
