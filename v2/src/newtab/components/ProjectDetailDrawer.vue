<script setup lang="ts">
/**
 * 项目详情抽屉（可编辑）
 * 用于：🚀 主攻项目点击、北极星 战略目标/任务推进率下钻、任务中心项目看板。
 * 所有编辑实时写回 store 并持久化——罗盘二级界面同步生效。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { uid } from '@/shared/utils'
import type { Direction, Project, TaskCard } from '@/shared/models'
import Drawer from '@/shared/components/Drawer.vue'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { removeMetricWithConfirm } from '@/shared/utils/compassCrud'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity, metricMaturity } from '@/shared/utils/maturity'
import { resolveProjectNextStep, tasksOfMetric, tasksOfProject } from '../views/compassMeta'
import TaskAddDrawer from './TaskAddDrawer.vue'
import TaskDetailDrawer from './compass/TaskDetailDrawer.vue'
import MetricDetailDrawer from './compass/MetricDetailDrawer.vue'

const props = defineProps<{
  open: boolean
  projectId: string | null
  /** 仅已接线指标详情的宿主开启下钻；共用宿主默认关闭，避免出现点了没反应的死按钮。 */
  enableMetricDrill?: boolean
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
  const metric = project.value?.metrics.find(m => m.id === metricId)
  return metric ? tasksOfMetric(metric, d.value.tasks) : []
}
function allProjectTasks() {
  if (!project.value) return []
  return tasksOfProject(project.value, d.value.tasks)
}
function progress(): number {
  const tasks = allProjectTasks()
  if (!tasks.length) return project.value?.progress || 0
  return Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
}

/** 项目“下一步”读数：直接复用 compassMeta 的唯一解析函数，避免两处回退逻辑漂移。 */
const nextStep = computed(() => {
  if (!project.value) return { nextStep: '', nextStepSource: 'empty' as const }
  return resolveProjectNextStep(project.value, allProjectTasks())
})

/** 下一步：用户填写优先；清空后不写占位，继续回退到任务推导。 */
const nextStepEditing = ref(false)
const nextStepDraft = ref('')
const nextStepInput = ref<HTMLInputElement | null>(null)
function startNextStepEdit() {
  if (!project.value) return
  nextStepDraft.value = project.value.nextStep || ''
  nextStepEditing.value = true
  void Promise.resolve().then(() => nextStepInput.value?.focus())
}
function saveNextStep() {
  if (!project.value || !nextStepEditing.value) return
  const value = nextStepDraft.value.trim()
  project.value.nextStep = value || undefined
  store.persist()
  nextStepEditing.value = false
  nextStepDraft.value = ''
}
function cancelNextStepEdit() {
  nextStepEditing.value = false
  nextStepDraft.value = ''
}

const tab = ref<'overview' | 'metrics' | 'tasks'>('overview')
watch(() => props.projectId, () => { tab.value = 'overview' })
const TABS = ['overview', 'metrics', 'tasks'] as const
function onTabKeydown(e: KeyboardEvent, current: number) {
  const key = e.key
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
  e.preventDefault()
  const next = key === 'Home' ? 0 : key === 'End' ? TABS.length - 1
    : key === 'ArrowRight' ? (current + 1) % TABS.length : (current - 1 + TABS.length) % TABS.length
  tab.value = TABS[next]
  const tabs = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  void nextTick(() => tabs?.[next]?.focus())
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
  // R146：并到真源（确认报数 + 3 秒撤销），与策展台/调度台/方向树同一口径
  void removeMetricWithConfirm(d.value, metricId, () => store.persist())
}

/** 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAddMetricId = ref<string | null>(null)
function openTaskAdd(metricId: string) { taskAddMetricId.value = metricId }
/** R51-B6：创建成功后直接打开详情抽屉 */
const detailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function onTaskCreated(t: TaskCard) { detailRef.value?.open(t) }
/** R141（反馈 #1）：指标下任务行只做解绑（✕ 回任务调度模块），删除本体收进任务详情 */
function unbindTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  unbindTaskFromMetric(d.value, t)
  store.persist()
  showToast(`已从本指标移除：「${t.title.slice(0, 16)}」回到任务调度模块`)
}
/* R166 定案 1：子任务改成卡内嵌 `subtasks`，不再是"独立卡 + parentId"——
   因此指标下的任务行是一维列表，R144 的 flattenTaskTree 展平与 ⤴ 升顶层随之退役。 */
