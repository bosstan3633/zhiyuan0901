/**
 * R169-T3：今日三件事的 AI 排序入口（两段式，纪律照 `buildTaskSupportJob`）。
 *
 *  ① **本地先出候选与事实句**（`shared/utils/focusSuggest.ts`，零 Key、瞬时、可核对）；
 *  ② **模型只在这些候选里挑三件 + 各写一句"今天做它的理由"**，不生产内容、不发明数字。
 *
 * 为什么要 ②：本地打分能说出"逾期 3 天""顺延 2 天"，但说不出"这件卡着后面三件的下一步"——
 * 那是需要读标题语义的判断。为什么 ① 不能被省：候选必须由本地先筛，模型只在够格的小集合里判轻重，
 * 否则它会在一长串任务标题里瞎点，还会顺手发明一个"进度 80%"。
 *
 * ★写入的边界（AI 不替决策，这条比排序本身重要）：
 *  - 只改 `dailyFocus[这一天]` 的**计划位**，任务卡本体一字不动（不改 status / 不改归属 / 不新建卡）；
 *  - **用户手工选的那格永不覆盖**（`auto !== true` 即视为人定的），已勾完成的格也不动；
 *  - 同一天只在第一次打开时自动写一次（`focusAutoDate`），之后系统不再插手。
 *
 * ★懒加载侧：宿主点击/自动推荐时才 dynamic import（启动零 AI 红线，入口字面量双向必须为 0）。
 */
import type { AppData } from '@/shared/models'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { chat, extractJson } from './llm'
import { focusRankSystem, chainPersonaText } from './scenarios'
import { suggestFocus, applyFocusOrder, type FocusCandidate } from '@/shared/utils/focusSuggest'
import { focusRecentDays, focusWindowTotals } from '@/shared/utils/focusHistory'

export interface FocusSuggestCtx {
  d: AppData
  depth: AiDepth
  persist: () => void
  /** 用户正在看的那一天（'YYYY-MM-DD'） */
  anchorKey: string
  limit?: number
  personaId?: string
  onPersona?: (id: string) => void
}

interface FocusPick { taskId?: string; why?: string; confidence?: string }

/** 候选投料上限：eco 档 6 条、其余 10 条（小集合里排序比长清单里点名靠谱） */
const CANDIDATE_CAP = (depth: AiDepth) => (depth === 'eco' ? 6 : 10)

/** 本地候选（供宿主先写入、也供投料） */
export function localFocusCandidates(d: AppData, anchorKey: string, limit = 3): FocusCandidate[] {
  return suggestFocus(d, { anchorKey, limit: Math.max(limit, 6) })
}

/**
 * 无 Key / 未配好 / 网络失败 / 返回不可用 ⇒ 一律返回 null，**调用方静默回落本地顺序**。
 * 推荐是便利功能，不能因为没有网络就把台面弄空或弹一层错误。
 */
export async function rankFocus(d: AppData, anchorKey: string, depth: AiDepth, opts: { personaId?: string; limit?: number; signal?: AbortSignal } = {}): Promise<{ order: string[]; why: Map<string, string> } | null> {
  const cands = localFocusCandidates(d, anchorKey, opts.limit || 3).slice(0, CANDIDATE_CAP(depth))
  if (!cands.length) return null
  const known = new Set(cands.map(c => c.taskId))
  let raw: string
  try {
    raw = await chat({
      messages: [{ role: 'system', content: focusRankSystem() + (chainPersonaText(opts.personaId || '') ? `\n\n【执笔视角】${chainPersonaText(opts.personaId || '')}` : '') },
        { role: 'user', content: rankUserText(anchorKey, cands, d) }],
      jsonMode: true, signal: opts.signal,
    })
  } catch { return null }
  let items: FocusPick[]
  try { items = ((extractJson(raw) || {}) as { items?: FocusPick[] }).items || [] } catch { return null }
  const order: string[] = []
  const why = new Map<string, string>()
  for (const it of items.slice(0, 3)) {
    const id = String(it?.taskId || '')
    if (!known.has(id) || order.includes(id)) continue
    const w = String(it.why || '').trim()
    if (!w || it.confidence !== 'high') continue // 没判词或非高置信 = 这条不占格（判弱不硬塞）
    order.push(id); why.set(id, w)
  }
  return order.length ? { order, why } : null
}

