<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '../../stores/app'
import Icon from '@/shared/components/Icon.vue'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { diffSyncManifests, syncDiffRows, type CloudSyncReceipt, type SyncManifestDiffRow } from '@/shared/cloud/sync'
import {
  useCloudSync,
  type CloudSyncDetails,
  type CloudConflictChoice,
  type CloudDecisionInfo,
} from '../../composables/useCloudSync'
import CloudSyncChangesDrawer from '@/newtab/components/cloud/CloudSyncChangesDrawer.vue'
import CloudSyncReceiptModal from '@/newtab/components/cloud/CloudSyncReceiptModal.vue'
import CloudSyncHistoryDrawer from '@/newtab/components/cloud/CloudSyncHistoryDrawer.vue'
import CloudMergeConflictModal from '@/newtab/components/cloud/CloudMergeConflictModal.vue'
import CloudSyncDetailDrawer from './CloudSyncDetailDrawer.vue'

const store = useAppStore()
const sharedCloud = useCloudSync()
const env = ref<{ url: string; anonKey: string } | null>(null)
const cfgOpen = ref(false)
const cfgUrl = ref('')
const cfgKey = ref('')
const cfgUrlErr = ref('')
const cfgKeyErr = ref('')
const cfgSaved = ref(false)
const configSaving = ref(false)
const email = ref('')
const password = ref('')
const pageBusy = ref(false)
const conflictOpen = ref(false)
const conflictInfo = ref<CloudDecisionInfo | null>(null)
const syncDetailOpen = ref(false)
const syncDetailTab = ref<'local' | 'remote'>('local')
const syncDetailLoading = ref(false)
const syncDetailError = ref('')
const syncDetails = ref<CloudSyncDetails | null>(null)
const changesOpen = ref(false)
const changesTitle = ref('')
const changesIntro = ref('')
const changesRows = ref<SyncManifestDiffRow[]>([])
const changesLoading = ref(false)
const changesError = ref('')
const receiptOpen = ref(false)
const receipt = ref<CloudSyncReceipt | null>(null)
const historyOpen = ref(false)
let conflictResolve: ((choice: CloudConflictChoice) => void) | null = null

const meta = sharedCloud.meta
const loggedIn = computed(() => !!meta.value?.refreshToken)
const busy = computed(() =>
  pageBusy.value
  || configSaving.value
  || sharedCloud.state.value === 'checking'
  || sharedCloud.state.value === 'syncing',
)
const badgeState = computed(() => {
  if (sharedCloud.state.value === 'error') return 'error'
  if (sharedCloud.state.value === 'disabled' || sharedCloud.state.value === 'signed_out') return 'idle'
  if (sharedCloud.state.value === 'checking' || sharedCloud.state.value === 'syncing') return 'checking'
  return 'connected'
})
const badgeText = computed(() => {
  if (sharedCloud.state.value === 'disabled') return '未配置'
  if (sharedCloud.state.value === 'signed_out') return '未登录'
  if (sharedCloud.state.value === 'error') return '异常'
  if (sharedCloud.state.value === 'checking') return '检查中'
  if (sharedCloud.state.value === 'syncing') return '同步中'
  return '已连接'
})

const relationTitle = computed(() => sharedCloud.relationActionLabel.value)
const relationDetail = computed(() => {
  switch (sharedCloud.relation.value) {
    case 'local_changed': return '建议同步到云端。云端没有比本机更新的内容，可以直接一键上传。'
    case 'remote_changed': return '建议从云端拉回。云端出现了本机没有的新内容，一键同步会先请你确认。'
    case 'both_changed': return '两边都有改动。不同记录与不同字段会自动合并；只有同一字段出现不同值时才请你逐项确认。'
    case 'in_sync': return '当前内容指纹一致，不需要上传或拉回。'
    case 'empty_remote': return '本机已有内容，云端为空。建议将本机内容首次上传到云端。'
    case 'unknown': return '尚未建立共同基线。同步会保守合并不同记录与不同字段；同一字段出现不同值时才请你逐项确认。'
    default: return '点击“重新检查”读取云端与本地的最新关系。'
  }
})

