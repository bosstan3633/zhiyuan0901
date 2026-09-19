/**
 * R136：应用推荐与搜索重排的任务书工厂（批次 F 第三刀）。
 * 消费面纪律同 R134/R135：宿主点击时才 dynamic import 本文件；
 * 推荐采纳=挂载到任务 mountedResourceIds（既有通道）；重排=只读呈现，零写库。
 */
import type { AppData, TaskCard } from '@/shared/models'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { chat, extractJson } from './llm'
import { projectChain, cardDirectory } from './project'
import { recommendSystem, rerankSystem, sanitizeRefs, type RecommendSuggestion, type RerankHit } from './scenarios'

export interface SelectCtx { d: AppData; depth: AiDepth; persist: () => void }

/** A3：按任务选卡——任务上行链 + 全库卡目录（排除已挂载），采纳=挂载 */
export function buildRecommendJob(task: TaskCard, ctx: SelectCtx): AiJob | null {
  const { text, missing } = projectChain(ctx.d, 'breakdown', task.id, ctx.depth)
  if (missing) return null
  const mounted = new Set(task.mountedResourceIds || [])
  const dir = cardDirectory(ctx.d, { excludeIds: mounted }, ctx.depth)
  if (!dir) return null
  return {
    title: `AI 推荐资源卡 · ${task.title.slice(0, 18)}`,
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
