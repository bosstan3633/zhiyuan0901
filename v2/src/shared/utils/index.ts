/** 生成唯一 ID（R70：优先 crypto.randomUUID——原实现「毫秒时间戳 + 6 位随机」在同毫秒批量创建/导入时存在碰撞可能） */
export function uid(prefix = 'id'): string {
  try {
    const c = globalThis.crypto as { randomUUID?: () => string } | undefined
    if (c && typeof c.randomUUID === 'function') {
      return prefix + '_' + c.randomUUID().replace(/-/g, '').slice(0, 16)
    }
  } catch { /* 降级到时间戳方案 */ }
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

/** 日期键 YYYY-MM-DD */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 周一日期键（R70：显式按**本地时区**构造日期）
 *  原实现 `new Date('YYYY-MM-DD')` 按 UTC 解析，再取本地 getDay()——东八区下会把当天的
 *  本地时间整体前移 8 小时，跨周边界（周一 00:00–08:00）会算错周起点，「本周」统计随之错位。 */
export function weekStartKey(dk: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dk || '')
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dk)
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

// R70：effectiveWsHotkeys 已下线（死代码）——R68 起应用内切台改由台签顺序推导
// （1=方向台、2=资源台、3 起=各策展台，见 App.vue switchToIndex），本函数自此无任何调用方。
// Workspace.hotkey 字段保留：老数据里可能有值，删字段会造成迁移噪音，但已不参与逻辑。

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
