<script setup lang="ts">
/**
 * R172-T6（04-66 §五 / 04-67 F7~F11）：年度热力图 —— 12 月 × 366 格 + 六档语义图例 + 摘要卡 + 切年。
 *
 * 只做**镜子**不做**鞭子**（04-66 §十三）：不做打卡/连击成就，格子的唯一职责是"让你看见自己这一年怎么走的"。
 * 图例只出语义名（静默/轻触/常规/高负荷/冲刺/满格），分数区间降为 tooltip（F8 验收：不得出现分档裸代号）。
 * 性能：整年格子一次性取数（`Object.keys(days)` 一次遍历），切年仅换 `year` 重算 —— 不重扫全库。
 */
import './dashboard.css'
import { computed } from 'vue'
import type { CardEvent } from '@/shared/utils/eventLog'
import {
  LV_NAME, LV_DESC, LV_RANGE, levelOf, actsOf,
  type DailyStats
} from '@/shared/utils/dailyStats'
import { yearAgg, longestStreak, todayKey } from '@/shared/utils/reviewReport'
import DayDetail from './DayDetail.vue'
import ExportMenu from './ExportMenu.vue'
import { tablesToCsv, sectionsToMd, pngBlobFromSpec, exportName } from '@/shared/utils/exportView'
import { downloadText, downloadBlob } from '@/shared/utils/download'
import { showToast } from '@/shared/components/toast'

const props = defineProps<{
  stats: DailyStats
  year: number
  selDay: string | null
  events: CardEvent[]
  liveLink: number
}>()
const emit = defineEmits<{
  (e: 'update:year', y: number): void
  (e: 'update:selDay', d: string | null): void
  (e: 'open-log', day: string): void
}>()

const WD = ['一', '二', '三', '四', '五', '六', '日']
const pad2 = (n: number): string => String(n).padStart(2, '0')
const today = todayKey()

const agg = computed(() => yearAgg(props.stats, props.year))
const streak = computed(() => longestStreak(props.stats, props.year))
const curYear = computed(() => Number(today.slice(0, 4)))

const summary = computed(() => {
  const a = agg.value
  const lv = a.peak ? levelOf(a.peak[1]) : 0
  return [
    { k: '活跃天数', v: a.act, u: `/ ${a.days} 天`, d: `覆盖率 ${Math.round((a.act / Math.max(1, a.days)) * 100)}% · 平均每 ${(a.days / Math.max(1, a.act)).toFixed(1)} 天动一次` },
    { k: '有效动作', v: a.acts, u: '件', d: `加权 ${Math.round(a.W)} 分（内部量）· 日均 ${(a.acts / Math.max(1, a.act)).toFixed(1)} 件` },
    { k: '最长连续', v: streak.value, u: '天', d: streak.value >= 7 ? '节奏稳定' : '存在断档' },
    { k: '最猛的一天', v: a.peak ? a.peak[0].slice(5) : '—', u: a.peak ? `· ${LV_NAME[lv]}` : '', d: a.peak ? `${a.peak[1]} 分 · ${LV_DESC[lv]} · 今年第 1` : '暂无数据' }
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
      if (k > today) { cells.push({ k, lv: 0, cls: 'future' }); continue }
      const r = props.stats.days[k]
      const lv = levelOf(r ? r.w : 0)
      mw += r ? r.w : 0
      const cls = [`l${lv}`]
      if (k === today) cls.push('today')
      if (k === props.selDay) cls.push('sel')
      cells.push({ k, lv, cls: cls.join(' ') })
    }
    out.push({ m: m + 1, w: Math.round(mw), start: firstDow + 1, cells })
  }
  return out
})

function pickCell(c: { k: string; cls: string }) {
  if (!c.k || c.cls.includes('future')) return
  emit('update:selDay', props.selDay === c.k ? null : c.k)
}
function shiftYear(n: number) {
  const y = props.year + n
  if (y > curYear.value || y < 2000) return
  emit('update:year', y)
}
const fmtW = (n: number): string => (n >= 1000 ? n.toLocaleString() : String(n))

