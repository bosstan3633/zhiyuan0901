<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import { yearAgg, longestStreak } from '@/shared/utils/reviewReport'
import { lifecycleState } from '@/shared/utils/lifecycle'
import type { DailyStats } from '@/shared/utils/dailyStats'
import type { CardEvent } from '@/shared/utils/eventLog'
import Heatmap from '@/newtab/components/dashboard/Heatmap.vue'
import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'

const props = defineProps<{
  stats: DailyStats
  year: number
  selDay: string | null
  events: CardEvent[]
  liveLink: number
  lcCards: LifecycleCard[]
}>()
const emit = defineEmits<{
  (e: 'update:year', y: number): void
  (e: 'update:selDay', d: string | null): void
  (e: 'open-battle', day: string): void
  (e: 'drill', k: 'yr-active' | 'yr-streak' | 'yr-assets' | 'yr-high'): void
}>()
const ya = computed(() => yearAgg(props.stats, props.year))
const ls = computed(() => longestStreak(props.stats, props.year))
const activeAssets = computed(() => props.lcCards.filter(c => lifecycleState(c) === 'active').length)
const highCooling = computed(() => props.lcCards.filter(c => lifecycleState(c) === 'cooling' && (c.callCount || 0) >= 3).length)
function onHeatmapSel(day: string | null): void {
  emit('update:selDay', day)
  if (day) emit('open-battle', day)
}
</script>
<template>
  <section class="pi-mod pi-annual-heatmap" aria-label="每日卡片行动热力图">
    <div class="pi-mod-h">
      <span class="pi-mod-ico i-year"><Icon name="calendar" :size="13"/></span>
      <div class="pi-mod-t">
        <h2>每一天，卡片如何向前<span class="en">CARD RHYTHM</span></h2>
        <p>积累、调度、执行与成果交付共同形成热力；同一卡片同类行动当日只计一次。</p>
      </div>
    </div>
    <div class="pi-mod-b">
      <div class="pi-strip">
        <span class="pi-strip-lab">本年</span>
        <div class="strip4">
          <button class="pi-chip" title="有加权卡片行动的天数" @click="emit('drill', 'yr-active')"><span class="v">{{ ya.act }}<small>天</small></span><span class="l">本年活跃</span><span class="ar">▸</span></button>
          <button class="pi-chip" title="连续有卡片行动的最长跨度" @click="emit('drill', 'yr-streak')"><span class="v">{{ ls }}<small>天</small></span><span class="l">最长连续</span><span class="ar">▸</span></button>
          <button class="pi-chip acc" @click="emit('drill', 'yr-assets')"><span class="v">{{ activeAssets }}<small>张</small></span><span class="l">活跃期资产</span><span class="ar">▸</span></button>
          <button class="pi-chip warn" @click="emit('drill', 'yr-high')"><span class="v">{{ highCooling }}<small>张</small></span><span class="l">高价值冷却卡</span><span class="ar">▸</span></button>
        </div>
      </div>
      <div class="pi-hair"></div>
      <div class="pi-hmbox">
        <Heatmap :stats="stats" :year="year" :sel-day="selDay" :events="events" :live-link="liveLink"
          default-expanded :show-summary="false" :show-legend-note="false" :section-number="1"
          @update:year="emit('update:year', $event)" @update:sel-day="onHeatmapSel" />
        <div class="pi-hm-meta">
          <span>有效行动 <b>{{ ya.acts }}</b> 件</span>
          <template v-if="ya.peak"><span>单日峰值 <b>{{ ya.peak[1] }}</b> 分（{{ ya.peak[0].slice(5) }}）</span></template>
          <span>本年活跃日均 <b>{{ (ya.W / Math.max(1, ya.act)).toFixed(1) }}</b> 分</span>
          <span>P90 <b>{{ ya.p90 }}</b> 分</span>
          <span>调出完整自 <b>{{ stats.fullSince }}</b></span>
        </div>
      </div>
    </div>
  </section>
</template>
