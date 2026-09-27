<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
import { ref, computed, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { saveUIPrefs } from '@/shared/storage/repository'
const props = defineProps<{
  open: boolean
  title?: string
  width?: string
  /** R169-老账③：body 附加类——宿主态样式（如镜像只读 .dr-readonly）挂到 .drawer-body 上，
   *  让 Workspace 自绘 .drawer 退役、两代抽屉容器合并为一代（Drawer.vue 唯一壳） */
  bodyClass?: string
}>()
const emit = defineEmits<{ close: [] }>()

// R170-②：详情抽屉全局统一拖宽（拍板：所有卡片详情页可左右拖拽 + 记忆）。
// 落点选共享壳 = 一处改、7 处宿主（资源/项目/好奇/指标下钻/添加任务/策展钻取/北极星）同时生效。
// 记忆口径 = 全局一个键 `UIPrefs.drawerWs.shared`（不按抽屉分键）；TaskDetailDrawer 的自有拖拽
// （drawerWs.task，先于本机制存在）保持不动。夹住 420 ~ min(0.85vw, 960)，双击把手复位默认宽。
const store = useAppStore()
const defaultW = computed(() => parseInt(props.width || '', 10) || 440)
const w = ref(store.ui?.drawerWs?.shared || defaultW.value)
const dragging = ref(false)
const W_MIN = 420
const W_MAX = 960
function clampW(v: number) { return Math.round(Math.min(W_MAX, Math.max(W_MIN, Math.min(window.innerWidth * 0.85, v)))) }
let dragStartX = 0
let dragStartW = 0
function startResize(e: MouseEvent) {
  dragStartX = e.clientX; dragStartW = w.value; dragging.value = true
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', endResize)
  e.preventDefault()
}
function onResizeMove(e: MouseEvent) { w.value = clampW(dragStartW + (dragStartX - e.clientX)) }
function endResize() {
  dragging.value = false
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', endResize)
  if (store.ui) store.ui.drawerWs = { ...(store.ui.drawerWs || {}), shared: w.value }
  saveUIPrefs({ drawerWs: store.ui?.drawerWs || { shared: w.value } })
}
function resetWidth() { w.value = defaultW.value; endResize() }

// 第卅一轮修复：Esc 关闭抽屉（open 期间 document 级捕获监听，任何焦点下生效——此前抽屉不响应 Esc）
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close') }
}
// R157：补 `immediate: true`。现网 14 个宿主都是常驻挂载（`:open` 响应式），不补也能工作；
// 但只要未来出现 `v-if` 条件挂载的宿主（组件出生时 open 已为 true），watch 等不到那次变化，
// Esc 监听就永不注册——与 R161 在 Modal.vue 实踩的坑同源（交付说明 §8.6）。1 行拆掉这个理论陷阱。
watch(() => props.open, (v) => {
  if (v) document.addEventListener('keydown', onKey, true)
  else document.removeEventListener('keydown', onKey, true)
}, { immediate: true })
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport :to="overlayTarget">
    <Transition name="overlay">
      <div v-if="open" class="drawer-overlay" @click="emit('close')"></div>
    </Transition>
    <Transition name="drawer">
      <aside v-if="open" class="drawer" :class="{ dragging }" :style="{ width: w + 'px' }">
        <!-- R170-②：左缘拖宽把手（双击复位默认宽） -->
        <div class="drawer-resize" title="拖拽调宽 · 双击复位" @mousedown="startResize" @dblclick="resetWidth" />
        <header class="drawer-header">
          <!-- R167：可选 title 插槽——把"就地可编辑主标题 + kicker"放进头部，
               正文里就不再重复一份标题（现状是头部一份只读、正文一份 textarea，同屏两处且头部那份长标题被截断）。
               不给插槽的宿主照旧渲染 {{ title }}，19 个既有抽屉零影响。 -->
          <div class="drawer-title"><slot name="title">{{ title }}</slot></div>
          <!-- 第卌一轮 REQ-054：标题右侧扩展区（附件徽章等） -->
          <div v-if="$slots['title-extra']" class="drawer-title-extra"><slot name="title-extra" /></div>
          <button class="drawer-close" @click="emit('close')">×</button>
        </header>
        <div class="drawer-body" :class="bodyClass">
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
  z-index: var(--z-overlay);
}
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  background: var(--surface);
  z-index: calc(var(--z-overlay) + 1);
  box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
  max-width: 92vw;
}
.drawer-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 10px;
}
.drawer-title { font-size: var(--fs-title); font-weight: 600; flex: 1; color: var(--text); }
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
.drawer-footer { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 8px; }
/* R170-②：左缘拖宽把手 + 拖拽期状态（禁文本选区/过渡，跟手） */
.drawer-resize { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 5; touch-action: none; }
.drawer-resize:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.drawer.dragging { transition: none; user-select: none; }
.drawer.dragging .drawer-body { pointer-events: none; }

.overlay-enter-active, .overlay-leave-active { transition: opacity var(--dur-slow); }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.drawer-enter-active, .drawer-leave-active { transition: transform .3s var(--ease-emphasis); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
/* R169-老账③：reduced-motion 随合并统一到壳上（原 Workspace 自绘 dr-* 过渡在 workspace.css 有同款守卫） */
@media (prefers-reduced-motion: reduce) { .drawer-enter-active, .drawer-leave-active { transition: none; } }
</style>
