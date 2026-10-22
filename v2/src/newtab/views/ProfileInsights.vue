<script setup lang="ts">
/**
 * V3.9.3：画像洞察页 —— 概览 + 单段时间轴（今天 / 本周 / 本月 / 本年）。
 *
 * 本版把已确认的高保真原型落为生产：
 *   §0 PiHero 页头（标题 / 使命与主攻 / 全库读数 / 刷新、导出、全部记录）
 *   §1 PiOverview 首屏双栏（左：本周方向；右：今天三件事）
 *   §2 PiRangeTabs（唯一导航）+ 单段时间面板（四选一）：
 *     ① PiToday  今天 · TODAY（今日六格 + 今日三件事 + 洞察条）
 *     ② PiRhythm 本周 · WEEK（strip + 节奏柱 + 目标 + 规则对照；★V3.8.20 固定周窗口）
 *     ③ PiMonth  本月 · MONTH（★V3.8.20 新增轻量月度段：strip + 月柱 + 6 KPI + 环比；目标/预警/操作流不重复）
 *     ④ PiYear   全年 · YEAR（F20 诊断条 + F21 strip4 + 默认展开年度热力图 + 生命周期）
 *
 * 单段切换取代四段纵向堆叠：★W17-C09 起默认「今天」；页签与左轨
 * 共用 activeRange，只切换当前时间尺度，不滚动到隐藏的段落。点热力格直接打开该日战报。
 *
 * 决策落实：
 *   D1 六维砍掉 → PiRhythm 用复盘段真实 kpisOf 六枚
 *   D3 下钻维持既有形态（胶囊→抽屉 / 中央大弹层只留战报与复盘）
 *   D4 ReviewPanel → 中央弹窗（Teleport）——★W13-D5 退役（2026-10-16 用户拍板）：复盘能力全量
 *     常驻页面四段，宿主零挂载；组件文件保留待复用；PiYear「目标对账」按钮随迁下线）
 *   T8 DashboardOverview 退役（本页不再引用；文件删除另行处理）
 *
 * 数据桥口径不变：readEventLog 优先，空日志回退卡片时间派生；只读 store.data 快照，
 * 写操作只经 store.persist()（lifecycle 三写 + 报告落卡）。
 */
import Icon from '@/shared/components/Icon.vue'
import '@/newtab/components/dashboard/dashboard.css'
import '@/newtab/components/profile/pi-timeline.css'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import type { AppData, TaskCard, ResourceCard } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { readEventLog } from '@/shared/utils/eventLog'
import { readErrorLog, subscribeErrorLog } from '@/shared/utils/runtimeError'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
import { showToast } from '@/shared/components/toast'
import { saveUIPrefs } from '@/shared/storage/repository'
import { downloadText, stampDay } from '@/shared/utils/download'
import { uid } from '@/shared/utils'
import type { TodayRow } from '@/newtab/components/profile/PiToday.vue'
import {
  snoozeCard, reactivateCard, setCoolingDays,
  coolingDefaultDaysOf, setCoolingDefaultDays, lifecycleState, coolingMsOf
} from '@/shared/utils/lifecycle'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'
import {
  computeTagEntropy, todayKey,
  computeTaskSupportRate, computeMainFocusShare, windowOf, tasksOfDirection,
  buildConciseInsights, objectivesOf
} from '@/shared/utils/reviewReport'
import type { DirLike, TaskLike, ConciseCtx } from '@/shared/utils/reviewReport'
import { aggregateRange } from '@/shared/utils/dailyStats'
import PiHero from '@/newtab/components/profile/PiHero.vue'
import PiToday from '@/newtab/components/profile/PiToday.vue'
import PiRhythm from '@/newtab/components/profile/PiRhythm.vue'
import PiMonth, { type MonthTopic } from '@/newtab/components/profile/PiMonth.vue'
import { useCuriosity } from '@/newtab/stores/curiosity'
import PiYear from '@/newtab/components/profile/PiYear.vue'
import PiOverview, { type FocusProjectView } from '@/newtab/components/profile/PiOverview.vue'
import { useCompass } from '@/newtab/stores/compass'
import PiRangeTabs, { type PiRange } from '@/newtab/components/profile/PiRangeTabs.vue'
import { AiDrawer } from '@/newtab/components/lazyAiDrawer'
/* ★W13-D5：ReviewPanel 弹窗挂载退役（2026-10-16）——组件文件保留待复用，宿主零 import。 */
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import ProjectDetailDrawer from '@/newtab/components/ProjectDetailDrawer.vue'
import TaskDetailDrawer from '@/newtab/components/compass/TaskDetailDrawer.vue'
import { useDashboardStats } from '@/newtab/components/dashboard/useDashboardStats'
import DayDetail from '@/newtab/components/dashboard/DayDetail.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useResourceOpen } from '@/newtab/composables/useResourceOpen'
import { emitOpenDrawer } from '@/shared/utils/bus'
import PiTagDistributionDrawer from '@/newtab/components/profile/PiTagDistributionDrawer.vue'
import PiMetricDetailDrawer, { type PiStatRow, type PiReconCell } from '@/newtab/components/profile/PiMetricDetailDrawer.vue'
import PiLifecycleSettingsModal from '@/newtab/components/profile/PiLifecycleSettingsModal.vue'
import { useRangeAiInsight } from '@/newtab/composables/useRangeAiInsight'
import { profileDirectionFitText, profileExportLines, profileRangeFacts } from '@/newtab/views/profileInsightsReport'

const router = useRouter()
const store = useAppStore()
const gd = computed(() => store.data!)
const taskDetailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
const { openResourceLink } = useResourceOpen({ store, d: gd })
/* ★W17-C09：方向状态面板要「停滞 / 已完成 / 未完成数」——与方向台同一口径，故直接用 compass store */
const { focusedProjects, projectProgress, projectTasksOf, isProjectStalled, isProjectDone } = useCompass()

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

/* ===== Hero KPI（真实口径）；★W13-F21 归位：本年活跃/最长连续/当前连续三枚时间指标
   随 Hero 四底盘定版（T2）与 F21 本年四格定版（T6）从宿主迁出——组件内
   yearAgg/longestStreak 同源直算，宿主不再留死计算 ===== */
const heroTotal = computed(() => pageSub.value.total)
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

/* ===== W13-T2 · Hero 三层结构输入（D1） ===== */
const heroKindCounts = computed(() => ({
  res: gResLive.value.length, task: gTaskLive.value.length, curio: gCurioLive.value.length
}))
const heroTopTags = computed(() => topTags.value.slice(0, 3).map(([n]) => n))
/** F3 · 任务证据支撑率：有 SupportLink 的未删任务 ÷ 未删任务（T1 纯函数同源） */
const heroSupportRate = computed(() => computeTaskSupportRate(gd.value.tasks || [], gd.value.supportLinks || []))
/** F3 · 近 30 天精力落主攻：事件流有效动作中归属主攻项目的占比 */
const heroFocusShare = computed(() => computeMainFocusShare(
  timelineEvents.value,
  gd.value.compass?.directions || [],
  gd.value.tasks || [],
  30
))
/** F2 · 使命主线：mission.content → vision.content → ''（空由 PiHero 出轻引导） */
const heroMission = computed(() => {
  const c = gd.value.compass
  return (c?.mission?.content || '').trim() || (c?.vision?.content || '').trim()
})
/** ★W17-C09 · 方向状态面板的主攻项目（≤2）：全名 + 状态 + 进度 + 未完成任务数，
 *  与方向台同一口径（isProjectDone / isProjectStalled 由 useCompass 提供）。 */