const relationTone = computed(() => {
  if (sharedCloud.state.value === 'error') return 'error'
  switch (sharedCloud.relation.value) {
    case 'in_sync': return 'ok'
    case 'local_changed':
    case 'remote_changed':
    case 'both_changed':
    case 'unknown': return 'attention'
    case 'empty_remote': return 'neutral'
    default: return 'neutral'
  }
})

const recommendedAction = computed(() => {
  switch (sharedCloud.relation.value) {
    case 'local_changed':
    case 'empty_remote': return '同步到云端'
    case 'remote_changed': return '拉回云端新增'
    case 'both_changed':
    case 'unknown': return '自动合并，冲突时逐项确认'
    case 'in_sync': return '无需同步'
    default: return '先检查云端'
  }
})

const lastSyncText = computed(() => sharedCloud.lastSyncAt.value
  ? new Date(sharedCloud.lastSyncAt.value).toLocaleString('zh-CN')
  : '尚未实际同步')
const lastCheckedText = computed(() => meta.value?.lastCheckedAt
  ? new Date(meta.value.lastCheckedAt).toLocaleString('zh-CN')
  : '尚未检查')
const localRevisionText = computed(() => meta.value?.revision ? String(meta.value.revision) : '0')
const remoteRevisionText = computed(() => sharedCloud.checkResult.value?.remoteRevision
  ? String(sharedCloud.checkResult.value.remoteRevision)
  : '0')
const relationUpdatedText = computed(() => {
  if (sharedCloud.state.value === 'checking') return '正在检查本机与云端关系…'
  if (sharedCloud.state.value === 'syncing') return '正在执行同步，请稍候…'
  if (sharedCloud.state.value === 'error') return sharedCloud.errorMessage.value || '云端连接异常'
  return relationTitle.value
})
const autoSyncStatusText = computed(() => {
  if (meta.value?.lastAutoResult === 'uploaded') return `最近自动上传成功 · ${meta.value.lastAutoSyncAt ? new Date(meta.value.lastAutoSyncAt).toLocaleString('zh-CN', { hour12: false }) : ''}`
  if (meta.value?.lastAutoResult === 'latest') return '最近自动检查时已是最新'
  if (meta.value?.lastAutoResult === 'blocked') return `自动同步已暂停：${meta.value.lastAutoError || '存在需要人工确认的变化'}`
  if (meta.value?.lastAutoResult === 'failed') return `最近自动同步失败：${meta.value.lastAutoError || '未知错误'}`
  if (meta.value?.lastAutoResult === 'signed_out') return '账号登录状态失效，自动同步已暂停'
  return '默认关闭；启用后约每 60 分钟安全合并一次，不自动用单端快照覆盖另一端'
})
const nextAutoSyncText = computed(() => meta.value?.autoSyncEnabled && meta.value?.nextAutoSyncAt
  ? `下一次预计检查：${new Date(meta.value.nextAutoSyncAt).toLocaleString('zh-CN', { hour12: false })}`
  : '')

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toastError(prefix: string, error: unknown): void {
  showToast(`${prefix}：${errText(error)}`)
}

async function loadCloud(): Promise<void> {
  try {
    const client = await import('@/shared/cloud/client')
    const current = await client.cloudEnv()
    env.value = current
    cfgOpen.value = !current
    const defaults = client.cloudEnvDefaults()
    cfgUrl.value = current?.url || defaults.url
    cfgKey.value = current?.anonKey || defaults.anonKey
    await sharedCloud.refreshCloudStatus(false)
    if (loggedIn.value) {
      await sharedCloud.ensureRelationProbe(store)
    }
  } catch (error) {
    showToast(`读取云端配置失败：${errText(error)}`)
  }
}

onMounted(() => {
  void loadCloud()
})
onBeforeUnmount(() => {
  conflictResolve?.({ action: 'cancel' })
  conflictResolve = null
  conflictOpen.value = false
  conflictInfo.value = null
})

