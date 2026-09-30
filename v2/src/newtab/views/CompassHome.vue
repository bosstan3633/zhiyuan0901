<script setup lang="ts">
// R65-F7：KeepAlive 缓存实例名（App.vue router-view include）
defineOptions({ name: 'CompassHomeView' })
// R49（V2.22.0）三大系统页改版：本页 = 调度台（默认首页）
// - 今日记录条（入台/移出/调出/写入记录，点击开抽屉）
// - 左右分栏：左=今日三件事（硬上限 3，自 CompassActions 整体迁入，交互逐项一致）｜右=项目调度面板（单击三件事联动）
// - 底部专区：好奇心培育单区直呈（R55-B2：任务调度迁方向台）
import { ref, computed, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { visibleFields } from '@/shared/utils/fields'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
import { focusRecentDays, focusWindowTotals } from '@/shared/utils/focusHistory'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
import { softDeleteTaskToTrash, unbindTaskFromMetric } from '@/shared/utils/taskLinks'
import { removeMetricWithConfirm } from '@/shared/utils/compassCrud'
import { subscribeSaveError, getLastSaveOkAt, getBytesInUse, hasUnlimitedStorage, saveDataNow, saveUIPrefs } from '@/shared/storage/repository'
import { pendingRows, runSync } from '@/shared/storage/airtable'
import type { SaveError } from '@/shared/storage/repository'
import type { TaskCard, Project, FocusSlot, Direction, Subtask } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity } from '@/shared/utils/maturity'
// R117（04-61 C3）：当日新增角标（自然日口径）——今日三件事卡沿用任务卡的同一枚
import NewBadge from '@/shared/components/NewBadge.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import CuriosityPanel from '../components/compass/CuriosityPanel.vue'
// R117（04-61 C1）：任务调度整体自方向台迁入调度台底部（与好奇心培育并列 tab）
import TaskManagerPanel from '../components/compass/TaskManagerPanel.vue'
import PoolCardsPanel from '../components/compass/PoolCardsPanel.vue'
import MetricBar from '../components/compass/MetricBar.vue'
// R172-T9（04-67 Q7）：调度画像周报浮层**已退役**（组件已物理删除，全仓零引用）——
// 四段式能力并入知源仪表盘的「复盘段」（ReviewPanel.vue），入口由本页右上角 `📈 复盘` 承担。
// 历史包袱顺带清掉：R113-N3 曾因"模板引用但从未 import"导致点按钮无任何反应，该类问题随组件退役消失。

const router = useRouter()
const route = useRoute()
const store = useAppStore()
// R91：解构出主攻相关口径——手册「🚀 主攻（最多 2 个）直通调度台速览」此前在调度台**零消费**。
// R3-B1：方向台的主攻聚焦条随 CompassShell 退役，focusedProjects 的**唯一**消费方就是本页速览。
const { d, allProjects, projectProgress, projectTasksOf, focusedProjects, isProjectStalled, isProjectDone, refreshWce } = useCompass()
// R127：挂载即刷新 WCE 事件缓存（事件日志异步读取一次；computed 同步消费）
onMounted(() => { refreshWce?.() })

const drawerRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)

