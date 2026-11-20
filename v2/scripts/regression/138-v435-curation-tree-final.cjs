/**
 * V4.3.5 · 方向树策展 OPPO 化、任务三槽同源、同步明细收口与品牌收口。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【V4.3.5 · 策展树与全局收口】')

check('V435-1 树状视图按原型 V0.3 还原：根脉带 → 主干线 → 战略目标双列瀑布 → 项目层级线 → 指标网格 → 任务叶片的层级结构（V4.3.6 重指 ctl-* 类名）', () => {
  const tree = read('/newtab/components/compass/curation/CurationTreeLayout.vue')
  return tree.includes('ctl-rootband')
    && tree.includes('ctl-trunk')
    && tree.includes('ctl-goal-card')
    && tree.includes('ctl-goals')
    && tree.includes('ctl-proj')
    && tree.includes('ctl-metric')
    && tree.includes('ctl-task')
    && tree.includes('ctl-branch')
    && tree.includes('ctl-ring')
    && tree.includes('ringDash')
    && !tree.includes('cv-top')
    && !tree.includes('cv-hero')
})

check('V435-2 策展页提供战略目标 / 项目双筛选，项目舱菜单提供“项目策展”，菜单不被父容器裁切', () => {
  const page = codeOnly(read('/newtab/views/CompassCurationPage.vue'))
  const tower = read('/newtab/components/compass/CompassTower.vue')
  return page.includes('const goalFilter = ref')
    && page.includes('const projectFilter = ref')
    && page.includes("route.query.goal")
    && page.includes("route.query.project")
    && page.includes('setProjectFilter')
    && page.includes('clearCurationFilters')
    && tower.includes("emit('curation', proj.id)")
    && tower.includes('项目策展')
    && tower.includes('overflow: visible')
})

check('V435-3 今日三件事固定三格：空槽保留墓碑，移出任务清空今日计划日期', () => {
  const slots = read('/shared/utils/focusSlots.ts')
  const logic = codeOnly(read('/newtab/views/useCompassHome.ts'))
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  return slots.includes('export const FOCUS_LIMIT = 3')
    && slots.includes('Array.from({ length: FOCUS_LIMIT })')
    && slots.includes('cleared: true')
    && slots.includes('detachFocusTaskFromDate')
    && logic.includes('const focusCells = computed<FocusCell[]>')
    && home.includes('v-for="c in focusCells"')
    && logic.includes('removedFocus = clearTaskFromFocusDay(today, taskId, false)')
})

check('V435-4（V4.5.0 重指）今日三件事与今日日历在启动 / 云恢复后收敛为同一集合：槽内任务/选题写回今日，排到今天的卡补槽或撤日期', () => {
  const util = read('/shared/utils/focusSuggest.ts')
  const app = read('/newtab/stores/app.ts')
  return util.includes('export function reconcileTodayFocusSchedule(')
    && util.includes('const liveTasks = new Map(')
    && util.includes('const liveTopics = new Map(')
    && util.includes('const dueToday: Array<{ type: \'task\' | \'topic\'; card: TaskCard | TopicCard }> = [')
    && util.includes('cells[free] = {')
    && util.includes('entry.card.dueDate = undefined')
    && util.includes('topic.dueDate = anchorKey')
    && app.includes('reconcileTodayFocusSchedule(data.value)')
    && app.includes('reconcileTodayFocusSchedule(d)')
})

check('V435-5（V4.7.1 重指）任务状态统一写入器：完成任务记录 statusBeforeDone，取消完成优先恢复此前状态', () => {
  const status = read('/shared/utils/taskStatus.ts')
  const home = codeOnly(read('/newtab/views/useCompassHome.ts'))
  return status.includes('export function setTaskStatusById(')
    && status.includes('export function toggleTaskDone(')
    && status.includes('export function setTaskStatus(')
    && status.includes('task.statusBeforeDone = previous?.bucket === \'doing\' ? \'doing\' : \'todo\'')
    && status.includes('task.statusBeforeDone || \'todo\'')
    && home.includes('setTaskStatusById(d.value, t, terminal.id)')
    && home.includes('toggleTaskDone(d.value, task)')
})

check('V435-6 同步明细只展示业务记录，事件流水不重复出现，且每条修改给出同步原因', () => {
  const table = read('/newtab/components/cloud/CloudSyncChangeTable.vue')
  const receipt = read('/newtab/components/cloud/CloudSyncReceiptModal.vue')
  return table.includes("row.type !== 'event'")
    && table.includes('reason:')
    && table.includes('因${(row.fields || []).map(syncFieldLabel).join')
    && receipt.includes("row.type !== 'event'")
    && receipt.includes('本次共有 ${total} 条业务记录变化')
})

check('V435-7 今日战报 AI 洞察结合方向树与三件事，仅临时展示，不写业务真源', () => {
  const day = read('/newtab/components/dashboard/DayDetail.vue')
  const exportBody = day.slice(day.indexOf('function onExport'), day.indexOf('</script>'))
  return day.includes("aria-label=\"AI 洞察\"")
    && day.includes('buildCurationTree(data)')
    && day.includes('当日三件事：')
    && day.includes('clean.length > 200')
    && !day.includes('store.persist()')
    && !!exportBody
    && !exportBody.includes('aiInsight')
})

check('V435-8 新 Logo 替换冷启动占位与扩展图标，旧“知”字占位不再回流', () => {
  const html = read('/newtab/index.html')
  const manifest = read('/manifest.ts')
  return html.includes('src="/icons/icon128.png"')
    && !html.includes('正式 logo 确定后替换')
    && !html.includes('<i>知</i>')
    && manifest.includes("128: 'icons/icon128.png'")
})
