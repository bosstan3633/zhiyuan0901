<script setup lang="ts">
// R49（V2.22.0）三大系统页改版：本页 = 调度台（默认首页）
// - 今日记录条（入台/移出/调出/写入记录，点击开抽屉）
// - 左右分栏：左=今日三件事（硬上限 3，自 CompassActions 整体迁入，交互逐项一致）｜右=项目调度面板（单击三件事联动）
// - 底部 Tab：好奇心培育（默认）｜任务调度（原好奇心培育/任务调度改名，面板组件复用）
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { visibleFields } from '@/shared/utils/fields'
import { readEventLog } from '@/shared/utils/eventLog'
import { subscribeSaveError, getLastSaveOkAt, getBytesInUse, hasUnlimitedStorage, saveDataNow } from '@/shared/storage/repository'
import type { SaveError } from '@/shared/storage/repository'
import type { TaskCard, Project, FocusSlot, Direction } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import Drawer from '@/shared/components/Drawer.vue'
import CuriosityPanel from '../components/compass/CuriosityPanel.vue'
import TaskManagerPanel from '../components/compass/TaskManagerPanel.vue'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress } = useCompass()

const drawerRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)

// ---- 日期工具 ----
function formatDate(dt: Date): string {
  const week = ['周日','周一','周二','周三','周四','周五','周六']
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${week[dt.getDay()]}`
}
function dateStr(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}
const todayStart = (() => { const t = new Date(); t.setHours(0,0,0,0); return t.getTime() })()

// ================= 今日记录条（R49-B1） =================
type RecItem = { id?: string; kind?: 'resource' | 'task' | 'curio'; title: string; ts: number; clickable: boolean }
const todayIn = computed<RecItem[]>(() => {
  const list: RecItem[] = []
  for (const r of d.value.resources) if (!r.deletedAt && r.createdAt >= todayStart) list.push({ id: r.id, kind: 'resource', title: r.title, ts: r.createdAt, clickable: true })
  for (const t of d.value.tasks) if (!t.deletedAt && t.createdAt >= todayStart) list.push({ id: t.id, kind: 'task', title: t.title, ts: t.createdAt, clickable: true })
  for (const c of d.value.curiosities) if (!c.deletedAt && c.createdAt >= todayStart) list.push({ id: c.id, kind: 'curio', title: c.question || '（无标题）', ts: c.createdAt, clickable: true })
  return list.sort((a, b) => b.ts - a.ts)
})
const todayOut = computed<RecItem[]>(() => {
  const list: RecItem[] = []
  for (const r of d.value.resources) if (r.deletedAt && r.deletedAt >= todayStart) list.push({ id: r.id, kind: 'resource', title: r.title, ts: r.deletedAt, clickable: true })
  for (const t of d.value.tasks) if (t.deletedAt && t.deletedAt >= todayStart) list.push({ id: t.id, kind: 'task', title: t.title, ts: t.deletedAt, clickable: true })
  for (const c of d.value.curiosities) if (c.deletedAt && c.deletedAt >= todayStart) list.push({ id: c.id, kind: 'curio', title: c.question || '（无标题）', ts: c.deletedAt, clickable: true })
  return list.sort((a, b) => b.ts - a.ts)
})
const todayCalled = computed<RecItem[]>(() => {
  const list: RecItem[] = []
  for (const r of d.value.resources) if (!r.deletedAt && (r.lastCalledAt || 0) >= todayStart) list.push({ id: r.id, kind: 'resource', title: r.title, ts: r.lastCalledAt || 0, clickable: true })
  for (const t of d.value.tasks) if (!t.deletedAt && (t.lastCalledAt || 0) >= todayStart) list.push({ id: t.id, kind: 'task', title: t.title, ts: t.lastCalledAt || 0, clickable: true })
  for (const c of d.value.curiosities) if (!c.deletedAt && (c.lastCalledAt || 0) >= todayStart) list.push({ id: c.id, kind: 'curio', title: c.question || '（无标题）', ts: c.lastCalledAt || 0, clickable: true })
  return list.sort((a, b) => b.ts - a.ts)
})

/** R50-F7：今日记录条副行拆解（任务/好奇/资源 分类型计数） */
const kindLabel = { task: '任务', curio: '好奇', resource: '资源' } as const
function breakdownOf(items: RecItem[]): string {
  const c = { task: 0, curio: 0, resource: 0 }
  for (const it of items) if (it.kind) c[it.kind]++
  return `任务${c.task} · 好奇${c.curio} · 资源${c.resource}`
}
const inSub = computed(() => breakdownOf(todayIn.value))
const outSub = computed(() => breakdownOf(todayOut.value))
const calledSub = computed(() => breakdownOf(todayCalled.value))
/** 写入记录 = 当日写入 + 删除 + 全局调度调出（全部操作计数，副行拆 任务/好奇/资源） */
const logSub = computed(() => {
  const c = { task: 0, curio: 0, resource: 0 }
  for (const e of logRaw.value) {
    if (e.kind === 'task') c.task++
    else if (e.kind === 'curiosity') c.curio++
    else if (e.kind === 'resource') c.resource++
  }
  for (const it of todayCalled.value) if (it.kind) c[it.kind]++
  return `任务${c.task} · 好奇${c.curio} · 资源${c.resource}`
})
const logTotal = computed(() => logRaw.value.length + todayCalled.value.length)
const logCount = computed(() => logTotal.value)
const logItems = ref<RecItem[]>([])
const logRaw = ref<{ action: string; kind: string; title: string; ts: number }[]>([])
const ACT_LABEL: Record<string, string> = { create: '新增', delete: '删除', restore: '恢复', purge: '清理' }
async function loadEventLog() {
  try {
    const all = await readEventLog()
    const todays = all.filter(e => e.ts >= todayStart)
    logRaw.value = todays
    // R51-F12：写入记录按时间降序——最新记录在最前
    logItems.value = todays
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .map(e => ({ kind: e.kind === 'curiosity' ? 'curio' : e.kind === 'task' ? 'task' : e.kind === 'resource' ? 'resource' : undefined, title: `${ACT_LABEL[e.action] || e.action} · ${e.title}`, ts: e.ts, clickable: false }))
  } catch { logRaw.value = [] }
}

// 记录抽屉（R49-B2：搜索 + 每页 20 条翻页 + 点击定位）
const recOpen = ref<'' | 'in' | 'out' | 'called' | 'log'>('')
const recSearch = ref('')
const recPage = ref(1)
const REC_PAGE_SIZE = 20
const recTitles = { in: '今日入台', out: '今日移出', called: '今日调出', log: '写入记录' } as const
function openRec(k: 'in' | 'out' | 'called' | 'log') {
  recOpen.value = k; recSearch.value = ''; recPage.value = 1
  if (k === 'log') loadEventLog()
}
const recSource = computed<RecItem[]>(() => {
  if (recOpen.value === 'in') return todayIn.value
  if (recOpen.value === 'out') return todayOut.value
  if (recOpen.value === 'called') return todayCalled.value
  if (recOpen.value === 'log') return logItems.value
  return []
})
const recFiltered = computed(() => {
  const q = recSearch.value.trim().toLowerCase()
  return q ? recSource.value.filter(x => x.title.toLowerCase().includes(q)) : recSource.value
})
const recPageCount = computed(() => Math.max(1, Math.ceil(recFiltered.value.length / REC_PAGE_SIZE)))
const recSlice = computed(() => recFiltered.value.slice((recPage.value - 1) * REC_PAGE_SIZE, recPage.value * REC_PAGE_SIZE))
const kindIcon = (k?: string) => (k === 'resource' ? '🔗' : k === 'task' ? '📋' : k === 'curio' ? '💡' : '·')
function locateRec(x: RecItem) {
  if (!x.clickable || !x.id) return
  recOpen.value = ''
  if (x.kind === 'resource') {
    const r = d.value.resources.find(v => v.id === x.id)
    const wsId = r?.workspaceId || store.workspaces[0]?.id
    if (wsId) router.push({ path: `/workspace/${wsId}`, query: { hl: x.id } })
  } else {
    router.push({ path: '/', query: { hl: x.id } })
  }
}

// ================= 今日三件事（自 CompassActions 迁入，交互 1:1） =================
const todayDate = ref(new Date())
function shiftDate(n: number) { todayDate.value = new Date(todayDate.value.getTime() + n * 86400_000) }
const todayFocusList = computed<FocusSlot[]>(() => {
  const key = dateStr(todayDate.value)
  return (d.value.dailyFocus?.[key] || []).slice(0, 3)
})
const FOCUS_LIMIT = 3
const focusFull = computed(() => todayFocusList.value.length >= FOCUS_LIMIT)
function todayTaskForSlot(slot: FocusSlot): TaskCard | null {
  if (slot.sourceType === 'task' && slot.sourceId) {
    return d.value.tasks.find(t => !t.deletedAt && t.id === slot.sourceId) || null
  }
  return null
}
/** 三件事卡 → 选中索引（默认第一件事），联动右栏项目调度面板 */
const focusSelIdx = ref(0)
const focusTasks = computed<(TaskCard | null)[]>(() => todayFocusList.value.map(s => todayTaskForSlot(s)))
const selTask = computed<TaskCard | null>(() => focusTasks.value[focusSelIdx.value] || focusTasks.value.find(t => !!t) || null)
function onFocusCardClick(idx: number) {
  focusSelIdx.value = idx
}

// 任务选取弹窗（满 3 拦截：按钮与空位两条路径同拦，R49-B4）
const pickerOpen = ref(false)
const pickerSlot = ref(0)
const pickerSearch = ref('')
function openPicker(slot: number) {
  if (focusFull.value) { showToast('⚖ 今日三件事已满（3/3）——先完成或移除一件'); return }
  pickerSlot.value = Math.min(slot, FOCUS_LIMIT - 1)
  pickerSearch.value = ''
  pickerOpen.value = true
}
function selectTaskForSlot(task: TaskCard) {
  const key = dateStr(todayDate.value)
  if (!d.value.dailyFocus[key]) d.value.dailyFocus[key] = []
  const list = d.value.dailyFocus[key]
  const slot: FocusSlot = {
    id: uid('focus'),
    sourceType: 'task',
    sourceId: task.id,
    text: task.title,
    done: task.status === 'done',
    doneAt: task.completedAt
  }
  if (list[pickerSlot.value]) list[pickerSlot.value] = slot
  else list.push(slot)
  store.persist()
  pickerOpen.value = false
  focusSelIdx.value = Math.min(pickerSlot.value, FOCUS_LIMIT - 1)
  showToast('✓ 已添加到今日三件事')
}
const pickerCandidates = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  return d.value.tasks
    .filter(t => !t.deletedAt)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) // 置顶优先
    .slice(0, 30)
})
/** 已完成或已选入今日三件事的任务置灰不可选 */
const pickedIds = computed(() => new Set(todayFocusList.value.map(s => s.sourceId)))
function pickerDisabled(t: TaskCard): boolean {
  return t.status === 'done' || pickedIds.value.has(t.id)
}
function selectTaskGuarded(t: TaskCard) {
  if (pickerDisabled(t)) { showToast(t.status === 'done' ? '该任务已完成' : '该任务已选入今日三件事'); return }
  selectTaskForSlot(t)
}
function removeTodaySlot(idx: number) {
  const key = dateStr(todayDate.value)
  if (d.value.dailyFocus[key]) {
    d.value.dailyFocus[key].splice(idx, 1)
    store.persist()
  }
}
function copyYesterday() {
  const today = dateStr(todayDate.value)
  const yesterday = dateStr(new Date(todayDate.value.getTime() - 86400_000))
  const yesterdayList = d.value.dailyFocus[yesterday]
  if (!yesterdayList || !yesterdayList.length) {
    showToast('昨日无三件事记录')
    return
  }
  d.value.dailyFocus[today] = JSON.parse(JSON.stringify(yesterdayList))
  d.value.dailyFocus[today].forEach(s => { s.done = false; s.doneAt = undefined })
  store.persist()
  showToast('✓ 已复制昨日三件事')
}
// 三件事导出弹窗（时间范围 + CSV）
const exportOpen = ref(false)
const exportFrom = ref(dateStr(new Date()))
const exportTo = ref(dateStr(new Date()))
function openExportModal() {
  exportFrom.value = dateStr(new Date())
  exportTo.value = dateStr(new Date())
  exportOpen.value = true
}
function statusLabelOf(t?: TaskCard | null, done?: boolean): string {
  if (t) return t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始'
  return done ? '已完成' : '未完成'
}
const exportBusy = ref(false)
function doExport() {
  const from = exportFrom.value
  const to = exportTo.value
  if (!from || !to) { showToast('请选择起止日期'); return }
  if (from > to) { showToast('开始日期不能晚于结束日期'); return }
  const rows: string[][] = []
  for (const key of Object.keys(d.value.dailyFocus || {}).sort()) {
    if (key < from || key > to) continue
    for (const slot of d.value.dailyFocus[key] || []) {
      const t = slot.sourceType === 'task' && slot.sourceId
        ? d.value.tasks.find(x => x.id === slot.sourceId && !x.deletedAt) : null
      const proj = t ? projectName(t.projectId) : ''
      const met = t && t.metricId ? metricName(t.metricId) : ''
      rows.push([
        slot.text || (t?.title ?? ''),
        proj,
        proj && met !== '未关联' ? `${proj} / ${met}` : '',
        statusLabelOf(t, slot.done),
        key,
        t?.createdAt ? new Date(t.createdAt).toLocaleString('zh-CN') : '',
        t?.pinned ? '是' : '',
        t?.starred ? '是' : ''
      ])
    }
  }
  if (!rows.length) { showToast('所选范围内没有三件事记录'); return }
  exportBusy.value = true
  const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"'
  const csv = '任务内容,所属项目,项目→成功指标,任务状态,安排时间,创建时间,置顶,星标\n'
    + rows.map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `任务导出_${from}_${to}.csv`
  a.click(); URL.revokeObjectURL(url)
  exportOpen.value = false
  exportBusy.value = false
  showToast(`✓ 已导出 ${rows.length} 条记录`)
}
function toggleTodayDone(slot: FocusSlot) {
  slot.done = !slot.done
  slot.doneAt = slot.done ? Date.now() : undefined
  if (slot.sourceType === 'task' && slot.sourceId) {
    const t = d.value.tasks.find(x => x.id === slot.sourceId)
    if (t) {
      t.status = slot.done ? 'done' : 'todo'
      t.completedAt = slot.doneAt
      t.updatedAt = Date.now()
    }
  }
  store.persist()
}

// ---- 公共名称工具 ----
function projectName(projId?: string): string {
  if (!projId) return '未关联'
  return allProjects().find(x => x.id === projId)?.name || '未关联'
}
function metricName(metricId?: string): string {
  if (!metricId) return '未关联'
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return m.title
    }
  }
  return '未关联'
}

// ---- 附件字段可见性（三件事卡正面徽章显隐） ----
const tFields = computed(() => visibleFields(d.value.fieldConfig, 'task'))
const taskAssetsOn = computed(() => tFields.value.some(f => f.key === 'assets'))

// ================= 项目调度面板（右栏，单击三件事联动；自 CompassActions 迁入） =================
function goalOf(p: Project): Direction | null {
  for (const dir of d.value.compass.directions) {
    if (dir.projects.some(x => x.id === p.id)) return dir
  }
  return null
}
const curProject = computed<Project | null>(() => {
  const pid = selTask.value?.projectId
  if (!pid) return null
  return allProjects().find(p => p.id === pid) || null
})
const projMetrics = computed(() => curProject.value?.metrics || [])
const projTasks = computed(() =>
  curProject.value ? d.value.tasks.filter(t => !t.deletedAt && t.projectId === curProject.value!.id) : []
)
const projDoneCount = computed(() => projTasks.value.filter(t => t.status === 'done').length)
const projDoingCount = computed(() => projTasks.value.filter(t => t.status === 'doing').length)
/** 按成功指标分组（+ 未归类），空指标组隐藏 */
const metricGroups = computed(() => {
  const p = curProject.value
  if (!p) return []
  const groups = p.metrics.map(m => ({ key: m.id, title: m.title, tasks: projTasks.value.filter(t => t.metricId === m.id) }))
  const mids = new Set(p.metrics.map(m => m.id))
  const orphan = projTasks.value.filter(t => !t.metricId || !mids.has(t.metricId))
  if (orphan.length) groups.push({ key: '__none__', title: '未归类任务', tasks: orphan })
  return groups
})
const dirTermLabel = (dir: Direction | null) =>
  dir?.term === 'long' ? '远期' : dir?.term === 'short' ? '近期' : dir?.term === 'mid' ? '中期' : ''
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
/** 新建任务：预设项目（可预设指标），创建后直接打开详情抽屉 */
function createProjectTask(metricId?: string) {
  const p = curProject.value
  if (!p) { showToast('请先在今日三件事选择已关联项目的任务'); return }
  const task: TaskCard = {
    id: uid('tk'),
    kind: 'task',
    title: '新任务',
    status: 'todo',
    priority: 'medium',
    projectId: p.id,
    metricId,
    mountedResourceIds: [],
    mountedCuriosityIds: [],
    customFields: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  if (metricId) syncMetricTaskIds(task.id, undefined, metricId)
  d.value.tasks.unshift(task)
  store.persist()
  drawerRef.value?.open(task)
  showToast('✓ 新任务已创建')
  nextTick(() => {
    const el = document.querySelector('.ts-title') as HTMLTextAreaElement | null
    if (el) { el.focus(); el.select() }
  })
}
/** 关联任务：从任务库选一个未属于该项目的任务挂进来（可预选/补选目标指标） */
const linkPickerOpen = ref(false)
const linkSearch = ref('')
const linkTargetMetric = ref('')
function openLinkPicker(metricId?: string) {
  if (!curProject.value) { showToast('请先在今日三件事选择已关联项目的任务'); return }
  linkSearch.value = ''
  linkTargetMetric.value = metricId || ''
  linkPickerOpen.value = true
}
const linkCandidates = computed(() => {
  const q = linkSearch.value.trim().toLowerCase()
  const pid = curProject.value?.id
  return d.value.tasks
    .filter(t => !t.deletedAt && t.projectId !== pid)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    .slice(0, 30)
})
function linkTaskToProject(t: TaskCard) {
  linkTaskToMetric(t, linkTargetMetric.value || undefined)
}
/** 成功指标新增 */
const addingMetric = ref(false)
const newMetricTitle = ref('')
function startAddMetric() { addingMetric.value = true; newMetricTitle.value = '' }
function confirmAddMetric() {
  const p = curProject.value
  const title = newMetricTitle.value.trim()
  if (!p || !title) { addingMetric.value = false; return }
  p.metrics.push({ id: uid('met'), title, taskIds: [] })
  store.persist()
  showToast('✓ 成功指标「' + title + '」已新增')
  addingMetric.value = false
}
/** 成功指标删除 = 摘除关联：指标从项目移除，其下任务转「未关联指标」（不物理删任务） */
function removeMetric(metricId: string) {
  const p = curProject.value
  if (!p) return
  const m = p.metrics.find(x => x.id === metricId)
  if (!m) return
  const n = m.taskIds.length
  p.metrics = p.metrics.filter(x => x.id !== metricId)
  for (const t of d.value.tasks) {
    if (t.metricId === metricId) { t.metricId = undefined; t.updatedAt = Date.now() }
  }
  store.persist()
  showToast('✓ 指标「' + m.title + '」已删除' + (n ? '，' + n + ' 个任务转为未关联指标' : ''))
}
/** 关联任务到具体指标：跨项目先改归属，再设指标并双写 taskIds */
function linkTaskToMetric(t: TaskCard, metricId?: string) {
  const p = curProject.value
  if (!p) return
  const oldMetric = t.metricId
  t.projectId = p.id
  t.metricId = metricId
  syncMetricTaskIds(t.id, oldMetric, metricId)
  t.updatedAt = Date.now()
  store.persist()
  linkPickerOpen.value = false
  showToast('✓ 已关联到「' + p.name + '」' + (metricId ? ' · ' + metricName(metricId) : ''))
}
/** 任务删除（软删除进回收站，可撤销） */
function removeTask(t: TaskCard) {
  t.deletedAt = Date.now()
  store.persist()
  showToast('已删除「' + t.title.slice(0, 20) + '」', { label: '撤销', cb: () => {
    const cur = d.value.tasks.find(x => x.id === t.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}

// ---- Ctrl+←/→ 切换三件事日期（非输入焦点时） ----
function onDateKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); shiftDate(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
}
onMounted(() => {
  document.addEventListener('keydown', onDateKey, true)
  loadEventLog()
  saveErrSub = subscribeSaveError(e => { saveErr.value = e })
  lastOkTick.value = getLastSaveOkAt()
  storageTimer = window.setInterval(() => { lastOkTick.value = getLastSaveOkAt() }, 30000)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDateKey, true)
  if (saveErrSub) saveErrSub()
  if (storageTimer) clearInterval(storageTimer)
})

// ================= 数据存储状态栏（R50-F2） =================
const saveErr = ref<SaveError | null>(null)
const lastOkTick = ref(0)
let saveErrSub: (() => void) | null = null
let storageTimer = 0
const storageOk = computed(() => !saveErr.value)
const ERR_LABEL: Record<string, string> = { quota: '存储空间已满', serial: '数据序列化失败', unknown: '未知写入错误' }
const storageText = computed(() => saveErr.value
  ? `存储异常 · ${ERR_LABEL[saveErr.value.kind] || '写入失败'}`
  : lastOkTick.value
    ? `数据存储正常 · ${timeAgo(lastOkTick.value)}`
    : '数据存储正常')
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚写入'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前写入`
  return `${Math.floor(diff / 3_600_000)} 小时前写入`
}
async function onStorageClick() {
  if (saveErr.value) {
    try { await saveDataNow(); showToast('✓ 已重试写入，存储恢复正常') }
    catch { showToast('✗ 重试仍失败，建议导出备份（设置 → 导出数据）') }
    return
  }
  const bytes = await getBytesInUse()
  showToast(`存储正常 · 已用 ${(bytes / 1024).toFixed(0)} KB${hasUnlimitedStorage() ? ' · 不限容量' : ''}`)
}

