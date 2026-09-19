<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
import { onUnmounted, watch } from 'vue'
const props = defineProps<{
  open: boolean
  title?: string
  width?: string
}>()
const emit = defineEmits<{ close: [] }>()
// 第卅一轮修复：Esc 关闭抽屉（open 期间 document 级捕获监听，任何焦点下生效——此前抽屉不响应 Esc）
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close') }
}
watch(() => props.open, (v) => {
  if (v) document.addEventListener('keydown', onKey, true)
  else document.removeEventListener('keydown', onKey, true)
})
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport :to="overlayTarget">
    <Transition name="overlay">
      <div v-if="open" class="drawer-overlay" @click="emit('close')"></div>
    </Transition>
    <Transition name="drawer">
      <aside v-if="open" class="drawer" :style="{ width: width || '440px' }">
        <header class="drawer-header">
          <div class="drawer-title">{{ title }}</div>
          <!-- 第卌一轮 REQ-054：标题右侧扩展区（附件徽章等） -->
          <div v-if="$slots['title-extra']" class="drawer-title-extra"><slot name="title-extra" /></div>
          <button class="drawer-close" @click="emit('close')">×</button>
        </header>
        <div class="drawer-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="drawer-footer">
          <slot name="footer" />
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.25);
  z-index: 200;
}
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  background: var(--surface);
  z-index: 201;
  box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
  max-width: 92vw;
}
.drawer-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 10px;
}
.drawer-title { font-size: 15px; font-weight: 600; flex: 1; color: var(--text); }
.drawer-title-extra { flex-shrink: 0; display: flex; align-items: center; }
.drawer-close {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; cursor: pointer; color: var(--text-3);
  font-size: 18px; border: none; background: transparent;
  transition: all var(--dur); font-family: inherit;
}
.drawer-close:hover { background: var(--surface-3); color: var(--text); }
.drawer-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.drawer-footer { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; }

.overlay-enter-active, .overlay-leave-active { transition: opacity var(--dur-slow); }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.drawer-enter-active, .drawer-leave-active { transition: transform .3s cubic-bezier(.4,0,.2,1); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
</style>
