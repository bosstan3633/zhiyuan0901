<script setup lang="ts">
/**
 * R172-T6（04-66 §五 / 04-67 F7~F11）：年度热力图 —— 12 月 × 366 格 + 六档语义图例 + 摘要卡 + 切年。
 *
 * 只做**镜子**不做**鞭子**（04-66 §十三）：不做打卡/连击成就，格子的唯一职责是"让你看见自己这一年怎么走的"。
 * 图例只出语义名（静默/轻触/常规/高负荷/冲刺/满格），分数区间降为 tooltip（F8 验收：不得出现分档裸代号）。
 * 性能：整年格子一次性取数（`Object.keys(days)` 一次遍历），切年仅换 `year` 重算 —— 不重扫全库。
 */
import './dashboard.css'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { CardEvent } from '@/shared/utils/eventLog'
import {
  LV_NAME, LV_DESC, LV_RANGE, levelOf, actsOf,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { yearAgg, longestStreak, todayKey } from '@/shared/utils/reviewReport'
import ExportMenu, { type ExportFmt } from './ExportMenu.vue'
import { pngBlobFromSpec, heatmapShareHtml, exportName } from '@/shared/utils/exportView'
import { zyCardBlob, zyCardHtml } from '@/shared/utils/zyCard'
import { downloadBlob, downloadText } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  stats: DailyStats
  year: number
  selDay: string | null
  events: CardEvent[]
  liveLink: number
  /** 画像洞察的年度视图默认直接展开全年；调度台等其它宿主仍保持近 26 周概览。 */
  defaultExpanded?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:year', y: number): void
  (e: 'update:selDay', d: string | null): void
  /* ★W12-D open-log 随日详情一并迁到 TodayBattleHost —— 热力图不再有日详情，
     「查看全部记录 ›」那条出口也跟着走了，声明不留（没人 emit 的死通道）。 */
}>()

/* W2（V3.8.2）：日详情 Teleport 到 body 后，路由/场景切换不会卸载宿主 ⇒ 遮罩会跨场存留
   （theme-audit 实测：dz-hl / dz-report / st-tags 三张图被遗留遮罩盖住）。这里挂 hash 变化监听，
   跨到其它场景即清空 selDay，使 v-if 卸载弹窗——保留 `<Teleport to="body">` 的居中/不裁切收益。 */
const routeWatchOff = (): void => {
  if (typeof window === 'undefined') return
  window.removeEventListener('hashchange', dismissOnRoute)
}
function dismissOnRoute(): void {
  if (props.selDay) emit('update:selDay', null)
}
onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('hashchange', dismissOnRoute)
})
onUnmounted(routeWatchOff)

const WD = ['一', '二', '三', '四', '五', '六', '日']
const pad2 = (n: number): string => String(n).padStart(2, '0')
/* ★ V3.8.6 增补：today 改 computed——原 setup 期一次性取值，跨零点后"今天"格子标记会停在旧日期 */
const today = computed(() => todayKey())

const agg = computed(() => yearAgg(props.stats, props.year))
const streak = computed(() => longestStreak(props.stats, props.year))
const curYear = computed(() => Number(today.value.slice(0, 4)))

/* W5（V3.8.5）#4c：摘要 4 chip → 图标化指标卡（图标 + 大数字 + 标签）。数据源 summary 不变——导出 kpis 仍取全量。 */
const SUM_ICONS = {
  act: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z"/></svg>',
  streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  peak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 20 6-12 4 7 2.5-4 5.5 9z"/><path d="m15.5 13.5 1.5-1"/></svg>'
} as const
const summary = computed(() => {
  const a = agg.value
  const lv = a.peak ? levelOf(a.peak[1]) : 0
  return [
    { k: '活跃天数', ic: SUM_ICONS.act, v: a.act, u: `/ ${a.days} 天`, d: `覆盖率 ${Math.round((a.act / Math.max(1, a.days)) * 100)}% · 平均每 ${(a.days / Math.max(1, a.act)).toFixed(1)} 天动一次` },
    { k: '有效动作', ic: SUM_ICONS.done, v: a.acts, u: '件', d: `加权 ${Math.round(a.W)} 分（内部量）· 日均 ${(a.acts / Math.max(1, a.act)).toFixed(1)} 件` },
    { k: '最长连续', ic: SUM_ICONS.streak, v: streak.value, u: '天', d: streak.value >= 7 ? '节奏稳定' : '存在断档' },
    { k: '最猛的一天', ic: SUM_ICONS.peak, v: a.peak ? a.peak[0].slice(5) : '—', u: a.peak ? `· ${LV_NAME[lv]}` : '', d: a.peak ? `${a.peak[1]} 分 · ${LV_DESC[lv]} · 今年第 1` : '暂无数据' }
  ]
})

