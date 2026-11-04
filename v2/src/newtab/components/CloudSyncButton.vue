<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { useFocusTrap } from '@/shared/utils/focusTrap'
import { useAppStore } from '../stores/app'
import {
  useCloudSync,
  type CloudConflictChoice,
  type CloudDecisionInfo,
} from '../composables/useCloudSync'

const router = useRouter()
const store = useAppStore()
const cloud = useCloudSync()
const nowTick = ref(Date.now())
const conflictOpen = ref(false)
const conflictPanel = ref<HTMLElement | null>(null)
const conflictRelation = ref<CloudDecisionInfo['relation']>('both_changed')
const conflictRemoteRevision = ref(0)
const conflictLocalRevision = ref(0)
let conflictResolve: ((choice: CloudConflictChoice) => void) | null = null
let clockTimer = 0

function onConflictKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !conflictOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  resolveConflict('cancel')
}

useFocusTrap(conflictPanel, () => conflictOpen.value, { initial: 'first' })

const title = computed(() =>
  `${cloud.statusText.value} · ${cloud.statusDetail.value} · 最近实际同步 ${cloud.lastSyncLabel.value}`,
)
const busy = computed(() => cloud.state.value === 'syncing')
const conflictTitle = computed(() => {
  if (conflictRelation.value === 'remote_changed') return '云端有新增，待拉回本机'
  if (conflictRelation.value === 'both_changed') return '本机与云端都有改动'
  if (conflictRelation.value === 'unknown') return '首次确认同步方向'
  return '本机与云端内容不同'
})
const conflictBody = computed(() => {
  if (conflictRelation.value === 'remote_changed') return '云端出现了本机没有的新内容。建议拉回云端；若本机这次修改更重要，也可以覆盖云端。'
  if (conflictRelation.value === 'both_changed') return '两端都相对上次同步发生过改动。请先明确保留哪一端，未选中的一端会被覆盖。'
  if (conflictRelation.value === 'unknown') return '这个版本首次加入内容指纹基线，暂时无法判断哪一端更新。请确认要保留本机还是云端。'
  return '请明确选择保留哪一端。普通卡片附件和 AI 凭据不会进入云端；策展节点附件会使用你的私有 Storage。'
})
const downloadLabel = computed(() => conflictRelation.value === 'remote_changed' ? '拉回云端新增' : '用云端覆盖本机')
const lastSyncCompact = computed(() => {
  const ts = cloud.lastSyncAt.value
  if (!ts) return cloud.state.value === 'connected' ? '尚未同步' : ''
  const diff = Math.max(0, nowTick.value - ts)
  if (diff < 60_000) return '刚刚同步'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 同步`
})

function requestConflict(info: CloudDecisionInfo): Promise<CloudConflictChoice> {
  conflictRelation.value = info.relation
  conflictRemoteRevision.value = info.remoteRevision
  conflictLocalRevision.value = info.localRevision
  conflictOpen.value = true
  return new Promise(resolve => { conflictResolve = resolve })
}

function resolveConflict(choice: CloudConflictChoice): void {
  if (!conflictOpen.value) return
  conflictOpen.value = false
  conflictResolve?.(choice)
  conflictResolve = null
}

async function onSyncClick(): Promise<void> {
  if (busy.value) return
  if (cloud.state.value === 'disabled' || cloud.state.value === 'signed_out') {
    await router.push('/settings?page=cloud')
    return
  }
  const result = await cloud.manualSync(store, requestConflict)
  if (result.kind === 'needs_setup') {
    await router.push('/settings?page=cloud')
    return
  }
  if (result.kind === 'latest') showToast(`已是最新 · 云端修订 ${result.revision}`)
  else if (result.kind === 'uploaded') showToast(`已同步到云端 · 修订 ${result.revision}`)
  else if (result.kind === 'downloaded') showToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
  else if (result.kind === 'cancelled') showToast('已取消同步，云端与本机均未改变')
  else if (result.kind === 'failed') showToast(`云同步失败：${result.message}`)
}

onMounted(() => {
  void cloud.refreshCloudStatus(true, store)
  clockTimer = window.setInterval(() => { nowTick.value = Date.now() }, 60_000)
  document.addEventListener('keydown', onConflictKeydown, true)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  document.removeEventListener('keydown', onConflictKeydown, true)
  conflictResolve?.('cancel')
  conflictResolve = null
})
</script>

<template>
  <button
    class="cloud-sync-btn"
    :class="[cloud.state.value, cloud.relation.value || 'unknown']"
    type="button"
    :title="title"
    :aria-label="`${cloud.statusText.value}，${cloud.statusDetail.value}，最近实际同步 ${cloud.lastSyncLabel.value}，点击手动同步`"
    :aria-busy="busy"
    data-testid="topbar-cloud-sync"
    @click="onSyncClick"
  >
    <span class="cloud-sync-icon" aria-hidden="true">
      <Icon :name="busy ? 'refresh' : cloud.state.value === 'error' ? 'warn' : 'plug'" :size="14" />
    </span>
    <span class="cloud-sync-copy">
      <span class="cloud-sync-label">{{ cloud.statusText.value }}</span>
      <span v-if="lastSyncCompact" class="cloud-sync-time">{{ lastSyncCompact }}</span>
    </span>
  </button>

  <Teleport to="body">
    <div v-if="conflictOpen" class="cloud-conflict-mask" data-a11y-container @click.self="resolveConflict('cancel')">
      <section ref="conflictPanel" class="cloud-conflict" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="cloud-conflict-title" aria-describedby="cloud-conflict-body">
        <header>
          <span class="cloud-conflict-mark"><Icon name="plug" :size="16" /></span>
          <div>
            <h2 id="cloud-conflict-title">{{ conflictTitle }}</h2>
            <p>本机修订 {{ conflictLocalRevision }} · 云端修订 {{ conflictRemoteRevision }}</p>
          </div>
        </header>
        <p id="cloud-conflict-body" class="cloud-conflict-body">{{ conflictBody }}</p>
        <div class="cloud-conflict-actions">
          <button class="cancel" type="button" @click="resolveConflict('cancel')">取消</button>
          <button :class="{ primary: conflictRelation === 'remote_changed' }" type="button" @click="resolveConflict('download')">{{ downloadLabel }}</button>
          <button :class="{ primary: conflictRelation !== 'remote_changed' }" type="button" @click="resolveConflict('upload')">本机覆盖云端</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.cloud-sync-btn {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text-2);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--dur), background var(--dur), color var(--dur);
}
.cloud-sync-btn:hover { border-color: var(--border-strong); background: var(--surface); color: var(--text); }
.cloud-sync-btn.syncing { border-color: color-mix(in srgb, var(--accent) 42%, var(--border)); color: var(--accent-ink); }
.cloud-sync-btn.error { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); color: var(--tag-danger-text); }
.cloud-sync-btn.local_changed,
.cloud-sync-btn.remote_changed,
.cloud-sync-btn.both_changed,
.cloud-sync-btn.unknown { border-color: color-mix(in srgb, var(--accent) 38%, var(--border)); color: var(--accent-ink); }
.cloud-sync-btn.in_sync { color: var(--text-2); }
.cloud-sync-icon { display: inline-flex; flex: none; }
.cloud-sync-btn.syncing .cloud-sync-icon { animation: cloud-spin 1.1s linear infinite; }
.cloud-sync-copy { display: inline-flex; align-items: baseline; gap: 5px; min-width: 0; }
.cloud-sync-label { font-size: var(--fs-caption); font-weight: 650; }
.cloud-sync-time { font-size: var(--fs-micro); color: var(--text-3); }
@keyframes cloud-spin { to { transform: rotate(360deg); } }

.cloud-conflict-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-confirm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / .42);
  backdrop-filter: blur(3px);
}
.cloud-conflict {
  width: min(480px, calc(100vw - 32px));
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.cloud-conflict header { display: flex; align-items: flex-start; gap: 10px; }
.cloud-conflict-mark {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--accent-ink);
  background: var(--accent-light);
}
.cloud-conflict h2 { margin: 0; font-size: var(--fs-title); color: var(--text); }
.cloud-conflict header p { margin: 4px 0 0; font-size: var(--fs-caption); color: var(--text-3); }
.cloud-conflict-body { margin: 16px 0 20px; font-size: var(--fs-sub); line-height: 1.65; color: var(--text-2); }
.cloud-conflict-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.cloud-conflict-actions button {
  min-height: 32px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-2);
  font: inherit;
  font-size: var(--fs-caption);
  cursor: pointer;
}
.cloud-conflict-actions button:hover { border-color: var(--border-strong); color: var(--text); }
.cloud-conflict-actions .primary { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 650; }
.cloud-conflict-actions .primary:hover { background: var(--accent-hover); }
.cloud-conflict-actions .cancel { margin-right: auto; }
@media (max-width: 820px) {
  .cloud-sync-btn { min-height: 34px; padding: 4px 8px; }
  .cloud-sync-copy { flex-direction: column; align-items: flex-start; gap: 0; }
  .cloud-sync-time { display: block; font-size: var(--fs-micro); line-height: 1.25; }
}
</style>
