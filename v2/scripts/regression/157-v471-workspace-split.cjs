/**
 * V4.7.1 · F6 策展台顶部双栏拖拽。
 *
 * 锁定：
 *   UIPrefs.wsConsoleSplit 默认 62 / 钳制 32–72；
 *   分隔条位于中心论点与全局功能之间，含完整 separator 语义；
 *   pointer 拖拽实时改 CSS 变量、键盘 ±2% 与 Home/End、双击复位；
 *   比例只在 pointerup / 键盘 / 复位时 saveUIPrefs，挂载时读取 store.ui；
 *   ≤900px 回上下堆叠并隐藏分隔条；只使用现有主题 token。
 */
const { check, read, segOf } = require('./helpers.cjs')

console.log('【V4.7.1 · 策展台双栏拖拽】')

const MODELS = read('/shared/models/index.ts')
const WS = read('/newtab/views/Workspace.vue')
const SPLIT = read('/newtab/composables/useWsConsoleSplit.ts')
const CSS = read('/newtab/views/workspace.css')

check('WSPLIT157-1 ★UIPrefs 新增 wsConsoleSplit 百分比字段，注释锁定默认 62 与 32–72 边界', () => {
  const ui = segOf(MODELS, 'export interface UIPrefs {', '// ============ 常量 ============')
  return ui.includes('wsConsoleSplit?: number')
    && ui.includes('32–72')
    && ui.includes('默认 62')
})

check('WSPLIT157-2 ★分隔条位于中心论点与全局功能之间，role/方向/三值/tabindex 齐全且容器绑定 CSS 变量', () => {
  const tpl = segOf(WS, '<div ref="consoleRef" class="ws-curation-console"', '<!-- ③ 行动条')
  const start = WS.indexOf('<div ref="consoleRef" class="ws-curation-console"')
  const banner = WS.indexOf('class="thesis-banner"', start)
  const split = WS.indexOf('class="ws-console-split"', start)
  const panel = WS.indexOf('<div class="cur-global-panel"', split)
  return tpl.includes(':style="consoleSplitStyle"')
    && banner >= 0 && split > banner && panel > split
    && tpl.includes('role="separator"')
    && tpl.includes('aria-orientation="vertical"')
    && tpl.includes(':aria-valuemin="WS_CONSOLE_SPLIT_MIN"')
    && tpl.includes(':aria-valuemax="WS_CONSOLE_SPLIT_MAX"')
    && tpl.includes(':aria-valuenow="wsConsoleSplit"')
    && tpl.includes('tabindex="0"')
    && tpl.includes('@pointerdown="startConsoleSplitDrag"')
    && tpl.includes('@pointermove="moveConsoleSplitDrag"')
    && tpl.includes('@pointerup="endConsoleSplitDrag"')
    && tpl.includes('@pointercancel="endConsoleSplitDrag"')
    && tpl.includes('@dblclick="resetConsoleSplit"')
    && tpl.includes('@keydown="onConsoleSplitKeydown"')
})

check('WSPLIT157-3（随迁）★比例常量 32/72/62 单源，钳制对非法值回落默认且四舍五入到整数百分比', () => {
  const clamp = segOf(SPLIT, 'function clampWsConsoleSplit', 'function readStoredConsoleSplit')
  return SPLIT.includes('const WS_CONSOLE_SPLIT_MIN = 32')
    && SPLIT.includes('const WS_CONSOLE_SPLIT_MAX = 72')
    && SPLIT.includes('const WS_CONSOLE_SPLIT_DEFAULT = 62')
    && clamp.includes('if (!Number.isFinite(value)) return WS_CONSOLE_SPLIT_DEFAULT')
    && clamp.includes('Math.min(WS_CONSOLE_SPLIT_MAX')
    && clamp.includes('Math.max(WS_CONSOLE_SPLIT_MIN')
    && clamp.includes('Math.round(value)')
})

check('WSPLIT157-4（随迁）★pointer 拖拽：捕获指针后按容器有效宽度实时换算，pointerup/cancel 释放并持久化', () => {
  const drag = segOf(SPLIT, 'function startConsoleSplitDrag', 'function stopConsoleSplitDrag')
  const setAt = drag.indexOf('wsConsoleSplit.value = clampWsConsoleSplit(')
  const persistAt = drag.indexOf('persistWsConsoleSplit()')
  return drag.includes('e.currentTarget as HTMLElement')
    && drag.includes('setPointerCapture')
    && drag.includes('releasePointerCapture')
    && drag.includes('getBoundingClientRect().width')
    && drag.includes('parseFloat(style.paddingLeft)')
    && drag.includes('pointerId !== consoleSplitDrag.pointerId')
    && drag.includes('delta / consoleSplitDrag.trackWidth')
    && setAt > 0 && persistAt > setAt
    && drag.includes("document.body.classList.add('ws-console-resizing')")
    && drag.includes("document.body.classList.remove('ws-console-resizing')")
})

