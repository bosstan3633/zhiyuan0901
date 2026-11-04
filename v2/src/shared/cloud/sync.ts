/**
 * 知源 · 云同步协调层（v4.0.1）
 * 手动上传/下载 + 启动检查；冲突必须用户确认；附件本体与 AI 凭据不进云。
 */
import type { AppData, UIPrefs, AssetMeta } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { cloudEnv, cloud, type CloudEnv, setCloudEnvOverride } from './client'
import { K } from '@/shared/storage/keys'

export interface CloudMeta {
  userId: string
  email: string
  refreshToken: string
  revision: number
  lastUploadAt?: number
  lastDownloadAt?: number
  lastCheckedAt?: number
  checkOnStart: boolean
}

export interface SnapshotState { data: AppData; ui: UIPrefs | null; eventLog: CardEvent[] }
export interface CloudCheckResult { kind: 'idle' | 'same' | 'remote_new' | 'remote_diff' | 'none'; remoteRevision: number; remoteUpdatedAt?: string }

const META_KEY = K.CLOUD_META

async function readMeta(): Promise<CloudMeta | null> {
  try {
    const cs = chrome?.storage?.local
    if (!cs) return null
    const raw = (await cs.get([META_KEY]))[META_KEY]
    return raw && typeof raw === 'object' ? raw as CloudMeta : null
  } catch { return null }
}
async function writeMeta(patch: Partial<CloudMeta>): Promise<CloudMeta> {
  const cur = (await readMeta()) || ({ userId: '', email: '', refreshToken: '', revision: 0, checkOnStart: true } as CloudMeta)
  const next = { ...cur, ...patch }
  try { await chrome?.storage?.local?.set({ [META_KEY]: next }) } catch { /* noop */ }
  return next
}
export const getCloudMeta = readMeta

export async function setCheckOnStart(v: boolean): Promise<CloudMeta> {
  return writeMeta({ checkOnStart: v })
}

export async function setCloudEnv(env: CloudEnv | null): Promise<void> {
  return setCloudEnvOverride(env)
}

/** 脱敏：保留附件元数据供跨设备索引；去附件本体、AI 凭据、__wid、Airtable 与云元数据 */
function sanitize(data: AppData, ui: UIPrefs | null, eventLog: CardEvent[]): SnapshotState {
  const d = JSON.parse(JSON.stringify(data)) as AppData & Record<string, unknown>
  delete d.airtableSync
  delete d.airtableMap
  delete (d as Record<string, unknown>).__wid
  const safeAsset = (a: AssetMeta): AssetMeta => ({
    id: a.id,
    kind: a.kind,
    name: a.name,
    size: a.size,
    mime: a.mime,
    createdAt: a.createdAt,
  })
  const stripAssets = (cards?: { assets?: AssetMeta[] }[]) => {
    for (const c of cards || []) if (c && c.assets && c.assets.length) c.assets = c.assets.map(safeAsset)
  }
  stripAssets(d.resources); stripAssets(d.tasks); stripAssets(d.curiosities)
  if (d.argCards) stripAssets(d.argCards as unknown as { assets?: AssetMeta[] }[])
  const safeUi = ui ? JSON.parse(JSON.stringify(ui)) as UIPrefs : null
  if (safeUi) delete (safeUi as unknown as Record<string, unknown>).__cloud
  return { data: d, ui: safeUi, eventLog: [...eventLog] }
}

let tokenCache: { accessToken: string; exp: number } | null = null
async function accessToken(env: CloudEnv, meta: CloudMeta, force = false): Promise<string> {
  const now = Date.now()
  if (!force && tokenCache && tokenCache.exp - now > 60_000) return tokenCache.accessToken
  const r = await cloud.refresh(env, meta.refreshToken)
  if (r.refresh_token && r.refresh_token !== meta.refreshToken) await writeMeta({ refreshToken: r.refresh_token })
  tokenCache = { accessToken: r.access_token, exp: now + 55 * 60_000 }
  return r.access_token
}

export async function login(email: string, password: string): Promise<CloudMeta> {
  const env = await cloudEnv()
  if (!env) throw new Error('云端未配置')
  const r = await cloud.login(env, email.trim(), password)
  const meta = await writeMeta({
    userId: r.user.id, email: r.user.email || email.trim(), refreshToken: r.refresh_token, checkOnStart: true,
  })
  tokenCache = { accessToken: r.access_token, exp: Date.now() + 55 * 60_000 }
  return meta
}

