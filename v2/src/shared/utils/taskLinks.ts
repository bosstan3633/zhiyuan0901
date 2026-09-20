/**
 * R141：任务两种「离开」语义的统一真源（用户拍板）——
 * 挂载语境（指标/项目视图里的行操作）只做**解绑**：任务回任务调度模块，绝不删本体；
 * 本体语境（任务详情抽屉/任务面板/回收站链路）才**软删进回收站**，且顺手摘净 metric.taskIds 引用
 * （保留 t.metricId 字段作恢复真源，restore/撤销仍按它回填）。
 */
import type { AppData, TaskCard } from '@/shared/models'

/** 从全树所有指标摘除该任务引用，返回摘掉的条数 */
export function detachTaskFromMetrics(d: AppData, taskId: string): number {
  let n = 0
  for (const dir of d.compass.directions || []) {
    for (const p of dir.projects) {
      for (const m of p.metrics) {
        if (m.taskIds.includes(taskId)) { m.taskIds = m.taskIds.filter(x => x !== taskId); n++ }
      }
    }
  }
  return n
}

/** R144：把挂在某父下的子任务升为普通任务（摘 parentId 回落指标层，子任务绝不陪葬） */
export function detachChildren(d: AppData, parentId: string): number {
  let n = 0
  for (const t of d.tasks || []) if (t.parentId === parentId) { t.parentId = undefined; t.updatedAt = Date.now(); n++ }
  return n
}

/** R144：子任务软层级展平成显示行——父在前、其子紧随并标 sub（仅一层缩进语义，多层递归带上限保护）。
 *  父不在传入集合内（已解绑/删除/换指标）时子按顶层出，任何卡都不会被吞。 */
export function flattenTaskTree(tasks: TaskCard[]): { t: TaskCard; sub: boolean }[] {
  const kidsOf = new Map<string, TaskCard[]>()
  const live = new Set(tasks.map(t => t.id))
  const tops: TaskCard[] = []
  for (const t of tasks) {
    if (t.parentId && live.has(t.parentId)) {
      const arr = kidsOf.get(t.parentId)
      if (arr) arr.push(t); else kidsOf.set(t.parentId, [t])
    } else tops.push(t)
  }
  const out: { t: TaskCard; sub: boolean }[] = []
  const done = new Set<string>()
  const walk = (t: TaskCard, sub: boolean, depth: number) => {
    if (done.has(t.id)) return
    done.add(t.id)
    out.push({ t, sub })
    if (depth >= 4) return // 异常数据下不再深走，剩下的由下方兜底按顶层补出
    for (const k of kidsOf.get(t.id) || []) walk(k, true, depth + 1)
  }
  for (const t of tops) walk(t, false, 0)
  for (const t of tasks) if (!done.has(t.id)) out.push({ t, sub: false })
  return out
}

/** 解绑：摘除项目/指标归属（任务回任务调度模块未归属区），不删本体；子任务摘父指针 */
export function unbindTaskFromMetric(d: AppData, t: TaskCard) {
  t.projectId = undefined
  t.metricId = undefined
  detachTaskFromMetrics(d, t.id)
  detachChildren(d, t.id)
  t.updatedAt = Date.now()
}

/** 软删进回收站：置 deletedAt + 摘净指标引用（t.metricId 保留，恢复时回填 taskIds 的锚）；子任务摘父指针 */
export function softDeleteTaskToTrash(d: AppData, t: TaskCard) {
  t.deletedAt = Date.now()
  detachTaskFromMetrics(d, t.id)
  detachChildren(d, t.id)
  t.updatedAt = Date.now()
}

/** 启动期一次性消毒：taskIds 里不存在的/已软删的 id 清掉（历史脏数据收口，幂等） */
export function sanitizeMetricTaskIds(d: AppData): boolean {
  const live = new Set((d.tasks || []).filter(t => !t.deletedAt).map(t => t.id))
  let changed = false
  for (const dir of d.compass.directions || []) {
    for (const p of dir.projects) {
      for (const m of p.metrics) {
        const kept = m.taskIds.filter(id => live.has(id))
        if (kept.length !== m.taskIds.length) { m.taskIds = kept; changed = true }
      }
    }
  }
  return changed
}
