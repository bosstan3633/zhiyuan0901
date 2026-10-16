<script setup lang="ts">
/**
 * W13-T6（2026-10-16 · D2/D4/F20~F23）PiYear —— 时间轴模块④ 全年 · YEAR（三段式）。
 *   ① #ins-year `.one-insight` 一句人话诊断条（F20：方向归属占比 × 冷却期高价值卡数，
 *      宿主推导传入；CTA `🔥 去下方唤醒 N 张核心卡 ›` 注入 focus='cooling' 并滚 #lc-sec）
 *   ② `.strip4` 四格（F21 归位版）：本年活跃 / 最长连续 / 活跃期资产 / 高价值冷却卡——
 *      原重复摆在 PiHero 的「本年活跃天数 / 最长连续天数」正式归位本段，全页仅此一处
 *   ③ 年度热力图（Heatmap：全年 53 周 / 近 26 周两态 + 图例；点格 → 该日战报）
 *      + `#lc-sec` 生命周期模块完整保留（D4/F23：LifecyclePanel 三态圆环 + Tab + 列表 + ⚙ 设置）
 *
 * ★W13-F21 退役带备案：原「累计 入台/调出/状态变更/清理」四格（cum 事件流口径）随
 *   F21 归位版定版退役——累计事件在页头「全部记录」抽屉按动作筛选全量可查。
 * ★W12-B3 终态化（T6）：四时间模块指标行全部落定 `.strip4`，`.pi-strip-row` 模板与
 *   CSS 双侧清零（迁移期双态结束）。
 */
