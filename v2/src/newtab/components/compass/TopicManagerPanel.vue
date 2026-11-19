<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import Drawer from '@/shared/components/Drawer.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import NewBadge from '@/shared/components/NewBadge.vue'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { recordCardOpen } from '@/shared/storage/stats'
import { activeFocusSlots, clearedFocusSlot, detachFocusTaskFromDate, detachFocusTopicFromDate, normalizedFocusSlots } from '@/shared/utils/focusSlots'
import { addManualFocus, addManualTopicFocus } from '@/shared/utils/focusSuggest'
import { attachTopicToMetric, softDeleteTopicToTrash } from '@/shared/utils/topicLinks'
import { isTopicDone, setTopicStatus, sortedTopicStatuses, toggleTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'
import { openTopicOutcome } from '@/shared/utils/topicOutcome'
import { toggleTaskStatus } from '@/shared/utils/taskStatus'
import type { TaskCard, TopicCard } from '@/shared/models'
import TopicCalendarView from './TopicCalendarView.vue'

const props = withDefaults(defineProps<{ secondaryMode?: boolean }>(), { secondaryMode: false })
const emit = defineEmits<{ (e: 'created', topic: TopicCard): void }>()

const store = useAppStore()
const { d, allProjects } = useCompass()
const route = useRoute()
const router = useRouter()
const taskDrawerRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)

const search = ref('')
const projectFilter = ref('')
const statusFilter = ref('all')
const showDone = ref(true)
const viewMode = ref<'calendar' | 'board'>('calendar')
const listCollapsed = ref(false)
const createOpen = ref(false)
const createTitle = ref('')
const createProjectId = ref('')
const createMetricId = ref('')
const createStatusId = ref('')
const boardOverStatus = ref('')
let draggingBoardId = ''
let topicOpenTimer: ReturnType<typeof setTimeout> | null = null

const projects = computed(() => allProjects())
const createMetrics = computed(() => projects.value.find(project => project.id === createProjectId.value)?.metrics || [])
const statuses = computed(() => sortedTopicStatuses(d.value))
const liveTopics = computed(() => (d.value.topics || []).filter(topic => !topic.deletedAt && !topic.lifecycleArchived))
const liveTasks = computed(() => (d.value.tasks || []).filter(task => !task.deletedAt && !task.lifecycleArchived))
const todayFocusSlots = computed(() => activeFocusSlots(d.value.dailyFocus?.[localTodayKey()]))
const projectNames = computed(() => new Map(projects.value.map(project => [project.id, project.name])))
const metricNames = computed(() => {
  const map = new Map<string, string>()
  for (const project of projects.value) {
    for (const metric of project.metrics || []) map.set(metric.id, metric.title)
  }
  return map
})

const filteredTopics = computed(() => {
  const query = search.value.trim().toLowerCase()
  return liveTopics.value
    .filter(topic => showDone.value || !isTopicDone(d.value, topic))
    .filter(topic => !projectFilter.value || topic.projectId === projectFilter.value)
    .filter(topic => statusFilter.value === 'all' || topic.statusId === statusFilter.value)
    .filter(topic => !query || [
      topic.title,
      topic.description || '',
      projectNames.value.get(topic.projectId || '') || '',
      metricNames.value.get(topic.metricId || '') || '',
    ].some(text => text.toLowerCase().includes(query)))
})

const orderedTopics = computed(() => [...filteredTopics.value].sort((a, b) => {
  const aPending = !a.dueDate
  const bPending = !b.dueDate
  if (aPending !== bPending) return aPending ? -1 : 1
  if (a.dueDate && b.dueDate) {
    const byDate = a.dueDate.localeCompare(b.dueDate)
    if (byDate) return byDate
  }
  return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (b.updatedAt || 0) - (a.updatedAt || 0)
}))

