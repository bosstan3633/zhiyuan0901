<script setup lang="ts">
/**
 * R146：全站 AI 入口统一徽标「知」——镂空知字 + 缺角环（形似加载指示器）。
 * 设计意图：AI 是"知源"的协作者而非按钮上的机器人表情；缺角环静止时是图标，
 * 任务书真的在跑（spin=true）时转起来，顺带补上审计点出的"AI 入口零反馈"缺口。
 * 实现口径：纯 CSS（currentColor 随主题、随按钮文字色），CJK 走文字栅格化 + 描边镂空，
 * 比 SVG 路径描边在小字号下清晰得多；不引任何外部字体/图标资源。
 */
withDefaults(defineProps<{ size?: number; spin?: boolean }>(), { size: 15, spin: false })
</script>

<template>
  <span class="zhi" :class="{ spin }" :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.75) + 'px' }" aria-hidden="true"><i class="zhi-g">知</i></span>
</template>

<style scoped>
/* 描边镂空 + 22% 淡填充：纯 transparent 描边在 12px 下会整个看不见（真机比过四档） */
.zhi { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; vertical-align: -3px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; }
.zhi-g { font-style: normal; font-weight: 700; line-height: 1; letter-spacing: -.5px; color: color-mix(in srgb, currentColor 22%, transparent); -webkit-text-stroke: .85px currentColor; }
.zhi.spin { animation: zhi-turn 1.1s linear infinite; }
@keyframes zhi-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .zhi.spin { animation-duration: 4s; } }
</style>