const heroFocusProjects = computed<FocusProjectView[]>(() => {
  const out: FocusProjectView[] = []
  for (const p of focusedProjects.value) {
    const open = projectTasksOf(p.id).filter(x => !x.deletedAt && x.status !== 'done').length
    out.push({
      id: p.id,
      name: p.name,
      progress: Math.round(projectProgress(p).pct || 0),
      state: isProjectDone(p) ? 'done' : isProjectStalled(p) ? 'stalled' : 'active',
      open
    })
    if (out.length >= 2) break
  }
  return out
})
/** F4 · 支撑口径复用集：已挂支撑关联的任务 id 集 + 主攻项目 id 集（下钻/清单同源） */
const supportedTaskIds = computed(() => new Set((gd.value.supportLinks || []).map(l => l.taskId)))
const focusProjectIds = computed(() => {
  const s = new Set<string>()
  for (const d of gd.value.compass?.directions || [])
    for (const p of d.projects || []) if (p.isFocused && p.status !== 'archived') s.add(p.id)
  return s
})

/* ===== PiToday 输入（★W13-T3：F7~F11 行详情/弹药/三态诊断/空槽推荐——原 avgDailyCreate
   年均线洞察与 todayDel 随 F7 三态定版、F8 四格定版退役；连续打卡三件已随 T6 收官
   迁出宿主（PiYear 组件内 yearAgg/longestStreak 同源直算，F21 归位定版）） ===== */
const todayAdd = computed(() => gFlat.value.filter(x => !x.deletedAt && x.createdAt >= gStartOfToday).length)
const todayCalled = computed(() => timelineEvents.value.filter(e => e.action === 'call' && e.ts >= gStartOfToday).length)
/* ★V3.8.18（N9）此处原有 writeCount / reviewReady 两个 computed，随 PiToday 的
   「写入记录」「复盘就绪」两枚重复 chip 一起退役——它们的唯一消费方就是那两枚 chip。
   能力未减：写入记录的全量口径仍走 eventLog 时间线；复盘就绪的判断仍由
   DashPanel/复盘链路自己按 `days[today].w > 0` 派生（不依赖这里）。 */
const todayFocus = computed(() => gd.value.dailyFocus?.[todayKey()] || [])

/* ===== W13-T3 · 今日三件事行详情 / 弹药 / 三态诊断 / 空槽推荐（F7~F11） ===== */
const projNameById = computed(() => {
  const m = new Map<string, string>()
  for (const d of gd.value.compass?.directions || []) for (const p of d.projects || []) m.set(p.id, p.name)
  return m
})
/** F10 匹配口径（确定性、可核对）：任务标签交集优先，其次标题词面前缀互含；命中 ≤6 张 */
function matchResourcesOf(task?: TaskCard): ResourceCard[] {
  if (!task) return []
  const tks = new Set((task.tags || []).map(s => s.trim().toLowerCase()).filter(Boolean))
  const q = (task.title || '').toLowerCase().replace(/\s+/g, '')
  const out: ResourceCard[] = []
  for (const r of gd.value.resources || []) {
    if (r.deletedAt) continue
    const tagHit = (r.tags || []).map(s => s.trim().toLowerCase()).some(t => tks.has(t))
    const rq = (r.title || '').toLowerCase().replace(/\s+/g, '')
    const titleHit = q.length >= 4 && rq.length >= 4 && (rq.includes(q.slice(0, 6)) || q.includes(rq.slice(0, 4)))
    if (tagHit || titleHit) { out.push(r); if (out.length >= 6) break }
  }
  return out
}
const todayRows = computed<(TodayRow | null)[]>(() => {
  const out: (TodayRow | null)[] = []
  for (let i = 0; i < 3; i++) {
    const s = todayFocus.value[i]
    if (!s || !s.text) { out.push(null); continue }
    const task = s.sourceType === 'task' && s.sourceId ? gd.value.tasks.find(t => t.id === s.sourceId && !t.deletedAt) : undefined
    const pid = task?.projectId
    const supportCount = new Set((gd.value.supportLinks || [])
      .filter(l => l.taskId === task?.id).map(l => l.resourceId)).size
    const canBind = !!task && (!pid || supportCount === 0)
    out.push({
      idx: i, slot: s, hasProject: !!pid,
      focused: !!pid && focusProjectIds.value.has(pid),
      projectName: pid ? projNameById.value.get(pid) || '' : '',
      projectId: pid || '',
      supportCount,
      matchCount: canBind ? matchResourcesOf(task).length : 0,
      canBind
    })
  }
  return out
})
const todayFilled = computed(() => todayRows.value.filter(Boolean).length)
/** F8 已备弹药：三件事所关联任务的 SupportLink 去重资源卡总数
    ★W16-T2：与「弹药清单」同源（只算**存活**资源卡）—— 原先这里数的是 SupportLink 里的 id（含已软删），
    弹药卡删掉后数字还是 6、清单只剩 5 行，账对不上。已删的那几张在对账条里单列。 */
const todayAmmo = computed(() => ammoSplit.value.live.length)
/** ★W13-T7 · 四尺度一句话诊断统一走 reviewReport.buildConciseInsights（T1 数据层已备，本轮接线）：
    宿主只负责把四个窗口的口径喂进去，诊断文本与 CTA 单一真源；四组件条带与 F5 导出同源。 */
const conciseCtx = computed<ConciseCtx>(() => {
  const rows = todayRows.value.filter(Boolean) as TodayRow[]
  const need = rows.filter(r => r.canBind)
  const denom = todayCalled.value + todayAdd.value
  const weekWin = windowOf('week', {})
  const wAgg = aggregateRange(dashStats.value, weekWin.s, weekWin.e)
  const objs = objectivesOf(dashDirections.value, dashTasks.value, weekWin)
  const cutoff14 = Date.now() - 14 * 86400000
  return {
    today: {
      freeCount: need.length,
      freeMatched: need.reduce((n, r) => n + (r.matchCount || 0), 0),
      readyCards: todayAmmo.value,
      todayCalled: todayCalled.value,
      todayAdd: todayAdd.value,
      reusePct: denom > 0 ? todayCalled.value / denom : null,
      focusDone: rows.filter(r => r.slot.done).length,
      focusTotal: rows.length
    },
    week: {
      acts: wAgg.acts,
      called: wAgg.u,
      topShare: objs.rows[0]?.share || 0,
      zeroTouch: objs.rows.filter(r => r.v === 0).length
    },
    month: {
      entropyFrom: mEntTrend.value.from,
      entropyTo: mEntTrend.value.to,
      oldCurio: gd.value.curiosities.filter(c =>
        !c.deletedAt && !c.convertedAt && c.status === 'doing' && (c.createdAt || 0) <= cutoff14).length,
      matureMatched: mMature.value.length,
      projected: mProjected.value
    },
    year: { coolingHigh: yCoolHigh.value, dirFitText: yDirFit.value }
  }
})
/** 四条诊断（today/week/month/year）· 唯一真源 = buildConciseInsights。
    唯一特例：今天没排三件事时 ctx 表达不了「去排」这个动作，由宿主覆盖为空态（其余三态一律走引擎）。 */
