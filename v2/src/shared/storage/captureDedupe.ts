import { CURATION_WS_ID, type AppData, type ResourceCard } from '@/shared/models'
import { captureIdOfCard, ensureCaptureIdentity } from '@/shared/utils/captureIdentity'
import { canonicalHttpUrl } from '@/shared/utils/url'

/** 仅在同一标题、且两侧只差一个 URL 的历史双写窗口内兜底。 */
const LEGACY_DUPLICATE_WINDOW_MS = 60_000

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

function isActivePoolResource(card: ResourceCard): boolean {
  return !!card && !card.deletedAt && !card.isThesis && card.workspaceId === CURATION_WS_ID
}

function canonicalUrlOf(card: ResourceCard): string {
  if (card.linkType !== 'url' || !hasText(card.link)) return ''
  return canonicalHttpUrl(card.link)
}

function collapseRelations<T>(
  rows: T[],
  keyOf: (row: T) => string,
  merge?: (keeper: T, duplicate: T) => T,
): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const current = map.get(key)
    map.set(key, current && merge ? merge(current, row) : current || row)
  }
  return [...map.values()]
}

function preferSnapshotRelation<T extends { snapshot?: ResourceCard }>(keeper: T, duplicate: T): T {
  if (!keeper.snapshot && duplicate.snapshot) keeper.snapshot = duplicate.snapshot
  return keeper
}

/**
 * 去重不是只删一张源卡：常用夹、任务支持、策展投射和愿景/使命引用
 * 都必须迁到保留卡，否则镜像仍在，但下一次编辑会指向回收站里的旧 id。
 */
function migrateResourceReferences(data: AppData, fromId: string, toId: string): void {
  if (!fromId || !toId || fromId === toId) return
  for (const link of data.supportLinks || []) {
    if (link.resourceId === fromId) link.resourceId = toId
  }
  data.supportLinks = collapseRelations(
    data.supportLinks || [],
    row => `${row.taskId}|${row.subId || ''}|${row.resourceId}`,
    preferSnapshotRelation,
  )

  for (const link of data.curioSupportLinks || []) {
    if (link.resourceId === fromId) link.resourceId = toId
  }
  data.curioSupportLinks = collapseRelations(
    data.curioSupportLinks || [],
    row => `${row.curioId}|${row.resourceId}`,
  )

  for (const projection of data.curationProjections || []) {
    if (projection.cardId === fromId) projection.cardId = toId
  }
  data.curationProjections = collapseRelations(
    data.curationProjections || [],
    row => `${row.kind}|${row.wsId}|${row.targetWsId || ''}|${row.targetCatId || ''}|${row.cardId || ''}`,
    preferSnapshotRelation,
  )

  for (const mirror of data.resourceFolderMirrors || []) {
    if (mirror.resourceId === fromId) mirror.resourceId = toId
  }
  data.resourceFolderMirrors = collapseRelations(
    data.resourceFolderMirrors || [],
    row => `${row.folderId}|${row.resourceId}`,
    preferSnapshotRelation,
  )

  for (const key of ['vision', 'mission'] as const) {
    const target = data.compass?.[key]
    if (!target?.linkedResourceIds?.length) continue
    target.linkedResourceIds = [...new Set(target.linkedResourceIds.map(id => id === fromId ? toId : id))]
  }
}

function mergeDuplicateInto(keeper: ResourceCard, duplicate: ResourceCard): void {
  if (!hasText(keeper.link) && hasText(duplicate.link)) {
    keeper.link = duplicate.link
    keeper.linkType = duplicate.linkType
  }
  if (!hasText(keeper.title) && hasText(duplicate.title)) keeper.title = duplicate.title
  if (String(duplicate.description || '').length > String(keeper.description || '').length) {
    keeper.description = duplicate.description
  }
  if (!keeper.sourceCaptureId && duplicate.sourceCaptureId) keeper.sourceCaptureId = duplicate.sourceCaptureId
  if (!keeper.sourceType && duplicate.sourceType) keeper.sourceType = duplicate.sourceType
  keeper.tags = uniqueStrings([keeper.tags, duplicate.tags])
  keeper.createdAt = Math.min(keeper.createdAt || duplicate.createdAt || Date.now(), duplicate.createdAt || keeper.createdAt || Date.now())
  keeper.updatedAt = Math.max(keeper.updatedAt || 0, duplicate.updatedAt || 0, Date.now())
  keeper.callCount = Math.max(keeper.callCount || 0, duplicate.callCount || 0)
  keeper.lastCalledAt = Math.max(keeper.lastCalledAt || 0, duplicate.lastCalledAt || 0) || undefined
  keeper.importedAt = Math.min(keeper.importedAt || duplicate.importedAt || 0, duplicate.importedAt || keeper.importedAt || 0) || undefined
  keeper.pinned = keeper.pinned || duplicate.pinned
  keeper.starred = keeper.starred || duplicate.starred
  keeper.aiTouchedAt = Math.max(keeper.aiTouchedAt || 0, duplicate.aiTouchedAt || 0) || undefined
  keeper.coolingDays = keeper.coolingDays || duplicate.coolingDays
  keeper.snoozedUntil = Math.max(keeper.snoozedUntil || 0, duplicate.snoozedUntil || 0) || undefined
  keeper.customFields = { ...(duplicate.customFields || {}), ...(keeper.customFields || {}) }
  keeper.linkSlots = { ...(duplicate.linkSlots || {}), ...(keeper.linkSlots || {}) }
  if (!Object.keys(keeper.linkSlots).length) delete keeper.linkSlots
  if (!keeper.customFields || !Object.keys(keeper.customFields).length) keeper.customFields = {}
  const assets = new Map((keeper.assets || []).map(asset => [asset.id, asset]))
  for (const asset of duplicate.assets || []) if (!assets.has(asset.id)) assets.set(asset.id, { ...asset })
  if (assets.size) keeper.assets = [...assets.values()]
}

