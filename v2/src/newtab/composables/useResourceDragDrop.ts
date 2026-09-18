/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 资源拖拽域 composable——卡片/看板/分类/区域拖拽全量 + 混排重编号。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 * 唯一机械适配：原 `let draggedItem / dragCatId` 升为共享状态对象 dragState（.card / .cat）——
 * 金字塔域（usePyramid）的节点拖拽落点也消费同一份状态，跨 composable 的裸 let 无法共享。
 * 仅改写引用方式，赋值/清空时机与判据逐字不变。
 */
import { ref, type ComputedRef, type Ref } from 'vue'
import { showToast } from '@/shared/components/toast'
import { isMirrorView, type MirrorView } from '@/shared/storage/hub'
import { MAX_CAT_LEVEL } from '@/shared/utils/catTree'
import type { AppData, ResourceCard, Category } from '@/shared/models'
import type { WsStore } from './useResourceView'

/** 共享拖拽状态层：卡片拖拽与分类拖拽各自占一槽，金字塔/侧栏/网格落点共用（原宿主 let 变量） */
export interface DragState { card: ResourceCard | null; cat: string | null }

export interface ResourceDragDropCtx {
  store: WsStore
  d: ComputedRef<AppData>
  wsCats: ComputedRef<Category[]>
  rootCats: ComputedRef<Category[]>
  categories: ComputedRef<Category[]>
  sortBy: Ref<string>
  isUncat: (r: ResourceCard, validIds: { has(id: string): boolean }) => boolean
  childCatsOf: (pid: string) => Category[]
  childIds: (catId: string) => string[]
  pyDepthOf: (c: Category) => number
  pyHeightOf: (c: Category) => number
  // useWorkspaceMirror
  moveMirrorTo: (m: MirrorView, catId: string) => void
  // useCategoryCrud
  normalizeCatOrders: (rootId: string) => void
}

