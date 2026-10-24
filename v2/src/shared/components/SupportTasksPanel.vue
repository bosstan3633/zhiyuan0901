<script setup lang="ts">
/**
 * R166 F4/T7：资源卡详情里的「支持的任务」——**只读反查**。
 *
 * 为什么只读（定案 10）：资源卡的心智是"供给方"，解绑动作留在任务侧——
 * 两处都能解绑就要处理"我在哪解的"这种记忆负担，而关联本来就是**任务发起**的关系。
 * 所以这里只给：点行打开那个任务所在的台（跳转是读操作，不改数据）、AI 判词、来源标记。
 *
 * 数据一律走 `buildSupportIndex` 的反查表；软删的任务/子任务已被索引过滤，恢复即回挂。
 */
import Icon from '@/shared/components/Icon.vue'
import { computed } from 'vue'
import type { AppData, ResourceCard, SupportLink, TaskCard } from '@/shared/models'
import { buildSupportIndex } from '@/shared/utils/supportLinks'

const props = defineProps<{ d: AppData; resource: ResourceCard }>()
const emit = defineEmits<{ (e: 'openTask', t: TaskCard): void }>()

const rows = computed(() => {
  const idx = buildSupportIndex(props.d)
  return (idx.byResource.get(props.resource.id) || []).flatMap((l: SupportLink) => {
    const t = props.d.tasks.find(x => x.id === l.taskId && !x.deletedAt)
    if (!t) return []
    const sub = l.subId ? (t.subtasks || []).find(s => s.id === l.subId) : undefined
    return [{ l, t, ...(sub ? { sub } : {}) }]
  })
})
</script>

<template>
  <div v-if="rows.length" class="stp">
    <div class="stp-label"><Icon name="compass" :size="13"/> 支持的任务 <span class="stp-hint">— 只读：这些任务把它当支撑材料；解绑请到任务侧</span></div>
    <div v-for="row in rows" :key="row.l.id" class="stp-row" v-pressable :title="row.l.why || '点击打开该任务'" @click="emit('openTask', row.t)">
      <span class="stp-nm">{{ row.sub ? '↳ ' + row.sub.title : row.t.title }}</span>
      <span v-if="row.sub" class="stp-parent">{{ row.t.title.slice(0, 14) }}</span>
      <span v-if="row.l.from === 'ai'" class="stp-tag">AI</span>
    </div>
  </div>
</template>

<style scoped>
.stp { margin-top: 4px; }
.stp-label { font-size: var(--fs-caption); color: var(--text-3); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.stp-hint { text-transform: none; letter-spacing: 0; color: var(--text-4); }
.stp-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); margin-bottom: 4px; font-size: var(--fs-sub); cursor: pointer; }
.stp-row:hover { border-color: var(--accent); }
.stp-nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
.stp-parent { font-size: var(--fs-tiny); color: var(--text-4); white-space: nowrap; }
.stp-tag { font-size: var(--fs-micro); color: var(--accent); border: 1px solid var(--accent); border-radius: 99px; padding: 0 5px; }
</style>
