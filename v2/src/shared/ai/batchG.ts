/**
 * R144 · 批次 G 场景工厂：论点提炼（G1）/ 好奇研判（G2）/ 找佐证（G3′）/ 成果文稿（G4）。
 * 与 govern.ts 同骨架「投影→chat→行→采纳」，采纳全部走既有字段通道，零新增数据模型：
 *  G1=写主题卡（isThesis）标题与 🤖 论点块；次通道=分论点落成一级分类并归架佐证卡
 *  G2=convert 交宿主 convertToTask / drop=status 'shelf' / keep 只读
 *  G3=hub.ts projectCardToBoard（只投射资源卡池的源卡，源数据零影响）
 *  G4=存一张「成果文稿」资源卡；次通道=下载 .md
 * 链接正文抽样复用 govern 的 reviseSnips 会话缓存（R143 抓过的零重抓）。
 */
import type { AppData, Category, CuriosityCard, ResourceCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { uid } from '@/shared/utils'
import { THESIS_MARK, THESIS_PARTS_MARK, THESIS_WHY_MARK } from '@/shared/models/aiMarks'
import { projectCardToBoard } from '@/shared/storage/hub'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { chatStream, extractJson } from './llm'
import { fetchLinkText, linkFetchable } from './linkFetch'
import { projectDeckThesis, projectCurioPool, projectEvidenceFor, projectDeliverMaterial } from './project'
import { reviseSnips, SNIP_CAP, type GovernCtx } from './govern'
import {
  thesisDraftSystem, curioTriageSystem, evidenceSystem, deliverSystem,
  allPersonas, personaOverrides, chainPersonaText,
  type ThesisPart, type CurioTriage, type EvidencePick,
} from './scenarios'
import { withReport } from './reports'

interface ThesisDraft { name: string; definition: string; cardIds: string[] }

/** 执笔专家选择器（与 chain.ts 同口径：default/停用/查无 = 内置角色） */
function personaPicker(pid: string, onPick: (id: string) => void) {
  const ov = personaOverrides()
  return {
    options: [{ id: 'default', label: '🧑‍🏫 内置角色（默认）' }, ...allPersonas().filter(p => ov[p.id]?.enabled !== false).map(p => ({ id: p.id, label: `${p.icon} ${p.name}` }))],
    current: pid || 'default',
    onPick,
  }
}

/** 按需补读正文（描述空缺/敷衍的卡），进度实时回显；抓过的走缓存 */
async function sampleSnips(items: { id: string; link?: string; description?: string }[], depth: AiDepth, signal: AbortSignal, onDelta: (t: string) => void, tag: string) {
  const need = items.filter(x => (x.description || '').trim().length < 10 && linkFetchable(x.link)).slice(0, SNIP_CAP[depth])
  if (!need.length) return
  let done = 0; let got = 0
  for (const x of need) {
    if (signal.aborted) return
    if (!reviseSnips.has(x.id)) {
      const t = await fetchLinkText(x.link!)
      if (t.text) { reviseSnips.set(x.id, t.text.slice(0, 400)); got++ }
    }
    done++; if (done % 5 === 0) onDelta(`✅ ${tag} 按需抓取正文 ${done}/${need.length}（成功 ${got}）…`)
  }
}

/** 论点卡的 🤖 块：整段替换（重复采纳不堆积，与 chain 的步骤清单同纪律） */
const THESIS_BLOCK = new RegExp(`\n*${THESIS_MARK}[\s\S]*$`)
function thesisBody(thesis: string, why: string, parts: ThesisPart[]): string {
  const seg = [`${THESIS_MARK}${thesis}`]
  if (why) seg.push(`${THESIS_WHY_MARK}${why}`)
  if (parts.length) {
    seg.push('', THESIS_PARTS_MARK)
    parts.forEach((p, i) => seg.push(`${i + 1}. ${p.name}${p.definition ? ` —— ${p.definition}` : ''}${p.cardIds?.length ? `（佐证 ${p.cardIds.length} 张）` : ''}`))
  }
  return seg.join('\n')
}

/** 找/建本台主题卡（isThesis，每台最多一张） */
function ensureThesisCard(d: AppData, wsId: string): { card: ResourceCard; created: boolean } {
  const hit = (d.resources || []).find(r => r.workspaceId === wsId && r.isThesis && !r.deletedAt)
  if (hit) return { card: hit, created: false }
  const card: ResourceCard = {
    id: uid('res'), kind: 'resource', title: '中心论点', linkType: 'url', link: '',
    workspaceId: wsId, categoryId: '', tags: [], pinned: true, callCount: 0,
    createdAt: Date.now(), updatedAt: Date.now(), customFields: {}, isThesis: true,
  } as ResourceCard
  d.resources.unshift(card)
  return { card, created: true }
}

// ============== G1 · 论点提炼 + MECE 骨架 ==============

export interface ThesisGenCtx extends GovernCtx { wsId: string; wsName: string; personaId?: string; onPersona?: (id: string) => void }

export function buildThesisDraftJob(ctx: ThesisGenCtx): AiJob | null {
  const d = ctx.d
  const deck = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId === ctx.wsId && !r.isThesis)
  if (deck.length < 3) return null
  const known = new Map(deck.map(r => [r.id, r.title]))
  /** R147-c：消毒账——丢了什么、为什么丢，抽屉里点名（空态时这是唯一的解释） */
  const drop = { noName: 0, dup: 0, ghostCard: 0, noCard: 0 }
  const parseRows = (bag: { thesis?: string; why?: string; parts?: ThesisPart[] }): AiRow[] => {
    const rows: AiRow[] = []
    const thesis = String(bag.thesis || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    const why = String(bag.why || '').replace(/\s+/g, ' ').trim().slice(0, 90)
    if (!thesis) return [{ key: 'th:empty', badge: '空手', badgeType: 'warn', main: '模型没有立出可用的中心论点', sub: why || '卡群证据不足——补几张描述或先跑标签梳理再试', data: { __none: 1 } }]
    rows.push({ key: 'th:thesis', badge: '🏛 论点', badgeType: 'ok', main: thesis, sub: why ? `依据：${why}` : undefined, data: { __thesis: thesis, __why: why } })
    const used = new Set<string>()
    const seen = new Set<string>()
    ;(bag.parts || []).slice(0, 5).forEach((p, i) => {
      const name = String(p?.name || '').replace(/\s+/g, ' ').trim().slice(0, 12)
      if (!name) { drop.noName++; return }
      if (seen.has(name)) { drop.dup++; return }
      seen.add(name)
      const definition = String(p?.definition || '').replace(/\s+/g, ' ').trim().slice(0, 30)
      // 消毒：id 必须是本台活卡，且一卡只归一支（先到先得，模型重复点名不奖励）
      const asked = [...new Set((p?.cardIds || []).map(String))]
      drop.ghostCard += asked.filter(id => !known.has(id)).length
      const cardIds = asked.filter(id => known.has(id) && !used.has(id)).slice(0, 20)
      cardIds.forEach(id => used.add(id))
      if (!cardIds.length) drop.noCard++
      const draft: ThesisPart = { name, definition, cardIds }
      rows.push({
        key: `th:part:${i}:${name}`, badge: `第${i + 1}支`,
        main: `${name}${definition ? ` · ${definition}` : ''}`,
        sub: cardIds.length ? `佐证 ${cardIds.length} 张：${cardIds.slice(0, 4).map(id => known.get(id)).join('、')}${cardIds.length > 4 ? '…' : ''}` : '（没点到佐证卡）',
        // R147-a：一支没有佐证卡的分论点=还没立住，默认不勾
        weak: !cardIds.length,
        data: { __part: draft },
      })
    })
    return rows
  }
  const sys = () => {
    const base = thesisDraftSystem()
    const p = ctx.personaId ? chainPersonaText(ctx.personaId) : ''
    return p ? `${p}\n\n${base}` : base
  }
  const user = () => projectDeckThesis(d, ctx.wsId, ctx.depth, reviseSnips)
  const job: AiJob = {
    key: 'thesis:' + ctx.wsId,
    title: '🏛 提炼中心论点与骨架',
    subject: `🗂 ${ctx.wsName} · 卡群 ${deck.length} 张`,
    hint: '先按需补读链接正文，再立「一句可被反驳的判断」+ 2~4 支 MECE 分论点。采纳=只写中心论点卡（不动任何分类与卡片归属）；要落成骨架分支用底部「🗂 分论点建成分类」。',
    build: () => ({ messages: [{ role: 'system', content: sys() }, { role: 'user', content: user() }] }),
    parse: raw => parseRows((raw || {}) as { thesis?: string; why?: string; parts?: ThesisPart[] }),
    audit: () => {
      const bits = [drop.ghostCard ? `${drop.ghostCard} 个 cardId 不在本台活卡里` : '', drop.dup ? `${drop.dup} 支重名` : '', drop.noName ? `${drop.noName} 支没名字` : '', drop.noCard ? `${drop.noCard} 支点不到佐证卡（已判弱）` : ''].filter(Boolean)
      return bits.length ? bits.join('、') : null
    },
    async run({ signal, onDelta }) {
      await sampleSnips(deck, ctx.depth, signal, onDelta, '论点提炼')
      if (signal.aborted) return []
      onDelta(`⏳ 架构师读 ${deck.length} 卡立论点中…`)
      const text = await chatStream({
        messages: [{ role: 'system', content: sys() }, { role: 'user', content: user() }],
        signal, onDelta: t => onDelta('⏳ 立论点中…' + t.slice(-200).replace(/\s+/g, ' ')),
      })
      if (signal.aborted) return []
      return parseRows((extractJson(text) || {}) as { thesis?: string; why?: string; parts?: ThesisPart[] })
    },
    apply: (rows) => {
      const th = rows.find(r => (r.data as { __thesis?: string }).__thesis)
      const thesis = String((th?.data as { __thesis?: string }).__thesis || '')
      const parts = rows.map(r => (r.data as { __part?: ThesisPart }).__part).filter(Boolean) as ThesisPart[]
      if (!thesis) return '⚠ 没勾选中心论点，未改动（可只勾分论点走底部「🗂 建成分类」）'
      const { card, created } = ensureThesisCard(d, ctx.wsId)
      const keep = (card.description || '').replace(THESIS_BLOCK, '').trim()
      card.title = thesis.slice(0, 30)
      card.description = (keep ? keep + '\n\n' : '') + thesisBody(thesis, String((th?.data as { __why?: string }).__why || ''), parts)
      card.updatedAt = Date.now()
      ctx.persist()
      return `✓ 中心论点「${card.title}」${created ? '已新建为主题卡' : '已更新'}${parts.length ? ` · 骨架 ${parts.length} 支 · 挂佐证 ${parts.reduce((s, p) => s + (p.cardIds?.length || 0), 0)} 卡次` : ''}（分类与卡片归属未动）`
    },
  }
  job.secondary = {
    label: '🗂 分论点建成分类并归架',
    apply: (rows) => {
      const parts = rows.map(r => (r.data as { __part?: ThesisPart }).__part).filter(p => p?.name && p.cardIds?.length) as ThesisPart[]
      if (!parts.length) return '⚠ 没有勾选带佐证卡的分论点'
      const kids = (d.categories || []).filter(c => c.workspaceId === ctx.wsId && !c.deletedAt && !c.parentId)
      let made = 0; let moved = 0
      for (const p of parts) {
        let cat: Category | undefined = kids.find(c => c.name === p.name)
        if (!cat) {
          if (kids.length >= 12) break // 顶层分支封顶，避免把台撑爆
          cat = { id: uid('cat'), workspaceId: ctx.wsId, name: p.name, order: kids.length } as Category
          d.categories.push(cat); kids.push(cat); made++
        }
        for (const id of p.cardIds || []) {
          const r = d.resources.find(x => x.id === id && !x.deletedAt && x.workspaceId === ctx.wsId)
          if (r && r.categoryId !== cat.id) { r.categoryId = cat.id; moved++ }
        }
      }
      ctx.persist()
      return `✓ 新建 ${made} 个分支分类 · ${moved} 张佐证卡已归架（已有同名分类直接复用）`
    },
  }
  if (ctx.onPersona) job.persona = personaPicker(ctx.personaId || 'default', id => ctx.onPersona?.(id))
  return job
}

// ============== G2 · 好奇心转化研判 ==============

export interface CurioTriageCtx extends GovernCtx {
  pool: CuriosityCard[]
  /** R151：单卡入口为真——「3 条才够比较」是批量口径，套到单卡上会变成"点研判被拒"；单卡的 jobKey 必须带卡 id，否则换一张卡会 attach 到上一张的结果 */
  single?: boolean
  /** 转化动作由宿主提供（走既有 convertToTask：字段随迁 + 落任务 + 源卡软删） */
  onConvert: (c: CuriosityCard, taskTitle: string) => boolean | string
}

export function buildCurioTriageJob(ctx: CurioTriageCtx): AiJob | null {
  const single = !!ctx.single
  const pool = ctx.pool.filter(c => !c.deletedAt && (c.status === 'todo' || c.status === 'doing')).slice(0, SNIP_CAP[ctx.depth])
  if (pool.length < (single ? 1 : 3)) return null
  const byId = new Map(pool.map(c => [c.id, c]))
  const drop = { ghost: 0, badVerdict: 0, noTitle: 0, noWhy: 0 }
  const parseRows = (bag: { items?: CurioTriage[] }): AiRow[] => {
    const rows: AiRow[] = []
    const seen = new Set<string>()
    ;(bag.items || []).forEach((it, i) => {
      const c = byId.get(String(it?.cardId))
      if (!c || seen.has(c.id)) { drop.ghost++; return }
      const v = String(it.verdict || '')
      if (!['convert', 'keep', 'drop'].includes(v)) { drop.badVerdict++; return }
      const title = v === 'convert' ? String(it.taskTitle || '').replace(/\s+/g, ' ').trim().slice(0, 30) : ''
      if (v === 'convert' && !title) { drop.noTitle++; return } // 没给可执行标题的「值得做」不予采纳
      seen.add(c.id)
      const reason = String(it.why || '').trim()
      if (!reason) drop.noWhy++
      rows.push({
        key: `ct:${c.id}:${i}`, badge: v === 'convert' ? '→ 转任务' : v === 'drop' ? '可搁置' : '继续养',
        badgeType: v === 'convert' ? 'ok' : v === 'drop' ? 'warn' : 'neutral',
        main: c.question.slice(0, 40),
        sub: [v === 'convert' ? `建议任务：${title}` : '', reason.slice(0, 60) || '（模型没给判词）'].filter(Boolean).join(' · '),
        // R147-a：没判词的「转任务/搁置」会真的动卡，默认不勾
        weak: !reason,
        data: { __cardId: c.id, __verdict: v, __title: title, __why: reason, __card: c },
      })
    })
    return rows
  }
  const user = () => projectCurioPool(ctx.d, pool.map(c => c.id), ctx.depth, reviseSnips)
  return {
    key: single ? 'triage:' + pool[0].id : 'triage',
    /** R167：单条研判走「判决卡」版式（一条建议摊成左右对照会空半屏）；批量仍是逐条勾选的对照表 */
    ...(single ? { layout: 'verdict' as const } : {}),
    title: single ? '💡 这条好奇要不要转任务' : '💡 好奇心转化研判',
    subject: single ? `💡 单条研判「${pool[0].question.slice(0, 28)}」` : `💡 待探索池 ${pool.length} 条`,
    hint: single
      ? '只判这一条：转任务 / 继续养 / 可搁置，判据是对不对得上愿景与活跃目标。采纳：转=按建议标题走既有转化通道；搁置=置为「已搁置」（不删卡，随时可改回）；继续养=只看不写。'
      : '逐条判「转任务 / 继续养 / 可搁置」，判据是对不对得上愿景与活跃目标。采纳：转=按建议标题走既有转化通道；搁置=置为「已搁置」（不删卡，随时可改回）；继续养=只看不写。',
    build: () => ({ messages: [{ role: 'system', content: curioTriageSystem() }, { role: 'user', content: user() }] }),
    parse: raw => parseRows((raw || {}) as { items?: CurioTriage[] }),
    audit: () => {
      const bits = [drop.ghost ? `${drop.ghost} 行 id 不在研判池或重复点名` : '', drop.badVerdict ? `${drop.badVerdict} 行判决不在白名单` : '', drop.noTitle ? `${drop.noTitle} 行说要转任务却没给标题` : '', drop.noWhy ? `${drop.noWhy} 行没判词（已判弱）` : ''].filter(Boolean)
      return bits.length ? bits.join('、') : null
    },
    async run({ signal, onDelta }) {
      await sampleSnips(pool.map(c => ({ id: c.id, link: c.sourceUrl, description: c.question })), ctx.depth, signal, onDelta, '转化研判')
      if (signal.aborted) return []
      onDelta(`⏳ 参谋逐条研判 ${pool.length} 条好奇心中…`)
      const text = await chatStream({
        messages: [{ role: 'system', content: curioTriageSystem() }, { role: 'user', content: user() }],
        signal, onDelta: t => onDelta('⏳ 研判中…' + t.slice(-200).replace(/\s+/g, ' ')),
      })
      if (signal.aborted) return []
      return parseRows((extractJson(text) || {}) as { items?: CurioTriage[] })
    },
    apply: (rows) => {
      let conv = 0, shelf = 0, keep = 0, fail = 0
      for (const r of rows) {
        const { __cardId: id, __verdict: v, __title: title } = r.data as { __cardId: string; __verdict: string; __title: string }
        const c = byId.get(id)
        if (!c) continue
        // R165-A（方案 A 三态凭据）：研判判决被采纳（转/搁置）即视为 AI 动过本卡；「继续养」不写卡也不落戳
        if (v === 'convert' || v === 'drop') c.aiTouchedAt = Date.now()
        if (v === 'convert') { const ok = ctx.onConvert(c, title); if (ok) conv++; else fail++ }
        else if (v === 'drop') { c.status = 'shelf'; c.updatedAt = Date.now(); shelf++ }
        else keep++
      }
      if (shelf) ctx.persist()
      return `✓ 转化 ${conv} 条为任务 · 搁置 ${shelf} 条${keep ? ` · ${keep} 条继续养着（未改动）` : ''}${fail ? ` · ${fail} 条转化失败（已转或目标变更）` : ''}`
    },
    /**
     * R167：次级动作「判词写进详情」——只把判词追加进正文，**不改状态、不建卡**。
     * 立它的理由：研判最有用的往往是那句判词本身（"先养一周看是否真天天用"），
     * 但用户未必想现在就转/搁置；没有这一条，判词跑完就散了。
     */
    secondary: {
      label: '📝 判词写进详情',
      apply: (rows) => {
        let n = 0
        for (const r of rows) {
          const c = byId.get((r.data as { __cardId: string }).__cardId)
          const why = (r.sub || '').replace(/^（模型没给判词）$/, '').trim()
          if (!c || !why) continue
          if ((c.question || '').includes(why.slice(0, 12))) continue
          c.question = `${c.question}\n\n 研判判词：${why}`
          c.updatedAt = Date.now()
          n++
        }
        if (!n) return '⚠ 没有可写入的判词（模型没给理由，或正文里已有）'
        ctx.persist()
        return `✓ 判词已写进 ${n} 条好奇的正文末段（状态未改）`
      },
    },
  }
}

// ============== G3′ · 金字塔分支找佐证 ==============

export interface EvidenceCtx extends GovernCtx {
  wsId: string
  catId: string
  branchName: string
  branchPath: string
  /** 归架回调（宿主注入以同步界面选中态，可缺省） */
  onApplied?: (n: number) => void
}

export function buildEvidenceJob(ctx: EvidenceCtx): AiJob | null {
  const d = ctx.d
  const board = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
  const inBranch = boardCardsInCat(d, ctx.wsId, ctx.catId)
  const taken = new Set(inBranch.map(x => x.id))
  const candidates = board.filter(r => !taken.has(r.id))
  if (!candidates.length) return null
  const known = new Map(candidates.map(r => [r.id, r.title]))
  const drop = { ghost: 0, noWhy: 0 }
  const parseRows = (bag: { items?: EvidencePick[] }): AiRow[] => {
    const rows: AiRow[] = []
    const seen = new Set<string>()
    ;(bag.items || []).slice(0, 6).forEach((it, i) => {
      const id = String(it?.cardId)
      if (!known.has(id) || seen.has(id)) { drop.ghost++; return } // 消毒：只认目录里真实存在、且尚未挂在本分支的卡
      seen.add(id)
      const reason = String(it.why || '').trim()
      if (!reason) drop.noWhy++
      rows.push({
        key: `ev:${id}:${i}`, badge: '🔗 佐证', main: String(known.get(id)).slice(0, 40),
        sub: reason.slice(0, 60) || '（模型没给理由）', weak: !reason, data: { __cardId: id },
      })
    })
    if (!rows.length && (bag.items || []).length) return [{ key: 'ev:bad', badge: '空手', badgeType: 'warn', main: '模型点名的卡都不在资源卡池里（或已挂在本分支），无可镜像项', data: { __none: 1 } }]
    return rows
  }
  const user = () => projectEvidenceFor(d, ctx.depth, { name: ctx.branchName, path: ctx.branchPath }, inBranch, candidates)
  return {
    key: 'evidence:' + ctx.catId,
    title: '🔍 找佐证（全库推荐）',
    subject: `🏛 ${ctx.branchPath}`,
    hint: '从资源卡池里挑能支撑本分支的卡（本台其它分支的卡不抢——一张卡只能待在一个分类）。采纳=把选中的卡镜像进本分支（投影，不改动源卡归属）。',
    build: () => ({ messages: [{ role: 'system', content: evidenceSystem() }, { role: 'user', content: user() }] }),
    parse: raw => parseRows((raw || {}) as { items?: EvidencePick[] }),
    audit: () => (drop.ghost || drop.noWhy ? [drop.ghost ? `${drop.ghost} 行点的卡不在资源卡池里（或已在本分支）` : '', drop.noWhy ? `${drop.noWhy} 行没给理由（已判弱）` : ''].filter(Boolean).join('、') : null),
    apply: (rows) => {
      let n = 0
      for (const r of rows) {
        const id = (r.data as { __cardId?: string }).__cardId
        if (id && projectCardToBoard(d, id, ctx.wsId, ctx.catId)) n++
      }
      if (n) { ctx.persist(); ctx.onApplied?.(n) }
      return n ? `✓ ${n} 张佐证卡已镜像进「${ctx.branchName}」` : '⚠ 没勾选任何佐证卡，未改动'
    },
  }
}

/** 分支内现有卡（原生 + 镜像，与 boardCardsOf 同口径的按分类切片） */
function boardCardsInCat(d: AppData, wsId: string, catId: string): ResourceCard[] {
  const own = (d.resources || []).filter(r => !r.deletedAt && r.workspaceId === wsId && r.categoryId === catId)
  const ownIds = new Set(own.map(r => r.id))
  const mirrored: ResourceCard[] = []
  for (const p of d.curationProjections || []) {
    if (p.kind !== 'card' || p.targetWsId !== wsId || p.targetCatId !== catId) continue
    const src = (d.resources || []).find(r => r.id === p.cardId && !r.deletedAt)
    if (src && !ownIds.has(src.id)) mirrored.push({ ...src, categoryId: catId })
  }
  return [...own, ...mirrored]
}

// ============== G4 · 成果文稿 ==============

export interface DeliverCtx extends GovernCtx { genre?: string; personaId?: string; onPersona?: (id: string) => void }

export function buildDeliverJob(ctx: DeliverCtx): AiJob | null {
  const d = ctx.d
  const hasMeat = (d.resources || []).some(r => !r.deletedAt && r.isThesis) || (d.tasks || []).some(t => !t.deletedAt && t.status === 'done')
  const text = projectDeliverMaterial(d, ctx.depth, ctx.genre || '')
  if (!hasMeat || !text.includes('- ')) return null
  const sys = () => {
    const base = deliverSystem()
    const p = ctx.personaId ? chainPersonaText(ctx.personaId) : ''
    return p ? `${p}\n\n${base}` : base
  }
  const today = () => new Date().toLocaleDateString('zh-CN')
  const job: AiJob = {
    key: 'deliver',
    title: '📄 成果文稿',
    subject: `📄 ${(ctx.genre || '可直接转发的短文').slice(0, 18)}`,
    hint: '把这段时间攒下的判断与证据写成一份可交付文稿：只用台账里出现过的事实，逐条能指回出处。跑完自动存为一张「成果文稿」资源卡放进资源卡池（不改任何既有数据）；底部「📥 下载 .md」拿走文件不改库。',
    rawText: true,
    adoptable: false,
    build: () => ({ messages: [{ role: 'system', content: sys() }, { role: 'user', content: text }], jsonMode: false }),
    parse: (raw) => {
      const body = String(raw || '').trim().replace(/^```(?:md|markdown)?\s*|\s*```$/g, '').trim()
      if (!body) return []
      return [{ key: 'dl:text', badge: '📄 文稿', badgeType: 'ok', main: body.split('\n')[0].replace(/^#+\s*/, '').slice(0, 40) || `成果文稿 ${today()}`, sub: body.slice(0, 400), data: { text: body } }]
    },
    secondary: {
      label: '📥 下载 .md',
      apply: (rows) => {
        const body = String((rows[0]?.data as { text?: string })?.text || '')
        if (!body) return '无可存内容'
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }))
        a.download = `成果文稿_${new Date().toISOString().slice(0, 10)}.md`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
        return '✓ 已下载 .md（未改动任何数据）'
      },
    },
  }
  if (ctx.onPersona) job.persona = personaPicker(ctx.personaId || 'default', id => ctx.onPersona?.(id))
  return withReport(job, ctx, () => `📄 成果文稿 ${today()}`, (rows) => String((rows[0]?.data as { text?: string })?.text || ''), ['成果文稿'])
}
