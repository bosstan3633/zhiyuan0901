/**
 * R136：应用推荐与搜索重排的任务书工厂（批次 F 第三刀）。
 * 消费面纪律同 R134/R135：宿主点击时才 dynamic import 本文件；
 * 重排=只读呈现，零写库。（R162：推荐挂载任务书随任务↔资源挂载关系退役）
 */
import type { AppData, ResourceCard } from '@/shared/models'
import { freshTagsOf, knownTagSet, canonicalTagsOf } from '@/shared/utils/tags'
import { withReport } from './reports'
import type { AiJob, AiPaneLine, AiRow } from './job'
import type { AiDepth } from './config'
import { chatStream, extractJson } from './llm'
import { projectTaskTargets, projectWeekDigest, projectCard, catPathOf } from './project'
import { fetchLinkText, linkFetchable } from './linkFetch'
import {
  semanticSearchSystem, sanitizeRefs, taskParseSystem, reviewSystem, deepInsightSystem, fullOptimizeSystem,
  chainPersonaText, allPersonas, personaOverrides,
  type TaskDraft,
} from './scenarios'

export interface SelectCtx {
  d: AppData; depth: AiDepth; persist: () => void
  /** R141：全方位优化可换执笔专家（同拆解机制） */
  personaId?: string
  onPersona?: (id: string) => void
}

/**
 * R154：右栏标签行显示的是**完整结果**（现有 + 建议），用户改完后要回算增量再交给 apply——
 * 从结果里删掉的建议项就不写，用户自己补的词照写。apply 侧仍是并入语义，不必改。
 */
function tagDiff(fullText: string | undefined, have: string[]): string[] {
  return [...new Set(String(fullText || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean))].filter(t => !have.includes(t))
}

/**
 * R154：报告型左栏=**投料原文**（近 7 天台账）。
 * 直接切给定的 digest，不另算一套数——抽屉上写的"依据"必须与模型真看到的字同一口径，
 * 否则左栏就成了第二套真相。
 */
function digestPane(digest: string): AiPaneLine[] {
  return digest.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim()).slice(0, 80)
    .map((l, i) => ({ key: 'w' + i, depth: /^\s{2,}/.test(l) ? 1 : 0, main: l.replace(/^[\s-•·]+/, '') }))
}

/**
 * R150：AI 检索——自然语言 → 库内**三类卡**（资源/任务/好奇）语义召回，只读零写库。
 * 与旧「AI 理解」（1d 重排）的区别：旧的那枚只能重排**字面已经命中**的前 14 条，
 * 用户换个说法、卡面没有那几个字就永远召不回来；这条直接把候选扩到全库再让模型判。
 * 三条硬约束沿用 R146-d 实测过的骨架：①流式 + JSON 一闭合就掐连接；②30 秒硬超时；
 * ③外部 signal 可中止（改词、关浮层、再点一次都真取消）。
 * 覆盖与速度由用户拍板：**先本地粗筛再一次精排**（默认秒级），另给「全库分批扫」显式兜底。
 */
