/**
 * V3.9.25 · 调度台状态口径、方向台全景可读性、关联取消与年度热力图时序。
 *
 * 本片只锁本轮新增行为；历史结构断言在各自分片内按新载体重指，
 * 不靠删除旧判据换取通过。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs');

console.log('【V3.9.25 · 调度台 / 方向台 / 年度热力图】');

check('R182-D1（V3.9.26 重指）★调度台底轨独立：存储与同步状态移出双列内容网格，右栏取消整列吸附；左右列仍共享同一内容行，滚动时状态轨不再与右下模块叠层', () => {
  const home = read('/newtab/views/CompassHome.vue');
  const css = read('/newtab/views/CompassHome.css');
  return home.includes('<footer class="page-foot desk-status-rail" aria-label="本机存储与同步状态">')
    && home.indexOf('class="page-foot desk-status-rail"') > home.indexOf('</aside>')
    && !home.includes('class="rail-foot"')
    && !css.includes('grid-template-rows: auto minmax(0, 1fr) auto;')
    && css.includes('.desk-main { grid-column: 1; grid-row: 1; }')
    && css.includes('.side-rail { grid-column: 2; grid-row: 1; }')
    && css.includes('.desk-status-rail { margin-top: 18px; position: relative; z-index: 0; }')
    && css.includes('.side-rail { position: relative; top: auto; }')
    && !css.includes('.side-rail, .rail-foot');
});

check('R182-D2 ★状态读数双口径：右栏今日调出同时显示事件操作次数与去重卡张数；操作次数按今日 call 事件计数，明细逐卡显示今日操作次数', () => {
  const home = read('/newtab/views/CompassHome.vue');
  const logic = read('/newtab/views/useCompassHome.ts');
  const detail = read('/newtab/views/useCompassHomeDetail.ts');
  const refresh = segOf(logic, 'async function refreshTodayOutOps()', '\n}')
  return home.includes('{{ todayOutOps }} 次操作 <small>/ {{ todayOutCount }} 张卡</small>')
    && logic.includes("const events = await readEventLog()")
    && refresh.includes("e.action === 'call'")
    && refresh.includes('e.ts >= t0')
    && refresh.includes('todayOutOps.value = calls.length')
    && logic.includes('watch(todayStart, () => { void refreshTodayOutOps() })')
    && detail.includes('今日操作 ${todayCallCounts.value.get(r.id) || 0} 次');
});

check('R182-D3 ★状态明细整行可下钻：可操作行同时具备点击、Enter、Space 与焦点样式；资源先试原始链接，失败才回落资源详情；任务与项目继续打开既有详情', () => {
  const modal = read('/newtab/components/compass/CompassStatusModal.vue');
  const detail = read('/newtab/views/useCompassHomeDetail.ts');
  const action = segOf(detail, 'function onStatusItemAction(', '\n}')
  return modal.includes('@click="it.actionKind && it.actionId && emit(\'item-action\', it)"')
    && modal.includes('@keydown.enter.prevent')
    && modal.includes('@keydown.space.prevent')
    && modal.includes(':class="{ actionable: !!(it.actionKind && it.actionId) }"')
    && modal.includes('tabindex="0"')
    && /\.sd-row\.actionable:focus-visible/.test(modal)
    && action.includes('if (openResourceLink(resource)) void refreshTodayOutOps()')
    && action.includes('else openResourcePreview(resource)')
    && action.includes('openTaskPreview(task)')
    && action.includes('readonlyProjectId.value = item.actionId');
});

check('R182-D4 ★今日战报重复动作归并：同一时段、同一卡、同一动作合成一行并显示 ×N；总操作数与四格统计仍按全部真实事件计数，Markdown / HTML 导出保留 ×N', () => {
  const day = read('/newtab/components/dashboard/DayDetail.vue');
  const css = read('/newtab/components/dashboard/dashboard.css');
  const groups = segOf(day, 'const flowGroups = computed', '\n})');
  return groups.includes('row.e.kind === e.kind && row.e.cardId === e.cardId && row.e.action === e.action')
    && groups.includes('same.n++')
    && day.includes('<span v-if="n > 1" class="tl-x"')
    && day.includes('${n > 1 ? ` ×${n}` : \'\'}')
    && day.includes('共 {{ dlSum.n }} 次操作')
    && css.includes('.dz-tl-row .tl-x {');
});

check('R182-C1 ★项目全景指标名完整可读：泳道标题不再两行截断；2–3 条等分、4+ 条以 360px 阅读下限横滚；标题旁显示指标任务完成数', () => {
  const pano = read('/newtab/components/compass/CompassPano.vue');
  const lane = read('/newtab/components/compass/CompassPanoLane.vue');
  return pano.includes("'lanes-multi': laneCount > 1 && laneCount <= 3")
    && pano.includes("'lanes-scroll': laneCount > 3")
    && pano.includes('flex: 0 0 360px; width: 360px; min-width: 360px;')
    && lane.includes('<span class="lane-n" :title="m.title">{{ m.title }}</span>')
    && lane.includes('<span class="lane-status">{{ m.done }}/{{ m.total }} 任务</span>')
    && lane.includes('min-width: 360px')
    && !lane.includes('-webkit-line-clamp: 2')
    && !lane.includes('max-height: calc(2 * 1.45em)');
});

check('R182-C2 ★愿景 / 使命展开紧凑：层级面板采用实体与摘要两栏，内距与间距收紧；900px 以下退单列，内容与推导链均不丢失', () => {
  const panel = read('/newtab/components/compass/CompassLayerPanel.vue');
  return panel.includes('<div class="lvp-entity">')
    && panel.includes('<div class="lvp-summary">')
    && panel.includes('grid-template-columns: minmax(0, 1.35fr) minmax(280px, .9fr);')
    && panel.includes('padding: 10px 15px 11px;')
    && panel.includes('gap: 8px;')
    && panel.includes('@media (max-width: 900px)')
    && panel.includes('.lvp-main { grid-template-columns: minmax(0, 1fr); }');
});

check('R182-C3 ★关联卡片取消只摘关系：愿景 / 使命四类关联芯片都有取消入口；取消不删除来源卡、3 秒内可恢复，恢复后关系写回同一数组', () => {
  const tree = read('/newtab/views/CompassTree.vue');
  const logic = read('/newtab/views/useCompassTree.ts');
  const unlink = segOf(logic, 'function unlinkChip(', '\nfunction resTitle(');
  return (tree.match(/class="lc-unlink"/g) || []).length === 4
    && tree.includes("unlinkChip('vision', 'res', rid)")
    && tree.includes("unlinkChip('vision', 'curio', cid)")
    && tree.includes("unlinkChip('mission', 'res', rid)")
    && tree.includes("unlinkChip('mission', 'curio', cid)")
    && unlink.includes('c[key] = next')
    && unlink.includes('store.persist()')
    && unlink.includes('undoWindowMs: 3000')
    && unlink.includes('current[key] = [...currentIds, id]')
    && !unlink.includes('.deletedAt')
    && !unlink.includes('softDelete');
});

check('R182-C4 ★第 5/6 层列表进入项目全景定位：行点击先打开所属项目全景，再滚动高亮 data-metric / data-task；行文案同步改为「全景定位」', () => {
  const projects = read('/newtab/views/useCompassTreeProjects.ts');
  const list = read('/newtab/components/compass/CompassLayerList.vue');
  const locate = segOf(projects, 'function onListLocate(', '\n/**');
  return locate.includes('openPano(projId)')
    && locate.includes('layerView.value = null')
    && locate.includes('[data-metric="${metricId}"] [data-task="${taskId}"], [data-task="${taskId}"]')
    && locate.includes('flashLocated(el)')
    && locate.includes('已切到项目全景并定位指标')
    && locate.includes('已切到项目全景并定位任务')
    && list.includes('▸ 全景定位')
    && list.includes('点行打开所在项目的全景泳道');
});

check('R182-P1 ★年度热力图按时间从左到右：12 个自然月单行分组，月间两列间隔 + 轻分隔线；格坐标仍按 col/row 消费，不退回纵向月份流', () => {
  const heat = read('/newtab/components/dashboard/Heatmap.vue');
  const css = read('/newtab/components/dashboard/dashboard.css');
  return heat.includes('const MONTH_GAP = 2')
    && heat.includes('offset += cols + MONTH_GAP')
    && heat.includes('12 个自然月分组')
    && heat.includes('gridColumnStart: c.col + 2')
    && heat.includes('class="dz-month-rule"')
    && heat.includes(':style="{ gridColumnStart: mo.col + 2 }"')
    && css.includes('.dz-month-rule {')
    && css.includes('grid-row: 2 / span 7;')
    && css.includes('border-left: 1px solid var(--border);')
    && css.includes('.dz-year-scroll {')
    && css.includes('overflow-x: auto');
});

check('R182-V1（V3.9.26 重指）★版本与更新日志同步：manifest / package / lock / 手册 / 回归锚一致，V3.9.25 六项用户可见变化仍在更新日志中', () => {
  const pkg = require('../../package.json');
  const lock = require('../../package-lock.json');
  const manual = read('/newtab/views/ManualPage.vue');
  const log = read('/newtab/changelog-data/entries-v3.ts');
  const helpers = read('/../scripts/regression/helpers.cjs');
  return pkg.version === '3.9.26'
    && lock.version === '3.9.26'
    && lock.packages[''].version === '3.9.26'
    && manual.includes('V3.9.26')
    && helpers.includes("version: '3.9.26'")
    && log.includes("version: '3.9.25'")
    && log.includes('调度台状态收口')
    && log.includes('项目全景优先完整可读')
    && log.includes('年度热力图按时间从左到右阅读');
});