// R51-F10：恢复上下联动布局——三件事居上（视觉焦点），项目调度联动在下；原左右分栏拖拽移除

// ================= 底部 Tab：好奇心培育 / 任务调度 =================
const zone = ref<'curio' | 'task'>('curio')
// R51-F15：支持 query.zone 预设底部 Tab（未归档任务定位 → 任务调度）
watch(() => route.query.zone, (z) => {
  if (z === 'task') zone.value = 'task'
  else if (z === 'curio') zone.value = 'curio'
}, { immediate: true })
const curioCount = computed(() => (d.value.curiosities || []).filter(c => !c.deletedAt).length)
const taskCount = computed(() => (d.value.tasks || []).filter(t => !t.deletedAt).length)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="crumb"><b>调度台</b> · 今天，从哪里出发</div>
      <div class="spacer" />
      <button class="storage-chip" :class="{ err: !storageOk }" :title="storageOk ? '点击查看存储用量' : '点击重试写入'" @click="onStorageClick">
        <span class="sc-dot" />
        <span>{{ storageText }}</span>
      </button>
    </div>

    <!-- 今日记录条（R50-F7：两行 = 主计数 + 分类型副行） -->
    <div class="rec-strip">
      <div class="rec-cell" @click="openRec('in')">
        <div class="rc-main"><span class="rc-ic">⬇</span><span class="rc-lab">今日入台</span><span class="rc-num">{{ todayIn.length }}</span></div>
        <div class="rc-sub">{{ inSub }}</div>
      </div>
      <div class="rec-cell" @click="openRec('out')">
        <div class="rc-main"><span class="rc-ic">⬆</span><span class="rc-lab">今日移出</span><span class="rc-num">{{ todayOut.length }}</span></div>
        <div class="rc-sub">{{ outSub }}</div>
      </div>
      <div class="rec-cell" @click="openRec('called')">
        <div class="rc-main"><span class="rc-ic">↗</span><span class="rc-lab">今日调出</span><span class="rc-num">{{ todayCalled.length }}</span></div>
        <div class="rc-sub">{{ calledSub }}</div>
      </div>
      <div class="rec-cell" @click="openRec('log')">
        <div class="rc-main"><span class="rc-ic">✎</span><span class="rc-lab">写入记录</span><span class="rc-num">{{ logCount }}</span></div>
        <div class="rc-sub">{{ logSub }}</div>
      </div>
    </div>

    <!-- 左右分栏：今日三件事 ｜ 项目调度 -->
    <div id="dispatch-split" class="split">
      <!-- 左列 · 今日三件事 -->
      <!-- 上 · 今日三件事（R51-F10：视觉焦点） -->
      <section class="module left-col">
        <div class="card">
          <div class="card-head">
            <span class="ic"><Icon name="flame" :size="17" /></span><span class="nm">今日三件事</span><span class="en">TODAY'S FOCUS</span><span class="ds">锁定今日最重要的 3 件事</span>
            <div class="date-nav">
              <div class="dn" @click="shiftDate(-1)">‹</div>
              <div class="dd">{{ formatDate(todayDate) }}</div>
              <div class="dn" @click="shiftDate(1)">›</div>
            </div>
          </div>
          <div class="today-body">
            <div class="today-toolbar">
              <button class="mini-btn" :disabled="focusFull" :title="focusFull ? '今日三件事已满（3/3）' : ''" @click="openPicker(todayFocusList.length)"><Icon name="clipboard" :size="13" />从库选取</button>
              <button class="mini-btn" @click="copyYesterday"><Icon name="copy" :size="13" />复制昨日</button>
              <button class="mini-btn" @click="openExportModal"><Icon name="download" :size="13" />导出</button>
            </div>
            <!-- 满员锁定条 -->
            <div v-if="focusFull" class="lock-bar">⚖ 今日三件事已满 3/3 · 完成或移除一件后可再加入</div>
            <div class="today-cards">
              <template v-for="(slot, idx) in todayFocusList" :key="idx">
                <div v-if="todayTaskForSlot(slot)" class="today-card" :class="{done: slot.done, sel: focusSelIdx===idx}"
                  @click="onFocusCardClick(idx)" @dblclick="drawerRef?.open(todayTaskForSlot(slot)!)">
                  <div class="tc-num">{{ String(idx+1).padStart(2,'0') }}</div>
                  <div class="tc-row">
                    <div class="tc-check" :class="{done: slot.done}" @click.stop="toggleTodayDone(slot)">{{ slot.done?'✓':'' }}</div>
                    <div class="tc-title">{{ slot.text }}</div>
                  </div>
                  <div class="tc-meta">
                    <span class="tag accent">📦 {{ projectName(todayTaskForSlot(slot)?.projectId) }}</span>
                    <span class="tag warn">🎯 {{ metricName(todayTaskForSlot(slot)?.metricId) }}</span>
                    <AssetBadge v-if="taskAssetsOn && todayTaskForSlot(slot)?.assets?.length" :assets="todayTaskForSlot(slot)!.assets" />
                  </div>
                  <div class="tc-remove" @click.stop="removeTodaySlot(idx)" title="移除">×</div>
                </div>
              </template>
              <template v-if="!focusFull">
                <div v-for="n in (FOCUS_LIMIT - todayFocusList.length)" :key="'empty-'+n" class="today-card empty-card" @click="openPicker(todayFocusList.length)">
                  <div class="tc-num">{{ String(todayFocusList.length + n).padStart(2,'0') }}</div>
                  <div class="tc-title empty-t">＋ 从任务库选取</div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- 下 · 项目调度（选中任务联动） -->
      <section class="module right-col">
        <div class="card curation">
          <div class="card-head">
            <span class="ic"><Icon name="target" :size="17" /></span><span class="nm">项目调度</span><span class="en">PROJECT SPOTLIGHT</span>            <span class="ds">选中任务所属项目 · 单击上方任务卡联动</span>
            <button class="mini-btn" title="进入完整方向树全景（查看/编辑方向结构）" @click="router.push('/compass/tree')"><Icon name="branch" :size="13" />方向树</button>
          </div>
          <div v-if="curProject" class="cur-body-v">
            <div class="cur-proj-name">📦 {{ curProject.name }}</div>
            <div class="cur-vision-row">
              <div class="cur-mini" :title="visionText">
                <div class="cur-mini-lab">🔭 愿景 · Vision</div>
                <div class="cur-mini-txt">{{ visionText || '尚未设定愿景' }}</div>
              </div>
              <div class="cur-mini" :title="missionText">
                <div class="cur-mini-lab">💡 使命 · Mission</div>
                <div class="cur-mini-txt">{{ missionText || '尚未设定使命' }}</div>
              </div>
            </div>
            <div class="cur-goal">
              <div class="cur-goal-lab">🎯 战略目标 · STRATEGIC DIRECTION</div>
              <div class="cur-goal-name">{{ goalOf(curProject)?.name || '—' }}</div>
              <div class="cur-goal-meta">
                <span v-if="dirTermLabel(goalOf(curProject))" class="tag">{{ dirTermLabel(goalOf(curProject)) }}</span>
                <span class="cur-goal-pct">项目进度 {{ projectProgress(curProject).pct }}%</span>
                <span class="cur-goal-link" @click="router.push({ path: '/compass/projects', query: { p: curProject.id } })">进入项目详情 ›</span>
              </div>
            </div>
            <div class="cur-stats">
              <div class="cur-stat"><div class="cs-num">{{ projMetrics.length }}</div><div class="cs-lab">成功指标</div></div>
              <div class="cur-stat"><div class="cs-num">{{ projTasks.length }}</div><div class="cs-lab">任务总数</div></div>
              <div class="cur-stat"><div class="cs-num ok">{{ projDoneCount }}</div><div class="cs-lab">已完成</div></div>
              <div class="cur-stat"><div class="cs-num warn">{{ projDoingCount }}</div><div class="cs-lab">进行中</div></div>
            </div>
            <div class="cur-groups">
              <div v-for="grp in metricGroups" :key="grp.key" class="cur-group">
                <div class="cg-head">
                  <span class="cg-name" :class="{none: grp.key==='__none__'}">{{ grp.key==='__none__' ? '🗂 ' + grp.title : '🎯 ' + grp.title }}</span>
                  <span class="cg-count">{{ grp.tasks.length }}</span>
                  <span class="cg-tools">
                    <button class="cg-add" title="关联已有任务到此指标" @click="openLinkPicker(grp.key==='__none__' ? undefined : grp.key)">🔗</button>
                    <button v-if="grp.key!=='__none__'" class="cg-add danger" title="删除此指标（其下任务转为未关联指标，不删任务）" @click="removeMetric(grp.key)">🗑</button>
                    <button class="cg-add" title="在此指标下新建任务" @click="createProjectTask(grp.key==='__none__' ? undefined : grp.key)">＋</button>
                  </span>
                </div>
                <div class="cg-tasks">
                  <div v-for="t in grp.tasks" :key="t.id" class="cg-task" :class="{'is-done': t.status==='done'}" @dblclick="drawerRef?.open(t)" @click="drawerRef?.open(t)">
                    <span class="cg-dot" :class="'st-'+t.status">{{ t.status==='done'?'✓':t.status==='doing'?'◐':'○' }}</span>
                    <span class="cg-t">{{ t.title }}</span>
                    <span class="cg-st">{{ t.status==='done'?'已完成':t.status==='doing'?'进行中':'待开始' }}</span>
                    <button class="cg-del" title="删除任务（进回收站，可撤销）" @click.stop="removeTask(t)">🗑</button>
                  </div>
                  <div v-if="!grp.tasks.length" class="cg-empty">暂无任务</div>
                </div>
              </div>
              <div v-if="!metricGroups.length" class="cg-empty" style="padding:20px">该项目还没有成功指标与任务——下方新增成功指标，或「新建任务」</div>
              <div v-if="addingMetric" class="cur-add-metric">
                <input v-model="newMetricTitle" class="cam-input" placeholder="成功指标名称，回车确认"
                  @keydown.enter.prevent="confirmAddMetric" @keydown.esc="addingMetric=false" />
                <button class="mini-btn primary" @click="confirmAddMetric">确定</button>
              </div>
              <div v-else class="cur-add-metric-link" @click="startAddMetric">＋ 新增成功指标</div>
            </div>
          </div>
          <div v-else class="cur-empty">
            <div class="ce-icon">🧭</div>
            <div class="ce-title">上方三件事尚未指向项目</div>
            <div class="ce-desc">单击任务卡联动项目；若任务还未关联项目，可在任务详情（双击打开）中选择所属项目</div>
          </div>
        </div>
      </section>
    </div>

    <!-- 底部 · 好奇心培育 / 任务调度 -->
    <section class="module">
      <div class="zone-tabs">
        <div class="zone-tab" :class="{active: zone==='curio'}" @click="zone='curio'">
          💡 好奇心培育<span class="zc">{{ curioCount }}</span>
        </div>
        <div class="zone-tab" :class="{active: zone==='task'}" @click="zone='task'">
          📋 任务调度<span class="zc">{{ taskCount }}</span>
        </div>
        <span class="zone-en">CURIOSITY ZONE · 好奇心驱动的方向校准</span>
      </div>
      <CuriosityPanel v-show="zone==='curio'" />
      <TaskManagerPanel v-if="zone==='task'" />
    </section>

    <!-- ===== 任务选取弹窗 ===== -->
    <Transition name="fade">
      <div v-if="pickerOpen" class="overlay" @click="pickerOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="pickerOpen" class="picker-modal">
        <div class="pm-head">
          <span>📋 从任务库选取</span>
          <div class="pm-close" @click="pickerOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="pickerSearch" placeholder="搜索任务..."></div>
          <div v-for="task in pickerCandidates" :key="task.id" class="picker-item"
            :class="{disabled: pickerDisabled(task)}" @click="selectTaskGuarded(task)">
            <div class="pi-check">{{ pickerDisabled(task) ? '—' : '＋' }}</div>
            <div class="pi-info">
              <div class="pi-title">{{ task.title }}</div>
              <div class="pi-meta">
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
                <span class="tag" :class="{ok: task.status==='done'}">{{ task.status==='done'?'✅ 已完成':task.status==='doing'?'◐ 进行中':'○ 待开始' }}</span>
                <span v-if="pickedIds.has(task.id)" class="tag">已选入</span>
              </div>
            </div>
          </div>
          <div v-if="!pickerCandidates.length" class="list-empty">暂无任务</div>
        </div>
      </div>
    </Transition>

    <!-- ===== 关联任务弹窗（项目调度） ===== -->
    <Transition name="fade">
      <div v-if="linkPickerOpen" class="overlay" @click="linkPickerOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="linkPickerOpen" class="picker-modal">
        <div class="pm-head">
          <span>🔗 关联任务到「{{ curProject?.name }}」</span>
          <div class="pm-close" @click="linkPickerOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="linkSearch" placeholder="搜索任务..."></div>
          <div class="ts-label-pm" style="margin-bottom:6px">关联到成功指标</div>
          <select v-model="linkTargetMetric" class="ts-select-pm" style="width:100%;margin-bottom:12px">
            <option value="">（不指定 · 仅挂项目）</option>
            <option v-for="m in projMetrics" :key="m.id" :value="m.id">🎯 {{ m.title }}</option>
          </select>
          <div v-for="task in linkCandidates" :key="task.id" class="picker-item" @click="linkTaskToProject(task)">
            <div class="pi-check">＋</div>
            <div class="pi-info">
              <div class="pi-title">{{ task.title }}</div>
              <div class="pi-meta">
                <span class="tag accent">{{ projectName(task.projectId) }}</span>
                <span class="tag" :class="{ok: task.status==='done'}">{{ task.status==='done'?'✅ 已完成':task.status==='doing'?'◐ 进行中':'○ 待开始' }}</span>
              </div>
            </div>
          </div>
          <div v-if="!linkCandidates.length" class="list-empty">没有可关联的任务（均属本项目或库为空）</div>
        </div>
      </div>
    </Transition>

    <!-- ===== 三件事导出弹窗（时间范围） ===== -->
    <Transition name="fade">
      <div v-if="exportOpen" class="overlay" @click="exportOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="exportOpen" class="picker-modal" style="width:400px">
        <div class="pm-head">
          <span>⬇ 导出三件事任务（CSV）</span>
          <div class="pm-close" @click="exportOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="ts-label-pm">时间范围（按三件事安排日期）</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="date" v-model="exportFrom" class="ts-select-pm" style="flex:1">
            <span style="color:var(--text-3)">→</span>
            <input type="date" v-model="exportTo" class="ts-select-pm" style="flex:1">
          </div>
          <div class="ce-desc" style="margin-top:10px">导出字段：任务内容 / 所属项目 / 项目→成功指标 / 任务状态 / 安排时间 / 创建时间</div>
        </div>
        <div class="modal-footer-row" style="display:flex;gap:8px;padding:14px 20px;border-top:1px solid var(--border);justify-content:flex-end">
          <button class="mini-btn" @click="exportOpen=false">取消</button>
          <button class="mini-btn primary" :disabled="exportBusy" @click="doExport">{{ exportBusy ? "导出中…" : "✓ 导出 CSV" }}</button>
        </div>
      </div>
    </Transition>

    <!-- ===== 今日记录抽屉（R51-F16：右侧滑出） ===== -->
    <Drawer :open="!!recOpen" :title="recOpen ? `${recTitles[recOpen]} · 共 ${recFiltered.length} 条` : ''" width="460px" @close="recOpen = ''">
      <div class="rec-fill">
        <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="recSearch" placeholder="按标题过滤..." @input="recPage=1"></div>
        <div class="rec-list-scroll">
          <div v-for="(x, i) in recSlice" :key="i" class="picker-item" :class="{disabled: !x.clickable}" @click="locateRec(x)">
            <div class="pi-check pi-ghost">{{ kindIcon(x.kind) }}</div>
            <div class="pi-info">
              <div class="pi-title">{{ x.title }}</div>
              <div class="pi-meta"><span class="tag">{{ new Date(x.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span></div>
            </div>
            <span v-if="x.clickable" class="rec-go">定位 ↗</span>
          </div>
          <div v-if="!recFiltered.length" class="list-empty">今天暂无记录</div>
        </div>
        <div v-if="recPageCount > 1" class="pager">
          <button class="mini-btn" :disabled="recPage<=1" @click="recPage--">‹</button>
          <span class="pg-num">{{ recPage }} / {{ recPageCount }}</span>
          <button class="mini-btn" :disabled="recPage>=recPageCount" @click="recPage++">›</button>
        </div>
      </div>
    </Drawer>

    <!-- 任务详情抽屉（共享组件） -->
    <TaskDetailDrawer ref="drawerRef" />
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 48px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-left: 22px; }
.page-head .crumb { font-size: 13px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 19px; letter-spacing: .3px; }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }

/* R50-F2 数据存储状态栏 */
.storage-chip { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text-2); background: var(--surface); border: 1px solid var(--border); padding: 4px 12px; border-radius: 99px; cursor: pointer; transition: border-color .15s; font-family: inherit; }
.storage-chip:hover { border-color: var(--border-strong); }
.storage-chip .sc-dot { width: 7px; height: 7px; border-radius: 99px; background: #2EA043; box-shadow: 0 0 6px rgba(46,160,67,.55); flex-shrink: 0; }
.storage-chip.err { color: #F85149; border-color: color-mix(in srgb, #F85149 45%, var(--border)); }
.storage-chip.err .sc-dot { background: #F85149; box-shadow: 0 0 6px rgba(248,81,73,.55); animation: scBlink 1.2s ease-in-out infinite; }
@keyframes scBlink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

/* 今日记录条（R50-F7：主计数 + 分类型副行） */
.rec-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 16px; }
.rec-cell { display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 16px; background: var(--surface); cursor: pointer; transition: background .12s; }
.rec-cell:hover { background: var(--surface-3); }
.rc-main { display: flex; align-items: center; gap: 9px; }
.rc-ic { font-size: 13px; color: var(--text-3); }
.rc-lab { font-size: 12px; color: var(--text-2); }
.rc-num { margin-left: auto; font-size: 15px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.rc-sub { font-size: 10.5px; color: var(--text-3); padding-left: 22px; font-variant-numeric: tabular-nums; }

/* 左右分栏 */
/* R51-F10：上下联动——三件事在上占视觉焦点，项目调度在下 */
.split { display: flex; flex-direction: column; gap: 14px; margin-bottom: 4px; }
.left-col { min-width: 0; }
.right-col { min-width: 0; }

.module { margin-top: 0; }
.page > .module { margin-top: 22px; }
.card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid rgba(0,0,0,.025); height: 100%; }
.card-head { display: flex; align-items: center; gap: 8px; padding: 16px 20px 10px; flex-wrap: wrap; }
.card-head .ic { font-size: 16px; color: var(--accent); display: flex; align-items: center; }
.card-head .nm { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
.card-head .en { font-size: 9px; color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; }
.card-head .ds { font-size: 11.5px; color: var(--text-3); margin-left: 6px; flex: 1; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn:disabled { opacity: .45; cursor: not-allowed; }
.tag { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; white-space: nowrap; }
.tag.accent { background: var(--accent-light); color: var(--accent); }
.tag.warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.kc-assets { margin-left: 2px; }

/* 今日三件事 */
.date-nav { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.date-nav .dn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); font-size: 14px; }
.date-nav .dn:hover { background: var(--surface-3); }
.date-nav .dd { padding: 0 12px; font-size: 12px; font-weight: 500; border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-width: 128px; text-align: center; }
.today-body { padding: 0 20px 16px; }
.today-toolbar { display: flex; gap: 6px; margin-bottom: 10px; }
.lock-bar { display: flex; align-items: center; justify-content: center; font-size: 11.5px; color: var(--text-3); background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; }
.today-cards { display: grid; grid-template-columns: 1fr; gap: 12px; }
.today-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px 11px; cursor: pointer; transition: all .15s ease; position: relative; display: flex; flex-direction: column; }
.today-card:not(.empty-card) { animation: tcBreathe 4s ease-in-out infinite; }
@keyframes tcBreathe {
  0%,100% { box-shadow: 0 0 0 0 transparent; border-color: var(--border); }
  50% { box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 18%, transparent); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
}
.today-card:hover { border-color: var(--border-strong); background: var(--surface); }
.today-card.sel { border-color: var(--accent); background: var(--accent-light); animation: none; box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 22%, transparent); }
.today-card.done { opacity: .6; animation: none; }
.today-card.done .tc-title { text-decoration: line-through; color: var(--text-3); }
.today-card.empty-card { opacity: .55; border-style: dashed; background: transparent; align-items: center; justify-content: center; }
.today-card.empty-card:hover { opacity: .9; border-color: var(--accent); color: var(--accent); }
.tc-num { position: absolute; top: 10px; right: 12px; font-size: 11px; color: var(--text-3); font-weight: 600; }
.tc-row { display: flex; align-items: flex-start; gap: 8px; }
.tc-check { width: 16px; height: 16px; border-radius: 5px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10px; color: #fff; background: var(--surface); margin-top: 2px; }
.tc-check.done { background: var(--success); border-color: var(--success); }
.tc-title { font-size: 14px; font-weight: 600; line-height: 1.4; flex: 1; }
.tc-title.empty-t { color: var(--text-3); font-weight: 400; }
.tc-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.tc-meta .tag { font-size: 11px; padding: 1px 7px; }
.tc-remove { position: absolute; top: 7px; right: 32px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 13px; color: var(--text-3); cursor: pointer; opacity: 0; transition: all .15s; }
.today-card:hover .tc-remove { opacity: 1; }
.tc-remove:hover { background: var(--danger); color: #fff; }

/* 项目调度（右栏，纵向堆叠） */
.cur-body-v { padding: 0 20px 18px; display: flex; flex-direction: column; gap: 10px; }
.cur-proj-name { font-size: 18px; font-weight: 700; color: var(--text); letter-spacing: .3px; }
.cur-vision-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cur-mini { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 11px; }
.cur-mini-lab { font-size: 9.5px; font-weight: 700; color: var(--text-3); letter-spacing: .8px; margin-bottom: 3px; }
.cur-mini-txt { font-size: 11px; color: var(--text-2); line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cur-goal { background: var(--accent-light); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); border-radius: var(--radius-sm); padding: 12px 14px; }
.cur-goal-lab { font-size: 9.5px; font-weight: 700; color: var(--accent); letter-spacing: 1px; margin-bottom: 4px; }
.cur-goal-name { font-size: 16px; font-weight: 700; color: var(--accent); line-height: 1.4; }
.cur-goal-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.cur-goal-pct { font-size: 11px; color: var(--text-2); }
.cur-goal-link { font-size: 11px; color: var(--accent); cursor: pointer; margin-left: auto; }
.cur-goal-link:hover { text-decoration: underline; }
.cur-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cur-stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 6px; text-align: center; }
.cs-num { font-size: 22px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.cs-num.ok { color: var(--success); }
.cs-num.warn { color: var(--warning, #e67e22); }
.cs-lab { font-size: 10px; color: var(--text-3); margin-top: 2px; }
.cur-groups { display: flex; flex-direction: column; gap: 10px; }
.cur-group { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.cg-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface-3); }
.cg-name { font-size: 12px; font-weight: 700; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-name.none { color: var(--text-3); }
.cg-count { font-size: 10px; color: var(--text-3); background: var(--surface); padding: 1px 8px; border-radius: 99px; }
.cg-add { width: 20px; height: 20px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font-size: 12px; cursor: pointer; line-height: 1; }
.cg-add:hover { border-color: var(--accent); color: var(--accent); }
.cg-tools { display: none; gap: 4px; margin-left: auto; }
.cg-head:hover .cg-tools, .cg-head:focus-within .cg-tools { display: inline-flex; }
.cg-add.danger:hover { border-color: #d46a6a; color: #d46a6a; }
.cg-del { margin-left: auto; width: 20px; height: 20px; border: none; background: transparent; color: var(--text-3); font-size: 11px; cursor: pointer; border-radius: 5px; opacity: 0; flex-shrink: 0; line-height: 1; }
.cg-task:hover .cg-del { opacity: 1; }
.cg-del:hover { color: #d46a6a; background: rgba(212,106,106,.12); }
.cur-add-metric { display: flex; gap: 8px; padding: 10px 12px; }
.cam-input { flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 12.5px; outline: none; background: var(--surface); color: var(--text); font-family: inherit; }
.cam-input:focus { border-color: var(--accent); }
.cur-add-metric-link { margin: 2px 0 0; padding: 7px 10px; font-size: 12px; color: var(--text-3); border: 1px dashed var(--border); border-radius: 8px; cursor: pointer; text-align: center; transition: all .12s; }
.cur-add-metric-link:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.cg-tasks { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 4px; }
.cg-task { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 7px; cursor: pointer; transition: background .12s; }
.cg-task:hover { background: var(--surface); }
.cg-task.is-done .cg-t { text-decoration: line-through; color: var(--text-3); }
.cg-dot { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-3); }
.cg-dot.st-doing { color: var(--tag-warn-text); border-color: var(--tag-warn-text); }
.cg-dot.st-done { background: var(--success); border-color: var(--success); color: #fff; }
.cg-t { font-size: 12.5px; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-st { font-size: 10px; color: var(--text-4); flex-shrink: 0; }
.cg-empty { font-size: 11px; color: var(--text-4); text-align: center; padding: 8px; }
.cur-empty { padding: 34px 20px 38px; text-align: center; }
.ce-icon { font-size: 30px; opacity: .45; margin-bottom: 6px; }
.ce-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
.ce-desc { font-size: 11.5px; color: var(--text-3); margin-bottom: 12px; line-height: 1.7; }

/* 底部专区 Tab */
.zone-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: -6px; padding: 0 4px; }
.zone-tab { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 9px 9px 0 0; font-size: 13px; font-weight: 600; color: var(--text-3); cursor: pointer; transition: all .15s; border: 1px solid transparent; border-bottom: none; user-select: none; }
.zone-tab:hover { color: var(--text-2); }
.zone-tab.active { background: var(--surface); color: var(--accent); border-color: rgba(0,0,0,.025); box-shadow: 0 -1px 4px rgba(0,0,0,.04); }
.zone-tab .zc { font-size: 10px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); font-variant-numeric: tabular-nums; }
.zone-tab.active .zc { background: var(--accent-light); color: var(--accent); }
.zone-en { font-size: 9px; color: var(--text-4); letter-spacing: 1.4px; text-transform: uppercase; margin-left: 8px; }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 200; }
.picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-width: 92vw; max-height: 70vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 201; display: flex; flex-direction: column; overflow: hidden; }
/* R51-F16：记录抽屉右侧滑出——列表撑满、翻页贴底 */
.rec-fill { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.rec-list-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.rec-fill .pager { flex-shrink: 0; margin-top: 10px; }
.pm-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.pm-head span:first-child { flex: 1; }
.pm-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; }
.pm-close:hover { background: var(--surface-3); color: var(--text); }
.pm-body { flex: 1; overflow-y: auto; padding: 14px 20px; }
.picker-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-2); border-radius: 8px; margin-bottom: 6px; cursor: pointer; transition: all .1s; }
.picker-item:hover { background: var(--accent-light); }
.picker-item.disabled { opacity: .55; cursor: default; }
.picker-item.disabled:hover { background: var(--surface-2); }
.pi-check { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.pi-check.pi-ghost { background: var(--surface-3); color: var(--text-2); font-size: 12px; }
.pi-info { flex: 1; min-width: 0; }
.pi-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.pi-meta { display: flex; gap: 5px; flex-wrap: wrap; }
.rec-go { font-size: 10.5px; color: var(--accent); flex-shrink: 0; }
.pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 0 2px; }
.pg-num { font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.search-box { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.search-box:focus-within { border-color: var(--accent); }
.search-box input { border: none; outline: none; font-size: 12px; width: 150px; background: transparent; color: var(--text); font-family: inherit; }
.list-empty { text-align: center; padding: 30px; font-size: 13px; color: var(--text-3); }
.ts-label-pm { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 7px; }
.ts-select-pm { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.modal-enter-active, .modal-leave-active { transition: all .15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.95); }
@media (max-width: 1080px) {
  .rec-strip { grid-template-columns: repeat(2, 1fr); }
}
</style>
