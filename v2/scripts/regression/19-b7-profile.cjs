/**
 * 分片 · 19-b7-profile：B7-a（V3.8.35）画像洞察页两项 P1 的新增判据（A1 ×5 / A3 ×7）。
 *
 * 为什么独立成分片：门禁的上限靠加分片兑现，不靠放宽（R164-2 单片 ≤900 行）。18 之后各片未开，
 * 本片只钉本批新增契约，历史断言一条未动、只重指（与 W16-1 / W14-2 / A2-3 有字面冲突的三处已重指）。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const HERO = read('/newtab/components/profile/PiHero.vue');
const PI = read('/newtab/views/ProfileInsights.vue');
const CSS = codeOnly(read('/newtab/components/profile/pi-timeline.css'));
const TODAY = read('/newtab/components/profile/PiToday.vue');
const RHY = read('/newtab/components/profile/PiRhythm.vue');
const MONTH = read('/newtab/components/profile/PiMonth.vue');
const YEAR = read('/newtab/components/profile/PiYear.vue');
const RANGE = read('/newtab/components/profile/PiRangeTabs.vue');
const OVERVIEW = read('/newtab/components/profile/PiOverview.vue');
/** 段头切片：四段各有自己的右缘操作（今日=按钮 / 本周=徽标+按钮 / 本月=徽标 / 本年=徽标），
 *  只看段头这一段，才不会把段身里的按钮误算成「右缘操作」。 */
const segHead = (src) => {
  const i = src.indexOf('<div class="pi-mod-h">');
  const j = src.indexOf('<div class="pi-mod-b">');
  return i >= 0 && j > i ? src.slice(i, j) : '';
};
/** 判据名统一走数组拼接：单引号字符串不能跨行，写成多行反而是语法错误。 */
const NAME = (...parts) => parts.join('');

console.log('【B7-a · 画像洞察：A1 Hero 主次归位 / A3 四段时间轴节奏统一（V3.8.35 批）】');

/* ══════════════════════ A1 · Hero 主次归位 ══════════════════════ */

check(NAME(
  'A1-1 ★使命主线是方向区的主角（★W17-C09 · 2026-10-20 重指带备案）：原判据守 Hero 内 .hero-compass-bar 的',
  '「无药丸底 + 左缘 accent 竖条 + 使命文本 fs-body/600」。本批方向带整体迁入 PiOverview 方向状态面板，',
  '所守意图不变，承重锚改到 .pi-dir-mission：无底色无边框、左缘竖条（inset 内画）、使命文本 600 字重。'), () => {
  const ov = read('/newtab/components/profile/PiOverview.vue');
  const m = ov.match(/\.pi-dir-mission \{[^}]*\}/)?.[0] || '';
  if (!m) { console.log('     锚点缺失'); return false; }
  if (/background:/.test(m)) return false;
  if (/border:/.test(m)) return false;
  if (!/box-shadow:\s*inset 3px 0 0 var\(--accent\)/.test(m)) return false;
  if (/border-left:/.test(m)) return false;
  return /font-weight:\s*600/.test((ov.match(/\.pi-dir-mission strong \{[^}]*\}/) || [''])[0])
    && !codeOnly(HERO).includes('hero-compass-bar')
    && !codeOnly(HERO).includes('hero-kpis-grid');
});

check(NAME(
  'A1-2 ★V3.9.3 概览四格读数保持中性、清晰的层级：数值用 --text 与 600 字重，',
  '不从颜色上做好坏裁决；说明行用较弱层级承担口径补充。'), () => {
  const v = CSS.match(/\.pi-ov-kpi \.v \{[^}]*\}/)?.[0] || '';
  if (!v) { console.log('     锚点缺失'); return false; }
  return /font-size:\s*var\(--fs-title\)/.test(v)
    && /font-weight:\s*600/.test(v)
    && /color:\s*var\(--text\)/.test(v)
    && !/font-weight:\s*700/.test(v)
    && !/var\(--(success|warning|danger)/.test(v);
});

check(NAME(
  'A1-3 ★使命线的两处前缀同步降档：「使命主线」标签补 600 字重 + 字距改走 tracking-sm 令牌',
  '（它只是路标的前缀，不是内容；字距不许留裸值），空态引导钮与正文同档',
  '（用户已设定的样子与「还没设定」不该一个字号）'), () => {
  /* ★W17-C09 重指：使命前缀随方向带迁入 PiOverview 方向状态面板（.pi-dir-mission .k）。 */
  const ov = read('/newtab/components/profile/PiOverview.vue');
  const b = ov.match(/\.pi-dir-mission \.k \{[^}]*\}/)?.[0] || '';
  return /font-size:\s*var\(--fs-micro\)/.test(b)
    && /font-weight:\s*700/.test(b)
    && /letter-spacing/.test(b)
    && /font-size:\s*var\(--fs-body\)/.test((ov.match(/\.pi-dir-mission strong \{[^}]*\}/) || [''])[0]);
});

