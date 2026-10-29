/**
 * V3.9.26 · 任务详情首屏、调度台底轨、战略骨架折叠与项目全景阅读秩序。
 *
 * 本片锁住本轮用户可见行为；版本锚仍由 helpers.cjs 的唯一字面量负责。
 */
const { check, read, CUR_VER, CUR_VTAG, VER_ANCHOR_LITERAL } = require('./helpers.cjs');

console.log('【V3.9.26 · 任务详情 / 调度台 / 方向台】');

check('R183-A1 ★任务导出上移标题栏：导出入口位于标题输入之后、项目指标之前，并从正文 AI 工具组移出；仍复用共享 ExportMenu', () => {
  const td = read('/newtab/components/compass/TaskDetailDrawer.vue');
  const titleAt = td.indexOf('<div class="ts-title-wrap">');
  const exportAt = td.indexOf('<ExportMenu class="ts-title-export"');
  const ownerAt = td.indexOf('<div class="ts-section ts-owner ds-props2">');
  const actionAt = td.indexOf('<div class="ts-action-bar">');
  const actionEnd = td.indexOf('<!-- R48：说明区上移为 Hero', actionAt);
  return titleAt >= 0 && exportAt > titleAt && exportAt < ownerAt
    && actionAt > ownerAt && actionEnd > actionAt
    && !td.slice(actionAt, actionEnd).includes('ExportMenu')
    && td.includes(":formats=\"['md', 'html']\"")
    && td.includes(':deep(.dz-exp-trigger)');
});

check('R183-A2 ★任务归属更紧凑且 AI 文案完整：项目 / 指标为轻量双字段；三枚 AI 入口同组但各自独立，第三枚完整显示「找资源」', () => {
  const td = read('/newtab/components/compass/TaskDetailDrawer.vue');
  const ownerAt = td.indexOf('<div class="ts-section ts-owner ds-props2">');
  const actionAt = td.indexOf('<div class="ts-action-bar">');
  const descAt = td.indexOf('<!-- R48：说明区上移为 Hero');
  const owner = td.slice(ownerAt, actionAt);
  const actions = td.slice(actionAt, descAt);
  return owner.includes('<label class="ds-prop-label"><Icon name="package" :size="13"/> 项目</label>')
    && owner.includes('<label class="ds-prop-label"><Icon name="target" :size="13"/> 指标</label>')
    && owner.includes('class="ds-prop-select"')
    && td.includes('.ts-owner { gap: 6px; padding: 0; border: 0; background: transparent;')
    && actions.includes('aria-label="AI 任务工具"')
    && (actions.match(/class="ts-ai-cell"/g) || []).length === 3
    && actions.includes('label="补全"')
    && actions.includes('label="拆解"')
    && actions.includes('label="找资源"')
    && td.includes('grid-template-columns: repeat(3, minmax(72px, 1fr));')
    && td.includes('white-space: nowrap; overflow: visible;');
});

