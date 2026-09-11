<script setup lang="ts">
/**
 * 第卅九轮 REQ-048：卡片附件管理器（共享组件）
 * - 上传：图片（第卌二轮规范：单卡 ≤9 张、单张 ≤10MB）/ HTML（单卡唯一 ≤20MB，重复上传=替换）/ PDF（第卌四轮：单卡唯一 ≤100MB，重复上传=替换）→ IndexedDB zy_assets
 * - 展示：附件 chip（图标+名称+大小），溢出省略
 * - 打开：图片 → 全屏弹窗预览（多图左右切换）；HTML/PDF → openHtmlAsset（file:// 落盘完整打开，REQ-058 + 第卌四轮泛化；PDF 由 Chrome 内置 viewer 渲染）
 * - 联动：HTML/PDF 上传成功 emit('html-added', meta) —— 宿主做标题/链接属性联动（资源卡：标题取文件名 + linkType=file + link=zy-asset://）
 * - 性能红线：主 JSON 只存 meta，Blob 本体永不进 JSON
 */
import { ref, computed } from 'vue'
import type { AssetMeta } from '@/shared/models'
import { putAsset, getAssetBlob, deleteAsset } from '@/shared/storage/assets'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
// R80（R13）：guessAssetKind / ASSET_KIND_MB 由 shared/utils/assetKind 提供（不再本地实现）
import { guessAssetKind, ASSET_KIND_MB } from '@/shared/utils/assetKind'
import AssetPreview from './AssetPreview.vue'

const props = withDefaults(defineProps<{
  modelValue?: AssetMeta[] | null
  /** 单文件上限（MB，HTML 用；图片固定 10MB 上限） */
  maxSizeMB?: number
}>(), {
  modelValue: null,
  maxSizeMB: 20
})
const emit = defineEmits<{
  (e: 'update:modelValue', v: AssetMeta[]): void
  /** 第卌二轮 REQ-061：HTML 上传成功（含替换），meta 为新 HTML 附件；replacedOld 为被替换的旧 HTML（无则 null） */
  (e: 'html-added', meta: AssetMeta, replacedOld: AssetMeta | null): void
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

// ---- 类型判定（扩展名兜底 file.type 缺失） ----
// R80（R13）：判定抽到共享工具，供本地文件导入复用——两处口径必须只有一份实现
const guessKind = guessAssetKind
function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

// ---- 上传 ----
function onPick() { fileInput.value?.click() }
async function onFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  // ⚠ 第卌一轮修复：必须先快照 FileList 再清空 input.value —— 设置 value='' 会重置 FileList，
  // 旧代码先存引用后清空导致真实上传链路 100% 静默失败（注入式验证绕过了此链路故未暴露）
  const files = Array.from(input.files || [])
  input.value = ''
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
      if (!kind) { showToast(`⚠ 仅支持图片 / HTML / PDF 文件，已跳过：${f.name.slice(0, 24)}`); continue }
      // REQ-061：图片 ≤10MB（独立上限）；PDF ≤100MB（第卌四轮拍板）；HTML 沿宿主 maxSizeMB
      const limitMB = kind === 'image' ? IMG_MAX_MB : kind === 'pdf' ? PDF_MAX_MB : props.maxSizeMB
      if (f.size > limitMB * 1024 * 1024) { showToast(`⚠ ${f.name.slice(0, 24)} 超过 ${limitMB}MB 上限，已跳过`); continue }
      // REQ-061：单卡图片 ≤9 张，超额拒绝
      if (kind === 'image') {
        if (imgQuota <= 0) { showToast(`⚠ 图片数量已达上限 ${IMG_MAX_COUNT} 张，已跳过：${f.name.slice(0, 24)}`); continue }
        imgQuota--
      }
      const id = uid('at')
      try {
        await putAsset(id, f)
      } catch (err) {
        console.error('[assets] putAsset failed:', err)
        showToast(`⚠ 附件写入失败：${f.name.slice(0, 24)}`)
        continue
      }
      const meta: AssetMeta = { id, kind, name: f.name, size: f.size, mime: f.type || (kind === 'image' ? 'image/png' : kind === 'pdf' ? 'application/pdf' : 'text/html'), createdAt: Date.now() }
      // 第卌四轮 T-08：HTML/PDF 单卡唯一（拍板 q-1=替换旧的）——删除旧同类附件本体并从列表移除
      if (isDocKind(kind)) {
        const olds = list.value.filter(a => a.kind === kind)
        for (const old of olds) {
          try { await deleteAsset(old.id) } catch (err) { console.error('[assets] replace old doc delete failed:', err) }
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
      showToast(`✓ 已上传 ${added.length} 个附件（${fmtSize(added.reduce((s, a) => s + a.size, 0))}${docPart}）`)
    }
  } finally {
    busy.value = false
  }
}

