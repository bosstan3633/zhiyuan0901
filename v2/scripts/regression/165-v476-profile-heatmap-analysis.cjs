const { check, read } = require('./helpers.cjs')

console.log('【V4.7.6 · 画像年度热力与卡片分析】')
const PROFILE = read('/newtab/views/ProfileInsights.vue')
const TIMELINE = read('/newtab/components/profile/PiTimeline.vue')
const ANNUAL = read('/newtab/components/profile/PiAnnualHeatmap.vue')
const ANALYSIS = read('/newtab/components/profile/PiCardAnalysis.vue')
const PULSE = read('/newtab/components/profile/PiLibraryPulse.vue')
const STATS = read('/shared/utils/dailyStats.ts')
const EVENTS = read('/shared/utils/eventLog.ts')
const SHARE = read('/newtab/components/curation/CurationShareDrawer.vue')

check('V476-PA-1（V4.7.8 重指备案）年度热力前置，默认卡片分析；时间轴保留显式深链，旧 heatmap 深链仍落到卡片分析', () =>
  PROFILE.includes("type ProfileView = 'timeline' | 'analysis'")
  && PROFILE.includes('<PiAnnualHeatmap') && PROFILE.indexOf('<PiAnnualHeatmap') < PROFILE.indexOf('<PiTimeline')
  && PROFILE.includes('data-profile-view="analysis"') && PROFILE.includes('卡片分析')
  && PROFILE.includes("if (route.query.view === 'timeline') return 'timeline'")
  && PROFILE.includes("return 'analysis'")
  // V4.7.8 重指备案：分析视图改为 role=tabpanel 包裹，不再使用 PiCardAnalysis v-else 直挂。
  && PROFILE.includes("value === 'heatmap'")
  && PROFILE.includes('id="pi-view-panel-analysis"')
  && PROFILE.includes('<PiCardAnalysis'))

check('V476-PA-2 三件事 Tab 只投影真实历史任务与选题槽位，隐藏已删卡且不重复普通时间轴', () =>
  TIMELINE.includes("type TimelineFilter = 'all' | 'focus' | CardKind")
  && TIMELINE.includes("{ key: 'focus', label: '三件事' }")
  && TIMELINE.includes('Object.entries(props.data.dailyFocus || {})')
  && TIMELINE.includes("slot.sourceType !== 'task' && slot.sourceType !== 'topic'")
  && TIMELINE.includes('if (!card || card.deletedAt) continue')
  && TIMELINE.includes("kindFilter.value === 'focus' ? focusEntries.value : filteredEntries.value")
  && !TIMELINE.includes('open-shortcuts') && !TIMELINE.includes('浏览器快捷键'))

check('V476-PA-3（V4.7.8 重指备案）卡片分析改由「四卡页签 + 三件事真实统计 + 生命周期」承接；PiOverview 退役为文件保留、不再挂载', () =>
  ANALYSIS.includes('role="tablist"') && ANALYSIS.includes('任务卡') && ANALYSIS.includes('资源卡')
  && ANALYSIS.includes('好奇心卡') && ANALYSIS.includes('选题卡')
  && !ANALYSIS.includes('<PiOverview')
  && ANALYSIS.includes('三件事，是否持续推进')
  && ANALYSIS.includes('pi-focus-analysis') && ANALYSIS.includes('completionRate')
  && ANALYSIS.includes('资源生命周期与高价值沉睡证据唤醒') && ANALYSIS.includes('<LifecyclePanel'))

check('V476-PA-4（V4.7.8 重指备案）热力覆盖新增、修改、状态、浏览、三件事、关联与成果，重复同类当日零分；状态改取同日最终态，正反事件序同分', () =>
  STATS.includes('edit: 0.8, outcome: 3.0') && STATS.includes('edit: number') && STATS.includes('outcome: number')
  && STATS.includes('const scoredActions = new Set<string>()')
  && STATS.includes("scoredActions.has(`call|${key}`)")
  && STATS.includes('function finalStatusEvents(events: CardEvent[])')
  && STATS.includes('finalStatus.get(`${dayOf(e.ts)}|${e.kind}|${e.cardId}`)')
  && STATS.includes("scoredActions.has(`edit|${dayOf(e.ts)}|${e.cardId}`)")
  && STATS.includes("scoredActions.has(`outcome|${dayOf(e.ts)}|${e.cardId}`)")
  && STATS.includes('const scoredFields = new Set<string>()'))

check('V476-PA-5 修改来自真实 updatedAt 差分；选题发布和策展导出才计成果，编辑画布不计', () =>
  EVENTS.includes("'edit' | 'outcome'") && EVENTS.includes('c.updatedAt > prev.updatedAt')
  && STATS.includes('r.w += statusWeight(kind, e.to)')
  && SHARE.includes("recordOutcomeEvent('resource'") && SHARE.includes('await downloadSingleHtml()')
  && !SHARE.includes('options.nodes'))

check('V476-PA-6（V4.7.8 重指备案）年度热力只保留年度节奏 / 年份切换 / 点日下钻；年度四格与次级统计整体迁入全库卡片总览，避免同一读数两处出现', () =>
  ANNUAL.includes('<Heatmap') && ANNUAL.includes("emit('open-battle', day)")
  && !ANNUAL.includes('pi-heat-stats') && !ANNUAL.includes('ya.acts')
  && !ANNUAL.includes("emit('drill'")
  && ANNUAL.indexOf('class="pi-hmbox"') > 0
  && !ANNUAL.includes('每一天，卡片如何向前')
  && ANNUAL.includes(':show-summary="false"')
  && PULSE.includes('全库卡片总览') && PULSE.includes('近 12 个月活跃资产')
  && PULSE.includes('本年活跃') && PULSE.includes('最长连续') && PULSE.includes('调出完整起始日'))