async function saveConfig(): Promise<void> {
  if (configSaving.value) return
  const url = cfgUrl.value.trim().replace(/\/$/, '')
  const anonKey = cfgKey.value.trim()
  cfgUrlErr.value = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    ? ''
    : '请填写项目根地址，例如 https://your-project.supabase.co'
  cfgKeyErr.value = anonKey.startsWith('sb_publishable_')
    ? ''
    : '请填写 Supabase publishable key（以 sb_publishable_ 开头）'
  if (cfgUrlErr.value || cfgKeyErr.value) {
    showToast('云端配置字段有误，请按提示修正')
    return
  }
  configSaving.value = true
  try {
    const client = await import('@/shared/cloud/client')
    await client.setCloudEnvOverride({ url, anonKey })
    env.value = { url, anonKey }
    cfgOpen.value = false
    cfgSaved.value = true
    window.setTimeout(() => { cfgSaved.value = false }, 2000)
    await sharedCloud.refreshCloudStatus(false)
    showToast('云端配置已保存')
  } catch (error) {
    toastError('保存云端配置失败', error)
  } finally {
    configSaving.value = false
  }
}

async function doLogin(): Promise<void> {
  if (!env.value) {
    showToast('云端未配置，请先填写项目地址与 publishable key')
    return
  }
  if (!email.value.trim() || !password.value) {
    showToast('请输入邮箱与密码')
    return
  }
  pageBusy.value = true
  try {
    const sync = await import('@/shared/cloud/sync')
    await sync.login(email.value, password.value)
    password.value = ''
    await sharedCloud.refreshCloudStatus(false)
    await sharedCloud.ensureRelationProbe(store, true)
    if (sharedCloud.meta.value?.autoSyncEnabled) {
      await chrome.runtime.sendMessage({ type: 'zy-auto-sync-config', enabled: true }).catch(() => {})
    }
    showToast('云端登录成功')
  } catch (error) {
    toastError('登录失败', error)
  } finally {
    pageBusy.value = false
  }
}

async function doLogout(): Promise<void> {
  const ok = await useConfirm({
    title: '退出云端账号',
    message: '退出后本机不再自动检查云端，也不会上传或下载。本地数据不受影响。',
    confirmText: '退出登录',
  })
  if (!ok) return
  try {
    const sync = await import('@/shared/cloud/sync')
    await sync.logout()
    await chrome.runtime.sendMessage({ type: 'zy-auto-sync-config', enabled: false }).catch(() => {})
    conflictResolve?.({ action: 'cancel' })
    conflictResolve = null
    conflictOpen.value = false
    await sharedCloud.refreshCloudStatus(false)
    showToast('已退出云端账号')
  } catch (error) {
    toastError('退出失败', error)
  }
}

async function doCheck(): Promise<void> {
  if (!loggedIn.value || pageBusy.value) return
  pageBusy.value = true
  try {
    await sharedCloud.ensureRelationProbe(store, true)
  } catch (error) {
    toastError('检查云端关系失败', error)
  } finally {
    pageBusy.value = false
  }
}

async function openSyncDetails(tab: 'local' | 'remote'): Promise<void> {
  syncDetailTab.value = tab
  syncDetailOpen.value = true
  syncDetailLoading.value = true
  syncDetailError.value = ''
  try {
    syncDetails.value = await sharedCloud.loadSyncDetails(store)
  } catch (error) {
    syncDetailError.value = `读取同步明细失败：${errText(error)}`
  } finally {
    syncDetailLoading.value = false
  }
}

async function openPendingChanges(): Promise<void> {
  changesTitle.value = '本机待上传明细'
  changesIntro.value = '以下记录来自“本机当前内容”与“上次成功同步基线”的差异。同步成功后，这份清单会成为本次上传回执。'
  changesRows.value = []
  changesError.value = ''
  changesOpen.value = true
  changesLoading.value = true
  try {
    const details = await sharedCloud.loadSyncDetails(store)
    syncDetails.value = details
    const diff = diffSyncManifests(details?.localManifest || null, details?.currentLocalManifest || null)
    changesRows.value = syncDiffRows(diff)
    if (details?.refreshError) {
      changesIntro.value += ` 云端检查失败，以下仍按本机基线计算：${details.refreshError}`
    }
  } catch (error) {
    changesError.value = `读取本机待上传明细失败：${errText(error)}`
  } finally {
    changesLoading.value = false
  }
}

function openLatestReceipt(): void {
  const current = sharedCloud.latestReceipt.value
  changesTitle.value = '最近实际同步内容'
  changesIntro.value = current
    ? `${new Date(current.at).toLocaleString('zh-CN', { hour12: false })} · 修订 ${current.fromRevision} → ${current.toRevision}`
    : '还没有实际同步回执。成功执行一次上传、拉回或一致性检查后，这里会显示本次同步实际变化的记录。'
  changesRows.value = current?.rows || []
  changesError.value = ''
  changesLoading.value = false
  changesOpen.value = true
}

