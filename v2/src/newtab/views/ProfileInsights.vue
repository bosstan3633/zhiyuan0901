<script setup lang="ts">

/**
 * V3.9.3：画像洞察页 —— 概览 + 单段时间轴（今天 / 本周 / 本月 / 本年）。
 *
 * 本版把已确认的高保真原型落为生产：
 *   §0 PiHero 页头（标题 / 使命与主攻 / 全库读数 / 刷新、导出、全部记录）
 *   §1 PiOverview 首屏双栏（左：本周方向；右：今天三件事）
 *   §2 PiRangeTabs（唯一导航）+ 单段时间面板（四选一）：
 *     ① PiToday  今天 · TODAY（今日六格 + 今日三件事 + 洞察条）
 *     ② PiRhythm 本周 · WEEK（strip + 节奏柱 + 目标 + 规则对照；★V3.8.20 固定周窗口）
 *     ③ PiMonth  本月 · MONTH（★V3.8.20 新增轻量月度段：strip + 月柱 + 6 KPI + 环比；目标/预警/操作流不重复）
 *     ④ PiYear   全年 · YEAR（F20 诊断条 + F21 strip4 + 默认展开年度热力图 + 生命周期）
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
/* ★W13-D5：ReviewPanel 弹窗挂载退役（2026-10-16）——组件文件保留待复用，宿主零 import。 */

