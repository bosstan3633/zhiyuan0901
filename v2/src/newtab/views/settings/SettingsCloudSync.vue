<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { saveDataNow, loadUIPrefs, cloudRestoreAtomic } from '@/shared/storage/repository'
import { flushEventQueue, readEventLog } from '@/shared/utils/eventLog'
import { saveDataNow as persistNow } from '@/shared/storage/repository'

const store = useAppStore()
const env = ref<{ url: string; anonKey: string } | null>(null)
const meta = ref<{ userId: string; email: string; revision: number; lastUploadAt?: number; lastDownloadAt?: number; lastCheckedAt?: number; checkOnStart: boolean } | null>(null)
const email = ref('')
const password = ref('')
const busy = ref(false)
const checkResult = ref<string>('')
const conflictRemoteRev = ref(0)
const conflictOpen = ref(false)
let pendingUploadResolve: ((ok: boolean) => void) | null = null
const captures = ref<{ id: string; url: string; title?: string; note?: string; tags: string[]; createdAt: number }[]>([])
const capturesBusy = ref(false)

const loggedIn = computed(() => !!meta.value?.userId)
const pwaUrl = 'https://bosstan3633.github.io/zhiyuan0901/'

async function loadCloud() {
  const c = await import('@/shared/cloud/client')
  env.value = c.cloudEnv()
  const s = await import('@/shared/cloud/sync')
  meta.value = await s.getCloudMeta()
}
onMounted(() => { void loadCloud() })

async function doLogin() {
  if (!env.value) { showToast('云端未配置'); return }
  if (!email.value.trim() || !password.value) { showToast('请输入邮箱与密码'); return }
  busy.value = true
  try {
    const s = await import('@/shared/cloud/sync')
    meta.value = await s.login(email.value, password.value)
    password.value = ''
    showToast('云端登录成功')
    await refreshCaptures()
  } catch (e) { showToast('登录失败：' + (e instanceof Error ? e.message : String(e))) }
  finally { busy.value = false }
}

async function doLogout() {
  if (!(await useConfirm({ title: '退出云端账号', message: '退出后本机不再自动检查云端，也不会上传/下载。本地数据不受影响。', confirmText: '退出登录' }))) return
  const s = await import('@/shared/cloud/sync')
  await s.logout()
  meta.value = null
  captures.value = []
  showToast('已退出云端账号')
}

async function doCheck() {
  const s = await import('@/shared/cloud/sync')
  const r = await s.checkRemote()
  const m = { idle: '未登录或云端不可达', none: '云端暂无可下载版本', same: '与云端版本一致', remote_new: '云端有更新版本' } as Record<string, string>
  checkResult.value = m[r.kind] + (r.remoteUpdatedAt ? `（云端修订 ${r.remoteRevision} · ${new Date(r.remoteUpdatedAt).toLocaleString('zh-CN')}）` : '')
}

async function snapshotNow() {
  await persistNow()
  await flushEventQueue()
  const [data, ui, eventLog] = [store.data!, await loadUIPrefs(), await readEventLog()]
  return { data, ui, eventLog }
}

async function doUpload() {
  if (!loggedIn.value) { showToast('请先登录'); return }
  busy.value = true
  try {
    const s = await import('@/shared/cloud/sync')
    const snap = await snapshotNow()
    const r = await s.uploadNow(snap, (remoteRev) => new Promise<boolean>((resolve) => {
      conflictRemoteRev.value = remoteRev
      conflictOpen.value = true
      pendingUploadResolve = resolve
    }))
    meta.value = await s.getCloudMeta()
    showToast(`已上传到云端（修订 ${r.revision}）`)
  } catch (e) { showToast(String(e instanceof Error ? e.message : e)) }
  finally { busy.value = false; conflictOpen.value = false; pendingUploadResolve = null }
}

function resolveConflict(overwrite: boolean) {
  conflictOpen.value = false
  pendingUploadResolve?.(overwrite)
  pendingUploadResolve = null
}

