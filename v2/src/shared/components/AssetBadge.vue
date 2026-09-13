<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
/**
 * 第卌轮 REQ-051：卡片正面附件徽章（资源/任务/好奇心卡片三视图共用）
 * - 显示：图片 🖼 n / PDF 📕 n / HTML 🧾 n 三档分组计数徽章（n=数量，卡片正面一眼可见各挂了几个）
 * - 交互：点击徽章 → 单个附件一击直达；多个 → 文件列表浮层；点单条 → 图片弹窗预览 / HTML·PDF 新标签打开（与 AssetManager 同行为）
 * - 样式：全部走 tokens.css 令牌；徽章点击 stopPropagation，不触发宿主卡片的单击/双击
 * - 说明：图片预览 viewer 与 AssetManager.vue 为同款逻辑独立实现（第卌轮暂不重构共享，
 *   避免牵动 R39 附件回归断言；后续可再抽公共 viewer 组件收敛两处）
 */
import { ref, computed } from 'vue'
import type { AssetMeta } from '@/shared/models'
import { getAssetBlob } from '@/shared/storage/assets'
import { showToast } from '@/shared/components/toast'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import AssetPreview from './AssetPreview.vue'

const props = withDefaults(defineProps<{
  assets?: AssetMeta[] | null
}>(), {
  assets: null
})

const list = computed<AssetMeta[]>(() => props.assets || [])
// R81（R15）：三档独立计数——改前 `htmlCount = list.length - imgCount` 把 PDF 算进了 HTML 档
const imgCount = computed(() => list.value.filter(a => a.kind === 'image').length)
const pdfCount = computed(() => list.value.filter(a => a.kind === 'pdf').length)
const htmlCount = computed(() => list.value.filter(a => a.kind === 'html').length)
const has = computed(() => list.value.length > 0)

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

// ---- R81（R15）：徽标单击分流 + 随数量变化的悬浮提示 ----
const badgeTitle = computed(() => {
  const n = list.value.length
  if (n <= 1) {
    const a = list.value[0]
    if (!a) return ''
    return a.kind === 'image' ? `${a.name} · 点击预览` : `${a.name} · 点击打开`
  }
  return `点击查看 ${n} 个附件`
})
/** 只有 1 个附件时不再弹列表——弹一个只有一行的列表是纯多一步 */
function onBadgeClick() {
  if (!has.value) return
  if (list.value.length === 1) { void openAsset(list.value[0]); return }
  openList()
}

// ---- 文件列表浮层 ----
const listOpen = ref(false)
function openList() { if (has.value) listOpen.value = true }
function closeList() { listOpen.value = false }

// ---- 打开（图片弹窗多图预览 / HTML file:// 完整打开），与 AssetManager 同行为 ----
const viewerOpen = ref(false)
const viewerUrl = ref('')
const viewerName = ref('')
/** 第卌二轮 REQ-061：多图左右切换 */
const imageUrls = ref<string[]>([])
const imageIdx = ref(0)
let lastViewerUrl = ''
function revokeViewer() {
  if (lastViewerUrl) { try { URL.revokeObjectURL(lastViewerUrl) } catch { /* noop */ } lastViewerUrl = '' }
}
function closeViewer() {
  viewerOpen.value = false
  for (const u of imageUrls.value) { try { URL.revokeObjectURL(u) } catch { /* noop */ } }
  imageUrls.value = []
  lastViewerUrl = ''
}
function showImageAt(i: number) {
  if (i < 0 || i >= imageUrls.value.length || !imageUrls.value[i]) return
  revokeViewer()
  imageIdx.value = i
  lastViewerUrl = imageUrls.value[i]
  viewerUrl.value = imageUrls.value[i]
  viewerName.value = list.value.filter(a => a.kind === 'image')[i]?.name || ''
}

async function openAsset(meta: AssetMeta) {
  closeList()
  if (meta.kind === 'image') {
    // 多图模式：一次性加载全部图片 blob，支持左右切换
    const imgs = list.value.filter(a => a.kind === 'image')
    const idx = Math.max(0, imgs.findIndex(a => a.id === meta.id))
    const urls: string[] = []
    for (const im of imgs) {
      try {
        const b = await getAssetBlob(im.id)
        urls.push(b ? URL.createObjectURL(b) : '')
      } catch { urls.push('') }
    }
    if (!urls.some(Boolean)) { showToast('⚠ 附件本体缺失（可能已被清理），请重新上传'); return }
    closeViewer()
    imageUrls.value = urls
    viewerOpen.value = true
    let at = idx >= 0 ? idx : 0
    if (!urls[at]) { const first = urls.findIndex(Boolean); at = first >= 0 ? first : 0 }
    showImageAt(at)
  } else {
    // 第卌二轮 REQ-058：file:// 落盘完整打开（复用既有副本；失败降级 blob）
    await openHtmlAsset(meta)
  }
}
</script>

