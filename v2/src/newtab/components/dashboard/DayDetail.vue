<script setup lang="ts">
/**
 * W6（V3.8.6）#1：日详情完全按原型重构（docs/原型/今日战报-DailyLogTimeline.html）。
 *
 * 原型结构五段，从上到下：
 *   ① md-head     —— 图标 + 标题 + 日期 + 关闭
 *   ② md-summary  —— 「今天你完成了 N 项操作，涉及 M 张卡。」+ 最近一次操作时刻
 *   ③ md-stats    —— 四格统计（新增 / 调出 / 推进 / 清理），彩色大数，零值压淡，可点击下钻
 *   ③.5 热力带     —— 该日加权分 / 等级 / 强度（用户拍板：四格统计下方一条热力带）
 *   ④ md-scroll   —— 分时段叙事时间线（**降序**：下午在前），行可点击（单击定位 / 双击开链接）
 *   ⑤ md-foot     —— 页脚注 + 查看全部记录 + 导出三件套
 *
 * ★ W6.1 用户拍板（2026-10-12）：
 *   · 四格统计指标卡可点击下钻 → DrillCardList（与全库统一：单击定位 / 双击开链接）
 *   · 时间线明细行可点击 → 单击定位卡片 / 双击直达链接（与 DrillCardList 同一套交互）
 *   · 「查看全部记录」先关弹窗再开右侧抽屉（HeatmapModule.onOpenLog 处理）
 *   · 弹窗宽度 / 字号 / 字间距对齐原型 min(720px,92vw) / 86vh / radius 18px
 */
import './dashboard.css'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import type { CardEvent, EventAction } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
import {
  emptyDay, levelOf, levelName, levelDesc, levelRange, actsOf,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { hm, dayOfTs, groupEventRows, type DrillRow } from '@/shared/utils/drillRows'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import DrillCardList from './DrillCardList.vue'
import ExportMenu, { type ExportFmt } from './ExportMenu.vue'
import { pngBlobFromSpec, dailyReportShareHtml, sectionsToMd, exportName } from '@/shared/utils/exportView'
import { zyCardBlob, zyCardHtml } from '@/shared/utils/zyCard'
import { downloadBlob, downloadText } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  stats: DailyStats
  day: string
  events: CardEvent[]
  liveLink: number
  /** ★W18：三类卡存量（任务 / 好奇 / 资源）——统一卡片里的「知源卡带」 */
  kinds?: { task: number; curio: number; res: number; label?: string } | null
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-log', day: string): void }>()

const router = useRouter()
const store = useAppStore()

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

/** 四格统计（原型 renderStats 口径：create/call/status/delete+purge → 新增/调出/推进/清理）。
 *  ★ W6.1：指标卡可点击下钻——drill 状态 toggle，激活时展开 DrillCardList。 */
type DrillKey = '' | 'create' | 'call' | 'status' | 'del'
const drill = ref<DrillKey>('')
const statCells = computed(() => {
  const c = { create: 0, call: 0, status: 0, del: 0 }
  for (const e of dayEvents.value) {
    if (e.action === 'create') c.create++
    else if (e.action === 'call') c.call++
    else if (e.action === 'status') c.status++
    else if (e.action === 'delete' || e.action === 'purge') c.del++
  }
  return [
    { k: 'create' as DrillKey, n: c.create, lbl: '新增', sym: '+', cls: 'sc-create' },
    { k: 'call' as DrillKey, n: c.call, lbl: '调出', sym: '↗', cls: 'sc-call' },
    { k: 'status' as DrillKey, n: c.status, lbl: '推进', sym: '', cls: 'sc-status' },
    { k: 'del' as DrillKey, n: c.del, lbl: '清理', sym: '⌫', cls: 'sc-del' }
  ]
})
function toggleDrill(k: DrillKey) {
  drill.value = drill.value === k ? '' : k
}
/** 下钻行：按四格口径过滤当天事件 → groupEventRows 聚合（同卡多次 ×N，与全库单一实现） */
const drillRows = computed<{ label: string; rows: DrillRow[]; total: number } | null>(() => {
  if (!drill.value) return null
  const filtered = dayEvents.value.filter(e => {
    if (drill.value === 'create') return e.action === 'create'
    if (drill.value === 'call') return e.action === 'call'
    if (drill.value === 'status') return e.action === 'status'
    return e.action === 'delete' || e.action === 'purge'
  })
  const lbl = statCells.value.find(s => s.k === drill.value)!.lbl
  return {
    label: `当日「${lbl}」下钻`,
    rows: groupEventRows(filtered, e => EVENT_ACT_LABEL[e.action]),
    total: filtered.length
  }
})

/** 动词徽标：符号 + EVENT_ACT_LABEL（单一真源，判据锚 `EVENT_ACT_LABEL[e.action]` 在此消费）。
 *  类名走**字面量表**而非 `act-${a}` 拼接：dead-css-scan 的 token 匹配看不见运行时拼串。 */
const ACT_SYM: Record<EventAction, string> = { create: '+', call: '↗', status: '◐', delete: '', restore: '⟲', purge: '' }
const ACT_CLS: Record<EventAction, string> = {
  create: 'act-create', call: 'act-call', status: 'act-status',
  delete: 'act-delete', restore: 'act-restore', purge: 'act-purge'
}
function actOf(a: EventAction): { txt: string; cls: string } {
  return { txt: `${ACT_SYM[a]} ${EVENT_ACT_LABEL[a]}`, cls: ACT_CLS[a] }
}
const KIND_LABEL: Record<string, string> = { resource: '资源', task: '任务', curiosity: '好奇', system: '系统' }

/** 分时段叙事时间线：**降序**（下午在前——对齐原型 renderTimeline 的 sort((a,b)=>b.ts-a.ts)），
 *  同时间段连续成组（上午 / 下午 / 晚上）。
 *  ★ W6.1：行可点击——单击定位卡片 / 双击直达链接（与 DrillCardList 同一套交互，全库统一）。 */
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

/** 时间线行点击：单击 → 定位并高亮；双击 → 直达链接 / 打开文件（与 DrillCardList.pick/open 同构） */
function locateRow(e: CardEvent) {
  const kind = asLocateKind(e.kind)
  if (!kind || !e.cardId) { showToast(`「${e.title}」无对应卡片类型`); return }
  const t = locateTargetOf(store.data!, kind, e.cardId)
  if (!t) { showToast(`「${e.title}」已不在库中`); return }
  void router.push(t)
}
function openRow(e: CardEvent) {
  if (e.kind === 'resource' && e.cardId) {
    const card = store.data?.resources.find(x => x.id === e.cardId)
    if (card && card.link) {
      const url = toOpenableUrl(card.linkType, card.link)
      if (url) { openExternalLink(url); return }
    }
  }
  locateRow(e)
}

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
  ? `当天完成 ${dlSum.value.n} 项操作，涉及 ${dlSum.value.cards} 张卡片${dlSum.value.last ? `，最近一次 ${hm(dlSum.value.last)}`: ''}`
  : '这一天没有操作记录。')

