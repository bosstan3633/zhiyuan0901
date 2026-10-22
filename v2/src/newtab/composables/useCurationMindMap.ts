/**
 * 策展台画布域：把现有 Category 父子树直接当作思维导图数据源。
 *
 * 设计边界：
 * - 不新增第二棵树；金字塔 / 树状只是同一份 parentId 结构的两种渲染。
 * - 节点标题沿用 Category.name，说明使用 Category.description（可选，零迁移）。
 * - 新建、同级、拖拽改父级、搜索命中都在这里收口，组件只负责交互表达。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { showToast } from '@/shared/components/toast'
import { uid } from '@/shared/utils'
import type { CatIndex } from '@/shared/utils/catIndex'
import { MAX_CAT_LEVEL } from '@/shared/utils/catTree'
import type { AppData, Category, ResourceCard } from '@/shared/models'

export type CurationCanvasLayout = 'pyramid' | 'tree'

export interface CurationMindMapCtx {
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  wsCats: ComputedRef<Category[]>
  catIdx: ComputedRef<CatIndex<Category>>
  allResources: ComputedRef<ResourceCard[]>
  thesisCard: ComputedRef<ResourceCard | null>
  persist: () => void
}

/** 画布总层级：L1 中心论点 + L2/L3/L4 三个分类层。 */
export const MIND_TOTAL_LEVEL = 4

