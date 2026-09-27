/**
 * R172-T11（04-67 F27~F32 / 04-66 §八）：AI 复盘 = 按**金字塔原理**组织的**文本报告**。
 *
 * 分工是这份文件存在的全部理由：
 *  · **规则给事实**：四段骨架、全部数字、以及「以上统下」的主张词，都在本地一次算完。
 *    结论句里的主张与各条论据的 `rel` 取自同一批常量（`CLAIM.*`），逐字一致 ——
 *    F29 的闭环判据因此才是**可断言**的；让模型自由发挥，"以上统下"就永远测不了。
 *  · **专家给判断**：AI 只重写「洞察」与「建议」两段散文。prompt 明令不许新增/改动数字，
 *    落地后再回查一次（出现 facts 之外的裸数字即弃用），失败或未配置就安静留本地版
 *    （与 R169 三件事的「无界面复核，不成则留本地」同一套纪律）。
 *
 * 只读纪律：本文件不写任何存储。写库只发生在弹框里用户显式点「存为资源卡 / 生成任务」。
 */
import type { DailyStats } from '@/shared/utils/dailyStats'
import {
  buildReview, objectivesOf, inWindow,
  type DirLike, type TaskLike, type Win, type RangeType, type WindowOpts, type RuleHit
} from '@/shared/utils/reviewReport'
import { chat, type ChatMsg } from './llm'
import type { AiConfig } from './config'
import { reviewNarrateSystem, chainPersonaText } from './scenarios'

/** 主张词：结论与论据共用，杜绝两处漂移（F29 判据的字面依据） */
export const CLAIM = {
  run: '有在推进',
  skew: '方向明显偏斜',
  steady: '方向没有被跑偏',
  output: '有实物产出',
  open: '开了口没闭合',
  untouched: '主攻完全没被触碰',
  /** 零态：整期没有任何动作。不能套用「有在推进」——那是真机截图里 0 动作却写"有在推进"的根因 */
  zero: '本期没有任何动作记录'
} as const

export interface ReviewArg { rel: string; title: string; ev: string }
export interface ReviewSug { id: string; title: string; detail: string }
export interface ReviewReport {
  win: Win
  personaName: string
  /** 结论里显式列出的主张（论据逐条回指） */
  claims: string[]
  lead: string
  args: ReviewArg[]
  insights: string[]
  sugs: ReviewSug[]
  /** 本报告允许出现的全部数字 —— AI 回查与「数值可回溯」判据的集合 */
  facts: number[]
  /** 峰值日 / 范围等元信息（不参与 AI 改写） */
  meta: string
}

export interface ReportCtx {
  stats: DailyStats
  directions: DirLike[]
  tasks: TaskLike[]
  rt: RangeType
  opts?: WindowOpts
  now?: number
  personaName?: string
}

const r0 = (n: number): number => Math.round(n)
const per = (n: number): string => `${r0(n * 100)}%`

/** 主攻方向：优先 `focused`，否则本期产出最高者 */
function mainDirOf(rows: { id: string; name: string; focused: boolean; v: number; share: number }[]): { id: string; name: string; focused: boolean; v: number; share: number } | null {
  if (!rows.length) return null
  return rows.find(r => r.focused) || [...rows].sort((a, b) => b.v - a.v)[0]
}

/** 主攻方向本期完成 / 进行中（与 ReviewPanel 项目块同口径：completedAt 落窗 = 完成） */
function mainProgress(tasks: TaskLike[], dirs: DirLike[], dirId: string, win: Win): { done: number; doing: number } {
  const out = { done: 0, doing: 0 }
  for (const t of tasks) {
    if (t.deletedAt) continue
    const owner = dirs.find(d => (d.projects || []).some(p => p.id === t.projectId))
    if (!owner || owner.id !== dirId) continue
    if (t.completedAt && inWindow(t.completedAt, win)) out.done++
    else if (!t.completedAt && (t.status === 'doing' || inWindow(t.createdAt, win))) out.doing++
  }
  return out
}

/** 规则命中 → 建议标题（规则只给事实，动作名归到产品语言） */
const RULE_ACTION: Record<string, string> = {
  R1: '把「待转化」清一遍', R2: '给主攻项目排一件最小可完成的事', R3: '把最近调出的卡挑 3 张推进一步',
  R4: '挑 2 个好奇求证掉', R5: '给游离任务补上项目归属', R6: '把新采的资源挂到任务上',
  R7: '把集中爆发拆成每周固定节奏', R8: '收敛到 3 件以内'
}
const SKEW_SUG: ReviewSug = {
  id: 'skew', title: '收敛到主攻方向',
  detail: '本期产出高度集中，注意力分配比效率更值得调整 —— 下一期把动作集中到主攻方向，其余方向各留一个最小动作即可。'
}
const STEADY_SUG: ReviewSug = { id: 'keep', title: '保持节奏', detail: '本期未命中偏离规则，目标分布均衡，维持当前节奏即可。' }