const pendingCount = computed(() => filteredTopics.value.filter(topic => !topic.dueDate).length)
const todayCount = computed(() => {
  const t0 = new Date()
  t0.setHours(0, 0, 0, 0)
  const t1 = new Date(t0)
  t1.setDate(t1.getDate() + 1)
  return liveTopics.value.filter(topic => (topic.createdAt || 0) >= t0.getTime() && (topic.createdAt || 0) < t1.getTime()).length
})

const boardColumns = computed(() => statuses.value.map(status => ({
  status,
  topics: orderedTopics.value.filter(topic => topic.statusId === status.id),
})))

function statusOf(topic: TopicCard) {
  return topicStatusOf(d.value, topic.statusId)
}

function statusStyle(topic: TopicCard): Record<string, string> {
  return { '--topic-status': statusOf(topic)?.color || 'var(--accent)' }
}

function friendlyDate(value?: string): string {
  if (!value) return '未落图'
  const date = new Date(`${value}T12:00:00`)
  return `落图 ${date.getMonth() + 1}/${date.getDate()}`
}

function localTodayKey(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function openTopic(topic: TopicCard): void {
  clearTopicOpenTimer()
  emitOpenDrawer({ kind: 'topic', id: topic.id })
}

function clearTopicOpenTimer(): void {
  if (!topicOpenTimer) return
  clearTimeout(topicOpenTimer)
  topicOpenTimer = null
}

function scheduleTopicOpen(topic: TopicCard): void {
  clearTopicOpenTimer()
  topicOpenTimer = setTimeout(() => {
    topicOpenTimer = null
    emitOpenDrawer({ kind: 'topic', id: topic.id })
  }, 220)
}

function openTopicDirect(topic: TopicCard): void {
  clearTopicOpenTimer()
  if (!openTopicOutcome(topic)) openTopic(topic)
}

function onTopicListDragStart(event: DragEvent, topic: TopicCard): void {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `topic:${topic.id}`)
  }
}

function openTask(task: TaskCard): void {
  recordCardOpen(d.value, task)
  store.persistHot()
  taskDrawerRef.value?.open(task)
}

function toggleTaskWorkStatus(taskId: string): void {
  const task = liveTasks.value.find(row => row.id === taskId)
  if (!task) return
  const nextDone = task.status !== 'done'
  toggleTaskStatus(task)
  store.persist()
  showToast(nextDone ? '任务已完成，今日三件事和月历已同步' : '任务已恢复为勾选前的状态')
}

function clearTaskFromToday(taskId: string): ReturnType<typeof clearedFocusSlot> | null {
  const day = localTodayKey()
  const cells = normalizedFocusSlots(d.value.dailyFocus?.[day])
  const index = cells.findIndex(slot => !!slot && !slot.cleared
    && slot.sourceType === 'task' && slot.sourceId === taskId)
  if (index < 0) return null
  const previous = cells[index]
  detachFocusTaskFromDate(d.value, day, taskId)
  const tombstone = clearedFocusSlot(index, previous)
  cells[index] = tombstone
  d.value.dailyFocus[day] = cells.map((slot, slotIndex) => slot || clearedFocusSlot(slotIndex))
  return previous ? JSON.parse(JSON.stringify(previous)) : null
}

function setTaskDueDate(taskId: string, date: string): void {
  const task = liveTasks.value.find(row => row.id === taskId)
  if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
  const today = localTodayKey()
  if (date === today) {
    if (task.status === 'done' && !todayFocusSlots.value.some(slot => slot.sourceType === 'task' && slot.sourceId === taskId)) {
      showToast('已完成任务不能新排入今日；今日日历与三件事严格保持同一集合')
      return
    }
    const result = addManualFocus(d.value, today, taskId)
    if (result.status === 'full') {
      showToast('今日三件事已满（3/3）；今日日历与三件事严格同源，未安排第 4 项')
      return
    }
    store.persist()
    showToast(result.status === 'exists' ? '任务已在今日三件事与今日日历中' : '已安排到今日，并加入今日三件事')
    return
  }
  clearTaskFromToday(taskId)
  task.dueDate = date
  task.updatedAt = Date.now()
  store.persist()
  showToast(`已安排到 ${date.slice(5, 7)} 月 ${date.slice(8, 10)} 日，并移出今日三件事`)
}

