/**
 * V3.9.31 · 用户反馈五项收口（需求清单/开发任务书 2026-11-01）。
 *
 *   F2 全景「切换项目」下拉视口钳制（right→left 锚定，缺陷修复）；
 *   F3 调度台右栏「常调 Top 10」（频率优先·全窗口，用户拍板）；
 *   F1 任务详情 → 项目全景直达（?pano=1 深链复用 onListLocate 既有定位链路）；
 *   F4 塔/全景任务拖拽（taskIds 轨道序统一 + 双写归属口径同展板 R55-17 + 跨项目拒绝）；
 *   F5 项目导出（projectExport 单一生成器 + 全景页头/项目详情弹窗两入口，链接可点击）。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【V3.9.31 · 用户反馈五项收口】')

const SWITCH = read('/newtab/components/compass/CompassPanoSwitch.vue')
const HOME = codeOnly(read('/newtab/views/CompassHome.vue'))
const USE_HOME = codeOnly(read('/newtab/views/useCompassHome.ts'))
const MANUAL = read('/newtab/manual-data.ts')
const DRAWER = codeOnly(read('/newtab/components/compass/TaskDetailDrawer.vue'))
const TREE = codeOnly(read('/newtab/views/CompassTree.vue'))
const USE_TREE = codeOnly(read('/newtab/views/useCompassTree.ts'))
const META = codeOnly(read('/newtab/views/compassMeta.ts'))
const DND = codeOnly(read('/newtab/views/useTaskRelocationDnd.ts'))
const PANO = codeOnly(read('/newtab/components/compass/CompassPano.vue'))
const PANO_LANE = codeOnly(read('/newtab/components/compass/CompassPanoLane.vue'))
const LANE = codeOnly(read('/newtab/components/compass/CompassLane.vue'))
const TOWER = codeOnly(read('/newtab/components/compass/CompassTower.vue'))
const PDD = codeOnly(read('/newtab/components/ProjectDetailDrawer.vue'))
const PEXPORT = codeOnly(read('/shared/utils/projectExport.ts'))

// ── F2 切换项目下拉溢出修复 ──
check('R188-1 ★切换项目下拉视口钳制：面板左锚定（left:0）不再左溢，高度加视口防御；窄断点同口径', () => {
  const m = (SWITCH.match(/\.ps-menu\s*\{([^}]*)\}/) || [])[1] || ''
  const media = SWITCH.slice(SWITCH.indexOf('@media (max-width: 800px)'))
  return m.includes('left: 0')
    && !m.includes('right: 0')
    && m.includes('max-height: min(320px, calc(100vh - 140px))')
    && media.includes('left: 0')
    && !media.includes('right: 0')
})

// ── F3 常调 Top 10 ──
check('R188-2 ★常调 Top 10：调用次数降序 → 同频按最近调出时间，上限 6→10；模块更名且手册同步', () => {
  return USE_HOME.includes('recentLimit = computed(() => 10)')
    && USE_HOME.includes('((b.callCount || 0) - (a.callCount || 0)) || ((b.lastCalledAt || 0) - (a.lastCalledAt || 0))')
    && HOME.includes('<b>常调 Top 10</b>')
    && !HOME.includes('<b>最近调出</b>')
    && MANUAL.includes('常调 Top 10（按调用频率排序的前十张资源卡）')
})

// ── F1 任务详情 → 项目全景直达 ──
check('R188-3 ★任务详情「查看项目全景」直达：未挂项目置灰；深链 ?pano=1&proj&m&task 由方向台 watch 接住并复用 onListLocate', () => {
  return DRAWER.includes('function gotoProjectPano')
    && DRAWER.includes("path: '/compass'")
    && DRAWER.includes("pano: '1', proj: pid")
    && DRAWER.includes(':disabled="!selProjectId"')
    && DRAWER.includes('查看项目全景')
    && USE_TREE.includes("if (q.pano !== '1' || typeof q.proj !== 'string' || !q.proj) return")
    && USE_TREE.includes('onListLocate({')
    && USE_TREE.includes("metricId: typeof q.m === 'string' && q.m ? q.m : undefined")
    && USE_TREE.includes("taskId: typeof q.task === 'string' && q.task ? q.task : undefined")
})

// ── F4 任务拖拽 ──
check('R188-4 ★指标内顺序统一 taskIds 轨道序：dedupeSorted 按轨道下标排序（不在轨者 createdAt 兜底），塔/全景与展板三处同源', () => {
  return /function dedupeSorted\(tasks: TaskCard\[\], metric\?: Metric\)/.test(META)
    && META.includes('new Map((metric.taskIds || []).map((id, i) => [id, i] as const))')
    && META.includes('dedupeSorted(tasks, m)')
    && META.includes('dedupeSorted(tasks.filter(t => !t.deletedAt && (t.metricId === metric.id || linkedIds.has(t.id))), metric)')
})

check('R188-5 ★拖拽双写归属（同展板 R55-17 口径）：metricId 改写 + 双侧 taskIds 更新 + updatedAt；跨项目拒绝不投放', () => {
  return DND.includes('src.metric.taskIds = src.metric.taskIds.filter(x => x !== t.id)')
    && DND.includes('t.metricId = dst.metric.id')
    && DND.includes('t.projectId = dst.projId')
    && DND.includes('t.updatedAt = Date.now()')
    && DND.includes('不能跨项目拖拽')
    && DND.includes('任务已归属')
})

check('R188-6 ★塔/全景任务行可拖拽：Tree provide 唯一实例、两泳道组件 inject（TASK_DND_KEY）；落点提示 t/b/in 三态齐全', () => {
  return USE_TREE.includes('provide(TASK_DND_KEY, taskDnd)')
    && USE_TREE.includes('useTaskRelocationDnd({ d: () => d.value, persist: () => store.persist() })')
    && PANO_LANE.includes("const taskDnd = inject(TASK_DND_KEY, null)")
    && LANE.includes("const taskDnd = inject(TASK_DND_KEY, null)")
    && PANO_LANE.includes(':draggable="taskDnd ? true : undefined"')
    && PANO_LANE.includes('@dragover.stop.prevent="taskDnd?.onRowDragOver($event, t)"')
    && PANO_LANE.includes('@drop.stop.prevent="taskDnd?.onRowDrop($event, t, m.id)"')
    && PANO_LANE.includes('@dragover.prevent="taskDnd?.onLaneDragOver($event, m.id)"')
    && LANE.includes('@drop.stop.prevent="taskDnd?.onRowDrop($event, t, m.id)"')
    && DND.includes('dropTip.value = { id: target.id, mode }')
    && DND.includes("dropTip.value = { id: metricId, mode: 'in' }")
    && DND.includes("export const TASK_DND_KEY: InjectionKey<TaskRelocationDnd>")
})

// ── F5 项目导出 ──
check('R188-7 ★projectExport 单一生成器：结构化项目头/指标/任务/支撑资源；链接走 safeExportLink 口径、主题跟随、附件不嵌本体', () => {
  return PEXPORT.includes('export function buildProjectExportDocument')
    && PEXPORT.includes('export function projectExportMarkdown')
    && PEXPORT.includes('export function projectExportHtml')
    && PEXPORT.includes('safeExportLink(toOpenableUrl(resource.linkType, resource.link))')
    && PEXPORT.includes('safeExportLink(normalized || task.link)')
    && PEXPORT.includes('readExportTheme')
    && PEXPORT.includes('SupportLink')
    && PEXPORT.includes('⚠ 缺任务')
    && PEXPORT.includes('不包含附件本体')
})

check('R188-8 ★导出两入口共用同一生成器：全景页头行动区 + 项目详情弹窗 title-extra，落盘走 downloadText', () => {
  return PANO.includes("<ExportMenu :formats=\"['md', 'html']\" align=\"end\" @pick=\"fmt => emit('exportProject', fmt)\" />")
    && PANO.includes("(e: 'exportProject', fmt: ExportFmt): void")
    && TREE.includes('@export-project="fmt => exportProjectPanorama(panoEffectiveId, fmt)"')
    && USE_TREE.includes('buildProjectExportDocument(d.value, proj)')
    && USE_TREE.includes('function exportProjectPanorama')
    && PDD.includes('buildProjectExportDocument(d.value, project.value)')
    && PDD.includes('#title-extra')
    && PDD.includes("<ExportMenu :formats=\"['md', 'html']\" align=\"end\" @pick=\"exportProject\" />")
})
