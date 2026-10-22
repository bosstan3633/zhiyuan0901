/**
 * 策展成果高清长图：直接从 Category 树绘制，不依赖 DOM 截图。
 *
 * 这样做的原因有两个：
 * - 金字塔与树状都能完整输出 L1-L4，不受当前滚动容器、折叠状态或窗口宽度影响；
 * - 分享 HTML 可以内嵌一张可下载的 PNG，而不必把截图脚本带进分享文件。
 */
import type { Category, ResourceCard } from '@/shared/models'

export interface CurationImageInput {
  workspaceName: string
  thesis: ResourceCard | null
  nodes: Category[]
  cards: ResourceCard[]
  layout: 'pyramid' | 'tree'
  theme?: 'paper' | 'ink'
}

export interface CurationImageOutput {
  blob: Blob
  dataUrl: string
  width: number
  height: number
}

interface DrawNode {
  id: string
  title: string
  description: string
  level: number
  cards: ResourceCard[]
  children: DrawNode[]
  width: number
  height: number
  x: number
  y: number
  subtree: number
}

const NODE_W = 300
const ROOT_W = 380
const H_GAP = 46
const V_GAP = 54
const PAD = 54
const HEADER_H = 116
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'

function childrenOf(nodes: Category[], parentId?: string): Category[] {
  return nodes
    .filter(n => (n.parentId || '') === (parentId || ''))
    .sort((a, b) => a.order - b.order)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function textWidth(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).width
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const lines: string[] = []
  let current = ''
  for (const char of clean) {
    const next = current + char
    if (current && textWidth(ctx, next) > maxWidth) {
      lines.push(current)
      current = char
      if (lines.length >= maxLines) break
    } else {
      current = next
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  const consumed = lines.join('').length
  if (consumed < clean.length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && textWidth(ctx, last + '…') > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
}

function buildTree(ctx: CanvasRenderingContext2D, nodes: Category[], cards: ResourceCard[], parentId: string | undefined, depth: number): DrawNode[] {
  return childrenOf(nodes, parentId).map(cat => {
    const ownCards = cards.filter(c => c.categoryId === cat.id)
    const children = buildTree(ctx, nodes, cards, cat.id, depth + 1)
    const width = depth === 1 ? ROOT_W : NODE_W
    const inner = width - 30
    ctx.font = `700 16px ${FONT}`
    const titleLines = wrapLines(ctx, cat.name || '未命名分支', inner, 3)
    ctx.font = `12px ${FONT}`
    const descLines = wrapLines(ctx, cat.description || '', inner, 4)
    const resourceHeight = ownCards.length * 22 + (ownCards.length ? 10 : 0)
    const height = Math.max(92, 50 + titleLines.length * 23 + descLines.length * 19 + resourceHeight + 32)
    return {
      id: cat.id,
      title: cat.name || '未命名分支',
      description: cat.description || '',
      level: depth + 1,
      cards: ownCards,
      children,
      width,
      height,
      x: 0,
      y: 0,
      subtree: 0,
    }
  })
}

function measureSubtree(node: DrawNode): number {
  if (!node.children.length) {
    node.subtree = node.width
    return node.subtree
  }
  const children = node.children.reduce((sum, child) => sum + measureSubtree(child), 0)
    + H_GAP * (node.children.length - 1)
  node.subtree = Math.max(node.width, children)
  return node.subtree
}

function measureTree(node: DrawNode): number {
  if (!node.children.length) {
    node.subtree = node.height
    return node.subtree
  }
  const children = node.children.reduce((sum, child) => sum + measureTree(child), 0)
    + V_GAP * (node.children.length - 1)
  node.subtree = Math.max(node.height, children)
  return node.subtree
}

function layoutTree(node: DrawNode, x: number, top: number): void {
  node.x = x
  node.y = top + node.subtree / 2 - node.height / 2
  const childrenHeight = node.children.reduce((sum, child) => sum + child.subtree, 0)
    + V_GAP * Math.max(0, node.children.length - 1)
  let cursor = top + (node.subtree - childrenHeight) / 2
  for (const child of node.children) {
    layoutTree(child, x + node.width + H_GAP, cursor)
    cursor += child.subtree + V_GAP
  }
}

function flatten(nodes: DrawNode[]): DrawNode[] {
  const out: DrawNode[] = []
  const walk = (node: DrawNode): void => {
    out.push(node)
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}

function drawConnector(ctx: CanvasRenderingContext2D, parent: DrawNode, child: DrawNode, pyramid: boolean, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (pyramid) {
    const sx = parent.x + parent.width / 2
    const sy = parent.y + parent.height
    const tx = child.x + child.width / 2
    const ty = child.y
    const my = sy + (ty - sy) / 2
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx, my)
    ctx.lineTo(tx, my)
    ctx.lineTo(tx, ty)
  } else {
    const sx = parent.x + parent.width
    const sy = parent.y + parent.height / 2
    const tx = child.x
    const ty = child.y + child.height / 2
    const mx = sx + (tx - sx) / 2
    ctx.moveTo(sx, sy)
    ctx.lineTo(mx, sy)
    ctx.lineTo(mx, ty)
    ctx.lineTo(tx, ty)
  }
  ctx.stroke()
}

function drawNode(ctx: CanvasRenderingContext2D, node: DrawNode, theme: 'paper' | 'ink'): void {
  const ink = theme === 'ink' ? '#f4f0e8' : '#25221c'
  const ink2 = theme === 'ink' ? '#c6c0b5' : '#5d584e'
  const line = theme === 'ink' ? 'rgba(255,255,255,.16)' : 'rgba(40,34,24,.15)'
  const surface = theme === 'ink' ? '#202126' : '#fffdf8'
  const accent = theme === 'ink' ? '#a7b7c8' : '#365f5b'
  const accentSoft = theme === 'ink' ? 'rgba(167,183,200,.14)' : '#e7f0ed'

  ctx.save()
  ctx.shadowColor = theme === 'ink' ? 'rgba(0,0,0,.28)' : 'rgba(54,44,30,.10)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 5
  roundRect(ctx, node.x, node.y, node.width, node.height, node.level === 1 ? 16 : 13)
  ctx.fillStyle = node.level === 1 ? accentSoft : surface
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = node.level === 1 ? 2 : 1
  ctx.strokeStyle = node.level === 1 ? accent : line
  ctx.stroke()
  ctx.restore()

  const pad = 15
  let y = node.y + 16
  ctx.font = `700 10px ${FONT}`
  ctx.fillStyle = accent
  ctx.fillText(`L${node.level}`, node.x + pad, y + 9)
  ctx.font = `10px ${FONT}`
  ctx.fillStyle = ink2
  ctx.fillText(node.level === 1 ? '中心论点 · 论点卡' : node.cards.length ? `${node.cards.length} 张资源` : '论证节点', node.x + pad + 34, y + 9)
  y += 28

  ctx.font = `700 ${node.level === 1 ? 18 : 16}px ${FONT}`
  ctx.fillStyle = ink
  const titleLines = wrapLines(ctx, node.title, node.width - pad * 2, 3)
  for (const line of titleLines) {
    ctx.fillText(line, node.x + pad, y + 14)
    y += node.level === 1 ? 25 : 23
  }

  if (node.description) {
    y += 4
    ctx.font = `12px ${FONT}`
    ctx.fillStyle = ink2
    const descLines = wrapLines(ctx, node.description, node.width - pad * 2, 4)
    for (const line of descLines) {
      ctx.fillText(line, node.x + pad, y + 11)
      y += 19
    }
  }

  if (node.cards.length) {
    y += 8
    for (const card of node.cards) {
      roundRect(ctx, node.x + pad, y, node.width - pad * 2, 20, 6)
      ctx.fillStyle = theme === 'ink' ? 'rgba(255,255,255,.06)' : '#f3efe5'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(node.x + pad + 9, y + 10, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.fill()
      ctx.font = `11px ${FONT}`
      ctx.fillStyle = ink2
      const label = wrapLines(ctx, card.title, node.width - pad * 2 - 26, 1)[0] || card.title
      ctx.fillText(label, node.x + pad + 17, y + 13)
      y += 22
    }
  }
}

function buildRoot(input: CurationImageInput, nodes: DrawNode[]): DrawNode {
  const thesis = input.thesis
  return {
    id: 'root',
    title: thesis?.title || `${input.workspaceName} · 策展成果`,
    description: thesis?.description || '',
    level: 1,
    cards: [],
    children: nodes,
    width: ROOT_W,
    height: thesis?.description ? 142 : 116,
    x: 0,
    y: 0,
    subtree: 0,
  }
}

/** 生成完整策展长图；只在分享抽屉打开或点击下载时调用。 */
export async function renderCurationImage(input: CurationImageInput): Promise<CurationImageOutput> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法创建长图画布')
  const theme = input.theme || 'paper'
  const roots = buildTree(ctx, input.nodes, input.cards, undefined, 1)
  const root = buildRoot(input, roots)
  const allNodes = [root, ...flatten(roots)]
  const pyramid = input.layout === 'pyramid'

  let width = 0
  let height = 0
  if (pyramid) {
    measureSubtree(root)
    const levelHeights = new Map<number, number>()
    for (const node of allNodes) levelHeights.set(node.level, Math.max(levelHeights.get(node.level) || 0, node.height))
    const levels = [...levelHeights.keys()].sort((a, b) => a - b)
    const yByLevel = new Map<number, number>()
    let y = HEADER_H + PAD
    for (const level of levels) {
      yByLevel.set(level, y)
      y += (levelHeights.get(level) || 0) + V_GAP
    }
    const layoutNode = (node: DrawNode, left: number): void => {
      node.x = left + node.subtree / 2 - node.width / 2
      node.y = yByLevel.get(node.level) || 0
      const childrenWidth = node.children.reduce((sum, child) => sum + child.subtree, 0)
        + H_GAP * Math.max(0, node.children.length - 1)
      let cursor = left + (node.subtree - childrenWidth) / 2
      for (const child of node.children) {
        layoutNode(child, cursor)
        cursor += child.subtree + H_GAP
      }
    }
    layoutNode(root, PAD)
    width = root.subtree + PAD * 2
    height = y - V_GAP + PAD
  } else {
    measureTree(root)
    layoutTree(root, PAD, HEADER_H + PAD)
    const maxRight = Math.max(...allNodes.map(node => node.x + node.width))
    width = maxRight + PAD
    height = root.subtree + HEADER_H + PAD * 2
  }

  width = Math.max(960, Math.ceil(width))
  height = Math.max(620, Math.ceil(height))
  const maxSide = 12000
  const maxArea = 40_000_000
  const scale = Math.max(0.5, Math.min(2, maxSide / width, maxSide / height, Math.sqrt(maxArea / (width * height))))
  canvas.width = Math.max(1, Math.floor(width * scale))
  canvas.height = Math.max(1, Math.floor(height * scale))
  ctx.scale(scale, scale)

  const bg = theme === 'ink' ? '#17181c' : '#f7f4ed'
  const surface2 = theme === 'ink' ? '#202126' : '#fffdf8'
  const ink = theme === 'ink' ? '#f4f0e8' : '#25221c'
  const ink2 = theme === 'ink' ? '#c6c0b5' : '#5d584e'
  const line = theme === 'ink' ? 'rgba(255,255,255,.14)' : 'rgba(40,34,24,.13)'
  const accent = theme === 'ink' ? '#a7b7c8' : '#365f5b'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = surface2
  ctx.fillRect(PAD, 30, width - PAD * 2, HEADER_H - 52)
  ctx.strokeStyle = line
  ctx.strokeRect(PAD, 30, width - PAD * 2, HEADER_H - 52)
  ctx.font = `700 12px ${FONT}`
  ctx.fillStyle = accent
  ctx.fillText('知源 · 策展成果', PAD + 18, 56)
  ctx.font = `600 20px ${FONT}`
  ctx.fillStyle = ink
  ctx.fillText(input.workspaceName, PAD + 18, 84)
  ctx.font = `11px ${FONT}`
  ctx.fillStyle = ink2
  ctx.textAlign = 'right'
  ctx.fillText(`${input.cards.length} 张资源 · ${allNodes.length - 1} 个论证节点 · L1-L4`, width - PAD - 18, 84)
  ctx.textAlign = 'left'

  for (const parent of allNodes) {
    for (const child of parent.children) drawConnector(ctx, parent, child, pyramid, line)
  }
  for (const node of allNodes) drawNode(ctx, node, theme)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('长图编码失败')), 'image/png')
  })
  return { blob, dataUrl, width: canvas.width, height: canvas.height }
}