/** ★W18（统一卡片模板）：战报图片改走「知源卡片」模板——眉标 / 读数 / 三类卡带 / 流水 / 品牌页脚，
 *  与热力图、月度导出同一张卡的骨相，便于阅读与传播。 */
function buildZyCard() {
  const c = statCells.value
  const kinds = props.kinds || null
  return {
    kicker: '每日战报',
    title: `每日战报 ${props.day}`,
    sub: `周${wd.value} · 加权 ${rec.value.w} 分 · ${lv.value} · ${summaryText.value}`.slice(0, 96),
    readouts: [
      { label: '新增', value: String(c[0].n), note: '采集入卡' },
      { label: '调出', value: String(c[1].n), note: '打开卡片' },
      { label: '推进', value: String(c[2].n), note: '状态变更' },
      { label: '清理', value: String(c[3].n), note: '删除 / 清理' }
    ],
    kinds,
    rows: exportRows(),
    rowsTitle: '当日操作流水',
    footer: '知源调度台 · 每日战报 · 数据只在本机'
  }
}
/** 弹窗头部的独立入口：一键保存当日战报图片（不用再进导出菜单） */
async function saveCardImage(): Promise<void> {
  const blob = await zyCardBlob(buildZyCard())
  downloadBlob(exportName('战报卡', 'png', props.day), blob)
  showToast('已保存战报卡图片（当前主题配色）')
}
async function exportPng(): Promise<void> {
  await saveCardImage()
}
function exportHtml(): void {
  downloadText(exportName('战报卡', 'html', props.day), zyCardHtml(buildZyCard()), 'html')
  showToast('已导出 HTML 卡片（任何人浏览器打开即看）')
}
function exportMd(): void {
  const md = sectionsToMd(`每日战报 ${props.day}`, `周${wd.value} · ${summaryText.value}`, [
    { h: '统计', lines: exportKpis().map(k => `- ${k.label}：${k.value}（${k.note}）`) },
    { h: '当日热度', lines: [`- 加权 ${rec.value.w} 分 · ${lv.value} · 强度 ${intensity.value}%（${levelRange(rec.value.w)}）`] },
    { h: '操作流水（正序）', lines: exportRows().map(r => `- ${r.time}　${r.label}　${r.title}`) }
  ])
  downloadText(exportName('战报', 'md', props.day), md, 'md')
  showToast('已导出 Markdown（贴进笔记即成形）')
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
      <!-- ★W18：当日战报图片的独立入口（下载方式也要卡片化，便于阅读与传播） -->
      <button class="dz-btn ghost sm dz-save-card" title="把这一天存成一张知源卡片图片"
        aria-label="保存为图片" @click="saveCardImage"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg> 保存为图片</button>
      <button class="dz-btn ghost sm" aria-label="关闭" @click="emit('close')">收起 ×</button>
    </div>

    <!-- ② 摘要行（原型 md-summary） -->
    <div class="dz-dl-sum">
      <template v-if="dlSum.n">今天你完成了 <b>{{ dlSum.n }}</b> 项操作，涉及 <b>{{ dlSum.cards }}</b> 张卡。</template>
      <template v-else>这一天没有操作记录。</template>
      <div v-if="dlSum.last" class="dz-dl-recent">最近一次操作：{{ hm(dlSum.last) }}<template v-if="dlSum.last">（{{ dayOfTs(dlSum.last) === day ? '' : dayOfTs(dlSum.last) + ' ' }}{{ Math.round((Date.now() - dlSum.last) / 3600000) }} 小时前）</template></div>
    </div>

    <!-- ③ 四格统计（原型 md-stats：新增 / 调出 / 推进 / 清理，零值压淡；★W6.1 可点击下钻） -->
    <div v-if="dlSum.n" class="dz-stats">
      <button v-for="c in statCells" :key="c.k" class="dz-stat" :class="[c.cls, { dim: c.n === 0, on: drill === c.k }]"
        :disabled="c.n === 0" :title="c.n === 0 ? `当日无「${c.lbl}」记录` : `点击下钻「${c.lbl}」明细`"
        @click="toggleDrill(c.k)">
        <span class="n">{{ c.n }}</span>
        <span class="lbl"><span class="sym">{{ c.sym }}</span>{{ c.lbl }}</span>
      </button>
    </div>

    <!-- ③ 下钻区（★W6.1：紧跟四格下方，与全库 DrillCardList 同一套交互） -->
    <DrillCardList v-if="drillRows" :rows="drillRows.rows" :label="drillRows.label"
      :total="drillRows.total" plain />

    <!-- ③.5 热力带（用户拍板：四格统计下方一条）：加权分 / 等级 / 强度，背景走 heat 色阶 -->
    <div class="dz-heat-band" :class="`lv${lvIdx}`" :title="levelDesc(rec.w)">
      <span class="lv">{{ lv }}</span>
      <span class="w">加权 {{ rec.w }} 分</span>
      <span class="range">{{ levelRange(rec.w) }}</span>
      <span class="int">强度 {{ intensity }}%</span>
      <span class="acts">有效动作 {{ actsOf(rec) }} 件</span>
    </div>

    <!-- ④ 分时段叙事时间线（原型 md-scroll：降序，下午在前；★W6.1 行可点击） -->
    <div class="dz-tl">
      <div class="th">当日操作时间线<span class="dz-sp"></span>
        <span class="dz-day-note">共 {{ dlSum.n }} 条 · 明细来自 zy_event_log</span>
        <button class="dz-btn sm" @click="emit('open-log', day)">查看全部记录 ›</button>
      </div>
      <div v-if="!flowGroups.length" class="dz-row"><span class="ti dz-day-note">今天还没有操作记录 —— 去调度台做点什么吧：采集一张卡、推进一个任务、或打开一次资源</span></div>
      <template v-for="g in flowGroups" :key="g.label">
        <div class="dz-tl-grp">{{ g.label }}</div>
        <div v-for="({ tm, e }, i) in g.rows" :key="e.id + '-' + i" class="dz-tl-row"
          :title="`单击 → 定位「${e.title}」· 双击 → 直达链接 / 打开文件`"
          @click="locateRow(e)" @dblclick="openRow(e)">
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
      <button class="dz-btn sm" @click="emit('open-log', day)">查看全部记录 ›</button>
      <ExportMenu :formats="['png', 'html', 'md']" @pick="onExport" />
    </div>
  </div>
</template>
