<script setup lang="ts">
/** 画像年度四格下钻：日期型看日级明细，资产型看真实卡片清单。 */
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import Icon from '@/shared/components/Icon.vue'

export interface PiYearDayRow {
  day: string
  level: number
  levelName: string
  score: number
  acts: number
}

export interface PiYearCardRow {
  kind: 'resource' | 'task' | 'curiosity'
  id: string
  title: string
  note: string
  callCount?: number
  idleDays?: number
}

const props = defineProps<{
  open: boolean
  mode: 'days' | 'streak' | 'cards'
  title: string
  note: string
  days: PiYearDayRow[]
  cards: PiYearCardRow[]
}>()

const emit = defineEmits<{
  close: []
  'open-day': [day: string]
  'open-card': [row: PiYearCardRow]
}>()

const kindLabel = (kind: PiYearCardRow['kind']): string =>
  kind === 'task' ? '任务卡' : kind === 'curiosity' ? '好奇心卡' : '资源卡'

const kindIcon = (kind: PiYearCardRow['kind']): string =>
  kind === 'task' ? 'checksquare' : kind === 'curiosity' ? 'bulb' : 'filetext'

const total = computed(() => props.mode === 'cards' ? props.cards.length : props.days.length)
</script>

<template>
  <Drawer :open="open" :title="title" width="540px" @close="emit('close')">
    <div class="year-drill">
      <div class="summary">
        <span class="count">{{ total }}</span>
        <span>{{ mode === 'cards' ? '张卡片' : '天记录' }}</span>
        <span class="note">{{ note }}</span>
      </div>

      <div v-if="mode === 'days' || mode === 'streak'" class="day-list">
        <button v-for="row in days" :key="row.day" class="day-row" @click="emit('open-day', row.day)">
          <span class="day">{{ row.day }}</span>
          <span class="level" :class="'l' + row.level">{{ row.levelName }}</span>
          <span class="score">{{ row.score }} 分</span>
          <span class="acts">{{ row.acts }} 件动作</span>
          <Icon name="arrowright" :size="12" class="go"/>
        </button>
        <EmptyState v-if="!days.length" size="inline" icon="calendar"
          title="这一年还没有活跃记录" hint="产生采集、调出或推进后，这里会出现逐日明细。" />
      </div>

      <div v-else class="card-list">
        <button v-for="row in cards" :key="row.id" class="card-row" @click="emit('open-card', row)">
          <span class="kind"><Icon :name="kindIcon(row.kind)" :size="13"/></span>
          <span class="kind-name">{{ kindLabel(row.kind) }}</span>
          <span class="title">{{ row.title }}</span>
          <span class="card-note">{{ row.note }}</span>
          <Icon name="arrowright" :size="12" class="go"/>
        </button>
        <EmptyState v-if="!cards.length" size="inline" icon="folder"
          title="当前没有符合条件的卡片" hint="卡片状态变化后，这里会按生命周期实时对账。" />
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.year-drill { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 0; }
.summary { display: flex; align-items: baseline; gap: 6px; color: var(--text-3); font-size: var(--fs-caption); }
.summary .count { color: var(--text); font-size: var(--fs-title); font-weight: 700; font-variant-numeric: tabular-nums; }
.summary .note { margin-left: auto; text-align: right; }
.day-list, .card-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.day-row, .card-row {
  display: flex; align-items: center; gap: 9px; width: 100%; min-width: 0; padding: 8px 10px;
  border: 1px solid var(--border); border-radius: 7px; background: transparent; color: inherit;
  font-family: inherit; font-size: var(--fs-sub); text-align: left; cursor: pointer;
}
.day-row:hover, .card-row:hover { border-color: var(--border-strong); background: var(--surface-2); }
.day { width: 88px; flex: none; color: var(--text); font-variant-numeric: tabular-nums; }
.level { flex: none; padding: 1px 7px; border-radius: 99px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-tiny); }
.level.l1, .level.l2 { color: var(--text-2); }
.level.l3, .level.l4, .level.l5 { background: var(--accent-light); color: var(--accent-ink); }
.score { flex: none; color: var(--text-2); font-variant-numeric: tabular-nums; }
.acts { flex: 1; color: var(--text-3); font-size: var(--fs-caption); }
.kind { flex: none; color: var(--text-3); }
.kind-name { flex: none; padding: 1px 6px; border: 1px solid var(--border); border-radius: 4px; color: var(--text-3); font-size: var(--fs-tiny); }
.title { flex: 1; min-width: 0; overflow: hidden; color: var(--text); text-overflow: ellipsis; white-space: nowrap; }
.card-note { flex: none; max-width: 42%; overflow: hidden; color: var(--text-3); font-size: var(--fs-tiny); text-overflow: ellipsis; white-space: nowrap; }
.go { flex: none; color: var(--text-4); }
</style>
