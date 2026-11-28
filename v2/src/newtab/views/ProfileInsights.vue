<script setup lang="ts">

/**
 * V4.7.2：画像洞察页 —— 概览 + 时间轴 / 热力图双视图。
 *
 * 本版把已确认的高保真原型落为生产：
 *   §0 PiHero 页头（标题 / 使命与主攻 / 全库读数 / 刷新、导出、全部记录）
 *   §1 PiOverview 首屏双栏（左：本周方向；右：今天三件事）
 *   §2 观察范围双视图：卡片分析（默认）/ 时间轴。
 *     ① PiTimeline 按自然日倒序平铺写入与修改过的卡片，点卡看详情并可定位回卡片池；
 *     ② PiYear     保留既有年度热力图与资源生命周期。
 *
 * 单段切换取代四段纵向堆叠：★W17-C09 起默认「今天」；页签与左轨
 * 共用 activeRange，只切换当前时间尺度，不滚动到隐藏的段落。点热力格直接打开该日战报。
 *
 * 决策落实：
 *   D1 六维砍掉 → PiRhythm 用复盘段真实 kpisOf 六枚
 *   D3 下钻维持既有形态（胶囊→抽屉 / 中央大弹层只留战报与复盘）
 *   D4 ReviewPanel → 中央弹窗（Teleport）——★W13-D5 退役（2026-10-16 用户拍板）：复盘能力全量
 *     常驻页面四段，宿主零挂载；组件文件保留待复用；PiYear「目标对账」按钮随迁下线）
 *   T8 DashboardOverview 退役（本页不再引用；文件删除另行处理）
 *
 * 数据桥口径不变：readEventLog 优先，空日志回退卡片时间派生；只读 store.data 快照，
 * 写操作只经 store.persist()（lifecycle 三写 + 报告落卡）。
 */
/* ★W13-D5：ReviewPanel 弹窗挂载退役（2026-10-16）——组件文件保留待复用，宿主零 import。
   ★W13-T7：周期四尺度诊断入口随后整体退役，宿主不再构造 concise/conciseCtx，导出只保留事实读数。 */