const concise = computed(() => {
  const r = buildConciseInsights(conciseCtx.value)
  if (todayRows.value.some(r2 => r2)) return r
  return {
    ...r,
    today: {
      html: '今天还没有排三件事——去调度台排一排，晚上复盘会更清楚。',
      warn: false,
      ctaLabel: '＋ 去排今日三件事 ›',
      ctaAction: 'openFocusBoard'
    }
  }
})
/* ★W17-C09 退役带备案：空槽推荐（F11）随「今日三件事」整块退出画像页——
   排今日三件事的唯一入口是调度台，页面不再提供就地补位。todayRows 仍保留：
   诊断口径（conciseCtx）与「已备弹药」取数都依赖它，只是不再渲染成行。 */
/** ★W13-T7 · 四条诊断 CTA 的统一动作分发（buildConciseInsights 出 8 个 ctaAction 键，
    四组件条带全部走这一个出口——原先四段各写各的 onXxxInsightAction，现按键分派）。
    键 → 动作：openFocusBoard 去排三件事 / bindFocus 归位首件游离 / callSupport 调出支撑卡 /
    openBattle 今日战报 / openObjectives 头号战略目标产出明细 / openLog 全量记录 /
    convertCurio 批量转化成熟好奇卡 / wakeCooling · openLifecycle 冷却区唤醒复温。 */
function onConciseAction(action: string) {
  if (action === 'openFocusBoard') { void router.push('/'); showToast('已跳调度台 · 排一排今日三件事'); return }
  /* ★W17-C09：画像页不再提供就地归位（三件事能力唯一归调度台），CTA 改为跳过去处理 */
  if (action === 'bindFocus') {
    void router.push('/')
    showToast('已跳调度台 · 到今日三件事里完成归位')
    return
  }
  if (action === 'callSupport') { openStatDrawer('ammo'); return }
  if (action === 'ammo') { openStatDrawer('ammo'); return }
  if (action === 'cooling') { openStatDrawer('cooling'); return }
  if (action === 'openBattle') { openTodayBattle(); return }
  if (action === 'openObjectives') {
    const rows = objectivesOf(dashDirections.value, dashTasks.value, windowOf('week', {})).rows
    if (rows[0]) onGoalDrill(rows[0].id)
    else showToast('还没有战略目标产出可看')
    return
  }
  if (action === 'openLog') { openLog('log'); return }
  if (action === 'convertCurio') {
    const list = mMature.value
    if (!list.length) { showToast('没有可转化的成熟好奇卡'); return }
    for (const c of [...list]) curioApi.convertToTask(c)
    showToast(`已将 ${list.length} 张成熟好奇卡转化为任务`)
    return
  }
  if (action === 'wakeCooling' || action === 'openLifecycle') wakeCooling()
}

/** ★W14-T1 · 主攻项目详情抽屉（用户拍板 2026-10-16）：Hero 主攻胶囊与今日三件事行的 🚀 主攻标签
    共用这一个出口，抽屉本体沿用方向台/策展台同一枚 ProjectDetailDrawer（零新建组件、可编辑）。 */
const projDetailOpen = ref(false)
const projDetailId = ref<string | null>(null)
function openProjectDetail(projectId: string) {
  if (!projectId) { showToast('未找到该项目'); return }
  projDetailId.value = projectId
  projDetailOpen.value = true
}

/* ===== 时间尺度：四选一单段展示 =====
 * ★W17-C09（2026-10-20 用户拍板）：左侧时间线与节点整体退役——周期区唯一导航 = 四个页签。
 * 原 timelineAnchor 滚动锚与 onRailJump 随之删除（页签切换不再需要"滚到隐藏段落"）。 */
/* ★W18（2026-10-20 用户拍板）：默认落在「本年」——页面定位是看长期状态，先给全年再逐层下钻。 */
const activeRange = ref<PiRange>('year')
function setRange(k: PiRange): void { activeRange.value = k }

/* G-04：四段 AI 续写只解释本页已算出的本地事实，不改数字、不改用户决策。
   动态载入与失败回落统一收在 composable；宿主只提供本地事实。 */
const {
  job: rangeAiJob,
  open: openRangeAi,
} = useRangeAiInsight({
  activeRange,
  data: gd,
  persist: () => store.persist(),
  localInsight: range => concise.value[range],
  facts: range => profileRangeFacts(range, {
    concise: concise.value[range],
    stats: dashStats.value,
    directions: dashDirections.value,
    tasks: dashTasks.value,
    todayAdd: todayAdd.value,
    todayCalled: todayCalled.value,
    todayFilled: todayFilled.value,
    todayAmmo: todayAmmo.value,
    monthCurioConv: mCurioConv.value,
    monthProjected: mProjected.value,
    monthTopics: mTopics.value,
    yearCoolingHigh: yCoolHigh.value,
    yearDirFit: String(yDirFit.value || '暂无'),
    total: heroTotal.value,
    kinds: heroKindCounts.value,
  }),
})

/* 首屏概览的窗口范围（左栏标题右侧的小日期刻度） */
const overviewWeekRange = computed(() => {
  const w = windowOf('week', {})
  const f = (s: string) => `${Number(s.slice(5, 7))}.${s.slice(8, 10)}`
  return `${f(w.s)} — ${f(w.e)}`
})

/* ===== 复盘弹窗（★W13-D5 退役 2026-10-16）：ReviewPanel 挂载随「复盘能力四段常驻」拍板下线——
   reviewOpen/openReview/useDashboardReport 四出口（save/task/goto/export）一并退役，组件文件保留。 ===== */

/* ===== 操作记录（四类入口 + 全量抽屉） ===== */
const logOpen = ref(false)
const logPreset = ref<LogPreset>({ kind: 'all', action: 'all', from: '', to: '' })
function openLog(k: 'in' | 'out' | 'called' | 'log' | 'month-in') {
  const today = fmtDayKey(Date.now())
  const preset: LogPreset =
    k === 'in' ? { kind: 'all', action: 'create', from: today, to: today, note: '今日入台 = 今日新增（含导入）的卡片。' }
      : k === 'out' ? { kind: 'all', action: 'delete', from: today, to: today, note: '今日移出 = 今日软删的卡片（可恢复）。' }
        : k === 'called' ? { kind: 'all', action: 'call', from: today, to: today, note: '今日调出 = 今日被打开的卡片。' }
          : k === 'month-in' ? { kind: 'all', action: 'create', from: fmtDayKey(gStartOfMonth), to: '', note: '本月入池 = 本月新增（含导入）的卡片。' }
            : { kind: 'all', action: 'all', from: '', to: '', note: '写入记录 = 全量时间线（类型 × 动作 × 时间三维可筛）。' }
  logPreset.value = preset
  logOpen.value = true
  if (!eventLog.value.length) void refreshEventLog()
}
/** W13-F28/T7：主攻动作明细——原 dynDrawer「focus-acts」语义平移（LogPreset.focusOnly） */
function openLogFocus() {
  logPreset.value = {
    kind: 'all', action: 'all', from: fmtDayKey(Date.now() - 30 * 86400_000), to: '',
    focusOnly: true, note: '近30天主攻动作 = 归属主攻项目任务的新增/调出/改状态事件。'
  }
  logOpen.value = true
  if (!eventLog.value.length) void refreshEventLog()
}

