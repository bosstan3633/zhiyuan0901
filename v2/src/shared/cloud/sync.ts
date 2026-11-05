/**
 * 知源 · 云同步协调层（v4.0.1）
 * 手动上传/下载 + 启动检查；冲突必须用户确认。
 * 普通卡附件与 AI 凭据不进云；策展节点附件只把 Blob 放入用户私有 Storage。
 */
import type { AppData, UIPrefs, AssetMeta } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { mergeEventLogs, mergeImportedEventLog, type CardEvent } from '@/shared/utils/eventLog'
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
  /** 上次成功同步时建立的轻量记录清单；不保存完整快照或附件 Blob。 */
  localManifest?: SyncManifest
  /** 最近读取的云端记录清单缓存。 */
  remoteManifest?: SyncManifest
  remoteManifestCachedAt?: number
  /** V4.1.3：最近 20 次真实同步的轻量回执；只存记录摘要与字段名，不存完整快照。 */
  syncReceipts?: CloudSyncReceipt[]
}

export interface SnapshotState { data: AppData; ui: UIPrefs | null; eventLog: CardEvent[] }
export type SyncManifestRecordType =
  | 'workspace' | 'category' | 'resource' | 'task' | 'curiosity' | 'argument'
  | 'direction' | 'project' | 'metric' | 'dailyFocus' | 'supportLink'
  | 'curationProjection' | 'tag' | 'activity' | 'stats' | 'fieldConfig'
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

export type CloudSyncDirection = 'upload' | 'download' | 'latest'
export type CloudSyncTrigger = 'topbar' | 'settings'

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
export type CloudUploadDecision = 'upload' | 'download' | 'cancel'
export type UploadNowResult =
  | { kind: 'uploaded'; revision: number; fingerprint: string; manifest: SyncManifest }
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
  supportLink: ['taskId', 'subId', 'resourceId', 'from', 'why', 'createdAt'],
  curationProjection: ['kind', 'wsId', 'catId', 'cardId', 'targetWsId', 'targetCatId', 'curOrder', 'displayName', 'addedAt'],
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
  const clean = sanitizeSnapshot(snapshot.data, snapshot.ui, snapshot.eventLog)
  const data = clean.data
  const records: SyncManifestRecord[] = []
  const counts: SyncManifestCounts = {
    workspaces: 0, categories: 0, resources: 0, tasks: 0, curiosities: 0, arguments: 0,
    directions: 0, projects: 0, metrics: 0, dailyFocus: 0, supportLinks: 0,
    curationProjections: 0, tags: 0, activities: 0, events: clean.eventLog.length,
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
    + counts.dailyFocus + counts.supportLinks + counts.curationProjections + counts.tags
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

/** 同步回执只保留最近 20 条；去重按 id，最新在前。 */
export async function appendSyncReceipt(receipt: CloudSyncReceipt): Promise<CloudMeta> {
  const current = await readMeta()
  const rows = [receipt, ...(current?.syncReceipts || [])]
    .filter((row, index, all) => all.findIndex(item => item.id === row.id) === index)
    .slice(0, 20)
  return writeMeta({ syncReceipts: rows })
}

/** 对干净快照做内容指纹；只排除附件本体/凭据等不进云内容，不依赖 revision。 */
export async function fingerprintSnapshot(snapshot: SnapshotState): Promise<string> {
  const clean = sanitizeSnapshot(snapshot.data, snapshot.ui, snapshot.eventLog)
  // 事件是账号级旁路真源，不应让不同设备的本地事件窗口制造业务数据冲突。
  const input = stableStringify({ data: clean.data, ui: clean.ui })
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
  if (localFingerprint === remoteFingerprint) {
    relation = 'in_sync'
    // 升级后首次检查若两端内容一致，直接建立基线，不必让用户做一次无意义的选择。
    if (!baseline || meta.revision !== rem.revision || !meta.localManifest) {
      await writeMeta({
        syncedFingerprint: localFingerprint,
        revision: rem.revision,
        localManifest,
        remoteManifest,
        remoteManifestCachedAt: Date.now(),
      })
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
    localManifest,
    remoteManifest,
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

  // 先补传本机离线事件并拉回账号已有事件；事件表异常时自动退回 snapshot 内事件。
  clean.eventLog = await reconcileAccountEvents(clean.eventLog)

  for (let attempt = 0; attempt <= REVISION_CONFLICT_MAX_RETRIES; attempt += 1) {
    const rows = await cloud.getSnapshot(env, token, meta.userId)
    const remote = rows[0]
    if (!remote) {
      const ins = await cloud.insertSnapshot(env, token, meta.userId, clean)
      const rev = ins[0]?.revision ?? 1
      const manifest = buildSyncManifest(clean, rev, fingerprint)
      await writeMeta({
        revision: rev,
        syncedFingerprint: fingerprint,
        lastUploadAt: Date.now(),
        localManifest: manifest,
        remoteManifest: manifest,
        remoteManifestCachedAt: Date.now(),
      })
      return { kind: 'uploaded', revision: rev, fingerprint, manifest }
    }

    const remoteState = remote.state as SnapshotState | null
    if (remoteState?.eventLog?.length) {
      clean.eventLog = await reconcileAccountEvents(mergeEventLogs(clean.eventLog, remoteState.eventLog))
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
      const manifest = buildSyncManifest(clean, rev, fingerprint)
      await writeMeta({
        revision: rev,
        syncedFingerprint: fingerprint,
        lastUploadAt: Date.now(),
        localManifest: manifest,
        remoteManifest: manifest,
        remoteManifestCachedAt: Date.now(),
      })
      return { kind: 'uploaded', revision: rev, fingerprint, manifest }
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
  const safe = sanitizeSnapshot(st.data, st.ui || null, st.eventLog || [])
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

export async function markDownloaded(revision: number, fingerprint: string, manifest?: SyncManifest): Promise<void> {
  await writeMeta({
    revision,
    syncedFingerprint: fingerprint,
    lastDownloadAt: Date.now(),
    localManifest: manifest,
    remoteManifest: manifest,
    remoteManifestCachedAt: manifest ? Date.now() : undefined,
  })
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

export async function dismissCaptures(ids: string[]): Promise<void> {
  if (!ids.length) return
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  await cloud.dismissCaptures(env, token, ids)
}

export async function restoreCapture(id: string): Promise<void> {
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  await cloud.restoreCapture(env, token, id)
}

export async function restoreCaptures(ids: string[]): Promise<void> {
  if (!ids.length) return
  const env = await cloudEnv(); const meta = await readMeta()
  if (!env || !meta?.refreshToken) throw new Error('请先登录云端')
  const token = await accessToken(env, meta)
  await cloud.restoreCaptures(env, token, ids)
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
