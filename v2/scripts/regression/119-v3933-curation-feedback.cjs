/**
 * V3.9.33 · 策展模式用户反馈三连（批 A 隶属连线 / 批 B 三模式切换 / 批 C 手册图示化）。
 *
 *   ① 金字塔布局升级为隶属关系结构图：org-chart 连线（横轨+落线+父级中缝），五级嵌套目标→项目→指标；
 *   ② 三模式自由切换：项目全景页头新增「策展模式」直达（全景隐藏左栏导致入口丢失的缺陷修复）；
 *   ③ 手册增量官网化：21 节全内容保留，三张 mnz 示意 + mid-9 策展模式 / mid-10 导出与分享两新节。
 */
const { check, read, codeOnly } = require('./helpers.cjs')

console.log('【V3.9.33 · 策展模式用户反馈三连】')

const PYR = read('/newtab/components/compass/curation/CurationPyramidLayout.vue')
const PANO = codeOnly(read('/newtab/components/compass/CompassPano.vue'))
const CT = codeOnly(read('/newtab/views/CompassTree.vue'))
const MANUAL = read('/newtab/manual-data.ts')
const PAGE = codeOnly(read('/newtab/views/CompassCurationPage.vue'))

check('R190-1 ★金字塔=隶属关系结构图：org-chart 三级嵌套（目标→项目→指标）+ 横轨/落线/父级中缝三类连线元素', () => {
  return (PYR.match(/ul class="org-lv"/g) || []).length === 3
    && PYR.includes('v-for="(g, gi) in tree.goals"')
    && PYR.includes('v-for="P in g.projects"')
    && PYR.includes('v-for="M in P.metrics"')
    && PYR.includes('.org-lv li::before, .org-lv li::after')
    && PYR.includes('ul.org-lv::before')
    && PYR.includes('border-radius: 0 8px 0 0')
})

check('R190-2 ★连线即隶属（口径文案在位）：cap 注明「连线即隶属」与任务明细去向；散叶节点保留', () => {
  return PYR.includes('连线即隶属：战略目标 → 项目 → 成功指标')
    && PYR.includes('任务明细切「树状」')
    && PYR.includes('散叶 · 未归档任务')
    && PYR.includes('⚠ 缺任务')
})

check('R190-3 ★三模式自由切换：项目全景页头「策展模式」直达按钮（全景隐藏左栏，入口随台自带）；方向台绑定路由', () => {
  return PANO.includes("emit('openCuration')")
    && PANO.includes('> 策展模式</button>')
    && CT.includes('@open-curation="router.push(\'/compass/curation\')"')
    && CT.includes('>策展模式</button>')
})

check('R190-4 ★手册增量官网化：三张 mnz 真实界面示意 + mid-9 策展模式 / mid-10 导出与分享两新节', () => {
  return (MANUAL.match(/mnz-mock/g) || []).length >= 6
    && MANUAL.includes("id: 'mid-9'") && MANUAL.includes("id: 'mid-10'")
    && MANUAL.includes('方向树策展模式（全屏只读全景）')
    && MANUAL.includes('导出与分享：给人看，也给 AI 读')
    && MANUAL.includes('可直接投喂 AI 作上下文')
})

check('R190-5 ★手册旧内容零删（增量口径抽检）：五篇篇名 / 七不原则 / 恩格尔巴特 / 快捷键全表 / 单击明细行 / 常调 Top 10 全部在位', () => {
  return MANUAL.includes('速览 · 一页上手') && MANUAL.includes('理念篇 · 知源哲学')
    && MANUAL.includes('七不原则') && MANUAL.includes('恩格尔巴特') && MANUAL.includes('快捷键全表')
    && MANUAL.includes('单击明细行')
    && MANUAL.includes('常调 Top 10（按调用频率排序的前十张资源卡）')
})

check('R190-6 ★策展页只读红线复验（V3.9.33 增量后）：页面/双布局/抽屉零 persist。★V3.9.34 重指带备案（用户 2026-11-02 拍板，同 R189-4）：金字塔布局允许任务拖拽归位，但写库只经 useTaskRelocationDnd（persist 由宿主以 onTaskPersist 回调注入）；页面/树布局/抽屉仍零 persist，金字塔禁止直调 store.persist/saveData/.mutate。', () => {
  const strict = [read('/newtab/components/compass/curation/CurationTreeLayout.vue'),
    read('/newtab/components/compass/CurationReadDrawer.vue')]
  const pyr = read('/newtab/components/compass/curation/CurationPyramidLayout.vue')
  const strictOk = strict.every(src => !src.includes('persist') && !src.includes('saveData') && !src.includes('.mutate'))
    // PAGE 宿主：落盘集中在具名 handler，零 saveData/.mutate 直调
    && !PAGE.includes('saveData') && !PAGE.includes('.mutate')
    && PAGE.includes('function onTaskRelocated')
  // 金字塔：persist 仅以回调形参出现（onTaskPersist），不得直调 store.persist()
  const pyrOk = !pyr.includes('.mutate') && !pyr.includes('saveData')
    && !pyr.includes('store.persist()') && !pyr.includes('appStore.persist()')
    && pyr.includes('onTaskPersist') && pyr.includes('useTaskRelocationDnd')
  return strictOk && pyrOk
})
