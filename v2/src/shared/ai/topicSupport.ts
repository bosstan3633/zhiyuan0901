import type { AppData, ResourceCard, TopicCard } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { POOL_DISPLAY_NAME } from '@/shared/utils/wsName'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { catPathOf } from './project'
import { taskSupportSystem, chainPersonaText } from './scenarios'
import { addTopicResourceLink, topicResourcesOf } from '@/shared/utils/topicResourceLinks'

export interface TopicSupportCtx {
  d: AppData
  depth: AiDepth
  persist: () => void
  topicId: string
  personaId?: string
  onPersona?: (id: string) => void
}

interface SupportPick { cardId?: string; why?: string; confidence?: string }

const CANDIDATE_CAP = (depth: AiDepth) => (depth === 'eco' ? 24 : 40)

function tokenize(s: string): Set<string> {
  const out = new Set<string>()
  const lower = (s || '').toLowerCase()
  for (const w of lower.match(/[a-z0-9]{2,}/g) || []) out.add(w)
  const zh = lower.replace(/[^一-龥]/g, '')
  for (let i = 0; i + 2 <= zh.length; i++) out.add(zh.slice(i, i + 2))
  return out
}

function prefilter(d: AppData, text: string, exclude: Set<string>, depth: AiDepth): ResourceCard[] {
  const terms = tokenize(text)
  if (!terms.size) return []
  const scored: Array<{ resource: ResourceCard; score: number }> = []
  for (const resource of d.resources || []) {
    if (resource.deletedAt || exclude.has(resource.id)) continue
    let score = 0
    for (const term of terms) {
      if (resource.title.includes(term)) score += 3
      else if ((resource.tags || []).some(tag => tag.includes(term))) score += 2
      else if ((resource.description || '').includes(term)) score += 1
    }
    if (score > 0) scored.push({ resource, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || (b.resource.lastCalledAt || 0) - (a.resource.lastCalledAt || 0))
    .slice(0, CANDIDATE_CAP(depth))
    .map(row => row.resource)
}

/** 选题卡也要能“找资源”，但关联关系仍走 topicResourceLinks 独立表。 */
export function buildTopicSupportJob(ctx: TopicSupportCtx): AiJob | null {
  const topic = (ctx.d.topics || []).find(row => row.id === ctx.topicId && !row.deletedAt)
  if (!topic) return null
  const known = new Map<string, ResourceCard>()
  const drop = { ghost: 0, noWhy: 0 }

  return {
    key: `support:topic:${topic.id}`,
    title: `找资源支持 · ${topic.title.slice(0, 14) || '（未命名选题）'}`,
    subject: `📌 选题「${topic.title.slice(0, 20)}」`,
    hint: '本地先筛出与选题相关的资源，再让模型只排序并写一句“可用在哪”；采纳=建立选题和资源卡的关联，不改两张卡本体。',
    adoptLabel: '✓ 挂载到选题',
    promptScope: 'support:topic', promptObject: topic.id, promptObjectLabel: topic.title.slice(0, 14),
    before: () => {
      const own = topicResourcesOf(ctx.d, topic.id).map(row => row.resource.title)
      return [
        { key: 'title', label: '选题', main: topic.title },
        { key: 'desc', label: '说明', main: topic.description || '' },
        { key: 'support', label: '已挂载资源', main: own.join('\n') },
      ]
    },
    build: async () => {
      const exclude = new Set(topicResourcesOf(ctx.d, topic.id).map(row => row.resource.id))
      const candidates = prefilter(ctx.d, [topic.title, topic.description || '', (topic.tags || []).join(' ')].join(' '), exclude, ctx.depth)
      if (!candidates.length) {
        return { messages: [
          { role: 'system', content: taskSupportSystem() },
          { role: 'user', content: `【选题】${topic.title}\n【资源目录】（本地预筛没有候选，请返回空 items）` },
        ] }
      }
      for (const resource of candidates) known.set(resource.id, resource)
      const list = candidates.map(resource =>
        `- cardId=${resource.id} 「${resource.title.slice(0, 50)}」${resource.tags?.length ? ` 标签[${resource.tags.join(',')}]` : ''} 分类:${catPathOf(ctx.d, resource.categoryId || '') || (resource.workspaceId === CURATION_WS_ID ? POOL_DISPLAY_NAME : '策展台')}`
      ).join('\n')
      return { messages: [
        { role: 'system', content: taskSupportSystem() + (chainPersonaText(ctx.personaId || '') ? `\n\n【执笔视角】${chainPersonaText(ctx.personaId || '')}` : '') },
        { role: 'user', content: [
          `【要支持的选题】${topic.title}`,
          `【选题说明】${(topic.description || '').slice(0, 300) || '（无）'}`,
          `【资源目录（本地预筛 ${candidates.length} 张，已排除已挂载的）】\n${list}`,
        ].join('\n') },
      ] }
    },
    parse: (raw) => {
      const items = ((raw || {}) as { items?: SupportPick[] }).items || []
      const rows: AiRow[] = []
      const seen = new Set<string>()
      items.slice(0, 6).forEach((item) => {
        const id = String(item?.cardId || '')
        const resource = known.get(id)
        if (!resource || seen.has(id)) { drop.ghost++; return }
        seen.add(id)
        const why = String(item?.why || '').trim()
        if (!why) drop.noWhy++
        rows.push({
          key: `topic-support:${id}`,
          badge: '🧭 资源',
          main: resource.title.slice(0, 40),
          sub: `${why.slice(0, 60) || '（模型没给理由）'}${item.confidence === 'high' ? '' : ' · 中低置信'}`,
          weak: !why || item.confidence !== 'high',
          pair: 'support',
          data: { __cardId: id, why: why.slice(0, 120) },
        })
      })
      return rows
    },
    audit: () => (drop.ghost || drop.noWhy
      ? [drop.ghost ? `${drop.ghost} 行资源不在候选目录里（或重复）` : '', drop.noWhy ? `${drop.noWhy} 行没给理由（已判低置信）` : ''].filter(Boolean).join(' · ')
      : null),
    apply: (rows) => {
      let added = 0
      let dup = 0
      for (const row of rows) {
        const data = row.data as { __cardId?: string; why?: string }
        const resource = data.__cardId ? known.get(data.__cardId) : undefined
        if (!resource) continue
        const out = addTopicResourceLink(ctx.d, { topic, resource, from: 'ai', why: data.why })
        if (out.dup) dup++
        else added++
      }
      if (!added && !dup) return '⚠ 没勾选任何资源，未改动'
      topic.aiTouchedAt = Date.now()
      ctx.persist()
      return added
        ? `✓ 已挂载 ${added} 张资源${dup ? ` · ${dup} 张已挂载（跳过）` : ''}`
        : `⚠ 全部已挂载过（${dup} 张），未改动`
    },
  }
}
