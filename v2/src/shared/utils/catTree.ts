/**
 * R70：分类树结构校验与净化（导入入口的唯一防线）
 *
 * 背景：分类树导入（设置页「导入数据」/ 策展台「导入数据包」）此前只校验 version，
 * 不校验结构；而 mergeById 用 { ...existing, ...incoming } 覆盖 parentId —— 可造出「环」。
 * 环会让「沿父链上行」的 while 死转、让「向下递归」栈溢出，且发生在分类树渲染/计数路径上，
 * 于是资源卡池与相关策展台将**永久打不开**（无界面入口可自救）。
 *
 * 本模块：
 *  1. 收敛 MAX_CAT_LEVEL / MAX_CAT_NODES（此前 4 这个上限散落在多个文件里各写各的）；
 *  2. sanitizeCategoryTree() 在导入时净化数据（环/孤儿/超深 → 提为根，保留数据只修结构）；
 *  3. walkCatIds() 供视图层复用带 visited 的安全 DFS，避免各自再踩同一个坑。
 */

/** 分类层级上限（根 = 1 级） */
export const MAX_CAT_LEVEL = 4
/** 分类节点数上限（超大数组直接拒绝导入，防内存与渲染拖垮） */
export const MAX_CAT_NODES = 5000

export interface CatLike { id: string; parentId?: string }

export interface CatFixReport {
  /** 父节点不存在（或自引用）→ 提为根 */
  orphan: number
  /** 父链成环 → 拆环提为根 */
  cycle: number
  /** 层级超过 MAX_CAT_LEVEL → 提为根 */
  tooDeep: number
}

export interface SanitizeResult<T extends CatLike> {
  /** false = 节点数超上限，调用方应整体拒绝本次导入 */
  ok: boolean
  /** 净化后的分类数组（ok=false 时原样返回，未做修改） */
  cats: T[]
  fixed: CatFixReport
}

/**
 * 分类树净化：环 / 孤儿父节点 / 超深层级一律「提为根」（保数据、只修结构）。
 * 迭代至稳定——因为提根会缩短后继节点的父链，单轮扫描可能残留超深节点。
 */
