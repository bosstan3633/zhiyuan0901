<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import type { CloudSyncReceipt } from '@/shared/cloud/sync'
import { syncDirectionLabel } from '@/shared/cloud/syncDisplay'
import CloudSyncChangeTable from './CloudSyncChangeTable.vue'

const props = defineProps<{
  open: boolean
  receipt: CloudSyncReceipt | null
}>()
const emit = defineEmits<{ close: [] }>()

const total = computed(() => props.receipt
  ? props.receipt.added + props.receipt.changed + props.receipt.removed
  : 0)
const atText = computed(() => props.receipt?.at
  ? new Date(props.receipt.at).toLocaleString('zh-CN', { hour12: false })
  : '—')
</script>

<template>
  <Modal :open="open" title="本次同步明细" width="min(980px, 94vw)" max-height="86vh" @close="emit('close')">
    <template #title><Icon name="refresh" :size="16" /> 本次同步明细</template>
    <div v-if="receipt" class="csrm" data-testid="cloud-sync-receipt-modal">
      <div class="csrm-hero">
        <span class="csrm-mark" :class="receipt.direction"><Icon :name="receipt.direction === 'upload' ? 'arrowup' : receipt.direction === 'download' ? 'arrowdown' : 'check'" :size="18" /></span>
        <div>
          <h2>{{ syncDirectionLabel(receipt.direction) }}</h2>
          <p>{{ total ? `本次共有 ${total} 条记录变化` : '本次没有记录变化，本机与云端已是最新一致状态' }}</p>
        </div>
        <time>{{ atText }}</time>
      </div>
      <div class="csrm-summary">
        <div><span>新增</span><b>{{ receipt.added }}</b></div>
        <div><span>修改</span><b>{{ receipt.changed }}</b></div>
        <div><span>删除</span><b>{{ receipt.removed }}</b></div>
        <div><span>修订范围</span><b>{{ receipt.fromRevision }} → {{ receipt.toRevision }}</b></div>
      </div>
      <CloudSyncChangeTable :rows="receipt.rows" empty-text="本次同步没有记录变化，已是最新状态" />
      <p class="csrm-note">这里展示记录级摘要与变更字段，不保存或展示完整业务正文、附件本体、令牌与凭据。</p>
    </div>
  </Modal>
</template>

<style scoped>
.csrm { display: flex; flex-direction: column; gap: 12px; }
.csrm-hero { display: flex; align-items: center; gap: 11px; padding: 13px 14px; border: 1px solid var(--border); border-radius: 11px; background: linear-gradient(120deg, var(--surface-2), var(--surface)); }
.csrm-mark { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--accent-light); color: var(--accent-ink); }
.csrm-mark.download { background: var(--tag-info-bg); color: var(--tag-info-text); }
.csrm-mark.latest { background: var(--success-bg-soft); color: var(--success); }
.csrm-hero > div { flex: 1; min-width: 0; }
.csrm-hero h2 { margin: 0; color: var(--text); font-size: var(--fs-title); }
.csrm-hero p { margin: 3px 0 0; color: var(--text-3); font-size: var(--fs-caption); }
.csrm-hero time { flex: none; color: var(--text-3); font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.csrm-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.csrm-summary div { padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.csrm-summary span { display: block; color: var(--text-3); font-size: var(--fs-micro); }
.csrm-summary b { display: block; margin-top: 2px; color: var(--text); font-size: var(--fs-body); }
.csrm-note { margin: 0; padding: 8px 10px; border-radius: 7px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-micro); line-height: 1.55; }
@media (max-width: 720px) {
  .csrm-hero { align-items: flex-start; flex-wrap: wrap; }
  .csrm-hero time { width: 100%; padding-left: 49px; }
  .csrm-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