export function useCurationMindMap(ctx: CurationMindMapCtx) {
  const { d, workspaceId, wsCats, catIdx, allResources, thesisCard, persist } = ctx

  const layout = ref<CurationCanvasLayout>('pyramid')
  const selectedId = ref('root')
  const editRequestId = ref('')
  const editRequestSeq = ref(0)
  const keyboardDragSource = ref('')
  const keyboardDragTarget = ref('')
  const clipboardId = ref('')
  const revealId = ref('')
  const fullscreen = ref(false)
  const fullscreenFallback = ref(false)

  const rootCats = computed(() => catIdx.value.roots)

  function childrenOf(catId: string): Category[] {
    return catIdx.value.childrenOf.get(catId) || []
  }

  /** 分类在画布里的显示层级：一级分类 = L2。 */
  function nodeLevel(cat: Category): number {
    return catIdx.value.depthOf(cat.id) + 1
  }

  function nodeHeight(cat: Category): number {
    const kids = childrenOf(cat.id)
    if (!kids.length) return 1
    return 1 + Math.max(...kids.map(nodeHeight))
  }

  const cardsByCat = computed<Map<string, ResourceCard[]>>(() => {
    const out = new Map<string, ResourceCard[]>()
    for (const r of allResources.value) {
      if (r.isThesis) continue
      const key = r.categoryId || ''
      const arr = out.get(key)
      if (arr) arr.push(r)
      else out.set(key, [r])
    }
    return out
  })

  const nodeCount = computed(() => wsCats.value.length)
  const rootBranchCount = computed(() => rootCats.value.length)
  const linkedResourceCount = computed(() => allResources.value.filter(r => !r.isThesis && !!r.categoryId && catIdx.value.byId.has(r.categoryId)).length)
  const selectedNode = computed(() => selectedId.value === 'root' ? null : wsCats.value.find(c => c.id === selectedId.value) || null)
  const selectedLevel = computed(() => selectedId.value === 'root' ? 1 : (selectedNode.value ? nodeLevel(selectedNode.value) : 0))
  const selectedLabel = computed(() => selectedId.value === 'root' ? '中心论点' : (selectedNode.value?.name || '未命名分支'))
  const selectedCards = computed(() => selectedId.value === 'root' ? [] : (cardsByCat.value.get(selectedId.value) || []))
  const keyboardDragHint = computed(() => {
    if (!keyboardDragSource.value) return ''
    const source = keyboardDragSource.value === 'root'
      ? '中心论点'
      : wsCats.value.find(c => c.id === keyboardDragSource.value)?.name || '未命名分支'
    if (!keyboardDragTarget.value) return `正在移动「${source}」：用 ↑/↓ 选择目标，M 确认，Esc 取消`
    const target = keyboardDragTarget.value === 'root'
      ? '中心论点'
      : wsCats.value.find(c => c.id === keyboardDragTarget.value)?.name || '未命名分支'
    return `移动「${source}」→「${target}」：M 确认，Esc 取消`
  })
  const flattenedIds = computed<string[]>(() => {
    const out: string[] = ['root']
    const seen = new Set<string>()
    const walk = (parentId?: string) => {
      const kids = parentId ? childrenOf(parentId) : rootCats.value
      for (const c of kids) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        out.push(c.id)
        walk(c.id)
      }
    }
    walk()
    for (const c of wsCats.value) if (!seen.has(c.id)) out.push(c.id)
    return out
  })

  function focusEdit(id: string): void {
    selectedId.value = id
    editRequestId.value = id
    editRequestSeq.value++
  }

  function selectNode(id: string): void {
    selectedId.value = id
  }

  /** 整树拖拽/键盘移动共用：源节点的全部后代（不含自身），用于「移动 N 个节点」提示。 */
  function descendantsOf(id: string): string[] {
    return id === 'root' ? [] : catIdx.value.descendants(id)
  }

  function setLayout(next: CurationCanvasLayout): void {
    layout.value = next
  }

  function nextOrder(parentId?: string): number {
    return wsCats.value.filter(c => (c.parentId || '') === (parentId || '')).length
  }

  function createChild(parentId = 'root'): Category | null {
    let parent: Category | undefined
    if (parentId !== 'root') {
      parent = wsCats.value.find(c => c.id === parentId)
      if (!parent) return null
      if (nodeLevel(parent) >= MIND_TOTAL_LEVEL) {
        showToast(`ℹ 最多 ${MIND_TOTAL_LEVEL} 级——该分支已处于最深层`)
        return null
      }
    }
    const cat: Category = {
      id: uid('cat'),
      workspaceId: workspaceId.value,
      name: '',
      order: nextOrder(parent?.id),
      parentId: parent?.id,
    }
    d.value.categories.push(cat)
    persist()
    focusEdit(cat.id)
    return cat
  }

  function createSibling(id: string, edit = true): Category | null {
    if (id === 'root') {
      showToast('中心论点没有同级；请按 Tab 创建二级分支')
      return null
    }
    const cur = wsCats.value.find(c => c.id === id)
    if (!cur) return null
    const parentId = cur.parentId || ''
    const level = nodeLevel(cur)
    if (level > MIND_TOTAL_LEVEL) {
      showToast(`ℹ 最多 ${MIND_TOTAL_LEVEL} 级`)
      return null
    }
    const siblings = wsCats.value
      .filter(c => (c.parentId || '') === parentId)
      .sort((a, b) => a.order - b.order)
    const idx = siblings.findIndex(c => c.id === cur.id)
    const cat: Category = {
      id: uid('cat'),
      workspaceId: workspaceId.value,
      name: '',
      order: idx >= 0 ? idx + 1 : siblings.length,
      parentId: cur.parentId,
    }
    siblings.splice(idx >= 0 ? idx + 1 : siblings.length, 0, cat)
    siblings.forEach((c, i) => { c.order = i })
    d.value.categories.push(cat)
    persist()
    if (edit) focusEdit(cat.id)
    else selectedId.value = cat.id
    return cat
  }

  function renameNode(cat: Category, raw: string): void {
    const name = raw.trim() || '未命名分支'
    if (name === cat.name) return
    if (wsCats.value.some(c => c.id !== cat.id && c.name.trim() === name)) {
      showToast('已存在同名分支，请换一个名称')
      return
    }
    cat.name = name
    persist()
  }

  function updateDescription(cat: Category, raw: string): void {
    const description = raw.trim()
    if ((cat.description || '') === description) return
    cat.description = description || undefined
    persist()
  }

  function validateDrop(dragId: string, targetId: string): { ok: boolean; message: string } {
    if (!dragId || !targetId) return { ok: false, message: '请选择一个可移动分支' }
    if (dragId === targetId) return { ok: false, message: '不能移动到自身' }
    const dragged = wsCats.value.find(c => c.id === dragId)
    if (!dragged) return { ok: false, message: '被拖分支不存在' }
    if (targetId === 'root') return { ok: true, message: '松手后升为一级分支' }
    const target = wsCats.value.find(c => c.id === targetId)
    if (!target) return { ok: false, message: '目标分支不存在' }
    if (catIdx.value.descendants(dragId).includes(targetId)) return { ok: false, message: '不能移动到自己的子分支下' }
    const deepest = nodeLevel(target) + nodeHeight(dragged)
    if (deepest > MIND_TOTAL_LEVEL) {
      return { ok: false, message: `移动后会到 L${deepest}，超过 ${MIND_TOTAL_LEVEL} 级上限` }
    }
    return { ok: true, message: `松手后挂到「${target.name || '未命名分支'}」下` }
  }

  function moveNode(dragId: string, targetId: string): boolean {
    const check = validateDrop(dragId, targetId)
    if (!check.ok) {
      showToast(check.message)
      return false
    }
    const dragged = wsCats.value.find(c => c.id === dragId)
    if (!dragged) return false
    if (targetId === 'root') {
      if (!dragged.parentId) return false
      const oldParent = dragged.parentId
      dragged.parentId = undefined
      dragged.order = nextOrder()
      normalizeSiblings(oldParent)
      normalizeSiblings()
      persist()
      selectedId.value = dragged.id
      showToast(`「${dragged.name || '未命名分支'}」已升为一级分支`)
      return true
    }
    const target = wsCats.value.find(c => c.id === targetId)
    if (!target) return false
    const oldParent = dragged.parentId
    dragged.parentId = target.id
    dragged.order = nextOrder(target.id)
    normalizeSiblings(oldParent)
    normalizeSiblings(target.id)
    persist()
    selectedId.value = dragged.id
    showToast(`「${dragged.name || '未命名分支'}」已挂到「${target.name || '未命名分支'}」下`)
    return true
  }

  /** 剪切：只记来源节点，不改数据；真正移动在粘贴时完成，失败不会让树消失。 */
  function cutNode(id: string): boolean {
    if (id === 'root') {
      showToast('中心论点固定为 L1，不能剪切')
      return false
    }
    if (!wsCats.value.some(c => c.id === id)) return false
    clipboardId.value = id
    selectedId.value = id
    showToast('已剪切分支——选择目标节点后按 Ctrl/⌘+V 粘贴')
    return true
  }

  /** 粘贴为子级；与拖拽共用同一套防环与四级上限校验。 */
  function pasteInto(targetId: string): boolean {
    const id = clipboardId.value
    if (!id) {
      showToast('剪贴板为空：先选中分支按 Ctrl/⌘+X')
      return false
    }
    if (id === targetId) {
      showToast('不能粘贴到自身')
      return false
    }
    const moved = moveNode(id, targetId)
    if (moved) {
      clipboardId.value = ''
      showToast('✓ 已粘贴到目标节点下')
    }
    return moved
  }

  /** 指标下钻 / 附件定位共用：选中目标分类并滚动到画布节点。 */
  function revealNode(id: string): boolean {
    if (id === 'root') {
      selectedId.value = 'root'
      document.querySelector('[data-mind-node="root"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
    const node = wsCats.value.find(c => c.id === id)
    if (!node) return false
    selectedId.value = id
    revealId.value = id
    setTimeout(() => {
      document.querySelector(`[data-mind-node="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
    setTimeout(() => { if (revealId.value === id) revealId.value = '' }, 2200)
    return true
  }

  function normalizeSiblings(parentId?: string): void {
    wsCats.value
      .filter(c => (c.parentId || '') === (parentId || ''))
      .sort((a, b) => a.order - b.order)
      .forEach((c, i) => { c.order = i })
  }

  function startKeyboardDrag(id: string): void {
    if (id === 'root') {
      showToast('中心论点固定为 L1 根节点，不能移动')
      return
    }
    keyboardDragSource.value = id
    keyboardDragTarget.value = id
    selectedId.value = id
  }

  function moveKeyboardTarget(dir: -1 | 1): void {
    if (!keyboardDragSource.value) return
    const ids = flattenedIds.value
    const current = keyboardDragTarget.value || keyboardDragSource.value
    const at = ids.indexOf(current)
    const next = ids[Math.max(0, Math.min(ids.length - 1, at + dir))]
    if (!next || next === current) return
    keyboardDragTarget.value = next
    selectedId.value = next
  }

  function confirmKeyboardMove(): void {
    const source = keyboardDragSource.value
    const target = keyboardDragTarget.value
    if (!source || !target) return
    const moved = moveNode(source, target)
    if (moved) {
      keyboardDragSource.value = ''
      keyboardDragTarget.value = ''
    }
  }

  function cancelKeyboardDrag(): void {
    if (!keyboardDragSource.value) return
    selectedId.value = keyboardDragSource.value
    keyboardDragSource.value = ''
    keyboardDragTarget.value = ''
    showToast('已取消键盘移动')
  }

  async function removeNode(id: string): Promise<boolean> {
    if (id === 'root') {
      showToast('中心论点固定在 L1，请先更换或取消中心论点')
      return false
    }
    const node = wsCats.value.find(c => c.id === id)
    if (!node) return false
    const children = childrenOf(id)
    if (children.length) {
      showToast(`「${node.name || '未命名分支'}」下还有 ${children.length} 个子分支，请先移走或删除子分支`)
      return false
    }
    const n = cardsByCat.value.get(id)?.length || 0
    if (n) {
      showToast(`「${node.name || '未命名分支'}」下还关联着 ${n} 张资源卡，请先在资源卡详情中解除关联`)
      return false
    }
    node.deletedAt = Date.now()
    normalizeSiblings(node.parentId)
    if (selectedId.value === id) selectedId.value = node.parentId || 'root'
    persist()
    showToast(`已删除分支「${node.name || '未命名分支'}」`)
    return true
  }

  function resetForWorkspace(): void {
    selectedId.value = 'root'
    editRequestId.value = ''
    editRequestSeq.value++
    keyboardDragSource.value = ''
    keyboardDragTarget.value = ''
    clipboardId.value = ''
    revealId.value = ''
  }

  function setFullscreenState(on: boolean, fallback = false): void {
    fullscreen.value = on
    fullscreenFallback.value = on && fallback
  }

  return {
    layout,
    selectedId,
    editRequestId,
    editRequestSeq,
    rootCats,
    childrenOf,
    nodeLevel,
    nodeHeight,
    cardsByCat,
    nodeCount,
    rootBranchCount,
    linkedResourceCount,
    selectedNode,
    selectedLevel,
    selectedLabel,
    selectedCards,
    keyboardDragSource,
    keyboardDragTarget,
    clipboardId,
    keyboardDragHint,
    revealId,
    fullscreen,
    fullscreenFallback,
    flattenedIds,
    thesisCard,
    selectNode,
    descendantsOf,
    setLayout,
    focusEdit,
    createChild,
    createSibling,
    renameNode,
    updateDescription,
    validateDrop,
    moveNode,
    cutNode,
    pasteInto,
    revealNode,
    startKeyboardDrag,
    moveKeyboardTarget,
    confirmKeyboardMove,
    cancelKeyboardDrag,
    removeNode,
    setFullscreenState,
    resetForWorkspace,
  }
}
