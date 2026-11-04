<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import EmptyState from '@/shared/components/EmptyState.vue'
import { saveDataNow } from '@/shared/storage/repository'
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import { useFocusTrap } from '@/shared/utils/focusTrap'
import {
  useCloudSync,
  type CloudConflictChoice,
  type CloudDecisionInfo,
} from '../../composables/useCloudSync'
import type { CaptureItem } from '@/shared/cloud/sync'

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
const captures = ref<CaptureItem[]>([])
const capturesBusy = ref(false)
const capturesImporting = ref(false)
const captureDeletingId = ref('')
const capturesClearing = ref(false)
const conflictOpen = ref(false)
const conflictPanel = ref<HTMLElement | null>(null)
const conflictInfo = ref<CloudDecisionInfo | null>(null)
const importedCaptureIds = computed(() => new Set(
  (store.data?.resources || [])
    .map(card => card.customFields?.captureInboxId || card.customFields?.capture_inbox_id)
    .filter((id): id is string => !!id),
))
let conflictResolve: ((choice: CloudConflictChoice) => void) | null = null

useFocusTrap(conflictPanel, () => conflictOpen.value, { initial: 'first' })

function onConflictKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !conflictOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  resolveConflict('cancel')
}

const pwaUrl = 'https://bosstan3633.github.io/zhiyuan0901/'
const meta = sharedCloud.meta
const loggedIn = computed(() => !!meta.value?.refreshToken)
const busy = computed(() =>
  pageBusy.value
  || configSaving.value
  || sharedCloud.state.value === 'checking'
  || sharedCloud.state.value === 'syncing',
)
const capturesMutating = computed(() =>
  capturesImporting.value || capturesClearing.value || !!captureDeletingId.value,
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
const conflictTitle = computed(() => {
  switch (conflictInfo.value?.relation) {
    case 'remote_changed': return '云端有新增，待拉回本机'
    case 'both_changed': return '本机与云端都有改动'
    case 'unknown': return '首次确认同步方向'
    case 'local_changed': return '本机有改动，待上传云端'
    default: return '本机与云端内容不同'
  }
})

const relationDetail = computed(() => {
  switch (sharedCloud.relation.value) {
    case 'local_changed': return '建议同步到云端。云端没有比本机更新的内容，可以直接一键上传。'
    case 'remote_changed': return '建议从云端拉回。云端出现了本机没有的新内容，一键同步会先请你确认。'
    case 'both_changed': return '两边都相对上次同步发生了改动。一键同步会请你选择保留本机还是云端，不能静默覆盖。'
    case 'in_sync': return '当前内容指纹一致，不需要上传或拉回。'
    case 'empty_remote': return '本机已有内容，云端为空。建议将本机内容首次上传到云端。'
    case 'unknown': return '这是首次建立内容基线，无法自动判断新旧。请确认要保留本机还是云端。'
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
    case 'unknown': return '选择保留哪一端'
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
      await refreshCaptures()
    }
  } catch (error) {
    showToast(`读取云端配置失败：${errText(error)}`)
  }
}

onMounted(() => {
  void loadCloud()
  document.addEventListener('keydown', onConflictKeydown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onConflictKeydown, true)
  conflictResolve?.('cancel')
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
    await refreshCaptures()
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
    captures.value = []
    conflictResolve?.('cancel')
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

async function updateStartupCheck(checked: boolean): Promise<void> {
  try {
    const sync = await import('@/shared/cloud/sync')
    await sync.setCheckOnStart(checked)
    await sharedCloud.refreshCloudStatus(false)
  } catch (error) {
    toastError('保存启动检查设置失败', error)
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
  conflictResolve?.(choice)
  conflictResolve = null
}

async function syncNow(): Promise<void> {
  if (busy.value) return
  const result = await sharedCloud.manualSync(store, requestConflict)
  if (result.kind === 'latest') showToast(`已是最新 · 云端修订 ${result.revision}`)
  else if (result.kind === 'uploaded') showToast(`已同步到云端 · 修订 ${result.revision}`)
  else if (result.kind === 'downloaded') showToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
  else if (result.kind === 'cancelled') showToast('已取消同步，云端与本机均未改变')
  else if (result.kind === 'failed') showToast(`云同步失败：${result.message}`)
  else if (result.kind === 'needs_setup') showToast('请先完成云端配置与登录')
}

async function uploadOnly(): Promise<void> {
  if (busy.value || !loggedIn.value) return
  try {
    const result = await sharedCloud.uploadCurrent(store, requestConflict)
    if (result.kind === 'uploaded') showToast(`已上传到云端 · 修订 ${result.revision}`)
    else if (result.kind === 'downloaded') showToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
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
    message: '将用云端快照整体覆盖本机卡片、方向、策展台与事件日志。附件本体保留在本机，云端不含附件与 AI 凭据。',
    confirmText: '用云端覆盖本机',
  })
  if (!ok) return
  try {
    const result = await sharedCloud.downloadCurrent(store)
    await refreshCaptures()
    showToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
  } catch (error) {
    toastError('恢复失败', error)
  }
}

async function refreshCaptures(): Promise<void> {
  if (!loggedIn.value) {
    captures.value = []
    return
  }
  if (capturesBusy.value || capturesMutating.value) return
  capturesBusy.value = true
  try {
    const sync = await import('@/shared/cloud/sync')
    captures.value = (await sync.listCaptures()).sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    toastError('读取移动端采集失败', error)
  } finally {
    capturesBusy.value = false
  }
}

function isImported(item: CaptureItem): boolean {
  return importedCaptureIds.value.has(item.id)
}

async function importCaptured(items: CaptureItem[]): Promise<void> {
  if (!store.data || capturesMutating.value || !items.length) return
  capturesImporting.value = true
  const importedIds = new Set(items.map(item => item.id))
  try {
    const sync = await import('@/shared/cloud/sync')
    let added = 0
    for (const item of items) {
      if (isImported(item)) continue
      store.data.resources.push(sync.buildCapturedResource(item))
      added += 1
    }
    if (added) await saveDataNow()

    const consumed = new Set<string>()
    const failed: string[] = []
    for (const item of items) {
      try {
        await sync.consumeCapture(item.id)
        consumed.add(item.id)
      } catch {
        failed.push(item.id)
      }
    }
    captures.value = captures.value.filter(item =>
      importedIds.has(item.id) ? !consumed.has(item.id) : true,
    )
    if (failed.length) {
      showToast(`已写入 ${added} 张资源卡；${failed.length} 条采集记录暂未清理，可再次导入重试`)
    } else {
      showToast(added ? `已采集 ${added} 张资源卡到资源池` : '这些采集已在资源池中，已清理待导入记录')
    }
  } catch (error) {
    toastError('导入移动端采集失败', error)
  } finally {
    capturesImporting.value = false
  }
}

async function importOne(item: CaptureItem): Promise<void> {
  await importCaptured([item])
}

async function importAll(): Promise<void> {
  await importCaptured([...captures.value])
}

function openCapture(item: CaptureItem): void {
  const url = toOpenableRawLink(item.url)
  if (!url) {
    showToast('该采集链接格式不可直接打开')
    return
  }
  openExternalLink(url)
}

function onCaptureKeydown(event: KeyboardEvent, item: CaptureItem): void {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openCapture(item)
}

async function deleteOne(item: CaptureItem): Promise<void> {
  if (capturesMutating.value) return
  const ok = await useConfirm({
    title: '删除采集记录',
    message: `将从云端永久删除「${item.title || item.url}」这条待导入记录，删除后不可恢复。已导入本机的资源卡不受影响。`,
    confirmText: '删除记录',
  })
  if (!ok) return
  captureDeletingId.value = item.id
  try {
    const sync = await import('@/shared/cloud/sync')
    await sync.deleteCapture(item.id)
    captures.value = captures.value.filter(capture => capture.id !== item.id)
    showToast('已删除采集记录')
  } catch (error) {
    toastError('删除采集记录失败', error)
  } finally {
    captureDeletingId.value = ''
  }
}

async function clearAll(): Promise<void> {
  if (!captures.value.length || capturesMutating.value) return
  const ok = await useConfirm({
    title: '清空全部待导入',
    message: `将从云端永久删除当前 ${captures.value.length} 条移动端待导入记录，删除后不可恢复。已导入本机的资源卡不受影响。`,
    confirmText: '全部清空',
  })
  if (!ok) return
  capturesClearing.value = true
  const ids = captures.value.map(item => item.id)
  let clearFailed = false
  try {
    const sync = await import('@/shared/cloud/sync')
    await sync.deleteCaptures(ids)
    captures.value = []
    showToast(`已清空 ${ids.length} 条待导入记录`)
  } catch (error) {
    clearFailed = true
    toastError('清空待导入记录失败', error)
  } finally {
    capturesClearing.value = false
  }
  // 批量删除按 50 条分批执行；中途失败时可能已经删掉前几批。
  // 此时必须回读云端真值，不能继续展示可能已被删除的旧列表。
  if (clearFailed) await refreshCaptures()
}
</script>

<template>
<div>
  <div class="gs-card cloud-relation-card" :class="relationTone" data-testid="cloud-relation-overview">
    <div class="cloud-relation-head">
      <div>
        <div class="cloud-relation-kicker">本机 ↔ 云端</div>
        <h3>{{ relationUpdatedText }}</h3>
        <p>{{ relationDetail }}</p>
      </div>
      <div class="cloud-relation-badge">
        <span class="gs-status-badge" :class="badgeState"><span class="gs-status-dot"></span>{{ badgeText }}</span>
        <span class="cloud-recommend">建议：{{ recommendedAction }}</span>
      </div>
    </div>
    <div class="cloud-relation-facts">
      <div><span>本机同步基线</span><b>修订 {{ localRevisionText }}</b></div>
      <div><span>云端当前修订</span><b>修订 {{ remoteRevisionText }}</b></div>
      <div><span>最近实际同步</span><b>{{ lastSyncText }}</b></div>
      <div><span>最近检查</span><b>{{ lastCheckedText }}</b></div>
    </div>
    <div v-if="loggedIn" class="cloud-relation-actions">
      <button class="gs-btn gs-btn-primary" :disabled="busy" data-testid="cloud-sync-now" @click="syncNow">
        {{ sharedCloud.state.value === 'syncing' ? '同步中…' : '按当前关系同步' }}
      </button>
      <button class="gs-btn" :disabled="busy" @click="uploadOnly">仅上传本机</button>
      <button class="gs-btn" :disabled="busy" @click="downloadOnly">仅拉回云端</button>
      <button class="gs-btn" :disabled="busy" @click="doCheck">{{ pageBusy ? '检查中…' : '重新检查' }}</button>
    </div>
  </div>

  <div class="gs-card">
    <div class="gs-card-header">
      <span class="gs-card-title">云端账号</span>
      <span class="gs-status-badge" :class="badgeState"><span class="gs-status-dot"></span>{{ badgeText }}</span>
      <span class="gs-card-desc">仅限邀请账号；附件本体与 AI 凭据不进云端</span>
    </div>
    <div class="gs-card-body">
      <p v-if="captures.length" class="capture-delete-warning" role="note" data-testid="capture-delete-warning">
        <b>删除说明：</b>单条删除与全部清空都会永久删除云端待导入记录，删除后不可恢复；已导入本机的资源卡不受影响。
      </p>
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

  <div v-if="loggedIn" class="gs-card" data-testid="mobile-capture-inbox">
    <div class="gs-card-header">
      <span class="gs-card-title">移动端采集</span>
      <span class="gs-card-desc">手机浏览器打开 PWA 提交链接，稍后在此导入资源卡池</span>
    </div>
    <div class="gs-card-body">
      <div class="gs-setting-row">
        <span class="gs-sr-label">PWA 地址</span>
        <div class="gs-sr-control gs-sr-note"><a :href="pwaUrl" target="_blank" rel="noopener">{{ pwaUrl }}</a></div>
      </div>
      <div class="gs-setting-row">
        <span class="gs-sr-label">待导入</span>
        <div class="gs-sr-control gs-sr-control--inline">
          <button class="gs-btn" :disabled="capturesBusy || capturesMutating" @click="refreshCaptures">
            {{ capturesBusy ? '读取中…' : '刷新采集列表' }}
          </button>
          <button v-if="captures.length" class="gs-btn gs-btn-primary" :disabled="capturesMutating" @click="importAll">
            {{ capturesImporting ? '导入中…' : `全部导入（${captures.length}）` }}
          </button>
          <button v-if="captures.length" class="gs-btn gs-btn-danger" :disabled="capturesBusy || capturesMutating" @click="clearAll">
            {{ capturesClearing ? '正在清空…' : '全部清空' }}
          </button>
        </div>
      </div>
      <EmptyState v-if="!captures.length" size="inline" icon="link" title="暂无待导入链接" hint="在手机 PWA 里提交后点「刷新采集列表」" />
      <div
        v-for="item in captures"
        :key="item.id"
        class="gs-setting-row gs-setting-row--top capture-row"
        tabindex="0"
        :aria-label="`${item.title || item.url}，双击、按回车或空格打开链接`"
        @dblclick.self="openCapture(item)"
        @keydown="onCaptureKeydown($event, item)"
      >
        <span class="gs-sr-label gs-sr-label--nowrap">{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</span>
        <div class="gs-sr-control gs-sr-control-wrap capture-control">
          <div class="gs-sr-note capture-copy" @dblclick="openCapture(item)">
            <b>{{ item.title || item.url }}</b>
            <span class="gs-sr-hint">{{ item.url }}</span>
            <span v-if="item.note"> · {{ item.note }}</span>
            <span class="capture-open-meta">
              <span class="capture-open-hint">双击、按回车或空格打开</span>
              <span v-if="isImported(item)" class="capture-imported-badge">已在资源池</span>
            </span>
          </div>
          <div class="capture-actions">
            <button class="gs-btn" @click.stop="openCapture(item)">打开链接</button>
            <button
              class="gs-btn"
              :class="{ 'gs-btn-primary': !isImported(item) }"
              :disabled="capturesMutating"
              :title="isImported(item) ? '资源卡已写入本机，重试清理云端待导入记录' : '导入到资源卡池'"
              @click.stop="importOne(item)"
            >
              {{ capturesImporting ? '处理中…' : isImported(item) ? '重试清理' : '导入资源池' }}
            </button>
            <button class="gs-btn gs-btn-danger" :disabled="capturesMutating" @click.stop="deleteOne(item)">
              {{ captureDeletingId === item.id ? '正在删除…' : '删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<Teleport to="body">
  <div v-if="conflictOpen" class="cloud-conflict-mask" data-a11y-container @click.self="resolveConflict('cancel')">
    <section ref="conflictPanel" class="cloud-conflict" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="cloud-conflict-title" aria-describedby="cloud-conflict-body">
      <h2 id="cloud-conflict-title">
        {{ conflictTitle }}
      </h2>
      <p class="cloud-conflict-meta">
        本机同步基线：修订 {{ conflictInfo?.localRevision || 0 }} · 云端当前：修订 {{ conflictInfo?.remoteRevision || 0 }}
      </p>
      <p id="cloud-conflict-body" class="cloud-conflict-body">
        请明确选择本次保留哪一端。云端在检查后又出现了较新修订时，也会再次在这里确认；未选中的一端会被覆盖，附件本体和 AI 凭据不会进入云端。
      </p>
      <div class="cloud-conflict-actions">
        <button class="gs-btn" @click="resolveConflict('cancel')">取消</button>
        <button class="gs-btn" @click="resolveConflict('download')">拉回云端</button>
        <button class="gs-btn gs-btn-primary" @click="resolveConflict('upload')">本机覆盖云端</button>
      </div>
    </section>
  </div>
</Teleport>
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 22px 18px;
}
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
.cloud-relation-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border-block: 1px solid var(--border);
  background: var(--border);
}
.cloud-relation-facts > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 18px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}
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
.capture-row {
  cursor: default;
}
.capture-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.capture-control {
  justify-content: flex-end;
}
.capture-copy {
  min-width: min(420px, 52vw);
  cursor: text;
}
.capture-copy b,
.capture-copy .gs-sr-hint,
.capture-open-hint {
  display: block;
}
.capture-open-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}
.capture-copy .gs-sr-hint {
  overflow-wrap: anywhere;
}
.capture-open-hint {
  margin-top: 3px;
  color: var(--text-4);
  font-size: var(--fs-micro);
}
.capture-imported-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent-ink);
  font-size: var(--fs-micro);
  font-weight: 650;
}
.capture-delete-warning {
  margin: 0 0 10px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--tag-danger-bg) 72%, var(--surface));
  color: var(--text-2);
  font-size: var(--fs-caption);
  line-height: 1.55;
}
.capture-delete-warning b {
  color: var(--danger);
}
.capture-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.cloud-conflict-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-confirm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / .44);
}
.cloud-conflict {
  width: min(480px, calc(100vw - 32px));
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.cloud-conflict h2 {
  margin: 0;
  color: var(--text);
  font-size: var(--fs-title);
}
.cloud-conflict-meta {
  margin: 7px 0 0;
  color: var(--text-3);
  font-size: var(--fs-caption);
}
.cloud-conflict-body {
  margin: 16px 0 20px;
  color: var(--text-2);
  font-size: var(--fs-sub);
  line-height: 1.65;
}
.cloud-conflict-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
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
  .capture-copy {
    min-width: 100%;
  }
  .capture-actions {
    justify-content: flex-start;
  }
}
</style>