// ---- 日期工具 ----
function formatDate(dt: Date): string {
  const week = ['周日','周一','周二','周三','周四','周五','周六']
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${week[dt.getDay()]}`
}
function dateStr(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}
// R58-B3 → R129-B7：「今日」边界动态化——页面常开跨零点后口径自动前移。
// 原实现每 30s 推进心跳 ref → todayStart 变脏 → 连带三个整库扫描 computed（todayIn/todayOut/todayCalled）
// 每 30s 全量重算一遍（首屏持续空转）。此处改用一个「精确到次日零点」的定时器翻篇（setDate 归一，DST 安全），
// 其余 30s 里 todayStart 值恒定不动，下游 computed 不再被无谓唤醒。
function midnightOf(ts: number): number { const t = new Date(ts); t.setHours(0, 0, 0, 0); return t.getTime() }
const todayStart = ref(midnightOf(Date.now()))
let midnightTimer = 0
function scheduleMidnightRollover() {
  const now = new Date()
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  midnightTimer = window.setTimeout(() => {
    todayStart.value = midnightOf(Date.now())
    void ensureAutoFocus() /* R169-T3：跨零点后"今天"换了，新的一天该重新推荐一次（内部按 focusAutoDate 幂等） */
    scheduleMidnightRollover()
  }, Math.max(1000, nextMidnight.getTime() - now.getTime()))
}

// ================= 今日记录条（R49-B1） → R172-T9 整体退役 =================
// 四格（今日入台 / 移出 / 调出 / 写入记录）与「今日记录抽屉」全部下线：记录能力等价迁入
// 「知源仪表盘」（日详情按日过滤 + 全量记录抽屉三维筛选 + CSV），入口由本页右上角 `📈 复盘` 承担。
// 保留说明（不删的账）：`todayStart` 仍服务于今日三件事与跨零点翻篇，故心跳逻辑不动。

// ================= 今日三件事（自 CompassActions 迁入，交互 1:1） =================
const todayDate = ref(new Date())
function shiftDate(n: number) { todayDate.value = new Date(todayDate.value.getTime() + n * 86400_000) }
const todayFocusList = computed<FocusSlot[]>(() => {
  const key = dateStr(todayDate.value)
  return (d.value.dailyFocus?.[key] || []).slice(0, 3)
})
const FOCUS_LIMIT = 3
const focusFull = computed(() => todayFocusList.value.length >= FOCUS_LIMIT)
/**
 * R117（04-61 C3）修复「只有 2 件事 · 第 3 件没入口」的黑洞格：
 * 改前模板直接 `v-for` 原始切片 + `v-if="todayTaskForSlot(slot)"`——库里任务被删（或槽位来源不是任务）时
 * 那一格判定为假 ⇒ **整格不渲染**，而 `focusFull` 只看数组长度仍为真 ⇒ 空位兜底 `v-if="!focusFull"` 也不渲染。
 * 结果：3 件里坏 1 件就只剩 2 张卡、没有任何补位入口。
 * 现在：**恒 3 格**（`task` 有值 = 有效任务；`slot` 有值但 `task` 空 = 失效槽；都没有 = 空位），
 * 失效槽显式渲染「任务已失效 · 重新选取」并给入口。
 * ⚠ 格子的 `idx` 一律取**原始槽位下标**：`selectTaskForSlot` 按 `list[idx] = slot` 原位替换，
 *   若按过滤后的下标渲染，「重新选取」会写错槽、覆盖掉其他有效项。
 */
interface FocusCell { idx: number; slot?: FocusSlot; task?: TaskCard }
const focusCells = computed<FocusCell[]>(() => {
  const raw = (d.value.dailyFocus?.[dateStr(todayDate.value)] || []).slice(0, FOCUS_LIMIT)
  const cells: FocusCell[] = raw.map((slot, idx) => {
    const t = todayTaskForSlot(slot)
    return t ? { idx, slot, task: t } : { idx, slot }
  })
  for (let i = cells.length; i < FOCUS_LIMIT; i++) cells.push({ idx: i })
  return cells
})
/** R117（04-61 C3）：失效槽不算占位——点它的「重新选取」即便 3 件已满也放行（原位替换）。
 *  满额且点的是正常格/空位时才沿用原拦截口径。 */
function focusCellAt(slot: number): FocusCell | undefined {
  return focusCells.value.find(c => c.idx === slot)
}

// ================= R169-T3：今日三件事自动推荐（本地先写、AI 只复核顺序） =================
/**
 * 两段式，顺序不能反：
 *  ① **本地**（`shared/utils/focusSuggest`）按主攻项目 / 状态 / 顺延 / 到期出候选与事实句，
 *     当天第一次打开就写进三格 —— 台面不空、零 Key 可用、理由可核对；
 *  ② **AI**（`shared/ai/focusSuggest`）随后跑一次，只在同一批候选里挑轻重、各补一句判词。
 * 为什么不是"AI 直接写三格"：那会让每天第一次打开都烧一次 token 且可能空手回来（无 Key / 超时 / 网络），
 * 用户看到的就是一个空台面 —— 推荐是便利功能，不许因为它挂了就影响主用途。
 * ★边界（AI 不替决策）：`focusAutoDate` 保证一天只自动写一次；用户手工选过的格子（`auto !== true`）
 * 与已勾完成的格子永不覆盖；AI 回来时若用户已经动过手，只更新判词、不重排。
 */
const todayKey = computed(() => dateStr(new Date()))
const localWhy = ref<Record<string, string>>({})
const aiWhy = ref<Record<string, string>>({})
const whyOpen = ref(false)
const whyBadge = ref(false)
const focusAiBusy = ref(false)
function whyOf(slot?: FocusSlot): string {
  const id = slot?.sourceId
  if (!id) return ''
  return aiWhy.value[id] || localWhy.value[id] || ''
}
function whyIsAi(slot?: FocusSlot): boolean {
  return !!slot?.sourceId && !!aiWhy.value[slot.sourceId]
}
const focusHasRec = computed(() => todayFocusList.value.some(s => s.auto === true))
const focusWeekTotals = computed(() => focusWindowTotals(focusRecentDays(d.value, dateStr(todayDate.value), 7)))

async function ensureAutoFocus(): Promise<void> {
  if (!d.value) return /* 数据是异步载入的：onMounted 那一刻 store.data 可能还没到 */
  const key = todayKey.value
  if (d.value.focusMutedDate === key || d.value.focusAutoDate === key) return
  const list = d.value.dailyFocus?.[key] || []
  if (list.length >= FOCUS_LIMIT) { d.value.focusAutoDate = key; return }
  const { suggestFocus, applyFocusOrder } = await import('@/shared/utils/focusSuggest')
  const cands = suggestFocus(d.value, { anchorKey: key, excludeTaskIds: list.map(s => s.sourceId || ''), limit: FOCUS_LIMIT })
  /* ★库里暂时没有可推荐的事 ⇒ **不盖章**，等数据到位再试（watch 会再来一次）。
     一盖就宣布"今天已经推荐过"，而此刻的"没有"多半只是 store.data 还没载入完 ——
     把读盘时序误当成用户的一天，结果这一整天都不会再有推荐。 */
  if (!cands.length) {
    if ((d.value.tasks || []).some(t => !t.deletedAt && t.status !== 'done')) d.value.focusAutoDate = key
    return
  }
  applyFocusOrder(d.value, key, cands.map(c => c.taskId), FOCUS_LIMIT)
  d.value.focusAutoDate = key
  for (const c of cands) localWhy.value[c.taskId] = c.why
  whyBadge.value = true
  store.persist()
  void refineWithAi(key)
}
/**
 * 触发点：`d` 一到位就跑。
 * ★注册位置**必须**在 `todayKey` / `FOCUS_LIMIT` / `ensureAutoFocus` 这些定义之后 ——
 *   原先挂在文件头 `onMounted` 旁边，immediate watch 在 setup 期就调进 `ensureAutoFocus`，
 *   读尚未初始化的 `todayKey`（TDZ）⇒ 抛错被 async 吞成 unhandled rejection，
 *   首屏三格永远是空的而界面上一个字都不说（perf-census A/B 实测抓到：641 vs 640）。
 */
watch(d, (dd) => { if (dd) void ensureAutoFocus() }, { immediate: true })

/** 无界面复核：任何一环不成就安静地留着本地顺序（本地已经写好了，这里只可能改"顺序与判词"） */
async function refineWithAi(key: string): Promise<void> {
  if (focusAiBusy.value) return
  focusAiBusy.value = true
  try {
    const { loadAiConfig, aiReady, aiConfig } = await import('@/shared/ai/config')
    await loadAiConfig()
    if (!aiReady.value) return
    const { rankFocus } = await import('@/shared/ai/focusSuggest')
    const r = await rankFocus(d.value, key, aiConfig.value.depth, { limit: FOCUS_LIMIT })
    if (!r) return
    r.why.forEach((v, id) => { aiWhy.value[id] = v })
    const list = d.value.dailyFocus?.[key] || []
    if (list.some(s => s.auto !== true && !s.done)) return // 用户已定过格 → 只留判词，不动位置
    const { applyFocusOrder } = await import('@/shared/utils/focusSuggest')
    if (applyFocusOrder(d.value, key, r.order, FOCUS_LIMIT).changed) {
      showToast('✦ AI 复核了今日三件事的顺序（你手工选过的格子未动）')
      store.persist()
    }
  } catch { /* 静默回落：网络/Key 问题不许把台面弄空，也不许弹一层错误 */ }
  finally { focusAiBusy.value = false }
}

function toggleWhy(): void {
  whyOpen.value = !whyOpen.value
  if (whyOpen.value) whyBadge.value = false
}
function closeWhy(): void { whyOpen.value = false }
/** 点浮层外任意处收起（捕获阶段：不拦业务点击，只负责"看走了就关"） */
function onDocClickCloseWhy(e: MouseEvent): void {
  if (!whyOpen.value) return
  const t = e.target as HTMLElement | null
  if (t?.closest?.('.focus-why, .focus-why-ico')) return
  closeWhy()
}
/** 换一批：在本地候选池里换下一组三件（仍带荐标），不碰任务卡 */
async function reshuffleFocus(): Promise<void> {
  const key = dateStr(todayDate.value)
  const cur = new Set((d.value.dailyFocus?.[key] || []).filter(s => s.auto === true).map(s => s.sourceId || ''))
  const { suggestFocus, applyFocusOrder } = await import('@/shared/utils/focusSuggest')
  const pool = suggestFocus(d.value, { anchorKey: key, limit: FOCUS_LIMIT * 3 })
  const next = pool.filter(c => !cur.has(c.taskId)).slice(0, FOCUS_LIMIT)
  if (!next.length) { showToast('ℹ 候选池里没有别的了（本地能说出理由的就这些）'); return }
  for (const c of next) localWhy.value[c.taskId] = c.why
  applyFocusOrder(d.value, key, next.map(c => c.taskId), FOCUS_LIMIT)
  store.persist()
  showToast('✦ 已换一批（只改今日计划位，不动任务卡）')
}
function muteFocusToday(): void {
  d.value.focusMutedDate = todayKey.value
  whyOpen.value = false
  store.persist()
  showToast('今天不再自动推荐 · 明天照常')
}
/** 打开中央评审抽屉：AI 排序的"看得见再采纳"通道（与全站其余入口共用同一只弹窗） */
const focusJob = shallowRef<AiJob | null>(null)
watch(focusJob, (j) => {
  if (!j) return
  const base = j.apply!
  j.apply = (rows: AiRow[]): string | Promise<string> => {
    const out = base(rows)
    const after = (t: string) => { localWhy.value = { ...localWhy.value }; return t }
    if (out instanceof Promise) return out.then(after)
    return after(out)
  }
})
async function openFocusReview(): Promise<void> {
  const key = dateStr(todayDate.value)
  const { loadAiConfig, aiReady, aiConfig } = await import('@/shared/ai/config')
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  const { buildFocusSuggestJob } = await import('@/shared/ai/focusSuggest')
  const j = buildFocusSuggestJob({ d: d.value, depth: aiConfig.value.depth, persist: () => store.persist(), anchorKey: key, limit: FOCUS_LIMIT })
  if (!j) { showToast('⚠ 本地候选池是空的（任务库没有可推荐的未完成事项）'); return }
  closeWhy()
  focusJob.value = j
}
function openCellTask(c: FocusCell) {
  if (c.task) drawerRef.value?.open(c.task)
}
/**
 * R94（B3）：三件事**全完成** —— 给一个**安静**的收束。
 * 改前勾完第三件与勾之前在视觉上毫无差别，"今天做完了"这件事页面一个字都没说。
 * 判据：**至少有一件**（空列表不算"完成"）且**全部 done**。
 * ⚠ 按提案要求：不用庆祝动画、不用红色、不用进度百分比（产品原则：状态可见但不焦虑）。
 */
const focusAllDone = computed(() =>
  todayFocusList.value.length > 0 && todayFocusList.value.every(s => s.done))
function todayTaskForSlot(slot: FocusSlot): TaskCard | null {
  if (slot.sourceType === 'task' && slot.sourceId) {
    return d.value.tasks.find(t => !t.deletedAt && t.id === slot.sourceId) || null
  }
  return null
}
/** R2-①：槽内子任务视口——固定可见 5 行（超出滚动），底部渐隐 + 「还有 N 项」随滚动收敛 */
const SUB_VISIBLE_ROWS = 5
const subScrolled = ref<Record<number, boolean>>({})
function onSubScroll(idx: number, e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) subScrolled.value[idx] = true
}
function subScrollAt(idx: number): boolean { return !!subScrolled.value[idx] }
function subMoreCount(t?: TaskCard | null): number {
  const n = t?.subtasks?.length || 0
  return Math.max(0, n - SUB_VISIBLE_ROWS)
}
/** 槽内子任务勾选：落 doneAt（R172-T2 推进维度同口径），随父卡持久化 */
function toggleSlotSub(t: TaskCard, subId: string) {
  t.subtasks = (t.subtasks || []).map(s => (s.id === subId ? { ...s, done: !s.done, doneAt: !s.done ? Date.now() : undefined } : s))
  t.updatedAt = Date.now()
  store.persist()
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
// R113-N6：按项目筛选（用户反馈：任务库只有关键词搜索，任务一多只能逐条翻）
// 取值：'' = 全部项目；'__none__' = 未关联项目；其余 = project.id
const pickerProject = ref('')
function openPicker(slot: number) {
  const c = focusCellAt(slot)
  const isStale = !!c?.slot && !c?.task
  // R117（04-61 C3）：失效槽不算占位——点它的「重新选取」即便 3 件已满也放行（原位替换）；
  // 满额 + 点正常格/空位时才按原口径拦截（3 件有效任务不能再加第 4 件）。
  if (focusFull.value && !isStale) { showToast('⚖ 今日三件事已满（3/3）——先完成或移除一件'); return }
  pickerSlot.value = Math.min(slot, FOCUS_LIMIT - 1)
  pickerSearch.value = ''
  pickerProject.value = '' // R113-N6：每次打开复位为「全部项目」
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
  const pj = pickerProject.value
  return d.value.tasks
    .filter(t => !t.deletedAt)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    // R113-N6：项目维度过滤（与关键词可叠加）
    .filter(t => !pj || (pj === '__none__' ? !t.projectId : t.projectId === pj))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) // 置顶优先
    .slice(0, 30)
})
/** R113-N6：项目下拉选项（只列"有未删任务"的项目，带任务数；另给未关联计数） */
const pickerProjectOptions = computed(() => {
  const counts = new Map<string, number>()
  let none = 0
  for (const t of d.value.tasks) {
    if (t.deletedAt) continue
    if (t.projectId) counts.set(t.projectId, (counts.get(t.projectId) || 0) + 1)
    else none++
  }
  const opts = allProjects().filter(p => counts.has(p.id)).map(p => ({ id: p.id, name: p.name, n: counts.get(p.id) || 0 }))
  return { opts, none }
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

// ================= R2-②：项目调度卡退役 =================
// 指标结构管理归方向台（ProjectCuration 展板 metric-head2 ＋/🗑/AI 与完整方向树指标行齐全，
// R169-16「全站唯一指标结构管理面」语义由二者承接）；「描述｜子任务」双栏由三件事槽内子任务
// 视口（R2-①）承接；单击三件事联动右栏的联动语义随 DeckTabs 单页化退役。
// 退役的机制：项目归属链、四事实统计、指标分组树、分栏拖拽、下钻弹窗、描述子任务双栏——一并退役
// 各类选中/分栏/联动/树编辑机制（连同其函数名）一并退役
// 各类分组/树编辑/关联/下钻/统计与任务删改机制（连同其函数名）一并退役

// ---- Ctrl+←/→ 切换三件事日期（非输入焦点时） ----
function onDateKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); shiftDate(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
}
// R67-F4：浏览器快捷键模块直达（curiosity=好奇心培养 / project=任务调度）——滚动定位 + 高亮闪烁
/**
 * R117（04-61 C1 拍板）：底部改为 **任务调度 / 好奇心培育** 双 tab，**默认任务调度**。
 * - 取代 R105-B4 的「好奇心默认折叠为一行摘要」——本轮用户明确要求把任务调度整体搬进调度台
 *   并与其并列，故按新拍板执行（旧降权策略退役）；
 * - 好奇心面板**懒挂载**（首次切到该 tab 才挂载）——保住首屏冷启动成本；
 * - `?hl=` 定位到好奇心卡时自动切 tab 并挂载（否则消费者不在 DOM 里，定位会落空）。
 */
const bottomTab = ref<'pool' | 'task' | 'curio'>('pool')
const curioMounted = ref(false)
watch(bottomTab, (t) => { if (t === 'curio') curioMounted.value = true })
/** 底部 tab 计数徽标：任务调度 = 未删除任务数 · 好奇心培育 = 未删除好奇心数 */
const poolLiveCount = computed(() => (d.value.resources || []).filter(r => !r.deletedAt && r.workspaceId === 'zy-curation').length)
const taskLiveCount = computed(() => (d.value.tasks || []).filter(t => !t.deletedAt).length)
const curioLiveCount = computed(() => (d.value.curiosities || []).filter(c => !c.deletedAt).length)
// R117（04-61 B）：`?hl` 带 `?hk` 时把对应面板切到前台——任务卡与好奇卡消费者同页，靠 hk 分派
watch(() => route.query.hl, (hl) => {
  if (!hl) return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk === 'curio') { bottomTab.value = 'curio'; curioMounted.value = true }
  else if (hk === 'task') bottomTab.value = 'task'
  else if (hk === 'res') bottomTab.value = 'pool'
}, { immediate: true })
// R117（04-61 C1）：`?bottom=task|curio` 直达底部 tab——原 `?zone=task`（方向台任务调度模块）随模块搬迁退役，
// 新建任务后跳转（GlobalPopups）等场景改由本页底部 tab 承接。
watch(() => route.query.bottom, (b) => {
  if (b === 'curio') { bottomTab.value = 'curio'; curioMounted.value = true }
  else if (b === 'task') bottomTab.value = 'task'
  else if (b === 'pool') bottomTab.value = 'pool'
}, { immediate: true })

function gotoAnchor(name: string) {
  // R117（04-61 C1）：底部改为「任务调度 / 好奇心培育」双 tab 同宿一节 ⇒ 'task' 为新增锚点
  // （goto-tasks 浏览器命令随任务调度一并落到调度台）；节 id 沿用 zy-mod-curiosity，不改名以免破坏既有锚点契约。
  const id = (name === 'curiosity' || name === 'task') ? 'zy-mod-curiosity' : name === 'project' ? 'zy-mod-tasks' : ''
  if (!id) return
  // 直达锚点 = 先切到对应 tab 并确保已挂载（好奇心懒挂载，不切则消费者不在 DOM）
  if (name === 'curiosity') { bottomTab.value = 'curio'; curioMounted.value = true }
  else if (name === 'task') bottomTab.value = 'task'
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.remove('anchor-flash')
  requestAnimationFrame(() => el.classList.add('anchor-flash'))
  setTimeout(() => el.classList.remove('anchor-flash'), 2400)
}
function onAnchorEvt(e: Event) { gotoAnchor(String((e as CustomEvent).detail || '')) }
onMounted(() => {
  document.addEventListener('keydown', onDateKey, true)
  document.addEventListener('click', onDocClickCloseWhy, true)
  window.addEventListener('zy-goto-anchor', onAnchorEvt)
  // R172-T9：`loadEventLog()` 随记录族退役 —— 本页不再需要事件日志（仪表盘自取）
  saveErrSub = subscribeSaveError(e => { saveErr.value = e })
  lastOkTick.value = getLastSaveOkAt()
  storageTimer = window.setInterval(() => {
    lastOkTick.value = getLastSaveOkAt()
  }, 30000)
  scheduleMidnightRollover()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDateKey, true)
  document.removeEventListener('click', onDocClickCloseWhy, true)
  window.removeEventListener('zy-goto-anchor', onAnchorEvt)
  if (saveErrSub) saveErrSub()
  if (storageTimer) clearInterval(storageTimer)
  if (midnightTimer) clearTimeout(midnightTimer)
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
    ? `本机存储正常 · ${timeAgo(lastOkTick.value)}`
    : '本机存储正常')
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚写入'
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

// ================= Airtable 同步状态卡（R63-9） =================
const atSync = computed(() => store.data?.airtableSync)
const atConfigured = computed(() => !!(atSync.value?.pat && atSync.value?.baseId && atSync.value?.tableId))
const atSyncErr = computed(() => atSync.value?.lastError || '')
const atPending = computed(() => {
  if (!atConfigured.value) return 0
  return pendingRows(store.data!).rows.length
})
const atChipText = computed(() => {
  const s = atSync.value
  if (!atConfigured.value) return '⇄ 未配置同步'
  if (atSyncErr.value) return '⇄ 同步出错'
  if (!s?.lastSyncAt) return `⇄ 待同步 ${atPending.value}`
  const ago = Date.now() - s.lastSyncAt
  const agoText = ago < 3600_000 ? Math.max(1, Math.round(ago / 60000)) + ' 分钟前' : ago < 86400_000 ? Math.round(ago / 3600_000) + ' 小时前' : Math.round(ago / 86400_000) + ' 天前'
  return `⇄ ${agoText}同步${atPending.value ? ` · 待推 ${atPending.value}` : ''}`
})
const atChipTitle = computed(() => {
  const s = atSync.value
  if (!atConfigured.value) return '点击完成 Airtable 连接配置'
  const parts = ['点击立即同步到 Airtable']
  if (s?.lastSyncedCount != null) parts.push(`上次推送 ${s.lastSyncedCount} 条`)
  if (s?.lastSyncCalls != null) parts.push(`调用 ${s.lastSyncCalls} 次`)
  return parts.join(' · ')
})
let atSyncing = false
async function onSyncChipClick() {
  // R64-F5：出错态点击 → 直落设置同步分区归因（日志含具体原因），不再盲目重试
  if (!atConfigured.value || atSyncErr.value) { router.push('/settings?page=airtable'); return }
  if (atSyncing) return
  atSyncing = true
  try {
    const r = await runSync(store.data!)
    store.persist()
    showToast(`✓ 已同步到 Airtable：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    showToast('✗ 同步失败：' + (e instanceof Error ? e.message : String(e)))
  } finally { atSyncing = false }
}

