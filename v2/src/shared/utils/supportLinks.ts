/**
 * R166 定案 5：任务/子任务 ↔ 资源的「支持」关联域。
 *
 * 为什么是一张独立表而不是卡上的字段：三卡「卡间零挂载」是红线（models 头 §2），
 * 一旦 `TaskCard.resourceIds` 出现，就又要处理双向同步、删除卫生、导入合并、镜像语义……
 * 独立记录表让**卡对象互不持有对方 id**，红线一字不改；这与 `CurationProjection`（资源卡池→策展台
 * 镜像）同构——红线明文豁免的是"记录型关联"，不是给挂载开口子。
 *
 * 三条口径：
 *  · **软删只隐藏、不删记录**：任一端进回收站 ⇒ 反查看不到；恢复即自动回挂（所以 purge 只服务于硬删）。
 *  · **解绑只在任务侧**（定案 10）：资源卡保持"供给方"心智，资源侧反查区是只读的。
 *  · **索引是只读快照**：由 computed 在其依赖的数组变化时重建，消费方不得改它返回的数组。
 *
 * 纯函数、零 UI / store 依赖——任务详情、资源详情、卡面三处共用同一份。
 */
import type { AppData, CurioSupportLink, SupportLink } from '@/shared/models'
import { uid } from '@/shared/utils'

export interface SupportIndex {
  /** taskId → 该任务的全部关联（含挂在它子任务上的），createdAt 倒序 */
  byTask: Map<string, SupportLink[]>
  /** subId → 该子任务的关联 */
  bySub: Map<string, SupportLink[]>
  /** resourceId → 引用该资源的所有关联（资源侧只读反查用） */
  byResource: Map<string, SupportLink[]>
  curioByCurio: Map<string, CurioSupportLink[]>
  curioByResource: Map<string, CurioSupportLink[]>
}

const emptyIndex = (): SupportIndex => ({
  byTask: new Map(),
  bySub: new Map(),
  byResource: new Map(),
  curioByCurio: new Map(),
  curioByResource: new Map(),
})

/**
 * 建反查索引，同时做软删过滤：两端任一在回收站里 ⇒ 这条不进索引（记录本身保留）。
 * 一次 O(n) 建表、之后 O(1) 查——不要在渲染路径里 filter 全表。
 */
export function buildSupportIndex(d: AppData): SupportIndex {
  const idx = emptyIndex()
  const links = d.supportLinks
  if (!Array.isArray(links) || !links.length) return idx
  const liveTask = new Set((d.tasks || []).filter(t => t && !t.deletedAt).map(t => t.id))
  const liveRes = new Set((d.resources || []).filter(r => r && !r.deletedAt).map(r => r.id))
  // 子任务不是卡：它活着的定义是"父卡活着且清单里还有这个 id"
  const liveSub = new Map<string, string>()
  for (const t of d.tasks || []) {
    if (!t || t.deletedAt) continue
    for (const s of t.subtasks || []) liveSub.set(s.id, t.id)
  }
  for (const l of links) {
    if (!l || !liveTask.has(l.taskId) || !liveRes.has(l.resourceId)) continue
    if (l.subId && liveSub.get(l.subId) !== l.taskId) continue
    push(idx.byTask, l.taskId, l)
    if (l.subId) push(idx.bySub, l.subId, l)
    push(idx.byResource, l.resourceId, l)
  }
  for (const m of [idx.byTask, idx.bySub, idx.byResource]) for (const arr of m.values()) arr.sort((a, b) => b.createdAt - a.createdAt)
  const liveCurio = new Set((d.curiosities || []).filter(c => c && !c.deletedAt).map(c => c.id))
  for (const l of d.curioSupportLinks || []) {
    if (!l || !liveCurio.has(l.curioId) || !liveRes.has(l.resourceId)) continue
    pushCurio(idx.curioByCurio, l.curioId, l)
    pushCurio(idx.curioByResource, l.resourceId, l)
  }
  for (const m of [idx.curioByCurio, idx.curioByResource]) for (const arr of m.values()) arr.sort((a, b) => b.createdAt - a.createdAt)
  return idx
}

function push<K>(m: Map<K, SupportLink[]>, k: K, l: SupportLink): void {
  const arr = m.get(k)
  if (arr) arr.push(l); else m.set(k, [l])
}
function pushCurio<K>(m: Map<K, CurioSupportLink[]>, k: K, l: CurioSupportLink): void {
  const arr = m.get(k)
  if (arr) arr.push(l); else m.set(k, [l])
}

