<script setup lang="ts">
/**
 * R165-A（方案 A 标准）：AI 已动过 chip——凭 card.aiTouchedAt 显示「已{verb} · MM-DD HH:mm」，无戳不渲染。
 * 徽标走 AiEntryButton 唯一真源（R146-5：emoji 不入模板）。
 *
 * R166 定案 6：任务卡有**三枚**入口共用同一个 `aiTouchedAt`，"已拆解"会在只跑了补全时说谎。
 * 所以 verb 传空串 = 走**共享措辞**「最近 · 时间」，具体是哪一枚动过由 title 交代，不硬猜。
 */
import { computed } from 'vue'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'

const props = withDefaults(defineProps<{ ts?: number; verb?: string }>(), { verb: '优化' })
const text = computed(() => {
  if (!props.ts) return ''
  const d = new Date(props.ts)
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  return props.verb ? `已${props.verb} · ${stamp}` : `最近 · ${stamp}`
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
