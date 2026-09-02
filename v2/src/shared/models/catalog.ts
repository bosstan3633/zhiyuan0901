/**
 * 字段目录单一来源（第卌轮 REQ-049）
 *
 * 「逻辑字段目录」：系统字段存在性与属性（类型/适用卡型/分类/锁定/图标）在此唯一声明。
 * - FieldConfig 分区数据（resource/task/curiosity）只管每卡型的 order/visible（显隐排序按型独立）；
 * - 本目录管「有哪些字段、属于哪几型、什么分类规则」——FieldEditor 常量推导、字段兜底注入、
 *   转卡公共字段清单、未来 CSV 动态列 全部以此为准。
 * - 性能红线（附件）：assets 只存 AssetMeta 引用，本体在 IndexedDB zy_assets，主 JSON 绝不存 base64。
 */
import type { FieldDef } from './index'

/** 卡型 */
export type CardKind = 'resource' | 'task' | 'curiosity'

export const CARD_KINDS: CardKind[] = ['resource', 'task', 'curiosity']

/** 目录字段分类（FieldEditor 徽章 + 可删性规则） */
export type FieldCat = 'required' | 'system' | 'auto' | 'optional'

/** 目录条目 = 系统字段属性声明（不含各型的 visible/order——那是分区数据的事） */
export interface CatalogField {
  key: string
  /** 兜底/新增时使用的默认标签（存量数据沿用各分区已有 label） */
  label: string
  type: FieldDef['type']
  /** base=跨型公共 / type=型专属 */
  scope: 'base' | 'type'
  /** 适用卡型（可多型；同 key 不同配置的字段可拆多行） */
  kinds: CardKind[]
  /** 分类：required 必填 / system 系统（不可删）/ auto 自动（不可删）/ optional 可选 */
  cat: FieldCat
  /** 锁定（不可显隐/拖拽/删除，如标题） */
  locked?: boolean
  /** 视图/编辑器图标 */
  icon?: string
  options?: string[]
}

/** 系统字段目录（唯一声明处；自定义字段 key 以 custom_ 开头，不在此列） */
export const FIELD_CATALOG: CatalogField[] = [
  // ===== base · 跨型公共 =====
  { key: 'assets', label: '附件', type: 'text', scope: 'base', kinds: ['resource', 'task', 'curiosity'], cat: 'system', icon: '📎' },
  { key: 'description', label: '描述', type: 'text', scope: 'base', kinds: ['resource', 'task'], cat: 'optional', icon: '📄' },
  { key: 'tags', label: '标签', type: 'tags', scope: 'base', kinds: ['resource', 'task', 'curiosity'], cat: 'system', icon: '#' },
  { key: 'createdAt', label: '创建时间', type: 'date', scope: 'base', kinds: ['resource', 'task', 'curiosity'], cat: 'auto', icon: '🕐' },
  // ===== type · 资源卡 =====
  { key: 'title', label: '标题', type: 'text', scope: 'type', kinds: ['resource'], cat: 'required', locked: true, icon: '📝' },
  { key: 'link', label: '链接', type: 'text', scope: 'type', kinds: ['resource'], cat: 'required', icon: '🔗' },
  { key: 'sourceType', label: '来源类型', type: 'select', options: ['官方', '学术', '媒体', '个人', 'AI工具', '个人成果'], scope: 'type', kinds: ['resource'], cat: 'system', icon: '🏷' },
  // ===== type · 任务卡 =====
  { key: 'title', label: '任务名', type: 'text', scope: 'type', kinds: ['task'], cat: 'required', locked: true, icon: '📝' },
  { key: 'projectId', label: '所属项目', type: 'text', scope: 'type', kinds: ['task'], cat: 'system', icon: '📦' },
  { key: 'metricId', label: '成功指标', type: 'text', scope: 'type', kinds: ['task'], cat: 'system', icon: '🎯' },
  { key: 'priority', label: '优先级', type: 'select', options: ['高', '中', '低'], scope: 'type', kinds: ['task'], cat: 'optional', icon: '🔴' },
  { key: 'dueDate', label: '截止时间', type: 'date', scope: 'type', kinds: ['task'], cat: 'optional', icon: '📅' },
  { key: 'status', label: '状态', type: 'select', options: ['待办', '进行中', '已完成'], scope: 'type', kinds: ['task'], cat: 'system', icon: '🔄' },
  // ===== type · 好奇心卡 =====
  { key: 'question', label: '问题', type: 'text', scope: 'type', kinds: ['curiosity'], cat: 'required', locked: true, icon: '❓' },
  { key: 'sourceUrl', label: '来源链接', type: 'text', scope: 'type', kinds: ['curiosity'], cat: 'optional', icon: '🔗' },
  { key: 'status', label: '状态', type: 'select', options: ['待探索', '探索中', '已求证', '已搁置'], scope: 'type', kinds: ['curiosity'], cat: 'system', icon: '🔄' }
]

/** 取某卡型的目录条目（含 base + type） */
export function catalogFor(kind: CardKind): CatalogField[] {
  return FIELD_CATALOG.filter(f => f.kinds.includes(kind))
}

/** 取某卡型下某 key 的目录元信息（custom_* 与未收录 key 返回 undefined） */
export function catalogMeta(kind: CardKind, key: string): CatalogField | undefined {
  return FIELD_CATALOG.find(f => f.kinds.includes(kind) && f.key === key)
}
