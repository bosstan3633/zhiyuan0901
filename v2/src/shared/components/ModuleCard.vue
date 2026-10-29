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
  /** 旁路宿主只借用模块内容（如设置页的详情抽屉）时去掉卡面与标题。 */
  bare?: boolean
}>()
</script>

<template>
  <div class="module-card" :class="{ hover: hover !== false, bare }">
    <div class="module-title" v-if="!bare && (title || $slots.title || $slots.actions)">
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
  border: 1px solid rgba(0,0,0,.025);
  transition: box-shadow .3s;
  display: flex;
  flex-direction: column;
}
.module-card.hover:hover {
  box-shadow: var(--shadow-hover);
}
.module-card.bare {
  background: transparent;
  border: 0;
  box-shadow: none;
}
.module-card.bare .module-body { padding: 0; }
.module-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 22px 10px;
}
.module-title .icon {
  font-size: var(--fs-headline);
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.05));
}
.module-title .name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: .2px;
}
.module-title .en {
  font-size: var(--fs-micro);
  color: var(--text-3);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-left: 2px;
}
.module-title .desc {
  font-size: var(--fs-sub);
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
  padding: 0 20px 18px;
  flex: 1;
}
</style>
