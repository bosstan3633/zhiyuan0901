<script setup lang="ts">
/**
 * V3.9.32：策展模式 · 只读详情抽屉。
 * V4.0.3：详情按层级展开其下隶属信息，任务逐项罗列，未归档任务不再拼成一行。
 * 只读边界：本文件不承载任何结构编辑；修改动作统一导流回方向台。
 */
import { computed } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import Drawer from '@/shared/components/Drawer.vue'
import type {
  CurationGoalNode,
  CurationMetricNode,
  CurationProjectNode,
  CurationSel,
  CurationTaskNode,
  CurationTree,
} from '@/shared/utils/compassCurationModel'

const props = defineProps<{ open: boolean; sel: CurationSel | null; tree: CurationTree }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'edit'): void }>()

interface StatItem { label: string; value: string | number; hint?: string }
interface TaskLocation { goal: string; project: string; metric: string }

const stLabel: Record<string, string> = {
  done: '已完成',
  doing: '进行中',
  todo: '待开始',
  stale: '停滞 14 天+',
}
const priLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
const projectStatusLabel: Record<string, string> = {
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
  archived: '已归档',
}
const goalStatusLabel: Record<string, string> = {
  active: '进行中',
  paused: '已暂停',
  archived: '已归档',
}
const termLabel: Record<string, string> = { long: '远期', mid: '中期', short: '近期' }

const fmtTs = (ts?: number): string => ts ? new Date(ts).toLocaleDateString('zh-CN') : '—'
const fmtText = (value?: string): string => (value || '').trim() || '—'
const httpLink = (value?: string): string => {
  const s = (value || '').trim()
  return /^https?:\/\//.test(s) ? s : ''
}
const goalTasks = (g: CurationGoalNode): CurationTaskNode[] =>
  g.projects.flatMap(P => P.metrics.flatMap(M => M.tasks))
const goalMetricCount = (g: CurationGoalNode): number =>
  g.projects.reduce((sum, P) => sum + P.metrics.length, 0)
const goalTaskCount = (g: CurationGoalNode): number =>
  g.projects.reduce((sum, P) => sum + P.totalCount, 0)

const kindLabel = computed(() => {
  const s = props.sel
  return s?.kind === 'vision' ? '根 · 愿景'
    : s?.kind === 'mission' ? '干 · 使命'
      : s?.kind === 'goal' ? '主枝 · 战略目标'
        : s?.kind === 'project' ? '分枝 · 项目'
          : s?.kind === 'metric' ? '花果 · 成功指标'
            : s?.kind === 'task' ? '叶 · 任务'
              : s?.kind === 'orphans' ? '散叶 · 未归档任务'
                : '详情'
})

const title = computed(() => {
  const s = props.sel
  if (!s) return '—'
  if (s.kind === 'goal') return s.goal.dir.name || '未命名战略目标'
  if (s.kind === 'project') return s.node.project.name || '未命名项目'
  if (s.kind === 'metric') return s.node.metric.title || '未命名指标'
  if (s.kind === 'task') return s.node.task.title || '未命名任务'
  if (s.kind === 'orphans') return `${props.tree.orphans.length} 件未归档任务`
  return s.kind === 'vision' ? '这棵树为什么长 · 愿景' : '这棵树为什么长 · 使命'
})

const goalSel = computed<CurationGoalNode | null>(() =>
  props.sel?.kind === 'goal' ? props.sel.goal : null)
const projectSel = computed<CurationProjectNode | null>(() =>
  props.sel?.kind === 'project' ? props.sel.node : null)
const metricSel = computed<CurationMetricNode | null>(() =>
  props.sel?.kind === 'metric' ? props.sel.node : null)
const taskSel = computed<CurationTaskNode | null>(() =>
  props.sel?.kind === 'task' ? props.sel.node : null)

const globalStats = computed<StatItem[]>(() => {
  const projects = props.tree.goals.flatMap(g => g.projects)
  const metrics = projects.flatMap(P => P.metrics)
  const mountedTasks = metrics.reduce((sum, M) => sum + M.totalCount, 0)
  const mountedDone = metrics.reduce((sum, M) => sum + M.doneCount, 0)
  return [
    { label: '战略目标', value: props.tree.goals.length },
    { label: '项目', value: projects.length },
    { label: '成功指标', value: metrics.length },
    { label: '已挂任务', value: mountedTasks, hint: `${mountedDone} 件完成` },
    { label: '未归档', value: props.tree.orphans.length, hint: '待归位' },
  ]
})

