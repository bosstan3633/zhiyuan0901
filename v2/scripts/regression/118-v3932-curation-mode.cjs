/**
 * V3.9.32 · 方向台「策展模式」全屏二级页（批 A）。
 *
 *   ① 路由 /compass/curation + 方向台左栏第三入口（用户拍板：全屏、二级页面）；
 *   ② 渲染与导出同源（compassCurationModel 单一 builder）；
 *   ③ 只读红线：策展页/布局/抽屉零 persist，编辑导流回方向台；
 *   ④ 六形态只读抽屉（vision/mission/goal/project/metric/task/orphans）；
 *   ⑤ 折叠双动作（全部展开 / 一键折叠至目标层）+ 树状/金字塔双布局；
 *   ⑥ 全树导出 MD/HTML：链接可点击、主题跟随、MD 可投喂 AI 作上下文。
 *   （批 B 手册官网化移至下一轮：24 节功能同步锚需整篇吸收，单独成轮。）
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【V3.9.32 · 方向台策展模式】')

const ROUTER = read('/newtab/router.ts')
const CT = codeOnly(read('/newtab/views/CompassTree.vue'))
const PAGE = codeOnly(read('/newtab/views/CompassCurationPage.vue'))
const MODEL = codeOnly(read('/shared/utils/compassCurationModel.ts'))
const CEXPORT = codeOnly(read('/shared/utils/compassExport.ts'))
const TREE_L = read('/newtab/components/compass/curation/CurationTreeLayout.vue')
const PYR_L = read('/newtab/components/compass/curation/CurationPyramidLayout.vue')
const DRAWER = codeOnly(read('/newtab/components/compass/CurationReadDrawer.vue'))

check('R189-1 ★策展模式全屏二级页：路由 /compass/curation 懒加载注册，页头含返回方向台回程（双向可达）', () => {
  return ROUTER.includes("path: '/compass/curation'")
    && ROUTER.includes("name: 'compass-curation'")
    && ROUTER.includes('CompassCurationPage.vue')
    && ROUTER.includes('知源调度台 · 方向树策展模式')
    && PAGE.includes("router.push('/compass')")
    && CT.includes("router.push('/compass/curation')")
})

check('R189-2 ★方向台第三入口在左栏视图切换处：三枚 vs-b（两枚模式绑定 + 策展模式路由按钮），零 viewMode 类型改动', () => {
  return (CT.match(/class="vs-b"/g) || []).length === 3
    && (CT.match(/:class="\{ on: viewMode ===/g) || []).length === 2
    && CT.includes('>策展模式</button>')
    && CT.includes("router.push('/compass/curation')")
    && !CT.includes("viewMode = 'curation'")
})

check('R189-3 ★渲染与导出同源：compassExport 消费 buildCurationTree 的 CurationTree，页面调用同一 builder 装配渲染与导出', () => {
  return MODEL.includes('export function buildCurationTree')
    && CEXPORT.includes("from './compassCurationModel'")
    && CEXPORT.includes('buildCompassExportDocument(tree')
    && PAGE.includes('buildCurationTree(d.value)')
    && PAGE.includes('buildCompassExportDocument(tree.value)')
})

check('R189-4 ★只读红线：策展页 / 两布局 / 只读抽屉全文件零 persist、零写库调用；抽屉编辑仅导流。★V3.9.34 重指带备案（用户 2026-11-02 拍板）：策展页性质从「只读全景」扩为「只读 + 任务拖拽归位」——金字塔布局允许复用方向台 useTaskRelocationDnd 进行任务归位写库（task.metricId / metric.taskIds / persist），这与「结构编辑只读」不冲突：愿景/使命/目标/项目/指标的创建、改名、删除仍必须回方向台。判据随之精确化：页面/树布局/抽屉仍零 persist，金字塔布局仅允许经 useTaskRelocationDnd 的持久化（禁止直调 store.persist/saveData/.mutate）。', () => {
  const noWrite = [TREE_L, DRAWER].every(src =>
    !src.includes('persist') && !src.includes('saveData') && !src.includes('.mutate'))
    // PAGE（宿主页面）：禁止直调 saveData/.mutate 与散落 store.persist；落盘集中到一个具名 handler
    && !PAGE.includes('saveData') && !PAGE.includes('.mutate')
    && PAGE.includes('function onTaskRelocated')
  // 金字塔布局：只允许「经 useTaskRelocationDnd 的间接持久化」，不允许自己直调写库
  const pyrOk = !PYR_L.includes('.mutate') && !PYR_L.includes('saveData')
    && !PYR_L.includes('store.persist') && !PYR_L.includes('appStore.persist')
    && PYR_L.includes('useTaskRelocationDnd') && PYR_L.includes('onTaskPersist')
  return noWrite && pyrOk
    && DRAWER.includes('去方向台编辑')
    && PAGE.includes("router.push('/compass')")
})

check('R189-5 ★单一只读抽屉七形态齐备：愿景/使命/目标/项目/指标/任务/散叶，判别联合驱动', () => {
  return MODEL.includes("kind: 'vision'") && MODEL.includes("kind: 'mission'")
    && MODEL.includes("kind: 'goal'") && MODEL.includes("kind: 'project'")
    && MODEL.includes("kind: 'metric'") && MODEL.includes("kind: 'task'")
    && MODEL.includes("kind: 'orphans'")
    && DRAWER.includes("s.kind === 'vision'") && DRAWER.includes("s.kind === 'task'")
    && DRAWER.includes('散叶')
})

check('R189-6 ★双布局 + 折叠双动作：树状（默认）与金字塔消费同一棵树；全部展开 / 一键折叠至目标层在页头', () => {
  return PAGE.includes("layout = ref<'tree' | 'pyramid'>('tree')")
    && PAGE.includes('expandAll') && PAGE.includes('collapseToGoal')
    && PAGE.includes('collapsedIds')
    && TREE_L.includes("emit('toggle'")
    && PAGE.includes('CurationTreeLayout') && PAGE.includes('CurationPyramidLayout')
})

check('R189-7 ★全树导出 MD/HTML：ExportMenu 双格式；MD 含投喂 AI 用途说明；链接安全口径与主题跟随', () => {
  return PAGE.includes('<ExportMenu :formats="[\'md\', \'html\']"')
    && CEXPORT.includes('compassExportMarkdown') && CEXPORT.includes('compassExportHtml')
    && CEXPORT.includes('readExportTheme') && CEXPORT.includes('safeExportLink')
    && CEXPORT.includes('投喂 AI')
    && CEXPORT.includes('未归档任务')
})

check('R189-8 ★停滞与轨道口径：模型停滞=14 天无任务更新（镜像 projectCurationUtils 口径）；任务排序=taskIds 轨道序优先、createdAt 兜底', () => {
  return MODEL.includes('STALE_MS = 14 * 24 * 60 * 60 * 1000')
    && MODEL.includes('track.get(a.task.id)')
    && MODEL.includes('(a.task.createdAt || 0) - (b.task.createdAt || 0)')
})
