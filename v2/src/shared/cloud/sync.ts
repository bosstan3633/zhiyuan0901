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
  syncedFingerprint?: string
  lastUploadAt?: number
  lastDownloadAt?: number
  lastCheckedAt?: number
  checkOnStart: boolean
}

export interface SnapshotState { data: AppData; ui: UIPrefs | null; eventLog: CardEvent[] }
export type CloudUploadDecision = 'upload' | 'download' | 'cancel'
export type UploadNowResult =
  | { kind: 'uploaded'; revision: number; fingerprint: string }
  | { kind: 'cancelled'; remoteRevision: number }
  | { kind: 'download_requested'; remoteRevision: number }
export type CloudRelation =
  | 'unknown'
  | 'in_sync'
  | 'local_changed'
  | 'remote_changed'
  | 'both_changed'
  | 'empty_remote'

export interface CloudCheckResult {
  kind: 'idle' | CloudRelation
  relation: 'idle' | CloudRelation
  remoteRevision: number
  remoteUpdatedAt?: string
  localFingerprint?: string
  remoteFingerprint?: string
}

const META_KEY = K.CLOUD_META
const REVISION_CONFLICT_MAX_RETRIES = 2

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
export function sanitizeSnapshot(data: AppData, ui: UIPrefs | null, eventLog: CardEvent[]): SnapshotState {
  const d = JSON.parse(JSON.stringify(data)) as AppData & Record<string, unknown>
  delete d.airtableSync
  delete d.airtableMap
  delete (d as Record<string, unknown>).__wid
  delete (d as Record<string, unknown>).__cloud
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
  if (safeUi) {
    delete (safeUi as unknown as Record<string, unknown>).__cloud
    delete (safeUi as unknown as Record<string, unknown>).__wid
  }
  return { data: d, ui: safeUi, eventLog: [...eventLog] }
}

/** 稳定序列化：对象键固定排序，数组顺序保留，保证两台设备对同一内容得到同一指纹。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function fallbackHash(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code + i
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `fnv:${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

/** 对干净快照做内容指纹；只排除附件本体/凭据等不进云内容，不依赖 revision。 */
export async function fingerprintSnapshot(snapshot: SnapshotState): Promise<string> {
  const clean = sanitizeSnapshot(snapshot.data, snapshot.ui, snapshot.eventLog)
  const input = stableStringify(clean)
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
      return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
    }
  } catch { /* 降级到确定性哈希 */ }
  return fallbackHash(input)
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

/** 比较本机、上次成功同步基线与云端三份干净快照。 */
export async function checkRemote(localSnapshot: SnapshotState): Promise<CloudCheckResult> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return { kind: 'idle', relation: 'idle', remoteRevision: 0 }
  const localFingerprint = await fingerprintSnapshot(localSnapshot)
  const token = await accessToken(env, meta)
  const rows = await cloud.getSnapshot(env, token, meta.userId)
  if (!rows.length) {
    await writeMeta({ lastCheckedAt: Date.now() })
    return { kind: 'empty_remote', relation: 'empty_remote', remoteRevision: 0, localFingerprint }
  }
  const rem = rows[0]
  const remoteState = (rem.state as SnapshotState) || null
  if (!remoteState?.data || remoteState.data.version !== 2) throw new Error('云端快照格式不兼容')
  const remoteFingerprint = await fingerprintSnapshot({
    data: remoteState.data,
    ui: remoteState.ui || null,
    eventLog: remoteState.eventLog || [],
  })
  // 只有完整读取并验证成功后才记录检查时间，格式异常不能留下“已检查”的假信号。
  await writeMeta({ lastCheckedAt: Date.now() })
  const baseline = meta.syncedFingerprint
  let relation: CloudRelation
  if (localFingerprint === remoteFingerprint) {
    relation = 'in_sync'
    // 升级后首次检查若两端内容一致，直接建立基线，不必让用户做一次无意义的选择。
    if (!baseline || meta.revision !== rem.revision) {
      await writeMeta({ syncedFingerprint: localFingerprint, revision: rem.revision })
    }
  } else if (!baseline) relation = 'unknown'
  else if (localFingerprint !== baseline && remoteFingerprint === baseline) relation = 'local_changed'
  else if (localFingerprint === baseline && remoteFingerprint !== baseline) relation = 'remote_changed'
  else relation = 'both_changed'
  return {
    kind: relation,
    relation,
    remoteRevision: rem.revision,
    remoteUpdatedAt: rem.updated_at,
    localFingerprint,
    remoteFingerprint,
  }
}

