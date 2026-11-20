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
  return match ? `${Number(match[2])}/${Number(match[3])}` : date
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
      <span class="psh-title"><Icon name="calendar" :size="13" /> 安排历程 <b>{{ events.length }}</b></span>
      <button v-if="events.length > 5" class="psh-toggle" type="button" @click="expanded = !expanded">
        {{ expanded ? '收起' : '显示全部' }}
      </button>
    </header>
    <div v-if="visible.length" class="psh-list">
      <div v-for="event in visible" :key="event.id" class="psh-row">
        <span class="psh-at">{{ fmtAt(event.at) }}</span>
        <span class="psh-change">
          <template v-if="event.fromDate">从 {{ fmtDate(event.fromDate) }} 改到 {{ fmtDate(event.date) }}</template>
          <template v-else>安排到 {{ fmtDate(event.date) }}</template>
        </span>
        <span class="psh-src">{{ SOURCE_LABEL[event.source] }}</span>
        <button class="psh-del" type="button" title="删除这条安排记录（不改当前计划）" @click="remove(event)">×</button>
      </div>
    </div>
    <div v-else class="psh-empty">
      从本次升级后开始记录；当前计划：{{ fmtDate(currentDate) }}
    </div>
  </section>
</template>

<style scoped>
.psh {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
}
.psh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.psh-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-3);
  font-size: var(--fs-tiny);
}
.psh-title b {
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.psh-toggle {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: var(--fs-tiny);
  cursor: pointer;
  padding: 2px 4px;
}
.psh-list {
  display: grid;
  gap: 2px;
  max-height: 190px;
  overflow: auto;
}
.psh-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 2px 4px;
  border-radius: 5px;
  color: var(--text-2);
  font-size: var(--fs-tiny);
}
.psh-row:hover { background: var(--surface-2); }
.psh-at {
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.psh-change {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.psh-src {
  color: var(--text-3);
  white-space: nowrap;
}
.psh-del {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
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
  padding: 3px 4px 1px;
  color: var(--text-3);
  font-size: var(--fs-tiny);
  line-height: 1.5;
}
</style>