// R51-F10：恢复上下联动布局——三件事居上（视觉焦点），项目调度联动在下；原左右分栏拖拽移除

// ================= R91：主攻速览条（手册「直通调度台速览」的落点） =================
/**
 * R83 性能红线：`projectProgress` / `isProjectStalled` / `projectTasksOf` 内部都要遍历 `d.tasks`，
 * 在模板里对每个主攻各调一次就是 O(主攻数 × 任务数) 每次重渲染。故**预计算成索引**
 * （与 R83 的 `projMeta`、R86 的 `projState` 同款）。主攻上限 2 个，成本可忽略。
 */
const focusMeta = computed(() => {
  const m = new Map<string, { pct: number; stall: boolean; finished: boolean; open: number }>()
  for (const p of focusedProjects.value) {
    const open = projectTasksOf(p.id).filter(t => !t.deletedAt && t.status !== 'done').length
    m.set(p.id, { pct: projectProgress(p).pct, stall: isProjectStalled(p), finished: isProjectDone(p), open })
  }
  return m
})
/** 主攻速览点项目 = 进项目详情页（方向台一级现为完整方向树，树里的项目走 ▾ 菜单「进入项目详情页」同一条路由） */
function openFocusProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}

// ================= 底部专区（R55-B2：任务调度已迁方向台，好奇心培育单区直呈） =================
// ===== R172-T9：调度画像周报浮层退役，入口改为「📈 复盘」直达知源仪表盘 =====
/** 04-67 F34：点击执行 `router.push('/settings?page=dashboard')`（文案精确为 `📈 复盘`） */
function openReview(): void { void router.push('/settings?page=dashboard') }
const curioCount = computed(() => (d.value.curiosities || []).filter(c => !c.deletedAt).length)
</script>

