/**
 * R136：应用推荐与搜索重排的任务书工厂（批次 F 第三刀）。
 * 消费面纪律同 R134/R135：宿主点击时才 dynamic import 本文件；
 * 推荐采纳=挂载到任务 mountedResourceIds（既有通道）；重排=只读呈现，零写库。
 */
import type { AppData, ResourceCard, TaskCard } from '@/shared/models'
import { freshTagsOf, knownTagSet } from '@/shared/utils/tags'
import { withReport } from './reports'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { chatStream, extractJson } from './llm'
import { projectChain, cardDirectory, projectTaskTargets, projectWeekDigest, projectCard } from './project'
import { fetchLinkText, linkFetchable } from './linkFetch'
import {
  recommendSystem, semanticSearchSystem, sanitizeRefs, taskParseSystem, reviewSystem, deepInsightSystem, fullOptimizeSystem,
  chainPersonaText, allPersonas, personaOverrides,
  type RecommendSuggestion, type TaskDraft,
} from './scenarios'

export interface SelectCtx {
  d: AppData; depth: AiDepth; persist: () => void
  /** R141：全方位优化可换执笔专家（同拆解机制） */
  personaId?: string
  onPersona?: (id: string) => void
}

/** A3：按任务选卡——任务上行链 + 全库卡目录（排除已挂载），采纳=挂载 */
export function buildRecommendJob(task: TaskCard, ctx: SelectCtx): AiJob | null {
  const { text, missing } = projectChain(ctx.d, 'breakdown', task.id, ctx.depth)
  if (missing) return null
  const mounted = new Set(task.mountedResourceIds || [])
  const dir = cardDirectory(ctx.d, { excludeIds: mounted }, ctx.depth)
  if (!dir) return null
  // R147-c：丢弃账（每次点击新建 job，计数器天然按次隔离）
  const drop = { noId: 0, ghost: 0, noWhy: 0 }
  return {
    key: 'rec:' + task.id,
    title: `AI 推荐资源卡 · ${task.title.slice(0, 18)}`,
    subject: `📌 任务「${task.title.slice(0, 24)}」`,
    hint: '从全库目录挑「此刻用得上」的卡（已挂载的不再推荐）；勾选采纳=挂载到该任务，可随时在任务详情里取消。',
    build: () => ({ messages: [
      { role: 'system', content: recommendSystem() },
      { role: 'user', content: `${text}\n\n【资源卡目录（cardId 只能取自这里）】\n${dir}` },
    ] }),
    parse: (raw) => {
      const bag = raw as { items?: RecommendSuggestion[]; note?: string }
      const rows: AiRow[] = []
      ;(bag.items || []).forEach((s0, i) => {
        const s = sanitizeRefs(s0, ctx.d)
        if (!s.cardId) { drop.noId++; return }
        const card = ctx.d.resources.find(r => r.id === s.cardId && !r.deletedAt)
        if (!card || mounted.has(card.id)) { drop.ghost++; return }
        if (!s.why?.trim()) drop.noWhy++
        // R147-a：没给理由的推荐=模型在猜，默认不勾
        rows.push({ key: 'rec:' + i, badge: '推荐', main: card.title, sub: s.why ? s.why.slice(0, 60) : '（模型没给理由）', weak: !s.why?.trim(), data: { cardId: card.id } })
      })
      return rows
    },
    audit: () => {
      const bits = [drop.ghost ? `${drop.ghost} 行 cardId 不在库或已挂载` : '', drop.noId ? `${drop.noId} 行没给或编造 cardId（消毒后不认）` : '', drop.noWhy ? `${drop.noWhy} 行缺理由（已判弱）` : ''].filter(Boolean)
      return bits.length ? bits.join('、') : null
    },
    apply: (rows) => {
      const t = ctx.d.tasks.find(x => x.id === task.id && !x.deletedAt)
      if (!t) return '⚠ 任务已不存在，未挂载任何卡'
      let n = 0
      for (const r of rows) {
        const id = (r.data as { cardId?: string }).cardId
        if (!id) continue
        if (!ctx.d.resources.some(x => x.id === id && !x.deletedAt)) continue
        if (t.mountedResourceIds.includes(id)) continue
        t.mountedResourceIds.push(id)
        n++
      }
      if (n) { t.updatedAt = Date.now(); ctx.persist() }
      return `✓ 已挂载 ${n} 张资源卡到任务`
    },
  }
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
}
export interface AiSearchHit { id: string; why: string; confidence: number; weak: boolean }
export interface AiSearchOut {
  hits: AiSearchHit[]; note: string
  /** 本次真的投给模型看了多少张 */
  scanned: number
  /** 库内该类型可用卡数（粗筛前） */
  total: number
  /** 模型点名但不在候选集里的条数（消毒丢弃） */
  dropped: number
  batches: number
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
/** 粗筛分：只用于"装不下时先看哪些"，最终判断交给模型——所以宁可让热门/新鲜卡多占名额 */
function searchScore(parts: string[], c: AiSearchCand): number {
  const t = c.title.toLowerCase()
  const smry = (c.summary || '').toLowerCase()
  const place = `${c.ws} ${c.cat}`.toLowerCase()
  const tg = (c.tags || []).join(' ').toLowerCase()
  let n = 0
  for (const p of parts) {
    if (t.includes(p)) n += 6
    if (tg.includes(p)) n += 4
    if (place.includes(p)) n += 3
    if (smry.includes(p)) n += 2
  }
  n += Math.min(3, Math.log2((c.callCount || 0) + 1))
  if (c.updatedAt && Date.now() - c.updatedAt < 7 * 864e5) n += 1.5
  return n
}
const searchLines = (cs: AiSearchCand[]) => cs.map(c =>
  `- id=${c.id} [${c.type}] 「${c.title.slice(0, 40)}」 | ${c.ws}/${c.cat}`
  + `${c.tags?.length ? ` | 标签[${c.tags.join(',').slice(0, 30)}]` : ''}`
  + `${c.summary ? ` | ${c.summary.replace(/\s+/g, ' ').slice(0, 36)}` : ''}`
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
  const total = cands.length
  searchDropCount = 0
  if (!q || total < 2) throw new Error('库里候选卡太少，先用关键词搜出多点再来')
  const parts = queryTokens(q)
  const ranked = cands.map(c => ({ c, s: searchScore(parts, c) }))
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
    return finish(one, picked.length, total, 1)
  } finally { clearTimeout(timer); opts.signal?.removeEventListener('abort', relay) }
}

