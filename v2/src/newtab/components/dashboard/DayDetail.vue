<script setup lang="ts">
/**
 * R172-T6（04-66 §5.4 / 04-67 F12~F17）：日详情 —— 四类指标下钻 + 库容变化条 + 当日流水。
 *
 * 三个信息层，从上到下回答三件事：
 *   ① 那天我做了什么  → 采集 / 调出 / 状态变更 / 推进（四列可点开下钻到内容卡片）
 *   ② 库因此变成了什么样 → 该日库容变化 + 截至该日库容（与概览带时间绑定同源）
 *   ③ 原始凭证 → 当日流水（来自 zy_event_log 的明细，按日过滤）
 *
 * 分数一律**从当日事件现算**（而不是只读 `DayRec` 的聚合数）：因为状态变更的权重分目标态，
 * 而 `DayRec.s` 只存了分卡种的条数 —— 现算才能让"这一列多少分"经得起核对。
 *
 * R172-T7 修订：折叠逻辑（同卡多次 `×N` + 首末时刻）上移到 `shared/utils/drillRows.ts`，
 * 与复盘段 KPI 下钻共用**同一实现** —— 顺带修掉一个真缺陷：本地版返回 `t1/t2` 而
 * `DrillCardList` 读 `time/time2`，日详情下钻的时间列此前恒为空白。
 *
 * W5（V3.8.5）#6 今日战报合一：本组件即「战报+分析」统一弹窗 ——
 *   传今天 = 今日战报（品牌区入口），传历史日 = 那日战报（热力图点格子入口），同一 props.day 参数化。
 *   新增：②.5 战报摘要行（N 项操作 · M 张卡片 · 最近一次时刻）；流水升级为分时段叙事时间线
 *   （上午/下午/晚上 + 语义色点 + 动词徽标 + 归属台图标，正序讲完这一天）；底部导出三件套（#4a）。
 *   分析段（四列下钻 + 库容变化条 + 加权分徽标）一字不动地保留在原位。
 */
