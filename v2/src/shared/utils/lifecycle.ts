/**
 * R110-LC · 资源生命周期引擎（04-58 方向①）
 *
 * 三态模型（纯计算，不落存储；归档=唯一写操作 lifecycleArchived，可逆）：
 * - 🔥 活跃：lastActive >= now-30d 或 createdAt >= now-14d（新卡宽限期）
 * - 🧊 冷却：不活跃，且 lastActive >= now-90d
 * - 📦 归档：不活跃且超 90 天，或用户手动 lifecycleArchived = true
 *
 * 三卡泛化（用户拍板：生命周期覆盖三类卡，策展台镜像跟随源卡）：
 * - 资源卡：lastActive = lastCalledAt ?? updatedAt
 * - 好奇心卡：lastActive = lastCalledAt ?? updatedAt
 * - 任务卡：lastActive = updatedAt（进行中恒活跃；已完成按 completedAt 计活跃窗口）
 */
import type { ResourceCard, TaskCard, CuriosityCard } from '../models'

export type LifecycleKind = 'resource' | 'task' | 'curiosity'
export type LifecycleState = 'active' | 'cooling' | 'archived'

/** 结构最小输入（三卡均满足；引擎只依赖这些字段） */
export interface LifecycleInput {
  kind: LifecycleKind
  status?: string
  lifecycleArchived?: boolean
  createdAt?: number
  updatedAt?: number
  lastCalledAt?: number
  completedAt?: number
  /** R113-T9：「忽略 30d」独立字段——snooze 期间恒活跃，不影响 lastCalledAt（热度排序 / WRR 口径零污染） */
  snoozedUntil?: number
  /** R117（04-61 E）：per-card 自定义冷却天数（留空 = 出厂默认 30 天；归档 = 冷却 × ARCHIVE_RATIO） */
  coolingDays?: number
}

/**
 * 阈值（毫秒）
 * - R110 / 04-58：出厂默认 30 天冷却 / 90 天归档（R117 之前为**全局写死**）
 * - R117（04-61 E）拍板：**每张卡可自定义冷却天数**，归档阈值按 ARCHIVE_RATIO（3 倍）自动推算——
 *   用户只填一个值、系统自动算，避免两个阈值互相打架（3:1 正是原 30:90 的比例）。
 */
export const DEFAULT_COOLING_DAYS = 30
export const ARCHIVE_RATIO = 3
export const COOLING_DAYS_MIN = 1
export const COOLING_DAYS_MAX = 365
export const DAY_MS = 86400_000
export const COOLING_MS = DEFAULT_COOLING_DAYS * DAY_MS
export const ARCHIVE_MS = COOLING_MS * ARCHIVE_RATIO
export const NEW_GRACE_MS = 14 * DAY_MS

/** 该卡生效的冷却天数（非法值回落默认；夹在 1–365 天内） */
export function coolingDaysOf(card: LifecycleInput): number {
  const d = Number(card.coolingDays)
  if (!Number.isFinite(d) || d <= 0) return DEFAULT_COOLING_DAYS
  return Math.min(COOLING_DAYS_MAX, Math.max(COOLING_DAYS_MIN, Math.round(d)))
}
/** 该卡生效的冷却阈值（毫秒） */
export function coolingMsOf(card: LifecycleInput): number { return coolingDaysOf(card) * DAY_MS }
/** 该卡生效的归档阈值（毫秒）= 冷却 × 3 */
export function archiveMsOf(card: LifecycleInput): number { return coolingMsOf(card) * ARCHIVE_RATIO }
/** 是否用户自定义了阈值（面板打「自定义」标识用） */
export function hasCustomThreshold(card: LifecycleInput): boolean {
  const d = Number(card.coolingDays)
  return Number.isFinite(d) && d > 0
}
/** 写入自定义冷却天数（空/非法 = 清除自定义，回落出厂默认） */
export function setCoolingDays(card: LifecycleInput, days: number | null | undefined): void {
  const d = Number(days)
  if (!Number.isFinite(d) || d <= 0) { card.coolingDays = undefined; return }
  card.coolingDays = Math.min(COOLING_DAYS_MAX, Math.max(COOLING_DAYS_MIN, Math.round(d)))
}

/** 重新激活 = 清归档标记 + 清 snooze + 重置活动时间为 now（回活跃态） */
export function reactivateCard(card: LifecycleInput): void {
  card.lifecycleArchived = undefined
  card.snoozedUntil = undefined
  card.lastCalledAt = Date.now()
  card.updatedAt = Date.now()
}

/** 卡片最近活动时间（判定基准） */
function lastActiveOf(card: LifecycleInput): number {
  if (card.kind === 'task' && card.completedAt) return card.completedAt
  return card.lastCalledAt || card.updatedAt || card.createdAt || 0
}

/** 三态判定（单卡，纯函数） */
export function lifecycleState(card: LifecycleInput, now = Date.now()): LifecycleState {
  if (card.lifecycleArchived) return 'archived'
  // R113-T9：snooze 有效期内恒活跃（替代旧「覆盖 lastCalledAt」做法——那会污染热度统计）
  if (card.snoozedUntil && card.snoozedUntil > now) return 'active'
  const last = lastActiveOf(card)
  const created = card.createdAt || 0
  // 新卡宽限期：创建 14 天内恒活跃
  if (now - created < NEW_GRACE_MS) return 'active'
  // 进行中的任务恒活跃
  if (card.kind === 'task' && card.status === 'doing') return 'active'
  // R117（04-61 E）：per-card 阈值——未自定义时回落出厂 30/90
  if (now - last >= archiveMsOf(card)) return 'archived'
  if (now - last >= coolingMsOf(card)) return 'cooling'
  return 'active'
}

/** 「忽略一个评估周期」= 写独立 snoozedUntil（不动 lastCalledAt / updatedAt——R113-T9 修复热度统计污染）。
 *  R117（04-61 E）：周期长度跟随该卡自定义冷却天数（未自定义 = 30 天），语义改为「延后一个周期再评估」。 */
export function snoozeCard(card: LifecycleInput): void {
  card.snoozedUntil = Date.now() + coolingMsOf(card)
}

export interface LifecycleEntry<R = LifecycleInput> {
  card: R
  state: LifecycleState
  /** 距上次活动的天数（归档区/冷却列表展示用） */
  daysIdle: number
}

/**
 * 批量判定：一组卡的生命周期条目（调用方先过滤软删）
 * 策展台跟随源卡：镜像卡不参与（调用方传源卡即可，镜像渲染时读源卡状态）
 */
export function lifecycleEntries(
  cards: LifecycleInput[],
  now = Date.now()
): LifecycleEntry[] {
  return cards.map(card => {
    const last = lastActiveOf(card)
    return { card, state: lifecycleState(card, now), daysIdle: Math.floor((now - last) / 86400_000) }
  })
}

/** 三态统计（面板甜甜圈/下钻数据源） */
export function lifecycleStats(
  cards: LifecycleInput[],
  now = Date.now()
): { active: number; cooling: number; archived: number; total: number } {
  let active = 0, cooling = 0, archived = 0
  for (const c of cards) {
    const st = lifecycleState(c, now)
    if (st === 'active') active++
    else if (st === 'cooling') cooling++
    else archived++
  }
  return { active, cooling, archived, total: cards.length }
}
