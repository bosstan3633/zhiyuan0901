/**
 * R172-T4（04-67 §6 / §7.6）：复盘计算引擎（确定性内核 · 纯读取零写入）
 *
 * 与旧 `weeklyReport.ts` 的关系：**本文件已完成合并**（04-67 §4.3 的重命名+并档）。
 * T9/T10 起 `weeklyReport.ts` 物理退役、调度画像周报浮层组件一并退役 —— `weekWindow`（周一锚定，
 * 跨夏令时按日期分量减、不按毫秒减一周）是**唯一被承接下来的能力**，四段式 HTML 渲染链随之删除。
 *
 * 分工（04-67 §7.4）：
 *  · 规则引擎（本文件，**非 AI、可断言**）→ 给**事实与判定**（命中/未命中 + 阈值 + 数值）
 *  · AI（第 4 轮）→ 给**判断与建议**，读本文件输出后按金字塔原理组织成文本报告
 *
 * 只读纪律：本模块只接受 `DailyStats` / `AppData`，**不写任何存储**（§11「只读性」断言）。
 */
import {
  aggregateRange, stockAt,
  type DailyStats, type RangeAgg
} from './dailyStats'

/* ================= 周窗口（原 weeklyReport.ts 的唯一留存能力 · T9/T10 并入） ================= */

export type ReportPeriod = 0 | -1 // 0 = 本周（周一 ~ 现在）；-1 = 上周（周一 ~ 周日）
export interface WeekWindow { start: number; end: number; label: string }

/** 周窗口：offset 0 = 本周一 00:00 → 现在；offset -1 = 上周一 00:00 → 上周日 24:00 */
export function weekWindow(offset: ReportPeriod, now = Date.now()): WeekWindow {
  const d = new Date(now)
  const dow = (d.getDay() + 6) % 7 // 周一=0
  // R129-B10：上周起点同样走「日期分量」减法，不按毫秒减一周——跨夏令时/冬令时切换的那一周
  // 一天是 23h/25h，按毫秒减会把上周窗口整体偏移一小时（周一 00:00 变成周日 23:00）。
  const lastMon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow - 7).getTime()
  const thisMon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime()
  if (offset === 0) return { start: thisMon, end: now, label: '本周（周一 ~ 今天）' }
  return { start: lastMon, end: thisMon, label: '上周（周一 ~ 周日）' }
}

/* ================= 窗口（四范围：周 / 月 / 自定义 / 项目） ================= */

export type RangeType = 'week' | 'month' | 'custom' | 'project'

export interface Win { s: string; e: string; label: string; days: number }

const pad = (n: number): string => String(n).padStart(2, '0')
const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDay = (s: string): Date => new Date(s.replace(/-/g, '/'))

/** 周序号（ISO 近似口径，与原型一致） */
export function weekNo(d: Date): number {
  const t = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - t.getTime()) / 86400000 + t.getDay() + 1) / 7)
}
function addDays(s: string, n: number): string {
  const d = parseDay(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}
/** 今天（本地） */
export const todayKey = (now = Date.now()): string => ymd(new Date(now))

export interface WindowOpts { off?: number; customFrom?: string; customTo?: string }

/**
 * 四范围窗口。
 * ★ 环比与窗口都走**等长**口径（04-67 §F4 验收：禁止"部分月 vs 整月"的假下跌）。
 */
export function windowOf(rt: RangeType, opts: WindowOpts = {}, now = Date.now()): Win {
  const off = opts.off || 0
  const ref = todayKey(now)
  if (rt === 'week') {
    const w = weekWindow(off === 0 ? 0 : -1, now)
    const s = ymd(new Date(w.start))
    // 本周一到今天（不是到周日整周）——「本周」尚未过完，窗口自然短于 7 天
    const e = off === 0 ? ref : addDays(s, 6)
    const days = Math.max(1, Math.round((parseDay(e).getTime() - parseDay(s).getTime()) / 86400000) + 1)
    return { s, e, label: `${parseDay(s).getFullYear()} W${pad(weekNo(parseDay(s)))}（${s} → ${e}）`, days }
  }
  if (rt === 'month') {
    const base = new Date(now)
    const b = new Date(base.getFullYear(), base.getMonth() - off, 1)
    const s = ymd(b)
    const e = ymd(new Date(b.getFullYear(), b.getMonth() + 1, 0))
    return { s, e, label: `${b.getFullYear()}-${pad(b.getMonth() + 1)} 月`, days: new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate() }
  }
  if (rt === 'custom') {
    const s = opts.customFrom || addDays(ref, -29)
    const e = opts.customTo || ref
    const days = Math.max(1, Math.round((parseDay(e).getTime() - parseDay(s).getTime()) / 86400000) + 1)
    return { s, e, label: `${s} → ${e}（${days} 天）`, days }
  }
  // project：项目全周期（起止由调用方按项目实际锚点覆盖）
  const s = opts.customFrom || `${new Date(now).getFullYear()}-01-01`
  const e = opts.customTo || ref
  const days = Math.max(1, Math.round((parseDay(e).getTime() - parseDay(s).getTime()) / 86400000) + 1)
  return { s, e, label: '项目全周期', days }
}

/** 上一个**等长**窗口（环比用；`F4`：近 N 天 vs 前 N 天） */
export function prevWindow(win: Win): Win {
  const e = addDays(win.s, -1)
  const s = addDays(e, -(win.days - 1))
  return { s, e, label: `${s} → ${e}`, days: win.days }
}

/**
 * 环比（%）。`prev` 为 0 时返回 `null`（UI 显示 `—`），不返回 0 或 Infinity。
 * 04-67 §F4：禁止拿"部分月"比"整月" —— 故调用方必须传 `prevWindow()` 的结果。
 */
export function pct(now: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((now - prev) / prev) * 100)
}

