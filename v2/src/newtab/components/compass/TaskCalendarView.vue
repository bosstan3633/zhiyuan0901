<script setup lang="ts">
/**
 * 任务月历：左侧全部任务，右侧按计划执行日期落位。
 *
 * 月历只负责“排期/取消排期”，不提供删除入口；真正删除任务仍只在卡片池详情里完成。
 * 底层日期继续使用 TaskCard.dueDate，避免新增第二份计划日期字段。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { FocusSlot, TaskCard, TopicCard, TopicStatusDef } from '@/shared/models'
import Icon from '@/shared/components/Icon.vue'
import Modal from '@/shared/components/Modal.vue'
import { isTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'

const props = withDefaults(defineProps<{
  tasks: TaskCard[]
  /** 左侧清单经过筛选，但今日格必须从全量任务中解析 dailyFocus。 */
  focusTasks?: TaskCard[]
  /** 今日格必须直接消费 dailyFocus，与任务/选题页签及今日三件事同源。 */
  topics?: TopicCard[]
  topicStatuses?: TopicStatusDef[]
  focusSlots?: FocusSlot[]
  showDone?: boolean
  projectNames: Map<string, string>
  metricNames: Map<string, string>
}>(), {
  topics: () => [],
  topicStatuses: () => [],
  focusSlots: () => [],
  showDone: true,
})

const emit = defineEmits<{
  (e: 'open-task', task: TaskCard): void
  (e: 'open-topic', topic: TopicCard): void
  (e: 'toggle-status', taskId: string): void
  (e: 'toggle-topic-status', topicId: string): void
  (e: 'assign-task', task: TaskCard): void
  (e: 'focus-task', task: TaskCard): void
  (e: 'set-due', taskId: string, date: string): void
  (e: 'clear-due', taskId: string): void
  (e: 'set-topic-due', topicId: string, date: string): void
  (e: 'clear-topic-due', topicId: string): void
}>()

type CalendarEntry =
  | { key: string; kind: 'task'; task: TaskCard; slot?: FocusSlot }
  | { key: string; kind: 'topic'; topic: TopicCard; slot?: FocusSlot }

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const monthCursor = ref(startOfMonth(new Date()))
const weekCursor = ref(startOfWeek(new Date()))
const calendarMode = ref<'month' | 'week'>('month')
const monthPickerOpen = ref(false)
const monthPickerYear = ref(monthCursor.value.getFullYear())
const selectedDay = ref('')
const selectedDayMode = ref<'detail' | 'schedule'>('detail')
const scheduleSearch = ref('')
const mobileMode = ref<'list' | 'calendar'>('list')
const dragOverDay = ref('')
const menuTaskId = ref('')
const quickDueDraft = ref('')
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

function shiftMonth(delta: number): void {
  monthCursor.value = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth() + delta,
    1,
    12,
  )
  monthPickerYear.value = monthCursor.value.getFullYear()
}

function shiftPeriod(delta: number): void {
  if (calendarMode.value === 'month') {
    shiftMonth(delta)
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
  closeTaskMenu()
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
  closeTaskMenu()
  openDay(dateKey(now))
}

function toggleMonthPicker(): void {
  closeTaskMenu()
  monthPickerYear.value = monthCursor.value.getFullYear()
  monthPickerOpen.value = !monthPickerOpen.value
}

function shiftPickerYear(delta: number): void {
  monthPickerYear.value += delta
}

function selectMonth(month: number): void {
  monthCursor.value = new Date(monthPickerYear.value, month, 1, 12)
  monthPickerOpen.value = false
}

const todayKey = computed(() => dateKey(new Date()))
const monthTitle = computed(() =>
  `${monthCursor.value.getFullYear()} 年 ${monthCursor.value.getMonth() + 1} 月`)
const periodTitle = computed(() => {
  if (calendarMode.value === 'month') return monthTitle.value
  const end = new Date(weekCursor.value)
  end.setDate(end.getDate() + 6)
  const startMonth = weekCursor.value.getMonth() + 1
  const endMonth = end.getMonth() + 1
  const range = startMonth === endMonth
    ? `${startMonth} 月 ${weekCursor.value.getDate()}–${end.getDate()} 日`
    : `${startMonth}/${weekCursor.value.getDate()}–${endMonth}/${end.getDate()}`
  return `${weekCursor.value.getFullYear()} 年 ${range}`
})

const scheduledTasks = computed(() =>
  props.tasks.filter(task =>
    /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '')
    && task.dueDate !== todayKey.value
    && (props.showDone !== false || task.status !== 'done')))
