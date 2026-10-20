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
    /* ★W18（2026-10-20 用户拍板）重指：默认范围改为「本年」——先看长期状态，再按需下钻。 */
    && PI_C.includes("const activeRange = ref<PiRange>('year')")
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

/* ══════════════ W18 · 画像洞察顶部等高 + 卡片化导出（2026-10-20 用户拍板） ══════════════ */

const ZY = read('/shared/utils/zyCard.ts');
const DAY = read('/newtab/components/dashboard/DayDetail.vue');
const HEAT = read('/newtab/components/dashboard/Heatmap.vue');

check('W18-1 ★顶部两块面板固定等高 440px，右卡主攻项目并排两列（C 布局：使命通栏 → 两列项目）', () => {
  return /--pi-panel-h:\s*440px/.test(OV)
    && /\.pi-ov-card \{ height: var\(--pi-panel-h\)/.test(OV)
    && OV.includes('class="pi-dir-cols"')
    && /\.pi-dir-cols \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(OV)
    && OV.includes('pi-dir-cols" :class="{ single: focusProjects.length === 1 }"')
    /* 900px 以下取消固定高度，按内容自然排 */
    && /\.pi-overview \{ --pi-panel-h: auto; \}/.test(OV);
});

check('W18-2 ★周期区默认「本年」：进入画像洞察先给全年状态，再按需下钻', () => {
  return PI.includes("const activeRange = ref<PiRange>('year')")
    && !PI.includes("const activeRange = ref<PiRange>('today')");
});

check('W18-3 ★战报弹窗头部有独立「保存为图片」入口（不必再进导出菜单）', () => {
  return DAY.includes('saveCardImage')
    && DAY.includes('保存为图片')
    && DAY.includes('class="dz-btn ghost sm dz-save-card"')
    /* 下载的是卡片图片，文件名带「战报卡」 */
    && DAY.includes("exportName('战报卡', 'png'")
    /* 头部按钮在「收起」之前 */
    && DAY.indexOf('保存为图片') < DAY.indexOf('收起 ×');
});

check('W18-4 ★L3 统一卡片模板：战报 / 热力图同一份卡骨相（眉标 + 读数 + 三类卡带 + 明细 + 品牌页脚）', () => {
  return ZY.includes('export function zyCardBlob(') && ZY.includes('export function zyCardHtml(')
    /* 三类卡是知源「卡」世界观的最小可视单位 */
    && ZY.includes('task: number') && ZY.includes('curio: number') && ZY.includes('res: number')
    && ZY.includes('任务卡') && ZY.includes('好奇心卡') && ZY.includes('资源卡')
    && ZY.includes('kicker') && ZY.includes('readouts') && ZY.includes('rowsTitle')
    /* 两个导出点都改走同一模板，不再各写一套版式 */
    && DAY.includes('zyCardBlob(buildZyCard())') && DAY.includes('zyCardHtml(buildZyCard())')
    && HEAT.includes('zyCardBlob(buildZyCard())') && HEAT.includes('zyCardHtml(buildZyCard())')
    /* 负锚：日战报 PNG 不再走旧的 pngBlobFromSpec 版式 */
    && !DAY.includes('pngBlobFromSpec({')
    && !HEAT.includes('pngBlobFromSpec({');
});