import Icon from '@/shared/components/Icon.vue'
import '@/newtab/components/dashboard/dashboard.css'
import '@/newtab/components/profile/pi-timeline.css'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import type { AppData, TaskCard, ResourceCard } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { readEventLog } from '@/shared/utils/eventLog'
import { readErrorLog, subscribeErrorLog } from '@/shared/utils/runtimeError'
import { showToast } from '@/shared/components/toast'
import { saveUIPrefs } from '@/shared/storage/repository'
import { downloadText, stampDay } from '@/shared/utils/download'
import { uid } from '@/shared/utils'
import {
  snoozeCard, reactivateCard, setCoolingDays,
  coolingDefaultDaysOf, setCoolingDefaultDays, lifecycleState, coolingMsOf
} from '@/shared/utils/lifecycle'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'
import {
  computeTagEntropy, todayKey,
  computeTaskSupportRate, computeMainFocusShare, windowOf, tasksOfDirection,
  objectivesOf
} from '@/shared/utils/reviewReport'
import type { DirLike, TaskLike } from '@/shared/utils/reviewReport'
import PiHero from '@/newtab/components/profile/PiHero.vue'
import { useCuriosity } from '@/newtab/stores/curiosity'
import PiAnnualHeatmap from '@/newtab/components/profile/PiAnnualHeatmap.vue'
import PiCardAnalysis from '@/newtab/components/profile/PiCardAnalysis.vue'
import PiLibraryPulse from '@/newtab/components/profile/PiLibraryPulse.vue'
import PiYearMetricDrawer from '@/newtab/components/profile/PiYearMetricDrawer.vue'
import { useCompass } from '@/newtab/stores/compass'
import PiTimeline, { type PiTimelineEntry } from '@/newtab/components/profile/PiTimeline.vue'
import { openTopicOutcome } from '@/shared/utils/topicOutcome'
import { openExternalLink, toOpenableRawLink } from '@/shared/utils/link'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import TaskDetailDrawer from '@/newtab/components/compass/TaskDetailDrawer.vue'
import { recordCardOpen } from '@/shared/storage/stats'
import { useDashboardStats } from '@/newtab/components/dashboard/useDashboardStats'
import TodayBattleHost from '@/newtab/components/dashboard/TodayBattleHost.vue'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import { emitOpenDrawer } from '@/shared/utils/bus'
import PiTagDistributionDrawer from '@/newtab/components/profile/PiTagDistributionDrawer.vue'
import PiMetricDetailDrawer, { type PiStatRow, type PiReconCell } from '@/newtab/components/profile/PiMetricDetailDrawer.vue'
import PiLifecycleSettingsModal from '@/newtab/components/profile/PiLifecycleSettingsModal.vue'
import { monthStartAt, type AnyLiveCard } from '@/shared/analytics/cardInventory'
import { useProfileInsights, type GFlat, type StatDrawerType, type StatRow, type TagOptimizeJob } from './useProfileInsights'
import { useCardAnalysis } from './useCardAnalysis'
import type { CardAnalysisKind } from './useCardAnalysis'
const {
  router, store, gd, taskDetailRef, battleHost,
  openResourceLink, focusedProjects, projectProgress, projectTasksOf, isProjectStalled,
  isProjectDone, pageSub, eventLog, logEmpty, gStartOfToday,
  refreshEventLog, gFlat, derivedEvents, timelineEvents, gResLive,
  gTaskLive, gCurioLive, linkCardCount, dash, dashYear,
  dashSelDay, dashStats, dashDirections, dashTasks, heroTotal,
  tagLists, heroEntropy, topTags, heroKindCounts, heroTopTags,
  gTopicLive, topicPublished, topicSupported, topicMonthAdded,
  heroSupportRate, heroFocusShare, heroMission, heroFocusProjects, supportedTaskIds,
  focusProjectIds, todayAdd, todayCalled, todayFocus, projNameById,
  matchResourcesOf, todayRows, todayFilled, todayAmmo,
  overviewWeekRange,
  logOpen, logPreset, openLog, openLogFocus, statDrawer,
  tagInsightOpen, tagAiJob, goalDirId, topicTag, totalCards,
  statList, todayCreatedEventIds, todayCalledIds, todayInCards, todayCalledCards,
  ammoSplit, ammoCards, coolingCards, STAT_PAGE, statPage,
  statSearch, openStatDrawer, statFiltered, statPageCount, statShown,
  statGo, openStatCard, openTagDistribution, runTagOptimizeAi, statDrawerTitle,
  statReconcile, statReconcileNote, gStartOfWeek, gStartOfMonth, todayImportCount,
  weekImportCount, lcCards, lcFind, onLcArchive, onLcSnooze,
  onLcReactivate, onLcSetDays, onLcLocate, lcSetOpen, lcDefaultDraft,
  saveLcDefault, lcFocus, yCoolHigh, yDirFit, wakeCooling,
  onYearDrill, yearMetricDrawer, yearMetricMode, yearMetricTitle, yearMetricNote,
  yearMetricDays, yearMetricCardRows, openYearMetricDay, openYearMetricCard,
  openTodayBattle, openDayBattle, onHeroDrill, onHeroRefresh,
  gotoCompass, onHeroExport, onTodayDrill, onRhythmDrill, mEntTrend,
  mTopics, mUntagged, mFunnel, mProjected,
  onMonthDrill, onMonthTopic, onGoalDrill,
  errorLogCount, refreshErrorCount, offErrLog, exportErrorLog, fmtDayKey,
  fmtDay,
} = useProfileInsights()

const route = useRoute()
const { model: cardAnalysis } = useCardAnalysis(gd, timelineEvents)
const activeCardKind = ref<CardAnalysisKind>('task')
const CARD_KIND_LABEL: Record<CardAnalysisKind, string> = {
  task: '任务卡',
  resource: '资源卡',
  curiosity: '好奇心卡',
  topic: '选题卡',
}

