/**
 * R103（纯拆分第四批）：镜像域 —— 资源台 ↔ 策展台的引用式投射（自 Workspace.vue 原位迁出，零行为变更）。
 *
 * 三段实现：
 *   1. 镜像引用侧（策展台内）：isMirrorCat / moveMirrorTo（拖拽/树落更新落点）/ removeMirror（移出镜像，
 *      源卡保留）/ locateMirrorSource（定位到资源台源卡）；
 *   2. 推送侧（资源台发起）：mirrorPushModal（单卡 📡 / 分类 📤，选目标策展台）→ confirmMirrorPush；
 *   3. 拉取侧（策展台发起）：mirrorCatModal（选资源台分类镜像到本台）→ confirmMirrorCat。
 *
 * 底层 API（projectCardToBoard / mirrorCategoryToBoard / curationBoards / removeProjection）直接
 * import 共享实现；宿主以解构保持原标识符（R100 模式），模板零改动。
 */
import { ref, computed, type ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import type { AppData, Category, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { curationBoards, projectCardToBoard, mirrorCategoryToBoard, removeProjection, isMirrorView, type MirrorView } from '@/shared/storage/hub'
import { showToast } from '@/shared/components/toast'

export interface WorkspaceMirrorCtx {
  d: ComputedRef<AppData>
  persist: () => void
  workspaceId: ComputedRef<string>
  /** 当前台分类（镜像落点提示用） */
  categories: ComputedRef<Category[]>
  router: Router
  treeCatOptions: (cats: Category[]) => { id: string; label: string }[]
}

export function useWorkspaceMirror(ctx: WorkspaceMirrorCtx) {
  const { d, persist, workspaceId, categories, router, treeCatOptions } = ctx

  // ===== 镜像引用侧（策展台内） =====
  function isMirrorCat(c: Category): boolean {
    return c.curFrom?.wsId === CURATION_WS_ID
  }
  /** R61：镜像卡落点更新（拖拽/树落）——只改投射记录，源卡零影响 */
  function moveMirrorTo(m: MirrorView, catId: string) {
    const p = (d.value.curationProjections || []).find(x => x.id === m.__mirrorProjId)
    if (!p) return
    if ((p.targetCatId || '') === (catId || '')) return
    p.targetCatId = catId || undefined
    persist()
    showToast(`📡 镜像已移入「${catId ? categories.value.find(c => c.id === catId)?.name : '待分类'}」`)
  }
  /** R61：移出镜像（只删引用，源卡保留在资源台） */
  function removeMirror(r: ResourceCard) {
    if (!isMirrorView(r)) return
    removeProjection(d.value, r.__mirrorProjId)
    persist()
    showToast('✓ 已移出镜像（源卡保留在资源台）')
  }
  /** R61：定位到资源台源卡 */
  function locateMirrorSource(r: ResourceCard) {
    const src = d.value.resources.find(x => x.id === r.id)
    if (!src) { showToast('ℹ 源卡已删除'); return }
    router.push('/curation')
    showToast(`↗ 源卡在资源台 · ${src.title.slice(0, 20)}`)
  }

  // ===== R73-S3（R16 收敛）：镜像到策展台（单卡 📡 / 分类 📤；方向 = 资源台 → 策展台） =====
  // 自 CurationCenter 迁入。底层 API（projectCardToBoard / mirrorCategoryToBoard）此前已在
  // 本文件被「从资源台拉取」的入口使用，此处补的是**反向的推送入口 UI**（选目标策展台）。
  // 仅在 hub（资源台）出现：策展台上的卡片源头就是资源台，策展台再推给别的台无意义。
  const boards = computed(() => curationBoards(d.value))
  const mirrorPushModal = ref<{ kind: 'card' | 'cat'; cardId?: string; catId?: string; catName?: string; toWs: string; toCat: string } | null>(null)
  function openMirrorCard(r: ResourceCard) {
    if (!boards.value.length) { showToast('ℹ 还没有策展台——顶栏「＋ 新建策展台」先建一个'); return }
    mirrorPushModal.value = { kind: 'card', cardId: r.id, toWs: boards.value[0].id, toCat: '' }
  }
  function openMirrorCat(c: Category) {
    if (!boards.value.length) { showToast('ℹ 还没有策展台——顶栏「＋ 新建策展台」先建一个'); return }
    mirrorPushModal.value = { kind: 'cat', catId: c.id, catName: c.name, toWs: boards.value[0].id, toCat: '' }
  }
  const mirrorPushTargetCats = computed(() => {
    const m = mirrorPushModal.value
    return m ? d.value.categories.filter(c => c.workspaceId === m.toWs) : []
  })
  function confirmMirrorPush() {
    const m = mirrorPushModal.value
    if (!m) return
    if (!m.toWs) { showToast('ℹ 请选择目标策展台'); return }
    if (m.kind === 'card') {
      const ok = projectCardToBoard(d.value, m.cardId!, m.toWs, m.toCat || undefined)
      if (ok) showToast('📡 已镜像到策展台（引用式，源数据零影响）')
      else showToast('ℹ 未完成——该卡可能已在该台镜像中')
    } else {
      const ok = mirrorCategoryToBoard(d.value, m.catId!, m.toWs)
      if (ok) showToast('📤 已镜像分类到策展台（现有卡片一并投射）')
      else showToast('ℹ 该分类已在该策展台镜像中')
    }
    persist()
    mirrorPushModal.value = null
  }

  // ===== R62-6：从资源台镜像分类（弹窗选分类 → mirrorCategoryToBoard） =====
  const mirrorCatModal = ref<{ open: boolean; catId: string }>({ open: false, catId: '' })
  const hubCatOptions = computed(() => treeCatOptions(d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID)))
  function confirmMirrorCat() {
    const catId = mirrorCatModal.value.catId
    if (!catId) return
    const ok = mirrorCategoryToBoard(d.value, catId, workspaceId.value)
    persist()
    mirrorCatModal.value.open = false
    if (ok) showToast('📤 已镜像分类到本台（源分类现有卡自动镜像，引用式）')
    else showToast('ℹ 该分类已镜像过本台')
  }

  return {
    isMirrorCat, moveMirrorTo, removeMirror, locateMirrorSource,
    boards, mirrorPushModal, openMirrorCard, openMirrorCat, mirrorPushTargetCats, confirmMirrorPush,
    mirrorCatModal, hubCatOptions, confirmMirrorCat
  }
}
