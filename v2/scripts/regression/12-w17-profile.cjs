/**
 * 分片 · 12-w17-profile：W17-C09 画像洞察页定位重构（2026-10-20 用户拍板原型审核通过）。
 *
 * 页面新定位：呈现「用户使用知源产品的状态」——产品使用状态 + 个人方向状态。
 * 本片只钉 C09 新增契约（W17-18 ~ W17-21）；旧结构与旧判据已在各自分片里重指。
 */
const { check, codeOnly, read, fs, base } = require('./helpers.cjs');

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

check('W17-18（V4.7.7 重指）★卡片分析首层只保留「卡片构成与使用」单面板：产品使用四格与选题成果同源保留；用户拍板删除「你的方向状态」，方向与主攻项目不再在画像页重复。负锚：旧双面板、PERSONAL DIRECTION、与调度台重复的三件事交互区全部不回流。', () => {
  return OV.includes('class="pi-overview"')
    && OV.includes('卡片构成与使用')
    && OV.includes('CARD COMPOSITION')
    && !OV.includes('你的方向状态')
    && !OV.includes('PERSONAL DIRECTION')
    && !OV.includes('focusProjects')
    && ['total', 'entropy', 'support', 'focus'].every(k => OV.includes(`emit('kpi-drill', '${k}')`))
    /* 负锚：三件事行与它的交互出口零残留 */
    && !OV_C.includes('pi-ov-lines') && !OV_C.includes('pi-ov-line')
    && !OV_C.includes("emit('toggle'") && !OV_C.includes("emit('bind'")
    && !OV_C.includes("emit('fill'")
    && !PI_C.includes(':rows="todayRows"')
    && !PI_C.includes(':today-insight="concise.today"');
});

check('W17-19（V4.7.7 重指）★画像页不再承载主攻项目导航：旧「主攻完整呈现」随方向状态模块整体退役；项目完整信息与跳转只在方向台和方向台项目抽屉呈现，画像页卡片分析不回挂项目列表、进度条或项目详情抽屉。', () => {
  const HOST_C = codeOnly(fs.readFileSync(base + '/newtab/views/ProfileInsights.vue', 'utf8'));
  return !OV.includes('focusProjects')
    && !OV.includes('class="pi-dir-name"')
    && !OV.includes('class="pi-dir-track"')
    && !OV.includes('class="pi-dir-state"')
    && !OV.includes("emit('open-project', p.id)")
    && !CSS.includes('.hcb-pill {') && !CSS.includes('max-width: 24ch')
    && !HERO_C.includes('focusPills') && !HERO_C.includes('hero-compass-bar')
    && !HOST_C.includes('openProjectDetail')
    && !HOST_C.includes('<ProjectDetailDrawer');
});