function showReceiptModal(): void {
  const current = sharedCloud.latestReceipt.value
  if (!current) return
  receipt.value = current
  receiptOpen.value = true
}

function openHistory(): void {
  historyOpen.value = true
}

function openHistoryReceipt(next: CloudSyncReceipt): void {
  receipt.value = next
  receiptOpen.value = true
}

function openRelationDetails(): void {
  if (sharedCloud.relation.value === 'remote_changed') {
    void openSyncDetails('remote')
    return
  }
  if (sharedCloud.relation.value === 'in_sync' && sharedCloud.latestReceipt.value) {
    openLatestReceipt()
    return
  }
  void openPendingChanges()
}

async function updateStartupCheck(checked: boolean): Promise<void> {
  try {
    const sync = await import('@/shared/cloud/sync')
    await sync.setCheckOnStart(checked)
    await sharedCloud.refreshCloudStatus(false)
  } catch (error) {
    toastError('保存启动检查设置失败', error)
  }
}

async function updateAutoSync(checked: boolean): Promise<void> {
  try {
    const sync = await import('@/shared/cloud/sync')
    const next = await sync.setAutoSyncEnabled(checked)
    sharedCloud.meta.value = next
    chrome.runtime.sendMessage({ type: 'zy-auto-sync-config', enabled: checked }).catch(() => {})
    showToast(checked ? '已开启自动同步：约每 60 分钟自动合并，同字段冲突会暂停等待确认' : '已关闭自动同步；登录状态和上次设置会保留')
  } catch (error) {
    toastError('保存自动同步设置失败', error)
  }
}

async function updateCurationAssetSync(checked: boolean): Promise<void> {
  try {
    const sync = await import('@/shared/cloud/sync')
    const next = await sync.setCurationAssetSyncEnabled(checked)
    sharedCloud.meta.value = next
    if (checked && store.data) {
      const changed = await sync.retryPendingCurationAssets(store.data)
      if (changed) store.persist()
    }
    showToast(checked ? '已开启策展节点附件云同步' : '已关闭策展节点附件云同步；新附件仅保存在本机')
  } catch (error) {
    toastError('保存附件同步设置失败', error)
  }
}

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

async function syncNow(): Promise<void> {
  if (busy.value) return
  const result = await sharedCloud.manualSync(store, requestConflict)
  if (result.kind === 'latest') { showToast(`已是最新 · 云端修订 ${result.revision}`); showReceiptModal() }
  else if (result.kind === 'uploaded') { showToast(`已同步到云端 · 修订 ${result.revision}`); showReceiptModal() }
  else if (result.kind === 'merged') { showToast(`已合并本机与云端改动 · 修订 ${result.revision}`); showReceiptModal() }
  else if (result.kind === 'downloaded') { showToast(`已从云端恢复到本机 · 修订 ${result.revision}`); showReceiptModal() }
  else if (result.kind === 'cancelled') showToast('已取消同步，云端与本机均未改变')
  else if (result.kind === 'failed') showToast(`云同步失败：${result.message}`)
  else if (result.kind === 'needs_setup') showToast('请先完成云端配置与登录')
}

async function uploadOnly(): Promise<void> {
  if (busy.value || !loggedIn.value) return
  try {
    const result = await sharedCloud.uploadCurrent(store, requestConflict)
    if (result.kind === 'uploaded') { showToast(`已上传到云端 · 修订 ${result.revision}`); showReceiptModal() }
    else if (result.kind === 'merged') { showToast(`已合并并上传 · 修订 ${result.revision}`); showReceiptModal() }
    else if (result.kind === 'downloaded') { showToast(`已从云端恢复到本机 · 修订 ${result.revision}`); showReceiptModal() }
    else if (result.kind === 'cancelled') showToast('已取消同步，云端与本机均未改变')
    else if (result.kind === 'failed') showToast(`云同步失败：${result.message}`)
    else if (result.kind === 'needs_setup') showToast('请先完成云端配置与登录')
    else showToast(`已是最新 · 云端修订 ${result.revision}`)
  } catch (error) {
    toastError('上传失败', error)
  }
}

