<script setup lang="ts">
/**
 * R152：全站 AI 入口统一徽标 = **🤖 机器人脸**（真机实测后的回退）。
 * 三轮比稿的账记在这：R146 用描边镂空「知」→ 真机 12px 深底几乎不可辨；R151 换 ✦ 四角星 →
 * 形状认得出但"这里能让 AI 帮忙"这件事传达不如一张脸直接。用户判断：可辨性优先于克制。
 * 「知」只留在启动闪屏与产品名里（品牌位，不是 AI 入口）。
 * 实现口径：单一真源——除本文件外任何 .vue 都不许再写 🤖 字面量（断言 R146-5 反向钉住）；
 * spin=true 时整枚转起来，补上审计点出的"AI 入口零反馈"缺口，prefers-reduced-motion 降速。
 */
withDefaults(defineProps<{ size?: number; spin?: boolean }>(), { size: 15, spin: false })
</script>

<template>
  <span class="ai-mark" :class="{ spin }" :style="{ fontSize: size + 'px' }" aria-hidden="true">🤖</span>
</template>

<style scoped>
.ai-mark { display: inline-block; flex-shrink: 0; line-height: 1; vertical-align: -2px; }
.ai-mark.spin { animation: ai-turn 1.1s linear infinite; }
@keyframes ai-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ai-mark.spin { animation-duration: 4s; } }
</style>
