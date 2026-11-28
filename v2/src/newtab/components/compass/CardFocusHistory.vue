<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import { useAppStore } from '@/newtab/stores/app'
import {
  buildFocusUsage,
  focusUsageOfCard,
  type FocusCardKind,
} from '@/shared/analytics/focusUsage'

const props = defineProps<{
  cardId: string
  cardKind: FocusCardKind
}>()

const store = useAppStore()
const expanded = ref(false)
const usage = computed(() => {
  const data = store.data
  if (!data) return { cardId: props.cardId, kind: props.cardKind, occurrences: [], count: 0, doneCount: 0, lastDate: '' }
  return focusUsageOfCard(buildFocusUsage(data), props.cardKind, props.cardId)
})
const visible = computed(() => expanded.value ? usage.value.occurrences : usage.value.occurrences.slice(0, 8))
const latest = computed(() => usage.value.occurrences[0])

function fmtDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return day
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  return `${Number(match[2])} 月 ${Number(match[3])} 日 · 周${'日一二三四五六'[date.getDay()]}`
}

function fmtTime(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<template>
  <section class="cfh" aria-label="进入今日三件事时间轴">
    <header class="cfh-head">
      <div class="cfh-heading">
        <span class="cfh-icon"><Icon name="target" :size="14" /></span>
        <div>
          <b>进入今日三件事</b>
          <small v-if="usage.count">
            共 {{ usage.count }} 次 · 完成 {{ usage.doneCount }} 次
            <template v-if="latest"> · 最近 {{ fmtDate(latest.date) }}</template>
          </small>
          <small v-else>尚未进入过今日三件事</small>
        </div>
      </div>
      <span class="cfh-count">{{ usage.count }}<small>次</small></span>
    </header>

    <div v-if="visible.length" class="cfh-timeline">
      <div v-for="(item, index) in visible" :key="`${item.date}-${item.slotId}`" class="cfh-row" :class="{ latest: index === 0 }">
        <span class="cfh-date">{{ fmtDate(item.date) }}</span>
        <span class="cfh-rail" aria-hidden="true"><i /></span>
        <span class="cfh-copy">
          <b>{{ item.done ? '已完成' : '已安排，未完成' }}</b>
          <small>{{ item.done ? `完成于 ${fmtTime(item.doneAt) || fmtDate(item.date)}` : '真实历史槽位' }}</small>
        </span>
      </div>
    </div>
    <div v-else class="cfh-empty">
      <Icon name="target" :size="15" />
      <span>从调度台或本详情“设为今日重点”后，每次进入都会在这里留下时间点。</span>
    </div>

    <footer v-if="usage.count > 8" class="cfh-foot">
      <button type="button" @click="expanded = !expanded">
        {{ expanded ? '收起近期记录' : `显示全部 ${usage.count} 次` }}
      </button>
    </footer>
    <p class="cfh-note">仅统计任务 / 选题的未清除真实槽位；同一卡同一天只计一次，隐藏展示仍计入历史，计划事件不算三件事。</p>
  </section>
</template>

<style scoped>
.cfh {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.cfh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cfh-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.cfh-icon {
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--accent-light);
  color: var(--accent-ink);
}

.cfh-heading b {
  display: block;
  color: var(--text);
  font-size: var(--fs-body);
}

.cfh-heading small {
  display: block;
  margin-top: 1px;
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
}

.cfh-count {
  flex: none;
  color: var(--accent-ink);
  font-size: var(--fs-headline);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cfh-count small {
  margin-left: 1px;
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-weight: 500;
}

.cfh-timeline {
  max-height: 286px;
  overflow: auto;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.cfh-row {
  display: grid;
  grid-template-columns: 96px 14px minmax(0, 1fr);
  gap: 7px;
  min-height: 42px;
  padding: 3px 4px;
  border-radius: var(--radius-xs);
}

.cfh-row:hover { background: var(--surface); }

.cfh-date {
  padding-top: 7px;
  color: var(--text-4);
  font-size: var(--fs-micro);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cfh-rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.cfh-rail::before {
  position: absolute;
  top: 14px;
  bottom: -9px;
  width: 1px;
  background: var(--border);
  content: '';
}

.cfh-row:last-child .cfh-rail::before { display: none; }

.cfh-rail i {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  margin-top: 9px;
  border: 2px solid var(--surface-2);
  border-radius: 50%;
  background: var(--border-strong);
  box-shadow: 0 0 0 1px var(--border-strong);
}

.cfh-row.latest .cfh-rail i {
  background: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.cfh-copy {
  min-width: 0;
  padding-top: 5px;
}

.cfh-copy b {
  display: block;
  color: var(--text-2);
  font-size: var(--fs-caption);
  font-weight: 650;
}

.cfh-copy small {
  display: block;
  margin-top: 1px;
  color: var(--text-4);
  font-size: var(--fs-micro);
}

.cfh-empty {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text-3);
  font-size: var(--fs-caption);
  line-height: 1.55;
}

.cfh-foot {
  display: flex;
  justify-content: flex-end;
}

.cfh-foot button {
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--accent-ink);
  font: inherit;
  font-size: var(--fs-micro);
  font-weight: 650;
  cursor: pointer;
}

.cfh-foot button:hover { text-decoration: underline; }

.cfh-note {
  margin: 0;
  color: var(--text-4);
  font-size: var(--fs-micro);
  line-height: 1.55;
}
</style>
