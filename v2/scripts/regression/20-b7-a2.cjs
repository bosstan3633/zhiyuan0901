/**
 * 分片 · 20-b7-a2：B7-b 的 A2「镜面口径中性化」（全库唯一未落地的 P0）新增判据。
 *
 * 为什么独立成分片：门禁上限靠加分片兑现，不靠放宽（R164-2 单片 ≤900 行）。
 * 本片只钉 A2 的新增契约，历史断言一条未动、只重指。
 *
 * ★为什么 A2 值得单独立片（它是 P0，且病根是「镜子带了鞭子」）：
 *   A2 原文三条要求 —— ① 数值 + 单位 + 口径 tooltip；② 数值一律中性色不做红绿好坏绑定；
 *   ③ 精力落主攻用百分比 + 中性进度条，不设阈值色；并明令「删除任何『值得警惕』式视觉」。
 *   前两条在 V3.8.28（B3）已基本落地，本片补的是**第三条（进度条）**与
 *   **评价式措辞/类名的清理**，以及把「不许回染」钉成棘轮。
 *
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const OVERVIEW = read('/newtab/components/profile/PiOverview.vue');
const RHY = read('/newtab/components/profile/PiRhythm.vue');
const MONTH = read('/newtab/components/profile/PiMonth.vue');
const TODAY = read('/newtab/components/profile/PiToday.vue');
const YEAR = read('/newtab/components/profile/PiYear.vue');
const CSS = codeOnly(read('/newtab/components/profile/pi-timeline.css'));

/** 判据名统一走数组拼接：单引号字符串不能跨行，写成多行反而是语法错误。 */
const NAME = (...parts) => parts.join('');

console.log('【B7-b · A2 镜面口径中性化（全库唯一未落地 P0 · V3.8.36 批）】');

/* ══════════════════════ A2-1 · 精力落主攻的中性进度条 ══════════════════════ */

check(NAME(
  'A2-1 ★精力落主攻必须有进度条（V3.9.3 随四格归位概览）：原实现只有裸数字 80%，',
  '「用百分比 + 中性进度条表达」的后半截一直缺着 —— 数字看不出它是个「占比」，读者无从判断 80% 是高是低。',
  '进度条三件：① 挂在第四格 .pi-ov-kpi-bar 上（只有这一格有「占多少」语义）',
  '② 轨 --surface-3 + 条 --accent 两种中性色 ③ 宽度做 0–100 夹取（数据越界不许撑破轨道）。',
  '★负锚：另外三格是计数与熵值，无占比语义，不许给它们也加轨。'), () => {
  const track = CSS.match(/\.pi-ov-kpi-track \{[^}]*\}/)?.[0] || '';
  const fill = CSS.match(/\.pi-ov-kpi-fill \{[^}]*\}/)?.[0] || '';
  // ★切片纪律（B5 教训）：定长窗口 `[\s\S]{0,700}` 会被注释行数挤爆，改按结构切——
  // 从带 bar 的那个 button 切到「四格容器收尾」，与注释长度无关。
  const iCell = OVERVIEW.indexOf('<button class="pi-ov-kpi pi-ov-kpi-bar"');
  const iEnd = OVERVIEW.indexOf('\n      </div>', iCell);
  const cell = iCell >= 0 && iEnd > iCell ? OVERVIEW.slice(iCell, iEnd) : '';
  return OVERVIEW.includes('class="pi-ov-kpi pi-ov-kpi-bar"')
    && cell.includes('class="pi-ov-kpi-track"') && cell.includes('class="pi-ov-kpi-fill"')
    && cell.includes('Math.max(0, Math.min(100, props.focusShare))')
    && track.includes('background: var(--surface-3)') && fill.includes('background: var(--accent)')
    // 负锚：带轨的格子必须恰好一处。★计数必须走 codeOnly（剥注释）——
    // 类名在本段注释里被复述过一次（教训 R71-4：注释复述字面量会让自建断言假红）
    && (codeOnly(OVERVIEW).match(/pi-ov-kpi-track/g) || []).length === 1
    && (codeOnly(OVERVIEW).match(/pi-ov-kpi-bar/g) || []).length === 1;
});

check(NAME(
  'A2-2 ★进度条不许有阈值色 —— 这是它最容易回潮的地方：一旦有人给进度条按高低分段染色（<60 绿 / <80 黄 / else 红），',
  '镜子立刻变鞭子，且比原来的裸数字更具说服力（人会不自觉地把长度读成评分）。',
  '因此负锚钉三条：① 轨与条只准用 --surface-3 与 --accent 两个色令牌，',
  '② 样式里不许出现 heat/success/warning/danger 类色令牌 ③ 不许出现阈值线/分段选择器的写法。'), () => {
  const block = (CSS.match(/\.pi-ov-kpi-track \{[^}]*\}/)?.[0] || '')
    + (CSS.match(/\.pi-ov-kpi-fill \{[^}]*\}/)?.[0] || '');
  if (!block) { console.log('     进度条样式缺失'); return false; }
  return !/var\(--(heat-|success|warning|danger|info-blue)/.test(block)
    && !/nth-child|max-width:\s*\d+px;\s*border-left|nth-of-type/.test(block);
});

/* ══════════════════════ A2-3 · 评价式措辞清理 ══════════════════════ */