<template>
  <div class="page">
    <!-- R175（原型 1:1）：独立页头行并入合流状态条 —— 原型首行即 ≤38px 通栏条，无 crumb 行。
         存储指示（R50-F2）与 Airtable 同步（R63-9）两 chip 原位移入 MetricBar 右槽，
         点击语义（查看用量/重试写入/立即同步/⚙ 进设置）一字未动。 -->
    <MetricBar>
      <template #left>
        <span class="cf-label" title="当前战略重心（最多 2 个）">🚀 主攻</span>
        <template v-if="focusedProjects.length">
          <span v-for="p in focusedProjects" :key="p.id" class="cf-item" :class="{ done: focusMeta.get(p.id)?.finished }"
            :title="p.name + ' · 点击进入项目详情'" @click="openFocusProject(p)">
            <span class="cf-name">{{ p.name }}</span>
            <span class="cf-pct">{{ focusMeta.get(p.id)?.pct || 0 }}%</span>
            <span v-if="focusMeta.get(p.id)?.stall" class="cf-stall" title="近 14 天无推进">⚠ 停滞</span>
          </span>
        </template>
        <span v-else class="cf-hint" title="去方向台指定主攻项目" @click="router.push('/compass')">尚无主攻 · 去方向台指定</span>
      </template>
      <template #right>
        <!-- R172-T9（04-67 F33/F34）：旧「四格记录条 + 周报按钮」整体下线 ——
             改为单一入口「📈 复盘」直达知源仪表盘；被删的四类记录能力在仪表盘内完整可用
             （日详情按日过滤 + 全量记录抽屉三维筛选 + CSV）。
             R175：存储/同步两 chip 自页头移入本槽（原型：状态指示与动作同排右对齐）。 -->
        <button class="storage-chip" :class="{ err: !storageOk }" :title="storageOk ? '点击查看存储用量' : '点击重试写入'" @click="onStorageClick">
          <span class="sc-dot" />
          <span>{{ storageText }}</span>
        </button>
        <button class="sync-chip" :class="{ on: atConfigured, err: !!atSyncErr }" :title="atChipTitle" @click="onSyncChipClick">
          <span class="sc-dot" />
          <span>{{ atChipText }}</span>
          <span class="sync-gear" title="Airtable 同步设置" @click.stop="router.push('/settings?page=airtable')">⚙</span>
        </button>
        <button class="mb-act cta" title="复盘 · 年度热力图与四范围复盘 · 直达知源仪表盘" @click="openReview">📈 复盘</button>
      </template>
    </MetricBar>

    <!-- R2-②：上下联动 split 容器随项目调度卡退役——三件事直挂页容器 -->
    <section class="module">
        <div class="card focus" :class="{ 'all-done': focusAllDone }">
          <div class="card-head">
            <span class="ic"><Icon name="flame" :size="18" /></span><span class="nm">今日三件事</span><span class="en">TODAY'S FOCUS</span>
            <button class="mini-btn" @click="copyYesterday"><Icon name="copy" :size="13" />复制昨日</button>
            <button class="mini-btn" @click="openExportModal"><Icon name="download" :size="13" />导出</button>
            <div class="date-nav">
              <div class="dn" @click="shiftDate(-1)">‹</div>
              <div class="dd">{{ formatDate(todayDate) }}</div>
              <div class="dn" @click="shiftDate(1)">›</div>
            </div>
            <!-- R169-T3：右上角一枚小图标 = "为什么是这三件"（点开浮层逐格讲依据，不占台面高度） -->
            <button class="focus-why-ico" :class="{ on: whyOpen }" data-testid="focus-why-ico"
              title="为什么推荐这三件" aria-label="为什么推荐这三件" @click.stop="toggleWhy()">
              <AiEntryButton variant="icon" :spin="focusAiBusy" /><span v-if="whyBadge && focusHasRec" class="fwb"></span>
            </button>
            <div v-if="whyOpen" class="focus-why" data-testid="focus-why" @click.stop>
              <div class="fw-h">为什么是这三件<span class="hint">{{ focusAiBusy ? ' · AI 复核中…' : '' }}</span></div>
              <div v-for="c in focusCells" :key="'w' + c.idx" class="fw-row">
                <span class="n">{{ String(c.idx + 1).padStart(2, '0') }}</span>
                <div class="b">
                  <template v-if="c.task">
                    <div class="t">{{ c.slot?.text }}</div>
                    <div class="w">
                      <template v-if="c.slot?.auto === true">{{ whyOf(c.slot) || '本地依据：主攻项目下未开始的直接产出项' }}<span v-if="whyIsAi(c.slot)" class="ai-tag"> · AI 判词</span></template>
                      <template v-else>这一格是你自己选的，系统不评价、也不会覆盖。</template>
                    </div>
                  </template>
                  <template v-else>
                    <div class="t off">空着</div>
                    <div class="w">点这一格从任务库选，或点下面「换一批」。</div>
                  </template>
                </div>
              </div>
              <div class="fw-f">
                过去 7 天完成 <b>{{ focusWeekTotals.done }}/{{ focusWeekTotals.planned }}</b>（按三件事格子计）<br>
                推荐只写"今天这一天的计划位"，<b>不改任务卡、不改状态、不改归属</b>；你动过的格子系统不再插手。
              </div>
              <div class="fw-acts">
                <button class="mini-btn" data-testid="focus-reshuffle" @click="reshuffleFocus">换一批</button>
                <button class="mini-btn" data-testid="focus-review" :disabled="focusAiBusy" @click="openFocusReview">让 AI 复核顺序</button>
                <button class="mini-btn" data-testid="focus-mute" @click="muteFocusToday">今天别自动推荐</button>
              </div>
            </div>
          </div>
          <div class="today-body">
            <!-- R53-C1：「从库选取」按钮移除——空槽「＋ 从任务库选取」即入口；复制昨日/导出移至卡片头部 -->
            <div class="today-cards">
              <!-- R117（04-61 C3）：恒 3 格渲染（见 focusCells 注释）——失效槽不再静默消失 -->
              <template v-for="c in focusCells" :key="c.idx">
                <div v-if="c.task" class="today-card" :class="{done: c.slot?.done, sel: focusSelIdx===c.idx}"
                  @click="onFocusCardClick(c.idx)" @dblclick="openCellTask(c)">
                  <div class="tc-num">{{ String(c.idx+1).padStart(2,'0') }}</div>
                  <div class="tc-row">
                    <div class="tc-check" :class="{done: c.slot?.done}" @click.stop="c.slot && toggleTodayDone(c.slot)">{{ c.slot?.done?'✓':'' }}</div>
                    <div class="tc-title"><NewBadge :at="c.task.createdAt" />{{ c.slot?.text }}</div>
                  </div>
                  <div class="tc-meta">
                    <span class="tag neutral">📦 {{ projectName(c.task.projectId) }}</span>
                    <span class="tag neutral">🎯 {{ metricName(c.task.metricId) }}</span>
                    <AssetBadge v-if="taskAssetsOn && c.task.assets?.length" :assets="c.task.assets" />
                    <MaturityBadge :m="taskMaturity(c.task)" />
                    <span v-if="c.slot?.auto === true" class="tag rec" data-testid="focus-rec" title="系统推荐写入的一格 · 点右上角 ✦ 看依据">✦ 荐</span>
                  </div>
                  <!-- R2-①：槽内子任务视口（固定 5 行 + 底部渐隐 + 「还有 N 项」+ 滚动监听）
                       ——「描述｜子任务」双栏（项目调度卡 R2 退役）的执行细节由槽内承接；
                       勾选 = 完成切换（doneAt 同 R172-T2 口径）、点文字 = 进任务详情抽屉。 -->
                  <div v-if="c.task.subtasks?.length" class="tc-subs" :class="{ 'at-end': subScrollAt(c.idx) }"
                    @scroll.passive="onSubScroll(c.idx, $event)">
                    <div v-for="st in (c.task.subtasks || [])" :key="st.id" class="tc-sub" :class="{ done: st.done }"
                      :title="st.done ? '点方框取消完成' : '点方框标记完成 · 点文字进任务详情'" @click="openCellTask(c)">
                      <span class="tsub-check" @click.stop="toggleSlotSub(c.task, st.id)">{{ st.done ? '✓' : '' }}</span>
                      <span class="tsub-t">{{ st.title }}</span>
                    </div>
                  </div>
                  <div v-if="subMoreCount(c.task) > 0 && !subScrollAt(c.idx)" class="tc-sub-more" @click.stop="openCellTask(c)">
                    还有 {{ subMoreCount(c.task) }} 项 · 进详情查看
                  </div>
                  <div class="tc-remove" @click.stop="removeTodaySlot(c.idx)" title="移除">×</div>
                </div>
                <!-- 失效槽（原任务已删除/已不在库）：显式给格 + 原位重新选取入口 -->
                <div v-else-if="c.slot" class="today-card stale-card" @click="openPicker(c.idx)" title="原任务已删除或归档 · 点击重新选取">
                  <div class="tc-num">{{ String(c.idx+1).padStart(2,'0') }}</div>
                  <div class="tc-title empty-t">⚠ 任务已失效 · 重新选取</div>
                  <div class="tc-meta"><span class="tag warn">原任务已删除</span></div>
                  <div class="tc-remove" @click.stop="removeTodaySlot(c.idx)" title="移除">×</div>
                </div>
                <div v-else class="today-card empty-card" @click="openPicker(c.idx)">
                  <div class="tc-num">{{ String(c.idx+1).padStart(2,'0') }}</div>
                  <div class="tc-title empty-t">＋ 从任务库选取</div>
                </div>
              </template>
            </div>
            <!-- R94（B3）：全完成的**安静**收束——一行中性小字（整块去饱和由 .all-done 承担）。
                 不用庆祝动画、不用红色、不用进度百分比。 -->
            <div v-if="focusAllDone" class="td-done">✓ 今日三件事已闭环 · 专注带来从容</div>
          </div>
        </div>
      </section>

    <!-- 底部 · 任务调度 / 好奇心培育（R117 C1 拍板：任务调度整体自方向台迁入，与好奇心培育并列 tab，
         默认任务调度；取代 R55-B2「任务调度在方向台」与 R105-B4「好奇心默认折叠摘要」两条旧策略）
         R67-F4：id 供快捷键直达锚点 -->
    <section id="zy-mod-curiosity" class="module">
      <!-- R2-③：DeckTabs 三张卡（资源卡池 / 任务调度 / 好奇心培育）——资源台退役后池管理在此补位 -->
      <div class="bottom-tabs">
        <button class="bt-tab" :class="{ on: bottomTab === 'pool' }" @click="bottomTab = 'pool'">
          <Icon name="layout" :size="14" />资源卡池<span class="bt-cnt">{{ poolLiveCount }}</span>
        </button>
        <button class="bt-tab" :class="{ on: bottomTab === 'task' }" @click="bottomTab = 'task'">
          <Icon name="clipboard" :size="14" />任务调度<span class="bt-cnt">{{ taskLiveCount }}</span>
        </button>
        <button class="bt-tab" :class="{ on: bottomTab === 'curio' }" @click="bottomTab = 'curio'">
          <Icon name="bulb" :size="14" />好奇心培育<span class="bt-cnt">{{ curioLiveCount }}</span>
        </button>
      </div>
      <!-- 资源卡池：默认 tab，常驻挂载（R179 池语义的管理面补位） -->
      <div v-show="bottomTab === 'pool'" class="bottom-pane">
        <PoolCardsPanel />
      </div>
      <!-- 任务调度：常驻挂载 -->
      <div v-show="bottomTab === 'task'" class="bottom-pane">
        <TaskManagerPanel />
      </div>
      <!-- 好奇心培育：懒挂载（首次切到该 tab 才挂载）——保住首屏冷启动成本 -->
      <div v-show="bottomTab === 'curio'" class="bottom-pane">
        <CuriosityPanel v-if="curioMounted" />
      </div>
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
          <!-- R113-N6：关键词 + 项目 两维筛选可叠加 -->
          <div class="pm-filters">
            <div class="search-box" style="margin:0"><span>🔍</span><input v-model="pickerSearch" placeholder="搜索任务..."></div>
            <select v-model="pickerProject" class="pm-proj" title="按项目筛选任务">
              <option value="">全部项目</option>
              <option value="__none__">未关联项目（{{ pickerProjectOptions.none }}）</option>
              <option v-for="o in pickerProjectOptions.opts" :key="o.id" :value="o.id">{{ o.name }}（{{ o.n }}）</option>
            </select>
          </div>
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

    <!-- R172-T9：今日记录抽屉已下线 —— 记录能力迁入知源仪表盘
         （日详情按日过滤 + `DashboardLogDrawer` 全量三维筛选 + CSV；见本页右上角 `📈 复盘`）。 -->

    <!-- 任务详情抽屉（共享组件） -->
    <TaskDetailDrawer ref="drawerRef" />
    <!-- R169-T3：AI 复核今日三件事 → 走全站唯一的中央评审弹窗（不建第二套对照壳） -->
    <AiDrawer v-if="focusJob" :job="focusJob" @close="focusJob = null" />
  </div>
