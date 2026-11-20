<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import type { TaskCard } from '@/shared/models'

const props = withDefaults(defineProps<{
  tasks: TaskCard[]
  projectNames: Map<string, string>
  metricNames: Map<string, string>
}>(), {})

const emit = defineEmits<{
  (e: 'open-task', task: TaskCard): void
  (e: 'set-status', taskId: string, status: TaskCard['status']): void
}>()

const columns: { status: TaskCard['status']; label: string; hint: string }[] = [
  { status: 'todo', label: '待开始', hint: '拖到这里改状态' },
  { status: 'doing', label: '进行中', hint: '拖到这里继续推进' },
  { status: 'done', label: '已完成', hint: '拖到这里标记完成' },
]

const dragId = ref('')
const overStatus = ref<TaskCard['status'] | ''>('')

const grouped = computed(() => {
  const map: Record<TaskCard['status'], TaskCard[]> = { todo: [], doing: [], done: [] }
  for (const task of props.tasks) {
    if (task.status === 'done' || task.status === 'doing' || task.status === 'todo') map[task.status].push(task)
  }
  for (const rows of Object.values(map)) {
    rows.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || ((b.createdAt || 0) - (a.createdAt || 0)))
  }
  return map
})

function projectLabel(task: TaskCard): string {
  return (task.projectId && props.projectNames.get(task.projectId)) || '未挂项目'
}

function metricLabel(task: TaskCard): string {
  return (task.metricId && props.metricNames.get(task.metricId)) || ''
}

function dateLabel(task: TaskCard): string {
  if (!task.dueDate) return '未落图'
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(task.dueDate)
  return match ? `落图 ${Number(match[1])}/${Number(match[2])}` : task.dueDate
}

function onDragStart(event: DragEvent, task: TaskCard): void {
  dragId.value = task.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
}

function onDrop(status: TaskCard['status']): void {
  overStatus.value = ''
  const id = dragId.value
  dragId.value = ''
  if (id) emit('set-status', id, status)
}
</script>

<template>
  <div class="task-board-view" aria-label="任务看板">
    <section
      v-for="column in columns"
      :key="column.status"
      class="tb-col"
      :class="['is-' + column.status, { over: overStatus === column.status }]"
      @dragover.prevent
      @dragenter.prevent="overStatus = column.status"
      @dragleave.self="overStatus = ''"
      @drop.prevent="onDrop(column.status)"
    >
      <header class="tb-col-head">
        <span class="tb-dot" />
        <b>{{ column.label }}</b>
        <em>{{ grouped[column.status].length }}</em>
        <small>{{ column.hint }}</small>
      </header>
      <div class="tb-col-list">
        <article
          v-for="task in grouped[column.status]"
          :key="task.id"
          class="tb-card"
          :class="{ 'is-done': task.status === 'done' }"
          draggable="true"
          tabindex="0"
          @dragstart="onDragStart($event, task)"
          @dragend="dragId = ''; overStatus = ''"
          @click="emit('open-task', task)"
          @keydown.enter.prevent="emit('open-task', task)"
        >
          <div class="tb-title">
            <Icon v-if="task.pinned" name="pin" :size="11" />
            {{ task.title }}
          </div>
          <div class="tb-meta">
            <span :class="{ missing: !task.projectId || !projectNames.has(task.projectId) }">{{ projectLabel(task) }}</span>
            <span v-if="metricLabel(task)">› {{ metricLabel(task) }}</span>
          </div>
          <footer>
            <span :class="{ scheduled: !!task.dueDate }"><Icon name="calendar" :size="11" />{{ dateLabel(task) }}</span>
            <button
              v-if="task.status !== 'done'"
              type="button"
              title="标记完成"
              @click.stop="emit('set-status', task.id, 'done')"
            ><Icon name="check" :size="11" /></button>
          </footer>
        </article>
        <div v-if="!grouped[column.status].length" class="tb-empty">
          <Icon name="clipboard" :size="16" />
          <span>{{ column.hint }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.task-board-view {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 10px;
  min-height: 560px;
}
.tb-col {
  display: flex;
  min-width: 0;
  min-height: 560px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  transition: border-color var(--dur), box-shadow var(--dur);
}
.tb-col.over { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.tb-col-head {
  display: grid;
  grid-template-columns: 8px auto auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
}
.tb-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--text-3); }
.tb-col.is-doing .tb-dot { background: var(--accent); }
.tb-col.is-done .tb-dot { background: var(--success, #52a46a); }
.tb-col-head b { color: var(--text); font-size: var(--fs-caption); }
.tb-col-head em { color: var(--text-3); font-size: var(--fs-micro); font-style: normal; }
.tb-col-head small {
  overflow: hidden;
  color: var(--text-4);
  font-size: var(--fs-micro);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb-col-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 7px;
  overflow: auto;
  padding: 8px;
}
.tb-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface-2);
  cursor: pointer;
  transition: background var(--dur), box-shadow var(--dur);
}
.tb-card:hover { background: var(--surface); box-shadow: var(--shadow-sm); }
.tb-card.is-done { opacity: 0.72; }
.tb-title { display: flex; align-items: flex-start; gap: 4px; color: var(--text); font-size: var(--fs-sub); font-weight: 650; line-height: 1.5; }
.tb-title :deep(svg) { flex: none; margin-top: 3px; color: var(--accent); }
.tb-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; color: var(--text-3); font-size: var(--fs-micro); }
.tb-meta .missing { color: var(--danger, #b4553f); }
.tb-card footer { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 8px; color: var(--text-3); font-size: var(--fs-micro); }
.tb-card footer span { display: inline-flex; align-items: center; gap: 4px; }
.tb-card footer span.scheduled { color: var(--accent-ink); }
.tb-card footer button { display: inline-grid; width: 21px; height: 21px; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--text-3); cursor: pointer; }
.tb-card footer button:hover { border-color: var(--accent); color: var(--accent); }
.tb-empty { display: flex; flex: 1; align-items: center; justify-content: center; gap: 6px; min-height: 90px; border: 1px dashed var(--border); border-radius: 9px; color: var(--text-4); font-size: var(--fs-caption); }
@media (max-width: 900px) {
  .task-board-view { grid-auto-columns: minmax(240px, 86vw); grid-auto-flow: column; grid-template-columns: none; overflow-x: auto; }
  .tb-col { min-height: 420px; }
}
</style>