check(NAME(
  'A1-4 ★能力零损失（降噪不许降能力）：四个下钻出口与四格口径 tooltip 全在概览、',
  '主攻胶囊与空态引导出口在 Hero、E2E-21 的双类锚点不动 —— 本项只动承载位置，一个出口都不许少'), () => {
  return ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && (OVERVIEW.match(/<button class="pi-ov-kpi[^"]*"[^>]*:title=/g) || []).length === 4
    && (OVERVIEW.match(/点击看明细/g) || []).length === 4
    && (OVERVIEW.match(/emit\('kpi-drill', '/g) || []).length === 4
    /* ★W17-C09 重指：主攻项目与使命空态引导迁入方向状态面板，能力零损失（E2E-21 双类锚点仍在）。 */
    && OVERVIEW.includes("(e: 'open-project', projectId: string): void")
    && OVERVIEW.includes("(e: 'goto-compass'): void")
    && OVERVIEW.includes('尚未设定使命愿景') && OVERVIEW.includes('focusProjects')
    && HERO.includes('class="pi-hero hero-card"');
});

check(NAME(
  'A1-5 ★窄屏回落仍然成立：概览双栏折成单栏、概览四格折成两列、页头动作组左对齐（900 / 640px 断点）'), () => {
  const mq = CSS.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/)?.[0] || '';
  const mq2 = CSS.match(/@media \(max-width: 640px\) \{[\s\S]*?\n\}/)?.[0] || '';
  return /\.pi-overview \{ grid-template-columns: 1fr; \}/.test(mq)
    && /\.pi-hero-acts \{ justify-content: flex-start; \}/.test(mq)
    && /\.pi-ov-kpis \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/.test(mq2);
});

/* ══════════════════════ A3 · 四段时间轴节奏统一 ══════════════════════ */

check(NAME(
  'A3-1 ★四段共用一套段落头规范：段头 fs-headline(17px) 由**一条** CSS 规则承载，',
  '四段模板零私有字号（原先段头虽已是 17px，但没有判据守着，任何一段加一条覆盖就静默分叉）；',
  '四段的段内说明文字共用同一条 caption 档位'), () => {
  const h = CSS.match(/\.pi-mod-t h2 \{[^}]*\}/)?.[0] || '';
  const p = CSS.match(/\.pi-mod-t p \{[^}]*\}/)?.[0] || '';
  if (!h || !p) { console.log('     锚点缺失'); return false; }
  if (!/font-size:\s*var\(--fs-headline\)/.test(h)) return false;
  const heads = [TODAY, RHY, MONTH, YEAR].map(segHead);
  if (heads.some(s => !s)) { console.log('     段头切片缺失'); return false; }
  /* 任何 font-size 写在段头切片里即为分叉 */
  return !heads.some(s => /font-size/.test(s))
    && /font-size:\s*var\(--fs-caption\)/.test(p)
    && [TODAY, RHY, MONTH, YEAR].every(s => s.includes('<div class="pi-mod-t">'));
});

check(NAME(
  'A3-2 ★V3.9.3 单段时间轴：四个时间尺度必须四选一挂载，默认「本年」，',
  '不再用三条 pi-sep 把四段纵向拉成长页；页签与左轨共用 activeRange，',
  '切换时只换当前模块。负锚：四段同时存在与旧发丝线盒零回流。'), () => {
  const mods = CSS.match(/\.pi-rmods-single[^{]*\{[^}]*\}/)?.[0] || '';
  const mounts = [
    /<PiToday v-if="activeRange === 'today'"/,
    /<PiRhythm v-else-if="activeRange === 'week'"/,
    /<PiMonth v-else-if="activeRange === 'month'"/,
    /<PiYear v-else/
  ];
  /* ★W17-C09（2026-10-20 用户拍板）重指带备案：默认范围从「本年」改为「今天」（页面定位改为使用状态），
     左轨 onRailJump 随时间线退役；所守意图不变——四个时间尺度四选一挂载、页签是唯一导航、旧发丝线零回流。 */
  /* ★W18 重指：默认范围回到「本年」（用户拍板），所守意图（四选一挂载 + 页签唯一导航）不变。 */
  return PI.includes("const activeRange = ref<PiRange>('year')")
    && mounts.every(re => re.test(PI))
    && PI.includes('<PiRangeTabs :model-value="activeRange" @update:model-value="setRange($event)"')
    && PI.includes('function setRange(k: PiRange): void')
    && !PI.includes('@jump="onRailJump"') && !PI.includes('<PiRail')
    && mods.includes('animation: pi-range-in')
    && (PI.match(/class="pi-sep"/g) || []).length === 0;
});

check(NAME(
  'A3-3 ★页签必须是真的 tablist：四个 role=tab、aria-selected 与 tabindex 跟随选中，',
  '支持左右方向键循环、Home / End 直达首尾；默认本年必须由页签自身表达，而不是靠 CSS 隐藏。'), () => {
  return RANGE.includes('role="tablist"') && RANGE.includes('aria-label="画像洞察时间范围"')
    && (RANGE.match(/role="tab"/g) || []).length === 1
    && RANGE.includes(':aria-selected="props.modelValue === t.key"')
    && RANGE.includes(':tabindex="props.modelValue === t.key ? 0 : -1"')
    && RANGE.includes("e.key === 'ArrowRight'") && RANGE.includes("e.key === 'ArrowLeft'")
    && RANGE.includes("e.key === 'Home'") && RANGE.includes("e.key === 'End'")
    && RANGE.includes("modelValue: 'year'");
});

check(NAME(
  'A3-4 ★V3.9.3 单段视觉去套娃：热力盒 pi-hmbox 不再自带第二层厚卡底与内距，',
  '全年热力图直接落在 PiYear 的段体里；段内一级卡仍只有 lbox 一档圆角。',
  '负锚：热力盒不许恢复 surface-2 底、边框或内边距，旧 .pi-sep 规则也不许回流。'), () => {
  const hm = CSS.match(/\.pi-hmbox \{[^}]*\}/)?.[0] || '';
  const lb = CSS.match(/\.lbox \{[^}]*\}/)?.[0] || '';
  if (!hm || !lb) { console.log('     锚点缺失'); return false; }
  return /background:\s*transparent/.test(hm)
    && /border-radius:\s*0/.test(hm)
    && /padding:\s*0/.test(hm)
    && /border-radius:\s*var\(--radius-lg\)/.test(lb)
    && !CSS.includes('.pi-sep {') && !CSS.includes('.pi-sep::before');
});

