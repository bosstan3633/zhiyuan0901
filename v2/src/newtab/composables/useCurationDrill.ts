/**
 * R101（纯拆分第二批）：策展台下钻抽屉的状态与数据 —— 自 Workspace.vue 原位迁出（零行为变更）。
 *
 * 边界约定（04-50 任务书）：**状态与数据下沉，落点导航留视图**——
 * - 本 composable 持有：drillOpen / drillMode / openDrill + 四份下钻数据（drillCatRows /
 *   drillNative / drillMirror / drillRecent，全部惰性求值，R71-13）；
 * - 宿主保留：onDrillJumpCat / onDrillOpenCard / onDrillLocate 三个落点导航回调
 *   （它们写 activeCategory / viewMode / catFlashId 并调用 openResource / locateMirrorSource，
 *   是视图状态的接线，不是本域的实现）；
 * - 依赖以 ctx 注入（allResources / resBucket / catIdx / isUncat），isMirrorView 直接 import 共享实现。
 */
import { ref, computed, type ComputedRef } from 'vue'
import type { Category, ResourceCard } from '@/shared/models'
import type { CatIndex } from '@/shared/utils/catIndex'
import { isMirrorView } from '@/shared/storage/hub'
import type { DrillCatRow, DrillCardRow } from '@/newtab/components/CurationDrillDrawer.vue'

export interface CurationDrillCtx {
  allResources: ComputedRef<ResourceCard[]>
  /** 卡片按分类分桶（O(1) 取「某分类的卡」），宿主共享索引 */
  resBucket: ComputedRef<Map<string, ResourceCard[]>>
  catIdx: ComputedRef<CatIndex<Category>>
  /** 直属/待分类判据（宿主唯一实现，此处复用） */
  isUncat: (r: ResourceCard, validIds: { has(id: string): boolean }) => boolean
}

export function useCurationDrill(ctx: CurationDrillCtx) {
  const { allResources, resBucket, catIdx, isUncat } = ctx

  const drillOpen = ref(false)
  const drillMode = ref<'total' | 'source' | 'assets' | 'recent'>('total')
  function openDrill(mode: 'total' | 'source' | 'assets' | 'recent') { drillMode.value = mode; drillOpen.value = true }
  /** 总数下钻：按分类（深度缩进 + 直属卡数），含待分类行
   *  R71：抽屉关闭时直接返回空——本 computed 是抽屉组件的 prop，**每次宿主重渲染都会被求值**，
   *  原实现无条件跑一遍整树遍历 + 全量卡分桶，纯属为看不见的 UI 付费。 */
  const drillCatRows = computed<DrillCatRow[]>(() => {
    if (!drillOpen.value) return []
    const rows: DrillCatRow[] = []
    const seen = new Set<string>()  // R70：防环
    const bucket = resBucket.value
    const walk = (parentId: string | undefined, depth: number) => {
      for (const c of (parentId ? (catIdx.value.childrenOf.get(parentId) || []) : catIdx.value.roots)) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        rows.push({ id: c.id, name: c.name, count: (bucket.get(c.id) || []).length, depth })
        walk(c.id, depth + 1)
      }
    }
    walk(undefined, 0)
    const uncat = allResources.value.filter(r => isUncat(r, catIdx.value.byId)).length
    if (uncat) rows.push({ id: 'uncat', name: '待分类', count: uncat, depth: 0 })
    return rows
  })
  // R71：同样惰性化——三张清单各扫全量卡一遍，抽屉没开时没有任何理由付这个代价
  const toDrillRow = (r: ResourceCard): DrillCardRow => ({ id: r.id, title: r.title, updatedAt: r.updatedAt || r.createdAt })
  const drillNative = computed<DrillCardRow[]>(() => drillOpen.value ? allResources.value.filter(r => !isMirrorView(r)).map(toDrillRow) : [])
  const drillMirror = computed<DrillCardRow[]>(() => drillOpen.value ? allResources.value.filter(isMirrorView).map(toDrillRow) : [])
  const drillRecent = computed<DrillCardRow[]>(() => drillOpen.value ? allResources.value.map(toDrillRow) : [])

  return { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillRecent }
}
