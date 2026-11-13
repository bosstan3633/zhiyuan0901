/**
 * 知源 · 云同步协调层（v4.0.1）
 * 手动上传/下载 + 启动检查；冲突必须用户确认。
 * 普通卡附件与 AI 凭据不进云；策展节点附件只把 Blob 放入用户私有 Storage。
 */
import type { AppData, UIPrefs, AssetMeta } from '@/shared/models'
import { mergeEventLogs, mergeImportedEventLog, type CardEvent } from '@/shared/utils/eventLog'
import { cloudEnv, cloud, type CloudEnv, setCloudEnvOverride } from './client'
import { K, LOCAL_KEYS } from '@/shared/storage/keys'
import { getAssetBlob } from '@/shared/storage/assets'
import { pruneReceiptActions } from './syncActions'
import { fallbackHash, stableStringify, syncRecordDigest } from './digest'
import {
  hasConflictChoices,
  mergeThreeWaySnapshots,
  type MergeChoices,
  type MergeConflict,
} from './threeWayMerge'

export { syncRecordDigest }

export interface CloudMeta {
  userId: string
  email: string
  refreshToken: string
  revision: number
  syncedFingerprint?: string
  /** 云同步范围协议；2 起只同步业务数据，界面偏好始终留在本机。 */
  syncScopeVersion?: number
  lastUploadAt?: number
  lastDownloadAt?: number
  lastCheckedAt?: number
  checkOnStart: boolean
  /** 策展节点附件默认静默上传；关闭后新附件只留本机。 */
  assetSyncEnabled?: boolean
  /** 上次成功同步时建立的轻量记录清单；不保存完整快照或附件 Blob。 */
  localManifest?: SyncManifest
  /** 最近读取的云端记录清单缓存。 */
  remoteManifest?: SyncManifest
  remoteManifestCachedAt?: number
  /** V4.1.3：最近 20 次真实同步的轻量回执；只存记录摘要与字段名，不存完整快照。 */
  syncReceipts?: CloudSyncReceipt[]
  /** V4.2.0：自动同步默认关闭，仅自动上传本机改动，不自动拉回云端。 */
  autoSyncEnabled?: boolean
  lastAutoAttemptAt?: number
  lastAutoSyncAt?: number
  nextAutoSyncAt?: number
  lastAutoResult?: 'uploaded' | 'latest' | 'blocked' | 'failed' | 'signed_out'
  lastAutoError?: string
}

export interface SnapshotState { data: AppData; ui: UIPrefs | null; eventLog: CardEvent[] }
export type SyncManifestRecordType =
  | 'workspace' | 'category' | 'resource' | 'task' | 'curiosity' | 'argument'
  | 'direction' | 'project' | 'metric' | 'dailyFocus' | 'supportLink'
  | 'curationProjection' | 'resourceFolder' | 'resourceFolderMirror'
  | 'tag' | 'activity' | 'stats' | 'fieldConfig'
  | 'attachment' | 'event' | 'preference'
export interface SyncManifestRecord {
  key: string
  type: SyncManifestRecordType
  id: string
  title: string
  updatedAt?: number
  deleted?: boolean
  digest: string
  /** 顶层业务字段的稳定指纹。用于回答“到底改了哪些字段”，不保存字段正文。 */
  fields?: Record<string, string>
  /** 少量可读事实；事件详情使用，不保存完整业务对象。 */
  meta?: Record<string, string | number | boolean>
}
export interface SyncManifestCounts {
  workspaces: number
  categories: number
  resources: number
  tasks: number
  curiosities: number
  arguments: number
  directions: number
  projects: number
  metrics: number
  dailyFocus: number
  supportLinks: number
  curationProjections: number
  resourceFolders: number
  resourceFolderMirrors: number
  tags: number
  activities: number
  events: number
  preferences: number
  businessTotal: number
  attachments: number
  pendingAttachments: number
  failedAttachments: number
}
export interface SyncManifest {
  revision: number
  fingerprint: string
  capturedAt: number
  records: SyncManifestRecord[]
  counts: SyncManifestCounts
}
export interface SyncManifestDiffRow {
  key: string
  type: SyncManifestRecordType
  id: string
  title: string
  status: 'added' | 'removed' | 'changed'
  updatedAt?: number
  deleted?: boolean
  digest?: string
  fields?: string[]
}
export interface SyncManifestDiff {
  local: SyncManifest | null
  remote: SyncManifest | null
  added: SyncManifestDiffRow[]
  removed: SyncManifestDiffRow[]
  changed: SyncManifestDiffRow[]
}

export type CloudSyncDirection = 'upload' | 'download' | 'latest' | 'merge'
export type CloudSyncTrigger = 'topbar' | 'settings' | 'auto' | 'shortcut'

/** 回执行沿用 manifest diff 的可读摘要；没有字段指纹时不会伪造字段名。 */
export type CloudSyncReceiptRow = SyncManifestDiffRow

