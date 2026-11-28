<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import LifecyclePanel, { type LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'
import { focusDayUsage, focusWeekRows, focusWindowSummary } from '@/shared/analytics/focusUsage'
import type {
  AnalysisBar,
  CardAnalysisKind,
  CardAnalysisModel,
  CuriosityAnalysisRow,
  ResourceAnalysisRow,
  TaskAnalysisRow,
  TopicAnalysisRow,
} from '@/newtab/views/useCardAnalysis'

interface SummaryItem {
  value: number | string
  suffix: string
  label: string
  note: string
  filter: string
  disabled?: boolean
}

const props = defineProps<{
  analysis: CardAnalysisModel
  kind: CardAnalysisKind
  lcCards: LifecycleCard[]
  focusFilter?: 'active' | 'cooling' | 'archived'
}>()

const emit = defineEmits<{
  (e: 'update:kind', kind: CardAnalysisKind): void
  (e: 'open-card', payload: { kind: CardAnalysisKind; id: string }): void
  (e: 'lc-locate', id: string, kind: LifecycleCard['kind']): void
  (e: 'lc-archive', id: string): void
  (e: 'lc-snooze', id: string): void
  (e: 'lc-reactivate', id: string): void
  (e: 'lc-set-days', id: string, days: number | null): void
  (e: 'lc-settings'): void
}>()

const tabs: Array<{ key: CardAnalysisKind; glyph: string; title: string; sub: string }> = [
  { key: 'task', glyph: '任', title: '任务卡', sub: '方向归位 → 计划 → 兑现' },
  { key: 'resource', glyph: '资', title: '资源卡', sub: '调用、引用与唤醒' },
  { key: 'curiosity', glyph: '奇', title: '好奇心卡', sub: '问题推进与求证' },
  { key: 'topic', glyph: '题', title: '选题卡', sub: '落图、支撑与成果' },
]

const tabIds = (kind: CardAnalysisKind) => `pi-kind-tab-${kind}`
const panelIds = (kind: CardAnalysisKind) => `pi-kind-panel-${kind}`
const tabButtons = ref<Record<string, HTMLButtonElement | null>>({})
const activeFilter = reactive<Record<CardAnalysisKind, string>>({
  task: 'all',
  resource: 'all',
  curiosity: 'all',
  topic: 'all',
})
const activeSummary = reactive<Record<CardAnalysisKind, string>>({
  task: '',
  resource: '',
  curiosity: '',
  topic: '',
})
const activeFilterLabel = reactive<Record<CardAnalysisKind, string>>({
  task: '',
  resource: '',
  curiosity: '',
  topic: '',
})

function setKind(kind: CardAnalysisKind): void {
  emit('update:kind', kind)
}

function moveTab(kind: CardAnalysisKind, target: CardAnalysisKind): void {
  emit('update:kind', target)
  requestAnimationFrame(() => tabButtons.value[target]?.focus())
}

function onTabKeydown(event: KeyboardEvent, kind: CardAnalysisKind): void {
  const index = tabs.findIndex(tab => tab.key === kind)
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    moveTab(kind, tabs[(index + 1) % tabs.length].key)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    moveTab(kind, tabs[(index - 1 + tabs.length) % tabs.length].key)
  } else if (event.key === 'Home') {
    event.preventDefault()
    moveTab(kind, tabs[0].key)
  } else if (event.key === 'End') {
    event.preventDefault()
    moveTab(kind, tabs[tabs.length - 1].key)
  }
}

function setFilter(kind: CardAnalysisKind, key: string, label = ''): void {
  activeFilter[kind] = key
  activeSummary[kind] = ''
  activeFilterLabel[kind] = key === 'all' ? '' : label
}

function setSummaryFilter(kind: CardAnalysisKind, item: SummaryItem): void {
  activeFilter[kind] = item.filter
  activeSummary[kind] = item.label
  activeFilterLabel[kind] = item.label
}

type FilterOption = { key: string; label: string; count: number }

const taskFilterCounts = computed(() => {
  const counts: Record<string, number> = {
    all: props.analysis.task.rows.length,
    done: 0,
    attached: 0,
    scheduled: 0,
    entered: 0,
    'focus-max': 0,
    unprojected: 0,
    unscheduled: 0,
    'never-focus': 0,
    'no-support': 0,
    conflict: 0,
  }
  for (const row of props.analysis.task.rows) {
    if (row.done) counts.done += 1
    if (row.attached) counts.attached += 1
    if (row.scheduled) counts.scheduled += 1
    else counts.unscheduled += 1
    if (row.focusCount > 0) counts.entered += 1
    else counts['never-focus'] += 1
    if (row.focusCount === props.analysis.task.focusMax) counts['focus-max'] += 1
    if (!row.projectId) counts.unprojected += 1
    if (row.supportCount === 0) counts['no-support'] += 1
    if (row.conflict) counts.conflict += 1
  }
  return counts
})

const resourceFilterCounts = computed(() => {
  const counts: Record<string, number> = {
    all: props.analysis.resource.rows.length,
    linked: 0,
    'no-link': 0,
    'task-used': 0,
    'zero-ref': 0,
    recent30: 0,
    'never-used': 0,
    'high-cooling': 0,
  }
  for (const row of props.analysis.resource.rows) {
    if (row.hasLink) counts.linked += 1
    else counts['no-link'] += 1
    if (row.taskRefs > 0) counts['task-used'] += 1
    if (row.zeroReference) counts['zero-ref'] += 1
    if (row.recentCalled) counts.recent30 += 1
    if (row.callCount === 0) counts['never-used'] += 1
    if (row.highValueCooling) counts['high-cooling'] += 1
  }
  return counts
})

const curiosityFilterCounts = computed(() => {
  const counts: Record<string, number> = {
    all: props.analysis.curiosity.rows.length,
    todo: 0,
    doing: 0,
    done: 0,
    shelf: 0,
    planned: 0,
    source: 0,
    support: 0,
    assets: 0,
    'no-source': 0,
    'no-support': 0,
    converted: 0,
    stale: 0,
    'no-assets': 0,
  }
  for (const row of props.analysis.curiosity.rows) {
    counts[row.status] += 1
    if (row.planned) counts.planned += 1
    if (row.hasSource) counts.source += 1
    else counts['no-source'] += 1
    if (row.assetCount > 0) counts.assets += 1
    else counts['no-assets'] += 1
    if (row.supportCount > 0) counts.support += 1
    else counts['no-support'] += 1
    if (row.converted) counts.converted += 1
    if (row.stale) counts.stale += 1
  }
  return counts
})

const topicFilterCounts = computed(() => {
  const counts: Record<string, number> = {
    all: props.analysis.topic.rows.length,
    completed: 0,
    planned: 0,
    entered: 0,
    'focus-max': 0,
    attached: 0,
    supported: 0,
    'no-support': 0,
    'month-added': 0,
    'recent30-added': 0,
    unprojected: 0,
    unscheduled: 0,
    'never-focus': 0,
  }
  for (const row of props.analysis.topic.rows) {
    if (row.terminal) counts.completed += 1
    if (row.scheduled) counts.planned += 1
    else counts.unscheduled += 1
    if (row.focusCount > 0) counts.entered += 1
    else counts['never-focus'] += 1
    if (row.focusCount === props.analysis.topic.focusMax) counts['focus-max'] += 1
    if (row.attached) counts.attached += 1
    if (!row.projectId) counts.unprojected += 1
    if (row.supportCount > 0) counts.supported += 1
    else counts['no-support'] += 1
    if (row.monthAdded) counts['month-added'] += 1
    if (row.recent30Added) counts['recent30-added'] += 1
  }
  return counts
})

