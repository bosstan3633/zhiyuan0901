<script setup lang="ts">
/** REQ-030：Toast 收敛为全局单例——本组件仅负责渲染，状态/计时由 toast.ts 单例持有 */
import { toastState, runToastAction } from './toast'
</script>

<template>
  <Transition name="toast">
    <div v-if="toastState.visible.value" class="toast">
      {{ toastState.message.value }}
      <span v-if="toastState.action.value" class="toast-action" @click="runToastAction">{{ toastState.action.value.label }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  /* R118（T5）：固定深色底收敛为共享令牌 --solid-bg / --solid-fg（任何主题下都保证白字可读） */
  background: var(--solid-bg);
  color: var(--solid-fg);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 9999;
  box-shadow: 0 8px 28px rgba(0,0,0,.2);
  display: flex;
  align-items: center;
  gap: 8px;
}
.toast-action {
  color: #8FC4A3;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 10px;
  border: 1px solid rgba(143,196,163,.5);
  border-radius: 6px;
}
.toast-action:hover { background: rgba(143,196,163,.15); }
.toast-enter-active, .toast-leave-active {
  transition: all .25s cubic-bezier(.16,1,.3,1);
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
