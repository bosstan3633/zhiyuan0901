<script setup lang="ts">
/** 画像指标下钻：保留对账口径、搜索与翻页；点击行交给宿主直接打开卡片。 */
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import Icon from '@/shared/components/Icon.vue'

export interface PiStatRow { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; ts: number; owner?: string }
export interface PiReconCell { k: string; n: string; u?: string; warn?: boolean }

const props = defineProps<{
  open: boolean
  title: string
  rows: PiStatRow[]
  filteredCount: number
  totalCount: number
  search: string
  page: number
  pageCount: number
  pageSize: 20
  reconcile: PiReconCell[] | null
  reconcileNote: string
}>()
const emit = defineEmits<{
  close: []
  'update:search': [value: string]
  page: [delta: number]
  'open-card': [row: PiStatRow]
}>()

const filteredEmpty = computed(() => props.filteredCount === 0)
const dateLabel = (ts: number) => ts ? `${new Date(ts).getMonth() + 1}-${new Date(ts).getDate()}` : ''
const statKindIcon = (kind: PiStatRow['kind']) => kind === 'task' ? 'checksquare' : kind === 'curiosity' ? 'bulb' : 'filetext'
const statKindLabel = (kind: PiStatRow['kind']) => kind === 'task' ? '任务' : kind === 'curiosity' ? '好奇' : '资源'
</script>

<template>
  <Drawer :open="open" :title="title" width="520px" @close="emit('close')">
    <div class="metric-drawer">
      <div v-if="reconcile?.length" class="recon">
        <div v-for="(cell, i) in reconcile" :key="i" class="recon-cell" :class="{ warn: cell.warn }">
          <span class="k">{{ cell.k }}</span>
          <span class="n">{{ cell.n }}<small v-if="cell.u">{{ cell.u }}</small></span>
        </div>
      </div>
      <p v-if="reconcileNote" class="recon-note">{{ reconcileNote }}</p>
      <div class="search">
        <input :value="search" placeholder="搜索标题 / 归属 / 说明"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)">
        <span class="count">{{ filteredCount }} 条</span>
      </div>
      <div class="list">
        <button v-for="row in rows" :key="row.id" class="row" @click="emit('open-card', row)">
          <span class="kind"><Icon :name="statKindIcon(row.kind)" :size="13"/></span>
          <span class="badge">{{ statKindLabel(row.kind) }}</span>
          <span class="title">{{ row.title }}</span>
          <span v-if="row.owner" class="gs-ev-owner">{{ row.owner }}</span>
          <span class="time">{{ dateLabel(row.ts) }}</span>
        </button>
        <EmptyState v-if="filteredEmpty" size="inline" icon="folder"
          :title="search.trim() ? '没有匹配的卡片' : '还没有可列出的卡片'"
          :hint="search.trim() ? '换个更短的关键词，或清空搜索。' : '采集或新建卡片后，这里会按时间列出每一次变化。'"/>
        <div v-if="totalCount" class="hint"><Icon name="bulb" :size="13"/> 单击任务或好奇心打开详情；资源有链接时直接打开，无链接时打开详情。</div>
      </div>
      <div v-if="pageCount > 1" class="pager">
        <button :disabled="page <= 1" @click="emit('page', -1)">‹ 上一页</button>
        <span>第 {{ page }} / {{ pageCount }} 页 · 每页 {{ pageSize }} 条</span>
        <button :disabled="page >= pageCount" @click="emit('page', 1)">下一页 ›</button>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.metric-drawer { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; }
.recon { display: flex; gap: 8px; flex-wrap: wrap; }
.recon-cell { flex: 1 1 92px; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding: 6px 9px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.recon-cell .k { overflow: hidden; color: var(--text-4); font-size: var(--fs-micro); text-overflow: ellipsis; white-space: nowrap; }
.recon-cell .n { color: var(--text); font-size: var(--fs-sub); font-weight: 700; font-variant-numeric: tabular-nums; }
.recon-cell .n small { margin-left: 2px; color: var(--text-4); font-size: var(--fs-micro); font-weight: 400; }
.recon-cell.warn .n { color: var(--warning); }
.recon-note { margin: 0; color: var(--text-4); font-size: var(--fs-micro); line-height: 1.6; }
.search { display: flex; align-items: center; gap: 8px; }
.search input { flex: 1; padding: 6px 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-family: inherit; font-size: var(--fs-sub); }
.search input:focus { outline: none; border-color: var(--accent); }
.search .count { color: var(--text-3); font-size: var(--fs-caption); white-space: nowrap; }
.list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.row { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: inherit; font-family: inherit; font-size: var(--fs-sub); text-align: left; cursor: pointer; }
.row:hover { border-color: var(--border-strong); background: var(--surface-2); }
.kind { flex: none; }
.badge { flex: none; padding: 1px 6px; border: 1px solid var(--border); border-radius: 4px; color: var(--text-3); font-size: var(--fs-tiny); }
.title { flex: 1; min-width: 0; overflow: hidden; color: var(--text); text-overflow: ellipsis; white-space: nowrap; }
.gs-ev-owner { flex: none; color: var(--text-3); font-size: var(--fs-tiny); }
.time { flex: none; color: var(--text-4); font-size: var(--fs-tiny); font-variant-numeric: tabular-nums; }
.hint { margin-top: 8px; color: var(--text-3); font-size: var(--fs-caption); }
.pager { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-3); font-size: var(--fs-caption); }
.pager button { padding: 3px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2); font-family: inherit; font-size: var(--fs-caption); cursor: pointer; }
.pager button:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.pager button:disabled { opacity: var(--opacity-disabled); cursor: default; }
</style>