export interface CloudSyncReceipt {
  id: string
  at: number
  direction: CloudSyncDirection
  trigger: CloudSyncTrigger
  fromRevision: number
  toRevision: number
  added: number
  changed: number
  removed: number
  rows: CloudSyncReceiptRow[]
}
export interface CloudMergeConflictInfo {
  mode: 'merge' | 'overwrite'
  conflicts: MergeConflict[]
  remoteRevision: number
  localRevision: number
}
export type CloudUploadDecision =
  | { action: 'upload' | 'download' | 'cancel' }
  | { action: 'merge'; choices: MergeChoices }
export type UploadNowResult =
  | {
    kind: 'uploaded'
    revision: number
    fingerprint: string
    manifest: SyncManifest
    beforeState: SnapshotState | null
    appliedState: SnapshotState
    merged: boolean
  }
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
  localManifest?: SyncManifest
  remoteManifest?: SyncManifest
  hasBaseline?: boolean
}

export interface CloudSyncBaseline {
  version: 1
  userId: string
  revision: number
  fingerprint: string
  capturedAt: number
  state: SnapshotState
}

const META_KEY = K.CLOUD_META
const LOCK_KEY = K.CLOUD_SYNC_LOCK
const BASELINE_KEY = K.CLOUD_SYNC_BASE
const REVISION_CONFLICT_MAX_RETRIES = 2
const CLOUD_SYNC_SCOPE_VERSION = 3

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

export async function getSyncBaseline(userId: string): Promise<CloudSyncBaseline | null> {
  if (!userId) return null
  try {
    const raw = (await chrome.storage.local.get([BASELINE_KEY]))[BASELINE_KEY] as CloudSyncBaseline | undefined
    if (!raw || raw.version !== 1 || raw.userId !== userId || !raw.state?.data) return null
    return raw
  } catch {
    return null
  }
}

export async function writeSyncBaseline(
  userId: string,
  state: SnapshotState,
  revision: number,
  fingerprint: string,
): Promise<void> {
  if (!userId) return
  const clean = sanitizeCloudSnapshot(state)
  const baseline: CloudSyncBaseline = {
    version: 1,
    userId,
    revision,
    fingerprint,
    capturedAt: Date.now(),
    state: clean,
  }
  await chrome.storage.local.set({ [BASELINE_KEY]: baseline })
}

export async function clearSyncBaseline(): Promise<void> {
  try { await chrome.storage.local.remove(BASELINE_KEY) } catch { /* noop */ }
}

export async function acquireCloudSyncLock(owner: string, leaseMs = 120_000): Promise<boolean> {
  try {
    const now = Date.now()
    const current = (await chrome.storage.local.get([LOCK_KEY]))[LOCK_KEY] as { owner?: string; expiresAt?: number } | undefined
    if (current?.owner && Number(current.expiresAt) > now) return false
    await chrome.storage.local.set({ [LOCK_KEY]: { owner, expiresAt: now + leaseMs } })
    const confirmed = (await chrome.storage.local.get([LOCK_KEY]))[LOCK_KEY] as { owner?: string } | undefined
    return confirmed?.owner === owner
  } catch {
    return true
  }
}

export async function releaseCloudSyncLock(owner: string): Promise<void> {
  try {
    const current = (await chrome.storage.local.get([LOCK_KEY]))[LOCK_KEY] as { owner?: string } | undefined
    if (current?.owner === owner) await chrome.storage.local.remove(LOCK_KEY)
  } catch { /* noop */ }
}

export async function setCheckOnStart(v: boolean): Promise<CloudMeta> {
  return writeMeta({ checkOnStart: v })
}

export async function setCurationAssetSyncEnabled(v: boolean): Promise<CloudMeta> {
  return writeMeta({ assetSyncEnabled: v })
}

export async function setAutoSyncEnabled(v: boolean): Promise<CloudMeta> {
  return writeMeta({
    autoSyncEnabled: v,
    nextAutoSyncAt: v ? Date.now() + 60 * 60_000 : undefined,
    ...(v ? {} : { lastAutoError: undefined }),
  })
}

export async function markAutoSyncResult(input: {
  result: NonNullable<CloudMeta['lastAutoResult']>
  at?: number
  error?: string
  nextAt?: number
}): Promise<CloudMeta> {
  const at = input.at || Date.now()
  return writeMeta({
    lastAutoAttemptAt: at,
    ...(input.result === 'uploaded' || input.result === 'latest' ? { lastAutoSyncAt: at } : {}),
    lastAutoResult: input.result,
    lastAutoError: input.error,
    nextAutoSyncAt: input.nextAt || at + 60 * 60_000,
  })
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
  for (const link of d.supportLinks || []) {
    if (!link.snapshot?.assets?.length) continue
    link.snapshot.assets = link.snapshot.assets.map(safeAsset)
  }
  for (const projection of d.curationProjections || []) {
    if (!projection.snapshot?.assets?.length) continue
    projection.snapshot.assets = projection.snapshot.assets.map(safeAsset)
  }
  for (const mirror of d.resourceFolderMirrors || []) {
    if (!mirror.snapshot?.assets?.length) continue
    mirror.snapshot.assets = mirror.snapshot.assets.map(safeAsset)
  }
  const safeUi = ui ? JSON.parse(JSON.stringify(ui)) as UIPrefs : null
  if (safeUi) {
    delete (safeUi as unknown as Record<string, unknown>).__cloud
    delete (safeUi as unknown as Record<string, unknown>).__wid
  }
  return { data: d, ui: safeUi, eventLog: [...eventLog] }
}

