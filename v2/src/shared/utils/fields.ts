/**
 * 字段配置 → 视图渲染助手
 * 让「全局设置 · 卡片字段设计」的排序与显隐真正作用于策展台卡片/列表/看板三视图
 */
import type { FieldConfig, FieldDef, ResourceCard, TaskCard, CuriosityCard, AnyCard } from '@/shared/models'
import { assetSummary } from './assetKind'

/** 字段组类型（R62-3：thesis = 策展主题卡组） */
export type FieldGroupKind = 'resource' | 'task' | 'curiosity' | 'thesis'

/** 取某类卡片已启用（可见）的字段，按 order 排序 */
export function visibleFields(cfg: FieldConfig, type: FieldGroupKind): FieldDef[] {
  return (cfg[type] || [])
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order)
}

/** 取某类卡片的全部字段（含隐藏），按 order 排序 */
export function allFields(cfg: FieldConfig, type: FieldGroupKind): FieldDef[] {
  return [...(cfg[type] || [])].sort((a, b) => a.order - b.order)
}

/** R155-③：标题位字段（资源卡 title / 好奇卡 question）——卡面已有专属标题行 */
export function isTitleKey(key: string): boolean {
  return key === 'title' || key === 'question'
}

/** R155-③（用户拍板「启用字段保留 3 个」）：富卡卡面上额外铺开的字段上限。
 *  排除 title/question（标题位）、description（摘要位 2 行）、tags（页脚标签）、assets（页脚附件）——
 *  它们各有专属渲染位置，在卡面再重复一次只会挤掉摘要的行数。
 *  真实库（380 卡）默认字段配置下只命中 `link` 一项；上限 3 是用户自行打开更多字段时的边界，
 *  不是「每张卡都显示 3 个」。 */
export const CARD_EXTRA_FIELD_LIMIT = 3
const CARD_SLOT_KEYS = new Set(['title', 'question', 'description', 'tags', 'assets'])
export function cardExtraFields(fields: FieldDef[], limit = CARD_EXTRA_FIELD_LIMIT): FieldDef[] {
  return fields.filter(f => !CARD_SLOT_KEYS.has(f.key)).slice(0, limit)
}

/** 解析卡片任意字段的可展示文本值 */
/**
 * R112 性能：日期格式化缓存。
 * `new Date().toLocaleDateString('zh-CN')` 每次都要初始化 Intl 格式化器，
 * 而 val()/fieldValue 由卡面模板**逐卡逐字段**调用（400 卡一次重渲染 = 400 次 Intl 构造，
 * 搜索键入时同一批卡还会反复重渲染）。按时间戳缓存字符串，纯函数语义，无失效风险。
 */
const dateFmtCache = new Map<number, string>()
function fmtDateCN(ts: number): string {
  const hit = dateFmtCache.get(ts)
  if (hit !== undefined) return hit
  const s = new Date(ts).toLocaleDateString('zh-CN')
  if (dateFmtCache.size >= 4000) dateFmtCache.clear()
  dateFmtCache.set(ts, s)
  return s
}

export function fieldValue(
  card: AnyCard,
  key: string,
  ctx: { projectName?: (id?: string) => string; metricName?: (id?: string) => string; wsName?: (id: string) => string; catName?: (id: string) => string }
): string {
  const c = card as unknown as Record<string, unknown>
  if (key.startsWith('custom_')) {
    const v = card.customFields?.[key]
    return v == null ? '' : String(v)
  }
  switch (key) {
    case 'title': return String(c.title ?? '')
    case 'question': return String(c.question ?? '')
    case 'link': return String(c.link ?? '')
    case 'sourceUrl': return String(c.sourceUrl ?? '')
    case 'description': return String(c.description ?? '')
    case 'sourceType': return String(c.sourceType ?? '')
    case 'tags': return ((c.tags as string[]) || []).map(t => `#${t}`).join(' ')
    case 'projectId': return ctx.projectName ? ctx.projectName(c.projectId as string | undefined) : String(c.projectId ?? '')
    case 'metricId': return ctx.metricName ? ctx.metricName(c.metricId as string | undefined) : String(c.metricId ?? '')
    case 'priority': {
      const p = c.priority as string | undefined
      return p === 'high' ? '高优' : p === 'low' ? '低优' : p === 'medium' ? '中优' : ''
    }
    case 'status': {
      const s = String(c.status ?? '')
      const map: Record<string, string> = {
        todo: '待开始', doing: '进行中', done: '已完成',
        todo_c: '待探索'
      }
      if (card.kind === 'curiosity') {
        return ({ todo: '待探索', doing: '探索中', done: '已求证', shelf: '已搁置' } as Record<string, string>)[s] || s
      }
      return map[s] || s
    }
    case 'createdAt': return c.createdAt ? fmtDateCN(Number(c.createdAt)) : ''
    case 'assets':
      // 第卌轮 REQ-051：附件字段文本摘要（列表/CSV/预览兜底），如「2 图 · 1 PDF · 1 HTML」
      // R81（R15）：原实现 `htmls = list.length - imgs` 把 PDF 算进 HTML 档，改调共享 assetSummary
      return assetSummary(c.assets as Array<{ kind: 'image' | 'pdf' | 'html' }> | undefined)
    case 'workspaceId': return ctx.wsName ? ctx.wsName(String(c.workspaceId ?? '')) : ''
    case 'categoryId': return ctx.catName ? ctx.catName(String(c.categoryId ?? '')) : ''
    default: {
      const v = c[key]
      return v == null ? '' : String(v)
    }
  }
}

/** 字段值类型，用于视图决定渲染形态 */
export function fieldRenderKind(key: string, f?: FieldDef): 'title' | 'link' | 'tags' | 'date' | 'assets' | 'text' {
  if (key === 'title' || key === 'question') return 'title'
  if (key === 'link' || key === 'sourceUrl') return 'link'
  if (key === 'tags' || f?.type === 'tags') return 'tags'
  if (key === 'assets') return 'assets'
  if (key === 'createdAt' || f?.type === 'date') return 'date'
  return 'text'
}

export type { ResourceCard, TaskCard, CuriosityCard }
