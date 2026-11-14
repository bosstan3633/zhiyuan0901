/**
 * V4.3.3 · 调度台月周视图、文件夹事实弹窗、今日战报快捷入口与卡面收口。
 */
const { check, read, codeOnly, exists } = require('./helpers.cjs')

console.log('【V4.3.3 · 月周视图 / 文件夹明细 / 战报入口】')

check('V433-1 待排期任务只按“未落图”判定，已完成任务也交给上方项目与状态筛选决定是否显示', () => {
  const calendar = codeOnly(read('/newtab/components/compass/TaskCalendarView.vue'))
  const logic = codeOnly(read('/newtab/views/useCompassHome.ts'))
  const pending = calendar.slice(
    calendar.indexOf('const pendingPoolTasks'),
    calendar.indexOf('const monthScheduledTasks'),
  )
  return !pending.includes("task.status !== 'done'")
    && pending.includes("!/^\\d{4}-\\d{2}-\\d{2}$/.test(task.dueDate || '')")
    && logic.includes("unscheduled: liveTasks.value.filter(task => !task.dueDate).length")
    && logic.includes("if (quick === 'unscheduled' && task.dueDate) return false")
    && calendar.includes('包含已完成任务；上方筛选框决定这里显示哪些任务')
})

check('V433-2 日历支持月视图 / 周视图切换，周视图仍复用同一排期与日期详情链路', () => {
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return calendar.includes("const calendarMode = ref<'month' | 'week'>('month')")
    && calendar.includes('function setCalendarMode(mode:')
    && calendar.includes("calendarMode.value === 'week' ? 7 : 42")
    && calendar.includes('月视图')
    && calendar.includes('周视图')
    && calendar.includes(":class=\"{ 'is-week': calendarMode === 'week' }\"")
    && calendar.includes('@click="shiftPeriod(-1)"')
    && calendar.includes('@click="shiftPeriod(1)"')
    && css.includes('.cal-grid.is-week')
    && css.includes('grid-template-rows: minmax(0, 1fr)')
})

check('V433-3 今日日详情采用稳定三栏行布局，标题与元信息各占独立行，修复文字叠压乱码', () => {
  const calendar = read('/newtab/components/compass/TaskCalendarView.vue')
  const css = read('/newtab/components/compass/TaskCalendarView.css')
  return calendar.includes('class="cal-modal-side"')
    && calendar.includes('class="cal-modal-close"')
    && calendar.includes('[...(tasksByDay.value.get(selectedDay.value) || [])].sort(taskOrder)')
    && css.includes('grid-template-columns: 22px minmax(0, 1fr) auto 26px')
    && css.includes('.cal-modal-copy b {')
    && css.includes('.cal-modal-copy small {')
    && css.includes('display: block;')
    && css.includes('white-space: nowrap;')
})

check('V433-4 常用夹与今日采集点击后均打开中央明细弹窗，支持打开单卡、移出镜像、打开全部与管理入口', () => {
  const grid = read('/newtab/components/compass/HomeResourceFolderGrid.vue')
  const modal = read('/newtab/components/compass/ResourceFolderDetailModal.vue')
  return exists('/newtab/components/compass/ResourceFolderDetailModal.vue')
    && grid.includes("import ResourceFolderDetailModal from './ResourceFolderDetailModal.vue'")
    && grid.includes("detailKind.value = 'today'")
    && grid.includes('function openFolderDetail(folder: ResourceFolder)')
    && !grid.includes("path: '/deck/resource'")
    && grid.includes('<ResourceFolderDetailModal')
    && modal.includes("import Modal from '@/shared/components/Modal.vue'")
    && modal.includes('removeResourceFolderMirror')
    && modal.includes('openResourceLink')
    && modal.includes('打开全部')
    && modal.includes('管理常用夹')
})

check('V433-5 卡片池新增角标与页签文字同色、无底色强调，不再使用醒目胶囊', () => {
  const css = read('/newtab/views/CompassHome.css')
  const badge = css.slice(css.indexOf('.hand-new-badge {'), css.indexOf('/* V3.9.18：三池页签后单列呈现'))
  return badge.includes('background: transparent')
    && badge.includes('border: 0')
    && badge.includes('color: inherit')
    && !badge.includes('var(--accent-light)')
    && !badge.includes('var(--accent-ink)')
})

