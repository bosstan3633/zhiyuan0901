/**
 * ★W17-C03（2026-10-20 用户拍板 · 方案 C）右栏与左栏等高同步。
 *
 * 病根：右栏两块面板按内容自然伸缩，左栏「今日三件事」「手边的卡」却随数据变高 ——
 * 1440 下右下留一大片空白，两块面板与左栏卡片顶/底边都不齐。
 *
 * 口径（用户已确认方案 C）：
 *   ① 保留现有两列结构与右栏整体 sticky，不改成 display:contents 三行网格（会破坏吸顶）；
 *   ② 用 ResizeObserver 测量左侧两张卡的实际高度，写入 CSS 自定义属性，右栏对应面板读取；
 *   ③ 首帧 / 内容变化 / 字体加载 / 视口变化全部覆盖（字体加载会改高度，漏了就是"打开时对齐、一刷新歪"）。
 *
 * 返回 `{ measure }`：宿主在 onMounted 后调用一次即可自行注册观察。
 */
import { onBeforeUnmount, type Ref } from 'vue'

export interface EqualHeightCtx {
  /** 左栏「今日三件事」容器 */
  top: Ref<HTMLElement | null>
  /** 左栏「手边的卡」容器 */
  bottom: Ref<HTMLElement | null>
  /** 写入目标（通常是页面根节点；CSS 变量就近继承给右栏） */
  host: Ref<HTMLElement | null>
}

export function useEqualHeight(ctx: EqualHeightCtx) {
  let ro: ResizeObserver | null = null
  let raf = 0

  function apply() {
    raf = 0
    const h = ctx.host.value
    if (!h) return
    const topH = ctx.top.value?.getBoundingClientRect().height || 0
    const botH = ctx.bottom.value?.getBoundingClientRect().height || 0
    /* 0 是"还没渲染出来"，写进去会把右栏压成 0 高 —— 只在量到正值时写 */
    if (topH > 0) h.style.setProperty('--rail-top-h', `${Math.round(topH)}px`)
    if (botH > 0) h.style.setProperty('--rail-bottom-h', `${Math.round(botH)}px`)
  }
  function schedule() {
    if (raf) return
    raf = requestAnimationFrame(apply)
  }

  function measure() {
    if (typeof ResizeObserver === 'undefined') { apply(); return }
    ro?.disconnect()
    ro = new ResizeObserver(schedule)
    if (ctx.top.value) ro.observe(ctx.top.value)
    if (ctx.bottom.value) ro.observe(ctx.bottom.value)
    if (ctx.host.value) ro.observe(ctx.host.value)
    /* 字体加载会改变文字高度：measure 一次不够，等字体就绪再补测一次 */
    if (typeof document !== 'undefined' && document.fonts) void document.fonts.ready.then(schedule)
    apply()
  }

  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
    if (raf) { cancelAnimationFrame(raf); raf = 0 }
  })

  return { measure }
}
