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
import { readEventLog, EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
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
import Drawer from '@/shared/components/Drawer.vue'
import CuriosityPanel from '../components/compass/CuriosityPanel.vue'
// R117（04-61 C1）：任务调度整体自方向台迁入调度台底部（与好奇心培育并列 tab）
import TaskManagerPanel from '../components/compass/TaskManagerPanel.vue'
import MetricBar from '../components/compass/MetricBar.vue'
// R113-N3：周报浮层此前只在模板中被引用、从未 import（项目无全局注册也无自动导入插件），
// 导致 Vue 按未解析组件渲染成空节点 → 点「📊 周报」无任何反应。
import WeeklyReportOverlay from '../components/WeeklyReportOverlay.vue'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
// R91：解构出主攻相关口径——手册「🚀 主攻（最多 2 个）直通调度台速览」此前在调度台**零消费**，
// focusedProjects 的唯一消费方在方向台的 LighthousePanel。
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

// ================= 今日记录条（R49-B1） =================
type RecItem = { id?: string; kind?: 'resource' | 'task' | 'curio'; title: string; ts: number; clickable: boolean }
const todayIn = computed<RecItem[]>(() => {
  const list: RecItem[] = []
  for (const r of d.value.resources) if (!r.deletedAt && r.createdAt >= todayStart.value) list.push({ id: r.id, kind: 'resource', title: r.title, ts: r.createdAt, clickable: true })
  for (const t of d.value.tasks) if (!t.deletedAt && t.createdAt >= todayStart.value) list.push({ id: t.id, kind: 'task', title: t.title, ts: t.createdAt, clickable: true })
  for (const c of d.value.curiosities) if (!c.deletedAt && c.createdAt >= todayStart.value) list.push({ id: c.id, kind: 'curio', title: c.question || '（无标题）', ts: c.createdAt, clickable: true })
  return list.sort((a, b) => b.ts - a.ts)
})
const todayOut = computed<RecItem[]>(() => {
  const list: RecItem[] = []
  for (const r of d.value.resources) if (r.deletedAt && r.deletedAt >= todayStart.value) list.push({ id: r.id, kind: 'resource', title: r.title, ts: r.deletedAt, clickable: true })
  for (const t of d.value.tasks) if (t.deletedAt && t.deletedAt >= todayStart.value) list.push({ id: t.id, kind: 'task', title: t.title, ts: t.deletedAt, clickable: true })
  for (const c of d.value.curiosities) if (c.deletedAt && c.deletedAt >= todayStart.value) list.push({ id: c.id, kind: 'curio', title: c.question || '（无标题）', ts: c.deletedAt, clickable: true })
  return list.sort((a, b) => b.ts - a.ts)
})
const todayCalled = computed<RecItem[]>(() => {
  const list: RecItem[] = []
  for (const r of d.value.resources) if (!r.deletedAt && (r.lastCalledAt || 0) >= todayStart.value) list.push({ id: r.id, kind: 'resource', title: r.title, ts: r.lastCalledAt || 0, clickable: true })
  for (const t of d.value.tasks) if (!t.deletedAt && (t.lastCalledAt || 0) >= todayStart.value) list.push({ id: t.id, kind: 'task', title: t.title, ts: t.lastCalledAt || 0, clickable: true })
  for (const c of d.value.curiosities) if (!c.deletedAt && (c.lastCalledAt || 0) >= todayStart.value) list.push({ id: c.id, kind: 'curio', title: c.question || '（无标题）', ts: c.lastCalledAt || 0, clickable: true })
  return list.sort((a, b) => b.ts - a.ts)
})

/** R50-F7：今日记录条副行拆解（任务/好奇/资源 分类型计数） */
const kindLabel = { task: '任务', curio: '好奇', resource: '资源' } as const
/** R52-BUG-1：写入记录口径 = 当日三卡事件（新增/删除/恢复/清理）+ 三卡调出，主计数 = 副行之和；
 *  非三卡事件（愿景/使命等系统写入）不计数，抽屉中灰显可见 */
const CARD_KINDS = new Set(['task', 'curiosity', 'resource'])
const logCount = computed(() =>
  logRaw.value.filter(e => CARD_KINDS.has(e.kind)).length + todayCalled.value.length)
const logItems = ref<RecItem[]>([])
const logRaw = ref<{ action: string; kind: string; title: string; ts: number }[]>([])
const ACT_LABEL = EVENT_ACT_LABEL
async function loadEventLog() {
  try {
    const all = await readEventLog()
    const todays = all.filter(e => e.ts >= todayStart.value)
    logRaw.value = todays
    // R52-BUG-1：写入记录明细 = 三卡事件 + 当日调出 + 系统事件（灰显不计数），按时间降序
    logItems.value = ([
      ...todays.filter(e => CARD_KINDS.has(e.kind)).map(e => ({
        kind: (e.kind === 'curiosity' ? 'curio' : e.kind === 'task' ? 'task' : 'resource') as RecItem['kind'],
        title: `${ACT_LABEL[e.action] || e.action} · ${e.title}`, ts: e.ts, clickable: false
      })),
      ...todayCalled.value.map(it => ({ id: it.id, kind: it.kind, title: `调出 · ${it.title}`, ts: it.ts, clickable: true })),
      ...todays.filter(e => !CARD_KINDS.has(e.kind)).map(e => ({
        kind: undefined, title: `系统 · ${ACT_LABEL[e.action] || e.action} · ${e.title}`, ts: e.ts, clickable: false
      }))
    ] as RecItem[]).sort((a, b) => b.ts - a.ts)
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
  // R117（04-61 B）：统一走 locateTargetOf —— 资源卡带所在分类、任务/好奇卡带 hk 分派，
  // 不再各写一份（旧实现里任务卡指向方向台 /compass?zone=task，随本轮的模块搬迁失效）
  const kind = asLocateKind(x.kind || '')
  if (!kind) return
  const t = locateTargetOf(d.value, kind, x.id)
  if (!t) { showToast('⚠ 该卡片已不在库中'); return }
  void router.push(t)
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
const projTasks = computed(() => (curProject.value ? projectTasksOf(curProject.value.id) : []))
const projDoneCount = computed(() => projTasks.value.filter(t => t.status === 'done').length)
const projDoingCount = computed(() => projTasks.value.filter(t => t.status === 'doing').length)
/** 按成功指标分组（+ 未归类），空指标组隐藏；R52-F2：默认全部展开，可手动折叠 */
const metricGroups = computed(() => {
  const p = curProject.value
  if (!p) return []
  const groups = p.metrics.map(m => ({ key: m.id, title: m.title, tasks: projTasks.value.filter(t => t.metricId === m.id) }))
  const mids = new Set(p.metrics.map(m => m.id))
  const orphan = projTasks.value.filter(t => !t.metricId || !mids.has(t.metricId))
  if (orphan.length) groups.push({ key: '__none__', title: '未归类任务', tasks: orphan })
  return groups
})
/**
 * R94（B2）：项目调度右侧任务树**默认折叠**——提案原文「默认只显示左侧摘要；
 * 右侧任务树默认折叠，或改为点击任务后滑出的右侧抽屉」。
 *
 * 本轮选**默认折叠**而非抽屉：抽屉要新建组件 + 遮罩 + 焦点管理，且会引入第二套
 * 任务编辑入口（现有点任意任务即 `drawerRef?.open(t)` 开详情，再套一层是重复）。
 * 折叠方案复用既有结构，回退只是把 `ref(false)` 改成 `ref(true)`，收益点完全一致。
 *
 * ⚠ **不持久化**：写进 UIPrefs 会变成"记住上次"，与"默认折叠"矛盾（首屏就不再干净了）。
 *   同一会话内切换项目**不重置** —— 用户已经表达要看，切个项目不该收回去。
 */
const curTreeOpen = ref(false)
/** R54-B1：项目调度左右分栏拖拽（左列 30–75%，持久化 UIPrefs.curSplit） */
const curSplit = ref(Math.min(75, Math.max(30, store.ui?.curSplit ?? 38)))
let splitDragging = false
function startCurSplitDrag(e: MouseEvent) {
  e.preventDefault()
  splitDragging = true
  const container = (e.currentTarget as HTMLElement).parentElement
  if (!container) return
  const move = (ev: MouseEvent) => {
    const rect = container.getBoundingClientRect()
    const pct = Math.min(75, Math.max(30, ((ev.clientX - rect.left) / rect.width) * 100))
    curSplit.value = Math.round(pct)
  }
  const up = () => {
    splitDragging = false
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    saveUIPrefs({ curSplit: curSplit.value })
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
const curColsStyle = computed(() =>
  // R94（B2）：任务树折叠时左列独占一行（首屏只显示"项目 + 进度 + 四指标"的摘要）
  curTreeOpen.value ? `minmax(0, ${curSplit.value}%) 8px 1fr` : '1fr')

// ================= R169-T4：项目调度下半部（左=描述原文 · 右=子任务，中缝可拖、纵向定高） =================
/**
 * 版式拍板（2026-09-26 用户两轮定案）：
 *  - **整行归属 = 进方向树的唯一入口**（原先头部的「方向树」钮与 `.cur-goal` 里的「进入项目详情 ›」一并撤掉，
 *    点这一行任一级都到同一页——三枚入口做一件事是噪音）；
 *  - 下半部左=**卡片描述字段原文**、右=**子任务清单**，两栏各自内滚；
 *  - 纵向定高 = **右栏恰 4 条子任务**（行高与行数各一个 CSS 变量算出总高，不写死像素）；
 *  - 右栏**只读 + 可勾选**：不放输入框、不放删除、不放 AI 入口，增删改一律回任务详情抽屉
 *    （找资源已经住在抽屉的三入口行，两处都能编辑必然漂移）。
 * ★与交接原型的**一处有意偏离**：指标分组任务树（新建任务/关联/删指标等结构编辑）**没有删**，
 *  仍留在「展开关联任务树」后面（默认折叠 ⇒ 首屏就是原型画的那个样子）。
 *  原因：那是全站唯一的指标结构管理面，静默删掉它等于砍功能；用户要的是台面变干净，不是失去入口。
 */
const spotSplit = ref(Math.min(70, Math.max(25, store.ui?.spotSplit ?? 42)))
function startSpotSplitDrag(e: MouseEvent) {
  e.preventDefault()
  const container = (e.currentTarget as HTMLElement).parentElement
  if (!container) return
  const rect = container.getBoundingClientRect()
  const move = (ev: MouseEvent) => {
    spotSplit.value = Math.round(Math.min(70, Math.max(25, ((ev.clientX - rect.left) / rect.width) * 100)))
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    saveUIPrefs({ spotSplit: spotSplit.value })
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
function resetSpotSplit() { spotSplit.value = 42; saveUIPrefs({ spotSplit: 42 }) }
/** 当前选中任务所属的成功指标（归属行第三级；未挂指标时明说，不显示"—"糊过去） */
const selMetricTitle = computed(() => {
  const mid = selTask.value?.metricId
  if (!mid) return '未挂指标'
  return metricName(mid)
})
const selSubs = computed<Subtask[]>(() => selTask.value?.subtasks || [])
const selSubsDone = computed(() => selSubs.value.filter(s => s.done).length)
/** 勾选子任务：只改本行 done（定案 3：完成不计分），随卡 persist——与任务详情抽屉同一口径 */
function toggleSelSub(subId: string) {
  const t = selTask.value
  if (!t) return
  t.subtasks = (t.subtasks || []).map(s => (s.id === subId ? { ...s, done: !s.done } : s))
  t.updatedAt = Date.now()
  store.persist()
}
/** 整行归属 = 进方向树（原型承诺"定位到本项目"，CompassTree 现无定位入参，这里不假称能定位） */
function gotoTree() { router.push('/compass/tree') }
/** 右栏子任务行 = 回任务详情抽屉编辑（这一栏只负责"勾"，不负责改文案） */
function openSelTask() { if (selTask.value) drawerRef.value?.open(selTask.value) }

/** R54-B2：4 指标下钻弹窗（成功指标 / 任务总数 / 已完成 / 进行中） */
const curDrill = ref<null | { key: 'metrics' | 'total' | 'done' | 'doing'; title: string }>(null)
const drillMetricPct = (metricId: string) => {
  const ts = d.value.tasks.filter(t => !t.deletedAt && t.metricId === metricId)
  return ts.length ? Math.round(ts.filter(t => t.status === 'done').length / ts.length * 100) : 0
}
const drillTasks = computed<TaskCard[]>(() => {
  if (!curDrill.value || curDrill.value.key === 'metrics') return []
  const all = projTasks.value
  if (curDrill.value.key === 'done') return all.filter(t => t.status === 'done')
  if (curDrill.value.key === 'doing') return all.filter(t => t.status === 'doing')
  return all
})
function openCurDrill(key: 'metrics' | 'total' | 'done' | 'doing') {
  if (!curProject.value) return
  const titles = { metrics: '成功指标', total: '任务总数', done: '已完成任务', doing: '进行中任务' } as const
  curDrill.value = { key, title: titles[key] }
}
const collapsedGroups = ref<Set<string>>(new Set())
function toggleGroup(key: string) {
  if (collapsedGroups.value.has(key)) collapsedGroups.value.delete(key)
  else collapsedGroups.value.add(key)
}
/** R52-F2：去掉关联——任务摘除项目/指标（转未归档），不删除任务。R141：走统一解绑函数 */
function unlinkTask(t: TaskCard) {
  unbindTaskFromMetric(d.value, t)
  store.persist()
  showToast(`✓ 已去掉关联：「${t.title.slice(0, 16)}」转为未归档任务`)
}
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
/** 成功指标删除 = 摘除关联（R146 并到真源：确认报数 + 3 秒撤销，四视图同一口径） */
function removeMetric(metricId: string) {
  if (!curProject.value) return
  void removeMetricWithConfirm(d.value, metricId, () => store.persist())
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
/** 任务删除（软删除进回收站，可撤销）——R141：走统一函数，顺手摘净 metric.taskIds 引用 */
function removeTask(t: TaskCard) {
  softDeleteTaskToTrash(d.value, t)
  store.persist()
  showToast('已删除「' + t.title.slice(0, 20) + '」', { label: '撤销', cb: () => {
    const cur = d.value.tasks.find(x => x.id === t.id)
    if (cur && cur.deletedAt) {
      cur.deletedAt = undefined
      // R141：删除时引用已摘，撤销按恢复同口径回填 taskIds（REQ-030）
      if (cur.metricId) {
        for (const dir of d.value.compass.directions) for (const proj of dir.projects) for (const m of proj.metrics)
          if (m.id === cur.metricId && !m.taskIds.includes(cur.id)) m.taskIds.push(cur.id)
      }
    }
    store.persist()
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
/** R54-B2：Esc 关闭指标下钻弹窗（与遮罩点击同语义） */
function onDrillEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !curDrill.value) return
  e.preventDefault()
  curDrill.value = null
}
// R67-F4：浏览器快捷键模块直达（curiosity=好奇心培养 / project=任务调度）——滚动定位 + 高亮闪烁
/**
 * R117（04-61 C1 拍板）：底部改为 **任务调度 / 好奇心培育** 双 tab，**默认任务调度**。
 * - 取代 R105-B4 的「好奇心默认折叠为一行摘要」——本轮用户明确要求把任务调度整体搬进调度台
 *   并与其并列，故按新拍板执行（旧降权策略退役）；
 * - 好奇心面板**懒挂载**（首次切到该 tab 才挂载）——保住首屏冷启动成本；
 * - `?hl=` 定位到好奇心卡时自动切 tab 并挂载（否则消费者不在 DOM 里，定位会落空）。
 */
const bottomTab = ref<'task' | 'curio'>('task')
const curioMounted = ref(false)
watch(bottomTab, (t) => { if (t === 'curio') curioMounted.value = true })
/** 底部 tab 计数徽标：任务调度 = 未删除任务数 · 好奇心培育 = 未删除好奇心数 */
const taskLiveCount = computed(() => (d.value.tasks || []).filter(t => !t.deletedAt).length)
const curioLiveCount = computed(() => (d.value.curiosities || []).filter(c => !c.deletedAt).length)
// R117（04-61 B）：`?hl` 带 `?hk` 时把对应面板切到前台——任务卡与好奇卡消费者同页，靠 hk 分派
watch(() => route.query.hl, (hl) => {
  if (!hl) return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk === 'curio') { bottomTab.value = 'curio'; curioMounted.value = true }
  else if (hk === 'task') bottomTab.value = 'task'
}, { immediate: true })
// R117（04-61 C1）：`?bottom=task|curio` 直达底部 tab——原 `?zone=task`（方向台任务调度模块）随模块搬迁退役，
// 新建任务后跳转（GlobalPopups）等场景改由本页底部 tab 承接。
watch(() => route.query.bottom, (b) => {
  if (b === 'curio') { bottomTab.value = 'curio'; curioMounted.value = true }
  else if (b === 'task') bottomTab.value = 'task'
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
  document.addEventListener('keydown', onDrillEsc, true)
  document.addEventListener('click', onDocClickCloseWhy, true)
  window.addEventListener('zy-goto-anchor', onAnchorEvt)
  loadEventLog()
  saveErrSub = subscribeSaveError(e => { saveErr.value = e })
  lastOkTick.value = getLastSaveOkAt()
  storageTimer = window.setInterval(() => {
    lastOkTick.value = getLastSaveOkAt()
  }, 30000)
  scheduleMidnightRollover()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDateKey, true)
  document.removeEventListener('keydown', onDrillEsc, true)
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
/** 与方向台主攻聚焦条同路由（LighthousePanel.openProject），避免两处跳法不一致 */
function openFocusProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}

// ================= 底部专区（R55-B2：任务调度已迁方向台，好奇心培育单区直呈） =================
// ===== R111：调度画像周报 =====
const wrOpen = ref(false)
function onWrDrill(ev: { kind: string; cardId?: string; workspaceId?: string; dirId?: string }) {
  if (ev.kind === 'created') { openRec('in'); return }
  if (ev.kind === 'called') { openRec('called'); return }
  // R117（04-61 C1）：任务调度已在本页底部 tab ⇒ 同页直接收周报 + 切 tab 滚过去（不再跨台跳方向台）
  if (ev.kind === 'done' || ev.kind === 'unarchived') { wrOpen.value = false; gotoAnchor('task'); return }
  if (ev.kind === 'direction') { router.push('/compass'); return }
  if (ev.kind === 'top-card' && ev.cardId && ev.workspaceId) {
    router.push({ path: '/workspace/' + ev.workspaceId, query: { hl: ev.cardId } })
    return
  }
  showToast('💡 在下方好奇心培育里管理你的好奇心')
}
const curioCount = computed(() => (d.value.curiosities || []).filter(c => !c.deletedAt).length)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="crumb"><b>调度台</b> · 今天，从哪里出发</div>
      <div class="spacer" />
      <!-- R66-F3：操作记录四格移至方向状态指标条右端（右对齐），存储/同步 chip 留右上角右对齐 -->
      <button class="storage-chip" :class="{ err: !storageOk }" :title="storageOk ? '点击查看存储用量' : '点击重试写入'" @click="onStorageClick">
        <span class="sc-dot" />
        <span>{{ storageText }}</span>
      </button>
      <!-- R63-9：Airtable 同步状态卡（右上角常驻；点击=立即同步，⚙ 进设置） -->
      <button class="sync-chip" :class="{ on: atConfigured, err: !!atSyncErr }" :title="atChipTitle" @click="onSyncChipClick">
        <span class="sc-dot" />
        <span>{{ atChipText }}</span>
        <span class="sync-gear" title="Airtable 同步设置" @click.stop="router.push('/settings?page=airtable')">⚙</span>
      </button>
    </div>

    <!-- R120-TB1 合流方向条：左槽=主攻（今天推哪个）· 中段=档位+5 指标 · 右槽=今日记录四格 + 周报 + 去方向台 -->
    <MetricBar>
      <template #left>
        <span class="cf-label" title="当前战略重心（最多 2 个）">🚀 主攻</span>
        <template v-if="focusedProjects.length">
          <span v-for="p in focusedProjects" :key="p.id" class="cf-item" :class="{ done: focusMeta.get(p.id)?.finished }"
            :title="p.name + ' · 点击进入项目详情'" @click="openFocusProject(p)">
            <span class="cf-name">{{ p.name }}</span>
            <span class="cf-pct">{{ focusMeta.get(p.id)?.pct || 0 }}%</span>
            <span v-if="focusMeta.get(p.id)?.stall" class="cf-stall" title="近 14 天无推进">⚠ 停滞</span>
            <span v-if="focusMeta.get(p.id)?.open" class="cf-open">待办 {{ focusMeta.get(p.id)?.open }}</span>
          </span>
        </template>
        <span v-else class="cf-hint" title="去方向台指定主攻项目" @click="router.push('/compass')">尚无主攻 · 去方向台指定</span>
      </template>
      <template #right>
        <div class="rec-mini in-bar">
          <span class="rm-cell" title="今日入台 · 点击看明细" @click="openRec('in')">⬇ {{ todayIn.length }}</span>
          <span class="rm-cell" title="今日移出 · 点击看明细" @click="openRec('out')">⬆ {{ todayOut.length }}</span>
          <span class="rm-cell" title="今日调出 · 点击看明细" @click="openRec('called')">↗ {{ todayCalled.length }}</span>
          <span class="rm-cell" title="写入记录 · 点击看明细" @click="openRec('log')">✎ {{ logCount }}</span>
        </div>
        <button class="mb-act" title="调度画像周报" @click="wrOpen = true">📊 周报</button>
        <span class="cf-go" title="去方向台管理主攻与目标" @click="router.push('/compass')">去方向台 ›</span>
      </template>
    </MetricBar>

    <!-- 左右分栏：今日三件事 ｜ 项目调度 -->
    <div id="dispatch-split" class="split">
      <!-- 左列 · 今日三件事 -->
      <!-- 上 · 今日三件事（R51-F10 视觉焦点；R53-C1：工具按钮移头部，槽位即入口） -->
      <section class="module left-col">
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
                    <span class="tag accent">📦 {{ projectName(c.task.projectId) }}</span>
                    <span class="tag warn">🎯 {{ metricName(c.task.metricId) }}</span>
                    <AssetBadge v-if="taskAssetsOn && c.task.assets?.length" :assets="c.task.assets" />
                    <MaturityBadge :m="taskMaturity(c.task)" />
                    <span v-if="c.slot?.auto === true" class="tag rec" data-testid="focus-rec" title="系统推荐写入的一格 · 点右上角 ✦ 看依据">✦ 荐</span>
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

    <!-- 下 · 项目调度（选中任务联动）｜ R67-F4：id 供快捷键直达锚点 -->
    <section id="zy-mod-tasks" class="module right-col">
        <div class="card curation">
          <div class="card-head">
            <span class="ic"><Icon name="target" :size="17" /></span><span class="nm">项目调度</span><span class="en">PROJECT SPOTLIGHT</span>            <span class="ds">选中任务所属项目 · 单击上方任务卡联动</span>
            <!-- R56-P1：头部迷你计数条移除——4 指标已恢复至左列 -->
            <!-- R94（B2）：任务树**默认折叠**的切换入口，带任务数（折叠时也知道下面压着多少） -->
            <button v-if="curProject" class="mini-btn" :title="curTreeOpen ? '收起任务树' : '展开任务树'"
              @click="curTreeOpen = !curTreeOpen">
              <Icon name="branch" :size="13" />{{ curTreeOpen ? '收起关联任务树' : '展开关联任务树' }} ({{ projTasks.length }}) <span class="cur-tree-caret">{{ curTreeOpen ? '▴' : '▾' }}</span>
            </button>
            <!-- R169-T4：原「方向树」钮撤掉——整行归属本身就是入口（见 .cur-crumb），两枚钮做同一件事是噪音 -->
          </div>
          <div v-if="curProject" class="cur-body-v">
            <!-- R66-F2：删顶部项目名行与愿景/使命模块（数据保留在方向台）——项目名大字下移为模块主体首行，纵向压缩 -->
            <div class="cur-cols" :style="{ gridTemplateColumns: curColsStyle }">
              <div class="cur-col-l">
                <!-- R169-T4：原「战略目标小字 + 项目名大字 + meta 行 + 详情链接」四行卡片压成**一行归属**，
                     与四格数值同排（用户标注⑤：更扁平、同一行显示）。
                     ★整行 = 进方向树的唯一入口（三枚入口做同一件事是噪音），行内每一级都不再有独立点击语义。 -->
                <div class="cur-l-row">
                  <div class="cur-crumb" role="button" tabindex="0" data-testid="cur-crumb"
                    title="点这一行任一级 → 进入方向树全景（查看/编辑方向结构）" @click="gotoTree" @keydown.enter="gotoTree">
                    <span class="cc-it"><span class="k">🎯 战略目标</span><span class="v">{{ goalOf(curProject)?.name || '—' }}</span></span>
                    <span class="cc-sep">›</span>
                    <span class="cc-it"><span class="k">📦 项目</span><span class="v">{{ curProject.name }} · {{ projectProgress(curProject).pct }}%</span></span>
                    <span class="cc-sep">›</span>
                    <span class="cc-it cur" data-testid="cur-crumb-metric"><span class="k">🎯 成功指标</span><span class="v">{{ selMetricTitle }}</span></span>
                    <span class="cc-go">方向树 ↗</span>
                  </div>
                  <!-- R56-P1：4 指标卡（R169-T4：由 2×2 改一行四格，与归属同排；四格都可下钻的判据不变） -->
                  <div class="cur-stats-v2">
                    <div class="csv-cell clickable" title="成功指标 · 点击下钻" @click="openCurDrill('metrics')"><div class="csv-num">{{ projMetrics.length }}</div><div class="csv-lab">成功指标</div></div>
                    <div class="csv-cell clickable" title="任务总数 · 点击下钻" @click="openCurDrill('total')"><div class="csv-num">{{ projTasks.length }}</div><div class="csv-lab">任务总数</div></div>
                    <div class="csv-cell clickable" title="已完成 · 点击下钻" @click="openCurDrill('done')"><div class="csv-num ok">{{ projDoneCount }}</div><div class="csv-lab">已完成</div></div>
                    <div class="csv-cell clickable" title="进行中 · 点击下钻" @click="openCurDrill('doing')"><div class="csv-num warn">{{ projDoingCount }}</div><div class="csv-lab">进行中</div></div>
                  </div>
                </div>
                <!-- R120-TB3：进度条（对齐原型；数据沿用 projectProgress 既有口径） -->
                <div class="cur-progress" title="项目进度">
                  <div class="cur-progress-fill" :style="{ width: projectProgress(curProject).pct + '%' }" />
                </div>
              </div>
              <!-- R94（B2）：折叠时**真的不渲染**（v-if 而非 v-show）——首屏的信息密度与渲染成本双降。
                   collapsedGroups 是组件级 ref<Set>，重建不丢。 -->
              <template v-if="curTreeOpen">
              <div class="cur-split" @mousedown="startCurSplitDrag" title="拖拽调节左右宽度（30%–75%）" />
              <div class="cur-col-r">
                <div class="cur-groups">
                  <div v-for="grp in metricGroups" :key="grp.key" class="cur-group">
                    <div class="cg-head" @click="toggleGroup(grp.key)">
                      <span class="cg-caret" :class="{ open: !collapsedGroups.has(grp.key) }">▸</span>
                      <span class="cg-name" :class="{none: grp.key==='__none__}'}">{{ grp.key==='__none__' ? '🗂 ' + grp.title : '🎯 ' + grp.title }}</span>
                      <span class="cg-count">{{ grp.tasks.length }}</span>
                      <span class="cg-tools" @click.stop>
                        <button class="cg-add" title="关联已有任务到此指标" @click.stop="openLinkPicker(grp.key==='__none__' ? undefined : grp.key)">🔗</button>
                        <button v-if="grp.key!=='__none__'" class="cg-add danger" title="删除此指标（其下任务转为未关联指标，不删任务）" @click.stop="removeMetric(grp.key)">🗑</button>
                        <button class="cg-add" title="在此指标下新建任务" @click.stop="createProjectTask(grp.key==='__none__' ? undefined : grp.key)">＋</button>
                      </span>
                    </div>
                    <div v-show="!collapsedGroups.has(grp.key)" class="cg-tasks">
                      <div v-for="t in grp.tasks" :key="t.id" class="cg-task" :class="{'is-done': t.status==='done'}" @dblclick="drawerRef?.open(t)" @click="drawerRef?.open(t)">
                        <span class="cg-dot" :class="'st-'+t.status">{{ t.status==='done'?'✓':t.status==='doing'?'◐':'○' }}</span>
                        <span class="cg-t">{{ t.title }}</span>
                        <span class="cg-st">{{ t.status==='done'?'已完成':t.status==='doing'?'进行中':'待开始' }}</span>
                        <MaturityBadge :m="taskMaturity(t)" />
                        <button class="cg-del" title="去掉关联（转为未归档任务，不删除）" @click.stop="unlinkTask(t)">⨯</button>
                        <button class="cg-del" title="删除任务（进回收站，可撤销）" @click.stop="removeTask(t)">🗑</button>
                      </div>
                      <div v-if="!grp.tasks.length" class="cg-empty">暂无任务</div>
                    </div>
                  </div>
                  <div v-if="!metricGroups.length" class="cg-empty" style="padding:20px">该项目还没有成功指标与任务——右侧新增成功指标，或「新建任务」</div>
                  <div v-if="addingMetric" class="cur-add-metric">
                    <input v-model="newMetricTitle" class="cam-input" placeholder="成功指标名称，回车确认"
                      @keydown.enter.prevent="confirmAddMetric" @keydown.esc="addingMetric=false" />
                    <button class="mini-btn primary" @click="confirmAddMetric">确定</button>
                  </div>
                  <div v-else class="cur-add-metric-link" @click="startAddMetric">＋ 新增成功指标</div>
                </div>
              </div>
              </template>
            </div>
            <!-- ===== R169-T4：下半部两块（左=描述原文 · 右=子任务），中缝可拖、纵向定高 ===== -->
            <div class="spot-dual" data-testid="spot-dual" :style="{ gridTemplateColumns: `minmax(0, ${spotSplit}%) 8px 1fr` }">
              <div class="sp-col">
                <div class="sp-h"><b>描述</b><i>卡片描述字段原文 · 只读，编辑回任务详情</i><span class="r">{{ selTask?.status === 'done' ? '已完成' : selTask?.status === 'doing' ? '进行中' : '待开始' }}</span></div>
                <div class="sp-b"><div class="sp-desc">{{ selTask?.description || '（这张卡还没有描述 —— 到任务详情里写一句"做完算成"的标准，比标题更能提醒明天的自己）' }}</div></div>
              </div>
              <div class="sp-split" data-testid="sp-split" title="拖动调节两栏宽度（25%–70%）· 双击复位"
                @mousedown="startSpotSplitDrag" @dblclick="resetSpotSplit"><i /></div>
              <div class="sp-col">
                <div class="sp-h"><b>子任务清单</b><i>本卡内容 · 完成不计分</i><span class="r" data-testid="sp-sub-n">{{ selSubsDone }}/{{ selSubs.length }}</span></div>
                <div class="sp-b" data-testid="sp-sub-body">
                  <div v-for="s in selSubs" :key="s.id" class="sp-sub" :class="{ done: s.done }"
                    :title="s.done ? '点方框取消完成' : '点方框标记完成 · 改文案请进任务详情'" @click="openSelTask">
                    <span class="b" @click.stop="toggleSelSub(s.id)">{{ s.done ? '✓' : '' }}</span>
                    <span class="t">{{ s.title }}</span><span class="go">›</span>
                  </div>
                  <div v-if="!selSubs.length" class="sp-sub-empty">这张卡还没有子任务 —— 到任务详情里拆，或用详情标题下的「AI 拆解步骤」。</div>
                  <div class="sp-sub-foot">右栏只读 + 可勾选 · 增删改 → 任务详情抽屉</div>
                </div>
              </div>
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

    <!-- 底部 · 任务调度 / 好奇心培育（R117 C1 拍板：任务调度整体自方向台迁入，与好奇心培育并列 tab，
         默认任务调度；取代 R55-B2「任务调度在方向台」与 R105-B4「好奇心默认折叠摘要」两条旧策略）
         R67-F4：id 供快捷键直达锚点 -->
    <section id="zy-mod-curiosity" class="module">
      <div class="bottom-tabs">
        <button class="bt-tab" :class="{ on: bottomTab === 'task' }" @click="bottomTab = 'task'">
          <Icon name="clipboard" :size="14" />任务调度<span class="bt-cnt">{{ taskLiveCount }}</span>
        </button>
        <button class="bt-tab" :class="{ on: bottomTab === 'curio' }" @click="bottomTab = 'curio'">
          <Icon name="bulb" :size="14" />好奇心培育<span class="bt-cnt">{{ curioLiveCount }}</span>
        </button>
      </div>
      <!-- 任务调度：默认 tab，常驻挂载 -->
      <div v-show="bottomTab === 'task'" class="bottom-pane">
        <TaskManagerPanel />
      </div>
      <!-- 好奇心培育：懒挂载（首次切到该 tab 才挂载）——保住首屏冷启动成本 -->
      <div v-show="bottomTab === 'curio'" class="bottom-pane">
        <CuriosityPanel v-if="curioMounted" />
      </div>

    <!-- R111：调度画像周报全屏浮层 -->
    <WeeklyReportOverlay :open="wrOpen" @close="wrOpen = false" @drill="onWrDrill" />
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
    <Drawer :open="!!recOpen" :title="recOpen ? `${recTitles[recOpen]} · 共 ${recOpen === 'log' ? logCount : recFiltered.length} 条` : ''" width="460px" @close="recOpen = ''">
      <div class="rec-fill">
        <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="recSearch" placeholder="按标题过滤..." @input="recPage=1"></div>
        <div class="rec-list-scroll">
          <div v-for="(x, i) in recSlice" :key="i" class="picker-item" :class="{disabled: !x.clickable, sys: !x.kind}" @click="locateRec(x)">
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

    <!-- ===== R54-B2：指标下钻弹窗 ===== -->
    <Transition name="fade">
      <div v-if="curDrill" class="overlay" @click="curDrill=null" />
    </Transition>
    <Transition name="modal">
      <div v-if="curDrill" class="picker-modal" style="width:520px">
        <div class="pm-head">
          <span>📊 {{ curDrill.title }} · {{ curProject?.name }}</span>
          <div class="pm-close" @click="curDrill=null">×</div>
        </div>
        <div class="pm-body">
          <template v-if="curDrill.key === 'metrics'">
            <div v-for="grp in metricGroups.filter(g => g.key !== '__none__')" :key="grp.key" class="picker-item" style="cursor:default">
              <div class="pi-check pi-ghost">🎯</div>
              <div class="pi-info">
                <div class="pi-title">{{ grp.title }}</div>
                <div class="pi-meta"><span class="tag accent">任务 {{ grp.tasks.length }}</span><span class="tag ok">完成 {{ drillMetricPct(grp.key) }}%</span></div>
              </div>
            </div>
            <div v-if="!metricGroups.filter(g => g.key !== '__none__').length" class="list-empty">该项目暂无成功指标</div>
          </template>
          <template v-else>
            <div v-for="t in drillTasks" :key="t.id" class="picker-item" @click="drawerRef?.open(t)">
              <div class="pi-check pi-ghost">{{ t.status==='done'?'✓':t.status==='doing'?'◐':'○' }}</div>
              <div class="pi-info">
                <div class="pi-title">{{ t.title }}</div>
                <div class="pi-meta">
                  <span class="tag accent">{{ projectName(t.projectId) }}</span>
                  <span class="tag" :class="{ok: t.status==='done'}">{{ t.status==='done'?'✅ 已完成':t.status==='doing'?'◐ 进行中':'○ 待开始' }}</span>
                </div>
              </div>
            </div>
            <div v-if="!drillTasks.length" class="list-empty">暂无{{ curDrill.title }}</div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- 任务详情抽屉（共享组件） -->
    <TaskDetailDrawer ref="drawerRef" />
    <!-- R169-T3：AI 复核今日三件事 → 走全站唯一的中央评审弹窗（不建第二套对照壳） -->
    <AiDrawer v-if="focusJob" :job="focusJob" @close="focusJob = null" />
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 36px 64px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-left: 22px; }
.page-head .crumb { font-size: var(--fs-body); color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 16px; letter-spacing: .2px; }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: var(--fs-caption); color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }

/* R50-F2 数据存储状态栏 */
.storage-chip { display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-caption); color: var(--text-2); background: var(--surface); border: 1px solid var(--border); padding: 4px 12px; border-radius: 99px; cursor: pointer; transition: border-color var(--dur); font-family: inherit; }
.storage-chip:hover { border-color: var(--border-strong); }
.storage-chip .sc-dot { width: 7px; height: 7px; border-radius: 99px; background: #2EA043; box-shadow: 0 0 6px rgba(46,160,67,.55); flex-shrink: 0; }
.storage-chip.err { color: #F85149; border-color: color-mix(in srgb, #F85149 45%, var(--border)); }
.storage-chip.err .sc-dot { background: #F85149; box-shadow: 0 0 6px rgba(248,81,73,.55); animation: scBlink 1.2s ease-in-out infinite; }
@keyframes scBlink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

/* R63-9：Airtable 同步状态卡（右上角常驻，量级对齐 storage-chip） */
.sync-chip { display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-caption); color: var(--text-2); background: var(--surface); border: 1px solid var(--border); padding: 4px 12px; border-radius: 99px; cursor: pointer; transition: border-color var(--dur); font-family: inherit; }
.sync-chip:hover { border-color: var(--border-strong); }
.sync-chip .sc-dot { width: 7px; height: 7px; border-radius: 99px; background: var(--text-3); flex-shrink: 0; }
.sync-chip.on .sc-dot { background: #2EA043; box-shadow: 0 0 6px rgba(46,160,67,.55); }
.sync-chip.err { color: #F85149; border-color: color-mix(in srgb, #F85149 45%, var(--border)); }
.sync-chip.err .sc-dot { background: #F85149; box-shadow: 0 0 6px rgba(248,81,73,.55); animation: scBlink 1.2s ease-in-out infinite; }
.sync-chip .sync-gear { font-size: var(--fs-caption); opacity: .55; padding: 0 2px; }
.sync-chip .sync-gear:hover { opacity: 1; }

/* R56-P2：今日记录 4 计数页头迷你条（右对齐、同存储 chip 量级） */
.rec-mini { display: inline-flex; align-items: center; gap: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 99px; padding: 4px 8px; }
/* R66-F3：指标条内嵌态——去边框，融入单行指标条右端 */
.rec-mini.in-bar { background: transparent; border: none; padding: 0; }
.rec-mini .rm-cell { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-caption); color: var(--text-2); padding: 2px 7px; border-radius: 99px; cursor: pointer; font-variant-numeric: tabular-nums; transition: all var(--dur-fast); white-space: nowrap; }
.rec-mini .rm-cell:hover { background: var(--accent-light); color: var(--accent); }
/* R120-TB1：条内动作按钮（周报）——与今日记录四格同量级 */
.mb-act { flex-shrink: 0; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-caption); padding: 3px 9px; border-radius: 99px; cursor: pointer; font-family: inherit; transition: all var(--dur-fast); }
.mb-act:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

/* 左右分栏 */
/* R51-F10：上下联动——三件事在上占视觉焦点，项目调度在下 */
/* R120-TB1：合流方向条内元素（主攻 / 去方向台）——单行 ≤40px，全 tokens */
.cf-label { flex-shrink: 0; font-size: var(--fs-sub); font-weight: 600; color: var(--accent); }
.cf-item { display: flex; align-items: center; gap: 5px; flex-shrink: 0; max-width: 260px; font-size: var(--fs-sub); font-weight: 500; color: var(--text); cursor: pointer; }
.cf-item:hover .cf-name { text-decoration: underline; }
.cf-item.done { opacity: .55; }
.cf-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-pct { flex-shrink: 0; font-size: var(--fs-caption); color: var(--text-2); font-variant-numeric: tabular-nums; }
/* R91 口径保留：14 天无推进亮 ⚠ 停滞；待办数为 10px 轻量标记 */
.cf-stall { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--warning); }
.cf-open { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-2); }
.cf-hint { font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-hint:hover { color: var(--accent); }
.cf-go { flex-shrink: 0; font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; }
.cf-go:hover { color: var(--accent); }
.split { display: flex; flex-direction: column; gap: 14px; margin-bottom: 4px; }
.left-col { min-width: 0; }
.right-col { min-width: 0; }

/* R105（B4）：好奇心培育折叠摘要行——呼应 ModuleCard 的视觉语言（surface 底 + 发丝边） */
/* R120-TB4：底部胶囊 Tab（对齐原型：pill 形态 + 中性选中态；计数为轻量 pill） */
.bottom-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.bt-tab { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-body); font-weight: 600; border-radius: 99px; padding: 5px 14px; cursor: pointer; font-family: inherit; transition: all .13s; }
.bt-tab:hover { border-color: var(--border-strong); color: var(--text); }
.bt-tab.on { border-color: var(--border-strong); background: var(--surface-3); color: var(--text); }
.bt-cnt { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); background: var(--surface-2); border-radius: 99px; padding: 0 7px; line-height: 17px; }
.bt-tab.on .bt-cnt { color: var(--text-2); background: var(--surface); }
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
.tag.accent { background: var(--accent-light); color: var(--accent); }
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
.card.focus:focus-within { border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent), var(--shadow-sm); }
.card.focus .card-head .nm { font-size: var(--fs-headline); font-weight: 700; color: var(--text); }
.card.focus .card-head .ic { color: var(--accent); }
.card.focus .tc-title { font-size: var(--fs-body); font-weight: 600; }
.card.focus .tc-num { color: var(--text-3); font-size: var(--fs-sub); font-weight: 500; opacity: 1; }
.card.focus .today-card { padding: 12px 14px; min-height: 84px; border-radius: var(--radius-md); }
.card.focus .today-card:not(.empty-card):hover { transform: translateY(-1px); }
.card.focus .today-card:not(.empty-card) { border-color: color-mix(in srgb, var(--accent) 22%, var(--border)); }
.card.focus .today-card.sel { border-color: color-mix(in srgb, var(--accent) 40%, transparent); background: color-mix(in srgb, var(--accent) 4%, transparent); animation: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent), inset 0 0 14px color-mix(in srgb, var(--accent) 8%, transparent); }
/* R94（B3）三件事全完成：**安静**完成态——整块轻微去饱和 + 一行中性小字。
   ⚠ 卡头（复制昨日 / 导出 / 日期导航）**不去饱和**——那是操作区，褪色会影响可用性。
   不用庆祝动画、不用红色、不用进度百分比。 */
.card.focus.all-done .today-cards { filter: saturate(.5); }
.card.focus.all-done .tc-num { color: var(--text-3); }
.td-done { margin-top: 8px; font-size: var(--fs-sub); color: var(--text-3); text-align: center; letter-spacing: .3px; }
/* R94（B2）：任务树折叠/展开按钮的箭头（纯文字，不引新图标） */
.cur-tree-caret { opacity: .7; }
/* R52-F1：三件事横向并列——3 槽一行，压缩纵向空间 */
.today-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.today-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; cursor: pointer; transition: all var(--dur) ease; position: relative; display: flex; flex-direction: column; min-height: 84px; }
.today-card:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.today-card.sel { border-color: var(--accent); background: var(--accent-light); animation: none; box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 22%, transparent); }
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
.tc-remove { position: absolute; top: 7px; right: 32px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: var(--fs-body); color: var(--text-3); cursor: pointer; opacity: 0; transition: all var(--dur); }
.today-card:hover .tc-remove { opacity: 1; }
.tc-remove:hover { background: var(--danger); color: #fff; }

/* 项目调度（R52-F2：左右两列——左=方向感，右=执行面） */
.cur-body-v { padding: 0 20px 18px; display: flex; flex-direction: column; gap: 10px; }
/* R54-B1：左右两列 + 可拖拽分隔条（行内 style 动态列宽，此处为基础回退值） */
/* R55-E（修复 R54-B1）：列宽绑定 ${curSplit.value}——此前 ${curSplit} 插值 ref 对象生成非法值被 CSSOM 静默拒绝 */
.cur-cols { display: grid; grid-template-columns: minmax(0, 38%) 8px 1fr; gap: 0 10px; align-items: stretch; }
.cur-col-l, .cur-col-r { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
/* R169-T4：归属压扁成一行（原「战略目标小字 + 项目名大字 + 元信息 + 进入详情链接」四行卡片与
   .cur-proj-name / .cur-goal-* 样式一并退役）。
   ★整行就是"进方向树"的按钮：行内每一级都不再有自己的点击语义——三枚入口做同一件事是噪音。
   一行四格数值同排（用户标注⑤"更扁平化、同一行显示"），窄一点时整行换行而不是挤掉字。 */
.cur-l-row { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
.cur-crumb { flex: 1 1 340px; min-width: 0; display: flex; align-items: baseline; gap: 7px; flex-wrap: nowrap; overflow: hidden; cursor: pointer; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; transition: border-color var(--dur); }
.cur-crumb:hover { border-color: var(--accent); }
.cur-crumb .cc-it { display: inline-flex; align-items: baseline; gap: 5px; min-width: 0; }
.cur-crumb .cc-it .k { font-size: var(--fs-macro); color: var(--text-4); white-space: nowrap; }
.cur-crumb .cc-it .v { font-size: var(--fs-sub); font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cur-crumb .cc-it.cur .v { color: var(--accent-2); }
.cur-crumb .cc-sep { color: var(--text-4); font-size: var(--fs-macro); flex-shrink: 0; }
.cur-crumb .cc-go { margin-left: auto; flex-shrink: 0; font-size: var(--fs-caption); font-weight: 600; color: var(--accent-2); }
/* R169-T4 下半部：左=卡片描述原文 · 右=子任务（只读 + 可勾选）。
   ★纵向定高 = 右栏**恰 4 行**子任务。高度**加在滚动体上、不加在外壳上**：
   外壳写死一个总高（曾按 33+22+4×33 算）看着是"4 行"，其实栏头实测多 4px，
   第 4 行会被悄悄削掉一截——所以让行高变量直接决定滚动体，外壳跟着内容走。 */
.spot-dual { --sp-sub-h: 33px; --sp-rows: 4; display: grid; grid-template-columns: minmax(0, 42%) 8px 1fr; gap: 0 10px; align-items: stretch; margin-top: 12px; }
.sp-col { display: flex; flex-direction: column; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.sp-h { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-bottom: 1px solid var(--border); background: var(--surface-2); flex-shrink: 0; }
.sp-h b { font-size: var(--fs-caption); font-weight: 700; letter-spacing: .05em; color: var(--text-3); text-transform: uppercase; }
.sp-h i { font-style: normal; font-size: var(--fs-caption); color: var(--text-4); }
.sp-h .r { margin-left: auto; font-size: var(--fs-caption); color: var(--text-4); white-space: nowrap; font-variant-numeric: tabular-nums; }
.sp-b { flex: none; overflow-y: auto; padding: 11px 12px; height: calc(var(--sp-rows) * var(--sp-sub-h)); }
.sp-desc { font-size: var(--fs-body); line-height: 1.85; color: var(--text-2); white-space: pre-wrap; }
.sp-split { position: relative; cursor: col-resize; display: flex; align-items: center; justify-content: center; }
.sp-split i { width: 3px; height: 26px; border-radius: 2px; background: var(--border-strong); transition: all var(--dur); }
.sp-split:hover i { background: var(--accent); height: 44px; }
.sp-split::after { content: ''; position: absolute; inset: 0 -4px; }
.sp-sub { box-sizing: border-box; display: flex; align-items: center; gap: 9px; height: var(--sp-sub-h); padding: 8px 2px; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); cursor: pointer; }
.sp-sub .b { flex-shrink: 0; width: 15px; height: 15px; display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid var(--border-strong); border-radius: 4px; font-size: var(--fs-micro); color: var(--accent); background: var(--surface); }
.sp-sub .b:hover { border-color: var(--accent); }
.sp-sub.done .b { background: var(--accent); border-color: var(--accent); color: #fff; }
.sp-sub .t { flex: 1; min-width: 0; }
.sp-sub.done .t { text-decoration: line-through; color: var(--text-3); }
.sp-sub .go { color: var(--text-4); font-size: var(--fs-macro); flex-shrink: 0; }
.sp-sub-empty { padding: 10px 2px; font-size: var(--fs-sub); color: var(--text-4); line-height: 1.7; }
.sp-sub-foot { padding: 8px 2px 2px; font-size: var(--fs-caption); color: var(--text-4); border-top: 1px dashed var(--border); margin-top: 6px; }
@media (max-width: 1199px) {
  .spot-dual { grid-template-columns: 1fr; gap: 10px 0; }
  .sp-split { display: none; }
}
/* R120-TB3：进度条（5px，对齐原型；宽度=项目进度既有口径） */
.cur-progress { height: 5px; margin-top: 10px; background: var(--surface-3); border-radius: 3px; overflow: hidden; }
.cur-progress-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width var(--dur-slow) ease; }
/* R56-P1：项目调度 4 指标卡 ｜ R57-F2：两两一行 ｜ R120-TB3：原型 mini box（左对齐 / 14px 数值 / 11px 标签） */
/* R169-T4：2×2 → 一行四格，与归属同排（下钻判据与四格语义一字未改） */
.cur-stats-v2 { display: grid; grid-template-columns: repeat(4, minmax(58px, auto)); gap: 6px; align-self: center; }
.csv-cell { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 10px; text-align: left; }
.csv-cell.clickable { cursor: pointer; transition: all var(--dur-fast); }
.csv-cell.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.csv-num { font-size: 14px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.25; }
.csv-num.ok { color: var(--success); }
.csv-num.warn { color: var(--warning); }
.csv-lab { font-size: var(--fs-caption); color: var(--text-3); margin-top: 1px; }
/* R54-B1：分栏拖拽分隔条 */
/* R55-E2：分隔条常显可见（细线）+ hover/拖动增强，命中区 8px */
.cur-split { width: 8px; border-radius: 99px; cursor: col-resize; background: transparent; transition: background var(--dur); align-self: stretch; position: relative; }
.cur-split::after { content: ''; position: absolute; left: 3px; top: 6px; bottom: 6px; width: 2px; border-radius: 99px; background: var(--border-strong); opacity: .5; transition: all var(--dur); }
.cur-split:hover, .cur-split:active { background: var(--accent-light); }
.cur-split:hover::after, .cur-split:active::after { background: var(--accent); opacity: 1; top: 0; bottom: 0; }
/* R54-B2：指标卡可点击 */
.cur-stat.clickable { cursor: pointer; transition: border-color var(--dur), transform var(--dur-fast); }
.cur-stat.clickable:hover { border-color: var(--accent); transform: translateY(-1px); }
.cur-stat.clickable:hover .cs-lab { color: var(--accent); }
/* R55-D2：4 指标降级为一行状态栏（card-head 右侧，点击下钻保留） */
.cur-stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 6px; text-align: center; }
.cs-num { font-size: var(--fs-display); font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.cs-num.ok { color: var(--success); }
.cs-num.warn { color: var(--warning); }
.cs-lab { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 2px; }
/* R120-TB3：任务树列——对齐原型（白底 + 发丝边 + 表头分隔线；两列排布沿用 R57-F2） */
.cur-groups { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; align-items: start; }
.cur-groups > .cg-empty, .cur-groups > .cur-add-metric, .cur-groups > .cur-add-metric-link { grid-column: 1 / -1; }
.cur-group { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.cg-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: transparent; border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
/* R52-F2：指标组折叠 caret */
.cg-caret { width: 12px; text-align: center; font-size: var(--fs-tiny); color: var(--text-3); transition: transform var(--dur); flex-shrink: 0; }
.cg-caret.open { transform: rotate(90deg); }
.cg-name { font-size: var(--fs-sub); font-weight: 700; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-name.none { color: var(--text-3); }
.cg-count { font-size: var(--fs-tiny); color: var(--text-3); background: var(--surface); padding: 1px 8px; border-radius: 99px; }
.cg-add { width: 20px; height: 20px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font-size: var(--fs-sub); cursor: pointer; line-height: 1; }
.cg-add:hover { border-color: var(--accent); color: var(--accent); }
.cg-tools { display: none; gap: 4px; margin-left: auto; }
.cg-head:hover .cg-tools, .cg-head:focus-within .cg-tools { display: inline-flex; }
.cg-add.danger:hover { border-color: #d46a6a; color: #d46a6a; }
.cg-del { width: 20px; height: 20px; border: none; background: transparent; color: var(--text-3); font-size: var(--fs-caption); cursor: pointer; border-radius: 5px; opacity: 0; flex-shrink: 0; line-height: 1; }
/* R52-F2：去关联（⨯）+删除（🗑）两钮——首钮吃 auto margin 靠右成组 */
.cg-task button:first-of-type { margin-left: auto; }
.cg-task button + button { margin-left: 0; }
.cg-task:hover .cg-del { opacity: 1; }
.cg-del:hover { color: #d46a6a; background: rgba(212,106,106,.12); }
.cur-add-metric { display: flex; gap: 8px; padding: 10px 12px; }
.cam-input { flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: var(--fs-body); outline: none; background: var(--surface); color: var(--text); font-family: inherit; }
.cam-input:focus { border-color: var(--accent); }
.cur-add-metric-link { margin: 2px 0 0; padding: 7px 10px; font-size: var(--fs-sub); color: var(--text-3); border: 1px dashed var(--border); border-radius: 8px; cursor: pointer; text-align: center; transition: all var(--dur-fast); }
.cur-add-metric-link:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.cg-tasks { padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 4px; }
.cg-task { display: flex; align-items: center; gap: 8px; padding: 4px 4px; border-radius: 7px; cursor: pointer; transition: background var(--dur-fast); }
.cg-task:hover { background: var(--surface-2); }
.cg-task.is-done .cg-t { text-decoration: line-through; color: var(--text-3); }
/* R120-TB3：12px 状态环（对齐原型；doing/done 保留语义色与微标记以便辨识） */
.cg-dot { width: 12px; height: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; line-height: 1; flex-shrink: 0; background: transparent; border: 1.5px solid var(--text-4); color: var(--text-4); }
.cg-dot.st-doing { border-color: var(--tag-warn-text); color: var(--tag-warn-text); }
.cg-dot.st-done { background: var(--text-4); border-color: var(--text-4); color: var(--surface); }
.cg-t { font-size: var(--fs-body); color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-st { font-size: var(--fs-tiny); color: var(--text-4); flex-shrink: 0; }
.cg-empty { font-size: var(--fs-caption); color: var(--text-4); text-align: center; padding: 8px; }
.cur-empty { padding: 18px 16px 22px; text-align: center; }
.ce-icon { font-size: 30px; opacity: .45; margin-bottom: 6px; }
.ce-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
.ce-desc { font-size: var(--fs-sub); color: var(--text-3); margin-bottom: 12px; line-height: 1.7; }

/* 底部专区 Tab */

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: var(--z-overlay); }
.picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-width: 92vw; max-height: 70vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: calc(var(--z-overlay) + 1); display: flex; flex-direction: column; overflow: hidden; }
/* R51-F16：记录抽屉右侧滑出——列表撑满、翻页贴底 */
.rec-fill { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.rec-list-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.rec-fill .pager { flex-shrink: 0; margin-top: 10px; }
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
.rec-go { font-size: var(--fs-caption); color: var(--accent); flex-shrink: 0; }
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
  .cur-cols { grid-template-columns: 1fr; }
  .cur-groups { grid-template-columns: 1fr; }
  .cur-split { display: none; }
/* R125：卡面微阴影（三件事 + 项目聚焦看板） */
.today-card, .cur-crumb { box-shadow: var(--shadow-sm); }
}
</style>
