/**
 * R154：左右栏行级配对。
 *
 * 抽屉只负责画"哪一行对应哪一行"，**配不上不报错**——配不上就是"AI 新增的东西"，
 * 这本身是有信息量的结论。反过来，左栏有、右栏没认领的行由 `unpairedBefore` 交出来，
 * 抽屉据此提示"这些会被改掉/删掉"，避免整树替换类动作静默删数据。
 *
 * ★工厂纪律：要出现"未变"这一档，`parse` 必须**回传全集**（既有项也出行并让它配上对），
 * 只回传建议项的工厂会看到所有既有项都掉进 unpaired——那是设计缺陷，不是配对算法的锅。
 */
import type { AiPaneLine, AiRow } from './job'

/** 归一化：小写、去空白与中英标点。标题类字段"差个空格/差个括号"不该被算成两条 */
export function normTag(s: string): string {
  return String(s ?? '').toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[·、，,。.：:；;（）()\[\]【】"'“”‘’]/g, '')
}

/**
 * 两级匹配：① `row.pair` 直接命中左栏 key（id 口径，改名不断链）；
 * ② 归一化文本命中左栏 main。命中后按文本是否变化定 same / edit。
 */
export function pairRows(before: AiPaneLine[], rows: AiRow[]): AiRow[] {
  const byKey = new Map<string, AiPaneLine>()
  const byText = new Map<string, AiPaneLine>()
  for (const b of before) {
    if (!byKey.has(b.key)) byKey.set(b.key, b)
    const t = normTag(b.main)
    if (t && !byText.has(t)) byText.set(t, b)
  }
  for (const r of rows) {
    if (r.advisory) continue
    const hit = (r.pair ? byKey.get(r.pair) : undefined) || byText.get(normTag(r.main))
    if (!hit) { r.changeType = r.changeType || 'new'; continue }
    r.pair = hit.key
    r.changeType = r.changeType || (normTag(hit.main) === normTag(r.main) ? 'same' : 'edit')
  }
  return rows
}

/** 左栏里没被任何右栏行认领的行——影响面提示的数据源 */
export function unpairedBefore(before: AiPaneLine[], rows: AiRow[]): AiPaneLine[] {
  const taken = new Set(rows.filter(r => !r.advisory).map(r => r.pair).filter(Boolean) as string[])
  return before.filter(b => !taken.has(b.key))
}

export function changeSummary(rows: AiRow[]): Record<'new' | 'edit' | 'move' | 'same', number> {
  const s = { new: 0, edit: 0, move: 0, same: 0 }
  for (const r of rows) { if (!r.advisory) s[r.changeType || 'new']++ }
  return s
}

/** 左栏取值：`before` 允许是函数（打开时才求值，拿到 AI 动手前的最新数据） */
export function resolveBefore(before: AiPaneLine[] | (() => AiPaneLine[]) | undefined): AiPaneLine[] {
  if (!before) return []
  return typeof before === 'function' ? before() : before
}
