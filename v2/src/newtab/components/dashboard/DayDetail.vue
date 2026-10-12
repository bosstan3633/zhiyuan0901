<script setup lang="ts">
/**
 * W6（V3.8.6）#1：日详情完全按原型重构（docs/原型/今日战报-DailyLogTimeline.html）。
 *
 * 原型结构五段，从上到下：
 *   ① md-head     —— 图标 + 标题 + 日期 + 关闭
 *   ② md-summary  —— 「今天你完成了 N 项操作，涉及 M 张卡。」+ 最近一次操作时刻
 *   ③ md-stats    —— 四格统计（新增 / 调出 / 推进 / 清理），彩色大数，零值压淡
 *   ③.5 热力带     —— 该日加权分 / 等级 / 强度（用户拍板：四格统计下方一条热力带，
 *                     背景 var(--heat-{lv})，文字 --heat-ink）
 *   ④ md-scroll   —— 分时段叙事时间线（**降序**：下午在前，对齐原型 sort b.ts-a.ts）
 *   ⑤ md-foot     —— 页脚注 + 查看全部记录 + 导出三件套
 *
 * 分析段（W5 保留的四列下钻 dz-mcols + 库容变化条 dz-dstock + hintline + DrillCardList）
 * 随本轮裁剪**整体退役**——日详情只回答「那天我做了什么」，下钻入口收敛到复盘段
 * （ReviewPanel 经 drillRows.ts 仍持有 groupEventRows 消费）。
 *
 * ★判据随迁（见 scripts/regression）：R172-7/8、W5-7 的旧锚（groupEventRows/dz-mcol/
 * deltaOf/stockAt/DrillCardList/该日库容变化）迁移为 drillRows.ts 仍在 + ReviewPanel
 * 消费 + 日详情新锚（dz-stats 四格 / dz-heat-band / dz-tl-row 降序结构）。
 */
