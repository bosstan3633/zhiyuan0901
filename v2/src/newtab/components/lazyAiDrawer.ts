import { defineAsyncComponent } from 'vue'

/**
 * R152：AI 评审抽屉的**懒组件单例**。
 * 原来每个入口组件各自在 `<script setup>` 里 `defineAsyncComponent(...)` —— script setup 的顶层
 * 就是 setup 函数体，于是**每张卡都新建一份组件定义**（真机库 380 资源卡 = 380 份，任务面板再多 74 份），
 * 切台/渲染时这笔开销按卡数线性涨。提到模块作用域后全站共享一份，AI 依赖仍是零静态引用（只在真正渲染抽屉时才拉 chunk）。
 */
export const AiDrawer = defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))