function clearTaskDueDate(taskId: string): void {
  const task = liveTasks.value.find(row => row.id === taskId)
  if (!task) return
  const removedFocus = clearTaskFromToday(taskId)
  task.dueDate = undefined
  task.updatedAt = Date.now()
  store.persist()
  showToast('已取消排期，任务回到卡片池', {
    label: '撤销',
    cb: () => {
      const current = liveTasks.value.find(row => row.id === taskId)
      if (!current) return
      const day = localTodayKey()
      if (removedFocus) {
        const cells = normalizedFocusSlots(d.value.dailyFocus?.[day])
        const index = removedFocus.slotIndex ?? cells.findIndex(cell => !cell || cell.cleared)
        if (index >= 0 && index < 3) cells[index] = removedFocus
        d.value.dailyFocus[day] = cells.map((slot, slotIndex) => slot || clearedFocusSlot(slotIndex))
        current.dueDate = day
      }
      current.updatedAt = Date.now()
      store.persist()
      showToast('已恢复任务排期')
    },
  })
}

function resetFilters(): void {
  search.value = ''
  projectFilter.value = ''
  statusFilter.value = 'all'
  showDone.value = true
}

function openCreate(): void {
  createOpen.value = true
  createTitle.value = ''
  createProjectId.value = projectFilter.value
  createMetricId.value = ''
  createStatusId.value = statuses.value[0]?.id || ''
}

function createMetricChanged(): void {
  if (!createMetricId.value) return
  const project = projects.value.find(row => row.metrics.some(metric => metric.id === createMetricId.value))
  if (project) createProjectId.value = project.id
}

function createProjectChanged(): void {
  createMetricId.value = ''
}

function createTopic(): void {
  const title = createTitle.value.trim()
  if (!title) {
    showToast('请输入选题标题')
    return
  }
  const now = Date.now()
  const topic: TopicCard = {
    id: uid('topic'),
    kind: 'topic',
    title,
    projectId: createProjectId.value || undefined,
    metricId: createMetricId.value || undefined,
    statusId: createStatusId.value || statuses.value[0]?.id || 'topic-idea',
    customFields: {},
    createdAt: now,
    updatedAt: now,
  }
  d.value.topics = d.value.topics || []
  d.value.topics.unshift(topic)
  attachTopicToMetric(d.value, topic, topic.projectId, topic.metricId)
  store.persist()
  createOpen.value = false
  emit('created', topic)
  showToast('选题卡已创建')
  emitOpenDrawer({ kind: 'topic', id: topic.id })
}

function toggleStatus(topicId: string): void {
  const topic = d.value.topics.find(row => !row.deletedAt && row.id === topicId)
  if (!topic) return
  toggleTopicDone(d.value, topic)
  store.persist()
}

function setBoardStatus(topicId: string, statusId: string): void {
  const topic = d.value.topics.find(row => !row.deletedAt && row.id === topicId)
  if (!topic || !setTopicStatus(d.value, topic, statusId)) return
  store.persist()
}

function onBoardDragStart(event: DragEvent, topic: TopicCard): void {
  draggingBoardId = topic.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', topic.id)
  }
}

function onBoardDrop(statusId: string): void {
  boardOverStatus.value = ''
  if (draggingBoardId) setBoardStatus(draggingBoardId, statusId)
  draggingBoardId = ''
}

function setDueDate(topicId: string, date: string): void {
  const topic = d.value.topics.find(row => !row.deletedAt && row.id === topicId)
  if (!topic) return
  if (date === localTodayKey()) {
    const result = addManualTopicFocus(d.value, date, topic.id)
    if (result.status === 'full') {
      showToast('今日三件事已满；请先把其中一项移出')
      return
    }
    store.persist()
    showToast('已排到今日，并同步进入今日三件事')
    return
  }
  removeTopicFromToday(topic.id)
  topic.dueDate = date
  topic.updatedAt = Date.now()
  store.persist()
}

