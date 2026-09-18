/**
 * R111 · 调度画像周报引擎（04-58 方向③）
 *
 * 四段式（纯读取零写入）：
 * ① 调度总览 4 大数字 + 环比（入台卡片 / 资源调用 / 完成任务 / 未归档）
 * ② 方向活跃度（窗口内任务完成，按战略目标分桶条形）
 * ③ 资源调用 TOP 5（窗口内被调用资源，按 callCount 降序）
 * ④ 好奇心转化漏斗（总量 → 待探索 → 探索中 → 已转为任务）
 * ⑤ 💡 洞察：规则引擎自动生成（非 AI）
 *
 * 数据源：zy_event_log（create 事件）+ d.tasks/completedAt + d.resources/lastCalledAt
 * + d.curiosities + Task.mountedCuriosityIds —— 不写任何存储。
 */
import type { AppData, ResourceCard } from '../models'

export type ReportPeriod = 0 | -1 // 0 = 本周（周一 ~ 现在）；-1 = 上周（周一 ~ 周日）

export interface WeekWindow {
  start: number
  end: number
  label: string
}

/** 周窗口：offset 0 = 本周一 00:00 → 现在；offset -1 = 上周一 00:00 → 上周日 24:00 */
export function weekWindow(offset: ReportPeriod, now = Date.now()): WeekWindow {
  const d = new Date(now)
  const dow = (d.getDay() + 6) % 7 // 周一=0
  // R129-B10：上周起点同样走「日期分量」减法，不按毫秒减一周——跨夏令时/冬令时切换的那一周
  // 一天是 23h/25h，按毫秒减会把上周窗口整体偏移一小时（周一 00:00 变成周日 23:00）。
  const lastMon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow - 7).getTime()
  const thisMon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime()
  if (offset === 0) {
    return { start: thisMon, end: now, label: `本周（周一 ~ 今天）` }
  }
  return { start: lastMon, end: thisMon, label: `上周（周一 ~ 周日）` }
}

function inWin(ts: number | undefined, w: WeekWindow): boolean {
  return !!ts && ts >= w.start && ts < w.end
}

export interface OverviewNum {
  key: 'created' | 'called' | 'done' | 'unarchived'
  num: number
  prev: number
  delta: number
  up: boolean
}
export interface DirectionBar { dirId: string; name: string; done: number }
export interface TopCalled { id: string; title: string; workspaceId: string; callCount: number }
export interface FunnelStage { key: 'total' | 'todo' | 'doing' | 'converted'; num: number }
export interface Insight { text: string }

export interface WeeklyReport {
  window: WeekWindow
  overview: OverviewNum[]
  directionBars: DirectionBar[]
  topCalled: TopCalled[]
  funnel: FunnelStage[]
  conversionRate: number
  insights: Insight[]
}

export interface ReportDrillEvent {
  kind: 'created' | 'called' | 'done' | 'unarchived' | 'direction' | 'top-card' | 'funnel'
  dirId?: string
  cardId?: string
  workspaceId?: string
  stage?: string
}

function unarchivedCount(d: AppData): number {
  return (d.tasks || []).filter(t => !t.deletedAt && (!t.projectId || !t.metricId)).length
}

/** 主引擎：给一周窗口算完整画像 */
function reportForWindow(d: AppData, events: { ts: number; action: string; kind: string }[], w: WeekWindow): { created: number; called: number; done: number; unarchivedNew: number } {
  const created = events.filter(e => inWin(e.ts, w) && e.action === 'create').length
  const called = (d.resources || []).filter(r => !r.deletedAt && inWin(r.lastCalledAt, w)).length
  const done = (d.tasks || []).filter(t => !t.deletedAt && inWin(t.completedAt, w)).length
  const unarchivedNew = (d.tasks || []).filter(t => !t.deletedAt && inWin(t.createdAt, w) && (!t.projectId || !t.metricId)).length
  return { created, called, done, unarchivedNew }
}