/* ---------- R172-T12（F39）：热力图段导出三件套（逐日明细 CSV / 年度摘要 MD / 年历 PNG） ---------- */
const dayKeys = computed(() => Object.keys(props.stats.days).filter(k => k.slice(0, 4) === String(props.year)).sort())
const yearRows = computed(() => dayKeys.value.map(k => {
  const r = props.stats.days[k]
  return [k, r.w, LV_NAME[levelOf(r.w)], actsOf(r), r.c.res, r.c.curio, r.c.task, r.u, r.s.curio, r.s.task, r.d, r.sub, r.focus, r.link, r.x.add, r.x.del]
}))
const lvCount = computed(() => {
  const t = [0, 0, 0, 0, 0, 0]
  for (const k of dayKeys.value) t[levelOf(props.stats.days[k].w)]++
  return t
})
function exportCsv(): void {
  const csv = tablesToCsv([{
    header: ['日期', '加权分', '档位', '有效动作', '采集·资源', '采集·好奇', '采集·任务', '调出', '状态变更·好奇', '状态变更·任务',
      '推进合计', '推进·子任务', '推进·三件事', '推进·任务资源', '入台', '移出'],
    rows: yearRows.value
  }])
  downloadText(exportName('热力图', 'csv', String(props.year)), csv, 'csv')
  showToast(`✓ 已导出 ${props.year} 年逐日明细 CSV（${yearRows.value.length} 天）`)
}
function exportMd(): void {
  const md = sectionsToMd(`${props.year} 年调度热力图`, `${agg.value.first} → ${agg.value.last} · 数据自 ${props.stats.fullSince} 起完整`, [
    { h: '年度摘要', lines: summary.value.map(s => `- **${s.k}** ${typeof s.v === 'number' ? fmtW(s.v) : s.v} ${s.u} — ${s.d}`) },
    { h: '档位分布', lines: LV_NAME.map((n, i) => `- ${n}（${LV_RANGE[i]}）：${lvCount.value[i]} 天`) },
    { h: '各月加权分', lines: months.value.map(mo => `- ${mo.m} 月：${mo.w} 分`) }
  ])
  downloadText(exportName('热力图', 'md', String(props.year)), md, 'md')
  showToast('✓ 已导出年度 Markdown')
}
async function exportPng(): Promise<void> {
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
  const blob = await pngBlobFromSpec({
    title: `${props.year} 年调度热力图`,
    sub: `活跃 ${agg.value.act}/${agg.value.days} 天 · 有效动作 ${fmtW(agg.value.acts)} 件 · 加权 ${Math.round(agg.value.W)} 分 · P90 = ${agg.value.p90} 分 · 最长连续 ${streak.value} 天`,
    kpis: summary.value.map(s => ({ label: s.k, value: `${typeof s.v === 'number' ? fmtW(s.v) : s.v}${s.u}`, note: s.d })),
    grid: { cells, cols: 32, rows: 24, cell: 11, gap: 2, label: '六档：' + LV_NAME.join(' / ') },
    footer: '知源调度台 · 档位由加权分映射（分数口径见设置 › 知源仪表盘）· 数据只在本机'
  })
  downloadBlob(exportName('热力图', 'png', String(props.year)), blob)
  showToast('✓ 已导出年历 PNG（当前主题配色）')
}
function onExport(fmt: 'csv' | 'md' | 'png'): void {
  if (fmt === 'csv') exportCsv()
  else if (fmt === 'md') exportMd()
  else void exportPng()
}
</script>

<template>
  <section class="dz-sec">
    <div class="dz-sec-h">
      <span class="dz-n">2</span><span class="dz-t">年度热力图</span><span class="dz-en">ANNUAL HEATMAP</span>
      <span class="dz-sp"></span>
      <span class="dz-badge">{{ agg.first }} → {{ agg.last }}</span>
      <span class="dz-badge">{{ selDay ? `已选 ${selDay}` : '点格子看那一天' }}</span>
      <ExportMenu @pick="onExport" />
      <button class="dz-btn sm ghost" title="上一年" @click="shiftYear(-1)">‹</button>
      <b style="font-size:var(--fs-sub);min-width:44px;text-align:center">{{ year }}</b>
      <button class="dz-btn sm ghost" :disabled="year >= curYear" title="下一年" @click="shiftYear(1)">›</button>
    </div>

    <div class="dz-sec-b">
      <div class="dz-sum">
        <div v-for="s in summary" :key="s.k" class="c">
          <div class="k">{{ s.k }}</div>
          <div class="v">{{ typeof s.v === 'number' ? fmtW(s.v) : s.v }}<small>{{ s.u }}</small></div>
          <div class="d">{{ s.d }}</div>
        </div>
      </div>

      <div v-if="!agg.act" class="dz-empty">这一年还没有行为记录 —— 采集第一张卡，这里就会亮起来。</div>
      <template v-else>
        <div class="dz-months">
          <div v-for="mo in months" :key="mo.m" class="mb">
            <div class="dz-mb-h"><span class="m">{{ mo.m }} 月</span><span class="s">{{ mo.w }} 分</span></div>
            <div class="dz-wk"><span v-for="w in WD" :key="w">{{ w }}</span></div>
            <div class="dz-g">
              <button v-for="(c, i) in mo.cells" :key="mo.m + '-' + i" class="dz-cell" :class="c.cls"
                :disabled="c.cls.includes('future')" :style="i === 0 && mo.start > 1 ? 'grid-column-start:' + mo.start : undefined"
                :title="c.k ? `${c.k} · ${LV_NAME[c.lv]}（${LV_RANGE[c.lv]}）` : ''"
                @click="pickCell(c)" />
            </div>
          </div>
        </div>

        <div class="dz-legend">
          <span class="lvs">
            <span v-for="(n, i) in LV_NAME" :key="n" class="lv" :title="`${LV_DESC[i]}（${LV_RANGE[i]}）`">
              <span class="sw" :style="{ background: `var(--heat-${i})` }"></span>{{ n }}
            </span>
          </span>
          <span class="note">
            本年活跃日均 {{ (agg.W / Math.max(1, agg.act)).toFixed(1) }} 分 · <b>P90 = {{ agg.p90 }} 分</b>（P90 以上即「满格」档）<br>
            调出维度自 {{ stats.fullSince }} 起完整（新增 call 事件后）
          </span>
        </div>
      </template>
    </div>

    <DayDetail v-if="selDay" :stats="stats" :day="selDay" :events="events" :live-link="liveLink"
      @close="emit('update:selDay', null)" @open-log="(d) => emit('open-log', d)" />
  </section>
</template>
