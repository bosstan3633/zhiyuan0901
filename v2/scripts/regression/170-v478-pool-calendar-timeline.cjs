/**
 * V4.7.8 · 卡片池日历纵向空间与时间轴历史降噪。
 *
 * 覆盖：
 *  ① 任务月视图 830–860px、日行按 3 个 chip 推导，周视图独立高度；
 *  ② 今日三件事在月格中优先于普通任务，3 条完整可见；
 *  ③ 选题 / 好奇心日历按自身内容独立放大，清理重复 min-height；
 *  ④ 每张卡按最新 ts 判定唯一当前记录，历史记录虚线灰阶且交互不降级；
 *  ⑤ V4.3.2 / V4.7.7 旧断言重指备案。
 *
 * 本分片由 V4.7.8 主交付统一注册，不修改 regression.cjs。
 */
const fs = require('fs')
const path = require('path')
const { check, read } = require('./helpers.cjs')

console.log('【V4.7.8 · 卡片池日历与时间轴历史】')

const TASK_CALENDAR = read('/newtab/components/compass/TaskCalendarView.vue')
const TASK_CSS = read('/newtab/components/compass/TaskCalendarView.css')
const TOPIC_CALENDAR = read('/newtab/components/compass/TopicCalendarView.vue')
const TOPIC_MANAGER = read('/newtab/components/compass/TopicManagerPanel.vue')
const CURIO_WORKBENCH = read('/newtab/components/compass/CuriosityWorkbench.vue')
const HOME_CSS = read('/newtab/views/CompassHome.css')
const TIMELINE = read('/newtab/components/compass/CardPoolTimeline.vue')
const shard = name => fs.readFileSync(path.resolve(__dirname, name), 'utf8')