/**
 * 云快照只承载业务数据。主题、密度、排序筛选、页面布局、抽屉宽度等
 * UIPrefs 永远留在本机，不参与指纹、清单、回执或恢复。
 */
export function sanitizeCloudSnapshot(snapshot: SnapshotState): SnapshotState {
  const clean = sanitizeSnapshot(snapshot.data, null, snapshot.eventLog)
  return { data: clean.data, ui: null, eventLog: clean.eventLog }
}

const MANIFEST_FIELDS: Partial<Record<SyncManifestRecordType, readonly string[]>> = {
  resource: ['title', 'description', 'tags', 'linkType', 'link', 'linkSlots', 'workspaceId', 'categoryId', 'sourceType', 'pinned', 'starred', 'lifecycleArchived', 'customFields'],
  task: ['title', 'description', 'tags', 'projectId', 'metricId', 'status', 'priority', 'dueDate', 'estimatedMinutes', 'link', 'completedAt', 'subtasks', 'pinned', 'starred', 'customFields'],
  curiosity: ['question', 'description', 'tags', 'sourceUrl', 'sourceTitle', 'status', 'pinned', 'starred', 'customFields'],
  argument: ['title', 'content', 'workspaceId', 'order', 'linkedResourceIds', 'assets'],
  workspace: ['name', 'icon', 'color', 'coverTheme', 'desc', 'order', 'archived', 'kind', 'hidden'],
  category: ['workspaceId', 'name', 'parentId', 'order', 'icon', 'color', 'desc', 'assets'],
  direction: ['name', 'term', 'content', 'reason', 'order', 'calibratedAt', 'archivedAt', 'vision', 'mission'],
  project: ['name', 'goalId', 'status', 'endDate', 'nextStep', 'order', 'content'],
  metric: ['title', 'target', 'acceptance', 'taskIds', 'order'],
  supportLink: ['taskId', 'subId', 'resourceId', 'from', 'why', 'createdAt', 'snapshot'],
  curationProjection: ['kind', 'wsId', 'catId', 'cardId', 'targetWsId', 'targetCatId', 'curOrder', 'displayName', 'addedAt', 'snapshot'],
  resourceFolder: ['name', 'order', 'createdAt', 'updatedAt'],
  resourceFolderMirror: ['folderId', 'resourceId', 'order', 'addedAt', 'snapshot'],
  tag: ['name', 'definition'],
  activity: ['type', 'entityType', 'entityId', 'timestamp', 'detail'],
  stats: ['weekly', 'lastReuse', 'lastVisits', 'wrr'],
  fieldConfig: ['resource', 'task', 'curiosity', 'argument'],
  attachment: ['name', 'kind', 'size', 'mime', 'storagePath', 'checksum', 'uploadState', 'uploadedAt', 'lastError', 'retryCount'],
  event: ['ts', 'action', 'kind', 'title', 'cardId', 'deviceId', 'to'],
  preference: ['theme', 'layout', 'sortPrefs', 'cardCols', 'capturePref'],
  dailyFocus: [],
}

function fieldDigests(type: SyncManifestRecordType, raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const keys = MANIFEST_FIELDS[type] || []
  const out: Record<string, string> = {}
  for (const key of keys) {
    if (!(key in source)) continue
    const value = source[key]
    if (value === undefined) continue
    out[key] = fallbackHash(stableStringify(value))
  }
  return Object.keys(out).length ? out : undefined
}

function manifestRecord(
  type: SyncManifestRecordType,
  id: string,
  title: string,
  raw: unknown,
  updatedAt?: number,
  deleted?: boolean,
  meta?: Record<string, string | number | boolean>,
): SyncManifestRecord {
  const fields = fieldDigests(type, raw)
  return {
    key: `${type}:${id}`,
    type,
    id,
    title: String(title || '未命名').slice(0, 180),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
    deleted: deleted || undefined,
    digest: fallbackHash(stableStringify(raw)),
    ...(fields ? { fields } : {}),
    ...(meta ? { meta } : {}),
  }
}

