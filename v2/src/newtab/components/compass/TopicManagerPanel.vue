<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import Drawer from '@/shared/components/Drawer.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import NewBadge from '@/shared/components/NewBadge.vue'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { clearedFocusSlot, detachFocusTopicFromDate, normalizedFocusSlots } from '@/shared/utils/focusSlots'
import { addManualTopicFocus } from '@/shared/utils/focusSuggest'
import { attachTopicToMetric, softDeleteTopicToTrash } from '@/shared/utils/topicLinks'
import { isTopicDone, setTopicStatus, sortedTopicStatuses, toggleTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'
import { openTopicOutcome } from '@/shared/utils/topicOutcome'
import { scheduleCardDate } from '@/shared/storage/planSchedule'
import type { TopicCard } from '@/shared/models'
import TopicCalendarView from './TopicCalendarView.vue'
import CardPoolTimeline from './CardPoolTimeline.vue'

const props = withDefaults(defineProps<{ secondaryMode?: boolean }>(), { secondaryMode: false })
const emit = defineEmits<{ (e: 'created', topic: TopicCard): void }>()

const store = useAppStore()
const { d, allProjects, wceEvents, refreshWce } = useCompass()
const route = useRoute()
const router = useRouter()

const search = ref('')
const projectFilter = ref('')
const statusFilter = ref('all')
const showDone = ref(true)
const viewMode = ref<'calendar' | 'board' | 'timeline'>('calendar')
const sortMode = ref<'recent' | 'unplanned' | 'due'>('recent')
const groupMode = ref<'none' | 'project'>('none')
const listCollapsed = ref(false)
const TOPIC_LIST_WIDTH_KEY = 'zy.topicManager.listWidth'
const DEFAULT_TOPIC_LIST_WIDTH = 300
const MIN_TOPIC_LIST_WIDTH = 230
const MAX_TOPIC_LIST_WIDTH = 540
const listWidth = ref(readTopicListWidth())
const createOpen = ref(false)
const createTitle = ref('')
const createProjectId = ref('')
const createMetricId = ref('')
const createStatusId = ref('')
const boardOverStatus = ref('')
let draggingBoardId = ''
let topicOpenTimer: ReturnType<typeof setTimeout> | null = null
let splitDrag: { startX: number; startWidth: number } | null = null

function readTopicListWidth(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_TOPIC_LIST_WIDTH
  const saved = Number(localStorage.getItem(TOPIC_LIST_WIDTH_KEY))
  return Number.isFinite(saved)
    ? Math.min(MAX_TOPIC_LIST_WIDTH, Math.max(MIN_TOPIC_LIST_WIDTH, saved))
    : DEFAULT_TOPIC_LIST_WIDTH
}

function saveTopicListWidth(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(TOPIC_LIST_WIDTH_KEY, String(listWidth.value))
}

function clampTopicListWidth(value: number): number {
  return Math.min(MAX_TOPIC_LIST_WIDTH, Math.max(MIN_TOPIC_LIST_WIDTH, Math.round(value)))
}

function onTopicSplitMove(event: PointerEvent): void {
  if (!splitDrag) return
  listWidth.value = clampTopicListWidth(splitDrag.startWidth + event.clientX - splitDrag.startX)
}

function endTopicSplitDrag(): void {
  if (!splitDrag) return
  splitDrag = null
  document.body.classList.remove('topic-splitting')
  window.removeEventListener('pointermove', onTopicSplitMove)
  window.removeEventListener('pointerup', endTopicSplitDrag)
  saveTopicListWidth()
}

function startTopicSplitDrag(event: PointerEvent): void {
  if (event.button !== 0 || listCollapsed.value) return
  event.preventDefault()
  splitDrag = { startX: event.clientX, startWidth: listWidth.value }
  document.body.classList.add('topic-splitting')
  window.addEventListener('pointermove', onTopicSplitMove)
  window.addEventListener('pointerup', endTopicSplitDrag)
}

function nudgeTopicSplit(delta: number): void {
  listWidth.value = clampTopicListWidth(listWidth.value + delta)
  saveTopicListWidth()
}

function resetTopicSplit(): void {
  listWidth.value = DEFAULT_TOPIC_LIST_WIDTH
  saveTopicListWidth()
}

const projects = computed(() => allProjects())
const createMetrics = computed(() => projects.value.find(project => project.id === createProjectId.value)?.metrics || [])
const statuses = computed(() => sortedTopicStatuses(d.value))
const liveTopics = computed(() => (d.value.topics || []).filter(topic => !topic.deletedAt && !topic.lifecycleArchived))
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
  if (sortMode.value === 'due') {
    const aDate = a.dueDate || '9999-99-99'
    const bDate = b.dueDate || '9999-99-99'
    return aDate.localeCompare(bDate) || (b.createdAt || 0) - (a.createdAt || 0)
  }
  if (sortMode.value === 'unplanned') {
    const aPending = !a.dueDate
    const bPending = !b.dueDate
    if (aPending !== bPending) return aPending ? -1 : 1
    if (a.dueDate && b.dueDate) {
      const byDate = a.dueDate.localeCompare(b.dueDate)
      if (byDate) return byDate
    }
    return (b.createdAt || 0) - (a.createdAt || 0)
  }
  return (Number(b.pinned) - Number(a.pinned))
    || ((b.createdAt || 0) - (a.createdAt || 0))
}))

