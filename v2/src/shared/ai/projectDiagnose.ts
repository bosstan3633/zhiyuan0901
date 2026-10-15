/**
 * N2 · V3.8.18 方向台「项目 AI 诊断」——引擎 + 报告存储 + job 工厂。
 *
 * 和设置页那个 `diagnose`（整库多专家会诊）的区别（原型 P3 明写）：
 *  那个粒度是「你整个系统有什么问题」；这里粒度是**单个项目**——这个项目的指标 / 任务 / 拆解哪里断了，
 *  落点是项目舱上的**常驻标签**。所以是**独立 job，不动 diagnose**。
 *
 * 三层分工（这是本文件最要紧的一条）：
 *  ① **判据与结论由规则算**（`runProjectDiagnosis`）——五维度枚举是写死的，AI 只能从枚举里选，不能自造。
 *     原型第 ④ 节的表头就叫「判据（可写死）」：进度停滞=近 14 天无状态变更、指标空转=挂载任务数=0……
 *     这些都是确定性的，交给模型只会引入漂移（今天判停滞、明天判不停滞），而且**无法断言**。
 *  ② **AI 只写「建议动作」那一段**——自然语言、需要权衡取舍、写死没意思的部分。
 *  ③ **报告存 chrome.storage.session**——会话缓存，关浏览器即失效，不进主数据、不进导出链、不落卡片池。
 *
 * 为什么手动触发：AI 全部手动触发是红线——不自动跑、不预生成。
 */
import type { AppData, Project, TaskCard } from '@/shared/models'
import { K } from '@/shared/storage/keys'
import type { AiJob, AiRow } from './job'
import { projectDiagSystem } from './scenarios'

// ─────────────────────────── 五维度枚举（写死） ───────────────────────────

export type DiagLevel = 'ok' | 'warn' | 'bad'

export interface DiagTag {
  /** 枚举里的标签名（**AI 只能引用它，不能造**），如「进度停滞」「指标空转」 */
  tag: string
  level: DiagLevel
  /** 所属维度（项目舱标签 title 里回指"这条是谁说的"） */
  dim: string
}

export interface DiagFinding extends DiagTag {
  /** 一句自然语言结论（带真实数字） */
  text: string
  /** 证据口径，如 `2/5 指标`、`窗口 14 天` */
  evidence: string
}

export interface DiagDim {
  key: 'progress' | 'metrics' | 'breakdown' | 'completion' | 'overall'
  label: string
  status: DiagLevel
  findings: DiagFinding[]
}

export interface ProjectDiagnosis {
  projId: string
  projName: string
  /** 生成时刻（毫秒） */
  genAt: number
  /** 数据指纹——项目数据变了标签就进过期态 */
  fingerprint: string
  verdict: DiagLevel
  verdictLabel: string
  /** 总评一句话（模板生成，不等 AI） */
  summary: string
  dims: DiagDim[]
  /** 项目舱要显示的标签（只收非 ok 的，按档位排序） */
  tags: DiagTag[]
  snapshot: { metrics: number; tasks: number }
  /** AI 建议（未跑 AI 时为空数组） */
  advice: string[]
}

const DAY = 86_400_000
const STALL_WINDOW = 14 * DAY
const OVER_SUBTASKS = 8

export const DIAG_DIM_LABEL: Record<DiagDim['key'], string> = {
  progress: '项目完成情况',
  metrics: '成功指标',
  breakdown: '任务与任务拆解',
  completion: '任务完成情况',
  overall: '项目整体进展',
}

const levelRank = (l: DiagLevel) => (l === 'bad' ? 0 : l === 'warn' ? 1 : 2)
const worst = (xs: DiagLevel[]): DiagLevel =>
  xs.length ? xs.slice().sort((a, b) => levelRank(a) - levelRank(b))[0] : 'ok'

/** 每条 finding 都必须挂一个枚举里的 tag —— 项目舱标签就是从这里来的，不允许自造词 */
function f(dim: DiagDim['key'], tag: string, level: DiagLevel, text: string, evidence: string): DiagFinding {
  return { dim: DIAG_DIM_LABEL[dim], tag, level, text, evidence }
}

