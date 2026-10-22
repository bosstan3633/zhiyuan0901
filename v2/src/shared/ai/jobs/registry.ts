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
 *  - family    proactive=我要 AI 干活（R158 → 命令面板「AI 动作」组）| passive=AI 建议我看（R158 → 建议流）。
 *              R158 已按拍板定稿：主动 18 / 被动 4（cross-deck · thesis-drift · task-recommend · dormant-scan）。
 *  - panel     R158 命令面板呈现声明（纯数据，执行时面板才懒加载对应宿主/AI 栈）：
 *              nav=关闭面板并跳 route（上下文型入口跳到宿主台面，按提示就地使用）；
 *              popup=打开全局弹窗（AI 建议流）；hidden=不进面板（面板本体/弹窗内入口）。
 */

export type AiEntryKind = 'job' | 'inline' | 'search'
export type AiEntryFamily = 'proactive' | 'passive'

/** R158 · 命令面板呈现声明（零运行时依赖：route/popup 都是字面量，由 GlobalPopups 解释执行） */
export interface AiPanelDecl {
  /** 图标名（shared/components/Icon.vue ICONS 键；未知名回落 compass） */
  icon: string
  /** nav=跳转 route | popup=打开全局弹窗 popup | hidden=不进面板 */
  mode: 'nav' | 'popup' | 'hidden'
  /** nav 目标路由（mode:'nav' 必填） */
  route?: string
  /** popup 弹窗名（mode:'popup' 必填，GlobalPopups openPanel 认名） */
  popup?: string
  /** 面板副标题（说明"到哪/怎么用"，nav 型必填） */
  hint?: string
}

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
  /** 一次性指令作用域字面量（须与源码逐字一致；true = 动态拼装，由工厂测试守作用域） */
  promptScope?: string | true
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
  /** R158 · 命令面板呈现声明（缺省 = hidden，即暂不进面板） */
  panel?: AiPanelDecl
  note?: string
}

