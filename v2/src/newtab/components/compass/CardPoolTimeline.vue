<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { showToast } from '@/shared/components/toast'
import type { AppData, CuriosityCard, TaskCard, TopicCard } from '@/shared/models'
import { EVENT_ACT_LABEL, type CardEvent, type EventAction } from '@/shared/utils/eventLog'
import { openExternalLink, toOpenableRawLink } from '@/shared/utils/link'
import { taskStatusOf } from '@/shared/utils/taskStatus'
import { topicStatusOf } from '@/shared/utils/topicStatus'

type PoolKind = 'task' | 'topic' | 'curiosity'
interface TimelineEntry {
  key: string
  id: string
  day: string
  ts: number
  action: string
  count: number
  title: string
  status: string
  statusColor: string
  link: string
}

const props = defineProps<{
  kind: PoolKind
  events: CardEvent[]
  data: AppData
  cards: { id: string }[]
}>()
const emit = defineEmits<{ select: [id: string] }>()
const TRACKED_ACTIONS = new Set<EventAction>(['create', 'edit', 'status'])
const KIND_META: Record<PoolKind, { label: string; icon: string; color: string }> = {
  task: { label: '任务', icon: 'check', color: 'var(--success)' },
  topic: { label: '选题', icon: 'layers', color: 'var(--warning)' },
  curiosity: { label: '好奇', icon: 'bulb', color: 'var(--accent-2)' },
}
let clickTimer: ReturnType<typeof setTimeout> | null = null
let clickEntryKey = ''

