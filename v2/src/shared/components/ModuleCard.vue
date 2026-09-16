<script setup lang="ts">
/**
 * 模块卡片容器 · 与首页原型一致的结构
 * 用法：<ModuleCard icon="🧭" title="主航线" en="MAIN ROUTE" desc="...">
 * A1：iconName 传入线性图标名（优先于 emoji icon）
 */
import Icon from './Icon.vue'
defineProps<{
  icon?: string
  iconName?: string
  title: string
  en?: string
  desc?: string
  hover?: boolean
}>()
</script>

<template>
  <div class="module-card" :class="{ hover: hover !== false }">
    <div class="module-title" v-if="title || $slots.title || $slots.actions">
      <span v-if="iconName" class="icon icon-line"><Icon :name="iconName" :size="17" /></span>
      <span v-else-if="icon" class="icon">{{ icon }}</span>
      <slot name="title">
        <span class="name">{{ title }}</span>
        <span v-if="en" class="en">{{ en }}</span>
      </slot>
      <span v-if="desc" class="desc">{{ desc }}</span>
      <div class="actions"><slot name="actions" /></div>
    </div>
    <div class="module-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.module-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  transition: box-shadow .3s;
  display: flex;
  flex-direction: column;
}
.module-card.hover:hover {
  box-shadow: var(--shadow-hover);
}
/* R119：原型 .module-head-row / .spotlight-header —— 头部 16/20 顶部 + 12px 底距，标题 13.5px/700 */
.module-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 0;
  margin-bottom: 12px;
}
.module-title .icon {
  font-size: 16px;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.05));
}
.module-title .name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: .02em;
}
.module-title .en {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: .05em;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 2px;
}
.module-title .desc {
  font-size: 11.5px;
  color: var(--text-3);
  margin-left: 6px;
  flex: 1;
  line-height: 1.4;
}
.module-title .actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.module-body {
  padding: 0 20px 16px;
  flex: 1;
}
</style>
