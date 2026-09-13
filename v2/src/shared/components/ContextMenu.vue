<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
/**
 * B5：统一右键菜单（fixed 定位，Esc/点击空白关闭）
 * 用法：<ContextMenu :state="menu" :items="items" @close="menu=null" />
 * items: { label, icon?, danger?, cb }[]
 */
import { onMounted, onUnmounted } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ state: { open: boolean; x: number; y: number }; items: { label: string; icon?: string; danger?: boolean; cb: () => void }[] }>()
const emit = defineEmits<{ close: [] }>()

function run(i: number) {
  props.items[i]?.cb()
  emit('close')
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKey, true))
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport :to="overlayTarget">
    <div v-if="state.open" class="ctx-mask" @click="emit('close')" @contextmenu.prevent="emit('close')" />
    <div v-if="state.open" class="ctx-menu-box" :style="{ left: state.x + 'px', top: state.y + 'px' }">
      <button v-for="(it, i) in items" :key="it.label" class="cx-item" :class="{ danger: it.danger }"
        @click.stop="run(i)">
        <Icon v-if="it.icon" :name="it.icon" :size="13" />{{ it.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-mask { position: fixed; inset: 0; z-index: 800; }
.ctx-menu-box { position: fixed; z-index: 801; min-width: 168px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); padding: 5px; animation: cxin .12s ease; }
@keyframes cxin { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: none; } }
.cx-item { width: 100%; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: none; background: transparent; border-radius: 6px; font-size: 12.5px; color: var(--text-2); cursor: pointer; font-family: inherit; text-align: left; }
.cx-item:hover { background: var(--surface-3); color: var(--text); }
.cx-item.danger { color: var(--danger); }
.cx-item.danger:hover { background: var(--tag-danger-bg); }
</style>