export interface AiSearchCand {
  id: string; type: string; title: string; ws: string; cat: string
  summary?: string; tags?: string[]; callCount?: number; updatedAt?: number
  /** R161-③：自定义字段折成的一行文本（用户自己填的语义，密度常高于描述） */
  fields?: string
  /** R161-③：链接**地址本身**（卡片字段之一）。只投地址，**不抓网页内容**——语义检索不联网取正文。 */
  link?: string
}
export interface AiSearchHit { id: string; why: string; confidence: number; weak: boolean }
export interface AiSearchOut {
  hits: AiSearchHit[]; note: string
  /** 本次真的投给模型看了多少张 */
  scanned: number
  /** 收窄后的候选池大小（粗筛前）——R161-③ 起是「按用户输入定向收窄后」的范围，不是全库 */
  total: number
  /** 模型点名但不在候选集里的条数（消毒丢弃） */
  dropped: number
  batches: number
  /** R161-③：本次按用户输入的指向性收窄到什么范围（空串 = 没识别到指向，用全库） */
  scope: string
}
export interface AiSearchOpts {
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onProgress?: (p: { scanned: number; total: number; found: number; batch: number }) => void
}
/** 单次调用的候选上限：只投标题+一行摘要，每行 ~50 字，180 行≈9k 字（std 档） */
const SEARCH_CAP: Record<AiDepth, number> = { eco: 80, std: 180, deep: 320 }
/** 全库分批扫的批大小（批越小越容易早停，但请求数线性上涨） */
const SEARCH_BATCH: Record<AiDepth, number> = { eco: 80, std: 120, deep: 160 }
const SEARCH_TIMEOUT_MS = 30000
const HIT_CAP = 8
/** 早停判据：整段 JSON 已闭合且 items 是数组——再等下去只会更慢 */
function searchReady(t: string): boolean {
  const s = t.indexOf('{')
  const e = t.lastIndexOf('}')
  if (s < 0 || e <= s) return false
  try { return Array.isArray((JSON.parse(t.slice(s, e + 1)) as { items?: unknown }).items) } catch { return false }
}
/** 中文没有空格：整句 + 空格分词 + 连续中文串的 2-gram 一起当字面近似用 */
function queryTokens(q: string): string[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const out = [s]
  for (const w of s.split(/[\s,，。、;；:：]+/)) if (w.length >= 2 && w !== s) out.push(w)
  for (const run of s.match(/[一-龥]{3,}/g) || []) {
    for (let i = 0; i + 2 <= run.length && i < 10; i++) out.push(run.slice(i, i + 2))
  }
  return out.slice(0, 24)
}
/**
 * R161-③：按用户这句话的**指向性**收窄候选范围。
 *
 * 为什么：用户说"资源卡里关于 X 的""某分类下有没有 Y"时，把全库都塞进投料既慢又噪声大；
 * 收窄之后 total 变小，**一次投料能覆盖的比例反而更高**——这就是"按输入指向做范围内全盘检索、
 * 同时保住响应速度"的落地方式（用户 2026-09-22 拍板）。
 *
 * 两条纪律：
 *  ① **只认字面出现的词**，不做同义改写、不猜意图（宁松勿猜：识别不到就原样返回全库）；
 *  ② 收窄后不足 2 张就**放弃收窄**——那已经不叫"挑"，叫"没得挑"。
 */
export function scopeSearch(query: string, cands: AiSearchCand[]): { cands: AiSearchCand[]; scope: string } {
  const q = String(query || '').trim()
  if (!q) return { cands, scope: '' }
  // ① 类型指向：三类各有自己的说法；同时点了两三类就并列保留（"资源卡和任务"）
  const types: string[] = []
  if (/资源卡|资源|链接卡|网站|工具卡/.test(q)) types.push('res')
  if (/任务卡|任务|待办|要做|待到/.test(q)) types.push('task')
  if (/好奇心|好奇卡|好奇|灵感|疑问|想法/.test(q)) types.push('curio')
  let out = (types.length && types.length < 3) ? cands.filter(c => types.includes(c.type)) : cands
  // ② 台名 / 分类名指向：句子里点名了某个策展台或分类（≥2 字，避开单字噪声）
  const names = [...new Set(out.map(c => c.cat).concat(out.map(c => c.ws)))].filter(n => n && n.length >= 2)
  const hitNames = names.filter(n => q.includes(n))
  if (hitNames.length) {
    const narrowed = out.filter(c => hitNames.includes(c.cat) || hitNames.includes(c.ws))
    if (narrowed.length >= 2) out = narrowed
    else hitNames.length = 0
  }
  if (out.length < 2) return { cands, scope: '' }
  if (out.length === cands.length) return { cands, scope: '' }
  const bits: string[] = []
  if (types.length && types.length < 3) {
    bits.push(types.map(t => (t === 'res' ? '资源卡' : t === 'task' ? '任务卡' : '好奇心')).join('/'))
  }
  if (hitNames.length) bits.push('「' + hitNames.slice(0, 2).join('」「') + '」')
  return { cands: out, scope: `${bits.join(' · ')} ${out.length}/${cands.length} 张` }
}

