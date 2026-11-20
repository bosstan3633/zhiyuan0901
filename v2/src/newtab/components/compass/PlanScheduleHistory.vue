<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { planEventsOf, removePlanEvent, restorePlanEvent } from '@/shared/storage/planSchedule'
import { useAppStore } from '../../stores/app'
import type { PlanScheduleEvent } from '@/shared/models'

const props = defineProps<{
  cardId: string
  cardKind: 'task' | 'topic' | 'curiosity'
  currentDate?: string
}>()

const store = useAppStore()
const d = computed(() => store.data)
const expanded = ref(false)
const events = computed(() => planEventsOf(d.value, props.cardId, props.cardKind))
const visible = computed(() => expanded.value ? events.value : events.value.slice(0, 5))
const latestAt = computed(() => events.value[0]?.at || 0)
const currentLabel = computed(() => {
  if (!props.currentDate) return '未落图'
  const date = dateOfKey(props.currentDate)
  if (!date) return props.currentDate
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${'日一二三四五六'[date.getDay()]}`
})

const SOURCE_LABEL: Record<PlanScheduleEvent['source'], string> = {
  detail: '详情设置',
  calendar: '日历拖拽',
  focus: '今日重点',
  quick: '快捷菜单',
  'ai-adopt': 'AI 采纳',
  import: '导入',
}

function fmtAt(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function fmtDate(date?: string): string {
  if (!date) return '未落图'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${Number(match[2])} 月 ${Number(match[3])} 日` : date
}

function dateOfKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

function remove(event: PlanScheduleEvent): void {
  if (!d.value) return
  if (!removePlanEvent(d.value, event.id)) return
  store.persist()
  showToast('已删除一条安排记录', {
    label: '撤销',
    cb: () => {
      if (!d.value) return
      restorePlanEvent(d.value, event.id)
      store.persist()
      showToast('已恢复安排记录')
    },
  })
}
</script>

<template>
  <section class="psh" aria-label="计划安排历程">
    <header class="psh-head">
      <div class="psh-heading">
        <span class="psh-icon"><Icon name="calendar" :size="15" /></span>
        <div>
          <b class="psh-title">安排历程</b>
          <span class="psh-sub">{{ events.length ? `${events.length} 次安排 · 最近 ${fmtAt(latestAt)}` : '尚未产生安排记录' }}</span>
        </div>
      </div>
      <span class="psh-current" :class="{ empty: !currentDate }">
        <i>当前计划</i>
        <b>{{ currentLabel }}</b>
      </span>
    </header>
    <div v-if="visible.length" class="psh-timeline">
      <div v-for="(event, index) in visible" :key="event.id" class="psh-row" :class="{ latest: index === 0 }">
        <span class="psh-rail" aria-hidden="true"><i /></span>
        <div class="psh-main">
          <div class="psh-change">
            <template v-if="event.fromDate">
              <span class="psh-from">{{ fmtDate(event.fromDate) }}</span>
              <Icon name="arrowright" :size="11" />
              <b>{{ fmtDate(event.date) }}</b>
            </template>
            <template v-else>
              安排到 <b>{{ fmtDate(event.date) }}</b>
            </template>
          </div>
          <div class="psh-meta">
            <span>{{ fmtAt(event.at) }}</span>
            <span class="psh-src">{{ SOURCE_LABEL[event.source] }}</span>
          </div>
        </div>
        <button class="psh-del" type="button" title="删除这条安排记录（不改当前计划）" :aria-label="`删除 ${fmtAt(event.at)} 的安排记录`" @click="remove(event)">
          <Icon name="x" :size="11" />
        </button>
      </div>
    </div>
    <div v-else class="psh-empty">
      <Icon name="calendar" :size="16" />
      <div>
        <b>从本版本开始记录安排动作</b>
        <span>在日历拖拽、详情改期或设为今日重点后，会在这里留下可追溯的时间点。</span>
      </div>
    </div>
    <footer v-if="events.length > 5" class="psh-foot">
      <button class="psh-toggle" type="button" @click="expanded = !expanded">
        {{ expanded ? '收起早期记录' : `显示全部 ${events.length} 条` }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.psh {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.psh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.psh-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.psh-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--accent-light);
  color: var(--accent-ink);
}
.psh-title {
  display: block;
  color: var(--text);
  font-size: var(--fs-body);
  font-weight: 700;
  letter-spacing: .01em;
}
.psh-sub {
  display: block;
  margin-top: 1px;
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-variant-numeric: tabular-nums;
}
.psh-current {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 99px;
  background: color-mix(in srgb, var(--accent-light) 54%, var(--surface));
}
.psh-current i {
  color: var(--text-3);
  font-size: var(--fs-micro);
  font-style: normal;
}
.psh-current b {
  color: var(--accent-ink);
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
}
.psh-current.empty {
  border-color: var(--border);
  background: var(--surface-2);
}
.psh-current.empty b {
  color: var(--text-2);
}
.psh-toggle {
  border: 0;
  background: transparent;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: var(--fs-micro);
  font-weight: 650;
  cursor: pointer;
  padding: 2px 0;
}
.psh-toggle:hover { text-decoration: underline; }
.psh-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 300px;
  overflow: auto;
}
.psh-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 24px;
  align-items: stretch;
  gap: 8px;
  min-height: 46px;
  padding: 5px 6px 5px 2px;
  border-radius: 8px;
}
.psh-row:hover { background: var(--surface-2); }
.psh-row.latest {
  background: color-mix(in srgb, var(--accent-light) 34%, var(--surface));
}
.psh-rail {
  position: relative;
  display: flex;
  justify-content: center;
}
.psh-rail::before {
  position: absolute;
  top: 13px;
  bottom: -11px;
  width: 1px;
  background: var(--border);
  content: '';
}
.psh-row:last-child .psh-rail::before { display: none; }
.psh-rail i {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  margin-top: 8px;
  border: 2px solid var(--surface);
  border-radius: 99px;
  background: var(--border-strong);
  box-shadow: 0 0 0 1px var(--border-strong);
}
.psh-row.latest .psh-rail i {
  background: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.psh-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}
.psh-change {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: var(--text-2);
  font-size: var(--fs-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.psh-change b {
  color: var(--text);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.psh-from {
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--text-4) 70%, transparent);
}
.psh-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  font-size: var(--fs-tiny);
  font-variant-numeric: tabular-nums;
}
.psh-src {
  padding: 0 5px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--text-3);
  font-size: var(--fs-tiny);
}
.psh-del {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  align-self: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  line-height: 1;
}
.psh-del:hover {
  color: var(--danger);
  background: var(--tag-danger-bg);
}
.psh-empty {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 12px;
  border: 1px dashed var(--border);
  border-radius: 9px;
  background: var(--surface-2);
  color: var(--text-3);
}
.psh-empty > :deep(svg) { flex: none; margin-top: 1px; }
.psh-empty div { display: flex; flex-direction: column; gap: 2px; }
.psh-empty b { color: var(--text-2); font-size: var(--fs-caption); }
.psh-empty span { font-size: var(--fs-tiny); line-height: 1.5; }
.psh-foot {
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 560px) {
  .psh-current { width: 100%; justify-content: space-between; }
}
</style>