export function sanitizeCategoryTree<T extends CatLike>(input: T[]): SanitizeResult<T> {
  const fixed: CatFixReport = { orphan: 0, cycle: 0, tooDeep: 0 }
  if (!Array.isArray(input)) return { ok: true, cats: [], fixed }
  if (input.length > MAX_CAT_NODES) return { ok: false, cats: input, fixed }

  const cats = input.map(c => ({ ...c })) as T[]
  const byId = new Map<string, T>(cats.map(c => [c.id, c]))

  for (let round = 0; round <= MAX_CAT_LEVEL; round++) {
    let changed = false
    for (const c of cats) {
      if (!c.parentId) continue
      // 自引用 / 父节点不存在 → 提根
      if (c.parentId === c.id || !byId.has(c.parentId)) {
        c.parentId = undefined; fixed.orphan++; changed = true; continue
      }
      // 沿父链上行：命中已见节点 = 环
      const seen = new Set<string>([c.id])
      let cur: T | undefined = byId.get(c.parentId)
      let depth = 1
      let cyclic = false
      while (cur) {
        if (seen.has(cur.id)) { cyclic = true; break }
        seen.add(cur.id)
        depth++
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      if (cyclic) { c.parentId = undefined; fixed.cycle++; changed = true }
      else if (depth > MAX_CAT_LEVEL) { c.parentId = undefined; fixed.tooDeep++; changed = true }
    }
    if (!changed) break
  }
  return { ok: true, cats, fixed }
}

export const catTreeFixedAny = (r: CatFixReport): boolean => r.orphan + r.cycle + r.tooDeep > 0

/** 净化结果的人类可读说明（导入成功提示里附一句，避免静默改数据） */
export function catTreeFixNote(r: CatFixReport): string {
  const parts: string[] = []
  if (r.cycle) parts.push(`环 ${r.cycle} 处`)
  if (r.orphan) parts.push(`孤儿父节点 ${r.orphan} 处`)
  if (r.tooDeep) parts.push(`超 ${MAX_CAT_LEVEL} 级节点 ${r.tooDeep} 个`)
  return parts.join('、')
}

/* ============================================================================
 * R117（04-61 · A 分类口径统一）：分类下拉选项的**唯一口径**
 *
 * 背景：采集浮层（content/overlay-impl.ts）、资源台批量移动（useWorkspaceBatch）、
 * 全局采集（GlobalPopups）三处各自实现分类下拉，且**都漏了 `deletedAt` 过滤** ——
 * 软删分类（幽灵项）与同名历史记录会照常出现在下拉里（用户截图：同一分类名重复 3 次），
 * 而资源台侧（Workspace.vue 的 wsCats）口径是对的。用户诉求「采集当前资源台内的分类」。
 *
 * 本函数把口径固化为一处：过滤软删 → 建索引 → 带 visited 防环 DFS → label。
 *   - 默认缩进式 label（`└` 前缀，与资源卡池的 treeCatOptions 同视觉）
 *   - 传 `sep` 则用路径式 label（「父 / 子」，与采集浮层 treeCatLabels 同视觉）
 * ========================================================================== */

export interface CatOptionLike extends CatLike {
  name?: string
  deletedAt?: number
  order?: number
}

export interface CatOption {
  id: string
  label: string
  /** 层级：根 = 0 */
  depth: number
}

/** 分类下拉选项（唯一口径）——过滤软删 + 防环 + 稳定排序 */
export function buildCatOptions(cats: readonly CatOptionLike[] | undefined, opts?: { sep?: string }): CatOption[] {
  const sep = opts?.sep
  const list = (cats || []).filter(c => c && !c.deletedAt)
  const byId = new Map<string, CatOptionLike>(list.map(c => [c.id, c]))
  const childrenOf = new Map<string, CatOptionLike[]>()
  const roots: CatOptionLike[] = []
  for (const c of list) {
    // 孤儿（父不存在）与自引用提根——与 sanitizeCategoryTree / buildCatIndex 同口径
    if (!c.parentId || c.parentId === c.id || !byId.has(c.parentId)) { roots.push(c); continue }
    const arr = childrenOf.get(c.parentId)
    if (arr) arr.push(c); else childrenOf.set(c.parentId, [c])
  }
  for (const arr of childrenOf.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const out: CatOption[] = []
  const seen = new Set<string>()
  const push = (c: CatOptionLike, depth: number, path: string) => {
    if (seen.has(c.id)) return
    seen.add(c.id)
    const name = c.name ?? ''
    const label = sep
      ? (path ? path + sep + name : name)
      : ('└'.repeat(depth) + (depth ? ' ' : '') + name)
    out.push({ id: c.id, label, depth })
    const nextPath = sep ? (path ? path + sep + name : name) : ''
    for (const ch of childrenOf.get(c.id) || []) push(ch, depth + 1, nextPath)
  }
  for (const r of roots) push(r, 0, '')
  return out
}

/**
 * 带 visited 的安全 DFS：返回 rootId 的全部后代 id（不含自身）。
 * 视图层若自行写递归，务必照此模式带 visited —— 数据侧净化挡不住已存在的坏数据。
 */
export function walkCatIds<T extends CatLike>(cats: T[], rootId: string): string[] {
  const childrenOf = new Map<string, T[]>()
  for (const c of cats) {
    if (!c.parentId) continue
    const arr = childrenOf.get(c.parentId) || []
    arr.push(c)
    childrenOf.set(c.parentId, arr)
  }
  const out: string[] = []
  const seen = new Set<string>([rootId])
  const walk = (pid: string) => {
    for (const ch of childrenOf.get(pid) || []) {
      if (seen.has(ch.id)) continue
      seen.add(ch.id)
      out.push(ch.id)
      walk(ch.id)
    }
  }
  walk(rootId)
  return out
}
