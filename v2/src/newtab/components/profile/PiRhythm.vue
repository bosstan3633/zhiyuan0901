<script setup lang="ts">
/**
 * W10（V3.9.0）PiRhythm —— 时间轴模块② 近期 · WEEK。
 * 口径（v6 原型 §mod-recent + D1/D3 决策）：
 *   strip = 当前窗口 5 枚速览 chip（采集/有效动作/加权/调出/节奏波动）
 *   6 KPI 格 = 复盘段真实 kpisOf() 六枚（替代 v6 原型的假「六维学习力」，D1）
 *   节奏曲线 = 当前窗口逐日/逐月加权分柱状图；点柱 → 该日战报
 *   目标进度 = objectivesOf()（方向对账，D3 保持既有下钻）
 *   偏离预警 = runRules() 8 规则（确定性、非 AI）
 *   操作流 = 最近事件时间线（T5：原 section④ 并入本段）
 * range 状态内持；窗口/聚合/KPI/目标/规则全部内算，宿主只传原始数据。
 */
import { computed, ref } from 'vue'
import {
  windowOf, prevWindow, pct,
  kpisOf, objectivesOf, runRules,
  type RangeType, type DirLike, type TaskLike
} from '@/shared/utils/reviewReport'
import { aggregateRange, type DailyStats } from '@/shared/utils/dailyStats'
import type { CardEvent } from '@/shared/utils/eventLog'

const props = defineProps<{
  stats: DailyStats
  events: CardEvent[]
  directions: DirLike[]
  tasks: TaskLike[]
  errorCount: number
  year: number
}>()

const emit = defineEmits<{
  (e: 'open-review'): void
  /* ★W12-B：open-log 已随模块内那枚「全部记录 ›」一并退役（入口上提页头），
     声明不留——留着就是没人 emit 的死通道，仓库纪律「函数无消费方 = 能力已丢」的反面：留声明只会骗人。 */
  (e: 'open-err'): void
  (e: 'open-battle', day: string): void
  (e: 'drill', k: 'wk-add' | 'wk-acts' | 'wk-w' | 'wk-call' | 'wk-pace'): void
  (e: 'goal-drill', dirId: string): void
  (e: 'locate', cardId: string): void
}>()

/* ===== 范围切换 ===== */
const range = ref<'w' | 'm' | 'y'>('w')
const rt = computed<RangeType>(() => range.value === 'w' ? 'week' : range.value === 'm' ? 'month' : 'custom')