type ProfileView = 'timeline' | 'analysis'
function initialProfileView(): ProfileView {
  if (route.query.view === 'timeline') return 'timeline'
  return 'analysis'
}
const profileView = ref<ProfileView>(initialProfileView())
const PROFILE_VIEWS: ProfileView[] = ['timeline', 'analysis']
function activateProfileView(view: ProfileView, moveFocus = false): void {
  profileView.value = view
  if (!moveFocus) return
  requestAnimationFrame(() => document.getElementById(`pi-view-tab-${view}`)?.focus())
}
function onProfileViewKeydown(event: KeyboardEvent, current: ProfileView): void {
  const index = PROFILE_VIEWS.indexOf(current)
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    activateProfileView(PROFILE_VIEWS[(index + 1) % PROFILE_VIEWS.length], true)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    activateProfileView(PROFILE_VIEWS[(index - 1 + PROFILE_VIEWS.length) % PROFILE_VIEWS.length], true)
  } else if (event.key === 'Home') {
    event.preventDefault()
    activateProfileView(PROFILE_VIEWS[0], true)
  } else if (event.key === 'End') {
    event.preventDefault()
    activateProfileView(PROFILE_VIEWS[PROFILE_VIEWS.length - 1], true)
  }
}
function openTimelineEntry(entry: PiTimelineEntry): void {
  if (entry.kind === 'task') {
    const task = gd.value.tasks.find(row => row.id === entry.id && !row.deletedAt)
    if (task) {
      recordCardOpen(gd.value, task)
      taskDetailRef.value?.open(task)
      return
    }
  }
  const drawerKind = entry.kind === 'resource' ? 'res' : entry.kind === 'topic' ? 'topic' : entry.kind === 'curiosity' ? 'curio' : ''
  if (drawerKind) {
    emitOpenDrawer({ kind: drawerKind, id: entry.id })
    return
  }
  showToast('该卡片已不在库中')
}

function openTimelineEntryLink(entry: PiTimelineEntry): void {
  if (entry.kind === 'resource') {
    const resource = (gd.value.resources || []).find(row => row.id === entry.id)
    if (resource) {
      openResourceLink(resource)
      return
    }
  }
  if (entry.kind === 'topic') {
    const topic = (gd.value.topics || []).find(row => row.id === entry.id)
    if (topic && openTopicOutcome(topic)) return
    showToast('这张选题卡还没有可打开的成果链接')
    return
  }
  if (entry.kind === 'task') {
    const task = (gd.value.tasks || []).find(row => row.id === entry.id)
    const url = toOpenableRawLink(task?.link)
    if (url && openExternalLink(url)) return
    showToast('这张任务卡还没有可打开的链接')
    return
  }
  showToast('这张卡片没有可打开的链接')
}

function openAnalysisCard(payload: { kind: CardAnalysisKind; id: string }): void {
  if (payload.kind === 'task') {
    const task = (gd.value.tasks || []).find(row => row.id === payload.id && !row.deletedAt)
    if (!task) { showToast('该任务已不在库中'); return }
    recordCardOpen(gd.value, task)
    taskDetailRef.value?.open(task)
    return
  }
  const drawerKind = payload.kind === 'resource' ? 'res' : payload.kind === 'topic' ? 'topic' : 'curio'
  emitOpenDrawer({ kind: drawerKind, id: payload.id })
}

type LibraryAddedScope = 'month' | 'import'
const libraryAddedOpen = ref(false)
const libraryAddedScope = ref<LibraryAddedScope>('month')
const libraryAddedSearch = ref('')
const libraryAddedPage = ref(1)
const LIBRARY_ADDED_PAGE_SIZE = 20 as const

function libraryCardTitle(card: AnyLiveCard): string {
  return card.kind === 'curiosity' ? (card.question || '（无标题好奇心）') : (card.title || '（无标题卡片）')
}

const libraryAddedCards = computed<AnyLiveCard[]>(() => {
  const all: AnyLiveCard[] = [
    ...cardAnalysis.value.inventory.live.resources,
    ...cardAnalysis.value.inventory.live.tasks,
    ...cardAnalysis.value.inventory.live.curiosities,
    ...cardAnalysis.value.inventory.live.topics,
  ]
  const cutoff = libraryAddedScope.value === 'import' ? gStartOfToday : monthStartAt()
  const stampOf = (card: AnyLiveCard) => libraryAddedScope.value === 'import'
    ? Number(card.importedAt) || 0
    : Number(card.createdAt) || 0
  return all
    .filter(card => stampOf(card) >= cutoff)
    .sort((a, b) => stampOf(b) - stampOf(a) || libraryCardTitle(a).localeCompare(libraryCardTitle(b), 'zh-CN'))
})
const libraryAddedFiltered = computed(() => {
  const query = libraryAddedSearch.value.trim().toLowerCase()
  if (!query) return libraryAddedCards.value
  return libraryAddedCards.value.filter(card =>
    libraryCardTitle(card).toLowerCase().includes(query)
    || String(card.kind).includes(query))
})
const libraryAddedPageCount = computed(() =>
  Math.max(1, Math.ceil(libraryAddedFiltered.value.length / LIBRARY_ADDED_PAGE_SIZE)))
