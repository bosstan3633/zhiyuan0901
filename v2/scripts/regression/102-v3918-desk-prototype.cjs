/**
 * V3.9.18 · 调度台按原型迭代（04-73 规范落地原型 · 用户 2026-10-24 认可）。
 *
 * 原型：评审交接包/原型_调度台_04-73规范落地_审核稿_V1.html。
 * 这一片锁五件事改版后仍然成立的产品行为：
 * - 页头：中文 kicker + 主攻锚行（下一步 chip 与项目详情同源）；
 * - 主栏新增「主攻项目」面板：项目名 + 下一步主句 + %完成，点击开只读详情（自右栏迁入）；
 * - 手边的卡三列改三池页签（hand-grid/hand-col/mini-list×3/goDeck 字符串锚保留，v-show 切换）；
 * - 右栏读数改「今日入台 / 今日调出 / 未归档」，本周复用挪「最近调出」头部 chip；新增「好奇心培育」面板；
 * - 密度令牌接通（04-73 D-1(a)）：主栏行卡读 --card-pad-vert 与 --card-gap，紧凑档真实生效。
 *
 * 同批四条旧判据已带备案重指：R55-3/R66、R91-2、R153-4（主攻迁主栏）、W5-2/W6-2（kicker 治理）。
 */
const {
  check, read, codeOnly,
} = require('./helpers.cjs');

const CH = read('/newtab/views/CompassHome.vue');
const CH_C = codeOnly(CH);
const SM = read('/newtab/components/compass/CompassStatusModal.vue');

console.log('【V3.9.18 · 调度台按原型迭代（主攻面板 / 三池页签 / 右栏读数 / 密度接通）】');

check('D18-1 ★V3.9.22 重指：页头主攻锚行退役；主攻只在「今天的状态」保留，名称各自打开可编辑项目详情', () => {
  return CH.includes('调度台 · {{ formatFullDate(todayDate) }}')
    && !CH.includes('TODAY ·')
    && !CH.includes('THREE DECKS')
    && !CH.includes('class="desk-anchor"')
    && !CH.includes('class="da-link"')
    && !CH.includes('class="da-next"')
    && CH.includes('class="stat-row stat-row-focus"')
    && CH.includes('打开可编辑项目详情');
});

check('D18-2 ★V3.9.22 重指：主栏主攻面板退役；「今天的状态」同一行并列最多两个主攻名，不显示下一步 / 完成度', () => {
  return CH.includes('class="stat-row stat-row-focus"')
    && CH.includes('class="stat-focus-links"')
    && CH.includes('class="stat-focus-link"')
    && CH.includes('@click="openFocusProject(mainFocus)"')
    && CH.includes('@click="openFocusProject(extraFocus)"')
    && !CH.includes('class="focus-projects"')
    && !CH.includes('class="fp-row"')
    && !CH_C.includes('const focusNextOf')
    && !CH_C.includes('focusMeta.get(');
});

check('D18-3 ★手边的卡三池页签：任务 / 好奇心 / 资源三枚 hand-tab（role=tablist + aria-selected），三段 hand-col 以 v-show 切换显示态；三列字符串锚（hand-grid / hand-col / mini-list×3 / goDeck 三连 / 查看全部）全数保留，旧底部 tab 类名零回流', () => {
  return CH.includes('class="hand-tabs"')
    && (CH.match(/class="hand-tab"/g) || []).length === 3
    && CH.includes('role="tablist" aria-label="手边的卡类型"')
    && CH.includes(`v-show="handTab === 'task'"`)
    && CH.includes(`v-show="handTab === 'curiosity'"`)
    && CH.includes(`v-show="handTab === 'resource'"`)
    && CH.includes(`const handTab = ref<HandKind>('task')`)
    && CH.includes('class="hand-grid"') && CH.includes('class="hand-col"')
    && (CH.match(/class="mini-list"/g) || []).length === 3
    && CH.includes("goDeck('task')") && CH.includes("goDeck('curiosity')") && CH.includes("goDeck('resource')")
    && !CH_C.includes('bt-tab');
});

