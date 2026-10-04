/**
 * R166 F4：给任务/子任务「找资源支持」。
 *
 * 两段式，纪律照 `buildEvidenceJob`（金字塔找佐证）：
 *  ① **本地预筛**——词面 + 标签打分取 top N，并排除该任务已关联的；
 *  ② **LLM 只做排序 + 一句判词**，不生产内容。
 * 为什么要 ①：资源卡池可能有几百张卡，整库喂给模型既贵又让它在一长串标题里瞎点；
 * 本地先按"和这个任务说的事有没有字面重合"筛一遍，模型只在够格的小集合里判轻重。
 *
 * 采纳写的是独立关联表 `AppData.supportLinks`，**任务本体与资源本体零改动**——
 * 这是「卡间零挂载」红线下的唯一合法形态（定案 5）。
 *
 * ★ 懒加载侧：宿主点击时才 dynamic import。
 */
import type { AppData, ResourceCard, TaskCard, Subtask } from '@/shared/models'
import { CURATION_WS_ID } from '@/shared/models'
import { POOL_DISPLAY_NAME } from '@/shared/utils/wsName'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { catPathOf } from './project'
import { taskSupportSystem, chainPersonaText } from './scenarios'
import { buildSupportIndex, addSupportLink, linkedResourceIds } from '@/shared/utils/supportLinks'

export interface TaskSupportCtx {
  d: AppData
  depth: AiDepth
  persist: () => void
  taskId: string
  subId?: string
  personaId?: string
  onPersona?: (id: string) => void
}

interface SupportPick { cardId?: string; why?: string; confidence?: string }

/** 候选上限：eco 档 24、其余 40——模型在小集合里排序比在长清单里点名靠谱 */
const CANDIDATE_CAP = (depth: AiDepth) => (depth === 'eco' ? 24 : 40)

/**
 * 本地预筛打分：任务文本（标题+说明+标签）与资源（标题 3 分 / 标签 2 分 / 描述 1 分）的词面重合数。
 * 纯字面、不装懂：分数只决定"谁进候选"，"谁真有用"交给模型的判词。
 */
function prefilter(d: AppData, text: string, exclude: Set<string>, depth: AiDepth): ResourceCard[] {
  const terms = tokenize(text)
  if (!terms.size) return []
  const scored: { r: ResourceCard; s: number }[] = []
  for (const r of d.resources || []) {
    if (r.deletedAt || exclude.has(r.id)) continue
    const rt = tokenize([r.title, (r.tags || []).join(' '), r.description || ''].join(' '))
    let s = 0
    for (const t of terms) {
      if (r.title.includes(t)) s += 3
      else if ((r.tags || []).some(x => x.includes(t))) s += 2
      else if ((r.description || '').includes(t)) s += 1
    }
    if (s > 0) scored.push({ r, s })
  }
  return scored.sort((a, b) => b.s - a.s || (b.r.lastCalledAt || 0) - (a.r.lastCalledAt || 0)).slice(0, CANDIDATE_CAP(depth)).map(x => x.r)
}

/** 中文按 2-gram + 英文数字按词——不引分词器（启动链零依赖那套纪律不适用于懒块，但这里没必要加） */
function tokenize(s: string): Set<string> {
  const out = new Set<string>()
  const lower = (s || '').toLowerCase()
  for (const w of lower.match(/[a-z0-9]{2,}/g) || []) out.add(w)
  const zh = lower.replace(/[^一-龥]/g, '')
  for (let i = 0; i + 2 <= zh.length; i++) out.add(zh.slice(i, i + 2))
  return out
}

