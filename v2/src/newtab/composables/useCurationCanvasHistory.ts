import { computed, ref, type ComputedRef } from 'vue'
import type { AppData, AssetMeta, Category, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'

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
  categoryIds: string[]
}

interface HistoryEntry {
  label: string
  snapshot: CanvasSnapshot
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
  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])
  const historyRevision = ref(0)
  const stacksByWorkspace = new Map<string, { undo: HistoryEntry[]; redo: HistoryEntry[] }>()
  let activeWorkspaceId = ctx.workspaceId.value
  const undoLabel = computed(() => undoStack.value.at(-1)?.label || '')
  const redoLabel = computed(() => redoStack.value.at(-1)?.label || '')
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

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
    return { categories, resources, categoryIds }
  }

  function same(a: CanvasSnapshot, b: CanvasSnapshot): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  function pushUndo(entry: HistoryEntry): void {
    undoStack.value = [...undoStack.value, entry].slice(-HISTORY_LIMIT)
    redoStack.value = []
    historyRevision.value++
  }

  function saveActiveStacks(): void {
    stacksByWorkspace.set(activeWorkspaceId, {
      undo: undoStack.value,
      redo: redoStack.value,
    })
  }

  /** 同一会话切换策展台再返回时保留各自历史；刷新/关页仍由模块生命周期清空。 */
  function switchWorkspace(id: string): void {
    if (id === activeWorkspaceId) return
    saveActiveStacks()
    activeWorkspaceId = id
    const saved = stacksByWorkspace.get(id)
    undoStack.value = saved?.undo || []
    redoStack.value = saved?.redo || []
    historyRevision.value++
  }

  function restore(snapshot: CanvasSnapshot): void {
    const data = ctx.d.value
    const replaceIds = new Set([
      ...data.categories.filter(c => c.workspaceId === ctx.workspaceId.value).map(c => c.id),
      ...snapshot.categoryIds,
    ])
    data.categories = data.categories.filter(c => !replaceIds.has(c.id))
    data.categories.push(...clone(snapshot.categories))

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
    if (!same(before, after)) pushUndo({ label, snapshot: before })
    return result
  }

  async function recordAsync<T>(label: string, action: () => Promise<T>): Promise<T> {
    const before = capture()
    const result = await action()
    const after = capture()
    if (!same(before, after)) pushUndo({ label, snapshot: before })
    return result
  }

  function undo(): void {
    const entry = undoStack.value.at(-1)
    if (!entry) return
    const current = capture()
    restore(entry.snapshot)
    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, { label: entry.label, snapshot: current }].slice(-HISTORY_LIMIT)
    historyRevision.value++
    showToast(`已撤销：${entry.label}`)
  }

  function redo(): void {
    const entry = redoStack.value.at(-1)
    if (!entry) return
    const current = capture()
    restore(entry.snapshot)
    redoStack.value = redoStack.value.slice(0, -1)
    undoStack.value = [...undoStack.value, { label: entry.label, snapshot: current }].slice(-HISTORY_LIMIT)
    historyRevision.value++
    showToast(`已重做：${entry.label}`)
  }

  /** 删除单个策展台时只丢掉该台历史，不影响其他台仍在会话中的撤销栈。 */
  function resetWorkspace(id = activeWorkspaceId): void {
    stacksByWorkspace.delete(id)
    if (id !== activeWorkspaceId) return
    undoStack.value = []
    redoStack.value = []
    historyRevision.value++
  }

  /** 云端整树恢复会替换所有策展台，必须同时清空全部会话历史。 */
  function resetAll(): void {
    stacksByWorkspace.clear()
    undoStack.value = []
    redoStack.value = []
    historyRevision.value++
  }

  function reset(): void {
    resetWorkspace(activeWorkspaceId)
  }

  /** 附件本体只在当前树和两个历史栈都不再引用时才允许物理清理。 */
  function assetIdsInHistory(): Set<string> {
    const ids = new Set<string>()
    const entries = [
      ...undoStack.value,
      ...redoStack.value,
      ...[...stacksByWorkspace.values()].flatMap(stacks => [...stacks.undo, ...stacks.redo]),
    ]
    for (const entry of entries) {
      for (const category of entry.snapshot.categories) {
        for (const asset of category.assets || []) ids.add(asset.id)
      }
      for (const resource of entry.snapshot.resources) {
        for (const asset of resource.assets || []) ids.add(asset.id)
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
    historyRevision,
    switchWorkspace,
    record,
    recordAsync,
    undo,
    redo,
    reset,
    resetWorkspace,
    resetAll,
    hasAssetReference,
  }
}