function options(labels: Array<[string, string]>, counts: Record<string, number>): FilterOption[] {
  return labels.map(([key, label]) => ({ key, label, count: counts[key] || 0 }))
}

const taskFilters = computed(() => options([
  ['all', '全部'],
  ['unprojected', '未挂项目'],
  ['unscheduled', '未落图'],
  ['never-focus', '从未进入'],
  ['no-support', '无有效资源'],
  ['conflict', '归属冲突'],
  ['done', '已完成'],
  ['attached', '已归属'],
  ['scheduled', '已落图'],
  ['entered', '曾进入'],
  ['focus-max', '最高进入'],
], taskFilterCounts.value))

const resourceFilters = computed(() => options([
  ['all', '全部'],
  ['never-used', '从未调用'],
  ['no-link', '无链接'],
  ['high-cooling', '高价值冷却'],
  ['task-used', '支撑任务'],
  ['zero-ref', '零引用'],
  ['linked', '链接可用'],
  ['recent30', '近 30 天调出'],
], resourceFilterCounts.value))

const curiosityFilters = computed(() => options([
  ['all', '全部'],
  ['stale', '超过 30 天未动'],
  ['no-source', '无来源'],
  ['source', '有来源'],
  ['support', '有资源'],
  ['no-support', '无资源'],
  ['converted', '已转化'],
  ['doing', '探索中'],
  ['done', '已求证'],
  ['shelf', '已搁置'],
  ['planned', '有计划'],
  ['assets', '有附件'],
  ['no-assets', '无附件'],
], curiosityFilterCounts.value))

const topicFilters = computed(() => options([
  ['all', '全部'],
  ['unprojected', '未挂项目'],
  ['unscheduled', '未落图'],
  ['never-focus', '从未进入'],
  ['no-support', '无资源支撑'],
  ['completed', '完成 / 发布态'],
  ['planned', '有计划'],
  ['attached', '已归属'],
  ['entered', '曾进入'],
  ['focus-max', '最高进入'],
  ['supported', '有资源支撑'],
  ['month-added', '本月新增'],
  ['recent30-added', '近 30 天新增'],
], topicFilterCounts.value))

function taskMatches(row: TaskAnalysisRow, key: string): boolean {
  if (key === 'all') return true
  if (key.startsWith('project:')) return (row.projectId || '__unassigned') === key.slice(8)
  if (key.startsWith('metric:')) return (row.metricId || '__unassigned') === key.slice(7)
  if (key.startsWith('status:')) return row.statusId === key.slice(7)
  if (key === 'done') return row.done
  if (key === 'attached') return row.attached
  if (key === 'scheduled') return row.scheduled
  if (key === 'entered') return row.focusCount > 0
  if (key === 'focus-max') return row.focusCount === props.analysis.task.focusMax
  if (key === 'unprojected') return !row.projectId
  if (key === 'unscheduled') return !row.scheduled
  if (key === 'never-focus') return row.focusCount === 0
  if (key === 'no-support') return row.supportCount === 0
  if (key === 'conflict') return row.conflict
  return true
}

function resourceMatches(row: ResourceAnalysisRow, key: string): boolean {
  if (key === 'all') return true
  if (key.startsWith('link:')) return row.linkKind === key.slice(5)
  if (key.startsWith('folder:')) {
    const folderId = key.slice(7)
    return folderId === '__unfiled' ? row.folderIds.length === 0 : row.folderIds.includes(folderId)
  }
  if (key === 'never-used') return row.callCount === 0
  if (key === 'no-link') return !row.hasLink
  if (key === 'high-cooling') return row.highValueCooling
  if (key === 'task-used') return row.taskRefs > 0
  if (key === 'zero-ref') return row.zeroReference
  if (key === 'linked') return row.hasLink
  if (key === 'recent30') return row.recentCalled
  return true
}

function curiosityMatches(row: CuriosityAnalysisRow, key: string): boolean {
  if (key === 'all') return true
  if (key === 'stale') return row.stale
  if (key === 'no-source') return !row.hasSource
  if (key === 'source') return row.hasSource
  if (key === 'support') return row.supportCount > 0
  if (key === 'no-support') return row.supportCount === 0
  if (key === 'converted') return row.converted
  if (key === 'planned') return row.planned
  if (key === 'assets') return row.assetCount > 0
  if (key === 'no-assets') return row.assetCount === 0
  return row.status === key
}

function topicMatches(row: TopicAnalysisRow, key: string): boolean {
  if (key === 'all') return true
  if (key.startsWith('topic-status:')) return row.statusId === key.slice(13)
  if (key.startsWith('topic-project:')) return (row.projectId || '__unassigned') === key.slice(14)
  if (key.startsWith('metric:')) return (row.metricId || '__unassigned') === key.slice(7)
  if (key === 'completed') return row.terminal
  if (key === 'planned') return row.scheduled
  if (key === 'entered') return row.focusCount > 0
  if (key === 'focus-max') return row.focusCount === props.analysis.topic.focusMax
  if (key === 'attached') return row.attached
  if (key === 'supported') return row.supportCount > 0
  if (key === 'no-support') return row.supportCount === 0
  if (key === 'month-added') return row.monthAdded
  if (key === 'recent30-added') return row.recent30Added
  if (key === 'unprojected') return !row.projectId
  if (key === 'unscheduled') return !row.scheduled
  if (key === 'never-focus') return row.focusCount === 0
  if (key === 'outcome') return row.hasOutcome
  return true
}

const taskRows = computed(() =>
  props.analysis.task.rows.filter(row => taskMatches(row, activeFilter.task)))
const resourceRows = computed(() =>
  props.analysis.resource.rows.filter(row => resourceMatches(row, activeFilter.resource)))
const curiosityRows = computed(() =>
  props.analysis.curiosity.rows.filter(row => curiosityMatches(row, activeFilter.curiosity)))
const topicRows = computed(() =>
  props.analysis.topic.rows.filter(row => topicMatches(row, activeFilter.topic)))

const taskSummary = computed<SummaryItem[]>(() => {
  const block = props.analysis.task
  return [
    { value: block.liveCount, suffix: '张', label: '在库任务', note: `本月 +${block.monthAdded}`, filter: 'all' },
    { value: block.doneCount, suffix: '张', label: '已完成', note: `完成率 ${block.doneRate}%`, filter: 'done' },
    { value: block.attachedCount, suffix: '张', label: '挂项目 / 指标', note: `${block.metricAttachedCount} 张已挂指标`, filter: 'attached' },
    { value: block.scheduledCount, suffix: '张', label: '已落图', note: `${block.unscheduledCount} 张未落图`, filter: 'scheduled' },
    { value: block.focusEnteredCount, suffix: '张', label: '曾进入三件事', note: '真实 active slots', filter: 'entered' },
    { value: block.focusNeverCount, suffix: '张', label: '从未进入', note: '计划事件不算三件事', filter: 'never-focus' },
    { value: block.focusAverageEntered, suffix: '次', label: '平均进入', note: `全库摊平 ${block.focusAverageAll} 次`, filter: 'entered' },
    { value: block.focusMax, suffix: '次', label: '最高进入', note: '单任务最高', filter: 'focus-max' },
    { value: block.noSupportCount, suffix: '张', label: '无有效资源', note: '活任务缺活资源', filter: 'no-support' },
    { value: block.conflictCount, suffix: '张', label: '归属冲突', note: `含 ${block.ambiguousCount} 张歧义`, filter: 'conflict' },
  ]
})

