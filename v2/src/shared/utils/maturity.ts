/**
 * R142：实体成熟度规则引擎（反馈 #4/#5，用户拍板「规则即时分 + AI 深看」）。
 * 纯函数零副作用：视图 computed 即算即得（毫秒级、零 token、可解释）；AI 深度评估仍走评审抽屉。
 * 四维口径——可执行 / 可归属 / 弹药 / 新鲜度；上行链聚合同源（指标←任务、项目←指标、目标←项目）。
 */
import type { AppData, CuriosityCard, Direction, Metric, Project, ResourceCard, TaskCard } from '@/shared/models'
import { getMutationSeq } from '@/shared/storage/repository'

/**
 * R148-P1b：派生结果记忆层。
 * 病根：`taskMaturity(task)` 等直接写在模板上（任务面板 11 处行位 + 方向树 + 项目页 + 详情抽屉），
 * 每次重渲染都新建一个 `{score,grade,label,reasons[]}`；`metricMaturity` 还要把其下任务全扫一遍
 * 再各算一次——400 任务的面板滚一屏就是几千次重复计算。用户感知的"切模块卡"有一半在这里。
 * 口径：新鲜度按**天**分桶（引擎本就是日粒度），数据脏计数（repository.getMutationSeq）一变即全废，
 * 所以记忆只在"没人改过数据"时生效，不存在读到过期分。
 */
const dayBucket = (ms: number) => Math.floor(ms / DAY)
const taskMemo = new WeakMap<object, { k: string; r: Maturity }>()
const aggMemo = new Map<string, { k: string; r: Maturity }>()
/** 脏计数一变，旧键再不会命中——直接清表，避免整库浏览时 Map 无界增长 */
let aggSeq = -1
function bumpAggSeq(): number {
  const q = getMutationSeq()
  if (q !== aggSeq) { aggSeq = q; aggMemo.clear() }
  return q
}

export type Grade = 'A' | 'B' | 'C' | 'D'
export interface Maturity { score: number; grade: Grade; label: string; reasons: string[] }

export const GRADE_LABEL: Record<Grade, string> = { A: '就绪', B: '可派', C: '缺件', D: '空壳' }
const gradeOf = (s: number): Grade => (s >= 75 ? 'A' : s >= 55 ? 'B' : s >= 35 ? 'C' : 'D')
const wrap = (score: number, reasons: string[]): Maturity => {
  const g = gradeOf(score)
  return { score, grade: g, label: GRADE_LABEL[g], reasons: g === 'A' ? [] : reasons }
}

const DAY = 86400000

/** 任务成熟度：可执行 45 / 可归属 15 / 附件 5 / 新鲜度 15（R165：挂载计分全量退役，D1 直接删不补分） */
export function taskMaturity(t: TaskCard, now = Date.now()): Maturity {
  const k = `${dayBucket(now)}:${getMutationSeq()}:${t.updatedAt}:${t.status}:${t.dueDate || ''}:${t.estimatedMinutes || 0}:${(t.assets || []).length}:${(t.description || '').length}:${t.projectId || ''}:${t.metricId || ''}`
  const hit = taskMemo.get(t)
  if (hit && hit.k === k) return hit.r
  const r = taskMaturityRaw(t, now)
  taskMemo.set(t, { k, r })
  return r
}
function taskMaturityRaw(t: TaskCard, now: number): Maturity {
  let s = 0
  const r: string[] = []
  if ((t.description || '').trim().length >= 10) s += 15; else r.push('缺说明（做什么没说清）')
  if (t.estimatedMinutes) s += 10; else r.push('未估时')
  if (t.title.trim().length >= 2 && t.title.trim().length <= 24) s += 10; else r.push('标题过长/过空')
  if (t.dueDate) s += 10; else r.push('无截止日')
  if (t.projectId) s += 8; else r.push('未挂项目')
  if (t.metricId) s += 7; else r.push('未挂指标')
  if ((t.assets || []).length) s += 5
  const days = (now - (t.status === 'done' ? t.completedAt || t.updatedAt : t.updatedAt)) / DAY
  if (t.status === 'done') s += 15
  else if (days <= 7) s += 15
  else if (days <= 14) s += 8
  else r.push(`已停滞 ${Math.floor(days)} 天`)
  return wrap(s, r)
}

/** 好奇心成熟度：来源 / 记录 / 活性 三块（R165：关联资源维度随卡间挂载退役，D1 直接删不补分） */
export function curioMaturity(c: CuriosityCard, now = Date.now()): Maturity {
  let s = 0
  const r: string[] = []
  if (c.sourceUrl) s += 30; else r.push('没有来源链接')
  if ((c as { description?: string }).description || c.question.trim().length > 20) s += 25; else r.push('问题太短、缺上下文')
  const days = (now - c.updatedAt) / DAY
  if (days <= 30) s += 20; else r.push(`${Math.floor(days)} 天没动静`)
  return wrap(s, r)
}


