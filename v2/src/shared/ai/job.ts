/**
 * R135：AI 建议契约类型（从 AiSuggestionDrawer 迁出至此，供 .ts 侧（chain.ts 等）与 .vue 侧共用，
 * 避免 ts 文件 import .vue 类型）。
 */
import type { ChatMsg } from './llm'

export interface AiRow {
  key: string
  main: string
  sub?: string
  /** 语义徽标 */
  badge?: string
  badgeType?: 'warn' | 'ok' | 'danger' | 'neutral'
  /** R141：参谋建议行——只读展示，不进勾选/采纳（如「这任务该拆还是该写详情」） */
  advisory?: boolean
  /** 场景载荷（模型建议原文等），apply 闭包自取 */
  data?: unknown
}

export interface AiJob {
  title: string
  /** R141（反馈 #2/#3）：正在处理的对象标头（如「📌 任务「完成论文图表」」），抽屉常驻显示 */
  subject?: string
  hint?: string
  build: () => { messages: ChatMsg[]; jsonMode?: boolean } | Promise<{ messages: ChatMsg[]; jsonMode?: boolean }>
  /** true = 模型回叙事文本（周报等），跳过 JSON 提取、parse 收原文 string（R138） */
  rawText?: boolean
  parse: (raw: unknown) => AiRow[]
  run?: (ctx: { signal: AbortSignal; onDelta: (accum: string) => void }) => Promise<AiRow[]>
  apply: (rows: AiRow[]) => Promise<string> | string
  /** R139：次采纳通道——同一批勾选行的另一种落法（如拆解步骤「写入任务详情」而非建子任务） */
  secondary?: { label: string; apply: (rows: AiRow[]) => Promise<string> | string }
  /** R139：人设选择器——拆解等场景可换专家（角色库任意专家含自建），onPick 由宿主重建 job 触发重跑 */
  persona?: { options: { id: string; label: string }[]; current: string; onPick: (id: string) => void }
  adoptable?: boolean
}
