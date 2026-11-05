<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import type { SyncManifestDiffRow } from '@/shared/cloud/sync'
import {
  SYNC_RECORD_GROUPS,
  syncFieldLabel,
  syncGroupOf,
  syncTypeLabel,
  type SyncRecordGroup,
} from '@/shared/cloud/syncDisplay'

const props = withDefaults(defineProps<{
  rows: SyncManifestDiffRow[]
  emptyText?: string
  initialGroup?: SyncRecordGroup
}>(), {
  emptyText: '没有可展示的同步变化',
  initialGroup: 'all',
})

const group = ref<SyncRecordGroup>(props.initialGroup)
const sortDir = ref<'desc' | 'asc'>('desc')
const query = ref('')

watch(() => props.initialGroup, value => { group.value = value })
watch(() => props.rows, () => {
  if (!groupCounts.value[group.value] && group.value !== 'all') group.value = 'all'
})

const normalized = computed(() => props.rows.map(row => ({
  ...row,
  group: syncGroupOf(row.type),
  statusLabel: row.status === 'added' ? '新增' : row.status === 'removed' ? '删除' : '修改',
})))

const groupCounts = computed(() => {
  const counts = Object.fromEntries(SYNC_RECORD_GROUPS.map(item => [item.id, 0])) as Record<SyncRecordGroup, number>
  for (const row of normalized.value) counts[row.group] += 1
  counts.all = normalized.value.length
  return counts
})

const visibleRows = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const list = normalized.value.filter(row => {
    if (group.value !== 'all' && row.group !== group.value) return false
    if (!needle) return true
    return `${syncTypeLabel(row.type)} ${row.title} ${row.id} ${(row.fields || []).join(' ')}`
      .toLowerCase()
      .includes(needle)
  })
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const delta = ((a.updatedAt || 0) - (b.updatedAt || 0)) * dir
    return delta || a.key.localeCompare(b.key)
  })
})

function fmtTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) : '无时间'
}
</script>

<template>
  <section class="cct" data-testid="cloud-change-list">
    <div class="cct-toolbar">
      <label class="cct-search">
        <Icon name="search" :size="12" />
        <input v-model="query" type="search" placeholder="检索记录、ID 或变更字段" />
      </label>
      <button class="cct-sort" type="button" :title="sortDir === 'desc' ? '当前按时间倒序，点击切换正序' : '当前按时间正序，点击切换倒序'" @click="sortDir = sortDir === 'desc' ? 'asc' : 'desc'">
        <Icon name="arrowupdown" :size="12" />
        {{ sortDir === 'desc' ? '时间倒序' : '时间正序' }}
      </button>
    </div>

    <div class="cct-groups" role="tablist" aria-label="同步记录分组">
      <button
        v-for="item in SYNC_RECORD_GROUPS"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="group === item.id"
        :class="{ on: group === item.id }"
        @click="group = item.id"
      >
        {{ item.label }}
        <span>{{ groupCounts[item.id] }}</span>
      </button>
    </div>

    <div v-if="visibleRows.length" class="cct-head" aria-hidden="true">
      <span>类型</span><span>记录</span><span>状态</span><span>变更字段</span><span>时间</span>
    </div>
    <div v-if="visibleRows.length" class="cct-list">
      <article v-for="row in visibleRows" :key="`${row.status}:${row.key}`" class="cct-row">
        <span class="cct-type">{{ syncTypeLabel(row.type) }}</span>
        <span class="cct-main">
          <b>{{ row.title || row.id }}</b>
          <code>{{ row.id }}</code>
        </span>
        <span class="cct-status" :class="row.status">{{ row.statusLabel }}</span>
        <span class="cct-fields">
          <i v-for="field in row.fields || []" :key="field">{{ syncFieldLabel(field) }}</i>
          <i v-if="!(row.fields || []).length" class="whole">整条记录</i>
        </span>
        <time>{{ fmtTime(row.updatedAt) }}</time>
      </article>
    </div>
    <div v-else class="cct-empty">
      <Icon name="check" :size="19" />
      <b>{{ emptyText }}</b>
      <span v-if="query.trim()">没有匹配“{{ query.trim() }}”的记录</span>
    </div>
  </section>
</template>

<style scoped>
.cct { min-height: 160px; }
.cct-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.cct-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-3); }
.cct-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: var(--fs-caption); }
.cct-sort { min-height: 32px; flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.cct-sort:hover { border-color: var(--accent); color: var(--accent-ink); }
.cct-groups { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 11px; }
.cct-groups button { min-height: 29px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.cct-groups button span { min-width: 16px; padding: 0 4px; border-radius: 999px; background: var(--surface-2); color: var(--text-2); text-align: center; font-weight: 700; }
.cct-groups button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.cct-groups button.on span { background: var(--surface); color: var(--accent-ink); }
.cct-head, .cct-row { display: grid; grid-template-columns: 78px minmax(150px, 1fr) 54px minmax(130px, .8fr) 104px; align-items: center; gap: 9px; }
.cct-head { padding: 0 9px 5px; color: var(--text-3); font-size: var(--fs-micro); }
.cct-list { display: flex; flex-direction: column; gap: 5px; }
.cct-row { padding: 8px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.cct-type { padding: 2px 5px; border-radius: 5px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); text-align: center; }
.cct-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cct-main b { overflow: hidden; color: var(--text); font-size: var(--fs-caption); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.cct-main code { overflow: hidden; color: var(--text-3); font-family: var(--font-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.cct-status { justify-self: start; padding: 2px 6px; border-radius: 999px; font-size: var(--fs-micro); font-weight: 700; }
.cct-status.added { color: var(--success); background: var(--success-bg-soft); }
.cct-status.removed { color: var(--danger); background: var(--danger-bg-soft); }
.cct-status.changed { color: var(--warning); background: var(--warning-bg-soft); }
.cct-fields { min-width: 0; display: flex; flex-wrap: wrap; gap: 3px; }
.cct-fields i { padding: 1px 5px; border-radius: 4px; background: var(--surface-2); color: var(--text-2); font-size: 10px; font-style: normal; }
.cct-fields i.whole { color: var(--text-3); }
.cct-row time { color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; text-align: right; }
.cct-empty { min-height: 150px; display: grid; place-items: center; align-content: center; gap: 6px; padding: 24px; border: 1px dashed var(--border); border-radius: 10px; color: var(--text-3); text-align: center; }
.cct-empty b { color: var(--text-2); font-size: var(--fs-sub); }
.cct-empty span { font-size: var(--fs-caption); }
@media (max-width: 720px) {
  .cct-head { display: none; }
  .cct-row { grid-template-columns: 64px minmax(0, 1fr) auto; }
  .cct-fields { grid-column: 2 / -1; }
  .cct-row time { display: none; }
  .cct-toolbar { align-items: stretch; flex-direction: column; }
  .cct-sort { justify-content: center; }
}
</style>