/* ===== 核心指标下钻抽屉 ===== */
/* ★W13-D5/F28 · 死分支清净（2026-10-16）：原七类卡明细下钻（resource/task/curiosity/link）
   的入口在 DashboardOverview 整体退役后已零调用者（R44-7 只留 all/support 等活锚）。
   ★W15-T1（2026-10-16 用户拍板）新增四类**卡片清单型**分支：ammo（已备弹药）/ cooling（可调出旧卡）
   / today-in（今日入台卡）/ today-call（今日调出卡）—— 原先这些入口给的是**事件流水**，
   语义错配（按钮承诺 N 张卡，点进去是流水，今日调出为 0 时打开就是空的）。 */
type StatDrawerType = '' | 'all' | 'support' | 'goal-week'
  | 'curio-conv' | 'curated' | 'mo-support' | 'topic'
  | 'ammo' | 'cooling' | 'today-in' | 'today-call'
type StatRow = PiStatRow
const statDrawer = ref<StatDrawerType>('')
/** ★V3.9.7：标签分布不再借通用卡片明细抽屉。知识熵是产品使用状态的一项解释，
 *  需要把“它是什么 / 当前为什么是这样 / 下一步做什么 / AI 怎么处理”讲成一组连续内容。 */
const tagInsightOpen = ref(false)
type TagOptimizeJob = import('@/shared/ai/job').AiJob
const tagAiJob = shallowRef<TagOptimizeJob | null>(null)
/* F15：战略目标点行 → 该方向本周「新建 ∪ 完成」任务明细（PiRhythm goal-drill 落点） */
const goalDirId = ref('')
/* F18：Top 主题行下钻 → 该标签本月新增卡片清单 */
const topicTag = ref('')
const totalCards = computed(() => gResLive.value.length + gTaskLive.value.length + gCurioLive.value.length)
const statList = computed<StatRow[]>(() => {
  switch (statDrawer.value) {
    case 'support': return gTaskLive.value.map(t => ({
      kind: 'task' as const, id: t.id, title: t.title, ts: t.createdAt,
      owner: supportedTaskIds.value.has(t.id) ? '已支撑' : '未支撑'
    }))
    /* ★W15-T1 四类卡片清单型分支：弹药 / 冷却旧卡 / 今日入台 / 今日调出 */
    case 'ammo': return ammoCards.value
    case 'cooling': return coolingCards.value
    case 'today-in': return todayInCards.value
    case 'today-call': return todayCalledCards.value
    case 'all': return gFlat.value.filter(x => !x.deletedAt).map(x => ({ kind: x.kind, id: x.id, title: x.title, ts: x.createdAt }))
    /* F15：该方向在本周窗口内新建 ∪ 完成的任务（与 objectivesOf 同口径 tasksOfDirection） */
    case 'goal-week': return goalDirId.value
      ? tasksOfDirection(dashTasks.value, dashDirections.value, goalDirId.value, windowOf('week', {}))
        .map(t => ({
          kind: 'task' as const, id: t.id, title: t.title || '（无标题）', ts: t.createdAt || 0,
          owner: t.completedAt ? '本周完成' : '＋ 本周新建'
        }))
      : []
    /* F17：本月转化离场的好奇卡（R167 convertedAt 记账戳，含软删离场卡——池里数不到靠它计数） */
    case 'curio-conv': return gd.value.curiosities
      .filter(c => c.convertedAt && c.convertedAt >= gStartOfMonth)
      .map(c => ({
        kind: 'curiosity' as const, id: c.id, title: c.question || '（无标题）', ts: c.convertedAt || 0,
        owner: c.convertedTo === 'task' ? '→ 转任务' : '→ 归资源'
      }))
    /* F17/F19：策展金字塔现存量（投射卡 + 论点卡两段拼一张清单，owner 标来源） */
    case 'curated': return [
      ...(gd.value.curationProjections || []).filter(p => p.kind === 'card' && p.cardId).map(p => {
        const card = gFlat.value.find(x => x.id === p.cardId)
        return { kind: (card?.kind || 'resource') as StatRow['kind'], id: p.cardId!, title: card?.title || '（源卡已删除）', ts: 0, owner: '⇧ 投射' }
      }),
      ...(gd.value.argCards || []).filter(a => !a.deletedAt).map(a => ({
        kind: 'resource' as const, id: a.id, title: a.title || a.content?.slice(0, 30) || '（论点卡）', ts: a.createdAt || 0, owner: '论点'
      }))
    ]
    /* F19②：本月新支撑链接 + 本月完成任务 */
    case 'mo-support': return [
      ...(gd.value.supportLinks || []).filter(l => (l.createdAt || 0) >= gStartOfMonth).map(l => {
        const card = gFlat.value.find(x => x.id === l.resourceId)
        return { kind: (card?.kind || 'resource') as StatRow['kind'], id: l.resourceId, title: card?.title || '（源卡已删除）', ts: l.createdAt || 0, owner: '新支撑' }
      }),
      ...gTaskLive.value.filter(t => (t.completedAt || 0) >= gStartOfMonth).map(t => ({
        kind: 'task' as const, id: t.id, title: t.title, ts: t.completedAt || 0, owner: '已完成'
      }))
    ]
    /* F18：某标签本月新增的资源卡 */
    case 'topic': return topicTag.value
      ? gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth && (r.tags || []).some(t => t.trim() === topicTag.value))
        .map(r => ({ kind: 'resource' as const, id: r.id, title: r.title, ts: r.createdAt || 0 }))
      : []
    default: return []
  }
})
/* ===== ★W16-T2 · 四类卡片清单型分支的取数修正（2026-10-16 逐个核对计数口径后）=====
   病灶是"数字"和"清单"两套口径各说各话，点开对不上账。四处修正：
   ① todayCardIds 拆成 createdIds / calledIds —— 原先把「创建 ∪ 调出」并成一个集合，
      「今日调出」清单会把今天只新建、没打开的卡也列进去（V3.8.23 引入）。
   ② 今日入台统一按卡字段 createdAt 取数（与 todayAdd 计数同源）—— 原清单额外要求"有 create 事件"，
      老数据没事件时漏卡，数字与清单不等。事件只用来补一个来源标记。
   ③ 已备弹药：数字与清单同源（都只算存活资源卡），被软删的那几张在对账条里单列。
   ④ 冷却清单：日期语义从"最近编辑日"改成"冷却 N 天 / 阈值 N 天 / 调用 N 次"。
   另：抽屉行原本只在 kind==='task' 时显示说明 ⇒ 冷却与弹药都是资源卡，说明整列都不显示（⑤）。 */
/** 今日有 create 事件的卡（用于来源标记；计数仍以 createdAt 为准） */
const todayCreatedEventIds = computed(() => {
  const ids = new Set<string>()
  for (const e of timelineEvents.value) {
    if (e.kind === 'system' || e.ts < gStartOfToday) continue
    if (e.action === 'create') ids.add(e.cardId)
  }
  return ids
})
/** 今日被调出（action=call）的卡 —— 「今日调出」清单只认这一路，不再混入今日新建的卡 */
const todayCalledIds = computed(() => {
  const ids = new Set<string>()
  for (const e of timelineEvents.value) {
    if (e.kind === 'system' || e.ts < gStartOfToday) continue
    if (e.action === 'call') ids.add(e.cardId)
  }
  return ids
})
/** 今日入台的卡（按 createdAt，与 todayAdd 计数同源；事件只补来源标记） */
const todayInCards = computed<StatRow[]>(() => gFlat.value
  .filter(x => !x.deletedAt && x.createdAt >= gStartOfToday)
  .sort((a, b) => b.createdAt - a.createdAt)
  .map(x => ({
    kind: x.kind, id: x.id, title: x.title, ts: x.createdAt,
    owner: x.importedAt ? '本地导入' : (todayCreatedEventIds.value.has(x.id) ? '采集入池' : '本地新建')
  })))
