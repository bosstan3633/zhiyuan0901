/**
 * R174-1 分片 · 80-R120-R143：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');

console.log('【R120 · V2.88.0：搜索键位统一（网页浮层 / 应用内搜索）】');
check('R120-1 网页浮层 Ctrl+Enter=仅定位：openSearchLocator 不再透传 drawer，改 hl+hk(+cat) 路由 + 定位 toast', () => { const s = read('/content/overlay-impl.ts'); return s.includes('function openSearchLocator') && !s.includes('drawer: { kind') && s.includes('&hk=res') && s.includes('&hk=task') && s.includes('&hk=curio') && s.includes('已定位到卡片所在处'); });
check('R120-2 网页浮层 单击/Enter=开链：openSearchResult 保留（无链接降级定位）+ 行 title 文案统一', () => { const s = read('/content/overlay-impl.ts'); return s.includes('function openSearchResult') && s.includes('单击/Enter → 打开链接（无链接则定位） · Ctrl+Enter → 定位到卡片所在处'); });
check('R120-3 应用内 单击/Enter=开链优先：openLinkOrLocate（资源卡有可打开链接→openResLink；否则 openItem）+ pickRow 绑定', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('function openLinkOrLocate') && g.includes('toOpenableUrl(r.linkType, r.link)') && g.includes('openResLink(item)') && g.includes('@click="pickRow(item, $event)"') /* R152：同上 */; });
check('R120-4 应用内 Ctrl+Enter=仅定位：locateOnly（hl+hk+cat，无 emitOpenDrawer）+ runFlatLocator 指向', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('function locateOnly') && g.includes('locateOnly(it.item)') && !g.includes('emitOpenDrawer'); });
/* R120-5 于 B7-e（V3.8.40）重指两条：原锚钉GlobalPopups 里手写清单的
   `desc: '定位到卡片所在处'`，而 H3 把手写清单换成 shortcuts.ts 派生 ⇒ 该字面量迁到真源的
   `action:` 字段。判据意图（手册与界面键位提示不许脱节）不变，重指为**跨真源一致性**：
   手册那份快捷键表必须派生自 shortcuts.ts，且真源里「定位到卡片所在处」这条仍在、
   速查面板仍经派生量渲染。★这比钉一个组件里的 desc 强：字面量搬家就假红，
   而"三处同源"才是这条判据真正要守的东西。 */
check('R120-5 手册与键位提示同步：搜索章节三键说明 + 底部键位条 + 快捷键清单（★G1(V3.8.24)随迁带备案：底部键位条 ⏎ 符号随 emoji→Icon 迁移改纯文本 Enter，锚点随迁；★B7-e 重指末两条：手写清单已随 H3 退役，改钉真源派生 + 该条动作名仍在真源）', () => {
  const m = read('/newtab/manual-data.ts'); const g = read('/newtab/components/GlobalPopups.vue'); const sc = read('/shared/utils/shortcuts.ts');
  /* ★V3.9.6 重指带备案：速查面板已拆到 GlobalPopupsShortcuts.vue（GlobalPopups 第二梯队拆分 · 第一块），
     派生量随之改名 `groups` ⇒ 末条锚点改指拆出后的组件，判据意图（速查仍经派生量渲染）一字未改。 */
  const gps = read('/newtab/components/GlobalPopupsShortcuts.vue');
  return m.includes('结果键位（单击 / Enter / Ctrl+Enter 三键）') && m.includes('打开卡片链接')
    && g.includes('<kbd>Ctrl+Enter / 单击</kbd> 定位卡片') /* R153 备案：鼠标侧补了 Ctrl+单击=定位，脚注键位条同步写明，别再只写键盘一条路 */
    && sc.includes("action: '仅定位到卡片所在处，不打开链接'")
    && /shortcutTableHtml\('placeholder'\)/.test(m)
    && /v-for="grp in groups"/.test(gps);
});

