/**
 * R104（纯拆分第五批 · 收缩版）：分类 CRUD —— 新建/重命名（同名即时校验 + 4 级上限）、
 * 删除（子分类升级 + 卡片回落待分类 + 镜像记录与镜像分类级联清理）、置顶、存量重复分类合并，
 * 自 Workspace.vue 原位迁出（零行为变更）。
 *
 * 边界约定（04-53 任务书）：**原第五批「分类树与拖拽」收缩为仅拆 CRUD**——
 * 拖拽（onCatDrag*）与侧栏折叠/选择是视图交互接线，且与金字塔深度工具（pyDepthOf/pyHeightOf）、
 * 卡片拖拽状态（draggedItem）双向咬合，硬拆需先立共享拖拽状态层（另立项）；
 * 删除/合并所需的层级与计数工具（pyDepthOf/childCatsOf/catAggCount）由宿主注入——
 * 保持「唯一实现」原则，不在本 composable 内复写。
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { AppData, Category, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { MAX_CAT_LEVEL } from '@/shared/utils/catTree'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'

export interface CategoryCrudCtx {
  d: ComputedRef<AppData>
  persist: () => void
  workspaceId: ComputedRef<string>
  wsCats: ComputedRef<Category[]>
  activeCategory: Ref<string>
  allResources: ComputedRef<ResourceCard[]>
  /** 层级工具（金字塔域持有，4 级上限校验用） */
  pyDepthOf: (c: Category) => number
  childCatsOf: (pid: string) => Category[]
  catAggCount: (catId: string) => number
}