/** 今日被调出的卡（只取 call 事件那批；同一张卡调出多次只列一行，次数差值由对账条说明） */
const todayCalledCards = computed<StatRow[]>(() => gFlat.value
  .filter(x => !x.deletedAt && todayCalledIds.value.has(x.id))
  .map(x => ({ kind: x.kind, id: x.id, title: x.title, ts: x.createdAt, owner: '↗ 今日已调出' })))
/** 已备弹药：只算**存活**资源卡（与弹药格数字同源），并单列已软删的那几张供对账 */
const ammoSplit = computed(() => {
  const taskIds = new Set<string>()
  for (const r of todayRows.value) { if (r && r.slot.sourceId) taskIds.add(r.slot.sourceId) }
  const seen = new Set<string>()
  const live: StatRow[] = []
  let removed = 0
  for (const l of gd.value.supportLinks || []) {
    if (!l.resourceId || !taskIds.has(l.taskId) || seen.has(l.resourceId)) continue
    seen.add(l.resourceId)
    const card = gResLive.value.find(r => r.id === l.resourceId)
    if (!card) { removed++; continue }
    live.push({ kind: 'resource', id: card.id, title: card.title, ts: card.createdAt || 0, owner: '已备弹药' })
  }
  return { live, removed }
})
const ammoCards = computed<StatRow[]>(() => ammoSplit.value.live)
/** 可调出的旧卡 = 冷却期卡（逐卡 lifecycleState 判定，与 LifecyclePanel 的 Tab 同一真源，非另造口径） */
const coolingCards = computed<StatRow[]>(() => {
  const titleOfLc = (c: LifecycleCard): string => (c.kind === 'curiosity' ? c.question : c.title) || '（无标题）'
  const now = Date.now()
  return lcCards.value
    .filter(c => lifecycleState(c) === 'cooling')
    .map(c => ({
      kind: c.kind as StatRow['kind'], id: c.id, title: titleOfLc(c),
      ts: c.updatedAt || 0,
      owner: `冷却中 · 阈值 ${Math.round(coolingMsOf(c) / 86400000)} 天`
    }))
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
/**
 * ★V3.9.7 指标明细点击的唯一分流：
 *  · 资源有可打开的链接 → 直接打开；链接为空或打不开 → 打开资源详情；
 *  · 任务 → 打开任务详情；
 *  · 好奇心 → 打开全站好奇心详情。
 * 不再走 locateTargetOf / `/deck/:kind`：用户点的是一张卡，不是“去卡片池再看一次”。
 */
function openStatCard(x: { kind: string; id: string }) {
  // 统计行沿用 resource/task/curiosity；若上游历史数据给了 res/curio 短码，也一并归一。
  const rawKind = x.kind === 'res' ? 'resource' : x.kind === 'curio' ? 'curiosity' : x.kind
  const kind = asLocateKind(rawKind)
  if (!kind) { showToast('该卡片类型暂不支持打开'); return }
  const exists = kind === 'resource'
    ? gResLive.value.some(r => r.id === x.id)
    : kind === 'task'
      ? gTaskLive.value.some(t => t.id === x.id)
      : gCurioLive.value.some(c => c.id === x.id)
  if (!exists) { showToast('该卡片已不在库中'); return }
  statDrawer.value = ''
  if (kind === 'resource') {
    const resource = gResLive.value.find(r => r.id === x.id)!
    if (openResourceLink(resource)) return
    emitOpenDrawer({ kind: 'res', id: resource.id })
    return
  }
  if (kind === 'task') {
    const task = gTaskLive.value.find(t => t.id === x.id)!
    taskDetailRef.value?.open(task)
    return
  }
  emitOpenDrawer({ kind: 'curio', id: x.id })
}

async function openTagDistribution() {
  tagInsightOpen.value = true
  statDrawer.value = ''
}
async function runTagOptimizeAi() {
  try {
    const [{ loadAiConfig, aiReady, aiConfig }, govern] = await Promise.all([
      import('@/shared/ai/config'), import('@/shared/ai/govern'),
    ])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成地址、Key 与模型配置'); return }
    const job = govern.buildTagGovernJob({
      d: gd.value, depth: aiConfig.value.depth, persist: () => store.persist(),
    })
    if (!job) { showToast('当前没有可处理的标签问题'); return }
    tagAiJob.value = job
  } catch (e) {
    showToast('AI 入口载入失败：' + (e instanceof Error ? e.message : String(e)))
  }
}
const statDrawerTitle = computed(() => ({
  all: `全部卡片明细（${totalCards.value}）`,
  support: `任务证据支撑明细（${statList.value.length}）`,
  ammo: `已备弹药 · 三件事的支撑卡清单（${statList.value.length} 张）`,
  cooling: `可调出的旧卡 · 冷却期清单（${statList.value.length} 张）`,
  'today-in': `今日入台的卡（${statList.value.length} 张）`,
  'today-call': `↗ 今日调出的卡（${statList.value.length} 张）`,
  'goal-week': `${dashDirections.value.find(d => d.id === goalDirId.value)?.name || '方向'} · 本周产出任务（${statList.value.length}）`,
  'curio-conv': `本月转化的好奇卡（${statList.value.length}）`,
  'curated': `入策展金字塔明细（${statList.value.length} · 投射 + 论点）`,
  'mo-support': `本月支撑任务明细（${statList.value.length}）`,
  topic: `#${topicTag.value} 本月新增卡片（${statList.value.length}）`,
  '': ''
}[statDrawer.value]))

/** ★W16-T3 · 抽屉对账条（用户拍板 2026-10-16「要」）：把"次数"与"张数"两套口径并排摆出来。
    病灶是同一件事有两个数（今日调出按事件次数、去重后才是卡数），标题只写一个数会让人以为对不上账。 */
const statReconcile = computed<PiReconCell[] | null>(() => {
  const S = statDrawer.value
  if (!S) return null
  const cell = (k: string, n: number | string, u?: string, warn?: boolean): PiReconCell => ({ k, n: String(n), u, warn })
  switch (S) {
    case 'today-call':
      /* 计数 todayCalled 是事件次数，清单是去重卡数 —— 两个数并排，说清差别 */
      return [cell('调出动作', todayCalled.value, '次', todayCalled.value > statList.value.length),
        cell('涉及卡片', statList.value.length, '张'), cell('其中重复打开', Math.max(0, todayCalled.value - statList.value.length), '次')]
    case 'today-in':
      return [cell('今日入台', todayAdd.value, '张'), cell('清单行数', statList.value.length, '张'),
        cell('本地导入', statList.value.filter(c => c.owner === '本地导入').length, '张'),
        cell('采集入池', statList.value.filter(c => c.owner === '采集入池').length, '张')]
    case 'ammo':
      return [cell('存活弹药卡', ammoSplit.value.live.length, '张'), cell('已进回收站', ammoSplit.value.removed, '张', ammoSplit.value.removed > 0),
        cell('支撑关联条数', (gd.value.supportLinks || []).filter(l => l.taskId && todayRows.value.some(r => r && r.slot.sourceId === l.taskId)).length, '条')]
    case 'cooling':
      return [cell('冷却期卡', statList.value.length, '张'), cell('其中高价值（调用≥3）', coolingCards.value.filter(c => (gResLive.value.find(r => r.id === c.id)?.callCount || 0) >= 3).length, '张'),
        cell('默认冷却阈值', Math.round((coolingDefaultDaysOf() || 30)), '天'), cell('默认归档阈值', Math.round((coolingDefaultDaysOf() || 30) * 3), '天')]
    case 'support':
      const supported = (gd.value.supportLinks || []).filter(l => l.taskId).map(l => l.taskId)
      const supportedTasks = gTaskLive.value.filter(t => supported.includes(t.id)).length
      return [cell('支撑率', heroSupportRate.value, '%'), cell('已支撑', supportedTasks, '个'),
        cell('未支撑', Math.max(0, gTaskLive.value.length - supportedTasks), '个', supportedTasks < gTaskLive.value.length)]
    case 'all':
      return [cell('存活卡片', totalCards.value, '张'), cell('资源', gResLive.value.length, '张'),
        cell('任务', gTaskLive.value.length, '张'), cell('好奇', gCurioLive.value.length, '张')]
    default: return null
  }
})
/** 对账条的脚注：一句话说清这个抽屉是什么维度 */
const statReconcileNote = computed(() => {
  const S = statDrawer.value
  if (!S) return ''
  if (S === 'today-call') return '「次数」= 打开动作总数（含同一张卡多次打开）；「张数」= 去重后的卡片数。两者不同不是 bug，是两件事。'
  if (S === 'today-in') return '今日入台按卡字段 createdAt 计（与上方四格读数同源）；事件只用来标注来源。'
  if (S === 'ammo') return '弹药只算**存活**资源卡，与上方「已备弹药 N 张」同源；已软删的那几张单列，不混进清单。'
  if (S === 'cooling') return '冷却判定逐卡走 lifecycleState（与生命周期面板的「冷却」Tab 同一真源），默认 30 天不用即冷却、90 天归档。'
  if (S === 'support') return '支撑 = 任务到资源卡的一条显式关联，不是"标签相同就算支撑"。'
  if (S === 'all') return '本清单是卡片维度；想看"谁在什么时候做了什么"，去页头「全部记录」。'
  return ''
})

/* ===== W9/R48-B2 导入双口径计数（判据 R48-5 钉；界面徽标欠账见交付说明）+ 月窗口锚 ===== */
const gStartOfWeek = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dt.getTime() })()
const gStartOfMonth = (() => { const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(1); return dt.getTime() })()
const todayImportCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.importedAt && x.importedAt >= gStartOfToday).length)
const weekImportCount = computed(() => gFlat.value.filter(x => !x.deletedAt && x.importedAt && x.importedAt >= gStartOfWeek).length)

