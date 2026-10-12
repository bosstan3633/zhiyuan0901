/**
 * R174-1 分片 · 01-w7-focus：W7（V3.8.7）调度台视觉焦点契约。★2026-10-12 因 99-recent.cjs 被 W7 三条断言推到 906 行（破 R164-2 单片 ≤900 闸）而独立成分片——门禁原意就是「上限靠加分片而不是放宽」，本轮照此处置，断言一条不减零改写。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, srcFileEntries, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

// ============== W8（V3.8.8）方向台视觉焦点契约 ==============
console.log('【W8 · 方向台焦点契约】');
check('W8-1 ★方向台主角＝愿景（用户2026-10-12 拍板 A 案）：.tl-text 升 --fs-display(22px) 且 L1 卡带 hero 类配shadow-lg 重框。★为什么是愿景：它是唯一的、语义根（产品名与 Slogan「自有我方向」都指向它）、且是需要被反复回看校准的静态锚；用户同时明确否掉「主攻项目当主角」（库里主攻有多个，会破坏唯一性）', () => {
  const t = codeOnly(read('/newtab/views/CompassTree.vue'));
  return t.includes('.tl-text { font-size: var(--fs-display); font-weight: 700;')
    && t.includes('.tree-level-card.hero { border-color: var(--border-strong); box-shadow: var(--shadow-lg);')
    && t.includes('class="tree-level-card hero" id="layer-1"')
    /*负锚：愿景不许退回字面量14px（原状）或降到 headline */
    && !t.includes('.tl-text { font-size: 14px;');
});
check('W8-2 ★六层字阶必须**真的分层**（原第2~6 层全是 --fs-body 13px，层级只能靠发丝缩进辨认）：使命 --fs-headline / 战略目标 --fs-title / 攻坚项目 --fs-headline（用户拍板：它是「当前在做的事」，比所属目标更该被看见）/ 指标·任务 保持 --fs-body。★取舍备案：字阶出现「使命17→目标15→项目17」起伏，扫读略跳——这是**有意取舍不是失误**，不许被后人当 bug「修正」成单调递减', () => {
  const t = codeOnly(read('/newtab/views/CompassTree.vue'));
  return t.includes('.tl-text.sub { font-size: var(--fs-headline); font-weight: 500;')
    && t.includes('.tct-name .node-title { font-size: var(--fs-title); font-weight: 600;')
    && t.includes('.tp-title .node-title { font-size: var(--fs-headline); font-weight: 600;')
    /* 指标与任务保持 body/sub 层——它们不该与战略目标/项目争（真实选择器是 .metric-item /
       .task-item，不是 mrow；★第一版我凭印象写了 .mrow，判据自己先红了一次） */
    && t.includes('.task-item { display: flex; align-items: center; gap: 7px; padding: 5px 9px 5px 20px; font-size: var(--fs-sub);')
    && !/\.metric-name \{[^}]*font-size: var\(--fs-(title|headline|display)\)/.test(t)
    && !/\.task-item \{[^}]*font-size: var\(--fs-(title|headline|display)\)/.test(t);
});
check('W8-3 ★层级倒置不得复发：内容标题必须**大于**页头面包屑。原状面包屑 16px > 内容标题 11px（caption）⇒ 倒置。修法不是降面包屑而是抬内容标题——★R123 定案「三页页头统一 16px」是跨页一致性决策，用户拍板保三页一致，故 crumb 维持 16px、改把「六层思维链」提到 --fs-headline(17px)。层级：愿景22 › 区块标题17 › 面包屑16 › 正文13，单调递减', () => {
  const t = codeOnly(read('/newtab/views/CompassTree.vue'));
  return t.includes('.lt-title { font-size: var(--fs-headline); font-weight: 600;')
    /* 面包屑必须仍是 16px（这是 R123 的跨页一致性，R51-6 / R123-10 两条判据仍在守它） */
    && t.includes('font-size: 16px; letter-spacing: .2px;')
    /* ★负锚：lt-title 不许退回 caption 11px（倒置的成因） */
    && !t.includes('.lt-title { font-size: var(--fs-caption);');
});
check('W8-4 ★主攻项目必须是**次级焦点**（原仅 accent-28% 边框 + 🚀 emoji，而它是「我现在在哪」的唯一落点）：accent 边框 + accent-light 底色 + 标题转 accent-ink。★附带负锚：同选择器的弱描边旧规则已整条删除——两条 .is-focused 并存＝靠 cascade 碰巧生效，是 W7-5 抓过的那类暗病', () => {
  const t = codeOnly(read('/newtab/views/CompassTree.vue'));
  return t.includes('.tree-project-branch.is-focused { border-color: var(--accent); background: var(--accent-light);')
    && t.includes('.tree-project-branch.is-focused .tp-title .node-title { color: var(--accent-ink); }')
    /* ★负锚：旧弱描边（accent 28%）不许复活 */
    && !/\.tree-project-branch\.is-focused \{[^}]*accent\) 28%/.test(t)
    /* 模板侧：is-focused 类名绑定与 🚀 标记仍在位 */
    && t.includes("'is-focused': proj.isFocused") && t.includes('tp-mark');
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
