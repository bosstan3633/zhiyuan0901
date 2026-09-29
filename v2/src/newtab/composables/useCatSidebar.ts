/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 分类侧栏 UI 域 composable——树折叠/展开、侧栏扁平序列、树宽拖拽（持久化 UIPrefs.wsSideW）。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 * 树工具（rootCats/childCatsOf/familyIds/catAggCount/pyDepthOf…）留在宿主——视图/拖拽/金字塔域共用。
 */
import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import type { CatIndex } from '@/shared/utils/catIndex'
import { buildCatOptions } from '@/shared/utils/catTree'
import type { ResourceCard, Category, UIPrefs } from '@/shared/models'
import type { WsStore } from './useResourceView'

/** 左栏渲染的扁平序列（分区标签 + 缩进标记）——R61-4：递归支持 4 级 */
// R76（R3）：count 一律取 directCount（与看板列、卡片/列表分组同口径）；
// childCount + aggCount 只用于 title 补充说明，不再作为显示值，避免同屏出现两个数
export interface SidebarCat { cat: Category; depth: number; sectionLabel: string; hasChildren: boolean; childCount: number; aggCount: number; directCount: number }

export interface CatSidebarCtx {
  store: WsStore
  wsCats: ComputedRef<Category[]>
  catIdx: ComputedRef<CatIndex<Category>>
  resBucket: ComputedRef<Map<string, ResourceCard[]>>
  rootCats: ComputedRef<Category[]>
  activeCategory: Ref<string>
  childCatsOf: (pid: string) => Category[]
  catAggCount: (catId: string) => number
}

