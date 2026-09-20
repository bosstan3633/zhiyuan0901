/**
 * R136：应用推荐与搜索重排的任务书工厂（批次 F 第三刀）。
 * 消费面纪律同 R134/R135：宿主点击时才 dynamic import 本文件；
 * 推荐采纳=挂载到任务 mountedResourceIds（既有通道）；重排=只读呈现，零写库。
 */
import type { AppData, ResourceCard, TaskCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { chat, extractJson } from './llm'
import { projectChain, cardDirectory, projectTaskTargets, projectWeekDigest, projectCard } from './project'
import { fetchLinkText, linkFetchable } from './linkFetch'
import {
  recommendSystem, rerankSystem, sanitizeRefs, taskParseSystem, reviewSystem, deepInsightSystem, fullOptimizeSystem,
  chainPersonaText, allPersonas, personaOverrides,
  type RecommendSuggestion, type RerankHit, type TaskDraft,
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
  return {
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
        if (!s.cardId) return
        const card = ctx.d.resources.find(r => r.id === s.cardId && !r.deletedAt)
        if (!card || mounted.has(card.id)) return
        rows.push({ key: 'rec:' + i, badge: '推荐', main: card.title, sub: s.why ? s.why.slice(0, 60) : undefined, data: { cardId: card.id } })
      })
      return rows
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

/** 1d：搜索意图重排——只读。命中列表（≤20）+ 关键词 → 真相关 ≤6 条 + 一句意图理解 */
export interface RerankInput { id: string; type: string; title: string; ws: string; cat: string; summary?: string }
export async function rerankSearch(query: string, items: RerankInput[]): Promise<{ order: RerankHit[]; note: string }> {
  const lines = items.slice(0, 20).map(i => `- id=${i.id} [${i.type}] ${i.title} | ${i.ws} / ${i.cat}${i.summary ? ' | ' + i.summary.replace(/\s+/g, ' ').slice(0, 60) : ''}`).join('\n')
  const text = await chat({
    messages: [
      { role: 'system', content: rerankSystem() },
      { role: 'user', content: `【搜索关键词】${query}\n【字面命中列表】\n${lines}` },
    ],
    maxTokens: 900,
  })
  const parsed = extractJson<{ order?: RerankHit[]; note?: string }>(text)
  const valid = new Set(items.map(i => i.id))
  return {
    order: (Array.isArray(parsed?.order) ? parsed.order : [])
      .map(h => ({ id: String(h?.id ?? ''), why: h?.why ? String(h.why).slice(0, 40) : undefined }))
      .filter(h => valid.has(h.id)).slice(0, 6),
    note: String(parsed?.note || '').slice(0, 40),
  }
}

// ---------- R138：一句话智能录入 + 周期回顾 ----------

/** H1′：采集保存后的单卡补全（与 RDD 单卡补全同契约；apply 直接落库——标签并入/描述只补空/分类迁移） */
export function buildCardEnrichJob(card: ResourceCard, ctx: SelectCtx): AiJob {
  return {
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
      if (newTags.length) rows.push({ key: 'tags', badge: '标签', main: newTags.join('、'), data: { tags: newTags } })
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
      if (n) { live.updatedAt = Date.now(); ctx.persist() }
      return `✓ 已补全「${card.title.slice(0, 12)}」`
    },
  }
}

