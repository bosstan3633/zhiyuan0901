import type { AppData, AssetMeta } from '@/shared/models'

export interface ReconciledCloudState {
  nextData: AppData
  staleCurationAssets: Map<string, AssetMeta>
}

/**
 * 云快照只携带附件元数据。落回本机时：
 * - 普通卡附件以本机 IndexedDB 为准；
 * - 论点卡与策展节点以云端成员表为准，本机只补同 ID 的本地状态；
 * - 失去所有者的策展附件进入待清理表。
 */
export function reconcileCloudStateAssets(localData: AppData, incomingData: AppData): ReconciledCloudState {
  const nextData = JSON.parse(JSON.stringify(incomingData)) as AppData
  const localAssets = new Map<string, AssetMeta[]>()
  const localCategoryAssets = new Map<string, AssetMeta[]>()
  const localCurationAssetsByOwner = new Map<string, AssetMeta[]>()
  for (const cards of [
    localData.resources,
    localData.tasks,
    localData.curiosities,
    ...(localData.argCards ? [localData.argCards] : []),
  ]) {
    for (const card of cards || []) {
      if (card.assets?.length) localAssets.set(card.id, card.assets)
      if ('isThesis' in card && card.isThesis && card.assets?.length) {
        localCurationAssetsByOwner.set(card.id, card.assets)
      }
    }
  }
  for (const category of localData.categories || []) {
    if (!category.assets?.length) continue
    localCategoryAssets.set(category.id, category.assets)
    localCurationAssetsByOwner.set(category.id, category.assets)
  }

  const authoritativeCurationAssets = (remote: AssetMeta[] | undefined, local: AssetMeta[] | undefined): AssetMeta[] => {
    const localById = new Map((local || []).map(asset => [asset.id, asset]))
    return (remote || []).map(asset => ({ ...(localById.get(asset.id) || {}), ...asset }))
  }
  const staleCurationAssets = new Map<string, AssetMeta>()
  for (const cards of [
    nextData.resources,
    nextData.tasks,
    nextData.curiosities,
    ...(nextData.argCards ? [nextData.argCards] : []),
  ]) {
    for (const card of cards || []) {
      const assets = localAssets.get(card.id)
      if (!assets) continue
      if ('isThesis' in card && card.isThesis) {
        const nextIds = new Set((card.assets || []).map(asset => asset.id))
        for (const asset of assets) if (!nextIds.has(asset.id)) staleCurationAssets.set(asset.id, asset)
        card.assets = authoritativeCurationAssets(card.assets, assets)
      } else {
        card.assets = assets
      }
    }
  }
  for (const category of nextData.categories || []) {
    const local = localCategoryAssets.get(category.id)
    if (!local?.length) continue
    const nextIds = new Set((category.assets || []).map(asset => asset.id))
    for (const asset of local) if (!nextIds.has(asset.id)) staleCurationAssets.set(asset.id, asset)
    category.assets = authoritativeCurationAssets(category.assets, local)
  }
  const remoteOwnerIds = new Set([
    ...(nextData.resources || []).map(card => card.id),
    ...(nextData.categories || []).map(category => category.id),
  ])
  for (const [ownerId, assets] of localCurationAssetsByOwner) {
    if (remoteOwnerIds.has(ownerId)) continue
    for (const asset of assets) staleCurationAssets.set(asset.id, asset)
  }
  return { nextData, staleCurationAssets }
}