/** 构建记录级同步明细：只保留摘要和稳定指纹，不保存第二份完整业务快照。 */
export function buildSyncManifest(snapshot: SnapshotState, revision: number, fingerprint = ''): SyncManifest {
  const clean = sanitizeCloudSnapshot(snapshot)
  const data = clean.data
  const records: SyncManifestRecord[] = []
  const counts: SyncManifestCounts = {
    workspaces: 0, categories: 0, resources: 0, tasks: 0, curiosities: 0, arguments: 0,
    directions: 0, projects: 0, metrics: 0, dailyFocus: 0, supportLinks: 0,
    curationProjections: 0, resourceFolders: 0, resourceFolderMirrors: 0,
    tags: 0, activities: 0, events: clean.eventLog.length,
    preferences: clean.ui ? 1 : 0, businessTotal: 0, attachments: 0,
    pendingAttachments: 0, failedAttachments: 0,
  }
  const add = (record: SyncManifestRecord) => records.push(record)
  const ownerLabel = (owner: { title?: string; name?: string; question?: string }) =>
    owner.title || owner.name || owner.question || '未命名记录'
  const collectAssets = (owners: Array<{
    id?: string
    title?: string
    name?: string
    question?: string
    assets?: AssetMeta[]
  }>) => {
    for (const owner of owners) {
      for (const asset of owner.assets || []) {
        counts.attachments += 1
        if (asset.uploadState === 'pending' || asset.uploadState === 'local') counts.pendingAttachments += 1
        if (asset.uploadState === 'failed') counts.failedAttachments += 1
        add(manifestRecord(
          'attachment',
          asset.id,
          `${ownerLabel(owner)} · ${asset.name}`,
          asset,
          asset.uploadedAt || asset.createdAt,
          false,
          {
            ownerId: owner.id || '',
            ownerTitle: ownerLabel(owner).slice(0, 120),
            uploadState: asset.uploadState || 'local',
          },
        ))
      }
    }
  }

  for (const workspace of data.workspaces || []) {
    counts.workspaces += 1
    add(manifestRecord('workspace', workspace.id, workspace.name, workspace, workspace.lastCalledAt))
  }
  for (const category of data.categories || []) {
    counts.categories += 1
    add(manifestRecord('category', category.id, category.name, category, undefined, !!category.deletedAt))
  }
  for (const card of data.resources || []) {
    counts.resources += 1
    add(manifestRecord('resource', card.id, card.title, card, card.updatedAt, !!card.deletedAt))
  }
  for (const card of data.tasks || []) {
    counts.tasks += 1
    add(manifestRecord('task', card.id, card.title, card, card.updatedAt, !!card.deletedAt))
  }
  for (const card of data.curiosities || []) {
    counts.curiosities += 1
    add(manifestRecord('curiosity', card.id, card.question, card, card.updatedAt, !!card.deletedAt))
  }
  for (const card of data.argCards || []) {
    counts.arguments += 1
    add(manifestRecord('argument', card.id, card.title, card, card.updatedAt, !!card.deletedAt))
  }
  for (const direction of data.compass?.directions || []) {
    counts.directions += 1
    add(manifestRecord('direction', direction.id, direction.name, direction, direction.calibratedAt))
    for (const project of direction.projects || []) {
      counts.projects += 1
      add(manifestRecord('project', project.id, project.name, project, undefined, project.status === 'archived'))
      for (const metric of project.metrics || []) {
        counts.metrics += 1
        add(manifestRecord('metric', metric.id, metric.title, metric))
      }
    }
  }
  for (const [date, slots] of Object.entries(data.dailyFocus || {})) {
    counts.dailyFocus += 1
    add(manifestRecord('dailyFocus', date, `今日三件事 · ${date}`, slots))
  }
  for (const link of data.supportLinks || []) {
    counts.supportLinks += 1
    add(manifestRecord('supportLink', link.id, '任务 → 资源关联', link, link.createdAt))
  }
  for (const projection of data.curationProjections || []) {
    counts.curationProjections += 1
    add(manifestRecord(
      'curationProjection',
      projection.id,
      `策展节点 → 资源 · ${projection.cardId || projection.catId || projection.wsId}`,
      projection,
      projection.addedAt,
    ))
  }
  const folderNames = new Map<string, string>()
  for (const folder of data.resourceFolders || []) {
    counts.resourceFolders += 1
    folderNames.set(folder.id, folder.name)
    add(manifestRecord('resourceFolder', folder.id, folder.name, folder, folder.updatedAt))
  }
  const resourcesById = new Map((data.resources || []).map(resource => [resource.id, resource]))
  for (const mirror of data.resourceFolderMirrors || []) {
    counts.resourceFolderMirrors += 1
    const folderName = folderNames.get(mirror.folderId) || '常用夹'
    const cardTitle = mirror.snapshot?.title || resourcesById.get(mirror.resourceId)?.title || mirror.resourceId
    add(manifestRecord(
      'resourceFolderMirror',
      mirror.id,
      `${folderName} → ${cardTitle}`,
      mirror,
      mirror.addedAt,
    ))
  }
  const collectTags = (tags: typeof data.tagTree) => {
    for (const tag of tags || []) {
      counts.tags += 1
      add(manifestRecord('tag', tag.id, tag.name, tag))
      collectTags(tag.children || [])
    }
  }
  collectTags(data.tagTree || [])
  for (const activity of data.activityLogs || []) {
    counts.activities += 1
    add(manifestRecord('activity', activity.id, activity.detail || activity.type, activity, activity.timestamp))
  }
  add(manifestRecord('stats', 'stats', '使用统计', data.stats))
  add(manifestRecord('fieldConfig', 'fields', '卡片字段配置', data.fieldConfig))
  if (data.compass) {
    add(manifestRecord('direction', 'compass-mission', '愿景与使命', data.compass, data.compass.vision?.updatedAt))
  }
  clean.eventLog.forEach((event, index) => {
    add(manifestRecord(
      'event',
      event.id || `${event.ts}-${index}`,
      `${event.title || event.cardId} · ${event.action}`,
      event,
      event.ts,
      false,
      {
        action: event.action,
        cardKind: event.kind,
        cardId: event.cardId || '',
        deviceId: event.deviceId || 'legacy',
        ...(event.to ? { to: event.to } : {}),
      },
    ))
  })
  if (clean.ui) add(manifestRecord('preference', 'ui', '界面与偏好', clean.ui))

  collectAssets(data.resources || [])
  collectAssets(data.categories || [])
  collectAssets(data.tasks || [])
  collectAssets(data.curiosities || [])
  collectAssets(data.argCards || [])
  counts.businessTotal = counts.workspaces + counts.categories + counts.resources + counts.tasks
    + counts.curiosities + counts.arguments + counts.directions + counts.projects + counts.metrics
    + counts.dailyFocus + counts.supportLinks + counts.curationProjections
    + counts.resourceFolders + counts.resourceFolderMirrors + counts.tags
    + counts.activities

  return {
    revision,
    fingerprint: fingerprint || fallbackHash(stableStringify(clean)),
    capturedAt: Date.now(),
    records,
    counts,
  }
}