/** 粗筛分：只用于"装不下时先看哪些"，最终判断交给模型——所以宁可让热门/新鲜卡多占名额 */
function searchScore(parts: string[], c: AiSearchCand): number {
  const t = c.title.toLowerCase()
  const smry = (c.summary || '').toLowerCase()
  const place = `${c.ws} ${c.cat}`.toLowerCase()
  const tg = (c.tags || []).join(' ').toLowerCase()
  // R161-③：自定义字段与链接地址也参与粗筛（字段是用户自己填的，命中权重介于标签与摘要之间）
  const fl = (c.fields || '').toLowerCase()
  const lk = (c.link || '').toLowerCase()
  let n = 0
  for (const p of parts) {
    if (t.includes(p)) n += 6
    if (tg.includes(p)) n += 4
    if (place.includes(p)) n += 3
    if (smry.includes(p)) n += 2
    if (fl.includes(p)) n += 3
    if (lk.includes(p)) n += 2
  }
  n += Math.min(3, Math.log2((c.callCount || 0) + 1))
  if (c.updatedAt && Date.now() - c.updatedAt < 7 * 864e5) n += 1.5
  return n
}
/** R161-③：每行给全**卡片字段**（标题/台类/标签/摘要/自定义字段/链接地址）。
 *  行里不给的东西模型一概不许假设——尤其**链接指向的网页内容**：本功能不联网抓正文。 */
const searchLines = (cs: AiSearchCand[]) => cs.map(c =>
  `- id=${c.id} [${c.type}] 「${c.title.slice(0, 40)}」 | ${c.ws}/${c.cat}`
  + `${c.tags?.length ? ` | 标签[${c.tags.join(',').slice(0, 30)}]` : ''}`
  + `${c.summary ? ` | ${c.summary.replace(/\s+/g, ' ').slice(0, 36)}` : ''}`
  + `${c.fields ? ` | 字段[${c.fields.replace(/\s+/g, ' ').slice(0, 60)}]` : ''}`
  + `${c.link ? ` | 链接${c.link.replace(/\s+/g, '').slice(0, 36)}` : ''}`
  + `${c.callCount ? ` | 打开${c.callCount}次` : ''}`).join('\n')

/** 一批候选问一次；deadline 由调用方掐（分批全扫共用同一个钟），timedOut 用来把 AbortError 翻成人话 */
interface AskCtl { timedOut: boolean }
async function askOnce(query: string, cands: AiSearchCand[], opts: AiSearchOpts, ac: AbortController, ctl: AskCtl): Promise<{ items: AiSearchHit[]; note: string }> {
  let early = false
  let accum = ''
  await chatStream({
    messages: [
      { role: 'system', content: semanticSearchSystem() },
      { role: 'user', content: `【用户这句话】${query}\n【候选卡（id 只能取自这里）】\n${searchLines(cands)}` },
    ],
    maxTokens: 520, temperature: 0.2, signal: ac.signal,
    onDelta: (a) => { accum = a; opts.onDelta?.(a.length); if (!early && searchReady(a)) { early = true; ac.abort() } },
  }).catch((e: Error) => {
    if ((e as Error).name === 'AbortError' && early) return
    if ((e as Error).name === 'AbortError') throw new Error(ctl.timedOut ? `${SEARCH_TIMEOUT_MS / 1000} 秒无响应——换轻量模型，或稍后再试` : '已取消')
    throw e
  })
  if (!accum.trim()) throw new Error('网关没有回内容（换轻量模型，或稍后再试）')
  const parsed = extractJson<{ items?: { id?: unknown; why?: unknown; confidence?: unknown }[]; note?: unknown }>(accum)
  const valid = new Set(cands.map(c => c.id))
  const items: AiSearchHit[] = []
  let dropped = 0
  for (const h of Array.isArray(parsed?.items) ? parsed!.items : []) {
    const id = String(h?.id ?? '')
    if (!id || !valid.has(id)) { dropped++; continue }
    const conf = Number(h?.confidence)
    const ok = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.7
    const c0 = items.find(x => x.id === id)
    const hit: AiSearchHit = {
      id,
      why: String(h?.why || '').replace(/\s+/g, ' ').slice(0, 40),
      confidence: ok,
      // 判弱只准用客观信号：模型自己给的分低、或干脆没给理由（等于在猜）
      weak: ok < 0.55 || !String(h?.why || '').trim(),
    }
    if (c0) { if (hit.confidence > c0.confidence) Object.assign(c0, hit); continue }
    items.push(hit)
  }
  if (dropped) searchDropCount += dropped
  return { items, note: String(parsed?.note || '').replace(/\s+/g, ' ').slice(0, 40) }
}
/** 跨批累计的消毒账（每次入口调用前清零，随结果一并上报） */
let searchDropCount = 0

