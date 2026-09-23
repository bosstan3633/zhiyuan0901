/**
 * 拼音/首字母搜索（第十九轮引入；V2.21 改按需懒加载；**R160（P2）改两层表，彻底替换 pinyin-pro**）
 *
 * 为什么换实现：
 *   pinyin-pro 全量字典 317KB（压缩后约 142KB，ZIP 占比 22%）——分几层都仍随包分发。
 *   R160 改为**生成物两层表**（`pinyinTable.ts`，共约 54KB 源文本）：
 *   - 第一层·首字母表：U+4E00..U+9FFF 全表（每字 1 字符，约 21KB）——零依赖、即时可用；
 *   - 第二层·全拼表：常用字区（约 6.6K 字，约 33KB）——懒解析为 Map，未收录字仅支持首字母。
 *   词典不再进包 → ZIP 回 ≤600KB（04-63·R160 验收）。
 *
 * 降级契约（保持兼容）：
 *   `isPinyinReady()` 恒为 true、`onPinyinReady` 微任务回调、`ensurePinyin()` 立即 resolve——
 *   旧调用方（overlay-impl 的 armPinyinRefresh / GlobalPopups 的补跑）语义不变，只是"立即就绪"。
 */
import { INITIALS, FULLS, PINYIN_RANGE_START } from './pinyinTable'

/** 兼容旧契约：两层表内联，恒为就绪 */
export function isPinyinReady(): boolean {
  return true
}

/** 兼容旧契约：立即 resolve（幂等） */
export function ensurePinyin(): Promise<void> {
  return Promise.resolve()
}

/** 兼容旧契约：就绪后回调（微任务触发） */
export function onPinyinReady(cb: () => void): void {
  Promise.resolve().then(cb)
}

/** 全拼表懒解析（"字拼|字拼|…" → Map；首用一次，约 6.6K 条） */
let fullMap: Map<string, string> | null = null
function ensureFullMap(): Map<string, string> {
  if (fullMap) return fullMap
  const m = new Map<string, string>()
  for (const pair of FULLS.split('|')) {
    if (pair.length >= 3) m.set(pair[0], pair.slice(1))
  }
  fullMap = m
  return m
}

const cache = new Map<string, { full: string; initials: string }>()
/** R55-F3：LRU 上限——超出时逐出最旧（旧实现整体 clear 会造成大库反复重算抖动） */
const CACHE_MAX = 3000

export function pinyinOf(text: string): { full: string; initials: string } {
  const hit = cache.get(text)
  if (hit) {
    // LRU 触碰：删后重插使其回到最新端
    cache.delete(text)
    cache.set(text, hit)
    return hit
  }
  let initials = ''
  let full = ''
  const fm = ensureFullMap()
  for (const ch of text) {
    const cp = ch.codePointAt(0) || 0
    const idx = cp - PINYIN_RANGE_START
    if (idx >= 0 && idx < INITIALS.length) {
      const ini = INITIALS[idx]
      if (ini !== '_') initials += ini
      const fl = fm.get(ch)
      full += (fl || '') + ' '
    }
  }
  const v = { full: full.trim().toLowerCase(), initials: initials.toLowerCase() }
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(text, v)
  return v
}

/** 查询词是否命中文本的拼音（全拼或首字母连续串） */
export function matchPinyin(text: string, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q || !/[\u4e00-\u9fff]/.test(text)) return false
  const py = pinyinOf(text)
  return py.initials.includes(q) || py.full.includes(q)
}
