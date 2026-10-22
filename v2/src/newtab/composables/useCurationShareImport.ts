/**
 * 策展成果 HTML 回导：新建一台，或按「节点路径 + 标题」合并进当前台。
 *
 * 两道闸保证不会留下半套数据：
 * 1. 先解析并校验完整快照，再在内存里构建计划；
 * 2. 全部计划可执行后才写入 AppData，最后统一 persist。
 */
import { computed, ref, type ComputedRef } from 'vue'
import { showToast } from '@/shared/components/toast'
import { uid } from '@/shared/utils'
import { CURATION_WS_ID, type AppData, type Category, type ResourceCard, type Workspace } from '@/shared/models'
import { wsDisplayNameOf, wsNameWithIcon } from '@/shared/utils/wsName'
import {
  parseCurationShareHtml,
  snapshotNodeCount,
  type CurationImportNode,
  type CurationShareCard,
  type CurationShareSnapshot,
} from '@/shared/utils/curationShareData'

export type CurationImportMode = 'new' | 'merge'

export interface CurationShareImportCtx {
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  persist: () => void
  navigate: (workspaceId: string) => void
}

interface PendingImport {
  snapshot: CurationShareSnapshot
  filename: string
  nodeCount: number
  cardCount: number
}

function uniqueWorkspaceName(d: AppData, raw: string): string {
  const base = wsDisplayNameOf({ name: raw, icon: '' }).trim() || '导入的策展台'
  const names = new Set(d.workspaces.filter(w => !w.archived).map(w => wsDisplayNameOf(w).trim()))
  if (!names.has(base)) return base
  let i = 2
  while (names.has(`${base}（${i}）`)) i++
  return `${base}（${i}）`
}

function sameNode(existing: Category[], workspaceId: string, parentId: string | undefined, name: string, used: Set<string>): Category | undefined {
  return existing.find(c =>
    c.workspaceId === workspaceId
    && !c.deletedAt
    && !used.has(c.id)
    && (c.parentId || '') === (parentId || '')
    && (c.name || '').trim() === name.trim()
  )
}

function uniqueNodeName(existing: Category[], workspaceId: string, parentId: string | undefined, raw: string): string {
  const base = raw.trim() || '未命名分支'
  const siblings = existing.filter(c =>
    c.workspaceId === workspaceId
    && !c.deletedAt
    && (c.parentId || '') === (parentId || '')
  )
  if (!siblings.some(c => c.name.trim() === base)) return base
  let i = 2
  while (siblings.some(c => c.name.trim() === `${base}（${i}）`)) i++
  return `${base}（${i}）`
}

