/**
 * R61：资源台 × 策展台结构服务（61-1/61-5/61-6 数据层）
 *
 * 结构语义（R61 拍板）：
 * - 资源台 = 全局唯一 kind='resource' 的 Workspace 实体（id 固定 CURATION_WS_ID，存量数据零迁移）
 * - 策展台 = 其余未归档工作台（kind 缺省视为 'curation'）
 * - 镜像方向：资源台 → 策展台（CurationProjection.targetWsId 标记目标台）
 * - 决策 A：策展台新建卡不写入资源台（台内卡 workspaceId=台 id，与镜像引用并存）
 * - 决策 C：isThesis 主题卡纯界面层标记，不参与同步列
 */
import {
  CURATION_WS_ID,
  type AppData,
  type ID,
  type Workspace,
  type Category,
  type ResourceCard,
  type CurationProjection,
  type AnyCard
} from '../models'
import { uid } from '../utils'

// ===== 台类型判定 =====

export function isHubWs(w?: Workspace | null): boolean {
  return !!w && (w.kind === 'resource' || w.id === CURATION_WS_ID)
}

/** 策展台列表（未归档、非资源台） */
export function curationBoards(d: AppData): Workspace[] {
  return d.workspaces.filter(w => !w.archived && !isHubWs(w)).sort((a, b) => a.order - b.order)
}

export function boardName(d: AppData, wsId?: ID): string {
  if (!wsId) return '（台已删除）'
  return d.workspaces.find(w => w.id === wsId)?.name || '（台已删除）'
}

// ===== 投射（资源台 → 策展台） =====

/** 某策展台收到的镜像记录 */
export function projectionsOf(d: AppData, targetWsId: ID): CurationProjection[] {
  return (d.curationProjections || []).filter(p => p.kind === 'card' && p.targetWsId === targetWsId)
}

/**
 * R61-2：把资源台的一张卡镜像到指定策展台（引用式，源数据零影响）。
 * @returns 投射记录 id；失败返回 null（重复镜像 / 源卡不在资源台）
 */
export function projectCardToBoard(d: AppData, cardId: ID, toWsId: ID, targetCatId?: ID): string | null {
  const src = d.resources.find(r => r.id === cardId && !r.deletedAt && r.workspaceId === CURATION_WS_ID)
  if (!src) return null
  if (toWsId === CURATION_WS_ID) return null
  d.curationProjections = d.curationProjections || []
  const existed = d.curationProjections.find(p => p.kind === 'card' && p.cardId === cardId && p.targetWsId === toWsId)
  if (existed) {
    existed.targetCatId = targetCatId || undefined
    return existed.id
  }
  const rec: CurationProjection = {
    id: uid('curp'), kind: 'card', wsId: CURATION_WS_ID, cardId,
    catId: src.categoryId, targetWsId: toWsId, targetCatId: targetCatId || undefined, addedAt: Date.now()
  }
  d.curationProjections.push(rec)
  return rec.id
}

/** 移出某台的一个镜像（只删引用，源卡零影响） */
export function removeProjection(d: AppData, projId: ID): boolean {
  const before = d.curationProjections?.length || 0
  d.curationProjections = (d.curationProjections || []).filter(p => p.id !== projId)
  return d.curationProjections.length < before
}

/**
 * R61-2：把资源台的一个分类镜像到策展台——物化为目标台内带 curFrom 的真实分类，
 * 并把该分类（含直属子分类）下的现有卡自动投射过去。源台零影响。
 * @returns 新镜像分类 id；重复/非法返回 null
 */
export function mirrorCategoryToBoard(d: AppData, hubCatId: ID, toWsId: ID): string | null {
  const src = d.categories.find(c => c.id === hubCatId && c.workspaceId === CURATION_WS_ID)
  if (!src || toWsId === CURATION_WS_ID) return null
  d.curationProjections = d.curationProjections || []
  if (d.categories.some(c => c.workspaceId === toWsId && c.curFrom?.wsId === CURATION_WS_ID && c.curFrom?.catId === hubCatId)) {
    return null // 已镜像过
  }
  let maxOrder = -1
  for (const c of d.categories) if (c.workspaceId === toWsId && (c.order ?? 0) > maxOrder) maxOrder = c.order ?? 0
  const mirror: Category = {
    id: uid('cat'), workspaceId: toWsId, name: src.name, order: maxOrder + 1,
    curFrom: { wsId: CURATION_WS_ID, catId: hubCatId, projId: 'cat:' + hubCatId }
  }
  d.categories.push(mirror)
  // 自动投射现有卡：源分类直属 + 子分类直属
  const srcCatIds = new Set([hubCatId, ...d.categories.filter(c => c.workspaceId === CURATION_WS_ID && c.parentId === hubCatId).map(c => c.id)])
  for (const r of d.resources) {
    if (r.deletedAt || r.workspaceId !== CURATION_WS_ID || !srcCatIds.has(r.categoryId || '')) continue
    projectCardToBoard(d, r.id, toWsId, mirror.id)
  }
  return mirror.id
}

