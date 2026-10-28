/**
 * V3.9.27 · 调度台底轨间距、画像年度指标去重与月内日历方向。
 *
 * 本片只锁本轮用户可见行为；版本锚仍由 helpers.cjs 的唯一字面量负责。
 */
const { check, read, CUR_VER, CUR_VTAG, VER_ANCHOR_LITERAL } = require('./helpers.cjs');

console.log('【V3.9.27 · 调度台 / 画像年度】');

check('R184-A1 ★调度台底栏与内容区保持正向间距：底栏位置独立、间距由 page-foot 承担，不再用负 margin 抵消模块收口', () => {
  const css = read('/newtab/views/CompassHome.css');
  return css.includes('.desk-status-rail { position: relative; z-index: 0; }')
    && /\.page-foot \{[\s\S]*?margin-top: 18px;/.test(css)
    && !/\.page-foot \{[\s\S]*?margin-top: -\d+px;/.test(css);
});

check('R184-B1 ★画像年度指标只保留一套：年度页头不再重复活跃天数，四格为唯一主指标入口，热力图内部摘要关闭', () => {
  const year = read('/newtab/components/profile/PiYear.vue');
  const heat = read('/newtab/components/dashboard/Heatmap.vue');
  const header = year.slice(year.indexOf('<div class="pi-mod-acts">'), year.indexOf('<div class="pi-mod-b">'));
  return !header.includes('m-badge')
    && !header.includes('本年活跃')
    && year.includes('class="strip4"')
    && year.includes(':show-summary="false"')
    && heat.includes("v-if=\"showSummary !== false\"")
    && year.includes('有效动作')
    && !year.includes('最长连续 <b>{{ ls }}</b> 天');
});

check('R184-B2 ★年度热力图月内按日历横向推进：每月 7 个星期列，星期定列、周次定行，日期先向右再换行', () => {
  const heat = read('/newtab/components/dashboard/Heatmap.vue');
  const css = read('/newtab/components/dashboard/dashboard.css');
  return heat.includes('const firstDow = (new Date(y, m, 1).getDay() + 6) % 7')
    && heat.includes('const weekday = (date.getDay() + 6) % 7')
    && heat.includes('const week = Math.floor((localDay + firstDow) / 7)')
    && heat.includes('const cols = 7')
    && heat.includes('gridColumnStart: c.weekday + 1')
    && heat.includes('gridRowStart: c.week + 1')
    && heat.includes('class="dz-month-grid"')
    && css.includes('.dz-month-grid {')
    && css.includes('grid-template-columns: repeat(7, minmax(5px, 1fr));')
    && css.includes('.dz-year-scroll {')
    && css.includes('overflow-x: auto');
});

check('R184-V1 ★版本与更新日志同步到 V3.9.27：manifest / package / lock / 手册 / 回归锚一致，更新日志首条记录本轮三项用户可见变化', () => {
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
    && log.includes("version: '3.9.27'")
    && log.includes('调度台底栏彻底脱离内容区')
    && log.includes('画像年度指标只保留一套')
    && log.includes('年度热力图的月内日期改为横向日历');
});
