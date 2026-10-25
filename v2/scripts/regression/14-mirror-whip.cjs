/**
 * 14-mirror-whip.cjs —— B3「镜子不鞭子」（V3.8.28）常驻判据。
 *
 * 四项是同一类病：把「读数」做成了「评价」。
 *   M1 指标条读数中性化（未归档去琥珀 + 口径 tooltip + 全页琥珀 ≤2）
 *   M2 指标条降噪降层（caption 网格 + 去投影 + 让位 hero 主角）
 *   C1 方向台计数行收敛（发丝线分隔 + 健康度徽章去药丸高亮 + 每个读数有口径）
 *   A2 镜面口径中性化（KPI 数值零红绿 + 环比徽标零红绿 + 每个 KPI 有 tooltip）
 *
 * 纪律：本分片只锁两件结构事实 ——「颜色不参与评价」与「读数说得出自己的口径」。
 * 具体色值不在这里锁（那是 theme-contrast 的活），像素走 AB。
 * ★注释里不许出现禁词字面量本身：判据用 includes/正则扫源码，自己写的注释会把判据喂绿（R71 教训）。
 */
const { check, read } = require('./helpers.cjs');

const MB = read('/newtab/components/compass/MetricBar.vue');
const HOME = read('/newtab/views/CompassHome.vue');
const TREE = read('/newtab/views/CompassTree.vue');
const PI_CSS = read('/newtab/components/profile/pi-timeline.css');
const PI_OVERVIEW = read('/newtab/components/profile/PiOverview.vue');

console.log('【B3 · V3.8.28：镜子不鞭子（M1 / M2 / C1 / A2）】');

/* ============ M1 · 指标条读数中性化 ============ */
check('M1-1 未归档读数不再被染色催促：MetricBar 全文零警示类、零琥珀令牌（含注释——注释复述禁词同样算回流）', () => {
  const bad = [];
  if (/st-warn/.test(MB)) bad.push('st-warn');
  if (/tag-warn/.test(MB)) bad.push('tag-warn');
  if (/var\(--warning\)/.test(MB)) bad.push('var(--warning)');
  if (bad.length) console.log('     残留：' + bad.join(' / '));
  return bad.length === 0;
});

check('M1-2 未归档读数说得出自己的口径：tooltip 讲清「是什么（未挂项目/指标或引用失效）+ 尚未归位 + 分母 + 可下钻」', () => {
  return MB.includes('未归档任务 = 未挂项目/指标、或引用已失效的任务，尚未归位到方向')
    && MB.includes('分母为全部未删任务')
    && MB.includes('口径同明细')
    && MB.includes('点击下钻归档');
});

check('M1-3 ★V3.9.1 随迁备案：全页琥珀上限 ≤3 处，现役两栏首页的状态载体比单栏多一处；仍靠虚线、文字与图标表达提示，不用颜色二次催促', () => {
  const style = HOME.slice(HOME.indexOf('<style'), HOME.lastIndexOf('</style>'));
  const hits = style.split('\n').filter((l) => /--tag-warn|var\(--warning\)/.test(l) && /(background|border|color):/.test(l));
  if (hits.length > 3) console.log('     当前 ' + hits.length + ' 条：' + hits.map((l) => l.trim().slice(0, 60)).join(' | '));
  return hits.length <= 3;
});

check('M1-4 ★V3.9.1 随迁备案：失效计划行仍去琥珀、留虚线；形态与「源任务已删除或归档 · 点这一行原位重新选取」承担提示', () => {
  const seg = (HOME.match(/\.stale-row \{[^}]*\}/) || [''])[0];
  return seg.includes('border-style: dashed')
    && seg.includes('background: transparent')
    && !/--tag-warn|--warning/.test(seg)
    && HOME.includes('源任务已删除或归档 · 点这一行原位重新选取');
});

