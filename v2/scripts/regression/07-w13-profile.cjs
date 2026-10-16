/**
 * 分片 · 07-w13-profile：V3.8.22 批二 W13「画像洞察极简认知版」的新增判据（W13-1 ~ W13-8 + T7 三条）。
 * 为什么独立成分片：05/06 之后各片逼近 900 行闸（R164-2 单片 ≤900），新代判据另开分片 —— 门禁原意是
 * 「上限靠加分片而不是放宽」。本片只钉本轮新增契约，历史断言一条未动。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read, path, fs, runGateSync, SCRIPTS_DIR } = require('./helpers.cjs');

const HERO = read('/newtab/components/profile/PiHero.vue');
const TODAY = read('/newtab/components/profile/PiToday.vue');
const RHY = read('/newtab/components/profile/PiRhythm.vue');
const MONTH = read('/newtab/components/profile/PiMonth.vue');
const YEAR = read('/newtab/components/profile/PiYear.vue');
const PI = read('/newtab/views/ProfileInsights.vue');
const DRAWER = read('/newtab/components/dashboard/DashboardLogDrawer.vue');
const LC = read('/newtab/components/LifecyclePanel.vue');
const PI_C = codeOnly(PI);

console.log('【W13 · 画像洞察极简认知版（批次画像洞察页 · 四段式三段式收敛）】');

check('W13-1 ★Hero 三层规整结构与全页指标零重复：Hero 只保留「页头行 / 方向承载条 / 底盘四卡」三层，连续打卡与最长连续两项时间指标唯一归位 PiYear —— 负锚走 codeOnly（Hero 头注与备案注释里按纪律必须写清这两个旧指标的去向，剥完才算残留）。真源：PiYear 的 strip4 F21 四格含「本年活跃 / 最长连续」两格', () => {
  const HERO_C = codeOnly(HERO);
  const YEAR_C = codeOnly(YEAR);
  return HERO.includes('.hero-row-top') && HERO.includes('.hero-compass-bar') && HERO.includes('.hero-kpis-grid')
    && !HERO_C.includes('连续打卡') && !HERO_C.includes('最长连续')
    && HERO_C.includes('hero-kpis-grid')
    && YEAR_C.includes('最长连续') && YEAR.includes('class="strip4"')
    && PI_C.includes('heroStreak') === false && PI_C.includes('currentStreak') === false;
});

check('W13-2 ★四模块全部配备「一句人话诊断条」且零入台不失语：四组件各恰一枚 .one-insight（恒渲染），★W13-T7 起四条文本与 CTA 单一真源 = reviewReport.buildConciseInsights（宿主 conciseCtx → concise 注入，形状 ConciseInsight{html,warn,ctaLabel,ctaAction} 改 v-html）；宿主三段手写 insight（todayInsight/mInsight/yInsight）与 PiRhythm 组件内 weekInsight 全部退役（codeOnly 零命中）⇒ "同一页四条诊断四种写法"这个病灶不复现。负锚：PiToday 不许再有 todayAdd === 0 的静默隐藏分支', () => {
  const c = [TODAY, RHY, MONTH, YEAR];
  const oneEach = c.every(s => (s.match(/class="one-insight"/g) || []).length === 1);
  const injected = c.every(s => s.includes('insight: ConciseInsight') && s.includes('v-html="insight.html"') || s.includes('v-html="props.insight.html"'));
  return oneEach && injected
    && PI.includes('buildConciseInsights(') && PI.includes('const conciseCtx') && PI.includes('const concise = computed')
    && ['concise.today', 'concise.week', 'concise.month', 'concise.year'].every(k => PI.includes(k))
    && !PI_C.includes('todayInsight') && !PI_C.includes('mInsight') && !PI_C.includes('yInsight')
    && !codeOnly(RHY).includes('weekInsight') && !codeOnly(TODAY).includes('TodayInsight')
    && !codeOnly(MONTH).includes('MonthInsight') && !codeOnly(YEAR).includes('YearInsight')
    && !codeOnly(TODAY).includes('todayAdd === 0');
});

check('W13-3 ★消除同屏双层指标重复：周度与月度两文件各只留一层 .strip4 指标网格，★W13-T4 起复盘 6 指标网格 .pi-k6 与其口径函数 kpisOf 在两文件 codeOnly 里零命中（当时它们是重复读数的同屏第二层）；真源仍留在 shared/reviewReport 供引擎用，不是不许存在，是不许在组件里渲染第二遍', () => {
  const rh = codeOnly(RHY), mo = codeOnly(MONTH);
  return (rh.match(/class="strip4"/g) || []).length === 1 && (mo.match(/class="strip4"/g) || []).length === 1
    && !rh.includes('.pi-k6') && !rh.includes('kpisOf') && !rh.includes('.pi-flow')
    && !mo.includes('.pi-k6') && !mo.includes('kpisOf');
});

check('W13-4 ★今天与本月视觉块差异化（拒绝跨模块克隆）：今天段是 .f3-compact 单行归属弹药对账表（含一键归位绑卡出口 bind 事件与「绑 N 张卡」命中数），本月段是「Top 主题映射 + .funnel3 三步转化漏斗」双栏；负锚钉两条不许互相克隆 —— 月份文件不得出现周度那种逐日柱状图（.bars 系列），周度文件不得出现漏斗三段', () => {
  const td = codeOnly(TODAY), mo = codeOnly(MONTH), rh = codeOnly(RHY);
  return td.includes('f3-compact') && td.includes("emit('bind'") && td.includes('matchCount')
    && mo.includes('class="funnel3"') && mo.includes('topics')
    && !mo.includes('.bars') && !mo.includes('level(w, max)')
    && !rh.includes('funnel3') && rh.includes('class="pi-bars"')       /* 柱子唯一归周度（pi-bars 是 F14 的 7 日密度柱） */
    && mo.includes('class="light-split"') && rh.includes('class="light-split"');
});

