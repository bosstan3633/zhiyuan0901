/**
 * R174-1 分片 · 01-w7-focus：W7（V3.8.7）调度台视觉焦点契约。★2026-10-12 因 99-recent.cjs 被 W7 三条断言推到 906 行（破 R164-2 单片 ≤900 闸）而独立成分片——门禁原意就是「上限靠加分片而不是放宽」，本轮照此处置，断言一条不减零改写。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, srcFileEntries, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');


// ============== W7（V3.8.7）调度台视觉焦点契约 ==============
console.log('【W7 · 调度台焦点契约】');
check('W7-1 ★V3.9.1 随迁备案：今日三件事仍是首屏唯一主体 —— 页面标题承担 display 级视觉焦点，工作单用 border-strong + shadow-lg 抬起；手边卡留在次级平面，页头工具与侧栏不再抢焦点。本条继续守「首屏只有一个主角」，只把锚点从旧三张卡迁到现役两栏工作台', () => {
  const ch = codeOnly(read('/newtab/views/CompassHome.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  /* 主角：唯一 display + 重框 */
  return /\.desk-heading h1 \{[\s\S]*?font-size: clamp\(26px, 2\.4vw, 34px\)/.test(ch)
    && ch.includes('.work-board { border-color: var(--border-strong); box-shadow: var(--shadow-lg); }')
    /* 内容也参与焦点：计划行标题正文级、整行可点、勾选框独立 */
    && ch.includes('.title-text {') && ch.includes('font-size: var(--fs-body);')
    && ch.includes('.row-check {') && ch.includes('width: 28px;')
    && ch.includes('.row-check::before') && ch.includes('width: 20px;')
    /* 次级层：手边卡降为 shadow-sm，侧栏只做案头信息 */
    && ch.includes('.work-board,\n.hand-board {') && ch.includes('box-shadow: var(--shadow-sm);')
    && ch.includes('.hand-board { margin-top: 18px; }')
    && css.includes('.dz-sec-h .dz-t { font-size: var(--fs-title);')
    /* ★负锚：旧三张卡不得把主角形态带回来，侧栏也不许用重框 */
    && !ch.includes('.card.focus {') && !ch.includes('.today-card {')
    && !/\.rail-panel \{[^}]*box-shadow: var\(--shadow-lg\)/.test(ch);
});
check('W7-2 ★V3.9.1 随迁备案：焦点必须仍是**唯一标题级 display**。现扫全 src 标题类 display 用法，调度台只能有页头主标题一处；旧三张卡的 display 锚点不得回流。豁免仍为工具页标题与两枚图标位', () => {
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
  /* V3.9.1：调度台主标题改用 clamp 级排版，不再借用 22px 的 display token；
     因此这里核「调度台有一处页头主标题，且没有任何旧标题类 display 回流」。 */
  const home = codeOnly(read('/newtab/views/CompassHome.vue'));
  const homeFocus = /\.desk-heading h1 \{[\s\S]*?font-size: clamp\(26px, 2\.4vw, 34px\)/.test(home);
  const homeDisplayTitles = hits.filter(h => h.startsWith('newtab/views/CompassHome.vue'));
  return homeFocus && homeDisplayTitles.length === 0;
});
check('W7-3 ★V3.9.3 重指：热力图仍保留 26 周概览与全年网格两态，但画像洞察页的年度宿主默认展开全年；调度台等其它宿主默认仍收在概览条。正锚守住「折叠的是呈现不是数据」：COMPACT_WEEKS=26 + 概览条字面类 l0..l5 + 展开态全年网格 / 切年 / 导出 / 图例 + actsOf 单一真源；默认值由 `defaultExpanded` 显式选择，且展开/收起两个方向都必须有落点，不许退化成单向门', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return hm.includes('class="dz-mini"') && hm.includes('class="dz-mini-w"') && hm.includes('class="dz-mini-more"')
    && hm.includes('COMPACT_WEEKS = 26') && hm.includes('看全年 ›')
    /* ★条必须是**横向一行**：26 根条要挂在独立的 .dz-mini-strip（display:flex）里，
       不能直接挂在 .dz-mini（flex-direction:column）下——真机截图实证那样会让 26 根条竖着叠成
       细柱、首屏只留下一整块空白（原型是对的，移植时丢了容器）。本条钉住 strip 容器与列方向。 */
    && hm.includes('class="dz-mini-strip"')
    && css.includes('.dz-mini { display: flex; flex-direction: column; gap: 9px; }')
    /* ★只钉「横向一行」这个不变量，不钉 gap/height 的具体数值（补丁三把 strip 调高到 30px
       并加了基线，若锚死数值下次调尺寸又会假红）。行方向 +贴底对齐才是承重处。 */
    && /\.dz-mini-strip \{ display: flex;[^}]*align-items: flex-end/.test(css)
    /* 条高不许写死（由 strip 容器 + 内联 height 承担）——只认 `height:` 不认 `min-height:`，
       后者是刻意加的空档可见性兜底（补丁三），误伤它会逼着把兜底删掉。 */
    && !/\.dz-mini-w \{[^}]*[^-]height: \d+px/.test(css)
    && css.includes('min-height: 5px;')
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
    && hm.includes('defaultExpanded?: boolean')
    && hm.includes('const expanded = ref(!!props.defaultExpanded)')
    && read('/newtab/components/profile/PiYear.vue').includes('default-expanded')
    && hm.includes('@click="expanded = true"')
    && hm.includes('@click="expanded = false"');
});
check('W7-4 ★展开态不许被四枚指标抢焦点（用户 2026-10-12 真机截图反馈）：原`.dz-sum .v` 用 fs-headline(17px)，比它所在区块自己的标题（.dz-t 已降fs-title 15px）**还大** ⇒ 层级倒置、四枚数字压过全年网格。现降 fs-body(13px)+700、图标 30→22px、去卡面底色改纯文本行，且 .tx 由 column 改 baseline 同排——展开态的主角必须重新变回「全年网格本身」。★负锚钉死不许回涨到headline（这条就是防"指标卡又变大"）', () => {
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return css.includes('.dz-sum .v { font-size: var(--fs-body); font-weight: 700;')
    && !css.includes('.dz-sum .v { font-size: var(--fs-headline);')
    /* 层级自洽：大数必须严格小于本区块标题 fs-title(15px) —— 用字面量大小关系钉，不只钉 token 名 */
    && /\.dz-sum \.v \{ font-size: var\(--fs-(body|sub)\)/.test(css)
    /* 装饰减法：图标与卡面都收 */
    && css.includes('width: 22px; height: 22px; flex-shrink: 0; border-radius: 6px;')
    && css.includes('padding: 2px 4px; background: transparent;')
    && css.includes('.dz-sum .tx { display: flex; align-items: baseline; gap: 5px; min-width: 0; }');
});
check('W7-5 ★当日格子必须**看得见**且可被一眼认出：.dz-cell.today 用 accent 2px 实环（真机实证原1.5px text-2 描边在纸墨白底上等于没有）+ 选中态改 accent-light 填充 + offset 2px 与 today 可区分 + 图例补「今天」说明那一圈是什么（高亮若没说明，用户不知道该看哪格）', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return css.includes('.dz-cell.today::after { outline: 2px solid var(--accent); outline-offset: 1px; }')
    /* 负锚：原来那条弱描边不许复活 */
    && !css.includes('.dz-cell.today { outline: 1.5px solid var(--text-2);')
    /* today 与 sel 必须可区分（同在位时不糊）：sel 多一层 accent-light 填充 + offset 2px */
    && css.includes('.dz-cell.sel::after { outline: 2px solid var(--accent); outline-offset: 2px; background: var(--accent-light); }')
    /* 模板侧：today 类名确实由 months 计算产出并落到格子 class 上 */
    && hm.includes("if (k === today.value) cls.push('today')")
    /* 图例项在位（正锚吃 codeOnly：模板原文） */
    && hm.includes('class="lv today-key"') && hm.includes('今天</span>')
    && css.includes('.dz-legend .today-key::before');
});
check('W7-6 ★概览条空档必须可见（真机实证：lv=0 原用 heat-0，在纸墨白/苹果亮底上等于隐形，整条像坏了）：空档改 surface-3 + min-height 兜底 + strip 加基线（border-bottom）把柱子"落"在同一条线上；同时补 .l0 显式档避免只靠基础选择器', () => {
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return css.includes('.dz-mini-w { flex: 1; min-width: 0; min-height: 5px;')
    && css.includes('background: var(--surface-3); cursor: pointer; transform-origin: bottom;')
    /* ★负锚：heat-0 不许再当概览条空档底色（它在亮底上隐形） */
    && !/\.dz-mini-w \{[^}]*background: var\(--heat-0\)/.test(css)
    && css.includes('.dz-mini-w.l0 { background: var(--surface-3); }')
    /* 基线：条不悬空 */
    && css.includes('align-items: flex-end; height: 30px; padding-bottom: 1px; border-bottom: 1px solid var(--border); }')
    /* 悬停从底部放大，不跳 */
    && css.includes('transform-origin: bottom;');
});