<template>
  <span v-if="has" class="ab" :title="badgeTitle" @click.stop="onBadgeClick" @dblclick.stop>
    <span v-if="imgCount" class="ab-chip ab-img">🖼 {{ imgCount }}</span>
    <span v-if="pdfCount" class="ab-chip ab-pdf">📕 {{ pdfCount }}</span>
    <span v-if="htmlCount" class="ab-chip ab-html">🧾 {{ htmlCount }}</span>
  </span>

  <!-- 文件列表浮层 -->
  <Teleport :to="overlayTarget">
    <Transition name="fade">
      <div v-if="listOpen" class="ab-pop" @click.self="closeList">
        <div class="ab-pop-box">
          <div class="ab-pop-head">
            <span class="ab-pop-title">📎 附件（{{ list.length }}）</span>
            <button class="ab-pop-close" @click="closeList">×</button>
          </div>
          <div class="ab-pop-body">
            <div v-for="a in list" :key="a.id" class="ab-item" :title="`${a.name}（${fmtSize(a.size)}）`" @click="openAsset(a)">
              <span class="ab-ico">{{ a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📕' : '🧾' }}</span>
              <span class="ab-name">{{ a.name }}</span>
              <span class="ab-size">{{ fmtSize(a.size) }}</span>
              <span class="ab-go" :title="a.kind === 'image' ? '弹窗预览' : '新标签页打开'">{{ a.kind === 'image' ? '👁' : '↗' }}</span>
            </div>
            <div v-if="!list.length" class="ab-empty">无附件</div>
          </div>
        </div>
      </div>
    </Transition>
    <!-- 第卌一轮 REQ-056：图片预览弹窗抽公共组件 AssetPreview；第卌二轮 REQ-061 多图左右切换 -->
    <AssetPreview :open="viewerOpen" :url="viewerUrl" :name="viewerName"
      :has-prev="imageIdx > 0" :has-next="imageIdx < imageUrls.length - 1"
      :pos-label="imageUrls.length > 1 ? `${imageIdx + 1}/${imageUrls.length}` : ''"
      @close="closeViewer" @prev="showImageAt(imageIdx - 1)" @next="showImageAt(imageIdx + 1)" />
  </Teleport>
</template>

<style scoped>
.ab { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; vertical-align: middle; flex-shrink: 0; }
.ab-chip {
  display: inline-flex; align-items: center; gap: 2px; height: 18px; padding: 0 7px;
  border-radius: 99px; font-size: 10.5px; line-height: 1; white-space: nowrap;
  background: var(--surface-3); color: var(--text-2); border: 1px solid var(--border); transition: all .15s;
}
.ab-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.ab-img { }
.ab-pdf { }
.ab-html { }

.ab-pop {
  position: fixed; inset: 0; z-index: 2900; background: rgba(0,0,0,.38);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.ab-pop-box {
  width: min(420px, 92vw); max-height: min(70vh, 520px); display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  box-shadow: 0 18px 50px rgba(0,0,0,.35);
}
.ab-pop-head {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--surface-2); border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.ab-pop-title { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--text); }
.ab-pop-close {
  border: none; background: transparent; color: var(--text-2); font-size: 19px; cursor: pointer; line-height: 1;
  padding: 1px 6px; border-radius: 4px;
}
.ab-pop-close:hover { color: var(--text); background: var(--surface-3); }
.ab-pop-body { padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
.ab-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px; cursor: pointer;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; font-size: 12px; transition: all .12s;
}
.ab-item:hover { border-color: var(--accent); background: var(--accent-light); }
.ab-ico { flex-shrink: 0; font-size: 13px; }
.ab-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.ab-size { flex-shrink: 0; font-size: 10.5px; color: var(--text-3); }
.ab-go { flex-shrink: 0; font-size: 11px; opacity: .6; }
.ab-empty { padding: 16px; text-align: center; color: var(--text-3); font-size: 12px; }
</style>
