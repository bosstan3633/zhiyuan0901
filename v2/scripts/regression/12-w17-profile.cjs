/**
 * 分片 · 12-w17-profile：W17-C09 画像洞察页定位重构（2026-10-20 用户拍板原型审核通过）。
 *
 * 页面新定位：呈现「用户使用知源产品的状态」——产品使用状态 + 个人方向状态。
 * 本片只钉 C09 新增契约（W17-18 ~ W17-21）；旧结构与旧判据已在各自分片里重指。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const PI = read('/newtab/views/ProfileInsights.vue');
const PI_C = codeOnly(PI);
const TAG_DRAWER = read('/newtab/components/profile/PiTagDistributionDrawer.vue');
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

check('V3.9.7 ★顶部两块面板自然等高、左右严格等宽：负锚钉死固定 440px 与 1.35fr/1fr 的宽窄列', () => {
  return /\.pi-overview \{ align-items: stretch; \}/.test(OV)
    && /\.pi-ov-card \{ height: auto; min-height: 0;/.test(OV)
    && !OV.includes('--pi-panel-h')
    && /\.pi-overview \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(CSS)
    && !CSS.includes('1.35fr')
    && OV.includes('class="pi-dir-cols"')
    && /\.pi-dir-cols \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(OV)
    && OV.includes('pi-dir-cols" :class="{ single: focusProjects.length === 1 }"');
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

/* ============ V3.9.6 · 双口径「导 N」界面欠账收口 ============ */
console.log('【V3.9.6 · 新增/导入双口径「导 N」界面徽标收口】');

check('V3.9.6-1 ★「导 N」徽标必须真的在界面上：手册「新增/导入双口径（V2.21.3 起）」白纸黑字承诺「导入的卡单独显示『导 Y』并继承原创建时间——不会把导入错记成今天新建」，而 R48-5 判据只钉住了**数据层**（todayImportCount / weekImportCount），界面那一半长期挂着「登记待接」的欠账（本轮收口）。断言三段：① 宿主把计数传给今日段（todayImport）② 今日段渲染「导 N」徽标且挂在段头右缘（pi-mod-acts）③ 徽标类名与样式在 CSS 里在位。★为什么必须落在**段头**而不是 strip4：strip4 是「恰四枚读数格」的定版结构（W13-F8），塞第五枚进去会挤掉既有读数并打破多条历史断言；而「导 N」本就是「今日入台」这枚读数的**口径拆分**，不是第五个读数。', () => {
  return PI.includes(':today-import="todayImportCount"')
    && TODAY.includes('todayImport: number')
    && TODAY.includes('class="pi-imp-badge"')
    && TODAY.includes('导 {{ props.todayImport }}')
    /* 徽标在段头右缘（pi-mod-acts），不在 strip4 里 —— 守住「恰四枚读数格」的定版 */
    && TODAY.includes('class="pi-mod-acts"')
    && (TODAY.match(/class="pi-imp-badge"/g) || []).length === 1
    && CSS.includes('.pi-imp-badge')
    /* 0 时不渲染（没有导入就别占宽度） */
    && TODAY.includes('v-if="props.todayImport > 0"');
});

check('V3.9.6-2 ★双口径不许被悄悄合并：「今日入台」计数仍按 createdAt（含导入卡的原创建时间），导入数单独由 importedAt 派生 —— 两者不得共用一个字段。负锚钉住：① todayImportCount 的过滤条件里必须有 importedAt ② 不得把 importedAt >= gStartOfToday 换成 createdAt（换了就等于把导入错记成今天新建，正是手册明文承诺不做的）', () => {
  const line = (PI.match(/const todayImportCount = computed\([^\n]*/) || [''])[0];
  return line.includes('x.importedAt')
    && line.includes('x.importedAt >= gStartOfToday')
    && !line.includes('x.createdAt')
    /* 数据层两枚计数仍在（判据 R48-5 钉其存在，本条不删） */
    && PI.includes('const weekImportCount = computed');
});

/* ============ V3.9.7 · 画像台收口与指标下钻 ============ */
console.log('【V3.9.7 · 画像台布局、卡片直达、标签解释】');

check('V3.9.7-1 ★页头压缩：标题和操作按钮保留，去掉外层阴影并降低标题字号', () => {
  return /\.pi-hero\.hero-card \{[\s\S]*?padding: 8px 14px; box-shadow: none;/.test(CSS)
    && /\.pi-hero-t \{[\s\S]*?font-size: var\(--fs-title\);/.test(CSS)
    && HERO.includes('⟳ 刷新')
    && HERO.includes('<ExportMenu')
    && HERO.includes('全部记录');
});

check('V3.9.7-2 ★指标明细点击不再去卡片池定位：任务开详情；资源有链接直接打开、无链接开详情；好奇心开详情', () => {
  const fn = PI.slice(PI.indexOf('function openStatCard('), PI.indexOf('const statDrawerTitle'));
  return PI.includes("import TaskDetailDrawer from '@/newtab/components/compass/TaskDetailDrawer.vue'")
    && PI.includes('const { openResourceLink } = useResourceOpen({ store, d: gd })')
    && PI.includes('<TaskDetailDrawer ref="taskDetailRef" />')
    && fn.includes('if (openResourceLink(resource)) return')
    && fn.includes("emitOpenDrawer({ kind: 'res', id: resource.id })")
    && fn.includes('taskDetailRef.value?.open(task)')
    && fn.includes("emitOpenDrawer({ kind: 'curio', id: x.id })")
    && !fn.includes('locateTargetOf')
    && !fn.includes('router.push');
});

check('V3.9.7-3 ★标签分布开独立解释抽屉：指标定义 + 当前含义 + 下一步建议 + AI 治理入口，不弹 toast 了事', () => {
  return PI_C.includes('const tagInsightOpen = ref(false)')
    && PI_C.includes("if (k === 'entropy') { void openTagDistribution(); return }")
    && PI.includes('<PiTagDistributionDrawer')
    && PI.includes(':entropy="heroEntropy"')
    && PI.includes('@optimize="runTagOptimizeAi"')
    && TAG_DRAWER.includes('title="标签分布 · 知识熵"')
    && TAG_DRAWER.includes('知识熵衡量标签在卡片上的分散程度')
    && TAG_DRAWER.includes('v-for="(a, i) in actions"')
    && TAG_DRAWER.includes('生成标签治理建议')
    && PI.includes('<AiDrawer v-if="tagAiJob"')
    && PI.includes('govern.buildTagGovernJob({')
    && !/if \(k === 'entropy'\) \{\s*const t = topTags/.test(PI_C);
});
