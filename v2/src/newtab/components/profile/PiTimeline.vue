<script setup lang="ts">
/**
 * V4.7.2 · 画像洞察时间轴。
 *
 * 按自然日倒序展示“写入 / 修改”过的卡片；同一张卡同一天只保留一行，
 * 以最新一次动作排序。卡片状态色读业务状态定义，不另造一套颜色。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import type { AppData, CuriosityCard, LinkType, ResourceCard, TaskCard, TopicCard } from '@/shared/models'
import type { CardEvent, CardKind, EventAction } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
import { taskStatusOf } from '@/shared/utils/taskStatus'
import { topicStatusOf } from '@/shared/utils/topicStatus'

export interface PiTimelineEntry {
  key: string
  kind: CardKind
  id: string
  title: string
  status: string
  statusColor: string
  project: string
  metric: string
  action: string
  ts: number
  day: string
  count: number
  link?: string
  linkType?: LinkType
}

const props = defineProps<{
  events: CardEvent[]
  data: AppData
}>()

const emit = defineEmits<{
  (e: 'open', entry: PiTimelineEntry): void
  (e: 'open-link', entry: PiTimelineEntry): void
}>()

const TRACKED_ACTIONS = new Set<EventAction>(['create', 'status'])
const TIMELINE_WINDOW_DAYS = 30
const DENSITY_OPTIONS = [4, 5, 6] as const
type TimelineDensity = typeof DENSITY_OPTIONS[number]
type TimelineFilter = 'all' | 'focus' | CardKind
type TimelineSegment = { key: string; kind: TimelineFilter; entries: PiTimelineEntry[] }
const KIND_META: Record<CardKind, { label: string; icon: string; color: string }> = {
  resource: { label: '资源', icon: 'filetext', color: 'var(--accent)' },
  task: { label: '任务', icon: 'check', color: 'var(--success)' },
  topic: { label: '选题', icon: 'layers', color: 'var(--warning)' },
  curiosity: { label: '好奇', icon: 'bulb', color: 'var(--accent-2)' },
}
const KIND_FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'resource', label: '资源' },
  { key: 'task', label: '任务' },
  { key: 'topic', label: '选题' },
  { key: 'curiosity', label: '好奇' },
  { key: 'focus', label: '三件事' },
]
const DENSITY_STORAGE_KEY = 'zy.profile.timeline.density'
const windowStart = Date.now() - TIMELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000
const kindFilter = ref<TimelineFilter>('all')
const groupByKind = ref(false)
const collapsedKinds = ref<Set<CardKind>>(new Set())
const density = ref<TimelineDensity>(readDensity())

function readDensity(): TimelineDensity {
  if (typeof localStorage === 'undefined') return 4
  const saved = Number(localStorage.getItem(DENSITY_STORAGE_KEY))
  return DENSITY_OPTIONS.includes(saved as TimelineDensity) ? saved as TimelineDensity : 4
}

function setDensity(next: TimelineDensity): void {
  density.value = next
  if (typeof localStorage !== 'undefined') localStorage.setItem(DENSITY_STORAGE_KEY, String(next))
}

function setKindFilter(next: TimelineFilter): void {
  kindFilter.value = next
}

function toggleKindGroup(kind: CardKind): void {
  const next = new Set(collapsedKinds.value)
  if (next.has(kind)) next.delete(kind)
  else next.add(kind)
  collapsedKinds.value = next
}

function isKindCollapsed(kind: CardKind): boolean {
  return collapsedKinds.value.has(kind)
}

const projectNames = computed(() => {
  const map = new Map<string, string>()
  for (const direction of props.data.compass?.directions || []) {
    for (const project of direction.projects || []) map.set(project.id, project.name)
  }
  return map
})

const metricNames = computed(() => {
  const map = new Map<string, string>()
  for (const direction of props.data.compass?.directions || []) {
    for (const project of direction.projects || []) {
      for (const metric of project.metrics || []) map.set(metric.id, metric.title)
    }
  }
  return map
})

function cardOf(kind: CardKind, id: string): { title: string; projectId?: string; metricId?: string; deletedAt?: number; link?: string; linkType?: LinkType } | null {
  if (kind === 'resource') {
    const card = (props.data.resources || []).find(row => row.id === id) as ResourceCard | undefined
    return card ? { title: card.title || '（无标题资源）', deletedAt: card.deletedAt, link: card.link, linkType: card.linkType } : null
  }
  if (kind === 'task') {
    const card = (props.data.tasks || []).find(row => row.id === id)
    return card ? { title: card.title, projectId: card.projectId, metricId: card.metricId, deletedAt: card.deletedAt, link: card.link } : null
  }
  if (kind === 'topic') {
    const card = (props.data.topics || []).find(row => row.id === id)
    return card ? { title: card.title, projectId: card.projectId, metricId: card.metricId, deletedAt: card.deletedAt, link: card.link, linkType: card.linkType } : null
  }
  const card = (props.data.curiosities || []).find(row => row.id === id)
  return card ? { title: card.question || '（无标题好奇）', deletedAt: card.deletedAt } : null
}

function statusOf(kind: CardKind, id: string): { name: string; color: string } {
  if (kind === 'task') {
    const card = (props.data.tasks || []).find(row => row.id === id) as TaskCard | undefined
    const status = card ? taskStatusOf(props.data, card) : undefined
    return { name: status?.name || '任务', color: status?.color || 'var(--success)' }
  }
  if (kind === 'topic') {
    const card = (props.data.topics || []).find(row => row.id === id) as TopicCard | undefined
    const status = card ? topicStatusOf(props.data, card.statusId) : undefined
    return { name: status?.name || '选题', color: status?.color || 'var(--warning)' }
  }
  if (kind === 'curiosity') {
    const card = (props.data.curiosities || []).find(row => row.id === id) as CuriosityCard | undefined
    const name = card?.status === 'done' ? '已求证'
      : card?.status === 'doing' ? '探索中'
        : card?.status === 'shelf' ? '已搁置'
          : '待探索'
    const color = card?.status === 'done' ? 'var(--success)'
      : card?.status === 'doing' ? 'var(--accent)'
        : card?.status === 'shelf' ? 'var(--text-4)'
          : 'var(--accent-2)'
    return { name, color }
  }
  return { name: '资源卡', color: 'var(--accent)' }
}

function dayKey(ts: number): string {
  const date = new Date(ts)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function actionText(event: CardEvent): string {
  return EVENT_ACT_LABEL[event.action] || '更新'
}

const allEntries = computed(() => {
  const byDayAndCard = new Map<string, PiTimelineEntry>()
  for (const event of props.events) {
    if (!TRACKED_ACTIONS.has(event.action) || event.kind === 'system' || event.ts < windowStart) continue
    const card = cardOf(event.kind, event.cardId)
    if (!card || card.deletedAt) continue
    const day = dayKey(event.ts)
    const key = `${day}:${event.kind}:${event.cardId}`
    const existing = byDayAndCard.get(key)
    if (existing) {
      existing.count += 1
      if (event.ts > existing.ts) {
        existing.ts = event.ts
        existing.action = actionText(event)
      }
      continue
    }
    const status = statusOf(event.kind, event.cardId)
    byDayAndCard.set(key, {
      key,
      kind: event.kind,
      id: event.cardId,
      title: card.title,
      status: status.name,
      statusColor: status.color,
      project: card.projectId ? projectNames.value.get(card.projectId) || '' : '',
      metric: card.metricId ? metricNames.value.get(card.metricId) || '' : '',
      action: actionText(event),
      ts: event.ts,
      day,
      count: 1,
      link: card.link,
      linkType: card.linkType,
    })
  }

  return [...byDayAndCard.values()].sort((a, b) => b.ts - a.ts || a.key.localeCompare(b.key))
})

const focusEntries = computed(() => {
  const rows: PiTimelineEntry[] = []
  const start = dayKey(windowStart)
  for (const [day, slots] of Object.entries(props.data.dailyFocus || {})) {
    if (day < start) continue
    for (const slot of slots || []) {
      if (!slot || slot.cleared || !slot.sourceId || (slot.sourceType !== 'task' && slot.sourceType !== 'topic')) continue
      const kind = slot.sourceType as CardKind
      const card = cardOf(kind, slot.sourceId)
      if (!card || card.deletedAt) continue
      const status = statusOf(kind, slot.sourceId)
      rows.push({
        key: `focus:${day}:${kind}:${slot.sourceId}`,
        kind, id: slot.sourceId, title: card.title,
        status: status.name, statusColor: status.color,
        project: card.projectId ? projectNames.value.get(card.projectId) || '' : '',
        metric: card.metricId ? metricNames.value.get(card.metricId) || '' : '',
        action: slot.done ? '三件事 · 已完成' : '三件事 · 已安排',
        ts: slot.doneAt || new Date(`${day}T23:59:00`).getTime(), day, count: 1,
        link: card.link, linkType: card.linkType,
      })
    }
  }
  return rows.sort((a, b) => b.ts - a.ts || a.key.localeCompare(b.key))
})

const filteredEntries = computed(() => allEntries.value.filter(entry =>
  kindFilter.value !== 'focus' && (kindFilter.value === 'all' || entry.kind === kindFilter.value)))
const visibleEntries = computed(() => kindFilter.value === 'focus' ? focusEntries.value : filteredEntries.value)

const groupedEntries = computed(() => {
  const days = new Map<string, PiTimelineEntry[]>()
  for (const entry of visibleEntries.value) {
    const rows = days.get(entry.day) || []
    rows.push(entry)
    days.set(entry.day, rows)
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, entries]) => ({ day, entries }))
})

const totalCards = computed(() => groupedEntries.value.reduce((sum, group) => sum + group.entries.length, 0))

function segmentsOf(entries: PiTimelineEntry[]): TimelineSegment[] {
  if (!groupByKind.value) return [{ key: 'all', kind: 'all', entries }]
  return (['resource', 'task', 'topic', 'curiosity'] as CardKind[])
    .map(kind => ({
      key: kind,
      kind,
      entries: entries.filter(entry => entry.kind === kind),
    }))
    .filter(segment => segment.entries.length > 0)
}

function linkLabel(entry: PiTimelineEntry): string {
  if (!entry.link) return ''
  if (entry.kind === 'topic' || entry.linkType === 'obsidian') return '打开成果 / Obsidian 链接'
  if (entry.linkType === 'file') return '打开本地文件'
  return '打开卡片链接'
}

let clickTimer: ReturnType<typeof setTimeout> | null = null
let clickEntryKey = ''

function clearClickTimer(): void {
  if (!clickTimer) return
  clearTimeout(clickTimer)
  clickTimer = null
  clickEntryKey = ''
}

function onCardClick(entry: PiTimelineEntry): void {
  if (clickTimer && clickEntryKey === entry.key) {
    clearClickTimer()
    return
  }
  clearClickTimer()
  clickEntryKey = entry.key
  clickTimer = setTimeout(() => {
    clickTimer = null
    clickEntryKey = ''
    emit('open', entry)
  }, 260)
}

function onCardDblClick(entry: PiTimelineEntry): void {
  clearClickTimer()
  if (entry.kind === 'resource' || entry.link) emit('open-link', entry)
}

onBeforeUnmount(clearClickTimer)

function dayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const current = new Date()
  const today = dayKey(current.getTime())
  const yesterdayDate = new Date(current)
  yesterdayDate.setDate(current.getDate() - 1)
  const yesterday = dayKey(yesterdayDate.getTime())
  if (day === today) return '今天'
  if (day === yesterday) return '昨天'
  const weekday = '日一二三四五六'[new Date(year, month - 1, date, 12).getDay()]
  return `${month} 月 ${date} 日 · 周${weekday}`
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function kindMeta(kind: CardKind) {
  return KIND_META[kind]
}

function metaOf(entry: PiTimelineEntry): string {
  if (entry.kind === 'resource' || entry.kind === 'curiosity') return ''
  const path = [entry.project, entry.metric].filter(Boolean).join(' › ')
  return path || '未关联项目'
}
</script>

<template>
  <section class="pi-mod pi-intel-timeline" aria-label="卡片写入与修改时间轴">
    <header class="pi-mod-h pit-head">
      <span class="pi-mod-ico i-year"><Icon name="clock" :size="13" /></span>
      <div class="pi-mod-t">
        <h2>时间轴<span class="en">TIMELINE</span></h2>
        <p>按日倒序回看新增、状态修改与每日三件事。单击打开完整卡片详情，资源卡双击直接打开链接。</p>
      </div>
      <div class="pit-summary">
        <b>{{ totalCards }}</b>
        <span>张卡片 · {{ groupedEntries.length }} 个活跃日 · 近 {{ TIMELINE_WINDOW_DAYS }} 天</span>
      </div>
    </header>

    <div class="pi-mod-b pit-body">
      <div class="pit-tools">
        <div class="pit-filter" role="group" aria-label="时间轴卡片类型筛选">
          <button
            v-for="filter in KIND_FILTERS"
            :key="filter.key"
            type="button"
            :class="{ on: kindFilter === filter.key }"
            :aria-pressed="kindFilter === filter.key"
            @click="setKindFilter(filter.key)"
          >{{ filter.label }}</button>
        </div>
        <div class="pit-tool-actions">
          <button
            class="pit-group-toggle"
            :class="{ on: groupByKind }"
            type="button"
            :aria-pressed="groupByKind"
            @click="groupByKind = !groupByKind"
          >
            <Icon name="layers" :size="12" />
            {{ groupByKind ? '按类型分组' : '时间流水' }}
          </button>
          <div class="pit-density" role="group" aria-label="时间轴每行卡片密度">
            <span>每行</span>
            <button
              v-for="option in DENSITY_OPTIONS"
              :key="option"
              type="button"
              :class="{ on: density === option }"
              :aria-pressed="density === option"
              :title="`每行 ${option} 张卡片`"
              @click="setDensity(option)"
            >{{ option }} 卡</button>
          </div>
        </div>
      </div>
      <div v-if="groupedEntries.length" class="pit-days">
        <section v-for="group in groupedEntries" :key="group.day" class="pit-day">
          <aside class="pit-day-axis">
            <i aria-hidden="true" />
            <b>{{ dayLabel(group.day) }}</b>
            <span>{{ group.entries.length }} 张</span>
          </aside>
          <div class="pit-day-content">
            <section v-for="segment in segmentsOf(group.entries)" :key="segment.key" class="pit-segment">
              <button
                v-if="groupByKind && segment.kind !== 'all'"
                class="pit-segment-head"
                type="button"
                :aria-expanded="!isKindCollapsed(segment.kind as CardKind)"
                @click="toggleKindGroup(segment.kind as CardKind)"
              >
                <Icon :name="kindMeta(segment.kind as CardKind).icon" :size="12" />
                <span>{{ kindMeta(segment.kind as CardKind).label }}卡</span>
                <em>{{ segment.entries.length }}</em>
                <Icon :name="isKindCollapsed(segment.kind as CardKind) ? 'arrowright' : 'arrowdown'" :size="11" />
              </button>
              <div
                v-if="!groupByKind || segment.kind === 'all' || !isKindCollapsed(segment.kind as CardKind)"
                class="pit-cards"
                :style="{ '--pit-cols': density }"
              >
                <button
                  v-for="entry in segment.entries"
                  :key="entry.key"
                  class="pit-card"
                  type="button"
                  :title="entry.kind === 'resource' ? '单击查看详情 · 双击打开资源链接' : '单击查看详情'"
                  :style="{
                    '--kind-color': kindMeta(entry.kind).color,
                    '--status-color': entry.statusColor,
                  }"
                  @click="onCardClick(entry)"
                  @dblclick.stop.prevent="onCardDblClick(entry)"
                >
                  <span class="pit-kind">
                    <Icon :name="kindMeta(entry.kind).icon" :size="11" />
                    {{ kindMeta(entry.kind).label }}
                  </span>
                  <span class="pit-card-title">{{ entry.title }}</span>
                  <span v-if="metaOf(entry)" class="pit-card-meta">{{ metaOf(entry) }}</span>
                  <span class="pit-card-foot">
                    <span class="pit-status"><i />{{ entry.status }}</span>
                    <span v-if="entry.count > 1" class="pit-count">{{ entry.count }} 次更新</span>
                    <span class="pit-time">{{ timeLabel(entry.ts) }}</span>
                  </span>
                  <span class="pit-action">{{ entry.action }}</span>
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
      <div v-else class="pit-empty">
        <Icon name="clock" :size="24" />
        <b>{{ kindFilter === 'focus' ? '近 30 天还没有任务或选题进入三件事' : '近 30 天还没有可回看的卡片动作' }}</b>
        <span>{{ kindFilter === 'focus' ? '在调度台安排任务或选题后，会按日期出现在这里。' : '新增卡片或调整任务 / 选题状态后，会按日期出现在这里；更早记录不在此视图展示。' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pit-head { padding-bottom: 18px; }
.pit-summary {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.pit-summary b {
  color: var(--text);
  font-size: var(--fs-headline);
  font-variant-numeric: tabular-nums;
}
.pit-body { padding: 0 26px 26px; }
.pit-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 0 12px;
  border-top: 1px solid var(--border);
}
.pit-filter,
.pit-density {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--surface-2);
}
.pit-filter button,
.pit-density button,
.pit-group-toggle {
  min-height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-3);
  font: inherit;
  font-size: var(--fs-micro);
  font-weight: 650;
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);
}
.pit-filter button:hover,
.pit-density button:hover,
.pit-group-toggle:hover { color: var(--text); }
.pit-filter button.on,
.pit-density button.on,
.pit-group-toggle.on {
  background: var(--surface);
  color: var(--accent-ink);
  box-shadow: var(--shadow-sm);
}
.pit-tool-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.pit-density { gap: 1px; }
.pit-density > span {
  padding: 0 5px 0 7px;
  color: var(--text-4);
  font-size: var(--fs-micro);
}
.pit-group-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border);
  background: var(--surface);
}
.pit-day-content { min-width: 0; }
.pit-segment + .pit-segment { margin-top: 10px; }
.pit-segment-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  margin-bottom: 7px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--surface-2) 70%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: var(--fs-micro);
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.pit-segment-head span { color: var(--text); }
.pit-segment-head em {
  min-width: 18px;
  margin-left: auto;
  padding: 1px 5px;
  border-radius: 99px;
  background: var(--surface);
  color: var(--text-3);
  font-style: normal;
  font-variant-numeric: tabular-nums;
}
.pit-days {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
}
.pit-day {
  display: grid;
  grid-template-columns: 126px minmax(0, 1fr);
  gap: 18px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}
.pit-day:last-child { border-bottom: 0; }
.pit-day-axis {
  position: relative;
  display: flex;
  min-height: 54px;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding-left: 22px;
}
.pit-day-axis::before {
  position: absolute;
  top: -18px;
  bottom: -18px;
  left: 7px;
  width: 1px;
  background: var(--border);
  content: '';
}
.pit-day:first-child .pit-day-axis::before { top: 50%; }
.pit-day:last-child .pit-day-axis::before { bottom: 50%; }
.pit-day-axis i {
  position: absolute;
  top: 50%;
  left: 3px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  transform: translateY(-50%);
}
.pit-day-axis b {
  color: var(--text);
  font-size: var(--fs-caption);
  font-weight: 700;
}
.pit-day-axis span {
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
}
.pit-cards {
  display: grid;
  grid-template-columns: repeat(var(--pit-cols, 4), minmax(0, 1fr));
  min-width: 0;
  gap: 8px;
}
.pit-card {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 96px;
  grid-template-rows: auto minmax(36px, auto) auto auto;
  gap: 5px;
  padding: 11px 12px 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kind-color) 22%, var(--border));
  border-left: 3px solid var(--kind-color);
  border-radius: 12px;
  background: color-mix(in srgb, var(--kind-color) 5%, var(--surface));
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur), background var(--dur), transform var(--dur), box-shadow var(--dur);
}
.pit-card:hover {
  border-color: color-mix(in srgb, var(--kind-color) 45%, var(--border));
  background: color-mix(in srgb, var(--kind-color) 9%, var(--surface));
  box-shadow: 0 8px 20px color-mix(in srgb, var(--text) 7%, transparent);
  transform: translateY(-1px);
}
.pit-kind {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--kind-color) 13%, var(--surface));
  color: color-mix(in srgb, var(--kind-color) 78%, var(--text));
  font-size: var(--fs-tiny);
  font-weight: 700;
}
.pit-card-title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-caption);
  font-weight: 700;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pit-card-meta {
  overflow: hidden;
  color: var(--text-3);
  font-size: var(--fs-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pit-card-foot {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.pit-status {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: color-mix(in srgb, var(--status-color) 72%, var(--text));
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pit-status i {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: var(--status-color);
}
.pit-count { flex: none; }
.pit-time {
  margin-left: auto;
  flex: none;
  font-variant-numeric: tabular-nums;
}
.pit-action {
  position: absolute;
  top: 10px;
  right: 11px;
  color: var(--text-2);
  font-size: var(--fs-tiny);
}
.pit-empty {
  display: grid;
  min-height: 190px;
  place-items: center;
  align-content: center;
  gap: 7px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  color: var(--text-3);
  text-align: center;
}
.pit-empty b { color: var(--text-2); }
.pit-empty span { font-size: var(--fs-caption); }
@media (max-width: 760px) {
  .pit-body { padding: 0 16px 18px; }
  .pit-tools { align-items: stretch; flex-direction: column; }
  .pit-tool-actions { justify-content: space-between; }
  .pit-filter { width: 100%; }
  .pit-filter button { flex: 1; padding: 0 5px; }
  .pit-day { grid-template-columns: 1fr; gap: 9px; }
  .pit-day-axis { min-height: 24px; padding-left: 18px; }
  .pit-day-axis::before { display: none; }
  .pit-day-axis i { left: 0; }
  .pit-cards { grid-template-columns: 1fr; }
  .pit-card { width: 100%; }
}
</style>
