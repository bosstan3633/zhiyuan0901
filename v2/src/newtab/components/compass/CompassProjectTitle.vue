<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import CompassLevelTag from './CompassLevelTag.vue'

const props = defineProps<{
  name: string
  editing: boolean
  field: string
}>()
const emit = defineEmits<{
  open: []
  rename: []
  save: [event: FocusEvent | KeyboardEvent]
  cancel: []
}>()

function openProject(): void {
  if (!props.editing) emit('open')
}

function saveOnBlur(event: FocusEvent): void {
  if (props.editing) emit('save', event)
}

function saveOnEnter(event: KeyboardEvent): void {
  if (props.editing) emit('save', event)
}
</script>

<template>
  <h3 class="tw-name">
    <CompassLevelTag :level="4" kind="project" icon="package" label="项目" />
    <span
      class="tw-name-t"
      v-pressable="!editing"
      :class="{ editing }"
      :data-edit="field"
      :contenteditable="editing"
      :title="editing ? 'Enter 保存 · Esc 取消' : '点击打开项目详情'"
      @click.stop="openProject"
      @blur="saveOnBlur"
      @keydown.enter.prevent="saveOnEnter"
      @keydown.esc="emit('cancel')"
    >{{ name }}</span>
    <button v-if="!editing" class="tw-rename" type="button" title="重命名项目" aria-label="重命名项目" @click.stop="emit('rename')">
      <Icon name="edit" :size="12"/>
    </button>
    <slot />
  </h3>
</template>

<style scoped>
.tw-name {
  display: flex;
  align-items: center;
  gap: 7px 10px;
  flex-wrap: wrap;
  margin: 0;
  line-height: 1.35;
}
.tw-name-t {
  color: var(--text);
  font-size: var(--fs-title);
  font-weight: 700;
  letter-spacing: -.01em;
  cursor: pointer;
}
.tw-name-t:hover { text-decoration: underline; text-decoration-style: dotted; }
.tw-name-t.editing { border-bottom: 1px dashed var(--accent); outline: none; }
.tw-name-t.editing:hover { text-decoration: none; }
.tw-rename {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur), background var(--dur), color var(--dur);
}
.tw-name:hover .tw-rename,
.tw-rename:focus-visible { opacity: 1; }
.tw-rename:hover { background: var(--surface-2); color: var(--accent-ink); }
</style>
