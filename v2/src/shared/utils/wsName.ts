/**
 * R129-B12：台名展示/回写的唯一口径。
 *
 * 数据约定：`Workspace.name` 里存的是「图标 + 空格 + 名称」（图标另存 `icon` 字段，两份都写）。
 * 此前全应用 24 处各自硬写 `name.replace(/^[^\s]+\s/, '')` 剥前缀——**无条件剥首段**，
 * 于是「清空图标」（`setWsIcon('')`）之后首词被永久吃掉：`💼 我的 项目` → `我的 项目` → `项目`。
 * 现收紧为「确有 icon、且 name 确实以该 icon 开头」才剥，其余一律原样返回。
 */
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
