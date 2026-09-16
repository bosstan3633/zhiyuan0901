/**
 * R117（04-61 B）：卡片定位与高亮的**唯一入口**（纯函数层）。
 *
 * 背景：定位能力此前散落在 **3 处生产端**各自实现
 *   - `CompassHome.locateRec`（今日入台/移出明细）
 *   - `GlobalSettings.openStatCard`（知源仪表盘「全部卡片明细」）
 *   - `GlobalPopups.openItem` / `runFlatLocator`（全局检索）
 * 且有 3 处消费端（`Workspace` 资源卡 / `TaskManagerPanel` 任务卡 / `CuriosityPanel` 好奇卡）。
 * 语义只到「切台 + 高亮」：统一前任务卡切向调度台 `/`，而它的消费者当时住在方向台
 * —— 跳过去不定位也不高亮（04-61 C1 把任务调度面板搬回调度台后，目标与宿主才重新对齐）。
 *
 * 统一后：
 *  - 路由目标由本函数一处计算（便于回归断言与排错）；
 *  - query 三件套：`hl` = 目标卡 id · `hk` = 卡类型短码（消费端按 kind **认领**，
 *    消除「调度台上任务卡与好奇卡两个 hl 消费者同页竞态」）· `cat` = 资源卡所在分类
 *    （用户要求「定位到卡片所在的具体位置」，而不只是切到台面）。
 */
import type { AppData } from '@/shared/models'

export type LocateKind = 'resource' | 'task' | 'curiosity'

export interface LocateTarget {
  path: string
  query: Record<string, string>
}

/** hk 短码：与三个消费端的约定（res / task / curio） */
export const LOCATE_HK: Record<LocateKind, string> = { resource: 'res', task: 'task', curiosity: 'curio' }

/**
 * 计算某张卡的定位目标。
 * @returns null = 该卡已不在库中（调用方应提示"已不在库"，而不是静默跳到台面）
 */
export function locateTargetOf(d: AppData, kind: LocateKind, id: string): LocateTarget | null {
  if (kind === 'resource') {
    const r = d.resources.find(x => x.id === id)
    if (!r) return null
    const query: Record<string, string> = { hl: id, hk: LOCATE_HK.resource }
    // 带上所在分类 → 消费端会先切到该分类再滚动（「定位到具体位置」）
    if (r.categoryId) query.cat = r.categoryId
    return { path: `/workspace/${r.workspaceId}`, query }
  }
  // R117：任务卡与好奇心卡的宿主都在调度台 `/`（任务调度与好奇心培育同页 tab）
  const exists = kind === 'task' ? d.tasks.some(t => t.id === id) : d.curiosities.some(c => c.id === id)
  if (!exists) return null
  return { path: '/', query: { hl: id, hk: LOCATE_HK[kind] } }
}

/** 从任意 kind 字符串归一为 LocateKind（旧调用方传的是 'resource'|'task'|'curiosity'|'ws'|'proj'） */
export function asLocateKind(kind: string): LocateKind | null {
  if (kind === 'resource' || kind === 'task' || kind === 'curiosity') return kind
  return null
}