const pendingPoolTasks = computed(() =>
  props.tasks.filter(task => !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '')))
const monthScheduledTasks = computed(() => {
  const prefix = dateKey(monthCursor.value).slice(0, 7)
  return scheduledTasks.value.filter(task => (task.dueDate || '').startsWith(prefix))
})

const tasksByDay = computed(() => {
  const map = new Map<string, TaskCard[]>()
  for (const task of scheduledTasks.value) {
    const key = task.dueDate as string
    const rows = map.get(key) || []
    rows.push(task)
    map.set(key, rows)
  }
  for (const rows of map.values()) rows.sort(taskOrder)
  return map
})

/**
 * 今日格只认 dailyFocus：同一天即使任务/选题卡上的 dueDate 暂时未收敛，
 * 也不会在日历里多出第 4 项或漏掉三件事里的项。
 */
const focusEntries = computed<CalendarEntry[]>(() => {
  const tasks = new Map((props.focusTasks || props.tasks).map(task => [task.id, task]))
  const topics = new Map(props.topics.map(topic => [topic.id, topic]))
  const out: CalendarEntry[] = []
  for (const slot of props.focusSlots) {
    if (!slot || slot.cleared || !slot.sourceId) continue
    if (slot.sourceType === 'task') {
      const task = tasks.get(slot.sourceId)
      if (task) out.push({ key: `task:${task.id}`, kind: 'task', task, slot })
    } else if (slot.sourceType === 'topic') {
      const topic = topics.get(slot.sourceId)
      if (topic) out.push({ key: `topic:${topic.id}`, kind: 'topic', topic, slot })
    }
  }
  return out
})

const entriesByDay = computed(() => {
  const map = new Map<string, CalendarEntry[]>()
  for (const [key, tasks] of tasksByDay.value) {
    map.set(key, tasks.map(task => ({ key: `task:${task.id}`, kind: 'task' as const, task })))
  }
  if (focusEntries.value.length) map.set(todayKey.value, focusEntries.value)
  else map.delete(todayKey.value)
  return map
})

