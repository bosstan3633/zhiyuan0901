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

/** R160（P1）：详情抽屉按需挂载——挂载前的首个事件暂存，抽屉就绪后自取自开（异步组件加载期间不丢事件） */
let pendingDrawer: DrawerPayload | null = null
export function setPendingDrawer(p: DrawerPayload): void { pendingDrawer = p }
export function consumePendingDrawer(): DrawerPayload | null { const p = pendingDrawer; pendingDrawer = null; return p }