/**
 * R61-2：策展台混排视图模型——台内原生卡 + 资源台镜像卡（浅拷贝 + categoryId 重映射到台内分类）。
 * 镜像拷贝带 __mirrorProjId 标记，视图层据此拦截写操作（写动作一律回落源卡所在资源台）。
 */
export interface MirrorView extends ResourceCard {
  __mirrorProjId: ID
}

export function isMirrorView(r: ResourceCard): r is MirrorView {
  return '__mirrorProjId' in r
}

/** 策展台全量可见卡 = 台内原生卡 + 镜像卡（视图模型） */
export function boardCardsOf(d: AppData, wsId: ID): ResourceCard[] {
  const own = d.resources.filter(r => r.workspaceId === wsId && !r.deletedAt)
  const ownIds = new Set(own.map(r => r.id))
  const mirrors: MirrorView[] = []
  for (const p of projectionsOf(d, wsId)) {
    const src = d.resources.find(r => r.id === p.cardId && !r.deletedAt)
    if (!src || ownIds.has(src.id)) continue
    mirrors.push({ ...src, categoryId: p.targetCatId || '', __mirrorProjId: p.id })
  }
  return [...own, ...mirrors]
}

// ===== 统计（61-5：R62 顶部 5 指标数据源） =====

export interface CurationMetrics {
  /** 卡片总数（台内原生 + 镜像） */
  total: number
  /** 来源构成 */
  native: number
  mirrored: number
  /** 主题卡 id（无则 undefined） */
  thesisId?: ID
  /** 分类节点数 */
  categoryCount: number
  /** 空节点数（无直属卡且无子分类卡） */
  emptyNodes: number
  /** 附件汇总 */
  attachmentCount: number
  /** 附件明细（卡片 → 附件；R62 下钻抽屉直接消费，点击打开由抽屉内 openDrillAsset 承担） */
  attachmentItems: { cardId: ID; cardTitle: string; assetId: ID; name: string; kind: string; size: number; createdAt: number }[]
  /** 最近更新时间（含镜像卡按源卡 updatedAt） */
  lastUpdatedAt: number
}

export function curationMetrics(d: AppData, wsId: ID): CurationMetrics {
  const cards = boardCardsOf(d, wsId)
  const cats = d.categories.filter(c => c.workspaceId === wsId)
  const thesis = cards.find(r => r.isThesis && r.workspaceId === wsId)
  const items: CurationMetrics['attachmentItems'] = []
  let attachmentCount = 0
  let lastUpdatedAt = 0
  for (const r of cards) {
    for (const a of r.assets || []) {
      attachmentCount++
      items.push({ cardId: r.id, cardTitle: r.title, assetId: a.id, name: a.name || a.id, kind: a.kind, size: a.size || 0, createdAt: a.createdAt || 0 })
    }
    lastUpdatedAt = Math.max(lastUpdatedAt, r.updatedAt || r.createdAt || 0)
  }
  const emptyNodes = cats.filter(c => {
    const hasCard = cards.some(r => (r.categoryId || '') === c.id)
    const hasChild = cats.some(x => x.parentId === c.id)
    return !hasCard && !hasChild
  }).length
  return {
    total: cards.length,
    native: cards.filter(r => !isMirrorView(r)).length,
    mirrored: cards.filter(r => isMirrorView(r)).length,
    thesisId: thesis?.id,
    categoryCount: cats.length,
    emptyNodes,
    attachmentCount,
    attachmentItems: items,
    lastUpdatedAt
  }
}

// ===== 挂载校验（61-6：金字塔节点只允许挂资源卡） =====

export function canMountInNode(card: AnyCard): boolean {
  return card.kind === 'resource'
}

// ===== 主题卡（R62：策展台中心论点，金字塔 L1 根） =====

/**
 * R62：设立/取消策展台中心论点——每台最多一张（先清同台旧标记再立新）。
 * @param cardId null = 仅清标记（取消中心论点）
 * @returns 是否成功（卡不存在/不在本台/已删除 → false）
 */
export function setThesis(d: AppData, wsId: ID, cardId: ID | null): boolean {
  for (const r of d.resources) {
    if (r.workspaceId !== wsId || !r.isThesis) continue
    if (r.id !== cardId) r.isThesis = undefined
  }
  if (!cardId) return true
  const card = d.resources.find(r => r.id === cardId && r.workspaceId === wsId && !r.deletedAt)
  if (!card) return false
  card.isThesis = true
  card.updatedAt = Date.now()
  return true
}
