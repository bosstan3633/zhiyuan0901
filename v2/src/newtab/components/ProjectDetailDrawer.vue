<script setup lang="ts">
/**
 * 项目详情抽屉（可编辑）
 * 用于：🚀 主攻项目点击、北极星 战略目标/任务推进率下钻、任务中心项目看板。
 * 所有编辑实时写回 store 并持久化——罗盘二级界面同步生效。
 *
 * V4.7.0（F5/T6）：项目详情从「概览 / 指标 / 任务」三页签收敛为单页纵向全貌树：
 * 项目头 → 成功指标 → 指标下任务 / 选题 → 未归属。modal 与 drawer 共用这一份结构。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { uid } from '@/shared/utils'
import type { Direction, Project, TaskCard, TopicCard } from '@/shared/models'
import Drawer from '@/shared/components/Drawer.vue'
import { showToast } from '@/shared/components/toast'
import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { removeMetricWithConfirm } from '@/shared/utils/compassCrud'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { metricMaturity } from '@/shared/utils/maturity'
import { resolveProjectNextStep, tasksOfMetric, tasksOfProject } from '../views/compassMeta'
import { isTopicDone, topicStatusOf } from '@/shared/utils/topicStatus'
import { isTaskDone, taskStatusOf, toggleTaskDone } from '@/shared/utils/taskStatus'
import { buildProjectTree } from '../views/projectTree'
// R146：删除指标的确认 / 报数 / 撤销由 removeMetricWithConfirm 统一走 useConfirm，本组件不另拼弹窗。
import TaskAddDrawer from './TaskAddDrawer.vue'
import TaskDetailDrawer from './compass/TaskDetailDrawer.vue'
import MetricDetailDrawer from './compass/MetricDetailDrawer.vue'
import ExportMenu, { type ExportFmt } from '@/newtab/components/dashboard/ExportMenu.vue'
import { downloadText } from '@/shared/utils/download'
import { buildProjectExportDocument, projectExportMarkdown, projectExportHtml } from '@/shared/utils/projectExport'

const props = defineProps<{
  open: boolean
  projectId: string | null
  /** 仅已接线指标详情的宿主开启下钻；共用宿主默认关闭，避免出现点了没反应的死按钮。 */
  enableMetricDrill?: boolean
  /** drawer = 原右侧抽屉；modal = 中央弹窗（内容与编辑能力完全相同） */
  mode?: 'drawer' | 'modal'
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

/** 项目下全部任务。保留唯一口径函数，供下一步推导与回归判据共同复用。 */
function tasksForMetric(metricId: string) {
  const metric = project.value?.metrics.find(m => m.id === metricId)
  return metric ? tasksOfMetric(metric, d.value.tasks) : []
}
function allProjectTasks() {
  if (!project.value) return []
  return tasksOfProject(project.value, d.value.tasks)
}

/** 单页全貌树：项目 → 指标 → 任务 / 选题；未归属由 buildProjectTree 统一归组。 */
const projectTree = computed(() => project.value ? buildProjectTree(d.value, project.value) : null)

function progress(): number {
  return projectTree.value?.progress ?? project.value?.progress ?? 0
}

const summary = computed(() => {
  const tree = projectTree.value
  if (!tree) return ''
  return `${tree.progress}% · ${tree.metrics.length} 个成功指标 · ${tree.total} 个任务 · ${tree.allTopics.length} 个选题 · ${tree.done} 个已完成`
})

