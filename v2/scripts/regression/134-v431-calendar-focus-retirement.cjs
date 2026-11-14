/**
 * V4.3.1 · 月历排期、今日三件事历史快照、日期文案与周期 AI 退役。
 *
 * 产品边界：
 * 1. 月历只排期/取消排期，不承担删除任务；取消后任务留在任务池。
 * 2. 历史日期只读并保留完成快照；今天始终以任务卡当前状态为准。
 * 3. 复制历史三件事时保留状态快照；覆盖今天前必须走统一确认弹窗。
 * 4. “计划执行日期”复用 dueDate，不新增第二份计划字段。
 * 5. 今天 / 本周 / 本月的 AI 分析退役，年度热力图与事实统计保留。
 */
const {
  fs, path, base, check, read, codeOnly, exists, fnBody,
} = require('./helpers.cjs')

console.log('【V4.3.1 · 月历排期与今日三件事历史快照】')

check('V431-1 月历只改 dueDate：取消排期清空日期并立即落库，不删除任务、不改项目 / 指标 / 状态', () => {
  const panel = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue'))
  const source = read('/newtab/components/compass/useTaskManagerPanel.ts')
  const clear = fnBody(source, 'function clearTaskDueDate(', 'function toggleTaskCompletion(')
  const set = fnBody(source, 'function setTaskDueDate(', 'function clearTaskDueDate(')
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  return source.includes("const viewMode = ref<'card' | 'list' | 'kanban' | 'calendar'>('list')")
    && panel.includes('<TaskCalendarView')
    && panel.includes('@clear-due="clearTaskDueDate"')
    && source.includes('function clearTaskDueDate(')
    && clear.includes('task.dueDate = undefined')
    && clear.includes('task.updatedAt = Date.now()')
    && clear.includes('store.persist()')
    && !/task\.(?:deletedAt|projectId|metricId|status)\s*=/.test(clear)
    && set.includes('task.dueDate = date')
    && calendar.includes("emit('clear-due', task.id)")
    && calendar.includes('取消计划执行日期并回到任务池')
    && !calendar.includes('softDeleteTaskToTrash')
    && !calendar.includes('deletedAt');
})

check('V431-2 今日三件事按日期分开读状态：历史日期优先快照，今天优先任务卡当前状态，任务卡是唯一真源', () => {
  const source = read('/newtab/views/useCompassHome.ts')
  const status = fnBody(source, 'function focusSlotStatus(', 'function focusSlotDone(')
  return status.includes("if (dateStr(todayDate.value) === todayKey.value)")
    && status.indexOf('const task = todayTaskForSlot(slot)') > status.indexOf('if (dateStr(todayDate.value)')
    && status.includes('if (task) return task.status')
    && status.includes("return slot.statusSnapshot || (slot.done ? 'done' : 'todo')")
    && status.indexOf('if (task) return task.status') < status.indexOf('return slot.statusSnapshot')
    && source.includes('const focusIsHistorical = computed(() => dateStr(todayDate.value) !== todayKey.value)');
})

check('V431-3 历史日期只读；复制到今日保留完成状态与复选框快照，覆盖今天前必须走统一确认弹窗', () => {
  const source = read('/newtab/views/useCompassHome.ts')
  const page = codeOnly(read('/newtab/views/CompassHome.vue'))
  const copy = fnBody(source, 'async function copyFocusToToday(', 'function copyYesterday(')
  const toggle = fnBody(source, 'function toggleTodayDone(', '// ---- 公共名称工具 ----')
  return page.includes('type="date" :max="todayKey"')
    && page.includes('v-if="focusIsHistorical"')
    && page.includes('复制到今日')
    && page.includes('历史快照')
    && copy.includes('const status = focusSlotStatus(slot)')
    && copy.includes('statusSnapshot: status')
    && copy.includes('copiedFrom: sourceKey')
    && copy.includes("done: status === 'done'")
    && copy.includes('await useConfirm({')
    && !copy.includes('window.confirm(')
    && toggle.includes('if (focusIsHistorical.value)')
    && toggle.includes('slot.statusSnapshot = undefined')
    && toggle.includes('slot.copiedFrom = undefined');
})

check('V431-4 计划执行日期继续复用 dueDate：字段目录与默认字段同名为“计划执行日期”，不新增第二字段', () => {
  const model = read('/shared/models/index.ts')
  const catalog = read('/shared/models/catalog.ts')
  const defaults = read('/shared/storage/defaults.ts')
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  return model.includes('dueDate?: string')
    && catalog.includes("{ key: 'dueDate', label: '计划执行日期'")
    && defaults.includes("{ key: 'dueDate', label: '计划执行日期'")
    && calendar.includes('TaskCard.dueDate')
    && !model.includes('scheduledDate?:')
    && !calendar.includes('scheduledDate');
})

check('V431-5 周期 AI 分析物理退役：今天 / 本周 / 本月 / 本年不再有 AI 复盘宿主，年度热力图与事实统计仍在', () => {
  const periods = ['PiToday', 'PiRhythm', 'PiMonth', 'PiYear']
  const periodSources = periods.map(name => read(`/newtab/components/profile/${name}.vue`))
  const year = periodSources[3]
  const profile = codeOnly(read('/newtab/views/ProfileInsights.vue'))
  const registry = read('/shared/ai/jobs/registry.ts')
  const select = read('/shared/ai/select.ts')
  return periodSources.every(source => !source.includes('PiAiReview'))
    && !profile.includes('currentPeriodAi')
    && !profile.includes(':ai="')
    && !exists('/newtab/components/profile/PiAiReview.vue')
    && !exists('/newtab/composables/usePeriodAiReview.ts')
    && !exists('/shared/utils/periodReview.ts')
    && !registry.includes("id: 'period-review'")
    && !select.includes('buildPeriodReviewJob')
    && year.includes('<Heatmap')
    && year.includes('<LifecyclePanel');
})
