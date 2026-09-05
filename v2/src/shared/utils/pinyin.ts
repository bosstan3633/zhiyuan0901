/**
 * 拼音/首字母搜索（第十九轮引入；V2.21 改为按需懒加载）
 *
 * 为什么改懒加载：
 *   pinyin-pro 全量字典约 300KB。改造前它被 content script 与新标签页**静态** import，
 *   意味着「打开任何一个网页」都要先下载并解析 300KB——而用户此刻根本没在搜索。
 *   叠加 content_scripts 的 all_frames:true，每个 iframe 都要各吃一份。
 *
 * 降级契约（重要）：
 *   字典未就绪时，matchPinyin 返回 false，调用方的纯文本匹配照常工作。
 *   字典到位后，由调用方（见 overlay-impl 的 armPinyinRefresh / GlobalPopups）
 *   用同一查询词自动补跑一次，把拼音与首字母命中补进结果。
 *   即：功能不中断、不等待、不丢结果。
 */

type PinyinCore = typeof import('pinyin-pro')

let core: PinyinCore | null = null
let loading: Promise<void> | null = null
const readyWaiters: Array<() => void> = []

/** 字典是否已就绪 */
export function isPinyinReady(): boolean {
  return !!core
}

/** 触发字典加载（幂等，多次调用共享同一个 Promise） */
export function ensurePinyin(): Promise<void> {
  if (core) return Promise.resolve()
  if (!loading) {
    loading = import('pinyin-pro')
      .then((m) => {
        core = m
        const list = readyWaiters.splice(0, readyWaiters.length)
        for (const cb of list) {
          try { cb() } catch { /* 单个回调异常不影响其他订阅者 */ }
        }
      })
      .catch(() => {
        // 加载失败：保持未就绪，搜索永久降级为纯文本匹配，绝不阻塞主流程。
        // 注意此处吞掉错误而非 rethrow，确保 void ensurePinyin() 不产生 unhandled rejection。
      })
  }
  return loading
}

/** 字典就绪后回调；若已就绪则立即（微任务）触发 */
export function onPinyinReady(cb: () => void): void {
  if (core) {
    Promise.resolve().then(cb)
    return
  }
  readyWaiters.push(cb)
}

const cache = new Map<string, { full: string; initials: string }>()

export function pinyinOf(text: string): { full: string; initials: string } {
  if (!core) return { full: '', initials: '' }
  const hit = cache.get(text)
  if (hit) return hit
  try {
    const full = core.pinyin(text, { pattern: 'pinyin', toneType: 'none', type: 'array' }).join(' ').toLowerCase()
    const initials = core.pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase()
    const v = { full, initials }
    if (cache.size > 3000) cache.clear()
    cache.set(text, v)
    return v
  } catch {
    return { full: '', initials: '' }
  }
}

/** 查询词是否命中文本的拼音（全拼或首字母连续串）；字典未就绪时恒为 false（降级） */
export function matchPinyin(text: string, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q || !/[\u4e00-\u9fff]/.test(text)) return false
  if (!core) return false
  const py = pinyinOf(text)
  return py.full.replace(/\s+/g, '').includes(q) || py.initials.includes(q)
}
