/**
 * V4.6.0 · 选题成果链路、清单折叠、单项目聚焦与云恢复稳定性。
 *
 * 本轮只锁用户确认过的七项边界：
 *   · 旧云快照缺 V4.5 数组时，恢复后切换调度台不得在 `.map()` 崩溃；
 *   · 选题成果链接前置，网页 / Obsidian 都能保存并双击直达；
 *   · 任务与选题清单的折叠入口贴标题，收起后日历铺满；
 *   · 选题可从左侧清单拖入日历，今日仍与三件事同源；
 *   · 方向树单项目聚焦居中；
 *   · 策展台中心论点与页面工具栏双列合并；
 *   · 云同步不再清空会话内画布操作历史。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.6.0 · 选题成果、同步恢复与策展布局】')

const REPOSITORY = read('/shared/storage/repository.ts')
const RECONCILE = read('/shared/cloud/reconcileAssets.ts')
const CLOUD_SYNC = read('/newtab/composables/useCloudSync.ts')
const HISTORY = read('/newtab/composables/useCurationCanvasHistory.ts')
const BATTLE = read('/newtab/components/dashboard/TodayBattleHost.vue')
const HOME = read('/newtab/views/CompassHome.vue')
const TASK_CALENDAR = read('/newtab/components/compass/TaskCalendarView.vue')
const TASK_CSS = read('/newtab/components/compass/TaskCalendarView.css')
const TOPIC_MANAGER = read('/newtab/components/compass/TopicManagerPanel.vue')
const TOPIC_CALENDAR = read('/newtab/components/compass/TopicCalendarView.vue')
const TOPIC_DRAWER = read('/newtab/components/compass/TopicDetailDrawer.vue')
const TOPIC_OUTCOME = read('/shared/utils/topicOutcome.ts')
const TREE = read('/newtab/components/compass/curation/CurationTreeLayout.vue')
const WORKSPACE = read('/newtab/views/Workspace.vue')
const WORKSPACE_CSS = read('/newtab/views/workspace.css')

check('V460-1 ★云快照与本机载入共用 normalizeAppData；附件协调和调度台战报在旧 V4.5 快照缺数组时也有兜底，不再整页读 undefined.map', () => {
  return REPOSITORY.includes('export function normalizeAppData(data: AppData): AppData')
    && REPOSITORY.includes('normalizeAppData(data)')
    && REPOSITORY.includes('normalizeAppData(opts.nextData)')
    && RECONCILE.includes('nextData.resources = Array.isArray(nextData.resources)')
    && RECONCILE.includes('nextData.tasks = Array.isArray(nextData.tasks)')
    && RECONCILE.includes('nextData.curiosities = Array.isArray(nextData.curiosities)')
    && RECONCILE.includes('nextData.categories = Array.isArray(nextData.categories)')
    && BATTLE.includes('...(gd.value.resources || []).map')
    && BATTLE.includes('...(gd.value.topics || []).map')
})

check('V460-2 ★选题成果链接提前到详情首屏：识别 http(s)、裸域名与 obsidian://，提供打开、复制、类型提示，旧底部字段不再重复', () => {
  return TOPIC_OUTCOME.includes('/^obsidian:\\/\\//i')
    && TOPIC_OUTCOME.includes('/^https?:\\/\\//i')
    && TOPIC_OUTCOME.includes('`https://${raw}`')
    && TOPIC_OUTCOME.includes('export function openTopicOutcome')
    && TOPIC_DRAWER.includes('class="topic-outcome"')
    && TOPIC_DRAWER.includes('发布 / 成果链接')
    && TOPIC_DRAWER.includes('打开 Obsidian')
    && TOPIC_DRAWER.includes('@click="openOutcomeLink"')
    && TOPIC_DRAWER.includes('@click="copyOutcomeLink"')
    && !TOPIC_DRAWER.includes('class="topic-link"')
})

check('V460-3 ★双击选题卡直接打开成果链接，单击仍延迟打开详情；今日三件事、选题清单、日历与看板四处共用同一交互口径', () => {
  return TOPIC_MANAGER.includes('function scheduleTopicOpen')
    && TOPIC_MANAGER.includes('function openTopicDirect')
    && TOPIC_MANAGER.includes('@dblclick.stop.prevent="openTopicDirect(topic)"')
    && TOPIC_CALENDAR.includes("emit('open-topic-link', entry.topic)")
    && HOME.includes('@click="scheduleTopicPreview(c.topic)"')
    && HOME.includes('@dblclick.stop.prevent="openTopicPreviewDirect(c.topic)"')
    && read('/newtab/views/useCompassHome.ts').includes('if (!openTopicOutcome(topic)) openTopicPreview(topic)')
})

check('V460-4 ★任务清单与选题清单的折叠入口都在清单标题旁；折叠后正文视图占满整行，并从视图头部提供展开入口', () => {
  return TASK_CALENDAR.includes('<b>任务清单</b>')
    && TASK_CALENDAR.includes('class="cal-list-collapse"')
    && TASK_CALENDAR.includes('class="cal-list-expand"')
    && TASK_CSS.includes('.task-calendar.list-hidden')
    && TASK_CSS.includes('.task-calendar.list-hidden .cal-pool')
    && TOPIC_MANAGER.includes('<b>选题清单</b>')
    && TOPIC_MANAGER.includes('class="topic-collapse-inline"')
    && TOPIC_MANAGER.includes('class="topic-expand"')
    && TOPIC_MANAGER.includes('.list-hidden .topic-workbench')
})

check('V460-5 ★选题清单拖拽载荷为 topic:id，日历按 kind 分流到选题排期；拖入今日仍走三件事容量与严格同源校验', () => {
  return TOPIC_MANAGER.includes("setData('text/plain', `topic:${topic.id}`)")
    && TOPIC_CALENDAR.includes("payload.split(':', 2)")
    && TOPIC_CALENDAR.includes("if (kind === 'task') emit('set-task-due', id, day)")
    && TOPIC_CALENDAR.includes("else emit('set-due', id, day)")
    && TOPIC_MANAGER.includes('const result = addManualTopicFocus(d.value, date, topic.id)')
    && TOPIC_MANAGER.includes("if (result.status === 'full')")
})

check('V460-6 ★方向树单项目聚焦后不再贴左：目标层最大宽度收敛并水平居中，项目卡成为主视觉', () => {
  const focusedGoals = TREE.slice(
    TREE.indexOf('.ctl.focused .ctl-goals {'),
    TREE.indexOf('.ctl.focused .ctl-goal-card'),
  )
  return focusedGoals.includes('width: min(100%, 1180px);')
    && focusedGoals.includes('margin-inline: auto;')
    && focusedGoals.includes('grid-template-columns: minmax(0, 1fr);')
    && focusedGoals.includes('justify-content: center;')
    && TREE.includes('.ctl.focused .ctl-proj-title')
    && TREE.includes(':class="{ focused }"')
})

check('V460-7 ★策展台中心论点与页面工具栏合并为同一双列控制台；≤900px 自动单列，画布获得更多纵向空间且左右仍对齐', () => {
  return WORKSPACE.includes('class="ws-curation-console"')
    && WORKSPACE.indexOf('class="ws-curation-console"') < WORKSPACE.indexOf('class="thesis-banner"')
    && WORKSPACE_CSS.includes('grid-template-columns: minmax(0, 1.55fr) minmax(380px, .9fr)')
    && WORKSPACE_CSS.includes('.ws-curation-console .cur-toolbar')
    && WORKSPACE_CSS.includes('@media (max-width: 900px)')
    && WORKSPACE_CSS.includes('.ws-curation-console { grid-template-columns: minmax(0, 1fr);')
})

check('V460-8 ★云同步恢复只替换业务数据，不派发画布历史重置；切换 / 删除策展台仍按原规则单独清理对应时间线', () => {
  const cloudApply = CLOUD_SYNC.slice(
    CLOUD_SYNC.indexOf('async function applyCloudSnapshotToLocal'),
    CLOUD_SYNC.indexOf('/** 恢复时把附件元数据'),
  )
  return !cloudApply.includes('zy:curation-history-reset')
    && HISTORY.includes('云同步恢复不得调用')
    && read('/newtab/composables/useWsMeta.ts').includes("window.dispatchEvent(new CustomEvent('zy:curation-history-reset'")
})