const summaryStats = computed<StatItem[]>(() => {
  const g = goalSel.value
  if (g) {
    const tasks = goalTasks(g)
    return [
      { label: '项目', value: g.projects.length },
      { label: '成功指标', value: goalMetricCount(g) },
      { label: '任务', value: tasks.length },
      { label: '已完成', value: tasks.filter(T => T.status === 'done').length },
    ]
  }
  const P = projectSel.value
  if (P) {
    return [
      { label: '成功指标', value: P.metrics.length },
      { label: '任务', value: P.totalCount },
      { label: '已完成', value: P.doneCount },
      { label: '进度', value: `${P.progress}%` },
    ]
  }
  const M = metricSel.value
  if (M) {
    return [
      { label: '任务', value: M.totalCount },
      { label: '已完成', value: M.doneCount },
      { label: '进度', value: `${M.progress}%` },
    ]
  }
  return []
})

const goalTaskRows = computed(() => {
  const g = goalSel.value
  if (!g) return []
  return g.projects.flatMap(P => P.metrics.flatMap(M =>
    M.tasks.map(T => ({ taskNode: T, projectName: P.project.name || '未命名项目', metricTitle: M.metric.title || '未命名指标' }))))
})

const taskLocation = computed<TaskLocation | null>(() => {
  const s = props.sel
  if (!s || s.kind !== 'task') return null
  for (const g of props.tree.goals) {
    for (const P of g.projects) {
      for (const M of P.metrics) {
        if (M.tasks.some(T => T.task.id === s.node.task.id)) {
          return {
            goal: g.dir.name || '未命名战略目标',
            project: P.project.name || '未命名项目',
            metric: M.metric.title || '未命名指标',
          }
        }
      }
    }
  }
  return null
})

const taskLink = computed(() => {
  const s = props.sel
  return s?.kind === 'task' ? httpLink(s.node.task.link) : ''
})
</script>