</template>

<style scoped>
/* R175（原型 1:1）：主视域 1440 + 18px 顶距 + 72px 收尾（原型 padding: 18px 36px 0 + body 72px 的等价落法）；
   左右 36px 与顶栏 align-page 同一条垂直基准线不变。⚠ 其余三页仍 20px 顶距，R21-3/R123-3/R125-1 已随本值重指带备案。 */
.page { max-width: 1440px; margin: 0 auto; padding: 18px 36px 72px; }
/* R175：page-head 行随「页头并入合流状态条」退役——存储/同步 chip 移入 MetricBar 右槽，页面身份由顶栏活动页签承担 */

/* R50-F2 数据存储状态栏 ｜ R175（原型）：默认态改无框轻量指示（绿点+文本），异常态保留红点闪烁与点击重试；
   原有两处硬编码色值一并归位 var(--success)/var(--danger)（红线 3：零硬编码色值） */
.storage-chip { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-caption); color: var(--text-3); background: transparent; border: 1px solid transparent; padding: 3px 4px; border-radius: var(--radius-xs); cursor: pointer; transition: border-color var(--dur), background var(--dur); font-family: inherit; }
.storage-chip:hover { background: var(--surface-2); }
.storage-chip .sc-dot { width: 6px; height: 6px; border-radius: 99px; background: var(--success); box-shadow: 0 0 6px color-mix(in srgb, var(--success) 55%, transparent); flex-shrink: 0; }
.storage-chip.err { color: var(--danger); }
.storage-chip.err .sc-dot { background: var(--danger); box-shadow: 0 0 6px color-mix(in srgb, var(--danger) 55%, transparent); animation: scBlink 1.2s ease-in-out infinite; }
@keyframes scBlink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