const libraryAddedRows = computed<PiStatRow[]>(() => {
  const start = (libraryAddedPage.value - 1) * LIBRARY_ADDED_PAGE_SIZE
  return libraryAddedFiltered.value.slice(start, start + LIBRARY_ADDED_PAGE_SIZE).map(card => ({
    kind: card.kind,
    id: card.id,
    title: libraryCardTitle(card),
    ts: Number(libraryAddedScope.value === 'import' ? card.importedAt : card.createdAt) || 0,
    owner: card.kind === 'curiosity' ? '好奇心' : card.kind === 'resource' ? '资源' : card.kind === 'task' ? '任务' : '选题',
  }))
})
const libraryAddedTitle = computed(() =>
  libraryAddedScope.value === 'import'
    ? `今日导入卡片（${libraryAddedCards.value.length}）`
    : `本月新增卡片（${libraryAddedCards.value.length}）`)
const libraryAddedNote = computed(() =>
  libraryAddedScope.value === 'import'
    ? '按 importedAt 统计：导入继承原 createdAt，不混入今天新建；与全库总览的“导 N”同源。'
    : `按 createdAt ≥ ${new Date(monthStartAt()).toLocaleDateString('zh-CN')} 统计；与全库总览的“本月 +N”同源，不读事件流水。`)
const libraryAddedReconcile = computed<PiReconCell[]>(() => [
  { k: '当前口径', n: libraryAddedScope.value === 'import' ? '今日导入' : '本月新增' },
  { k: '卡片总数', n: String(libraryAddedCards.value.length), u: '张' },
])

const libraryTagLists = computed(() => [
  ...cardAnalysis.value.inventory.live.resources.map(card => card.tags || []),
  ...cardAnalysis.value.inventory.live.tasks.map(card => card.tags || []),
  ...cardAnalysis.value.inventory.live.curiosities.map(card => card.tags || []),
  ...cardAnalysis.value.inventory.live.topics.map(card => card.tags || []),
])
const libraryTagEntropy = computed(() => computeTagEntropy(libraryTagLists.value))

function openLibraryAdded(scope: LibraryAddedScope): void {
  libraryAddedScope.value = scope
  libraryAddedSearch.value = ''
  libraryAddedPage.value = 1
  libraryAddedOpen.value = true
}

function pageLibraryAdded(delta: number): void {
  libraryAddedPage.value = Math.max(1, Math.min(libraryAddedPageCount.value, libraryAddedPage.value + delta))
}

function openLibraryAddedCard(row: PiStatRow): void {
  const card = libraryAddedCards.value.find(item => item.id === row.id && item.kind === row.kind)
  if (!card) return
  libraryAddedOpen.value = false
  if (row.kind === 'resource' && openResourceLink(card as AnyLiveCard & { kind: 'resource' })) return
  openAnalysisCard({ kind: row.kind, id: row.id })
}

function onLibraryPulseDrill(key: 'all' | 'effective-support' | 'focus' | 'yr-active' | 'yr-streak' | 'yr-high'): void {
  if (key === 'all') { openStatDrawer('all'); return }
  if (key === 'effective-support') { openStatDrawer('effective-support'); return }
  if (key === 'focus') { openLogFocus(); return }
  onYearDrill(key)
}

/* V4.4.0：周期控制与模块级 AI 洞察放在同一个控制条里。
   洞察只读当前范围事实，手动触发、临时展示，不写回 AppData。 */
const profileInsight = ref('')
const profileInsightState = ref<'idle' | 'run' | 'done' | 'off'>('idle')
const profileInsightError = ref('')
let profileInsightAbort: AbortController | null = null

const profileRangeLabel = computed(() =>
  profileView.value === 'timeline' ? '时间轴' : `${CARD_KIND_LABEL[activeCardKind.value]}分析`)
const timelineWindowStart = Date.now() - 30 * 24 * 60 * 60 * 1000

const directionContext = computed(() => {
  const compass = gd.value.compass
  if (!compass) return ['方向树：暂未配置']
  const rows = [`愿景：${compass.vision?.content || '未填写'}`, `使命：${compass.mission?.content || '未填写'}`]
  for (const direction of (compass.directions || []).slice(0, 4)) {
    const projects = (direction.projects || []).slice(0, 3).map(project => project.name).join('、')
    rows.push(`战略目标：${direction.name}${projects ? `；项目：${projects}` : ''}`)
  }
  const metrics = (compass.directions || [])
    .flatMap(direction => direction.projects || [])
    .flatMap(project => project.metrics || [])
    .slice(0, 6)
    .map(metric => metric.title)
  if (metrics.length) rows.push(`关键成功指标：${metrics.join('、')}`)
  return rows
})