check('D18-4 ★右栏状态读数改「今日入台 / 今日调出 / 未归档」：入台按三类卡 createdAt ≥ 今日 0 点、调出按资源 lastCalledAt 落在今日（张数口径，不虚报次数）；口径与今日战报（事件日志）不同源——tooltip 与明细 note 必须明示，不许冒充同源；本周复用自状态行迁「最近调出」头部 chip，判据 openStatusDetail(\'reuse\') 不变', () => {
  return CH.includes(`@click="openStatusDetail('in')"`)
    && CH.includes(`@click="openStatusDetail('out')"`)
    && CH_C.includes('const todayInCount = computed')
    && CH_C.includes('const todayOutCount = computed')
    && CH_C.includes('if (!c.deletedAt && (c.createdAt || 0) >= t0) n++')
    && CH_C.includes("filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= t0)")
    && CH.includes('与今日战报的事件计次口径不同')
    && CH.includes('class="rail-chip"')
    && CH.includes(`@click="openStatusDetail('reuse')"`)
    && CH.includes('本周 {{ weeklyReuse }} 次')
    /* 负锚：右栏不再放主攻（迁主栏面板后不许回流） */
    && !CH.includes('class="stat-focus-block"')
    && !CH.includes('class="stat-focus-item"');
});

check('D18-5 ★V3.9.23 右栏收口：删除“好奇心培育”第三块；左栏好奇心页签与卡池能力保留，右栏只留今天的状态 / 最近调出', () => {
  return !CH.includes('class="curio-panel"')
    && !CH_C.includes('nurtureCuriosities')
    && CH.includes('aria-label="手边的卡类型"')
    && CH.includes("handTab = 'curiosity'")
    && CH.includes('@click="goDeck(\'curiosity\')"')
    && CH.includes('rail-panel rail-panel-recent desk-row desk-row-secondary')
    && !CH.includes('useEqualHeight');
});

check('D18-6 ★密度令牌接通（04-73 D-1(a)）：主栏行卡内距读 --card-pad-vert / --card-pad-horz、行距读 --card-gap——紧凑密度开关在调度台真实生效；R50-4/R52-6/R56-6 的原字符串锚原样保留（保护性双锚，gap 单列一条不覆盖首行）', () => {
  const stateRow = CH.slice(CH.indexOf('.stat-row {'), CH.indexOf('.stat-row-focus'));
  return CH.includes('.focus-list { display: flex; flex-direction: column; }')
    && CH.includes('.focus-list { gap: var(--card-gap); }')
    && CH.includes('padding: var(--card-pad-vert) var(--card-pad-horz);')
    && stateRow.includes('padding: var(--card-pad-vert) var(--card-pad-horz);')
    && CH.includes('.focus-row {') && CH.includes('.stat-row {')
    && CH.includes('.mini-item') && CH.includes('padding: var(--card-pad-vert) 10px;');
});

check('D18-7 ★状态明细两键扩展：StatusDetailKey 增 \'in\' / \'out\'；入台明细按创建时间倒序列三类卡（好奇心行只读无动作），调出明细带最近时刻、今日操作次数与累计次数；note 明示两套口径不冒充同源', () => {
  return SM.includes("export type StatusDetailKey = 'focus' | 'unarchived' | 'reuse' | 'in' | 'out'")
    && CH.includes("in: '今日入台明细', out: '今日调出明细'")
    && CH.includes('两者不冒充同源')
    && CH_C.includes('rows.sort((a, b) => b.ts - a.ts).map(x => x.item)')
    && CH_C.includes('meta: `最近 ${fmtRecentTime(r.lastCalledAt)} · 今日操作 ${todayCallCounts.value.get(r.id) || 0} 次`')
    && CH_C.includes('extra: `累计 ${r.callCount || 0} 次`');
});

check('D18-8 ★三卡挂载口径与原型对齐的任务侧呈现：任务详情抽屉的关联仍走 SupportLink 独立表（卡间零挂载红线），调度台侧不新增任何「挂载」字样的动作入口（好奇心面板只有「转为任务」，资源侧无回显入口）', () => {
  const TD = read('/newtab/components/compass/TaskDetailDrawer.vue');
  return TD.includes('listByTask') && TD.includes('addSupportLink')
    && !TD_C_hasMount(TD)
    && !CH_C.includes('挂为任务');
});
function TD_C_hasMount(td) {
  /* 任务抽屉允许「关联资源」措辞（SupportLink 语义），但旧「挂载」字样零回流 */
  return /挂载/.test(codeOnly(td));
}
