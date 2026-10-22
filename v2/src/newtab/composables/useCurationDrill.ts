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
import { ref, computed, watch, type ComputedRef } from 'vue'
import type { Category, ResourceCard } from '@/shared/models'
import type { CatIndex } from '@/shared/utils/catIndex'
import { isMirrorView } from '@/shared/storage/hub'
import { readEventLog, EVENT_ACT_LABEL, type CardEvent } from '@/shared/utils/eventLog'
import type { DrillCatRow, DrillCardRow, DrillDetailRow } from '@/newtab/components/CurationDrillDrawer.vue'

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
  /** 卡片总数抽屉：明细与分类汇总同源同开——每张卡直接带所属节点，不再要求用户点分类才看到卡。 */
  const drillCardRows = computed<DrillDetailRow[]>(() => {
    if (!drillOpen.value || drillMode.value !== 'total') return []
    return allResources.value.map(r => ({
      id: r.id,
      title: r.title,
      nodeName: catIdx.value.byId.get(r.categoryId || '')?.name || '待分类',
      sourceType: r.sourceType,
      mirrored: isMirrorView(r),
      updatedAt: r.updatedAt || r.createdAt,
    })).sort((a, b) => b.updatedAt - a.updatedAt)
  })

  /**
   * R169-T1：「最近更新流水」改**事件流 + 卡时间归并**（原先只读卡 `updatedAt` 的 Top 30，
   * 名与实不符：新建/删除/恢复这类动作在流水里说不清是谁干的，批量导入又把整屏盖成同一分钟）。
   * 口径：一卡一行，取「卡最后被改的时刻」与「该卡最后一个事件」中较晚的那个，动词跟着胜出的那侧走。
   * 范围只到**本台可见卡**——事件日志不记工作台，硬扩出去会把别台的删除算到本台头上；
   * 已删除/回收站的动作另有调度台「写入记录」与回收站两处真源，这里在抽屉页脚明说去哪看。
   */
  const recentEvents = ref<CardEvent[]>([])
  watch(drillOpen, (v) => { if (v) void readEventLog().then(e => { recentEvents.value = e }).catch(() => { /* 日志读失败：退化为纯卡时间，不阻塞抽屉 */ }) })
  const drillRecent = computed<DrillCardRow[]>(() => {
    if (!drillOpen.value) return []
    const last = new Map<string, CardEvent>()
    for (const e of recentEvents.value) {
      if (!e.cardId || e.kind !== 'resource') continue
      const prev = last.get(e.cardId)
      if (!prev || e.ts > prev.ts) last.set(e.cardId, e)
    }
    return allResources.value.map(r => {
      const upd = r.updatedAt || r.createdAt
      const e = last.get(r.id)
      return e && e.ts >= upd
        ? { id: r.id, title: r.title, updatedAt: e.ts, verb: EVENT_ACT_LABEL[e.action] || '更新' }
        : { id: r.id, title: r.title, updatedAt: upd, verb: '更新' }
    })
  })

  return { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillCardRows, drillRecent }
}
