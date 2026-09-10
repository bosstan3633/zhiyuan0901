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

/**
 * R61：资源台结构迁移（幂等，AppData.hubMigratedAt 标记；调用方在首次执行前负责自动备份下载）
 *  1. 资源台转正：id=CURATION_WS_ID 的真实 Workspace 实体（缺则建，名为「资源台」，置顶 order=-1）
 *  2. 台类型补齐：其余策展台 kind='curation'
 *  3. 策展中心内镜像分类 curFrom 剥离——物化分类转为资源台原生分类（镜像方向反转后溯源失效）
 *  4. 旧方向投射记录（工作台→策展中心）清空：源卡本就留在原工作台（R61 后=策展台），无数据丢失
 */
export function migrateHubStructure(d: AppData): boolean {
  if (d.hubMigratedAt) return false
  // ① 资源台实体转正
  const hub = d.workspaces.find(w => w.id === CURATION_WS_ID)
  if (hub) {
    hub.kind = 'resource'
    if (!hub.name || /策展/.test(hub.name)) hub.name = '资源台'
  } else {
    d.workspaces.push({
      id: CURATION_WS_ID, name: '资源台', icon: '🗂', color: '#3A6B4C',
      coverTheme: 'deep-sea', order: -1, archived: false, kind: 'resource'
    })
  }
  // ② 其余台补类型
  for (const w of d.workspaces) if (w.id !== CURATION_WS_ID && !w.kind) w.kind = 'curation'
  // ③ 镜像分类 → 原生资源分类
  for (const c of d.categories) if (c.workspaceId === CURATION_WS_ID && c.curFrom) c.curFrom = undefined
  // ④ 旧方向投射清空
  d.curationProjections = []
  d.hubMigratedAt = Date.now()
  return true
}

/** 资源台根分类的下一个排序键 */
function nextHubRootOrder(d: AppData): number {
  let max = -1
  for (const c of d.categories) if (c.workspaceId === CURATION_WS_ID && !c.parentId && (c.order ?? 0) > max) max = c.order ?? 0
  return max + 1
}

/**
 * R64：旧工作台并入资源台（幂等，AppData.hubMergedAt 标记；调用方在首次执行前负责自动备份下载）
 * 拍板：资源台 = 旧版工作台数据的汇聚地——
 *  1. 每个 curation 台（≠资源台）的分类树整体平移进资源台：原根分类挂到资源台根下「同名根分类」防冲突
 *  2. 该台原生卡随分类平移（workspaceId→CURATION_WS_ID，categoryId 不变）
 *  3. 指向该台的投射记录删除（真身已在资源台，悬空投射无意义）
 *  4. 该工作台实体删除（拍板：不留空壳）
 */
export function migrateHubMerge(d: AppData): boolean {
  if (d.hubMergedAt) return false
  d.hubMergedAt = Date.now()
  const hub = d.workspaces.find(w => w.id === CURATION_WS_ID && !w.archived)
  if (!hub) return false
  const boards = d.workspaces.filter(w => w.id !== CURATION_WS_ID && w.kind === 'curation' && !w.archived)
  if (!boards.length) return false
  let changed = false
  for (const b of boards) {
    // ① 资源台根下同名根分类（已有同名根则复用）
    let root = d.categories.find(c => c.workspaceId === CURATION_WS_ID && !c.parentId && c.name === b.name)
    if (!root) {
      root = { id: uid('cat'), workspaceId: CURATION_WS_ID, name: b.name, order: nextHubRootOrder(d) }
      d.categories.push(root)
      changed = true
    }
    // ② 分类树平移：原根分类挂到同名根下，其余跟随（parentId 本就指向本台内分类，改 workspaceId 即可）
    for (const c of d.categories) {
      if (c.workspaceId !== b.id) continue
      c.workspaceId = CURATION_WS_ID
      if (!c.parentId) c.parentId = root.id
      changed = true
    }
    // ③ 原生卡平移
    for (const r of d.resources) {
      if (r.workspaceId === b.id) { r.workspaceId = CURATION_WS_ID; changed = true }
    }
    // ④ 指向该台的投射删除
    const before = d.curationProjections?.length || 0
    d.curationProjections = (d.curationProjections || []).filter(p => p.targetWsId !== b.id)
    if ((d.curationProjections?.length || 0) !== before) changed = true
    // ⑤ 工作台实体删除
    d.workspaces = d.workspaces.filter(w => w.id !== b.id)
    changed = true
  }
  return changed
}