/* R63-9：Airtable 同步状态卡 ｜ R175（原型）：改次级行内 chip 形态（sub-action-btn 同款），三态与 ⚙ 语义不变 */
.sync-chip { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-caption); color: var(--text-2); background: var(--surface-2); border: 1px solid var(--border); padding: 3px 8px; border-radius: var(--radius-xs); cursor: pointer; transition: border-color var(--dur), background var(--dur); font-family: inherit; }
.sync-chip:hover { border-color: var(--border-strong); background: var(--surface-3); }
.sync-chip .sc-dot { width: 6px; height: 6px; border-radius: 99px; background: var(--text-4); flex-shrink: 0; }
.sync-chip.on .sc-dot { background: var(--success); box-shadow: 0 0 6px color-mix(in srgb, var(--success) 55%, transparent); }
.sync-chip.err { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
.sync-chip.err .sc-dot { background: var(--danger); box-shadow: 0 0 6px color-mix(in srgb, var(--danger) 55%, transparent); animation: scBlink 1.2s ease-in-out infinite; }
.sync-chip .sync-gear { font-size: var(--fs-caption); opacity: .55; padding: 0 2px; }
.sync-chip .sync-gear:hover { opacity: 1; }

/* R172-T9：今日记录 4 计数迷你条随入口整合退役 —— 记录能力迁入知源仪表盘 */
/* R120-TB1：条内动作按钮 ｜ R175（原型）：改次级 chip 形态（11px + hairline + xs 圆角）；
   「📈 复盘」保留强调态（全站单一复盘入口的视觉锚点，原型以中性 chip 表达周报、语义不同） */
.mb-act { flex-shrink: 0; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); font-size: var(--fs-caption); padding: 3px 9px; border-radius: var(--radius-xs); cursor: pointer; font-family: inherit; transition: all var(--dur-fast); }
.mb-act:hover { border-color: var(--border-strong); background: var(--surface-3); color: var(--text); }
.mb-act.cta { border-color: var(--accent); color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }

/* R120-TB1：合流方向条内元素（主攻 / 去方向台）——单行 ≤40px，全 tokens */
/* R175（原型）：主攻标签改强调胶囊（accent-light 底 + xs 圆角） */
.cf-label { flex-shrink: 0; font-size: var(--fs-caption); font-weight: 600; color: var(--accent-ink); background: var(--accent-light); padding: 2.5px 8px; border-radius: var(--radius-xs); }
.cf-item { display: flex; align-items: center; gap: 5px; flex-shrink: 0; max-width: 260px; font-size: var(--fs-sub); font-weight: 500; color: var(--text); cursor: pointer; }
.cf-item:hover .cf-name { text-decoration: underline; }
.cf-item.done { opacity: .55; }
.cf-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-pct { flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-2); font-variant-numeric: tabular-nums; }
/* R91 口径保留：14 天无推进亮 ⚠ 停滞；待办数为 10px 轻量标记 */
.cf-stall { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--warning); }
.cf-hint { font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-hint:hover { color: var(--accent); }
.cf-go { flex-shrink: 0; font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; }
.cf-go:hover { color: var(--accent); }

/* R105（B4）：好奇心培育折叠摘要行——呼应 ModuleCard 的视觉语言（surface 底 + 发丝边） */
/* R120-TB4：底部胶囊 Tab（对齐原型：pill 形态 + 中性选中态；计数为轻量 pill） */
.bottom-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.bt-tab { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-body); font-weight: 600; border-radius: 99px; padding: 5px 14px; cursor: pointer; font-family: inherit; transition: all .13s; }
.bt-tab:hover { border-color: var(--border-strong); color: var(--text); }
/* R175（原型 seg-pill）：选中态改深色实心胶囊（text 前景反转 bg，六主题自适应；R120-9 判据随迁） */
.bt-tab.on { border-color: var(--text); background: var(--text); color: var(--bg); }
.bt-cnt { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); background: var(--surface-2); border-radius: 99px; padding: 0 7px; line-height: 17px; }
.bt-tab.on .bt-cnt { color: var(--bg); background: transparent; opacity: .75; }
.bottom-pane { min-height: 120px; }
.module { margin-top: 0; }
/* R67-F4：快捷键直达模块的高亮闪烁（滚动定位后 2.2s 渐隐） */
.module.anchor-flash { animation: zyAnchorFlash 2.2s ease; }
@keyframes zyAnchorFlash {
  0%, 55% { box-shadow: 0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 32%, transparent); }
  100% { box-shadow: none; }
}
.page > .module { margin-top: 14px; }
.card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-sm); border: 1px solid var(--border); height: 100%; }
.card-head { display: flex; align-items: center; gap: 8px; padding: 10px 20px 6px; flex-wrap: wrap; }
.card-head .ic { font-size: 16px; color: var(--accent); display: flex; align-items: center; }
.card-head .nm { font-size: var(--fs-title); font-weight: 600; letter-spacing: .3px; }
.card-head .en { font-size: var(--fs-micro); color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; }
.card-head .ds { font-size: var(--fs-sub); color: var(--text-3); margin-left: 6px; flex: 1; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: var(--fs-sub); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.tag { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-tiny); padding: 2px 8px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; white-space: nowrap; }
.tag.accent { background: var(--accent-light); color: var(--accent-ink); }
.tag.warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.kc-assets { margin-left: 2px; }

/* 今日三件事 */
.date-nav { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.date-nav .dn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); font-size: 14px; }
.date-nav .dn:hover { background: var(--surface-3); }
.date-nav .dd { padding: 0 12px; font-size: var(--fs-sub); font-weight: 500; border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-width: 128px; text-align: center; }
/* ===== R169-T3：今日三件事的推荐依据浮层（右上角一枚小图标，不占台面高度） ===== */
.card.focus { position: relative; }
.focus-why-ico { position: relative; margin-left: auto; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--accent-2); cursor: pointer; transition: border-color var(--dur), box-shadow var(--dur); }
.focus-why-ico:hover { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.focus-why-ico.on { background: var(--accent); border-color: var(--accent); color: #fff; --ai-mark-fill: #fff; --ai-mark-eye: var(--accent); }
.focus-why-ico .fwb { position: absolute; top: -3px; right: -3px; width: 7px; height: 7px; border-radius: 999px; background: var(--accent); border: 1.5px solid var(--surface); }
.focus-why { position: absolute; top: 42px; right: 12px; z-index: var(--z-dropdown, 40); width: 340px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: 0 12px 32px rgba(0, 0, 0, .14); padding: 10px 12px; }
.fw-h { font-size: var(--fs-sub); font-weight: 700; color: var(--text); margin-bottom: 6px; }
.fw-h .hint { font-weight: 400; font-size: var(--fs-caption); color: var(--text-3); }
.fw-row { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); }
.fw-row .n { flex-shrink: 0; font-size: var(--fs-micro); color: var(--text-4); font-variant-numeric: tabular-nums; padding-top: 2px; }
.fw-row .b { min-width: 0; flex: 1; }
.fw-row .t { font-size: var(--fs-sub); font-weight: 600; color: var(--text-2); }
.fw-row .t.off { font-weight: 400; color: var(--text-4); }
.fw-row .w { font-size: var(--fs-caption); color: var(--text-3); line-height: 1.6; margin-top: 2px; }
.fw-row .ai-tag { color: var(--accent-2); }
.fw-f { font-size: var(--fs-caption); color: var(--text-3); line-height: 1.7; border-top: 1px dashed var(--border); margin-top: 6px; padding-top: 7px; }
.fw-acts { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.tag.rec { color: var(--accent-2); background: var(--accent-light); border: 1px dashed var(--accent); }
.today-body { padding: 0 20px 10px; }
/* R120-TB2：今日三件事——对齐原型（模块边框强调 + 方形勾选 + 编号右上 + 完成态安静收束），
   ⚠ 功能不动：勾选/移除/复制昨日/导出/日期导航/双击开详情 全部保留 */
.card.focus { border-color: var(--border-strong); background: var(--surface); box-shadow: var(--shadow-sm); }
/* R175（原型 all-completed 浅底）：原型的近白完成态底色以令牌化等价落地——surface-2 向 surface 调 60%，六主题自适应 */
.card.focus.all-done { background: color-mix(in srgb, var(--surface-2) 60%, var(--surface)); }
.card.focus:focus-within { border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent), var(--shadow-sm); }
.card.focus .card-head .nm { font-size: var(--fs-headline); font-weight: 700; color: var(--text); }
.card.focus .card-head .ic { color: var(--accent); }
.card.focus .tc-title { font-size: var(--fs-body); font-weight: 600; }
.card.focus .tc-num { color: var(--text-3); font-size: var(--fs-sub); font-weight: 500; opacity: 1; }
.card.focus .today-card { padding: 12px 14px; min-height: 84px; border-radius: var(--radius-md); }
.card.focus .today-card:not(.empty-card):hover { transform: translateY(-1px); }
.card.focus .today-card:not(.empty-card) { border-color: var(--border); }
/* R176（原型 selected）：accent 描边 + 白底 + 细环（1px ring + 柔和投影，替代旧 3px 光晕+淡底） */
.card.focus .today-card.sel { border-color: var(--accent); background: var(--surface); animation: none; box-shadow: 0 0 0 1px var(--accent), 0 4px 12px color-mix(in srgb, var(--accent) 8%, transparent); }
/* R94（B3）三件事全完成：**安静**完成态——整块轻微去饱和（R175：.5→.65 对齐原型，仍低饱和）+ 一行中性小字。
   ⚠ 卡头（复制昨日 / 导出 / 日期导航）**不去饱和**——那是操作区，褪色会影响可用性。
   不用庆祝动画、不用红色、不用进度百分比。 */
.card.focus.all-done .today-cards { filter: saturate(.65); }
.card.focus.all-done .tc-num { color: var(--text-3); }
/* R175（原型 quiet-done-banner）：沉静收束行带上分隔虚线，居中 12px 中性字 */
.td-done { margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: var(--fs-sub); color: var(--text-3); text-align: center; letter-spacing: .3px; }
/* R94（B2）：任务树折叠/展开按钮的箭头（纯文字，不引新图标） */
.cur-tree-caret { opacity: .7; }
/* R52-F1：三件事横向并列——3 槽一行，压缩纵向空间（R175：槽距 8→12px 对齐原型 hero-grid） */
.today-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.today-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; cursor: pointer; transition: all var(--dur) ease; position: relative; display: flex; flex-direction: column; min-height: 84px; }
.today-card:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.today-card.sel { border-color: var(--accent); background: var(--surface); animation: none; box-shadow: 0 0 0 1px var(--accent), 0 4px 12px color-mix(in srgb, var(--accent) 8%, transparent); }
.today-card.done { opacity: .6; animation: none; }
.today-card.done .tc-title { text-decoration: line-through; color: var(--text-3); }
.today-card.empty-card { opacity: .55; border-style: dashed; background: transparent; align-items: center; justify-content: center; }
.today-card.empty-card:hover { opacity: .9; border-color: var(--accent); color: var(--accent); }
/* R117（04-61 C3）：失效槽卡——虚线 + 警示色，与中性的「空位」区分开；
   ⚠ 末行与上方 `.card.focus .today-card:not(.empty-card)` 同权重，靠**源码顺序在后**生效（不要前移本组）。 */
