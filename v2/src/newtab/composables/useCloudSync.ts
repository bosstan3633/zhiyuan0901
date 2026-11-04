import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { useAppStore } from '../stores/app'
import type {
  CloudCheckResult,
  CloudMeta,
  CloudRelation,
  SnapshotState,
} from '@/shared/cloud/sync'

export type CloudState = 'checking' | 'disabled' | 'signed_out' | 'connected' | 'syncing' | 'error'
export type CloudConflictChoice = 'download' | 'upload' | 'cancel'
export type CloudSyncOutcome =
  | { kind: 'needs_setup'; state: 'disabled' | 'signed_out' }
  | { kind: 'latest'; revision: number }
  | { kind: 'uploaded'; revision: number }
  | { kind: 'downloaded'; revision: number }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string }

type AppStore = ReturnType<typeof useAppStore>
export interface CloudDecisionInfo {
  relation: CloudRelation
  remoteRevision: number
  localRevision: number
  remoteFingerprint?: string
  localFingerprint?: string
}
type DecisionHandler = (info: CloudDecisionInfo) => Promise<CloudConflictChoice>

const state = ref<CloudState>('checking')
const meta = ref<CloudMeta | null>(null)
const envReady = ref<boolean | null>(null)
const errorMessage = ref('')
const relation = ref<CloudRelation | null>(null)
const checkResult = ref<CloudCheckResult | null>(null)
const lastSyncAt = computed(() => Math.max(meta.value?.lastUploadAt || 0, meta.value?.lastDownloadAt || 0))

let refreshPromise: Promise<void> | null = null
let activeSync: Promise<CloudSyncOutcome> | null = null
let relationProbePromise: Promise<CloudCheckResult | null> | null = null
let activeAccountKey = ''
let accountGeneration = 0
const autoProbedAccounts = new Set<string>()
let baselineMutationSeq: number | null = null
let latestMutationSeq = 0
let mutationUnsubscribe: (() => void) | null = null
let mutationSubscriptionPromise: Promise<void> | null = null