/* ===== ★W13-D5/F28 · 动态条下钻抽屉（dynDrawer）整体退役（2026-10-16）=====
   原「今日/本周/本月新增·删除明细、累计删除、近30天主攻动作」六类事件时间窗下钻，
   由页面全量记录抽屉 DashboardLogDrawer 统一承接（F28 全页唯一三维筛选抽屉）：
   - month-add → openLog('month-in')（action=create · from=月初 · 含导入）
   - focus-acts → openLogFocus()（LogPreset.focusOnly · 30 天窗 · 主攻任务三类动作）
   - today-add/today-del/week-del/cum-del 死分支（T4/T5 后零调用者）随抽屉一并清除。
   附带退役：DynRow/事件分页三件套/fmtEventTime/eventKindLabel/eventActionLabel
   （标签单一真源本就在 DashboardLogDrawer 的 KIND_LABEL/EVENT_ACT_LABEL，宿主这份是重复实现）。 */

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
  if (!t) { showToast('该卡片已不在库中'); return }
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
  showToast(`默认冷却天数已设为 ${v} 天（归档 ${v * 3} 天）`)
}

/* ===== PiYear 年度诊断条（W13-T6/F20~F23：方向归属占比 × 高价值冷却卡） ===== */
const lcFocus = ref<'active' | 'cooling' | 'archived' | undefined>(undefined)
const yCoolHigh = computed(() => lcCards.value.filter(c => lifecycleState(c) === 'cooling' && (c.callCount || 0) >= 3).length)
const yDirFit = computed(() => profileDirectionFitText(dashDirections.value, dashTasks.value))
function wakeCooling() {
  lcFocus.value = 'cooling'
  document.getElementById('lc-sec')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function onYearDrill(k: 'yr-assets' | 'yr-high') {
  if (k === 'yr-assets') openStatDrawer('all')
  else wakeCooling()
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

/* ===== Hero 动作（W13-T2 · F4 四张底盘卡各自有下钻出口） ===== */
function onHeroDrill(k: 'total' | 'entropy' | 'support' | 'focus') {
  if (k === 'total') { openStatDrawer('all'); return }
  if (k === 'support') { openStatDrawer('support'); return }
  if (k === 'focus') { openLogFocus(); return }
  if (k === 'entropy') { void openTagDistribution(); return }
}
function onHeroRefresh() {
  void refreshEventLog()
  void refreshErrorCount()
  showToast('⟳ 已重读事件日志与错误日志')
}
/** F2 轻引导：使命为空时一键去方向台设定 */
function gotoCompass() { void router.push('/compass'); showToast('已跳转方向台 · 在骨架条第 1 层设定使命愿景') }
function onHeroExport(fmt: string) {
  /* F5：导出 = 使命主线 + 4 项全库底盘指标 + 四尺度一句话诊断（与界面四条同源：strip-html 后落盘） */
  const lines = profileExportLines({
    mission: heroMission.value,
    total: heroTotal.value,
    kinds: heroKindCounts.value,
    entropy: heroEntropy.value,
    supportRate: heroSupportRate.value,
    focusShare: heroFocusShare.value,
    concise: concise.value,
  })
  if (fmt === 'csv') {
    const csv = '指标,数值\n' + lines.slice(2).map(l => l.replace('：', ',')).join('\n')
    downloadText(`画像洞察摘要_${stampDay()}.csv`, csv, 'csv')
  } else {
    downloadText(`画像洞察摘要_${stampDay()}.md`, lines.join('\n'), 'md')
  }
  showToast('已导出画像摘要')
}

/* ===== PiToday 动作（★W13-T3 收窄：strip 四格定版为 入台/调出/焦点/弹药——
   d-out（今日移出）与 streak（连续打卡迁 PiYear 年度段）两枚 drill 键随格退役；
   openLog('out') 的全量下钻能力仍在 DashboardLogDrawer 动作筛选里，一项未减） ===== */
/** ★W15-T1：四格全部可点（原先「已备弹药」格是死格），且全部落**卡片清单**型抽屉：
    d-in → 今日入台的卡 / d-call → 今日调出的卡 / d-ammo → 已备弹药清单。事件流水只在页头「全部记录」。 */
function onTodayDrill(k: 'd-in' | 'd-call' | 'd-ammo') {
  if (k === 'd-in') openStatDrawer('today-in')
  else if (k === 'd-ammo') openStatDrawer('ammo')
  else openStatDrawer('today-call')
}

/* ===== PiRhythm 动作（★W13-T4 收窄：F13 四格定版 有效动作/加权/调出/节奏——
   wk-add（采集）随格退役，周新增明细能力由 PiMonth 本月入池格同构承接；
   locate（操作流单击定位）随 pi-flow 整体退役，全量流水入口在页头「全部记录」） ===== */
function onRhythmDrill(k: 'wk-acts' | 'wk-w' | 'wk-call' | 'wk-pace') {
  void k
  openLog('log')
}
/* ===== PiMonth 动作（★W13-T5：F17 月度专属四格定版 入池/调出/转化/金字塔——
   旧 mo-acts/mo-w/mo-pace（克隆周度的读数）随 F17 整体退役，下钻收窄为 5 键
   （4 格 + funnel② 支撑）+ 主题行 + 诊断条动作三类。） ===== */
/* ---- T5 月度派生（宿主推导，PiMonth props-only 红线 R172-9）---- */
/* F16 知识熵变化：to=当前全库；from=上月底快照口径（存活卡中 createdAt 在本月初之前的子集——
   历史时点的真实全量已不可回放，以现存活卡按 createdAt 截断作诚实近似） */
const mEntTrend = computed(() => {
  /* 口径与 heroEntropy（tagLists）严格同源：只统计资源+任务两类存活卡的 tags（不含好奇心卡），
     from 仅按 createdAt 截断到本月初——历史时点的真实全量已不可回放，此为诚实近似快照。 */
  const before = [
    ...gd.value.resources.filter(r => !r.deletedAt && (r.createdAt || 0) < gStartOfMonth).map(r => r.tags || []),
    ...gd.value.tasks.filter(t => !t.deletedAt && (t.createdAt || 0) < gStartOfMonth).map(t => t.tags || [])
  ]
  return { from: computeTagEntropy(before), to: heroEntropy.value }
})
/* F18：本月新建资源卡 Top3 标签 + 各自主要服务的攻坚项目（卡 → SupportLink → 任务 → projectId 投票） */
const mTopics = computed<MonthTopic[]>(() => {
  const res = gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth)
  const cnt = new Map<string, number>()
  const votes = new Map<string, Map<string, number>>()
  const taskById = new Map((gd.value.tasks || []).map(t => [t.id, t]))
  for (const r of res) {
    const tags = [...new Set((r.tags || []).map(t => t.trim()).filter(Boolean))]
    const pids: string[] = []
    for (const l of gd.value.supportLinks || []) {
      if (l.resourceId !== r.id) continue
      const pid = taskById.get(l.taskId)?.projectId
      if (pid) pids.push(pid)
    }
    for (const t of tags) {
      cnt.set(t, (cnt.get(t) || 0) + 1)
      let m = votes.get(t)
      if (!m) { m = new Map(); votes.set(t, m) }
      for (const p of pids) m.set(p, (m.get(p) || 0) + 1)
    }
  }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([tag, n]) => {
    const m = votes.get(tag)
    let pid = '', best = 0
    if (m) for (const [p, v] of m) if (v > best) { best = v; pid = p }
    return { tag, n, project: pid ? projNameById.value.get(pid) || '' : '' }
  })
})
const mUntagged = computed(() => gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth && !(r.tags || []).some(t => t.trim())).length)
/* F19 三步漏斗（口径见组件 funnel-note：②转化=新支撑÷入池资源；③沉淀=新论点÷入池总张） */
const mFunnel = computed(() => {
  const resIn = gResLive.value.filter(r => (r.createdAt || 0) >= gStartOfMonth).length
  const curioIn = gCurioLive.value.filter(c => (c.createdAt || 0) >= gStartOfMonth).length
  const pool = resIn + curioIn
  const links = (gd.value.supportLinks || []).filter(l => (l.createdAt || 0) >= gStartOfMonth).length
  const doneTasks = gTaskLive.value.filter(t => (t.completedAt || 0) >= gStartOfMonth).length
  const curate = (gd.value.argCards || []).filter(a => !a.deletedAt && (a.createdAt || 0) >= gStartOfMonth).length
  return {
    pool, support: links + doneTasks, curate,
    convPct: resIn ? Math.round(links / resIn * 100) : 0,
    sinkPct: pool ? Math.round(curate / pool * 100) : 0
  }
})
/* F17 好奇心转化率 = 本月转化离场（R167 convertedAt）÷ 本月入池 */
const mCurioConv = computed(() => {
  const added = gd.value.curiosities.filter(c => !c.deletedAt && (c.createdAt || 0) >= gStartOfMonth).length
  const converted = gd.value.curiosities.filter(c => c.convertedAt && c.convertedAt >= gStartOfMonth).length
  return added ? Math.round(converted / added * 100) : 0
})
/* F17 金字塔现存量：CurationProjection 表无 createdAt 字段，按月口径不可得——
   strip 格用全量现存量（title 里写明），"本月新增"语义只落③的 ArgumentCard（有时间戳）。 */
