/**
 * 知源调度台 V2.0 · 核心数据模型
 *
 * 设计原则：
 * 1. 三卡分立：ResourceCard / TaskCard / CuriosityCard 各自独立，不再混存
 * 2. 卡间零挂载：三卡（Resource/Task/Curiosity）互不持有对方 id（R162 退任务↔资源；R165-B 退任务↔好奇、
 *    好奇↔资源；R166 退 fromCuriosityId 溯源引用——转化即出路，溯源由 link=sourceUrl 与描述文字承担）。
 *    **明文豁免记录型关联**：`CurationProjection`（资源台→策展台镜像）与 `SupportLink`（任务→资源「支持」记录）
 *    是独立表里的记录，卡对象本身互不持有 id，不属"卡间挂载"，红线一字不改（R166 定案 5）。
 *    六层归属（projectId/metricId）同理不受限。
 * 3. 六层树：Vision → Mission → Direction → Goal → Project → Metric → Task
 * 4. 软删除：所有卡片 deletedAt 标记，回收站恢复
 *
 * V3.7.0（R179 架构简化轮）：
 * - 卡片原点：资源卡真身统一入池（workspaceId=CURATION_WS_ID 为隐藏池 id），策展台一律以镜像投射呈现；
 *   isThesis 主题卡是唯一例外（台内 UI 层论点，纯界面呈现，不进池语义）。
 * - 新增第 4 种卡「论证节点卡」ArgumentCard：策展台内新建，围绕策展主题的描述性论证节点，
 *   用于统筹镜像进来的资源卡——**不属于三卡池**（不进 3张卡 Tab / 全局三卡统计），随台存亡。
 * - hub 分类退役：categories 中 workspaceId=CURATION_WS_ID 的实体由迁移器移除（口径见 poolMigration.ts），
 *   `categoryId` 降级为遗留字段（池卡置空串）；策展台自己的分类树（金字塔结构）原样保留。
 */

// ============ 通用类型 ============

export type ID = string

/** 链接类型：URL / 本地文件 / Obsidian */
export type LinkType = 'url' | 'file' | 'obsidian'

/** 来源类型（影响搜索排序权重，在卡片详情中设置） */
export type SourceType = 'official' | 'academic' | 'media' | 'personal' | 'ai-tool' | 'own-work'

// ============ 卡片附件（第卅九轮 REQ-048） ============

/** 附件元数据：只存引用，二进制本体在 IndexedDB 库 zy_assets（key=assetId, value=Blob）
 *  性能红线：主 JSON zy_data_v2 绝不存 base64——几百 MB 附件会击穿全量序列化/启动/跨页同步 */
export interface AssetMeta {
  id: ID
  /** image=弹窗预览 / html=新标签打开（仅支持自包含单文件 HTML）/ pdf=新标签 Chrome 内置 viewer 打开（第卌四轮） */
  kind: 'image' | 'html' | 'pdf'
  name: string
  size: number
  mime: string
  createdAt: number
}

// ============ 六层思维链 ============

/** 愿景 / 使命 节点（1:1 绑定） */
export interface CompassNode {
  content: string
  updatedAt: number
  /** N1：关联资源卡（愿景/使命为持有方，单向） */
  linkedResourceIds?: ID[]
  /** N1：关联好奇心卡 */
  linkedCuriosityIds?: ID[]
}

/** 第3层：战略目标 */
export interface Direction {
  id: ID
  name: string
  /** 进行中 / 暂停 / 归档 */
  status: 'active' | 'paused' | 'archived'
  /** 远期 / 中期 / 近期 */
  term?: 'long' | 'mid' | 'short'
  calibratedAt?: number
  /** R60：投射至灯塔功能已取消；主航线与 DHI 统一以「主攻 isFocused」为口径 */
  /** 第4层：攻坚项目 */
  projects: Project[]
}

