/**
 * R172-T5/T6 数据桥：知源仪表盘三段的**聚合与选中态**收口。
 *
 * 为什么单独成文件：`GlobalSettings.vue` 受 R164-2 增长门禁约束（≤3,575 行，紧约束），
 * 而仪表盘是「视图 + 数据桥 + 四个子组件」的组合体 —— 数据桥不该占视图的行数。
 *
 * 基线校准（易错点，别删）：`zy_daily_stats` 的库容是 `base + Σ(c−del)` 前缀和，
 * 而事件日志只从启用那天开始记 ⇒ 若 `base` 留 0，历史库容会被算成"从零长起来"的假曲线。
 * 这里按**真实在库数反推** `base = live − Σ(c−del)`，于是：
 *   · "截至今天"的库容恒等于真实在库数（不因日志缺失而失真）
 *   · 老数据无日志时，热力图仍走调用方的派生事件链（`timelineEvents`）
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { AppData } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { buildDailyStats, type DailyStats } from '@/shared/utils/dailyStats'

export interface LiveCounts { res: number; task: number; curio: number }

export interface DashboardData {
  /** 热力图 / 概览带共用年份（切年 = 改它） */
  year: Ref<number>
  /** ★ 时间绑定（Q11）：非空 ⇒ 概览带显示"截至那天"的库容，热力图高亮那一格 */
  selDay: Ref<string | null>
  stats: ComputedRef<DailyStats>
}

export function useDashboardStats(
  data: () => AppData,
  events: () => CardEvent[],
  live: () => LiveCounts
): DashboardData {
  const year = ref(new Date().getFullYear())
  const selDay = ref<string | null>(null)
  const stats = computed<DailyStats>(() => {
    const st = buildDailyStats(data(), events())
    const net: LiveCounts = { res: 0, task: 0, curio: 0 }
    for (const r of Object.values(st.days)) {
      net.res += r.c.res - r.del.res
      net.task += r.c.task - r.del.task
      net.curio += r.c.curio - r.del.curio
    }
    const l = live()
    st.base = {
      res: Math.max(0, l.res - net.res),
      task: Math.max(0, l.task - net.task),
      curio: Math.max(0, l.curio - net.curio),
      link: 0
    }
    return st
  })
  return { year, selDay, stats }
}
