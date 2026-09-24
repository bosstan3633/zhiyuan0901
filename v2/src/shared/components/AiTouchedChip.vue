<script setup lang="ts">
/** R165-A（方案 A 标准）：AI 已动过 chip——凭 card.aiTouchedAt 显示「已{verb} · MM-DD HH:mm」，无戳不渲染。
 *  徽标走 AiEntryButton 唯一真源（R146-5：emoji 不入模板）。 */
import { computed } from 'vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'

const props = withDefaults(defineProps<{ ts?: number; verb?: string }>(), { verb: '优化' })
const text = computed(() => {
  if (!props.ts) return ''
  const d = new Date(props.ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `已${props.verb} · ${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})
</script>

<template>
  <span v-if="text" class="ai-chip"><AiEntryButton variant="icon" /> {{ text }}</span>
</template>

<style scoped>
.ai-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--fs-tiny); color: var(--text-3); border: 1px solid var(--border);
  border-radius: 99px; padding: 1px 8px; white-space: nowrap; align-self: center;
}
</style>
