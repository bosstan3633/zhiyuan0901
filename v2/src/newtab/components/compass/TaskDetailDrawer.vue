<script setup lang="ts">
// 第卌五轮 T-03：任务详情抽屉共享组件（自 CompassActions.vue 抽离）
// 宿主：TaskManagerPanel（任务管理 Tab）+ CompassActions（今日三件事双击详情）
// 用法：ref 后调用 open(task)；关闭/删除/保存逻辑全部内聚
import Icon from '@/shared/components/Icon.vue'
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import Drawer from '@/shared/components/Drawer.vue'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import type { AppData, TaskCard, SupportLink, ResourceCard, AssetMeta } from '@/shared/models'
import type { AiDepth } from '@/shared/ai/config'
import { recordCardOpen } from '@/shared/storage/stats'
import { buildSupportIndex, listByTask, addSupportLink, removeSupportLink } from '@/shared/utils/supportLinks'
import CardResourcePickerModal from './CardResourcePickerModal.vue'
// R152 口径：评审抽屉用模块作用域单例，不在 setup 里现造（此处原为 defineAsyncComponent 自建一份）
import { AiDrawer } from '../lazyAiDrawer'
import { showToast } from '@/shared/components/toast'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'
import AiTouchedChip from '@/shared/components/AiTouchedChip.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { isTaskDone, setTaskStatusById, sortedTaskStatuses, taskStatusOf, toggleTaskDone } from '@/shared/utils/taskStatus'
import { planEventsOf, scheduleCardDate } from '@/shared/storage/planSchedule'
import { buildFocusUsage, focusUsageOfCard } from '@/shared/analytics/focusUsage'
import { hasUsableResourceLink } from '@/shared/analytics/cardInventory'
import PlanScheduleHistory from './PlanScheduleHistory.vue'
import CardFocusHistory from './CardFocusHistory.vue'

const router = useRouter()
const store = useAppStore()
const { d, allProjects } = useCompass()

const emit = defineEmits<{ (e: 'closed'): void }>()

const sidebarOpen = ref(false)
const selectedTask = ref<TaskCard | null>(null)
const taskTitleDraft = ref('')
const selProjectId = ref('')
const selMetricId = ref('')
type DetailFocus = 'all' | 'plan' | 'focus' | 'owner' | 'resources'
const detailFocus = ref<DetailFocus>('all')

function open(task: TaskCard) {
  // R43-0 BUG-1 修复：selectedTask 必须指向 store 内的 reactive Proxy 元素
  selectedTask.value = d.value.tasks.find(x => x.id === task.id) || task
  taskTitleDraft.value = selectedTask.value.title
  selProjectId.value = selectedTask.value.projectId || ''
  selMetricId.value = selectedTask.value.metricId || ''
  detailFocus.value = 'all'
  sidebarOpen.value = true
}
function close() { sidebarOpen.value = false; selectedTask.value = null; emit('closed') }
defineExpose({ open, close })

const taskStatuses = computed(() => sortedTaskStatuses(d.value))
const currentTaskStatus = computed(() => selectedTask.value ? taskStatusOf(d.value, selectedTask.value) : undefined)

/** B22：状态统一出口（completedAt 卫生清理） */
function setTaskStatusOf(t: TaskCard, statusId: string) {
  if (!setTaskStatusById(d.value, t, statusId)) return
  store.persist()
}
function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  toggleTaskDone(d.value, t)
  store.persist()
}
/** 第卅二轮 REQ-006：任务详情面板时间戳可见 */
function fmtTaskTs(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}
/** B22：抽屉内状态菜单（自定义状态列表） */
function setTaskStatus(t: TaskCard, statusId: string) {
  if (t.statusId === statusId) return
  const status = taskStatuses.value.find(row => row.id === statusId)
  if (!status) return
  setTaskStatusOf(t, statusId)
  showToast('状态已切换为「' + status.name + '」')
}
// V4.4.0：任务详情以「AI 找资源」为主入口，AI 补全降为说明区的次级工具；
// AI 拆解、子任务、优先级、估时与导出退出任务详情，历史数据结构仅做兼容读取。
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const aiPersonaId = ref('default')
const aiBusy = ref(false)
type AiEntryKind = 'enrich' | 'support'

