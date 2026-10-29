<script setup lang="ts">
/**
 * W13-T6（2026-10-16 · D2/D4/F20~F23）PiYear —— 时间轴模块④ 全年 · YEAR（三段式）。
 *   ① `.strip4` 四格（F21 归位版）：本年活跃 / 最长连续 / 活跃期资产 / 高价值冷却卡——
 *      原重复摆在 PiHero 的「本年活跃天数 / 最长连续天数」正式归位本段，全页仅此一处
 *   ② 年度热力图（Heatmap：全年 12 个自然月分组 / 近 26 周两态 + 图例；点格 → 该日战报）
 *      + `#lc-sec` 生命周期模块完整保留（D4/F23：LifecyclePanel 三态圆环 + Tab + 列表 + ⚙ 设置）
 *   ③ 四格全部可下钻：日期型给日级明细，资产型给真实卡片清单。
 *
 * ★W13-F21 退役带备案：原「累计 入台/调出/状态变更/清理」四格（cum 事件流口径）随
 *   F21 归位版定版退役——累计事件在页头「全部记录」抽屉按动作筛选全量可查。
 * ★W12-B3 终态化（T6）：四时间模块指标行全部落定 `.strip4`，`.pi-strip-row` 模板与
 *   CSS 双侧清零（迁移期双态结束）。
 */
import Icon from '@/shared/components/Icon.vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import { computed } from 'vue'
import { yearAgg, longestStreak } from '@/shared/utils/reviewReport'
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
  /** F21 四格下钻：日期型给日级明细，资产型给真实卡片清单。 */
  (e: 'drill', k: 'yr-active' | 'yr-streak' | 'yr-assets' | 'yr-high'): void
  (e: 'ai-insight'): void
}>()

const ya = computed(() => yearAgg(props.stats, props.year))
const ls = computed(() => longestStreak(props.stats, props.year))
/* F21 另两格：活跃期资产 / 高价值冷却卡——与 LifecyclePanel 完全同源
   （lifecycleState 单一真源：含 per-card 自定义阈值与 snooze 覆盖，不自造 30/90 近似） */
const activeAssets = computed(() => props.lcCards.filter(c => lifecycleState(c) === 'active').length)
const highCooling = computed(() => props.lcCards.filter(c => lifecycleState(c) === 'cooling' && (c.callCount || 0) >= 3).length)

/** 年度视图里热力格是「当日战报」的直接入口：先保留选中描边，再打开该日战报。 */
function onHeatmapSel(day: string | null): void {
  emit('update:selDay', day)
  if (day) emit('open-battle', day)
}
</script>

<template>
  <section class="pi-mod" id="mod-year">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-year"><Icon name="calendar" :size="13"/></span>
      <div class="pi-mod-t">
        <h2>这一年，你走过什么<span class="en">YEAR</span></h2>
        <p>全年尺度：诊断看方向、热力看分布、生命周期看流转。点任意一天 › 该日战报。</p>
      </div>
      <!-- ★V3.9.27：年度页头不再重复「本年活跃 N 天」。
           strip4 是该段唯一指标入口，热力图内部摘要同时关闭，避免同一读数在首屏出现三次。

           ★★坑（V3.8.35 实测踩到，代价很大）：本段注释第一版里写了带反引号的类名，而下面节点自身的 title
           又含模板字符串反引号。Vue 的 template 解析按 HTML 注释规则走，注释一旦被判成未正常闭合，
           后面整段模板（含本枚徽标与整个段体）都被降级成注释文本丢弃。症状极具欺骗性——源码在位、
           vue-tsc 绿、build 绿、regression 也全绿（判据读的是源码不是产物），只有实拍 DOM 才看得出段头右缘仍然是空的。
           纪律：模板区注释里一律不写反引号，更不要把 title 的模板字符串搬进注释。 -->
      <div class="pi-mod-acts">
        <button class="pi-btn sm line pi-ai-insight" title="AI 只续写本地已算好的事实；失败时保留本地诊断" @click="emit('ai-insight')">
          <AiEntryButton variant="inline" label="AI 续写" />
        </button>
      </div>
    </div>
    <div class="pi-mod-b">
      <!-- ① F21 strip4 归位四格（原 PiHero 活跃/最长两枚迁入；累计四格退役） -->
      <div class="pi-strip">
        <span class="pi-strip-lab">本年</span>
        <div class="strip4">
          <button class="pi-chip" title="本年活跃天数 = 有加权动作的天数（热力图同口径）；点开看逐日明细" @click="emit('drill', 'yr-active')">
            <span class="v">{{ ya.act }}<small>天</small></span><span class="l">本年活跃</span><span class="ar">▸</span>
          </button>
          <button class="pi-chip" title="最长连续天数 = 连续有动作的最长跨度；点开看连续日期" @click="emit('drill', 'yr-streak')">
            <span class="v">{{ ls }}<small>天</small></span><span class="l">最长连续</span><span class="ar">▸</span>
          </button>
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
        <div class="pi-hmbox">
          <Heatmap :stats="stats" :year="year" :sel-day="selDay" :events="events" :live-link="liveLink"
            default-expanded :show-summary="false" :show-legend-note="false" :section-number="1"
            @update:year="emit('update:year', $event)" @update:sel-day="onHeatmapSel" />
          <div class="pi-hm-meta">
            <span>有效动作 <b>{{ ya.acts }}</b> 件</span>
            <template v-if="ya.peak"><span>单日峰值 <b>{{ ya.peak[1] }}</b> 分（{{ ya.peak[0].slice(5) }}）</span></template>
            <span>本年活跃日均 <b>{{ (ya.W / Math.max(1, ya.act)).toFixed(1) }}</b> 分</span>
            <span>P90 <b>{{ ya.p90 }}</b> 分</span>
            <span title="调出维度从该日期起具备完整事件记录">调出完整自 <b>{{ stats.fullSince }}</b></span>
          </div>
        </div>
      </div>

      <!-- D4/F23：生命周期完整保留（#lc-sec + #lifecycle 深链锚；focus 由诊断条 CTA 注入） -->
      <div id="lc-sec">
        <div class="pi-sect">
          <span class="n">2</span><span class="t">资源生命周期与高价值沉睡证据唤醒</span>
          <span class="m">活跃 / 冷却 / 归档 · 冷却态 <Icon name="flame" :size="13"/> 核心卡置顶</span>
          <button class="pi-btn sm line pi-lc-settings" @click="emit('lc-settings')"><Icon name="settings" :size="13"/> 阈值设置</button>
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
