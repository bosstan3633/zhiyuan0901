/**
 * R172-T2（04-67 §7.2 / §7.3 / §7.4 / §7.5）：按日聚合引擎 `zy_daily_stats`
 *
 * 为什么有它：年度热力图要 366 天的「加权分 + 有效动作」、概览带要「截至某天的库容」，
 * 这两件事都要求**按日的时间序列**。现成的 `zy_event_log` 是明细（5000 条滚动淘汰，
 * 老日子会被挤掉），`zy_stats_v1` 只有 WRR 累计 —— 都不够。本键是**只增不淘汰**的聚合快照。
 *
 * 设计要点：
 *  - **事件为主**：create / call / delete / purge / restore / status 六类由 `zy_event_log` 折叠而来
 *  - **字段为辅**：推进三维（子任务完成 / 今日三件事完成 / 卡↔资源关联）不在事件里，从卡字段按时间戳归日
 *  - **前缀和查询**：`stockAt()` 累加 `Σ(c − del)` 即可得"截至某天库容"，**不重扫全库**（04-67 §8.3 性能红线）
 *  - **防刷分**：同卡同日第 2 次起调出计 0.5；采集后 24h 内即软删，该笔采集分 ×0.3
 *  - **零迁移**：无键时 `buildDailyStats` 从事件现算；`fullSince` 首日落定
 *
 * 已知口径边界（诚实登记，未编造）：
 *  - `link`（链接卡）**无增删事件**（资源卡 URL 字段变更不入日志）⇒ 历史逐日 link 库容不可重建；
 *    当前值由调用方按真实库传入，逐日 delta 记 0（`DAILY_LINK_TRACKED = false`）。
 *  - `sub` 只统计**有 `doneAt`** 的子任务（R172-T2 新增字段）；历史已完成项无时刻，跳过不伪造。
 *  - `system` 摘要事件（批量导入/回滚）不计入日聚合 —— 否则一次导入会把某一天灌成一个假峰值。
 */
import type { AppData } from '@/shared/models'
import type { CardEvent, CardKind } from '@/shared/utils/eventLog'
import { K } from '@/shared/storage/keys'
import { dateKey } from '@/shared/utils'

export const DAILY_STATS_KEY = K.DAILY_STATS
/** R172-T2：link 逐日 delta 尚无事件源（见文件头「已知口径边界」） */
export const DAILY_LINK_TRACKED = false

/* ================= 加权表（04-67 §7.2 · 全站单一真源） ================= */

/**
 * 分值表初值——上线后按真实库校准（R2 阶段 Q3 拍板）。
 * ★ 规格张力已由**产品拍板收口**：04-67 §7.2 给「子任务完成 = 0.8」，但 R166 定案 3 明确
 *   「子任务完成态**不进**成熟度与周报计分」。本轮按**更保守的定案 3** 落地 —— `subtask: 0`
 *   （不参与加权分，故也不影响热力图档位）。
 *
 * 口径边界（诚实登记，未外延）：本次只把**分值**收回 0，**件数**口径不动 ——
 * `DayRec.sub` 仍计入「推进」与「有效动作件数」，`runRules` 的 R3/R5 仍以它作"完成项"凭据。
 * 若后续要求"件数也不计"，那是另一条更宽的裁决，需同时改 `kpisOf` 的转化项与 R3/R5 判据。
 */
export const W = {
  cRes: 1.0, cCurio: 1.2, cTask: 1.5,
  call: 1.0,
  sCurioDoing: 1.5, sCurioDone: 2.5, sCurioShelf: 0.5,
  sTaskDoing: 1.5, sTaskDone: 3.0,
  subtask: 0, focus: 2.5, link: 1.0
} as const

