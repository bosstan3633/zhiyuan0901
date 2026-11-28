import type { AppData, Project, TaskCard } from '@/shared/models'
import { isTaskDone, taskStatusOf } from '@/shared/utils/taskStatus'
import type { ProjectMeta } from './compassMeta'

/** 项目“下一步”唯一口径：用户填写 → 进行中任务 → 未完成任务 → 空态；只读，自动推导不反写 nextStep。 */
export function resolveProjectNextStep(
  proj: Project,
  tasks: TaskCard[],
  data: Pick<AppData, 'taskStatuses'>,
): Pick<ProjectMeta, 'nextStep' | 'nextStepSource'> {
  const manual = (proj.nextStep || '').trim()
  if (manual) return { nextStep: manual, nextStepSource: 'manual' }
  const pending = tasks
    .filter(task => !isTaskDone(data, task))
    .slice()
    .sort((a, b) => {
      const doing = Number(taskStatusOf(data, b)?.bucket === 'doing')
        - Number(taskStatusOf(data, a)?.bucket === 'doing')
      return doing || ((b.updatedAt || 0) - (a.updatedAt || 0))
    })
  const task = pending[0]
  return task
    ? { nextStep: task.title, nextStepSource: 'task' }
    : { nextStep: '还没有待推进任务，先补一条可执行的下一步', nextStepSource: 'empty' }
}