/* ============ M2 · 指标条降噪降层 ============ */
check('M2-1 支撑层不浮起：指标条本体无投影（投影意味着「浮在上面」，而它该沉在三件事之下）', () => {
  const seg = (MB.match(/\.metric-bar \{[^}]*\}/) || [''])[0];
  if (/box-shadow/.test(seg)) console.log('     仍有投影：' + seg.slice(0, 120));
  return seg.includes('border-radius: var(--radius-md)') && !/box-shadow/.test(seg);
});

check('M2-2 读数行落 caption 网格：key/value 同为 caption 档，间距统一到 8px（原 6/2/5/7 混用）· 只降字号不降对比', () => {
  const k = (MB.match(/\.mb-k \{[^}]*\}/) || [''])[0];
  const v = (MB.match(/\.mb-v \{[^}]*\}/) || [''])[0];
  const row = (MB.match(/\.mb-row \{[^}]*\}/) || [''])[0];
  return k.includes('font-size: var(--fs-caption)')
    && v.includes('font-size: var(--fs-caption)')
    && row.includes('gap: 8px')
    && row.includes('max-height: 38px')
    && k.includes('color: var(--text-2)')
    && v.includes('color: var(--text);');
});

/* ============ C1 · 方向台计数行收敛 ============ */
check('C1-1 分隔符是刻度不是标点：hero-stats 不再用「·」中点，改 1px 发丝线。★V3.9.19 随迁备案（一处不两说，用户拍板 2026-10-24）：hero 六层结构读数整体迁战略骨架条，发丝线数量随读数缩到 2 条——刻度语言（规则原文 + 中点负锚）不动', () => {
  return !TREE.includes('<i>·</i>')
    && TREE.includes('.hs-sep { width: 1px; height: 10px; background: var(--border); flex: none; }')
    && (TREE.match(/class="hs-sep"/g) || []).length >= 2;
});

check('C1-2 健康度是镜面不是评分：徽章去强调实底与药丸高亮，改中性浅底 + text-2；warning 态不换色相', () => {
  const badge = (TREE.match(/^\.dhi-badge \{[^}]*\}/m) || [''])[0];
  const warn = (TREE.match(/^\.dhi-badge\.warning \{[^}]*\}/m) || [''])[0];
  if (!badge || !warn) { console.log('     规则缺失'); return false; }
  return badge.includes('background: var(--surface-2)')
    && badge.includes('color: var(--text-2)')
    && badge.includes('font-size: var(--fs-caption)')
    && !/accent-light|accent-ink/.test(badge)
    && !/tag-warn|--warning/.test(warn)
    && warn.includes('background: var(--surface-3)');
});