/** 分数口径表（概览带「⚖ 分数口径」12 行，F5 验收要求逐行可核对） */
export const W_ROWS: readonly (readonly [string, number])[] = [
  ['采集 · 资源卡', W.cRes], ['采集 · 好奇卡', W.cCurio], ['采集 · 任务卡', W.cTask],
  ['调出 · 任一卡', W.call],
  ['状态 · 好奇 → 探索中', W.sCurioDoing], ['状态 · 好奇 → 已求证', W.sCurioDone],
  ['状态 · 好奇 → 已搁置', W.sCurioShelf],
  ['状态 · 任务 → 进行中', W.sTaskDoing], ['状态 · 任务 → 已完成', W.sTaskDone],
  ['子任务勾选完成（R166 定案 3：不计分）', W.subtask], ['今日三件事完成', W.focus], ['任务↔资源关联采纳', W.link]
] as const

/** 防刷分（04-67 §5.2 脚注） */
export const CALL_REPEAT_FACTOR = 0.5
export const QUICK_DELETE_FACTOR = 0.3
const QUICK_DELETE_MS = 24 * 3600 * 1000

/* ================= 六档语义（04-67 §7.3 · L2 档位语义化） ================= */

export const LV_NAME = ['静默', '轻触', '常规', '高负荷', '冲刺', '满格'] as const
export const LV_DESC = ['这天没动', '收了几张、翻了几下', '正常干活的一天', '比平时干得多', '明显超出常态', '一年里最猛的那几天'] as const
export const LV_RANGE = ['0 分', '1–8 分', '9–18 分', '19–32 分', '33–52 分', '≥53 分'] as const

/** 固定阈值（跨年可比）；UI 只显示语义名，分数区间仅出现在 tooltip 与分数口径表 */
export function levelOf(w: number): number {
  return !w ? 0 : w <= 8 ? 1 : w <= 18 ? 2 : w <= 32 ? 3 : w <= 52 ? 4 : 5
}
export const levelName = (w: number): string => LV_NAME[levelOf(w)]
export const levelDesc = (w: number): string => LV_DESC[levelOf(w)]
export const levelRange = (w: number): string => LV_RANGE[levelOf(w)]

/* ================= 按日记录 ================= */

export interface KindCount { res: number; curio: number; task: number }
export interface DayRec {
  /** 采集（分卡种） */
  c: KindCount
  /** 删除（分卡种）——软删即"移出在库集合"，purge 不重复计 */
  del: KindCount
  /** 状态变更（分卡种；资源卡无 status 语义） */
  s: { curio: number; task: number }
  /** 调出次数（call 事件） */
  u: number
  /** 推进合计 = sub + focus + link */
  d: number
  /** 推进三维明细 */
  sub: number
  focus: number
  link: number
  /** ★ 存量净变化（时间绑定的数据基础）：add = 新增 + 恢复；del = 软删 */
  x: { add: number; del: number }
  /** 当日加权分（1 位小数） */
  w: number
}

export interface StockBase { res: number; task: number; curio: number; link: number }
export interface DailyStats { v: 1; days: Record<string, DayRec>; fullSince: string; base: StockBase }

export function emptyDay(): DayRec {
  return {
    c: { res: 0, curio: 0, task: 0 }, del: { res: 0, curio: 0, task: 0 },
    s: { curio: 0, task: 0 }, u: 0, d: 0, sub: 0, focus: 0, link: 0,
    x: { add: 0, del: 0 }, w: 0
  }
}

/** 有效动作件数（R3 主数字）= 采集 + 调出 + 状态变更 + 推进 的**条数**总和（不加权） */
export function actsOf(r: DayRec): number {
  return r.c.res + r.c.curio + r.c.task + r.u + r.s.curio + r.s.task + r.d
}

const round1 = (n: number): number => Math.round(n * 10) / 10
const kindKeyOf = (k: CardKind): keyof KindCount => (k === 'resource' ? 'res' : k === 'curiosity' ? 'curio' : 'task')
const dayOf = (ts: number): string => dateKey(new Date(ts))

