<script setup lang="ts">
/**
 * W13-T5（2026-10-16 · D2/F16~F19）PiMonth —— 时间轴模块③ 本月 · MONTH（三段式）。
 *   ① #ins-month 的统一 AI 周期复盘（未配置或失败时回落到本机事实基线）
 *      + 模块头「知识熵 X.X → Y.Y bit」变化徽标
 *   ② `.strip4` 四格：本月入池 / 本月调出 / 本月新增任务 / 入策展金字塔（F17 月度专属口径）
 *   ③ `.light-split` 双栏（拒绝克隆本周柱状图）：左 Top 3 输入主题 → 攻坚项目映射（F18）；
 *      右 `.funnel3` 捕捉入池 → 支撑任务 → 策展表达 三步转化漏斗（F19）
 *
 * ★W13-F17 退役带备案：与 PiRhythm 克隆的逐日柱状图（bars/open-battle）与 6 KPI
 *   （kpisOf 消费段，与 F13 的 PiRhythm k6 同批口径）整体退役——月度不再重复摆周度的读数。
 * props-only 红线（R172-9）：聚合全在宿主算好传入，本组件零扫 store。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import { windowOf, type ConciseInsight } from '@/shared/utils/reviewReport'
import { aggregateRange, type DailyStats } from '@/shared/utils/dailyStats'
import type { PeriodAiState } from '@/newtab/composables/usePeriodAiReview'
import type { PeriodReviewTarget } from '@/shared/utils/periodReview'
import PiAiReview from './PiAiReview.vue'

export interface MonthTopic { tag: string; n: number; project: string }

const props = defineProps<{
  stats: DailyStats
  /** ★W13-T7：诊断条改注入宿主 buildConciseInsights 的 month 段（形状 = ConciseInsight） */
  insight: ConciseInsight
  ai: PeriodAiState
  /** 知识熵变化（bit，1 位小数）：from=上月底快照口径 → to=当前全库 */
  ent: { from: number; to: number }
  topics: MonthTopic[]
  untagged: number
  funnel: { pool: number; support: number; curate: number; convPct: number; sinkPct: number }
  /** 策展金字塔现存量（全量口径，projection 表无时间戳，见宿主注释） */
  projected: number
}>()

const emit = defineEmits<{
  (e: 'drill', k: 'mo-add' | 'mo-call' | 'mo-support' | 'mo-curate'): void
  (e: 'topic', tag: string): void
  (e: 'ai-regenerate'): void
  (e: 'ai-navigate', target: PeriodReviewTarget): void
  (e: 'ai-configure'): void
}>()

/* ===== 窗口：本月（聚合由宿主与本组件双侧按同口径轻算，stats 为前缀和数据源） ===== */
const win = computed(() => windowOf('month', {}))
const agg = computed(() => aggregateRange(props.stats, win.value.s, win.value.e))
const cTotal = computed(() => agg.value.c.res + agg.value.c.curio + agg.value.c.task)
const taskCreated = computed(() => agg.value.c.task)