/* ================= 分位与排名（L3 参照系） ================= */

/** 升序数组的 p 分位（最近邻取整，与原型一致；空数组返回 0） */
export function quantile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0
  const i = Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p))
  return sortedAsc[i]
}
/** v 在 vals 里的名次（1 = 最大） */
export function rankOf(vals: number[], v: number): number {
  let n = 1
  for (const x of vals) if (x > v) n++
  return n
}

/* ================= 年度聚合（概览带 / 热力图摘要共用） ================= */

export interface YearAgg {
  W: number; act: number; acts: number; days: number
  peak: [string, number] | null
  p50: number; p75: number; p90: number
  first: string; last: string
}
export function yearAgg(stats: DailyStats, year: number): YearAgg {
  const from = `${year}-01-01`, to = `${year}-12-31`
  const agg = aggregateRange(stats, from, to)
  const vals = agg.list.filter(([, w]) => w > 0).map(([, w]) => w).sort((a, b) => a - b)
  return {
    W: agg.W, act: agg.act, acts: agg.acts, days: agg.days,
    peak: agg.peak,
    p50: quantile(vals, 0.5), p75: quantile(vals, 0.75), p90: quantile(vals, 0.9),
    first: agg.list.length ? agg.list[0][0] : from,
    last: agg.list.length ? agg.list[agg.list.length - 1][0] : to
  }
}

/** 连续有动作的最长天数（年视图摘要卡「最长连续」；最长 → 今年第 N 长） */
export function longestStreak(stats: DailyStats, year: number): number {
  const from = `${year}-01-01`, to = `${year}-12-31`
  let cur = 0, best = 0
  for (let d = parseDay(from); ymd(d) <= to; d.setDate(d.getDate() + 1)) {
    const k = ymd(d)
    if ((stats.days[k]?.w || 0) > 0) { cur++; if (cur > best) best = cur } else cur = 0
  }
  return best
}

/* ================= 偏离预警 8 规则（04-67 §7.6；非 AI、可断言） ================= */

export interface RuleHit {
  id: string; name: string; text: string
  /** F25 下钻用：阈值表达式（`k` 已实算代入）+ 实际值 —— 与规则定义同处产出，杜绝两处漂移 */
  thr: string; act: string
}

/**
 * `k = max(0.25, 天数 / 30)` —— 短窗口的阈值缩放因子。
 * 规则只描述**事实**（阈值 + 实际值），判断与建议留给 AI（§7.4 分工）。
 */
