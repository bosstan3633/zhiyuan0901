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
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import type { AppData, TaskCard, ResourceCard } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { readEventLog } from '@/shared/utils/eventLog'
import { readErrorLog, subscribeErrorLog } from '@/shared/utils/runtimeError'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
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
import PiYear from '@/newtab/components/profile/PiYear.vue'
import PiYearMetricDrawer from '@/newtab/components/profile/PiYearMetricDrawer.vue'
import PiOverview, { type FocusProjectView } from '@/newtab/components/profile/PiOverview.vue'
import { useCompass } from '@/newtab/stores/compass'
import PiTimeline, { type PiTimelineEntry } from '@/newtab/components/profile/PiTimeline.vue'
import PiTimelineDrawer from '@/newtab/components/profile/PiTimelineDrawer.vue'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import ProjectDetailDrawer from '@/newtab/components/ProjectDetailDrawer.vue'
import TaskDetailDrawer from '@/newtab/components/compass/TaskDetailDrawer.vue'
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
  projDetailOpen, projDetailId, openProjectDetail,
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

type ProfileView = 'timeline' | 'heatmap'
const profileView = ref<ProfileView>(
  typeof location !== 'undefined' && (location.hash === '#lifecycle' || location.hash === '#lc-sec')
    ? 'heatmap'
    : 'timeline',
)
const timelineEntry = ref<PiTimelineEntry | null>(null)
const timelineOpen = ref(false)

function openTimelineEntry(entry: PiTimelineEntry): void {
  timelineEntry.value = entry
  timelineOpen.value = true
}

function locateTimelineEntry(entry: PiTimelineEntry): void {
  const kind = asLocateKind(entry.kind)
  const target = kind ? locateTargetOf(gd.value, kind, entry.id) : null
  if (!target) {
    showToast('该卡片已不在库中')
    return
  }
  timelineOpen.value = false
  void router.push(target)
  showToast('已定位到卡片池')
}

/* V4.4.0：周期控制与模块级 AI 洞察放在同一个控制条里。
   洞察只读当前范围事实，手动触发、临时展示，不写回 AppData。 */
const profileInsight = ref('')
const profileInsightState = ref<'idle' | 'run' | 'done' | 'off'>('idle')
const profileInsightError = ref('')
let profileInsightAbort: AbortController | null = null

const profileRangeLabel = computed(() => profileView.value === 'timeline' ? '时间轴' : '年度热力图')

const profileInsightFacts = computed(() => {
  if (profileView.value === 'timeline') {
    const tracked = timelineEvents.value.filter(event =>
      event.kind !== 'system' && ['create', 'status', 'restore', 'delete'].includes(event.action))
    const days = new Set(tracked.map(event => new Date(event.ts).toLocaleDateString('sv-SE')))
    const cardIds = new Set(tracked.map(event => `${event.kind}:${event.cardId}`))
    const recent = tracked.slice(0, 5).map(event => `${event.title}（${event.kind}）`)
    return [
      `时间轴覆盖：${days.size} 个活跃日，${cardIds.size} 张卡片`,
      `写入与修改事件：${tracked.length} 次`,
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
          content: '你是一名严谨、克制的中文数据分析师。只根据给定画像事实分析，不编造数字、不做人格评判；数据不足时明确说明。输出 180—200 字的一段中文，依次包含：①当前周期最关键的行为洞察；②对洞察背后原因的深层剖析；③一条可立即执行、与主攻项目或成功指标相关的下一步建议。不要标题、不要 Markdown、不要客套话。',
        },
        {
          role: 'user',
          content: [
            `观察范围：${profileRangeLabel.value}`,
            `使命主线：${heroMission.value || '未填写'}`,
            `主攻项目：${focusText}`,
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
</script>
<template>
  <div class="pi-page">
    <!-- ===== §0 Hero 页头：只保留页面级动作 ===== -->
    <PiHero :error-count="errorLogCount"
      @refresh="onHeroRefresh" @export="onHeroExport"
      @export-error="exportErrorLog" @open-log="openLog('log')" />

    <!-- ===== §1 首屏双面板：产品使用状态 + 个人方向状态 ===== -->
    <PiOverview
      :total="heroTotal" :kind-counts="heroKindCounts" :entropy="heroEntropy"
      :topic-stats="{ all: gTopicLive.length, published: topicPublished.length, supported: topicSupported.length, month: topicMonthAdded.length }"
      :top-tags="heroTopTags"
      :support-rate="heroSupportRate" :focus-share="heroFocusShare"
      :today-import="todayImportCount"
      :mission-text="heroMission" :focus-projects="heroFocusProjects"
      @kpi-drill="onHeroDrill" @topic-drill="onHeroDrill" @goto-compass="gotoCompass"
      @open-project="openProjectDetail" />

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
                :class="{ on: profileView === 'heatmap' }"
                data-profile-view="heatmap"
                role="tab"
                :aria-selected="profileView === 'heatmap'"
                :tabindex="profileView === 'heatmap' ? 0 : -1"
                @click="profileView = 'heatmap'"
              >
                <Icon name="battle" :size="13" /><span>热力图</span><small>HEATMAP</small>
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
        />

        <PiYear v-else
          :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
          :events="timelineEvents" :live-link="linkCardCount"
          :lc-cards="lcCards" :all-events="timelineEvents"
          :focus-filter="lcFocus"
          @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
          @open-battle="openDayBattle"
          @drill="onYearDrill"
          @lc-locate="onLcLocate" @lc-archive="onLcArchive" @lc-snooze="onLcSnooze"
          @lc-reactivate="onLcReactivate" @lc-set-days="onLcSetDays"
          @lc-settings="lcSetOpen = true" />
    </div>

    <PiTimelineDrawer
      :open="timelineOpen"
      :entry="timelineEntry"
      @close="timelineOpen = false"
      @locate="locateTimelineEntry"
    />

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

    <!-- 主攻项目详情：中央弹窗，沿用可编辑 ProjectDetailDrawer。 -->
    <ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId" mode="modal" @close="projDetailOpen = false" />
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
