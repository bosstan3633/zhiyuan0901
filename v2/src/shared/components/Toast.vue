<script setup lang="ts">
/**
 * REQ-030：Toast 收敛为全局单例——本组件仅负责渲染，状态/计时由 toast.ts 单例持有。
 * R146（回退契约）：改为**最多 3 条堆叠**（新在下、旧在上），每条自带撤销入口与计时；
 * 同文案连发由 toast.ts 合并成「×N」。原单条互相覆盖会让批量动作的回执被截断。
 * 底色/文字/动作色改走 --inverse-* 令牌（原写死 #1A1D23 + #8FC4A3，浅色主题下动作色对比仅 1.98:1）。
 */
import { toastState, runToastAction } from './toast'
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="toast-stack">
    <div v-for="t in toastState.items" :key="t.id" class="toast" role="status">
      <span class="toast-msg">{{ t.msg }}<b v-if="t.n > 1" class="toast-n"> ×{{ t.n }}</b></span>
      <span v-if="t.action" class="toast-action" @click="runToastAction(t)">{{ t.action.label }}</span>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.toast-stack { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; z-index: var(--z-toast); pointer-events: none; }
.toast {
  pointer-events: auto;
  display: flex; align-items: center; gap: 10px;
  background: var(--toast-bg); color: var(--toast-fg);
  padding: 9px 16px; border-radius: var(--radius-sm); font-size: var(--fs-body); line-height: 1.5;
  box-shadow: var(--shadow-lg); max-width: 72vw;
}
.toast-msg { white-space: pre-line; }
.toast-n { font-weight: 700; opacity: .7; margin-left: 2px; }
.toast-action {
  color: var(--toast-action); font-weight: 600; cursor: pointer; white-space: nowrap;
  padding: 2px 10px; border: 1px solid color-mix(in srgb, var(--toast-action) 50%, transparent); border-radius: var(--radius-xs);
}
.toast-action:hover { background: color-mix(in srgb, var(--toast-action) 16%, transparent); }
.toast-move, .toast-enter-active, .toast-leave-active { transition: all var(--dur) var(--ease-out-soft); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }
.toast-leave-active { position: absolute; }
</style>
