/**
 * 拼音/首字母搜索（第十九轮）
 * 基于 pinyin-pro；按标题缓存，避免重复转换。
 */
import { pinyin } from 'pinyin-pro'

const cache = new Map<string, { full: string; initials: string }>()

export function pinyinOf(text: string): { full: string; initials: string } {
  const hit = cache.get(text)
  if (hit) return hit
  try {
    const full = pinyin(text, { pattern: 'pinyin', toneType: 'none', type: 'array' }).join(' ').toLowerCase()
    const initials = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase()
    const v = { full, initials }
    if (cache.size > 3000) cache.clear()
    cache.set(text, v)
    return v
  } catch {
    return { full: '', initials: '' }
  }
}

/** 查询词是否命中文本的拼音（全拼或首字母连续串） */
export function matchPinyin(text: string, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q || !/[\u4e00-\u9fff]/.test(text)) return false
  const py = pinyinOf(text)
  return py.full.replace(/\s+/g, '').includes(q) || py.initials.includes(q)
}
