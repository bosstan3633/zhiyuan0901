/**
 * V4.3.4 · 调度台任务清单、今日三件事联动、周视图信息密度、日历留白与今日角标。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【V4.3.4 · 调度台任务联动与日历视觉】')

check('V434-1（V4.7.0 重指）左侧任务清单吃上方筛选结果：默认最新入池，可切未落图优先/按计划日期（未落图在前、已落图按计划日期），并逐行显示“落图 月/日”', () => {
  const calendar = codeOnly(read('/newtab/components/compass/TaskCalendarView.vue'))
  return calendar.includes("sortMode: 'recent'")
    && calendar.includes("if (props.sortMode === 'recent')")
    && calendar.includes('((b.createdAt || 0) - (a.createdAt || 0))')
    && calendar.includes("if (props.sortMode === 'due') return rows.sort(poolOrder)")
    && calendar.includes('const aPlanned = !!a.dueDate')
    && calendar.includes('if (aPlanned !== bPlanned) return aPlanned ? 1 : -1')
    && calendar.includes('function poolOrder(a: TaskCard, b: TaskCard): number')
    && calendar.includes('if (!aDate && bDate) return -1')
    && calendar.includes('if (aDate && !bDate) return 1')
    && calendar.includes('return aDate.localeCompare(bDate) || taskOrder(a, b)')
    && calendar.includes("{{ task.dueDate ? `落图 ${friendlyDate(task.dueDate)}` : '未落图' }}")
})

check('V434-2（V4.7.8 重指）今日三件事与今日日历严格同源：槽位/日历统一走 addManualFocus 与 scheduleCardDate；满额拒绝第 4 项、不落图也不覆盖；完成态由真源桶判定不降级', () => {
  const util = codeOnly(read('/shared/utils/focusSuggest.ts'))
  const taskStatus = codeOnly(read('/shared/utils/taskStatus.ts'))
  const home = codeOnly(read('/newtab/views/useCompassHome.ts'))
  const drawer = codeOnly(read('/newtab/components/compass/TaskDetailDrawer.vue'))
  const manager = codeOnly(read('/newtab/components/compass/useTaskManagerPanel.ts'))
  const addManual = util.slice(
    util.indexOf('export function addManualFocus('),
    util.indexOf('/** 选题卡进入今日重点'),
  )
  const slotPicker = home.slice(
    home.indexOf('function selectTaskForSlot('),
    home.indexOf('type FocusPickerCandidate'),
  )
  const dueSetter = home.slice(
    home.indexOf('async function setTaskWorkDue('),
    home.indexOf('function clearTaskWorkDue('),
  )
  const fullGuard = dueSetter.slice(
    dueSetter.indexOf("if (result.status === 'full')"),
    dueSetter.indexOf('const dateChanged'),
  )
  return util.includes('export function syncFocusTasksToSchedule(')
    && util.includes('task.dueDate = anchorKey')
    && (util.match(/syncFocusTasksToSchedule\(d, anchorKey/g) || []).length >= 3
    && home.includes('const synced = syncFocusTasksToSchedule(d.value, key)')
    && !!slotPicker
    && slotPicker.includes('const result = addManualFocus(d.value, key, task.id, pickerSlot.value)')
    && !slotPicker.includes('task.dueDate = key')
    && !!dueSetter
    && dueSetter.includes('const result = addManualFocus(d.value, today, task.id)')
    && dueSetter.includes("scheduleCardDate(d.value, task, date, { source: 'calendar' })")
    && !dueSetter.includes('task.dueDate = date')
    && home.includes('const today = todayKey.value')
    && !dueSetter.includes('task.status =')
    && home.includes('今日三件事已满（3/3）；今日日历与三件事严格同源，未安排第 4 项')
    && !!fullGuard && !fullGuard.includes('scheduleCardDate(')
    && !!addManual
    && addManual.includes("if (requested < 0 && freeIndex < 0) return { status: 'full' }")
    && addManual.includes("if (task.dueDate !== anchorKey) scheduleCardDate(d, task, anchorKey, { source: 'focus', at: stamp })")
    && taskStatus.includes("if (!current || current.bucket === 'done' || current.bucket === 'doing')")
    && home.includes("if (date === today && focusResult === 'exists')")
    && home.includes('removedFocus = clearTaskFromFocusDay(today, taskId, false)')
    && (home.match(/result\.status === 'exists'[\s\S]{0,160}store\.persist\(\)/g) || []).length >= 1
    && (drawer.match(/result\.status === 'exists'[\s\S]{0,160}store\.persist\(\)/g) || []).length >= 1
    && (manager.match(/result\.status === 'exists'[\s\S]{0,160}store\.persist\(\)/g) || []).length >= 1
})

check('V434-3 ★V4.7.1 随迁备案：周视图按更宽裕的纵向空间呈现更完整任务卡：最多 12 条、标题两行、项目/指标/动态状态第二层，月视图仍保持紧凑', () => {
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return calendar.includes("calendarMode.value === 'week' ? 12 : 3")
    && calendar.includes("v-if=\"calendarMode === 'week'\" class=\"cal-chip-meta\"")
    && calendar.includes('{{ projectLabel(task) }}')
    && calendar.includes('{{ statusLabel(entry.task) }}')
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