/** 状态变更的目标态权重（04-67 §7.2；`todo` 回退不计分） */
function statusWeight(kind: CardKind, to?: string): number {
  if (kind === 'curiosity') {
    if (to === 'doing') return W.sCurioDoing
    if (to === 'done') return W.sCurioDone
    if (to === 'shelf') return W.sCurioShelf
    return 0
  }
  if (kind === 'task') {
    if (to === 'doing') return W.sTaskDoing
    if (to === 'done') return W.sTaskDone
    return 0
  }
  return 0
}

/**
 * 折叠事件 + 卡字段 → 按日聚合。
 * @param base   年份起始库容（§7.5）；调用方按真实库传，缺省 0
 * @param nowTs  用于 `fullSince` 兜底（无任何事件时）
 */
export function buildDailyStats(data: AppData, events: CardEvent[], base?: StockBase, nowTs = Date.now()): DailyStats {
  const days: Record<string, DayRec> = {}
  const rec = (k: string): DayRec => days[k] || (days[k] = emptyDay())
  /** 采集记分先入暂存，等"24h 内软删 ×0.3"判完再并入 `w` */
  const createScore = new Map<string, { day: string; pts: number; cardId: string; ts: number }>()
  const firstCallOf = new Set<string>()

  /* ---- pass 1：事件折叠 ---- */
  for (const e of events) {
    if (e.kind === 'system') continue
    const kind = e.kind as CardKind
    const kk = kindKeyOf(kind)
    const r = rec(dayOf(e.ts))
    switch (e.action) {
      case 'create': {
        r.c[kk]++; r.x.add++
        const pts = kind === 'resource' ? W.cRes : kind === 'curiosity' ? W.cCurio : W.cTask
        createScore.set(`${e.cardId}|${e.ts}`, { day: dayOf(e.ts), pts, cardId: e.cardId, ts: e.ts })
        break
      }
      case 'call': {
        r.u++
        const key = `${dayOf(e.ts)}|${e.cardId}`
        const isFirst = !firstCallOf.has(key)
        firstCallOf.add(key)
        r.w += isFirst ? W.call : W.call * CALL_REPEAT_FACTOR
        break
      }
      case 'delete':
        r.del[kk]++; r.x.del++
        break
      case 'purge':
        // 已在软删时计入"移出在库集合"，此处不再动 x.del（否则同一张卡算两次）
        break
      case 'restore':
        r.x.add++
        break
      case 'status':
        if (kind === 'curiosity') r.s.curio++
        else if (kind === 'task') r.s.task++
        r.w += statusWeight(kind, e.to)
        break
    }
  }

  /* ---- pass 2：采集分（含"24h 内即软删 ×0.3"修正） ---- */
  const deleteTsByCard = new Map<string, number[]>()
  for (const e of events) {
    if (e.action !== 'delete') continue
    const arr = deleteTsByCard.get(e.cardId) || []
    arr.push(e.ts)
    deleteTsByCard.set(e.cardId, arr)
  }
  for (const c of createScore.values()) {
    const dels = deleteTsByCard.get(c.cardId)
    const quick = !!dels && dels.some((t) => t >= c.ts && t - c.ts <= QUICK_DELETE_MS)
    rec(c.day).w += quick ? c.pts * QUICK_DELETE_FACTOR : c.pts
  }

  /* ---- pass 3：推进三维（卡字段，按时间戳归日） ---- */
  // ① 今日三件事完成（FocusSlot.doneAt 已存在）
  for (const [dayKeyStr, slots] of Object.entries(data.dailyFocus || {})) {
    for (const s of slots || []) {
      if (!s || !s.done) continue
      const day = s.doneAt ? dayOf(s.doneAt) : dayKeyStr
      const r = rec(day)
      r.focus++; r.d++; r.w += W.focus
    }
  }
  // ② 卡↔资源关联采纳（SupportLink.createdAt）
  for (const l of data.supportLinks || []) {
    if (!l || !l.createdAt) continue
    const r = rec(dayOf(l.createdAt))
    r.link++; r.d++; r.w += W.link
  }
  // ③ 子任务完成（Subtask.doneAt；R172-T2 新增，历史项无时刻则跳过）
  for (const t of data.tasks || []) {
    for (const s of t.subtasks || []) {
      if (!s || !s.done || !s.doneAt) continue
      const r = rec(dayOf(s.doneAt))
      r.sub++; r.d++; r.w += W.subtask
    }
  }

  /* ---- 收口：权重取 1 位小数、清掉空日 ---- */
  for (const k of Object.keys(days)) days[k].w = round1(days[k].w)
  const keys = Object.keys(days).sort()
  return {
    v: 1,
    days,
    fullSince: keys[0] || dayOf(nowTs),
    base: base || { res: 0, task: 0, curio: 0, link: 0 }
  }
}

