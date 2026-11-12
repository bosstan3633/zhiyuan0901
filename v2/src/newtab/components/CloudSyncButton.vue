<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { useAppStore } from '../stores/app'
import CloudSyncReceiptModal from './cloud/CloudSyncReceiptModal.vue'
import CloudSyncHistoryDrawer from './cloud/CloudSyncHistoryDrawer.vue'
import CloudMergeConflictModal from './cloud/CloudMergeConflictModal.vue'
import {
  useCloudSync,
  type CloudConflictChoice,
  type CloudDecisionInfo,
} from '../composables/useCloudSync'
import type { CloudSyncReceipt, CloudSyncTrigger } from '@/shared/cloud/sync'

const router = useRouter()
const store = useAppStore()
const cloud = useCloudSync()
const conflictOpen = ref(false)
const conflictInfo = ref<CloudDecisionInfo | null>(null)
const receiptOpen = ref(false)
const receipt = ref<CloudSyncReceipt | null>(null)
const historyOpen = ref(false)
const panelOpen = ref(false)
const LED_CLASSES = {
  green: 'led-green',
  yellow: 'led-yellow',
  red: 'led-red',
  neutral: 'led-neutral',
} as const
let conflictResolve: ((choice: CloudConflictChoice) => void) | null = null

const title = computed(() =>
  `${cloud.statusText.value} · ${cloud.statusDetail.value} · 最近实际同步 ${cloud.lastSyncLabel.value} · 状态灯：绿=两端一致，黄=有待同步，红=断线`,
)
const busy = computed(() => cloud.state.value === 'syncing')
const shortStatus = computed(() => {
  if (busy.value) return '同步中'
  if (cloud.state.value === 'checking') return '检查中'
  if (cloud.state.value === 'disabled' || cloud.state.value === 'signed_out') return '未连接'
  if (cloud.state.value === 'error' || cloud.ledTone.value === 'red') return '断线'
  if (cloud.relation.value === 'in_sync') return '已同步'
  if (cloud.state.value === 'connected') return '待同步'
  return '连接中'
})
function requestConflict(info: CloudDecisionInfo): Promise<CloudConflictChoice> {
  conflictInfo.value = info
  conflictOpen.value = true
  return new Promise(resolve => { conflictResolve = resolve })
}

function resolveConflict(choice: CloudConflictChoice): void {
  if (!conflictOpen.value) return
  conflictOpen.value = false
  conflictInfo.value = null
  conflictResolve?.(choice)
  conflictResolve = null
}

function showReceiptOrToast(fallback: string): void {
  if (cloud.latestReceipt.value) {
    receipt.value = cloud.latestReceipt.value
    receiptOpen.value = true
  } else {
    showToast(fallback)
  }
}

