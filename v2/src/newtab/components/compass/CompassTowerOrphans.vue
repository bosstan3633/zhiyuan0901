<script setup lang="ts">
import type { TaskCard } from '@/shared/models'

defineProps<{
  tasks: TaskCard[]
  projId: string
}>()

const emit = defineEmits<{
  bind: [taskId: string]
  /** V3.9.22：无归属任务也允许直接解除项目归属，回全局任务池。 */
  unbind: [taskId: string]
}>()
</script>

<template>
  <!-- 无归属收容区：在舱内但没挂任何成功指标的任务 -->
  <div v-if="tasks.length" class="tw-orphans">
    <span class="to-i" aria-hidden="true">!</span>
    <span class="to-t">
      <b>{{ tasks.length }} 条无归属任务</b> —— 在本舱内但未挂任何成功指标
    </span>
    <ul class="to-list">
      <li v-for="task in tasks" :key="task.id" class="to-item" :data-task="task.id">
        <span class="toi-t">{{ task.title }}</span>
        <button class="toi-bind" title="为它选一个成功指标" @click="emit('bind', task.id)">＋ 挂指标</button>
        <button class="toi-unbind" title="解除项目归属，任务回任务池（真删除请进任务详情）" aria-label="解除任务关联" @click="emit('unbind', task.id)">×</button>
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
.toi-unbind {
  width: 28px; height: 28px; padding: 0; border: 1px solid transparent; border-radius: 6px;
  background: transparent; color: var(--text-2); font-size: var(--fs-body); line-height: 1;
  cursor: pointer; flex: none;
}
.toi-unbind:hover { color: var(--danger); background: var(--danger-bg-soft); }
</style>
