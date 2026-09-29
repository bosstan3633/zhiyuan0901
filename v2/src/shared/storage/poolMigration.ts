/**
 * V3.7.0（R179 架构简化轮）· 数据地基迁移
 *
 * 两个原子迁移（均幂等落戳，启动期执行；调用方 stores/app.ts 在首次执行前写迁移备份）：
 *
 * ① migrateCatsToTags —— 资源台（hub）分类树退役，一次性迁移为两级标签树 + 卡面路径标签。
 *    口径（用户拍板，2026-09）：
 *      一级分类 → 标签**父节点**（卡面追加父名）
 *      二级分类 → 该父节点下的**子标签**（卡面追加「父/子」路径）
 *      三 / 四级分类 → 拍平为**「父/子」路径标签**追加在卡上（取各自直接上级名：L3 = 二级/三级，L4 = 三级/四级）
 *      「待分类」子树不迁（其卡片不加标签 = 无标签，走资源卡「待打标」筛选兜住召回）
 *    迁移后：hub 分类实体从 categories 移除（策展台自有分类原样保留），池卡 categoryId 置空串。
 *
 * ② migrateBoardCardsToPool —— 策展台台内新建的资源卡（R61 决策 A「真身留本台」）一次性收编入池：
 *    workspaceId → CURATION_WS_ID、categoryId 清空，原位生成 CurationProjection（引用式镜像，位置不变）。
 *    isThesis 主题卡**不收编**（台内 UI 层论点，仍由 setThesis 口径管理）。
 *    收编后：卡真身唯一（池），策展台 = 论点 + 论证节点卡 + 镜像投射。
 *
 * 备份 / 回退：writeMigrateBackup 把迁移前全量数据写入 K.MIGRATE_BACKUP；
 * restoreMigrateBackup 整库覆盖回退并清除迁移落戳（备份缺失/版本不符返回 null）。
 * ★R179 记账：readMigrateBackup / restoreMigrateBackup 数据层原语已备，**尚无 UI 调用方**——
 *   设置页迁移报告卡（展示备份时间 / 下载 / 回退）属遗留项，未落地（见交付说明_R179 遗留 1）。
 */
import { CURATION_WS_ID, type AppData, type CatsMigrateReport, type ID, type TagNode } from '../models'
import { uid } from '../utils'
import { TAG_SEP, tagPathOf } from '../utils/tags'
import { K } from './keys'

function pushTag(map: Map<ID, string[]>, catId: ID, tag: string) {
  const arr = map.get(catId)
  if (arr) { if (!arr.includes(tag)) arr.push(tag) } else map.set(catId, [tag])
}

/**
 * 迁移①：分类 → 标签。幂等（catsMigratedAt）；无 hub 分类也落戳（幂等终态），
 * 报告只在确有分类时写入。@returns 是否发生落库级变更（调用方据此 persist）
 */
export function migrateCatsToTags(d: AppData): boolean {
  if (d.catsMigratedAt) return false
  const hubCats = d.categories.filter(c => c.workspaceId === CURATION_WS_ID)

  const tree: TagNode[] = d.tagTree = d.tagTree || []
  const report: CatsMigrateReport = { at: Date.now(), l1: 0, l2: 0, deep: 0, cardsTouched: 0, tagsAdded: 0, mapping: [] }
  const tagsByCat = new Map<ID, string[]>()

  const parentByName = new Map<string, TagNode>()
  for (const n of tree) parentByName.set(n.name, n)

  // R1.5 脏工况守卫：分类成环（A↔B 互指）会双双落不进 roots ⇒ 环内卡片脱组织。
  //   逐卡沿父链上溯 + visited 集，发现回到已访节点即断环提根（本级升一级分类处理）。
  for (const c of hubCats) {
    const visited = new Set<ID>([c.id])
    let cur = hubCats.find(x => x.id === c.parentId)
    while (cur) {
      if (visited.has(cur.id)) { c.parentId = undefined; break }
      visited.add(cur.id)
      const pid: ID | undefined = cur.parentId
      cur = hubCats.find(x => x.id === pid)
    }
  }

  const roots = hubCats.filter(c => !c.parentId || !hubCats.some(x => x.id === c.parentId))
  for (const root of roots) {
    const pendingSubtree = root.name === '待分类'
    // 一级 → 标签父节点（「待分类」不迁）
    if (!pendingSubtree) {
      let parent = parentByName.get(root.name)
      if (!parent) {
        parent = { id: uid('tag'), name: root.name, children: [] }
        tree.push(parent)
        parentByName.set(root.name, parent)
      }
      report.l1++
      report.mapping.push({ catId: root.id, path: root.name, tagName: root.name, kind: 'parent' })
      pushTag(tagsByCat, root.id, root.name)
    }
    // 二级 → 父节点下子标签；其下三 / 四级拍平
    for (const ch of hubCats.filter(c => c.parentId === root.id)) {
      if (!pendingSubtree) {
        const tagName = tagPathOf(root.name, ch.name)
        const parent = parentByName.get(root.name)
        if (parent && !parent.children!.some(x => x.name === ch.name)) {
          parent.children!.push({ id: uid('tag'), name: ch.name })
        }
        report.l2++
        report.mapping.push({ catId: ch.id, path: root.name + TAG_SEP + ch.name, tagName, kind: 'child' })
        pushTag(tagsByCat, ch.id, tagName)
      }
      flattenDeep(hubCats, ch.id, ch.name, tagsByCat, report, pendingSubtree)
    }
  }

  // 卡面追加：池内活跃卡按原 categoryId 取映射标签（去重追加）
  for (const r of d.resources) {
    if (r.deletedAt || r.workspaceId !== CURATION_WS_ID) continue
    const add = tagsByCat.get(r.categoryId || '')
    if (!add?.length) continue
    const before = Array.isArray(r.tags) ? r.tags.length : 0
    r.tags = Array.isArray(r.tags) ? r.tags.slice() : []
    for (const t of add) if (!r.tags.includes(t)) r.tags.push(t)
    if (r.tags.length > before) {
      report.cardsTouched++
      report.tagsAdded += r.tags.length - before
      r.updatedAt = Date.now()
    }
  }

  // hub 分类实体退役 + 池卡 categoryId 清空（遗留字段置空串，策展台自有分类不受影响）
  d.categories = d.categories.filter(c => c.workspaceId !== CURATION_WS_ID)
  for (const r of d.resources) {
    if (r.workspaceId === CURATION_WS_ID && r.categoryId) r.categoryId = ''
  }

  d.catsMigratedAt = Date.now()
  // R1.5：仅作内存交接（AppData 主根字段已退役）——调用方随即 relocateCatsMigrateReport 搬独立小键
  if (hubCats.length) (d as { catsMigrateReport?: CatsMigrateReport }).catsMigrateReport = report
  return true
}