/** 第4层：攻坚项目 */
export interface Project {
  id: ID
  name: string
  /**
   * 项目“下一步”：用户在项目详情里主动写下的下一步动作。
   * 可选字段，零迁移；为空时方向台从项目任务自动回退推导，不自动写回。
   */
  nextStep?: string
  /**
   * 是否主攻项目（最多2个；R91 起**直通调度台速览**——调度台首页顶部常驻主攻速览条）
   *
   * 注：原注释写的「同步至任务中心顶部」是指向一个已不存在的页面——旧「任务中心」页
   * （路由 `/tasks`）随 R49 退役，此后「跳任务中心」一律落到调度台首页 `/`
   * （`Workspace.goToTask` / `ResourceDetailDrawer` 都是 `router.push('/')` + 提示"已跳转任务中心"），
   * 二者在用户侧已等价。R91 补齐后，手册「🚀 主攻（最多 2 个）直通调度台速览」不再是空头承诺。
   */
  isFocused: boolean
  startDate?: string
  endDate?: string
  progress: number
  status: 'active' | 'paused' | 'done' | 'archived'
  retrospective?: string
  /** R60：原「投射至灯塔」字段已移除，重心语义统一收敛到 isFocused（主攻） */
  /** 项目排序（拖拽自由排序） */
  order?: number
  /** R49-C8/D2：手动置顶（方向台项目总览置顶分组） */
  pinned?: boolean
  /** 第5层：成功指标 */
  metrics: Metric[]
}

/** 第6层：成功指标，任务挂在指标下 */
export interface Metric {
  id: ID
  title: string
  target?: string
  /** 验收说明 */
  acceptance?: string
  /** 挂载在该指标下的任务 ID 列表 */
  taskIds: ID[]
}

/** 罗盘整体 */
export interface Compass {
  vision: CompassNode
  mission: CompassNode
  directions: Direction[]
}

// ============ 三种卡片 ============

/**
 * 卡片公共基底（第卌轮 REQ-049 字段目录化）
 * 三卡共享字段在此单一声明；ResourceCard/TaskCard/CuriosityCard extends 后
 * 仅保留 type 专属字段与少量必选收窄（kind/tags/pinned 等）。
 * 转卡公共搬运集、统一渲染、未来 CSV 对齐列 均以 base 为契约。
 */
export interface CardBase {
  id: ID
  /** V3.7.0：新增 'argument'（论证节点卡，策展台专用；不在三卡池，见 ArgumentCard） */
  kind: 'resource' | 'task' | 'curiosity' | 'argument'
  /** 描述（资源采集时自动填入选中文本；任务/好奇手动补充） */
  description?: string
  /** N4：标签（从标签管理体系选择） */
  tags?: string[]
  /** 置顶（列表/看板/选取置顶优先，右上角切换） */
  pinned?: boolean
  /** 第卅三轮 REQ-023：星标（与置顶独立可叠加；全局检索优先级 置顶 > 星标 > 命中度） */
  starred?: boolean
  /** 用户自定义字段值 */
  customFields: Record<string, unknown>
  createdAt: number
  updatedAt: number
  deletedAt?: number
  /** R48-B2：导入落戳（双口径统计「新建 X · 导入 Y」；继承原 createdAt，故导入单独计数） */
  importedAt?: number
  /** REQ-048：附件元数据（本体在 IndexedDB zy_assets，仅存引用，主 JSON 绝不存 base64） */
  assets?: AssetMeta[]
  /** R110-LC：生命周期归档标记（可选字段，零迁移）——true 即从默认视图隐藏，仅 ⏳ 生命周期面板可见/可恢复 */
  lifecycleArchived?: boolean
  /** R113-T9：「忽略 30d」独立字段（可选，零迁移）——到期前生命周期恒活跃；不碰 lastCalledAt/updatedAt，热度排序与 WRR 统计零污染 */
  snoozedUntil?: number
  /** R117（04-61 E）：per-card 自定义「冷却天数」（可选，零迁移；留空 = 默认 30 天）。
   *  用户只填这一个值，归档阈值由引擎按 ARCHIVE_RATIO 自动推算（默认 30:90）。三类卡共用。 */
  coolingDays?: number
  /** R152 起资源卡私有；R165-A 上移基类（三类卡共用，可选零迁移）：最近一次被 AI 采纳写库的时间——
   *  详情标题行的 AI 主上下文入口据此翻「↻ 重新优化/重新拆解/重新研判」并挂 chip，别让同一张卡看起来从没动过。 */
  aiTouchedAt?: number
}