/** 默认路径：粗筛取前 N 张 → 一次精排 */
export async function semanticSearch(query: string, cands: AiSearchCand[], depth: AiDepth, opts: AiSearchOpts = {}): Promise<AiSearchOut> {
  const q = query.trim()
  searchDropCount = 0
  if (!q || cands.length < 2) throw new Error('库里候选卡太少，先用关键词搜出多点再来')
  // R161-③：先按这句话的指向性收窄，再在**收窄后的范围**里排序取头部（收窄 → total 变小 → 覆盖比例更高）
  const sc = scopeSearch(q, cands)
  const pool = sc.cands
  const total = pool.length
  const parts = queryTokens(q)
  const ranked = pool.map(c => ({ c, s: searchScore(parts, c) }))
    .sort((a, b) => b.s - a.s || (b.c.updatedAt || 0) - (a.c.updatedAt || 0))
  const cap = Math.min(SEARCH_CAP[depth], total)
  const picked = ranked.slice(0, cap).map(x => x.c)
  const ac = new AbortController()
  const relay = () => ac.abort()
  opts.signal?.addEventListener('abort', relay)
  const ctl: AskCtl = { timedOut: false }
  const timer = setTimeout(() => { ctl.timedOut = true; ac.abort() }, SEARCH_TIMEOUT_MS)
  try {
    const one = await askOnce(q, picked, opts, ac, ctl)
    return finish(one, picked.length, total, 1, sc.scope)
  } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort', relay) }
}

/** 兜底路径：分批扫完全库（慢、按批数花钱），批间可取消、边跑边报进度 */
export async function semanticSearchAll(query: string, cands: AiSearchCand[], depth: AiDepth, opts: AiSearchOpts = {}): Promise<AiSearchOut> {
  const q = query.trim()
  searchDropCount = 0
  if (!q || cands.length < 2) throw new Error('库里候选卡太少，先用关键词搜出多点再来')
  // R161-③：慢路径同样先收窄——"全库分批扫"扫的是**用户指向的那个范围的全量**
  const sc = scopeSearch(q, cands)
  const pool = sc.cands
  const total = pool.length
  const size = SEARCH_BATCH[depth]
  const ctl: AskCtl = { timedOut: false }
  const acc = new Map<string, AiSearchHit>()
  let note = ''
  let batches = 0
  /** 每批各持一把中止器：批内的 JSON 闭合早停会 abort 自己的 ac，若共用一把，第二批一开局就拿到已 abort 的 signal → 整场失败 */
  const aborters = new Set<AbortController>()
  const relay = () => aborters.forEach(a => a.abort())
  opts.signal?.addEventListener('abort', relay)
  const timer = setTimeout(() => { ctl.timedOut = true; relay() }, SEARCH_TIMEOUT_MS * Math.max(1, Math.ceil(total / size)))
  try {
    for (let i = 0; i < total; i += size) {
      if (opts.signal?.aborted) throw new Error('已取消')
      const slice = pool.slice(i, i + size)
      const ac = new AbortController()
      aborters.add(ac)
      let one: { items: AiSearchHit[]; note: string }
      try { one = await askOnce(q, slice, opts, ac, ctl) } finally { aborters.delete(ac) }
      batches++
      note = note || one.note
      for (const h of one.items) {
        const old = acc.get(h.id)
        if (!old || h.confidence > old.confidence) acc.set(h.id, h)
      }
      opts.onProgress?.({ scanned: Math.min(i + size, total), total, found: acc.size, batch: batches })
      if (acc.size >= HIT_CAP * 2) break // 够用了就别再把剩下的卡继续烧钱
    }
  } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort', relay); aborters.clear() }
  return finish({ items: [...acc.values()], note }, Math.min(total, size * batches), total, batches, sc.scope)
}

function finish(one: { items: AiSearchHit[]; note: string }, scanned: number, total: number, batches: number, scope = ''): AiSearchOut {
  return {
    hits: one.items.sort((a, b) => b.confidence - a.confidence).slice(0, HIT_CAP),
    note: one.note, scanned, total, dropped: searchDropCount, batches, scope,
  }
}


// ---------- R138：一句话智能录入 + 周期回顾 ----------

