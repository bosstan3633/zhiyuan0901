/**
 * 默认数据工厂 · 首次安装时初始化
 */
import type { AppData, FieldDef } from '@/shared/models'
import { uid } from '@/shared/utils'

function defaultFieldDefs() {
  const resource: FieldDef[] = [
    { key: 'title', label: '标题', type: 'text', visible: true, order: 0 },
    { key: 'link', label: '链接', type: 'text', visible: true, order: 1 },
    { key: 'description', label: '描述', type: 'text', visible: true, order: 2 },
    { key: 'sourceType', label: '来源类型', type: 'select', options: ['官方', '学术', '媒体', '个人', 'AI工具', '个人成果'], visible: false, order: 3 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 4 },
    { key: 'createdAt', label: '创建时间', type: 'date', visible: false, order: 5 }
  ]
  const task: FieldDef[] = [
    { key: 'title', label: '任务名', type: 'text', visible: true, order: 0 },
    { key: 'projectId', label: '所属项目', type: 'text', visible: true, order: 1 },
    { key: 'metricId', label: '成功指标', type: 'text', visible: true, order: 2 },
    { key: 'priority', label: '优先级', type: 'select', options: ['高', '中', '低'], visible: true, order: 3 },
    { key: 'dueDate', label: '截止时间', type: 'date', visible: true, order: 4 },
    { key: 'status', label: '状态', type: 'select', options: ['待办', '进行中', '已完成'], visible: false, order: 5 },
    { key: 'description', label: '描述', type: 'text', visible: false, order: 6 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 7 }
  ]
  const curiosity: FieldDef[] = [
    { key: 'question', label: '问题', type: 'text', visible: true, order: 0 },
    { key: 'sourceUrl', label: '来源链接', type: 'text', visible: false, order: 1 },
    { key: 'status', label: '状态', type: 'select', options: ['待探索', '探索中', '已求证', '已搁置'], visible: true, order: 2 },
    { key: 'createdAt', label: '创建时间', type: 'date', visible: false, order: 3 },
    { key: 'tags', label: '标签', type: 'tags', visible: false, order: 4 }
  ]
  return { resource, task, curiosity }
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
      vision: { content: '', pinnedToLighthouse: false, updatedAt: 0 },
      mission: { content: '', pinnedToLighthouse: false, updatedAt: 0 },
      directions: []
    },
    workspaces: [
      { id: wsBiz, name: '事业工作台', icon: '💼', color: '#3A6B4C', coverTheme: 'deep-sea', desc: '', order: 0, archived: false },
      { id: wsTools, name: '工具工作台', icon: '🛠', color: '#4A7FB5', coverTheme: 'deep-sea', desc: '', order: 1, archived: false }
    ],
    categories: [
      { id: catProduct, workspaceId: wsBiz, name: '产品设计', order: 0 },
      { id: catAI, workspaceId: wsBiz, name: 'AI技术', order: 1 },
      { id: catTools, workspaceId: wsTools, name: '效率工具', order: 0 }
    ],
    resources: [],
    tasks: [],
    curiosities: [],
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
