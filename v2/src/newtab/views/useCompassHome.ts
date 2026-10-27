import { ref, computed, watch, onMounted, onUnmounted, onDeactivated, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { visibleFields } from '@/shared/utils/fields'
import { focusRecentDays, focusWindowTotals } from '@/shared/utils/focusHistory'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { subscribeSaveError, getLastSaveOkAt, getBytesInUse, hasUnlimitedStorage, saveDataNow } from '@/shared/storage/repository'
import { pendingRows, runSync } from '@/shared/storage/airtable'
import type { SaveError } from '@/shared/storage/repository'
import type { TaskCard, Project, FocusSlot, CuriosityCard, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import CompassStatusModal, { type StatusDetailKey, type StatusDetailItem } from '../components/compass/CompassStatusModal.vue'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { recordCardOpen } from '@/shared/storage/stats'
import { weekUsageOf } from '@/shared/storage/stats'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import TodayBattleHost from '../components/dashboard/TodayBattleHost.vue'
import { useCompassHomeStorage } from './useCompassHomeStorage'
import { useCompassHomeDetail } from './useCompassHomeDetail'

export interface FocusCell { idx: number; slot?: FocusSlot; task?: TaskCard }
export type HandKind = 'task' | 'curiosity' | 'resource'

export function useCompassHome() {
const router = useRouter()
const route = useRoute()
const store = useAppStore()
// R91：解构出主攻相关口径——手册「🚀 主攻（最多 2 个）直通调度台速览」此前在调度台**零消费**。
// R3-B1：方向台的主攻聚焦条随 CompassShell 退役，focusedProjects 的**唯一**消费方就是本页速览。
const { d, allProjects, projectProgress, projectTasksOf, focusedProjects, isProjectStalled, isProjectDone, refreshWce, unarchivedTaskCount, taskArchiveIssue } = useCompass()
// R127：挂载即刷新 WCE 事件缓存（事件日志异步读取一次；computed 同步消费）
onMounted(() => {
  refreshWce?.()
  /* ★W17-C03：等高测量等首帧渲染完再量（DOM 未挂时量到的是 0） */
})

/* ★W17-C02（2026-10-20）：打开链接统一走 useResourceOpen（协议分流 + 附件校验 + 三态 toast +
   记账一体），本页原先的本地 openResourceLink（不记账）随本行退役——同一个动作不留两个实现。 */
const { openResourceLink, previewOpen, previewUrl, previewName, closePreview } = useResourceOpen({ store, d })

const drawerRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)

// ---- 日期工具 ----
function formatDate(dt: Date): string {
  return `${dt.getMonth() + 1}月${dt.getDate()}日 · ${['周日','周一','周二','周三','周四','周五','周六'][dt.getDay()]}`
}
function formatFullDate(dt: Date): string {
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日 · ${['周日','周一','周二','周三','周四','周五','周六'][dt.getDay()]}`
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
/* 跨零点心跳与其清理留在宿主：`midnightTimer` 是可变的普通 `let`，
   值拷贝到子域会读到过期句柄（clearTimeout 失效）。 */
onMounted(() => { scheduleMidnightRollover() })
onUnmounted(() => { if (midnightTimer) clearTimeout(midnightTimer) })

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
const focusMoreOpen = ref(false)
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
      showToast('顺序复核完成（你手工选过的格子未动）')
      store.persist()
    }
  } catch { /* 静默回落：网络/Key 问题不许把台面弄空，也不许弹一层错误 */ }
  finally { focusAiBusy.value = false }
}

function toggleWhy(): void {
  focusMoreOpen.value = false
  whyOpen.value = !whyOpen.value
  if (whyOpen.value) whyBadge.value = false
}
function closeWhy(): void { whyOpen.value = false }
/** 点浮层外任意处收起（捕获阶段：不拦业务点击，只负责"看走了就关"） */
function onDocClickCloseWhy(e: MouseEvent): void {
  const t = e.target as HTMLElement | null
  if (whyOpen.value && !t?.closest?.('.focus-why, .why-trigger')) closeWhy()
  if (focusMoreOpen.value && !t?.closest?.('.focus-more-wrap')) focusMoreOpen.value = false
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
  showToast('已换一批（只改今日计划位，不动任务卡）')
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
  if (!j) { showToast('本地候选池是空的（任务库没有可推荐的未完成事项）'); return }
  closeWhy()
  focusJob.value = j
}
/** ★W12-D 双击三件事卡 → 原为「滚动定位并高亮下方任务列表里那条任务」。
 *  ★V3.8.18（N1）决策翻转 → 改为右侧滑出 TaskDetailDrawer（详见下方函数的备案）。
 *  被取代的旧理由留档：「同页上方的『全貌』模块已经把详情常驻展示了，重复弹抽屉价值不大」
 *  —— 这条理由在七层纵向堆叠时成立（首屏被它吃掉、抽屉是唯一能看全的地方），
 *  N1 改成三栏横排后「全貌」只承载"选中时扫一眼"，要动手时的完整信息就只剩抽屉了，
 *  原来那个理由的前提已经不成立。`?hl=&hk=task` 定位通道本身不退役
 *  （TaskManagerPanel 仍 watch，下方任务卡面板的定位能力一项没少）。 */
/**
 * ★V3.8.18（N1）**决策翻转**：双击由「跳到下方任务列表并高亮」改为「右侧滑出任务详情抽屉」。
 *
 * 为什么翻：跳转+高亮是 V3.8.17（W12-D）当时的 B2 拍板，理由是"热力图退役后要保证任务还够得着"。
 * 但 N1 把全貌横条摆上来之后，用户的工作流变成了「选中 → 看全貌 → 要动手」，
 * 跳转把视线从上方挪到页面底部、并且把"看"这件事打断，而抽屉能**保持上下文**。
 * 能力一项没少：抽屉里同样看得到全部子任务、支撑材料、完整描述与编辑入口，
 * 且 `?hl=&hk=task` 那条定位通道仍在（下方的任务卡面板仍 watch 这两个 query）。
 */
function openCellTask(c: FocusCell) {
  if (!c.task) return
  recordCardOpen(d.value, c.task)
  store.persistHot()
  drawerRef.value?.open(c.task)
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
/** ★P5（V3.8.22）：槽内子任务视口函数组（SUB_VISIBLE_ROWS/subScrolled/onSubScroll/subScrollAt/subMoreCount）
 *  随 tc-subs 模板块一并退役——视口本体已删，留守函数会成 dead code。
 *  toggleSlotSub 保留：FocusDetail 单行 @toggle-sub 链（P4-1 钉住）仍走这条 doneAt 落库路径。 */
/** 槽内子任务勾选：落 doneAt（R172-T2 推进维度同口径），随父卡持久化 */
function toggleSlotSub(t: TaskCard, subId: string) {
  t.subtasks = (t.subtasks || []).map(s => (s.id === subId ? { ...s, done: !s.done, doneAt: !s.done ? Date.now() : undefined } : s))
  t.updatedAt = Date.now()
  store.persist()
}

// V3.9.1：整行即详情入口；选中态与下方全貌模块一并退役。

// 任务选取弹窗（满 3 拦截：按钮与空位两条路径同拦，R49-B4）
const pickerOpen = ref(false)
const pickerSlot = ref(0)
const pickerSearch = ref('')
const pickerStatus = ref<'all' | 'todo' | 'doing'>('all')
// R113-N6：按项目筛选（用户反馈：任务库只有关键词搜索，任务一多只能逐条翻）
// 取值：'' = 全部项目；'__none__' = 未关联项目；其余 = project.id
const pickerProject = ref('')
function openPicker(slot: number) {
  const c = focusCellAt(slot)
  const isStale = !!c?.slot && !c?.task
  // R117（04-61 C3）：失效槽不算占位——点它的「重新选取」即便 3 件已满也放行（原位替换）；
  // 满额 + 点正常格/空位时才按原口径拦截（3 件有效任务不能再加第 4 件）。
  if (focusFull.value && !isStale) { showToast('今日三件事已满（3/3）——先完成或移除一件'); return }
  pickerSlot.value = Math.min(slot, FOCUS_LIMIT - 1)
  pickerSearch.value = ''
  pickerProject.value = '' // R113-N6：每次打开复位为「全部项目」
  pickerStatus.value = 'all'
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
  showToast('已添加到今日三件事')
  recordCardOpen(d.value, task)
  store.persistHot()
  drawerRef.value?.open(task)
}
const pickerCandidates = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  const pj = pickerProject.value
  const st = pickerStatus.value
  return d.value.tasks
    .filter(t => !t.deletedAt)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    // R113-N6：项目维度过滤（与关键词可叠加）
    .filter(t => !pj || (pj === '__none__' ? !t.projectId : t.projectId === pj))
    .filter(t => st === 'all' || t.status === st)
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
  showToast('已复制昨日三件事')
}
function clearFocusSelection(): void {
  pickerSearch.value = ''
  pickerProject.value = ''
  pickerStatus.value = 'all'
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
  showToast(`已导出 ${rows.length} 条记录`)
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

function taskStatusLabel(status: TaskCard['status']): string {
  return status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'
}
function taskStatusIcon(status: TaskCard['status']): string {
  return status === 'done' ? 'check' : status === 'doing' ? 'half' : 'circle'
}
function taskStatusClass(status: TaskCard['status']): string {
  return status === 'done' ? 'done' : status === 'doing' ? 'doing' : 'todo'
}
function fmtShortDate(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}
function fmtRecentTime(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  const now = new Date()
  const hm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  if (dt.toDateString() === now.toDateString()) return `今天 ${hm}`
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (dt.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`
  return `${dt.getMonth() + 1}/${dt.getDate()} ${hm}`
}

// ---- 附件字段可见性（三件事卡正面徽章显隐） ----
  const { tFields, taskAssetsOn, onDateKey, gotoAnchor, onAnchorEvt, saveErr, lastOkTick, saveErrSub, storageTimer, storageOk, ERR_LABEL, storageText, timeAgo, onStorageClick, atSync, atConfigured, atSyncErr, atPending, atChipText, atChipTitle, atSyncing, onSyncChipClick } = useCompassHomeStorage({ d, pickerOpen, exportOpen, whyOpen, focusMoreOpen, shiftDate, route, router, onDocClickCloseWhy, store })
const focusMeta = computed(() => {
  const m = new Map<string, { pct: number; stall: boolean; finished: boolean; open: number }>()
  for (const p of focusedProjects.value) {
    const open = projectTasksOf(p.id).filter(t => !t.deletedAt && t.status !== 'done').length
    m.set(p.id, { pct: projectProgress(p).pct, stall: isProjectStalled(p), finished: isProjectDone(p), open })
  }
  return m
})
/** 主攻项目就地打开可编辑详情弹窗，不跳路由。 */
const readonlyProjectOpen = ref(false)
const readonlyProjectId = ref<string | null>(null)
function openFocusProject(p: Project) {
  readonlyProjectId.value = p.id
  readonlyProjectOpen.value = true
}
/* KeepAlive 离开调度台时，Teleport 到 body 的详情层不会随视图一起隐藏，必须显式收口；
   否则后续页面会被残留遮罩盖住，连池卡右键都落不到真实控件上。 */
onDeactivated(() => {
  readonlyProjectOpen.value = false
  drawerRef.value?.close()
})

// ================= V3.9.18 · 调度台按原型迭代（04-73 规范落地原型 · 用户 2026-10-24 认可） =================
// 原型：评审交接包/原型_调度台_04-73规范落地_审核稿_V1.html。本轮五件事：
//  ① kicker 去全大写英文，改「调度台 · 日期 周X」；
//  ② 主攻只在「今天的状态」并列展示，点击打开可编辑详情弹窗；
//  ③ 手边的卡三列改三池页签（hand-grid/hand-col/mini-list×3/goDeck 字符串锚全保留，v-show 切换）；
//  ④ 右栏状态读数改「今日入台 / 今日调出 / 未归档」（本周复用挪到「最近调出」头部 chip），新增「好奇心培育」面板；
//  ⑤ 密度令牌接通（04-73 D-1(a)）：主栏行卡读 --card-pad-*/--card-gap，紧凑档真实生效。
/** 手边的卡三池页签（默认任务池；列结构保留、仅显示态切换） */
const handTab = ref<HandKind>('task')
/** 今日入台：三类卡 createdAt ≥ 今日 0 点（按创建时间派生；战报按事件日志计，两者口径差异在 tooltip 声明，不冒充同源） */
const todayInCount = computed(() => {
  const t0 = todayStart.value
  let n = 0
  for (const list of [d.value.tasks, d.value.curiosities, d.value.resources]) {
    for (const c of list) { if (!c.deletedAt && (c.createdAt || 0) >= t0) n++ }
  }
  return n
})
/** 今日调出：lastCalledAt 落在今日的资源卡张数（库内无逐次时间戳，诚实按「张」计，不虚报「次」） */
const todayOutCount = computed(() => {
  const t0 = todayStart.value
  return (d.value.resources || []).filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= t0).length
})
// ================= 底部专区（R55-B2：任务调度已迁方向台，好奇心培育单区直呈） =================
// ===== ★W12-D（V3.8.16）：调度台「📈 复盘」→「📈 今日战报」，行为由跳转改为就地弹窗 =====
// 历史轨迹：push('/settings?page=dashboard') → V3.8.9 W9 改指 /profile（仪表盘迁画像洞察页）→ 本轮改就地开弹窗。
// 用户 2026-10-13 拍板：年度热力图退役后，调度台仍需一个「今天的全貌」入口，
// 而跳去画像洞察页等于让人离开手边的三件事去看另一个尺度，就地弹窗更贴处境。
const battleHost = ref<InstanceType<typeof TodayBattleHost> | null>(null)
function openReview(): void { battleHost.value?.openToday() }

// ================= V3.9.1：案头概览与三列预览 =================
const focusDoneCount = computed(() => todayFocusList.value.filter(s => s.done).length)
const mainFocus = computed<Project | null>(() => focusedProjects.value[0] || null)
const extraFocus = computed<Project | null>(() => focusedProjects.value[1] || null)
/* 右栏已收口为「今天的状态」「最近调出」两块。保留最近调出上限的稳定口径；
 * 不再用等高测量把两块面板强行拉成左栏高度，左右列只保证顶部与模块间距一致。 */
const RECENT_ROW_H = 44
const recentLimit = computed(() => 6)
const recentResources = computed<ResourceCard[]>(() =>
  (d.value.resources || [])
    .filter(r => !r.deletedAt && r.lastCalledAt)
    .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
    .slice(0, recentLimit.value)
)
const workBoardRef = ref<HTMLElement | null>(null)
const handBoardRef = ref<HTMLElement | null>(null)
const deskLayoutRef = ref<HTMLElement | null>(null)
const liveTasks = computed<TaskCard[]>(() =>
  (d.value.tasks || []).filter(t => !t.deletedAt && !t.lifecycleArchived)
)
const previewTasks = computed<TaskCard[]>(() => {
  const rank = (t: TaskCard) => (t.status === 'doing' ? 0 : t.status === 'todo' ? 1 : 2)
  return [...liveTasks.value]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || rank(a) - rank(b) || (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5)
})
const liveCuriosities = computed<CuriosityCard[]>(() =>
  (d.value.curiosities || []).filter(c => !c.deletedAt && !c.lifecycleArchived)
)
const previewCuriosities = computed<CuriosityCard[]>(() =>
  [...liveCuriosities.value]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 5)
)
const liveResources = computed<ResourceCard[]>(() =>
  (d.value.resources || []).filter(r => !r.deletedAt)
)
const previewResources = computed<ResourceCard[]>(() =>
  [...liveResources.value]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.lastCalledAt || b.updatedAt || 0) - (a.lastCalledAt || a.updatedAt || 0))
    .slice(0, 5)
)
const hasAnyPreview = computed(() => !!previewTasks.value.length || !!previewCuriosities.value.length || !!previewResources.value.length)
const weeklyReuse = computed(() => weekUsageOf(d.value))
const archivedCount = computed(() => unarchivedTaskCount())