const mProjected = computed(() => (gd.value.curationProjections || []).filter(p => p.kind === 'card').length)
/* F16 成熟好奇卡：status=doing（探索中）满 14 天 + 有同标签存活资源支撑 + 未转化离场 */
const curioApi = useCuriosity()
const mMature = computed(() => {
  const cutoff = Date.now() - 14 * 86400000
  const resTags = new Set<string>()
  for (const r of gResLive.value) for (const t of r.tags || []) if (t.trim()) resTags.add(t.trim())
  return gd.value.curiosities.filter(c =>
    !c.deletedAt && !c.convertedAt && c.status === 'doing'
    && (c.createdAt || 0) <= cutoff
    && (c.tags || []).some(t => resTags.has(t.trim())))
})
function onMonthDrill(k: 'mo-add' | 'mo-call' | 'mo-support' | 'mo-conv' | 'mo-curate') {
  if (k === 'mo-add') openLog('month-in')
  else if (k === 'mo-call') openLog('log')
  else if (k === 'mo-support') openStatDrawer('mo-support')
  else if (k === 'mo-conv') openStatDrawer('curio-conv')
  else openStatDrawer('curated')
}
function onMonthTopic(tag: string) { topicTag.value = tag; openStatDrawer('topic') }
/* F15：战略目标点行 → 该方向本周产出任务明细（原跳调度台首页，随 F13 浅化为就地抽屉） */
function onGoalDrill(dirId: string) {
  goalDirId.value = dirId
  openStatDrawer('goal-week')
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
  showToast(`已导出 ${logs.length} 条运行错误（含完整堆栈）`)
}