export const AI_ENTRIES: AiEntryDecl[] = [
  // ── job 型 · batchG.ts ────────────────────────────────────────────────
  {
    id: 'thesis-draft', title: '论文草拟', family: 'proactive', kind: 'job',
    factory: 'buildThesisDraftJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/components/ThesisAiBtn.vue'],
    caps: { apply: true, persona: true },
    panel: { icon: 'edit', mode: 'nav', route: '/', hint: '在调度台「资源卡池」选中论文卡后，从卡面 AI 徽标发起' },
    note: 'persona 走 ctx.personaId/onPersona 条件通道（batchG:188）',
  },
  {
    id: 'curio-triage', title: '好奇研判', family: 'proactive', kind: 'job',
    factory: 'buildCurioTriageJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/components/compass/CuriosityPanel.vue'],
    caps: { apply: true, secondary: true },
    panel: { icon: 'bulb', mode: 'nav', route: '/', hint: '在调度台好奇心培育区选中卡后使用' },
    note: 'R154 记账：采纳内含 status=shelf 副作用（原 R157 口径矛盾项，归 R159）；R167 起单条走「判决卡」版式（layout=verdict，三态由用户点选、模型只给推荐）+ 次级动作「判词写进详情」',
  },
  {
    id: 'evidence', title: '找证据', family: 'proactive', kind: 'job',
    factory: 'buildEvidenceJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/components/EvidenceMenuItem.vue'],
    caps: { apply: true },
    panel: { icon: 'search', mode: 'nav', route: '/', hint: '在资源卡池卡面菜单发起' },
  },
  {
    id: 'deliver', title: '成果文稿', family: 'proactive', kind: 'job',
    factory: 'buildDeliverJob', factoryFile: 'shared/ai/batchG.ts',
    hosts: ['newtab/views/GlobalSettings.vue', 'newtab/views/ProfileInsights.vue'],
    caps: { apply: true, secondary: true, rawText: true, persona: true, autoReport: true, resave: true },
    panel: { icon: 'clipboard', mode: 'nav', route: '/settings', hint: '设置页 · AI 能力' },
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
    panel: { icon: 'branch', mode: 'nav', route: '/compass', hint: '在任务详情或方向树内发起' },
    note: '同工厂 4 宿主 5 调用点（ProjectCuration 有 metrics+at 两处）；R154 手写「23 入口」的差额主要来自此处的粒度分歧',
  },
  // ── job 型 · govern.ts ───────────────────────────────────────────────
  {
    id: 'tag-govern', title: '标签体检', family: 'proactive', kind: 'job',
    factory: 'buildTagGovernJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue', 'newtab/views/ProfileInsights.vue'],
    caps: { apply: true },
    panel: { icon: 'layers', mode: 'nav', route: '/settings', hint: '设置页 · 标签治理' },
  },
  {
    id: 'trash-rescue', title: '回收站捞回', family: 'proactive', kind: 'job',
    factory: 'buildTrashRescueJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue', 'newtab/views/RecycleBin.vue'],
    caps: { apply: true },
    panel: { icon: 'trash', mode: 'nav', route: '/recycle', hint: '回收站页内发起' },
  },
  {
    id: 'cross-deck', title: '跨台镜像发现', family: 'passive', kind: 'job',
    factory: 'buildCrossDeckJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/components/GlobalPopups.vue'],
    caps: { apply: true },
    panel: { icon: 'share', mode: 'popup', popup: 'ai-advice', hint: 'AI 建议面板' },
    note: 'R158 定稿被动：产出是"建议你镜像什么"；物理入口已从设置页迁入 AI 建议面板（宿主随迁',
  },
  {
    id: 'thesis-drift', title: '主题漂移', family: 'passive', kind: 'job',
    factory: 'buildThesisJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/components/GlobalPopups.vue'],
    caps: { apply: true },
    panel: { icon: 'radio', mode: 'popup', popup: 'ai-advice', hint: 'AI 建议面板' },
    note: 'R158 定稿被动 + 迁 AI 建议面板（宿主随迁）；R154 记账：adoptable:false 且无 autoReport，漂移结论无出口（归 R159）',
  },
  {
    id: 'tag-blueprint', title: '标签整体梳理·蓝图', family: 'proactive', kind: 'job',
    factory: 'buildTagBlueprintJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
    panel: { icon: 'layout', mode: 'nav', route: '/settings', hint: '设置页 · 标签治理' },
  },
  {
    id: 'tag-assign', title: '标签整体梳理·归架', family: 'proactive', kind: 'job',
    factory: 'buildTagAssignJob', factoryFile: 'shared/ai/govern.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true },
    panel: { icon: 'folder', mode: 'nav', route: '/settings', hint: '蓝图采纳后自动接力（R143 两门）' },
    note: '蓝图采纳后 aiJobClosed 自动接力，非独立按钮（R143 两门）',
  },
  // ── job 型 · select.ts ───────────────────────────────────────────────
  {
    id: 'card-enrich', title: 'AI 补全（资源卡）', family: 'proactive', kind: 'job',
    factory: 'buildResourceEnrichJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/GlobalPopups.vue', 'newtab/components/ResourceAiStrip.vue', 'newtab/components/CardAiEntry.vue'],
    caps: { apply: true, before: true, promptScope: 'enrich:card', persona: true },
    panel: { icon: 'copy', mode: 'nav', route: '/', hint: '选中卡后从卡面 AI 徽标 / 详情抽屉 AI 行 / 采集浮层发起' },
    note: '★ R167：原「单卡补全」与「全方位优化」并成一枚工厂——http(s) 链接点了才抓正文；空字段直接补，已填字段只给 optIn 建议（默认不勾）；R147-a 新词闸与分类消毒同装（合并入口不得再留下"没装闸的那条"）',
  },
  {
    id: 'task-enrich', title: 'AI 补全任务', family: 'proactive', kind: 'job',
    factory: 'buildTaskEnrichJob', factoryFile: 'shared/ai/taskEnrich.ts',
    hosts: ['newtab/components/compass/TaskDetailDrawer.vue', 'newtab/components/TaskAiCorner.vue'],
    caps: { apply: true, before: true, promptScope: 'enrich:task' },
    panel: { icon: 'copy', mode: 'nav', route: '/compass', hint: '任务详情标题下三入口之一；卡片视图右上角角标直跑' },
    note: '只补缺不覆盖：说明已有验收标准就不再建议；归属建议判弱默认不勾（定案：AI 不替决策）',
  },
  {
    id: 'task-support', title: '找资源支持', family: 'proactive', kind: 'job',
    factory: 'buildTaskSupportJob', factoryFile: 'shared/ai/taskSupport.ts',
    hosts: ['newtab/components/compass/TaskDetailDrawer.vue'],
    caps: { apply: true, before: true, promptScope: 'support:task' },
    panel: { icon: 'compass', mode: 'nav', route: '/compass', hint: '任务详情三入口之一；子任务行 🧭 也可发起' },
    note: '本地预筛（词面+标签 top N、排除已关联）→ 模型只排序+一句判词；采纳写独立表 supportLinks，两张卡本体零改动（卡间零挂载红线下的记录型关联）',
  },
  {
    id: 'resource-link-task', title: '关联任务（资源侧）', family: 'proactive', kind: 'job',
    factory: 'buildResourceLinkTaskJob', factoryFile: 'shared/ai/resourceLinkTask.ts',
    hosts: ['newtab/components/ResourceAiStrip.vue'],
    caps: { apply: true, before: true, promptScope: 'linktask:card', persona: true },
    panel: { icon: 'compass', mode: 'nav', route: '/', hint: '资源详情 AI 行第二枚（两宿主同一组件：内联抽屉与 App 级抽屉）' },
    note: 'R167：「找资源支持」的反向入口（同一条 SupportLink、同一张表）——扫全量任务卡本地预筛 → 模型只排序+一句判词 → 采纳只写关联记录，两端卡本体零改动；解绑仍只在任务侧（定案 10 的边界不越）',
  },
  {
    id: 'task-parse', title: 'AI 建任务', family: 'proactive', kind: 'job',
    factory: 'buildTaskParseJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/components/TaskAddDrawer.vue'],
    caps: { apply: true },
    panel: { icon: 'plus', mode: 'nav', route: '/compass', hint: '新建任务抽屉内发起' },
  },
  {
    id: 'weekly-review', title: '周回顾', family: 'proactive', kind: 'job',
    factory: 'buildReviewJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { before: true, paneMode: 'context', promptScope: 'review', rawText: true, autoReport: true, resave: true },
    panel: { icon: 'calendar', mode: 'nav', route: '/', hint: '仪表盘复盘段内发起' },
    note: '纯报告型（withReport 且无 apply）：跑完自动落卡 + dirty 时「存为卡」同名复用，抽屉不出采纳按钮',
  },
  {
    id: 'insight', title: '深度洞察', family: 'proactive', kind: 'job',
    factory: 'buildInsightJob', factoryFile: 'shared/ai/select.ts',
    // R172-T9：宿主随调度画像周报浮层退役改指仪表盘复盘段（同一件事的新居所）
    hosts: ['newtab/components/dashboard/ReviewPanel.vue'],
    caps: { before: true, paneMode: 'context', promptScope: 'insight', rawText: true, autoReport: true, resave: true },
    panel: { icon: 'flame', mode: 'nav', route: '/', hint: '仪表盘复盘段内发起' },
  },
  {
    id: 'range-insight', title: '周期洞察续写', family: 'proactive', kind: 'job',
    factory: 'buildRangeInsightJob', factoryFile: 'shared/ai/select.ts',
    hosts: ['newtab/composables/useRangeAiInsight.ts'],
    caps: { before: true, paneMode: 'context', promptScope: true, rawText: true },
    panel: { icon: 'trendup', mode: 'nav', route: '/profile', hint: '画像洞察 · 今天/本周/本月/本年诊断条右侧「AI 续写」' },
    note: 'G-04：只解释页面已算好的本地事实，adoptable:false，不自动落卡；配置缺失或调用失败时保留本地规则洞察。',
  },
  // ★ R167：原 'card-optimize'（全方位优化）已并入上面的 'card-enrich' —— 两枚入口并成一枚，
  //   注册表 23 → 22；「抓正文」能力随工厂合并迁入，不再存在"两条口径不一的单卡工厂"。
  // ── inline 型（宿主内联 job）──────────────────────────────────────────
  {
    id: 'batch-enrich', title: '批量补全', family: 'proactive', kind: 'inline',
    anchor: 'aiEnrichIds',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true, before: true, promptScope: 'enrich:batch' },
    panel: { icon: 'download', mode: 'nav', route: '/settings', hint: '设置页 · AI 能力' },
    note: 'R154-C4：key 带选集 id 列表；书签导入完成后复用同一条 job',
  },
  {
    id: 'dormant-scan', title: '沉睡资源唤醒', family: 'passive', kind: 'inline',
    anchor: 'aiAdviceRun',
    hosts: ['newtab/components/GlobalPopups.vue'],
    caps: { apply: true },
    panel: { icon: 'bulb', mode: 'popup', popup: 'ai-advice', hint: 'AI 建议面板' },
    note: 'R158 定稿被动：产出是逐卡处置建议（唤醒/归档/保留）；入口+job 构造已从设置页迁入 AI 建议面板（锚=aiAdviceRun）',
  },
  {
    id: 'diagnose', title: '深度诊断', family: 'proactive', kind: 'inline',
    anchor: 'aiDiagnose',
    hosts: ['newtab/views/GlobalSettings.vue'],
    caps: { apply: true, autoReport: true, resave: true },
    panel: { icon: 'settings', mode: 'nav', route: '/settings', hint: '设置页 · AI 能力' },
    note: '多专家会诊；R154 记账"自带 run"经矩阵实证已不存在（多轮调用改由 llm 层承担），run:false',
  },
  // ── search 型（不建 job，R154 拍板②"检索不属赋能"豁免双栏）───────────
  {
    id: 'global-search', title: '全局 AI 检索', family: 'proactive', kind: 'search',
    anchor: 'semanticSearch',
    hosts: ['newtab/components/GlobalPopups.vue'],
    caps: {},
    note: 'semanticSearch / semanticSearchAll；R161-③ 起全字段投料 + 定向收窄，绝不抓链接正文。R158：不进面板 AI 分组——它就是本面板的 AI 检索模式本身',
  },
  {
    id: 'mirror-search', title: '镜像弹窗 AI 检索', family: 'proactive', kind: 'search',
    anchor: 'semanticSearch',
    hosts: ['newtab/composables/usePyramid.ts'],
    caps: {},
    note: 'R161-④ 新增：策展台关联资源卡弹窗，与全局检索同一 semanticSearch 同源纪律',
  },
  {
    id: 'focus-rank', title: '今日三件事排序', family: 'proactive', kind: 'job',
    factory: 'buildFocusSuggestJob', factoryFile: 'shared/ai/focusSuggest.ts',
    hosts: ['newtab/views/CompassHome.vue'],
    caps: { apply: true, before: true, paneMode: 'context', promptScope: 'focus:rank' },
    panel: { icon: 'flame', mode: 'nav', route: '/compass', hint: '调度台「今日三件事」右上角 ✦ 浮层内发起（每日首次打开先本地写入，AI 只复核顺序）' },
    note: 'R169-T3：本地先按主攻项目/状态/顺延/到期出候选与事实句，模型只在候选里挑三件+一句判词（无判词或非 high 即不占格）；采纳只改 dailyFocus[这一天] 的计划位，任务卡本体与用户手工选的格子都不动。同文件的 rankFocus 是无界面复核通道，失败一律静默回落本地顺序',
  },
  {
    id: 'project-diagnose', title: '项目诊断', family: 'proactive', kind: 'job',
    factory: 'buildProjectDiagnoseJob', factoryFile: 'shared/ai/projectDiagnose.ts',
    /* ★F4（V3.8.21）：诊断宿主逻辑下沉 useProjectDiag —— 工厂的唯一调用点在 composable，
       宿主（CompassTree / ProjectCuration）只消费它的导出，故 hosts 指向真正的调用点文件。
       矩阵对账的是"工厂在哪被调"，不是"按钮画在哪"。 */
    hosts: ['newtab/composables/useProjectDiag.ts', 'newtab/views/CompassTree.vue', 'newtab/views/ProjectCuration.vue'],
    caps: { apply: true, paneMode: 'context' },
    note: 'N2（V3.8.18）：单项目体检，与设置页 diagnose（整库会诊）各走各的。五维度结论与标签由规则算死（枚举不可自造），模型只写建议动作；采纳即把报告写进 chrome.storage.session 并顶开中央弹窗，项目舱据此挂常驻标签',
  },
]

/** 能力矩阵的列（entry-matrix.cjs 的输出顺序与此一致；新增能力键两处同步） */
export const AI_CAP_KEYS = [
  'before', 'paneMode', 'impact', 'confirm', 'steps', 'persona',
  'promptScope', 'secondary', 'autoReport', 'resave', 'run', 'apply',
] as const
