/**
 * 默认数据工厂 · 首次安装时初始化
 */
import type { AppData, FieldDef, TaskStatusDef, TopicStatusDef } from '@/shared/models'
import { uid } from '@/shared/utils'

function defaultFieldDefs() {
  const resource: FieldDef[] = [
    { key: 'title', label: '标题', type: 'text', visible: true, order: 0 },
    { key: 'link', label: '链接', type: 'text', visible: true, order: 1 },
    { key: 'description', label: '描述', type: 'text', visible: true, order: 2 },
    { key: 'sourceType', label: '来源类型', type: 'select', options: ['官方', '学术', '媒体', '个人', 'AI工具', '个人成果'], visible: false, order: 3 },
    // R80（R1 遗留）：tags 改默认可见——R1「补齐 #标签」此前在默认配置下根本不显示
    { key: 'tags', label: '标签', type: 'tags', visible: true, order: 4 },
    { key: 'createdAt', label: '创建时间', type: 'date', visible: false, order: 5 },
    { key: 'assets', label: '附件', type: 'text', visible: true, order: 6 }
  ]
  const task: FieldDef[] = [
    { key: 'title', label: '任务名', type: 'text', visible: true, order: 0 },
    { key: 'projectId', label: '所属项目', type: 'text', visible: true, order: 1 },
    { key: 'metricId', label: '成功指标', type: 'text', visible: true, order: 2 },
    { key: 'dueDate', label: '计划执行日期', type: 'date', visible: true, order: 3 },
    { key: 'status', label: '状态', type: 'select', options: ['待办', '进行中', '已完成'], visible: false, order: 4 },
    { key: 'description', label: '描述', type: 'text', visible: false, order: 5 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 6 },
    { key: 'assets', label: '附件', type: 'text', visible: true, order: 7 }
  ]
  const curiosity: FieldDef[] = [
    { key: 'question', label: '问题', type: 'text', visible: true, order: 0 },
    { key: 'sourceUrl', label: '来源链接', type: 'text', visible: false, order: 1 },
    { key: 'status', label: '状态', type: 'select', options: ['待探索', '探索中', '已求证', '已搁置'], visible: true, order: 2 },
    { key: 'createdAt', label: '创建时间', type: 'date', visible: false, order: 3 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 4 },
    { key: 'assets', label: '附件', type: 'text', visible: true, order: 5 }
  ]
  const topic: FieldDef[] = [
    { key: 'title', label: '选题', type: 'text', visible: true, order: 0 },
    { key: 'projectId', label: '所属项目', type: 'text', visible: true, order: 1 },
    { key: 'metricId', label: '成功指标', type: 'text', visible: true, order: 2 },
    { key: 'statusId', label: '选题状态', type: 'select', visible: true, order: 3 },
    { key: 'dueDate', label: '计划执行日期', type: 'date', visible: true, order: 4 },
    { key: 'description', label: '说明', type: 'text', visible: false, order: 5 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 6 },
    { key: 'assets', label: '附件', type: 'text', visible: true, order: 7 }
  ]
  // R62-3：策展主题卡字段组（论点卡无链接语义，链接默认隐藏；论点/结论/适用场景用自定义字段承载）
  const thesis: FieldDef[] = [
    { key: 'title', label: '论点', type: 'text', visible: true, order: 0 },
    { key: 'description', label: '论证', type: 'text', visible: true, order: 1 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 2 },
    { key: 'createdAt', label: '创建时间', type: 'date', visible: false, order: 3 },
    { key: 'link', label: '链接', type: 'text', visible: false, order: 4 },
    { key: 'assets', label: '附件', type: 'text', visible: true, order: 5 }
  ]
  // V3.7.0：论证节点卡字段组（策展台专用第 4 种卡；描述性节点，链接语义弱化默认隐藏）
  const argument: FieldDef[] = [
    { key: 'title', label: '节点标题', type: 'text', visible: true, order: 0 },
    { key: 'description', label: '论证描述', type: 'text', visible: true, order: 1 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 2 },
    { key: 'createdAt', label: '创建时间', type: 'date', visible: false, order: 3 },
    { key: 'link', label: '链接', type: 'text', visible: false, order: 4 },
    { key: 'assets', label: '附件', type: 'text', visible: false, order: 5 }
  ]
  return { resource, task, curiosity, topic, thesis, argument }
}

