/**
 * R128-A3：永久删除（硬删）统一引擎
 *
 * 背景（两处口径不一致的数据安全缺陷）：
 * - 回收站页逐个「永久删除」会摘附件本体、摘 metric.taskIds；
 * - 设置页「清空回收站」只 filter 数组——附件 Blob 全量泄漏成孤儿、任务卡脱离指标引用、
 *   指向已删卡的镜像投射记录悬空。
 * 本模块把硬删的四类副作用收在一处，任何入口调用同一函数（口径唯一）。
 *
 * 四类副作用（顺序即语义）：
 *  ① 附件本体（IndexedDB）——按「是否仍有其他卡引用」决定删除，见下；
 *  ② 指标 taskIds —— 被删任务卡从所有 metric.taskIds 摘除；
 *  ③ 数组移除 —— resources / tasks / curiosities / categories；
 *  ④ 悬空投射剪枝 —— pruneDanglingProjections（源卡硬删后 curationProjections 无界增长的那条路径）。
 *
 * ①的引用计数口径（REQ-050 转卡「AssetMeta 引用拷贝」的直接后果）：
 * 好奇心卡转任务/资源卡时只拷引用、不拷 Blob，两张卡共用一个本体。因此硬删其中一张
 * 不能无条件 deleteAsset——否则另一张卡（含回收站里待恢复的卡）的附件会打不开。
 * keepIds 由**存活卡**（本次未硬删的全部卡，软删卡也算存活）的 assets 并集构成。
 */
import type { AppData, ArgumentCard, Category, CuriosityCard, ResourceCard, TaskCard } from '../models'
import { deleteAsset } from './assets'
import { getData } from './repository'
import { pruneDanglingProjections } from './hub'

export interface PurgeTargets {
  resources?: ResourceCard[]
  tasks?: TaskCard[]
  curiosities?: CuriosityCard[]
  /** R109（F12-b）软删分类：无附件语义，仅数组移除 */
  categories?: Category[]
  /** R2-⑤：论证节点卡（第 4 种卡）——无附件、无指标引用，数组移除 + 投射剪枝即覆盖其全部副作用 */
  argCards?: ArgumentCard[]
}

export interface PurgeResult {
  /** 本次硬删的卡片数（含分类） */
  cards: number
  /** 已删除的附件本体数 */
  assetsPurged: number
  /** 仍被其他卡引用而保留的本体数（转卡共享） */
  assetsShared: number
  /** 删除失败的附件本体数（残留可去设置页清孤儿） */
  assetsFailed: number
  /** 剪枝掉的悬空投射记录数 */
  projectionsPruned: number
}

/** 一组卡的 asset id 并集（跨卡去重） */
function assetIdUnion(cards: { assets?: { id: string }[] }[]): Set<string> {
  const s = new Set<string>()
  for (const c of cards) for (const a of c.assets || []) if (a?.id) s.add(a.id)
  return s
}

/**
 * 硬删一组卡（就地修改 d，不落盘——persist 由调用方负责）。
 * @param d 当前 AppData 树
 */