/* ================= 前缀和查询（时间绑定） ================= */

export interface Stock { total: number; res: number; task: number; curio: number; link: number }

/**
 * 「截至某天的库容」——`day` 省略 = 今天（含当天）。
 * 只累加聚合记录，**不重扫全库**（04-67 §8.3 性能红线）。
 * `linkCount`：链接卡无事件源，历史逐日不可重建 ⇒ 由调用方按真实库传入当前值（见文件头边界）。
 */
export function stockAt(stats: DailyStats, day?: string, linkCount = 0): Stock {
  let res = stats.base.res, task = stats.base.task, curio = stats.base.curio
  for (const k of Object.keys(stats.days).sort()) {
    if (day && k > day) break
    const r = stats.days[k]
    res += r.c.res - r.del.res
    task += r.c.task - r.del.task
    curio += r.c.curio - r.del.curio
  }
  res = Math.max(0, res); task = Math.max(0, task); curio = Math.max(0, curio)
  return { res, task, curio, link: Math.max(0, linkCount), total: res + task + curio }
}

/** 截至今天（含）的库容；`linkCount` 同 `stockAt` */
export function stockToday(stats: DailyStats, linkCount = 0): Stock { return stockAt(stats, undefined, linkCount) }

/** 单日库容变化（分卡种 + 合计 add/del），供 F15「库容变化条」与 F2 绑定态用 */
export function deltaOf(stats: DailyStats, day: string): KindCount & { add: number; del: number } {
  const r = stats.days[day] || emptyDay()
  return {
    res: r.c.res - r.del.res, task: r.c.task - r.del.task, curio: r.c.curio - r.del.curio,
    add: r.c.res + r.c.curio + r.c.task, del: r.del.res + r.del.curio + r.del.task
  }
}

/* ================= 区间聚合（复盘 / 概览带共用） ================= */

export interface RangeAgg {
  days: number; act: number; W: number; acts: number
  c: KindCount; u: number; s: { curio: number; task: number }
  sub: number; focus: number; link: number; d: number
  add: number; del: number
  peak: [string, number] | null
  list: [string, number][]
  activeRate: number
}
/** 闭区间 [from, to] 聚合（`week/month/custom` 三范围共用一套口径） */
export function aggregateRange(stats: DailyStats, from: string, to: string): RangeAgg {
  const out: RangeAgg = {
    days: 0, act: 0, W: 0, acts: 0,
    c: { res: 0, curio: 0, task: 0 }, u: 0, s: { curio: 0, task: 0 },
    sub: 0, focus: 0, link: 0, d: 0, add: 0, del: 0,
    peak: null, list: [], activeRate: 0
  }
  for (const k of Object.keys(stats.days).sort()) {
    if (k < from || k > to) continue
    const r = stats.days[k]
    out.days++; out.W += r.w
    if (r.w > 0) out.act++
    out.acts += actsOf(r)
    out.c.res += r.c.res; out.c.curio += r.c.curio; out.c.task += r.c.task
    out.u += r.u; out.s.curio += r.s.curio; out.s.task += r.s.task
    out.sub += r.sub; out.focus += r.focus; out.link += r.link; out.d += r.d
    out.add += r.x.add; out.del += r.x.del
    out.list.push([k, r.w])
    if (!out.peak || r.w > out.peak[1]) out.peak = [k, r.w]
  }
  out.W = round1(out.W)
  out.activeRate = out.days ? out.act / out.days : 0
  return out
}