/** 项目“下一步”读数：直接复用 compassMeta 的唯一解析函数，避免两处回退逻辑漂移。 */
const nextStep = computed(() => {
  if (!project.value) return { nextStep: '', nextStepSource: 'empty' as const }
  return resolveProjectNextStep(project.value, allProjectTasks(), d.value)
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

/** 指标折叠：默认全展开；只记“已收起”的 id，新增指标自然展开。 */
const collapsedMetrics = ref<Record<string, boolean>>({})
const allCollapsed = computed(() => {
  const metrics = project.value?.metrics || []
  return metrics.length > 0 && metrics.every(metric => collapsedMetrics.value[metric.id])
})
watch([() => props.open, () => props.projectId], ([open]) => {
  if (!open) return
  collapsedMetrics.value = {}
  nextStepEditing.value = false
  nextStepDraft.value = ''
})
function isMetricCollapsed(metricId: string): boolean {
  return !!collapsedMetrics.value[metricId]
}
function toggleMetric(metricId: string) {
  collapsedMetrics.value = { ...collapsedMetrics.value, [metricId]: !collapsedMetrics.value[metricId] }
}
function toggleAllMetrics() {
  const metrics = project.value?.metrics || []
  if (allCollapsed.value) {
    collapsedMetrics.value = {}
    return
  }
  collapsedMetrics.value = Object.fromEntries(metrics.map(metric => [metric.id, true]))
}

// ---- 编辑（实时同步罗盘） ----
/** V3.9.31（F5）：项目详情弹窗导出 —— 与项目全景共用 projectExport 单一生成器（防两处漂移）。
 *  结构化输出项目头/指标/任务/选题，链接可点击；附件不嵌本体（同任务卡导出口径）。 */
function exportProject(fmt: ExportFmt): void {
  if (!project.value || (fmt !== 'md' && fmt !== 'html')) return
  const doc = buildProjectExportDocument(d.value, project.value)
  if (fmt === 'md') downloadText(`${doc.filenameBase}.md`, projectExportMarkdown(doc), 'md')
  else downloadText(`${doc.filenameBase}.html`, projectExportHtml(doc), 'html')
  showToast(`已导出项目全景 ${fmt === 'md' ? 'Markdown' : 'HTML'}（链接可点击，不含附件本体）`)
}
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

function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  toggleTaskDone(d.value, t)
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
/** R141 / V3.9.22：指标下任务行只做解绑（✕ 回任务池），删除本体收进任务详情。 */
function unbindTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  unbindTaskFromMetric(d.value, t)
  store.persist()
  showToast(`已解除关联：「${t.title.slice(0, 16)}」已回任务池`)
}

const metricDetailId = ref<string | null>(null)
const metricDetailOpen = ref(false)
function openMetric(metricId: string) {
  if (!props.enableMetricDrill) return
  metricDetailId.value = metricId
  metricDetailOpen.value = true
}
function openTask(task: TaskCard) { detailRef.value?.open(task) }
function openTopic(topic: TopicCard) { emitOpenDrawer({ kind: 'topic', id: topic.id }) }

function taskStatusLabel(task: TaskCard): string {
  return taskStatusOf(store.data!, task)?.name || '待开始'
}
function planDateLabel(date?: string): string {
  if (!date) return '未落图'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return match ? `${Number(match[2])}/${Number(match[3])}` : date
}
function topicStatusName(topic: TopicCard): string {
  return topicStatusOf(d.value, topic.statusId)?.name || '未设置状态'
}
function topicStatusColor(topic: TopicCard): string {
  return topicStatusOf(d.value, topic.statusId)?.color || 'var(--text-4)'
}
function topicDone(topic: TopicCard): boolean {
  return isTopicDone(d.value, topic)
}
</script>

<template>
  <Drawer :open="open && !!project" :title="project ? project.name : ''" width="480px" :mode="mode || 'drawer'" @close="emit('close')">
    <template v-if="project" #title>
      <span v-if="project.isFocused" class="pd-focus-badge">主攻</span>
      <span
        class="pd-name"
        contenteditable="true"
        spellcheck="false"
        title="点击编辑项目名"
        @blur="renameProject"
        @keydown.enter.prevent="onRenameEnter"
      >{{ project.name }}</span>
    </template>
    <template v-if="project" #title-extra>
      <ExportMenu :formats="['md', 'html']" align="end" @pick="exportProject" />
    </template>

    <template v-if="project">
      <!-- 项目头：战略路径 / 下一步 / 一行进度。编辑能力收进「项目设置」，不抢主视觉。 -->
      <section class="pd-head">
        <nav class="pd-crumb" aria-label="项目战略路径">
          <Icon name="folderopen" :size="13" />
          <span>{{ dir?.name || '未隶属战略目标' }}</span>
          <span class="pd-crumb-sep">›</span>
          <b>{{ project.name }}</b>
        </nav>

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
          <button v-else class="pd-next-v" title="点击填写下一步" @click="startNextStepEdit">{{ nextStep.nextStep || '填写下一步' }}</button>
          <span v-if="nextStep.nextStepSource === 'task'" class="pd-next-src">按任务推导</span>
        </div>

        <div class="pd-summary">
          <span class="pd-summary-text">{{ summary }}</span>
          <span class="pd-summary-bar" role="progressbar" :aria-valuenow="progress()" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: progress() + '%' }" />
          </span>
        </div>

        <details class="pd-settings">
          <summary><Icon name="settings" :size="13" /> 项目设置</summary>
          <div class="pd-settings-body">
            <label class="pd-setting-field">
              <span>所属战略目标</span>
              <select class="pd-select" :value="dir?.id" @change="switchDirection">
                <option v-for="x in d.compass.directions" :key="x.id" :value="x.id">{{ x.name }}</option>
              </select>
            </label>
            <p class="pd-setting-note">改名：点顶部项目名；加指标：树底；加任务：指标行 ＋。</p>
          </div>
        </details>
      </section>

      <!-- 单页纵向树：全部指标一次展开，上下滚动即可看到项目全貌。 -->
      <section class="pd-tree" aria-label="项目全貌">
        <div class="pd-tree-head">
          <span><Icon name="target" :size="13" /> 项目全貌</span>
          <button v-if="project.metrics.length" class="pd-collapse-all" type="button" @click="toggleAllMetrics">
            {{ allCollapsed ? '全部展开' : '全部收起' }}
          </button>
        </div>

        <div v-if="projectTree">
          <div v-if="!project.metrics.length" class="pd-empty">
            这个项目还没有成功指标。先添加一个指标，再把任务和选题挂进来。
          </div>

          <article v-for="m in projectTree.metrics" :key="m.id" class="pd-metric">
            <div class="pd-metric-head">
              <button
                class="pd-fold"
                type="button"
                :aria-expanded="!isMetricCollapsed(m.id)"
                :aria-controls="`pd-metric-body-${m.id}`"
                :title="isMetricCollapsed(m.id) ? '展开指标' : '收起指标'"
                @click="toggleMetric(m.id)"
              >
                <span class="pd-chev" :class="{ closed: isMetricCollapsed(m.id) }" />
              </button>
              <input class="pd-metric-name" :value="m.title" @change="renameMetric(m.id, $event)" aria-label="成功指标名称">
              <span class="pd-metric-count">{{ m.done }}/{{ m.total }} 任务 · {{ m.topics.length }} 个选题</span>
              <MaturityBadge :m="metricMaturity(d, m.metric)" />
              <div class="pd-metric-actions">
                <button v-if="enableMetricDrill" class="pd-mini pd-detail" @click="openMetric(m.id)" title="打开指标详情">详情 ›</button>
                <button class="pd-mini" @click="openTaskAdd(m.id)" title="添加任务（新建 / 关联）">＋</button>
                <button class="pd-mini danger" @click="removeMetric(m.id)" title="删除指标"><Icon name="trash" :size="13" /></button>
              </div>
            </div>

            <div v-show="!isMetricCollapsed(m.id)" :id="`pd-metric-body-${m.id}`" class="pd-metric-body">
              <div v-if="m.metric.target || m.metric.acceptance" class="pd-metric-meta">
                <div v-if="m.metric.target"><span>目标</span>{{ m.metric.target }}</div>
                <div v-if="m.metric.acceptance"><span>验收</span>{{ m.metric.acceptance }}</div>
              </div>

              <div class="pd-card-list">
                <div v-if="!m.total && !m.topics.length" class="pd-task-empty">暂无任务与选题</div>

                <div v-for="task in m.tasks" :key="'task-' + task.id" class="pd-task pd-row" :class="{ done: isTaskDone(d, task) }">
                  <div class="pd-check" v-pressable :class="{ done: isTaskDone(d, task) }" @click="toggleTask(task.id)">
                    <Icon v-if="isTaskDone(d, task)" name="check" :size="14" />
                  </div>
                  <button class="pd-task-name pd-task-open" @click="openTask(task)">{{ task.title }}</button>
                  <span class="pd-state">{{ taskStatusLabel(task) }}</span>
                  <span class="pd-date" :class="{ empty: !task.dueDate }" :title="task.dueDate ? `计划执行 ${task.dueDate}` : '未落图'">
                    {{ task.dueDate ? `计划 ${planDateLabel(task.dueDate)}` : '未落图' }}
                  </span>
                  <button class="pd-mini" @click="unbindTask(task.id)" title="解除指标关联，任务回任务池（真删除请进任务详情）"><Icon name="x" :size="13" /></button>
                </div>

                <div v-for="topic in m.topics" :key="'topic-' + topic.id" class="pd-topic pd-row" :class="{ done: topicDone(topic) }">
                  <span class="pd-topic-mark" :style="{ color: topicStatusColor(topic) }" title="选题卡">选题</span>
                  <button class="pd-task-name pd-task-open" @click="openTopic(topic)">{{ topic.title }}</button>
                  <span class="pd-state">{{ topicStatusName(topic) }}</span>
                  <span class="pd-date" :class="{ empty: !topic.dueDate }" :title="topic.dueDate ? `计划执行 ${topic.dueDate}` : '未落图'">
                    {{ topic.dueDate ? `计划 ${planDateLabel(topic.dueDate)}` : '未落图' }}
                  </span>
                </div>
              </div>
            </div>
          </article>

          <!-- 项目内存在未挂指标的任务 / 选题时，单独成组，避免在树里消失。 -->
          <article v-if="projectTree.orphanTasks.length || projectTree.orphanTopics.length" class="pd-metric pd-orphan">
            <div class="pd-metric-head">
              <span class="pd-orphan-icon"><Icon name="folderopen" :size="14" /></span>
              <span class="pd-orphan-title">未归属</span>
              <span class="pd-metric-count">{{ projectTree.orphanTasks.length }} 任务 · {{ projectTree.orphanTopics.length }} 个选题</span>
              <span class="pd-orphan-note">项目内未挂指标</span>
            </div>
            <div class="pd-card-list">
              <div v-for="task in projectTree.orphanTasks" :key="'orphan-task-' + task.id" class="pd-task pd-row" :class="{ done: isTaskDone(d, task) }">
                <div class="pd-check" v-pressable :class="{ done: isTaskDone(d, task) }" @click="toggleTask(task.id)">
                  <Icon v-if="isTaskDone(d, task)" name="check" :size="14" />
                </div>
                <button class="pd-task-name pd-task-open" @click="openTask(task)">{{ task.title }}</button>
                <span class="pd-state">{{ taskStatusLabel(task) }}</span>
                <span class="pd-date" :class="{ empty: !task.dueDate }" :title="task.dueDate ? `计划执行 ${task.dueDate}` : '未落图'">
                  {{ task.dueDate ? `计划 ${planDateLabel(task.dueDate)}` : '未落图' }}
                </span>
                <button class="pd-mini" @click="unbindTask(task.id)" title="移出项目，任务回任务池"><Icon name="x" :size="13" /></button>
              </div>

              <div v-for="topic in projectTree.orphanTopics" :key="'orphan-topic-' + topic.id" class="pd-topic pd-row" :class="{ done: topicDone(topic) }">
                <span class="pd-topic-mark" :style="{ color: topicStatusColor(topic) }" title="选题卡">选题</span>
                <button class="pd-task-name pd-task-open" @click="openTopic(topic)">{{ topic.title }}</button>
                <span class="pd-state">{{ topicStatusName(topic) }}</span>
                <span class="pd-date" :class="{ empty: !topic.dueDate }" :title="topic.dueDate ? `计划执行 ${topic.dueDate}` : '未落图'">
                  {{ topic.dueDate ? `计划 ${planDateLabel(topic.dueDate)}` : '未落图' }}
                </span>
              </div>
            </div>
          </article>

          <button class="pd-add-metric" @click="addMetric">＋ 添加成功指标</button>
        </div>
      </section>

      <div class="pd-sync-hint"><Icon name="bulb" :size="13" /> 项目 → 指标 → 任务/选题可连续下钻；点击卡片打开详情，不关闭项目全景</div>
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
.pd-focus-badge {
  background: var(--accent);
  color: #fff;
  font-size: var(--fs-tiny);
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 600;
  flex-shrink: 0;
}
.pd-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  outline: none;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
}
.pd-name:focus {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.pd-head { margin-bottom: 18px; }
.pd-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-bottom: 10px;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.pd-crumb b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
  font-weight: 600;
}
.pd-crumb-sep { color: var(--text-4); }