/** 资源卡（向源头求证） */
export interface ResourceCard extends CardBase {
  kind: 'resource'
  title: string
  linkType: LinkType
  link: string
  /**
   * R169-T2（可选，零迁移）：**另外两条槽的值**——URL / 本地 / Obsidian 三槽各自存一条链接。
   *
   * 语义（关键，别改）：`linkType` 仍是"当前用哪一槽"，`link` 仍是"**当前槽的值**"。
   * 本字段只装**非当前槽**，所以全站约 30 处消费点（双击打开 / 筛选 / 卡片徽标 / AI 抓正文 /
   * CSV·Airtable·MD 导出）一字不改照常工作 —— 若把它做成"三槽各自为真、读时选一条"，
   * 那 30 处全要跟着改判据，一处漏改就是一张卡两个答案。
   *
   * 切槽 = `switchLinkSlot()`：先把当前 `link` 存回它所属的槽，再把目标槽的值取进 `link`
   * （目标槽空 ⇒ `link` 置空，用户要的"切过去没有就该为空"）。老数据无本字段 ⇒ 首次切槽时才建。
   */
  linkSlots?: Partial<Record<LinkType, string>>
  /**
   * V3.7.0（池语义）：池卡（workspaceId=CURATION_WS_ID）此字段**置空串**——hub 分类实体已由
   * 迁移器移除（catsMigratedAt），组织维度只有 tags。字段保留为遗留兼容：老投射记录的 catId
   * 历史快照、策展台自有分类的台内卡（isThesis 主题卡）仍可能有值；新建/收编的池卡一律 ''。
   */
  workspaceId: ID
  categoryId?: ID
  /** 来源类型（官�?学术/媒体等），不在采集弹窗中设置，后期编�*/
  sourceType?: SourceType
  tags: string[]
  pinned: boolean
  /** 调用次数（每次打开自增）*/
  callCount: number
  lastCalledAt?: number
  /** R50-F3：策展中心原生卡排序（仅 workspaceId=zy-curation 的卡使用；拖拽规整回写） */
  curOrder?: number
  /** R52-F7：策展中心内原生卡的策展归属覆盖（仅策展中心消费）。R53-A1 迁移后不再使用
   *  （镜像分类已物化为真实分类，归属统一写 categoryId）；存量值由迁移归一并清空 */
  curCatId?: string
  /** R61：主题卡标记（策展台的中心论点，金字塔 L1 根）——纯界面层呈现，不参与同步列；
   *  卡片归属策展台（workspaceId=台 id），每台最多一张（界面层约束，R62 落） */
  isThesis?: boolean
}

/**
 * 策展中心投射记录（引用式镜像，R50-F3 引入）
 * R53-A1 起仅 kind='card' 继续新增（单卡镜像落待分类）；kind='category'/'workspace' 为遗留形状，
 * 由 migrateCurationTree 启动期一次性物化为带 curFrom 的真实策展分类后移除。
 */
export interface CurationProjection {
  id: ID
  kind: 'card' | 'category' | 'workspace'
  /** 源策展台（R61 起新方向：资源台 CURATION_WS_ID） */
  wsId: ID
  catId?: ID
  cardId?: ID
  /** R61：目标策展台 id（方向反转标记——资源台 → 策展台；无此字段 = R60 前旧方向记录，迁移时清空） */
  targetWsId?: ID
  /** 投入目标策展台的分类（空 = 该台未分类区） */
  targetCatId?: ID
  /** R55-A1：策展视图统一排序键（与原生卡 curOrder 同键，混排列表统一重编号） */
  curOrder?: number
  /** R51-F21：分类镜像分组在策展树中的显示名（遗留；迁移时转为策展分类名） */
  displayName?: string
  addedAt: number
}

/** 任务卡（行动闭环） */
export interface TaskCard extends CardBase {
  kind: 'task'
  title: string
  /** 归属攻坚项目（第4层） */
  projectId?: ID
  /** 归属成功指标（第5层） */
  metricId?: ID
  status: 'todo' | 'doing' | 'done'
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  estimatedMinutes?: number
  /** V2.2：链接（URL / 本地路径 / obsidian://），卡片双击直达 */
  link?: string
  completedAt?: number
  /** R47-B4：被打开（调起详情/直达）次数与最近打开时间——全局检索无输入时按近期热度排序 */
  callCount?: number
  lastCalledAt?: number
  /** R56-V1：手动拖拽排序权重（任务管理面板 manual 态：拖拽后全量重写；未拖拽回退 createdAt 最新在前） */
  sortOrder?: number
  /** R166 定案 1：卡内嵌子任务清单（**不是独立卡**——像说明/标签一样是本卡的一个字段）。
   *  不进任务池 / 指标 taskIds / 看板拖拽 / 周报 / 回收站，生命周期完全跟随本卡；
   *  完成态**不进**成熟度与周报计分（定案 3：纯执行工具）。
   *  R166 定案 2：存量 `parentId` 子卡由启动期幂等迁移折叠进此字段（原卡软删进回收站，可撤销）。 */
  subtasks?: Subtask[]
}

