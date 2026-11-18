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
import {
  FOCUS_LIMIT,
  activeFocusSlots,
  clearedFocusSlot,
  detachFocusTaskFromDate,
  normalizedFocusSlots,
} from './focusSlots'
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

    if (t.dueDate) {
      const dd = dayDiff(t.dueDate, opts.anchorKey)
      if (dd < 0) { score += 30; facts.push(`已逾期 ${-dd} 天`) }
      else if (dd === 0) { score += 28; facts.push('今天到期') }
      else if (dd <= 3) { score += 16; facts.push(`${dd} 天后到期`) }
    }

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
 * V4.3.4：今日三件事与计划执行日期保持双向一致。
 * 只有真正进入某个日期三件事槽位的任务才写回 `dueDate`；留作候选但没占格的任务不动。
 */
export function syncFocusTasksToSchedule(
  d: AppData,
  anchorKey: string,
  slots: FocusSlot[] = d.dailyFocus?.[anchorKey] || [],
): number {
  const ids = new Set(
    activeFocusSlots(slots)
      .filter(slot => slot.sourceType === 'task' && slot.sourceId)
      .map(slot => slot.sourceId as string),
  )
  if (!ids.size) return 0
  const stamp = Date.now()
  let changed = 0
  for (const task of d.tasks) {
    if (task.deletedAt || !ids.has(task.id) || task.dueDate === anchorKey) continue
    task.dueDate = anchorKey
    task.updatedAt = stamp
    changed++
  }
  return changed
}

function localDateKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * V4.3.5：旧设备快照或三方合并后，今日三件事与今日日历可能短暂不同源。
 * 以任务卡为唯一真源收敛：
 * - 已在今日槽位的任务，计划执行日期统一写回今天；
 * - 已排到今天的任务，有空槽就补入，没有空槽就撤掉今天的计划日期；
 * - 同一任务重复占多个槽时只保留第一格，其余槽位写墓碑。
 */
