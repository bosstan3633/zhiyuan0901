/**
 * R167：资源卡侧「关联任务」——R166「找资源支持」（任务侧）的**反向入口**。
 *
 * 同一条 `SupportLink` 记录、同一张表，只是发起方向相反：
 *  · 任务侧：给任务找资源（taskSupport.ts）
 *  · 资源侧：给资源找它支撑的任务（本文件）
 *
 * 两段式纪律照 `buildTaskSupportJob`，不另造机制：
 *  ① **本地预筛**——扫全量任务卡，按词面/标签与这张卡的重合度打分取 top N，并排除已挂过这张卡的任务；
 *  ② **LLM 只做排序 + 一句判词**，不生产内容、不建任务、不改任务。
 * 为什么要 ①：任务可能上百张，整库喂给模型既贵又让它在一长串标题里瞎点。
 *
 * ★ 采纳只写关联表：任务卡与资源卡本体一字不动，「卡间零挂载」红线不因"顺手"而让步（定案 5 / 定案 10）。
 * ★ 解绑仍然只在任务侧做——资源侧是只读反查（R166 定案 10 的边界，本入口不越）。
 * ★ 懒加载侧：宿主点击时才 dynamic import。
 */
import type { AppData, TaskCard } from '@/shared/models'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { resourceLinkTaskSystem, chainPersonaText, allPersonas, personaOverrides } from './scenarios'
import { buildSupportIndex, addSupportLink, listByResource } from '@/shared/utils/supportLinks'

export interface ResourceLinkTaskCtx {
  d: AppData
  depth: AiDepth
  persist: () => void
  resourceId: string
  personaId?: string
  onPersona?: (id: string) => void
}

interface TaskPick { taskId?: string; why?: string; confidence?: string }

/** 候选上限：eco 档 24、其余 40（与任务侧同口径——模型在小集合里排序比在长清单里点名靠谱） */
const CANDIDATE_CAP = (depth: AiDepth) => (depth === 'eco' ? 24 : 40)

/** 中文按 2-gram + 英文数字按词（与 taskSupport.ts 同一套朴素分词，不引分词器） */
function tokenize(s: string): Set<string> {
  const out = new Set<string>()
  const lower = (s || '').toLowerCase()
  for (const w of lower.match(/[a-z0-9]{2,}/g) || []) out.add(w)
  const zh = lower.replace(/[^一-龥]/g, '')
  for (let i = 0; i + 2 <= zh.length; i++) out.add(zh.slice(i, i + 2))
  return out
}

/**
 * 本地预筛：这张卡的（标题+描述+标签）与任务（标题 3 分 / 标签 2 分 / 说明 1 分）的词面重合数。
 * 分数只决定"谁进候选"，"谁真被这条支撑"交给模型的判词。
 */
function prefilterTasks(d: AppData, text: string, exclude: Set<string>, depth: AiDepth): TaskCard[] {
  const terms = tokenize(text)
  if (!terms.size) return []
  const scored: { t: TaskCard; s: number }[] = []
  for (const t of d.tasks || []) {
    if (t.deletedAt || exclude.has(t.id)) continue
    let s = 0
    for (const term of terms) {
      if (t.title.includes(term)) s += 3
      else if ((t.tags || []).some(x => x.includes(term))) s += 2
      else if ((t.description || '').includes(term)) s += 1
    }
    if (s > 0) scored.push({ t, s })
  }
  return scored.sort((a, b) => b.s - a.s || (b.t.updatedAt || 0) - (a.t.updatedAt || 0))
    .slice(0, CANDIDATE_CAP(depth)).map(x => x.t)
}