/**
 * R166 定案 1：任务卡内嵌子任务（**不是独立卡**）。
 * 它只是 `TaskCard.subtasks` 数组里的一项，随父卡一起读写/合并/删除：
 * 不进任务池、不进指标 `taskIds`、不参与看板拖拽、不进周报、不进回收站，完成态也不进任何计分（定案 3）。
 */
export interface Subtask {
  id: ID
  title: string
  done: boolean
  /**
   * R172-T2（04-67 §7.4）：**完成时刻**（零迁移可选字段）。
   * 动机：热力图/复盘的「推进」维度要按**日**归集"子任务完成"，而原模型只有布尔 `done`——
   * 补齐后新勾选可归日；历史已完成项无此字段，归集时跳过（不伪造时刻）。
   */
  doneAt?: number
  note?: string
}

/**
 * R166 定案 5：任务/子任务 ↔ 资源卡的「支持」关联记录。
 * 存**独立关联表** `AppData.supportLinks`，卡对象互不持有对方 id ⇒ 「卡间零挂载」红线一字不改；
 * 与 `CurationProjection` 同构（红线明文豁免的是"记录型关联"，不是给挂载开口子）。
 * `subId` 有值 = 关联挂在某个子任务上；`from` 区分 AI 推荐与手动关联；`why` 是 AI 的一句判词。
 */
export interface SupportLink {
  id: ID
  taskId: ID
  subId?: ID
  resourceId: ID
  from: 'ai' | 'manual'
  why?: string
  createdAt: number
}

/**
 * 好奇心卡 ↔ 资源卡的「资源支撑」关联记录。
 *
 * 与任务支持分开建表，而不是把 SupportLink.taskId 改成可选：
 * - 不改变任务支持现有的统计口径与查询类型；
 * - 两张卡本体仍互不持有对方 id；
 * - 资源卡始终是供给方，好奇侧只负责关联与解绑记录。
 */
export interface CurioSupportLink {
  id: ID
  curioId: ID
  resourceId: ID
  from: 'ai' | 'manual'
  why?: string
  createdAt: number
}

/** 好奇心卡（从好奇出发） */
export interface CuriosityCard extends CardBase {
  kind: 'curiosity'
  /** 问题文本：采集时只有这一个纯文本字段 */
  question: string
  /** 来源链接：采集时不自动记录，后期编辑手动填入 */
  sourceUrl?: string
  sourceTitle?: string // O24：采集时自动附带的来源页面标题
  /** 待探索 / 探索中 / 已求证 / 已搁置 */
  status: 'todo' | 'doing' | 'done' | 'shelf'
  pinned: boolean
  /** 第卅五轮 REQ-035：手动拖拽排序权重（markRank 组内 sortOrder 优先、未拖拽回退 createdAt；拖拽后全量重写） */
  sortOrder?: number
  /** R47-B4：被打开（调起详情）次数与最近打开时间——热度排序 */
  callCount?: number
  lastCalledAt?: number
  /**
   * R167：「转化即出路」的记账戳。转任务 / 归档资源时置位（同一刻卡被软删离场），
   * 回收站恢复（= 撤销这次转化）时清除。池里数不到离场卡，「已转化」指标只能靠它计数。
   * ★ 只记"转成了哪一类"，不记目标卡 id——卡间零挂载红线不因溯源而让步。
   */
  convertedAt?: number
  convertedTo?: 'task' | 'res'
}

export type AnyCard = ResourceCard | TaskCard | CuriosityCard

/**
 * V3.7.0：论证节点卡（第 4 种卡，策展台专用）。
 * 围绕策展主题的**描述性论证节点**——用来统筹（镜像进来的）资源卡，本身不是好奇/任务/资源卡：
 * - 存独立表 `AppData.argCards`（不进 resources 数组 ⇒ 天然不进三卡池 / 3张卡 Tab / 全局三卡统计）；
 * - workspaceId = 所属策展台 id，随台存亡（台删则节点删，走回收站同口径）；
 * - 金字塔节点/台内列表消费它；与资源卡的关联继续走「挂载/投射」，卡间零挂载红线不破。
 */
