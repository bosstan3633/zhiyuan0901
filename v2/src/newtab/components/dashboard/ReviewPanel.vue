<script setup lang="ts">
/**
 * R172-T7（04-66 §5.3 / 04-67 F21~F26）：复盘段 —— **紧凑两栏**（左＝我的量 ①②｜右＝我的方向 ③④）。
 *
 * 为什么要「两栏」而不是 R2 的五段纵向：五段纵向下，用户读完"这期做了多少"已经滚了两屏，
 * 而"这些动作指向哪个方向"才是复盘要回答的问题 —— 量与方向并排，因果一眼可对。
 *
 * 四个范围（F21）：周 / 月 / 自定义 / 项目。粒度自适应（F26）：`week→day`、`month→week`、`>120 天→month`。
 * 三类可下钻（F23/F24/F25）：
 *   · 6 个 KPI 瓦片   → 该指标的内容卡片列表（复用 `DrillCardList`，与日详情同一实现）
 *   · 目标对账三条    → 该方向本期的产出任务（`tasksOfDirection` 真实多跳接线）
 *   · 偏离预警每条    → **阈值 + 实际值**（由 `runRules` 同处产出，杜绝两处漂移）
 *
 * 只读纪律：本组件只读 props（含宿主传入的 `data` 快照），**不碰 store、不写任何存储**；
 * 所有数字都能在 `aggregateRange` / `runRules` / `objectivesOf` 的输出里找到同值（§8.1 AI 数值可回溯）。
 */
import Icon from '@/shared/components/Icon.vue'
import './dashboard.css'
import { computed, defineAsyncComponent, ref, shallowRef } from 'vue'
import type { AppData } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { LV_NAME, levelOf, type DailyStats } from '@/shared/utils/dailyStats'
import {
  buildReview, objectivesOf, tasksOfDirection, inWindow, todayKey, weekNo, type DirLike, type RangeType, type TaskLike
} from '@/shared/utils/reviewReport'
import { groupEventRows, hm, dayOfTs, type DrillRow } from '@/shared/utils/drillRows'
import type { ReviewReport, ReviewSug } from '@/shared/ai/review'
// R155 口径：AI 入口徽标必须是单色线性 SVG（`AiEntryButton`），不许用 emoji —— 全站统一
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import DrillCardList from './DrillCardList.vue'
import ExportMenu, { type ExportFmt } from './ExportMenu.vue'
import { tablesToCsv, sectionsToMd, pngBlobFromSpec, exportName } from '@/shared/utils/exportView'
import { downloadText, downloadBlob } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'

/**
 * R172-T11：报告弹框**必须异步** —— `ReviewReportModal` 里 dynamic import 了 `shared/ai/review`，
 * 静态挂进来会把 AI 代码拽进设置页 chunk。`v-if` + 异步组件 ⇒ 不开就既不下载也不实例化。
 */
const ReviewReportModal = defineAsyncComponent(() => import('./ReviewReportModal.vue'))

const props = defineProps<{
  stats: DailyStats
  events: CardEvent[]
  /** 卡片快照（仅用于「推进」维度下钻与项目关联反查；不写） */
  data: AppData
  directions: DirLike[]
  tasks: TaskLike[]
}>()
const emit = defineEmits<{
  (e: 'save-report', rep: ReviewReport): void
  (e: 'report-task', s: ReviewSug): void
  (e: 'report-goto', s: ReviewSug): void
  (e: 'report-export', rep: ReviewReport): void
}>()