const win = computed(() => {
  if (range.value === 'y') {
    const y = props.year
    const t = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = `${y}-01-01`
    const to = `${y}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
    const days = Math.max(1, Math.round((new Date(to.replace(/-/g, '/')).getTime() - new Date(from.replace(/-/g, '/')).getTime()) / 86400000) + 1)
    return { s: from, e: to, label: `${y} 年初 → 今天`, days }
  }
  return windowOf(rt.value, {})
})

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

/* ===== 6 KPI（真实口径，D1 替代假六维） ===== */
const kpis = computed(() => kpisOf(agg.value))
const deltaActs = computed(() => pct(agg.value.acts, prevAgg.value.acts))
const deltaW = computed(() => pct(agg.value.W, prevAgg.value.W))
function fmtPct(p: number | null): string { return p === null ? '—' : (p > 0 ? '+' : '') + p + '%' }

/* ===== 节奏曲线 ===== */
interface Bar { key: string; w: number; lv: number; label: string }
function level(w: number, max: number): number {
  if (w <= 0) return 0
  const r = w / max
  return r > .8 ? 5 : r > .6 ? 4 : r > .4 ? 3 : r > .2 ? 2 : 1
}
const bars = computed<Bar[]>(() => {
  const out: Bar[] = []
  if (range.value === 'y') {
    const byMonth = new Map<string, number>()
    for (const [d, w] of agg.value.list) {
      const m = d.slice(0, 7)
      byMonth.set(m, (byMonth.get(m) || 0) + w)
    }
    const maxM = Math.max(1, ...byMonth.values())
    for (let m = 1; m <= 12; m++) {
      const key = `${props.year}-${String(m).padStart(2, '0')}`
      const w = Math.round((byMonth.get(key) || 0) * 10) / 10
      out.push({ key, w, lv: level(w, maxM), label: `${m}月` })
    }
    return out
  }
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

/* ===== 目标进度 ===== */
const objectives = computed(() => objectivesOf(props.directions, props.tasks, win.value))
const goalRows = computed(() => objectives.value.rows.filter(r => r.v > 0 || r.focused).slice(0, 6))

/* ===== 偏离预警 ===== */
const rules = computed(() => runRules(agg.value, { windowDays: win.value.days }))
const openRule = ref<string | null>(null)
function toggleRule(id: string) { openRule.value = openRule.value === id ? null : id }

/* ===== 操作流（T5 并入） ===== */
const flowFilter = ref<'all' | 'create' | 'call' | 'status' | 'delete'>('all')
const FLOW_CAP = 50
const flowRows = computed(() => {
  const rows = flowFilter.value === 'all' ? props.events : props.events.filter(e => e.action === flowFilter.value)
  return rows.slice(0, FLOW_CAP)
})
function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
function actionCls(a: CardEvent['action']): string {
  return a === 'create' ? 'pi-ac-create' : a === 'call' ? 'pi-ac-call'
    : a === 'status' ? 'pi-ac-status' : a === 'restore' ? 'pi-ac-restore' : 'pi-ac-delete'
}
function actionLbl(a: CardEvent['action']): string {
  return a === 'create' ? '新增' : a === 'call' ? '调出' : a === 'delete' ? '删除'
    : a === 'restore' ? '恢复' : a === 'status' ? '状态' : '永久删除'
}
function kindLbl(k: CardEvent['kind']): string {
  return k === 'resource' ? '资源' : k === 'task' ? '任务' : k === 'curiosity' ? '好奇' : '系统'
}
</script>
<template>
  <section class="pi-mod" id="mod-recent">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-recent">🎯</span>
      <div class="pi-mod-t">
        <h2>一周的节奏<span class="en">RHYTHM</span></h2>
        <p>柱看密度、KPI 看均衡、目标看进度、预警看堆积。操作流与错误日志也在本段，不再单独成段。</p>
      </div>
      <div class="pi-mod-acts">
        <div class="pi-seg">
          <button :class="{ on: range === 'w' }" @click="range = 'w'">本周</button>
          <button :class="{ on: range === 'm' }" @click="range = 'm'">本月</button>
          <button :class="{ on: range === 'y' }" @click="range = 'y'">今年</button>
        </div>
        <button class="pi-btn line" @click="emit('open-review')">📈 周/月复盘</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <div class="pi-strip">
        <span class="pi-strip-lab">{{ range === 'w' ? '本周' : range === 'm' ? '本月' : '今年' }}</span>
        <div class="pi-strip-row">
        <button class="pi-chip up" title="窗口内采集合计" @click="emit('drill', 'wk-add')">
          <span class="v">{{ cTotal }}<small>张</small></span><span class="l">采集</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip" title="有效动作 = 采集 + 调出 + 状态变更 + 推进" @click="emit('drill', 'wk-acts')">
          <span class="v">{{ agg.acts }}<small>件</small></span><span class="l">有效动作</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip acc" title="加权分 = 按动作权重加总" @click="emit('drill', 'wk-w')">
          <span class="v">{{ Math.round(agg.W) }}<small>分</small></span><span class="l">加权</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip" title="窗口内卡片被打开次数" @click="emit('drill', 'wk-call')">
          <span class="v">{{ agg.u }}<small>次</small></span><span class="l">调出</span><span class="ar">▸</span>
        </button>
        <button class="pi-chip warn" title="节奏波动 = 有动作日加权分的变异系数" @click="emit('drill', 'wk-pace')">
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
          <button v-for="k in kpis" :key="k.key" class="k" :title="k.note" @click="emit('drill', k.key === 'create' ? 'wk-add' : k.key === 'call' ? 'wk-call' : k.key === 'acts' ? 'wk-acts' : 'wk-w')">
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

      <div v-if="goalRows.length">
        <div class="pi-sect"><span class="n">3</span><span class="t">目标进度</span><span class="m">窗口内新建 ∪ 完成的任务 · 点条 → 该方向产出</span></div>
        <div class="pi-goals">
          <button v-for="g in goalRows" :key="g.id" class="pi-goal" @click="emit('goal-drill', g.id)">
            <span class="nm">{{ g.focused ? '🚀 ' : '' }}{{ g.name }}</span>
            <span class="gbar"><i :style="{ width: Math.round(g.share * 100) + '%' }"></i></span>
            <span class="n"><b>{{ g.v }}</b> 项 · {{ Math.round(g.share * 100) }}%</span>
          </button>
          <div v-if="objectives.unassigned" style="font-size:var(--fs-caption);color:var(--text-4)">
            另有 {{ objectives.unassigned }} 项未归属方向（共 {{ objectives.total }} 项产出）
          </div>
        </div>
      </div>

      <div v-if="rules.length">
        <div class="pi-sect"><span class="n">4</span><span class="t">偏离预警</span><span class="m">{{ rules.length }} 条命中 · 点规则看阈值与实测</span></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button v-for="r in rules" :key="r.id" class="pi-chip" style="height:auto;padding:8px 14px;border-radius:var(--radius-md);align-items:flex-start;flex-direction:column;gap:3px;width:100%;text-align:left"
            :class="{ warn: openRule !== r.id }" @click="toggleRule(r.id)">
            <span style="display:flex;align-items:center;gap:8px;width:100%">
              <span class="v" style="font-size:var(--fs-sub)">{{ r.id }} {{ r.name }}</span>
              <span class="l" style="flex:1">{{ r.text }}</span>
              <span class="ar">▸</span>
            </span>
            <span v-if="openRule === r.id" style="font-size:var(--fs-caption);color:var(--text-3);line-height:1.7;padding-left:2px">
              阈值：{{ r.thr }}<br>实测：{{ r.act }}
            </span>
          </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <div>
        <div class="pi-sect"><span class="n">5</span><span class="t">操作流</span><span class="m">单击定位 · 最近 {{ FLOW_CAP }} 条</span></div>
        <div class="pi-flowbar">
          <div class="pi-seg">
            <button :class="{ on: flowFilter === 'all' }" @click="flowFilter = 'all'">全部</button>
            <button :class="{ on: flowFilter === 'create' }" @click="flowFilter = 'create'">录入</button>
            <button :class="{ on: flowFilter === 'call' }" @click="flowFilter = 'call'">调用</button>
            <button :class="{ on: flowFilter === 'status' }" @click="flowFilter = 'status'">状态</button>
            <button :class="{ on: flowFilter === 'delete' }" @click="flowFilter = 'delete'">删除</button>
          </div>
          <span style="flex:1"></span>
          <button v-if="errorCount > 0" class="pi-btn sm line" style="color:var(--warning)" @click="emit('open-err')">🚨 错误 {{ errorCount }}</button>
          <!-- ★W12-B：这枚「全部记录 ›」按用户 2026-10-13 拍板收掉——页头已有全页唯一入口，
               近期模块这一枚是重复入口（且它躺在「操作流」分段头里，与那段流水的语义不符）。 -->
        </div>
        <div class="pi-flow">
          <button v-for="e in flowRows" :key="e.id" class="pi-frow" :title="'单击定位卡片'" @click="emit('locate', e.cardId)">
            <span class="tm">{{ fmtTime(e.ts) }}</span>
            <span class="ac" :class="actionCls(e.action)">{{ actionLbl(e.action) }}</span>
            <span class="ti">{{ e.title }}</span>
            <span class="kd">{{ kindLbl(e.kind) }}</span>
          </button>
          <div v-if="!flowRows.length" class="pi-empty">该筛选下暂无记录</div>
        </div>
        <div style="font-size:var(--fs-micro);color:var(--text-4);margin-top:9px;line-height:1.7">操作流仅保留最近 {{ FLOW_CAP }} 条，更早的记录在「全部记录」抽屉按日检索。</div>
      </div>
    </div>
  </section>
</template>