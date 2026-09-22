/**
 * 主题解析（R156 新建）
 *
 * 背景：R156 起主题切换新增 **「跟随系统」**（用户拍板）。设计上不引入 `[data-theme='auto']`
 * 这一层 CSS —— 而是把 `auto` 在**应用前解析**成具体主题写进 `data-theme`：
 *   ① tokens.css 只需维护四套真实主题块，不必为 auto 写第五套（含 prefers-color-scheme 媒体查询）
 *   ② 任何读 `documentElement.dataset.theme` 的地方（截图走查 / E2E / 调试）拿到的都是**确定值**
 *   ③ `ui.theme` 仍保存用户原选择（`'auto'`），UI 的选中态与"实际生效主题"由此解耦
 *
 * 映射：系统深色 → `linear`（默认暗主题）· 系统浅色 → `apple`（默认浅主题）。
 */

export const THEME_IDS = ['auto', 'linear', 'raycast', 'apple', 'notion'] as const

export type ThemeId = (typeof THEME_IDS)[number]
/** 真正落到 `data-theme` 的四个主题 */
export type ResolvedTheme = 'linear' | 'raycast' | 'apple' | 'notion'

const SYSTEM_DARK: ResolvedTheme = 'linear'
const SYSTEM_LIGHT: ResolvedTheme = 'apple'

function prefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

/** 把用户选择（可能含 `auto`）解析为四主题之一；非法值回落 `linear` */
export function resolveTheme(t: string | undefined): ResolvedTheme {
  if (t === 'auto') return prefersDark() ? SYSTEM_DARK : SYSTEM_LIGHT
  return t === 'raycast' || t === 'apple' || t === 'notion' ? t : 'linear'
}

/**
 * 订阅系统配色变化（只有 `auto` 模式需要），返回取消函数。
 * 宿主不支持 matchMedia 时返回空操作，保证调用方无需判空。
 */
export function watchSystemTheme(cb: (t: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => cb(mq.matches ? SYSTEM_DARK : SYSTEM_LIGHT)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
