/**
 * R48-A1：运行时错误留痕（zy_error_log）
 *
 * 背景：TDZ 类崩溃（Cannot access 'J' before initialization）高频但无法稳定复现，
 * 堆栈只存在于用户现场 F12。本模块把 window.error / unhandledrejection 全量落盘
 * chrome.storage.local（独立键，不进主 JSON），上限 50 条滚动淘汰。
 * 设置页「操作记录」可一键导出，用户无需开 F12 即可提供完整堆栈定位根因。
 *
 * 注意：本文件被 main.ts 顶部最先 import——TDZ 崩溃多发于模块初始化期，
 * 监听器必须早于一切业务模块注册才接得住。
 */
import { K } from '@/shared/storage/keys'

export interface RuntimeErrorEntry {
  ts: number
  message: string
  stack: string
  /**
   * `render` = Vue 错误边界接住的渲染崩溃。**它不会触发 window.error**
   * （`onErrorCaptured` 里 `return false` 已终止冒泡，Vue 只 console.error），
   * 所以边界必须显式调 `recordRuntimeError` —— 否则 TDZ 那类崩溃恰好一条都不落盘（R173-1 修的就是这个断链）。
   */
  source: 'error' | 'unhandledrejection' | 'render'
  route: string
}

export const ERROR_LOG_KEY = K.ERROR_LOG
const ERROR_LOG_CAP = 50

function chromeStore(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

export async function readErrorLog(): Promise<RuntimeErrorEntry[]> {
  try {
    const cs = chromeStore()
    if (!cs) return []
    const cur = (await cs.get([ERROR_LOG_KEY]))[ERROR_LOG_KEY]
    return Array.isArray(cur) ? (cur as RuntimeErrorEntry[]) : []
  } catch { return [] }
}

export async function clearErrorLog(): Promise<void> {
  try { await chromeStore()?.set({ [ERROR_LOG_KEY]: [] }) } catch { /* 忽略 */ }
}

/**
 * R173-1b：订阅错误日志条数变化（仪表盘「运行错误 N」徽章实时刷新用）。
 * 原来徽章只在 setup 与「切进仪表盘面板」时各读一次 —— 同文档内的 hash 切换不触发 watch，
 * 本会话新崩的错误要等到下一次换页才看得见（探针实测漏刷新）。返回取消订阅函数。
 */
export function subscribeErrorLog(fn: (count: number) => void): () => void {
  const cs = chromeStore()
  if (!cs?.onChanged) return () => { /* 无扩展存储的环境（单测/预览）静默降级 */ }
  const handler = (ch: Record<string, chrome.storage.StorageChange>): void => {
    const change = ch[ERROR_LOG_KEY]
    if (!change) return
    fn(Array.isArray(change.newValue) ? (change.newValue as RuntimeErrorEntry[]).length : 0)
  }
  cs.onChanged.addListener(handler)
  return () => cs.onChanged.removeListener(handler)
}

let lastMessage = ''
let lastAt = 0

async function pushEntry(entry: RuntimeErrorEntry): Promise<void> {
  try {
    const cs = chromeStore()
    if (!cs) return
    const cur = await readErrorLog()
    cur.push(entry)
    const trimmed = cur.length > ERROR_LOG_CAP ? cur.slice(cur.length - ERROR_LOG_CAP) : cur
    await cs.set({ [ERROR_LOG_KEY]: trimmed })
  } catch { /* 日志失败静默 */ }
}

function record(source: RuntimeErrorEntry['source'], message: string, stack: string): void {
  // 同一条错误 1 秒内去重（Vue 渲染错误可能同时触发 error + onErrorCaptured）
  const now = Date.now()
  if (message === lastMessage && now - lastAt < 1000) return
  lastMessage = message
  lastAt = now
  let route = ''
  try { route = location.hash || location.href } catch { /* 忽略 */ }
  void pushEntry({ ts: now, message: String(message || '').slice(0, 500), stack: String(stack || '').slice(0, 4000), source, route })
}

/** 给 Vue 错误边界用：`onErrorCaptured` 里调这一条，渲染崩溃才会进 `zy_error_log` */
export function recordRuntimeError(message: string, stack: string): void {
  record('render', message, stack)
}

/** 尽早注册全局错误监听（main.ts 顶部调用） */
export function installRuntimeErrorCapture(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (e) => {
    record('error', e.message || 'unknown error', e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`)
  }, true)
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    record('unhandledrejection', r?.message || String(r || 'unhandled rejection'), r?.stack || '')
  })
}