async function doDownload() {
  if (!loggedIn.value) { showToast('请先登录'); return }
  const ok = await useConfirm({
    title: '从云端恢复',
    message: '将用云端快照整体覆盖本机卡片、方向、策展台与事件日志。附件本体保留在本机，云端不含附件与 AI 凭据。',
    confirmText: '用云端覆盖本机',
  })
  if (!ok) return
  busy.value = true
  try {
    const s = await import('@/shared/cloud/sync')
    const r = await s.downloadNow()
    // 附件元数据按卡 ID 重新挂回（云端不含附件）
    const localAssets = new Map<string, import('@/shared/models').AssetMeta[]>()
    for (const arr of [store.data!.resources, store.data!.tasks, store.data!.curiosities, ...(store.data!.argCards ? [store.data!.argCards] : [])]) {
      for (const c of arr || []) if (c.assets?.length) localAssets.set(c.id, c.assets)
    }
    const remote = r.state.data as import('@/shared/models').AppData
    for (const arr of [remote.resources, remote.tasks, remote.curiosities, ...(remote.argCards ? [remote.argCards] : [])]) {
      for (const c of arr || []) { const a = localAssets.get(c.id); if (a) c.assets = a }
    }
    await cloudRestoreAtomic({ nextData: remote, nextUi: r.state.ui, eventLog: r.state.eventLog })
    await store.refreshAfterCloudRestore(store.data!, store.ui)
    await s.markDownloaded(r.revision)
    meta.value = await s.getCloudMeta()
    showToast(`已恢复到本机（云端修订 ${r.revision}）`)
  } catch (e) { showToast('下载失败：' + (e instanceof Error ? e.message : String(e))) }
  finally { busy.value = false }
}

async function refreshCaptures() {
  if (!loggedIn.value) { captures.value = []; return }
  capturesBusy.value = true
  try {
    const s = await import('@/shared/cloud/sync')
    captures.value = await s.listCaptures()
  } catch { /* noop */ } finally { capturesBusy.value = false }
}

async function importOne(id: string) {
  const item = captures.value.find(c => c.id === id)
  if (!item) return
  const s = await import('@/shared/cloud/sync')
  const card = s.buildCapturedResource(item)
  store.data!.resources.push(card)
  await saveDataNow()
  await s.consumeCapture(id)
  captures.value = captures.value.filter(c => c.id !== id)
  showToast('已采集到资源卡池')
}

async function importAll() {
  for (const c of [...captures.value]) await importOne(c.id)
}
</script>

