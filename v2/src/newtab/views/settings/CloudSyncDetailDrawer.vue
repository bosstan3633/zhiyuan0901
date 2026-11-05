<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { CloudSyncDetails } from '@/newtab/composables/useCloudSync'
import { diffSyncManifests, syncDiffRows, type SyncManifest, type SyncManifestRecord, type SyncManifestRecordType } from '@/shared/cloud/sync'
import { SYNC_RECORD_GROUPS, syncGroupOf, syncTypeLabel, type SyncRecordGroup } from '@/shared/cloud/syncDisplay'
import CloudSyncChangeTable from '@/newtab/components/cloud/CloudSyncChangeTable.vue'
import SyncRecordDetailDrawer from './SyncRecordDetailDrawer.vue'

const props = defineProps<{
  open: boolean
  loading: boolean
  error: string
  details: CloudSyncDetails | null
  initialTab?: 'local' | 'remote'
}>()
const emit = defineEmits<{ close: []; refresh: [] }>()

type Tab = 'local' | 'remote'
const tab = ref<Tab>('local')
const query = ref('')
const typeFilter = ref<'all' | SyncManifestRecordType>('all')
const group = ref<SyncRecordGroup>('all')
const sortDir = ref<'desc' | 'asc'>('desc')
const recordMode = ref<'changes' | 'all'>('changes')
const detailRecord = ref<SyncManifestRecord | null>(null)
const detailOpen = ref(false)

const localManifest = computed<SyncManifest | null>(() => props.details?.localManifest || null)
const currentLocalManifest = computed<SyncManifest | null>(() => props.details?.currentLocalManifest || null)
const remoteManifest = computed<SyncManifest | null>(() => props.details?.remoteManifest || null)
const baselineFallback = computed(() => !localManifest.value && !!currentLocalManifest.value)
const activeManifest = computed(() => tab.value === 'local'
  ? (localManifest.value || currentLocalManifest.value)
  : remoteManifest.value)
const diff = computed(() => diffSyncManifests(localManifest.value, remoteManifest.value))
const localChanges = computed(() => diffSyncManifests(localManifest.value, currentLocalManifest.value))
const localChangeRows = computed(() => syncDiffRows(localChanges.value))
const diffRows = computed(() => [...diff.value.added, ...diff.value.removed, ...diff.value.changed])
const groupCounts = computed(() => {
  const counts = Object.fromEntries(SYNC_RECORD_GROUPS.map(item => [item.id, 0])) as Record<SyncRecordGroup, number>
  for (const row of activeManifest.value?.records || []) counts[syncGroupOf(row.type)] += 1
  counts.all = activeManifest.value?.records.length || 0
  return counts
})
const filteredRecords = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const rows = (activeManifest.value?.records || []).filter(row => {
    if (group.value !== 'all' && syncGroupOf(row.type) !== group.value) return false
    if (typeFilter.value !== 'all' && row.type !== typeFilter.value) return false
    if (!needle) return true
    return `${row.title} ${row.id} ${row.type}`.toLowerCase().includes(needle)
  })
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const delta = ((a.updatedAt || 0) - (b.updatedAt || 0)) * dir
    return delta || a.key.localeCompare(b.key)
  })
})
const shownRecords = computed(() => filteredRecords.value.slice(0, 600))

watch(() => props.open, open => {
  if (!open) return
  tab.value = props.initialTab || 'local'
  recordMode.value = tab.value === 'local' ? 'changes' : 'all'
  query.value = ''
  typeFilter.value = 'all'
  group.value = 'all'
  sortDir.value = 'desc'
  detailOpen.value = false
  detailRecord.value = null
})

function typeLabel(type: SyncManifestRecordType): string {
  return syncTypeLabel(type)
}

function fmtTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
}

function fmtFingerprint(value?: string): string {
  if (!value) return '—'
  if (value.length <= 24) return value
  return `${value.slice(0, 17)}…${value.slice(-8)}`
}