check('V478-CAL-1 ★任务月视图桌面固定 830–860px，左右栏拉伸同高、左栏内部滚动；日行最小高由日期头、3 个 chip、2 个间距与 padding 推导', () => {
  const monthHeight = TASK_CSS.match(/--cal-month-height:\s*clamp\((\d+)px,\s*\d+vh,\s*(\d+)px\)/)
  const rowMin = TASK_CSS.match(/--cal-month-row-min:\s*calc\(([\s\S]*?)\);/)?.[1] || ''
  const count = token => (rowMin.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  return !!monthHeight
    && Number(monthHeight[1]) >= 820
    && Number(monthHeight[2]) <= 860
    && TASK_CSS.includes('height: var(--cal-month-height)')
    && TASK_CSS.includes('align-items: stretch')
    && TASK_CSS.includes('.cal-pool-list {')
    && TASK_CSS.includes('overflow: auto;')
    && TASK_CSS.includes('grid-template-rows: repeat(6, minmax(var(--cal-month-row-min), 1fr))')
    && count('var(--cal-day-head-height)') === 1
    && count('var(--cal-day-chip-height)') === 3
    && count('var(--cal-day-list-gap)') === 2
    && count('var(--cal-day-pad-y)') === 2
    && count('var(--cal-day-list-offset)') === 1
    && TASK_CSS.includes('min-height: var(--cal-day-chip-height)')
})

check('V478-CAL-2 ★周视图使用独立 660–730px 高度，切换月 / 周允许高度变化但左右栏仍同一行拉伸', () => {
  const weekHeight = TASK_CSS.match(/--cal-week-height:\s*clamp\((\d+)px,\s*\d+vh,\s*(\d+)px\)/)
  return !!weekHeight
    && Number(weekHeight[1]) < 820
    && Number(weekHeight[2]) <= 730
    && TASK_CSS.includes('.task-calendar.is-week {')
    && TASK_CSS.includes('height: var(--cal-week-height)')
    && TASK_CALENDAR.includes("'is-week': calendarMode === 'week'")
    && TASK_CSS.includes('.cal-grid.is-week')
})

check('V478-CAL-3 ★响应式：≤1180 单列 / height:auto、日行最小 100px；≤720 列表 / 日历切换且不继承桌面 830px 高度', () => {
  const mobile = TASK_CSS.slice(TASK_CSS.indexOf('@media (max-width: 720px)'))
  return TASK_CSS.includes('@media (max-width: 1180px)')
    && TASK_CSS.includes('.task-calendar,\n  .task-calendar.is-week {')
    && TASK_CSS.includes('grid-template-rows: repeat(6, minmax(100px, auto))')
    && TASK_CSS.includes('min-height: 100px;')
    && mobile.includes('.cal-mobile-switch')
    && mobile.includes('.task-calendar.mobile-list .cal-board')
    && mobile.includes('.task-calendar.mobile-calendar .cal-pool')
    && !mobile.includes('height: var(--cal-month-height)')
    && TASK_CSS.includes('overflow-x: auto;')
})

check('V478-CAL-4 ★今日三件事优先占用月格前三条：focus 条目先于普通任务，可见上限仍为 3，普通任务走 +N', () => {
  const visible = TASK_CALENDAR.match(/function visibleCalendarEntries\(entries: CalendarEntry\[\]\): CalendarEntry\[\] \{[\s\S]*?\n\}/)?.[0] || ''
  return TASK_CALENDAR.includes('map.set(date, [...entries, ...planned.filter(entry => !focusKeys.has(entry.key))])')
    && visible.includes("const limit = calendarMode.value === 'week' ? 12 : 3")
    && visible.includes('const focusEntries = entries.filter(entry => !!entry.slot)')
    && visible.includes('const plannedEntries = entries.filter(entry => !entry.slot)')
    && visible.includes('return [...focusEntries, ...plannedEntries].slice(0, limit)')
    && TASK_CALENDAR.includes("'cal-more-count': calendarMode === 'month' && hiddenCalendarEntryCount(cell.entries)")
    && TASK_CALENDAR.includes('+${hiddenCalendarEntryCount(cell.entries)}')
    && TASK_CALENDAR.includes('v-if="calendarMode === \'week\' && hiddenCalendarEntryCount(cell.entries)"')
})

check('V478-CAL-5 ★选题日历独立 820–840px、好奇心日历独立 700px，均按内容校准；首页与选题面板的重复 min-height 口径已清理', () => {
  const topicHeight = TOPIC_MANAGER.match(/--topic-calendar-height:\s*clamp\((\d+)px,\s*\d+vh,\s*(\d+)px\)/)
  return !!topicHeight
    && Number(topicHeight[1]) >= 820
    && Number(topicHeight[2]) <= 840
    && TOPIC_MANAGER.includes("'is-calendar': viewMode === 'calendar'")
    && TOPIC_MANAGER.includes('.is-calendar .topic-workbench')
    && TOPIC_MANAGER.includes('height: var(--topic-calendar-height)')
    && TOPIC_MANAGER.includes('align-items: stretch')
    && TOPIC_CALENDAR.includes('min-height: var(--cal-day-chip-height)')
    && TOPIC_CALENDAR.includes('padding: 3px 6px')
    && TOPIC_CALENDAR.includes('.topic-cal-board { width: 100%; min-width: 0; min-height: 0; }')
    && CURIO_WORKBENCH.includes('--cw-calendar-height: 700px')
    && CURIO_WORKBENCH.includes("'is-calendar': viewMode === 'calendar'")
    && CURIO_WORKBENCH.includes('min-height: var(--cw-calendar-height)')
    && !HOME_CSS.includes('.topic-workbench-home :deep(.topic-workbench)')
    && !HOME_CSS.includes('min-height: 560px')
})

check('V478-HIST-1 ★groups 聚合后按 card.id 建最新记录 Map：ts 大者胜，同 ts 以 key 确定性 tie-break，每卡恰好一条 isHistory=false', () => {
  const groups = TIMELINE.match(/const groups = computed\(\(\) => \{[\s\S]*?\n\}\)/)?.[0] || ''
  return TIMELINE.includes('isHistory: boolean')
    && TIMELINE.includes('isHistory: false')
    && groups.includes('const latestByCard = new Map<string, TimelineEntry>()')
    && groups.includes('if (!current || entry.ts > current.ts || (entry.ts === current.ts && entry.key > current.key))')
    && groups.includes('entry.isHistory = latestByCard.get(entry.id)?.key !== entry.key')
    && groups.includes('sort((a, b) => b.ts - a.ts || b.key.localeCompare(a.key))')
    && groups.includes('const key = `${day}:${event.cardId}`')
    && groups.includes('existing.count += 1')
})

check('V478-HIST-2 ★历史态与完成态正交：class 同时输出 is-done / is-history，历史标签、aria-label、单击 / 双击 / 键盘仍可用', () => {
  return TIMELINE.includes(":class=\"{ 'is-done': entry.done, 'is-history': entry.isHistory }\"")
    && TIMELINE.includes('v-if="entry.isHistory" class="cpt-history-label">历史</span>')
    && TIMELINE.includes(':aria-label="entryAriaLabel(entry, group.day)"')
    && TIMELINE.includes("const recordState = entry.isHistory ? '历史记录' : '最新记录'")
    && TIMELINE.includes('@click="onCardClick(entry, $event)"')
    && TIMELINE.includes('@dblclick.stop.prevent="onCardDblClick(entry)"')
    && TIMELINE.includes('type="button"')
    && TIMELINE.includes('.cpt-card:focus-visible')
})

check('V478-HIST-3 ★更早记录虚线灰面灰字、去类型色；hover 不上浮不恢复类型色，最新记录仍走默认彩色卡面', () => {
  const history = TIMELINE.match(/\.cpt-card\.is-history \{[\s\S]*?\n\}/)?.[0] || ''
  const hover = TIMELINE.match(/\.cpt-card\.is-history:hover \{[\s\S]*?\n\}/)?.[0] || ''
  const latest = TIMELINE.match(/\.cpt-card \{[\s\S]*?\n\}/)?.[0] || ''
  return /border:\s*1px dashed var\(--border-strong\)/.test(history)
    && history.includes('background: color-mix(in srgb, var(--surface-2)')
    && history.includes('color: var(--text-3)')
    && !history.includes('--kind-color')
    && hover.includes('background: var(--surface-2)')
    && hover.includes('box-shadow: none')
    && hover.includes('transform: none')
    && !hover.includes('--kind-color')
    && TIMELINE.includes('.cpt-card.is-history .cpt-kind')
    && TIMELINE.includes('.cpt-card.is-history .cpt-status i { background: var(--text-4); }')
    && latest.includes('border: 1px solid color-mix(in srgb, var(--kind-color)')
    && latest.includes('background: color-mix(in srgb, var(--kind-color)')
})

check('V478-HIST-4 ★旧断言重指备案：135 的 620 / 730 与 minmax(0,1fr) 已指向新高度 / 行高公式；167 的 is-done 同时要求 is-history；141 的选题根类同步 is-calendar', () => {
  const old135 = shard('135-v432-calendar-pool.cjs')
  const old167 = shard('167-v477-profile-noise-resource-picker-topic-calendar.cjs')
  const old141 = shard('141-v450-topic-cards.cjs')
  return old135.includes('--cal-month-height: clamp(830px, 86vh, 860px)')
    && old135.includes('grid-template-rows: repeat(6, minmax(var(--cal-month-row-min), 1fr))')
    && !old135.includes('height: clamp(620px, 68vh, 730px)')
    && !old135.includes('grid-template-rows: repeat(6, minmax(0, 1fr))')
    && old167.includes("'is-done': entry.done")
    && old167.includes('is-history')
    && old167.includes('entry.isHistory')
    && old141.includes('is-calendar')
    && old141.includes('viewMode')
})
