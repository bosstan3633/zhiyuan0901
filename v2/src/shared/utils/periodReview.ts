/**
 * V4.3.0：四周期 AI 复盘的只读上下文。
 *
 * 这一层只负责把已经存在于本机的战报、方向树和卡片状态整理成一份稳定、
 * 可核对的摘要；它不调用 AI、不写库，也不重新定义产品统计口径。
 */
import type { AppData, Direction, Metric, Project, TaskCard } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import type { DailyStats } from '@/shared/utils/dailyStats'
import { aggregateRange } from '@/shared/utils/dailyStats'
import { prevWindow, todayKey, windowOf } from '@/shared/utils/reviewReport'

export type PeriodReviewRange = 'today' | 'week' | 'month' | 'year'

export type PeriodReviewTargetType =
  | 'battle'
  | 'log'
  | 'direction'
  | 'project'
  | 'metric'
  | 'task'
  | 'resource'
  | 'curation'

export interface PeriodReviewTarget {
  type: PeriodReviewTargetType
  /** battle 可为日期；其余类型必须是 allowedTargets 内的 id。 */
  id?: string
  label?: string
}

export interface PeriodReviewInsight {
  title: string
  detail: string
  evidence: string[]
}

export interface PeriodReviewAction {
  title: string
  reason: string
  target: PeriodReviewTarget
}

export interface PeriodReviewResult {
  range: PeriodReviewRange
  headline: string
  insights: PeriodReviewInsight[]
  actions: PeriodReviewAction[]
  confidence: 'high' | 'medium' | 'low'
  dataGaps: string[]
  generatedAt: number
  fingerprint: string
  cached?: boolean
}

export interface PeriodReviewWindow {
  start: string
  end: string
  previousStart: string
  previousEnd: string
  label: string
  days: number
}

export interface PeriodReviewAllowedTarget {
  type: Exclude<PeriodReviewTargetType, 'battle' | 'log'>
  id: string
  label: string
}

export interface PeriodReviewContext {
  range: PeriodReviewRange
  label: string
  generatedAt: number
  fingerprint: string
  window: PeriodReviewWindow
  account: {
    activeDays: number
    events: number
    created: number
    deleted: number
    restored: number
    called: number
    statusChanged: number
    completedTasks: number
    focusDone: number
    focusTotal: number
  }
  directionTree: {
    vision: string
    mission: string
    directions: Array<{
      id: string
      name: string
      status: string
      focused: boolean
      projects: Array<{
        id: string
        name: string
        status: string
        focused: boolean
        progress: number
        openTasks: number
        doneTasks: number
        metrics: Array<{
          id: string
          title: string
          target?: string
          acceptance?: string
          totalTasks: number
          doneTasks: number
          progress: number
        }>
      }>
    }>
    unassignedTasks: Array<{ id: string; title: string; status: string; reason: string }>
  }
  curation: {
    workspaces: number
    nodes: number
    thesisCards: number
    activeNodes: Array<{ id: string; title: string; workspaceId: string }>
  }
  activity: {
    events: Array<{ id: string; ts: number; action: string; kind: string; title: string; to?: string }>
    focusSlots: Array<{ day: string; text: string; done: boolean; sourceType?: string }>
  }
  allowedTargets: PeriodReviewAllowedTarget[]
  facts: string[]
}

const RANGE_LABEL: Record<PeriodReviewRange, string> = {
  today: '今天',
  week: '本周',
  month: '本月',
  year: '本年',
}