function metricTaskRows(metricId: string) { return tasksForMetric(metricId) }

const metricDetailId = ref<string | null>(null)
const metricDetailOpen = ref(false)
function openMetric(metricId: string) {
  if (!props.enableMetricDrill) return
  metricDetailId.value = metricId
  metricDetailOpen.value = true
}
function openTask(task: TaskCard) { detailRef.value?.open(task) }
/** 概览页的链路状态必须覆盖两种断链：指标缺任务 + 项目内有任务未挂指标。 */
function chainStatus(): { broken: boolean; text: string } {
  const projectTasks = allProjectTasks()
  const linkedIds = new Set(
    (project.value?.metrics || []).flatMap(m => tasksForMetric(m.id).map(t => t.id))
  )
  const orphanCount = projectTasks.filter(t => !linkedIds.has(t.id)).length
  const missingMetricCount = project.value?.metrics.filter(m => !tasksForMetric(m.id).length).length || 0
  if (missingMetricCount && orphanCount) return { broken: true, text: `缺任务 ${missingMetricCount} · 未归属 ${orphanCount}` }
  if (missingMetricCount) return { broken: true, text: `${missingMetricCount} 个指标缺任务` }
  if (orphanCount) return { broken: true, text: `${orphanCount} 条任务未归属` }
  return { broken: false, text: '链路完整' }
}
</script>

