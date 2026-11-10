import type { AppData, ResourceCard } from '@/shared/models'
import { captureIdOfCard, ensureCaptureIdentity } from '@/shared/utils/captureIdentity'

function hasText(value: string | undefined): boolean {
  return !!String(value || '').trim()
}

function uniqueStrings(lists: (string[] | undefined)[]): string[] {
  return [...new Set(lists.flatMap(list => list || []).map(value => String(value || '').trim()).filter(Boolean))]
}

function resourceScore(card: ResourceCard): number {
  return (hasText(card.link) ? 100_000 : 0)
    + (card.tags || []).length * 100
    + String(card.description || '').length
    + (card.updatedAt || 0) / 1e9
}

function mergeDuplicateInto(keeper: ResourceCard, duplicate: ResourceCard): void {
  if (!hasText(keeper.link) && hasText(duplicate.link)) {
    keeper.link = duplicate.link
    keeper.linkType = duplicate.linkType
  }
  if (!hasText(keeper.description) && hasText(duplicate.description)) keeper.description = duplicate.description
  keeper.tags = uniqueStrings([keeper.tags, duplicate.tags])
  keeper.createdAt = Math.min(keeper.createdAt || duplicate.createdAt || Date.now(), duplicate.createdAt || keeper.createdAt || Date.now())
  keeper.updatedAt = Math.max(keeper.updatedAt || 0, duplicate.updatedAt || 0, Date.now())
  keeper.callCount = Math.max(keeper.callCount || 0, duplicate.callCount || 0)
  keeper.lastCalledAt = Math.max(keeper.lastCalledAt || 0, duplicate.lastCalledAt || 0) || undefined
  keeper.pinned = keeper.pinned || duplicate.pinned
  keeper.starred = keeper.starred || duplicate.starred
  keeper.aiTouchedAt = Math.max(keeper.aiTouchedAt || 0, duplicate.aiTouchedAt || 0) || undefined
  keeper.customFields = { ...(duplicate.customFields || {}), ...(keeper.customFields || {}) }
  if (!keeper.assets?.length && duplicate.assets?.length) keeper.assets = duplicate.assets.map(asset => ({ ...asset }))
}

/**
 * 修复“同一条 Inbox 采集被两代导入逻辑各写一张资源卡”的存量脏数据。
 *
 * 只合并同一 capture id 的多张活卡；普通同名资源不会因为标题相同被误删。
 * 有链接、标签和完整卡面的那张优先保留，其余软删进回收站，便于审计和人工恢复。
 */
export function reconcileCapturedResources(data: AppData): number {
  const groups = new Map<string, ResourceCard[]>()
  for (const card of data.resources || []) {
    if (!card || card.deletedAt || card.isThesis) continue
    const captureId = captureIdOfCard(card)
    if (!captureId) continue
    const rows = groups.get(captureId) || []
    rows.push(card)
    groups.set(captureId, rows)
  }

  let changed = 0
  for (const [captureId, rows] of groups) {
    if (!rows.length) continue
    rows.sort((a, b) => resourceScore(b) - resourceScore(a))
    const keeper = rows[0]
    if (ensureCaptureIdentity(keeper, captureId)) changed++
    if (rows.length === 1) continue

    const now = Date.now()
    for (const duplicate of rows.slice(1)) {
      mergeDuplicateInto(keeper, duplicate)
      duplicate.deletedAt = now
      duplicate.updatedAt = now
      changed++
    }
    ensureCaptureIdentity(keeper, captureId)
  }
  return changed
}
