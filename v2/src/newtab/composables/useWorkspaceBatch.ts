/**
 * R102（纯拆分第三批）：卡片整理动作域 —— 批量选择 / 批量移动 / 单卡移动 / 挂载到任务，
 * 自 Workspace.vue 原位迁出（零行为变更）。
 *
 * 边界约定（04-51 任务书）：
 * - 三视图模板（勾选框 / batch-bar / 移动弹窗）留在宿主，本 composable 只持有
 *   状态与动作实现，经解构保持宿主原标识符（R100 模式）；
 *   （R162：挂载到任务域随任务↔资源挂载关系退役）
 * - ctx 注入：d / persist / workspaceId / wsCats / sortedResources /
 *   openResourceLink / treeCatOptions；showToast / useConfirm / uid / isMirrorView /
 *   removeProjection 直接 import 共享实现。
 */
import { ref, computed, watch, type ComputedRef } from 'vue'
import type { AppData, Category, Project, ResourceCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import { isMirrorView, removeProjection, type MirrorView } from '@/shared/storage/hub'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'

export interface WorkspaceBatchCtx {
  d: ComputedRef<AppData>
  persist: () => void
  workspaceId: ComputedRef<string>
  wsCats: ComputedRef<Category[]>
  /** 台内原生卡 + 镜像卡视图模型（boardCardsOf），批量选择的数据源 */
  allResources: ComputedRef<ResourceCard[]>
  /** 当前排序后的可见卡（全选的数据源） */
  sortedResources: ComputedRef<ResourceCard[]>
  openResourceLink: (r: ResourceCard) => void
  treeCatOptions: (cats: Category[]) => { id: string; label: string }[]
}

export function useWorkspaceBatch(ctx: WorkspaceBatchCtx) {
  const { d, persist, workspaceId, wsCats, allResources, sortedResources, openResourceLink, treeCatOptions } = ctx

  // ===== 批量选择核心 =====
  const batchMode = ref(false)
  const selectedIds = ref<Set<string>>(new Set())
  function toggleBatchMode() {
    batchMode.value = !batchMode.value
    if (!batchMode.value) selectedIds.value.clear()
  }
  function toggleSelect(id: string) {
    if (selectedIds.value.has(id)) selectedIds.value.delete(id)
    else selectedIds.value.add(id)
  }
  function selectAllVisible() {
    const all = sortedResources.value
    if (selectedIds.value.size >= all.length) selectedIds.value.clear()
    else all.forEach(r => selectedIds.value.add(r.id))
  }
  function selectedCards(): ResourceCard[] {
    return allResources.value.filter(r => selectedIds.value.has(r.id))
  }
  async function batchOpen() {
    const items = selectedCards().filter(r => r.link)
    if (!items.length) { showToast('所选资源卡均无链接'); return }
    if (items.length > 15 && !(await useConfirm({ title: '批量打开链接', message: `即将打开 ${items.length} 个标签页，确认继续？`, confirmText: '继续打开', danger: false }))) return
    items.forEach(r => openResourceLink(r))
    showToast(`✓ 已打开 ${items.length} 个链接`)
  }
  async function batchDelete() {
    const n = selectedIds.value.size
    const removed = selectedCards()
    // R61：镜像卡参与批量删除 = 移出镜像（源卡保留）；原生卡照常软删
    const mirrors = removed.filter(isMirrorView)
    const natives = removed.filter(r => !isMirrorView(r))
    mirrors.forEach(m => removeProjection(d.value, (m as MirrorView).__mirrorProjId))
    natives.forEach(r => { r.deletedAt = Date.now() })
    persist()
    selectedIds.value.clear()
    const mirrorNote = mirrors.length ? `（含 ${mirrors.length} 张镜像卡已移出镜像）` : ''
    showToast(`已删除 ${natives.length} 张资源卡${mirrorNote}`, { label: '撤销', cb: () => {
      // REQ-030：按 id 批量定位当前树恢复
      natives.forEach(r => {
        const cur = d.value.resources.find(x => x.id === r.id)
        if (cur && cur.deletedAt) cur.deletedAt = undefined
      })
      persist()
    } })
  }

  // ===== 批量移动（第八轮：策展台→分类级联，含当前策展台） =====
  const moveModalOpen = ref(false)
  const moveWsId = ref('')
  const moveCatId = ref('')
  const moveWorkspaces = computed(() => d.value.workspaces.filter(w => !w.archived))
  // R117（04-61 A）：分类口径统一——过滤软删（原实现漏 deletedAt，软删分类会成为下拉里的「幽灵项」）；
  // 与采集浮层 / 全局采集 / 资源台左树同源（buildCatOptions）
  const moveCatOptions = computed(() => treeCatOptions(d.value.categories.filter(c => c.workspaceId === moveWsId.value && !c.deletedAt)))
  watch(moveWsId, () => { moveCatId.value = '' })
  function openBatchMove() {
    moveWsId.value = workspaceId.value
    moveCatId.value = ''
    moveModalOpen.value = true
  }
  function confirmBatchMove() {
    const items = selectedCards()
    if (!items.length || !moveWsId.value) { showToast('请选择目标策展台'); return }
    // R61：镜像卡不参与跨台移动（引用随台走），先移出镜像再提示
    const mirrors = items.filter(isMirrorView)
    const natives = items.filter(r => !isMirrorView(r))
    if (mirrors.length && !natives.length) { showToast('📡 所选均为镜像卡——移动请在源卡处操作，或先移出镜像'); return }
    let catId = moveCatId.value
    if (!catId) {
      let cat = d.value.categories.find(c => !c.deletedAt && c.workspaceId === moveWsId.value && c.name === '待分类')
      if (!cat) {
        cat = { id: uid('cat'), workspaceId: moveWsId.value, name: '待分类', order: 0 }
        d.value.categories.push(cat)
      }
      catId = cat.id
    }
    // R129-B8：原为 `items.forEach` —— 镜像卡是运行时浅拷贝（`{...src, categoryId, __mirrorProjId}`），
    // 往它身上写 workspaceId/categoryId 既不落库也不影响源卡，等于「toast 说移动了 N 张、其实一张没动」。
    // 镜像的移动只走拖拽（moveMirrorTo 改投射记录），跨台批量移动一律只作用于 natives。
    natives.forEach(r => { r.workspaceId = moveWsId.value; r.categoryId = catId; r.updatedAt = Date.now() })
    persist()
    moveModalOpen.value = false
    const mirrorNote = mirrors.length ? `（${mirrors.length} 张镜像卡未移动）` : ''
    showToast(`✓ 已移动 ${natives.length} 张资源卡${mirrorNote}`)
    selectedIds.value.clear()
  }

  // ===== 单卡移动分类（第八轮：应用内弹窗，替代原生 prompt） =====
  const moveOneOpen = ref(false)
  const moveOneCatId = ref('')
  const moveOneTarget = ref<ResourceCard | null>(null)
  const moveOneOptions = computed(() => treeCatOptions(wsCats.value))
  function openMoveOne(r: ResourceCard) {
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——移动落点请直接拖拽，编辑请到源卡'); return }
    moveOneTarget.value = r
    moveOneCatId.value = r.categoryId || ''
    moveOneOpen.value = true
  }
  function confirmMoveOne() {
    if (!moveOneTarget.value) return
    moveOneTarget.value.categoryId = moveOneCatId.value || ''
    moveOneTarget.value.updatedAt = Date.now()
    persist()
    moveOneOpen.value = false
    showToast('✓ 已移动分类')
  }

  return {
    moveOneTarget,
    batchMode, selectedIds, toggleBatchMode, toggleSelect, selectAllVisible, selectedCards, batchOpen, batchDelete,
    moveModalOpen, moveWsId, moveCatId, moveWorkspaces, moveCatOptions, openBatchMove, confirmBatchMove,
    moveOneOpen, moveOneCatId, moveOneOptions, openMoveOne, confirmMoveOne
  }
}
