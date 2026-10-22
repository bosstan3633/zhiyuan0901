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

function safeUrl(value?: string): string {
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

export function buildCurationSnapshot(input: {
  workspaceName: string
  thesis: ResourceCard | null
  nodes: Category[]
  cards: ResourceCard[]
  layout: 'pyramid' | 'tree'
  generatedAt?: number
}): CurationShareSnapshot {
  const childrenOf = (parentId?: string): Category[] =>
    input.nodes.filter(n => (n.parentId || '') === (parentId || '')).sort((a, b) => a.order - b.order)
  const walk = (node: Category): CurationShareNode => ({
    name: node.name || '未命名分支',
    description: node.description || undefined,
    children: childrenOf(node.id).map(walk),
    cards: input.cards
      .filter(c => c.categoryId === node.id)
      .map(c => ({
        title: c.title,
        description: c.description || undefined,
        url: safeUrl(c.link) || undefined,
        sourceType: c.sourceType,
        tags: (c.tags || []).slice(0, 8),
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
    nodes: childrenOf().map(walk),
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