check(NAME(
  'A2-3 ★「值得警惕」式措辞零残留：A2 原文明令删除。本批改掉的是本周段的分区标题「偏离预警」——',
  '「预警」是替用户宣布「你偏离了」，是评价而非事实；改为「规则对照」，只陈述',
  '「哪条规则的实测值与阈值不同」，好坏判断交还用户。负锚走 codeOnly 剥注释再判，',
  '否则「退役说明」注释里提到旧名会被误判为违规。'), () => {
  const rhyTpl = codeOnly(RHY);
  return rhyTpl.includes('规则对照')
    && !/偏离预警|值得警惕|触目惊心|严重|糟糕/.test(rhyTpl)
    // 正锚：内容不许因此被删空 —— 规则清单本体与展开实体都还在
    && rhyTpl.includes('class="pi-rule-list"')
    && rhyTpl.includes('toggleRule(r.id)')
    && RHY.includes('v-if="rules.length"');
});

check(NAME(
  'A2-4 ★不许借用警告语义当交互态：原 `:class="{ warn: openRule !== r.id }"` 的 warn 表达的是**未展开态**，',
  '与「这条规则有警告」毫无关系 —— 借警告类名会让读者把「还没点开」读成「这条有问题」。',
  '改为语义自洽的 collapsed。★可读性备案（theme-contrast 实测打红后改）：折叠态三档同 --text-2、',
  '不靠文字深浅表达折叠（--text-4 在 notion 主题 ≈2:1，真机隐形，W12-G 会判红）；',
  '折叠与否靠正文块 .pi-rule-body 的有无区分，弱化交给 hover，不降对比度（R153-4）。'), () => {
  const card = RHY.match(/<button v-for="r in rules"[\s\S]{0,400}?@click="toggleRule\(r\.id\)"/)?.[0] || '';
  const css = CSS.match(/\.pi-chip\.pi-rule-card\.collapsed \.pi-rule-id \{[^}]*\}/)?.[0] || '';
  return card.includes(':class="{ collapsed: openRule !== r.id }"')
    && !card.includes('warn')
    && css.includes('color: var(--text-2)')
    // 负锚：折叠态不许挂任何警告色令牌
    && !/var\(--(success|warning|danger)/.test(
      (CSS.match(/\.pi-chip\.pi-rule-card\.collapsed[\s\S]*?\n\}/)?.[0] || ''));
});

/* ══════════════════════ A2-5 · 中性色棘轮（不许回染） ══════════════════════ */

check(NAME(
  'A2-5 ★语义类不许回染颜色：`.ok / .bad / .acc / .warn / .up` 在 A1 时已被降为**纯语义钩子**',
  '（模板仍在用，将来要做非颜色区分时有用），全部指向 `color: var(--text)`。',
  '本条是那道闸 —— A2 原文「数值一律中性色（不做红绿好坏绑定）」靠人自觉守不住，',
  '必须钉死：任何一个语义类一旦重新写上色令牌即红。'), () => {
  const rule = CSS.match(/\.pi-chip\.ok \.v,[\s\S]{0,300}?\{[^}]*\}/)?.[0] || '';
  if (!rule.includes('color: var(--text)')) { console.log('     语义类中性化规则缺失'); return false; }
  // 全库扫：pi-chip.<语义类> 后若紧跟花括号，块内不得含任何色令牌
  const re = /\.pi-chip\.(ok|bad|acc|warn|up)\b[^{]*\{([^}]*)\}/g;
  let m, bad = [];
  while ((m = re.exec(CSS)) !== null) {
    if (/var\(--(success|warning|danger|heat-|info-blue)/.test(m[2])) bad.push(m[1]);
  }
  if (bad.length) { console.log('     语义类被回染：' + [...new Set(bad)].join(',')); return false; }
  return true;
});

check(NAME(
  'A2-6 ★每个读数可悬停看口径（A2 验收原文）：画像页十八个读数格（段内 14 + 概览 4）逐一要有 title。',
  '★口径纪律：格子的语义类可以留（钩子），但**语义类不是口径** —— 口径必须写在 title 里说清分子分母，',
  '否则「80%」既不知道算什么，也不知道点进去看什么。负锚：段内语义格恰好 14 处、Hero 恰好 4 处，',
  '与实际渲染数一一对应（多一处说明新增了读数没补口径，少一处说明被删了口径）。'), () => {
  // 语义格 = 各段 strip4/指标行的 pi-chip（今日 4 / 本周 4 / 本月 4 / 全年 2）；
  // 概览四格走独立的 pi-ov-kpi 类，单独计。★两处都要 codeOnly，避免注释复述干扰计数。
  const body = [TODAY, RHY, MONTH, YEAR].map(codeOnly).join('\n');
  const cells = body.match(/<button class="pi-chip[^"]*"[^>]*title="/g) || [];
  const kpis = (codeOnly(OVERVIEW).match(/<button class="pi-ov-kpi[^"]*"[^>]*:title=/g) || []).length;
  if (cells.length !== 14) { console.log('     段内语义格数 = ' + cells.length + '（应为 14）'); return false; }
  if (kpis !== 4) { console.log('     概览 KPI 格数 = ' + kpis + '（应为 4）'); return false; }
  // 概览四格必须把分子分母说全：全库净资产=三类合计 / 熵=标签分布离散度 / 支撑=有支撑任务÷总数 / 落主攻=主攻动作÷总动作
  return OVERVIEW.includes('回收站不计')
    && OVERVIEW.includes('卡片标签分布的离散度')
    && OVERVIEW.includes('未删任务总数')
    && OVERVIEW.includes('近 30 天总有效动作');
});
