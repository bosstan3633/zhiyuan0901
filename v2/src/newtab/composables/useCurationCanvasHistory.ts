import { computed, ref, type ComputedRef } from 'vue'
import type { AppData, AssetMeta, Category, CurationProjection, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import { uid } from '@/shared/utils'

const HISTORY_LIMIT = 10

interface ResourcePatch {
  id: string
  categoryId?: string
  title: string
  description?: string
  assets?: AssetMeta[]
  updatedAt: number
  isThesis?: boolean
}

interface CanvasSnapshot {
  categories: Category[]
  resources: ResourcePatch[]
  projections: CurationProjection[]
  categoryIds: string[]
}

export interface CurationHistoryEntry {
  id: string
  label: string
  timestamp: number
  before: CanvasSnapshot
  after: CanvasSnapshot
}

interface WorkspaceTimeline {
  entries: CurationHistoryEntry[]
  cursor: number
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function patchOf(card: ResourceCard): ResourcePatch {
  return {
    id: card.id,
    categoryId: card.categoryId,
    title: card.title,
    description: card.description,
    assets: clone(card.assets || []),
    updatedAt: card.updatedAt,
    isThesis: card.isThesis,
  }
}

export function useCurationCanvasHistory(ctx: {
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  thesisCard: ComputedRef<ResourceCard | null>
  persist: () => void
}) {
  const entries = ref<CurationHistoryEntry[]>([])
  const cursor = ref(-1)
  const historyRevision = ref(0)
  const timelinesByWorkspace = new Map<string, WorkspaceTimeline>()
  let activeWorkspaceId = ctx.workspaceId.value

  const historyEntries = computed(() => [...entries.value].reverse())
  const currentHistoryId = computed(() => entries.value[cursor.value]?.id || '')
  const canUndo = computed(() => cursor.value >= 0)
  const canRedo = computed(() => cursor.value < entries.value.length - 1)
  const undoLabel = computed(() => entries.value[cursor.value]?.label || '')
  const redoLabel = computed(() => entries.value[cursor.value + 1]?.label || '')

  function capture(): CanvasSnapshot {
    const categories = ctx.d.value.categories
      .filter(c => c.workspaceId === ctx.workspaceId.value)
      .map(c => clone(c))
    const categoryIds = categories.map(c => c.id)
    const categorySet = new Set(categoryIds)
    const thesisId = ctx.thesisCard.value?.id || ''
    const resources = ctx.d.value.resources
      .filter(r => r.workspaceId === ctx.workspaceId.value || r.id === thesisId || (!!r.categoryId && categorySet.has(r.categoryId)))
      .map(patchOf)
    const projections = (ctx.d.value.curationProjections || [])
      .filter(projection => projection.targetWsId === ctx.workspaceId.value)
      .map(projection => clone(projection))
    return { categories, resources, projections, categoryIds }
  }

  function same(a: CanvasSnapshot, b: CanvasSnapshot): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  function pushEntry(label: string, before: CanvasSnapshot, after: CanvasSnapshot): CurationHistoryEntry {
    // 新动作之后的 redo 分支失效；时间线始终只保留当前会话最近 10 步。
    const next = entries.value.slice(0, cursor.value + 1)
    const entry: CurationHistoryEntry = {
      id: uid('hist'),
      label,
      timestamp: Date.now(),
      before: clone(before),
      after: clone(after),
    }
    entries.value = [...next, entry].slice(-HISTORY_LIMIT)
    cursor.value = entries.value.length - 1
    historyRevision.value++
    return entry
  }

  function saveActiveTimeline(): void {
    timelinesByWorkspace.set(activeWorkspaceId, {
      entries: entries.value,
      cursor: cursor.value,
    })
  }

  /** 同一会话切换策展台再返回时保留各自历史；刷新/关页仍由模块生命周期清空。 */
  function switchWorkspace(id: string): void {
    if (id === activeWorkspaceId) return
    saveActiveTimeline()
    activeWorkspaceId = id
    const saved = timelinesByWorkspace.get(id)
    entries.value = saved?.entries || []
    cursor.value = saved?.cursor ?? -1
    historyRevision.value++
  }

  function restoreSnapshot(snapshot: CanvasSnapshot): void {
    const data = ctx.d.value
    const replaceIds = new Set([
      ...data.categories.filter(c => c.workspaceId === ctx.workspaceId.value).map(c => c.id),
      ...snapshot.categoryIds,
    ])
    data.categories = data.categories.filter(c => !replaceIds.has(c.id))
    data.categories.push(...clone(snapshot.categories))
    data.curationProjections = [
      ...(data.curationProjections || []).filter(projection => projection.targetWsId !== ctx.workspaceId.value),
      ...clone(snapshot.projections),
    ]

    const patchById = new Map(snapshot.resources.map(row => [row.id, row]))
    const relatedIds = new Set(snapshot.categoryIds)
    for (const card of data.resources) {
      if ((card.workspaceId === ctx.workspaceId.value || (!!card.categoryId && relatedIds.has(card.categoryId)))
        && !patchById.has(card.id)) {
        card.categoryId = ''
      }
    }
    for (const [id, patch] of patchById) {
      const card = data.resources.find(r => r.id === id)
      if (!card) continue
      card.categoryId = patch.categoryId
      card.title = patch.title
      card.description = patch.description
      card.assets = clone(patch.assets || [])
      card.updatedAt = patch.updatedAt
      card.isThesis = patch.isThesis
    }
    ctx.persist()
  }

  function record<T>(label: string, action: () => T): T {
    const before = capture()
    const result = action()
    const after = capture()
    if (!same(before, after)) pushEntry(label, before, after)
    return result
  }

  async function recordAsync<T>(label: string, action: () => Promise<T>): Promise<T> {
    const before = capture()
    const result = await action()
    const after = capture()
    if (!same(before, after)) pushEntry(label, before, after)
    return result
  }

  function undo(): void {
    const entry = entries.value[cursor.value]
    if (!entry) return
    restoreSnapshot(entry.before)
    cursor.value -= 1
    historyRevision.value++
    showToast(`已撤销：${entry.label}`)
  }

  function redo(): void {
    const entry = entries.value[cursor.value + 1]
    if (!entry) return
    restoreSnapshot(entry.after)
    cursor.value += 1
    historyRevision.value++
    showToast(`已重做：${entry.label}`)
  }

  /** 回滚本身也作为一条新操作进入时间线，避免回滚后无法再撤销。 */
  function rollbackTo(id: string): boolean {
    const targetIndex = entries.value.findIndex(entry => entry.id === id)
    if (targetIndex < 0) return false
    const target = entries.value[targetIndex]
    const before = capture()
    const after = clone(target.after)
    if (same(before, after)) {
      showToast('当前画布已经处于该状态')
      return false
    }
    restoreSnapshot(after)
    pushEntry(`回滚至：${target.label}`, before, after)
    showToast(`已回滚至「${target.label}」之后的状态`)
    return true
  }

  /** 删除单个策展台时只丢掉该台历史，不影响其他台仍在会话中的时间线。 */
  function resetWorkspace(id = activeWorkspaceId): void {
    timelinesByWorkspace.delete(id)
    if (id !== activeWorkspaceId) return
    entries.value = []
    cursor.value = -1
    historyRevision.value++
  }

  /** 云端整树恢复会替换所有策展台，必须同时清空全部会话历史。 */
  function resetAll(): void {
    timelinesByWorkspace.clear()
    entries.value = []
    cursor.value = -1
    historyRevision.value++
  }

  function reset(): void {
    resetWorkspace(activeWorkspaceId)
  }

  function collectSnapshotAssetIds(snapshot: CanvasSnapshot, ids: Set<string>): void {
    for (const category of snapshot.categories) {
      for (const asset of category.assets || []) ids.add(asset.id)
    }
    for (const resource of snapshot.resources) {
      for (const asset of resource.assets || []) ids.add(asset.id)
    }
  }

  /** 附件本体只在当前树和全部历史前后快照都不再引用时才允许物理清理。 */
  function assetIdsInHistory(): Set<string> {
    const ids = new Set<string>()
    const allTimelines = [
      ...timelinesByWorkspace.values(),
      { entries: entries.value, cursor: cursor.value },
    ]
    for (const timeline of allTimelines) {
      for (const entry of timeline.entries) {
        collectSnapshotAssetIds(entry.before, ids)
        collectSnapshotAssetIds(entry.after, ids)
      }
    }
    return ids
  }

  function hasAssetReference(id: string): boolean {
    return assetIdsInHistory().has(id)
  }

  return {
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    historyEntries,
    currentHistoryId,
    historyRevision,
    switchWorkspace,
    record,
    recordAsync,
    undo,
    redo,
    rollbackTo,
    reset,
    resetWorkspace,
    resetAll,
    hasAssetReference,
  }
}