import './dashboard.css'
import { computed } from 'vue'
import type { CardEvent, EventAction } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
import {
  emptyDay, levelOf, levelName, levelDesc, levelRange, actsOf,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { hm, dayOfTs } from '@/shared/utils/drillRows'
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

const WD = ['一', '二', '三', '四', '五', '六', '日']

const rec = computed(() => props.stats.days[props.day] || emptyDay())
const dayEvents = computed(() => props.events.filter(e => dayOfTs(e.ts) === props.day))
const lv = computed(() => levelName(rec.value.w))
const lvIdx = computed(() => levelOf(rec.value.w))
const intensity = computed(() => Math.min(100, Math.round(rec.value.w / 55 * 100)))
const wd = computed(() => WD[(new Date(props.day.replace(/-/g, '/')).getDay() + 6) % 7])

/** 摘要：N 项操作 · M 张卡片 · 最近一次时刻（原型 md-summary + md-recent） */
const dlSum = computed(() => {
  const evs = dayEvents.value
  const cards = new Set(evs.map(e => e.cardId).filter(Boolean)).size
  const last = evs.length ? Math.max(...evs.map(e => e.ts)) : 0
  return { n: evs.length, cards, last }
})

/** 四格统计（原型 renderStats 口径：create/call/status/delete+purge → 新增/调出/推进/清理） */
const statCells = computed(() => {
  const c = { create: 0, call: 0, status: 0, del: 0 }
  for (const e of dayEvents.value) {
    if (e.action === 'create') c.create++
    else if (e.action === 'call') c.call++
    else if (e.action === 'status') c.status++
    else if (e.action === 'delete' || e.action === 'purge') c.del++
  }
  return [
    { k: 'create', n: c.create, lbl: '新增', cls: 'sc-create' },
    { k: 'call', n: c.call, lbl: '调出', cls: 'sc-call' },
    { k: 'status', n: c.status, lbl: '推进', cls: 'sc-status' },
    { k: 'del', n: c.del, lbl: '清理', cls: 'sc-del' }
  ]
})

/** 动词徽标：符号 + EVENT_ACT_LABEL（单一真源，判据锚 `EVENT_ACT_LABEL[e.action]` 在此消费）。
 *  类名走**字面量表**而非 `act-${a}` 拼接：dead-css-scan 的 token 匹配看不见运行时拼串。 */
const ACT_SYM: Record<EventAction, string> = { create: '+', call: '↗', status: '◐', delete: '✕', restore: '⟲', purge: '✕' }
const ACT_CLS: Record<EventAction, string> = {
  create: 'act-create', call: 'act-call', status: 'act-status',
  delete: 'act-delete', restore: 'act-restore', purge: 'act-purge'
}
function actOf(a: EventAction): { txt: string; cls: string } {
  return { txt: `${ACT_SYM[a]} ${EVENT_ACT_LABEL[a]}`, cls: ACT_CLS[a] }
}
const KIND_LABEL: Record<string, string> = { resource: '资源', task: '任务', curiosity: '好奇', system: '系统' }

/** 分时段叙事时间线：**降序**（下午在前——对齐原型 renderTimeline 的 sort((a,b)=>b.ts-a.ts)），
 *  同时间段连续成组（上午 / 下午 / 晚上）。 */
const flowGroups = computed(() => {
  const out: { label: string; rows: { tm: string; e: CardEvent }[] }[] = []
  const sorted = [...dayEvents.value].sort((a, b) => b.ts - a.ts)
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
  const c = statCells.value
  return [
    { label: '新增', value: String(c[0].n), note: '采集入卡' },
    { label: '调出', value: String(c[1].n), note: '打开卡片' },
    { label: '推进', value: String(c[2].n), note: '状态变更' },
    { label: '清理', value: String(c[3].n), note: '删除 / 清理' }
  ]
}
const exportRows = () => [...dayEvents.value].sort((a, b) => a.ts - b.ts).map(e => ({ time: hm(e.ts), label: EVENT_ACT_LABEL[e.action], title: e.title }))
const summaryText = computed(() => dlSum.value.n
  ? `当天完成 ${dlSum.value.n} 项操作，涉及 ${dlSum.value.cards} 张卡片${dlSum.value.last ? `，最近一次 ${hm(dlSum.value.last)}` : ''}`
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
    { h: '当日热度', lines: [`- 加权 ${rec.value.w} 分 · ${lv.value} · 强度 ${intensity.value}%（${levelRange(rec.value.w)}）`] },
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
    <!-- ① 头部：图标 + 标题 + 日期 + 关闭（原型 md-head） -->
    <div class="dz-day-head">
      <span class="dz-day-ic" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="4"/></svg>
      </span>
      <div class="dz-day-txt">
        <div class="dz-day-title">今日战报</div>
        <div class="dz-day-sub">{{ day }} 周{{ wd }}</div>
      </div>
      <button class="dz-btn ghost sm" aria-label="关闭" @click="emit('close')">收起 ×</button>
    </div>

    <!-- ② 摘要行（原型 md-summary） -->
    <div class="dz-dl-sum">
      <template v-if="dlSum.n">今天你完成了 <b>{{ dlSum.n }}</b> 项操作，涉及 <b>{{ dlSum.cards }}</b> 张卡。</template>
      <template v-else>这一天没有操作记录。</template>
      <div v-if="dlSum.last" class="dz-dl-recent">最近一次操作：{{ hm(dlSum.last) }}</div>
    </div>

    <!-- ③ 四格统计（原型 md-stats：新增 / 调出 / 推进 / 清理，零值压淡） -->
    <div v-if="dlSum.n" class="dz-stats">
      <div v-for="c in statCells" :key="c.k" class="dz-stat" :class="[c.cls, { dim: c.n === 0 }]">
        <span class="n">{{ c.n }}</span>
        <span class="lbl">{{ c.lbl }}</span>
      </div>
    </div>

    <!-- ③.5 热力带（用户拍板：四格统计下方一条）：加权分 / 等级 / 强度，背景走 heat 色阶 -->
    <div class="dz-heat-band" :class="`lv${lvIdx}`" :title="levelDesc(rec.w)">
      <span class="lv">{{ lv }}</span>
      <span class="w">加权 {{ rec.w }} 分</span>
      <span class="range">{{ levelRange(rec.w) }}</span>
      <span class="int">强度 {{ intensity }}%</span>
      <span class="acts">有效动作 {{ actsOf(rec) }} 件</span>
    </div>

    <!-- ④ 分时段叙事时间线（原型 md-scroll：降序，下午在前） -->
    <div class="dz-tl">
      <div class="th">当日操作时间线<span class="dz-sp"></span>
        <span style="color:var(--text-3)">共 {{ dlSum.n }} 条 · 明细来自 zy_event_log</span>
        <button class="dz-btn sm" @click="emit('open-log', day)">查看全部记录 ›</button>
      </div>
      <div v-if="!flowGroups.length" class="dz-row"><span class="ti" style="color:var(--text-3)">今天还没有操作记录 —— 去调度台做点什么吧：采集一张卡、推进一个任务、或打开一次资源</span></div>
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

    <!-- ⑤ 页脚（原型 md-foot：注 + 查看全部记录 + 导出三件套） -->
    <div class="dz-dl-foot">
      <span class="note">数据来源：本机事件日志 · 仅当日 · 自然日口径</span>
      <ExportMenu :formats="['png', 'html', 'md']" @pick="onExport" />
    </div>
  </div>
</template>
