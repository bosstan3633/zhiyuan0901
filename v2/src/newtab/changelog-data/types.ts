/**
 * 产品更新日志 · 内容数据（W5 / V3.8.5 新增）
 * 用于：设置 → 产品更新日志（时间线面板）。
 * 纪律：版本号裸号（与 manifest 同口径）、发版时间取 git tag creatordate、要点只写用户可感知的变化。
 * 条目倒序（最新在前）；新增版本时在此表头部插入一行即可。
 *
 * ★ V3.8.6 增补（用户拍板 2026-10-12）：「完整呈现产品有版本记录以来的全部过程」——
 *   起点 = 首个 git tag v2.12.0（2026-09-01），终点 = 当前版 v3.8.6（2026-10-12）。
 *   共 128 个版本（v2 时代 88 个 git tag + v3 时代 40 个含 2 个 docs-only）。
 *   v2 时代每版 1 条要点（该版核心变化）；v3 时代按用户可感知粒度展开。
 *   v3.7.1 / v3.8.0 无 git tag 但有 docs 发版文件，日期取发版文件日期。
 *
 * ★ V3.8.38（S5 · 更新日志结构化）增补：`kinds` 平行数组——呈现层按「新增 / 修复 / 优化」
 *   三段分组渲染，**每一段都必须来自内容本身，不能靠关键词自动判定**。要点是叙事体的
 *   （「原来…现在…」），自动匹配「新增/修复/优化」字样会把大量"版式调整"误判成"优化"、
 *   把"文案换词"误判成"修复"，因此 247 条要点全部**逐条人工判定**，判定结果落进下方 kinds。
 *   口径：add = 用户能看见的新东西（新增入口/字段/指标/视图）；fix = 原来不对、现在对
 *   （失效、错位、算错、看不见）；opt = 两边都对，只是更清楚/更省力（版式、层级、口径说明）。
 *   **95 个 v2 时代单要点版本一律不写 kinds**——一条要点无处可分，硬分三段会造出两个空段，
 *   那是给数据化妆。呈现层见 kindGroupsOf：缺省或不足三条即回落平铺列表。
 */
export type ChangelogKind = 'add' | 'fix' | 'opt'

export interface ChangelogEntry {
  /** 裸版本号，如 '3.8.5'（与 manifest.version 同格式，供 runtimeVersion 对照高亮「当前版本」） */
  version: string
  /** 发版日期 YYYY-MM-DD（取 git tag creatordate） */
  date: string
  /** 一句话版本主题 */
  title: string
  /** 功能要点（用户可感知，每条一行） */
  points: string[]
  /**
   * 与 points 一一对应的变更类型（人工判定，非自动匹配）。
   * 缺省 = 该版不分段（v2 时代单要点版本）；**长度必须等于 points.length**，否则视为未标注。
   */
  kinds?: ChangelogKind[]
}

/** 三段的显示顺序与中文标签（呈现层与判据共用同一份，不各写一份） */
export const CL_SECTIONS: ReadonlyArray<{ kind: ChangelogKind; label: string }> = [
  { kind: 'add', label: '新增' },
  { kind: 'fix', label: '修复' },
  { kind: 'opt', label: '优化' },
]

export interface ChangelogGroup { kind: ChangelogKind; label: string; items: string[] }

/**
 * 把一版要点折成三段（新增 / 修复 / 优化）。
 * **空段不返回**——一版只有两段是常态，显示一个空标题只会让人以为"这一段没有内容"，
 * 而真实原因是"这一版没有这一类变化"。段数不足三条的版本回落为 null，由调用方走平铺列表。
 */
export function kindGroupsOf(e: ChangelogEntry): ChangelogGroup[] | null {
  const k = e.kinds
  // 长度不符 = 标注与内容脱节，宁可平铺也不要错分（错分比不分更糟：它会让用户读到一个假的版本结构）
  if (!k || k.length !== e.points.length || e.points.length < 3) return null
  const out: ChangelogGroup[] = []
  for (const s of CL_SECTIONS) {
    const items = e.points.filter((_, i) => k[i] === s.kind)
    if (items.length) out.push({ kind: s.kind, label: s.label, items })
  }
  return out
}