function tasksOfMetric(d: AppData, m: Metric): TaskCard[] {
  return (d.tasks || []).filter(t => !t.deletedAt && t.metricId === m.id)
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** 指标成熟度：下属任务均分×0.5 + 任务覆盖 / 目标写法 / 完成推进 / 无停滞 */
export function metricMaturity(d: AppData, m: Metric, now = Date.now()): Maturity {
  const mk = `met:${m.id}:${dayBucket(now)}:${bumpAggSeq()}:${(m.target || '').length}:${(m.acceptance || '').length}:${d.tasks.length}`
  const hit = aggMemo.get(mk)
  if (hit) return hit.r
  const r = metricMaturityRaw(d, m, now)
  aggMemo.set(mk, { k: mk, r })
  return r
}
function metricMaturityRaw(d: AppData, m: Metric, now: number): Maturity {
  const ts = tasksOfMetric(d, m)
  let s = 0
  const r: string[] = []
  if (!ts.length) r.push('一条支撑任务都没有（线索断在这）')
  else s += avg(ts.map(t => taskMaturity(t, now).score)) * 0.5
  if (!ts.length) r.push('缺任务覆盖')
  if (ts.length >= 3) s += 15; else if (ts.length) s += 10
  if ((m.target || '').trim().length >= 4) s += 10; else r.push('目标值太虚（没写数字/期限）')
  if ((m.acceptance || '').trim().length >= 4) s += 5; else r.push('缺验收口径')
  const done = ts.filter(t => t.status === 'done').length
  if (ts.length) s += 15 * (done / ts.length)
  if (done === ts.length && ts.length) s += 5
  const freshest = Math.max(...ts.map(t => t.updatedAt), 0)
  if (ts.length && now - freshest > 30 * DAY) r.push('指标下任务全组一个月没动过')
  return wrap(s, r)
}

/** 项目成熟度：指标均分×0.5 + 指标/任务结构 + 进度 + 停滞 */
export function projectMaturity(d: AppData, p: Project, now = Date.now()): Maturity {
  const mk = `prj:${p.id}:${dayBucket(now)}:${bumpAggSeq()}:${p.progress}:${(p.metrics || []).length}:${d.tasks.length}`
  const hit = aggMemo.get(mk)
  if (hit) return hit.r
  const r = projectMaturityRaw(d, p, now)
  aggMemo.set(mk, { k: mk, r })
  return r
}
function projectMaturityRaw(d: AppData, p: Project, now: number): Maturity {
  const ms = p.metrics || []
  const ts = (d.tasks || []).filter(t => !t.deletedAt && t.projectId === p.id)
  let s = 0
  const r: string[] = []
  if (ms.length) s += avg(ms.map(m => metricMaturity(d, m, now).score)) * 0.5
  else r.push('还没有成功指标（无法验收）')
  if (ms.length) s += 15
  if (ts.length) s += 10; else r.push('项目下一条任务都没有')
  const done = ts.filter(t => t.status === 'done').length
  if (ts.length) s += 15 * (done / ts.length)
  const stalled = ts.filter(t => t.status === 'doing' && now - t.updatedAt > 14 * DAY).length
  if (stalled) r.push(`${stalled} 条任务停滞超两周`)
  else if (ts.length) s += 10
  if (p.isFocused && !stalled && ts.length) s += 10
  return wrap(s, r)
}

/** 战略目标成熟度：项目均分×0.6 + 结构/期限健康 + 主攻产出 */
export function directionMaturity(d: AppData, dir: Direction, now = Date.now()): Maturity {
  const ps = dir.projects.filter(p => p.status !== 'archived')
  let s = 0
  const r: string[] = []
  if (!ps.length) return wrap(15, ['目标下还没有项目（停在口号层）'])
  s += avg(ps.map(p => projectMaturity(d, p, now).score)) * 0.6
  s += Math.min(20, ps.length * 10)
  if (!dir.term) r.push('未分期（远期/中期/近期，缺时间窗）')
  else s += 15
  const overdue = ps.filter(p => p.endDate && new Date(p.endDate).getTime() < now && (p.progress || 0) < 100).length
  if (overdue) r.push(`${overdue} 个项目已过截止未收口`)
  const focusedOk = ps.some(p => p.isFocused && projectMaturity(d, p, now).score >= 55)
  if (focusedOk) s += 15
  return wrap(s, r)
}
