/**
 * V4.4.0 主题契约：只保留三套正式主题。
 *
 * - raycast = 光速黑
 * - notion  = 纸墨白
 * - apple   = 极简白
 *
 * 旧版 auto / linear 不再出现在选择器中；读取旧偏好时做确定性迁移：
 * auto → 系统深色 raycast / 浅色 apple；linear → raycast。
 */

export const THEME_IDS = ['raycast', 'apple', 'notion'] as const

export type ThemeId = (typeof THEME_IDS)[number]
export type ResolvedTheme = ThemeId

const SYSTEM_DARK: ResolvedTheme = 'raycast'
const SYSTEM_LIGHT: ResolvedTheme = 'apple'

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

/** 把旧偏好或任意字符串解析为三主题之一；非法值回落光速黑。 */
export function resolveTheme(t: string | undefined): ResolvedTheme {
  if (t === 'auto') return prefersDark() ? SYSTEM_DARK : SYSTEM_LIGHT
  if (t === 'linear') return 'raycast'
  return t === 'raycast' || t === 'apple' || t === 'notion' ? t : 'raycast'
}