/** H1′：采集保存后的单卡补全（与 RDD 单卡补全同契约；apply 直接落库——标签并入/描述只补空/分类迁移）
 *  R154：接左栏「当前形态」，右栏给**补全后的完整值**（含未变字段），标签与描述可就地改。 */
export function buildCardEnrichJob(card: ResourceCard, ctx: SelectCtx): AiJob {
  const known = knownTagSet(ctx.d)
  const catName = () => catPathOf(ctx.d, card.categoryId) || '（未分类）'
  return {
    key: 'enrich:' + card.id,
    title: `AI 补全 · ${card.title.slice(0, 18)}`,
    subject: `📌 资源卡「${card.title.slice(0, 24) || '无名卡'}」`,
    hint: '刚保存的卡顺手补元数据：勾选采纳即直接写库（标签并入、描述只补空、分类必是候选）。右栏是补全后的完整值，点字段可就地改。',
    promptScope: 'enrich:card', promptObject: card.id, promptObjectLabel: card.title.slice(0, 14),
    before: () => [
      { key: 'title', label: '标题', main: card.title || '（无名卡）' },
      { key: 'desc', label: '描述', main: card.description || '' },
      { key: 'tags', label: '标签', main: (card.tags || []).join('、') },
      { key: 'cat', label: '分类', main: catName() },
    ],
    build: async () => {
      const { projectCard } = await import('./project')
      const { enrichSystem } = await import('./scenarios')
      const cats = ctx.d.categories.filter(c => !c.deletedAt && c.workspaceId === card.workspaceId)
      const catList = cats.slice(0, 60).map(c => `categoryId=${c.id}：${catPathOf(ctx.d, c.id)}`).join('\n')
      return { messages: [
        { role: 'system', content: enrichSystem(cats.length > 0) },
        { role: 'user', content: projectCard(ctx.d, card, ctx.depth) + (catList ? `\n\n【分类候选】\n${catList}` : '') },
      ] }
    },
    parse: (raw) => {
      const s = sanitizeRefs((raw || {}) as TaskDraft & { tags?: string[]; description?: string; categoryId?: string }, ctx.d) as { tags?: string[]; description?: string; categoryId?: string }
      const have = card.tags || []
      const rows: AiRow[] = []
      // R162：AI 给的标签先归一回体系（全名/叶子名/路径三口径；查不到才保留=真新词）
      const newTags = canonicalTagsOf(ctx.d, (s.tags || []).filter(t => typeof t === 'string' && t.trim())).filter(t => !have.includes(t))
      // R147-a：AI 造的新词单独成行且默认不勾——采纳它就等于往体系里塞词，得你点头
      const fresh = freshTagsOf(newTags, known)
      const inSys = newTags.filter(t => fresh.indexOf(t) < 0)
      const desc = s.description?.trim() || ''
      const catTo = s.categoryId && s.categoryId !== card.categoryId ? s.categoryId : ''
      // 字段序固定：标题 → 描述 → 标签 → 新词 → 分类（未变的也出行，右栏才是"完整形态"）
      rows.push({ key: 'title', badge: '标题', main: card.title || '（无名卡）', pair: 'title', changeType: 'same', data: {} })
      if (desc && !card.description) rows.push({ key: 'desc', badge: '描述', main: desc.slice(0, 120), pair: 'desc', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { description: (t.main || '').trim() } }) }, data: { description: desc } })
      else rows.push({ key: 'desc:same', badge: '描述', main: card.description || '（空，AI 没给）', pair: 'desc', changeType: 'same', data: {} })
      if (inSys.length) rows.push({ key: 'tags', badge: '标签', main: [...have, ...inSys].join('、'), sub: `现有 ${have.length} 个 → 并入 ${inSys.join('、')}`, pair: 'tags', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { tags: tagDiff(t.main, have) } }) }, data: { tags: inSys } })
      else rows.push({ key: 'tags:same', badge: '标签', main: have.join('、') || '（无标签）', pair: 'tags', changeType: 'same', data: {} })
      if (fresh.length) rows.push({ key: 'tags:fresh', badge: '新词', badgeType: 'warn', weak: true, main: [...have, ...inSys, ...fresh].join('、'), sub: `新词 ${fresh.join('、')} 不在既有标签体系里（AI 造词）· 勾了才进体系`, pair: 'tags', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { tags: tagDiff(t.main, [...have, ...inSys]) } }) }, data: { tags: fresh } })
      if (catTo) rows.push({ key: 'cat', badge: '分类', main: catPathOf(ctx.d, catTo) || catTo, sub: `现：${catName()}`, pair: 'cat', data: { categoryId: catTo } })
      else rows.push({ key: 'cat:same', badge: '分类', main: catName(), pair: 'cat', changeType: 'same', data: {} })
      return rows
    },
    apply: (rows) => {
      const live = ctx.d.resources.find(r => r.id === card.id && !r.deletedAt)
      if (!live) return '⚠ 卡片已不存在，未写入'
      let n = 0
      for (const r of rows) {
        const s = r.data as { tags?: string[]; description?: string; categoryId?: string }
        if (s.tags) live.tags = [...new Set([...(live.tags || []), ...canonicalTagsOf(ctx.d, s.tags)])].slice(0, 10)
        if (s.description && !live.description) live.description = s.description
        if (s.categoryId && ctx.d.categories.some(c => c.id === s.categoryId && !c.deletedAt)) live.categoryId = s.categoryId
        n++
      }
      if (n) { live.updatedAt = Date.now(); live.aiTouchedAt = Date.now(); ctx.persist() }
      return `✓ 已补全「${card.title.slice(0, 12)}」`
    },
  }
}

