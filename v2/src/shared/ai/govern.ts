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
/** 蓝图采纳后的定稿树（模块态，同会话内给阶段③归架当判据；不落盘） */
let lastTagTreeBlueprint: { name: string; definition?: string; children: { name: string; definition?: string }[] }[] = []
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

// ============== R143 · 标签整体梳理（蓝图 → 全卡补全打标，两道评审门 + 快照还原） ==============

/** 同会话正文抽样缓存（蓝图阶段按需抓的，归架阶段直接复用，零重抓） */
const reviseSnips = new Map<string, string>()
const SNIP_CAP: Record<AiDepth, number> = { eco: 30, std: 60, deep: 150 }

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

/** 蓝图快照：整树 + 将被映射触及的卡旧 tags（还原即回此处；三类卡同快照，与迁移级联口径对齐） */
async function saveTagReviseBackup(d: AppData): Promise<void> {
  const cardTags: Record<string, string[]> = {}
  for (const arr of [d.resources, d.tasks, d.curiosities] as { id: string; tags?: string[]; deletedAt?: number }[][]) {
    for (const x of arr || []) if (!x.deletedAt) cardTags[x.id] = [...(x.tags || [])]
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
    const b = r?.[TAG_REVISE_BACKUP_KEY] as { tagTree: TagNode[]; cardTags: Record<string, string[]> } | undefined
    if (!b?.tagTree) return '⚠ 没有可还原的快照'
    d.tagTree = b.tagTree
    for (const [id, tags] of Object.entries(b.cardTags || {})) {
      const card = (d.resources || []).find(x => x.id === id) || (d.tasks || []).find(x => x.id === id) || (d.curiosities || []).find(x => x.id === id)
      if (card && !card.deletedAt) card.tags = tags
    }
    await chrome.storage.local.remove(TAG_REVISE_BACKUP_KEY)
    persist()
    return '✓ 已还原到整体梳理前（树与卡片标签全部回滚）'
  } catch { return '⚠ 还原失败（存储读取异常）' }
}

