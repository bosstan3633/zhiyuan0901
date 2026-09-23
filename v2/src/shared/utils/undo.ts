/**
 * R159（信任层 T1）：全局撤销栈。
 *
 * - 任何带「撤销」动作的 Toast 在弹出时自动入栈（由 toast.ts 统一登记，调用方零改造）；
 * - Ctrl/Cmd+Z 触发**最近一次**可撤销操作（窗口 UNDO_WINDOW_MS）；
 * - 焦点在输入框/可编辑区时不拦截（保留原生文本撤销）。
 */
export interface UndoEntry { label: string; cb: () => void; at: number }

/** R159：撤销窗口 3s → 9s（配合固定态批量回执） */
export const UNDO_WINDOW_MS = 9000
export const UNDO_STACK_CAP = 30

const stack: UndoEntry[] = []

export function pushUndo(label: string, cb: () => void): void {
  stack.push({ label, cb, at: Date.now() })
  while (stack.length > UNDO_STACK_CAP) stack.shift()
}

export function runLastUndo(): { ok: boolean; label?: string } {
  const now = Date.now()
  while (stack.length) {
    const e = stack.pop()!
    if (now - e.at <= UNDO_WINDOW_MS) {
      try { e.cb(); return { ok: true, label: e.label } } catch { return { ok: false } }
    }
  }
  return { ok: false }
}

let installed = false
export function installGlobalUndo(notify?: (msg: string) => void): void {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
    if (e.key !== 'z' && e.key !== 'Z') return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    e.preventDefault()
    const r = runLastUndo()
    if (r.ok) notify?.(`↩ 已撤销：${r.label}`)
    else notify?.('没有可撤销的操作（撤销窗口 9 秒）')
  }, true)
}