/** C1′：一句大白话 → 任务字段草稿（apply 由宿主回填自己的表单态，不落库） */
export function buildTaskParseJob(text: string, ctx: SelectCtx, onApply: (draft: TaskDraft) => string): AiJob | null {
  const t = text.trim()
  if (!t) return null
  return {
    key: 'parse:' + text.trim().slice(0, 24),
    title: 'AI 录入 · 任务字段草稿',
    subject: `✍️ 「${t.slice(0, 24)}」`,
    hint: '核对下面的字段建议，采纳即回填表单（不会直接建卡）；确认后照常「创建」。',
    build: () => ({ messages: [
      { role: 'system', content: taskParseSystem() },
      { role: 'user', content: `今天 ${new Date().toLocaleDateString('en-CA')}。\n【用户原话】${t.slice(0, 200)}\n\n【项目/指标候选（id 只能取自这里）】\n${projectTaskTargets(ctx.d, ctx.depth)}` },
    ] }),
    parse: (raw) => {
      const s = raw as TaskDraft
      const rows: AiRow[] = []
      const title = String(s.title || '').trim().slice(0, 40)
      if (title) rows.push({ key: 'title', badge: '标题', main: title })
      const facts: string[] = []
      if (s.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(s.dueDate))) facts.push('截止 ' + s.dueDate)
      const pr = String(s.priority || '')
      if (pr === 'high' || pr === 'medium' || pr === 'low') facts.push({ high: '高优', medium: '中优', low: '低优' }[pr])
      const em = Number(s.estimatedMinutes)
      if (Number.isFinite(em) && em >= 5 && em <= 600) facts.push(`约${Math.round(em)}分钟`)
      if (facts.length) rows.push({ key: 'fields', badge: '字段', main: facts.join(' · ') })
      const proj = ctx.d.compass.directions.flatMap(x => x.projects).find(p => p.id === s.projectId)
      if (proj) rows.push({ key: 'proj', badge: '归属', main: `项目「${proj.name}」` })
      const met = s.metricId ? ctx.d.compass.directions.flatMap(x => x.projects).flatMap(p => p.metrics).find(m => m.id === s.metricId) : undefined
      if (met) rows.push({ key: 'met', badge: '归属', main: `指标「${met.title}」` })
      const draft: TaskDraft = {
        title: title || undefined,
        dueDate: facts.some(f => f.startsWith('截止')) ? s.dueDate : undefined,
        priority: pr || undefined,
        estimatedMinutes: facts.some(f => f.startsWith('约')) ? Math.round(em) : undefined,
        projectId: proj?.id, metricId: met?.id,
      }
      for (const r of rows) r.data = draft
      return rows
    },
    apply: (rows) => onApply((rows[0]?.data || {}) as TaskDraft),
  }
}

