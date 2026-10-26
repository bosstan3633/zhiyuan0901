/**
 * V3.9.22 · 调度台：主攻归位 + 二级卡池页头减法。
 */
const { check, read, codeOnly } = require('./helpers.cjs');

console.log('【V3.9.22 · 调度台】');

check('R180-B1a ★页头主攻锚与主栏主攻面板同时退役；调度台主攻只由「今天的状态」承载', () => {
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  return !home.includes('class="desk-anchor"')
    && !home.includes('class="da-link"')
    && !home.includes('class="focus-projects"')
    && !home.includes('class="fp-row"')
    && !home.includes('const focusNextOf')
    && home.includes('class="stat-row stat-row-focus"');
});

check('R180-B1b ★两个主攻同一行并列、各自可点；名称打开同一个可编辑 ProjectDetailDrawer 弹窗', () => {
  const home = codeOnly(read('/newtab/views/CompassHome.vue'))
  return home.includes('class="stat-focus-links"')
    && (home.match(/class="stat-focus-link"/g) || []).length >= 2
    && home.includes('@click="openFocusProject(mainFocus)"')
    && home.includes('@click="openFocusProject(extraFocus)"')
    && home.includes('打开可编辑项目详情')
    && home.includes('<ProjectDetailDrawer :open="readonlyProjectOpen" :project-id="readonlyProjectId" mode="modal"')
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
