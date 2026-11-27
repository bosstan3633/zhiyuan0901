/**
 * 分片 · 08-w14-focus：V3.8.23 批「主攻项目详情抽屉 + 顶部瘦身」的新增判据（W14-1 ~ W14-4）。
 * 为什么独立成分片：05/06/07 已开，本轮新代判据另开分片 —— 门禁原意是「上限靠加分片而不是放宽」。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const HERO = read('/newtab/components/profile/PiHero.vue');
const OVERVIEW = read('/newtab/components/profile/PiOverview.vue');
const TODAY = read('/newtab/components/profile/PiToday.vue');
const PI = read('/newtab/views/ProfileInsights.vue');
const PDD = read('/newtab/components/ProjectDetailDrawer.vue');
const CSS = codeOnly(read('/newtab/components/profile/pi-timeline.css'));

console.log('【W14 · 主攻项目详情抽屉 + 顶部瘦身（V3.8.23 批）】');

check('W14-1（V4.7.7 重指）★画像卡片分析不再重复方向台：用户拍板删除「你的方向状态」模块，主攻项目点击能力整体退出画像页；保留四格读数与选题成果下钻，项目详情只能在方向台 / 方向台抽屉打开。★备案：原判据守「主攻胶囊必须落到那个项目」，本轮按明确拍板整体下线该模块，故改钉无方向面板、无 open-project 回流、无重复项目详情抽屉入口，能力去向写明在方向台。', () => {
  const HERO_C = codeOnly(HERO);
  const TODAY_C = codeOnly(TODAY);
  /* ★V4.7.7 重指：方向状态模块整体退役。这里不再守一个已不存在的入口，而是守
     「不回流 + 四格能力仍在 + 详情抽屉不在画像页二次悬挂」三件事。 */
  return !OVERVIEW.includes('你的方向状态')
    && !OVERVIEW.includes('PERSONAL DIRECTION')
    && !OVERVIEW.includes('focusProjects')
    && !OVERVIEW.includes("emit('open-project'")
    && !PI.includes(':focus-projects="heroFocusProjects"')
    && !PI.includes('@open-project="openProjectDetail"')
    && !PI.includes('<ProjectDetailDrawer')
    && OVERVIEW.includes("emit('kpi-drill', 'focus')")
    && ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && TODAY.includes('slotCount')
    && TODAY_C.includes('class="strip4"')
    && !HERO_C.includes('hcb-pill')
    && !HERO_C.includes('focusPills')
    && PDD.includes('TaskAddDrawer') && PDD.includes('width="480px"');
});

check('W14-2 ★V3.9.3 Hero 必须"薄"：页头 + 使命带两层，容器内距与层间 gap 在预算内；四格读数不再在 Hero 渲染，统一落到概览。概览四格仍须完整：四等宽、四格口径 tooltip、精力落主攻的中性进度条、hover 不抬升。', () => {
  const hero = CSS.match(/\.pi-hero\.hero-card \{[^}]*\}/)?.[0] || '';
  const grid = CSS.match(/\.pi-ov-kpis \{[^}]*\}/)?.[0] || '';
  const kpi = CSS.match(/\.pi-ov-kpi \{[^}]*\}/)?.[0] || '';
  const pad = (s) => {
    const m = s.match(/padding:\s*([\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px\s+([\d.]+)px)?/)
    if (m) return m.slice(1).map(x => parseFloat(x || '0'))
    /* V3.9.13：透明的零内距写作 padding: 0，旧四值解析器读不到——按等价零值处理。 */
    return /padding:\s*0(?:;|\s)/.test(s) ? [0, 0, 0, 0] : []
  };
  const [pt, pr, pb, pl] = pad(hero)
  const gapRow = parseFloat((hero.match(/gap:\s*([\d.]+)px/) || [0, '0'])[1])
  /* V3.9.13 重指：页头彻底去卡片壳后内距与层距都是 0；保留上限判据，同时负锚钉住卡片壳不回流。 */
  return pt === 0 && pr === 0 && pb === 0 && pl === 0
    && gapRow <= 10
    && hero.includes('background: transparent; border: 0;')
    && hero.includes('box-shadow: none;')
    && !/transform:\s*translateY/.test(kpi)                       /* ★负锚：hover 不许再抬升（常驻区要静） */
    && grid.includes('repeat(4, minmax(0, 1fr))')
    && (OVERVIEW.match(/<button class="pi-ov-kpi(?:\s|")/g) || []).length === 4
    && (OVERVIEW.match(/点击看明细/g) || []).length === 4
    && !codeOnly(HERO).includes('hero-kpis-grid')
    && !codeOnly(HERO).includes('hero-kpi')
    && !/\.pi-hero-sub\s*\{/.test(CSS)                          /* 副标题规则退役；注释备案可留 */
    && !/<p class="pi-hero-sub"/.test(HERO);
});

check('W14-3 ★Hero 不是视觉焦点：主标题降为 fs-title，且画像洞察页 CSS 与组件 codeOnly 内 fs-display 零命中 —— 原先 `.pi-hero-t` 用 fs-display(22px)，与"今日三件事 = 全页唯一 display 级主体"（W7-1/W7-2）的意图相悖：常驻路标不该抢焦点。眉标随标题并作一行（不再独占一行），使命带与读数行并作一行', () => {
  const t = CSS.match(/\.pi-hero-t \{[^}]*\}/)?.[0] || '';
  const PI_C = codeOnly(PI);
  return t.includes('font-size: var(--fs-title)')
    && !t.includes('fs-display')
    && !/--fs-display/.test(CSS)                                  /* 画像洞察页样式层零 display 级字号 */
    && !PI_C.includes('--fs-display')
    && HERO.includes('class="pi-hero-eyebrow"') && HERO.includes('画像洞察')
    && HERO.includes('class="hero-row-top"')
    /* ★W17-C09 重指：方向坐标带整体迁出 Hero（迁入 PiOverview 方向状态面板），
       于是"Hero 不抢焦点"反而更彻底 —— 负锚改成 Hero 内零方向带、零主攻胶囊。 */
    && !HERO.includes('class="hero-compass-bar"')
    && !HERO.includes('hcb-');
});

check('W14-4（V4.7.7 重指）★压体积不许压能力：页头三件套（刷新 · 导出 · 全部记录）零丢失、四格与四个选题成果下钻在概览零丢失、H2P 双类锚点保持（E2E-21 靠它）。原「使命轻引导出口」随方向状态模块整体退役，能力回到方向台，不在画像页重复。', () => {
  return HERO.includes("emit('refresh')") && HERO.includes('<ExportMenu')
    && HERO.includes("emit('open-log')") && HERO.includes('<Icon name="folder" :size="13"/> 全部记录')
    && ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && ['topic-all', 'topic-published', 'topic-supported', 'topic-month'].every(k => OVERVIEW.includes(`emit('topic-drill', '${k}')`))
    && HERO.includes('class="pi-hero hero-card"')                  /* E2E-21 双类锚点 */
    && !OVERVIEW.includes("(e: 'goto-compass'): void")
    && !OVERVIEW.includes('尚未设定使命愿景')
    && !OVERVIEW.includes('focusProjects');
});
