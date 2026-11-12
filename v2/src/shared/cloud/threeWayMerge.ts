import type { AppData } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { mergeEventLogs } from '@/shared/utils/eventLog'
import { stableStringify } from './digest'
import type { SnapshotState, SyncManifestRecordType } from './sync'

export type MergeSide = 'local' | 'remote'
export type MergeChoices = Record<string, MergeSide>

export interface MergeConflict {
  id: string
  type: SyncManifestRecordType
  recordId: string
  title: string
  field: string
  kind: 'field' | 'delete-modify' | 'unknown'
  baseValue: unknown
  localValue: unknown
  remoteValue: unknown
  localMissing?: boolean
  remoteMissing?: boolean
  baseMissing?: boolean
}

export interface MergeResult {
  state: SnapshotState
  conflicts: MergeConflict[]
  changedRecords: number
}

interface MergeContext {
  path: string
  type: SyncManifestRecordType
  recordId: string
  title: string
  field?: string
}

interface MutableMergeState {
  base: SnapshotState | null
  baseKnown: boolean
  choices: MergeChoices
  conflicts: MergeConflict[]
}

const MISSING = Symbol('missing')
type MaybeMissing = unknown | typeof MISSING

const RECORD_TYPES: Record<string, SyncManifestRecordType> = {
  resources: 'resource',
  tasks: 'task',
  curiosities: 'curiosity',
  argCards: 'argument',
  workspaces: 'workspace',
  categories: 'category',
  directions: 'direction',
  projects: 'project',
  metrics: 'metric',
  supportLinks: 'supportLink',
  curationProjections: 'curationProjection',
  resourceFolders: 'resourceFolder',
  resourceFolderMirrors: 'resourceFolderMirror',
  activityLogs: 'activity',
  tagTree: 'tag',
}

const RECORD_COLLECTION_LABEL: Partial<Record<SyncManifestRecordType, string>> = {
  resource: '资源卡',
  task: '任务卡',
  curiosity: '好奇心卡',
  argument: '策展节点',
  workspace: '策展台',
  category: '策展分类',
  direction: '方向',
  project: '项目',
  metric: '成功指标',
  supportLink: '任务资源关系',
  curationProjection: '策展资源镜像',
  resourceFolder: '常用夹',
  resourceFolderMirror: '常用夹镜像',
  activity: '操作记录',
  tag: '标签',
  dailyFocus: '今日三件事',
}

const DELETION_FIELDS = new Set(['deletedAt', 'archivedAt'])
const NON_CONFLICT_DERIVED_FIELDS = new Set([
  'updatedAt',
  'createdAt',
  'addedAt',
  'lastCalledAt',
  'calibratedAt',
  'uploadedAt',
  'storedAt',
  'callCount',
  'retryCount',
  'tagTreeRevision',
  'projBackfillFixed',
  'subtasksFoldedAt',
  'hubMigratedAt',
  'hubMergedAt',
  'hotStatsSplitAt',
  'tagsVisibleMigratedAt',
  'catsMigratedAt',
  'boardCardsPooledAt',
])
/** 只描述当前设备状态，不参与业务字段冲突。 */
const LOCAL_ONLY_FIELDS = new Set(['stats', 'activityLogs'])

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value
  try { return JSON.parse(JSON.stringify(value)) as T } catch { return value }
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try { return stableStringify(a) === stableStringify(b) } catch { return false }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isIdRecord(value: unknown): value is Record<string, unknown> & { id: string } {
  return isObject(value) && typeof value.id === 'string' && value.id.length > 0
}

function missingOf(value: MaybeMissing): boolean {
  return value === MISSING || value === undefined
}

function publicValue(value: MaybeMissing): unknown {
  return missingOf(value) ? null : clone(value)
}

function titleOf(record: unknown, fallback: string): string {
  if (!isObject(record)) return fallback
  const title = record.title || record.name || record.question || record.detail || record.id
  return String(title || fallback).slice(0, 180)
}