export async function uploadNow(
  snap: SnapshotState,
  onConflict: (remoteRevision: number) => Promise<CloudUploadDecision>,
  approvedRemoteRevision?: number,
): Promise<UploadNowResult> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  const clean = sanitizeSnapshot(snap.data, snap.ui, snap.eventLog)
  const fingerprint = await fingerprintSnapshot(clean)
  const localRevision = meta.revision || 0
  let initialApproval = approvedRemoteRevision

  for (let attempt = 0; attempt <= REVISION_CONFLICT_MAX_RETRIES; attempt += 1) {
    const rows = await cloud.getSnapshot(env, token, meta.userId)
    const remote = rows[0]
    if (!remote) {
      const ins = await cloud.insertSnapshot(env, token, meta.userId, clean)
      const rev = ins[0]?.revision ?? 1
      await writeMeta({ revision: rev, syncedFingerprint: fingerprint, lastUploadAt: Date.now() })
      return { kind: 'uploaded', revision: rev, fingerprint }
    }

    // 用户在前面“检查关系”里已经明确选了上传时，只允许初检修订直接续用一次。
    // PATCH 失败后的任何重试都必须重新确认，哪怕云端修订号碰巧没变。
    const canUseInitialApproval = attempt === 0 && initialApproval === remote.revision
    if ((remote.revision !== localRevision || attempt > 0) && !canUseInitialApproval) {
      const decision = await onConflict(remote.revision)
      if (decision === 'cancel') return { kind: 'cancelled', remoteRevision: remote.revision }
      if (decision === 'download') return { kind: 'download_requested', remoteRevision: remote.revision }
    }
    initialApproval = undefined

    const upd = await cloud.updateSnapshot(env, token, meta.userId, remote.revision, clean)
    if (upd.length) {
      const rev = upd[0].revision
      await writeMeta({ revision: rev, syncedFingerprint: fingerprint, lastUploadAt: Date.now() })
      return { kind: 'uploaded', revision: rev, fingerprint }
    }
  }

  throw new Error('上传冲突：云端连续更新，已停止自动重试，请重新检查后再同步')
}

export async function downloadNow(): Promise<{ state: SnapshotState; revision: number; fingerprint: string }> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  const rows = await cloud.getSnapshot(env, token, meta.userId)
  if (!rows.length) throw new Error('云端暂无快照')
  const st = (rows[0].state as SnapshotState) || null
  if (!st || !st.data || st.data.version !== 2) throw new Error('云端快照格式不兼容')
  // 旧云快照可能仍带 Airtable 凭据/映射或本机写锁；恢复到本机前走与上传同一条脱敏边界。
  const safe = sanitizeSnapshot(st.data, st.ui || null, st.eventLog || [])
  const fingerprint = await fingerprintSnapshot(safe)
  return { state: safe, revision: rows[0].revision, fingerprint }
}

export async function markDownloaded(revision: number, fingerprint: string): Promise<void> {
  await writeMeta({ revision, syncedFingerprint: fingerprint, lastDownloadAt: Date.now() })
}

// ---- 移动采集 ----
export interface CaptureItem { id: string; url: string; title?: string; note?: string; tags: string[]; createdAt: number }

export async function listCaptures(): Promise<CaptureItem[]> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return []
  const token = await accessToken(env, meta)
  const rows = await cloud.listCaptures(env, token)
  const seen = new Set<string>()
  return rows
    .filter(row => {
      if (seen.has(row.id)) return false
      seen.add(row.id)
      return true
    })
    .map(r => ({
      id: r.id,
      url: r.url,
      title: r.title || undefined,
      note: r.note || undefined,
      tags: r.tags || [],
      createdAt: Date.parse(r.created_at) || 0,
    }))
}

export async function consumeCapture(id: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return
  const token = await accessToken(env, meta)
  await cloud.consumeCapture(env, token, id)
}

export async function deleteCapture(id: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return
  const token = await accessToken(env, meta)
  await cloud.deleteCapture(env, token, id)
}

export async function deleteCaptures(ids: string[]): Promise<void> {
  if (!ids.length) return
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return
  const token = await accessToken(env, meta)
  await cloud.deleteAllCaptures(env, token, ids)
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
    customFields: { captureInboxId: meta.id },
    pinned: false,
    callCount: 0,
    createdAt: meta.createdAt,
    updatedAt: Date.now(),
  }
}
