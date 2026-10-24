<script setup lang="ts">
/**
 * W13-T4（2026-10-16 · 画像洞察极简认知版 D2/F12~F15）PiRhythm —— 三段式极简法则：
 *   ① #ins-week `.one-insight` 一句人话诊断条（F12：目标分布偏科 / 只推不调 两态 warn +
 *      常态——本周有效动作、调出、目标分布交叉推导，宿主或本组件内算均可，此处内算）
 *   ② `.strip4` 唯一一行 4 等宽胶囊：有效动作 / 加权得分 / 调出旧卡 / 节奏波动
 *      + 模块头「环比上周 ±X%」徽标（F13）
 *   ③ `.light-split` 左右双栏（F14/F15）：左 `.lbox` 7 日能量密度柱（点柱 → 该日战报）；
 *      右 `.lbox` 三大战略目标投入占比条（点行 → 该方向本周任务明细）
 *
 * ★W13-D2 三段式 + W13-F13 操作流退役带备案：`.pi-k6`（复盘 6 指标，同屏二次重复）与 `.pi-flow`
 *   （底部 50 条未按周过滤操作流）连同筛选行 `.pi-flowbar` 一并退役——
 *   操作流的全量能力在页头「全部记录」全页唯一入口（W12-B2），周维度明细走 F12/F13 下钻。
 *   「kpisOf 消费 W_ROWS」的口径关系随 k6 退役消解，W_ROWS 单一真源仍在 dailyStats.ts。
 *   偏离预警（runRules 8 规则）不属于重复读数，保留为独立分段。
 */
import Icon from '@/shared/components/Icon.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { computed, ref } from 'vue'
import {
  windowOf, prevWindow, pct,
  objectivesOf, runRules,
  type DirLike, type TaskLike, type ConciseInsight
} from '@/shared/utils/reviewReport'
import { aggregateRange, type DailyStats } from '@/shared/utils/dailyStats'

const props = defineProps<{
  stats: DailyStats
  directions: DirLike[]
  tasks: TaskLike[]
  errorCount: number
  /** ★W13-T7：诊断条改注入宿主 buildConciseInsights 的 week 段（形状 = ConciseInsight） */
  insight: ConciseInsight
}>()

const emit = defineEmits<{
  (e: 'open-err'): void
  (e: 'open-battle', day: string): void
  /** F13 定版四格：wk-add（采集）随格退役，收窄为 4 键 */
  (e: 'drill', k: 'wk-acts' | 'wk-w' | 'wk-call' | 'wk-pace'): void
  (e: 'goal-drill', dirId: string): void
  /** F12 诊断条动作分发（goal:<dirId> / lc / wk-acts） */
  (e: 'insight-action', action: string): void
  (e: 'ai-insight'): void
}>()

/* ===== 窗口固定为本周 ===== */
const win = computed(() => windowOf('week', {}))
const agg = computed(() => aggregateRange(props.stats, win.value.s, win.value.e))
const prevAgg = computed(() => {
  const prev = prevWindow(win.value)
  return aggregateRange(props.stats, prev.s, prev.e)
})
const deltaActs = computed(() => pct(agg.value.acts, prevAgg.value.acts))
function fmtPct(p: number | null): string { return p === null ? '—' : (p > 0 ? '+' : '') + p + '%' }

/* ===== 节奏波动 ===== */
const paceCv = computed(() => {
  const vals = agg.value.list.map(([, w]) => w).filter(w => w > 0)
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  if (!mean) return 0
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
  return Math.round(Math.sqrt(variance) / mean * 100)
})

/* ===== 7 日柱（F14：点柱 → openBattle(dayKey)） ===== */
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

/* ===== 战略目标投入（F15：三大 · 点行 → 目标明细） ===== */
const objectives = computed(() => objectivesOf(props.directions, props.tasks, win.value))
const goalRows = computed(() => objectives.value.rows.filter(r => r.v > 0 || r.focused).slice(0, 3))

/* ===== F12 一句人话诊断 =====
   ★W13-T7：原三态推导（weekInsight ~38 行，含目标偏科的具体方向名）上收宿主——
   四条诊断统一由宿主 reviewReport.buildConciseInsights 产出后经 insight prop 注入，
   本组件不再自算诊断文本（strip 四格 / 双栏数据仍在本组件自算，props-only 纪律不变）。 */