export interface ArgumentCard extends CardBase {
  kind: 'argument'
  /** 节点标题（论证要点的短句） */
  title: string
  /** 所属策展台 */
  workspaceId: ID
  /** 台内排序（拖拽自由排序） */
  order?: number
  /** R1.5：论证内容（论点的展开说明，支撑性正文） */
  content?: string
  /** R1.5：关联资源卡（引用式记录关联，指向资源卡池真身；记录型关联豁免同 SupportLink，卡本体零挂载） */
  linkedResourceIds?: ID[]
}

// ============ 策展台与分类 ============

export interface Workspace {
  id: ID
  name: string
  icon: string
  color: string
  /** 封面渐变主题（默认深海蓝） */
  coverTheme: string
  desc?: string
  order: number
  archived: boolean
  /** R61：台类型——'resource'=资源台（全局唯一，id 固定 CURATION_WS_ID，资源卡镜像源头）；缺省/'curation'=策展台（接收资源台镜像 + 台内新建卡） */
  kind?: 'resource' | 'curation'
  /** H1：策展台快捷键固定映射（R68 起键位由台签顺序推导，本字段保留兼容） */
  hotkey?: number
  /** R47-B4：被打开次数与最近打开时间——全局检索无输入时策展台参与热度排序 */
  callCount?: number
  lastCalledAt?: number
}

/** N4：树状标签节点。R151：definition = 这个标签收什么卡（整体梳理蓝图落盘的判据，旧数据无此字段=空） */
export interface TagNode {
  id: ID
  name: string
  /** R151：收卡定义（≤40 字），整体梳理的蓝图与逐卡归架共用 */
  definition?: string
  children?: TagNode[]
}

export interface Category {
  id: ID
  workspaceId: ID
  name: string
  /** V3.9.8 策展画布：节点说明（可选，零迁移）。标题仍是 name，说明用于解释“为什么这个分支成立”。 */
  description?: string
  order: number
  parentId?: ID    // 第八轮：父分类 id（最多 2 级；缺省 = 一级分类）。R53 起可指向策展镜像分类 id（同为真实 Category）
  pinned?: boolean // 第八轮：置顶分类（左栏顶部置顶分区）
  /** R53-A1：策展中心镜像分类溯源标记（workspaceId=CURATION_WS_ID 时有效）——
   *  镜像分类物化为真实策展 Category，树内与原生分类同构（混排/父子/拖拽）；源数据零影响 */
  curFrom?: { wsId: ID; catId: ID; projId: ID }
  /** R109（F12-b）：分类软删——删除策展台/分类时置 deletedAt 进回收站，可恢复（卡片软删口径对齐） */
  deletedAt?: number
}

// ============ 今日三件事 ============

export interface FocusSlot {
  id: ID
  /** 来源：任务库 / 资源库 / 好奇心库 / 自由文本 */
  sourceType: 'task' | 'resource' | 'curiosity' | 'text'
  sourceId?: ID
  /** 快照文本 */
  text: string
  done: boolean
  doneAt?: number
  /**
   * R169-T3（可选，零迁移）：这一格是**系统自动写入的推荐**，不是用户自己挑的。
   * 只用来显示「✦ 荐」标与"用户动过就不再插手"的判据 —— 用户手工选/改/勾过的格子把它清掉，
   * 之后 AI 重排不许再覆盖该格（推荐是便利，不是替决策）。
   */
  auto?: boolean
}

/** { 'YYYY-MM-DD': FocusSlot[] }，每天最多3个 */
export type DailyFocus = Record<string, FocusSlot[]>

// ============ 字段配置 ============

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'tags' | 'number'
  options?: string[]
  visible: boolean
  order: number
}

export interface FieldConfig {
  resource: FieldDef[]
  task: FieldDef[]
  curiosity: FieldDef[]
  /** R62-3：策展主题卡字段组（isThesis 资源卡专用，界面层独立配置；老数据无此组，加载期补默认） */
  thesis?: FieldDef[]
  /** V3.7.0：论证节点卡字段组（老数据无此组，消费方按默认组兜底） */
  argument?: FieldDef[]
}

// ============ 统计指标 ============

export interface WeeklyStat {
  weekStart: string
  newCount: number
  reuseCount: number
  quickCapture: number
  dupBlocked: number
}

