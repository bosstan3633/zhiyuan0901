/**
 * 字段配置 → 视图渲染助手
 * 让「全局设置 · 卡片字段设计」的排序与显隐真正作用于工作台卡片/列表/看板三视图
 */
import type { FieldConfig, FieldDef, ResourceCard, TaskCard, CuriosityCard, AnyCard } from '@/shared/models'

/** 取某类卡片已启用（可见）的字段，按 order 排序 */
export function visibleFields(cfg: FieldConfig, type: 'resource' | 'task' | 'curiosity'): FieldDef[] {
  return (cfg[type] || [])
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order)
}

/** 取某类卡片的全部字段（含隐藏），按 order 排序 */
export function allFields(cfg: FieldConfig, type: 'resource' | 'task' | 'curiosity'): FieldDef[] {
  return [...(cfg[type] || [])].sort((a, b) => a.order - b.order)
}

/** 解析卡片任意字段的可展示文本值 */
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
    case 'createdAt': return c.createdAt ? new Date(Number(c.createdAt)).toLocaleDateString('zh-CN') : ''
    case 'assets': {
      // 第卌轮 REQ-051：附件字段文本摘要（列表/CSV/预览兜底），如「2 图 · 1 HTML」
      const list = (c.assets as Array<{ kind: 'image' | 'html' }> | undefined) || []
      const imgs = list.filter(a => a.kind === 'image').length
      const htmls = list.length - imgs
      const parts: string[] = []
      if (imgs) parts.push(`${imgs} 图`)
      if (htmls) parts.push(`${htmls} HTML`)
      return parts.join(' · ')
    }
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
