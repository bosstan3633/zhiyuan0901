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
export type DrawerClosedListener = (p: DrawerPayload) => void

const listeners = new Set<DrawerListener>()
const closedListeners = new Set<DrawerClosedListener>()

export function onOpenDrawer(fn: DrawerListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitOpenDrawer(p: DrawerPayload): void {
  listeners.forEach((fn) => { try { fn(p) } catch (e) { console.error('[bus] drawer handler error:', e) } })
}

/**
 * 详情抽屉关闭回流：附件管理等旁路视图据此刷新卡片最新状态。
 * 关闭事件与打开事件使用同一 payload，宿主可只订阅自己关心的卡型。
 */
export function onDrawerClosed(fn: DrawerClosedListener): () => void {
  closedListeners.add(fn)
  return () => closedListeners.delete(fn)
}

export function emitDrawerClosed(p: DrawerPayload): void {
  closedListeners.forEach((fn) => { try { fn(p) } catch (e) { console.error('[bus] drawer close handler error:', e) } })
}

/** R160（P1）：详情抽屉按需挂载——挂载前的首个事件暂存，抽屉就绪后自取自开（异步组件加载期间不丢事件） */
let pendingDrawer: DrawerPayload | null = null
export function setPendingDrawer(p: DrawerPayload): void { pendingDrawer = p }
export function consumePendingDrawer(): DrawerPayload | null { const p = pendingDrawer; pendingDrawer = null; return p }

/**
 * R172-T11（04-67 F31/F32）：页面内呼出全局浮层面板。
 * 为什么单开一条通道：扩展快捷键那套走 `chrome.runtime.sendMessage`，而**同文档自发的消息不会回到自己**
 * （MV3 语义），仪表盘里的「生成任务」需要的是同一件事的本地触发。
 */
export interface PanelPayload {
  name: 'search' | 'capture' | 'curio' | 'taskcapture' | 'shortcuts'
  /** 预填快速采集任务（用户仍可改后再存 ⇒ 采纳权在用户，AI 不替决策） */
  prefill?: { title?: string; description?: string }
}

type PanelListener = (p: PanelPayload) => void
const panelListeners = new Set<PanelListener>()

export function onOpenPanel(fn: PanelListener): () => void {
  panelListeners.add(fn)
  return () => panelListeners.delete(fn)
}

export function emitOpenPanel(p: PanelPayload): void {
  panelListeners.forEach((fn) => { try { fn(p) } catch (e) { console.error('[bus] panel handler error:', e) } })
}
