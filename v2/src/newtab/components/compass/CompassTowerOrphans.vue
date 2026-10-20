<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import type { TaskCard } from '@/shared/models'

defineProps<{
  tasks: TaskCard[]
  projId: string
}>()

const emit = defineEmits<{ bind: [taskId: string] }>()
</script>

<template>
  <!-- 无归属收容区：在舱内但没挂任何成功指标的任务 -->
  <div v-if="tasks.length" class="tw-orphans">
    <span class="to-i"><Icon name="warn" :size="13"/></span>
    <span class="to-t">
      <b>{{ tasks.length }} 条无归属任务</b> —— 在本舱内但未挂任何成功指标
    </span>
    <ul class="to-list">
      <li v-for="task in tasks" :key="task.id" class="to-item">
        <span class="toi-t">{{ task.title }}</span>
        <button class="toi-bind" title="为它选一个成功指标" @click="emit('bind', task.id)">＋ 挂指标</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tw-orphans {
  margin-top: 12px; margin-left: 22px;
  padding: 10px 13px; border-radius: 8px;
  border: 1px dashed var(--danger-border); background: var(--danger-bg-soft);
}
.to-i { font-size: var(--fs-micro); color: var(--danger); margin-right: 5px; }
.to-t { font-size: var(--fs-micro); color: var(--text-2); }
.to-t b { color: var(--danger); }
.to-list { list-style: none; margin: 7px 0 0; display: flex; flex-direction: column; gap: 5px; }
.to-item {
  display: flex; align-items: center; gap: 9px;
  background: var(--surface); border-radius: 6px; padding: 4px 9px;
}
.toi-t { font-size: var(--fs-micro); color: var(--text-2); flex: 1; min-width: 0; line-height: 1.5; }
.toi-bind {
  font-size: var(--fs-micro); font-weight: 600; color: var(--accent-ink);
  background: var(--accent-light); padding: 2px 8px; border-radius: 999px; cursor: pointer; flex: none;
}
</style>
