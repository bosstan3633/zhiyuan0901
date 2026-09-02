<script setup lang="ts">
/**
 * 第卌一轮 REQ-056：附件图片预览公共 viewer（技术债收敛）
 * 原 AssetManager.vue 与 AssetBadge.vue 各自内嵌一份「Teleport + 全屏弹窗 + Esc/遮罩关闭 + 图片渲染」
 * （结构逐行一致，双份 ~110 行）。本组件收拢为单份，两处共用。
 *
 * 用法（宿主持有打开状态机）：
 *   <AssetPreview :open="viewerOpen" :url="viewerUrl" :name="viewerName" @close="closeViewer" />
 */
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  /** 是否显示 */
  open: boolean
  /** blob URL */
  url: string
  /** 附件名（标题栏展示） */
  name: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
// 弹窗期间监听 Esc（捕获阶段，避免与宿主输入冲突）
watch(() => props.open, (v) => {
  if (v) document.addEventListener('keydown', onKey, true)
  else document.removeEventListener('keydown', onKey, true)
})
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="ap-viewer" @click.self="emit('close')">
        <div class="ap-viewer-box">
          <div class="ap-viewer-head">
            <span class="ap-viewer-name" :title="name">{{ name }}</span>
            <button class="ap-viewer-close" @click="emit('close')">×</button>
          </div>
          <img class="ap-viewer-img" :src="url" alt="" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ap-viewer {
  position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,.72);
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
.ap-viewer-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text); }
.ap-viewer-close {
  border: none; background: transparent; color: var(--text-2); font-size: 20px; cursor: pointer; line-height: 1;
  padding: 2px 6px; border-radius: 4px;
}
.ap-viewer-close:hover { color: var(--text); background: var(--surface-3); }
.ap-viewer-img {
  display: block; max-width: 100%; max-height: calc(92vh - 44px); object-fit: contain;
  background: repeating-conic-gradient(#1a1a1e 0 25%, #26262b 0 50%) 0 0 / 22px 22px;
}
</style>
