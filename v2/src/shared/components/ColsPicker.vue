<script setup lang="ts">
/**
 * R72-2：卡片视图横向列数选择器（4 / 5 / 6 / 7）。
 *
 * 三个卡片网格模块共用（好奇心培育 / 任务调度 / 资源台·策展台），
 * 视觉语言对齐既有 `.view-tabs`（分段控件），样式全走 tokens.css。
 * 仅在卡片视图下由宿主 `v-if` 控制显隐；点击 stopPropagation，不触发宿主卡片的单击/双击。
 */
import { CARD_COL_OPTIONS } from '@/shared/utils/cardCols'

withDefaults(defineProps<{
  /** 当前列数（4~7） */
  modelValue: number
  /** 前缀标签，用于 title 提示 */
  label?: string
  /** R122：方片形态（资源台工具条一级，对齐原型 4/5/6/7 方片选择器） */
  chips?: boolean
}>(), { label: '列数' })

const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()
</script>

<template>
  <div class="cp" :class="{ chips }" :title="`${label}：${modelValue} 列（卡片宽度自适应）`">
    <span class="cp-label">{{ label }}</span>
    <div class="cp-seg">
      <button v-for="n in CARD_COL_OPTIONS" :key="n" class="cp-btn" :class="{ on: modelValue === n }"
        :title="`每行 ${n} 个卡片`" @click.stop="emit('update:modelValue', n)">{{ n }}</button>
    </div>
  </div>
</template>

<style scoped>
.cp { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cp-label { font-size: var(--fs-caption); color: var(--text-3); white-space: nowrap; }
.cp-seg { display: flex; background: var(--surface-2); border-radius: 8px; padding: 3px; gap: 2px; }
.cp-btn {
  min-width: 22px; padding: 3px 6px; border: none; border-radius: 6px; background: transparent;
  font-family: inherit; font-size: var(--fs-sub); line-height: 1.2; color: var(--text-2);
  cursor: pointer; transition: all var(--dur);
}
.cp-btn:hover { background: var(--surface-3); color: var(--text); }
.cp-btn.on { background: var(--surface); color: var(--accent); font-weight: 700; box-shadow: var(--shadow); }
/* R122：方片变体（原型：列数: 4/5/6/7 方片，选中 accent-light） */
.cp.chips .cp-label { font-size: var(--fs-sub); }
.cp.chips .cp-seg { background: transparent; padding: 0; gap: 4px; }
.cp.chips .cp-btn { width: 24px; min-width: 24px; height: 24px; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); font-weight: 600; color: var(--text-2); }
.cp.chips .cp-btn:hover { border-color: var(--border-strong); color: var(--text); background: var(--surface-2); }
.cp.chips .cp-btn.on { background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); color: var(--accent); box-shadow: none; }
</style>