function deletionFlag(type: SyncManifestRecordType, value: MaybeMissing): boolean {
  if (missingOf(value) || !isObject(value)) return false
  if (type === 'resource' || type === 'task' || type === 'curiosity' || type === 'argument' || type === 'category') {
    return typeof value.deletedAt === 'number'
  }
  if (type === 'workspace') return value.archived === true
  if (type === 'project' || type === 'direction') return value.status === 'archived'
  return false
}

function withoutDeletionFlag(value: unknown): unknown {
  if (!isObject(value)) return value
  const next = { ...value }
  delete next.deletedAt
  delete next.archivedAt
  if (next.archived === true) next.archived = false
  if (next.status === 'archived') next.status = 'active'
  return next
}

function conflictId(ctx: MergeContext): string {
  return `${ctx.type}:${ctx.recordId}:${ctx.field || '__record__'}:${ctx.path}`
}

function recordConflict(
  state: MutableMergeState,
  ctx: MergeContext,
  base: MaybeMissing,
  local: MaybeMissing,
  remote: MaybeMissing,
  kind: MergeConflict['kind'] = 'field',
): MergeSide {
  const id = conflictId(ctx)
  const selected = state.choices[id]
  if (!selected && !state.conflicts.some(row => row.id === id)) {
    state.conflicts.push({
      id,
      type: ctx.type,
      recordId: ctx.recordId,
      title: ctx.title,
      field: ctx.field || '整条记录',
      kind,
      baseValue: publicValue(base),
      localValue: publicValue(local),
      remoteValue: publicValue(remote),
      ...(missingOf(base) ? { baseMissing: true } : {}),
      ...(missingOf(local) ? { localMissing: true } : {}),
      ...(missingOf(remote) ? { remoteMissing: true } : {}),
    })
  }
  return selected || 'local'
}

function chooseConflict(
  state: MutableMergeState,
  ctx: MergeContext,
  base: MaybeMissing,
  local: MaybeMissing,
  remote: MaybeMissing,
  kind: MergeConflict['kind'] = 'field',
): unknown {
  return recordConflict(state, ctx, base, local, remote, kind) === 'remote'
    ? clone(remote)
    : clone(local)
}

function chooseScalar(
  state: MutableMergeState,
  ctx: MergeContext,
  base: MaybeMissing,
  local: MaybeMissing,
  remote: MaybeMissing,
): unknown {
  if (same(local, remote)) return clone(local)
  if (state.baseKnown) {
    if (same(local, base)) return clone(remote)
    if (same(remote, base)) return clone(local)
  } else {
    if (missingOf(local)) return clone(remote)
    if (missingOf(remote)) return clone(local)
  }
  return chooseConflict(state, ctx, base, local, remote)
}

/** Derived numeric fields can be absent on either side, especially before a shared baseline exists. */
function finiteNumber(value: MaybeMissing): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function mergeDerivedField(
  state: MutableMergeState,
  ctx: MergeContext,
  base: MaybeMissing,
  local: MaybeMissing,
  remote: MaybeMissing,
): unknown | typeof MISSING {
  if (same(local, remote)) return clone(local)
  if (state.baseKnown) {
    if (same(local, base)) return clone(remote)
    if (same(remote, base)) return clone(local)
  }
  const localNumber = finiteNumber(local)
  const remoteNumber = finiteNumber(remote)
  if (ctx.field === 'updatedAt' || ctx.field === 'lastCalledAt' || ctx.field === 'uploadedAt' || ctx.field === 'calibratedAt') {
    if (localNumber === null) return remoteNumber === null ? MISSING : clone(remote)
    if (remoteNumber === null) return clone(local)
    return Math.max(localNumber, remoteNumber)
  }
  if (ctx.field === 'createdAt' || ctx.field === 'addedAt') {
    if (localNumber === null) return remoteNumber === null ? MISSING : clone(remote)
    if (remoteNumber === null) return clone(local)
    return Math.min(localNumber, remoteNumber)
  }
  if (ctx.field === 'callCount' || ctx.field === 'retryCount') {
    if (localNumber === null) return remoteNumber === null ? MISSING : clone(remote)
    if (remoteNumber === null) return clone(local)
    return Math.max(localNumber, remoteNumber)
  }
  return MISSING
}

