/**
 * V3.9.22 · 方向台：目标弹窗 + 解绑语义 + 折叠按钮 + 三级定位 + 断链只读弹窗。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs');

console.log('【V3.9.22 · 方向台】');

check('R180-C1 ★新建战略目标先打开弹窗：名称 / 期限三档 / 状态三档；空态与页头同入口', () => {
  const tree = codeOnly(read('/newtab/views/CompassTree.vue'))
  const form = codeOnly(read('/newtab/components/compass/DirectionFormModal.vue'))
  return tree.includes('function openDirectionCreate()')
    && tree.includes('@click="openDirectionCreate"')
    && tree.includes('@action="openDirectionCreate"')
    && tree.includes('<DirectionFormModal')
    && form.includes("const TERMS")
    && form.includes("value: 'long', label: '远期'")
    && form.includes("value: 'mid', label: '中期'")
    && form.includes("value: 'short', label: '近期'")
    && form.includes("label: '进行中'")
    && form.includes("label: '暂停'")
    && form.includes("label: '归档'")
    && form.includes('if (!value)')
    && form.includes("emit('save'");
});

check('R180-C2 ★修改战略目标打开同一弹窗并预填；保存后不切换视图，不再进入 contenteditable', () => {
  const tree = codeOnly(read('/newtab/views/CompassTree.vue'))
  const edit = segOf(tree, 'function openDirectionEdit(id: string)', '\n}')
  return edit.includes("directionForm.value = { open: true, direction }")
    && tree.includes('@click.stop="openDirectionEdit(dg.dir.id)"')
    && tree.includes('@edit-dir="onListEditDir"')
    && tree.includes('function onListEditDir(id: string)')
    && tree.includes('openDirectionEdit(id)')
    && !tree.includes("editingField.value = 'dir-' + id")
    && !tree.includes('function addDirection()');
});

check('R180-C3 ★方向台任务行只解绑：项目塔 / 全景 / 收容区统一走 unbindTaskFromMetric；软删只剩任务详情', () => {
  const tree = codeOnly(read('/newtab/views/CompassTree.vue'))
  const lane = codeOnly(read('/newtab/components/compass/CompassLane.vue'))
  const panoLane = codeOnly(read('/newtab/components/compass/CompassPanoLane.vue'))
  const pano = codeOnly(read('/newtab/components/compass/CompassPano.vue'))
  const orphans = codeOnly(read('/newtab/components/compass/CompassTowerOrphans.vue'))
  const projectDetail = codeOnly(read('/newtab/components/ProjectDetailDrawer.vue'))
  const detail = codeOnly(read('/newtab/components/compass/TaskDetailDrawer.vue'))
  return tree.includes("import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'")
    && !tree.includes('softDeleteTaskToTrash')
    && tree.includes('function unbindTaskById(taskId: string)')
    && lane.includes("(e: 'unbind', taskId: string): void")
    && panoLane.includes("(e: 'unbindTask', taskId: string): void")
    && pano.includes("@unbind-task=\"emit('unbindTask', $event)\"")
    && orphans.includes("unbind: [taskId: string]")
    && projectDetail.includes("import { unbindTaskFromMetric } from '@/shared/utils/taskLinks'")
    && !projectDetail.includes('softDeleteTaskToTrash')
    && !projectDetail.includes('class="pd-mini danger pd-task-del"')
    && (projectDetail.match(/@click="unbindTask\(task\.id\)"/g) || []).length >= 2
    && detail.includes('softDeleteTaskToTrash(d.value, t)');
});

check('R180-C4 ★项目折叠控件：28px 热区、透明底、chevron 旋转随 aria-expanded；不再是实心方块', () => {
  const tower = codeOnly(read('/newtab/components/compass/CompassTower.vue'))
  return tower.includes('class="tw-fold"')
    && tower.includes(':aria-expanded="open"')
    && tower.includes('width: 28px; height: 28px')
    && tower.includes('background: transparent')
    && tower.includes("content: ''; width: 7px; height: 7px")
    && tower.includes('.tw-fold[aria-expanded="true"]::before')
    && !tower.includes('background: var(--surface-2); color: var(--text-3); border: 1px solid var(--border)');
});

check('R180-C5 ★第 6 层任务定位：行数据带 metricId/taskId，定位会展开项目与指标并滚到具体 data-task 行', () => {
  const tree = codeOnly(read('/newtab/views/CompassTree.vue'))
  const list = codeOnly(read('/newtab/components/compass/CompassLayerList.vue'))
  const locate = segOf(tree, 'function locateCompassTarget(', '\nfunction flashLocated(')
  return tree.includes('metricId: p?.metricId || null')
    && tree.includes('projFoldOverride.value[projId] = true')
    && tree.includes('expandedMetrics.value.add(metricId)')
    && locate.includes('[data-metric="${metricId}"] [data-task="${taskId}"]')
    && locate.includes('flashLocated(el)')
    && locate.includes('locationTaskPool()')
    && list.includes("(e: 'locate', target: { projId: string; metricId?: string; taskId?: string }): void")
    && list.includes('{ projId: r.projId, metricId: r.metricId || undefined, taskId: r.id }');
});

check('R180-C6 ★断链清单改只读弹窗：按项目分组、指标与任务行可定位；无 Blob/下载代码', () => {
  const tree = codeOnly(read('/newtab/views/CompassTree.vue'))
  const risk = codeOnly(read('/newtab/components/compass/CompassRiskModal.vue'))
  const report = segOf(tree, 'function showRiskReport()', '\nfunction showTaskGrade(')
  return tree.includes('const riskGroups = computed<RiskProjectGroup[]>')
    && report.includes('riskOpen.value = true')
    && !report.includes('Blob')
    && !report.includes('createObjectURL')
    && !report.includes('download')
    && risk.includes('<Modal :open="open" title="断链清单"')
    && risk.includes("emit('locate', { projId: group.projId, metricId: metric.id })")
    && risk.includes("emit('locate', { projId: group.projId, taskId: task.id })")
    && !risk.includes('download');
});