export interface Stats {
  weekly: WeeklyStat[]
  /** 每张卡最近一次被打开的时间 */
  lastReuse: Record<ID, number>
  /** 本周内按卡统计的点击次数 */
  lastVisits: Record<ID, number>
  /** WRR 累计唤醒 */
  wrr: {
    totalCumulativeUsage: number
    thisWeekUsage: number
    lastUpdatedAt: number
    /** R129-B10：`thisWeekUsage` 归属的周起点（weekStartKey）。缺失或不是本周 → 本周值按 0 计，
     *  避免「新的一周还没打开过，北极星仍显示上周次数」。 */
    thisWeekStart?: string
  }
}

// ============ 完整数据根 ============

export interface AppData {
  version: 2
  compass: Compass
  workspaces: Workspace[]
  categories: Category[]
  resources: ResourceCard[]
  tasks: TaskCard[]
  curiosities: CuriosityCard[]
  dailyFocus: DailyFocus
  /**
   * R169-T3（可选，零迁移）：今日三件事**自动推荐已写过**的日期（'YYYY-MM-DD'）。
   * 每天只在第一次打开调度台时写一次；同一天再开不重算——否则用户上午手工调过，
   * 下午刷新一下就被系统盖回去，这是"自动"最容易做坏的地方。
   */
  focusAutoDate?: string
  /** R169-T3（可选，零迁移）：用户点了「今天别自动推荐」的日期——当天不再写，次日照常 */
  focusMutedDate?: string
  /** N4：标签管理体系（唯一入口：设置 → 标签管理） */
  tagTree: TagNode[]
  fieldConfig: FieldConfig
  stats: Stats
  activityLogs: ActivityLog[]
  /** V2.20.1 BUG-2：存量回填记录——启动时按指标反查补齐 projectId 的任务条数（幂等，仅首次修复时写入） */
  projBackfillFixed?: number
  /** R50-F3：策展中心投射清单（引用式镜像；导入合并按 id 取并集）。R61 起方向反转：资源台 → 策展台（targetWsId 标记） */
  curationProjections?: CurationProjection[]
  /** R166 定案 5：任务/子任务 ↔ 资源的「支持」关联记录（独立表，卡对象互不持有 id；导入合并同 `curationProjections` 走 mergeByIdArr） */
  supportLinks?: SupportLink[]
  /** 好奇心卡 ↔ 资源的支撑关联记录（独立表；导入合并按 id 并集） */
  curioSupportLinks?: CurioSupportLink[]
  /** R166 定案 2：存量 `parentId` 子卡折叠进父卡 `subtasks` 的幂等标记（有值即跳过迁移） */
  subtasksFoldedAt?: number
  /** R61：资源台结构迁移完成时间戳（幂等标记——有值即跳过迁移；迁移前自动备份下载由调用方执行） */
  hubMigratedAt?: number
  /** R64：旧工作台并入资源台完成时间戳（幂等标记；迁移前自动备份下载由调用方执行） */
  hubMergedAt?: number
  /** R63：Airtable 单向同步配置与状态（知源 → Airtable，PAT 明文随设备不跨端） */
  airtableSync?: AirtableSyncState
  /** R63：知源卡 id ↔ Airtable recordId 映射表（同步成功后写回；导入合并按 id 取并集） */
  airtableMap?: Record<string, AirtableMapEntry>
  /** R80（R1 遗留）：资源卡标签默认可见迁移完成时间戳（幂等标记——有值即跳过） */
  /** R148-P0b：热度统计拆独立键（zy_stats_v1）的落戳——有戳=已拆分，启动期不再重复抽取 */
  hotStatsSplitAt?: number
  /** R151：标签树版本号——「整体梳理」整树替换时 +1。
   *  跨上下文合并按 id 取并集对"替换"是错的（旧节点会被并回来），故谁号大听谁的。 */
  tagTreeRevision?: number
  tagsVisibleMigratedAt?: number
  /** V3.7.0：论证节点卡（策展台专用第 4 种卡；导入合并同 curationProjections 走 mergeByIdArr） */
  argCards?: ArgumentCard[]
  /** V3.7.0：分类 → 标签迁移完成时间戳（幂等标记——有值即跳过；备份见 K.MIGRATE_BACKUP） */
  catsMigratedAt?: number
  /** V3.7.0：策展台台内资源卡收编入池完成时间戳（幂等标记） */
  boardCardsPooledAt?: number
  /** V3.7.0：分类 → 标签迁移报告（设置页「标签管理」展示；映射清单逐条可查） */
}

