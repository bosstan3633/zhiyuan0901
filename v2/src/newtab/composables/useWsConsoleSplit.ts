/**
 * V4.7.1 F6：策展台顶部双栏拖拽（UIPrefs.wsConsoleSplit，左栏百分比）。
 * 实现自 views/Workspace.vue 原位迁出，零行为变更；标识符经解构保留原绑定——模板零改动。
 */
import { computed, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import type { UIPrefs } from '@/shared/models'

export interface WsConsoleSplitCtx {
  /** Pinia 的 UI 偏好；持久化仍走 saveUIPrefs 的原子 patch。 */
  store: { ui: UIPrefs | null }
}

export function useWsConsoleSplit(ctx: WsConsoleSplitCtx) {
  const { store } = ctx

  const WS_CONSOLE_SPLIT_MIN = 32
  const WS_CONSOLE_SPLIT_MAX = 72
  const WS_CONSOLE_SPLIT_DEFAULT = 62
  function clampWsConsoleSplit(value: number): number {
    if (!Number.isFinite(value)) return WS_CONSOLE_SPLIT_DEFAULT
    return Math.min(WS_CONSOLE_SPLIT_MAX, Math.max(WS_CONSOLE_SPLIT_MIN, Math.round(value)))
  }
  function readStoredConsoleSplit(): number {
    const stored = store.ui?.wsConsoleSplit
    return typeof stored === 'number' ? clampWsConsoleSplit(stored) : WS_CONSOLE_SPLIT_DEFAULT
  }
  const consoleRef = ref<HTMLElement | null>(null)
  const wsConsoleSplit = ref<number>(readStoredConsoleSplit())
  const consoleSplitStyle = computed(() => ({ '--ws-console-split': `${wsConsoleSplit.value}%` }))
  type ConsoleSplitDrag = { pointerId: number; startX: number; startSplit: number; trackWidth: number }
  let consoleSplitDrag: ConsoleSplitDrag | null = null

  function persistWsConsoleSplit() {
    saveUIPrefs({ wsConsoleSplit: wsConsoleSplit.value })
  }
  function applyStoredConsoleSplit() {
    wsConsoleSplit.value = readStoredConsoleSplit()
  }
  function startConsoleSplitDrag(e: PointerEvent) {
    if (e.button !== 0 || !consoleRef.value) return
    const box = consoleRef.value
    const style = getComputedStyle(box)
    const trackWidth = box.getBoundingClientRect().width
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    if (!(trackWidth > 0)) return
    consoleSplitDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startSplit: wsConsoleSplit.value,
      trackWidth,
    }
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* 指针已释放 */ }
    document.body.classList.add('ws-console-resizing')
  }
  function moveConsoleSplitDrag(e: PointerEvent) {
    if (!consoleSplitDrag || e.pointerId !== consoleSplitDrag.pointerId) return
    const delta = e.clientX - consoleSplitDrag.startX
    wsConsoleSplit.value = clampWsConsoleSplit(
      consoleSplitDrag.startSplit + (delta / consoleSplitDrag.trackWidth) * 100,
    )
  }
  function endConsoleSplitDrag(e: PointerEvent) {
    if (!consoleSplitDrag) return
    const drag = consoleSplitDrag
    consoleSplitDrag = null
    if (e.pointerId === drag.pointerId) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId) } catch { /* 指针已释放 */ }
      persistWsConsoleSplit()
    }
    document.body.classList.remove('ws-console-resizing')
  }
  function stopConsoleSplitDrag() {
    consoleSplitDrag = null
    document.body.classList.remove('ws-console-resizing')
  }
  function resetConsoleSplit() {
    wsConsoleSplit.value = WS_CONSOLE_SPLIT_DEFAULT
    persistWsConsoleSplit()
  }
  function onConsoleSplitKeydown(e: KeyboardEvent) {
    let next: number
    switch (e.key) {
      case 'ArrowLeft': next = wsConsoleSplit.value - 2; break
      case 'ArrowRight': next = wsConsoleSplit.value + 2; break
      case 'Home': next = WS_CONSOLE_SPLIT_MIN; break
      case 'End': next = WS_CONSOLE_SPLIT_MAX; break
      default: return
    }
    e.preventDefault()
    e.stopPropagation()
    wsConsoleSplit.value = clampWsConsoleSplit(next)
    persistWsConsoleSplit()
  }
  onDeactivated(stopConsoleSplitDrag)
  onMounted(() => {
    applyStoredConsoleSplit()
  })
  onUnmounted(stopConsoleSplitDrag)

  return {
    WS_CONSOLE_SPLIT_MIN, WS_CONSOLE_SPLIT_MAX,
    consoleRef, wsConsoleSplit, consoleSplitStyle,
    startConsoleSplitDrag, moveConsoleSplitDrag, endConsoleSplitDrag,
    resetConsoleSplit, onConsoleSplitKeydown,
  }
}
