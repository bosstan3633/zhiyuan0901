<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TopicCard, TopicStatusDef } from '@/shared/models'
import Icon from '@/shared/components/Icon.vue'
import Modal from '@/shared/components/Modal.vue'

const props = withDefaults(defineProps<{
  topics: TopicCard[]
  statuses: TopicStatusDef[]
  showDone?: boolean
  projectNames: Map<string, string>
  metricNames: Map<string, string>
}>(), {
  showDone: true,
})

const emit = defineEmits<{
  (e: 'open-topic', topic: TopicCard): void
  (e: 'open-topic-link', topic: TopicCard): void
  (e: 'toggle-status', topicId: string): void
  (e: 'focus-topic', topic: TopicCard): void
  (e: 'set-due', topicId: string, date: string): void
  (e: 'clear-due', topicId: string): void
}>()

type CalendarEntry = { key: string; kind: 'topic'; topic: TopicCard }

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const monthCursor = ref(startOfMonth(new Date()))
const weekCursor = ref(startOfWeek(new Date()))
const calendarMode = ref<'month' | 'week'>('month')
const monthPickerOpen = ref(false)
const monthPickerYear = ref(monthCursor.value.getFullYear())
const selectedDay = ref('')
const dragOverDay = ref('')
let draggingId = ''

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12)
}

function startOfWeek(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7))
  return next
}

function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dateOfKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const todayKey = computed(() => dateKey(new Date()))
const sortedStatuses = computed(() => [...props.statuses].sort((a, b) => a.order - b.order))
const statusIndex = computed(() => new Map(sortedStatuses.value.map((status, index) => [status.id, index])))
const statusMap = computed(() => new Map(props.statuses.map(status => [status.id, status])))
const periodTitle = computed(() => {
  if (calendarMode.value === 'month') {
    return `${monthCursor.value.getFullYear()} 年 ${monthCursor.value.getMonth() + 1} 月`
  }
  const end = new Date(weekCursor.value)
  end.setDate(end.getDate() + 6)
  const sm = weekCursor.value.getMonth() + 1
  const em = end.getMonth() + 1
  const range = sm === em
    ? `${sm} 月 ${weekCursor.value.getDate()}–${end.getDate()} 日`
    : `${sm}/${weekCursor.value.getDate()}–${em}/${end.getDate()}`
  return `${weekCursor.value.getFullYear()} 年 ${range}`
})

function statusOf(topic: TopicCard): TopicStatusDef | undefined {
  return statusMap.value.get(topic.statusId) || sortedStatuses.value[0]
}

function isDone(topic: TopicCard): boolean {
  return !!statusOf(topic)?.terminal
}

const scheduled = computed(() => props.topics.filter(topic =>
  /^\d{4}-\d{2}-\d{2}$/.test(topic.dueDate || '')
  && (props.showDone !== false || !isDone(topic))))

const byDay = computed(() => {
  const map = new Map<string, TopicCard[]>()
  for (const topic of scheduled.value) {
    const key = topic.dueDate as string
    const rows = map.get(key) || []
    rows.push(topic)
    map.set(key, rows)
  }
  for (const rows of map.values()) rows.sort(topicOrder)
  return map
})

const entriesByDay = computed(() => {
  const map = new Map<string, CalendarEntry[]>()
  for (const [key, topics] of byDay.value) {
    map.set(key, topics.map(topic => ({ key: `topic:${topic.id}`, kind: 'topic' as const, topic })))
  }
  if (!map.has(todayKey.value)) map.set(todayKey.value, [])
  return map
})

const calendarDays = computed(() => {
  const gridStart = calendarMode.value === 'week'
    ? new Date(weekCursor.value)
    : (() => {
        const first = monthCursor.value
        const offset = (first.getDay() + 6) % 7
        const start = new Date(first)
        start.setDate(first.getDate() - offset)
        return start
      })()
  const length = calendarMode.value === 'week' ? 7 : 42
  return Array.from({ length }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      inMonth: calendarMode.value === 'week' || date.getMonth() === monthCursor.value.getMonth(),
      isToday: key === todayKey.value,
      entries: entriesByDay.value.get(key) || [],
    }
  })
})

