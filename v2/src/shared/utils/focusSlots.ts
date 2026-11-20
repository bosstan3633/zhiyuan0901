import type { AppData, FocusSlot } from '@/shared/models'
import { uid } from '@/shared/utils'
import { scheduleCardDate } from '@/shared/storage/planSchedule'

export const FOCUS_LIMIT = 3

/**
 * 今日三件事固定三格。旧数据没有 slotIndex 时按数组顺序兼容；
 * 清空槽位用 cleared tombstone 保留位置与删除时间，避免跨设备被旧数据回填。
 */
export function normalizedFocusSlots(slots: FocusSlot[] | undefined): Array<FocusSlot | undefined> {
  const out: Array<FocusSlot | undefined> = Array.from({ length: FOCUS_LIMIT })
  for (let i = 0; i < (slots || []).length; i++) {
    const slot = slots![i]
    if (!slot) continue
    const requested = Number.isInteger(slot.slotIndex) ? Number(slot.slotIndex) : i
    let index = requested >= 0 && requested < FOCUS_LIMIT ? requested : -1
    if (index < 0 || out[index]) index = out.findIndex(cell => !cell)
    if (index >= 0 && index < FOCUS_LIMIT) out[index] = slot
  }
  return out
}

export function activeFocusSlots(slots: FocusSlot[] | undefined): FocusSlot[] {
  return normalizedFocusSlots(slots)
    .filter((slot): slot is FocusSlot => !!slot && !slot.cleared)
}

export function focusSlotIndex(slot: FocusSlot, fallback = 0): number {
  const index = Number.isInteger(slot.slotIndex) ? Number(slot.slotIndex) : fallback
  return index >= 0 && index < FOCUS_LIMIT ? index : fallback
}

export function clearedFocusSlot(index: number, previous?: FocusSlot): FocusSlot {
  const safeIndex = (index >= 0 && index < FOCUS_LIMIT ? index : 0) as 0 | 1 | 2
  return {
    id: previous?.id || uid('focus'),
    sourceType: 'text',
    text: '',
    done: false,
    slotIndex: safeIndex,
    cleared: true,
    updatedAt: Date.now(),
  }
}

/** 写回固定长度数组；空位用稳定 tombstone 占位。 */
export function sealedFocusSlots(slots: Array<FocusSlot | undefined>): FocusSlot[] {
  const normalized = normalizedFocusSlots(slots.filter((slot): slot is FocusSlot => !!slot))
  return normalized.map((slot, index) => {
    if (slot) return { ...slot, slotIndex: index as 0 | 1 | 2 }
    return clearedFocusSlot(index)
  })
}

/** 把任务移出某天三件事时，同步清空该天计划执行日期。 */
export function detachFocusTaskFromDate(data: AppData, day: string, taskId?: string): boolean {
  if (!taskId) return false
  const task = (data.tasks || []).find(row => !row.deletedAt && row.id === taskId)
  if (!task || task.dueDate !== day) return false
  scheduleCardDate(data, task, undefined, { source: 'focus', record: false })
  return true
}

/** 把选题卡移出某天三件事时，同步清空该天计划执行日期。 */
export function detachFocusTopicFromDate(data: AppData, day: string, topicId?: string): boolean {
  if (!topicId) return false
  const topic = (data.topics || []).find(row => !row.deletedAt && row.id === topicId)
  if (!topic || topic.dueDate !== day) return false
  scheduleCardDate(data, topic, undefined, { source: 'focus', record: false })
  return true
}

/** 按来源类型清理排期，避免调用方为任务/选题各写一套分支。 */
export function detachFocusSourceFromDate(
  data: AppData,
  day: string,
  sourceType: FocusSlot['sourceType'],
  sourceId?: string,
): boolean {
  if (sourceType === 'task') return detachFocusTaskFromDate(data, day, sourceId)
  if (sourceType === 'topic') return detachFocusTopicFromDate(data, day, sourceId)
  return false
}

export function isActiveFocusTask(slot: FocusSlot | undefined, taskId: string): boolean {
  return !!slot && !slot.cleared && slot.sourceType === 'task' && slot.sourceId === taskId
}

export function isActiveFocusSource(
  slot: FocusSlot | undefined,
  sourceType: FocusSlot['sourceType'],
  sourceId: string,
): boolean {
  return !!slot && !slot.cleared && slot.sourceType === sourceType && slot.sourceId === sourceId
}
