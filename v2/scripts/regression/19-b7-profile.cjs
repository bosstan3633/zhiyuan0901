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
// V4.7.8：观察范围容器样式已移入页面自有 CSS，双视图断点从 pi-timeline.css 重指到这里。
const PROFILE_CSS = codeOnly(read('/newtab/views/ProfileInsights.css'));
const TODAY = read('/newtab/components/profile/PiToday.vue');
const RHY = read('/newtab/components/profile/PiRhythm.vue');
const MONTH = read('/newtab/components/profile/PiMonth.vue');
const YEAR = read('/newtab/components/profile/PiYear.vue');
const RANGE = read('/newtab/components/profile/PiRangeTabs.vue');
const OVERVIEW = read('/newtab/components/profile/PiOverview.vue');
const ANALYSIS = read('/newtab/components/profile/PiCardAnalysis.vue');
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
  'A1-1（V4.7.7 重指）★画像页不再承载方向主线：用户拍板删除「你的方向状态」后，',
  '使命主线 / 主攻项目 / 项目进度都不在画像卡片分析区重复；视觉主角让位给年度热力与卡片构成。',
  '备案：能力回到方向台，画像不保留第二个方向真源。'), () => {
  const ov = read('/newtab/components/profile/PiOverview.vue');
  return !ov.includes('你的方向状态')
    && !ov.includes('PERSONAL DIRECTION')
    && !ov.includes('focusProjects')
    && !ov.includes('class="pi-dir-mission"')
    && !/\.pi-dir-mission \{[^}]*\}/.test(ov)
    && !codeOnly(HERO).includes('hero-compass-bar')
    && !codeOnly(HERO).includes('hero-kpis-grid');
});

check(NAME(
  'A1-2（V4.7.4 重指）概览四格读数保持中性、清晰的层级：紧凑态的数值用 --text、',
  '--fs-headline 与 600 字重，不从颜色上做好坏裁决；口径补充收进 title，不再占一行。'), () => {
  const v = CSS.match(/\.pi-ov-kpi \.v \{[^}]*\}/)?.[0] || '';
  if (!v) { console.log('     锚点缺失'); return false; }
  return /font-size:\s*var\(--fs-headline\)/.test(v)
    && /font-weight:\s*600/.test(v)
    && /color:\s*var\(--text\)/.test(v)
    && !/font-weight:\s*700/.test(v)
    && !/var\(--(success|warning|danger)/.test(v);
});

check(NAME(
  'A1-3（V4.7.7 重指）★方向前缀与空态引导随「你的方向状态」整体退役：画像页不再渲染',
  '「使命主线」标签、空态引导钮或方向面板前缀；只保留产品自身的说明文案。'), () => {
  const ov = read('/newtab/components/profile/PiOverview.vue');
  return !ov.includes('使命主线')
    && !ov.includes('尚未设定使命愿景')
    && !ov.includes('class="pi-dir-mission"')
    && !ov.includes('class="pi-dir-go"');
});