const selectedEntries = computed(() => {
  const rows = [...(entriesByDay.value.get(selectedDay.value) || [])]
  return rows.sort((a, b) => topicOrder(a.topic, b.topic))
})
const selectedTitle = computed(() => {
  if (!selectedDay.value) return ''
  const date = dateOfKey(selectedDay.value)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekdays[(date.getDay() + 6) % 7]}`
})

function topicOrder(a: TopicCard, b: TopicCard): number {
  return (statusIndex.value.get(a.statusId) || 0) - (statusIndex.value.get(b.statusId) || 0)
    || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (b.updatedAt || 0) - (a.updatedAt || 0)
}

function shiftPeriod(delta: number): void {
  if (calendarMode.value === 'month') {
    monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + delta, 1, 12)
    monthPickerYear.value = monthCursor.value.getFullYear()
    return
  }
  const next = new Date(weekCursor.value)
  next.setDate(next.getDate() + delta * 7)
  weekCursor.value = next
  monthCursor.value = startOfMonth(next)
  monthPickerYear.value = next.getFullYear()
}

function setCalendarMode(mode: 'month' | 'week'): void {
  if (calendarMode.value === mode) return
  monthPickerOpen.value = false
  if (mode === 'week') {
    const currentMonth = todayKey.value.slice(0, 7)
    const monthKey = dateKey(monthCursor.value).slice(0, 7)
    const base = selectedDay.value
      ? dateOfKey(selectedDay.value)
      : monthKey === currentMonth
        ? new Date()
        : monthCursor.value
    weekCursor.value = startOfWeek(base)
  } else {
    monthCursor.value = startOfMonth(weekCursor.value)
    monthPickerYear.value = weekCursor.value.getFullYear()
  }
  calendarMode.value = mode
}

function goToday(): void {
  const now = new Date()
  monthCursor.value = startOfMonth(now)
  weekCursor.value = startOfWeek(now)
  monthPickerYear.value = now.getFullYear()
  monthPickerOpen.value = false
  selectedDay.value = dateKey(now)
}

function selectMonth(month: number): void {
  monthCursor.value = new Date(monthPickerYear.value, month, 1, 12)
  monthPickerOpen.value = false
}

function onDragStart(event: DragEvent, topic: TopicCard): void {
  draggingId = `topic:${topic.id}`
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', draggingId)
  }
}

function dropOnDay(event: DragEvent, day: string): void {
  event.preventDefault()
  const payload = event.dataTransfer?.getData('text/plain') || draggingId
  draggingId = ''
  dragOverDay.value = ''
  if (!payload) return
  const [kind, id] = payload.includes(':') ? payload.split(':', 2) : ['topic', payload]
  if (kind === 'topic') emit('set-due', id, day)
}

function visibleEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.slice(0, calendarMode.value === 'week' ? 12 : 3)
}

function hiddenCount(entries: CalendarEntry[]): number {
  return Math.max(0, entries.length - (calendarMode.value === 'week' ? 12 : 3))
}

function projectLabel(topic: TopicCard): string {
  return (topic.projectId && props.projectNames.get(topic.projectId)) || '未归档'
}

function metricLabel(topic: TopicCard): string {
  return (topic.metricId && props.metricNames.get(topic.metricId)) || ''
}

function statusStyle(topic: TopicCard): Record<string, string> {
  const status = statusOf(topic)
  return { '--topic-status': status?.color || 'var(--accent)' }
}

function openDay(key: string): void {
  selectedDay.value = key
}
</script>

<template>
  <section class="topic-calendar" aria-label="选题卡日历">
    <header class="cal-board-head">
      <div class="cal-month-title">
        <div class="cal-title-row">
          <button v-if="calendarMode === 'month'" class="cal-month-picker-trigger" type="button" :aria-expanded="monthPickerOpen" @click.stop="monthPickerOpen = !monthPickerOpen">
            <b>{{ periodTitle }}</b>
            <Icon name="arrowdown" :size="13" />
          </button>
          <b v-else class="cal-week-title">{{ periodTitle }}</b>
          <div class="cal-view-switch" role="group" aria-label="日历视图切换">
            <button type="button" :class="{ on: calendarMode === 'month' }" @click="setCalendarMode('month')">月视图</button>
            <button type="button" :class="{ on: calendarMode === 'week' }" @click="setCalendarMode('week')">周视图</button>
          </div>
        </div>
        <span>拖动选题安排计划日期；只呈现选题卡自己的落图，不混入任务与今日三件事</span>
        <div class="cal-tone-legend" aria-label="选题颜色说明">
          <span v-for="item in sortedStatuses" :key="item.id" :style="{ '--slot-color': item.color }">{{ item.name }}</span>
        </div>
        <div v-if="monthPickerOpen" class="cal-month-picker" role="dialog" aria-label="选择月份">
          <header>
            <button type="button" aria-label="上一年" @click.stop="monthPickerYear -= 1"><Icon name="arrowleft" :size="13" /></button>
            <b>{{ monthPickerYear }} 年</b>
            <button type="button" aria-label="下一年" @click.stop="monthPickerYear += 1"><Icon name="arrowright" :size="13" /></button>
          </header>
          <div class="cal-month-picker-grid">
            <button
              v-for="month in 12"
              :key="month"
              type="button"
              :class="{ on: monthPickerYear === monthCursor.getFullYear() && month - 1 === monthCursor.getMonth() }"
              @click="selectMonth(month - 1)"
            >{{ month }} 月</button>
          </div>
        </div>
      </div>
      <div class="cal-month-actions">
        <button type="button" title="上一段" @click="shiftPeriod(-1)"><Icon name="arrowleft" :size="14" /></button>
        <button class="cal-today" type="button" @click="goToday">今天</button>
        <button type="button" title="下一段" @click="shiftPeriod(1)"><Icon name="arrowright" :size="14" /></button>
      </div>
    </header>

    <div class="cal-board-body topic-cal-board">
      <div class="cal-weekdays" aria-hidden="true">
        <span v-for="day in weekdays" :key="day">周{{ day }}</span>
      </div>
      <div class="cal-grid" :class="{ 'is-week': calendarMode === 'week' }">
        <div
          v-for="cell in calendarDays"
          :key="cell.key"
          class="cal-day"
          :class="{ outside: !cell.inMonth, today: cell.isToday, over: dragOverDay === cell.key }"
          :data-day="cell.key"
          @dragover.prevent
          @dragenter.prevent="dragOverDay = cell.key"
          @dragleave.self="dragOverDay = ''"
          @drop="dropOnDay($event, cell.key)"
        >
          <button
            class="cal-day-head"
            type="button"
            :aria-label="`${cell.day} 日，共 ${cell.entries.length} 项${hiddenCount(cell.entries) ? '，还有更多' : ''}，点击查看详情`"
            @click="openDay(cell.key)"
          >
            <span>{{ cell.day }}</span>
            <small
              v-if="cell.entries.length"
              :class="{ 'cal-more-count': calendarMode === 'month' && hiddenCount(cell.entries) }"
            >{{ calendarMode === 'month' && hiddenCount(cell.entries) ? `+${hiddenCount(cell.entries)}` : cell.entries.length }}</small>
          </button>
          <div class="cal-day-list">
            <template v-for="entry in visibleEntries(cell.entries)" :key="entry.key">
              <button
                class="topic-cal-chip"
                type="button"
                :class="{ done: isDone(entry.topic) }"
                :style="statusStyle(entry.topic)"
                draggable="true"
                :title="entry.topic.title"
                @dragstart="onDragStart($event, entry.topic)"
                @dragend="draggingId = ''; dragOverDay = ''"
                @click="emit('open-topic', entry.topic)"
                @dblclick.stop.prevent="emit('open-topic-link', entry.topic)"
                @keydown.enter.prevent="emit('open-topic', entry.topic)"
              >
                <button class="cal-chip-check" :class="{ 'is-done': isDone(entry.topic) }" type="button" :aria-label="isDone(entry.topic) ? '恢复选题' : '标记完成'" @click.stop="emit('toggle-status', entry.topic.id)">
                  <Icon v-if="isDone(entry.topic)" name="check" :size="8" />
                </button>
                <span class="topic-cal-copy">
                  <span class="topic-cal-title"><em class="topic-entry-kind">选题</em>{{ entry.topic.title }}</span>
                  <span v-if="calendarMode === 'week'" class="topic-cal-meta">
                    <span>{{ projectLabel(entry.topic) }}</span>
                    <span v-if="metricLabel(entry.topic)">› {{ metricLabel(entry.topic) }}</span>
                    <em>{{ statusOf(entry.topic)?.name }}</em>
                  </span>
                </span>
                <button type="button" title="取消排期" @click.stop="emit('clear-due', entry.topic.id)"><Icon name="x" :size="10" /></button>
              </button>
            </template>
            <button v-if="calendarMode === 'week' && hiddenCount(cell.entries)" class="cal-more" type="button" @click="openDay(cell.key)">+{{ hiddenCount(cell.entries) }} 更多</button>
          </div>
        </div>
      </div>
    </div>

    <Modal :open="!!selectedDay" width="min(560px, 94vw)" max-height="min(78vh, 720px)" @close="selectedDay = ''">
      <template #title>{{ selectedTitle }}</template>
      <template #sub>{{ selectedEntries.length }} 项选题落图 · 只呈现选题卡自己的计划日期</template>
      <div class="cal-day-modal-body">
        <template v-for="entry in selectedEntries" :key="entry.key">
          <article class="topic-cal-modal-row" :class="{ done: isDone(entry.topic) }" :style="statusStyle(entry.topic)">
            <button class="cal-check" :class="{ 'is-done': isDone(entry.topic) }" type="button" @click="emit('toggle-status', entry.topic.id)">
              <Icon v-if="isDone(entry.topic)" name="check" :size="11" />
            </button>
            <button class="cal-modal-copy" type="button" @click="emit('open-topic', entry.topic)" @dblclick.stop.prevent="emit('open-topic-link', entry.topic)" @keydown.enter.prevent="emit('open-topic', entry.topic)">
              <b><span class="topic-entry-kind">选题</span>{{ entry.topic.title }}</b>
              <small>{{ projectLabel(entry.topic) }}<template v-if="metricLabel(entry.topic)"> › {{ metricLabel(entry.topic) }}</template></small>
            </button>
            <span class="topic-cal-modal-status">{{ statusOf(entry.topic)?.name }}</span>
            <button v-if="selectedDay === todayKey" class="topic-cal-focus" type="button" title="设为今日重点" @click="emit('focus-topic', entry.topic)"><Icon name="target" :size="12" /></button>
            <button class="cal-modal-close" type="button" title="取消排期" @click="emit('clear-due', entry.topic.id)"><Icon name="x" :size="12" /></button>
          </article>
        </template>
        <div v-if="!selectedEntries.length" class="cal-empty">
          <Icon name="calendar" :size="20" />
          <b>这一天还没有选题安排</b>
          <span>从左侧选题清单拖一张卡到该日期。</span>
        </div>
      </div>
      <template #footer>
        <div class="cal-day-foot"><span /><button class="primary" type="button" @click="selectedDay = ''">完成盘点</button></div>
      </template>
    </Modal>
  </section>
</template>

<style scoped src="./TaskCalendarView.css"></style>
<style scoped>
.topic-calendar {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
}
.topic-cal-board { flex: 1; min-height: 0; }
.topic-cal-chip {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) 14px;
  align-items: start;
  gap: 5px;
  min-width: 0;
  min-height: var(--cal-day-chip-height);
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, var(--topic-status) 36%, var(--border));
  border-left: 3px solid var(--topic-status);
  border-radius: 8px;
  background: color-mix(in srgb, var(--topic-status) 10%, var(--surface));
  color: var(--text);
  cursor: pointer;
}
.topic-cal-chip.done {
  border-color: var(--border);
  border-left-color: var(--border-strong);
  background: color-mix(in srgb, var(--surface-2) 76%, var(--surface));
  color: var(--text-3);
}
.topic-cal-chip.done .topic-cal-title { text-decoration: line-through; text-decoration-thickness: 1px; }
.topic-cal-chip.done .topic-cal-meta em { color: var(--text-3); }
.topic-cal-chip:hover { border-color: color-mix(in srgb, var(--topic-status) 68%, var(--border)); }
.topic-cal-chip.done:hover { border-color: var(--border-strong); background: var(--surface-2); }
.topic-cal-chip > button:last-child { padding: 0; border: 0; background: none; color: var(--text-2); cursor: pointer; }
.topic-cal-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.topic-cal-title { overflow: hidden; font-size: var(--fs-micro); font-weight: 650; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.topic-cal-meta { display: flex; min-width: 0; flex-wrap: wrap; gap: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.topic-cal-meta em { color: var(--topic-status); font-style: normal; font-weight: 650; }
.topic-entry-kind {
  display: inline-flex;
  align-items: center;
  margin-right: 4px;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--topic-status, var(--accent)) 13%, var(--surface));
  color: var(--topic-status, var(--accent-ink));
  font-size: 9px;
  font-style: normal;
  line-height: 1.5;
  vertical-align: 1px;
}
.cal-tone-legend span::before { background: var(--slot-color); }
.topic-cal-modal-row { display: flex; align-items: center; gap: 9px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.topic-cal-modal-row.done .cal-modal-copy b { color: var(--text-3); text-decoration: line-through; }
.topic-cal-modal-status { flex: none; padding: 2px 7px; border-radius: 99px; background: color-mix(in srgb, var(--topic-status) 12%, var(--surface-2)); color: var(--topic-status); font-size: var(--fs-micro); font-weight: 650; }
.topic-cal-focus { width: 26px; height: 26px; padding: 0; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--accent); cursor: pointer; }
@media (max-width: 1180px) {
  .topic-cal-board { width: 100%; min-width: 0; min-height: 0; }
}
@media (max-width: 760px) {
  .topic-calendar { min-height: 560px; }
}
</style>
