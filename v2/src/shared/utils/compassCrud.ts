/**
 * R146（第一刀·回退契约）：罗盘结构节点与策展台的删除真源。
 *
 * 治的两个病（视觉/交互审计条目 1、5、6）：
 *  ① 战略目标/项目/成功指标的删除原先在四个视图各写一遍 `splice`——无确认、无撤销、
 *    不进事件流水，删错即整棵子树物理消失（与"删除可恢复"的产品承诺相反）。
 *    现统一为 **快照 → 摘除 → 3 秒内按原位置插回**（节点不是卡，不进回收站，
 *    但撤销窗口内必须可回；超窗后靠导出数据兜底，与既有 Category 软删口径分开）。
 *  ② 两个「删除策展台」入口两套语义：台签右键是 `archived=true` + 卡搬家，
 *    ⚙ 菜单是硬删台 + 卡软删进回收站。同名不同命。现拆成两个具名真源
 *    （archiveWorkspace / deleteDeck），各自文案自解释，且删除台带撤销。
 */
import type { AppData, Category, Direction, Metric, Project, Workspace } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { uid } from '@/shared/utils'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'

export type CompassNodeKind = 'direction' | 'project' | 'metric'

/** 摘除现场：插回所需的全部坐标 */
export interface NodeSnapshot {
  kind: CompassNodeKind
  /** direction 无父；project 的父=方向 id；metric 的父=项目 id */
  parentId: string
  index: number
  node: Direction | Project | Metric
  /** 删指标时被清空 metricId 的任务（撤销时回填） */
  unlinkedTasks: { taskId: string; projectId?: string }[]
}

function locate(d: AppData, kind: CompassNodeKind, id: string): { list: any[]; index: number; parentId: string } | null {
  const dirs = d.compass.directions || []
  if (kind === 'direction') {
    const i = dirs.findIndex(x => x.id === id)
    return i >= 0 ? { list: dirs, index: i, parentId: '' } : null
  }
  for (const dir of dirs) {
    if (kind === 'project') {
      const i = dir.projects.findIndex(p => p.id === id)
      if (i >= 0) return { list: dir.projects, index: i, parentId: dir.id }
    } else {
      for (const p of dir.projects) {
        const i = p.metrics.findIndex(m => m.id === id)
        if (i >= 0) return { list: p.metrics, index: i, parentId: p.id }
      }
    }
  }
  return null
}

/** 确认文案用的报数：这条节点之下还有什么（"删了会带走多少"） */
export function compassNodeCounts(d: AppData, kind: CompassNodeKind, id: string): { projects: number; metrics: number; tasks: number; label: string } {
  const dirs = d.compass.directions || []
  const tasksOfMetrics = (ms: Metric[]) => {
    const ids = new Set(ms.flatMap(m => m.taskIds || []))
    return (d.tasks || []).filter(t => !t.deletedAt && (ids.has(t.id) || ms.some(m => m.id === t.metricId))).length
  }
  if (kind === 'direction') {
    const dir = dirs.find(x => x.id === id)
    const ms = dir ? dir.projects.flatMap(p => p.metrics) : []
    return { projects: dir?.projects.length || 0, metrics: ms.length, tasks: tasksOfMetrics(ms), label: '战略目标' }
  }
  if (kind === 'project') {
    for (const dir of dirs) {
      const p = dir.projects.find(x => x.id === id)
      if (p) return { projects: 1, metrics: p.metrics.length, tasks: tasksOfMetrics(p.metrics), label: '攻坚项目' }
    }
  }
  for (const dir of dirs) for (const p of dir.projects) {
    const m = p.metrics.find(x => x.id === id)
    if (m) {
      const ids = new Set(m.taskIds || [])
      const n = (d.tasks || []).filter(t => !t.deletedAt && (ids.has(t.id) || t.metricId === id)).length
      return { projects: 0, metrics: 1, tasks: n, label: '成功指标' }
    }
  }
  return { projects: 0, metrics: 0, tasks: 0, label: '节点' }
}

