/**
 * V4.5.0 · 选题卡系统。
 *
 * 这组断言锁用户已确认的产品口径：
 *   · 任务卡与选题卡共用今日三件事三个槽位，并严格同源到今日日历；
 *   · 选择器同时支持关键词、项目、任务状态、选题状态与卡型筛选；
 *   · 选题卡以标题为主视觉，关联资源卡是核心动作，说明保持克制；
 *   · 默认四状态可由用户改名/改色/排序，但只能有一个完成态；
 *   · 选题进入方向成果层、云同步、事件流水、画像指标与回收站；
 *   · 无引用附件只由用户手动清理，不新增自动清理。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.5.0 · 选题卡系统与今日联动】')

const MODELS = read('/shared/models/index.ts')
const DEFAULTS = read('/shared/storage/defaults.ts')
const TOPIC_STATUS = read('/shared/utils/topicStatus.ts')
const LEGACY = read('/shared/storage/legacy-normalize.ts')
const HOME = read('/newtab/views/CompassHome.vue')
const HOME_DATA = read('/newtab/views/useCompassHome.ts')
const FOCUS_SLOTS = read('/shared/utils/focusSlots.ts')
const TOPIC_MANAGER = read('/newtab/components/compass/TopicManagerPanel.vue')
const TOPIC_CALENDAR = read('/newtab/components/compass/TopicCalendarView.vue')
const TOPIC_DRAWER = read('/newtab/components/compass/TopicDetailDrawer.vue')
const TOPIC_LINKS = read('/shared/utils/topicLinks.ts')
const TOPIC_RESOURCE_LINKS = read('/shared/utils/topicResourceLinks.ts')
const TOPIC_STATUS_EDITOR = read('/newtab/views/settings/TopicStatusEditor.vue')
const SHORTCUTS = read('/shared/utils/shortcuts.ts')
const BACKGROUND = read('/background/index.ts')
const OVERLAY = read('/content/overlay-impl.ts')
const CLOUD_SYNC = read('/shared/cloud/sync.ts')
const CLOUD_MERGE = read('/shared/cloud/threeWayMerge.ts')
const CLOUD_ACTIONS = read('/shared/cloud/syncActions.ts')
const EVENT_LOG = read('/shared/utils/eventLog.ts')
const DAILY_STATS = read('/shared/utils/dailyStats.ts')
const PROFILE = read('/newtab/views/useProfileInsights.ts')
const PI_OVERVIEW = read('/newtab/components/profile/PiOverview.vue')
const RECYCLE = read('/newtab/views/RecycleBin.vue')
const PURGE = read('/shared/storage/purge.ts')
const LINK_MODAL = read('/newtab/components/LinkCardsModal.vue')
const CURATION_NODE = read('/newtab/components/curation/CurationMindNode.vue')
const PANO_LANE = read('/newtab/components/compass/CompassPanoLane.vue')
const DATA_PACKAGE = read('/newtab/views/settings/dataPackage.ts')
const ASSET_PACK = read('/newtab/views/settings/assetPack.ts')
const DATA_MANAGEMENT = read('/newtab/views/settings/SettingsDataManagement.vue')
const ROUTER = read('/newtab/router.ts')

check('V450-1 ★选题卡是独立第五卡型：标题、项目/指标、可编辑状态、计划执行日期、资源关系表与成果链接齐备，任务卡模型不被混用', () => {
  return MODELS.includes('export interface TopicCard extends CardBase')
    && MODELS.includes("kind: 'topic'")
    && MODELS.includes('statusId: ID')
    && MODELS.includes('statusBeforeDoneId?: ID')
    && MODELS.includes('dueDate?: string')
    && MODELS.includes('export interface TopicResourceLink')
    && MODELS.includes('topicResourceLinks?: TopicResourceLink[]')
    && MODELS.includes('topics: TopicCard[]')
})

check('V450-2 ★默认选题状态采用已确认四档：构思中 / 制作中 / 待发布 / 已发布；仅“已发布”默认完成态', () => {
  const names = ['构思中', '制作中', '待发布', '已发布']
  return names.every(name => DEFAULTS.includes(`name: '${name}'`))
    && DEFAULTS.includes("id: 'topic-published'")
    && DEFAULTS.includes('terminal: true')
    && DEFAULTS.indexOf('terminal: true') > DEFAULTS.indexOf("id: 'topic-published'")
})

check('V450-3 ★状态真源允许改名、改色、排序、增删，但入库边界强制有且只有一个完成态；悬空状态与完成时间同步收敛', () => {
  return TOPIC_STATUS.includes('export function normalizeTopicStatusDomain')
    && TOPIC_STATUS.includes('const terminal = ordered.find(status => status.terminal) || ordered.at(-1)!')
    && TOPIC_STATUS.includes('status.terminal = status.id === terminal.id')
    && TOPIC_STATUS.includes('topic.statusId = fallbackId')
    && TOPIC_STATUS.includes('topic.completedAt = undefined')
    && LEGACY.includes('normalizeTopicStatusDomain(d)')
    && TOPIC_STATUS_EDITOR.includes('function rename(')
    && TOPIC_STATUS_EDITOR.includes('function recolor(')
    && TOPIC_STATUS_EDITOR.includes('function move(')
    && TOPIC_STATUS_EDITOR.includes('function addStatus(')
    && TOPIC_STATUS_EDITOR.includes('function removeStatus(')
    && TOPIC_STATUS_EDITOR.includes('有且只有一个')
})

check('V450-4（V4.7.0 重指）★任务卡与选题卡共用三个今日槽位：固定 tombstone、满额拒绝第 4 项、移出/排期统一走 scheduleCardDate 清空或写入 dueDate', () => {
  const detachTopic = FOCUS_SLOTS.slice(
    FOCUS_SLOTS.indexOf('export function detachFocusTopicFromDate'),
    FOCUS_SLOTS.indexOf('/** 按来源类型清理排期'),
  )
  const detachTask = FOCUS_SLOTS.slice(
    FOCUS_SLOTS.indexOf('export function detachFocusTaskFromDate'),
    FOCUS_SLOTS.indexOf('/** 把选题卡移出某天三件事时'),
  )
  const selectTopic = HOME_DATA.slice(
    HOME_DATA.indexOf('function selectTopicForSlot(topic: TopicCard)'),
    HOME_DATA.indexOf('const pickerCandidates'),
  )
  return FOCUS_SLOTS.includes('FOCUS_LIMIT = 3')
    && FOCUS_SLOTS.includes('export function normalizedFocusSlots')
    && FOCUS_SLOTS.includes('export function detachFocusTopicFromDate')
    && detachTopic.includes("scheduleCardDate(data, topic, undefined, { source: 'focus', record: false })")
    && detachTask.includes("scheduleCardDate(data, task, undefined, { source: 'focus', record: false })")
    && !detachTopic.includes('topic.dueDate = undefined')
    && HOME_DATA.includes("type FocusPickerCandidate")
    && HOME_DATA.includes("{ kind: 'topic'; card: TopicCard }")
    && HOME_DATA.includes("sourceType: 'topic'")
    && HOME_DATA.includes('topic.dueDate !== key')
    && !!selectTopic
    && selectTopic.includes("scheduleCardDate(d.value, topic, key, { source: 'focus' })")
    && !selectTopic.includes('topic.dueDate = key')
    && HOME_DATA.includes('if (result.status === \'full\')')
})

check('V450-5 ★选题进入今日三件事时推进到第一个非终点状态；完成/取消完成优先恢复此前状态，槽位复选框与真状态同源', () => {
  return TOPIC_STATUS.includes('export function topicInProgressStatus')
    && TOPIC_STATUS.includes('export function setTopicStatus')
    && TOPIC_STATUS.includes('topic.statusBeforeDoneId = topic.statusId')
    && TOPIC_STATUS.includes('export function toggleTopicDone')
    && TOPIC_STATUS.includes('topic.statusBeforeDoneId || topicInProgressStatus(data)?.id')
    && HOME_DATA.includes('topicStatusSnapshotId')
    && HOME_DATA.includes('slot.topicStatusBeforeDoneId = topic.statusId')
    && HOME_DATA.includes('const restore = slot.topicStatusBeforeDoneId')
})

check('V450-6 ★今日选择器支持关键词、项目、任务状态、选题状态与卡型筛选；全部 / 任务卡 / 选题卡三档同时可达', () => {
  return HOME.includes('placeholder="搜索任务 / 选题标题、项目或指标…"')
    && HOME.includes('@click="pickerCardType = \'all\'"')
    && HOME.includes('@click="pickerCardType = \'task\'"')
    && HOME.includes('@click="pickerCardType = \'topic\'"')
    && HOME.includes('v-if="pickerCardType !== \'topic\'" v-model="pickerStatus"')
    && HOME.includes('v-if="pickerCardType !== \'task\'" v-model="pickerTopicStatus"')
    && HOME_DATA.includes('pickerCardType.value === \'topic\' ? [] : d.value.tasks')
    && HOME_DATA.includes('pickerCardType.value === \'task\' ? [] : (d.value.topics || [])')
    && HOME_DATA.includes('topicStatus === \'all\' || topic.statusId === topicStatus')
})

check('V450-7（V4.7.7 重指）★选题详情以完整标题为第一视觉：标题可换行、项目/指标与状态克制呈现，关联资源卡是核心面板，资源从卡池多选弹窗挂载，AI 找资源贴身放置，说明框限高', () => {
  return TOPIC_DRAWER.includes('class="topic-title"')
    && TOPIC_DRAWER.includes('rows="3"')
    && TOPIC_DRAWER.includes('class="topic-owner"')
    && TOPIC_DRAWER.includes('class="topic-resource-core"')
    && TOPIC_DRAWER.includes('关联资源卡')
    && TOPIC_DRAWER.includes('AI 找资源')
    && TOPIC_DRAWER.includes('topic-pick-resource')
    && TOPIC_DRAWER.includes('CardResourcePickerModal')
    && TOPIC_DRAWER.includes('class="topic-note"')
    && TOPIC_DRAWER.includes('min-height: 66px; max-height: 110px')
    && !TOPIC_DRAWER.includes('class="topic-subtasks"')
})

check('V450-8（V4.7.7 重指）★选题工作面与任务池同构：左侧可折叠清单，右侧月/周日历、按状态分组的看板与卡片时间线；拖拽改状态、改 dueDate 与今天严格同源。选题日历只读 topic.dueDate，不再混入任务或今日三件事。', () => {
  return TOPIC_MANAGER.includes('class="topic-workbench"')
    && TOPIC_MANAGER.includes('class="topic-collapse-inline"')
    && TOPIC_MANAGER.includes(':class="{ \'list-hidden\': listCollapsed }"')
    && TOPIC_MANAGER.includes('viewMode === \'calendar\'')
    && TOPIC_MANAGER.includes("viewMode === 'timeline'")
    && TOPIC_MANAGER.includes('<CardPoolTimeline v-else-if="viewMode === \'timeline\'" kind="topic"')
    && TOPIC_MANAGER.includes('class="topic-board"')
    && TOPIC_MANAGER.includes('@drop.prevent="onBoardDrop(column.status.id)"')
    && TOPIC_CALENDAR.includes("calendarMode = ref<'month' | 'week'>('month')")
    && TOPIC_CALENDAR.includes('const scheduled = computed(() => props.topics.filter')
    && TOPIC_CALENDAR.includes('/^\\d{4}-\\d{2}-\\d{2}$/.test(topic.dueDate || \'\')')
    && !TOPIC_CALENDAR.includes('focusTopics')
    && !TOPIC_CALENDAR.includes('focusTasks')
    && !TOPIC_CALENDAR.includes('focusEntries')
    && !TOPIC_CALENDAR.includes("emit('set-task-due', id, day)")
    && TOPIC_CALENDAR.includes("emit('set-due', id, day)")
})

check('V450-9（V4.7.0 重指）★调度台四卡池同源：一级接管任务 / 选题 / 好奇心 / 资源页签，旧 /deck 深链保留 query 重定向；选题角标只统计今日新增，选题卡池默认最新在前', () => {
  return HOME.includes("handTab === 'task'")
    && HOME.includes("handTab === 'topic'")
    && HOME.includes("handTab === 'curiosity'")
    && HOME.includes("handTab === 'resource'")
    && HOME.includes('TopicManagerPanel')
    && HOME_DATA.includes("type HandKind = 'task' | 'topic' | 'curiosity' | 'resource'")
    && HOME_DATA.includes('topic: liveTopics.value.filter(topic => createdToday(topic.createdAt)).length')
    && ROUTER.includes("path: '/deck/:kind(task|topic|curiosity|resource)'")
    && ROUTER.includes("tab: String(to.params.kind || 'task')")
    && ROUTER.includes('...to.query')
    && ROUTER.includes("...(to.params.kind === 'resource' ? { all: '1' } : {})")
    && HOME.includes('route.query.tab')
    && HOME.includes('route.query.hl')
    && HOME.includes('route.query.hk')
    && HOME.includes('TAB_ALIAS[tabKey]')
    && TOPIC_MANAGER.includes("const sortMode = ref<'recent' | 'unplanned' | 'due'>('recent')")
    && TOPIC_MANAGER.includes('.sort((a, b) =>')
    && TOPIC_MANAGER.includes('(Number(b.pinned) - Number(a.pinned))')
    && TOPIC_MANAGER.includes('((b.createdAt || 0) - (a.createdAt || 0))')
})

check('V450-10 ★设置页提供选题卡字段组、状态编辑入口、快捷键与采集入口；状态定义与字段组进入数据包/附件索引', () => {
  return TOPIC_STATUS_EDITOR.includes('完成态有且只有一个')
    && DATA_PACKAGE.includes('imported.topicStatuses')
    && DATA_PACKAGE.includes("for (const key of ['resource', 'task', 'curiosity', 'topic', 'thesis']")
    && ASSET_PACK.includes("push('topic'")
    && SHORTCUTS.includes('直达选题卡池')
    && SHORTCUTS.includes('快速采集选题卡')
    && BACKGROUND.includes("case 'goto-topic'")
    && BACKGROUND.includes("case 'open-topic'")
    && OVERLAY.includes('openTopicCapture')
})

check('V450-11 ★选题卡进入方向树成果层：项目/指标用 topic.metricId 与 metric.topicIds 双路并集，方向台以“成果”标签突出选题', () => {
  const TOPIC_META = read('/newtab/views/compassTopicMeta.ts')
  return TOPIC_META.includes('topicsOfProject')
    && TOPIC_META.includes('topicsOfMetric')
    && TOPIC_META.includes('topic.metricId === metric.id || linkedIds.has(topic.id)')
    && MODELS.includes('topicIds?: ID[]')
    && PANO_LANE.includes('class="ltopic-result">成果')
    && PANO_LANE.includes("emit('openTopic', topic.id)")
    && CURATION_NODE.includes('<span class="mind-topic-kind">成果</span>')
})

check('V450-12 ★选题卡与资源卡关系独立成表：详情可手动/AI关联、解绑不影响资源本体，快照在源卡变化后仍可读', () => {
  return TOPIC_RESOURCE_LINKS.includes('export function addTopicResourceLink')
    && TOPIC_RESOURCE_LINKS.includes('export function removeTopicResourceLink')
    && TOPIC_RESOURCE_LINKS.includes('export function topicResourcesOf')
    && TOPIC_RESOURCE_LINKS.includes('snapshot')
    && TOPIC_DRAWER.includes("from: 'manual'")
    && TOPIC_DRAWER.includes('runAiSupport')
    && TOPIC_DRAWER.includes('资源卡本体不受影响')
    && TOPIC_LINKS.includes('export function attachTopicToMetric')
    && TOPIC_LINKS.includes('export function softDeleteTopicToTrash')
})

check('V450-13 ★选题卡进入云同步与三方合并：卡、状态定义、资源关系表都进 manifest / snapshot / 冲突动作，不绕过既有业务真源', () => {
  return CLOUD_SYNC.includes("'topic'")
    && CLOUD_SYNC.includes("'topicStatus'")
    && CLOUD_SYNC.includes("'topicResourceLink'")
    && CLOUD_SYNC.includes('topics: number')
    && CLOUD_SYNC.includes('topicStatuses: number')
    && CLOUD_SYNC.includes('topicResourceLinks: number')
    && CLOUD_MERGE.includes("topics: 'topic'")
    && CLOUD_MERGE.includes("topicStatuses: 'topicStatus'")
    && CLOUD_MERGE.includes("topicResourceLinks: 'topicResourceLink'")
    && CLOUD_ACTIONS.includes("case 'topic'")
    && CLOUD_ACTIONS.includes("case 'topicStatus'")
    && CLOUD_ACTIONS.includes("case 'topicResourceLink'")
})

check('V450-14 ★选题进入事件流水、日报统计与画像洞察：状态/新增/调出可追踪，画像顶部有选题专属指标并可下钻', () => {
  return EVENT_LOG.includes("new Set(['curiosity', 'task', 'topic'])")
    && EVENT_LOG.includes("push('topic', d.topics)")
    && DAILY_STATS.includes('topic: number')
    && DAILY_STATS.includes('kind === \'topic\'')
    && PROFILE.includes('gTopicLive')
    && PROFILE.includes('topicPublished')
    && PROFILE.includes('topicSupported')
    && PROFILE.includes('topicMonthAdded')
    && PI_OVERVIEW.includes('选题成果')
    && PI_OVERVIEW.includes("emit('topic-drill', 'topic-all')")
    && PI_OVERVIEW.includes("emit('topic-drill', 'topic-published')")
    && PI_OVERVIEW.includes("emit('topic-drill', 'topic-supported')")
    && PI_OVERVIEW.includes("emit('topic-drill', 'topic-month')")
})

check('V450-15 ★选题卡可撤销删除与永久清理：回收站有独立分页，硬删时同步摘指标、今日槽、资源关系与策展节点引用', () => {
  return RECYCLE.includes("const tab = ref<'res' | 'task' | 'topic' | 'curio' | 'cat' | 'arg'>('res')")
    && RECYCLE.includes('选题卡')
    && RECYCLE.includes('purgeTopic')
    && PURGE.includes('topicResourceLinks')
    && PURGE.includes('topicIds')
    && PURGE.includes('m.topicIds = (m.topicIds || []).filter(id => !topicIds.has(id))')
    && PURGE.includes("slot.sourceType === 'topic'")
    && TOPIC_LINKS.includes('unlinkTopicFromCategories')
})

check('V450-16 ★策展节点入口统一为“关联卡片”：候选支持全部 / 资源卡 / 选题卡筛选，选题以“成果”标记且同节点判重', () => {
  return LINK_MODAL.includes("{ key: 'all'")
    && LINK_MODAL.includes("{ key: 'resource', label: '资源卡' }")
    && LINK_MODAL.includes("{ key: 'topic', label: '选题卡' }")
    && LINK_MODAL.includes("c.kind === 'topic' ? '已关联' : '已在本节点'")
    && LINK_MODAL.includes("c.kind === 'topic' ? '成果' : '资源'")
    && CURATION_NODE.includes('关联资源卡或选题卡')
    && LINK_MODAL.includes('选题卡会以“成果”标记挂到节点')
})

check('V450-17 ★无引用附件只提供手动清理：设置页显式按钮 + 二次确认；启动与读路径没有自动清理调用', () => {
  const autoHits = [
    BACKGROUND,
    read('/shared/storage/repository.ts'),
    read('/newtab/main.ts'),
  ].filter(text => /cleanupOrphanAssetsOf\s*\(/.test(text)).length
  return DATA_MANAGEMENT.includes('清理无引用附件')
    && DATA_MANAGEMENT.includes('function clearOrphanAssets')
    && DATA_MANAGEMENT.includes('await useConfirm({')
    && DATA_MANAGEMENT.includes('本操作不可恢复')
    && autoHits === 0
})

check('V450-18 ★选题状态与关系记录跨本机/导入/云恢复同源：默认状态在字段组、导入合并、回收站恢复与数据包中都保留，不被二次导入覆盖', () => {
  return DEFAULTS.includes('defaultTopicStatuses')
    && DATA_PACKAGE.includes('d.topicStatuses = mergeById')
    && DATA_PACKAGE.includes('defaultTopicStatuses()')
    && DATA_PACKAGE.includes('d.topicResourceLinks = mergeById')
    && RECYCLE.includes('attachTopicToMetric')
    && read('/shared/storage/repository.ts').includes('normalizeLegacyCards(data)')
    && LEGACY.includes('normalizeTopicStatusDomain(d)')
})
