/**
 * URL 身份归一化唯一实现。
 *
 * 资源卡去重、采集浮层、数据导入和移动端 Inbox 必须共用这一套口径，
 * 否则同一条链接会在不同写入路径得到不同指纹。
 */
const TRACKING_PARAM_PREFIXES = ['utm_', 'spm', 'from', 'gclid', 'fbclid'] as const

export function normalizeUrlKey(raw: string): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  try {
    const url = new URL(value)
    url.hostname = url.hostname.toLowerCase()
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM_PREFIXES.some(prefix => key.startsWith(prefix))) {
        url.searchParams.delete(key)
      }
    }
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.toString()
  } catch {
    return value
  }
}

/** 只有 http(s) 进入资源卡 URL 去重池；文件与 Obsidian 链接各有自己的身份规则。 */
export function canonicalHttpUrl(raw: string): string {
  const normalized = normalizeUrlKey(raw)
  if (!normalized) return ''
  try {
    const url = new URL(normalized)
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalized : ''
  } catch {
    return ''
  }
}
