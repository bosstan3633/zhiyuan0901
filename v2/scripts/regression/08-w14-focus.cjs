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

check('W14-1 ★主攻项目的点击必须落在"那个项目"上，不能两枚胶囊同落一处：Hero 的 ≤2 枚 🚀 主攻胶囊点开的是**右侧滑出的项目详情抽屉**（ProjectDetailDrawer，与方向台/策展台同一枚），今日三件事行的 🚀 主攻标签同出口。★病根：胶囊原 @click="emit(\'drill\',\'focus\')" 不带项目 id，两枚胶囊点开的是同一个「主攻动作记录」抽屉，按下那一下就丢了"点的是哪一个"。断言钉四段：① PiHero 有独立发射器 open-project（不与 drill 混用 —— drill 的 focus 键语义归"近30天精力落主攻"那张底盘卡）② 胶囊点击带上 p.id ③ 宿主挂 ProjectDetailDrawer + openProjectDetail ④ 负锚：胶囊不再 emit drill focus。另：PiToday 主攻标签由 span 改 button（"看着能点"不算能点），TodayRow 带 projectId', () => {
  const HERO_C = codeOnly(HERO);
  const TODAY_C = codeOnly(TODAY);
  return HERO.includes("(e: 'open-project', projectId: string): void")
    && HERO.includes("emit('open-project', p.id)")
    /* 负锚：胶囊那一枚不许再 emit drill focus；focus 键的现役语义归概览四格。 */
    && !HERO.match(/hcb-pill[\s\S]{0,400}?emit\('drill', 'focus'\)/)
    && OVERVIEW.includes("emit('kpi-drill', 'focus')")
    && HERO.includes('点击查看项目详情')
    && PI.includes("import ProjectDetailDrawer from '@/newtab/components/ProjectDetailDrawer.vue'")
    && PI.includes('function openProjectDetail(projectId: string)')
    && PI.includes('<ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId"')
    /* V3.9.3 单段切换：Hero、首屏概览里的今日三件事、PiToday 主攻标签三处同接一个出口。
       计数增加是入口增加，不是放权；项目详情抽屉仍只有一枚。 */
    && (PI.match(/@open-project="openProjectDetail"/g) || []).length === 3
    && TODAY.includes("emit('open-project', r.projectId)")
    && TODAY_C.includes('pi-tag ok as-btn')
    && TODAY.includes('projectId: string')
    && PI.includes('projectId: pid')
    /* 抽屉本体仍是真的可编辑抽屉（有任务新建与删除确认），不是只读速览 */
    && PDD.includes('TaskAddDrawer') && PDD.includes('删除') && PDD.includes('useConfirm')
    && PDD.includes('width="480px"');
});

check('W14-2 ★V3.9.3 Hero 必须"薄"：页头 + 使命带两层，容器内距与层间 gap 在预算内；四格读数不再在 Hero 渲染，统一落到概览。概览四格仍须完整：四等宽、四格口径 tooltip、精力落主攻的中性进度条、hover 不抬升。', () => {
  const hero = CSS.match(/\.pi-hero\.hero-card \{[^}]*\}/)?.[0] || '';
  const grid = CSS.match(/\.pi-ov-kpis \{[^}]*\}/)?.[0] || '';
  const kpi = CSS.match(/\.pi-ov-kpi \{[^}]*\}/)?.[0] || '';
  const pad = (s) => {
    const m = s.match(/padding:\s*([\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px\s+([\d.]+)px)?/)
    return m ? m.slice(1).map(x => parseFloat(x || '0')) : []
  };
  const [pt, pr, pb, pl] = pad(hero)
  const gapRow = parseFloat((hero.match(/gap:\s*([\d.]+)px/) || [0, '99'])[1])
  return pt <= 14 && pr <= 18 && pb <= 14 && pl <= 18            /* 容器内距上限（原 20/22/18/22） */
    && gapRow <= 10
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
    && HERO.includes('class="hero-compass-bar"');
});

check('W14-4 ★压体积不许压能力：页头三件套（刷新 · 导出 · 全部记录）零丢失、四格下钻出口在概览零丢失、使命轻引导出口保留、H2P 双类锚点保持（E2E-21 靠它）', () => {
  return HERO.includes("emit('refresh')") && HERO.includes('<ExportMenu')
    && HERO.includes("emit('open-log')") && HERO.includes('<Icon name="folder" :size="13"/> 全部记录')
    && ['total', 'entropy', 'support', 'focus'].every(k => OVERVIEW.includes(`emit('kpi-drill', '${k}')`))
    && HERO.includes('class="pi-hero hero-card"')                  /* E2E-21 双类锚点 */
    && HERO.includes("(e: 'goto-compass'): void")                 /* 使命轻引导出口保留 */
    && HERO.includes('hcb-empty')
    && HERO.includes('focusPills');                                /* 主攻胶囊一枚未减 */
});
