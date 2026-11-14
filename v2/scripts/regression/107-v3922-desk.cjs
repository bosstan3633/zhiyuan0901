/**
 * V3.9.22 · 调度台：主攻归位 + 二级卡池页头减法。
 */
const { check, read, codeOnly } = require('./helpers.cjs');

console.log('【V3.9.22 · 调度台】');

check('R180-B1a（V4.3.1 重指）页头主攻锚、主栏主攻面板与“今天的状态”同时退役；主攻改由任务工作面的快捷筛选承载', () => {
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  return !home.includes('class="desk-anchor"')
    && !home.includes('class="da-link"')
    && !home.includes('class="focus-projects"')
    && !home.includes('class="fp-row"')
    && !home.includes('const focusNextOf')
    && home.includes('taskWorkFocusIds')
    && home.includes('主攻项目')
    && !home.includes('class="side-rail"');
});

check('R180-B1b（V4.3.1 重指）主攻项目进入项目筛选与任务筛选；未归档任务可直接打开同一个任务归位弹窗维护项目与指标', () => {
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  return home.includes('taskWorkFocusIds')
    && home.includes('taskWorkProjectOptions')
    && home.includes('@assign-task="openTaskAssign"')
    && home.includes('function saveTaskAssign()')
    && home.includes('class="picker-modal task-assign-modal"')
    && !home.includes('class="stat-focus-links"')
    && !home.includes('class="focus-projects"');
});

check('R180-B2 ★调度台今日战报走统一 TodayBattleHost；导出由 DayDetail 单源提供，不另造调度台专用长图实现', () => {
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  const host = codeOnly(read('/newtab/components/dashboard/TodayBattleHost.vue'))
  return home.includes('<TodayBattleHost ref="battleHost" />')
    && home.includes('battleHost.value?.openToday()')
    && host.includes('<DayDetail')
    && host.includes(':kinds="{ task: gTaskLive.length')
    && host.includes('@open-log="onOpenLog"');
});

check('R180-B3 ★二级卡池页头只剩返回 + tab；标题三件与提示条退役，读屏标题保留', () => {
  const deck = codeOnly(read('/newtab/views/CompassDeckView.vue'))
  return deck.includes('class="deck-back"')
    && deck.includes('class="deck-kind-seg"')
    && deck.includes('class="deck-sr-title"')
    && deck.includes('aria-label="卡片类型"')
    && !deck.includes('class="deck-head-copy"')
    && !deck.includes('class="deck-kicker"')
    && !deck.includes('class="deck-hint"')
    && /\.deck-head \{ display: flex; align-items: center;/.test(deck)
    && /\.deck-sr-title \{/.test(deck);
});