const entDelta = computed(() => Math.round((props.ent.to - props.ent.from) * 10) / 10)
const entState = computed(() => entDelta.value === 0 ? '持平' : entDelta.value > 0 ? '更发散' : '更聚焦')
const topicMax = computed(() => Math.max(1, ...props.topics.map(t => t.n)))
</script>
<template>
  <section class="pi-mod" id="mod-month">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-month"><Icon name="calendar" :size="13"/></span>
      <div class="pi-mod-t">
        <h2>这个月，走得怎样<span class="en">MONTH</span></h2>
        <p>主题看聚焦、漏斗看转化。读数口径月度专属，与本周段不重复。</p>
      </div>
      <div class="pi-mod-acts">
        <!-- F16：知识熵变化徽标 -->
        <span class="m-badge" :class="entDelta > 0 ? 'down' : entDelta < 0 ? 'up' : ''"
          :title="`上月底 ${ent.from} bit → 当前 ${ent.to} bit（香农熵：越低越聚焦）`">
          知识熵 {{ ent.from }} › {{ ent.to }} bit · {{ entState }}
        </span>
      </div>
    </div>
    <div class="pi-mod-b">
      <PiAiReview id="ins-month" :ai="props.ai" :fallback="props.insight"
        @regenerate="emit('ai-regenerate')" @navigate="emit('ai-navigate', $event)" @configure="emit('ai-configure')" />

      <!-- ② F17 strip4 月度专属四格 -->
      <div class="pi-strip">
        <span class="pi-strip-lab">本月</span>
        <div class="strip4">
          <button class="pi-chip up" title="本月入池 = 新增资源 + 好奇 + 任务卡" @click="emit('drill', 'mo-add')">
            <span class="v">{{ cTotal }}<small>张</small></span><span class="l">本月入池</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip" title="本月调出 = 窗口内卡片被打开次数" @click="emit('drill', 'mo-call')">
            <span class="v">{{ agg.u }}<small>次</small></span><span class="l">本月调出</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip acc" title="本月新增任务 = 本月新建的任务卡数量" @click="emit('drill', 'mo-add')">
            <span class="v">{{ taskCreated }}<small>张</small></span><span class="l">本月新增任务</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip warn" title="入策展金字塔 = 当前投射入策展台的卡片总数（全量现存量）" @click="emit('drill', 'mo-curate')">
            <span class="v">{{ projected }}<small>张</small></span><span class="l">入策展金字塔</span><span class="ar">▸</span>
          </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <!-- ③ light-split：左 Top 主题映射（F18） / 右 funnel3 漏斗（F19） -->
      <div class="light-split">
        <div class="lbox">
          <div class="lbox-h">
            <b>Top 输入主题 › 项目</b>
            <span>{{ untagged }} 张待打标 · 点行看该主题本月新卡</span>
          </div>
          <div v-if="topics.length" class="topic-rows">
            <button v-for="t in topics" :key="t.tag" class="topic-row" :title="`#${t.tag} 本月新增 ${t.n} 张 · 点行下钻`" @click="emit('topic', t.tag)">
              <span class="tg">#{{ t.tag }}</span>
              <span class="bar"><i :style="{ width: Math.round(t.n / topicMax * 100) + '%' }"></i></span>
              <span class="n"><b>{{ t.n }}</b> 张</span>
              <span class="pj">{{ t.project || '未映射' }}</span>
            </button>
          </div>
          <div v-else class="pi-empty">本月暂无带标签的新卡——先给采集的资源打上标签</div>
        </div>
        <div class="lbox">
          <div class="lbox-h"><b>认知流转三步</b><span>点任一步 › 对应明细</span></div>
          <div class="funnel3">
            <button class="fs" @click="emit('drill', 'mo-add')">
              <span class="st">①</span><b>捕捉入池</b>
              <span class="v">{{ funnel.pool }}<small>张</small></span>
              <span class="s">资源 + 好奇入池</span>
            </button>
            <span class="fa">›</span>
            <button class="fs" @click="emit('drill', 'mo-support')">
              <span class="st">②</span><b>支撑任务</b>
              <span class="v">{{ funnel.support }}<small>条</small></span>
              <span class="s">新支撑 + 完成 · 转化 {{ funnel.convPct }}%</span>
            </button>
            <span class="fa">›</span>
            <button class="fs" @click="emit('drill', 'mo-curate')">
              <span class="st">③</span><b>策展表达</b>
              <span class="v">{{ funnel.curate }}<small>张</small></span>
              <span class="s">新论点沉淀 · {{ funnel.sinkPct }}%</span>
            </button>
          </div>
          <div class="funnel-note">
            ① 本月新建资源+好奇 · ② 新增支撑链接+完成任务（转化 = 支撑 ÷ 入池资源）· ③ 新增论点卡（沉淀 = 论点 ÷ 入池）
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