export function reconcileTodayFocusSchedule(
  d: AppData,
  anchorKey = localDateKey(),
): number {
  if (!d.dailyFocus) d.dailyFocus = {}
  const cells = normalizedFocusSlots(d.dailyFocus[anchorKey])
  const live = new Map(d.tasks.filter(task => !task.deletedAt).map(task => [task.id, task]))
  const seen = new Set<string>()
  const stamp = Date.now()
  let changed = 0

  for (let index = 0; index < FOCUS_LIMIT; index++) {
    const slot = cells[index]
    if (!slot || slot.cleared || slot.sourceType !== 'task' || !slot.sourceId) continue
    if (seen.has(slot.sourceId)) {
      cells[index] = clearedFocusSlot(index, slot)
      changed++
      continue
    }
    seen.add(slot.sourceId)
    const task = live.get(slot.sourceId)
    if (!task) {
      cells[index] = clearedFocusSlot(index, slot)
      changed++
      continue
    }
    if (task.dueDate !== anchorKey) {
      task.dueDate = anchorKey
      task.updatedAt = stamp
      changed++
    }
    const done = task.status === 'done'
    if (slot.done !== done || slot.text !== task.title) {
      slot.done = done
      slot.doneAt = done ? (task.completedAt || slot.doneAt || stamp) : undefined
      slot.text = task.title
      slot.updatedAt = stamp
      changed++
    }
  }

  const dueToday = [...live.values()]
    .filter(task => task.dueDate === anchorKey && !seen.has(task.id))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  for (const task of dueToday) {
    const free = cells.findIndex(slot => !slot || slot.cleared)
    if (free < 0) {
      task.dueDate = undefined
      task.updatedAt = stamp
      changed++
      continue
    }
    const done = task.status === 'done'
    cells[free] = {
      id: uid('focus'),
      slotIndex: free as 0 | 1 | 2,
      sourceType: 'task',
      sourceId: task.id,
      text: task.title,
      done,
      doneAt: done ? task.completedAt : undefined,
      updatedAt: stamp,
    }
    seen.add(task.id)
    changed++
  }

  if (changed) {
    d.dailyFocus[anchorKey] = cells.map((slot, index) => {
      if (!slot) return clearedFocusSlot(index)
      return { ...slot, slotIndex: index as 0 | 1 | 2 }
    })
  }
  return changed
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
export function applyFocusOrder(d: AppData, anchorKey: string, orderedIds: string[], limit = FOCUS_LIMIT): { changed: number } {
  if (!d.dailyFocus) d.dailyFocus = {}
  const cells = normalizedFocusSlots(d.dailyFocus[anchorKey]).slice(0, limit)
  const used = new Set<string>()
  for (const s of cells) {
    if (s && !s.cleared && s.auto !== true && !s.done) used.add(s.sourceId || '')
  }
  const byId = new Map(d.tasks.filter(t => !t.deletedAt).map(t => [t.id, t]))
  const queue = orderedIds.filter(id => byId.has(id) && !used.has(id))
  let changed = 0
  const next = cells.slice()
  for (let index = 0; index < limit; index++) {
    const s = next[index]
    if (s && !s.cleared && (s.auto !== true || s.done)) continue
    const id = queue.shift()
    if (!id) continue
    if (s && !s.cleared && s.sourceType === 'task') detachFocusTaskFromDate(d, anchorKey, s.sourceId)
    const task = byId.get(id)!
    next[index] = {
      id: s?.id || uid('focus'),
      slotIndex: index as 0 | 1 | 2,
      sourceType: 'task',
      sourceId: id,
      text: task.title,
      done: false,
      auto: true,
      updatedAt: Date.now(),
    }
    changed++
  }
  d.dailyFocus[anchorKey] = next.map((slot, index) => {
    if (slot) return { ...slot, slotIndex: index as 0 | 1 | 2 }
    return clearedFocusSlot(index)
  })
  syncFocusTasksToSchedule(d, anchorKey, d.dailyFocus[anchorKey])
  return { changed }
}

export type ManualFocusResult =
  | { status: 'added'; index: number }
  | { status: 'replaced'; index: number }
  | { status: 'exists'; index: number }
  | { status: 'full' }
  | { status: 'invalid' }

/**
 * 用户从任务菜单或详情主动选择“设为今日重点”。
 *
 * 与 AI 推荐严格分开：写入手动格（auto 不置 true），已有三格时由调用方让用户选择
 * 要替换哪一格，再带着 slotIndex 二次调用。任务状态与归属不改；计划执行日期与
 * 今日三件事保持同源，进入槽位即落图到当天。
 */
export function addManualFocus(
  d: AppData,
  anchorKey: string,
  taskId: string,
  slotIndex?: number,
  limit = FOCUS_LIMIT,
): ManualFocusResult {
  const task = d.tasks.find(row => !row.deletedAt && row.id === taskId)
  if (!task || task.status === 'done') return { status: 'invalid' }
  if (!d.dailyFocus) d.dailyFocus = {}
  const cells = normalizedFocusSlots(d.dailyFocus[anchorKey]).slice(0, limit)
  const existing = cells.findIndex(slot => !!slot && !slot.cleared && slot.sourceType === 'task' && slot.sourceId === taskId)
  if (existing >= 0) {
    syncFocusTasksToSchedule(d, anchorKey, d.dailyFocus[anchorKey])
    return { status: 'exists', index: existing }
  }

  const slot: FocusSlot = {
    id: uid('focus'),
    slotIndex: 0,
    sourceType: 'task',
    sourceId: task.id,
    text: task.title,
    done: false,
    updatedAt: Date.now(),
  }

  const freeIndex = cells.findIndex(cell => !cell || cell.cleared)
  if (freeIndex >= 0) {
    const index = Math.min(freeIndex, limit - 1)
    slot.slotIndex = index as 0 | 1 | 2
    cells[index] = slot
    d.dailyFocus[anchorKey] = cells.map((cell, i) => cell
      ? { ...cell, slotIndex: i as 0 | 1 | 2 }
      : clearedFocusSlot(i))
    syncFocusTasksToSchedule(d, anchorKey, d.dailyFocus[anchorKey])
    return { status: 'added', index }
  }

  if (slotIndex === undefined || slotIndex < 0 || slotIndex >= limit) return { status: 'full' }
  const previous = cells[slotIndex]
  if (previous && !previous.cleared && previous.sourceType === 'task') {
    detachFocusTaskFromDate(d, anchorKey, previous.sourceId)
  }
  slot.slotIndex = slotIndex as 0 | 1 | 2
  cells[slotIndex] = slot
  d.dailyFocus[anchorKey] = cells.map((cell, i) => cell
    ? { ...cell, slotIndex: i as 0 | 1 | 2 }
    : clearedFocusSlot(i))
  syncFocusTasksToSchedule(d, anchorKey, d.dailyFocus[anchorKey])
  return { status: 'replaced', index: slotIndex }
}