export function buildWeeklyReport(d: AppData, events: { ts: number; action: string; kind: string }[], offset: ReportPeriod, now = Date.now()): WeeklyReport {
  const w = weekWindow(offset, now)
  const prevW = weekWindow((offset - 1) as ReportPeriod, now)
  const cur = reportForWindow(d, events, w)
  const prev = reportForWindow(d, events, prevW)

  // ① 四大数字（未归档 = 当前存量口径，环比 = 窗口内新增未归档数）
  const overview: OverviewNum[] = [
    { key: 'created', num: cur.created, prev: prev.created, delta: cur.created - prev.created, up: cur.created >= prev.created },
    { key: 'called', num: cur.called, prev: prev.called, delta: cur.called - prev.called, up: cur.called >= prev.called },
    { key: 'done', num: cur.done, prev: prev.done, delta: cur.done - prev.done, up: cur.done >= prev.done },
    { key: 'unarchived', num: unarchivedCount(d), prev: prev.unarchivedNew, delta: cur.unarchivedNew - prev.unarchivedNew, up: cur.unarchivedNew <= prev.unarchivedNew }
  ]

  // ② 方向活跃度：窗口内完成任务，按战略目标分桶
  const dirDone = new Map<string, number>()
  for (const t of d.tasks || []) {
    if (t.deletedAt || t.status !== 'done' || !inWin(t.completedAt, w) || !t.projectId) continue
    for (const dir of d.compass?.directions || []) {
      if (dir.projects.some(p => p.id === t.projectId)) {
        dirDone.set(dir.id, (dirDone.get(dir.id) || 0) + 1)
        break
      }
    }
  }
  const directionBars: DirectionBar[] = (d.compass?.directions || []).map(dir => ({
    dirId: dir.id, name: dir.name, done: dirDone.get(dir.id) || 0
  })).filter(b => true).sort((a, b) => b.done - a.done)

  // ③ 资源调用 TOP 5：窗口内被调用过，按 callCount 降序
  const topCalled: TopCalled[] = (d.resources || [])
    .filter((r: ResourceCard) => !r.deletedAt && inWin(r.lastCalledAt, w))
    .sort((a, b) => (b.callCount || 0) - (a.callCount || 0))
    .slice(0, 5)
    .map(r => ({ id: r.id, title: r.title, workspaceId: r.workspaceId, callCount: r.callCount || 0 }))

  // ④ 好奇心转化漏斗
  const curiosities = (d.curiosities || []).filter(c => !c.deletedAt)
  const convertedIds = new Set<string>()
  for (const t of d.tasks || []) {
    if (t.deletedAt) continue
    for (const cid of t.mountedCuriosityIds || []) convertedIds.add(cid)
  }
  const funnel: FunnelStage[] = [
    { key: 'total', num: curiosities.length },
    { key: 'todo', num: curiosities.filter(c => c.status === 'todo').length },
    { key: 'doing', num: curiosities.filter(c => c.status === 'doing').length },
    { key: 'converted', num: curiosities.filter(c => convertedIds.has(c.id) || c.status === 'done').length }
  ]
  const conversionRate = funnel[0].num ? Math.round((funnel[3].num / funnel[0].num) * 100) : 0

  // ⑤ 洞察规则引擎（非 AI；5 条规则按优先级命中至多 3 条）
  const insights: Insight[] = []
  const top = directionBars[0]
  if (top && top.done > 0) insights.push({ text: `你的「${top.name}」方向本周完成任务最多（${top.done}）——保持这个节奏，让主攻方向持续前进。` })
  if (overview[1].delta < 0) insights.push({ text: `资源调用比上周少 ${-overview[1].delta} 次——收藏是手段，调用才是目的，试试 Ctrl+K 把收藏变成生产力。` })
  if (overview[3].num > 0) insights.push({ text: `还有 ${overview[3].num} 个任务未挂项目/指标——在方向台给它们一个归属，行动才有方向。` })
  if (funnel[1].num >= 3) insights.push({ text: `${funnel[1].num} 条好奇心在待探索——选一条转成任务，让好奇心落地而不是沉睡。` })
  if (overview[0].delta > 0) insights.push({ text: `入台比上周多 ${overview[0].delta} 张——收得进，也要看得见：周末花 30 分钟策展本周卡片。` })
  if (!insights.length) insights.push({ text: '本周调度平稳——打开方向树看看，有没有值得新启动的方向。' })

  return { window: w, overview, directionBars, topCalled, funnel, conversionRate, insights: insights.slice(0, 3) }
}
