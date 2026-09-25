/**
 * R166 F5：任务侧 AI 补全（第三个"单卡写库"工厂）。
 *
 * 与资源侧 `buildCardEnrichJob` 的分工：资源卡的字段是**元数据**（AI 可以重写），
 * 任务卡的字段是**用户自己定的执行意图**（AI 只能补缺，不能改写）。
 * 所以这里每条写库都带"已填不覆盖"的判据，且归属建议一律判弱默认不勾。
 *
 * ★ 本文件住在懒加载侧：宿主点击时才 dynamic import，启动链零 AI（entry-literals 门禁）。
 */
import type { AppData, TaskCard } from '@/shared/models'
import { freshTagsOf, knownTagSet, canonicalTagsOf } from '@/shared/utils/tags'
import type { AiJob, AiRow } from './job'
import type { AiDepth } from './config'
import { projectTaskTargets } from './project'
import { taskEnrichSystem, chainPersonaText } from './scenarios'

export interface TaskEnrichCtx {
  d: AppData
  depth: AiDepth
  persist: () => void
  personaId?: string
  onPersona?: (id: string) => void
}

interface TaskEnrichOut {
  acceptance?: string; tags?: string[]; projectId?: string; metricId?: string; estimateNote?: string
}

/** 说明里是否已经写过验收标准——写过就不再建议（定案：已填不覆盖） */
const hasAcceptance = (desc?: string) => /(验收|完成标准|done when|DoD)/i.test(desc || '')

/** 归属候选校验：只认库里真实存在且未软删的 id（模型乱给的直接丢） */
function liveTarget(d: AppData, projectId?: string, metricId?: string) {
  if (!projectId) return undefined
  for (const dir of d.compass.directions || []) {
    const p = dir.projects.find(x => x.id === projectId)
    if (!p) continue
    if (!metricId) return { projectId, metricId: '' }
    if (p.metrics.some(m => m.id === metricId)) return { projectId, metricId }
  }
  return undefined
}

