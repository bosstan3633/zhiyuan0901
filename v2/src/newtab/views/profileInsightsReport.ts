import type { InsightRange } from '@/shared/ai/select'
import { aggregateRange, type DailyStats } from '@/shared/utils/dailyStats'
import { objectivesOf, windowOf } from '@/shared/utils/reviewReport'
import type { DirLike, TaskLike } from '@/shared/utils/reviewReport'
import type { MonthTopic } from '@/newtab/components/profile/PiMonth.vue'

interface AggregateRangeInput {
  stats: DailyStats
  directions: DirLike[]
  tasks: TaskLike[]
}

/** G-04：把宿主已算好的本地读数整理为白名单事实；这里不新增统计口径。 */
export function profileRangeFacts(range: InsightRange, input: AggregateRangeInput & {
  concise: { html: string }
  todayAdd: number
  todayCalled: number
  todayFilled: number
  todayAmmo: number
  monthCurioConv: number
  monthProjected: number
  monthTopics: MonthTopic[]
  yearCoolingHigh: number
  yearDirFit: string
  total: number
  kinds: { res: number; task: number; curio: number }
}): string[] {
  const out = [`本地诊断：${String(input.concise.html || '').replace(/<[^>]+>/g, '')}`]
  if (range === 'today') {
    out.push(`今日入台 ${input.todayAdd} 张；今日调出 ${input.todayCalled} 次；今日焦点 ${input.todayFilled}/3；已备弹药 ${input.todayAmmo} 张。`)
  } else if (range === 'week') {
    const win = windowOf('week', {})
    const agg = aggregateRange(input.stats, win.s, win.e)
    const objs = objectivesOf(input.directions, input.tasks, win)
    out.push(`本周有效动作 ${agg.acts} 件；调出 ${agg.u} 次；目标产出 ${objs.total} 件；未归属方向 ${objs.unassigned} 件。`)
    if (objs.rows[0]) out.push(`本周产出最多的是「${objs.rows[0].name}」：${objs.rows[0].v} 件。`)
  } else if (range === 'month') {
    const win = windowOf('month', {})
    const agg = aggregateRange(input.stats, win.s, win.e)
    out.push(`本月入池 ${agg.c.res + agg.c.curio + agg.c.task} 张；本月调出 ${agg.u} 次；好奇心转化率 ${input.monthCurioConv}%；已入策展 ${input.monthProjected} 张。`)
    if (input.monthTopics[0]) out.push(`本月最高频主题是「${input.monthTopics[0].tag}」：${input.monthTopics[0].n} 张。`)
  } else {
    out.push(`本年高价值冷却卡 ${input.yearCoolingHigh} 张；方向适配：${input.yearDirFit.replace(/<[^>]+>/g, '')}。`)
    out.push(`当前存活卡片共 ${input.total} 张（资源 ${input.kinds.res} / 任务 ${input.kinds.task} / 好奇 ${input.kinds.curio}）。`)
  }
  return out
}

export function profileExportLines(input: {
  mission: string
  total: number
  kinds: { res: number; task: number; curio: number }
  entropy: number
  supportRate: number | string
  focusShare: number | string
  concise: Record<InsightRange, { html: string }>
}): string[] {
  const insightLines = (['today', 'week', 'month', 'year'] as const).map(k => {
    const label = { today: '今天', week: '本周', month: '本月', year: '本年' }[k]
    return `${label}·诊断：${input.concise[k].html.replace(/<[^>]+>/g, '')}`
  })
  return [
    `画像洞察导出 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    `使命主线：${input.mission || '（尚未设定）'}`,
    `全库净资产：${input.total} 张（资源 ${input.kinds.res} · 任务 ${input.kinds.task} · 好奇 ${input.kinds.curio}）`,
    `知识熵 (聚焦度)：${input.entropy} bit`,
    `任务有证据支撑：${input.supportRate}%`,
    `近30天精力落主攻：${input.focusShare}%`,
    '',
    ...insightLines,
  ]
}

/** 方向适配只解释现有任务归属：projectId → direction，返回占比最高的一条。 */
export function profileDirectionFitText(directions: DirLike[], tasks: TaskLike[]): string {
  const owner = new Map<string, string>()
  for (const d of directions) for (const p of d.projects || []) if (!owner.has(p.id)) owner.set(p.id, d.id)
  const counts = new Map<string, number>()
  let total = 0
  for (const t of tasks) {
    if (t.deletedAt) continue
    const directionId = t.projectId ? owner.get(t.projectId) : undefined
    if (!directionId) continue
    counts.set(directionId, (counts.get(directionId) || 0) + 1)
    total++
  }
  if (!total) return ''
  let topId = ''
  let topCount = 0
  for (const [id, count] of counts) {
    if (count > topCount) {
      topCount = count
      topId = id
    }
  }
  const name = directions.find(d => d.id === topId)?.name || ''
  return name ? `主方向「${name}」承接 ${Math.round((topCount / total) * 100)}% 的已归属任务` : ''
}
