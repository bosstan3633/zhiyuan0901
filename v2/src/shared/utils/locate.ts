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
import { CURATION_WS_ID } from '@/shared/models'

export type LocateKind = 'resource' | 'task' | 'curiosity'

export interface LocateTarget {
  path: string
  query: Record<string, string>
}

/** hk 短码：与三个消费端的约定（res / task / curio） */
export const LOCATE_HK: Record<LocateKind, string> = { resource: 'res', task: 'task', curiosity: 'curio' }

/**
 * ★R4-E 资源卡定位落点的唯一判据：**池卡不属于任何策展台**。
 * V3.7.0（R179）把资源卡真身统一收进隐藏池 `zy-curation`，而池**不是一枚 workspace 实体**——
 * `stores/app.ts` 的 workspaces getter 显式过滤掉它，`defaults.ts` 新建库也不含它。
 * 于是 `/workspace/zy-curation` 自 R179 起恒落 Workspace.vue 的「策展台不存在」死页。
 * R2-④ 当年把四处深链逐个改靶成 `/?hl&hk=res`，但**漏了这个共享算式本身**，
 * 结果凡是走这里的调用点（仪表盘明细 / 今日入台明细 / 钻取抽屉附件行 / 采集后按 Enter）
 * 对池卡仍然跳死页。修在算式里，一次修完所有调用点。
 */
export function resourceLocateRoute(workspaceId: string, categoryId = ''): LocateTarget {
  const query: Record<string, string> = { hk: LOCATE_HK.resource }
  if (categoryId) query.cat = categoryId
  return workspaceId === CURATION_WS_ID
    ? { path: '/deck/resource', query }
    : { path: `/workspace/${workspaceId}`, query }
}

/**
 * 计算某张卡的定位目标。
 * @returns null = 该卡已不在库中（调用方应提示"已不在库"，而不是静默跳到台面）
 */
export function locateTargetOf(d: AppData, kind: LocateKind, id: string): LocateTarget | null {
  if (kind === 'resource') {
    const r = d.resources.find(x => x.id === id)
    if (!r) return null
    // 带上所在分类 → 消费端会先切到该分类再滚动（「定位到具体位置」）；池卡由 resourceLocateRoute 改靶调度台
    const t = resourceLocateRoute(r.workspaceId, r.categoryId)
    return { path: t.path, query: { hl: id, ...t.query } }
  }
  // V3.9.1：任务卡与好奇心卡的「查看全部」已是独立二级页，定位直接落对应列表。
  const exists = kind === 'task' ? d.tasks.some(t => t.id === id) : d.curiosities.some(c => c.id === id)
  if (!exists) return null
  return { path: kind === 'task' ? '/deck/task' : '/deck/curiosity', query: { hl: id, hk: LOCATE_HK[kind] } }
}

/** 从任意 kind 字符串归一为 LocateKind（旧调用方传的是 'resource'|'task'|'curiosity'|'ws'|'proj'） */
export function asLocateKind(kind: string): LocateKind | null {
  if (kind === 'resource' || kind === 'task' || kind === 'curiosity') return kind
  return null
}
