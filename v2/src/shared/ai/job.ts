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
  /** 场景载荷（模型建议原文等），apply 闭包自取 */
  data?: unknown
}

export interface AiJob {
  title: string
  hint?: string
  build: () => { messages: ChatMsg[]; jsonMode?: boolean } | Promise<{ messages: ChatMsg[]; jsonMode?: boolean }>
  parse: (raw: unknown) => AiRow[]
  run?: (ctx: { signal: AbortSignal; onDelta: (accum: string) => void }) => Promise<AiRow[]>
  apply: (rows: AiRow[]) => Promise<string> | string
  adoptable?: boolean
}
