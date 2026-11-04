<script setup lang="ts">
/**
 * 第卅九轮 REQ-048：卡片附件管理器（共享组件）
 * - 上传：图片（单卡 ≤9 张、单张 ≤10MB）/ HTML（单卡唯一 ≤20MB，重复上传=替换）/ PDF（单卡唯一 ≤50MB，重复上传=替换）→ IndexedDB zy_assets
 * - 展示：附件 chip（图标+名称+大小），溢出省略
 * - 打开：图片 → 全屏弹窗预览（多图左右切换）；HTML/PDF → openHtmlAsset（file:// 落盘完整打开，REQ-058 + 第卌四轮泛化；PDF 由 Chrome 内置 viewer 渲染）
 * - 联动：HTML/PDF 上传成功 emit('html-added', meta) —— 宿主做标题/链接属性联动（资源卡：标题取文件名 + linkType=file + link=zy-asset://）
 * - 性能红线：主 JSON 只存 meta，Blob 本体永不进 JSON
 */
import Icon from '@/shared/components/Icon.vue'
import { ref, computed } from 'vue'
import type { AssetMeta } from '@/shared/models'
import { putAsset, getAssetBlob } from '@/shared/storage/assets'
import { deleteAssetIfOrphan } from '@/shared/storage/purge'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
// R80（R13）：guessAssetKind / ASSET_KIND_MB 由 shared/utils/assetKind 提供（不再本地实现）
import { guessAssetKind, ASSET_KIND_MB } from '@/shared/utils/assetKind'
import AssetPreview from './AssetPreview.vue'

const props = withDefaults(defineProps<{
  modelValue?: AssetMeta[] | null
  /** 单文件上限（MB，HTML 用；图片固定 10MB 上限） */
  maxSizeMB?: number
  /** R128-A3：所在卡 id——附件本体可能被转卡后的孪生卡共享，删本体前按此排除自身判引用 */
  ownerId?: string
  /** 本地 Blob 缺失时可由宿主从云端按元数据回填。普通卡片不传。 */
  remoteDownloader?: (meta: AssetMeta) => Promise<Blob | null>
  /** 策展节点：删除先由画布历史保留 Blob，父级延迟清理；普通卡片保持立即清理。 */
  deferBlobDeletion?: boolean
  /** 策展节点：HTML/PDF 同类替换前由用户确认。 */
  confirmDocReplace?: boolean
}>(), {
  modelValue: null,
  maxSizeMB: 20,
  ownerId: '',
  remoteDownloader: undefined,
  deferBlobDeletion: false,
  confirmDocReplace: false,
})
const emit = defineEmits<{
  (e: 'update:modelValue', v: AssetMeta[]): void
  /** 第卌二轮 REQ-061：HTML 上传成功（含替换），meta 为新 HTML 附件；replacedOld 为被替换的旧 HTML（无则 null） */
  (e: 'html-added', meta: AssetMeta, replacedOld: AssetMeta | null): void
  /** V4.1.0：策展节点附件上传失败后由宿主重试；普通卡片不监听。 */
  (e: 'retry', meta: AssetMeta): void
}>()

/** 第卌二轮 REQ-061 上传规范常量；第卌四轮 T-08：PDF 100MB 上限（用户拍板）
 *  R80（R13）：图片/PDF 上限改由共享 ASSET_KIND_MB 供值（导入侧同口径），HTML 仍走 props.maxSizeMB */
const IMG_MAX_COUNT = 9
const IMG_MAX_MB = ASSET_KIND_MB.image
const PDF_MAX_MB = ASSET_KIND_MB.pdf

const list = computed<AssetMeta[]>(() => props.modelValue || [])
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)

function emitList(next: AssetMeta[]) { emit('update:modelValue', next) }

/** R128-A3：删附件本体前先查全树引用——REQ-050 转卡是「引用拷贝」，同一 Blob 可能同时挂在
 *  好奇源卡与转出的任务/资源卡上；从任一侧删附件不能把另一侧打成死链。 */
async function dropBlob(id: string): Promise<boolean> {
  if (props.deferBlobDeletion) return false
  return await deleteAssetIfOrphan(id, props.ownerId || undefined)
}

// ---- 类型判定（扩展名兜底 file.type 缺失） ----
// R80（R13）：判定抽到共享工具，供本地文件导入复用——两处口径必须只有一份实现
const guessKind = guessAssetKind
function fmtSize(n: number): string {
  if (n < 1024) return n + 'B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + 'KB'
  return (n / 1024 / 1024).toFixed(1) + 'MB'
}