function mergePrimitiveArray(
  state: MutableMergeState,
  ctx: MergeContext,
  base: unknown[],
  local: unknown[],
  remote: unknown[],
): unknown[] {
  if (same(local, remote)) return clone(local)
  if (state.baseKnown && same(local, base)) return clone(remote)
  if (state.baseKnown && same(remote, base)) return clone(local)

  const out: unknown[] = []
  const seen = new Set<string>()
  const add = (value: unknown) => {
    const key = stableStringify(value)
    if (seen.has(key)) return
    seen.add(key)
    out.push(clone(value))
  }
  for (const value of local) add(value)
  for (const value of remote) add(value)
  if (!state.baseKnown) return out

  for (const value of out) {
    const key = stableStringify(value)
    const inBase = base.some(item => stableStringify(item) === key)
    const inLocal = local.some(item => stableStringify(item) === key)
    const inRemote = remote.some(item => stableStringify(item) === key)
    if (inLocal === inRemote || inLocal === inBase || inRemote === inBase) continue
    return chooseConflict(state, ctx, base, local, remote) as unknown[]
  }
  return out
}

function mergeArray(
  state: MutableMergeState,
  ctx: MergeContext,
  base: unknown[] | typeof MISSING,
  local: unknown[] | typeof MISSING,
  remote: unknown[] | typeof MISSING,
): unknown {
  if (same(local, remote)) return clone(local)
  if (state.baseKnown) {
    if (same(local, base)) return clone(remote)
    if (same(remote, base)) return clone(local)
  } else {
    if (missingOf(local)) return clone(remote)
    if (missingOf(remote)) return clone(local)
  }
  if (missingOf(local) || missingOf(remote)) return chooseConflict(state, ctx, base, local, remote)

  const localArr = local as unknown[]
  const remoteArr = remote as unknown[]
  const baseArr = missingOf(base) ? [] : base as unknown[]
  const localRecords = localArr.filter(isIdRecord)
  const remoteRecords = remoteArr.filter(isIdRecord)
  const allRecords = localRecords.length === localArr.length
    && remoteRecords.length === remoteArr.length
  if (allRecords && (localArr.length || remoteArr.length || baseArr.length)) {
    return mergeRecordArray(
      state,
      ctx,
      baseArr.filter(isIdRecord),
      localRecords,
      remoteRecords,
    )
  }
  const allPrimitive = [...localArr, ...remoteArr].every(value => !value || typeof value !== 'object')
  if (allPrimitive) return mergePrimitiveArray(state, ctx, baseArr, localArr, remoteArr)
  return chooseConflict(state, ctx, base, local, remote)
}

function mergeRecordObject(
  state: MutableMergeState,
  ctx: MergeContext,
  base: MaybeMissing,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const baseObject = isObject(base) ? base : undefined
  const keys = new Set([
    ...Object.keys(baseObject || {}),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key === '__wid' || key === '__cloud') continue
    const b = baseObject && key in baseObject ? baseObject[key] : MISSING
    const l = key in local ? local[key] : MISSING
    const r = key in remote ? remote[key] : MISSING
    const fieldCtx: MergeContext = {
      ...ctx,
      type: RECORD_TYPES[key] || ctx.type,
      field: key,
      path: `${ctx.path}.${key}`,
    }
    let next: MaybeMissing
    if (LOCAL_ONLY_FIELDS.has(key)) {
      next = clone(l)
    } else if (NON_CONFLICT_DERIVED_FIELDS.has(key)) {
      next = mergeDerivedField(state, fieldCtx, b, l, r)
      if (next === MISSING && (missingOf(l) || missingOf(r))) {
        next = missingOf(l) ? r : l
      }
    } else if (DELETION_FIELDS.has(key)) {
      next = chooseScalar(state, fieldCtx, b, l, r)
    } else {
      next = mergeValue(state, fieldCtx, b, l, r)
    }
    if (!missingOf(next)) out[key] = next
  }
  return out
}

function recordChangedBeyondDeletion(base: unknown, side: unknown): boolean {
  return !same(withoutDeletionFlag(base), withoutDeletionFlag(side))
}

