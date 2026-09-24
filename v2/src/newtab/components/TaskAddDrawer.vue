<script setup lang="ts">
import { ref, computed, watch, shallowRef } from 'vue'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import Drawer from '@/shared/components/Drawer.vue'
import { showToast } from '@/shared/components/toast'
import type { TaskCard, Metric } from '@/shared/models'
// R138-C1′：一句话智能录入（宿主全懒路由，可直连 AI 栈）
import AiSuggestionDrawer from './AiSuggestionDrawer.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import type { AiJob } from '@/shared/ai/job'
import { aiConfig, loadAiConfig, aiReady } from '@/shared/ai/config'
import { buildTaskParseJob, type SelectCtx } from '@/shared/ai/select'
import type { TaskDraft } from '@/shared/ai/scenarios'

/** 第卅三轮 REQ-016：成功指标添加任务双模式（新建 / 关联）
 *  ① 新建：右侧创建抽屉 + Ctrl+Enter 保存（自动写入 metricId + metric.taskIds）
 *  ② 关联：关键词过滤多选抽屉 + Ctrl+Enter 确认（既有任务转移归属到本指标）
 *  三处入口复用：CompassTree / ProjectCuration / ProjectDetailDrawer
 */
const props = defineProps<{
  open: boolean
  metricId: string
  projectId: string
  metricTitle?: string
}>()
const emit = defineEmits<{ close: []; created: [task: TaskCard] }>()

const store = useAppStore()
const { d, allProjects } = useCompass()

const tab = ref<'create' | 'link'>('create')

// ---- 新建模式 ----
const newTitle = ref('')
const newPriority = ref<'high' | 'medium' | 'low'>('medium')
const prioList = [
  { v: 'high' as const, l: '🔴 高优' },
  { v: 'medium' as const, l: '🟡 中优' },
  { v: 'low' as const, l: '🟢 低优' }
]

// R138-C1′：一句话智能录入——AI 只回填表单态（含草稿扩展字段 due/时长/归属），建卡仍由用户确认
const aiSay = ref('')
const aiDraft = ref<Partial<TaskDraft>>({})
const aiJob = shallowRef<AiJob | null>(null)
const aiBusy = ref(false)
async function aiParse() {
  if (aiBusy.value || !aiSay.value.trim()) return
  aiBusy.value = true
  try {
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    const ctx: SelectCtx = { d: d.value, depth: aiConfig.value.depth, persist: () => store.persist() }
    const job = buildTaskParseJob(aiSay.value, ctx, (draft) => {
      if (draft.title) newTitle.value = draft.title
      if (draft.priority === 'high' || draft.priority === 'medium' || draft.priority === 'low') newPriority.value = draft.priority
      aiDraft.value = { dueDate: draft.dueDate, estimatedMinutes: draft.estimatedMinutes, projectId: draft.projectId, metricId: draft.metricId }
      const extra = [draft.dueDate && `截止 ${draft.dueDate}`, draft.estimatedMinutes && `约${draft.estimatedMinutes}分钟`].filter(Boolean).join(' · ')
      return '✓ 已回填表单' + (extra ? `（${extra}）` : '') + '，核对后点「创建」'
    })
    if (job) aiJob.value = job
  } finally { aiBusy.value = false }
}

// ---- 关联模式 ----
const linkQ = ref('')
// R113-N6：按项目筛选（与调度台「从任务库选取」保持同款形态）
// 取值：'' = 全部项目；'__none__' = 未关联项目；其余 = project.id
const linkProject = ref('')
const selected = ref<Set<string>>(new Set())

function reset() {
  tab.value = 'create'
  newTitle.value = ''
  newPriority.value = 'medium'
  aiSay.value = ''; aiDraft.value = {}
  linkQ.value = ''
  linkProject.value = '' // R113-N6：打开时复位为「全部项目」
  selected.value = new Set()
}
watch(() => props.open, (v) => { if (v) reset() })

