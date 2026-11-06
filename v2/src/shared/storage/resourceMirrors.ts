import type { AppData, CurationProjection, ResourceCard, SupportLink } from '@/shared/models'

/** 复制一份与真身脱钩、可独立存活的只读资源快照。 */
export function cloneResourceMirrorSnapshot(resource: ResourceCard): ResourceCard {
  const snapshot = JSON.parse(JSON.stringify(resource)) as ResourceCard
  delete snapshot.deletedAt
  delete snapshot.lifecycleArchived
  delete snapshot.snoozedUntil
  return snapshot
}

/**
 * V4.2.0 幂等补水：
 * - 新挂载写入独立快照；
 * - 旧 SupportLink / CurationProjection 若真身仍在本机，补一份快照；
 * - 真身已被硬删且旧记录没有快照时无法凭空恢复，保持原样并交由现有悬空清理处理。
 */
export function hydrateResourceMirrorSnapshots(d: AppData): number {
  const byId = new Map((d.resources || []).map(resource => [resource.id, resource]))
  let changed = 0
  for (const link of d.supportLinks || []) {
    if (link.snapshot) continue
    const source = byId.get(link.resourceId)
    if (!source) continue
    link.snapshot = cloneResourceMirrorSnapshot(source)
    changed++
  }
  for (const projection of d.curationProjections || []) {
    if (projection.kind !== 'card' || projection.snapshot || !projection.cardId) continue
    const source = byId.get(projection.cardId)
    if (!source) continue
    projection.snapshot = cloneResourceMirrorSnapshot(source)
    changed++
  }
  return changed
}

/** 任务关联展示优先使用挂载时快照；旧记录才回退到真身。 */
export function resourceOfSupportLink(d: AppData, link: SupportLink): ResourceCard | null {
  if (link.snapshot) return link.snapshot
  return d.resources.find(resource => resource.id === link.resourceId && !resource.deletedAt) || null
}

/** 策展投射展示优先使用挂载时快照；旧记录才回退到真身。 */
export function resourceOfCurationProjection(
  d: AppData,
  projection: CurationProjection,
): ResourceCard | null {
  if (projection.snapshot) return projection.snapshot
  const id = projection.cardId || ''
  if (!id) return null
  return d.resources.find(resource => resource.id === id && !resource.deletedAt) || null
}
