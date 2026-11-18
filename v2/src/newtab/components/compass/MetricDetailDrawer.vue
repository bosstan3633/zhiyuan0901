<script setup lang="ts">
/**
 * 方向台 · 成功指标详情（第 5 层）。
 *
 * 职责边界：
 * - 指标是项目与任务之间的判断层，详情必须同时回答“怎么算做成”“做到哪”“靠哪些任务”；
 * - 可编辑能力不降级：名称、目标值、任务归属都在这里改；
 * - 任务标题继续打开共享 TaskDetailDrawer，形成项目 → 指标 → 任务连续下钻。
 *
 * 取数：ProjectMeta/MetricMeta 由宿主 CompassTree 的 compassMeta 统一传入，
 * 这里不重复 filter 全表；任务实体仍按 id 从 store 取，保证编辑落在 reactive Proxy 上。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed, ref, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import type { Metric, Project, TaskCard, TopicCard } from '@/shared/models'
import type { MetricMeta } from '../../views/compassMeta'
import { tasksOfMetric, topicsOfMetric } from '../../views/compassMeta'
import { showToast } from '@/shared/components/toast'
import TaskAddDrawer from '../TaskAddDrawer.vue'
import TaskDetailDrawer from './TaskDetailDrawer.vue'
import { toggleTaskStatus } from '@/shared/utils/taskStatus'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { isTopicDone, sortedTopicStatuses, topicStatusOf } from '@/shared/utils/topicStatus'

const props = defineProps<{
  open: boolean
  metricId: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()
const { d } = useCompass()

const owner = computed<{ dirName: string; proj: Project; metric: Metric } | null>(() => {
  if (!props.open || !props.metricId) return null
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const metric = proj.metrics.find(m => m.id === props.metricId)
      if (metric) return { dirName: dir.name, proj, metric }
    }
  }
  return null
})

const project = computed(() => owner.value?.proj || null)
const metric = computed(() => owner.value?.metric || null)

/** 与 compassMeta 同源：task.metricId / metric.taskIds 双路并集。 */
const tasks = computed<TaskCard[]>(() => {
  if (!metric.value) return []
  return tasksOfMetric(metric.value, d.value.tasks)
})
const topics = computed<TopicCard[]>(() => {
  if (!metric.value) return []
  return topicsOfMetric(metric.value, d.value.topics || [])
})
const done = computed(() => tasks.value.filter(t => t.status === 'done').length)
const pct = computed(() => tasks.value.length ? Math.round((done.value / tasks.value.length) * 100) : 0)
const doing = computed(() => tasks.value.filter(t => t.status === 'doing').length)
const topicStatuses = computed(() => sortedTopicStatuses(d.value))

const metricMeta = computed<MetricMeta | null>(() => {
  if (!metric.value) return null
  return {
    id: metric.value.id,
    title: metric.value.title,
    target: metric.value.target || '',
    tasks: tasks.value,
    topics: topics.value,
    total: tasks.value.length,
    done: done.value,
    topicTotal: topics.value.length,
    pct: pct.value,
    dot: tasks.value.length && done.value === tasks.value.length ? 'done' : doing.value ? 'doing' : '',
    orphanMetric: tasks.value.length === 0
  }
})

// ---- 就地编辑：失焦保存 / Ctrl+Enter 保存 / Esc 取消 ----
const edit = ref<'title' | 'target' | null>(null)
const draft = ref('')
function startEdit(field: 'title' | 'target') {
  if (!metric.value) return
  edit.value = field
  draft.value = metric.value[field] || ''
}
function saveEdit() {
  if (!metric.value || !edit.value) return
  const v = draft.value.trim()
  if (edit.value === 'title' && !v) { showToast('指标名不能为空'); return }
  metric.value[edit.value] = v
  store.persist()
  edit.value = null
  showToast('指标已保存')
}
function cancelEdit() {
  edit.value = null
  draft.value = ''
}

