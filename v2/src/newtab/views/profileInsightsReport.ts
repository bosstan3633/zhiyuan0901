import type { InsightRange } from '@/shared/ai/select'
import type { DirLike, TaskLike } from '@/shared/utils/reviewReport'

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
