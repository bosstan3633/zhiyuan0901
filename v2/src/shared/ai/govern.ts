/**
 * R137：库内治理任务书工厂（批次 F 第四刀）。四场景共用「投影→chat→行→采纳」骨架，
 * 采纳动作全部走既有字段通道：标签合并=卡片 tags 双口径替换+标签树剪枝；rehome=前缀改写+树挪节点；
 * 捞回=deletedAt 置空；镜像=hub.ts projectCardToBoard（零源数据影响）；主题漂移=只读。
 */
import type { AppData, TagNode } from '@/shared/models'
import { uid } from '@/shared/utils'
import { projectCardToBoard } from '@/shared/storage/hub'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { extractJson } from './llm'
import { projectTagSystem, projectTrash, projectCrossDeck, projectThesis } from './project'
import {
  tagGovernSystem, trashRescueSystem, crossDeckDupSystem, thesisDriftSystem,
  sanitizeRefs, type TagMerge, type TagRehome, type TrashVerdict, type DupPair, type ThesisDrift,
} from './scenarios'

export interface GovernCtx { d: AppData; depth: AiDepth; persist: () => void }

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
