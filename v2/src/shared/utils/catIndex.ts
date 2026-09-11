/**
 * R71：分类树索引层（性能治理）
 *
 * 背景：分类树相关的视图逻辑此前处处写成
 *     cats.value.find(c => c.id === pid)        // O(n) 全表扫描
 *     cats.value.filter(c => c.parentId === id) // O(n) 全表扫描
 * 这些调用被打包进**递归函数**与**模板表达式**里，单个节点的渲染成本是 O(n)，
 * 整棵树一次重渲染就是 O(n²)（资源台左树的节点计数、策展台侧栏的展开箭头、
 * 金字塔布局与深度计算都是重灾区）。760 张卡 / 100 个分类的规模下，
 * 一次视图切换就会产生数十万次无谓比较 —— 这正是「卡顿」的根因。
 *
 * 本模块把「一次 O(n) 建索引 + 之后 O(1) 查表」固化下来：
 *   - byId / childrenOf：O(1) 查找与子节点遍历（子节点按 order 预排序，免去每次 sort）
 *   - roots：根节点列表（parentId 缺省，或父节点已不存在——后者同时避免孤儿节点在界面消失）
 *   - descendants / family：带 visited 的 DFS + **结果缓存**（同一棵树内多次调用只算一次）
 *   - depthOf / pathOf：沿父链上行 + 缓存（各带 visited 防环）
 *
 * 约定：索引是**不可变快照**，由 computed 在其依赖的分类数组变化时重建；
 * 视图层只读消费，不得修改索引返回的数组。
 * 环 / 孤儿数据的处理与 catTree.ts 的 sanitizeCategoryTree 同口径：能显示就显示，绝不死转。
 */

import type { CatLike } from './catTree'

export interface CatNodeLike extends CatLike {
  name?: string
  order?: number
}

export interface CatIndex<T extends CatNodeLike> {
  /** id → 节点（O(1)） */
  byId: Map<string, T>
  /** parentId → 子节点（已按 order 升序预排序，O(1) 取用） */
  childrenOf: Map<string, T[]>
  /** 根节点（无 parentId，或 parentId 指向不存在的节点——孤儿提根，与导入净化同口径） */
  roots: T[]
  /** 子节点数量（O(1)，替代 childCatsOf(id).length） */
  childCount(id: string): number
  /** 是否为某节点的子级 */
  hasChildren(id: string): boolean
  /** 全部后代 id（不含自身），带 visited + 缓存 */
  descendants(id: string): string[]
  /** 自身 + 全部后代 id（过滤/计数共用口径），带缓存 */
  family(id: string): string[]
  /** 层级：根 = 1（与 MAX_CAT_LEVEL 同基），带 visited + 缓存 */
  depthOf(id: string): number
  /** 从根到该节点的显示路径「根 / 子 / 孙」，带 visited + 缓存 */
  pathOf(id: string, sep?: string): string
}

/** 构建一次性的分类树索引（对任意分类数组调用；视图层用 computed 包裹即可） */
export function buildCatIndex<T extends CatNodeLike>(cats: readonly T[]): CatIndex<T> {
  const byId = new Map<string, T>()
  for (const c of cats) if (c) byId.set(c.id, c)

  const childrenOf = new Map<string, T[]>()
  const roots: T[] = []
  for (const c of cats) {
    if (!c) continue
    // 孤儿（父节点不存在）与自引用一律视作根——与 sanitizeCategoryTree 同口径，避免节点在界面消失
    if (!c.parentId || c.parentId === c.id || !byId.has(c.parentId)) { roots.push(c); continue }
    const arr = childrenOf.get(c.parentId)
    if (arr) arr.push(c)
    else childrenOf.set(c.parentId, [c])
  }
  for (const c of cats) if (!c || c.parentId === c.id) continue
  for (const arr of childrenOf.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const descCache = new Map<string, string[]>()
  const familyCache = new Map<string, string[]>()
  const depthCache = new Map<string, number>()
  const pathCache = new Map<string, string>()

  /** 带 visited 的 DFS——环数据下必须提前止步，否则渲染路径会栈溢出/死转 */
  function descendants(id: string): string[] {
    const hit = descCache.get(id)
    if (hit) return hit
    const out: string[] = []
    const seen = new Set<string>([id])
    const walk = (pid: string) => {
      for (const ch of childrenOf.get(pid) || []) {
        if (seen.has(ch.id)) continue
        seen.add(ch.id)
        out.push(ch.id)
        walk(ch.id)
      }
    }
    walk(id)
    descCache.set(id, out)
    return out
  }

  function family(id: string): string[] {
    const hit = familyCache.get(id)
    if (hit) return hit
    const out = [id, ...descendants(id)]
    familyCache.set(id, out)
    return out
  }

  function depthOf(id: string): number {
    const hit = depthCache.get(id)
    if (hit != null) return hit
    let n = 1
    const seen = new Set<string>([id])
    let cur: T | undefined = byId.get(id)
    let pid = cur?.parentId
    while (pid) {
      if (seen.has(pid)) break
      seen.add(pid)
      const p = byId.get(pid)
      if (!p) break
      n++
      cur = p
      pid = p.parentId
    }
    depthCache.set(id, n)
    return n
  }

  function pathOf(id: string, sep = ' / '): string {
    const key = id + '\u0000' + sep
    const hit = pathCache.get(key)
    if (hit != null) return hit
    const names: string[] = []
    const seen = new Set<string>()
    let cur: T | undefined = byId.get(id)
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      names.unshift(cur.name ?? '')
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    const s = names.join(sep)
    pathCache.set(key, s)
    return s
  }

  return {
    byId,
    childrenOf,
    roots,
    childCount: (id) => (childrenOf.get(id) || []).length,
    hasChildren: (id) => (childrenOf.get(id) || []).length > 0,
    descendants,
    family,
    depthOf,
    pathOf
  }
}

/**
 * 卡片按分类的分桶索引（O(n) 一次建桶，替代视图层反复 filter）。
 * 用途：某分类下有多少卡、某分类直属卡列表——卡片/列表/看板/金字塔都要。
 */
export function buildBucketIndex<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const k = keyOf(it) || ''
    const arr = map.get(k)
    if (arr) arr.push(it)
    else map.set(k, [it])
  }
  return map
}