export function runRules(a: RangeAgg, opts: { windowDays?: number } = {}): RuleHit[] {
  const days = opts.windowDays ?? a.days
  const k = Math.max(0.25, days / 30)
  const out: RuleHit[] = []
  const cTotal = a.c.res + a.c.curio + a.c.task
  const conv = cTotal ? (a.sub + a.focus + a.link) / cTotal : 0
  const doneCnt = a.sub + a.focus + a.link
  const p = (x: number): number => Math.round(x * 100)
  /** k 的实算代入：让用户看到"这一期"的阈值到底是多少，而不是一个抽象系数 */
  const kk = (x: number): string => `${Math.round(x * k * 10) / 10}（=${x} × k，k=${Math.round(k * 100) / 100}）`

  if (cTotal >= 15 * k && conv < 0.15)
    out.push({ id: 'R1', name: '囤积倾向', text: `本期采集 ${cTotal} 张，转化为推进仅 ${doneCnt} 项，转化率 ${p(conv)}%。`, thr: `采集 ≥ ${kk(15)} 且 转化率 < 15%`, act: `采集 ${cTotal} 张 · 转化 ${doneCnt} 项 · 转化率 ${p(conv)}%` })
  if (a.c.res >= 8 * k && a.u === 0)
    out.push({ id: 'R2', name: '资源未被调用', text: `新增资源 ${a.c.res} 张，本期调出 0 次 —— 采了没打开过。`, thr: `新增资源 ≥ ${kk(8)} 且 调出 = 0`, act: `新增资源 ${a.c.res} 张 · 调出 ${a.u} 次` })
  if (doneCnt === 0 && a.s.task > 0)
    out.push({ id: 'R3', name: '主攻停滞', text: `本期完成 0 项，但有 ${a.s.task} 项转为进行中 —— 在等，不在走。`, thr: '完成 = 0 且 任务转进行中 > 0', act: `完成 ${doneCnt} 项 · 任务转进行中 ${a.s.task} 次` })
  if (a.s.task >= 12 * k && doneCnt === 0)
    out.push({ id: 'R4', name: '并行过载', text: `本期新开 ${a.s.task} 项进行中，完成 0 项 —— 同时推太多。`, thr: `任务转进行中 ≥ ${kk(12)} 且 完成 = 0`, act: `任务转进行中 ${a.s.task} 次 · 完成 ${doneCnt} 项` })
  if (a.s.curio >= 20 * k && a.s.curio > 0 && a.sub + a.focus === 0)
    out.push({ id: 'R5', name: '好奇堆积', text: `好奇状态变更 ${a.s.curio} 次，但求证 0 项 —— 好奇没孵化。`, thr: `好奇状态变更 ≥ ${kk(20)} 且 已求证 = 0`, act: `好奇状态变更 ${a.s.curio} 次 · 已求证 ${a.sub + a.focus} 项` })
  if (a.W > 0 && a.peak && a.peak[1] / a.W > 0.4)
    out.push({ id: 'R6', name: '突击式使用', text: `峰值单日（${a.peak[0]}）占本期总分 ${Math.round((a.peak[1] / a.W) * 100)}% —— 集中爆发型。`, thr: '峰值单日 > 本期总分 × 40%', act: `峰值 ${a.peak[0]} ${a.peak[1]} 分 ÷ 本期总分 ${a.W} 分 = ${Math.round((a.peak[1] / a.W) * 100)}%` })
  if (cTotal > 0 && a.c.task >= 3 * k && a.link / Math.max(1, cTotal) < 0.1)
    out.push({ id: 'R7', name: '游离工作', text: `采集任务 ${a.c.task} 张，任务↔资源关联仅 ${a.link} 次 —— 在忙，但没挂到资源上。`, thr: `采集任务 ≥ ${kk(3)} 且 关联率 < 10%`, act: `采集任务 ${a.c.task} 张 · 关联 ${a.link} 次 · 关联率 ${p(a.link / Math.max(1, cTotal))}%` })
  if (a.u >= 20 * k && a.s.curio + a.s.task === 0)
    out.push({ id: 'R8', name: '只读不推进', text: `调出 ${a.u} 次，状态变更 0 次 —— 看了很多，没动一步。`, thr: `调出 ≥ ${kk(20)} 且 状态变更 = 0`, act: `调出 ${a.u} 次 · 状态变更 ${a.s.curio + a.s.task} 次` })
  return out
}

/* ================= KPI 摘要（复盘段左栏 ①） ================= */

export interface Kpi { key: string; label: string; v: number; unit: string; note: string }
export function kpisOf(a: RangeAgg): Kpi[] {
  const cTotal = a.c.res + a.c.curio + a.c.task
  const conv = cTotal ? (a.sub + a.focus + a.link) / cTotal : 0
  const actDays = a.act
  return [
    { key: 'days', label: '活跃天数', v: actDays, unit: `/ ${a.days} 天`, note: `覆盖率 ${Math.round(a.activeRate * 100)}%` },
    { key: 'acts', label: '有效动作', v: a.acts, unit: '件', note: `日均 ${Math.round(a.acts / Math.max(1, actDays))} 件 · 加权 ${a.W} 分` },
    { key: 'create', label: '采集', v: cTotal, unit: '张', note: `资源 ${a.c.res} · 好奇 ${a.c.curio} · 任务 ${a.c.task}` },
    { key: 'call', label: '调出', v: a.u, unit: '次', note: `人均 ${cTotal ? (a.u / cTotal).toFixed(1) : '0'} 次/张` },
    { key: 'status', label: '状态变更', v: a.s.curio + a.s.task, unit: '次', note: `好奇 ${a.s.curio} · 任务 ${a.s.task}` },
    { key: 'conv', label: '转化', v: a.sub + a.focus + a.link, unit: '项', note: `转化率 ${Math.round(conv * 100)}%` }
  ]
}