async function downloadOnly(): Promise<void> {
  if (busy.value || !loggedIn.value) return
  const ok = await useConfirm({
    title: '从云端拉回本机',
    message: '将用云端快照整体覆盖本机卡片、方向、策展台与事件日志。普通卡片附件本体保留在本机；策展节点附件元数据随快照恢复，缺失的附件会在打开时从私有 Storage 下载。AI 凭据不上云。',
    confirmText: '用云端覆盖本机',
  })
  if (!ok) return
  try {
    const result = await sharedCloud.downloadCurrent(store)
    showToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
    showReceiptModal()
  } catch (error) {
    toastError('恢复失败', error)
  }
}

</script>

<template>
<div>
  <div class="gs-card cloud-relation-card" :class="relationTone" data-testid="cloud-relation-overview">
    <button class="cloud-relation-head" type="button" data-testid="cloud-relation-details-trigger" @click="openRelationDetails">
      <div>
        <div class="cloud-relation-kicker">本机 ↔ 云端</div>
        <h3>{{ relationUpdatedText }}</h3>
        <p>{{ relationDetail }}</p>
      </div>
      <div class="cloud-relation-badge">
        <span class="gs-status-badge" :class="badgeState"><span class="gs-status-dot"></span>{{ badgeText }}</span>
        <span class="cloud-recommend">建议：{{ recommendedAction }}</span>
      </div>
    </button>
    <div class="cloud-relation-facts">
      <button type="button" class="cloud-fact-button" title="查看本机基线与记录级明细" @click="openSyncDetails('local')">
        <span>本机同步基线</span><b>修订 {{ localRevisionText }}</b><small>查看明细</small>
      </button>
      <button type="button" class="cloud-fact-button" title="查看云端当前修订与记录级明细" @click="openSyncDetails('remote')">
        <span>云端当前修订</span><b>修订 {{ remoteRevisionText }}</b><small>查看明细</small>
      </button>
      <button type="button" class="cloud-fact-button" data-testid="latest-sync-receipt-trigger" title="查看最近一次实际同步的内容明细" @click="openLatestReceipt">
        <span>最近实际同步</span><b>{{ lastSyncText }}</b><small>查看同步内容</small>
      </button>
      <div><span>最近检查</span><b>{{ lastCheckedText }}</b></div>
    </div>
    <div v-if="loggedIn" class="cloud-relation-actions">
      <button class="gs-btn gs-btn-primary" :disabled="busy" data-testid="cloud-sync-now" @click="syncNow">
        {{ sharedCloud.state.value === 'syncing' ? '同步中…' : '按当前关系同步' }}
      </button>
      <button class="gs-btn" :disabled="busy" @click="uploadOnly">仅上传本机</button>
      <button class="gs-btn" :disabled="busy" @click="downloadOnly">仅拉回云端</button>
      <button class="gs-btn" :disabled="busy" @click="doCheck">{{ pageBusy ? '检查中…' : '重新检查' }}</button>
      <button class="gs-btn" @click="openHistory"><Icon name="clock" :size="13"/> 同步历史</button>
    </div>
    <div class="cloud-led-legend" aria-label="顶栏同步状态灯说明">
      <span class="led green"></span>本地与云端一致
      <span class="led yellow"></span>有待同步或方向待确认
      <span class="led red"></span>断线、异常或未启用
    </div>
  </div>

  <CloudSyncDetailDrawer :open="syncDetailOpen" :loading="syncDetailLoading" :error="syncDetailError"
    :details="syncDetails" :initial-tab="syncDetailTab"
    @close="syncDetailOpen = false" @refresh="openSyncDetails(syncDetailTab)" />
  <CloudSyncChangesDrawer
    :open="changesOpen"
    :title="changesTitle"
    :intro="changesIntro"
    :rows="changesRows"
    :loading="changesLoading"
    :error="changesError"
    @close="changesOpen = false"
  />
  <CloudSyncReceiptModal :open="receiptOpen" :receipt="receipt" @close="receiptOpen = false" />
  <CloudSyncHistoryDrawer :open="historyOpen" :receipts="sharedCloud.syncReceipts.value" @close="historyOpen = false" @open-receipt="openHistoryReceipt" />

  <div class="gs-card">
    <div class="gs-card-header">
      <span class="gs-card-title">云端账号</span>
      <span class="gs-status-badge" :class="badgeState"><span class="gs-status-dot"></span>{{ badgeText }}</span>
      <span class="gs-card-desc">仅限邀请账号；普通卡片附件留在本机，策展节点附件进入你的私有 Storage；AI 凭据不上云</span>
    </div>
    <div class="gs-card-body">
      <div class="gs-setting-row">
        <span class="gs-sr-label">连接配置</span>
        <div class="gs-sr-control gs-sr-control--inline">
          <span class="gs-sr-note">{{ env ? '已配置云端项目' : '尚未配置云端项目' }}</span>
          <button class="gs-btn" type="button" @click="cfgOpen = !cfgOpen">{{ cfgOpen ? '收起配置' : '查看/修改云端配置' }}</button>
        </div>
      </div>
      <template v-if="cfgOpen">
        <div class="gs-setting-row">
          <span class="gs-sr-label">Supabase 地址</span>
          <div class="gs-sr-control gs-sr-control-wrap">
            <input
              v-model="cfgUrl"
              class="gs-input gs-input--ident"
              :class="{ 'is-invalid': cfgUrlErr }"
              :aria-invalid="!!cfgUrlErr"
              placeholder="https://your-project.supabase.co"
              @input="cfgUrlErr = ''"
            />
            <span class="gs-sr-hint">A/B 两台设备填同一份地址与 key 才能互相同步</span>
            <span v-if="cfgUrlErr" class="gs-field-err">{{ cfgUrlErr }}</span>
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">Publishable key</span>
          <div class="gs-sr-control gs-sr-control-wrap">
            <input
              v-model="cfgKey"
              class="gs-input gs-input--ident"
              :class="{ 'is-invalid': cfgKeyErr }"
              :aria-invalid="!!cfgKeyErr"
              placeholder="sb_publishable_..."
              @input="cfgKeyErr = ''"
            />
            <span class="gs-sr-hint">publishable key 可公开，secret/service_role 严禁填入</span>
            <span v-if="cfgKeyErr" class="gs-field-err">{{ cfgKeyErr }}</span>
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label"></span>
          <div class="gs-sr-control">
            <button class="gs-btn gs-btn-primary" :disabled="configSaving" @click="saveConfig">
              {{ configSaving ? '保存中…' : cfgSaved ? '已保存' : '保存云端配置' }}
            </button>
          </div>
        </div>
      </template>

      <template v-if="env && !loggedIn">
        <div class="gs-setting-row">
          <span class="gs-sr-label">邮箱</span>
          <div class="gs-sr-control"><input v-model="email" class="gs-input" type="email" autocomplete="username" placeholder="你被邀请的邮箱" /></div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">密码</span>
          <div class="gs-sr-control">
            <input v-model="password" class="gs-input" type="password" autocomplete="current-password" placeholder="账号密码" @keydown.enter="doLogin" />
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label"></span>
          <div class="gs-sr-control gs-sr-control--inline">
            <button class="gs-btn gs-btn-primary" :disabled="busy" @click="doLogin">{{ busy ? '登录中…' : '登录云端' }}</button>
            <span class="gs-sr-hint">账号为邀请制，无公开注册</span>
          </div>
        </div>
      </template>

      <template v-if="loggedIn">
        <div class="gs-setting-row">
          <span class="gs-sr-label">当前账号</span>
          <div class="gs-sr-control gs-sr-note">{{ meta?.email }}</div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">启动检查</span>
          <div class="gs-sr-control">
            <label class="gs-switch">
              <input type="checkbox" :checked="meta?.checkOnStart !== false" @change="updateStartupCheck(($event.target as HTMLInputElement).checked)" />
              <span class="gs-switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">自动同步</span>
          <div class="gs-sr-control gs-sr-control--inline">
            <label class="gs-switch" :class="{ disabled: !loggedIn }">
              <input type="checkbox" :disabled="!loggedIn" :checked="meta?.autoSyncEnabled === true" @change="updateAutoSync(($event.target as HTMLInputElement).checked)" />
              <span class="gs-switch-slider"></span>
            </label>
            <span class="gs-sr-hint">{{ autoSyncStatusText }}<template v-if="nextAutoSyncText"><br>{{ nextAutoSyncText }}</template></span>
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">策展附件云同步</span>
          <div class="gs-sr-control gs-sr-control--inline">
            <label class="gs-switch">
              <input type="checkbox" :checked="meta?.assetSyncEnabled !== false" @change="updateCurationAssetSync(($event.target as HTMLInputElement).checked)" />
              <span class="gs-switch-slider"></span>
            </label>
            <span class="gs-sr-hint">默认开启；关闭后新附件只保存本机，重新开启会自动补传。</span>
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label"></span>
          <div class="gs-sr-control gs-sr-control--inline">
            <button class="gs-btn gs-btn-danger" :disabled="busy" @click="doLogout">退出登录</button>
          </div>
        </div>
      </template>

      <div v-if="sharedCloud.state.value === 'error'" class="gs-setting-row">
        <span class="gs-sr-label">连接诊断</span>
        <div class="gs-sr-control gs-sr-note gs-sr-note--danger">{{ sharedCloud.errorMessage.value }}</div>
      </div>
    </div>
  </div>