function rankUserText(anchorKey: string, cands: FocusCandidate[], d: AppData): string {
  const days = focusWindowTotals(focusRecentDays(d, anchorKey, 7))
  const list = cands.map(c => `- taskId=${c.taskId} 「${c.title.slice(0, 40)}」：${c.facts.join('；')}`).join('\n')
  return [
    `【今天】${anchorKey}（近 7 天三件事累计完成 ${days.done}/${days.planned}）`,
    `【候选（本地已按事实筛过，只能从这些里面挑）】\n${list}`,
  ].join('\n')
}

export function buildFocusSuggestJob(ctx: FocusSuggestCtx): AiJob | null {
  const d = ctx.d
  const limit = ctx.limit || 3
  const cands = localFocusCandidates(d, ctx.anchorKey, limit).slice(0, CANDIDATE_CAP(ctx.depth))
  if (!cands.length) return null
  const known = new Map(cands.map(c => [c.taskId, c]))
  const drop = { ghost: 0, noWhy: 0 }
  const cur = (d.dailyFocus?.[ctx.anchorKey] || []).slice(0, limit)

  return {
    key: 'focus:' + ctx.anchorKey,
    title: `今日三件事 · 排 ${ctx.anchorKey}`,
    subject: `📌 ${ctx.anchorKey} 的 ${limit} 格`,
    hint: '本地先按主攻项目 / 状态 / 顺延 / 到期筛出候选，模型只在这些候选里挑三件并各写一句"今天做它的理由"。' +
      '采纳**只改这一天的计划位**：任务卡本体、状态、归属一字不动；你自己选过的那格系统不覆盖。',
    adoptLabel: '✓ 采纳为今日三件事',
    paneMode: 'context',
    promptScope: 'focus:rank', promptObject: ctx.anchorKey, promptObjectLabel: ctx.anchorKey,
    before: () => cur.length
      ? cur.map((s, i) => ({ key: `slot:${i}`, label: `0${i + 1}`, main: s.text, sub: `${s.auto === true ? '✦ 系统推荐' : '你自己选的'}${s.done ? ' · 已完成' : ''}` }))
      : [{ key: 'slot:empty', label: '三格', main: '（今天还没有安排）' }],
    build: async () => ({ messages: [
      { role: 'system', content: focusRankSystem() + (chainPersonaText(ctx.personaId || '') ? `\n\n【执笔视角】${chainPersonaText(ctx.personaId || '')}` : '') },
      { role: 'user', content: rankUserText(ctx.anchorKey, cands, d) },
    ] }),
    parse: (raw) => {
      const items = ((raw || {}) as { items?: FocusPick[] }).items || []
      const rows: AiRow[] = []
      const seen = new Set<string>()
      items.slice(0, limit).forEach((it, i) => {
        const id = String(it?.taskId || '')
        const c = known.get(id)
        if (!c || seen.has(id)) { drop.ghost++; return }
        seen.add(id)
        const w = String(it.why || '').trim()
        if (!w) drop.noWhy++
        rows.push({
          key: `f:${id}`, badge: `第 ${i + 1} 件`, main: c.title.slice(0, 40),
          sub: `${w || '（模型没给理由）'}｜本地依据：${c.why}`,
          weak: !w || it.confidence !== 'high',
          data: { __taskId: id },
        })
      })
      return rows
    },
    audit: () => (drop.ghost || drop.noWhy
      ? [drop.ghost ? `${drop.ghost} 行点的任务不在候选里（或重复）` : '', drop.noWhy ? `${drop.noWhy} 行没给理由（已判低置信）` : ''].filter(Boolean).join(' · ')
      : null),
    apply: (rows) => {
      const ids = rows.map(r => (r.data as { __taskId?: string }).__taskId).filter((x): x is string => !!x)
      if (!ids.length) return '⚠ 没勾选任何候选，未改动'
      const { changed } = applyFocusOrder(d, ctx.anchorKey, ids, limit)
      d.focusAutoDate = ctx.anchorKey
      ctx.persist()
      return changed ? `✓ 已按建议写入今日三件事（换动 ${changed} 格 · 你选的格子未动）` : 'ℹ 当前三格已与你勾选的一致（或都由你手工选定），未改动'
    },
  }
}