/**
 * 12 个月块（F7）：按自然月分块 + 每块 7 列（周一~周日）。
 * ★月首偏移走 CSS `grid-column-start`，**不渲染占位格**：占位若也做成 button，一年多出 38 个
 *   "看着是格子、点了没反应"的假控件，还白占 38 个节点（04-67 §8.3 的「366 格 ≤400 节点」本意即此）。
 */
const months = computed(() => {
  const y = props.year
  const out: { m: number; w: number; start: number; cells: { k: string; lv: number; cls: string }[] }[] = []
  for (let m = 0; m < 12; m++) {
    const dim = new Date(y, m + 1, 0).getDate()
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
    const cells: { k: string; lv: number; cls: string }[] = []
    let mw = 0
    for (let dd = 1; dd <= dim; dd++) {
      const k = `${y}-${pad2(m + 1)}-${pad2(dd)}`
      if (k > today.value) { cells.push({ k, lv: 0, cls: 'future' }); continue }
      const r = props.stats.days[k]
      const lv = levelOf(r ? r.w : 0)
      mw += r ? r.w : 0
      const cls = [`l${lv}`]
      if (k === today.value) cls.push('today')
      if (k === props.selDay) cls.push('sel')
      cells.push({ k, lv, cls: cls.join('') })
    }
    out.push({ m: m + 1, w: Math.round(mw), start: firstDow + 1, cells })
  }
  return out
})

function pickCell(c: { k: string; cls: string }) {
  if (!c.k || c.cls.includes('future')) return
  emit('update:selDay', props.selDay === c.k ? null : c.k)
}

/** 整年网格是一个日历控件：只保留一个 Tab 停点，其余日期用方向键移动。 */
const gridStop = ref<string | null>(null)
const dayStop = computed(() => {
  if (gridStop.value) {
    const hit = months.value.flatMap(mo => mo.cells).find(c => c.k === gridStop.value && !c.cls.includes('future'))
    if (hit) return hit.k
  }
  const all = months.value.flatMap(mo => mo.cells).filter(c => !c.cls.includes('future'))
  return all.find(c => c.k === props.selDay)?.k || all.find(c => c.k === today.value)?.k || all[0]?.k || null
})

function moveDay(from: string, delta: number): void {
  const all = months.value.flatMap(mo => mo.cells).filter(c => !c.cls.includes('future'))
  const at = all.findIndex(c => c.k === from)
  if (at < 0) return
  const next = all[Math.max(0, Math.min(all.length - 1, at + delta))]
  if (!next) return
  gridStop.value = next.k
  void nextTick(() => {
    document.querySelector<HTMLElement>(`.dz-cell[data-day="${next.k}"]`)?.focus()
  })
}

function onDayKey(c: { k: string; cls: string }, event: KeyboardEvent): void {
  if (c.cls.includes('future')) return
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  if (event.key in moves) {
    event.preventDefault()
    moveDay(c.k, moves[event.key])
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const all = months.value.flatMap(mo => mo.cells).filter(x => !x.cls.includes('future'))
    const target = event.key === 'Home' ? all[0] : all[all.length - 1]
    if (target) {
      gridStop.value = target.k
      void nextTick(() => document.querySelector<HTMLElement>(`.dz-cell[data-day="${target.k}"]`)?.focus())
    }
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    pickCell(c)
  }
}

/* ★V3.8.7 焦点契约 #4：调度台首屏不再让回看型内容占最大连续面积。
   概览条取**最近 26 周**（半年）的逐周活跃度——保留「这一年」的持续在场感，
   但把 366 格的全年网格收进「看全年 ›」展开态（数据与交互零改动，只是默认折叠）。
   取数复用 months 已算好的 lv，不重扫 days。 */
const COMPACT_WEEKS = 26
const expanded = ref(!!props.defaultExpanded)
/** 最近 26 周：每周取该周内最高的 lv 作为该周强度（无记录=0 静默档） */
const compactWeeks = computed(() => {
  const cells = months.value.flatMap(m => m.cells).filter(c => !c.cls.includes('future'))
  const out: { lv: number; n: number; best: string }[] = []
  // 从末尾按 7 天一组回推，最后一组为「本周」
  for (let i = 0; i < COMPACT_WEEKS; i++) {
    const end = cells.length - i * 7
    const start = Math.max(0, end - 7)
    const seg = cells.slice(start, end)
    if (!seg.length) { out.unshift({ lv: 0, n: 0, best: '' }); continue }
    let lv = 0, best = seg[0]
    for (const c of seg) if (c.lv > lv) { lv = c.lv; best = c }
    out.unshift({ lv, n: seg.filter(c => c.lv > 0).length, best: best.k })
  }
  return out
})
/** 概览条旁的两枚数字（近半年活跃天数 / 今日操作数）——口径走 actsOf 单一真源，不自造计数 */
const compactStat = computed(() => {
  const cells = months.value.flatMap(m => m.cells).filter(c => !c.cls.includes('future'))
  const half = cells.slice(Math.max(0, cells.length - COMPACT_WEEKS * 7))
  const r = props.stats.days[today.value]
  return { act: half.filter(c => c.lv > 0).length, todayN: r ? actsOf(r) : 0 }
})
function pickCompact(w: { lv: number; best: string }) {
  if (!w.best) return
  expanded.value = true
  emit('update:selDay', props.selDay === w.best ? null : w.best)
}
function shiftYear(n: number) {
  const y = props.year + n
  if (y > curYear.value || y < 2000) return
  emit('update:year', y)
}
const fmtW = (n: number): string => (n >= 1000 ? n.toLocaleString() : String(n))

