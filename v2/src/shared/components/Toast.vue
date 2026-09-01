<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
const actionLabel = ref('')
let actionCb: (() => void) | null = null
let timer: ReturnType<typeof setTimeout>

/** B2：show(msg) 或 show(msg, { label, cb })——带操作按钮时 5 秒驻留（如「撤销」） */
function show(msg: string, action?: { label: string; cb: () => void }) {
  message.value = msg
  actionLabel.value = action?.label || ''
  actionCb = action?.cb || null
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => visible.value = false, action ? 5000 : 2500)
}
function runAction() {
  actionCb?.()
  visible.value = false
}

defineExpose({ show })
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="toast">
      {{ message }}
      <span v-if="actionLabel" class="toast-action" @click="runAction">{{ actionLabel }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  /* 固定深色底：任何主题下都保证白字可读（修复深色主题白底白字问题） */
  background: #1A1D23;
  color: #fff;
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
