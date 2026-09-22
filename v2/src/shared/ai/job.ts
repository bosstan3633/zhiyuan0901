/**
 * R135：AI 建议契约类型（从 AiSuggestionDrawer 迁出至此，供 .ts 侧（chain.ts 等）与 .vue 侧共用，
 * 避免 ts 文件 import .vue 类型）。
 */
import type { ChatMsg } from './llm'

/** R154：右栏行相对左栏「当前形态」改了什么。没配对上的按 new 处理（新东西） */
export type AiChange = 'new' | 'edit' | 'move' | 'same'

/**
 * R154：左栏「当前形态」的一行——该入口对象在 AI 动手之前长什么样。
 * 与右栏 `AiRow.pair` 对齐，用户才看得出"补了哪里、补了什么"。
 * `depth` 只给树形左栏（标签梳理）用：0=根、1=子。
 */
export interface AiPaneLine {
  key: string
  label?: string
  main: string
  sub?: string
  badge?: string
  badgeType?: 'warn' | 'ok' | 'danger' | 'neutral'
  depth?: number
}

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
  /** R154：指向左栏 `AiPaneLine.key`（由 pairRows 统一算，工厂不必逐条手写） */
  pair?: string
  /** R154：与左栏对照的变化类型；`same` 行默认不勾、勾选框禁用 */
  changeType?: AiChange
  /** R154：声明这一行哪些字段允许用户就地改。
   *  ★改完要写回 `data` 才进得了 `apply`——而 data 形状只有工厂知道，所以 **声明 main/sub 就必须给 `toRow`**，
   *  否则抽屉不给编辑（宁可不能改，也不能"看着改了、写库还是原值"）。 */
  edit?: { main?: boolean; sub?: boolean; toRow?: (row: AiRow, texts: { main?: string; sub?: string }) => AiRow }
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
  /**
   * R154：左栏「当前形态」。缺省 = 抽屉退回旧单栏形态，23 个工厂因此可分批接、互不阻塞。
   * 传函数则**在打开时**求值（拿到的是 AI 动手前的最新数据）。
   */
  before?: AiPaneLine[] | (() => AiPaneLine[])
  /**
   * R154：左栏与右栏的关系。
   *  `'pair'`（缺省）= 逐行对照，右栏每行应认领一条左栏行，没被认领的要提示；
   *  `'context'` = 左栏只是**投料上下文**（周台账、原文），右栏是整篇产出，不要求逐行配对。
   */
  paneMode?: 'pair' | 'context'
  /**
   * R154：影响面一行字（整树替换 / 批量级联改写类专属）。
   * ★必须由工厂**本地核算**产出，不许把模型报的数当影响面。入参=当前勾选集，
   * 所以取消一个顶层、影响条上的"剪掉多少"要能当场重算。
   */
  impact?: (rows: AiRow[]) => string
  /** R154：返回确认文案 = 采纳前弹这条，第二下才真写库（只给"会批量删改既有数据"的入口配） */
  confirm?: (rows: AiRow[]) => string
  /** R154：多阶段串门（如标签 ②蓝图 → ③归架）的头部步骤条 */
  steps?: { label: string; state: 'done' | 'on' | 'todo' }[]
  /**
   * R154：一次性指令的**入口作用域**（如 'opt:card' / 'tagBlueprint'）。
   * 不给 = 不显示指令框（未接地基的入口不该出现一个没用的输入口）。
   */
  promptScope?: string
  /** R154：对象级作用域的 id（如卡片 id）。给了才允许「这张卡 ⇄ 这类入口」两档切换 */
  promptObject?: string
  /** R154：对象的人类名字（指令框里"这张卡 · 软硬一体方案"这类回显，避免用户不知道自己在改谁的指令） */
  promptObjectLabel?: string
  /**
   * R154：报告型「存为卡」——用户在右栏改过整篇正文后，用它把**编辑后的内容**再落一次。
   * 实现必须复用同名卡刷新通道（`saveReportCard`），不得新增第二张。
   */
  resave?: (rows: AiRow[]) => string | Promise<string>
}
