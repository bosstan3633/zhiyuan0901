/**
 * V4.7.0 · 卡片池四卡收口第一批（任务筛选 / 计划历程 / 好奇心工作面 / 资源总夹 / 搜索落项目全景）。
 *
 * 只守本轮已拍板口径：
 *   任务卡池只新增「未挂项目 / 未落图」，保留「未归档」，退役「已逾期」；
 *   计划执行日期只走 scheduleCardDate()；
 *   任务详情 / 选题详情 / 好奇心详情都展示安排历程；
 *   /deck/* 不再承载页面，统一回一级卡片池。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs')

console.log('【V4.7.0 · 卡片池四卡收口与计划历程】')

const HOME_TS = codeOnly(read('/newtab/views/useCompassHome.ts'))
const HOME = read('/newtab/views/CompassHome.vue')
const CAL = read('/newtab/components/compass/TaskCalendarView.vue')
const BOARD = read('/newtab/components/compass/TaskBoardView.vue')
const PLAN = read('/shared/storage/planSchedule.ts')
const TASK_DETAIL = read('/newtab/components/compass/TaskDetailDrawer.vue')
const TOPIC_DETAIL = read('/newtab/components/compass/TopicDetailDrawer.vue')
const CURIO = read('/newtab/components/compass/CuriosityPanel.vue')
const CURIO_WB = read('/newtab/components/compass/CuriosityWorkbench.vue')
const RES_FOLDERS = read('/newtab/components/compass/HomeResourceFolderGrid.vue')
const GP_ROWS = read('/newtab/components/useGlobalPopupsRows.ts')
const ROUTER = read('/newtab/router.ts')
const SYNC = read('/shared/cloud/sync.ts')
const TREE_TS = codeOnly(read('/newtab/views/useCompassTree.ts'))

check('POOL470-1 ★任务快捷筛选只新增未挂项目/未落图：保留未归档与主攻项目，已逾期从类型、计数和过滤链彻底退役', () => {
  return HOME_TS.includes("type TaskWorkQuick = 'all' | 'noProject' | 'unplanned' | 'unarchived' | 'focus'")
    && HOME_TS.includes("noProject: liveTasks.value.filter(task => !task.projectId || !taskWorkProjectNames.value.has(task.projectId)).length")
    && HOME_TS.includes("unplanned: liveTasks.value.filter(task => !task.dueDate).length")
    && HOME_TS.includes("if (quick === 'noProject'")
    && HOME_TS.includes("if (quick === 'unplanned' && task.dueDate) return false")
    && !HOME_TS.includes("'overdue'")
    && !HOME_TS.includes('taskWorkCounts.overdue')
})

check('POOL470-2 ★V4.7.1 随迁备案：五个快捷入口由 .task-work-quick 按钮组迁入 .twt-quick-field 下拉（all/noProject/unplanned/unarchived/focus），仍无「已逾期/未排期」旧词', () => {
  const toolbar = segOf(HOME, 'class="twt-field twt-quick-field"', '</label>')
  return toolbar.includes('v-model="taskWorkQuick"')
    && toolbar.includes('aria-label="任务快速筛选"')
    && toolbar.includes('value="all"')
    && toolbar.includes('value="noProject"')
    && toolbar.includes('value="unplanned"')
    && toolbar.includes('value="unarchived"')
    && toolbar.includes('value="focus"')
    && toolbar.includes('全部（{{ taskWorkCounts.all }}）')
    && toolbar.includes('未挂项目（{{ taskWorkCounts.noProject }}）')
    && toolbar.includes('未落图（{{ taskWorkCounts.unplanned }}）')
    && toolbar.includes('未归档（{{ taskWorkCounts.unarchived }}）')
    && toolbar.includes('主攻项目（{{ taskWorkCounts.focus }}）')
    && !toolbar.includes('已逾期')
    && !toolbar.includes('未排期')
    && HOME_TS.includes("if (quick === 'noProject'")
    && HOME_TS.includes("if (quick === 'unplanned' && task.dueDate) return false")
})

check('POOL470-3 ★V4.7.1 随迁备案：任务列表默认最新入池 + 未落图优先 + 按项目分组不变；看板由固定三列改为 TaskStatusDef 动态列，拖拽仍写一级任务池', () => {
  return HOME_TS.includes("const taskWorkSort = ref<TaskWorkSort>('recent')")
    && HOME_TS.includes("const taskWorkGroup = ref<TaskWorkGroup>('none')")
    && HOME.includes('v-model="taskWorkSort"')
    && HOME.includes('v-model="taskWorkGroup"')
    && HOME.includes('<TaskBoardView')
    && BOARD.includes('const columns = computed(() => [...props.statuses]')
    && BOARD.includes('label: status.name')
    && BOARD.includes("emit('set-status', id, statusId)")
    && HOME.includes(':statuses="taskWorkStatusOptions"')
    && HOME.includes('@set-status="setTaskWorkStatus"')
    && HOME_TS.includes('function setTaskWorkStatus(taskId: string, statusId: string): void')
    && HOME_TS.includes('if (!status || !setTaskStatusById(d.value, task, statusId)) return')
    && CAL.includes('poolGroups')
    && CAL.includes("props.groupMode !== 'project'")
    && CAL.includes('最新入池在前')
})

check('POOL470-4 ★日历不再从计划日期推导逾期：无逾期红、无「已逾期」徽标、无逾期图例；空日期统一叫未落图，未挂项目占位改名', () => {
  return !CAL.includes('isOverdue')
    && !CAL.includes('已逾期')
    && !CAL.includes('tone-overdue')
    && !CAL.includes('cal-warn')
    && CAL.includes("if (!key) return '未落图'")
    && CAL.includes("|| '未挂项目'")
    && CAL.includes("return 'past'")
})

check('PLAN470-1 ★计划执行日期唯一写入口：详情/日历/今日重点/快捷加三件事都走 scheduleCardDate，撤销回滚不记第二次历史', () => {
  return PLAN.includes('export function scheduleCardDate')
    && PLAN.includes('if (!next || opts.record === false) return true')
    && TASK_DETAIL.includes('scheduleCardDate(d.value, selectedTask.value, value, { source: \'detail\' })')
    && TOPIC_DETAIL.includes('scheduleCardDate(d.value, topic.value, value, { source: \'detail\' })')
    && HOME_TS.includes("scheduleCardDate(d.value, task, date, { source: 'calendar' })")
    && HOME_TS.includes("scheduleCardDate(d.value, current, previous, { source: 'calendar', record: false })")
    && HOME_TS.includes("scheduleCardDate(d.value, task, undefined, { source: 'calendar' })")
})

check('PLAN470-2 ★任务/选题/好奇心三处详情都展示安排历程，且删除只写墓碑、不改当前计划', () => {
  return TASK_DETAIL.includes('<PlanScheduleHistory')
    && TASK_DETAIL.includes('card-kind="task"')
    && TOPIC_DETAIL.includes('<PlanScheduleHistory')
    && TOPIC_DETAIL.includes('card-kind="topic"')
    && CURIO.includes('<PlanScheduleHistory')
    && CURIO.includes('card-kind="curiosity"')
    && PLAN.includes('export function removePlanEvent')
    && PLAN.includes('event.removedAt = removedAt')
    && !segOf(PLAN, 'export function removePlanEvent', 'export function restorePlanEvent').includes('dueDate =')
})

check('CURIO470-1 ★好奇心一级工作面：左侧清单 + 右侧日历/看板，三视图同源，可拖拽落图与改状态', () => {
  return CURIO_WB.includes('class="cw-pool"')
    && CURIO_WB.includes("viewMode = ref<'calendar' | 'board'>('calendar')")
    && CURIO_WB.includes('class="cw-calendar"')
    && CURIO_WB.includes('class="cw-board"')
    && CURIO_WB.includes("scheduleCardDate(store.data!, card, day, { source: 'calendar' })")
    && CURIO_WB.includes("setStatus(card.id, status)")
    && HOME.includes('<CuriosityWorkbench />')
})

check('RES470-1 ★资源卡一级页新增「全部资源卡」总夹，右侧抽屉内嵌 PoolCardsPanel，批量/镜像/右键能力不复制不丢失', () => {
  return RES_FOLDERS.includes('全部资源卡')
    && RES_FOLDERS.includes("import PoolCardsPanel from './PoolCardsPanel.vue'")
    && RES_FOLDERS.includes(':open="allOpen"')
    && RES_FOLDERS.includes('<PoolCardsPanel hide-folder-entry />')
    && RES_FOLDERS.includes('poolResources.length')
    && RES_FOLDERS.includes('onDeactivated(')
    && RES_FOLDERS.includes('allOpen.value = false')
    && RES_FOLDERS.includes('detailOpen.value = false')
    && RES_FOLDERS.includes('foldersOpen.value = false')
})

check('SEARCH470-1 ★全局搜索任务页签：选中已挂项目任务 → 项目全景并高亮任务；未挂项目 → 任务卡池详情兜底', () => {
  return GP_ROWS.includes('function locateTaskInPano')
    && GP_ROWS.includes("router.push({ path: '/compass', query })")
    && GP_ROWS.includes("pano: '1'")
    && GP_ROWS.includes('task: task.id')
    && GP_ROWS.includes("router.push({ path: '/deck/task', query: { hl: task.id, hk: 'task' } })")
    && GP_ROWS.includes("if (item.type === 'task')")
})

check('SEARCH470-2 ★项目全景深链首挂载即生效：/compass?pano=1&proj=&task= 在 onMounted 主动补跑一次定位', () => {
  return TREE_TS.includes('function locatePanoFromQuery()')
    && TREE_TS.includes("q.pano !== '1'")
    && TREE_TS.includes('watch(() => route.query, locatePanoFromQuery)')
    && TREE_TS.includes('onMounted(() => locatePanoFromQuery())')
})

check('ROUTE470-1 ★/deck/* 二级界面退役为一级重定向：保留旧 query（hl/hk/fresh）到 /?tab=kind，不再挂 CompassDeckView', () => {
  const route = segOf(ROUTER, "path: '/deck/:kind(task|topic|curiosity|resource)'", "path: '/deck/inbox'")
  return route.includes('redirect:')
    && route.includes("path: '/'")
    && route.includes("tab: String(to.params.kind || 'task')")
    && route.includes('...to.query')
    && !route.includes('CompassDeckView')
})

check('SYNC470-1 ★计划历程进入云同步契约：独立记录类型、计数与三方合并归一化都在同一份 manifest 里', () => {
  return SYNC.includes("'planScheduleEvent'")
    && SYNC.includes('planScheduleEvents: number')
    && SYNC.includes("planScheduleEvent: ['cardId', 'cardKind', 'at', 'date', 'fromDate', 'source', 'removedAt']")
})