// ---- 上传 ----
function onPick() { fileInput.value?.click() }
async function onFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  // ⚠ 第卌一轮修复：必须先快照 FileList 再清空 input.value —— 设置 value='' 会重置 FileList，
  // 旧代码先存引用后清空导致真实上传链路 100% 静默失败（注入式验证绕过了此链路故未暴露）
  const files = Array.from(input.files || [])
  input.value = ''
  await ingestFiles(files)
}

async function ingestFiles(files: File[]) {
  if (!files.length || busy.value) return
  busy.value = true
  try {
    const added: AssetMeta[] = []
    let replacedOld: AssetMeta | null = null // REQ-061：HTML/PDF 单卡唯一——替换旧附件时记录
    // REQ-061：图片数量上限预检（本批可再收几张）
    let imgQuota = IMG_MAX_COUNT - list.value.filter(a => a.kind === 'image').length
    // 第卌四轮：HTML 与 PDF 均为单卡唯一，同类新附件替换旧附件
    const isDocKind = (k: string) => k === 'html' || k === 'pdf'
    for (const f of files) {
      const kind = guessKind(f.name, f.type)
      if (!kind) { showToast(`仅支持图片 / HTML / PDF 文件，已跳过：${f.name.slice(0, 24)}`); continue }
      // 图片 ≤10MB；PDF ≤50MB；HTML 沿宿主 maxSizeMB
      const limitMB = kind === 'image' ? IMG_MAX_MB : kind === 'pdf' ? PDF_MAX_MB : props.maxSizeMB
      if (f.size > limitMB * 1024 * 1024) { showToast(`${f.name.slice(0, 24)} 超过 ${limitMB}MB 上限，已跳过`); continue }
      // REQ-061：单卡图片 ≤9 张，超额拒绝
      if (kind === 'image') {
        if (imgQuota <= 0) { showToast(`图片数量已达上限 ${IMG_MAX_COUNT} 张，已跳过：${f.name.slice(0, 24)}`); continue }
        imgQuota--
      }
      if (isDocKind(kind) && added.some(a => a.kind === kind)) {
        showToast(`${kind.toUpperCase()} 每卡只能保留 1 个，已跳过：${f.name.slice(0, 24)}`)
        continue
      }
      const olds = isDocKind(kind) ? list.value.filter(a => a.kind === kind) : []
      if (olds.length && props.confirmDocReplace) {
        const ok = await useConfirm({
          title: `替换 ${kind.toUpperCase()} 附件`,
          message: '当前节点已有同类文件。继续会移除旧文件并上传新文件。',
          confirmText: '替换',
        })
        if (!ok) continue
      }
      const id = uid('at')
      try {
        await putAsset(id, f)
      } catch (err) {
        console.error('[assets] putAsset failed:', err)
        showToast(`附件写入失败：${f.name.slice(0, 24)}`)
        continue
      }
      const meta: AssetMeta = { id, kind, name: f.name, size: f.size, mime: f.type || (kind === 'image' ? 'image/png' : kind === 'pdf' ? 'application/pdf' : 'text/html'), createdAt: Date.now() }
      // 第卌四轮 T-08：HTML/PDF 单卡唯一（拍板 q-1=替换旧的）——删除旧同类附件本体并从列表移除
      if (isDocKind(kind)) {
        for (const old of olds) {
          try { await dropBlob(old.id) } catch (err) { console.error('[assets] replace old doc delete failed:', err) }
          if (!replacedOld) replacedOld = old
        }
      }
      added.push(meta)
    }
    if (added.length) {
      const hadOldDoc = !!replacedOld
      const docKindsAdded = new Set(added.filter(a => isDocKind(a.kind)).map(a => a.kind))
      const nextList = [...list.value.filter(a => !(isDocKind(a.kind) && docKindsAdded.has(a.kind))), ...added]
      emitList(nextList)
      if (added.some(a => isDocKind(a.kind))) {
        // REQ-061：通知宿主做标题/链接属性联动（每个新 HTML/PDF 通知一次）
        for (const m of added.filter(a => isDocKind(a.kind))) emit('html-added', m, replacedOld)
      }
      const docPart = added.some(a => isDocKind(a.kind)) ? (hadOldDoc ? '，已替换原同名类型附件' : '') : ''
      showToast(`已上传 ${added.length} 个附件（${fmtSize(added.reduce((s, a) => s + a.size, 0))}${docPart}）`)
    }
  } finally {
    busy.value = false
  }
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  e.stopPropagation()
  void ingestFiles(Array.from(e.dataTransfer?.files || []))
}

