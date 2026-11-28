<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import type { DailyStats } from '@/shared/utils/dailyStats'
import { longestStreak, yearAgg } from '@/shared/utils/reviewReport'
import type { CardAnalysisModel } from '@/newtab/views/useCardAnalysis'

const props = defineProps<{
  analysis: CardAnalysisModel
  stats: DailyStats
  year: number
  entropy: number
  todayImport: number
}>()

const emit = defineEmits<{
  (e: 'drill', key: 'all' | 'effective-support' | 'focus' | 'yr-active' | 'yr-streak' | 'yr-high'): void
  (e: 'tag'): void
  (e: 'month-added', scope: 'month' | 'import'): void
}>()

const ya = computed(() => yearAgg(props.stats, props.year))
const streak = computed(() => longestStreak(props.stats, props.year))
const total = computed(() => props.analysis.inventory.total)
const kinds = computed(() => props.analysis.inventory.counts)
const topTags = computed(() => props.analysis.inventory.tagDistribution.slice(0, 4))

const composition = computed(() => {
  const sum = Math.max(1, total.value)
  return [
    { key: 'resource', label: '资源', count: kinds.value.resource, pct: Math.round(kinds.value.resource / sum * 100) },
    { key: 'task', label: '任务', count: kinds.value.task, pct: Math.round(kinds.value.task / sum * 100) },
    { key: 'curiosity', label: '好奇心', count: kinds.value.curiosity, pct: Math.round(kinds.value.curiosity / sum * 100) },
    { key: 'topic', label: '选题', count: kinds.value.topic, pct: Math.round(kinds.value.topic / sum * 100) },
  ]
})

const metrics = computed(() => {
  const count = Math.max(1, total.value)
  const taskCount = props.analysis.task.liveCount
  const supportCount = props.analysis.evidence.effectiveTaskSupportCount
  const supportRate = props.analysis.evidence.effectiveTaskSupportRate
  return [
    {
      key: 'active12m',
      value: props.analysis.inventory.active12m,
      suffix: '张',
      label: '近 12 个月活跃资产',
      note: '有真实创建 / 修改 / 调用 / 完成活动',
      pct: Math.round(props.analysis.inventory.active12m / count * 100),
      tone: 'accent',
      drill: '',
    },
    {
      key: 'cooling',
      value: props.analysis.inventory.highValueCooling,
      suffix: '张',
      label: '高价值冷却',
      note: '生命周期冷却 · 历史调用 ≥ 3',
      pct: Math.round(props.analysis.inventory.highValueCooling / count * 100),
      tone: 'warn',
      drill: 'yr-high',
    },
    {
      key: 'support',
      value: supportRate,
      suffix: '%',
      label: '任务有有效资源支撑',
      note: `${supportCount} / ${taskCount} 张活任务`,
      pct: supportRate,
      tone: 'success',
      drill: 'effective-support',
    },
    {
      key: 'focus',
      value: props.analysis.focusShare,
      suffix: '%',
      label: '近 30 天精力落主攻',
      note: '有效动作中归属主攻项目的占比',
      pct: props.analysis.focusShare,
      tone: 'info',
      drill: 'focus',
    },
  ]
})

function emitMetric(key: string): void {
  if (key === 'effective-support' || key === 'focus' || key === 'yr-high') {
    emit('drill', key)
  }
}
</script>