/* ---------- W2（V3.8.2）：热力图段导出收为「PNG 下载 + HTML 分享」两项 ---------- */
/** 格子坐标（12 月块 4×3 布局）—— PNG 与 HTML 共用同一份坐标，导出即所见 */
function gridCells(): { c: number; r: number; lv: number }[] {
  const cells: { c: number; r: number; lv: number }[] = []
  months.value.forEach((mo, bi) => {
    const bx = bi % 4
    const by = Math.floor(bi / 4)
    mo.cells.forEach((x, i) => {
      if (!x.k || x.cls.includes('future')) return
      const n = i + mo.start - 1
      cells.push({ c: bx * 8 + (n % 7), r: by * 8 + Math.floor(n / 7), lv: x.lv })
    })
  })
  return cells
}
const kpiSpec = () => summary.value.map(s => ({ label: s.k, value: `${typeof s.v === 'number' ? fmtW(s.v) : s.v}${s.u}`, note: s.d }))
const footerText = '知源调度台 · 档位由加权分映射 · 数据只在本机'

/** ★W18（统一卡片模板）：年度热力图也走「知源卡片」——骨相与日战报一致，只是把明细区换成 12 个月格子图。 */
function buildZyCard() {
  return {
    kicker: '年度热力',
    title: `${props.year} 年调度热力图`,
    sub: `活跃 ${agg.value.act}/${agg.value.days} 天 · 有效动作 ${fmtW(agg.value.acts)} 件 · 加权 ${Math.round(agg.value.W)} 分 · P90 = ${agg.value.p90} 分 · 最长连续 ${streak.value} 天`,
    readouts: kpiSpec(),
    grid: { cells: gridCells(), cols: 32, rows: 24 },
    footer: '知源调度台 · 档位由加权分映射 · 数据只在本机'
  }
}
async function exportPng(): Promise<void> {
  const blob = await zyCardBlob(buildZyCard())
  downloadBlob(exportName('热力图卡', 'png', String(props.year)), blob)
  showToast('已导出年历卡片图片（当前主题配色）')
}
function exportHtml(): void {
  downloadText(exportName('热力图卡', 'html', String(props.year)), zyCardHtml(buildZyCard()), 'html')
  showToast('已导出 HTML 卡片（任何人浏览器打开即看）')
}
function onExport(fmt: ExportFmt): void {
  if (fmt === 'png') void exportPng()
  else if (fmt === 'html') exportHtml()
}
</script>