import { computed } from 'vue'
import { yearAgg, longestStreak, type ConciseInsight } from '@/shared/utils/reviewReport'
import { lifecycleState } from '@/shared/utils/lifecycle'
import type { DailyStats } from '@/shared/utils/dailyStats'
import type { CardEvent } from '@/shared/utils/eventLog'
import Heatmap from '@/newtab/components/dashboard/Heatmap.vue'
import LifecyclePanel, { type LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'

const props = defineProps<{
  stats: DailyStats
  year: number
  selDay: string | null
  events: CardEvent[]
  liveLink: number
  lcCards: LifecycleCard[]
  /** 全量事件日志（累计口径，供热力图）；空日志回退由宿主处理 */
  allEvents: CardEvent[]
  /** F20 年度诊断条（★W13-T7 起注入宿主 buildConciseInsights 的 year 段，形状 = ConciseInsight） */
  insight: ConciseInsight
  /** F20 CTA 联动注入的生命周期 Tab（'cooling' 时 LifecyclePanel 自动切冷却期） */
  focusFilter?: 'active' | 'cooling' | 'archived'
}>()

const emit = defineEmits<{
  (e: 'update:year', y: number): void
  (e: 'update:selDay', d: string | null): void
  (e: 'open-battle', day: string): void
  /* ★W13-D5：原 open-review（ReviewPanel「目标对账」）随复盘弹窗退役——
     目标对账明细由 PiRhythm 战略目标点行（goal-week 抽屉）承接。 */
  (e: 'lc-locate', id: string, kind: LifecycleCard['kind']): void
  (e: 'lc-archive', id: string): void
  (e: 'lc-snooze', id: string): void
  (e: 'lc-reactivate', id: string): void
  (e: 'lc-set-days', id: string, days: number | null): void
  (e: 'lc-settings'): void
  /** F21 四格下钻：活跃期资产 → 全部卡片明细；高价值冷却 → 唤醒（滚 #lc-sec + 切冷却 Tab） */
  (e: 'drill', k: 'yr-assets' | 'yr-high'): void
  (e: 'insight-action', action: string): void
}>()

const ya = computed(() => yearAgg(props.stats, props.year))
const ls = computed(() => longestStreak(props.stats, props.year))
/* F21 另两格：活跃期资产 / 高价值冷却卡——与 LifecyclePanel 完全同源
   （lifecycleState 单一真源：含 per-card 自定义阈值与 snooze 覆盖，不自造 30/90 近似） */
const activeAssets = computed(() => props.lcCards.filter(c => lifecycleState(c) === 'active').length)
const highCooling = computed(() => props.lcCards.filter(c => lifecycleState(c) === 'cooling' && (c.callCount || 0) >= 3).length)
</script>

<template>
  <section class="pi-mod" id="mod-year">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-year">📅</span>
      <div class="pi-mod-t">
        <h2>这一年，你走过什么<span class="en">YEAR</span></h2>
        <p>全年尺度：诊断看方向、热力看分布、生命周期看流转。点任意一天 → 该日战报。</p>
      </div>
    </div>
    <div class="pi-mod-b">
      <!-- ① F20 年度诊断条 -->
      <div id="ins-year" class="one-insight" :class="insight.warn ? 'warn' : 'info'">
        <span class="oi-ic">{{ insight.warn ? '⚠️' : '💡' }}</span>
        <span class="oi-text" v-html="insight.html"></span>
        <button class="act-link" :title="insight.html" @click="emit('insight-action', insight.ctaAction)">
          {{ insight.ctaLabel }}
        </button>
      </div>

      <!-- ② F21 strip4 归位四格（原 PiHero 活跃/最长两枚迁入；累计四格退役） -->
      <div class="pi-strip">
        <span class="pi-strip-lab">本年</span>
        <div class="strip4">
          <span class="pi-chip" title="本年活跃天数 = 有加权动作的天数（热力图同口径）">
            <span class="v">{{ ya.act }}<small>天</small></span><span class="l">本年活跃</span>
          </span>
          <span class="pi-chip" title="最长连续天数 = 连续有动作的最长跨度">
            <span class="v">{{ ls }}<small>天</small></span><span class="l">最长连续</span>
          </span>
          <button class="pi-chip acc" title="活跃期资产 = 生命周期三态中处于活跃期的存活卡片" @click="emit('drill', 'yr-assets')">
            <span class="v">{{ activeAssets }}<small>张</small></span><span class="l">活跃期资产</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip warn" title="高价值冷却卡 = 冷却期中历史调用 ≥ 3 次的核心证据卡" @click="emit('drill', 'yr-high')">
            <span class="v">{{ highCooling }}<small>张</small></span><span class="l">高价值冷却卡</span><span class="ar">▸</span>
          </button>
        </div>
      </div>

      <div class="pi-hair"></div>

      <div>
        <div class="pi-sect"><span class="n">1</span><span class="t">年度热力图</span><span class="m">全年 53 周 / 近半年 26 周 · 点格 → 该日战报</span></div>
        <div class="pi-hmbox">
          <Heatmap :stats="stats" :year="year" :sel-day="selDay" :events="events" :live-link="liveLink"
            @update:year="emit('update:year', $event)" @update:sel-day="emit('update:selDay', $event)"
            @open-log="emit('open-battle', $event)" />
          <div class="pi-hm-legend">
            <span>少</span>
            <span class="s" style="background:var(--heat-0)"></span><span class="s" style="background:var(--heat-1)"></span>
            <span class="s" style="background:var(--heat-2)"></span><span class="s" style="background:var(--heat-3)"></span>
            <span class="s" style="background:var(--heat-4)"></span><span class="s" style="background:var(--heat-5)"></span>
            <span>多</span>
            <span class="hm-stats">活跃 <b>{{ ya.act }}</b> 天 · 最长连续 <b>{{ ls }}</b> 天<template v-if="ya.peak"> · 单日峰值 <b>{{ ya.peak[1] }}</b> 分（{{ ya.peak[0].slice(5) }}）</template></span>
          </div>
        </div>
      </div>

      <!-- D4/F23：生命周期完整保留（#lc-sec + #lifecycle 深链锚；focus 由诊断条 CTA 注入） -->
      <div id="lc-sec">
        <div class="pi-sect">
          <span class="n">2</span><span class="t">资源生命周期与高价值沉睡证据唤醒</span>
          <span class="m">活跃 / 冷却 / 归档 · 冷却态 🔥 核心卡置顶</span>
          <button class="pi-btn sm line" style="margin-left:auto" @click="emit('lc-settings')">⚙ 阈值设置</button>
        </div>
        <LifecyclePanel kind="all" :cards="lcCards" :focus="focusFilter"
          @locate="(id, kind) => emit('lc-locate', id, kind)"
          @archive="id => emit('lc-archive', id)"
          @snooze="id => emit('lc-snooze', id)"
          @reactivate="id => emit('lc-reactivate', id)"
          @set-days="(id, days) => emit('lc-set-days', id, days)" />
      </div>
    </div>
  </section>
</template>
