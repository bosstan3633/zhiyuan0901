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
}

/** 阈值（毫秒）——04-58 拍板：本期固定 30/90 天，不做设置页配置 */
export const COOLING_MS = 30 * 86400_000
export const ARCHIVE_MS = 90 * 86400_000
export const NEW_GRACE_MS = 14 * 86400_000

/** 重新激活 = 清归档标记 + 重置活动时间为 now（回活跃态） */
export function reactivateCard(card: LifecycleInput): void {
  card.lifecycleArchived = undefined
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
  const last = lastActiveOf(card)
  const created = card.createdAt || 0
  // 新卡宽限期：创建 14 天内恒活跃
  if (now - created < NEW_GRACE_MS) return 'active'
  // 进行中的任务恒活跃
  if (card.kind === 'task' && card.status === 'doing') return 'active'
  if (now - last >= ARCHIVE_MS) return 'archived'
  if (now - last >= COOLING_MS) return 'cooling'
  return 'active'
}

/** 「忽略 30d」= 临时重置活动时间（不改变调用计数），延后 30 天再评估 */
export function snoozeCard(card: LifecycleInput): void {
  card.lastCalledAt = Date.now()
  card.updatedAt = Date.now()
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