<template>
<div>
  <div class="gs-card">
    <div class="gs-card-header">
      <span class="gs-card-title">云端账号</span>
      <span class="gs-status-badge" :class="{ connected: loggedIn, idle: !loggedIn }"><span class="gs-status-dot"></span>{{ loggedIn ? '已登录' : '未登录' }}</span>
      <span class="gs-card-desc">仅限邀请账号；附件本体与 AI 凭据不进云端</span>
    </div>
    <div class="gs-card-body">
      <div v-if="!env" class="gs-setting-row">
        <span class="gs-sr-label">配置状态</span>
        <div class="gs-sr-control gs-sr-note gs-sr-note--danger">云端未配置（缺少 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）</div>
      </div>
      <template v-else-if="!loggedIn">
        <div class="gs-setting-row"><span class="gs-sr-label">邮箱</span><div class="gs-sr-control"><input class="gs-input" v-model="email" type="email" autocomplete="username" placeholder="你被邀请的邮箱" /></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">密码</span><div class="gs-sr-control"><input class="gs-input" v-model="password" type="password" autocomplete="current-password" placeholder="账号密码" @keydown.enter="doLogin" /></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label"></span><div class="gs-sr-control gs-sr-control--inline">
          <button class="gs-btn gs-btn-primary" :disabled="busy" @click="doLogin">{{ busy ? '登录中…' : '登录云端' }}</button>
          <span class="gs-sr-hint">账号为邀请制，无公开注册</span>
        </div></div>
      </template>
      <template v-else>
        <div class="gs-setting-row"><span class="gs-sr-label">当前账号</span><div class="gs-sr-control gs-sr-note">{{ meta?.email }} · 修订 {{ meta?.revision || 0 }}{{ meta?.lastUploadAt ? ' · 最近上传 ' + new Date(meta.lastUploadAt).toLocaleString('zh-CN') : '' }}</div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">启动检查</span><div class="gs-sr-control"><label class="gs-switch"><input type="checkbox" :checked="meta?.checkOnStart !== false" @change="async (e) => { const s = await import('@/shared/cloud/sync'); meta = await s.setCheckOnStart((e.target as HTMLInputElement).checked) }" /><span class="gs-switch-slider"></span></label></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label"></span><div class="gs-sr-control gs-sr-control--inline">
          <button class="gs-btn" @click="doCheck">检查云端版本</button>
          <button class="gs-btn gs-btn-primary" :disabled="busy" @click="doUpload">{{ busy ? '处理中…' : '手动上传到云端' }}</button>
          <button class="gs-btn" :disabled="busy" @click="doDownload">从云端恢复</button>
          <button class="gs-btn" @click="doLogout">退出登录</button>
        </div></div>
        <div v-if="checkResult" class="gs-setting-row"><span class="gs-sr-label">检查结果</span><div class="gs-sr-control gs-sr-note">{{ checkResult }}</div></div>
      </template>
    </div>
  </div>

  <div v-if="loggedIn" class="gs-card">
    <div class="gs-card-header"><span class="gs-card-title">移动端采集</span><span class="gs-card-desc">手机浏览器打开 PWA 提交链接，稍后在此导入资源卡池</span></div>
    <div class="gs-card-body">
      <div class="gs-setting-row"><span class="gs-sr-label">PWA 地址</span><div class="gs-sr-control gs-sr-note"><a :href="pwaUrl" target="_blank" rel="noopener">{{ pwaUrl }}</a></div></div>
      <div class="gs-setting-row"><span class="gs-sr-label">待导入</span><div class="gs-sr-control gs-sr-control--inline">
        <button class="gs-btn" :disabled="capturesBusy" @click="refreshCaptures">{{ capturesBusy ? '读取中…' : '刷新采集列表' }}</button>
        <button v-if="captures.length" class="gs-btn gs-btn-primary" @click="importAll">全部导入（{{ captures.length }}）</button>
      </div></div>
      <EmptyState v-if="!captures.length" size="inline" icon="link" title="暂无待导入链接" hint="在手机 PWA 里提交后点「刷新采集列表」" />
      <div v-for="c in captures" :key="c.id" class="gs-setting-row gs-setting-row--top">
        <span class="gs-sr-label gs-sr-label--nowrap">{{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}</span>
        <div class="gs-sr-control gs-sr-control-wrap">
          <div class="gs-sr-note"><b>{{ c.title || c.url }}</b><br/><span class="gs-sr-hint">{{ c.url }}</span><span v-if="c.note"> · {{ c.note }}</span></div>
          <button class="gs-btn" @click="importOne(c.id)">导入资源池</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 上传冲突确认 -->
<div v-if="conflictOpen" class="cs-confirm-mask">
  <div class="cs-confirm">
    <div class="cs-confirm-title">云端版本更高</div>
    <div class="cs-confirm-body">云端最新修订为 {{ conflictRemoteRev }}，高于本机基线。继续将以「本机覆盖云端」；取消则保留云端不动。</div>
    <div class="cs-confirm-actions">
      <button class="gs-btn" @click="resolveConflict(false)">取消</button>
      <button class="gs-btn gs-btn-primary" @click="resolveConflict(true)">本机覆盖云端</button>
    </div>
  </div>
</div>
</template>

<style scoped>
.cs-confirm-mask { position: fixed; inset: 0; background: rgb(0 0 0 / .45); display: flex; align-items: center; justify-content: center; z-index: 999; }
.cs-confirm { width: 420px; max-width: calc(100vw - 48px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px; box-shadow: var(--shadow-lg); }
.cs-confirm-title { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
.cs-confirm-body { font-size: 13px; color: var(--text-3); line-height: 1.6; margin-bottom: 16px; }
.cs-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