check('W13-5 ★五段式今日战报（DayDetail）完整在位、零简化：宿主挂载 DayDetail 弹窗 + openTodayBattle 单一宿主，今日段按钮 / 周度 7 日柱点击 / 年度热力格点击三处 open-battle 出口全部接到它 —— 三处都在就说明弹窗不是"只有一条路能打开"', () => {
  return PI.includes('<DayDetail') && PI.includes('function openTodayBattle') && PI.includes('function openDayBattle')
    && (PI.match(/@open-battle=/g) || []).length >= 3
    && TODAY.includes("emit('open-battle')") && RHY.includes("'open-battle'") && YEAR.includes("'open-battle'")
    && PI.includes('@open-battle="openTodayBattle"') || PI.includes('@open-battle="openDayBattle"');
});

check('W13-6 ★资源生命周期与高价值沉睡证据唤醒完整在位：年度段挂 #lc-sec 与 LifecyclePanel，冷却期能识别 callCount >= 3 的高价值核心卡（🔥 徽标 + .lc-row.hv + 「历史高频调用 N 次 · 已冷却 M 天」注），冷却态三动作齐全（唤醒复温 / 延后 / 归档）、归档态可唤醒复温、阈值设置弹窗宿主接线在位', () => {
  return YEAR.includes('id="lc-sec"') && YEAR.includes('<LifecyclePanel')
    && LC.includes('callCount >= 3') && LC.includes('highCooling') && LC.includes('isHigh')
    && LC.includes('lc-hv') && LC.includes('唤醒复温') && LC.includes('延后') && LC.includes('归档')
    && LC.includes('lc-row') && LC.includes('hv') && LC.includes("emit('setDays'")
    && PI.includes('@lc-settings="lcSetOpen = true"')
    && PI.includes('function wakeCooling');
});

check('W13-7 ★孤儿 CSS 清零棘轮（本批专属）：实跑扫描器确认两桶为零，且本批退役的三组选择器 .pi-k6 / .pi-flow / .pi-rev-* 与 T6 退役的 .pi-strip-row 一条都不许出现在判死名单里 —— 清零不是"把判据调松"，是规则真删；pi-timeline.css 的复盘弹窗壳四段随挂载退役改注释备案', () => {
  const p = path.resolve(SCRIPTS_DIR, 'dead-css-scan.cjs');
  let out = null; try { out = JSON.parse(runGateSync(p, ['--json']).stdout || '') } catch { }
  const dead = (out && out.死) || [];
  return !!out && out.祖先断.length === 0
    && !dead.some(d => /\.(pi-k6|pi-flow|pi-rev-|pi-strip-row)/.test(d.选择器 || d.sel || JSON.stringify(d)))
    && !codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'newtab', 'components', 'profile', 'pi-timeline.css'), 'utf8')).includes('.pi-rev-overlay')
    && fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'newtab', 'components', 'profile', 'pi-timeline.css'), 'utf8').includes('pi-rev-overlay');
});

check('W13-8 ★本批改动的反漂纪律：索引生成物由 R163-1 守、透视卡数字由 R4-Ey① 守，本条钉**债务不复发** —— 宿主 ProfileInsights.vue 净减到 1,011 行后不许再回涨（T7 三轮：复盘弹窗卸载 + 动态条抽屉整删 + 诊断统一注入），上限写死 1,100 行；同时 T7 三个退役物在宿主 codeOnly 里零命中，防"下轮当漏实现补回来"', () => {
  const lineCount = PI.split(/\r?\n/).length;
  return lineCount <= 1100
    && !PI_C.includes('dynDrawer') && !PI_C.includes('openDynDrawer') && !PI_C.includes('DynDrawerType')
    && !PI_C.includes('<ReviewPanel') && !PI_C.includes('openReview')
    && !PI_C.includes('eventActionLabel') && !PI_C.includes('eventKindLabel') && !PI_C.includes('fmtEventTime')
    /* 备案注释按纪律必须留在原文（codeOnly 已剥，所以查 PI 而不是 PI_C） */
    && PI.includes('W13-D5') && PI.includes('W13-T7');
});

