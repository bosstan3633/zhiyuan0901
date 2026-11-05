<script setup lang="ts">
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { SyncManifestDiffRow } from '@/shared/cloud/sync'
import CloudSyncChangeTable from './CloudSyncChangeTable.vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  intro?: string
  rows: SyncManifestDiffRow[]
  loading?: boolean
  error?: string
}>(), {
  intro: '',
  loading: false,
  error: '',
})
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Drawer :open="open" width="720px" @close="emit('close')">
    <template #title><Icon name="refresh" :size="15" /> {{ title }}</template>
    <div class="cscd">
      <p v-if="intro" class="cscd-intro">{{ intro }}</p>
      <div v-if="loading" class="cscd-state">正在读取本机基线与当前改动…</div>
      <div v-else-if="error" class="cscd-state error">{{ error }}</div>
      <CloudSyncChangeTable
        v-else
        :rows="rows"
        :empty-text="title.includes('最近') ? '本次同步没有记录发生变化，已是最新状态' : '本机当前没有待上传改动'"
      />
    </div>
  </Drawer>
</template>

<style scoped>
.cscd { display: flex; flex-direction: column; gap: 12px; }
.cscd-intro { margin: 0; padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font-size: var(--fs-caption); line-height: 1.65; }
.cscd-state { padding: 34px 16px; border: 1px dashed var(--border); border-radius: 10px; color: var(--text-3); font-size: var(--fs-sub); text-align: center; }
.cscd-state.error { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); background: var(--danger-bg-soft); color: var(--danger); }
</style>