const calendarDays = computed(() => {
  const gridStart = calendarMode.value === 'week'
    ? new Date(weekCursor.value)
    : (() => {
        const first = monthCursor.value
        const mondayOffset = (first.getDay() + 6) % 7
        const start = new Date(first)
        start.setDate(first.getDate() - mondayOffset)
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
  // 今日格必须保持 dailyFocus 的槽位顺序；其他日期仍按任务状态排序。
  return selectedDay.value === todayKey.value ? rows : rows.sort(entryOrder)
})
const selectedTitle = computed(() => {
  if (!selectedDay.value) return ''
  const date = dateOfKey(selectedDay.value)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekdays[(date.getDay() + 6) % 7]}`
})

const poolTasks = computed(() => [...props.tasks].sort(poolOrder))

function taskOrder(a: TaskCard, b: TaskCard): number {
  const rank: Record<TaskCard['status'], number> = { doing: 0, todo: 1, done: 2 }
  return rank[a.status] - rank[b.status]
    || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (b.updatedAt || 0) - (a.updatedAt || 0)
}

function poolOrder(a: TaskCard, b: TaskCard): number {
  const aDate = /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate || '') ? a.dueDate as string : ''
  const bDate = /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate || '') ? b.dueDate as string : ''
  if (!aDate && bDate) return -1
  if (aDate && !bDate) return 1
  return aDate.localeCompare(bDate) || taskOrder(a, b)
}

function entryOrder(a: CalendarEntry, b: CalendarEntry): number {
  if (a.kind === 'task' && b.kind === 'topic') return -1
  if (a.kind === 'topic' && b.kind === 'task') return 1
  return a.kind === 'task'
    ? taskOrder(a.task, (b as { task: TaskCard }).task)
    : topicOrder(a.topic, (b as { topic: TopicCard }).topic)
}

function visibleCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.slice(0, calendarMode.value === 'week' ? 12 : 3)
}

function hiddenCalendarEntryCount(entries: CalendarEntry[]): number {
  return Math.max(0, entries.length - (calendarMode.value === 'week' ? 12 : 3))
}

function statusLabel(status: TaskCard['status']): string {
  return status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'
}

function projectLabel(card: TaskCard | TopicCard): string {
  return (card.projectId && props.projectNames.get(card.projectId)) || '未归档'
}

function metricLabel(card: TaskCard | TopicCard): string {
  return (card.metricId && props.metricNames.get(card.metricId)) || ''
}

function isMissing(task: TaskCard): boolean {
  return !task.projectId || !task.metricId
}

function isOverdue(task: TaskCard): boolean {
  return task.status !== 'done' && !!task.dueDate && task.dueDate < todayKey.value
}

type CalendarTone = 'done' | 'today' | 'future' | 'overdue' | 'past'

function taskTone(task: TaskCard): CalendarTone {
  if (task.status === 'done') return 'done'
  if (task.dueDate === todayKey.value) return 'today'
  if (task.dueDate && task.dueDate > todayKey.value) return 'future'
  if (task.dueDate && task.dueDate < todayKey.value) return 'overdue'
  return 'past'
}

function topicOrder(a: TopicCard, b: TopicCard): number {
  const statuses = [...props.topicStatuses].sort((x, y) => x.order - y.order)
  const rank = new Map(statuses.map((status, index) => [status.id, index]))
  return (rank.get(a.statusId) ?? 0) - (rank.get(b.statusId) ?? 0)
    || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (b.updatedAt || 0) - (a.updatedAt || 0)
}

function topicStatusLabel(topic: TopicCard): string {
  return topicStatusOf({ topicStatuses: props.topicStatuses }, topic.statusId)?.name || '构思中'
}

function topicTone(topic: TopicCard): CalendarTone {
  if (isTopicDone({ topicStatuses: props.topicStatuses }, topic)) return 'done'
  if (topic.dueDate === todayKey.value) return 'today'
  if (topic.dueDate && topic.dueDate > todayKey.value) return 'future'
  if (topic.dueDate && topic.dueDate < todayKey.value) return 'overdue'
  return 'past'
}

function topicStatusStyle(topic: TopicCard): Record<string, string> {
  return { '--topic-status': topicStatusOf({ topicStatuses: props.topicStatuses }, topic.statusId)?.color || 'var(--accent)' }
}

function friendlyDate(key?: string): string {
  if (!key) return '未排期'
  const date = dateOfKey(key)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function onDragStart(event: DragEvent, task: TaskCard): void {
  draggingId = `task:${task.id}`
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', draggingId)
  }
}

function onTopicDragStart(event: DragEvent, topic: TopicCard): void {
  draggingId = `topic:${topic.id}`
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', draggingId)
  }
}

function draggedPayload(event: DragEvent): string {
  return event.dataTransfer?.getData('text/plain') || draggingId
}

function dropOnDay(event: DragEvent, day: string): void {
  event.preventDefault()
  const payload = draggedPayload(event)
  draggingId = ''
  dragOverDay.value = ''
  if (!payload) return
  const [kind, id] = payload.includes(':') ? payload.split(':', 2) : ['task', payload]
  if (kind === 'topic') emit('set-topic-due', id, day)
  else emit('set-due', id, day)
}

function dropUnscheduled(event: DragEvent): void {
  event.preventDefault()
  const payload = draggedPayload(event)
  draggingId = ''
  dragOverDay.value = ''
  if (!payload) return
  const [kind, id] = payload.includes(':') ? payload.split(':', 2) : ['task', payload]
  if (kind === 'topic') emit('clear-topic-due', id)
  else emit('clear-due', id)
}

function openDay(key: string): void {
  selectedDay.value = key
  selectedDayMode.value = 'detail'
  scheduleSearch.value = ''
}

function closeDay(): void {
  selectedDay.value = ''
  selectedDayMode.value = 'detail'
  scheduleSearch.value = ''
}

const scheduleCandidates = computed(() => {
  const q = scheduleSearch.value.trim().toLowerCase()
  return props.tasks
    .filter(task => task.status !== 'done')
    .filter(task => !selectedDay.value || task.dueDate !== selectedDay.value)
    .filter(task => !q || `${task.title} ${projectLabel(task)} ${metricLabel(task)}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const aDate = a.dueDate || ''
      const bDate = b.dueDate || ''
      if (!aDate && bDate) return -1
      if (aDate && !bDate) return 1
      return aDate.localeCompare(bDate) || taskOrder(a, b)
    })
    .slice(0, 40)
})

