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

check('D18-1（V4.3.1 重指）页头保持轻量：旧主攻锚行与“今天的状态”右栏均退役；今日重点、今日战报与任务工作面成为首页主体', () => {
  return CH.includes('调度台 · {{ formatFullDate(todayDate) }}')
    && !CH.includes('TODAY ·')
    && !CH.includes('THREE DECKS')
    && !CH.includes('class="desk-anchor"')
    && !CH.includes('class="da-link"')
    && !CH.includes('class="da-next"')
    && CH.includes('class="focus-list"')
    && CH.includes('class="task-workbench"')
    && CH.includes('打开任务详情')
    && !CH.includes('class="side-rail"');
});

check('D18-2（V4.3.1 重指）主栏主攻面板与右栏均退役；主攻改为任务快捷筛选维度，项目筛选仍保留，不在首页展示下一步 / 完成度', () => {
  return CH.includes('taskWorkFocusIds')
    && CH.includes('主攻项目')
    && CH.includes('taskWorkProjectOptions')
    && !CH.includes('class="stat-row stat-row-focus"')
    && !CH.includes('class="stat-focus-links"')
    && !CH.includes('class="focus-projects"')
    && !CH.includes('class="fp-row"')
    && !CH_C.includes('const focusNextOf')
    && !CH_C.includes('focusMeta.get(');
});

check('D18-3（V4.3.1 重指）卡片池三页签：任务 / 好奇心 / 资源三枚 hand-tab（role=tablist + aria-selected）；任务页用完整工作面，另两页按需渲染，Inbox 与旧底部 tab 零回流', () => {
  return CH.includes('class="hand-tabs"')
    && (CH.match(/class="hand-tab(?=[ "])/g) || []).length === 3
    && CH.includes('role="tablist" aria-label="手边的卡类型"')
    && !CH.includes('hand-tab-inbox')
    && CH.includes(`v-if="handTab === 'task'"`)
    && CH.includes(`v-else-if="handTab === 'curiosity'"`)
    && CH.includes(`v-else class="hand-grid hand-grid-aux resource-tab-grid"`)
    && !CH_C.includes(`handTab === 'inbox'`)
    && CH_C.includes(`const handTab = ref<HandKind>('task')`)
    && CH.includes('class="task-workbench"')
    && CH.includes('class="hand-grid hand-grid-aux"')
    && CH.includes('class="hand-col"')
    && CH.includes('@click="goDeck(handTab)"')
    && CH.includes("goDeck('curiosity')") && CH.includes("goDeck('resource')")
    && !CH_C.includes('bt-tab');
});

check('D18-4（V4.3.1 重指）右栏状态读数退役：今日事实只由今日战报的事件口径呈现；调度台不再并存“入台/调出”第二套读数；常调 Top 10 迁入资源页签并保留本周复用总量', () => {
  return CH.includes('@click="openReview"')
    && CH.includes('class="recent-list resource-recent-list"')
    && CH.includes('本周 {{ weeklyReuse }} 次')
    && !CH.includes(`@click="openStatusDetail('in')"`)
    && !CH.includes(`@click="openStatusDetail('out')"`)
    && !CH.includes('class="rail-chip"')
    && !CH.includes('class="stat-focus-block"')
    && !CH.includes('class="stat-focus-item"');
});

check('D18-5（V4.3.1 重指）右栏整体退役：好奇心页签与卡池能力保留，资源页签承载常调 Top 10；首页只保留今日重点、卡片池任务工作面与底轨', () => {
  return !CH.includes('class="curio-panel"')
    && !CH_C.includes('nurtureCuriosities')
    && CH.includes('aria-label="手边的卡类型"')
    && CH.includes("handTab = 'curiosity'")
    && CH.includes('@click="goDeck(\'curiosity\')"')
    && CH.includes('class="task-workbench"')
    && CH.includes('recent-resource-panel')
    && !CH.includes('class="side-rail"')
    && !CH.includes('useEqualHeight');
});

check('D18-6（V4.3.1 重指）★密度令牌接通：今日三件事与卡池预览都读取 --card-pad-vert / --card-pad-horz / --card-gap，紧凑密度在任务驱动首页真实生效', () => {
  return CH.includes('.focus-list { display: flex; flex-direction: column; }')
    && CH.includes('.focus-list { gap: var(--card-gap); }')
    && CH.includes('padding: var(--card-pad-vert) var(--card-pad-horz);')
    && CH.includes('.focus-row {')
    && /\.focus-row\.focus-card \{[\s\S]*?padding: var\(--card-pad-vert\) var\(--card-pad-horz\)/.test(CH)
    && /\.focus-list \{[\s\S]*?gap: var\(--card-gap\)/.test(CH)
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
  const CUR = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue'));
  const RES = codeOnly(read('/newtab/components/ResourceAiStrip.vue'));
  return TD.includes('listByTask') && TD.includes('addSupportLink')
    && TD.includes('资源镜像') && TD.includes('手动关联') && TD.includes('挂上')
    && !CH_C.includes('挂为任务')
    && !CUR.includes('转为任务') && !CUR.includes('挂载')
    && !RES.includes('关联任务') && !RES.includes('挂载资源');
});