/** V3.7.0：分类 → 标签迁移报告（口径与逐条映射，供设置页展示与核对） */
export interface CatsMigrateReport {
  at: number
  /** 一级分类 → 标签父节点 数 */
  l1: number
  /** 二级分类 → 子标签 数 */
  l2: number
  /** 三 / 四级分类 → 拍平路径标签 数 */
  deep: number
  /** 被追加标签的卡片数 */
  cardsTouched: number
  /** 累计追加的标签次数（去重后） */
  tagsAdded: number
  /** 逐条映射：catId=原分类 id；path=原分类全路径；tagName=落库标签值；kind=去向 */
  mapping: { catId: ID; path: string; tagName: string; kind: 'parent' | 'child' | 'flat' }[]
}

/** R1.5：catsMigrateReport 已迁独立小键 K.MIGRATE_REPORT（红线更正：报告不进 zy_data_v2 主根）；接口 CatsMigrateReport 保留供键值类型 */
/** R63：Airtable 单向同步配置 + 状态（存 AppData 单根内，随导出带走） */
export interface AirtableSyncState {
  /** Personal Access Token（明文存 chrome.storage.local，零云端立场） */
  pat: string
  /** Base ID（app 开头） */
  baseId: string
  /** Table ID（tbl 开头，连接测试后自动回填） */
  tableId: string
  /** 表名（回显用） */
  tableName?: string
  /** R4-Dd：标签写到哪一列（留空 = 默认「标签」）。列类型由同步时读远端实际类型自适应
   *  （multipleSelects 发数组、文本列发分号串），所以这里只存列名、不存类型——
   *  存了就会和远端真值漂移，而漂移的代价是把一批 422 当成成功。 */
  tagColumn?: string
  /** 3 小时轮询开关（默认关，R63-10） */
  pollEnabled?: boolean
  /** 上次同步完成时间戳 */
  lastSyncAt?: number
  /** 上次同步耗时 ms */
  lastSyncMs?: number
  /** 上次同步消耗的 API 调用次数 */
  lastSyncCalls?: number
  /** 上次同步推送的记录数（含新建+更新） */
  lastSyncedCount?: number
  /** 上次同步后仍待推送的卡片数（失败/未扫到的） */
  pendingCount?: number
  /** 增量游标：只推 updatedAt > cursorAt 的卡片 */
  cursorAt?: number
  /** 累计 API 调用计数（配额提示用，自用户配置起算） */
  totalApiCalls?: number
  /** 最近同步日志（尾部追加，最多 40 条） */
  log?: AirtableLogEntry[]
  /** 上次同步错误摘要（空串=无错误） */
  lastError?: string
}

/** R63：同步日志条目 */
export interface AirtableLogEntry {
  at: number
  /** pushed=成功推送条数 fields=补建字段数 error=错误摘要 */
  msg: string
  kind: 'ok' | 'error' | 'info'
}

/** R63：映射表条目 */
export interface AirtableMapEntry {
  recordId: string
  /** 该卡上次同步成功时本地updatedAt */
  syncedAt: number
}

export interface ActivityLog {
  id: ID
  type: 'create' | 'update' | 'delete' | 'status-change' | 'restore'
  entityType: 'resource' | 'task' | 'curiosity' | 'compass'
  entityId: ID
  timestamp: number
  detail?: string
}

// ============ UI 偏好（不随数据同步） ============

