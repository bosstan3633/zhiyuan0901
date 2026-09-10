/**
 * V1.0 → V2.0 数据迁移
 *
 * V1 数据存储键：lm_data_v5
 * V1 结构特点：
 *   - 三卡混存在 links 数组，靠 kind 字段和分类名区分
 *   - compass.directions[].goals[].metrics[]（V1 goal = V2 project）
 *   - 任务通过 goalId(=V2 projectId) + metricId 关联
 *
 * V2 结构：三表分立 + Direction→Project→Metric 六层树
 */
import type {
  AppData, ResourceCard, TaskCard, CuriosityCard,
  Compass, Direction, Project, Metric, Workspace, Category,
  FieldConfig, Stats
} from '@/shared/models'
import { createDefaultData } from './defaults'
import { uid, dateKey } from '@/shared/utils'

interface V1Link {
  id?: string
  name?: string
  title?: string
  url?: string
  html?: string
  desc?: string
  description?: string
  highlight?: string
  categoryId?: string
  tags?: string[]
  pinned?: boolean
  kind?: string
  status?: string
  priority?: string
  dueDate?: string
  goalId?: string
  metricId?: string
  mountedResourceIds?: string[]
  mountedCuriosityIds?: string[]
  callCount?: number
  lastCalledAt?: number | string
  lastVisitedAt?: number | string
  createdAt?: number | string
  updatedAt?: number | string
  completedAt?: number | string
  deletedAt?: number | string
  isArchived?: boolean
  customFields?: Record<string, unknown>
  [key: string]: unknown
}

interface V1Category {
  id: string
  name: string
  ws?: string
  desc?: string
  subtitle?: string
  order?: number
}

interface V1Workspace {
  id: string
  name: string
  icon?: string
  color?: string
  desc?: string
  directionId?: string
  order?: number
  archived?: boolean
}

interface V1Metric {
  id: string
  title: string
  target?: string
  ratio?: number
  status?: string
  sort?: number
  taskIds?: string[]
}

interface V1Goal {
  id: string
  name: string
  status?: string
  term?: string
  calibratedAt?: number | string
  metrics?: V1Metric[]
}

interface V1Direction {
  id: string
  name: string
  status?: string
  term?: string
  calibratedAt?: number | string
  goals?: V1Goal[]
}

interface V1Compass {
  vision?: string
  mission?: string
  values?: unknown[]
  directions?: V1Direction[]
  primaryGoalId?: string
}

interface V1Data {
  links?: V1Link[]
  categories?: V1Category[]
  workspaces?: V1Workspace[]
  trash?: V1Link[]
  compass?: V1Compass
  dailyFocus?: Record<string, unknown[]>
  stats?: Partial<Stats>
  customFields?: unknown[]
  fieldDefs?: Record<string, unknown[]>
  viewFieldCfg?: Record<string, unknown>
  activityLogs?: AppData['activityLogs']
}

function toTs(v: unknown): number {
  if (!v) return Date.now()
  if (typeof v === 'number') return v
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? Date.now() : d.getTime()
}

/** 检测是否存在 V1 数据 */
export async function hasV1Data(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return false
  const result = await chrome.storage.local.get(['lm_data_v5'])
  return !!(result.lm_data_v5 && Array.isArray(result.lm_data_v5.links))
}

