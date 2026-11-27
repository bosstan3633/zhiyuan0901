<script setup lang="ts">

/**
 * V4.7.2：画像洞察页 —— 概览 + 时间轴 / 热力图双视图。
 *
 * 本版把已确认的高保真原型落为生产：
 *   §0 PiHero 页头（标题 / 使命与主攻 / 全库读数 / 刷新、导出、全部记录）
 *   §1 PiOverview 首屏双栏（左：本周方向；右：今天三件事）
 *   §2 观察范围双视图：时间轴（默认）/ 热力图。
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
import { aggregateRange } from '@/shared/utils/dailyStats'
import PiHero from '@/newtab/components/profile/PiHero.vue'
import { useCuriosity } from '@/newtab/stores/curiosity'
import PiAnnualHeatmap from '@/newtab/components/profile/PiAnnualHeatmap.vue'
import PiCardAnalysis from '@/newtab/components/profile/PiCardAnalysis.vue'
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
import { useProfileInsights, type GFlat, type StatDrawerType, type StatRow, type TagOptimizeJob } from './useProfileInsights'
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
type ProfileView = 'timeline' | 'analysis'
function initialProfileView(): ProfileView {
  if (route.query.view === 'analysis' || route.query.view === 'heatmap') return 'analysis'
  if (typeof location !== 'undefined' && (location.hash === '#lifecycle' || location.hash === '#lc-sec')) return 'analysis'
  return 'timeline'
}
const profileView = ref<ProfileView>(initialProfileView())
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

/* V4.4.0：周期控制与模块级 AI 洞察放在同一个控制条里。
   洞察只读当前范围事实，手动触发、临时展示，不写回 AppData。 */
const profileInsight = ref('')
const profileInsightState = ref<'idle' | 'run' | 'done' | 'off'>('idle')
const profileInsightError = ref('')
let profileInsightAbort: AbortController | null = null