export interface UIPrefs {
  theme: string
  viewMode: 'list' | 'kanban' | 'card'
  tcSplitRatio: number
  /* R2-⑥：curSplit / spotSplit 两键随「项目调度卡」退役（R2-②）失去全部消费方后删除。
     老库里残留的这两个键不影响读取（UIPrefs 是宽松对象，多余键随写盘原样带回，无人读它）。 */
  dateStr?: string
  /* R3-F38：仪表盘「👁 高亮可交互」开关（dzHl）随知源仪表盘退役（★W9）——开关三件与
     dashboard.css 的两条 .dz-hl 规则一并删除，V3.8.7 迁 ProfileInsights 后本页不需要该开关。
     老库里残留的这个键不影响读取（UIPrefs 是宽松对象，多余键随写盘原样带回，无人读它）。 */
  /** 应用内切台快捷键修饰键（O18：五种可选，默认 Alt） */
  wsSwitchMod?: 'ctrl' | 'alt' | 'ctrl-shift' | 'alt-shift' | 'none'
  // R3-B1：`compassTab`（方向台上次停留的二级页）退役——树即方向台一级后只剩「一级 + 项目详情」，
  // 该字段在源码里本就零读写（老库残留键不影响读取），随 CompassShell 一并清。
  /** B7：抽屉宽度记忆（task/resource/curiosity） */
  drawerWs?: Record<string, number>
  /** 第卅三轮 REQ-007：三视图排序偏好（res/task/curio → { by, dir }），时间排序默认倒序 */
  /** 第卅二轮 REQ-007：各模块排序偏好（by/dir）；第卅五轮 REQ-036：task.filter 状态筛选偏好持久化 */
  sortPrefs?: Record<string, { by?: string; dir?: 'asc' | 'desc'; filter?: string; group?: string }>
  /** 第卅三轮 REQ-024：详情抽屉文本框高度记忆（组件键 → px） */
  taHeights?: Record<string, number>
  /** 第卅三轮 REQ-026：卡片网格密度档位（compact=紧凑 / cozy=舒适，默认 cozy） */
  density?: 'compact' | 'cozy'
  /** R72-1：卡片视图横向列数偏好（模块键 curio/task/res → 4~7 列；缺省取各模块默认值，见 shared/utils/cardCols.ts） */
  cardCols?: Record<string, number>
  /** R84（W2-②）：各台视图模式偏好（台 id → 卡片/列表/看板/金字塔）；缺省由调用方按「已设论点 → 金字塔，否则卡片」决定。见 shared/utils/wsView.ts */
  wsViewMode?: Record<string, 'card' | 'list' | 'kanban' | 'pyramid'>
  /** 第卅六轮 REQ-038：备份提醒开关（true=启用，false=关闭） */
  backupReminderEnabled?: boolean
  /** 第卅六轮 REQ-038：上次导出/备份时间戳（毫秒），用于设置页与顶栏红点判断「多久未备份」 */
  /** R49-C6：已完成（archived）项目全局显隐（主航线/项目总览/完整方向树三处同步，默认显示） */
  showDoneProjects?: boolean
  lastBackupAt?: number
  /** 第卅六轮 REQ-038：上次主动关闭提醒的时间戳（24h 内不再提示） */
  backupReminderSnoozedAt?: number
  /** R67-F5：方向台·项目详情左栏（全部项目+项目目录）拖拽记忆（宽 px / 高 px） */
  projRailW?: number
  projRailH?: number
  /** R113-N1：资源台/策展台左侧分类树宽度记忆（px，160–420，默认 200；双击分隔条复位） */
  wsSideW?: number
  /** R125：工作台左栏收起为 36px 图标轨（记忆偏好） */
  wsSideRail?: boolean
  /** ★V3.8.20 退役带备案（用户拍板 2026-10-15）：原 N4 方向台页头文案自定义 compassCopy
   *  （eyebrow/title/sub）随 HERO 左文案栏整块退役 —— 字段从接口删除；老库里的残留键
   *  读取方已不存在，宽松反序列化下无害（多出来的键原样躺在 localStorage 里不影响任何读写）。 */
  /** R126（诉求 5）：全局默认冷却天数（1~365；缺省 30；归档 = ×3） */
  coolingDaysDefault?: number
  /** R161-②：常用检索词（本地记忆，不随数据同步）——按次数降序取前 3 条铺在检索框下方。
   *  `n` = 用过几次，`at` = 最近一次时间戳；上限 20 条，超出丢最久未用的那条 */
  searchHistory?: { q: string; n: number; at: number }[]
}

// ============ 常量 ============

export { K } from '../storage/keys'
export const STORAGE_KEY = K.DATA
export const UI_KEY = K.UI
export const LEGACY_KEY = K.LEGACY[0]
/** R50-F3：策展中心系统空间 ID。R61 起转正为「资源台」——唯一 kind='resource' 的真实 Workspace 实体
 *  （id 保持不变 ⇒ 存量 categories/resources 归属零迁移），是资源卡镜像的源头 */
export const CURATION_WS_ID = 'zy-curation'

export const DEFAULT_COVER_THEME = 'deep-sea'

export const TASKBAR_IDS = {
  compass: 'compass',
  tasks: '__tasks__',
  settings: '__settings__'
} as const
import { K } from '../storage/keys'
