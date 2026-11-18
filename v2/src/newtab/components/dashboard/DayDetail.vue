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
 *   ⑤ md-foot     —— 页脚数据来源；查看全部记录与导出收在头部左侧
 *
 * ★ W6.1 用户拍板（2026-10-12）：
 *   · 四格统计指标卡可点击下钻 → DrillCardList（与全库统一：单击定位 / 双击开链接）
 *   · 时间线明细行可点击 → 单击定位卡片 / 双击直达链接（与 DrillCardList 同一套交互）
 *   · 「查看全部记录」先关弹窗再开右侧抽屉（HeatmapModule.onOpenLog 处理）
 *   · 弹窗宽度 / 字号 / 字间距对齐原型 min(720px,92vw) / 86vh / radius 18px
 */
import './dashboard.css'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/newtab/stores/app'
import type { AppData, FocusSlot } from '@/shared/models'
import type { CardEvent, EventAction } from '@/shared/utils/eventLog'
import { EVENT_ACT_LABEL } from '@/shared/utils/eventLog'
import {
  emptyDay, levelOf, levelName, levelDesc, levelRange, actsOf,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { hm, dayOfTs, groupEventRows, type DrillRow } from '@/shared/utils/drillRows'
import { locateTargetOf, asLocateKind } from '@/shared/utils/locate'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { buildCurationTree } from '@/shared/utils/compassCurationModel'
import { activeFocusSlots } from '@/shared/utils/focusSlots'
import DrillCardList from './DrillCardList.vue'
import ExportMenu, { type ExportFmt } from './ExportMenu.vue'
import { dailyReportShareHtml, sectionsToMd, exportName } from '@/shared/utils/exportView'
import { downloadText } from '@/shared/utils/download'
import { escapeMarkdown, safeExportLink } from '@/shared/utils/cardExport'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'

const props = defineProps<{
  stats: DailyStats
  day: string
  events: CardEvent[]
  liveLink: number
  /** 四类卡存量（任务 / 选题 / 好奇 / 资源）——统一卡片里的「知源卡带」 */
  kinds?: { task: number; curio: number; res: number; topic?: number; label?: string } | null
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

/** 方向树摘要只作为 AI 阅读上下文，不参与战报统计，也不写回任何业务数据。 */
const directionContext = computed(() => {
  const data = store.data
  if (!data) return '方向树暂不可用。'
  const tree = buildCurationTree(data)
  const projects = tree.goals
    .flatMap(goal => goal.projects.map(project => ({
      goal: goal.dir.name,
      name: project.project.name,
      focused: project.project.isFocused,
      progress: project.progress,
      done: project.doneCount,
      total: project.totalCount,
      metrics: project.metrics.length,
    })))
    .sort((a, b) => Number(b.focused) - Number(a.focused) || b.progress - a.progress)
    .slice(0, 8)
    .map(project => `${project.focused ? '[主攻]' : ''}${project.name}（${project.progress}%，任务 ${project.done}/${project.total}，${project.metrics} 个成功指标，归属：${project.goal}）`)
  const focus = activeFocusSlots(data.dailyFocus?.[props.day])
    .map(slot => {
      const status = focusSlotStatusForInsight(data, slot)
      return `${slot.text || '未命名事项'}（${status}）`
    })
  return [
    `愿景：${tree.vision || '未填写'}`,
    `使命：${tree.mission || '未填写'}`,
    `方向进度：${projects.length ? projects.join('；') : '暂无项目'}`,
    `当日三件事：${focus.length ? focus.join('；') : '未设置'}`,
  ].join('\n')
})

function focusSlotStatusForInsight(data: AppData, slot: FocusSlot): string {
  if (slot.sourceType === 'task' && slot.sourceId) {
    const task = data.tasks.find(row => !row.deletedAt && row.id === slot.sourceId)
    if (task) return task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待开始'
  }
  return slot.done ? '已完成' : '未完成'
}

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

/** AI 洞察只在当前弹窗内临时生成，不写库、不进入战报导出。 */
const aiInsight = ref('')
const aiInsightState = ref<'idle' | 'run' | 'done' | 'off'>('idle')
const aiInsightError = ref('')
let aiInsightAbort: AbortController | null = null

async function generateAiInsight(): Promise<void> {
  if (aiInsightState.value === 'run') return
  aiInsightState.value = 'run'
  aiInsightError.value = ''
  aiInsightAbort?.abort()
  aiInsightAbort = new AbortController()
  try {
    const [cfgMod, llm] = await Promise.all([
      import('@/shared/ai/config'),
      import('@/shared/ai/llm'),
    ])
    await cfgMod.loadAiConfig()
    if (!cfgMod.aiReady.value) {
      aiInsightState.value = 'off'
      showToast('请先在 设置 → AI 助手 完成接入')
      return
    }
    const cells = statCells.value
    const eventSample = dayEvents.value
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 30)
      .map(e => `${hm(e.ts)} ${EVENT_ACT_LABEL[e.action]} ${KIND_LABEL[e.kind] || e.kind}：${e.title}`)
      .join('\n')
    const raw = await llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一名严谨、克制的中文数据分析师。只根据给定战报事实和方向树上下文分析，不编造数字，不做人格评判；缺少数据时明确说不足，不擅自补零。输出 180—200 字的一段中文，必须依次包含：①一条行为洞察；②对洞察背后原因的深层剖析；③一条结合主攻项目或成功指标的下一步行动建议。不要标题、不要 Markdown、不要客套话。',
        },
        {
          role: 'user',
          content: [
            `日期：${props.day}`,
            `操作总数：${dlSum.value.n}；涉及卡片：${dlSum.value.cards}`,
            `新增：${cells[0].n}；调出：${cells[1].n}；推进：${cells[2].n}；清理：${cells[3].n}`,
            `加权活跃分：${rec.value.w}；强度：${intensity.value}%`,
            `方向树上下文：\n${directionContext.value}`,
            eventSample ? `主要操作：\n${eventSample}` : '没有操作流水。',
          ].join('\n'),
        },
      ],
      maxTokens: 420,
      temperature: 0.35,
      signal: aiInsightAbort.signal,
    })
    const clean = raw.replace(/\s+/g, ' ').trim()
    aiInsight.value = clean.length > 200 ? `${clean.slice(0, 199)}…` : clean
    aiInsightState.value = aiInsight.value ? 'done' : 'idle'
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    aiInsightError.value = error instanceof Error ? error.message : String(error)
    aiInsightState.value = 'idle'
  }
}

