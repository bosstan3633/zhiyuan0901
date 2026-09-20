/**
 * R135：罗盘链式生成任务书工厂——把「层级 × 锚点」组装成可评审 AiJob。
 * 创建类采纳纪律：
 *  - 名称查重（同层同名丢弃，防模型复读现有兄弟）；
 *  - 字段白名单清洗（term/priority/date 格式、分钟数钳制），非法即弃该字段而非弃整条；
 *  - 实体形状与既有创建通道一致（addDirection/addProjectToDir/metrics.push/createNewTask 同源字段）；
 *  - 锚点在评审期间被删 → 该条静默跳过并计数回报。
 */
import type { AppData, Project } from '@/shared/models'
import { uid } from '@/shared/utils'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { projectChain } from './project'
import { chainSystem, chainPersonaText, allPersonas, personaOverrides, type ChainLevel, type ChainSuggestion } from './scenarios'

export interface ChainCtx {
  d: AppData
  depth: AiDepth
  persist: () => void
  /** 项目创建走 compass store 既有通道（R85 四出口合一）；缺省时本地同形创建 */
  addProject?: (dirId: string, name: string) => Project | null
  /** R139：拆解场景的执笔专家 id（'' / 'default' = 内置执行教练） */
  personaId?: string
  /** R139：宿主在评审抽屉里换专家时回调（重建 job → 自动重跑） */
  onPersona?: (id: string) => void
}