function clearDueDate(topicId: string): void {
  const topic = d.value.topics.find(row => !row.deletedAt && row.id === topicId)
  if (!topic) return
  removeTopicFromToday(topic.id)
  topic.dueDate = undefined
  topic.updatedAt = Date.now()
  store.persist()
  showToast('已取消排期，选题回到未落图列表')
}

function removeTopicFromToday(topicId: string): void {
  const key = localTodayKey()
  const cells = normalizedFocusSlots(d.value.dailyFocus?.[key])
  const index = cells.findIndex(slot => !!slot && !slot.cleared && slot.sourceType === 'topic' && slot.sourceId === topicId)
  if (index < 0) return
  detachFocusTopicFromDate(d.value, key, topicId)
  cells[index] = clearedFocusSlot(index, cells[index])
  d.value.dailyFocus[key] = cells.map((slot, i) => slot || clearedFocusSlot(i))
}

function addTopicToToday(topic: TopicCard): void {
  const key = localTodayKey()
  const result = addManualTopicFocus(d.value, key, topic.id)
  if (result.status === 'full') {
    showToast('今日三件事已满；请先移出一项')
    return
  }
  store.persist()
  if (result.status === 'exists') showToast('这张选题已经在今天的三件事里')
  else showToast('已设为今日重点')
}

function deleteTopic(topic: TopicCard): void {
  softDeleteTopicToTrash(d.value, topic)
  store.persist()
  showToast(`已删除「${topic.title.slice(0, 18)}」`)
}

function projectName(topic: TopicCard): string {
  return (topic.projectId && projectNames.value.get(topic.projectId)) || '未归档'
}

function metricName(topic: TopicCard): string {
  return (topic.metricId && metricNames.value.get(topic.metricId)) || ''
}

async function resetForFresh(): Promise<void> {
  resetFilters()
  viewMode.value = 'calendar'
  listCollapsed.value = false
  await nextTick()
}

async function openDetail(id: string): Promise<void> {
  emitOpenDrawer({ kind: 'topic', id })
  void router.replace({ path: route.path })
}

onBeforeUnmount(clearTopicOpenTimer)

defineExpose({ resetForFresh, openDetail })
</script>

