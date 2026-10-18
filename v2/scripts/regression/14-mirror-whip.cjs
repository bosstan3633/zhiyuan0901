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
const PI_HERO = read('/newtab/components/profile/PiHero.vue');

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

check('M1-3 全页琥珀上限 ≤2 处：调度台样式里以琥珀作背景/边框的规则不超过两条（其余靠虚线、文字与图标表达）', () => {
  const style = HOME.slice(HOME.indexOf('<style'), HOME.lastIndexOf('</style>'));
  const hits = style.split('\n').filter((l) => /--tag-warn|var\(--warning\)/.test(l) && /(background|border|color):/.test(l));
  if (hits.length > 2) console.log('     当前 ' + hits.length + ' 条：' + hits.map((l) => l.trim().slice(0, 60)).join(' | '));
  return hits.length <= 2;
});

check('M1-4 失效槽卡去琥珀、留虚线：形态（dashed + 透明底）与文案（源任务已失效 · 重新选取）承担提示，颜色不再二次催促', () => {
  const seg = (HOME.match(/\.today-card\.stale-card \{[^}]*\}/) || [''])[0];
  return seg.includes('border-style: dashed')
    && seg.includes('background: transparent')
    && !/--tag-warn|--warning/.test(seg)
    && HOME.includes('源任务已失效 · 重新选取');
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
check('C1-1 分隔符是刻度不是标点：hero-stats 不再用「·」中点，改 1px 发丝线（与骨架条 gs-sep 同一语言）', () => {
  return !TREE.includes('<i>·</i>')
    && TREE.includes('.hs-sep { width: 1px; height: 10px; background: var(--border); flex: none; }')
    && (TREE.match(/class="hs-sep"/g) || []).length >= 8;
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

check('C1-3 八项读数都能悬停看口径：hero-stats 切片内 title 至少 8 条（愿景/使命/战略目标/项目/主攻/停滞/指标/任务）', () => {
  const i = TREE.indexOf('<div class="hero-stats">');
  const j = TREE.indexOf('</div>', i);
  const seg = i >= 0 && j > i ? TREE.slice(i, j) : '';
  const n = (seg.match(/title="/g) || []).length;
  if (n < 8) console.log('     当前 ' + n + ' 条 title');
  return n >= 8;
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

check('A2-3 四格 KPI 每格都有口径 tooltip，且数值用中性 text（不按好坏上色）', () => {
  // ★V3.8.36（A2）重指：原锚 `class="hero-kpi" :title=` 把 class 与 title 的**相邻关系**钉住了，
  // 而 A2 给第四格加了 hero-kpi-bar（进度条），字面量随之变长。守的是「四格都有口径」这件事，
  // 与第四格还带不带别的类无关，故改为分别计数：KPI 格数 + 带 title 的格数，两者相等即达标。
  const kpiCells = (PI_HERO.match(/<button class="hero-kpi[^"]*"/g) || []).length;
  const titledCells = (PI_HERO.match(/<button class="hero-kpi[^"]*"[^>]*:title=/g) || []).length;
  const n = titledCells;
  const v = (PI_CSS.match(/\.hero-kpi \.v \{[^}]*\}/) || [''])[0];
  if (n < 4) console.log('     当前 ' + n + ' 格有 title');
  return n >= 4 && kpiCells === n
    && v.includes('color: var(--text)') && !/success|danger/.test(v);
});

check('A2-4 洞察卡与归属标签同样不裁决：one-insight / pi-tag 的 ok 与 warn 不落红绿琥珀', () => {
  const ins = (PI_CSS.match(/\.one-insight\.(ok|warn)[^{]*\{[^}]*\}/g) || []).join('\n');
  const tag = (PI_CSS.match(/\.pi-tag\.(ok|warn) \{[^}]*\}/g) || []).join('\n');
  const bad = [];
  if (/var\(--(success|danger|warning)\)/.test(ins)) bad.push('one-insight');
  if (/var\(--(success|warning)\)|success-bg-soft/.test(tag)) bad.push('pi-tag');
  if (bad.length) console.log('     仍按好坏上色：' + bad.join(' / '));
  return bad.length === 0 && ins.includes('var(--accent)') && tag.includes('var(--surface-3)');
});
