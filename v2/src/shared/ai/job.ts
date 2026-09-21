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
  /**
   * R147-a：弱相关行——**默认不勾**，行上挂「低置信」。
   * 只允许由客观信号判弱（模型没给理由 / 标签不在既有体系 / id 靠猜 / 无归属），
   * 不许拿"感觉"当置信度。全选按钮仍可整批勾上，判定权在人不在模型。
   */
  weak?: boolean
  /** 场景载荷（模型建议原文等），apply 闭包自取 */
  data?: unknown
}

export interface AiJob {
  title: string
  /**
   * R148-T：功能身份（同一功能恒同键，如 'diag' / 'tagAssign'）。
   * runner 靠它做幂等：在跑→attach 看进度，跑完→看结果 + 重新运行；
   * 不给 key 的沿用旧绑法（抽屉即任务）。
   */
  key?: string
  /** R141（反馈 #2/#3）：正在处理的对象标头（如「📌 任务「完成论文图表」」），抽屉常驻显示 */
  subject?: string
  hint?: string
  build: () => { messages: ChatMsg[]; jsonMode?: boolean } | Promise<{ messages: ChatMsg[]; jsonMode?: boolean }>
  /** true = 模型回叙事文本（周报等），跳过 JSON 提取、parse 收原文 string（R138） */
  rawText?: boolean
  parse: (raw: unknown) => AiRow[]
  /**
   * R147-c：消毒账点名——parse 静默丢掉多少行、为什么丢。零参是因为**计数由工厂闭包自己攒**
   * （每次点击新建一个 job 实例，计数器天然按次隔离），自定义 run 的 job 也能报。
   * 抽屉在工具条显示一行，且**空态用它说清真因**（不再是一句"没有可采纳的建议"）。
   */
  audit?: () => string | null
  /**
   * R148-T：报告型自动落卡（**只新增一张卡、不改任何既有数据**的产出才配）。
   * 跑完由 runner 直接落进资源台待分类，用户不必为了"看一眼诊断"再点一次采纳；
   * 会改既有数据的动作（打标/归架/拆解/转化）不在此列，仍必须勾选采纳。
   */
  autoReport?: {
    build: (rows: AiRow[]) => { title: string; description: string; tags?: string[] } | null
    save: (p: { title: string; description: string; tags?: string[] }) => string
  }
  run?: (ctx: { signal: AbortSignal; onDelta: (accum: string) => void }) => Promise<AiRow[]>
  /** 缺省 = 只读报告型（产出自动落卡或纯参考），抽屉不出「采纳」按钮 */
  apply?: (rows: AiRow[]) => Promise<string> | string
  /** R139：次采纳通道——同一批勾选行的另一种落法（如拆解步骤「写入任务详情」而非建子任务） */
  secondary?: { label: string; apply: (rows: AiRow[]) => Promise<string> | string }
  /** R139：人设选择器——拆解等场景可换专家（角色库任意专家含自建），onPick 由宿主重建 job 触发重跑 */
  persona?: { options: { id: string; label: string }[]; current: string; onPick: (id: string) => void }
  adoptable?: boolean
}