const profileRangeLabel = computed(() => profileView.value === 'timeline' ? '时间轴' : '卡片分析')
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
  const from = `${dashYear.value}-01-01`
  const to = `${dashYear.value}-12-31`
  const agg = aggregateRange(dashStats.value, from, to)
  return [
    `年度窗口：${dashYear.value} 年`,
    `全年有效动作：${agg.acts} 次；活跃天数：${agg.act}/${agg.days || 365}`,
    `全年新增卡片：${agg.c.res + agg.c.curio + agg.c.task} 张；调出：${agg.u} 次`,
    `任务状态推进：${agg.s.task} 次；今日三件事完成：${agg.focus} 次；支撑关联：${agg.link} 条`,
    `当前全库：${heroKindCounts.value.res} 资源 / ${heroKindCounts.value.task} 任务 / ${heroKindCounts.value.curio} 好奇心 / ${heroKindCounts.value.topic} 选题`,
    `选题成果：在库 ${gTopicLive.value.length}，已发布 ${topicPublished.value.length}，有资源支撑 ${topicSupported.value.length}，本月新增 ${topicMonthAdded.value.length}`,
    `证据支撑率：${Math.round(heroSupportRate.value * 100)}%；近 30 天精力落主攻：${Math.round(heroFocusShare.value * 100)}%`,
    `高价值冷却卡：${lcCards.value.length} 张`,
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
          content: '你是一名严谨、克制的中文数据分析师与行动教练。只根据给定画像事实和方向树上下文分析，不编造数字、不做人格评判；数据不足时明确说明。输出 200—260 字的一段中文，依次包含：①当前时间轴或热力图最值得注意的事实；②这些行为与方向树愿景、使命、主攻项目或成功指标的匹配/偏离；③一条可立即执行、能在下一张卡或下一小时落地的行动指示。不要标题、不要 Markdown、不要客套话。',
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

watch(profileView, resetProfileInsight)
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
      :events="timelineEvents" :live-link="linkCardCount" :lc-cards="lcCards"
      @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
      @open-battle="openDayBattle" @drill="onYearDrill" />

    <!-- ===== §2 观察范围：时间轴 / 热力图双视图，默认时间轴 ===== -->
    <div class="pi-rmods pi-rmods-single">
        <div class="pi-range-toolbar">
          <div class="pi-range-control">
            <span class="pi-range-kicker">观察范围</span>
            <div class="pi-view-tabs" role="tablist" aria-label="画像洞察观察视图">
              <button
                type="button"
                class="pi-view-tab"
                :class="{ on: profileView === 'timeline' }"
                data-profile-view="timeline"
                role="tab"
                :aria-selected="profileView === 'timeline'"
                :tabindex="profileView === 'timeline' ? 0 : -1"
                @click="profileView = 'timeline'"
              >
                <Icon name="clock" :size="13" /><span>时间轴</span><small>TIMELINE</small>
              </button>
              <button
                type="button"
                class="pi-view-tab"
                :class="{ on: profileView === 'analysis' }"
                data-profile-view="analysis"
                role="tab"
                :aria-selected="profileView === 'analysis'"
                :tabindex="profileView === 'analysis' ? 0 : -1"
                @click="profileView = 'analysis'"
              >
                <Icon name="battle" :size="13" /><span>卡片分析</span><small>ANALYSIS</small>
              </button>
            </div>
          </div>
          <button class="pi-ai-trigger" :class="{ on: profileInsightState === 'done' || profileInsightState === 'run' }"
            type="button" :disabled="profileInsightState === 'run'" @click="generateProfileInsight">
            <Icon name="sparkle" :size="14" />
            {{ profileInsightState === 'run' ? '分析中…' : profileInsightState === 'done' ? '重新洞察' : 'AI 洞察' }}
          </button>
        </div>
        <section v-if="profileInsightState !== 'idle' || profileInsight || profileInsightError"
          class="pi-ai-insight" :data-state="profileInsightState" aria-label="模块 AI 洞察">
          <div class="pi-ai-head">
            <span><Icon name="sparkle" :size="14" /> {{ profileRangeLabel }} · AI 洞察</span>
            <button type="button" title="收起本次洞察" @click="resetProfileInsight">×</button>
          </div>
          <p v-if="profileInsightState === 'run'" class="pi-ai-loading">正在基于当前{{ profileRangeLabel }}的模块数据形成行为洞察与深层剖析…</p>
          <p v-else-if="profileInsight" class="pi-ai-copy">{{ profileInsight }}</p>
          <p v-else class="pi-ai-empty">{{ profileInsightError || '请先在设置中完成 AI 接入。' }}</p>
          <small>临时分析，不写入任务或画像真源。</small>
        </section>

        <PiTimeline
          v-if="profileView === 'timeline'"
          :events="timelineEvents"
          :data="gd"
          @open="openTimelineEntry"
          @open-link="openTimelineEntryLink"
        />

        <PiCardAnalysis v-else :data="gd" :total="heroTotal" :kind-counts="heroKindCounts" :entropy="heroEntropy"
          :topic-stats="{ all: gTopicLive.length, published: topicPublished.length, supported: topicSupported.length, month: topicMonthAdded.length }"
          :top-tags="heroTopTags" :support-rate="heroSupportRate" :focus-share="heroFocusShare"
          :today-import="todayImportCount"
          :lc-cards="lcCards" :focus-filter="lcFocus"
          @kpi-drill="onHeroDrill" @topic-drill="onHeroDrill"
          @lc-locate="onLcLocate" @lc-archive="onLcArchive" @lc-snooze="onLcSnooze"
          @lc-reactivate="onLcReactivate" @lc-set-days="onLcSetDays"
          @lc-settings="lcSetOpen = true" />
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
      :open="tagInsightOpen" :entropy="heroEntropy"
      :resources="gResLive" :tasks="gTaskLive"
      @close="tagInsightOpen = false" @optimize="runTagOptimizeAi" />

    <AiDrawer v-if="tagAiJob" :job="tagAiJob" :job-key="tagAiJob.key" @close="tagAiJob = null" />

    <PiMetricDetailDrawer
      :open="!!statDrawer" :title="statDrawerTitle" :rows="statShown"
      :filtered-count="statFiltered.length" :total-count="statList.length"
      :search="statSearch" :page="statPage" :page-count="statPageCount"
      :page-size="STAT_PAGE" :reconcile="statReconcile" :reconcile-note="statReconcileNote"
      @close="statDrawer = ''" @update:search="statSearch = $event"
      @page="statGo" @open-card="openStatCard" />

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