import './dashboard.css'
import { computed, ref } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import type { CardEvent, CardKind, EventAction } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
import {
  W, actsOf, deltaOf, emptyDay, levelName, levelDesc, levelRange, stockAt,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { groupEventRows, hm, dayOfTs, type DrillRow } from '@/shared/utils/drillRows'
import DrillCardList from './DrillCardList.vue'
import ExportMenu, { type ExportFmt } from './ExportMenu.vue'
import { pngBlobFromSpec, dailyReportShareHtml, sectionsToMd, exportName } from '@/shared/utils/exportView'
import { downloadBlob, downloadText } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  stats: DailyStats
  day: string
  events: CardEvent[]
  liveLink: number
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-log', day: string): void }>()

const store = useAppStore()
type MetricKey = 'create' | 'call' | 'status' | 'deliver'
const sel = ref<MetricKey>('create')

const WD = ['一', '二', '三', '四', '五', '六', '日']

const rec = computed(() => props.stats.days[props.day] || emptyDay())
const dayEvents = computed(() => props.events.filter(e => dayOfTs(e.ts) === props.day))
const lv = computed(() => levelName(rec.value.w))

/** 状态变更的目标态权重（与 dailyStats 的分值表同源；`todo` 回退不计分） */
function statusW(kind: CardKind, to?: string): number {
  if (kind === 'curiosity') return to === 'doing' ? W.sCurioDoing : to === 'done' ? W.sCurioDone : to === 'shelf' ? W.sCurioShelf : 0
  if (kind === 'task') return to === 'doing' ? W.sTaskDoing : to === 'done' ? W.sTaskDone : 0
  return 0
}

const createRows = computed<DrillRow[]>(() => groupEventRows(dayEvents.value.filter(e => e.action === 'create'), () => '采集'))
/** 调出（同卡当天多次由 ×N 徽标承载，其计分权重即防刷分后的 1.0/0.5） */
const callRows = computed<DrillRow[]>(() => groupEventRows(dayEvents.value.filter(e => e.action === 'call'), () => '调出'))
const statusRows = computed<DrillRow[]>(() => groupEventRows(dayEvents.value.filter(e => e.action === 'status'), e => (e.to ? `→ ${e.to}` : '状态变更')))

/** 推进（F12 第四列）：三个来源都不是事件 ⇒ 从卡字段按时间戳归日（与 dailyStats 同一口径） */
const deliverRows = computed<DrillRow[]>(() => {
  const out: DrillRow[] = []
  const d = store.data
  if (!d) return out
  for (const slots of Object.values(d.dailyFocus || {})) {
    for (const s of slots || []) {
      if (s && s.done && s.doneAt && dayOfTs(s.doneAt) === props.day) {
        out.push({ kind: s.sourceType === 'text' ? 'task' : s.sourceType, id: s.sourceId || s.id, title: s.text, icon: '★', tag: '三件事完成', n: 1, time: hm(s.doneAt) })
      }
    }
  }
  const resTitle = new Map((d.resources || []).map(r => [r.id, r.title]))
  const taskTitle = new Map((d.tasks || []).map(t => [t.id, t.title]))
  for (const l of d.supportLinks || []) {
    if (l && l.createdAt && dayOfTs(l.createdAt) === props.day) {
      out.push({ kind: 'task', id: l.taskId, title: `${taskTitle.get(l.taskId) || '任务'} ← ${resTitle.get(l.resourceId) || '资源'}`, icon: '🔗', tag: '任务↔资源关联', n: 1, time: hm(l.createdAt) })
    }
  }
  for (const t of d.tasks || []) {
    for (const s of t.subtasks || []) {
      if (s && s.done && s.doneAt && dayOfTs(s.doneAt) === props.day) {
        out.push({ kind: 'task', id: t.id, title: `${t.title} · ${s.title}`, icon: '☑', tag: '子任务完成', n: 1, time: hm(s.doneAt) })
      }
    }
  }
  return out.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
})

/** 四列得分：一律从当日事件现算（见文件头注释） */
const scores = computed(() => {
  const creates = dayEvents.value.filter(e => e.action === 'create')
  const scCreate = creates.reduce((s, e) => s + (e.kind === 'resource' ? W.cRes : e.kind === 'curiosity' ? W.cCurio : W.cTask), 0)
  const calls = dayEvents.value.filter(e => e.action === 'call')
  const seen = new Set<string>()
  const scCall = calls.reduce((s, e) => { const first = !seen.has(e.cardId); seen.add(e.cardId); return s + (first ? W.call : W.call * 0.5) }, 0)
  const scStatus = dayEvents.value.filter(e => e.action === 'status').reduce((s, e) => s + statusW(e.kind as CardKind, e.to), 0)
  const scDeliver = deliverRows.value.reduce((s, r) => s + (r.tag === '子任务完成' ? W.subtask : r.tag === '三件事完成' ? W.focus : W.link), 0)
  return { create: scCreate, call: scCall, status: scStatus, deliver: scDeliver }
})

const metrics = computed(() => {
  const r = rec.value
  const cN = r.c.res + r.c.curio + r.c.task
  const sN = r.s.curio + r.s.task
  const dN = deliverRows.value.length
  return [
    { k: 'create' as const, h: '采集', n: cN, u: '张', sc: scores.value.create, bd: `资源 ${r.c.res} · 好奇 ${r.c.curio} · 任务 ${r.c.task}`, rows: createRows.value, total: cN },
    { k: 'call' as const, h: '调出', n: r.u, u: '次', sc: scores.value.call, bd: '资源 / 任务 / 好奇 合计', rows: callRows.value, total: r.u },
    { k: 'status' as const, h: '状态变更', n: sN, u: '次', sc: scores.value.status, bd: `好奇 ${r.s.curio} · 任务 ${r.s.task}`, rows: statusRows.value, total: sN },
    { k: 'deliver' as const, h: '推进成果', n: dN, u: '项', sc: scores.value.deliver, bd: `子任务 ${r.sub} · 三件事 ${r.focus} · 关联 ${r.link}`, rows: deliverRows.value, total: dN }
  ]
})
const cur = computed(() => metrics.value.find(m => m.k === sel.value)!)

const dl = computed(() => deltaOf(props.stats, props.day))
const st = computed(() => stockAt(props.stats, props.day, props.liveLink))
const wd = computed(() => WD[(new Date(props.day.replace(/-/g, '/')).getDay() + 6) % 7])

/* ===== W5（V3.8.5）#6 战报层：摘要行 + 分时段叙事时间线 + 导出三件套 ===== */

/** 战报摘要：N 项操作 · M 张卡片 · 最近一次时刻 · 含 N 次清理（delete/purge 计入"清理"） */
const dlSum = computed(() => {
  const evs = dayEvents.value
  const cards = new Set(evs.map(e => e.cardId).filter(Boolean)).size
  const cleanN = evs.filter(e => e.action === 'delete' || e.action === 'purge').length
  const last = evs.length ? Math.max(...evs.map(e => e.ts)) : 0
  return { n: evs.length, cards, cleanN, last }
})

/** 动词徽标：符号 + EVENT_ACT_LABEL（单一真源，判据锚 `EVENT_ACT_LABEL[e.action]` 在此消费）。
 *  类名走**字面量表**而非 `act-${a}` 拼接：dead-css-scan 的 token 匹配看不见运行时拼串，
 *  字面量让 act-create 等 token 全站可见（与 curiosity 的 cls 数据表同一口径）。 */
const ACT_SYM: Record<EventAction, string> = { create: '+', call: '↗', status: '◐', delete: '✕', restore: '⟲', purge: '✕' }
const ACT_CLS: Record<EventAction, string> = {
  create: 'act-create', call: 'act-call', status: 'act-status',
  delete: 'act-delete', restore: 'act-restore', purge: 'act-purge'
}
function actOf(a: EventAction): { txt: string; cls: string } {
  return { txt: `${ACT_SYM[a]} ${EVENT_ACT_LABEL[a]}`, cls: ACT_CLS[a] }
}
const KIND_LABEL: Record<string, string> = { resource: '资源', task: '任务', curiosity: '好奇', system: '系统' }

/** 叙事时间线：正序（上午→晚上讲完这一天），同时间段连续成组 */
const flowGroups = computed(() => {
  const out: { label: string; rows: { tm: string; e: CardEvent }[] }[] = []
  const sorted = [...dayEvents.value].sort((a, b) => a.ts - b.ts)
  for (const e of sorted) {
    const h = new Date(e.ts).getHours()
    const label = h < 12 ? '上午' : h < 18 ? '下午' : '晚上'
    let g = out[out.length - 1]
    if (!g || g.label !== label) { g = { label, rows: [] }; out.push(g) }
    g.rows.push({ tm: hm(e.ts), e })
  }
  return out
})

/* ---- 导出三件套（PNG / HTML / Markdown）：导出的是弹窗当前算出来的东西，不另跑一套算法 ---- */
const exportKpis = () => {
  const evs = dayEvents.value
  const c = { create: 0, call: 0, status: 0, del: 0 }
  for (const e of evs) {
    if (e.action === 'create') c.create++
    else if (e.action === 'call') c.call++
    else if (e.action === 'status') c.status++
    else if (e.action === 'delete' || e.action === 'purge') c.del++
  }
  return [
    { label: '新增', value: String(c.create), note: '采集入卡' },
    { label: '调出', value: String(c.call), note: '打开卡片' },
    { label: '推进', value: String(c.status), note: '状态变更' },
    { label: '清理', value: String(c.del), note: '删除 / 清理' }
  ]
}
const exportRows = () => [...dayEvents.value].sort((a, b) => a.ts - b.ts).map(e => ({ time: hm(e.ts), label: EVENT_ACT_LABEL[e.action], title: e.title }))
const summaryText = computed(() => dlSum.value.n
  ? `当天完成 ${dlSum.value.n} 项操作，涉及 ${dlSum.value.cards} 张卡片${dlSum.value.last ? `，最近一次 ${hm(dlSum.value.last)}` : ''}${dlSum.value.cleanN ? `，含 ${dlSum.value.cleanN} 次清理` : ''}`
  : '这一天没有操作记录。')

async function exportPng(): Promise<void> {
  const blob = await pngBlobFromSpec({
    title: `每日战报 ${props.day}`,
    sub: summaryText.value,
    kpis: exportKpis(),
    grid: null,
    rows: exportRows(),
    footer: '知源调度台 · 每日战报 · 数据只在本机'
  })
  downloadBlob(exportName('战报', 'png', props.day), blob)
  showToast('✓ 已导出战报 PNG（当前主题配色）')
}
function exportHtml(): void {
  const html = dailyReportShareHtml({
    title: `每日战报 ${props.day}`,
    sub: `周${wd.value} · 加权 ${rec.value.w} 分 · 有效动作 ${actsOf(rec.value)} 件`,
    summary: summaryText.value.replace(/(\d+)/g, '<b>$1</b>'),
    kpis: exportKpis(),
    rows: exportRows(),
    footer: '知源调度台 · 每日战报 · 数据只在本机'
  })
  downloadText(exportName('战报', 'html', props.day), html, 'html')
  showToast('✓ 已导出 HTML 分享页（任何人浏览器打开即看）')
}
function exportMd(): void {
  const md = sectionsToMd(`每日战报 ${props.day}`, `周${wd.value} · ${summaryText.value}`, [
    { h: '统计', lines: exportKpis().map(k => `- ${k.label}：${k.value}（${k.note}）`) },
    { h: '库容变化', lines: [`- 截至该日总库容：${st.value.total} 张（资源 ${st.value.res} · 任务 ${st.value.task} · 好奇 ${st.value.curio} · 链接 ${st.value.link}）`, `- 当天入台 +${dl.value.add} · 当天移出 -${dl.value.del}`] },
    { h: '操作流水（正序）', lines: exportRows().map(r => `- ${r.time}　${r.label}　${r.title}`) }
  ])
  downloadText(exportName('战报', 'md', props.day), md, 'md')
  showToast('✓ 已导出 Markdown（贴进笔记即成形）')
}
function onExport(fmt: ExportFmt): void {
  if (fmt === 'png') void exportPng()
  else if (fmt === 'html') exportHtml()
  else if (fmt === 'md') exportMd()
}
</script>

<template>
  <div class="dz-day">
    <div class="dz-day-head">
      <span class="d">{{ day }}</span><span class="w">周{{ wd }}</span>
      <span class="dz-badge" :class="{ hi: ['冲刺', '满格'].includes(lv) }" :title="levelDesc(rec.w)">
        {{ lv }} · 强度 {{ Math.min(100, Math.round(rec.w / 55 * 100)) }}
      </span>
      <span class="dz-badge">加权 {{ rec.w }} 分 · {{ levelRange(rec.w) }}</span>
      <span class="dz-badge">有效动作 {{ actsOf(rec) }} 件</span>
      <span class="dz-sp"></span>
      <button class="dz-btn ghost sm" @click="emit('close')">收起 ×</button>
    </div>

    <!-- W5 #6 战报摘要行：一句话讲清当天干了多少事 -->
    <div class="dz-dl-sum">{{ summaryText }}</div>

    <div class="dz-hintline">▸ 点击下方任一指标 → 展开该类<b>内容卡片</b>；卡片<b>单击看详情</b> · <b>双击直达链接</b>（与资源台 / 任务中心一致）</div>

    <div class="dz-mcols">
      <button v-for="m in metrics" :key="m.k" class="dz-mcol" :class="{ on: sel === m.k }" @click="sel = m.k">
        <div class="h"><span class="dot"></span>{{ m.h }}<span class="go">{{ sel === m.k ? '▾ 已展开' : '▸' }}</span></div>
        <div class="n">{{ m.n }}<small>{{ m.u }}</small></div>
        <div class="sc">{{ m.sc.toFixed(1) }} 分</div>
        <div class="bd">{{ m.bd }}</div>
      </button>
    </div>

    <div class="dz-dstock">
      <div class="t">📦 <b>该日库容变化</b> —— 截至 {{ day }} 库容：总 <b>{{ st.total.toLocaleString() }}</b> 张
        <span style="color:var(--text-4)">（资源 {{ st.res }} · 任务 {{ st.task }} · 好奇 {{ st.curio }} · 链接 {{ st.link }}）</span></div>
      <div class="row">
        <span class="it"><span class="k">当天入台</span><span class="v up">+{{ dl.add }}</span></span>
        <span class="it"><span class="k">当天移出</span><span class="v" :class="{ dn: dl.del > 0 }">{{ dl.del ? '-' + dl.del : '0' }}</span></span>
        <span style="width:1px;background:var(--border)"></span>
        <span class="it"><span class="k">资源</span><span class="v" :class="dl.res > 0 ? 'up' : dl.res < 0 ? 'dn' : ''">{{ dl.res > 0 ? '+' : '' }}{{ dl.res }}</span></span>
        <span class="it"><span class="k">任务</span><span class="v" :class="dl.task > 0 ? 'up' : dl.task < 0 ? 'dn' : ''">{{ dl.task > 0 ? '+' : '' }}{{ dl.task }}</span></span>
        <span class="it"><span class="k">好奇</span><span class="v" :class="dl.curio > 0 ? 'up' : dl.curio < 0 ? 'dn' : ''">{{ dl.curio > 0 ? '+' : '' }}{{ dl.curio }}</span></span>
        <span class="it"><span class="k">链接</span><span class="v">±0</span></span>
      </div>
    </div>

    <DrillCardList :rows="cur.rows" :label="cur.h" :total="cur.total" plain />

    <!-- W5 #6：当日流水升级为分时段叙事时间线（正序，上午→晚上） -->
    <div class="dz-tl">
      <div class="th">当日操作时间线<span class="dz-sp"></span>
        <span style="color:var(--text-3)">共 {{ dlSum.n }} 条 · 明细来自 zy_event_log</span>
        <button class="dz-btn sm" @click="emit('open-log', day)">查看全部记录 ›</button>
      </div>
      <div v-if="!flowGroups.length" class="dz-row"><span class="ti" style="color:var(--text-3)">这一天没有操作记录</span></div>
      <template v-for="g in flowGroups" :key="g.label">
        <div class="dz-tl-grp">{{ g.label }}</div>
        <div v-for="({ tm, e }, i) in g.rows" :key="e.id + '-' + i" class="dz-tl-row" :title="e.title">
          <span class="tm">{{ tm }}</span>
          <span class="dotcol"><span class="tl-dot" :class="actOf(e.action).cls"></span></span>
          <span class="ac" :class="actOf(e.action).cls">{{ actOf(e.action).txt }}</span>
          <span class="kd">{{ KIND_LABEL[e.kind] || e.kind }}</span>
          <span class="ti">{{ e.title }}</span>
          <span v-if="e.to" class="to">{{ e.to }}</span>
        </div>
      </template>
    </div>

    <!-- W5 #4a：导出移入日详情（PNG / HTML / Markdown 三件套） -->
    <div class="dz-dl-foot">
      <span class="note">数据来源：本机事件日志 · 自然日口径</span>
      <ExportMenu :formats="['png', 'html', 'md']" @pick="onExport" />
    </div>
  </div>
</template>
