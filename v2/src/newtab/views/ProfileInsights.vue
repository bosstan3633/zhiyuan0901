<script setup lang="ts">
/**
 * W10（V3.9.0）：画像洞察页 —— 时间轴三段式（今天 / 近期 / 全年）。
 *
 * 本版把 v6 原型布局落为生产：
 *   §0 PiHero 页头（5 KPI chip + 刷新/导出/AI 解读/今日战报）
 *   左 PiRail 导航（IntersectionObserver 高亮） + 右三模块：
 *     ① PiToday  今天 · TODAY（今日六格 + 今日三件事 + 洞察条）
 *     ② PiRhythm 近期 · WEEK（strip + 6 KPI + 节奏柱 + 目标 + 预警 + 操作流，T5 并段）
 *     ③ PiYear   全年 · YEAR（累计 strip + 年度热力图 + 生命周期，T6 并段，#lc-sec 深链锚保留）
 *
 * 决策落实：
 *   D1 六维砍掉 → PiRhythm 用复盘段真实 kpisOf 六枚
 *   D3 下钻维持既有形态（胶囊→抽屉 / 中央大弹层只留战报与复盘）
 *   D4 ReviewPanel → 中央弹窗（Teleport，功能零删；入口 = Hero「AI 解读」+ PiRhythm「周/月复盘」）
 *   T8 DashboardOverview 退役（本页不再引用；文件删除另行处理）
 *
 * 数据桥口径不变：readEventLog 优先，空日志回退卡片时间派生；只读 store.data 快照，
 * 写操作只经 store.persist()（lifecycle 三写 + 报告落卡）。
 */
import '@/newtab/components/dashboard/dashboard.css'
import '@/newtab/components/profile/pi-timeline.css'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import type { AppData } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { readEventLog } from '@/shared/utils/eventLog'
import { readErrorLog, subscribeErrorLog } from '@/shared/utils/runtimeError'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
import { showToast } from '@/shared/components/toast'
import { saveUIPrefs } from '@/shared/storage/repository'
import { downloadText, stampDay } from '@/shared/utils/download'
import {
  snoozeCard, reactivateCard, setCoolingDays,
  coolingDefaultDaysOf, setCoolingDefaultDays
} from '@/shared/utils/lifecycle'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'
import {
  currentStreak, longestStreak, yearAgg, computeTagEntropy, todayKey
} from '@/shared/utils/reviewReport'
import { aggregateRange } from '@/shared/utils/dailyStats'
import type { DirLike, TaskLike } from '@/shared/utils/reviewReport'
import PiHero from '@/newtab/components/profile/PiHero.vue'
import PiRail from '@/newtab/components/profile/PiRail.vue'
import PiToday from '@/newtab/components/profile/PiToday.vue'
import PiRhythm from '@/newtab/components/profile/PiRhythm.vue'
import PiYear from '@/newtab/components/profile/PiYear.vue'
import ReviewPanel from '@/newtab/components/dashboard/ReviewPanel.vue'
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import { useDashboardStats } from '@/newtab/components/dashboard/useDashboardStats'
import { useDashboardReport } from '@/newtab/composables/useDashboardReport'
import DayDetail from '@/newtab/components/dashboard/DayDetail.vue'
import Drawer from '@/shared/components/Drawer.vue'

const router = useRouter()
const store = useAppStore()
const gd = computed(() => store.data!)

/* ===== 页头 KPI（PiHero 输入） ===== */
const pageSub = computed(() => {
  const d = gd.value
  const res = d.resources.filter(r => !r.deletedAt).length
  const task = d.tasks.filter(t => !t.deletedAt).length
  const curio = d.curiosities.filter(c => !c.deletedAt).length
  return { total: res + task + curio }
})

/* ===== 事件日志（readEventLog 优先，空日志回退卡片时间派生） ===== */
const eventLog = shallowRef<CardEvent[]>([])
const logEmpty = ref(true)
const gStartOfToday = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); return dt.getTime() })()
async function refreshEventLog() {
  const log = await readEventLog()
  eventLog.value = log.slice().reverse()
  logEmpty.value = log.length === 0
}
type GFlat = { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; createdAt: number; deletedAt?: number; importedAt?: number }
const gFlat = computed<GFlat[]>(() => [
  ...gd.value.resources.map(r => ({ kind: 'resource' as const, id: r.id, title: r.title || '（无标题）', createdAt: r.createdAt || 0, deletedAt: r.deletedAt, importedAt: r.importedAt })),
  ...gd.value.tasks.map(t => ({ kind: 'task' as const, id: t.id, title: t.title || '（无标题）', createdAt: t.createdAt || 0, deletedAt: t.deletedAt, importedAt: t.importedAt })),
  ...gd.value.curiosities.map(c => ({ kind: 'curiosity' as const, id: c.id, title: c.question || '（无标题）', createdAt: c.createdAt || 0, deletedAt: c.deletedAt, importedAt: c.importedAt }))
])
const derivedEvents = computed<CardEvent[]>(() => {
  const out: CardEvent[] = []
  for (const x of gFlat.value) {
    if (x.createdAt) out.push({ id: `d-${x.id}-c`, ts: x.createdAt, action: 'create', kind: x.kind, title: x.title, cardId: x.id })
    if (x.deletedAt) out.push({ id: `d-${x.id}-d`, ts: x.deletedAt, action: 'delete', kind: x.kind, title: x.title, cardId: x.id })
  }
  return out.sort((a, b) => b.ts - a.ts)
})
const timelineEvents = computed<CardEvent[]>(() => (logEmpty.value ? derivedEvents.value : eventLog.value))