check('C1-3 ★V3.9.19 随迁备案（一处不两说，用户拍板 2026-10-24）：口径 tooltip 换了驻地——hero 只留状态读数（健康度/主攻/停滞，切片内 title ≥3），六层计数的口径随计数一起迁战略骨架条层位按钮（CompassSpine LV_TIP 六条经 :title 挂载）；hero 切片不得再报六层结构计数', () => {
  const i = TREE.indexOf('<div class="hero-stats">');
  const j = TREE.indexOf('</div>', i);
  const seg = i >= 0 && j > i ? TREE.slice(i, j) : '';
  const n = (seg.match(/title="/g) || []).length;
  const SPINE = read('/newtab/components/compass/CompassSpine.vue');
  const lvTips = (SPINE.match(/^  \d: '/gm) || []).length;
  const noStruct = !['愿景 {{', '使命 {{', '战略目标 {{', '项目 {{', '指标 {{', '任务 {{'].some(s => seg.includes(s));
  if (n < 3 || lvTips < 6 || !noStruct) console.log('     hero title=' + n + ' / LV_TIP=' + lvTips + ' / hero无六层计数=' + noStruct);
  return n >= 3 && lvTips >= 6 && SPINE.includes(':title="LV_TIP[lv.n]"') && noStruct;
});

check('C1-4 项目与指标同一把尺子：treeStats 的 metrics 按可见项目累加（原先含已隐藏项目 →「项目 3 · 指标 20」两份真相）', () => {
  return TREE.includes('metrics += vis.reduce((s, p) => s + p.metrics.length, 0)')
    && !TREE.includes('metrics += dir.projects.reduce(');
});

/* ============ A2 · 镜面口径中性化 ============ */
check('A2-1 KPI 数值零红绿：pi-chip 的五档语义类（ok/bad/acc/warn/up）不再改变数值颜色', () => {
  const i = PI_CSS.indexOf('.pi-chip.ok .v,');
  const j = PI_CSS.indexOf('/* ===== 分节标题');
  const seg = i >= 0 && j > i ? PI_CSS.slice(i, j) : '';
  if (!seg) { console.log('     锚点缺失'); return false; }
  return seg.includes('color: var(--text);') && !/var\(--(success|danger|warning|accent-ink)\)/.test(seg);
});

check('A2-2 环比徽标零红绿：涨跌不是好坏（动作涨是好事、熵涨是分散），方向由 +/− 号表达', () => {
  const i = PI_CSS.indexOf('.wk-badge.up, .m-badge.up');
  const j = PI_CSS.indexOf('.light-split {');
  const seg = i >= 0 && j > i ? PI_CSS.slice(i, j) : '';
  if (!seg) { console.log('     锚点缺失'); return false; }
  return !/var\(--(success|danger)\)/.test(seg) && seg.includes('var(--surface-3)');
});

check('A2-3 四格 KPI 每格都有口径 tooltip，且数值用中性 text（不按好坏上色）· V3.9.3 随四格归位概览', () => {
  // 四格读数已从 Hero 迁入 PiOverview；守的仍是「四格都有口径、数值中性」。
  const kpiCells = (PI_OVERVIEW.match(/<button class="pi-ov-kpi[^"]*"/g) || []).length;
  const titledCells = (PI_OVERVIEW.match(/<button class="pi-ov-kpi[^"]*"[^>]*:title=/g) || []).length;
  const n = titledCells;
  const v = (PI_CSS.match(/\.pi-ov-kpi \.v \{[^}]*\}/) || [''])[0];
  if (n < 4) console.log('     当前 ' + n + ' 格有 title');
  return n >= 4 && kpiCells === n
    && v.includes('color: var(--text)') && !/success|danger/.test(v);
});

check('A2-4 洞察卡与归属标签同样不裁决：one-insight / pi-tag 的 ok 与 warn 不落红绿琥珀', () => {
  /* ★W17-C09（2026-10-20）重指带备案：`.pi-tag` 那组归属标签随「今日三件事」退役被 dead-css 判死删除，
     所守意图（归属标记不做好坏裁决）改由仍在使用中的 `.one-insight` 与方向状态面板的 `.pi-dir-state` 承担。 */
  const ins = (PI_CSS.match(/\.one-insight\.(ok|warn)[^{]*\{[^}]*\}/g) || []).join('\n');
  const ov = read('/newtab/components/profile/PiOverview.vue');
  const state = (ov.match(/\.pi-dir-state[^{]*\{[^}]*\}/g) || []).join('\n');
  const bad = [];
  if (/var\(--(success|danger|warning)\)/.test(ins)) bad.push('one-insight');
  if (/var\(--(success|warning)\)|success-bg-soft/.test(state)) bad.push('pi-dir-state');
  if (bad.length) console.log('     仍按好坏上色：' + bad.join(' / '));
  return bad.length === 0 && ins.includes('var(--accent)')
    && state.includes('var(--text-3)')
    /* 负锚：已退役的 pi-tag 规则不许回流（dead-css 判死过） */
    && !/\.pi-tag \.?\{?/.test(PI_CSS.replace(/\/\*[\s\S]*?\*\//g, ''));
});
