<script setup lang="ts">
/**
 * 战略目标新建 / 编辑共用表单。
 *
 * 口径：
 *  - 字段只有既有模型的 name / term / status，不扩 schema；
 *  - 期限固定三档：远期 / 中期 / 近期；状态固定三档：进行中 / 暂停 / 归档；
 *  - 宿主只在提交成功后写库，取消不产生任何副作用。
 */
import { computed, nextTick, ref, useId, watch } from 'vue'
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'
import type { Direction } from '@/shared/models'

type DirectionTerm = NonNullable<Direction['term']>
type DirectionStatus = Direction['status']

const props = defineProps<{
  open: boolean
  /** null = 新建；有值 = 编辑 */
  direction: Direction | null
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: { name: string; term: DirectionTerm; status: DirectionStatus }): void
}>()

const TERMS: { value: DirectionTerm; label: string; hint: string }[] = [
  { value: 'long', label: '远期', hint: '一年以上' },
  { value: 'mid', label: '中期', hint: '一个季度到一年' },
  { value: 'short', label: '近期', hint: '本季度内' }
]
const STATUSES: { value: DirectionStatus; label: string }[] = [
  { value: 'active', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'archived', label: '归档' }
]

const name = ref('')
const term = ref<DirectionTerm>('mid')
const status = ref<DirectionStatus>('active')
const error = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const editing = computed(() => !!props.direction)
const formId = useId()

watch(() => props.open, (open) => {
  if (!open) return
  name.value = props.direction?.name || ''
  term.value = props.direction?.term || 'mid'
  status.value = props.direction?.status || 'active'
  error.value = ''
  void nextTick(() => nameInput.value?.focus())
}, { immediate: true })

function submit(): void {
  const value = name.value.trim()
  if (!value) {
    error.value = '请填写战略目标名称'
    nameInput.value?.focus()
    return
  }
  emit('save', { name: value, term: term.value, status: status.value })
}
</script>

<template>
  <Modal
    :open="open"
    :title="editing ? '修改战略目标' : '新建战略目标'"
    width="min(560px, 94vw)"
    max-height="88vh"
    @close="emit('close')">
    <form :id="formId" class="dfm" @submit.prevent="submit">
      <p class="dfm-intro">
        {{ editing ? '修改后会留在当前视图，并立即同步战略骨架与项目塔。' : '先写下目标，再进入项目塔拆解项目、成功指标与任务。' }}
      </p>

      <label class="dfm-field">
        <span class="dfm-label">名称 <b>必填</b></span>
        <input
          ref="nameInput"
          v-model="name"
          class="dfm-input"
          type="text"
          maxlength="80"
          placeholder="例如：建立稳定的个人知识生产系统"
          autocomplete="off"
          @input="error = ''">
        <span v-if="error" class="dfm-error" role="alert">{{ error }}</span>
      </label>

      <fieldset class="dfm-field">
        <legend class="dfm-label">期限</legend>
        <div class="dfm-options term">
          <label v-for="option in TERMS" :key="option.value" class="dfm-option" :class="{ on: term === option.value }">
            <input v-model="term" type="radio" :value="option.value">
            <b>{{ option.label }}</b>
            <span>{{ option.hint }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="dfm-field">
        <legend class="dfm-label">状态</legend>
        <div class="dfm-options status">
          <label v-for="option in STATUSES" :key="option.value" class="dfm-option" :class="{ on: status === option.value }">
            <input v-model="status" type="radio" :value="option.value">
            <b>{{ option.label }}</b>
          </label>
        </div>
      </fieldset>
    </form>

    <template #footer>
      <div class="dfm-foot">
        <span class="dfm-note"><Icon name="bulb" :size="13"/> 保存后同步战略骨架与项目塔</span>
        <button class="dfm-btn" type="button" @click="emit('close')">取消</button>
        <button class="dfm-btn primary" type="submit" :form="formId">{{ editing ? '保存修改' : '创建战略目标' }}</button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.dfm { display: flex; flex-direction: column; gap: 18px; }
.dfm-intro { margin: 0; color: var(--text-3); font-size: var(--fs-sub); line-height: 1.7; }
.dfm-field { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.dfm-label { display: flex; align-items: center; gap: 6px; color: var(--text-2); font-size: var(--fs-sub); font-weight: 600; }
.dfm-label b { color: var(--accent-ink); font-size: var(--fs-micro); font-weight: 600; }
.dfm-input {
  width: 100%; min-height: 40px; padding: 0 12px; border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); background: var(--surface); color: var(--text);
  font: inherit; font-size: var(--fs-body); outline: none;
}
.dfm-input:focus { border-color: var(--accent); box-shadow: var(--shadow-focus); }
.dfm-error { color: var(--danger); font-size: var(--fs-caption); }
.dfm-options { display: grid; gap: 8px; }
.dfm-options.term { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dfm-options.status { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dfm-option {
  position: relative; display: flex; min-width: 0; flex-direction: column; gap: 3px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface-2); cursor: pointer; transition: border-color var(--dur), background var(--dur);
}
.dfm-option input { position: absolute; opacity: 0; pointer-events: none; }
.dfm-option b { color: var(--text); font-size: var(--fs-sub); font-weight: 600; }
.dfm-option span { color: var(--text-3); font-size: var(--fs-micro); }
.dfm-option:hover { border-color: var(--border-strong); }
.dfm-option.on { border-color: var(--accent); background: var(--accent-light); }
.dfm-option:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.dfm-foot { display: flex; align-items: center; gap: 8px; width: 100%; }
.dfm-note { display: inline-flex; align-items: center; gap: 5px; margin-right: auto; color: var(--text-3); font-size: var(--fs-caption); }
.dfm-btn {
  min-height: 34px; padding: 0 14px; border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); background: var(--surface); color: var(--text-2);
  font: inherit; font-size: var(--fs-sub); cursor: pointer;
}
.dfm-btn:hover { border-color: var(--accent); color: var(--accent-ink); }
.dfm-btn.primary { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 600; }
.dfm-btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: #fff; }
@media (max-width: 640px) {
  .dfm-options.term, .dfm-options.status { grid-template-columns: 1fr; }
  .dfm-foot { flex-wrap: wrap; }
  .dfm-note { flex-basis: 100%; }
}
</style>