function scheduleToSelectedDay(task: TaskCard): void {
  if (!selectedDay.value) return
  emit('set-due', task.id, selectedDay.value)
  selectedDayMode.value = 'detail'
}

function toggleTaskMenu(task: TaskCard): void {
  if (menuTaskId.value === task.id) {
    closeTaskMenu()
    return
  }
  menuTaskId.value = task.id
  quickDueDraft.value = task.dueDate || ''
}

function closeTaskMenu(): void {
  menuTaskId.value = ''
  quickDueDraft.value = ''
}

function applyQuickDue(task: TaskCard): void {
  if (!quickDueDraft.value) {
    emit('clear-due', task.id)
  } else {
    emit('set-due', task.id, quickDueDraft.value)
  }
  closeTaskMenu()
}

function openTaskFromDay(task: TaskCard): void {
  closeDay()
  emit('open-task', task)
}

function openEntry(entry: CalendarEntry): void {
  if (entry.kind === 'topic') {
    closeDay()
    emit('open-topic', entry.topic)
    return
  }
  emit('open-task', entry.task)
}

function toggleEntryStatus(entry: CalendarEntry): void {
  if (entry.kind === 'topic') emit('toggle-topic-status', entry.topic.id)
  else emit('toggle-status', entry.task.id)
}

function clearEntryDue(entry: CalendarEntry): void {
  if (entry.kind === 'topic') emit('clear-topic-due', entry.topic.id)
  else emit('clear-due', entry.task.id)
}

function onDocClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (menuTaskId.value && !target?.closest('.cal-task-menu, .cal-task-menu-trigger')) {
    closeTaskMenu()
  }
  if (monthPickerOpen.value && !target?.closest('.cal-month-picker, .cal-month-picker-trigger')) {
    monthPickerOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="task-calendar" :class="'mobile-' + mobileMode">
    <div class="cal-mobile-switch" role="tablist" aria-label="窄屏任务视图">
      <button type="button" role="tab" :aria-selected="mobileMode === 'list'" :class="{ on: mobileMode === 'list' }" @click="mobileMode = 'list'">任务列表</button>
      <button type="button" role="tab" :aria-selected="mobileMode === 'calendar'" :class="{ on: mobileMode === 'calendar' }" @click="mobileMode = 'calendar'">月历</button>
    </div>

    <section class="cal-pool" aria-label="任务池">
      <header class="cal-pool-head">
        <div>
          <b>任务清单</b>
          <span>{{ poolTasks.length }} 项当前筛选结果 · 未落图在前</span>
        </div>
        <span class="cal-pool-stat">{{ monthScheduledTasks.length }} 本月已排</span>
      </header>

      <div class="cal-unscheduled" @dragover.prevent @drop="dropUnscheduled">
        <Icon name="calendar" :size="13" />
        <span><b>{{ pendingPoolTasks.length }} 项未落图</b><small>已落图任务按日期排在后面；拖回此处可取消排期</small></span>
      </div>

      <div class="cal-pool-list">
        <div v-for="task in poolTasks" :key="task.id" class="cal-pool-item">
          <article
            class="cal-pool-task"
            :class="'is-' + task.status"
            draggable="true"
            tabindex="0"
            @dragstart="onDragStart($event, task)"
            @dragend="draggingId = ''; dragOverDay = ''"
            @click="emit('open-task', task)"
            @keydown.enter.prevent="emit('open-task', task)"
          >
            <span class="cal-drag"><Icon name="menu" :size="12" /></span>
            <button
              class="cal-check"
              :class="'is-' + task.status"
              type="button"
              :aria-label="task.status === 'done' ? '恢复为待开始' : '标记完成'"
              @click.stop="emit('toggle-status', task.id)"
            >
              <Icon v-if="task.status === 'done'" name="check" :size="10" />
            </button>
            <span class="cal-task-copy">
              <b>{{ task.title }}</b>
              <small>
                <span>{{ projectLabel(task) }}</span>
                <span v-if="metricLabel(task)">› {{ metricLabel(task) }}</span>
                <span class="cal-pool-plan" :class="{ scheduled: !!task.dueDate }">
                  <Icon name="calendar" :size="10" />
                  {{ task.dueDate ? `落图 ${friendlyDate(task.dueDate)}` : '未落图' }}
                </span>
                <span v-if="isOverdue(task)" class="cal-warn">已逾期</span>
                <button v-if="isMissing(task)" class="cal-assign" type="button" @click.stop="emit('assign-task', task)">去归位</button>
              </small>
            </span>
            <span class="cal-status" :class="'is-' + task.status">{{ statusLabel(task.status) }}</span>
            <button
              class="cal-task-menu-trigger"
              type="button"
              aria-label="任务操作"
              :aria-expanded="menuTaskId === task.id"
              @click.stop="toggleTaskMenu(task)"
            >
              <Icon name="more" :size="13" />
            </button>
          </article>
          <div v-if="menuTaskId === task.id" class="cal-task-menu" role="menu">
            <div class="cal-task-menu-note">{{ friendlyDate(task.dueDate) }} · {{ projectLabel(task) }}</div>
            <button type="button" role="menuitem" @click="emit('open-task', task); closeTaskMenu()">
              <Icon name="arrowright" :size="12" /> 打开任务详情
            </button>
            <button type="button" role="menuitem" @click="emit('focus-task', task); closeTaskMenu()">
              <Icon name="target" :size="12" /> 设为今日重点
            </button>
            <label class="cal-task-menu-date">
              <span><Icon name="calendar" :size="12" /> 修改计划执行日期</span>
              <span class="cal-task-menu-date-row">
                <input v-model="quickDueDraft" type="date" aria-label="修改计划执行日期">
                <button type="button" @click="applyQuickDue(task)">保存</button>
              </span>
            </label>
            <button v-if="task.dueDate" type="button" role="menuitem" @click="emit('clear-due', task.id); closeTaskMenu()">
              <Icon name="x" :size="12" /> 取消排期（回到卡片池）
            </button>
            <button type="button" role="menuitem" @click="emit('assign-task', task); closeTaskMenu()">
              <Icon name="package" :size="12" /> {{ isMissing(task) ? '去归位' : '调整项目 / 成功指标' }}
            </button>
          </div>
        </div>
        <div v-if="!poolTasks.length" class="cal-empty">
          <Icon name="clipboard" :size="20" />
          <b>当前筛选没有任务</b>
          <span>调整上方项目、状态或搜索条件后再看。</span>
        </div>
      </div>
    </section>

    <section class="cal-board" aria-label="任务月历">
      <header class="cal-board-head">
        <div class="cal-month-title">
          <div class="cal-title-row">
            <button v-if="calendarMode === 'month'" class="cal-month-picker-trigger" type="button" :aria-expanded="monthPickerOpen" @click.stop="toggleMonthPicker">
              <b>{{ periodTitle }}</b>
              <Icon name="arrowdown" :size="13" />
            </button>
            <b v-else class="cal-week-title">{{ periodTitle }}</b>
            <div class="cal-view-switch" role="group" aria-label="日历视图切换">
              <button type="button" :class="{ on: calendarMode === 'month' }" :aria-pressed="calendarMode === 'month'" @click="setCalendarMode('month')">月视图</button>
              <button type="button" :class="{ on: calendarMode === 'week' }" :aria-pressed="calendarMode === 'week'" @click="setCalendarMode('week')">周视图</button>
            </div>
          </div>
          <span>拖动任务安排计划执行日期；点任务查看详情</span>
          <div class="cal-tone-legend" aria-label="任务颜色说明">
            <span class="tone-done">已完成</span>
            <span class="tone-today">今日</span>
            <span class="tone-future">待执行</span>
            <span class="tone-overdue">逾期</span>
          </div>
          <div v-if="monthPickerOpen" class="cal-month-picker" role="dialog" aria-label="选择月份">
            <header>
              <button type="button" aria-label="上一年" @click="shiftPickerYear(-1)"><Icon name="arrowleft" :size="13" /></button>
              <b>{{ monthPickerYear }} 年</b>
              <button type="button" aria-label="下一年" @click="shiftPickerYear(1)"><Icon name="arrowright" :size="13" /></button>
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
          <button type="button" :title="calendarMode === 'week' ? '上一周' : '上个月'" :aria-label="calendarMode === 'week' ? '上一周' : '上个月'" @click="shiftPeriod(-1)"><Icon name="arrowleft" :size="14" /></button>
          <button class="cal-today" type="button" @click="goToday">今天</button>
          <button type="button" :title="calendarMode === 'week' ? '下一周' : '下个月'" :aria-label="calendarMode === 'week' ? '下一周' : '下个月'" @click="shiftPeriod(1)"><Icon name="arrowright" :size="14" /></button>
        </div>
      </header>

      <div class="cal-board-body">
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
            :data-drop="`安排到 ${cell.day} 日`"
            @dragover.prevent
            @dragenter.prevent="dragOverDay = cell.key"
            @dragleave.self="dragOverDay = ''"
            @drop="dropOnDay($event, cell.key)"
          >
            <button class="cal-day-head" type="button" @click="openDay(cell.key)">
              <span>{{ cell.day }}</span>
              <small v-if="cell.entries.length">{{ cell.entries.length }}</small>
            </button>
            <div class="cal-day-list">
              <template v-for="entry in visibleCalendarEntries(cell.entries)" :key="entry.key">
                <div
                  v-if="entry.kind === 'task'"
                  class="cal-task-chip"
                  :class="['is-' + entry.task.status, 'tone-' + taskTone(entry.task)]"
                  draggable="true"
                  tabindex="0"
                  :title="entry.task.title"
                  @dragstart="onDragStart($event, entry.task)"
                  @dragend="draggingId = ''; dragOverDay = ''"
                  @click="emit('open-task', entry.task)"
                  @keydown.enter.prevent="emit('open-task', entry.task)"
                >
                  <button
                    class="cal-chip-check"
                    :class="'is-' + entry.task.status"
                    type="button"
                    :aria-label="entry.task.status === 'done' ? '恢复为待开始' : '标记完成'"
                    @click.stop="emit('toggle-status', entry.task.id)"
                  >
                    <Icon v-if="entry.task.status === 'done'" name="check" :size="8" />
                  </button>
                  <span class="cal-chip-copy">
                    <span class="cal-chip-title">{{ entry.task.title }}</span>
                    <span v-if="calendarMode === 'week'" class="cal-chip-meta">
                      <span>{{ projectLabel(entry.task) }}</span>
                      <span v-if="metricLabel(entry.task)">› {{ metricLabel(entry.task) }}</span>
                      <em :class="'is-' + entry.task.status">{{ statusLabel(entry.task.status) }}</em>
                    </span>
                  </span>
                  <button type="button" title="取消计划执行日期并回到任务池" aria-label="取消排期" @click.stop="emit('clear-due', entry.task.id)">
                    <Icon name="x" :size="10" />
                  </button>
                </div>
                <div
                  v-else
                  class="cal-task-chip cal-topic-chip"
                  :class="['tone-' + topicTone(entry.topic), { 'is-done': isTopicDone({ topicStatuses: topicStatuses }, entry.topic) }]"
                  :style="topicStatusStyle(entry.topic)"
                  draggable="true"
                  tabindex="0"
                  :title="entry.topic.title"
                  @dragstart="onTopicDragStart($event, entry.topic)"
                  @dragend="draggingId = ''; dragOverDay = ''"
                  @click="emit('open-topic', entry.topic)"
                  @keydown.enter.prevent="emit('open-topic', entry.topic)"
                >
                  <button
                    class="cal-chip-check"
                    :class="{ 'is-done': isTopicDone({ topicStatuses: topicStatuses }, entry.topic) }"
                    type="button"
                    :aria-label="isTopicDone({ topicStatuses: topicStatuses }, entry.topic) ? '恢复选题' : '标记选题完成'"
                    @click.stop="emit('toggle-topic-status', entry.topic.id)"
                  >
                    <Icon v-if="isTopicDone({ topicStatuses: topicStatuses }, entry.topic)" name="check" :size="8" />
                  </button>
                  <span class="cal-chip-copy">
                    <span class="cal-chip-title"><em class="cal-topic-kind">选题</em>{{ entry.topic.title }}</span>
                    <span v-if="calendarMode === 'week'" class="cal-chip-meta">
                      <span>{{ projectLabel(entry.topic) }}</span>
                      <span v-if="metricLabel(entry.topic)">› {{ metricLabel(entry.topic) }}</span>
                      <em class="is-topic">{{ topicStatusLabel(entry.topic) }}</em>
                    </span>
                  </span>
                  <button type="button" title="取消计划执行日期并移出今日三件事" aria-label="取消排期" @click.stop="emit('clear-topic-due', entry.topic.id)">
                    <Icon name="x" :size="10" />
                  </button>
                </div>
              </template>
              <button v-if="hiddenCalendarEntryCount(cell.entries)" class="cal-more" type="button" @click="openDay(cell.key)">
                +{{ hiddenCalendarEntryCount(cell.entries) }} 更多
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <Modal
      :open="!!selectedDay"
      width="min(560px, 94vw)"
      max-height="min(78vh, 720px)"
      @close="closeDay"
    >
      <template #title>
        {{ selectedDayMode === 'detail' ? selectedTitle : `安排到 ${selectedTitle}` }}
      </template>
      <template #sub>
        <span v-if="selectedDayMode === 'detail'">{{ selectedEntries.length }} 项今日计划 · 与今日三件事严格同源</span>
        <span v-else>排到今日会同步进入今日三件事；其他日期只修改计划执行日期</span>
      </template>

      <div v-if="selectedDayMode === 'detail'" class="cal-day-modal-body">
        <template v-for="entry in selectedEntries" :key="entry.key">
          <article
            v-if="entry.kind === 'task'"
            class="cal-modal-task"
            :class="['is-' + entry.task.status, 'tone-' + taskTone(entry.task)]"
          >
            <button
              class="cal-check"
              :class="'is-' + entry.task.status"
              type="button"
              :aria-label="entry.task.status === 'done' ? '恢复为待开始' : '标记完成'"
              @click="emit('toggle-status', entry.task.id)"
            >
              <Icon v-if="entry.task.status === 'done'" name="check" :size="11" />
            </button>
            <button class="cal-modal-copy" type="button" @click="openTaskFromDay(entry.task)">
              <b>{{ entry.task.title }}</b>
              <small>{{ projectLabel(entry.task) }}<template v-if="metricLabel(entry.task)"> › {{ metricLabel(entry.task) }}</template><template v-if="isOverdue(entry.task)"> · 已逾期</template></small>
            </button>
            <span class="cal-modal-side">
              <button v-if="isMissing(entry.task)" class="cal-assign" type="button" @click="emit('assign-task', entry.task)">去归位</button>
              <em :class="'is-' + entry.task.status">{{ statusLabel(entry.task.status) }}</em>
            </span>
            <button class="cal-modal-close" type="button" title="取消排期" @click.stop="emit('clear-due', entry.task.id)"><Icon name="x" :size="12" /></button>
          </article>
          <article
            v-else
            class="cal-modal-task cal-topic-modal"
            :class="['tone-' + topicTone(entry.topic), { 'tone-done': isTopicDone({ topicStatuses: topicStatuses }, entry.topic) }]"
            :style="topicStatusStyle(entry.topic)"
          >
            <button
              class="cal-check"
              :class="{ 'is-done': isTopicDone({ topicStatuses: topicStatuses }, entry.topic) }"
              type="button"
              :aria-label="isTopicDone({ topicStatuses: topicStatuses }, entry.topic) ? '恢复选题' : '标记选题完成'"
              @click="emit('toggle-topic-status', entry.topic.id)"
            >
              <Icon v-if="isTopicDone({ topicStatuses: topicStatuses }, entry.topic)" name="check" :size="11" />
            </button>
            <button class="cal-modal-copy" type="button" @click="openEntry(entry)">
              <b><span class="cal-topic-kind">选题</span>{{ entry.topic.title }}</b>
              <small>{{ projectLabel(entry.topic) }}<template v-if="metricLabel(entry.topic)"> › {{ metricLabel(entry.topic) }}</template> · {{ topicStatusLabel(entry.topic) }}</small>
            </button>
            <span class="cal-modal-side">
              <em class="is-topic">{{ topicStatusLabel(entry.topic) }}</em>
            </span>
            <button class="cal-modal-close" type="button" title="取消排期并移出今日三件事" @click.stop="emit('clear-topic-due', entry.topic.id)"><Icon name="x" :size="12" /></button>
          </article>
        </template>
        <div v-if="!selectedEntries.length" class="cal-empty">
          <Icon name="calendar" :size="20" />
          <b>这一天还没有安排</b>
          <span>从左侧任务清单拖一张卡到该日期。</span>
        </div>
      </div>

      <div v-else class="cal-day-modal-body">
        <label class="cal-picker-search">
          <Icon name="search" :size="13" />
          <input v-model="scheduleSearch" placeholder="搜索任务或项目" aria-label="搜索待安排任务">
        </label>
        <div class="cal-schedule-list">
          <article v-for="task in scheduleCandidates" :key="task.id" class="cal-schedule-row">
            <span class="cal-schedule-copy">
              <b>{{ task.title }}</b>
              <small>{{ projectLabel(task) }} · {{ friendlyDate(task.dueDate) }} · {{ statusLabel(task.status) }}</small>
            </span>
            <button type="button" @click="scheduleToSelectedDay(task)">安排</button>
          </article>
          <div v-if="!scheduleCandidates.length" class="cal-empty">
            <Icon name="search" :size="20" />
            <b>没有匹配的可安排任务</b>
            <span>已完成任务不会进入排期候选。</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="cal-day-foot">
          <button v-if="selectedDayMode === 'detail'" type="button" @click="closeDay">回到整月</button>
          <button v-else type="button" @click="selectedDayMode = 'detail'">返回当日任务</button>
          <span />
          <button v-if="selectedDayMode === 'detail'" type="button" @click="selectedDayMode = 'schedule'; scheduleSearch = ''"><Icon name="plus" :size="12" /> 安排到此日</button>
          <button class="primary" type="button" @click="closeDay">{{ selectedDayMode === 'detail' ? '完成盘点' : '完成' }}</button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped src="./TaskCalendarView.css"></style>
