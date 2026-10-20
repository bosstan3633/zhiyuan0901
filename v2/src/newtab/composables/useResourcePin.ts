/**
 * ★W17-C07（2026-10-20 用户拍板）资源卡置顶的唯一实现。
 *
 * 病根：置顶能力早已生效（`poolCards` 排序按 `pinned` 降序），但**入口只有右键菜单**——
 * 列表行末的图钉是纯展示 `<span>`，网格卡片里连图钉都没给动作，详情抽屉头部只有一行
 * 「置顶 · 星标」文字。用户原话：「置顶后排序排在前面，需要有置顶功能的入口，取消置顶和置顶的按键」。
 *
 * 纪律：
 *   ① 三处入口（列表行末 / 网格卡片 / 详情抽屉头部）+ 右键菜单共用本函数，不许各写一套取反逻辑；
 *   ② 抽屉的 `editing` 是源卡**深拷贝**，`save()` 会用整份 `editing` 覆盖库内记录 ——
 *      只改库内对象不同步 `editing.pinned`，用户随后点「保存」会把置顶状态覆盖回去。
 *      故本函数同时更新库内记录与传入的编辑草稿（若给了 draft）。
 */
import type { ResourceCard } from '@/shared/models'

type PinTarget = Pick<ResourceCard, 'id' | 'pinned' | 'updatedAt'>

export interface TogglePinCtx {
  /** 库内源卡（唯一写入对象） */
  card: PinTarget
  /** 可选：抽屉里那份深拷贝草稿 —— 传了就同步，防保存时覆盖 */
  draft?: Pick<ResourceCard, 'pinned'> | null
  persist: () => void
}

export interface TogglePinResult {
  pinned: boolean
  label: string
}

/** 取反 + 刷新 updatedAt + 两处同改，返回新状态与提示文案（文案单一真源） */
export function togglePinOf(ctx: TogglePinCtx): TogglePinResult {
  const next = !ctx.card.pinned
  ctx.card.pinned = next
  ctx.card.updatedAt = Date.now()
  if (ctx.draft) ctx.draft.pinned = next
  ctx.persist()
  return { pinned: next, label: next ? '已置顶，点击取消' : '置顶' }
}
