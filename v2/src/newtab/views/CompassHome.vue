<script setup lang="ts">
// R65-F7：KeepAlive 缓存实例名（App.vue router-view include）
defineOptions({ name: 'CompassHomeView' })
// R49（V2.22.0）三大系统页改版：本页 = 调度台（默认首页）
// - 今日记录条（入台/移出/调出/写入记录，点击开抽屉）
// - 左右分栏：左=今日三件事（硬上限 3，自 CompassActions 整体迁入，交互逐项一致）｜右=项目调度面板（单击三件事联动）
// - 底部专区：好奇心培育单区直呈（R55-B2：任务调度迁方向台）
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount, onDeactivated, nextTick, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { visibleFields } from '@/shared/utils/fields'
import { focusRecentDays, focusWindowTotals } from '@/shared/utils/focusHistory'
import type { AiJob, AiRow } from '@/shared/ai/job'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
import { subscribeSaveError, getLastSaveOkAt, getBytesInUse, hasUnlimitedStorage, saveDataNow } from '@/shared/storage/repository'
import { pendingRows, runSync } from '@/shared/storage/airtable'
import type { SaveError } from '@/shared/storage/repository'
import type { TaskCard, Project, FocusSlot, CuriosityCard, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { taskMaturity } from '@/shared/utils/maturity'
import NewBadge from '@/shared/components/NewBadge.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'
import CompassStatusModal, { type StatusDetailKey, type StatusDetailItem } from '../components/compass/CompassStatusModal.vue'
import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'
import { useEqualHeight } from '@/newtab/composables/useEqualHeight'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { recordCardOpen } from '@/shared/storage/stats'
import { weekUsageOf } from '@/shared/storage/stats'
// ★W17-C02（2026-10-20）：本地那份「双击打开链接」小实现退役（不记调出、不分流三态、失败静默），
// 全库统一走 useResourceOpen —— 同一个动作只允许一个实现，且它返回成败供单击分流。
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import AssetPreview from '@/shared/components/AssetPreview.vue'
// ★W12-D（V3.8.16）：年度热力图从调度台退役（用户 2026-10-13 拍板——画像洞察页已全量覆盖，
// 调度台再放一份是重复），但「今日战报」要保留，故先把日详情从 Heatmap.vue 解耦出来，
// 由 TodayBattleHost 自包含承载（数据桥 + 事件日志读取 + 日详情 + 全量记录抽屉都在它里面）。
// 本页只挂一行、不直接碰事件日志（R49-3 负锚保持）。
import TodayBattleHost from '../components/dashboard/TodayBattleHost.vue'
// R172-T9（04-67 Q7）：调度画像周报浮层**已退役**（组件已物理删除，全仓零引用）——
// 四段式能力并入知源仪表盘的「复盘段」（ReviewPanel.vue），入口由本页右上角 `📈 复盘` 承担。
// 历史包袱顺带清掉：R113-N3 曾因"模板引用但从未 import"导致点按钮无任何反应，该类问题随组件退役消失。

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
  nextTick(() => onEqualHeightReady())
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
  if (e.key === 'Escape') {
    if (pickerOpen.value) { pickerOpen.value = false; e.preventDefault(); return }
    if (exportOpen.value) { exportOpen.value = false; e.preventDefault(); return }
    if (whyOpen.value) { whyOpen.value = false; e.preventDefault(); return }
    if (focusMoreOpen.value) { focusMoreOpen.value = false; e.preventDefault(); return }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); shiftDate(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
}
// R67-F4：浏览器模块直达。V3.9.1 起首页不再常驻完整面板，直达改为进入对应二级列表。
watch(() => route.query.hl, (hl) => {
  if (!hl) return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk === 'curio') void router.replace({ path: '/deck/curiosity', query: { hl, hk } })
  else if (hk === 'task') void router.replace({ path: '/deck/task', query: { hl, hk } })
  else if (hk === 'res') void router.replace({ path: '/deck/resource', query: { hl, hk } })
}, { immediate: true })
watch(() => route.query.bottom, (b) => {
  if (b === 'curio') void router.replace('/deck/curiosity')
  else if (b === 'task') void router.replace('/deck/task')
  else if (b === 'pool') void router.replace('/deck/resource')
}, { immediate: true })