const resourceSummary = computed<SummaryItem[]>(() => {
  const block = props.analysis.resource
  return [
    { value: block.liveCount, suffix: '张', label: '在库资源', note: `本月 +${block.monthAdded}`, filter: 'all' },
    { value: block.linkedCount, suffix: '张', label: '链接可用', note: 'link 或三槽任一非空', filter: 'linked' },
    { value: block.noLinkCount, suffix: '张', label: '无链接', note: '无法从资源侧直达', filter: 'no-link' },
    { value: block.taskReferencedCount, suffix: '张', label: '被活任务引用', note: '当前关系表', filter: 'task-used' },
    { value: block.zeroReferenceCount, suffix: '张', label: '零引用', note: '任务 / 选题 / 好奇心', filter: 'zero-ref' },
    { value: block.recentCalledCount, suffix: '张', label: '近 30 天调出', note: '真实 call 事件', filter: 'recent30' },
  ]
})

const curiositySummary = computed<SummaryItem[]>(() => {
  const block = props.analysis.curiosity
  return [
    { value: block.liveCount, suffix: '张', label: '在库好奇心', note: `待探索 ${block.todoCount} 张`, filter: 'all' },
    { value: block.doingCount, suffix: '张', label: '探索中', note: '当前状态桶', filter: 'doing' },
    { value: block.doneCount, suffix: '张', label: '已求证', note: '当前状态桶', filter: 'done' },
    { value: block.shelfCount, suffix: '张', label: '已搁置', note: '当前状态桶', filter: 'shelf' },
    { value: block.plannedCount, suffix: '张', label: '有计划', note: '已写 plan 日期', filter: 'planned' },
    { value: '—', suffix: '', label: '进入三件事', note: '历史频次仅任务 / 选题', filter: '', disabled: true },
    { value: block.sourcedCount, suffix: '张', label: '有来源', note: 'sourceUrl 非空', filter: 'source' },
    { value: block.assetCount, suffix: '张', label: '有附件', note: '资产元数据非空', filter: 'assets' },
    { value: block.convertedCount, suffix: '张', label: '已转化', note: '独立事实，不混入状态', filter: 'converted' },
  ]
})

const topicSummary = computed<SummaryItem[]>(() => {
  const block = props.analysis.topic
  return [
    { value: block.liveCount, suffix: '张', label: '在库选题', note: `本月 +${block.monthAddedCount}`, filter: 'all' },
    { value: block.completedCount, suffix: '张', label: '完成 / 发布态', note: `成果链接 ${block.outcomeCount} 张，不等同发布`, filter: 'completed' },
    { value: block.plannedCount, suffix: '张', label: '有计划', note: '当前 dueDate 非空', filter: 'planned' },
    { value: block.focusEnteredCount, suffix: '张', label: '进入三件事', note: `平均 ${block.focusAverageEntered} 次`, filter: 'entered' },
    { value: block.focusMax, suffix: '次', label: '最高进入', note: '单选题最高', filter: 'focus-max' },
    { value: block.attachedCount, suffix: '张', label: '挂项目 / 指标', note: '单一归属', filter: 'attached' },
    { value: block.supportedCount, suffix: '张', label: '资源支撑', note: '当前 topicResourceLinks', filter: 'supported' },
    { value: block.monthAddedCount, suffix: '张', label: '本月新增', note: '自然月 1 日起', filter: 'month-added' },
    { value: block.recent30AddedCount, suffix: '张', label: '近 30 天新增', note: '滚动 30 天', filter: 'recent30-added' },
  ]
})

const currentSummary = computed<SummaryItem[]>(() => {
  if (props.kind === 'task') return taskSummary.value
  if (props.kind === 'resource') return resourceSummary.value
  if (props.kind === 'curiosity') return curiositySummary.value
  return topicSummary.value
})

const currentFilters = computed(() => {
  if (props.kind === 'task') return taskFilters.value
  if (props.kind === 'resource') return resourceFilters.value
  if (props.kind === 'curiosity') return curiosityFilters.value
  return topicFilters.value
})

const currentRowCount = computed(() => {
  if (props.kind === 'task') return taskRows.value.length
  if (props.kind === 'resource') return resourceRows.value.length
  if (props.kind === 'curiosity') return curiosityRows.value.length
  return topicRows.value.length
})

const currentFilterLabel = computed(() => {
  const fixed = currentFilters.value.find(item => item.key === activeFilter[props.kind])
  return fixed?.label || activeFilterLabel[props.kind] || '当前条件'
})

const topBars = (bars: AnalysisBar[], limit = 7): AnalysisBar[] => bars.slice(0, limit)

const focus30 = computed(() => focusWindowSummary(props.analysis.focus, Date.now(), 30))
const todayFocus = computed(() => focusDayUsage(props.analysis.focus, new Date().toLocaleDateString('sv-SE')))
const week = computed(() => focusWeekRows(props.analysis.focus, Date.now(), 7))
const completionRate = computed(() =>
  focus30.value.planned ? Math.round(focus30.value.done / focus30.value.planned * 100) : 0)

function fmtDueDate(date: string): string {
  if (!date) return '未落图'
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return parts ? `${Number(parts[2])} 月 ${Number(parts[3])} 日` : date
}

function fmtRelative(ts?: number): string {
  if (!ts) return '从未'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  return days <= 0 ? '今天' : `${days} 天前`
}
</script>

