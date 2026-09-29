/**
 * R103（纯拆分第四批）：镜像域 —— 策展台内的引用式投射视图（自 Workspace.vue 原位迁出，零行为变更）。
 *
 * V3.7.0（R179）：资源台退役后，本域只保留**镜像引用侧**（策展台内）——
 *   isMirrorCat / moveMirrorTo（拖拽/树落更新落点）/ removeMirror（移出镜像，源卡保留）
 *   / locateMirrorSource（定位到源卡）。
 *   推送侧（资源台发起：单卡 📡 / 分类 📤）与拉取侧（策展台拉取资源台分类）随 hub 分类退役一并移除
 *   ——真身唯一入池（CURATION_WS_ID），池卡进台走「🔗 关联资源卡」（projectCardToBoard）与投射记录。
 * 底层 API（removeProjection / isMirrorView）直接 import 共享实现；宿主以解构保持原标识符（R100 模式）。
 */
import type { ComputedRef } from 'vue'
import type { Router } from 'vue-router'
import type { AppData, Category, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { removeProjection, isMirrorView, type MirrorView } from '@/shared/storage/hub'
import { showToast } from '@/shared/components/toast'

export interface WorkspaceMirrorCtx {
  d: ComputedRef<AppData>
  persist: () => void
  /** 当前台分类（镜像落点提示用） */
  categories: ComputedRef<Category[]>
  router: Router
}

export function useWorkspaceMirror(ctx: WorkspaceMirrorCtx) {
  const { d, persist, categories, router } = ctx

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
  /** R61：移出镜像（只删引用，源卡保留在池中） */
  function removeMirror(r: ResourceCard) {
    if (!isMirrorView(r)) return
    removeProjection(d.value, r.__mirrorProjId)
    persist()
    showToast('✓ 已移出镜像（源卡保留在资源卡池）')
  }
  /** R61：定位到源卡（V3.7.0：资源台页退役，池管理面归调度台「3张卡」——先回落首页） */
  function locateMirrorSource(r: ResourceCard) {
    const src = d.value.resources.find(x => x.id === r.id)
    if (!src) { showToast('ℹ 源卡已删除'); return }
    router.push('/')
    showToast(`↗ 源卡在资源卡池 · ${src.title.slice(0, 20)}`)
  }

  return {
    isMirrorCat, moveMirrorTo, removeMirror, locateMirrorSource,
  }
}