/* ---------- 范围与窗口 ---------- */
const rt = ref<RangeType>('week')
const off = ref(0)
const pad2 = (n: number): string => String(n).padStart(2, '0')
function addDays(s: string, n: number): string {
  const d = new Date(s.replace(/-/g, '/'))
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const customFrom = ref(addDays(todayKey(), -29))
const customTo = ref(todayKey())

/** 项目复盘下拉：方向树里的全部项目（含所属方向名，便于"这个项目挂在哪"一眼看清） */
const projectOpts = computed(() => {
  const out: { id: string; name: string; dirId: string; dirName: string }[] = []
  for (const d of props.directions) for (const p of d.projects || []) out.push({ id: p.id, name: p.name || p.id, dirId: d.id, dirName: d.name })
  return out
})
const projId = ref('')
const activeProj = computed(() => projectOpts.value.find(p => p.id === projId.value) || projectOpts.value[0] || null)

/** 项目复盘的窗口 = 该项目全周期（首个任务落库 ~ 今天）；无任务则回落到今年元旦 */
const projWindow = computed<{ from: string; to: string }>(() => {
  const pid = activeProj.value?.id
  const to = todayKey()
  if (!pid) return { from: `${to.slice(0, 4)}-01-01`, to }
  let min = ''
  for (const t of props.tasks) {
    if (t.projectId !== pid || t.deletedAt) continue
    const k = t.createdAt ? dayOfTs(t.createdAt) : ''
    if (k && (!min || k < min)) min = k
  }
  return { from: min || `${to.slice(0, 4)}-01-01`, to }
})

const revOpts = computed(() => ({
  off: off.value,
  customFrom: rt.value === 'project' ? projWindow.value.from : customFrom.value,
  customTo: rt.value === 'project' ? projWindow.value.to : customTo.value
}))
const rev = computed(() => buildReview(props.stats, rt.value, revOpts.value))
const win = computed(() => rev.value.win)
const agg = computed(() => rev.value.agg)
const rules = computed(() => rev.value.rules)

/** 环比（等长窗口）：近 N 天 vs 前 N 天 —— 不许"部分月 vs 整月" */
const delta = computed(() => rev.value.delta)
const fmtPct = (p: number | null): string => (p === null ? '—' : `${p >= 0 ? '+' : ''}${p}%`)

/* ---------- ③ 目标对账（真实多跳：任务 → projectId → direction） ---------- */
const obj = computed(() => objectivesOf(props.directions, props.tasks, win.value))
const maxShare = computed(() => obj.value.rows.reduce((m, r) => Math.max(m, r.share), 0))
const cover = computed(() => obj.value.rows.filter(r => r.v > 0).length)

/* ---------- 下钻（F23/F24/F25）：单一折叠实现 groupEventRows ---------- */
type DrillKey = '' | 'days' | 'acts' | 'create' | 'call' | 'status' | 'conv' | `dir:${string}` | `rule:${string}`
const drill = ref<DrillKey>('')
const click = (k: DrillKey): void => { drill.value = drill.value === k ? '' : k }

const winEvents = computed<CardEvent[]>(() => props.events.filter(e => inWindow(e.ts, win.value)))
/** ★ 只在展开时才算：推进维度要扫卡字段（focus / supportLinks / 子任务），不该在每次渲染都跑 */
const deliverRows = computed<DrillRow[]>(() => {
  if (drill.value !== 'conv') return []
  const out: DrillRow[] = []
  const d = props.data
  for (const slots of Object.values(d.dailyFocus || {})) {
    for (const s of slots || []) {
      if (s && s.done && s.doneAt && inWindow(s.doneAt, win.value))
        out.push({ kind: 'task', id: s.sourceId || s.id, title: s.text, icon: '', tag: '三件事完成', n: 1, time: hm(s.doneAt) })
    }
  }
  const resTitle = new Map((d.resources || []).map(r => [r.id, r.title]))
  const taskTitle = new Map((d.tasks || []).map(t => [t.id, t.title]))
  for (const l of d.supportLinks || []) {
    if (l && l.createdAt && inWindow(l.createdAt, win.value))
      out.push({ kind: 'task', id: l.taskId, title: `${taskTitle.get(l.taskId) || '任务'} ← ${resTitle.get(l.resourceId) || '资源'}`, icon: '', tag: '任务↔资源关联', n: 1, time: hm(l.createdAt) })
  }
  for (const t of d.tasks || []) {
    for (const s of t.subtasks || []) {
      if (s && s.done && s.doneAt && inWindow(s.doneAt, win.value))
        out.push({ kind: 'task', id: t.id, title: `${t.title} · ${s.title}`, icon: '', tag: '子任务完成', n: 1, time: hm(s.doneAt) })
    }
  }
  return out.sort((a, b) => (b.time || '').localeCompare(a.time || ''))
})

/** KPI 瓦片 → 下钻行（原型口径：days/acts 落到「采集记录」这一可核对凭据上） */
const KPI_SRC: Record<string, 'create' | 'call' | 'status' | 'conv'> = {
  days: 'create', acts: 'create', create: 'create', call: 'call', status: 'status', conv: 'conv'
}
const KPI_LABEL: Record<string, string> = {
  days: '活跃日 · 当日采集记录', acts: '有效动作 · 采集记录', create: '采集记录',
  call: '调出记录', status: '状态变更记录', conv: '转化记录（推进）'
}
const kpiRows = computed<{ key: string; label: string; rows: DrillRow[]; total: number } | null>(() => {
  const k = drill.value
  if (!k || k.startsWith('dir:') || k.startsWith('rule:')) return null
  const src = KPI_SRC[k]
  if (!src) return null
  if (src === 'conv') return { key: k, label: KPI_LABEL[k], rows: deliverRows.value, total: agg.value.sub + agg.value.focus + agg.value.link }
  const rows = groupEventRows(winEvents.value.filter(e => e.action === src),
    src === 'status' ? (e => (e.to ? `→ ${e.to}` : '状态变更')) : (() => (src === 'call' ? '调出' : '采集')))
  return { key: k, label: KPI_LABEL[k], rows, total: src === 'call' ? agg.value.u : agg.value.c.res + agg.value.c.curio + agg.value.c.task }
})

const dirRows = computed<{ id: string; name: string; rows: DrillRow[] } | null>(() => {
  const k = drill.value
  if (!k.startsWith('dir:')) return null
  const id = k.slice(4)
  const d = props.directions.find(x => x.id === id)
  const rows: DrillRow[] = tasksOfDirection(props.tasks, props.directions, id, win.value).map(t => ({
    kind: 'task', id: t.id, title: t.title || '（无标题）', icon: '',
    tag: t.completedAt && inWindow(t.completedAt, win.value) ? '本期完成' : '本期新建', n: 1
  }))
  return { id, name: d?.name || id, rows }
})

const ruleHit = computed(() => (drill.value.startsWith('rule:') ? rules.value.find(r => r.id === drill.value.slice(5)) || null : null))

/* ---------- ② 节奏曲线（粒度自适应 F26） ---------- */
const trendMode = computed<'day' | 'week' | 'month'>(() =>
  rt.value === 'week' ? 'day' : rt.value === 'month' ? 'week' : (win.value.days > 120 ? 'month' : 'week'))
const TREND_LABEL = { day: '按日', week: '按周', month: '按月' } as const
const trendPts = computed<[string, number][]>(() => {
  const w = win.value, mode = trendMode.value
  if (mode === 'day') {
    const out: [string, number][] = []
    for (let d = w.s; d <= w.e; d = addDays(d, 1)) out.push([d.slice(5), props.stats.days[d]?.w || 0])
    return out
  }
  const m = new Map<string, number>()
  for (const k of Object.keys(props.stats.days).sort()) {
    if (k < w.s || k > w.e) continue
    const key = mode === 'week' ? `W${pad2(weekNo(new Date(k.replace(/-/g, '/'))))}` : k.slice(0, 7)
    m.set(key, (m.get(key) || 0) + props.stats.days[k].w)
  }
  return [...m.entries()].map(([k, v]) => [mode === 'week' ? k : k.slice(5) + '月', Math.round(v * 10) / 10])
})
const bars = computed(() => {
  const pts = trendPts.value
  if (!pts.length) return []
  const max = Math.max(1, ...pts.map(p => p[1]))
  return pts.map(p => ({ label: p[0], w: p[1], h: Math.max(3, Math.round((p[1] / max) * 56)), lv: Math.max(1, levelOf(p[1])) }))
})

/* ---------- 控制条 ---------- */
function prevPeriod(): void { if (off.value > 0) off.value-- }
function nextPeriod(): void { if (off.value < 60) off.value++ }
function pickRange(k: RangeType): void { rt.value = k; off.value = 0; drill.value = '' }
const trendCap = computed(() => (agg.value.peak ? `峰值 ${agg.value.peak[0]} · ${agg.value.peak[1]} 分（${LV_NAME[levelOf(agg.value.peak[1])]}）` : '本期无动作'))

/* ---------- 项目对账块（F21 项目复盘） ---------- */
const projBlock = computed(() => {
  if (rt.value !== 'project' || !activeProj.value) return null
  const pid = activeProj.value.id
  let done = 0, doing = 0, total = 0
  for (const t of props.tasks) {
    if (t.projectId !== pid || t.deletedAt) continue
    total++
    if (t.completedAt && inWindow(t.completedAt, win.value)) done++
    else if (t.status === 'doing') doing++
  }
  const taskIds = new Set(props.tasks.filter(t => t.projectId === pid).map(t => t.id))
  const links = (props.data.supportLinks || []).filter(l => l && inWindow(l.createdAt, win.value) && taskIds.has(l.taskId)).length
  return { name: activeProj.value.name, dirName: activeProj.value.dirName, done, doing, total, links, net: agg.value.add - agg.value.del }
})

/* ---------- R172-T11：AI 复盘文本报告（点击时才把 AI 侧代码拉进来 ⇒ 启动零 AI） ---------- */
const repOpen = ref(false)
const rep = shallowRef<ReviewReport | null>(null)
const repBusy = ref(false)
async function openReport(): Promise<void> {
  if (repBusy.value) return
  repBusy.value = true
  try {
    const { buildReviewReport } = await import('@/shared/ai/review')
    rep.value = buildReviewReport({
      stats: props.stats, directions: props.directions, tasks: props.tasks,
      rt: rt.value, opts: revOpts.value
    })
    repOpen.value = true
  } finally { repBusy.value = false }
}

/* ---------- R172-T12（F39）：导出三件套——导的就是这一段屏幕上算出来的东西 ---------- */
const expKpis = computed(() => rev.value.kpis)
const expRules = computed(() => rules.value.length
  ? rules.value.map(r => [r.id, r.name, r.text, r.thr, r.act])
  : [['—', '本期未命中偏离规则', '8 条规则全部未触发', '—', '—']])
const expObj = computed(() => obj.value.rows.map(o => [o.name, o.focused ? '主攻' : '', o.v, Math.round(o.share * 100) + '%']))

function exportCsv(): void {
  const csv = tablesToCsv([
    { header: ['指标', '值', '单位', '备注'], rows: expKpis.value.map(k => [k.label, k.v, k.unit, k.note]) },
    { header: ['范围', '本期', '上期（等长）', '环比'], rows: [['有效动作', agg.value.acts, rev.value.prevAgg.acts, fmtPct(delta.value.acts)], ['加权分', agg.value.W, rev.value.prevAgg.W, fmtPct(delta.value.W)]] },
    { header: ['战略目标', '标记', '本期产出', '占比'], rows: expObj.value },
    { header: ['规则', '名称', '事实', '阈值', '实际值'], rows: expRules.value },
    { header: [TREND_LABEL[trendMode.value], '加权分'], rows: trendPts.value.map(p => [p[0], p[1]]) }
  ])
  downloadText(exportName('复盘', 'csv', win.value.label), csv, 'csv')
  showToast(`已导出复盘 CSV（${expKpis.value.length} 项 KPI · ${expObj.value.length} 个方向 · ${expRules.value.length} 条规则）`)
}
function exportMd(): void {
  const md = sectionsToMd(`复盘 · ${win.value.label}`, `${rev.value.win.s} → ${rev.value.win.e}（${win.value.days} 天）· 环比 有效动作 ${fmtPct(delta.value.acts)} / 加权 ${fmtPct(delta.value.W)}`, [
    { h: '画像摘要', lines: expKpis.value.map(k => `- **${k.label}** ${k.v}${k.unit} — ${k.note}`) },
    { h: '目标对账', lines: [...expObj.value.map(o => `- ${o[0]}${o[1] === '主攻' ? '（主攻）' : ''}：${o[2]} 项 · ${o[3]}`), `- 本期产出合计 ${obj.value.total} 项 · 覆盖度 ${cover.value}/${obj.value.rows.length} · 未挂项目 ${obj.value.unassigned} 项`] },
    { h: '偏离预警', lines: expRules.value.map(r => `- ${r[0]} ${r[1]}：${r[2]}（阈值 ${r[3]}，实际 ${r[4]}）`) },
    { h: `节奏（${TREND_LABEL[trendMode.value]}）`, lines: trendPts.value.map(p => `- ${p[0]}：${p[1]} 分`) }
  ])
  downloadText(exportName('复盘', 'md', win.value.label), md, 'md')
  showToast('已导出复盘 Markdown')
}
async function exportPng(): Promise<void> {
  const blob = await pngBlobFromSpec({
    title: `复盘 · ${win.value.label}`,
    sub: `${win.value.s} → ${win.value.e}（${win.value.days} 天）· 环比 有效动作 ${fmtPct(delta.value.acts)} · 加权 ${fmtPct(delta.value.W)} · ${trendCap.value}`,
    kpis: expKpis.value.map(k => ({ label: k.label, value: `${k.v}${k.unit}`, note: k.note })),
    grid: null,
    footer: `知源调度台 · 偏离规则命中 ${rules.value.length}/8 · 数据只在本机`
  })
  downloadBlob(exportName('复盘', 'png', win.value.label), blob)
  showToast('已导出复盘 PNG（当前主题配色）')
}
function onExport(fmt: ExportFmt): void {
  if (fmt === 'csv') exportCsv()
  else if (fmt === 'md') exportMd()
  else void exportPng()
}
</script>

<template>
  <section class="dz-sec">
    <div class="dz-sec-h">
      <span class="dz-n">2</span><span class="dz-t">复盘</span><span class="dz-en">REVIEW</span>
      <span class="dz-sp"></span>
      <span class="dz-badge">{{ win.label }} · {{ win.days }} 天</span>
      <ExportMenu @pick="onExport" />
      <button class="dz-btn pri" title="按金字塔原理组织本期内容的文本报告" :disabled="repBusy" @click="openReport"><AiEntryButton variant="inline" label="AI 复盘" /></button>
    </div>

    <div class="dz-sec-b">
      <!-- 四范围切换（F21） -->
      <div class="dz-tabs">
        <button :class="{ on: rt === 'week' }" @click="pickRange('week')">周复盘</button>
        <button :class="{ on: rt === 'month' }" @click="pickRange('month')">月复盘</button>
        <button :class="{ on: rt === 'custom' }" @click="pickRange('custom')">自定义区间</button>
        <button :class="{ on: rt === 'project' }" @click="pickRange('project')">项目复盘</button>
      </div>

      <div class="dz-ctl">
        <template v-if="rt === 'custom'">
          <input type="date" v-model="customFrom" /><span class="hint">›</span><input type="date" v-model="customTo" />
          <button class="dz-btn sm" @click="customTo = todayKey(); customFrom = addDays(todayKey(), -6)">近 7 天</button>
          <button class="dz-btn sm" @click="customTo = todayKey(); customFrom = addDays(todayKey(), -29)">近 30 天</button>
          <button class="dz-btn sm" @click="customTo = todayKey(); customFrom = addDays(todayKey(), -89)">近 90 天</button>
          <span class="hint">上限 366 天</span>
        </template>
        <template v-else-if="rt === 'project'">
          <select v-model="projId">
            <option v-for="p in projectOpts" :key="p.id" :value="p.id">{{ p.dirName }} · {{ p.name }}</option>
          </select>
          <span class="hint">项目全周期 · 进度与关联资源一并纳入对账</span>
        </template>
        <template v-else>
          <div class="pn"><button title="上一期" @click="prevPeriod">‹</button><span class="v">{{ win.label }}</span><button title="下一期" @click="nextPeriod">›</button></div>
          <span class="hint">{{ off === 0 ? '当前' : `上溯 ${off} 期` }} · 共 {{ win.days }} 天</span>
        </template>
        <span class="dz-sp"></span>
        <span class="hint">环比（等长窗口）有效动作 <b>{{ fmtPct(delta.acts) }}</b> · 加权 <b>{{ fmtPct(delta.W) }}</b></span>
      </div>

      <div class="dz-rev-grid">
        <!-- 左栏：我的量 -->
        <div class="dz-rev-col">
          <div class="dz-blk">
            <div class="bh"><span class="n">①</span><span class="t">画像摘要</span><span class="dz-badge">纯计算</span>
              <span class="sp"></span><span class="meta">{{ win.label }}</span></div>
            <div class="bb">
              <div class="dz-kpis">
                <button v-for="k in rev.kpis" :key="k.key" class="dz-kpi" :class="{ on: drill === k.key }" @click="click(k.key as DrillKey)">
                  <div class="k">{{ k.label }}<span class="go">{{ drill === k.key ? '▾' : '▸' }}</span></div>
                  <div class="v">{{ k.v }}<small>{{ k.unit }}</small></div>
                  <div class="c">{{ k.note }}</div>
                </button>
              </div>
              <DrillCardList v-if="kpiRows" :rows="kpiRows.rows" :label="kpiRows.label" :total="kpiRows.total" />
            </div>
          </div>

          <div class="dz-blk">
            <div class="bh"><span class="n">②</span><span class="t">节奏曲线</span><span class="dz-badge">纯计算</span>
              <span class="sp"></span><span class="meta">{{ TREND_LABEL[trendMode] }}</span></div>
            <div class="bb dz-trend">
              <div class="cap"><span>{{ TREND_LABEL[trendMode] }}加权分</span><span class="sp"></span><span>{{ trendCap }}</span></div>
              <svg v-if="bars.length" viewBox="0 0 640 76" preserveAspectRatio="xMidYMid meet" style="width:100%;height:76px;display:block">
                <rect v-for="(b, i) in bars" :key="i" :x="(640 / bars.length) * i + 2" :y="63 - b.h" :width="Math.max(2, 640 / bars.length - 4)" :height="b.h" rx="2" :fill="`var(--heat-${b.lv})`">
                  <title>{{ b.label }} · {{ b.w }} 分</title>
                </rect>
              </svg>
              <div v-else class="dz-drill-empty">本期无数据</div>
            </div>
          </div>
        </div>

        <!-- 右栏：我的方向 -->
        <div class="dz-rev-col">
          <div class="dz-blk">
            <div class="bh"><span class="n">③</span><span class="t">目标对账</span><span class="dz-badge rl">规则算 · AI 解读</span>
              <span class="sp"></span><span class="meta">点条形看该方向明细</span></div>
            <div class="bb">
              <div class="dz-obj">
                <button v-for="o in obj.rows" :key="o.id" class="o" :class="{ on: drill === `dir:${o.id}` }" @click="click(`dir:${o.id}`)">
                  <span class="nm"><span v-if="o.focused" class="f">主攻</span>{{ o.name }}</span>
                  <span class="bar"><i :style="`width:${Math.round(o.share * 100)}%`" /></span>
                  <span class="n"><b>{{ o.v }}</b> 项 · {{ Math.round(o.share * 100) }}%</span>
                </button>
                <div v-if="!obj.rows.length" class="dz-drill-empty">方向台还没有战略目标</div>
              </div>
              <div class="foot">
                本期产出 <b>{{ obj.total }}</b> 项（窗口内新建 ∪ 完成的任务，按任务去重）·
                覆盖度 <b>{{ cover }}/{{ obj.rows.length }}</b> 个战略目标 ·
                偏斜度 <b>{{ obj.total ? Math.round(maxShare * 100) + '%' : '—' }}</b>
                <template v-if="obj.total">
                  <span v-if="maxShare > 0.45" class="warn"> · 偏斜偏高（>45%）</span><span v-else> · 分布均衡</span>
                </template>
                <template v-if="obj.unassigned"><br>另有 <b>{{ obj.unassigned }}</b> 项未挂项目 ， 无法归属方向（资源卡 / 好奇卡本就无项目归属，见口径边界）。</template>
              </div>
              <DrillCardList v-if="dirRows" :rows="dirRows.rows" :label="`${dirRows.name} · 本期产出`" plain />

              <div v-if="projBlock" class="dz-proj">
                <div class="dz-kpis">
                  <div class="dz-kpi"><div class="k">项目完成度</div><div class="v">{{ projBlock.total ? Math.round(projBlock.done / projBlock.total * 100) : 0 }}<small>%</small></div><div class="c">共 {{ projBlock.total }} 张任务</div></div>
                  <div class="dz-kpi"><div class="k">本期完成</div><div class="v">{{ projBlock.done }}<small>项</small></div><div class="c">进行中 {{ projBlock.doing }} 项</div></div>
                  <div class="dz-kpi"><div class="k">关联资源采纳</div><div class="v">{{ projBlock.links }}<small>次</small></div><div class="c">本期该项目任务与资源</div></div>
                  <div class="dz-kpi"><div class="k">库容净变化</div><div class="v">{{ projBlock.net > 0 ? '+' : '' }}{{ projBlock.net }}<small>张</small></div><div class="c">入台 {{ agg.add }} · 移出 {{ agg.del }}</div></div>
                </div>
              </div>
            </div>
          </div>

          <div class="dz-blk">
            <div class="bh"><span class="n">④</span><span class="t">偏离预警</span><span class="dz-badge rl">规则引擎 · 非 AI</span>
              <span class="sp"></span><span class="meta">命中 {{ rules.length }} / 8 · 点规则看阈值与实测</span></div>
            <div class="bb">
              <div class="dz-rules">
                <button v-for="r in rules" :key="r.id" class="dz-rule" :class="{ on: drill === `rule:${r.id}` }" @click="click(`rule:${r.id}`)">
                  <span class="rid">{{ r.id }}</span>
                  <span class="rb"><span class="rt">{{ r.name }}</span><span class="rd">{{ r.text }}</span></span>
                  <span class="go">›</span>
                </button>
                <div v-if="!rules.length" class="dz-rule ok">
                  <span class="rid"><Icon name="check" :size="13"/></span>
                  <span class="rb"><span class="rt">本期未命中偏离规则</span>
                    <span class="rd">8 条规则全部未触发 —— 采集与消化配比健康、主攻有推进、节奏未失衡。</span></span>
                </div>
              </div>
              <div v-if="ruleHit" class="dz-rule-w">
                <div><span class="k">规则</span> {{ ruleHit.id }} {{ ruleHit.name }}</div>
                <div><span class="k">阈值</span> <b>{{ ruleHit.thr }}</b></div>
                <div><span class="k">实际</span> <b>{{ ruleHit.act }}</b></div>
                <div><span class="k">窗口</span> {{ win.s }} › {{ win.e }}（{{ win.days }} 天，k = {{ Math.max(0.25, Math.round(win.days / 30 * 100) / 100) }}）</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ReviewReportModal
      v-if="repOpen" :open="repOpen" :report="rep"
      @close="repOpen = false"
      @save="emit('save-report', rep as ReviewReport)"
      @task="emit('report-task', $event)"
      @goto="emit('report-goto', $event)"
      @export="emit('report-export', rep as ReviewReport)"
    />
  </section>
</template>