<template>
  <div class="pi-card-analysis" data-card-analysis>
    <section class="pi-ca-shell">
      <header class="pi-ca-head">
        <div>
          <span class="pi-ca-eyebrow">CARD ANALYSIS · 卡片分析</span>
          <h2>按卡型看结构，也看它如何进入行动</h2>
          <p>每类卡片独立回答：存量多少、分布在哪、推进到哪、是否被真实调用、证据链是否完整。</p>
        </div>
        <span class="pi-ca-scope"><Icon name="calendar" :size="12" /> 当前快照 · 排除回收站</span>
      </header>

      <div class="pi-kind-tabs" role="tablist" aria-label="卡片类型">
        <button
          v-for="tab in tabs"
          :id="tabIds(tab.key)"
          :key="tab.key"
          :ref="element => { tabButtons[tab.key] = element as HTMLButtonElement | null }"
          type="button"
          class="pi-kind-tab"
          :class="{ on: kind === tab.key }"
          role="tab"
          :aria-selected="kind === tab.key"
          :aria-controls="panelIds(tab.key)"
          :tabindex="kind === tab.key ? 0 : -1"
          :data-kind="tab.key"
          @click="setKind(tab.key)"
          @keydown="onTabKeydown($event, tab.key)"
        >
          <span class="pi-kind-glyph">{{ tab.glyph }}</span>
          <span class="pi-kind-copy"><strong>{{ tab.title }}</strong><small>{{ tab.sub }}</small></span>
          <span class="pi-kind-count">{{ analysis.kindCounts[tab.key] }}</span>
        </button>
      </div>

      <section
        :id="panelIds(kind)"
        class="pi-ca-panel"
        role="tabpanel"
        :aria-labelledby="tabIds(kind)"
        :data-card-kind="kind"
      >
        <div class="pi-ca-summary" :class="`is-${kind}`">
          <button
            v-for="(item, index) in currentSummary"
            :key="`${kind}-${index}`"
            type="button"
            class="pi-ca-kpi"
            :class="{ on: !item.disabled && activeSummary[kind] === item.label, muted: item.disabled }"
            :disabled="item.disabled"
            :data-summary-filter="item.filter"
            :title="item.disabled ? item.note : `${item.note} · 点击筛选明细`"
            :aria-pressed="item.disabled ? undefined : activeSummary[kind] === item.label"
            @click="!item.disabled && setSummaryFilter(kind, item)"
          >
            <strong>{{ item.value }}<small v-if="item.suffix">{{ item.suffix }}</small></strong>
            <span>{{ item.label }}</span>
            <em>{{ item.note }}</em>
          </button>
        </div>

        <div v-if="activeFilter[kind] !== 'all'" class="pi-ca-filter-scope" aria-live="polite">
          <span>当前明细筛选：<b>{{ currentFilterLabel }}</b></span>
          <button type="button" @click="setFilter(kind, 'all')">清除筛选</button>
        </div>

        <template v-if="kind === 'task'">
          <div class="pi-ca-grid">
            <section class="pi-ca-sub">
              <header class="pi-ca-subhead">
                <div><h3>项目 · 指标分布</h3><p>按单一归属分桶；歧义卡不重复计数，未归属固定置底。</p></div>
                <span class="pi-ca-tag">{{ analysis.ownership.projectAttachedCount }} 张已挂项目</span>
              </header>
              <div class="pi-bar-list">
                <button
                  v-for="item in topBars(analysis.task.projectDistribution)"
                  :key="item.key"
                  type="button"
                  class="pi-bar-row"
                  @click="setFilter('task', `project:${item.key}`, item.label)"
                >
                  <span class="pi-bar-label">{{ item.label }}</span>
                  <span class="pi-bar-track"><i :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }" /></span>
                  <b>{{ item.count }}</b>
                </button>
              </div>
              <div class="pi-chip-list" aria-label="指标计数">
                <button
                  v-for="item in analysis.task.metricDistribution"
                  :key="item.key"
                  type="button"
                  class="pi-mini-chip"
                  @click="setFilter('task', `metric:${item.key}`, item.label)"
                >
                  {{ item.label }} <b>{{ item.count }}</b>
                </button>
              </div>
            </section>

            <section class="pi-ca-sub soft">
              <header class="pi-ca-subhead">
                <div><h3>状态、计划与兑现</h3><p>完成态读 taskStatuses.bucket；频次只读真实 active slots。</p></div>
              </header>
              <div class="pi-quality-blocks">
                <div>
                  <span class="pi-quality-title">状态分布</span>
                  <div class="pi-bar-list compact">
                    <button v-for="item in analysis.task.statusDistribution" :key="item.key" type="button" class="pi-bar-row"
                      @click="setFilter('task', `status:${item.key}`, item.label)">
                      <span class="pi-bar-label">{{ item.label }}</span>
                      <span class="pi-bar-track"><i :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }" /></span>
                      <b>{{ item.count }}</b>
                    </button>
                  </div>
                </div>
                <div class="pi-mini-grid">
                  <div class="pi-mini-block">
                    <span class="pi-quality-title">计划覆盖</span>
                    <div v-for="item in analysis.task.planCoverage" :key="item.key" class="pi-inline-stat">
                      <span>{{ item.label }}</span><b>{{ item.count }}</b><small>{{ item.pct }}%</small>
                    </div>
                  </div>
                  <div class="pi-mini-block">
                    <span class="pi-quality-title">资源支撑</span>
                    <div v-for="item in analysis.task.supportDistribution" :key="item.key" class="pi-inline-stat">
                      <span>{{ item.label }}</span><b>{{ item.count }}</b><small>{{ item.pct }}%</small>
                    </div>
                  </div>
                </div>
                <div class="pi-frequency">
                  <span class="pi-quality-title">进入三件事频次</span>
                  <div class="pi-segment-track" aria-label="任务进入三件事频次分布">
                    <i v-for="item in analysis.task.focusDistribution" :key="item.key"
                      :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }"
                      :title="`${item.label} · ${item.count} 张`" />
                  </div>
                  <div class="pi-segment-legend">
                    <span v-for="item in analysis.task.focusDistribution" :key="item.key">{{ item.label }} <b>{{ item.count }}</b></span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section class="pi-evidence-panel">
            <header class="pi-ca-subhead">
              <div><h3>任务明细 · 从异常直接追到证据链</h3><p>汇总数字可筛选；点标题打开详情，安排历程、三件事与资源一次看全。</p></div>
              <span class="pi-result-count">{{ currentRowCount }} / {{ analysis.task.liveCount }} 张</span>
            </header>
            <div class="pi-filter-bar" role="group" aria-label="任务筛选">
              <button v-for="item in currentFilters" :key="item.key" type="button" class="pi-filter-chip"
                :class="{ on: activeFilter.task === item.key }" :data-filter="item.key"
                @click="setFilter('task', item.key)">{{ item.label }} <b>{{ item.count }}</b></button>
            </div>
            <div class="pi-table-wrap">
              <table>
                <thead><tr><th>任务</th><th>项目 · 指标</th><th>状态</th><th>三件事</th><th>有效资源</th></tr></thead>
                <tbody>
                  <tr v-for="row in taskRows" :key="row.id">
                    <td>
                      <button type="button" class="pi-row-task" @click.stop="emit('open-card', { kind: 'task', id: row.id })">
                        <strong>{{ row.title }}</strong>
                        <span>{{ row.scheduled ? `计划 ${fmtDueDate(row.dueDate)}` : '未落计划' }} · {{ row.planChanges }} 次安排变更</span>
                      </button>
                    </td>
                    <td>
                      <span :class="{ 'pi-warn-text': !row.projectId }">{{ row.projectName }}</span>
                      <small>{{ row.metricTitle }}</small>
                      <em v-if="row.conflict" class="pi-conflict" :title="row.conflictLabel">归属冲突</em>
                    </td>
                    <td><span class="pi-status" :class="`bucket-${row.statusBucket}`">{{ row.statusName }}</span></td>
                    <td class="num">{{ row.focusCount }} 次</td>
                    <td><span :class="row.supportCount ? 'pi-link-count' : 'pi-warn-text'">{{ row.supportCount }} 张</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!taskRows.length" class="pi-empty">当前筛选下暂无任务。</div>
          </section>
        </template>

        <template v-else-if="kind === 'resource'">
          <div class="pi-ca-grid">
            <section class="pi-ca-sub">
              <header class="pi-ca-subhead">
                <div><h3>链接结构与常用夹</h3><p>链接看当前 link 与三槽链接；常用夹只读当前成员关系。</p></div>
              </header>
              <div class="pi-stack-chart">
                <div class="pi-stack-track" aria-label="资源链接类型构成">
                  <i v-for="item in analysis.resource.linkDistribution" :key="item.key"
                    :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }"
                    :title="`${item.label} · ${item.count} 张`" />
                </div>
                <div class="pi-stack-legend">
                  <button v-for="item in analysis.resource.linkDistribution" :key="item.key" type="button"
                    @click="setFilter('resource', `link:${item.key}`, item.label)">
                    <i :class="`tone-${item.tone || 'accent'}`" />{{ item.label }} <b>{{ item.count }}</b>
                  </button>
                </div>
              </div>
              <div class="pi-bar-list compact folder-list">
                <button v-for="item in analysis.resource.folderDistribution" :key="item.key" type="button" class="pi-bar-row"
                  @click="setFilter('resource', `folder:${item.key}`, item.label)">
                  <span class="pi-bar-label">{{ item.label }}</span>
                  <span class="pi-bar-track"><i :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }" /></span>
                  <b>{{ item.count }}</b>
                </button>
                <div v-if="!analysis.resource.folderDistribution.length" class="pi-inline-empty">尚未建立资源常用夹。</div>
              </div>
            </section>

            <section class="pi-ca-sub soft">
              <header class="pi-ca-subhead">
                <div><h3>引用与唤醒</h3><p>同一资源被多类卡引用时分别列数，不相加冒充任务支撑。</p></div>
                <span class="pi-ca-tag warn">{{ analysis.resource.highValueCoolingCount }} 张高价值冷却</span>
              </header>
              <div class="pi-ref-list">
                <button v-for="row in analysis.resource.highFrequency" :key="row.id" type="button" class="pi-ref-row"
                  @click="emit('open-card', { kind: 'resource', id: row.id })">
                  <span class="pi-ref-title">{{ row.title }}</span>
                  <span class="pi-ref-meta">任务 {{ row.taskRefs }} · 选题 {{ row.topicRefs }} · 好奇 {{ row.curioRefs }}</span>
                  <b>{{ row.totalRefs }} 引用</b>
                </button>
                <div v-if="!analysis.resource.highFrequency.length" class="pi-inline-empty">当前没有资源被任务、选题或好奇心引用。</div>
              </div>
              <div class="pi-cooling-note" :class="{ active: analysis.resource.highValueCoolingCount > 0 }">
                <Icon name="warn" :size="13" />
                <span><b>高价值冷却</b> = 生命周期处于冷却期且历史调用 ≥ 3 次；仍需人工唤醒，不自动判定失效。</span>
              </div>
            </section>
          </div>

          <section class="pi-evidence-panel">
            <header class="pi-ca-subhead">
              <div><h3>资源清单 · 优先看未调用与高价值冷却</h3><p>点标题查看详情；引用数字表示当前有效关系，解绑后会立即回落。</p></div>
              <span class="pi-result-count">{{ currentRowCount }} / {{ analysis.resource.liveCount }} 张</span>
            </header>
            <div class="pi-filter-bar" role="group" aria-label="资源筛选">
              <button v-for="item in currentFilters" :key="item.key" type="button" class="pi-filter-chip"
                :class="{ on: activeFilter.resource === item.key }" :data-filter="item.key"
                @click="setFilter('resource', item.key)">{{ item.label }} <b>{{ item.count }}</b></button>
            </div>
            <div class="pi-table-wrap">
              <table>
                <thead><tr><th>资源</th><th>链接类型</th><th>调用</th><th>支撑</th><th>最近使用</th></tr></thead>
                <tbody>
                  <tr v-for="row in resourceRows" :key="row.id">
                    <td>
                      <button type="button" class="pi-row-task" @click.stop="emit('open-card', { kind: 'resource', id: row.id })">
                        <strong>{{ row.title }}</strong>
                        <span>{{ row.folders.length ? `常用夹：${row.folders.join(' · ')}` : (row.zeroReference ? '当前零引用' : `被 ${row.totalRefs} 处引用`) }}</span>
                      </button>
                    </td>
                    <td><span :class="{ 'pi-warn-text': !row.hasLink }">{{ row.linkLabel }}</span></td>
                    <td class="num">{{ row.callCount }} 次</td>
                    <td class="num">任 {{ row.taskRefs }} · 题 {{ row.topicRefs }} · 奇 {{ row.curioRefs }}</td>
                    <td class="num">{{ fmtRelative(row.lastCalledAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!resourceRows.length" class="pi-empty">当前筛选下暂无资源。</div>
          </section>
        </template>

        <template v-else-if="kind === 'curiosity'">
          <div class="pi-ca-grid">
            <section class="pi-ca-sub">
              <header class="pi-ca-subhead">
                <div><h3>问题状态构成</h3><p>待探索 / 探索中 / 已求证 / 已搁置互斥；已转化是独立事实标记。</p></div>
              </header>
              <div class="pi-bar-list">
                <button v-for="item in analysis.curiosity.statusDistribution" :key="item.key" type="button" class="pi-bar-row"
                  @click="setFilter('curiosity', item.key)">
                  <span class="pi-bar-label">{{ item.label }}</span>
                  <span class="pi-bar-track"><i :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }" /></span>
                  <b>{{ item.count }}</b>
                </button>
              </div>
              <div class="pi-callout">
                <b>口径提示：</b>好奇心卡没有项目 / 指标字段，不做伪分组；三件事历史频次按本轮拍板只统计任务与选题。
              </div>
            </section>

            <section class="pi-ca-sub soft">
              <header class="pi-ca-subhead">
                <div><h3>来源与证据</h3><p>来源、附件与资源支撑都按当前字段 / 关系表计算。</p></div>
              </header>
              <div class="pi-evidence-grid">
                <button v-for="item in analysis.curiosity.evidenceDistribution" :key="item.key" type="button"
                  @click="setFilter('curiosity', item.key === 'source' ? 'source' : item.key === 'support' ? 'support' : item.key === 'assets' ? 'assets' : 'stale')">
                  <strong>{{ item.count }}</strong><span>{{ item.label }}</span><small>{{ item.pct }}%</small>
                </button>
              </div>
              <div class="pi-mini-block support-note">
                <span class="pi-quality-title">资源支撑覆盖</span>
                <div class="pi-inline-stat"><span>有资源支撑</span><b>{{ analysis.curiosity.supportedCount }}</b><small>{{ analysis.curiosity.liveCount ? Math.round(analysis.curiosity.supportedCount / analysis.curiosity.liveCount * 100) : 0 }}%</small></div>
                <div class="pi-inline-stat"><span>超过 30 天未动</span><b>{{ analysis.curiosity.staleCount }}</b><small>需人工判断</small></div>
              </div>
            </section>
          </div>

          <section class="pi-evidence-panel">
            <header class="pi-ca-subhead">
              <div><h3>好奇心清单 · 哪些问题正在变冷</h3><p>点标题查看来源、附件、资源与转化事实；空态保留补链入口。</p></div>
              <span class="pi-result-count">{{ currentRowCount }} / {{ analysis.curiosity.liveCount }} 张</span>
            </header>
            <div class="pi-filter-bar" role="group" aria-label="好奇心筛选">
              <button v-for="item in currentFilters" :key="item.key" type="button" class="pi-filter-chip"
                :class="{ on: activeFilter.curiosity === item.key }" :data-filter="item.key"
                @click="setFilter('curiosity', item.key)">{{ item.label }} <b>{{ item.count }}</b></button>
            </div>
            <div class="pi-table-wrap">
              <table>
                <thead><tr><th>好奇心</th><th>状态</th><th>来源</th><th>支撑资源</th><th>附件</th><th>停留</th></tr></thead>
                <tbody>
                  <tr v-for="row in curiosityRows" :key="row.id">
                    <td>
                      <button type="button" class="pi-row-task" @click.stop="emit('open-card', { kind: 'curiosity', id: row.id })">
                        <strong>{{ row.question }}</strong>
                        <span>{{ row.converted ? '已转化 · 独立事实标记' : (row.planned ? '已有计划日期' : '未落计划') }}</span>
                      </button>
                    </td>
                    <td><span class="pi-status">{{ row.statusLabel }}</span></td>
                    <td class="num">{{ row.hasSource ? '有来源' : '无来源' }}</td>
                    <td class="num">{{ row.supportCount }} 张</td>
                    <td class="num">{{ row.assetCount }} 个</td>
                    <td class="num">{{ fmtRelative(row.lastActivityAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!curiosityRows.length" class="pi-empty">当前筛选下暂无好奇心卡。</div>
          </section>
        </template>

        <template v-else>
          <div class="pi-ca-grid">
            <section class="pi-ca-sub">
              <header class="pi-ca-subhead">
                <div><h3>选题状态 · 项目 / 指标分布</h3><p>状态名走用户定义；项目、指标按单一归属统计。</p></div>
              </header>
              <div class="pi-topic-state">
                <button v-for="item in analysis.topic.statusDistribution" :key="item.key" type="button"
                  @click="setFilter('topic', `topic-status:${item.key}`, item.label)">
                  <strong>{{ item.count }}</strong><span>{{ item.label }}</span><small>{{ item.pct }}%</small>
                </button>
              </div>
              <div class="pi-bar-list compact topic-project-list">
                <button v-for="item in topBars(analysis.topic.projectDistribution)" :key="item.key" type="button" class="pi-bar-row"
                  @click="setFilter('topic', `topic-project:${item.key}`, item.label)">
                  <span class="pi-bar-label">{{ item.label }}</span>
                  <span class="pi-bar-track"><i :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }" /></span>
                  <b>{{ item.count }}</b>
                </button>
              </div>
              <div class="pi-chip-list" aria-label="选题指标计数">
                <button
                  v-for="item in analysis.topic.metricDistribution"
                  :key="item.key"
                  type="button"
                  class="pi-mini-chip"
                  @click="setFilter('topic', `metric:${item.key}`, item.label)"
                >
                  {{ item.label }} <b>{{ item.count }}</b>
                </button>
              </div>
            </section>

            <section class="pi-ca-sub soft">
              <header class="pi-ca-subhead">
                <div><h3>行动与成果路径</h3><p>这是当前覆盖，不是同一批选题的转化漏斗；不推算真实发布时间。</p></div>
              </header>
              <div class="pi-bar-list">
                <button v-for="item in analysis.topic.coverageDistribution" :key="item.key" type="button" class="pi-bar-row"
                  @click="setFilter('topic', item.key === 'planned' ? 'planned' : item.key === 'focused' ? 'entered' : item.key === 'supported' ? 'supported' : 'outcome', item.label)">
                  <span class="pi-bar-label">{{ item.label }}</span>
                  <span class="pi-bar-track"><i :class="`tone-${item.tone || 'accent'}`" :style="{ width: item.pct + '%' }" /></span>
                  <b>{{ item.count }}</b>
                </button>
              </div>
              <div class="pi-callout">
                <b>成果口径：</b>“完成 / 发布态”只读 topicStatuses.terminal；成果链接存在也不反推发布时间，不伪造 publishedAt。
              </div>
            </section>
          </div>

          <section class="pi-evidence-panel">
            <header class="pi-ca-subhead">
              <div><h3>选题清单 · 计划、支撑与成果</h3><p>点标题打开详情；安排历程来自 planScheduleEvents，三件事来自真实 topic slots。</p></div>
              <span class="pi-result-count">{{ currentRowCount }} / {{ analysis.topic.liveCount }} 张</span>
            </header>
            <div class="pi-filter-bar" role="group" aria-label="选题筛选">
              <button v-for="item in currentFilters" :key="item.key" type="button" class="pi-filter-chip"
                :class="{ on: activeFilter.topic === item.key }" :data-filter="item.key"
                @click="setFilter('topic', item.key)">{{ item.label }} <b>{{ item.count }}</b></button>
            </div>
            <div class="pi-table-wrap">
              <table>
                <thead><tr><th>选题</th><th>状态</th><th>项目 · 指标</th><th>三件事</th><th>资源</th><th>成果</th></tr></thead>
                <tbody>
                  <tr v-for="row in topicRows" :key="row.id">
                    <td>
                      <button type="button" class="pi-row-task" @click.stop="emit('open-card', { kind: 'topic', id: row.id })">
                        <strong>{{ row.title }}</strong>
                        <span>{{ row.scheduled ? `计划 ${fmtDueDate(row.dueDate)}` : '未落图' }}</span>
                      </button>
                    </td>
                    <td><span class="pi-status" :class="{ terminal: row.terminal }">{{ row.statusName }}</span></td>
                    <td>
                      <span :class="{ 'pi-warn-text': !row.projectId }">{{ row.projectName }}</span>
                      <small>{{ row.metricTitle }}</small>
                    </td>
                    <td class="num">{{ row.focusCount }} 次</td>
                    <td class="num">{{ row.supportCount }} 张</td>
                    <td class="num">{{ row.hasOutcome ? '有链接' : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!topicRows.length" class="pi-empty">当前筛选下暂无选题卡。</div>
          </section>
        </template>
      </section>
    </section>

    <section class="pi-mod pi-focus-analysis" aria-label="今日三件事数据分析">
      <div class="pi-mod-h">
        <span class="pi-mod-ico"><Icon name="compass" :size="13" /></span>
        <div class="pi-mod-t"><h2>三件事，是否持续推进<span class="en">DAILY FOCUS</span></h2><p>只看任务 / 选题的真实 active slots；同卡同日一次，隐藏展示仍计入历史。</p></div>
        <span class="pi-focus-today">今天完成 {{ todayFocus.done }} / {{ todayFocus.planned }}</span>
      </div>
      <div class="pi-focus-layout">
        <div class="pi-focus-rate" :style="{ '--focus-rate': completionRate + '%' }">
          <div class="pi-focus-ring"><span><strong>{{ completionRate }}</strong><small>%</small></span></div>
          <p><b>近 30 天完成率</b><span>{{ focus30.done }} 完成 / {{ focus30.planned }} 安排</span></p>
        </div>
        <div class="pi-focus-facts">
          <div><strong>{{ focus30.activeDays }}</strong><span>安排日</span><small>近 30 天</small></div>
          <div><strong>{{ focus30.cards }}</strong><span>进入卡片</span><small>去重后</small></div>
          <div><strong>{{ focus30.planned }}</strong><span>落位槽次</span><small>真实历史</small></div>
          <div><strong>{{ focus30.done }}</strong><span>完成槽次</span><small>已勾选</small></div>
        </div>
        <div class="pi-focus-trend" aria-label="近七天三件事完成节奏">
          <header><b>近 7 日节奏</b><span>柱高 = 当日完成率</span></header>
          <div class="pi-focus-bars">
            <div v-for="day in week" :key="day.date" class="pi-focus-day"
              :class="{ today: day.date === new Date().toLocaleDateString('sv-SE') }"
              :title="`${day.date} · 完成 ${day.done}/${day.planned}`">
              <span class="pi-focus-bar"><i :style="{ height: (day.planned ? Math.max(8, day.pct) : 3) + '%' }" /></span>
              <small>{{ day.label }}</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="pi-mod" id="lc-sec">
      <div class="pi-mod-h">
        <div class="pi-mod-t"><h2>资源生命周期与高价值沉睡证据唤醒</h2><p>活跃 / 冷却 / 归档，把仍有价值的证据重新带回工作面。</p></div>
        <button class="pi-btn sm line pi-lc-settings" @click="emit('lc-settings')"><Icon name="settings" :size="13" /> 阈值设置</button>
      </div>
      <div class="pi-mod-b">
        <LifecyclePanel kind="all" :cards="lcCards" :focus="focusFilter"
          @locate="(id, kind) => emit('lc-locate', id, kind)" @archive="id => emit('lc-archive', id)"
          @snooze="id => emit('lc-snooze', id)" @reactivate="id => emit('lc-reactivate', id)"
          @set-days="(id, days) => emit('lc-set-days', id, days)" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.pi-card-analysis { display: grid; gap: 20px; }
.pi-ca-shell { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); box-shadow: var(--shadow-panel); }
.pi-ca-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px 14px; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, color-mix(in srgb, var(--accent-light) 40%, transparent), transparent 58%), var(--surface); }
.pi-ca-eyebrow { display: block; margin-bottom: 4px; color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 750; letter-spacing: .14em; }
.pi-ca-head h2 { margin: 0; color: var(--text); font-size: var(--fs-headline); line-height: 1.25; }
.pi-ca-head p { max-width: 760px; margin: 4px 0 0; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.6; }
.pi-ca-scope, .pi-ca-tag { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.pi-ca-tag { border-color: color-mix(in srgb, var(--accent) 24%, var(--border)); color: var(--accent-ink); }
.pi-ca-tag.warn { border-color: var(--warning-border); background: var(--warning-bg-soft); color: var(--warning); }
.pi-kind-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; border-bottom: 1px solid var(--border); background: var(--border); }
.pi-kind-tab { min-width: 0; display: flex; align-items: center; gap: 9px; padding: 11px 13px; border: 0; background: var(--surface-2); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background var(--dur-fast), color var(--dur-fast); }
.pi-kind-tab:hover { background: color-mix(in srgb, var(--accent-light) 34%, var(--surface)); }
.pi-kind-tab.on { background: var(--surface); box-shadow: inset 0 -2px 0 var(--accent); }
.pi-kind-tab:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--accent); outline-offset: -2px; }
.pi-kind-glyph { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: var(--radius-xs); background: var(--surface-3); color: var(--text-3); font-size: var(--fs-caption); font-weight: 760; }
.pi-kind-tab.on .pi-kind-glyph { background: var(--accent-light); color: var(--accent-ink); }
.pi-kind-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 1px; }
.pi-kind-copy strong { color: var(--text); font-size: var(--fs-caption); font-weight: 700; }
.pi-kind-copy small { overflow: hidden; color: var(--text-4); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.pi-kind-count { flex: none; color: var(--text-3); font-size: var(--fs-sub); font-weight: 700; font-variant-numeric: tabular-nums; }
.pi-kind-tab.on .pi-kind-count { color: var(--accent-ink); }
.pi-ca-panel { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
.pi-ca-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--border); gap: 1px; }
.pi-ca-summary.is-resource { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.pi-ca-summary.is-curiosity { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.pi-ca-summary.is-topic { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.pi-ca-kpi { min-width: 0; min-height: 82px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 11px; border: 0; background: var(--surface); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background var(--dur-fast), box-shadow var(--dur-fast); }
.pi-ca-kpi:hover { background: color-mix(in srgb, var(--accent-light) 30%, var(--surface)); }
.pi-ca-kpi.on { background: color-mix(in srgb, var(--accent-light) 48%, var(--surface)); box-shadow: inset 0 -2px 0 var(--accent); }
.pi-ca-kpi:disabled { cursor: default; opacity: 1; }
.pi-ca-kpi.muted { background: var(--surface-2); }
.pi-ca-kpi:focus-visible { position: relative; z-index: 1; outline: 2px solid var(--accent); outline-offset: -2px; }
.pi-ca-kpi strong { color: var(--text); font-size: var(--fs-headline); line-height: 1.1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.pi-ca-kpi strong small { margin-left: 1px; color: var(--text-3); font-size: var(--fs-micro); font-weight: 600; }
.pi-ca-kpi > span { color: var(--text-2); font-size: var(--fs-caption); font-weight: 700; }
.pi-ca-kpi em { overflow: hidden; color: var(--text-4); font-size: var(--fs-micro); font-style: normal; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.pi-ca-filter-scope {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent-light) 36%, var(--surface));
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.pi-ca-filter-scope b { color: var(--text-2); }
.pi-ca-filter-scope button {
  flex: none;
  padding: 1px 0;
  border: 0;
  background: transparent;
  color: var(--accent-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.pi-ca-filter-scope button:hover { text-decoration: underline; }
.pi-ca-grid { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(340px, .92fr); gap: 12px; }
.pi-ca-sub, .pi-evidence-panel { min-width: 0; padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); }
.pi-ca-sub.soft { background: color-mix(in srgb, var(--surface-2) 62%, var(--surface)); }
.pi-ca-subhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.pi-ca-subhead h3 { margin: 0; color: var(--text); font-size: var(--fs-body); font-weight: 700; }
.pi-ca-subhead p { margin: 2px 0 0; color: var(--text-3); font-size: var(--fs-micro); line-height: 1.5; }
.pi-bar-list { display: flex; flex-direction: column; gap: 3px; }
.pi-bar-list.compact { gap: 1px; }
.pi-bar-row { display: grid; grid-template-columns: minmax(110px, .8fr) minmax(90px, 1.4fr) 32px; align-items: center; gap: 7px; min-height: 25px; padding: 2px 5px; border: 0; border-radius: var(--radius-xs); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.pi-bar-row:hover { background: var(--surface-2); }
.pi-bar-label { overflow: hidden; color: var(--text-2); font-size: var(--fs-caption); text-overflow: ellipsis; white-space: nowrap; }
.pi-bar-track { height: 6px; overflow: hidden; border-radius: var(--radius-full); background: var(--surface-3); }
.pi-bar-track i { display: block; height: 100%; min-width: 2px; border-radius: inherit; background: var(--accent); }
.pi-bar-row b { color: var(--text-2); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; text-align: right; }
.tone-accent { background: var(--accent); }
.tone-info { background: var(--info-blue); }
.tone-success { background: var(--success); }
.tone-warn { background: var(--warning); }
.tone-muted { background: var(--text-4); }
.pi-chip-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--border); }
.pi-mini-chip { padding: 2px 6px; border: 1px solid var(--border); border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.pi-mini-chip:hover { border-color: var(--accent); color: var(--accent-ink); }
.pi-mini-chip b { color: var(--text-2); font-variant-numeric: tabular-nums; }
.pi-quality-blocks { display: flex; flex-direction: column; gap: 10px; }
.pi-quality-title { display: block; margin-bottom: 4px; color: var(--text-3); font-size: var(--fs-micro); font-weight: 700; letter-spacing: .05em; }
.pi-mini-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.pi-mini-block { min-width: 0; padding: 8px 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
.pi-inline-stat { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: baseline; gap: 5px; padding: 2px 0; }
.pi-inline-stat span { overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.pi-inline-stat b { color: var(--text-2); font-size: var(--fs-caption); font-variant-numeric: tabular-nums; }
.pi-inline-stat small { color: var(--text-4); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.pi-frequency { padding-top: 8px; border-top: 1px solid var(--border); }
.pi-segment-track, .pi-stack-track { display: flex; width: 100%; height: 10px; overflow: hidden; border-radius: var(--radius-full); background: var(--surface-3); }
.pi-segment-track i, .pi-stack-track i { display: block; height: 100%; min-width: 2px; }
.pi-segment-legend, .pi-stack-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; color: var(--text-3); font-size: var(--fs-micro); }
.pi-segment-legend b, .pi-stack-legend b { color: var(--text-2); font-variant-numeric: tabular-nums; }
.pi-stack-chart { display: flex; flex-direction: column; gap: 6px; }
.pi-stack-legend button { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; font-size: inherit; cursor: pointer; }
.pi-stack-legend button:hover { color: var(--text); }
.pi-stack-legend i { width: 6px; height: 6px; border-radius: 2px; }
.folder-list { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
.pi-ref-list { display: flex; flex-direction: column; gap: 3px; }
.pi-ref-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(130px, .9fr) auto; align-items: center; gap: 8px; padding: 6px 7px; border: 1px solid transparent; border-radius: var(--radius-xs); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.pi-ref-row:hover { border-color: var(--border); background: var(--surface); }
.pi-ref-title { overflow: hidden; color: var(--text-2); font-size: var(--fs-caption); text-overflow: ellipsis; white-space: nowrap; }
.pi-ref-meta { color: var(--text-3); font-size: var(--fs-micro); }
.pi-ref-row b { color: var(--accent-ink); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pi-cooling-note, .pi-callout { display: flex; align-items: flex-start; gap: 6px; margin-top: 10px; padding: 7px 8px; border: 1px dashed var(--border); border-radius: var(--radius-xs); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); line-height: 1.55; }
.pi-cooling-note.active { border-color: var(--warning-border); background: var(--warning-bg-soft); color: var(--warning); }
.pi-cooling-note b, .pi-callout b { color: inherit; }
.pi-evidence-grid, .pi-topic-state { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.pi-evidence-grid button, .pi-topic-state button { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.pi-evidence-grid button:hover, .pi-topic-state button:hover { border-color: var(--accent); }
.pi-evidence-grid strong, .pi-topic-state strong { color: var(--text); font-size: var(--fs-headline); line-height: 1.1; font-variant-numeric: tabular-nums; }
.pi-evidence-grid span, .pi-topic-state span { color: var(--text-3); font-size: var(--fs-micro); }
.pi-evidence-grid small, .pi-topic-state small { color: var(--text-4); font-size: var(--fs-micro); }
.support-note { margin-top: 8px; }
.topic-project-list { margin-top: 9px; }
.pi-evidence-panel { display: flex; flex-direction: column; }
.pi-result-count { flex: none; color: var(--text-4); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.pi-filter-bar { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 7px; scrollbar-width: thin; }
.pi-filter-chip { flex: none; min-height: 28px; padding: 0 9px; border: 1px solid var(--border); border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.pi-filter-chip:hover { border-color: var(--accent); color: var(--accent-ink); }
.pi-filter-chip.on { border-color: color-mix(in srgb, var(--accent) 46%, var(--border)); background: var(--accent-light); color: var(--accent-ink); font-weight: 700; }
.pi-filter-chip b { margin-left: 3px; font-variant-numeric: tabular-nums; }
.pi-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.pi-table-wrap table { width: 100%; min-width: 720px; border-collapse: collapse; }
.pi-table-wrap th { padding: 7px 9px; border-bottom: 1px solid var(--border); background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); font-weight: 700; text-align: left; white-space: nowrap; }
.pi-table-wrap td { padding: 7px 9px; border-bottom: 1px solid var(--border); color: var(--text-2); font-size: var(--fs-caption); vertical-align: top; }
.pi-table-wrap tbody tr { transition: background var(--dur-fast); }
.pi-table-wrap tbody tr:hover { background: color-mix(in srgb, var(--accent-light) 22%, var(--surface)); }
.pi-table-wrap tbody tr:focus-visible { position: relative; outline: 2px solid var(--accent); outline-offset: -2px; }
.pi-table-wrap tbody tr:last-child td { border-bottom: 0; }
.pi-table-wrap td.num { color: var(--text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pi-table-wrap td > small { display: block; margin-top: 1px; color: var(--text-2); font-size: var(--fs-micro); }
.pi-row-task { max-width: 310px; display: flex; flex-direction: column; gap: 1px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.pi-row-task strong { overflow: hidden; color: var(--text); font-size: var(--fs-caption); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.pi-row-task span { overflow: hidden; color: var(--text-4); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.pi-status { display: inline-flex; padding: 2px 6px; border-radius: var(--radius-full); background: var(--surface-3); color: var(--text-2); font-size: var(--fs-micro); white-space: nowrap; }
.pi-status.bucket-doing { background: var(--info-blue-light); color: var(--info-blue); }
.pi-status.bucket-done, .pi-status.terminal { background: var(--success-bg-soft); color: var(--success); }
.pi-link-count { color: var(--accent-ink); font-weight: 700; }
.pi-warn-text { color: var(--warning); }
.pi-conflict { display: block; margin-top: 1px; color: var(--warning); font-size: var(--fs-micro); font-style: normal; }
.pi-inline-empty, .pi-empty { padding: 18px; color: var(--text-4); font-size: var(--fs-caption); text-align: center; }
.pi-focus-today { margin-left: auto; color: var(--accent-ink); font-size: var(--fs-caption); font-weight: 700; }
.pi-focus-layout { display: grid; grid-template-columns: minmax(210px, .8fr) minmax(330px, 1.4fr) minmax(280px, 1fr); gap: 12px; padding: 0 22px 22px; }
.pi-focus-rate { display: flex; align-items: center; gap: 13px; min-width: 0; padding: 13px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--accent-light) 28%, var(--surface)); }
.pi-focus-ring { display: grid; width: 68px; height: 68px; flex: none; place-items: center; border-radius: 50%; background: conic-gradient(var(--accent) var(--focus-rate), var(--surface-3) 0); }
.pi-focus-ring::before { grid-area: 1 / 1; width: 54px; height: 54px; border-radius: 50%; background: var(--surface); content: ''; }
.pi-focus-ring > span { z-index: 1; grid-area: 1 / 1; display: flex; align-items: baseline; gap: 1px; }
.pi-focus-ring strong { font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums; }
.pi-focus-ring small { color: var(--text-3); font-size: var(--fs-micro); }
.pi-focus-rate p { display: flex; min-width: 0; flex-direction: column; gap: 4px; margin: 0; }
.pi-focus-rate b { color: var(--text); font-size: var(--fs-caption); }
.pi-focus-rate span { color: var(--text-3); font-size: var(--fs-micro); }
.pi-focus-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.pi-focus-facts > div { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 2px 7px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
.pi-focus-facts strong { font-size: var(--fs-headline); font-variant-numeric: tabular-nums; }
.pi-focus-facts span { color: var(--text-2); font-size: var(--fs-caption); }
.pi-focus-facts small { grid-column: 1 / -1; color: var(--text-4); font-size: var(--fs-micro); }
.pi-focus-trend { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-2); }
.pi-focus-trend header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.pi-focus-trend header b { color: var(--text); font-size: var(--fs-caption); }
.pi-focus-trend header span { color: var(--text-4); font-size: var(--fs-micro); }
.pi-focus-bars { display: grid; min-height: 76px; grid-template-columns: repeat(7, minmax(0, 1fr)); align-items: end; gap: 5px; }
.pi-focus-day { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.pi-focus-bar { display: flex; width: 100%; height: 58px; align-items: flex-end; overflow: hidden; border-radius: 6px 6px 3px 3px; background: var(--surface-3); }
.pi-focus-bar i { display: block; width: 100%; min-height: 2px; border-radius: 6px 6px 3px 3px; background: var(--accent); transition: height var(--dur-fast); }
.pi-focus-day.today .pi-focus-bar i { background: var(--accent-ink); }
.pi-focus-day small { color: var(--text-3); font-size: var(--fs-micro); }
.pi-focus-day.today small { color: var(--accent-ink); font-weight: 700; }
@media (max-width: 1120px) {
  .pi-ca-summary, .pi-ca-summary.is-topic { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .pi-ca-summary.is-resource { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pi-ca-grid { grid-template-columns: 1fr; }
  .pi-focus-layout { grid-template-columns: minmax(220px, .9fr) minmax(0, 1.2fr); }
  .pi-focus-trend { grid-column: 1 / -1; }
}
@media (max-width: 860px) {
  .pi-kind-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pi-ca-summary, .pi-ca-summary.is-resource, .pi-ca-summary.is-curiosity, .pi-ca-summary.is-topic { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .pi-ca-head { flex-direction: column; padding-inline: 15px; }
  .pi-ca-panel { padding: 8px; }
  .pi-ca-summary, .pi-ca-summary.is-resource, .pi-ca-summary.is-curiosity, .pi-ca-summary.is-topic { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pi-kind-tab { padding: 9px 10px; }
  .pi-kind-copy small { display: none; }
  .pi-mini-grid { grid-template-columns: 1fr; }
  .pi-evidence-grid, .pi-topic-state { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pi-ref-row { grid-template-columns: 1fr auto; }
  .pi-ref-meta { grid-column: 1 / -1; grid-row: 2; }
  .pi-focus-layout { grid-template-columns: 1fr; padding-inline: 16px; }
  .pi-focus-trend { grid-column: auto; }
  .pi-focus-today { width: 100%; margin-left: 0; }
}
</style>
