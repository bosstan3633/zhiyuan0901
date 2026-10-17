/**
 * R174-1 分片 · 01-w7-focus：W7（V3.8.7）调度台视觉焦点契约。★2026-10-12 因 99-recent.cjs 被 W7 三条断言推到 906 行（破 R164-2 单片 ≤900 闸）而独立成分片——门禁原意就是「上限靠加分片而不是放宽」，本轮照此处置，断言一条不减零改写。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, srcFileEntries, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');

// ============== W8（V3.8.8）方向台视觉焦点契约 ==============
console.log('【W8 · 方向台焦点契约】');
check('W8-1 ★方向台主角＝愿景（用户2026-10-12 拍板 A 案）：.tl-text 升 --fs-display(22px) 且 L1 卡带 hero 类配强调框。★为什么是愿景：它是唯一的、语义根（产品名与 Slogan「自有我方向」都指向它）、且是需要被反复回看校准的静态锚；用户同时明确否掉「主攻项目当主角」（库里主攻有多个，会破坏唯一性）。★W12(V3.8.12)随迁备案：L1 卡的强调框由 shadow-lg 重框改为左侧 2px accent 实轨（愿景正文已搬进层级面板，面板自带卡面，块内再套卡会变成双层框把主角压下去）—— 主角感仍由版式承担，守的行为未变', () => {
  const t = codeOnly(CT_ALL);
  return t.includes('.tl-text { font-size: var(--fs-display); font-weight: 700;')
    && t.includes('.tree-level-card.hero {') && t.includes('border-left: 2px solid var(--accent);')
    && t.includes('class="tree-level-card hero" id="layer-1"')
    /*负锚：愿景不许退回字面量14px（原状）或降到 headline */
    && !t.includes('.tl-text { font-size: 14px;');
});
check('W8-2 ★六层字阶必须**真的分层**。★W11(V3.8.11)随迁带备案：W11 起六层分居四个文件：使命/战略目标在 CompassTree.vue（.tl-text.sub / .dh-n）、项目与指标在 CompassTower.vue / CompassLane.vue。判据改钉**各层实际字号**而非旧文件位置——本条守的是"层级差真的存在"，不是"样式写在哪个文件"。★取舍备案：层级仍允许使命17 › 项目15 的起伏，这是有意取舍不是失误。★W12 随迁备案：hero 留白锚由 30px 改为 14/16px（块内让位给面板卡面）+ accent 实轨', () => {
  const missionOk = /\.tl-text\.sub \{ font-size: var\(--fs-headline\)/.test(CT_W11);
  const dirOk = /\.dh-n \{ font-size: var\(--fs-title\)/.test(CT_W11);
  const projOk = /\.tw-name-t \{ font-size: var\(--fs-title\)/.test(TOWER);
  const metricOk = /\.mc-title \{[^}]*font-size: var\(--fs-sub\)/.test(LANE);
  const taskOk = /\.tk-title \{[^}]*font-size: var\(--fs-body\)/.test(LANE);
  const noInflate = !/\.mc-title \{[^}]*font-size: var\(--fs-(title|headline|display)\)/.test(LANE)
    && !/\.tk-title \{[^}]*font-size: var\(--fs-(title|headline|display)\)/.test(LANE);
  /* ★W11 版式补偿 → W12：hero 独占一行 + 大留白（外框改 accent 实轨，见 W8-1 备案） */
  const layoutOk = /\.tree-level-card\.hero \{[^}]*padding: 14px 0 16px 16px/.test(CT_W11)
    && /\.tree-level-card\.hero \{[^}]*border-left: 2px solid var\(--accent\)/.test(CT_W11);
  return missionOk && dirOk && projOk && metricOk && taskOk && noInflate && layoutOk;
});

check('W8-3 ★层级倒置不得复发：内容标题必须**大于**页头基准字号。【W8 原判】页头 16px > 内容 11px 倒置，修法是抬内容标题。★W12 随迁：载体曾迁到 .hero-title(--fs-headline 17px) 与 .hero-crumb(16px)。★V3.8.20 翻转带备案（用户拍板 2026-10-15）：HERO 左文案栏（含 .hero-title/.hero-crumb）整块退役 —— "页头基准 vs 内容标题"这对关系的页头一侧不复存在，倒置病根（crumb 16px 压内容 11px）随之消灭。本条守的意图不变，断言随载体翻转：① 负锚升级为**退役负锚**——.hero-title 与 .hero-crumb 在方向台全家桶 codeOnly 零命中（防文案区回流把倒置一起带回来）② 内容标题不许退回 caption 11px 的老病根负锚保留 ③ 层级守卫的活体载体由 .lt-title 负锚继续钉（六层目录退役后仍不许回流 caption 标题）', () => {
  const t = codeOnly(CT_ALL);
  /* ★退役负锚：文案区不许回流（回流 = 倒置病根回流） */
  const retired = !t.includes('.hero-title') && !t.includes('.hero-crumb') && !t.includes('class="hero-title"');
  /* ★老病根负锚保留：内容标题不许退回 caption 11px */
  const noInflate = !t.includes('.lt-title { font-size: var(--fs-caption);');
  return retired && noInflate;
});
check('W8-4 ★主攻项目必须是**次级焦点**（原仅 accent-28% 边框 + 🚀 emoji，而它是「我现在在哪」的唯一落点）。★W11(V3.8.11)随迁带备案：项目舱结构重排，承重处迁到 .tower 的 tw-badge.focus 徽标 + 舱头 accent 强调；本条守的是"主攻一眼可辨且是次级焦点"，弱描边旧规则仍不许复活', () => {
  return TOWER.includes('class="tw-badge focus"')
    /* ★随迁：设主攻文案随舱 ▾ 菜单迁到 CompassTower（不再是树本体的函数调用点）；G1 迁移后裸文本 */
    && TOWER.includes('设为主攻')
    && /\.tw-badge\.focus \{[^}]*accent-ink/.test(TOWER)
    /* ★次级焦点的另一半：字号必须小于 --fs-title（主攻也不能抢愿景的 display）。
       注意 font-size 写在基类 .tw-badge 上、focus 只改色承重，所以判据钉基类而不是 .focus。 */
    && /\.tw-badge \{[^}]*font-size: var\(--fs-micro\)/.test(TOWER)
    && !/\.tw-badge\.focus[^}]*font-size: var\(--fs-(title|headline|display)\)/.test(TOWER)
    /* ★负锚：旧弱描边（accent 28%）与旧 .is-focused 双规则都不许复活 */
    && !/is-focused\s*\{[^}]*accent\) 28%/.test(CT_ALL)
    && !/\.tree-project-branch\.is-focused/.test(CT_ALL);
});

check('W8-5 ★焦点唯一性扩到第二个工作面：全 src 现扫**标题级** fs-display 的使用点，落在工作面（newtab/views + newtab/components，排除工具页与图标位）的必须**恰好两处**——调度台今日三件事 + 方向台愿景。本条把 W7-2 的「恰好 1 处」扩成跨工作面的总量约束，防止焦点契约在后续轮次被稀释成"到处都display"', () => {
  const TOOL_PAGES = ['newtab/views/ManualPage.vue', 'newtab/views/RecycleBin.vue'];
  const ICON_SEL = ['.gs-io-icon', '.cdf-icon'];
  const hits = [];
  for (const e of srcFileEntries()) {
    if (!/^newtab\//.test(e.rel)) continue;
    if (TOOL_PAGES.includes(e.rel)) continue;
    const txt = codeOnly(e.text);
    const re = /([^{}]+)\{[^{}]*font-size:\s*var\(--fs-display\)/g;
    let m;
    while ((m = re.exec(txt))) {
      const chain = m[1].trim();
      const last = chain.split(/[\s,>]+/).pop();
      if (ICON_SEL.some(i => last.endsWith(i))) continue;
      if (!/title|\.nm$|head|^h[1-6]$|-h$|\.tl-text/.test(last)) continue;
      hits.push(e.rel + ' → ' + chain);
    }
  }
  /* 恰两处：CompassHome 的今日三件事 + CompassTree 的愿景。
     ★踩坑账：命中串是「rel → 选择器链」，rel 带 `newtab/views/` 前缀，所以判归属要用
     `indexOf(...) === 0` 永远不成立 ⇒ 判据恒红。必须 startsWith。 */
  const homes = hits.filter(h => h.startsWith('newtab/views/CompassHome.vue')).length;
  const trees = hits.filter(h => h.startsWith('newtab/views/CompassTree.vue')).length;
  return hits.length === 2 && homes === 1 && trees === 1;
});