/** 老库/裁剪夹具缺失整块字段配置时的默认组；与首次安装共用同一份定义。 */
export function defaultFieldConfig() {
  return defaultFieldDefs()
}

/** R62-3：老数据归一化用——thesis 字段组缺省补齐 */
export function defaultThesisFieldDefs(): FieldDef[] {
  return defaultFieldDefs().thesis!
}

/** V3.7.0：老数据归一化用——argument 字段组缺省补齐 */
export function defaultArgumentFieldDefs(): FieldDef[] {
  return defaultFieldDefs().argument!
}

/** V4.5.0：选题卡默认状态。ID 固定，改名/改色不破坏已有卡片引用。 */
export function defaultTopicStatuses(): TopicStatusDef[] {
  return [
    { id: 'topic-idea', name: '构思中', color: '#6F7C86', order: 0 },
    { id: 'topic-making', name: '制作中', color: '#0F6F9E', order: 1 },
    { id: 'topic-ready', name: '待发布', color: '#9A6B12', order: 2 },
    { id: 'topic-published', name: '已发布', color: '#168457', order: 3, terminal: true },
  ]
}

/** V4.7.1：任务卡默认状态。ID 固定，改名/改色不破坏已有卡片引用。 */
export function defaultTaskStatuses(): TaskStatusDef[] {
  return [
    { id: 'task-todo', name: '待开始', color: '#6F7C86', order: 0, bucket: 'todo' },
    { id: 'task-doing', name: '进行中', color: '#0F6F9E', order: 1, bucket: 'doing' },
    { id: 'task-done', name: '已完成', color: '#168457', order: 2, bucket: 'done', terminal: true },
  ]
}

export function createDefaultData(): AppData {
  const now = Date.now()
  const wsBiz = uid('ws')
  const wsTools = uid('ws')
  const catProduct = uid('cat')
  const catAI = uid('cat')
  const catTools = uid('cat')

  return {
    version: 2,
    compass: {
      vision: { content: '', updatedAt: 0 },
      mission: { content: '', updatedAt: 0 },
      directions: []
    },
    workspaces: [
      { id: wsBiz, name: '事业策展台', icon: '💼', color: '#3A6B4C', coverTheme: 'deep-sea', desc: '', order: 0, archived: false },
      { id: wsTools, name: '工具策展台', icon: '🛠', color: '#4A7FB5', coverTheme: 'deep-sea', desc: '', order: 1, archived: false }
    ],
    categories: [
      { id: catProduct, workspaceId: wsBiz, name: '产品设计', order: 0 },
      { id: catAI, workspaceId: wsBiz, name: 'AI技术', order: 1 },
      { id: catTools, workspaceId: wsTools, name: '效率工具', order: 0 }
    ],
    resources: [],
    tasks: [],
    curiosities: [],
    topics: [],
    topicStatuses: defaultTopicStatuses(),
    taskStatuses: defaultTaskStatuses(),
    planScheduleEvents: [],
    topicResourceLinks: [],
    argCards: [],
    resourceFolders: [],
    resourceFolderMirrors: [],
    dailyFocus: {},
    tagTree: [],
    fieldConfig: defaultFieldDefs(),
    stats: {
      weekly: [],
      lastReuse: {},
      lastVisits: {},
      wrr: { totalCumulativeUsage: 0, thisWeekUsage: 0, lastUpdatedAt: 0 }
    },
    activityLogs: []
  }
}
