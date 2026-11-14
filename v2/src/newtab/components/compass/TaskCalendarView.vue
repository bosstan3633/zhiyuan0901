<script setup lang="ts">
/**
 * 任务月历：左侧全部任务，右侧按计划执行日期落位。
 *
 * 月历只负责“排期/取消排期”，不提供删除入口；真正删除任务仍只在卡片池详情里完成。
 * 底层日期继续使用 TaskCard.dueDate，避免新增第二份计划日期字段。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { TaskCard } from '@/shared/models'
import Icon from '@/shared/components/Icon.vue'
import Modal from '@/shared/components/Modal.vue'

const props = defineProps<{
  tasks: TaskCard[]
  projectNames: Map<string, string>
  metricNames: Map<string, string>
}>()

const emit = defineEmits<{
  (e: 'open-task', task: TaskCard): void
  (e: 'toggle-status', taskId: string): void
  (e: 'assign-task', task: TaskCard): void
  (e: 'focus-task', task: TaskCard): void
  (e: 'set-due', taskId: string, date: string): void
  (e: 'clear-due', taskId: string): void
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const monthCursor = ref(startOfMonth(new Date()))
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

function goToday(): void {
  const now = new Date()
  monthCursor.value = startOfMonth(now)
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

const scheduledTasks = computed(() =>
  props.tasks.filter(task => /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '')))
const pendingPoolTasks = computed(() =>
  props.tasks.filter(task =>
    task.status !== 'done'
    && !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || '')))
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

const calendarDays = computed(() => {
  const first = monthCursor.value
  const mondayOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = dateKey(date)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
      isToday: key === todayKey.value,
      tasks: tasksByDay.value.get(key) || [],
    }
  })
})

const selectedTasks = computed(() => tasksByDay.value.get(selectedDay.value) || [])
const selectedTitle = computed(() => {
  if (!selectedDay.value) return ''
  const date = dateOfKey(selectedDay.value)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekdays[(date.getDay() + 6) % 7]}`
})

const poolTasks = computed(() => [...pendingPoolTasks.value].sort(taskOrder))

function taskOrder(a: TaskCard, b: TaskCard): number {
  const rank: Record<TaskCard['status'], number> = { doing: 0, todo: 1, done: 2 }
  return rank[a.status] - rank[b.status]
    || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (b.updatedAt || 0) - (a.updatedAt || 0)
}

function statusLabel(status: TaskCard['status']): string {
  return status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'
}

function projectLabel(task: TaskCard): string {
  return (task.projectId && props.projectNames.get(task.projectId)) || '未归档'
}

function metricLabel(task: TaskCard): string {
  return (task.metricId && props.metricNames.get(task.metricId)) || ''
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

function friendlyDate(key?: string): string {
  if (!key) return '未排期'
  const date = dateOfKey(key)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function onDragStart(event: DragEvent, task: TaskCard): void {
  draggingId = task.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
}

function draggedId(event: DragEvent): string {
  return event.dataTransfer?.getData('text/plain') || draggingId
}

function dropOnDay(event: DragEvent, day: string): void {
  event.preventDefault()
  const id = draggedId(event)
  draggingId = ''
  dragOverDay.value = ''
  if (id) emit('set-due', id, day)
}

function dropUnscheduled(event: DragEvent): void {
  event.preventDefault()
  const id = draggedId(event)
  draggingId = ''
  dragOverDay.value = ''
  if (id) emit('clear-due', id)
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
          <b>待排期任务</b>
          <span>{{ poolTasks.length }} 项 · 拖到右侧日期即可排期</span>
        </div>
        <span class="cal-pool-stat">{{ monthScheduledTasks.length }} 本月已排</span>
      </header>

      <div class="cal-unscheduled" @dragover.prevent @drop="dropUnscheduled">
        <Icon name="calendar" :size="13" />
        <span><b>{{ pendingPoolTasks.length }} 项待排期</b><small>从月历拖回此处可取消计划执行日期</small></span>
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
                <span>{{ friendlyDate(task.dueDate) }}</span>
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
          <b>没有待排期任务</b>
          <span>未完成任务都已进入月历，或当前筛选下没有结果。</span>
        </div>
      </div>
    </section>

    <section class="cal-board" aria-label="任务月历">
      <header class="cal-board-head">
        <div class="cal-month-title">
          <button class="cal-month-picker-trigger" type="button" :aria-expanded="monthPickerOpen" @click.stop="toggleMonthPicker">
            <b>{{ monthTitle }}</b>
            <Icon name="arrowdown" :size="13" />
          </button>
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
          <button type="button" title="上个月" aria-label="上个月" @click="shiftMonth(-1)"><Icon name="arrowleft" :size="14" /></button>
          <button class="cal-today" type="button" @click="goToday">今天</button>
          <button type="button" title="下个月" aria-label="下个月" @click="shiftMonth(1)"><Icon name="arrowright" :size="14" /></button>
        </div>
      </header>

      <div class="cal-weekdays" aria-hidden="true">
        <span v-for="day in weekdays" :key="day">周{{ day }}</span>
      </div>

      <div class="cal-grid">
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
            <small v-if="cell.tasks.length">{{ cell.tasks.length }}</small>
          </button>
          <div class="cal-day-list">
            <div
              v-for="task in cell.tasks.slice(0, 3)"
              :key="task.id"
              class="cal-task-chip"
              :class="['is-' + task.status, 'tone-' + taskTone(task)]"
              draggable="true"
              tabindex="0"
              :title="task.title"
              @dragstart="onDragStart($event, task)"
              @dragend="draggingId = ''; dragOverDay = ''"
              @click="emit('open-task', task)"
              @keydown.enter.prevent="emit('open-task', task)"
            >
              <button
                class="cal-chip-check"
                :class="'is-' + task.status"
                type="button"
                :aria-label="task.status === 'done' ? '恢复为待开始' : '标记完成'"
                @click.stop="emit('toggle-status', task.id)"
              >
                <Icon v-if="task.status === 'done'" name="check" :size="8" />
              </button>
              <span>{{ task.title }}</span>
              <button type="button" title="取消计划执行日期并回到任务池" aria-label="取消排期" @click.stop="emit('clear-due', task.id)">
                <Icon name="x" :size="10" />
              </button>
            </div>
            <button v-if="cell.tasks.length > 3" class="cal-more" type="button" @click="openDay(cell.key)">
              +{{ cell.tasks.length - 3 }} 更多
            </button>
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
        <span v-if="selectedDayMode === 'detail'">{{ selectedTasks.length }} 项计划任务 · 日期是计划执行日，不是截止日期</span>
        <span v-else>只修改计划执行日期，不修改状态、项目归属或今日三件事</span>
      </template>

      <div v-if="selectedDayMode === 'detail'" class="cal-day-modal-body">
        <article
          v-for="task in selectedTasks"
          :key="task.id"
          class="cal-modal-task"
          :class="['is-' + task.status, 'tone-' + taskTone(task)]"
        >
          <button
            class="cal-check"
            :class="'is-' + task.status"
            type="button"
            :aria-label="task.status === 'done' ? '恢复为待开始' : '标记完成'"
            @click="emit('toggle-status', task.id)"
          >
            <Icon v-if="task.status === 'done'" name="check" :size="11" />
          </button>
          <button class="cal-modal-copy" type="button" @click="openTaskFromDay(task)">
            <b>{{ task.title }}</b>
            <small>{{ projectLabel(task) }}<template v-if="metricLabel(task)"> › {{ metricLabel(task) }}</template><template v-if="isOverdue(task)"> · 已逾期</template></small>
          </button>
          <button v-if="isMissing(task)" class="cal-assign" type="button" @click="emit('assign-task', task)">去归位</button>
          <em :class="'is-' + task.status">{{ statusLabel(task.status) }}</em>
          <button type="button" title="取消排期" @click.stop="emit('clear-due', task.id)"><Icon name="x" :size="12" /></button>
        </article>
        <div v-if="!selectedTasks.length" class="cal-empty">
          <Icon name="calendar" :size="20" />
          <b>这一天还没有安排</b>
          <span>从左侧待排期任务拖一张卡到该日期。</span>
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