export function buildTaskEnrichJob(task: TaskCard, ctx: TaskEnrichCtx): AiJob {
  const d = ctx.d
  const known = knownTagSet(d)
  const personaText = chainPersonaText(ctx.personaId || '')
  const haveTags = task.tags || []
  const descHasAcc = hasAcceptance(task.description)
  const targets = projectTaskTargets(d, ctx.depth)
  const hasTargets = !targets.startsWith('（暂无')
  const title = task.title.slice(0, 14) || '（无名任务）'

  return {
    key: 'taskEnrich:' + task.id,
    title: `AI 补全任务 · ${title}`,
    subject: `📌 任务「${title}」`,
    hint: '只补缺、不覆盖：说明里已有验收标准就不再建议，已打的标签不重复给；归属建议默认不勾（替用户乱挂归属＝替他做决策）。勾选采纳才写库。',
    adoptLabel: '✓ 采纳补全（写本卡）',
    promptScope: 'enrich:task', promptObject: task.id, promptObjectLabel: title,
    before: () => [
      { key: 'desc', label: '说明', main: task.description || '' },
      { key: 'tags', label: '标签', main: haveTags.join('、') },
      { key: 'target', label: '归属', main: targetName(d, task) },
      { key: 'est', label: '估时', main: task.estimatedMinutes ? `约 ${task.estimatedMinutes} 分钟` : '' },
      { key: 'subs', label: '子任务', main: (task.subtasks || []).map(s => (s.done ? '✓ ' : '· ') + s.title).join('\n') },
    ],
    build: async () => {
      const { projectCard } = await import('./project')
      void projectCard
      return { messages: [
        { role: 'system', content: taskEnrichSystem(hasTargets) + (personaText ? `\n\n【执笔视角】${personaText}` : '') },
        { role: 'user', content: [
          `【任务卡现状】标题：${task.title}`,
          `说明：${task.description || '（空）'}`,
          `标签：${haveTags.join('、') || '（无）'}`,
          `归属：${targetName(d, task)}`,
          `估时：${task.estimatedMinutes ? task.estimatedMinutes + ' 分钟' : '（未估）'}`,
          `子任务：${(task.subtasks || []).length ? (task.subtasks || []).map(s => s.title).join(' / ') : '（无）'}`,
          `状态：${task.status} · 优先级：${task.priority}`,
          hasTargets ? `\n【项目/指标候选】\n${targets}` : '',
        ].join('\n') },
      ] }
    },
    parse: (raw) => {
      const s = (raw || {}) as TaskEnrichOut
      const rows: AiRow[] = []
      const acc = String(s.acceptance || '').trim().slice(0, 80)
      if (acc && !descHasAcc) rows.push({ key: 'acceptance', badge: '验收', main: acc, sub: '追加进说明末尾（原说明不动）', pair: 'desc', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { acceptance: (t.main || '').trim() } }) }, data: { acceptance: acc } })
      else rows.push({ key: 'acceptance:same', badge: '验收', main: descHasAcc ? '说明里已有验收标准（不重复建议）' : '（AI 没给出可检验的验收标准）', pair: 'desc', changeType: 'same', data: {} })
      const cand = canonicalTagsOf(d, (s.tags || []).filter(t => typeof t === 'string' && t.trim())).filter(t => !haveTags.includes(t)).slice(0, 4)
      const fresh = freshTagsOf(cand, known)
      const inSys = cand.filter(t => fresh.indexOf(t) < 0)
      if (inSys.length) rows.push({ key: 'tags', badge: '标签', main: [...haveTags, ...inSys].join('、'), sub: `并入 ${inSys.join('、')}`, pair: 'tags', edit: { main: true, toRow: (r, t) => ({ ...r, main: t.main || '', data: { tags: String(t.main || '').split('、').filter(Boolean).filter(x => !haveTags.includes(x)) } }) }, data: { tags: inSys } })
      if (fresh.length) rows.push({ key: 'tags:fresh', badge: '新词', badgeType: 'warn', weak: true, main: fresh.join('、'), sub: `新词 ${fresh.join('、')} 不在既有标签体系里（AI 造词）· 勾了才进体系`, pair: 'tags', data: { tags: fresh } })
      const tgt = liveTarget(d, s.projectId, s.metricId)
      if (tgt && (tgt.projectId !== task.projectId || (tgt.metricId || '') !== (task.metricId || ''))) {
        // 归属是"替用户决定这件事属于谁"——一律判弱默认不勾，勾选权必须在人
        rows.push({ key: 'target', badge: '归属', main: targetName(d, { projectId: tgt.projectId, metricId: tgt.metricId || undefined } as TaskCard), sub: `现：${targetName(d, task)} · 低置信，勾了才改`, weak: true, pair: 'target', data: { projectId: tgt.projectId, metricId: tgt.metricId } })
      } else rows.push({ key: 'target:same', badge: '归属', main: targetName(d, task), pair: 'target', changeType: 'same', data: {} })
      const est = String(s.estimateNote || '').trim().slice(0, 30)
      if (est) rows.push({ key: 'est', badge: '估时', advisory: true, main: est, sub: '仅提醒，不写字段', pair: 'est', data: { __note: true } })
      return rows
    },
    apply: (rows) => {
      const live = d.tasks.find(x => x.id === task.id && !x.deletedAt)
      if (!live) return '⚠ 任务已不存在，未写入'
      let n = 0
      for (const r of rows) {
        const s = r.data as { acceptance?: string; tags?: string[]; projectId?: string; metricId?: string; __note?: boolean }
        if (s.__note) continue
        if (s.acceptance) {
          live.description = (live.description ? live.description.trim() + '\n\n' : '') + '🤖 验收标准：' + s.acceptance
          n++
        }
        if (s.tags?.length) { live.tags = [...new Set([...(live.tags || []), ...canonicalTagsOf(d, s.tags)])].slice(0, 10); n++ }
        if (s.projectId && liveTarget(d, s.projectId, s.metricId)) {
          live.projectId = s.projectId
          live.metricId = s.metricId || undefined
          if (live.metricId) {
            for (const dir of d.compass.directions) for (const p of dir.projects) for (const m of p.metrics)
              if (m.id === live.metricId && !m.taskIds.includes(live.id)) m.taskIds.push(live.id)
          }
          n++
        }
      }
      if (!n) return '⚠ 没勾选任何可补的缺项，未改动'
      live.updatedAt = Date.now()
      live.aiTouchedAt = Date.now()
      ctx.persist()
      return `✓ 已补全「${live.title.slice(0, 12)}」（${n} 项）`
    },
  }
}

function targetName(d: AppData, t: { projectId?: string; metricId?: string }): string {
  for (const dir of d.compass.directions || []) for (const p of dir.projects) {
    if (p.id !== t.projectId) continue
    const m = t.metricId ? p.metrics.find(x => x.id === t.metricId) : undefined
    return m ? `${p.name} › ${m.title}` : p.name
  }
  return '未归属'
}
