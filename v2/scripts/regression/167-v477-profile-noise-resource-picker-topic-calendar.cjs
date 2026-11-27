/**
 * V4.7.7 · 画像提纯、完成态降噪、资源卡池挂载与选题日历隔离。
 *
 * 本轮七项需求分三条契约：
 *  ① 画像页视觉焦点回到热力图，时间轴完成任务 / 选题降噪；
 *  ② 任务 / 选题详情的资源关联只走资源卡池多选弹窗；
 *  ③ 任务日历保留历史虚线镜像，选题日历 / 时间线只呈现选题自身落图。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

const PROFILE = read('/newtab/views/ProfileInsights.vue')
const PROFILE_CSS = read('/newtab/views/ProfileInsights.css')
const HERO = read('/newtab/components/profile/PiHero.vue')
const HEATMAP = read('/newtab/components/profile/PiAnnualHeatmap.vue')
const PI_TIMELINE = read('/newtab/components/profile/PiTimeline.vue')
const ANALYSIS = read('/newtab/components/profile/PiCardAnalysis.vue')
const OVERVIEW = read('/newtab/components/profile/PiOverview.vue')
const PICKER = read('/newtab/components/compass/CardResourcePickerModal.vue')
const TASK_DRAWER = read('/newtab/components/compass/TaskDetailDrawer.vue')
const TOPIC_DRAWER = read('/newtab/components/compass/TopicDetailDrawer.vue')
const TASK_CALENDAR = read('/newtab/components/compass/TaskCalendarView.vue')
const TASK_CALENDAR_CSS = read('/newtab/components/compass/TaskCalendarView.css')
const TOPIC_CALENDAR = read('/newtab/components/compass/TopicCalendarView.vue')
const TOPIC_PANEL = read('/newtab/components/compass/TopicManagerPanel.vue')
const POOL_TIMELINE = read('/newtab/components/compass/CardPoolTimeline.vue')
const CLOUD_SYNC = read('/shared/cloud/sync.ts')
const STORAGE = read('/shared/storage/repository.ts')

console.log('【V4.7.7 · 画像提纯 / 完成态降噪 / 资源卡池挂载 / 选题日历隔离】')

check('V477-1 ★画像页头压缩，年度热力先于指标成为首屏主视觉', () => {
  const pageRule = PROFILE_CSS.match(/\.pi-page \{[^}]*\}/)?.[0] || ''
  const heatAt = HEATMAP.indexOf('class="pi-hmbox"')
  const statsAt = HEATMAP.indexOf('class="pi-strip pi-heat-stats"')
  return /padding:\s*12px var\(--page-gutter\) 48px/.test(pageRule)
    && /gap:\s*12px/.test(pageRule)
    && /\.hero-row-top \{ min-height: 30px; \}/.test(HERO)
    && /\.pi-hero-acts :deep\(\.pi-btn\) \{ min-height: 30px;/.test(HERO)
    && heatAt > 0 && statsAt > heatAt
    && PROFILE.indexOf('<PiAnnualHeatmap') < PROFILE.indexOf('<div class="pi-rmods')
})

check('V477-2 ★画像时间轴：任务 / 选题完成态读业务完成语义并灰阶、删线', () => {
  return PI_TIMELINE.includes("import { isTaskDone, taskStatusOf } from '@/shared/utils/taskStatus'")
    && PI_TIMELINE.includes("import { isTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'")
    && PI_TIMELINE.includes("done: isTaskDone(props.data, card)")
    && PI_TIMELINE.includes("done: isTopicDone(props.data, card)")
    && PI_TIMELINE.includes("'is-done': entry.done")
    && /\.pit-card\.is-done \{[^}]*background:\s*color-mix\(in srgb, var\(--surface-2\)/.test(PI_TIMELINE)
    && /\.pit-card\.is-done \.pit-card-title \{[^}]*color:\s*var\(--text-3\)[^}]*text-decoration:\s*line-through/.test(PI_TIMELINE)
    && /if \(entry\.kind === 'resource' \|\| entry\.kind === 'curiosity'\) return ''/.test(PI_TIMELINE)
})

check('V477-3 ★资源卡池多选弹窗：关键词检索、已关联禁选、多选一次挂载', () => {
  const filter = PICKER.match(/const filtered = computed\(\(\) => \{[\s\S]*?\n\}\)/)?.[0] || ''
  return PICKER.includes('aria-multiselectable="true"')
    && PICKER.includes('v-model="query"')
    && ['card.title', 'card.description', 'card.link', '(card.tags || []).join(\' \')'].every(token => filter.includes(token))
    && PICKER.includes(':disabled="linked.has(card.id)"')
    && PICKER.includes('@click="toggle(card)"')
    && PICKER.includes("emit('confirm', selectedResources.value)")
    && TASK_DRAWER.includes("import CardResourcePickerModal from './CardResourcePickerModal.vue'")
    && TASK_DRAWER.includes('从资源卡池挂载')
    && TASK_DRAWER.includes(':linked-ids="supportRows.map(row => row.resource.id)"')
    && TASK_DRAWER.includes('@confirm="mountResources"')
    && TOPIC_DRAWER.includes("import CardResourcePickerModal from './CardResourcePickerModal.vue'")
    && TOPIC_DRAWER.includes('从资源卡池挂载')
    && TOPIC_DRAWER.includes(':linked-ids="resourceRows.map(row => row.resource.id)"')
    && TOPIC_DRAWER.includes('@confirm="mountResources"')
})

check('V477-4 ★卡片分析删除方向状态，按卡片构成 → 三件事 → 生命周期重排', () => {
  const ovAt = ANALYSIS.indexOf('<PiOverview')
  const focusAt = ANALYSIS.indexOf('class="pi-mod pi-focus-analysis"')
  const lifecycleAt = ANALYSIS.indexOf('id="lc-sec"')
  return ovAt > 0 && focusAt > ovAt && lifecycleAt > focusAt
    && !OVERVIEW.includes('你的方向状态')
    && !OVERVIEW.includes('PERSONAL DIRECTION')
    && !OVERVIEW.includes('focusProjects')
    && !ANALYSIS.includes('你的方向状态')
    && !ANALYSIS.includes('PERSONAL DIRECTION')
    && ANALYSIS.includes('近 30 天槽次完成率')
    && ANALYSIS.includes('近 7 日节奏')
    && ANALYSIS.includes('资源生命周期与高价值沉睡证据唤醒')
})

check('V477-5 ★任务日历：历史镜像虚线，完成卡灰阶，当天推进态保持强调', () => {
  const mirror = TASK_CALENDAR_CSS.match(/\.cal-task-chip\.is-history-mirror,[\s\S]*?\n\}/)?.[0] || ''
  const mirrorDone = TASK_CALENDAR_CSS.match(/\.cal-task-chip\.is-history-mirror\.is-done,[\s\S]*?\n\}/)?.[0] || ''
  const done = TASK_CALENDAR_CSS.match(/\.cal-task-chip\.is-done \{[\s\S]*?\n\}/)?.[0] || ''
  const today = TASK_CALENDAR_CSS.match(/\.cal-task-chip\.tone-today \{[\s\S]*?\n\}/)?.[0] || ''
  return TASK_CALENDAR.includes("'is-history-mirror': entry.mirror")
    && TASK_CALENDAR.includes("'tone-' + taskTone(entry.task)")
    && /border:\s*1px dashed/.test(mirror)
    && /opacity:\s*\.58/.test(mirrorDone)
    && /opacity:\s*\.72/.test(done)
    && /background:\s*var\(--tag-warn-bg\)/.test(today)
})

check('V477-6 ★卡池时间线：左侧轴线与留白在位，完成卡降噪且推进态保留状态色', () => {
  return POOL_TIMELINE.includes('class="cpt-axis"')
    && /grid-template-columns:\s*112px 18px minmax\(0, 1fr\)/.test(POOL_TIMELINE)
    && /\.cpt \{[^}]*padding:\s*8px 0 20px 14px/.test(POOL_TIMELINE)
    && /\.cpt-axis::before \{[\s\S]*?width:\s*1px;[\s\S]*?background:\s*var\(--border-strong\)/.test(POOL_TIMELINE)
    && POOL_TIMELINE.includes(':class="{ \'is-done\': entry.done }"')
    && /\.cpt-card\.is-done \.cpt-title \{[^}]*text-decoration:\s*line-through/.test(POOL_TIMELINE)
    && /--status-color/.test(POOL_TIMELINE)
})

check('V477-7 ★选题日历与时间线只呈现选题自己，不接任务与今日三件事载荷', () => {
  return TOPIC_CALENDAR.includes("kind: 'topic'")
    && !TOPIC_CALENDAR.includes('TaskCard')
    && !TOPIC_CALENDAR.includes('dailyFocus')
    && !TOPIC_CALENDAR.includes('focusEntries')
    && !TOPIC_CALENDAR.includes('历史三件事')
    && !TOPIC_CALENDAR.includes('sourceType')
    && TOPIC_CALENDAR.includes('只呈现选题卡自己的落图，不混入任务与今日三件事')
    && TOPIC_PANEL.includes('kind="topic"')
    && !TOPIC_PANEL.includes(':tasks=')
    && !TOPIC_PANEL.includes(':focus-entries=')
})

check('V477-8 ★主体色继续走知源蓝语义令牌，本轮新增反色文字不回流硬编码白', () => {
  const pickerStyle = PICKER.slice(PICKER.indexOf('<style'))
  return /--on-accent:\s*#FFFFFF/.test(read('/shared/styles/tokens.css'))
    && !/#fff(?:fff)?\b/i.test(pickerStyle)
    && PICKER.includes('color: var(--on-accent)')
})

check('V477-9 ★时间线只收存活卡片的新增 / 编辑 / 状态动作，删除与已删卡不回流', () => {
  return POOL_TIMELINE.includes("const TRACKED_ACTIONS = new Set<EventAction>(['create', 'edit', 'status'])")
    && !POOL_TIMELINE.includes("'delete'")
    && POOL_TIMELINE.includes('if (!card || card.deletedAt) continue')
    && PI_TIMELINE.includes("const TRACKED_ACTIONS = new Set<EventAction>(['create', 'status'])")
    && !PI_TIMELINE.includes("'delete'")
    && PI_TIMELINE.includes('if (!card || card.deletedAt) continue')
})

check('V477-10 ★今日三件事跨设备同步：槽位内容、顺序与完成态随主快照上传，拉回按日期与槽位 id 合并', () => {
  return CLOUD_SYNC.includes('dailyFocus: preserveDailyFocus(d.dailyFocus)')
    && CLOUD_SYNC.includes("add(manifestRecord('dailyFocus', date, `今日三件事 · ${date}`, slots))")
    && /out\[date\] = \(slots \|\| \[\]\)\.map\(slot => \(\{ \.\.\.slot \}\)\)/.test(CLOUD_SYNC)
    && STORAGE.includes('dailyFocus: mergeDailyFocus(cur.dailyFocus, snap.dailyFocus, ext.dailyFocus)')
    && /mergeCardArr\(c \|\| \[\], sn \|\| \[\], e \|\| \[\]\)\.slice\(0, 3\)/.test(STORAGE)
})
