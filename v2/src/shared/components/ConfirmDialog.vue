<script setup lang="ts">
import { useOverlayTarget } from '@/shared/utils/overlayHost'
// R113-N5：Teleport 目标动态化——金字塔真全屏期间浮层挂进全屏元素（否则不可见）
const overlayTarget = useOverlayTarget()
/** B28：全局确认弹窗（居中美观，Esc=取消，Enter=确认，主题令牌适配） */
import { onMounted, onUnmounted } from 'vue'
import { confirmState, resolveConfirm } from './confirm'
function onKey(e: KeyboardEvent) {
  if (!confirmState.open) return
  if (e.key === 'Escape') { e.preventDefault(); resolveConfirm(false) }
  else if (e.key === 'Enter') { e.preventDefault(); resolveConfirm(true) }
}
onMounted(() => document.addEventListener('keydown', onKey, true))
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport :to="overlayTarget">
    <Transition name="cdf">
      <div v-if="confirmState.open" class="cdf-mask" @click="resolveConfirm(false)">
        <div class="cdf-box" @click.stop>
          <div class="cdf-icon" :class="{ danger: confirmState.danger }">{{ confirmState.danger ? '🗑' : '❓' }}</div>
          <div class="cdf-title">{{ confirmState.title }}</div>
          <div class="cdf-msg">{{ confirmState.message }}</div>
          <div class="cdf-btns">
            <button class="cdf-btn cancel" @click="resolveConfirm(false)">{{ confirmState.cancelText }}</button>
            <button class="cdf-btn ok" :class="{ danger: confirmState.danger }" @click="resolveConfirm(true)">{{ confirmState.confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cdf-mask { position: fixed; inset: 0; z-index: var(--z-confirm); background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; }
.cdf-box { width: 360px; max-width: 92vw; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 24px 24px 20px; text-align: center; animation: cdfin .2s var(--ease-emphasis); }
@keyframes cdfin { from { opacity: 0; transform: translateY(-10px) scale(.96); } to { opacity: 1; transform: none; } }
.cdf-icon { width: 52px; height: 52px; margin: 0 auto 12px; border-radius: 50%; background: var(--tag-danger-bg); color: var(--tag-danger-text); font-size: var(--fs-display); display: flex; align-items: center; justify-content: center; }
.cdf-icon:not(.danger) { background: var(--accent-light); color: var(--accent-ink); }
.cdf-title { font-size: var(--fs-title); font-weight: 700; color: var(--text); margin-bottom: 8px; }
.cdf-msg { font-size: var(--fs-body); color: var(--text-2); line-height: 1.7; white-space: pre-line; }
.cdf-btns { display: flex; gap: 10px; margin-top: 20px; }
.cdf-btn { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; color: var(--text-2); transition: all var(--dur); }
.cdf-btn.cancel:hover { border-color: var(--border-strong); color: var(--text); }
.cdf-btn.ok { background: var(--accent); color: #fff; border-color: var(--accent); }
.cdf-btn.ok:hover { background: var(--accent-hover); }
.cdf-btn.ok.danger { background: var(--danger); border-color: var(--danger); }
.cdf-btn.ok.danger:hover { background: color-mix(in srgb, var(--danger) 85%, black); }
.cdf-enter-active, .cdf-leave-active { transition: opacity .18s; }
.cdf-enter-from, .cdf-leave-to { opacity: 0; }
</style>