<template>
  <Drawer :open="open && !!project" :title="project ? ` ${project.name}` : ''" width="480px" @close="emit('close')">
    <template v-if="project">
      <!-- 项目名 + 主攻标记 -->
      <div class="pd-head">
        <span v-if="project.isFocused" class="pd-focus-badge">主攻</span>
        <div class="pd-name" contenteditable="true" @blur="renameProject" @keydown.enter.prevent="onRenameEnter">{{ project.name }}</div>
      </div>

      <div class="pd-tabs" role="tablist" aria-label="项目详情分区">
        <button id="pd-tab-overview" class="pd-tab" role="tab" :class="{ on: tab === 'overview' }"
          :aria-selected="tab === 'overview'" :tabindex="tab === 'overview' ? 0 : -1"
          aria-controls="pd-panel-overview" @click="tab = 'overview'" @keydown="onTabKeydown($event, 0)">概览</button>
        <button id="pd-tab-metrics" class="pd-tab" role="tab" :class="{ on: tab === 'metrics' }"
          :aria-selected="tab === 'metrics'" :tabindex="tab === 'metrics' ? 0 : -1"
          aria-controls="pd-panel-metrics" @click="tab = 'metrics'" @keydown="onTabKeydown($event, 1)">指标 <span>{{ project.metrics.length }}</span></button>
        <button id="pd-tab-tasks" class="pd-tab" role="tab" :class="{ on: tab === 'tasks' }"
          :aria-selected="tab === 'tasks'" :tabindex="tab === 'tasks' ? 0 : -1"
          aria-controls="pd-panel-tasks" @click="tab = 'tasks'" @keydown="onTabKeydown($event, 2)">任务 <span>{{ allProjectTasks().length }}</span></button>
      </div>

      <!-- 概览：先回答“现在怎么样 / 下一步做什么 / 哪里断链” -->
      <div v-if="tab === 'overview'" id="pd-panel-overview" class="pd-panel" role="tabpanel" aria-labelledby="pd-tab-overview">
        <div class="pd-next" :class="nextStep.nextStepSource === 'empty' ? 'src-empty' : `src-${nextStep.nextStepSource}`">
          <span class="pd-next-l">下一步</span>
          <input
            v-if="nextStepEditing"
            ref="nextStepInput"
            v-model="nextStepDraft"
            class="pd-next-input"
            placeholder="写下一步要推进的具体动作；清空后按任务自动推导"
            @blur="saveNextStep"
            @keydown.enter.prevent="saveNextStep"
            @keydown.esc.prevent.stop="cancelNextStepEdit"
          >
          <button v-else class="pd-next-v" title="点击填写下一步" @click="startNextStepEdit">{{ nextStep.nextStep }}</button>
          <span v-if="nextStep.nextStepSource === 'task'" class="pd-next-src">按任务推导</span>
        </div>

        <div class="pd-stats">
          <div class="pd-stat"><div class="v">{{ progress() }}%</div><div class="l">完成进度</div></div>
          <div class="pd-stat"><div class="v">{{ project.metrics.length }}</div><div class="l">成功指标</div></div>
          <div class="pd-stat"><div class="v">{{ allProjectTasks().length }}</div><div class="l">任务总数</div></div>
          <div class="pd-stat"><div class="v">{{ allProjectTasks().filter(t=>t.status==='done').length }}</div><div class="l">已完成</div></div>
        </div>
        <div class="pd-progress"><div class="bar" :style="{width: progress() + '%'}" /></div>

        <div class="pd-overview-grid">
          <div class="pd-ov-card">
            <span class="pd-ov-l">链路状态</span>
            <b :class="{ warn: chainStatus().broken }">{{ chainStatus().text }}</b>
          </div>
          <div class="pd-ov-card">
            <span class="pd-ov-l">进行中任务</span>
            <b>{{ allProjectTasks().filter(t => t.status === 'doing').length }}</b>
          </div>
        </div>

        <div class="pd-label"><Icon name="folderopen" :size="13"/> 隶属战略目标（切换即同步罗盘）</div>
        <select class="pd-select" :value="dir?.id" @change="switchDirection">
          <option v-for="x in d.compass.directions" :key="x.id" :value="x.id">{{ x.name }}</option>
        </select>

        <div class="pd-quick">
          <button class="pd-quick-b" @click="tab = 'metrics'"><Icon name="target" :size="13"/> 查看指标</button>
          <button class="pd-quick-b" @click="tab = 'tasks'"><Icon name="checksquare" :size="13"/> 查看任务</button>
        </div>
      </div>

      <!-- 指标：可编辑、可继续下钻到指标详情 -->
      <div v-else-if="tab === 'metrics'" id="pd-panel-metrics" class="pd-panel" role="tabpanel" aria-labelledby="pd-tab-metrics">
        <div class="pd-label"><Icon name="target" :size="13"/> 成功指标（点击名称可编辑，详情继续下钻）</div>
        <div v-if="!project.metrics.length" class="pd-empty">暂无成功指标</div>
        <div v-for="m in project.metrics" :key="m.id" class="pd-metric">
          <div class="pd-metric-head">
            <input class="pd-metric-name" :value="m.title" @change="renameMetric(m.id, $event)" />
            <span class="pd-metric-count">{{ tasksForMetric(m.id).filter(t=>t.status==='done').length }}/{{ tasksForMetric(m.id).length }}</span>
            <MaturityBadge :m="metricMaturity(d, m)" />
            <button v-if="enableMetricDrill" class="pd-mini pd-detail" @click="openMetric(m.id)" title="打开指标详情">详情 ›</button>
            <button class="pd-mini" @click="openTaskAdd(m.id)" title="添加任务（新建 / 关联）">＋</button>
            <button class="pd-mini danger" @click="removeMetric(m.id)" title="删除指标"><Icon name="trash" :size="13"/></button>
          </div>
          <div class="pd-tasks">
            <div v-for="task in metricTaskRows(m.id)" :key="task.id" class="pd-task" :class="{done: task.status==='done'}">
              <div class="pd-check" v-pressable :class="{done: task.status==='done'}" @click="toggleTask(task.id)"><Icon v-if="task.status==='done'" name="check" :size="14"/></div>
              <button class="pd-task-name pd-task-open" @click="openTask(task)">{{ task.title }}</button>
              <MaturityBadge :m="taskMaturity(task)" />
              <button class="pd-mini" @click="unbindTask(task.id)" title="从本指标移除（解绑回任务调度模块；删除本体请进任务详情）"><Icon name="x" :size="13"/></button>
            </div>
            <div v-if="!tasksForMetric(m.id).length" class="pd-task-empty">暂无任务，点击 ＋ 添加</div>
          </div>
        </div>
        <button class="pd-add-metric" @click="addMetric">＋ 添加成功指标</button>
      </div>

      <!-- 任务：项目级任务清单，任务行继续打开共享任务详情 -->
      <div v-else id="pd-panel-tasks" class="pd-panel" role="tabpanel" aria-labelledby="pd-tab-tasks">
        <div class="pd-label"><Icon name="checksquare" :size="13"/> 项目任务（点击标题打开任务详情）</div>
        <div v-if="!allProjectTasks().length" class="pd-empty">这个项目还没有任务。先到指标页拆一条。</div>
        <div v-else class="pd-task-flat">
          <div v-for="task in allProjectTasks()" :key="task.id" class="pd-task" :class="{done: task.status==='done'}">
            <div class="pd-check" v-pressable :class="{done: task.status==='done'}" @click="toggleTask(task.id)"><Icon v-if="task.status==='done'" name="check" :size="14"/></div>
            <button class="pd-task-name pd-task-open" @click="openTask(task)">{{ task.title }}</button>
            <MaturityBadge :m="taskMaturity(task)" />
            <span class="pd-task-state">{{ task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待开始' }}</span>
          </div>
        </div>
      </div>

      <div class="pd-sync-hint"><Icon name="bulb" :size="13"/> 此处编辑实时写回调度台；项目 → 指标 → 任务可连续下钻，Esc 只关最上层</div>
    </template>
  </Drawer>

  <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
  <TaskAddDrawer :open="!!taskAddMetricId" :metric-id="taskAddMetricId || ''" :project-id="project?.id || ''"
    :metric-title="project?.metrics.find(m => m.id === taskAddMetricId)?.title" @close="taskAddMetricId = null" @created="onTaskCreated" />

  <!-- R51-B6：创建成功后直接打开详情抽屉 -->
  <TaskDetailDrawer ref="detailRef" />
  <MetricDetailDrawer v-if="enableMetricDrill" :open="metricDetailOpen" :metric-id="metricDetailId" @close="metricDetailOpen = false" />
</template>

<style scoped>
.pd-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.pd-focus-badge { background: var(--accent); color: #fff; font-size: var(--fs-tiny); padding: 2px 8px; border-radius: 99px; font-weight: 600; flex-shrink: 0; }
.pd-name { font-size: 16px; font-weight: 700; color: var(--text); outline: none; border-radius: 4px; padding: 2px 4px; margin: -2px -4px; }
.pd-name:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }

.pd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.pd-stat { background: var(--surface-2); border-radius: var(--radius-xs); padding: 10px 6px; text-align: center; }
.pd-stat .v { font-size: 18px; font-weight: 700; color: var(--accent); }
.pd-stat .l { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }
.pd-progress { height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; margin-bottom: 18px; }
.pd-progress .bar { height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s; }

.pd-tabs { display: flex; gap: 4px; background: var(--surface-2); padding: 4px; border-radius: 10px; margin-bottom: 16px; }
.pd-tab { flex: 1; border: 0; background: transparent; color: var(--text-3); font: inherit; font-size: var(--fs-sub); font-weight: 600; padding: 7px 4px; border-radius: 7px; cursor: pointer; }
.pd-tab span { margin-left: 3px; font-size: var(--fs-tiny); color: var(--text-2); font-variant-numeric: tabular-nums; }
.pd-tab.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.pd-tab.on span { color: var(--text-3); }
.pd-next { display: flex; align-items: center; gap: 7px; min-width: 0; margin-bottom: 14px; padding: 9px 11px; border-radius: var(--radius-sm); background: var(--surface-2); border-left: 2px solid var(--accent); }
.pd-next-l { flex: none; font-size: var(--fs-micro); font-weight: 700; color: var(--text-3); }
.pd-next-v { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0; background: transparent; padding: 0; text-align: left; font: inherit; font-size: var(--fs-sub); font-weight: 700; color: var(--text); cursor: text; }
.pd-next-v:hover { color: var(--accent-ink); }
.pd-next-input { flex: 1; min-width: 0; border: 1px solid var(--accent); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; font-size: var(--fs-sub); padding: 5px 7px; outline: none; }
.pd-next.src-empty .pd-next-v { color: var(--text-3); font-weight: 500; }
.pd-next-src { flex: none; font-size: var(--fs-tiny); color: var(--text-4); padding: 1px 6px; border-radius: 999px; background: var(--surface-3); }
.pd-overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
.pd-ov-card { display: flex; flex-direction: column; gap: 3px; padding: 10px 11px; border-radius: var(--radius-sm); background: var(--surface-2); }
.pd-ov-l { font-size: var(--fs-tiny); color: var(--text-3); }
.pd-ov-card b { font-size: var(--fs-sub); color: var(--text-2); }
.pd-ov-card b.warn { color: var(--warning); }
.pd-quick { display: flex; gap: 8px; margin-top: 16px; }
.pd-quick-b { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font: inherit; font-size: var(--fs-sub); cursor: pointer; }
.pd-quick-b:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.pd-task-open { text-align: left; border: 0; background: transparent; cursor: pointer; padding: 0; font-family: inherit; }
.pd-task-open:hover { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.pd-task-flat { display: flex; flex-direction: column; gap: 4px; }
.pd-task-state { flex: none; font-size: var(--fs-tiny); color: var(--text-3); }

.pd-label { font-size: var(--fs-caption); font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px; margin: 14px 0 7px; }
.pd-select { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: var(--fs-body); color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; }
.pd-select:focus { border-color: var(--accent); }

.pd-metric { background: var(--surface-2); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; }
.pd-metric-head { display: flex; align-items: center; gap: 7px; }
.pd-metric-name { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: var(--fs-body); font-weight: 600; color: var(--text); font-family: inherit; padding: 3px 5px; margin: -3px -5px; border-radius: 5px; }
.pd-metric-name:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.pd-metric-count { font-size: var(--fs-caption); color: var(--text-3); flex-shrink: 0; }
.pd-mini { width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--text-3); cursor: pointer; font-size: var(--fs-sub); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: inherit; }
.pd-mini.pd-detail { width: auto; padding: 0 7px; font-size: var(--fs-tiny); font-weight: 600; }
.pd-mini:hover { background: var(--surface-3); color: var(--text); }
.pd-mini.danger:hover { color: var(--danger); }
.pd-tasks { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.pd-task { display: flex; align-items: center; gap: 7px; padding: 4px 6px; border-radius: 6px; }
.pd-task:hover { background: var(--surface); }
.pd-task.done .pd-task-name { text-decoration: line-through; color: var(--text-3); }
.pd-check { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: var(--fs-micro); color: #fff; }
.pd-check:hover { border-color: var(--accent); }
.pd-check.done { background: var(--success); border-color: var(--success); }
.pd-task-name { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: var(--fs-sub); color: var(--text); font-family: inherit; padding: 2px 4px; margin: -2px -4px; border-radius: 4px; }
.pd-task-name:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.pd-task-empty { font-size: var(--fs-caption); color: var(--text-3); padding: 4px 6px; }
.pd-add-metric { width: 100%; padding: 8px; border: 1.5px dashed var(--border-strong); border-radius: 8px; background: transparent; color: var(--text-3); font-size: var(--fs-sub); cursor: pointer; font-family: inherit; transition: all var(--dur); }
.pd-add-metric:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.pd-empty { font-size: var(--fs-sub); color: var(--text-3); padding: 10px 0; }
.pd-sync-hint { margin-top: 16px; font-size: var(--fs-caption); color: var(--text-3); text-align: center; padding: 9px; background: var(--surface-2); border-radius: 8px; }
</style>
