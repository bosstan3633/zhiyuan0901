/**
 * V4.7.8 · 画像品牌页卡片分析重构。
 *
 * 覆盖：
 *  ① 纯聚合层口径：存活过滤、链接判定、任务归属、有效资源支撑、当前关系引用；
 *  ② 三件事频次只读 active task/topic slots，同卡同日一次，计划事件不冒充；
 *  ③ 热力 → 全库总览 → 四卡页签 → 三件事 → 生命周期；
 *  ④ 任务 / 选题详情抽屉的安排、三件事、资源、归属与汇总筛选；
 *  ⑤ 旧断言重指备案与 SFC 真编译。
 *
 * 本分片由 V4.7.8 主交付统一注册，不修改 regression.cjs。
 */
const fs = require('fs')
const path = require('path')
const { check, read, codeOnly, segOf, SCRIPTS_DIR } = require('./helpers.cjs')

console.log('【V4.7.8 · 画像卡片分析 / 全库总览 / 详情证据链】')

const PROFILE = read('/newtab/views/ProfileInsights.vue')
const HEATMAP = read('/newtab/components/profile/PiAnnualHeatmap.vue')
const PULSE = read('/newtab/components/profile/PiLibraryPulse.vue')
const ANALYSIS = read('/newtab/components/profile/PiCardAnalysis.vue')
const TOPIC_MATCHES = segOf(ANALYSIS, 'function topicMatches', 'const taskRows')
const USE = read('/newtab/views/useCardAnalysis.ts')
const PROFILE_USE = read('/newtab/views/useProfileInsights.ts')
const PROFILE_TAGS = read('/newtab/views/useProfileInsightsTags.ts')
const CARD_INVENTORY = read('/shared/analytics/cardInventory.ts')
const TASK_OWNERSHIP = read('/shared/analytics/taskOwnership.ts')
const TASK_EVIDENCE = read('/shared/analytics/taskEvidence.ts')
const FOCUS_USAGE = read('/shared/analytics/focusUsage.ts')
const TASK_DRAWER = read('/newtab/components/compass/TaskDetailDrawer.vue')
const TOPIC_DRAWER = read('/newtab/components/compass/TopicDetailDrawer.vue')
const FOCUS_HISTORY = read('/newtab/components/compass/CardFocusHistory.vue')
const OLD_165 = fs.readFileSync(path.resolve(__dirname, '165-v476-profile-heatmap-analysis.cjs'), 'utf8')
const OLD_167 = fs.readFileSync(path.resolve(__dirname, '167-v477-profile-noise-resource-picker-topic-calendar.cjs'), 'utf8')
const OLD_19 = fs.readFileSync(path.resolve(__dirname, '19-b7-profile.cjs'), 'utf8')
const OLD_110 = fs.readFileSync(path.resolve(__dirname, '110-v3923-cross-module.cjs'), 'utf8')
const OLD_12 = fs.readFileSync(path.resolve(__dirname, '12-w17-profile.cjs'), 'utf8')

const DAY = 86_400_000
const NOW = Date.now()
const MONTH_START = (() => {
  const d = new Date(NOW)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
})()
const stampThisMonth = MONTH_START + 60_000

function card(id, kind, extra = {}) {
  return {
    id,
    kind,
    title: id,
    createdAt: NOW - 20 * DAY,
    updatedAt: NOW - 2 * DAY,
    tags: [],
    callCount: 0,
    ...extra,
  }
}

function baseData(overrides = {}) {
  return {
    resources: [],
    tasks: [],
    curiosities: [],
    topics: [],
    supportLinks: [],
    topicResourceLinks: [],
    curioSupportLinks: [],
    dailyFocus: {},
    planScheduleEvents: [],
    compass: { directions: [] },
    taskStatuses: [],
    topicStatuses: [],
    ...overrides,
  }
}