async function loadBlob(meta: AssetMeta): Promise<Blob | null> {
  let blob = await getAssetBlob(meta.id)
  if (!blob && props.remoteDownloader) {
    try {
      blob = await props.remoteDownloader(meta)
      if (blob) await putAsset(meta.id, blob)
    } catch (error) {
      console.error('[assets] remote download failed:', error)
    }
  }
  return blob
}

function uploadStateLabel(meta: AssetMeta): string {
  if (!meta.uploadState) return ''
  if (meta.uploadState === 'synced') return '已同步'
  if (meta.uploadState === 'pending') return '待上传'
  if (meta.uploadState === 'failed') return '上传失败'
  return '仅本机'
}

// ---- 删除单个 ----
async function removeAsset(meta: AssetMeta) {
  let purged = true
  try {
    purged = await dropBlob(meta.id)
  } catch (err) {
    // 第卌一轮 REQ-057：业务吞错收敛——本体删除失败必须让用户知道（meta 已软删但 Blob 残留 = 孤儿）
    console.error('[assets] deleteAsset failed:', err)
    showToast('附件本体删除失败，可到「设置 · 数据管理」清理孤儿')
  }
  emitList(list.value.filter(a => a.id !== meta.id))
  // R128-A3：本体仍被转卡孪生引用时不删 Blob，提示口径与「彻底移除」区分
  showToast(props.deferBlobDeletion
    ? '附件已从节点移除（可在画布历史撤销）'
    : purged ? '附件已移除' : '附件已从本卡移除（该本体仍被转出的卡片共用，已保留）')
}

// ---- 打开（图片弹窗多图预览 / HTML·PDF 下载副本后打开） ----
/** R162：单击/双击同动作去抖——双击会先触发两次 click，不判别会重复打开（HTML/PDF 会重复下载） */
let lastOpenId = ''
let lastOpenAt = 0
function openAssetOnce(meta: AssetMeta) {
  const now = Date.now()
  if (meta.id === lastOpenId && now - lastOpenAt < 400) return
  lastOpenId = meta.id
  lastOpenAt = now
  void openAsset(meta)
}
const viewerOpen = ref(false)
const viewerUrl = ref('')
const viewerName = ref('')
/** 第卌二轮 REQ-061：多图左右切换——宿主持图片序列与游标 */
const imageUrls = ref<string[]>([])
const imageIdx = ref(0)
let lastViewerUrl = ''
function revokeViewer() {
  if (lastViewerUrl) { try { URL.revokeObjectURL(lastViewerUrl) } catch { /* noop */ } lastViewerUrl = '' }
}
function closeViewer() {
  viewerOpen.value = false
  // 多图模式：批量回收所有 blob
  for (const u of imageUrls.value) { try { URL.revokeObjectURL(u) } catch { /* noop */ } }
  imageUrls.value = []
  lastViewerUrl = ''
}

/** 切换到第 i 张（宿主更新 url/name；旧 blob 由 revokeViewer 清） */
function showImageAt(i: number) {
  if (i < 0 || i >= imageUrls.value.length || !imageUrls.value[i]) return
  revokeViewer()
  imageIdx.value = i
  lastViewerUrl = imageUrls.value[i]
  viewerUrl.value = imageUrls.value[i]
  viewerName.value = list.value.filter(a => a.kind === 'image')[i]?.name || ''
}

async function openAsset(meta: AssetMeta) {
  if (meta.kind === 'image') {
    // 多图模式：一次性加载全部图片 blob（上限 9 张，代价可控），支持左右切换
    const imgs = list.value.filter(a => a.kind === 'image')
    const idx = Math.max(0, imgs.findIndex(a => a.id === meta.id))
    const urls: string[] = []
    for (const im of imgs) {
      try {
        const b = await loadBlob(im)
        if (b) urls.push(URL.createObjectURL(b))
        else urls.push('')
      } catch { urls.push('') }
    }
    const valid = urls.filter(Boolean)
    if (!valid.length) { showToast('附件本体缺失（可能已被清理），请重新上传'); return }
    closeViewer()
    imageUrls.value = urls
    viewerOpen.value = true
    showImageAt(idx >= 0 ? idx : 0)
  } else {
    // 第卌二轮 REQ-058 + 第卌四轮 T-08：HTML/PDF file:// 落盘完整打开（复用既有副本；失败降级 blob）
    const blob = await loadBlob(meta)
    if (!blob) { showToast('附件本体缺失（可能已被清理），请重新上传'); return }
    await openHtmlAsset(meta, blob)
  }
}
</script>

