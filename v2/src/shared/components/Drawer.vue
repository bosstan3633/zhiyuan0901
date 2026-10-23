<script lang="ts">
import { ref as vueRef } from 'vue'

/*
 * 全局抽屉栈必须声明在普通 <script> 的模块作用域。
 * 若写在 <script setup>，Vue 会把声明编进每个组件实例的 setup()；
 * 三层下钻时每个 Drawer 各持一份栈，Esc 就无法只关最上层。
 */
let drawerSeq = 0
const drawerStack = vueRef<number[]>([])
</script>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { saveUIPrefs } from '@/shared/storage/repository'
import Icon from '@/shared/components/Icon.vue'
import { useOverlayTarget } from '@/shared/utils/overlayHost'
import { useFocusTrap } from '@/shared/utils/focusTrap'

// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()

/**
 * 全局抽屉栈：同一时刻只让最上层响应 Esc。
 *
 * 为什么不能继续“每个 Drawer 各自挂 document 捕获监听”：
 * 项目详情 → 指标详情 → 任务详情会同时挂三个 open Drawer，三个监听都在 document 上；
 * stopPropagation 挡不住同一节点更早注册的监听，一次 Esc 会连关三层。
 *
 * 栈按挂载顺序记录实例 id；open 时入栈，close/unmount 时出栈。
 * 只有栈顶实例处理 Esc。这样无需宿主逐个传 closeOnEscape，也不会改变现有单抽屉行为。
 */
const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  /** G1 迁移（V3.8.25）：抽屉标题的图标标记走 prop 而不是塞进 title 字符串 ——
   *  title 是纯文本，组件插不进组件；原做法是把 emoji 写进 title（📄 资源卡详情），
   *  迁移时 emoji 被剥掉只留下孤儿空格。icon 由壳统一渲染，四主题自动换色。 */
  icon?: string
  width?: string
  /** R169-老账③：body 附加类——宿主态样式（如镜像只读 .dr-readonly）挂到 .drawer-body 上，
   *  让 Workspace 自绘 .drawer 退役、两代抽屉容器合并为一代（Drawer.vue 唯一壳） */
  bodyClass?: string
  /** V3.9.1：上层评审弹窗在场时，宿主可暂时关闭 Esc 关闭，避免一次 Esc 连关两层。 */
  closeOnEscape?: boolean
  /** 可选的独立宽度记忆键；不传则沿用全站共用的 drawerWs.shared。 */
  widthStorageKey?: string
}>(), {
  /* Boolean prop 缺省为 false。不显式给 true，会让所有没传该 prop 的抽屉
     默认失去 Esc；只有 AI 弹窗在场时，任务详情才传 false 让位。 */
  closeOnEscape: true
})
const emit = defineEmits<{ close: [] }>()
const drawerId = ++drawerSeq
/** 栈深决定层级：后开的抽屉必须盖住先开的，而 Teleport 的 DOM 顺序不等于打开顺序 */
const stackDepth = computed(() => Math.max(0, drawerStack.value.indexOf(drawerId)))
const overlayZ = computed(() => `calc(var(--z-overlay) + ${stackDepth.value * 2})`)
const drawerZ = computed(() => `calc(var(--z-overlay) + ${stackDepth.value * 2 + 1})`)
const panelRef = ref<HTMLElement | null>(null)

// R170-②：详情抽屉全局统一拖宽（拍板：所有卡片详情页可左右拖拽 + 记忆）。
// 落点选共享壳 = 一处改、7 处宿主（资源/项目/好奇/指标下钻/添加任务/策展钻取/北极星）同时生效。
// 记忆口径 = 全局一个键 `UIPrefs.drawerWs.shared`（不按抽屉分键）；TaskDetailDrawer 的自有拖拽
// （drawerWs.task，先于本机制存在）保持不动。夹住 420 ~ min(0.85vw, 960)，双击把手复位默认宽。
const store = useAppStore()
const defaultW = computed(() => parseInt(props.width || '', 10) || 440)
const savedWidth = computed(() => props.widthStorageKey
  ? store.ui?.drawerWs?.[props.widthStorageKey]
  : store.ui?.drawerWs?.shared)