// ============== R120 · V2.88.0 批次B：调度台 UI 对齐原型（只改 UI，功能与交互不动） ==============
console.log('【R120 · V2.88.0 批次B：调度台 UI 对齐原型】');
check('R120-6（V3.9.14 重指）方向读数分层：右栏「今天的状态」承担主攻/未归档/本周复用，页脚承接存储/同步，战报移入页头动作区，旧合流方向条零残留', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('class="side-rail"') && h.includes('class="stat-list"') && h.includes('class="foot-status"') && h.includes('class="why-trigger battle-trigger"') && h.includes('今日战报') && !h.includes('<MetricBar>') && !h.includes("openRec('in')"); });
check('R120-7（V3.9.1 重指）三件事对齐两栏工作单：方形勾选随主题强调色、行首 28px 复选框热区（内部仍为 20px 方块）+ 内容列 + 行尾动作，槽位 min-height 74px，完成条文案保留', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('border-radius: 5px;') && h.includes('border: 1.5px solid var(--border-strong);') && h.includes('.row-check.done::before { border-color: var(--accent); background: var(--accent); }') && h.includes('grid-template-columns: 28px minmax(0, 1fr) auto 28px;') && h.includes('min-height: 74px;') && h.includes('<Icon name="check" :size="13" /> 今日三件事已闭环 · 专注带来从容'); });
check('R120-8 项目调度对齐原型', () => { const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return !h.includes('class="cur-progress"') && !h.includes('cur-stats-v2') && pc.includes('class="pb-stats"');  });
check('R120-9（V3.9.1 重指）底部胶囊 Tab 退役：三卡改为三列预览，查看全部用轻量文字入口，旧 bt-tab 零残留', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('class="hand-grid"') && h.includes('class="hand-link"') && h.includes('查看全部') && !h.includes('bt-tab') && !h.includes('bt-hint'); });
check('R120-10 主题收口 ★R2-② 随迁：段锚随项目调度卡退役与论证卡 CSS 新增更新（TB1 尾锚 .split→.today-body；新增 R2-① 段至 </style>）；零硬编码色判据不变', () => { const seg = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b); return i >= 0 && j > i ? src.slice(i, j) : src }; const h = read('/newtab/views/CompassHome.vue'); const mb = read('/newtab/components/compass/MetricBar.vue'); const tm = read('/newtab/components/compass/TaskManagerPanel.vue'); const blk = seg(h, '/* R120-TB1：合流方向条内元素', '.today-body {') + seg(h, '/* R120-TB2：今日三件事', '.tc-title {') + seg(h, '/* R169-T4：归属压扁成一行', '.cg-caret {') /* R169-T4 重指：原「R120-TB3：项目概要面板」块已被一行归属取代 */ + seg(h, '/* R120-TB4：底部胶囊 Tab', '.bottom-pane {') + seg(mb, '/* R120-TB1：合流方向条', '@media'); const hex = (blk.match(/#[0-9a-fA-F]{3,6}/g) || []).filter((x) => x.toLowerCase() !== '#fff'); return hex.length === 0 && tm.includes('.tm-card { position: relative; background: var(--surface);'); });

// ============== R121 · V2.89.0：方向台 UI 迭代（对齐原型）+ 完整方向树重构 ==============
console.log('【R121 · V2.89.0：方向台（主航线 3 列 + 行卡 + 联动展板）· 完整方向树（三列分支 + 发丝缩进）】');
check('R121-1 方向台页头 ★R3-B1 随宿主改靶 + ★W12 随迁备案 + ★V3.8.20 翻转带备案（用户拍板 2026-10-15）：台面身份文案（hero-crumb「方向台 · 六层思维链全深度」）随左文案栏整块退役 —— 方向台是工作台面，身份由路由与骨架条承担，不设页头文案区。★G1(V3.8.24)随迁带备案：主攻读数前缀由 emoji「🚀」迁移为 <Icon name="main-focus">，锚点随迁。翻转不删断言：身份文案锚改退役负锚（字符串零命中，防回流），其余三项能力锚（主线摘要 hero-stats / 已完成开关 👁 / 目标级入口 ＋战略目标）一字不动；面板级「完整方向树 ›」导航随合并退役维持负锚', () => { const cs = CT_ALL; return !cs.includes('六层思维链全深度') && cs.includes('Icon name="main-focus"') && cs.includes('主攻 {{ treeStats.focused }}') && cs.includes('👁 已完成项目') && cs.includes('＋ 战略目标') && /<section class="hero"(?:\s|>)/.test(cs) && cs.includes('class="hero-stats"') && cs.includes('class="hero-acts"') && !cs.includes('class="tree-link"'); });
check('R121-2 锚点条 M1 ★R3-B1 退役重指带备案：.vm-bar 中性卡随主航线退役，愿景/使命改由方向台首屏第 1-2 层卡承担（层级徽标 1 愿景 · 终极方向 / 2 使命 · 行动准则 在位，不再需要"跳去"入口）', () => { const l = CT_ALL; return !exists('/newtab/components/compass/LighthousePanel.vue') && l.includes('1 愿景 · 终极方向') && l.includes('2 使命 · 行动准则') && !l.includes('class="vm-bar"'); });
check('R121-3 主攻条 M4 ★R3-B1 退役重指带备案 + ★G1(V3.8.24)随迁带备案：聚焦条（selected 态/单击联动/双击进详情/项目详情表单 ›）整体退役，指定主攻改走树 ▾ 菜单（CompassTower twm-item，「设为主攻」文本无 emoji 前缀）；★zy-open-project-detail 事件链一并清理（全站零命中——唤起项目详情抽屉只剩进详情页点 ⚙ 这一条路）', () => { const t = CT_ALL; const pc = read('/newtab/views/ProjectCuration.vue'); return !t.includes('focus-bar') && !t.includes('fs-detail-link') && t.includes('设为主攻') && !pc.includes('zy-open-project-detail') && !codeOnly(t).includes('zy-open-project-detail'); });
check('R121-4 主航线网格与项目行卡 ★W11(V3.8.11)随迁带备案：goals-grid/goal-card/proj-row 退役；W11 又把方向树的 .tree-columns-grid 一并废止（用户拍板改纵向成舱）。本条改判**项目读数在舱头常驻**（进度环 + 完成数 + 指标任务数），这才是"读数不失"的真意', () => {
  const t = CT_ALL;
  return /class="tower-list"/.test(t)
    && TOWER.includes('class="tw-ring-v"')
    && TOWER.includes('class="tw-num"')
    && /任务完成/.test(TOWER)
    && !t.includes('class="goal-card"')
    /* ★负锚：旧三列网格彻底消失 */
    && !/\.tree-columns-grid\s*\{/.test(t);
});

check('R121-5 选中联动链路 ★R3-B1 退役重指带备案：?p 作为"方向台首屏选中哪张展板"的唯一口径随内嵌展板退役；?p 仍是**项目详情页**的定位口径，树的深链口径换成 ?hl（定位战略目标）+ ?from=proj&p（返回来源项目）', () => { const t = CT_ALL; const pc = read('/newtab/views/ProjectCuration.vue'); return !t.includes('onSelectProject') && !t.includes('selectedProjectId') && t.includes('function locateHlGoal') && pc.includes("typeof route.query.p === 'string'"); });
check('R121-6 项目操作入口 ★R3-B1 随宿主改靶 + ★R3-B2 补回置顶 + ★W11 再随迁带备案 + ★F5 激进瘦身翻转（2026-10-15）+ ★G1(V3.8.24)随迁带备案：行卡右键菜单退役，项目舱 .tw-menu（承重处随结构迁到 CompassTree 注册的 CompassTower）承接**菜单内五项**（设主攻/置顶/AI建议指标/导入模板/删除项目，emoji 前缀随 Icon 化迁移：AI✦→sparkle、导入📋→filetext、删除🗑→trash，设主攻/置顶为纯文本），排序走**整块舱头拖拽**（onHeadDragStart 拦截 button/contenteditable），加指标由菜单项升为常驻「＋指标」钮；置顶只走菜单（原 📌 常驻钮收进菜单）。两者都不回到右键形态', () => { const t = CT_ALL, tc = codeOnly(TOWER); const menu = tc.slice(tc.indexOf('class="tw-menu"'), tc.indexOf('class="tw-body"')); return !t.includes('class="proj-menu"') && t.includes('class="tw-menu"') && t.includes('设为主攻') && t.includes('置顶到本目标前排') && t.includes('<Icon name="trash" :size="13"/> 删除项目') && menu.includes('<Icon name="sparkle" :size="13"/> AI 建议指标') && menu.includes('<Icon name="filetext" :size="13"/> 导入模板') && tc.includes('>＋指标</button>') && !menu.includes('＋ 添加成功指标') && !tc.includes('📄 进入项目详情页'); });
check('R121-7 展板重排：单行面包屑（pb-crumb/pc-seg/pc-current）+ 标题行（可编辑名+主攻+大 pct）+ 统计条（pb-stats 4 值）+ ⋯菜单（主攻/树定位/删除项目）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('class="pb-crumb"') && pc.includes('pc-seg') && pc.includes('class="pb-title-row"') && pc.includes('class="pb-stats"') && pc.includes('projMenuOpen') && pc.includes('删除项目'); });
check('R121-8 左栏退役：proj-rail/prt-*/rail-grip 零残留；指标块改 metric-head2 头（mh-idx/mh-meta）+ 任务行发丝分隔（btask hairline）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return !pc.includes('proj-rail') && !pc.includes('prt-') && !pc.includes('rail-grip') && pc.includes('mh-idx') && pc.includes('mh-meta') && pc.includes('.btask { border-radius: 0; border-bottom: 1px solid var(--hairline); padding: 9px 14px; }'); });
check('R121-9 能力保留：展板内指标/任务拖拽（onMetricDrop/onTaskDrop）+ 重命名/删除/添加 + 附件聚合 + 任务详情', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('function onTaskDrop') && pc.includes('function onMetricDrop') && pc.includes('function renameMetric') && pc.includes('function removeMetric') && pc.includes('function removeTask') && pc.includes('class="metric-sec asset-sec"') && pc.includes('function openTaskDetail'); });
check('R121-10 完整方向树：L1&L2 单卡 + 第3~6 层容器 ★W11(V3.8.11)随迁带备案：原锚「三列分支网格」已随用户拍板废止；本条守的是**六层结构在位**，改判：愿景/使命单卡（.tree-level-card hero）+ 分组头（.dir-head）+ 项目舱（.tower-list）+ 指标卡（.metric-card）四类容器齐备', () => {
  const t = CT_ALL;
  return t.includes('class="tree-level-card hero" id="layer-1"')
    && t.includes('class="tl-badge"')
    && t.includes('class="tower-list" id="layer-4"')
    && t.includes('class="dir-head"')
    && LANE.includes('class="metric-card"');
});

check('R121-11 树内缩进 + 任务行 + 空指标警示 ★W11(V3.8.11)随迁带备案：原锚 tree-metric-branch(border-left) / tm-task-leaf / tm-empty-alert 随三列网格一并退役；W11 用**归属轨道**表达同一件事：.metric-list::before 竖轨 + .tk-row::before 分叉臂 + .mc-orphan 断链空位', () => {
  const lane = LANE;
  const ok = [
    /* 归属竖轨 */
    /\.metric-list::before \{/.test(lane),
    /* 任务分叉臂 */
    /\.tk-row::before \{/.test(lane),
    /* 任务行本体 */
    /class="tk-row"/.test(lane),
    /* 断链空位（空指标警示的新形态） */
    /class="mc-orphan"/.test(lane)
  ];
  /* ★负锚：旧发丝缩进类不许以新名字回流 */
  const noOld = !/\.tree-metric-branch\s*\{/.test(CT_ALL) && !/\.tm-task-leaf\s*\{/.test(CT_ALL);
  return ok.every(Boolean) && noOld;
});

check('R121-12 树内能力保留：编辑 + 节点操作 hover + 指标折叠 + 展开/收起 ★W11(V3.8.11)随迁带备案：原锚tct-acts/tp-acts/tm-acts 三套 hover 动作组已随结构重排重指为 .dh-acts/.tw-acts/.mc-toggle；编辑与折叠能力逐项在位，本条守"能力一项未减"', () => {
  const t = CT_ALL;
  return /class="node-title editable/.test(t)
    && /\.dh-acts\s*\{/.test(t)
    && /\.tw-acts\s*\{/.test(TOWER)
    && /\.mc-toggle\s*\{/.test(LANE)
    && /expandedMetrics/.test(CT_W11)
    && /function toggleProjectFold/.test(CT_W11)
    && /function expandAllNodes/.test(CT_W11)
    && /function collapseAllNodes/.test(CT_W11);
});

check('R122-1 页头摘要（V3.7.0 重指）：自写描述内联 + 「N 个分类」摘要 + 更新流水入口；提示条/教学气泡退役', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('v-if="wsHeadDescOwn"') && w.includes('{{ categories.length }} 个分类') && w.includes('class="wsh-upd"') && !w.includes('wsh-tip') && !w.includes('wsh-help') && !w.includes('资源卡唯一存储'); });
// V3.7.0（R179）退役：hub 横排指标盒（ws-metrics hub3 flat）随资源台退役——指标条单形态（cur3 三格）由 R75-5 承接。
check('R122-2 指标条横排盒（V3.7.0 退役）：hub3 flat 形态零残留', () => { const w = read('/newtab/views/Workspace.vue'); return !w.includes('ws-metrics hub3') && !w.includes('hub3'); });
check('R122-3（V3.9.9 随迁）工具条提权：策展画布常驻导入成果 HTML 与分享成果；建支只走节点 Tab / Enter，旧「＋ 新建分支」「＋ 新建论证卡」与画布批量栏均已退役，不得回流', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  return !w.includes('＋ 新建分支')
    && !w.includes("@click=\"mind.createChild('root')\"")
    && w.includes('<Icon name="download" :size="13"/> 导入成果 HTML</button>')
    && w.includes('<Icon name="share" :size="13"/> 分享成果</button>')
    && w.includes('placeholder="检索论证节点..."')
    && !w.includes('＋ 新建论证卡</button>') && !w.includes('导入数据包</button>')
    && !w.includes("batchMode ? '完成批量' : '批量'");
});
check('R122-4（V3.9.8 随迁）状态快捷筛选语义保留：hot 仍以 callCount ≥ 3 判定；旧资源网格列数控件与工具栏 quick-filter 已随四视图退役，现役筛选分别落在资源池控制行与画布检索', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const u = read('/newtab/composables/useResourceView.ts');
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !w.includes('<ColsPicker') && !w.includes('class="toolbar-select quick-filter"')
    && u.includes('hot: (r) => (r.callCount || 0) >= 3')
    && u.includes("hot: '高频调用 🔥'")
    && u.includes("FILTER_KEYS = ['all', 'url', 'file', 'obsidian', 'hasLink', 'brokenPath', 'hasAssets', 'starred', 'hot']")
    && pool.includes(':filters="poolFilters"')
    && pool.includes('const poolFilters = computed(() => [')
    && pool.includes('search-ph="快速过滤标题 / 标签..."')
    && w.includes('placeholder="检索论证节点..."');
});
check('R122-5 hot 筛档（Q6 口径）：FILTER_KEYS 含 hot + 谓词 callCount ≥ 3 + 标签四处同步', () => { const u = read('/newtab/composables/useResourceView.ts'); return u.includes("'starred', 'hot']") && u.includes('hot: (r) => (r.callCount || 0) >= 3') && u.includes("hot: '高频调用 🔥'"); });
check('R122-6（V3.9.8 随迁）分组计数语义保留：ResourceGroup.total 仍按分类家族合计，groupChildCount 仍统计子分类数；旧资源台分组头（head-sort / gi===0）随四视图退役', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const u = read('/newtab/composables/useResourceView.ts');
  return u.includes('total: number')
    && u.includes('count: direct.length, total, items: direct, depth')
    && u.includes('const total = Array.from(catIdx.value.family(catId))')
    && u.includes('function groupChildCount(key: string): number')
    && !w.includes('直属 {{ g.count }}') && !w.includes('class="head-sort"')
    && !w.includes('v-if="gi === 0"');
});
check('R122-7（V3.9.8 随迁）资源卡骨架迁到资源池：网格有 pcp-card / pcp-top / pcp-title / pcp-foot，列表有 pcp-row；旧 Workspace 的 rc-head / rc-type-icon / rc-title / rc-desc / rc-extra / rc-footer 与断链整卡替换已退役', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes('class="pcp-card"') && pool.includes('class="pcp-top"')
    && pool.includes('class="pcp-title"') && pool.includes('class="pcp-foot"')
    && pool.includes('class="pcp-row"')
    && !w.includes('class="rc-head"') && !w.includes('class="rc-type-icon"')
    && !w.includes('class="rc-title"') && !w.includes('class="rc-desc"')
    && !w.includes('class="rc-extra"') && !w.includes('class="rc-footer"')
    && !w.includes("'warning-broken': isBrokenPath(r)");
});
check('R122-8（V3.9.8 随迁）资源池动作收敛：列表与网格均以 CardAiEntry 开头，星标、镜像、置顶、删除在卡面可直接触达，右键复用 openCtx；旧 Workspace 的 move / fix / more / mount 卡面动作零残留', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const listStart = pool.indexOf('<span class="pcp-r-acts">', pool.indexOf('<div v-for="r in rendered"'))
  const list = pool.slice(listStart, pool.indexOf('</span>', pool.indexOf('</button>', pool.indexOf('removeCard(r)', listStart))));
  const grid = pool.slice(pool.indexOf('<div class="pcp-top">'), pool.indexOf('<div class="pcp-foot">'));
  return list.includes('<CardAiEntry v-if="!batchMode" :card="r" />')
    && list.indexOf('toggleStar(r)') > list.indexOf('<CardAiEntry')
    && list.indexOf('openMirror(r)') > list.indexOf('toggleStar(r)')
    && list.indexOf('togglePin(r)') > list.indexOf('openMirror(r)')
    && list.indexOf('removeCard(r)') > list.indexOf('togglePin(r)')
    && grid.includes('<CardAiEntry :card="r" />')
    && grid.indexOf('toggleStar(r)') > grid.indexOf('<CardAiEntry')
    && grid.indexOf('openMirror(r)') > grid.indexOf('toggleStar(r)')
    && grid.indexOf('togglePin(r)') > grid.indexOf('openMirror(r)')
    && grid.indexOf('removeCard(r)') > grid.indexOf('togglePin(r)')
    && pool.includes('@contextmenu="openCtx($event, r)"')
    && !w.includes('class="res-card-actions"') && !w.includes('class="rc-action move"')
    && !w.includes('class="rc-action fix"') && !w.includes('class="rc-action more"')
    && !w.includes('rc-action mount');
});
// V3.7.0（R179）随迁重写：hub 门控随资源台退役——论点横幅无门控常驻（全台唯一一处），空态/有论点两态保留。
check('R122-9（V3.9.8 随迁备案）论点横幅：无 isHub 门控、全页唯一一处；同一横幅承载已设/未设两态，整卡可点且支持键盘打开论点详情或创建', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  return w.includes('class="thesis-banner" :class="{ empty: !thesisCard }" role="button" tabindex="0"')
    && w.includes('＋ 点击确立本策展台的 L1 中心论点')
    && w.includes('class="tb-title"') && w.includes('class="tb-open"')
    && w.includes('@click="thesisCard ? openThesisCard() : openThesisCreate()"')
    && w.includes('@keydown.enter.prevent="thesisCard ? openThesisCard() : openThesisCreate()"')
    && (w.match(/<div class="thesis-banner"/g) || []).length === 1
    && !w.includes('!isHub');
});
check('R122-10（V3.9.8 随迁）现役样式就位：双指标盒 + 资源池动作区 + 论点横幅 + 画布节点（令牌化）；旧 quick-filter/head-sort/rc-footer/rc-tag-chip 零回流', () => { const c = read('/newtab/views/workspace.css'); const cc = read('/newtab/components/curation/curation.css'); const pool = read('/newtab/components/compass/PoolCardsPanel.vue'); return c.includes('.metric-box') && c.includes('.mbox-sub') && c.includes('.thesis-banner') && pool.includes('.pcp-r-acts {') && cc.includes('.mind-node {') && !c.includes('.quick-filter') && !c.includes('.head-sort') && !c.includes('.rc-footer') && !c.includes('.rc-tag-chip'); });

// ============== R123 · V2.91.0：四台 UI 精修（原型对齐） ==============
console.log('【R123 · V2.91.0：设计系统对齐 + 资源台卡片精修 + 策展台成果化】');
check('R123-1 字体栈按原型完全采纳（系统字体优先 + Hiragino）+ 全局 tnum', () => { const t = read('/shared/styles/tokens.css'); return t.includes('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "PingFang SC",') && t.includes('"Hiragino Sans GB"') && t.includes('font-feature-settings: "tnum";') && !t.includes('letter-spacing: -0.011em'); });
check('R123-2（R155 令牌化备案；R171 重指：tab active 文字随 --accent-ink 令牌，淡底深字对比度 ≥4.5）顶栏 48px + tab active 填充块（accent-light + accent-ink 600，下划线退役）', () => { const a = read('/newtab/App.vue'); return a.includes('.topbar { position: sticky; top: 0; z-index: var(--z-sticky); height: 48px;') && a.includes('.tab.active { color: var(--accent-ink); background: var(--accent-light); font-weight: 600; }') && !a.includes('.tab.active::after'); });
check('R123-3（R125 重指 · ★R3-B1 随宿主改靶）容器 1440 + 36px：ws-page / align-page(0 36px) / 四页页边距（方向台侧由 CompassShell 换成方向树 .compass-layout）★R175 重指带备案：调度台 .page 随原型改 18px 顶距/72px 收尾', () => { const c = read('/newtab/views/workspace.css'); const app = read('/newtab/App.vue'); const h = read('/newtab/views/CompassHome.vue'); const ct = CT_ALL; const pc = read('/newtab/views/ProjectCuration.vue'); return c.includes('.ws-page { min-height: 100vh; background: var(--bg); max-width: 1440px; margin: 0 auto; }') && app.includes('.topbar-inner.align-page { max-width: 1440px; margin: 0 auto; padding: 0 36px; }') && h.includes('padding: 18px 36px 72px') && ct.includes('max-width: 1440px') && ct.includes('padding: 20px 36px 64px') && pc.includes('padding: 20px 36px 64px'); });
check('R123-4（V3.9.13 重指）指标与操作单行工具条（sticky 保留）+ 布局切换段控件 active 强调', () => { const c = read('/newtab/views/workspace.css'); const cc = read('/newtab/components/curation/curation.css'); return c.includes('.ws-toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 8px; margin-top: 8px;') && c.includes('.cur-metrics {') && cc.includes('.mindmap-layout button') && cc.includes('.mindmap-layout button.on'); });
check('R123-5（V3.9.8 随迁）资源池卡片尺寸：12×14 内边距 / 富卡 min 94px / 网格 12px / hover 上浮；画布节点自有边界与 hover 反馈', () => { const cc = read('/newtab/components/curation/curation.css'); const pool = read('/newtab/components/compass/PoolCardsPanel.vue'); return pool.includes('.pcp-grid { display: grid;') && pool.includes('gap: 12px; }') && pool.includes('padding: 12px 14px;') && pool.includes('min-height: 94px;') && pool.includes('transform: translateY(-1px); box-shadow: var(--shadow-sm);') && cc.includes('.mind-node:hover { border-color: var(--border-strong); box-shadow: var(--shadow); }'); });
check('R123-6（V3.9.8 随迁）资源池卡面动作：列表/网格均给 AI、置顶、镜像、删除；镜像态有常驻徽标，入口统一打开共享 ResourceMirrorModal；旧 Workspace 移动/断链/更多动作与镜像虚线卡零残留', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return (pool.match(/<CardAiEntry/g) || []).length === 3
    && (pool.match(/togglePin\(r\)/g) || []).length >= 3
    && (pool.match(/openMirror\(r\)/g) || []).length >= 3
    && (pool.match(/removeCard\(r\)/g) || []).length >= 3
    && pool.includes('class="pcp-mirror-badge"')
    && pool.includes('<ResourceMirrorModal :open="mirrorOpen"')
    && !w.includes('class="rc-action move" title="移动分类"')
    && !w.includes('class="rc-action fix"') && !w.includes('class="rc-action more"')
    && !w.includes("'mirror-card': isMirrorView(r)");
});
check('R123-7（V3.9.8 随迁）旧侧栏卡片盒退役：页面不再渲染 210px 分类侧栏，兼容偏好仍保留；画布占满宿主宽度', () => { const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8')); const u = read('/newtab/composables/useCatSidebar.ts'); const cc = read('/newtab/components/curation/curation.css'); return !host.includes('class="ws-sidebar"') && u.includes('const SIDE_W_DEF = 210') && cc.includes('.mindmap-shell {') && cc.includes('width: 100%;'); });
check('R123-8（V3.9.10 重指）策展台：论点大横幅（tb-badge/tb-open）+ 工具条内两格读数 + 论证深度计算退役', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('class="tb-badge"') && w.includes('class="tb-open"') && w.includes('class="cur-metrics" data-curation-metrics="2"') && !w.includes('const pyramidDepth = computed('); });
check('R123-9（V3.9.8 随迁）资源池分组白盒 + 镜像徽标：列表分组用 pcp-group-sec / pcp-group-h，镜像态用 pcp-mirror-badge；旧 group-box / rc-type-chip 宿主零残留', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes('class="pcp-group-sec"') && pool.includes('class="pcp-group-h"')
    && pool.includes('class="pcp-mirror-badge"')
    && pool.includes('.pcp-group-sec {') && pool.includes('.pcp-group-h {')
    && pool.includes('.pcp-mirror-badge {')
    && !w.includes("'group-box': viewMode === 'card' && g.depth === 0")
    && !w.includes('class="rc-type-chip"') && !w.includes('function linkLabel(');
});
check('R123-10（V3.9.8 随迁）画布成果态：节点卡片浅底 + 选中/拖拽/搜索命中反馈；镜像证据仍由资源 chip 的来源点与徽标区分；页头标题 16px 仅存于工作台/项目详情', () => { const cc = read('/newtab/components/curation/curation.css'); const n = read('/newtab/components/curation/CurationMindNode.vue'); const ct = codeOnly(CT_ALL); const pc = read('/newtab/views/ProjectCuration.vue'); const u = 'font-size: 16px; letter-spacing: .2px;'; return cc.includes('.mind-node {') && cc.includes('.mind-node.selected') && cc.includes('.mind-node.drop-target') && n.includes('mind-resource-dot') && !ct.includes(u) && pc.includes(u); });

// ============== R124 · V2.92.0：暗色质感专项（Elevation / 色彩纪律 / 排印 / 四台精修） ==============
console.log('【R124 · V2.92.0：四主题视觉升级（新 Elevation + 唯一紫 accent + 中性退色）】');
check('R124-1（R156 差异化改写）暗色 Elevation 分层：linear 保持 #0D0E11/#14161B/#1A1D24/#1C1F26（各 1 处）；raycast 独立纯黑阶 #08080A/#101014/#16161B/#1B1B21', () => { const t = read('/shared/styles/tokens.css'); const f = (v) => (t.split(v).length - 1); return f('--bg: #0D0E11;') === 1 && f('--surface: #14161B;') === 1 && f('--surface-2: #1A1D24;') === 1 && f('--surface-3: #1C1F26;') === 1 && f('--bg: #08080A;') === 1 && f('--surface: #101014;') === 1 && f('--surface-2: #16161B;') === 1 && f('--surface-3: #1B1B21;') === 1; });
check('R124-2（R156 差异化改写）发丝线 + 文本四档按主题分开：linear .08/.92（遗产）· raycast .12/.95（高对比）· apple 纯黑基色 + rgba(0,0,0,.09) · notion 暖褐黑基色 + rgba(40,34,24,.11)', () => { const t = read('/shared/styles/tokens.css'); return t.includes('--border: rgba(255, 255, 255, 0.08);') && t.includes('--border: rgba(255, 255, 255, 0.12);') && t.includes('--text: rgba(255, 255, 255, 0.92);') && t.includes('--text: rgba(255, 255, 255, 0.95);') && t.includes('--border: rgba(0, 0, 0, 0.09);') && t.includes('--text: rgba(0, 0, 0, 0.90);') && t.includes('--border: rgba(40, 34, 24, 0.11);') && t.includes('--text: rgba(35, 31, 25, 0.90);'); });
check('R124-3（R156 解禁改写）accent 四主题各自独立：tokens.css 与 overlay 映射各 1 处且四值互不相同；已退役旧色（珊瑚红/旧蓝）零残留', () => { const t = read('/shared/styles/tokens.css'); const o = read('/content/overlay-impl.ts'); const vals = ['#5E6AD2', '#1E6FD9', '#8452E0', '#9E3FAF']; return new Set(vals).size === 4 && vals.every(function (v) { return (t.split('--accent: ' + v + ';').length - 1) === 1 && (o.split("accent: '" + v + "'").length - 1) === 1; }) && !t.includes('#FF6363') && !t.includes('#0071E3') && !t.includes('#2383E2'); });
check('R124-4 圆角与排印参数：--radius-xs 4px + 全局标签 4px/2px6px/呼吸字距 + --tracking-sm', () => { const t = read('/shared/styles/tokens.css'); return t.includes('--radius-xs: 4px;') && t.includes('--tracking-sm: 0.04em;') && t.includes('border-radius: 4px;\n  padding: 2px 6px;') && t.includes('letter-spacing: var(--tracking-sm);'); });
check('R124-5 焦点环柔化：:focus-visible 与 --shadow-focus 均 40%（★G4(V3.8.27) 重指：字面量抽成 --focus-ring 令牌，40% 语义不变、四主题随 --accent 解析）', () => { const t = read('/shared/styles/tokens.css'); return t.includes('--focus-ring: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);') && t.includes('outline: var(--focus-ring) !important;') && (t.split('--shadow-focus: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);').length - 1) === 4; });
check('R124-6（V3.9.1 重指）调度台工作单焦点：主工作区强描边 + shadow-lg，悬停用浅底而不是位移动画，行内焦点环清晰可见', () => { const ch = read('/newtab/views/CompassHome.vue'); return ch.includes('.work-board { border-color: var(--border-strong); box-shadow: var(--shadow-lg); }') && ch.includes('.focus-row:hover { background: var(--surface-2); }') && ch.includes('.focus-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }'); });
check('R124-7 调度台：任务树按钮文案', () => { const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return !h.includes('展开关联任务树') && pc.includes('removeMetric');  });
check('R124-8 方向台：中性退色（prTag plain / 短文案 / 灰点 hover 显 + 展板紫调光带）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes("return pr === 'high' ? 'danger' : 'plain'") && pc.includes("'高优' : pr === 'mid' || pr === 'medium' ? '中优' : '低优'") && pc.includes('.tag.plain .tag-dot') && pc.includes('.btask:hover .tag.plain .tag-txt { display: inline; }') && pc.includes('.page.is-embedded { background-color: var(--surface);'); });
check('R124-9（V3.9.8 随迁）资源池富卡：网格卡最小高度 94px，标题与说明按内容收敛；旧 120–160 锁高与单行截断均退役', () => { const pool = read('/newtab/components/compass/PoolCardsPanel.vue'); return pool.includes('min-height: 94px;') && !pool.includes('max-height: 160px;') && !pool.includes('-webkit-line-clamp: 1;'); });
check('R124-10（V3.9.9 随迁备案）策展台空态：旧虚线金字塔骨架与“去金字塔挂载”随四视图退役；无论点用 EmptyState 主行动，有论点无分支改为键盘提示，不再提供建支按钮', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  return !host.includes('cur-empty-skeleton') && !host.includes('L2 论据分支 A')
    && m.includes('<EmptyState v-if="!thesis" icon="compass"')
    && m.includes('action-label="＋ 写下中心论点"')
    && m.includes("emit('open-create-thesis')")
    && m.includes('<EmptyState v-if="thesis && !nodes.length" size="inline" icon="hexagon"')
    && !m.includes('action-label="＋ 新建论据分支"')
    && m.includes('hint="选中中心论点后按 Tab，创建第一个二级分支。"')
    && m.includes("emit('create-child', 'root')");
});

// ============== R125 · V2.93.0：骨架留白（1440+36）/ 主色残遗清理 / 微阴影阶梯 / 四台校准 ==============
console.log('【R125 · V2.93.0：视觉收尾（留白骨架 + 唯一紫 + 微阴影 + 侧栏图标轨）】');
check('R125-1 骨架 1440+36：四页页边距 + compass-layout + ws-content(20 36 90) + fullscreen ★R175/R3-B1 重指带备案：调度台 18px/72px，方向台侧 padding 落在方向树 .compass-layout（CompassShell 已退役）', () => { const c = read('/newtab/views/workspace.css'); const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); const ct = CT_ALL; return h.includes('padding: 18px 36px 72px;') && pc.includes('padding: 20px 36px 64px;') && ct.includes('padding: 20px 36px 64px;') && ct.includes('.compass-layout { display: block;') && c.includes('padding: 20px 36px 90px'); });
check('R125-2（R156 差异化改写）主题色点随各自 accent：App.vue 无 #FF6363 / #0071E3 / #2383E2 残留；五个选项（含 auto 渐变）色点与四主题 accent 一一对应（原「dot 全 #5E6AD2」已随解禁退役）', () => { const a = read('/newtab/App.vue'); return a.includes("dot: '#5E6AD2'") && a.includes("dot: '#1E6FD9'") && a.includes("dot: '#8452E0'") && a.includes("dot: '#9E3FAF'") && (a.split("id: 'auto'").length - 1) === 1 && !a.includes('#FF6363') && !a.includes('#0071E3') && !a.includes('#2383E2'); });
check('R125-3 链接并入紫：--info-blue 全链路置紫 + 组件层零 var(--info-blue) 残留 + overlay --zy-link 紫', () => { const t = read('/shared/styles/tokens.css'); const o = read('/content/overlay-impl.ts'); const files = [read('/newtab/components/compass/CuriosityPanel.vue'), read('/newtab/components/GlobalPopups.vue'), CT_ALL, read('/newtab/views/GlobalSettings.vue'), read('/newtab/views/ProjectCuration.vue'), read('/newtab/views/workspace.css')]; const leftover = files.reduce((s, x) => s + (x.split('var(--info-blue)').length - 1), 0); return t.includes('--info-blue: #5E6AD2;') && o.includes('--zy-link:#5E6AD2;') && leftover === 0; });
check('R125-4（V3.9.1 重指 · V3.9.8 随迁）微阴影阶梯：浅色 shadow-sm 二层不变，首页工作单与手边卡接入 shadow-sm，主工作区单独用 shadow-lg；策展指标盒与画布节点共用 shadow-sm', () => { const t = read('/shared/styles/tokens.css'); const ch = read('/newtab/views/CompassHome.vue'); const c = read('/newtab/views/workspace.css'); const cc = read('/newtab/components/curation/curation.css'); return (t.split('--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);').length - 1) === 2 && ch.includes('.work-board,\n.hand-board {') && ch.includes('box-shadow: var(--shadow-sm);') && ch.includes('.work-board { border-color: var(--border-strong); box-shadow: var(--shadow-lg); }') && c.includes('.metric-box { background: var(--surface);') && c.includes('box-shadow: var(--shadow-sm);') && cc.includes('box-shadow: var(--shadow-sm);'); });
check('R125-5 合流条锁 38px（原 34~40px）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('min-height: 38px; max-height: 38px;'); });
check('R125-6（V3.9.1 重指）计划行交互态：悬停浅底、焦点 accent 实环、完成态降透明并划掉标题；旧选中卡选择器零残留', () => { const ch = read('/newtab/views/CompassHome.vue'); return ch.includes('.focus-row:hover { background: var(--surface-2); }') && ch.includes('.focus-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }') && ch.includes('.focus-row.done { opacity: .65; }') && ch.includes('.focus-row.done .title-text { text-decoration: line-through; color: var(--text-3); }') && !ch.includes('.today-card.sel'); });
check('R125-7（V3.9.8 随迁）侧栏 36px 图标轨已随旧分类侧栏退役：保留 UIPrefs.wsSideRail 与 retained composable 兼容，但 Workspace 不渲染侧栏或图标轨', () => {
  const m = read('/shared/models/index.ts');
  const u = read('/newtab/composables/useCatSidebar.ts');
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  return m.includes('wsSideRail?: boolean')
    && u.includes('const sideRail = ref<boolean>(!!store.ui?.wsSideRail)')
    && u.includes('function toggleSideRail()')
    && u.includes('function selectRailCat(')
    && !w.includes(':class="{ rail: sideRail }"')
    && !w.includes('class="cat-rail-btn"')
    && !w.includes('class="ws-sidebar"');
});
check('R125-8 警示纪律：方向台无 tag warn/ok 残留（仅高优 danger / 断链 warning / 停滞 stagnant）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return !pc.includes('class="tag warn"') && !pc.includes('class="tag ok"'); });

// ============== R126 · V2.94.0：七项体验修复（isThesis 泄漏 / 论点横幅常驻 / 展板框线 / 关联过滤 / 阈值设置 / 全景交互 / 标签两级路径） ==============
console.log('【R126 · V2.94.0：体验修复与还原】');
check('R126-1 ★ isThesis 泄漏修复：emptyResource 显式 isThesis:false（杜绝「确立论点」标记泄漏覆盖 L1）', () => { const d = read('/newtab/composables/useResourceDrawer.ts'); return d.includes('pinned: false, isThesis: false, callCount: 0'); });
check('R126-2（V3.9.10 随迁备案）论点横幅常驻：页头之后 / 单行工具条之前，全页唯一一处；旧 cur3 三格随“论证深度”退役', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const iHead = w.indexOf('class="ws-id-head"');
  const iBanner = w.indexOf('<div class="thesis-banner"');
  const iMetrics = w.indexOf('class="cur-metrics" data-curation-metrics="2"');
  return iHead > 0 && iBanner > iHead && iMetrics > iBanner
    && (w.match(/<div class="thesis-banner"/g) || []).length === 1
    && !w.includes('ws-metrics cur3')
    && !w.includes('<!-- R123（C2/原型）：论点大气横幅');
});
// V3.7.0（R179）退役：资源台页头设计（去图标 / 对齐 116/116/116）随资源台退役——本断言转守页头单形态。
check('R126-3 页头单形态（V3.7.0 退役）：图标位保留（.wsh-icon）、isHub 页头分支零残留', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('<span class="wsh-icon">') && w.includes('class="wsh-spacer"') && !w.includes('!isHub'); });
check('R126-4（V3.9.24 重指）关联资源卡弹窗：候选池固定为全部可镜像资源卡，分类筛选及其状态整体退役；关键词与 AI 检索保留', () => {
  const p = read('/newtab/composables/usePyramid.ts');
  const lm = read('/newtab/components/LinkCardsModal.vue');
  return !p.includes('linkCardsCat')
    && !p.includes('linkCatOptions')
    && !p.includes('catSel')
    && !lm.includes('lc-cat')
    && lm.includes('AI 检索')
    && lm.includes('关键词过滤');
});
check('R126-5 展板模块框线 + 内边距 22 对齐主航线 + 📦 图标 + 🚀 主攻（R139 图标定稿：🚀=主攻、🎯 只留指标；★G1(V3.8.24)随迁带备案：📦→<Icon name="package">、🚀→<Icon name="main-focus">，锚点随迁）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('padding: 14px 22px 18px;') && pc.includes('class="pb-picon" title="项目"><Icon name="package" :size="13"/>') && pc.includes('class="tag accent"><Icon name="main-focus" :size="13"/> 主攻项目') && !pc.includes('>🎯 主攻'); });
check('R126-6 ★R4-Da 退役重指带备案：原守「全景列表：单击=选中（onPanCardClick→togglePanCard）/ 双击=打开详情抽屉（panDetail）」——🗺 全景整页随资源台退役删除。这套单击/双击手势在两处存活并被逐一点名：① 设置页标签管理右列（onTtRowClick→ttTogglePick 单击选中、onTtRowDblClick→ttDetail 双击开抽屉，抽屉就挂在标签面板内=R130-T2 的位置修复）② 调度台资源卡池面板（批量态单击=选中 toggleSel / 非批量态单击=开详情抽屉 emitOpenDrawer）；全景那三个符号 codeOnly 零命中，panClickTimer 那类单击双击竞态也不得回流（★W5 随迁：openCard 形参从 { id: string } 放宽为 ResourceCard——双击开链接要读 linkType/link，手势语义不变；★G1(V3.8.24)随迁带备案：抽屉 title「🏷 卡片详情」emoji 前缀删除，锚点随迁为无前缀文本）', () => {
  const g = read('/newtab/views/GlobalSettings.vue'); const gc = codeOnly(g);
  const pcp = read('/newtab/components/compass/PoolCardsPanel.vue');
  const retired = ['function onPanCardClick', 'function onPanCardDblClick', 'panDetail.value = r', 'togglePanCard', 'panSelected'];
  return retired.every(k => !gc.includes(k)) && !g.includes('panClickTimer')
    && g.includes('function onTtRowClick(row: TtRow) { ttTogglePick(row.id) }')
    && g.includes('function onTtRowDblClick(row: TtRow) { ttDetail.value = row }')
    && g.includes('@click="onTtRowClick(row)" @dblclick="onTtRowDblClick(row)"')
&& g.includes(':open="!!ttDetail" title="卡片详情"')
    && pcp.includes('function openCard(r: ResourceCard)') && pcp.includes('if (batchMode.value) { toggleSel(r.id); return }') && pcp.includes("emitOpenDrawer({ kind: 'res', id: r.id })");
});
check('R126-7 生命周期阈值设置：全局默认可配（UIPrefs.coolingDaysDefault + 启动注入）+ 弹窗入口（★W9 退役重指带备案：弹窗宿主由 GlobalSettings 改指 ProfileInsights §3——lcSetOpen / saveLcDefault / lc-set-list 三条照搬，「全局默认可配 + 启动注入」前四条一字未动；GS 按 codeOnly 零命中负锚；★V3.9.7：弹窗呈现迁入 PiLifecycleSettingsModal，宿主保留状态与存储动作）', () => { const m = read('/shared/models/index.ts'); const lf = read('/shared/utils/lifecycle.ts'); const rp = read('/shared/storage/repository.ts'); const g = read('/newtab/views/ProfileInsights.vue'); const d = read('/newtab/components/profile/PiLifecycleSettingsModal.vue'); return m.includes('coolingDaysDefault?: number') && lf.includes('export function setCoolingDefaultDays') && lf.includes('export function coolingDefaultDaysOf') && rp.includes('setCoolingDefaultDays(uiCache.coolingDaysDefault ?? 30)') && g.includes('lcSetOpen = ref(false)') && g.includes('saveLcDefault') && d.includes('class="card-list"') && !codeOnly(read('/newtab/views/GlobalSettings.vue')).includes('lcSetOpen'); });
check('R126-8 标签最多两级：拖拽根→根 + 子标签提升为根（⇪）+ 三级新建入口退役', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('最多两级：只能挂到根标签下') && g.includes('function ttUnnest(rootId: string, childId: string)') && g.includes('title="提升为根标签"') && !g.includes('添加第三级标签') && g.includes('两级标签体系'); });
check('R126-9 标签「父/子」路径同步：归一工具 + 启动迁移 + 重命名/删除/挂载级联 + 选择器/搜索路径口径', () => { const t = read('/shared/utils/tags.ts'); const a = read('/newtab/stores/app.ts'); const g = read('/newtab/views/GlobalSettings.vue'); const tp = read('/shared/components/TagPicker.vue'); const u = read('/newtab/composables/useResourceView.ts'); return t.includes('export function normalizeCardTagPaths') && t.includes('export function flattenTagTree') && a.includes('normalizeCardTagPaths(data.value)') && g.includes("const oldPath = parentName ? parentName + '/' + oldName : oldName") && g.includes('killPaths') && g.includes("const newPath = to.node.name + '/' + from.node.name") && tp.includes('function valOf(t: FlatTag)') && u.includes("c.split('/').pop() === t"); });
check('R126-10 标签收纳：从卡片收纳标签入口（三卡扫描入树）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('function ttCollectFromCards()') && g.includes('⤓ 从卡片收纳标签'); });
check('R126-11（V3.9.8 随迁）画布工具条不挤压：窄屏时 mindmap-bar 换行，选中态与动作各自不折字；旧侧栏 cat-toolbar 宿主零残留', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const c = read('/newtab/components/curation/curation.css');
  return !w.includes('@click="collapseAllCats">⊟</span>')
    && !w.includes('class="cat-toolbar"')
    && c.includes('.mindmap-bar {') && c.includes('flex-wrap: wrap;')
    && c.includes('.mindmap-selection span { white-space: nowrap; }')
    && c.includes('.mindmap-layout button {')
    && c.includes('.mindmap-action {');
});

// ============== R127 · V2.95.0：七项体验升级（标签双栏 / 展板 CSS 修复 / 金字塔铺满 / 任务调度默认 / WCE 口径 / 手册） ==============
console.log('【R127 · V2.95.0：体验升级】');
check('R127-1 任务调度 ★W6 重指带备案（承 R176/R3-Cc2）：默认视图 card→list（W6 用户拍板——卡片视图 AI 入口改右上角角标直跑补全，默认回列表；沉底/分组三档不变）+ 已完成自动沉底 + 分组三档值域进 TASK_GROUPS（列表视图才出现）★G1(V3.8.24)随迁带备案：TASK_GROUPS 三项 label 的 emoji 前缀（📂⏱📌）删除，锚点随迁为纯文本', () => { const tm = read('/newtab/components/compass/TaskManagerPanel.vue'); return tm.includes("ref<'card' | 'list' | 'kanban'>('list')") && tm.includes('已完成任务自动沉底') && tm.includes("const groupMode = ref<TaskGroupMode>") && tm.includes("type TaskGroupMode = 'project' | 'status' | 'pin'") && tm.includes('const listGroups = computed') && tm.includes("{ id: 'project', label: '按项目分组' }") && tm.includes("{ id: 'status', label: '按任务状态分组' }") && tm.includes("{ id: 'pin', label: '按置顶与否分组' }") && tm.includes("viewMode === 'list' ? TASK_GROUPS : []"); });
check('R127-2 WCE 新口径：好奇卡「创建+状态变更+删除」事件流水（三档周期）+ 旧转化口径退役 + 挂载刷新', () => { const st = read('/newtab/stores/compass.ts'); const ch = read('/newtab/views/CompassHome.vue'); const mb = read('/newtab/components/compass/MetricBar.vue'); return st.includes("import { readEventLog, curioCumulativeSince, countCurioCumulative") && st.includes('const wceSince =') && st.includes('countCurioCumulative(wceEvents.value, wceSince)') && st.includes('async function refreshWce()') && st.includes('refreshWce,') && ch.includes('refreshWce?.()') && mb.includes('创建 + 状态变更 + 删除'); });
check('R127-3 标签管理双栏：左树选中（active 高亮）+ 右列卡片（三卡/类型过滤/搜索/单击选中/双击详情/多选拖拽替换移动）★G1(V3.8.24)随迁带备案：资源卡 option 📦 前缀迁 <Icon name="package">，锚点随迁。★V3.8.25（B1-a）二次重指带备案：那枚 Icon 从来没有渲染过——`<option>` 的内容模型是纯文本，浏览器会丢弃其中的子元素，所以 G1 把 📦 换成 <Icon> 之后，三张卡型选项反而比原来少了一个标识。故三个 option 内的 Icon 全部移除、只留文字，本判据的锚点随之改认「纯文字 option」，并追加负锚钉住不许再把 Icon 塞回 option', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('class="tt-wrap"') && g.includes("const ttActiveTag = ref('')") && g.includes('const ttRows = computed<TtRow[]>') && g.includes('function ttMoveCards(targetPath: string)') && g.includes('ttCardDragIds') && g.includes('@dragstart="onTtRowDragStart($event, row)"') && g.includes('@dblclick="onTtRowDblClick(row)"') && g.includes('@click="selectTtTag(root.name)"') && g.includes("selectTtTag(root.name + '/' + child.name)") && g.includes('<option value="resource">资源卡</option>') && g.includes('<option value="task">任务卡</option>') && g.includes('<option value="curiosity">好奇心卡</option>') && !/<option[^>]*>\s*<Icon\b/.test(g) && g.includes('R127：卡片拖拽（右列 → 左树）优先：移动=替换语义'); });
check('R127-4 标签详情抽屉（三卡统一）+ 抽屉「打开链接」修复（openCardLink 独立 helper）★G1(V3.8.24)随迁带备案：抽屉 title「🏷 卡片详情」emoji 前缀删除、⛔ 前缀删除，锚点随迁（★R4-Da 退役重指带备案：原判据第二锚点 @click="openCardLink(panDetail)" 指的是全景抽屉那一行，随 🗺 整页退役删除——同一条"打开链接"接线今天就在标签管理抽屉的 footer 上，判据改认它仍存在的真实写法 @click="openCardLink({ link: ttDetail.link })"，并继续点名 helper 本体（zy-asset 附件 → openHtmlAsset、其余走 toOpenableUrl + openExternalLink，失败给 toast）与 R130-T2 的抽屉挂载位置；全景写法按 codeOnly 零命中防回流', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('function openCardLink(') && g.includes('@click="openCardLink({ link: ttDetail.link })"') && g.includes(':open="!!ttDetail" title="卡片详情"') && g.includes('openExternalLink(url)') && g.includes("showToast('该卡片无可打开链接')") && !codeOnly(g).includes('@click="openCardLink(panDetail)"'); });
/* ★R181 随迁带备案：ProjectCuration 的样式整体外提到 ProjectCuration.css（宿主用 `<style scoped src>` 引用），
   规则不再落在宿主 `<style>` 块里，故判据改钉"宿主确有 scoped src 引用 + 该 CSS 里确有这条追加规则 + 宿主以 </style> 收尾"，
   与"追加样式已并入组件的样式体系、文件尾无游离 CSS"的原意一字未改。 */
check('R127-5 展板 CSS 生效修复：ProjectCuration 追加样式已并入组件的样式体系（外提 css + scoped src 引用；文件尾无游离 CSS）', () => { const host = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'newtab', 'views', 'ProjectCuration.vue'), 'utf8'); const css = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'newtab', 'views', 'ProjectCuration.css'), 'utf8'); return host.includes('<style scoped src="./ProjectCuration.css"></style>') && css.includes('.page.is-embedded { background-color: var(--surface);') && host.trimEnd().endsWith('</style>'); });
check('R127-6（V3.9.14 重指）画布自适应：旧 CSS Grid 列模板与 py-board 限宽随四视图退役；现役 .mindmap-canvas 为无宽度上限的横向滚动域，相对定位的 .mind-stage 以 max-content 承载内容与 SVG 连线，并以 min-width:100% 撑满可用宽度', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const c = read('/newtab/components/curation/curation.css');
  return !w.includes('repeat(${pyLayout.cols}, minmax(170px, 1fr))')
    && c.includes('.mindmap-canvas {') && c.includes('overflow: auto;')
    && !/\.mindmap-canvas \{[^}]*max-width:/.test(c)
    && c.includes('.mind-stage { position: relative; width: max-content; min-width: 100%;')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-stage { display: block; width: max-content; min-width: 100%; margin: 0 auto; }');
});
check('R127-7 手册同步：任务调度默认视图/三档分组 + WCE 新口径 + 标签双栏说明（★W6 再随迁：默认档改回「列表」——卡片视图 AI 入口重构，手册同步为「默认列表视图」；沉底与分组三档不变）', () => { const m = read('/newtab/manual-data.ts'); return m.includes('默认列表视图 + 已完成任务自动沉底 + 分组三档') && m.includes('好奇卡「创建 + 状态变更 + 删除」的事件数') && m.includes('R127 起为双栏'); });
// V3.7.0（R179）退役：资源台页头对齐实测（116/116/116）随资源台退役——页头单形态判据并入 R126-3。
check('R127-8 页头单形态（V3.7.0 退役）：资源台页头设计与对齐实测随退役下线；.wsh-icon 图标位保留', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('<span class="wsh-icon">') && !w.includes('<span v-if="!isHub" class="wsh-icon">'); });

