<script setup lang="ts">
// 第卌五轮 T-03：任务详情抽屉共享组件（自 CompassActions.vue 抽离）
// 宿主：TaskManagerPanel（任务管理 Tab）+ CompassActions（今日三件事双击详情）
// 用法：ref 后调用 open(task)；关闭/删除/保存逻辑全部内聚
import { ref, computed, nextTick, onMounted, onUnmounted, defineAsyncComponent, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { useCompass } from '../../stores/compass'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useTaHeight } from '@/shared/utils/taHeight'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import type { TaskCard, AssetMeta } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity, curioResIds } from '@/shared/utils/maturity'

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
const mountSearchR = ref('')
const mountSearchC = ref('')

function open(task: TaskCard) {
  // R43-0 BUG-1 修复：selectedTask 必须指向 store 内的 reactive Proxy 元素
  selectedTask.value = d.value.tasks.find(x => x.id === task.id) || task
  taskTitleDraft.value = selectedTask.value.title
  selProjectId.value = selectedTask.value.projectId || ''
  selMetricId.value = selectedTask.value.metricId || ''
  mountSearchR.value = ''
  mountSearchC.value = ''
  sidebarOpen.value = true
}
function close() { sidebarOpen.value = false; selectedTask.value = null; emit('closed') }
defineExpose({ open, close })

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
  showToast('✓ 状态已切换为「' + (status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始') + '」')
}
// ---- R135-C2′：AI 拆解步骤（R139 双通道+专家执笔：建子任务或写详情，角色可换） ----
const AiDrawer = defineAsyncComponent(() => import('@/newtab/components/AiSuggestionDrawer.vue'))
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
const aiPersonaId = ref('default')
async function aiBreakdown() {
  const t = selectedTask.value
  if (!t) return
  const [{ loadAiConfig, aiReady, aiConfig }, { buildChainJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/chain')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (!d.value) return
  // R141（反馈 #2）：未手动换过人时，带入设置页的默认执笔专家
  if (aiPersonaId.value === 'default' && aiConfig.value.defaultPersona) aiPersonaId.value = aiConfig.value.defaultPersona
  const job = buildChainJob('breakdown', t.id, {
    d: d.value, depth: aiConfig.value.depth, persist: () => store.persist(),
    personaId: aiPersonaId.value,
    onPersona: (id) => { aiPersonaId.value = id; void aiBreakdown() },
  })
  if (!job) { showToast('⚠ 任务已不存在'); return }
  aiJob.value = job
}
// R136-A3：按任务推荐资源卡（全库目录挑选，采纳=挂载到本任务）
async function aiRecommend() {
  const t = selectedTask.value
  if (!t) return
  const [{ loadAiConfig, aiReady, aiConfig }, { buildRecommendJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  if (!d.value) return
  const job = buildRecommendJob(t, { d: d.value, depth: aiConfig.value.depth, persist: () => store.persist() })
  if (!job) { showToast('⚠ 库里还没有可推荐的资源卡'); return }
  aiJob.value = job
}
async function deleteTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  // R141：统一软删语义——置 deletedAt 同时摘净 metric.taskIds 引用（撤销时回填）
  softDeleteTaskToTrash(d.value, t)
  store.persist()
  close()
  // REQ-030：撤销（含指标 taskIds 回填，按 id 定位当前树）
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
  showToast('✓ 已保存')
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
/** R142（反馈 #4）：挂载的好奇心卡自带资源（直接关联∪其挂载任务并集）——一键加挂进本任务 */
function curioResOf(cid: string): string[] {
  const c = d.value.curiosities.find(x => x.id === cid)
  if (!c) return []
  return curioResIds(d.value, c).filter(id => resourceTitle(id))
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
  done: { label: '✓ 已完成', cls: 'st-done' }
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

// ---- 单向挂载：任务 → 资源 / 好奇心 ----
function resourceTitle(id: string): string {
  return d.value.resources.find(r => r.id === id && !r.deletedAt)?.title || ''
}
function curiosityTitle(id: string): string {
  return d.value.curiosities.find(c => c.id === id && !c.deletedAt)?.question || ''
}
function toggleMountResource(rid: string) {
  if (!selectedTask.value) return
  const arr = selectedTask.value.mountedResourceIds || []
  selectedTask.value.mountedResourceIds = arr.includes(rid) ? arr.filter(x => x !== rid) : [...arr, rid]
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
function toggleMountCuriosity(cid: string) {
  if (!selectedTask.value) return
  const arr = selectedTask.value.mountedCuriosityIds || []
  selectedTask.value.mountedCuriosityIds = arr.includes(cid) ? arr.filter(x => x !== cid) : [...arr, cid]
  selectedTask.value.updatedAt = Date.now()
  store.persist()
}
const mountResourceCandidates = computed(() => {
  const q = mountSearchR.value.trim().toLowerCase()
  return d.value.resources
    .filter(r => !r.deletedAt)
    .filter(r => !q || r.title.toLowerCase().includes(q))
    .slice(0, 8)
})
const mountCuriosityCandidates = computed(() => {
  const q = mountSearchC.value.trim().toLowerCase()
  return d.value.curiosities
    .filter(c => !c.deletedAt)
    .filter(c => !q || c.question.toLowerCase().includes(q))
    .slice(0, 8)
})

// B23：抽屉快捷键挂文档级（焦点在 TagPicker 浮层等 Teleport 内容内也能生效）
function onSidebarDocKey(e: KeyboardEvent) {
  if (!sidebarOpen.value) return
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
        <div class="check-lg" :class="{done: selectedTask.status==='done'}" @click="toggleTask(selectedTask.id)">{{ selectedTask.status==='done'?'✓':'' }}</div>
        <textarea v-model="taskTitleDraft" class="ts-title" rows="2" placeholder="任务标题..."
          @blur="saveTaskTitle" />
        <!-- R48 详情重设计：状态下拉 chip 收进头部（色彩只做语义信号） -->
        <div class="ds-status-wrap" @click.stop>
          <button class="ds-status-chip2" :class="STATUS_UI[selectedTask.status].cls" @click.stop="statusMenuOpen = !statusMenuOpen">{{ STATUS_UI[selectedTask.status].label }}</button>
          <div v-if="statusMenuOpen" class="ds-status-menu">
            <div v-for="(ui, key) in STATUS_UI" :key="key" class="mi" :class="{on: selectedTask.status === key}" @click.stop="pickStatus(key as 'todo'|'doing'|'done')">{{ ui.label }}</div>
          </div>
        </div>
        <AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" class="ts-title-assets" />
        <!-- R142（反馈 #4）：成熟度大徽标——规则引擎即时分，hover 展开扣分构成 -->
        <MaturityBadge lg :m="taskMaturity(selectedTask)" title="成熟度=可执行/可归属/弹药/新鲜度（规则引擎即时评）" />
        <div class="ts-close" @click="close">×</div>
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
        <!-- R48：属性紧凑化——项目/指标双列一行，优先级/链接紧随 -->
        <div class="ts-section ds-props2">
          <div class="ds-prop-field">
            <label class="ds-prop-label">📦 项目</label>
            <select v-model="selProjectId" class="ds-prop-select" @change="onSelProjectChange">
              <option value="">未关联项目</option>
              <option v-for="p in sidebarProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="ds-prop-field">
            <label class="ds-prop-label">🎯 指标</label>
            <select v-model="selMetricId" class="ds-prop-select" :disabled="!selProjectId" @change="onSelMetricChange">
              <option value="">暂不归属</option>
              <option v-for="m in sidebarMetrics" :key="m.id" :value="m.id">{{ m.title }}</option>
            </select>
          </div>
        </div>
        <div class="ts-section ds-props2">
          <div class="ds-prop-field">
            <label class="ds-prop-label">⚡ 优先级</label>
            <select class="ds-prop-select" :value="selectedTask.priority" @change="setPriority(($event.target as HTMLSelectElement).value as 'low'|'medium'|'high')">
              <option value="high">🔴 高</option>
              <option value="medium">🟡 中</option>
              <option value="low">🟢 低</option>
            </select>
          </div>
          <div class="ds-prop-field">
            <label class="ds-prop-label">🔗 链接</label>
            <input v-model="selectedTask.link" class="ds-prop-select" style="cursor:text" placeholder="https://… / D:\path\file.pdf" @blur="touchTask" @keydown.enter.prevent="($event.target as HTMLElement).blur()">
          </div>
        </div>
        <!-- R48：标签一行 -->
        <div class="ts-section">
          <TagPicker v-model="selectedTask.tags" />
        </div>
        <div class="ts-section ds-meta">
          <span>创建 {{ fmtTaskTs(selectedTask.createdAt) }}</span>
          <span>更新 {{ fmtTaskTs(selectedTask.updatedAt) }}</span>
          <span class="ts-goto ds-goto-inline" @click="router.push('/compass/tree')">🧭 没有合适的项目/指标？去方向树创建 ›</span>
        </div>
        <!-- R48：附属区折叠（附件 / 单向挂载） -->
        <details class="ds-details" style="margin-top:14px">
          <summary>📎 附件 <span v-if="selectedTask.assets?.length" class="cnt">({{ selectedTask.assets.length }})</span><AssetBadge v-if="selectedTask.assets?.length" :assets="selectedTask.assets" /><span class="right">图片 / HTML / PDF</span></summary>
          <AssetManager v-model="selectedTask.assets" :owner-id="selectedTask.id" @update:model-value="onTaskAssetsChange" @html-added="onTaskHtmlAdded" />
        </details>
        <details class="ds-details" style="margin-top:12px">
          <summary>🔗 挂载资源卡 <span class="cnt">({{ selectedTask.mountedResourceIds.filter(id => resourceTitle(id)).length }})</span><span class="right">单向挂载 · 点条目取消</span></summary>
          <div class="ts-mount-list">
            <div v-for="rid in selectedTask.mountedResourceIds.filter(id => resourceTitle(id))" :key="rid" class="ts-mount-item" @click="toggleMountResource(rid)" title="点击取消挂载">
              📄 {{ resourceTitle(rid) }} <span class="remove">×</span>
            </div>
            <div v-if="!selectedTask.mountedResourceIds.filter(id => resourceTitle(id)).length" class="ts-mount-empty">暂未挂载资源</div>
          </div>
          <div class="ts-mount-wrap">
            <input v-model="mountSearchR" class="ts-mount-search" placeholder="🔍 输入关键词搜索并挂载资源卡…">
            <div v-if="mountSearchR.trim()" class="ts-mount-pop">
              <div v-for="r in mountResourceCandidates" :key="r.id" class="ts-mount-cand"
                :class="{on: selectedTask.mountedResourceIds.includes(r.id)}" @click="toggleMountResource(r.id)">
                {{ selectedTask.mountedResourceIds.includes(r.id) ? '✓' : '＋' }} {{ r.title }}
              </div>
              <div v-if="!mountResourceCandidates.length" class="ts-mount-empty" style="padding:10px">无匹配资源</div>
            </div>
          </div>
        </details>
        <details class="ds-details" style="margin-top:12px">
          <summary>💡 挂载好奇心卡 <span class="cnt">({{ selectedTask.mountedCuriosityIds.filter(id => curiosityTitle(id)).length }})</span><span class="right">单向挂载 · 点条目取消</span></summary>
          <div class="ts-mount-list">
            <div v-for="cid in selectedTask.mountedCuriosityIds.filter(id => curiosityTitle(id))" :key="cid" class="ts-mount-item" @click="toggleMountCuriosity(cid)" title="点击取消挂载">
              💡 {{ curiosityTitle(cid) }} <span class="remove">×</span>
              <span v-for="rid in curioResOf(cid)" :key="rid" class="ts-mount-curio-res" title="点击挂到本任务" @click.stop="toggleMountResource(rid)">🔗 {{ resourceTitle(rid) }}</span>
            </div>
            <div v-if="!selectedTask.mountedCuriosityIds.filter(id => curiosityTitle(id)).length" class="ts-mount-empty">暂未挂载好奇心</div>
          </div>
          <div class="ts-mount-wrap">
            <input v-model="mountSearchC" class="ts-mount-search" placeholder="🔍 输入关键词搜索并挂载好奇心…">
            <div v-if="mountSearchC.trim()" class="ts-mount-pop">
              <div v-for="c in mountCuriosityCandidates" :key="c.id" class="ts-mount-cand"
                :class="{on: selectedTask.mountedCuriosityIds.includes(c.id)}" @click="toggleMountCuriosity(c.id)">
                {{ selectedTask.mountedCuriosityIds.includes(c.id) ? '✓' : '＋' }} {{ c.question }}
              </div>
              <div v-if="!mountCuriosityCandidates.length" class="ts-mount-empty" style="padding:10px">无匹配好奇心</div>
            </div>
          </div>
        </details>
      </div>
      <div class="ts-foot">
        <!-- R48：删除按钮降级（ghost 弱化，hover 扣动扳机），主操作唯一 -->
        <button class="ts-del-ghost" @click="deleteTask(selectedTask.id)" title="删除任务（可在回收站撤销）">🗑 删除</button>
        <button class="mini-btn" @click="aiBreakdown" title="AI 拆解本任务：可建半天粒度步骤子任务，也可只把步骤清单写进详情；还能换专家执笔">🤖 拆解步骤</button>
        <button class="mini-btn" @click="aiRecommend" title="AI 从全库挑此刻用得上的资源卡（采纳=挂载到本任务）">🤖 推荐卡</button>
        <span class="ts-foot-spacer"></span>
        <button class="mini-btn primary" @click="saveTaskTitleAndClose">✓ 完成并关闭 <span class="ts-kbd">Ctrl+↩</span></button>
      </div>
    </div>
  </Transition>
  <!-- R135-C2′：拆解建议评审抽屉（步骤子任务+行动方案，勾选采纳才落库；置于 Transition 外保单子节点约束） -->
  <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
</template>

<style scoped>
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

.fade-enter-active, .fade-leave-active { transition: opacity var(--dur-slow); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform .2s cubic-bezier(.16,1,.3,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

/* 任务抽屉 */
.task-sidebar { position: fixed; top: 0; right: 0; width: 440px; max-width: 94vw; height: 100%; background: var(--surface); border-left: 1px solid var(--border); z-index: 201; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 200; }
.ts-resize { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 3; }
.ts-resize:hover { background: var(--accent); opacity: .4; }
.ts-head { padding: 18px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; }
.check-lg { width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; font-size: 13px; color: #fff; background: var(--surface); }
.check-lg.done { background: var(--success); border-color: var(--success); }
.ts-title { flex: 1; font-size: 16px; font-weight: 600; color: var(--text); border: none; outline: none; background: transparent; font-family: inherit; line-height: 1.5; resize: none; min-height: 44px; }
.ts-title-assets { flex-shrink: 0; }
.ts-close { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; color: var(--text-3); font-size: 18px; flex-shrink: 0; }
.ts-close:hover { background: var(--surface-3); color: var(--text); }
.ts-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.ts-section { margin-bottom: 16px; }
.ts-label { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 7px; }
.ts-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ts-select { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; }
.ts-select:focus { border-color: var(--accent); }
.ts-select:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.ts-goto { margin-top: 7px; font-size: 11px; color: var(--accent); cursor: pointer; }
.ts-goto:hover { text-decoration: underline; }
.ts-input { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; font-family: inherit; }
.ts-input:focus { border-color: var(--accent); }
.ts-note { width: 100%; min-height: 64px; max-height: 320px; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; font-family: inherit; resize: vertical; line-height: 1.7; }
.ts-note:focus { border-color: var(--accent); }
/* 第卅三轮 REQ-024：文本框拖拽手柄（高度经 UIPrefs.taHeights 记忆） */
.ta-wrap { position: relative; }
.ta-resize { position: absolute; right: 3px; bottom: 3px; width: 16px; height: 12px; cursor: ns-resize; z-index: 2; opacity: .45; border-right: 3px solid var(--text-3); border-bottom: 3px solid var(--text-3); border-bottom-right-radius: 3px; }
.ta-resize:hover { opacity: .9; }
/* B22：状态三选 chips */
.ts-status-chip { flex: 1; padding: 8px 4px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); font-size: 11.5px; cursor: pointer; font-family: inherit; color: var(--text-2); transition: all var(--dur-fast); white-space: nowrap; }
.ts-status-chip:hover { border-color: var(--accent); color: var(--accent); }
.ts-status-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
.ts-time-text { font-size: 11px; color: var(--text-3); }
.ts-field { padding: 10px 13px; background: var(--surface-2); border-radius: 8px; font-size: 13px; cursor: pointer; transition: all var(--dur); display: flex; align-items: center; gap: 8px; border: 1px solid transparent; }
.ts-field:hover { border-color: var(--border); background: var(--surface); }
.ts-field .fv { flex: 1; }
.ts-field .fh { font-size: 10px; color: var(--text-4); }
.ts-mount-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.ts-mount-item { display: flex; align-items: center; gap: 5px; padding: 4px 10px; background: var(--accent-light); border-radius: 99px; font-size: 11.5px; color: var(--accent); cursor: pointer; max-width: 100%; }
.ts-mount-item:hover { background: var(--danger); color: #fff; }
.ts-mount-item .remove { font-size: 10px; opacity: .6; }
.ts-mount-empty { font-size: 11px; color: var(--text-3); padding: 2px 0; }
.ts-mount-search { width: 100%; margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 7px 11px; font-size: 12px; font-family: inherit; outline: none; background: var(--surface); color: var(--text); }
.ts-mount-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.ts-mount-wrap { position: relative; margin-top: 8px; }
.ts-mount-pop { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-lg); max-height: 240px; overflow-y: auto; padding: 4px; }
.ts-mount-cand { padding: 6px 10px; border-radius: 6px; font-size: 12px; color: var(--text-2); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ts-mount-cand:hover { background: var(--accent-light); color: var(--accent); }
.ts-mount-cand.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.ts-foot { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: center; }
.ts-foot .mini-btn { justify-content: center; padding: 9px 16px; }
.ts-del-ghost { display: inline-flex; align-items: center; gap: 5px; padding: 7px 11px; border: none; background: transparent; border-radius: 6px; font-size: 11.5px; cursor: pointer; color: var(--text-3); font-family: inherit; transition: all var(--dur); user-select: none; }
.ts-del-ghost:hover { color: var(--danger); background: var(--danger-light, rgba(231,76,60,.1)); }
.ts-foot-spacer { flex: 1; }
.ts-kbd { font-size: 10px; background: rgba(255,255,255,.22); border-radius: 4px; padding: 1px 5px; font-weight: 400; margin-left: 2px; }

/* ===== R48 详情重设计 ===== */
.ds-status-wrap { margin-left: auto; }
.ds-status-chip2.st-todo { background: var(--tag-neutral-bg, var(--surface-3)); color: var(--text-2); }
.ds-status-chip2.st-doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.ds-status-chip2.st-done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.ds-goto-inline { color: var(--accent); cursor: pointer; }
.ds-goto-inline:hover { text-decoration: underline; }
.ds-prop-select { margin-top: 1px; }
</style>