/* ===== 辅助 ===== */
function fmtDayKey(ts: number): string {
  const dt = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function fmtDay(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  return `${dt.getMonth() + 1}-${dt.getDate()}`
}
/* ★W13-D5/F28 随 dynDrawer 退役（2026-10-16）：fmtEventTime / eventKindLabel / eventActionLabel
   三函数一并删除——事件标签单一真源本就是 DashboardLogDrawer 的 KIND_LABEL + shared 的
   EVENT_ACT_LABEL（R169-T1），宿主这份是重复实现；「eventKindLabel 缺 ArgumentCard 分支」
   （清单勿误4处）随之消解：eventLog.CardKind 契约只有三卡类，论证卡不在事件维度内。 */

/* ===== 生命周期 ===== */
onMounted(() => {
  void refreshEventLog()
  void refreshErrorCount()
  // 支持 #lifecycle / #lc-sec 深链（归档提示条 → PiYear 生命周期段）
  if (location.hash === '#lifecycle' || location.hash === '#lc-sec') {
    activeRange.value = 'year'
    setTimeout(() => document.getElementById('lc-sec')?.scrollIntoView({ behavior: 'smooth' }), 160)
  }
})
onUnmounted(() => { offErrLog() })
// 战报打开前重读事件日志（keep-alive 场景数据不冻结；复盘弹窗 watch 随 D5 退役）
watch(dayOpen, async (v) => { if (v) await refreshEventLog() })
</script>
<template>
  <div class="pi-page">
    <!-- ===== §0 Hero 页头（★W17-C09：只留标题 + 三件套；方向带迁入方向状态面板） ===== -->
    <PiHero :error-count="errorLogCount"
      @refresh="onHeroRefresh" @export="onHeroExport"
      @export-error="exportErrorLog" @open-log="openLog('log')" />

    <!-- ===== §1 首屏双面板：产品使用状态 + 个人方向状态 ===== -->
    <PiOverview
      :total="heroTotal" :kind-counts="heroKindCounts" :entropy="heroEntropy"
      :top-tags="heroTopTags"
      :support-rate="heroSupportRate" :focus-share="heroFocusShare"
      :mission-text="heroMission" :focus-projects="heroFocusProjects"
      @kpi-drill="onHeroDrill" @goto-compass="gotoCompass"
      @open-project="openProjectDetail" />

    <!-- ===== §2 按周期观察：页签是唯一导航（★W17-C09：时间线与节点已退役） ===== -->
    <div class="pi-period-head">
      <div class="pi-tl-bar">
        <div><span class="pi-tl-kicker">PERIOD · 一次只看一个时间范围，切页签即可</span></div>
        <PiRangeTabs :model-value="activeRange" @update:model-value="setRange($event)" />
      </div>
    </div>
      <div class="pi-rmods pi-rmods-single">
        <PiToday v-if="activeRange === 'today'"
          :today-add="todayAdd" :today-called="todayCalled"
          :today-import="todayImportCount"
          :focus-filled="todayFilled" :ammo="todayAmmo" :slot-count="3"
          :insight="concise.today"
          @drill="onTodayDrill" @open-battle="openTodayBattle" @open-focus="() => router.push('/')"
          @insight-action="onConciseAction" @ai-insight="openRangeAi" />

        <PiRhythm v-else-if="activeRange === 'week'"
          :stats="dashStats" :directions="dashDirections"
          :tasks="dashTasks" :error-count="errorLogCount"
          :insight="concise.week"
          @open-err="exportErrorLog"
          @open-battle="openDayBattle" @drill="onRhythmDrill" @goal-drill="onGoalDrill"
          @insight-action="onConciseAction" @ai-insight="openRangeAi" />

        <PiMonth v-else-if="activeRange === 'month'"
          :stats="dashStats" :insight="concise.month" :ent="mEntTrend"
          :topics="mTopics" :untagged="mUntagged" :funnel="mFunnel"
          :curio-conv="mCurioConv" :projected="mProjected"
          @drill="onMonthDrill" @topic="onMonthTopic" @insight-action="onConciseAction" @ai-insight="openRangeAi" />

        <PiYear v-else
          :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
          :events="timelineEvents" :live-link="linkCardCount"
          :lc-cards="lcCards" :all-events="timelineEvents"
          :insight="concise.year" :focus-filter="lcFocus"
          @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
          @open-battle="openDayBattle"
          @drill="onYearDrill" @insight-action="onConciseAction"
          @lc-locate="onLcLocate" @lc-archive="onLcArchive" @lc-snooze="onLcSnooze"
          @lc-reactivate="onLcReactivate" @lc-set-days="onLcSetDays"
          @lc-settings="lcSetOpen = true" @ai-insight="openRangeAi" />
    </div>

    <!-- ★W12-B 底栏整条删除：原先这里挂着「只读纪律」免责文字 + 一枚「全部记录」。
     「全部记录」已上提为页头全页唯一入口（PiHero），近期模块里那一枚重复入口一并收掉；
     「只读纪律」那段文字按用户 2026-10-13 拍板不留。 -->

    <!-- ★W13-D5 复盘弹窗退役（2026-10-16 用户拍板）：原挂载的中央大弹层（ReviewPanel）
     「周/月/年复盘」能力已全量常驻页面四段模块（今日三件事 / 本周节律 / 本月沉淀 / 全年足迹），
     目标对账明细由 PiRhythm 战略目标点行（goal-week 抽屉）承接；组件文件保留待复用（同 CatPicker 先例）。 -->

    <PiLifecycleSettingsModal
      :open="lcSetOpen" :default-draft="lcDefaultDraft" :cards="lcCards"
      @close="lcSetOpen = false" @save-default="saveLcDefault"
      @update:default-draft="lcDefaultDraft = $event" @set-days="onLcSetDays" />

    <!-- ===== 全量记录抽屉 ===== -->
    <DashboardLogDrawer :open="logOpen" :events="timelineEvents" :data="gd" :preset="logPreset" @close="logOpen = false" />

    <!-- ===== ★W14-T1 主攻项目详情抽屉（用户拍板 2026-10-16）：点 Hero 主攻胶囊或今日三件事行的
         🚀 主攻标签 → 右侧滑出**那个项目**的详情（沿用方向台/策展台同一枚 ProjectDetailDrawer，
         可编辑项目名·指标·任务，编辑实时写回 store） ===== -->
    <ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId" @close="projDetailOpen = false" />
    <TaskDetailDrawer ref="taskDetailRef" />

    <PiTagDistributionDrawer
      :open="tagInsightOpen" :entropy="heroEntropy"
      :resources="gResLive" :tasks="gTaskLive"
      @close="tagInsightOpen = false" @optimize="runTagOptimizeAi" />

    <AiDrawer v-if="tagAiJob" :job="tagAiJob" :job-key="tagAiJob.key" @close="tagAiJob = null" />
    <AiDrawer v-if="rangeAiJob" :job="rangeAiJob" :job-key="rangeAiJob.key" @close="rangeAiJob = null" />

    <PiMetricDetailDrawer
      :open="!!statDrawer" :title="statDrawerTitle" :rows="statShown"
      :filtered-count="statFiltered.length" :total-count="statList.length"
      :search="statSearch" :page="statPage" :page-count="statPageCount"
      :page-size="STAT_PAGE" :reconcile="statReconcile" :reconcile-note="statReconcileNote"
      @close="statDrawer = ''" @update:search="statSearch = $event"
      @page="statGo" @open-card="openStatCard" />

    <!-- ★W13-D5/F28：「动态条明细抽屉」（dynDrawer）已退役——事件时间窗下钻统一走
     DashboardLogDrawer（month-add → openLog('month-in')；主攻动作 → openLogFocus()）。 -->

    <!-- ===== 今日战报弹窗（DayDetail） ===== -->
    <Teleport to="body">
      <div v-if="dayOpen && dashSelDay" class="pi-day-overlay" @click.self="dayOpen = false">
        <div class="pi-day-modal" role="dialog" aria-modal="true" aria-label="今日战报">
          <DayDetail
            :stats="dashStats" :day="dashSelDay" :events="timelineEvents" :live-link="linkCardCount"
            :kinds="{ ...heroKindCounts, label: '在库' }"
            @close="dayOpen = false" @open-log="onDayOpenLog" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== 页面容器 ===== */
.pi-page { max-width: 1440px; margin: 0 auto; padding: 24px 36px 64px; display: flex; flex-direction: column; gap: 24px; }
/* ===== 今日战报弹窗壳 ===== */
.pi-day-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.pi-day-modal { width: min(720px, 92vw); max-height: 86vh; background: var(--surface); border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,.25); overflow: hidden; display: flex; flex-direction: column; }

</style>
