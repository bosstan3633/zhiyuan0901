/**
 * 分片 · 08-w14-focus：V3.8.23 批「主攻项目详情抽屉 + 顶部瘦身」的新增判据（W14-1 ~ W14-4）。
 * 为什么独立成分片：05/06/07 已开，本轮新代判据另开分片 —— 门禁原意是「上限靠加分片而不是放宽」。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const HERO = read('/newtab/components/profile/PiHero.vue');
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
    /* 负锚：胶囊那一枚不许再 emit drill focus —— 但**第四张底盘卡**（近30天精力落主攻）仍合法用它，
       那才是 focus 键的现役语义；所以负锚要钉在胶囊行上，不是全组件零命中 */
    && !HERO.match(/hcb-pill[\s\S]{0,400}?emit\('drill', 'focus'\)/)
    && HERO.includes("emit('drill', 'focus')")   /* 底盘卡那一枚仍在位（能力未减） */
    && HERO.includes('点击查看项目详情')
    && PI.includes("import ProjectDetailDrawer from '@/newtab/components/ProjectDetailDrawer.vue'")
    && PI.includes('function openProjectDetail(projectId: string)')
    && PI.includes('<ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId"')
    && (PI.match(/@open-project="openProjectDetail"/g) || []).length === 2   /* Hero + 今日三件事行两侧都接 */
    && TODAY.includes("emit('open-project', r.projectId)")
    && TODAY_C.includes('pi-tag ok as-btn')
    && TODAY.includes('projectId: string')
    && PI.includes('projectId: pid')
    /* 抽屉本体仍是真的可编辑抽屉（有任务新建与删除确认），不是只读速览 */
    && PDD.includes('TaskAddDrawer') && PDD.includes('删除') && PDD.includes('useConfirm')
    && PDD.includes('width="480px"');
});

check('W14-2 ★Hero 必须"薄"（用户拍板 2026-10-16 方案A 两行化 → ★W16-T1 指标区再降一档为纯文本读数行）：容器内距、层间 gap 压到上限值以内，且读数格**不得再有卡面**（无底色/无边框/无阴影/无圆角），说明文字收进 title 悬浮。★W16-T1 重指理由：W14-2 落地后指标仍是四张压扁的卡（截图实测仍"太突出"，占位约 96px），用户再拍板方案A「纯文本读数行」—— 病灶是常驻路标占着四个卡面压过真正的主角。负锚两项保留：四格仍等宽铺满（N7）、hover 不抬升。**从源码读常量比阈值**，不写死等值', () => {
  const hero = CSS.match(/\.pi-hero\.hero-card \{[^}]*\}/)?.[0] || '';
  const grid = CSS.match(/\.hero-kpis-grid \{[^}]*\}/)?.[0] || '';
  const kpi = CSS.match(/\.hero-kpi \{[^}]*\}/)?.[0] || '';
  const pad = (s) => {
    const m = s.match(/padding:\s*([\d.]+)px\s+([\d.]+)px(?:\s+([\d.]+)px\s+([\d.]+)px)?/)
    return m ? m.slice(1).map(x => parseFloat(x || '0')) : []
  };
  const [pt, pr, pb, pl] = pad(hero)
  const [kt, kr, kb, kl] = pad(kpi)
  const gapRow = parseFloat((hero.match(/gap:\s*([\d.]+)px/) || [0, '99'])[1])
  return pt <= 14 && pr <= 18 && pb <= 14 && pl <= 18            /* 容器内距上限（原 20/22/18/22） */
    && gapRow <= 10
    && kt <= 4 && kr <= 14 && kb <= 4 && kl <= 14                /* 读数格内距：方案A 已是纯文本，压到 2/14 */
    && CSS.includes('repeat(4, 1fr)')                            /* ★N7 负锚：四格仍等宽铺满 */
    && !/transform:\s*translateY/.test(kpi)                       /* ★负锚：hover 不许再抬升（常驻区要静） */
    /* ★W16-T1 负锚：读数格不许再有卡面 —— 底色/边框/圆角/阴影四项全清 */
    && /background:\s*transparent/.test(kpi) && !/border:\s*1px/.test(kpi.replace(/border-right[^;]*;/, ''))
    && !/border-radius/.test(kpi) && !/box-shadow/.test(kpi)
    && grid.includes('grid-template-columns: repeat(4, 1fr)')
    /* 说明文字收进 title：模板零命中 .d 节点（title 里带说明） */
    && !HERO.includes('class="d"') && !CSS.includes('.hero-kpi .d')
    && HERO.includes('点击看明细')
    && !CSS.includes('.pi-hero-sub')                             /* 副标题整段退役（含 CSS 规则） */
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
    && HERO.includes('class="hero-data-row"')                     /* 使命带与读数行并作一行 */
    && HERO.includes('class="hero-row-top"')
    && CSS.includes('.hero-data-row .hero-compass-bar') && CSS.includes('.hero-data-row .hero-kpis-grid');
});

check('W14-4 ★压体积不许压能力：页头三件套（刷新 · 导出 · 全部记录）零丢失、四张底盘卡的四个下钻出口零丢失、使命轻引导出口保留、H2P 双类锚点保持（E2E-21 靠它）', () => {
  return HERO.includes("emit('refresh')") && HERO.includes('<ExportMenu')
    && HERO.includes("emit('open-log')") && HERO.includes('🗂 全部记录')
    && ['total', 'entropy', 'support', 'focus'].every(k => HERO.includes(`emit('drill', '${k}')`))
    && HERO.includes('class="pi-hero hero-card"')                  /* E2E-21 双类锚点 */
    && HERO.includes("(e: 'goto-compass'): void")                 /* 使命轻引导出口保留 */
    && HERO.includes('hcb-empty')
    && HERO.includes('focusPills');                                /* 主攻胶囊一枚未减 */
});