function findProject(d: AppData, projId: string): Project | null {
  for (const dir of d.compass?.directions || []) {
    const p = dir.projects.find(x => x.id === projId)
    if (p) return p
  }
  return null
}

/** 项目内任务＝挂在本项目任一指标下的 + projectId 命中的（与 compassMeta 同口径，含去重） */
function tasksOf(d: AppData, proj: Project): TaskCard[] {
  const owned = new Set(proj.metrics.map(m => m.id))
  const seen = new Set<string>()
  const out: TaskCard[] = []
  for (const t of d.tasks || []) {
    if (t.deletedAt || t.lifecycleArchived) continue
    const inMetric = !!t.metricId && owned.has(t.metricId)
    if (t.projectId !== proj.id && !inMetric) continue
    if (seen.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  return out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

/** 数据指纹：项目结构 + 任务状态/时间的组合哈希（变了即报告过期） */
function fingerprintOf(proj: Project, tasks: TaskCard[]): string {
  const raw = [
    proj.id, proj.isFocused ? 1 : 0, proj.pinned ? 1 : 0, proj.progress, proj.status,
    proj.startDate || '', proj.endDate || '',
    ...proj.metrics.map(m => `${m.id}:${(m.acceptance || '').length}:${m.taskIds.length}`),
    ...tasks.map(t => `${t.id}:${t.status}:${t.updatedAt}:${(t.subtasks || []).length}`),
  ].join('|')
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 6)
}

// ─────────────────────────── 规则引擎 ───────────────────────────

/**
 * 纯函数：给定 AppData + 项目 id → 完整诊断。
 * **零 AI、零写库**，因此可以在任何地方同步调、也可以直接被断言钉住。
 */
export function runProjectDiagnosis(d: AppData, projId: string): ProjectDiagnosis | null {
  const proj = findProject(d, projId)
  if (!proj) return null
  const tasks = tasksOf(d, proj)
  const now = Date.now()
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const dims: DiagDim[] = []

  // ── 维度 1 项目完成情况 ────────────────────────────────
  {
    const fs: DiagFinding[] = []
    if (!total) {
      fs.push(f('progress', '尚无任务', 'warn', '这个项目还没有任何任务，进度无从谈起', '0 条任务'))
    } else {
      const lastTouch = tasks.reduce((m, t) => Math.max(m, t.updatedAt || t.createdAt || 0), 0)
      const idleDays = Math.floor((now - lastTouch) / DAY)
      if (done === total) {
        fs.push(f('progress', '全部完成', 'ok', `项目内 ${total} 个任务已全部完成`, `${done}/${total}`))
      } else if (now - lastTouch > STALL_WINDOW) {
        fs.push(f('progress', '进度停滞', 'bad', `最近一次任务状态变更是 ${idleDays} 天前，此后无任何动作`, '窗口 14 天'))
      } else {
        fs.push(f('progress', '在推进', 'ok', `${idleDays} 天内有任务状态变更，推进在继续`, '窗口 14 天'))
      }
    }
    dims.push({ key: 'progress', label: DIAG_DIM_LABEL.progress, status: worst(fs.map(x => x.level)), findings: fs })
  }

  // ── 维度 2 成功指标 ────────────────────────────────────
  {
    const fs: DiagFinding[] = []
    const metrics = proj.metrics || []
    const byMetric = new Map<string, number>()
    for (const t of tasks) if (t.metricId) byMetric.set(t.metricId, (byMetric.get(t.metricId) || 0) + 1)
    const idle = metrics.filter(m => !byMetric.get(m.id))
    const noAccept = metrics.filter(m => !(m.acceptance || '').trim())
    if (!metrics.length) {
      fs.push(f('metrics', '指标缺失', 'warn', '还没有定义成功指标，项目缺少可判定的目标', '0 个指标'))
    } else {
      if (idle.length) {
        fs.push(f('metrics', '指标空转', 'warn',
          `${idle.slice(0, 2).map(m => `「${m.title}」`).join('')}${idle.length > 2 ? ' 等' : ''} ${idle.length} 个指标挂载任务数 = 0`,
          `${idle.length}/${metrics.length} 指标`))
      }
      if (noAccept.length) {
        fs.push(f('metrics', '验收标准缺失', 'warn',
          `${noAccept.length} 个指标没有写明可判定的验收标准`,
          `${metrics.length - noAccept.length}/${metrics.length} 已写明`))
      }
      if (!idle.length && !noAccept.length) {
        fs.push(f('metrics', '指标就绪', 'ok', `${metrics.length} 个指标均有任务承接且验收标准完整`, `${metrics.length}/${metrics.length}`))
      }
    }
    dims.push({ key: 'metrics', label: DIAG_DIM_LABEL.metrics, status: worst(fs.map(x => x.level)), findings: fs })
  }

  // ── 维度 3 任务与任务拆解 ──────────────────────────────
  {
    const fs: DiagFinding[] = []
    if (!total) {
      fs.push(f('breakdown', '尚无任务', 'warn', '没有任务，谈不上拆解', '0 条任务'))
    } else {
      const noSub = tasks.filter(t => !(t.subtasks || []).length)
      const over = tasks.filter(t => (t.subtasks || []).length > OVER_SUBTASKS)
      if (noSub.length) {
        fs.push(f('breakdown', '拆解不足', 'warn',
          `${noSub.length} 个任务完全没有子任务，做完算不算没个判定`,
          `${total - noSub.length}/${total} 有拆解`))
      }
      if (over.length) {
        fs.push(f('breakdown', '拆解过细', 'warn',
          `「${over[0].title}」拆到 ${over[0].subtasks!.length} 项，超过单任务 ${OVER_SUBTASKS} 项上限`,
          `${over.length} 例`))
      }
      if (!noSub.length && !over.length) {
        fs.push(f('breakdown', '粒度合理', 'ok', `${total} 个任务拆解粒度都在合理区间`, `${total}/${total}`))
      }
    }
    dims.push({ key: 'breakdown', label: DIAG_DIM_LABEL.breakdown, status: worst(fs.map(x => x.level)), findings: fs })
  }

  // ── 维度 4 任务完成情况 ────────────────────────────────
  {
    const fs: DiagFinding[] = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const overdue = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate).getTime() < today.getTime())
    if (!total) {
      fs.push(f('completion', '尚无任务', 'warn', '尚无任务，完成率无从计算', '0 条任务'))
    } else {
      if (overdue.length) {
        const worstTask = overdue.slice().sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0]
        const late = Math.floor((today.getTime() - new Date(worstTask.dueDate!).getTime()) / DAY)
        fs.push(f('completion', '逾期未完成', 'bad',
          `「${worstTask.title}」过 dueDate ${late} 天仍是 ${worstTask.status === 'doing' ? '进行中' : '待办'}`,
          `${overdue.length} 条逾期`))
      }
      const rate = Math.round((done / total) * 100)
      const start = proj.startDate ? new Date(proj.startDate).getTime() : NaN
      const end = proj.endDate ? new Date(proj.endDate).getTime() : NaN
      const period = !isNaN(start) && !isNaN(end) && end > start
        ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
        : null
      if (period !== null && rate < period) {
        fs.push(f('completion', '完成率偏低', 'warn',
          `项目整体 ${done}/${total} 任务完成，周期已过 ${period}%`, `${rate}% / ${period}%`))
      } else if (period !== null) {
        fs.push(f('completion', '达成节奏', 'ok',
          `完成率 ${rate}%，不落后于周期进度`, `${rate}% / ${period}%`))
      } else {
        fs.push(f('completion', overdue.length ? '完成率偏低' : '达成节奏', overdue.length ? 'warn' : 'ok',
          `项目整体 ${done}/${total} 任务完成`, `${rate}%`))
      }
    }
    dims.push({ key: 'completion', label: DIAG_DIM_LABEL.completion, status: worst(fs.map(x => x.level)), findings: fs })
  }

  // ── 维度 5 项目整体进展 ────────────────────────────────
  {
    const fs: DiagFinding[] = []
    const owned = new Set(proj.metrics.map(m => m.id))
    const orphans = tasks.filter(t => !t.metricId || !owned.has(t.metricId))
    const orphanMetrics = (proj.metrics || []).filter(m => !tasks.some(t => t.metricId === m.id))
    if (orphans.length) {
      fs.push(f('overall', '归属断链', 'bad',
        `「${orphans[0].title}」未挂在任何成功指标下`, `${orphans.length} 条`))
    }
    if (orphanMetrics.length) {
      fs.push(f('overall', '指标无人接', 'warn',
        `${orphanMetrics.length} 个指标下面没有任何任务承接`,
        `${orphanMetrics.length}/${proj.metrics.length}`))
    }
    if (!orphans.length && !orphanMetrics.length) {
      fs.push(f('overall', '结构完整', 'ok', '每条任务都能回溯到指标，归属链完整', '0 断链'))
    }
    dims.push({ key: 'overall', label: DIAG_DIM_LABEL.overall, status: worst(fs.map(x => x.level)), findings: fs })
    // ★枚举里的「权重错配」**故意不实现**：Project 模型没有权重字段（权重只存在于任务卡 sortOrder），
    //   一条没有真源字段支撑的判据只能靠猜 —— 原型第 ④ 节那行是草稿示例，实现以模型为准。
  }

  const verdict = worst(dims.map(x => x.status))
  const verdictLabel = verdict === 'bad' ? '需处理' : verdict === 'warn' ? '有风险' : '健康'

  // ★同一枚举标签只上一次（「尚无任务」会在 3 个维度里各出现一次，项目舱不该挂三枚重复标签）
  const seenTag = new Set<string>()
  const tags: DiagTag[] = dims
    .flatMap(dim => dim.findings.filter(x => x.level !== 'ok').map(x => ({ tag: x.tag, level: x.level, dim: dim.label })))
    .filter(t => (seenTag.has(t.tag) ? false : (seenTag.add(t.tag), true)))
    .sort((a, b) => levelRank(a.level) - levelRank(b.level))

  return {
    projId,
    projName: proj.name,
    genAt: now,
    fingerprint: fingerprintOf(proj, tasks),
    verdict,
    verdictLabel,
    summary: buildSummary(tasks, done, dims, proj),
    dims,
    tags,
    snapshot: { metrics: (proj.metrics || []).length, tasks: total },
    advice: [],
  }
}

