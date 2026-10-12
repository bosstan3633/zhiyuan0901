/**
 * R174-1 分片 · 01-w7-focus：W7（V3.8.7）调度台视觉焦点契约。★2026-10-12 因 99-recent.cjs 被 W7 三条断言推到 906 行（破 R164-2 单片 ≤900 闸）而独立成分片——门禁原意就是「上限靠加分片而不是放宽」，本轮照此处置，断言一条不减零改写。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, srcFileEntries, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');


// ============== W7（V3.8.7）调度台视觉焦点契约 ==============
console.log('【W7 · 调度台焦点契约】');
check('W7-1 ★焦点契约（本页只允许一处display 级主体，用户 2026-10-12 拍板）：今日三件事 = 全页唯一 fs-display(22px) + 重框 shadow-lg；三张卡与年度热力图标题降到 fs-title(15px)，三张卡框体去阴影。★为什么值得钉：W5「三标题统一 17px」把主角与工具区抹成同规格，首屏因此没有焦点（fs-display 全站主工作面 0 使用）——本条是那个病灶的棘轮。锚点取**行首可执行的选择器**而非标题文案（改文案不必重指）', () => {
  const ch = codeOnly(read('/newtab/views/CompassHome.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  /* 主角：唯一 display + 重框 */
  return ch.includes('.card.focus .card-head .nm { font-size: var(--fs-display);')
    && ch.includes('.card.focus { border-color: var(--border-strong); background: var(--surface); box-shadow: var(--shadow-lg); }')
    /* 内容也参与焦点：格内任务名 headline + 勾选框 18px */
    && ch.includes('.tc-title { font-size: var(--fs-headline);')
    && ch.includes('.tc-check { width: 18px')
    /* 次级降级：三张卡 title + 去阴影；热力图 title */
    && ch.includes('.decks-title .nm { font-size: var(--fs-title);')
    && ch.includes('.deck-frame { padding: 12px 20px 16px;') && ch.includes('box-shadow: none;')
    && css.includes('.dz-sec-h .dz-t { font-size: var(--fs-title);')
    /* ★负锚：display 不得外溢到次级区（这条是"唯一"二字的守法，改成"至少一处"就红） */
    && !ch.includes('.decks-title .nm { font-size: var(--fs-display)')
    && !css.includes('.dz-sec-h .dz-t { font-size: var(--fs-display)');
});
check('W7-2 ★焦点必须是**唯一标题级display**而不是"这一处是 22px"：现扫 src 全站`var(--fs-display)` 的**标题类**用法（选择器名含 title / nm / head / h1-h6），落在四大工作面（调度台 / 方向台 / 策展台 / 单台详情 + dashboard 组件）的必须只有今日三件事一处 —— 防止焦点契约被后续轮次稀释成"到处都 display"。★豁免带备案（写清为何不算标题焦点）：① ManualPage / RecycleBin 是工具页，页面标题本就该是全站最大；② GlobalSettings 的 `.gs-io-icon` 是 36×36 **图标位**不是标题；③ ConfirmDialog 的 `.cdf-icon` 同为图标位', () => {
  const TOOL_PAGES = ['newtab/views/ManualPage.vue', 'newtab/views/RecycleBin.vue'];
  const ICON_SEL = ['.gs-io-icon', '.cdf-icon'];
  const hits = [];
  for (const e of srcFileEntries()) {
    if (!/^newtab\//.test(e.rel)) continue;
    if (TOOL_PAGES.includes(e.rel)) continue;
    const txt = codeOnly(e.text);
    // 匹配「…选择器链 { … font-size: var(--fs-display) … }」——取**整条选择器链**再判标题类，
    // ★踩坑账：只取链尾第一段会把 `.card.focus .card-head .nm` 读成 `.card`（容器名）从而错判为非标题。
    const re = /([^{}]+)\{[^{}]*font-size:\s*var\(--fs-display\)/g;
    let m;
    while ((m = re.exec(txt))) {
      const chain = m[1].trim();
      const last = chain.split(/[\s,>]+/).pop();      // 链尾那段才是真正承载字号的元素
      if (ICON_SEL.some(i => last.endsWith(i))) continue;
      if (!/title|\.nm$|head|^h[1-6]$|-h$/.test(last)) continue;
      hits.push(e.rel + ' → ' + chain);
    }
  }
  return hits.length === 1 && hits[0].startsWith('newtab/views/CompassHome.vue');
});
check('W7-3 ★热力图概览条（用户拍板A 案：压成 26 周概览条 + 「看全年 ›」，回看型内容不再占首屏最大连续面积）：dz-mini 在位且类名是**字面量表** l0..l5（dead-css-scan 看不见运行时拼串，故不许 `l${lv}`）+ COMPACT_WEEKS=26 + 展开态保留全年 366 格与切年/导出/图例（折叠的是呈现不是数据）+ 两枚数字口径走 actsOf 单一真源。★2026-10-12 补钉**双向**：V3.8.7 首版只给「看全年 ›」没给回来的路——展开后与旧版长得一样且回不去（用户真机截图当场发现），本条因此同时钉住 `expanded = false` 的收起路径，不许再退化成单向门', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return hm.includes('class="dz-mini"') && hm.includes('class="dz-mini-w"') && hm.includes('class="dz-mini-more"')
    && hm.includes('COMPACT_WEEKS = 26') && hm.includes('看全年 ›')
    /* ★条必须是**横向一行**：26 根条要挂在独立的 .dz-mini-strip（display:flex）里，
       不能直接挂在 .dz-mini（flex-direction:column）下——真机截图实证那样会让 26 根条竖着叠成
       细柱、首屏只留下一整块空白（原型是对的，移植时丢了容器）。本条钉住 strip 容器与列方向。 */
    && hm.includes('class="dz-mini-strip"')
    && css.includes('.dz-mini { display: flex; flex-direction: column; gap: 9px; }')
    && css.includes('.dz-mini-strip { display: flex; gap: 2px; align-items: flex-end; height: 26px; }')
    && !css.includes('.dz-mini-w { flex: 1; min-width: 0; height: 26px;') /* 条高不再写死在条上，由 strip 容器 + 内联高度承担 */
    && hm.includes('.dz-mini-w.l1') === false /* 类名靠 :class 绑定表，正锚看 CSS 六档在位 */
    && css.includes('.dz-mini-w {') && css.includes('.dz-mini-w.l5 { background: var(--heat-5); }')
    && css.includes('.dz-mini-more {')
    /* 展开态三件套一件不许丢：全年网格 / 切年 / 导出 */
    && hm.includes('class="dz-months"') && hm.includes('class="dz-cell"') && hm.includes('class="dz-legend"')
    && hm.includes("shiftYear(-1)") && hm.includes(':formats="[\'png\', \'html\']"')
    /* 计数口径：今日操作数走 actsOf，不自造字段 */
    && hm.includes('actsOf(r)') && !hm.includes('r.n :')
    /* ★双向折叠：默认 false + 两个方向都要有落点（收起用行内@click="expanded = false"，
       正锚吃原文/codeOnly 不吃——所以这里特意用完整绑定串而不是只看 "expanded" 这个词，
       否则「声明了变量但没接按钮」也会绿）。*/
    && hm.includes('const expanded = ref(false)')
    && hm.includes('@click="expanded = true"')
    && hm.includes('@click="expanded = false"');
});