export async function purgeCardsCompletely(d: AppData, targets: PurgeTargets): Promise<PurgeResult> {
  const res = targets.resources || []
  const tasks = targets.tasks || []
  const curios = targets.curiosities || []
  const cats = targets.categories || []

  const resIds = new Set(res.map(r => r.id))
  const taskIds = new Set(tasks.map(t => t.id))
  const curioIds = new Set(curios.map(c => c.id))

  // ① 附件：存活卡的引用为 keepIds（本次不删的卡，含仍在回收站里的软删卡）
  const keep = new Set<string>()
  for (const r of d.resources) if (!resIds.has(r.id)) for (const a of r.assets || []) if (a?.id) keep.add(a.id)
  for (const t of d.tasks) if (!taskIds.has(t.id)) for (const a of t.assets || []) if (a?.id) keep.add(a.id)
  for (const c of d.curiosities) if (!curioIds.has(c.id)) for (const a of c.assets || []) if (a?.id) keep.add(a.id)

  const targeted = new Set<string>()
  for (const s of [assetIdUnion(res), assetIdUnion(tasks), assetIdUnion(curios)]) for (const id of s) targeted.add(id)
  let assetsShared = 0
  const doomed: string[] = []
  for (const id of targeted) { if (keep.has(id)) assetsShared++; else doomed.push(id) }

  let assetsPurged = 0, assetsFailed = 0
  for (const id of doomed) {
    try { await deleteAsset(id); assetsPurged++ } catch (err) { console.error('[purge] delete asset failed:', err); assetsFailed++ }
  }

  // ② 任务卡脱离指标引用（硬删后 metric.taskIds 里的残留 id 会让进度/下钻口径虚高）
  if (taskIds.size) {
    for (const dir of d.compass?.directions || []) {
      for (const proj of dir.projects || []) {
        for (const m of proj.metrics || []) m.taskIds = (m.taskIds || []).filter(id => !taskIds.has(id))
      }
    }
  }

  // ③ 数组移除
  if (resIds.size) d.resources = d.resources.filter(r => !resIds.has(r.id))
  if (taskIds.size) d.tasks = d.tasks.filter(t => !taskIds.has(t.id))
  if (curioIds.size) d.curiosities = d.curiosities.filter(c => !curioIds.has(c.id))
  if (cats.length) {
    const catIds = new Set(cats.map(c => c.id))
    d.categories = d.categories.filter(c => !catIds.has(c.id))
  }
  // R2-⑤：论证卡（软删后进回收站，与三卡同一条硬删通道——不再另设「不可恢复」的旁路）
  const args = targets.argCards || []
  if (args.length) {
    const argIds = new Set(args.map(a => a.id))
    d.argCards = (d.argCards || []).filter(a => !argIds.has(a.id))
  }

  // ④ 悬空投射剪枝（幂等；软删卡仍在数组里，故不影响「恢复后镜像自动回来」语义）
  const projectionsPruned = pruneDanglingProjections(d)

  return {
    cards: res.length + tasks.length + curios.length + cats.length + args.length,
    assetsPurged,
    assetsShared,
    assetsFailed,
    projectionsPruned
  }
}

/** 当前树中所有软删（回收站内）的三类卡 + 分类 + 论证卡 */
export function recycledCardsOf(d: AppData): Required<PurgeTargets> {
  return {
    resources: d.resources.filter(r => r.deletedAt),
    tasks: d.tasks.filter(t => t.deletedAt),
    curiosities: d.curiosities.filter(c => c.deletedAt),
    categories: d.categories.filter(c => c.deletedAt),
    argCards: (d.argCards || []).filter(a => a.deletedAt)
  }
}

/**
 * 从卡片上移除一个附件本体：仅当全树再无**其他卡**引用该 id 时才真删 IndexedDB Blob。
 * （REQ-050 转卡共享同一本体——从任一侧删附件不能把另一侧打成死链）
 * @param selfCardId 调用方所在卡 id；该卡此刻仍持有此引用，判定时排除
 * @returns 本体是否被删除（false = 仍被引用而保留，或仓库未加载而按原语义删除）
 */
export async function deleteAssetIfOrphan(id: string, selfCardId?: string): Promise<boolean> {
  try {
    const d = getData()
    const heldElsewhere = (arr: { id?: string; assets?: { id: string }[] }[] | undefined) =>
      (arr || []).some(c => c.id !== selfCardId && (c.assets || []).some(a => a?.id === id))
    if (heldElsewhere(d.resources) || heldElsewhere(d.tasks) || heldElsewhere(d.curiosities) || heldElsewhere(d.argCards)) return false
  } catch { /* 仓库未加载（如 options 独立上下文）：按原语义直接删 */ }
  await deleteAsset(id)
  return true
}