<template>
  <section class="pi-pulse pi-mod" aria-labelledby="pi-pulse-title">
    <div class="pi-pulse-intro">
      <div class="pi-pulse-heading">
        <div>
          <span class="pi-pulse-eyebrow">LIBRARY PULSE</span>
          <h2 id="pi-pulse-title">全库卡片总览</h2>
        </div>
        <span class="pi-pulse-scope">当前快照 · 排除回收站</span>
      </div>

      <div class="pi-pulse-total">
        <button type="button" title="打开全库卡片明细" @click="emit('drill', 'all')">
          <strong>{{ total.toLocaleString() }}</strong><small>张在库</small>
        </button>
        <button type="button" class="pi-pulse-month" title="打开本月新增卡片明细" @click="emit('month-added', 'month')">
          本月 +{{ analysis.inventory.monthAdded }}
        </button>
        <button v-if="todayImport > 0" type="button" class="pi-imp-badge pi-pulse-import"
          :title="`今日导入 ${todayImport} 张卡；导入继承原创建时间，不计入今天新建`"
          @click="emit('month-added', 'import')">
          <Icon name="upload" :size="12" /> 导 {{ todayImport }}
        </button>
      </div>

      <div class="pi-pulse-track" aria-hidden="true">
        <i v-for="item in composition" :key="item.key" :class="`is-${item.key}`" :style="{ width: item.pct + '%' }" />
      </div>
      <div class="pi-pulse-legend">
        <span v-for="item in composition" :key="item.key">
          <i :class="`is-${item.key}`" />{{ item.label }} <b>{{ item.count }}</b>
        </span>
      </div>
    </div>

    <div class="pi-pulse-main">
      <template v-for="metric in metrics" :key="metric.key">
        <button
          v-if="metric.drill"
          type="button"
          class="pi-pulse-metric"
          :class="[`tone-${metric.tone}`, 'clickable']"
          :title="`${metric.note} · 点击看明细`"
          @click="emitMetric(metric.drill)"
        >
          <span class="pi-pulse-value">{{ metric.value }}<small>{{ metric.suffix }}</small></span>
          <span class="pi-pulse-label">{{ metric.label }}</span>
          <span class="pi-pulse-note">{{ metric.note }}</span>
          <span class="pi-pulse-bar"><i :style="{ width: Math.max(0, Math.min(100, metric.pct)) + '%' }" /></span>
        </button>
        <div
          v-else
          class="pi-pulse-metric"
          :class="`tone-${metric.tone}`"
          :title="metric.note"
        >
          <span class="pi-pulse-value">{{ metric.value }}<small>{{ metric.suffix }}</small></span>
          <span class="pi-pulse-label">{{ metric.label }}</span>
          <span class="pi-pulse-note">{{ metric.note }}</span>
          <span class="pi-pulse-bar"><i :style="{ width: Math.max(0, Math.min(100, metric.pct)) + '%' }" /></span>
        </div>
      </template>
    </div>

    <div class="pi-pulse-foot">
      <button type="button" class="pi-pulse-tags" :title="topTags.length ? `高频标签：${topTags.map(tag => tag.tag).join(' · ')}` : '暂无标签'" @click="emit('tag')">
        <span>标签分布</span>
        <b>{{ entropy.toFixed(1) }} bit</b>
        <small v-if="topTags.length">{{ topTags.map(tag => tag.tag).join(' / ') }}</small>
        <small v-else>暂无标签</small>
      </button>
      <button type="button" class="pi-pulse-fact" title="有卡片行动的天数" @click="emit('drill', 'yr-active')">
        <span>本年活跃</span><b>{{ ya.act }} 天</b>
      </button>
      <button type="button" class="pi-pulse-fact" title="连续有卡片行动的最长跨度" @click="emit('drill', 'yr-streak')">
        <span>最长连续</span><b>{{ streak }} 天</b>
      </button>
      <span class="pi-pulse-fact"><span>有效动作</span><b>{{ ya.acts }} 件</b></span>
      <span class="pi-pulse-fact"><span>单日峰值</span><b>{{ ya.peak ? `${ya.peak[1]} 分` : '—' }}</b></span>
      <span class="pi-pulse-fact"><span>P90</span><b>{{ ya.p90 }} 分</b></span>
      <span class="pi-pulse-fact" title="调出维度从该日期起具备完整事件记录">
        <span>调出完整起始日</span><b>{{ stats.fullSince || '—' }}</b>
      </span>
    </div>
  </section>
</template>

<style scoped>
.pi-pulse {
  overflow: hidden;
}

.pi-pulse-intro {
  display: grid;
  grid-template-columns: minmax(240px, 1.15fr) minmax(180px, .68fr);
  gap: 10px 20px;
  align-items: end;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-light) 44%, transparent), transparent 62%),
    var(--surface);
}

.pi-pulse-heading {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.pi-pulse-eyebrow {
  display: block;
  margin-bottom: 3px;
  color: var(--accent-ink);
  font-size: var(--fs-micro);
  font-weight: 750;
  letter-spacing: .15em;
}

.pi-pulse-heading h2 {
  margin: 0;
  color: var(--text);
  font-size: var(--fs-title);
  line-height: 1.25;
}

.pi-pulse-scope {
  flex: none;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--surface-2);
  color: var(--text-3);
  font-size: var(--fs-micro);
}