/* ===== 偏离预警（保留：确定性 8 规则，不属于重复读数） ===== */
const rules = computed(() => runRules(agg.value, { windowDays: win.value.days }))
const openRule = ref<string | null>(null)
function toggleRule(id: string) { openRule.value = openRule.value === id ? null : id }
</script>
<template>
  <section class="pi-mod" id="mod-recent">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-recent"><Icon name="target" :size="13"/></span>
      <div class="pi-mod-t">
        <h2>一周的节奏<span class="en">RHYTHM</span></h2>
        <p>柱看密度、目标看分布、预警看堆积。全量流水在页头「全部记录」，本段只看周维度。</p>
      </div>
      <div class="pi-mod-acts">
        <!-- F13：环比上周徽标上移模块头 -->
        <span class="wk-badge" :class="((deltaActs ?? 0) >= 0 ? 'up' : 'down')"
          :title="`等长窗口对比：本周有效动作 ${agg.acts} vs 上周 ${prevAgg.acts}`">
          环比上周 {{ fmtPct(deltaActs) }}
        </span>
        <button class="pi-btn sm line pi-ai-insight" title="AI 只续写本地已算好的事实；失败时保留本地诊断" @click="emit('ai-insight')">
          <AiEntryButton variant="inline" label="AI 续写" />
        </button>
        <button v-if="errorCount > 0" class="pi-btn sm line pi-btn-warn"
          @click="emit('open-err')"><Icon name="alert" :size="13"/> 错误 {{ errorCount }}</button>
      </div>
    </div>
    <div class="pi-mod-b">
      <!-- ① F12 诊断条 -->
      <div id="ins-week" class="one-insight" :class="insight.warn ? 'warn' : 'info'">
        <span class="oi-ic"><Icon v-if="insight.warn" name="warn" :size="15"/><Icon v-else name="bulb" :size="15"/></span>
        <span class="oi-text" v-html="insight.html"></span>
        <button class="act-link" :title="insight.html" @click="emit('insight-action', insight.ctaAction)">
          {{ insight.ctaLabel }}
        </button>
      </div>

      <!-- ② F13 strip4 四格（采集格随 wk-add 退役） -->
      <div class="pi-strip">
        <span class="pi-strip-lab">本周</span>
        <div class="strip4">
          <button class="pi-chip" title="有效动作 = 采集 + 调出 + 状态变更 + 推进" @click="emit('drill', 'wk-acts')">
            <span class="v">{{ agg.acts }}<small>件</small></span><span class="l">有效动作</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip acc" title="加权得分 = 按动作权重加总" @click="emit('drill', 'wk-w')">
            <span class="v">{{ Math.round(agg.W) }}<small>分</small></span><span class="l">加权得分</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip" title="调出旧卡 = 窗口内卡片被打开次数" @click="emit('drill', 'wk-call')">
            <span class="v">{{ agg.u }}<small>次</small></span><span class="l">调出旧卡</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip warn" title="节奏波动 = 有动作日加权分的变异系数" @click="emit('drill', 'wk-pace')">
            <span class="v">±{{ paceCv }}<small>%</small></span><span class="l">节奏波动</span><span class="ar">▸</span>
          </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <!-- ③ F14/F15 light-split 左右双栏 -->
      <div class="light-split">
        <div class="lbox">
          <div class="lbox-h"><b>能量密度</b><span>加权分 · 点柱 › 该日战报</span></div>
          <div class="pi-bars">
            <div v-for="b in bars" :key="b.key" class="b" v-pressable :class="'l' + b.lv"
              :style="{ height: Math.max(4, b.w / barMax * 100) + '%', background: b.lv > 0 ? 'var(--heat-' + b.lv + ')' : 'var(--surface-3)' }"
              :title="b.label + ' · 加权 ' + b.w + ' 分'" @click="emit('open-battle', b.key)"></div>
          </div>
          <div class="pi-bars-x">
            <span v-for="i in [0, Math.floor(bars.length * .17), Math.floor(bars.length * .34), Math.floor(bars.length * .5), Math.floor(bars.length * .67), Math.floor(bars.length * .84), bars.length - 1].filter((v, j, a) => v >= 0 && v < bars.length && a.indexOf(v) === j)" :key="i">{{ bars[i]?.label }}</span>
          </div>
        </div>
        <div class="lbox">
          <div class="lbox-h"><b>战略目标投入</b><span>本周新建 ∪ 完成 · 点行 › 任务明细</span></div>
          <div v-if="goalRows.length" class="pi-goals">
            <button v-for="g in goalRows" :key="g.id" class="pi-goal" @click="emit('goal-drill', g.id)">
              <span class="nm"><Icon v-if="g.focused" name="main-focus" :size="12"/> {{ g.name }}</span>
              <span class="gbar"><i :style="{ width: Math.round(g.share * 100) + '%' }"></i></span>
              <span class="n"><b>{{ g.v }}</b> 项 · {{ Math.round(g.share * 100) }}%</span>
            </button>
            <div v-if="objectives.unassigned" class="pi-obj-note">
              另有 {{ objectives.unassigned }} 项未归属方向（共 {{ objectives.total }} 项产出）
            </div>
          </div>
          <div v-else class="pi-empty">本周暂无归属到方向的产出任务</div>
        </div>
      </div>

      <!-- ★A2（V3.8.36）规则对照（原名「偏离预警」）：与重复读数无关的确定性规则清单，保留。
           ★A2 修法一（措辞）：「预警」是评价式判断，等于替用户宣布「你偏离了」；A2 原文要求
           「删除任何『值得警惕』式视觉」。改为「规则对照」——只陈述「哪条规则的实测值与阈值不同」，
           是事实不是评判，好坏判断留给用户。
           ★A2 修法二（类名）：原 `:class="{ warn: openRule !== r.id }"` 的 warn 表达的是
           **未展开态**，与「有警告」毫无关系，纯属借用警告语义（A2 的镜子不许带鞭子）。
           改 `collapsed` 后语义自洽，也让本判据能负锚「此处不许再出现 warn 类」。 -->
      <div v-if="rules.length">
        <div class="pi-sect"><span class="n">2</span><span class="t">规则对照</span><span class="m">{{ rules.length }} 条命中 · 点规则看阈值与实测</span></div>
        <div class="pi-rule-list">
          <button v-for="r in rules" :key="r.id" class="pi-chip pi-rule-card"
            :class="{ collapsed: openRule !== r.id }" @click="toggleRule(r.id)">
            <span class="pi-rule-head">
              <span class="v pi-rule-id">{{ r.id }} {{ r.name }}</span>
              <span class="l pi-rule-text">{{ r.text }}</span>
              <span class="ar">▸</span>
            </span>
            <span v-if="openRule === r.id" class="pi-rule-body">
              阈值：{{ r.thr }}<br>实测：{{ r.act }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
