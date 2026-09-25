<script setup lang="ts">
/**
 * R161：中央弹窗壳 —— AI 评审（原右侧抽屉）的统一容器。
 *
 * 与 `Drawer.vue` 的关系（重要）：`Drawer.vue` 挂着**全站 30+ 抽屉宿主**，本组件**一字不动它**，
 * 是一个并列的新壳。二者共用同一套外部约定（`open` / `title` / `width` / `@close` +
 * `title-extra` / `footer` 插槽），所以对宿主而言换壳是零成本。
 *
 * 与既有 4 套 modal 私有实现（`itm-*` / `.modal` / `gs-modal-overlay` / `cz-modal-overlay`）的关系：
 * 本轮只搬 AI 评审；其余四套**不同批迁**（E2E 面会显著扩大），列后续轮次。
 *
 * 三条硬约束（每条都有前车之鉴）：
 *  ① `useOverlayTarget()`（R113-N5）**必须沿用** —— 金字塔真全屏时浮层若 Teleport 到 body 就不可见。
 *  ② Esc 走「document 捕获阶段 + `stopPropagation`」，与 `Drawer.vue` 同机制 —— 一次 Esc 只关一层。
 *  ③ 尺寸走 CSS 变量（`--md-w` / `--md-mh`）而非内联 width/height —— 内联样式会压过窄屏媒体查询，
 *     那样 <768 的全屏化就永远不生效。
 */
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useOverlayTarget } from '@/shared/utils/overlayHost'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  /** 宽度：默认 `min(1200px, 92vw)`；窄屏由媒体查询接管（<768 全屏） */
  width?: string
  /** 最大高度（默认 88vh；<768 全屏时由媒体查询接管） */
  maxHeight?: string
  /**
   * R167：通栏高度（默认只按内容；弹窗正文要"吃满剩余高度"时传 `100%`）。
   * 只加 `max-height` 不加 `height` ⇒ 不传这个 prop 的宿主（周报/回收站等）渲染结果一字不变。
   */
  height?: string
}>(), { title: '', width: 'min(1200px, 92vw)', maxHeight: '88vh', height: '' })
const emit = defineEmits<{ close: [] }>()

const overlayTarget = useOverlayTarget()
const panelRef = ref<HTMLElement | null>(null)
/** 打开前的焦点元素：关闭后还给它（键盘用户不丢锚点，R161 任务 6） */
let restoreTo: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  emit('close')
}
/**
 * ★ `immediate: true` 不可省（R161 实测，见交付说明 §8.6）：本壳的宿主一律**条件挂载**——
 *   `AiSuggestionDrawer` 自己的 `open` 就是 computed(() => !!props.job)，宿主又写
 *   `<AiSuggestionDrawer v-if="aiJob" …>`，于是组件**出生时 open 已是 true**，watch 永远等不到
 *   那次变化 ⇒ Esc 监听不注册、面板不聚焦（现象：点遮罩能关、按 Esc 毫无反应）。
 *   Drawer.vue 是同一写法、同一坑（它那边宿主也大量 v-if 挂载），本轮按"一字不动"未改它。
 */
watch(() => props.open, async (v) => {
  if (v) {
    restoreTo = (document.activeElement as HTMLElement | null)
    document.addEventListener('keydown', onKey, true)
    await nextTick()
    panelRef.value?.focus()
  } else {
    document.removeEventListener('keydown', onKey, true)
    if (restoreTo && document.contains(restoreTo)) restoreTo.focus()
    restoreTo = null
  }
}, { immediate: true })
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport :to="overlayTarget">
    <Transition name="md-fade">
      <div v-if="open" class="md-scrim" @click.self="emit('close')"></div>
    </Transition>
    <Transition name="md-pop">
      <section v-if="open" ref="panelRef" class="md-panel" tabindex="-1" role="dialog" aria-modal="true"
        :aria-label="title || undefined" :style="{ '--md-w': width, '--md-mh': maxHeight, '--md-h': height }">
        <header class="md-head">
          <div class="md-title"><slot name="title">{{ title }}</slot></div>
          <div v-if="$slots['title-extra']" class="md-title-extra"><slot name="title-extra" /></div>
          <button class="md-close" type="button" aria-label="关闭" title="关闭（Esc）" @click="emit('close')">×</button>
        </header>
        <div v-if="$slots.sub" class="md-sub"><slot name="sub" /></div>
        <div class="md-body"><slot /></div>
        <footer v-if="$slots.footer" class="md-foot"><slot name="footer" /></footer>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.md-scrim {
  position: fixed; inset: 0;
  background: var(--scrim-modal);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: var(--z-modal);
}
.md-panel {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: var(--md-w); max-width: 96vw; max-height: var(--md-mh); height: var(--md-h, auto);
  z-index: calc(var(--z-modal) + 1);
  display: flex; flex-direction: column;
  background: var(--surface); color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  outline: none;
}
.md-head {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.md-title {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: var(--sp-2);
  font-size: var(--fs-title); font-weight: 600; color: var(--text);
}
.md-title-extra { flex-shrink: 0; display: flex; align-items: center; gap: var(--sp-2); }
.md-close {
  width: 30px; height: 30px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: var(--radius-sm); background: transparent;
  cursor: pointer; color: var(--text-3); font-size: 18px; font-family: inherit;
  transition: background var(--dur), color var(--dur);
}
.md-close:hover { background: var(--surface-3); color: var(--text); }
.md-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
/* 头部下方的固定条（阶段指示等）：不参与滚动 */
.md-sub { flex-shrink: 0; padding: var(--sp-3) var(--sp-5) 0; }
.md-body { flex: 1; min-height: 0; overflow-y: auto; padding: var(--sp-5); }
/* 底部动作区：在滚动容器之外 ⇒ 天然 sticky，不需要 position:sticky 与 z-index 楼层 */
.md-foot {
  flex-shrink: 0;
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: var(--sp-2);
  background: var(--surface);
}
.md-foot:focus-within { box-shadow: inset 0 1px 0 0 var(--border); }

/* 进出场：fade + 2.5% 缩放，缓动走 R155 的强调曲线 */
.md-fade-enter-active, .md-fade-leave-active { transition: opacity var(--dur-slow) var(--ease-out-soft); }
.md-fade-enter-from, .md-fade-leave-to { opacity: 0; }
.md-pop-enter-active, .md-pop-leave-active {
  transition: opacity var(--dur-slow) var(--ease-emphasis), transform var(--dur-slow) var(--ease-emphasis);
}
.md-pop-enter-from, .md-pop-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.975); }

/* 响应式第二档：<768 全屏化（圆角归零、贴满四边） */
@media (max-width: 767px) {
  .md-panel {
    width: 100vw; max-width: 100vw; height: 100vh; max-height: 100vh;
    top: 0; left: 0; transform: none;
    border: none; border-radius: 0;
  }
  .md-pop-enter-from, .md-pop-leave-to { opacity: 0; transform: none; }
  .md-head, .md-body, .md-foot { padding-left: var(--sp-4); padding-right: var(--sp-4); }
  .md-sub { padding-left: var(--sp-4); padding-right: var(--sp-4); }
}

@media (prefers-reduced-motion: reduce) {
  .md-fade-enter-active, .md-fade-leave-active,
  .md-pop-enter-active, .md-pop-leave-active { transition: none; }
}
</style>