function loadAnalytics() {
  let esbuild = null
  try { esbuild = require('esbuild') } catch { return null }
  const out = path.resolve(SCRIPTS_DIR, '..', '.r168-analytics.tmp.cjs')
  try {
    esbuild.buildSync({
      stdin: {
        contents: [
          "export * from '@/shared/analytics/cardInventory'",
          "export * from '@/shared/analytics/taskOwnership'",
          "export * from '@/shared/analytics/taskEvidence'",
          "export * from '@/shared/analytics/focusUsage'",
        ].join('\n'),
        resolveDir: path.resolve(SCRIPTS_DIR, '..', 'src'),
        sourcefile: 'r168-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    })
    return require(out)
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(out) } catch { /* 临时文件可能尚未生成 */ }
  }
}

const A = loadAnalytics()

function compileSfc(relativePath, needles) {
  try {
    const { parse, compileTemplate } = require('@vue/compiler-sfc')
    const filename = path.basename(relativePath)
    const source = read(relativePath)
    const { descriptor, errors } = parse(source, { filename })
    if (errors.length || !descriptor.template) return false
    const result = compileTemplate({
      source: descriptor.template.content,
      filename,
      id: `r168-${filename}`,
    })
    if ((result.errors || []).length) return false
    return needles.every(needle => result.code.includes(needle))
  } catch {
    return false
  }
}

function styleBlock(source) {
  const i = source.indexOf('<style')
  const j = source.lastIndexOf('</style>')
  return i >= 0 && j > i ? source.slice(i, j) : ''
}

/* ============ ① 纯聚合层：真实夹具执行 ============ */

check('V478-CA-1 纯聚合层四文件存在且导出唯一入口；存活过滤与链接判定集中在 cardInventory', () =>
  CARD_INVENTORY.includes('export function buildCardInventory')
  && CARD_INVENTORY.includes('export function isLiveCard')
  && CARD_INVENTORY.includes('!card.deletedAt')
  && CARD_INVENTORY.includes('export function hasUsableResourceLink')
  && CARD_INVENTORY.includes('slots.url')
  && CARD_INVENTORY.includes('slots.file')
  && CARD_INVENTORY.includes('slots.obsidian')
  && TASK_OWNERSHIP.includes('export function buildTaskOwnership')
  && TASK_EVIDENCE.includes('export function buildTaskEvidence')
  && FOCUS_USAGE.includes('export function buildFocusUsage')
  && USE.includes('export function useCardAnalysis'))

check('V478-CA-2 库存聚合只有存活卡进入四类计数；链接可用 = link 或 linkSlots 任一槽；本月新增、12 个月活跃、高价值冷却同源', () => {
  if (!A) {
    return CARD_INVENTORY.includes('resources.filter(isLiveCard)')
      && CARD_INVENTORY.includes('last >= activeFrom')
      && CARD_INVENTORY.includes("lifecycleState(card, now) === 'cooling'")
      && CARD_INVENTORY.includes('linkedResources: resources.filter(hasUsableResourceLink).length')
  }
  const data = baseData({
    resources: [
      card('r1', 'resource', { link: 'https://a', linkType: 'url', callCount: 5, lastCalledAt: NOW - 10 * DAY, createdAt: stampThisMonth, updatedAt: NOW - 10 * DAY, tags: ['x'] }),
      card('r2', 'resource', { link: '', linkSlots: { url: 'https://b' }, linkType: 'url', callCount: 2, lastCalledAt: NOW - 40 * DAY, createdAt: NOW - 400 * DAY, updatedAt: NOW - 40 * DAY, tags: ['x', 'y'] }),
      card('r3', 'resource', { link: '', linkSlots: {}, callCount: 0, createdAt: NOW - 500 * DAY, updatedAt: NOW - 500 * DAY }),
      card('r4', 'resource', { deletedAt: NOW - DAY, link: 'https://deleted', callCount: 10, createdAt: stampThisMonth, updatedAt: NOW - DAY }),
      card('r5', 'resource', { link: 'https://e', linkType: 'url', callCount: 3, lastCalledAt: NOW - 60 * DAY, createdAt: NOW - 100 * DAY, updatedAt: NOW - 60 * DAY, tags: ['z'] }),
    ],
    tasks: [
      card('t1', 'task', { status: 'todo', createdAt: stampThisMonth, updatedAt: stampThisMonth }),
      card('t2', 'task', { status: 'doing', createdAt: NOW - 40 * DAY, updatedAt: NOW - 3 * DAY }),
      card('t3', 'task', { deletedAt: NOW - DAY, createdAt: NOW - 2 * DAY, updatedAt: NOW - 2 * DAY }),
    ],
    curiosities: [
      card('c1', 'curiosity', { createdAt: stampThisMonth, updatedAt: NOW - 5 * DAY }),
      card('c2', 'curiosity', { createdAt: NOW - 500 * DAY, updatedAt: NOW - 500 * DAY }),
    ],
    topics: [
      card('p1', 'topic', { createdAt: stampThisMonth, updatedAt: NOW - 2 * DAY }),
      card('p2', 'topic', { createdAt: NOW - 400 * DAY, updatedAt: NOW - 400 * DAY }),
      card('p3', 'topic', { deletedAt: NOW - DAY, createdAt: NOW - 2 * DAY, updatedAt: NOW - 2 * DAY }),
    ],
  })
  const index = A.buildCardInventory(data, NOW)
  return index.counts.resource === 4
    && index.counts.task === 2
    && index.counts.curiosity === 2
    && index.counts.topic === 2
    && index.total === 10
    && index.monthAdded === 4
    && index.active12m === 7
    && index.highValueCooling === 1
    && index.linkedResources === 3
    && index.tagDistribution[0].tag === 'x' && index.tagDistribution[0].count === 2
    && index.linkKindById.get('r2') === 'url'
    && index.linkKindById.get('r3') === 'none'
    && !index.lastActivityById.has('r4')
    && A.hasUsableResourceLink(data.resources[1])
    && !A.hasUsableResourceLink(data.resources[2])
    && !A.hasUsableResourceLink(null)
})

check('V478-CA-3 任务归属严格按「有效 metricId → 唯一 metric.taskIds → 有效 projectId → 未归属」；多指标命中标 ambiguous 且不重复计数', () => {
  if (!A) {
    return TASK_OWNERSHIP.includes("status = 'metric-id'")
      && TASK_OWNERSHIP.includes("metricIdsFromTaskIds.length === 1")
      && TASK_OWNERSHIP.includes("status = 'ambiguous'")
      && TASK_OWNERSHIP.includes("conflictReasons.add('multiple-metric-matches')")
  }
  const tasks = [
    card('t1', 'task', { projectId: 'pA', metricId: 'mA' }),
    card('t2', 'task'),
    card('t3', 'task', { projectId: 'pA' }),
    card('t4', 'task', { projectId: 'pB', metricId: 'mA' }),
    card('t5', 'task', { metricId: 'missingMetric' }),
    card('t6', 'task', { projectId: 'missingProject' }),
    card('t7', 'task', { metricId: 'mB' }),
  ]
  const data = baseData({
    tasks,
    compass: {
      directions: [{
        id: 'd1',
        name: '方向一',
        projects: [
          { id: 'pA', name: '项目 A', metrics: [{ id: 'mA', title: '指标 A', taskIds: ['t1', 't2'] }] },
          { id: 'pB', name: '项目 B', metrics: [{ id: 'mB', title: '指标 B', taskIds: ['t2'] }] },
        ],
      }],
    },
  })
  const index = A.buildTaskOwnership(data)
  const t1 = index.byTask.get('t1')
  const t2 = index.byTask.get('t2')
  const t4 = index.byTask.get('t4')
  const t5 = index.byTask.get('t5')
  const t6 = index.byTask.get('t6')
  const bucket = (list, id) => list.find(row => row.id === id)?.count || 0
  return t1.status === 'metric-id' && t1.projectId === 'pA' && t1.metricId === 'mA'
    && t2.status === 'ambiguous' && !t2.projectId && !t2.metricId
    && t4.status === 'metric-id' && t4.projectId === 'pA' && t4.conflict
    && t5.status === 'unassigned' && t5.conflict && t5.conflictReasons.includes('orphan-metric')
    && t6.status === 'unassigned' && t6.conflict && t6.conflictReasons.includes('orphan-project')
    && index.ambiguousIds.has('t2') && index.ambiguousIds.size === 1
    && index.unassignedIds.has('t5') && index.unassignedIds.has('t6') && index.unassignedIds.size === 2
    && index.conflictIds.has('t2') && index.conflictIds.has('t4') && index.conflictIds.has('t5') && index.conflictIds.has('t6')
    && index.conflictIds.size === 4
    && index.projectAttachedCount === 4 && index.metricAttachedCount === 3
    && bucket(index.projectBuckets, 'pA') === 3 && bucket(index.projectBuckets, 'pB') === 1
    && bucket(index.metricBuckets, 'mA') === 2 && bucket(index.metricBuckets, 'mB') === 1
    && !index.projectBuckets.some(row => row.id === 'missingProject')
})

check('V478-CA-4 有效资源支撑只算活任务 × 活资源 × 可用链接；资源引用数读当前关系表，无链接资源仍算被引用、解绑即回落', () => {
  if (!A) {
    return TASK_EVIDENCE.includes('effectiveResourceIds')
      && TASK_EVIDENCE.includes('taskResourceIds')
      && TASK_EVIDENCE.includes('resourceRefs')
      && TASK_EVIDENCE.includes('hasUsableResourceLink')
  }
  const data = baseData({
    resources: [
      card('r1', 'resource', { link: 'https://a', linkType: 'url' }),
      card('r2', 'resource', { link: '', linkSlots: { url: 'https://b' }, linkType: 'url' }),
      card('r3', 'resource', { link: '', linkSlots: {}, linkType: 'url' }),
      card('r4', 'resource', { link: 'https://deleted', linkType: 'url', deletedAt: NOW - DAY }),
      card('r5', 'resource', { link: 'https://idle', linkType: 'url' }),
    ],
    tasks: [card('t1', 'task'), card('t2', 'task'), card('t3', 'task', { deletedAt: NOW - DAY }), card('t4', 'task')],
    topics: [card('p1', 'topic'), card('p2', 'topic'), card('p3', 'topic', { deletedAt: NOW - DAY })],
    curiosities: [card('c1', 'curiosity'), card('c2', 'curiosity', { deletedAt: NOW - DAY })],
    supportLinks: [
      { id: 's1', taskId: 't1', resourceId: 'r1' },
      { id: 's2', taskId: 't1', resourceId: 'r1' },
      { id: 's3', taskId: 't1', resourceId: 'r2' },
      { id: 's4', taskId: 't1', resourceId: 'r3' },
      { id: 's5', taskId: 't2', resourceId: 'r1' },
      { id: 's6', taskId: 't3', resourceId: 'r1' },
      { id: 's7', taskId: 't1', resourceId: 'r4' },
      { id: 's8', taskId: 't1', resourceId: 'missingResource' },
    ],
    topicResourceLinks: [
      { id: 'tp1', topicId: 'p1', resourceId: 'r1' },
      { id: 'tp2', topicId: 'p1', resourceId: 'r4' },
      { id: 'tp3', topicId: 'p2', resourceId: 'r3' },
      { id: 'tp4', topicId: 'p3', resourceId: 'r1' },
    ],
    curioSupportLinks: [
      { id: 'cp1', curioId: 'c1', resourceId: 'r2' },
      { id: 'cp2', curioId: 'c2', resourceId: 'r1' },
      { id: 'cp3', curioId: 'c1', resourceId: 'r4' },
    ],
  })
  const index = A.buildTaskEvidence(data)
  const r1 = index.resourceRefs.get('r1')
  const r3 = index.resourceRefs.get('r3')
  return index.effectiveResourceIds.has('r1') && index.effectiveResourceIds.has('r2')
    && !index.effectiveResourceIds.has('r3') && !index.effectiveResourceIds.has('r4')
    && index.taskResourceIds.get('t1')?.size === 2
    && index.taskResourceIds.get('t2')?.size === 1
    && !index.taskResourceIds.has('t3')
    && index.effectiveTaskSupportCount === 2 && index.effectiveTaskSupportRate === 67
    && index.topicResourceIds.get('p1')?.size === 1 && !index.topicResourceIds.has('p2')
    && index.curioResourceIds.get('c1')?.size === 1
    && r1 && r1.taskIds.size === 2 && r1.topicIds.size === 1 && r1.curioIds.size === 0 && r1.totalRefs === 3
    && r3 && r3.taskIds.size === 1 && r3.topicIds.size === 1 && r3.totalRefs === 2
    && !index.resourceRefs.has('r4')
    && index.zeroReferenceResourceIds.has('r5') && index.zeroReferenceResourceIds.size === 1
    && index.taskReferencedResourceCount === 3
    && index.highFrequencyResources[0]?.resource.id === 'r1'
    && index.taskSupportLinks.get('t1')?.length === 4
})

check('V478-CA-5 三件事只遍历 dailyFocus 的 active task/topic slots；同卡同日一次；已清空、已删卡、资源/文本槽、planScheduleEvents 一律不计', () => {
  if (!A) {
    return FOCUS_USAGE.includes('activeFocusSlots')
      && FOCUS_USAGE.includes("slot.sourceType === 'task' || slot.sourceType === 'topic'")
      && FOCUS_USAGE.includes('seen.has(key)')
      && !codeOnly(FOCUS_USAGE).includes('planScheduleEvents')
  }
  const data = baseData({
    tasks: [card('t1', 'task'), card('t2', 'task'), card('t3', 'task', { deletedAt: NOW - DAY })],
    topics: [card('p1', 'topic'), card('p2', 'topic', { deletedAt: NOW - DAY })],
    dailyFocus: {
      '2026-11-20': [
        { id: 's1', sourceType: 'task', sourceId: 't1', done: true, doneAt: 1 },
        { id: 's2', sourceType: 'task', sourceId: 't1', done: false },
        { id: 's3', sourceType: 'topic', sourceId: 'p1', done: false },
        { id: 's4', sourceType: 'resource', sourceId: 'r1', done: true },
        { id: 's5', sourceType: 'task', sourceId: 't3', done: true },
      ],
      '2026-11-21': [
        { id: 's6', sourceType: 'task', sourceId: 't1', done: false },
        { id: 's7', sourceType: 'task', sourceId: 't2', done: true },
        { id: 's8', sourceType: 'task', sourceId: 't2', done: false, cleared: true },
        { id: 's9', sourceType: 'text', text: '自由文本', done: true },
      ],
      '2026-11-22': [
        { id: 's10', sourceType: 'topic', sourceId: 'p2', done: true },
        { id: 's11', sourceType: 'task', sourceId: 't1', done: true, cleared: true },
      ],
    },
    planScheduleEvents: [
      { id: 'plan1', cardId: 't2', cardKind: 'task', at: Date.now(), date: '2026-11-21', source: 'detail' },
    ],
  })
  const index = A.buildFocusUsage(data)
  const t1 = A.focusUsageOfCard(index, 'task', 't1')
  const p1 = A.focusUsageOfCard(index, 'topic', 'p1')
  return index.byCard.size === 3
    && t1.count === 2 && t1.doneCount === 1
    && p1.count === 1 && p1.doneCount === 0
    && A.focusUsageOfCard(index, 'task', 't2').count === 1
    && index.totalPlanned === 4 && index.totalDone === 2 && index.activeDays === 2
    && index.byDay.get('2026-11-20')?.planned === 2
    && index.byDay.get('2026-11-20')?.done === 1
    && index.byDay.get('2026-11-21')?.planned === 2
    && index.byDay.get('2026-11-21')?.done === 1
    && !index.byDay.has('2026-11-22')
    && A.focusWindowSummary(index, new Date(2026, 10, 22).getTime(), 30).cards === 3
})

check('V478-CA-6 平均进入次数分母只算曾进入过三件事的任务；同时单列从未进入数与全库摊平值，频次分桶互斥', () => {
  if (!A) {
    return FOCUS_USAGE.includes('averageEntered')
      && FOCUS_USAGE.includes('averageAll')
      && FOCUS_USAGE.includes('never: Math.max(0, liveCount - entered.length)')
      && FOCUS_USAGE.includes("key: 'six-plus'")
  }
  const data = baseData({
    tasks: [card('t1', 'task'), card('t2', 'task'), card('t3', 'task')],
    dailyFocus: {
      '2026-11-20': [{ id: 's1', sourceType: 'task', sourceId: 't1', done: true }],
      '2026-11-21': [{ id: 's2', sourceType: 'task', sourceId: 't1', done: false }],
      '2026-11-22': [{ id: 's3', sourceType: 'task', sourceId: 't2', done: true }],
    },
  })
  const index = A.buildFocusUsage(data)
  const summary = A.focusCardSummary(index, 'task', 3)
  return summary.entered === 2 && summary.never === 1
    && summary.totalOccurrences === 3
    && summary.averageEntered === 1.5 && summary.averageAll === 1
    && summary.maxCount === 2
    && summary.distribution.find(row => row.key === 'zero')?.count === 1
    && summary.distribution.find(row => row.key === 'two')?.count === 1
})

/* ============ ② useCardAnalysis / 页面结构 ============ */

check('V478-CA-7 useCardAnalysis 一次物化四卡模型：任务完成态读 status.bucket、选题只读 topicStatuses.terminal，不伪造 publishedAt；状态 Map 索引避免列表 N+1', () =>
  USE.includes('const inventory = computed(() => buildCardInventory')
  && USE.includes('const ownership = computed(() => buildTaskOwnership')
  && USE.includes('const evidence = computed(() => buildTaskEvidence')
  && USE.includes('const focus = computed(() => buildFocusUsage')
  && USE.includes('function buildTaskStatusLookup')
  && USE.includes('function buildTopicStatusLookup')
  && USE.includes("const bucket = status?.bucket || card.status || 'todo'")
  && USE.includes('terminal: !!status?.terminal')
  && USE.includes('monthAdded: (card.createdAt || 0) >= monthStart')
  && USE.includes('recent30Added: (card.createdAt || 0) >= recentFrom')
  && USE.includes('const monthAddedCount = rows.filter(row => row.monthAdded)')
  && USE.includes('const recent30AddedCount = rows.filter(row => row.recent30Added)')
  && !USE.includes('publishedAt')
  && USE.includes('projectNameById')
  && USE.includes('metricTitleById')
  && USE.includes('folderNameById')
  && USE.includes('recentCallIds')
  && USE.includes('task: TaskAnalysisBlock')
  && USE.includes('resource: ResourceAnalysisBlock')
  && USE.includes('curiosity: CuriosityAnalysisBlock')
  && USE.includes('topic: TopicAnalysisBlock'))

check('V478-CA-8 页面顺序：年度热力 → 全库卡片总览 → 时间轴/卡片分析；默认卡片分析且时间轴保留显式深链；PiOverview 不再挂载，热力图不再承载四格；唯一 AI 入口按当前卡型切换 facts', () => {
  const heatAt = PROFILE.indexOf('<PiAnnualHeatmap')
  const pulseAt = PROFILE.indexOf('<PiLibraryPulse')
  const analysisAt = PROFILE.indexOf('<PiCardAnalysis')
  return heatAt >= 0 && pulseAt > heatAt && analysisAt > pulseAt
    && !PROFILE.includes('<PiOverview')
    && !HEATMAP.includes('pi-heat-stats')
    && !HEATMAP.includes('lcCards') && !HEATMAP.includes("emit('drill'")
    && HEATMAP.includes(':show-export="false"') && HEATMAP.includes(':show-toggle="false"')
    && PROFILE.includes("if (route.query.view === 'timeline') return 'timeline'")
    && PROFILE.includes("return 'analysis'")
    && (PROFILE.match(/class="pi-ai-trigger"/g) || []).length === 1
    && PROFILE.includes('watch([profileView, activeCardKind], resetProfileInsight)')
    && PROFILE.includes("if (activeCardKind.value === 'task')")
    && PROFILE.includes("if (activeCardKind.value === 'resource')")
    && PROFILE.includes("if (activeCardKind.value === 'curiosity')")
    && PROFILE.includes('const block = a.topic')
    && PROFILE.includes('PiLibraryPulse')
})

check('V478-CA-9 全库卡片总览主读数齐全：在库总量、近 12 个月活跃、高价值冷却、有效资源支撑率、近 30 天精力落主攻；次级含本月、四卡、标签、活跃天、最长连续、有效动作、峰值、P90、起始日；标签熵覆盖四类卡且非下钻卡不渲染为按钮', () =>
  PULSE.includes('全库卡片总览')
  && PULSE.includes('{{ total.toLocaleString() }}')
  && PULSE.includes('近 12 个月活跃资产')
  && PULSE.includes('高价值冷却')
  && PULSE.includes('任务有有效资源支撑')
  && PULSE.includes('近 30 天精力落主攻')
  && PULSE.includes('本月 +{{ analysis.inventory.monthAdded }}')
  && PULSE.includes('composition')
  && PULSE.includes('标签分布')
  && PULSE.includes('本年活跃')
  && PULSE.includes('最长连续')
  && PULSE.includes('有效动作')
  && PULSE.includes('单日峰值')
  && PULSE.includes('P90')
  && PULSE.includes('调出完整起始日')
  && PULSE.includes('stats.fullSince')
  && PULSE.includes('v-for="metric in metrics"')
  && PULSE.includes('v-if="metric.drill"')
  && PULSE.includes('v-else')
  && !PULSE.includes(':disabled=')
  && PROFILE.includes('const libraryTagLists = computed')
  && PROFILE.includes('cardAnalysis.value.inventory.live.curiosities.map(card => card.tags || [])')
  && PROFILE.includes(':entropy="libraryTagEntropy"')
  && PROFILE.includes(':curiosities="gCurioLive"') && PROFILE.includes(':topics="gTopicLive"'))

check('V478-CA-10 四卡页签带在库数量，role=tablist / role=tab / aria-selected / tabindex 跟随；方向键循环 + Home / End 直达首尾', () =>
  ANALYSIS.includes('role="tablist"') && ANALYSIS.includes('aria-label="卡片类型"')
  && (ANALYSIS.match(/role="tab"/g) || []).length === 1
  && ANALYSIS.includes(':aria-selected="kind === tab.key"')
  && ANALYSIS.includes(':tabindex="kind === tab.key ? 0 : -1"')
  && ANALYSIS.includes('analysis.kindCounts[tab.key]')
  && ANALYSIS.includes("event.key === 'ArrowRight'")
  && ANALYSIS.includes("event.key === 'ArrowLeft'")
  && ANALYSIS.includes("event.key === 'Home'")
  && ANALYSIS.includes("event.key === 'End'")
  && ANALYSIS.includes('role="tabpanel"')
  && ANALYSIS.includes('任务卡') && ANALYSIS.includes('资源卡')
  && ANALYSIS.includes('好奇心卡') && ANALYSIS.includes('选题卡'))

check('V478-CA-11 四页签统一「首层读数 → 结构与分布 → 行动与质量 → 明细清单」；首层数字可点击切筛选，四类筛选键齐全', () =>
  ANALYSIS.includes('class="pi-ca-summary"')
  && ANALYSIS.includes(':data-summary-filter="item.filter"')
  // V4.7.8 重指：首层汇总用独立 activeSummary 高亮，避免“平均进入/最高进入”共用同一 filter 时同时点亮。
  && ANALYSIS.includes('@click="!item.disabled && setSummaryFilter(kind, item)"')
  && ANALYSIS.includes(':aria-pressed="item.disabled ? undefined : activeSummary[kind] === item.label"')
  && ['unprojected', 'unscheduled', 'never-focus', 'focus-max', 'no-support', 'conflict', 'task-used', 'zero-ref', 'recent30', 'stale', 'source', 'assets', 'completed', 'supported', 'month-added', 'recent30-added'].every(key => ANALYSIS.includes(`'${key}'`))
  && ANALYSIS.includes('class="pi-filter-bar"')
  && ANALYSIS.includes('class="pi-evidence-panel"')
  && ANALYSIS.includes('项目 · 指标分布')
  && ANALYSIS.includes('计划覆盖')
  && ANALYSIS.includes('进入三件事频次')
  && ANALYSIS.includes('资源支撑')
  && ANALYSIS.includes('链接结构与常用夹')
  && ANALYSIS.includes('引用与唤醒')
  && ANALYSIS.includes('问题状态构成')
  && ANALYSIS.includes('行动与成果路径'))

check('V478-CA-12 三件事持续推进与 LifecyclePanel 保留，但整体位于四卡分析之后；好奇心不伪造项目/指标分组，三件事显示为不适用', () => {
  const tabsAt = ANALYSIS.indexOf('pi-kind-tabs')
  const focusAt = ANALYSIS.indexOf('pi-focus-analysis')
  const lifecycleAt = ANALYSIS.indexOf('id="lc-sec"')
  return tabsAt > 0 && focusAt > tabsAt && lifecycleAt > focusAt
    && ANALYSIS.includes('三件事，是否持续推进')
    && ANALYSIS.includes('资源生命周期与高价值沉睡证据唤醒')
    && ANALYSIS.includes('<LifecyclePanel')
    && ANALYSIS.includes('好奇心卡没有项目 / 指标字段，不做伪分组')
    && ANALYSIS.includes("label: '进入三件事', note: '历史频次仅任务 / 选题', filter: '', disabled: true")
})

/* ============ ③ 详情抽屉与模板编译 ============ */

check('V478-CA-13 任务 / 选题详情抽屉：四枚可点击汇总 + 安排历程 + 三件事时间轴 + 关联资源 + 项目指标；有效资源按活资源且有可用链接统计', () =>
  TASK_DRAWER.includes('class="ts-drawer-summary"')
  && TASK_DRAWER.includes('data-detail-filter="plan"')
  && TASK_DRAWER.includes('data-detail-filter="focus"')
  && TASK_DRAWER.includes('data-detail-filter="resources"')
  && TASK_DRAWER.includes('data-detail-filter="owner"')
  && TASK_DRAWER.includes('<PlanScheduleHistory')
  && TASK_DRAWER.includes('<CardFocusHistory')
  && TASK_DRAWER.includes('hasUsableResourceLink')
  && TASK_DRAWER.includes('selProjectId || selMetricId')
  && TOPIC_DRAWER.includes('class="topic-detail-summary"')
  && TOPIC_DRAWER.includes('data-detail-filter="plan"')
  && TOPIC_DRAWER.includes('<PlanScheduleHistory')
  && TOPIC_DRAWER.includes('<CardFocusHistory')
  && TOPIC_DRAWER.includes('hasUsableResourceLink')
  && TOPIC_DRAWER.includes('projectId || metricId')
  && FOCUS_HISTORY.includes('buildFocusUsage')
  && FOCUS_HISTORY.includes('同一卡同一天只计一次')
  && FOCUS_HISTORY.includes('计划事件不算三件事'))

check('V478-CA-14 新组件真 SFC 编译通过且关键节点进入编译产物；样式只用 tokens.css 语义令牌，不写硬编码色值', () => {
  const compiled = compileSfc('/newtab/components/profile/PiCardAnalysis.vue', ['pi-kind-tabs', 'pi-ca-summary', 'pi-focus-analysis', 'lc-sec'])
    && compileSfc('/newtab/components/profile/PiLibraryPulse.vue', ['pi-pulse-main', 'pi-pulse-foot', 'pi-pulse-tags'])
    && compileSfc('/newtab/components/compass/CardFocusHistory.vue', ['cfh-timeline', 'cfh-note'])
  const hardcoded = /#[0-9a-f]{3,8}\b|\brgb\s*\(|\bhsl\s*\(/i
  return compiled
    && ![ANALYSIS, PULSE, FOCUS_HISTORY, TASK_DRAWER, TOPIC_DRAWER].some(source => hardcoded.test(styleBlock(source)))
    && ANALYSIS.includes('var(--accent)') && ANALYSIS.includes('var(--border)')
    && PULSE.includes('var(--accent-light)') && PULSE.includes('var(--surface-2)')
})

check('V478-CA-15 旧断言按新拍板重指且保留备案：165 / 167 / 19 / 110 / 12 均不删除、不靠放宽转绿', () =>
  OLD_165.includes('V4.7.8 重指备案') && OLD_165.includes('!ANNUAL.includes(\'pi-heat-stats\')')
  && OLD_167.includes('V4.7.8 重指备案') && OLD_167.includes('!HEATMAP.includes(\'pi-heat-stats\')')
  && OLD_19.includes('V4.7.8 重指备案') && OLD_19.includes("!ANALYSIS.includes('<PiOverview')")
  && OLD_110.includes('V4.7.8 再重指备案') && OLD_110.includes('data-detail-filter')
  && OLD_12.includes('V4.7.8 重指备案') && OLD_12.includes(':today-import="todayImportCount"')
  && !OLD_165.includes('旧断言删除') && !OLD_167.includes('旧断言删除'))

check('V478-CA-16 任务资源证据校验 subId：只接受仍挂在同一活任务下的子任务，悬空或错属子任务不进入支撑与引用', () => {
  if (!A) {
    return TASK_EVIDENCE.includes('taskIdBySubId')
      && TASK_EVIDENCE.includes('link.subId && taskIdBySubId.get(link.subId) !== link.taskId')
  }
  const data = baseData({
    resources: [card('r1', 'resource', { link: 'https://a', linkType: 'url' })],
    tasks: [
      card('t1', 'task', { subtasks: [{ id: 's1', title: '有效子任务', done: false }] }),
      card('t2', 'task', { subtasks: [{ id: 's2', title: '另一任务的子任务', done: false }] }),
    ],
    supportLinks: [
      { id: 'link-valid', taskId: 't1', subId: 's1', resourceId: 'r1', from: 'manual', createdAt: NOW },
      { id: 'link-orphan', taskId: 't1', subId: 'missing', resourceId: 'r1', from: 'manual', createdAt: NOW },
      { id: 'link-wrong-parent', taskId: 't1', subId: 's2', resourceId: 'r1', from: 'manual', createdAt: NOW },
    ],
  })
  const index = A.buildTaskEvidence(data)
  return index.taskSupportLinks.get('t1')?.length === 1
    && index.taskSupportLinks.get('t1')?.[0]?.id === 'link-valid'
    && index.taskResourceIds.get('t1')?.size === 1
    && index.resourceRefs.get('r1')?.taskIds.size === 1
})

check('V478-CA-17 审计修复锁：主攻投入只走 ownership.byTask 的有效 projectId；选题本月按自然月、近 30 天独立滚动窗口；选题归属补 metric.topicIds 唯一回退；列表行仅内部按钮可聚焦', () =>
  USE.includes('const projectId = ownership.value.byTask.get(event.cardId)?.projectId')
  && !USE.includes('computeMainFocusShare(')
  && USE.includes('const monthStart = monthStartAt(now)')
  && USE.includes('monthAdded: (card.createdAt || 0) >= monthStart')
  && USE.includes('const recentFrom = now - 30 * DAY_MS')
  && USE.includes('recent30Added: (card.createdAt || 0) >= recentFrom')
  && USE.includes('const monthAddedCount = rows.filter(row => row.monthAdded)')
  && USE.includes('const recent30AddedCount = rows.filter(row => row.recent30Added)')
  && USE.includes('const topicIds = topicIdsByMetric.get(card.id) || []')
  && USE.includes('(topicIds.length === 1 ? metricById.get(topicIds[0]) : undefined)')
  && USE.includes('for (const topicId of metric.topicIds || [])')
  && !/<tr[^>]*@click=/.test(ANALYSIS)
  && ANALYSIS.includes('@click.stop="emit(\'open-card\', { kind: \'task\', id: row.id })"')
  && ANALYSIS.includes(":aria-pressed=\"item.disabled ? undefined : activeSummary[kind] === item.label\""))

check('V478-CA-18 有效支撑下钻与全库总览同源：活任务 × 活资源 × 可用链接；标题、清单行数、支撑率与对账条共用同一任务证据索引', () =>
  PULSE.includes("drill: 'effective-support'")
  && PULSE.includes("key === 'effective-support'")
  && PROFILE.includes("if (key === 'effective-support') { openStatDrawer('effective-support'); return }")
  && PROFILE_USE.includes("| 'effective-support'")
  && PROFILE_USE.includes('const taskEvidence = computed(() => buildTaskEvidence(gd.value))')
  && PROFILE_USE.includes('const heroSupportRate = computed(() => taskEvidence.value.effectiveTaskSupportRate)')
  && PROFILE_USE.includes('const supportedTaskIds = computed(() => taskEvidence.value.taskIdsWithEffectiveSupport)')
  && PROFILE_USE.includes("case 'effective-support': return gTaskLive.value")
  && PROFILE_USE.includes('.filter(t => supportedTaskIds.value.has(t.id))')
  && PROFILE_USE.includes('owner: `有效资源 ${taskEvidence.value.taskResourceIds.get(t.id)?.size || 0} 张`')
  && PROFILE_TAGS.includes("'effective-support': `任务有有效资源支撑明细（${statList.value.length} / ${gTaskLive.value.length} 张活任务）`")
  && PROFILE_TAGS.includes("cell('有效支撑率', heroSupportRate.value, '%')")
  && PROFILE_TAGS.includes("cell('有有效资源', supportedTasks, '个')")
  && PROFILE_TAGS.includes('有效支撑 = 活任务 × 活资源 × 资源当前有可用链接'))

check('V478-CA-19 最高进入不是“曾进入”泛筛选：任务与选题均按 row.focusCount === block.focusMax 精确命中，两页汇总均接 focus-max', () =>
  ANALYSIS.includes("if (key === 'focus-max') return row.focusCount === props.analysis.task.focusMax")
  && ANALYSIS.includes("if (key === 'focus-max') return row.focusCount === props.analysis.topic.focusMax")
  && ANALYSIS.includes("{ value: block.focusMax, suffix: '次', label: '最高进入', note: '单任务最高', filter: 'focus-max' }")
  && ANALYSIS.includes("{ value: block.focusMax, suffix: '次', label: '最高进入', note: '单选题最高', filter: 'focus-max' }")
  && (ANALYSIS.match(/filter: 'focus-max'/g) || []).length === 2
  && ANALYSIS.includes("counts['focus-max'] += 1"))

check('V478-CA-20 选题指标聚合与自然月 / 滚动 30 天双口径：metricDistribution 可筛选 metric:xxx 并渲染 chips，本月 +N 只读自然月', () =>
  USE.includes('metricDistribution: AnalysisBar[]')
  && USE.includes('const metricCount = new Map<string, number>()')
  && USE.includes("const metricKey = metric?.id || '__unassigned'")
  && USE.includes('metricDistribution,')
  && TOPIC_MATCHES.includes("if (key.startsWith('metric:')) return (row.metricId || '__unassigned') === key.slice(7)")
  && ANALYSIS.includes('analysis.topic.metricDistribution')
  && ANALYSIS.includes("setFilter('topic', `metric:${item.key}`, item.label)")
  && ANALYSIS.includes('note: `本月 +${block.monthAddedCount}`')
  && ANALYSIS.includes("{ value: block.monthAddedCount, suffix: '张', label: '本月新增', note: '自然月 1 日起', filter: 'month-added' }")
  && ANALYSIS.includes("{ value: block.recent30AddedCount, suffix: '张', label: '近 30 天新增', note: '滚动 30 天', filter: 'recent30-added' }")
  && ANALYSIS.includes("if (key === 'month-added') return row.monthAdded")
  && ANALYSIS.includes("if (key === 'recent30-added') return row.recent30Added")
  && PROFILE.includes('本月新增 ${block.monthAddedCount} 张；近 30 天新增 ${block.recent30AddedCount} 张'))