export interface CapturedLocalSnapshot {
  snapshot: SnapshotState
  mutationSeq: number
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const lastSyncLabel = computed(() => lastSyncAt.value ? formatTime(lastSyncAt.value) : '尚未同步')

const relationActionLabel = computed(() => {
  if (state.value === 'disabled') return '配置云同步'
  if (state.value === 'signed_out') return '登录云同步'
  if (state.value === 'checking') return '检查云同步'
  if (state.value === 'syncing') return '正在同步'
  if (state.value === 'error') return '同步异常'
  if (relation.value === 'local_changed') return '本机有改动 · 待上传'
  if (relation.value === 'remote_changed') return '云端有新增 · 待拉回'
  if (relation.value === 'both_changed') return '两端都有改动 · 需选择'
  if (relation.value === 'in_sync') return '本机与云端一致'
  if (relation.value === 'empty_remote') return '云端尚未备份 · 待上传'
  if (relation.value === 'unknown') return '同步方向待确认'
  return '检查同步方向'
})
const statusText = relationActionLabel

const statusDetail = computed(() => {
  if (state.value === 'disabled') return '点击完成云端配置'
  if (state.value === 'signed_out') return '点击登录云端账号'
  if (state.value === 'checking') return '正在读取云端状态'
  if (state.value === 'syncing') return '正在处理本次同步'
  if (state.value === 'error') return errorMessage.value || '点击重试'
  if (relation.value === 'local_changed') return '本机改动待上传'
  if (relation.value === 'remote_changed') return '云端新增待拉回本机'
  if (relation.value === 'both_changed') return '两端都有改动，需选择保留哪端'
  if (relation.value === 'in_sync') return '两边内容一致，无须同步'
  if (relation.value === 'empty_remote') return '本机内容可首次上传'
  if (relation.value === 'unknown') return '首次使用请确认同步方向'
  return `最近实际同步 ${lastSyncLabel.value}`
})

const canSync = computed(() => state.value === 'connected' && !!meta.value?.refreshToken && envReady.value === true)

async function loadSharedModules() {
  const [client, sync] = await Promise.all([
    import('@/shared/cloud/client'),
    import('@/shared/cloud/sync'),
  ])
  return { client, sync }
}

function promoteRelationForLocalMutation(current: CloudRelation): CloudRelation {
  if (current === 'in_sync') return 'local_changed'
  if (current === 'remote_changed') return 'both_changed'
  return current
}

function setRelation(next: CloudRelation): void {
  relation.value = next
  const current = checkResult.value
  if (current && current.relation !== next) {
    checkResult.value = { ...current, kind: next, relation: next }
  }
}

/**
 * 数据层只广播单调递增的脏计数；这里据此把关系从“一致/待拉回”
 * 推到“本机待上传/两端都有改动”，不轮询也不计算整树指纹。
 */
function onDataMutation(seq: number): void {
  latestMutationSeq = seq
  if (baselineMutationSeq === null || seq <= baselineMutationSeq) return
  if (state.value === 'checking' || state.value === 'syncing') return
  if (state.value !== 'connected' || !relation.value) return
  setRelation(promoteRelationForLocalMutation(relation.value))
}

async function ensureMutationSubscription(): Promise<void> {
  if (mutationUnsubscribe) return
  if (!mutationSubscriptionPromise) {
    mutationSubscriptionPromise = (async () => {
      const repository = await import('@/shared/storage/repository')
      latestMutationSeq = repository.getMutationSeq()
      mutationUnsubscribe = repository.subscribeDataMutation(onDataMutation)
    })()
  }
  try {
    await mutationSubscriptionPromise
  } catch (error) {
    mutationSubscriptionPromise = null
    throw error
  }
}

export async function captureLocalSnapshot(store: AppStore): Promise<CapturedLocalSnapshot> {
  await ensureMutationSubscription()
  const [repository, eventLog] = await Promise.all([
    import('@/shared/storage/repository'),
    import('@/shared/utils/eventLog'),
  ])
  await repository.saveDataNow()
  await eventLog.flushEventQueue()
  if (!store.data) throw new Error('本机数据尚未就绪')
  const ui = await repository.loadUIPrefs()
  const mutationSeq = repository.getMutationSeq()
  latestMutationSeq = mutationSeq
  return {
    mutationSeq,
    snapshot: {
      data: store.data,
      ui,
      eventLog: await eventLog.readEventLog(),
    },
  }
}

function applyCheck(
  result: CloudCheckResult,
  snapshotMutationSeq?: number,
  currentMutationSeq = latestMutationSeq,
): void {
  checkResult.value = result
  if (snapshotMutationSeq !== undefined) baselineMutationSeq = snapshotMutationSeq
  if (result.relation === 'idle') {
    relation.value = null
    return
  }
  const next = currentMutationSeq > (snapshotMutationSeq ?? currentMutationSeq)
    ? promoteRelationForLocalMutation(result.relation)
    : result.relation
  setRelation(next)
}

function accountKeyOf(value: CloudMeta | null): string {
  return value?.userId || value?.email || ''
}

function resetAccountState(): void {
  accountGeneration += 1
  relationProbePromise = null
  baselineMutationSeq = null
  relation.value = null
  checkResult.value = null
  errorMessage.value = ''
}

/** 账号变化时清掉旧账号状态，并让迟到响应失效。 */
function observeAccount(current: CloudMeta | null): void {
  const nextKey = accountKeyOf(current)
  if (nextKey === activeAccountKey) return
  activeAccountKey = nextKey
  resetAccountState()
}

async function checkCloudRelation(store: AppStore): Promise<CloudCheckResult | null> {
  const { sync } = await loadSharedModules()
  const startedGeneration = accountGeneration
  const startedAccountKey = activeAccountKey
  const captured = await captureLocalSnapshot(store)
  const result = await sync.checkRemote(captured.snapshot)
  const current = await sync.getCloudMeta()
  if (startedGeneration !== accountGeneration || startedAccountKey !== activeAccountKey) return null
  if (startedAccountKey && accountKeyOf(current) !== startedAccountKey) return null
  meta.value = current
  applyCheck(result, captured.mutationSeq, latestMutationSeq)
  state.value = 'connected'
  return result
}

async function startRelationProbe(store: AppStore, force: boolean): Promise<CloudCheckResult | null> {
  const current = meta.value
  const key = accountKeyOf(current)
  if (!envReady.value || !current?.refreshToken || !key) return null
  if (!force && !current.checkOnStart) return checkResult.value
  if (!force && autoProbedAccounts.has(key)) return checkResult.value
  if (relationProbePromise) return relationProbePromise

  autoProbedAccounts.add(key)
  const generation = accountGeneration
  state.value = 'checking'
  errorMessage.value = ''
  const promise = (async () => {
    try {
      const result = await checkCloudRelation(store)
      if (generation !== accountGeneration) return null
      return result
    } catch (error) {
      if (generation === accountGeneration) {
        state.value = 'error'
        errorMessage.value = messageOf(error)
      }
      throw error
    }
  })()
  relationProbePromise = promise
  void promise.finally(() => {
    if (relationProbePromise === promise) relationProbePromise = null
  }).catch(() => undefined)
  return promise
}

/** 顶栏与设置页共用同一个启动探测；同一账号本轮只自动请求一次。 */
async function ensureRelationProbe(store: AppStore, force = false): Promise<CloudCheckResult | null> {
  await refreshCloudStatus(false)
  return startRelationProbe(store, force)
}

async function refreshCloudStatus(probeRemote = false, store?: AppStore): Promise<void> {
  if (activeSync) await activeSync
  if (refreshPromise) {
    await refreshPromise
    if (probeRemote && store) await startRelationProbe(store, false)
    return
  }
  refreshPromise = (async () => {
    try {
      const { client, sync } = await loadSharedModules()
      const [env, current] = await Promise.all([client.cloudEnv(), sync.getCloudMeta()])
      envReady.value = !!env
      meta.value = current
      observeAccount(current)
      if (!env) {
        observeAccount(null)
        state.value = 'disabled'
        return
      }
      if (!current?.refreshToken) {
        state.value = 'signed_out'
        return
      }
      state.value = 'connected'
    } catch (error) {
      state.value = 'error'
      errorMessage.value = messageOf(error)
    } finally {
      refreshPromise = null
    }
  })()
  await refreshPromise
  if (probeRemote && store) await startRelationProbe(store, false)
}

/** 恢复时把附件元数据按卡片 ID 重新挂回；附件本体始终留在本机。 */
async function restoreCloudSnapshot(store: AppStore): Promise<{ revision: number }> {
  const { sync } = await loadSharedModules()
  const repository = await import('@/shared/storage/repository')
  if (!store.data) throw new Error('本机数据尚未就绪')
  const downloaded = await sync.downloadNow()
  const localAssets = new Map<string, import('@/shared/models').AssetMeta[]>()
  for (const cards of [
    store.data.resources,
    store.data.tasks,
    store.data.curiosities,
    ...(store.data.argCards ? [store.data.argCards] : []),
  ]) {
    for (const card of cards || []) {
      if (card.assets?.length) localAssets.set(card.id, card.assets)
    }
  }
  const nextData = downloaded.state.data
  for (const cards of [
    nextData.resources,
    nextData.tasks,
    nextData.curiosities,
    ...(nextData.argCards ? [nextData.argCards] : []),
  ]) {
    for (const card of cards || []) {
      const assets = localAssets.get(card.id)
      if (assets) card.assets = assets
    }
  }
  await repository.cloudRestoreAtomic({
    nextData,
    nextUi: downloaded.state.ui,
    eventLog: downloaded.state.eventLog,
  })
  await store.refreshAfterCloudRestore(nextData, downloaded.state.ui)
  await sync.markDownloaded(downloaded.revision, downloaded.fingerprint)
  await settleInSync(downloaded.revision, downloaded.fingerprint, repository.getMutationSeq())
  return { revision: downloaded.revision }
}

/**
 * 上传/拉回成功后统一回写基线。这里重新读取 meta，确保最近同步时间、
 * revision 与快照指纹来自同一份持久化事实，而不是各分支手写一份状态。
 */
async function settleInSync(
  remoteRevision: number,
  fingerprint: string,
  mutationSeq: number,
): Promise<void> {
  const { sync } = await loadSharedModules()
  meta.value = await sync.getCloudMeta()
  baselineMutationSeq = mutationSeq
  latestMutationSeq = Math.max(latestMutationSeq, mutationSeq)
  checkResult.value = {
    kind: 'in_sync',
    relation: 'in_sync',
    remoteRevision,
    remoteFingerprint: fingerprint,
    localFingerprint: fingerprint,
  }
  setRelation(latestMutationSeq > mutationSeq ? 'local_changed' : 'in_sync')
  state.value = 'connected'
}

async function uploadSnapshot(
  store: AppStore,
  captured: CapturedLocalSnapshot,
  onDecision: DecisionHandler,
  approvedRemoteRevision?: number,
): Promise<CloudSyncOutcome> {
  const { sync } = await loadSharedModules()
  const current = await sync.getCloudMeta()
  const uploaded = await sync.uploadNow(
    captured.snapshot,
    remoteRevision => onDecision({
      relation: 'both_changed',
      remoteRevision,
      localRevision: current?.revision || 0,
    }),
    approvedRemoteRevision,
  )
  if (uploaded.kind === 'cancelled') {
    state.value = 'connected'
    return { kind: 'cancelled' }
  }
  if (uploaded.kind === 'download_requested') {
    const restored = await restoreCloudSnapshot(store)
    return { kind: 'downloaded', revision: restored.revision }
  }
  await settleInSync(uploaded.revision, uploaded.fingerprint, captured.mutationSeq)
  return { kind: 'uploaded', revision: uploaded.revision }
}

async function runManualSync(store: AppStore, onDecision: DecisionHandler): Promise<CloudSyncOutcome> {
  const { client, sync } = await loadSharedModules()
  const [env, current] = await Promise.all([client.cloudEnv(), sync.getCloudMeta()])
  envReady.value = !!env
  meta.value = current
  if (!env) {
    state.value = 'disabled'
    return { kind: 'needs_setup', state: 'disabled' }
  }
  if (!current?.refreshToken) {
    state.value = 'signed_out'
    return { kind: 'needs_setup', state: 'signed_out' }
  }

  state.value = 'syncing'
  errorMessage.value = ''
  const captured = await captureLocalSnapshot(store)
  const check = await sync.checkRemote(captured.snapshot)
  meta.value = await sync.getCloudMeta()
  applyCheck(check, captured.mutationSeq, latestMutationSeq)
  if (check.kind === 'idle') {
    state.value = 'signed_out'
    return { kind: 'needs_setup', state: 'signed_out' }
  }
  if (check.kind === 'in_sync') {
    await settleInSync(
      check.remoteRevision,
      check.remoteFingerprint || check.localFingerprint || '',
      captured.mutationSeq,
    )
    return { kind: 'latest', revision: check.remoteRevision }
  }
  if (check.kind === 'empty_remote' || check.kind === 'local_changed') {
    return uploadSnapshot(store, captured, onDecision)
  }

  const choice = await onDecision({
    relation: check.kind,
    remoteRevision: check.remoteRevision,
    localRevision: current.revision || 0,
    remoteFingerprint: check.remoteFingerprint,
    localFingerprint: check.localFingerprint,
  })
  if (choice === 'cancel') {
    state.value = 'connected'
    return { kind: 'cancelled' }
  }
  if (choice === 'download') {
    const restored = await restoreCloudSnapshot(store)
    return { kind: 'downloaded', revision: restored.revision }
  }
  return uploadSnapshot(store, captured, onDecision, check.remoteRevision)
}

async function manualSync(store: AppStore, onDecision: DecisionHandler): Promise<CloudSyncOutcome> {
  if (activeSync) return activeSync
  activeSync = (async () => {
    try {
      return await runManualSync(store, onDecision)
    } catch (error) {
      state.value = 'error'
      errorMessage.value = messageOf(error)
      return { kind: 'failed', message: errorMessage.value }
    } finally {
      activeSync = null
    }
  })()
  return activeSync
}

async function uploadCurrent(store: AppStore, onDecision: DecisionHandler): Promise<CloudSyncOutcome> {
  state.value = 'syncing'
  try {
    const snapshot = await captureLocalSnapshot(store)
    return await uploadSnapshot(store, snapshot, onDecision)
  } catch (error) {
    const message = messageOf(error)
    state.value = 'error'
    errorMessage.value = message
    throw error
  }
}

async function downloadCurrent(store: AppStore): Promise<{ revision: number }> {
  state.value = 'syncing'
  try {
    return await restoreCloudSnapshot(store)
  } catch (error) {
    state.value = 'error'
    errorMessage.value = messageOf(error)
    throw error
  }
}

export interface UseCloudSyncReturn {
  state: Ref<CloudState>
  meta: Ref<CloudMeta | null>
  envReady: Ref<boolean | null>
  errorMessage: Ref<string>
  relation: Ref<CloudRelation | null>
  checkResult: Ref<CloudCheckResult | null>
  lastSyncAt: ComputedRef<number>
  lastSyncLabel: ComputedRef<string>
  relationActionLabel: ComputedRef<string>
  statusText: ComputedRef<string>
  statusDetail: ComputedRef<string>
  canSync: ComputedRef<boolean>
  refreshCloudStatus: (probeRemote?: boolean, store?: AppStore) => Promise<void>
  ensureRelationProbe: (store: AppStore, force?: boolean) => Promise<CloudCheckResult | null>
  checkCloudRelation: (store: AppStore) => Promise<CloudCheckResult | null>
  manualSync: (store: AppStore, onDecision: DecisionHandler) => Promise<CloudSyncOutcome>
  uploadCurrent: (store: AppStore, onDecision: DecisionHandler) => Promise<CloudSyncOutcome>
  downloadCurrent: (store: AppStore) => Promise<{ revision: number }>
}

export function useCloudSync(): UseCloudSyncReturn {
  return {
    state,
    meta,
    envReady,
    errorMessage,
    relation,
    checkResult,
    lastSyncAt,
    lastSyncLabel,
    relationActionLabel,
    statusText,
    statusDetail,
    canSync,
    refreshCloudStatus,
    ensureRelationProbe,
    checkCloudRelation,
    manualSync,
    uploadCurrent,
    downloadCurrent,
  }
}
