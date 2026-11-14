import type { CloudSyncDirection, SyncManifestRecordType } from './sync'

export type SyncRecordGroup =
  | 'all'
  | 'cards'
  | 'curation'
  | 'direction'
  | 'dailyFocus'
  | 'relations'
  | 'system'

export const SYNC_RECORD_GROUPS: Array<{ id: SyncRecordGroup; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'cards', label: '卡片' },
  { id: 'curation', label: '策展台' },
  { id: 'direction', label: '方向台' },
  { id: 'dailyFocus', label: '今日三件事' },
  { id: 'relations', label: '关系' },
  { id: 'system', label: '系统记录' },
]

const TYPE_LABEL: Record<SyncManifestRecordType, string> = {
  workspace: '策展台',
  category: '策展节点',
  resource: '资源卡',
  task: '任务卡',
  curiosity: '好奇心卡',
  argument: '论证节点',
  direction: '方向',
  project: '项目',
  metric: '成功指标',
  dailyFocus: '今日三件事',
  supportLink: '任务 → 资源',
  curationProjection: '策展节点 → 资源',
  resourceFolder: '常用夹',
  resourceFolderMirror: '常用夹 → 资源镜像',
  tag: '标签',
  activity: '操作记录',
  stats: '使用统计',
  fieldConfig: '字段配置',
  attachment: '附件',
  event: '同步事件',
  preference: '界面偏好',
}

const FIELD_LABEL: Record<string, string> = {
  title: '标题',
  question: '问题',
  description: '描述',
  content: '正文',
  tags: '标签',
  categoryId: '分类',
  workspaceId: '所属策展台',
  parentId: '父级',
  linkType: '链接类型',
  link: '链接',
  linkSlots: '链接槽位',
  sourceType: '来源类型',
  sourceUrl: '来源链接',
  sourceTitle: '来源标题',
  projectId: '项目',
  metricId: '成功指标',
  status: '状态',
  priority: '优先级',
  dueDate: '计划执行日期',
  estimatedMinutes: '估时',
  completedAt: '完成时间',
  subtasks: '子任务',
  pinned: '置顶',
  starred: '星标',
  lifecycleArchived: '生命周期',
  customFields: '自定义字段',
  assets: '附件',
  name: '名称',
  icon: '图标',
  color: '颜色',
  coverTheme: '封面主题',
  desc: '说明',
  order: '顺序',
  archived: '归档',
  kind: '类型',
  hidden: '隐藏',
  term: '周期',
  reason: '理由',
  calibratedAt: '校准时间',
  goalId: '所属方向',
  endDate: '结束日期',
  nextStep: '下一步',
  target: '目标值',
  acceptance: '验收口径',
  taskIds: '任务轨道',
  taskId: '任务',
  subId: '子任务',
  resourceId: '资源卡',
  from: '来源',
  why: '判词',
  createdAt: '创建时间',
  catId: '分类',
  cardId: '卡片',
  targetWsId: '目标策展台',
  targetCatId: '目标节点',
  curOrder: '策展顺序',
  displayName: '显示名',
  addedAt: '加入时间',
  snapshot: '挂载时快照',
  folderId: '所属常用夹',
  definition: '收卡定义',
  type: '操作类型',
  entityType: '对象类型',
  entityId: '对象',
  timestamp: '时间',
  detail: '详情',
  weekly: '周统计',
  lastReuse: '最近使用',
  lastVisits: '本周访问',
  wrr: '累计唤醒',
  resource: '资源卡字段',
  task: '任务卡字段',
  curiosity: '好奇心卡字段',
  argument: '论证字段',
  size: '大小',
  mime: '文件类型',
  storagePath: '云端对象',
  checksum: '校验值',
  uploadState: '上传状态',
  uploadedAt: '上传时间',
  lastError: '最近错误',
  retryCount: '重试次数',
  ts: '时间',
  action: '动作',
  deviceId: '设备',
  to: '目标状态',
  theme: '主题',
  layout: '布局',
  sortPrefs: '排序偏好',
  cardCols: '卡片列数',
  capturePref: '采集偏好',
  vision: '愿景',
  mission: '使命',
}

export function syncTypeLabel(type: SyncManifestRecordType): string {
  return TYPE_LABEL[type] || '记录'
}

export function syncFieldLabel(field: string): string {
  return FIELD_LABEL[field] || field
}

export function syncGroupOf(type: SyncManifestRecordType): Exclude<SyncRecordGroup, 'all'> {
  if (type === 'resource' || type === 'task' || type === 'curiosity') return 'cards'
  if (type === 'workspace' || type === 'category' || type === 'argument' || type === 'attachment') return 'curation'
  if (type === 'direction' || type === 'project' || type === 'metric') return 'direction'
  if (type === 'dailyFocus') return 'dailyFocus'
  if (type === 'supportLink' || type === 'curationProjection' || type === 'resourceFolderMirror') return 'relations'
  if (type === 'resourceFolder') return 'cards'
  return 'system'
}

export function syncDirectionLabel(direction: CloudSyncDirection): string {
  if (direction === 'upload') return '上传到云端'
  if (direction === 'download') return '从云端拉回'
  if (direction === 'merge') return '合并同步到云端'
  return '已是最新'
}
