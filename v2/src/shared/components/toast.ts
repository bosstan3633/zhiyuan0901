/**
 * 全局 Toast 单例（第卅四轮 REQ-030 收敛 → R146 第一刀改队列）
 * 收敛三套实现（shared/Toast.vue 实例、Workspace 内建、GlobalPopups 内建）为模块级单例：
 * - 任意组件 import { showToast } 即可调用，无需挂 ref / 维护组件实例
 * - 全局仅由 App.vue 挂载一个 <Toast /> 渲染
 * - REQ-030：统一 3 秒驻留（撤销入口 3 秒后关闭）
 *
 * R146（回退契约）：原实现是**一条 message 覆盖上一条**——批量恢复 N 条只剩最后一条回执，
 * 且撤销按钮随覆盖一起消失（"刚发生了什么"被物理截断）。改为最多堆叠 3 条的队列：
 * 同文案连发合并成一条并计数（×N），各条独立计时、独立撤销。
 */
import { ref } from 'vue'

export interface ToastAction { label: string; cb: () => void }
export interface ToastItem { id: number; msg: string; action: ToastAction | null; n: number }

/** REQ-030：统一 3 秒（原三套实现 5s/2.5s/2s 不一致） */
const TOAST_DURATION = 3000
/** R146：最多同时可见 3 条，超出时最旧一条让位 */
const TOAST_STACK = 3

const items = ref<ToastItem[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let seq = 0

function drop(id: number) {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
  if (items.value.some(x => x.id === id)) items.value = items.value.filter(x => x.id !== id)
}
function arm(it: ToastItem) {
  const prev = timers.get(it.id)
  if (prev) clearTimeout(prev)
  timers.set(it.id, setTimeout(() => drop(it.id), TOAST_DURATION))
}

export function showToast(msg: string, act?: ToastAction) {
  const last = items.value[items.value.length - 1]
  // 同文案且同动作语义 → 合并计数并重置该条计时（批量循环里不再刷屏）
  if (last && last.msg === msg && !!last.action === !!act && (last.action?.label || '') === (act?.label || '')) {
    last.n++
    arm(last)
    return
  }
  const it: ToastItem = { id: ++seq, msg, action: act || null, n: 1 }
  items.value = [...items.value, it]
  while (items.value.length > TOAST_STACK) drop(items.value[0]!.id)
  arm(it)
}

export function runToastAction(it: ToastItem) {
  it.action?.cb()
  drop(it.id)
}

/** 供渲染层消费：items 为可见队列（旧→新） */
export const toastState = { get items() { return items.value }, dismiss: drop }