const w = ref(savedWidth.value || defaultW.value)
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
  const key = props.widthStorageKey || 'shared'
  if (store.ui) store.ui.drawerWs = { ...(store.ui.drawerWs || {}), [key]: w.value }
  saveUIPrefs({ drawerWs: store.ui?.drawerWs || { shared: w.value } })
}
function resetWidth() { w.value = defaultW.value; endResize() }
watch(() => props.widthStorageKey, () => {
  w.value = savedWidth.value || defaultW.value
})

// 第卅一轮修复：Esc 关闭抽屉（open 期间 document 级捕获监听，任何焦点下生效——此前抽屉不响应 Esc）
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) return
  if (drawerStack.value[drawerStack.value.length - 1] !== drawerId) return
  if (props.closeOnEscape === false) return
  e.stopPropagation()
  /* Hand top-of-stack to the next drawer immediately. The host writes open=false
     only after the leave transition, so waiting would swallow later Esc presses. */
  syncStack(false)
  emit('close')
}
function syncStack(open: boolean) {
  const at = drawerStack.value.indexOf(drawerId)
  if (open) {
    if (at < 0) drawerStack.value.push(drawerId)
    else {
      drawerStack.value.splice(at, 1)
      drawerStack.value.push(drawerId)
    }
    return
  }
  if (at >= 0) drawerStack.value.splice(at, 1)
}
// R157：补 `immediate: true`。现网 14 个宿主都是常驻挂载（`:open` 响应式），不补也能工作；
// 但只要未来出现 `v-if` 条件挂载的宿主（组件出生时 open 已为 true），watch 等不到那次变化，
// Esc 监听就永不注册——与 R161 在 Modal.vue 实踩的坑同源（交付说明 §8.6）。1 行拆掉这个理论陷阱。
watch(() => props.open, (v) => {
  syncStack(v)
  if (v) document.addEventListener('keydown', onKey, true)
  else document.removeEventListener('keydown', onKey, true)
}, { immediate: true })
useFocusTrap(panelRef, () => props.open)
onUnmounted(() => {
  syncStack(false)
  document.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <Teleport :to="overlayTarget">
    <Transition name="overlay">
      <div v-if="open" class="drawer-overlay" :style="{ zIndex: overlayZ }" @click="emit('close')"></div>
    </Transition>
    <Transition name="drawer">
      <aside v-if="open" ref="panelRef" class="drawer" :class="{ dragging }" :style="{ width: w + 'px', zIndex: drawerZ }"
        tabindex="-1" role="dialog" aria-modal="true" :aria-label="title || '详情'">
        <!-- R170-②：左缘拖宽把手（双击复位默认宽） -->
        <div class="drawer-resize" title="拖拽调宽 · 双击复位" @mousedown="startResize" @dblclick="resetWidth" />
        <header class="drawer-header">
          <!-- R167：可选 title 插槽——把"就地可编辑主标题 + kicker"放进头部，
               正文里就不再重复一份标题（现状是头部一份只读、正文一份 textarea，同屏两处且头部那份长标题被截断）。
               不给插槽的宿主照旧渲染 {{ title }}，19 个既有抽屉零影响。 -->
          <div class="drawer-title"><Icon v-if="icon" :name="icon" :size="14" class="drawer-title-icon"/><slot name="title">{{ title }}</slot></div>
          <!-- 第卌一轮 REQ-054：标题右侧扩展区（附件徽章等） -->
          <div v-if="$slots['title-extra']" class="drawer-title-extra"><slot name="title-extra" /></div>
          <button class="drawer-close" type="button" aria-label="关闭" title="关闭（Esc）" @click="emit('close')">×</button>
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
.drawer-title { font-size: var(--fs-title); font-weight: 600; flex: 1; color: var(--text); display: flex; align-items: center; gap: 7px; }
.drawer-title-icon { color: var(--text-3); flex-shrink: 0; }
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