/** 结论第 3 条主张与论据③严格同词（F30 三态） */
function progressClaim(done: number, doing: number): { claim: string; phrase: string; argTitle: string; argEv: (main: string, sub: number) => string } {
  if (done > 0) return {
    claim: CLAIM.output, phrase: `本期完成 <b>${done}</b> 项、<b>${CLAIM.output}</b>`,
    argTitle: '动作确实落到了项目上',
    argEv: (main, sub) => `主攻「${main}」本期完成 <b>${done}</b> 项、进行中 <b>${doing}</b> 项；子任务完成 <b>${sub}</b> 项 —— 不是空转，${CLAIM.output}`
  }
  if (doing > 0) return {
    claim: CLAIM.open, phrase: `本期完成 <b>0</b> 项、有 <b>${doing}</b> 项转进行中 —— <b>${CLAIM.open}</b>`,
    argTitle: '主攻在等，不在走',
    argEv: (main) => `主攻「${main}」本期完成 <b>0</b> 项，但有 <b>${doing}</b> 项转为进行中 —— ${CLAIM.open}`
  }
  return {
    claim: CLAIM.untouched, phrase: `本期完成 <b>0</b> 项、进行中 <b>0</b> 项 —— <b>${CLAIM.untouched}</b>`,
    argTitle: '主攻本期无动作',
    argEv: (main) => `主攻「${main}」本期完成 <b>0</b> 项、进行中 <b>0</b> 项 —— ${CLAIM.untouched}`
  }
}