const profileInsightFacts = computed(() => {
  if (profileView.value === 'timeline') {
    const liveIds = new Set<string>([
      ...(gd.value.resources || []).filter(card => !card.deletedAt).map(card => `resource:${card.id}`),
      ...(gd.value.tasks || []).filter(card => !card.deletedAt).map(card => `task:${card.id}`),
      ...(gd.value.topics || []).filter(card => !card.deletedAt).map(card => `topic:${card.id}`),
      ...(gd.value.curiosities || []).filter(card => !card.deletedAt).map(card => `curiosity:${card.id}`),
    ])
    const tracked = timelineEvents.value.filter(event =>
      event.ts >= timelineWindowStart
      && event.kind !== 'system'
      && ['create', 'status'].includes(event.action)
      && liveIds.has(`${event.kind}:${event.cardId}`))
    const days = new Set(tracked.map(event => new Date(event.ts).toLocaleDateString('sv-SE')))
    const cardIds = new Set(tracked.map(event => `${event.kind}:${event.cardId}`))
    const kindCounts = tracked.reduce<Record<string, number>>((acc, event) => {
      acc[event.kind] = (acc[event.kind] || 0) + 1
      return acc
    }, {})
    const statusChanges = tracked.filter(event => event.action === 'status').length
    const recent = tracked.slice(0, 5).map(event => `${event.title}（${event.kind}）`)
    return [
      `时间轴覆盖：近 30 天 ${days.size} 个活跃日，${cardIds.size} 张卡片`,
      `写入与修改事件：${tracked.length} 次`,
      `状态变化：${statusChanges} 次；类型分布：${Object.entries(kindCounts).map(([kind, count]) => `${kind} ${count}`).join(' / ') || '暂无'}`,
      `最近动作：${recent.length ? recent.join('；') : '暂无'}`,
      `当前全库：${heroKindCounts.value.res} 资源 / ${heroKindCounts.value.task} 任务 / ${heroKindCounts.value.curio} 好奇心 / ${heroKindCounts.value.topic} 选题`,
    ]
  }
  const a = cardAnalysis.value
  const common = [
    `当前全库：${a.inventory.counts.resource} 资源 / ${a.inventory.counts.task} 任务 / ${a.inventory.counts.curiosity} 好奇心 / ${a.inventory.counts.topic} 选题；本月新增 ${a.inventory.monthAdded} 张`,
    `近 12 个月活跃资产：${a.inventory.active12m} 张；高价值冷却：${a.inventory.highValueCooling} 张；任务有效资源支撑率：${a.evidence.effectiveTaskSupportRate}%；近 30 天精力落主攻：${a.focusShare}%`,
  ]
  if (activeCardKind.value === 'task') {
    const block = a.task
    const projectTop = block.projectDistribution.slice(0, 4)
      .map(row => `${row.label} ${row.count}`).join(' / ')
    return [
      `任务卡在库 ${block.liveCount} 张；完成 ${block.doneCount} 张（${block.doneRate}%）；挂项目或指标 ${block.attachedCount} 张（项目 ${block.projectAttachedCount} / 指标 ${block.metricAttachedCount}）`,
      `已落图 ${block.scheduledCount} 张，未落图 ${block.unscheduledCount} 张`,
      `曾进入三件事 ${block.focusEnteredCount} 张，从未进入 ${block.focusNeverCount} 张；平均 ${block.focusAverageEntered} 次（仅曾进入分母），全库摊平 ${block.focusAverageAll} 次，单任务最高 ${block.focusMax} 次`,
      `无有效资源支撑 ${block.noSupportCount} 张；归属冲突 ${block.conflictCount} 张（其中歧义 ${block.ambiguousCount} 张）`,
      `项目归属分布：${projectTop || '暂无'}`,
      ...common,
    ]
  }
  if (activeCardKind.value === 'resource') {
    const block = a.resource
    const links = block.linkDistribution.map(row => `${row.label} ${row.count}`).join(' / ')
    return [
      `资源卡在库 ${block.liveCount} 张；链接可用 ${block.linkedCount} 张，无链接 ${block.noLinkCount} 张`,
      `被活任务引用 ${block.taskReferencedCount} 张；零引用 ${block.zeroReferenceCount} 张；近 30 天真实调出 ${block.recentCalledCount} 张`,
      `从未调用 ${block.neverCalledCount} 张；高价值冷却 ${block.highValueCoolingCount} 张（冷却且历史调用 ≥ 3）`,
      `链接构成：${links || '暂无'}`,
      `资源引用按当前关系表统计，解绑会立即回落，不把关系表当历史墓碑`,
      ...common,
    ]
  }
  if (activeCardKind.value === 'curiosity') {
    const block = a.curiosity
    return [
      `好奇心卡在库 ${block.liveCount} 张；待探索 ${block.todoCount} / 探索中 ${block.doingCount} / 已求证 ${block.doneCount} / 已搁置 ${block.shelfCount}`,
      `有计划 ${block.plannedCount} 张；有来源 ${block.sourcedCount} 张；有附件 ${block.assetCount} 张；有资源支撑 ${block.supportedCount} 张`,
      `超过 30 天未动 ${block.staleCount} 张；已转化 ${block.convertedCount} 张（独立事实标记，不混入状态桶）`,
      '好奇心卡没有项目 / 指标字段，不做伪分组；三件事历史频次只统计任务与选题',
      ...common,
    ]
  }
  const block = a.topic
  const statuses = block.statusDistribution.map(row => `${row.label} ${row.count}`).join(' / ')
  return [
    `选题卡在库 ${block.liveCount} 张；完成 / 发布态 ${block.completedCount} 张（只读 topicStatuses.terminal，不推算真实发布时间）`,
    `有计划 ${block.plannedCount} 张；进入三件事 ${block.focusEnteredCount} 张，从未进入 ${block.focusNeverCount} 张，平均 ${block.focusAverageEntered} 次`,
    `挂项目或指标 ${block.attachedCount} 张；有资源支撑 ${block.supportedCount} 张；本月新增 ${block.monthAddedCount} 张；近 30 天新增 ${block.recent30AddedCount} 张；有成果链接 ${block.outcomeCount} 张（不等同已发布）`,
    `选题状态分布：${statuses || '暂无'}`,
    ...common,
  ]
})

