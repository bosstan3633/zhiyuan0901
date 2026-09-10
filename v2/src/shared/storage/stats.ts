/**
 * 资源卡打开计数 · 全端统一实现（第卅二轮 B40 自 stores/compass 下沉）
 *
 * 应用端（Pinia store.persist）与网页端（content script saveData）共用，
 * 保证 callCount / lastCalledAt / lastVisits / WRR 口径在七个打开入口完全一致。
 * 红线：stats.lastVisits 只走本函数（周重置 + WRR 累计）。
 */
import type { AppData, ResourceCard } from '@/shared/models'
import { dateKey, weekStartKey } from '@/shared/utils'

/**
 * 记录一次资源卡打开（资源台单击/双击/搜索打开/关联卡片/北极星下钻统一入口）
 * 维护：callCount、lastCalledAt、本周计数（lastVisits，跨周自动重置）、WRR 累计
 */
export function recordResourceOpen(data: AppData, resource: ResourceCard): void {
  if (!resource) return
  const now = Date.now()
  resource.callCount = (resource.callCount || 0) + 1
  resource.lastCalledAt = now

  if (data?.stats) {
    const wk = weekStartKey(dateKey(new Date()))
    const weekly = data.stats.weekly
    if (!weekly.length || weekly[weekly.length - 1].weekStart !== wk) {
      // 新的一周：重置本周计数
      data.stats.lastVisits = {}
      weekly.push({ weekStart: wk, newCount: 0, reuseCount: 0, quickCapture: 0, dupBlocked: 0 })
      if (weekly.length > 26) weekly.shift()
    }
    data.stats.lastVisits[resource.id] = (data.stats.lastVisits[resource.id] || 0) + 1
    data.stats.wrr.totalCumulativeUsage += 1
    data.stats.wrr.thisWeekUsage += 1
    data.stats.wrr.lastUpdatedAt = now
  }
}

/**
 * R47-B4：任务/好奇心卡打开计数（调起详情抽屉等「调用」动作统一入口）
 * 不进 WRR 口径（WRR 仅统计资源卡复用），只维护卡片自身的热度字段。
 */
export function recordCardOpen(data: AppData | null, card: { callCount?: number; lastCalledAt?: number } | null | undefined): void {
  if (!card) return
  card.callCount = (card.callCount || 0) + 1
  card.lastCalledAt = Date.now()
}

/** R47-B4：策展台打开计数（切换/进入策展台统一入口） */
export function recordWorkspaceOpen(data: AppData | null, ws: { callCount?: number; lastCalledAt?: number } | null | undefined): void {
  if (!ws) return
  ws.callCount = (ws.callCount || 0) + 1
  ws.lastCalledAt = Date.now()
}
