/**
 * V4.7.1 · 任务控制栏两行化 + 项目分组折叠。
 *
 * 锁定：
 *   · 五个快捷筛选按钮退役，改为带计数的“快速筛选”下拉；
 *   · 第一行搜索/项目/状态/快速筛选，第二行排序/分组/视图/完成显示/清空；
 *   · 项目分组头是按钮，支持逐组折叠、全部折叠/展开与 aria-expanded；
 *   · 任务池折叠改为 46px 左侧常驻窄轨，右侧不再出现展开按钮。
 */
const { check, read, segOf } = require('./helpers.cjs')

console.log('【V4.7.1 · 任务控制栏与项目分组】')

const HOME = read('/newtab/views/CompassHome.vue')
const LOGIC = read('/newtab/views/useCompassHome.ts')
const CAL = read('/newtab/components/compass/TaskCalendarView.vue')
const CSS = read('/newtab/components/compass/TaskCalendarView.css')
const HOME_CSS = read('/newtab/views/CompassHome.css')

check('TASK154-1 ★快捷筛选五按钮退役，控制栏拆为 twt-primary / twt-secondary 两行', () => {
  const tpl = segOf(HOME, '<div v-if="handTab === \'task\'" class="task-workbench">', '<TaskCalendarView')
  return tpl.includes('class="twt-row twt-primary"')
    && tpl.includes('class="twt-row twt-secondary"')
    && tpl.includes('class="twt-field twt-quick-field"')
    && tpl.includes('aria-label="任务快速筛选"')
    && !tpl.includes('class="task-work-quick"')
    && !tpl.includes('@click="taskWorkQuick = \'all\'"')
})

check('TASK154-2 ★快速筛选五个选项带计数，状态下拉由任务状态定义动态生成', () => {
  const tpl = segOf(HOME, '<label class="twt-field twt-quick-field"', '</label>')
  return tpl.includes('全部（{{ taskWorkCounts.all }}）')
    && tpl.includes('未挂项目（{{ taskWorkCounts.noProject }}）')
    && tpl.includes('未落图（{{ taskWorkCounts.unplanned }}）')
    && tpl.includes('未归档（{{ taskWorkCounts.unarchived }}）')
    && tpl.includes('主攻项目（{{ taskWorkCounts.focus }}）')
    && HOME.includes('v-for="status in taskWorkStatusOptions"')
})

check('TASK154-3 ★两行控制栏各有可访问标签，移动端降为两列且搜索跨行', () => {
  return HOME.includes('<span>项目</span>')
    && HOME.includes('<span>状态</span>')
    && HOME.includes('<span>快速筛选</span>')
    && HOME.includes('<span>排序</span>')
    && HOME.includes('<span>分组</span>')
    && HOME_CSS.includes('.twt-primary')
    && HOME_CSS.includes('grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(128px, 160px))')
    && HOME_CSS.includes('.twt-primary .task-work-search { grid-column: 1 / -1; }')
})

check('TASK154-4 ★项目组头是按钮，逐组折叠/展开并维护 aria-expanded', () => {
  return CAL.includes('class="cal-pool-group"')
    && CAL.includes(':aria-expanded="!isGroupCollapsed(group.key)"')
    && CAL.includes('@click="toggleGroupCollapsed(group.key)"')
    && CAL.includes('function toggleGroupCollapsed')
    && CAL.includes('collapsedGroups')
    && CAL.includes('v-for="task in (isGroupCollapsed(group.key) ? [] : group.tasks)"')
})

check('TASK154-5 ★栏头“全部折叠/全部展开”只在按项目分组时出现', () => {
  return CAL.includes('v-if="groupMode === \'project\'"')
    && CAL.includes('class="cal-group-toggle"')
    && CAL.includes('@click="toggleAllGroups"')
    && CAL.includes("allGroupsCollapsed ? '全部展开' : '全部折叠'")
})

check('TASK154-6 ★任务池折叠后是左侧 46px 常驻窄轨，展开按钮不再出现在右侧日历头', () => {
  const pool = segOf(CAL, '<section class="cal-pool"', '</section>')
  const boardHead = segOf(CAL, '<header class="cal-board-head">', '</header>')
  return pool.includes('class="cal-rail-toggle"')
    && pool.includes('aria-label="展开任务清单"')
    && pool.includes('writing-mode: vertical-rl') === false
    && boardHead.includes('cal-list-expand') === false
    && CSS.includes('.task-calendar.list-hidden {')
    && CSS.includes('grid-template-columns: 46px minmax(0, 1fr)')
    && CSS.includes('.cal-rail-toggle span')
    && CAL.includes("statusLabel(task)")
})

check('TASK154-7 ★任务状态筛选按 statusId 匹配，旧 status 仅作为悬空引用回落', () => {
  return LOGIC.includes('const taskWorkStatusOptions = computed(() => sortedTaskStatuses(d.value))')
    && LOGIC.includes("(task.statusId || taskStatusOf(d.value, task)?.id) !== status")
    && LOGIC.includes('taskWorkStatusOptions, taskWorkCounts')
})
