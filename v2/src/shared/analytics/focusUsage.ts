/**
 * V4.7.8 · 今日三件事历史频次（纯函数）。
 *
 * 唯一数据源 = `dailyFocus` 中 `!cleared` 的真实 active slots，且只取
 * `sourceType === 'task' | 'topic'`。同一张卡同一天无论占几格都只计 1 次；
 * `planScheduleEvents` 是计划日期变更账本，绝不拿来冒充“进入三件事”。
 */
import type { AppData, FocusSlot, ID } from '@/shared/models'
import { activeFocusSlots } from '@/shared/utils/focusSlots'
import { dateKey } from '@/shared/utils'
import { DAY_MS } from './cardInventory'

export type FocusCardKind = 'task' | 'topic'

export interface FocusOccurrence {
  date: string
  slotId: ID
  done: boolean
  doneAt?: number
}

export interface FocusCardUsage {
  cardId: ID
  kind: FocusCardKind
  occurrences: FocusOccurrence[]
  count: number
  doneCount: number
  lastDate: string
}

export interface FocusDayUsage {
  date: string
  taskIds: Set<ID>
  topicIds: Set<ID>
  planned: number
  done: number
}

export interface FocusUsageIndex {
  byCard: Map<string, FocusCardUsage>
  byDay: Map<string, FocusDayUsage>
  totalPlanned: number
  totalDone: number
  activeDays: number
}

export interface FocusWindowSummary {
  activeDays: number
  planned: number
  done: number
  cards: number
  completionRate: number
}

export interface FocusCardSummary {
  entered: number
  never: number
  totalOccurrences: number
  averageEntered: number
  averageAll: number
  maxCount: number
  distribution: Array<{ key: string; label: string; count: number }>
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function focusCardKey(kind: FocusCardKind, cardId: ID): string {
  return `${kind}:${cardId}`
}

function fromDayKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).getTime()
}

function slotSourceOf(slot: FocusSlot): FocusCardKind | null {
  if (!slot || slot.cleared || !slot.sourceId) return null
  if (slot.sourceType === 'task' || slot.sourceType === 'topic') return slot.sourceType
  return null
}

function sortOccurrences(rows: FocusOccurrence[]): FocusOccurrence[] {
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.slotId.localeCompare(a.slotId))
}

/**
 * 建立三件事历史索引。先过滤存活卡，再按日去重，避免已删卡或复制槽位污染分母。
 */
export function buildFocusUsage(data: AppData): FocusUsageIndex {
  const liveTasks = new Set((data.tasks || []).filter(task => !task.deletedAt).map(task => task.id))
  const liveTopics = new Set((data.topics || []).filter(topic => !topic.deletedAt).map(topic => topic.id))
  const byCard = new Map<string, FocusCardUsage>()
  const byDay = new Map<string, FocusDayUsage>()

  for (const [day, slots] of Object.entries(data.dailyFocus || {})) {
    if (!DAY_KEY_RE.test(day) || !Array.isArray(slots)) continue
    const dayRow: FocusDayUsage = {
      date: day,
      taskIds: new Set<ID>(),
      topicIds: new Set<ID>(),
      planned: 0,
      done: 0,
    }
    const seen = new Map<string, FocusOccurrence>()
    for (const slot of activeFocusSlots(slots)) {
      const kind = slotSourceOf(slot)
      if (!kind || !slot.sourceId) continue
      if (kind === 'task' ? !liveTasks.has(slot.sourceId) : !liveTopics.has(slot.sourceId)) continue
      const key = focusCardKey(kind, slot.sourceId)
      const existing = seen.get(key)
      if (existing) {
        if (slot.done && !existing.done) {
          existing.done = true
          existing.doneAt = slot.doneAt
          dayRow.done += 1
        }
        continue
      }
      const occurrence: FocusOccurrence = {
        date: day,
        slotId: slot.id,
        done: !!slot.done,
        doneAt: slot.doneAt,
      }
      seen.set(key, occurrence)
      const ids = kind === 'task' ? dayRow.taskIds : dayRow.topicIds
      ids.add(slot.sourceId)
      dayRow.planned += 1
      if (occurrence.done) dayRow.done += 1

      let cardUsage = byCard.get(key)
      if (!cardUsage) {
        cardUsage = {
          cardId: slot.sourceId,
          kind,
          occurrences: [],
          count: 0,
          doneCount: 0,
          lastDate: day,
        }
        byCard.set(key, cardUsage)
      }
      cardUsage.occurrences.push(occurrence)
      if (day > cardUsage.lastDate) cardUsage.lastDate = day
    }
    if (dayRow.planned) byDay.set(day, dayRow)
  }

  let totalPlanned = 0
  let totalDone = 0
  for (const row of byDay.values()) {
    totalPlanned += row.planned
    totalDone += row.done
  }
  for (const usage of byCard.values()) {
    sortOccurrences(usage.occurrences)
    usage.count = usage.occurrences.length
    usage.doneCount = usage.occurrences.filter(row => row.done).length
  }

  return {
    byCard,
    byDay,
    totalPlanned,
    totalDone,
    activeDays: byDay.size,
  }
}