function buildSummary(tasks: TaskCard[], done: number, dims: DiagDim[], proj: Project): string {
  const bits: string[] = []
  const progress = dims.find(x => x.key === 'progress')!
  const completion = dims.find(x => x.key === 'completion')!
  const metrics = dims.find(x => x.key === 'metrics')!
  const stalled = progress.findings.find(x => x.level === 'bad')
  if (stalled) bits.push(`项目已 <b>${(stalled.text.match(/(\d+) 天前/) || [])[1] || '14+'}</b> 天无任何推进`)
  if (tasks.length) bits.push(`${tasks.length} 个任务里 <b>${tasks.length - done}</b> 个未完成`)
  const od = completion.findings.find(x => x.evidence.includes('逾期'))
  if (od) bits.push(`其中 <b>${od.evidence}</b>`)
  const idle = metrics.findings.find(x => x.tag === '指标空转')
  if (idle) bits.push(`${(proj.metrics || []).length} 个成功指标中有 <b>${idle.evidence.split('/')[0]} 个</b>挂着零任务`)
  if (!bits.length) bits.push(`${done}/${tasks.length} 任务完成，结构无断链`)
  return bits.join('，') + '。'
}

// ─────────────────── 报告存储（chrome.storage.session） ───────────────────

type DiagMap = Record<string, ProjectDiagnosis>

