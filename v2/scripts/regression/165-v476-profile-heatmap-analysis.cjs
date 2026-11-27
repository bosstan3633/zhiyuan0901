const { check, read } = require('./helpers.cjs')

console.log('【V4.7.6 · 画像年度热力与卡片分析】')
const PROFILE = read('/newtab/views/ProfileInsights.vue')
const TIMELINE = read('/newtab/components/profile/PiTimeline.vue')
const ANNUAL = read('/newtab/components/profile/PiAnnualHeatmap.vue')
const ANALYSIS = read('/newtab/components/profile/PiCardAnalysis.vue')
const STATS = read('/shared/utils/dailyStats.ts')
const EVENTS = read('/shared/utils/eventLog.ts')
const SHARE = read('/newtab/components/curation/CurationShareDrawer.vue')

check('V476-PA-1 年度热力前置，默认时间轴，原热力 Tab 改为卡片分析并兼容旧深链', () =>
  PROFILE.includes("type ProfileView = 'timeline' | 'analysis'")
  && PROFILE.includes('<PiAnnualHeatmap') && PROFILE.indexOf('<PiAnnualHeatmap') < PROFILE.indexOf('<PiTimeline')
  && PROFILE.includes('data-profile-view="analysis"') && PROFILE.includes('卡片分析')
  && PROFILE.includes("route.query.view === 'heatmap'") && PROFILE.includes('<PiCardAnalysis v-else'))

check('V476-PA-2 三件事 Tab 只投影真实历史任务与选题槽位，隐藏已删卡且不重复普通时间轴', () =>
  TIMELINE.includes("type TimelineFilter = 'all' | 'focus' | CardKind")
  && TIMELINE.includes("{ key: 'focus', label: '三件事' }")
  && TIMELINE.includes('Object.entries(props.data.dailyFocus || {})')
  && TIMELINE.includes("slot.sourceType !== 'task' && slot.sourceType !== 'topic'")
  && TIMELINE.includes('if (!card || card.deletedAt) continue')
  && TIMELINE.includes("kindFilter.value === 'focus' ? focusEntries.value : filteredEntries.value")
  && !TIMELINE.includes('open-shortcuts') && !TIMELINE.includes('浏览器快捷键'))

check('V476-PA-3 卡片分析承接原使用状态、三件事真实统计与生命周期', () =>
  ANALYSIS.includes('<PiOverview') && ANALYSIS.includes('三件事，是否持续推进')
  && ANALYSIS.includes('focusAnalysis') && ANALYSIS.includes('completionRate')
  && ANALYSIS.includes('资源生命周期与高价值沉睡证据唤醒') && ANALYSIS.includes('<LifecyclePanel'))

check('V476-PA-4 热力覆盖新增、修改、状态、浏览、三件事、关联与成果，重复同类当日零分', () =>
  STATS.includes('edit: 0.8, outcome: 3.0') && STATS.includes('edit: number') && STATS.includes('outcome: number')
  && STATS.includes('const scoredActions = new Set<string>()')
  && STATS.includes("scoredActions.has(`call|${key}`)")
  && STATS.includes("scoredActions.has(`status|${dayOf(e.ts)}|${e.cardId}`)")
  && STATS.includes("scoredActions.has(`edit|${dayOf(e.ts)}|${e.cardId}`)")
  && STATS.includes("scoredActions.has(`outcome|${dayOf(e.ts)}|${e.cardId}`)")
  && STATS.includes('const scoredFields = new Set<string>()'))

check('V476-PA-5 修改来自真实 updatedAt 差分；选题发布和策展导出才计成果，编辑画布不计', () =>
  EVENTS.includes("'edit' | 'outcome'") && EVENTS.includes('c.updatedAt > prev.updatedAt')
  && STATS.includes('r.w += statusWeight(kind, e.to)')
  && SHARE.includes("recordOutcomeEvent('resource'") && SHARE.includes('await downloadSingleHtml()')
  && !SHARE.includes('options.nodes'))

check('V476-PA-6（V4.7.7 重指）年度热力保留四格、日战报与同源统计读数；四格移到热力图下方，标题说明块退役，让热力图成为首屏主视觉', () =>
  ANNUAL.includes('<Heatmap') && ANNUAL.includes("emit('open-battle', day)")
  && ANNUAL.includes("emit('drill', 'yr-active')") && ANNUAL.includes('ya.acts')
  && ANNUAL.includes('pi-heat-stats')
  && ANNUAL.indexOf('class="pi-hmbox"') < ANNUAL.indexOf('pi-heat-stats')
  && !ANNUAL.includes('每一天，卡片如何向前')
  && ANNUAL.includes(':show-summary="false"'))