/**
 * 摘除节点并返回可插回的快照（就地改 d，persist 由调用方负责）。
 * 语义与既有实现一致：删指标会把其下任务的 metricId 清空（回落"未关联指标"），
 * 删项目/方向只摘自身（其下任务保留 projectId 作定位锚，与 CompassTree 原行为同口径）。
 */
export function removeCompassNode(d: AppData, kind: CompassNodeKind, id: string): NodeSnapshot | null {
  const at = locate(d, kind, id)
  if (!at) return null
  const node = at.list[at.index] as Metric | Project | Direction
  const unlinked: { taskId: string; projectId?: string }[] = []
  if (kind === 'metric') {
    for (const t of d.tasks || []) if (!t.deletedAt && t.metricId === id) { unlinked.push({ taskId: t.id, projectId: t.projectId }); t.metricId = undefined; t.updatedAt = Date.now() }
  }
  at.list.splice(at.index, 1)
  return { kind, parentId: at.parentId, index: at.index, node, unlinkedTasks: unlinked }
}

/** 撤销：按原坐标插回（父若已被更上层删除则放弃，返回 false 由调用方如实回执） */
export function restoreCompassNode(d: AppData, snap: NodeSnapshot): boolean {
  let list: unknown[] | null = null
  if (snap.kind === 'direction') list = d.compass.directions as unknown[]
  else if (snap.kind === 'project') {
    const dir = (d.compass.directions || []).find(x => x.id === snap.parentId)
    if (dir) list = dir.projects as unknown[]
  } else {
    for (const dir of d.compass.directions || []) {
      const p = dir.projects.find(x => x.id === snap.parentId)
      if (p) { list = p.metrics as unknown[]; break }
    }
  }
  if (!list) return false
  list.splice(Math.min(snap.index, list.length), 0, snap.node)
  for (const u of snap.unlinkedTasks) {
    const t = (d.tasks || []).find(x => x.id === u.taskId)
    if (t) { t.metricId = (snap.node as Metric).id; t.updatedAt = Date.now() }
  }
  return true
}

/** 四视图共用的「删除成功指标」流程：确认报数 → 真源摘除 → 3 秒撤销（R146 统一口径） */
export async function removeMetricWithConfirm(d: AppData, metricId: string, persist: () => void): Promise<void> {
  const c = compassNodeCounts(d, 'metric', metricId)
  if (!c.metrics) { showToast('⚠ 指标已不存在'); return }
  let name = ''
  for (const dir of d.compass.directions || []) for (const p of dir.projects) { const m = p.metrics.find(x => x.id === metricId); if (m) name = m.title }
  const ok = await useConfirm({
    title: '删除成功指标',
    message: c.tasks ? `确定删除指标「${name}」？\n其下 ${c.tasks} 个任务将转为「未关联指标」（任务本体不删，可拖回任意指标）。` : `确定删除指标「${name}」？\n该指标下还没有任务。`,
    confirmText: '确认删除',
  })
  if (!ok) return
  const snap = removeCompassNode(d, 'metric', metricId)
  if (!snap) return
  persist()
  showToast(`已删除指标「${name.slice(0, 16)}」${c.tasks ? ` · ${c.tasks} 个任务转为未关联` : ''}`, { label: '撤销', cb: () => {
    if (restoreCompassNode(d, snap)) { persist(); showToast(`✓ 已恢复指标「${name.slice(0, 16)}」`) }
    else showToast('⚠ 上级项目已不在，无法单独恢复该指标')
  } })
}

// ============== 策展台：归档 / 删除 两语义（R146 拆名，不再同名两实现） ==============
/**
 * 归档：台仍在数据里（archived=true），其下卡搬到首个可用台的待分类（兜底池），镜像投射随台摘除。
 * V3.7.0（R179）池语义适配：
 *  - 兜底目标 = 资源卡池（CURATION_WS_ID）时**不建「待分类」分类**（hub 分类已退役）， categoryId 置空；
 *  - isThesis 论点卡随台迁移时**摘除论点标记**（「每台最多一张」不变量不被迁入卡破坏，卡内容保留入池）。
 */
