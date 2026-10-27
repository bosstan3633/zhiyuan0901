/**
 * R181 结构优化：任务面板「批量操作 + 批量挂载」子域（自 useTaskManagerPanel 再拆）。
 *
 * 为什么单独成文件：settup 体整体外提后 useTaskManagerPanel.ts 仍 >800——批量动作
 * 只依赖 d / store / allProjects / selectedTaskIds，边界清晰，拆出后两块均 <800。
 * 行为 1:1 搬移（含 R141 软删撤销、R3-Cb 满选/清空口径），历史断言随聚合表回读宿主。
 */
import { ref, computed, type Ref } from 'vue'
import type { AppData, TaskCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import { addTagToCards } from '../../composables/useBatchSelect'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'

interface BatchStore {
  persist: () => void
}

export function useTaskPanelBatch(opts: {
  d: Ref<AppData>
  store: BatchStore
  allProjects: () => { id: string; name: string; metrics?: { id: string; title: string }[] }[]
  selectedTaskIds: Ref<Set<string>>
}) {
  const { d, store, allProjects, selectedTaskIds } = opts
  function batchAddTag(t: string) {
    const n = addTagToCards(d.value.tasks, selectedTaskIds.value, t)
    store.persist()
    showToast(`已给 ${n} 个任务加标签「${t}」（只加不减，去标签到任务详情里改）`)
  }
  function batchDelete() {
    const removed: TaskCard[] = []
    selectedTaskIds.value.forEach(id => {
      const t = d.value.tasks.find(x => x.id === id)
      // R141：软删统一走 softDeleteTaskToTrash——同时摘净 metric.taskIds 引用（撤销回填）
      if (t) { softDeleteTaskToTrash(d.value, t); removed.push(t) }
    })
    store.persist()
    showToast(`已删除 ${removed.length} 个任务`, { label: '撤销', cb: () => {
      // REQ-030：按 id 从当前数据树查找（persist 后 onChanged 整树替换，removed 中的旧引用已失效）
      removed.forEach(t => {
        const cur = d.value.tasks.find(x => x.id === t.id)
        if (cur && cur.deletedAt) {
          cur.deletedAt = undefined
          if (cur.metricId) {
            for (const dir of d.value.compass.directions) for (const proj of dir.projects) for (const m of proj.metrics)
              if (m.id === cur.metricId && !m.taskIds.includes(cur.id)) m.taskIds.push(cur.id)
          }
        }
      })
      store.persist()
    } })
    selectedTaskIds.value.clear()
  }
  function batchSetStatus(status: 'todo'|'doing'|'done') {
    selectedTaskIds.value.forEach(id => {
      const t = d.value.tasks.find(x => x.id === id)
      if (t) { t.status = status; t.updatedAt = Date.now(); if (status==='done') t.completedAt=Date.now() }
    })
    store.persist()
    showToast(`已将 ${selectedTaskIds.value.size} 个任务设为${status==='done'?'已完成':status==='doing'?'进行中':'待开始'}`)
    selectedTaskIds.value.clear()
  }
  function batchSetPriority(priority: 'low'|'medium'|'high') {
    selectedTaskIds.value.forEach(id => {
      const t = d.value.tasks.find(x => x.id === id)
      if (t) { t.priority = priority; t.updatedAt = Date.now() }
    })
    store.persist()
    showToast(`已将 ${selectedTaskIds.value.size} 个任务设为${priority==='high'?'高':priority==='medium'?'中':'低'}优先级`)
    selectedTaskIds.value.clear()
  }

  // ---- 批量挂载（O3）：挂到项目→指标 ----
  const mountModalOpen = ref(false)
  const mountProjId = ref('')
  const mountMetId = ref('')
  const mountProjectOptions = computed(() => allProjects())
  const mountMetricOptions = computed(() =>
    mountProjectOptions.value.find(p => p.id === mountProjId.value)?.metrics || []
  )
  function openBatchMount() {
    if (!selectedTaskIds.value.size) return
    mountProjId.value = ''
    mountMetId.value = ''
    mountModalOpen.value = true
  }
  function confirmBatchMount() {
    if (!mountProjId.value) { showToast('请选择项目'); return }
    let count = 0
    selectedTaskIds.value.forEach(id => {
      const t = d.value.tasks.find(x => x.id === id)
      if (!t) return
      const oldMetric = t.metricId
      t.projectId = mountProjId.value
      t.metricId = mountMetId.value || undefined
      for (const dir of d.value.compass.directions) {
        for (const proj of dir.projects) {
          for (const m of proj.metrics) {
            if (oldMetric && m.id === oldMetric) m.taskIds = m.taskIds.filter(x => x !== id)
            if (t.metricId && m.id === t.metricId && !m.taskIds.includes(id)) m.taskIds.push(id)
          }
        }
      }
      t.updatedAt = Date.now()
      count++
    })
    store.persist()
    mountModalOpen.value = false
    showToast(`已将 ${count} 个任务挂载到所选指标`)
    selectedTaskIds.value.clear()
  }

  return {
    batchAddTag,
    batchDelete,
    batchSetStatus,
    batchSetPriority,
    mountModalOpen,
    mountProjId,
    mountMetId,
    mountProjectOptions,
    mountMetricOptions,
    openBatchMount,
    confirmBatchMount,
  }
}
