<script setup lang="ts">
const props = defineProps<{
  title: string
  metricId: string
  editing: boolean
  variant: 'tower' | 'pano'
}>()

const emit = defineEmits<{
  edit: [event: MouseEvent]
  save: [event: FocusEvent | KeyboardEvent]
  cancel: []
}>()

function saveOnBlur(event: FocusEvent): void {
  if (props.editing) emit('save', event)
}

function saveOnEnter(event: KeyboardEvent): void {
  if (props.editing) emit('save', event)
}
</script>

<template>
  <component
    :is="variant === 'tower' ? 'h4' : 'span'"
    :class="[variant === 'tower' ? 'cmt-tower' : 'cmt-pano', { editing }]"
    :data-edit="'metric-' + metricId"
    :contenteditable="editing"
    :title="editing ? 'Enter 保存 · Esc 取消' : `${title} · 双击重命名`"
    @dblclick.stop="emit('edit', $event)"
    @blur="saveOnBlur"
    @keydown.enter.prevent="saveOnEnter"
    @keydown.esc="emit('cancel')"
  >{{ title }}</component>
</template>

<style scoped>
.cmt-tower,
.cmt-pano {
  border-bottom: 1px dashed transparent;
  cursor: text;
  outline: none;
}
.cmt-tower:hover,
.cmt-pano:hover { border-bottom-color: var(--border-strong); }
.cmt-tower.editing,
.cmt-pano.editing { border-bottom-color: var(--accent); }
</style>