// ============== R128 · V2.96.0：P0 数据安全批次（跨上下文合并下沉 / 迁移可重试 / 永久删除口径 / 浮层注入收口） ==============
console.log('【R128 · V2.96.0：P0 数据安全】');
check('R128-1 A1 合并下沉：repository 导出 attachStorageSync 且在 loadData 内自动注册（幂等 syncAttached 守卫）', () => { const r = read('/shared/storage/repository.ts'); return r.includes('let syncAttached = false') && r.includes('export function attachStorageSync(): void') && r.includes('if (syncAttached) return') && (r.match(/attachStorageSync\(\)/g) || []).length >= 2; });
/* ★R175 重指带备案：原锚点钉的是「只要不是自己写的就合并」的单条件判据。
   单条件在 R175 之后**不够**——整树回写的外部上下文会复制走上一枚 `__wid`，
   于是外部那处改动被当成自己的回声静默丢弃（症状：数据写进库了但界面不更新，随机 flaky）。
   现行判据是**两道闸合看**：「像自己的写入」且「写的人换了戳」才是真回声。
   判据意图（非本页写入 → mergeExternalData → 通知订阅者，弹窗/浮层同样受保护）一字未松，
   反而收紧了一档：原先会把外部改动误当回声丢掉，现在不会了。 */
