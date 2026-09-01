/**
 * 全局 Toast 单例（第卅四轮 REQ-030）
 * 收敛三套实现（shared/Toast.vue 实例、Workspace 内建、GlobalPopups 内建）为模块级单例：
 * - 任意组件 import { showToast } 即可调用，无需挂 ref / 维护组件实例
 * - 全局仅由 App.vue 挂载一个 <Toast /> 渲染
 * - REQ-030：统一 3 秒驻留（无论是否带操作按钮，撤销入口 3 秒后关闭）
 */
import { ref } from 'vue'

export interface ToastAction { label: string; cb: () => void }

const visible = ref(false)
const message = ref('')
const action = ref<ToastAction | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

/** REQ-030：统一 3 秒（原三套实现 5s/2.5s/2s 不一致） */
const TOAST_DURATION = 3000

export function showToast(msg: string, act?: ToastAction) {
  message.value = msg
  action.value = act || null
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { visible.value = false; action.value = null }, TOAST_DURATION)
}

export function runToastAction() {
  action.value?.cb()
  visible.value = false
  action.value = null
}

export const toastState = { visible, message, action }