<template>
  <div class="am" @dragover.prevent @drop="onDrop">
    <div v-if="list.length" class="am-list">
      <div v-for="a in list" :key="a.id" class="am-item" :title="`${a.name}（${fmtSize(a.size)}）`">
        <span class="am-ico"><Icon v-if="a.kind === 'image'" name="image" :size="13"/><Icon v-else-if="a.kind === 'pdf'" name="book" :size="13"/><Icon v-else name="filetext" :size="13"/></span>
        <span class="am-name" v-pressable @click="openAssetOnce(a)" @dblclick="openAssetOnce(a)">{{ a.name }}</span>
        <span v-if="uploadStateLabel(a)" class="am-state" :class="a.uploadState" :title="a.lastError || ''">{{ uploadStateLabel(a) }}</span>
        <button v-if="a.uploadState === 'failed'" type="button" class="am-retry"
          :title="a.lastError || '重新上传'" @click.stop="emit('retry', a)">重试</button>
        <span class="am-size">{{ fmtSize(a.size) }}</span>
        <span class="am-open" v-pressable @click="openAssetOnce(a)" @dblclick="openAssetOnce(a)" :title="a.kind === 'image' ? '弹窗预览' : '双击在浏览器中打开（先下载本地副本）'"><Icon v-if="a.kind === 'image'" name="eye" :size="13"/><Icon v-else name="external" :size="13"/></span>
        <span class="am-del" v-pressable @click="removeAsset(a)" title="移除附件">×</span>
      </div>
    </div>
    <button class="am-add" :class="{ busy }" :disabled="busy" @click="onPick">
      <Icon v-if="!busy" name="paperclip" :size="13"/>{{ busy ? '上传中…' : '添加附件（图片 / HTML / PDF）' }}
    </button>
    <input ref="fileInput" type="file" class="am-file" multiple accept="image/*,.html,.htm,.pdf" @change="onFilesChange" />
    <div class="am-tip">图片 ≤9 张（单张 ≤10MB）弹窗预览可左右切换；HTML 单卡 1 个（≤20MB，重复上传=替换）；PDF 单卡 1 份（≤50MB，重复上传=替换）；双击文件名在浏览器中打开（先下载本地副本，HTML 交互完整）</div>

    <!-- 第卌一轮 REQ-056：图片预览弹窗抽公共组件 AssetPreview；第卌二轮 REQ-061 多图左右切换 -->
    <AssetPreview :open="viewerOpen" :url="viewerUrl" :name="viewerName"
      :has-prev="imageIdx > 0" :has-next="imageIdx < imageUrls.length - 1"
      :pos-label="imageUrls.length > 1 ? `${imageIdx + 1}/${imageUrls.length}` : ''"
      @close="closeViewer" @prev="showImageAt(imageIdx - 1)" @next="showImageAt(imageIdx + 1)" />
  </div>
</template>

<style scoped>
.am { display: flex; flex-direction: column; gap: 8px; }
.am-list { display: flex; flex-direction: column; gap: 5px; max-height: 168px; overflow-y: auto; }
.am-item {
  display: flex; align-items: center; gap: 6px; padding: 5px 9px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; font-size: var(--fs-sub);
}
.am-item:hover { border-color: var(--border-strong); }
.am-ico { flex-shrink: 0; font-size: var(--fs-sub); }
.am-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); cursor: pointer; }
.am-name:hover { color: var(--accent); text-decoration: underline; }
.am-size { flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-3); }
.am-state { flex-shrink: 0; font-size: var(--fs-micro); color: var(--text-3); }
.am-state.synced { color: var(--accent-ink); }
.am-state.failed { color: var(--danger); }
.am-retry { flex-shrink: 0; padding: 1px 5px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.am-retry:hover { border-color: var(--accent); color: var(--accent); }
.am-open { flex-shrink: 0; cursor: pointer; font-size: var(--fs-sub); opacity: .65; }
.am-open:hover { opacity: 1; }
.am-del { flex-shrink: 0; cursor: pointer; color: var(--text-3); font-size: 14px; line-height: 1; padding: 0 2px; }
.am-del:hover { color: var(--danger); }
.am-add {
  padding: 6px 10px; border: 1px dashed var(--border-strong); border-radius: 6px; background: transparent;
  color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; transition: all var(--dur);
  display: inline-flex; align-items: center; gap: 5px;   /* G1（V3.8.25）：📎 → Icon paperclip，与文字同行 */
}
.am-add:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.am-add.busy { opacity: .6; cursor: default; }
.am-file { display: none; }
.am-tip { font-size: var(--fs-caption); color: var(--text-3); line-height: 1.5; }
</style>