.today-card.stale-card { border-style: dashed; background: transparent; border-color: color-mix(in srgb, var(--tag-warn-text) 45%, var(--border)); }
.today-card.stale-card:hover { border-color: var(--tag-warn-text); background: var(--surface); }
.card.focus .today-card.stale-card { border-color: color-mix(in srgb, var(--tag-warn-text) 45%, var(--border)); }
.tc-num { position: absolute; top: 12px; right: 14px; font-size: var(--fs-sub); color: var(--text-4); font-weight: 700; font-variant-numeric: tabular-nums; }
.tc-row { display: flex; align-items: flex-start; gap: 8px; }
/* R120-TB2：方形勾选框（对齐原型：16px / 4px 圆角 / 1.5px 边框 / 选中随主题强调色） */
.tc-check { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: var(--fs-tiny); color: #fff; background: var(--surface); margin-top: 2px; transition: all var(--dur); }
.tc-check.done { background: var(--accent); border-color: var(--accent); }
.tc-title { font-size: 14px; font-weight: 600; line-height: 1.4; flex: 1; }
.tc-title.empty-t { color: var(--text-3); font-weight: 400; }
.tc-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
.tc-meta .tag { font-size: var(--fs-caption); padding: 1px 7px; }
/* R176（原型 slot-tag）：三件事槽位标签统一中性灰（项目/指标不分色，tag 语义色别处不受影响） */
.card.focus .tc-meta .tag.accent, .card.focus .tc-meta .tag.warn { background: var(--surface-3); color: var(--text-2); }
.tc-remove { position: absolute; top: 7px; right: 32px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: var(--fs-body); color: var(--text-3); cursor: pointer; opacity: 0; transition: all var(--dur); }
.today-card:hover .tc-remove { opacity: 1; }
.tc-remove:hover { background: var(--danger); color: #fff; }

/* ===== R2-①：槽内子任务视口（固定 5 行 + 底部渐隐 + 还有 N 项） ===== */
.tc-subs { margin-top: 6px; max-height: calc(5 * 24px + 4px); overflow-y: auto; display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; -webkit-mask-image: linear-gradient(to bottom, var(--text) calc(100% - 16px), transparent); mask-image: linear-gradient(to bottom, var(--text) calc(100% - 16px), transparent); }
.tc-subs.at-end { -webkit-mask-image: none; mask-image: none; }
.tc-sub { display: flex; align-items: center; gap: 6px; min-height: 22px; font-size: var(--fs-caption); color: var(--text-2); cursor: pointer; }
.tc-sub .tsub-check { flex-shrink: 0; width: 13px; height: 13px; border-radius: 3.5px; border: 1.2px solid var(--border-strong); display: inline-flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; background: var(--surface); }
.tc-sub .tsub-check:hover { border-color: var(--accent); }
.tc-sub.done .tsub-check { background: var(--text-3); border-color: var(--text-3); }
.tc-sub .tsub-t { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tc-sub.done .tsub-t { text-decoration: line-through; color: var(--text-3); }
.tc-sub-more { margin-top: 4px; font-size: var(--fs-caption); color: var(--text-3); text-align: center; cursor: pointer; }
.tc-sub-more:hover { color: var(--accent); }

/* R2-②：项目调度卡 CSS 全段随卡退役（ce-desc 由导出弹窗沿用保留） */
.ce-desc { font-size: var(--fs-sub); color: var(--text-3); margin-bottom: 12px; line-height: 1.7; }

/* 底部专区 Tab */

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: var(--z-overlay); }
.picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-width: 92vw; max-height: 70vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: calc(var(--z-overlay) + 1); display: flex; flex-direction: column; overflow: hidden; }
/* R172-T9：记录抽屉（`.rec-fill` / `.rec-list-scroll`）随入口整合退役 */
.pm-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.pm-head span:first-child { flex: 1; }
.pm-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: var(--fs-headline); }
.pm-close:hover { background: var(--surface-3); color: var(--text); }
.pm-body { flex: 1; overflow-y: auto; padding: 14px 20px; }
.picker-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-2); border-radius: 8px; margin-bottom: 6px; cursor: pointer; transition: all .1s; }
.picker-item:hover { background: var(--accent-light); }
.picker-item.disabled { opacity: .55; cursor: default; }
.picker-item.disabled:hover { background: var(--surface-2); }
.pi-check { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.pi-check.pi-ghost { background: var(--surface-3); color: var(--text-2); font-size: var(--fs-sub); }
.pi-info { flex: 1; min-width: 0; }
.pi-title { font-size: var(--fs-body); font-weight: 500; margin-bottom: 3px; }
.pi-meta { display: flex; gap: 5px; flex-wrap: wrap; }
.pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 0 2px; }
.pg-num { font-size: var(--fs-sub); color: var(--text-2); font-variant-numeric: tabular-nums; }
.search-box { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.search-box:focus-within { border-color: var(--accent); }
.search-box input { border: none; outline: none; font-size: var(--fs-sub); width: 150px; background: transparent; color: var(--text); font-family: inherit; }
/* R113-N6：任务选取弹窗筛选行（关键词 + 项目下拉，两维可叠加） */
.pm-filters { display: flex; gap: 8px; align-items: center; margin: 0 0 12px; }
.pm-filters .search-box { flex: 1; min-width: 0; }
.pm-filters .search-box input { width: 100%; }
.pm-proj { flex-shrink: 0; max-width: 190px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); font-family: inherit; outline: none; cursor: pointer; }
.pm-proj:hover { border-color: var(--accent); }
.pm-proj:focus { border-color: var(--accent); color: var(--text); }
.list-empty { text-align: center; padding: 30px; font-size: var(--fs-body); color: var(--text-3); }
.ts-label-pm { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 7px; }
.ts-select-pm { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: var(--fs-body); color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--dur-slow); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.modal-enter-active, .modal-leave-active { transition: all var(--dur) ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.95); }
/* R52-BUG-1：系统事件灰显（不计数，仅可见） */
.picker-item.sys { opacity: .45; }
.picker-item.sys .pi-title { color: var(--text-3); font-weight: 400; }
@media (max-width: 1080px) {
  /* R52-F1/F2：窄窗口降级回纵向 */
  .today-cards { grid-template-columns: 1fr; }
/* R125：卡面微阴影（三件事 + 项目聚焦看板） */
.today-card { box-shadow: var(--shadow-sm); }
}
</style>