check('WSPLIT157-5（随迁）★键盘：左右每次 ±2%，Home/End 到 32/72，阻止默认滚动并在调整后立即持久化', () => {
  const key = segOf(SPLIT, 'function onConsoleSplitKeydown', 'onDeactivated(stopConsoleSplitDrag)')
  const setAt = key.indexOf('wsConsoleSplit.value = clampWsConsoleSplit(next)')
  return key.includes("case 'ArrowLeft': next = wsConsoleSplit.value - 2")
    && key.includes("case 'ArrowRight': next = wsConsoleSplit.value + 2")
    && key.includes("case 'Home': next = WS_CONSOLE_SPLIT_MIN")
    && key.includes("case 'End': next = WS_CONSOLE_SPLIT_MAX")
    && key.includes('e.preventDefault()')
    && setAt > 0
    && key.indexOf('persistWsConsoleSplit()') > setAt
})

check('WSPLIT157-6（随迁）★双击分隔条复位 62% 并写盘；拖拽比例经 saveUIPrefs 记忆，挂载时读 store.ui', () => {
  const reset = segOf(SPLIT, 'function resetConsoleSplit', 'function onConsoleSplitKeydown')
  const persist = segOf(SPLIT, 'function persistWsConsoleSplit', 'function applyStoredConsoleSplit')
  const stored = segOf(SPLIT, 'function readStoredConsoleSplit', 'const consoleRef')
  const mounted = segOf(SPLIT, 'onMounted(() => {', 'onUnmounted')
  return reset.includes('wsConsoleSplit.value = WS_CONSOLE_SPLIT_DEFAULT')
    && reset.includes('persistWsConsoleSplit()')
    && persist.includes('saveUIPrefs({ wsConsoleSplit: wsConsoleSplit.value })')
    && stored.includes('store.ui?.wsConsoleSplit')
    && stored.includes('clampWsConsoleSplit(stored)')
    && mounted.includes('applyStoredConsoleSplit()')
})

check('WSPLIT157-7 ★控制台 grid 由 CSS 变量驱动：左 320 / 右 340 最小宽，并以 100%-352px 封顶避免溢出', () => {
  const consoleCss = segOf(CSS, '.ws-curation-console {', '.ws-curation-console .thesis-banner {')
  return consoleCss.includes('--ws-console-split: 62%')
    && consoleCss.includes('minmax(320px, min(var(--ws-console-split), calc(100% - 352px)))')
    && consoleCss.includes('12px')
    && consoleCss.includes('minmax(340px, 1fr)')
    && consoleCss.includes('column-gap: 0')
    && consoleCss.includes('row-gap: 9px')
})

check('WSPLIT157-8 ★分隔条 hover/focus 反馈只用现有 token（无硬编码新颜色），两栏 min-width:0 防内容撑破', () => {
  const splitCss = segOf(CSS, '/* ===== V4.7.1 F6：中心论点 / 全局功能双栏拖拽分隔条', '/* ===== V4.7.1 F6 end')
  return splitCss.includes('.ws-curation-console > .thesis-banner')
    && splitCss.includes('.ws-curation-console > .cur-global-panel { min-width: 0; }')
    && splitCss.includes('.ws-curation-console > .thesis-banner { overflow: hidden; }')
    && splitCss.includes('cursor: col-resize')
    && splitCss.includes('touch-action: none')
    && splitCss.includes('var(--border-strong)')
    && splitCss.includes('background: var(--accent)')
    && splitCss.includes('outline: var(--focus-ring)')
    && splitCss.includes('background: var(--accent-light)')
    && !/#[0-9a-f]{3,8}\b/i.test(splitCss)
    && !/\brgba?\(/i.test(splitCss)
    && !/\bhsla?\(/i.test(splitCss)
})

check('WSPLIT157-9 ★≤900px 回上下堆叠：单列覆盖比例、隐藏分隔条、保留 9px 行间距', () => {
  const mobile = segOf(CSS, '@media (max-width: 900px) {', '.cur-import-popover')
  return mobile.includes('.ws-curation-console { grid-template-columns: minmax(0, 1fr);')
    && mobile.includes('.ws-console-split { display: none; }')
    && !mobile.includes('var(--ws-console-split)')
})