function findMetric(id?: string): Metric | undefined {
  if (!id) return undefined
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === id)
      if (m) return m
    }
  }
  return undefined
}

/** 新建任务：创建 TaskCard 并挂到指标（taskIds 去重）
 *  REQ-034：加 submitting 锁——双 keydown 绑定移除后，防御任何路径的重复触发 */
let creating = false
function createTask() {
  if (creating) return
  const title = newTitle.value.trim()
  if (!title) { showToast('请输入任务标题'); return }
  creating = true
  try {
    const task: TaskCard = {
      id: uid('tk'), kind: 'task', title, status: 'todo', priority: newPriority.value,
      // R138-C1′：AI 草稿扩展字段——dueDate/时长直接落卡；归属仅当抽屉未锁定时采纳（props 锁定时不动）
      projectId: props.projectId || aiDraft.value.projectId, metricId: props.metricId || aiDraft.value.metricId,
      dueDate: aiDraft.value.dueDate, estimatedMinutes: aiDraft.value.estimatedMinutes,
      mountedCuriosityIds: [], customFields: {},
      createdAt: Date.now(), updatedAt: Date.now()
    }
    d.value.tasks.unshift(task)
    const m = findMetric(task.metricId)
    if (m && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)
    store.persist()
    showToast('✓ 任务已创建并计入指标进度')
    emit('created', task)
    emit('close')
  } finally {
    creating = false
  }
}

/** R113-N6：任务的有效项目 id —— projectId 优先；缺失时由 metricId 反查所在项目（与 projectNameOf 同口径） */
function effectiveProjectId(t: TaskCard): string {
  if (t.projectId) return t.projectId
  if (t.metricId) {
    for (const dir of d.value.compass.directions) {
      const p = dir.projects.find(x => x.metrics.some(m => m.id === t.metricId))
      if (p) return p.id
    }
  }
  return ''
}

/** 关联候选：未删除且未挂在本指标的任务（含孤儿 / 他指标任务，选中即转移归属） */
const candidates = computed(() => {
  const q = linkQ.value.trim().toLowerCase()
  const pj = linkProject.value
  return d.value.tasks
    .filter(t => !t.deletedAt && t.metricId !== props.metricId && (!q || t.title.toLowerCase().includes(q)))
    // R113-N6：项目维度过滤（与关键词可叠加）
    .filter(t => !pj || (pj === '__none__' ? !effectiveProjectId(t) : effectiveProjectId(t) === pj))
    .slice(0, 40)
})

/** R113-N6：项目下拉选项（只列"有可关联任务"的项目，带任务数；另给未关联计数） */
const linkProjectOptions = computed(() => {
  const counts = new Map<string, number>()
  let none = 0
  for (const t of d.value.tasks) {
    if (t.deletedAt || t.metricId === props.metricId) continue
    const pid = effectiveProjectId(t)
    if (pid) counts.set(pid, (counts.get(pid) || 0) + 1)
    else none++
  }
  const opts = allProjects().filter(p => counts.has(p.id)).map(p => ({ id: p.id, name: p.name, n: counts.get(p.id) || 0 }))
  return { opts, none }
})

/** R47-B1：任务归属反查——项目名（projectId 优先，否则由 metricId 反查），缺失显示「未关联项目」 */
function projectNameOf(t: TaskCard): string {
  if (t.projectId) {
    for (const dir of d.value.compass.directions) {
      const p = dir.projects.find(x => x.id === t.projectId)
      if (p) return p.name
    }
  }
  if (t.metricId) {
    for (const dir of d.value.compass.directions) {
      const p = dir.projects.find(x => x.metrics.some(m => m.id === t.metricId))
      if (p) return p.name
    }
  }
  return '未关联项目'
}

function metricNameOf(metricId?: string): string {
  if (!metricId) return '未关联指标'
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return m.title
    }
  }
  return '已删除指标'
}

