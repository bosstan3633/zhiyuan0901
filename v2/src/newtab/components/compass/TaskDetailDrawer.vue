<script setup lang="ts">
// 第卌五轮 T-03：任务详情抽屉共享组件（自 CompassActions.vue 抽离）
// 宿主：TaskManagerPanel（任务管理 Tab）+ CompassActions（今日三件事双击详情）
// 用法：ref 后调用 open(task)；关闭/删除/保存逻辑全部内聚
import Icon from '@/shared/components/Icon.vue'
import { ref, computed, onMounted, onUnmounted, shallowRef, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useTaHeight } from '@/shared/utils/taHeight'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import type { AppData, TaskCard, Subtask, SupportLink, ResourceCard, AssetMeta } from '@/shared/models'
import type { AiDepth } from '@/shared/ai/config'
import { recordCardOpen } from '@/shared/storage/stats'
import { buildSupportIndex, listBySub, listByTask, addSupportLink, removeSupportLink } from '@/shared/utils/supportLinks'
// R152 口径：评审抽屉用模块作用域单例，不在 setup 里现造（此处原为 defineAsyncComponent 自建一份）
import { AiDrawer } from '../lazyAiDrawer'
import { showToast } from '@/shared/components/toast'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'
import AiTouchedChip from '@/shared/components/AiTouchedChip.vue'
import SubtaskList from '@/shared/components/SubtaskList.vue'
import { taskMaturity } from '@/shared/utils/maturity'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'

const router = useRouter()
const store = useAppStore()
const { d, allProjects } = useCompass()

const emit = defineEmits<{ (e: 'closed'): void }>()

