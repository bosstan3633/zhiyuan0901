<script setup lang="ts">
/**
 * V3.8.20（用户拍板 2026-10-15）PiMonth —— 时间轴模块③ 本月 · MONTH（轻量月度段）。
 * 病根＝原先月度窗口只是 PiRhythm 里的一个 w/m/y 切换档，rail 上没有落点、
 * 页面上没有独立段 —— 「本月」这个最自然的复盘尺度反而要读者自己记得去点切换。
 * 本段为**轻量**承接（不是把 PiRhythm 复制一份）：
 *   strip = 本月 5 枚速览 chip（采集/有效动作/加权/调出/节奏波动）
 *   节奏曲线 = 本月逐日加权分柱状图；点柱 → 该日战报
 *   6 KPI 格 + 环比（与 PiRhythm 同口径 kpisOf / prevWindow）
 *   目标 / 预警 / 操作流**不重复**——那三样留在 PiRhythm（本周段），页面 3 段 → 4 段不注水。
 * props-only：聚合全在组件内按月窗口算（与 PiToday/PiRhythm/PiYear 同一性能红线）。
 */
import { computed } from 'vue'
import {
  windowOf, prevWindow, pct,
  kpisOf
} from '@/shared/utils/reviewReport'
import { aggregateRange, type DailyStats } from '@/shared/utils/dailyStats'

/* props-only：只吃 stats（R172-9 性能红线同款）；聚合全在组件内按月窗口算。
   events/year/directions/tasks 不进本段 —— 目标对账与操作流留在本周段与全年段，
   月度不重复摆（轻量段的"轻"就是砍这些）。 */
const props = defineProps<{
  stats: DailyStats
}>()

const emit = defineEmits<{
  (e: 'open-battle', day: string): void
  (e: 'drill', k: 'mo-add' | 'mo-acts' | 'mo-w' | 'mo-call' | 'mo-pace'): void
}>()

/* ===== 窗口固定为本月 ===== */
const win = computed(() => windowOf('month', {}))

const agg = computed(() => aggregateRange(props.stats, win.value.s, win.value.e))
const prevAgg = computed(() => {
  const prev = prevWindow(win.value)
  return aggregateRange(props.stats, prev.s, prev.e)
})

/* ===== strip ===== */
const cTotal = computed(() => agg.value.c.res + agg.value.c.curio + agg.value.c.task)
const paceCv = computed(() => {
  const vals = agg.value.list.map(([, w]) => w).filter(w => w > 0)
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  if (!mean) return 0
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
  return Math.round(Math.sqrt(variance) / mean * 100)
})

/* ===== 6 KPI + 环比（与 PiRhythm 同口径） ===== */
const kpis = computed(() => kpisOf(agg.value))
const deltaActs = computed(() => pct(agg.value.acts, prevAgg.value.acts))
const deltaW = computed(() => pct(agg.value.W, prevAgg.value.W))
function fmtPct(p: number | null): string { return p === null ? '—' : (p > 0 ? '+' : '') + p + '%' }

