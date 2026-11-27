import type { AppData, DailyFocus, FocusSlot, TaskCard, TopicCard } from '@/shared/models'

export type FocusCalendarEntry =
  | { key: string; kind: 'task'; task: TaskCard; slot: FocusSlot; mirror: boolean }
  | { key: string; kind: 'topic'; topic: TopicCard; slot: FocusSlot; mirror: boolean }

/**
 * 历史三件事始终读取当前卡片；过往渲染为虚线历史卡，可看详情、可取消该日落图。
 * “取消”只按日期与原槽位 id 隐藏投影，不改写 dailyFocus，也不动卡片当前计划。
 */
export function focusCalendarEntries(input: {
  dailyFocus: DailyFocus | undefined
  hidden: AppData['focusHistoryHidden']
  tasks: TaskCard[]
  topics: TopicCard[]
  today: string
}): Map<string, FocusCalendarEntry[]> {
  const tasks = new Map(input.tasks.filter(card => !card.deletedAt).map(card => [card.id, card]))
  const topics = new Map(input.topics.filter(card => !card.deletedAt).map(card => [card.id, card]))
  const out = new Map<string, FocusCalendarEntry[]>()
  for (const [date, slots] of Object.entries(input.dailyFocus || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > input.today || !Array.isArray(slots)) continue
    const hidden = new Set((input.hidden?.[date] || []).map(row => row.slotId))
    const rows: FocusCalendarEntry[] = []
    const seen = new Set<string>()
    for (const slot of slots) {
      if (!slot || slot.cleared || !slot.id || !slot.sourceId || hidden.has(slot.id)) continue
      const key = `${slot.sourceType}:${slot.sourceId}`
      if (seen.has(key)) continue
      if (slot.sourceType === 'task') {
        const task = tasks.get(slot.sourceId)
        if (task) rows.push({ key, kind: 'task', task, slot, mirror: date < input.today })
      } else if (slot.sourceType === 'topic') {
        const topic = topics.get(slot.sourceId)
        if (topic) rows.push({ key, kind: 'topic', topic, slot, mirror: date < input.today })
      }
      seen.add(key)
    }
    out.set(date, rows)
  }
  return out
}

export function hideFocusHistorySlot(data: AppData, date: string, slotId: string, hiddenAt = Date.now()): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !slotId) return
  const rows = (data.focusHistoryHidden?.[date] || []).filter(row => row.slotId !== slotId)
  rows.push({ slotId, hiddenAt })
  data.focusHistoryHidden = { ...(data.focusHistoryHidden || {}), [date]: rows }
}