/* ===== 数据桥（useDashboardStats） ===== */
const gResLive = computed(() => gd.value.resources.filter(r => !r.deletedAt))
const gTaskLive = computed(() => gd.value.tasks.filter(t => !t.deletedAt))
const gCurioLive = computed(() => gd.value.curiosities.filter(c => !c.deletedAt))
const linkCardCount = computed(() => gResLive.value.filter(r => (r.link || '').trim()).length)
const dash = useDashboardStats(
  () => gd.value,
  () => timelineEvents.value,
  () => ({ res: gResLive.value.length, task: gTaskLive.value.length, curio: gCurioLive.value.length })
)
const dashYear = dash.year
const dashSelDay = dash.selDay
const dashStats = dash.stats

/* ===== 复盘段依赖（方向对账切片） ===== */
const dashDirections = computed<DirLike[]>(() => (gd.value.compass?.directions || []).map(d => ({
  id: d.id, name: d.name,
  focused: (d.projects || []).some(p => p.isFocused),
  projects: (d.projects || []).map(p => ({ id: p.id, name: p.name }))
})))
const dashTasks = computed<TaskLike[]>(() => (gd.value.tasks || []).map(t => ({
  id: t.id, title: t.title, projectId: t.projectId,
  createdAt: t.createdAt, completedAt: t.completedAt, deletedAt: t.deletedAt, status: t.status
})))

/* ===== 复盘报告出口（useDashboardReport） ===== */
const { onReportSave, onReportExport, onReportTask, onReportGoto } = useDashboardReport({ gd, persist: () => store.persist(), router })

/* ===== Hero KPI（真实口径） ===== */
const heroTotal = computed(() => pageSub.value.total)
const heroStreak = computed(() => currentStreak(dashStats.value))
const heroYearAgg = computed(() => yearAgg(dashStats.value, dashYear.value))
const heroActiveDays = computed(() => heroYearAgg.value.act)
const heroLongest = computed(() => longestStreak(dashStats.value, dashYear.value))
const tagLists = computed(() => [
  ...gResLive.value.map(r => r.tags || []),
  ...gTaskLive.value.map(t => t.tags || [])
])
const heroEntropy = computed(() => computeTagEntropy(tagLists.value))
const topTags = computed(() => {
  const cnt = new Map<string, number>()
  for (const tags of tagLists.value) {
    for (const t of new Set(tags.map(s => s.trim()).filter(Boolean))) cnt.set(t, (cnt.get(t) || 0) + 1)
  }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
})

/* ===== PiToday 输入 ===== */
const todayAdd = computed(() => gFlat.value.filter(x => !x.deletedAt && x.createdAt >= gStartOfToday).length)
const todayDel = computed(() => gFlat.value.filter(x => x.deletedAt && x.deletedAt >= gStartOfToday).length)
const todayCalled = computed(() => timelineEvents.value.filter(e => e.action === 'call' && e.ts >= gStartOfToday).length)
const writeCount = computed(() => timelineEvents.value.length)
const reviewReady = computed(() => (dashStats.value.days[todayKey()]?.w || 0) > 0)
const todayFocus = computed(() => gd.value.dailyFocus?.[todayKey()] || [])
const avgDailyCreate = computed(() => {
  const a = aggregateRange(dashStats.value, `${dashYear.value}-01-01`, todayKey())
  const creates = a.c.res + a.c.curio + a.c.task
  return a.days > 0 ? creates / a.days : null
})