function dayKey(ts: number): string {
  const date = new Date(ts)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function cardOf(id: string): TaskCard | TopicCard | CuriosityCard | undefined {
  const source = props.kind === 'task' ? props.data.tasks
    : props.kind === 'topic' ? props.data.topics : props.data.curiosities
  return (source || []).find(card => card.id === id) as TaskCard | TopicCard | CuriosityCard | undefined
}

function titleOf(card: TaskCard | TopicCard | CuriosityCard): string {
  return props.kind === 'curiosity' ? (card as CuriosityCard).question : (card as TaskCard | TopicCard).title
}

function statusOf(card: TaskCard | TopicCard | CuriosityCard): { name: string; color: string } {
  if (props.kind === 'task') {
    const status = taskStatusOf(props.data, card as TaskCard)
    return { name: status?.name || '任务', color: status?.color || 'var(--success)' }
  }
  if (props.kind === 'topic') {
    const status = topicStatusOf(props.data, (card as TopicCard).statusId)
    return { name: status?.name || '选题', color: status?.color || 'var(--warning)' }
  }
  const status = (card as CuriosityCard).status
  return {
    name: status === 'done' ? '已求证' : status === 'doing' ? '探索中' : status === 'shelf' ? '已搁置' : '待探索',
    color: status === 'done' ? 'var(--success)' : status === 'doing' ? 'var(--accent)' : status === 'shelf' ? 'var(--text-4)' : 'var(--accent-2)',
  }
}

function linkOf(card: TaskCard | TopicCard | CuriosityCard): string {
  return props.kind === 'curiosity' ? (card as CuriosityCard).sourceUrl || '' : (card as TaskCard | TopicCard).link || ''
}

const groups = computed(() => {
  const allowed = new Set(props.cards.map(card => card.id))
  const byDayAndCard = new Map<string, TimelineEntry>()
  for (const event of props.events) {
    if (event.kind !== props.kind || !TRACKED_ACTIONS.has(event.action) || !allowed.has(event.cardId)) continue
    const card = cardOf(event.cardId)
    if (!card || card.deletedAt) continue
    const day = dayKey(event.ts)
    const key = `${day}:${event.cardId}`
    const existing = byDayAndCard.get(key)
    if (existing) {
      existing.count += 1
      if (event.ts >= existing.ts) {
        existing.ts = event.ts
        existing.action = EVENT_ACT_LABEL[event.action]
      }
      continue
    }
    const status = statusOf(card)
    byDayAndCard.set(key, {
      key, id: card.id, day, ts: event.ts, action: EVENT_ACT_LABEL[event.action], count: 1,
      title: titleOf(card) || '（无标题）', status: status.name, statusColor: status.color,
      link: linkOf(card),
    })
  }
  const days = new Map<string, TimelineEntry[]>()
  for (const entry of [...byDayAndCard.values()].sort((a, b) => b.ts - a.ts)) {
    const entries = days.get(entry.day) || []
    entries.push(entry)
    days.set(entry.day, entries)
  }
  return [...days.entries()].map(([day, entries]) => ({ day, entries }))
})

function dayLabel(day: string): string {
  const today = dayKey(Date.now())
  const yesterday = dayKey(Date.now() - 86400000)
  if (day === today) return '今天'
  if (day === yesterday) return '昨天'
  return day.slice(5).replace('-', ' / ')
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function clearClickTimer(): void {
  if (!clickTimer) return
  clearTimeout(clickTimer)
  clickTimer = null
  clickEntryKey = ''
}

function onCardClick(entry: TimelineEntry, event: MouseEvent): void {
  if (event.detail === 0) {
    clearClickTimer()
    emit('select', entry.id)
    return
  }
  if (clickTimer && clickEntryKey === entry.key) {
    clearClickTimer()
    return
  }
  clearClickTimer()
  clickEntryKey = entry.key
  clickTimer = setTimeout(() => {
    clickTimer = null
    clickEntryKey = ''
    emit('select', entry.id)
  }, 260)
}

function onCardDblClick(entry: TimelineEntry): void {
  clearClickTimer()
  const url = toOpenableRawLink(entry.link)
  if (!url) {
    showToast('该卡还没填链接')
    return
  }
  openExternalLink(url)
}

function kindMeta(): { label: string; icon: string; color: string } {
  return KIND_META[props.kind]
}

onBeforeUnmount(clearClickTimer)
</script>

<template>
  <section class="cpt" :aria-label="`${kind === 'task' ? '任务' : kind === 'topic' ? '选题' : '好奇心'}时间线`">
    <EmptyState v-if="!groups.length" size="section" icon="clock" title="暂无时间线记录"
      hint="新增卡片或推进状态后，会按自然日记录在这里。" />
    <div v-for="group in groups" :key="group.day" class="cpt-day">
      <header class="cpt-day-head"><b>{{ dayLabel(group.day) }}</b><span>{{ group.day }}</span><em>{{ group.entries.length }} 张</em></header>
      <div class="cpt-cards">
        <button
          v-for="entry in group.entries"
          :key="entry.key"
          type="button"
          class="cpt-card"
          :data-card-id="entry.id"
          :title="entry.link ? '单击查看详情 · 双击打开卡片链接' : '单击查看详情 · 双击时若未填链接会提示'"
          :style="{
            '--kind-color': kindMeta().color,
            '--status-color': entry.statusColor,
          }"
          @click="onCardClick(entry, $event)"
          @dblclick.stop.prevent="onCardDblClick(entry)"
        >
          <span class="cpt-card-top">
            <span class="cpt-kind"><Icon :name="kindMeta().icon" :size="11" />{{ kindMeta().label }}</span>
            <span class="cpt-action">{{ entry.action }}</span>
          </span>
          <span class="cpt-title">{{ entry.title }}</span>
          <span class="cpt-foot">
            <span class="cpt-status"><i />{{ entry.status }}</span>
            <span v-if="entry.count > 1" class="cpt-count">{{ entry.count }} 次记录</span>
            <time>{{ timeLabel(entry.ts) }}</time>
          </span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpt { display: grid; align-content: start; gap: 0; padding: 8px 0 20px; }
.cpt-day { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border); }
.cpt-day:last-child { border-bottom: 0; }
.cpt-day-head { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding-top: 4px; color: var(--text-3); font-size: var(--fs-tiny); }
.cpt-day-head b { color: var(--text); font-size: var(--fs-body); }
.cpt-day-head em { font-style: normal; }
.cpt-cards { display: grid; align-content: start; align-items: start; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); min-width: 0; gap: 9px; }
.cpt-card {
  position: relative;
  display: grid;
  align-self: start;
  min-width: 0;
  min-height: 104px;
  grid-template-rows: auto minmax(38px, auto) auto;
  gap: 7px;
  padding: 11px 12px 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kind-color) 22%, var(--border));
  border-left: 3px solid var(--kind-color);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--kind-color) 4%, var(--surface));
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast), transform var(--dur-fast), box-shadow var(--dur-fast);
}
.cpt-card:hover {
  border-color: color-mix(in srgb, var(--kind-color) 44%, var(--border));
  background: color-mix(in srgb, var(--kind-color) 8%, var(--surface));
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}
.cpt-card:active { transform: translateY(0); }
.cpt-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpt-card-top { display: flex; min-width: 0; align-items: center; gap: 8px; }
.cpt-kind {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--kind-color) 13%, var(--surface));
  color: color-mix(in srgb, var(--kind-color) 78%, var(--text));
  font-size: var(--fs-tiny);
  font-weight: 700;
}
.cpt-action {
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  color: var(--text-3);
  font-size: var(--fs-tiny);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cpt-title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-caption);
  font-weight: 700;
  line-height: 1.48;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.cpt-foot { display: flex; min-width: 0; align-items: center; gap: 7px; color: var(--text-3); font-size: var(--fs-tiny); }
.cpt-status {
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
.cpt-status i { width: 6px; height: 6px; flex: none; border-radius: var(--radius-full); background: var(--status-color); }
.cpt-count { flex: none; color: var(--text-4); }
.cpt-foot time { margin-left: auto; flex: none; font-variant-numeric: tabular-nums; }
@media (max-width: 720px) {
  .cpt-day { grid-template-columns: 1fr; gap: 8px; padding: 13px 0; }
  .cpt-day-head { flex-direction: row; align-items: baseline; padding-top: 0; }
  .cpt-cards { grid-template-columns: 1fr; }
}
</style>
