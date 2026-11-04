<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { useFocusTrap } from '@/shared/utils/focusTrap'
import {
  useCloudSync,
  type CloudConflictChoice,
  type CloudDecisionInfo,
} from '../../composables/useCloudSync'

const store = useAppStore()
const router = useRouter()
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
const conflictPanel = ref<HTMLElement | null>(null)
const conflictInfo = ref<CloudDecisionInfo | null>(null)
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
    message: '将用云端快照整体覆盖本机卡片、方向、策展台与事件日志。普通卡片附件本体保留在本机；策展节点附件元数据随快照恢复，缺失的附件会在打开时从私有 Storage 下载。AI 凭据不上云。',
    confirmText: '用云端覆盖本机',
  })
  if (!ok) return
  try {
    const result = await sharedCloud.downloadCurrent(store)
    showToast(`已从云端恢复到本机 · 修订 ${result.revision}`)
  } catch (error) {
    toastError('恢复失败', error)
  }
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

  <div v-if="loggedIn" class="gs-card" data-testid="mobile-capture-inbox">
    <div class="gs-card-header">
      <span class="gs-card-title">移动端采集 · Inbox</span>
      <span class="gs-card-desc">手机提交链接或文本后，统一到 Inbox 池按时间盘点与转化</span>
    </div>
    <div class="gs-card-body">
      <div class="gs-setting-row">
        <span class="gs-sr-label">PWA 地址</span>
        <div class="gs-sr-control gs-sr-note"><a :href="pwaUrl" target="_blank" rel="noopener">{{ pwaUrl }}</a></div>
      </div>
      <div class="gs-setting-row">
        <span class="gs-sr-label">Inbox 池</span>
        <div class="gs-sr-control gs-sr-control--inline">
          <button class="gs-btn gs-btn-primary" @click="router.push('/deck/inbox')">打开 Inbox 池</button>
          <span class="gs-sr-hint">设置页不再维护第二套采集列表；未转化计数与删除、转化都在 Inbox 完成。</span>
        </div>
      </div>
      <p class="gs-sr-hint">策展节点附件使用私有 Supabase Storage；普通卡片附件仍只保留在本机 IndexedDB。</p>
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
        请明确选择本次保留哪一端。云端在检查后又出现了较新修订时，也会再次在这里确认；未选中的一端会被覆盖。普通卡片附件本体和 AI 凭据不会进入云端；策展节点附件使用你的私有 Storage。
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
}
</style>
