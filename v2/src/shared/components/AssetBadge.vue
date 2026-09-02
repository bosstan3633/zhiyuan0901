<script setup lang="ts">
/**
 * 第卌轮 REQ-051：卡片正面附件徽章（资源/任务/好奇心卡片三视图共用）
 * - 显示：图片附件 🖼 n / HTML 附件 🧾 n 分组计数徽章（n=数量，卡片正面一眼可见挂了几图几 HTML）
 * - 交互：点击徽章 → 文件列表浮层；点单条 → 图片弹窗预览 / HTML 新标签打开（与 AssetManager 同行为）
 * - 样式：全部走 tokens.css 令牌；徽章点击 stopPropagation，不触发宿主卡片的单击/双击
 * - 说明：图片预览 viewer 与 AssetManager.vue 为同款逻辑独立实现（第卌轮暂不重构共享，
 *   避免牵动 R39 附件回归断言；后续可再抽公共 viewer 组件收敛两处）
 */
import { ref, computed } from 'vue'
import type { AssetMeta } from '@/shared/models'
import { getAssetBlob } from '@/shared/storage/assets'
import { showToast } from '@/shared/components/toast'

const props = withDefaults(defineProps<{
  assets?: AssetMeta[] | null
}>(), {
  assets: null
})

const list = computed<AssetMeta[]>(() => props.assets || [])
const imgCount = computed(() => list.value.filter(a => a.kind === 'image').length)
const htmlCount = computed(() => list.value.length - imgCount.value)
const has = computed(() => list.value.length > 0)

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

// ---- 文件列表浮层 ----
const listOpen = ref(false)
function openList() { if (has.value) listOpen.value = true }
function closeList() { listOpen.value = false }

// ---- 打开（图片弹窗 / HTML 新标签），同 AssetManager ----
const viewerOpen = ref(false)
const viewerUrl = ref('')
const viewerName = ref('')
let lastViewerUrl = ''
function revokeViewer() {
  if (lastViewerUrl) { try { URL.revokeObjectURL(lastViewerUrl) } catch { /* noop */ } lastViewerUrl = '' }
}
function closeViewer() { viewerOpen.value = false; revokeViewer() }

async function openAsset(meta: AssetMeta) {
  closeList()
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
  <span v-if="has" class="ab" title="点击查看附件" @click.stop="openList" @dblclick.stop>
    <span v-if="imgCount" class="ab-chip ab-img">🖼 {{ imgCount }}</span>
    <span v-if="htmlCount" class="ab-chip ab-html">🧾 {{ htmlCount }}</span>
  </span>

  <!-- 文件列表浮层 -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="listOpen" class="ab-pop" @click.self="closeList">
        <div class="ab-pop-box">
          <div class="ab-pop-head">
            <span class="ab-pop-title">📎 附件（{{ list.length }}）</span>
            <button class="ab-pop-close" @click="closeList">×</button>
          </div>
          <div class="ab-pop-body">
            <div v-for="a in list" :key="a.id" class="ab-item" :title="`${a.name}（${fmtSize(a.size)}）`" @click="openAsset(a)">
              <span class="ab-ico">{{ a.kind === 'image' ? '🖼' : '🧾' }}</span>
              <span class="ab-name">{{ a.name }}</span>
              <span class="ab-size">{{ fmtSize(a.size) }}</span>
              <span class="ab-go" :title="a.kind === 'image' ? '弹窗预览' : '新标签页打开'">{{ a.kind === 'image' ? '👁' : '↗' }}</span>
            </div>
            <div v-if="!list.length" class="ab-empty">无附件</div>
          </div>
        </div>
      </div>
    </Transition>
    <!-- 图片预览弹窗 -->
    <Transition name="fade">
      <div v-if="viewerOpen" class="ab-viewer" @click.self="closeViewer">
        <div class="ab-viewer-box">
          <div class="ab-viewer-head">
            <span class="ab-viewer-name" :title="viewerName">{{ viewerName }}</span>
            <button class="ab-viewer-close" @click="closeViewer">×</button>
          </div>
          <img class="ab-viewer-img" :src="viewerUrl" alt="" @keydown.esc="closeViewer" />
        </div>
      </div>
    </Transition>
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

.ab-viewer {
  position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,.72);
  display: flex; align-items: center; justify-content: center; padding: 32px;
}
.ab-viewer-box {
  max-width: min(92vw, 1080px); max-height: 92vh; display: flex; flex-direction: column;
  background: var(--surface); border-radius: 12px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.45);
}
.ab-viewer-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  background: var(--surface-2); border-bottom: 1px solid var(--border);
}
.ab-viewer-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text); }
.ab-viewer-close {
  border: none; background: transparent; color: var(--text-2); font-size: 20px; cursor: pointer; line-height: 1;
  padding: 2px 6px; border-radius: 4px;
}
.ab-viewer-close:hover { color: var(--text); background: var(--surface-3); }
.ab-viewer-img {
  display: block; max-width: 100%; max-height: calc(92vh - 44px); object-fit: contain;
  background: repeating-conic-gradient(#1a1a1e 0 25%, #26262b 0 50%) 0 0 / 22px 22px;
}
</style>