export function useCatSidebar(ctx: CatSidebarCtx) {
  const { store, wsCats, catIdx, resBucket, rootCats, activeCategory, childCatsOf, catAggCount } = ctx

  const pinnedRootCats = computed(() => rootCats.value.filter(c => c.pinned))
  const unpinnedRootCats = computed(() => rootCats.value.filter(c => !c.pinned))

  /** 分类选择器的层级化选项（下拉/弹窗共用）——R61-4：递归支持 4 级 */
  // R117（04-61 A）：实现委托 shared/utils/catTree.buildCatOptions —— 统一口径（过滤软删 deletedAt
  //  + 防环 + order 稳定排序）。原实现在此自建索引却**漏了 deletedAt**，与采集浮层/全局采集三处不一。
  function treeCatOptions(cats: Category[]): { id: string; label: string }[] {
    return buildCatOptions(cats)
  }

  // R48-V2：树状目录展开/折叠（默认全局展开；折叠状态仅会话内记忆）
  const collapsedCats = ref<Set<string>>(new Set())
  function toggleCatCollapse(id: string) {
    const s = new Set(collapsedCats.value)
    if (s.has(id)) s.delete(id); else s.add(id)
    collapsedCats.value = s
  }
  /** 一键收纳为策展台根部：所有含子分类的父级全部折叠 */
  function collapseAllCats() {
    collapsedCats.value = new Set(wsCats.value.filter(c => catIdx.value.hasChildren(c.id)).map(c => c.id))
  }
  function expandAllCats() { collapsedCats.value = new Set() }
  function selectSidebarCat(sc: SidebarCat) {
    activeCategory.value = sc.cat.id
    // 选中深层分类时自动展开其全部祖先，避免「选中被藏住」
    let pid = sc.cat.parentId
    const guard = new Set<string>([sc.cat.id])  // R70：防环
    while (pid && !guard.has(pid) && collapsedCats.value.has(pid)) {
      guard.add(pid)
      const s = new Set(collapsedCats.value); s.delete(pid); collapsedCats.value = s
      pid = wsCats.value.find(c => c.id === pid)?.parentId
    }
  }
  const sidebarCats = computed<SidebarCat[]>(() => {
    const out: SidebarCat[] = []
    const seenSide = new Set<string>()  // R70：防环
    const pushTree = (c: Category, depth: number, sectionLabel: string) => {
      if (seenSide.has(c.id)) return
      seenSide.add(c.id)
      out.push({
        cat: c, depth, sectionLabel,
        hasChildren: catIdx.value.hasChildren(c.id),
        childCount: childCatsOf(c.id).length,
        aggCount: catAggCount(c.id),
        directCount: (resBucket.value.get(c.id) || []).length
      })
      if (depth > 0 && collapsedCats.value.has(c.id)) return
      if (!collapsedCats.value.has(c.id)) for (const k of childCatsOf(c.id)) pushTree(k, depth + 1, '')
    }
    pinnedRootCats.value.forEach((c, i) => {
      pushTree(c, 0, i === 0 ? '📌 置顶' : '')
    })
    unpinnedRootCats.value.forEach((c, i) => {
      pushTree(c, 0, (i === 0 && pinnedRootCats.value.length) ? '📁 分类' : '')
    })
    return out
  })

  // ---- R113-N1：左侧分类树宽度拖拽（持久化 UIPrefs.wsSideW）----
  // 原实现宽度写死 200px（.ws-sidebar），深层级长分类名必被截断，且项目内其他三处侧栏
  // （TaskDetailDrawer 的 drawerWs / ProjectCuration 的 projRailW；当年还有 CompassHome 的 curSplit，随 R2-② 调度卡退役）
  // 都支持拖拽，资源台是唯一例外。此处沿用 px 范式（同 TaskDetailDrawer）。
  const SIDE_W_MIN = 160
  const SIDE_W_MAX = 420
  const SIDE_W_DEF = 210
  const wsSideW = ref<number>(store.ui?.wsSideW || SIDE_W_DEF)
  /** R125：左栏 36px 图标轨（记忆偏好 UIPrefs.wsSideRail） */
  const sideRail = ref<boolean>(!!store.ui?.wsSideRail)
  function toggleSideRail() { sideRail.value = !sideRail.value; saveUIPrefs({ wsSideRail: sideRail.value }) }
  function selectRailCat(id: string) { activeCategory.value = id }
  let sideDrag: { startX: number; startW: number } | null = null
  function onSideResizeMove(e: MouseEvent) {
    if (!sideDrag) return
    wsSideW.value = Math.min(SIDE_W_MAX, Math.max(SIDE_W_MIN, sideDrag.startW + (e.clientX - sideDrag.startX)))
  }
  function onSideResizeUp() {
    document.removeEventListener('mousemove', onSideResizeMove)
    document.removeEventListener('mouseup', onSideResizeUp)
    if (sideDrag) { saveUIPrefs({ wsSideW: wsSideW.value }); sideDrag = null }
  }
  function startSideResize(e: MouseEvent) {
    sideDrag = { startX: e.clientX, startW: wsSideW.value }
    document.addEventListener('mousemove', onSideResizeMove)
    document.addEventListener('mouseup', onSideResizeUp)
  }
  function resetSideWidth() {
    wsSideW.value = SIDE_W_DEF
    saveUIPrefs({ wsSideW: SIDE_W_DEF })
  }
  // R129-B6：拖拽中途若组件被卸载（切换工作台/离开资源台），mouseup 永远不会触发，
  // document 上的 mousemove/mouseup 会残留并持有本作用域 → 卸载兜底移除
  onUnmounted(() => {
    document.removeEventListener('mousemove', onSideResizeMove)
    document.removeEventListener('mouseup', onSideResizeUp)
    sideDrag = null
  })

  return {
    pinnedRootCats, unpinnedRootCats, treeCatOptions,
    collapsedCats, toggleCatCollapse, collapseAllCats, expandAllCats, selectSidebarCat, sidebarCats,
    SIDE_W_DEF, wsSideW, startSideResize, resetSideWidth,
    sideRail, toggleSideRail, selectRailCat,
  }
}