console.log('【W13-T7 · 抽屉收口与诊断统一（T7a~T7d）】');

check('W13-F28 ★事件类下钻必须收进全页唯一的三维筛选抽屉（DashboardLogDrawer），卡片语义下钻才留 statDrawer 单抽屉：动态条明细抽屉 dynDrawer 已整删（T7b）—— 迁移后的三处入口对账：① 本月入池 → openLog 的 month-in 键（action=create · from=月初 · 含导入）② 近30天主攻动作 → openLogFocus（LogPreset.focusOnly，主攻集口径 = isFocused 且未归档，只留 create/call/status 三类动作）③ 四类记录入口四键齐全。抽屉侧 focusOnly 的过滤与主攻集在抽屉内自算（props.data.compass，组件零 store）', () => {
  return !PI_C.includes('openDynDrawer') && !PI_C.includes('dynDrawer')
    && PI.includes('function openLogFocus()') && PI.includes("openLog('month-in')")
    && PI.includes("k === 'month-in'") && PI.includes('fmtDayKey(gStartOfMonth)')
    && PI.includes('function openLog(') && PI.includes("'month-in'")
    && DRAWER.includes('focusOnly?: boolean') && DRAWER.includes('focusOnly.value') && DRAWER.includes('focusIds')
    && DRAWER.includes("e.action !== 'create' && e.action !== 'call' && e.action !== 'status'")
    && DRAWER.includes('p.status !== \'archived\'')
    && !codeOnly(DRAWER).includes('useAppStore')
    /* statDrawer 只剩八类活键（卡片语义：F15 目标对账 / F17 转化 / F18 主题 / F19 策展·支撑） */
    && PI.includes("type StatDrawerType = '' | 'all' | 'support' | 'goal-week'")
    && !PI_C.includes("case 'resource':") && !PI_C.includes("case 'task':") && !PI_C.includes("case 'curiosity':") && !PI_C.includes("case 'link':")
    && ["openStatDrawer('all')", "openStatDrawer('support')", "openStatDrawer('goal-week')", "openStatDrawer('mo-support')", "openStatDrawer('curio-conv')", "openStatDrawer('topic')"]
      .every(k => PI.includes(k));
});

check('W13-T7a ★复盘弹窗退役但组件保留：D5 用户拍板「复盘能力四段常驻」⇒ 宿主零挂载零 import（组件文件保留待复用，同 CatPicker 先例）；能力去向逐条点名防"删了不解释"：周/月复盘落四段模块常驻、目标对账明细落 PiRhythm 战略目标点行（goal-week 抽屉）、复盘引擎 buildReview/reviewReport 与 CSS 一字未动', () => {
  const RR = read('/shared/utils/reviewReport.ts');
  const RP = read('/newtab/components/dashboard/ReviewPanel.vue');
  return !PI_C.includes('<ReviewPanel') && !PI_C.includes('from \'@/newtab/components/dashboard/ReviewPanel.vue\'')
    && !PI_C.includes('reviewOpen') && !PI_C.includes('useDashboardReport')
    && PI.includes('W13-D5') && PI.includes('复盘能力四段常驻')
    && RP.includes('buildReview(') && RR.includes('export function buildReview(')
    && RP.includes('objectivesOf(') && PI.includes("openStatDrawer('goal-week')");
});

check('W13-T7d ★四条诊断的 CTA 走同一个分发出口：八个 ctaAction 键（openFocusBoard / bindFocus / callSupport / openBattle / openObjectives / openLog / convertCurio / wakeCooling·openLifecycle）全部在宿主 onConciseAction 一处分派，四组件 @insight-action 全接它 —— 此前四段各写各的 onXxxInsightAction（bind:N / call / battle / focus / convert / lc / mo-add / goal:八套键），"改一个动作要改四个出口"是不可维护的形状。F5 导出补四条 strip-html 诊断行 ⇒ 导出与界面同源', () => {
  return PI.includes('function onConciseAction(action: string)')
    && ["'openFocusBoard'", "'bindFocus'", "'callSupport'", "'openBattle'", "'openObjectives'", "'openLog'", "'convertCurio'", "'wakeCooling'", "'openLifecycle'"]
      .every(k => PI.includes(k))
    && (PI.match(/@insight-action="onConciseAction"/g) || []).length === 4
    && !PI_C.includes('onTodayInsightAction') && !PI_C.includes('onMonthInsightAction')
    && !PI_C.includes('onYearInsightAction') && !PI_C.includes('onRhythmInsight')
    && PI.includes('insightLines') && PI.includes(".replace(/<[^>]+>/g, '')")
    && PI.includes('concise.value[k].html');
});