export function archiveWorkspace(d: AppData, ws: Workspace): { moved: number } {
  ws.archived = true
  let moved = 0
  const other = (d.workspaces || []).find(w => !w.archived && w.id !== ws.id && w.id !== CURATION_WS_ID) || (d.workspaces || []).find(w => w.id === CURATION_WS_ID)
  if (other) {
    const toPool = other.id === CURATION_WS_ID
    let cat: Category | undefined
    if (!toPool) {
      cat = (d.categories || []).find(c => c.workspaceId === other.id && !c.deletedAt && c.name === '待分类')
      if (!cat) { cat = { id: uid('cat'), workspaceId: other.id, name: '待分类', order: 0 } as Category; d.categories.push(cat) }
    }
    for (const r of d.resources) {
      if (r.workspaceId !== ws.id || r.deletedAt) continue
      r.workspaceId = other.id
      r.categoryId = toPool ? '' : cat!.id
      if (r.isThesis) r.isThesis = undefined
      moved++
    }
  }
  if (d.curationProjections?.length) d.curationProjections = d.curationProjections.filter(p => !(p.kind === 'card' && p.targetWsId === ws.id))
  pruneMirrorCats(d, ws.id)
  return { moved }
}

/** 删除台：台本体移除，其下卡与分类一律软删进回收站（可恢复）；返回快照供撤销 */
export interface DeckSnapshot { ws: Workspace; index: number; cardIds: string[]; catIds: string[] }
export function deleteDeck(d: AppData, wsId: string): DeckSnapshot | null {
  if (wsId === CURATION_WS_ID) return null
  const index = (d.workspaces || []).findIndex(w => w.id === wsId)
  if (index < 0) return null
  const ws = (d.workspaces as Workspace[])[index]
  const now = Date.now()
  const cardIds: string[] = []; const catIds: string[] = []
  for (const r of d.resources) if (r.workspaceId === wsId && !r.deletedAt) { r.deletedAt = now; cardIds.push(r.id) }
  for (const c of d.categories) if (c.workspaceId === wsId && !c.deletedAt) { c.deletedAt = now; catIds.push(c.id) }
  d.workspaces.splice(index, 1)
  if (d.curationProjections?.length) d.curationProjections = d.curationProjections.filter(p => !(p.kind === 'card' && p.targetWsId === wsId))
  pruneMirrorCats(d, wsId)
  return { ws, index, cardIds, catIds }
}

/** 撤销删除台：台插回原位，其下卡与分类清 deletedAt（只清本次被台带走的那些） */
export function restoreDeck(d: AppData, snap: DeckSnapshot): void {
  d.workspaces.splice(Math.min(snap.index, d.workspaces.length), 0, snap.ws)
  const cards = new Set(snap.cardIds); const cats = new Set(snap.catIds)
  for (const r of d.resources) if (cards.has(r.id)) { r.deletedAt = undefined; r.updatedAt = Date.now() }
  for (const c of d.categories) if (cats.has(c.id)) c.deletedAt = undefined
}

/** 该台在资源台留下的镜像分类级联清理（R53-A1 遗留口径，两个入口共用） */
function pruneMirrorCats(d: AppData, wsId: string) {
  const mirrorIds = new Set((d.categories || []).filter(c => c.workspaceId === CURATION_WS_ID && c.curFrom?.wsId === wsId).map(c => c.id))
  if (!mirrorIds.size) return
  for (const r of d.resources) if (r.workspaceId === CURATION_WS_ID && mirrorIds.has(r.categoryId || '')) r.categoryId = ''
  for (const p of d.curationProjections || []) if (p.kind === 'card' && p.targetCatId && mirrorIds.has(p.targetCatId)) p.targetCatId = undefined
  for (const c of d.categories) if (c.parentId && mirrorIds.has(c.parentId)) c.parentId = undefined
  d.categories = d.categories.filter(c => !mirrorIds.has(c.id))
}

/** 供确认文案：台里有多少活卡（"删了会带走多少"） */
export function deckCardCount(d: AppData, wsId: string): number {
  return (d.resources || []).filter(r => r.workspaceId === wsId && !r.deletedAt).length
}