check('R128-2 A1 数据键消费：非本页写入 → mergeExternalData → 通知订阅者（弹窗/浮层同样受保护；★R175 重指：真回声 = isSelfWrite 且非写戳复用）', () => { const r = read('/shared/storage/repository.ts'); const i = r.indexOf('export function attachStorageSync'); const seg = r.slice(i, i + 1600); return seg.includes('changes[STORAGE_KEY]') && seg.includes('isSelfWrite(ext) && !isStampReused(dch)') && seg.includes('mergeExternalData(ext)') && seg.includes('listeners.forEach((fn) => fn(cache!))'); });
check('R128-3 A1 UI 偏好逐键合并：uiSelfWritten 记账 + mergeExternalUIPrefs（A 改主题不再被 B 改列数回退）', () => { const r = read('/shared/storage/repository.ts'); return r.includes('const uiSelfWritten = new Map<string, string>()') && r.includes('function mergeExternalUIPrefs') && r.includes("if (uch) mergeExternalUIPrefs(uch.newValue as UIPrefs | undefined)") && r.includes('uiSelfWritten.set(k'); });
check('R128-4 A1 单一接线点：newtab store 不再自挂 onChanged（避免同一外部写入被两处各合并一次）', () => { const a = read('/newtab/stores/app.ts'); return !a.includes('chrome.storage.onChanged.addListener') && a.includes('subscribe((d) => {') && !a.includes('mergeExternalData'); });
check('R128-5 A1 content 走仓库链路：saveData→repoSaveNow（共享 flushCardEvents 与 JSON 纯净清洗）+ 订阅刷新缓存', () => { const o = read('/content/overlay-impl.ts'); return o.includes('saveDataNow as repoSaveNow') && o.includes('await repoSaveNow()') && o.includes('invalidateCountCache()') && !o.includes('async function saveData(d: any) {'); });
check('R128-6 A2 迁移落戳顺序：migrateHubMerge 的 hubMergedAt 在两个 guard 之后（资源台缺失/归档可下次重试，不再永久跳过）', () => { const m = read('/shared/storage/curationMigration.ts'); const i = m.indexOf('export function migrateHubMerge'); const seg = m.slice(i, i + 3000); const iStamp = seg.lastIndexOf('d.hubMergedAt = Date.now()'); const iHubGuard = seg.indexOf('if (!hub) return false'); const iBoardGuard = seg.indexOf('if (!boards.length)'); return iStamp > 0 && iHubGuard > 0 && iStamp > iHubGuard && iStamp > iBoardGuard && seg.includes('if (d.hubMergedAt) return false'); });
check('R128-7 A2 备份判据：hubMergeWorkPending 导出并被 app.ts 使用（无事可做/资源台归档时不再每次启动下载备份）', () => { const m = read('/shared/storage/curationMigration.ts'); const a = read('/newtab/stores/app.ts'); return m.includes('export function hubMergeWorkPending(d: AppData): boolean') && m.includes('if (d.hubMergedAt) return false') && a.includes('hubMergeWorkPending'); });
check('R128-8 A2 现役镜像保命：migrateHubStructure 只清旧方向投射（kind=card 且 targetWsId≠资源台保留）', () => { const m = read('/shared/storage/curationMigration.ts'); const i = m.indexOf('export function migrateHubStructure'); const seg = m.slice(i, i + 1600); return seg.includes("p.kind === 'card' && p.targetWsId !== CURATION_WS_ID") && !seg.includes('d.curationProjections = []'); });
console.log('【R128 · A3：永久删除口径合一 + 转卡共享附件保命】');
check('R128-9 ★ A3 硬删引擎 shared/storage/purge.ts：四类副作用一处收口（附件本体 / metric.taskIds / 数组移除 / 悬空投射剪枝）', () => { const p = read('/shared/storage/purge.ts'); return p.includes('export async function purgeCardsCompletely') && p.includes('m.taskIds = (m.taskIds || []).filter(id => !taskIds.has(id))') && p.includes('d.resources = d.resources.filter(r => !resIds.has(r.id))') && p.includes('pruneDanglingProjections(d)') && p.includes('export function recycledCardsOf'); });
check('R128-10 ★ A3 设置页「清空回收站」不再裸 filter（改走同一引擎 + recycledCardsOf 全量口径含分类）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const i = g.indexOf('async function emptyRecycleBin'); const seg = g.slice(i, i + 900); return i >= 0 && seg.includes('recycledCardsOf(d)') && seg.includes('purgeCardsCompletely(d, targets)') && !seg.includes('.filter(r => !r.deletedAt)') && !seg.includes('(t as any).deletedAt'); });
check('R128-11 ★ A3 转卡共享本体保命：keepIds=存活卡（含回收站软删卡）assets 并集，被引用者不删', () => { const p = read('/shared/storage/purge.ts'); const i = p.indexOf('export async function purgeCardsCompletely'); const seg = p.slice(i, i + 1800); return seg.includes('if (!resIds.has(r.id))') && seg.includes('if (!taskIds.has(t.id))') && seg.includes('if (!curioIds.has(c.id))') && seg.includes('if (keep.has(id)) assetsShared++; else doomed.push(id)'); });
check('R128-12 ★ A3 卡内删附件走 deleteAssetIfOrphan（排除所在卡 selfCardId），三处宿主接入 owner-id', () => { const p = read('/shared/storage/purge.ts'); const a = read('/shared/components/AssetManager.vue'); return p.includes('export async function deleteAssetIfOrphan') && p.includes('c.id !== selfCardId') && a.includes('await dropBlob(meta.id)') && a.includes('deleteAssetIfOrphan(id, props.ownerId') && read('/newtab/components/ResourceEditForm.vue').includes(':owner-id="model.id"') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes(':owner-id="selectedTask.id"') && read('/newtab/components/compass/CuriosityPanel.vue').includes(':owner-id="detailItem.id"'); });
check('R128-13 A3 附件失效单条清理覆盖三类卡（此前只扫 resources → 任务/好奇侧引用残留死链）', () => { const w = read('/newtab/views/Workspace.vue'); const i = w.indexOf('async function onDrillCleanupAsset'); const seg = w.slice(i, i + 900); return i >= 0 && seg.includes('detachFrom(d.value.resources)') && seg.includes('detachFrom(d.value.tasks)') && seg.includes('detachFrom(d.value.curiosities)'); });
console.log('【R128 · A4：浮层注入面收口（转义 + 链接协议统一）】');
check('R128-14 ★ A4 浮层结果行无裸插值：link 文本/类型、badge、icon 全部 escapeHtml', () => { const o = read('/content/overlay-impl.ts'); return o.includes("escapeHtml(item.link.text)") && o.includes("escapeHtml(item.link.type)") && o.includes("escapeHtml(b.text)") && o.includes("escapeHtml(b.type)") && o.includes("escapeHtml(item.iconClass)") && o.includes("escapeHtml(item.iconText)") && !o.includes("' + item.link.text + '") && !o.includes("' + b.text + '"); });
check('R128-15 A4 采集面板 option value 一并转义（id 可来自导入 JSON）', () => { const o = read('/content/overlay-impl.ts'); return count('/content/overlay-impl.ts', 'value="${escapeHtml(') >= 4 && !o.includes('value="${w.id}"') && !o.includes('value="${c.id}"') && !o.includes('value="${p.id}"') && !o.includes('value="${m.id}"'); });
check('R128-16 ★ A4 浮层打开链接走 toOpenableUrl（R70-14 伪协议黑名单不再被旁路，本地 toFileUrl 重复实现退役）', () => { const o = read('/content/overlay-impl.ts'); return o.includes("import { toOpenableUrl } from '@/shared/utils/link'") && o.includes('const openable = toOpenableUrl(r.linkType, r.link)') && !o.includes("window.open(r.link, '_blank')") && !o.includes('function toFileUrl'); });
check('R128-17 A4→B5 调度面板卡内链接：伪协议拦截由 link.ts 统一承担（自建 helper 已退役）', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return !t.includes('function toOpenableLinkUrl') && t.includes("from '@/shared/utils/link'") && t.includes('toOpenableRawLink(link)') && t.includes('function openCardLink'); });

