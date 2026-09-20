<script setup lang="ts">
/** R142（反馈 #4）：任务「弹药」计数徽标——挂载资源卡🔗 / 挂载好奇心💡，跨视图统一呈现「这条任务带着什么」。 */
import type { TaskCard } from '@/shared/models'
const props = defineProps<{ t: TaskCard }>()
const resN = () => (props.t.mountedResourceIds || []).length
const curN = () => (props.t.mountedCuriosityIds || []).length
const tip = () => '挂载 ' + resN() + ' 张资源卡' + (curN() ? ' · ' + curN() + ' 条好奇心' : '') + '（点任务详情可管理）'
</script>

<template>
  <span v-if="resN() || curN()" class="mcb" :title="tip()">
    <template v-if="resN()">🔗{{ resN() }}</template><template v-if="curN()"> 💡{{ curN() }}</template>
  </span>
</template>

<style scoped>
.mcb { flex-shrink: 0; font-size: 10px; color: var(--text-4); white-space: nowrap; cursor: default; }
</style>