check('R183-B1 ★调度台底轨不与右栏滚动重叠：状态轨在双列网格闭合之后，右栏不吸附，网格不再保留底部自动轨道', () => {
  const home = read('/newtab/views/CompassHome.vue');
  const css = read('/newtab/views/CompassHome.css');
  return home.includes('<footer class="page-foot desk-status-rail" aria-label="本机存储与同步状态">')
    && home.indexOf('class="page-foot desk-status-rail"') > home.indexOf('</aside>')
    && !css.includes('grid-template-rows: auto minmax(0, 1fr) auto;')
    && css.includes('grid-template-columns: minmax(0, 1fr) 292px;')
    && css.includes('.desk-main { grid-column: 1; grid-row: 1; }')
    && css.includes('.side-rail { grid-column: 2; grid-row: 1; }')
    && css.includes('.side-rail { position: relative; top: auto; }')
    && css.includes('.desk-status-rail { position: relative; z-index: 0; }')
    && /\.page-foot \{[\s\S]*?margin-top: 18px;/.test(css)
    && !/\.page-foot \{[\s\S]*?margin-top: -4px;/.test(css);
});

check('R183-C1 ★战略骨架整行可折叠：标题行支持点击、Enter、Space 与 aria-expanded；右侧「战略目标 / 建议目标 / 展开」动作区阻止冒泡，不误触折叠', () => {
  const spine = read('/newtab/components/compass/CompassSpine.vue');
  return spine.includes('function toggleExpanded() { expanded.value = !expanded.value }')
    && spine.includes('<header class="spine-h" role="button" tabindex="0" :aria-expanded="expanded"')
    && spine.includes('@click="toggleExpanded"')
    && spine.includes('@keydown.enter.prevent.self="toggleExpanded"')
    && spine.includes('@keydown.space.prevent.self="toggleExpanded"')
    && spine.includes('<div class="spine-actions" data-a11y-container @click.stop>')
    && spine.includes('.spine-h:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }');
});

check('R183-C2 ★项目全景指标头固定单行：去掉指标序号，层级 5 后直接显示完整名称；详情与删除统一收进「⋯」，超长名称省略但保留完整标题提示', () => {
  const pano = read('/newtab/components/compass/CompassPano.vue');
  const lane = read('/newtab/components/compass/CompassPanoLane.vue');
  return pano.includes('<CompassPanoLane v-for="m in current.pm.metrics"')
    && !pano.includes(':idx="pi + 1"')
    && !lane.includes('idx: number')
    && !lane.includes('class="lane-i"')
    && !lane.includes('class="lane-detail"')
    && !lane.includes('class="lo-del"')
    && lane.includes('<CompassLevelTag :level="5" kind="metric" icon="target" label="指标" />')
    && lane.includes('<span class="lane-n" :title="m.title">{{ m.title }}</span>')
    && lane.includes('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;')
    && lane.includes('aria-haspopup="menu" title="指标操作"')
    && lane.includes("emit('openMetric', m.id)")
    && lane.includes("emit('delMetric', m.id)");
});

check('R183-C3 ★指标到任务采用单一隶属轨：去掉独立泳道竖轨、分支点和任务左边框；每行用上下连续伪元素拼主轨，仅伸出一条横分支，完成态继续由复选框表达', () => {
  const lane = read('/newtab/components/compass/CompassPanoLane.vue');
  return !lane.includes('class="lane-spine"')
    && !lane.includes('class="ltask-node"')
    && !lane.includes('border-left: 2px solid var(--hue);')
    && lane.includes('.ltask::before,')
    && lane.includes('.ltask::after')
    && lane.includes('.ltask::before { top: 50%; width: 18px; height: 1px; }')
    && lane.includes('.ltask::after { top: -5px; bottom: -5px; width: 1px; }')
    && lane.includes('.ltask:first-child::after { top: -8px; }')
    && lane.includes('.ltask:last-child::after { bottom: 50%; }')
    && lane.includes('class="ltask-box"');
});

check('R183-V1 ★版本与更新日志同步：manifest / package / lock / 手册 / 回归锚一致，V3.9.26 五项用户可见变化仍在更新日志中', () => {
  const pkg = require('../../package.json');
  const lock = require('../../package-lock.json');
  const manifest = read('/manifest.ts');
  const manual = read('/newtab/views/ManualPage.vue');
  const log = read('/newtab/changelog-data/entries-v3.ts');
  const helpers = read('/../scripts/regression/helpers.cjs');
  return pkg.version === CUR_VER
    && lock.version === CUR_VER
    && lock.packages[''].version === CUR_VER
    && manifest.includes(VER_ANCHOR_LITERAL)
    && manual.includes(CUR_VTAG)
    && helpers.includes(VER_ANCHOR_LITERAL)
    && log.includes("version: '3.9.26'")
    && log.includes('任务详情工具收口')
    && log.includes('调度台底轨隔离')
    && log.includes('项目全景单行指标');
});