/** 执行 V1 → V2 迁移 */
export async function migrateV1ToV2(): Promise<AppData> {
  const result = await chrome.storage.local.get(['lm_data_v5'])
  const v1 = (result.lm_data_v5 || {}) as V1Data
  const defaults = createDefaultData()

  // ---- 1. 迁移策展台 ----
  const workspaces: Workspace[] = (v1.workspaces || []).map((w) => ({
    id: w.id,
    name: w.name || '未命名策展台',
    icon: w.icon || '📂',
    color: w.color || '#3A6B4C',
    coverTheme: 'deep-sea',
    desc: w.desc || '',
    order: w.order ?? 0,
    archived: !!w.archived
  }))

  // 确保至少有一个策展台
  if (workspaces.length === 0) {
    workspaces.push(...defaults.workspaces)
  }

  // ---- 2. 迁移分类 ----
  const categories: Category[] = (v1.categories || []).map((c, i) => ({
    id: c.id,
    workspaceId: c.ws || workspaces[0]?.id || '',
    name: c.name,
    order: c.order ?? i
  })).filter((c) => c.workspaceId)

  // 找出好奇心分类 ID
  const curiosityCatIds = new Set(
    (v1.categories || [])
      .filter((c) => c.name === '好奇心' || c.name?.includes('好奇'))
      .map((c) => c.id)
  )

  // ---- 3. 迁移六层树 ----
  const compass: Compass = migrateCompass(v1.compass)

  // 建立 V1 goalId → V2 projectId 映射（id 保持一致）
  // V1 metricId → V2 metricId 映射（id 保持一致）

  // ---- 4. 迁移三卡 ----
  const resources: ResourceCard[] = []
  const tasks: TaskCard[] = []
  const curiosities: CuriosityCard[] = []

  const allLinks = [...(v1.links || []), ...(v1.trash || [])]

  for (const link of allLinks) {
    const isTask = link.kind === 'task'
    const isCuriosity = link.kind === 'curiosity' ||
      (link.categoryId && curiosityCatIds.has(link.categoryId))

    if (isTask) {
      tasks.push(migrateTask(link))
    } else if (isCuriosity) {
      curiosities.push(migrateCuriosity(link))
    } else {
      resources.push(migrateResource(link, workspaces, categories))
    }
  }

  // ---- 5. 迁移今日三件事 ----
  const dailyFocus = migrateDailyFocus(v1.dailyFocus, tasks)

  // ---- 6. 迁移统计 ----
  const stats: Stats = {
    weekly: Array.isArray(v1.stats?.weekly) ? v1.stats!.weekly! : [],
    lastReuse: (v1.stats?.lastReuse as Record<string, number>) || {},
    lastVisits: (v1.stats?.lastVisits as Record<string, number>) || {},
    wrr: v1.stats?.wrr || { totalCumulativeUsage: 0, thisWeekUsage: 0, lastUpdatedAt: 0 }
  }

  // ---- 7. 字段配置（V2 默认） ----
  const fieldConfig: FieldConfig = defaults.fieldConfig

  const data: AppData = {
    version: 2,
    compass,
    workspaces,
    categories,
    resources,
    tasks,
    curiosities,
    dailyFocus,
    tagTree: [],
    fieldConfig,
    stats,
    activityLogs: Array.isArray(v1.activityLogs) ? v1.activityLogs : []
  }

  // 备份 V1 数据（安全网）
  try {
    await chrome.storage.local.set({ lm_data_v5_backup: v1 })
  } catch (e) {
    console.warn('[V2迁移] V1备份失败', e)
  }

  return data
}

function migrateCompass(v1c?: V1Compass): Compass {
  const now = Date.now()
  const directions: Direction[] = (v1c?.directions || []).map((d) => {
    const projects: Project[] = (d.goals || []).map((g) => {
      const metrics: Metric[] = (g.metrics || []).map((m) => ({
        id: m.id,
        title: m.title || '未命名指标',
        target: m.target || '',
        acceptance: '',
        taskIds: m.taskIds || []
      }))
      return {
        id: g.id,
        name: g.name || '未命名项目',
        isFocused: false,
        progress: 0,
        status: (g.status === 'done' ? 'done' : g.status === 'paused' ? 'paused' : 'active') as Project['status'],
        startDate: '',
        endDate: '',
        retrospective: '',
        metrics
      }
    })
    return {
      id: d.id,
      name: d.name || '未命名方向',
      status: (d.status === 'archived' ? 'archived' : d.status === 'paused' ? 'paused' : 'active') as Direction['status'],
      term: (d.term as Direction['term']) || 'mid',
      calibratedAt: toTs(d.calibratedAt),
      projects
    }
  })

  return {
    vision: {
      content: v1c?.vision || '',
      updatedAt: v1c?.vision ? now : 0
    },
    mission: {
      content: v1c?.mission || '',
      updatedAt: v1c?.mission ? now : 0
    },
    directions
  }
}