const sidebarOpen = ref(false)
// B7：抽屉宽度记忆（UIPrefs.drawerWs.task，360~680px）
const drawerW = ref(store.ui?.drawerWs?.task || 440)
function startDrawerResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startW = drawerW.value
  const move = (ev: MouseEvent) => {
    drawerW.value = Math.min(680, Math.max(360, startW + (startX - ev.clientX)))
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    if (!store.ui) return
    store.ui.drawerWs = { ...(store.ui.drawerWs || {}), task: Math.round(drawerW.value) }
    saveUIPrefs({ drawerWs: store.ui.drawerWs })
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
const selectedTask = ref<TaskCard | null>(null)
const taskTitleDraft = ref('')
/** 第卅三轮 REQ-024：任务备注文本框高度（默认 180px，拖拽记忆） */
const { taH: taskNoteH, startTaResize: startTaskNoteResize } = useTaHeight('task-note', store.ui)
const selProjectId = ref('')
const selMetricId = ref('')

function open(task: TaskCard, opts?: { focusSub?: boolean }) {
  // R43-0 BUG-1 修复：selectedTask 必须指向 store 内的 reactive Proxy 元素
  selectedTask.value = d.value.tasks.find(x => x.id === task.id) || task
  taskTitleDraft.value = selectedTask.value.title
  selProjectId.value = selectedTask.value.projectId || ''
  selMetricId.value = selectedTask.value.metricId || ''
  sidebarOpen.value = true
  // ★P4-D5：「＋ 拆分」直达 —— 抽屉开后把光标落进子任务输入框（能力与双击一致，少两步）
  if (opts?.focusSub) void nextTick(() => subListRef.value?.focusAdd())
}
function close() { sidebarOpen.value = false; selectedTask.value = null; emit('closed') }
defineExpose({ open, close })
const subListRef = ref<InstanceType<typeof SubtaskList> | null>(null)

/** B22：状态统一出口（completedAt 卫生清理） */
function setTaskStatusOf(t: TaskCard, status: 'todo' | 'doing' | 'done') {
  t.status = status
  t.completedAt = status === 'done' ? Date.now() : undefined
  t.updatedAt = Date.now()
  store.persist()
}
function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  setTaskStatusOf(t, t.status === 'done' ? 'todo' : 'done')
}
/** 第卅二轮 REQ-006：任务详情面板时间戳可见 */
function fmtTaskTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
/** B22：抽屉内状态三选 chips */
function setTaskStatus(t: TaskCard, status: 'todo' | 'doing' | 'done') {
  if (t.status === status) return
  setTaskStatusOf(t, status)
  showToast('状态已切换为「' + (status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始') + '」')
}
// ---- R166 定案 6：任务详情三枚 AI 入口（补全 / 拆解 / 找资源支持）----
// 三态与互斥：一把 `aiBusy` 锁（同时只跑一个，点了没反应会一直等是最难查的"卡"）；
// 凭据共用 `aiTouchedAt`（三处写库都盖戳），所以 chip 走"最近 · 时间"的共享措辞、不硬猜是哪一枚动的。
// ★ 三个工厂全部**点击时才 dynamic import**，AI 栈零静态引用（启动链零 AI 红线 + R134 入口 chunk 教训）。
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const aiPersonaId = ref('default')
const aiBusy = ref(false)
type AiEntryKind = 'enrich' | 'breakdown' | 'support'

/** 三入口共用的起法：读配置 → 就绪校验 → 带默认执笔专家 → 造 job。返回 null 表示已提示过、不必再开弹窗 */
async function prepareAi(): Promise<{ d: AppData; depth: AiDepth } | null> {
  const [{ loadAiConfig, aiReady, aiConfig }] = await Promise.all([import('@/shared/ai/config')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return null }
  if (!d.value) return null
  // R141（反馈 #2）：未手动换过人时，带入设置页的默认执笔专家
  if (aiPersonaId.value === 'default' && aiConfig.value.defaultPersona) aiPersonaId.value = aiConfig.value.defaultPersona
  return { d: d.value, depth: aiConfig.value.depth }
}

async function runAi(kind: AiEntryKind, subId?: string) {
  const t = selectedTask.value
  if (!t || aiBusy.value) return
  aiBusy.value = true
  try {
    const ctx = await prepareAi()
    if (!ctx) return
    const self = () => void runAi(kind, subId)
    if (kind === 'breakdown') {
      const { buildChainJob } = await import('@/shared/ai/chain')
      const job = buildChainJob('breakdown', t.id, {
        d: ctx.d, depth: ctx.depth, persist: () => store.persist(),
        personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; self() },
      })
      if (!job) { showToast('任务已不存在'); return }
      aiJob.value = job
      return
    }
    if (kind === 'enrich') {
      const { buildTaskEnrichJob } = await import('@/shared/ai/taskEnrich')
      aiJob.value = buildTaskEnrichJob(t, {
        d: ctx.d, depth: ctx.depth, persist: () => store.persist(),
        personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; self() },
      })
      return
    }
    const { buildTaskSupportJob } = await import('@/shared/ai/taskSupport')
    const job = buildTaskSupportJob({
      d: ctx.d, depth: ctx.depth, persist: () => store.persist(), taskId: t.id, ...(subId ? { subId } : {}),
      personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; self() },
    })
    if (!job) { showToast('任务已不存在'); return }
    aiJob.value = job
  } finally { aiBusy.value = false }
}
const aiEnrich = () => runAi('enrich')
const aiBreakdown = () => runAi('breakdown')
const aiSupport = (subId?: string) => runAi('support', subId)
/* 采纳后不需要额外同步：`open()` 把 selectedTask 指到 store 里的 reactive 卡本体，
   AI 的 apply 写的就是同一个代理对象 ⇒ 弹窗一关，清单/支持区/头部胶囊已经变了。 */
/** R165-A：链接动作贴对象（打开走全站统一协议白名单；复制进剪贴板） */
function openTaskLink() {
  const t = selectedTask.value
  if (!t) return
  const url = toOpenableRawLink(t.link || '')
  if (!url) { showToast('链接为空或协议不支持直达'); return }
  openExternalLink(url)
}
function copyTaskLink() {
  const t = selectedTask.value
  if (!t || !t.link) { showToast('链接为空'); return }
  navigator.clipboard?.writeText(t.link).then(() => showToast('链接已复制')).catch(() => {})
}
/* R166 定案 1：子任务是**本卡内嵌字段**，不再反查别的卡——
   原 R144 的 parentTask / childTasks / promoteSubtask（父指针双向查表）随 parentId 退役。 */
