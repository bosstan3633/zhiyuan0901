/**
 * 卡片转换统一引擎（第卌轮 REQ-050 转卡无损化）
 *
 * 拍板约束：转卡**单向唯一**——只有好奇心卡 → 任务卡 / 资源卡；
 * 任务/资源永不退化回好奇心，界面不设任务/资源转出入口。
 *
 * 无损规则：
 * 1. 公共字段全搬：tags / pinned / starred / assets(AssetMeta 引用拷贝，IndexedDB Blob 零变动)
 *    / customFields(整对象搬移，键跨型唯一因此 label 有效) / createdAt(保留捕获时间)；
 * 2. 状态显式映射：好奇四态 → 任务三态（shelf 已搁置 → todo 待开始，由宿主 Toast 提示）；
 * 3. 资源卡无 status 概念，不做状态映射；link 回填 c.sourceUrl，sourceType 无对应不搬；
 * 4. 溯源：任务卡 fromCuriosityId=[源卡 id] + link 回填 sourceUrl（R165：卡间挂载退役，不做互持引用）；
 * 5. 源卡软删（deletedAt）由调用方执行；本模块保持纯函数（不触碰 store / storage）。
 */
import type { CuriosityCard, ResourceCard, TaskCard, ID } from '@/shared/models'
import { uid } from '@/shared/utils'

/** 好奇四态 → 任务三态 显式映射（shelf 搁置语义弱化为 todo，宿主需 Toast 提示） */
export const CURIOSITY_TO_TASK_STATUS: Record<CuriosityCard['status'], TaskCard['status']> = {
  todo: 'todo',
  doing: 'doing',
  done: 'done',
  shelf: 'todo'
}

export type ConvertTarget =
  | { kind: 'task'; projectId?: ID; metricId?: ID }
  | { kind: 'resource'; workspaceId: ID; categoryId?: ID }

export type ConvertedCard = TaskCard | ResourceCard

/** 好奇心卡 → 目标卡（构建新卡；公共字段无损搬运）。重载：返回类型随 target.kind 精确收窄 */
export function convertCard(c: CuriosityCard, target: { kind: 'task'; projectId?: ID; metricId?: ID }): TaskCard
export function convertCard(c: CuriosityCard, target: { kind: 'resource'; workspaceId: ID; categoryId?: ID }): ResourceCard
export function convertCard(c: CuriosityCard, target: ConvertTarget): ConvertedCard {
  const now = Date.now()
  const common = {
    tags: c.tags ? [...c.tags] : [],
    pinned: c.pinned,
    starred: c.starred,
    assets: c.assets && c.assets.length ? [...c.assets] : undefined,
    customFields: { ...(c.customFields || {}) },
    createdAt: c.createdAt || now,
    updatedAt: now
  }
  if (target.kind === 'task') {
    const card: TaskCard = {
      id: uid('tk'),
      kind: 'task',
      title: c.question,
      description: c.description,
      status: CURIOSITY_TO_TASK_STATUS[c.status],
      priority: 'medium',
      projectId: target.projectId,
      metricId: target.metricId,
      fromCuriosityId: c.id,
      ...common
    }
    return card
  }
  const card: ResourceCard = {
    id: uid('rc'),
    kind: 'resource',
    title: c.question,
    linkType: 'url',
    link: c.sourceUrl || '',
    description: c.description,
    workspaceId: target.workspaceId,
    categoryId: target.categoryId || '',
    callCount: 0,
    fromCuriosityId: c.id,
    ...common
  }
  return card
}

/** 源卡 → 目标型的自定义字段是否缺失 def（label 取自源卡所在 fieldConfig 分区的 def） */
export function missingCustomDefs(
  sourceFields: { key: string; label: string; type: string; options?: string[] }[],
  targetFields: string[]
): { key: string; label: string; type: 'text'; options?: string[] }[] {
  const has = new Set(targetFields)
  return sourceFields
    .filter(f => f.key.startsWith('custom_') && !has.has(f.key))
    .map(f => ({ key: f.key, label: f.label || '自定义', type: 'text' as const, ...(f.options ? { options: f.options } : {}) }))
}