/* ===== PiRail 导航 ===== */
type RailK = 'now' | 'recent' | 'year'
const railActive = ref<RailK>('now')
let railObs: IntersectionObserver | null = null
function onRailJump(k: RailK) {
  const id = k === 'now' ? 'mod-now' : k === 'recent' ? 'mod-recent' : 'mod-year'
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ===== 复盘弹窗（T3：ReviewPanel → 中央大弹层，功能零删） ===== */
const reviewOpen = ref(false)
function openReview() {
  reviewOpen.value = true
  if (!eventLog.value.length) void refreshEventLog()
}

/* ===== 操作记录（四类入口 + 全量抽屉） ===== */
const logOpen = ref(false)
const logPreset = ref<LogPreset>({ kind: 'all', action: 'all', from: '', to: '' })
function openLog(k: 'in' | 'out' | 'called' | 'log') {
  const today = fmtDayKey(Date.now())
  const preset: LogPreset =
    k === 'in' ? { kind: 'all', action: 'create', from: today, to: today, note: '今日入台 = 今日新增（含导入）的卡片。' }
      : k === 'out' ? { kind: 'all', action: 'delete', from: today, to: today, note: '今日移出 = 今日软删的卡片（可恢复）。' }
        : k === 'called' ? { kind: 'all', action: 'call', from: today, to: today, note: '今日调出 = 今日被打开的卡片。' }
          : { kind: 'all', action: 'all', from: '', to: '', note: '写入记录 = 全量时间线（类型 × 动作 × 时间三维可筛）。' }
  logPreset.value = preset
  logOpen.value = true
  if (!eventLog.value.length) void refreshEventLog()
}

/* ===== 核心指标下钻抽屉 ===== */
type StatDrawerType = '' | 'all' | 'resource' | 'task' | 'curiosity' | 'link'
interface StatRow { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; ts: number; owner?: string }
const statDrawer = ref<StatDrawerType>('')
const totalCards = computed(() => gResLive.value.length + gTaskLive.value.length + gCurioLive.value.length)
const statList = computed<StatRow[]>(() => {
  switch (statDrawer.value) {
    case 'resource': return gResLive.value.map(r => ({ kind: 'resource' as const, id: r.id, title: r.title, ts: r.createdAt }))
    case 'task': return gTaskLive.value.map(t => ({ kind: 'task' as const, id: t.id, title: t.title, ts: t.createdAt }))
    case 'curiosity': return gCurioLive.value.map(c => ({ kind: 'curiosity' as const, id: c.id, title: c.question, ts: c.createdAt }))
    case 'link': return gResLive.value.filter(r => (r.link || '').trim()).map(r => ({ kind: 'resource' as const, id: r.id, title: r.title, ts: r.createdAt }))
    case 'all': return gFlat.value.filter(x => !x.deletedAt).map(x => ({ kind: x.kind, id: x.id, title: x.title, ts: x.createdAt }))
    default: return []
  }
})
const STAT_PAGE = 20
const statPage = ref(1)
const statSearch = ref('')
function openStatDrawer(t: StatDrawerType) { statDrawer.value = t; statPage.value = 1; statSearch.value = '' }
const statFiltered = computed<StatRow[]>(() => {
  const q = statSearch.value.trim().toLowerCase()
  if (!q) return statList.value
  return statList.value.filter(c => c.title.toLowerCase().includes(q) || (c.owner || '').toLowerCase().includes(q))
})
const statPageCount = computed(() => Math.max(1, Math.ceil(statFiltered.value.length / STAT_PAGE)))
const statShown = computed(() => statFiltered.value.slice((statPage.value - 1) * STAT_PAGE, statPage.value * STAT_PAGE))
function statGo(delta: number) { statPage.value = Math.min(statPageCount.value, Math.max(1, statPage.value + delta)) }
function statKindIcon(kind: string) { return kind === 'task' ? '✅' : kind === 'curiosity' ? '💡' : '📇' }
function statKindLabel(kind: string) { return kind === 'task' ? '任务' : kind === 'curiosity' ? '好奇' : '资源' }
function openStatCard(x: { kind: string; id: string }) {
  const kind = asLocateKind(x.kind)
  if (!kind) { showToast('⚠ 该卡片类型暂不支持定位'); return }
  const t = locateTargetOf(gd.value, kind, x.id)
  if (!t) { showToast('⚠ 该卡片已不在库中'); return }
  statDrawer.value = ''
  void router.push(t)
}
const statDrawerTitle = computed(() => ({
  all: `📊 全部卡片明细（${totalCards.value}）`,
  resource: `📇 资源卡明细（${statList.value.length}）`,
  task: `✅ 任务卡明细（${statList.value.length}）`,
  curiosity: `💡 好奇心卡明细（${statList.value.length}）`,
  link: `🔗 链接卡片明细（${statList.value.length} · 跨全部台面）`,
  '': ''
}[statDrawer.value]))

/* ===== 动态条下钻抽屉 ===== */
type DynDrawerType = '' | 'today-add' | 'today-del' | 'week-add' | 'week-del' | 'cum-del'
const dynDrawer = ref<DynDrawerType>('')
function openDynDrawer(t: DynDrawerType) { dynDrawer.value = t; dynPage.value = 1; dynSearch.value = ''; if (!eventLog.value.length) void refreshEventLog() }
const gStartOfWeek = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dt.getTime() })()
/* ★W9 退役重指带备案：R48-B2「导入双口径」的今日/本周计数（迁移自 GlobalSettings 仪表盘面板）。 */
const todayImportCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.importedAt && x.importedAt >= gStartOfToday).length)
const weekImportCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.importedAt && x.importedAt >= gStartOfWeek).length)
const dynRange = computed<[number, number] | null>(() => {
  switch (dynDrawer.value) {
    case 'today-add': case 'today-del': return [gStartOfToday, Infinity]
    case 'week-add': case 'week-del': return [gStartOfWeek, Infinity]
    default: return null
  }
})
type DynRow = Omit<CardEvent, 'action'> & { action: 'create' | 'delete' | 'import' }
const dynList = computed<DynRow[]>(() => {
  if (!dynDrawer.value) return []
  const [from, to] = dynRange.value || [0, Infinity]
  if (dynDrawer.value === 'cum-del') {
    return timelineEvents.value.filter(e => e.action === 'delete' || e.action === 'purge') as unknown as DynRow[]
  }
  const wantAdd = dynDrawer.value === 'today-add' || dynDrawer.value === 'week-add'
  const rows: DynRow[] = []
  for (const x of gFlat.value) {
    if (wantAdd) {
      if (x.deletedAt) continue
      if (x.importedAt && x.importedAt >= from && x.importedAt <= to)
        rows.push({ id: 'i-' + x.id, ts: x.importedAt, action: 'import', kind: x.kind, title: x.title, cardId: x.id })
      else if (x.createdAt >= from && x.createdAt <= to)
        rows.push({ id: 'c-' + x.id, ts: x.createdAt, action: 'create', kind: x.kind, title: x.title, cardId: x.id })
    } else if (x.deletedAt && x.deletedAt >= from && x.deletedAt <= to) {
      rows.push({ id: 'd-' + x.id, ts: x.deletedAt, action: 'delete', kind: x.kind, title: x.title, cardId: x.id })
    }
  }
  return rows.sort((a, b) => b.ts - a.ts)
})
const dynPage = ref(1)
const dynSearch = ref('')
const dynFiltered = computed<DynRow[]>(() => {
  const q = dynSearch.value.trim().toLowerCase()
  if (!q) return dynList.value
  return dynList.value.filter(e => e.title.toLowerCase().includes(q))
})
const dynPageCount = computed(() => Math.max(1, Math.ceil(dynFiltered.value.length / STAT_PAGE)))
const dynShown = computed(() => dynList.value.slice((dynPage.value - 1) * STAT_PAGE, dynPage.value * STAT_PAGE))
function dynGo(delta: number) { dynPage.value = Math.min(dynPageCount.value, Math.max(1, dynPage.value + delta)) }
const dynDrawerTitle = computed(() => ({
  'today-add': `📈 今日新增明细（${dynList.value.length}）`,
  'today-del': `📉 今日删除明细（${dynList.value.length}）`,
  'week-add': `📈 本周新增明细（${dynList.value.length}）`,
  'week-del': `📉 本周删除明细（${dynList.value.length}）`,
  'cum-del': `🗑 累计删除明细（${dynList.value.length}）`,
  '': ''
}[dynDrawer.value]))

