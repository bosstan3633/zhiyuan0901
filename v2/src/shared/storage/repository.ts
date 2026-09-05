/**
 * 数据存储层 · 封装 chrome.storage.local
 * 所有数据读写通过此模块，提供响应式订阅
 */
import type { AppData, UIPrefs } from '@/shared/models'
import { STORAGE_KEY, UI_KEY } from '@/shared/models'
import { createDefaultData } from './defaults'
import { safeDecodeText } from '@/shared/utils'
// 第卌四轮 T-05：卡片操作事件日志——保存链路快照 diff 自动产出 create/delete/restore/purge
import { rebuildEventSnapshot, flushCardEvents } from '@/shared/utils/eventLog'

type Listener = (data: AppData) => void
type ErrorListener = (err: SaveError) => void

/** 第卅六轮 REQ-038：保存失败事件总线（配额超限 / 序列化失败 / 未知 IO 错误） */
export interface SaveError {
  at: number
  kind: 'quota' | 'serial' | 'unknown'
  message: string
  bytesInUse?: number
}

let cache: AppData | null = null
const listeners = new Set<Listener>()
const errorListeners = new Set<ErrorListener>()
let lastSaveError: SaveError | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

// REQ-031 P-031-6：自身写入标记——saveData/saveDataNow 前置 selfWrite，onChanged 回调跳过全树替换
let selfWriteAt = 0
export function isSelfWrite(at: number): boolean {
  return selfWriteAt > 0 && at <= selfWriteAt
}

function chromeStore(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

/** 加载数据（含首次初始化） */
export async function loadData(): Promise<AppData> {
  if (cache) return cache
  const cs = chromeStore()
  if (!cs) {
    cache = createDefaultData()
    return cache
  }
  const result = await cs.get([STORAGE_KEY])
  let data = result[STORAGE_KEY] as AppData | undefined
  if (!data) {
    data = createDefaultData()
    await cs.set({ [STORAGE_KEY]: data })
  }
  // N4：老数据补齐 tagTree 与任务/好奇心卡 tags 字段行
  if (!data.tagTree) data.tagTree = []
  // B35：卡片 tags 字段归一化——迁移/历史数据中存在非数组 tags（对象/数字等），
  // 会让 .includes/.join 崩溃（标签管理白屏、网页端搜索空白）。此处一次性修正并在下次 persist 固化。
  const fixTags = (cards: { tags?: unknown }[] | undefined) => (cards || []).forEach((c: { tags?: unknown }) => {
    if (!c) return
    if (!Array.isArray(c.tags)) {
      c.tags = typeof c.tags === 'string' && c.tags.trim()
        ? c.tags.split(/[,，、\s]+/).filter(Boolean)
        : []
    }
  })
  fixTags(data.resources as { tags?: unknown }[])
  fixTags(data.tasks as { tags?: unknown }[])
  fixTags(data.curiosities as { tags?: unknown }[])
  // 第廿九轮：分类名/标签名 URL 编码归一化——导入场景曾把 percent-encoding 的名称直接存库
  // （表现为界面上出现「%E5%AE%8B...」乱码分类）。此处一次性解码并在下次 persist 固化。
  const fixEncoded = (name: string): string => safeDecodeText(name);
  (data.categories || []).forEach(c => { if (c) c.name = fixEncoded(c.name) })
  const fixTagNames = (cards: { tags?: string[] }[] | undefined) => (cards || []).forEach(c => {
    if (!c || !Array.isArray(c.tags)) return
    c.tags = c.tags.map(t => (typeof t === 'string' ? fixEncoded(t) : t))
  })
  fixTagNames(data.resources as { tags?: string[] }[])
  fixTagNames(data.tasks as { tags?: string[] }[])
  fixTagNames(data.curiosities as { tags?: string[] }[])
  for (const key of ['task', 'curiosity'] as const) {
    if (data.fieldConfig?.[key] && !data.fieldConfig[key].some(f => f.key === 'tags')) {
      data.fieldConfig[key].push({ key: 'tags', label: '标签', type: 'tags', visible: false, order: data.fieldConfig[key].length })
    }
  }
  // 第卌轮 REQ-049：老数据字段配置补 assets（附件展示；字段目录 base 字段，目录化兜底迁移）
  for (const key of ['resource', 'task', 'curiosity'] as const) {
    if (data.fieldConfig?.[key] && !data.fieldConfig[key].some(f => f.key === 'assets')) {
      data.fieldConfig[key].push({ key: 'assets', label: '附件', type: 'text', visible: true, order: data.fieldConfig[key].length })
    }
  }
  cache = data
  // 第卌四轮 T-05：初始化快照（静默，不产生历史事件）
  rebuildEventSnapshot(data)
  markSaveOk()
  return data
}

/** 获取当前数据缓存（必须先 loadData） */
export function getData(): AppData {
  if (!cache) throw new Error('Data not loaded. Call loadData() first.')
  return cache
}

/** 保存数据（防抖 300ms，自动持久化） */
export function saveData(): void {
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    selfWriteAt = Date.now()
    // 第卌四轮 T-05：保存前快照 diff 产出操作事件（fire-and-forget，失败不影响主数据）
    if (cache) { try { flushCardEvents(cache) } catch { /* noop */ } }
    // V2.17.1 修复：JSON 纯净清洗后再入存储——reactive 树中可能残留 Vue Proxy（如编辑表单展开出的
    // assets Proxy 数组），chrome.storage 序列化 Proxy 时会把数组降级为类数组对象 {"0":…}，
    // 读回后 .length 为 undefined → 卡片正面附件徽章永不渲染。JSON round-trip 保证入存储永远是 plain 结构。
    const payload = { [STORAGE_KEY]: JSON.parse(JSON.stringify(cache)) }
    const p = cs!.set(payload)
    if (p && typeof (p as Promise<void>).then === 'function') {
      ;(p as Promise<void>)
        .then(() => {
          markSaveOk()
          if (lastSaveError) { lastSaveError = null; listeners.forEach((fn) => fn(cache!)) }
          listeners.forEach((fn) => fn(cache!))
        })
        .catch((e: unknown) => emitSaveError(e))
    } else {
      markSaveOk()
      listeners.forEach((fn) => fn(cache!))
    }
  }, 300)
}

