import { computed, ref } from 'vue'
import { useAppStore } from '@/newtab/stores/app'
import { CURATION_WS_ID, type CuriosityCard, type ResourceCard, type TaskCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import { LOCAL_KEYS } from '@/shared/storage/keys'
import {
  convertCapture,
  dismissCapture,
  getCloudMeta,
  listCaptures,
  restoreCapture,
  type CaptureConvertedKind,
  type CaptureItem,
} from '@/shared/cloud/sync'

interface PendingConversion {
  captureId: string
  kind: CaptureConvertedKind
  cardId: string
  queuedAt: number
  attempts: number
  lastError?: string
}

function readConversionQueue(): PendingConversion[] {
  try {
    const rows = JSON.parse(globalThis.localStorage?.getItem(LOCAL_KEYS.INBOX_CONVERSION_QUEUE) || '[]') as PendingConversion[]
    return Array.isArray(rows) ? rows.filter(row => row?.captureId && row.cardId && row.kind) : []
  } catch { return [] }
}

function writeConversionQueue(rows: PendingConversion[]): void {
  try {
    if (rows.length) globalThis.localStorage?.setItem(LOCAL_KEYS.INBOX_CONVERSION_QUEUE, JSON.stringify(rows))
    else globalThis.localStorage?.removeItem(LOCAL_KEYS.INBOX_CONVERSION_QUEUE)
  } catch { /* 隐私模式下仍保留本轮内存状态 */ }
}

function enqueueConversion(captureId: string, kind: CaptureConvertedKind, cardId: string, error?: unknown): void {
  const rows = readConversionQueue()
  const current = rows.find(row => row.captureId === captureId)
  if (current) {
    current.kind = kind
    current.cardId = cardId
    current.attempts += 1
    current.lastError = error instanceof Error ? error.message : error ? String(error) : current.lastError
  } else {
    rows.push({
      captureId,
      kind,
      cardId,
      queuedAt: Date.now(),
      attempts: 0,
      lastError: error instanceof Error ? error.message : error ? String(error) : undefined,
    })
  }
  writeConversionQueue(rows)
}

function removeQueuedConversion(captureId: string): void {
  writeConversionQueue(readConversionQueue().filter(row => row.captureId !== captureId))
}

function readCache(): CaptureItem[] {
  try {
    const rows = JSON.parse(globalThis.localStorage?.getItem(LOCAL_KEYS.INBOX_CACHE) || '[]') as CaptureItem[]
    return Array.isArray(rows) ? rows.filter(row => !!row?.id).slice(0, 500) : []
  } catch { return [] }
}

function writeCache(rows: CaptureItem[]): void {
  try { globalThis.localStorage?.setItem(LOCAL_KEYS.INBOX_CACHE, JSON.stringify(rows.slice(0, 500))) } catch { /* 隐私模式仍可用云端 */ }
}

const items = ref<CaptureItem[]>(readCache())
const loading = ref(false)
const connected = ref(false)
const error = ref('')
const loadedOnce = ref(false)
let refreshPromise: Promise<void> | null = null
let retryPromise: Promise<number> | null = null

function firstLine(capture: CaptureItem): string {
  const raw = capture.title?.trim() || capture.text?.trim() || capture.url?.trim() || '未命名采集'
  return raw.split(/\r?\n/).find(Boolean)?.slice(0, 120) || '未命名采集'
}

function captureDescription(capture: CaptureItem): string {
  return [capture.text?.trim(), capture.note?.trim(), capture.url?.trim()].filter(Boolean).join('\n\n')
}

function existingCardFor(captureId: string):
  | { kind: CaptureConvertedKind; id: string }
  | null {
  const store = useAppStore()
  const data = store.data
  if (!data) return null
  const task = data.tasks.find(card => card.sourceCaptureId === captureId && !card.deletedAt)
  if (task) return { kind: 'task', id: task.id }
  const curiosity = data.curiosities.find(card => card.sourceCaptureId === captureId && !card.deletedAt)
  if (curiosity) return { kind: 'curiosity', id: curiosity.id }
  const resource = data.resources.find(card => card.sourceCaptureId === captureId && !card.deletedAt)
  if (resource) return { kind: 'resource', id: resource.id }
  return null
}

function decorate(capture: CaptureItem): CaptureItem {
  if (capture.convertedKind) return capture
  const local = existingCardFor(capture.id)
  if (!local) return capture
  return { ...capture, convertedKind: local.kind, convertedCardId: local.id, convertedAt: Date.now() }
}

async function retryPendingConversions(): Promise<number> {
  if (retryPromise) return retryPromise
  const queue = readConversionQueue()
  if (!queue.length) return 0
  const meta = await getCloudMeta()
  if (!meta?.refreshToken) return 0
  retryPromise = (async () => {
    let done = 0
    const failed: PendingConversion[] = []
    for (const row of queue) {
      try {
        await convertCapture(row.captureId, row.kind, row.cardId)
        done++
        removeQueuedConversion(row.captureId)
      } catch (error) {
        failed.push({
          ...row,
          attempts: row.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
        })
      }
    }
    writeConversionQueue(failed)
    return done
  })()
  try {
    return await retryPromise
  } finally {
    retryPromise = null
  }
}

async function refresh(force = false): Promise<void> {
  if (refreshPromise) return refreshPromise
  if (loadedOnce.value && !force) return
  refreshPromise = (async () => {
    loading.value = true
    error.value = ''
    try {
      const meta = await getCloudMeta()
      connected.value = !!meta?.refreshToken
      if (connected.value) await retryPendingConversions()
      const rows = connected.value ? await listCaptures() : readCache()
      items.value = rows.map(item => {
        const decorated = decorate(item)
        if (!item.convertedKind && decorated.convertedKind && decorated.convertedCardId) {
          enqueueConversion(item.id, decorated.convertedKind, decorated.convertedCardId, new Error('等待补写转化状态'))
        }
        return decorated
      })
      writeCache(items.value)
      if (connected.value) await retryPendingConversions()
      loadedOnce.value = true
    } catch (err) {
      if (!items.value.length) items.value = readCache()
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
      refreshPromise = null
    }
  })()
  return refreshPromise
}

async function convert(item: CaptureItem, kind: CaptureConvertedKind): Promise<{ kind: CaptureConvertedKind; id: string }> {
  const store = useAppStore()
  const data = store.data
  if (!data) throw new Error('数据尚未加载')
  const existing = existingCardFor(item.id)
  if (existing) {
    items.value = items.value.map(row => row.id === item.id
      ? { ...row, convertedKind: existing.kind, convertedCardId: existing.id, convertedAt: row.convertedAt || Date.now() }
      : row)
    writeCache(items.value)
    enqueueConversion(item.id, existing.kind, existing.id, new Error('等待补写转化状态'))
    try {
      await convertCapture(item.id, existing.kind, existing.id)
      removeQueuedConversion(item.id)
    } catch (err) {
      error.value = `卡片已在本机生成，转化状态待同步：${err instanceof Error ? err.message : String(err)}`
    }
    return existing
  }
  if (item.convertedKind) throw new Error('这条采集已经转化，不能再次转化')

  const now = Date.now()
  const title = firstLine(item)
  const description = captureDescription(item)
  const base = {
    id: '',
    description,
    tags: [...(item.tags || [])],
    customFields: { captureInboxId: item.id },
    createdAt: now,
    updatedAt: now,
    sourceCaptureId: item.id,
  }
  let cardId = ''
  if (kind === 'task') {
    const card: TaskCard = {
      ...base,
      id: uid('task'),
      kind: 'task',
      title,
      status: 'todo',
      priority: 'medium',
      link: item.url,
      callCount: 0,
    }
    data.tasks.push(card)
    cardId = card.id
  } else if (kind === 'curiosity') {
    const card: CuriosityCard = {
      ...base,
      id: uid('curio'),
      kind: 'curiosity',
      question: title,
      sourceUrl: item.url,
      sourceTitle: item.title,
      status: 'todo',
      pinned: false,
      callCount: 0,
    }
    data.curiosities.push(card)
    cardId = card.id
  } else {
    const card: ResourceCard = {
      ...base,
      id: uid('res'),
      kind: 'resource',
      title,
      linkType: 'url',
      link: item.url || '',
      workspaceId: CURATION_WS_ID,
      categoryId: '',
      tags: [...(item.tags || [])],
      pinned: false,
      callCount: 0,
    }
    data.resources.push(card)
    cardId = card.id
  }
  store.persist()
  items.value = items.value.map(row => row.id === item.id
    ? { ...row, convertedKind: kind, convertedCardId: cardId, convertedAt: now }
    : row)
  writeCache(items.value)
  try {
    await convertCapture(item.id, kind, cardId)
  } catch (err) {
    enqueueConversion(item.id, kind, cardId, err)
    error.value = `卡片已在本机生成，转化状态待同步：${err instanceof Error ? err.message : String(err)}`
  }
  return { kind, id: cardId }
}

async function dismiss(item: CaptureItem): Promise<void> {
  await dismissCapture(item.id)
  items.value = items.value.filter(row => row.id !== item.id)
  writeCache(items.value)
}

async function restore(item: CaptureItem): Promise<void> {
  await restoreCapture(item.id)
  if (!items.value.some(row => row.id === item.id)) items.value = [item, ...items.value]
  writeCache(items.value)
}

const untransformedCount = computed(() => items.value.filter(item => !item.convertedKind).length)
const sortedItems = computed(() => items.value)

export function useInbox() {
  return {
    items,
    sortedItems,
    loading,
    connected,
    error,
    untransformedCount,
    refresh,
    convert,
    dismiss,
    restore,
    existingCardFor,
    retryPendingConversions,
  }
}
