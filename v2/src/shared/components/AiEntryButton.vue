<script setup lang="ts">
/**
 * R155-⑤：AI 功能入口统一容器 —— **全站 AI 入口的唯一落点**（原 24 处直挂 AiMark 的散点收敛至此）
 *
 * 解决什么：用户口径是"AI 入口图标与其他功能入口**布局一致、大小一致**"。核实现状有两条成因：
 *   ① 大小 —— 24 处调用点的 `size` 散成 **12 / 13 / 14 / 17** 四档，而兄弟动作是 11px 字形；
 *      根因是旧徽标靠 emoji 的 font-size 控制尺寸（见 AiMark.vue 顶部注释），现已 SVG 化。
 *   ② 布局 —— 徽标与文案之间没有统一点距：间距由**各宿主按钮的 gap** 决定，
 *      `th-ai-btn` 是 5px、`.mini-btn` / `.cz-batch-btn` 又各有其值 ⇒ 同一产品里 AI 入口的
 *      "图标—文字"关系有四五种写法。
 *
 * 本组件的职责边界（重要）：**只管徽标与文案的对齐和间距，不接管宿主的外框**。
 *   背景色 / 边框 / hover / disabled 一律仍由宿主 class（`.mini-btn` / `.th-ai-btn` / `.cz-batch-btn` …）
 *   决定 —— 那些是各处的角色语义（主行动 / 次级 / 批量），不该被统一掉。
 *
 * 尺寸来源唯一化：**只走令牌**（`--icon-sm` 12px / `--icon-lg` 16px），不接受任意数值。
 *   12px 与兄弟图标字形（11~12px）等高；标题位用 `large` 走 16px。
 */
import AiMark from '@/shared/components/AiMark.vue'

withDefaults(defineProps<{
  /** icon = 仅徽标（卡面动作条 / 纯图标按钮）；inline = 徽标 + 文案（工具条按钮 / 菜单项） */
  variant?: 'icon' | 'inline'
  /** 文案（inline 变体使用） */
  label?: string
  /** 标题位放大档：走 --icon-lg（16px）；默认走 --icon-sm（12px） */
  large?: boolean
  /** 拉起 AI 任务期间旋转（原语义保留） */
  spin?: boolean
}>(), { variant: 'icon', label: '', large: false, spin: false })
</script>

<template>
  <AiMark v-if="variant === 'icon'" class="ai-entry-mark" :class="{ 'ai-entry-mark--lg': large }" :spin="spin" />
  <span v-else class="ai-entry" :class="{ 'ai-entry--lg': large }">
    <AiMark class="ai-entry-mark" :spin="spin" />
    <span class="ai-entry__label">{{ label }}</span>
  </span>
</template>

<style scoped>
/* 尺寸只有一个来源：令牌。AiMark 自带的 width/height 属性在此被 CSS 覆盖，
   保证全站 AI 徽标不会因某个调用点写了个数字就偏大一档（这正是 12/13/14/17 散点的成因）。 */
.ai-entry-mark { width: var(--icon-sm); height: var(--icon-sm); vertical-align: -2px; }
.ai-entry-mark--lg { width: var(--icon-lg); height: var(--icon-lg); }
.ai-entry .ai-entry-mark, .ai-entry--lg .ai-entry-mark { vertical-align: 0; }
/* inline：图标—文案点距全站唯一值（原为各宿主 gap 自定） */
.ai-entry { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
.ai-entry--lg { gap: 7px; }
.ai-entry__label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
