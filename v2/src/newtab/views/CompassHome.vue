<script setup lang="ts">

// R65-F7：KeepAlive 缓存实例名（App.vue router-view include）
// R49（V2.22.0）三大系统页改版：本页 = 调度台（默认首页）
// - 今日记录条（入台/移出/调出/写入记录，点击开抽屉）
// - 左右分栏：桌面端按行共用模块边界，左=今日三件事 / 手边的卡，右=今天的状态 / 最近调出
// - 好奇心培育已退役；好奇心入口保留在「手边的卡」页签
// ★W17-C02（2026-10-20）：本地那份「双击打开链接」小实现退役（不记调出、不分流三态、失败静默），
// 全库统一走 useResourceOpen —— 同一个动作只允许一个实现，且它返回成败供单击分流。
// ★W12-D（V3.8.16）：年度热力图从调度台退役（用户 2026-10-13 拍板——画像洞察页已全量覆盖，
// 调度台再放一份是重复），但「今日战报」要保留，故先把日详情从 Heatmap.vue 解耦出来，
// 由 TodayBattleHost 自包含承载（数据桥 + 事件日志读取 + 日详情 + 全量记录抽屉都在它里面）。
// 本页只挂一行、不直接碰事件日志（R49-3 负锚保持）。
// R172-T9（04-67 Q7）：调度画像周报浮层**已退役**（组件已物理删除，全仓零引用）——
// 四段式能力并入知源仪表盘的「复盘段」（ReviewPanel.vue），入口由本页右上角 `📈 复盘` 承担。
// 历史包袱顺带清掉：R113-N3 曾因"模板引用但从未 import"导致点按钮无任何反应，该类问题随组件退役消失。

defineOptions({ name: 'CompassHomeView' })
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount, onDeactivated, nextTick, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { visibleFields } from '@/shared/utils/fields'
import { focusRecentDays, focusWindowTotals } from '@/shared/utils/focusHistory'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
import { subscribeSaveError, getLastSaveOkAt, getBytesInUse, hasUnlimitedStorage, saveDataNow } from '@/shared/storage/repository'
import { pendingRows, runSync } from '@/shared/storage/airtable'
import type { SaveError } from '@/shared/storage/repository'
import type { TaskCard, Project, FocusSlot, CuriosityCard, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity } from '@/shared/utils/maturity'
import NewBadge from '@/shared/components/NewBadge.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import CompassStatusModal, { type StatusDetailKey, type StatusDetailItem } from '../components/compass/CompassStatusModal.vue'
import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { recordCardOpen } from '@/shared/storage/stats'
import { weekUsageOf } from '@/shared/storage/stats'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import AssetPreview from '@/shared/components/AssetPreview.vue'
import TodayBattleHost from '../components/dashboard/TodayBattleHost.vue'
import { useCompassHome, type FocusCell, type HandKind } from './useCompassHome'
const {
  router, route, store, d, allProjects,
  projectProgress, projectTasksOf, focusedProjects, isProjectStalled, isProjectDone,
  refreshWce, unarchivedTaskCount, taskArchiveIssue, openResourceLink, previewOpen,
  previewUrl, previewName, closePreview, drawerRef, formatDate,
  formatFullDate, dateStr, midnightOf, todayStart, midnightTimer,
  scheduleMidnightRollover, todayDate, shiftDate, todayFocusList, FOCUS_LIMIT,
  focusFull, focusCells, focusCellAt, todayKey, localWhy,
  aiWhy, whyOpen, whyBadge, focusAiBusy, focusMoreOpen,
  whyOf, whyIsAi, focusHasRec, focusWeekTotals, ensureAutoFocus,
  refineWithAi, toggleWhy, closeWhy, onDocClickCloseWhy, reshuffleFocus,
  muteFocusToday, focusJob, openFocusReview, openCellTask, focusAllDone,
  todayTaskForSlot, toggleSlotSub, pickerOpen, pickerSlot, pickerSearch,
  pickerStatus, pickerProject, openPicker, selectTaskForSlot, pickerCandidates,
  pickerProjectOptions, pickedIds, pickerDisabled, selectTaskGuarded, removeTodaySlot,
  copyYesterday, clearFocusSelection, exportOpen, exportFrom, exportTo,
  openExportModal, statusLabelOf, exportBusy, doExport, toggleTodayDone,
  projectName, metricName, taskStatusLabel, taskStatusIcon, taskStatusClass,
  fmtShortDate, fmtRecentTime, tFields, taskAssetsOn, onDateKey,
  gotoAnchor, onAnchorEvt, saveErr, lastOkTick, saveErrSub,
  storageTimer, storageOk, ERR_LABEL, storageText, timeAgo,
  onStorageClick, atSync, atConfigured, atSyncErr, atPending,
  atChipText, atChipTitle, atSyncing, onSyncChipClick, focusMeta,
  readonlyProjectOpen, readonlyProjectId, openFocusProject, handTab, todayInCount,
  todayOutCount, todayOutOps, battleHost, openReview, focusDoneCount,
  mainFocus, extraFocus, recentLimit,
  recentResources, workBoardRef, handBoardRef, deskLayoutRef,
  liveTasks,
  previewTasks, liveCuriosities, previewCuriosities, liveResources, previewResources,
  hasAnyPreview, weeklyReuse, archivedCount, openTaskPreview, openCurioPreview,
  openResourcePreview, openRecentResource, goDeck, statusDetail, closeStatusDetail,
  statusDetailTitle, statusDetailItems, statusDetailNote, statusDetailEmpty, weekStartKeyOf,
  openStatusDetail, onStatusItemAction, curioStatusLabel, resourceKindLabel, taskDueLabel,
  focusSlotSourceLabel,
} = useCompassHome()
</script>