</div>

<CloudMergeConflictModal
  :open="conflictOpen"
  :info="conflictInfo"
  @resolve="resolveConflict"
/>
</template>

<style src="./base.css"></style>

<style scoped>
.cloud-relation-card {
  border-color: color-mix(in srgb, var(--border) 72%, var(--accent));
}
.cloud-relation-card.attention {
  background:
    linear-gradient(118deg, color-mix(in srgb, var(--accent-light) 72%, var(--surface)), var(--surface) 58%);
  border-color: color-mix(in srgb, var(--accent) 46%, var(--border));
}
.cloud-relation-card.error {
  background: linear-gradient(118deg, var(--tag-warn-bg), var(--surface) 58%);
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
}
.cloud-relation-head {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 22px 18px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.cloud-relation-head:hover h3 { color: var(--accent-ink); }
.cloud-relation-head:focus-visible { outline: var(--focus-ring); outline-offset: -3px; }
.cloud-relation-kicker {
  margin-bottom: 7px;
  color: var(--accent-ink);
  font-size: var(--fs-micro);
  font-weight: 750;
  letter-spacing: .08em;
}
.cloud-relation-head h3 {
  margin: 0;
  color: var(--text);
  font-size: var(--fs-headline);
  line-height: 1.35;
}
.cloud-relation-head p {
  max-width: 720px;
  margin: 7px 0 0;
  color: var(--text-2);
  font-size: var(--fs-sub);
  line-height: 1.65;
}
.cloud-relation-badge {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
}
.cloud-recommend {
  color: var(--text-2);
  font-size: var(--fs-caption);
  white-space: nowrap;
}
.cloud-led-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 9px;
  padding: 0 22px 16px;
  color: var(--text-3);
  font-size: var(--fs-micro);
}
.cloud-led-legend .led {
  width: 7px;
  height: 7px;
  margin-left: 3px;
  border-radius: 50%;
}
.cloud-led-legend .led:first-child { margin-left: 0; }
.cloud-led-legend .green { background: var(--success); box-shadow: 0 0 0 3px var(--success-bg-soft); }
.cloud-led-legend .yellow { background: var(--warning); box-shadow: 0 0 0 3px var(--warning-bg-soft); }
.cloud-led-legend .red { background: var(--danger); box-shadow: 0 0 0 3px var(--danger-bg-soft); }
.cloud-relation-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border-block: 1px solid var(--border);
  background: var(--border);
}
.cloud-relation-facts > div,
.cloud-relation-facts > .cloud-fact-button {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 13px 18px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}
.cloud-relation-facts > .cloud-fact-button { border: 0; font: inherit; text-align: left; cursor: pointer; }
.cloud-relation-facts > .cloud-fact-button:hover { background: var(--accent-light); }
.cloud-relation-facts > .cloud-fact-button:focus-visible { outline: var(--focus-ring); outline-offset: -3px; }
.cloud-relation-facts > .cloud-fact-button small { color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 600; }
.cloud-relation-facts span {
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cloud-relation-facts b {
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-sub);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cloud-relation-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 18px;
}
@media (max-width: 760px) {
  .cloud-relation-head {
    flex-direction: column;
    gap: 14px;
  }
  .cloud-relation-badge {
    align-items: flex-start;
  }
  .cloud-relation-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