export function focusUsageOfCard(index: FocusUsageIndex, kind: FocusCardKind, cardId: ID): FocusCardUsage {
  return index.byCard.get(focusCardKey(kind, cardId)) || {
    cardId,
    kind,
    occurrences: [],
    count: 0,
    doneCount: 0,
    lastDate: '',
  }
}

/** 近 N 个自然日窗口；按日期键比较，跨时区不会把当天算成两天。 */
export function focusWindowSummary(index: FocusUsageIndex, now = Date.now(), days = 30): FocusWindowSummary {
  const startKey = dateKey(new Date(now - (days - 1) * DAY_MS))
  const endKey = dateKey(new Date(now))
  const cards = new Set<string>()
  let activeDays = 0
  let planned = 0
  let done = 0
  for (const [day, row] of index.byDay) {
    if (day < startKey || day > endKey) continue
    activeDays += 1
    planned += row.planned
    done += row.done
    for (const id of row.taskIds) cards.add(`task:${id}`)
    for (const id of row.topicIds) cards.add(`topic:${id}`)
  }
  return {
    activeDays,
    planned,
    done,
    cards: cards.size,
    completionRate: planned ? Math.round((done / planned) * 100) : 0,
  }
}

export function focusDayUsage(index: FocusUsageIndex, day: string): FocusDayUsage {
  return index.byDay.get(day) || {
    date: day,
    taskIds: new Set<ID>(),
    topicIds: new Set<ID>(),
    planned: 0,
    done: 0,
  }
}

export function focusCardSummary(
  index: FocusUsageIndex,
  kind: FocusCardKind,
  liveCount: number,
): FocusCardSummary {
  const usages = [...index.byCard.values()].filter(usage => usage.kind === kind)
  const entered = usages.filter(usage => usage.count > 0)
  const totalOccurrences = entered.reduce((sum, usage) => sum + usage.count, 0)
  const maxCount = entered.reduce((max, usage) => Math.max(max, usage.count), 0)
  const buckets = [
    { key: 'zero', label: '从未进入', count: Math.max(0, liveCount - entered.length) },
    { key: 'one', label: '1 次', count: 0 },
    { key: 'two', label: '2 次', count: 0 },
    { key: 'three-five', label: '3–5 次', count: 0 },
    { key: 'six-plus', label: '6 次以上', count: 0 },
  ]
  for (const usage of entered) {
    if (usage.count === 1) buckets[1].count += 1
    else if (usage.count === 2) buckets[2].count += 1
    else if (usage.count <= 5) buckets[3].count += 1
    else buckets[4].count += 1
  }
  return {
    entered: entered.length,
    never: Math.max(0, liveCount - entered.length),
    totalOccurrences,
    averageEntered: entered.length ? Math.round((totalOccurrences / entered.length) * 10) / 10 : 0,
    averageAll: liveCount ? Math.round((totalOccurrences / liveCount) * 10) / 10 : 0,
    maxCount,
    distribution: buckets,
  }
}

export function focusWeekRows(index: FocusUsageIndex, now = Date.now(), days = 7): Array<{
  date: string
  label: string
  planned: number
  done: number
  pct: number
}> {
  const out = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * DAY_MS)
    const key = dateKey(date)
    const row = focusDayUsage(index, key)
    out.push({
      date: key,
      label: offset === 0 ? '今天' : '日一二三四五六'[date.getDay()],
      planned: row.planned,
      done: row.done,
      pct: row.planned ? Math.round((row.done / row.planned) * 100) : 0,
    })
  }
  return out
}

export function lastFocusDateTs(key: string): number {
  return DAY_KEY_RE.test(key) ? fromDayKey(key) : 0
}
