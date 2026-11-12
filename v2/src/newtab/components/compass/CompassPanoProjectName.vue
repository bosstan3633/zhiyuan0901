<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'

const props = defineProps<{
  title: string
  editing: boolean
  field: string
}>()

const emit = defineEmits<{
  save: [event: FocusEvent | KeyboardEvent]
  cancel: []
  rename: []
}>()

function saveOnBlur(event: FocusEvent): void {
  if (props.editing) emit('save', event)
}

function saveOnEnter(event: KeyboardEvent): void {
  if (props.editing) emit('save', event)
}
</script>

<template>
  <span
    class="ph-name-t"
    :class="{ editing }"
    :data-edit="field"
    :contenteditable="editing"
    :title="editing ? 'Enter 保存 · Esc 取消' : title"
    @blur="saveOnBlur"
    @keydown.enter.prevent="saveOnEnter"
    @keydown.esc="emit('cancel')"
  >{{ title }}</span>
  <button
    v-if="!editing"
    class="ph-rename"
    type="button"
    title="重命名项目"
    aria-label="重命名项目"
    @click="emit('rename')"
  ><Icon name="edit" :size="12"/></button>
</template>

<style scoped>
.ph-name-t { border-bottom: 1px dashed transparent; outline: none; }
.ph-name-t.editing { border-bottom-color: var(--accent); }
.ph-rename {
  width: 28px;
  height: 28px;
  align-self: center;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  opacity: .55;
  transition: opacity var(--dur), background var(--dur), color var(--dur);
}
.ph-rename:focus-visible { opacity: 1; }
.ph-rename:hover { background: var(--surface-2); color: var(--accent-ink); }
</style>