<template>
  <div class="topic-manager" :class="{ 'list-hidden': listCollapsed }">
    <header class="topic-toolbar">
      <div class="topic-toolbar-main">
        <label class="topic-search">
          <Icon name="search" :size="14" />
          <input v-model="search" type="search" placeholder="搜索选题、项目或指标…" aria-label="搜索选题卡">
          <button v-if="search" type="button" aria-label="清空搜索" @click="search = ''"><Icon name="x" :size="12" /></button>
        </label>
        <select v-model="projectFilter" aria-label="按项目筛选">
          <option value="">全部项目</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
        </select>
        <select v-model="statusFilter" aria-label="按选题状态筛选">
          <option value="all">全部状态</option>
          <option v-for="status in statuses" :key="status.id" :value="status.id">{{ status.name }}</option>
        </select>
        <label class="topic-done-toggle">
          <input v-model="showDone" type="checkbox">
          显示已完成
        </label>
        <button class="topic-clear" type="button" @click="resetFilters">清空筛选</button>
      </div>
      <div class="topic-toolbar-actions">
        <button v-if="listCollapsed" class="topic-expand" type="button" title="展开选题清单" @click="listCollapsed = false">
          <Icon name="arrowright" :size="13" /> 展开清单
        </button>
        <div class="topic-view-switch" role="group" aria-label="选题视图">
          <button type="button" :class="{ on: viewMode === 'calendar' }" @click="viewMode = 'calendar'">日历</button>
          <button type="button" :class="{ on: viewMode === 'board' }" @click="viewMode = 'board'">看板</button>
        </div>
        <button class="topic-new" type="button" @click="openCreate"><Icon name="plus" :size="13" /> 新建选题</button>
      </div>
    </header>

    <div class="topic-workbench">
      <aside v-if="!listCollapsed" class="topic-pool">
        <header class="topic-pool-head">
          <div>
            <div class="topic-pool-heading">
              <b>选题清单</b>
              <button class="topic-collapse-inline" type="button" title="折叠选题清单" @click="listCollapsed = true">
                <Icon name="arrowleft" :size="12" /> 折叠
              </button>
            </div>
            <span>{{ filteredTopics.length }} 项当前筛选 · 未落图在前</span>
          </div>
          <div class="topic-pool-badges">
            <span>{{ pendingCount }} 未落图</span>
            <span class="today">今日 +{{ todayCount }}</span>
          </div>
        </header>
        <div class="topic-pool-list">
          <article
            v-for="topic in orderedTopics"
            :key="topic.id"
            class="topic-pool-item"
            :style="statusStyle(topic)"
            tabindex="0"
            draggable="true"
            @dragstart.stop="onTopicListDragStart($event, topic)"
            @click="scheduleTopicOpen(topic)"
            @dblclick.stop.prevent="openTopicDirect(topic)"
            @keydown.enter.prevent="openTopic(topic)"
          >
            <button class="topic-check" :class="{ done: isTopicDone(d, topic) }" type="button" :aria-label="isTopicDone(d, topic) ? '恢复选题' : '标记完成'" @click.stop="toggleStatus(topic.id)">
              <Icon v-if="isTopicDone(d, topic)" name="check" :size="10" />
            </button>
            <span class="topic-pool-copy">
              <span class="topic-pool-title"><NewBadge :at="topic.createdAt" />{{ topic.title }}</span>
              <span class="topic-pool-meta">
                <span>{{ projectName(topic) }}</span>
                <span v-if="metricName(topic)">› {{ metricName(topic) }}</span>
                <span class="topic-pool-plan" :class="{ scheduled: !!topic.dueDate }"><Icon name="calendar" :size="10" />{{ friendlyDate(topic.dueDate) }}</span>
              </span>
            </span>
            <span class="topic-pool-status">{{ statusOf(topic)?.name || '构思中' }}</span>
            <div class="topic-pool-actions">
              <button v-if="topic.dueDate !== localTodayKey()" type="button" title="设为今日重点" @click.stop="addTopicToToday(topic)"><Icon name="target" :size="12" /></button>
              <button type="button" title="删除选题" @click.stop="deleteTopic(topic)"><Icon name="trash" :size="12" /></button>
            </div>
          </article>
          <EmptyState v-if="!orderedTopics.length" size="inline" icon="clipboard" title="没有匹配的选题" hint="调整筛选条件，或新建一个选题。" />
        </div>
      </aside>

      <section class="topic-view">
        <TopicCalendarView
          v-if="viewMode === 'calendar'"
          :topics="filteredTopics"
          :focus-topics="liveTopics"
          :tasks="liveTasks"
          :focus-tasks="liveTasks"
          :focus-slots="todayFocusSlots"
          :statuses="statuses"
          :show-done="showDone"
          :project-names="projectNames"
          :metric-names="metricNames"
          @open-topic="scheduleTopicOpen"
          @open-topic-link="openTopicDirect"
          @open-task="openTask"
          @toggle-status="toggleStatus"
          @toggle-task-status="toggleTaskWorkStatus"
          @focus-topic="addTopicToToday"
          @set-due="setDueDate"
          @clear-due="clearDueDate"
          @set-task-due="setTaskDueDate"
          @clear-task-due="clearTaskDueDate"
        />
        <div v-else class="topic-board">
          <section
            v-for="column in boardColumns"
            :key="column.status.id"
            class="topic-board-col"
            :class="{ over: boardOverStatus === column.status.id }"
            :style="{ '--topic-status': column.status.color }"
            @dragover.prevent
            @dragenter.prevent="boardOverStatus = column.status.id"
            @dragleave.self="boardOverStatus = ''"
            @drop.prevent="onBoardDrop(column.status.id)"
          >
            <header>
              <span class="topic-board-dot" />
              <b>{{ column.status.name }}</b>
              <em>{{ column.topics.length }}</em>
            </header>
            <div class="topic-board-list">
              <article
                v-for="topic in column.topics"
                :key="topic.id"
                class="topic-board-card"
                draggable="true"
                tabindex="0"
                @dragstart="onBoardDragStart($event, topic)"
                @dragend="draggingBoardId = ''; boardOverStatus = ''"
                @click="scheduleTopicOpen(topic)"
                @dblclick.stop.prevent="openTopicDirect(topic)"
                @keydown.enter.prevent="openTopic(topic)"
              >
                <div class="topic-board-title"><NewBadge :at="topic.createdAt" />{{ topic.title }}</div>
                <div class="topic-board-meta">
                  <span>{{ projectName(topic) }}</span>
                  <span v-if="metricName(topic)">› {{ metricName(topic) }}</span>
                </div>
                <footer>
                  <span :class="{ scheduled: !!topic.dueDate }"><Icon name="calendar" :size="11" />{{ friendlyDate(topic.dueDate) }}</span>
                  <button type="button" title="设为今日重点" @click.stop="addTopicToToday(topic)"><Icon name="target" :size="12" /></button>
                </footer>
              </article>
              <div v-if="!column.topics.length" class="topic-board-empty">拖入选题改变状态</div>
            </div>
          </section>
        </div>
      </section>
    </div>

    <Drawer :open="createOpen" width="500px" title="新建选题卡" @close="createOpen = false">
      <div class="topic-create">
        <label class="topic-create-title">
          <span>选题内容</span>
          <textarea v-model="createTitle" rows="5" autofocus placeholder="完整写下这个选题，标题就是详情页的核心。" @keydown.ctrl.enter.prevent="createTopic" @keydown.meta.enter.prevent="createTopic" />
        </label>
        <div class="topic-create-grid">
          <label>
            <span>所属项目</span>
            <select v-model="createProjectId" @change="createProjectChanged">
              <option value="">未关联项目</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
            </select>
          </label>
          <label>
            <span>成功指标</span>
            <select v-model="createMetricId" @change="createMetricChanged">
              <option value="">暂不归属指标</option>
              <option v-for="metric in createMetrics" :key="metric.id" :value="metric.id">{{ metric.title }}</option>
            </select>
          </label>
          <label>
            <span>选题状态</span>
            <select v-model="createStatusId">
              <option v-for="status in statuses" :key="status.id" :value="status.id">{{ status.name }}</option>
            </select>
          </label>
        </div>
        <p class="topic-create-note"><Icon name="bulb" :size="13" /> 选题卡强调“面向外界的成果”，创建后可在详情中关联资源卡。</p>
        <div class="topic-create-foot">
          <span>Ctrl / ⌘ + Enter 创建</span>
          <button type="button" :disabled="!createTitle.trim()" @click="createTopic">创建选题卡</button>
        </div>
      </div>
    </Drawer>
    <TaskDetailDrawer ref="taskDrawerRef" />
  </div>