/** AI 入口共用的起法：读配置 → 就绪校验 → 带默认执笔专家 → 造 job。返回 null 表示已提示过、不必再开弹窗 */
async function prepareAi(): Promise<{ d: AppData; depth: AiDepth } | null> {
  const [{ loadAiConfig, aiReady, aiConfig }] = await Promise.all([import('@/shared/ai/config')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return null }
  if (!d.value) return null
  // R141（反馈 #2）：未手动换过人时，带入设置页的默认执笔专家
  if (aiPersonaId.value === 'default' && aiConfig.value.defaultPersona) aiPersonaId.value = aiConfig.value.defaultPersona
  return { d: d.value, depth: aiConfig.value.depth }
}

async function runAi(kind: AiEntryKind) {
  const t = selectedTask.value
  if (!t || aiBusy.value) return
  aiBusy.value = true
  try {
    const ctx = await prepareAi()
    if (!ctx) return
    const self = () => void runAi(kind)
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
      d: ctx.d, depth: ctx.depth, persist: () => store.persist(), taskId: t.id,
      personaId: aiPersonaId.value, onPersona: (id) => { aiPersonaId.value = id; self() },
    })
    if (!job) { showToast('任务已不存在'); return }
    aiJob.value = job
  } finally { aiBusy.value = false }
}
const aiEnrich = () => runAi('enrich')
const aiSupport = () => runAi('support')
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
/* R166 定案 5：资源支持住在独立关联表——反查索引一次建、O(1) 查，不在渲染路径里 filter 全表 */
const supportIdx = computed(() => buildSupportIndex(d.value))
const resourcePickerOpen = ref(false)
const focusUsage = computed(() => {
  if (!selectedTask.value) return { count: 0, doneCount: 0, lastDate: '' }
  return focusUsageOfCard(buildFocusUsage(d.value), 'task', selectedTask.value.id)
})
const planChanges = computed(() =>
  selectedTask.value ? planEventsOf(d.value, selectedTask.value.id, 'task').length : 0)
/** 本任务的关联行；资源查不到的一律不显（软删过滤已在索引里做过） */
const supportRows = computed(() => {
  const t = selectedTask.value
  if (!t) return [] as { link: SupportLink; resource: ResourceCard }[]
  const resourceById = new Map(
    (d.value.resources || [])
      .filter(resource => !resource.deletedAt)
      .map(resource => [resource.id, resource] as const),
  )
  return listByTask(supportIdx.value, t.id)
    .map(link => ({ link, resource: resourceById.get(link.resourceId) || link.snapshot || null }))
    .filter((x): x is { link: SupportLink; resource: ResourceCard } => !!x.resource)
})
const effectiveResourceIds = computed(() =>
  new Set((d.value.resources || [])
    .filter(resource => !resource.deletedAt && hasUsableResourceLink(resource))
    .map(resource => resource.id)))
const effectiveSupportCount = computed(() =>
  new Set(supportRows.value
    .filter(row => effectiveResourceIds.value.has(row.link.resourceId))
    .map(row => row.link.resourceId)).size)
