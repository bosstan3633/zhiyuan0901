/**
 * R169-T3：今日三件事的**历史聚合层**（只读派生，不写任何数据）。
 *
 * 为什么单独一个文件：`dailyFocus` 早就按日存了（`{'YYYY-MM-DD': FocusSlot[]}`），
 * 但全站没有任何一处把它按"近 N 天"读回来过 ⇒ 推荐器拿不到"昨天排了没做"、
 * 台面也说不出"过去一周完成多少"。这两句话是推荐依据的主体，缺了就只能凭空排序。
 *
 * 口径纪律（与 06-2 §E 同源）：
 *  - **自然日**用调用方传进来的 `todayKey`，不在这里 `new Date()` —— 调度台可以翻到昨天看，
 *    推荐必须以"用户正在看的那一天"为锚，否则跨零点会自己跟自己错开；
 *  - 完成度**双口径分开**：`planned/done` 数的是三件事格子（用户当天承诺的），
 *    `completed` 数的是任务卡 `completedAt`（真正做完的）。两者不等是常态
 *    （看板里拖完成的卡不会进三件事），混成一个数就会说谎。
 */
import type { AppData, TaskCard } from '@/shared/models'

const DAY_MS = 86_400_000

function toKey(ms: number): string {
  const dt = new Date(ms)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function fromKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).getTime()
}

export interface FocusDayStat { date: string; planned: number; done: number }

/** 近 n 天（含锚点日）的三件事安排/完成度，按日期升序 */
export function focusRecentDays(d: AppData, anchorKey: string, n = 7): FocusDayStat[] {
  const start = fromKey(anchorKey) - (n - 1) * DAY_MS
  const out: FocusDayStat[] = []
  for (let i = 0; i < n; i++) {
    const key = toKey(start + i * DAY_MS)
    const slots = d.dailyFocus?.[key] || []
    out.push({ date: key, planned: slots.length, done: slots.filter(s => s.done).length })
  }
  return out
}

/** 近 n 天累计：安排了多少格、完成多少格（✦ 浮层「过去 7 天完成 12/21」就是这个数） */
export function focusWindowTotals(days: FocusDayStat[]): { planned: number; done: number } {
  return days.reduce((a, x) => ({ planned: a.planned + x.planned, done: a.done + x.done }), { planned: 0, done: 0 })
}

/**
 * 顺延未清：锚点日之前 n 天内**被安排过、至今仍未完成**的任务。
 * 返回 taskId → 最近一次安排日（越近越该接着做，成本最低）。
 * 已删除的卡与已完成的卡都不算顺延（前者没了，后者做完了）。
 */
export function focusCarried(d: AppData, anchorKey: string, n = 7): Map<string, string> {
  const start = fromKey(anchorKey) - (n - 1) * DAY_MS
  const byId = new Map(d.tasks.filter(t => !t.deletedAt).map(t => [t.id, t]))
  const out = new Map<string, string>()
  for (const key of Object.keys(d.dailyFocus || {}).sort()) {
    const ts = fromKey(key)
    if (ts < start || ts > fromKey(anchorKey)) continue
    for (const slot of d.dailyFocus[key] || []) {
      if (slot.done || slot.sourceType !== 'task' || !slot.sourceId) continue
      const t = byId.get(slot.sourceId)
      if (!t || t.status === 'done') continue
      const prev = out.get(slot.sourceId)
      if (!prev || key > prev) out.set(slot.sourceId, key)
    }
  }
  return out
}

/** 锚点日之前 n 天里完成的任务（按 `completedAt`，不是按格子） */
export function focusCompletedInWindow(d: AppData, anchorKey: string, n = 7): TaskCard[] {
  const start = fromKey(anchorKey) - (n - 1) * DAY_MS
  return d.tasks.filter(t => !t.deletedAt && t.completedAt && t.completedAt >= start && t.completedAt <= fromKey(anchorKey) + DAY_MS - 1)
}

/** 某任务被安排进三件事的**次数**（同一天重复安排只算一次）——速览"这周排了 3 次还没做" */
export function focusPlannedCounts(d: AppData, anchorKey: string, n = 7): Map<string, number> {
  const start = fromKey(anchorKey) - (n - 1) * DAY_MS
  const out = new Map<string, number>()
  for (const key of Object.keys(d.dailyFocus || {})) {
    const ts = fromKey(key)
    if (ts < start || ts > fromKey(anchorKey)) continue
    const seen = new Set<string>()
    for (const slot of d.dailyFocus[key] || []) {
      if (slot.sourceType !== 'task' || !slot.sourceId || seen.has(slot.sourceId)) continue
      seen.add(slot.sourceId)
      out.set(slot.sourceId, (out.get(slot.sourceId) || 0) + 1)
    }
  }
  return out
}
