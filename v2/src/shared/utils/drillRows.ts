/**
 * R172-T7（04-66 §6.2 组件复用清单）：事件 → 下钻行的**单一分组实现**。
 *
 * 为何抽出来：日详情（按日四类指标）与复盘段（按区间 6 KPI）+ 目标对账（按方向）三处都要
 * 「同卡多次聚合 ×N + 时间区间」这套折叠逻辑。各写一份必然漂移（R172-T6 落地时就有过一次：
 * 日详情返回 `t1/t2` 而 `DrillCardList` 读 `time/time2`，时间列直接空白 —— 现在只有一处答案）。
 *
 * 与 `DrillCardList.vue` 的 `Row` 契约对齐：`n > 1` 显示 `×N`，`time/time2` 为同一卡首末次时刻。
 */
import type { CardEvent } from './eventLog'

export interface DrillRow {
  kind: string
  id: string
  title: string
  icon: string
  tag: string
  n: number
  time?: string
  time2?: string
  score?: number
}

export const KIND_ICON: Record<string, string> = { resource: '📇', task: '✅', curiosity: '💡' }

const pad2 = (n: number): string => String(n).padStart(2, '0')
export const hm = (ts: number): string => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }
export const dayOfTs = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
/** `YYYY-MM-DD` 字符串比较即可判区间（闭区间） */
export const inDayRange = (day: string, from: string, to: string): boolean => day >= from && day <= to

/**
 * 按卡聚合事件（同卡多次 → ×N）。
 * @param evts  已按区间筛好的事件
 * @param tagOf 行尾类型标签（如「采集」「调出」「→ done」）
 */
export function groupEventRows(evts: CardEvent[], tagOf: (e: CardEvent) => string): DrillRow[] {
  const map = new Map<string, { row: DrillRow; t1: number; t2: number }>()
  for (const e of evts) {
    const key = `${e.kind}|${e.cardId}`
    const cur = map.get(key)
    if (cur) {
      cur.row.n++
      if (e.ts < cur.t1) cur.t1 = e.ts
      if (e.ts > cur.t2) cur.t2 = e.ts
    } else {
      map.set(key, {
        row: { kind: e.kind, id: e.cardId, title: e.title || '（无标题）', icon: KIND_ICON[e.kind] || '·', tag: tagOf(e), n: 1 },
        t1: e.ts, t2: e.ts
      })
    }
  }
  const out = [...map.values()]
  for (const x of out) { x.row.time = hm(x.t1); x.row.time2 = hm(x.t2) }
  return out.map(x => x.row).sort((a, b) => b.n - a.n || (b.time2 || '').localeCompare(a.time2 || ''))
}
