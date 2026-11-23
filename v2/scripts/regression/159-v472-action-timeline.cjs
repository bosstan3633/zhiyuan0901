/**
 * V4.7.2 · 今日三件事回流、安排创建点、直达看板、落图分层与画像时间轴。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.7.2 · 行动回流与画像时间轴】')

const HOME = read('/newtab/views/CompassHome.vue')
const HOME_LOGIC = read('/newtab/views/useCompassHome.ts')
const CAL = read('/newtab/components/compass/TaskCalendarView.vue')
const CAL_CSS = read('/newtab/components/compass/TaskCalendarView.css')
const TOPIC = read('/newtab/components/compass/TopicManagerPanel.vue')
const BG = read('/background/index.ts')
const PSH = read('/newtab/components/compass/PlanScheduleHistory.vue')
const CLOUD = read('/newtab/composables/useCloudSync.ts')
const PROFILE = read('/newtab/views/ProfileInsights.vue')
const TIMELINE = read('/newtab/components/profile/PiTimeline.vue')
const TIMELINE_DRAWER = read('/newtab/components/profile/PiTimelineDrawer.vue')

check('V472-1 ★已完成任务/选题仍可再次加入今日三件事；只有已在当前三格中的卡置灰', () => {
  return HOME_LOGIC.includes("const pickerStatus = ref<'all' | 'todo' | 'doing' | 'done'>('all')")
    && HOME_LOGIC.includes('function pickerDisabled(t: TaskCard): boolean {\n  return pickedIds.value.has(t.id)')
    && HOME_LOGIC.includes('function pickerTopicDisabled(topic: TopicCard): boolean {\n  return pickedIds.value.has(topic.id)')
    && !HOME_LOGIC.includes("return t.status === 'done' || pickedIds.value.has(t.id)")
    && !HOME_LOGIC.includes('return isTopicDone(d.value, topic) || pickedIds.value.has(topic.id)')
    && HOME.includes('<option value="done">已完成</option>')
    && HOME.includes('已完成卡可再次入选')
})

check('V472-2 ★安排历程明确写入卡片创建时间，并把创建点作为时间轴最后一站', () => {
  return PSH.includes('const createdAt = computed')
    && PSH.includes("props.cardKind === 'task'")
    && PSH.includes('创建于 {{ fmtCreatedAt(createdAt) }}')
    && PSH.includes('class="psh-row psh-created"')
    && PSH.includes('创建卡片')
    && PSH.includes('写入卡片池')
})

check('V472-3（V4.7.3 重指）任务/选题快捷键直达均落到一级卡片池看板、全部项目、全部状态', () => {
  return BG.includes('/?tab=task&fresh=1&view=board&freshAt=')
    && BG.includes('/?tab=topic&fresh=1&view=board&freshAt=')
    && HOME.includes("route.query.fresh")
    && HOME.includes("taskWorkStatus.value = 'all'")
    && HOME.includes("taskWorkProject.value = ''")
    && HOME.includes("taskWorkView.value = String(viewRaw || '') === 'calendar' ? 'calendar' : 'board'")
    && HOME.includes('topicManagerRef.value?.resetForFresh')
    && TOPIC.includes("async function resetForFresh(nextView: 'calendar' | 'board' = 'board')")
    && TOPIC.includes('viewMode.value = nextView')
})

check('V472-4 ★任务清单按“未落图 / 已落图”分组，卡面再用左侧状态轨与日期胶囊区分', () => {
  return CAL.includes("name: '未落图'")
    && CAL.includes("name: '已落图'")
    && CAL.includes("planState: 'pending'")
    && CAL.includes("planState: 'planned'")
    && CAL.includes("task.dueDate ? 'is-planned' : 'is-unplanned'")
    && CAL_CSS.includes('.cal-pool-task.is-unplanned')
    && CAL_CSS.includes('.cal-pool-task.is-planned')
    && CAL_CSS.includes('.cal-pool-group.is-plan-pending')
    && CAL_CSS.includes('.cal-pool-group.is-plan-planned')
})

check('V472-5（V4.7.3 重指）画像洞察“观察范围”改为时间轴 / 热力图双视图，默认时间轴，热力图保留原 PiYear', () => {
  return PROFILE.includes("type ProfileView = 'timeline' | 'heatmap'")
    && PROFILE.includes("return 'timeline'")
    && PROFILE.includes('data-profile-view="timeline"')
    && PROFILE.includes('data-profile-view="heatmap"')
    && PROFILE.includes('<PiTimeline')
    && PROFILE.includes('<PiYear v-else')
    && !PROFILE.includes('<PiRangeTabs')
    && !PROFILE.includes("activeRange === 'today'")
})

check('V472-6 ★时间轴按自然日倒序聚合写入/修改卡，类型有角标、状态走业务色，点卡打开详情', () => {
  return TIMELINE.includes("new Set<EventAction>(['create', 'status', 'restore', 'delete'])")
    && TIMELINE.includes('const groupedEntries = computed')
    && TIMELINE.includes('.sort((a, b) => b.ts - a.ts')
    && TIMELINE.includes('.sort(([a], [b]) => b.localeCompare(a))')
    && TIMELINE.includes('const KIND_META')
    && TIMELINE.includes('--kind-color')
    && TIMELINE.includes('--status-color')
    && TIMELINE.includes("emit('open', entry)")
    && TIMELINE.includes('时间轴')
})

check('V472-7 ★时间轴详情提供唯一回流按钮，点后经 locateTargetOf 定位到对应卡片池', () => {
  return TIMELINE_DRAWER.includes('定位回卡片池')
    && TIMELINE_DRAWER.includes("emit('locate', entry)")
    && PROFILE.includes('function locateTimelineEntry(entry: PiTimelineEntry)')
    && PROFILE.includes('locateTargetOf(gd.value, kind, entry.id)')
    && PROFILE.includes('void router.push(target)')
})

check('V472-8 ★后台云关系探测失败只落错误态，不再向上抛出 unhandledrejection', () => {
  const catchSeg = CLOUD.slice(CLOUD.indexOf('const promise = (async () => {'), CLOUD.indexOf('relationProbePromise = promise'))
  return catchSeg.includes("state.value = 'error'")
    && catchSeg.includes('return null')
    && !catchSeg.includes('throw error')
})