export function buildTaskSupportJob(ctx: TaskSupportCtx): AiJob | null {
  const d = ctx.d
  const task = d.tasks.find(x => x.id === ctx.taskId && !x.deletedAt)
  if (!task) return null
  const sub: Subtask | undefined = ctx.subId ? (task.subtasks || []).find(s => s.id === ctx.subId) : undefined
  const subjectText = sub ? `${task.title} › ${sub.title}` : task.title
  const known = new Map<string, ResourceCard>()
  const drop = { ghost: 0, noWhy: 0 }

  return {
    key: 'support:' + task.id + (sub ? ':' + sub.id : ''),
    title: `找资源支持 · ${task.title.slice(0, 14) || '（无名任务）'}`,
    subject: sub ? `📌 子任务「${sub.title.slice(0, 20)}」（父：${task.title.slice(0, 14)}）` : `📌 任务「${task.title.slice(0, 20)}」`,
    hint: '先在本地按词面/标签筛出够格的候选，再让模型只排序和写一句"用得上在哪"。采纳=记一条关联，**任务和资源两张卡本体都不改**；解绑只在任务侧。',
    adoptLabel: '✓ 关联为支持',
    promptScope: 'support:task', promptObject: task.id + (sub ? ':' + sub.id : ''), promptObjectLabel: subjectText.slice(0, 14),
    before: () => {
      const idx = buildSupportIndex(d)
      const own = sub ? [] : listTitles(idx, d, task.id)
      return [
        { key: 'title', label: '标题', main: task.title || '（无名任务）' },
        { key: 'desc', label: '说明', main: task.description || '' },
        { key: 'subs', label: '子任务', main: (task.subtasks || []).map(s => (s.done ? '✓ ' : '· ') + s.title).join('\n') },
        { key: 'support', label: '已关联资源', main: own.join('\n') },
      ]
    },
    build: async () => {
      const exclude = linkedResourceIds(buildSupportIndex(d), task.id)
      const cands = prefilter(d, [task.title, task.description || '', (task.tags || []).join(' ')].join(' '), exclude, ctx.depth)
      if (!cands.length) return { messages: [
        { role: 'system', content: taskSupportSystem() },
        { role: 'user', content: `【任务】${subjectText}\n【目录】（本地预筛后没有一张卡与它字面相关——请返回空 items）` },
      ] }
      for (const r of cands) known.set(r.id, r)
      const list = cands.map(r => `- cardId=${r.id} 「${r.title.slice(0, 50)}」${r.tags?.length ? ` 标签[${r.tags.join(',')}]` : ''} 分类:${catPathOf(d, r.categoryId || "") || (r.workspaceId === CURATION_WS_ID ? POOL_DISPLAY_NAME : '策展台')}`).join('\n')
      return { messages: [
        { role: 'system', content: taskSupportSystem() + (chainPersonaText(ctx.personaId || '') ? `\n\n【执笔视角】${chainPersonaText(ctx.personaId || '')}` : '') },
        { role: 'user', content: [
          `【要帮的对象】${sub ? '子任务' : '任务'}：${subjectText}`,
          `【它的说明】${(task.description || '').slice(0, 300) || '（无）'}`,
          `【资源目录（本地预筛 ${cands.length} 张，已排除关联过的）】\n${list}`,
        ].join('\n') },
      ] }
    },
    parse: (raw) => {
      const items = ((raw || {}) as { items?: SupportPick[] }).items || []
      const rows: AiRow[] = []
      const seen = new Set<string>()
      items.slice(0, 6).forEach((it, i) => {
        const id = String(it?.cardId)
        const r = known.get(id)
        if (!r || seen.has(id)) { drop.ghost++; return }
        seen.add(id)
        const why = String(it.why || '').trim()
        if (!why) drop.noWhy++
        rows.push({
          key: `sup:${id}`, badge: '🧭 支持', main: r.title.slice(0, 40),
          sub: `${why.slice(0, 60) || '（模型没给理由）'}${it.confidence === 'high' ? '' : ' · 中低置信'}`,
          weak: !why || it.confidence !== 'high',
          pair: 'support', data: { __cardId: id, why: why.slice(0, 120) },
        })
      })
      return rows
    },
    audit: () => (drop.ghost || drop.noWhy
      ? [drop.ghost ? `${drop.ghost} 行点的卡不在候选目录里（或重复）` : '', drop.noWhy ? `${drop.noWhy} 行没给理由（已判低置信）` : ''].filter(Boolean).join(' · ')
      : null),
    apply: (rows) => {
      let added = 0, dup = 0
      for (const r of rows) {
        const s = r.data as { __cardId?: string; why?: string }
        if (!s.__cardId) continue
        const out = addSupportLink(d, { taskId: task.id, ...(sub ? { subId: sub.id } : {}), resourceId: s.__cardId, from: 'ai', ...(s.why ? { why: s.why } : {}) })
        if (out.dup) dup++; else added++
      }
      if (!added && !dup) return '⚠ 没勾选任何资源，未改动'
      task.aiTouchedAt = Date.now()
      ctx.persist()
      return added ? `✓ 已关联 ${added} 张资源支持${dup ? ` · ${dup} 张已关联过（跳过）` : ''}` : `⚠ 全部已关联过（${dup} 张），未改动`
    },
  }
}

function listTitles(idx: ReturnType<typeof buildSupportIndex>, d: AppData, taskId: string): string[] {
  const out: string[] = []
  for (const l of idx.byTask.get(taskId) || []) {
    const r = d.resources.find(x => x.id === l.resourceId)
    if (r) out.push(`${l.subId ? '↳ ' : ''}${r.title.slice(0, 30)}${l.why ? ` — ${l.why}` : ''}`)
  }
  return out
}
