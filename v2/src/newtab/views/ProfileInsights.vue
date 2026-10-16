<script setup lang="ts">
/**
 * W10（V3.9.0）：画像洞察页 —— 时间轴三段式（今天 / 近期 / 全年）。
 *
 * 本版把 v6 原型布局落为生产：
 *   §0 PiHero 页头（5 KPI chip + 刷新/导出/AI 解读/今日战报）
 *   左 PiRail 导航（IntersectionObserver 高亮） + 右三模块：
 *     ① PiToday  今天 · TODAY（今日六格 + 今日三件事 + 洞察条）
 *     ② PiRhythm 本周 · WEEK（strip + 6 KPI + 节奏柱 + 目标 + 预警 + 操作流，T5 并段；★V3.8.20 固定周窗口）
 *     ③ PiMonth  本月 · MONTH（★V3.8.20 新增轻量月度段：strip + 月柱 + 6 KPI + 环比；目标/预警/操作流不重复）
 *     ④ PiYear   全年 · YEAR（F20 诊断条 + F21 strip4 归位四格 + 年度热力图 + 生命周期，T6 并段，#lc-sec 深链锚保留）
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
import { suggestFocus } from '@/shared/utils/focusSuggest'
import type { TodayRow, FocusRecommend } from '@/newtab/components/profile/PiToday.vue'
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
import PiRail from '@/newtab/components/profile/PiRail.vue'
import PiToday from '@/newtab/components/profile/PiToday.vue'
import PiRhythm from '@/newtab/components/profile/PiRhythm.vue'
import PiMonth, { type MonthTopic } from '@/newtab/components/profile/PiMonth.vue'
import { useCuriosity } from '@/newtab/stores/curiosity'
import PiYear from '@/newtab/components/profile/PiYear.vue'
/* ★W13-D5：ReviewPanel 弹窗挂载退役（2026-10-16）——组件文件保留待复用，宿主零 import。 */
import DashboardLogDrawer, { type LogPreset } from '@/newtab/components/dashboard/DashboardLogDrawer.vue'
import ProjectDetailDrawer from '@/newtab/components/ProjectDetailDrawer.vue'
import { useDashboardStats } from '@/newtab/components/dashboard/useDashboardStats'
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
/** F2 · 主攻胶囊（≤2，进度取 Project.progress 0-100） */
const heroFocusPills = computed(() => {
  const out: { id: string; name: string; progress: number }[] = []
  for (const d of gd.value.compass?.directions || []) {
    for (const p of d.projects || []) {
      if (p.isFocused && p.status !== 'archived') out.push({ id: p.id, name: p.name, progress: Math.round(p.progress || 0) })
    }
  }
  return out.slice(0, 2)
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
/** F8 已备弹药：三件事所关联任务的 SupportLink 去重资源卡总数 */
const todayAmmo = computed(() => {
  const ids = new Set<string>()
  for (const r of todayRows.value) {
    if (!r) continue
    for (const l of gd.value.supportLinks || []) if (l.taskId === r.slot.sourceId) ids.add(l.resourceId)
  }
  return ids.size
})
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
/** F11 空槽推荐：suggestFocus 排除已排任务取 top1（主攻/顺延/到期加权同源打分） */
const todayRecommend = computed<FocusRecommend | null>(() => {
  const idx = todayRows.value.findIndex(r => !r)
  if (idx < 0) return null
  const c = suggestFocus(gd.value, {
    anchorKey: todayKey(),
    excludeTaskIds: todayFocus.value.map(s => s.sourceId || ''),
    limit: 8
  })[0]
  return c ? { idx, title: c.title, why: c.why } : null
})
function onTodayToggle(i: number) {
  const s = gd.value.dailyFocus?.[todayKey()]?.[i]
  if (!s) return
  s.done = !s.done
  s.doneAt = s.done ? Date.now() : undefined
  if (s.sourceType === 'task' && s.sourceId) {
    const t = gd.value.tasks.find(x => x.id === s.sourceId)
    if (t) { t.status = s.done ? 'done' : 'todo'; t.completedAt = s.doneAt; t.updatedAt = Date.now() }
  }
  store.persist()
}
function onTodayBind(i: number) {
  const r = todayRows.value[i]
  if (!r || r.slot.sourceType !== 'task' || !r.slot.sourceId) return
  const t = gd.value.tasks.find(x => x.id === r.slot.sourceId)
  if (!t) return
  const targetId = [...focusProjectIds.value][0]
  if (!t.projectId && targetId) { t.projectId = targetId; t.updatedAt = Date.now() }
  const matches = matchResourcesOf(t)
  let added = 0
  if (!gd.value.supportLinks) gd.value.supportLinks = []
  for (const res of matches) {
    if (gd.value.supportLinks.some(l => l.taskId === t.id && l.resourceId === res.id)) continue
    gd.value.supportLinks.push({
      id: uid('sl'), taskId: t.id, resourceId: res.id,
      from: 'manual', why: '画像洞察 · 一键归位（W13-F10）', createdAt: Date.now()
    })
    added++
  }
  store.persist()
  showToast(`✓ 已归入「${projNameById.value.get(targetId || '') || '主攻项目'}」，新增绑定 ${added} 张支撑卡`)
}
function onTodayFill(i: number) {
  const key = todayKey()
  const c = suggestFocus(gd.value, {
    anchorKey: key, excludeTaskIds: todayFocus.value.map(s => s.sourceId || ''), limit: 8
  })[0]
  if (!c) { showToast('没有可推荐的待办任务'); return }
  if (!gd.value.dailyFocus) gd.value.dailyFocus = {}
  const list = gd.value.dailyFocus[key] || (gd.value.dailyFocus[key] = [])
  list[i] = { id: uid('focus'), sourceType: 'task', sourceId: c.taskId, text: c.title, done: false, auto: true }
  store.persist()
  showToast(`✓ 已填入「${c.title}」`)
}
/** ★W13-T7 · 四条诊断 CTA 的统一动作分发（buildConciseInsights 出 8 个 ctaAction 键，
    四组件条带全部走这一个出口——原先四段各写各的 onXxxInsightAction，现按键分派）。
    键 → 动作：openFocusBoard 去排三件事 / bindFocus 归位首件游离 / callSupport 调出支撑卡 /
    openBattle 今日战报 / openObjectives 头号战略目标产出明细 / openLog 全量记录 /
    convertCurio 批量转化成熟好奇卡 / wakeCooling · openLifecycle 冷却区唤醒复温。 */
function onConciseAction(action: string) {
  if (action === 'openFocusBoard') { void router.push('/'); showToast('已跳调度台 · 排一排今日三件事'); return }
  if (action === 'bindFocus') {
    const idx = todayRows.value.findIndex(r => r && r.canBind)
    if (idx >= 0) onTodayBind(idx)
    else showToast('没有待归位的焦点任务')
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
    showToast(`✓ 已将 ${list.length} 张成熟好奇卡转化为任务`)
    return
  }
  if (action === 'wakeCooling' || action === 'openLifecycle') wakeCooling()
}

/** ★W14-T1 · 主攻项目详情抽屉（用户拍板 2026-10-16）：Hero 主攻胶囊与今日三件事行的 🚀 主攻标签
    共用这一个出口，抽屉本体沿用方向台/策展台同一枚 ProjectDetailDrawer（零新建组件、可编辑）。 */
const projDetailOpen = ref(false)
const projDetailId = ref<string | null>(null)
function openProjectDetail(projectId: string) {
  if (!projectId) { showToast('⚠ 未找到该项目'); return }
  projDetailId.value = projectId
  projDetailOpen.value = true
}

/* ===== PiRail 导航（★V3.8.20：三节点 → 四节点，本月段新增落点） ===== */
type RailK = 'now' | 'week' | 'month' | 'year'
const railActive = ref<RailK>('now')
let railObs: IntersectionObserver | null = null
function onRailJump(k: RailK) {
  const id = k === 'now' ? 'mod-now' : k === 'week' ? 'mod-recent' : k === 'month' ? 'mod-month' : 'mod-year'
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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
interface StatRow { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; ts: number; owner?: string }
const statDrawer = ref<StatDrawerType>('')
/* F15：战略目标点行 → 该方向本周「新建 ∪ 完成」任务明细（PiRhythm goal-drill 落点） */
const goalDirId = ref('')
/* F18：Top 主题行下钻 → 该标签本月新增卡片清单 */
const topicTag = ref('')
const totalCards = computed(() => gResLive.value.length + gTaskLive.value.length + gCurioLive.value.length)
const statList = computed<StatRow[]>(() => {
  switch (statDrawer.value) {
    case 'support': return gTaskLive.value.map(t => ({
      kind: 'task' as const, id: t.id, title: t.title, ts: t.createdAt,
      owner: supportedTaskIds.value.has(t.id) ? '✓ 已支撑' : '⚠ 未支撑'
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
          owner: t.completedAt ? '✓ 本周完成' : '＋ 本周新建'
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
        kind: 'resource' as const, id: a.id, title: a.title || a.content?.slice(0, 30) || '（论点卡）', ts: a.createdAt || 0, owner: '✎ 论点'
      }))
    ]
    /* F19②：本月新支撑链接 + 本月完成任务 */
    case 'mo-support': return [
      ...(gd.value.supportLinks || []).filter(l => (l.createdAt || 0) >= gStartOfMonth).map(l => {
        const card = gFlat.value.find(x => x.id === l.resourceId)
        return { kind: (card?.kind || 'resource') as StatRow['kind'], id: l.resourceId, title: card?.title || '（源卡已删除）', ts: l.createdAt || 0, owner: '🔗 新支撑' }
      }),
      ...gTaskLive.value.filter(t => (t.completedAt || 0) >= gStartOfMonth).map(t => ({
        kind: 'task' as const, id: t.id, title: t.title, ts: t.completedAt || 0, owner: '✓ 已完成'
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
/* ===== ★W15-T1 · 四类卡片清单型分支（用户拍板 2026-10-16）=====
   原先这些入口给的是**事件流水**（DashboardLogDrawer），但按钮承诺的是"哪几张卡" —— 两型混淆，
   最典型的是「调出 N 张支撑卡」而"今日调出"恰为 0，点开就是空的。现全部改为卡片清单（statDrawer）。 */
const todayCardIds = computed(() => {
  const since = gStartOfToday
  const ids = new Set<string>()
  for (const e of timelineEvents.value) {
    if (e.kind === 'system' || e.ts < since) continue
    if (e.action === 'create' || e.action === 'call') ids.add(e.cardId)
  }
  return ids
})
/** 今日入台的卡（action=create 的当日事件回查，含导入卡） */
const todayInCards = computed<StatRow[]>(() => gFlat.value
  .filter(x => !x.deletedAt && todayCardIds.value.has(x.id) && x.createdAt >= gStartOfToday)
  .sort((a, b) => b.createdAt - a.createdAt)
  .map(x => ({ kind: x.kind, id: x.id, title: x.title, ts: x.createdAt })))
/** 今日被调出的卡（action=call 的当日事件回查） */
const todayCalledCards = computed<StatRow[]>(() => gFlat.value
  .filter(x => !x.deletedAt && todayCardIds.value.has(x.id))
  .map(x => ({ kind: x.kind, id: x.id, title: x.title, ts: x.createdAt, owner: '↗ 今日已调出' })))
/** 已备弹药 = 今日三件事所关联任务的 SupportLink 去重资源卡（与 todayAmmo 同一口径，去重后逐张成行） */
const ammoCards = computed<StatRow[]>(() => {
  const taskIds = new Set<string>()
  for (const r of todayRows.value) { if (r && r.slot.sourceId) taskIds.add(r.slot.sourceId) }
  const seen = new Set<string>()
  const out: StatRow[] = []
  for (const l of gd.value.supportLinks || []) {
    if (!l.resourceId || !taskIds.has(l.taskId) || seen.has(l.resourceId)) continue
    seen.add(l.resourceId)
    const card = gResLive.value.find(r => r.id === l.resourceId)
    if (!card) continue
    out.push({ kind: 'resource', id: card.id, title: card.title, ts: card.createdAt || 0, owner: '🛡 已备弹药' })
  }
  return out
})
/** 可调出的旧卡 = 冷却期卡（逐卡 lifecycleState 判定，与 LifecyclePanel 的 Tab 同一真源，非另造口径） */
const coolingCards = computed<StatRow[]>(() => {
  const titleOfLc = (c: LifecycleCard): string => (c.kind === 'curiosity' ? c.question : c.title) || '（无标题）'
  return lcCards.value
    .filter(c => lifecycleState(c) === 'cooling')
    .map(c => ({
      kind: c.kind as StatRow['kind'], id: c.id, title: titleOfLc(c), ts: c.updatedAt || 0,
      owner: `💤 冷却中 · 阈值 ${Math.round(coolingMsOf(c) / 86400000)} 天`
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
  support: `🛡 任务证据支撑明细（${statList.value.length}）`,
  /* ★W15-T1：四类新分支标题自带口径说明（用户不必猜抽屉里是"卡"还是"事件流水"） */
  ammo: `🛡 已备弹药 · 三件事的支撑卡清单（${statList.value.length} 张 · 本页是卡片维度，事件流水见页头「全部记录」）`,
  cooling: `💤 可调出的旧卡 · 冷却期清单（${statList.value.length} 张 · 双击或点行定位）`,
  'today-in': `📥 今日入台的卡（${statList.value.length} 张 · 含导入）`,
  'today-call': `↗ 今日调出的卡（${statList.value.length} 张 · 今日被打开过）`,
  'goal-week': `🎯 ${dashDirections.value.find(d => d.id === goalDirId.value)?.name || '方向'} · 本周产出任务（${statList.value.length}）`,
  'curio-conv': `🔁 本月转化的好奇卡（${statList.value.length}）`,
  'curated': `🏛 入策展金字塔明细（${statList.value.length} · 投射 + 论点）`,
  'mo-support': `🔗 本月支撑任务明细（${statList.value.length}）`,
  topic: `🏷 #${topicTag.value} 本月新增卡片（${statList.value.length}）`,
  '': ''
}[statDrawer.value]))

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

/* ===== PiYear 年度诊断条（W13-T6/F20~F23：方向归属占比 × 高价值冷却卡） ===== */
const lcFocus = ref<'active' | 'cooling' | 'archived' | undefined>(undefined)
const yCoolHigh = computed(() => lcCards.value.filter(c => lifecycleState(c) === 'cooling' && (c.callCount || 0) >= 3).length)
const yDirFit = computed(() => {
  /* 方向归属 = 存活任务经 projectId → 方向项目归位后的头号占比；无归属任务返回空串（诚实兜底文案） */
  const owner = new Map<string, string>()
  for (const d of dashDirections.value) for (const p of d.projects || []) if (!owner.has(p.id)) owner.set(p.id, d.id)
  const cnt = new Map<string, number>()
  let total = 0
  for (const t of dashTasks.value) {
    if (t.deletedAt) continue
    const did = t.projectId ? owner.get(t.projectId) : undefined
    if (!did) continue
    cnt.set(did, (cnt.get(did) || 0) + 1)
    total++
  }
  if (!total) return ''
  let top = '', n = 0
  for (const [id, v] of cnt) if (v > n) { n = v; top = id }
  const name = dashDirections.value.find(d => d.id === top)?.name || ''
  return name ? `主方向「${name}」承接 ${Math.round((n / total) * 100)}% 的已归属任务` : ''
})
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
  if (k === 'entropy') {
    const t = topTags.value
    showToast(t.length ? `知识熵 ${heroEntropy.value} bit · 高频标签：${t.map(([n, c]) => `${n}(${c})`).join('、')}` : '知识熵 0 bit · 库里还没有带标签的卡片')
    return
  }
}
function onHeroRefresh() {
  void refreshEventLog()
  void refreshErrorCount()
  showToast('⟳ 已重读事件日志与错误日志')
}
/** F2 轻引导：使命为空时一键去方向台设定 */
function gotoCompass() { void router.push('/compass'); showToast('🧭 已跳转方向台 · 在骨架条第 1 层设定使命愿景') }
function onHeroExport(fmt: string) {
  /* F5：导出 = 使命主线 + 4 项全库底盘指标 + 四尺度一句话诊断（与界面四条同源：strip-html 后落盘） */
  const insightLines = (['today', 'week', 'month', 'year'] as const).map(k => {
    const label = { today: '今天', week: '本周', month: '本月', year: '本年' }[k]
    return `${label}·诊断：${concise.value[k].html.replace(/<[^>]+>/g, '')}`
  })
  const lines = [
    `画像洞察导出 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    `使命主线：${heroMission.value || '（尚未设定）'}`,
    `全库净资产：${heroTotal.value} 张（资源 ${heroKindCounts.value.res} · 任务 ${heroKindCounts.value.task} · 好奇 ${heroKindCounts.value.curio}）`,
    `知识熵 (聚焦度)：${heroEntropy.value} bit`,
    `任务有证据支撑：${heroSupportRate.value}%`,
    `近30天精力落主攻：${heroFocusShare.value}%`,
    '',
    ...insightLines
  ]
  if (fmt === 'csv') {
    const csv = '指标,数值\n' + lines.slice(2).map(l => l.replace('：', ',')).join('\n')
    downloadText(`画像洞察摘要_${stampDay()}.csv`, csv, 'csv')
  } else {
    downloadText(`画像洞察摘要_${stampDay()}.md`, lines.join('\n'), 'md')
  }
  showToast('✓ 已导出画像摘要')
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
  showToast(`✓ 已导出 ${logs.length} 条运行错误（含完整堆栈）`)
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
  // PiRail IntersectionObserver（★V3.8.20：mod-month 第四锚点）
  railObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        const id = en.target.id
        railActive.value = id === 'mod-now' ? 'now' : id === 'mod-recent' ? 'week' : id === 'mod-month' ? 'month' : 'year'
      }
    }
  }, { rootMargin: '-25% 0px -55% 0px' })
  for (const id of ['mod-now', 'mod-recent', 'mod-month', 'mod-year']) {
    const el = document.getElementById(id)
    if (el) railObs.observe(el)
  }
  // 支持 #lifecycle / #lc-sec 深链（归档提示条 → PiYear 生命周期段）
  if (location.hash === '#lifecycle' || location.hash === '#lc-sec') {
    setTimeout(() => document.getElementById('lc-sec')?.scrollIntoView({ behavior: 'smooth' }), 160)
  }
})
onUnmounted(() => { railObs?.disconnect(); offErrLog() })
// 战报打开前重读事件日志（keep-alive 场景数据不冻结；复盘弹窗 watch 随 D5 退役）
watch(dayOpen, async (v) => { if (v) await refreshEventLog() })
</script>
<template>
  <div class="pi-page">
    <!-- ===== §0 Hero 页头 ===== -->
    <PiHero
      :total="heroTotal" :kind-counts="heroKindCounts" :entropy="heroEntropy"
      :top-tags="heroTopTags" :support-rate="heroSupportRate" :focus-share="heroFocusShare"
      :mission-text="heroMission" :focus-pills="heroFocusPills" :error-count="errorLogCount"
@drill="onHeroDrill" @refresh="onHeroRefresh" @export="onHeroExport"
          @export-error="exportErrorLog" @open-log="openLog('log')" @goto-compass="gotoCompass"
          @open-project="openProjectDetail" />

    <!-- ===== 时间轴：左 rail + 右四模块（★V3.8.20：本月段新增，3 段 → 4 段） ===== -->
    <div class="pi-tl">
      <PiRail :active="railActive" @jump="onRailJump" />
      <div class="pi-rmods">
        <PiToday
          :today-add="todayAdd" :today-called="todayCalled"
          :focus-filled="todayFilled" :ammo="todayAmmo"
          :insight="concise.today" :rows="todayRows" :recommend="todayRecommend"
          @drill="onTodayDrill" @open-battle="openTodayBattle" @open-focus="() => router.push('/')"
          @insight-action="onConciseAction" @toggle="onTodayToggle"
          @open-project="openProjectDetail"
          @bind="onTodayBind" @fill="onTodayFill" />

        <!-- ★V3.8.20 @open-review / ★W13-D5 目标对账按钮：复盘入口随 ReviewPanel 全量退役，Hero 不再有 review 出口 -->
        <PiRhythm
          :stats="dashStats" :directions="dashDirections"
          :tasks="dashTasks" :error-count="errorLogCount"
          :insight="concise.week"
          @open-err="exportErrorLog"
          @open-battle="openDayBattle" @drill="onRhythmDrill" @goal-drill="onGoalDrill"
          @insight-action="onConciseAction" />

        <PiMonth
          :stats="dashStats" :insight="concise.month" :ent="mEntTrend"
          :topics="mTopics" :untagged="mUntagged" :funnel="mFunnel"
          :curio-conv="mCurioConv" :projected="mProjected"
          @drill="onMonthDrill" @topic="onMonthTopic" @insight-action="onConciseAction" />

        <PiYear
          :stats="dashStats" :year="dashYear" :sel-day="dashSelDay"
          :events="timelineEvents" :live-link="linkCardCount"
          :lc-cards="lcCards" :all-events="timelineEvents"
          :insight="concise.year" :focus-filter="lcFocus"
          @update:year="dashYear = $event" @update:sel-day="dashSelDay = $event"
          @open-battle="openDayBattle"
          @drill="onYearDrill" @insight-action="onConciseAction"
          @lc-locate="onLcLocate" @lc-archive="onLcArchive" @lc-snooze="onLcSnooze"
          @lc-reactivate="onLcReactivate" @lc-set-days="onLcSetDays"
          @lc-settings="lcSetOpen = true" />
      </div>
    </div>

    <!-- ★W12-B 底栏整条删除：原先这里挂着「只读纪律」免责文字 + 一枚「全部记录」。
     「全部记录」已上提为页头全页唯一入口（PiHero），近期模块里那一枚重复入口一并收掉；
     「只读纪律」那段文字按用户 2026-10-13 拍板不留。 -->

    <!-- ★W13-D5 复盘弹窗退役（2026-10-16 用户拍板）：原挂载的中央大弹层（ReviewPanel）
     「周/月/年复盘」能力已全量常驻页面四段模块（今日三件事 / 本周节律 / 本月沉淀 / 全年足迹），
     目标对账明细由 PiRhythm 战略目标点行（goal-week 抽屉）承接；组件文件保留待复用（同 CatPicker 先例）。 -->

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

    <!-- ===== ★W14-T1 主攻项目详情抽屉（用户拍板 2026-10-16）：点 Hero 主攻胶囊或今日三件事行的
         🚀 主攻标签 → 右侧滑出**那个项目**的详情（沿用方向台/策展台同一枚 ProjectDetailDrawer，
         可编辑项目名·指标·任务，编辑实时写回 store） ===== -->
    <ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId" @close="projDetailOpen = false" />

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

    <!-- ★W13-D5/F28：「动态条明细抽屉」（dynDrawer）已退役——事件时间窗下钻统一走
     DashboardLogDrawer（month-add → openLog('month-in')；主攻动作 → openLogFocus()）。 -->

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