function toggleSel(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

/** 关联：选中的任务转移归属到本指标（从所有旧指标 taskIds 移除，防止多归属）
 *  REQ-034：linkTasks 同步加提交锁 */
let linking = false
function linkTasks() {
  if (linking) return
  if (!selected.value.size) { showToast('请先勾选要关联的任务'); return }
  linking = true
  try {
    const ids = [...selected.value]
    for (const dir of d.value.compass.directions) {
      for (const proj of dir.projects) {
        for (const m of proj.metrics) {
          if (m.id !== props.metricId) m.taskIds = m.taskIds.filter(id => !ids.includes(id))
        }
      }
    }
    for (const id of ids) {
      const t = d.value.tasks.find(x => x.id === id)
      if (t) { t.metricId = props.metricId; t.projectId = props.projectId; t.updatedAt = Date.now() }
      const m = findMetric()
      if (m && !m.taskIds.includes(id)) m.taskIds.push(id)
    }
    store.persist()
    showToast(`✓ 已关联 ${ids.length} 个任务，计入指标进度`)
    emit('close')
  } finally {
    linking = false
  }
}
</script>

<template>
  <Drawer :open="open" :title="metricTitle ? `🎯 ${metricTitle} · 添加任务` : '🎯 添加任务'" width="480px" @close="emit('close')">
    <div class="tad-tabs">
      <button class="tad-tab" :class="{on: tab === 'create'}" @click="tab = 'create'">🆕 新建任务</button>
      <button class="tad-tab" :class="{on: tab === 'link'}" @click="tab = 'link'">🔗 关联已有任务</button>
    </div>

    <!-- 新建模式 -->
    <div v-if="tab === 'create'" class="tad-body">
      <!-- R138-C1′：一句话智能录入（AI 回填草稿 → 用户核对创建） -->
      <label class="tad-label">🪄 一句话录入（可选）</label>
      <div class="tad-ai-row">
        <input v-model="aiSay" class="tad-input" placeholder="例：下周三前做完论文图表，挂毕业项目，大约两小时" @keydown.enter.prevent="aiParse" />
        <button class="tad-btn" :disabled="!aiSay.trim() || aiBusy" @click="aiParse"><AiEntryButton variant="inline" label="AI 填表" :spin="aiBusy" /></button>
      </div>

      <label class="tad-label">任务标题</label>
      <input v-model="newTitle" class="tad-input" placeholder="输入任务标题，Ctrl+Enter 保存"
        @keydown.ctrl.enter.prevent="createTask" @keydown.meta.enter.prevent="createTask" />

      <label class="tad-label">优先级</label>
      <div class="tad-prios">
        <button v-for="p in prioList" :key="p.v" class="tad-prio" :class="{on: newPriority === p.v}" @click="newPriority = p.v">
          {{ p.l }}
        </button>
      </div>

      <div class="tad-foot">
        <span class="tad-hint">💾 Ctrl+Enter 保存并关闭</span>
        <button class="tad-btn primary" @click="createTask">创建并计入指标</button>
      </div>
    </div>

    <!-- 关联模式 -->
    <div v-else class="tad-body">
      <!-- R113-N6：关键词 + 项目 两维筛选可叠加 -->
      <div class="tad-filters">
        <input v-model="linkQ" class="tad-input" placeholder="搜索任务标题…（已关联到本指标的不展示）"
          @keydown.ctrl.enter.prevent="linkTasks" @keydown.meta.enter.prevent="linkTasks" />
        <select v-model="linkProject" class="tad-proj" title="按项目筛选">
          <option value="">全部项目</option>
          <option value="__none__">未关联项目（{{ linkProjectOptions.none }}）</option>
          <option v-for="o in linkProjectOptions.opts" :key="o.id" :value="o.id">{{ o.name }}（{{ o.n }}）</option>
        </select>
      </div>
      <div class="tad-list">
        <label v-for="t in candidates" :key="t.id" class="tad-item" :class="{on: selected.has(t.id)}">
          <input type="checkbox" :checked="selected.has(t.id)" @change="toggleSel(t.id)" />
          <span class="tad-item-title">{{ t.title }}</span>
          <span class="tad-item-meta">{{ projectNameOf(t) }} · {{ metricNameOf(t.metricId) }}</span>
        </label>
        <div v-if="!candidates.length" class="tad-empty">
          {{ linkQ.trim() ? '没有匹配的任务' : '暂无可关联任务（其他任务均已在指标下）' }}
        </div>
      </div>
      <div class="tad-foot">
        <span class="tad-hint">已选 {{ selected.size }} 项 · 关联即转移归属 · Ctrl+Enter 确认</span>
        <button class="tad-btn primary" :disabled="!selected.size" @click="linkTasks">关联 {{ selected.size }} 个任务</button>
      </div>
    </div>
  </Drawer>
  <!-- R138-C1′：AI 草稿评审抽屉（采纳=回填本表单，不直接建卡） -->
  <AiSuggestionDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
.tad-tabs { display: flex; gap: 6px; background: var(--surface-2); padding: 4px; border-radius: 10px; margin-bottom: 16px; }
.tad-tab { flex: 1; padding: 8px 0; border: none; background: transparent; color: var(--text-3); font-size: var(--fs-body); font-weight: 600; border-radius: 8px; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.tad-tab.on { background: var(--surface); color: var(--accent); box-shadow: var(--shadow-sm); }

.tad-body { display: flex; flex-direction: column; gap: 10px; }
.tad-label { font-size: var(--fs-sub); font-weight: 600; color: var(--text-3); letter-spacing: .4px; margin-top: 4px; }
.tad-input { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; font-size: var(--fs-body); outline: none; font-family: inherit; background: var(--surface); color: var(--text); box-sizing: border-box; }
.tad-input:focus { border-color: var(--accent); }
/* R113-N6：关联模式的筛选行（关键词 + 项目下拉） */
.tad-filters { display: flex; gap: 8px; align-items: center; }
.tad-filters .tad-input { flex: 1; min-width: 0; }
.tad-proj { flex-shrink: 0; max-width: 180px; border: 1px solid var(--border); border-radius: 8px; padding: 9px 8px; font-size: var(--fs-sub); outline: none; font-family: inherit; background: var(--surface); color: var(--text-2); cursor: pointer; }
.tad-proj:hover { border-color: var(--accent); }
.tad-proj:focus { border-color: var(--accent); color: var(--text); }

.tad-prios { display: flex; gap: 6px; }
/* R138-C1′：一句话录入行 */
.tad-ai-row { display: flex; gap: 8px; align-items: center; }
.tad-ai-row .tad-input { flex: 1; min-width: 0; }
.tad-prio { flex: 1; padding: 8px 0; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 8px; cursor: pointer; font-size: var(--fs-sub); font-family: inherit; transition: all var(--dur); }
.tad-prio.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent); font-weight: 600; }

.tad-list { display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; margin-top: 4px; }
.tad-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; font-size: var(--fs-body); transition: all var(--dur); background: var(--surface); }
.tad-item:hover { border-color: var(--accent); }
.tad-item.on { border-color: var(--accent); background: var(--accent-light); }
.tad-item input { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
.tad-item-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.tad-item-meta { font-size: var(--fs-caption); color: var(--text-3); background: var(--surface-2); padding: 2px 8px; border-radius: 99px; flex-shrink: 0; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tad-empty { text-align: center; color: var(--text-3); font-size: var(--fs-sub); padding: 26px 0; }

.tad-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
.tad-hint { font-size: var(--fs-caption); color: var(--text-3); }
.tad-btn { display: inline-flex; align-items: center; gap: 5px; border: none; border-radius: 8px; padding: 9px 16px; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; background: var(--surface-2); color: var(--text-2); transition: all var(--dur); }
.tad-btn.primary { background: var(--accent); color: #fff; }
.tad-btn.primary:hover { filter: brightness(1.08); }
.tad-btn.primary:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
</style>