export function useResourceDragDrop(ctx: ResourceDragDropCtx) {
  const { store, d, wsCats, rootCats, categories, sortBy, isUncat,
    childCatsOf, childIds, pyDepthOf, pyHeightOf, moveMirrorTo, normalizeCatOrders } = ctx

  const dragState: DragState = { card: null, cat: null }

  // B6：拖拽插入线（X 轴卡片 / Y 轴列表）
  const dropMark = ref('')
  function markDrop(e: DragEvent, key: string, axis: 'x' | 'y') {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const after = axis === 'x'
      ? (e.clientX - rect.left) / rect.width > 0.5
      : (e.clientY - rect.top) / rect.height > 0.5
    dropMark.value = key + (after ? '-b' : '-t')
  }
  function clearDropMark() { dropMark.value = '' }
  /** R73-S4b（L5）：接受拖入的统一应答（preventDefault + dropEffect=move，防真实拖拽被判定为不可落） */
  function acceptDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
  /** R73-S4b（L5）：拖拽结束统一复位（drop 后也会触发，防取消拖拽时状态残留） */
  function clearDragState() { dragState.card = null; dragState.cat = null; dropMark.value = '' }
  function onDragStart(e: DragEvent, r: ResourceCard) {
    dragState.card = r
    e.dataTransfer?.setData('text/plain', r.id)
  }
  // REQ-028 F-028-3：卡片所属渲染分区（与 resourceGroups 分区 key 对齐）
  // R129-B2：R64-F9 树状递归分组后 resourceGroups 已按**单分类**分区（组 key = 该分类自身 id，
  // 子分类不再并入父组），而此处仍按 root 家族聚合（'all' 视图返家族根 id、父台直属返 'direct'）——
  // 两套 key 错位使 onDropCard/onAreaDrop 的「落位分区全量重写 curOrder」扫到同家族所有兄弟子分类，
  // 把它们的拖拽序一并打乱。分区归属只取决于卡自己的 categoryId：uncat 或所属分类 id。
  function groupKeyOf(r: ResourceCard): string {
    const validIds = new Set(wsCats.value.map(c => c.id))
    if (isUncat(r, validIds)) return 'uncat'
    return r.categoryId
  }

  function onDropCard(e: DragEvent, target: ResourceCard) {
    if (!dragState.card || dragState.card.id === target.id) { clearDropMark(); return }
    const moved = dragState.card
    // R61：镜像卡拖拽 = 只改投射落点（源卡零影响，不参与物理排序）
    if (isMirrorView(moved)) {
      const mCat = target.categoryId && wsCats.value.some(c => c.id === target.categoryId) ? target.categoryId : ''
      moveMirrorTo(moved, mCat)
      dragState.card = null
      clearDropMark()
      return
    }
    const after = dropMark.value.endsWith('-b')
    // REQ-028 F-028-3：跨分区拖拽 = 修改分类归属（轻提示）；同分区 = 局部排序
    const crossGroup = groupKeyOf(moved) !== groupKeyOf(target)
    const newCat = target.categoryId && wsCats.value.some(c => c.id === target.categoryId) ? target.categoryId : ''
    const catChanged = (moved.categoryId || '') !== (newCat || '')
    if (catChanged) {
      moved.categoryId = newCat
      moved.updatedAt = Date.now()
      if (crossGroup) showToast(`✓ 已移动至「${newCat ? categories.value.find(c => c.id === newCat)?.name : '待分类'}」`)
    }
    sortBy.value = 'manual'
    const fromIdx = d.value.resources.findIndex(r => r.id === moved.id)
    const toIdx = d.value.resources.findIndex(r => r.id === target.id)
    if (fromIdx < 0 || toIdx < 0) { clearDropMark(); return }
    const [item] = d.value.resources.splice(fromIdx, 1)
    const newIdx = d.value.resources.findIndex(r => r.id === target.id)
    d.value.resources.splice(after ? newIdx + 1 : newIdx, 0, item)
    // R56-V1：拖拽序物化——落位分区按物理序全量重写 curOrder（否则「无拖拽序=最新在前」会吞掉拖拽结果）
    const landedKey = groupKeyOf(moved)
    d.value.resources.filter(r => !r.deletedAt && groupKeyOf(r) === landedKey).forEach((r, i) => { r.curOrder = i })
    store.persist()
    dragState.card = null
    clearDropMark()
  }
  // O8：看板列内卡片拖拽排序；第廿八轮：跨分类列落卡 = 改分类归属（插入位置不变）
  function onKanbanCardDrop(e: DragEvent, target: ResourceCard) {
    e.preventDefault(); e.stopPropagation()
    const after = dropMark.value.endsWith('-b')
    clearDropMark()
    if (!dragState.card || dragState.card.id === target.id) return
    sortBy.value = 'manual'
    const moved = dragState.card
    // R61：镜像卡拖拽 = 只改投射落点
    if (isMirrorView(moved)) {
      moveMirrorTo(moved, target.categoryId || '')
      dragState.card = null
      return
    }
    const fromIdx = d.value.resources.findIndex(x => x.id === moved.id)
    const toIdx = d.value.resources.findIndex(x => x.id === target.id)
    if (fromIdx < 0 || toIdx < 0) return
    if ((moved.categoryId || '') !== (target.categoryId || '')) {
      moved.categoryId = target.categoryId || ''
      moved.updatedAt = Date.now()
      showToast(`✓ 已移动到「${target.categoryId ? categories.value.find(c => c.id === target.categoryId)?.name : '待分类'}」`)
    }
    const [item] = d.value.resources.splice(fromIdx, 1)
    const newToIdx = d.value.resources.findIndex(x => x.id === target.id)
    d.value.resources.splice(after ? newToIdx + 1 : newToIdx, 0, item)
    // R56-V1：看板拖拽同样物化拖拽序——落位列全量重写 curOrder，列内 applySort 稳定消费
    const colKey = target.categoryId || ''
    d.value.resources.filter(r => !r.deletedAt && (r.categoryId || '') === colKey).forEach((r, i) => { r.curOrder = i })
    store.persist()
    dragState.card = null
    showToast('✓ 已调整排序')
  }
  function onDropToCategory(e: DragEvent, catId: string) {
    if (!dragState.card) return
    // R61：镜像卡落树节点 = 只改投射落点
    if (isMirrorView(dragState.card)) { moveMirrorTo(dragState.card, catId); dragState.card = null; clearCardDropTarget(); return }
    dragState.card.categoryId = catId
    dragState.card.updatedAt = Date.now()
    store.persist()
    showToast(`✓ 已移入「${catId ? categories.value.find(c=>c.id===catId)?.name : '待分类'}」`)
    dragState.card = null
    clearCardDropTarget()
  }

  // ===== R73-S4b（L5）：区域级落卡 + 混排重编号（自 CurationCenter 迁入，补齐 hub 缺口） =====
  /** 分区 key → 真实分类 id（聚合哨兵 'all' / 'uncat' 一律回落「未分类」''） */
  function catKeyToCatId(key?: string): string {
    const k = key ?? ''
    return (k === 'all' || k === 'uncat') ? '' : k
  }
  /** 区域级 dragover —— 卡片拖拽悬停于分区网格任意处（含空白）均可落 */
  function onAreaDragOver(e: DragEvent, groupKey?: string) {
    if (dragState.card) acceptDragOver(e)
    void groupKey
  }
  /** 区域级 drop —— 拖到分区网格空白处 = 移入该分区（聚合视图回落未分类；镜像卡只改投射落点） */
  function onAreaDrop(e: DragEvent, groupKey?: string) {
    clearDropMark()
    const moved = dragState.card
    dragState.card = null
    if (!moved) return
    const targetKey = catKeyToCatId(groupKey)
    // R61：镜像卡为引用 —— 拖拽只改投射落点，源卡零影响
    if (isMirrorView(moved)) { moveMirrorTo(moved, targetKey); return }
    const changed = (moved.categoryId || '') !== targetKey
    if (changed) {
      moved.categoryId = targetKey
      moved.updatedAt = Date.now()
      sortBy.value = 'manual'
    }
    // 落位分区按物理序全量重写 curOrder（与 onDropCard 同口径）
    const landedKey = groupKeyOf(moved)
    d.value.resources.filter(r => !r.deletedAt && groupKeyOf(r) === landedKey).forEach((r, i) => { r.curOrder = i })
    store.persist()
    showToast(changed ? `✓ 已移动至「${targetKey ? categories.value.find(c => c.id === targetKey)?.name : '待分类'}」` : '✓ 已更新')
  }
  /** 混排重编号 —— 把 id 插到 targetId 之前，并把落位分区内的 curOrder 统一重写 */
  function reorderMixed(groupKey: string, id: string, targetId: string): boolean {
    const key = catKeyToCatId(groupKey)
    const list = d.value.resources.filter(r => !r.deletedAt && (r.categoryId || '') === key)
    const fi = list.findIndex(r => r.id === id)
    const ti = list.findIndex(r => r.id === targetId)
    if (fi < 0 || ti < 0) return false
    const [moved] = list.splice(fi, 1)
    const tj = list.findIndex(r => r.id === targetId)
    list.splice(tj, 0, moved)
    list.forEach((r, i) => { r.curOrder = i })
    return true
  }

  // ===== 分类拖拽（第八轮）：同级排序 / 挂子级 / 升一级，防循环，2 级上限 =====
  // 第廿九轮：侧栏分类行同时是资源卡归属落点——按拖起对象分流（卡片→改归属；分类→排序/挂子级）
  const catDropTarget = ref('')
  const catDropMode = ref<'' | 'child' | 'before' | 'after'>('')
  /** 卡片拖拽时的目标分类高亮（'分类id' 或 'uncat'） */
  const cardDropTarget = ref('')
  function onUncatDragOver(e: DragEvent) {
    if (!dragState.card) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    cardDropTarget.value = 'uncat'
  }
  function onUncatDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation()
    cardDropTarget.value = ''
    if (!dragState.card) return
    onDropToCategory(e, '')
  }
  function clearCardDropTarget() { cardDropTarget.value = '' }
  function onCatDragStart(e: DragEvent, cat: Category) {
    dragState.cat = cat.id
    e.dataTransfer!.effectAllowed = 'move'
  }
  function onCatDragEnd() {
    dragState.cat = null; catDropTarget.value = ''; catDropMode.value = ''
  }
  function onCatDragOver(e: DragEvent, cat: Category) {
    // 卡片拖入：整行高亮为归属落点（与分类拖拽的 before/after/child 指示区分）
    if (dragState.card && !dragState.cat) {
      cardDropTarget.value = cat.id
      return
    }
    if (!dragState.cat || dragState.cat === cat.id) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height
    const dragged = wsCats.value.find(c => c.id === dragState.cat)
    // 中带 + 目标是根分类 + 拖动的也是根分类 → 成为子分类；否则上下沿 = 同级排序
    if (y > h * 0.3 && y < h * 0.7 && dragged && !dragged.parentId && !cat.parentId) {
      catDropMode.value = 'child'
    } else {
      catDropMode.value = y < h / 2 ? 'before' : 'after'
    }
    catDropTarget.value = cat.id
  }
  function onCatDrop(e: DragEvent, cat: Category) {
    e.preventDefault(); e.stopPropagation()
    // 卡片落分类 = 改归属（落父分类=归入本级；落子分类=归入该子分类；置顶保留）
    if (dragState.card && !dragState.cat) {
      cardDropTarget.value = ''
      onDropToCategory(e, cat.id)
      return
    }
    const mode = catDropMode.value
    const targetId = catDropTarget.value
    const draggedId = dragState.cat
    onCatDragEnd()
    if (!draggedId || draggedId === targetId) return
    const dragged = wsCats.value.find(c => c.id === draggedId)
    const target = wsCats.value.find(c => c.id === targetId)
    if (!dragged || !target) return
    if (childIds(dragged.id).includes(target.id)) { showToast('不能移动到自己的子分类'); return }
    // R61-4：层级工具（4 级上限）
    // R70：层级/高度一律走带 visited 的实现（pyDepthOf 防环上行、pyHeightOf 防环下降）
    const levelOf = (c: Category): number => pyDepthOf(c) + 1
    const heightOf = (c: Category): number => pyHeightOf(c)
    if (mode === 'child') {
      if (levelOf(target) + heightOf(dragged) > MAX_CAT_LEVEL) { showToast(`ℹ 最多 ${MAX_CAT_LEVEL} 级——「${dragged.name}」（含 ${heightOf(dragged) - 1} 层子级）放入后将超出层级上限`); return }
      dragged.parentId = target.id
      dragged.pinned = undefined
      dragged.order = childCatsOf(target.id).length
      normalizeCatOrders('')
      showToast(`✓ 「${dragged.name}」已归入「${target.name}」`)
    } else {
      const pid = target.parentId || ''
      if (dragged.parentId !== (pid || undefined)) dragged.parentId = pid || undefined
      if (pid) dragged.pinned = undefined
      const sibs = wsCats.value
        .filter(c => (c.parentId || '') === pid && c.id !== draggedId)
        .sort((a, b) => a.order - b.order)
      const ti = sibs.findIndex(c => c.id === targetId)
      sibs.splice(mode === 'before' ? ti : ti + 1, 0, dragged)
      sibs.forEach((c, i) => { c.order = i })
    }
    store.persist()
  }
  /** 拖到「升为一级」投放区 = 取消子分类归属（先取引用再清理状态） */
  function onCatRootDrop(e: DragEvent) {
    e.preventDefault()
    const draggedId = dragState.cat
    onCatDragEnd()
    cardDropTarget.value = ''
    if (!draggedId) return
    const dragged = wsCats.value.find(c => c.id === draggedId)
    if (!dragged || !dragged.parentId) return
    dragged.parentId = undefined
    dragged.order = rootCats.value.length
    normalizeCatOrders('')
    store.persist()
    showToast(`✓ 「${dragged.name}」已升为一级分类`)
  }

  return {
    dragState, dropMark, markDrop, clearDropMark, acceptDragOver, clearDragState, onDragStart,
    groupKeyOf, onDropCard, onKanbanCardDrop, onDropToCategory,
    catKeyToCatId, onAreaDragOver, onAreaDrop, reorderMixed,
    catDropTarget, catDropMode, cardDropTarget,
    onUncatDragOver, onUncatDrop, clearCardDropTarget,
    onCatDragStart, onCatDragEnd, onCatDragOver, onCatDrop, onCatRootDrop,
  }
}