<template>
  <Drawer :open="open && !!sel" :title="title" width="480px" @close="emit('close')">
    <template #title-extra>
      <span class="crd-kind">{{ kindLabel }}</span>
    </template>

    <div v-if="sel" class="crd-body">
      <template v-if="sel.kind === 'vision' || sel.kind === 'mission'">
        <p class="crd-lead">
          {{ sel.kind === 'vision' ? (tree.vision || '尚未填写愿景') : (tree.mission || '尚未填写使命') }}
        </p>
        <div class="crd-stats">
          <div v-for="s in globalStats" :key="s.label" class="crd-stat">
            <b>{{ s.value }}</b>
            <span>{{ s.label }}</span>
            <small v-if="s.hint">{{ s.hint }}</small>
          </div>
        </div>
        <section class="crd-section">
          <h3>下属战略目标</h3>
          <article v-for="g in tree.goals" :key="g.dir.id" class="crd-group">
            <header class="crd-group-head">
              <b>{{ g.dir.name || '未命名战略目标' }}</b>
              <span>{{ g.projects.length }} 项目 · {{ goalMetricCount(g) }} 指标 · {{ goalTaskCount(g) }} 任务</span>
            </header>
            <div v-for="P in g.projects" :key="P.project.id" class="crd-tree-line">
              <span>{{ P.project.name || '未命名项目' }}</span>
              <small>{{ P.metrics.length }} 指标 · {{ P.doneCount }}/{{ P.totalCount }} · {{ P.progress }}%</small>
            </div>
            <p v-if="!g.projects.length" class="crd-empty">这个战略目标下还没有项目。</p>
          </article>
          <p v-if="!tree.goals.length" class="crd-empty">方向树还没有战略目标。</p>
        </section>
      </template>

      <template v-else-if="goalSel">
        <p class="crd-lead">
          {{ goalStatusLabel[goalSel.dir.status] || goalSel.dir.status }}
          <template v-if="goalSel.dir.term"> · {{ termLabel[goalSel.dir.term] || goalSel.dir.term }}</template>
        </p>
        <div class="crd-stats">
          <div v-for="s in summaryStats" :key="s.label" class="crd-stat">
            <b>{{ s.value }}</b><span>{{ s.label }}</span>
          </div>
        </div>
        <section class="crd-section">
          <h3>项目与成功指标</h3>
          <article v-for="P in goalSel.projects" :key="P.project.id" class="crd-group">
            <header class="crd-group-head">
              <b>{{ P.project.name || '未命名项目' }}</b>
              <span>{{ P.doneCount }}/{{ P.totalCount }} · {{ P.progress }}%<template v-if="P.project.isFocused"> · 主攻</template></span>
            </header>
            <div v-for="M in P.metrics" :key="M.metric.id" class="crd-tree-line">
              <span>{{ M.metric.title || '未命名指标' }}</span>
              <small>{{ M.doneCount }}/{{ M.totalCount }} · {{ M.progress }}%</small>
            </div>
            <p v-if="!P.metrics.length" class="crd-empty">这个项目下还没有成功指标。</p>
          </article>
          <p v-if="!goalSel.projects.length" class="crd-empty">这个战略目标下还没有项目。</p>
        </section>
        <section class="crd-section">
          <h3>挂载任务 <span>{{ goalTaskRows.length }}</span></h3>
          <div v-if="goalTaskRows.length" class="crd-task-list">
            <article v-for="row in goalTaskRows" :key="row.taskNode.task.id" class="crd-task">
              <span class="crd-dot" :class="'st-' + row.taskNode.status"></span>
              <div class="crd-task-main">
                <b>{{ row.taskNode.task.title || '未命名任务' }}</b>
                <small>{{ row.projectName }} / {{ row.metricTitle }}</small>
              </div>
              <span class="crd-chip">{{ stLabel[row.taskNode.status] || row.taskNode.status }}</span>
            </article>
          </div>
          <p v-else class="crd-empty">这个战略目标下还没有挂载任务。</p>
        </section>
      </template>

      <template v-else-if="projectSel">
        <div class="crd-info">
          <div><span>状态</span><b>{{ projectStatusLabel[projectSel.project.status] || projectSel.project.status }}</b></div>
          <div><span>身份</span><b>{{ projectSel.project.isFocused ? '主攻项目' : '普通项目' }}</b></div>
          <div><span>周期</span><b>{{ fmtText(projectSel.project.startDate) }} → {{ fmtText(projectSel.project.endDate) }}</b></div>
          <div><span>推进</span><b>{{ projectSel.doneCount }}/{{ projectSel.totalCount }} 任务 · {{ projectSel.progress }}%</b></div>
          <div><span>状态提示</span><b :class="{ warn: projectSel.stalled }">{{ projectSel.stalled ? '停滞 14 天+' : '正常推进' }}</b></div>
          <div><span>下一步</span><b>{{ fmtText(projectSel.project.nextStep) }}</b></div>
          <div><span>复盘</span><b>{{ fmtText(projectSel.project.retrospective) }}</b></div>
        </div>
        <div class="crd-stats">
          <div v-for="s in summaryStats" :key="s.label" class="crd-stat">
            <b>{{ s.value }}</b><span>{{ s.label }}</span>
          </div>
        </div>
        <section v-for="M in projectSel.metrics" :key="M.metric.id" class="crd-section">
          <header class="crd-section-head">
            <h3>{{ M.metric.title || '未命名指标' }}</h3>
            <span>{{ M.doneCount }}/{{ M.totalCount }} · {{ M.progress }}%</span>
          </header>
          <div class="crd-info compact">
            <div><span>目标</span><b>{{ fmtText(M.metric.target) }}</b></div>
            <div><span>验收</span><b>{{ fmtText(M.metric.acceptance) }}</b></div>
          </div>
          <div v-if="M.tasks.length" class="crd-task-list">
            <article v-for="T in M.tasks" :key="T.task.id" class="crd-task">
              <span class="crd-dot" :class="'st-' + T.status"></span>
              <div class="crd-task-main">
                <b>{{ T.task.title || '未命名任务' }}</b>
                <small>{{ stLabel[T.status] || T.status }}<template v-if="T.task.dueDate"> · 截止 {{ T.task.dueDate }}</template></small>
              </div>
              <span v-if="T.task.priority" class="crd-chip">{{ priLabel[T.task.priority] || T.task.priority }}优</span>
            </article>
          </div>
          <p v-else class="crd-empty">这个成功指标下还没有任务。</p>
        </section>
        <p v-if="!projectSel.metrics.length" class="crd-empty">这个项目还没有成功指标。</p>
      </template>

      <template v-else-if="metricSel">
        <div class="crd-info">
          <div><span>进度</span><b>{{ metricSel.doneCount }}/{{ metricSel.totalCount }} · {{ metricSel.progress }}%</b></div>
          <div><span>目标</span><b>{{ fmtText(metricSel.metric.target) }}</b></div>
          <div><span>验收</span><b>{{ fmtText(metricSel.metric.acceptance) }}</b></div>
        </div>
        <div class="crd-stats">
          <div v-for="s in summaryStats" :key="s.label" class="crd-stat">
            <b>{{ s.value }}</b><span>{{ s.label }}</span>
          </div>
        </div>
        <section class="crd-section">
          <h3>挂载任务 <span>{{ metricSel.tasks.length }}</span></h3>
          <div v-if="metricSel.tasks.length" class="crd-task-list">
            <article v-for="T in metricSel.tasks" :key="T.task.id" class="crd-task">
              <span class="crd-dot" :class="'st-' + T.status"></span>
              <div class="crd-task-main">
                <b>{{ T.task.title || '未命名任务' }}</b>
                <small>{{ stLabel[T.status] || T.status }}<template v-if="T.task.dueDate"> · 截止 {{ T.task.dueDate }}</template></small>
              </div>
              <span v-if="T.task.priority" class="crd-chip">{{ priLabel[T.task.priority] || T.task.priority }}优</span>
            </article>
          </div>
          <p v-else class="crd-empty">这个成功指标下还没有任务。</p>
        </section>
      </template>

      <template v-else-if="taskSel">
        <div class="crd-info">
          <div><span>状态</span><b>{{ stLabel[taskSel.status] || taskSel.status }}</b></div>
          <div><span>优先级</span><b>{{ taskSel.task.priority ? (priLabel[taskSel.task.priority] || taskSel.task.priority) + '优' : '—' }}</b></div>
          <div><span>截止日期</span><b>{{ fmtText(taskSel.task.dueDate) }}</b></div>
          <div><span>完成日期</span><b>{{ fmtTs(taskSel.task.completedAt) }}</b></div>
        </div>
        <div class="crd-location">
          <span>所属位置</span>
          <b v-if="taskLocation">{{ taskLocation.goal }} / {{ taskLocation.project }} / {{ taskLocation.metric }}</b>
          <b v-else class="warn">未归档 · 尚未挂载成功指标</b>
        </div>
        <div v-if="taskLink" class="crd-link">
          <span>任务链接</span>
          <a :href="taskLink" target="_blank" rel="noopener noreferrer">{{ taskSel.task.link }}</a>
        </div>
        <p class="crd-note">任务详情为只读镜像；状态、归属和字段修改请回到方向台。</p>
      </template>

      <template v-else-if="sel.kind === 'orphans'">
        <p class="crd-lead">这些任务还没有挂载成功指标。回到方向台挂上指标后，它们会进入对应项目与目标。</p>
        <section class="crd-section">
          <h3>未归档明细 <span>{{ tree.orphans.length }}</span></h3>
          <div v-if="tree.orphans.length" class="crd-task-list">
            <article v-for="T in tree.orphans" :key="T.task.id" class="crd-task">
              <span class="crd-dot" :class="'st-' + T.status"></span>
              <div class="crd-task-main">
                <b>{{ T.task.title || '未命名任务' }}</b>
                <small>{{ stLabel[T.status] || T.status }}<template v-if="T.task.dueDate"> · 截止 {{ T.task.dueDate }}</template><template v-if="T.task.priority"> · {{ priLabel[T.task.priority] || T.task.priority }}优</template></small>
              </div>
            </article>
          </div>
          <p v-else class="crd-empty">当前没有未归档任务。</p>
        </section>
      </template>
    </div>

    <template #footer>
      <button class="crd-edit" type="button" @click="emit('edit')">
        <Icon name="compass" :size="13"/> 去方向台编辑 ›
      </button>
    </template>
  </Drawer>
