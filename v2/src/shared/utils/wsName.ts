/**
 * R129-B12：台名展示/回写的唯一口径。
 *
 * 数据约定：`Workspace.name` 里存的是「图标 + 空格 + 名称」（图标另存 `icon` 字段，两份都写）。
 * 此前全应用 24 处各自硬写 `name.replace(/^[^\s]+\s/, '')` 剥前缀——**无条件剥首段**，
 * 于是「清空图标」（`setWsIcon('')`）之后首词被永久吃掉：`💼 我的 项目` → `我的 项目` → `项目`。
 * 现收紧为「确有 icon、且 name 确实以该 icon 开头」才剥，其余一律原样返回。
 */
import { CURATION_WS_ID } from '@/shared/models'
export function wsDisplayNameOf(ws?: { name?: string; icon?: string } | null): string {
  const name = ws?.name || ''
  const icon = ws?.icon || ''
  if (!icon) return name
  return name.startsWith(icon + ' ') ? name.slice(icon.length + 1) : name
}

/** 回写 name（保持「icon + 空格 + 名称」约定）；icon 为空时不留前导空格 */
export function wsNameWithIcon(icon: string | undefined, displayName: string): string {
  return icon ? `${icon} ${displayName}` : displayName
}

/** 资源卡池的展示名：它不是一个策展台，是一枚隐藏池（id 恒 CURATION_WS_ID） */
export const POOL_DISPLAY_NAME = '资源卡池'

/**
 * R4-Dg：`workspaceId → 展示名` 的唯一口径。
 * 必须先按 id 判池，再去取实体名：存量库里那枚 `id=CURATION_WS_ID` 的 workspace 实体是 R61 迁移留下的
 * （名「资源台」，store 的 workspaces getter 已把它过滤，但原始数组还在），照实体名显示＝把用户指向已退役的台面；
 * 而 `defaults.ts` 新建库根本没有那枚实体，照实体查＝显示「未知」。
 * 查不到返回空串，由调用方保留自己的兜底文案。
 */
export function wsNameById(
  workspaces: { id: string; name?: string; icon?: string }[] | undefined | null,
  id: string | undefined | null
): string {
  if (id === CURATION_WS_ID) return POOL_DISPLAY_NAME
  return wsDisplayNameOf((workspaces || []).find(w => w.id === id))
}