export function listByTask(idx: SupportIndex, taskId: string): SupportLink[] { return idx.byTask.get(taskId) || [] }
export function listBySub(idx: SupportIndex, subId: string): SupportLink[] { return idx.bySub.get(subId) || [] }
export function listByResource(idx: SupportIndex, resourceId: string): SupportLink[] { return idx.byResource.get(resourceId) || [] }
export function listByCurio(idx: SupportIndex, curioId: string): CurioSupportLink[] { return idx.curioByCurio.get(curioId) || [] }

/**
 * 新增关联。同一 (taskId, subId, resourceId) 已存在则不重复挂（返回 dup）——
 * AI 反复点同一个任务、或用户手动重复关联，都不该在清单里堆同名行。
 */
export function addSupportLink(
  d: AppData,
  input: { taskId: string; subId?: string; resourceId: string; from: 'ai' | 'manual'; why?: string }
): { link?: SupportLink; dup: boolean } {
  const list = (d.supportLinks = d.supportLinks || [])
  const same = (x: SupportLink) => x.taskId === input.taskId && x.resourceId === input.resourceId && (x.subId || '') === (input.subId || '')
  if (list.some(same)) return { dup: true }
  const link: SupportLink = {
    id: uid('sl'), taskId: input.taskId, resourceId: input.resourceId,
    from: input.from, createdAt: Date.now(),
    ...(input.subId ? { subId: input.subId } : {}),
    ...(input.why ? { why: input.why.slice(0, 120) } : {}),
  }
  list.push(link)
  return { link, dup: false }
}

/** 解绑（只删这一条记录；两端本体一律不动） */
export function removeSupportLink(d: AppData, id: string): boolean {
  const list = d.supportLinks || []
  const i = list.findIndex(l => l.id === id)
  if (i < 0) return false
  list.splice(i, 1)
  return true
}

/**
 * 硬删卫生：任务/资源被**物理**删除（回收站清空、批量清理）时，指向它的关联必须一起删掉，
 * 否则记录无界增长且反查表里永远挂着死引用（与 `metric.taskIds` 同法，R141 立的规矩）。
 * 软删不走这里——软删靠 `buildSupportIndex` 的过滤隐藏，恢复即回挂。
 */
export function purgeSupportLinks(d: AppData, opt: { taskIds?: Set<string>; resourceIds?: Set<string> }): number {
  const list = d.supportLinks
  if (!Array.isArray(list) || !list.length) return 0
  const dead = (l: SupportLink) =>
    (opt.taskIds && opt.taskIds.has(l.taskId)) || (opt.resourceIds && opt.resourceIds.has(l.resourceId))
  const kept = list.filter(l => !dead(l))
  const n = list.length - kept.length
  if (n) d.supportLinks = kept
  return n
}

export function addCurioSupportLink(
  d: AppData,
  input: { curioId: string; resourceId: string; from: 'ai' | 'manual'; why?: string }
): { link?: CurioSupportLink; dup: boolean } {
  const list = (d.curioSupportLinks = d.curioSupportLinks || [])
  if (list.some(x => x.curioId === input.curioId && x.resourceId === input.resourceId)) return { dup: true }
  const link: CurioSupportLink = {
    id: uid('csl'),
    curioId: input.curioId,
    resourceId: input.resourceId,
    from: input.from,
    createdAt: Date.now(),
    ...(input.why ? { why: input.why.slice(0, 120) } : {}),
  }
  list.push(link)
  return { link, dup: false }
}

export function removeCurioSupportLink(d: AppData, id: string): boolean {
  const list = d.curioSupportLinks || []
  const i = list.findIndex(l => l.id === id)
  if (i < 0) return false
  list.splice(i, 1)
  return true
}

export function purgeCurioSupportLinks(d: AppData, opt: { curioIds?: Set<string>; resourceIds?: Set<string> }): number {
  const list = d.curioSupportLinks
  if (!Array.isArray(list) || !list.length) return 0
  const kept = list.filter(l =>
    !(opt.curioIds && opt.curioIds.has(l.curioId))
    && !(opt.resourceIds && opt.resourceIds.has(l.resourceId)))
  const n = list.length - kept.length
  if (n) d.curioSupportLinks = kept
  return n
}

/** 某任务（含其子任务）当前已关联的资源 id 集——AI 找资源时用它**排除已关联**候选 */
export function linkedResourceIds(idx: SupportIndex, taskId: string): Set<string> {
  const out = new Set<string>()
  for (const l of listByTask(idx, taskId)) out.add(l.resourceId)
  return out
}
