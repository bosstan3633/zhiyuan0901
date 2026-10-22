/**
 * 策展成果的数据契约：分享 HTML 内嵌一份可解析快照，供另一台知源无损回导。
 *
 * 设计边界：
 * - 只带成果本身：标题 / 说明 / L2–L4 层级顺序 / 公开网址 / 来源；不带附件 Blob、内部 ID 或账号。
 * - 资源以「节点路径 + 标题 + 公开 URL」定位，回导时可复用已有资源卡，避免每次分享都复制一批重复卡。
 * - 快照放在 `<script type="application/json">` 中，不执行、不参与页面渲染。
 */
import type { Category, ResourceCard } from '@/shared/models'

export const CURATION_SHARE_SCHEMA = 'zhiyuan.curation.share'
export const CURATION_SHARE_VERSION = 1

export interface CurationShareCard {
  title: string
  description?: string
  url?: string
  sourceType?: string
  tags?: string[]
}

export interface CurationShareNode {
  name: string
  description?: string
  children: CurationShareNode[]
  cards: CurationShareCard[]
}

export interface CurationShareSnapshot {
  schema: typeof CURATION_SHARE_SCHEMA
  version: typeof CURATION_SHARE_VERSION
  workspaceName: string
  thesis: { title: string; description?: string }
  layout: 'pyramid' | 'tree'
  nodes: CurationShareNode[]
  generatedAt: number
}

export interface CurationImportNode {
  name: string
  description?: string
  cards: CurationShareCard[]
  children: CurationImportNode[]
}

/**
 * 画布、分享预览、HTML 与长图共用的规范化树。
 * 内部 id 只在本次渲染内使用，不进入分享快照。
 */
export interface CurationRenderCard {
  id: string
  title: string
  description?: string
  url?: string
  sourceType?: string
  tags: string[]
  assets: Array<{
    name: string
    kind: string
    size: number
  }>
}

export interface CurationRenderNode {
  id: string
  path: string
  title: string
  description?: string
  level: number
  cards: CurationRenderCard[]
  children: CurationRenderNode[]
}

export interface CurationRenderTree {
  roots: CurationRenderNode[]
  flat: CurationRenderNode[]
  nodeCount: number
  cardCount: number
  attachmentCount: number
  maxLevel: number
}

export const CURATION_RENDER_LIMITS = {
  nodes: 5000,
  cards: 5000,
  maxLevel: 4,
  maxLogicalWidth: 20000,
  maxLogicalHeight: 30000,
  maxPixelArea: 40_000_000,
} as const

