/**
 * 17-b5-home.cjs —— B5-b「调度台：主角收束 / 战报折叠 / 三卡同构」（V3.8.32）常驻判据。
 *
 * 三项：
 *   M3 今日三件事主角收束（空槽 = 唯一 accent 主行动；hero 内不再有第二个实底主按钮）
 *   M4 战报折叠为 tool 级单入口（右槽降级；宿主不渲染常驻卡）
 *   M5 三卡同构（外框 lg / 卡内单元同圆角 / 卡头同源）
 *
 * 纪律：锁结构事实与令牌档位，不锁观感；观感归四主题截图（docs/视觉归档/B5b-home）。
 * ★注释里不写被禁的字面量本身 —— 判据用 includes 扫源码，写进注释等于自己把判据喂绿（R71）。
 */
const { check, read, codeOnly } = require('./helpers.cjs');

const HOME = read('/newtab/views/CompassHome.vue');
const HOST = read('/newtab/components/dashboard/TodayBattleHost.vue');
const TM = read('/newtab/components/compass/TaskManagerPanel.vue');
const CZ = read('/newtab/components/compass/CuriosityPanel.vue');
const PCP = read('/newtab/components/compass/PoolCardsPanel.vue');
const DK = read('/newtab/components/compass/DeckControls.vue');

console.log('【B5-b · V3.8.32：调度台（M3 / M4 / M5）】');

/* ============ M3 · 主角收束 ============ */
check('M3-1 ★V3.9.1 随迁备案：空计划位仍是「主行动」而不是缺一块。空行走 accent 虚线图标 + 明确文案，整行保持不透明，不用半透明暗示禁用', () => {
  const rule = (HOME.match(/^\.empty-row \{[^}]*\}/m) || [''])[0];
  if (!rule) { console.log('     规则缺失'); return false; }
  const hasOpacity = /opacity:\s*\.?[0-8]/.test(rule);
  if (hasOpacity) console.log('     仍在整格降透明：' + rule.slice(0, 120));
  const plus = (HOME.match(/^\.empty-plus \{[^}]*\}/m) || [''])[0];
  return HOME.includes('class="focus-row empty-row"')
    && plus.includes('border: 1px dashed')
    && HOME.includes('从任务库选取')
    && !hasOpacity;
});

check('M3-2 ★V3.9.1 随迁备案：三件事工作单只保留一个主行动——空行点开任务库；选中任务后立即转成计划行，不再出现第二枚实底主按钮', () => {
  const i = HOME.indexOf('<section id="zy-mod-tasks"');
  const j = HOME.indexOf('<section class="hand-board"');
  const seg = i >= 0 && j > i ? HOME.slice(i, j) : '';
  if (!seg) { console.log('     切片为空（模板标记漂移）'); return false; }
  if (seg.includes('mini-btn primary')) console.log('     hero 段内仍有实底主按钮');
  return seg.includes('class="focus-row empty-row"')
    && seg.includes('@click="openPicker(c.idx)"')
    && !seg.includes('mini-btn primary');
});

/* ============ M4 · 战报折叠 ============ */
check('M4-1 ★V3.9.1 随迁备案：战报仍是 tool 级单入口。入口收进页脚与右栏，不带 accent 实底，点击仍走 battleHost.openToday', () => {
  if (!HOME.includes('class="foot-link"') || !HOME.includes('@click="openReview"')) return false;
  const fn = (HOME.match(/function openReview\(\)[^\n]*/) || [''])[0];
  if (!fn.includes('battleHost.value?.openToday()')) { console.log('     openReview 未指向 openToday：' + fn); return false; }
  /* 负锚：accent 软底那一条规则与类名都不许回来（先剥注释，避免注释里提一嘴就假红） */
  const code = codeOnly(HOME);
  return !code.includes('foot-link.cta') && !code.includes('foot-link cta');
});

check('M4-2 宿主不渲染常驻卡：TodayBattleHost 的可见内容全部挂在「日详情弹窗 / 记录抽屉」的开关之下（v-if / open），根节点只有一只空壳锚', () => {
  const i = HOST.indexOf('<template>');
  const j = HOST.indexOf('</template>', i);
  const tpl = i >= 0 && j > i ? HOST.slice(i, j) : '';
  if (!tpl) { console.log('     模板切片为空'); return false; }
  return tpl.includes('class="dz-battle-host"')
    && tpl.includes('<Teleport')
    && tpl.includes('v-if="dashSelDay"')
    && tpl.includes(':open="logOpen"')
    && !tpl.includes('class="card');
});

/* ============ M5 · 三卡同构 ============ */
check('M5-1 ★V3.9.1 随迁备案：两张主工作板共用 lg 圆角；三张卡不再各自起框，而是同一块手边板内的三列', () => {
  const rule = (HOME.match(/^\.work-board,\n\.hand-board \{[^}]*\}/m) || [''])[0];
  if (!rule) { console.log('     规则缺失'); return false; }
  return rule.includes('border-radius: var(--radius-lg)')
    && rule.includes('background: var(--surface)')
    && HOME.includes('class="hand-grid"');
});

check('M5-2 卡内单元同圆角：任务卡 / 好奇心卡 / 资源卡的卡片本体都取 md（原来好奇心卡是 sm，差一档就让"同一族的卡"看起来像两套东西）', () => {
  /* 不用动态 RegExp：转义层数一多，`^\\.x` 会被写成"反斜杠 + 任意字符"，判据静默拿到空串。
     直接按行首定位 + 截到行内第一个右花括号，规则里不含 `}`，够用且不会写坏。 */
  const pick = (src, sel) => {
    const i = src.indexOf('\n' + sel + ' {');
    if (i < 0) return '';
    const j = src.indexOf('}', i);
    return j > i ? src.slice(i, j + 1) : '';
  };
  const tm = pick(TM, '.tm-card');
  const cz = pick(CZ, '.cz-card');
  const pcp = pick(PCP, '.pcp-card');
  const bad = [];
  for (const [n, r] of [['tm', tm], ['cz', cz], ['pcp', pcp]]) {
    if (!r) { bad.push(n + '=规则缺失'); continue; }
    if (!r.includes('border-radius: var(--radius-md)')) bad.push(n + '=' + (r.match(/border-radius:\s*[^;]+/) || ['?'])[0]);
  }
  if (bad.length) console.log('     ' + bad.join(' | '));
  return bad.length === 0;
});

check('M5-3 卡头同源：三张卡都走 DeckControls（左筛选 · 右缘操作），右缘对齐由 dk-count 的 margin-left:auto 一处承担 —— 不再三份各写一遍', () => {
  const all = [TM, CZ, PCP].every((s) => s.includes("import DeckControls from './DeckControls.vue'") && s.includes('<DeckControls'));
  return all
    && DK.includes('<div class="dk-row" :data-panel="panel">')
    && /\.dk-count \{[^}]*margin-left:\s*auto/.test(DK);
});