/** 立即保存（用于关键操作） */
export async function saveDataNow(): Promise<void> {
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  selfWriteAt = Date.now()
  // 第卌四轮 T-05：同 saveData——保存前 diff 产出操作事件
  try { flushCardEvents(cache) } catch { /* noop */ }
  try {
    // V2.17.1 修复：同 saveData——JSON 纯净清洗防 reactive Proxy 泄漏入存储（数组降级类数组对象）
    await cs.set({ [STORAGE_KEY]: JSON.parse(JSON.stringify(cache)) })
    markSaveOk()
    if (lastSaveError) { lastSaveError = null }
    listeners.forEach((fn) => fn(cache!))
  } catch (e) {
    emitSaveError(e)
    throw e
  }
}

/** 第卅六轮 REQ-038：保存失败时分类告警（含最近一次写入的容量水位） */
function emitSaveError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)
  const kind: SaveError['kind'] =
    /quota|QUOTA_EXCEEDED|maxBytes/i.test(msg) ? 'quota' :
    /circular|JSON|stringify|serializ/i.test(msg) ? 'serial' : 'unknown'
  lastSaveError = { at: Date.now(), kind, message: msg }
  // 异步取一次当前已用字节（best-effort，配额错误才有意义，但容错写入）
  try {
    chromeStore()?.getBytesInUse?.((bytes) => {
      if (lastSaveError) lastSaveError.bytesInUse = bytes
      errorListeners.forEach((fn) => fn(lastSaveError!))
    })
  } catch {
    errorListeners.forEach((fn) => fn(lastSaveError!))
  }
}

/** 订阅保存失败事件（用于触发 Toast / 设置页红点 / 顶栏告警） */
export function subscribeSaveError(fn: ErrorListener): () => void {
  errorListeners.add(fn)
  if (lastSaveError) fn(lastSaveError)
  return () => errorListeners.delete(fn)
}

/** 取最近一次保存失败（用于设置页诊断） */
export function getLastSaveError(): SaveError | null { return lastSaveError }

/** R50-F2：最近一次成功写入时间戳（0 = 本次会话尚无成功写入；loadData 成功也会置位） */
let lastSaveOkAt = 0
export function getLastSaveOkAt(): number { return lastSaveOkAt }
function markSaveOk(): void { lastSaveOkAt = Date.now() }

/** 清除最近一次保存失败标记（恢复后调用） */
export function clearLastSaveError(): void { lastSaveError = null }

/** 第卅六轮 REQ-038：当前 chrome.storage.local 已用字节（同步回调包装成 Promise） */
export function getBytesInUse(): Promise<number> {
  return new Promise((resolve) => {
    const cs = chromeStore()
    if (!cs || !cs.getBytesInUse) return resolve(0)
    cs.getBytesInUse([STORAGE_KEY], (bytes) => resolve(bytes || 0))
  })
}

/** 第卅六轮 REQ-038：是否已申请 unlimitedStorage（直接读运行时 manifest，零依赖） */
export function hasUnlimitedStorage(): boolean {
  try {
    const m = (chrome as { runtime?: { getManifest?: () => { permissions?: string[] } } }).runtime?.getManifest?.()
    const perms = m?.permissions || []
    return Array.isArray(perms) && perms.includes('unlimitedStorage')
  } catch {
    return false
  }
}

/** 订阅数据变更 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 替换全部数据（导入用） */
export async function replaceData(newData: AppData): Promise<void> {
  cache = newData
  await saveDataNow()
}

/** 同步缓存引用（外部 storage 变更时调用，保持 cache 与最新数据一致） */
export function syncCache(newData: AppData): void {
  cache = newData
  // 第卌四轮 T-05：外部写入静默重建快照——事件由执行写入的上下文记录，避免双记
  rebuildEventSnapshot(newData)
}

// ============ UI 偏好 ============

let uiCache: UIPrefs | null = null

export async function loadUIPrefs(): Promise<UIPrefs> {
  if (uiCache) return uiCache
  const cs = chromeStore()
  const defaults: UIPrefs = {
    theme: 'linear',
    viewMode: 'card',
    tcSplitRatio: 50,
    wsSwitchMod: 'alt'
  }
  if (!cs) {
    uiCache = defaults
    return uiCache
  }
  const result = await cs.get([UI_KEY])
  uiCache = { ...defaults, ...(result[UI_KEY] as UIPrefs | undefined) }
  // O18：旧默认 ctrl 迁移为 alt
  if (uiCache.wsSwitchMod === 'ctrl') { uiCache.wsSwitchMod = 'alt'; saveUIPrefs({ wsSwitchMod: 'alt' }) }
  // 视觉重构（V2.3）：旧默认 green 一次性迁移为 linear（深空薰衣草）
  if (uiCache.theme === 'green') { uiCache.theme = 'linear'; saveUIPrefs({ theme: 'linear' }) }
  return uiCache
}

export function getUIPrefs(): UIPrefs {
  if (!uiCache) throw new Error('UI prefs not loaded.')
  return uiCache
}

export function saveUIPrefs(patch: Partial<UIPrefs>): void {
  if (!uiCache) return
  uiCache = { ...uiCache, ...patch }
  chromeStore()?.set({ [UI_KEY]: uiCache })
}
