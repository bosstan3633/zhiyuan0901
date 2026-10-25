/**
 * V3.9.19 · 方向台按原型迭代（04-73 规范落地原型 · 用户 2026-10-24 认可）。
 *
 * 原型：评审交接包/原型_方向台_04-73规范落地_审核稿_V1.html（含同日审核意见：
 * 页头与战略骨架计数重复 → 一处不两说）。
 * 这一片锁五件事改版后仍然成立的产品行为：
 * - hero 去重：页头只报状态（健康度/主攻/停滞），六层计数唯一账本在战略骨架条
 *   （折叠徽章带计数 + 六层口径 tooltip + hero 下钻入口展开骨架并开第 1 层）；
 * - 主攻聚焦条补「下一步」chip：吃 compassMeta.nextStep（用户填写 → 任务推导 → 空态），与项目详情同源；
 * - 引导条（三层计数带）退役：视图切换迁左栏导航首行，计数不再第三处重复；
 * - 胶囊令牌 --radius-full（04-73 C-6）：四组件 999px/99px 字面量清零；
 * - 密度接通（D-1(a)）+ 断点收敛（D-2：1024/800 两档，480 并入 800）。
 *
 * 同批八条旧判据已带备案重指：C1-1/C1-3（读数随迁）、C2-5（胶囊令牌）、W12-1（引导条退役）、
 * W12-5（tk 行密度令牌）、W11-20（480 并档）、R3-B′（层内切片下界）、R99-3（战略目标表达式随迁）。
 */
const {
  check, read, codeOnly,
} = require('./helpers.cjs');

const CT = read('/newtab/views/CompassTree.vue');
const CT_C = codeOnly(CT);
const SPINE = read('/newtab/components/compass/CompassSpine.vue');
const LANE = read('/newtab/components/compass/CompassLane.vue');
const TOWER = read('/newtab/components/compass/CompassTower.vue');
const PANO = read('/newtab/components/compass/CompassPano.vue');
const TOKENS = read('/shared/styles/tokens.css');

console.log('【V3.9.19 · 方向台按原型迭代（hero 去重 / 聚焦条下一步 / 引导条退役 / 胶囊与密度令牌 / 断点收敛）】');

check('D19-1 ★hero 只报状态（一处不两说，用户拍板 2026-10-24）：页头状态带 = 健康度徽章 + 主攻 + 停滞（可见口径）+ 「六层计数 · 战略骨架」下钻按钮；六层结构计数（愿景/使命/战略目标/项目/指标/任务）在 hero-stats 切片内零命中', () => {
  const i = CT_C.indexOf('<div class="hero-stats">');
  const seg = i >= 0 ? CT_C.slice(i, CT_C.indexOf('</div>', i)) : '';
  return i >= 0
    && seg.includes('class="dhi-badge"')
    && /主攻 \{\{ treeStats\.focused \}\}/.test(seg)
    && /停滞 \{\{ treeStats\.stalled \}\}/.test(seg)
    && seg.includes('class="hs-spine"')
    && !['愿景 {{', '使命 {{', '战略目标 {{', '项目 {{', '指标 {{', '任务 {{'].some(s => seg.includes(s));
});

check('D19-2 ★下钻接线真的在：heroToSpine 同时做三件事——expandSpine()（子组件暴露）+ onLayerOpen(1)（面板互斥与滚动复用）+ toast 回执；骨架条挂 ref', () => {
  return CT_C.includes('function heroToSpine()')
    && CT_C.includes("spineRef.value?.expandSpine()")
    && CT_C.includes('onLayerOpen(1)')
    && CT_C.includes('ref="spineRef"')
    && codeOnly(SPINE).includes('defineExpose({ expandSpine: () => { expanded.value = true } })');
});