const subtasks = computed(() => selectedTask.value?.subtasks || [])
const subtaskDone = computed(() => subtasks.value.filter(s => s.done).length)
/** 清单改动即写回本卡（随卡 persist；清单行不是卡，没有回收站也没有撤销） */
function onSubtasksUpdate(v: Subtask[]) {
  const t = selectedTask.value
  if (!t) return
  t.subtasks = v
  touchTask()
}
/* R166 定案 5：资源支持住在独立关联表——反查索引一次建、O(1) 查，不在渲染路径里 filter 全表 */
const supportIdx = computed(() => buildSupportIndex(d.value))
const supportFocusId = ref('')
const supportDraft = ref('')
function supCountOf(subId: string): number { return listBySub(supportIdx.value, subId).length }
function openSupport(s: Subtask) { supportFocusId.value = s.id; void runAi('support', s.id) }
/** 本任务（含其子任务）的关联行；资源查不到的一律不显（软删过滤已在索引里做过） */
const supportRows = computed(() => {
  const t = selectedTask.value
  if (!t) return [] as { link: SupportLink; resource: ResourceCard }[]
  return listByTask(supportIdx.value, t.id)
    .map(link => ({ link, resource: d.value.resources.find(r => r.id === link.resourceId && !r.deletedAt) }))
    .filter((x): x is { link: SupportLink; resource: ResourceCard } => !!x.resource)
})
/** 手动关联的候选：按标题子串取前 8 条（本地即得，不为一个输入框去叫模型） */
const supportDraftCands = computed(() => {
  const q = supportDraft.value.trim().toLowerCase()
  if (!q) return [] as ResourceCard[]
  return (d.value.resources || []).filter(r => !r.deletedAt && r.title.toLowerCase().includes(q)).slice(0, 8)
})
/** 点行=打开资源链接并计热度（与双击卡片同一条通道，不另立口径） */
function openSupportResource(r: ResourceCard) {
  recordCardOpen(d.value, r)
  store.persistHot()
  const url = toOpenableRawLink(r.link)
  if (!url) { showToast('这张资源还没有可打开的链接'); return }
  openExternalLink(url)
}
function unlinkSupport(id: string) {
  if (!removeSupportLink(d.value, id)) return
  store.persist()
  showToast('已解除关联（两张卡本体都没动）')
}
function addSupportManual() {
  const t = selectedTask.value
  const q = supportDraft.value.trim()
  if (!t || !q) return
  const r = (d.value.resources || []).find(x => !x.deletedAt && x.title === q) || supportDraftCands.value[0]
  if (!r) { showToast('没找到同名资源'); return }
  const out = addSupportLink(d.value, { taskId: t.id, resourceId: r.id, from: 'manual' })
  if (out.dup) { showToast('这张卡已经挂在支持里了'); return }
  supportDraft.value = ''
  store.persist()
  showToast(`已关联「${r.title.slice(0, 12)}」`)
}
async function deleteTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  // R141：统一软删语义——置 deletedAt 同时摘净 metric.taskIds 引用（撤销时回填）
  const kids = subtasks.value.length
  softDeleteTaskToTrash(d.value, t)
  store.persist()
  close()
  // REQ-030：撤销（含指标 taskIds 回填，按 id 定位当前树）；R166 定案 1：子任务是本卡内嵌字段，随卡一起进回收站
  showToast(`已删除「${t.title.slice(0, 20)}」${kids ? ` · 含 ${kids} 个子任务`: ''}`, { label: '撤销', cb: () => {
    const cur = d.value.tasks.find(x => x.id === taskId)
    if (cur && cur.deletedAt) {
      cur.deletedAt = undefined
      if (cur.metricId) {
        for (const dir of d.value.compass.directions) for (const proj of dir.projects) for (const m of proj.metrics)
          if (m.id === cur.metricId && !m.taskIds.includes(cur.id)) m.taskIds.push(cur.id)
      }
    }
    store.persist()
  } })
}
/** 链接/备注就地保存 */
function touchTask() {
  if (!selectedTask.value) return
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
/** REQ-048：任务附件变更即时持久化 */
function onTaskAssetsChange(v: AssetMeta[]) {
  if (!selectedTask.value) return
  selectedTask.value.assets = v
  touchTask()
}
/** 第卌二轮 REQ-061：任务卡 HTML/PDF 上传联动——标题取文件名（仅空标题/旧文件名时覆盖） */
function onTaskHtmlAdded(meta: AssetMeta, replacedOld: AssetMeta | null) {
  if (!selectedTask.value) return
  const stem = (meta.name || '').replace(/\.(html?|pdf)$/i, '')
  const oldStems = [replacedOld, ...(selectedTask.value.assets || []).filter(a => a.kind === meta.kind && a.id !== meta.id)]
    .filter((a): a is AssetMeta => !!a)
    .map(a => (a.name || '').replace(/\.(html?|pdf)$/i, ''))
  const cur = (selectedTask.value.title || '').trim()
  if (!cur || oldStems.includes(cur)) {
    if (stem) { selectedTask.value.title = stem; taskTitleDraft.value = stem }
  } else {
    showToast(`已替换原 ${meta.kind === 'pdf' ? 'PDF' : 'HTML'}；标题保留手打内容，可自行编辑`)
  }
  touchTask()
}
function saveTaskTitle() {
  if (!selectedTask.value) return
  const val = taskTitleDraft.value.trim()
  if (!val) { showToast('标题不能为空'); return }
  // R43-0 BUG-1 兜底：优先对 store 内 Proxy 元素写入（响应式）
  const inStore = d.value.tasks.find(x => x.id === selectedTask.value!.id)
  const t = inStore || selectedTask.value
  t.title = val
  t.updatedAt = Date.now()
  selectedTask.value = t
  store.persist()
  showToast('已保存')
}
function saveTaskTitleAndClose() {
  saveTaskTitle()
  close()
}

// B1：级联选择项目 → 指标
const sidebarProjects = computed(() => allProjects())
const sidebarMetrics = computed(() =>
  sidebarProjects.value.find(p => p.id === selProjectId.value)?.metrics || []
)
function syncMetricTaskIds(taskId: string, oldMetricId?: string, newMetricId?: string) {
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const m of proj.metrics) {
        if (oldMetricId && m.id === oldMetricId) m.taskIds = m.taskIds.filter(x => x !== taskId)
        if (newMetricId && m.id === newMetricId && !m.taskIds.includes(taskId)) m.taskIds.push(taskId)
      }
    }
  }
}
function onSelProjectChange() {
  selMetricId.value = ''
  if (!selectedTask.value) return
  const oldMetric = selectedTask.value.metricId
  selectedTask.value.projectId = selProjectId.value || undefined
  selectedTask.value.metricId = undefined
  syncMetricTaskIds(selectedTask.value.id, oldMetric, undefined)
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
function onSelMetricChange() {
  if (!selectedTask.value) return
  const oldMetric = selectedTask.value.metricId
  selectedTask.value.metricId = selMetricId.value || undefined
  syncMetricTaskIds(selectedTask.value.id, oldMetric, selectedTask.value.metricId)
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
// R48 详情重设计：头部状态下拉（替代 body 内三枚大 chip）
const statusMenuOpen = ref(false)
const STATUS_UI: Record<'todo' | 'doing' | 'done', { label: string; cls: string }> = {
  todo: { label: '○ 待开始', cls: 'st-todo' },
  doing: { label: '◐ 进行中', cls: 'st-doing' },
  done: { label: '已完成', cls: 'st-done' }
}
function pickStatus(status: 'todo' | 'doing' | 'done') {
  statusMenuOpen.value = false
  if (selectedTask.value) setTaskStatus(selectedTask.value, status)
}
/** R48：优先级下拉直选（替代点击循环切换） */
function setPriority(p: 'low' | 'medium' | 'high') {
  if (!selectedTask.value) return
  selectedTask.value.priority = p
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}

// B23：抽屉快捷键挂文档级（焦点在 TagPicker 浮层等 Teleport 内容内也能生效）
/**
 * R166 定案 7「Esc 分层关闭」：AI 评审弹窗开着时，Esc 只关弹窗，**不许顺手把底下的详情抽屉也关掉**。
 * ⚠ 为什么在宿主挡而不是靠 Modal：`Modal.vue` 的 Esc 是 document 捕获阶段 + `stopPropagation`，
 *   而 `stopPropagation` 只能挡住**别的节点**的监听，挡不住**同一节点（document）上更早注册**的监听——
 *   抽屉比弹窗先注册，于是一次 Esc 两层同关（Modal.vue 注释里"一次 Esc 只关一层"的说法在两层都挂
 *   document 的场景下不成立）。弹窗是后开的、在更上层，所以由下层主动让位。
 */
function onSidebarDocKey(e: KeyboardEvent) {
  if (!sidebarOpen.value) return
  if (aiJob.value) return /* 上层弹窗在场：键盘归它（Ctrl+↩ 也不该穿下去保存抽屉） */
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveTaskTitleAndClose() }
  else if (e.key === 'Escape') { e.preventDefault(); close() }
}
onMounted(() => { document.addEventListener('keydown', onSidebarDocKey, true) })
onUnmounted(() => { document.removeEventListener('keydown', onSidebarDocKey, true) })
</script>

<template>
  <!-- ===== 任务详情抽屉（B1 级联 + B2 Ctrl+Enter） ===== -->
  <Transition name="fade">
    <div v-if="sidebarOpen" class="overlay" @click="close" />
  </Transition>
  <Transition name="slide">
    <div v-if="sidebarOpen && selectedTask" class="task-sidebar" :style="{ width: drawerW + 'px' }" @keydown.ctrl.enter.prevent="saveTaskTitleAndClose" @keydown.meta.enter.prevent="saveTaskTitleAndClose">
      <div class="ts-resize" @mousedown="startDrawerResize" />
      <div class="ts-head">
        <!-- R166 定案 6：头部三行。① 勾选+标题+关闭 ② **AI 三入口独立一行**（等宽三格，不挤标题行）
             ③ 状态/成熟度/子任务进度/AI 凭据。三入口都改的是这张卡，放一行里彼此并列、也说得清各管什么。 -->
        <div class="ts-head-row">
          <div class="check-lg" :class="{done: selectedTask.status==='done'}" @click="toggleTask(selectedTask.id)" title="切换完成状态"><Icon v-if="selectedTask.status==='done'" name="check" :size="16"/></div>
          <textarea v-model="taskTitleDraft" class="ts-title" rows="2" placeholder="任务标题..."
            @blur="saveTaskTitle" />
          <div class="ts-close" @click="close">×</div>
        </div>
        <div class="ts-ai-row">
          <button class="ts-ai-cell" :disabled="aiBusy" title="AI 对照本卡现状找缺项（验收标准 / 标签 / 归属 / 估时），已填的不覆盖；弹窗左右对照逐条采纳" @click="aiEnrich">
            <AiEntryButton variant="inline" label="补全" :spin="aiBusy" />
          </button>
          <button class="ts-ai-cell" :disabled="aiBusy" title="AI 拆解本任务：采纳为子任务清单，或只把步骤写进详情（双通道）；可换执笔专家" @click="aiBreakdown">
            <AiEntryButton variant="inline" label="拆解步骤" :spin="aiBusy" />
          </button>
          <button class="ts-ai-cell" :disabled="aiBusy" title="AI 围绕本任务盘点资源卡池，推荐能支持它的资源（勾选采纳才建关联，两张卡本体都不改）" @click="aiSupport()">
            <AiEntryButton variant="inline" label="找资源支持" :spin="aiBusy" />
          </button>
        </div>
        <div class="ts-head-row2">
          <!-- R48 详情重设计：状态下拉 chip（色彩只做语义信号） -->
          <div class="ds-status-wrap" @click.stop>
            <button class="ds-status-chip2" :class="STATUS_UI[selectedTask.status].cls" @click.stop="statusMenuOpen = !statusMenuOpen">{{ STATUS_UI[selectedTask.status].label }}</button>
            <div v-if="statusMenuOpen" class="ds-status-menu">
              <div v-for="(ui, key) in STATUS_UI" :key="key" class="mi" :class="{on: selectedTask.status === key}" @click.stop="pickStatus(key as 'todo'|'doing'|'done')">{{ ui.label }}</div>
            </div>
          </div>
          <AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" />
          <!-- R166 定案 1：子任务进度胶囊（内嵌清单的 done/all，零子任务零噪音）——
               原 R144 的「↳ 父名 ⤴ / N 子任务」父子软层级随 parentId 退役 -->
          <span v-if="subtasks.length" class="ts-rel-chip" :title="`子任务 ${subtaskDone}/${subtasks.length} 已完成（不进成熟度与周报计分）`"><Icon name="corner" :size="13"/> 子任务 {{ subtaskDone }}/{{ subtasks.length }}</span>
          <!-- R142（反馈 #4）：成熟度大徽标——规则引擎即时分，hover 展开扣分构成 -->
          <MaturityBadge lg :m="taskMaturity(selectedTask)" title="成熟度=可执行/可归属/新鲜度（规则引擎即时评）" />
          <!-- 三入口共用一个 aiTouchedAt ⇒ verb 传空，chip 说"最近"而不硬猜是哪一枚动的 -->
          <AiTouchedChip :ts="selectedTask.aiTouchedAt" verb="" />
        </div>
      </div>
      <div class="ts-body">
        <!-- R48：说明区上移为 Hero（此前被四个大下拉挤到最底部） -->
        <div class="ts-section">
          <div class="ds-hero-label">说明 <span class="hint">— 补充上下文 · 验收标准</span></div>
          <div class="ta-wrap">
            <textarea v-model="selectedTask.description" class="ds-desc" :style="{ height: taskNoteH + 'px' }" placeholder="补充说明、上下文、验收标准…" @blur="touchTask"></textarea>
            <div class="ta-resize" @mousedown="startTaskNoteResize" title="拖拽调节高度（记忆保存）"></div>
          </div>
        </div>
        <!-- R166 F1/F2：子任务清单紧跟说明——它是本卡内容，不是独立卡，不进看板/指标/周报 -->
        <div class="ts-section">
          <div class="ds-hero-label"><Icon name="corner" :size="13"/> 子任务清单 <span class="hint">— 本卡内容 · 不是独立任务卡 · 完成不进计分</span></div>
          <SubtaskList ref="subListRef" :subtasks="subtasks" :sup-count="supCountOf" @update="onSubtasksUpdate" @sup="openSupport" />
        </div>
        <!-- R166 定案 5/F4：资源支持区——行=资源标题+AI 判词，点行打开链接并计热度，× 只删关联记录。
             两张卡本体互不持有 id（关联住在 AppData.supportLinks 独立表），「卡间零挂载」红线不破。 -->
        <div class="ts-section">
          <div class="ds-hero-label"><Icon name="compass" :size="13"/> 资源支持 <span class="hint">— 点行打开链接 · 解绑只删记录，不动两张卡</span></div>
          <div v-if="supportRows.length" class="ts-sup">
            <div v-for="row in supportRows" :key="row.link.id" class="ts-sup-row" :title="row.link.why || '点击打开资源链接'">
              <span class="ts-sup-nm" @click="openSupportResource(row.resource)">{{ row.resource.title.slice(0, 40) }}</span>
              <span v-if="row.link.why" class="ts-sup-why">{{ row.link.why }}</span>
              <span v-if="row.link.from === 'ai'" class="ts-sup-tag">AI</span>
              <span class="ts-sup-x" title="解除关联（只删这条记录；资源卡与任务卡都不动）" @click.stop="unlinkSupport(row.link.id)">×</span>
            </div>
          </div>
          <div v-else class="ts-sup-empty">还没有关联的资源——点上方「找资源支持」让 AI 从资源台里挑，或在下面手动挂。</div>
          <div class="ts-sup-add">
            <input v-model="supportDraft" list="ts-sup-cands" placeholder="手动关联：搜资源标题回车即挂上（不走 AI，标记为手动）" @keydown.enter.prevent="addSupportManual">
            <datalist id="ts-sup-cands">
              <option v-for="r in supportDraftCands" :key="r.id" :value="r.title" />
            </datalist>
            <button class="ts-sup-btn" :disabled="!supportDraft.trim()" @click="addSupportManual">挂上</button>
          </div>
        </div>
        <!-- R48：属性紧凑化——项目/指标双列一行，优先级/链接紧随 -->
        <div class="ts-section ds-props2">
          <div class="ds-prop-field">
            <label class="ds-prop-label"><Icon name="package" :size="13"/> 项目</label>
            <select v-model="selProjectId" class="ds-prop-select" @change="onSelProjectChange">
              <option value="">未关联项目</option>
              <option v-for="p in sidebarProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="ds-prop-field">
            <label class="ds-prop-label"><Icon name="target" :size="13"/> 指标</label>
            <select v-model="selMetricId" class="ds-prop-select" :disabled="!selProjectId" @change="onSelMetricChange">
              <option value="">暂不归属</option>
              <option v-for="m in sidebarMetrics" :key="m.id" :value="m.id">{{ m.title }}</option>
            </select>
          </div>
        </div>
        <!-- R165-A：优先级 3 段 segment（单击直达，语义色 tint）；链接升整行 + 动作贴边 -->
        <div class="ts-section">
          <div class="ds-prop-label"><Icon name="zap" :size="13"/> 优先级</div>
          <div class="ts-prio">
            <button v-for="p in (['high','medium','low'] as const)" :key="p" :data-p="p" :class="{ on: selectedTask.priority === p }"
              @click="setPriority(p)"><Icon name="dot" :size="9" :class="p === 'high' ? 'zy-dot-hi' : p === 'medium' ? 'zy-dot-mi' : 'zy-dot-lo'"/>{{ p === 'high' ? '高' : p === 'medium' ? '中' : '低' }}</button>
          </div>
        </div>
        <div class="ts-section">
          <div class="ds-prop-label"><Icon name="link" :size="13"/> 链接 <span class="hint hint-normal">— 双击卡片直达</span></div>
          <div class="ts-link-row">
            <input v-model="selectedTask.link" class="ts-link-input" placeholder="https://… / D:\path\file.pdf / obsidian://…" @blur="touchTask" @keydown.enter.prevent="($event.target as HTMLElement).blur()">
            <button class="ts-link-btn" title="打开链接" @click="openTaskLink"><Icon name="external" :size="13"/></button>
            <button class="ts-link-btn" title="复制链接" @click="copyTaskLink">⧉</button>
          </div>
        </div>
        <!-- R48：标签一行 -->
        <div class="ts-section">
          <TagPicker v-model="selectedTask.tags" />
        </div>
        <div class="ts-section ds-meta">
          <span>创建 {{ fmtTaskTs(selectedTask.createdAt) }}</span>
          <span>更新 {{ fmtTaskTs(selectedTask.updatedAt) }}</span>
          <span class="ts-goto ds-goto-inline" @click="router.push('/compass')"><Icon name="compass" :size="13"/> 没有合适的项目/指标？去方向台创建 ›</span>
        </div>
        <!-- R48：附属区折叠（附件）；R165：挂载区随卡间挂载退役 -->
        <details class="ds-details ds-details-sep">
          <summary><Icon name="paperclip" :size="13"/> 附件 <span v-if="selectedTask.assets?.length" class="cnt">({{ selectedTask.assets.length }})</span><AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" /><span class="right">图片 / HTML / PDF</span></summary>
          <AssetManager v-model="selectedTask.assets" :owner-id="selectedTask.id" @update:model-value="onTaskAssetsChange" @html-added="onTaskHtmlAdded" />
        </details>
      </div>
      <!-- R165-A：页脚收敛两钮——删除（二次确认）+ 完成并关闭；AI 拆解已升标题行 -->
      <div class="ts-foot">
        <ArmDeleteButton @confirm="deleteTask(selectedTask.id)" />
        <button class="mini-btn primary" @click="saveTaskTitleAndClose"><Icon name="check" :size="13"/> 完成并关闭 <span class="ts-kbd">Ctrl+<Icon name="arrowleft" :size="13"/></span></button>
      </div>
    </div>
  </Transition>
  <!-- R135-C2′：拆解建议评审抽屉（步骤子任务+行动方案，勾选采纳才落库；置于 Transition 外保单子节点约束） -->
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
/* B1-c（V3.8.26）：链接提示与附件折叠区两处内联样式收口 */
.hint.hint-normal { font-weight: 400; }
.ds-details.ds-details-sep { margin-top: 14px; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

.fade-enter-active, .fade-leave-active { transition: opacity var(--dur-slow); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform .2s var(--ease-emphasis); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

/* 任务抽屉 */
.task-sidebar { position: fixed; top: 0; right: 0; width: 440px; max-width: 94vw; height: 100%; background: var(--surface); border-left: 1px solid var(--border); z-index: calc(var(--z-overlay) + 1); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: var(--z-overlay); }
.ts-resize { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 3; }
.ts-resize:hover { background: var(--accent); opacity: .4; }
.ts-head { padding: 16px 20px 12px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
/* R165-A（方案 A 标准）：两行头部 */
.ts-head-row { display: flex; align-items: flex-start; gap: 10px; }
.ts-head-row2 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* R166 定案 6：AI 三入口独立一行，等宽三格（丙版：不挤标题行，三件事并列说得清） */
.ts-ai-row { display: flex; gap: 8px; }
.ts-ai-cell {
  flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 7px 8px; border-radius: 9px; cursor: pointer;
  font-size: var(--fs-sub); font-weight: 600; border: 1px solid var(--accent); color: var(--accent-ink); background: var(--accent-light);
  font-family: inherit; transition: all var(--dur); white-space: nowrap; overflow: hidden;
}
.ts-ai-cell:hover { background: var(--accent); color: #fff; box-shadow: 0 0 0 3px var(--accent-glow); --ai-mark-fill: #fff; --ai-mark-eye: var(--accent); }
.ts-ai-cell:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; box-shadow: none; }
/* R166 F4：资源支持区（点行打开、× 解绑只删记录） */
.ts-sup { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); overflow: hidden; }
.ts-sup-row { display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.ts-sup-row:last-child { border-bottom: 0; }
.ts-sup-nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); cursor: pointer; }
.ts-sup-nm:hover { color: var(--accent); text-decoration: underline; }
.ts-sup-why { font-size: var(--fs-tiny); color: var(--text-4); max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ts-sup-tag { font-size: var(--fs-micro); color: var(--accent); border: 1px solid var(--accent); border-radius: 99px; padding: 0 5px; }
.ts-sup-x { color: var(--text-3); cursor: pointer; padding: 0 2px; }
.ts-sup-x:hover { color: var(--danger); }
.ts-sup-empty { font-size: var(--fs-caption); color: var(--text-3); padding: 8px 2px; }
.ts-sup-add { display: flex; gap: 6px; margin-top: 8px; }
.ts-sup-add input { flex: 1; min-width: 0; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-size: var(--fs-sub); font-family: inherit; outline: none; }
.ts-sup-add input:focus { border-color: var(--accent); }
.ts-sup-btn { padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-2); font-size: var(--fs-sub); font-family: inherit; cursor: pointer; }
.ts-sup-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.ts-sup-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.check-lg { width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; font-size: var(--fs-body); color: #fff; background: var(--surface); }
.check-lg.done { background: var(--success); border-color: var(--success); }
.ts-title { flex: 1; font-size: 16px; font-weight: 600; color: var(--text); border: none; outline: none; background: transparent; font-family: inherit; line-height: 1.5; resize: none; min-height: 44px; }
/* R144：父子软层级徽标（子 ↳ 父名 + ⤴ 升顶层；父显子任务数） */
.ts-rel-chip { flex-shrink: 0; align-self: center; display: inline-flex; align-items: center; gap: 4px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-caption); color: var(--text-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; }
.ts-rel-chip.sub { color: var(--text-2); border-style: dashed; }
.ts-close { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; color: var(--text-3); font-size: 18px; flex-shrink: 0; }
.ts-close:hover { background: var(--surface-3); color: var(--text); }
.ts-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.ts-section { margin-bottom: 16px; }
.ts-goto { margin-top: 7px; font-size: var(--fs-caption); color: var(--accent); cursor: pointer; }
.ts-goto:hover { text-decoration: underline; }
/* 第卅三轮 REQ-024：文本框拖拽手柄（高度经 UIPrefs.taHeights 记忆） */
.ta-wrap { position: relative; }
.ta-resize { position: absolute; right: 3px; bottom: 3px; width: 16px; height: 12px; cursor: ns-resize; z-index: 2; opacity: .45; border-right: 3px solid var(--text-3); border-bottom: 3px solid var(--text-3); border-bottom-right-radius: 3px; }
.ta-resize:hover { opacity: .9; }
/* R165-A：优先级 3 段 segment（语义色 tint，对比度过 4.5） */
.ts-prio { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-top: 4px; }
.ts-prio button { padding: 7px 16px; font-size: var(--fs-sub); background: var(--surface-2); border: 0; color: var(--text-3); cursor: pointer; transition: all var(--dur); font-family: inherit; display: inline-flex; align-items: center; gap: 5px; }
/* G1（V3.8.25）：优先级彩点原本是 🔴🟡🟢 裸 emoji，迁移后只剩文字。点色由 .zy-dot-* 工具类给，
   未选中态也保留彩点（优先级语义不随选中态消失）；选中态由 button.on 的文字色与底色承担。 */
.ts-prio button .zy-dot { opacity: .85; }
.ts-prio button + button { border-left: 1px solid var(--border); }
.ts-prio button.on { font-weight: 600; }
.ts-prio button.on[data-p="high"] { color: var(--danger); background: color-mix(in srgb, var(--danger) 16%, var(--surface-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 55%, transparent); }
.ts-prio button.on[data-p="medium"] { color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, var(--surface-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 55%, transparent); }
.ts-prio button.on[data-p="low"] { color: var(--success); background: color-mix(in srgb, var(--success) 16%, var(--surface-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 55%, transparent); }
/* R165-A：链接整行 + 动作贴边 */
.ts-link-row { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
.ts-link-input { flex: 1; min-width: 0; padding: 8px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; font-size: var(--fs-body); color: var(--text); font-family: inherit; outline: none; }
.ts-link-input:focus { border-color: var(--accent); }
.ts-link-btn { width: 32px; height: 32px; flex-shrink: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); cursor: pointer; font-size: var(--fs-body); transition: all var(--dur); }
.ts-link-btn:hover { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.ts-foot { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: center; }
.ts-foot .mini-btn { justify-content: center; padding: 9px 16px; flex: 1; }
.ts-foot .mini-btn.primary { flex: 2; }
.ts-kbd { font-size: var(--fs-tiny); background: rgba(255,255,255,.22); border-radius: 4px; padding: 1px 5px; font-weight: 400; margin-left: 2px; }

/* ===== R48 详情重设计 ===== */
.ds-status-chip2.st-todo { background: var(--tag-neutral-bg, var(--surface-3)); color: var(--text-2); }
.ds-status-chip2.st-doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.ds-status-chip2.st-done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.ds-goto-inline { color: var(--accent); cursor: pointer; }
.ds-goto-inline:hover { text-decoration: underline; }
.ds-prop-select { margin-top: 1px; }
</style>
