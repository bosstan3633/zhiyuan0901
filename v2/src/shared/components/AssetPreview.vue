<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
/**
 * 第卌一轮 REQ-056：附件图片预览公共 viewer（技术债收敛）
 * 原 AssetManager.vue 与 AssetBadge.vue 各自内嵌一份「Teleport + 全屏弹窗 + Esc/遮罩关闭 + 图片渲染」
 * （结构逐行一致，双份 ~110 行）。本组件收拢为单份，两处共用。
 *
 * 第卌二轮 REQ-061 升级：多图左右切换——宿主传 hasPrev/hasNext/posLabel，
 * 组件渲染 ‹ › 箭头 + 「n/N」计数，键盘 ←/→ 触发 prev/next（宿主更新 url）。
 * 不传导航 props 时为单图模式，行为与 V2.17 完全一致（向后兼容）。
 *
 * 用法（宿主持有打开状态机与图片序列）：
 *   <AssetPreview :open="viewerOpen" :url="viewerUrl" :name="viewerName"
 *     :has-prev="imageIdx > 0" :has-next="imageIdx < imageUrls.length - 1"
 *     :pos-label="`${imageIdx + 1}/${imageUrls.length}`"
 *     @close="closeViewer" @prev="showImageAt(imageIdx - 1)" @next="showImageAt(imageIdx + 1)" />
 */
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  /** 是否显示 */
  open: boolean
  /** blob URL */
  url: string
  /** 附件名（标题栏展示） */
  name: string
  /** 可选：是否可切上一张（多图模式） */
  hasPrev?: boolean
  /** 可选：是否可切下一张（多图模式） */
  hasNext?: boolean
  /** 可选：位置标签如「2/9」 */
  posLabel?: string
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
  else if (e.key === 'ArrowLeft' && props.open && props.hasPrev) emit('prev')
  else if (e.key === 'ArrowRight' && props.open && props.hasNext) emit('next')
}
// 弹窗期间监听 Esc / ←→（捕获阶段，避免与宿主输入冲突）
watch(() => props.open, (v) => {
  if (v) document.addEventListener('keydown', onKey, true)
  else document.removeEventListener('keydown', onKey, true)
})
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport :to="overlayTarget">
    <Transition name="fade">
    <div v-if="open" class="ap-viewer" data-a11y-container @click.self="emit('close')">
        <div class="ap-viewer-box">
          <div class="ap-viewer-head">
            <span class="ap-viewer-name" :title="name">{{ name }}</span>
            <span v-if="posLabel" class="ap-viewer-pos">{{ posLabel }}</span>
            <button class="ap-viewer-close" @click="emit('close')">×</button>
          </div>
          <div class="ap-viewer-stage">
            <button v-if="hasPrev" class="ap-viewer-nav ap-viewer-prev" title="上一张（←）" @click="emit('prev')">‹</button>
            <img class="ap-viewer-img" :src="url" alt="" />
            <button v-if="hasNext" class="ap-viewer-nav ap-viewer-next" title="下一张（→）" @click="emit('next')">›</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ap-viewer {
  position: fixed; inset: 0; z-index: var(--z-media-top); background: rgba(0,0,0,.72);
  display: flex; align-items: center; justify-content: center; padding: 32px;
}
.ap-viewer-box {
  max-width: min(92vw, 1080px); max-height: 92vh; display: flex; flex-direction: column;
  background: var(--surface); border-radius: 12px; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.45);
}
.ap-viewer-head {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  background: var(--surface-2); border-bottom: 1px solid var(--border);
}
.ap-viewer-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-body); color: var(--text); }
.ap-viewer-pos { flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-3); font-variant-numeric: tabular-nums; }
.ap-viewer-close {
  border: none; background: transparent; color: var(--text-2); font-size: 20px; cursor: pointer; line-height: 1;
  padding: 2px 6px; border-radius: 4px;
}
.ap-viewer-close:hover { color: var(--text); background: var(--surface-3); }
.ap-viewer-stage { position: relative; display: flex; align-items: center; justify-content: center; }
.ap-viewer-img {
  display: block; max-width: 100%; max-height: calc(92vh - 44px); object-fit: contain;
  background: repeating-conic-gradient(#1a1a1e 0 25%, #26262b 0 50%) 0 0 / 22px 22px;
}
.ap-viewer-nav {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 40px; height: 64px; border: none; border-radius: 8px;
  background: rgba(0,0,0,.45); color: #fff; font-size: 30px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background var(--dur);
}
.ap-viewer-nav:hover { background: rgba(0,0,0,.7); }
.ap-viewer-prev { left: 8px; }
.ap-viewer-next { right: 8px; }
</style>