.pd-next {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-bottom: 10px;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border-left: 2px solid var(--accent);
}
.pd-next-l { flex: none; font-size: var(--fs-micro); font-weight: 700; color: var(--text-3); }
.pd-next-v {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  font: inherit;
  font-size: var(--fs-sub);
  font-weight: 700;
  color: var(--text);
  cursor: text;
}
.pd-next-v:hover { color: var(--accent-ink); }
.pd-next-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: var(--fs-sub);
  padding: 5px 7px;
  outline: none;
}
.pd-next.src-empty .pd-next-v { color: var(--text-3); font-weight: 500; }
.pd-next-src {
  flex: none;
  font-size: var(--fs-tiny);
  color: var(--text-4);
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-3);
}

.pd-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-bottom: 8px;
}
.pd-summary-text {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2);
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
}
.pd-summary-bar {
  flex: 1;
  min-width: 48px;
  height: 5px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--surface-3);
}
.pd-summary-bar > span {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--accent);
  transition: width .4s;
}

.pd-settings {
  margin-top: 2px;
  border-radius: var(--radius-sm);
}
.pd-settings > summary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  color: var(--text-3);
  font-size: var(--fs-caption);
  cursor: pointer;
  list-style: none;
  border-radius: 6px;
}
.pd-settings > summary::-webkit-details-marker { display: none; }
.pd-settings > summary:hover { background: var(--surface-2); color: var(--text-2); }
.pd-settings-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 8px 9px;
  margin-top: 2px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.pd-setting-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.pd-setting-note { margin: 0; color: var(--text-4); font-size: var(--fs-tiny); }
