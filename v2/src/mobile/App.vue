<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LOCAL_KEYS } from '@/shared/storage/keys'


const env = ref<{ url: string; anonKey: string } | null>(null)
const email = ref('')
const password = ref('')
const session = ref<{ accessToken: string; refreshToken: string; email: string } | null>(null)
type CaptureKind = 'link' | 'text'
interface PendingCapture { contentKind: CaptureKind; url?: string; text?: string; title?: string; note?: string; createdAt: number }
const contentKind = ref<CaptureKind>('link')
const contentText = ref('')
const url = ref('')
const title = ref('')
const note = ref('')
const busy = ref(false)
const msg = ref('')
const err = ref('')
const pending = ref<PendingCapture[]>([])

const logged = computed(() => !!session.value?.accessToken)
const PENDING_KEY = LOCAL_KEYS.MOBILE_PENDING

async function api(path: string, init: RequestInit, token?: string) {
  if (!env.value) throw new Error('云端未配置')
  const headers: Record<string, string> = {
    apikey: env.value.anonKey,
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
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
    localStorage.setItem(LOCAL_KEYS.MOBILE_SESSION, JSON.stringify(session.value))
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
    localStorage.setItem(LOCAL_KEYS.MOBILE_SESSION, JSON.stringify(session.value))
    return true
  } catch { session.value = null; localStorage.removeItem(LOCAL_KEYS.MOBILE_SESSION); return false }
}
function savePending() { localStorage.setItem(PENDING_KEY, JSON.stringify(pending.value)) }
async function submit() {
  const link = url.value.trim()
  const text = contentText.value.trim()
  if (contentKind.value === 'link' && (!link || !/^https?:\/\//i.test(link))) {
    err.value = '请输入完整链接（含 http/https）'
    return
  }
  if (contentKind.value === 'text' && !text) {
    err.value = '请输入要采集的文本'
    return
  }
  busy.value = true; err.value = ''
  try {
    const item: PendingCapture = {
      contentKind: contentKind.value,
      url: contentKind.value === 'link' ? link : undefined,
      text: contentKind.value === 'text' ? text : undefined,
      title: title.value.trim() || undefined,
      note: note.value.trim() || undefined,
      createdAt: Date.now(),
    }
    if (!logged.value) {
      pending.value.push(item); savePending(); msg.value = '已暂存，登录后自动同步'; return
    }
    try {
      await sendOne(item)
      msg.value = '已提交到 Inbox'
      url.value = ''; contentText.value = ''; title.value = ''; note.value = ''
    } catch (e) {
      pending.value.push(item); savePending()
      msg.value = '网络暂不可用，已放入待同步队列，联网登录后自动发送'
      return
    }
  } catch (e) { err.value = '提交失败：' + (e instanceof Error ? e.message : String(e)) }
  finally { busy.value = false }
}
async function sendOne(it: PendingCapture) {
  if (!session.value) throw new Error('未登录')
  const payload = {
    content_kind: it.contentKind,
    url: it.contentKind === 'link' ? it.url : null,
    text_content: it.contentKind === 'text' ? it.text : null,
    title: it.title,
    note: it.note,
  }
  try {
    await api('/rest/v1/capture_inbox', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) }, session.value.accessToken)
  } catch (e) {
    if (await refreshToken()) await api('/rest/v1/capture_inbox', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) }, session.value!.accessToken)
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
  localStorage.removeItem(LOCAL_KEYS.MOBILE_SESSION)
}
onMounted(() => {
  try {
    const u = (import.meta as unknown as { env?: Record<string,string|undefined> }).env?.VITE_SUPABASE_URL
    const k = (import.meta as unknown as { env?: Record<string,string|undefined> }).env?.VITE_SUPABASE_PUBLISHABLE_KEY
    if (u && k && k.startsWith('sb_publishable_')) env.value = { url: u.replace(/\/$/,''), anonKey: k }
  } catch { /* noop */ }
  const s = localStorage.getItem(LOCAL_KEYS.MOBILE_SESSION)
  if (s) { try { session.value = JSON.parse(s) } catch { /* noop */ } }
  const p = localStorage.getItem(PENDING_KEY)
  if (p) {
    try {
      pending.value = (JSON.parse(p) as Partial<PendingCapture>[]).map(item => ({
        contentKind: item.contentKind === 'text' ? 'text' : 'link',
        url: item.url,
        text: item.text,
        title: item.title,
        note: item.note,
        createdAt: item.createdAt || Date.now(),
      }))
    } catch { /* noop */ }
  }
  // 分享目标：从地址栏取 link/title（Android 分享）
  const q = new URLSearchParams(location.search)
  const link = q.get('link') || q.get('url') || ''
  const sharedText = q.get('text') || ''
  if (link && /^https?:\/\//i.test(link)) url.value = link
  else if (/^https?:\/\/\S+$/i.test(sharedText.trim())) { contentKind.value = 'link'; url.value = sharedText.trim() }
  else if (sharedText.trim()) { contentKind.value = 'text'; contentText.value = sharedText }
  const t = q.get('title') || ''
  if (t) title.value = t
  window.addEventListener('online', () => { void flushPending() })
  if (logged.value) void flushPending()
})
</script>

<template>
  <div class="m-shell">
    <header class="m-head">
      <div class="m-brand"><img src="./icon.png" alt="" class="m-logo" /><div><div class="m-title">知源 · 移动采集</div><div class="m-sub">链接与文本先进入 Inbox，回到电脑再转三卡</div></div></div>
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
          <div class="m-card-t">采集到 Inbox</div>
          <div class="m-kind-switch" role="tablist" aria-label="采集类型">
            <button type="button" :class="{ on: contentKind === 'link' }" @click="contentKind = 'link'">链接</button>
            <button type="button" :class="{ on: contentKind === 'text' }" @click="contentKind = 'text'">文本</button>
          </div>
          <input v-if="contentKind === 'link'" v-model="url" class="m-input" type="url" placeholder="https://…" inputmode="url" />
          <textarea v-else v-model="contentText" class="m-textarea m-textarea-main" placeholder="粘贴或输入文本、想法、摘录…"></textarea>
          <input v-model="title" class="m-input" type="text" placeholder="标题（可选）" />
          <textarea v-model="note" class="m-textarea" placeholder="备注（可选）"></textarea>
          <div v-if="err" class="m-err">{{ err }}</div>
          <div v-if="msg" class="m-ok">{{ msg }}</div>
          <button class="m-btn" :disabled="busy" @click="submit">{{ busy ? '提交中…' : '提交到 Inbox' }}</button>
          <div class="m-tip">提交后在电脑端「手边的卡 → Inbox」按时间盘点并转化为任务 / 好奇心 / 资源卡。</div>
        </div>
      </template>

      <div v-if="pending.length" class="m-pending">待同步 {{ pending.length }} 条（联网登录后自动发）</div>
    </main>
  </div>
</template>