<template>
  <div class="page">
    <header class="desk-head">
      <div class="desk-heading">
        <div class="desk-kicker">调度台 · {{ formatFullDate(todayDate) }}</div>
        <h1>今天，先做这三件。</h1>
      </div>
      <div class="desk-actions">
        <button class="why-trigger battle-trigger" type="button" @click="openReview">
          <Icon name="trendup" :size="13" />
          <span>今日战报</span>
        </button>
        <button class="why-trigger" :class="{ on: whyOpen }" data-testid="focus-why-ico" type="button" @click.stop="toggleWhy">
          <Icon name="sparkles" :size="13" />
          <span>为什么这样排</span>
          <span v-if="whyBadge && focusHasRec" class="why-dot" />
        </button>
        <div v-if="whyOpen" class="focus-why" data-testid="focus-why" role="presentation" data-a11y-container @click.stop>
          <div class="fw-h">为什么是这三件<span class="hint">{{ focusAiBusy ? ' · AI 复核中…' : '' }}</span></div>
          <div v-for="c in focusCells" :key="'w' + c.idx" class="fw-row">
            <span class="n">{{ String(c.idx + 1).padStart(2, '0') }}</span>
            <div class="b">
              <template v-if="c.task">
                <div class="t">{{ c.slot?.text }}</div>
                <div class="w">
                  <template v-if="c.slot?.auto === true">{{ whyOf(c.slot) || '本地依据：主攻项目下可直接推进的事项' }}<span v-if="whyIsAi(c.slot)" class="ai-tag"> · AI 判词</span></template>
                  <template v-else>这一格是你自己选的，系统不评价、也不会覆盖。</template>
                </div>
              </template>
              <template v-else>
                <div class="t off">空着</div>
                <div class="w">点这一格从任务库选，或用“换一批”。</div>
              </template>
            </div>
          </div>
          <div class="fw-f">
            过去 7 天完成 <b>{{ focusWeekTotals.done }}/{{ focusWeekTotals.planned }}</b>（按三件事格子计）<br>
            推荐只写今天的计划位，<b>不改任务卡、不改状态、不改归属</b>。
          </div>
          <div class="fw-acts">
            <button class="quiet-btn" data-testid="focus-reshuffle" type="button" @click="reshuffleFocus">换一批</button>
            <button class="quiet-btn" data-testid="focus-review" type="button" :disabled="focusAiBusy" @click="openFocusReview">让 AI 复核顺序</button>
            <button class="quiet-btn" data-testid="focus-mute" type="button" @click="muteFocusToday">今天别自动推荐</button>
          </div>
        </div>
      </div>
    </header>

    <div ref="deskLayoutRef" class="desk-layout">
      <main class="desk-main">
        <section id="zy-mod-tasks" ref="workBoardRef" class="work-board desk-row desk-row-primary" :class="{ 'all-done': focusAllDone }" aria-labelledby="focusTitle">
          <header class="board-head">
            <div class="board-title">
              <span class="board-ico"><Icon name="compass" :size="18" /></span>
              <div>
                <h2 id="focusTitle">今日三件事</h2>
                <span class="board-count">{{ focusDoneCount }} / {{ Math.max(todayFocusList.length, 1) }} 完成 · 计划位 {{ todayFocusList.length }}/3</span>
              </div>
            </div>
            <div class="board-tools">
              <button class="icon-btn" type="button" title="前一天" aria-label="前一天" @click="shiftDate(-1)"><Icon name="arrowleft" :size="14" /></button>
              <button class="date-btn" type="button" title="回到今天" @click="todayDate = new Date()">{{ formatDate(todayDate) }}</button>
              <button class="icon-btn" type="button" title="后一天" aria-label="后一天" @click="shiftDate(1)"><Icon name="arrowright" :size="14" /></button>
              <span class="tool-sep" />
              <button class="quiet-btn" type="button" title="把昨天的三件事复制到今天" @click="copyYesterday"><Icon name="copy" :size="13" /> 复制昨日</button>
              <div class="focus-more-wrap">
                <button class="icon-btn" type="button" title="更多" aria-label="更多" :aria-expanded="focusMoreOpen" @click.stop="focusMoreOpen = !focusMoreOpen"><Icon name="menu" :size="14" /></button>
                <div v-if="focusMoreOpen" class="focus-more-menu" role="presentation" data-a11y-container @click.stop>
                  <button type="button" @click="reshuffleFocus(); focusMoreOpen = false"><Icon name="shuffle" :size="13" /> 换一批</button>
                  <button type="button" @click="openFocusReview(); focusMoreOpen = false"><Icon name="sparkles" :size="13" /> AI 复核顺序</button>
                  <button type="button" @click="openExportModal(); focusMoreOpen = false"><Icon name="download" :size="13" /> 导出 CSV</button>
                  <button type="button" @click="muteFocusToday(); focusMoreOpen = false"><Icon name="eyeoff" :size="13" /> 今天别自动推荐</button>
                </div>
              </div>
            </div>
          </header>

          <div class="focus-list">
            <template v-for="c in focusCells" :key="c.idx">
              <div v-if="c.task" class="focus-row" :class="{ done: c.slot?.done }" role="button" tabindex="0"
                @click="openCellTask(c)" @keydown.enter.prevent="openCellTask(c)" @keydown.space.prevent="openCellTask(c)">
                <button class="row-check" :class="{ done: c.slot?.done }" type="button" :aria-label="c.slot?.done ? '取消完成' : '标记完成'" @click.stop="c.slot && toggleTodayDone(c.slot)">
                  <Icon v-if="c.slot?.done" name="check" :size="14" />
                </button>
                <div class="row-main">
                  <div class="row-title">
                    <NewBadge :at="c.task.createdAt" />
                    <span class="title-text">{{ c.slot?.text }}</span>
                    <span v-if="c.slot?.auto === true" class="rec" data-testid="focus-rec"><Icon name="sparkle" :size="11" /> 荐</span>
                  </div>
                  <div class="row-meta">
                    <span><Icon name="package" :size="12" /> {{ projectName(c.task.projectId) }}</span>
                    <span><Icon name="target" :size="12" /> {{ metricName(c.task.metricId) }}</span>
                    <span v-if="c.task.subtasks?.length"><Icon name="corner" :size="12" /> 子任务 {{ c.task.subtasks.filter(s => s.done).length }}/{{ c.task.subtasks.length }}</span>
                    <AssetBadge v-if="taskAssetsOn && c.task.assets?.length" :assets="c.task.assets" />
                    <MaturityBadge :m="taskMaturity(c.task)" />
                  </div>
                </div>
                <div class="row-side">
                  <span class="status" :class="taskStatusClass(c.task.status)"><Icon :name="taskStatusIcon(c.task.status)" :size="11" /> {{ taskStatusLabel(c.task.status) }}</span>
                  <Icon name="arrowright" :size="14" class="row-chevron" />
                </div>
                <button class="row-remove" type="button" title="移出今日三件事（任务本体仍在任务库）" aria-label="移出今日三件事" @click.stop="removeTodaySlot(c.idx)"><Icon name="x" :size="13" /></button>
              </div>

              <div v-else-if="c.slot && c.slot.sourceType === 'task'" class="focus-row stale-row" role="button" tabindex="0" @click="openPicker(c.idx)" @keydown.enter.prevent="openPicker(c.idx)">
                <span class="row-index">{{ String(c.idx + 1).padStart(2, '0') }}</span>
                <div class="row-main">
                  <div class="row-title"><Icon name="warn" :size="14" /><span class="title-text">{{ c.slot.text || '原任务已失效' }}</span></div>
                  <div class="row-meta"><span>源任务已删除或归档 · 点这一行原位重新选取</span></div>
                </div>
                <span class="stale-action">重新选取 <Icon name="arrowright" :size="13" /></span>
                <button class="row-remove" type="button" title="移出今日三件事" aria-label="移出今日三件事" @click.stop="removeTodaySlot(c.idx)"><Icon name="x" :size="13" /></button>
              </div>

              <div v-else-if="c.slot" class="focus-row non-task-row">
                <button class="row-check" :class="{ done: c.slot.done }" type="button" :aria-label="c.slot.done ? '取消完成' : '标记完成'" @click.stop="toggleTodayDone(c.slot)">
                  <Icon v-if="c.slot.done" name="check" :size="14" />
                </button>
                <div class="row-main">
                  <div class="row-title"><span class="title-text">{{ c.slot.text }}</span></div>
                  <div class="row-meta"><span><Icon :name="c.slot.sourceType === 'text' ? 'edit' : 'package'" :size="12" /> {{ focusSlotSourceLabel(c.slot) }}</span><span>不参与六层链</span></div>
                </div>
                <div class="row-side"><span class="status" :class="c.slot.done ? 'done' : 'todo'">{{ c.slot.done ? '已完成' : '未完成' }}</span></div>
                <button class="row-remove" type="button" title="移出今日三件事" aria-label="移出今日三件事" @click.stop="removeTodaySlot(c.idx)"><Icon name="x" :size="13" /></button>
              </div>

              <div v-else class="focus-row empty-row" role="button" tabindex="0" @click="openPicker(c.idx)" @keydown.enter.prevent="openPicker(c.idx)" @keydown.space.prevent="openPicker(c.idx)">
                <span class="empty-plus"><Icon name="plus" :size="14" /></span>
                <div class="row-main">
                  <div class="row-title empty-title">从任务库选取</div>
                  <div class="row-meta"><span>计划位 {{ c.idx + 1 }} · 选中后会立即打开右侧详情</span></div>
                </div>
                <Icon name="arrowright" :size="14" class="row-chevron" />
              </div>
            </template>
          </div>

          <div v-if="focusAllDone" class="done-banner"><Icon name="check" :size="13" /> 今日三件事已闭环 · 专注带来从容</div>
          <footer class="board-foot">
            <span><Icon name="clock" :size="12" /> 整行点开详情 · 左侧勾选才算完成</span>
            <span class="board-foot-spacer" />
            <span>Ctrl + ← / → 切换日期</span>
          </footer>
        </section>

        <section ref="handBoardRef" class="hand-board desk-row desk-row-secondary" aria-labelledby="handTitle">
          <header class="hand-head">
            <div class="hand-heading">
              <span class="board-ico"><Icon name="layers" :size="18" /></span>
              <div>
                <h2 id="handTitle">手边的卡</h2>
                <span class="hand-kicker">三池 · 只预览最近在用的 · 新建走扩展快捷键</span>
              </div>
            </div>
            <!-- V3.9.18：三列改三池页签（原型手边的卡）——列结构与字符串锚保留，仅显示态切换 -->
            <div class="hand-tabs" role="tablist" aria-label="手边的卡类型">
              <button class="hand-tab" :class="{ on: handTab === 'task' }" role="tab" :aria-selected="handTab === 'task'" type="button" @click="handTab = 'task'">任务</button>
              <button class="hand-tab" :class="{ on: handTab === 'curiosity' }" role="tab" :aria-selected="handTab === 'curiosity'" type="button" @click="handTab = 'curiosity'">好奇心</button>
              <button class="hand-tab" :class="{ on: handTab === 'resource' }" role="tab" :aria-selected="handTab === 'resource'" type="button" @click="handTab = 'resource'">资源</button>
            </div>
          </header>

          <div v-if="!hasAnyPreview" class="deck-empty">
            <span class="deck-empty-icon"><Icon name="inbox" :size="22" /></span>
            <div><b>手边暂时没有卡</b><p>用扩展快捷键采集任务、好奇心或资源，采集后会回到这里展开分类。</p></div>
          </div>

          <div v-else class="hand-grid">
            <section v-show="handTab === 'task'" class="hand-col" aria-labelledby="taskColTitle">
              <header class="hand-col-head">
                <Icon name="clipboard" :size="14" />
                <b id="taskColTitle">任务卡</b>
                <span class="hand-count">{{ liveTasks.length }}</span>
                <button class="hand-link" type="button" @click="goDeck('task')">查看全部 <Icon name="arrowright" :size="12" /></button>
              </header>
              <div class="mini-list">
                <button v-for="t in previewTasks" :key="t.id" class="mini-item" type="button" @click="openTaskPreview(t)">
                  <span class="mini-check" :class="{ done: t.status === 'done' }"><Icon v-if="t.status === 'done'" name="check" :size="9" /></span>
                  <span class="mini-copy"><span class="mini-title">{{ t.title }}</span><span class="mini-meta">{{ taskDueLabel(t) }}</span></span>
                  <span class="mini-side" :class="{ 'status-doing': t.status === 'doing' }">{{ taskStatusLabel(t.status) }}</span>
                </button>
                <div v-if="!previewTasks.length" class="mini-empty">还没有任务卡</div>
              </div>
            </section>

            <section v-show="handTab === 'curiosity'" class="hand-col" aria-labelledby="curioColTitle">
              <header class="hand-col-head">
                <Icon name="bulb" :size="14" />
                <b id="curioColTitle">好奇心卡</b>
                <span class="hand-count">{{ liveCuriosities.length }}</span>
                <button class="hand-link" type="button" @click="goDeck('curiosity')">查看全部 <Icon name="arrowright" :size="12" /></button>
              </header>
              <div class="mini-list">
                <button v-for="c in previewCuriosities" :key="c.id" class="mini-item" type="button" @click="openCurioPreview(c)">
                  <Icon name="bulb" :size="13" class="mini-leading" />
                  <span class="mini-copy"><span class="mini-title">{{ c.question }}</span><span class="mini-meta">{{ curioStatusLabel(c) }} · {{ fmtShortDate(c.updatedAt || c.createdAt) }}</span></span>
                  <span class="mini-side">{{ c.callCount || 0 }}</span>
                </button>
                <div v-if="!previewCuriosities.length" class="mini-empty">还没有好奇心卡</div>
              </div>
            </section>

            <section v-show="handTab === 'resource'" class="hand-col" aria-labelledby="resColTitle">
              <header class="hand-col-head">
                <Icon name="filetext" :size="14" />
                <b id="resColTitle">资源卡</b>
                <span class="hand-count">{{ liveResources.length }}</span>
                <button class="hand-link" type="button" @click="goDeck('resource')">查看全部 <Icon name="arrowright" :size="12" /></button>
              </header>
              <div class="mini-list">
                <button v-for="r in previewResources" :key="r.id" class="mini-item" type="button" @click="openResourcePreview(r)" @dblclick="openResourceLink(r)">
                  <Icon :name="r.linkType === 'file' ? 'filetext' : r.link ? 'link' : 'package'" :size="13" class="mini-leading" />
                  <span class="mini-copy"><span class="mini-title">{{ r.title }}</span><span class="mini-meta">{{ resourceKindLabel(r) }} · {{ fmtShortDate(r.lastCalledAt || r.updatedAt) }}</span></span>
                  <span class="mini-side">{{ r.callCount || 0 }}</span>
                </button>
                <div v-if="!previewResources.length" class="mini-empty">还没有资源卡</div>
              </div>
            </section>
          </div>
        </section>

      </main>

      <aside class="side-rail" aria-label="案头侧栏">
        <section class="rail-panel desk-row desk-row-primary">
          <header class="rail-head">
            <b>今天的状态</b>
            <button type="button" @click="openReview">战报</button>
          </header>
          <div class="stat-list">
            <!-- V3.9.18：读数改「今日入台 / 今日调出 / 未归档」（原型右栏）；本周复用挪最近调出头部。
                 V3.9.22：主攻只在这里保留——页头锚行与主栏面板都已退役。
                 口径与战报事件日志不同源，tooltip 与明细 note 明示，不冒充同源。 -->
            <button class="stat-row" type="button" title="口径：今日 0 点起新建的三类卡（按创建时间）；与今日战报的事件计次口径不同" @click="openStatusDetail('in')">
              <span class="sk">今日入台</span>
              <span class="sv">{{ todayInCount }} 张</span>
              <span class="se">明细</span>
            </button>
            <button class="stat-row" type="button" title="口径：今日 0 点起 lastCalledAt 落在今日的资源卡张数；与今日战报的事件计次口径不同" @click="openStatusDetail('out')">
              <span class="sk">今日调出</span>
              <span class="sv">{{ todayOutOps }} 次操作 <small>/ {{ todayOutCount }} 张卡</small></span>
              <span class="se">明细</span>
            </button>
            <!-- V3.9.22：主攻最多两个，同一行并列。项目名各自可点并打开可编辑项目详情；
                 不展示「下一步 / 完成度」，也不再恢复主攻卡片面板。 -->
            <div v-if="mainFocus || extraFocus" class="stat-row stat-row-focus">
              <span class="sk">主攻</span>
              <span class="stat-focus-links">
                <button v-if="mainFocus" class="stat-focus-link" type="button"
                  :title="`${mainFocus.name} · 打开可编辑项目详情`" @click="openFocusProject(mainFocus)">{{ mainFocus.name }}</button>
                <button v-if="extraFocus" class="stat-focus-link" type="button"
                  :title="`${extraFocus.name} · 打开可编辑项目详情`" @click="openFocusProject(extraFocus)">{{ extraFocus.name }}</button>
              </span>
            </div>
            <button v-else class="stat-row stat-row-empty" type="button" @click="router.push('/compass')">
              <span class="sk">主攻</span>
              <span class="sv">尚未指定</span>
              <span class="se">去方向台</span>
            </button>
            <button class="stat-row" type="button" @click="openStatusDetail('unarchived')">
              <span class="sk">未归档</span>
              <span class="sv">{{ archivedCount }} / {{ liveTasks.length }} 件任务</span>
              <span class="se">去归位</span>
            </button>
          </div>
        </section>

        <section class="rail-panel rail-panel-recent desk-row desk-row-secondary">
          <header class="rail-head">
            <b>最近调出</b>
            <button class="rail-chip" type="button" title="口径：本周一 0 点起被打开过的资源卡（wrr 周戳）；跨周清零" @click="openStatusDetail('reuse')">本周 {{ weeklyReuse }} 次</button>
            <button type="button" @click="goDeck('resource')">全部</button>
          </header>
          <div v-if="recentResources.length" class="recent-list">
            <button v-for="r in recentResources" :key="r.id" class="recent-item" type="button" :title="r.link ? '单击打开链接 · 打不开则滑出详情' : '单击滑出详情'" @click="openRecentResource(r)">
              <Icon :name="r.linkType === 'file' ? 'filetext' : r.link ? 'link' : 'package'" :size="13" />
              <span class="recent-copy"><span class="recent-title">{{ r.title }}</span><span class="recent-meta">{{ fmtRecentTime(r.lastCalledAt) }} · 打开 {{ r.callCount || 0 }} 次</span></span>
            </button>
          </div>
          <div v-else class="rail-empty">还没有调出记录。打开一张资源卡后，会出现在这里。</div>
        </section>

      </aside>
    </div>

    <!-- V3.9.26：状态轨移出双列内容网格，滚动时不再与右下模块争用同一吸附层。 -->
    <footer class="page-foot desk-status-rail" aria-label="本机存储与同步状态">
      <div class="status-local">
        <button class="foot-status" :class="{ error: !storageOk }" type="button" :title="storageOk ? '点击查看存储用量' : '点击重试写入'" @click="onStorageClick">
          <span class="save-dot" /><span>{{ storageText }}</span>
        </button>
        <span class="local-note"><Icon name="shield" :size="12" /> 只存本机 · 无账号 · 可随时导出</span>
      </div>
      <span class="foot-sync">
        <button class="foot-status" :class="{ error: !!atSyncErr }" type="button" :title="atChipTitle" @click="onSyncChipClick">
          <span>{{ atChipText }}</span>
        </button>
        <button class="foot-gear" type="button" title="Airtable 同步设置" aria-label="Airtable 同步设置" @click="router.push('/settings?page=airtable')"><Icon name="settings" :size="12" /></button>
      </span>
    </footer>

    <TodayBattleHost ref="battleHost" />
    <ProjectDetailDrawer :open="readonlyProjectOpen" :project-id="readonlyProjectId" mode="modal"
      @close="readonlyProjectOpen = false" />

    <!-- ★W17-C01：三行状态明细（中央只读弹窗，不跳路由） -->
    <CompassStatusModal :open="!!statusDetail" :kind="statusDetail || 'focus'"
      :title="statusDetailTitle" :note="statusDetailNote" :items="statusDetailItems"
      :empty-text="statusDetailEmpty" @close="closeStatusDetail" @item-action="onStatusItemAction" />

    <!-- ★W17-C02：useResourceOpen 的图片附件就地预览（zy-asset:// 图片卡，与 Workspace 同一壳） -->
    <AssetPreview :open="previewOpen" :url="previewUrl" :name="previewName" @close="closePreview" />

    <Transition name="fade">
      <div v-if="pickerOpen" class="overlay" @click="pickerOpen = false" />
    </Transition>
    <Transition name="modal">
      <div v-if="pickerOpen" class="picker-modal" role="dialog" aria-modal="true" aria-labelledby="pickerTitle">
        <header class="pm-head">
          <div><span id="pickerTitle"><Icon name="filetext" :size="13" /> 选择今天要做的事</span><small>今日计划位 {{ todayFocusList.length }} / 3</small></div>
          <button class="pm-close" type="button" aria-label="关闭" @click="pickerOpen = false"><Icon name="x" :size="15" /></button>
        </header>
        <div class="pm-body">
          <div class="pm-filters">
            <label class="search-box pm-search-flat"><Icon name="search" :size="13" /><input v-model="pickerSearch" placeholder="搜索任务标题…" autofocus></label>
            <select v-model="pickerProject" class="pm-select" title="按项目筛选任务">
              <option value="">全部项目</option>
              <option value="__none__">未关联项目（{{ pickerProjectOptions.none }}）</option>
              <option v-for="o in pickerProjectOptions.opts" :key="o.id" :value="o.id">{{ o.name }}（{{ o.n }}）</option>
            </select>
            <select v-model="pickerStatus" class="pm-select pm-status" title="按任务状态筛选">
              <option value="all">全部状态</option>
              <option value="todo">待开始</option>
              <option value="doing">进行中</option>
            </select>
          </div>
          <div class="pm-summary"><span>{{ pickerCandidates.length }} 个可选任务</span><span>已完成和已选入的任务会置灰</span></div>
          <div class="picker-list">
            <button v-for="task in pickerCandidates" :key="task.id" class="picker-item" :class="{ disabled: pickerDisabled(task) }" type="button" :disabled="pickerDisabled(task)" @click="selectTaskGuarded(task)">
              <span class="pi-check" :class="{ disabled: pickerDisabled(task) }"><Icon :name="pickerDisabled(task) ? 'check' : 'plus'" :size="12" /></span>
              <span class="pi-info">
                <span class="pi-title">{{ task.title }}</span>
                <span class="pi-meta">
                  <span class="tag accent">{{ projectName(task.projectId) }}</span>
                  <span class="tag" :class="taskStatusClass(task.status)"><Icon :name="taskStatusIcon(task.status)" :size="11" /> {{ taskStatusLabel(task.status) }}</span>
                  <span v-if="pickedIds.has(task.id)" class="tag">已选入</span>
                  <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
                </span>
              </span>
              <Icon name="arrowright" :size="13" class="pi-go" />
            </button>
            <div v-if="!pickerCandidates.length" class="picker-empty">
              <Icon name="search" :size="22" />
              <b>没有匹配的任务</b>
              <span>换个关键词，或清空项目与状态筛选。</span>
              <button class="quiet-btn" type="button" @click="clearFocusSelection">清空筛选</button>
            </div>
          </div>
        </div>
        <footer class="pm-foot"><span>选中后会立即打开右侧任务详情。</span><button class="quiet-btn" type="button" @click="pickerOpen = false">取消</button></footer>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="exportOpen" class="overlay" @click="exportOpen = false" />
    </Transition>
    <Transition name="modal">
      <div v-if="exportOpen" class="picker-modal pm-modal-export" role="dialog" aria-modal="true" aria-labelledby="exportTitle">
        <header class="pm-head">
          <div><span id="exportTitle"><Icon name="download" :size="13" /> 导出三件事任务（CSV）</span></div>
          <button class="pm-close" type="button" aria-label="关闭" @click="exportOpen = false"><Icon name="x" :size="15" /></button>
        </header>
        <div class="pm-body">
          <div class="ts-label-pm">时间范围（按三件事安排日期）</div>
          <div class="pm-date-row">
            <input v-model="exportFrom" type="date" class="pm-date-input" aria-label="开始日期">
            <span class="pm-date-sep">›</span>
            <input v-model="exportTo" type="date" class="pm-date-input" aria-label="结束日期">
          </div>
          <div class="pm-export-desc">导出字段：任务内容 / 所属项目 / 项目›成功指标 / 任务状态 / 安排时间 / 创建时间</div>
        </div>
        <footer class="pm-foot"><span>导出为 UTF-8 CSV，可直接用表格软件打开。</span><button class="quiet-btn" type="button" @click="exportOpen = false">取消</button><button class="primary-btn" type="button" :disabled="exportBusy" @click="doExport"><Icon v-if="!exportBusy" name="download" :size="13" />{{ exportBusy ? '导出中…' : '导出 CSV' }}</button></footer>
      </div>
    </Transition>

    <TaskDetailDrawer ref="drawerRef" />
    <AiDrawer v-if="focusJob" :job="focusJob" @close="focusJob = null" />
  </div>
</template>

<style scoped src="./CompassHome.css"></style>