<template>
  <section class="dz-sec">
    <div class="dz-sec-h">
      <!-- W5（V3.8.5）#2：数字角标 → SVG 图标（accent）——与「今日三件事 / 三张卡」三标题统一规格 -->
      <span class="dz-n dz-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg></span><span class="dz-t">年度热力图</span><span class="dz-en">ANNUAL HEATMAP</span>
      <span class="dz-sp"></span>
      <!-- ★V3.8.7：切年/导出/选中态等控件随全年网格一起进展开态（概览条只讲「近半年」）。
           ★收起按钮：折叠必须是**双向**的——V3.8.7 首版只给了「看全年 ›」没给回来的路，
           展开后与旧版长得一模一样、且回不去（真缺陷，W7-3 随迁钉住双向）。 -->
      <template v-if="expanded">
      <button class="dz-btn sm ghost" title="收起全年网格，回到近 26 周概览条" @click="expanded = false">收起</button>
      <span class="dz-badge">{{ agg.first }} › {{ agg.last }}</span>
      <span class="dz-badge">{{ selDay ? `已选 ${selDay}` : '点格子看那一天' }}</span>
      <ExportMenu :formats="['png', 'html']" @pick="onExport" />
      <button class="dz-btn sm ghost" title="上一年" @click="shiftYear(-1)">‹</button>
      <b class="hm-year">{{ year }}</b>
      <button class="dz-btn sm ghost" :disabled="year >= curYear" title="下一年" @click="shiftYear(1)">›</button>
      </template>
    </div>

    <div class="dz-sec-b">
      <!-- ★V3.8.7 焦点契约 #4：调度台首屏默认只给「近 26 周」概览条，全年 366 格收进「看全年 ›」。
           折叠的是**呈现**，不是数据——months/summary/导出三件套/日详情全部照常在位，展开即恢复原样。 -->
      <div v-if="!expanded" class="dz-mini">
        <div class="dz-mini-strip">
          <button v-for="(w, i) in compactWeeks" :key="'w' + i" class="dz-mini-w" :class="'l' + w.lv"
            :style="{ height: (6 + w.lv * 4) + 'px' }"
            :disabled="!w.best" :title="w.best ? `${w.best} · 当周 ${w.n} 天有记录 · ${LV_NAME[w.lv]}` : '无记录'"
            @click="pickCompact(w)" />
        </div>
        <div class="dz-mini-meta">
          <span>近 26 周活跃 <b>{{ compactStat.act }}</b> 天</span>
          <span>今日 <b>{{ compactStat.todayN }}</b> 次操作</span>
          <button class="dz-mini-more" @click="expanded = true">看全年 ›</button>
        </div>
      </div>

      <template v-else>
      <!-- R174-5：四卡压单行指标条，说明收进 title（数据源 summary 不动——导出三件套 kpis 仍取全量）
           W5 #4c：chip → 图标化指标卡（图标 + 大数字 + 标签，纵向堆叠）；.d 保 DOM（R174-5 判据）display:none -->
      <div class="dz-sum">
        <div v-for="s in summary" :key="s.k" class="c" :title="s.d">
          <span class="ic" v-html="s.ic"></span>
          <span class="tx">
            <span class="v">{{ typeof s.v === 'number' ? fmtW(s.v) : s.v }}<small>{{ s.u }}</small></span>
            <span class="k">{{ s.k }}</span>
          </span>
          <span class="d">{{ s.d }}</span>
        </div>
      </div>

      <div v-if="!agg.act" class="dz-empty">这一年还没有行为记录 —— 采集第一张卡，这里就会亮起来。</div>
      <template v-else>
        <div class="dz-months">
          <div v-for="mo in months" :key="mo.m" class="mb">
            <div class="dz-mb-h"><span class="m">{{ mo.m }} 月</span><span class="s">{{ mo.w }} 分</span></div>
            <div class="dz-wk"><span v-for="w in WD" :key="w">{{ w }}</span></div>
            <div class="dz-g">
              <button
                v-for="(c, i) in mo.cells"
                :key="mo.m + '-' + i"
                class="dz-cell"
                :class="c.cls"
                :data-day="c.k"
                :disabled="c.cls.includes('future')"
                :tabindex="c.k === dayStop ? 0 : -1"
                :aria-label="c.k ? `${c.k} · ${LV_NAME[c.lv]}` : undefined"
                :style="i === 0 && mo.start > 1 ? 'grid-column-start:' + mo.start : undefined"
                :title="c.k ? `${c.k} · ${LV_NAME[c.lv]}（${LV_RANGE[c.lv]}）` : ''"
                @focus="gridStop = c.k"
                @keydown="onDayKey(c, $event)"
                @click="pickCell(c)"
              />
            </div>
          </div>
        </div>

        <div class="dz-legend">
          <span class="lvs">
            <span v-for="(n, i) in LV_NAME" :key="n" class="lv" :title="`${LV_DESC[i]}（${LV_RANGE[i]}）`">
              <span class="sw" :style="{ background: `var(--heat-${i})` }"></span>{{ n }}
            </span>
            <!-- ★V3.8.7 补丁三：当日格子既然高亮了，图例就得说明那圈是什么，否则用户不知道该看哪格 -->
            <span class="lv today-key" title="今天 · accent 描边">今天</span>
          </span>
          <span class="note">
            本年活跃日均 {{ (agg.W / Math.max(1, agg.act)).toFixed(1) }} 分 · <b>P90 = {{ agg.p90 }} 分</b>（P90 以上即「满格」档）<br>
            调出维度自 {{ stats.fullSince }} 起完整（新增 call 事件后）
          </span>
        </div>
      </template>
      </template>
    </div>

    <!-- ★W12-D 日详情弹窗从此处解耦出去（V3.8.16）。
      原先 DayDetail 长在热力图内部，靠 `selDay` 驱动；于是「调度台要能弹今日战报」这件事
      必须连带把整个热力图挂上才成立——用户 2026-10-13 拍板热力图从调度台退役（画像洞察页已全量覆盖），
      若不解耦，删掉热力图就会把「今日战报」一起删掉，而它要被保留。
      现由兄弟宿主 TodayBattleHost.vue 承载（与 HeatmapModule 同一套数据桥口径），
      热力图只剩热力图的职责。下方留一行注释记改靶缘由，避免日后被当成「漏迁」补回来。 -->
  </section>
</template>
