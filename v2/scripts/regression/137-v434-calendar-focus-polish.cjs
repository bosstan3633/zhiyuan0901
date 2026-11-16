/**
 * V4.3.4 · 调度台任务清单、今日三件事联动、周视图信息密度、日历留白与今日角标。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【V4.3.4 · 调度台任务联动与日历视觉】')

check('V434-1 左侧任务清单吃上方筛选结果：未落图任务在前，已落图任务按计划日期在后，并逐行显示“落图 月/日”', () => {
  const calendar = codeOnly(read('/newtab/components/compass/TaskCalendarView.vue'))
  return calendar.includes('const poolTasks = computed(() => [...props.tasks].sort(poolOrder))')
    && calendar.includes('function poolOrder(a: TaskCard, b: TaskCard): number')
    && calendar.includes('if (!aDate && bDate) return -1')
    && calendar.includes('if (aDate && !bDate) return 1')
    && calendar.includes('return aDate.localeCompare(bDate) || taskOrder(a, b)')
    && calendar.includes("{{ task.dueDate ? `落图 ${friendlyDate(task.dueDate)}` : '未落图' }}")
})

check('V434-2 今日三件事与今日日历双向同源：进入槽位写 today dueDate；拖入今日且槽位未满自动进入三件事，满额只排期不覆盖', () => {
  const util = codeOnly(read('/shared/utils/focusSuggest.ts'))
  const home = codeOnly(read('/newtab/views/useCompassHome.ts'))
  const drawer = codeOnly(read('/newtab/components/compass/TaskDetailDrawer.vue'))
  const manager = codeOnly(read('/newtab/components/compass/useTaskManagerPanel.ts'))
  return util.includes('export function syncFocusTasksToSchedule(')
    && util.includes('task.dueDate = anchorKey')
    && (util.match(/syncFocusTasksToSchedule\(d, anchorKey/g) || []).length >= 3
    && home.includes('const synced = syncFocusTasksToSchedule(d.value, key)')
    && home.includes('if (task.dueDate !== key) {')
    && home.includes('task.dueDate = key')
    && home.includes("if (date === todayKey.value && task.status !== 'done')")
    && home.includes('const result = addManualFocus(d.value, todayKey.value, task.id)')
    && home.includes('今日三件事已满，未自动加入')
    && home.includes('syncFocusTasksToSchedule(d.value, todayKey.value)')
    && (home.match(/result\.status === 'exists'[\s\S]{0,160}store\.persist\(\)/g) || []).length >= 1
    && (drawer.match(/result\.status === 'exists'[\s\S]{0,160}store\.persist\(\)/g) || []).length >= 1
    && (manager.match(/result\.status === 'exists'[\s\S]{0,160}store\.persist\(\)/g) || []).length >= 1
})

check('V434-3 周视图按更宽裕的纵向空间呈现更完整任务卡：最多 12 条、标题两行、项目/指标/状态第二层，月视图仍保持紧凑', () => {
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return calendar.includes("calendarMode.value === 'week' ? 12 : 3")
    && calendar.includes("v-if=\"calendarMode === 'week'\" class=\"cal-chip-meta\"")
    && calendar.includes('{{ projectLabel(task) }}')
    && calendar.includes('{{ statusLabel(task.status) }}')
    && css.includes('.cal-grid.is-week .cal-task-chip {')
    && css.includes('min-height: 58px;')
    && css.includes('.cal-grid.is-week .cal-chip-title {')
    && css.includes('-webkit-line-clamp: 2;')
    && css.includes('.cal-grid.is-week .cal-chip-meta {')
    && css.includes('overflow-y: auto;')
})

check('V434-4 右侧日历增加独立内容容器与四周边距，不再贴满 board；窄屏仍可在容器内横向滚动', () => {
  const template = read('/newtab/components/compass/TaskCalendarView.vue')
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return template.includes('<div class="cal-board-body">')
    && template.indexOf('<div class="cal-weekdays"') > template.indexOf('<div class="cal-board-body">')
    && css.includes('.cal-board-body {')
    && css.includes('margin: 10px 12px 12px;')
    && css.includes('border: 1px solid var(--border);')
    && css.includes('border-radius: var(--radius-md);')
    && css.includes('overflow: hidden;')
    && css.includes('min-width: 700px;')
})

check('V434-5 卡片池三页签角标只统计“今天零点（含）到明天零点（不含）”，零点翻篇时随 todayStart 重新计算', () => {
  const logic = codeOnly(read('/newtab/views/useCompassHome.ts'))
  return logic.includes('const nextDay = new Date(t0)')
    && logic.includes('nextDay.setDate(nextDay.getDate() + 1)')
    && logic.includes('const createdToday = (ts?: number) => (ts || 0) >= t0 && (ts || 0) < t1')
    && logic.includes('liveTasks.value.filter(task => createdToday(task.createdAt))')
    && logic.includes('liveCuriosities.value.filter(card => createdToday(card.createdAt))')
    && logic.includes('card.workspaceId === CURATION_WS_ID && createdToday(card.createdAt)')
})

check('V434-6 今日复制文案严格输出“推进[[项目]]项目，任务，助力【指标】指标落实到位”，不自动添加 MOC-', () => {
  const copy = read('/shared/utils/focusCopy.ts')
  const manual = read('/newtab/manual-data.ts')
  return !copy.includes('mocProjectName')
    && copy.includes('return `推进[[${project}]]项目，${task}，助力【${metric}】指标落实到位`')
    && manual.includes('推进[[项目名]]项目，任务内容，助力【指标名】指标落实到位')
    && !manual.includes('推进[[MOC-项目名]]项目')
})