function resetProfileInsight(): void {
  profileInsightAbort?.abort()
  profileInsightAbort = null
  profileInsight.value = ''
  profileInsightError.value = ''
  profileInsightState.value = 'idle'
}

async function generateProfileInsight(): Promise<void> {
  if (profileInsightState.value === 'run') return
  profileInsightState.value = 'run'
  profileInsightError.value = ''
  profileInsightAbort?.abort()
  profileInsightAbort = new AbortController()
  try {
    const [cfgMod, llm] = await Promise.all([
      import('@/shared/ai/config'),
      import('@/shared/ai/llm'),
    ])
    await cfgMod.loadAiConfig()
    if (!cfgMod.aiReady.value) {
      profileInsightState.value = 'off'
      showToast('请先在 设置 → AI 助手 完成接入')
      return
    }
    const focusText = heroFocusProjects.value.length
      ? heroFocusProjects.value.map(p => `${p.name}（${p.progress}%，未完成 ${p.open} 项）`).join('；')
      : '暂无主攻项目'
    const raw = await llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一名严谨、克制的中文数据分析师与行动教练。只根据给定画像事实和方向树上下文分析，不编造数字、不做人格评判；数据不足时明确说明。输出 200—260 字的一段中文，依次包含：①当前观察视图最值得注意的事实；②这些事实与方向树愿景、使命、主攻项目或成功指标的匹配/偏离；③一条可立即执行、能在下一张卡或下一小时落地的行动指示。不要标题、不要 Markdown、不要客套话。',
        },
        {
          role: 'user',
          content: [
            `观察范围：${profileRangeLabel.value}`,
            `使命主线：${heroMission.value || '未填写'}`,
            `主攻项目：${focusText}`,
            '方向树上下文：',
            ...directionContext.value.map(line => `- ${line}`),
            `当前范围事实：`,
            ...profileInsightFacts.value.map(line => `- ${line}`),
          ].join('\n'),
        },
      ],
      maxTokens: 420,
      temperature: 0.35,
      signal: profileInsightAbort.signal,
    })
    const clean = raw.replace(/\s+/g, ' ').trim()
    profileInsight.value = clean.length > 200 ? `${clean.slice(0, 199)}…` : clean
    profileInsightState.value = profileInsight.value ? 'done' : 'idle'
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    profileInsightError.value = error instanceof Error ? error.message : String(error)
    profileInsightState.value = 'idle'
  }
}

