<script setup lang="ts">
import type { ProjectMeta } from '../../views/compassMeta'

defineProps<{
  step: string
  source: ProjectMeta['nextStepSource']
}>()
</script>

<template>
  <!-- 用户填写优先，否则由任务回退推导；来源弱标签避免把推导冒充成用户承诺。 -->
  <div class="tw-next" :class="source === 'empty' ? 'src-empty' : `src-${source}`">
    <span class="tw-next-l">下一步</span>
    <span class="tw-next-v" :title="step">{{ step }}</span>
    <span v-if="source === 'task'" class="tw-next-src">按任务推导</span>
  </div>
</template>

<style scoped>
.tw-next {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  margin-top: 5px; padding-left: 7px;
  border-left: 2px solid color-mix(in srgb, var(--hue) 52%, transparent);
}
.tw-next-l {
  flex: none; font-size: var(--fs-tiny); font-weight: 700; color: var(--text-3);
  letter-spacing: .04em;
}
.tw-next-v {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--fs-micro); font-weight: 600; color: var(--text-2);
}
.tw-next.src-empty .tw-next-v { color: var(--text-3); font-weight: 500; }
.tw-next-src {
  flex: none; font-size: var(--fs-tiny); color: var(--text-4);
  padding: 1px 6px; border-radius: 999px; background: var(--surface-2);
}
@media (max-width: 480px) {
  .tw-next { align-items: flex-start; }
  .tw-next-src { display: none; }
}
</style>
