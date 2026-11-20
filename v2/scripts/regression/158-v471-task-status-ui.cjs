/**
 * V4.7.1 · 任务自定义状态 UI 全量接入。
 *
 * 锁定任务详情、看板、月历、任务池筛选、项目全貌与旧 /deck 兼容页
 * 都消费同一套 TaskStatusDef；完成语义仍以 terminal 为准。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.7.1 · 任务自定义状态 UI】')

const HOME = read('/newtab/views/CompassHome.vue')
const LOGIC = read('/newtab/views/useCompassHome.ts')
const BOARD = read('/newtab/components/compass/TaskBoardView.vue')
const CAL = read('/newtab/components/compass/TaskCalendarView.vue')
const DETAIL = read('/newtab/components/compass/TaskDetailDrawer.vue')
const PROJECT = read('/newtab/components/ProjectDetailDrawer.vue')
const DECK_TASK = read('/newtab/components/compass/TaskManagerPanel.vue')

check('TSUI158-1 ★任务详情状态 chip/菜单读 TaskStatusDef，不再使用硬编码 STATUS_UI', () => {
  return DETAIL.includes('const taskStatuses = computed(() => sortedTaskStatuses(d.value))')
    && DETAIL.includes('const currentTaskStatus = computed')
    && DETAIL.includes('v-for="status in taskStatuses"')
    && DETAIL.includes('pickStatus(status.id)')
    && DETAIL.includes('currentTaskStatus?.color')
    && !DETAIL.includes('const STATUS_UI')
    && !DETAIL.includes('STATUS_UI[')
})

check('TSUI158-2 ★任务看板列由状态定义动态生成，拖拽写 statusId', () => {
  return BOARD.includes('statuses: TaskStatusDef[]')
    && BOARD.includes('const columns = computed')
    && BOARD.includes('a.order - b.order')
    && BOARD.includes("(e: 'set-status', taskId: string, statusId: string)")
    && BOARD.includes('emit(\'set-status\', id, statusId)')
    && BOARD.includes('--task-status')
    && BOARD.includes(":class=\"{ 'is-done': isDone(task) }\"")
})

check('TSUI158-3 ★任务月历状态标签与颜色走自定义状态，tone 只负责日期语义', () => {
  return CAL.includes('taskStatuses?: TaskStatusDef[]')
    && CAL.includes('function taskStatusDef(task: TaskCard)')
    && CAL.includes('function taskStatusColor(task: TaskCard)')
    && CAL.includes('function statusLabel(task: TaskCard)')
    && CAL.includes("'--task-status': taskStatusColor(task)")
    && CAL.includes("'--task-status': taskStatusColor(entry.task)")
})

check('TSUI158-4 ★任务池状态下拉与筛选共用 sortedTaskStatuses / statusId', () => {
  return HOME.includes('v-for="status in taskWorkStatusOptions"')
    && HOME.includes(':task-statuses="taskWorkStatusOptions"')
    && HOME.includes(':statuses="taskWorkStatusOptions"')
    && LOGIC.includes('const taskWorkStatusOptions = computed(() => sortedTaskStatuses(d.value))')
    && LOGIC.includes('setTaskStatusById(d.value, task, statusId)')
})

check('TSUI158-5 ★完成/恢复与今日三件事统一走 terminal，不再硬写 todo/doing/done', () => {
  return LOGIC.includes('const nextDone = !isTaskDone(d.value, task)')
    && LOGIC.includes('toggleTaskDone(d.value, task)')
    && LOGIC.includes('const terminal = taskTerminalStatus(d.value)')
    && LOGIC.includes('if (terminal) setTaskStatusById(d.value, t, terminal.id)')
    && DETAIL.includes('toggleTaskDone(d.value, t)')
})

check('TSUI158-6 ★项目全貌与旧 /deck 任务页不因自定义状态丢卡或丢名称', () => {
  return PROJECT.includes('taskStatusOf(store.data!, task)?.name')
    && PROJECT.includes('{{ taskStatusLabel(task) }}')
    && DECK_TASK.includes(':task-statuses="d.taskStatuses"')
})

check('TSUI158-7 ★任务状态颜色只作识别色，文字仍用主题色以保证四主题对比度', () => {
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  const detailCss = read('/newtab/components/compass/TaskDetailDrawer.vue')
  return css.includes('color: var(--text-2);')
    && css.includes('background: color-mix(in srgb, var(--task-status')
    && detailCss.includes('color: var(--text-2);')
    && detailCss.includes('background: color-mix(in srgb, var(--task-status')
})
