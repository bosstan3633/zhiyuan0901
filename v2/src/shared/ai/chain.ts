/**
 * R135：罗盘链式生成任务书工厂——把「层级 × 锚点」组装成可评审 AiJob。
 * 创建类采纳纪律：
 *  - 名称查重（同层同名丢弃，防模型复读现有兄弟）；
 *  - 字段白名单清洗（term/date 格式），非法即弃该字段而非弃整条；
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
  /** R139：生成场景的执笔专家 id（'' / 'default' = 内置执行教练） */
  personaId?: string
  /** R139：宿主在评审抽屉里换专家时回调（重建 job → 自动重跑） */
  onPersona?: (id: string) => void
}

const TERM_SET = new Set(['long', 'mid', 'short'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function cleanItem(s: ChainSuggestion): ChainSuggestion {
  const out: ChainSuggestion = {}
  const name = String(s.name ?? s.title ?? '').trim()
  if (!name) return out
  out.name = out.title = name.length > 40 ? name.slice(0, 40) : name
  if (TERM_SET.has(String(s.term))) out.term = s.term
  if (s.endDate && DATE_RE.test(String(s.endDate))) out.endDate = String(s.endDate)
  if (s.dueDate && DATE_RE.test(String(s.dueDate))) out.dueDate = String(s.dueDate)
  if (s.target) out.target = String(s.target).slice(0, 120)
  if (s.why) out.why = String(s.why).slice(0, 120)
  return out
}

const META: Record<ChainLevel, { title: string; badge: string }> = {
  directions: { title: '战略目标', badge: '目标' },
  projects: { title: '攻坚项目', badge: '项目' },
  metrics: { title: '成功指标', badge: '指标' },
  tasks: { title: '推进任务', badge: '任务' },
}

/** R141（反馈 #2/#3）：抽屉标头的处理对象——按层级找回实体名 */
function anchorSubject(d: AppData, level: ChainLevel, anchorId: string): string {
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
  /** R147-c：消毒账（parse 里攒，audit 里报） */
  const drop = { noName: 0, noWhy: 0 }
  const job: AiJob = {
    key: `chain:${level}:${anchorId}`,
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
      const bag = raw as { items?: ChainSuggestion[] }
      const list = bag.items || []
      const rows: AiRow[] = []
      list.forEach((s0, i) => {
        const s = cleanItem(s0)
        if (!s.name) { drop.noName++; return }
        if (!s.why?.trim()) drop.noWhy++
        const facts: string[] = []
        if (s.term) facts.push({ long: '远期', mid: '中期', short: '近期' }[s.term]!)
        if (s.endDate) facts.push('止 ' + s.endDate)
        if (s.dueDate) facts.push('限 ' + s.dueDate)
        if (s.target) facts.push('目标：' + s.target)
        // R147-a：没给"为什么是这一步"的建议=模型在凑数，默认不勾
        rows.push({ key: level + ':' + i, badge: meta.badge, main: s.name, sub: [facts.join(' · '), s.why].filter(Boolean).join('\n'), weak: !s.why?.trim(), data: s })
      })
      return rows
    },
    audit: () => [drop.noName ? `${drop.noName} 行连名字都没给（丢弃）` : '', drop.noWhy ? `${drop.noWhy} 行没给理由（已判弱）` : ''].filter(Boolean).join('、') || null,
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
  return job
}

/** 落库：与 CompassTree.addDirection / compass.addProjectToDir / metrics.push / TaskManagerPanel.createNewTask 同形 */
export function applyChain(level: ChainLevel, anchorId: string, ctx: ChainCtx, rows: AiRow[]): string {
  const d = ctx.d
  let made = 0, dup = 0
  const now = Date.now()
  const mkTask = (s: ChainSuggestion, projectId?: string, metricId?: string) => ({
    id: uid('tk'), kind: 'task' as const, title: s.name!, status: 'todo' as const,
    priority: 'medium' as const,
    dueDate: s.dueDate,
    projectId, metricId,
    customFields: {},
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
      const met = { id: uid('met'), title: s.name, target: s.target, taskIds: [] as string[] }
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
  }
  ctx.persist()
  return `✓ 已创建 ${made} 项${dup ? ` · 同名跳过 ${dup}` : ''}`
}