function mergeRecordArray(
  state: MutableMergeState,
  ctx: MergeContext,
  baseRows: Array<Record<string, unknown> & { id: string }>,
  localRows: Array<Record<string, unknown> & { id: string }>,
  remoteRows: Array<Record<string, unknown> & { id: string }>,
): Array<Record<string, unknown> & { id: string }> {
  const baseById = new Map(baseRows.map(row => [row.id, row]))
  const localById = new Map(localRows.map(row => [row.id, row]))
  const remoteById = new Map(remoteRows.map(row => [row.id, row]))
  const order: string[] = []
  const seen = new Set<string>()
  for (const row of [...localRows, ...remoteRows, ...baseRows]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    order.push(row.id)
  }
  const out: Array<Record<string, unknown> & { id: string }> = []
  for (const id of order) {
    const b = baseById.get(id) ?? MISSING
    const l = localById.get(id) ?? MISSING
    const r = remoteById.get(id) ?? MISSING
    const title = titleOf(missingOf(l) ? r : l, id)
    const rowCtx: MergeContext = { ...ctx, recordId: id, title }
    let merged: unknown

    if (same(l, r)) {
      merged = clone(l)
    } else if (!state.baseKnown || missingOf(b)) {
      if (missingOf(l)) merged = clone(r)
      else if (missingOf(r)) merged = clone(l)
      else {
        const lDeleted = deletionFlag(ctx.type, l)
        const rDeleted = deletionFlag(ctx.type, r)
        if (lDeleted !== rDeleted) {
          merged = chooseConflict(state, rowCtx, b, l, r, 'delete-modify')
        } else {
          merged = mergeRecordObject(state, rowCtx, b, l as Record<string, unknown>, r as Record<string, unknown>)
        }
      }
    } else if (missingOf(l)) {
      if (recordChangedBeyondDeletion(b, r)) {
        merged = chooseConflict(state, rowCtx, b, l, r, 'delete-modify')
      } else {
        merged = MISSING
      }
    } else if (missingOf(r)) {
      if (recordChangedBeyondDeletion(b, l)) {
        merged = chooseConflict(state, rowCtx, b, l, r, 'delete-modify')
      } else {
        merged = MISSING
      }
    } else {
      const lDeleted = deletionFlag(ctx.type, l)
      const rDeleted = deletionFlag(ctx.type, r)
      if (lDeleted !== rDeleted) {
        const changingSide = lDeleted ? r : l
        if (recordChangedBeyondDeletion(b, changingSide)) {
          merged = chooseConflict(state, rowCtx, b, l, r, 'delete-modify')
        } else {
          merged = clone(lDeleted ? l : r)
        }
      } else {
        merged = mergeRecordObject(state, rowCtx, b, l as Record<string, unknown>, r as Record<string, unknown>)
      }
    }

    if (!missingOf(merged) && isIdRecord(merged)) out.push(merged)
  }
  return out
}

function mergeObject(
  state: MutableMergeState,
  ctx: MergeContext,
  base: Record<string, unknown> | typeof MISSING,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const keys = new Set([
    ...(isObject(base) ? Object.keys(base) : []),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])
  for (const key of keys) {
    const b = isObject(base) && key in base ? base[key] : MISSING
    const l = key in local ? local[key] : MISSING
    const r = key in remote ? remote[key] : MISSING
    const fieldCtx: MergeContext = {
      ...ctx,
      path: `${ctx.path}.${key}`,
      type: RECORD_TYPES[key]
        || (key === 'dailyFocus' ? 'dailyFocus' : key === 'stats' ? 'stats' : key === 'fieldConfig' ? 'fieldConfig' : ctx.type),
      field: key,
    }
    const next = mergeValue(state, fieldCtx, b, l, r)
    if (!missingOf(next)) out[key] = next
  }
  return out
}