/* ===== 节奏曲线（本月逐日） ===== */
interface Bar { key: string; w: number; lv: number; label: string }
function level(w: number, max: number): number {
  if (w <= 0) return 0
  const r = w / max
  return r > .8 ? 5 : r > .6 ? 4 : r > .4 ? 3 : r > .2 ? 2 : 1
}
const bars = computed<Bar[]>(() => {
  const out: Bar[] = []
  const start = new Date(win.value.s.replace(/-/g, '/'))
  const end = new Date(win.value.e.replace(/-/g, '/'))
  const wMap = new Map(agg.value.list)
  const maxW = Math.max(1, ...agg.value.list.map(([, w]) => w))
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const w = wMap.get(key) || 0
    out.push({ key, w, lv: level(w, maxW), label: `${d.getMonth() + 1}/${d.getDate()}` })
    if (out.length >= 62) break
  }
  return out
})
const barMax = computed(() => Math.max(1, ...bars.value.map(b => b.w)))
</script>
<template>
  <section class="pi-mod" id="mod-month">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-month">🗓</span>
      <div class="pi-mod-t">
        <h2>这个月，走得怎样<span class="en">MONTH</span></h2>
        <p>本月逐日密度、5 枚速览、6 项复盘指标与环比。目标对账与偏离预警在本周段与全年段，不在此重复。</p>
      </div>
    </div>
    <div class="pi-mod-b">
      <div class="pi-strip">
        <span class="pi-strip-lab">本月</span>
        <div class="pi-strip-row">
        <button class="pi-chip up" title="本月采集合计" @click="emit('drill', 'mo-add')">
          <span class="v">{{ cTotal }}<small>张</small></span><span class="l">采集</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip" title="有效动作 = 采集 + 调出 + 状态变更 + 推进" @click="emit('drill', 'mo-acts')">
          <span class="v">{{ agg.acts }}<small>件</small></span><span class="l">有效动作</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip acc" title="加权分 = 按动作权重加总" @click="emit('drill', 'mo-w')">
          <span class="v">{{ Math.round(agg.W) }}<small>分</small></span><span class="l">加权</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip" title="本月卡片被打开次数" @click="emit('drill', 'mo-call')">
          <span class="v">{{ agg.u }}<small>次</small></span><span class="l">调出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip warn" title="节奏波动 = 有动作日加权分的变异系数" @click="emit('drill', 'mo-pace')">
          <span class="v">±{{ paceCv }}<small>%</small></span><span class="l">节奏波动</span><span class="ar">▸</span>
        </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <div>
        <div class="pi-sect"><span class="n">1</span><span class="t">节奏曲线</span><span class="m">加权分 · 点柱 → 该日战报</span></div>
        <div class="pi-bars">
          <div v-for="b in bars" :key="b.key" class="b" :class="'l' + b.lv"
            :style="{ height: Math.max(4, b.w / barMax * 100) + '%', background: b.lv > 0 ? 'var(--heat-' + b.lv + ')' : 'var(--surface-3)' }"
            :title="b.label + ' · 加权 ' + b.w + ' 分'" @click="emit('open-battle', b.key)"></div>
        </div>
        <div class="pi-bars-x">
          <span v-for="i in [0, Math.floor(bars.length * .17), Math.floor(bars.length * .34), Math.floor(bars.length * .5), Math.floor(bars.length * .67), Math.floor(bars.length * .84), bars.length - 1].filter((v, j, a) => v >= 0 && v < bars.length && a.indexOf(v) === j)" :key="i">{{ bars[i]?.label }}</span>
        </div>
      </div>

      <div>
        <div class="pi-sect"><span class="n">2</span><span class="t">复盘 6 指标</span><span class="m">与复盘段同口径 · 点指标 → 明细</span></div>
        <div class="pi-k6">
          <button v-for="k in kpis" :key="k.key" class="k" :title="k.note" @click="emit('drill', k.key === 'create' ? 'mo-add' : k.key === 'call' ? 'mo-call' : k.key === 'acts' ? 'mo-acts' : 'mo-w')">
            <div class="lab">{{ k.label }}</div>
            <div class="v">{{ k.v.toLocaleString() }}<small style="font-size:var(--fs-micro);font-weight:600;color:var(--text-3);margin-left:1px">{{ k.unit }}</small></div>
            <div class="note">{{ k.note }}</div>
          </button>
        </div>
        <div style="font-size:var(--fs-micro);color:var(--text-4);margin-top:6px">
          环比：有效动作 <span :style="{ color: (deltaActs ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }">{{ fmtPct(deltaActs) }}</span>
          · 加权 <span :style="{ color: (deltaW ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }">{{ fmtPct(deltaW) }}</span>
          （等长窗口对比）
        </div>
      </div>
    </div>
  </section>
</template>
