import type { AppData, ID, TaskCard, TaskStatusBucket, TaskStatusDef } from '@/shared/models'
import { defaultTaskStatuses } from '@/shared/storage/defaults'

const DEFAULT_STATUS_ID: Record<TaskStatusBucket, ID> = {
  todo: 'task-todo',
  doing: 'task-doing',
  done: 'task-done',
}

function fallbackStatusForBucket(
  statuses: TaskStatusDef[],
  bucket: TaskStatusBucket,
): TaskStatusDef | undefined {
  return statuses.find(status => status.id === DEFAULT_STATUS_ID[bucket])
    || statuses.find(status => status.bucket === bucket)
    || statuses.find(status => !status.terminal)
    || statuses[0]
}

/** 任务状态按用户配置顺序返回副本，渲染层不直接排序。 */
export function sortedTaskStatuses(data: Pick<AppData, 'taskStatuses'>): TaskStatusDef[] {
  return [...(data.taskStatuses || [])].sort((a, b) =>
    a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'),
  )
}

export function taskStatusById(data: Pick<AppData, 'taskStatuses'>, statusId?: ID): TaskStatusDef | undefined {
  if (!statusId) return undefined
  return (data.taskStatuses || []).find(status => status.id === statusId)
}

/** 取任务当前状态；悬空 `statusId` 回落到同语义桶的首个状态。 */
export function taskStatusOf(
  data: Pick<AppData, 'taskStatuses'>,
  task?: Pick<TaskCard, 'statusId'> & Partial<Pick<TaskCard, 'status'>>,
): TaskStatusDef | undefined {
  if (!task) return undefined
  return taskStatusById(data, task.statusId)
    || fallbackStatusForBucket(sortedTaskStatuses(data), task.status || 'todo')
}

export function taskTerminalStatus(data: Pick<AppData, 'taskStatuses'>): TaskStatusDef | undefined {
  const ordered = sortedTaskStatuses(data)
  return ordered.find(status => status.terminal && status.bucket === 'done')
    || ordered.find(status => status.bucket === 'done')
    || ordered.at(-1)
}

export function taskInProgressStatus(data: Pick<AppData, 'taskStatuses'>): TaskStatusDef | undefined {
  const ordered = sortedTaskStatuses(data)
  return ordered.find(status => !status.terminal && status.bucket === 'doing')
    || ordered.find(status => !status.terminal && status.order > (ordered[0]?.order ?? -1))
    || ordered.find(status => !status.terminal)
    || ordered[0]
}

/** 三桶语义对应的实际状态定义；用于批量/看板拖拽，禁止再硬编码默认状态 id。 */
export function taskStatusForBucket(
  data: Pick<AppData, 'taskStatuses'>,
  bucket: TaskStatusBucket,
): TaskStatusDef | undefined {
  if (bucket === 'done') return taskTerminalStatus(data)
  if (bucket === 'doing') return taskInProgressStatus(data)
  const ordered = sortedTaskStatuses(data)
  return ordered.find(status => status.bucket === 'todo' && !status.terminal)
    || ordered.find(status => status.bucket === 'todo')
    || ordered.find(status => !status.terminal)
    || ordered[0]
}

export function isTaskDone(
  data: Pick<AppData, 'taskStatuses'>,
  task?: Pick<TaskCard, 'statusId'> & Partial<Pick<TaskCard, 'status'>>,
): boolean {
  if (!task) return false
  return taskStatusOf(data, task)?.bucket === 'done'
}

/** 状态真源唯一写入器：statusId、兼容 status、完成时间与恢复桶同步收敛。 */
export function setTaskStatusById(
  data: AppData,
  task: TaskCard,
  statusId: ID,
  stamp = Date.now(),
): boolean {
  const next = taskStatusById(data, statusId)
  if (!next) return false
  const previous = taskStatusOf(data, task)
  const wasDone = previous?.bucket === 'done'
  if (!wasDone && next.bucket === 'done') {
    task.statusBeforeDone = previous?.bucket === 'doing' ? 'doing' : 'todo'
  }
  task.statusId = next.id
  task.status = next.bucket
  task.updatedAt = stamp
  task.completedAt = next.bucket === 'done' ? (task.completedAt || stamp) : undefined
  if (next.bucket !== 'done') task.statusBeforeDone = undefined
  return true
}

