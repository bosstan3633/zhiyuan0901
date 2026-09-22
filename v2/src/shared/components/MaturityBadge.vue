<script setup lang="ts">
/** R142：成熟度徽标（规则引擎即时分）——hover 展开扣分构成；lg 档带分数与标签。 */
import type { Maturity } from '@/shared/utils/maturity'
const props = defineProps<{ m: Maturity; lg?: boolean }>()
const title = () => props.m.reasons.length
  ? `${props.m.score} 分 · ${props.m.label} · 扣分：${props.m.reasons.join('；')}`
  : `${props.m.score} 分 · ${props.m.label}（就绪：可执行/可归属/弹药/新鲜度全过）`
</script>

<template>
  <span class="mbadge" :class="[m.grade === 'A' ? 'gA' : m.grade === 'B' ? 'gB' : m.grade === 'C' ? 'gC' : 'gD', lg ? 'big' : '']" :title="title()">
    {{ m.grade }}<template v-if="lg"> · {{ m.label }} {{ m.score }}</template>
  </span>
</template>

<style scoped>
.mbadge { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; font-size: var(--fs-caption); font-weight: 700; cursor: help; line-height: 1; }
.mbadge.gA { background: var(--success-bg-soft); color: var(--success); }
.mbadge.gB { background: var(--accent-light); color: var(--accent); }
.mbadge.gC { background: var(--warning-bg-soft); color: var(--warning); }
.mbadge.gD { background: var(--danger-bg-soft); color: var(--danger); }
.mbadge.big { height: 22px; font-size: var(--fs-sub); }
</style>