const topicListGroups = computed(() => {
  if (groupMode.value !== 'project') return [{ key: '__all__', name: '', topics: orderedTopics.value }]
  const groups: { key: string; name: string; topics: TopicCard[] }[] = []
  for (const topic of orderedTopics.value) {
    const key = topic.projectId && projectNames.value.has(topic.projectId) ? topic.projectId : '__none__'
    let group = groups.find(row => row.key === key)
    if (!group) {
      group = { key, name: key === '__none__' ? '未挂项目' : projectNames.value.get(key) || key, topics: [] }
      groups.push(group)
    }
    group.topics.push(topic)
  }
  return groups
})

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
  scheduleCardDate(d.value, topic, date, { source: 'calendar' })
  store.persist()
}

function clearDueDate(topicId: string): void {
  const topic = d.value.topics.find(row => !row.deletedAt && row.id === topicId)
  if (!topic) return
  removeTopicFromToday(topic.id)
  scheduleCardDate(d.value, topic, undefined, { source: 'calendar' })
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
  return (topic.projectId && projectNames.value.get(topic.projectId)) || '未挂项目'
}

function metricName(topic: TopicCard): string {
  return (topic.metricId && metricNames.value.get(topic.metricId)) || ''
}

async function resetForFresh(nextView: 'calendar' | 'board' | 'timeline' = 'board'): Promise<void> {
  resetFilters()
  sortMode.value = 'recent'
  groupMode.value = 'none'
  showDone.value = true
  viewMode.value = nextView
  listCollapsed.value = false
  await nextTick()
}

async function openDetail(id: string): Promise<void> {
  emitOpenDrawer({ kind: 'topic', id })
  void router.replace({ path: route.path })
}

onBeforeUnmount(() => {
  clearTopicOpenTimer()
  endTopicSplitDrag()
})

defineExpose({ resetForFresh, openDetail })
</script>