import Icon from '@/shared/components/Icon.vue'
import '@/newtab/components/dashboard/dashboard.css'
import '@/newtab/components/profile/pi-timeline.css'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
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
import type { TodayRow } from '@/newtab/components/profile/PiToday.vue'
import {
  snoozeCard, reactivateCard, setCoolingDays,
  coolingDefaultDaysOf, setCoolingDefaultDays, lifecycleState, coolingMsOf
} from '@/shared/utils/lifecycle'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'
import {
  computeTagEntropy, todayKey,
  computeTaskSupportRate, computeMainFocusShare, windowOf, tasksOfDirection,
  buildConciseInsights, objectivesOf
} from '@/shared/utils/reviewReport'
import type { DirLike, TaskLike, ConciseCtx } from '@/shared/utils/reviewReport'
import { aggregateRange } from '@/shared/utils/dailyStats'
import PiHero from '@/newtab/components/profile/PiHero.vue'
import PiToday from '@/newtab/components/profile/PiToday.vue'
import PiRhythm from '@/newtab/components/profile/PiRhythm.vue'
import PiMonth, { type MonthTopic } from '@/newtab/components/profile/PiMonth.vue'
import { useCuriosity } from '@/newtab/stores/curiosity'
import PiYear from '@/newtab/components/profile/PiYear.vue'
import PiYearMetricDrawer from '@/newtab/components/profile/PiYearMetricDrawer.vue'
import PiOverview, { type FocusProjectView } from '@/newtab/components/profile/PiOverview.vue'
import { useCompass } from '@/newtab/stores/compass'
import PiRangeTabs, { type PiRange } from '@/newtab/components/profile/PiRangeTabs.vue'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import ProjectDetailDrawer from '@/newtab/components/ProjectDetailDrawer.vue'
import TaskDetailDrawer from '@/newtab/components/compass/TaskDetailDrawer.vue'
import { useDashboardStats } from '@/newtab/components/dashboard/useDashboardStats'
import TodayBattleHost from '@/newtab/components/dashboard/TodayBattleHost.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import { emitOpenDrawer } from '@/shared/utils/bus'
import PiTagDistributionDrawer from '@/newtab/components/profile/PiTagDistributionDrawer.vue'
import PiMetricDetailDrawer, { type PiStatRow, type PiReconCell } from '@/newtab/components/profile/PiMetricDetailDrawer.vue'
import PiLifecycleSettingsModal from '@/newtab/components/profile/PiLifecycleSettingsModal.vue'
import { useRangeAiInsight } from '@/newtab/composables/useRangeAiInsight'
import { profileDirectionFitText, profileExportLines, profileRangeFacts } from '@/newtab/views/profileInsightsReport'
import { useProfileInsights, type GFlat, type StatDrawerType, type StatRow, type TagOptimizeJob } from './useProfileInsights'
const {
  router, store, gd, taskDetailRef, battleHost,
  openResourceLink, focusedProjects, projectProgress, projectTasksOf, isProjectStalled,
  isProjectDone, pageSub, eventLog, logEmpty, gStartOfToday,
  refreshEventLog, gFlat, derivedEvents, timelineEvents, gResLive,
  gTaskLive, gCurioLive, linkCardCount, dash, dashYear,
  dashSelDay, dashStats, dashDirections, dashTasks, heroTotal,
  tagLists, heroEntropy, topTags, heroKindCounts, heroTopTags,
  heroSupportRate, heroFocusShare, heroMission, heroFocusProjects, supportedTaskIds,
  focusProjectIds, todayAdd, todayCalled, todayFocus, projNameById,
  matchResourcesOf, todayRows, todayFilled, todayAmmo, conciseCtx,
  concise, onConciseAction, projDetailOpen, projDetailId, openProjectDetail,
  activeRange, setRange, rangeAiJob, openRangeAi, overviewWeekRange,
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
  mTopics, mUntagged, mFunnel, mCurioConv, mProjected,
  curioApi, mMature, onMonthDrill, onMonthTopic, onGoalDrill,
  errorLogCount, refreshErrorCount, offErrLog, exportErrorLog, fmtDayKey,
  fmtDay,
} = useProfileInsights()
</script>
<template>
  <div class="pi-page">
    <!-- ===== §0 Hero 页头（V3.9.13：周期切换并入同一工具行，不再单占一屏行） ===== -->
    <PiHero :error-count="errorLogCount"
      @refresh="onHeroRefresh" @export="onHeroExport"
      @export-error="exportErrorLog" @open-log="openLog('log')">
      <template #range>
        <PiRangeTabs :model-value="activeRange" @update:model-value="setRange($event)" />
      </template>
    </PiHero>

    <!-- ===== §1 首屏双面板：产品使用状态 + 个人方向状态 ===== -->
    <PiOverview
      :total="heroTotal" :kind-counts="heroKindCounts" :entropy="heroEntropy"
      :top-tags="heroTopTags"
      :support-rate="heroSupportRate" :focus-share="heroFocusShare"
      :mission-text="heroMission" :focus-projects="heroFocusProjects"
      @kpi-drill="onHeroDrill" @goto-compass="gotoCompass"
      @open-project="openProjectDetail" />

    <!-- ===== §2 按周期观察：页签已是唯一导航，直接进入当前周期 ===== -->
    <div class="pi-rmods pi-rmods-single">
        <PiToday v-if="activeRange === 'today'"
          :today-add="todayAdd" :today-called="todayCalled"
          :today-import="todayImportCount"
          :focus-filled="todayFilled" :ammo="todayAmmo" :slot-count="3"
          :insight="concise.today"
          @drill="onTodayDrill" @open-battle="openTodayBattle" @open-focus="() => router.push('/')"
          @insight-action="onConciseAction" @ai-insight="openRangeAi" />

        <PiRhythm v-else-if="activeRange === 'week'"
          :stats="dashStats" :directions="dashDirections"
          :tasks="dashTasks" :error-count="errorLogCount"
          :insight="concise.week"
          @open-err="exportErrorLog"
          @open-battle="openDayBattle" @drill="onRhythmDrill" @goal-drill="onGoalDrill"
          @insight-action="onConciseAction" @ai-insight="openRangeAi" />

        <PiMonth v-else-if="activeRange === 'month'"
          :stats="dashStats" :insight="concise.month" :ent="mEntTrend"
          :topics="mTopics" :untagged="mUntagged" :funnel="mFunnel"
          :curio-conv="mCurioConv" :projected="mProjected"
          @drill="onMonthDrill" @topic="onMonthTopic" @insight-action="onConciseAction" @ai-insight="openRangeAi" />

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
          @lc-settings="lcSetOpen = true" @ai-insight="openRangeAi" />
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

    <!-- 主攻项目详情：中央弹窗，沿用可编辑 ProjectDetailDrawer。 -->
    <ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId" mode="modal" @close="projDetailOpen = false" />
    <TaskDetailDrawer ref="taskDetailRef" />

    <PiTagDistributionDrawer
      :open="tagInsightOpen" :entropy="heroEntropy"
      :resources="gResLive" :tasks="gTaskLive"
      @close="tagInsightOpen = false" @optimize="runTagOptimizeAi" />

    <AiDrawer v-if="tagAiJob" :job="tagAiJob" :job-key="tagAiJob.key" @close="tagAiJob = null" />
    <AiDrawer v-if="rangeAiJob" :job="rangeAiJob" :job-key="rangeAiJob.key" @close="rangeAiJob = null" />

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
