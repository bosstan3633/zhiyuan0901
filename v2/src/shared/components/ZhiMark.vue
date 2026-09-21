<script setup lang="ts">
/**
 * R151：全站 AI 入口统一徽标改为**四角星 spark**（替换 R146 的镂空「知」）。
 * 为什么换：真机比稿四场景实测——「知」在深底 hover 条与 12px 小字号下几乎不可辨，
 * 而描边镂空字在小字号下必然糊；四角星在 12px 下仍可辨形，且不会被读成"排序/音频"这类功能图标。
 * 「知」保留在启动 Splash 与产品名里（那是品牌位，不是 AI 入口）。
 * 实现口径：纯 inline SVG + currentColor，随主题与按钮文字色走，不引任何外部图标/字体资源；
 * spin=true 时整枚旋转，补上审计点出的"AI 入口零反馈"缺口（与 R146 同一职责）。
 */
withDefaults(defineProps<{ size?: number; spin?: boolean }>(), { size: 15, spin: false })
</script>

<template>
  <svg class="ai-mark" :class="{ spin }" :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.6c.55 4.6 2.7 6.75 7.3 7.3-4.6.55-6.75 2.7-7.3 7.3-.55-4.6-2.7-6.75-7.3-7.3 4.6-.55 6.75-2.7 7.3-7.3Z" fill="currentColor" />
    <path d="M18.4 14.2c.28 2.2 1.35 3.27 3.55 3.55-2.2.28-3.27 1.35-3.55 3.55-.28-2.2-1.35-3.27-3.55-3.55 2.2-.28 3.27-1.35 3.55-3.55Z" fill="currentColor" opacity=".55" />
  </svg>
</template>

<style scoped>
.ai-mark { display: inline-block; flex-shrink: 0; vertical-align: -3px; overflow: visible; }
.ai-mark.spin { animation: zhi-turn 1.1s linear infinite; transform-origin: 50% 50%; }
@keyframes zhi-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ai-mark.spin { animation-duration: 4s; } }
</style>