/** 点行=打开资源链接并计热度（与双击卡片同一条通道，不另立口径） */
function openSupportResource(r: ResourceCard) {
  if (d.value.resources.some(card => card.id === r.id && !card.deletedAt)) {
    recordCardOpen(d.value, r)
    store.persistHot()
  }
  const url = toOpenableRawLink(r.link)
  if (!url) { showToast('这张资源还没有可打开的链接'); return }
  openExternalLink(url)
}
function unlinkSupport(id: string) {
  if (!removeSupportLink(d.value, id)) return
  store.persist()
  showToast('已解除关联（两张卡本体都没动）')
}
function mountResources(resources: ResourceCard[]) {
  const t = selectedTask.value
  if (!t || !resources.length) return
  let added = 0
  for (const resource of resources) {
    const out = addSupportLink(d.value, { taskId: t.id, resourceId: resource.id, from: 'manual' })
    if (!out.dup) added += 1
  }
  resourcePickerOpen.value = false
  if (!added) { showToast('所选资源都已经关联过了'); return }
  store.persist()
  showToast(`已挂载 ${added} 张资源卡`)
}
async function deleteTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  // R141：统一软删语义——置 deletedAt 同时摘净 metric.taskIds 引用（撤销时回填）
  softDeleteTaskToTrash(d.value, t)
  store.persist()
  close()
  // REQ-030：撤销（含指标 taskIds 回填，按 id 定位当前树）。
  showToast(`已删除「${t.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
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

function updatePlannedDate(value: string): void {
  if (!selectedTask.value) return
  scheduleCardDate(d.value, selectedTask.value, value, { source: 'detail' })
  store.persist()
  showToast(value ? `计划执行日期已设为 ${value}` : '已取消排期，任务回到卡片池')
}

async function addToTodayFocus(): Promise<void> {
  const task = selectedTask.value
  if (!task || task.deletedAt) return
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const { addManualFocus } = await import('@/shared/utils/focusSuggest')
  const result = addManualFocus(d.value, key, task.id)
  if (result.status === 'exists') {
    store.persist()
    showToast('这张任务已经在今天的三件事里')
    return
  }
  if (result.status === 'full') {
    showToast('今日三件事已满；请到调度台三件事卡片中替换一格')
    return
  }
  if (result.status === 'added') {
    store.persist()
    showToast('已设为今日重点，并锁定为手动选择')
  }
}

/** V3.9.31（F1）：一键看所属项目的全景 —— 深链 /compass?pano=1&proj&m&task；
 *  方向台 watch 到查询后复用 onListLocate 既有链路（切全景 → 定位本任务 → 闪烁），不另造定位。
 *  未挂项目时按钮置灰不可点。 */
function gotoProjectPano() {
  const t = selectedTask.value
  const pid = selProjectId.value
  if (!t || !pid) return
  router.push({
    path: '/compass',
    query: { pano: '1', proj: pid, ...(t.metricId ? { m: t.metricId } : {}), task: t.id },
  })
}
// R48 详情重设计：头部状态下拉（替代 body 内三枚大 chip）
const statusMenuOpen = ref(false)
function pickStatus(statusId: string) {
  statusMenuOpen.value = false
  if (selectedTask.value) setTaskStatus(selectedTask.value, statusId)
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
}
onMounted(() => { document.addEventListener('keydown', onSidebarDocKey, true) })
onUnmounted(() => { document.removeEventListener('keydown', onSidebarDocKey, true) })
</script>

<template>
  <!-- ===== 任务详情：共享 Drawer 唯一壳（遮罩 / 动画 / Esc / 拖宽统一） ===== -->
  <Drawer :open="sidebarOpen && !!selectedTask" width="520px" width-storage-key="task" :close-on-escape="!aiJob" @close="close">
    <template v-if="selectedTask" #title>
        <div class="ts-title-wrap">
          <div class="ts-title-row">
            <div class="check-lg" v-pressable :class="{done: isTaskDone(d, selectedTask)}" @click="toggleTask(selectedTask.id)" title="切换完成状态"><Icon v-if="isTaskDone(d, selectedTask)" name="check" :size="16"/></div>
            <textarea v-model="taskTitleDraft" class="ts-title" rows="3" placeholder="写下一条完整、可执行的任务…" @blur="saveTaskTitle" />
          </div>
          <div class="ts-head-row2">
            <div class="ds-status-wrap" data-a11y-container @click.stop>
              <button class="ds-status-chip2" :style="{ '--task-status': currentTaskStatus?.color || 'var(--text-3)' }" @click.stop="statusMenuOpen = !statusMenuOpen">
                <span class="ds-status-dot" />{{ currentTaskStatus?.name || '待开始' }}
              </button>
              <div v-if="statusMenuOpen" class="ds-status-menu" data-a11y-container>
                <div v-for="status in taskStatuses" :key="status.id" class="mi" v-pressable :class="{on: currentTaskStatus?.id === status.id}" @click.stop="pickStatus(status.id)">
                  <span class="ds-status-dot" :style="{ '--task-status': status.color }" />{{ status.name }}
                </div>
              </div>
            </div>
            <AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" />
            <AiTouchedChip :ts="selectedTask.aiTouchedAt" verb="" />
          </div>
        </div>
    </template>
    <template v-if="selectedTask">
      <div class="ts-body">
        <div class="ts-drawer-summary" aria-label="任务详情汇总">
          <button type="button" data-detail-filter="plan" :class="{ on: detailFocus === 'plan' }" @click="detailFocus = detailFocus === 'plan' ? 'all' : 'plan'">
            <strong>{{ planChanges }}</strong><span>计划变更</span>
          </button>
          <button type="button" data-detail-filter="focus" :class="{ on: detailFocus === 'focus' }" @click="detailFocus = detailFocus === 'focus' ? 'all' : 'focus'">
            <strong>{{ focusUsage.count }}</strong><span>进入三件事</span>
          </button>
          <button type="button" data-detail-filter="resources" :class="{ on: detailFocus === 'resources' }" @click="detailFocus = detailFocus === 'resources' ? 'all' : 'resources'">
            <strong>{{ effectiveSupportCount }}</strong><span>有效资源</span>
          </button>
          <button type="button" data-detail-filter="owner" :class="{ on: detailFocus === 'owner' }" @click="detailFocus = detailFocus === 'owner' ? 'all' : 'owner'">
            <strong>{{ selProjectId || selMetricId ? '已归属' : '未归属' }}</strong><span>项目 / 指标</span>
          </button>
        </div>
        <div v-if="detailFocus !== 'all'" class="ts-detail-filter">
          <span>当前只展开对应明细</span>
          <button type="button" @click="detailFocus = 'all'">显示全部</button>
        </div>

        <!-- V4.7.1：安排历程是任务的首屏主信息——先回答“这张卡被安排到哪天、改过几次”，
             再进入项目/指标与资源上下文；设为今日重点降为模块内次级动作。 -->
        <section v-show="detailFocus === 'all' || detailFocus === 'plan'" class="ts-section ts-plan-hero">
          <PlanScheduleHistory :card-id="selectedTask.id" card-kind="task" :current-date="selectedTask.dueDate" />
          <div class="ts-plan-edit">
            <label class="ts-plan-field">
              <span><Icon name="calendar" :size="12" /> 调整计划</span>
              <input type="date" :value="selectedTask.dueDate || ''" @change="updatePlannedDate(($event.target as HTMLInputElement).value)">
            </label>
            <button v-if="selectedTask.dueDate" class="ts-plan-clear" type="button" @click="updatePlannedDate('')">
              <Icon name="x" :size="12" /> 取消排期
            </button>
            <button class="ts-focus-link" type="button" @click="addToTodayFocus">
              <Icon name="target" :size="12" /> 设为今日重点
            </button>
          </div>
          <p class="ts-plan-note">没有“截止日期”字段；留空即未落图，拖入今日日历会同步进入今日三件事。</p>
        </section>

        <section v-show="detailFocus === 'all' || detailFocus === 'focus'" class="ts-section ts-focus-section">
          <CardFocusHistory :card-id="selectedTask.id" card-kind="task" />
        </section>

        <!-- 归属是任务的首屏上下文：项目 / 指标紧跟标题与状态读数，压缩为两枚轻量字段。 -->
        <div v-show="detailFocus === 'all' || detailFocus === 'owner'" class="ts-section ts-owner ds-props2">
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
        <!-- V3.9.31（F1）：归属字段的行尾出口 —— 挂了项目就能一键进全景看全部指标与任务 -->
        <button v-show="detailFocus === 'all' || detailFocus === 'owner'" class="ts-goto ds-goto-pano" type="button" :disabled="!selProjectId"
          :title="selProjectId ? '进入方向台项目全景：看该项目的全部指标与任务' : '先选择所属项目，再看它的全景'"
          @click="gotoProjectPano">
          <Icon name="compass" :size="13"/> 查看项目全景（全部指标与任务）›
        </button>
        <!-- R166 定案 5/F4：资源支持区——行=资源标题+AI 判词，点行打开链接并计热度，× 只删关联记录。
             两张卡本体互不持有 id（关联住在 AppData.supportLinks 独立表），「卡间零挂载」红线不破。 -->
        <div v-show="detailFocus === 'all' || detailFocus === 'resources'" class="ts-section ts-resource-section">
          <div class="ds-hero-label ts-resource-head">
            <span class="ts-resource-title"><Icon name="compass" :size="14"/> 资源镜像 <span class="hint">— 为任务找到可复用的资源</span></span>
            <div class="ts-resource-actions">
              <button class="ts-pick-resource" type="button" @click="resourcePickerOpen = true">
                <Icon name="plus" :size="12" /> 从资源卡池挂载
              </button>
              <button class="ts-ai-primary" :disabled="aiBusy" title="AI 从资源卡池中寻找能支持本任务的资源（勾选采纳后才建立关联）" @click="aiSupport()">
                <AiEntryButton variant="inline" label="AI 找资源" :spin="aiBusy" />
              </button>
            </div>
          </div>
          <div v-if="supportRows.length" class="ts-sup">
            <div v-for="row in supportRows" :key="row.link.id" class="ts-sup-row" :title="row.link.why || '点击打开资源链接'">
              <span class="ts-sup-nm" v-pressable @click="openSupportResource(row.resource)">{{ row.resource.title.slice(0, 40) }}</span>
              <span class="ts-sup-tag">镜像</span>
              <span v-if="row.link.why" class="ts-sup-why">{{ row.link.why }}</span>
              <span v-if="row.link.from === 'ai'" class="ts-sup-tag">AI</span>
              <span class="ts-sup-x" v-pressable title="解除关联（只删这条记录；资源卡与任务卡都不动）" @click.stop="unlinkSupport(row.link.id)">×</span>
            </div>
          </div>
          <div v-else class="ts-sup-empty">还没有关联资源。从资源卡池多选挂载，或让 AI 先筛一轮候选。</div>
        </div>
        <!-- V4.4.0：说明降为次要上下文，放在资源镜像之后，限制为 3 行小框。 -->
        <div class="ts-section ts-note-section">
          <div class="ds-hero-label ts-note-head">
            <span>说明 <span class="hint">— 可选上下文</span></span>
            <button type="button" class="ts-ai-inline" :disabled="aiBusy" title="AI 对照本卡现状补全缺项，已填内容不覆盖" @click="aiEnrich">
              <AiEntryButton variant="inline" label="AI 补全" :spin="aiBusy" />
            </button>
          </div>
          <div class="ta-wrap">
            <textarea v-model="selectedTask.description" class="ds-desc ts-note-compact" rows="3" placeholder="补充关键约束或执行提示…" @blur="touchTask"></textarea>
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
          <span class="ts-goto ds-goto-inline" v-pressable @click="router.push('/compass')"><Icon name="compass" :size="13"/> 没有合适的项目/指标？去方向台创建 ›</span>
        </div>
        <!-- R48：附属区折叠（附件）；R165：挂载区随卡间挂载退役 -->
        <details class="ds-details ds-details-sep">
          <summary><Icon name="paperclip" :size="13"/> 附件 <span v-if="selectedTask.assets?.length" class="cnt">({{ selectedTask.assets.length }})</span><AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" /><span class="right">图片 / HTML / PDF</span></summary>
          <AssetManager v-model="selectedTask.assets" :owner-id="selectedTask.id" @update:model-value="onTaskAssetsChange" @html-added="onTaskHtmlAdded" />
        </details>
      </div>
    </template>
    <template v-if="selectedTask" #footer>
        <div class="ts-foot">
        <ArmDeleteButton @confirm="deleteTask(selectedTask.id)" />
        <button class="mini-btn primary" @click="saveTaskTitleAndClose"><Icon name="check" :size="13"/> 完成并关闭 <span class="ts-kbd">Ctrl+<Icon name="arrowleft" :size="13"/></span></button>
        </div>
    </template>
  </Drawer>
  <CardResourcePickerModal
    :open="resourcePickerOpen"
    :resources="d.resources || []"
    :linked-ids="supportRows.map(row => row.resource.id)"
    title="为任务挂载资源卡"
    @close="resourcePickerOpen = false"
    @confirm="mountResources"
  />
  <!-- V4.4.0：任务 AI 评审抽屉只承载资源匹配与任务补全；拆解与子任务能力已退役。 -->
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
/* B1-c（V3.8.26）：链接提示与附件折叠区两处内联样式收口 */
.hint.hint-normal { font-weight: 400; }
.ds-details.ds-details-sep { margin-top: 14px; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: var(--danger); color: var(--on-accent); border-color: var(--danger); }

.ts-drawer-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-bottom: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--border);
}

.ts-drawer-summary button {
  min-width: 0;
  min-height: 54px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 1px;
  padding: 7px 9px;
  border: 0;
  background: var(--surface-2);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ts-drawer-summary button:hover {
  background: color-mix(in srgb, var(--accent-light) 32%, var(--surface));
}

.ts-drawer-summary button.on {
  background: var(--accent-light);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.ts-drawer-summary button:focus-visible,
.ts-detail-filter button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.ts-drawer-summary strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-sub);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-drawer-summary span {
  color: var(--text-3);
  font-size: var(--fs-micro);
  white-space: nowrap;
}

.ts-detail-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: -2px 0 10px;
  color: var(--text-4);
  font-size: var(--fs-micro);
}

.ts-detail-filter button {
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--accent-ink);
  font: inherit;
  font-size: var(--fs-micro);
  font-weight: 650;
  cursor: pointer;
}

.ts-detail-filter button:hover { text-decoration: underline; }

.ts-focus-section {
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-2) 68%, var(--surface));
}

.ts-plan-hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
  border-radius: var(--radius-lg);
  background:
    radial-gradient(420px 130px at 0% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 72%),
    var(--surface-2);
}

.ts-plan-edit {
  display: flex;
  align-items: flex-end;
  gap: 7px;
  flex-wrap: wrap;
  padding-top: 9px;
  border-top: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
}

.ts-plan-field {
  display: flex;
  min-width: 0;
  flex: 1 1 170px;
  flex-direction: column;
  gap: 5px;
  color: var(--text-3);
  font-size: var(--fs-caption);
}

.ts-plan-field > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ts-plan-field input {
  min-width: 0;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: var(--fs-caption);
}

.ts-plan-field input:focus {
  border-color: var(--accent);
  outline: none;
}

.ts-plan-note {
  margin: 0;
  color: var(--text-3);
  font-size: var(--fs-micro);
  line-height: 1.6;
}

.ts-plan-clear,
.ts-focus-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  font-family: inherit;
  font-size: var(--fs-caption);
  cursor: pointer;
}

.ts-plan-clear:hover {
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
  background: var(--tag-danger-bg);
  color: var(--danger);
}

.ts-focus-link {
  margin-left: auto;
  color: var(--accent-ink);
  font-weight: 650;
}

.ts-focus-link:hover {
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
  background: var(--accent-light);
}

/* 任务抽屉：外框、标题槽、正文滚动与页脚由 Drawer.vue 统一承担。 */
.ts-title-wrap { width: 100%; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.ts-title-row { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.ts-head-row2 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* 任务详情首屏顺序：标题 / 读数 / 归属 / 工具 / 内容。AI 工具组与导出各占一端。 */
.ts-owner { gap: 6px; padding: 0; border: 0; background: transparent; margin-bottom: 10px; }
.ts-owner .ds-prop-field {
  min-width: 0; height: 32px; display: flex; align-items: center; gap: 5px;
  padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2);
}
.ts-owner .ds-prop-label { flex: none; margin: 0; display: inline-flex; align-items: center; gap: 4px; }
.ts-owner .ds-prop-select { flex: 1; min-width: 0; margin: 0; padding: 0 5px; border: 0; background: transparent; }
.ts-owner .ds-prop-select:focus { box-shadow: none; }
/* R166 F4：资源支持区（点行打开、× 解绑只删记录） */
.ts-sup { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); overflow: hidden; }
.ts-sup-row { display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.ts-sup-row:last-child { border-bottom: 0; }
.ts-sup-nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); cursor: pointer; }
.ts-sup-nm:hover { color: var(--accent); text-decoration: underline; }
.ts-sup-why { font-size: var(--fs-tiny); color: var(--text-4); max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ts-sup-tag { font-size: var(--fs-micro); color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius-full); padding: 0 5px; }
.ts-sup-x { color: var(--text-3); cursor: pointer; padding: 0 2px; }
.ts-sup-x:hover { color: var(--danger); }
.ts-sup-empty { font-size: var(--fs-caption); color: var(--text-3); padding: 8px 2px; }
.check-lg { width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; font-size: var(--fs-body); color: var(--on-accent); background: var(--surface); }
.check-lg.done { background: var(--success); border-color: var(--success); }
.ts-title { flex: 1; font-size: 16px; font-weight: 600; color: var(--text); border: none; outline: none; background: transparent; font-family: inherit; line-height: 1.5; resize: none; min-height: 44px; }
.ts-body { min-width: 0; }
.ts-section { margin-bottom: 16px; }
.ts-goto { margin-top: 7px; font-size: var(--fs-caption); color: var(--accent); cursor: pointer; }
.ts-goto:hover { text-decoration: underline; }
/* V3.9.31（F1）：全景直达按钮 —— 复用 .ts-goto 链接观感，补 button 形态重置与禁用态 */
.ds-goto-pano { display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; padding: 0; font-family: inherit; font-size: var(--fs-caption); }
.ds-goto-pano:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; text-decoration: none; }
.ta-wrap { position: relative; }
.ts-note-section { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); }
.ts-note-head { align-items: center; justify-content: space-between; }
.ts-note-compact { min-height: 64px; max-height: 96px; resize: vertical; line-height: 1.6; background: transparent; padding: 4px 0 0; }
.ts-ai-inline, .ts-ai-primary { padding: 0; border: 0; background: transparent; font-family: inherit; }
.ts-ai-inline { margin-left: auto; }
.ts-ai-primary {
  display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border));
  border-radius: var(--radius-full); background: var(--accent-light); color: var(--accent-ink);
}
.ts-ai-primary:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent-light) 72%, var(--surface)); }
.ts-ai-primary:disabled, .ts-ai-inline:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.ts-resource-section {
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent-light) 36%, var(--surface));
}
.ts-resource-head { align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ts-resource-title { display: inline-flex; align-items: center; gap: 6px; color: var(--text); letter-spacing: 0; text-transform: none; }
.ts-resource-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.ts-pick-resource {
  display: inline-flex; min-height: 32px; align-items: center; gap: 5px;
  padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-full);
  background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer;
}
.ts-pick-resource:hover { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
/* R165-A：链接整行 + 动作贴边 */
.ts-link-row { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
.ts-link-input { flex: 1; min-width: 0; padding: 8px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; font-size: var(--fs-body); color: var(--text); font-family: inherit; outline: none; }
.ts-link-input:focus { border-color: var(--accent); }
.ts-link-btn { width: 32px; height: 32px; flex-shrink: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); cursor: pointer; font-size: var(--fs-body); transition: all var(--dur); }
.ts-link-btn:hover { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.ts-foot { display: flex; gap: 10px; align-items: center; width: 100%; }
.ts-foot .mini-btn { justify-content: center; padding: 9px 16px; flex: 1; }
.ts-foot .mini-btn.primary { flex: 2; }
.ts-kbd { font-size: var(--fs-tiny); background: color-mix(in srgb, var(--on-accent) 22%, transparent); border-radius: 4px; padding: 1px 5px; font-weight: 400; margin-left: 2px; }

/* ===== R48 详情重设计 · V4.7.1 自定义任务状态 ===== */
.ds-status-chip2 {
  border-color: color-mix(in srgb, var(--task-status, var(--border-strong)) 34%, var(--border));
  background: color-mix(in srgb, var(--task-status, var(--text-3)) 11%, var(--surface-2));
  color: var(--text-2);
}
.ds-status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  flex: none;
  margin-right: 4px;
  border-radius: var(--radius-full);
  background: var(--task-status, var(--text-3));
  vertical-align: 1px;
}
.ds-goto-inline { color: var(--accent); cursor: pointer; }
.ds-goto-inline:hover { text-decoration: underline; }
.ds-prop-select { margin-top: 1px; }

@media (max-width: 560px) {
  .ts-owner { grid-template-columns: 1fr; }
  .ts-resource-head { align-items: flex-start; gap: 8px; }
  .ts-resource-title .hint { display: none; }
}
</style>
