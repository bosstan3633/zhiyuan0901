/**
 * Content Script · 信号层（V2.21 重构）
 *
 * ── 为什么这样拆 ────────────────────────────────────────────────
 * 改造前：本文件是 content_scripts 入口，静态串联了「选区捕获 + 浮层实现 + 拼音字典」。
 *   产物链路：loader → chunk(content) → _chunk(pinyin-pro 字典 ~296KB)
 *   叠加 manifest 的 all_frames:true，结果是——
 *   **打开任何一个网页、其中的每一个 iframe，都要吃掉约 340KB，
 *   哪怕用户整页停留期间一次都没按过 Ctrl+K。**
 *   而子帧的全部职责只是"捕获选区并转发"，却为此下载了完整浮层与整本字典。
 *
 * 改造后：三段式按需加载
 *   [0] 信号层（本文件，约 2–3KB，所有帧）
 *        只做两件事：选区捕获、接收 background 指令 → 动态拉起浮层
 *   [1] 浮层实现 overlay-impl（约 38KB，仅顶层帧、首次唤起时加载；空闲期预取）
 *   [2] 拼音字典（约 296KB，仅在浮层打开时并行加载；未就绪自动降级为纯文本匹配）
 *
 * 净效果：
 *   - 页面加载期：iframe 从 ~340KB 降到 ~3KB（↓99%）；顶层帧同样降到 ~3KB
 *   - 首次 Ctrl+K：浮层实现已预取就绪 → 立即渲染，纯文本搜索立即可用
 *   - 拼音字典在后台并行加载，到位后自动补跑一次查询，把拼音命中补进结果
 *   - 全程对宿主页面零 DOM 侵入（样式与根节点改为首次渲染时才创建）
 */

import { IS_TOP, initSelectionCapture } from './selection'

// ============ [0] 选区捕获：所有帧都要，子帧靠它转发给顶层 ============
// 必须在模块加载期注册，否则 iframe 内的选区无法及时捕获。
initSelectionCapture()

// ============ [1] 浮层实现：按需加载（幂等 Promise，重复唤起零成本） ============
type OverlayImpl = typeof import('./overlay-impl')
let implPromise: Promise<OverlayImpl> | null = null

function loadImpl(): Promise<OverlayImpl> {
  if (!implPromise) {
    implPromise = import('./overlay-impl').catch((e) => {
      // 加载失败时清空，允许下次重试（不缓存失败态）
      implPromise = null
      throw e
    })
  }
  return implPromise
}

// ============ 指令 → 浮层入口映射 ============
const IMPL_ENTRY: Record<string, 'openSearch' | 'openCapture' | 'openCuriosity' | 'openTaskCapture'> = {
  'zy-open-search': 'openSearch',
  'zy-open-capture': 'openCapture',
  'zy-open-curiosity': 'openCuriosity',
  'zy-open-task-capture': 'openTaskCapture'
}

// ============ [2] 接收 background 指令 ============
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // 存活探测：background 发送业务指令前会先 ping，任何帧都要即时应答
  if (msg?.type === 'zy-ping') {
    sendResponse({ ok: true })
    return true
  }

  // 第廿二轮：浮层只在顶层帧渲染，子帧仅做选区捕获转发
  if (!IS_TOP) return
  void sendResponse

  const entry = IMPL_ENTRY[msg?.type]
  if (!entry) return
  void loadImpl()
    .then((m) => (m[entry] as () => unknown)())
    .catch((e) => {
      // 浮层拉起失败不应在宿主页面抛出未捕获异常
      console.error('[知源] 浮层加载失败', e)
    })
})

// ============ 空闲预热：仅顶层帧，且只预取浮层实现，不预取字典 ============
// 目的：让首次 Ctrl+K 的渲染零等待。
// 不预取拼音字典是刻意的——字典体积是浮层的 8 倍，且只在真正搜索时才有意义；
// 扩展资源来自本地磁盘，浮层打开时并行加载通常 <20ms，远快于用户打出第一个字。
if (IS_TOP) {
  const warmUp = (): void => {
    void loadImpl().catch(() => { /* 预热失败静默，首次唤起时会重新加载 */ })
  }
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => void)
    | undefined
  if (typeof ric === 'function') {
    ric(warmUp, { timeout: 3000 })
  } else {
    setTimeout(warmUp, 1500)
  }
}

export {}