/** 梳理·阶段②蓝图评审门：盘点全卡 + 按需抽正文 → 新树 + 迁移映射（采纳=快照+重建+级联套卡） */
export function buildTagBlueprintJob(ctx: GovernCtx): AiJob | null {
  const alive = (ctx.d.resources || []).filter(r => !r.deletedAt)
  if (alive.length < 6) return null
  const usedTags = new Set<string>()
  eachTagHolder(ctx.d, x => { if (!x.deletedAt) for (const t of x.tags || []) usedTags.add(t) })
  const parseRows = (bag: { tree?: BlueprintRoot[]; mappings?: TagMapping[] }): AiRow[] => {
    const { roots, mappings } = sanitizeBlueprint(bag, usedTags)
    const rows: AiRow[] = []
    roots.forEach((r, i) => rows.push({
      key: 'rev:root:' + r.name + ':' + i, badge: '🌲 顶层', main: `${r.name}（${r.children.length} 子）`,
      sub: [r.definition, ...r.children.map(c => `· ${c.name}：${c.definition || '（没给定义）'}`)].filter(Boolean).join('\n'),
      data: { __root: r },
    }))
    mappings.forEach((m, i) => rows.push({
      key: 'rev:map:' + m.from + ':' + i, badge: '↪ 迁移', main: `「${m.from}」→ ${m.to}`, sub: m.why, data: { __map: m },
    }))
    if (!mappings.length && rows.length) rows.unshift({ key: 'rev:note', badge: '参谋', advisory: true, main: '模型没给出可用的旧标签迁移（旧标签全部不在树里？），采纳只会建空树、不动卡', data: { __note: 1 } })
    return rows
  }
  return {
    title: '标签整体梳理 ②·蓝图评审',
    subject: `🏷 全量盘点 ${alive.length} 张资源卡`,
    hint: '勾选你要的顶层标签与迁移映射（未勾选的顶层，其映射一并作废）。采纳前自动存快照，标签管理页「↺ 还原上次梳理」一键回滚。',
    build: () => ({ messages: [{ role: 'system', content: tagBlueprintSystem() }, { role: 'user', content: projectTagBlueprint(ctx.d, ctx.depth, reviseSnips) }] }),
    parse: (raw) => parseRows((raw || {}) as { tree?: BlueprintRoot[]; mappings?: TagMapping[] }),
    async run({ signal, onDelta }) {
      const need = alive.filter(r => (r.description || '').trim().length < 10 && linkFetchable(r.link)).slice(0, SNIP_CAP[ctx.depth])
      let done = 0; let got = 0
      for (const r of need) {
        if (signal.aborted) break
        if (!reviseSnips.has(r.id)) {
          const t = await fetchLinkText(r.link!)
          if (t.text) { reviseSnips.set(r.id, t.text.slice(0, 400)); got++ }
        }
        done++; if (done % 5 === 0) onDelta(`✅ 按需抓取链接正文 ${done}/${need.length}（成功 ${got}）——描述空缺的卡先读再判`)
      }
      onDelta(`✅ 盘点 ${alive.length} 卡 · 补读正文 ${reviseSnips.size} 篇 → ⏳ 架构师起草标签蓝图（一次全库推理，可能需要 1~2 分钟）…`)
      const text = await chatStream({
        messages: [{ role: 'system', content: tagBlueprintSystem() }, { role: 'user', content: projectTagBlueprint(ctx.d, ctx.depth, reviseSnips) }],
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
      ctx.d.tagTree = roots.map<import('@/shared/models').TagNode>(r => ({ id: uid('tag'), name: r.name, children: r.children.length ? r.children.map(c => ({ id: uid('tag'), name: c.name })) : undefined }))
      let moved = 0
      const mapByFrom = new Map<string, string>(valid.map(m => [m.from as string, m.to as string]))
      eachTagHolder(ctx.d, x => {
        if (x.deletedAt || !x.tags || !x.tags.length) return
        let touched = false
        const kept = x.tags.map(t => { const to = mapByFrom.get(t) || mapByFrom.get(leaf(t) || ''); if (to) { touched = true; return to } return t })
        if (touched) { x.tags = [...new Set(kept)].slice(0, 10); moved++ }
      })
      lastTagTreeBlueprint = roots
      blueprintAdoptedFlag = true
      ctx.persist()
      return `✓ 新标签树已立（${roots.length} 顶层）· ${moved} 张卡完成迁移映射${valid.length < maps.length ? ` · ${maps.length - valid.length} 条映射因顶层未勾选作废` : ''}`
    },
  }
}

/** 梳理·阶段③全卡归架门：拿蓝图树（含定义）逐批 30 卡判定归宿 + 填空/救敷衍描述 */
export function buildTagAssignJob(ctx: GovernCtx): AiJob | null {
  const tree = lastTagTreeBlueprint
  if (!tree.length) return null
  const alive = (ctx.d.resources || []).filter(r => !r.deletedAt)
  const paths = new Set<string>()
  for (const r of tree) { paths.add(r.name); for (const c of r.children) paths.add(r.name + '/' + c.name) }
  const treeBlock = tree.map(r => `- ${r.name}（收：${r.definition || '未定义'}）\n${r.children.map(c => `  - ${r.name}/${c.name}（收：${c.definition || '未定义'}）`).join('\n')}`).join('\n')
  const batchText = (batch: ResourceCard[]) => batch.map(r => {
    const snip = reviseSnips.get(r.id)
    return `- cardId=${r.id} 「${(r.title || '').slice(0, 40)}」 现描述:${r.description?.trim() ? '「' + r.description.trim().slice(0, 60) + '」' : '（空）'}\n  ${snip ? '正文节选：' + snip.replace(/\s*\n\s*/g, ' ').slice(0, 300) : (r.link || '无链接')}`
  }).join('\n')
  return {
    title: '标签整体梳理 ③·全卡归架',
    subject: `🏷 ${alive.length} 张卡按新树打标 + 补全（每批 30 张）`,
    hint: '逐卡选唯一归宿（宁缺毋滥可空）；描述只填空缺与救敷衍（<10字且有正文依据）。采纳=勾选卡一次性写库。',
    build: () => ({ messages: [{ role: 'system', content: tagAssignSystem() }, { role: 'user', content: '' }] }),
    parse: (raw) => {
      const items = ((raw as { items?: AssignVerdict[] })?.items || [])
      const rows: AiRow[] = []
      for (const it of items) {
        const card = alive.find(r => r.id === String(it.cardId))
        if (!card) continue
        const path = String(it.path || '').trim()
        const desc = String(it.description || '').trim().slice(0, 120)
        const canDesc = desc && (!(card.description || '').trim() || (card.description || '').trim().length < 10)
        if (!paths.has(path) && !canDesc) continue
        rows.push({
          key: 'assign:' + card.id, badge: '🏷', main: `「${card.title.slice(0, 22)}」${path ? '→ ' + path : '（保持无架）'}`,
          sub: [path ? '' : '不给 path=不强塞', canDesc ? '描述：' + desc : '', String(it.why || '').slice(0, 30)].filter(Boolean).join(' · '),
          data: { cardId: card.id, path: paths.has(path) ? path : '', description: canDesc ? desc : '' },
        })
      }
      return rows
    },
    async run({ signal, onDelta }) {
      const BATCH = 30
      const all: AiRow[] = []
      const batches = Math.ceil(alive.length / BATCH)
      for (let bi = 0; bi < batches; bi++) {
        if (signal.aborted) break
        const batch = alive.slice(bi * BATCH, (bi + 1) * BATCH)
        onDelta(`⏳ 第 ${bi + 1}/${batches} 批归架中（${batch.length} 张）… 已产出 ${all.length} 条`)
        const text = await chat({
          messages: [
            { role: 'system', content: tagAssignSystem() },
            { role: 'user', content: `【已定稿标签树】\n${treeBlock}\n\n【本批卡片】\n${batchText(batch)}` },
          ],
        })
        all.push(...parseRowsOf(text))
      }
      if (!all.length) throw new Error('归架器没有给出任何可落行的判定（可能全库描述已齐且无待改标签）')
      onDelta(`✅ 归架完成：${all.length} 张卡有判定`)
      return all
    },
    apply: (rows) => {
      let tagged = 0; let filled = 0
      for (const r of rows) {
        const s = r.data as { cardId: string; path: string; description: string }
        const card = (ctx.d.resources || []).find(x => x.id === s.cardId && !x.deletedAt)
        if (!card) continue
        if (s.path) {
          const drop = new Set<string>()
          for (const p of paths) { drop.add(p); drop.add(leaf(p)) }
          const kept = (card.tags || []).filter(t => !drop.has(t))
          card.tags = [...new Set([...kept, s.path])].slice(0, 10)
          tagged++
        }
        if (s.description && (!(card.description || '').trim() || (card.description || '').trim().length < 10)) { card.description = s.description; filled++ }
        card.updatedAt = Date.now()
      }
      ctx.persist()
      return `✓ ${tagged} 张卡归入新树 · ${filled} 张补齐/救回描述（待归类的下次梳理再收）`
    },
  }
  function parseRowsOf(t: string): AiRow[] {
    const bag = extractJson(t) as { items?: AssignVerdict[] }
    const rows: AiRow[] = []
    for (const it of bag?.items || []) {
      const card = alive.find(r => r.id === String(it.cardId))
      if (!card) continue
      const path = String(it.path || '').trim()
      const desc = String(it.description || '').trim().slice(0, 120)
      const canDesc = desc && (!(card.description || '').trim() || (card.description || '').trim().length < 10)
      if (!paths.has(path) && !canDesc) continue
      rows.push({ key: 'assign:' + card.id, badge: '🏷', main: `「${card.title.slice(0, 22)}」${path ? '→ ' + path : '（保持无架）'}`, sub: [canDesc ? '描述：' + desc : '', String(it.why || '').slice(0, 30)].filter(Boolean).join(' · '), data: { cardId: card.id, path: paths.has(path) ? path : '', description: canDesc ? desc : '' } })
    }
    return rows
  }
}
