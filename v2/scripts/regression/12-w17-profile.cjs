/**
 * 分片 · 12-w17-profile：W17-C09 画像洞察页定位重构（2026-10-20 用户拍板原型审核通过）。
 *
 * 页面新定位：呈现「用户使用知源产品的状态」——产品使用状态 + 个人方向状态。
 * 本片只钉 C09 新增契约（W17-18 ~ W17-21）；旧结构与旧判据已在各自分片里重指。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const PI = read('/newtab/views/ProfileInsights.vue');
const PI_C = codeOnly(PI);
const OV = read('/newtab/components/profile/PiOverview.vue');
const OV_C = codeOnly(OV);
const HERO = read('/newtab/components/profile/PiHero.vue');
const HERO_C = codeOnly(HERO);
const TODAY = read('/newtab/components/profile/PiToday.vue');
const CSS = codeOnly(read('/newtab/components/profile/pi-timeline.css'));

console.log('【W17-C09 · 画像洞察双面板重构（V3.9.5 批）】');

check('W17-18 ★首屏双面板：产品使用状态 + 方向状态并列；负锚：与调度台重复的三件事模块不再渲染', () => {
  return OV.includes('class="pi-overview"')
    && OV.includes('知源产品使用状态')
    && OV.includes('你的方向状态')
    && OV.includes('PRODUCT USAGE')
    && OV.includes('PERSONAL DIRECTION')
    /* 四格读数仍在左面板且可下钻 */
    && ['total', 'entropy', 'support', 'focus'].every(k => OV.includes(`emit('kpi-drill', '${k}')`))
    /* 负锚：三件事行与它的交互出口零残留 */
    && !OV_C.includes('pi-ov-lines') && !OV_C.includes('pi-ov-line')
    && !OV_C.includes("emit('toggle'") && !OV_C.includes("emit('bind'")
    && !OV_C.includes("emit('fill'")
    && !PI_C.includes(':rows="todayRows"')
    && !PI_C.includes(':today-insight="concise.today"');
});

check('W17-19 ★主攻完整呈现：项目名不截断 + 状态 + 进度条，点击开项目详情抽屉', () => {
  return OV.includes('focusProjects')
    && OV.includes('class="pi-dir-name"')
    && OV.includes('class="pi-dir-track"')
    && OV.includes('class="pi-dir-state"')
    && OV.includes('STATE_LABEL')
    && OV.includes("emit('open-project', p.id)")
    /* 负锚：24ch 截断规则与 Hero 胶囊一并退役 */
    && !CSS.includes('.hcb-pill {') && !CSS.includes('max-width: 24ch')
    && !HERO_C.includes('focusPills') && !HERO_C.includes('hero-compass-bar')
    /* 项目名容器允许换行完整显示 */
    && /\.pi-dir-name \{[^}]*overflow-wrap: anywhere/.test(OV)
    /* 宿主仍唯一挂项目抽屉 */
    && PI.includes('<ProjectDetailDrawer :open="projDetailOpen" :project-id="projDetailId"');
});

check('W17-20 ★时间线退役：宿主零挂载 PiRail，样式零命中，周期区单列、页签是唯一导航', () => {
  return !PI.includes('<PiRail') && !PI.includes("from '@/newtab/components/profile/PiRail.vue'")
    && !CSS.includes('.pi-rail {') && !/\.pi-rnode[\s:{.]/.test(CSS)
    && !/\.pi-tl \{[^}]*grid-template-columns:\s*78px/.test(CSS)
    && PI.includes('<PiRangeTabs')
    && PI_C.includes("const activeRange = ref<PiRange>('today')")
    && !PI_C.includes('onRailJump') && !PI_C.includes('railActive')
    /* 段头文案不再用 TIMELINE 叙事 */
    && PI.includes('PERIOD ·');
});

check('W17-21 ★今日对账段退役：PiToday 无 f3-compact，画像页不再发勾选/归位/填入事件', () => {
  const TODAY_C = codeOnly(TODAY);
  /* 注释里保留退役说明不算残留 —— 判定一律剥注释（R166 纪律）。 */
  return !TODAY_C.includes('f3-compact') && !TODAY_C.includes("emit('bind'")
    && !TODAY_C.includes("emit('fill'") && !TODAY_C.includes("emit('toggle'")
    && TODAY.includes('class="strip4"') && TODAY.includes("emit('open-focus')")
    && TODAY.includes('slotCount')
    && !PI_C.includes('onTodayToggle') && !PI_C.includes('onTodayBind') && !PI_C.includes('onTodayFill')
    /* 诊断 CTA 仍统一分发（bindFocus 改为跳调度台处理） */
    && PI.includes('function onConciseAction(action: string)')
    && PI.includes("if (action === 'bindFocus') {");
});