function recordLine(row: { type: SyncManifestRecordType; title: string; id: string; status?: string }): string {
  return `${typeLabel(row.type)} · ${row.title || row.id}${row.status === 'added' ? ' · 新增' : row.status === 'removed' ? ' · 删除' : row.status === 'changed' ? ' · 变化' : ''}`
}

function openRecord(row: SyncManifestRecord): void {
  detailRecord.value = row
  detailOpen.value = true
}
</script>

<template>
  <Drawer :open="open" width="680px" @close="emit('close')">
    <template #title><Icon name="database" :size="15"/> 同步明细</template>
    <div class="csd-tabs" role="tablist" aria-label="同步明细来源">
      <button type="button" role="tab" :aria-selected="tab === 'local'" :class="{ on: tab === 'local' }" @click="tab = 'local'">
        本机基线
      </button>
      <button type="button" role="tab" :aria-selected="tab === 'remote'" :class="{ on: tab === 'remote' }" @click="tab = 'remote'">
        云端当前
      </button>
      <span class="sp"></span>
      <button class="csd-refresh" type="button" :disabled="loading" @click="emit('refresh')">
        <Icon name="refresh" :size="12"/> {{ loading ? '读取中…' : '重新读取' }}
      </button>
    </div>

    <div v-if="error" class="csd-error">{{ error }}</div>
    <div v-if="details?.refreshError" class="csd-note">
      云端实时读取失败，当前展示最近缓存：{{ details.refreshError }}
    </div>
    <div v-if="loading && !details" class="csd-loading">正在读取本机基线与云端修订明细…</div>

    <template v-else-if="details">
      <div v-if="tab === 'local' && baselineFallback" class="csd-note">
        基线明细尚未建立，本轮成功同步后生成。下方为当前本机 manifest，仅作参考，不代表上次同步基线。
      </div>
      <div v-if="tab === 'remote' && details.cachedAt && !remoteManifest" class="csd-note">
        当前展示最近一次缓存（{{ fmtTime(details.cachedAt) }}）。
      </div>

      <div v-if="activeManifest" class="csd-summary">
        <div><span>修订</span><b>{{ activeManifest.revision }}</b></div>
        <div><span>记录</span><b>{{ activeManifest.records.length }}</b></div>
        <div><span>业务数据</span><b>{{ activeManifest.counts.businessTotal }}</b></div>
        <div><span>事件</span><b>{{ activeManifest.counts.events }}</b></div>
        <div><span>策展附件</span><b>{{ activeManifest.counts.attachments }}</b></div>
        <div><span>最近同步/读取</span><b>{{ fmtTime(details.cachedAt) }}</b></div>
      </div>

      <div v-if="activeManifest" class="csd-fingerprint">
        <span>内容指纹</span>
        <code :title="activeManifest.fingerprint">{{ fmtFingerprint(activeManifest.fingerprint) }}</code>
        <small>生成于 {{ fmtTime(activeManifest.capturedAt) }}</small>
      </div>

      <div v-if="tab === 'local'" class="csd-view-switch" role="group" aria-label="本机基线查看方式">
        <button type="button" :class="{ on: recordMode === 'changes' }" @click="recordMode = 'changes'">本次修订内容 <span>{{ localChangeRows.length }}</span></button>
        <button type="button" :class="{ on: recordMode === 'all' }" @click="recordMode = 'all'">基线全部记录 <span>{{ activeManifest?.records.length || 0 }}</span></button>
      </div>

      <CloudSyncChangeTable
        v-if="tab === 'local' && recordMode === 'changes'"
        :rows="localChangeRows"
        empty-text="本机与上次同步基线一致，没有待上传的修订"
      />

      <div v-if="tab === 'local' && localManifest && remoteManifest" class="csd-diff">
        <div class="csd-section-title">
          <b>与云端当前记录的差异</b>
          <span :class="{ ok: !diffRows.length }">{{ diffRows.length ? `${diffRows.length} 条` : '记录一致' }}</span>
        </div>
        <div v-if="diffRows.length" class="csd-diff-chips">
          <span class="added">新增 {{ diff.added.length }}</span>
          <span class="removed">删除 {{ diff.removed.length }}</span>
          <span class="changed">变化 {{ diff.changed.length }}</span>
        </div>
        <div v-if="diffRows.length" class="csd-diff-list">
          <span v-for="row in diffRows.slice(0, 80)" :key="`${row.status}:${row.key}`" :class="row.status">
            {{ recordLine(row) }}
          </span>
          <small v-if="diffRows.length > 80">另有 {{ diffRows.length - 80 }} 条差异未展开</small>
        </div>
      </div>

      <template v-if="tab === 'remote' || recordMode === 'all'">
      <div class="csd-groups" role="tablist" aria-label="基线记录分组">
        <button
          v-for="item in SYNC_RECORD_GROUPS"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="group === item.id"
          :class="{ on: group === item.id }"
          @click="group = item.id"
        >
          {{ item.label }} <span>{{ groupCounts[item.id] }}</span>
        </button>
      </div>

      <div class="csd-tools">
        <div class="csd-search">
          <Icon name="search" :size="12"/>
          <input v-model="query" type="search" placeholder="检索标题、ID 或类型" />
        </div>
        <select v-model="typeFilter" aria-label="按记录类型筛选">
          <option value="all">全部类型</option>
          <option value="workspace">策展台</option>
          <option value="category">分类</option>
          <option value="resource">资源卡</option>
          <option value="task">任务卡</option>
          <option value="curiosity">好奇心卡</option>
          <option value="direction">方向</option>
          <option value="project">项目</option>
          <option value="metric">成功指标</option>
          <option value="dailyFocus">今日三件事</option>
          <option value="event">事件</option>
        </select>
        <button class="csd-time-sort" type="button" @click="sortDir = sortDir === 'desc' ? 'asc' : 'desc'">
          <Icon name="arrowupdown" :size="11" /> {{ sortDir === 'desc' ? '时间倒序' : '时间正序' }}
        </button>
        <span>{{ filteredRecords.length }} 条</span>
      </div>

      <div v-if="activeManifest" class="csd-records">
        <button v-for="row in shownRecords" :key="row.key" type="button" class="csd-record"
          :class="{ deleted: row.deleted }"
          @click="openRecord(row)">
          <span class="csd-type">{{ typeLabel(row.type) }}</span>
          <span class="csd-title">{{ row.title }}</span>
          <span class="csd-time">{{ fmtTime(row.updatedAt) }}</span>
          <span v-if="row.deleted" class="csd-deleted">已删除</span>
          <Icon name="arrowright" :size="11" class="csd-caret"/>
        </button>
        <div v-if="!filteredRecords.length" class="csd-empty">没有匹配的记录</div>
        <div v-if="filteredRecords.length > shownRecords.length" class="csd-more">
          仅展示前 600 条，请用搜索或类型筛选缩小范围。
        </div>
      </div>
      <div v-else class="csd-empty">暂无该端 manifest。成功同步一次后会自动建立。</div>
      </template>
    </template>
  </Drawer>
  <SyncRecordDetailDrawer :open="detailOpen" :record="detailRecord" :source="tab"
    @close="detailOpen = false" />
