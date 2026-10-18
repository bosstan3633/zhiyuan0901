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
  'A1-1 ★Hero 的主角是「使命主线」而不是四个数字 —— 这是本项真正要治的病：改前**主次正好反过来**，',
  '主角被裹进一个 surface-2 + border 的药丸盒里、只分到 1 份宽，副带（KPI 读数）却裸着占 3 份宽、',
  '数字还比使命文本更大更重（13px/700 vs 12px/400），于是首眼落在数字上，读到的是仪表盘不是画像。',
  '三件修法逐条钉：① 药丸盒退役（底色/边框零残留，改左缘 accent 竖条，inset 内画不占宽度）',
  '② 使命文本抬档到 fs-body + 600，与 KPI 数字同档但更宽更重 ③ 权重反转 1:3 → 1:2'), () => {
  const bar = CSS.match(/\.hero-compass-bar \{[^}]*\}/)?.[0] || '';
  const em = CSS.match(/\.hcb-mission em \{[^}]*\}/)?.[0] || '';
  const row = CSS.match(/\.hero-data-row \.hero-compass-bar \{[^}]*\}/)?.[0] || '';
  const grid = CSS.match(/\.hero-data-row \.hero-kpis-grid \{[^}]*\}/)?.[0] || '';
  if (!bar || !em || !row || !grid) { console.log('     锚点缺失'); return false; }
  /* ① 药丸盒退役：底色与边框零残留。负锚走 codeOnly（注释里按纪律写了「药丸盒退役」，必须剥完再判） */
  if (/background:/.test(bar)) return false;
  if (/border:/.test(bar)) return false;
  if (!/box-shadow:\s*inset 3px 0 0 var\(--accent\)/.test(bar)) return false;
  /* 竖条必须 inset 内画：加 border-left 会与 Hero 卡面自身边框叠成双线 */
  if (/border-left:/.test(bar)) return false;
  /* ② 使命文本抬档 */
  return /font-weight:\s*600/.test(em)
    && CSS.includes('.hcb-mission { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--fs-body)')
    && /font-size:\s*var\(--fs-body\)/.test((CSS.match(/\.hcb-empty \{[^}]*\}/) || [''])[0])
    /* ③ 权重反转：主角拿大头、副带让位（原 1 1 240px / 3 1 460px） */
    && /flex:\s*1 1 300px/.test(row) && /flex:\s*2 1 420px/.test(grid)
    && !/flex:\s*1 1 240px/.test(row) && !/flex:\s*3 1 460px/.test(grid);
});

check(NAME(
  'A1-2 ★KPI 数字不许比使命文本更重：读数降为副带档（仍是 fs-body，但 weight 700 → 600，与使命 em 同档）。',
  '★降字重**不降对比度**（R153-4 的 AA 护栏原样成立）：色仍是 --text。',
  '负锚：数字不许退回 700（那正是「四个大数字压过使命线」的形态），也不许改成更浅的色（会把读数打成灰脚注）'), () => {
  const v = CSS.match(/\.hero-kpi \.v \{[^}]*\}/)?.[0] || '';
  if (!v) { console.log('     锚点缺失'); return false; }
  return /font-size:\s*var\(--fs-body\)/.test(v)
    && /font-weight:\s*600/.test(v)
    && /color:\s*var\(--text\)/.test(v)
    && !/font-weight:\s*700/.test(v)
    && !/--text-2|--text-3/.test(v);
});

check(NAME(
  'A1-3 ★使命线的两处前缀同步降档：「使命主线」标签补 600 字重 + 字距改走 tracking-sm 令牌',
  '（它只是路标的前缀，不是内容；字距不许留裸值），空态引导钮与正文同档',
  '（用户已设定的样子与「还没设定」不该一个字号）'), () => {
  const b = CSS.match(/\.hcb-mission b \{[^}]*\}/)?.[0] || '';
  return /font-size:\s*var\(--fs-caption\)/.test(b)
    && /font-weight:\s*600/.test(b)
    && /var\(--tracking-sm\)/.test(b)
    && !/letter-spacing:\s*\.\d+em/.test(b)
    && /font-size:\s*var\(--fs-body\)/.test((CSS.match(/\.hcb-empty \{[^}]*\}/) || [''])[0]);
});