function mergeValue(
  state: MutableMergeState,
  ctx: MergeContext,
  base: MaybeMissing,
  local: MaybeMissing,
  remote: MaybeMissing,
): MaybeMissing {
  if (same(local, remote)) return clone(local)
  if (state.baseKnown) {
    if (same(local, base)) return clone(remote)
    if (same(remote, base)) return clone(local)
  } else {
    if (missingOf(local)) return clone(remote)
    if (missingOf(remote)) return clone(local)
  }
  if (Array.isArray(local) || Array.isArray(remote) || Array.isArray(base)) {
    return mergeArray(
      state,
      ctx,
      Array.isArray(base) ? base : MISSING,
      Array.isArray(local) ? local : MISSING,
      Array.isArray(remote) ? remote : MISSING,
    )
  }
  if (isObject(local) && isObject(remote)) {
    return mergeObject(state, ctx, isObject(base) ? base : MISSING, local, remote)
  }
  return chooseScalar(state, ctx, base, local, remote)
}

function normalizeMergedData(data: AppData, local: AppData, remote: AppData): AppData {
  const next = clone(data)
  const metricById = new Map<string, { id: string; projectId: string; taskIds: string[] }>()
  for (const direction of next.compass?.directions || []) {
    for (const project of direction.projects || []) {
      for (const metric of project.metrics || []) {
        metric.taskIds = Array.isArray(metric.taskIds) ? metric.taskIds : []
        metricById.set(metric.id, { id: metric.id, projectId: project.id, taskIds: metric.taskIds })
      }
    }
  }

  const taskIdsWithOwner = new Map<string, string>()
  for (const task of next.tasks || []) {
    if (task.metricId && metricById.has(task.metricId)) taskIdsWithOwner.set(task.id, task.metricId)
  }
  for (const metric of metricById.values()) {
    for (const taskId of metric.taskIds || []) if (!taskIdsWithOwner.has(taskId)) taskIdsWithOwner.set(taskId, metric.id)
  }
  for (const metric of metricById.values()) metric.taskIds = []
  for (const task of next.tasks || []) {
    const metricId = taskIdsWithOwner.get(task.id)
    if (!metricId) {
      task.metricId = undefined
      task.projectId = undefined
      continue
    }
    const metric = metricById.get(metricId)!
    task.metricId = metric.id
    task.projectId = metric.projectId
    metric.taskIds.push(task.id)
  }

  const localRevision = finiteNumber(local.tagTreeRevision) ?? 0
  const remoteRevision = finiteNumber(remote.tagTreeRevision) ?? 0
  if (remoteRevision > localRevision) next.tagTreeRevision = remoteRevision
  else next.tagTreeRevision = Math.max(localRevision, finiteNumber(next.tagTreeRevision) ?? 0)

  if (next.dailyFocus && typeof next.dailyFocus === 'object') {
    for (const [date, slots] of Object.entries(next.dailyFocus)) {
      if (!Array.isArray(slots)) {
        delete next.dailyFocus[date]
        continue
      }
      next.dailyFocus[date] = slots
        .filter((slot, index, rows) => rows.findIndex(row => row.id === slot.id) === index)
        .slice(0, 3)
    }
  }
  return next
}

export function mergeThreeWaySnapshots(
  base: SnapshotState | null,
  local: SnapshotState,
  remote: SnapshotState,
  choices: MergeChoices = {},
): MergeResult {
  const state: MutableMergeState = {
    base,
    baseKnown: !!base,
    choices,
    conflicts: [],
  }
  const rootCtx: MergeContext = {
    path: 'data',
    type: 'fieldConfig',
    recordId: '__root__',
    title: '业务数据',
  }
  const mergedData = mergeObject(
    state,
    rootCtx,
    base?.data ? base.data as unknown as Record<string, unknown> : MISSING,
    local.data as unknown as Record<string, unknown>,
    remote.data as unknown as Record<string, unknown>,
  ) as unknown as AppData
  const normalized = normalizeMergedData(mergedData, local.data, remote.data)
  const eventLog = mergeEventLogs(local.eventLog || [], remote.eventLog || []) as CardEvent[]
  return {
    state: {
      data: normalized,
      ui: null,
      eventLog,
    },
    conflicts: state.conflicts,
    changedRecords: Math.max(0, state.conflicts.length),
  }
}

export function hasConflictChoices(conflicts: MergeConflict[], choices: MergeChoices): boolean {
  return conflicts.some(conflict => !choices[conflict.id])
}

export function recordTypeLabel(type: SyncManifestRecordType): string {
  return RECORD_COLLECTION_LABEL[type] || '记录'
}