function gotoAnchor(name: string) {
  if (name === 'curiosity') { void router.push('/deck/curiosity'); return }
  if (name === 'task') { void router.push('/deck/task'); return }
  const id = name === 'project' ? 'zy-mod-tasks' : ''
  if (!id) return
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
    try { await saveDataNow(); showToast('已重试写入，存储恢复正常') }
    catch { showToast('重试仍失败，建议导出备份（设置 → 导出数据）') }
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
  const agoText = ago < 3600_000 ? Math.max(1, Math.round(ago / 60000)) + '分钟前' : ago < 86400_000 ? Math.round(ago / 3600_000) + '小时前' : Math.round(ago / 86400_000) + '天前'
  return `⇄ ${agoText}同步${atPending.value ? ` · 待推 ${atPending.value}`: ''}`
})
const atChipTitle = computed(() => {
  const s = atSync.value
  if (!atConfigured.value) return '点击完成 Airtable 连接配置'
  const parts = ['点击立即同步到 Airtable']
  if (s?.lastSyncedCount != null) parts.push(`上次推送 ${s.lastSyncedCount} 条`)
  if (s?.lastSyncCalls != null) parts.push(`调用 ${s.lastSyncCalls} 次`)
  return parts.join('· ')
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
    showToast(`已同步到 Airtable：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    showToast('同步失败：' + (e instanceof Error ? e.message : String(e)))
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
type HandKind = 'task' | 'curiosity' | 'resource'
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
/** 好奇心培育（右栏）：最近 3 条好奇心，点击去卡池定位；转任务在卡池内操作（好奇与资源互不挂载） */
const nurtureCuriosities = computed<CuriosityCard[]>(() => previewCuriosities.value.slice(0, 3))

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
/* ★W17-C03（2026-10-20 用户拍板 · 方案 C）：右栏与左栏等高 + 最近调出按可用高度多显示。
 * 病根：右栏两块面板按内容自然伸缩，左栏卡片随数据变高，1440 下右下留大片空白、顶/底边都不齐。
 * 口径：ResizeObserver 测左侧两张卡实测高度 → CSS 变量（--rail-top-h / --rail-bottom-h）→ 右栏读取；
 *      最近调出条数按「第二块面板可用高度 ÷ 单行高度」动态算（预期 5-6 条），超出时列表内部滚动。
 * ★负锚：条数不许写死 slice(0,3)。 */
const RECENT_ROW_H = 44
const railAvailable = ref(0)
const recentLimit = computed(() => {
  const h = railAvailable.value
  if (!h) return 5
  /* 面板头 40px + 底部呼吸 8px，其余全部给列表 */
  return Math.max(5, Math.min(7, Math.floor((h - 48) / RECENT_ROW_H)))
})
const recentResources = computed<ResourceCard[]>(() =>
  (d.value.resources || [])
    .filter(r => !r.deletedAt && r.lastCalledAt)
    .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
    .slice(0, recentLimit.value)
)
const workBoardRef = ref<HTMLElement | null>(null)
const handBoardRef = ref<HTMLElement | null>(null)
const deskLayoutRef = ref<HTMLElement | null>(null)
const recentPanelRef = ref<HTMLElement | null>(null)
const { measure: measureRail } = useEqualHeight({
  top: workBoardRef, bottom: handBoardRef, host: deskLayoutRef
})
/* 右栏「最近调出」面板的实测高度 → 条数（与等高测量同一帧，避免两套 layout 读数打架） */
let railRO: ResizeObserver | null = null
function observeRailPanel() {
  const el = recentPanelRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  railRO?.disconnect()
  railRO = new ResizeObserver(() => { railAvailable.value = el.getBoundingClientRect().height })
  railRO.observe(el)
  railAvailable.value = el.getBoundingClientRect().height
}
function onEqualHeightReady() {
  measureRail()
  observeRailPanel()
}
onBeforeUnmount(() => { railRO?.disconnect(); railRO = null })
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
const statusDetail = ref<StatusDetailKey | ''>('')
/** V3.9.14：明细行可在中央弹窗 / 右侧任务或资源详情之间切换；
 *  先关明细再开详情，避免两层遮罩叠在一起、Esc 只关到上层。 */
function closeStatusDetail(): void { statusDetail.value = '' }
const statusDetailTitle = computed(() => ({
  focus: '主攻项目明细', unarchived: '未归档任务明细', reuse: '本周复用明细',
  in: '今日入台明细', out: '今日调出明细', '': ''
}[statusDetail.value]))
const statusDetailItems = computed<StatusDetailItem[]>(() => {
  const k = statusDetail.value
  /* V3.9.18：今日入台 = 三类卡 createdAt ≥ 今日 0 点（按创建时间派生；导入/恢复的旧卡不计入） */
  if (k === 'in') {
    const t0 = todayStart.value
    const rows: { ts: number; item: StatusDetailItem }[] = []
    for (const r of d.value.resources) {
      if (!r.deletedAt && (r.createdAt || 0) >= t0) rows.push({ ts: r.createdAt || 0, item: { title: r.title || '（无标题）', meta: `资源卡 · ${fmtRecentTime(r.createdAt)}`, extra: resourceKindLabel(r), action: '打开资源', actionKind: 'resource', actionId: r.id } })
    }
    for (const t of d.value.tasks) {
      if (!t.deletedAt && (t.createdAt || 0) >= t0) rows.push({ ts: t.createdAt || 0, item: { title: t.title || '（无标题）', meta: `任务卡 · ${fmtRecentTime(t.createdAt)}`, extra: projectName(t.projectId) || '未挂项目', action: '打开任务', actionKind: 'task', actionId: t.id } })
    }
    for (const c of d.value.curiosities) {
      if (!c.deletedAt && (c.createdAt || 0) >= t0) rows.push({ ts: c.createdAt || 0, item: { title: c.question || '（无标题）', meta: `好奇心卡 · ${fmtRecentTime(c.createdAt)}`, extra: curioStatusLabel(c) } })
    }
    return rows.sort((a, b) => b.ts - a.ts).map(x => x.item)
  }
  /* V3.9.18：今日调出 = lastCalledAt 落在今日的资源卡（按「张」计；与战报事件计次口径不同，见 note） */
  if (k === 'out') {
    const t0 = todayStart.value
    return (d.value.resources || [])
      .filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= t0)
      .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
      .map(r => ({
        title: r.title || '（无标题）',
        meta: `最近 ${fmtRecentTime(r.lastCalledAt)}`,
        extra: `累计 ${r.callCount || 0} 次`,
        action: '打开资源',
        actionKind: 'resource',
        actionId: r.id
      }))
  }
  if (k === 'focus') {
    return focusedProjects.value.map(p => {
      const m = focusMeta.value.get(p.id)
      return {
        title: p.name,
        meta: m ? `${m.finished ? '已完成' : m.stall ? '停滞' : '推进中'} · 未完成任务 ${m.open} 项` : '推进中',
        extra: `${m?.pct ?? 0}%`,
        action: '查看项目',
        actionKind: 'project',
        actionId: p.id
      }
    })
  }
  if (k === 'unarchived') {
    return (d.value.tasks || [])
      .filter(x => !x.deletedAt && taskArchiveIssue(x) !== '')
      .map(x => ({
        title: x.title || '（无标题）',
        meta: taskArchiveIssue(x),
        extra: projectName(x.projectId) || '未挂项目',
        action: '打开任务',
        actionKind: 'task',
        actionId: x.id
      }))
  }
  if (k === 'reuse') {
    /* ★C01.3 陷阱：跨周后 stats.lastVisits 不会自动清空，只有 thisWeekStart 才是本周戳时数字才不为 0；
       清单必须按同一周戳过滤，否则会把上周的调用当本周列出来，而顶部数字是 0。 */
    const wrr = d.value.stats?.wrr
    const thisWeek = weekStartKeyOf(Date.now())
    const start = wrr?.thisWeekStart === thisWeek ? wrr.thisWeekStart : ''
    const list = (d.value.resources || [])
      .filter(r => !r.deletedAt && r.lastCalledAt)
      .filter(r => !!start && weekStartKeyOf(r.lastCalledAt || 0) === start)
      .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
    const visits = d.value.stats?.lastVisits || {}
    return start ? list.map(r => ({
      title: r.title || '（无标题）',
      meta: `本周调用 ${visits[r.id] || 0} 次`,
      extra: new Date(r.lastCalledAt || 0).toLocaleDateString('zh-CN'),
      action: '打开资源',
      actionKind: 'resource',
      actionId: r.id
    })) : []
  }
  return []
})
const statusDetailNote = computed(() => ({
  focus: '主攻项目 = 方向台上标记为主攻且未归档的项目；进度与停滞判定与方向台同一口径。',
  unarchived: '未归档 = 未删除、但缺项目归属或已完成未归档的任务；与行内数字同源。',
  reuse: '本周复用 = 本周内被打开过的资源卡（按最近调出倒序）；跨周后清单为空，与行内 0 一致。',
  in: '今日入台 = 今日 0 点起新建的三类卡（按创建时间派生；导入与恢复的旧卡不计入）。与「今日战报」的新增计次口径不同（战报按事件日志），两者不冒充同源。',
  out: '今日调出 = 今日 0 点起 lastCalledAt 落在今日的资源卡张数。与「今日战报」的调出计次口径不同（战报按事件日志逐次累计），两者不冒充同源。',
  '': ''
}[statusDetail.value]))
const statusDetailEmpty = computed(() => ({
  focus: '还没有设定主攻项目。去方向台把最重要的 1-2 个项目标为主攻。',
  unarchived: '没有待归档的任务——当前任务都有项目归属。',
  reuse: '本周还没有调出记录。打开一张资源卡后，会出现在这里。',
  in: '今天还没有新卡入台。用扩展快捷键采集一张，回执会告诉你它去了哪。',
  out: '今天还没有调出过资源卡。⌘K 或卡池里打开一张后，会出现在这里。',
  '': ''
}[statusDetail.value]))
/** 周戳工具：与 stats.weekStartKey 同口径（本地周一为一周起点） */
function weekStartKeyOf(ts: number): string {
  const dt = new Date(ts)
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function openStatusDetail(k: StatusDetailKey): void { statusDetail.value = k }
/** V3.9.14：状态明细不再止于“看一眼”。行内动作复用既有详情出口，
 *  不新增第二套编辑面：项目 → 只读项目详情；任务 → 任务抽屉；资源 → 资源详情。 */
function onStatusItemAction(item: StatusDetailItem): void {
  closeStatusDetail()
  if (!item.actionId) return
  if (item.actionKind === 'project') {
    readonlyProjectId.value = item.actionId
    readonlyProjectOpen.value = true
    return
  }
  if (item.actionKind === 'task') {
    const task = (d.value.tasks || []).find(t => t.id === item.actionId && !t.deletedAt)
    if (task) openTaskPreview(task)
    else showToast('这张任务已不在任务池中')
    return
  }
  if (item.actionKind === 'resource') {
    const resource = (d.value.resources || []).find(r => r.id === item.actionId && !r.deletedAt)
    if (resource) openResourcePreview(resource)
    else showToast('这张资源卡已不在资源池中')
  }
}
function curioStatusLabel(c: CuriosityCard): string {
  return c.status === 'done' ? '已求证' : c.status === 'doing' ? '探索中' : c.status === 'shelf' ? '已搁置' : '待探索'
}
function resourceKindLabel(r: ResourceCard): string {
  return r.linkType === 'file' ? '本地文件' : r.linkType === 'obsidian' ? 'Obsidian' : r.link ? '网页链接' : '文字卡'
}
function taskDueLabel(t: TaskCard): string {
  if (!t.dueDate) return projectName(t.projectId)
  return `${t.dueDate} · ${projectName(t.projectId)}`
}
function focusSlotSourceLabel(slot: FocusSlot): string {
  if (slot.sourceType === 'text') return '自由文本'
  if (slot.sourceType === 'resource') return '资源卡'
  if (slot.sourceType === 'curiosity') return '好奇心卡'
  return '卡片'
}
</script>

<template>
  <div class="page">
    <header class="desk-head">
      <div class="desk-heading">
        <div class="desk-kicker">调度台 · {{ formatFullDate(todayDate) }}</div>
        <h1>今天，先做这三件。</h1>
      </div>
      <div class="desk-actions">
        <button class="why-trigger battle-trigger" type="button" @click="openReview">
          <Icon name="trendup" :size="13" />
          <span>今日战报</span>
        </button>
        <button class="why-trigger" :class="{ on: whyOpen }" data-testid="focus-why-ico" type="button" @click.stop="toggleWhy">
          <Icon name="sparkles" :size="13" />
          <span>为什么这样排</span>
          <span v-if="whyBadge && focusHasRec" class="why-dot" />
        </button>
        <div v-if="whyOpen" class="focus-why" data-testid="focus-why" role="presentation" data-a11y-container @click.stop>
          <div class="fw-h">为什么是这三件<span class="hint">{{ focusAiBusy ? ' · AI 复核中…' : '' }}</span></div>
          <div v-for="c in focusCells" :key="'w' + c.idx" class="fw-row">
            <span class="n">{{ String(c.idx + 1).padStart(2, '0') }}</span>
            <div class="b">
              <template v-if="c.task">
                <div class="t">{{ c.slot?.text }}</div>
                <div class="w">
                  <template v-if="c.slot?.auto === true">{{ whyOf(c.slot) || '本地依据：主攻项目下可直接推进的事项' }}<span v-if="whyIsAi(c.slot)" class="ai-tag"> · AI 判词</span></template>
                  <template v-else>这一格是你自己选的，系统不评价、也不会覆盖。</template>
                </div>
              </template>
              <template v-else>
                <div class="t off">空着</div>
                <div class="w">点这一格从任务库选，或用“换一批”。</div>
              </template>
            </div>
          </div>
          <div class="fw-f">
            过去 7 天完成 <b>{{ focusWeekTotals.done }}/{{ focusWeekTotals.planned }}</b>（按三件事格子计）<br>
            推荐只写今天的计划位，<b>不改任务卡、不改状态、不改归属</b>。
          </div>
          <div class="fw-acts">
            <button class="quiet-btn" data-testid="focus-reshuffle" type="button" @click="reshuffleFocus">换一批</button>
            <button class="quiet-btn" data-testid="focus-review" type="button" :disabled="focusAiBusy" @click="openFocusReview">让 AI 复核顺序</button>
            <button class="quiet-btn" data-testid="focus-mute" type="button" @click="muteFocusToday">今天别自动推荐</button>
          </div>
        </div>
      </div>
    </header>

    <div ref="deskLayoutRef" class="desk-layout">
      <main class="desk-main">
        <section id="zy-mod-tasks" ref="workBoardRef" class="work-board" :class="{ 'all-done': focusAllDone }" aria-labelledby="focusTitle">
          <header class="board-head">
            <div class="board-title">
              <span class="board-ico"><Icon name="compass" :size="18" /></span>
              <div>
                <h2 id="focusTitle">今日三件事</h2>
                <span class="board-count">{{ focusDoneCount }} / {{ Math.max(todayFocusList.length, 1) }} 完成 · 计划位 {{ todayFocusList.length }}/3</span>
              </div>
            </div>
            <div class="board-tools">
              <button class="icon-btn" type="button" title="前一天" aria-label="前一天" @click="shiftDate(-1)"><Icon name="arrowleft" :size="14" /></button>
              <button class="date-btn" type="button" title="回到今天" @click="todayDate = new Date()">{{ formatDate(todayDate) }}</button>
              <button class="icon-btn" type="button" title="后一天" aria-label="后一天" @click="shiftDate(1)"><Icon name="arrowright" :size="14" /></button>
              <span class="tool-sep" />
              <button class="quiet-btn" type="button" title="把昨天的三件事复制到今天" @click="copyYesterday"><Icon name="copy" :size="13" /> 复制昨日</button>
              <div class="focus-more-wrap">
                <button class="icon-btn" type="button" title="更多" aria-label="更多" :aria-expanded="focusMoreOpen" @click.stop="focusMoreOpen = !focusMoreOpen"><Icon name="menu" :size="14" /></button>
                <div v-if="focusMoreOpen" class="focus-more-menu" role="presentation" data-a11y-container @click.stop>
                  <button type="button" @click="reshuffleFocus(); focusMoreOpen = false"><Icon name="shuffle" :size="13" /> 换一批</button>
                  <button type="button" @click="openFocusReview(); focusMoreOpen = false"><Icon name="sparkles" :size="13" /> AI 复核顺序</button>
                  <button type="button" @click="openExportModal(); focusMoreOpen = false"><Icon name="download" :size="13" /> 导出 CSV</button>
                  <button type="button" @click="muteFocusToday(); focusMoreOpen = false"><Icon name="eyeoff" :size="13" /> 今天别自动推荐</button>
                </div>
              </div>
            </div>
          </header>

          <div class="focus-list">
            <template v-for="c in focusCells" :key="c.idx">
              <div v-if="c.task" class="focus-row" :class="{ done: c.slot?.done }" role="button" tabindex="0"
                @click="openCellTask(c)" @keydown.enter.prevent="openCellTask(c)" @keydown.space.prevent="openCellTask(c)">
                <button class="row-check" :class="{ done: c.slot?.done }" type="button" :aria-label="c.slot?.done ? '取消完成' : '标记完成'" @click.stop="c.slot && toggleTodayDone(c.slot)">
                  <Icon v-if="c.slot?.done" name="check" :size="14" />
                </button>
                <div class="row-main">
                  <div class="row-title">
                    <NewBadge :at="c.task.createdAt" />
                    <span class="title-text">{{ c.slot?.text }}</span>
                    <span v-if="c.slot?.auto === true" class="rec" data-testid="focus-rec"><Icon name="sparkle" :size="11" /> 荐</span>
                  </div>
                  <div class="row-meta">
                    <span><Icon name="package" :size="12" /> {{ projectName(c.task.projectId) }}</span>
                    <span><Icon name="target" :size="12" /> {{ metricName(c.task.metricId) }}</span>
                    <span v-if="c.task.subtasks?.length"><Icon name="corner" :size="12" /> 子任务 {{ c.task.subtasks.filter(s => s.done).length }}/{{ c.task.subtasks.length }}</span>
                    <AssetBadge v-if="taskAssetsOn && c.task.assets?.length" :assets="c.task.assets" />
                    <MaturityBadge :m="taskMaturity(c.task)" />
                  </div>
                </div>
                <div class="row-side">
                  <span class="status" :class="taskStatusClass(c.task.status)"><Icon :name="taskStatusIcon(c.task.status)" :size="11" /> {{ taskStatusLabel(c.task.status) }}</span>
                  <Icon name="arrowright" :size="14" class="row-chevron" />
                </div>
                <button class="row-remove" type="button" title="移出今日三件事（任务本体仍在任务库）" aria-label="移出今日三件事" @click.stop="removeTodaySlot(c.idx)"><Icon name="x" :size="13" /></button>
              </div>

              <div v-else-if="c.slot && c.slot.sourceType === 'task'" class="focus-row stale-row" role="button" tabindex="0" @click="openPicker(c.idx)" @keydown.enter.prevent="openPicker(c.idx)">
                <span class="row-index">{{ String(c.idx + 1).padStart(2, '0') }}</span>
                <div class="row-main">
                  <div class="row-title"><Icon name="warn" :size="14" /><span class="title-text">{{ c.slot.text || '原任务已失效' }}</span></div>
                  <div class="row-meta"><span>源任务已删除或归档 · 点这一行原位重新选取</span></div>
                </div>
                <span class="stale-action">重新选取 <Icon name="arrowright" :size="13" /></span>
                <button class="row-remove" type="button" title="移出今日三件事" aria-label="移出今日三件事" @click.stop="removeTodaySlot(c.idx)"><Icon name="x" :size="13" /></button>
              </div>

              <div v-else-if="c.slot" class="focus-row non-task-row">
                <button class="row-check" :class="{ done: c.slot.done }" type="button" :aria-label="c.slot.done ? '取消完成' : '标记完成'" @click.stop="toggleTodayDone(c.slot)">
                  <Icon v-if="c.slot.done" name="check" :size="14" />
                </button>
                <div class="row-main">
                  <div class="row-title"><span class="title-text">{{ c.slot.text }}</span></div>
                  <div class="row-meta"><span><Icon :name="c.slot.sourceType === 'text' ? 'edit' : 'package'" :size="12" /> {{ focusSlotSourceLabel(c.slot) }}</span><span>不参与六层链</span></div>
                </div>
                <div class="row-side"><span class="status" :class="c.slot.done ? 'done' : 'todo'">{{ c.slot.done ? '已完成' : '未完成' }}</span></div>
                <button class="row-remove" type="button" title="移出今日三件事" aria-label="移出今日三件事" @click.stop="removeTodaySlot(c.idx)"><Icon name="x" :size="13" /></button>
              </div>

              <div v-else class="focus-row empty-row" role="button" tabindex="0" @click="openPicker(c.idx)" @keydown.enter.prevent="openPicker(c.idx)" @keydown.space.prevent="openPicker(c.idx)">
                <span class="empty-plus"><Icon name="plus" :size="14" /></span>
                <div class="row-main">
                  <div class="row-title empty-title">从任务库选取</div>
                  <div class="row-meta"><span>计划位 {{ c.idx + 1 }} · 选中后会立即打开右侧详情</span></div>
                </div>
                <Icon name="arrowright" :size="14" class="row-chevron" />
              </div>
            </template>
          </div>

          <div v-if="focusAllDone" class="done-banner"><Icon name="check" :size="13" /> 今日三件事已闭环 · 专注带来从容</div>
          <footer class="board-foot">
            <span><Icon name="clock" :size="12" /> 整行点开详情 · 左侧勾选才算完成</span>
            <span class="board-foot-spacer" />
            <span>Ctrl + ← / → 切换日期</span>
          </footer>
        </section>

        <section ref="handBoardRef" class="hand-board" aria-labelledby="handTitle">
          <header class="hand-head">
            <div class="hand-heading">
              <span class="board-ico"><Icon name="layers" :size="18" /></span>
              <div>
                <h2 id="handTitle">手边的卡</h2>
                <span class="hand-kicker">三池 · 只预览最近在用的 · 新建走扩展快捷键</span>
              </div>
            </div>
            <!-- V3.9.18：三列改三池页签（原型手边的卡）——列结构与字符串锚保留，仅显示态切换 -->
            <div class="hand-tabs" role="tablist" aria-label="手边的卡类型">
              <button class="hand-tab" :class="{ on: handTab === 'task' }" role="tab" :aria-selected="handTab === 'task'" type="button" @click="handTab = 'task'">任务</button>
              <button class="hand-tab" :class="{ on: handTab === 'curiosity' }" role="tab" :aria-selected="handTab === 'curiosity'" type="button" @click="handTab = 'curiosity'">好奇心</button>
              <button class="hand-tab" :class="{ on: handTab === 'resource' }" role="tab" :aria-selected="handTab === 'resource'" type="button" @click="handTab = 'resource'">资源</button>
            </div>
          </header>

          <div v-if="!hasAnyPreview" class="deck-empty">
            <span class="deck-empty-icon"><Icon name="inbox" :size="22" /></span>
            <div><b>手边暂时没有卡</b><p>用扩展快捷键采集任务、好奇心或资源，采集后会回到这里展开分类。</p></div>
          </div>

          <div v-else class="hand-grid">
            <section v-show="handTab === 'task'" class="hand-col" aria-labelledby="taskColTitle">
              <header class="hand-col-head">
                <Icon name="clipboard" :size="14" />
                <b id="taskColTitle">任务卡</b>
                <span class="hand-count">{{ liveTasks.length }}</span>
                <button class="hand-link" type="button" @click="goDeck('task')">查看全部 <Icon name="arrowright" :size="12" /></button>
              </header>
              <div class="mini-list">
                <button v-for="t in previewTasks" :key="t.id" class="mini-item" type="button" @click="openTaskPreview(t)">
                  <span class="mini-check" :class="{ done: t.status === 'done' }"><Icon v-if="t.status === 'done'" name="check" :size="9" /></span>
                  <span class="mini-copy"><span class="mini-title">{{ t.title }}</span><span class="mini-meta">{{ taskDueLabel(t) }}</span></span>
                  <span class="mini-side" :class="{ 'status-doing': t.status === 'doing' }">{{ taskStatusLabel(t.status) }}</span>
                </button>
                <div v-if="!previewTasks.length" class="mini-empty">还没有任务卡</div>
              </div>
            </section>

            <section v-show="handTab === 'curiosity'" class="hand-col" aria-labelledby="curioColTitle">
              <header class="hand-col-head">
                <Icon name="bulb" :size="14" />
                <b id="curioColTitle">好奇心卡</b>
                <span class="hand-count">{{ liveCuriosities.length }}</span>
                <button class="hand-link" type="button" @click="goDeck('curiosity')">查看全部 <Icon name="arrowright" :size="12" /></button>
              </header>
              <div class="mini-list">
                <button v-for="c in previewCuriosities" :key="c.id" class="mini-item" type="button" @click="openCurioPreview(c)">
                  <Icon name="bulb" :size="13" class="mini-leading" />
                  <span class="mini-copy"><span class="mini-title">{{ c.question }}</span><span class="mini-meta">{{ curioStatusLabel(c) }} · {{ fmtShortDate(c.updatedAt || c.createdAt) }}</span></span>
                  <span class="mini-side">{{ c.callCount || 0 }}</span>
                </button>
                <div v-if="!previewCuriosities.length" class="mini-empty">还没有好奇心卡</div>
              </div>
            </section>

            <section v-show="handTab === 'resource'" class="hand-col" aria-labelledby="resColTitle">
              <header class="hand-col-head">
                <Icon name="filetext" :size="14" />
                <b id="resColTitle">资源卡</b>
                <span class="hand-count">{{ liveResources.length }}</span>
                <button class="hand-link" type="button" @click="goDeck('resource')">查看全部 <Icon name="arrowright" :size="12" /></button>
              </header>
              <div class="mini-list">
                <button v-for="r in previewResources" :key="r.id" class="mini-item" type="button" @click="openResourcePreview(r)" @dblclick="openResourceLink(r)">
                  <Icon :name="r.linkType === 'file' ? 'filetext' : r.link ? 'link' : 'package'" :size="13" class="mini-leading" />
                  <span class="mini-copy"><span class="mini-title">{{ r.title }}</span><span class="mini-meta">{{ resourceKindLabel(r) }} · {{ fmtShortDate(r.lastCalledAt || r.updatedAt) }}</span></span>
                  <span class="mini-side">{{ r.callCount || 0 }}</span>
                </button>
                <div v-if="!previewResources.length" class="mini-empty">还没有资源卡</div>
              </div>
            </section>
          </div>
        </section>

        <footer class="page-foot">
          <button class="foot-status" :class="{ error: !storageOk }" type="button" :title="storageOk ? '点击查看存储用量' : '点击重试写入'" @click="onStorageClick">
            <span class="save-dot" /><span>{{ storageText }}</span>
          </button>
          <span class="foot-sync">
            <button class="foot-status" :class="{ error: !!atSyncErr }" type="button" :title="atChipTitle" @click="onSyncChipClick">
              <span>{{ atChipText }}</span>
            </button>
            <button class="foot-gear" type="button" title="Airtable 同步设置" aria-label="Airtable 同步设置" @click="router.push('/settings?page=airtable')"><Icon name="settings" :size="12" /></button>
          </span>
          <span class="foot-spacer" />
        </footer>
      </main>

      <aside class="side-rail" aria-label="案头侧栏">
        <section class="rail-panel">
          <header class="rail-head">
            <b>今天的状态</b>
            <button type="button" @click="openReview">战报</button>
          </header>
          <div class="stat-list">
            <!-- V3.9.18：读数改「今日入台 / 今日调出 / 未归档」（原型右栏）；本周复用挪最近调出头部。
                 V3.9.22：主攻只在这里保留——页头锚行与主栏面板都已退役。
                 口径与战报事件日志不同源，tooltip 与明细 note 明示，不冒充同源。 -->
            <button class="stat-row" type="button" title="口径：今日 0 点起新建的三类卡（按创建时间）；与今日战报的事件计次口径不同" @click="openStatusDetail('in')">
              <span class="sk">今日入台</span>
              <span class="sv">{{ todayInCount }} 张</span>
              <span class="se">明细</span>
            </button>
            <button class="stat-row" type="button" title="口径：今日 0 点起 lastCalledAt 落在今日的资源卡张数；与今日战报的事件计次口径不同" @click="openStatusDetail('out')">
              <span class="sk">今日调出</span>
              <span class="sv">{{ todayOutCount }} 张</span>
              <span class="se">明细</span>
            </button>
            <!-- V3.9.22：主攻最多两个，同一行并列。项目名各自可点并打开可编辑项目详情；
                 不展示「下一步 / 完成度」，也不再恢复主攻卡片面板。 -->
            <div v-if="mainFocus || extraFocus" class="stat-row stat-row-focus">
              <span class="sk">主攻</span>
              <span class="stat-focus-links">
                <button v-if="mainFocus" class="stat-focus-link" type="button"
                  :title="`${mainFocus.name} · 打开可编辑项目详情`" @click="openFocusProject(mainFocus)">{{ mainFocus.name }}</button>
                <button v-if="extraFocus" class="stat-focus-link" type="button"
                  :title="`${extraFocus.name} · 打开可编辑项目详情`" @click="openFocusProject(extraFocus)">{{ extraFocus.name }}</button>
              </span>
            </div>
            <button v-else class="stat-row stat-row-empty" type="button" @click="router.push('/compass')">
              <span class="sk">主攻</span>
              <span class="sv">尚未指定</span>
              <span class="se">去方向台</span>
            </button>
            <button class="stat-row" type="button" @click="openStatusDetail('unarchived')">
              <span class="sk">未归档</span>
              <span class="sv">{{ archivedCount }} / {{ liveTasks.length }} 件任务</span>
              <span class="se">去归位</span>
            </button>
          </div>
        </section>

        <section ref="recentPanelRef" class="rail-panel rail-panel-recent">
          <header class="rail-head">
            <b>最近调出</b>
            <button class="rail-chip" type="button" title="口径：本周一 0 点起被打开过的资源卡（wrr 周戳）；跨周清零" @click="openStatusDetail('reuse')">本周 {{ weeklyReuse }} 次</button>
            <button type="button" @click="goDeck('resource')">全部</button>
          </header>
          <div v-if="recentResources.length" class="recent-list">
            <button v-for="r in recentResources" :key="r.id" class="recent-item" type="button" :title="r.link ? '单击打开链接 · 打不开则滑出详情' : '单击滑出详情'" @click="openRecentResource(r)">
              <Icon :name="r.linkType === 'file' ? 'filetext' : r.link ? 'link' : 'package'" :size="13" />
              <span class="recent-copy"><span class="recent-title">{{ r.title }}</span><span class="recent-meta">{{ fmtRecentTime(r.lastCalledAt) }} · 打开 {{ r.callCount || 0 }} 次</span></span>
            </button>
          </div>
          <div v-else class="rail-empty">还没有调出记录。打开一张资源卡后，会出现在这里。</div>
        </section>

        <!-- V3.9.18：好奇心培育（原型右栏）——独立类名，不进 rail-panel 等高机制、不碰 mini-list×3 计数锚。
             好奇与资源互不挂载；「转为任务」在好奇心卡池操作（CuriosityPanel），沿六层链归位。 -->
        <section class="curio-panel" aria-label="好奇心培育">
          <header class="rail-head">
            <b>好奇心培育</b>
            <button type="button" @click="goDeck('curiosity')">卡池</button>
          </header>
          <div class="curio-list">
            <button v-for="c in nurtureCuriosities" :key="c.id" class="mini-item" type="button" :title="'去好奇心卡池查看：' + c.question" @click="openCurioPreview(c)">
              <Icon name="bulb" :size="13" class="mini-leading" />
              <span class="mini-copy"><span class="mini-title">{{ c.question }}</span><span class="mini-meta">{{ curioStatusLabel(c) }} · {{ fmtShortDate(c.updatedAt || c.createdAt) }}</span></span>
            </button>
            <div v-if="!nurtureCuriosities.length" class="curio-empty">还没有好奇心——用快捷键接住一个念头。</div>
          </div>
          <p class="curio-note">好奇与资源互不挂载；「转为任务」在卡池内操作，沿六层链归位。</p>
        </section>

        <div class="rail-foot"><Icon name="shield" :size="14" /> 只存本机 · 无账号 · 可随时导出</div>
      </aside>
    </div>

    <TodayBattleHost ref="battleHost" />
    <ProjectDetailDrawer :open="readonlyProjectOpen" :project-id="readonlyProjectId" mode="modal"
      @close="readonlyProjectOpen = false" />

    <!-- ★W17-C01：三行状态明细（中央只读弹窗，不跳路由） -->
    <CompassStatusModal :open="!!statusDetail" :kind="statusDetail || 'focus'"
      :title="statusDetailTitle" :note="statusDetailNote" :items="statusDetailItems"
      :empty-text="statusDetailEmpty" @close="closeStatusDetail" @item-action="onStatusItemAction" />

    <!-- ★W17-C02：useResourceOpen 的图片附件就地预览（zy-asset:// 图片卡，与 Workspace 同一壳） -->
    <AssetPreview :open="previewOpen" :url="previewUrl" :name="previewName" @close="closePreview" />

    <Transition name="fade">
      <div v-if="pickerOpen" class="overlay" @click="pickerOpen = false" />
    </Transition>
    <Transition name="modal">
      <div v-if="pickerOpen" class="picker-modal" role="dialog" aria-modal="true" aria-labelledby="pickerTitle">
        <header class="pm-head">
          <div><span id="pickerTitle"><Icon name="filetext" :size="13" /> 选择今天要做的事</span><small>今日计划位 {{ todayFocusList.length }} / 3</small></div>
          <button class="pm-close" type="button" aria-label="关闭" @click="pickerOpen = false"><Icon name="x" :size="15" /></button>
        </header>
        <div class="pm-body">
          <div class="pm-filters">
            <label class="search-box pm-search-flat"><Icon name="search" :size="13" /><input v-model="pickerSearch" placeholder="搜索任务标题…" autofocus></label>
            <select v-model="pickerProject" class="pm-select" title="按项目筛选任务">
              <option value="">全部项目</option>
              <option value="__none__">未关联项目（{{ pickerProjectOptions.none }}）</option>
              <option v-for="o in pickerProjectOptions.opts" :key="o.id" :value="o.id">{{ o.name }}（{{ o.n }}）</option>
            </select>
            <select v-model="pickerStatus" class="pm-select pm-status" title="按任务状态筛选">
              <option value="all">全部状态</option>
              <option value="todo">待开始</option>
              <option value="doing">进行中</option>
            </select>
          </div>
          <div class="pm-summary"><span>{{ pickerCandidates.length }} 个可选任务</span><span>已完成和已选入的任务会置灰</span></div>
          <div class="picker-list">
            <button v-for="task in pickerCandidates" :key="task.id" class="picker-item" :class="{ disabled: pickerDisabled(task) }" type="button" :disabled="pickerDisabled(task)" @click="selectTaskGuarded(task)">
              <span class="pi-check" :class="{ disabled: pickerDisabled(task) }"><Icon :name="pickerDisabled(task) ? 'check' : 'plus'" :size="12" /></span>
              <span class="pi-info">
                <span class="pi-title">{{ task.title }}</span>
                <span class="pi-meta">
                  <span class="tag accent">{{ projectName(task.projectId) }}</span>
                  <span class="tag" :class="taskStatusClass(task.status)"><Icon :name="taskStatusIcon(task.status)" :size="11" /> {{ taskStatusLabel(task.status) }}</span>
                  <span v-if="pickedIds.has(task.id)" class="tag">已选入</span>
                  <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" />
                </span>
              </span>
              <Icon name="arrowright" :size="13" class="pi-go" />
            </button>
            <div v-if="!pickerCandidates.length" class="picker-empty">
              <Icon name="search" :size="22" />
              <b>没有匹配的任务</b>
              <span>换个关键词，或清空项目与状态筛选。</span>
              <button class="quiet-btn" type="button" @click="clearFocusSelection">清空筛选</button>
            </div>
          </div>
        </div>
        <footer class="pm-foot"><span>选中后会立即打开右侧任务详情。</span><button class="quiet-btn" type="button" @click="pickerOpen = false">取消</button></footer>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="exportOpen" class="overlay" @click="exportOpen = false" />
    </Transition>
    <Transition name="modal">
      <div v-if="exportOpen" class="picker-modal pm-modal-export" role="dialog" aria-modal="true" aria-labelledby="exportTitle">
        <header class="pm-head">
          <div><span id="exportTitle"><Icon name="download" :size="13" /> 导出三件事任务（CSV）</span></div>
          <button class="pm-close" type="button" aria-label="关闭" @click="exportOpen = false"><Icon name="x" :size="15" /></button>
        </header>
        <div class="pm-body">
          <div class="ts-label-pm">时间范围（按三件事安排日期）</div>
          <div class="pm-date-row">
            <input v-model="exportFrom" type="date" class="pm-date-input" aria-label="开始日期">
            <span class="pm-date-sep">›</span>
            <input v-model="exportTo" type="date" class="pm-date-input" aria-label="结束日期">
          </div>
          <div class="pm-export-desc">导出字段：任务内容 / 所属项目 / 项目›成功指标 / 任务状态 / 安排时间 / 创建时间</div>
        </div>
        <footer class="pm-foot"><span>导出为 UTF-8 CSV，可直接用表格软件打开。</span><button class="quiet-btn" type="button" @click="exportOpen = false">取消</button><button class="primary-btn" type="button" :disabled="exportBusy" @click="doExport"><Icon v-if="!exportBusy" name="download" :size="13" />{{ exportBusy ? '导出中…' : '导出 CSV' }}</button></footer>
      </div>
    </Transition>

    <TaskDetailDrawer ref="drawerRef" />
    <AiDrawer v-if="focusJob" :job="focusJob" @close="focusJob = null" />
  </div>
</template>

<style scoped>
/* V3.9.1 · 方案 B：左侧主工作区 + 右侧案头栏。
   页面只承担“今天先做什么”和“手边有什么”，管理动作进入独立二级页。 */
.page {
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: 18px 36px 72px;
}

.desk-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}
.desk-heading { min-width: 0; }
.desk-kicker {
  margin-bottom: 6px;
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-weight: 700;
  letter-spacing: 1.35px;
  text-transform: uppercase;
}
.desk-heading h1 {
  color: var(--text);
  font-size: clamp(26px, 2.4vw, 34px);
  font-weight: 700;
  line-height: 1.14;
  letter-spacing: -.035em;
}
.desk-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.why-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
  font-family: inherit;
  font-size: var(--fs-caption);
  cursor: pointer;
  transition: border-color var(--dur), background var(--dur), color var(--dur);
}
.desk-actions .battle-trigger { margin-left: auto; }
.why-trigger:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
  color: var(--text);
}
.why-trigger { color: var(--text-3); }
.why-trigger.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.why-dot {
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: var(--accent);
}

.desk-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  align-items: start;
  gap: 22px;
}
.desk-main { min-width: 0; }

/* ── 今日三件事：一张工作单里的三行 ── */
.work-board,
.hand-board {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.work-board { border-color: var(--border-strong); box-shadow: var(--shadow-lg); }
.work-board.all-done { background: color-mix(in srgb, var(--surface-2), var(--surface)); }
.board-head,
.hand-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.board-head {
  min-height: 64px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
}
.board-title,
.hand-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.board-ico {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: var(--radius-sm);
  background: var(--accent-light);
  color: var(--accent-ink);
}
.board-title h2,
.hand-heading h2 {
  color: var(--text);
  font-size: var(--fs-headline);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -.015em;
}
.board-count,
.hand-kicker {
  display: block;
  margin-top: 2px;
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
}
.hand-kicker { letter-spacing: .07em; text-transform: uppercase; }
.board-tools { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
.icon-btn,
.date-btn,
.quiet-btn,
.primary-btn,
.hand-link,
.foot-status,
.rail-head button,
.row-remove {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-3);
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--dur), background var(--dur), color var(--dur);
}
.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
}
.icon-btn:hover,
.quiet-btn:hover,
.hand-link:hover,
.rail-head button:hover {
  border-color: var(--border);
  background: var(--surface-2);
  color: var(--text);
}
.date-btn,
.quiet-btn {
  min-height: 30px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-caption);
  font-weight: 600;
  white-space: nowrap;
}
.date-btn { color: var(--text-2); font-variant-numeric: tabular-nums; }
.tool-sep { width: 1px; height: 16px; margin: 0 4px; background: var(--border); }
.quiet-btn { display: inline-flex; align-items: center; gap: 5px; }
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border-color: var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-size: var(--fs-caption);
  font-weight: 700;
}
.primary-btn:hover { border-color: var(--accent-hover); background: var(--accent-hover); }
.primary-btn:disabled,
.quiet-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.focus-more-wrap { position: relative; }
.focus-more-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: var(--z-popover);
  width: 180px;
  padding: 5px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.focus-more-menu button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 31px;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-family: inherit;
  font-size: var(--fs-caption);
  text-align: left;
  cursor: pointer;
}
.focus-more-menu button:hover { background: var(--surface-2); color: var(--text); }

/* V3.9.18 密度接通（04-73 D-1(a)）：行卡读 --card-pad-vert 与 --card-gap 令牌，紧凑档真实生效。
   注：第一行保持 R50-4/R52-6/R56-6 的原字符串锚不动，gap 单列一条（同选择器合并，非覆盖）。 */
.focus-list { display: flex; flex-direction: column; }
.focus-list { gap: var(--card-gap); }
.focus-row {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 12px;
  min-height: 74px;
  padding: var(--card-pad-vert) var(--card-pad-horz);
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: background var(--dur), box-shadow var(--dur);
}
.focus-row:hover { background: var(--surface-2); }
.focus-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.focus-row.done { opacity: .65; }
.focus-row.done .title-text { text-decoration: line-through; color: var(--text-3); }
.row-check {
  display: grid;
  place-items: center;
  /* 视觉上的勾选框仍由 ::before 保持 20px；按钮本体撑到 28px 热区，避免点不中。 */
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: border-color var(--dur), background var(--dur);
}
.row-check::before { content: ''; width: 20px; height: 20px; border: 1.5px solid var(--border-strong); border-radius: 5px; background: var(--surface); transition: border-color var(--dur), background var(--dur); }
.row-check svg { position: relative; z-index: 1; grid-area: 1 / 1; }
.row-check::before { grid-area: 1 / 1; }
.row-check:hover::before { border-color: var(--accent); }
.row-check.done::before { border-color: var(--accent); background: var(--accent); }
.row-main { min-width: 0; }
.row-title { display: flex; align-items: center; gap: 6px; min-width: 0; }
.title-text {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-body);
  font-weight: 650;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rec {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px dashed color-mix(in srgb, var(--accent) 65%, var(--border));
  border-radius: 99px;
  background: var(--accent-light);
  color: var(--accent-ink);
  font-size: var(--fs-micro);
  font-weight: 700;
}
.row-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 4px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.row-meta > span { display: inline-flex; align-items: center; gap: 3px; min-width: 0; }
.row-side { display: flex; align-items: center; gap: 8px; }
.status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--text-2);
  font-size: var(--fs-micro);
  font-weight: 600;
  white-space: nowrap;
}
.status.doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.status.done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.row-chevron { color: var(--text-4); }
.row-remove {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  opacity: .48;
}
.row-remove:hover { border-color: var(--danger-border); background: var(--danger-bg-soft); color: var(--danger); opacity: 1; }
.row-index {
  color: var(--text-4);
  font-size: var(--fs-caption);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.stale-row { border-style: dashed; background: transparent; }
.stale-action { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); font-size: var(--fs-caption); white-space: nowrap; }
.non-task-row { cursor: default; }
.empty-row {
  min-height: 58px;
  border-bottom: 0;
  color: var(--text-3);
}
.empty-row:hover { background: color-mix(in srgb, var(--accent-light) 55%, transparent); color: var(--accent-ink); }
.empty-plus {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, var(--border));
  border-radius: var(--radius-sm);
  color: var(--accent-ink);
}
.empty-title { color: var(--text-2); font-weight: 600; }
.done-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  border-top: 1px dashed var(--border);
  background: color-mix(in srgb, var(--surface-2), transparent);
  color: var(--text-3);
  font-size: var(--fs-caption);
  letter-spacing: .02em;
}
.board-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 20px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 36%, var(--surface));
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.board-foot > span { display: inline-flex; align-items: center; gap: 4px; }
.board-foot-spacer { flex: 1; }

/* ── 手边的卡：宽屏三列 ── */
.hand-board { margin-top: 18px; }
.hand-head { min-height: 58px; padding: 12px 18px; border-bottom: 1px solid var(--border); }
/* V3.9.18：hand-summary 随三列汇总退役（计数入页签与列头）；hand-tabs 为三池页签 */
.hand-tabs { display: inline-flex; gap: 4px; padding: 3px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
.hand-tab { min-height: 28px; padding: 0 12px; border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-3); font: inherit; font-size: var(--fs-sub); font-weight: 500; cursor: pointer; transition: background var(--dur), color var(--dur); }
.hand-tab:hover { color: var(--text); }
.hand-tab.on { background: var(--surface-2); color: var(--text); }
.hand-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.deck-empty {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 22px 20px;
  color: var(--text-3);
}
.deck-empty-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
}
.deck-empty b { color: var(--text-2); font-size: var(--fs-body); }
.deck-empty p { margin-top: 3px; font-size: var(--fs-caption); line-height: 1.6; }
/* V3.9.18：三池页签后单列呈现——三段 hand-col 仍在 DOM（字符串锚保留），v-show 切换显示态 */
.hand-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
.hand-col { min-width: 0; padding: 13px 15px 15px; }
.hand-col-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  margin-bottom: 7px;
  color: var(--text-2);
}
.hand-col-head > b { font-size: var(--fs-caption); font-weight: 700; }
.hand-count {
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
}
.hand-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  min-height: 28px;
  padding: 3px 7px;
  border-radius: var(--radius-xs);
  font-weight: 600;
  font-size: var(--fs-micro);
  white-space: nowrap;
}
.mini-list { display: flex; flex-direction: column; gap: 2px; }
.mini-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: var(--card-pad-vert) 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur);
}
.mini-item:hover { background: var(--surface-2); }
.mini-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.mini-check {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  color: #fff;
}
.mini-check.done { border-color: var(--accent); background: var(--accent); }
.mini-leading { flex-shrink: 0; color: var(--text-3); }
.mini-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.mini-title {
  overflow: hidden;
  color: var(--text-2);
  font-size: var(--fs-caption);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-meta {
  overflow: hidden;
  color: var(--text-3);
  font-size: var(--fs-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-side {
  flex-shrink: 0;
  color: var(--text-4);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
}
.mini-side.status-doing { color: var(--warning); }
.mini-empty {
  padding: 18px 7px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-3);
  font-size: var(--fs-caption);
  text-align: center;
}

/* ── 页脚 ── */
.page-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 42px;
  margin-top: 10px;
  padding: 4px 2px;
}
.foot-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 3px 7px;
  border-radius: var(--radius-xs);
  font-size: var(--fs-micro);
}
.foot-status:hover { background: var(--surface-2); color: var(--text-2); }
.foot-status.error { color: var(--danger); }
.foot-sync { display: inline-flex; align-items: center; gap: 2px; }
.save-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 99px;
  background: var(--success);
}
.foot-status.error .save-dot { background: var(--danger); animation: savePulse 1.2s ease-in-out infinite; }
@keyframes savePulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.foot-gear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 3px;
}
.foot-gear:hover { background: var(--surface-3); color: var(--text); }
.foot-spacer { flex: 1; }

/* ── 右侧案头栏 ── */
.side-rail {
  position: sticky;
  top: 76px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
/* ★W17-C03（2026-10-20 用户拍板 · 方案 C）：右栏两块面板与左栏卡片等高。
   高度由 useEqualHeight 用 ResizeObserver 量出来写进 --rail-top-h / --rail-bottom-h（页面根继承）；
   量不到时回退 auto —— 右栏绝不被压成 0 高，也不会强行拉伸内部元素。
   1200px 以下降级单列（见下方媒体查询），不强制等高。 */
.rail-panel:not(.rail-panel-recent) { height: var(--rail-top-h, auto); display: flex; flex-direction: column; }
.rail-panel:not(.rail-panel-recent) .stat-list { min-height: 0; }
.rail-panel-recent { height: var(--rail-bottom-h, auto); display: flex; flex-direction: column; }
.recent-list { flex: 1; min-height: 0; overflow-y: auto; }
.rail-panel .rail-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.rail-panel {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 9px 13px;
  border-bottom: 1px solid var(--border);
}
.rail-head b { color: var(--text-2); font-size: var(--fs-caption); font-weight: 700; }
/* V3.9.18：「本周 N 次」读数 chip（本周复用自状态行迁至最近调出头部，判据 openStatusDetail('reuse') 不变） */
.rail-chip {
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-3);
  font: inherit;
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.rail-chip:hover { background: var(--surface-2); color: var(--text); }
.rail-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
/* V3.9.18：好奇心培育面板——独立类名，不进 rail-panel 等高机制（--rail-top/bottom-h 只量前两块）、
   不用 mini-list 类名（保住 98-r4-gates 的 mini-list×3 计数锚）；行样式复用 .mini-item。 */
.curio-panel { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); }
.curio-list { display: flex; flex-direction: column; gap: 2px; padding: 0 6px; }
.curio-empty { padding: 18px 14px; color: var(--text-3); font-size: var(--fs-sub); }
.curio-note { margin: 0; padding: 8px 14px 10px; border-top: 1px solid var(--border); color: var(--text-4); font-size: var(--fs-caption); line-height: 1.5; }
.rail-head button {
  min-height: 28px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: var(--fs-micro);
}
.stat-list { display: flex; flex-direction: column; }
/* V3.9.22：主攻回到「今天的状态」；同一行并列最多两个项目名，名称各自可点。 */
.stat-row {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: var(--card-pad-vert) var(--card-pad-horz);
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.stat-row-focus { cursor: default; }
.stat-row-focus:hover { background: transparent; }
.stat-focus-links { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; min-width: 0; }
.stat-focus-link {
  max-width: 100%;
  overflow: hidden;
  padding: 2px 4px;
  margin-left: -4px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: var(--fs-sub);
  font-weight: 600;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.stat-focus-link:hover { color: var(--accent-ink); background: var(--surface-2); }
.stat-focus-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.stat-row:last-child { border-bottom: 0; }
.stat-row:hover { background: var(--surface-2); }
.stat-row:disabled { cursor: default; opacity: .72; }
.sk { color: var(--text-3); font-size: var(--fs-micro); }
.sv {
  min-width: 0;
  overflow: hidden;
  color: var(--text-2);
  font-size: var(--fs-caption);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.se { color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.se.accent { color: var(--accent-ink); font-weight: 700; }
.recent-list { display: flex; flex-direction: column; padding: 5px; }
.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 6px 7px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.recent-item:hover { background: var(--surface-2); color: var(--text); }
.recent-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.recent-title {
  overflow: hidden;
  font-size: var(--fs-caption);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-meta { color: var(--text-3); font-size: var(--fs-micro); }
.rail-empty { padding: 16px 13px; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; }
.rail-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}

/* ── 推荐依据浮层 ── */
.focus-why {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: var(--z-popover);
  width: 350px;
  max-width: calc(100vw - 32px);
  padding: 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.fw-h { margin-bottom: 5px; color: var(--text); font-size: var(--fs-sub); font-weight: 700; }
.fw-h .hint { color: var(--text-3); font-size: var(--fs-caption); font-weight: 400; }
.fw-row { display: flex; gap: 8px; padding: 7px 0; border-top: 1px solid var(--border); }
.fw-row .n { flex-shrink: 0; padding-top: 2px; color: var(--text-4); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.fw-row .b { min-width: 0; flex: 1; }
.fw-row .t { color: var(--text-2); font-size: var(--fs-caption); font-weight: 600; }
.fw-row .t.off { color: var(--text-3); font-weight: 400; }
.fw-row .w { margin-top: 2px; color: var(--text-3); font-size: var(--fs-micro); line-height: 1.6; }
.fw-row .ai-tag { color: var(--accent-ink); }
.fw-f { margin-top: 5px; padding-top: 8px; border-top: 1px dashed var(--border); color: var(--text-3); font-size: var(--fs-micro); line-height: 1.7; }
.fw-acts { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }

/* ── 选择任务弹窗 ── */
.overlay { position: fixed; inset: 0; z-index: var(--z-overlay); background: var(--overlay-bg); }
.picker-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: calc(var(--z-overlay) + 1);
  display: flex;
  flex-direction: column;
  width: 620px;
  max-width: min(92vw, 620px);
  max-height: min(76vh, 760px);
  overflow: hidden;
  transform: translate(-50%, -50%);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.pm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.pm-head > div:first-child { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pm-head span { display: inline-flex; align-items: center; gap: 6px; color: var(--text); font-size: var(--fs-body); font-weight: 700; }
.pm-head small { color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.pm-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
.pm-close:hover { border-color: var(--border); background: var(--surface-2); color: var(--text); }
.pm-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 18px; }
.pm-filters { display: flex; align-items: center; gap: 7px; }
.pm-select {
  min-width: 128px;
  max-width: 190px;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  background: var(--surface);
  color: var(--text-2);
  font-family: inherit;
  font-size: var(--fs-caption);
  cursor: pointer;
}
.pm-select:hover,
.pm-select:focus { border-color: var(--accent); color: var(--text); }
.pm-status { min-width: 96px; }
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-3);
}
.search-box:focus-within { border-color: var(--accent); }
.search-box input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: var(--fs-caption);
}
.search-box.pm-search-flat { margin: 0; flex: 1; }
.pm-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 1px 7px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.picker-list { display: flex; flex-direction: column; gap: 3px; }
.picker-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 52px;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.picker-item:hover:not(:disabled) { border-color: color-mix(in srgb, var(--accent) 38%, var(--border)); background: var(--accent-light); }
.picker-item:disabled { cursor: default; opacity: .5; }
.pi-check {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 99px;
  background: var(--accent);
  color: #fff;
}
.pi-check.disabled { background: var(--surface-3); color: var(--text-3); }
.pi-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.pi-title { overflow: hidden; color: var(--text); font-size: var(--fs-caption); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.pi-meta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--tag-neutral-bg);
  color: var(--tag-neutral-text);
  font-size: var(--fs-micro);
  white-space: nowrap;
}
.tag.accent { background: var(--accent-light); color: var(--accent-ink); }
.tag.doing { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.done { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.pi-go { flex-shrink: 0; color: var(--text-3); }
.picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 16px;
  color: var(--text-3);
  text-align: center;
}
.picker-empty b { color: var(--text-2); font-size: var(--fs-body); }
.picker-empty span { font-size: var(--fs-caption); }
.picker-empty .quiet-btn { margin-top: 4px; }
.pm-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 50px;
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.pm-foot > span { flex: 1; }
.pm-modal-export { width: 430px; max-width: min(92vw, 430px); }
.ts-label-pm { margin-bottom: 7px; color: var(--text-3); font-size: var(--fs-caption); font-weight: 600; }
.pm-date-row { display: flex; align-items: center; gap: 8px; }
.pm-date-input {
  min-width: 0;
  flex: 1;
  min-height: 34px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  background: var(--surface-2);
  color: var(--text);
  font-family: inherit;
  font-size: var(--fs-caption);
}
.pm-date-input:focus { border-color: var(--accent); }
.pm-date-sep { color: var(--text-3); }
.pm-export-desc { margin-top: 10px; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.65; }

.fade-enter-active,
.fade-leave-active { transition: opacity var(--dur-slow); }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
.modal-enter-active,
.modal-leave-active { transition: opacity var(--dur), transform var(--dur) var(--ease-emphasis); }
.modal-enter-from,
.modal-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.97); }

@media (max-width: 1120px) {
  .desk-layout { grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; }
}
@media (max-width: 960px) {
  .desk-layout { grid-template-columns: minmax(0, 1fr); }
  .side-rail { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rail-foot { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .page { padding: 14px 16px 48px; }
  .desk-head { align-items: flex-start; flex-direction: column; gap: 14px; }
  .desk-actions { justify-content: flex-start; width: 100%; }
  .board-head { align-items: flex-start; flex-direction: column; gap: 9px; padding: 13px 15px; }
  .board-tools { width: 100%; flex-wrap: wrap; }
  .focus-row { grid-template-columns: 28px minmax(0, 1fr) 28px; gap: 9px; padding: 12px 12px 12px 15px; }
  .focus-row .row-side { display: none; }
  .focus-row .row-remove { grid-column: 3; }
  .stale-action { grid-column: 2; justify-self: start; }
  .board-foot { align-items: flex-start; flex-direction: column; }
  .board-foot-spacer { display: none; }
  .side-rail { grid-template-columns: minmax(0, 1fr); }
  .pm-filters { align-items: stretch; flex-direction: column; }
  .pm-select { width: 100%; max-width: none; }
  .pm-summary span:last-child { display: none; }
  .picker-modal { max-height: 84vh; }
}
@media (prefers-reduced-motion: reduce) {
  .focus-row,
  .mini-item,
  .primary-btn,
  .why-trigger,
  .modal-enter-active,
  .modal-leave-active { transition: none; }
  .foot-status.error .save-dot { animation: none; }
}
</style>