/** C1′：一句大白话 → 任务字段草稿（apply 由宿主回填自己的表单态，不落库） */
export function buildTaskParseJob(text: string, ctx: SelectCtx, onApply: (draft: TaskDraft) => string): AiJob | null {
  const t = text.trim()
  if (!t) return null
  return {
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

/** F2′：周回顾草稿（apply=存为一张资源卡入 hub，未分类，用户可再归档） */
export function buildReviewJob(ctx: SelectCtx): AiJob | null {
  const digest = projectWeekDigest(ctx.d, ctx.depth)
  if (!digest.includes('- ')) return null
  return {
    title: '🗓 本周回顾草稿',
    subject: '🗓 近 7 天台账',
    hint: '只基于近 7 天台账成文；采纳=存为一张「每周回顾」资源卡（描述即正文），不改动任何现有数据。',
    rawText: true,
    build: () => ({ messages: [{ role: 'system', content: reviewSystem() }, { role: 'user', content: digest }], jsonMode: false }),
    parse: (raw) => {
      const text = String(raw || '').trim()
      if (!text) return []
      return [{ key: 'review', badge: '周记', main: `每周回顾 ${new Date().toLocaleDateString('zh-CN')}`, sub: text.slice(0, 400), data: { text } }]
    },
    apply: (rows) => {
      const text = String((rows[0]?.data as { text?: string })?.text || '')
      if (!text) return '无可存内容'
      const hub = ctx.d.workspaces.find(w => w.kind === 'resource') || ctx.d.workspaces[0]
      ctx.d.resources.unshift({
        id: uid('res'), kind: 'resource', title: `🗓 每周回顾 ${new Date().toLocaleDateString('zh-CN')}`,
        linkType: 'url', link: '', workspaceId: hub.id, categoryId: '',
        description: text.slice(0, 1200), tags: ['周回顾'], pinned: false, callCount: 0,
        createdAt: Date.now(), updatedAt: Date.now(), customFields: {},
      } as ResourceCard)
      ctx.persist()
      return '✓ 周回顾已存为资源卡（资源台未分类区）'
    },
  }
}

/** R139-#6：周报深度洞察——投料=周台账（含调用分布+主攻对照），采纳=存「深度洞察」资源卡 */
export function buildInsightJob(ctx: SelectCtx): AiJob | null {
  const digest = projectWeekDigest(ctx.d, ctx.depth)
  if (!digest.includes('- ')) return null
  return {
    title: '本周深度洞察',
    subject: '🗓 近 7 天台账 · 调度画像',
    hint: '不复述数字，只体检「投入和重心对不对」：重心偏离、停滞信号、资产与目标错位；采纳=存为一张资源卡，不改动任何既有数据。',
    rawText: true,
    build: () => ({ messages: [{ role: 'system', content: deepInsightSystem() }, { role: 'user', content: digest }], jsonMode: false }),
    parse: (raw) => {
      const text = String(raw || '').trim()
      if (!text) return []
      return [{ key: 'insight', badge: '洞察', main: `深度洞察 ${new Date().toLocaleDateString('zh-CN')}`, sub: text.slice(0, 400), data: { text } }]
    },
    apply: (rows) => {
      const text = String((rows[0]?.data as { text?: string })?.text || '')
      if (!text) return '无可存内容'
      const hub = ctx.d.workspaces.find(w => w.kind === 'resource') || ctx.d.workspaces[0]
      ctx.d.resources.unshift({
        id: uid('res'), kind: 'resource', title: `🤖 深度洞察 ${new Date().toLocaleDateString('zh-CN')}`,
        linkType: 'url', link: '', workspaceId: hub.id, categoryId: '',
        description: text.slice(0, 1600), tags: ['深度洞察'], pinned: false, callCount: 0,
        createdAt: Date.now(), updatedAt: Date.now(), customFields: {},
      } as ResourceCard)
      ctx.persist()
      return '✓ 深度洞察已存为资源卡（资源台未分类区）'
    },
  }
}

/**
 * R140：全方位优化——先抓链接正文（点击才抓、仅 http(s)、失败降级）再给 标题/描述/标签 一体建议。
 * 描述此处允许**改写**（与"补全只填空"不同：这是用户主动求优化）；采纳=勾选行才写库。
 */
export function buildFullOptimizeJob(card: ResourceCard, ctx: SelectCtx): AiJob {
  const personaText = chainPersonaText(ctx.personaId || '')
  const job: AiJob = {
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
      if (n) { live.updatedAt = Date.now(); ctx.persist() }
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
