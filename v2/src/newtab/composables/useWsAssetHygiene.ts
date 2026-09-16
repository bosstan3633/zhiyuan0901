/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 附件卫生域 composable——R110-BUG2 附件明细宿主接线（跨台存在性判定 / 定位 / 单条与批量清理）。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 */
import { computed, nextTick, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { showToast } from '@/shared/components/toast'
import { deleteAsset, cleanupOrphanAssets } from '@/shared/storage/assets'
import { locateTargetOf } from '@/shared/utils/locate'
import type { AppData, AssetMeta } from '@/shared/models'

export interface WsAssetHygieneCtx {
  store: { persist(): void }
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  router: Router
  drillOpen: Ref<boolean>
  activeCategory: Ref<string>
  viewMode: Ref<'card'|'list'|'kanban'|'pyramid'>
  highlightId: Ref<string | null>
  /** R117（04-61 B）：增量渲染前置——把目标卡纳入渲染集（否则 scrollIntoView 静默失败） */
  ensureCardRendered: (id: string) => boolean
}

export function useWsAssetHygiene(ctx: WsAssetHygieneCtx) {
  const { store, d, workspaceId, router, drillOpen, activeCategory, viewMode, highlightId, ensureCardRendered } = ctx

  /** 跨台全量判定：附件来源卡是否仍存在（未软删；不限本台） */
  function cardExistsGlobally(id: string): boolean {
    return d.value.resources.some(r => r.id === id && !r.deletedAt)
  }
  /** 全局被引用附件 id 并集（含回收站软删卡的附件——软删可恢复，其附件必须保留） */
  const referencedAssetIds = computed<string[]>(() => {
    const ids = new Set<string>()
    const collect = (cards: { assets?: AssetMeta[] }[] | undefined) =>
      (cards || []).forEach(c => (c.assets || []).forEach(a => ids.add(a.id)))
    collect(d.value.resources)
    collect(d.value.tasks)
    collect(d.value.curiosities)
    return [...ids]
  })
  /** 附件行点击 → 定位来源卡：本台就地定位（含增量渲染前置 + 所在分类），跨台走统一 locateTargetOf */
  function onDrillLocateAsset(cardId: string) {
    drillOpen.value = false
    const r = d.value.resources.find(x => x.id === cardId)
    if (!r) { showToast('ℹ 来源卡已不存在——可点行尾 🗑 清理残留'); return }
    if (r.workspaceId === workspaceId.value) {
      // R117（04-61 B）：与 ?hl= 同口径——切到所在分类（不再一律回 'all'），并先确保目标卡在渲染集里
      activeCategory.value = r.categoryId || 'all'
      if (viewMode.value === 'pyramid') viewMode.value = 'card'
      highlightId.value = cardId
      nextTick(() => {
        setTimeout(() => {
          ensureCardRendered(cardId)
          nextTick(() => {
            document.querySelector(`[data-rid="${cardId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => { highlightId.value = null }, 2000)
          })
        }, 120)
      })
    } else {
      const t = locateTargetOf(d.value, 'resource', cardId)
      router.push(t || { path: `/workspace/${r.workspaceId}`, query: { hl: cardId } })
    }
    showToast(`↗ 已定位到「${(r.title || '').slice(0, 20)}」`)
  }
  /** 单条清理：摘除卡片上的失效引用（若有）+ 删除 IndexedDB 本体 */
  async function onDrillCleanupAsset(row: { cardId: string; assetId: string }) {
    let detached = false
    for (const card of d.value.resources) {
      const list = card.assets
      if (!list || !list.some(a => a.id === row.assetId)) continue
      card.assets = list.filter(a => a.id !== row.assetId)
      card.updatedAt = Date.now()
      detached = true
    }
    try { await deleteAsset(row.assetId) } catch { /* IndexedDB 不可用：引用已摘除，本体留待全局清理 */ }
    store.persist()
    showToast(detached ? '🧹 已清理失效附件引用' : '🧹 已删除残留附件本体')
  }
  /** 批量清理：复用 REQ-048 语义——保留全部卡片（含回收站）引用的附件，删除其余 */
  async function onDrillCleanupOrphans() {
    try {
      const n = await cleanupOrphanAssets(new Set(referencedAssetIds.value))
      store.persist()
      showToast(n > 0 ? `🧹 已清理 ${n} 个孤儿附件` : '✓ 无孤儿附件，一切干净')
    } catch {
      showToast('⚠ 清理失败，请重试')
    }
  }

  return { cardExistsGlobally, referencedAssetIds, onDrillLocateAsset, onDrillCleanupAsset, onDrillCleanupOrphans }
}