const localDay = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const dayStart = (ts: number): number => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const dayEnd = (ts: number): number => {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function safeText(value: unknown, max = 120): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function taskOfProject(data: AppData, projectId: string): TaskCard[] {
  return (data.tasks || []).filter(task => !task.deletedAt && task.projectId === projectId)
}

function metricProgress(data: AppData, metric: Metric): { total: number; done: number; progress: number } {
  const linked = new Set(metric.taskIds || [])
  const tasks = (data.tasks || []).filter(task => !task.deletedAt && (task.metricId === metric.id || linked.has(task.id)))
  const done = tasks.filter(task => task.status === 'done').length
  return { total: tasks.length, done, progress: tasks.length ? Math.round(done / tasks.length * 100) : 0 }
}

function projectSummary(data: AppData, project: Project) {
  const tasks = taskOfProject(data, project.id)
  const done = tasks.filter(task => task.status === 'done').length
  const metrics = (project.metrics || []).map(metric => {
    const progress = metricProgress(data, metric)
    return {
      id: metric.id,
      title: safeText(metric.title, 60),
      target: safeText(metric.target, 80) || undefined,
      acceptance: safeText(metric.acceptance, 100) || undefined,
      totalTasks: progress.total,
      doneTasks: progress.done,
      progress: progress.progress,
    }
  })
  return {
    id: project.id,
    name: safeText(project.name, 60),
    status: project.status,
    focused: !!project.isFocused,
    progress: Math.max(0, Math.min(100, Math.round(project.progress || 0))),
    openTasks: tasks.filter(task => task.status !== 'done').length,
    doneTasks: done,
    metrics,
  }
}

function windowOfRange(range: PeriodReviewRange, now: number): PeriodReviewWindow {
  if (range === 'today') {
    const start = dayStart(now)
    const previousStart = dayStart(start - 86400000)
    return {
      start: localDay(start),
      end: localDay(now),
      previousStart: localDay(previousStart),
      previousEnd: localDay(previousStart),
      label: `${localDay(start)} · 今天`,
      days: 1,
    }
  }
  if (range === 'year') {
    const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime()
    const previousStart = new Date(new Date(now).getFullYear() - 1, 0, 1).getTime()
    return {
      start: localDay(yearStart),
      end: localDay(now),
      previousStart: localDay(previousStart),
      previousEnd: localDay(new Date(new Date(now).getFullYear() - 1, 11, 31).getTime()),
      label: `${new Date(now).getFullYear()} 年`,
      days: Math.max(1, Math.round((dayStart(now) - yearStart) / 86400000) + 1),
    }
  }
  const current = windowOf(range, {}, now)
  const previous = prevWindow(current)
  return {
    start: current.s,
    end: current.e,
    previousStart: previous.s,
    previousEnd: previous.e,
    label: current.label,
    days: current.days,
  }
}

function eventInWindow(event: CardEvent, start: string, end: string): boolean {
  const day = localDay(event.ts)
  return day >= start && day <= end
}

function countEvents(events: CardEvent[], start: string, end: string): {
  events: number
  created: number
  deleted: number
  restored: number
  called: number
  statusChanged: number
  completedTasks: number
} {
  const rows = events.filter(event => eventInWindow(event, start, end))
  let created = 0, deleted = 0, restored = 0, called = 0, statusChanged = 0, completedTasks = 0
  for (const event of rows) {
    if (event.action === 'create') created++
    else if (event.action === 'delete') deleted++
    else if (event.action === 'restore') restored++
    else if (event.action === 'call') called++
    else if (event.action === 'status') {
      statusChanged++
      if (event.kind === 'task' && event.to === 'done') completedTasks++
    }
  }
  return { events: rows.length, created, deleted, restored, called, statusChanged, completedTasks }
}

function focusStats(data: AppData, start: string, end: string): { done: number; total: number; slots: PeriodReviewContext['activity']['focusSlots'] } {
  const slots: PeriodReviewContext['activity']['focusSlots'] = []
  let done = 0
  for (const [day, list] of Object.entries(data.dailyFocus || {})) {
    if (day < start || day > end) continue
    for (const slot of list || []) {
      if (!slot) continue
      slots.push({ day, text: safeText(slot.text, 100), done: !!slot.done, sourceType: slot.sourceType })
      if (slot.done) done++
    }
  }
  return { done, total: slots.length, slots }
}

function buildAllowedTargets(data: AppData, directions: Direction[]): PeriodReviewAllowedTarget[] {
  const out: PeriodReviewAllowedTarget[] = []
  for (const direction of directions) {
    if (direction.status === 'archived') continue
    out.push({ type: 'direction', id: direction.id, label: safeText(direction.name, 60) })
    for (const project of direction.projects || []) {
      if (project.status === 'archived') continue
      out.push({ type: 'project', id: project.id, label: safeText(project.name, 60) })
      for (const metric of project.metrics || []) {
        out.push({ type: 'metric', id: metric.id, label: safeText(metric.title, 60) })
      }
    }
  }
  for (const task of data.tasks || []) {
    if (!task.deletedAt) out.push({ type: 'task', id: task.id, label: safeText(task.title, 60) })
  }
  for (const resource of data.resources || []) {
    if (!resource.deletedAt) out.push({ type: 'resource', id: resource.id, label: safeText(resource.title, 60) })
  }
  for (const workspace of data.workspaces || []) {
    if (!workspace.archived && !workspace.hidden && workspace.kind !== 'resource') {
      out.push({ type: 'curation', id: workspace.id, label: safeText(workspace.name, 60) })
    }
  }
  return out.slice(0, 180)
}

function unassignedTaskRows(data: AppData): PeriodReviewContext['directionTree']['unassignedTasks'] {
  return (data.tasks || [])
    .filter(task => !task.deletedAt && (!task.projectId || !task.metricId))
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 30)
    .map(task => ({
      id: task.id,
      title: safeText(task.title, 80),
      status: task.status,
      reason: !task.projectId ? '未挂项目' : '未挂成功指标',
    }))
}