</template>

<style scoped>
.crd-kind { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--accent-ink); background: var(--accent-light); border-radius: 999px; padding: 1px 10px; white-space: nowrap; }
.crd-body { display: flex; flex-direction: column; gap: 14px; }
.crd-lead { margin: 0; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-2); color: var(--text); font-size: var(--fs-body); line-height: 1.65; overflow-wrap: anywhere; }
.crd-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.crd-stat { min-width: 0; padding: 9px 6px; text-align: center; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
.crd-stat b { display: block; color: var(--text); font-size: var(--fs-title); line-height: 1.2; overflow-wrap: anywhere; }
.crd-stat span, .crd-stat small { display: block; color: var(--text-3); font-size: var(--fs-micro); margin-top: 3px; }
.crd-section { display: flex; flex-direction: column; gap: 8px; }
.crd-section h3 { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--text); font-size: var(--fs-body); }
.crd-section h3 span { color: var(--text-3); font-size: var(--fs-caption); font-weight: 500; }
.crd-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.crd-section-head span { color: var(--text-3); font-size: var(--fs-caption); white-space: nowrap; }
.crd-group { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
.crd-group-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-bottom: 7px; border-bottom: 1px solid var(--border); }
.crd-group-head b { color: var(--text); font-size: var(--fs-body); overflow-wrap: anywhere; }
.crd-group-head span { flex: none; max-width: 52%; color: var(--text-3); font-size: var(--fs-caption); text-align: right; }
.crd-tree-line { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--border); }
.crd-tree-line:last-child { border-bottom: 0; }
.crd-tree-line span { color: var(--text-2); font-size: var(--fs-sub); overflow-wrap: anywhere; }
.crd-tree-line small { flex: none; max-width: 48%; color: var(--text-3); font-size: var(--fs-caption); text-align: right; }
.crd-info { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.crd-info > div { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 10px; padding: 8px 11px; border-bottom: 1px solid var(--border); }
.crd-info > div:last-child { border-bottom: 0; }
.crd-info span { color: var(--text-3); font-size: var(--fs-caption); }
.crd-info b { color: var(--text); font-size: var(--fs-sub); font-weight: 500; line-height: 1.55; overflow-wrap: anywhere; white-space: pre-wrap; }
.crd-info b.warn { color: var(--warning); }
.crd-info.compact { margin-bottom: 2px; }
.crd-task-list { display: flex; flex-direction: column; gap: 6px; }
.crd-task { display: flex; align-items: flex-start; gap: 9px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
.crd-task-main { flex: 1; min-width: 0; }
.crd-task-main b { display: block; color: var(--text); font-size: var(--fs-sub); font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
.crd-task-main small { display: block; margin-top: 2px; color: var(--text-3); font-size: var(--fs-caption); overflow-wrap: anywhere; }
.crd-dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--text-4); }
.crd-dot.st-done { background: var(--success); }
.crd-dot.st-doing { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.crd-dot.st-stale { background: var(--warning); }
.crd-chip { flex: none; padding: 1px 6px; border-radius: 999px; background: var(--surface-3); color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.crd-location, .crd-link { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-2); }
.crd-location span, .crd-link span { color: var(--text-3); font-size: var(--fs-caption); }
.crd-location b { color: var(--text); font-size: var(--fs-sub); line-height: 1.55; overflow-wrap: anywhere; }
.crd-location b.warn { color: var(--warning); }
.crd-link a { color: var(--accent-ink); font-size: var(--fs-sub); text-underline-offset: 2px; overflow-wrap: anywhere; }
.crd-note { margin: 0; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.6; }
.crd-empty { margin: 0; color: var(--text-3); font-size: var(--fs-caption); }
.crd-edit { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: var(--radius-sm); padding: 8px 0; font-size: var(--fs-body); font-weight: 700; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-family: inherit; }
.crd-edit:hover { filter: brightness(1.08); }
@media (max-width: 620px) {
  .crd-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .crd-group-head, .crd-tree-line { flex-direction: column; gap: 3px; }
  .crd-group-head span, .crd-tree-line small { max-width: none; text-align: left; }
}
</style>