check(NAME(
  'A3-5 ★段头右缘操作四段同模具：本年段原先是四段里唯一右缘空着的，',
  '横向扫四段时第三段有徽标、第四段什么都没有 —— 补一枚同模具的 m-badge。',
  '口径纪律：它报「本年活跃天数」，是 strip4 四格之外的**时间刻度**，不与格内读数重复'), () => {
  const heads = [TODAY, RHY, MONTH, YEAR].map(segHead);
  if (heads.some(s => !s)) { console.log('     段头切片缺失'); return false; }
  return heads.every(s => s.includes('<div class="pi-mod-acts">'))
    && YEAR.includes('本年活跃 {{ ya.act }} 天')
    && YEAR.includes('年内有动作的天数 = ')
    /* 今日=按钮 / 本周=徽标 / 本月=徽标 / 本年=徽标，四段右缘各有各的实体，不是同一枚复制 */
    && TODAY.includes('<button class="pi-btn line"') && RHY.includes('class="wk-badge"')
    && MONTH.includes('class="m-badge"') && YEAR.includes('class="m-badge"');
});

check(NAME(
  'A3-6 ★四段内容能力零损失：三段式结构（诊断条 + strip4 + 内容）四段都在、',
  '各段专属出口（今日=战报 / 本周=错误+柱+目标 / 本月=主题+漏斗 / 本年=热力+生命周期）一个不少，',
  '本批新增的发丝线与徽标不许顶掉任何一个既有出口'), () => {
  return [TODAY, RHY, MONTH, YEAR].every(s => (s.match(/class="one-insight"/g) || []).length === 1)
    && [TODAY, RHY, MONTH, YEAR].every(s => s.includes('class="strip4"'))
    /* ★W17-C09 重指：今日段三行对账退役（bind/归位能力唯一归调度台），',
       改为守「打开战报 + 焦点格去调度台」两个专属出口。 */
    && TODAY.includes("emit('open-battle')") && TODAY.includes("emit('open-focus')")
    && RHY.includes("emit('open-err')") && RHY.includes("emit('goal-drill', g.id)")
    && MONTH.includes("emit('topic', t.tag)") && MONTH.includes('class="funnel3"')
    && YEAR.includes('<Heatmap') && YEAR.includes('<LifecyclePanel')
    && YEAR.includes("emit('lc-settings')") && YEAR.includes("emit('drill', 'yr-assets')");
});