/* ===== 生命周期（T6：面板本体已并入 PiYear；此处保留写操作与阈值弹窗） ===== */
const lcCards = computed<LifecycleCard[]>(() => {
  const d = store.data!
  return [
    ...d.resources.filter(r => !r.deletedAt),
    ...d.tasks.filter(t => !t.deletedAt),
    ...d.curiosities.filter(c => !c.deletedAt)
  ]
})
function lcFind(id: string): LifecycleCard | undefined { return lcCards.value.find(c => c.id === id) }
function onLcArchive(id: string) { const c = lcFind(id); if (!c) return; c.lifecycleArchived = true; c.updatedAt = Date.now(); store.persist() }
function onLcSnooze(id: string) { const c = lcFind(id); if (!c) return; snoozeCard(c); store.persist() }
function onLcReactivate(id: string) { const c = lcFind(id); if (!c) return; reactivateCard(c); store.persist() }
function onLcSetDays(id: string, days: number | null) { const c = lcFind(id); if (!c) return; setCoolingDays(c, days); store.persist() }
function onLcLocate(id: string, kind: LifecycleCard['kind']) {
  const t = locateTargetOf(store.data!, kind, id)
  if (!t) { showToast('⚠ 该卡片已不在库中'); return }
  void router.push(t)
}
const lcSetOpen = ref(false)
const lcDefaultDraft = ref<number>(coolingDefaultDaysOf() || 30)
function saveLcDefault() {
  const v = Math.min(365, Math.max(1, Math.round(Number(lcDefaultDraft.value) || 30)))
  lcDefaultDraft.value = v
  saveUIPrefs({ coolingDaysDefault: v })
  setCoolingDefaultDays(v)
  store.persist()
  showToast(`⚙ 默认冷却天数已设为 ${v} 天（归档 ${v * 3} 天）`)
}

