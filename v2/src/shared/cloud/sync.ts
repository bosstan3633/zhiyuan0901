/**
 * 知源 · 云同步协调层（v4.0.1）
 * 手动上传/下载 + 启动检查；冲突必须用户确认。
 * 普通卡附件与 AI 凭据不进云；策展节点附件只把 Blob 放入用户私有 Storage。
 */
import type { AppData, UIPrefs, AssetMeta } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { cloudEnv, cloud, type CloudEnv, setCloudEnvOverride } from './client'
import { K, LOCAL_KEYS } from '@/shared/storage/keys'
import { getAssetBlob } from '@/shared/storage/assets'

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
  /** 策展节点附件默认静默上传；关闭后新附件只留本机。 */
  assetSyncEnabled?: boolean
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

export async function setCurationAssetSyncEnabled(v: boolean): Promise<CloudMeta> {
  return writeMeta({ assetSyncEnabled: v })
}

export async function setCloudEnv(env: CloudEnv | null): Promise<void> {
  return setCloudEnvOverride(env)
}

const CURATION_ASSET_BUCKET = 'curation-assets'
const SAFE_CURATION_UPLOAD_STATES = new Set(['local', 'pending', 'synced', 'failed'])

/**
 * 今日三件事是主快照中的业务数据，不经过附件白名单。
 * 槽位用对象展开保留现有与未来字段（id / source / text / done / doneAt / auto 等）。
 */
function preserveDailyFocus(source: AppData['dailyFocus'] | undefined): AppData['dailyFocus'] {
  const out: AppData['dailyFocus'] = {}
  for (const [date, slots] of Object.entries(source || {})) {
    out[date] = (slots || []).map(slot => ({ ...slot }))
  }
  return out
}

/** 脱敏：普通卡附件只保留索引；L1 论点卡与 L2–L4 分类附件额外保留云对象元数据。今日三件事等主数据字段原样保留。 */
export function sanitizeSnapshot(data: AppData, ui: UIPrefs | null, eventLog: CardEvent[]): SnapshotState {
  const d = JSON.parse(JSON.stringify(data)) as AppData & Record<string, unknown>
  delete d.airtableSync
  delete d.airtableMap
  delete (d as Record<string, unknown>).__wid
  delete (d as Record<string, unknown>).__cloud
  // 今日三件事使用显式白名单边界：dailyFocus 的槽位字段整体保留，自动推荐/静音日期随主快照同行。
  Object.assign(d, {
    dailyFocus: preserveDailyFocus(d.dailyFocus),
    focusAutoDate: d.focusAutoDate,
    focusMutedDate: d.focusMutedDate,
  })
  const safeAsset = (a: AssetMeta): AssetMeta => ({
    id: a.id,
    kind: a.kind,
    name: a.name,
    size: a.size,
    mime: a.mime,
    createdAt: a.createdAt,
  })
  const curationAsset = (asset: AssetMeta): AssetMeta => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    size: asset.size,
    mime: asset.mime,
    createdAt: asset.createdAt,
    storagePath: asset.storagePath,
    uploadState: SAFE_CURATION_UPLOAD_STATES.has(asset.uploadState || '') ? asset.uploadState : 'local',
    checksum: asset.checksum,
    uploadedAt: asset.uploadedAt,
    lastError: asset.lastError,
    retryCount: asset.retryCount,
  })
  const stripAssets = (cards?: { assets?: AssetMeta[] }[]) => {
    for (const c of cards || []) if (c && c.assets && c.assets.length) c.assets = c.assets.map(safeAsset)
  }
  stripAssets(d.tasks); stripAssets(d.curiosities)
  if (d.argCards) stripAssets(d.argCards as unknown as { assets?: AssetMeta[] }[])
  for (const resource of d.resources || []) {
    if (!resource.assets?.length) continue
    resource.assets = resource.assets.map(resource.isThesis ? curationAsset : safeAsset)
  }
  for (const category of d.categories || []) {
    if (!category.assets?.length) continue
    category.assets = category.assets.map(curationAsset)
  }
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

export interface CurationAssetContext {
  workspaceId: string
  nodeId: string
}