</template>

<style scoped>
.topic-manager { position: relative; display: flex; min-width: 0; flex-direction: column; gap: 12px; }
.topic-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-xl); background: color-mix(in srgb, var(--surface) 92%, var(--accent-light)); }
.topic-toolbar-main, .topic-toolbar-actions { display: flex; align-items: center; gap: 7px; min-width: 0; flex-wrap: wrap; }
.topic-toolbar-main { flex: 1; }
.topic-expand { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text-2); font-family: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
.topic-expand:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.topic-search { display: flex; flex: 1; min-width: 220px; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.topic-search input { flex: 1; min-width: 0; min-height: 34px; border: 0; outline: 0; background: transparent; color: var(--text); font-family: inherit; font-size: var(--fs-sub); }
.topic-search button { padding: 0; border: 0; background: none; color: var(--text-2); cursor: pointer; }
.topic-toolbar select { min-height: 34px; padding: 5px 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text-2); font-family: inherit; font-size: var(--fs-caption); }
.topic-done-toggle { display: flex; align-items: center; gap: 5px; color: var(--text-2); font-size: var(--fs-caption); white-space: nowrap; }
.topic-clear { min-height: 32px; padding: 0 9px; border: 0; background: none; color: var(--text-3); font-family: inherit; font-size: var(--fs-caption); cursor: pointer; }
.topic-view-switch { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.topic-view-switch button { min-height: 28px; padding: 3px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--text-3); font-family: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
.topic-view-switch button.on { background: var(--surface); color: var(--accent-ink); box-shadow: var(--shadow-sm); }
.topic-new { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 5px 12px; border: 1px solid var(--accent); border-radius: 9px; background: var(--accent); color: #fff; font-family: inherit; font-size: var(--fs-caption); font-weight: 650; cursor: pointer; }
.topic-workbench { display: grid; grid-template-columns: minmax(260px, 330px) minmax(0, 1fr); gap: 12px; min-height: 620px; transition: grid-template-columns var(--dur); }
.list-hidden .topic-workbench { grid-template-columns: minmax(0, 1fr); }
.topic-pool { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.topic-pool-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 13px; border-bottom: 1px solid var(--border); }
.topic-pool-head > div:first-child { flex: 1; min-width: 0; }
.topic-pool-heading { display: flex; align-items: center; gap: 7px; }
.topic-pool-head b { display: block; color: var(--text); font-size: var(--fs-body); }
.topic-pool-head span { display: block; margin-top: 2px; color: var(--text-3); font-size: var(--fs-micro); }
.topic-pool-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.topic-pool-badges span { padding: 1px 6px; border-radius: 99px; background: var(--surface-2); color: var(--text-3); }
.topic-pool-badges .today { background: var(--accent-light); color: var(--accent-ink); }
.topic-collapse-inline { display: inline-flex; flex: none; align-items: center; gap: 3px; min-height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-3); font-family: inherit; font-size: var(--fs-micro); cursor: pointer; }
.topic-collapse-inline:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.topic-pool-list { flex: 1; min-height: 0; overflow: auto; padding: 7px; }
.topic-pool-item { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 9px 8px; border: 1px solid transparent; border-left: 3px solid color-mix(in srgb, var(--topic-status) 55%, var(--border)); border-radius: 10px; cursor: pointer; }
.topic-pool-item:hover { border-color: var(--border); border-left-color: var(--topic-status); background: var(--surface-2); }
.topic-check { display: inline-grid; width: 18px; height: 18px; place-items: center; padding: 0; border: 1.5px solid var(--border-strong); border-radius: 5px; background: var(--surface); color: #fff; cursor: pointer; }
.topic-check.done { border-color: var(--topic-status); background: var(--topic-status); }
.topic-pool-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.topic-pool-title { display: flex; min-width: 0; gap: 4px; overflow: hidden; color: var(--text); font-size: var(--fs-sub); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.topic-pool-meta { display: flex; min-width: 0; gap: 4px; overflow: hidden; color: var(--text-3); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.topic-pool-plan { display: inline-flex; align-items: center; gap: 3px; }
.topic-pool-plan.scheduled { color: var(--accent-ink); }
.topic-pool-status { padding: 2px 6px; border-radius: 99px; background: color-mix(in srgb, var(--topic-status) 12%, var(--surface-2)); color: var(--topic-status); font-size: var(--fs-micro); white-space: nowrap; }
.topic-pool-actions { position: absolute; right: 6px; bottom: 4px; display: flex; gap: 2px; opacity: 0; transition: opacity var(--dur); }
.topic-pool-item:hover .topic-pool-actions { opacity: 1; }
.topic-pool-actions button { display: inline-grid; width: 21px; height: 21px; place-items: center; padding: 0; border: 0; border-radius: 6px; background: var(--surface); color: var(--text-3); cursor: pointer; }
.topic-pool-actions button:hover { color: var(--accent); }
.topic-view { min-width: 0; min-height: 0; }
.topic-view > * { height: 100%; }
.topic-board { display: grid; grid-auto-columns: minmax(220px, 1fr); grid-auto-flow: column; gap: 10px; min-height: 620px; overflow-x: auto; }
.topic-board-col { display: flex; min-height: 620px; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.topic-board-col.over { border-color: var(--topic-status); box-shadow: inset 0 0 0 1px var(--topic-status); }
.topic-board-col > header { display: flex; align-items: center; gap: 6px; padding: 11px 12px; border-bottom: 1px solid var(--border); }
.topic-board-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--topic-status); }
.topic-board-col header b { flex: 1; color: var(--text); font-size: var(--fs-caption); }
.topic-board-col header em { color: var(--text-3); font-size: var(--fs-micro); font-style: normal; }
.topic-board-list { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 7px; overflow: auto; padding: 8px; }
.topic-board-card { padding: 10px; border: 1px solid var(--border); border-left: 3px solid var(--topic-status); border-radius: 11px; background: var(--surface-2); cursor: grab; }
.topic-board-card:hover { background: var(--surface); box-shadow: var(--shadow-sm); }
.topic-board-title { color: var(--text); font-size: var(--fs-sub); font-weight: 650; line-height: 1.5; }
.topic-board-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; color: var(--text-3); font-size: var(--fs-micro); }
.topic-board-card footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; color: var(--text-3); font-size: var(--fs-micro); }
.topic-board-card footer span { display: inline-flex; align-items: center; gap: 4px; }
.topic-board-card footer span.scheduled { color: var(--accent-ink); }
.topic-board-card footer button { padding: 0; border: 0; background: none; color: var(--text-3); cursor: pointer; }
.topic-board-empty { padding: 22px 8px; text-align: center; color: var(--text-4); font-size: var(--fs-caption); border: 1px dashed var(--border); border-radius: 9px; }
.topic-create { display: flex; flex-direction: column; gap: 15px; }
.topic-create-title { display: flex; flex-direction: column; gap: 6px; }
.topic-create-title > span, .topic-create-grid label > span { color: var(--text-3); font-size: var(--fs-caption); font-weight: 650; }
.topic-create-title textarea { min-height: 136px; resize: vertical; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-xl); outline: 0; background: var(--surface-2); color: var(--text); font-family: inherit; font-size: 18px; font-weight: 650; line-height: 1.6; }
.topic-create-title textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.topic-create-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.topic-create-grid label { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.topic-create-grid label:last-child { grid-column: 1 / -1; }
.topic-create-grid select { min-height: 36px; padding: 6px 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--text); font-family: inherit; font-size: var(--fs-sub); }
.topic-create-note { display: flex; align-items: flex-start; gap: 5px; margin: 0; padding: 9px 11px; border-radius: 10px; background: var(--accent-light); color: var(--accent-ink); font-size: var(--fs-caption); line-height: 1.65; }
.topic-create-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.topic-create-foot span { color: var(--text-4); font-size: var(--fs-micro); }
.topic-create-foot button { min-height: 36px; padding: 6px 14px; border: 1px solid var(--accent); border-radius: 9px; background: var(--accent); color: #fff; font-family: inherit; font-size: var(--fs-sub); font-weight: 650; cursor: pointer; }
.topic-create-foot button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
@media (max-width: 1024px) {
  .topic-workbench { grid-template-columns: minmax(230px, 280px) minmax(0, 1fr); }
}
@media (max-width: 820px) {
  .topic-workbench { grid-template-columns: 1fr; }
  .topic-pool { max-height: 360px; }
  .topic-board { grid-auto-columns: minmax(240px, 86vw); }
}
</style>