export function buildReviewReport(ctx: ReportCtx): ReviewReport {
  const rev = buildReview(ctx.stats, ctx.rt, ctx.opts || {}, ctx.now)
  const a = rev.agg
  const cTotal = a.c.res + a.c.curio + a.c.task
  const conv = cTotal ? (a.sub + a.focus + a.link) / cTotal : 0
  const obj = objectivesOf(ctx.directions, ctx.tasks, rev.win)
  const main = mainDirOf(obj.rows)
  const skew = obj.total > 0 && obj.rows.some(r => r.share > 0.45)
  const pg = main ? mainProgress(ctx.tasks, ctx.directions, main.id, rev.win) : { done: 0, doing: 0 }
  /**
   * 零态先分流（R173-3）：`acts === 0` 时"偏斜 / 停滞 / 有实物产出"这些判断全都不成立 ——
   * 原来会写出「0 个活跃日…整体在使命射程内、有在推进」这种自相矛盾的句子。
   * 闭环仍要成立：唯一主张 `CLAIM.zero` 同时出现在结论与论据的 `rel` 里。
   */
  if (!a.acts) {
    return {
      win: rev.win,
      personaName: ctx.personaName || '目标管理专家',
      claims: [CLAIM.zero],
      lead: `本期 <b>${rev.win.s}</b> → <b>${rev.win.e}</b>（${rev.win.days} 天）里采集 <b>0</b>、调出 <b>0</b>、状态变更 <b>0</b>、推进 <b>0</b> —— <b>${CLAIM.zero}</b>。` +
        `这<b>不是停滞，也不是偏斜</b>：没有任何动作可供判断，谈注意力分配为时过早。`,
      args: [{
        rel: `支撑「${CLAIM.zero}」`, title: '四类动作全部为零',
        ev: `加权 <b>${a.W}</b> 分 · 活跃日 <b>${a.act}/${a.days}</b> · 入台 <b>${a.add}</b> 张 · 移出 <b>${a.del}</b> 张` +
          `（若你这段时间确实在用别的工具做事，那是记录没进这里，不是你什么都没做）`
      }],
      insights: [
        '这个区间的图是空的，它只说明一件事：<b>这段时间没有留下记录</b> —— 不能推出"你没做事"，也不能推出"你做得不好"。',
        '热力图与概览带都从事件日志派生，<b>不补记就是空的</b>；要它有意义，先让日常动作进来。'
      ],
      sugs: [{ id: 'zero', title: '先收一张卡进来', detail: '把今天手边最该被记录的一件事采进来（资源 / 好奇 / 任务任一），下一期就有可比的第一格。' }],
      facts: [0, rev.win.days, a.W, a.days, a.add, a.del],
      meta: `本期范围 ${rev.win.s} → ${rev.win.e}（${rev.win.days} 天）· 本期无动作 · 偏离规则命中 0/8`
    }
  }
  const mainName = main?.name || '（还没有战略目标）'
  const pc = progressClaim(pg.done, pg.doing)
  const claim2 = skew ? CLAIM.skew : CLAIM.steady
  const claims = [CLAIM.run, claim2, pc.claim]
  const peak = a.peak ? `峰值 ${a.peak[0]} · ${a.peak[1]} 分` : '本期无动作'

  const lead = `本期 <b>${a.act}</b> 个活跃日里累计 <b>${a.acts}</b> 次有效动作（加权 <b>${a.W}</b> 分，覆盖 <b>${a.days}</b> 天）—— ` +
    (skew
      ? `整体在使命射程内、<b>${CLAIM.run}</b>，但<b>${CLAIM.skew}</b>：<b>${per(obj.rows[0]?.share || 0)}</b> 的产出压在「${mainName}」上，其余方向基本停摆。主攻项目${pc.phrase}。这不是效率问题，是<b>注意力分配问题</b>。`
      : `本期整体<b>${CLAIM.run}</b>：采集与消化都有发生，方向分布<b>${CLAIM.steady}</b>。主攻项目${pc.phrase}。接下来的关键是把已有推进<b>沉淀成可复用的资产</b>，而不是继续加新。`)

  const args: ReviewArg[] = [
    {
      rel: `支撑「${CLAIM.run}」`, title: '采集与消化配比',
      ev: `采集 <b>${cTotal}</b> 张（资源 ${a.c.res} · 好奇 ${a.c.curio} · 任务 ${a.c.task}）→ 推进 <b>${a.sub + a.focus + a.link}</b> 项，转化率 <b>${per(conv)}</b>${conv >= 0.15 ? '，配比健康' : '，<b>消化落后于采集</b>'}`
    },
    {
      rel: skew ? `支撑「${CLAIM.skew}」` : `支撑「${CLAIM.steady}」`,
      title: skew ? '方向集中度过高' : '方向分布均衡',
      ev: `${obj.rows.map(o => `${o.focused ? '<b>[主攻]</b>' : ''}${o.name} <b>${o.v}</b> 项`).join(' · ') || '（方向台还没有战略目标）'}<br>覆盖度 <b>${obj.rows.filter(r => r.v > 0).length}/${obj.rows.length}</b> · 最高占比 <b>${per(obj.rows.reduce((m, r) => Math.max(m, r.share), 0))}</b>${skew ? '，越过 45% 偏斜警戒线' : '，未越警戒线'}`
    },
    { rel: `支撑「${pc.claim}」`, title: pc.argTitle, ev: pc.argEv(mainName, a.sub) }
  ]

  const insights = [
    `你的"整理动作"（调出 <b>${a.u}</b> 次 / 状态变更 <b>${a.s.curio + a.s.task}</b> 次）对比"交付动作"（推进 <b>${a.d}</b> 项）—— ${a.u + a.s.curio + a.s.task > a.d ? '更接近<b>在整理</b>而不是<b>在产出</b>' : '交付占上风，这是好信号'}。`,
    skew ? `产出高度集中在「${mainName}」；按本期节奏，其余方向若继续空转，重启成本会随空档周数上升。`
           : '各方向都有动作，但都不深 —— 下一期可考虑把其中一个"做穿"，而不是每个都浅尝。',
    a.activeRate < 0.6 ? `本期活跃 <b>${a.act}/${a.days}</b> 天（<b>${per(a.activeRate)}</b>），存在断档；<b>节奏比强度更重要</b>。`
                       : `本期活跃 <b>${a.act}/${a.days}</b> 天（<b>${per(a.activeRate)}</b>），节奏稳定 —— 保持。`
  ]

  const sugs: ReviewSug[] = rev.rules.slice(0, 3).map((r: RuleHit) => ({ id: r.id, title: RULE_ACTION[r.id] || r.name, detail: r.text }))
  if (!sugs.length) sugs.push(skew ? SKEW_SUG : STEADY_SUG)
  if (skew && !sugs.some(s => s.id === 'skew')) sugs.unshift(SKEW_SUG)

  return {
    win: rev.win,
    personaName: ctx.personaName || '目标管理专家',
    claims, lead, args, insights, sugs,
    facts: [a.act, a.acts, a.W, a.days, cTotal, a.c.res, a.c.curio, a.c.task, a.sub + a.focus + a.link,
      r0(conv * 100), a.u, a.s.curio + a.s.task, a.d, a.sub, a.focus, a.link, pg.done, pg.doing,
      ...obj.rows.map(o => o.v), r0(obj.rows.reduce((m, r) => Math.max(m, r.share), 0) * 100),
      rev.rules.length, 8],
    meta: `本期范围 ${rev.win.s} → ${rev.win.e}（${rev.win.days} 天）· ${peak} · 偏离规则命中 ${rev.rules.length}/8`
  }
}

