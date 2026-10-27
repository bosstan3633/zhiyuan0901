/**
 * V3.9.22 · 画像洞察：热力图铺满 + 主攻项目编辑弹窗 + 统一战报宿主。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs');

console.log('【V3.9.22 · 画像洞察】');

check('R180-A1 ★热力图随宽度铺满且保留月份分组：12 个自然月共用全年网格，月间空列；桌面铺满、窄屏容器横滚且页面不溢出', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'))
  const css = read('/newtab/components/dashboard/dashboard.css')
  return hm.includes("gridTemplateColumns: `16px repeat(${yearLayout.cols}, minmax(5px, 1fr))`")
    && hm.includes('v-for="t in yearLayout.months"')
    && hm.includes('gridColumnStart: t.col + 2')
    && hm.includes('offset += cols + MONTH_GAP')
    && hm.includes('class="dz-year-scroll"')
    && css.includes('.dz-year {')
    && css.includes('width: 100%')
    && css.includes('grid-auto-rows: auto')
    && css.includes('min-width: 760px')
    && css.includes('aspect-ratio: 1')
    && css.includes('.dz-year-scroll {')
    && css.includes('overflow-x: auto')
    && !hm.includes('function coordOf(') && !hm.includes('const weekCount = computed');
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

check('R180-B2b（V3.9.23 随迁）★战报只走 Markdown / HTML 双导出：现役 DayDetail 由 exportKpis + exportRows 汇总摘要、四格、全量时间线、当前下钻与页脚；仅资源卡输出原始链接，任务 / 系统保持文本，PNG 长图链退役', () => {
  const day = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'))
  const ev = codeOnly(read('/shared/utils/exportView.ts'))
  const kpis = segOf(day, 'const exportKpis = () =>', '\n}')
  const rows = segOf(day, 'function exportRows()', '\n}')
  const href = segOf(day, 'function resourceHref(e: CardEvent)', '\n}')
  const html = segOf(day, 'function exportHtml(): void', '\n}')
  const md = segOf(day, 'function exportMd(): void', '\n}')
  const share = segOf(ev, 'export function dailyReportShareHtml', '\n}')
  return kpis.includes("label: '新增'") && kpis.includes("label: '调出'")
    && kpis.includes("label: '推进'") && kpis.includes("label: '清理'")
    && rows.includes('flowGroups.value.flatMap')
    && rows.includes('drillRows.value?.rows.map')
    && rows.includes('href: resourceHref(e)')
    && rows.includes('href: drillResourceHref(row)')
    && href.includes("e.kind !== 'resource'")
    && href.includes('safeExportLink(toOpenableUrl(card.linkType, card.link))')
    && html.includes('dailyReportShareHtml({')
    && html.includes('summary: summaryText.value')
    && html.includes('kpis: exportKpis()')
    && html.includes('rows: exportRows()')
    && html.includes("footer: '知源 ownway · 每日战报 · 数据只在本机'")
    && md.includes('sectionsToMd(')
    && md.includes("h: '统计'")
    && md.includes("h: '当日热度'")
    && md.includes("h: '操作流水（屏上顺序）'")
    && md.includes("h: '当前下钻'")
    && md.includes('escapeMarkdown(e.title)')
    && md.includes('escapeMarkdown(r.title)')
    && share.includes('escHtml(spec.summary)')
    && share.includes('escHtml(spec.title)')
    && share.includes('r.href ? `<a href=')
    && share.includes('rel="noopener noreferrer"')
    && !day.includes('buildZyCard()')
    && !day.includes('exportSections')
    && !day.includes('zyCard')
    && !day.includes('exportPng')
    && !day.includes("formats=\"['png'");
});