// ============== R129 · V2.97.0：批次 B｜P1 行为正确性（B1–B12） ==============
console.log('【R129 · V2.97.0：批次 B P1 行为正确性（B1–B12）】');
check('R129-1 ★ B1 keep-alive 切台空白：复位守卫改记「上次所在台」（离开时 nv=undefined 也触发，同台重返保留状态）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('let lastResetWsId = route.params.id') && w.includes("if (typeof nv !== 'string' || !nv) return") && w.includes('if (nv === lastResetWsId) return') && !w.includes('nv && ov && nv !== ov'); });
check('R129-2 ★ B2 groupKeyOf 与渲染分区 key 合一（R64-F9 单分类口径），curOrder 重写不再越界打乱兄弟子分类', () => { const dd = read('/newtab/composables/useResourceDragDrop.ts'); return dd.includes("if (isUncat(r, validIds)) return 'uncat'") && dd.includes('return r.categoryId') && !dd.includes("return 'direct'") && !dd.includes('familyIds'); });
check('R129-3 B3（V3.9.24 重指）待分类口径仍走 isUncat 宽松判据；关联资源弹窗已取消分类筛选，候选池固定为全部可镜像资源卡', () => {
  const u = read('/newtab/composables/useResourceView.ts');
  const py = read('/newtab/composables/usePyramid.ts');
  return u.includes('out = out.filter(r => isUncat(r, catIdx.value.byId))')
    && !u.includes('out = out.filter(r => !r.categoryId)')
    && py.includes('.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)')
    && !py.includes('curCatIds')
    && !py.includes('catSel');
});
check('R129-4 B4 tagUsage 路径口径（叶子/全路径双匹配）+ toast 报 swap 实际命中数（不再谎报同步 0 张）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes("const leaf = name.split('/').pop() || name") && g.includes('同步 ${synced} 张卡片') && g.includes('该标签当前无卡片挂载'); });
check('R129-5 ★ B5 用户输入链接注入面：CuriosityPanel :href 过 toOpenableRawLink（自建 helper 退役）+ 附件落盘文件名过 safeAssetId（导入 id 不能穿越下载目录）', () => { const c = read('/newtab/components/compass/CuriosityPanel.vue'); const h = read('/shared/utils/htmlAsset.ts'); return !c.includes(':href="c.sourceUrl"') && c.includes(':href="toOpenableRawLink(c.sourceUrl)"') && !c.includes('function toOpenableCurioLink') && h.includes('function safeAssetId') && h.includes('${safeAssetId(meta.id)}'); });
check('R129-6（V3.9.8 随迁）监听器/定时器泄漏归零：旧侧栏拖拽仍有卸载兜底；画布 fullscreenchange / fallback keydown 成对摘除；Workspace 搜索防抖与全局 click/visibilitychange 在卸载时清理；关联资源 AI 切换时 abort；项目详情菜单监听仍成对', () => {
  const s = read('/newtab/composables/useCatSidebar.ts');
  const u = read('/newtab/composables/useResourceView.ts');
  const map = read('/newtab/components/curation/CurationMindMap.vue');
  const py = read('/newtab/composables/usePyramid.ts');
  const ws = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const p = read('/newtab/views/ProjectCuration.vue');
  return s.includes("document.removeEventListener('mouseup', onSideResizeUp)")
    && u.includes('clearTimeout(searchDebounceTimer); searchDebounceTimer = null')
    && map.includes("document.addEventListener('fullscreenchange', onFullscreenChange)")
    && map.includes("document.removeEventListener('fullscreenchange', onFullscreenChange)")
    && map.includes("document.addEventListener('keydown', onFallbackKeydown)")
    && map.includes("document.removeEventListener('keydown', onFallbackKeydown)")
    && ws.includes('if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null }')
    && ws.includes("document.removeEventListener('click', closeSettingsMenu)")
    && ws.includes("document.removeEventListener('visibilitychange', onWsOpenVisibility)")
    && py.includes('linkAiCtl?.abort()')
    && p.includes('onDocCloseProjMenu')
    && p.includes("document.removeEventListener('click', onDocCloseProjMenu)");
});
check('R129-7 B7 今日边界零点精确翻篇定时器（30s 心跳与 todayIn/Out/Called 整库 computed 彻底解耦，setDate 口径 DST 安全）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('function midnightOf') && h.includes('function scheduleMidnightRollover') && h.includes('nextMidnight.getTime() - now.getTime()') && h.includes('clearTimeout(midnightTimer)'); });
check('R129-8 ★ B8 批量移动只落 natives 源卡真写库（此前对镜像浅拷贝写字段不落库却谎报成功）+ 待分类解析排除软删', () => { const b = read('/newtab/composables/useWorkspaceBatch.ts'); const i = b.indexOf('natives.forEach(r => { r.workspaceId'); return i >= 0 && b.slice(i, i + 120).includes('r.categoryId = catId') && b.includes("find(c => !c.deletedAt && c.workspaceId === moveWsId.value && c.name === '待分类')"); });
check('R129-9 B9 搜索收缩后键盘导航：空列表守卫（Enter 不再传 undefined）+ taskNavIndex 钳制回末尾', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return t.includes('if (!list.length) { taskNavIndex.value = -1; return }') && t.includes('if (taskNavIndex.value > list.length - 1) taskNavIndex.value = list.length - 1'); });
check('R129-10 ★ B10 周口径翻周：新周分支归零 thisWeekUsage + 读数统一走 weekUsageOf（跨周不再冒充累计）+ 周窗锚点按日期分量减（DST 安全，DAY 常量退役）· R172-T9 重指：周窗真源已并入 `reviewReport.ts`', () => { const s = read('/shared/storage/stats.ts'); const rr = read('/shared/utils/reviewReport.ts'); const m = read('/newtab/components/compass/MetricBar.vue'); return s.includes('export function weekUsageOf') && s.includes('data.stats.wrr.thisWeekUsage = 0') && s.includes('data.stats.wrr.thisWeekStart = wk') && m.includes('weekUsageOf(d.value)') && rr.includes('new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow - 7)') && rr.includes('const dow = (d.getDay() + 6) % 7') && !rr.includes('const DAY ='); });
check('R129-11 B11 书签导入（V3.9.23 重指）：直接写资源卡池，不再解析目标分类，因此不存在同名「待分类」命中软删分类的问题；旧目标分类查询与文件夹勾选弹窗必须零回流', () => {
  const bk = read('/newtab/composables/useBookmarkImport.ts');
  const im = codeOnly(read('/newtab/composables/useWorkspaceImport.ts'));
  return bk.includes('workspaceId: CURATION_WS_ID, categoryId: \'\'')
    && !bk.includes('find(c => !c.deletedAt && c.workspaceId === target.id')
    && !bk.includes('c.name === \'待分类\'')
    && !bk.includes('const bkBookmarks') && !im.includes('const bkBookmarks') && !im.includes('bookmarkModalOpen');
});
check('R129-12 ★ B12 台名剥图标全站唯一口径 wsName.ts 双 helper（setWsIcon("") 吃首词数据腐蚀 + CuriosityPanel 漏转义致图标重复 双双退役）', () => { const n = read('/shared/utils/wsName.ts'); const wm = read('/newtab/composables/useWsMeta.ts'); const c = read('/newtab/components/compass/CuriosityPanel.vue'); return n.includes('export function wsDisplayNameOf') && n.includes('export function wsNameWithIcon') && !wm.includes('replace(/^[^\\s]+\\s/') && !c.includes('replace(/^[^s]+s/'); });
check('R129-13 B12 铺开面：台名去图标消费点收编（GlobalSettings 下拉/回收站/App/浮层/全局弹窗 均走 wsName.ts 口径；R165-A 备案：资源抽屉与 useResourceDrawer 随策展台字段退役不再显示台名，出列）· ★R4-Dg 随迁备案（收紧不是放宽）：原判据只要求五个文件里出现 wsDisplayNameOf 这个字面量；本轮把「workspaceId → 展示名」整条取法收进 wsName.ts 的 wsNameById（内部仍走 wsDisplayNameOf，剥图标口径一字未动），字面量因此搬到共用入口，原判据会因"文件里不再直接写这个名字"而误红。改成三条腿：① 五个消费文件必须从 @/shared/utils/wsName 导入口径；② 消费点不许再留 ad-hoc 取法（裸 .name 拼兜底、find(w => w.id === id)?.name）；③ 池卡展示名必须由 POOL_DISPLAY_NAME / wsNameById 给，不得再由 workspace 实体的历史名（「资源台」）供给', () => {
  const files = ['/newtab/views/GlobalSettings.vue', '/newtab/views/RecycleBin.vue', '/newtab/App.vue', '/content/overlay-impl.ts', '/newtab/components/GlobalPopups.vue'];
  const gp = codeOnly(read('/newtab/components/GlobalPopups.vue'));
  const rb = codeOnly(read('/newtab/views/RecycleBin.vue'));
  const ns = codeOnly(read('/newtab/components/compass/NorthStarPanel.vue'));
  const ov = codeOnly(read('/content/overlay-impl.ts'));
  return files.every(f => read(f).includes("from '@/shared/utils/wsName'"))
    && !gp.includes('ws?.name ||') && !rb.includes('find(w => w.id === id)?.name')
    && !ns.includes('find(w => w.id === id)?.name') && !ov.includes("w.name || '未知'")
    && gp.includes('wsNameById(all.workspaces, r.workspaceId)')
    && ov.includes('wsName.set(CURATION_WS_ID, POOL_DISPLAY_NAME)'); });

// ============== R130 · V2.98.0：标签管理三修 + 资源台/金字塔版式（用户反馈批次） ==============
console.log('【R130 · V2.98.0：标签管理三修 + 版式呼吸感】');
check('R130-1 ★T1 标签计数口径合一（角标与右列同一判据 + 排除回收站软删卡）· R148 备案：改 tagUsageMap 一次建表；R151 备案：口径按用户拍板升级为「根含子树」（cardHasTag 增加 startsWith(名+/)），不再是纯路径+叶子双口径', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('function cardHasTag(tags: string[] | undefined, name: string)') && g.includes("t === name || t === leaf || t.startsWith(name + '/')") && g.includes('if (x.deletedAt || !Array.isArray(x.tags)) continue') && count('/newtab/views/GlobalSettings.vue', '!cardHasTag(') >= 3 && !g.includes('.includes(tag)) continue'); });
check('R130-2 ★T2 标签详情抽屉位置修复：从资源台全景面板（v-if panorama）迁入标签管理面板——原抽屉组件在标签页根本不渲染，双击永无反应（★R4-Da 随迁备案：🗺 全景整页删除后，原判据「抽屉不在全景段内」那一半会静默退化——g.slice(g.indexOf(已不存在的串), n) 得空串，什么都能「不包含」，正是「断言还在、证据已空」。判据换可失败的真凭据：① 全景面板在 GS 剥注释后零命中＝那一页真没了；② 抽屉锚点的下标必须落在 tags 面板起点与下一个面板（ai）起点之间，用下标比较取代切片取反）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const gc = codeOnly(g); const ti = g.indexOf("activePage === 'tags'"), ai = g.indexOf("activePage === 'ai'"), di = g.indexOf(':open="!!ttDetail"'); return !gc.includes("activePage === 'panorama'") && ti >= 0 && ai > ti && di > ti && di < ai && di > ti && g.includes('openCardLink({ link: ttDetail.link })'); });
check('R130-3（V3.9.8 随迁）拖拽视觉反馈：标签树落点高亮与拖动行降透明保持不变；策展画布补合法/非法落点与拖动源反馈', () => { const g = read('/newtab/views/GlobalSettings.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const cc = read('/newtab/components/curation/curation.css'); return g.includes('const ttDropTarget = ref(') && g.includes('@dragover.prevent="ttDropTarget = root.id"') && g.includes('@dragover.prevent="ttDropTarget = child.id"') && g.includes('ttCardDragging.value = true') && g.includes('.gs-tt-row.drop { border-color: var(--accent); background: var(--accent-light); box-shadow: inset 0 0 0 1.5px var(--accent); }') && g.includes('.tt-card.dragging { opacity: .45; }') && cp.includes('.cz-card.dragging { opacity: .4; }') && cc.includes('.mind-node.dragging') && cc.includes('.mind-node.drop-target') && cc.includes('.mind-node.drop-invalid'); });
check('R130-4 ★T5 --radius-md 令牌补齐（全站 14 处引用此前无定义 → metric-box/today-card/tm-card 圆角静默失效渲染成直角）', () => { const tk = read('/shared/styles/tokens.css'); const c = read('/newtab/views/workspace.css'); return tk.includes('--radius-md: 10px;') && c.includes('.metric-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);'); });
check('R130-5（V3.9.14 重指）画布撑满与呼吸间距：旧 ws-view/kanban/pyramid 三视图容器退役；现役 CurationMindMap 是唯一工作区，画布内部横向滚动，节点与 SVG 连线层由相对定位的 max-content 舞台承载，工作区以 13px 上间距形成呼吸感', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const c = read('/newtab/components/curation/curation.css');
  return !w.includes(`<div v-if="viewMode==='card'" class="ws-view">`)
    && !w.includes(`<div v-if="viewMode==='list'" class="ws-view">`)
    && w.includes('<CurationMindMap') && w.includes('class="curation-workspace"')
    && c.includes('.mindmap-shell {') && c.includes('margin-top: 13px;') && c.includes('overflow: hidden;')
    && c.includes('.mindmap-canvas {') && c.includes('overflow: auto;')
    && c.includes('.mind-stage { position: relative; width: max-content; min-width: 100%;')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-stage { display: block; width: max-content; min-width: 100%; margin: 0 auto; }');
});
check('R130-6 T4 三台左缘对齐线不变量：ws-page 1440 居中 + ws-content 左右 36px 与顶栏 align-page 同线（页头/指标/卡区共用一条对齐线）', () => { const c = read('/newtab/views/workspace.css'); const a = read('/newtab/App.vue'); return c.includes('.ws-page { min-height: 100vh; background: var(--bg); max-width: 1440px; margin: 0 auto; }') && c.includes('.ws-content { flex: 1; min-width: 0; padding: 20px 36px 90px; overflow-y: auto; }') && a.includes('.topbar-inner.align-page { max-width: 1440px; margin: 0 auto; padding: 0 36px; }'); });

// ============== R131 · V2.99.0：N1 三台对齐 + N2 项目目录侧栏 + 批次 C 性能 ==============
console.log('【R131 · V2.99.0：N1/N2 体验修复 + 批次 C 性能】');
check('R131-1 ★N1 策展台页头与论点带同轴（V3.9.28 重指：台身份 ≤40px、中心论点独占下一行；仍与 ws-content 的 36px 页轴对齐）', () => {
  const c = read('/newtab/views/workspace.css');
  return /\.ws-hero \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*gap: 9px;[^}]*padding-left: 22px;/.test(c)
    && /\.ws-id-head \{[^}]*display: flex;[^}]*min-width: 0;[^}]*min-height: 36px;[^}]*max-height: 40px;/.test(c)
    && !/\.ws-id-head \{[^}]*max-width: 38%;/.test(c)
    && c.includes('.ws-content { flex: 1; min-width: 0; padding: 20px 36px 90px; overflow-y: auto; }')
    && !c.includes('padding: 4px 0 6px 22px');
});
check('R131-2 N2 项目详情页左侧目录：pd-dir 侧栏 + pd-split 拖拽把手（mousedown 拖宽 / dblclick 复位）+ 内容列 with-dir flex 撑满', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('<aside v-if="!embedded" class="pd-dir"') && p.includes('class="pd-split"') && p.includes('@mousedown.prevent="startDirResize"') && p.includes('@dblclick="resetDirWidth"') && p.includes('.board-layout.with-dir { display: flex;') && p.includes('.board-layout.with-dir .board { flex: 1; min-width: 0; }'); });
check('R131-3 N2 目录宽度持久化：DIR_W 三常量钳制 + UIPrefs.projRailW 落盘 + onUnmounted 摘除文档级监听', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('const DIR_W_MIN = 180') && p.includes('const DIR_W_MAX = 420') && p.includes('store.ui?.projRailW as number | undefined') && p.includes("saveUIPrefs({ projRailW: projDirW.value })") && p.includes("document.removeEventListener('mousemove', onDirResizeMove)") && p.includes("document.removeEventListener('mouseup', onDirResizeUp)"); });
check('R131-4 ★C1a isSelfWrite 载荷 __wid O(1)（内容指纹整串比对退役；跨上下文随机前缀防撞、无 __wid 存量判外部=保守正确）', () => { const r = read('/shared/storage/repository.ts'); return r.includes("const SELF_CTX_ID = Math.random().toString(36).slice(2, 8)") && (r.match(/__wid: wid/g) || []).length >= 2 && !r.includes('lastSelfWriteJson'); });
check('R131-5 C2 全局搜索键入（V3.9.24 重指）：自适应防抖（短词 90ms / 长词 60ms，searchQueryRaw 即时回显）+ 非搜索面板短路 + 索引 Map 化 + 装饰-排序', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('const searchQueryRaw = ref(') && g.includes('const delay = v.length >= 8 ? 60 : 90') && g.includes("qDebounce = setTimeout(() => { qDebounce = null; searchQuery.value = v }, delay)") && g.includes("if (!searchActive.value) return { all: 0, res: 0, task: 0, curio: 0, ws: 0, proj: 0 }") && g.includes('const wsById = new Map') && g.includes('const projById = new Map') && g.includes('const decorated = list.map') && g.includes('return decorated.map(x => x.r)') && g.includes("onUnmounted(() => { if (qDebounce) clearTimeout(qDebounce) })"); });
check('R131-6 C4 任务面板每行重复计算归零：projectName/metricName 走 Map O(1) + 看板分组 kanbanMap computed（三列 × 全项目 × 全任务 filter 退役）', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return t.includes('const projNameById = computed(') && t.includes('const metricTitleById = computed(') && t.includes('projNameById.value.get(projId)') && t.includes('const kanbanMap = computed(') && t.includes('function kanbanGroups(status') && !t.includes("d.value.compass.directions.flatMap(dir => dir.projects).find"); });
check('R131-7 C3 ★R4-Da 退役重指带备案：原守「全景树计数 bucket 一次成型：panCounts 双 Map（ws|cat 复合键承 R109 F12-a 的台收紧）替代 O(分类×卡) 逐节点全扫 + panFlatCats 扁平行序列」——🗺 整页退役。"计数一次成型、不在每个节点重扫全库"这条性能纪律在两个存活管理面各有实现并逐件点名：① 策展台 resBucket=buildBucketIndex(allResources, r.categoryId)（侧栏 directCount 直接查桶，卡片/列表分组同一 buildBucketIndex）② 设置页标签树 tagUsageMap 一次遍历建表（R148-P1b 注释即在文件里，脏计数 + 树版本戳做缓存失效）；panCounts / ws|cat 复合键 / panFlatCats / flattenPanCats 在 GS 按 codeOnly 零命中', () => {
  const g = read('/newtab/views/GlobalSettings.vue'); const gc = codeOnly(g);
  const ws = read('/newtab/views/Workspace.vue'); const urv = read('/newtab/composables/useResourceView.ts');
  const retired = ['const panCounts = computed', "const k = wsId + '|' + catId", 'function flattenPanCats', 'panFlatCats', 'panCountByCat'];
  return retired.every(k => !gc.includes(k))
    && ws.includes('const resBucket = computed(() => buildBucketIndex(allResources.value, (r) => r.categoryId || \'\'))')
    && ws.includes('directCount: (resBucket.value.get(c.id) || []).length')
    && urv.includes("const bucket = buildBucketIndex(filtered, (r) => r.categoryId || '')")
    && g.includes('function tagUsageMap(): Map<string, number>') && g.includes('一次遍历建表') && g.includes('const bump = (k: string) => map.set(k, (map.get(k) || 0) + 1)');
});
check('R131-8 C3 ★R4-Da 退役重指带备案：原守「全景右栏增量渲染：PAN_RENDER_STEP=32 + 滚动到底 400px 追加 + 切台/切分类复位 + v-for panVisibleCards」——整页退役。同一套三件在两个存活管理面都更硬：① 策展台资源视图 useResourceView：RENDER_STEP=32、`scrollHeight - scrollTop - clientHeight < 400` 追加、watch([workspaceId, viewMode, activeCategory, …]) 复位（切台/切分类/换视图全在内）② 调度台池面板：PAGE=60 一档 + IntersectionObserver rootMargin 240px 自动追加 + watch(query) 复位 + 手动「加载更多」兜底；全景那五个符号按 codeOnly 零命中', () => {
  const gc = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const urv = read('/newtab/composables/useResourceView.ts');
  const pcp = read('/newtab/components/compass/PoolCardsPanel.vue');
  const retired = ['const PAN_RENDER_STEP = 32', 'const panVisibleCards = computed', 'const panRenderLimit = ref', 'onPanListScroll', 'v-for="r in panVisibleCards"', 'panHasMore'];
  return retired.every(k => !gc.includes(k))
    && urv.includes('const RENDER_STEP = 32')
    && urv.includes('if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) renderLimit.value += RENDER_STEP')
    && urv.includes('watch([workspaceId, viewMode, activeCategory, debouncedQuery, sortBy, sortDir], () => { renderLimit.value = RENDER_STEP')
    && pcp.includes('const PAGE = 60') && pcp.includes("rootMargin: '240px'") && pcp.includes('watch(query, () => { visibleCount.value = PAGE })') && pcp.includes('function renderMore()');
});
check('R131-9 C5 事件流水 shallowRef：wceEvents（compass store）+ eventLog（画像洞察页）整组替换不再逐元素建 Proxy（★W9 退役重指带备案：eventLog 宿主由 GlobalSettings 改指 ProfileInsights；「shallowRef 整组替换」这条性能红线一字未动）', () => { const c = read('/newtab/stores/compass.ts'); const g = read('/newtab/views/ProfileInsights.vue'); return c.includes('const wceEvents = shallowRef<CardEvent[]>([])') && g.includes('const eventLog = shallowRef<CardEvent[]>([])') && g.includes('eventLog.value = log.slice().reverse()') && !codeOnly(read('/newtab/views/GlobalSettings.vue')).includes('shallowRef<CardEvent[]>'); });
check('R131-10 C6b 启动迁移链尾单次落盘：migrated 累积标记 + if (migrated) saveData()（三段各自落盘退役）', () => { const a = read('/newtab/stores/app.ts'); return a.includes('let migrated = false') && (a.match(/saveData\(\)/g) || []).length === 2 && a.includes('if (migrated) saveData()'); });
check('R131-11 C1 门禁：perf.cjs 新增 M6 保存链路探针（整库序列化 + 同载荷写盘，独立键采样不触发合并环）', () => { const p = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'perf.cjs'), 'utf8'); return p.includes("push('M6a_整库JSON序列化(ms)'") && p.includes("zy_perf_probe: s") && p.includes("chrome.storage.local.remove('zy_perf_probe'"); });

// ============== R132 · V2.100.0：标签拖拽移动修复 + 全选 + 三树双击改名 + 项目详情左栏重构 ==============
console.log('【R132 · V2.100.0：标签管理四修 + 项目详情左栏重构】');
check('R132-1 ★T2 拖拽移动判据合一：ttMoveCards 与展示判据同走「路径+叶子」双口径（fromLeaf 过滤），原精确 includes 静默跳过致 A 不减 B 不增', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('const fromLeaf = from.split(\'/\').pop() || from') && g.includes('const kept = tags.filter(t => t !== from && t !== fromLeaf)') && g.includes('if (kept.length === tags.length) continue') && !g.includes('if (!tags.includes(from)) continue'); });
check('R132-2 T2 拖拽健壮性：卡片行 dragstart 写 dataTransfer + 根/子标签行 @drop 补 .prevent + 同标签落点短路（targetPath===from 直接返回）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes(`e.dataTransfer?.setData('text/plain', ttCardDragIds.join(','))`) && count('/newtab/views/GlobalSettings.vue', '@drop.prevent="ttDrop($event,') === 2 && g.includes('if (!ids.size || !from || targetPath === from) return'); });
check('R132-3 T1 全选本标签：ttAllChecked/toggleTtAll 走当前筛选结果集（ttRows 口径，与全景「全选本分类」一致）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('const ttAllChecked = computed(() => ttRows.value.length > 0 && ttRows.value.every(r => ttPicked.value.has(r.id)))') && g.includes('function toggleTtAll()') && g.includes('全选本标签'); });
check('R132-4 T3 标签树双击改名：根/子行 @dblclick 直连既有 ttRename 行内编辑（卡片标签级联走 ttConfirm）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('@dblclick="ttRename(root.id)"') && g.includes('@dblclick="ttRename(child.id)"'); });
check('R132-5 T3 ★R4-Da 退役重指带备案：原守「全景树分类双击行内改名：panEdit 态 + 同层查重 + 只改 name+persist（分类按 id 引用无卡片级联）」——🗺 整页退役，但「三树双击改名」的另两棵树（R132-T3 当初就是三棵一起做）都还在，判据改认它们：① 策展台分类树 @dblclick=startCatRename → commitCatRename：先 wsCats 同台查重并给守点文案「已存在同名分类，请更换名称」，再 cat.name = name + persist()（不碰卡）② 设置页标签树 @dblclick=ttRename → ttConfirm：tagFlat 查重「已存在同名标签」后改 name + 级联卡标签；panEdit / panCatRename / 旧守点文案「同一层级下已有同名分类」在 GS 按 codeOnly 零命中（防实现回流）', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const mind = read('/newtab/composables/useCurationMindMap.ts');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const ws = codeOnly(read('/newtab/views/Workspace.vue'));
  const retired = ['const panEdit = ref<{ id: string; value: string } | null>(null)', '@dblclick="panCatRename(row.node.cat.id)"', '同一层级下已有同名分类', 'function panCatRename', 'function panCatRenameConfirm'];
  return retired.every(k => !g.includes(k))
    && !ws.includes('@dblclick="startCatRename(sc.cat)"')
    && node.includes('@dblclick.stop="beginEdit(\'title\')"')
    && mind.includes('function renameNode(cat: Category, raw: string)')
    && mind.includes("showToast('已存在同名分支，请换一个名称')")
    && mind.includes('cat.name = name') && mind.includes('persist()')
    && g.includes('@dblclick="ttRename(root.id)"') && g.includes('@dblclick="ttRename(child.id)"')
    && g.includes('const dup = tagFlat().some(t => t.name === name && t.id !== ed.id)') && g.includes("showToast('已存在同名标签')");
});
check('R132-6（V3.9.9 随迁）策展画布节点改名：标题单击选中、双击（或 F2）进入行内 input，不再弹窗；旧资源台 startCatRename(sc.cat) 与 CatNodeName 宿主已退役', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  return node.includes('class="mind-edit-title"')
    && node.includes('@dblclick.stop="beginEdit(\'title\')"')
    && node.includes("if (e.key === 'F2')")
    && !w.includes('@dblclick="startCatRename(sc.cat)"')
    && !w.includes('<CatNodeName class="cat-name"');
});
check('R132-7 ★T4 左栏主体=本项目详情目录：projToc 锚点项（概览+各指标+未归类+附件）+ scrollToSec 定位 + 三锚点 id 落位', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('const projToc = computed<TocItem[]>') && p.includes("id: 'pd-sec-overview'") && p.includes('function scrollToSec(id: string)') && p.includes('id="pd-sec-overview"') && p.includes('id="pd-sec-orphan"') && p.includes('id="pd-sec-assets"') && p.includes('.pb-head-row, .metric-sec { scroll-margin-top: 72px; }'); });
check('R132-8 T4 滚动高亮 + 泄漏兜底：window scroll passive 监听 onMounted 挂 / onUnmounted 摘', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes(`window.addEventListener('scroll', onTocScroll, { passive: true })`) && p.includes(`window.removeEventListener('scroll', onTocScroll)`); });
check('R132-9 ★T5 项目全景=左栏顶部可折叠块（用户拍板）：projPanOpen 默认收起、点标题行翻转、选项目后自动收起并回概览锚点', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('const projPanOpen = ref(false)') && p.includes('@click="projPanOpen = !projPanOpen"') && p.includes('v-show="projPanOpen"') && p.includes('projPanOpen.value = false') && p.includes("tocActive.value = 'pd-sec-overview'"); });
check('R132-10 T4 拖拽调宽与自适应保留：pd-split 把手 + with-dir 展板 flex:1 min-width:0（R131-N2 口径不动）', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('@mousedown.prevent="startDirResize"') && p.includes('.board-layout.with-dir .board { flex: 1; min-width: 0; }') && p.includes('saveUIPrefs({ projRailW: projDirW.value })'); });

