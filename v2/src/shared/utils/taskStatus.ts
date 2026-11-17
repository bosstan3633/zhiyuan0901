import type { TaskCard } from '@/shared/models'

/** 任务完成状态只有一个写入口：进入完成态前记住原状态，取消完成时按原状态恢复。 */
export function setTaskStatus(
  task: TaskCard,
  status: TaskCard['status'],
  now = Date.now(),
): void {
  if (status === 'done') {
    if (task.status !== 'done') {
      task.statusBeforeDone = task.status === 'doing' ? 'doing' : 'todo'
    }
    task.completedAt = now
  } else {
    task.completedAt = undefined
    task.statusBeforeDone = undefined
  }
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
