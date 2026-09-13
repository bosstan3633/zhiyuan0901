/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 资源打开域 composable——图片附件预览（blob 生命周期）+ 双击打开链接统一通道。
 * 单独成域的原因：useWorkspaceBatch（批量动作）与 useResourceDrawer（抽屉/右键菜单）
 * 都要在初始化期消费 openResourceLink——先于二者初始化即可消除接线环。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更。
 */
import { ref, type ComputedRef } from 'vue'
import { showToast } from '@/shared/components/toast'
import { toOpenableUrl, openExternalLink, linkStateOf } from '@/shared/utils/link'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import { getAssetBlob } from '@/shared/storage/assets'
import { recordResourceOpen } from '@/shared/storage/stats'
import type { AppData, ResourceCard, AssetMeta } from '@/shared/models'
import type { WsStore } from './useResourceView'

export interface ResourceOpenCtx {
  store: WsStore
  d: ComputedRef<AppData>
}

export function useResourceOpen(ctx: ResourceOpenCtx) {
  const { store, d } = ctx

  // ===== 链接打开（E1：双击 = 打开链接；第卅二轮 REQ-010 归一化逻辑统一在 shared/utils/link） =====
  /** 图片附件预览（R80/R14）：blob URL 需回收，打开下一张前先 revoke 上一张 */
  const previewOpen = ref(false)
  const previewUrl = ref('')
  const previewName = ref('')
  let lastPreviewUrl = ''
  function revokePreview() {
    if (lastPreviewUrl) { URL.revokeObjectURL(lastPreviewUrl); lastPreviewUrl = '' }
  }
  function closePreview() { previewOpen.value = false; revokePreview(); previewUrl.value = '' }
  async function openImageAsset(meta: AssetMeta) {
    let blob: Blob | null = null
    try { blob = await getAssetBlob(meta.id) } catch { blob = null }
    if (!blob) { showToast('⚠ 附件本体缺失（可能已被清理），请重新上传'); return }
    revokePreview()
    previewUrl.value = URL.createObjectURL(blob)
    lastPreviewUrl = previewUrl.value
    previewName.value = meta.name
    previewOpen.value = true
  }
  /** 第卌二轮 REQ-061：双击卡片打开——挂了 HTML 附件的资源卡（link=zy-asset://<id>）走 openHtmlAsset
   *  file:// 落盘完整打开，与详情内打开同一函数同一效果（新标签页，内联脚本可运行）
   *  R80（R14）：补上 image 分支——此前判据只放行 html/pdf，图片附件卡双击会落到
   *  「文档附件不存在或已失效」的误报；现图片走 AssetPreview 就地预览。 */
  function openResourceLink(r: ResourceCard) {
    recordResourceOpen(d.value, r)
    store.persist()
    if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
      const assetId = (r.link || '').trim().replace(/^zy-asset:\/\//i, '')
      const meta = (r.assets || []).find(a => a.id === assetId)
      if (!meta) { showToast('⚠ 卡片指向的附件不存在或已失效，请重新上传'); return }
      if (meta.kind === 'image') { void openImageAsset(meta); return }
      if (meta.kind === 'html' || meta.kind === 'pdf') { openHtmlAsset(meta); return }
      showToast('⚠ 卡片指向的附件不存在或已失效，请重新上传')
      return
    }
    const url = toOpenableUrl(r.linkType, r.link)
    if (!url) {
      // R87（R7-③）：此前一律回「本地文件需完整路径」，对 URL 型空链接卡是错话。按链接三态分流：
      const st = linkStateOf(r.linkType, r.link)
      if (st === 'none') showToast('⚠ 该卡还没填链接 —— 点卡片右上角 ↗ 或进入详情补一个')
      else if (st === 'incomplete') showToast('⚠ 仅存文件名，需补全完整路径（如 D:\\docs\\file.pdf）')
      else showToast('⚠ 该链接无法打开（协议不受支持）')
      return
    }
    openExternalLink(url)
  }

  return { previewOpen, previewUrl, previewName, closePreview, openImageAsset, openResourceLink }
}