export function diffSyncManifests(local: SyncManifest | null, remote: SyncManifest | null): SyncManifestDiff {
  const localByKey = new Map((local?.records || []).map(row => [row.key, row]))
  const remoteByKey = new Map((remote?.records || []).map(row => [row.key, row]))
  const added: SyncManifestDiffRow[] = []
  const removed: SyncManifestDiffRow[] = []
  const changed: SyncManifestDiffRow[] = []
  for (const [key, row] of remoteByKey) {
    const before = localByKey.get(key)
    if (!before) {
      added.push({
        key, type: row.type, id: row.id, title: row.title, status: 'added',
        updatedAt: row.updatedAt, deleted: row.deleted, digest: row.digest,
      })
    } else if (before.digest !== row.digest) {
      const beforeFields = before.fields || {}
      const afterFields = row.fields || {}
      const fields = [...new Set([...Object.keys(beforeFields), ...Object.keys(afterFields)])]
        .filter(field => beforeFields[field] !== afterFields[field])
        .sort()
      changed.push({
        key, type: row.type, id: row.id, title: row.title, status: 'changed',
        updatedAt: row.updatedAt, deleted: row.deleted, digest: row.digest,
        ...(fields.length ? { fields } : {}),
      })
    }
  }
  for (const [key, row] of localByKey) {
    if (!remoteByKey.has(key)) {
      removed.push({
        key, type: row.type, id: row.id, title: row.title, status: 'removed',
        updatedAt: row.updatedAt, deleted: row.deleted, digest: row.digest,
      })
    }
  }
  return { local, remote, added, removed, changed }
}

/** 统一的界面消费顺序：新增、修改、删除；组件再按时间排序。 */
export function syncDiffRows(diff: SyncManifestDiff): SyncManifestDiffRow[] {
  return [...diff.added, ...diff.changed, ...diff.removed]
}

const RECEIPT_ID_PREFIX = 'sync'