function mergeRows(
  data: AppData,
  rows: ResourceCard[],
  now: number,
  captureId?: string,
): number {
  const live = rows.filter(row => row && !row.deletedAt)
  if (!live.length) return 0
  live.sort((a, b) => resourceScore(b) - resourceScore(a))
  const keeper = live[0]
  let changed = 0
  if (captureId && ensureCaptureIdentity(keeper, captureId)) changed++
  for (const duplicate of live.slice(1)) {
    mergeDuplicateInto(keeper, duplicate)
    migrateResourceReferences(data, duplicate.id, keeper.id)
    duplicate.deletedAt = now
    duplicate.updatedAt = now
    changed++
  }
  if (captureId) {
    ensureCaptureIdentity(keeper, captureId)
    keeper.sourceCaptureId = captureId
    keeper.customFields = { ...(keeper.customFields || {}), captureInboxId: captureId }
  }
  return changed
}

/**
 * 修复资源池重复卡。
 *
 * 合并顺序是不可交换的：
 * 1. 同一 capture id 的旧/新导入双写；
 * 2. 同一 HTTP(S) 规范 URL 的所有有效资源；
 * 3. 没有 URL 身份可判时，才用“标题完全一致 + 创建时间 60 秒内 + 仅一侧有 URL”
 *    的历史双写特征兜底。
 *
 * 纯同名但 URL 不同的卡不会合并。重复卡软删进回收站，保留卡接管所有镜像关系。
 */
export function reconcileCapturedResources(data: AppData): number {
  const now = Date.now()
  let changed = 0

  const captureGroups = new Map<string, ResourceCard[]>()
  for (const card of data.resources || []) {
    if (!isActivePoolResource(card)) continue
    const captureId = captureIdOfCard(card)
    if (!captureId) continue
    const rows = captureGroups.get(captureId) || []
    rows.push(card)
    captureGroups.set(captureId, rows)
  }
  for (const [captureId, rows] of captureGroups) {
    changed += mergeRows(data, rows, now, captureId)
  }

  const urlGroups = new Map<string, ResourceCard[]>()
  for (const card of data.resources || []) {
    if (!isActivePoolResource(card)) continue
    const key = canonicalUrlOf(card)
    if (!key) continue
    const rows = urlGroups.get(key) || []
    rows.push(card)
    urlGroups.set(key, rows)
  }
  for (const rows of urlGroups.values()) changed += mergeRows(data, rows, now)

  const active = (data.resources || []).filter(isActivePoolResource)
  const urlCardsByTitle = new Map<string, ResourceCard[]>()
  const noUrlCards: ResourceCard[] = []
  for (const card of active) {
    const title = String(card.title || '').trim()
    if (!title) continue
    if (canonicalUrlOf(card)) {
      const rows = urlCardsByTitle.get(title) || []
      rows.push(card)
      urlCardsByTitle.set(title, rows)
    } else if (!hasText(card.link)) {
      noUrlCards.push(card)
    }
  }
  for (const orphan of noUrlCards) {
    if (orphan.deletedAt || !orphan.createdAt) continue
    const candidates = (urlCardsByTitle.get(String(orphan.title || '').trim()) || [])
      .filter(card => card.id !== orphan.id
        && !!card.createdAt
        && Math.abs(card.createdAt - orphan.createdAt) <= LEGACY_DUPLICATE_WINDOW_MS)
    if (candidates.length !== 1) continue
    changed += mergeRows(data, [candidates[0], orphan], now)
  }

  return changed
}