watch([profileView, activeCardKind], resetProfileInsight)
watch(() => route.query.view, value => {
  if (value === 'timeline' || value === 'analysis') profileView.value = value
  else if (value === 'heatmap') profileView.value = 'analysis'
})
</script>
<template>
  <div class="pi-page">
    <!-- ===== §0 Hero 页头：只保留页面级动作 ===== -->
    <PiHero :error-count="errorLogCount"
      @refresh="onHeroRefresh" @export="onHeroExport"
      @export-error="exportErrorLog" @open-log="openLog('log')" />

    <PiAnnualHeatmap :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
      :events="timelineEvents" :live-link="linkCardCount"
      @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
      @open-battle="openDayBattle" />

    <PiLibraryPulse :analysis="cardAnalysis" :stats="dashStats" :year="dashYear" :entropy="libraryTagEntropy"
      :today-import="todayImportCount"
      @drill="onLibraryPulseDrill" @tag="openTagDistribution" @month-added="openLibraryAdded" />

    <!-- ===== §2 观察范围：时间轴 / 卡片分析双视图，默认卡片分析 ===== -->
    <div class="pi-rmods pi-rmods-single">
        <div class="pi-range-toolbar">
          <div class="pi-range-control">
            <span class="pi-range-kicker">观察范围</span>
            <div class="pi-view-tabs" role="tablist" aria-label="画像洞察观察视图">
              <button
                id="pi-view-tab-timeline"
                type="button"
                class="pi-view-tab"
                :class="{ on: profileView === 'timeline' }"
                data-profile-view="timeline"
                role="tab"
                :aria-selected="profileView === 'timeline'"
                aria-controls="pi-view-panel-timeline"
                :tabindex="profileView === 'timeline' ? 0 : -1"
                @click="activateProfileView('timeline')"
                @keydown="onProfileViewKeydown($event, 'timeline')"
              >
                <Icon name="clock" :size="13" /><span>时间轴</span><small>TIMELINE</small>
              </button>
              <button
                id="pi-view-tab-analysis"
                type="button"
                class="pi-view-tab"
                :class="{ on: profileView === 'analysis' }"
                data-profile-view="analysis"
                role="tab"
                :aria-selected="profileView === 'analysis'"
                aria-controls="pi-view-panel-analysis"
                :tabindex="profileView === 'analysis' ? 0 : -1"
                @click="activateProfileView('analysis')"
                @keydown="onProfileViewKeydown($event, 'analysis')"
              >
                <Icon name="battle" :size="13" /><span>卡片分析</span><small>ANALYSIS</small>
              </button>
            </div>
          </div>
          <button class="pi-ai-trigger" :class="{ on: profileInsightState === 'done' || profileInsightState === 'run' }"
            type="button" :disabled="profileInsightState === 'run'"
            aria-controls="pi-ai-insight" :aria-expanded="profileInsightState !== 'idle' || !!profileInsight || !!profileInsightError"
            @click="generateProfileInsight">
            <Icon name="sparkle" :size="14" />
            {{ profileInsightState === 'run' ? '分析中…' : profileInsightState === 'done' ? '重新洞察' : 'AI 洞察' }}
          </button>
        </div>
        <section v-if="profileInsightState !== 'idle' || profileInsight || profileInsightError"
          id="pi-ai-insight" class="pi-ai-insight" :data-state="profileInsightState"
          role="status" aria-live="polite" aria-label="模块 AI 洞察">
          <div class="pi-ai-head">
            <span><Icon name="sparkle" :size="14" /> {{ profileRangeLabel }} · AI 洞察</span>
            <button type="button" title="收起本次洞察" @click="resetProfileInsight">×</button>
          </div>
          <p v-if="profileInsightState === 'run'" class="pi-ai-loading">正在基于当前{{ profileRangeLabel }}的模块数据形成行为洞察与深层剖析…</p>
          <p v-else-if="profileInsight" class="pi-ai-copy">{{ profileInsight }}</p>
          <p v-else class="pi-ai-empty">{{ profileInsightError || '请先在设置中完成 AI 接入。' }}</p>
          <small>临时分析，不写入任务或画像真源。</small>
        </section>

        <section v-if="profileView === 'timeline'" id="pi-view-panel-timeline" class="pi-view-panel"
          role="tabpanel" aria-labelledby="pi-view-tab-timeline">
          <PiTimeline
            :events="timelineEvents"
            :data="gd"
            @open="openTimelineEntry"
            @open-link="openTimelineEntryLink"
          />
        </section>

        <section v-else id="pi-view-panel-analysis" class="pi-view-panel"
          role="tabpanel" aria-labelledby="pi-view-tab-analysis">
          <PiCardAnalysis v-model:kind="activeCardKind" :analysis="cardAnalysis"
            :lc-cards="lcCards" :focus-filter="lcFocus"
            @open-card="openAnalysisCard"
            @lc-locate="onLcLocate" @lc-archive="onLcArchive" @lc-snooze="onLcSnooze"
            @lc-reactivate="onLcReactivate" @lc-set-days="onLcSetDays"
            @lc-settings="lcSetOpen = true" />
        </section>
    </div>

    <!-- ★W12-B 底栏整条删除：原先这里挂着「只读纪律」免责文字 + 一枚「全部记录」。
     「全部记录」已上提为页头全页唯一入口（PiHero），近期模块里那一枚重复入口一并收掉；
     「只读纪律」那段文字按用户 2026-10-13 拍板不留。 -->

    <!-- ★W13-D5 复盘弹窗退役（2026-10-16 用户拍板）：原挂载的中央大弹层（ReviewPanel）
     「周/月/年复盘」能力已全量常驻页面四段模块（今日三件事 / 本周节律 / 本月沉淀 / 全年足迹），
     目标对账明细由 PiRhythm 战略目标点行（goal-week 抽屉）承接；组件文件保留待复用（同 CatPicker 先例）。 -->

    <PiLifecycleSettingsModal
      :open="lcSetOpen" :default-draft="lcDefaultDraft" :cards="lcCards"
      @close="lcSetOpen = false" @save-default="saveLcDefault"
      @update:default-draft="lcDefaultDraft = $event" @set-days="onLcSetDays" />

    <!-- ===== 全量记录抽屉（页面自身下钻用；战报自己的「查看全部记录」由 TodayBattleHost 承接） ===== -->
    <DashboardLogDrawer :open="logOpen" :events="timelineEvents" :data="gd" :preset="logPreset" @close="logOpen = false" />

    <TaskDetailDrawer ref="taskDetailRef" />

    <PiTagDistributionDrawer
      :open="tagInsightOpen" :entropy="libraryTagEntropy"
      :resources="gResLive" :tasks="gTaskLive"
      :curiosities="gCurioLive" :topics="gTopicLive"
      @close="tagInsightOpen = false" @optimize="runTagOptimizeAi" />

    <AiDrawer v-if="tagAiJob" :job="tagAiJob" :job-key="tagAiJob.key" @close="tagAiJob = null" />

    <PiMetricDetailDrawer
      :open="!!statDrawer" :title="statDrawerTitle" :rows="statShown"
      :filtered-count="statFiltered.length" :total-count="statList.length"
      :search="statSearch" :page="statPage" :page-count="statPageCount"
      :page-size="STAT_PAGE" :reconcile="statReconcile" :reconcile-note="statReconcileNote"
      @close="statDrawer = ''" @update:search="statSearch = $event"
      @page="statGo" @open-card="openStatCard" />

    <PiMetricDetailDrawer
      :open="libraryAddedOpen" :title="libraryAddedTitle" :rows="libraryAddedRows"
      :filtered-count="libraryAddedFiltered.length" :total-count="libraryAddedCards.length"
      :search="libraryAddedSearch" :page="libraryAddedPage" :page-count="libraryAddedPageCount"
      :page-size="LIBRARY_ADDED_PAGE_SIZE" :reconcile="libraryAddedReconcile" :reconcile-note="libraryAddedNote"
      @close="libraryAddedOpen = false"
      @update:search="libraryAddedSearch = $event; libraryAddedPage = 1"
      @page="pageLibraryAdded" @open-card="openLibraryAddedCard" />

    <PiYearMetricDrawer
      :open="!!yearMetricDrawer" :mode="yearMetricMode" :title="yearMetricTitle" :note="yearMetricNote"
      :days="yearMetricDays" :cards="yearMetricCardRows"
      @close="yearMetricDrawer = ''" @open-day="openYearMetricDay" @open-card="openYearMetricCard" />

    <!-- ★W13-D5/F28：「动态条明细抽屉」（dynDrawer）已退役——事件时间窗下钻统一走
     DashboardLogDrawer（month-add → openLog('month-in')；主攻动作 → openLogFocus()）。 -->

    <!-- ===== 今日战报：与调度台共用同一宿主（事件桥 / 日详情 / 全量记录 / 导出均为单源） ===== -->
    <TodayBattleHost ref="battleHost" />
  </div>
</template>

<style scoped src="./ProfileInsights.css"></style>
