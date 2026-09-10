/**
 * 第卅六轮 REQ-039：极简事件总线（避免引入 mitt）。
 * 事件：'zy-open-drawer'，payload = DrawerPayload
 */
export interface DrawerPayload {
  /** 资源卡 / 任务卡 / 好奇心卡 / 项目 / 策展台 */
  kind: 'res' | 'task' | 'curio' | 'project' | 'ws'
  id: string
}

export type DrawerListener = (p: DrawerPayload) => void

const listeners = new Set<DrawerListener>()

export function onOpenDrawer(fn: DrawerListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitOpenDrawer(p: DrawerPayload): void {
  listeners.forEach((fn) => { try { fn(p) } catch (e) { console.error('[bus] drawer handler error:', e) } })
}