function assetExt(meta: AssetMeta): string {
  const byName = meta.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]
  if (byName) return byName.toLowerCase()
  return meta.kind === 'image' ? 'png' : meta.kind === 'pdf' ? 'pdf' : 'html'
}

async function checksumOf(blob: Blob): Promise<string> {
  try {
    if (!globalThis.crypto?.subtle) return ''
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}

/** 本地优先上传单个策展节点附件；直接更新传入的元数据对象供 Vue 界面即时显示状态。 */
export async function uploadCurationAsset(meta: AssetMeta, blob: Blob, ctx: CurationAssetContext): Promise<AssetMeta> {
  meta.uploadState = 'pending'
  meta.lastError = undefined
  const env = await cloudEnv(); const cloudMeta = await readMeta()
  if (!env || !cloudMeta?.refreshToken || cloudMeta.assetSyncEnabled === false) {
    meta.uploadState = 'local'
    return meta
  }
  try {
    const token = await accessToken(env, cloudMeta)
    const path = `${cloudMeta.userId}/${ctx.workspaceId}/${ctx.nodeId}/${meta.id}.${assetExt(meta)}`
    meta.storagePath = path
    meta.checksum = await checksumOf(blob)
    await cloud.uploadStorageObject(env, token, CURATION_ASSET_BUCKET, path, blob)
    meta.uploadState = 'synced'
    meta.uploadedAt = Date.now()
    meta.retryCount = 0
  } catch (error) {
    meta.uploadState = 'failed'
    meta.lastError = error instanceof Error ? error.message : String(error)
    meta.retryCount = (meta.retryCount || 0) + 1
  }
  return meta
}

/** 本地 Blob 缺失时按 storagePath 从私有 Bucket 拉取。 */
export async function downloadCurationAsset(meta: AssetMeta): Promise<Blob | null> {
  if (!meta.storagePath) return null
  const env = await cloudEnv(); const cloudMeta = await readMeta()
  if (!env || !cloudMeta?.refreshToken) return null
  const token = await accessToken(env, cloudMeta)
  return cloud.downloadStorageObject(env, token, CURATION_ASSET_BUCKET, meta.storagePath)
}

interface PendingAssetDelete {
  path: string
  queuedAt: number
  attempts: number
  lastError?: string
}

function readDeleteQueue(): PendingAssetDelete[] {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_KEYS.CURATION_ASSET_DELETE_QUEUE)
    const rows = raw ? JSON.parse(raw) as PendingAssetDelete[] : []
    return Array.isArray(rows) ? rows.filter(row => typeof row?.path === 'string' && row.path) : []
  } catch { return [] }
}

function writeDeleteQueue(rows: PendingAssetDelete[]): void {
  try {
    if (rows.length) globalThis.localStorage?.setItem(LOCAL_KEYS.CURATION_ASSET_DELETE_QUEUE, JSON.stringify(rows))
    else globalThis.localStorage?.removeItem(LOCAL_KEYS.CURATION_ASSET_DELETE_QUEUE)
  } catch { /* 隐私模式写不进时仍保留当前调用链错误提示 */ }
}

function enqueueAssetDelete(path: string, error?: unknown): void {
  const rows = readDeleteQueue()
  const current = rows.find(row => row.path === path)
  if (current) {
    current.attempts += 1
    current.lastError = error instanceof Error ? error.message : error ? String(error) : current.lastError
  } else {
    rows.push({
      path,
      queuedAt: Date.now(),
      attempts: 0,
      lastError: error instanceof Error ? error.message : error ? String(error) : undefined,
    })
  }
  writeDeleteQueue(rows)
}

function dequeueAssetDelete(path: string): void {
  writeDeleteQueue(readDeleteQueue().filter(row => row.path !== path))
}

/** 永久删除策展附件时尽力清理远端；未登录或失败会进入持久重试队列，不阻塞本地删除。 */
export async function deleteCurationAsset(meta: AssetMeta): Promise<void> {
  if (!meta.storagePath) return
  const env = await cloudEnv(); const cloudMeta = await readMeta()
  if (!env || !cloudMeta?.refreshToken) {
    enqueueAssetDelete(meta.storagePath, '等待登录云端后重试')
    return
  }
  try {
    const token = await accessToken(env, cloudMeta)
    await cloud.deleteStorageObject(env, token, CURATION_ASSET_BUCKET, meta.storagePath)
    dequeueAssetDelete(meta.storagePath)
  } catch (error) {
    enqueueAssetDelete(meta.storagePath, error)
    throw error
  }
}

