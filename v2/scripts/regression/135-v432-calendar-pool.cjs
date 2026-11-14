/**
 * V4.3.2 · 调度台月历与卡片池入口优化。
 *
 * 产品边界：
 * 1. 左侧只展示“未完成且未排期”的任务；拖入月历后从左侧移出。
 * 2. 月历支持月份选择，并按完成 / 今日 / 未来 / 逾期给出可辨识色调。
 * 3. 日详情使用全站中央弹窗壳，避免被页面浮层压住。
 * 4. 三池页签显示今日新增轻量角标：0 隐藏、99+ 封顶。
 * 5. 资源页用常用夹模块组织；今日采集是跨日自动替换的虚拟默认夹。
 */
const { fs, path, check, read, codeOnly, exists } = require('./helpers.cjs')

console.log('【V4.3.2 · 调度台月历与卡片池入口】')

check('V432-1（V4.3.3 重指）左栏只按“未落图”取任务；完成状态交给上方筛选，任务拖入月历后离开左栏，取消排期后回到左栏', () => {
  const calendar = codeOnly(read('/newtab/components/compass/TaskCalendarView.vue'))
  const pending = calendar.slice(
    calendar.indexOf('const pendingPoolTasks'),
    calendar.indexOf('const monthScheduledTasks'),
  )
  return !pending.includes("task.status !== 'done'")
    && pending.includes("!/^\\d{4}-\\d{2}-\\d{2}$/.test(task.dueDate || '')")
    && calendar.includes('const poolTasks = computed(() => [...pendingPoolTasks.value].sort(taskOrder))')
    && calendar.includes('@drop="dropOnDay($event, cell.key)"')
    && calendar.includes("if (id) emit('set-due', id, day)")
    && calendar.includes('@drop="dropUnscheduled"')
    && calendar.includes("if (id) emit('clear-due', id)")
    && calendar.includes('当前筛选下的任务都已安排计划执行日期，或筛选结果为空。');
})

check('V432-2 月历左右栏同高、左栏内部滚动；窄屏降级为单列且不挤压内容', () => {
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return css.includes('align-items: stretch')
    && css.includes('height: clamp(620px, 68vh, 730px)')
    && css.includes('.cal-pool-list {')
    && css.includes('min-height: 0;')
    && css.includes('overflow: auto;')
    && css.includes('.cal-grid {')
    && css.includes('grid-template-rows: repeat(6, minmax(0, 1fr))')
    && css.includes('@media (max-width: 1180px)')
    && css.includes('height: auto;')
    && css.includes('min-width: 700px;');
})

check('V432-3 月份选择器可切年 / 月并可回到今天；日详情走共享 Modal，私有 Teleport 壳退役', () => {
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  return calendar.includes("import Modal from '@/shared/components/Modal.vue'")
    && calendar.includes('const monthPickerOpen = ref(false)')
    && calendar.includes('function shiftPickerYear(delta: number): void')
    && calendar.includes('function selectMonth(month: number): void')
    && calendar.includes('v-for="month in 12"')
    && calendar.includes('@click="goToday"')
    && calendar.includes('<Modal')
    && calendar.includes(':open="!!selectedDay"')
    && calendar.includes('<template #footer>')
    && !calendar.includes('<Teleport to="body">')
    && !calendar.includes('cal-day-overlay');
})

check('V432-4 月历任务按状态着色：已完成绿、今日橙、未来灰、逾期红，并给出可读图例', () => {
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return calendar.includes("if (task.status === 'done') return 'done'")
    && calendar.includes("if (task.dueDate === todayKey.value) return 'today'")
    && calendar.includes("if (task.dueDate && task.dueDate > todayKey.value) return 'future'")
    && calendar.includes("if (task.dueDate && task.dueDate < todayKey.value) return 'overdue'")
    && calendar.includes("'tone-' + taskTone(task)")
    && calendar.includes('class="cal-tone-legend"')
    && css.includes('.cal-task-chip.tone-done')
    && css.includes('var(--success)')
    && css.includes('.cal-task-chip.tone-today')
    && css.includes('var(--warning)')
    && css.includes('.cal-task-chip.tone-future')
    && css.includes('var(--text-3)')
    && css.includes('.cal-task-chip.tone-overdue')
    && css.includes('var(--danger)');
})

