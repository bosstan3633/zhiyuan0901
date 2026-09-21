/**
 * R137：库内治理任务书工厂（批次 F 第四刀）。四场景共用「投影→chat→行→采纳」骨架，
 * 采纳动作全部走既有字段通道：标签合并=卡片 tags 双口径替换+标签树剪枝；rehome=前缀改写+树挪节点；
 * 捞回=deletedAt 置空；镜像=hub.ts projectCardToBoard（零源数据影响）；主题漂移=只读。
 */
import type { AppData, ResourceCard, TagNode } from '@/shared/models'
import { uid } from '@/shared/utils'
import { projectCardToBoard } from '@/shared/storage/hub'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { chat, chatStream, extractJson } from './llm'
import { projectTagSystem, projectTrash, projectCrossDeck, projectThesis, projectTagBlueprint } from './project'
import { fetchLinkText, linkFetchable } from './linkFetch'
import {
  tagGovernSystem, trashRescueSystem, crossDeckDupSystem, thesisDriftSystem, tagBlueprintSystem, tagAssignSystem,
  sanitizeRefs,
  type TagMerge, type TagRehome, type TrashVerdict, type DupPair, type ThesisDrift,
  type BlueprintRoot, type TagMapping, type AssignVerdict,
} from './scenarios'

export interface GovernCtx { d: AppData; depth: AiDepth; persist: () => void }

/** R143：整体梳理的后悔药快照键（zy_ 前缀独立键，不挂 AppData、不进导出数据链） */
export const TAG_REVISE_BACKUP_KEY = 'zy_tagrevise_backup_v1'
/** 蓝图刚被采纳的接力旗（宿主在抽屉关闭时消费一次，自动续开阶段③） */
let blueprintAdoptedFlag = false
export function consumeTagBlueprintAdopted(): boolean { const v = blueprintAdoptedFlag; blueprintAdoptedFlag = false; return v }

const leaf = (t: string) => t.split('/').pop() || t

/** 三卡集合遍历（标签服务资源/任务/好奇心三类卡，与 ttMoveCards 同口径） */
function eachTagHolder(d: AppData, fn: (x: { tags?: string[]; deletedAt?: number }) => void) {
  for (const arr of [d.resources, d.tasks, d.curiosities] as { tags?: string[]; deletedAt?: number }[][]) for (const x of arr || []) fn(x)
}

/** 在标签树找路径节点（'父/子'），返回 {parent list 引用, index} */
function findTagNode(tree: TagNode[], path: string): { siblings: TagNode[]; index: number } | null {
  const parts = path.split('/').filter(Boolean)
  let siblings: TagNode[] = tree
  for (let i = 0; i < parts.length; i++) {
    const idx = siblings.findIndex(n => n.name === parts[i])
    if (idx < 0) return null
    if (i === parts.length - 1) return { siblings, index: idx }
    siblings = siblings[idx].children || (siblings[idx].children = [])
  }
  return null
}

function tagTreePaths(tree: TagNode[], prefix = ''): string[] {
  const out: string[] = []
  for (const n of tree) { const p = prefix ? `${prefix}/${n.name}` : n.name; out.push(p); if (n.children?.length) out.push(...tagTreePaths(n.children, p)) }
  return out
}

