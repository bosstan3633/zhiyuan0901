<script setup lang="ts">
/**
 * R117（04-61 C3）：当日新增角标 —— 资源卡 / 任务卡 / 好奇卡三卡共用一枚。
 *
 * 口径：**自然日**（本地时区今天 00:00 起算，见 `shared/utils` 的 `isTodayNew`）——
 * 拍板「6. 自然日」，跨零点即不再算新增，与「今日三件事」的日期键同一天界。
 * 用法：把组件放进卡片标题行即可（`<NewBadge :at="card.createdAt" />`），自判显隐、无值即不渲染。
 */
import { computed } from 'vue'
import { isTodayNew } from '@/shared/utils'

const props = defineProps<{ at?: number }>()
const show = computed(() => isTodayNew(props.at))
</script>

<template>
  <span v-if="show" class="new-badge" title="今日新增（按自然日）">NEW</span>
</template>

<style scoped>
.new-badge { display: inline-block; vertical-align: 1px; flex-shrink: 0; font-size: var(--fs-micro); font-weight: 800; letter-spacing: .6px; line-height: 1.5; color: #fff; background: var(--accent); border-radius: 4px; padding: 0 5px; margin-right: 5px; user-select: none; }
</style>