check('V432-5（V4.3.3 重指）三池页签今日新增角标：由本地自然日 created 统计、0 不渲染、超过 99 显示 99+，与页签文字同色', () => {
  const home = read('/newtab/views/CompassHome.vue')
  const logic = read('/newtab/views/useCompassHome.ts')
  const css = read('/newtab/views/CompassHome.css')
  return logic.includes('const handNewCounts = computed(() => {')
    && logic.includes('(task.createdAt || 0) >= t0')
    && logic.includes('(card.createdAt || 0) >= t0')
    && home.includes('v-if="handNewCounts.task"')
    && home.includes("handNewCounts.task > 99 ? '99+'")
    && home.includes('v-if="handNewCounts.curiosity"')
    && home.includes('v-if="handNewCounts.resource"')
    && css.includes('.hand-new-badge {')
    && css.includes('color: inherit')
    && css.includes('background: transparent')
    && !css.includes('.hand-new-badge { background: var(--danger)');
})

check('V432-6 三个入口均携 fresh 信号进入二级卡池；资源池 fresh 默认列表、最近入池优先，今日采集再叠加当天过滤', () => {
  const homeLogic = read('/newtab/views/useCompassHome.ts')
  const deck = read('/newtab/views/CompassDeckView.vue')
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue')
  const reset = pool.slice(pool.indexOf('async function resetForFresh()'), pool.indexOf('defineExpose({ openDetail, resetForFresh })'))
  return homeLogic.includes('path: `/deck/${kind}`')
    && homeLogic.includes("query: { fresh: '1', freshAt: String(Date.now()) }")
    && deck.includes('await resourcePanel.value?.resetForFresh()')
    && reset.includes("viewMode.value = 'list'")
    && reset.includes("sortBy.value = 'created'")
    && reset.includes("sortDir.value = 'desc'")
    && reset.includes("todayOnly.value = route.query.today === '1'")
    && pool.includes('if (freshMode.value) return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))');
})

check('V432-7（V4.3.3 重指）资源页改为常用夹模块：今日采集固定第一位，后续为现有常用夹与预览，点击后打开中央明细弹窗', () => {
  const grid = read('/newtab/components/compass/HomeResourceFolderGrid.vue')
  const home = read('/newtab/views/CompassHome.vue')
  return exists('/newtab/components/compass/HomeResourceFolderGrid.vue')
    && home.includes('<HomeResourceFolderGrid :today-start="todayStart" />')
    && grid.includes('class="hrf-folder is-today"')
    && grid.indexOf('今日采集') < grid.indexOf('v-for="item in folderModules"')
    && grid.includes('(card.createdAt || 0) >= props.todayStart')
    && grid.includes('function openToday(): void')
    && grid.includes('<ResourceFolderDetailModal')
    && grid.includes('resourceFoldersOf')
    && grid.includes('resourceFolderMirrorsOf')
    && grid.includes('<ResourceFolderDrawer')
    && grid.includes(':initial-folder-id="focusedFolderId"');
})

check('V432-8 常用夹抽屉可接收首页聚焦夹并在打开后滚动定位；首页入口与二级页仍共用同一抽屉实现', () => {
  const drawer = read('/newtab/components/compass/ResourceFolderDrawer.vue')
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue')
  return drawer.includes('initialFolderId?: string')
    && drawer.includes('data-rfd-folder')
    && drawer.includes("scrollIntoView({ block: 'start', behavior: 'smooth' })")
    && drawer.includes('initialFolderId')
    && pool.includes('<ResourceFolderDrawer')
    && !read('/newtab/components/compass/HomeResourceFolderGrid.vue').includes('function deleteResourceFolder');
})

check('V432-9 月历与卡片池模块资源均已纳入代码索引；新增组件不再以巨型单体文件堆叠', () => {
  const index = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', '评审交接包', '02_代码索引.md'), 'utf8')
  const gridLines = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'newtab', 'components', 'compass', 'HomeResourceFolderGrid.vue'), 'utf8').split(/\r?\n/).length
  return index.includes('HomeResourceFolderGrid.vue')
    && index.includes('TaskCalendarView.vue')
    && gridLines < 220;
})
