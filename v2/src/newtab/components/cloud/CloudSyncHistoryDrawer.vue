<script setup lang="ts">
import { computed } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import Icon from '@/shared/components/Icon.vue'
import type { CloudSyncReceipt } from '@/shared/cloud/sync'
import { syncDirectionLabel } from '@/shared/cloud/syncDisplay'

const props = defineProps<{
  open: boolean
  receipts: CloudSyncReceipt[]
}>()
const emit = defineEmits<{
  close: []
  openReceipt: [receipt: CloudSyncReceipt]
}>()

const rows = computed(() => {
  const oldest = Date.now() - 30 * 24 * 60 * 60 * 1000
  return [...props.receipts]
    .filter(receipt => receipt.at >= oldest)
    .sort((a, b) => b.at - a.at)
    .slice(0, 20)
})

function triggerLabel(trigger: CloudSyncReceipt['trigger']): string {
  if (trigger === 'auto') return '自动同步'
  if (trigger === 'topbar') return '顶栏同步'
  if (trigger === 'shortcut') return '浏览器快捷键'
  return '设置中心'
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
</script>

<template>
  <Drawer :open="open" width="min(560px, 100vw)" @close="emit('close')">
    <template #title>
      <div class="csh-kicker">云同步</div>
      <div class="csh-title">同步历史</div>
    </template>
    <div class="csh" data-testid="cloud-sync-history">
      <div class="csh-note">
        <Icon name="clock" :size="14" />
        默认保留最近 20 次、最长 30 天。动作载荷过期后仍可查看摘要，但不能再处理。
      </div>
      <div v-if="rows.length" class="csh-list">
        <button v-for="receipt in rows" :key="receipt.id" class="csh-item" type="button" @click="emit('openReceipt', receipt)">
          <span class="csh-icon" :class="receipt.direction">
            <Icon :name="receipt.direction === 'upload' ? 'arrowup' : receipt.direction === 'download' ? 'arrowdown' : receipt.direction === 'merge' ? 'refresh' : 'check'" :size="14" />
          </span>
          <span class="csh-main">
            <span class="csh-line">
              <b>{{ syncDirectionLabel(receipt.direction) }}</b>
              <em>{{ triggerLabel(receipt.trigger) }}</em>
            </span>
            <span class="csh-meta">
              <span class="added">新增 {{ receipt.added }}</span>
              <span class="changed">修改 {{ receipt.changed }}</span>
              <span class="removed">删除 {{ receipt.removed }}</span>
              <span>修订 {{ receipt.fromRevision }} → {{ receipt.toRevision }}</span>
            </span>
          </span>
          <span class="csh-tail">
            <time>{{ fmtTime(receipt.at) }}</time>
            <Icon name="arrowright" :size="12" />
          </span>
        </button>
      </div>
      <div v-else class="csh-empty">
        <span><Icon name="clock" :size="22" /></span>
        <b>还没有同步历史</b>
        <p>完成一次上传、拉回或一致性检查后，会在这里保留可重新打开的明细。</p>
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.csh-kicker { color: var(--text-3); font-size: var(--fs-micro); font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
.csh-title { color: var(--text); font-size: var(--fs-title); font-weight: 700; }
.csh { display: flex; flex-direction: column; gap: 12px; }
.csh-note { display: flex; align-items: flex-start; gap: 7px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); line-height: 1.55; }
.csh-note :deep(svg) { flex: none; margin-top: 1px; }
.csh-list { display: flex; flex-direction: column; gap: 7px; }
.csh-item { width: 100%; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.csh-item:hover, .csh-item:focus-visible { border-color: var(--accent); background: var(--accent-light); outline: none; }
.csh-icon { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 9px; background: var(--accent-light); color: var(--accent-ink); }
.csh-icon.download { background: var(--tag-info-bg); color: var(--tag-info-text); }
.csh-icon.latest { background: var(--success-bg-soft); color: var(--success); }
.csh-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.csh-line { display: flex; align-items: center; gap: 7px; min-width: 0; }
.csh-line b { overflow: hidden; color: var(--text); font-size: var(--fs-sub); text-overflow: ellipsis; white-space: nowrap; }
.csh-line em { flex: none; padding: 1px 5px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); font-size: 9px; font-style: normal; }
.csh-meta { display: flex; flex-wrap: wrap; gap: 5px 9px; color: var(--text-3); font-size: var(--fs-micro); }
.csh-meta .added { color: var(--success); }
.csh-meta .removed { color: var(--danger); }
.csh-tail { flex: none; display: flex; align-items: center; gap: 5px; color: var(--text-3); }
.csh-tail time { font-size: var(--fs-micro); font-variant-numeric: tabular-nums; }
.csh-empty { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 24px; border: 1px dashed var(--border); border-radius: 12px; color: var(--text-3); text-align: center; }
.csh-empty > span { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; background: var(--surface-2); }
.csh-empty b { color: var(--text-2); font-size: var(--fs-sub); }
.csh-empty p { max-width: 300px; margin: 0; font-size: var(--fs-caption); line-height: 1.55; }
@media (max-width: 560px) {
  .csh-tail time { display: none; }
  .csh-item { align-items: flex-start; }
}
</style>