/** 导出用：报告 → Markdown（T12 三件套里的 Markdown 一项） */
export function reportToMarkdown(rep: ReviewReport): string {
  const strip = (s: string): string => s.replace(/<br>/g, '；').replace(/<\/?b>/g, '**')
  return [
    `# 复盘报告 · ${rep.win.label}`,
    `> ${strip(rep.meta)} · 执笔：${rep.personaName}`,
    '',
    '## 结论', strip(rep.lead), '',
    '## 支撑论据',
    ...rep.args.map((x, i) => `${i + 1}. **${x.title}** —— ${x.rel}\n   ${strip(x.ev)}`), '',
    '## 洞察', ...rep.insights.map(x => `- ${strip(x)}`), '',
    '## 建议（按优先级）', ...rep.sugs.map((s, i) => `${i + 1}. **${s.title}** —— ${strip(s.detail)}`)
  ].join('\n')
}

/** 模型输出里出现的数字是否都在报告事实集合内（越界即弃用 AI 版） */
function numbersOutside(text: string, facts: number[]): boolean {
  const allow = new Set(facts.map(n => String(n)))
  for (const m of text.match(/\d+(?:\.\d+)?/g) || []) {
    const v = m.replace(/\.0$/, '')
    if (!allow.has(v) && !allow.has(String(r0(Number(v))))) return true
  }
  return false
}

/**
 * AI 执笔：只重写洞察与建议；任何一环不成 ⇒ 返回 null，调用方留本地版。
 *
 * R173-2：`personaId` 决定执笔视角（默认目标管理专家），`directive` 是用户本轮的一次性指令 ——
 * 两者都**只影响行文与取舍**，不许碰数字与主张词（prompt 里明写，落地后仍走 `numbersOutside` 回查）。
 */
export interface NarrateOpts { personaId?: string; directive?: string }

export async function narrateReview(rep: ReviewReport, cfg: AiConfig, opts: NarrateOpts = {}): Promise<{ insights: string[]; sugs: ReviewSug[] } | null> {
  if (!cfg.baseUrl.trim() || !cfg.apiKey.trim() || !cfg.model.trim()) return null
  const pid = opts.personaId || 'goal-expert'
  const persona = chainPersonaText(pid)
  const dir = (opts.directive || '').trim()
  const msg: ChatMsg[] = [
    { role: 'system', content: reviewNarrateSystem() + (persona ? `\n\n【执笔视角】${persona}` : '') },
    {
      role: 'user',
      content: [
        `【范围】${rep.meta}`,
        `【结论（已定稿，不要改写）】${rep.lead.replace(/<[^>]+>/g, '')}`,
        `【论据（已定稿）】\n${rep.args.map((x, i) => `${i + 1}. ${x.title} —— ${x.rel}：${x.ev.replace(/<[^>]+>/g, '')}`).join('\n')}`,
        `【可用数字（只能用这些，不许新增或改动）】${Array.from(new Set(rep.facts)).join(' / ')}`,
        ...(dir ? [`【用户本轮指令】${dir}\n（它可以改变语气、角度与条数，但不得改动数字、主张词或结论判断）`] : []),
        '请输出 JSON：{"insights":["…","…","…"],"suggestions":[{"id":"…","title":"…","detail":"…"}]}，各 3 条以内。'
      ].join('\n')
    }
  ]
  try {
    const raw = await chat({ messages: msg, jsonMode: true, temperature: 0.4 })
    const o = JSON.parse(String(raw || '{}')) as { insights?: string[]; suggestions?: ReviewSug[] }
    const insights = (o.insights || []).map(s => String(s)).filter(Boolean).slice(0, 3)
    const sugs = (o.suggestions || []).filter(s => s && s.title && s.detail).slice(0, 3)
    if (insights.length < 2 || sugs.length < 1) return null
    const joined = insights.join(' ') + sugs.map(s => `${s.title} ${s.detail}`).join(' ')
    if (numbersOutside(joined, rep.facts)) return null
    return { insights, sugs }
  } catch { return null }
}
