<script setup lang="ts">
/**
 * A2：Linear 式空状态（线性图形 + 标题 + 说明 + 主行动按钮）
 * 用法：<EmptyState icon="clipboard" title="暂无任务" desc="..." action-label="＋ 新建任务" @action="..." />
 */
import Icon from './Icon.vue'
defineProps<{ icon?: string; title: string; desc?: string; actionLabel?: string }>()
</script>

<template>
  <div class="es">
    <div class="es-art"><Icon :name="icon || 'folder'" :size="34" /></div>
    <div class="es-title">{{ title }}</div>
    <div v-if="desc" class="es-desc">{{ desc }}</div>
    <button v-if="actionLabel" class="es-btn" @click="$emit('action')">{{ actionLabel }}</button>
  </div>
</template>

<style scoped>
.es { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 44px 20px; text-align: center; }
.es-art { width: 72px; height: 72px; border-radius: 16px; border: 1px dashed var(--border-strong); display: flex; align-items: center; justify-content: center; color: var(--text-4); margin-bottom: 14px; }
.es-title { font-size: var(--fs-body); font-weight: 600; color: var(--text); margin-bottom: 4px; }
.es-desc { font-size: var(--fs-sub); color: var(--text-3); line-height: 1.7; max-width: 340px; margin-bottom: 14px; white-space: pre-line; }
.es-btn { padding: 7px 16px; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-sub); font-weight: 600; cursor: pointer; font-family: inherit; }
.es-btn:hover { background: var(--accent-hover); }
</style>