/** E1 标签体系体检：merges + rehome 两类动作合成一份评审清单 */
export function buildTagGovernJob(ctx: GovernCtx): AiJob | null {
  const text = projectTagSystem(ctx.d, ctx.depth)
  if (!/[（(]\d+ 次）/.test(text) && !text.includes('- ')) return null
  return {
    key: 'tagGovern',
    title: '标签体系体检',
    hint: '同义合并（保守：语义有歧义不并）+ 裸标签归位到父标签。采纳会级联改三卡 tags 与标签树，逐条核对再勾。',
    build: () => ({ messages: [{ role: 'system', content: tagGovernSystem() }, { role: 'user', content: text }] }),
    parse: (raw) => {
      const bag = raw as { merges?: TagMerge[]; rehome?: TagRehome[] }
      const rows: AiRow[] = []
      const usedTags = new Set<string>()
      eachTagHolder(ctx.d, x => { if (!x.deletedAt) for (const t of x.tags || []) usedTags.add(t) })
      const treePaths = new Set(tagTreePaths(ctx.d.tagTree || []))
      ;(bag.merges || []).forEach((m, i) => {
        const from = String(m.from || '').trim(); const to = String(m.to || '').trim()
        if (!from || !to || from === to) return
        if (!usedTags.has(from) && !usedTags.has(leaf(from))) return
        if (!usedTags.has(to) && !treePaths.has(to) && ![...treePaths].some(p => p === to || p.endsWith('/' + to))) return
        rows.push({ key: 'mg:' + i, badge: '合并', badgeType: 'warn', main: `#${from} → #${to}`, sub: m.why ? String(m.why).slice(0, 40) : undefined, data: { from, to } })
      })
      ;(bag.rehome || []).forEach((rh, i) => {
        const tag = String(rh.tag || '').trim(); const toParent = String(rh.toParent || '').trim()
        if (!tag || !toParent || tag.includes('/') || tag === toParent) return
        if (!usedTags.has(tag) && !usedTags.has(leaf(tag))) return
        if (!treePaths.has(toParent)) return
        rows.push({ key: 'rh:' + i, badge: '归位', main: `#${tag} 挂到 #${toParent} 下`, sub: rh.why ? String(rh.why).slice(0, 40) : undefined, data: { tag, toParent } })
      })
      return rows
    },
    apply: (rows) => {
      const d = ctx.d
      let merged = 0, rehomed = 0, touched = 0
      for (const r of rows) {
        const data = r.data as { from?: string; to?: string; tag?: string; toParent?: string }
        if (r.key.startsWith('mg:')) {
          const { from, to } = data as { from: string; to: string }
          const fromLeaf = leaf(from)
          eachTagHolder(d, x => {
            if (x.deletedAt || !Array.isArray(x.tags)) return
            const kept = x.tags.filter(t => t !== from && t !== fromLeaf)
            if (kept.length === x.tags.length) return
            x.tags = [...new Set(kept.concat(to))]
            touched++
          })
          const hit = findTagNode(d.tagTree || [], from) || (leaf(from) !== from ? null : findTagNode(d.tagTree || [], from))
          if (hit) { hit.siblings.splice(hit.index, 1); merged++ } else merged++
        } else {
          const { tag, toParent } = data as { tag: string; toParent: string }
          const newPath = `${toParent}/${tag}`
          eachTagHolder(d, x => {
            if (x.deletedAt || !Array.isArray(x.tags)) return
            if (!x.tags.includes(tag)) return
            x.tags = [...new Set(x.tags.filter(t => t !== tag).concat(newPath))]
            touched++
          })
          const node = findTagNode(d.tagTree || [], tag)
          const parent = findTagNode(d.tagTree || [], toParent)
          if (node && parent) {
            const [moved] = node.siblings.splice(node.index, 1)
            parent.siblings[parent.index].children = parent.siblings[parent.index].children || []
            if (!parent.siblings[parent.index].children!.some(c => c.name === moved.name)) parent.siblings[parent.index].children!.push(moved)
            rehomed++
          } else if (parent) {
            parent.siblings[parent.index].children = parent.siblings[parent.index].children || []
            if (!parent.siblings[parent.index].children!.some(c => c.name === tag)) parent.siblings[parent.index].children!.push({ id: uid('tag'), name: tag })
            rehomed++
          }
        }
      }
      ctx.persist()
      return `✓ 治理完成：合并 ${merged} 组 · 归位 ${rehomed} 个 · 触达 ${touched} 张卡`
    },
  }
}

/** H2 回收站捞回：recover 反删 / purge 仅回报 / keep 不动 */
export function buildTrashRescueJob(ctx: GovernCtx): AiJob | null {
  const text = projectTrash(ctx.d, ctx.depth)
  if (!text.includes('cardId=')) return null
  return {
    key: 'trashRescue',
    title: '回收站·值得捞回',
    hint: '对照现存卡与活跃目标逐条判定；勾选采纳=恢复回收站里的卡（purge 条只给建议，真清空请在回收站手动操作）。',
    build: () => ({ messages: [{ role: 'system', content: trashRescueSystem() }, { role: 'user', content: text }] }),
    parse: (raw) => {
      const items = Array.isArray((raw as { items?: TrashVerdict[] })?.items) ? (raw as { items: TrashVerdict[] }).items : []
      const rows: AiRow[] = []
      items.forEach((v, i) => {
        const s = sanitizeRefs({ cardId: v.cardId } as { cardId?: string }, ctx.d)
        const card = (ctx.d.resources || []).find(r => r.id === (s.cardId || v.cardId) && r.deletedAt)
        if (!card || !['recover', 'purge', 'keep'].includes(String(v.verdict))) return
        rows.push({
          key: card.id, badge: v.verdict === 'recover' ? '捞回' : v.verdict === 'purge' ? '清除' : '保留',
          badgeType: v.verdict === 'recover' ? 'ok' : v.verdict === 'purge' ? 'danger' : 'neutral',
          main: card.title, sub: v.reason ? String(v.reason).slice(0, 60) : undefined, data: { cardId: card.id, verdict: v.verdict },
        })
      })
      return rows
    },
    apply: (rows) => {
      const d = ctx.d
      let rec = 0, pur = 0
      for (const r of rows) {
        const v = r.data as TrashVerdict
        const card = d.resources.find(x => x.id === v.cardId && x.deletedAt)
        if (!card) continue
        if (v.verdict === 'recover') { card.deletedAt = undefined; rec++ }
        else if (v.verdict === 'purge') pur++
      }
      if (rec) ctx.persist()
      return `✓ 已恢复 ${rec} 张${pur ? ` · 建议清除 ${pur} 张（请到回收站手动清空）` : ''}`
    },
  }
}

/** G2 跨台镜像发现：采纳=projectCardToBoard（源卡零影响，可去对方台撤镜像反悔） */
export function buildCrossDeckJob(ctx: GovernCtx): AiJob | null {
  const { text, hubIds } = projectCrossDeck(ctx.d, ctx.depth)
  if (!hubIds.size) return null
  return {
    key: 'crossDeck',
    title: '跨台镜像发现',
    hint: '把资源台的好卡镜像进明显需要它的策展台（引用式，源卡零影响）。',
    build: () => ({ messages: [{ role: 'system', content: crossDeckDupSystem() }, { role: 'user', content: text }] }),
    parse: (raw) => {
      const pairs = Array.isArray((raw as { pairs?: DupPair[] })?.pairs) ? (raw as { pairs: DupPair[] }).pairs : []
      const rows: AiRow[] = []
      const wsName = new Map(ctx.d.workspaces.map(w => [w.id, w.name]))
      pairs.forEach((p, i) => {
        const s = sanitizeRefs({ cardId: p.srcId } as { cardId?: string }, ctx.d)
        const src = ctx.d.resources.find(r => r.id === s.cardId && !r.deletedAt && r.workspaceId === 'zy-curation')
        const dst = ctx.d.resources.find(r => r.id === p.dstId && !r.deletedAt && r.workspaceId !== 'zy-curation')
        if (!src || !dst) return
        rows.push({ key: 'p:' + i, badge: '镜像', main: `「${src.title}」→ 台「${wsName.get(dst.workspaceId) || '?'}」`, sub: p.why ? String(p.why).slice(0, 40) : `该台已有相似卡「${dst.title}」可对照`, data: { srcId: src.id, toWs: dst.workspaceId } })
      })
      return rows
    },
    apply: (rows) => {
      const d = ctx.d
      let n = 0
      for (const r of rows) {
        const { srcId, toWs } = r.data as { srcId: string; toWs: string }
        if (projectCardToBoard(d, srcId, toWs)) n++
      }
      if (n) ctx.persist()
      return `✓ 已镜像 ${n} 张卡到目标台`
    },
  }
}

/** G1 主题漂移检测：只读会诊（与诊断 v0 同姿态，不自动写库） */
export function buildThesisJob(ctx: GovernCtx): AiJob | null {
  const text = projectThesis(ctx.d, ctx.depth)
  if (!text) return null
  return {
    key: 'drift',
    title: '金字塔主题漂移检测',
    hint: '逐台核对卡群是否仍支撑主题卡；发现只读，调整动作（移卡/改论点）由你在资源台执行。',
    adoptable: false,
    build: () => ({ messages: [{ role: 'system', content: thesisDriftSystem() }, { role: 'user', content: text }] }),
    parse: (raw) => {
      const items = Array.isArray((raw as { items?: ThesisDrift[] })?.items) ? (raw as { items: ThesisDrift[] }).items : []
      const wsName = new Map(ctx.d.workspaces.map(w => [w.id, w.name]))
      const rows: AiRow[] = []
      items.forEach((f, i) => {
        if (!wsName.has(String(f.wsId)) || !['ok', 'drift'].includes(String(f.verdict))) return
        rows.push({
          key: 't:' + i, badge: f.verdict === 'drift' ? '漂移' : '健康', badgeType: f.verdict === 'drift' ? 'warn' : 'ok',
          main: `台「${wsName.get(f.wsId!)}」`, sub: [f.why, f.evidence].filter(Boolean).join('\n'), data: f,
        })
      })
      return rows
    },
    apply: () => '',
  }
}

// ============== R143 → R151 · 标签整体梳理（蓝图 → 全卡归架） ==============
// R151 三处口径改动（用户拍板）：
//  ① 梳理范围 = **三类卡**（资源/任务/好奇），与标签树"三卡共用"的事实对齐；
//  ② 证据 = **只用卡面字段**，不再抽读链接正文（R143 的按需补读整段对本场景退场，reviseSnips 仍留给 R144 批次 G）；
//  ③ 采纳 = **真·整树替换**：卡上不在新树里的标签一律剪掉（旧版只改被映射命中的，树外标签原地留着），
//     并把收卡定义落进 TagNode.definition（旧版只活在内存，刷新即失效、阶段③起不来）。

/** 同会话正文抽样缓存（R144 批次 G 论点/研判仍在用；整体梳理自 R151 起不再写入） */
export const reviseSnips = new Map<string, string>()
export const SNIP_CAP: Record<AiDepth, number> = { eco: 30, std: 60, deep: 150 }

interface ReviseRoot { name: string; definition?: string; children: { name: string; definition?: string }[] }
function sanitizeBlueprint(bag: { tree?: BlueprintRoot[]; mappings?: TagMapping[] }, usedTags: Set<string>): { roots: ReviseRoot[]; mappings: TagMapping[] } {
  const roots: ReviseRoot[] = []
  const seen = new Set<string>()
  for (const r0 of bag.tree || []) {
    const name = String(r0?.name || '').trim().slice(0, 12)
    if (!name || seen.has(name)) continue
    seen.add(name)
    const kids: ReviseRoot['children'] = []
    const kseen = new Set<string>()
    for (const c0 of (r0.children || []).slice(0, 8)) {
      const cn = String(c0?.name || '').trim().slice(0, 12)
      if (!cn || kseen.has(cn) || cn === name) continue
      kseen.add(cn)
      kids.push({ name: cn, definition: String(c0?.definition || '').trim().slice(0, 40) })
      if (kids.length >= 6) break
    }
    roots.push({ name, definition: String(r0?.definition || '').trim().slice(0, 40), children: kids })
    if (roots.length >= 10) break
  }
  const total = roots.reduce((n, r) => n + 1 + r.children.length, 0)
  const paths = new Set<string>()
  for (const r of roots) { paths.add(r.name); for (const c of r.children) paths.add(r.name + '/' + c.name) }
  const mappings: TagMapping[] = []
  const mseen = new Set<string>()
  for (const m of (bag.mappings || [])) {
    const from = String(m?.from || '').trim(); const to = String(m?.to || '').trim()
    if (!from || !to || mseen.has(from)) continue
    if (!usedTags.has(from) && !usedTags.has(leaf(from))) continue
    if (!paths.has(to)) continue
    mseen.add(from)
    mappings.push({ from, to, why: String(m.why || '').trim().slice(0, 40) })
  }
  return { roots: total > 40 ? trimTree(roots) : roots, mappings }
}
/** 节点总数 ≤40：从后往前砍子、再砍顶层 */
function trimTree(roots: ReviseRoot[]): ReviseRoot[] {
  const out = roots.map(r => ({ ...r, children: [...r.children] }))
  let total = out.reduce((n, r) => n + 1 + r.children.length, 0)
  while (total > 40) {
    const deepest = [...out].reverse().find(r => r.children.length)
    if (deepest) { deepest.children.pop(); total-- } else { out.pop(); total--; }
  }
  return out.filter(r => r.children.length > 0 || out.length <= 9)
}

/** 三卡统一读法（梳理与归架共用；label 是"这张卡叫什么"，好奇卡是 question） */
interface TagCardLike { id: string; label: string; tags: string[]; description: string; updatedAt?: number }
function tagCards(d: AppData): TagCardLike[] {
  const out: TagCardLike[] = []
  for (const r of d.resources || []) if (!r.deletedAt) out.push({ id: r.id, label: r.title, tags: r.tags || [], description: r.description || '', updatedAt: r.updatedAt })
  for (const t of d.tasks || []) if (!t.deletedAt) out.push({ id: t.id, label: t.title, tags: t.tags || [], description: t.description || '', updatedAt: t.updatedAt })
  for (const c of d.curiosities || []) if (!c.deletedAt) out.push({ id: c.id, label: c.question, tags: c.tags || [], description: c.description || '', updatedAt: c.updatedAt })
  return out
}
function findTagCard(d: AppData, id: string) {
  return (d.resources || []).find(x => x.id === id && !x.deletedAt)
    || (d.tasks || []).find(x => x.id === id && !x.deletedAt)
    || (d.curiosities || []).find(x => x.id === id && !x.deletedAt)
}

/**
 * 预估收卡数：**本地核算**，不取模型口算值（用户拍板）。
 * 判据 = 卡面现有标签 → 经"旧→新迁移映射"落到哪个新标签；根标签按**含子树合计**计（与 R151 角标同口径），
 * 一张卡同时命中父与子时只算一次，避免重复计数。
 */
function estimateFit(d: AppData, roots: ReviseRoot[], mappings: TagMapping[]) {
  const paths = new Set<string>()
  for (const r of roots) { paths.add(r.name); for (const c of r.children) paths.add(r.name + '/' + c.name) }
  const mapBy = new Map<string, string>()
  for (const m of mappings) if (m.from && paths.has(String(m.to))) mapBy.set(String(m.from), String(m.to))
  const byPath = new Map<string, number>()
  const byRoot = new Map<string, number>()
  const cards = tagCards(d)
  let covered = 0
  for (const x of cards) {
    const hitPath = new Set<string>(); const hitRoot = new Set<string>()
    for (const t of x.tags) {
      let p = mapBy.get(t) || mapBy.get(leaf(t)) || ''
      if (!p && paths.has(t)) p = t
      if (!p && paths.has(leaf(t))) p = leaf(t)
      if (!p) continue
      hitPath.add(p); hitRoot.add(p.split('/')[0])
    }
    if (!hitPath.size) continue
    covered++
    for (const p of hitPath) byPath.set(p, (byPath.get(p) || 0) + 1)
    for (const r of hitRoot) byRoot.set(r, (byRoot.get(r) || 0) + 1)
  }
  return { byPath, byRoot, covered, bare: cards.length - covered, total: cards.length }
}

/** 蓝图快照：整树 + 三类卡旧 tags 与描述（R151：描述也进快照，否则阶段③补的描述还原不回来） */
async function saveTagReviseBackup(d: AppData): Promise<void> {
  const cardTags: Record<string, { tags: string[]; description: string }> = {}
  for (const arr of [d.resources, d.tasks, d.curiosities] as { id: string; tags?: string[]; description?: string; deletedAt?: number }[][]) {
    for (const x of arr || []) if (!x.deletedAt) cardTags[x.id] = { tags: [...(x.tags || [])], description: x.description || '' }
  }
  try { await chrome.storage.local.set({ [TAG_REVISE_BACKUP_KEY]: { at: Date.now(), tagTree: JSON.parse(JSON.stringify(d.tagTree || [])), cardTags } }) } catch { /* 快照失败不阻断，摘要里如实报告 */ }
}
export async function getTagReviseBackup(): Promise<{ at: number } | null> {
  try {
    const r = await chrome.storage.local.get(TAG_REVISE_BACKUP_KEY)
    const b = r?.[TAG_REVISE_BACKUP_KEY]
    return b && b.tagTree ? { at: b.at } : null
  } catch { return null }
}
export async function restoreTagReviseBackup(d: AppData, persist: () => void): Promise<string> {
  try {
    const r = await chrome.storage.local.get(TAG_REVISE_BACKUP_KEY)
    const b = r?.[TAG_REVISE_BACKUP_KEY] as { tagTree: TagNode[]; cardTags: Record<string, { tags?: string[]; description?: string } | string[]> } | undefined
    if (!b?.tagTree) return '⚠ 没有可还原的快照'
    d.tagTree = b.tagTree
    // R151：还原也要 +1 版本戳——否则"替换过"这件事在别的上下文看来没发生，并集又会把新树并回来
    d.tagTreeRevision = (d.tagTreeRevision || 0) + 1
    let n = 0
    for (const [id, snap] of Object.entries(b.cardTags || {})) {
      const card = findTagCard(d, id)
      if (!card) continue
      const tags = Array.isArray(snap) ? snap : snap.tags
      card.tags = [...(tags || [])]
      if (!Array.isArray(snap) && snap.description != null) (card as { description?: string }).description = snap.description
      n++
    }
    await chrome.storage.local.remove(TAG_REVISE_BACKUP_KEY)
    persist()
    return `✓ 已还原到整体梳理前（树 + ${n} 张卡的标签与描述全部回滚）`
  } catch { return '⚠ 还原失败（存储读取异常）' }
}

/** 梳理·阶段②蓝图评审门：盘点三类卡（只用卡面字段）→ 新树 + 迁移映射 + 本地核算的预估收卡数 */
export function buildTagBlueprintJob(ctx: GovernCtx): AiJob | null {
  const cards = tagCards(ctx.d)
  if (cards.length < 6) return null
  const byType = { res: (ctx.d.resources || []).filter(r => !r.deletedAt).length, task: (ctx.d.tasks || []).filter(t => !t.deletedAt).length, curio: (ctx.d.curiosities || []).filter(c => !c.deletedAt).length }
  const usedTags = new Set<string>()
  eachTagHolder(ctx.d, x => { if (!x.deletedAt) for (const t of x.tags || []) usedTags.add(t) })
  const parseRows = (bag: { tree?: BlueprintRoot[]; mappings?: TagMapping[] }): AiRow[] => {
    const { roots, mappings } = sanitizeBlueprint(bag, usedTags)
    const est = estimateFit(ctx.d, roots, mappings)
    const rows: AiRow[] = []
    roots.forEach((r, i) => rows.push({
      key: 'rev:root:' + r.name + ':' + i, badge: '🌲 顶层',
      main: `${r.name}（预计 ${est.byRoot.get(r.name) || 0} 张 · ${r.children.length} 子）`,
      sub: [r.definition, ...r.children.map(c => `· ${c.name}：${est.byPath.get(r.name + '/' + c.name) || 0} 张 · ${c.definition || '（没给定义）'}`)].filter(Boolean).join('\n'),
      data: { __root: r },
    }))
    mappings.forEach((m, i) => rows.push({
      key: 'rev:map:' + m.from + ':' + i, badge: '↪ 迁移', main: `「${m.from}」→ ${m.to}`, sub: m.why, data: { __map: m },
    }))
    if (rows.length) rows.unshift({
      key: 'rev:note', badge: '参谋', advisory: true,
      main: `按现有标签与迁移映射本地核算：${est.covered}/${est.total} 张卡已有归宿，${est.bare} 张采纳后会被清空标签等逐卡归架`,
      sub: '数字是本地数出来的，不是模型报的；预估为 0 的标签说明模型没给它配到卡，考虑删掉或补映射。',
      data: { __note: 1 },
    })
    if (!mappings.length && roots.length) rows.push({ key: 'rev:warn', badge: '⚠', badgeType: 'warn', advisory: true, main: '模型没给出可用的旧标签迁移——采纳后绝大多数卡的旧标签会被剪掉（快照可还原）', data: { __warn: 1 } })
    return rows
  }
  return {
    key: 'tagBlueprint',
    title: '标签整体梳理 ②·蓝图评审',
    subject: `🏷 全量盘点 ${cards.length} 张卡（资源 ${byType.res} · 任务 ${byType.task} · 好奇 ${byType.curio}）`,
    hint: '只用卡面现有字段判断（不读链接正文）。勾选你要的顶层标签与迁移映射（未勾选的顶层，其映射一并作废）。采纳=整树替换：卡上不在新树里的标签会被剪掉，清空的那些随后跑「③ 逐卡归架」。采纳前自动存快照，标签管理页「↺ 还原上次梳理」一键回滚（含描述）。',
    build: () => ({ messages: [{ role: 'system', content: tagBlueprintSystem() }, { role: 'user', content: projectTagBlueprint(ctx.d, ctx.depth) }] }),
    parse: (raw) => parseRows((raw || {}) as { tree?: BlueprintRoot[]; mappings?: TagMapping[] }),
    async run({ signal, onDelta }) {
      onDelta(`✅ 盘点 ${cards.length} 张卡（三类）· 只用卡面字段 → ⏳ 架构师起草标签蓝图（一次全库推理，可能需要 1~2 分钟）…`)
      const text = await chatStream({
        messages: [{ role: 'system', content: tagBlueprintSystem() }, { role: 'user', content: projectTagBlueprint(ctx.d, ctx.depth) }],
        signal, onDelta: t => onDelta('⏳ 起草蓝图中…' + t.slice(-200).replace(/\s+/g, ' ')),
      })
      if (signal.aborted) return []
      return parseRows((extractJson(text) || {}) as { tree?: BlueprintRoot[]; mappings?: TagMapping[] })
    },
    apply: async (rows) => {
      const roots = rows.map(r => (r.data as { __root?: ReviseRoot }).__root).filter(Boolean) as ReviseRoot[]
      if (!roots.length) return '⚠ 没勾选任何顶层标签，未改动'
      const maps = rows.map(r => (r.data as { __map?: TagMapping }).__map).filter(Boolean) as TagMapping[]
      const rootNames = new Set(roots.map(r => r.name))
      const valid = maps.filter(m => rootNames.has(String(m.to).split('/')[0]))
      await saveTagReviseBackup(ctx.d)
      // 整树替换：definition 一并落盘（阶段③与日后复核都靠它，不再依赖内存态）
      ctx.d.tagTree = roots.map<TagNode>(r => ({
        id: uid('tag'), name: r.name, definition: r.definition || undefined,
        children: r.children.length ? r.children.map<TagNode>(c => ({ id: uid('tag'), name: c.name, definition: c.definition || undefined })) : undefined,
      }))
      ctx.d.tagTreeRevision = (ctx.d.tagTreeRevision || 0) + 1
      const paths = new Set<string>()
      for (const r of roots) { paths.add(r.name); for (const c of r.children) paths.add(r.name + '/' + c.name) }
      const keep = new Set<string>()
      for (const p of paths) { keep.add(p); keep.add(leaf(p)) }
      const mapBy = new Map<string, string>(valid.map(m => [String(m.from), String(m.to)]))
      let moved = 0; let cleared = 0; let touched = 0
      eachTagHolder(ctx.d, x => {
        if (x.deletedAt) return
        const old = x.tags || []
        if (!old.length) return
        touched++
        const next = new Set<string>()
        for (const t of old) {
          const to = mapBy.get(t) || mapBy.get(leaf(t)) || ''
          const p = to && paths.has(to) ? to : (paths.has(t) ? t : paths.has(leaf(t)) ? leaf(t) : '')
          if (p) next.add(p)
        }
        x.tags = [...next].slice(0, 10)
        if (next.size) moved++
        else cleared++
      })
      blueprintAdoptedFlag = true
      ctx.persist()
      return `✓ 新树已立（${roots.length} 顶层 · ${paths.size} 节点）· ${moved} 张卡有归宿 · ${cleared} 张旧标签已剪空（跑「③ 逐卡归架」补）${valid.length < maps.length ? ` · ${maps.length - valid.length} 条映射因顶层未勾选作废` : ''} · 共 ${touched} 张带标签的卡被核对，可「↺ 还原上次梳理」回滚`
    },
  }
}

/** 梳理·阶段③全卡归架门：按**已落盘的新树（含收卡定义）**逐批 30 卡判定归宿；描述只在卡面依据不足时不写 */
export function buildTagAssignJob(ctx: GovernCtx): AiJob | null {
  const tree = (ctx.d.tagTree || []) as TagNode[]
  if (!tree.length) return null
  const cards = tagCards(ctx.d)
  if (!cards.length) return null
  const paths = new Set<string>()
  for (const r of tree) { paths.add(r.name); for (const c of r.children || []) paths.add(r.name + '/' + c.name) }
  const treeBlock = tree.map(r => `- ${r.name}（收：${r.definition || '未定义'}）\n${(r.children || []).map(c => `  - ${r.name}/${c.name}（收：${c.definition || '未定义'}）`).join('\n')}`).join('\n')
  const batchText = (batch: TagCardLike[]) => batch.map(x =>
    `- cardId=${x.id} 「${(x.label || '').slice(0, 40)}」 描述:${x.description.trim() ? '「' + x.description.trim().slice(0, 60) + '」' : '（空）'} 现标签[${x.tags.join('、') || '无'}]`).join('\n')
  function parseRowsOf(t: string): AiRow[] {
    const bag = extractJson(t) as { items?: AssignVerdict[] }
    const rows: AiRow[] = []
    for (const it of bag?.items || []) {
      const card = cards.find(r => r.id === String(it.cardId))
      if (!card) continue
      const path = String(it.path || '').trim()
      const desc = String(it.description || '').trim().slice(0, 120)
      // R151：没有正文依据了——描述只填"完全为空"的卡，敷衍描述不再改写（不拿卡面标题反推一句废话存回去）
      const canDesc = !!desc && !card.description.trim()
      if (!paths.has(path) && !canDesc) continue
      rows.push({
        key: 'assign:' + card.id, badge: '🏷', main: `「${card.label.slice(0, 22)}」${path ? '→ ' + path : '（保持无架）'}`,
        sub: [path ? '' : '不给 path=不强塞', canDesc ? '描述：' + desc : '', String(it.why || '').slice(0, 30)].filter(Boolean).join(' · '),
        data: { cardId: card.id, path: paths.has(path) ? path : '', description: canDesc ? desc : '' },
      })
    }
    return rows
  }
  return {
    key: 'tagAssign',
    title: '标签整体梳理 ③·全卡归架',
    subject: `🏷 ${cards.length} 张卡（三类）按新树打标`,
    hint: '逐卡选唯一归宿（宁缺毋滥可空）；描述只填完全为空的卡（R151 起不读正文，不再"救敷衍描述"）。采纳=勾选卡一次性写库。',
    build: () => ({ messages: [{ role: 'system', content: tagAssignSystem() }, { role: 'user', content: '' }] }),
    parse: (raw) => parseRowsOf(raw as string),
    async run({ signal, onDelta }) {
      const BATCH = 30
      const all: AiRow[] = []
      const batches = Math.ceil(cards.length / BATCH)
      for (let bi = 0; bi < batches; bi++) {
        if (signal.aborted) break
        const batch = cards.slice(bi * BATCH, (bi + 1) * BATCH)
        onDelta(`⏳ 第 ${bi + 1}/${batches} 批归架中（${batch.length} 张）… 已产出 ${all.length} 条`)
        const text = await chat({
          messages: [
            { role: 'system', content: tagAssignSystem() },
            { role: 'user', content: `【已定稿标签树】\n${treeBlock}\n\n【本批卡片】\n${batchText(batch)}` },
          ],
        })
        all.push(...parseRowsOf(text))
      }
      if (!all.length) throw new Error('归架器没有给出任何可落行的判定（可能所有卡都已有归宿）')
      onDelta(`✅ 归架完成：${all.length} 张卡有判定`)
      return all
    },
    apply: (rows) => {
      let tagged = 0; let filled = 0
      const drop = new Set<string>()
      for (const p of paths) { drop.add(p); drop.add(leaf(p)) }
      for (const r of rows) {
        const s = r.data as { cardId: string; path: string; description: string }
        const card = findTagCard(ctx.d, s.cardId) as { tags?: string[]; description?: string; updatedAt?: number } | undefined
        if (!card) continue
        if (s.path) {
          const kept = (card.tags || []).filter(t => !drop.has(t))
          card.tags = [...new Set([...kept, s.path])].slice(0, 10)
          tagged++
        }
        if (s.description && !(card.description || '').trim()) { card.description = s.description; filled++ }
        card.updatedAt = Date.now()
      }
      ctx.persist()
      return `✓ ${tagged} 张卡归入新树 · ${filled} 张补上空描述（仍无归宿的卡下次梳理再收）`
    },
  }
}
