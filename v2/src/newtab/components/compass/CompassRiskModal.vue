<script setup lang="ts">
/**
 * 断链清单只读弹窗。
 *
 * 只展示并允许行点击定位，不提供编辑、删除或下载；口径由宿主从同一份 compassMeta 传入。
 */
import Modal from '@/shared/components/Modal.vue'
import Icon from '@/shared/components/Icon.vue'

export interface RiskMetricRow {
  id: string
  title: string
  acceptance?: string
  projId: string
}
export interface RiskTaskRow {
  id: string
  title: string
  projId: string
}
export interface RiskProjectGroup {
  id: string
  projId: string
  dirName: string
  projName: string
  metrics: RiskMetricRow[]
  tasks: RiskTaskRow[]
}

defineProps<{
  open: boolean
  groups: RiskProjectGroup[]
  total: number
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locate', target: { projId: string; metricId?: string; taskId?: string }): void
}>()
</script>

<template>
  <Modal :open="open" title="断链清单" width="min(840px, 94vw)" max-height="88vh" @close="emit('close')">
    <div class="crm">
      <p class="crm-intro">
        共 <b>{{ total }}</b> 处断链。清单只读，点任意一行可回到项目塔定位到对应指标或任务。
      </p>
      <div v-if="!groups.length" class="crm-empty">
        <Icon name="check" :size="16"/> 当前没有断链，成功指标与任务链路完整。
      </div>
      <section v-for="group in groups" :key="group.id" class="crm-group">
        <header class="crm-head">
          <span class="crm-path">{{ group.dirName }} <i>›</i> {{ group.projName }}</span>
          <span class="crm-count">{{ group.metrics.length + group.tasks.length }} 处</span>
        </header>
        <div class="crm-cols">
          <div class="crm-col">
            <h3><Icon name="target" :size="13"/> 零任务指标 <b>{{ group.metrics.length }}</b></h3>
            <button v-for="metric in group.metrics" :key="metric.id" class="crm-row" type="button"
              :title="metric.acceptance || '该指标还没有支撑任务'"
              @click="emit('locate', { projId: group.projId, metricId: metric.id })">
              <span>{{ metric.title }}</span>
              <Icon name="arrowright" :size="13"/>
            </button>
            <div v-if="!group.metrics.length" class="crm-none">无</div>
          </div>
          <div class="crm-col">
            <h3><Icon name="checksquare" :size="13"/> 未归属任务 <b>{{ group.tasks.length }}</b></h3>
            <button v-for="task in group.tasks" :key="task.id" class="crm-row" type="button"
              title="定位到项目收容区"
              @click="emit('locate', { projId: group.projId, taskId: task.id })">
              <span>{{ task.title }}</span>
              <Icon name="arrowright" :size="13"/>
            </button>
            <div v-if="!group.tasks.length" class="crm-none">无</div>
          </div>
        </div>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.crm { display: flex; flex-direction: column; gap: 14px; }
.crm-intro { margin: 0; color: var(--text-3); font-size: var(--fs-sub); line-height: 1.7; }
.crm-intro b { color: var(--text); }
.crm-empty {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 28px; color: var(--text-3); font-size: var(--fs-sub);
  border: 1px dashed var(--border); border-radius: var(--radius-md);
}
.crm-group { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.crm-head { display: flex; align-items: center; gap: 10px; padding: 10px 13px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.crm-path { min-width: 0; color: var(--text); font-size: var(--fs-sub); font-weight: 600; }
.crm-path i { margin: 0 4px; color: var(--text-4); font-style: normal; }
.crm-count { margin-left: auto; color: var(--text-3); font-size: var(--fs-caption); }
.crm-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.crm-col { min-width: 0; padding: 10px 12px 12px; }
.crm-col + .crm-col { border-left: 1px solid var(--border); }
.crm-col h3 { display: flex; align-items: center; gap: 5px; margin: 0 0 7px; color: var(--text-3); font-size: var(--fs-caption); font-weight: 600; }
.crm-col h3 b { margin-left: auto; color: var(--text-2); font-weight: 600; }
.crm-row {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 34px;
  padding: 6px 7px; border: 0; border-radius: var(--radius-xs); background: transparent;
  color: var(--text-2); font: inherit; font-size: var(--fs-sub); text-align: left; cursor: pointer;
}
.crm-row span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crm-row:hover, .crm-row:focus-visible { background: var(--surface-2); color: var(--accent-ink); outline: none; }
.crm-row svg { flex: none; color: var(--text-4); }
.crm-none { padding: 8px 7px; color: var(--text-4); font-size: var(--fs-caption); }
@media (max-width: 720px) {
  .crm-cols { grid-template-columns: 1fr; }
  .crm-col + .crm-col { border-left: 0; border-top: 1px solid var(--border); }
}
</style>
