/** 生成唯一 ID */
export function uid(prefix = 'id'): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 日期键 YYYY-MM-DD */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 周一日期键 */
export function weekStartKey(dk: string): string {
  const d = new Date(dk)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return dateKey(d)
}

/** HTML 转义 */
export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c)
  )
}

/** URL 归一化：host 小写 + 去 UTM + 去锚点 + 规范尾部斜杠 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hostname = u.hostname.toLowerCase()
    u.hash = ''
    const utmPrefixes = ['utm_', 'spm', 'from', 'gclid', 'fbclid']
    u.searchParams.forEach((_, key) => {
      if (utmPrefixes.some((p) => key.startsWith(p))) u.searchParams.delete(key)
    })
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    u.pathname = path
    return u.toString()
  } catch {
    return raw.trim()
  }
}

/** 生成 URL 指纹（用于去重） */
export function urlFingerprint(url: string): string {
  const normalized = normalizeUrl(url)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return 'fp_' + Math.abs(hash).toString(36)
}

/** 防抖 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

/** 限流（节流） */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let last = 0
  return ((...args: unknown[]) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    }
  }) as T
}

/** H1：工作台快捷键有效映射——显式 hotkey 优先，其余按顺序自动分配 2-9（1 保留给知源引擎） */
export function effectiveWsHotkeys(workspaces: { id: string; hotkey?: number }[]): Map<string, number> {
  const used = new Set<number>()
  const explicit = new Map<string, number>()
  for (const w of workspaces) {
    if (w.hotkey && w.hotkey >= 2 && w.hotkey <= 9) { explicit.set(w.id, w.hotkey); used.add(w.hotkey) }
  }
  const map = new Map<string, number>()
  let next = 2
  for (const w of workspaces) {
    if (explicit.has(w.id)) { map.set(w.id, explicit.get(w.id)!); continue }
    while (used.has(next) && next <= 9) next++
    if (next <= 9) { map.set(w.id, next); used.add(next) }
    next++
  }
  return map
}

/** 第廿九轮：URL 编码文本解码（容错）——修复书签导入等场景把 percent-encoding 存为名称的乱码 */
export function safeDecodeText(s: string): string {
  if (!s || !/%[0-9A-Fa-f]{2}/.test(s)) return s
  try {
    const dec = decodeURIComponent(s)
    return dec === s ? s : safeDecodeText(dec)
  } catch {
    return s
  }
}
