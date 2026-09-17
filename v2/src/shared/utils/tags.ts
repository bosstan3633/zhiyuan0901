/**
 * R126（诉求 7）：标签体系工具——「父/子」路径格式 + 最多两级 + 卡片标签归一化。
 *
 * 存储口径：
 *   - 卡片标签（resources/tasks/curiosities 的 tags）：根标签 = 名称；子标签 = 「父/子」路径（分隔符 `/`）
 *   - 标签树（AppData.tagTree）：最多两级（根 + 子）
 *   - 幂等：已含 `/` 的标签视为已归一；三级节点提升后不再回退
 */
import type { AppData, TagNode } from '../models'

export const TAG_SEP = '/'

export function tagPathOf(parentName: string, childName: string): string {
  return parentName + TAG_SEP + childName
}

/** 最多两级：把存量三级（及更深）节点提升到根（祖父）下；返回是否有变更 */
export function flattenTagTree(tree: TagNode[]): boolean {
  let changed = false
  const walk = (nodes: TagNode[]) => {
    for (const n of nodes) {
      const kids = n.children || []
      for (const k of kids) {
        const gk = k.children || []
        if (!gk.length) continue
        changed = true
        for (const g of gk) {
          if (!kids.some((x) => x.name === g.name && x !== k)) kids.push(g)
        }
        k.children = []
      }
    }
  }
  walk(tree)
  return changed
}

/** 卡片标签归一化（启动期，幂等）：子标签名 → 「父/子」路径；返回是否有变更 */
export function normalizeCardTagPaths(d: AppData): boolean {
  let changed = flattenTagTree(d.tagTree || [])
  const childPathByName = new Map<string, string>()
  for (const root of d.tagTree || []) {
    for (const ch of root.children || []) {
      if (!childPathByName.has(ch.name)) childPathByName.set(ch.name, tagPathOf(root.name, ch.name))
    }
  }
  const fix = (arr?: string[]): string[] | undefined => {
    if (!Array.isArray(arr) || !arr.length) return arr
    let hit = false
    const out = arr.map((t) => {
      if (!t || t.includes(TAG_SEP)) return t
      const p = childPathByName.get(t)
      if (p) { hit = true; return p }
      return t
    })
    if (hit) changed = true
    return hit ? out : arr
  }
  for (const r of d.resources || []) { const n2 = fix(r.tags); if (n2 !== r.tags) r.tags = n2! }
  for (const t of d.tasks || []) { const n2 = fix(t.tags); if (n2 !== t.tags) t.tags = n2! }
  for (const c of d.curiosities || []) { const n2 = fix(c.tags); if (n2 !== c.tags) c.tags = n2! }
  return changed
}