/** “进入今日重点”的写入痕迹：只给显式撤销用，不代表槽位移出要回滚状态。 */
export interface FocusTaskStatusWrite {
  changed: boolean
  beforeId?: ID
  writtenId?: ID
}

/**
 * 唯一“进入重点”状态写入器。
 *
 * 规则：
 * - 已完成、已在进行中桶：保持当前状态，不降级也不重复改 updatedAt；
 * - 待开始：落到 `taskInProgressStatus()` 的真实 doing 状态，不硬编码 `task-doing`；
 * - 状态真源与兼容 `status` 桶由 `setTaskStatusById()` 同步。
 */
export function enterFocusTaskStatus(
  data: AppData,
  task: TaskCard,
  stamp = Date.now(),
): FocusTaskStatusWrite {
  if (!task || task.deletedAt) return { changed: false }
  const current = taskStatusOf(data, task)
  if (!current || current.bucket === 'done' || current.bucket === 'doing') {
    return { changed: false }
  }
  const next = taskInProgressStatus(data)
  if (!next || next.id === current.id) return { changed: false }
  if (!setTaskStatusById(data, task, next.id, stamp)) return { changed: false }
  return { changed: true, beforeId: current.id, writtenId: next.id }
}

/** 仅当任务仍停在“本次写入”的 doing 状态时恢复；用户后来改过状态一律尊重现状。 */
export function restoreFocusTaskStatus(
  data: AppData,
  task: TaskCard,
  write?: FocusTaskStatusWrite,
  stamp = Date.now(),
): boolean {
  if (!write?.changed || !write.beforeId || !write.writtenId) return false
  if (!task || task.deletedAt) return false
  if (taskStatusOf(data, task)?.id !== write.writtenId) return false
  const before = taskStatusById(data, write.beforeId)
  if (!before || before.bucket === 'done') return false
  return setTaskStatusById(data, task, before.id, stamp)
}

export function toggleTaskDone(data: AppData, task: TaskCard, restoreStatusId?: ID): boolean {
  if (isTaskDone(data, task)) {
    const remembered = task.statusBeforeDone || 'todo'
    const explicit = taskStatusById(data, restoreStatusId)
    const fallback = explicit && explicit.bucket !== 'done'
      ? explicit
      : fallbackStatusForBucket(sortedTaskStatuses(data), remembered)
    if (!fallback || fallback.bucket === 'done') return false
    return setTaskStatusById(data, task, fallback.id)
  }
  const terminal = taskTerminalStatus(data)
  if (!terminal?.terminal) return false
  return setTaskStatusById(data, task, terminal.id)
}

/** V4.7.8：旧面板只写 `task.status='doing'` 留下的精确脏签名，只修一次。 */
export const FOCUS_TASK_STATUS_REPAIR_VERSION = 1

function localDateKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 不引入 focusSlots：legacy 夹具会单独剥离本文件求值，保持此处零模块依赖。 */
function todayFocusTaskIds(data: AppData, day: string): Set<string> {
  const slots = data.dailyFocus && Array.isArray(data.dailyFocus[day]) ? data.dailyFocus[day] : []
  const ids = new Set<string>()
  for (const slot of slots) {
    if (!slot || slot.cleared || slot.sourceType !== 'task' || !slot.sourceId) continue
    ids.add(slot.sourceId)
  }
  return ids
}

function repairLegacyFocusTaskStatus(data: AppData): void {
  const repairedVersion = Number(data.focusTaskStatusRepairVersion)
  if (Number.isFinite(repairedVersion) && repairedVersion >= FOCUS_TASK_STATUS_REPAIR_VERSION) return
  const focusTaskIds = todayFocusTaskIds(data, localDateKey())
  const doing = taskInProgressStatus(data)
  if (focusTaskIds.size && doing?.bucket === 'doing') {
    for (const task of data.tasks) {
      if (task.deletedAt || !focusTaskIds.has(task.id)) continue
      const currentById = taskStatusById(data, task.statusId)
      if (task.status !== 'doing' || currentById?.bucket !== 'todo') continue
      setTaskStatusById(data, task, doing.id)
    }
  }
  data.focusTaskStatusRepairVersion = FOCUS_TASK_STATUS_REPAIR_VERSION
}

