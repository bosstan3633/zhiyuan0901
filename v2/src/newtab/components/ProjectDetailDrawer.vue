<script setup lang="ts">
/**
 * 项目详情抽屉（可编辑）
 * 用于：知源灯塔主攻项目点击、北极星 DHI/任务推进率下钻、任务中心项目看板。
 * 所有编辑实时写回 store 并持久化——罗盘二级界面同步生效。
 */
import { computed, ref } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { uid } from '@/shared/utils'
import type { Direction, Project } from '@/shared/models'
import Drawer from '@/shared/components/Drawer.vue'
import { useConfirm } from '@/shared/components/confirm'
import TaskAddDrawer from './TaskAddDrawer.vue'

const props = defineProps<{
  open: boolean
  projectId: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()
const d = computed(() => store.data!)

const project = computed<Project | null>(() => {
  if (!props.open || !props.projectId) return null
  for (const dir of d.value.compass.directions) {
    const p = dir.projects.find(x => x.id === props.projectId)
    if (p) return p
  }
  return null
})

const dir = computed<Direction | null>(() => {
  if (!project.value) return null
  return d.value.compass.directions.find(x => x.projects.some(p => p.id === project.value!.id)) || null
})

/** 项目下全部任务 */
function tasksForMetric(metricId: string) {
  // REQ-034：按 id 去重双保险
  const seen = new Set<string>()
  return d.value.tasks.filter(t => !t.deletedAt && t.metricId === metricId)
    .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
}
function allProjectTasks() {
  if (!project.value) return []
  const ids = new Set(project.value.metrics.flatMap(m => m.taskIds))
  return d.value.tasks.filter(t => !t.deletedAt && (ids.has(t.id) || t.projectId === project.value!.id))
}
function progress(): number {
  const tasks = allProjectTasks()
  if (!tasks.length) return project.value?.progress || 0
  return Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
}

// ---- 编辑（实时同步罗盘） ----
function renameProject(e: FocusEvent) {
  const v = (e.target as HTMLElement).textContent?.trim()
  if (v && project.value) { project.value.name = v; store.persist() }
  else if (e.target as HTMLElement) { (e.target as HTMLElement).textContent = project.value?.name || '' }
}
function onRenameEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }

function switchDirection(e: Event) {
  const targetDirId = (e.target as HTMLSelectElement).value
  const fromDir = dir.value
  const toDir = d.value.compass.directions.find(x => x.id === targetDirId)
  if (!project.value || !fromDir || !toDir || fromDir.id === toDir.id) return
  const idx = fromDir.projects.findIndex(p => p.id === project.value!.id)
  if (idx >= 0) {
    const [p] = fromDir.projects.splice(idx, 1)
    toDir.projects.push(p)
    store.persist()
  }
}

function renameMetric(metricId: string, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (!v || !project.value) return
  const m = project.value.metrics.find(x => x.id === metricId)
  if (m) { m.title = v; store.persist() }
}

function renameTask(taskId: string, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (!v) return
  const t = d.value.tasks.find(x => x.id === taskId)
  if (t) { t.title = v; t.updatedAt = Date.now(); store.persist() }
}

function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  t.status = t.status === 'done' ? 'todo' : 'done'
  t.completedAt = t.status === 'done' ? Date.now() : undefined
  t.updatedAt = Date.now()
  store.persist()
}

function addMetric() {
  if (!project.value) return
  project.value.metrics.push({ id: uid('met'), title: '新成功指标', taskIds: [] })
  store.persist()
}
async function removeMetric(metricId: string) {
  if (!project.value) return
  const m = project.value.metrics.find(x => x.id === metricId)
  if (!m) return
  // B27 对齐：删指标不删任务，任务转为未归类（可拖回任意指标）
  const taskCount = tasksForMetric(metricId).length
  if (!(await useConfirm({ title: '删除成功指标', message: taskCount ? `确定删除「${m.title}」？\n其下 ${taskCount} 个任务将转为未归类任务（可拖回任意指标）。` : `确定删除「${m.title}」？`, confirmText: '确认删除' }))) return
  tasksForMetric(metricId).forEach(t => { t.metricId = undefined; t.updatedAt = Date.now() })
  project.value.metrics = project.value.metrics.filter(x => x.id !== metricId)
  store.persist()
}