export function buildSyncReceipt(input: {
  before: SyncManifest | null
  after: SyncManifest | null
  direction: CloudSyncDirection
  trigger: CloudSyncTrigger
  fromRevision: number
  toRevision: number
}): CloudSyncReceipt {
  const diff = diffSyncManifests(input.before, input.after)
  const rows: CloudSyncReceiptRow[] = [...diff.added, ...diff.changed, ...diff.removed]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || a.key.localeCompare(b.key))
  return {
    id: `${RECEIPT_ID_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    direction: input.direction,
    trigger: input.trigger,
    fromRevision: input.fromRevision,
    toRevision: input.toRevision,
    added: diff.added.length,
    changed: diff.changed.length,
    removed: diff.removed.length,
    rows,
  }
}

/** 同步回执只保留最近 20 条且最长 30 天；去重按 id，最新在前。 */
export async function appendSyncReceipt(receipt: CloudSyncReceipt): Promise<CloudMeta> {
  const current = await readMeta()
  const oldest = Date.now() - 30 * 24 * 60 * 60 * 1000
  const rows = [receipt, ...(current?.syncReceipts || [])]
    .filter((row, index, all) => all.findIndex(item => item.id === row.id) === index)
    .filter(row => row.at >= oldest)
    .slice(0, 20)
  const next = await writeMeta({ syncReceipts: rows })
  await pruneReceiptActions(rows)
  return next
}

/** 对干净快照做内容指纹；只排除附件本体/凭据等不进云内容，不依赖 revision。 */
export async function fingerprintSnapshot(snapshot: SnapshotState): Promise<string> {
  const clean = sanitizeCloudSnapshot(snapshot)
  // 事件是账号级旁路真源，不应让不同设备的本地事件窗口制造业务数据冲突。
  const input = stableStringify(clean.data)
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

const ACCOUNT_EVENT_EPOCH = '1970-01-01T00:00:00.000Z'

function readAccountEventCursors(): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_KEYS.ACCOUNT_EVENT_CURSOR)
    const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    return parsed && typeof parsed === 'object' ? Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
    ) as Record<string, string> : {}
  } catch {
    return {}
  }
}

function accountEventCursor(userId: string): string {
  return readAccountEventCursors()[userId] || ACCOUNT_EVENT_EPOCH
}

function writeAccountEventCursor(userId: string, cursor: string): void {
  try {
    const rows = readAccountEventCursors()
    rows[userId] = cursor
    globalThis.localStorage?.setItem(LOCAL_KEYS.ACCOUNT_EVENT_CURSOR, JSON.stringify(rows))
  } catch { /* 游标失败只会导致下次重叠读取，按事件 ID 去重仍安全 */ }
}

function accountEventRow(event: CardEvent) {
  return {
    id: event.id,
    device_id: event.deviceId || 'legacy',
    event_ts: new Date(event.ts || Date.now()).toISOString(),
    action: event.action,
    card_kind: event.kind,
    card_id: event.cardId || null,
    title_snapshot: (event.title || '').slice(0, 500),
    to_state: event.to || null,
    payload: event.to ? { to: event.to } : {},
  }
}

/**
 * 账号级事件收敛：
 * 1. 本机事件按全局 ID 幂等上传；
 * 2. 从账号游标补拉其他设备事件；
 * 3. 返回本地 + 远端并集。
 * 事件表尚未迁移时回退 snapshot 内事件，绝不让主数据同步整体失败。
 */
export async function reconcileAccountEvents(localEvents: CardEvent[]): Promise<CardEvent[]> {
  const fallback = mergeEventLogs(localEvents)
  try {
    const env = await cloudEnv()
    const meta = await readMeta()
    if (!env || !meta?.refreshToken) return fallback
    const token = await accessToken(env, meta)
    if (localEvents.length) {
      await cloud.upsertAccountEvents(env, token, meta.userId, localEvents.map(accountEventRow))
    }
    const remote: CardEvent[] = []
    const cursor = accountEventCursor(meta.userId)
    let offset = 0
    let maxCreatedAt = cursor
    const PAGE_SIZE = 1000
    while (true) {
      const rows = await cloud.listAccountEvents(env, token, cursor, offset, PAGE_SIZE)
      if (!rows.length) break
      for (const row of rows) {
        remote.push({
          id: row.id,
          ts: Date.parse(row.event_ts) || Date.now(),
          action: row.action,
          kind: row.card_kind,
          title: row.title_snapshot || '（无标题）',
          cardId: row.card_id || '',
          ...(row.to_state ? { to: row.to_state } : {}),
          deviceId: row.device_id || 'legacy',
        })
        if (row.created_at > maxCreatedAt) maxCreatedAt = row.created_at
      }
      if (rows.length < PAGE_SIZE) break
      offset += rows.length
    }
    if (maxCreatedAt !== cursor) writeAccountEventCursor(meta.userId, maxCreatedAt)
    const merged = mergeEventLogs(localEvents, remote)
    await mergeImportedEventLog(merged)
    return merged
  } catch {
    return fallback
  }
}

export async function login(email: string, password: string): Promise<CloudMeta> {
  const env = await cloudEnv()
  if (!env) throw new Error('云端未配置')
  const r = await cloud.login(env, email.trim(), password)
  const previous = await readMeta()
  if (previous?.userId && previous.userId !== r.user.id) await clearSyncBaseline()
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
  await clearSyncBaseline()
  try {
    // 退出只结束账号会话；自动同步偏好保留，重新登录后可继续使用。
    if (meta?.autoSyncEnabled) {
      await chrome.storage.local.set({
        [META_KEY]: {
          userId: '',
          email: '',
          refreshToken: '',
          revision: 0,
          checkOnStart: true,
          autoSyncEnabled: true,
          nextAutoSyncAt: undefined,
          lastAutoResult: 'signed_out',
          lastAutoError: '账号已退出，自动同步已暂停',
        },
      })
    } else {
      await chrome?.storage?.local?.remove([META_KEY])
    }
  } catch { /* noop */ }
}

/** 比较本机、上次成功同步基线与云端三份干净快照。 */
export async function checkRemote(localSnapshot: SnapshotState): Promise<CloudCheckResult> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) return { kind: 'idle', relation: 'idle', remoteRevision: 0 }
  const localFingerprint = await fingerprintSnapshot(localSnapshot)
  const baselineState = await getSyncBaseline(meta.userId)
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
  const accountEvents = await reconcileAccountEvents(mergeEventLogs(localSnapshot.eventLog, remoteState.eventLog || []))
  const localManifest = buildSyncManifest({ ...localSnapshot, eventLog: accountEvents }, meta.revision || 0, localFingerprint)
  const remoteManifest = buildSyncManifest({
    data: remoteState.data,
    ui: remoteState.ui || null,
    eventLog: accountEvents,
  }, rem.revision, remoteFingerprint)
  // 只有完整读取并验证成功后才记录检查时间，格式异常不能留下“已检查”的假信号。
  await writeMeta({ lastCheckedAt: Date.now(), remoteManifest, remoteManifestCachedAt: Date.now() })
  const baseline = meta.syncedFingerprint
  let relation: CloudRelation
  const scopeCurrent = meta.syncScopeVersion === CLOUD_SYNC_SCOPE_VERSION
  if (localFingerprint === remoteFingerprint) {
    relation = 'in_sync'
    // 升级后首次检查若两端内容一致，直接建立基线，不必让用户做一次无意义的选择。
    if (baseline !== localFingerprint || meta.revision !== rem.revision || !meta.localManifest || !scopeCurrent) {
      await writeMeta({
        syncedFingerprint: localFingerprint,
        syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION,
        revision: rem.revision,
        localManifest,
        remoteManifest,
        remoteManifestCachedAt: Date.now(),
      })
    }
    await writeSyncBaseline(
      meta.userId,
      { data: remoteState.data, ui: null, eventLog: accountEvents },
      rem.revision,
      remoteFingerprint,
    )
  } else if (!baseline) relation = 'unknown'
  else if (!scopeCurrent) relation = 'both_changed'
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
    localManifest,
    remoteManifest,
    hasBaseline: !!baselineState,
  }
}

export async function uploadNow(
  snap: SnapshotState,
  onConflict: (info: CloudMergeConflictInfo) => Promise<CloudUploadDecision>,
  approvedRemoteRevision?: number,
  options: { strategy?: 'merge' | 'local' } = {},
): Promise<UploadNowResult> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  const clean = sanitizeCloudSnapshot(snap)
  const localRevision = meta.revision || 0
  let initialApproval = approvedRemoteRevision
  let forceLocal = options.strategy === 'local'

  // 先补传本机离线事件并拉回账号已有事件；事件表异常时自动退回 snapshot 内事件。
  clean.eventLog = await reconcileAccountEvents(clean.eventLog)

  for (let attempt = 0; attempt <= REVISION_CONFLICT_MAX_RETRIES; attempt += 1) {
    const rows = await cloud.getSnapshot(env, token, meta.userId)
    const remote = rows[0]
    if (!remote) {
      const ins = await cloud.insertSnapshot(env, token, meta.userId, clean)
      const rev = ins[0]?.revision ?? 1
      const fingerprint = await fingerprintSnapshot(clean)
      const manifest = buildSyncManifest(clean, rev, fingerprint)
      await writeMeta({
        revision: rev,
        syncedFingerprint: fingerprint,
        syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION,
        lastUploadAt: Date.now(),
        localManifest: manifest,
        remoteManifest: manifest,
        remoteManifestCachedAt: Date.now(),
      })
      await writeSyncBaseline(meta.userId, clean, rev, fingerprint)
      return {
        kind: 'uploaded',
        revision: rev,
        fingerprint,
        manifest,
        beforeState: null,
        appliedState: clean,
        merged: false,
      }
    }

    const remoteState = remote.state as SnapshotState | null
    const beforeState = remoteState?.data?.version === 2
      ? sanitizeCloudSnapshot({
        data: remoteState.data,
        ui: remoteState.ui || null,
        eventLog: remoteState.eventLog || [],
      })
      : null
    if (!beforeState) throw new Error('云端快照格式不兼容')
    if (remoteState?.eventLog?.length) {
      clean.eventLog = await reconcileAccountEvents(mergeEventLogs(clean.eventLog, remoteState.eventLog))
    }

    const baseline = await getSyncBaseline(meta.userId)
    const localState: SnapshotState = { data: clean.data, ui: null, eventLog: clean.eventLog }
    let candidate = localState
    let merged = false

    if (!forceLocal) {
      if (
        baseline
        && stableStringify(localState.data) === stableStringify(baseline.state.data)
        && stableStringify(beforeState.data) !== stableStringify(baseline.state.data)
      ) {
        return { kind: 'download_requested', remoteRevision: remote.revision }
      }
      const preview = mergeThreeWaySnapshots(baseline?.state || null, localState, beforeState)
      if (preview.conflicts.length) {
        const decision = await onConflict({
          mode: 'merge',
          conflicts: preview.conflicts,
          remoteRevision: remote.revision,
          localRevision: baseline?.revision || localRevision,
        })
        if (decision.action === 'cancel') return { kind: 'cancelled', remoteRevision: remote.revision }
        if (decision.action === 'download') return { kind: 'download_requested', remoteRevision: remote.revision }
        if (decision.action === 'upload') {
          forceLocal = true
          candidate = localState
        } else if (decision.action === 'merge') {
          const resolved = mergeThreeWaySnapshots(baseline?.state || null, localState, beforeState, decision.choices)
          if (hasConflictChoices(resolved.conflicts, decision.choices)) {
            throw new Error('仍有同步冲突未选择处理方式，请重新检查后再同步')
          }
          candidate = resolved.state
          merged = true
        } else {
          throw new Error('同步冲突选择无效，请重新发起同步')
        }
      } else {
        candidate = preview.state
        const localChanged = !baseline || stableStringify(localState.data) !== stableStringify(baseline.state.data)
        const remoteChanged = !baseline || stableStringify(beforeState.data) !== stableStringify(baseline.state.data)
        merged = localChanged && remoteChanged
      }
    } else {
      const canUseInitialApproval = attempt === 0 && initialApproval === remote.revision
      if ((remote.revision !== localRevision || attempt > 0) && !canUseInitialApproval) {
        const decision = await onConflict({
          mode: 'overwrite',
          conflicts: [],
          remoteRevision: remote.revision,
          localRevision,
        })
        if (decision.action === 'cancel') return { kind: 'cancelled', remoteRevision: remote.revision }
        if (decision.action === 'download') return { kind: 'download_requested', remoteRevision: remote.revision }
        if (decision.action === 'merge') {
          throw new Error('当前是整端覆盖操作，不能提交字段级合并选择')
        }
      }
    }
    initialApproval = undefined

    candidate = sanitizeCloudSnapshot(candidate)
    candidate.eventLog = await reconcileAccountEvents(mergeEventLogs(candidate.eventLog, remoteState?.eventLog || []))
    candidate = { data: candidate.data, ui: null, eventLog: candidate.eventLog }
    const fingerprint = await fingerprintSnapshot(candidate)

    if (stableStringify(candidate.data) === stableStringify(beforeState.data)) {
      const remoteFingerprint = await fingerprintSnapshot(beforeState)
      const manifest = buildSyncManifest(beforeState, remote.revision, remoteFingerprint)
      await writeMeta({
        revision: remote.revision,
        syncedFingerprint: remoteFingerprint,
        syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION,
        lastUploadAt: Date.now(),
        localManifest: manifest,
        remoteManifest: manifest,
        remoteManifestCachedAt: Date.now(),
      })
      await writeSyncBaseline(meta.userId, beforeState, remote.revision, remoteFingerprint)
      return {
        kind: 'uploaded',
        revision: remote.revision,
        fingerprint: remoteFingerprint,
        manifest,
        beforeState,
        appliedState: beforeState,
        merged,
      }
    }

    const upd = await cloud.updateSnapshot(env, token, meta.userId, remote.revision, candidate)
    if (upd.length) {
      const rev = upd[0].revision
      const manifest = buildSyncManifest(candidate, rev, fingerprint)
      await writeMeta({
        revision: rev,
        syncedFingerprint: fingerprint,
        syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION,
        lastUploadAt: Date.now(),
        localManifest: manifest,
        remoteManifest: manifest,
        remoteManifestCachedAt: Date.now(),
      })
      await writeSyncBaseline(meta.userId, candidate, rev, fingerprint)
      return {
        kind: 'uploaded',
        revision: rev,
        fingerprint,
        manifest,
        beforeState,
        appliedState: candidate,
        merged,
      }
    }
  }

  throw new Error('上传冲突：云端连续更新，已停止自动重试，请重新检查后再同步')
}

export async function downloadNow(): Promise<{ state: SnapshotState; revision: number; fingerprint: string; manifest: SyncManifest }> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  const rows = await cloud.getSnapshot(env, token, meta.userId)
  if (!rows.length) throw new Error('云端暂无快照')
  const st = (rows[0].state as SnapshotState) || null
  if (!st || !st.data || st.data.version !== 2) throw new Error('云端快照格式不兼容')
  // 旧云快照可能仍带 Airtable 凭据/映射或本机写锁；恢复到本机前走与上传同一条脱敏边界。
  const safe = sanitizeCloudSnapshot({
    data: st.data,
    ui: st.ui || null,
    eventLog: st.eventLog || [],
  })
  const localEventLog = await import('@/shared/utils/eventLog').then(module => module.readEventLog())
  safe.eventLog = await reconcileAccountEvents(mergeEventLogs(localEventLog, safe.eventLog))
  const fingerprint = await fingerprintSnapshot(safe)
  return {
    state: safe,
    revision: rows[0].revision,
    fingerprint,
    manifest: buildSyncManifest(safe, rows[0].revision, fingerprint),
  }
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

export async function markDownloaded(
  revision: number,
  fingerprint: string,
  manifest?: SyncManifest,
  state?: SnapshotState,
): Promise<void> {
  await writeMeta({
    revision,
    syncedFingerprint: fingerprint,
    syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION,
    lastDownloadAt: Date.now(),
    localManifest: manifest,
    remoteManifest: manifest,
    remoteManifestCachedAt: manifest ? Date.now() : undefined,
  })
  const meta = await readMeta()
  if (meta?.userId && state) await writeSyncBaseline(meta.userId, state, revision, fingerprint)
}