const TERM_SET = new Set(['long', 'mid', 'short'])
const PRIO_SET = new Set(['high', 'medium', 'low'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function cleanItem(s: ChainSuggestion): ChainSuggestion {
  const out: ChainSuggestion = {}
  const name = String(s.name ?? s.title ?? '').trim()
  if (!name) return out
  out.name = out.title = name.length > 40 ? name.slice(0, 40) : name
  if (TERM_SET.has(String(s.term))) out.term = s.term
  if (PRIO_SET.has(String(s.priority))) out.priority = s.priority
  if (s.endDate && DATE_RE.test(String(s.endDate))) out.endDate = String(s.endDate)
  if (s.dueDate && DATE_RE.test(String(s.dueDate))) out.dueDate = String(s.dueDate)
  const m = Number(s.estimatedMinutes)
  if (Number.isFinite(m) && m >= 10 && m <= 600) out.estimatedMinutes = Math.round(m)
  if (s.target) out.target = String(s.target).slice(0, 120)
  if (s.acceptance) out.acceptance = String(s.acceptance).slice(0, 200)
  if (s.why) out.why = String(s.why).slice(0, 120)
  return out
}

const META: Record<ChainLevel, { title: string; badge: string; itemPath: 'items' | 'steps' }> = {
  directions: { title: '战略目标', badge: '目标', itemPath: 'items' },
  projects: { title: '攻坚项目', badge: '项目', itemPath: 'items' },
  metrics: { title: '成功指标', badge: '指标', itemPath: 'items' },
  tasks: { title: '推进任务', badge: '任务', itemPath: 'items' },
  breakdown: { title: '行动步骤', badge: '步骤', itemPath: 'steps' },
}

/** R141（反馈 #2/#3）：抽屉标头的处理对象——按层级找回实体名 */
function anchorSubject(d: AppData, level: ChainLevel, anchorId: string): string {
  if (level === 'breakdown') { const t = d.tasks.find(x => x.id === anchorId); return t ? `📌 任务「${t.title.slice(0, 24)}」` : '' }
  if (level === 'tasks') { for (const x of d.compass.directions) for (const p of x.projects) { const m = p.metrics.find(y => y.id === anchorId); if (m) return `📌 指标「${m.title.slice(0, 24)}」` } }
  if (level === 'metrics') { for (const x of d.compass.directions) { const p = x.projects.find(y => y.id === anchorId); if (p) return `📌 项目「${p.name.slice(0, 24)}」` } }
  if (level === 'projects') { const x = d.compass.directions.find(y => y.id === anchorId); return x ? `📌 目标「${x.name.slice(0, 24)}」` : '' }
  return ''
}

export function buildChainJob(level: ChainLevel, anchorId: string, ctx: ChainCtx): AiJob | null {
  const { text, missing } = projectChain(ctx.d, level, anchorId, ctx.depth)
  if (missing) return null
  const meta = META[level]
  const personaText = chainPersonaText(ctx.personaId || '')
  const job: AiJob = {
    title: `AI 建议${meta.title}（${level === 'directions' ? '从愿景/使命' : '基于上游链'}推导）`,
    subject: anchorSubject(ctx.d, level, anchorId),
    hint: '生成的建议与你现有同层实体查重后才可采纳；勾选才创建，创建走既有通道可回滚（项目/指标入方向树，任务可再删）。',
    build: () => ({
      messages: [
        { role: 'system', content: chainSystem(level, personaText) },
        { role: 'user', content: `当前日期 ${new Date().toLocaleDateString('en-CA')}（换算 dueDate 用）。\n\n${text}` },
      ],
    }),
    parse: (raw) => {
      const bag = raw as { items?: ChainSuggestion[]; steps?: ChainSuggestion[]; plan?: string; assess?: string; recommend?: string; recommendWhy?: string }
      const list = (level === 'breakdown' ? bag.steps : bag.items) || []
      const rows: AiRow[] = []
      list.forEach((s0, i) => {
        const s = cleanItem(s0)
        if (!s.name) return
        const facts: string[] = []
        if (s.term) facts.push({ long: '远期', mid: '中期', short: '近期' }[s.term]!)
        if (s.endDate) facts.push('止 ' + s.endDate)
        if (s.dueDate) facts.push('限 ' + s.dueDate)
        if (s.priority) facts.push({ high: '高优', medium: '中优', low: '低优' }[s.priority]!)
        if (s.estimatedMinutes) facts.push(`约${s.estimatedMinutes}分`)
        if (s.target) facts.push('目标：' + s.target)
        rows.push({ key: level + ':' + i, badge: meta.badge, main: s.name, sub: [facts.join(' · '), s.why].filter(Boolean).join('\n'), data: s })
      })
      if (level === 'breakdown' && bag.plan?.trim()) {
        rows.unshift({ key: 'breakdown:plan', badge: '思路', main: bag.plan.trim().slice(0, 160), data: { __plan: bag.plan.trim() } })
      }
      // R141（反馈 #2）：参谋建议行——任务合理性评估 + 拆子任务/写详情推荐（只读，不进勾选）
      if (level === 'breakdown' && bag.assess?.trim()) {
        const rec = bag.recommend === 'detail' ? '推荐：只把步骤写进任务详情' : bag.recommend === 'subtasks' ? '推荐：拆成多个子任务' : ''
        rows.unshift({
          key: 'breakdown:verdict', badge: '参谋', advisory: true,
          main: bag.assess.trim().slice(0, 120),
          sub: [rec, (bag.recommendWhy || '').trim().slice(0, 60)].filter(Boolean).join(' · '),
          data: { __verdict: true, recommend: bag.recommend },
        })
      }
      return rows
    },
    apply: (rows) => applyChain(level, anchorId, ctx, rows),
  }
  // R141（反馈 #3）：角色切换推广到全部生成层——宿主传 onPersona 即挂下拉
  if (ctx.onPersona) {
    const ov = personaOverrides()
    job.persona = {
      options: [{ id: 'default', label: '🧑‍🏫 内置角色（默认）' }, ...allPersonas().filter(p => ov[p.id]?.enabled !== false).map(p => ({ id: p.id, label: `${p.icon} ${p.name}` }))],
      current: ctx.personaId || 'default',
      onPick: (id) => ctx.onPersona?.(id),
    }
  }
  if (level === 'breakdown') {
    // R139 双通道：主采纳=建步骤子任务；次采纳=同批勾选步骤合并成清单写进本任务详情（小任务不配子任务时用它）
    job.hint = '勾选后二选一：「采纳」把步骤建成子任务（全库查重）；「步骤写入任务详情」只落清单进描述、不建卡。右上角可换执笔专家，换后自动重跑。'
    job.secondary = { label: '📝 步骤写入任务详情', apply: (rows) => writeStepsToTask(ctx.d, anchorId, rows, ctx.persist) }
  }
  return job
}

/** R139：替换式清单段——重复采纳不堆积，与「🤖 行动方案：」同纪律 */
function writeStepsToTask(d: AppData, taskId: string, rows: AiRow[], persist: () => void): string {
  const t = d.tasks.find(x => x.id === taskId)
  if (!t) return '⚠ 原任务已不存在，未写入'
  const steps = rows.map(r => r.data as ChainSuggestion).filter(s => s.name && !(s as { __plan?: string }).__plan)
  if (!steps.length) return '⚠ 没有勾选任何步骤'
  const lines = steps.map(s => `- ${s.name}${s.dueDate ? `（限 ${s.dueDate}）` : ''}${s.estimatedMinutes ? ` · 约${s.estimatedMinutes}分` : ''}`)
  t.description = (t.description ? t.description.replace(/\n*🤖 步骤清单：[\s\S]*$/, '').trim() + '\n\n' : '') + '🤖 步骤清单：\n' + lines.join('\n')
  t.updatedAt = Date.now()
  persist()
  return `✓ ${steps.length} 步已写入任务详情（未建子任务）`
}

/** 落库：与 CompassTree.addDirection / compass.addProjectToDir / metrics.push / TaskManagerPanel.createNewTask 同形 */
export function applyChain(level: ChainLevel, anchorId: string, ctx: ChainCtx, rows: AiRow[]): string {
  const d = ctx.d
  let made = 0, dup = 0
  const now = Date.now()
  const mkTask = (s: ChainSuggestion, projectId?: string, metricId?: string) => ({
    id: uid('tk'), kind: 'task' as const, title: s.name!, status: 'todo' as const,
    priority: (s.priority || 'medium') as 'high' | 'medium' | 'low',
    dueDate: s.dueDate, estimatedMinutes: s.estimatedMinutes,
    projectId, metricId,
    mountedResourceIds: [], mountedCuriosityIds: [], customFields: {},
    createdAt: now, updatedAt: now,
  })
  if (level === 'directions') {
    for (const r of rows) {
      const s = r.data as ChainSuggestion
      if (!s.name) continue
      if (d.compass.directions.some(x => x.name === s.name)) { dup++; continue }
      d.compass.directions.push({ id: uid('dir'), name: s.name, status: 'active', term: (s.term as 'long' | 'mid' | 'short' | undefined), projects: [] })
      made++
    }
  } else if (level === 'projects') {
    const dir = d.compass.directions.find(x => x.id === anchorId)
    if (!dir) return '⚠ 目标已不存在，未创建任何项目'
    for (const r of rows) {
      const s = r.data as ChainSuggestion
      if (!s.name) continue
      if (dir.projects.some(p => p.name === s.name)) { dup++; continue }
      if (ctx.addProject) ctx.addProject(anchorId, s.name)
      else dir.projects.push({ id: uid('proj'), name: s.name, isFocused: false, pinned: false, progress: 0, status: 'active', order: dir.projects.length, metrics: [] })
      made++
    }
  } else if (level === 'metrics') {
    let proj: Project | undefined
    for (const x of d.compass.directions) { const p = x.projects.find(y => y.id === anchorId); if (p) { proj = p; break } }
    if (!proj) return '⚠ 项目已不存在，未创建任何指标'
    for (const r of rows) {
      const s = r.data as ChainSuggestion
      if (!s.name) continue
      if (proj.metrics.some(m => m.title === s.name)) { dup++; continue }
      const met = { id: uid('met'), title: s.name, target: s.target, acceptance: s.acceptance, taskIds: [] as string[] }
      proj.metrics.push(met)
      made++
    }
  } else if (level === 'tasks') {
    let met: { id: string; taskIds: string[]; title: string } | undefined
    let proj: Project | undefined
    for (const x of d.compass.directions) for (const p of x.projects) { const m = p.metrics.find(y => y.id === anchorId); if (m) { met = m; proj = p; break } }
    if (!met || !proj) return '⚠ 指标已不存在，未创建任何任务'
    for (const r of rows) {
      const s = r.data as ChainSuggestion
      if (!s.name) continue
      const existing = met.taskIds.map(id => d.tasks.find(t => t.id === id)).filter(Boolean)
      if (existing.some(t => t!.title === s.name)) { dup++; continue }
      const t = mkTask(s, proj.id, met.id)
      d.tasks.unshift(t)
      met.taskIds.push(t.id)
      made++
    }
  } else { // breakdown
    const t = d.tasks.find(x => x.id === anchorId)
    if (!t) return '⚠ 原任务已不存在，未创建任何步骤'
    for (const r of rows) {
      const s = r.data as ChainSuggestion
      if ((s as { __plan?: string }).__plan) {
        const plan = (s as { __plan: string }).__plan
        t.description = (t.description ? t.description.replace(/\n*🤖 行动方案：[\s\S]*$/, '').trim() + '\n\n' : '') + '🤖 行动方案：\n' + plan
        t.updatedAt = Date.now()
        made++
        continue
      }
      if (!s.name) continue
      if (d.tasks.some(x => !x.deletedAt && x.title === s.name)) { dup++; continue }
      const step = mkTask(s, t.projectId, t.metricId)
      d.tasks.unshift(step)
      if (t.metricId) {
        for (const x of d.compass.directions) for (const p of x.projects) { const m = p.metrics.find(y => y.id === t.metricId); if (m) m.taskIds.push(step.id) }
      }
      made++
    }
  }
  ctx.persist()
  return `✓ 已创建 ${made} 项${dup ? ` · 同名跳过 ${dup}` : ''}`
}