check(NAME(
  'A1-4 ★Hero 的能力零损失（降噪不许降能力）：四个下钻出口全在、四格口径 tooltip 全在、',
  '主攻胶囊与空态引导出口在、E2E-21 的双类锚点不动 —— 本项只动视觉层级，一个出口都不许少'), () => {
  return ['total', 'entropy', 'support', 'focus'].every(k => HERO.includes(`emit('drill', '${k}')`))
    // ★V3.8.36（A2）重指：第四格新增 hero-kpi-bar（中性进度条），原锚把 class 字面量钉死会假红。
    // 改锚「带 title 的 KPI 格数 = 4」，守的是四格口径一个不少这件事本身。
    && (HERO.match(/<button class="hero-kpi[^"]*"[^>]*:title=/g) || []).length === 4
    && (HERO.match(/点击看明细/g) || []).length === 4
    && (HERO.match(/emit\('drill', '/g) || []).length === 4
    && HERO.includes("(e: 'open-project', projectId: string): void")
    && HERO.includes("(e: 'goto-compass'): void")
    && HERO.includes('hcb-empty') && HERO.includes('focusPills')
    && HERO.includes('class="pi-hero hero-card"');
});

check(NAME(
  'A1-5 ★窄屏回落仍然成立：使命带折行后 100% 宽、KPI 两列、页头动作组左对齐（900px 断点）—— ',
  '权重反转改的是 flex 比例，窄窗那套必须原样留着，否则窄屏会退回四列挤字'), () => {
  const mq = CSS.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/)?.[0] || '';
  return /flex-direction:\s*column/.test(mq)
    && /align-items:\s*stretch/.test(mq)
    && /grid-template-columns:\s*repeat\(2, 1fr\)/.test(mq)
    && /justify-content:\s*flex-start/.test(mq);
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
  'A3-2 ★段间发丝线：四段在视觉上真正立成四段（改前 72px 的大空档把它们读成四张散落的卡）。',
  '三处分隔线盒 + 间距由线盒承担而非 flex gap —— 负锚：pi-rmods 的 gap 必须是 0',
  '（若同时留 gap，间距就被算成两遍，段间变 64px）'), () => {
  const sep = CSS.match(/\.pi-sep \{[^}]*\}/)?.[0] || '';
  const line = CSS.match(/\.pi-sep::before \{[^}]*\}/)?.[0] || '';
  const mods = CSS.match(/\.pi-rmods \{[^}]*\}/)?.[0] || '';
  if (!sep || !line || !mods) { console.log('     锚点缺失'); return false; }
  const n = (PI.match(/class="pi-sep"/g) || []).length;
  return n === 3
    && /height:\s*var\(--sp-6\)/.test(sep) && /align-items:\s*center/.test(sep)
    && /height:\s*1px/.test(line) && /background:\s*var\(--border\)/.test(line)
    && /gap:\s*0/.test(mods) && !/gap:\s*72px/.test(mods)
    && !/gap:\s*var\(--sp-6\)/.test(mods);
});

check(NAME(
  'A3-3 ★发丝线必须写在卡外，所以只能是模板里的真节点而不是伪元素：',
  'pi-mod 有 overflow:hidden（裁圆角外的子元素），伪元素画不出卡外 —— 这条钉住「为什么是三处 div 而不是三条 CSS 规则」，',
  '防止后人顺手简化回伪元素并静默失效'), () => {
  const mod = CSS.match(/\.pi-mod \{[^}]*\}/)?.[0] || '';
  if (!/overflow:\s*hidden/.test(mod)) { console.log('     .pi-mod 已非 overflow:hidden，本条前提变化需重指'); return false; }
  /* 三个线盒必须带 aria-hidden：纯装饰节点不该进无障碍树 */
  return (PI.match(/class="pi-sep" aria-hidden="true"/g) || []).length === 3
    && !CSS.includes('.pi-mod + .pi-mod::before')
    && !CSS.includes('.pi-mod:not(:first-child)::before');
});

check(NAME(
  'A3-4 ★段内一级容器圆角统一 lg：热力盒 pi-hmbox 与四段里的 lbox 同为「段内一级卡」，',
  '原是一档 md 一档 lg，横向扫到全年段时节奏断一下；负锚钉死不许退回 md'), () => {
  const hm = CSS.match(/\.pi-hmbox \{[^}]*\}/)?.[0] || '';
  const lb = CSS.match(/\.lbox \{[^}]*\}/)?.[0] || '';
  if (!hm || !lb) { console.log('     锚点缺失'); return false; }
  return /border-radius:\s*var\(--radius-lg\)/.test(hm)
    && /border-radius:\s*var\(--radius-lg\)/.test(lb)
    && !/border-radius:\s*var\(--radius-md\)/.test(hm);
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
    && TODAY.includes("emit('open-battle')") && TODAY.includes("emit('bind', r.idx)")
    && RHY.includes("emit('open-err')") && RHY.includes("emit('goal-drill', g.id)")
    && MONTH.includes("emit('topic', t.tag)") && MONTH.includes('class="funnel3"')
    && YEAR.includes('<Heatmap') && YEAR.includes('<LifecyclePanel')
    && YEAR.includes("emit('lc-settings')") && YEAR.includes("emit('drill', 'yr-assets')");
});

check(NAME(
  'A3-7 ★四段的顺序锚与左轨仍对齐（发丝线是纯装饰，不许改动导航语义）：',
  '三个线盒必须排在四个段组件**之间**而不是之前/之后，否则 IntersectionObserver 的段序与滚动落点会错位 —— ',
  '负锚：线盒数恰为 3（多一个说明某段前多了一条，段序就错了）'), () => {
  const start = PI.indexOf('<div class="pi-rmods">');
  const end = PI.indexOf('\n      </div>\n    </div>');
  if (start < 0 || end < start) { console.log('     锚点缺失'); return false; }
  const mods = PI.slice(start, end);
  const order = [...mods.matchAll(/<div class="pi-sep"|<Pi(?:Today|Rhythm|Month|Year)\b/g)].map(m => m[0]);
  const want = ['<PiToday', '<div class="pi-sep"', '<PiRhythm', '<div class="pi-sep"', '<PiMonth', '<div class="pi-sep"', '<PiYear'];
  return JSON.stringify(order) === JSON.stringify(want);
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
