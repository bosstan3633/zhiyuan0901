import { CURATION_WS_ID, type AppData } from '@/shared/models'
import { K } from '@/shared/storage/keys'
import type {
  CloudSyncReceipt,
  CloudSyncReceiptRow,
  SnapshotState,
  SyncManifestRecordType,
} from './sync'
import { syncRecordDigest } from './digest'

export type CloudSyncActionOperation = 'delete' | 'restore' | 'rollback' | 'readonly'
export type CloudSyncActionStatus = 'available' | 'deleted' | 'restored' | 'rolled_back' | 'conflict' | 'expired' | 'readonly'

export interface CloudSyncReceiptAction {
  receiptId: string
  key: string
  type: SyncManifestRecordType
  id: string
  operation: CloudSyncActionOperation
  status: CloudSyncActionStatus
  before?: unknown
  after?: unknown
  beforeDigest?: string
  afterDigest?: string
  storedAt: number
  expiresAt: number
  lastActionAt?: number
  lastError?: string
}

interface ActionStore {
  version: 1
  actions: CloudSyncReceiptAction[]
}

const ACTION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SUPPORTED_TYPES = new Set<SyncManifestRecordType>([
  'workspace',
  'category',
  'resource',
  'task',
  'curiosity',
  'argument',
  'direction',
  'project',
  'metric',
  'dailyFocus',
  'supportLink',
  'curationProjection',
  'tag',
])

function emptyStore(): ActionStore {
  return { version: 1, actions: [] }
}