/** 宿主在挂载时注册：AI 采纳写完报告后，用它把中央弹窗顶开（连报告一起给，宿主不必再读库） */
let savedHandler: ((rep: ProjectDiagnosis) => void) | null = null
export function setProjectDiagSavedHandler(fn: ((rep: ProjectDiagnosis) => void) | null) { savedHandler = fn }

function sessionArea(): chrome.storage.StorageArea | null {
  try { return (chrome as { storage?: { session?: chrome.storage.StorageArea } }).storage?.session || null }
  catch { return null }
}

export async function loadAllDiagnoses(): Promise<DiagMap> {
  const area = sessionArea()
  if (!area) return {}
  try {
    const got = await area.get(K.PROJ_DIAG)
    const v = got?.[K.PROJ_DIAG]
    return (v && typeof v === 'object' ? v : {}) as DiagMap
  } catch { return {} }
}

export async function saveDiagnosis(rep: ProjectDiagnosis): Promise<void> {
  const area = sessionArea()
  if (!area) return
  try {
    const all = await loadAllDiagnoses()
    all[rep.projId] = rep
    await area.set({ [K.PROJ_DIAG]: all })
    savedHandler?.(rep)
  } catch { /* 会话缓存写失败不该打断用户：报告已算出来，标签这次不更新而已 */ }
}

