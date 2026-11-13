/**
 * 知源 · Supabase 云客户端（v4.0.1）
 * 不引入 Supabase SDK，直接用 fetch 打 GoTrue/PostgREST；模块在设置页/启动检查时才动态加载。
 * 仅使用 publishable（anon）key + 用户 access token；严禁 service-role/secret。
 */
import { K } from '@/shared/storage/keys'

export interface CloudEnv { url: string; anonKey: string }

const OVERRIDE_KEY = K.CLOUD_ENV

/** 读取构建时环境（供初始默认值）；未配置时返回 null */
function buildEnv(): CloudEnv | null {
  const url = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL?.trim()
  const anonKey = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !anonKey || !anonKey.startsWith('sb_publishable_')) return null
  return { url: url.replace(/\/$/, ''), anonKey }
}

/** 用户可在设置页覆盖（跨设备时 A/B 都填同一份才能互相同步） */
export async function setCloudEnvOverride(env: CloudEnv | null): Promise<void> {
  try {
    const cs = chrome?.storage?.local
    if (!cs) return
    if (env?.url && env?.anonKey) await cs.set({ [OVERRIDE_KEY]: env })
    else await cs.remove([OVERRIDE_KEY])
  } catch { /* noop */ }
}

/** 当前生效环境 = 设置页覆盖优先，其次构建时 env */
export async function cloudEnv(): Promise<CloudEnv | null> {
  try {
    const cs = chrome?.storage?.local
    if (cs) {
      const raw = (await cs.get([OVERRIDE_KEY]))[OVERRIDE_KEY] as CloudEnv | undefined
      if (raw?.url && raw?.anonKey && raw.anonKey.startsWith('sb_publishable_')) return raw
    }
  } catch { /* noop */ }
  return buildEnv()
}

/** 初始默认值用于设置页回填（同步读取构建 env，失败为空串） */
export function cloudEnvDefaults(): { url: string; anonKey: string } {
  const e = buildEnv()
  return { url: e?.url || '', anonKey: e?.anonKey || '' }
}

export class CloudError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

const RATE_LIMIT_MAX_RETRY = 3
const RATE_LIMIT_BASE_MS = 300
const RATE_LIMIT_CAP_MS = 4_000

function retryAfterMs(res: Response, attempt: number): number {
  const fallback = Math.min(RATE_LIMIT_BASE_MS * (2 ** attempt), RATE_LIMIT_CAP_MS)
  const seconds = Number(res.headers.get('retry-after'))
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback
  return Math.min(seconds * 1_000, RATE_LIMIT_CAP_MS)
}

function retry429(res: Response, attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, retryAfterMs(res, attempt)))
}

async function req<T>(env: CloudEnv, path: string, init: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { apikey: env.anonKey, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  let res: Response | undefined
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRY; attempt += 1) {
    res = await fetch(env.url + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } })
    if (res.status !== 429 || attempt === RATE_LIMIT_MAX_RETRY) break
    await retry429(res, attempt)
  }
  if (!res) throw new CloudError(0, '云端请求未发出')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new CloudError(res.status, `云端请求失败 ${res.status}：${text.slice(0, 200)}`)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  return (ct.includes('application/json') ? await res.json() : await res.text()) as T
}

function storagePath(path: string): string {
  return path.split('/').map(part => encodeURIComponent(part)).join('/')
}

async function rawRequest(env: CloudEnv, path: string, init: RequestInit, token: string): Promise<Response> {
  const headers: Record<string, string> = { apikey: env.anonKey, Authorization: 'Bearer ' + token }
  const res = await fetch(env.url + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new CloudError(res.status, `云端存储请求失败 ${res.status}：${text.slice(0, 200)}`)
  }
  return res
}

export const cloud = {
  // ---- Auth ----
  login: (env: CloudEnv, email: string, password: string) =>
    req<{ access_token: string; refresh_token: string; user: { id: string; email?: string } }>(
      env, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: (env: CloudEnv, refreshToken: string) =>
    req<{ access_token: string; refresh_token?: string; user: { id: string; email?: string } }>(
      env, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }),
  logout: (env: CloudEnv, token: string) =>
    req<void>(env, '/auth/v1/logout', { method: 'POST' }, token),

  // ---- 云快照（revision 乐观锁）----
  getSnapshot: (env: CloudEnv, token: string, userId: string) =>
    req<{ revision: number; updated_at: string; state: unknown }[]>(
      env, `/rest/v1/cloud_snapshots?select=revision,updated_at,state&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { method: 'GET' }, token),
  insertSnapshot: (env: CloudEnv, token: string, userId: string, state: unknown) =>
    req<{ revision: number; updated_at: string }[]>(
      env, '/rest/v1/cloud_snapshots',
      { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: userId, state }) }, token),
  updateSnapshot: (env: CloudEnv, token: string, userId: string, expectedRevision: number, state: unknown) =>
    req<{ revision: number; updated_at: string }[]>(
      env, `/rest/v1/cloud_snapshots?user_id=eq.${encodeURIComponent(userId)}&revision=eq.${expectedRevision}`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ state }) }, token),

  // ---- 账号级操作事件 ----
  upsertAccountEvents: async (
    env: CloudEnv,
    token: string,
    userId: string,
    rows: {
      id: string
      device_id: string
      event_ts: string
      action: string
      card_kind: string
      card_id: string | null
      title_snapshot: string
      to_state: string | null
      payload: Record<string, unknown>
    }[],
  ) => {
    const BATCH_SIZE = 300
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE).map(row => ({ ...row, user_id: userId }))
      await req<void>(env, '/rest/v1/account_events?on_conflict=user_id,id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(batch),
      }, token)
    }
  },
  listAccountEvents: (
    env: CloudEnv,
    token: string,
    afterCreatedAt: string,
    offset: number,
    limit: number,
  ) =>
    req<{
      id: string
      device_id: string | null
      event_ts: string
      action: 'create' | 'delete' | 'restore' | 'purge' | 'status' | 'call'
      card_kind: 'resource' | 'task' | 'curiosity' | 'system'
      card_id: string | null
      title_snapshot: string | null
      to_state: string | null
      created_at: string
    }[]>(
      env,
      `/rest/v1/account_events?select=id,device_id,event_ts,action,card_kind,card_id,title_snapshot,to_state,created_at`
        + `&created_at=gt.${encodeURIComponent(afterCreatedAt)}&order=created_at.asc,id.asc&limit=${limit}&offset=${offset}`,
      { method: 'GET' },
      token,
    ),

  // ---- Curation Storage ----
  uploadStorageObject: async (env: CloudEnv, token: string, bucket: string, path: string, blob: Blob) => {
    await rawRequest(env, `/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath(path)}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: blob,
    }, token)
  },
  downloadStorageObject: async (env: CloudEnv, token: string, bucket: string, path: string) => {
    const res = await rawRequest(env, `/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath(path)}`, { method: 'GET' }, token)
    return res.blob()
  },
  deleteStorageObject: (env: CloudEnv, token: string, bucket: string, path: string) =>
    req<void>(env, `/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ prefixes: [path] }),
    }, token),
}
