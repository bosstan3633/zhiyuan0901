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
/* W13-T1：高价值冷却卡判定与 LifecyclePanel 同源（三态阈值单真源） */
import { lifecycleState } from './lifecycle'

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

/** W10（V3.9.0）：连续打卡（画像 Hero chip）——从今天往回数连续 `w>0` 的天数。
 * 今天尚未产生动作时不算断卡：回数从昨天起（当天未过完，不提前清零）。
 * 与 `longestStreak` 同用 `w>0` 判据，口径一致。 */
export function currentStreak(stats: DailyStats, now = Date.now()): number {
  const k = todayKey(now)
  let d = parseDay(k)
  if (!(stats.days[k]?.w || 0)) d.setDate(d.getDate() - 1)
  let n = 0
  for (; (stats.days[ymd(d)]?.w || 0) > 0; d.setDate(d.getDate() - 1)) n++
  return n
}

/** W10（V3.9.0）：知识熵（画像 Hero chip）——各卡标签分布的香农熵（bit，log2）。
 * 入参为三类存活卡的 `tags` 拍平（调用方负责过滤 deletedAt）；同卡重复标签先去重再计。
 * 无标签 / 单一标签时返回 0（无离散度）；结果保留 1 位小数。 */
export function computeTagEntropy(tagLists: ReadonlyArray<ReadonlyArray<string>>): number {
  const cnt = new Map<string, number>()
  let total = 0
  for (const tags of tagLists) {
    const uniq = new Set(tags.map(t => t.trim()).filter(Boolean))
    for (const t of uniq) { cnt.set(t, (cnt.get(t) || 0) + 1); total++ }
  }
  if (!total || cnt.size <= 1) return 0
  let h = 0
  for (const c of cnt.values()) { const p = c / total; h -= p * Math.log2(p) }
  return Math.round(h * 10) / 10
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

/* ═════════════════ W13-T1（2026-10-16 · 画像洞察极简认知版）═════════════════
   四个纯函数：底盘指标 ×2 + 高价值冷却卡筛选 + 四尺度一句话诊断生成。
   只读纪律照旧：不写任何存储；所有判定可断言（无 AI 参与）。 */

/** 支撑关联表的最小入参形状（`AppData.supportLinks` 结构子集） */
export interface SupportLinkLike { taskId: string; subId?: string; resourceId: string }
/** 资源生命周期 + 热度字段交集（三类卡均满足；`kind` 由本函数按调用方语义补齐） */
export type CoolCardLike = Omit<import('./lifecycle').LifecycleInput, 'kind'> & { callCount?: number; title?: string }

/**
 * F3 · 任务证据支撑率（%）= 有 SupportLink 记录的未删任务数 ÷ 未删任务总数。
 * 口径：`subId` 挂在子任务上的关联同样计入其宿主任务（子任务有支撑 = 这件事有证据）；
 * 分母为 0 返回 0（UI 显示 `—` 由调用方决定）。四舍五入到整数。
 */
export function computeTaskSupportRate(
  tasks: readonly { id: string; deletedAt?: number }[],
  supportLinks: readonly SupportLinkLike[]
): number {
  const alive = tasks.filter(t => !t.deletedAt)
  if (!alive.length) return 0
  const withSup = new Set<string>()
  for (const l of supportLinks) if (l && l.taskId) withSup.add(l.taskId)
  let n = 0
  for (const t of alive) if (withSup.has(t.id)) n++
  return Math.round((n / alive.length) * 100)
}

/** 主攻集入参：方向树结构子集——项目需带 `isFocused` 与 `status`（archived 不算主攻） */
export interface FocusDirLike {
  projects: { id: string; isFocused?: boolean; status?: string }[]
}
/** 事件级有效动作的最小形状（`CardEvent` 结构子集） */
export interface ActEventLike { ts: number; action: string; kind: string; cardId: string }

/**
 * F3 · 近 N 天精力落主攻（%）= 归属主攻项目的有效动作数 ÷ 近 N 天总有效动作数。
 *
 * 口径（与 `dailyStats.actsOf` 的事件来源部分对齐，诚实登记）：
 *  · 有效动作 = 事件流中的 `create` / `call` / `status`（非 system）——与 actsOf 的 c+u+s 三段一致；
 *  · 推进三维（focus / link / sub）不在 CardEvent 流里（它们由 dailyFocus / supportLinks /
 *    subtasks 字段现算），故不进本口径分母（两处口径不同源时宁可少算、不可编造）；
 *  · 归属判定：事件 cardId → 任务表 → projectId → 主攻项目集（`isFocused && status!=='archived'`）；
 *    资源卡 / 好奇卡无 projectId ⇒ 计分母不计分子（无法归属的诚实处理）。
 * 分母为 0 返回 0；结果四舍五入到整数。
 */
export function computeMainFocusShare(
  events: readonly ActEventLike[],
  directions: readonly FocusDirLike[],
  tasks: readonly { id: string; projectId?: string; deletedAt?: number }[],
  days = 30,
  now = Date.now()
): number {
  const focusIds = new Set<string>()
  for (const d of directions) for (const p of d.projects || [])
    if (p.isFocused && p.status !== 'archived') focusIds.add(p.id)
  const projOf = new Map<string, string | undefined>()
  for (const t of tasks) if (!t.deletedAt) projOf.set(t.id, t.projectId)
  const from = now - days * 86400_000
  let total = 0, hit = 0
  for (const e of events) {
    if (!e || e.kind === 'system') continue
    if (e.action !== 'create' && e.action !== 'call' && e.action !== 'status') continue
    if (!(e.ts >= from && e.ts <= now)) continue
    total++
    const pid = projOf.get(e.cardId)
    if (pid && focusIds.has(pid)) hit++
  }
  if (!total) return 0
  return Math.round((hit / total) * 100)
}

/**
 * F20/F23 · 高价值沉睡证据卡 = 处于**冷却期**且历史调用 `callCount >= 3` 的卡。
 *
 * 三态判定复用 `lifecycleState`（与 LifecyclePanel 完全同源，杜绝两处阈值漂移）；
 * `coolingDays` 仅作为**无自定义阈值卡**的默认冷却天数（传入即临时覆盖出厂 30 天，
 * 不改模块全局状态、不写原卡——判定用的是一次性展开副本）。
 * 返回按 `callCount` 降序（最该唤醒的排最前）。
 */
export function highValueCoolingCardsOf<C extends CoolCardLike>(
  resources: readonly C[],
  coolingDays?: number,
  minCalls = 3,
  now = Date.now()
): C[] {
  const def = coolingDays
  const out: { card: C; calls: number }[] = []
  for (const raw of resources) {
    const calls = raw.callCount || 0
    if (calls < minCalls) continue
    const card = { ...raw, kind: 'resource' as const }
    if (def !== undefined && !raw.coolingDays) card.coolingDays = def
    if (lifecycleState(card, now) !== 'cooling') continue
    out.push({ card: raw, calls })
  }
  out.sort((a, b) => b.calls - a.calls)
  return out.map(x => x.card)
}

/* ================= 四尺度一句话诊断（D2 · buildConciseInsights） ================= */

/** 单条诊断：`html` 允许内嵌 <b> 强调（调用方 v-html 渲染）；`ctaAction` 由宿主分发执行 */
export interface ConciseInsight {
  html: string
  warn: boolean
  ctaLabel: string
  /**
   * 宿主动作分发键。
   * ★W15-T1（2026-10-16 用户拍板）语义校正——**键必须与它承诺的东西同型**：
   *   「调出 N 张支撑卡」给的是**卡片清单**（ammo），不是「今日调出事件流水」；
   *   「看可调出的旧卡」给的是**冷却区卡片清单**（cooling），不是全量记录。
   *   键集：openFocusBoard / bindFocus / callSupport→ammo / openBattle / openObjectives /
   *        openLog（= 全部记录，仅页头用）/ cooling / convertCurio / wakeCooling / openLifecycle
   */
  ctaAction: string
}

export interface ConciseCtx {
  /** ① 今天（F7 三态推导） */
  today: {
    /** 游离/无弹药焦点任务数（未挂主攻或 0 支撑卡） */
    freeCount: number
    /** 为游离焦点在卡池里词面/标签匹配到的现成卡片数 */
    freeMatched: number
    /** 焦点任务关联支撑卡去重总数（已备弹药） */
    readyCards: number
    todayCalled: number
    todayAdd: number
    /** 调出入台复用比（0-1，今日无入台时为 null） */
    reusePct: number | null
    focusDone: number
    focusTotal: number
  }
  /** ② 本周（F12） */
  week: {
    acts: number
    /** 本周调出旧卡次数 */
    called: number
    /** 单一战略目标最高产出占比（0-1） */
    topShare: number
    /** 0 触达（产出为 0）的战略目标数 */
    zeroTouch: number
  }
  /** ③ 本月（F16） */
  month: {
    entropyFrom: number
    entropyTo: number
    /** 停留 exploring 超 14 天的好奇心卡数 */
    oldCurio: number
    /** 其中已有同标签资源卡支撑、可一键转化的成熟张数 */
    matureMatched: number
    /** 本月投射入策展台金字塔张数 */
    projected: number
  }
  /** ④ 本年度（F20） */
  year: {
    /** 冷却期中 callCount>=3 的高价值核心卡数 */
    coolingHigh: number
    /** 全库存活卡在头号战略方向的归属占比文案（如「主方向 X%」；无方向时 ''） */
    dirFitText: string
  }
}

const INSIGHT_NEVER = '暂无可比对基线'
/** 生成四条一句话诊断（确定性推导，优先级严格按 F7 / F12 / F16 / F20） */
export function buildConciseInsights(c: ConciseCtx): Record<'today' | 'week' | 'month' | 'year', ConciseInsight> {
  /* ---- 今天：① 游离有弹药缺口 → ② 备齐待调用 → ③ 已推进 ---- */
  let today: ConciseInsight
  if (c.today.freeCount > 0) {
    today = {
      html: `今天 <b>${c.today.freeCount}</b> 件焦点任务还游离在主攻之外${c.today.freeMatched > 0 ? `，卡池里躺着 <b>${c.today.freeMatched}</b> 张词面匹配的现成支撑卡` : '，卡池里也没有匹配的现成卡'}——先归位再开工。`,
      warn: true,
      ctaLabel: c.today.freeMatched > 0 ? `🔗 一键归入主攻 + 绑 ${c.today.freeMatched} 张卡 ›` : '🔗 去方向台挂到主攻 ›',
      ctaAction: 'bindFocus'
    }
  } else if (c.today.todayCalled === 0) {
    today = {
      html: `焦点已全部挂上主攻，<b>${c.today.readyCards}</b> 张支撑卡备齐待调用——弹药就位，别让它在池子里睡觉。`,
      warn: false,
      ctaLabel: `↗ 调出 ${c.today.readyCards} 张支撑卡 ›`,
      /* ★W15-T1：N = 已备弹药总数（与"今日调出次数"无关）。原落点 openLog 给的是今日调出**事件流水**，
         今日调出为 0 时点开就是空的 —— 现在给这 N 张卡的**清单**。 */
      ctaAction: 'ammo'
    }
  } else {
    const reuse = c.today.reusePct === null ? INSIGHT_NEVER : `旧卡复用 <b>${Math.round(c.today.reusePct * 100)}%</b>`
    today = {
      html: `今日入台 <b>${c.today.todayAdd}</b> 张、调出 <b>${c.today.todayCalled}</b> 次，${reuse}，焦点推进 ${c.today.focusDone}/${c.today.focusTotal}——晚上打开战报看全貌。`,
      warn: false,
      ctaLabel: '📊 打开今日战报 ›',
      ctaAction: 'openBattle'
    }
  }

  /* ---- 本周（F12）：单点淤积 / 只推任务不调库存 → warn ---- */
  let week: ConciseInsight
  if (c.week.acts > 0 && c.week.topShare > 0.75 && c.week.zeroTouch > 0) {
    week = {
      html: `本周 <b>${Math.round(c.week.topShare * 100)}%</b> 的产出压在同一个战略目标上，还有 <b>${c.week.zeroTouch}</b> 个目标零触达——精力单点淤积，分一点给冷的地方。`,
      warn: true,
      ctaLabel: '看方向产出明细 ›',
      ctaAction: 'openObjectives'
    }
  } else if (c.week.acts > 0 && c.week.called === 0) {
    week = {
      html: `本周 <b>${c.week.acts}</b> 件有效动作，却一次旧卡都没调出——只推任务、不查库存，先看看手里有没有现成弹药。`,
      warn: true,
      ctaLabel: '看可调出旧卡 ›',
      /* ★W15-T1：「可调出的旧卡」= 冷却区那批卡（卡片清单），不是全量事件流水 */
      ctaAction: 'cooling'
    }
  } else {
    week = {
      html: c.week.acts > 0
        ? `本周 <b>${c.week.acts}</b> 件有效动作、调出旧卡 <b>${c.week.called}</b> 次——推与调保持平衡，节奏健康。`
        : '本周还没有留下有效动作——从手边一件小事开始推。',
      warn: false,
      ctaLabel: '看可调出的旧卡（冷却区）›',
      ctaAction: 'cooling'
    }
  }

  /* ---- 本月（F16）：聚焦度变化 + 超期好奇转化 ---- */
  const dH = Math.round((c.month.entropyTo - c.month.entropyFrom) * 10) / 10
  const trend = dH > 0 ? `发散 +${dH} bit` : dH < 0 ? `聚焦 ${dH} bit` : '持平'
  let month: ConciseInsight
  if (c.month.oldCurio > 0 && c.month.matureMatched > 0) {
    month = {
      html: `知识熵 <b>${c.month.entropyFrom} → ${c.month.entropyTo} bit（${trend}）</b>；<b>${c.month.oldCurio}</b> 张好奇心卡停在探索中超 14 天，其中 <b>${c.month.matureMatched}</b> 张已有同标签资源卡支撑——就差临门一脚。`,
      warn: true,
      ctaLabel: `一键转化 ${c.month.matureMatched} 张成熟好奇卡 ›`,
      ctaAction: 'convertCurio'
    }
  } else {
    month = {
      html: `知识熵 <b>${c.month.entropyFrom} → ${c.month.entropyTo} bit（${trend}）</b>，本月入策展金字塔 <b>${c.month.projected}</b> 张——采集正在变成表达。`,
      warn: false,
      ctaLabel: '🗂️ 全部记录 ›',
      ctaAction: 'openLog'
    }
  }

  /* ---- 本年度（F20）：双轮愿景契合 + 唤醒核心冷却卡 ---- */
  const year: ConciseInsight = c.year.coolingHigh > 0
    ? {
        html: `${c.year.dirFitText || '全库存活卡方向分布已就绪'}；冷却期里有 <b>${c.year.coolingHigh}</b> 张调用 ≥3 次的核心证据卡正在睡——它们是最该被唤醒的资产。`,
        warn: true,
        ctaLabel: `🔥 去下方唤醒 ${c.year.coolingHigh} 张核心卡 ›`,
        ctaAction: 'wakeCooling'
      }
    : {
        html: `${c.year.dirFitText || '全库存活卡方向分布已就绪'}；暂无高价值卡沉睡——资产保持温热。`,
        warn: false,
        ctaLabel: '看生命周期 ›',
        ctaAction: 'openLifecycle'
      }

  return { today, week, month, year }
}
