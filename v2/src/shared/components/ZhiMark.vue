<script setup lang="ts">
/**
 * 全站 AI 入口统一徽标（真源）· **R155-⑤ 换骨：emoji → 单色线性 SVG**
 *
 * 换骨理由（回源码核实的三个真问题）：
 *   旧实现是 `<span style="font-size:Npx">` + 机器人 emoji —— 尺寸靠 font-size 间接控制：
 *   ① 字形实际渲染大小与 font-size 不成正比：同一 20×20 盒内，与 11px 的兄弟图标（📌📂🗑↗）
 *      实测差 27%，这是"AI 图标看着总比旁边大一圈"的根因；
 *   ② emoji 是**彩色字形，不可着色** ⇒ R156 accent 解禁后无法随主题变化；
 *   ③ 描边粗细由系统字体决定，Windows / macOS 观感不一致。
 *   SVG 化后三件事同时解决：尺寸 = `size` px（精确）、颜色 = `currentColor`（随 accent 自适配）、
 *   描边 = 固定单位（跨平台一致）。
 *
 * 图形沿用 R146~R152 三轮比稿的结论：**"脸"仍是可辨性最高的符号**（R146 描边「知」在 12px 深底几乎
 *   不可辨、R151 ✦ 四角星形状认得出但传达不出"这里能让 AI 帮忙"）。故保留"头 + 双眼 + 天线"的
 *   轮廓语义，只把彩色 emoji 换成单色线性画法。
 *
 * 契约：`size` = 边长（px，**不再走 font-size**）；`spin` 语义不变（prefers-reduced-motion 降速）。
 * 调用纪律：本组件只许被 `AiEntryButton.vue` 引用（断言 R155-10d 钉住），业务侧一律走 AiEntryButton。
 *
 * R168（性能）：形状本体已搬到 `ZhiMarkSymbol.vue`（全站只挂一次的 `<symbol id="zy-ai-mark">`），
 * 这里只留 `<use>` —— 一枚徽标从 **7 个 DOM 节点降到 2 个**（真库资源台一屏 32 枚 ⇒ 少插 160 个节点）。
 * 呈现属性（viewBox / 描边 / currentColor）仍由下面这个外层 svg 提供：形状自己不写 fill/stroke，
 * 于是继承照常生效，主题着色与粗细观感一字不变。
 */
withDefaults(defineProps<{ size?: number; spin?: boolean }>(), { size: 12, spin: false })
</script>

<template>
  <svg
    class="ai-mark"
    :class="{ spin }"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <use href="#zy-ai-mark" />
  </svg>
</template>

<style scoped>
.ai-mark { display: inline-block; flex-shrink: 0; vertical-align: -2px; }
.ai-mark.spin { animation: ai-turn 1.1s linear infinite; }
@keyframes ai-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ai-mark.spin { animation-duration: 4s; } }
</style>
