/**
 * 第卅三轮 REQ-020：全局统一的卡片标记排序口径。
 *
 * 规范：置顶 > 星标 > 普通命中度；两种标记独立可叠加。
 * 此前 Workspace（独立分区）、CompassActions（sort + unshift 物理插队）、
 * CuriosityPanel（只按 createdAt）三套口径各异，且置顶分组标签硬渲染导致错位，
 * 现统一收敛到本文件的 markRank / byMarksThen。
 */
import type { AnyCard } from '../models'

/** 标记权重：置顶 2，星标 1，普通 0 */
export function markRank(c: { pinned?: boolean; starred?: boolean }): number {
  if (c.pinned) return 2
  if (c.starred) return 1
  return 0
}

/**
 * 先按标记权重降序（置顶 → 星标 → 普通），权重相同时回落到传入的比较器。
 * 用法：`list.sort(byMarksThen((a, b) => b.createdAt - a.createdAt))`
 */
export function byMarksThen<T extends { pinned?: boolean; starred?: boolean }>(
  cmp: (a: T, b: T) => number
): (a: T, b: T) => number {
  return (a, b) => (markRank(b) - markRank(a)) || cmp(a, b)
}

/** 卡片是否带任一标记（用于渲染角标） */
export function hasMark(c?: AnyCard | null): boolean {
  return !!(c && (c.pinned || c.starred))
}