function cloneValue<T>(value: T | null | undefined): T | null {
  // 同步回执行天然可能面对“记录只在同步前/后一端存在”的情况。
  // undefined 经过 stringify 会直接得到 undefined，旧实现再 parse 就抛
  // `"undefined" is not valid JSON`，把已经成功的云端上传误判为失败。
  if (value === null || value === undefined) return null
  return JSON.parse(JSON.stringify(value)) as T
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function deletedOf(value: unknown): boolean {
  return isObject(value) && (typeof value.deletedAt === 'number' || value.archived === true)
}

function objectOf(data: AppData, type: SyncManifestRecordType, id: string): unknown {
  const byId = (rows: Array<{ id?: string }> | undefined) =>
    (rows || []).find(row => row.id === id)
  switch (type) {
    case 'workspace': return byId(data.workspaces)
    case 'category': return byId(data.categories)
    case 'resource': return byId(data.resources)
    case 'task': return byId(data.tasks)
    case 'curiosity': return byId(data.curiosities)
    case 'argument': return byId(data.argCards)
    case 'supportLink': return byId(data.supportLinks)
    case 'curationProjection': return byId(data.curationProjections)
    case 'dailyFocus': return data.dailyFocus?.[id]
    case 'direction': {
      if (id === 'compass-mission') return data.compass
      return byId(data.compass?.directions)
    }
    case 'project': {
      for (const direction of data.compass?.directions || []) {
        const hit = byId(direction.projects)
        if (hit) return hit
      }
      return null
    }
    case 'metric': {
      for (const direction of data.compass?.directions || []) {
        for (const project of direction.projects || []) {
          const hit = byId(project.metrics)
          if (hit) return hit
        }
      }
      return null
    }
    case 'tag': {
      const visit = (rows: typeof data.tagTree): unknown => {
        for (const row of rows || []) {
          if (row.id === id) return row
          const hit = visit(row.children || [])
          if (hit) return hit
        }
        return null
      }
      return visit(data.tagTree)
    }
    default:
      return null
  }
}

interface MutableLocation {
  get: () => unknown
  set: (value: unknown) => boolean
  remove: () => boolean
}

function arrayLocation(rows: Array<Record<string, unknown>> | undefined, id: string): MutableLocation | null {
  if (!Array.isArray(rows)) return null
  const index = rows.findIndex(row => row?.id === id)
  return {
    get: () => index >= 0 ? rows[index] : null,
    set: value => {
      if (!isObject(value)) return false
      if (index >= 0) rows[index] = value
      else rows.push(value)
      return true
    },
    remove: () => {
      if (index < 0) return false
      rows.splice(index, 1)
      return true
    },
  }
}

function locationOf(data: AppData, type: SyncManifestRecordType, id: string): MutableLocation | null {
  switch (type) {
    case 'workspace': return arrayLocation(data.workspaces as unknown as Array<Record<string, unknown>>, id)
    case 'category': return arrayLocation(data.categories as unknown as Array<Record<string, unknown>>, id)
    case 'resource': return arrayLocation(data.resources as unknown as Array<Record<string, unknown>>, id)
    case 'task': return arrayLocation(data.tasks as unknown as Array<Record<string, unknown>>, id)
    case 'curiosity': return arrayLocation(data.curiosities as unknown as Array<Record<string, unknown>>, id)
    case 'argument': return arrayLocation(data.argCards as unknown as Array<Record<string, unknown>>, id)
    case 'supportLink': return arrayLocation(data.supportLinks as unknown as Array<Record<string, unknown>>, id)
    case 'curationProjection': return arrayLocation(data.curationProjections as unknown as Array<Record<string, unknown>>, id)
    case 'direction': {
      if (!data.compass) return null
      if (id === 'compass-mission') {
        return {
          get: () => data.compass,
          set: value => {
            if (!isObject(value)) return false
            data.compass = value as unknown as AppData['compass']
            return true
          },
          remove: () => false,
        }
      }
      if (!data.compass.directions) data.compass.directions = []
      return arrayLocation(data.compass.directions as unknown as Array<Record<string, unknown>>, id)
    }
    case 'project': {
      for (const direction of data.compass?.directions || []) {
        const location = arrayLocation(direction.projects as unknown as Array<Record<string, unknown>>, id)
        if (location?.get()) return location
      }
      const target = data.compass?.directions?.[0]
      if (!target) return null
      return arrayLocation(target.projects as unknown as Array<Record<string, unknown>>, id)
    }
    case 'metric': {
      for (const direction of data.compass?.directions || []) {
        for (const project of direction.projects || []) {
          const location = arrayLocation(project.metrics as unknown as Array<Record<string, unknown>>, id)
          if (location?.get()) return location
        }
      }
      const target = data.compass?.directions?.[0]?.projects?.[0]
      if (!target) return null
      return arrayLocation(target.metrics as unknown as Array<Record<string, unknown>>, id)
    }
    case 'tag': {
      const visit = (rows: Array<Record<string, unknown>>): MutableLocation | null => {
        const own = arrayLocation(rows, id)
        if (own?.get()) return own
        for (const row of rows) {
          const children = row.children as Array<Record<string, unknown>> | undefined
          if (!Array.isArray(children)) continue
          const hit = visit(children)
          if (hit?.get()) return hit
        }
        return null
      }
      return visit((data.tagTree || []) as unknown as Array<Record<string, unknown>>)
    }
    case 'dailyFocus': {
      if (!data.dailyFocus) data.dailyFocus = {}
      return {
        get: () => data.dailyFocus?.[id] || null,
        set: value => {
          if (!Array.isArray(value)) return false
          data.dailyFocus[id] = value as AppData['dailyFocus'][string]
          return true
        },
        remove: () => {
          if (!(id in (data.dailyFocus || {}))) return false
          delete data.dailyFocus[id]
          return true
        },
      }
    }
    default:
      return null
  }
}

function ensureSafeParent(data: AppData, type: SyncManifestRecordType, value: Record<string, unknown>): void {
  const now = Date.now()
  value.updatedAt = now
  delete value.deletedAt
  if (type === 'workspace') value.archived = false
  if (type === 'direction') {
    value.status = value.status === 'archived' ? 'active' : (value.status || 'active')
    delete value.archivedAt
  }
  if (type === 'project') value.status = value.status === 'archived' ? 'active' : (value.status || 'active')
  if (type === 'category') {
    const workspaceId = String(value.workspaceId || '')
    if (!(data.workspaces || []).some(row => row.id === workspaceId && !row.archived)) {
      const live = (data.workspaces || []).find(row => !row.archived && row.id !== CURATION_WS_ID)
      value.workspaceId = live?.id || CURATION_WS_ID
    }
    const parentId = String(value.parentId || '')
    if (parentId && !(data.categories || []).some(row => row.id === parentId && !row.deletedAt)) delete value.parentId
  }
  if (type === 'resource') {
    const workspaceId = String(value.workspaceId || '')
    if (!(data.workspaces || []).some(row => row.id === workspaceId && !row.archived)) value.workspaceId = CURATION_WS_ID
    const categoryId = String(value.categoryId || '')
    if (categoryId && !(data.categories || []).some(row => row.id === categoryId && !row.deletedAt)) value.categoryId = ''
  }
  if (type === 'task') {
    const metricId = String(value.metricId || '')
    if (metricId && !(data.compass?.directions || []).some(direction => direction.projects.some(project => project.metrics.some(metric => metric.id === metricId)))) {
      value.metricId = ''
      value.projectId = ''
    }
  }
  if (type === 'argument') {
    const workspaceId = String(value.workspaceId || '')
    if (!(data.workspaces || []).some(row => row.id === workspaceId && !row.archived)) {
      value.workspaceId = (data.workspaces || []).find(row => !row.archived)?.id || ''
    }
  }
}

function prepareRestoredValue(
  data: AppData,
  type: SyncManifestRecordType,
  source: unknown,
): unknown | null {
  const next = cloneValue(source)
  if (next === null) return null
  // dailyFocus 是日期到 FocusSlot[] 的映射，恢复/回退时必须保留数组形态。
  if (Array.isArray(next)) return next
  if (!isObject(next)) return null
  ensureSafeParent(data, type, next)
  return next
}

export interface ApplyCloudReceiptActionResult {
  ok: boolean
  status: CloudSyncActionStatus
  message: string
}

/** 行内动作只做本机修改；成功后由数据层自然标记为待同步，不直接覆盖云端。 */
export function applyReceiptActionToData(
  data: AppData,
  action: CloudSyncReceiptAction,
  currentDigest: (value: unknown) => string,
): ApplyCloudReceiptActionResult {
  if (Date.now() > action.expiresAt) return { ok: false, status: 'expired', message: '动作载荷已过期，仍可查看摘要但不能继续操作' }
  if (action.operation === 'readonly') return { ok: false, status: 'readonly', message: '这类系统记录仅可查看，不支持普通卡片操作' }
  if (action.status !== 'available') return { ok: false, status: action.status, message: '这条记录已经处理过，请刷新后查看最新状态' }
  const location = locationOf(data, action.type, action.id)
  if (!location) return { ok: false, status: 'conflict', message: '当前数据位置已失效，无法安全处理这条记录' }
  const current = location.get()

  if (action.operation === 'delete') {
    if (!current) {
      return { ok: true, status: 'deleted', message: '本机已不存在这条记录' }
    }
    if (action.afterDigest && currentDigest(current) !== action.afterDigest) {
      return { ok: false, status: 'conflict', message: '这条记录在同步后已经再次变化，已停止删除' }
    }
    if (isObject(current)) {
      if ('deletedAt' in current || ['category', 'resource', 'task', 'curiosity', 'argument'].includes(action.type)) {
        current.deletedAt = Date.now()
        if ('updatedAt' in current) current.updatedAt = Date.now()
        return { ok: true, status: 'deleted', message: '已从本机删除，并进入待同步状态' }
      }
      if (action.type === 'workspace') {
        current.archived = true
        return { ok: true, status: 'deleted', message: '已归档这张策展台，并进入待同步状态' }
      }
      if (action.type === 'project') {
        current.status = 'archived'
        return { ok: true, status: 'deleted', message: '已归档这个项目，并进入待同步状态' }
      }
      if (action.type === 'direction') {
        current.archivedAt = Date.now()
        current.status = 'archived'
        return { ok: true, status: 'deleted', message: '已归档这个方向，并进入待同步状态' }
      }
    }
    location.remove()
    return { ok: true, status: 'deleted', message: '已从本机删除，并进入待同步状态' }
  }

  if (action.operation === 'restore') {
    const next = prepareRestoredValue(data, action.type, action.before)
    if (next === null) return { ok: false, status: 'conflict', message: '缺少恢复所需的本地载荷' }
    if (current && action.afterDigest && currentDigest(current) !== action.afterDigest) {
      return { ok: false, status: 'conflict', message: '这条记录在同步后已经再次变化，已停止恢复' }
    }
    if (!location.set(next)) return { ok: false, status: 'conflict', message: '当前数据位置不允许恢复这条记录' }
    return { ok: true, status: 'restored', message: '已恢复到本机，并以当前时间重新呈现' }
  }

  if (!current) return { ok: false, status: 'conflict', message: '这条记录已不存在，无法回退' }
  if (action.afterDigest && currentDigest(current) !== action.afterDigest) {
    return { ok: false, status: 'conflict', message: '这条记录在同步后已经再次变化，已停止回退' }
  }
  if (!action.before || (action.type !== 'dailyFocus' && (!isObject(action.before) || !isObject(current)))) {
    return { ok: false, status: 'conflict', message: '缺少可比较的同步前载荷' }
  }
  // 回退必须精确恢复同步前版本，不能残留同步后新增的字段。
  const next = prepareRestoredValue(data, action.type, action.before)
  if (next === null) return { ok: false, status: 'conflict', message: '缺少可比较的同步前载荷' }
  if (!location.set(next)) return { ok: false, status: 'conflict', message: '当前数据位置不允许回退这条记录' }
  return { ok: true, status: 'rolled_back', message: '已回退到本次同步前的版本，并进入待同步状态' }
}

function operationOf(type: SyncManifestRecordType, row: CloudSyncReceiptRow, before: unknown, after: unknown): CloudSyncActionOperation {
  if (!SUPPORTED_TYPES.has(type)) return 'readonly'
  if (row.status === 'added') return 'delete'
  if (row.status === 'removed') return 'restore'
  if (deletedOf(after) && !deletedOf(before)) return 'restore'
  if (deletedOf(before) && !deletedOf(after)) return 'delete'
  return 'rollback'
}

function statusOf(operation: CloudSyncActionOperation): CloudSyncActionStatus {
  return operation === 'readonly' ? 'readonly' : 'available'
}

function buildOne(receipt: CloudSyncReceipt, row: CloudSyncReceiptRow, beforeState: SnapshotState | null, afterState: SnapshotState | null): CloudSyncReceiptAction {
  const before = beforeState ? cloneValue(objectOf(beforeState.data, row.type, row.id)) : null
  const after = afterState ? cloneValue(objectOf(afterState.data, row.type, row.id)) : null
  const operation = operationOf(row.type, row, before, after)
  const expiresAt = receipt.at + ACTION_TTL_MS
  const expired = Date.now() > expiresAt
  return {
    receiptId: receipt.id,
    key: row.key,
    type: row.type,
    id: row.id,
    operation,
    status: expired ? 'expired' : statusOf(operation),
    ...(before !== null ? { before } : {}),
    ...(after !== null ? { after } : {}),
    beforeDigest: before !== null ? syncRecordDigest(before) : undefined,
    afterDigest: after !== null ? syncRecordDigest(after) : undefined,
    storedAt: Date.now(),
    expiresAt,
  }
}

function readonlyOne(receipt: CloudSyncReceipt, row: CloudSyncReceiptRow, error: unknown): CloudSyncReceiptAction {
  const expiresAt = receipt.at + ACTION_TTL_MS
  return {
    receiptId: receipt.id,
    key: row.key,
    type: row.type,
    id: row.id,
    operation: 'readonly',
    status: Date.now() > expiresAt ? 'expired' : 'readonly',
    storedAt: Date.now(),
    expiresAt,
    lastError: `动作载荷生成失败：${error instanceof Error ? error.message : String(error)}`,
  }
}

async function readStore(): Promise<ActionStore> {
  try {
    const raw = (await chrome.storage.local.get([K.CLOUD_SYNC_ACTIONS]))[K.CLOUD_SYNC_ACTIONS]
    if (!raw || typeof raw !== 'object') return emptyStore()
    const store = raw as Partial<ActionStore>
    return {
      version: 1,
      actions: Array.isArray(store.actions)
        ? store.actions.filter((row): row is CloudSyncReceiptAction =>
          !!row && typeof row.receiptId === 'string' && typeof row.key === 'string')
        : [],
    }
  } catch {
    return emptyStore()
  }
}

async function writeStore(store: ActionStore): Promise<void> {
  try {
    await chrome.storage.local.set({ [K.CLOUD_SYNC_ACTIONS]: store })
  } catch { /* 回执仍可只读展示 */ }
}

/** 只在本机保存恢复所需的最小业务载荷，不进入云端快照。 */
export async function saveReceiptActions(
  receipt: CloudSyncReceipt,
  beforeState: SnapshotState | null,
  afterState: SnapshotState | null,
): Promise<number> {
  if (!receipt.rows.length) return 0
  const current = await readStore()
  // 明细动作是同步后的辅助产物，任何单行载荷异常都只能把该行降级为只读，
  // 不能反向推翻已经完成的云端写入。
  const actions = receipt.rows.map(row => {
    try {
      return buildOne(receipt, row, beforeState, afterState)
    } catch (error) {
      return readonlyOne(receipt, row, error)
    }
  })
  const receiptIds = new Set([receipt.id])
  const next = [
    ...actions,
    ...current.actions.filter(row => !receiptIds.has(row.receiptId)),
  ]
  await writeStore({ version: 1, actions: next })
  return actions.length
}

export async function getReceiptActions(receiptId: string): Promise<CloudSyncReceiptAction[]> {
  const store = await readStore()
  const now = Date.now()
  return store.actions
    .filter(row => row.receiptId === receiptId)
    .map(row => now > row.expiresAt && row.status === 'available'
      ? { ...row, status: 'expired' as const }
      : row)
}

export async function getReceiptAction(receiptId: string, key: string): Promise<CloudSyncReceiptAction | null> {
  return (await getReceiptActions(receiptId)).find(row => row.key === key) || null
}

export async function setReceiptActionStatus(
  receiptId: string,
  key: string,
  status: CloudSyncActionStatus,
  lastError?: string,
): Promise<void> {
  const store = await readStore()
  const action = store.actions.find(row => row.receiptId === receiptId && row.key === key)
  if (!action) return
  action.status = status
  action.lastActionAt = Date.now()
  if (lastError) action.lastError = lastError
  else delete action.lastError
  await writeStore(store)
}

/** 回执与动作载荷共用 20 次 / 30 天保留策略。 */
export async function pruneReceiptActions(receipts: CloudSyncReceipt[]): Promise<void> {
  const allowed = new Set(receipts.map(row => row.id))
  const store = await readStore()
  // 回执与动作共用 20 次 / 30 天窗口。到 30 天后回执先被淘汰，
  // 动作随后一并清理；仅因动作到期但回执仍在时，保留载荷供只读查看。
  const actions = store.actions.filter(row => allowed.has(row.receiptId))
  if (actions.length !== store.actions.length) await writeStore({ version: 1, actions })
}
