/**
 * V3.9.32（批 A）：方向树策展模式 · 树模型构建器（纯函数，零写库）。
 *
 * 单一真源：渲染（CompassCurationPage 及其布局子组件）与导出（compassExport.ts）
 * 共用同一 builder——渲染与导出同源，防两套口径漂移（开发任务书 A2/A4）。
 * 任务归属口径与 `newtab/views/compassMeta.ts` 的双路并集同源（task.metricId /
 * metric.taskIds，按 taskIds 轨道序、createdAt 兜底）；此处自持实现，守住
 * shared 层不反向依赖 newtab 的分层（口径漂移由回归判据把守）。
 * 停滞口径镜像 `views/projectCurationUtils.isProjectStalled`：14 天无任务更新。
 */
import type { AppData, Direction, Metric, Project, TaskCard } from '@/shared/models'

export type CurationTaskStatus = 'done' | 'doing' | 'todo' | 'stale'

export interface CurationTaskNode { task: TaskCard; status: CurationTaskStatus }

export interface CurationMetricNode {
  metric: Metric
  doneCount: number
  totalCount: number
  /** 0–100 整数百分比；空指标恒 0（呈现层以「⚠ 缺任务」警示） */
  progress: number
  tasks: CurationTaskNode[]
}

export interface CurationProjectNode {
  project: Project
  doneCount: number
  totalCount: number
  progress: number
  stalled: boolean
  metrics: CurationMetricNode[]
}

export interface CurationGoalNode { dir: Direction; projects: CurationProjectNode[] }

export interface CurationTree {
  vision: string
  mission: string
  goals: CurationGoalNode[]
  /** 未归档任务（未挂任何指标）：全景里以「散叶」呈现，待归位上枝 */
  orphans: CurationTaskNode[]
  generatedAt: number
}

/** 只读详情抽屉的选中态（渲染层与抽屉共用同一判别联合） */
export type CurationSel =
  | { kind: 'vision' }
  | { kind: 'mission' }
  | { kind: 'goal'; goal: CurationGoalNode }
  | { kind: 'project'; node: CurationProjectNode }
  | { kind: 'metric'; node: CurationMetricNode }
  | { kind: 'task'; node: CurationTaskNode }
  | { kind: 'orphans' }

const STALE_MS = 14 * 24 * 60 * 60 * 1000

function statusOf(t: TaskCard, now: number): CurationTaskStatus {
  if (t.status === 'done') return 'done'
  const act = Math.max(t.updatedAt || 0, t.createdAt || 0)
  if (now - act > STALE_MS) return 'stale'
  return t.status === 'doing' ? 'doing' : 'todo'
}

/** 指标任务双路并集（口径同 compassMeta.tasksOfMetric）：taskIds 轨道序优先，createdAt 兜底 */
function collectMetricTasks(metric: Metric, tasks: TaskCard[], now: number): CurationTaskNode[] {
  const linked = new Set(metric.taskIds || [])
  const track = new Map((metric.taskIds || []).map((id, i) => [id, i] as const))
  const seen = new Set<string>()
  const out: CurationTaskNode[] = []
  for (const t of tasks) {
    if (t.deletedAt) continue
    if (t.metricId !== metric.id && !linked.has(t.id)) continue
    if (seen.has(t.id)) continue
    seen.add(t.id)
    out.push({ task: t, status: statusOf(t, now) })
  }
  return out.sort((a, b) => {
    const ra = track.get(a.task.id)
    const rb = track.get(b.task.id)
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return (a.task.createdAt || 0) - (b.task.createdAt || 0)
  })
}

export function buildCurationTree(d: AppData, now = Date.now()): CurationTree {
  const goals: CurationGoalNode[] = (d.compass.directions || []).map(dir => ({
    dir,
    projects: (dir.projects || []).map(project => {
      const metrics: CurationMetricNode[] = (project.metrics || []).map(metric => {
        const tasks = collectMetricTasks(metric, d.tasks || [], now)
        const doneCount = tasks.filter(t => t.status === 'done').length
        return {
          metric,
          doneCount,
          totalCount: tasks.length,
          progress: tasks.length ? Math.round(doneCount / tasks.length * 100) : 0,
          tasks,
        }
      })
      const totalCount = metrics.reduce((s, m) => s + m.totalCount, 0)
      const doneCount = metrics.reduce((s, m) => s + m.doneCount, 0)
      const latest = (project.metrics || []).flatMap(m => m.taskIds || [])
        .map(id => (d.tasks || []).find(t => t.id === id && !t.deletedAt))
        .filter((t): t is TaskCard => !!t)
        .reduce((mx, t) => Math.max(mx, t.updatedAt || 0), 0)
      return {
        project,
        doneCount,
        totalCount,
        progress: totalCount ? Math.round(doneCount / totalCount * 100) : 0,
        // 口径同 projectCurationUtils.isProjectStalled：14 天无任务更新（有任务才判停滞）
        stalled: totalCount > 0 && (!latest || now - latest > STALE_MS),
        metrics,
      }
    }),
  }))
  const mounted = new Set(goals.flatMap(g => g.projects.flatMap(p => p.metrics.flatMap(m => m.tasks.map(t => t.task.id)))))
  const orphans = (d.tasks || [])
    .filter(t => !t.deletedAt && !mounted.has(t.id))
    .map(t => ({ task: t, status: statusOf(t, now) }))
    .sort((a, b) => (b.task.updatedAt || 0) - (a.task.updatedAt || 0))
  return {
    vision: (d.compass.vision?.content || '').trim(),
    mission: (d.compass.mission?.content || '').trim(),
    goals,
    orphans,
    generatedAt: now,
  }
}