function createPoolCard(raw: CurationShareCard, now: number): ResourceCard {
  return {
    id: uid('res'),
    kind: 'resource',
    title: raw.title.slice(0, 120),
    linkType: 'url',
    link: raw.url || '',
    workspaceId: CURATION_WS_ID,
    categoryId: '',
    description: raw.description,
    sourceType: raw.sourceType as ResourceCard['sourceType'],
    tags: [...(raw.tags || [])],
    customFields: {},
    pinned: false,
    callCount: 0,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

function findPoolCard(d: AppData, raw: CurationShareCard): ResourceCard | undefined {
  if (!raw.url) return undefined
  return d.resources.find(r =>
    !r.deletedAt
    && r.workspaceId === CURATION_WS_ID
    && r.link === raw.url
  )
}

/** 同一张池卡可以投射到多个台；同一台内则复用一条投射，并更新到目标节点。 */
function ensureProjection(d: AppData, cardId: string, workspaceId: string, categoryId: string): boolean {
  d.curationProjections = d.curationProjections || []
  const existed = d.curationProjections.find(p =>
    p.kind === 'card' && p.cardId === cardId && p.targetWsId === workspaceId
  )
  if (existed) {
    if ((existed.targetCatId || '') === categoryId) return false
    existed.targetCatId = categoryId || undefined
    existed.addedAt = Date.now()
    return true
  }
  d.curationProjections.push({
    id: uid('curp'),
    kind: 'card',
    wsId: CURATION_WS_ID,
    cardId,
    targetWsId: workspaceId,
    targetCatId: categoryId,
    addedAt: Date.now(),
  })
  return true
}

function projectionExists(d: AppData, cardId: string, workspaceId: string, categoryId: string): boolean {
  return !!d.curationProjections?.some(p =>
    p.kind === 'card'
    && p.cardId === cardId
    && p.targetWsId === workspaceId
    && (p.targetCatId || '') === (categoryId || '')
  )
}

export function useCurationShareImport(ctx: CurationShareImportCtx) {
  const { d, workspaceId, persist, navigate } = ctx
  const input = ref<HTMLInputElement | null>(null)
  const pending = ref<PendingImport | null>(null)
  const error = ref('')

  function open(): void {
    error.value = ''
    input.value?.click()
  }

  async function onFile(event: Event): Promise<void> {
    const el = event.target as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (!file) return
    try {
      const snapshot = parseCurationShareHtml(await file.text())
      pending.value = {
        snapshot,
        filename: file.name,
        nodeCount: snapshotNodeCount(snapshot.nodes),
        cardCount: (() => {
          const count = (nodes: CurationImportNode[]): number =>
            nodes.reduce((sum, node) => sum + node.cards.length + count(node.children), 0)
          return count(snapshot.nodes)
        })(),
      }
      error.value = ''
    } catch (e) {
      pending.value = null
      error.value = (e as Error).message || '文件解析失败'
      showToast('✗ ' + error.value)
    }
  }

  function closePending(): void {
    pending.value = null
    error.value = ''
  }

  function importNew(): string | null {
    const plan = pending.value
    if (!plan) return null
    const snap = plan.snapshot
    const now = Date.now()
    const displayName = uniqueWorkspaceName(d.value, snap.workspaceName || snap.thesis.title)
    const ws: Workspace = {
      id: uid('ws'),
      name: wsNameWithIcon('📚', displayName),
      icon: '📚',
      color: '#3A6B4C',
      coverTheme: 'deep-sea',
      desc: '从知源策展成果 HTML 导入',
      order: d.value.workspaces.length,
      archived: false,
      kind: 'curation',
    }
    d.value.workspaces.push(ws)

    const thesis: ResourceCard = {
      id: uid('res'),
      kind: 'resource',
      title: snap.thesis.title.slice(0, 120),
      linkType: 'url',
      link: '',
      workspaceId: ws.id,
      categoryId: '',
      description: snap.thesis.description,
      tags: [],
      customFields: {},
      pinned: false,
      callCount: 0,
      importedAt: now,
      createdAt: now,
      updatedAt: now,
      isThesis: true,
    }
    d.value.resources.push(thesis)

    const walk = (nodes: CurationImportNode[], parentId?: string): void => {
      nodes.forEach((node, order) => {
        const cat: Category = {
          id: uid('cat'),
          workspaceId: ws.id,
          name: node.name,
          description: node.description,
          order,
          ...(parentId ? { parentId } : {}),
        }
        d.value.categories.push(cat)
        for (const raw of node.cards) {
          const pool = findPoolCard(d.value, raw)
          if (pool) {
            ensureProjection(d.value, pool.id, ws.id, cat.id)
          } else {
            const card = createPoolCard(raw, now)
            d.value.resources.push(card)
            ensureProjection(d.value, card.id, ws.id, cat.id)
          }
        }
        walk(node.children, cat.id)
      })
    }
    walk(snap.nodes)
    persist()
    closePending()
    showToast(`✓ 已新建策展台「${displayName}」 · ${plan.nodeCount} 个节点 · ${plan.cardCount} 张资源`)
    navigate(ws.id)
    return ws.id
  }

  function importMerge(): string | null {
    const plan = pending.value
    if (!plan) return null
    const snap = plan.snapshot
    const wsId = workspaceId.value
    if (!d.value.workspaces.some(w => w.id === wsId)) {
      showToast('⚠ 当前策展台不存在，无法合并')
      return null
    }
    const now = Date.now()
    const used = new Set<string>()
    const result = { nodes: 0, cards: 0, merged: 0 }

    // 当前台没有中心论点时采用成果里的 L1；已有则保留用户当前判断，不悄悄覆盖。
    let thesis = d.value.resources.find(r => !r.deletedAt && r.workspaceId === wsId && r.isThesis)
    if (!thesis) {
      thesis = {
        id: uid('res'),
        kind: 'resource',
        title: snap.thesis.title.slice(0, 120),
        linkType: 'url',
        link: '',
        workspaceId: wsId,
        categoryId: '',
        description: snap.thesis.description,
        tags: [],
        customFields: {},
        pinned: false,
        callCount: 0,
        importedAt: now,
        createdAt: now,
        updatedAt: now,
        isThesis: true,
      }
      d.value.resources.push(thesis)
      result.merged++
    }

    const walk = (nodes: CurationImportNode[], parentId?: string): void => {
      nodes.forEach((node, order) => {
        let cat = sameNode(d.value.categories, wsId, parentId, node.name, used)
        if (cat) {
          if (node.description && cat.description !== node.description) {
            cat.description = node.description
            cat.order = order
            result.merged++
          }
        } else {
          cat = {
            id: uid('cat'),
            workspaceId: wsId,
            name: uniqueNodeName(d.value.categories, wsId, parentId, node.name),
            description: node.description,
            order,
            ...(parentId ? { parentId } : {}),
          }
          d.value.categories.push(cat)
          result.nodes++
        }
        used.add(cat.id)
        for (const raw of node.cards) {
          const existingBoardCard = d.value.resources.find(r =>
            !r.deletedAt
            && r.workspaceId === wsId
            && (r.categoryId || '') === cat.id
            && r.title.trim() === raw.title.trim()
            && (r.link || '') === (raw.url || '')
          )
          if (existingBoardCard) continue
          const pool = findPoolCard(d.value, raw)
          if (pool) {
            if (projectionExists(d.value, pool.id, wsId, cat.id)) continue
            if (ensureProjection(d.value, pool.id, wsId, cat.id)) result.cards++
          } else {
            const card = createPoolCard(raw, now)
            d.value.resources.push(card)
            ensureProjection(d.value, card.id, wsId, cat.id)
            result.cards++
          }
        }
        walk(node.children, cat.id)
      })
    }
    walk(snap.nodes)
    persist()
    closePending()
    showToast(`✓ 已合并到当前策展台 · 新增 ${result.nodes} 个节点 · ${result.cards} 张资源${result.merged ? ` · 更新 ${result.merged} 处` : ''}`)
    return wsId
  }

  const preview = computed(() => pending.value)

  return {
    shareImportInput: input,
    shareImportPending: preview,
    shareImportError: error,
    openShareHtmlImport: open,
    handleShareHtmlFile: onFile,
    closeShareHtmlImport: closePending,
    confirmNewShareImport: importNew,
    confirmMergeShareImport: importMerge,
  }
}