/** 兜底路径：分批扫完全库（慢、按批数花钱），批间可取消、边跑边报进度 */
export async function semanticSearchAll(query: string, cands: AiSearchCand[], depth: AiDepth, opts: AiSearchOpts = {}): Promise<AiSearchOut> {
  const q = query.trim()
  const total = cands.length
  searchDropCount = 0
  if (!q || total < 2) throw new Error('库里候选卡太少，先用关键词搜出多点再来')
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
      const slice = cands.slice(i, i + size)
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
  return finish({ items: [...acc.values()], note }, Math.min(total, size * batches), total, batches)
}

function finish(one: { items: AiSearchHit[]; note: string }, scanned: number, total: number, batches: number): AiSearchOut {
  return {
    hits: one.items.sort((a, b) => b.confidence - a.confidence).slice(0, HIT_CAP),
    note: one.note, scanned, total, dropped: searchDropCount, batches,
  }
}


// ---------- R138：一句话智能录入 + 周期回顾 ----------

/** H1′：采集保存后的单卡补全（与 RDD 单卡补全同契约；apply 直接落库——标签并入/描述只补空/分类迁移） */
export function buildCardEnrichJob(card: ResourceCard, ctx: SelectCtx): AiJob {
  const known = knownTagSet(ctx.d)
  return {
    key: 'enrich:' + card.id,
    title: `AI 补全 · ${card.title.slice(0, 18)}`,
    hint: '刚保存的卡顺手补元数据：勾选采纳才写库（标签并入、描述只补空、分类必是候选）。',
    build: async () => {
      const { projectCard, catPathOf } = await import('./project')
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
      const rows: AiRow[] = []
      const newTags = (s.tags || []).filter(t => typeof t === 'string' && t.trim() && !(card.tags || []).includes(t))
      // R147-a：AI 造的新词单独成行且默认不勾——采纳它就等于往体系里塞词，得你点头
      const fresh = freshTagsOf(newTags, known)
      const inSys = newTags.filter(t => fresh.indexOf(t) < 0)
      if (inSys.length) rows.push({ key: 'tags', badge: '标签', main: inSys.join('、'), data: { tags: inSys } })
      if (fresh.length) rows.push({ key: 'tags:fresh', badge: '新词', badgeType: 'warn', weak: true, main: fresh.join('、'), sub: '不在既有标签体系里（AI 造词）· 勾了才进体系', data: { tags: fresh } })
      if (s.description?.trim() && !card.description) rows.push({ key: 'desc', badge: '描述', main: s.description.trim().slice(0, 120), data: { description: s.description.trim() } })
      if (s.categoryId && s.categoryId !== card.categoryId) rows.push({ key: 'cat', badge: '分类', main: s.categoryId, data: { categoryId: s.categoryId } })
      return rows
    },
    apply: (rows) => {
      const live = ctx.d.resources.find(r => r.id === card.id && !r.deletedAt)
      if (!live) return '⚠ 卡片已不存在，未写入'
      let n = 0
      for (const r of rows) {
        const s = r.data as { tags?: string[]; description?: string; categoryId?: string }
        if (s.tags) live.tags = [...new Set([...(live.tags || []), ...s.tags])].slice(0, 10)
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
    hint: '只基于近 7 天台账成文。跑完自动存为一张「每周回顾」资源卡（描述即正文）放进资源台待分类——它不改动任何现有数据，所以不必再点采纳。',
    rawText: true,
    adoptable: false,
    build: () => ({ messages: [{ role: 'system', content: reviewSystem() }, { role: 'user', content: digest }], jsonMode: false }),
    parse: (raw) => {
      const text = String(raw || '').trim()
      if (!text) return []
      return [{ key: 'review', badge: '周记', main: `每周回顾 ${new Date().toLocaleDateString('zh-CN')}`, sub: text.slice(0, 400), data: { text } }]
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
    hint: '不复述数字，只体检「投入和重心对不对」：重心偏离、停滞信号、资产与目标错位。跑完自动存为一张「深度洞察」资源卡放进资源台待分类——它不改动任何现有数据，所以不必再点采纳。',
    rawText: true,
    adoptable: false,
    build: () => ({ messages: [{ role: 'system', content: deepInsightSystem() }, { role: 'user', content: digest }], jsonMode: false }),
    parse: (raw) => {
      const text = String(raw || '').trim()
      if (!text) return []
      return [{ key: 'insight', badge: '洞察', main: `深度洞察 ${new Date().toLocaleDateString('zh-CN')}`, sub: text.slice(0, 400), data: { text } }]
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
    hint: '点击已触发抓取链接网页正文（仅 http(s)、抓不到会注明「未读正文」再按卡面谨慎推断）；勾选采纳才写库。',
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
      const rows: AiRow[] = []
      const title = String(s.title || '').trim().slice(0, 60)
      if (title && title !== card.title) rows.push({ key: 'title', badge: '标题', main: title, sub: '原：' + card.title.slice(0, 40), data: { title } })
      const desc = String(s.description || '').trim().slice(0, 300)
      if (desc && desc !== card.description) rows.push({ key: 'desc', badge: '描述', main: desc, sub: card.description ? '原：' + card.description.slice(0, 60) : '（原无描述）', data: { description: desc } })
      const newTags = (s.tags || []).filter(t => typeof t === 'string' && t.trim() && !(card.tags || []).includes(t)).slice(0, 4)
      if (newTags.length) rows.push({ key: 'tags', badge: '标签', main: newTags.join('、'), data: { tags: newTags } })
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
        if (s.tags) live.tags = [...new Set([...(live.tags || []), ...s.tags])].slice(0, 10)
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
