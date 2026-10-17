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
import { pushUndo, UNDO_WINDOW_MS } from '../utils/undo'

export interface ToastAction { label: string; cb: () => void }
export interface ToastItem { id: number; msg: string; action: ToastAction | null; n: number; sticky?: boolean }
export interface ToastOpts { duration?: number; sticky?: boolean }

/** G5（V3.8.27）：默认驻留 3s → **2.4s**（回执是确认，不是阅读材料；2.4s 够扫一眼又不挡事） */
const TOAST_DURATION = 2400
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
function arm(it: ToastItem, duration = TOAST_DURATION) {
  const prev = timers.get(it.id)
  if (prev) clearTimeout(prev)
  if (duration <= 0) { timers.delete(it.id); return } // R159：sticky（批量回执）不自动消失
  timers.set(it.id, setTimeout(() => drop(it.id), duration))
}

/** R159：批量回执判定（删除≥2 / 整台 / 复数文案 → 固定不自动消失） */
function isBatchMsg(msg: string): boolean {
  return /已删除\s*\d+|已删\s*\d+|张资源卡|个任务|张卡|策展台/.test(msg)
}
export function showToast(msg: string, act?: ToastAction, opts?: ToastOpts) {
  // R159（T1）：带撤销动作 → 自动登记进全局撤销栈（Ctrl/Cmd+Z 可再触发，窗口 9s）
  if (act) pushUndo(msg, act.cb)
  const sticky = opts?.sticky ?? (!!act && isBatchMsg(msg))
  const duration = sticky ? 0 : (opts?.duration ?? (act ? UNDO_WINDOW_MS : TOAST_DURATION))
  const last = items.value[items.value.length - 1]
  // 同文案且同动作语义 → 合并计数并重置该条计时（批量循环里不再刷屏）
  if (last && last.msg === msg && !!last.action === !!act && (last.action?.label || '') === (act?.label || '')) {
    last.n++
    arm(last, duration)
    return
  }
  const it: ToastItem = { id: ++seq, msg, action: act || null, n: 1, sticky }
  items.value = [...items.value, it]
  while (items.value.length > TOAST_STACK) drop(items.value[0]!.id)
  arm(it, duration)
}

export function runToastAction(it: ToastItem) {
  it.action?.cb()
  drop(it.id)
}

/** 供渲染层消费：items 为可见队列（旧→新） */
export const toastState = { get items() { return items.value }, dismiss: drop }
