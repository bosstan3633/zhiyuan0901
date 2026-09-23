/**
 * R157 · AI 入口注册表（能力矩阵的**唯一真源**）
 *
 * 设计拍板（2026-09-23，谭老板确认）：
 *  ① **纯声明表**——本文件只含静态常量，**零 import、零运行时依赖**（连 type import 都不引）。
 *     17 个工厂与 14 个宿主**一行不改**；"登记"由 scripts/entry-matrix.cjs 做双向对账强制：
 *     源码里出现的每个 AI 入口必须在表内（漏登记即红），表内每条声明必须与源码一致（漂移即红）。
 *  ② 覆盖**全部 AI 能力入口**：job 型（走 build*Job 工厂）、inline 型（宿主内联 job）、
 *     search 型（不建 job 的检索类，如全局 AI 检索 / R161 镜像弹窗检索）。
 *  ③ 粒度 = **功能身份**（同一工厂在多个宿主复现只算一条，hosts 列全）。
 *     由此 R154 手写的「23 入口」口径被代码口径取代：见交付说明的对账节。
 *
 * 为什么是声明表而不是运行时 register()：
 *  - 注册表一旦被入口 chunk 触达，就会把 17 个工厂一起拉进首屏——直接破「启动零 AI」；
 *  - 单向真源（表 ← 对账 ← 源码）不会出现"表和代码各说各话"的双写漂移。
 *
 * 字段速记：
 *  - kind      job=走 build*Job 工厂 | inline=宿主内联 job | search=不建 job 的检索
 *  - factory   工厂函数名（job 型必填）；anchor = inline 型的宿主函数名
 *  - hosts     全部挂载文件（src 相对路径）；factoryFile = 工厂所在文件
 *  - caps      能力声明（entry-matrix 会逐项回源码对账，声明了源码没有=红，反之亦然）
 *  - family    proactive=我要 AI 干活（R158 → AI 动作面板）| passive=AI 建议我看（R158 → 建议流）。
 *              首轮为初判，R158 二分时只改这里、不改散落各处的判断逻辑。
 */

export type AiEntryKind = 'job' | 'inline' | 'search'
export type AiEntryFamily = 'proactive' | 'passive'

export interface AiEntryCaps {
  /** R154 左栏「当前形态」——false 即单栏形态（R154 缺口「17 个入口仍单栏」的机器口径） */
  before?: boolean
  /** 左右栏关系：pair=逐行对照（缺省）/ context=左栏只是投料上下文 */
  paneMode?: 'pair' | 'context'
  /** 影响面条（R154 契约已有、消费面未接——矩阵裸露这件事） */
  impact?: boolean
  /** 采纳前二次确认（R154 契约已有、消费面未接） */
  confirm?: boolean
  /** 头部步骤条（R154 契约已有、消费面未接） */
  steps?: boolean
  /** 角色选择器（job.persona 或 ctx.personaId/onPersona 通道） */
  persona?: boolean
  /** 一次性指令作用域字面量（须与源码逐字一致；'' = 未接地基） */
  promptScope?: string
  /** 次采纳通道 */
  secondary?: boolean
  /** 模型回叙事文本（报告型），跳过 JSON 提取 */
  rawText?: boolean
  /** 报告型自动落卡（withReport） */
  autoReport?: boolean
  /** 「存为卡」再存一次通道（withReport 附带） */
  resave?: boolean
  /** 自定义 run（接管多轮调用；R154 曾记载四个入口"自带 run"，矩阵实证已不存在） */
  run?: boolean
  /** 采纳=直接写库（R154 拍板①；报告型无 apply 即纯参考） */
  apply?: boolean
}

export interface AiEntryDecl {
  id: string
  title: string
  family: AiEntryFamily
  kind: AiEntryKind
  factory?: string
  factoryFile?: string
  /** inline 型的宿主函数名 / search 型的关键函数名（对账锚点） */
  anchor?: string
  /** 全部挂载文件（src 相对路径，含主宿主） */
  hosts: string[]
  caps: AiEntryCaps
  note?: string
}

