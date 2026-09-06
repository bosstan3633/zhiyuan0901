/**
 * R53-A1：策展树统一迁移——把遗留的 kind='category' / kind='workspace' 投射记录
 * 物化为**带 curFrom 溯源标记的真实策展分类**，使镜像分类与原生分类在同一颗树下
 * 同构（混排 / 父子 / 拖拽排序），并一次性消除 R51/R52 的 'mirror:' 前缀键。
 *
 * 迁移内容（幂等：迁移后不存在 kind!=='card' 的投射记录，二次运行零操作）：
 *  1. kind='category' 记录 → 策展分类 { curFrom: { wsId, catId, projId } }，displayName 转为分类名
 *  2. kind='workspace' 记录 → 按源工作台顶层分类逐个物化（R52 打包版语义）
 *  3. 'mirror:<记录id>' 键（R51/R52 的镜像分组引用）→ 新策展分类 id：
 *     投射卡 targetCatId / 原生卡 curCatId（归一写 categoryId）/ 镜像子分类 parentId
 *
 * 全程源工作台数据零影响。
 */
import { CURATION_WS_ID, type AppData, type Category } from '../models'
import { uid } from '../utils'

const MIRROR_PREFIX = 'mirror:'

function sourceCatName(d: AppData, catId?: string): string {
  return d.categories.find(x => x.id === catId)?.name || '镜像分类'
}

function nextCurationOrder(d: AppData): number {
  let max = -1
  for (const c of d.categories) if (c.workspaceId === CURATION_WS_ID && (c.order ?? 0) > max) max = c.order ?? 0
  return max + 1
}

/** 物化一个镜像分类（幂等：同源分类已物化则复用） */
function materialize(d: AppData, wsId: string, sourceCatId: string, name: string): Category {
  const existed = d.categories.find(c => c.workspaceId === CURATION_WS_ID && c.curFrom?.wsId === wsId && c.curFrom?.catId === sourceCatId)
  if (existed) return existed
  const cat: Category = {
    id: uid('cat'),
    workspaceId: CURATION_WS_ID,
    name: name.trim() || '镜像分类',
    order: nextCurationOrder(d),
    curFrom: { wsId, catId: sourceCatId, projId: sourceCatId }
  }
  d.categories.push(cat)
  return cat
}

/** 返回是否发生迁移（调用方据此决定 persist） */
export function migrateCurationTree(d: AppData): boolean {
  const projections = d.curationProjections
  if (!projections || !projections.length) return false
  const legacy = projections.filter(p => p.kind !== 'card')
  if (!legacy.length) return false

  // 阶段 1：物化。镜像键（'mirror:'+记录id）只指向 kind='category' 记录——按记录 id 建映射
  const byRecordId = new Map<string, string>()
  for (const p of legacy) {
    if (p.kind === 'category' && p.catId) {
      const cat = materialize(d, p.wsId, p.catId, p.displayName || sourceCatName(d, p.catId))
      cat.curFrom = { wsId: p.wsId, catId: p.catId, projId: p.id }
      byRecordId.set(MIRROR_PREFIX + p.id, cat.id)
    } else if (p.kind === 'workspace') {
      const roots = d.categories.filter(c => c.workspaceId === p.wsId && !c.parentId)
      for (const c of roots) materialize(d, p.wsId, c.id, c.name)
    }
  }

  // 阶段 2：重映射三类 'mirror:' 键
  for (const p of projections) {
    if (p.kind === 'card' && p.targetCatId?.startsWith(MIRROR_PREFIX)) {
      p.targetCatId = byRecordId.get(p.targetCatId)
    }
  }
  for (const r of d.resources) {
    if (r.curCatId?.startsWith(MIRROR_PREFIX)) {
      const mapped = byRecordId.get(r.curCatId)
      if (mapped) r.categoryId = mapped
      r.curCatId = undefined
    }
  }
  for (const c of d.categories) {
    if (c.parentId?.startsWith(MIRROR_PREFIX)) c.parentId = byRecordId.get(c.parentId)
  }

  // 阶段 3：移除已消费的遗留记录，仅保留单卡投射
  d.curationProjections = projections.filter(p => p.kind === 'card')
  return true
}