// ============== R133 · V2.101.0：批次 E 视觉令牌体系升级（E1 语义阶梯 / E2 圆角完备 / E3 选区+禁用档 / E4 运动令牌） ==============
console.log('【R133 · V2.101.0：批次 E 视觉令牌体系升级】');
// R133 专用：src 下 vue/css 文件遍历（供悬空令牌/时长字面量全站扫描；content/*.ts 浮层自带 --zy 体系豁免）
check('R133-1 ★E2 --radius-lg: 14px 补定义（CompassTree .tree-level-card 引用悬空 → 直角渲染，R130-T5 同族 BUG 再抓一例）', () => { const t = read('/shared/styles/tokens.css'); const c = CT_ALL; return t.includes('--radius-lg: 14px;') && c.includes('border-radius: var(--radius-lg)'); });
check('R133-2 ★E2 圆角族完备性守卫：全站被引用的 var(--radius*) 必须在 tokens.css 有定义（杜绝 R130-T5/R133-1 类静默失效复发）', () => {
  const t = read('/shared/styles/tokens.css');
  const defined = new Set(t.match(/--[a-z-]*radius[a-z-]*(?=\s*:)/g) || []);
  for (const src of STYLE_ALL) {
    for (const m of src.matchAll(/var\((--radius[a-z-]*)[,)]/g)) {
      if (!defined.has(m[1])) return false;
    }
  }
  return defined.has('--radius') && defined.has('--radius-lg') && defined.has('--radius-md') && defined.has('--radius-sm') && defined.has('--radius-xs');
});
check('R133-3 E2 本轮清账：--text2/--text3/--text4/--rads/--warn)/--warning-light/--text-1 七族悬空令牌全站零引用（ImportTemplateModal 最重灾区 + RecycleBin/CompassTree/TaskManagerPanel/workspace.css 一并修正）', () => {
  const danglers = ['var(--text2)', 'var(--text3)', 'var(--text4)', 'var(--rads)', 'var(--warn)', 'var(--warning-light)', 'var(--text-1)'];
  return STYLE_ALL.every(s => danglers.every(d => !s.includes(d)));
});
check('R133-4 E1 语义色三档阶梯四主题齐挂：--success/--warning/--danger 各配 -bg-soft + -border，每令牌恰出现 4 次（linear/raycast/apple/notion 不缺席）', () => { const t = read('/shared/styles/tokens.css'); return ['--success-bg-soft', '--success-border', '--warning-bg-soft', '--warning-border', '--danger-bg-soft', '--danger-border'].every(n => (t.match(new RegExp(n + ':', 'g')) || []).length === 4); });
check('R133-5 E1 消费点收敛：五个硬编码宿主文件不再出现 #e5484d/rgba(229,72,77/rgba(217,160,60（tokens.css 的 --danger 主定义除外），RecycleBin 危险钮与 dup 环走 --danger-border/--danger', () => {
  const hosts = ['/newtab/views/RecycleBin.vue', '/newtab/views/workspace.css', '/newtab/components/ResourceDetailDrawer.vue', '/newtab/components/ImportTemplateModal.vue', '/newtab/components/ResourceEditForm.vue'];
  const rb = read('/newtab/views/RecycleBin.vue'); const ws = read('/newtab/views/workspace.css');
  return hosts.every(f => { const s = read(f); return !/#e5484d/i.test(s) && !/rgba\(229,72,77|rgba\(217,160,60/.test(s); })
    && rb.includes('.rb-btn.danger { border-color: var(--danger-border); color: var(--danger); }')
    && ws.includes('.ws-modal-input.dup { border-color: var(--danger); box-shadow: 0 0 0 2px var(--danger-bg-soft); }');
});
check('R133-6 E3 选区色 + 禁用档：::selection 走 accent 18% color-mix；--opacity-disabled: 0.5 定义且 :disabled 透明度字面量全站清零（≥10 处消费）', () => {
  const t = read('/shared/styles/tokens.css');
  const consumed = STYLE_ALL.reduce((n, s) => n + (s.match(/var\(--opacity-disabled\)/g) || []).length, 0);
  return t.includes('::selection {') && t.includes('background: color-mix(in srgb, var(--accent) 18%, transparent);')
    && t.includes('--opacity-disabled: 0.5;') && consumed >= 10
    && STYLE_ALL.every(s => !/:disabled \{ opacity: \.\d/.test(s));
});
check('R133-7 E4 运动令牌定义：--dur-fast 120ms / --dur 150ms（主档=原 .15s 众数）/ --dur-slow 250ms + 统一减速曲线 --ease-out-soft', () => { const t = read('/shared/styles/tokens.css'); return t.includes('--dur-fast: 120ms;') && t.includes('--dur: 150ms;') && t.includes('--dur-slow: 250ms;') && t.includes('--ease-out-soft: cubic-bezier(0.2, 0.8, 0.2, 1);'); });
check('R133-8 ★E4 字面时长退役：vue/css 全站 .12s/.15s/.25s 清零（219 处收敛至令牌；src/content 浮层为 .ts 注入样式自带 --zy 体系，天然豁免）', () => STYLE_ALL.every(s => !/(?<![\d.])\.(12|15|25)s\b/.test(s)));
check('R133-9（V3.9.8 随迁）画布节点入场递进：mind-reveal 用 --dur-slow + --ease-out-soft，定位命中仅播放一次；旧 card-grid/res-card 入场动画随四视图退役', () => { const cc = read('/newtab/components/curation/curation.css'); return cc.includes('.mind-node.revealed { animation: mind-reveal 2.2s ease-out; }') && cc.includes('@keyframes mind-reveal') && !cc.includes('.card-grid > .res-card'); });

// ============== R134 · V2.102.0：批次 F AI 接入（地基三件套 + 批量/单卡补全 + 沉睡唤醒 + 诊断 v0） ==============
console.log('【R134 · V2.102.0：批次 F AI 接入】');
check('R134-1 ★安全边界：AI 配置存独立键（不挂 AppData）——密钥/地址天然脱离整库导出、导入合并、自动备份与 __wid 同步环', () => { const c = read('/shared/ai/config.ts'); const r = read('/shared/storage/repository.ts'); return c.includes('export const AI_STORAGE_KEY = K.AI_CONFIG') && !r.includes('zy_ai') && c.includes('chrome.storage.local.set'); });
check('R134-2 ★性能纪律：启动链零 AI——main/App/background 不引 shared/ai；★RDD 按需挂载（R160-P1 起 defineAsyncComponent + bus 暂存回放）· R167 备案：RDD 的 AI 接线整体搬进共享 ResourceAiStrip，故"懒"的判据从 RDD 转到该组件与 CardAiEntry（值导入一律禁、只许 `import type` + 点击时 dynamic import + 模块作用域异步壳）', () => { const m = read('/newtab/main.ts'); const a = read('/newtab/App.vue'); const b = read('/background/index.ts'); const r = read('/newtab/components/ResourceDetailDrawer.vue'); const st = read('/newtab/components/ResourceAiStrip.vue'); const ce = read('/newtab/components/CardAiEntry.vue'); const valAi = /\nimport\s+(?!\{[^}]*\btype\b)[^}\n]*from '@\/shared\/ai\//; return !m.includes('/ai/') && !a.includes('/ai/') && !b.includes('/ai/') && !r.includes('import AiSuggestionDrawer') && !valAi.test(r) && !valAi.test(st) && !valAi.test(ce) && st.includes("import { AiDrawer } from './lazyAiDrawer'") && st.includes("import('@/shared/ai/config')") && ce.includes("import('@/shared/ai/config')") && !st.includes("defineAsyncComponent(") /* R152：异步壳全站单例，宿主不再各自新建组件定义 */; });
check('R134-3 建议不落库：评审抽屉自身无 store/写盘调用——建议行只活内存态（shallowRef + data 载荷），采纳由宿主 apply 闭包执行；中止/关即弃', () => { const d = read('/newtab/components/AiSuggestionDrawer.vue'); return d.includes('rows = shallowRef<AiRow[]>') && d.includes('job.apply(sel)') && d.includes('const snap = JSON.stringify(store.data)') && d.includes('pushUndo('); });
check('R134-4 LLM 客户端契约：OpenAI 兼容 fetch（host_permissions 已备）+ SSE 流式解析 + baseUrl 归一容错 + 401/404 人话映射 + 围栏 JSON 三态提取', () => { const l = read('/shared/ai/llm.ts'); return l.includes("b.replace(/\\/chat\\/completions$/i, '')") && l.includes("[DONE]") && l.includes('API Key 无效或过期') && l.includes('地址或模型名不存在') && l.includes('```(?:json)?') && l.includes('/models') && l.includes("response_format: { type: 'json_object' }"); });
check('R134-5 投影器纪律：eco/std/deep 三档上限表 + 沉睡判定豁免置顶/星标 + 附件本体永不进投影（函数面不触 assets）', () => { const p = read('/shared/ai/project.ts'); return p.includes("eco:  { cards: 30") && p.includes("deep: { cards: 150") && p.includes('!r.pinned && !r.starred') && !p.includes('getAsset') && !p.includes('zy_assets'); });
check('R134-6 防幻觉引用：模型回填的 cardId/categoryId 必须经 sanitizeRefs 对真实库校验，宿主 apply 再二次校验分类存在', () => { const s = read('/shared/ai/scenarios.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return s.includes('!d.resources.some(r => r.id === next.cardId') && s.includes('!d.categories.some(c => c.id === next.categoryId') && g.includes('dd.categories.some(c => c.id === s.categoryId && !c.deletedAt)'); });
check('R134-7 三个消费入口落位（R154：RDD 采纳改直接写库；R158 随迁：dormant 采纳语义迁 GlobalPopups 建议面板；R167 备案：详情抽屉的补全入口整体搬进共享 ResourceAiStrip，判据随之改指该组件）：设置页导航 AI 助手 + 标签管理批量补全按钮 + 资源 AI 行补全钮；采纳语义=标签并入/描述仅补空/分类迁移，唤醒=置顶、归档=软删（回收站可反悔）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const st = read('/newtab/components/ResourceAiStrip.vue'); const gp = read('/newtab/components/GlobalPopups.vue'); return g.includes("{ key: 'ai', mark: true, label: 'AI 助手' }") && g.includes('AiMark') && g.includes('aiTtEnrich') && g.includes('card.tags = [...new Set(') && g.includes('if (s.description?.trim() && !card.description)') && gp.includes('card.pinned = true') && gp.includes('card.deletedAt = Date.now()') && st.includes("run('enrich')") && st.includes('buildResourceEnrichJob(card, ctx)') && st.includes('const base = j.apply') && st.includes('props.onAdopted?.()'); });
check('R134-8（R137 改写）深度诊断：内置两专家 + job.run 接管多轮会诊；v0 只读 → v1 勾选采纳=生成跟进任务卡（adoptable 回归默认 true，验收锚改 apply 建任务语义）★G1(V3.8.24)随迁带备案：🧠 前缀删除，锚点随迁为纯文本「诊断发现：」', () => { const s = read('/shared/ai/scenarios.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return s.includes("id: 'goal-expert'") && s.includes("id: 'knowledge-expert'") && g.includes('async run({ signal, onDelta })') && g.includes('diagnosisSystem(p, ov[p.id]?.style') && g.includes('诊断发现：') && g.includes('诊断跟进任务'); });
check('R134-9 「关于我」全局画像：withAboutMe 注入所有场景系统提示词（enrich/batch/dormant/diagnosis 四系全走）', () => { const s = read('/shared/ai/scenarios.ts'); return s.includes('【用户画像（长期偏好，建议须贴合）】') && (s.match(/withAboutMe\(/g) || []).length >= 5; });
check('R134-10 注入面防护：抽屉渲染零 v-html（模型回显纯文本插值，提示词注入不可达 DOM）', () => { const d = read('/newtab/components/AiSuggestionDrawer.vue'); return !d.includes('v-html'); });
check('R134-11（R137 改写）接入表单完备：baseUrl/Key(password)/模型(datalist 可手输) + 拉取列表 + 测试连接 + 深度档 select + aboutMe textarea；进 AI 页 loadAiConfig 并同步专家勾选名单', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes("type=\"password\"") && g.includes('list="ai-model-list"') && g.includes('aiFetchModels') && g.includes('aiTestConn') && g.includes("<select class=\"gs-input ai-depth\"") && g.includes('if (p === \'ai\') { await loadAiConfig()') && g.includes('aiPersonaSynced'); });

// ============== R135 · V2.103.0：批次 F 第二刀 罗盘链式生成 + 任务拆解（生成类采纳链路） ==============
console.log('【R135 · V2.103.0：B1 罗盘逐层生成 + C2′ 任务拆解】');
check('R135-1 ★生成类采纳纪律：chain.ts 同层查重（directions/projects/metrics/tasks 四路 dup continue）+ 字段白名单清洗（term/priority 枚举、YYYY-MM-DD 校验、分钟 10~600 钳制、名称 40 字截断）+ 实体形状与既有创建通道同形', () => { const c = read('/shared/ai/chain.ts'); return c.includes('if (d.compass.directions.some(x => x.name === s.name)) { dup++; continue }') && c.includes('dir.projects.some(p => p.name === s.name)') && c.includes('proj.metrics.some(m => m.title === s.name)') && c.includes('existing.some(t => t!.title === s.name)') && c.includes("TERM_SET.has(String(s.term))") && c.includes('DATE_RE.test(String(s.dueDate))') && c.includes('m >= 10 && m <= 600'); });
check('R135-2 五层任务书：CHAIN_DEF 齐 directions/projects/metrics/tasks/breakdown，每层 role+rules+JSON schema 三件套，全部走 chainSystem→withAboutMe 画像注入（R139 备案：role 位可被 personaText 专家执笔替换，无专家时回落内置角色）', () => { const s = read('/shared/ai/scenarios.ts'); return ['directions:', 'projects:', 'metrics:', 'tasks:', 'breakdown:'].every(k => s.includes(k)) && s.includes('export function chainSystem') && s.includes('return withAboutMe(`${personaText || def.role}\\n${def.rules}\\n${def.schema}`)'); });
check('R135-3 链投影 projectChain：五层分支+上行链（愿景/使命恒投）+同层兄弟现状（供查重）+锚点失效返回 missing 由宿主拒开抽屉', () => { const p = read('/shared/ai/project.ts'); return p.includes('export function projectChain') && p.includes("missing: '战略目标已不存在'") && p.includes("missing: '项目已不存在'") && p.includes("missing: '指标已不存在'") && p.includes('【该指标下现有任务】') && p.includes('【现有成功指标】'); });
check('R135-4（R155-⑤ 备案：入口组件化，锚点 AiMark → AiEntryButton）六个入口落位：方向树四层（建议目标/项目/指标/任务）+ 任务详情抽屉拆解 + 项目详情页建议指标；共用 buildChainJob 一个工厂', () => { const t = CT_ALL; const td = read('/newtab/components/compass/TaskDetailDrawer.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); /* ★W11(V3.8.11)随迁带备案：四层入口的调用写法随结构拆分而变——directions/projects 仍在树本体
       （projects 因 v-for 变量改名 dg）；metrics/tasks 改由舱/指标卡 emit 上抛、父组件在
       @ai-metric / @ai-task 上接线（跨两层组件，锚点承重处选**模板挂载点**不选 emit 行）。
       本条守的仍是「四个层级各有 AI 入口」，判据同时钉住 emit 侧存在、挂载侧接线。 */
  return [`aiChain('directions', '')`, `aiChain('projects', dg.dir.id)`, `@ai-metric="(id) => aiChain('metrics', id)"`, `@ai-task="(mid) => aiChain('tasks', mid)"`].every(x => t.includes(x))
    && t.includes(`emit('aiTask', m.id)`) && t.includes(`emit('aiMetric', proj.id)`) && td.includes("buildChainJob('breakdown', t.id") && td.includes('AiEntryButton') && pc.includes("buildChainJob('metrics', p.id") && pc.includes('建议指标'); });
check('R135-5 ★懒加载纪律推广：罗盘三宿主挂 AiDrawer 全走懒通道 + 点击时才 import config/chain，无一例静态**运行时** import shared/ai（R134 入口 chunk 教训的横向锁 · R166 两条备案：① 懒的形态从"各宿主自己 defineAsyncComponent"升级为共用 lazyAiDrawer 模块级单例，判据改为二者取其一；② 静态判定改为先剥 import type——红线防的是把 AI 栈卷进入口 chunk，而 import type 编译期即消失、entry-literals 也早就不算它；裸字符串查会把合法类型引用误判成违规，逼宿主复制类型定义反而更糟。真运行时 import 照样红）', () => { const files = ['/newtab/views/CompassTree.vue', '/newtab/components/compass/TaskDetailDrawer.vue', '/newtab/views/ProjectCuration.vue']; return files.every(f => { const s = read(f); const runtime = s.split('\n').filter(l => !/^\s*import type\b/.test(l)).join('\n'); return !runtime.includes("from '@/shared/ai/") && (s.includes('lazyAiDrawer') || s.includes('defineAsyncComponent(() => import(')) && s.includes("import('@/shared/ai/chain')") && s.includes("import('@/shared/ai/config')"); }); });
check('R135-6 契约类型迁位 job.ts：AiRow/AiJob 单一真源在 shared/ai/job.ts，抽屉 re-export 保兼容，GS/RDD/chain 全从 job.ts 消费（.ts 侧不再 import .vue 类型）', () => { const j = read('/shared/ai/job.ts'); const d = read('/newtab/components/AiSuggestionDrawer.vue'); const g = read('/newtab/views/GlobalSettings.vue'); return j.includes('export interface AiJob') && d.includes("export type { AiRow, AiJob } from '@/shared/ai/job'") && g.includes("import type { AiJob, AiRow } from '@/shared/ai/job'"); });
check('R135-7 拆解采纳语义 · R166 定案 1/8 重写：步骤去向从"建子任务卡"改为"写本卡内嵌 subtasks 清单" ⇒ 继承 projectId/metricId 与回写 metric.taskIds 三条语义整体退役（子任务不进任务池/指标/看板/周报）；查重从"全库同名"收窄为"本卡同名"（跨任务重名是正常事）；行动方案行替换式写入描述一字未松', () => { const c = read('/shared/ai/chain.ts'); return c.includes("t.subtasks.push({ id: uid('st'), title: s.name, done: false })") && c.includes('if (t.subtasks.some(x => x.title === s.name)) { dup++; continue }') && !c.includes('const step = mkTask(s, t.projectId, t.metricId, t.id)') && !c.includes('m.taskIds.push(step.id)') && !codeOnly(c).includes('parentId') && c.includes("replace(/\\n*🤖 行动方案：[\\s\\S]*$/, '')"); });
check('R135-8 创建走 store 既有通道优先：ctx.addProject 传入 compass.addProjectToDir（R85 四出口合一），缺省才本地同形创建；采纳回报含同名跳过计数', () => { const c = read('/shared/ai/chain.ts'); const t = CT_ALL; return c.includes('if (ctx.addProject) ctx.addProject(anchorId, s.name)') && c.includes('同名跳过') && t.includes('addProject: (id, name) => addProjectToDir(id, name)'); });

// ============== R136 · V2.104.0：批次 F 第三刀 A3 按目标选卡 + 1d 搜索意图重排 ==============
console.log('【R136 · V2.104.0：A3 应用推荐 + 1d 自然语言搜索重排】');
check('R136-1 ★入口 chunk 守卫：GlobalPopups 按需挂载（R160-P1 起 defineAsyncComponent + 首次呼出才挂载），其 AI 依赖全懒（零静态 import @/shared/ai 运行时，R158 起豁免 registry 纯声明——零依赖静态常量可进入口 chunk），检索函数段零写库（无 persist/无 mountedResourceIds 写入），改词与换类型 tab 即清态 · R150 备案：函数改名 aiSearchRun（「AI 理解」并入「AI 检索」），守卫逐条随迁', () => { const g = read('/newtab/components/GlobalPopups.vue'); const seg = segOf(g, 'async function aiSearchRun', 'const aiTopRows'); const gNoReg = g.replace(/from '@\/shared\/ai\/jobs\/registry'/g, ''); return !gNoReg.includes("from '@/shared/ai/") && g.includes("import('@/shared/ai/select')") && !seg.includes('persist') && !seg.includes('mountedResourceIds') && g.includes("watch(searchQuery, () => { aiSearch.value = null; aiAbort(''); recordedQ = '' })") && g.includes("watch(currentType, () => { aiSearch.value = null; aiAbort('') })") && g.includes('aiAbortCtl.abort()'); });
check('R136-2（R162 重指：推荐挂载任务书随任务↔资源挂载退役）buildRecommendJob/recommendSystem 全仓零命中；检索任务书契约仍在（HIT_CAP=8 + 消毒账）', () => { const s = read('/shared/ai/scenarios.ts'); const j = read('/shared/ai/select.ts'); return !s.includes('你是用户的资源调度参谋') && !s.includes('export const recommendSystem') && !j.includes('buildRecommendJob') && j.includes('const HIT_CAP = 8') && j.includes('searchDropCount += dropped'); });
check('R136-3 检索契约与消毒（R150 起为 semanticSearch）：只回读——id 必须属于给定候选集、≤8 条、同 id 取高分不重复、why 截 40 字、note 截 40 字；候选<2 或空查询拒跑；丢弃条数计入消毒账', () => { const j = read('/shared/ai/select.ts'); const g = read('/newtab/components/GlobalPopups.vue'); return j.includes('!valid.has(id)') && j.includes('const HIT_CAP = 8') && j.includes(".slice(0, 40)") && j.includes('searchDropCount += dropped') && j.includes("if (c0) { if (hit.confidence > c0.confidence) Object.assign(c0, hit); continue }") && g.includes('cands.length < 2'); });
check('R136-4（R162 重指）任务抽屉 AI 入口（拆解；推荐卡随挂载退役）+ 搜索面板「AI 检索」钮与 AI 置顶组', () => { const td = read('/newtab/components/compass/TaskDetailDrawer.vue'); const g = read('/newtab/components/GlobalPopups.vue'); return td.includes('aiBreakdown') && td.includes('AiEntryButton') && !td.includes('推荐卡') && g.includes('gp-ai-tab') && g.includes('aiSearchRun') && g.includes("'AI 检索'") && g.includes(':spin="aiBusy"') && g.includes('v-if="aiTopRows.length && !isBrowseMode"'); });
check('R136-5 卡目录投料纪律：cardDirectory 过滤软删、排除已挂载、上限=深度档 cards×2（eco60/std120/deep300 行封顶）', () => { const p = read('/shared/ai/project.ts'); return p.includes('export function cardDirectory') && p.includes('if (r.deletedAt || opts.excludeIds?.has(r.id)) continue') && p.includes('lines.length >= c.cards * 2'); });

// ============== R137 · V2.105.0：批次 F 第四刀 库内治理扫描包（标签体检/捞回/镜像/漂移）+ 角色库 v1 ==============
console.log('【R137 · V2.105.0：治理扫描包 + 角色库 v1】');
check('R137-1 ★标签治理采纳纪律：merges/rehome 双动作——from/to/tag/toParent 必须对「真实在用标签 + 标签树路径」校验（parse 消毒），采纳三卡 tags 全量双口径替换（from 与 leaf(from) 并除）+ 路径去重', () => { const g = read('/shared/ai/govern.ts'); return g.includes('const from = findTagIn(usedTags, m?.from); const to = findTagIn(known, m?.to)') && g.includes('const toParent = findTagIn(treePaths, rh?.toParent)') && g.includes('const drop = { noContract: 0, notInUse: 0, notInTree: 0, self: 0 }') && g.includes('audit: () =>') /* R152 备案：原锚是精确匹配 usedTags.has(from)——真机上模型写 #标签名 就整批静默丢，改成"剥 #/剥次数尾巴/双口径归一后回查库里的真名"，且丢掉多少必须报账 */ && g.includes('const kept = x.tags.filter(t => t !== from && t !== fromLeaf)') && g.includes('x.tags = [...new Set(kept.concat(to))]') && g.includes('x.tags.filter(t => t !== tag).concat(newPath)'); });
check('R137-2 标签树真操作：合并=按路径 findTagNode 剪枝 splice；归位=节点摘除挂到父节点 children（父不存在或标签已在树外时补建叶子节点），全部现场改 d.tagTree 后一次 persist', () => { const g = read('/shared/ai/govern.ts'); return g.includes('function findTagNode') && g.includes('hit.siblings.splice(hit.index, 1)') && g.includes('parent.siblings[parent.index].children!.push(moved)') && g.includes('ctx.persist()'); });
check('R137-3 捞回语义保守：recover=deletedAt 置空（与手工恢复同字段）；purge 只回报不动刀（真清空仍归回收站手动操作）', () => { const g = read('/shared/ai/govern.ts'); return g.includes('card.deletedAt = undefined') && g.includes('else if (v.verdict === \'purge\') pur++') && g.includes('建议清除') && !g.includes('purgeCards'); });
check('R137-4 镜像采纳走 hub 单一通道：projectCardToBoard（src 必须在资源台、dst 取其所在台；重复镜像由 hub 内部幂等）+ 主题漂移 adoptable=false 纯只读', () => { const g = read('/shared/ai/govern.ts'); return g.includes('projectCardToBoard(d, srcId, toWs)') && g.includes("r.workspaceId === 'zy-curation'") && g.includes('adoptable: false') && g.includes('export function buildThesisJob'); });
check('R137-5 角色库 v1：config.customPersonas 持久层 + allPersonas() 内置∪自建合成 + GS 增删表单（custom- id 前缀锚）+ 诊断采纳=建未归属任务卡', () => { const c = read('/shared/ai/config.ts'); const s = read('/shared/ai/scenarios.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return c.includes('customPersonas: AiCustomPersona[]') && s.includes('export function allPersonas') && g.includes('aiAddPersona') && g.includes("id: 'custom-' + Date.now()") && g.includes('aiRemovePersona') && g.includes('已生成') && g.includes('dd.tasks.unshift('); });
check('R137-6（R155-⑤ 备案：入口组件化 + 「🤖 值得捞回」徽标已 SVG 化）治理四入口 + 契约：标签体检钮在标签管理页头、库内治理卡三钮（跨台镜像/主题漂移/回收站捞回）、RecycleBin 页头「值得捞回」+ 抽屉挂载；四系统提示词全走 withAboutMe', () => { const g = read('/newtab/views/GlobalSettings.vue'); const rb = read('/newtab/views/RecycleBin.vue'); const sc = read('/shared/ai/scenarios.ts'); return g.includes('标签体检') && g.includes('AiEntryButton') && g.includes('aiCrossDeck') && g.includes('aiThesisDrift') && g.includes('aiTrashRescue') && rb.includes('值得捞回') && rb.includes('AiEntryButton') && rb.includes('<AiSuggestionDrawer v-if="aiJob"') && sc.includes('知识管理专家，为用户的标签体系做治理体检') && sc.includes('回收站管理员') && sc.includes('跨工作台策展人') && sc.includes('主题策展人'); });
check('R137-7 治理投影纪律：四投影均走 CAP 深度档上限（标签 top list*2 / 回收站 cards / 卡目录 cards*2 / 主题样本 titles），无 deletedAt 卡漏进正向清单、无附件字段', () => { const p = read('/shared/ai/project.ts'); const i1 = p.indexOf('projectTagSystem'); const seg = p.slice(i1, p.indexOf('整库摘要')); return seg.includes('slice(0, c.list * 2)') && seg.includes('filter(r => r.deletedAt)') && seg.includes('c.cards * 2') && seg.includes('cards.filter(r => !r.isThesis).slice(0, c.titles)') && !seg.includes('asset'); });

// ============== R138 · V2.106.0：批次 F 收尾刀 提效包（C1′ 智能录入 / F2′ 周回顾 / H3 导入归类 / H1′ 采集后补全） ==============
console.log('【R138 · V2.106.0：提效收尾包】');
check('R138-1 ★入口 chunk 守卫再扩：GP 的采集后补全全懒（AiDrawerGP defineAsyncComponent + config/select 双 dynamic import），保存主流程零 AI 依赖、不勾不跑（R158 起豁免 registry 纯声明）', () => { const g = read('/newtab/components/GlobalPopups.vue'); const gNoReg = g.replace(/from '@\/shared\/ai\/jobs\/registry'/g, ''); return !gNoReg.includes("from '@/shared/ai/") && g.includes("defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))") && g.includes("import('@/shared/ai/config')") && g.includes("import('@/shared/ai/select')") && g.includes('if (capEnrichOn.value) void runCardEnrich(r)'); });
check('R138-2（R155-⑤ 备案：入口组件化）C1′ 一句话录入：TaskAddDrawer 录入行 + buildTaskParseJob 回填表单（不落库），建卡仍由用户确认；草稿扩展字段 dueDate/estimatedMinutes/归属并入 createTask，props 锁定时归属不覆盖', () => { const t = read('/newtab/components/TaskAddDrawer.vue'); return t.includes('AI 填表') && t.includes('AiEntryButton') && t.includes('aiBusy') && t.includes('buildTaskParseJob') && t.includes('核对后点「创建」') && t.includes('projectId: props.projectId || aiDraft.value.projectId') && t.includes('dueDate: aiDraft.value.dueDate') && t.includes('findMetric(task.metricId)'); });
check('R138-3 H1′ 采集补全工厂（R167 重指：buildCardEnrichJob 与 buildFullOptimizeJob 并成一枚 buildResourceEnrichJob，采集浮层与详情/卡面走同一工厂）：同契约同消毒（sanitizeRefs+分类存在校验），apply 直接落库（标签并入≤10/描述只补空/卡已删拒写）；开关状态持久化 captureEnrich', () => { const s = read('/shared/ai/select.ts'); const g = read('/newtab/components/GlobalPopups.vue'); return s.includes('export function buildResourceEnrichJob') && s.includes('⚠ 卡片已不存在，未写入') && s.includes('ctx.d.categories.some(c => c.id === s.categoryId') && g.includes('m.patchAiConfig({ captureEnrich: on })') && g.includes('保存后补全') && g.includes('buildResourceEnrichJob') && g.includes('AiMark'); });
check('R138-4 F2′ 周回顾：AiJob.rawText 叙事模式（抽屉跳 JSON 提取直传原文），reviewSystem 四段 markdown 契约，采纳=存为「🗓 每周回顾」资源卡（不动既有数据）；投影=近 7 天台账', () => { const j = read('/shared/ai/job.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); const s = read('/shared/ai/select.ts'); const p = read('/shared/ai/project.ts'); return j.includes('rawText?: boolean') && w.includes('job.rawText ? false : jsonMode !== false') && w.includes('job.rawText ? text : extractJson(text)') && s.includes('export function buildReviewJob') && s.includes('reviewSystem()') && p.includes('export function projectWeekDigest') && p.includes('7 * 86400000'); });
check('R138-5 H3 书签导入归类：aiTtEnrich 泛型化为 aiEnrichIds(ids) · R154 备案（E3）：导入完不再自动弹评审抽屉（抢焦点、用户没点过它），改攒 pendingImportEnrich + 回执上显式入口', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('function aiTtEnrich() { aiEnrichIds(ttPicked.value) }') && g.includes('function aiEnrichIds(ids: Set<string>)') && g.includes('if (ids.length) pendingImportEnrich.value = ids') && g.includes('function aiImportEnrichNow()'); });
check('R138-6 治理工具箱四钮齐（跨台镜像/主题漂移/捞回/本周回顾）+ 任务候选清单投影 projectTaskTargets（metric 每项目≤4、archived 全排除）★G1(V3.8.24)随迁带备案：🗓 前缀迁 <Icon name="calendar">，锚点随迁', () => { const g = read('/newtab/views/GlobalSettings.vue'); const p = read('/shared/ai/project.ts'); return g.includes('<Icon name="calendar" :size="13"/> 本周回顾') && g.includes('aiWeeklyReview') && p.includes('export function projectTaskTargets') && p.includes('p.metrics.slice(0, 4)') && p.includes("if (dir.status === 'archived') continue"); });

// ============== R139 · V2.107.0：实测整改刀（图标定稿 + 拆解双通道/专家执笔 + 周报深度洞察） ==============
console.log('【R139 · V2.107.0：实测整改刀】');
check('R139-1 ★主攻图标定稿（🚀=主攻、🎯 只留指标、📦=项目）★R3-B1 随宿主改靶 + ★G1(V3.8.24)随迁带备案：主攻徽/菜单/toast/浮层文案的 🚀 前缀全部迁 <Icon name="main-focus"> 或删为纯文本，锚点随迁：树卡头 tw-badge→<Icon name="main-focus">、菜单「设为主攻」纯文本、ProjectCuration「已设为主攻」纯文本、GlobalPopups text 纯文本：主航线行卡徽随退役消失，方向台侧改判树卡头 tp-mark 与 ▾ 菜单文案；⚑ 全站绝迹且 >🎯 主攻 不再出现', () => { const pc = read('/newtab/views/ProjectCuration.vue'); const gp = read('/newtab/components/GlobalPopups.vue'); const ct = CT_ALL; return ct.includes('class="tw-badge focus" title="主攻项目"><Icon name="main-focus" :size="13"/> 主攻') && ct.includes('设为主攻') && pc.includes('已设为主攻，同步今日行动') && gp.includes("text: '主攻'") && !ct.includes('⚑') && !pc.includes('>🎯 主攻'); });
check('R139-2 拆解双通道：AiJob.secondary=同批勾选行的另一种落法；breakdown 次采纳把勾选步骤合并成 🤖 步骤清单 写进任务描述（替换段重复采纳不堆积、plan 行不入清单、原任务被删拒写），主通道建子任务不动', () => { const j = read('/shared/ai/job.ts'); const c = read('/shared/ai/chain.ts'); return j.includes('secondary?: { label: string') && c.includes("job.secondary = { label: '📝 步骤写进详情'") && c.includes('function writeStepsToTask') && c.includes('🤖 步骤清单：') && c.includes('⚠ 原任务已不存在，未写入') && c.includes('__plan') && c.includes('applyChain(level, anchorId, ctx, rows)') && j.includes('adoptLabel?: string') && c.includes("job.adoptLabel = '✓ 采纳为子任务'") && read('/newtab/components/AiSuggestionDrawer.vue').includes('cur.value?.adoptLabel'); });
check('R139-3 拆解专家执笔：chainSystem 收 personaText（有则替换默认执行教练角色为执笔人设）；chainPersonaText 合成内置∪自建专家 brief+focus+风格覆盖（default/查无回落空串）；breakdown 挂 persona 下拉，宿主 onPersona 重建 job 自动重跑', () => { const s = read('/shared/ai/scenarios.ts'); const c = read('/shared/ai/chain.ts'); const td = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('export function chainSystem(level: ChainLevel, personaText?: string)') && s.includes('export function chainPersonaText') && s.includes('你的行文风格') && c.includes('chainSystem(level, personaText)') && c.includes('current: ctx.personaId') && td.includes('aiPersonaId') && td.includes('const self = () => void runAi(kind, subId)') && (td.match(/onPersona: \(id\) => \{ aiPersonaId.value = id; self\(\) \}/g) || []).length === 3 /* R166：三入口共用 runAi(kind)，换专家仍必重跑 */; });
check('R139-4 ★AI 栈懒接入红线（R172-T9/T11 两次重指带备案）：宿主由周报浮层改指仪表盘复盘段 `ReviewPanel.vue` —— 复盘段对 `@/shared/ai` **只允许 `import type`**（类型编译期即消失，R135-5 同族口径），运行时一律 dynamic import；T11 落地后弹框必须是 defineAsyncComponent + v-if（不开不下载不实例化）；`buildInsightJob` 与 `deepInsightSystem` 场景提示词仍在用（rawText 四段契约 / adoptable:false 且无 apply / tags 走 withReport 第三参）', () => { const rp = codeOnly(read('/newtab/components/dashboard/ReviewPanel.vue')); const s = read('/shared/ai/select.ts'); const sc = read('/shared/ai/scenarios.ts'); return !/^\s*import \{[^}]*\} from '@\/shared\/ai\//m.test(rp) && rp.includes("import type { ReviewReport, ReviewSug } from '@/shared/ai/review'") && rp.includes("const ReviewReportModal = defineAsyncComponent(() => import('./ReviewReportModal.vue'))") && rp.includes("await import('@/shared/ai/review')") && rp.includes("v-if=\"repOpen\"") && s.includes('export function buildInsightJob') && sc.includes('deepInsightSystem') && sc.includes('## 重心体检') && /export function buildInsightJob[\s\S]*?adoptable: false[\s\S]*?\['深度洞察'\]/.test(s) && !/export function buildInsightJob[\s\S]{0,1400}?apply:/.test(s); });
check('R139-5 周台账投影扩容：projectWeekDigest 新增本周调用分布（按工作台聚合、top6）与 isFocused 主攻投入对照（≤3 个：进度/未完成/本周完成/停滞），作重心偏离证据段；主攻无卡可设时该段整体缺席', () => { const p = read('/shared/ai/project.ts'); return p.includes('【本周调用分布（按工作台）】') && p.includes('【主攻项目投入对照】') && p.includes('p.isFocused') && p.includes('slice(0, 3)') && p.includes('slice(0, 6)'); });
check('R139-6 评审抽屉双控件：footer 次采纳按钮（label 由 job 给、勾选 0 禁用、走 adoptSecondary 复用 picked 集）+ persona 下拉（options/current/onPick 三段，宿主重建 job 即 watch 重跑；R141 已上移抽屉头部）· R148 备案：契约对象统一走 cur（后台模式下必须显示**正在跑的那份 job**，不能拿新锚点的表头配旧结果', () => { const w = read('/newtab/components/AiSuggestionDrawer.vue'); return w.includes('async function adoptSecondary()') && w.includes('job.secondary.apply(sel)') && w.includes('v-if="cur?.secondary && vRows.length"') && w.includes('class="ai-persona"') && w.includes('cur.persona!.onPick'); });

// ============== R140 · V2.108.0：网页内容智能分析 + 诊断可用性与专家编辑 ==============
console.log('【R140 · V2.108.0：网页内容智能分析 + 专家编辑面】');
check('R140-1 ★linkFetch 纪律（用户拍板三则）：仅 http(s) 白名单、抓取只在点击进 job build 时发生、会话 Map 缓存去重；10s 超时+credentials omit、正文截 1500 字、失败/非文本全降级为 note（分析照常）', () => { const f = read('/shared/ai/linkFetch.ts'); return f.includes('export function linkFetchable') && f.includes('/^https?:\\/\\//i.test(url)') && f.includes('const cache = new Map<string, LinkText>()') && f.includes('credentials: \'omit\'') && f.includes('FETCH_TIMEOUT_MS = 10000') && f.includes('MAX_CHARS = 1500') && f.includes('script,style,noscript') && f.includes('main,article') && f.includes('暂不读取正文'); });
check('R140-2 全方位优化契约与工厂（R167 重指：并成 buildResourceEnrichJob 一枚，"抓正文"从独立入口变成这一枚的前置动作）：fullOptimizeSystem（这是什么·何时用·收藏理由须有正文据，读不到标（未读正文），不许编造）；工厂在 build 时抓正文、出 标题/描述/标签/分类 行（tags≤4 不与已有重复），已填字段只给 optIn 建议默认不勾，apply 二次校验卡在且未删才写+一次 persist', () => { const s = read('/shared/ai/scenarios.ts'); const j = read('/shared/ai/select.ts'); return s.includes('不许编造正文里没有的功能') && s.includes('（未读正文）') && s.includes('收藏理由') && j.includes('export function buildResourceEnrichJob') && j.includes('await fetchLinkText(card.link!)') && j.includes('.slice(0, 4)') && j.includes('非 http(s) 网页链接，不抓取正文') && j.includes('⚠ 卡片已不存在，未写入') && j.includes('optIn: true'); });
check('R140-3 ★Workspace hover 入口组件化零破线：宿主物理行数 ≤1500 仍成立（裸 fs 读，聚合 read 不含糊）+ <CardAiEntry> 原位挂非镜像动作条；组件 AI 依赖全懒（零静态 @/shared/ai、抽屉 defineAsyncComponent、点击时 import config/select）', () => {
  const ws = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const ca = read('/newtab/components/CardAiEntry.vue');
  return ws.split('\n').length <= 1500
    /* V3.9.8：Workspace 的旧三视图动作条已退役；资源池列表/网格是现役
       CardAiEntry 宿主。两处模板都要有，且池面板不能把 AI 入口降成裸图标。 */
    && pool.includes('<CardAiEntry v-if="!batchMode" :card="r" />')
    && pool.includes('<CardAiEntry :card="r" />')
    && !ca.includes("from '@/shared/ai/")
    && ca.includes("import { AiDrawer } from './lazyAiDrawer'")
    && fs.readFileSync(base + '/newtab/components/lazyAiDrawer.ts', 'utf8').includes("defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))")
    && ca.includes("import('@/shared/ai/select')");
});
check('R140-4 资源 AI 入口复用 select 工厂 · R154 备案（拍板①）：采纳=直接写库（apply 只包一层把表单同步成已落库值），旧「回填表单等二次保存」语义退役 · R165-A 备案：入口由页脚升标题行、「分析（读网页）」更名「AI 优化」 · R167 重指：两枚入口（↻ 重新补全 / 关联任务）整体搬进共享 ResourceAiStrip，内联抽屉与 App 级抽屉挂同一组件——写入口若再分叉，这条就会红', () => { const st = read('/newtab/components/ResourceAiStrip.vue'); const r = read('/newtab/components/ResourceDetailDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); return st.includes("run('enrich')") && st.includes('buildResourceEnrichJob(card, ctx)') && st.includes('j.apply = (rows: AiRow[])') && st.includes('const base = j.apply') && st.includes("'↻ 重新补全' : 'AI 补全'") && st.includes("busy.value = kind") && st.includes('if (busy.value) return') && r.includes('<ResourceAiStrip') && w.includes('<ResourceAiStrip') && !r.includes('buildFullOptimizeJob') && !w.includes('buildFullOptimizeJob'); });
check('R140-5 专家编辑面：⚙ 行内展开（启停+风格覆盖 upsert 进 personas[]；停诊同步移出本轮勾选）+ 自建专家名称/人设/关注面可改（空名拒）；拆解下拉与执笔文本都尊重启停（disabled 回落内置角色）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const c = read('/shared/ai/chain.ts'); const s = read('/shared/ai/scenarios.ts'); return g.includes('function aiPatchPersona(id: string') && g.includes('function aiCustomPatch(id: string') && g.includes('专家名不能为空') && g.includes('ai-guide') && c.includes('allPersonas().filter(p => ov[p.id]?.enabled !== false)') && s.includes('if (ov[pid]?.enabled === false) return'); });
check('R140-6 手册 AI 章节（ai-1 入口地图+硬纪律+认知协作者定位）+ 周报口径边界更新（💡 洞察仍是规则引擎，AI 版需明示） · R151 备案：徽标由镂空「知」换 ✦ 四角星 · R152 备案：真机判可辨性不如表情，回退 🤖，两处锚点随之改（「知」仍留在品牌位）', () => { const m = read('/newtab/manual-data.ts'); return m.includes("id: 'ai-1'") && m.includes('认知协作者') && m.includes('密钥只存本机') && m.includes('入口地图') && m.includes('AI 复盘') /* R172-T11 重指带备案：深度洞察钮随浮层退役，AI 判断的新入口是复盘段「AI 复盘」文本报告弹框 */ && m.includes('🤖 徽标') && m.includes('品牌位'); });

// ============== R141 · V2.109.0：行为修正刀（解绑语义 + AI 抽屉上下文 + 就地改名） ==============
console.log('【R141 · V2.109.0：行为修正刀】');
check('R141-1 ★解绑/删除两语义统一真源 shared/utils/taskLinks.ts：挂载行只有 unbindTaskFromMetric（摘归属+detach 引用不删本体），本体软删只走 softDeleteTaskToTrash；CompassTree / 项目详情 / 项目全景 / 收容区均只解绑（★V3.9.22 重指：当前文案「解除指标关联，任务回任务池（真删除请进任务详情）」取代旧“从本指标移除”）', () => { const tl = read('/shared/utils/taskLinks.ts'); const ct = CT_ALL; const pdd = read('/newtab/components/ProjectDetailDrawer.vue'); return tl.includes('export function unbindTaskFromMetric') && tl.includes('export function softDeleteTaskToTrash')
    /* ★W11(V3.8.11)随迁带备案：解绑钮模板挂载点随任务行迁进 CompassLane，跨两层组件到父组件才拿到 task 对象，
       故承重处选父组件的 @unbind 接线 + 舱/指标卡的 emit 透传链（三段都在位才算能力未丢），
       不再是同文件内 @click.stop 直调。删掉任一段都会让 unbindTask 变成死代码——能力真丢。 */
    && ct.includes('@unbind="(tid) => { const t = d.tasks.find(x => x.id === tid); if (t) unbindTask(t) }"')
    && ct.includes("emit('unbind', t.id)") && ct.includes("emit('unbind', $event)")
    && !ct.includes("deleteNode('task'")
    && pdd.includes('title="解除指标关联，任务回任务池（真删除请进任务详情）"')
    && !pdd.includes('softDeleteTaskToTrash'); });
check('R141-2 ★软删引用闭环', () => { const tl = read('/shared/utils/taskLinks.ts'); const tm = read('/newtab/components/compass/TaskManagerPanel.vue'); return tl.includes('export function softDeleteTaskToTrash') && tm.includes('softDeleteTaskToTrash');  });
check('R141-3 统计口径防脏：AI 投影三处指标任务统计滤 deletedAt（罗盘链×2+周台账），删指标不再悬挂子任务（CompassTree deleteNode metric 分支清 metricId 回落未关联）', () => { const p = read('/shared/ai/project.ts'); const ct = CT_ALL; return (p.match(/t\.id === id && !t\.deletedAt/g) || []).length === 3 && ct.includes('removeCompassNode') && read('/shared/utils/compassCrud.ts').includes('if (!t.deletedAt && t.metricId === id)') && read('/shared/utils/compassCrud.ts').includes('t.metricId = undefined; t.updatedAt = Date.now()'); });
check('R141-4 AI 抽屉上下文三件套：AiJob.subject 处理对象标头（拆解/推荐/录入/回顾/洞察/优化全带）；AiRow.advisory 参谋行不进勾选（picked 初始化与全选剔除、计数走 adoptableN · R167 加剔 `optIn`——"AI 没把握"与"不替你改主意"是两件事，后者默认不勾但不该被叫低置信）；verdict.recommend=detail 时「写入详情」自动升主按钮（recDetail 互换 primary）', () => { const j = read('/shared/ai/job.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); const c = read('/shared/ai/chain.ts'); const s = read('/shared/ai/select.ts'); return j.includes('subject?: string') && j.includes('advisory?: boolean') && j.includes('optIn?: boolean') && w.includes("class=\"ai-subject\"") && w.includes("out.filter(r => !r.advisory && !r.weak && !r.optIn && r.changeType !== 'same')") && w.includes('adoptableN') && w.includes('{ primary: recDetail }') && c.includes("key: 'breakdown:verdict', badge: '参谋', advisory: true") && s.includes("key: 'verdict', badge: '参谋', advisory: true"); });
check('R141-5 默认执笔专家贯通：config.defaultPersona（设置 AI 页下拉只列未停诊专家）；拆解/四层生成/全方位优化宿主进入时未换过人即带入；persona 下拉上移抽屉头部（title-extra，running 期间也可换人重跑）', () => { const cf = read('/shared/ai/config.ts'); const g = read('/newtab/views/GlobalSettings.vue'); const td = read('/newtab/components/compass/TaskDetailDrawer.vue'); const ca = read('/newtab/components/CardAiEntry.vue'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); return cf.includes("defaultPersona: ''") && g.includes('patchAiConfig({ defaultPersona:') && td.includes('aiConfig.value.defaultPersona') && ca.includes('personaId: personaId.value') && w.includes('<template v-if="cur?.persona" #title-extra>') && !w.includes('v-if="job?.persona" class="ai-persona"'); });
check('R141-6（V3.9.8 随迁）策展画布就地改名：标题/说明双输入，Enter/blur 提交、Esc 取消，外部 editRequest 可拉起；同名查重与落库由 useCurationMindMap.renameNode 收口。旧 CatNodeName 分类宿主与金字塔 startCatRename 接线已退役', () => {
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const mind = read('/newtab/composables/useCurationMindMap.ts');
  const py = read('/newtab/composables/usePyramid.ts');
  return node.includes('class="mind-edit-title"')
    && node.includes('class="mind-edit-desc"')
    && node.includes('@keydown="onEditKeydown"') && node.includes('@blur="commitEdit"')
    && node.includes("if (e.key === 'Escape')")
    && node.includes("if (e.key === 'Enter' && !e.shiftKey && editingField.value === 'title')")
    && node.includes('watch(() => props.editRequestSeq')
    && mind.includes('function renameNode(cat: Category, raw: string)')
    && mind.includes("showToast('已存在同名分支，请换一个名称')")
    && mind.includes('cat.name = name') && mind.includes('persist()')
    && !py.includes('startCatRename(');
});

// ============== R142 · V2.110.0：评估体系刀（成熟度规则分 + 上行评级 + 内置专家可编辑） ==============
console.log('【R142 · V2.110.0：评估体系刀】');
check('R142-1 ★maturity.ts 规则引擎真源：taskMaturity 四维（可执行/可归属/弹药/新鲜度）→ A≥75/B≥55/C≥35/D 分级 + reasons 扣分清单；上行聚合 metricMaturity←任务均分、projectMaturity←指标、directionMaturity←项目；全链滤 deletedAt、零 fetch/零 storage（纯本地即时评）', () => { const m = read('/shared/utils/maturity.ts'); return m.includes('export function taskMaturity') && m.includes("s >= 75 ? 'A' : s >= 55 ? 'B' : s >= 35 ? 'C' : 'D'") && m.includes('export function metricMaturity') && m.includes('export function projectMaturity') && m.includes('export function directionMaturity') && m.includes('!t.deletedAt') && !m.includes('fetch(') && !m.includes('chrome.storage'); });
check('R142-2 成熟度徽标全视图落位', () => { const tm = read('/newtab/components/compass/TaskManagerPanel.vue'); const ct = CT_ALL; const td = read('/newtab/components/compass/TaskDetailDrawer.vue'); const h = read('/newtab/views/CompassHome.vue'); return tm.includes('MaturityBadge') && ct.includes('MaturityBadge') && td.includes('MaturityBadge') && (h.match(/MaturityBadge/g) || []).length >= 1;  });
check('R142-3（R165 重指）MountCountBadge 随卡间挂载全量退役：组件文件已删 + 五宿主零引用', () => { const fsx = require('fs'); const gone = !fsx.existsSync(path.resolve(base, 'newtab/components/MountCountBadge.vue')); const files = ['newtab/views/CompassTree.vue', 'newtab/components/compass/TaskManagerPanel.vue', 'newtab/views/CompassHome.vue', 'newtab/views/ProjectCuration.vue', 'newtab/components/ProjectDetailDrawer.vue']; return gone && files.every(f => !read('/' + f).includes('MountCountBadge')); });
check('R142-4（R165 重指）好奇「挂载资源」随卡间挂载全量退役：relatedResourceIds / curioRel* / curioResIds 全链零命中（面板 / 成熟度 / 转卡）', () => { const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const m = read('/shared/utils/maturity.ts'); const cs = read('/newtab/stores/curiosity.ts'); return !cp.includes('toggleCurioRel') && !cp.includes('relatedResourceIds') && !m.includes('curioResIds') && !m.includes('curioRelated') && !cs.includes('mountedResourceIds') && !cs.includes('relatedResourceIds'); });
check('R142-5 内置两员可编辑（反馈 #6）：AiPersonaCfg.brief/focus 覆盖字段 + personaOverrides 透传 + allPersonas 合并（空=回落内置默认）；GS ⚙ 面板 textarea 就地改 + 「↺ 恢复内置默认」；会诊/执笔/下拉全消费合并后名单（诊断与 chainPersonaText 同源自动生效）', () => { const cf = read('/shared/ai/config.ts'); const s = read('/shared/ai/scenarios.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return cf.includes('brief?: string; focus?: string') && s.includes('brief: o.brief?.trim() || p.brief') && g.includes('恢复内置默认') && g.includes('aiPatchPersona(p.id, { brief:') && g.includes('aiPatchPersona(p.id, { focus:'); });
check('R142-6 手册 ai-2「成熟度徽标」节（A/B/C/D 语义 + 上行评级 + 规则分与 AI 深看分工）', () => { const m = read('/newtab/manual-data.ts'); return m.includes("id: 'ai-2'") && m.includes('A 就绪') && m.includes('D 空壳') && m.includes('上行评级') && m.includes('AI 深看'); });

// ============== R143 · V2.111.0：标签整体梳理刀（盘点→蓝图→全卡打标 + 快照还原） ==============
console.log('【R143 · V2.111.0：标签整体梳理刀】');
check('R143-1 ★蓝图契约与消毒双保险：提示词写死金字塔硬约束（顶层5~9/两级封顶/全树≤40/每标签收卡定义/旧标签必映射）；sanitizeBlueprint 再消毒——名≤12去重、顶层≤10子≤6、trimTree 砍到≤40、mapping from 必须在用标签、to 必须在新树路径', () => { const s = read('/shared/ai/scenarios.ts'); const g = read('/shared/ai/govern.ts'); return s.includes('5~9 个') && s.includes('全树合计 ≤40') && g.includes('function sanitizeBlueprint') && g.includes('function trimTree') && g.includes('const from = findTagIn(usedTags, m?.from); const to = findTagIn(paths, m?.to)') /* R152 备案：原锚是精确匹配；蓝图与体检同批改用"剥 #/双口径归一后回查真名"，模型写法对不上时不再静默丢 */ && g.includes('if (!from || !to || mseen.has(from)) continue') /* R152：to 不再要求逐字命中路径——归一后回查真路径，写法差一点也能落对架子 */; });
check('R143-2 ★快照与还原闭环：蓝图采纳前 saveTagReviseBackup 写 zy_tagrevise_backup_v1（旧树 + 三类活卡旧 tags 与描述，独立键不进导出数据链）；还原=回树+回写卡 tags/描述+删备份键+一次 persist；页头「↺ 还原上次梳理」仅备份存在时显示（进 tags 页探测） · R151 备案：描述也进快照（阶段③会写描述，只存 tags 的还原不等价），还原同样 +1 树版本戳', () => { const g = read('/shared/ai/govern.ts'); const gs = read('/newtab/views/GlobalSettings.vue'); return g.includes('export const TAG_REVISE_BACKUP_KEY = K.TAGREVISE_BACKUP') && g.includes('await saveTagReviseBackup(ctx.d)') && g.includes("cardTags[x.id] = { tags: [...(x.tags || [])], description: x.description || '' }") && g.includes('chrome.storage.local.remove(TAG_REVISE_BACKUP_KEY)') && g.includes('d.tagTreeRevision = (d.tagTreeRevision || 0) + 1') && g.includes('标签与描述全部回滚') && gs.includes('v-if="aiReviseBak"') && gs.includes("if (p === 'tags') void aiCheckReviseBak()"); });
check('R143-3 蓝图采纳语义：勾选顶层才建树（未勾顶层其映射整条作废）；树重建 TagNode+uid；映射级联三卡双口径（含 leaf 裸名）Set 去重 ≤10；adopted 旗标接力——抽屉关闭自动续开阶段③（consumeTagBlueprintAdopted 一次性消费）', () => { const g = read('/shared/ai/govern.ts'); const gs = read('/newtab/views/GlobalSettings.vue'); return g.includes('const valid = maps.filter(m => rootNames.has(String(m.to).split(\'/\')[0]))') && g.includes("blueprintAdoptedFlag = true") && g.includes('export function consumeTagBlueprintAdopted') && gs.includes('function aiJobClosed()') && gs.includes('buildTagAssignJob('); });
check('R143-4 ★归架门纪律（R151 改口径版）：每批 30 卡自动续批带进度；path 必须逐字在新树（消毒丢弃）否则行不成；空 path=保持无架不强塞；采纳一次 persist · R151 备案两处：① 候选从资源卡扩成三类卡（tagCards 统一读法 + findTagCard 三找）；② 描述**只填完全为空的卡**——不读正文后「救敷衍描述」没有依据，写回去等于让模型替用户编话', () => { const g = read('/shared/ai/govern.ts'); return g.includes('const BATCH = 30') && g.includes('if (!paths.has(path) && !canDesc) continue') && g.includes('const canDesc = !!desc && !card.description.trim()') && g.includes('const cards = tagCards(ctx.d)') && g.includes('第 ${bi + 1}/${batches} 批归架中') && g.includes('function findTagCard(') && !g.includes("trim().length < 10"); });
check('R143-5 → R151 证据边界改刀：整体梳理**不再抽读链接正文**（用户拍板：完全依据卡面字段）——蓝图 job 内 fetchLinkText/linkFetchable/reviseSnips 调用清零，projectTagBlueprint 去掉 snips 参数；台账改为三类卡全量不抽样并写明构成。SNIP_CAP/reviseSnips 作为 R144 批次 G 的地基必须留着（不许顺手删）', () => { const g = read('/shared/ai/govern.ts'); const p = read('/shared/ai/project.ts'); const bp = g.slice(g.indexOf('export function buildTagBlueprintJob'), g.indexOf('export function buildTagAssignJob')); return !bp.includes('fetchLinkText') && !bp.includes('linkFetchable') && !bp.includes('reviseSnips') && g.includes('const SNIP_CAP: Record<AiDepth, number> = { eco: 30, std: 60, deep: 150 }') && g.includes('const reviseSnips = new Map<string, string>()') && p.includes('export function projectTagBlueprint(d: AppData, depth: AiDepth): string') && p.includes('只用卡面字段，不读链接正文') && p.includes('资源 ${res.length} · 任务 ${tks.length} · 好奇 ${cus.length}'); });
check('R143-6 入口与定位文案：标签管理页头三钮并列（标签体检=小修补 / 整体梳理=推倒重建 / ↺ 还原）★G1(V3.8.24)随迁带备案：🧹 前缀删除，锚点随迁为 AiEntryButton label 纯文本；两阶段 job 均带 subject；<6 卡拒跑；手册 ai-1 入口地图收录 · R151 备案：拒跑判据从「资源卡数」改成三类卡合计（cards.length），subject 明写三卡构成', () => { const gs = read('/newtab/views/GlobalSettings.vue'); const g = read('/shared/ai/govern.ts'); const m = read('/newtab/manual-data.ts'); return gs.includes('label="整体梳理"') && gs.includes('aiTagGovern') && g.includes('if (cards.length < 6) return null') && g.includes('资源 ${byType.res} · 任务 ${byType.task} · 好奇 ${byType.curio}') && g.includes('标签整体梳理 ②·蓝图评审') && g.includes('标签整体梳理 ③·全卡归架') && m.includes('标签整体梳理'); });

// ============== R144 · V2.112.0：批次 G 四场景（论点/研判/佐证/文稿）+ 子任务软层级 ==============