// ---- 任务：打开详情 / 勾选 / 添加 ----
const taskDetailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function openTask(t: TaskCard) { taskDetailRef.value?.open(t) }
function openTopic(topic: TopicCard) { emitOpenDrawer({ kind: 'topic', id: topic.id }) }
function topicName(topic: TopicCard): string {
  return topicStatusOf(d.value, topic.statusId)?.name || topicStatuses.value[0]?.name || '构思中'
}
function topicStyle(topic: TopicCard): Record<string, string> {
  return { '--topic-status': topicStatusOf(d.value, topic.statusId)?.color || 'var(--accent)' }
}
function toggleTask(t: TaskCard) {
  toggleTaskStatus(t)
  store.persist()
}
const taskAddOpen = ref(false)
function openTaskAdd() { taskAddOpen.value = true }
function onTaskCreated(t: TaskCard) { taskDetailRef.value?.open(t) }

watch(() => props.metricId, () => { edit.value = null; draft.value = '' })
</script>

<template>
  <Drawer
    :open="open && !!owner"
    icon="target"
    :title="metric ? `指标详情 · ${metric.title}` : '指标详情'"
    width="540px"
    @close="emit('close')"
  >
    <template v-if="owner && metric && metricMeta">
      <!-- 归属路径：先说明“这个指标挂在哪”，再进入指标本体 -->
      <nav class="md-crumb" aria-label="指标归属路径">
        <span>{{ owner.dirName }}</span><i>›</i>
        <button class="md-crumb-link" @click="emit('close')">{{ project?.name }}</button><i>›</i>
        <b>第 5 层 · 成功指标</b>
      </nav>

      <section class="md-hero">
        <div class="md-title-block">
          <span class="md-kicker">怎么算做成</span>
          <template v-if="edit === 'title'">
            <input v-model="draft" class="md-edit md-edit-title" autofocus @blur="saveEdit"
              @keydown.enter.prevent="saveEdit" @keydown.esc="cancelEdit">
          </template>
          <button v-else class="md-title" title="点击编辑指标名" @click="startEdit('title')">{{ metric.title }}</button>
        </div>
        <div class="md-ring" :title="`本指标完成度 ${pct}%（${done}/${tasks.length} 任务）`">
          <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
            <circle cx="24" cy="24" r="19" fill="none" stroke="var(--surface-3)" stroke-width="3.5" />
            <circle cx="24" cy="24" r="19" fill="none" stroke="var(--hue, var(--accent))" stroke-width="3.5"
              stroke-linecap="round" :stroke-dasharray="2 * Math.PI * 19"
              :stroke-dashoffset="2 * Math.PI * 19 * (1 - pct / 100)" />
          </svg>
          <b>{{ pct }}%</b>
        </div>
      </section>

      <section class="md-stats" aria-label="指标读数">
        <div class="md-stat"><b>{{ tasks.length }}</b><span>支撑任务</span></div>
        <div class="md-stat"><b>{{ done }}</b><span>已完成</span></div>
        <div class="md-stat"><b :class="{ warn: doing > 0 }">{{ doing }}</b><span>进行中</span></div>
        <div class="md-stat" :class="{ danger: metricMeta.orphanMetric }"><b>{{ metricMeta.orphanMetric ? '断链' : '完整' }}</b><span>任务链路</span></div>
      </section>

      <section class="md-section">
        <div class="md-sec-head">
          <h3><Icon name="target" :size="14"/> 目标值</h3>
          <button class="md-edit-btn" @click="startEdit('target')">{{ edit === 'target' ? '编辑中' : '编辑' }}</button>
        </div>
        <input v-if="edit === 'target'" v-model="draft" class="md-edit" autofocus
          placeholder="例：10 篇 / 30% / 2026-12-31 前达成" @blur="saveEdit"
          @keydown.enter.prevent="saveEdit" @keydown.esc="cancelEdit">
        <p v-else class="md-copy" v-pressable :class="{ empty: !metric.target }" @click="startEdit('target')">
          {{ metric.target || '还没有目标值。可以是数量、比例或截止日期。' }}
        </p>
      </section>

      <section class="md-section md-tasks">
        <div class="md-sec-head">
          <h3><Icon name="checksquare" :size="14"/> 支撑任务 <span class="md-count">{{ done }}/{{ tasks.length }}</span></h3>
          <button class="md-add" @click="openTaskAdd">＋ 添加任务</button>
        </div>
        <div v-if="tasks.length" class="md-task-list">
          <div v-for="t in tasks" :key="t.id" class="md-task" :class="t.status">
            <button class="md-check" :class="t.status" :aria-label="t.status === 'done' ? '标记未完成' : '标记完成'"
              @click="toggleTask(t)"><Icon v-if="t.status === 'done'" name="check" :size="12"/></button>
            <button class="md-task-title" title="打开任务详情" @click="openTask(t)">{{ t.title }}</button>
            <span class="md-task-status">{{ t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始' }}</span>
            <span class="md-task-go" aria-hidden="true">›</span>
          </div>
        </div>
        <div v-else class="md-empty">
          <b>目标已经明确，动作还没落</b>
          <span>先拆一条最小可执行任务，指标才有推进的可能。</span>
          <button class="md-add" @click="openTaskAdd">＋ 建第一条任务</button>
        </div>
      </section>

      <section class="md-section md-topics">
        <div class="md-sec-head">
          <h3><Icon name="sparkle" :size="14"/> 成果选题 <span class="md-count">{{ topics.length }}</span></h3>
          <span class="md-topic-hint">选题是面向外界的成果，不计入任务完成率</span>
        </div>
        <div v-if="topics.length" class="md-topic-list">
          <button v-for="topic in topics" :key="topic.id" class="md-topic" :class="{ done: isTopicDone(d, topic) }"
            :style="topicStyle(topic)" type="button" @click="openTopic(topic)">
            <span class="md-topic-result">成果</span>
            <span class="md-topic-title">{{ topic.title }}</span>
            <span class="md-topic-status">{{ topicName(topic) }}</span>
            <span class="md-task-go" aria-hidden="true">›</span>
          </button>
        </div>
        <div v-else class="md-topic-empty">
          <span>这条指标还没有成果选题。选题卡可从调度台的「选题」页签创建。</span>
        </div>
      </section>

      <div class="md-hint"><Icon name="bulb" :size="13"/> 这里改的是方向台同一份数据；任务详情打开后按 Esc 只关最上层。</div>
    </template>
  </Drawer>

  <TaskAddDrawer :open="taskAddOpen" :metric-id="metricId || ''" :project-id="project?.id || ''"
    :metric-title="metric?.title" @close="taskAddOpen = false" @created="onTaskCreated" />
  <TaskDetailDrawer ref="taskDetailRef" />
</template>

<style scoped>
.md-crumb { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--fs-micro); color: var(--text-3); margin-bottom: 16px; }
.md-crumb i { font-style: normal; color: var(--text-4); }
.md-crumb b { color: var(--text-2); font-weight: 600; }
.md-crumb-link { color: var(--accent-ink); background: none; border: 0; padding: 0; cursor: pointer; font: inherit; }
.md-crumb-link:hover { text-decoration: underline; }
.md-hero { display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.md-title-block { flex: 1; min-width: 0; }
.md-kicker { display: block; font-size: var(--fs-micro); font-weight: 700; letter-spacing: .08em; color: var(--text-4); margin-bottom: 5px; }
.md-title { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 0; cursor: text; font-family: inherit; font-size: var(--fs-title); font-weight: 700; line-height: 1.45; color: var(--text); }
.md-title:hover { color: var(--accent-ink); }
.md-ring { position: relative; width: 46px; height: 46px; flex: none; }
.md-ring svg { transform: rotate(-90deg); }
.md-ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: var(--fs-micro); color: var(--text-2); font-variant-numeric: tabular-nums; }
.md-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 20px; }
.md-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 11px; background: var(--surface-2); border-radius: var(--radius-sm); }
.md-stat b { font-size: var(--fs-body); color: var(--text); font-variant-numeric: tabular-nums; }
.md-stat b.warn { color: var(--warning); }
.md-stat.danger b { color: var(--danger); }
.md-stat span { font-size: var(--fs-tiny); color: var(--text-3); }
.md-section { margin-bottom: 20px; }
.md-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.md-sec-head h3 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: var(--fs-sub); color: var(--text-2); }
.md-count { color: var(--text-4); font-weight: 500; }
.md-edit-btn { margin-left: auto; border: 0; background: transparent; color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; padding: 2px 5px; border-radius: 5px; }
.md-edit-btn:hover { color: var(--accent-ink); background: var(--accent-light); }
.md-copy { margin: 0; padding: 11px 12px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: var(--fs-sub); line-height: 1.7; color: var(--text-2); cursor: text; }
.md-copy.empty { color: var(--text-3); border: 1px dashed var(--border); background: transparent; }
.md-edit { width: 100%; box-sizing: border-box; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; font-size: var(--fs-sub); padding: 9px 11px; outline: none; }
.md-edit-title { font-size: var(--fs-title); font-weight: 700; }
.md-add { margin-left: auto; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); border-radius: 999px; padding: 4px 10px; font: inherit; font-size: var(--fs-micro); font-weight: 600; cursor: pointer; }
.md-add:hover { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.md-task-list { display: flex; flex-direction: column; gap: 5px; }
.md-task { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-2); }
.md-task:hover { background: var(--surface-3); }
.md-check { width: 16px; height: 16px; flex: none; border-radius: 5px; border: 1.5px solid var(--border-strong); background: var(--surface); color: transparent; display: grid; place-items: center; cursor: pointer; padding: 0; }
.md-check.done { border-color: var(--success); background: var(--success); color: #fff; }
.md-check.doing { border-color: var(--warning); }
.md-task-title { flex: 1; min-width: 0; border: 0; background: transparent; padding: 0; text-align: left; font: inherit; font-size: var(--fs-sub); color: var(--text); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.md-task-title:hover { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.md-task.done .md-task-title { color: var(--text-3); text-decoration: line-through; }
.md-task-status { flex: none; font-size: var(--fs-tiny); color: var(--text-3); }
.md-task.doing .md-task-status { color: var(--warning); }
.md-task.done .md-task-status { color: var(--success); }
.md-task-go { color: var(--text-4); flex: none; }
.md-topic-hint { margin-left: auto; color: var(--text-4); font-size: var(--fs-tiny); }
.md-topic-list { display: flex; flex-direction: column; gap: 5px; }
.md-topic {
  display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--topic-status) 24%, var(--border));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--topic-status) 7%, var(--surface));
  color: var(--text); font-family: inherit; text-align: left; cursor: pointer;
}
.md-topic:hover { border-color: var(--topic-status); }
.md-topic-result {
  flex: none; padding: 1px 7px; border-radius: 99px;
  background: color-mix(in srgb, var(--topic-status) 16%, var(--surface));
  color: var(--topic-status); font-size: var(--fs-tiny); font-weight: 700;
}
.md-topic-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-sub); }
.md-topic.done .md-topic-title { color: var(--text-3); text-decoration: line-through; }
.md-topic-status { flex: none; color: var(--topic-status); font-size: var(--fs-tiny); font-weight: 600; }
.md-topic-empty { padding: 11px 12px; border: 1px dashed var(--border); border-radius: var(--radius-sm); color: var(--text-3); font-size: var(--fs-micro); line-height: 1.65; }
.md-empty { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 20px 14px; text-align: center; border: 1px dashed var(--warning-border); border-radius: var(--radius-sm); background: var(--warning-bg-soft); }
.md-empty b { font-size: var(--fs-sub); color: var(--warning); }
.md-empty span { font-size: var(--fs-micro); color: var(--text-3); }
.md-empty .md-add { margin-left: 0; }
.md-hint { display: flex; align-items: center; gap: 6px; padding: 9px 11px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: var(--fs-micro); color: var(--text-3); line-height: 1.6; }
</style>