export async function logout(): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (env && meta && tokenCache) { try { await cloud.logout(env, tokenCache.accessToken) } catch { /* noop */ } }
  tokenCache = null
  try { await chrome?.storage?.local?.remove([META_KEY]) } catch { /* noop */ }
}

/** 启动非阻塞检查：与云端 revision 比对 */
export async function checkRemote(): Promise<CloudCheckResult> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return { kind: 'idle', remoteRevision: 0 }
  const token = await accessToken(env, meta)
  const rows = await cloud.getSnapshot(env, token, meta.userId)
  await writeMeta({ lastCheckedAt: Date.now() })
  if (!rows.length) return { kind: 'none', remoteRevision: 0 }
  const rem = rows[0]
  const localRev = meta.revision || 0
  const kind: CloudCheckResult['kind'] = rem.revision === localRev ? 'same' : 'remote_new'
  return { kind, remoteRevision: rem.revision, remoteUpdatedAt: rem.updated_at }
}

export async function uploadNow(snap: SnapshotState, onConflict: (r: number) => Promise<boolean>): Promise<{ revision: number }> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  const clean = sanitize(snap.data, snap.ui, snap.eventLog)
  const rows = await cloud.getSnapshot(env, token, meta.userId)
  const remote = rows[0]
  if (!remote) {
    const ins = await cloud.insertSnapshot(env, token, meta.userId, clean)
    const rev = ins[0]?.revision ?? 1
    await writeMeta({ revision: rev, lastUploadAt: Date.now() })
    return { revision: rev }
  }
  if (remote.revision !== (meta.revision || 0)) {
    const ok = await onConflict(remote.revision)
    if (!ok) throw new Error('已取消上传（云端版本更高）')
    // 用户确认以本地覆盖云端：先对齐基线
    await writeMeta({ revision: remote.revision })
  }
  const base = (await readMeta())!.revision || remote.revision
  const upd = await cloud.updateSnapshot(env, token, meta.userId, base, clean)
  if (!upd.length) throw new Error('上传冲突：云端更新被另一设备抢先')
  const rev = upd[0].revision
  await writeMeta({ revision: rev, lastUploadAt: Date.now() })
  return { revision: rev }
}

export async function downloadNow(): Promise<{ state: SnapshotState; revision: number }> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  const rows = await cloud.getSnapshot(env, token, meta.userId)
  if (!rows.length) throw new Error('云端暂无快照')
  const st = (rows[0].state as SnapshotState) || null
  if (!st || !st.data || st.data.version !== 2) throw new Error('云端快照格式不兼容')
  // 旧云快照可能仍带 Airtable 凭据/映射或本机写锁；恢复到本机前走与上传同一条脱敏边界。
  const safe = sanitize(st.data, st.ui || null, st.eventLog || [])
  return { state: safe, revision: rows[0].revision }
}

export async function markDownloaded(revision: number): Promise<void> {
  await writeMeta({ revision, lastDownloadAt: Date.now() })
}

// ---- 移动采集 ----
export interface CaptureItem { id: string; url: string; title?: string; note?: string; tags: string[]; createdAt: number }

export async function listCaptures(): Promise<CaptureItem[]> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return []
  const token = await accessToken(env, meta)
  const rows = await cloud.listCaptures(env, token)
  return rows.map(r => ({ id: r.id, url: r.url, title: r.title || undefined, note: r.note || undefined, tags: r.tags || [], createdAt: Date.parse(r.created_at) || Date.now() }))
}

export async function consumeCapture(id: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return
  const token = await accessToken(env, meta)
  await cloud.consumeCapture(env, token, id)
}

/** 把采集链接落成资源卡（由设置页在 saveDataNow 成功后调用 consumeCapture） */
export function buildCapturedResource(meta: CaptureItem): import('@/shared/models').ResourceCard {
  return {
    id: 'res_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    kind: 'resource',
    title: (meta.title || meta.url || '未命名链接').slice(0, 200),
    linkType: 'url',
    link: meta.url,
    workspaceId: CURATION_WS_ID,
    categoryId: '',
    description: meta.note,
    tags: meta.tags,
    customFields: {},
    pinned: false,
    callCount: 0,
    createdAt: meta.createdAt,
    updatedAt: Date.now(),
  }
}