/**
 * V4.7.1：任务状态入库边界统一收敛。
 *
 * 云恢复、导入与三方合并都可能带来缺失列表、重复 id、悬空引用或零/多个完成态。
 * 这里把兼容层 `TaskCard.status` 固定为 `statusId` 对应桶，并保证有且只有一个
 * terminal 且属于 done 桶；只修非法值，不覆盖用户已有改名、改色和排序。
 */
export function normalizeTaskStatusDomain(data: AppData): void {
  data.tasks = Array.isArray(data.tasks) ? data.tasks : []
  const source = Array.isArray(data.taskStatuses) && data.taskStatuses.length
    ? data.taskStatuses
    : defaultTaskStatuses()

  const seen = new Set<string>()
  const statuses: TaskStatusDef[] = []
  for (const status of source) {
    if (!status || typeof status.id !== 'string' || !status.id || seen.has(status.id)) continue
    seen.add(status.id)
    status.name = typeof status.name === 'string' && status.name.trim() ? status.name.trim() : '未命名状态'
    status.color = /^#[0-9a-f]{6}$/i.test(status.color || '') ? status.color : '#6F7C86'
    status.order = Number.isFinite(status.order) ? Number(status.order) : 0
    status.bucket = status.bucket === 'todo' || status.bucket === 'doing' || status.bucket === 'done'
      ? status.bucket
      : (status.terminal ? 'done' : 'todo')
    status.terminal = !!status.terminal
    statuses.push(status)
  }
  data.taskStatuses = statuses.length ? statuses : defaultTaskStatuses()

  let doneStatuses = data.taskStatuses.filter(status => status.bucket === 'done')
  if (!doneStatuses.length) {
    const candidate = data.taskStatuses.find(status => status.terminal) || data.taskStatuses.at(-1)!
    candidate.bucket = 'done'
    candidate.terminal = true
    doneStatuses = [candidate]
  }
  const terminal = doneStatuses.find(status => status.id === 'task-done' && status.terminal)
    || doneStatuses.find(status => status.terminal)
    || doneStatuses[0]
  for (const status of data.taskStatuses) status.terminal = status.id === terminal.id
  terminal.bucket = 'done'
  terminal.terminal = true

  repairLegacyFocusTaskStatus(data)

  const ordered = sortedTaskStatuses(data)
  const statusById = new Map(data.taskStatuses.map(status => [status.id, status] as const))
  for (const task of data.tasks) {
    let current = task.statusId ? statusById.get(task.statusId) : undefined
    if (!current) {
      const fallback = fallbackStatusForBucket(ordered, task.status || 'todo')
      if (!fallback) continue
      current = fallback
      task.statusId = current.id
    }
    const previousBucket = task.status
    if (current.bucket === 'done' && previousBucket !== 'done' && !task.statusBeforeDone) {
      task.statusBeforeDone = previousBucket === 'doing' ? 'doing' : 'todo'
    }
    task.status = current.bucket
    if (task.statusBeforeDone !== 'todo' && task.statusBeforeDone !== 'doing') {
      task.statusBeforeDone = undefined
    }
    if (current.bucket === 'done') {
      if (!task.completedAt) task.completedAt = task.updatedAt || Date.now()
    } else if (task.completedAt) {
      task.completedAt = undefined
    }
  }
}

/**
 * V4.3.5 兼容写入口：旧任务 UI 尚未携带 AppData 时，只改默认三桶状态。
 * 新代码应使用 `setTaskStatusById`；这里仍保证 statusId 与兼容 status 同步。
 */
export function setTaskStatus(
  task: TaskCard,
  status: TaskCard['status'],
  now = Date.now(),
): void {
  if (status === 'done') {
    if (task.status !== 'done') {
      task.statusBeforeDone = task.status === 'doing' ? 'doing' : 'todo'
    }
    task.completedAt = task.completedAt || now
  } else {
    task.completedAt = undefined
    task.statusBeforeDone = undefined
  }
  task.statusId = DEFAULT_STATUS_ID[status]
  task.status = status
  task.updatedAt = now
}

export function toggleTaskStatus(task: TaskCard, now = Date.now()): void {
  setTaskStatus(
    task,
    task.status === 'done' ? (task.statusBeforeDone || 'todo') : 'done',
    now,
  )
}