export function buildResourceLinkTaskJob(ctx: ResourceLinkTaskCtx): AiJob | null {
  const d = ctx.d
  const res = (d.resources || []).find(r => r.id === ctx.resourceId && !r.deletedAt)
  if (!res) return null
  const known = new Map<string, TaskCard>()
  const drop = { ghost: 0, noWhy: 0 }
  const idx = buildSupportIndex(d)
  const already = new Set((idx.byResource.get(res.id) || []).map(l => l.taskId))
  const personaText = chainPersonaText(ctx.personaId || '')

  const job: AiJob = {
    key: 'linktask:' + res.id,
    title: `关联任务 · ${res.title.slice(0, 14) || '（无名卡）'}`,
    subject: `📌 资源卡「${res.title.slice(0, 24) || '无名卡'}」`,
    hint: '先在本地扫全量任务卡、按词面/标签筛出够格的候选，再让模型只排序和写一句"这张卡在那件任务里干什么用"。' +
      '采纳=记一条关联，**任务卡与资源卡本体都不改**；解绑仍在任务侧做。',
    adoptLabel: '✓ 关联为支持',
    promptScope: 'linktask:card', promptObject: res.id, promptObjectLabel: res.title.slice(0, 14),
    before: () => [
      { key: 'title', label: '标题', main: res.title || '（无名卡）' },
      { key: 'desc', label: '描述', main: res.description || '' },
      { key: 'tags', label: '标签', main: (res.tags || []).join('、') },
      { key: 'tasks', label: '已支撑的任务', main: listByResource(idx, res.id).map(l => {
        const t = d.tasks.find(x => x.id === l.taskId)
        return t ? `${t.title.slice(0, 30)}${l.why ? ` — ${l.why}` : ''}` : ''
      }).filter(Boolean).join('\n') },
    ],
    build: async () => {
      const cands = prefilterTasks(d, [res.title, res.description || '', (res.tags || []).join(' ')].join(' '), already, ctx.depth)
      if (!cands.length) return { messages: [
        { role: 'system', content: resourceLinkTaskSystem() },
        { role: 'user', content: `【资源卡】${res.title}\n【任务清单】（本地预筛后没有一张任务与它字面相关——请返回空 items）` },
      ] }
      for (const t of cands) known.set(t.id, t)
      const list = cands.map(t => `- taskId=${t.id} 「${t.title.slice(0, 50)}」${t.status === 'done' ? '（已完成）' : t.status === 'doing' ? '（进行中）' : '（待开始）'}${t.tags?.length ? ` 标签[${t.tags.join(',')}]` : ''}`).join('\n')
      return { messages: [
        { role: 'system', content: resourceLinkTaskSystem() + (personaText ? `\n\n【执笔视角】${personaText}` : '') },
        { role: 'user', content: [
          `【这条资源】${res.title}`,
          `【它的描述】${(res.description || '').slice(0, 300) || '（无）'}`,
          `【它的标签】${(res.tags || []).join('、') || '（无）'}`,
          `【已挂过它的任务】${already.size ? [...already].map(id => known.get(id)?.title || id).join('、') : '（无）'}`,
          `【任务清单（本地预筛 ${cands.length} 张，已排除挂过的）】\n${list}`,
        ].join('\n') },
      ] }
    },
    parse: (raw) => {
      const items = ((raw || {}) as { items?: TaskPick[] }).items || []
      const rows: AiRow[] = []
      const seen = new Set<string>()
      items.slice(0, 6).forEach(it => {
        const id = String(it?.taskId)
        const t = known.get(id)
        if (!t || seen.has(id) || already.has(id)) { drop.ghost++; return }
        seen.add(id)
        const why = String(it.why || '').trim()
        if (!why) drop.noWhy++
        rows.push({
          key: `lt:${id}`, badge: '🔗 任务', main: t.title.slice(0, 40),
          sub: `${why.slice(0, 60) || '（模型没给理由）'}${it.confidence === 'high' ? '' : ' · 中低置信'}`,
          weak: !why || it.confidence !== 'high',
          pair: 'tasks', data: { __taskId: id, why: why.slice(0, 120) },
        })
      })
      return rows
    },
    audit: () => (drop.ghost || drop.noWhy
      ? [drop.ghost ? `${drop.ghost} 行点的任务不在候选里 / 已挂过 / 重复` : '', drop.noWhy ? `${drop.noWhy} 行没给理由（已判低置信）` : ''].filter(Boolean).join(' · ')
      : null),
    apply: (rows) => {
      let added = 0, dup = 0
      for (const r of rows) {
        const s = r.data as { __taskId?: string; why?: string }
        if (!s.__taskId) continue
        const out = addSupportLink(d, { taskId: s.__taskId, resourceId: res.id, from: 'ai', ...(s.why ? { why: s.why } : {}) })
        if (out.dup) dup++; else added++
      }
      if (!added && !dup) return '⚠ 没勾选任何任务，未改动'
      res.aiTouchedAt = Date.now()
      ctx.persist()
      return added ? `✓ 已关联 ${added} 件任务（任务侧「资源支持」区可见）${dup ? ` · ${dup} 件已挂过（跳过）` : ''}` : `⚠ 全部已挂过（${dup} 件），未改动`
    },
  }
  /** R167：执笔角色可换（与拆解/补全同一套角色库）；弹窗内不建第二套编辑器，启停恒在 设置→AI 助手 */
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
