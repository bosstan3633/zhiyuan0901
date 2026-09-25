<script setup lang="ts">
/**
 * R168：AI 徽标的**图形定义只挂一份**（性能，不是审美）。
 *
 * 病根：`ZhiMark.vue` 每次渲染都新建一整棵形状树（1 个 `<svg>` + 天线/头框/双眼/嘴 = **7 个 DOM 节点**）。
 * 真库实测资源台首屏 32 张卡各带一枚 ⇒ 光徽标就 **224 个节点**，约占该次挂载增量（774 节点）的 29%；
 * 而 CPU 谱显示切台的耗时大头是 `(program)`（浏览器样式/布局）+ `insertBefore`/`insertStaticContent`，
 * 也就是"插 DOM 并样式化"本身 ⇒ 少插节点比少算 JS 更管用。
 *
 * 做法：形状搬进一个 `<symbol id="zy-ai-mark">`，全站只挂一次（App 根）；`ZhiMark` 退化成
 * `<svg><use href="#zy-ai-mark"></svg>`（**2 个节点/枚**）。视觉零变化——viewBox / 描边 / currentColor
 * 仍由 ZhiMark 外层 svg 提供（形状不带自己的呈现属性，继承即可随主题着色），`spin` 语义不变。
 *
 * 纪律：本组件只许挂在 `App.vue` 一处；图形**只有这里一份**（断言 R168 钉住"ZhiMark 里不得再有 path/circle/rect"）。
 */
</script>

<template>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <symbol id="zy-ai-mark" viewBox="0 0 24 24">
      <circle cx="12" cy="2.7" r="1" />
      <path d="M12 3.7v1.7" />
      <rect x="3.4" y="5.4" width="17.2" height="12.6" rx="3.8" />
      <circle cx="9.1" cy="11.4" r="1.2" class="zm-eye" />
      <circle cx="14.9" cy="11.4" r="1.2" class="zm-eye" />
      <path d="M9.6 14.9h4.8" />
    </symbol>
  </svg>
</template>

<style>
/* 眼睛是实心点、其余是描边：这两条必须写在全局作用域（symbol 内容不吃任何组件的 scoped 样式） */
#zy-ai-mark .zm-eye { fill: currentColor; stroke: none }
</style>
