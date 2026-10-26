/**
 * V3.9.22 · 画像洞察：热力图铺满 + 主攻项目编辑弹窗 + 统一战报宿主。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs');

console.log('【V3.9.22 · 画像洞察】');

check('R180-A1 ★热力图随宽度铺满：周列 minmax(0,1fr) 等分、日格 aspect-ratio 1；窄屏容器横滚且页面不溢出', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'))
  const css = read('/newtab/components/dashboard/dashboard.css')
  return hm.includes("gridTemplateColumns: `16px repeat(${weekCount}, minmax(0, 1fr))`")
    && hm.includes('class="dz-year-scroll"')
    && css.includes('.dz-year {')
    && css.includes('width: 100%')
    && css.includes('grid-auto-rows: auto')
    && css.includes('aspect-ratio: 1')
    && css.includes('.dz-year-scroll {')
    && css.includes('overflow-x: auto')
    && !css.includes('repeat(${weekCount}, 12px)');
});

check('R180-A2 ★画像主攻点击打开可编辑项目详情弹窗：复用 ProjectDetailDrawer mode=modal，关闭右侧抽屉形态', () => {
  const pi = codeOnly(read('/newtab/views/ProfileInsights.vue'))
  const pdd = codeOnly(read('/newtab/components/ProjectDetailDrawer.vue'))
  return pi.includes('<ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId" mode="modal"')
    && pdd.includes("mode?: 'drawer' | 'modal'")
    && pdd.includes(`:mode="mode || 'drawer'"`)
    && pdd.includes('@close="emit(\'close\')"');
});

check('R180-B2a ★画像页与调度台共用 TodayBattleHost：画像页不再自建 DayDetail 弹窗壳，openToday/openDay 均委托宿主', () => {
  const pi = codeOnly(read('/newtab/views/ProfileInsights.vue'))
  const host = codeOnly(read('/newtab/components/dashboard/TodayBattleHost.vue'))
  const openToday = segOf(pi, 'function openTodayBattle()', '\n}')
  const openDay = segOf(pi, 'function openDayBattle(day: string)', '\n}')
  return !pi.includes('pi-day-modal')
    && !pi.includes('pi-day-overlay')
    && !pi.includes('<DayDetail')
    && pi.includes("import TodayBattleHost from '@/newtab/components/dashboard/TodayBattleHost.vue'")
    && pi.includes('<TodayBattleHost ref="battleHost" />')
    && openToday.includes('battleHost.value?.openToday()')
    && openDay.includes('battleHost.value?.openDay(day)')
    && host.includes('defineExpose({ openToday, openDay })')
    && /(?:async function openDay|function openDay)\(day: string\)/.test(host);
});

check('R180-B2b ★战报长图覆盖摘要 + 四格 + 热力带 + 全量时间线 + 当前下钻 + 页脚：sections/bands 动态高度，不截断', () => {
  const day = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'))
  const card = codeOnly(read('/shared/utils/zyCard.ts'))
  const build = segOf(day, 'function buildZyCard()', '\n}')
  const sections = segOf(day, 'const exportSections = () =>', '\n}')
  return sections.includes('flowGroups.value.map')
    && sections.includes('drillRows.value')
    && build.includes('sections: exportSections()')
    && build.includes('bands: [{')
    && build.includes('有效动作')
    && build.includes('footer:')
    && card.includes('export interface ZyCardRowSection')
    && card.includes('export interface ZyCardBand')
    && card.includes('sections?: ZyCardRowSection[]')
    && card.includes('bands?: ZyCardBand[]')
    && card.includes('const sections = spec.sections?.length')
    && card.includes('const bands = spec.bands || []')
    && card.includes('+ bandH + rowH + 62')
    && card.includes('for (const section of sections)');
});
