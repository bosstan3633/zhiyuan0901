/**
 * Content Script · 选区捕获（第廿二轮加固；V2.21 抽取为独立模块）
 *
 * 为什么独立成模块：
 *   content script 以 `all_frames: true` 注入所有帧，但**只有顶层帧会渲染浮层**，
 *   子帧（iframe）的全部职责就是"捕获选区 → 转发给顶层"。
 *   把这段逻辑抽出来，子帧就只需加载本模块（几 KB），
 *   不必再为浮层实现与拼音字典付出体积代价。
 *
 * 设计约定：
 *   - 监听注册收敛在 initSelectionCapture()，幂等，只注册一次
 *   - 浮层实现层只读不写监听；需要清空缓存时用 clearSelCache()
 */

export const IS_TOP = (() => { try { return window.top === window } catch { return false } })()

interface SelCache {
  text: string
  title: string
  url: string
  at: number
}

let selCache: SelCache = { text: '', title: '', url: '', at: 0 }
let selCacheTimer: ReturnType<typeof setTimeout> | null = null

/** 读取当前 window 选区（含 range 兜底） */
export function getSelectionText(): string {
  const sel = window.getSelection?.()
  if (!sel) return ''
  const direct = sel.toString().trim()
  if (direct) return direct
  try {
    let out = ''
    for (let i = 0; i < sel.rangeCount; i++) out += sel.getRangeAt(i).toString()
    return out.trim()
  } catch {
    return ''
  }
}

export function getSelCache(): Readonly<SelCache> {
  return selCache
}

export function clearSelCache(): void {
  selCache = { text: '', title: '', url: '', at: 0 }
}

/**
 * 打开浮层时取值：缓存优先。
 * 缓存是"选中当下"捕获的，不受后续任何清选行为影响（这是第廿二轮的核心加固）。
 */
export function resolveSelection(): string {
  return selCache.text || getSelectionText()
}

/**
 * 注册选区捕获监听（幂等）。
 *  - 每个帧（含 iframe）在 mouseup / keyup / selectionchange 时捕获最近非空选区
 *  - 子帧通过 postMessage 转发给顶层；顶层汇聚到 selCache
 *  - 点击页面其他位置 = 放弃当前选区（缓存清空）
 */
export function initSelectionCapture(): void {
  if ((window as any).__zySelInited) return
  ;(window as any).__zySelInited = true

  const captureSel = (): void => {
    const t = (window.getSelection?.()?.toString() || '').trim()
    if (t) {
      selCache = { text: t, title: document.title || '', url: location.href, at: Date.now() }
      if (!IS_TOP) {
        try {
          window.top?.postMessage({ __zy_sel: { text: t, title: selCache.title, url: selCache.url } }, '*')
        } catch { /* 跨源 frame 不可达，忽略 */ }
      }
    }
  }

  document.addEventListener('mouseup', captureSel, true)
  document.addEventListener('keyup', captureSel, true)
  document.addEventListener(
    'selectionchange',
    () => {
      if (selCacheTimer) clearTimeout(selCacheTimer)
      selCacheTimer = setTimeout(captureSel, 120)
    },
    true
  )
  // 点击页面其他位置 = 放弃当前选区
  document.addEventListener('mousedown', () => { selCache.text = '' }, true)

  if (IS_TOP) {
    // R53-E3：接收子帧选区转发——targetOrigin 无法枚举（跨源帧 origin 各异），改为接收侧消毒：
    // 仅接受字符串字段 + 长度截断，恶意页面可伪造的只是一段"选区预填文本"，不触达任何特权 API
    const clip = (v: unknown, cap: number): string =>
      typeof v === 'string' ? v.slice(0, cap) : ''
    window.addEventListener('message', (e: MessageEvent) => {
      const d0 = e.data as { __zy_sel?: { text?: unknown; title?: unknown; url?: unknown } } | null
      const text = clip(d0?.__zy_sel?.text, 8000)
      if (!d0 || !d0.__zy_sel || !text) return
      selCache = {
        text,
        title: clip(d0.__zy_sel.title, 512),
        url: clip(d0.__zy_sel.url, 2048),
        at: Date.now()
      }
    })
  }
}