function safeUrl(value?: string): string {
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

export function assertCurationRenderLimits(tree: Pick<CurationRenderTree, 'nodeCount' | 'cardCount' | 'maxLevel'>): void {
  if (tree.nodeCount > CURATION_RENDER_LIMITS.nodes) {
    throw new Error(`策展节点 ${tree.nodeCount} 个，超过 ${CURATION_RENDER_LIMITS.nodes} 个导出上限`)
  }
  if (tree.cardCount > CURATION_RENDER_LIMITS.cards) {
    throw new Error(`策展资源 ${tree.cardCount} 张，超过 ${CURATION_RENDER_LIMITS.cards} 张导出上限`)
  }
  if (tree.maxLevel > CURATION_RENDER_LIMITS.maxLevel) {
    throw new Error(`策展层级到 L${tree.maxLevel}，超过 L${CURATION_RENDER_LIMITS.maxLevel} 上限`)
  }
}

/**
 * 唯一层级构建器：所有消费方都从这里拿节点、层级、排序与挂卡结果。
 * 只读输入，不修改 Category / ResourceCard。
 */
export function buildCurationRenderTree(input: {
  nodes: Category[]
  cards: ResourceCard[]
  thesis?: ResourceCard | null
}): CurationRenderTree {
  const byParent = new Map<string, Category[]>()
  const seenCat = new Set<string>()
  for (const node of input.nodes) {
    if (!node || seenCat.has(node.id)) continue
    seenCat.add(node.id)
    const key = node.parentId || ''
    const arr = byParent.get(key)
    if (arr) arr.push(node)
    else byParent.set(key, [node])
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

  const cardsByCat = new Map<string, ResourceCard[]>()
  for (const card of input.cards) {
    if (!card || card.isThesis || !card.categoryId) continue
    const arr = cardsByCat.get(card.categoryId)
    if (arr) arr.push(card)
    else cardsByCat.set(card.categoryId, [card])
  }

  const flat: CurationRenderNode[] = []
  const visiting = new Set<string>()
  const walk = (node: Category, level: number, parentPath: string): CurationRenderNode => {
    const path = parentPath ? `${parentPath}/${node.name || '未命名分支'}` : (node.name || '未命名分支')
    if (visiting.has(node.id)) {
      return { id: node.id, path, title: node.name || '未命名分支', level, cards: [], children: [] }
    }
    visiting.add(node.id)
    const cards = (cardsByCat.get(node.id) || []).map(card => ({
      id: card.id,
      title: card.title || '（无标题资源）',
      description: card.description || undefined,
      url: safeUrl(card.link) || undefined,
      sourceType: card.sourceType,
      tags: (card.tags || []).slice(0, 8),
      assets: (card.assets || []).map(asset => ({
        name: asset.name || '',
        kind: asset.kind || '',
        size: asset.size || 0,
      })),
    }))
    const out: CurationRenderNode = {
      id: node.id,
      path,
      title: node.name || '未命名分支',
      description: node.description || undefined,
      level,
      cards,
      children: [],
    }
    flat.push(out)
    out.children = (byParent.get(node.id) || []).map(child => walk(child, level + 1, path))
    visiting.delete(node.id)
    return out
  }

  const roots = (byParent.get('') || []).map(node => walk(node, 2, ''))
  const nodeCount = flat.length
  const cardCount = flat.reduce((n, node) => n + node.cards.length, 0)
  const attachmentCount = flat.reduce((n, node) => n + node.cards.reduce((m, c) => m + c.assets.length, 0), 0)
  const maxLevel = flat.reduce((n, node) => Math.max(n, node.level), input.thesis ? 1 : 0)
  const tree = { roots, flat, nodeCount, cardCount, attachmentCount, maxLevel }
  assertCurationRenderLimits(tree)
  return tree
}

export function buildCurationSnapshot(input: {
  workspaceName: string
  thesis: ResourceCard | null
  nodes: Category[]
  cards: ResourceCard[]
  layout: 'pyramid' | 'tree'
  generatedAt?: number
}): CurationShareSnapshot {
  const tree = buildCurationRenderTree({ nodes: input.nodes, cards: input.cards, thesis: input.thesis })
  const walk = (node: CurationRenderNode): CurationShareNode => ({
    name: node.title,
    description: node.description || undefined,
    children: node.children.map(walk),
    cards: node.cards.map(c => ({
      title: c.title,
      description: c.description,
      url: c.url,
      sourceType: c.sourceType,
      tags: c.tags,
    })),
  })
  return {
    schema: CURATION_SHARE_SCHEMA,
    version: CURATION_SHARE_VERSION,
    workspaceName: input.workspaceName,
    thesis: {
      title: input.thesis?.title || `${input.workspaceName} · 策展成果`,
      description: input.thesis?.description || undefined,
    },
    layout: input.layout,
    nodes: tree.roots.map(walk),
    generatedAt: input.generatedAt || Date.now(),
  }
}

function normalizeNode(raw: unknown): CurationImportNode | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  const name = String(x.name || '').trim()
  if (!name) return null
  const cards = Array.isArray(x.cards)
    ? x.cards.map(rawCard => {
      if (!rawCard || typeof rawCard !== 'object') return null
      const c = rawCard as Record<string, unknown>
      const title = String(c.title || '').trim()
      if (!title) return null
      return {
        title,
        description: String(c.description || '').trim() || undefined,
        url: safeUrl(String(c.url || '')),
        sourceType: String(c.sourceType || '').trim() || undefined,
        tags: Array.isArray(c.tags) ? c.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 8) : [],
      } as CurationShareCard
    }).filter((c): c is CurationShareCard => !!c)
    : []
  return {
    name,
    description: String(x.description || '').trim() || undefined,
    cards,
    children: Array.isArray(x.children)
      ? x.children.map(normalizeNode).filter((n): n is CurationImportNode => !!n)
      : [],
  }
}

function normalizeSnapshot(raw: unknown): CurationShareSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  if (x.schema !== CURATION_SHARE_SCHEMA) return null
  const version = Number(x.version)
  if (!Number.isFinite(version) || version < 1 || version > CURATION_SHARE_VERSION) return null
  const thesis = x.thesis && typeof x.thesis === 'object' ? x.thesis as Record<string, unknown> : {}
  const title = String(thesis.title || '').trim()
  if (!title) return null
  const nodes = Array.isArray(x.nodes) ? x.nodes.map(normalizeNode).filter((n): n is CurationImportNode => !!n) : []
  const totalNodes = (list: CurationImportNode[]): number => list.reduce((n, node) => n + 1 + totalNodes(node.children), 0)
  if (totalNodes(nodes) > 5000) throw new Error('成果文件节点超过 5000 个上限')
  return {
    schema: CURATION_SHARE_SCHEMA,
    version: CURATION_SHARE_VERSION,
    workspaceName: String(x.workspaceName || title).trim(),
    thesis: {
      title,
      description: String(thesis.description || '').trim() || undefined,
    },
    layout: x.layout === 'tree' ? 'tree' : 'pyramid',
    nodes,
    generatedAt: Number(x.generatedAt) || Date.now(),
  }
}

/** 从知源分享 HTML 中读取内嵌成果数据；不是分享文件时明确失败。 */
export function parseCurationShareHtml(html: string): CurationShareSnapshot {
  if (!html || html.length > 40 * 1024 * 1024) throw new Error('文件过大或为空')
  const match = html.match(/<script[^>]+id=["']zy-curation-share-data["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!match) throw new Error('这不是知源导出的策展成果 HTML')
  let raw: unknown
  try {
    raw = JSON.parse(match[1].trim())
  } catch {
    throw new Error('成果数据损坏，无法解析')
  }
  const snap = normalizeSnapshot(raw)
  if (!snap) throw new Error('成果数据版本或结构不受支持')
  return snap
}

export function snapshotNodeCount(nodes: CurationImportNode[]): number {
  return nodes.reduce((n, node) => n + 1 + snapshotNodeCount(node.children), 0)
}
