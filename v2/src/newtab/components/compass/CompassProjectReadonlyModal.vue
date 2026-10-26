<script setup lang="ts">
/**
 * 调度台主攻项目的「项目全景 · 只读」。
 * - 只读：不改项目、指标或任务；文本可选中复制。
 * - 全景：同一份 compassMeta 关系按「方向 → 项目 → 指标 → 任务」完整铺开，
 *   同时显式呈现下一步、断链、停滞与进度，回答“这个主攻项目现在长什么样”。
 * - 单源：项目、指标和任务的归属关系统一从 compassMeta 与 store 现算。
 */
import { computed } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { useCompass } from '@/newtab/stores/compass'
import Modal from '@/shared/components/Modal.vue'
import type { Direction, Metric, Project, TaskCard } from '@/shared/models'
import { resolveProjectNextStep, tasksOfMetric, tasksOfProject } from '../../views/compassMeta'

const props = defineProps<{
  open: boolean
  projectId: string | null
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useAppStore()
const { isProjectStalled } = useCompass()
const d = computed(() => store.data!)

const found = computed<{ dir: Direction; project: Project } | null>(() => {
  if (!props.open || !props.projectId) return null
  for (const dir of d.value.compass?.directions || []) {
    const project = dir.projects.find(p => p.id === props.projectId)
    if (project) return { dir, project }
  }
  return null
})

const project = computed(() => found.value?.project || null)
const tasks = computed(() => project.value ? tasksOfProject(project.value, d.value.tasks || []) : [])
const doneCount = computed(() => tasks.value.filter(t => t.status === 'done').length)
const progress = computed(() => {
  if (!tasks.value.length) return Math.round(project.value?.progress || 0)
  return Math.round(doneCount.value / tasks.value.length * 100)
})
const nextStep = computed(() => project.value
  ? resolveProjectNextStep(project.value, tasks.value)
  : { nextStep: '', nextStepSource: 'empty' as const })
const metricTaskIds = computed(() => new Set(
  (project.value?.metrics || []).flatMap(metric => metricTasks(metric).map(task => task.id)),
))
const looseTasks = computed(() => tasks.value.filter(task => !metricTaskIds.value.has(task.id)))
const openTasks = computed(() => tasks.value.filter(task => task.status !== 'done'))
const riskCount = computed(() => {
  const p = project.value
  if (!p) return 0
  const emptyMetrics = (p.metrics || []).filter(metric => !metricTasks(metric).length).length
  return looseTasks.value.length + emptyMetrics + (p.metrics?.length ? 0 : 1)
})
const stalled = computed(() => {
  const p = project.value
  return p ? isProjectStalled(p) : false
})
const stateText = computed(() => {
  const p = project.value
  if (!p) return ''
  if (p.status === 'done') return '已完成'
  if (p.status === 'archived') return '已归档'
  if (p.status === 'paused') return '暂停'
  return '推进中'
})

function metricTasks(metric: Metric): TaskCard[] {
  return tasksOfMetric(metric, d.value.tasks || [])
}
</script>

<template>
  <Modal :open="open" width="min(760px, 94vw)" max-height="86vh" @close="emit('close')">
    <template #title>
      <span class="cpr-title"><span class="cpr-kicker">项目全景 · 只读</span>{{ project?.name || '项目详情' }}</span>
    </template>
    <template #sub>
      <span class="cpr-note">方向 → 项目 → 指标 → 任务全链路；内容可选中复制，修改请前往方向台。</span>
    </template>

    <div v-if="project" class="cpr-body">
      <section class="cpr-summary">
        <div class="cpr-summary-main">
          <span class="cpr-label">所属方向</span>
          <strong>{{ found?.dir.name || '未归入方向' }}</strong>
          <p v-if="project.nextStep || nextStep.nextStep">{{ nextStep.nextStep || project.nextStep }}</p>
          <p v-else class="cpr-muted">尚未填写下一步，任务中也暂无进行中的动作。</p>
          <div class="cpr-facts">
            <span>{{ project.metrics.length }} 条指标</span>
            <span>{{ tasks.length }} 条任务</span>
            <span>{{ openTasks.length }} 条待推进</span>
            <span :class="{ bad: riskCount > 0 }">{{ riskCount > 0 ? `断链 ${riskCount}` : '链路完整' }}</span>
            <span v-if="stalled" class="warn">停滞 14 天+</span>
          </div>
        </div>
        <div class="cpr-progress">
          <b>{{ progress }}%</b>
          <span>{{ doneCount }} / {{ tasks.length }} 项任务完成</span>
          <span class="cpr-state">{{ stateText }}</span>
        </div>
      </section>

      <section class="cpr-section">
        <h3>成功指标</h3>
        <div v-if="project.metrics.length" class="cpr-metrics">
          <article v-for="metric in project.metrics" :key="metric.id" class="cpr-metric">
            <div class="cpr-metric-head">
              <strong>{{ metric.title || '未命名指标' }}</strong>
              <span>{{ metricTasks(metric).filter(t => t.status === 'done').length }} / {{ metricTasks(metric).length }}</span>
            </div>
            <p v-if="metric.target" class="cpr-muted">目标：{{ metric.target }}</p>
            <ul v-if="metricTasks(metric).length">
              <li v-for="task in metricTasks(metric)" :key="task.id" :class="{ done: task.status === 'done' }">
                <span>{{ task.title || '未命名任务' }}</span>
                <small>{{ task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待开始' }}</small>
              </li>
            </ul>
            <p v-else class="cpr-muted">该指标下暂无任务。</p>
          </article>
        </div>
        <p v-else class="cpr-empty">该项目还没有成功指标。</p>
      </section>

      <section v-if="looseTasks.length" class="cpr-section">
        <h3>未挂指标的任务</h3>
        <ul class="cpr-loose">
          <li v-for="task in looseTasks" :key="task.id">
            <span>{{ task.title || '未命名任务' }}</span>
            <small>{{ task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待开始' }}</small>
          </li>
        </ul>
      </section>
    </div>
    <div v-else class="cpr-empty">这个项目已不存在，可能已在方向台删除。</div>

    <template #footer>
      <button class="cpr-close" type="button" @click="emit('close')">关闭</button>
    </template>
  </Modal>
</template>

<style scoped>
.cpr-title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cpr-kicker { color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 700; letter-spacing: .08em; }
.cpr-note { color: var(--text-3); font-size: var(--fs-caption); }
.cpr-body { display: flex; flex-direction: column; gap: 18px; }
.cpr-summary { display: flex; justify-content: space-between; gap: 20px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
.cpr-summary-main { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.cpr-label { color: var(--text-3); font-size: var(--fs-micro); }
.cpr-summary-main strong { color: var(--text); font-size: var(--fs-body); overflow-wrap: anywhere; }
.cpr-summary-main p { margin: 1px 0 0; color: var(--text-2); font-size: var(--fs-sub); line-height: 1.65; overflow-wrap: anywhere; }
.cpr-facts { display: flex; flex-wrap: wrap; gap: 5px 12px; margin-top: 3px; color: var(--text-3); font-size: var(--fs-micro); }
.cpr-facts .bad { color: var(--danger); }
.cpr-facts .warn { color: var(--warning); }
.cpr-muted { color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; }
.cpr-progress { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.cpr-progress b { color: var(--text); font-size: 22px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.cpr-progress span { color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.cpr-progress .cpr-state { padding: 1px 7px; border: 1px solid var(--border); border-radius: 99px; background: var(--surface); }
.cpr-section h3 { margin: 0 0 8px; color: var(--text-2); font-size: var(--fs-caption); letter-spacing: .04em; }
.cpr-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cpr-metric { min-width: 0; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); }
.cpr-metric-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.cpr-metric-head strong { min-width: 0; color: var(--text); font-size: var(--fs-sub); overflow-wrap: anywhere; }
.cpr-metric-head span { flex: none; color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.cpr-metric p { margin: 5px 0 0; }
.cpr-metric ul, .cpr-loose { margin: 8px 0 0; padding: 8px 0 0; border-top: 1px solid var(--border); list-style: none; display: flex; flex-direction: column; gap: 7px; }
.cpr-metric li, .cpr-loose li { display: flex; justify-content: space-between; gap: 10px; color: var(--text-2); font-size: var(--fs-caption); line-height: 1.5; }
.cpr-metric li span, .cpr-loose li span { min-width: 0; overflow-wrap: anywhere; }
.cpr-metric li small, .cpr-loose li small { flex: none; color: var(--text-3); font-size: var(--fs-micro); }
.cpr-metric li.done span { color: var(--text-3); text-decoration: line-through; }
.cpr-empty { padding: 16px 0; color: var(--text-3); font-size: var(--fs-caption); }
.cpr-close { align-self: flex-end; min-height: 30px; padding: 5px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-sub); cursor: pointer; }
.cpr-close:hover { border-color: var(--border-strong); color: var(--text); }
@media (max-width: 640px) {
  .cpr-summary { flex-direction: column; }
  .cpr-progress { align-items: flex-start; flex-direction: row; align-items: baseline; gap: 8px; }
  .cpr-metrics { grid-template-columns: minmax(0, 1fr); }
}
</style>
