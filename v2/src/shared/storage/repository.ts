/**
 * 数据存储层 · 封装 chrome.storage.local
 * 所有数据读写通过此模块，提供响应式订阅
 */
import type { AppData, UIPrefs } from '@/shared/models'
import { STORAGE_KEY, UI_KEY } from '@/shared/models'
import { createDefaultData } from './defaults'
import { safeDecodeText } from '@/shared/utils'

type Listener = (data: AppData) => void

let cache: AppData | null = null
const listeners = new Set<Listener>()
let saveTimer: ReturnType<typeof setTimeout> | null = null

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
  cache = data
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
    cs!.set({ [STORAGE_KEY]: cache! })
    listeners.forEach((fn) => fn(cache!))
  }, 300)
}

/** 立即保存（用于关键操作） */
export async function saveDataNow(): Promise<void> {
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  await cs.set({ [STORAGE_KEY]: cache })
  listeners.forEach((fn) => fn(cache!))
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
}

// ============ UI 偏好 ============

let uiCache: UIPrefs | null = null

export async function loadUIPrefs(): Promise<UIPrefs> {
  if (uiCache) return uiCache
  const cs = chromeStore()
  const defaults: UIPrefs = {
    theme: 'linear',
    viewMode: 'card',
    fieldViewCfg: {},
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
