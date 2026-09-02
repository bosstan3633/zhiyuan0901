<script setup lang="ts">
/**
 * 第卅九轮 REQ-048：卡片附件管理器（共享组件）
 * - 上传：图片 / 自包含 HTML（单文件 ≤ 20MB，可多选）→ 写入 IndexedDB zy_assets，meta 引用 emit 给父级
 * - 展示：附件 chip（图标+名称+大小），溢出省略
 * - 打开：图片 → 全屏弹窗预览（blob URL）；HTML → 新标签页打开（blob URL）
 * - 性能红线：主 JSON 只存 meta，Blob 本体永不进 JSON
 */
import { ref, computed } from 'vue'
import type { AssetMeta } from '@/shared/models'
import { putAsset, getAssetBlob, deleteAsset } from '@/shared/storage/assets'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import AssetPreview from './AssetPreview.vue'

const props = withDefaults(defineProps<{
  modelValue?: AssetMeta[] | null
  /** 单文件上限（MB） */
  maxSizeMB?: number
}>(), {
  modelValue: null,
  maxSizeMB: 20
})
const emit = defineEmits<{ (e: 'update:modelValue', v: AssetMeta[]): void }>()

const list = computed<AssetMeta[]>(() => props.modelValue || [])
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)

function emitList(next: AssetMeta[]) { emit('update:modelValue', next) }

// ---- 类型判定（扩展名兜底 file.type 缺失） ----
function guessKind(name: string, mime: string): 'image' | 'html' | null {
  if (/^image\//i.test(mime)) return 'image'
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(name)) return 'image'
  if (/\.html?$/i.test(name) || /\.htm$/i.test(name)) return 'html'
  return null
}
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
    for (const f of files) {
      const kind = guessKind(f.name, f.type)
      if (!kind) { showToast(`⚠ 仅支持图片或 HTML 文件，已跳过：${f.name.slice(0, 24)}`); continue }
      if (f.size > props.maxSizeMB * 1024 * 1024) { showToast(`⚠ ${f.name.slice(0, 24)} 超过 ${props.maxSizeMB}MB 上限，已跳过`); continue }
      const id = uid('at')
      try {
        await putAsset(id, f)
      } catch (err) {
        console.error('[assets] putAsset failed:', err)
        showToast(`⚠ 附件写入失败：${f.name.slice(0, 24)}`)
        continue
      }
      added.push({ id, kind, name: f.name, size: f.size, mime: f.type || (kind === 'image' ? 'image/png' : 'text/html'), createdAt: Date.now() })
    }
    if (added.length) {
      emitList([...list.value, ...added])
      showToast(`✓ 已上传 ${added.length} 个附件（${fmtSize(added.reduce((s, a) => s + a.size, 0))}）`)
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

// ---- 打开（图片弹窗 / HTML 新标签） ----
const viewerOpen = ref(false)
const viewerUrl = ref('')
const viewerName = ref('')
let lastViewerUrl = ''
function revokeViewer() {
  if (lastViewerUrl) { try { URL.revokeObjectURL(lastViewerUrl) } catch { /* noop */ } lastViewerUrl = '' }
}
function closeViewer() { viewerOpen.value = false; revokeViewer() }

async function openAsset(meta: AssetMeta) {
  let blob: Blob | null = null
  try { blob = await getAssetBlob(meta.id) } catch (err) { console.error('[assets] get failed:', err) }
  if (!blob) { showToast('⚠ 附件本体缺失（可能已被清理），请重新上传'); return }
  const url = URL.createObjectURL(blob)
  if (meta.kind === 'image') {
    revokeViewer()
    lastViewerUrl = url
    viewerName.value = meta.name
    viewerUrl.value = url
    viewerOpen.value = true
  } else {
    // HTML：新标签打开；blob URL 需延后回收（60s 足够页面加载）
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url })
      else window.open(url, '_blank')
    } catch (err) {
      console.error('[assets] open html failed:', err)
      showToast('⚠ 无法打开 HTML 附件')
    }
    setTimeout(() => { try { URL.revokeObjectURL(url) } catch { /* noop */ } }, 60000)
    showToast('已在新标签页打开（自包含 HTML 才能完整显示）')
  }
}
</script>

<template>
  <div class="am">
    <div v-if="list.length" class="am-list">
      <div v-for="a in list" :key="a.id" class="am-item" :title="`${a.name}（${fmtSize(a.size)}）`">
        <span class="am-ico">{{ a.kind === 'image' ? '🖼' : '🧾' }}</span>
        <span class="am-name" @click="openAsset(a)">{{ a.name }}</span>
        <span class="am-size">{{ fmtSize(a.size) }}</span>
        <span class="am-open" @click="openAsset(a)" :title="a.kind === 'image' ? '弹窗预览' : '新标签页打开'">{{ a.kind === 'image' ? '👁' : '↗' }}</span>
        <span class="am-del" @click="removeAsset(a)" title="移除附件">×</span>
      </div>
    </div>
    <button class="am-add" :class="{ busy }" :disabled="busy" @click="onPick">
      {{ busy ? '⏳ 上传中…' : '📎 添加附件（图片 / HTML，单文件 ≤ ' + maxSizeMB + 'MB）' }}
    </button>
    <input ref="fileInput" type="file" class="am-file" multiple accept="image/*,.html,.htm" @change="onFilesChange" />
    <div class="am-tip">图片点击弹窗预览；HTML 仅支持自包含单文件（引用外部 css/js/图片的页面需打包为单个文件）</div>

    <!-- 第卌一轮 REQ-056：图片预览弹窗抽公共组件 AssetPreview -->
    <AssetPreview :open="viewerOpen" :url="viewerUrl" :name="viewerName" @close="closeViewer" />
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