function migrateResource(link: V1Link, workspaces: Workspace[], categories: Category[]): ResourceCard {
  const cat = categories.find((c) => c.id === link.categoryId)
  const wsId = cat?.workspaceId || workspaces[0]?.id || ''
  const url = link.url || ''
  let linkType: ResourceCard['linkType'] = 'url'
  if (url.startsWith('file://')) linkType = 'file'
  else if (url.startsWith('obsidian://')) linkType = 'obsidian'

  return {
    id: link.id || uid('r'),
    kind: 'resource',
    title: link.name || link.title || '未命名资源',
    linkType,
    link: url,
    workspaceId: wsId,
    categoryId: link.categoryId || '',
    description: link.desc || link.description || link.highlight || '',
    sourceType: undefined,
    tags: link.tags || [],
    customFields: link.customFields || {},
    pinned: !!link.pinned,
    callCount: link.callCount || 0,
    lastCalledAt: toTs(link.lastCalledAt || link.lastVisitedAt),
    createdAt: toTs(link.createdAt),
    updatedAt: toTs(link.updatedAt || link.createdAt),
    deletedAt: link.isArchived ? toTs(link.deletedAt || link.updatedAt) : undefined
  }
}

function migrateTask(link: V1Link): TaskCard {
  const v1Status = link.status || '待开始'
  let status: TaskCard['status'] = 'todo'
  if (v1Status === '已完成' || v1Status === 'done') status = 'done'
  else if (v1Status === '进行中' || v1Status === 'doing') status = 'doing'

  let priority: TaskCard['priority'] = 'medium'
  if (link.priority === '高' || link.priority === 'high' || link.priority === 'S' || link.priority === 'A') priority = 'high'
  else if (link.priority === '低' || link.priority === 'low' || link.priority === 'D') priority = 'low'

  return {
    id: link.id || uid('t'),
    kind: 'task',
    title: link.name || link.title || '未命名任务',
    description: link.desc || link.description || '',
    projectId: link.goalId || undefined,  // V1 goalId = V2 projectId
    metricId: link.metricId || undefined,
    status,
    priority,
    dueDate: link.dueDate || undefined,
    mountedResourceIds: link.mountedResourceIds || [],
    mountedCuriosityIds: link.mountedCuriosityIds || [],
    customFields: link.customFields || {},
    createdAt: toTs(link.createdAt),
    updatedAt: toTs(link.updatedAt || link.createdAt),
    completedAt: link.completedAt ? toTs(link.completedAt) : undefined,
    deletedAt: link.isArchived ? toTs(link.deletedAt || link.updatedAt) : undefined
  }
}

function migrateCuriosity(link: V1Link): CuriosityCard {
  const v1Status = link.status || '待探索'
  let status: CuriosityCard['status'] = 'todo'
  if (v1Status === '已求证' || v1Status === '已提炼' || v1Status === 'done') status = 'done'
  else if (v1Status === '探索中' || v1Status === '正在思考' || v1Status === '查证中' || v1Status === 'doing') status = 'doing'
  else if (v1Status === '已搁置' || v1Status === '已归档' || v1Status === 'shelf') status = 'shelf'

  return {
    id: link.id || uid('c'),
    kind: 'curiosity',
    question: link.name || link.title || '',
    sourceUrl: link.url || undefined,  // V1 有URL则保留，V2采集时不再自动记录
    status,
    pinned: !!link.pinned,
    relatedResourceIds: [],
    customFields: link.customFields || {},
    createdAt: toTs(link.createdAt),
    updatedAt: toTs(link.updatedAt || link.createdAt),
    deletedAt: link.isArchived ? toTs(link.deletedAt || link.updatedAt) : undefined
  }
}

function migrateDailyFocus(
  v1Daily: Record<string, unknown[]> | undefined,
  tasks: TaskCard[]
): AppData['dailyFocus'] {
  const result: AppData['dailyFocus'] = {}
  if (!v1Daily) return result

  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  for (const [date, slots] of Object.entries(v1Daily)) {
    if (!Array.isArray(slots)) continue
    result[date] = (slots as Record<string, unknown>[]).slice(0, 3).map((s, i) => {
      const taskId = s.taskId as string
      const task = taskId ? taskMap.get(taskId) : null
      return {
        id: (s.id as string) || uid('fs'),
        sourceType: task ? 'task' : 'text',
        sourceId: task?.id,
        text: (s.titleSnap as string) || (task?.title) || '',
        done: !!(s.doneAt || s.statusSnap === '已完成'),
        doneAt: s.doneAt ? toTs(s.doneAt) : undefined
      }
    })
  }
  return result
}
