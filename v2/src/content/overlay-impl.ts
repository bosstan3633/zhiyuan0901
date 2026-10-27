/**
 * Content Script · 全局浮层（搜索 / 快速采集资源卡 / 采集好奇心）· 宿主 + 壳层
 *
 * 注入到所有 http/https 网页，纯 Vanilla JS，不引入 Vue 运行时。
 * V3.9.23 结构优化：原 1,597 行单文件按职责拆为四段（本文件为宿主 + 壳层，仍是动态 import 的唯一入口）——
 *   · overlay-impl.ts    壳层：样式注入 / 主题强调色 / 根容器 / 浮层开合 / Esc 收口 / Toast / 回执态机
 *   · overlay-search.ts  搜索：数据缓存 + 全局搜索浮层 + 今日三件事写入
 *   · overlay-capture.ts 采集：资源卡 / 任务 / 好奇心三种采集面板
 *   · overlay-query.ts   纯函数：查询解析 / 关联 Map / 定位路由 / 工具函数
 * 对外仍只导出 openSearch / openCapture / openCuriosity / openTaskCapture。
 */
import { K } from '@/shared/storage/keys'
import { overlayStyleText } from './overlay-styles'
import { openSearch, resetSearchAndRerun, cancelPendingReplace } from './overlay-search'
import { openCapture, openCuriosity, openTaskCapture } from './overlay-capture'

const ROOT_ID = '__zy_global_overlay__'
/**
 * R114-59：fire-and-forget 路由消息收敛点（替换 11 处空 catch——R114-59 清零护栏）。
 * 双通道吞错：try/catch 兜「Extension context invalidated」同步抛（SW 更新/休眠中）；
 * .catch 兜 MV3 Promise 拒绝（接收端不存在）。跳转类消息丢失可安全忽略——用户重试即可。
 */
function safeSend(msg: Record<string, unknown>): void {
  try {
    const p = chrome.runtime.sendMessage(msg) as unknown as Promise<void> | undefined
    if (p && typeof p.catch === 'function') p.catch(() => { /* 接收端不存在，丢弃 */ })
  } catch { /* 扩展上下文失效（SW 更新中），同步抛出同样可安全丢弃 */ }
}

function uid(prefix: string) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
}
// ============ 样式注入（V3.8.42 P0-4：174 行样式本体已搬至 overlay-styles.ts） ============
function injectStyles() {
  if (document.getElementById('__zy_styles__')) return
  const s = document.createElement('style')
  s.id = '__zy_styles__'
  s.textContent = overlayStyleText(ROOT_ID)
  document.documentElement.appendChild(s)
}
// ============ R77（A1）：主题强调色注入 ============
/**
 * R77（A1）：四套主题的强调色——与 `shared/styles/tokens.css` 的 `[data-theme='*'] --accent` 一一对应。
 * 浮层运行在宿主文档，取不到新标签页的 tokens.css，故在此维护映射并由 JS 注入 CSS 变量。
 * ⚠ 回归断言 R77-3 锁定本表与 tokens.css 一致，改任一侧都必须同步另一侧。
 * `on` = 主按钮文字色：全部取白字，四主题对比度均 ≥4.5:1（linear 4.70 / raycast 4.85 /
 *   apple 4.92 / notion 5.55，由 `scripts/theme-contrast.cjs` 常驻校验）。
 */
const THEME_ACCENT: Record<string, { accent: string; on: string }> = {
  /* R156：accent 解禁——四主题各自独立（R124~R155 期间四者同为 #5E6AD2） */
  linear: { accent: '#5E6AD2', on: '#FFFFFF' },
  raycast: { accent: '#1E6FD9', on: '#FFFFFF' },
  apple: { accent: '#8452E0', on: '#FFFFFF' },
  notion: { accent: '#9E3FAF', on: '#FFFFFF' }
}
/** 读取知源当前主题并注入强调色；宿主环境不可读 storage 时回落默认主题 linear */
async function applyThemeAccent() {
  const root = document.getElementById(ROOT_ID)
  if (!root) return
  let theme = 'linear'
  try {
    const r = await chrome.storage.local.get(K.UI)
    let t = (r?.zy_ui_v2 as { theme?: string } | undefined)?.theme
    // R156：'auto'（跟随系统）在浮层里按宿主环境 prefers-color-scheme 解析——浮层运行在宿主文档，
    // 不共享新标签页的 data-theme，故此处独立判一次；映射与 shared/utils/theme.ts 保持一致（暗→linear / 浅→apple）
    if (t === 'auto') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'linear' : 'apple'
    if (t && THEME_ACCENT[t]) theme = t
  } catch { /* 无 storage 权限或尚未初始化：回落默认主题 */ }
  const c = THEME_ACCENT[theme] || THEME_ACCENT.linear!
  root.style.setProperty('--zy-accent', c.accent)
  root.style.setProperty('--zy-on-accent', c.on)
}