/* ===== 今日战报弹窗（DayDetail） ===== */
const dayOpen = ref(false)
function openTodayBattle() {
  const today = fmtDayKey(Date.now())
  if (dashStats.value.days[today]) {
    dashSelDay.value = today
  } else {
    const keys = Object.keys(dashStats.value.days).filter(k => dashStats.value.days[k].w > 0).sort().reverse()
    dashSelDay.value = keys[0] || today
  }
  dayOpen.value = true
}
function openDayBattle(day: string) {
  if (!day) { openTodayBattle(); return }
  dashSelDay.value = day
  dayOpen.value = true
}
function onDayOpenLog(day: string) {
  dayOpen.value = false
  logPreset.value = { kind: 'all', action: 'all', from: day, to: day, note: `来源：日详情——已按 ${day} 预筛。` }
  logOpen.value = true
}

/* ===== Hero 动作 ===== */
function onHeroDrill(k: 'total' | 'streak' | 'active' | 'entropy' | 'longest') {
  if (k === 'total') { openStatDrawer('all'); return }
  if (k === 'entropy') {
    const t = topTags.value
    showToast(t.length ? `知识熵 ${heroEntropy.value} bit · 高频标签：${t.map(([n, c]) => `${n}(${c})`).join('、')}` : '知识熵 0 bit · 库里还没有带标签的卡片')
    return
  }
  openLog('log')
}
function onHeroRefresh() {
  void refreshEventLog()
  void refreshErrorCount()
  showToast('⟳ 已重读事件日志与错误日志')
}
function onHeroExport(fmt: string) {
  const lines = [
    `画像洞察导出 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    `卡片总量：${heroTotal.value}`,
    `连续打卡：${heroStreak.value} 天`,
    `活跃天数（${dashYear.value}）：${heroActiveDays.value} 天`,
    `最长连续（${dashYear.value}）：${heroLongest.value} 天`,
    `知识熵：${heroEntropy.value} bit`
  ]
  if (fmt === 'csv') {
    const csv = '指标,数值\n' + lines.slice(2).map(l => l.replace('：', ',')).join('\n')
    downloadText(`画像洞察_${stampDay()}.csv`, csv, 'csv')
  } else {
    downloadText(`画像洞察_${stampDay()}.md`, lines.join('\n'), 'md')
  }
  showToast('✓ 已导出画像摘要')
}

/* ===== PiToday 动作 ===== */
function onTodayDrill(k: 'd-in' | 'd-out' | 'd-call' | 'streak') {
  if (k === 'd-in') openLog('in')
  else if (k === 'd-out') openLog('out')
  else if (k === 'd-call') openLog('called')
  else openLog('log')
}

/* ===== PiRhythm 动作 ===== */
function onRhythmDrill(k: 'wk-add' | 'wk-acts' | 'wk-w' | 'wk-call' | 'wk-pace') {
  if (k === 'wk-add') openDynDrawer('week-add')
  else openLog('log')
}
function onGoalDrill() { void router.push('/') }
function onFlowLocate(cardId: string) {
  for (const kind of ['resource', 'task', 'curiosity'] as const) {
    const t = locateTargetOf(gd.value, kind, cardId)
    if (t) { void router.push(t); return }
  }
  showToast('⚠ 该卡片已不在库中')
}

/* ===== 运行错误徽标 ===== */
const errorLogCount = ref(0)
async function refreshErrorCount() { errorLogCount.value = (await readErrorLog()).length }
const offErrLog = subscribeErrorLog((n) => { errorLogCount.value = n })
async function exportErrorLog() {
  const logs = await readErrorLog()
  if (!logs.length) { showToast('没有运行错误记录'); return }
  const rows = logs.map(e =>
    `[${new Date(e.ts).toLocaleString('zh-CN', { hour12: false })}] ${e.source} @ ${e.route}\n${e.message}\n${e.stack}`
  ).join('\n\n———\n\n')
  downloadText(`zhiyuan_运行错误_${stampDay()}.txt`, rows, 'txt')
  showToast(`✓ 已导出 ${logs.length} 条运行错误（含完整堆栈）`)
}

/* ===== 辅助 ===== */
function fmtDayKey(ts: number): string {
  const dt = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function fmtEventTime(ts: number): string {
  const dt = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}
function fmtDay(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  return `${dt.getMonth() + 1}-${dt.getDate()}`
}
function eventKindLabel(k: CardEvent['kind']): string {
  return k === 'resource' ? '资源' : k === 'task' ? '任务' : k === 'curiosity' ? '好奇' : '系统'
}
function eventActionLabel(a: CardEvent['action']): string {
  return a === 'create' ? '+ 新增' : a === 'call' ? '↗ 调出' : a === 'delete' ? '− 删除' : a === 'restore' ? '↩ 恢复' : a === 'status' ? '◐ 状态变更' : '✕ 永久删除'
}

/* ===== 生命周期 ===== */
onMounted(() => {
  void refreshEventLog()
  void refreshErrorCount()
  // PiRail IntersectionObserver
  railObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        const id = en.target.id
        railActive.value = id === 'mod-now' ? 'now' : id === 'mod-recent' ? 'recent' : 'year'
      }
    }
  }, { rootMargin: '-25% 0px -55% 0px' })
  for (const id of ['mod-now', 'mod-recent', 'mod-year']) {
    const el = document.getElementById(id)
    if (el) railObs.observe(el)
  }
  // 支持 #lifecycle / #lc-sec 深链（归档提示条 → PiYear 生命周期段）
  if (location.hash === '#lifecycle' || location.hash === '#lc-sec') {
    setTimeout(() => document.getElementById('lc-sec')?.scrollIntoView({ behavior: 'smooth' }), 160)
  }
})
onUnmounted(() => { railObs?.disconnect(); offErrLog() })
// 战报/复盘打开前重读事件日志（keep-alive 场景数据不冻结）
watch(dayOpen, async (v) => { if (v) await refreshEventLog() })
watch(reviewOpen, async (v) => { if (v) await refreshEventLog() })
</script>
<template>
  <div class="pi-page">
    <!-- ===== §0 Hero 页头 ===== -->
    <PiHero
      :total="heroTotal" :streak="heroStreak" :active-days="heroActiveDays"
      :entropy="heroEntropy" :longest="heroLongest" :error-count="errorLogCount"
      @drill="onHeroDrill" @refresh="onHeroRefresh" @export="onHeroExport"
      @export-error="exportErrorLog" @open-log="openLog('log')" />

    <!-- ===== 时间轴：左 rail + 右三模块 ===== -->
    <div class="pi-tl">
      <PiRail :active="railActive" @jump="onRailJump" />
      <div class="pi-rmods">
        <PiToday
          :today-add="todayAdd" :today-del="todayDel" :today-called="todayCalled"
          :write-count="writeCount" :streak="heroStreak" :review-ready="reviewReady"
          :focus="todayFocus" :avg-daily-create="avgDailyCreate"
          @drill="onTodayDrill" @open-battle="openTodayBattle" @open-focus="() => router.push('/')" />

        <PiRhythm
          :stats="dashStats" :events="timelineEvents" :directions="dashDirections"
          :tasks="dashTasks" :error-count="errorLogCount" :year="dashYear"
          @open-review="openReview" @open-err="exportErrorLog"
          @open-battle="openDayBattle" @drill="onRhythmDrill" @goal-drill="onGoalDrill"
          @locate="onFlowLocate" />

        <PiYear
          :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
          :events="timelineEvents" :live-link="linkCardCount"
          :lc-cards="lcCards" :all-events="timelineEvents"
          @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
          @open-battle="openDayBattle" @open-review="openReview"
          @lc-locate="onLcLocate" @lc-archive="onLcArchive" @lc-snooze="onLcSnooze"
          @lc-reactivate="onLcReactivate" @lc-set-days="onLcSetDays"
          @lc-settings="lcSetOpen = true" />
      </div>
    </div>

    <!-- ★W12-B 底栏整条删除：原先这里挂着「只读纪律」免责文字 + 一枚「全部记录」。
     「全部记录」已上提为页头全页唯一入口（PiHero），近期模块里那一枚重复入口一并收掉；
     「只读纪律」那段文字按用户 2026-10-13 拍板不留。 -->

    <!-- ===== 复盘弹窗（T3：ReviewPanel → 中央大弹层） ===== -->
    <Teleport to="body">
      <div v-if="reviewOpen" class="pi-rev-overlay" @click.self="reviewOpen = false">
        <div class="pi-rev-modal" role="dialog" aria-modal="true" aria-label="周月复盘">
          <button class="pi-rev-close" title="关闭" @click="reviewOpen = false">✕</button>
          <ReviewPanel
            :stats="dashStats" :events="timelineEvents" :data="gd"
            :directions="dashDirections" :tasks="dashTasks"
            @save-report="onReportSave" @report-task="onReportTask"
            @report-goto="onReportGoto" @report-export="onReportExport" />
        </div>
      </div>
    </Teleport>

    <!-- ===== 阈值设置弹窗 ===== -->
    <Teleport to="body">
      <div class="gs-modal-overlay" :class="{ open: lcSetOpen }" @click.self="lcSetOpen = false">
        <div class="gs-modal" style="width: 640px">
          <div class="gs-modal-header">⚙ 冷却阈值设置</div>
          <div class="gs-modal-body">
            <p>全局默认冷却 <b>{{ lcDefaultDraft || 30 }}</b> 天 · 归档 = 冷却 × 3 = <b>{{ (lcDefaultDraft || 30) * 3 }}</b> 天；每张卡可单独覆盖（清除后回落全局默认）。<br />修改阈值只影响状态判定，<b>不会改变卡片活跃度</b>。</p>
            <div class="lc-set-global">
              <span>默认冷却天数</span>
              <input v-model.number="lcDefaultDraft" type="number" min="1" max="365" class="gs-confirm-input" style="width: 90px" />
              <button class="gs-btn" @click="saveLcDefault">保存</button>
            </div>
            <div class="lc-set-list">
              <div v-for="c in lcCards" :key="c.id" class="lc-set-row">
                <span class="lc-set-name" :title="(c as any).title">{{ (c as any).title || (c as any).question || '未命名' }}</span>
                <input class="gs-confirm-input" style="width: 80px" type="number" min="1" max="365" placeholder="默认"
                  :value="(c as any).coolingDays || ''"
                  @change="onLcSetDays(c.id, Number(($event.target as HTMLInputElement).value) || null)" />
                <button class="gs-btn" @click="onLcSetDays(c.id, null)">清除</button>
              </div>
            </div>
          </div>
          <div class="gs-modal-footer">
            <button class="gs-btn" @click="lcSetOpen = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ===== 全量记录抽屉 ===== -->
    <DashboardLogDrawer :open="logOpen" :events="timelineEvents" :data="gd" :preset="logPreset" @close="logOpen = false" />

    <!-- ===== 核心指标下钻抽屉 ===== -->
    <Drawer :open="!!statDrawer" :title="statDrawerTitle" width="460px" @close="statDrawer = ''">
      <div class="gs-drawer-fill">
        <div class="gs-drawer-search">
          <input v-model="statSearch" placeholder="🔍 搜索标题 / 项目 · 指标">
          <span class="cnt">{{ statFiltered.length }} 条</span>
        </div>
        <div class="gs-ev-list">
          <div v-for="c in statShown" :key="c.id" class="gs-ev-row static clickable" @click="openStatCard(c)">
            <span class="gs-ev-kind">{{ statKindIcon(c.kind) }}</span>
            <span class="gs-ev-badge">{{ statKindLabel(c.kind) }}</span>
            <span class="gs-ev-title">{{ c.title }}</span>
            <span v-if="c.kind === 'task'" class="gs-ev-owner">{{ (c as any).owner }}</span>
            <span class="gs-ev-time">{{ fmtDay(c.ts) }}</span>
          </div>
          <div v-if="!statFiltered.length" class="gs-ev-empty">{{ statSearch.trim() ? '没有匹配的卡片' : '暂无卡片' }}</div>
          <div v-if="statList.length" class="pi-hint">💡 单击行可跳转定位到卡片所在页面。</div>
        </div>
        <div v-if="statPageCount > 1" class="gs-pager">
          <button :disabled="statPage <= 1" @click="statGo(-1)">‹ 上一页</button>
          <span>第 {{ statPage }} / {{ statPageCount }} 页 · 每页 {{ STAT_PAGE }} 条</span>
          <button :disabled="statPage >= statPageCount" @click="statGo(1)">下一页 ›</button>
        </div>
      </div>
    </Drawer>

    <!-- ===== 动态条明细抽屉 ===== -->
    <Drawer :open="!!dynDrawer" :title="dynDrawerTitle" width="460px" @close="dynDrawer = ''">
      <div class="gs-drawer-fill">
        <div class="gs-drawer-search">
          <input v-model="dynSearch" placeholder="🔍 搜索卡片标题">
          <span class="cnt">{{ dynFiltered.length }} 条</span>
        </div>
        <div class="gs-ev-list">
          <div v-for="e in dynShown" :key="e.id" class="gs-ev-row static">
            <span class="gs-ev-time">{{ fmtEventTime(e.ts) }}</span>
            <span class="gs-ev-badge" :class="e.action === 'import' ? 'create' : e.action">{{ e.action === 'import' ? '⇪ 导入' : eventActionLabel(e.action) }}</span>
            <span class="gs-ev-kind">{{ eventKindLabel(e.kind) }}</span>
            <span class="gs-ev-title">{{ e.title }}</span>
          </div>
          <div v-if="!dynFiltered.length" class="gs-ev-empty">{{ dynSearch.trim() ? '没有匹配的记录' : '该时间范围内没有记录' }}</div>
        </div>
        <div v-if="dynPageCount > 1" class="gs-pager">
          <button :disabled="dynPage <= 1" @click="dynGo(-1)">‹ 上一页</button>
          <span>第 {{ dynPage }} / {{ dynPageCount }} 页 · 每页 {{ STAT_PAGE }} 条</span>
          <button :disabled="dynPage >= dynPageCount" @click="dynGo(1)">下一页 ›</button>
        </div>
        <div class="pi-hint">💡 操作有痕：新增即保存，删除进回收站可恢复；导入的卡带「⇪ 导入」徽标（继承原创建时间）。</div>
      </div>
    </Drawer>

    <!-- ===== 今日战报弹窗（DayDetail） ===== -->
    <Teleport to="body">
      <div v-if="dayOpen && dashSelDay" class="pi-day-overlay" @click.self="dayOpen = false">
        <div class="pi-day-modal" role="dialog" aria-modal="true" aria-label="今日战报">
          <DayDetail
            :stats="dashStats" :day="dashSelDay" :events="timelineEvents" :live-link="linkCardCount"
            @close="dayOpen = false" @open-log="onDayOpenLog" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== 页面容器 ===== */
.pi-page { max-width: 1440px; margin: 0 auto; padding: 24px 36px 64px; display: flex; flex-direction: column; gap: 24px; }
.pi-hint { font-size: var(--fs-caption); color: var(--text-3); margin-top: 8px; }

/* ===== 阈值弹窗（复用 gs-modal） ===== */
.gs-modal-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: rgba(0,0,0,.45); display: none; align-items: center; justify-content: center; }
.gs-modal-overlay.open { display: flex; }
.gs-modal { background: var(--surface); border-radius: 12px; box-shadow: 0 24px 80px rgba(0,0,0,.25); display: flex; flex-direction: column; max-height: 85vh; }
.gs-modal-header { font-size: var(--fs-title); font-weight: 700; color: var(--text); padding: 18px 22px 12px; border-bottom: 1px solid var(--border); }
.gs-modal-body { padding: 16px 22px; overflow-y: auto; flex: 1; font-size: var(--fs-body); color: var(--text-2); line-height: 1.8; }
.gs-modal-footer { padding: 12px 22px 18px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }
.gs-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-sub);
  border-radius: var(--radius-sm); padding: 5px 14px; cursor: pointer; font-family: inherit; transition: all var(--dur-fast); }
.gs-btn:hover { border-color: var(--border-strong); color: var(--text); }
.gs-confirm-input { border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
  font-size: var(--fs-sub); border-radius: var(--radius-sm); padding: 4px 8px; font-family: inherit; }
.gs-confirm-input:focus { outline: none; border-color: var(--accent); }
.lc-set-global { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
.lc-set-list { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
.lc-set-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); }
.lc-set-name { flex: 1; font-size: var(--fs-caption); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

/* ===== 今日战报弹窗壳 ===== */
.pi-day-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.pi-day-modal { width: min(720px, 92vw); max-height: 86vh; background: var(--surface); border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,.25); overflow: hidden; display: flex; flex-direction: column; }

/* ===== 抽屉填充（复用 gs-drawer 样式） ===== */
.gs-drawer-fill { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; }
.gs-drawer-search { display: flex; align-items: center; gap: 8px; }
.gs-drawer-search input { flex: 1; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
  font-size: var(--fs-sub); border-radius: var(--radius-sm); padding: 6px 10px; font-family: inherit; }
.gs-drawer-search input:focus { outline: none; border-color: var(--accent); }
.gs-drawer-search .cnt { font-size: var(--fs-caption); color: var(--text-3); white-space: nowrap; }
.gs-ev-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; min-height: 0; }
.gs-ev-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; font-size: var(--fs-sub); border: 1px solid transparent; }
.gs-ev-row.static { border-color: var(--border); }
.gs-ev-row.static.clickable { cursor: pointer; }
.gs-ev-row.static.clickable:hover { background: var(--surface-2); border-color: var(--border-strong); }
.gs-ev-kind { flex-shrink: 0; }
.gs-ev-badge { flex-shrink: 0; font-size: var(--fs-tiny); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); color: var(--text-3); }
.gs-ev-badge.create { color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); }
.gs-ev-badge.delete { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, transparent); }
.gs-ev-badge.call { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.gs-ev-badge.status { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 30%, transparent); }
.gs-ev-title { flex: 1; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.gs-ev-owner { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-3); }
.gs-ev-time { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-4); font-variant-numeric: tabular-nums; }
.gs-ev-empty { padding: 28px 10px; text-align: center; color: var(--text-3); font-size: var(--fs-sub); }
.gs-pager { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: var(--fs-caption); color: var(--text-3); }
.gs-pager button { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-caption);
  border-radius: var(--radius-sm); padding: 3px 10px; cursor: pointer; font-family: inherit; }
.gs-pager button:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.gs-pager button:disabled { opacity: var(--opacity-disabled); cursor: default; }
</style>