.pd-select {
  min-width: 180px;
  padding: 6px 9px;
  background: var(--surface);
  border-radius: 7px;
  font-size: var(--fs-sub);
  color: var(--text);
  border: 1px solid var(--border);
  outline: none;
  cursor: pointer;
}
.pd-select:focus { border-color: var(--accent); }

.pd-tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 7px;
  margin-bottom: 9px;
  border-bottom: 1px solid var(--border);
  color: var(--text-3);
  font-size: var(--fs-caption);
  font-weight: 600;
  letter-spacing: .3px;
}
.pd-tree-head > span { display: inline-flex; align-items: center; gap: 5px; }
.pd-collapse-all {
  border: 0;
  background: transparent;
  color: var(--text-3);
  font: inherit;
  font-size: var(--fs-tiny);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 5px;
}
.pd-collapse-all:hover { background: var(--surface-2); color: var(--text); }

.pd-metric {
  padding: 10px 12px;
  margin-bottom: 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.pd-metric-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pd-fold {
  width: 24px;
  height: 24px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
.pd-fold:hover { background: var(--surface-3); color: var(--text); }
.pd-chev {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform var(--dur);
}
.pd-chev.closed { transform: translateY(-1px) rotate(-45deg); }

.pd-metric-name {
  flex: 1 1 200px;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--text);
  font-family: inherit;
  padding: 3px 5px;
  margin: -3px -5px;
  border-radius: 5px;
}
.pd-metric-name:focus {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
.pd-metric-count {
  flex: none;
  color: var(--text-3);
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
}
.pd-metric-actions { display: flex; align-items: center; gap: 1px; flex: none; margin-left: auto; }
.pd-mini {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  font-size: var(--fs-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: inherit;
}
.pd-mini.pd-detail { width: auto; padding: 0 7px; font-size: var(--fs-tiny); font-weight: 600; }
.pd-mini:hover { background: var(--surface-3); color: var(--text); }
.pd-mini.danger:hover { color: var(--danger); }

.pd-metric-body { padding-top: 8px; }
.pd-metric-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 9px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-2);
  font-size: var(--fs-caption);
  line-height: 1.5;
}
.pd-metric-meta span {
  display: inline-block;
  min-width: 30px;
  margin-right: 7px;
  color: var(--text-4);
  font-size: var(--fs-tiny);
}

.pd-card-list { display: flex; flex-direction: column; gap: 2px; }
.pd-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 2px 5px;
  border-radius: 6px;
}
.pd-row:hover { background: var(--surface); }
.pd-row.done .pd-task-name { text-decoration: line-through; color: var(--text-3); }
.pd-check {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 0;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-micro);
  color: #fff;
  position: relative;
}
.pd-check::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
}
.pd-check:hover::before { border-color: var(--accent); }
.pd-check.done::before { background: var(--success); border-color: var(--success); }
.pd-check :deep(svg) { position: relative; z-index: 1; }
.pd-task-name {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-sub);
  color: var(--text);
  font-family: inherit;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 4px;
}
.pd-task-open { text-align: left; cursor: pointer; }
.pd-task-open:hover { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
.pd-state {
  flex: none;
  color: var(--text-3);
  font-size: var(--fs-tiny);
  white-space: nowrap;
}
.pd-date {
  flex: none;
  min-width: 58px;
  color: var(--text-3);
  font-size: var(--fs-tiny);
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.pd-date.empty { color: var(--text-4); }
.pd-topic-mark {
  width: 28px;
  flex: none;
  text-align: center;
  font-size: var(--fs-micro);
  font-weight: 700;
  line-height: 1;
}

.pd-orphan { border: 1px dashed var(--border-strong); background: transparent; }
.pd-orphan-icon { display: inline-flex; color: var(--text-3); }
.pd-orphan-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); }
.pd-orphan-note { margin-left: auto; color: var(--text-4); font-size: var(--fs-tiny); }

.pd-task-empty { color: var(--text-3); font-size: var(--fs-caption); padding: 5px 6px; }
.pd-empty { color: var(--text-3); font-size: var(--fs-sub); padding: 12px 0; }
.pd-add-metric {
  width: 100%;
  padding: 9px;
  margin-top: 3px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  font-size: var(--fs-sub);
  cursor: pointer;
  font-family: inherit;
  transition: all var(--dur);
}
.pd-add-metric:hover { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); }
.pd-sync-hint {
  margin-top: 16px;
  font-size: var(--fs-caption);
  color: var(--text-3);
  text-align: center;
  padding: 9px;
  background: var(--surface-2);
  border-radius: 8px;
}

@media (max-width: 720px) {
  .pd-summary { align-items: flex-start; flex-direction: column; gap: 5px; }
  .pd-summary-bar { width: 100%; flex: none; }
  .pd-metric-count { order: 1; }
  .pd-metric-actions { order: 2; }
  .pd-date { min-width: 0; }
}
@media (max-width: 560px) {
  .pd-row { flex-wrap: wrap; }
  .pd-task-name { flex-basis: calc(100% - 76px); }
  .pd-state, .pd-date { margin-left: 34px; }
  .pd-orphan-note { display: none; }
}
</style>