check('W17-20（V4.7.6 重指）★旧 PiRail 时间轨保持退役：宿主零挂载、样式零命中；观察范围改由时间轴 / 卡片分析导航，年度热力常驻，默认时间轴', () => {
  /* read() 会聚合宿主与 composable；“谁持有状态、谁只负责挂载”必须读物理宿主。 */
  const HOST = fs.readFileSync(base + '/newtab/views/ProfileInsights.vue', 'utf8')
  return !HOST.includes('<PiRail') && !HOST.includes("from '@/newtab/components/profile/PiRail.vue'")
    && !CSS.includes('.pi-rail {') && !/\.pi-rnode[\s:{.]/.test(CSS)
    && !/\.pi-tl \{[^}]*grid-template-columns:\s*78px/.test(CSS)
    && HOST.includes('class="pi-range-toolbar"')
    && HOST.includes('class="pi-view-tabs" role="tablist"')
    && HOST.includes('data-profile-view="timeline"')
    && HOST.includes('data-profile-view="analysis"')
    && HOST.includes("type ProfileView = 'timeline' | 'analysis'")
    && HOST.includes('<PiAnnualHeatmap')
    && !codeOnly(HOST).includes('<PiRangeTabs')
    && !codeOnly(HOST).includes('onRailJump') && !codeOnly(HOST).includes('railActive')
    /* V4.4.0：周期控件单列在 `.pi-range-toolbar`，旧 Hero #range 插槽与独立 PERIOD 提示带均已退役。 */
    && !HOST.includes('<template #range>')
    && !HOST.includes('PERIOD ·')
    && !HOST.includes('class="pi-period-head"');
});

check('W17-21（V4.3.1 重指）今日对账段与「一键归入主攻 + 绑卡」退役：PiToday 只保留四格事实读数，周期 AI 分析也已整体退役', () => {
  const TODAY_C = codeOnly(TODAY);
  /* 注释里保留退役说明不算残留 —— 判定一律剥注释（R166 纪律）。 */
  return !TODAY_C.includes('f3-compact') && !TODAY_C.includes("emit('bind'")
    && !TODAY_C.includes("emit('fill'") && !TODAY_C.includes("emit('toggle'")
    && TODAY.includes('class="strip4"') && TODAY.includes("emit('open-focus')")
    && TODAY.includes('slotCount')
    && !PI_C.includes('onTodayToggle') && !PI_C.includes('onTodayBind') && !PI_C.includes('onTodayFill')
    && !PI_C.includes('onConciseAction')
    && !PI_C.includes('一键归入主攻')
    && !TODAY_C.includes('PiAiReview')
    && !PI_C.includes('onPeriodAiAction')
    && !PI.includes('@ai-regenerate');
});

/* ══════════════ W18 · 画像洞察顶部等高 + 卡片化导出（2026-10-20 用户拍板） ══════════════ */

const DAY = read('/newtab/components/dashboard/DayDetail.vue');

check('V3.9.7（V4.7.7 重指）★卡片分析首层为单面板自然高度，不再出现双栏等高和固定面板高度。负锚钉死固定 440px、1.35fr/1fr 与已退役的 pi-dir-cols 双列全部不回流。', () => {
  return /\.pi-overview \{ display: block; \}/.test(OV)
    && /\.pi-ov-card \{ height: auto; min-height: 0;/.test(OV)
    && !OV.includes('--pi-panel-h')
    && !CSS.includes('1.35fr')
    && !OV.includes('class="pi-dir-cols"')
    && !OV.includes('focusProjects')
    && OV.includes('class="pi-ov-topic-band"')
    && OV.includes('class="pi-ov-mix"');
});

check('W18-2 ★V4.7.6 重指：画像观察范围默认时间轴，卡片分析按需切换，年度热力始终在场', () => {
  return PI.includes("type ProfileView = 'timeline' | 'analysis'")
    && PI.includes("return 'timeline'")
    && PI.includes('data-profile-view="timeline"')
    && PI.includes('data-profile-view="analysis"')
    && PI.includes('<PiAnnualHeatmap')
    && PI.includes('<PiCardAnalysis v-else');
});

check('W18-3（V3.9.23 随迁）战报头部只保留查看全部记录与 Markdown / HTML 双导出：PNG 独立入口和菜单项退役，操作区位于标题左侧、关闭仍在最右', () => {
  return DAY.includes('class="dz-day-actions"')
    && DAY.includes("emit('open-log', day)")
    && DAY.includes(':formats="[\'md\', \'html\']"')
    && DAY.includes('查看全部记录')
    && DAY.includes('收起 ×')
    && DAY.indexOf('dz-day-actions') < DAY.indexOf('dz-day-close')
    && !DAY.includes('saveCardImage')
    && !DAY.includes('保存为图片')
    && !DAY.includes("formats=\"['png'");
});

check('W18-4（V3.9.23 随迁）共享导出继续复用统一 HTML 文档壳：战报输出摘要、KPI、流水与品牌页脚；资源卡是唯一可点击对象，不再迁回 PNG 长图链', () => {
  const day = codeOnly(DAY);
  const ev = read('/shared/utils/exportView.ts');
  return day.includes('dailyReportShareHtml({')
    && day.includes('kpis: exportKpis()')
    && day.includes('rows: exportRows()')
    && day.includes("footer: '知源 ownway · 每日战报 · 数据只在本机'")
    && day.includes('sectionsToMd(')
    && day.includes("h: '当前下钻'")
    && ev.includes('export interface DailyReportShareSpec')
    && ev.includes('export function dailyReportShareHtml(')
    && ev.includes('escHtml(spec.summary)')
    && ev.includes('r.href ? `<a href=')
    && !day.includes('buildZyCard()')
    && !day.includes('exportSections')
    && !day.includes('zyCard')
    && !day.includes('exportPng')
    && !day.includes("formats=\"['png'");
});

/* ============ V3.9.6 · 双口径「导 N」界面欠账收口 ============ */
console.log('【V3.9.6 · 新增/导入双口径「导 N」界面徽标收口】');

check('V3.9.6-1（V4.7.2 重指）「导 N」双口径徽标随 PiOverview 承接：PiToday 不再挂载后，今日导入数仍在产品使用状态段头可见，导入继承原创建时间、不混入今天新建。断言三段：① 宿主把 todayImportCount 传给 PiOverview ② PiOverview 以与 PiToday 同族的 pi-imp-badge 渲染「导 N」③ 徽标类名与样式仍在 CSS 里', () => {
  const OVERVIEW = read('/newtab/components/profile/PiOverview.vue')
  return PI.includes(':today-import="todayImportCount"')
    && OVERVIEW.includes('todayImport: number')
    && OVERVIEW.includes('class="pi-imp-badge"')
    && OVERVIEW.includes('导 {{ todayImport }}')
    && !PI.includes('<PiToday')
    && (OVERVIEW.match(/class="pi-imp-badge"/g) || []).length === 1
    && CSS.includes('.pi-imp-badge')
    && OVERVIEW.includes('v-if="todayImport > 0"');
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
  return /\.pi-hero\.hero-card \{[\s\S]*?background: transparent; border: 0;[\s\S]*?padding: 0; box-shadow: none;/.test(CSS)
    && /\.pi-hero-t \{[\s\S]*?font-size: var\(--fs-title\);/.test(CSS)
    && HERO.includes('⟳ 刷新')
    && HERO.includes('<ExportMenu')
    && HERO.includes('全部记录');
});

check('V3.9.7-2 ★指标明细点击不再去卡片池定位：任务开详情；资源有链接直接打开、无链接开详情；好奇心开详情', () => {
  /* ★R181 随迁带备案：openStatCard 随域逻辑下沉 useProfileInsights.ts，而旧尾锚 `const statDrawerTitle`
     随标签域进了 useProfileInsightsTags.ts —— 两锚跨文件后切片会一路吞过 openStatCard 之后的大段代码
     （含 locateTargetOf / router.push 造成假红）。尾锚改指 openStatCard **紧邻的下一枚顶层函数**，
     切片重新只覆盖 openStatCard 本体，判据意图（指标明细点击不再去卡片池定位）一字未改。 */
  const fn = PI.slice(PI.indexOf('function openStatCard('), PI.indexOf('async function openTagDistribution'));
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
