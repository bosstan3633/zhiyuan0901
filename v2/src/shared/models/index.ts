/**
 * 知源工作台 V2.0 · 核心数据模型
 *
 * 设计原则：
 * 1. 三卡分立：ResourceCard / TaskCard / CuriosityCard 各自独立，不再混存
 * 2. 单向挂载：只有 Task 持有 mountedResourceIds / mountedCuriosityIds，反向不持有
 * 3. 六层树：Vision → Mission → Direction → Goal → Project → Metric → Task
 * 4. 软删除：所有卡片 deletedAt 标记，回收站恢复
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
  /** 是否投射至首页知源灯塔 */
  pinnedToLighthouse: boolean
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
  /** 第卅二轮 REQ-001：投射至灯塔仅项目层支持，战略目标层级投射已移除 */
  /** 第4层：攻坚项目 */
  projects: Project[]
}

/** 第4层：攻坚项目 */
export interface Project {
  id: ID
  name: string
  /** 是否主攻项目（最多2个，同步至任务中心顶部） */
  isFocused: boolean
  startDate?: string
  endDate?: string
  progress: number
  status: 'active' | 'paused' | 'done' | 'archived'
  retrospective?: string
  /** 投射至知源灯塔（项目策展页置顶分区 + 首页灯塔展示） */
  pinnedToLighthouse?: boolean
  /** 项目策展排序（拖拽自由排序） */
  order?: number
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
  kind: 'resource' | 'task' | 'curiosity'
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
  /** REQ-048：附件元数据（本体在 IndexedDB zy_assets，仅存引用，主 JSON 绝不存 base64） */
  assets?: AssetMeta[]
}

/** 资源卡（向源头求证） */
export interface ResourceCard extends CardBase {
  kind: 'resource'
  title: string
  linkType: LinkType
  link: string
  workspaceId: ID
  categoryId: ID
  /** 来源类型（官方/学术/媒体等），不在采集弹窗中设置，后期编辑 */
  sourceType?: SourceType
  tags: string[]
  pinned: boolean
  /** 调用次数（每次打开自增） */
  callCount: number
  lastCalledAt?: number
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
  mountedResourceIds: ID[]
  /** 单向挂载：任务 → 好奇心 */
  mountedCuriosityIds: ID[]
  completedAt?: number
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
  /** 弱关联资源（查证过程中收集） */
  relatedResourceIds: ID[]
}

export type AnyCard = ResourceCard | TaskCard | CuriosityCard

// ============ 工作台与分类 ============

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
  /** H1：工作台快捷键固定映射（2-9，空 = 自动分配） */
  hotkey?: number
}

/** N4：树状标签节点 */
export interface TagNode {
  id: ID
  name: string
  children?: TagNode[]
}

export interface Category {
  id: ID
  workspaceId: ID
  name: string
  order: number
  parentId?: ID    // 第八轮：父分类 id（最多 2 级；缺省 = 一级分类）
  pinned?: boolean // 第八轮：置顶分类（左栏顶部置顶分区）
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
  /** N4：标签管理体系（唯一入口：设置 → 标签管理） */
  tagTree: TagNode[]
  fieldConfig: FieldConfig
  stats: Stats
  activityLogs: ActivityLog[]
  /** V2.20.1 BUG-2：存量回填记录——启动时按指标反查补齐 projectId 的任务条数（幂等，仅首次修复时写入） */
  projBackfillFixed?: number
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
  dateStr?: string
  /** 工作台切换快捷键修饰键（O18：五种可选，默认 Alt） */
  wsSwitchMod?: 'ctrl' | 'alt' | 'ctrl-shift' | 'alt-shift' | 'none'
  /** 知源引擎上次停留的子页（默认今日行动） */
  compassTab?: '/compass/actions' | '/compass/projects' | '/compass/tree'
  /** B7：抽屉宽度记忆（task/resource/curiosity） */
  drawerWs?: Record<string, number>
  /** 第卅三轮 REQ-007：三视图排序偏好（res/task/curio → { by, dir }），时间排序默认倒序 */
  /** 第卅二轮 REQ-007：各模块排序偏好（by/dir）；第卅五轮 REQ-036：task.filter 状态筛选偏好持久化 */
  sortPrefs?: Record<string, { by?: string; dir?: 'asc' | 'desc'; filter?: string }>
  /** 第卅三轮 REQ-024：详情抽屉文本框高度记忆（组件键 → px） */
  taHeights?: Record<string, number>
  /** 第卅三轮 REQ-026：卡片网格密度档位（compact=紧凑 / cozy=舒适，默认 cozy） */
  density?: 'compact' | 'cozy'
  /** 第卅六轮 REQ-038：备份提醒开关（true=启用，false=关闭） */
  backupReminderEnabled?: boolean
  /** 第卅六轮 REQ-038：上次导出/备份时间戳（毫秒），用于设置页与顶栏红点判断「多久未备份」 */
  lastBackupAt?: number
  /** 第卅六轮 REQ-038：上次主动关闭提醒的时间戳（24h 内不再提示） */
  backupReminderSnoozedAt?: number
}

// ============ 常量 ============

export const STORAGE_KEY = 'zy_data_v2'
export const UI_KEY = 'zy_ui_v2'
export const LEGACY_KEY = 'lm_data_v5'

export const DEFAULT_COVER_THEME = 'deep-sea'

export const TASKBAR_IDS = {
  compass: 'compass',
  tasks: '__tasks__',
  settings: '__settings__'
} as const
