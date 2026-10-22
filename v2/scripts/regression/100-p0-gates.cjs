/**
 * R174-1 分片纪律的延续 · 100-p0-gates：P0 组1 门禁（G1 emoji→Icon / C6 AI 标识统一 / A4 战报单入口）。
 * 从 99-recent 尾部**原样搬出**（分片是搬运不是重写，断言零丢失）——搬的原因是 R164-2 的
 * 「每个分片 ≤900 行」刹车被这批门禁断言顶到 976 行，按既有拍板处置是加分片而不是放宽上限。
 */
const {
  fs, path, base, check, codeOnly, ALL_VUE146,
} = require('./helpers.cjs');

// ============== P0 组1 门禁 · G1 emoji→Icon / C6 AI 标识统一 / A4 战报单入口 ==============
console.log('【P0 G1/C6/A4 · emoji→Icon 迁移 + AI 标识合规 + 战报单入口】');
// ★取证纪律：全部 fs 直读（禁 helpers.read——它对 Workspace.vue / search-overlay.ts 做多文件拼接，
//   会把相邻文件内容算进单文件，emoji/入口判定会误报）。判据来自 P0 方案 G1/C6/A4 验收原文。
check('P0-G1-A ★全站 .vue 系统组件（白名单文件除外）剥注释后真 emoji 残留 = 0（G1 验收：grep 系统组件内 emoji 字符 = 0）。白名单=R146-5/R161 同口径（AI 出品数据前缀/命中徽标文件）；用户数据内容（任务文案/卡标题/笔记）、情感表达区、空状态插画本就豁免，不计入系统 UI；wsIcons 映射行是用户工作台数据保留，亦豁免', () => {
  const WHITELIST = new Set(['/shared/components/AiMark.vue', '/newtab/components/GlobalPopups.vue', '/newtab/components/LinkCardsModal.vue']);
  const GEOM_KEEP = '▸▾▴◐○●◎◈▦▤⏎⌘⌨⛶↑↓←…›➜☆☐⚠⚙✍✎✦☰☑★✱☒ⓘ①';
  const KEEP_CP = new Set([...GEOM_KEEP].map(s => s.codePointAt(0)));
  const isTrueEmoji = (o) => (o >= 0x1f000 && o <= 0x1faff) || (o >= 0x2600 && o <= 0x27bf && !KEEP_CP.has(o)) || (o >= 0x2b00 && o <= 0x2bff) || (o === 0xfe0f || o === 0xfe0e);
  let dirty = [];
  for (const f of ALL_VUE146) {
    if (WHITELIST.has(f)) continue;
    const lines = codeOnly(fs.readFileSync(base + f, 'utf8')).split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (/wsIcons\s*[:=]/.test(line)) continue;
      for (let i = 0; i < line.length; ) {
        const c = line.codePointAt(i);
        if (isTrueEmoji(c)) { dirty.push(`${f} L${li + 1} ${JSON.stringify(line.slice(i, i + 4))}`); i += c > 0xffff ? 2 : 1; }
        else i += c > 0xffff ? 2 : 1;
      }
    }
  }
  return dirty.length === 0;
});
check('P0-G1-B ★Icon 组件覆盖 G1 审计清单全部图标（main-focus/stall/health/search/battle/bulb/trendup/trash/clock/warn/sparkle/broom/mirror/archive；restore 属审计清单但此前核实全站零 name="restore" 引用 → 契约写成「缺则必须零引用」，防覆盖缺漏而非逼着建死图标）', () => {
  const iconSrc = fs.readFileSync(base + '/shared/components/Icon.vue', 'utf8');
  const icStart = iconSrc.indexOf('const ICONS');
  const icBody = iconSrc.slice(icStart, iconSrc.indexOf('\n};', icStart));
  const need = ['main-focus', 'stall', 'health', 'search', 'battle', 'bulb', 'trendup', 'trash', 'clock', 'warn', 'sparkle', 'broom', 'mirror', 'archive'];
  const miss = need.filter(k => !new RegExp(`\\n {2}'?${k}'?:`).test(icBody));
  const restoreMissing = !new RegExp(`\\n {2}'?restore'?:`).test(icBody);
  const restoreRefs = ALL_VUE146.filter(f => fs.readFileSync(base + f, 'utf8').includes('name="restore"'));
  return miss.length === 0 && (!restoreMissing || restoreRefs.length === 0);
});
check('P0-C6-A ★全部 AI 功能入口收敛到 AiEntryButton 容器（唯一落点，R155-⑤）：全站 AiEntryButton 用户数 ≥ 16（既有 R146-5 ≥16 门槛保持为门禁红线），AiMark 只许被 AiEntryButton 引用（R155-10d 断言同源）', () => {
  const aeUsers = ALL_VUE146.filter(f => fs.readFileSync(base + f, 'utf8').includes('AiEntryButton')).length;
  const zhiRefs = ALL_VUE146.filter(f => fs.readFileSync(base + f, 'utf8').includes('@/shared/components/AiMark.vue') && !f.endsWith('AiEntryButton.vue') && !f.endsWith('AiMark.vue'));
  return aeUsers >= 16 && zhiRefs.length === 0;
});
check('P0-C6-B ★AI 字面量入口白名单：系统组件内凡出现 AI 入口文案（按钮/AiEntryButton 标签/AI 检索·建议·补全·诊断·研判·填表·拆解·通读·提炼等）的宿主必须走 AiEntryButton/AiMark/AiTouchedChip；白名单＝方向树弱显（R135-4 契约：mc-ai/ph-act/twm-item/dt-run 用 Icon sparkle/brain + title 明示，属「图标级弱显」）+ 非入口文本（导入模板规则复制钮/诊断报告导出字符串/复盘报告标题与状态提示/子任务输入框占位文案/设置页导航 mark）+ R146-5 豁免文件。判定用 codeOnly（退役说明注释里的 AI 词不咬断言）', () => {
  const weakWhitelist = new Set([
    '/newtab/components/compass/CompassLane.vue',
    '/newtab/components/compass/CompassPano.vue',
    '/newtab/components/compass/CompassTower.vue',
    '/newtab/components/compass/CompassTowerStatus.vue',
    '/newtab/views/ProfileInsights.vue',
    '/newtab/components/ImportTemplateModal.vue',
    '/newtab/components/compass/ProjectDiagnoseModal.vue',
    '/newtab/components/dashboard/ReviewReportModal.vue',
    '/shared/components/SubtaskList.vue',
    '/newtab/views/GlobalSettings.vue',
    '/shared/components/AiMark.vue', '/shared/components/AiEntryButton.vue', '/shared/components/AiTouchedChip.vue',
    '/newtab/components/GlobalPopups.vue', '/newtab/components/LinkCardsModal.vue',
    // CurationMindNode 的「AI 工具」是来源标签，不是 AI 功能入口；入口仍由共享 AI 组件承担。
    '/newtab/components/curation/CurationMindNode.vue',
    // 下钻抽屉的「AI 工具」同样是来源枚举标签，不是功能入口。
    '/newtab/components/CurationDrillDrawer.vue',
  ]);
  const ENTRY_RE = /(>AI |'AI |"AI |label="AI |>AI 建议|>AI 检索|>AI 补全|>AI 诊断|>AI 整理|AI 填表|AI 研判|AI 拆解|AI 通读|AI 提炼|：AI )/;
  const viol = [];
  for (const f of ALL_VUE146) {
    if (weakWhitelist.has(f)) continue;
    const raw = fs.readFileSync(base + f, 'utf8');
    if (!ENTRY_RE.test(codeOnly(raw))) continue;
    if (!(raw.includes('AiEntryButton') || raw.includes('AiMark') || raw.includes('AiTouchedChip'))) viol.push(f);
  }
  return viol.length === 0;
});
check('P0-A4 ★今日战报入口全局唯一：调度台 MetricBar 右槽 cta（battleHost.openToday）+ 画像洞察页 PiToday「打开战报」+ TodayBattleHost 自包含宿主（dz-battle-host）；全站不得出现第二处「今日战报」按钮入口（codeOnly 负锚，白名单＝宿主/明细/手册/回收站上下文）', () => {
  const ch = fs.readFileSync(base + '/newtab/views/CompassHome.vue', 'utf8');
  const pt = fs.readFileSync(base + '/newtab/components/profile/PiToday.vue', 'utf8');
  const tbh = fs.readFileSync(base + '/newtab/components/dashboard/TodayBattleHost.vue', 'utf8');
  const alt = ALL_VUE146.filter(f => {
    const c = codeOnly(fs.readFileSync(base + f, 'utf8'));
    return c.includes('今日战报') && (c.includes('@click') || c.includes('href'))
      && !f.includes('TodayBattleHost') && !f.includes('DayDetail') && !f.includes('CompassHome')
      && !f.includes('ProfileInsights') && !f.includes('PiToday') && !f.includes('GlobalPopups')
      && !f.includes('ManualPage') && !f.includes('changelog') && !f.includes('RecycleBin') && !f.includes('manual-data');
  });
  return ch.includes('battleHost.value?.openToday()') && ch.includes('<TodayBattleHost ref="battleHost" />')
    && (ch.match(/class="mb-act/g) || []).length <= 2
    && pt.includes("emit('open-battle')") && pt.includes('打开战报')
    && tbh.includes('class="dz-battle-host"')
    && alt.length === 0;
});
