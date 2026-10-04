/**
 * R72-1：卡片视图横向列数（4 / 5 / 6 / 7 列，卡片宽度自适应）。
 *
 * 承载卡片网格的三个模块共用同一份口径——好奇心培育（cz-grid）/ 任务调度（tm-grid-inner）/
 * 资源卡池·策展台（card-grid、cur-grid）。偏好写入 `UIPrefs.cardCols[<模块键>]`，
 * 与 `density` / `sortPrefs` / `taHeights` 同为本地记忆（zy_ui_v2，不随数据同步）。
 *
 * 网格模板（R106-F3 起统一为**精确 N 列**）：
 *
 *   repeat(var(--grid-cols, N), minmax(0, 1fr))
 *
 * 语义 = 「选中 N 就渲染 N 列，卡片宽度自适应收缩」。R72 原公式
 * `auto-fill minmax(max(最小卡宽, (100%-(N-1)*gap)/N), 1fr)` 在恰好 N 列时因浏览器
 * 取整差一位（如 5.998 → 实渲染 N-1 列），6/7 列永远不生效（生产反馈）；
 * 应用户拍板（2026-09-12）废弃「放不下自动降列」，改为精确 N 列 + 卡片自适应收缩。
 */
import { computed } from 'vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import type { UIPrefs } from '@/shared/models'

/** 可选列数（需求指定 4 / 5 / 6 / 7） */
export const CARD_COL_OPTIONS = [4, 5, 6, 7] as const

/** 模块键：与 `UIPrefs.sortPrefs` 的键口径保持一致（curio / task / res） */
export type CardColsKey = 'curio' | 'task' | 'res'

/**
 * 各模块默认列数 = **改造前的等效列数**，保证升级后视觉零变化：
 * - `curio`（好奇心培育）改造前 `repeat(4, 1fr)` → 4
 * - `task`（任务调度）改造前 `auto-fill minmax(240px, 1fr)`，在方向台 1440px 页宽下 ≈ 5 → 5
 * - `res`（资源卡池 / 策展台）改造前 `auto-fill minmax(260px, 1fr)` 同口径 ≈ 5 → 5
 */
export const CARD_COLS_DEFAULT: Record<CardColsKey, number> = { curio: 4, task: 5, res: 6 }

/** 归一：仅接受 4/5/6/7，其余（含 undefined / NaN / 越界）一律回落该模块默认列数 */
function normalize(key: CardColsKey, v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return (CARD_COL_OPTIONS as readonly number[]).includes(n) ? n : CARD_COLS_DEFAULT[key]
}

/** 读取（非法值 / 未设置一律回落默认） */
export function readCardCols(ui: UIPrefs | undefined | null, key: CardColsKey): number {
  return normalize(key, ui?.cardCols?.[key])
}

/** 写入并持久化（同步更新内存态 ui 对象，避免同会话内读回旧值） */
export function writeCardCols(ui: UIPrefs | undefined | null, key: CardColsKey, cols: number): void {
  const next = { ...(ui?.cardCols || {}), [key]: normalize(key, cols) }
  if (ui) ui.cardCols = next
  saveUIPrefs({ cardCols: next })
}

/** 组合式：返回可直接 `v-model` 的列数（写入即持久化），与 Workspace 的 `density` 写法同构 */
export function useCardCols(key: CardColsKey, ui: UIPrefs | undefined | null) {
  return computed({
    get: () => readCardCols(ui, key),
    set: (v: number) => writeCardCols(ui, key, v)
  })
}

/**
 * R72-G7：归一化一份**外部来源**的列数映射（全量导入导出的界面偏好包 `uiPrefs.cardCols`）。
 * 只认已知模块键与 4/5/6/7 白名单，其余一律丢弃——导入物可能来自旧版或手工编辑，不可信。
 */
export function sanitizeCardCols(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return out
  const src = raw as Record<string, unknown>
  for (const key of Object.keys(CARD_COLS_DEFAULT) as CardColsKey[]) {
    const n = typeof src[key] === 'number' ? (src[key] as number) : Number(src[key])
    if ((CARD_COL_OPTIONS as readonly number[]).includes(n)) out[key] = n
  }
  return out
}