/** 三级及更深：拍平为「直接上级名/本级名」标签追加在卡上（不进标签树——树上限两级） */
function flattenDeep(
  hubCats: { id: ID; name: string; parentId?: ID }[],
  parentId: ID,
  parentName: string,
  tagsByCat: Map<ID, string[]>,
  report: CatsMigrateReport,
  pendingSubtree: boolean
) {
  for (const c of hubCats.filter(x => x.parentId === parentId)) {
    if (!pendingSubtree) {
      const tagName = tagPathOf(parentName, c.name)
      pushTag(tagsByCat, c.id, tagName)
      report.deep++
      report.mapping.push({ catId: c.id, path: parentName + TAG_SEP + c.name, tagName, kind: 'flat' })
    }
    flattenDeep(hubCats, c.id, c.name, tagsByCat, report, pendingSubtree)
  }
}

/**
 * 迁移②：策展台台内资源卡收编入池。幂等（boardCardsPooledAt）。
 * @returns 是否发生变更
 */
export function migrateBoardCardsToPool(d: AppData): boolean {
  if (d.boardCardsPooledAt) return false
  d.curationProjections = d.curationProjections || []
  let moved = 0
  for (const r of d.resources) {
    if (!r.workspaceId || r.workspaceId === CURATION_WS_ID) continue
    if (r.isThesis) continue // 主题卡留在台内（UI 层论点，不进池语义）
    const boardId = r.workspaceId
    const boardCatId = r.categoryId
    r.workspaceId = CURATION_WS_ID
    r.categoryId = ''
    r.updatedAt = Date.now()
    // 原位转投射：目标台与台内分类保持不变（策展台自有分类树原样保留）
    const existed = d.curationProjections.find(p => p.kind === 'card' && p.cardId === r.id && p.targetWsId === boardId)
    if (!existed) {
      d.curationProjections.push({
        id: uid('curp'), kind: 'card', wsId: CURATION_WS_ID, cardId: r.id,
        targetWsId: boardId, targetCatId: boardCatId || undefined, addedAt: Date.now()
      })
    }
    moved++
  }
  d.boardCardsPooledAt = Date.now()
  return moved > 0 || true // 落戳即变更（幂等终态也要持久化）
}

/** 是否有迁移活可干（供调用方决定「迁移前备份」是否执行） */
export function migratePoolWorkPending(d: AppData): boolean {
  return !d.catsMigratedAt || !d.boardCardsPooledAt
}

/** 迁移前备份：全量数据写入 K.MIGRATE_BACKUP（chrome.storage.local，独立键不进主根） */
export async function writeMigrateBackup(d: AppData): Promise<void> {
  const payload = { at: Date.now(), reason: 'cats-to-tags + board-cards-pool', data: d }
  await chrome.storage.local.set({ [K.MIGRATE_BACKUP]: payload })
}

/** 读备份（设置页迁移报告卡：展示备份时间 / 下载 / 回退） */
export async function readMigrateBackup(): Promise<{ at: number; reason?: string; data: AppData } | null> {
  const o = await chrome.storage.local.get(K.MIGRATE_BACKUP)
  const b = o && o[K.MIGRATE_BACKUP]
  return b && b.data ? b : null
}

/**
 * 回退：用备份整库覆盖当前数据并清除迁移落戳（调用方负责写回与刷新）。
 * 备份缺失 / 结构不符返回 null。
 */
/** R1.5：迁移报告迁独立小键（幂等）——旧版写在 AppData 主根的报告一次性搬出；新迁移的报告同径落键 */
export async function relocateCatsMigrateReport(d: AppData): Promise<void> {
  const carrier = d as { catsMigrateReport?: CatsMigrateReport }
  if (!carrier.catsMigrateReport) return
  await chrome.storage.local.set({ [K.MIGRATE_REPORT]: carrier.catsMigrateReport })
  delete carrier.catsMigrateReport
}

export async function restoreMigrateBackup(): Promise<AppData | null> {
  const b = await readMigrateBackup()
  if (!b?.data || b.data.version !== 2) return null
  const d = b.data
  d.catsMigratedAt = undefined
  d.boardCardsPooledAt = undefined
  delete (d as { catsMigrateReport?: unknown }).catsMigrateReport // R1.5：报告随回退失效；K.MIGRATE_REPORT 由调用方一并清除
  return d
}