function flatFacts(ctx: Omit<PeriodReviewContext, 'facts' | 'fingerprint'>, stats: DailyStats): string[] {
  const facts = [
    `范围：${ctx.window.start} → ${ctx.window.end}（${ctx.window.days} 天）`,
    `账号级操作：${ctx.account.events} 条；新增 ${ctx.account.created}；删除 ${ctx.account.deleted}；恢复 ${ctx.account.restored}；调出 ${ctx.account.called}；状态变更 ${ctx.account.statusChanged}；完成任务 ${ctx.account.completedTasks}；今日三件事 ${ctx.account.focusDone}/${ctx.account.focusTotal}`,
    `方向树：愿景「${ctx.directionTree.vision || '未填写'}」；使命「${ctx.directionTree.mission || '未填写'}」；战略目标 ${ctx.directionTree.directions.length} 个；未归档任务 ${ctx.directionTree.unassignedTasks.length} 个`,
    `策展：${ctx.curation.workspaces} 个台、${ctx.curation.nodes} 个节点、${ctx.curation.thesisCards} 张论点卡`,
    `活动强度：有效动作 ${aggregateRange(stats, ctx.window.start, ctx.window.end).acts} 件；加权分 ${Math.round(aggregateRange(stats, ctx.window.start, ctx.window.end).W)} 分`,
  ]
  const focused = ctx.directionTree.directions.flatMap(direction => direction.projects.filter(project => project.focused).map(project => `${direction.name}/${project.name}（${project.progress}%）`))
  if (focused.length) facts.push(`当前主攻：${focused.slice(0, 4).join('；')}`)
  if (ctx.directionTree.unassignedTasks.length) {
    facts.push(`未归档任务样本：${ctx.directionTree.unassignedTasks.slice(0, 6).map(task => task.title).join('；')}`)
  }
  return facts
}

/**
 * 生成 AI 投料上下文。所有字段都来自现有 AppData / 事件日志 / 日聚合，
 * 不读取正文附件，不把附件 blob 或 AI 密钥带入上下文。
 */
export function buildPeriodReviewContext(input: {
  data: AppData
  events: CardEvent[]
  stats: DailyStats
  range: PeriodReviewRange
  now?: number
}): PeriodReviewContext {
  const now = input.now || Date.now()
  const data = input.data
  const window = windowOfRange(input.range, now)
  const directions = (data.compass?.directions || []).filter(direction => direction.status !== 'archived')
  const current = countEvents(input.events, window.start, window.end)
  const focus = focusStats(data, window.start, window.end)
  const tree = directions.map(direction => ({
    id: direction.id,
    name: safeText(direction.name, 60),
    status: direction.status,
    focused: (direction.projects || []).some(project => project.isFocused),
    projects: (direction.projects || []).map(project => projectSummary(data, project)),
  }))
  const activeNodes = (data.categories || [])
    .filter(node => !node.deletedAt)
    .slice(0, 40)
    .map(node => ({ id: node.id, title: safeText(node.name, 80), workspaceId: node.workspaceId }))
  const base: Omit<PeriodReviewContext, 'facts' | 'fingerprint'> = {
    range: input.range,
    label: RANGE_LABEL[input.range],
    generatedAt: now,
    window,
    account: {
      ...current,
      activeDays: new Set(input.events.filter(event => eventInWindow(event, window.start, window.end)).map(event => localDay(event.ts))).size,
      focusDone: focus.done,
      focusTotal: focus.total,
    },
    directionTree: {
      vision: safeText(data.compass?.vision?.content, 180),
      mission: safeText(data.compass?.mission?.content, 180),
      directions: tree,
      unassignedTasks: unassignedTaskRows(data),
    },
    curation: {
      workspaces: (data.workspaces || []).filter(workspace => !workspace.archived && workspace.kind !== 'resource').length,
      nodes: (data.categories || []).filter(node => !node.deletedAt).length,
      thesisCards: (data.resources || []).filter(resource => !resource.deletedAt && resource.isThesis).length,
      activeNodes,
    },
    activity: {
      events: input.events
        .filter(event => eventInWindow(event, window.start, window.end))
        .slice(-80)
        .map(event => ({
          id: event.id,
          ts: event.ts,
          action: event.action,
          kind: event.kind,
          title: safeText(event.title, 100),
          ...(event.to ? { to: event.to } : {}),
        })),
      focusSlots: focus.slots.slice(0, 60),
    },
    allowedTargets: buildAllowedTargets(data, directions),
  }
  const facts = flatFacts(base, input.stats)
  const fingerprint = hashText(JSON.stringify({ ...base, facts }))
  return { ...base, facts, fingerprint }
}

