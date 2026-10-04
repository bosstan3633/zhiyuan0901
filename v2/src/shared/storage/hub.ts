/**
 * R61：资源台 × 策展台结构服务（61-1/61-5/61-6 数据层）
 *
 * 结构语义（R61 拍板）：
 * - 资源台 = 全局唯一 kind='resource' 的 Workspace 实体（id 固定 CURATION_WS_ID，存量数据零迁移）
 * - 策展台 = 其余未归档台（kind 缺省视为 'curation'）
 * - 投射方向：资源卡池 → 策展台（CurationProjection.targetWsId 标记目标台）
 * - 决策 A：策展台新建卡不写入资源卡池（台内卡 workspaceId=台 id，与镜像引用并存）
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

/** 策展台列表（未归档、非资源卡池） */
export function curationBoards(d: AppData): Workspace[] {
  return d.workspaces.filter(w => !w.archived && !isHubWs(w)).sort((a, b) => a.order - b.order)
}

export function boardName(d: AppData, wsId?: ID): string {
  if (!wsId) return '（台已删除）'
  return d.workspaces.find(w => w.id === wsId)?.name || '（台已删除）'
}

// ===== 投射（资源卡池 → 策展台） =====

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
    // R70 说明：catId 是「镜像时刻源卡所在分类」的历史快照，不参与任何业务判定——
    // 渲染与计数一律以源卡实时的 categoryId 为准（见 boardCardsOf），源卡换分类后此字段陈旧无害。
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

/**
 * 策展台全量可见卡 = 台内原生卡 + 镜像卡（视图模型）
 * R71 性能治理：原实现对**每条投射**都做一次 `d.resources.find` ——
 * O(投射数 × 资源数)，且本函数是策展台每次重渲染的根 computed（allResources / curationMetrics 都调它）。
 * 改为一次遍历建 id→卡 Map + 一次遍历投影，降到 O(资源数 + 投射数)。
 */