// ---- 删除单个 ----
async function removeAsset(meta: AssetMeta) {
  try {
    await deleteAsset(meta.id)
  } catch (err) {
    // 第卌一轮 REQ-057：业务吞错收敛——本体删除失败必须让用户知道（meta 已软删但 Blob 残留 = 孤儿）
    console.error('[assets] deleteAsset failed:', err)
    showToast('⚠ 附件本体删除失败，可到「设置 · 数据管理」清理孤儿')
  }
  emitList(list.value.filter(a => a.id !== meta.id))
  showToast('🗑 附件已移除')
}

// ---- 打开（图片弹窗多图预览 / HTML file:// 完整打开） ----
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
        const b = await getAssetBlob(im.id)
        if (b) urls.push(URL.createObjectURL(b))
        else urls.push('')
      } catch { urls.push('') }
    }
    const valid = urls.filter(Boolean)
    if (!valid.length) { showToast('⚠ 附件本体缺失（可能已被清理），请重新上传'); return }
    closeViewer()
    imageUrls.value = urls
    viewerOpen.value = true
    showImageAt(idx >= 0 ? idx : 0)
  } else {
    // 第卌二轮 REQ-058 + 第卌四轮 T-08：HTML/PDF file:// 落盘完整打开（复用既有副本；失败降级 blob）
    await openHtmlAsset(meta)
  }
}
</script>

<template>
  <div class="am">
    <div v-if="list.length" class="am-list">
      <div v-for="a in list" :key="a.id" class="am-item" :title="`${a.name}（${fmtSize(a.size)}）`">
        <span class="am-ico">{{ a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📕' : '🧾' }}</span>
        <span class="am-name" @click="openAsset(a)">{{ a.name }}</span>
        <span class="am-size">{{ fmtSize(a.size) }}</span>
        <span class="am-open" @click="openAsset(a)" :title="a.kind === 'image' ? '弹窗预览' : '新标签页打开'">{{ a.kind === 'image' ? '👁' : '↗' }}</span>
        <span class="am-del" @click="removeAsset(a)" title="移除附件">×</span>
      </div>
    </div>
    <button class="am-add" :class="{ busy }" :disabled="busy" @click="onPick">
      {{ busy ? '⏳ 上传中…' : '📎 添加附件（图片 / HTML / PDF）' }}
    </button>
    <input ref="fileInput" type="file" class="am-file" multiple accept="image/*,.html,.htm,.pdf" @change="onFilesChange" />
    <div class="am-tip">图片 ≤9 张（单张 ≤10MB）弹窗预览可左右切换；HTML 单卡 1 个（≤20MB，重复上传=替换）；PDF 单卡 1 份（≤100MB，重复上传=替换），新标签页打开</div>

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
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; font-size: 12px;
}
.am-item:hover { border-color: var(--border-strong); }
.am-ico { flex-shrink: 0; font-size: 12px; }
.am-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); cursor: pointer; }
.am-name:hover { color: var(--accent); text-decoration: underline; }
.am-size { flex-shrink: 0; font-size: 10.5px; color: var(--text-3); }
.am-open { flex-shrink: 0; cursor: pointer; font-size: 12px; opacity: .65; }
.am-open:hover { opacity: 1; }
.am-del { flex-shrink: 0; cursor: pointer; color: var(--text-3); font-size: 14px; line-height: 1; padding: 0 2px; }
.am-del:hover { color: var(--danger); }
.am-add {
  padding: 6px 10px; border: 1px dashed var(--border-strong); border-radius: 6px; background: transparent;
  color: var(--text-2); font-size: 11.5px; cursor: pointer; font-family: inherit; transition: all .15s;
}
.am-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.am-add.busy { opacity: .6; cursor: default; }
.am-file { display: none; }
.am-tip { font-size: 10.5px; color: var(--text-3); line-height: 1.5; }
</style>