check(NAME(
  'A3-7 ★年度热力图是默认主视觉：PiYear 传 default-expanded，Heatmap 初值跟随 prop，',
  '因此进入画像页第一眼就是全年 53 周，而不是近 26 周概览条；点任意热力格必须',
  '同时保留选中态并打开该日战报（open-battle 不能再只挂无人调用的旧出口）。'), () => {
  const HM = read('/newtab/components/dashboard/Heatmap.vue');
  return HM.includes('defaultExpanded?: boolean')
    && HM.includes('const expanded = ref(!!props.defaultExpanded)')
    && YEAR.includes('default-expanded')
    && YEAR.includes('function onHeatmapSel(day: string | null)')
    && YEAR.includes("emit('update:selDay', day)")
    && YEAR.includes("if (day) emit('open-battle', day)")
    && YEAR.includes('@update:sel-day="onHeatmapSel"')
    && PI.includes('@open-battle="openDayBattle"');
});

check(NAME(
  'A3-9 ★首屏先方向再行动：PiOverview 独立承载「本周精力」与「今天三件事」双栏，',
  '四格核心读数与既有下钻在概览左栏同源承载；宿主不直接堆这套模板，避免超过 W13-8 行数闸。'), () => {
  /* ★W17-C09（2026-10-20 用户拍板）重指带备案：首屏从「本周精力 + 今天三件事」双栏改为
     「知源产品使用状态 + 你的方向状态」双面板——今天三件事与调度台重复，用户要求移除。
     所守意图（首屏先给方向、四格读数与下钻在概览同源承载、宿主不堆模板）一条未减。 */
  return PI.includes('<PiOverview') && PI.includes(':mission-text="heroMission"')
    && PI.includes(':focus-projects="heroFocusProjects"')
    && PI.includes('@kpi-drill="onHeroDrill"')
    && OVERVIEW.includes('class="pi-overview"')
    && OVERVIEW.includes('知源产品使用状态')
    && OVERVIEW.includes('你的方向状态')
    && !/class="pi-ov-lines"/.test(OVERVIEW)
    && ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && OVERVIEW.includes("emit('open-project', p.id)")
    && OVERVIEW.includes("emit('goto-compass')");
});

/* ══════════════════════ A3-8 · 产物级：模板真编译（★堵「读源码发现不了」的盲区） ══════════════════════ */

check(NAME(
  'A3-8 ★★模板必须真编译过：源码里节点在 ≠ 编译产物里节点在 —— 这是 V3.8.35 实测踩到的最隐蔽的一个坑，',
  'PiYear 段头注释第一版里写了带反引号的类名，Vue 的 template 解析按 HTML 注释规则走，注释被判成未正常闭合，',
  '后面整段模板（含本枚徽标与整个 pi-mod-b 段体）被静默降级成注释文本丢弃。源码在位、tsc 绿、build 绿、',
  'A3-5 那类读源码的判据也全绿 —— 只有实拍 DOM 才看得出段头右缘空着。因此本条不走 read()，',
  '走 compiler-sfc 真编译 template，断言四段的段头/段身/右缘三个容器都进入了编译输出。'), () => {
  const fs = require('fs');
  const path = require('path');
  const { parse, compileTemplate } = require('@vue/compiler-sfc');
  const base = path.resolve(__dirname, '..', '..', 'src', 'newtab', 'components', 'profile');
  const files = ['PiToday.vue', 'PiRhythm.vue', 'PiMonth.vue', 'PiYear.vue'];
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(base, f), 'utf8');
    const { descriptor, errors } = parse(src, { filename: f });
    if (errors.length) { bad.push(`${f}:parse`); continue; }
    const r = compileTemplate({ source: descriptor.template.content, filename: f, id: 'x' });
    if ((r.errors || []).length) { bad.push(`${f}:compile`); continue; }
    for (const need of ['pi-mod-h', 'pi-mod-b', 'pi-mod-acts']) {
      if (!r.code.includes(need)) bad.push(`${f}:缺${need}`);
    }
  }
  if (bad.length) { console.log('     ' + bad.join(' / ')); return false; }
  return true;
});
