/**
 * V4.7.6 · 任务 / 选题 / 好奇心卡池时间线与任务项目分组。
 * 注册由本轮主交付统一收口，本分片不修改总注册表。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.7.6 · 卡池时间线与任务项目分组】')

const TIMELINE = read('/newtab/components/compass/CardPoolTimeline.vue')
const TASK = read('/newtab/components/compass/TaskManagerPanel.vue')
const TASK_LOGIC = read('/newtab/components/compass/useTaskManagerPanel.ts')
const CURIO = read('/newtab/components/compass/CuriosityPanel.vue')
const CURIO_WORKBENCH = read('/newtab/components/compass/CuriosityWorkbench.vue')
const TOPIC = read('/newtab/components/compass/TopicManagerPanel.vue')
const HOME = read('/newtab/views/CompassHome.vue')
const HOME_LOGIC = read('/newtab/views/useCompassHome.ts')
const BOARD = read('/newtab/components/compass/TaskBoardView.vue')
const COMPASS = read('/newtab/stores/compass.ts')
const MODELS = read('/shared/models/index.ts')
const EVENT_LOG = read('/shared/utils/eventLog.ts')
const PROFILE_TIMELINE = read('/newtab/components/profile/PiTimeline.vue')

check('V476-POOL-1 ★共享时间线只读真实新增 / 修改 / 状态事件，沿用筛选结果并隐藏已删除卡片', () => {
  return TIMELINE.includes("new Set<EventAction>(['create', 'edit', 'status'])")
    && TIMELINE.includes('const allowed = new Set(props.cards.map(card => card.id))')
    && TIMELINE.includes('if (!card || card.deletedAt) continue')
    && TIMELINE.includes('const key = `${day}:${event.cardId}`')
    && !TIMELINE.includes('createdAt ||')
})

check('V476-POOL-2 ★时间线条目为真实卡片流，单击延迟回传卡 id 并显示实时标题 / 状态', () => {
  return TIMELINE.includes('type="button"')
    && TIMELINE.includes('class="cpt-card"')
    && TIMELINE.includes('@click="onCardClick(entry, $event)"')
    && TIMELINE.includes("clickTimer = setTimeout(() =>")
    && TIMELINE.includes("emit('select', entry.id)")
    && TIMELINE.includes('grid-template-columns: repeat(auto-fill, minmax(228px, 1fr))')
    && TIMELINE.includes('title: titleOf(card)')
    && TIMELINE.includes('status: status.name')
})

check('V476-POOL-3 ★任务时间线使用当前筛选任务，选择后打开既有完整任务详情抽屉', () => {
  return TASK_LOGIC.includes("'calendar' | 'timeline'")
    && TASK_LOGIC.includes("{ id: 'timeline', label: '时间线' }")
    && TASK_LOGIC.includes("if (next === 'timeline') void refreshWce()")
    && TASK.includes('kind="task" :events="wceEvents" :data="d" :cards="filteredTasks" @select="openDetail"')
    && TASK_LOGIC.includes('if (t) drawerRef.value?.open(t)')
    && HOME.includes("{ on: taskWorkView === 'timeline' }")
    && HOME.includes('kind="task"')
    && HOME.includes(':events="wceEvents"')
    && HOME.includes(':cards="taskWorkFiltered"')
    && HOME_LOGIC.includes("if (view === 'timeline') refreshWce?.()")
})

check('V476-POOL-4 ★好奇心时间线记忆可选，单击进入完整好奇心详情', () => {
  return CURIO.includes("{ id: 'timeline', label: '时间线', title: '时间线视图' }")
    && CURIO.includes('kind="curiosity" :events="wceEvents" :data="d" :cards="filtered" @select="openDetail"')
    && CURIO.includes('function openDetail(id: string)')
    && CURIO_WORKBENCH.includes("ref<'calendar' | 'board' | 'timeline'>('calendar')")
    && CURIO_WORKBENCH.includes('kind="curiosity" :events="wceEvents" :data="appData" :cards="filtered" @select="openCardById"')
    && CURIO_WORKBENCH.includes("if (next === 'timeline') void refreshWce()")
    && MODELS.includes("curioViewMode?: 'card' | 'list' | 'kanban' | 'timeline'")
})

check('V476-POOL-5 ★选题时间线沿用当前筛选，单击走统一完整选题抽屉', () => {
  return TOPIC.includes("ref<'calendar' | 'board' | 'timeline'>('calendar')")
    && TOPIC.includes('kind="topic" :events="wceEvents" :data="d" :cards="filteredTopics" @select="openDetail"')
    && TOPIC.includes("emitOpenDrawer({ kind: 'topic', id })")
})

check('V476-POOL-6 ★任务列表与看板均提供按项目分组，保留未关联项目组和拖拽改归属', () => {
  const kanban = TASK_LOGIC.slice(TASK_LOGIC.indexOf('const kanbanMap = computed'), TASK_LOGIC.indexOf('function kanbanGroups'))
  return TASK.includes(":groups=\"viewMode === 'list' || viewMode === 'kanban' ? TASK_GROUPS : []\"")
    && TASK_LOGIC.includes("const groupByProject = computed(() => groupMode.value === 'project')")
    && kanban.includes("groups.push({ key: '__none__', name: '未关联项目', tasks: orphan })")
    && !kanban.includes("if (orphan.length) groups.push({ key: '__none__'")
    && TASK.includes('v-for="grp in kanbanGroups(\'todo\')"')
    && TASK.includes('@drop.stop="onKanbanGroupDrop($event, \'todo\', grp.key)"')
    && TASK_LOGIC.includes('function onListGroupDrop')
    && HOME.includes("{ on: taskWorkView === 'list' }")
    && HOME.includes('v-for="group in taskWorkListGroups"')
    && HOME.includes(':group-by-project="taskWorkGroup === \'project\'"')
    && HOME_LOGIC.includes("name: '未关联项目'")
    && BOARD.includes('groupsInColumn(column.id)')
    && BOARD.includes("name: '未关联项目'")
    && BOARD.includes('groupByProject')
})

check('V476-POOL-7 ★三类卡池共用同一事件缓存，不另建存储键或重复日志', () => {
  return COMPASS.includes('wceEvents,')
    && TASK_LOGIC.includes('wceEvents, refreshWce')
    && CURIO.includes('const { wceEvents, refreshWce } = useCompass()')
    && TOPIC.includes('const { d, allProjects, wceEvents, refreshWce } = useCompass()')
    && !TIMELINE.includes('zy_event_log')
})

check('V476-POOL-8 ★edit 来自 updatedAt 严格递增快照差分，不伪造历史且不改画像热力 / 时间轴口径', () => {
  return EVENT_LOG.includes("edits.push(mk('edit', kind, titleOf(kind, c), c.id, at))")
    && EVENT_LOG.includes('prev.updatedAt && c.updatedAt && c.updatedAt > prev.updatedAt')
    && PROFILE_TIMELINE.includes("new Set<EventAction>(['create', 'status'])")
    && !TIMELINE.includes("'call'")
    && !TIMELINE.includes('createdAt ||')
})

check('V476-POOL-9 ★可双击打开卡片链接：任务 / 选题读 link，好奇心读 sourceUrl；空链只提示且不回落详情', () => {
  return TIMELINE.includes("props.kind === 'curiosity' ? (card as CuriosityCard).sourceUrl || '' : (card as TaskCard | TopicCard).link || ''")
    && TIMELINE.includes('@dblclick.stop.prevent="onCardDblClick(entry)"')
    && TIMELINE.includes('clearClickTimer()')
    && TIMELINE.includes('toOpenableRawLink(entry.link)')
    && TIMELINE.includes("showToast('该卡还没填链接')")
    && TIMELINE.includes('openExternalLink(url)')
})
