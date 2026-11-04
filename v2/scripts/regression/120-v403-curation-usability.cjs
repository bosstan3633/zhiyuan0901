/**
 * V4.0.3 · 策展台可用性收口。
 *
 *   ① 策展节点不再显示「缺证据」，无资源时不保留空资源区/空底栏；
 *   ② 同级左右箭头必须真实移动兄弟顺序并写入 order；
 *   ③ 方向树金字塔在自身滚动域内浏览，不把页面撑出屏幕；
 *   ④ 只读详情按层级展示其下项目、指标、任务与未归档明细；
 *   ⑤ 金字塔任务归位只经宿主落盘回调。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.0.3 · 策展台页头与方向树全景】')

const NODE = read('/newtab/components/curation/CurationMindNode.vue')
const MAP = read('/newtab/components/curation/CurationMindMap.vue')
const CSS = read('/newtab/components/curation/curation.css')
const HOOK = read('/newtab/composables/useCurationMindMap.ts')
const WORKSPACE = read('/newtab/views/Workspace.vue')
const PYRAMID = read('/newtab/components/compass/curation/CurationPyramidLayout.vue')
const DRAWER = read('/newtab/components/compass/CurationReadDrawer.vue')
const PAGE = read('/newtab/views/CompassCurationPage.vue')

check('R191-1 ★策展节点零「缺证据」字段：资源缺失不再变成黄色告警，也不回填空证据状态', () => {
  return [NODE, MAP, CSS, HOOK, WORKSPACE].every(src => !src.includes('缺证据'))
    && !NODE.includes('mind-evidence')
    && !MAP.includes('mind-evidence')
})

check('R191-2 ★无资源节点只聚焦标题与描述：资源区/底栏都按 cards().length 条件渲染，关联入口留在头部轻量动作位', () => {
  return NODE.includes("'resource-bearing': cards().length > 0")
    && NODE.includes('<div v-if="cards().length" class="mind-resources">')
    && NODE.includes('<div v-if="cards().length" class="mind-node-foot">')
    && NODE.includes('v-if="!cards().length" class="mind-head-action"')
    && NODE.includes('title="关联资源"')
    && CSS.includes('.mind-node:not(.resource-bearing) .mind-desc')
    && CSS.includes('padding-top: 0; border-top: 0')
})

check('R191-3 ★同级箭头直接改真实兄弟数组：先 splice 移出再插入，随后全量重排 order 并持久化', () => {
  const start = HOOK.indexOf('function reorderSibling(')
  const end = HOOK.indexOf('function renameNode(', start)
  const body = start >= 0 && end > start ? HOOK.slice(start, end) : ''
  return body.includes('siblings.splice(idx, 1)')
    && body.includes('siblings.splice(swapWith, 0, moving)')
    && body.includes('siblings.forEach((c, i) => { c.order = i })')
    && body.includes('persist()')
    && NODE.includes("emit('reorder-sibling', props.node.id, dir)")
    && MAP.includes("emit('reorder-sibling', id, dir)")
    && WORKSPACE.includes('@reorder-sibling="onMindReorder"')
    && WORKSPACE.includes('history.record(dir < 0 ? \'分支前移\' : \'分支后移\'')
})

check('R191-4 ★方向树宽内容留在自身横向滚动域：页面锁住横向溢出，金字塔/树枝不撑宽视口', () => {
  return PYRAMID.includes('overflow-x: auto; overflow-y: hidden')
    && PYRAMID.includes('width: 100%; max-width: 100%; min-width: 0;')
    && PYRAMID.includes('.org { width: max-content; min-width: 100%;')
    && PAGE.includes('overflow-x: hidden')
    && PAGE.includes('.cmp-body { flex: 1; min-width: 0; max-width: 100%;')
})

check('R191-5 ★层级详情按下辖关系展开：目标含项目/指标/任务，项目含指标与任务，指标含任务，未归档逐项罗列', () => {
  return DRAWER.includes('<h3>下属战略目标</h3>')
    && DRAWER.includes('<h3>项目与成功指标</h3>')
    && DRAWER.includes('<h3>挂载任务 <span>{{ goalTaskRows.length }}</span></h3>')
    && DRAWER.includes("<h3>{{ M.metric.title || '未命名指标' }}</h3>")
    && DRAWER.includes('<h3>挂载任务 <span>{{ metricSel.tasks.length }}</span></h3>')
    && DRAWER.includes('<h3>未归档明细 <span>{{ tree.orphans.length }}</span></h3>')
    && DRAWER.includes("stLabel[T.status] || T.status")
})

check('R191-6 ★金字塔任务拖拽归位只经宿主回调落盘：组件不直调 store，页面集中具名 handler', () => {
  const directWrites = PYRAMID.includes('store.persist()') || PYRAMID.includes('appStore.persist()')
    || PYRAMID.includes('.mutate') || PYRAMID.includes('saveData')
  return !directWrites
    && PYRAMID.includes('onTaskPersist: () => void')
    && PYRAMID.includes('useTaskRelocationDnd')
    && PYRAMID.includes('persist: props.onTaskPersist')
    && PAGE.includes('function onTaskRelocated()')
    && PAGE.includes(':on-task-persist="onTaskRelocated"')
})

check('R75-5（V4.0.3 重指：中心论点卡只保留可统计的两格——论据卡 / 佐证附件；“论证深度”与“来源覆盖”按用户决策退役）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const s = w.indexOf('<span class="cur-metrics"');
  if (s < 0) return false;
  const e = w.indexOf('<CurationDrillDrawer', s);
  if (e < 0) return false;
  const blk = w.slice(s, e);
  return (blk.match(/class="cur-metric"/g) || []).length === 2
    && blk.includes('论据卡') && blk.includes('佐证附件')
    && blk.includes('metrics.mirrored') && blk.includes('metrics.attachmentCount')
    && !blk.includes('论证深度') && !blk.includes('来源覆盖');
});
