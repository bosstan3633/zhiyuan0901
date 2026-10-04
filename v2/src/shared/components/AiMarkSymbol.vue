<script setup lang="ts">
/**
 * R168：AI 徽标的**图形定义只挂一份**（性能，不是审美）。
 *
 * 病根：`AiMark.vue` 每次渲染都新建一整棵形状树（1 个 `<svg>` + 天线/头框/双眼/嘴 = **7 个 DOM 节点**）。
 * 真库实测资源卡池首屏 32 张卡各带一枚 ⇒ 光徽标就 **224 个节点**，约占该次挂载增量（774 节点）的 29%；
 * 而 CPU 谱显示切台的耗时大头是 `(program)`（浏览器样式/布局）+ `insertBefore`/`insertStaticContent`，
 * 也就是"插 DOM 并样式化"本身 ⇒ 少插节点比少算 JS 更管用。
 *
 * 做法：形状搬进一个 `<symbol id="zy-ai-mark">`，全站只挂一次（App 根）；`AiMark` 退化成
 * `<svg><use href="#zy-ai-mark"></svg>`（**2 个节点/枚**）。节点账到本轮为止没变过。
 *
 * R169-T5b（用户 2026-09-26 拍板 ② 渐变实心脸）：**轮廓语义一字未动**——头 + 双眼 + 天线，
 * R146~R152 三轮比稿的结论仍是"脸的可辨性最高"。改的只有呈现：描边线性 → 实心填充 + 双色渐变，
 * 眼睛从"实心点"翻成"头上的白洞"（对比由头自己提供，不依赖宿主底色）。
 *
 * ★为什么填充色走 `--ai-mark-fill` 而不是直接写死渐变：
 *   全站有两处 AI 入口 **hover 时把宿主底色翻成 `var(--accent)`、文字翻成 `#fff`**
 *   （`TaskDetailDrawer.vue` 的 `.ts-ai-cell:hover` 三枚、`ThesisAiBtn.vue` 的 `.th-ai-btn:hover` 一枚）。
 *   渐变是 accent→accent-2，落在这两处的 accent 底上就是"accent 糊在 accent 上"，徽标当场消失。
 *   所以这里留一个**可被宿主覆写的口子**：那两处 hover 各声明 `--ai-mark-fill:#fff; --ai-mark-eye:var(--accent)`
 *   （反相：白头 +  accent 眼），既不写死、也不用给每个宿主发明一套类。
 *   自定义属性会随 `<use>` 的影子树继承进来，所以覆写点在宿主按钮上生效。
 *
 * 纪律：本组件只许挂在 `App.vue` 一处；图形**只有这里一份**（断言 R168-1 / R169-19 钉住）。
 */
</script>

<template>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="zy-ai-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" class="zm-g1" /><stop offset="1" class="zm-g2" />
      </linearGradient>
    </defs>
    <symbol id="zy-ai-mark" viewBox="0 0 24 24">
      <circle cx="12" cy="2.6" r="1.3" class="zm-solid" />
      <rect x="11.1" y="3.4" width="1.8" height="2.2" rx=".9" class="zm-solid" />
      <rect x="3" y="5.4" width="18" height="13" rx="4.2" class="zm-head" />
      <circle cx="9.1" cy="11.6" r="1.5" class="zm-eye" />
      <circle cx="14.9" cy="11.6" r="1.5" class="zm-eye" />
      <rect x="9.2" y="14.6" width="5.6" height="1.5" rx=".75" class="zm-eye" />
    </symbol>
  </svg>
</template>

<style>
/* symbol 内容不吃任何组件的 scoped 样式 ⇒ 这三条必须写在全局作用域。
   渐变两端都取既有令牌（accent / accent-2），**不引入第二套品牌色**；
   宿主可用 --ai-mark-fill / --ai-mark-eye 覆写（accent 底上的两处就走这条）。 */
#zy-ai-grad .zm-g1 { stop-color: var(--accent) }
#zy-ai-grad .zm-g2 { stop-color: var(--accent-2) }
#zy-ai-mark .zm-head { fill: var(--ai-mark-fill, url(#zy-ai-grad)); stroke: none }
#zy-ai-mark .zm-solid { fill: var(--ai-mark-fill, url(#zy-ai-grad)); stroke: none }
#zy-ai-mark .zm-eye { fill: var(--ai-mark-eye, #fff); stroke: none }
</style>