/* ================= 目标对账（③）—— T7 真实接线（原「分发内核」已删，不做假分布） ================= */

export interface ObjectiveRow { id: string; name: string; focused: boolean; v: number; share: number }
/** 方向对账入参形状（`compass.directions` 的结构子集，只取接线所需字段） */
export interface DirLike {
  id: string; name: string; focused?: boolean
  projects: { id: string; name?: string }[]
}
/** 任务对账入参形状（只取归属、时间与标题字段） */
export interface TaskLike {
  id: string; title?: string; projectId?: string
  createdAt?: number; completedAt?: number; deletedAt?: number; status?: string
}

function winRange(win: Win): [number, number] {
  return [parseDay(win.s).getTime(), parseDay(win.e).getTime() + 86399999]
}
export function inWindow(ts: number | undefined, win: Win): boolean {
  const [a, b] = winRange(win)
  return !!ts && ts >= a && ts <= b
}

/**
 * 目标对账：把**本期产出**按战略目标分桶。
 *
 * ★ T7 落地「多跳接线」：产出 → 任务 → `projectId` → 所属 `direction`（一跳卡字段 + 一跳方向树反查）。
 * 产出口径（诚实登记，未编造）：**窗口内新建 ∪ 窗口内完成**的任务，按任务去重。
 *  · 资源卡 / 好奇卡**无 `projectId`**，不可归属方向 ⇒ 只进 `unassigned`，不进任何方向条。
 *  · 已软删任务不计（避免"删了还算产出"）。
 *  · 一张任务 → 只归一路方向（`directions[].projects` 若重复挂同一 projectId，取**首个**命中，与 R111 同口径）。
 */
export function objectivesOf(
  directions: DirLike[], tasks: TaskLike[], win: Win
): { rows: ObjectiveRow[]; unassigned: number; total: number } {
  const owner = new Map<string, string>() // projectId → directionId（首个命中，不重复计）
  for (const d of directions) for (const p of d.projects || []) if (!owner.has(p.id)) owner.set(p.id, d.id)
  const v = new Map<string, number>()
  let unassigned = 0, total = 0
  for (const t of tasks) {
    if (t.deletedAt) continue
    if (!inWindow(t.createdAt, win) && !inWindow(t.completedAt, win)) continue
    total++
    const did = t.projectId ? owner.get(t.projectId) : undefined
    if (did) v.set(did, (v.get(did) || 0) + 1)
    else unassigned++
  }
  const denom = total || 1
  const rows: ObjectiveRow[] = directions
    .map(d => ({ id: d.id, name: d.name, focused: !!d.focused, v: v.get(d.id) || 0, share: (v.get(d.id) || 0) / denom }))
    .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name))
  return { rows, unassigned, total }
}

/** 某方向在本期的产出任务（目标对账条下钻 / KPI 下钻共用） */
export function tasksOfDirection(tasks: TaskLike[], directions: DirLike[], dirId: string, win: Win): TaskLike[] {
  const d = directions.find(x => x.id === dirId)
  if (!d) return []
  const ids = new Set((d.projects || []).map(p => p.id))
  return tasks.filter(t => !t.deletedAt && !!t.projectId && ids.has(t.projectId)
    && (inWindow(t.createdAt, win) || inWindow(t.completedAt, win)))
}

/* ================= 汇总入口（复盘段 / AI 报告投料） ================= */

export interface ReviewData {
  win: Win; prev: Win; agg: RangeAgg; prevAgg: RangeAgg
  rules: RuleHit[]; kpis: Kpi[]
  /** 环比：等长窗口（近 N 天 vs 前 N 天） */
  delta: { acts: number | null; W: number | null }
  cTotal: number
}
export function buildReview(stats: DailyStats, rt: RangeType, opts: WindowOpts = {}, now = Date.now()): ReviewData {
  const win = windowOf(rt, opts, now)
  const prev = prevWindow(win)
  const agg = aggregateRange(stats, win.s, win.e)
  const prevAgg = aggregateRange(stats, prev.s, prev.e)
  return {
    win, prev, agg, prevAgg,
    rules: runRules(agg, { windowDays: win.days }),
    kpis: kpisOf(agg),
    delta: { acts: pct(agg.acts, prevAgg.acts), W: pct(agg.W, prevAgg.W) },
    cTotal: agg.c.res + agg.c.curio + agg.c.task
  }
}

/** 概览带「5 存量 chip 的时间绑定」——点某天即显示那天库容（§5.2 核心创新） */
export function stockBoundTo(stats: DailyStats, day: string | null, linkCount = 0) {
  return stockAt(stats, day || undefined, linkCount)
}