// ============ 根容器 ============
function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = ROOT_ID
    document.documentElement.appendChild(root)
  }
  return root
}

/**
 * R92（D1）：浮层唤起后的聚焦 —— **统一入口，不再 setTimeout(…, 50)**。
 *
 * 原实现四处各写一遍 `setTimeout(() => el.focus(), 50)`，本意是等面板入场动画，
 * 代价是"唤起后立刻打字"的前几个字符会丢（焦点还没落到输入框，按键被宿主页面吃掉）。
 * 面板此时已在 DOM 中（`root.appendChild(panel)` 先于本调用，且 `.open` 已置），
 * 同步 `focus()` 即可生效。
 *
 * 仍留一帧兜底：宿主页面若在同步阶段抢回焦点，下一帧再争一次（rAF ≈16ms，远小于原 50ms）。
 * 正常情况下兜底不触发（判 `document.activeElement !== el`，不是无条件重复 focus）。
 *
 * @param select 聚焦后全选（资源卡采集：标题预填了 document.title，全选便于直接改写）
 * @param toEnd  聚焦后把光标移到末尾（好奇心采集：无选区时文本已预填，接着写更顺手）
 */
function focusWhenReady(el: HTMLElement | null, opts?: { select?: boolean; toEnd?: boolean }) {
  if (!el) return
  const doFocus = () => {
    el.focus()
    if (opts?.select && typeof (el as HTMLInputElement).select === 'function') (el as HTMLInputElement).select()
    if (opts?.toEnd && typeof (el as HTMLTextAreaElement).setSelectionRange === 'function') {
      const n = (el as HTMLTextAreaElement).value.length
      ;(el as HTMLTextAreaElement).setSelectionRange(n, n)
    }
  }
  doFocus()
  requestAnimationFrame(() => { if (document.activeElement !== el) doFocus() })
}

/** 打开浮层：center=居中搜索；corner=右上角采集小窗 */
function openOverlay(mode: 'center' | 'corner', onScrimClick?: () => void) {
  injectStyles() // V2.21：样式注入收敛到真正渲染浮层时（幂等），页面加载期不再触碰 DOM
  clearSavedState() // R78（A3）：新浮层一开，上一次的保存回执态（含 Enter 打开看板）即作废
  const root = ensureRoot()
  void applyThemeAccent() // R77（A1）：强调色取知源当前主题（异步读 storage，不阻塞渲染）
  root.className = mode === 'center' ? 'center open' : 'corner open'
  root.innerHTML = ''
  // R97（D5）：document 级 Esc 兜底（capture）——同名引用重复注册被 addEventListener 去重，重复 open 安全
  document.addEventListener('keydown', onDocEsc, true)
  if (onScrimClick) {
    const scrim = document.createElement('div')
    scrim.className = 'zy-scrim'
    scrim.addEventListener('click', onScrimClick)
    root.appendChild(scrim)
  }
}
function closeOverlay() {
  const root = document.getElementById(ROOT_ID)
  if (root) {
    root.classList.remove('open', 'center', 'corner')
    root.innerHTML = ''
    savedOpenBoard = null      // R78（A3）：浮层已销毁 → 回执期内的「打开看板」动作同步失效
    cancelPendingReplace()     // R78（A7）：两段式替换的中间态随浮层关闭作废
    document.removeEventListener('keydown', onSavedKeydown, true)
    document.removeEventListener('keydown', onDocEsc, true) // R97（D5）
    activeTcSave = null  // R70：面板已销毁 → 保存回调失效（onTcKeydown 为模块级常驻，无需反复解绑）
  }
}

/**
 * R97（D5）：document 级 Esc 兜底——此前全浮层只有两处 Esc：搜索输入框（R92 D2 两段式，挂在
 * 输入框元素上）与已保存回执（onSavedKeydown）。⇒ 焦点一离开输入框（点过结果区/表单背景）Esc 即失效；
 * corner 表单（资源/好奇/任务采集）则从来没有 Esc。统一收口到 document capture：
 * - 已保存回执态：让位 onSavedKeydown（它自带两段语义）；
 * - 搜索面板且焦点在输入框：让位输入框自己的两段式（target 阶段处理）；
 * - 搜索面板且焦点不在输入框：**镜像两段式**（有内容先清空，空再关闭）——语义与框内 Esc 完全一致；
 * - corner/center 表单浮层（资源/好奇/任务采集）：无自有 Esc，直接关闭。
 */
function onDocEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (savedState) return // 回执态有自己的 document 级监听，让位
  const input = document.getElementById('__zy_si__') as HTMLInputElement | null
  if (input) { // 搜索浮层开着
    if (e.target === input) return // 输入框自己的两段式 handler 管（target 阶段），避免双重处理
    e.preventDefault(); e.stopPropagation()
    if (input.value) {
      input.value = ''
      resetSearchAndRerun()
    } else {
      closeOverlay()
    }
    return
  }
  // 表单浮层（资源采集/好奇/任务采集）：无自有 Esc，文档级兜底直接关闭
  e.preventDefault(); e.stopPropagation()
  closeOverlay()
}

// ============ Toast ============
function showToast(msg: string, duration = 2000) {
  let t = document.getElementById('__zy_toast__')
  if (!t) {
    t = document.createElement('div')
    t.id = '__zy_toast__'
    t.className = 'zy-toast'
    document.documentElement.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), duration)
}

// ============ 快速采集资源卡（右上角小窗） ============
/** R70：任务采集浮层「保存」回调（模块级单例）。
 *  此前 onTcKey 是 openTaskCapture 内部的局部闭包，每次唤起都往 document 上挂一个新的 keydown
 *  监听，而全文没有对应的解绑（closeOverlay 只 innerHTML=''）——同一页面第 N 次唤起任务采集后，
 *  按 Ctrl+Enter 会同时触发 N 个监听器（每层的 getElementById 守卫都命中新浮层）→ 一次保存写 N 条重复任务。
 *  改为模块级具名函数：浏览器对「同函数引用 + 同 capture」的重复 addEventListener 自动去重，天然不累积。 */
let activeTcSave: (() => void) | null = null
function onTcKeydown(e: KeyboardEvent) {
  if (!activeTcSave || !document.getElementById('__zy_tc_save__')) return
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); activeTcSave() }
}
// overlay-impl 为动态 import：模块只求值一次，此处注册一次即可
document.addEventListener('keydown', onTcKeydown, true)
let savedState = false
let savedTimer: ReturnType<typeof setTimeout> | null = null
/** R78（A3）：保存回执 toast 化后，整屏确认块消失，但「Enter 打开看板」仍要在回执期内可用
 *  ⇒ 把动作挂到模块级，供 onSavedKeydown 调用（原实现依赖已被移除的 __zy_saved_open__ 按钮） */
let savedOpenBoard: (() => void) | null = null
/** R78（A3）：保存回执轻量化——整屏确认块收窄为一行 toast，2.5 秒自动消失。
 *  「Enter 打开看板」在回执期内仍然可用：动作挂到模块级 savedOpenBoard（原实现依赖的整屏按钮已随
 *  确认块一起移除）。openAction 传空时只提示、不挂 Enter。
 *  注意：重复卡确认视图（showDupConfirm）是「只能定位不能重复收录」的阻断态，按需求维持整屏，不走这里。 */
function showSaved(toastMsg: string, openAction: (() => void) | null) {
  savedState = true
  closeOverlay() // 先销毁采集面板并清掉遗留监听，再挂本次回执动作
  savedOpenBoard = openAction
    ? () => {
        try { openAction() } catch { /* ignore */ }
        clearSavedState()
      }
    : null
  showToast(toastMsg, 2500)
  document.addEventListener('keydown', onSavedKeydown, true)
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(clearSavedState, 2500)
}
/** R78（A3）：回执态复位——状态位、待执行动作、定时器、键盘监听一并清理 */
function clearSavedState() {
  savedState = false
  savedOpenBoard = null
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  document.removeEventListener('keydown', onSavedKeydown, true)
}

function onSavedKeydown(e: KeyboardEvent) {
  if (!savedState) return
  if (e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation()
    savedOpenBoard?.()
  } else if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation()
    savedState = false
    closeOverlay()
  }
}

/** R70：任务采集浮层「保存」回调注册（模块级单例，见 onTcKeydown） */
function setActiveTcSave(fn: (() => void) | null) { activeTcSave = fn }
/** 采集面板每次打开时复位上一轮回执态（状态位 + 定时器）——跨域收口，见 openCapture */
function resetSavedReceipt() {
  savedState = false
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
}

// ============ 对外入口 ============
// V2.21：本文件由信号层 search-overlay.ts 在首次唤起时动态 import，
// 不再于页面加载期随 content script 同步执行。子帧（iframe）永不加载本文件。
export {
  ROOT_ID, safeSend, uid, ensureRoot, focusWhenReady, openOverlay, closeOverlay, showToast,
  showSaved, setActiveTcSave, resetSavedReceipt,
}
export { openSearch, openCapture, openCuriosity, openTaskCapture }
