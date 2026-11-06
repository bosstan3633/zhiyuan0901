import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { ComputedRef } from 'vue'
import type { CuriosityCard, TaskCard, ResourceCard } from '@/shared/models'
import {
  computeTagEntropy, todayKey,
  computeTaskSupportRate, computeMainFocusShare, windowOf, tasksOfDirection,
  buildConciseInsights, objectivesOf
} from '@/shared/utils/reviewReport'
import PiMonth, { type MonthTopic } from '@/newtab/components/profile/PiMonth.vue'
import type { useProfileInsights } from './useProfileInsights'

export function useProfileInsightsMonth(deps: Pick<ReturnType<typeof useProfileInsights>, 'gd' | 'gStartOfMonth' | 'heroEntropy' | 'gResLive' | 'projNameById' | 'gCurioLive' | 'gTaskLive' | 'openLog' | 'openStatDrawer'>): {
  mEntTrend: ComputedRef<{ from: number; to: number }>
  mTopics: ComputedRef<MonthTopic[]>
  mUntagged: ComputedRef<number>
  mFunnel: ComputedRef<{ pool: number; support: number; curate: number; convPct: number; sinkPct: number }>
  mProjected: ComputedRef<number>
  onMonthDrill: (k: 'mo-support' | 'mo-add' | 'mo-call' | 'mo-curate') => void
} {
  const { gd, gStartOfMonth, heroEntropy, gResLive, projNameById, gCurioLive, gTaskLive, openLog, openStatDrawer } = deps
const mEntTrend = computed(() => {
  /* 口径与 heroEntropy（tagLists）严格同源：只统计资源+任务两类存活卡的 tags（不含好奇心卡），
     from 仅按 createdAt 截断到本月初——历史时点的真实全量已不可回放，此为诚实近似快照。 */
  const before = [
    ...gd.value.resources.filter(r => !r.deletedAt && (r.createdAt || 0) < gStartOfMonth).map(r => r.tags || []),
    ...gd.value.tasks.filter(t => !t.deletedAt && (t.createdAt || 0) < gStartOfMonth).map(t => t.tags || [])
  ]
  return { from: computeTagEntropy(before), to: heroEntropy.value }
})
/* F18：本月新建资源卡 Top3 标签 + 各自主要服务的攻坚项目（卡 → SupportLink → 任务 → projectId 投票） */
const mTopics = computed<MonthTopic[]>(() => {
  const res = gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth)
  const cnt = new Map<string, number>()
  const votes = new Map<string, Map<string, number>>()
  const taskById = new Map((gd.value.tasks || []).map(t => [t.id, t]))
  for (const r of res) {
    const tags = [...new Set((r.tags || []).map(t => t.trim()).filter(Boolean))]
    const pids: string[] = []
    for (const l of gd.value.supportLinks || []) {
      if (l.resourceId !== r.id) continue
      const pid = taskById.get(l.taskId)?.projectId
      if (pid) pids.push(pid)
    }
    for (const t of tags) {
      cnt.set(t, (cnt.get(t) || 0) + 1)
      let m = votes.get(t)
      if (!m) { m = new Map(); votes.set(t, m) }
      for (const p of pids) m.set(p, (m.get(p) || 0) + 1)
    }
  }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([tag, n]) => {
    const m = votes.get(tag)
    let pid = '', best = 0
    if (m) for (const [p, v] of m) if (v > best) { best = v; pid = p }
    return { tag, n, project: pid ? projNameById.value.get(pid) || '' : '' }
  })
})
const mUntagged = computed(() => gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth && !(r.tags || []).some(t => t.trim())).length)
/* F19 三步漏斗（口径见组件 funnel-note：②转化=新支撑÷入池资源；③沉淀=新论点÷入池总张） */
const mFunnel = computed(() => {
  const resIn = gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth).length
  const curioIn = gCurioLive.value.filter(c => (c.createdAt || 0) >= gStartOfMonth).length
  const pool = resIn + curioIn
  const links = (gd.value.supportLinks || []).filter(l => (l.createdAt || 0) >= gStartOfMonth).length
  const doneTasks = gTaskLive.value.filter(t => (t.completedAt || 0) >= gStartOfMonth).length
  const curate = (gd.value.argCards || []).filter(a => !a.deletedAt && (a.createdAt || 0) >= gStartOfMonth).length
  return {
    pool, support: links + doneTasks, curate,
    convPct: resIn ? Math.round(links / resIn * 100) : 0,
    sinkPct: pool ? Math.round(curate / pool * 100) : 0
  }
})
/* F17 金字塔现存量：CurationProjection 表无 createdAt 字段，按月口径不可得——
   strip 格用全量现存量（title 里写明），"本月新增"语义只落③的 ArgumentCard（有时间戳）。 */
const mProjected = computed(() => (gd.value.curationProjections || []).filter(p => p.kind === 'card').length)
function onMonthDrill(k: 'mo-add' | 'mo-call' | 'mo-support' | 'mo-curate') {
  if (k === 'mo-add') openLog('month-in')
  else if (k === 'mo-call') openLog('log')
  else if (k === 'mo-support') openStatDrawer('mo-support')
  else openStatDrawer('curated')
}

  return {
    mEntTrend, mTopics, mUntagged, mFunnel, mProjected, onMonthDrill,
  }
}
