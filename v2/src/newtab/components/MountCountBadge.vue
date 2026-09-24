<script setup lang="ts">
/** R142（反馈 #4）：任务「弹药」计数徽标——挂载好奇心 💡（R162：任务↔资源挂载关系退役，🔗 资源计数随之下线）。 */
import type { TaskCard } from '@/shared/models'
const props = defineProps<{ t: TaskCard }>()
const curN = () => (props.t.mountedCuriosityIds || []).length
const tip = () => '挂载 ' + curN() + ' 条好奇心（点任务详情可管理）'
</script>

<template>
  <span v-if="curN()" class="mcb" :title="tip()">💡{{ curN() }}</span>
</template>

<style scoped>
.mcb { flex-shrink: 0; font-size: var(--fs-tiny); color: var(--text-4); white-space: nowrap; cursor: default; }
</style>