/**
 * F2′：周回顾——R149 起改「只新增自动落卡」（用户拍板：撤采纳按钮，保持一张卡）。
 * 跑完直接进资源台待分类，不再需要第二下点击，也不可能落两张。
 */
export function buildReviewJob(ctx: SelectCtx): AiJob | null {
  const digest = projectWeekDigest(ctx.d, ctx.depth)
  if (!digest.includes('- ')) return null
  return withReport({
    key: 'review',
    title: '🗓 本周回顾',
    subject: '🗓 近 7 天台账',
    hint: '只基于近 7 天台账成文。跑完自动存为一张「每周回顾」资源卡（描述即正文）放进资源台待分类——它不改动任何现有数据，所以不必再点采纳。左栏就是这次投料的原文；右栏正文可改，改过才点亮「存为卡」。',
    rawText: true,
    adoptable: false,
    before: () => digestPane(digest),
    paneMode: 'context',
    promptScope: 'review',
    build: () => ({ messages: [{ role: 'system', content: reviewSystem() }, { role: 'user', content: digest }], jsonMode: false }),
    parse: (raw) => {
      const text = String(raw || '').trim()
      if (!text) return []
      return [{ key: 'review', badge: '周记', main: text, changeType: 'new', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { text: (t.main || '').trim() } }) }, data: { text } }]
    },
  }, ctx, () => `🗓 每周回顾 ${new Date().toLocaleDateString('zh-CN')}`, (rows) => String((rows[0]?.data as { text?: string })?.text || ''), ['周回顾'])
}

/** R139-#6 / R149：周报深度洞察——投料=周台账（含调用分布+主攻对照），跑完自动落一张卡 */
export function buildInsightJob(ctx: SelectCtx): AiJob | null {
  const digest = projectWeekDigest(ctx.d, ctx.depth)
  if (!digest.includes('- ')) return null
  return withReport({
    key: 'insight',
    title: '本周深度洞察',
    subject: '🗓 近 7 天台账 · 调度画像',
    hint: '不复述数字，只体检「投入和重心对不对」：重心偏离、停滞信号、资产与目标错位。跑完自动存为一张「深度洞察」资源卡放进资源台待分类——它不改动任何现有数据，所以不必再点采纳。左栏是投料原文（含调用分布与主攻对照），右栏正文可改，改过才点亮「存为卡」。',
    rawText: true,
    adoptable: false,
    before: () => digestPane(digest),
    paneMode: 'context',
    promptScope: 'insight',
    build: () => ({ messages: [{ role: 'system', content: deepInsightSystem() }, { role: 'user', content: digest }], jsonMode: false }),
    parse: (raw) => {
      const text = String(raw || '').trim()
      if (!text) return []
      return [{ key: 'insight', badge: '洞察', main: text, changeType: 'new', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { text: (t.main || '').trim() } }) }, data: { text } }]
    },
  }, ctx, () => `🗓 深度洞察 ${new Date().toLocaleDateString('zh-CN')}`, (rows) => String((rows[0]?.data as { text?: string })?.text || ''), ['深度洞察'])
}

/**
 * R140：全方位优化——先抓链接正文（点击才抓、仅 http(s)、失败降级）再给 标题/描述/标签 一体建议。
 * 描述此处允许**改写**（与"补全只填空"不同：这是用户主动求优化）；采纳=勾选行才写库。
 */
