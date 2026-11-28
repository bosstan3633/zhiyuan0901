<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { DailyStats } from '@/shared/utils/dailyStats'
import { emptyDay, explainDayScore } from '@/shared/utils/dailyStats'
import type { CardEvent } from '@/shared/utils/eventLog'
import Heatmap from '@/newtab/components/dashboard/Heatmap.vue'
import { todayKey } from '@/shared/utils/reviewReport'

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
  (e: 'open-battle', day: string): void
}>()
const today = ref(todayKey())
let dayTimer = 0
onMounted(() => {
  dayTimer = window.setInterval(() => {
    const next = todayKey()
    if (next !== today.value) today.value = next
  }, 60_000)
})
onUnmounted(() => window.clearInterval(dayTimer))

const todayRec = computed(() => props.stats.days[today.value] || emptyDay())
const todayScore = computed(() => explainDayScore(todayRec.value, props.events, today.value))
const todayYear = computed(() => Number(today.value.slice(0, 4)))
const viewingCurrentYear = computed(() => props.year === todayYear.value)
const scoreItems = computed(() => todayScore.value.items.filter(item => item.count > 0 || item.points !== 0))
const hasScoredItems = computed(() => scoreItems.value.some(item => item.points !== 0))
const scoreDetail = computed(() => scoreItems.value.map(item => {
  const head = item.count > 0 ? `${item.label} ${item.count} 次` : item.label
  return item.points !== 0 ? `${head} +${formatPoints(item.points)}` : head
}).join(' + '))
const zeroScoreActionCount = computed(() => todayScore.value.zeroScoreCount)
const scoreRuleText = computed(() => {
  if (!scoreItems.value.length) return '今天还没有计分动作。'
  if (!hasScoredItems.value) {
    return zeroScoreActionCount.value > 0
      ? `今天有 ${zeroScoreActionCount.value} 件动作，但都属于不计分动作（子任务勾选 / 任务或好奇心回到待办 / 选题状态变更）。`
      : '今天有动作，但都属于不计分动作。'
  }
  return scoreDetail.value ? `${scoreDetail.value} = ${formatPoints(todayScore.value.total)} 分` : ''
})

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function onHeatmapSel(day: string | null): void {
  emit('update:selDay', day)
  if (day) emit('open-battle', day)
}
</script>
<template>
  <section class="pi-mod pi-annual-heatmap" aria-label="每日卡片行动热力图">
    <div class="pi-mod-b pi-heat-body">
      <div class="pi-hmbox">
        <Heatmap :stats="stats" :year="year" :sel-day="selDay" :events="events" :live-link="liveLink"
          default-expanded :show-summary="false" :show-legend-note="false" :show-export="false" :show-toggle="false" :section-number="1"
          @update:year="emit('update:year', $event)" @update:sel-day="onHeatmapSel" />
      </div>
      <div class="pi-hm-today" aria-label="今日得分计算说明">
        <template v-if="viewingCurrentYear">
          <div class="pi-hm-today-main">
            <span>今日（截至现在）</span>
            <strong>{{ formatPoints(todayScore.total) }} 分</strong>
            <span>· {{ todayScore.levelName }}（{{ todayScore.levelRange }}）</span>
            <span class="pi-hm-today-arrow">→</span>
            <span>热力第 {{ todayScore.level + 1 }}/6 档</span>
          </div>
          <div class="pi-hm-today-detail">{{ scoreRuleText }}</div>
          <div class="pi-hm-today-note">
            同卡同类动作每日只计一次 · 采集后 24 小时内删除按 0.3 计 · 删除 / 取消 / 子任务勾选 / 任务·好奇心回到待办 / 选题状态变更不加分 · 无每日封顶
          </div>
        </template>
        <template v-else>
          <div class="pi-hm-today-main">
            <span>当前查看 {{ year }} 年；今日 {{ formatPoints(todayScore.total) }} 分（{{ todayYear }} 年）</span>
            <button type="button" class="pi-hm-today-link" @click="emit('update:year', todayYear)">回到今年</button>
          </div>
        </template>
        <details class="pi-hm-rules">
          <summary>计分规则</summary>
          <div class="pi-hm-rules-grid">
            <span>采集：资源 1.0 / 好奇心 1.2 / 任务·选题 1.5</span>
            <span>调出任意卡：1.0 / 卡片修改：0.8 / 成果交付：3.0</span>
            <span>状态：好奇探索中 1.5 / 已求证 2.5 / 已搁置 0.5；任务进行中 1.5 / 已完成 3.0；选题状态 0</span>
            <span>今日三件事完成：2.5 / 任务↔资源关联：1.0 / 子任务勾选：0</span>
            <span>删除、取消、恢复、清理：0；同卡同类每日只计一次；采集 24 小时内删除 ×0.3</span>
            <span>日分为各项加权和，保留 1 位小数；不设每日上限。按本机现有记录计算，历史快照仅保留总分。</span>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pi-annual-heatmap { overflow: hidden; }
.pi-heat-body { gap: 8px; padding: 8px 18px 12px; }
.pi-hmbox .dz-sec-h { padding: 2px 0 6px; }
.pi-hmbox .dz-sec-b { padding: 0; }
.pi-hm-today {
  display: grid;
  gap: 3px;
  padding: 7px 2px 1px;
  border-top: 1px dashed var(--border);
}
.pi-hm-today-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  color: var(--text-2);
  font-size: var(--fs-caption);
}
.pi-hm-today-main strong {
  color: var(--text);
  font-size: var(--fs-sub);
  font-variant-numeric: tabular-nums;
}
.pi-hm-today-arrow { color: var(--text-4); }
.pi-hm-today-detail {
  color: var(--text-3);
  font-size: var(--fs-tiny);
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.pi-hm-today-note {
  color: var(--text-4);
  font-size: var(--fs-micro);
  line-height: 1.45;
}
.pi-hm-today-link {
  padding: 1px 4px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  background: none;
  color: var(--accent-ink);
  font: inherit;
  font-size: var(--fs-tiny);
  cursor: pointer;
}
.pi-hm-today-link:hover { border-color: var(--accent); }
.pi-hm-rules {
  color: var(--text-3);
  font-size: var(--fs-tiny);
}
.pi-hm-rules summary {
  width: fit-content;
  color: var(--text-3);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 2px;
}
.pi-hm-rules-grid {
  display: grid;
  gap: 4px 16px;
  margin-top: 5px;
  color: var(--text-4);
  font-size: var(--fs-micro);
  line-height: 1.55;
}
@media (min-width: 980px) {
  .pi-hm-rules-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