let retryingCurationAssets: Promise<number> | null = null

/**
 * 应用启动/联网恢复时补传未完成附件。
 * 覆盖 L1 论点卡与 L2–L4 分类节点；普通卡片附件仍严格留在本机。
 */
export async function retryPendingCurationAssets(data: AppData): Promise<number> {
  if (retryingCurationAssets) return retryingCurationAssets
  retryingCurationAssets = (async () => {
    const cloudMeta = await readMeta()
    if (!cloudMeta?.refreshToken || cloudMeta.assetSyncEnabled === false) return 0
    let changed = 0
    const retryOwner = async (assets: AssetMeta[] | undefined, ctx: CurationAssetContext) => {
      for (const asset of assets || []) {
        if (asset.uploadState === 'synced') continue
        const blob = await getAssetBlob(asset.id)
        if (!blob) continue
        const before = asset.uploadState
        await uploadCurationAsset(asset, blob, ctx)
        if (asset.uploadState !== before) changed++
      }
    }
    for (const category of data.categories || []) {
      if (category.deletedAt) continue
      await retryOwner(category.assets, {
        workspaceId: category.workspaceId,
        nodeId: category.id,
      })
    }
    for (const resource of data.resources || []) {
      if (!resource.isThesis || resource.deletedAt || !resource.workspaceId) continue
      await retryOwner(resource.assets, {
        workspaceId: resource.workspaceId,
        nodeId: resource.id,
      })
    }
    return changed
  })()
  try {
    return await retryingCurationAssets
  } finally {
    retryingCurationAssets = null
  }
}

/** 联网或重新登录后补做远端删除；返回本次成功清理的对象数。 */
export async function retryPendingCurationAssetDeletes(): Promise<number> {
  const queue = readDeleteQueue()
  if (!queue.length) return 0
  const env = await cloudEnv(); const cloudMeta = await readMeta()
  if (!env || !cloudMeta?.refreshToken) return 0
  const token = await accessToken(env, cloudMeta)
  const failed: PendingAssetDelete[] = []
  let done = 0
  for (const row of queue) {
    try {
      await cloud.deleteStorageObject(env, token, CURATION_ASSET_BUCKET, row.path)
      done += 1
    } catch (error) {
      failed.push({
        ...row,
        attempts: row.attempts + 1,
        lastError: error instanceof Error ? error.message : String(error),
      })
    }
  }
  writeDeleteQueue(failed)
  return done
}

export async function markDownloaded(revision: number, fingerprint: string): Promise<void> {
  await writeMeta({ revision, syncedFingerprint: fingerprint, lastDownloadAt: Date.now() })
}

// ---- 移动采集 ----
export type CaptureKind = 'link' | 'text'
export type CaptureConvertedKind = 'task' | 'curiosity' | 'resource'
export interface CaptureItem {
  id: string
  contentKind: CaptureKind
  url?: string
  text?: string
  title?: string
  note?: string
  tags: string[]
  createdAt: number
  convertedAt?: number
  convertedKind?: CaptureConvertedKind
  convertedCardId?: string
}

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
      contentKind: r.content_kind || (r.url ? 'link' : 'text'),
      url: r.url || undefined,
      text: r.text_content || undefined,
      title: r.title || undefined,
      note: r.note || undefined,
      tags: r.tags || [],
      createdAt: Date.parse(r.created_at) || 0,
      convertedAt: r.converted_at ? Date.parse(r.converted_at) || undefined : undefined,
      convertedKind: r.converted_kind || undefined,
      convertedCardId: r.converted_card_id || undefined,
    }))
}

export async function convertCapture(id: string, kind: CaptureConvertedKind, cardId: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  await cloud.convertCapture(env, token, id, kind, cardId)
}

export async function dismissCapture(id: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  await cloud.dismissCapture(env, token, id)
}

export async function restoreCapture(id: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  await cloud.restoreCapture(env, token, id)
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
    link: meta.url || '',
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
