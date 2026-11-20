import type { AppData, CuriosityCard, PlanScheduleEvent, PlanScheduleSource, TaskCard, TopicCard } from '@/shared/models'
import { uid } from '@/shared/utils'

export type SchedulableCard = TaskCard | TopicCard | CuriosityCard

export interface ScheduleCardOptions {
  /** 计划日期写入来源；自动推荐用 record:false，不产生历史。 */
  source: PlanScheduleSource
  at?: number
  /** 默认 true。系统自动写入显式传 false。 */
  record?: boolean
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 当前卡片的安排历程；removedAt 的行是墓碑，默认不返回。 */
export function planEventsOf(
  d: AppData | null | undefined,
  cardId: string,
  cardKind?: PlanScheduleEvent['cardKind'],
): PlanScheduleEvent[] {
  return (d?.planScheduleEvents || [])
    .filter(event => event
      && event.cardId === cardId
      && !event.removedAt
      && (!cardKind || event.cardKind === cardKind))
    .slice()
    .sort((a, b) => (b.at || 0) - (a.at || 0) || String(b.id).localeCompare(String(a.id)))
}

/**
 * 计划执行日期的唯一写入入口。
 *
 * - 只有用户主动写成非空日期且与当前值不同，才产生一条安排事件；
 * - 清空日期不产生“取消”事件；
 * - 自动推荐/系统排序传 `record:false`，只改字段不写历史；
 * - 同日期重复确认默认不新增，避免详情页被重复记录刷屏。
 */
export function scheduleCardDate(
  d: AppData,
  card: SchedulableCard,
  date: string | undefined | null,
  opts: ScheduleCardOptions,
): boolean {
  const raw = typeof date === 'string' ? date.trim() : ''
  if (raw && !DATE_RE.test(raw)) return false
  const next = raw || undefined
  const previous = card.dueDate
  if (next === previous) return false

  card.dueDate = next
  card.updatedAt = opts.at ?? Date.now()

  if (!next || opts.record === false) return true
  d.planScheduleEvents = Array.isArray(d.planScheduleEvents) ? d.planScheduleEvents : []
  d.planScheduleEvents.push({
    id: uid('plan'),
    cardId: card.id,
    cardKind: card.kind,
    at: opts.at ?? Date.now(),
    date: next,
    fromDate: previous,
    source: opts.source,
  })
  return true
}

/** 手动删减某条安排记录：只写墓碑，不修改卡片当前 dueDate。 */
export function removePlanEvent(d: AppData, eventId: string, removedAt = Date.now()): PlanScheduleEvent | null {
  const event = (d.planScheduleEvents || []).find(row => row.id === eventId)
  if (!event || event.removedAt) return null
  event.removedAt = removedAt
  return event
}

/** 撤销删除：清掉墓碑，记录回到历程。 */
export function restorePlanEvent(d: AppData, eventId: string): PlanScheduleEvent | null {
  const event = (d.planScheduleEvents || []).find(row => row.id === eventId)
  if (!event || !event.removedAt) return null
  event.removedAt = undefined
  return event
}

/** 正常化事件表：去重、丢弃坏行、按 id 保留最新墓碑。 */
export function normalizePlanScheduleEvents(raw: unknown): PlanScheduleEvent[] {
  const rows = Array.isArray(raw) ? raw : []
  const byId = new Map<string, PlanScheduleEvent>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const event = row as Partial<PlanScheduleEvent>
    if (typeof event.id !== 'string' || !event.id) continue
    if (typeof event.cardId !== 'string' || !event.cardId) continue
    if (event.cardKind !== 'task' && event.cardKind !== 'topic' && event.cardKind !== 'curiosity') continue
    if (typeof event.date !== 'string' || !DATE_RE.test(event.date)) continue
    if (typeof event.at !== 'number' || !Number.isFinite(event.at)) continue
    byId.set(event.id, {
      id: event.id,
      cardId: event.cardId,
      cardKind: event.cardKind,
      at: event.at,
      date: event.date,
      fromDate: typeof event.fromDate === 'string' && DATE_RE.test(event.fromDate) ? event.fromDate : undefined,
      source: event.source === 'detail' || event.source === 'calendar' || event.source === 'focus'
        || event.source === 'quick' || event.source === 'ai-adopt' || event.source === 'import'
        ? event.source
        : 'import',
      removedAt: typeof event.removedAt === 'number' && Number.isFinite(event.removedAt) ? event.removedAt : undefined,
    })
  }
  return [...byId.values()]
}
