/**
 * R84（W2-②）：资源台 / 策展台的**视图模式偏好**（按台记忆）。
 *
 * 与 `shared/utils/cardCols.ts` 完全同构——读 / 写 / 归一 / 导入 sanitize 四件套，
 * 偏好写入 `UIPrefs.wsViewMode[<台 id>]`，与 `cardCols` / `sortPrefs` / `taHeights`
 * 同为本地记忆（zy_ui_v2，不进主数据、不随数据同步）。
 *
 * ⚠ **不要复用 `UIPrefs.viewMode`**（`models/index.ts:419`）——它是个死字段：
 * 全代码库零读取零写入，且是**全局**的（不按台），类型里也没有 `'pyramid'`。
 * 本文件的 `wsViewMode` 按**台 id** 记忆，是另一回事。
 *
 * 默认值不在本文件定：无偏好时由调用方按 `thesisCard ? 'pyramid' : 'card'` 决定
 * （W2-②：已设中心论点 ⇒ 默认进金字塔视图）。
 */
import { saveUIPrefs } from '@/shared/storage/repository'
import type { UIPrefs } from '@/shared/models'

/** 四种视图（与 Workspace.vue 的 view-tab 一一对应） */
export const WS_VIEW_MODES = ['card', 'list', 'kanban', 'pyramid'] as const

export type WsViewMode = typeof WS_VIEW_MODES[number]

/** 归一：仅接受四值，其余（含 undefined / NaN / 未知串）一律返回 null（= 无偏好，走默认逻辑） */
function normalize(v: unknown): WsViewMode | null {
  return (WS_VIEW_MODES as readonly string[]).includes(String(v)) ? (v as WsViewMode) : null
}

/** 读取：无偏好 / 非法值 → null（调用方据此回落到默认视图） */
export function readWsView(ui: UIPrefs | undefined | null, wsId: string): WsViewMode | null {
  if (!wsId) return null
  return normalize(ui?.wsViewMode?.[wsId])
}

/** 写入并持久化（同步更新内存态 ui 对象，避免同会话内读回旧值——与 writeCardCols 同款） */
export function writeWsView(ui: UIPrefs | undefined | null, wsId: string, mode: WsViewMode): void {
  if (!wsId) return
  const m = normalize(mode)
  if (!m) return
  const next = { ...(ui?.wsViewMode || {}), [wsId]: m }
  if (ui) ui.wsViewMode = next
  saveUIPrefs({ wsViewMode: next })
}

/**
 * R84-G7 同款：归一化一份**外部来源**的视图偏好（全量导入导出的界面偏好包 `uiPrefs.wsViewMode`）。
 * 只认四值白名单，其余一律丢弃——导入物可能来自旧版或手工编辑，不可信。
 */
export function sanitizeWsView(raw: unknown): Record<string, WsViewMode> {
  const out: Record<string, WsViewMode> = {}
  if (!raw || typeof raw !== 'object') return out
  const src = raw as Record<string, unknown>
  for (const k of Object.keys(src)) {
    const m = normalize(src[k])
    if (m) out[k] = m
  }
  return out
}