/** 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAddMetricId = ref<string | null>(null)
function openTaskAdd(metricId: string) { taskAddMetricId.value = metricId }
function removeTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  t.deletedAt = Date.now()
  for (const dir2 of d.value.compass.directions) {
    for (const p of dir2.projects) {
      for (const m of p.metrics) {
        m.taskIds = m.taskIds.filter(id => id !== taskId)
      }
    }
  }
  store.persist()
}
</script>

<template>
  <Drawer :open="open && !!project" :title="project ? `📁 ${project.name}` : ''" width="480px" @close="emit('close')">
    <template v-if="project">
      <!-- 项目名 + 主攻标记 -->
      <div class="pd-head">
        <span v-if="project.isFocused" class="pd-focus-badge">主攻</span>
        <div class="pd-name" contenteditable="true" @blur="renameProject" @keydown.enter.prevent="onRenameEnter">{{ project.name }}</div>
      </div>

      <!-- 进度 + 统计 -->
      <div class="pd-stats">
        <div class="pd-stat"><div class="v">{{ progress() }}%</div><div class="l">完成进度</div></div>
        <div class="pd-stat"><div class="v">{{ project.metrics.length }}</div><div class="l">成功指标</div></div>
        <div class="pd-stat"><div class="v">{{ allProjectTasks().length }}</div><div class="l">任务总数</div></div>
        <div class="pd-stat"><div class="v">{{ allProjectTasks().filter(t=>t.status==='done').length }}</div><div class="l">已完成</div></div>
      </div>
      <div class="pd-progress"><div class="bar" :style="{width: progress() + '%'}" /></div>

      <!-- 隶属战略目标 -->
      <div class="pd-label">📂 隶属战略目标（切换即同步罗盘）</div>
      <select class="pd-select" :value="dir?.id" @change="switchDirection">
        <option v-for="x in d.compass.directions" :key="x.id" :value="x.id">{{ x.name }}</option>
      </select>

      <!-- 成功指标与任务树（可编辑） -->
      <div class="pd-label">🎯 成功指标（点击名称可编辑，实时同步罗盘）</div>
      <div v-if="!project.metrics.length" class="pd-empty">暂无成功指标</div>
      <div v-for="m in project.metrics" :key="m.id" class="pd-metric">
        <div class="pd-metric-head">
          <input class="pd-metric-name" :value="m.title" @change="renameMetric(m.id, $event)" />
          <span class="pd-metric-count">{{ tasksForMetric(m.id).filter(t=>t.status==='done').length }}/{{ tasksForMetric(m.id).length }}</span>
          <button class="pd-mini" @click="openTaskAdd(m.id)" title="添加任务（新建 / 关联）">＋</button>
          <button class="pd-mini danger" @click="removeMetric(m.id)" title="删除指标">🗑</button>
        </div>
        <div class="pd-tasks">
          <div v-for="t in tasksForMetric(m.id)" :key="t.id" class="pd-task" :class="{done: t.status==='done'}">
            <div class="pd-check" :class="{done: t.status==='done'}" @click="toggleTask(t.id)">{{ t.status==='done'?'✓':'' }}</div>
            <input class="pd-task-name" :value="t.title" @change="renameTask(t.id, $event)" />
            <button class="pd-mini danger" @click="removeTask(t.id)" title="删除任务">×</button>
          </div>
          <div v-if="!tasksForMetric(m.id).length" class="pd-task-empty">暂无任务，点击 ＋ 添加</div>
        </div>
      </div>
      <button class="pd-add-metric" @click="addMetric">＋ 添加成功指标</button>

      <div class="pd-sync-hint">💡 此处编辑实时写回罗盘，知源罗盘二级界面同步生效</div>
    </template>
  </Drawer>

  <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
  <TaskAddDrawer :open="!!taskAddMetricId" :metric-id="taskAddMetricId || ''" :project-id="project?.id || ''"
    :metric-title="project?.metrics.find(m => m.id === taskAddMetricId)?.title" @close="taskAddMetricId = null" />
</template>

<style scoped>
.pd-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.pd-focus-badge { background: var(--accent); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600; flex-shrink: 0; }
.pd-name { font-size: 16px; font-weight: 700; color: var(--text); outline: none; border-radius: 4px; padding: 2px 4px; margin: -2px -4px; }
.pd-name:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }

.pd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.pd-stat { background: var(--surface-2); border-radius: var(--radius-xs); padding: 10px 6px; text-align: center; }
.pd-stat .v { font-size: 18px; font-weight: 700; color: var(--accent); }
.pd-stat .l { font-size: 10px; color: var(--text-3); margin-top: 2px; }
.pd-progress { height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; margin-bottom: 18px; }
.pd-progress .bar { height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s; }

.pd-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px; margin: 14px 0 7px; }
.pd-select { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; }
.pd-select:focus { border-color: var(--accent); }

.pd-metric { background: var(--surface-2); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; }
.pd-metric-head { display: flex; align-items: center; gap: 7px; }
.pd-metric-name { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 13px; font-weight: 600; color: var(--text); font-family: inherit; padding: 3px 5px; margin: -3px -5px; border-radius: 5px; }
.pd-metric-name:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.pd-metric-count { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; }
.pd-mini { width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--text-3); cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: inherit; }
.pd-mini:hover { background: var(--surface-3); color: var(--text); }
.pd-mini.danger:hover { color: var(--danger); }
.pd-tasks { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.pd-task { display: flex; align-items: center; gap: 7px; padding: 4px 6px; border-radius: 6px; }
.pd-task:hover { background: var(--surface); }
.pd-task.done .pd-task-name { text-decoration: line-through; color: var(--text-3); }
.pd-check { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; }
.pd-check:hover { border-color: var(--accent); }
.pd-check.done { background: var(--success); border-color: var(--success); }
.pd-task-name { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 12px; color: var(--text); font-family: inherit; padding: 2px 4px; margin: -2px -4px; border-radius: 4px; }
.pd-task-name:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.pd-task-empty { font-size: 10.5px; color: var(--text-3); padding: 4px 6px; }
.pd-add-metric { width: 100%; padding: 8px; border: 1.5px dashed var(--border-strong); border-radius: 8px; background: transparent; color: var(--text-3); font-size: 12px; cursor: pointer; font-family: inherit; transition: all .15s; }
.pd-add-metric:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.pd-empty { font-size: 12px; color: var(--text-3); padding: 10px 0; }
.pd-sync-hint { margin-top: 16px; font-size: 11px; color: var(--text-3); text-align: center; padding: 9px; background: var(--surface-2); border-radius: 8px; }
</style>