<template>
  <div
    class="topic-manager"
    :class="{ 'list-hidden': listCollapsed }"
    :style="{ '--topic-list-width': `${listWidth}px` }"
  >
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
        <select v-model="sortMode" aria-label="选题排序">
          <option value="recent">最新入池</option>
          <option value="unplanned">未落图优先</option>
          <option value="due">按计划日期</option>
        </select>
        <select v-model="groupMode" aria-label="选题分组">
          <option value="none">不分组</option>
          <option value="project">按项目分组</option>
        </select>
        <label class="topic-done-toggle">
          <input v-model="showDone" type="checkbox">
          显示已完成
        </label>
        <button class="topic-clear" type="button" @click="resetFilters">清空筛选</button>
      </div>
      <div class="topic-toolbar-actions">
        <div class="topic-view-switch" role="group" aria-label="选题视图">
          <button type="button" :class="{ on: viewMode === 'calendar' }" @click="viewMode = 'calendar'">日历</button>
          <button type="button" :class="{ on: viewMode === 'board' }" @click="viewMode = 'board'">看板</button>
          <button type="button" :class="{ on: viewMode === 'timeline' }" @click="viewMode = 'timeline'; refreshWce()">时间线</button>
        </div>
        <button class="topic-new" type="button" @click="openCreate"><Icon name="plus" :size="13" /> 新建选题</button>
      </div>
    </header>

    <div class="topic-workbench">
      <aside class="topic-pool" :class="{ collapsed: listCollapsed }">
        <button
          v-if="listCollapsed"
          class="topic-rail-toggle"
          type="button"
          title="展开选题清单"
          aria-label="展开选题清单"
          :aria-expanded="false"
          @click="listCollapsed = false"
        >
          <Icon name="arrowright" :size="13" />
          <span>选题清单</span>
          <em>{{ filteredTopics.length }}</em>
        </button>
        <template v-else>
          <header class="topic-pool-head">
            <div>
              <div class="topic-pool-heading">
                <b>选题清单</b>
                <button class="topic-collapse-inline" type="button" title="折叠选题清单" aria-label="折叠选题清单" :aria-expanded="true" @click="listCollapsed = true">
                  <Icon name="arrowleft" :size="12" /> 折叠
                </button>
              </div>
            <span>{{ filteredTopics.length }} 项当前筛选 · {{ sortMode === 'recent' ? '最新入池在前' : sortMode === 'due' ? '按计划日期' : '未落图在前' }}</span>
            </div>
            <div class="topic-pool-badges">
              <span>{{ pendingCount }} 未落图</span>
              <span class="today">今日 +{{ todayCount }}</span>
            </div>
          </header>
          <div class="topic-pool-list">
            <template v-for="group in topicListGroups" :key="group.key">
              <div v-if="group.name" class="topic-pool-group">
                <span>{{ group.name }}</span><em>{{ group.topics.length }}</em>
              </div>
            <article
              v-for="topic in group.topics"
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
            </template>
            <EmptyState v-if="!orderedTopics.length" size="inline" icon="clipboard" title="没有匹配的选题" hint="调整筛选条件，或新建一个选题。" />
          </div>
        </template>
      </aside>

      <button
        v-if="!listCollapsed"
        class="topic-split-handle"
        type="button"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整选题清单宽度"
        :aria-valuemin="MIN_TOPIC_LIST_WIDTH"
        :aria-valuemax="MAX_TOPIC_LIST_WIDTH"
        :aria-valuenow="listWidth"
        title="拖拽调整左右宽度 · 双击复位"
        @pointerdown="startTopicSplitDrag"
        @dblclick.prevent="resetTopicSplit"
        @keydown.left.prevent="nudgeTopicSplit(-20)"
        @keydown.right.prevent="nudgeTopicSplit(20)"
      ><span aria-hidden="true" /></button>

      <section class="topic-view">
        <TopicCalendarView
          v-if="viewMode === 'calendar'"
          :topics="filteredTopics"
          :statuses="statuses"
          :show-done="showDone"
          :project-names="projectNames"
          :metric-names="metricNames"
          @open-topic="scheduleTopicOpen"
          @open-topic-link="openTopicDirect"
          @toggle-status="toggleStatus"
          @focus-topic="addTopicToToday"
          @set-due="setDueDate"
          @clear-due="clearDueDate"
        />
        <CardPoolTimeline v-else-if="viewMode === 'timeline'" kind="topic" :events="wceEvents" :data="d" :cards="filteredTopics" @select="openDetail" />
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
  </div>
</template>