export function buildFullOptimizeJob(card: ResourceCard, ctx: SelectCtx): AiJob {
  const personaText = chainPersonaText(ctx.personaId || '')
  const job: AiJob = {
    key: 'opt:' + card.id,
    title: `AI 全方位优化 · ${card.title.slice(0, 14) || '（无名卡）'}`,
    subject: `📌 资源卡「${card.title.slice(0, 24) || '无名卡'}」`,
    hint: '点击已触发抓取链接网页正文（仅 http(s)、抓不到会注明「未读正文」再按卡面谨慎推断）；勾选采纳即直接写库。右栏是优化后的完整值，点字段可就地改（标签行只加不减）。',
    promptScope: 'opt:card', promptObject: card.id, promptObjectLabel: card.title.slice(0, 14),
    before: () => [
      { key: 'title', label: '标题', main: card.title || '（无名卡）' },
      { key: 'desc', label: '描述', main: card.description || '' },
      { key: 'tags', label: '标签', main: (card.tags || []).join('、') },
      { key: 'link', label: '链接', main: card.link ? card.link.slice(0, 60) : '（无链接）' },
    ],
    build: async () => {
      let linkBlock = ''
      if (linkFetchable(card.link)) {
        const r = await fetchLinkText(card.link!)
        linkBlock = `\n\n【链接正文】${r.note ? '（' + r.note + '）' : ''}\n${r.text || '（无正文）'}`
      } else if (card.link) {
        linkBlock = `\n\n【链接】${card.link.slice(0, 120)}（非 http(s) 网页链接，不抓取正文）`
      }
      return { messages: [
        { role: 'system', content: fullOptimizeSystem(personaText) },
        { role: 'user', content: projectCard(ctx.d, card, ctx.depth) + linkBlock },
      ] }
    },
    parse: (raw) => {
      const s = (raw || {}) as { title?: string; description?: string; tags?: string[]; assess?: string }
      const have = card.tags || []
      const rows: AiRow[] = []
      const title = String(s.title || '').trim().slice(0, 60)
      if (title && title !== card.title) rows.push({ key: 'title', badge: '标题', main: title, sub: '原：' + card.title.slice(0, 40), pair: 'title', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { title: (t.main || '').trim().slice(0, 60) } }) }, data: { title } })
      else rows.push({ key: 'title:same', badge: '标题', main: card.title || '（无名卡）', sub: 'AI 认为原标题不用改', pair: 'title', changeType: 'same', data: {} })
      const desc = String(s.description || '').trim().slice(0, 300)
      if (desc && desc !== card.description) rows.push({ key: 'desc', badge: '描述', main: desc, sub: card.description ? '原：' + card.description.slice(0, 60) : '（原无描述）', pair: 'desc', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { description: (t.main || '').trim() } }) }, data: { description: desc } })
      else rows.push({ key: 'desc:same', badge: '描述', main: card.description || '（空）', pair: 'desc', changeType: 'same', data: {} })
      // R162：同单卡补全——先归一回体系，再截断
      const newTags = canonicalTagsOf(ctx.d, (s.tags || []).filter(t => typeof t === 'string' && t.trim())).filter(t => !have.includes(t)).slice(0, 4)
      if (newTags.length) rows.push({ key: 'tags', badge: '标签', main: [...have, ...newTags].join('、'), sub: `并入 ${newTags.join('、')}（标签只加不减，要删去标签管理）`, pair: 'tags', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { tags: tagDiff(t.main, have) } }) }, data: { tags: newTags } })
      else rows.push({ key: 'tags:same', badge: '标签', main: have.join('、') || '（无标签）', pair: 'tags', changeType: 'same', data: {} })
      rows.push({ key: 'link:same', badge: '链接', main: card.link ? card.link.slice(0, 60) : '（无链接）', pair: 'link', changeType: 'same', data: {} })
      if (s.assess?.trim()) rows.push({ key: 'verdict', badge: '参谋', advisory: true, main: s.assess.trim().slice(0, 120), data: { __verdict: true } })
      return rows
    },
    apply: (rows) => {
      const live = ctx.d.resources.find(r => r.id === card.id && !r.deletedAt)
      if (!live) return '⚠ 卡片已不存在，未写入'
      let n = 0
      for (const r of rows) {
        const s = r.data as { title?: string; description?: string; tags?: string[]; __verdict?: boolean }
        if (s.__verdict) continue
        if (s.title) live.title = s.title
        if (s.description) live.description = s.description
        if (s.tags) live.tags = [...new Set([...(live.tags || []), ...canonicalTagsOf(ctx.d, s.tags)])].slice(0, 10)
        n++
      }
      if (n) { live.updatedAt = Date.now(); live.aiTouchedAt = Date.now(); ctx.persist() }
      return `✓ 已优化「${live.title.slice(0, 12)}」（${n} 项）`
    },
  }
  if (ctx.onPersona) {
    const ov = personaOverrides()
    job.persona = {
      options: [{ id: 'default', label: '🗂 策展助手（默认）' }, ...allPersonas().filter(p => ov[p.id]?.enabled !== false).map(p => ({ id: p.id, label: `${p.icon} ${p.name}` }))],
      current: ctx.personaId || 'default',
      onPick: (id) => ctx.onPersona?.(id),
    }
  }
  return job
}