watch(() => props.day, () => {
  aiInsightAbort?.abort()
  aiInsightAbort = null
  aiInsight.value = ''
  aiInsightError.value = ''
  aiInsightState.value = 'idle'
})
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
const KIND_LABEL: Record<string, string> = { resource: '资源', task: '任务', curiosity: '好奇', topic: '选题', system: '系统' }

/** 分时段叙事时间线：**降序**（下午在前——对齐原型 renderTimeline 的 sort((a,b)=>b.ts-a.ts)），
 *  同时间段连续成组（上午 / 下午 / 晚上）。
 *  ★ W6.1：行可点击——单击定位卡片 / 双击直达链接（与 DrillCardList 同一套交互，全库统一）。 */
const flowGroups = computed(() => {
  const out: { label: string; rows: { tm: string; tm2?: string; n: number; e: CardEvent }[] }[] = []
  const sorted = [...dayEvents.value].sort((a, b) => b.ts - a.ts)
  for (const e of sorted) {
    const h = new Date(e.ts).getHours()
    const label = h < 12 ? '上午' : h < 18 ? '下午' : '晚上'
    let g = out[out.length - 1]
    if (!g || g.label !== label) { g = { label, rows: [] }; out.push(g) }
    /* 同一张卡、同一动作在同一时段内只占一行；n 保留真实操作次数，总指标同步不减。 */
    const same = g.rows.find(row => row.e.kind === e.kind && row.e.cardId === e.cardId && row.e.action === e.action)
    if (same) {
      same.n++
      same.tm2 = hm(e.ts)
      if (e.ts < same.e.ts) same.e = e
    } else {
      g.rows.push({ tm: hm(e.ts), n: 1, e })
    }
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

/* ---- Markdown / HTML 导出：导出弹窗当前算出来的内容，不另跑一套统计 ---- */
const exportKpis = () => {
  const c = statCells.value
  return [
    { label: '新增', value: String(c[0].n), note: '采集入卡' },
    { label: '调出', value: String(c[1].n), note: '打开卡片' },
    { label: '推进', value: String(c[2].n), note: '状态变更' },
    { label: '清理', value: String(c[3].n), note: '删除 / 清理' }
  ]
}
/** 只有资源卡能拿原始链接；任务 / 系统 / 好奇卡与无效 URL 一律保持纯文本。 */
function resourceHref(e: CardEvent): string {
  if (e.kind !== 'resource' || !e.cardId) return ''
  const card = store.data?.resources.find(x => x.id === e.cardId)
  if (!card) return ''
  const safe = safeExportLink(toOpenableUrl(card.linkType, card.link))
  return safe.clickable ? safe.href : ''
}
/** 下钻行与主流水共用“资源卡才可点击”的判据，不回退到按标题猜卡。 */
function drillResourceHref(row: DrillRow): string {
  return row.kind === 'resource'
    ? resourceHref({
      id: `drill-${row.id}`,
      ts: 0,
      action: 'call',
      kind: 'resource',
      title: row.title,
      cardId: row.id,
    })
    : ''
}
function exportRows() {
  const timeline = flowGroups.value.flatMap(group => group.rows.map(({ tm, n, e }) => ({
    time: tm,
    label: `${EVENT_ACT_LABEL[e.action]}${n > 1 ? ` ×${n}` : ''}`,
    title: e.title,
    href: resourceHref(e),
  })))
  const drill = drillRows.value?.rows.map(row => ({
    time: row.time || '',
    label: `${row.tag}${(row.n || 1) > 1 ? ` ×${row.n}` : ''}`,
    title: row.title,
    href: drillResourceHref(row),
  })) || []
  return [...timeline, ...drill]
}
const summaryText = computed(() => dlSum.value.n
  ? `当天完成 ${dlSum.value.n} 项操作，涉及 ${dlSum.value.cards} 张卡片${dlSum.value.last ? `，最近一次 ${hm(dlSum.value.last)}`: ''}`
  : '这一天没有操作记录。')

function exportHtml(): void {
  const html = dailyReportShareHtml({
    title: `每日战报 ${props.day}`,
    sub: `周${wd.value} · 加权 ${rec.value.w} 分 · ${lv.value} · 强度 ${intensity.value}%`,
    summary: summaryText.value,
    kpis: exportKpis(),
    rows: exportRows(),
    footer: '知源 ownway · 每日战报 · 数据只在本机',
  })
  downloadText(exportName('战报', 'html', props.day), html, 'html')
  showToast('已导出 HTML（资源卡名称可直达原始链接）')
}
function exportMd(): void {
  const timelineLines = flowGroups.value.flatMap(group => [
    `- **${group.label}**`,
    ...group.rows.map(({ tm, n, e }) => {
      const href = resourceHref(e)
      const title = href ? `[${escapeMarkdown(e.title)}](${href})` : escapeMarkdown(e.title)
      return `  - ${tm}　${EVENT_ACT_LABEL[e.action]}${n > 1 ? ` ×${n}` : ''}　${title}`
    })
  ])
  const drillLines = drillRows.value
    ? [`- **${drillRows.value.label}**`, ...drillRows.value.rows.map(r => {
      const href = drillResourceHref(r)
      const title = href ? `[${escapeMarkdown(r.title)}](${href})` : escapeMarkdown(r.title)
      return `  - ${r.time || ''}　${r.tag}${(r.n || 1) > 1 ? ` ×${r.n}` : ''}　${title}`
    })]
    : []
  const md = sectionsToMd(`每日战报 ${props.day}`, `周${wd.value} · ${summaryText.value}`, [
    { h: '统计', lines: exportKpis().map(k => `- ${k.label}：${k.value}（${k.note}）`) },
    { h: '当日热度', lines: [`- 加权 ${rec.value.w} 分 · ${lv.value} · 强度 ${intensity.value}%（${levelRange(rec.value.w)}）`] },
    { h: '操作流水（屏上顺序）', lines: timelineLines },
    ...(drillLines.length ? [{ h: '当前下钻', lines: drillLines }] : [])
  ])
  downloadText(exportName('战报', 'md', props.day), md, 'md')
  showToast('已导出 Markdown（贴进笔记即成形）')
}
function onExport(fmt: ExportFmt): void {
  if (fmt === 'html') exportHtml()
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
      <div class="dz-day-actions">
        <button class="dz-btn ghost sm" @click="emit('open-log', day)">查看全部记录 ›</button>
        <ExportMenu :formats="['md', 'html']" align="start" @pick="onExport" />
      </div>
      <button class="dz-btn ghost sm dz-day-close" aria-label="关闭" @click="emit('close')">收起 ×</button>
    </div>

    <!-- ② 摘要行（原型 md-summary） -->
    <div class="dz-dl-sum">
      <template v-if="dlSum.n">今天你完成了 <b>{{ dlSum.n }}</b> 项操作，涉及 <b>{{ dlSum.cards }}</b> 张卡。</template>
      <template v-else>这一天没有操作记录。</template>
      <div v-if="dlSum.last" class="dz-dl-recent">最近一次操作：{{ hm(dlSum.last) }}<template v-if="dlSum.last">（{{ dayOfTs(dlSum.last) === day ? '' : dayOfTs(dlSum.last) + ' ' }}{{ Math.round((Date.now() - dlSum.last) / 3600000) }} 小时前）</template></div>
    </div>

    <!-- ③ AI 洞察：用户手动触发，只在当前战报弹窗临时展示，不写入任务真源。 -->
    <section class="dz-ai-insight" :data-state="aiInsightState" aria-label="AI 洞察">
      <header>
        <span class="dz-ai-mark" aria-hidden="true"><Icon name="sparkles" :size="15" /></span>
        <div>
          <b>AI 洞察</b>
          <small>从行为洞察到深层原因，再给一条下一步建议</small>
        </div>
        <button class="dz-btn sm" type="button" :disabled="aiInsightState === 'run' || !dlSum.n" @click="generateAiInsight">
          <AiEntryButton variant="inline" :label="aiInsightState === 'run' ? '分析中…' : aiInsightState === 'done' ? '重新分析' : '生成洞察'" />
        </button>
      </header>
      <p v-if="aiInsight" class="dz-ai-copy">{{ aiInsight }}</p>
      <p v-else-if="aiInsightState === 'run'" class="dz-ai-placeholder">正在读取当天操作结构，分析行为模式与背后的注意力分配…</p>
      <p v-else-if="aiInsightState === 'off'" class="dz-ai-placeholder">AI 尚未接入。完成设置后，可随时回到这里重新生成。</p>
      <p v-else-if="aiInsightError" class="dz-ai-placeholder error">生成失败：{{ aiInsightError }}</p>
      <p v-else class="dz-ai-placeholder">当下方出现操作数据后，可点击“生成洞察”。分析只在本次弹窗内临时展示，不自动保存。</p>
    </section>

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
        <span class="dz-day-note">共 {{ dlSum.n }} 次操作 · 明细来自 zy_event_log</span>
        <button class="dz-btn sm" @click="emit('open-log', day)">查看全部记录 ›</button>
      </div>
      <div v-if="!flowGroups.length" class="dz-row"><span class="ti dz-day-note">今天还没有操作记录 —— 去调度台做点什么吧：采集一张卡、推进一个任务、或打开一次资源</span></div>
      <template v-for="g in flowGroups" :key="g.label">
        <div class="dz-tl-grp">{{ g.label }}</div>
        <div v-for="({ tm, tm2, n, e }, i) in g.rows" :key="e.kind + '-' + e.cardId + '-' + e.action + '-' + i" class="dz-tl-row" v-pressable
          :title="`单击 → 定位「${e.title}」· 双击 → 直达链接 / 打开文件`"
          @click="locateRow(e)" @dblclick="openRow(e)">
          <span class="tm">{{ tm }}</span>
          <span class="dotcol"><span class="tl-dot" :class="actOf(e.action).cls"></span></span>
          <span class="ac" :class="actOf(e.action).cls">{{ actOf(e.action).txt }}</span>
          <span v-if="n > 1" class="tl-x" :title="`同卡同动作共 ${n} 次${tm2 ? `，最近 ${tm2}` : ''}`">×{{ n }}</span>
          <span class="kd">{{ KIND_LABEL[e.kind] || e.kind }}</span>
          <span class="ti">{{ e.title }}</span>
          <span v-if="e.to" class="to">{{ e.to }}</span>
        </div>
      </template>
    </div>

    <!-- ⑤ 页脚只保留数据来源说明；操作入口统一在头部左侧 -->
    <div class="dz-dl-foot">
      <span class="note">数据来源：本机事件日志 · 仅当日 · 自然日口径</span>
    </div>
  </div>
</template>