check('V433-6 今日战报先弹出、后刷新事件：本地读取不阻塞首帧，云端校正转后台', () => {
  const host = codeOnly(read('/newtab/components/dashboard/TodayBattleHost.vue'))
  const open = host.slice(host.indexOf('function openToday()'), host.indexOf('/* useDailyLogRequest'))
  return open.includes('applyDay(todayKey())')
    && open.indexOf('applyDay(todayKey())') < open.indexOf('void refreshEventLog()')
    && host.includes('async function refreshEventLog()')
    && host.includes('await loadLocalEventLog()')
    && host.includes('void refreshCloudEvents()')
})

check('V433-7 今日战报成为页头主入口，AI 推荐降为普通入口', () => {
  const home = read('/newtab/views/CompassHome.vue')
  const css = read('/newtab/views/CompassHome.css')
  return home.indexOf('class="why-trigger battle-trigger"') < home.indexOf('class="why-trigger focus-ai-trigger"')
    && css.includes('.desk-actions .battle-trigger {')
    && css.includes('background: var(--accent)')
    && css.includes('.focus-ai-trigger { color: var(--text-2); }')
})

check('V433-8 浏览器快捷键新增“打开今日战报”：无默认键、后台分发、页面路由到调度台后打开弹窗', () => {
  const manifest = codeOnly(read('/manifest.ts'))
  const background = codeOnly(read('/background/index.ts'))
  const app = codeOnly(read('/newtab/App.vue'))
  const settings = read('/newtab/views/settings/SettingsShortcutsPanel.vue')
  const shortcuts = read('/shared/utils/shortcuts.ts')
  const block = manifest.slice(
    manifest.indexOf("'open-today-battle': {"),
    manifest.indexOf("'open-compass-curation': {"),
  )
  return block.includes("description: '打开今日战报'")
    && !block.includes('suggested_key')
    && background.includes('async function triggerTodayBattle()')
    && background.includes("case 'open-today-battle':")
    && background.includes("type: 'zy-open-today-battle'")
    && app.includes("msg?.type === 'zy-open-today-battle'")
    && app.includes('function openTodayBattleView()')
    && app.includes("zyAction === 'today-battle'")
    && settings.includes("'open-today-battle': '打开今日战报'")
    && shortcuts.includes("'打开今日战报'")
})

check('V433-9 今日三件事卡面不再拉伸等高：内容按自身高度收口，底部留白显著减少', () => {
  const css = read('/newtab/views/CompassHome.css')
  const list = css.slice(css.indexOf('.focus-list {'), css.indexOf('.focus-row.focus-card {'))
  const card = css.slice(css.indexOf('.focus-row.focus-card {'), css.indexOf('.focus-row.focus-card:hover'))
  return list.includes('align-items: start')
    && card.includes('grid-template-rows: auto auto')
    && card.includes('align-content: start')
    && card.includes('align-self: start')
    && card.includes('min-height: 104px')
    && !card.includes('minmax(0, 1fr) auto')
})

check('V433-10 老库 dueAt 与数字型 dueDate 在载入 / 导入边界统一收敛为 YYYY-MM-DD，任务日历不会因调用 split 崩溃', () => {
  const legacy = codeOnly(read('/shared/storage/legacy-normalize.ts'))
  const start = legacy.indexOf('function legacyPlanDate')
  const end = legacy.indexOf('export function stripRetiredCardKeys', start)
  const helper = start >= 0 && end > start ? legacy.slice(start, end) : ''
  return helper.includes("typeof value === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(value)")
    && helper.includes('new Date(stamp)')
    && helper.includes("pad(date.getMonth() + 1)")
    && legacy.includes('const dueDate = legacyPlanDate(c.dueDate) || legacyPlanDate(c.dueAt)')
    && legacy.includes('if (dueDate) c.dueDate = dueDate')
})
