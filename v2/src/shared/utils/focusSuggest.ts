/**
 * R169-T3：今日三件事的**本地候选与依据**（零 Key、可解释、瞬时）。
 *
 * 分工（这条线不许糊）：
 *  - 本文件：从任务库里挑出"今天值得做"的 ≤N 条，并给出**可核对的事实句**；
 *  - `shared/ai/focusSuggest.ts`：模型只在这些候选里**排序 + 补一句判词**，
 *    不许发明数字、不许提名库里没有的卡（提名了按 R166-3 的消毒口径计入）。
 *  所以 `why` 里的每个数字都必须能回到 `AppData` 上复核 —— 写"AI 认为更重要"这种句子等于替用户做决策。
 *
 * 打分是**加性**的、每一项都对应一句会显示给用户的话：分数与文案同源，
 * 这样 ✦ 浮层里看到的理由就是它被排到前面的真实原因，不是一套解释不了排序的装饰文案。
 */
import type { AppData, FocusSlot, Project, TaskCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import { focusCarried, focusPlannedCounts } from '@/shared/utils/focusHistory'

const DAY_MS = 86_400_000

export interface FocusCandidate {
  taskId: string
  title: string
  /** 一句可核对的事实句（✦ 浮层直接显示） */
  why: string
  /** 全部事实句（AI 排序时整条投料，比只给两句判得准） */
  facts: string[]
  score: number
}

export interface FocusSuggestOpts {
  /** 用户正在看的那一天（'YYYY-MM-DD'）——推荐以它作锚，不用系统今天 */
  anchorKey: string
  excludeTaskIds?: Iterable<string>
  limit?: number
}

interface ProjCtx { proj: Project; dirName: string; todo: number; metricTitle: string; metricTodo: number }

function buildProjIndex(d: AppData): Map<string, ProjCtx> {
  const out = new Map<string, ProjCtx>()
  const live = new Set(d.tasks.filter(t => !t.deletedAt).map(t => t.id))
  for (const dir of d.compass.directions) {
    for (const p of dir.projects) {
      const own = d.tasks.filter(t => !t.deletedAt && t.projectId === p.id)
      const todo = own.filter(t => t.status === 'todo').length
      // 指标缺口：该指标 taskIds 里仍在任务库且未完成的条数
      let metricTitle = ''
      let metricTodo = 0
      let best = -1
      for (const m of p.metrics) {
        const mt = (m.taskIds || []).filter(id => live.has(id)).length
        if (mt > best) { best = mt; metricTitle = m.title; metricTodo = mt }
      }
      out.set(p.id, { proj: p, dirName: dir.name, todo, metricTitle, metricTodo })
    }
  }
  return out
}

function dayDiff(iso: string, anchorKey: string): number {
  const due = new Date(iso + 'T00:00:00').getTime()
  const anchor = new Date(anchorKey + 'T00:00:00').getTime()
  return Math.round((due - anchor) / DAY_MS)
}

/** 本地推荐：返回按分数降序的候选（分数相同按"最近更新"，再按创建时间，保证可复现） */
export function suggestFocus(d: AppData, opts: FocusSuggestOpts): FocusCandidate[] {
  const limit = opts.limit || 8
  const exclude = new Set(opts.excludeTaskIds || [])
  const carried = focusCarried(d, opts.anchorKey, 7)
  const planned = focusPlannedCounts(d, opts.anchorKey, 7)
  const projs = buildProjIndex(d)
  const out: FocusCandidate[] = []

  for (const t of d.tasks) {
    if (t.deletedAt || t.status === 'done' || exclude.has(t.id)) continue
    const pc = t.projectId ? projs.get(t.projectId) : undefined
    const facts: string[] = []
    let score = 0

    if (pc?.proj.isFocused) {
      score += 40
      facts.push(`主攻项目「${pc.proj.name}」进度 ${pc.proj.progress || 0}%`)
      if (pc.todo === 1) facts.push('它是该项目当前**唯一**未开始的任务')
      else if (pc.todo > 1) facts.push(`该项目还有 ${pc.todo} 件未开始`)
    } else if (pc) {
      score += 8
      facts.push(`项目「${pc.proj.name}」还有 ${pc.todo} 件未开始`)
    }

    if (t.status === 'doing') { score += 22; facts.push('已在进行中，接着做成本最低') }

    const lastPlan = carried.get(t.id)
    if (lastPlan) {
      const days = Math.max(1, Math.round((new Date(opts.anchorKey + 'T00:00:00').getTime() - new Date(lastPlan + 'T00:00:00').getTime()) / DAY_MS))
      score += Math.min(26, 14 + days * 4)
      facts.push(`排过一次没做完（顺延 ${days} 天）`)
    } else {
      const n = planned.get(t.id) || 0
      if (n > 1) { score += 6; facts.push(`近 7 天被安排过 ${n} 次`) }
    }

    const subs = t.subtasks || []
    if (subs.length) {
      const dn = subs.filter(s => s.done).length
      if (dn > 0 && dn < subs.length) { score += 10; facts.push(`子任务已完成 ${dn}/${subs.length}`) }
      else if (dn === 0) { score += 4; facts.push(`子任务 ${subs.length} 条一条未动，先拆一步`) }
    }

    if (t.dueDate) {
      const dd = dayDiff(t.dueDate, opts.anchorKey)
      if (dd < 0) { score += 30; facts.push(`已逾期 ${-dd} 天`) }
      else if (dd === 0) { score += 28; facts.push('今天到期') }
      else if (dd <= 3) { score += 16; facts.push(`${dd} 天后到期`) }
    }

    if (t.priority === 'high') { score += 12; facts.push('优先级：高') }
    else if (t.priority === 'medium') score += 4

    if (pc?.metricTitle && pc.metricTodo > 0) facts.push(`指标「${pc.metricTitle}」下还有 ${pc.metricTodo} 件未完成`)

    if (!facts.length) continue // 说不出事实 = 不推荐（宁缺毋滥，别拿"看起来相关"凑数）
    out.push({
      taskId: t.id, title: t.title, score, facts,
      why: facts.slice(0, 2).join(' · ')
    })
  }

  out.sort((a, b) => b.score - a.score
    || (taskOf(d, b.taskId)?.updatedAt || 0) - (taskOf(d, a.taskId)?.updatedAt || 0)
    || (taskOf(d, a.taskId)?.createdAt || 0) - (taskOf(d, b.taskId)?.createdAt || 0))
  return out.slice(0, limit)
}

function taskOf(d: AppData, id: string): TaskCard | undefined {
  return d.tasks.find(t => t.id === id)
}

/**
 * R169-T3：把建议顺序落到某一天的三格里，**永不覆盖人定的格子**。
 *
 * 放在 utils 而不是 ai/：它是纯数据写入，本地推荐与 AI 复核两条路共用同一个落笔口——
 * 分成两处就会出现"本地会守的边界，AI 那条忘了守"。
 * 规则：`auto !== true` 的格子（用户自己选的）与已勾完成的格子**原位原样保留**；
 * 其余格子按传入顺序重填，顺序用完还剩的推荐位保留原任务（AI 只给两条时第三格不清空）。
 * @returns changed = 真正被换掉的格数（0 = 顺序本就一致，或三格都由用户定着）
 */
export function applyFocusOrder(d: AppData, anchorKey: string, orderedIds: string[], limit = 3): { changed: number } {
  if (!d.dailyFocus) d.dailyFocus = {}
  const list = d.dailyFocus[anchorKey] || []
  const used = new Set<string>()
  for (const s of list) if (s.auto !== true && !s.done) used.add(s.sourceId || '')
  const byId = new Map(d.tasks.filter(t => !t.deletedAt).map(t => [t.id, t]))
  const queue = orderedIds.filter(id => byId.has(id) && !used.has(id))
  let changed = 0
  const next: FocusSlot[] = []
  for (const s of list) {
    if (s.auto !== true || s.done) { next.push(s); continue }
    const id = queue.shift()
    if (!id) { next.push(s); continue }
    if (id !== s.sourceId) changed++
    next.push({ id: s.id, sourceType: 'task', sourceId: id, text: byId.get(id)!.title, done: false, auto: true })
  }
  while (queue.length && next.length < limit) {
    const id = queue.shift()!
    const t = byId.get(id)!
    next.push({ id: uid('focus'), sourceType: 'task', sourceId: id, text: t.title, done: false, auto: true })
    changed++
  }
  d.dailyFocus[anchorKey] = next.slice(0, limit)
  return { changed }
}