export const AI_ENTRIES: AiEntryDecl[] = [
  // ── job 型 · batchG.ts ────────────────────────────────────────────────
  {
    id: 'thesis-draft', title: '论文草拟', family: 'proactive', kind: 'job',
    factory: 'buildThesisDraftJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/components/ThesisAiBtn.vue'],
    caps: { apply: true, persona: true },
    note: 'persona 走 ctx.personaId/onPersona 条件通道（batchG:188）',
  },
  {
    id: 'curio-triage', title: '好奇研判', family: 'proactive', kind: 'job',
    factory: 'buildCurioTriageJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/components/compass/CuriosityPanel.vue'],
    caps: { apply: true },
    note: 'R154 记账：采纳内含 status=shelf 副作用（原 R157 口径矛盾项，归 R159）',
  },
  {
    id: 'evidence', title: '找证据', family: 'proactive', kind: 'job',
    factory: 'buildEvidenceJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/components/EvidenceMenuItem.vue'],
    caps: { apply: true },
  },
  {
    id: 'deliver', title: '成果文稿', family: 'proactive', kind: 'job',
    factory: 'buildDeliverJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true, secondary: true, rawText: true, persona: true, autoReport: true, resave: true },
    note: 'secondary=下载 .md；R154-D3：编辑后正文须同喂下载与落卡；withReport 自动落卡+存为卡',
  },
  // ── job 型 · chain.ts ────────────────────────────────────────────────
  {
    id: 'chain', title: '方向链（拆解/指标/下钻）', family: 'proactive', kind: 'job',
    factory: 'buildChainJob', factoryFile: 'shared/ai/chain.ts',
    hosts: [
      'newtab/components/compass/TaskDetailDrawer.vue',
      'newtab/components/TaskAiMenu.vue',
      'newtab/views/CompassTree.vue',
      'newtab/views/ProjectCuration.vue',
    ],
    caps: { apply: true, persona: true },
    note: '同工厂 4 宿主 5 调用点（ProjectCuration 有 metrics+at 两处）；R154 手写「23 入口」的差额主要来自此处的粒度分歧',
  },
  // ── job 型 · govern.ts ───────────────────────────────────────────────
  {
    id: 'tag-govern', title: '标签体检', family: 'proactive', kind: 'job',
    factory: 'buildTagGovernJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
  },
  {
    id: 'trash-rescue', title: '回收站捞回', family: 'proactive', kind: 'job',
    factory: 'buildTrashRescueJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue', 'newtab/views/RecycleBin.vue'],
    caps: { apply: true },
  },
  {
    id: 'cross-deck', title: '跨台镜像发现', family: 'passive', kind: 'job',
    factory: 'buildCrossDeckJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
    note: 'family 初判被动：产出是"建议你镜像什么"；R158 可改',
  },
  {
    id: 'thesis-drift', title: '主题漂移', family: 'passive', kind: 'job',
    factory: 'buildThesisJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
    note: 'R154 记账：adoptable:false 且无 autoReport，漂移结论无出口（归 R159）',
  },
  {
    id: 'tag-blueprint', title: '标签整体梳理·蓝图', family: 'proactive', kind: 'job',
    factory: 'buildTagBlueprintJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
  },
  {
    id: 'tag-assign', title: '标签整体梳理·归架', family: 'proactive', kind: 'job',
    factory: 'buildTagAssignJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
    note: '蓝图采纳后 aiJobClosed 自动接力，非独立按钮（R143 两门）',
  },
  // ── job 型 · select.ts ───────────────────────────────────────────────
  {
    id: 'task-recommend', title: '任务建议', family: 'passive', kind: 'job',
    factory: 'buildRecommendJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/compass/TaskDetailDrawer.vue', 'newtab/components/TaskAiMenu.vue'],
    caps: { apply: true },
    note: 'family 初判被动：产出是"建议你做哪些任务"',
  },
  {
    id: 'card-enrich', title: '单卡补全', family: 'proactive', kind: 'job',
    factory: 'buildCardEnrichJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/GlobalPopups.vue', 'newtab/components/ResourceDetailDrawer.vue'],
    caps: { apply: true, before: true, promptScope: 'enrich:card' },
    note: 'GlobalPopups 侧=采集后补全（captureEnrich 开关下自动触发，被动面）；R158 需按宿主判定 family',
  },
  {
    id: 'task-parse', title: 'AI 建任务', family: 'proactive', kind: 'job',
    factory: 'buildTaskParseJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/TaskAddDrawer.vue'],
    caps: { apply: true },
  },
  {
    id: 'weekly-review', title: '周回顾', family: 'proactive', kind: 'job',
    factory: 'buildReviewJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { before: true, paneMode: 'context', promptScope: 'review', rawText: true, autoReport: true, resave: true },
    note: '纯报告型（withReport 且无 apply）：跑完自动落卡 + dirty 时「存为卡」同名复用，抽屉不出采纳按钮',
  },
  {
    id: 'insight', title: '深度洞察', family: 'proactive', kind: 'job',
    factory: 'buildInsightJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/WeeklyReportOverlay.vue'],
    caps: { before: true, paneMode: 'context', promptScope: 'insight', rawText: true, autoReport: true, resave: true },
  },
  {
    id: 'card-optimize', title: '全方位优化', family: 'proactive', kind: 'job',
    factory: 'buildFullOptimizeJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/CardAiEntry.vue', 'newtab/components/ResourceDetailDrawer.vue'],
    caps: { apply: true, before: true, promptScope: 'opt:card', persona: true },
  },
  // ── inline 型（宿主内联 job）──────────────────────────────────────────
  {
    id: 'batch-enrich', title: '批量补全', family: 'proactive', kind: 'inline',
    anchor: 'aiEnrichIds',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true, before: true, promptScope: 'enrich:batch' },
    note: 'R154-C4：key 带选集 id 列表；书签导入完成后复用同一条 job',
  },
  {
    id: 'dormant-scan', title: '沉睡资源唤醒', family: 'passive', kind: 'inline',
    anchor: 'aiDormantScan',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
    note: 'family 初判被动：产出是逐卡处置建议（唤醒/归档/保留）',
  },
  {
    id: 'diagnose', title: '深度诊断', family: 'proactive', kind: 'inline',
    anchor: 'aiDiagnose',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true, autoReport: true, resave: true },
    note: '多专家会诊；R154 记账"自带 run"经矩阵实证已不存在（多轮调用改由 llm 层承担），run:false',
  },
  // ── search 型（不建 job，R154 拍板②"检索不属赋能"豁免双栏）───────────
  {
    id: 'global-search', title: '全局 AI 检索', family: 'proactive', kind: 'search',
    anchor: 'semanticSearch',
    hosts: ['newtab/components/GlobalPopups.vue'],
    caps: {},
    note: 'semanticSearch / semanticSearchAll；R161-③ 起全字段投料 + 定向收窄，绝不抓链接正文',
  },
  {
    id: 'mirror-search', title: '镜像弹窗 AI 检索', family: 'proactive', kind: 'search',
    anchor: 'semanticSearch',
    hosts: ['newtab/composables/usePyramid.ts'],
    caps: {},
    note: 'R161-④ 新增：策展台关联资源卡弹窗，与全局检索同一 semanticSearch 同源纪律',
  },
]

/** 能力矩阵的列（entry-matrix.cjs 的输出顺序与此一致；新增能力键两处同步） */
export const AI_CAP_KEYS = [
  'before', 'paneMode', 'impact', 'confirm', 'steps', 'persona',
  'promptScope', 'secondary', 'autoReport', 'resave', 'run', 'apply',
] as const
