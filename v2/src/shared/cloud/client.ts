/**
 * 知源 · Supabase 云客户端（v4.0.1）
 * 不引入 Supabase SDK，直接用 fetch 打 GoTrue/PostgREST；模块在设置页/启动检查时才动态加载。
 * 仅使用 publishable（anon）key + 用户 access token；严禁 service-role/secret。
 */

export interface CloudEnv { url: string; anonKey: string }

/** 从 Vite 环境读取；未配置时返回 null（设置页显示「云端未配置」） */
export function cloudEnv(): CloudEnv | null {
  const url = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL?.trim()
  const anonKey = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !anonKey || !anonKey.startsWith('sb_publishable_')) return null
  return { url: url.replace(/\/$/, ''), anonKey }
}

export class CloudError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

async function req<T>(env: CloudEnv, path: string, init: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { apikey: env.anonKey, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(env.url + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new CloudError(res.status, `云端请求失败 ${res.status}：${text.slice(0, 200)}`)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') || ''
  return (ct.includes('application/json') ? await res.json() : await res.text()) as T
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

  // ---- 移动采集 inbox ----
  listCaptures: (env: CloudEnv, token: string) =>
    req<{ id: string; url: string; title: string | null; note: string | null; tags: string[]; created_at: string }[]>(
      env, '/rest/v1/capture_inbox?select=id,url,title,note,tags,created_at&consumed_at=is.null&order=created_at.asc',
      { method: 'GET' }, token),
  consumeCapture: (env: CloudEnv, token: string, id: string) =>
    req<void>(env, `/rest/v1/capture_inbox?id=eq.${encodeURIComponent(id)}`,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ consumed_at: new Date().toISOString() }) }, token),
}
