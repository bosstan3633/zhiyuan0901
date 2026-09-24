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

/**
 * R147-a：「既有标签体系」的唯一口径——树上路径 ∪ 树上叶子名 ∪ 活卡在用标签（含叶子段）。
 * AI 补全造的新词不在这里，就该判弱默认不勾：打标克制、宁缺毋滥是产品的既有纪律。
 */
export function knownTagSet(d: AppData): Set<string> {
  const out = new Set<string>()
  const walk = (nodes: TagNode[], prefix: string) => {
    for (const n of nodes || []) {
      const p = prefix ? `${prefix}/${n.name}` : n.name
      out.add(p)
      if (n.children?.length) walk(n.children, p)
    }
  }
  walk(d.tagTree || [], '')
  for (const c of [...(d.resources || []), ...(d.tasks || []), ...(d.curiosities || [])]) {
    if ((c as { deletedAt?: number }).deletedAt) continue
    for (const t of (c as { tags?: string[] }).tags || []) {
      out.add(t)
      const i = t.lastIndexOf(TAG_SEP)
      if (i > 0) out.add(t.slice(i + 1))
    }
  }
  return out
}
/** 挑出没在体系里的新词（叶子名也算命中，避免「笔记法」被当成新词） */
export function freshTagsOf(tags: string[], known: Set<string>): string[] {
  return tags.filter(t => !known.has(t) && !known.has(t.split(TAG_SEP).pop() || t))
}

/**
 * R162：把 AI 给的标签**归一回既有标签体系**——优先返回库里的真名（与 govern.findTagIn 同源三口径：
 * 全名 / 路径 / 叶子名，剥 # 与空白归一），查不到才原样保留（= 真新词，仍走 freshTagsOf 判弱默认不勾）。
 * 需求（用户拍板）：AI 补全标签必须**优先从标签管理里选**，体系里确无贴切者才允许新建。
 */
export function canonicalTagOf(d: AppData, tag: string): string {
  const raw = String(tag ?? '').replace(/^[#＃]\s*/, '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const wl = raw.split(TAG_SEP).pop() || raw
  // ① 树上路径优先（模型写裸子名 → 升级成「父/子」路径落库）
  const treeHit = findPathInTree(d.tagTree || [], '', raw, wl)
  if (treeHit) return treeHit
  // ② 卡面在用标签（保真名，含叶子段口径）
  for (const p of knownTagSet(d)) {
    const np = p.replace(/\s+/g, ' ')
    if (np === raw || (np.split(TAG_SEP).pop() || np) === raw || np === wl) return p
  }
  return raw
}
function findPathInTree(nodes: TagNode[], prefix: string, w: string, wl: string): string {
  for (const n of nodes || []) {
    const p = prefix ? prefix + TAG_SEP + n.name : n.name
    if (p === w || n.name === w || n.name === wl) return p
    if (n.children?.length) { const hit = findPathInTree(n.children, p, w, wl); if (hit) return hit }
  }
  return ''
}
/** 批量归一 + 保序去重 */
export function canonicalTagsOf(d: AppData, tags: string[]): string[] {
  const out: string[] = []
  for (const t of tags || []) {
    const c = canonicalTagOf(d, t)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
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