/** FNV-1a：只用于本地缓存指纹，不作安全摘要。 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function formatPeriodReviewTarget(target: PeriodReviewTarget): string {
  return target.label || target.id || target.type
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  for (const candidate of [fence?.[1], raw].filter(Boolean) as string[]) {
    const text = candidate.trim()
    try {
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch { /* 尝试从正文中截取 JSON */ }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
      } catch { /* 继续 */ }
    }
  }
  throw new Error('AI 返回内容不是可解析的结构化洞察')
}

function safeTarget(raw: unknown, ctx: PeriodReviewContext): PeriodReviewTarget | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const type = String(row.type || '').trim() as PeriodReviewTargetType
  const id = String(row.id || '').trim()
  if (type === 'battle' || type === 'log') {
    return { type, ...(id ? { id } : {}), ...(safeText(row.label, 60) ? { label: safeText(row.label, 60) } : {}) }
  }
  const hit = ctx.allowedTargets.find(target => target.type === type && (
    (id && target.id === id) || (!id && target.label === safeText(row.label, 60))
  ))
  return hit ? { type: hit.type, id: hit.id, label: hit.label } : null
}

/**
 * 解析并消毒 AI 结果。
 * 动作目标只能来自本轮上下文白名单；模型编造的卡片、项目或指标 id 会被丢弃。
 */
export function parsePeriodReview(raw: string, ctx: PeriodReviewContext): PeriodReviewResult {
  const parsed = parseJsonObject(raw)
  const headline = safeText(parsed.headline, 180)
  if (!headline) throw new Error('AI 返回缺少总判断')
  const insights: PeriodReviewInsight[] = []
  for (const item of Array.isArray(parsed.insights) ? parsed.insights : []) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const title = safeText(row.title, 40)
    const detail = safeText(row.detail, 220)
    if (!title || !detail) continue
    const evidence = (Array.isArray(row.evidence) ? row.evidence : [])
      .map(value => safeText(value, 100))
      .filter(Boolean)
      .slice(0, 4)
    insights.push({ title, detail, evidence })
    if (insights.length >= 4) break
  }
  if (!insights.length) throw new Error('AI 返回缺少可核对的洞察')

  const actions: PeriodReviewAction[] = []
  for (const item of Array.isArray(parsed.actions) ? parsed.actions : []) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const title = safeText(row.title, 50)
    const reason = safeText(row.reason, 120)
    const target = safeTarget(row.target, ctx)
    if (!title || !reason || !target) continue
    actions.push({ title, reason, target })
    if (actions.length >= 3) break
  }
  if (!actions.length) {
    actions.push({
      title: '打开完整记录',
      reason: '核对 AI 本轮引用的账号级操作明细。',
      target: { type: 'log', label: '完整记录' },
    })
  }

  const confidenceRaw = String(parsed.confidence || '').trim()
  const confidence = confidenceRaw === 'high' || confidenceRaw === 'low' ? confidenceRaw : 'medium'
  const dataGaps = (Array.isArray(parsed.dataGaps) ? parsed.dataGaps : [])
    .map(value => safeText(value, 80))
    .filter(Boolean)
    .slice(0, 3)
  return {
    range: ctx.range,
    headline,
    insights,
    actions,
    confidence,
    dataGaps,
    generatedAt: Date.now(),
    fingerprint: ctx.fingerprint,
  }
}