export function useCategoryCrud(ctx: CategoryCrudCtx) {
  const { d, persist, workspaceId, wsCats, activeCategory, allResources, pyDepthOf, childCatsOf, catAggCount } = ctx

  function normalizeCatOrders(parentId: string) {
    wsCats.value
      .filter(c => (c.parentId || '') === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((c, i) => { c.order = i })
  }

  // ===== 分类新建（第八轮弹窗）· 重命名（R141 反馈 #7：行内就地改名，弹窗只管新建） =====
  const catModal = ref<{ open: boolean; name: string; parentId: string }>({ open: false, name: '', parentId: '' })
  function openCreateCat(parentId = '') {
    catModal.value = { open: true, name: '', parentId }
  }
  /** R141：双击分类名 / 菜单「重命名」→ 该节点进入行内编辑（宿主把 catRenId 传给 CatNodeName） */
  const catRenId = ref('')
  function startCatRename(cat: Category) { catRenId.value = cat.id }
  function commitCatRename(cat: Category, raw: string) {
    catRenId.value = ''
    const name = raw.trim()
    if (!name || name === cat.name) return
    if (wsCats.value.some(c => c.name === name && c.id !== cat.id)) { showToast('已存在同名分类，请更换名称'); return }
    cat.name = name
    persist()
    showToast('✓ 分类已重命名')
  }
  /** 第卅三轮 REQ-021：同名即时校验（作用域=当前策展台全分类树） */
  const catNameDup = computed(() => {
    const name = catModal.value.name.trim()
    if (!name) return false
    return wsCats.value.some(c => c.name === name)
  })
  function confirmCatModal() {
    const m = catModal.value
    const name = m.name.trim()
    if (!name) { showToast('请输入分类名称'); return }
    if (catNameDup.value) { showToast('该策展台已存在同名分类，请更换名称'); return }
    // R61-4：4 级上限校验
    if (m.parentId) {
      const parent = wsCats.value.find(c => c.id === m.parentId)
      // R70：改用 pyDepthOf（带 visited 防环）——内联的 while 上行走链在环数据下会死转
      if (parent && pyDepthOf(parent) + 2 > MAX_CAT_LEVEL) { showToast(`ℹ 最多 ${MAX_CAT_LEVEL} 级——该分类已处于最深层`); return }
    }
    const siblings = wsCats.value.filter(c => (c.parentId || '') === m.parentId)
    const cat: Category = { id: uid('cat'), workspaceId: workspaceId.value, name, order: siblings.length, parentId: m.parentId || undefined }
    d.value.categories.push(cat)
    activeCategory.value = cat.id
    showToast('✓ 分类已创建')
    persist()
    catModal.value.open = false
  }
  async function deleteCategory(cat: Category) {
    const kids = childCatsOf(cat.id)
    const n = catAggCount(cat.id)
    const msg = kids.length
      ? `确定删除「${cat.name}」？\n其下 ${kids.length} 个子分类将升级为一级分类，资源卡不受影响。`
      : (n ? `确定删除「${cat.name}」？\n其中 ${n} 张资源卡将移入「待分类」，可在回收站查看。` : `确定删除「${cat.name}」？`)
    if (!(await useConfirm({ title: '删除分类', message: msg, confirmText: '确认删除' }))) return
    kids.forEach(k => { k.parentId = undefined })
    if (kids.length) {
      const target = kids[0]!.id
      allResources.value.forEach(r => { if (r.categoryId === cat.id) r.categoryId = target })
    } else {
      allResources.value.forEach(r => { if (r.categoryId === cat.id) r.categoryId = '' })
    }
    cat.deletedAt = Date.now() // R109（F12-b）：分类软删——回收站可恢复（子分类升级与卡片回落保持原语义，不随恢复自动还原）
    // R61：清理以该分类为落点的镜像记录（落点回落该台待分类；源卡零影响）
    for (const p of d.value.curationProjections || []) if (p.kind === 'card' && p.targetWsId === workspaceId.value && p.targetCatId === cat.id) p.targetCatId = undefined
    // R53-A3：级联清理该源分类的策展镜像分类（旧方向遗留逻辑，R61 后 hub 分类无 curFrom，保留兜底）
    const mirrorCats = d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID && c.curFrom?.catId === cat.id)
    for (const mc of mirrorCats) {
      const midIds = new Set<string>([mc.id])
      for (const r of d.value.resources) if (r.workspaceId === CURATION_WS_ID && midIds.has(r.categoryId || '')) r.categoryId = ''
      for (const p of d.value.curationProjections || []) if (p.kind === 'card' && p.targetCatId && midIds.has(p.targetCatId)) p.targetCatId = undefined
      for (const c of d.value.categories) if (c.parentId && midIds.has(c.parentId)) c.parentId = undefined
      d.value.categories = d.value.categories.filter(c => c.id !== mc.id)
    }
    if (activeCategory.value === cat.id) activeCategory.value = 'all'
    normalizeCatOrders('')
    persist()
    showToast('已删除分类——其下卡片已回到「待分类」，未丢失')
  }
  function toggleCatPin(cat: Category) {
    cat.pinned = !cat.pinned
    persist()
    showToast(cat.pinned ? '📌 分类已置顶' : '已取消置顶')
  }
  /** 第卅三轮 REQ-021：存量重复分类合并工具（同一策展台内同名分组，资源并入首个，子分类升级一级） */
  async function mergeDupCats() {
    const groups = new Map<string, Category[]>()
    for (const c of wsCats.value) {
      const key = c.name.trim()
      if (!key) continue
      const arr = groups.get(key) || []
      arr.push(c)
      groups.set(key, arr)
    }
    const dupGroups = [...groups.values()].filter(g => g.length > 1)
    if (!dupGroups.length) { showToast('当前策展台无重复分类 ✨'); return }
    const totalDup = dupGroups.reduce((s, g) => s + g.length - 1, 0)
    if (!(await useConfirm({
      title: '合并重复分类',
      message: `发现 ${dupGroups.length} 组、共 ${totalDup} 个重复分类。\n资源卡将合并到每组第一个分类；重复分类的子分类将升级为一级分类。\n继续合并？`,
      confirmText: '合并'
    }))) return
    let merged = 0
    for (const g of dupGroups) {
      const keep = g[0]!
      for (const dup of g.slice(1)) {
        allResources.value.forEach(r => { if (r.categoryId === dup.id) r.categoryId = keep.id })
        childCatsOf(dup.id).forEach(k => { k.parentId = undefined })
        dup.deletedAt = Date.now() // R109（F12-b）：被合并分类软删（回收站可恢复）
        merged++
      }
    }
    normalizeCatOrders('')
    persist()
    showToast(`✓ 已合并 ${merged} 个重复分类`)
  }

  return { normalizeCatOrders, catModal, openCreateCat, catRenId, startCatRename, commitCatRename, catNameDup, confirmCatModal, deleteCategory, toggleCatPin, mergeDupCats }
}