function closePanelOnOutside(event: MouseEvent): void {
  if (!panelOpen.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.cloud-sync-control')) return
  panelOpen.value = false
}

function openHistory(): void {
  panelOpen.value = false
  historyOpen.value = true
}

function openHistoryReceipt(next: CloudSyncReceipt): void {
  receipt.value = next
  receiptOpen.value = true
}

async function openSettings(): Promise<void> {
  panelOpen.value = false
  await router.push('/settings?page=cloud')
}

async function onSyncClick(trigger: CloudSyncTrigger = 'topbar'): Promise<void> {
  if (busy.value) return
  if (cloud.state.value === 'disabled' || cloud.state.value === 'signed_out') {
    await router.push('/settings?page=cloud')
    return
  }
  const result = await cloud.manualSync(store, requestConflict, trigger)
  if (result.kind === 'needs_setup') {
    await router.push('/settings?page=cloud')
    return
  }
  if (result.kind === 'latest') showReceiptOrToast(`已是最新 · 云端修订 ${result.revision}`)
  else if (result.kind === 'uploaded') showReceiptOrToast(`已同步到云端 · 修订 ${result.revision}`)
  else if (result.kind === 'merged') showReceiptOrToast(`已合并本机与云端改动 · 修订 ${result.revision}`)
  else if (result.kind === 'downloaded') showReceiptOrToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
  else if (result.kind === 'cancelled') showToast('已取消同步，云端与本机均未改变')
  else if (result.kind === 'failed') showToast(`云同步失败：${result.message}`)
}

function onShortcutSync(): void {
  void onSyncClick('shortcut')
}

function syncNetworkState(): void {
  cloud.setNetworkOnline(navigator.onLine)
}

onMounted(() => {
  window.addEventListener('online', syncNetworkState)
  window.addEventListener('offline', syncNetworkState)
  document.addEventListener('click', closePanelOnOutside)
  window.addEventListener('zy:sync-cloud-now', onShortcutSync)
  syncNetworkState()
  void cloud.refreshCloudStatus(true, store)
})
onUnmounted(() => {
  window.removeEventListener('online', syncNetworkState)
  window.removeEventListener('offline', syncNetworkState)
  document.removeEventListener('click', closePanelOnOutside)
  window.removeEventListener('zy:sync-cloud-now', onShortcutSync)
  conflictResolve?.({ action: 'cancel' })
  conflictResolve = null
})
</script>

<template>
  <div class="cloud-sync-control" :class="{ open: panelOpen }">
    <button
      class="cloud-sync-btn"
      :class="[cloud.state.value, cloud.relation.value || 'unknown']"
      type="button"
      :title="title"
      :aria-label="`${shortStatus}，${cloud.statusDetail.value}，最近实际同步 ${cloud.lastSyncLabel.value}，点击手动同步`"
      :aria-busy="busy"
      data-testid="topbar-cloud-sync"
      @click="onSyncClick()"
    >
      <span class="cloud-sync-led" :class="LED_CLASSES[cloud.ledTone.value]" aria-hidden="true"></span>
      <span class="cloud-sync-label">{{ shortStatus }}</span>
    </button>
    <button
      class="cloud-sync-more"
      type="button"
      :aria-expanded="panelOpen"
      title="查看云同步状态、历史与设置"
      data-testid="topbar-cloud-sync-more"
      @click.stop="panelOpen = !panelOpen"
    >
      <span aria-hidden="true">▾</span>
    </button>
    <div v-if="panelOpen" class="cloud-sync-panel" role="dialog" aria-label="云同步摘要">
      <div class="csp-head">
        <span class="cloud-sync-led" :class="LED_CLASSES[cloud.ledTone.value]" aria-hidden="true"></span>
        <div>
          <b>{{ cloud.statusText.value }}</b>
          <p>{{ cloud.statusDetail.value }}</p>
        </div>
      </div>
      <div class="csp-time">
        <span>最近实际同步</span>
        <b>{{ cloud.lastSyncAt.value ? cloud.lastSyncLabel.value : '尚未同步' }}</b>
      </div>
      <div v-if="cloud.meta.value?.autoSyncEnabled" class="csp-auto">
        <Icon name="clock" :size="12" />
        <span>自动同步已开启 · 约每小时安全合并</span>
      </div>
      <div class="csp-actions">
        <button type="button" class="primary" :disabled="busy" @click="onSyncClick()">{{ busy ? '同步中…' : '立即同步' }}</button>
        <button type="button" @click="openHistory"><Icon name="clock" :size="12" /> 同步历史</button>
        <button type="button" @click="openSettings">打开设置</button>
      </div>
      <p class="csp-legend">
        <span class="led-green"></span>一致
        <span class="led-yellow"></span>待同步
        <span class="led-red"></span>断线
      </p>
    </div>
  </div>

  <CloudMergeConflictModal
    :open="conflictOpen"
    :info="conflictInfo"
    @resolve="resolveConflict"
  />

  <CloudSyncReceiptModal :open="receiptOpen" :receipt="receipt" @close="receiptOpen = false" />
  <CloudSyncHistoryDrawer :open="historyOpen" :receipts="cloud.syncReceipts.value" @close="historyOpen = false" @open-receipt="openHistoryReceipt" />
</template>

<style scoped>
.cloud-sync-control { position: relative; display: inline-flex; align-items: center; }
.cloud-sync-btn {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  border-right: 0;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text-2);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--dur), background var(--dur), color var(--dur);
}
.cloud-sync-more {
  width: 24px;
  min-height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text-3);
  font: inherit;
  font-size: 9px;
  cursor: pointer;
}
.cloud-sync-more:hover, .cloud-sync-control.open .cloud-sync-more { border-color: var(--border-strong); background: var(--surface); color: var(--text); }
.cloud-sync-control.open .cloud-sync-btn { border-color: var(--border-strong); background: var(--surface); }
.cloud-sync-panel {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  z-index: var(--z-overlay);
  width: min(340px, calc(100vw - 24px));
  padding: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.csp-head { display: flex; align-items: flex-start; gap: 9px; }
.csp-head .cloud-sync-led { margin-top: 5px; }
.csp-head > div { min-width: 0; }
.csp-head b { display: block; color: var(--text); font-size: var(--fs-sub); }
.csp-head p { margin: 3px 0 0; color: var(--text-3); font-size: var(--fs-caption); line-height: 1.45; }
.csp-time { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; padding: 8px 9px; border-radius: 8px; background: var(--surface-2); color: var(--text-3); font-size: var(--fs-caption); }
.csp-time b { color: var(--text-2); font-weight: 650; }
.csp-auto { display: flex; align-items: center; gap: 5px; margin-top: 8px; color: var(--accent-ink); font-size: var(--fs-micro); }
.csp-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.csp-actions button { min-height: 31px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-caption); cursor: pointer; }
.csp-actions button:hover { border-color: var(--accent); color: var(--accent-ink); }
.csp-actions button.primary { grid-column: 1 / -1; border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 650; }
.csp-actions button:disabled { opacity: var(--opacity-disabled); cursor: wait; }
.csp-legend { display: flex; align-items: center; gap: 4px; margin: 10px 0 0; color: var(--text-3); font-size: var(--fs-micro); }
.csp-legend span { width: 6px; height: 6px; margin-left: 5px; border-radius: 50%; background: var(--text-3); }
.csp-legend span:first-child { margin-left: 0; }
.csp-legend .led-green { background: var(--success); }
.csp-legend .led-yellow { background: var(--warning); }
.csp-legend .led-red { background: var(--danger); }
.cloud-sync-btn:hover { border-color: var(--border-strong); background: var(--surface); color: var(--text); }
.cloud-sync-btn.syncing { border-color: color-mix(in srgb, var(--accent) 42%, var(--border)); color: var(--accent-ink); }
.cloud-sync-btn.error { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); color: var(--tag-danger-text); }
.cloud-sync-btn.local_changed,
.cloud-sync-btn.remote_changed,
.cloud-sync-btn.both_changed,
.cloud-sync-btn.unknown { border-color: color-mix(in srgb, var(--accent) 38%, var(--border)); color: var(--accent-ink); }
.cloud-sync-btn.in_sync { color: var(--text-2); }
.cloud-sync-led {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--text-3);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-3) 14%, transparent);
}
.cloud-sync-led.led-green {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 16%, transparent);
  animation: cloud-breathe-green 2.8s ease-in-out infinite;
}
.cloud-sync-led.led-yellow {
  background: var(--warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--warning) 16%, transparent);
  animation: cloud-breathe-yellow 1.8s ease-in-out infinite;
}
.cloud-sync-led.led-red {
  background: var(--danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 16%, transparent);
  animation: cloud-breathe-red 1.2s ease-in-out infinite;
}
.cloud-sync-led.led-neutral { background: color-mix(in srgb, var(--text-3) 58%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-3) 10%, transparent); }
.cloud-sync-label { font-size: var(--fs-caption); font-weight: 650; }
@keyframes cloud-spin { to { transform: rotate(360deg); } }
@keyframes cloud-breathe-green {
  0%, 100% { opacity: .62; transform: scale(.88); }
  50% { opacity: 1; transform: scale(1.08); }
}
@keyframes cloud-breathe-yellow {
  0%, 100% { opacity: .64; transform: scale(.9); }
  50% { opacity: 1; transform: scale(1.1); }
}
@keyframes cloud-breathe-red {
  0%, 100% { opacity: .68; transform: scale(.92); }
  50% { opacity: 1; transform: scale(1.12); }
}

@media (max-width: 820px) {
  .cloud-sync-btn { min-height: 34px; padding: 4px 8px; }
  .cloud-sync-more { min-height: 34px; }
}
@media (prefers-reduced-motion: reduce) {
  .cloud-sync-led { animation: none !important; }
}
</style>