check(NAME(
  'A1-4（V4.7.7 重指）★能力零损失（降噪不许降能力）：四格下钻、四格口径 tooltip 与',
  '四个选题成果下钻全在卡片构成面板；方向能力回归方向台，E2E-21 的双类锚点不动。'), () => {
  return ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && (OVERVIEW.match(/<button class="pi-ov-kpi[^"]*"[^>]*:title=/g) || []).length === 4
    && (OVERVIEW.match(/点击看明细/g) || []).length === 4
    && (OVERVIEW.match(/emit\('kpi-drill', '/g) || []).length === 4
    && ['topic-all', 'topic-published', 'topic-supported', 'topic-month'].every(k => OVERVIEW.includes(`emit('topic-drill', '${k}')`))
    && !OVERVIEW.includes("(e: 'open-project', projectId: string): void")
    && !OVERVIEW.includes("(e: 'goto-compass'): void")
    && !OVERVIEW.includes('尚未设定使命愿景') && !OVERVIEW.includes('focusProjects')
    && HERO.includes('class="pi-hero hero-card"');
});

check(NAME(
  'A1-5（V4.7.7 重指）★窄屏回落仍然成立：卡片分析单面板保持块级承载、概览四格折成两列、',
  '页头动作组左对齐（900 / 640px 断点）。★备案：方向面板退役后双栏折单栏失去承载，',
  '原 900px 双栏断言改钉单面板 `display:block`，不再保留已不存在的栅格列。'), () => {
  const mq = CSS.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/)?.[0] || '';
  const mq2 = CSS.match(/@media \(max-width: 640px\) \{[\s\S]*?\n\}/)?.[0] || '';
  return /\.pi-overview \{ display: block; \}/.test(CSS)
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
  'A3-2 ★V4.7.8 重指：观察范围收敛为「时间轴 / 卡片分析」双视图，默认卡片分析（时间轴保留 view=timeline 深链），',
  '年度热力独立常驻。负锚：旧四尺度 PiRangeTabs 不再作为页面唯一导航。'), () => {
  const mods = PROFILE_CSS.match(/\.pi-rmods-single[^{]*\{[^}]*\}/)?.[0] || '';
  return PI.includes("type ProfileView = 'timeline' | 'analysis'")
    && PI.includes("if (route.query.view === 'timeline') return 'timeline'")
    && PI.includes("return 'analysis'")
    && PI.includes('data-profile-view="timeline"')
    && PI.includes('data-profile-view="analysis"')
    && PI.includes('<PiTimeline')
    && PI.includes('<PiAnnualHeatmap')
    // V4.7.8 重指备案：默认视图翻转为卡片分析；双视图由 role=tabpanel 包裹，时间轴改走显式深链。
    && PI.includes('id="pi-view-panel-analysis"')
    && PI.includes('<PiCardAnalysis')
    && !PI.includes('<PiRangeTabs')
    && !PI.includes('@jump="onRailJump"') && !PI.includes('<PiRail')
    && mods.includes('display: flex')
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
  'A3-5（V3.9.27 重指）★段头右缘操作四段同模具，但年度段不再复制活跃读数：',
  '本年段右缘保留与其它段同模具的动作容器和 AI 入口；「本年活跃」只由 strip4 承载一次，',
  '热力图内部摘要同时关闭，避免同一读数在首屏重复三次'), () => {
  const heads = [TODAY, RHY, MONTH, YEAR].map(segHead);
  if (heads.some(s => !s)) { console.log('     段头切片缺失'); return false; }
  return heads.every(s => s.includes('<div class="pi-mod-acts">'))
    && !YEAR.includes('<PiAiReview')
    && !YEAR.includes(':ai="props.ai"')
    && YEAR.includes(':show-summary="false"')
    && !YEAR.includes('本年活跃 {{ ya.act }} 天')
    /* 今日=按钮 / 本周=徽标 / 本月=徽标 / 本年=留白；周期 AI 已整体退役，年度不再复述活跃读数 */
    && TODAY.includes('<button class="pi-btn line"') && RHY.includes('class="wk-badge"')
    && MONTH.includes('class="m-badge"') && !YEAR.includes('class="m-badge"');
});

check(NAME(
  'A3-6 ★四段内容能力零损失：今天 / 本周 / 本月保留诊断条 + strip4 + 内容；年度段按 V3.9.23 拍板去掉诊断条，',
  '但 strip4 四格与热力图 / 生命周期两个专属出口一个不少；',
  '本批新增的发丝线与徽标不许顶掉任何一个既有出口'), () => {
  return [TODAY, RHY, MONTH, YEAR].every(s => !s.includes('<PiAiReview'))
    && [TODAY, RHY, MONTH, YEAR].every(s => !s.includes(':fallback="props.insight"'))
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
  'A3-9 ★V4.7.8 重指备案：卡片分析改由「四卡页签 + 三件事数据分析 + 资源生命周期」三段承载，',
  '首层不再挂载 PiOverview；「你的方向状态」不再渲染，年度热力与全库总览优先于分析页。'), () => {
  return PI.includes('<PiCardAnalysis')
    && !PI.includes(':mission-text="heroMission"')
    && !PI.includes(':focus-projects="heroFocusProjects"')
    && !PI.includes('@kpi-drill="onHeroDrill"')
    && !codeOnly(PI).includes('<PiOverview')
    && ANALYSIS.includes('role="tablist"')
    && !ANALYSIS.includes('<PiOverview')
    && ANALYSIS.includes('pi-focus-analysis')
    && ANALYSIS.includes('id="lc-sec"')
    && OVERVIEW.includes('class="pi-overview"')
    && OVERVIEW.includes('卡片构成与使用')
    && !OVERVIEW.includes('你的方向状态')
    && !/class="pi-ov-lines"/.test(OVERVIEW)
    && ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && !OVERVIEW.includes("emit('open-project', p.id)")
    && !OVERVIEW.includes("emit('goto-compass')");
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