.pi-pulse-total {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.pi-pulse-total button {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.pi-pulse-total button:first-child {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 0;
}

.pi-pulse-total strong {
  color: var(--text);
  font-size: clamp(30px, 4vw, 46px);
  line-height: .96;
  letter-spacing: -.045em;
  font-variant-numeric: tabular-nums;
}

.pi-pulse-total small {
  color: var(--text-3);
  font-size: var(--fs-caption);
}

.pi-pulse-month {
  padding: 4px 8px !important;
  border: 1px solid color-mix(in srgb, var(--success) 32%, var(--border)) !important;
  border-radius: var(--radius-full);
  background: var(--success-bg-soft) !important;
  color: var(--success) !important;
  font-size: var(--fs-caption) !important;
  font-weight: 700;
}

.pi-pulse-import {
  align-self: center;
  cursor: pointer;
}

.pi-pulse-total button:hover {
  color: var(--accent-ink);
}

.pi-pulse-track {
  align-self: center;
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--surface-3);
}

.pi-pulse-track i,
.pi-pulse-legend i {
  display: block;
}

.pi-pulse-track i {
  min-width: 2px;
  height: 100%;
}

.pi-pulse-legend {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}

.pi-pulse-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pi-pulse-legend i {
  width: 6px;
  height: 6px;
  border-radius: 2px;
}

.pi-pulse-legend b {
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.is-resource { background: var(--accent); }
.is-task { background: var(--info-blue); }
.is-curiosity { background: var(--success); }
.is-topic { background: color-mix(in srgb, var(--accent) 58%, var(--info-blue)); }

.pi-pulse-main {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 20px;
}

.pi-pulse-metric {
  display: flex;
  min-height: 104px;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 13px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
}

.pi-pulse-metric.clickable { cursor: pointer; }
.pi-pulse-metric.clickable:hover {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent-light) 34%, var(--surface));
}

.pi-pulse-metric:focus-visible,
.pi-pulse-foot button:focus-visible,
.pi-pulse-total button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.pi-pulse-value {
  color: var(--text);
  font-size: var(--fs-display);
  font-weight: 680;
  line-height: 1.1;
  letter-spacing: -.025em;
  font-variant-numeric: tabular-nums;
}

.pi-pulse-value small {
  margin-left: 2px;
  color: var(--text-3);
  font-size: var(--fs-caption);
  font-weight: 600;
}

.pi-pulse-label {
  color: var(--text-2);
  font-size: var(--fs-caption);
  font-weight: 700;
}

.pi-pulse-note {
  min-height: 26px;
  color: var(--text-4);
  font-size: var(--fs-micro);
  line-height: 1.45;
}

.pi-pulse-bar {
  width: 100%;
  height: 4px;
  margin-top: auto;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--surface-3);
}

.pi-pulse-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.tone-warn .pi-pulse-value { color: var(--warning); }
.tone-warn .pi-pulse-bar i { background: var(--warning); }
.tone-success .pi-pulse-value { color: var(--success); }
.tone-success .pi-pulse-bar i { background: var(--success); }
.tone-info .pi-pulse-value { color: var(--info-blue); }
.tone-info .pi-pulse-bar i { background: var(--info-blue); }

.pi-pulse-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 1px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}

.pi-pulse-tags,
.pi-pulse-fact {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 8px 12px;
  border: 0;
  border-right: 1px solid var(--border);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

button.pi-pulse-tags,
button.pi-pulse-fact {
  cursor: pointer;
}

button.pi-pulse-tags:hover,
button.pi-pulse-fact:hover {
  background: var(--surface);
}

.pi-pulse-tags {
  flex: 1 1 250px;
}

.pi-pulse-tags span,
.pi-pulse-fact span {
  color: var(--text-3);
  font-size: var(--fs-micro);
  white-space: nowrap;
}

.pi-pulse-tags b,
.pi-pulse-fact b {
  color: var(--text-2);
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pi-pulse-tags small {
  overflow: hidden;
  color: var(--text-4);
  font-size: var(--fs-micro);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 980px) {
  .pi-pulse-main { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .pi-pulse-intro { grid-template-columns: 1fr; padding-inline: 15px; }
  .pi-pulse-main { grid-template-columns: 1fr; padding-inline: 15px; }
  .pi-pulse-heading { flex-direction: column; }
  .pi-pulse-foot { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pi-pulse-tags { grid-column: 1 / -1; }
  .pi-pulse-tags small { margin-left: auto; }
}
</style>
