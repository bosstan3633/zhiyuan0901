<script setup lang="ts">
/**
 * 画像洞察 · 时间尺度页签。
 *
 * 单段切换：同一时刻只展示一个时间尺度，避免四段纵向堆叠把首屏拉成长页。
 * 键盘契约遵循 WAI-ARIA tabs：左右方向键循环、Home / End 直达首尾。
 */
import { nextTick, ref } from 'vue'

export type PiRange = 'today' | 'week' | 'month' | 'year'

const props = withDefaults(defineProps<{
  modelValue: PiRange
}>(), {
  modelValue: 'year'
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: PiRange): void
}>()

const tabs: { key: PiRange; label: string; en: string }[] = [
  { key: 'today', label: '今天', en: 'TODAY' },
  { key: 'week', label: '本周', en: 'WEEK' },
  { key: 'month', label: '本月', en: 'MONTH' },
  { key: 'year', label: '本年', en: 'YEAR' },
]

const root = ref<HTMLElement | null>(null)

function select(key: PiRange): void {
  if (key !== props.modelValue) emit('update:modelValue', key)
}

function onKeydown(e: KeyboardEvent, idx: number): void {
  const keys = tabs.map(t => t.key)
  let next = idx
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = tabs.length - 1
  else return
  e.preventDefault()
  select(keys[next])
  void nextTick(() => {
    const el = root.value?.querySelector<HTMLElement>(`[data-range="${keys[next]}"]`)
    el?.focus()
  })
}
</script>

<template>
  <div ref="root" class="pi-range-tabs" role="tablist" aria-label="画像洞察时间范围">
    <button v-for="(t, i) in tabs" :key="t.key" type="button" class="pi-range-tab"
      :class="{ on: props.modelValue === t.key }" role="tab" :data-range="t.key"
      :aria-selected="props.modelValue === t.key" :tabindex="props.modelValue === t.key ? 0 : -1"
      @click="select(t.key)" @keydown="onKeydown($event, i)">
      <span>{{ t.label }}</span><small>{{ t.en }}</small>
    </button>
  </div>
</template>