<style scoped>
.topic-manager { position: relative; display: flex; min-width: 0; flex-direction: column; gap: 9px; }
.topic-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--surface) 92%, var(--accent-light)); }
.topic-toolbar-main, .topic-toolbar-actions { display: flex; align-items: center; gap: 5px; min-width: 0; flex-wrap: wrap; }
.topic-toolbar-main { flex: 1; }
.topic-search { display: flex; flex: 0 1 240px; min-width: 180px; align-items: center; gap: 6px; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.topic-search input { flex: 1; min-width: 0; min-height: 30px; border: 0; outline: 0; background: transparent; color: var(--text); font-family: inherit; font-size: var(--fs-micro); }
.topic-search button { padding: 0; border: 0; background: none; color: var(--text-2); cursor: pointer; }
.topic-toolbar select { min-height: 30px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font-family: inherit; font-size: var(--fs-micro); }
.topic-done-toggle { display: flex; align-items: center; gap: 4px; color: var(--text-2); font-size: var(--fs-micro); white-space: nowrap; }
.topic-clear { min-height: 28px; padding: 0 6px; border: 0; background: none; color: var(--text-3); font-family: inherit; font-size: var(--fs-micro); cursor: pointer; }
.topic-view-switch { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
.topic-view-switch button { min-height: 28px; padding: 3px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--text-3); font-family: inherit; font-size: var(--fs-micro); font-weight: 650; cursor: pointer; }
.topic-view-switch button.on { background: var(--surface); color: var(--accent-ink); box-shadow: var(--shadow-sm); }
.topic-new { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 4px 10px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent); color: #fff; font-family: inherit; font-size: var(--fs-micro); font-weight: 650; cursor: pointer; }
.topic-workbench { display: grid; grid-template-columns: minmax(230px, var(--topic-list-width, 300px)) 12px minmax(0, 1fr); gap: 12px; min-height: 620px; transition: grid-template-columns var(--dur); }
.list-hidden .topic-workbench { grid-template-columns: 46px minmax(0, 1fr); }
.topic-pool { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); }
.topic-pool.collapsed { align-items: center; background: color-mix(in srgb, var(--surface-2) 76%, var(--surface)); }
.topic-rail-toggle { display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; gap: 9px; padding: 12px 3px; border: 0; background: transparent; color: var(--text-2); font: inherit; cursor: pointer; }
.topic-rail-toggle:hover, .topic-rail-toggle:focus-visible { background: var(--accent-light); color: var(--accent-ink); }
.topic-rail-toggle span { writing-mode: vertical-rl; letter-spacing: .14em; font-size: var(--fs-caption); font-weight: 650; }
.topic-rail-toggle em { display: inline-grid; min-width: 20px; height: 20px; place-items: center; padding: 0 4px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); font-size: var(--fs-micro); font-style: normal; font-variant-numeric: tabular-nums; }
.topic-split-handle { position: relative; display: grid; width: 12px; min-height: 0; place-items: center; margin: 0 -8px; padding: 0; border: 0; background: transparent; color: var(--text-4); cursor: col-resize; touch-action: none; }
.topic-split-handle::before { width: 3px; height: 100%; border-radius: 99px; background: transparent; content: ''; transition: background var(--dur-fast); }
.topic-split-handle:hover::before,
.topic-split-handle:focus-visible::before,
body.topic-splitting .topic-split-handle::before { background: color-mix(in srgb, var(--accent) 55%, var(--border)); }
.topic-split-handle span { position: absolute; top: 50%; width: 8px; height: 28px; border-radius: 99px; background: var(--surface); box-shadow: 0 0 0 1px var(--border); transform: translateY(-50%); }
.topic-split-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
body.topic-splitting { cursor: col-resize; user-select: none; }
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
.topic-pool-group { display: flex; align-items: center; gap: 6px; padding: 7px 5px 4px; color: var(--text-3); font-size: var(--fs-micro); font-weight: 650; }
.topic-pool-group::after { flex: 1; height: 1px; background: var(--border); content: ''; }
.topic-pool-group em { color: var(--text-4); font-style: normal; font-variant-numeric: tabular-nums; }
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
  .topic-workbench { grid-template-columns: minmax(230px, var(--topic-list-width, 280px)) 12px minmax(0, 1fr); }
}
@media (max-width: 820px) {
  .topic-workbench { grid-template-columns: 1fr; }
  .topic-split-handle { display: none; }
  .topic-pool { max-height: 360px; }
  .list-hidden .topic-workbench { grid-template-columns: 46px minmax(0, 1fr); }
  .list-hidden .topic-pool { max-height: none; }
  .topic-board { grid-auto-columns: minmax(240px, 86vw); }
}
</style>