function openTaskPreview(t: TaskCard): void {
  recordCardOpen(d.value, t)
  store.persistHot()
  drawerRef.value?.open(t)
}
function openCurioPreview(c: CuriosityCard): void {
  void router.push({ path: '/deck/curiosity', query: { hl: c.id, hk: 'curio', open: '1' } })
}
function openResourcePreview(r: ResourceCard): void {
  emitOpenDrawer({ kind: 'res', id: r.id })
}
/** ★W17-C02（2026-10-20 用户拍板）：「最近调出」单击分流——
 *  有可打开链接 → 直接打开（useResourceOpen 内部记账一次）；
 *  无链接 / 打不开 → 回落右侧滑出详情抽屉。回落路径**零提前记账**（C02.3 陷阱：
 *  ResourceDetailDrawer.openFromId 打开时自己记一次，两边都记 = 双计）。 */
function openRecentResource(r: ResourceCard): void {
  if (openResourceLink(r)) return
  openResourcePreview(r)
}
function goDeck(kind: 'task' | 'curiosity' | 'resource'): void {
  void router.push(`/deck/${kind}`)
}
/* ★W17-C01（2026-10-20 用户拍板）「今天的状态」三行 → 中央只读明细弹窗。
 * 原行为是 router.push 跳到另一个页面（说 A 给 B）；现改为就地弹窗，不跳路由、不改 URL。
 * ★口径同源：明细清单与行内数字共用同一份取数（项目看 focusMeta / 未归档看 taskArchiveIssue /
 * 本周复用看 wrr 周戳 + lastVisits），数字与条数不许各说各话。 */
  const { statusDetail, closeStatusDetail, statusDetailTitle, statusDetailItems, statusDetailNote, statusDetailEmpty, weekStartKeyOf, openStatusDetail, onStatusItemAction, curioStatusLabel, resourceKindLabel, taskDueLabel, focusSlotSourceLabel } = useCompassHomeDetail({ todayStart, d, fmtRecentTime, projectName, focusedProjects, focusMeta, taskArchiveIssue, readonlyProjectId, readonlyProjectOpen, openTaskPreview, openResourcePreview })
  return {
    router, route, store, d, allProjects,
    projectProgress, projectTasksOf, focusedProjects, isProjectStalled, isProjectDone,
    refreshWce, unarchivedTaskCount, taskArchiveIssue, openResourceLink, previewOpen,
    previewUrl, previewName, closePreview, drawerRef, formatDate,
    formatFullDate, dateStr, midnightOf, todayStart, midnightTimer,
    scheduleMidnightRollover, todayDate, shiftDate, todayFocusList, FOCUS_LIMIT,
    focusFull, focusCells, focusCellAt, todayKey, localWhy,
    aiWhy, whyOpen, whyBadge, focusAiBusy, focusMoreOpen,
    whyOf, whyIsAi, focusHasRec, focusWeekTotals, ensureAutoFocus,
    refineWithAi, toggleWhy, closeWhy, onDocClickCloseWhy, reshuffleFocus,
    muteFocusToday, focusJob, openFocusReview, openCellTask, focusAllDone,
    todayTaskForSlot, toggleSlotSub, pickerOpen, pickerSlot, pickerSearch,
    pickerStatus, pickerProject, openPicker, selectTaskForSlot, pickerCandidates,
    pickerProjectOptions, pickedIds, pickerDisabled, selectTaskGuarded, removeTodaySlot,
    copyYesterday, clearFocusSelection, exportOpen, exportFrom, exportTo,
    openExportModal, statusLabelOf, exportBusy, doExport, toggleTodayDone,
    projectName, metricName, taskStatusLabel, taskStatusIcon, taskStatusClass,
    fmtShortDate, fmtRecentTime, tFields, taskAssetsOn, onDateKey,
    gotoAnchor, onAnchorEvt, saveErr, lastOkTick, saveErrSub,
    storageTimer, storageOk, ERR_LABEL, storageText, timeAgo,
    onStorageClick, atSync, atConfigured, atSyncErr, atPending,
    atChipText, atChipTitle, atSyncing, onSyncChipClick, focusMeta,
    readonlyProjectOpen, readonlyProjectId, openFocusProject, handTab, todayInCount,
    todayOutCount, battleHost, openReview, focusDoneCount,
    mainFocus, extraFocus, RECENT_ROW_H, recentLimit,
    recentResources, workBoardRef, handBoardRef, deskLayoutRef,
    liveTasks,
    previewTasks, liveCuriosities, previewCuriosities, liveResources, previewResources,
    hasAnyPreview, weeklyReuse, archivedCount, openTaskPreview, openCurioPreview,
    openResourcePreview, openRecentResource, goDeck, statusDetail, closeStatusDetail,
    statusDetailTitle, statusDetailItems, statusDetailNote, statusDetailEmpty, weekStartKeyOf,
    openStatusDetail, onStatusItemAction, curioStatusLabel, resourceKindLabel, taskDueLabel,
    focusSlotSourceLabel,
  }
}
