<script setup lang="ts">
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { CurationHistoryEntry } from '@/newtab/composables/useCurationCanvasHistory'

defineProps<{
  open: boolean
  entries: CurationHistoryEntry[]
  currentId: string
}>()

const emit = defineEmits<{
  close: []
  rollback: [id: string]
}>()

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <Drawer :open="open" width="460px" @close="emit('close')">
    <template #title>
      <Icon name="clock" :size="15"/>
      <span>画布操作记录</span>
    </template>

    <div class="chd">
      <div class="chd-note">
        <Icon name="alert" :size="13"/>
        <span>保留当前会话最近 10 步。回滚会作为一条新操作写入记录，可再次撤销。</span>
      </div>

      <ol v-if="entries.length" class="chd-list">
        <li v-for="(entry, index) in entries" :key="entry.id" class="chd-item"
          :class="{ current: entry.id === currentId }">
          <span class="chd-index">{{ String(entries.length - index).padStart(2, '0') }}</span>
          <div class="chd-copy">
            <b>{{ entry.label }}</b>
            <time :datetime="new Date(entry.timestamp).toISOString()">{{ fmtTime(entry.timestamp) }}</time>
          </div>
          <span v-if="entry.id === currentId" class="chd-current">当前</span>
          <button v-else type="button" class="chd-rollback" @click="emit('rollback', entry.id)">
            回滚到此
          </button>
        </li>
      </ol>

      <div v-else class="chd-empty">
        <Icon name="clock" :size="24"/>
        <b>还没有画布操作</b>
        <span>创建分支、修改标题或调整节点后，记录会出现在这里。</span>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.chd { display: flex; flex-direction: column; gap: 14px; }
.chd-note { display: flex; align-items: flex-start; gap: 7px; padding: 10px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); line-height: 1.6; }
.chd-note :deep(svg) { flex: none; margin-top: 2px; }
.chd-list { display: flex; flex-direction: column; gap: 7px; margin: 0; padding: 0; list-style: none; }
.chd-item { display: flex; align-items: center; gap: 9px; padding: 10px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); }
.chd-item.current { border-color: color-mix(in srgb, var(--accent) 42%, var(--border)); background: var(--accent-light); }
.chd-index { flex: none; width: 25px; color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.chd-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.chd-copy b { color: var(--text); font-size: var(--fs-sub); font-weight: 600; overflow-wrap: anywhere; }
.chd-copy time { color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.chd-current { flex: none; padding: 2px 7px; border-radius: 999px; background: var(--accent); color: #fff; font-size: var(--fs-micro); font-weight: 700; }
.chd-rollback { flex: none; min-height: 28px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-micro); cursor: pointer; }
.chd-rollback:hover { border-color: var(--accent); background: var(--accent-light); color: var(--accent-ink); }
.chd-empty { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 34px 16px; border: 1px dashed var(--border); border-radius: 10px; color: var(--text-3); text-align: center; }
.chd-empty b { color: var(--text-2); font-size: var(--fs-sub); }
.chd-empty span { font-size: var(--fs-caption); line-height: 1.6; }
</style>