check('D19-3 ★六层计数唯一账本住进骨架条（全量口径）：折叠态徽章 =「1 愿景 N · 2 使命 N · … · 6 任务 N」六段计数表达式；展开态六枚层位按钮各挂 LV_TIP 口径（≥6 条）', () => {
  const s = codeOnly(SPINE);
  const badge = s.slice(s.indexOf('spine-badge'), s.indexOf('spine-hint'));
  return ['counts.vision', 'counts.mission', 'counts.dirs', 'counts.projects', 'counts.metrics', 'counts.tasks']
    .every(k => badge.includes('{{ meta.' + k + ' }}'))
    && (SPINE.match(/^  \d: '/gm) || []).length >= 6
    && s.includes(':title="LV_TIP[lv.n]"');
});

check('D19-4 ★主攻聚焦条补「下一步」chip（与调度台 V3.9.18 / 项目详情同源）：吃 compassMeta 的 nextStep 与 nextStepSource，口径 tooltip 声明「一等公民：手动优先、清空自动推导」；不另写回退逻辑', () => {
  const strip = CT_C.slice(CT_C.indexOf('class="focus-strip"'), CT_C.indexOf('class="tree-layout"'));
  return strip.includes('class="fs-next"')
    && strip.includes('{{ focusTower.meta.nextStep }}')
    && strip.includes('focusTower.meta.nextStepSource')
    && strip.includes('下一步为项目一等公民')
    && !CT_C.includes('function focusNextOf')   /* 负锚：不许在视图里另造一份推导 */
    && CT_C.includes('.fs-next {');
});

check('D19-5 ★引导条退役、视图切换迁左栏（原型 .navside 顶部）：tl-head-row 与 gs-* 全族在 CompassTree 零命中（codeOnly 后）；view-seg 在 navside 切片内且项目塔/全景双向按钮俱在', () => {
  const nav = CT_C.slice(CT_C.indexOf('<aside class="navside"'), CT_C.indexOf('</aside>'));
  return !CT_C.includes('tl-head-row')
    && !CT_C.includes('class="gs-')
    && nav.includes('class="view-seg"')
    && nav.includes('项目塔') && nav.includes('项目全景')
    && /viewMode = 'tower'/.test(nav) && /viewMode = 'pano'/.test(nav);
});

check('D19-6 ★胶囊令牌 --radius-full（04-73 C-6）：tokens.css 定义在位；方向台四组件 999px/99px 圆角字面量清零（全部引用令牌）；令牌只在令牌表定义一次', () => {
  const lit = (f, src) => (src.match(/border-radius:\s*(999px|99px)/g) || []).map(x => f + ':' + x);
  const bad = [...lit('Tree', CT), ...lit('Spine', SPINE), ...lit('Tower', TOWER), ...lit('Pano', PANO)];
  if (bad.length) console.log('     残留：' + bad.join(' | '));
  return /--radius-full: 999px;/.test(TOKENS)
    && bad.length === 0
    && CT.includes('border-radius: var(--radius-full)')
    && SPINE.includes('border-radius: var(--radius-full)');
});

check('D19-7 ★密度令牌接通行级（04-73 D-1(a)）：任务行 .tk-row 与指标行 .metric-card 纵向读 --card-pad-vert；指标卡行距 .tw-rail section 读 --card-gap；泳道间距 .lanes 读 --card-gap——紧凑档在方向台真实生效', () => {
  return /\.tk-row \{[^}]*padding: var\(--card-pad-vert\) var\(--card-pad-horz\)/.test(codeOnly(LANE))
    && /\.metric-card \{[^}]*padding: var\(--card-pad-vert\) 4px var\(--card-pad-vert\) 14px;/.test(codeOnly(LANE))
    && /\.tw-rail > :deep\(section\) \{ margin-bottom: var\(--card-gap\); \}/.test(codeOnly(TOWER))
    && /\.lanes \{[^}]*gap: var\(--card-gap\)/.test(codeOnly(PANO));
});

check('D19-8 ★断点收敛 1024/800 两档（04-73 D-2）：CompassTree 媒询恰为 {1024, 800}（1100/480 零残留）；Spine/Lane/Tower 800 齐备且无 900/480；800 档保留 W11-20 的 164px 固定宽锚', () => {
  const qs = (src) => [...src.matchAll(/@media \(max-width: (\d+)px\)/g)].map(m => m[1]);
  const ct = qs(CT), sp = qs(SPINE), ln = qs(LANE), tw = qs(TOWER);
  const ok = ct.length === 2 && ct.every(q => ['1024', '800'].includes(q))
    && sp.join() === '800' && ln.join() === '800' && tw.join() === '800';
  if (!ok) console.log('     Tree=' + ct + ' / Spine=' + sp + ' / Lane=' + ln + ' / Tower=' + tw);
  return ok
    && /@media \(max-width: 800px\) \{[\s\S]*?\.ns-item \{ flex: 0 0 164px; width: 164px; scroll-snap-align: start; \}/.test(CT);
});

check('D19-9 ★Esc 链与热区不回退：onPageEsc 的三重守卫（非本页让位 / 一级无上级 / 浮层优先）原样在位；新增 hs-spine 下钻与 fs-next 均 ≥28px 热区或非交互', () => {
  return CT_C.includes("if (route.name !== 'compass') return")
    && CT_C.includes('if (!fromProjId.value) return')
    && CT_C.includes(".task-sidebar, .overlay:not(.gp-overlay)")
    && /\.hs-spine \{[^}]*min-height: 28px/s.test(CT);
});