export function boardCardsOf(d: AppData, wsId: ID): ResourceCard[] {
  const own: ResourceCard[] = []
  const byId = new Map<ID, ResourceCard>()
  for (const r of d.resources) {
    if (r.deletedAt) continue
    byId.set(r.id, r)
    if (r.workspaceId === wsId) own.push(r)
  }
  const ownIds = new Set(own.map(r => r.id))
  const mirrors: MirrorView[] = []
  const projs = d.curationProjections
  if (projs) {
    for (const p of projs) {
      if (p.kind !== 'card' || p.targetWsId !== wsId) continue
      const src = byId.get(p.cardId || '')
      if (!src || ownIds.has(src.id)) continue
      mirrors.push({ ...src, categoryId: p.targetCatId || '', __mirrorProjId: p.id })
    }
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

/**
 * @param cardsIn R112 性能：宿主已算过 boardCardsOf 时直接传入（调用方 Workspace.vue 的
 *   `allResources` 与 `metrics` 此前各算一遍 boardCardsOf —— 同一份数据两次全量遍历 + 建 Map/Set）。
 *   省略则内部自算，行为不变。
 */
export function curationMetrics(d: AppData, wsId: ID, cardsIn?: ResourceCard[]): CurationMetrics {
  const cards = cardsIn || boardCardsOf(d, wsId)
  const cats = d.categories.filter(c => c.workspaceId === wsId)
  const items: CurationMetrics['attachmentItems'] = []
  // R71：卡片一次遍历同时得出 主题卡 / 原生镜像计数 / 附件清单 / 最近更新 / 分类卡数分布
  // （此前对同一数组 find ×1 + filter ×3 + 分类维度的 filter×some 嵌套 —— O(分类数 × 卡数)）
  let attachmentCount = 0
  let lastUpdatedAt = 0
  let native = 0
  let mirrored = 0
  let thesisId: ID | undefined
  const cardCountByCat = new Map<string, number>()
  // R110-BUG1：资源台（hub）按单向挂载红线镜像恒 0——不再依赖「数据一定干净」，
  // 即使净化尚未落盘（脏数据在内存中残留一拍）也不会再冒出「⚠ 镜像 N 条待清理」噪声。
  const isHub = isHubWs(d.workspaces.find(w => w.id === wsId))
  for (const r of cards) {
    if (isMirrorView(r) && !isHub) mirrored++
    if (!isMirrorView(r) || isHub) native++
    if (!thesisId && r.isThesis && r.workspaceId === wsId) thesisId = r.id
    const ck = r.categoryId || ''
    cardCountByCat.set(ck, (cardCountByCat.get(ck) || 0) + 1)
    const assets = r.assets
    if (assets) {
      for (const a of assets) {
        attachmentCount++
        items.push({ cardId: r.id, cardTitle: r.title, assetId: a.id, name: a.name || a.id, kind: a.kind, size: a.size || 0, createdAt: a.createdAt || 0 })
      }
    }
    const u = r.updatedAt || r.createdAt || 0
    if (u > lastUpdatedAt) lastUpdatedAt = u
  }
  // 空节点：无直属卡且无子分类 —— 两个 Set/Map 查询代替嵌套 filter×some
  const hasChild = new Set<string>()
  for (const c of cats) if (c.parentId) hasChild.add(c.parentId)
  let emptyNodes = 0
  for (const c of cats) if (!cardCountByCat.get(c.id) && !hasChild.has(c.id)) emptyNodes++
  return {
    total: cards.length,
    native,
    mirrored,
    thesisId,
    categoryCount: cats.length,
    emptyNodes,
    attachmentCount,
    attachmentItems: items,
    lastUpdatedAt
  }
}

// ===== 挂载校验（61-6：金字塔节点只允许挂资源卡） =====

export function canMountInNode(card: AnyCard): boolean {
  // R1.5：argument 卡为台内原生描述节点（不挂指标）——挂载语义仍仅资源卡
  return card.kind === 'resource'
}

// ===== 主题卡（R62：策展台中心论点，金字塔 L1 根） =====

/**
 * R62：设立/取消策展台中心论点——每台最多一张（先清同台旧标记再立新）。
 * @param cardId null = 仅清标记（取消中心论点）
 * @returns 是否成功（卡不存在/不在本台/已删除 → false）
 */
export function setThesis(d: AppData, wsId: ID, cardId: ID | null): boolean {
  // R1.5：论证节点卡不做中心论点——论点语义由池卡（金字塔 L1）承担；传 arg id 显式拒绝
  if (cardId && d.argCards?.some(a => a.id === cardId)) return false
  for (const r of d.resources) {
    // R4-Fa：软删卡上的论点标记不动——与同文件 countThesisDuplicates / sanitizeThesisDuplicates 的
    // 既有口径同源（「软删卡不计入，回收站恢复后语义不变」）。此前这里连回收站里的卡一起摘标，
    // 用户从回收站恢复一张旧论点卡，恢复回来的是一张没有论点头衔的普通卡，且没有任何提示。
    if (r.workspaceId !== wsId || !r.isThesis || r.deletedAt) continue
    if (r.id !== cardId) r.isThesis = undefined
  }
  if (!cardId) return true
  const card = d.resources.find(r => r.id === cardId && r.workspaceId === wsId && !r.deletedAt)
  if (!card) return false
  card.isThesis = true
  card.updatedAt = Date.now()
  return true
}

// ===== R171-A1：中心论点重复（不变量「每台最多一张 isThesis」的盘点与修复） =====

/**
 * 纯盘点（不改任何数据）：统计各台**未软删**的 isThesis 卡，找出同台多张的违规。
 * 口径与 boardCardsOf/curationMetrics 同源——软删卡不计入（回收站恢复后语义不变）。
 * @returns { wsCount } 出现重复的台数；{ cleared } 若修复将被清除标记的卡数
 */
export function countThesisDuplicates(d: AppData): { wsCount: number; cleared: number } {
  const byWs = new Map<ID, ResourceCard[]>()
  for (const r of d.resources) {
    if (r.deletedAt || !r.isThesis || !r.workspaceId) continue
    let list = byWs.get(r.workspaceId)
    if (!list) byWs.set(r.workspaceId, (list = []))
    list.push(r)
  }
  let wsCount = 0
  let cleared = 0
  for (const list of byWs.values()) {
    if (list.length < 2) continue
    wsCount++
    cleared += list.length - 1
  }
  return { wsCount, cleared }
}

/**
 * 落地修复（幂等，会改数据）：每台保留数组序第一张 isThesis（metrics 取首张的既有口径），
 * 其余置 undefined + 重打 updatedAt。软删卡上的标记不动。
 * 老版本/导入合并可能让同台多张并存——幽灵论点既不进金字塔根也读不到，只污染「确立中心论点」入口的判定。
 * @returns 与 countThesisDuplicates 同构（修复前盘点值）
 */
export function sanitizeThesisDuplicates(d: AppData): { wsCount: number; cleared: number } {
  const report = countThesisDuplicates(d)
  if (!report.wsCount) return report
  const byWs = new Map<ID, ResourceCard[]>()
  for (const r of d.resources) {
    if (r.deletedAt || !r.isThesis || !r.workspaceId) continue
    let list = byWs.get(r.workspaceId)
    if (!list) byWs.set(r.workspaceId, (list = []))
    list.push(r)
  }
  for (const list of byWs.values()) {
    for (const r of list.slice(1)) {
      r.isThesis = undefined
      r.updatedAt = Date.now()
    }
  }
  return report
}

/**
 * R70：悬空投射清理（幂等）。
 * 源卡被**硬删**（回收站清空）后，指向它的 curationProjections 记录会永久留存、数组无界增长；
 * 目标策展台被删除时同理。注意：软删的卡仍留在 resources 数组里（只是带 deletedAt），
 * 因此本函数**不影响**「回收站恢复后镜像自动回来」的语义。
 * @returns 本次清理掉的记录数
 */
export function pruneDanglingProjections(d: AppData): number {
  const arr = d.curationProjections
  if (!Array.isArray(arr) || !arr.length) return 0
  // R1.5：第 4 卡种 argument 台内原生（argCards）——投射虽只指向池卡，alive 集合仍纳入，防未来引用误剪
  const aliveCards = new Set([...d.resources.map(r => r.id), ...(d.argCards || []).map(a => a.id)])
  const aliveWs = new Set(d.workspaces.map(w => w.id))
  const before = arr.length
  d.curationProjections = arr.filter(p => p.kind === 'card' ? (aliveCards.has(p.cardId || '') && aliveWs.has(p.targetWsId || '')) : true)
  return before - d.curationProjections.length
}

/**
 * R110-BUG1：资源台（hub）镜像语义净化——单向挂载红线的启动期兜底。
 *
 * 资源台上不应存在任何镜像投影语义（投射方向只允许「资源台 → 策展台」）。历史脏数据有两种形态：
 * ① 视图模型标记 `__mirrorProjId` / `__mirrorCat` 被误持久化到资源台卡上——表现为资源台指标格
 *    常驻「⚠ 镜像 N 条待清理」（R75 注释自证：镜像数 > 0 只可能是历史脏数据）；
 * ② `curationProjections` 中存在 `targetWsId` 指向资源台的投射记录（早期版本未拦截）。
 *
 * 本函数在启动期一次性、**幂等**剥离两者：只摘标记 / 只删投射记录，卡本体与其他字段零影响。
 * @returns 本次净化的卡数（不含被清除的投射记录数）
 */
export function scrubHubMirrorMarkers(d: AppData): number {
  let n = 0
  for (const r of d.resources) {
    if (r.workspaceId !== CURATION_WS_ID) continue
    if ('__mirrorProjId' in r) { delete (r as Record<string, unknown>).__mirrorProjId; n++ }
    if ('__mirrorCat' in r) delete (r as Record<string, unknown>).__mirrorCat
  }
  if (Array.isArray(d.curationProjections) && d.curationProjections.length) {
    d.curationProjections = d.curationProjections.filter(p => p.targetWsId !== CURATION_WS_ID)
  }
  return n
}