</template>

<style scoped>
.csd-tabs { display: flex; align-items: center; gap: 5px; margin-bottom: 12px; padding: 3px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.csd-tabs > button[role="tab"] { min-height: 30px; padding: 4px 12px; border: 0; border-radius: 6px; background: transparent; color: var(--text-3); font: inherit; font-size: var(--fs-caption); font-weight: 600; cursor: pointer; }
.csd-tabs > button[role="tab"].on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.csd-tabs .sp { flex: 1; }
.csd-refresh { min-height: 28px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.csd-refresh:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-ink); }
.csd-refresh:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.csd-note, .csd-error { margin-bottom: 10px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font-size: var(--fs-caption); line-height: 1.55; }
.csd-error { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); background: var(--danger-bg-soft); color: var(--danger); }
.csd-loading, .csd-empty { padding: 28px 12px; color: var(--text-3); font-size: var(--fs-sub); text-align: center; }
.csd-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-bottom: 9px; }
.csd-summary div { min-width: 0; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.csd-summary span { display: block; color: var(--text-3); font-size: var(--fs-micro); }
.csd-summary b { display: block; margin-top: 2px; overflow: hidden; color: var(--text); font-size: var(--fs-body); text-overflow: ellipsis; white-space: nowrap; }
.csd-fingerprint { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; padding: 7px 9px; border-radius: 7px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); }
.csd-fingerprint code { color: var(--text-2); font-family: var(--font-mono); }
.csd-fingerprint small { margin-left: auto; }
.csd-view-switch { display: flex; gap: 4px; margin-bottom: 10px; padding: 3px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
.csd-view-switch button { min-height: 28px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--text-3); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.csd-view-switch button span { padding: 0 5px; border-radius: 999px; background: var(--surface-3); color: var(--text-2); font-size: var(--fs-micro); }
.csd-view-switch button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.csd-groups { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; }
.csd-groups button { min-height: 28px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-3); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.csd-groups button span { color: var(--text-2); font-weight: 700; }
.csd-groups button.on { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.csd-diff { margin-bottom: 11px; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.csd-section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; color: var(--text-2); font-size: var(--fs-caption); }
.csd-section-title span { color: var(--warning); }
.csd-section-title span.ok { color: var(--success); }
.csd-diff-chips { display: flex; gap: 5px; margin-bottom: 7px; }
.csd-diff-chips span { padding: 1px 6px; border-radius: 999px; font-size: var(--fs-micro); }
.csd-diff-chips .added { color: var(--success); background: var(--success-bg-soft); }
.csd-diff-chips .removed { color: var(--danger); background: var(--danger-bg-soft); }
.csd-diff-chips .changed { color: var(--warning); background: var(--warning-bg-soft); }
.csd-diff-list { display: flex; flex-direction: column; gap: 3px; max-height: 160px; overflow-y: auto; }
.csd-diff-list span { font-size: var(--fs-micro); line-height: 1.5; }
.csd-diff-list .added { color: var(--success); }
.csd-diff-list .removed { color: var(--danger); }
.csd-diff-list .changed { color: var(--warning); }
.csd-tools { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
.csd-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-3); }
.csd-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: var(--fs-caption); }
.csd-tools select { min-height: 30px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); }
.csd-time-sort { min-height: 30px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); white-space: nowrap; cursor: pointer; }
.csd-tools > span { color: var(--text-3); font-size: var(--fs-micro); white-space: nowrap; }
.csd-records { display: flex; flex-direction: column; gap: 4px; max-height: 44vh; overflow-y: auto; padding-right: 2px; }
.csd-record { position: relative; display: grid; grid-template-columns: 74px minmax(0, 1fr) 118px 46px 14px; align-items: center; gap: 7px; min-height: 35px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; text-align: left; cursor: pointer; }
.csd-record:hover { border-color: var(--accent); }
.csd-record.deleted { opacity: .7; }
.csd-type { padding: 1px 5px; border-radius: 4px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); text-align: center; }
.csd-title { overflow: hidden; font-size: var(--fs-caption); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.csd-time { color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.csd-deleted { color: var(--danger); font-size: var(--fs-micro); }
.csd-more { padding: 7px; color: var(--text-3); font-size: var(--fs-micro); text-align: center; }
@media (max-width: 720px) {
  .csd-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .csd-record { grid-template-columns: 62px minmax(0, 1fr) 14px; }
  .csd-time, .csd-deleted { display: none; }
  .csd-tools { flex-wrap: wrap; }
  .csd-search { flex-basis: 100%; }
}
</style>