// ─────────────────────────── job 工厂 ───────────────────────────

export interface ProjectDiagnoseCtx {
  d: AppData
  projId: string
}

/**
 * AI 只产「建议动作」——五维度结论与标签一律由 `runProjectDiagnosis` 现算，
 * 模型给的建议必须是纯文本数组，parse 里做长度与数量消毒（越界整条丢）。
 */
export function buildProjectDiagnoseJob(ctx: ProjectDiagnoseCtx): AiJob | null {
  const rep = runProjectDiagnosis(ctx.d, ctx.projId)
  if (!rep) return null
  const facts = buildFactsText(rep)
  const kept: string[] = []
  return {
    key: 'projDiagnose',
    title: '项目诊断',
    subject: `📌 ${rep.projName}`,
    hint: '结论由规则算死（五维度枚举不可自造），模型只写「建议动作」。勾选后采纳即生成诊断报告。',
    paneMode: 'context',
    build: () => ({ messages: [{ role: 'system', content: projectDiagSystem() }, { role: 'user', content: facts }], jsonMode: true }),
    parse: (raw) => {
      const bag = (raw || {}) as { advice?: unknown }
      const arr = Array.isArray(bag.advice) ? bag.advice : []
      const rows: AiRow[] = []
      for (const x of arr) {
        const s = typeof x === 'string' ? x.trim() : ''
        if (!s || s.length > 200 || rows.length >= 5) continue
        kept.push(s)
        rows.push({ key: 'adv:' + rows.length, badge: `建议 ${rows.length + 1}`, badgeType: 'neutral', main: s })
      }
      return rows
    },
    audit: () => {
      const bag: string[] = []
      if (!kept.length) bag.push('模型没有给出可用的建议（不是数组 / 全是空串 / 超长被丢）')
      return bag.length ? bag.join('；') : null
    },
    apply: (rows) => {
      const advice = rows.map(r => String(r.main || '').trim()).filter(Boolean).slice(0, 5)
      const fresh = runProjectDiagnosis(ctx.d, ctx.projId) || rep
      fresh.advice = advice
      void saveDiagnosis(fresh)
      return `✓ 诊断完成：${fresh.verdictLabel} · ${fresh.dims.filter(x => x.status !== 'ok').length} 个维度需要看 · 建议 ${advice.length} 条`
    },
    adoptLabel: '生成诊断报告',
  }
}

function buildFactsText(rep: ProjectDiagnosis): string {
  const lines: string[] = [
    `项目：${rep.projName}`,
    `快照：${rep.snapshot.metrics} 指标 / ${rep.snapshot.tasks} 任务 · 数据指纹 ${rep.fingerprint}`,
    `总评：${rep.verdictLabel}（${String(rep.summary).replace(/<\/?b>/g, '')}）`,
    '',
    '五维度实测结论（**这些是规则算出来的，不许改动**）：',
  ]
  for (const dim of rep.dims) {
    lines.push(`- [${dim.label}] ${dim.status}`)
    for (const x of dim.findings) lines.push(`    · 【${x.tag}】${x.text}（${x.evidence}）`)
  }
  lines.push(
    '',
    '请只产出「建议动作」：按优先级最多 5 条，每条一句话、必须能直接照做（谁、做什么、做完怎么算完）。',
    '不要重复上面的结论，不要解释你为什么这么建议。',
  )
  return lines.join('\n')
}
