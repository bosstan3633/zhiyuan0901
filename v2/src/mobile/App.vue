<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'


const env = ref<{ url: string; anonKey: string } | null>(null)
const email = ref('')
const password = ref('')
const session = ref<{ accessToken: string; refreshToken: string; email: string } | null>(null)
const url = ref('')
const title = ref('')
const note = ref('')
const busy = ref(false)
const msg = ref('')
const err = ref('')
const pending = ref<{ url: string; title?: string; note?: string }[]>([])

const logged = computed(() => !!session.value?.accessToken)
const PENDING_KEY = 'zy_mobile_pending'

async function api(path: string, init: RequestInit, token?: string) {
  if (!env.value) throw new Error('云端未配置')
  const headers: Record<string, string> = { apikey: env.value.anonKey, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(env.value.url + path, { ...init, headers })
  if (!res.ok) throw new Error('请求失败 ' + res.status)
  return res.status === 204 ? null : res.json().catch(() => null)
}
async function login() {
  busy.value = true; err.value = ''
  try {
    const r = await api('/auth/v1/token?grant_type=password',
      { method: 'POST', body: JSON.stringify({ email: email.value.trim(), password: password.value }) })
    session.value = { accessToken: r.access_token, refreshToken: r.refresh_token, email: r.user?.email || email.value.trim() }
    localStorage.setItem('zy_mobile_session', JSON.stringify(session.value))
    password.value = ''
    msg.value = '已登录'
    await flushPending()
  } catch (e) { err.value = '登录失败：' + (e instanceof Error ? e.message : String(e)) }
  finally { busy.value = false }
}
async function refreshToken() {
  if (!session.value) return false
  try {
    const r = await api('/auth/v1/token?grant_type=refresh_token',
      { method: 'POST', body: JSON.stringify({ refresh_token: session.value.refreshToken }) })
    session.value.accessToken = r.access_token
    if (r.refresh_token) session.value.refreshToken = r.refresh_token
    localStorage.setItem('zy_mobile_session', JSON.stringify(session.value))
    return true
  } catch { session.value = null; localStorage.removeItem('zy_mobile_session'); return false }
}
function savePending() { localStorage.setItem(PENDING_KEY, JSON.stringify(pending.value)) }
async function submit() {
  const u = url.value.trim()
  if (!u || !/^https?:\/\//i.test(u)) { err.value = '请输入完整链接（含 http/https）'; return }
  busy.value = true; err.value = ''
  try {
    if (!logged.value) { pending.value.push({ url: u, title: title.value.trim() || undefined, note: note.value.trim() || undefined }); savePending(); msg.value = '已暂存，登录后自动同步'; return }
    await sendOne({ url: u, title: title.value.trim() || undefined, note: note.value.trim() || undefined })
    msg.value = '已提交到云端采集'
    url.value = ''; title.value = ''; note.value = ''
  } catch (e) { err.value = '提交失败：' + (e instanceof Error ? e.message : String(e)) }
  finally { busy.value = false }
}
async function sendOne(it: { url: string; title?: string; note?: string }) {
  if (!session.value) throw new Error('未登录')
  try {
    await api('/rest/v1/capture_inbox', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ url: it.url, title: it.title, note: it.note }) }, session.value.accessToken)
  } catch (e) {
    if (await refreshToken()) await api('/rest/v1/capture_inbox', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ url: it.url, title: it.title, note: it.note }) }, session.value!.accessToken)
    else throw e
  }
}
async function flushPending() {
  for (const it of [...pending.value]) {
    try { await sendOne(it); pending.value = pending.value.filter(x => x !== it); savePending() } catch { /* keep */ }
  }
}
function logout() {
  session.value = null
  localStorage.removeItem('zy_mobile_session')
}
onMounted(() => {
  try {
    const u = (import.meta as unknown as { env?: Record<string,string|undefined> }).env?.VITE_SUPABASE_URL
    const k = (import.meta as unknown as { env?: Record<string,string|undefined> }).env?.VITE_SUPABASE_PUBLISHABLE_KEY
    if (u && k && k.startsWith('sb_publishable_')) env.value = { url: u.replace(/\/$/,''), anonKey: k }
  } catch { /* noop */ }
  const s = localStorage.getItem('zy_mobile_session')
  if (s) { try { session.value = JSON.parse(s) } catch { /* noop */ } }
  const p = localStorage.getItem(PENDING_KEY)
  if (p) { try { pending.value = JSON.parse(p) } catch { /* noop */ } }
  // 分享目标：从地址栏取 link/title（Android 分享）
  const q = new URLSearchParams(location.search)
  const link = q.get('link') || q.get('url') || q.get('text') || ''
  if (link && /^https?:\/\//i.test(link)) url.value = link
  const t = q.get('title') || ''
  if (t) title.value = t
})
</script>

<template>
  <div class="m-shell">
    <header class="m-head">
      <div class="m-brand"><img src="./icon.png" alt="" class="m-logo" /><div><div class="m-title">知源 · 移动采集</div><div class="m-sub">把链接存进资源卡池</div></div></div>
      <button v-if="logged" class="m-ghost" @click="logout">退出</button>
    </header>

    <main class="m-main">
      <div v-if="!env" class="m-card"><div class="m-err">云端未配置</div></div>
      <template v-else-if="!logged">
        <div class="m-card">
          <div class="m-card-t">登录邀请账号</div>
          <input v-model="email" class="m-input" type="email" placeholder="邮箱" autocomplete="username" />
          <input v-model="password" class="m-input" type="password" placeholder="密码" autocomplete="current-password" @keyup.enter="login" />
          <div v-if="err" class="m-err">{{ err }}</div>
          <button class="m-btn" :disabled="busy" @click="login">{{ busy ? '登录中…' : '登录' }}</button>
          <div class="m-tip">仅限邀请账号；无公开注册。</div>
        </div>
      </template>

      <template v-else>
        <div class="m-card">
          <div class="m-card-t">采集链接</div>
          <input v-model="url" class="m-input" type="url" placeholder="https://…" inputmode="url" />
          <input v-model="title" class="m-input" type="text" placeholder="标题（可选）" />
          <textarea v-model="note" class="m-textarea" placeholder="备注（可选）"></textarea>
          <div v-if="err" class="m-err">{{ err }}</div>
          <div v-if="msg" class="m-ok">{{ msg }}</div>
          <button class="m-btn" :disabled="busy" @click="submit">{{ busy ? '提交中…' : '提交到资源池' }}</button>
          <div class="m-tip">提交后在电脑端「设置 → 数据管理 → 云同步」导入。</div>
        </div>
      </template>

      <div v-if="pending.length" class="m-pending">待同步 {{ pending.length }} 条（联网登录后自动发）</div>
    </main>
  </div>
</template>
