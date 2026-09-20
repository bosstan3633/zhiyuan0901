/**
 * R140：链接正文抓取——「全方位优化」的眼睛。
 * 纪律（用户拍板）：仅 http(s) 白名单、点击才抓（本模块只在 job build 时被调）、
 * 会话级 Map 去重缓存、正文截断 ~1500 字、失败降级为 note（分析照常，注明读不到正文）。
 * 面：仅新标签页侧（扩展页有 <all_urls> host 权限，跨域 fetch 不受 CORS 拦截）。
 */

export interface LinkText { text: string; note?: string }

const MAX_CHARS = 1500
const FETCH_TIMEOUT_MS = 10000
const cache = new Map<string, LinkText>()

export function linkFetchable(url?: string): boolean {
  return !!url && /^https?:\/\//i.test(url)
}

export async function fetchLinkText(url: string): Promise<LinkText> {
  if (!linkFetchable(url)) return { text: '', note: '仅支持 http(s) 链接读取' }
  const hit = cache.get(url)
  if (hit) return hit
  const out = await grab(url)
  cache.set(url, out)
  return out
}

async function grab(url: string): Promise<LinkText> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', redirect: 'follow' })
    } finally { clearTimeout(timer) }
    if (!res.ok) return { text: '', note: `抓取失败：HTTP ${res.status}` }
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (/pdf|image|video|audio|octet/.test(ct)) return { text: '', note: `该链接是 ${ct.split(';')[0]}，暂不读取正文` }
    const body = (await res.text()).slice(0, 800_000)
    const raw = /^\s*<(!doctype|html|\w+)/i.test(body) ? htmlToText(body) : body
    const text = raw.replace(/\s*\n\s*/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
    if (!text) return { text: '', note: '正文为空（可能是纯 JS 渲染页）' }
    return text.length > MAX_CHARS ? { text: text.slice(0, MAX_CHARS), note: `正文已截断（原 ${text.length} 字）` } : { text }
  } catch (e) {
    return { text: '', note: '抓取失败：' + ((e as Error)?.name === 'AbortError' ? '超时 10s' : (e as Error).message || String(e)) }
  }
}

/** 只取主体文本：噪音标签整体移除，优先 main/article 容器 */
function htmlToText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script,style,noscript,svg,nav,header,footer,iframe,form,button,aside,[aria-hidden="true"]').forEach(el => el.remove())
    const main = doc.querySelector('main,article,[role="main"],#content,.content,.article-content,.post-content,.markdown') || doc.body
    return (main?.textContent || '').trim()
  } catch { return html.replace(/<[^>]*>/g, ' ').trim() }
}
