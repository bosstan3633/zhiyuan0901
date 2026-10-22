/**
 * R174-1 分片纪律的延续 · 98-r4-gates：V3.7.x 后半程的门禁/证据轮（R4-Dl ⌘K 面板进视觉门禁、
 * R4-Dm 路由拼法登记、R4-En content 浮层场景、R4-Ep 可选台列表单源、R4-Eq 用户可见文案退役名）。
 * 从 97-r3-rounds 尾部**原样搬出**（分片是搬运不是重写，断言零丢失）——搬的原因是 R4-Eq 的新断言把
 * 97 顶到 956 行，撞上 R164-2 的「每个分片 ≤900 行」刹车；按既有拍板处置是**加分片而不是放宽上限**。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, srcFileEntries, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, getSliceMisses, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');
// ============== R4-Dl ⌘K 面板进视觉门禁 + 截图可复现 ==============
console.log('【R4-Dl · 视觉门禁与确定性采样】');
check('R4-Dl ★⌘K 面板终于进了一次视觉门禁（id: gp-search）。此前这条链只有源码文本可见：面板真开、高亮真渲染、hover 才露出的那排动作钮、输入框有没有吃浏览器白底——这四件事在文本断言里都表现为"什么都没变"。判据必须核到这四件 + 面板越视口，只拍一张图不核即红', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const i = t.indexOf("id: 'gp-search'");
  const seg = t.slice(i, t.indexOf("\n  },", i) > 0 ? t.indexOf("\n  },", i) : i + 4000);
  /* ★判据只认 `const ok =` 那一段：这些锚点串在"打印明细"的模板里也出现一遍，
     整段 grep 会让"把判据从 ok 里删掉、只留明细"这种改动照样绿——H4 变异当场抓到的就是这个形状。 */
  const iOk = seg.indexOf('const ok =');
  const okExpr = seg.slice(iOk, seg.indexOf('return {', iOk));
  return i > 0 && iOk > 0 && okExpr.length > 40
    && seg.includes('.gp-overlay.open') && seg.includes('.gp-result-item') && seg.includes('.gp-search-input')
    && seg.includes('window.__gpHover')
    && seg.includes("document.querySelectorAll('mark.gp-hl')") && okExpr.includes('marks.length > 0') && okExpr.includes('markBg !== panelBg')
    && okExpr.includes('pr.width > 320') && okExpr.includes('!overflow') && okExpr.includes('op > 0.9')
    && okExpr.includes('rows > 0') && okExpr.includes('groups >= 1') && okExpr.includes('tabs >= 6')
    && okExpr.includes('hover.acts') && okExpr.includes('hover.vis >= 3') && okExpr.includes('panelBg ].includes(inputBg)');
});
check('R4-Dl ★hover 判据必须在 resetView 把鼠标挪走**之前**测完（act 内），且结果经 window.__gpHover 交给 judge：resetView 的鼠标归零是 R4-Dj 立的"可比性前提"，谁把 hover 类判据搬到截图前就必然测到未悬停态——那是"断言还在、证据已空"的又一个形状', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const iAct = t.indexOf("id: 'gp-search'");
  const seg = t.slice(iAct, t.indexOf('judge: async (page) => page.evaluate', iAct));
  return seg.includes(".locator('.gp-result-item').first().hover()") && seg.includes('window.__gpHover =') && iAct < t.indexOf('async function resetView');
});
check('R4-Dl ★收尾必须认得 ⌘K 浮层：主题/场景之间只切 hash 不重载页面，`overlayOpen` 不含 .gp-overlay.open 就会把开着的面板一路带进后面每一张台面图（污染证据且无人报错）；面板没有关闭钮，兜底点遮罩盒子左上角触发 @click.self（点中心会命中结果行、反而打开详情）', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const iO = t.indexOf('async function overlayOpen');
  const iC = t.indexOf('async function closeOverlays'); // ★B4 重指：原锚 iC+700 是定长窗口，函数开头一加行就把「点遮罩左上角」挤出去（假红与真红同形）⇒ 改按函数体切
  const iEnd = iC >= 0 ? t.indexOf('\n}', iC) : -1, cBody = iC >= 0 && iEnd > iC ? t.slice(iC, iEnd) : '';
  return /\.md-panel/.test(t.slice(iO, iO + 400))
    && /\.gp-overlay\.open/.test(t.slice(iO, iO + 400))
    /* ★W12(V3.8.12)随迁备案：原锚写死整串 `'.md-panel, .drawer, .gp-overlay.open'`，
       于是「往 overlayOpen 里加新一代弹窗壳」这个正确动作会让本条恒红 —— 而它红的样子
       与「⌘K 浮层收尾真丢了」一模一样。★写死整串的选择器列表 = 下一个弹窗壳的敌人。
       改为逐个点名必须存在的壳（钉语义不钉排列），新增壳不再撞本条，删掉任一壳仍会红。 */
    && /\.pi-rev-overlay/.test(t.slice(iO, iO + 400))
    && /\.dz-day-modal-overlay/.test(t.slice(iO, iO + 400))
    && iC > 0 && cBody.includes("locator('.gp-overlay.open').click({ position:")
    && cBody.includes('x: 6, y: 6');
});
check('R4-Dl ★截图可复现两闩在位且**可关**（逃生阀不是装饰：关掉它才量得出"没有它会怎样"，实测同码重采 13/24 → 24/24 字节一致）：① ctx.addInitScript 只冻无参 Date 与 Date.now()（带参 new Date(x) 原样透传，性能计时不碰）② resetView 注入 animation/transition:none 并跑完非循环动画（静照里没有"正在动"，留着只会让两次采样差在随机帧上，而 hover 露出这类终态判据不受影响）', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const iF = t.indexOf('if (FREEZE) await ctx.addInitScript');
  const segF = t.slice(iF, iF + 420);
  const iR = t.indexOf('async function resetView');
  const segR = t.slice(iR, t.indexOf('\n}', iR));
  return iF > 0 && segF.includes('window.Date = F') && segF.includes('if (a.length === 0) super(ms); else super(...a)') && segF.includes('static now() { return ms }')
    && t.includes("const FREEZE = !argv['no-freeze']") && t.includes("const CALM = !argv['no-calm']")
    && segR.includes('animation:none !important;transition:none !important') && segR.includes('if (calm && window.__ZY_CALM__ !== true)')
    && segR.includes('getAnimations') && segR.includes('a.finish()') && t.slice(iR, t.indexOf('}, CALM)', iR)).includes('(calm)');
});

// ============== R4-Dm 池实体不该冒充"台面"：路由拼法登记 + 采集下拉单源 ==============
console.log('【R4-Dm · 路由拼法登记与采集下拉】');
check('R4-Dm ★把「池卡不许拼出退役台面/死链」从字面量扫描升级成登记表：R2-④ 当年判的是"代码内 `/workspace/zy-curation` 字面量零残留"，而缺陷的实际形状是**变量拼出来的** `/workspace/${…}`——字面量扫描对它天生失明（所以它连漏两个入口：⌘K 转资源的「查看」、指标下钻抽屉的佐证行）。这张表每次现扫再比，多一处少一处都红，新增只能走算式或在提交里显式改表', () => {
  const REG = {
    'shared/utils/locate.ts': 1,                    // 唯一算式本体（resourceLocateRoute 的 else 分支）
    'newtab/App.vue': 3,                            // 台签 / 新建台后跳转 / 数字快捷键跳台：来源都是 store.workspaces getter（已过滤池）
    'newtab/components/GlobalPopups.vue': 3         // locateOnly 的池分支之后、ws 类型行、分类树定位：三处都在 !== CURATION_WS_ID 过滤之后
  };
  const root = path.resolve(SCRIPTS_DIR, '..', 'src');
  const found = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p2 = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p2); continue }
      if (!/\.(ts|vue)$/.test(e.name)) continue;
      const n = (stripComments(fs.readFileSync(p2, 'utf8')).match(/`[^`]*\/workspace\/\$\{/g) || []).length;
      if (n) found[path.relative(root, p2).split(path.sep).join('/')] = n;
    }
  })(root);
  const got = Object.keys(found).sort().join('|');
  const want = Object.keys(REG).sort().join('|');
  const countsOk = Object.keys(REG).every(k => found[k] === REG[k]);
  return got === want && countsOk && Object.keys(found).length === Object.keys(REG).length;
});
check('R4-Dm ★算式本体仍是唯一判池的地方：`resourceLocateRoute` 里那条 `=== CURATION_WS_ID` 必须在位且返回调度台 + `hk`；同时全站不许出现把 `/workspace/` 与池 id（字面量或 `${CURATION_WS_ID}`）拼在一起的写法——R2-④ 那条"字面量零残留"继续留着，这条补它看不见的另一半', () => {
  const loc = codeOnly(read('/shared/utils/locate.ts'));
  return loc.includes('workspaceId === CURATION_WS_ID') && loc.includes("path: '/deck/resource', query") && loc.includes('LOCATE_HK')
    && !read('/shared/utils/locate.ts').includes('/workspace/${CURATION_WS_ID}')
    && !codeOnly(read('/newtab/components/GlobalPopups.vue')).includes('/workspace/${CURATION_WS_ID}')
    && !codeOnly(read('/newtab/components/compass/MetricDrillDrawer.vue')).includes('/workspace/${');
});
check('R4-Dm ★采集浮层的「存入」不许再让隐藏池冒充一枚台面：R4-Dm 初版钉的是台/分类双下拉的单源与池项显示名（workspaces[0] 曾把退役实体名「资源台」印成默认项）；W4（V3.8.4）把这两枚下拉整体退役——统一入资源卡池，改静态 .zy-cap-pool 池提示行，落点在 saveCapture 里写死 CURATION_WS_ID。判据随之翻面：下拉结构不许回流（负锚），池提示行与入池写死是正锚（「存入」一栏仍在、回执仍带单源池名）。★R4-Ep 随迁带备案：选项文本单源的负锚改成「下拉已整体退役」这一条，池/分类/台名的第二份算式一律不许在消费者里重建', () => {
  /* W4（V3.8.4）随迁备案：本判据的旧形态（selectableWsOptions(d?.workspaces) / escapeHtml(o.label) /
     池项显示 POOL_DISPLAY_NAME 的下拉选项）随两枚下拉一并退役。取而代之的是三条：
     ① 负锚：#__zy_cap_ws__ / #__zy_cap_cat__ 两个 id 与 option-workspace 模板结构不许回流；
     ② 正锚：静态池提示行 .zy-cap-pool 在位（含 POOL_DISPLAY_NAME 文案）；
     ③ 正锚：saveCapture 落点写死 CURATION_WS_ID、categoryId 留空。
     三条一条不少，旧文案「存入台面」继续不许回流。 */
  const ov = codeOnly(read('/content/overlay-impl.ts'));
  return !ov.includes('__zy_cap_ws__') && !ov.includes('__zy_cap_cat__')
    && !/option value="\$\{escapeHtml\(w\.id\)\}"/.test(ov) && !ov.includes('selectableWsOptions(d?.workspaces)')
    && ov.includes('zy-cap-pool') && ov.includes('资源卡池')
    && ov.includes('workspaceId: CURATION_WS_ID') && ov.includes("categoryId: ''")
    && !ov.includes('存入台面</label>')
    && !ov.includes('workspaces?.filter((w: any) => !w.archived)');
});
check('R4-Dm ★"取 workspaces[0] 当默认落点"这一族形状必须逐处登记理由（R4-Pa/R4-Dk 两条实测都栽在它上面：默认库第一枚是「事业策展台」、存量库第一枚是隐藏池，同一个动作在两种库形状下落进不同的地方）：现扫条数与登记表不符即红', () => {
  const REG = {
    // 'content/overlay-impl.ts': 1 ← R4-Ep 摘除：采集面板的默认落点改由 selectableWsOptions 显式给池，这一族在这一处消失了
    'shared/storage/migration.ts': 2,  // V1 老数据导入兜底：v1 里没有池实体，取第一枚真台是导入语义而非新卡落点
    'newtab/views/RecycleBin.vue': 1   // 恢复时的兜底台，且前一项已显式 `w.id !== CURATION_WS_ID`
  };
  const root = path.resolve(SCRIPTS_DIR, '..', 'src');
  const found = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p2 = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p2); continue }
      if (!/\.(ts|vue)$/.test(e.name)) continue;
      const n = (stripComments(fs.readFileSync(p2, 'utf8')).match(/workspaces\[0\]/g) || []).length;
      if (n) found[path.relative(root, p2).split(path.sep).join('/')] = n;
    }
  })(root);
  return Object.keys(found).sort().join('|') === Object.keys(REG).sort().join('|')
    && Object.keys(REG).every(k => found[k] === REG[k])
    && !codeOnly(read('/newtab/components/GlobalPopups.vue')).includes('workspaces[0]')
    && !codeOnly(read('/newtab/components/compass/MetricDrillDrawer.vue')).includes('workspaces[0]');
});

// ============== R4-En content 浮层进视觉门禁（#115） ==============
console.log('【R4-En · content 浮层场景】');
check('R4-En ★两个 content 浮层终于有像素门禁：theme-audit 必须有 ov-capture（采集面板）与 ov-search（网页 ⌘K）两条场景，且都在**宿主页**上拍（浮层只注入 http/https 页，扩展页里拍到的是空文档），任一判据不过即非零退出。起因是 R4-Dm 在采集下拉里量出一枚本该不可达的退役台面「资源台」且它是默认项——那件事只有真开一次浮层看得见，而 e2e 驱动采集浮层 0 条、本脚本此前浮层场景 0 条。★W4（V3.8.4）随迁：采集面板的两枚下拉退役，就绪锚从 #__zy_cap_ws__ 换成保存钮 #__zy_cap_save__（msg 仍是 zy-open-capture，不变）。★B3（V3.8.28）重指带备案：图数下限里 `DASH_SCENES.length` 改为过滤后的 `dashScenes.length`（`--scenes` 过滤时原式必然假红），所守行为不变', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const i1 = t.indexOf("id: 'ov-capture'");
  const i2 = t.indexOf("id: 'ov-search'");
  return i1 > 0 && i2 > i1
    && t.includes("msg: 'zy-open-capture'") && t.includes("ready: '#__zy_cap_save__'")
    && t.includes("msg: 'zy-open-search'") && t.includes("ready: '#__zy_si__'")
    && t.includes('chrome.tabs.sendMessage') && t.includes('ovServer.listen')
    && t.includes('if (!ovPage) { ovPage = await ctx.newPage()')
    && t.includes('if (overlayFail.length)') && /overlayFail\.length\) \{\s*console\.log\(`❌ content 浮层判据未过/.test(t)
    && t.includes('dashScenes.length + OVERLAY_SCENES.length');
});
check('R4-En ★采集面板的判据钉的是形状不是条数：真实库里可见台可能只剩一枚（改前实测台选项=["资源卡池"]，其它台已归档），所以条数从来不是判据。★W4（V3.8.4）随迁：两枚下拉退役，判据从「选项文本非空 + 无退役名 + 池项显示单源名」翻面成「静态池提示行 .zy-cap-pool 在且含资源卡池 + 两个下拉 id 负锚不在」；同类控件底色只能有一种 + 浮层强调色与应用内 --accent 同值两条腿不动（它们守的是主题映射会漂这件事，与下拉存废无关）', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const i = t.indexOf("id: 'ov-capture'");
  const seg = t.slice(i, t.indexOf("id: 'ov-search'"));
  /* 切"逻辑那一段"而不是整段：段首有个 `if (!panel) return { ok: false, … }` 的早退分支，
     用 indexOf('return { ok') 会切到它前面、得到空串，而"切片为空"在 includes 下会恒真 */
  const iOk = seg.indexOf('const ok =')
  const okExpr = seg.slice(iOk, seg.lastIndexOf('return {'))
  return i > 0 && iOk > 0 && okExpr.length > 40
    && seg.includes("poolText.includes('资源卡池')") && seg.includes('wsGone') && seg.includes('catGone')
    && okExpr.includes('!!poolRow') && okExpr.includes('wsGone') && okExpr.includes('catGone')
    && okExpr.includes('bgs.length === 1') && okExpr.includes('accent === exp')
    && !okExpr.includes('opts.length >= 2')
    && seg.includes("document.getElementById('__zy_global_overlay__')");
});
check('R4-En ★网页 ⌘K 浮层的三条像素事实必须在位：真开 + 结果行 ≥1 + 高亮节点存在 + 输入框不吃白底（透明随面板或等于面板底色）+ 不越视口；检索词面从注入库里第一张卡的标题现取前 4 字——写死词会随库变化而搜不到，那一屏就退化成空态图而判据还会绿（R4-Dl 同一条纪律在浮层上的落地）', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const i = t.indexOf("id: 'ov-search'");
  const seg = t.slice(i, t.indexOf('\n]\n', i));
  const iOk = seg.indexOf('const ok =')
  const okExpr = seg.slice(iOk, seg.lastIndexOf('return {'))
  return i > 0 && iOk > 0 && okExpr.length > 40 && okExpr.includes('rows.length >= 1') && okExpr.includes('!!mark') && okExpr.includes("rgba(0, 0, 0, 0)")
    && okExpr.includes('pr.right <= window.innerWidth + 1') && okExpr.includes('accent === exp')
    && t.includes("const ovNeedle = ((data.resources || []).find(r => r && r.title) || {}).title")
    && t.includes(".replace(/\\s+/g, '').slice(0, 4)");
});

// ============== R4-Ep 「可选台列表」单源：池不再冒充台面（#116） ==============
console.log('【R4-Ep · 可选台列表单源与形态补盲】');
check('R4-Ep ★「用户可选台列表」只许有一处构造：selectableWsOptions 显式把池排第一（新资源卡的默认落点，与 R2-⑧ 池内新建 / R4-Dk 面板转化 / R4-Df3 报告卡同口径），boardWsOptions 显式排除池（批量移动只列策展台——把卡"移进池"会顺带造出一枚 workspaceId=zy-curation 的「待分类」分类，而池卡只由标签组织 R179）；三个消费者一律走单源，谁再从原始 d.workspaces 自己 filter 一份当列表即红', () => {
  const u = codeOnly(read('/shared/utils/wsName.ts'));
  const iSel = u.indexOf('export function selectableWsOptions');
  const iBr = u.indexOf('export function boardWsOptions');
  const bodySel = u.slice(iSel, iBr);
  const bodyBr = u.slice(iBr, u.indexOf('\n}', iBr));
  return iSel > 0 && iBr > iSel
    && bodySel.includes('{ id: CURATION_WS_ID, label: POOL_DISPLAY_NAME, pool: true }') && bodySel.includes('...boardWsOptions(workspaces)')
    && bodyBr.includes('w.id !== CURATION_WS_ID && !w.archived') && bodyBr.includes('wsNameWithIcon(w.icon, wsDisplayNameOf(w))')
    /* ★W4（V3.8.4）随迁：content 采集浮层的台/分类两枚下拉整体退役（统一入资源卡池，落点写死 CURATION_WS_ID），
       于是它不再是 selectableWsOptions 的消费者——单源的正锚改由应用内 CuriosityPanel 承接（那条下拉仍在）。
       overlay 侧改钉负锚：不许再自己 filter 原始数组当"可选台列表"。 */
    && codeOnly(read('/newtab/components/compass/CuriosityPanel.vue')).includes('selectableWsOptions(store.data!.workspaces)')
    && codeOnly(read('/newtab/composables/useWorkspaceBatch.ts')).includes('boardWsOptions(d.value.workspaces)')
    // 负判据（走 codeOnly，注释里留着历史说明）：三处都不许再自己 filter 原始数组当"可选台列表"
    && !codeOnly(read('/content/overlay-impl.ts')).includes('workspaces?.filter((w: any) => !w.archived)')
    && !codeOnly(read('/newtab/components/compass/CuriosityPanel.vue')).includes('workspaces.filter(w => !w.archived)')
    && !codeOnly(read('/newtab/composables/useWorkspaceBatch.ts')).includes('workspaces.filter(w => !w.archived)');
});
check('R4-Ep ★好奇心「归档为资源」弹窗的三处实测偏差必须一起修掉：/tmp/zy_ep_probe.cjs 在两种库形状下各真点一次——改前下拉的可选台由本组件自己从**原始 d.workspaces** filter，存量库第一枚是 R61 留下的 hub 实体 ⇒ 选项印「🗂 资源台」且是默认项（同一个动作落进池），新库没有那枚实体 ⇒ 默认落进「💼 事业策展台」，而回执两种形状下都写「已归档至「…」资源台」（存量库实测连印成「已归档至「🗂 资源台」资源台」，台名与硬后缀撞成两个旧世界词），标签还写「存入策展台」而可选项里含池。现要求：默认显式 CURATION_WS_ID、回执走 wsNameById 单源、标签改「存入位置」，旧拼法一律不许回流', () => {
  const c = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue'));
  const iOpen = c.indexOf('function openConvert(');
  const bodyOpen = c.slice(iOpen, c.indexOf('\n}', iOpen));
  const iConf = c.indexOf('function confirmConvert(');
  const bodyConf = c.slice(iConf, c.indexOf('} else {', iConf));
  return iOpen > 0 && bodyOpen.includes('convertWsId.value = CURATION_WS_ID') && !bodyOpen.includes('convWorkspaces.value[0]')
    && bodyConf.includes('wsNameById(store.data!.workspaces, convertWsId.value)') && bodyConf.includes('已归档至')
    && !bodyConf.includes('」资源台') && !bodyConf.includes('ws?.name')
    && c.includes('请选择存入位置') && !c.includes("showToast('请选择策展台'")
    && c.includes('<label class="cz-modal-label">存入位置</label>') && !c.includes('存入策展台</label>')
    && c.includes(':value="w.id">{{ w.label }}</option>');
});
check('R4-Ep ★"取第一枚实体当默认落点"这一族的扫描形态必须比 R4-Dm 那张表更宽：窄正则 workspaces[0] 对 **`convWorkspaces.value[0]`** 天生失明（别名与 .value 都不匹配），所以 R4-Dm 立表之后同一族又漏出第三个出口——本轮换成宽形态登记表（任何 *orkspaces[.value][数字] 取第 N 枚），现扫条数与表不符即红（多一处红、少一处也红；新增要么改代码要么在 diff 里写明理由）', () => {
  const REG = {
    'newtab/views/RecycleBin.vue': 1,   // 恢复时的兜底台，且前一项已显式 `w.id !== CURATION_WS_ID`
    'shared/storage/migration.ts': 2    // V1 老数据导入兜底：v1 里没有池实体，取第一枚真台是导入语义而非新卡落点
  };
  const root = path.resolve(SCRIPTS_DIR, '..', 'src');
  const found = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p2 = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p2); continue }
      if (!/\.(ts|vue)$/.test(e.name)) continue;
      const n = (stripComments(fs.readFileSync(p2, 'utf8')).match(/[A-Za-z_]*[Ww]orkspaces[A-Za-z_]*(?:\.value)?\[\s*\d+\s*\]/g) || []).length;
      if (n) found[path.relative(root, p2).split(path.sep).join('/')] = n;
    }
  })(root);
  return Object.keys(found).sort().join('|') === Object.keys(REG).sort().join('|')
    && Object.keys(REG).every(k => found[k] === REG[k])
    && !codeOnly(read('/newtab/components/compass/CuriosityPanel.vue')).includes('convWorkspaces.value[0]')
    && !codeOnly(read('/content/overlay-impl.ts')).includes('workspaces[0]');
});
check('R4-Ep ★V3.9.8 随迁：批量目标只列现役策展台，且语义是引用投射而非搬池卡——资源池批量栏与单卡镜像弹窗都排除池 / 归档台；Workspace 不再渲染旧“移动分类”弹窗。改前「目标策展台」下拉第一项是「🗂 资源台」，选中等于把卡移进池还顺带新建一枚池「待分类」', () => {
  const pool = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'));
  const mirror = codeOnly(read('/newtab/components/ResourceMirrorModal.vue'));
  const workspace = codeOnly(read('/newtab/views/Workspace.vue'));
  return pool.includes('const batchBoards = computed(() =>')
    && pool.includes("w.kind !== 'resource' && w.id !== CURATION_WS_ID && !w.archived")
    && pool.includes('v-for="w in batchBoards"')
    && pool.includes('源卡仍留在资源卡池；目标台只是新增引用')
    && mirror.includes("w.kind !== 'resource' && w.id !== CURATION_WS_ID && !w.archived")
    && mirror.includes('勾选 = 镜像过去 · 取消勾选 = 取消该台镜像')
    && !workspace.includes('moveWorkspaces')
    && !workspace.includes('moveModalOpen')
    && !workspace.includes('目标策展台（含当前策展台，可只换分类）');
});
check('R4-Ep ★运行时覆盖补一档：e2e 必须有 E2E-39 真点好奇心归档（存量库/新库两种形状各一次，读下拉选项文本与默认选中、回执 toast、落库 workspaceId）——"下拉印什么名、默认选谁"在源码文本断言里表现为什么都没变，而它是用户每天点的动作', () => {
  const e = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8');
  /* ★锚点挑"承重的那几行"而不是标题里也出现的词：第一版我拿 `退役名残留` 当锚点，
     P7 变异把明细里那句删掉后判据照绿——因为同一个串在**判据标题**里也出现一遍（R4-Dl 那条"整段 grep"教训的第三次成形）。 */
  return e.includes('E2E-39 ★R4-Ep') && e.includes('R4-Ep 归档探针好奇心')
    && e.includes('epHub') && e.includes('epFresh') && e.includes('cz-modal-select')
    && e.includes("r.form.文本[0] === '资源卡池'") && e.includes('epOk(epHub) && epOk(epFresh)')
    && e.includes('epSnapshot') && e.includes('已归档至「资源卡池」') && e.includes('.ds-kv');
});

// ============== R4-Eq 用户可见文案里的退役台面名清账（#118） ==============
console.log('【R4-Eq · 字符串现扫登记表与文案口径】');
/* 判据形态为什么要新造一种：R4-Dm/R4-Ep 那两张表管的是"列表构造/取第几枚"这类**代码形状**，
   而这一族的形状是**字符串内容**——"资源台"三个字印在界面与 AI 文案里，代码怎么写都拦不住它。
   所以这里现扫 src（剥注释后）落在**字符串字面量内**的每一枚「资源台」，与白名单逐文件比条数。 */
const retiredNameHits = (root) => {
  const stripAll = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/gs;
  const out = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p2 = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p2); continue }
      if (!/\.(ts|vue)$/.test(e.name)) continue;
      const txt = stripAll(fs.readFileSync(p2, 'utf8'));
      let m, n = 0;
      while ((m = re.exec(txt))) n += (((m[1] || m[2] || m[3] || '').match(/资源台/g) || []).length);
      if (n) out[path.relative(root, p2).split(path.sep).join('/')] = n;
    }
  })(root);
  return out;
};
check('R4-Eq ★退役台面名「资源台」只许活在带理由的四处：字符串字面量现扫（剥注释）与登记表逐文件比条数——多一处红、少一处也红（改表必须出现在 diff 里）。白名单：迁移写入的 hub 实体名（改名=动迁移语义，与 hub 存废待拍板绑在一起）、手册与迁移报告卡里的**退役说明**（那是"早期版本曾叫资源台，现已作废"这句话本身）、产品更新日志的历史叙述（★W5 扩表：版本标题与性能基线数字里的旧名是当时实测语境，与手册退役说明同形态）。界面文案、AI hint/投料标签、Airtable 字段说明一律不许再出现它——R4-Dg 定名单源、R4-Dm 收采集下拉、R4-Ep 收可选台列表，这轮收最后一类：写死的字', () => {
  const root = path.resolve(SCRIPTS_DIR, '..', 'src');
  const REG = {
    'shared/storage/curationMigration.ts': 2,   // R61 迁移给 hub 实体写的 name，用户库实测仍叫「资源台」；显示一律走 wsNameById（R4-Dg），这里不许被当文案改
    'newtab/manual-data.ts': 4,                 // 手册的退役说明与历史叙述（"早期版本顶部导航里有一个资源台的说法已作废"等），R4-De 明确保留这一形态
    'newtab/components/MigrateReportCard.vue': 1, // 整库回退确认里的"回退后分类树会回来，但资源台页面已退役"——历史事实陈述
    'newtab/changelog-data.ts': 12              // ★W5 扩表：产品更新日志的版本标题与要点（"资源台退役 + 池语义迁移"/「/workspace 资源台」整页退役/冷挂资源台阻塞基线）——与手册退役说明同形态的历史事实陈述，用户设置页可见。★2026-10-12 随V3.8.6 增补由 3 改 12：用户拍板「完整呈现全部 128 个版本」，v2 时代 88 版标题里的旧台名（"资源台 UI 迭代"/"资源台检索"等）随之进表，仍属历史叙述同一形态；改表随 diff 备案，判据体与口径一字未动
  };
  const found = retiredNameHits(root);
  return Object.keys(found).sort().join('|') === Object.keys(REG).sort().join('|')
    && Object.keys(REG).every(k => found[k] === REG[k]);
});
check('R4-Eq ★AI 侧文案必须说今天的落点：三张报告卡（每周回顾 / 深度洞察 / 成果文稿）跑完是**恒落资源卡池且不带分类**（R4-Df3），改前 hint 却写「放进资源台待分类」——那既是退役台面名又是旧世界的组织方式（池卡自 R179 起只由标签组织，池面板没有「待分类」这一栏，实测只有「🏷 待打标」 rail）。镜像相关文案同批改口（资源卡池目录 / 必须来自资源卡池（zy-curation）），旧串逐条不许回流', () => {
  const sel = codeOnly(read('/shared/ai/select.ts'));
  const bg = codeOnly(read('/shared/ai/batchG.ts'));
  const pr = codeOnly(read('/shared/ai/project.ts'));
  const sc = codeOnly(read('/shared/ai/scenarios.ts'));
  return (sel.match(/放进资源卡池——它不改动任何现有数据/g) || []).length === 2
    && !sel.includes('放进资源台待分类') && !bg.includes('放进资源台待分类')
    && bg.includes('资源卡放进资源卡池（不改任何既有数据）') && bg.includes('从资源卡池里挑能支撑本分支的卡')
    && bg.includes('都不在资源卡池里（或已挂在本分支）') && bg.includes('行点的卡不在资源卡池里（或已在本分支）')
    && pr.includes('【资源卡池目录（') && pr.includes('（资源卡池是空的——无卡可佐证）')
    && sc.includes('必须来自资源卡池（zy-curation）的卡') && sc.includes('"srcId":"资源卡池卡 id"');
});
check('R4-Eq ★界面指位类文案不许再指向已退役的台面：采集的重复收录确认改走 POOL_DISPLAY_NAME 常量（这一处在网页浮层里，用户每天看见）；镜像卡打包提示不再承诺一个不存在的落位（改成"在它的源卡上做"）；池实体的删除守卫与 Airtable 字段说明都改口「资源卡池」。四条旧串逐条钉住不许回流', () => {
  const ov = read('/content/overlay-impl.ts');
  const iDup = ov.indexOf('function showDupConfirm');
  const segDup = codeOnly(ov).slice(codeOnly(ov).indexOf('function showDupConfirm'));
  const link = codeOnly(read('/newtab/components/LinkCardsModal.vue'));
  const pool = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'));
  const wm = codeOnly(read('/newtab/composables/useWsMeta.ts'));
  const at = codeOnly(read('/shared/storage/airtable.ts'));
  return iDup > 0 && segDup.includes('已经收过了（在「${POOL_DISPLAY_NAME}」里）') && !segDup.includes('已存在于资源台')
    && link.includes('全部分类（资源卡池）') && link.includes('从资源卡池可镜像的卡') && !link.includes('从资源台可镜像的卡')
    && pool.includes('源卡仍留在资源卡池；目标台只是新增引用') && !pool.includes('打包请在资源台操作')
    && wm.includes('「资源卡池」是系统空间，不在此删除') && !wm.includes('资源台为系统空间')
    && at.includes('调度台/方向台/资源卡池/策展台名') && !at.includes('调度台/方向台/资源台/策展台名');
});
check('R4-Eq ★改口过的界面文案要留下"旧串不许回来"的锚：V3.9.8 退役左树后，关联资源弹窗的「资源卡池」分类口径、镜像只读横幅的编辑去向、池卡投射说明都必须继续指向资源卡池；对应旧拼法各一条负锚', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const link = codeOnly(read('/newtab/components/LinkCardsModal.vue'));
  const pool = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'));
  return link.includes('关联资源卡到「') && link.includes('全部分类（资源卡池）')
    && !link.includes('资源台可镜像')
    && w.includes('镜像卡为引用（只读）——编辑请到资源卡池') && !w.includes('编辑请到资源台')
    && pool.includes('源卡仍留在资源卡池') && !pool.includes('源卡仍留在资源台');
});

// ============== R4-Er ⌘K 驻留尺子（#114 的③，只立尺子不动链路） ==============
console.log('【R4-Er · 面板驻留指标】');
check('R4-Er ★#114 的③「结果表 ~1.3MB 派生串驻留」从来是**估算**（按字符数 ×2），本轮把它换成常驻指标：perf 必须有 M15——CDP `HeapProfiler.collectGarbage` 后取 `Runtime.getHeapUsage`，量「新文档稳定态」与「开过一次 ⌘K 再关掉并 GC」之差（关着面板被永久占住的那份），并换算每卡驻留；采样作废（面板没关掉 / 堆差为负 / 行数为零）必须显式记 M15_采样失败 而不是静默少一项', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'perf.cjs'), 'utf8'));
  const i = t.indexOf("'M15_面板关着仍驻留(KB)'");
  return t.includes("HeapProfiler.collectGarbage") && t.includes('Runtime.getHeapUsage') && t.includes('HeapProfiler.enable')
    && t.includes('const mp = await ctx.newPage()') && i > 0
    && t.includes("'M15_每卡驻留(B)'") && t.includes("'M15_开面板瞬时(KB)'") && t.includes('out.metrics.M15_采样失败 = 1')
    && t.includes('宁可不报也不报假数') && t.includes('closedOk')
    /* ★负锚：作废条件里不许出现「开着 ≥ 关着」这类我臆造的不变式。
       小库实测 关着 2,072KB > 开着 1,782KB（关面板时缓存与派生表留下、DOM 与 vnode 释放，
       两个读数没有必然大小关系）——把假不变式当门禁条件会把真样本判成假数，比不设闸更坏。 */
    && !/h1 < h0 \|\| hOpen/.test(t);
});
check('R4-Er ★M15 的分母必须是**结果集行数**（资源+任务+好奇+策展台+项目，与面板真实建行口径一致），只数资源卡会把每卡驻留算成虚高的假数；稳定态基线也要一起报，否则跨次运行的堆漂移会被读成"驻留涨了"', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'perf.cjs'), 'utf8'));
  const i = t.indexOf('const cnt = await mp.evaluate');
  /* 段尾取「采样作废判据」那行为止：rows 的合式写在 mp.close() 之后（页面关掉了才换算），
     拿 close 当段尾会把它切在段外——判据自己先得是看得全的。 */
  const seg = t.slice(i, t.indexOf('if (!closedOk', i));
  return i > 0 && seg.includes('res: live(dd.resources)') && seg.includes('task: live(dd.tasks)')
    && seg.includes('curio: live(dd.curiosities)') && seg.includes("x.id !== 'zy-curation'") && seg.includes('proj +=')
    && seg.includes('const rows = cnt.res + cnt.task + cnt.curio + cnt.ws + cnt.proj')
    && t.includes('M15_稳定态基线KB') && t.includes("'M15_结果集行数'");
});

// ============== R4-Es 尺子自证：codeOnly 必须跳字符串（#119） ==============
console.log('【R4-Es · 剥离器字符串感知】');
check('R4-Es ★#119 修完要留下现场锚：旧 codeOnly 是三条整段正则，manifest.ts 的 host_permissions 里那个 file 协议通配串被当成块注释起点，**从第 10 行往后 32 行真结构全被吞**（chrome_url_overrides / background / action 都不在视野里）——那之后任何"manifest 里不许出现 X"的负判据都会永远绿。现在这些行必须看得见（本次实测全仓库 39 处 manifest 判据都走 read 原文，所以没有现存假绿；这条钉的是"别让它上膛"）', () => {
  const m = codeOnly(read('/manifest.ts'));
  const g = codeOnly(read('/newtab/components/GlobalPopups.vue'));
  return m.includes("host_permissions: ['<all_urls>', 'file:///*']")
    && m.includes('chrome_url_overrides: {') && m.includes("newtab: 'src/newtab/index.html'")
    && m.includes('background: {') && m.includes('default_title:')
    && g.includes("chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })");
});
check('R4-Es ★Vue 的 template 区不能按 JS 字符串语义剥（HTML 文本里的引号不是定界符）：第一版状态机保留了这条限制没做，结果一个带反引号的行尾注释让 Workspace.vue 后半段的 HTML 注释全不剥、把注释里的 bookmarkInput 露给 R4-Db 的负锚（假红）。现在要求：整段标记（以 < 开头，含判据常切的 <template>…</template> 片段）走旧口径，注释一律剥干净', () => {
  const gs = read('/newtab/views/GlobalSettings.vue');
  const wsRaw = read('/newtab/views/Workspace.vue');
  const tpl = codeOnly(gs.slice(gs.indexOf('<template>'), gs.indexOf('<script')))
  const wsTpl = codeOnly(wsRaw.slice(wsRaw.indexOf('<template>'), wsRaw.indexOf('<script')))   // 判据常切的"纯标记片段"（模板区＝到 <script 为止，嵌套的 </template> 会切断）
  const ws = codeOnly(wsRaw);
  return !/第\s*[卌卅一二三四五六七八九十]{1,3}轮/.test(tpl.slice(0, 6000))
    && !wsTpl.includes('parked 的 bookmarkInput') && !wsTpl.includes('fileImportInput。★R4-Db')
    && !wsTpl.includes('R167（OPPO 质感') && wsTpl.includes('class="thesis-banner"')
    && !ws.includes('parked 的 bookmarkInput') && ws.includes('const mind = useCurationMindMap');
});

// ============== R4-Et 孤儿 CSS 清账：依据本身要在门禁里 ==============
console.log('【R4-Et · 死样式扫描器与它的四票依据（R4-Ev 补到四票）】');
check('R4-Et① ★删样式的准绳是 dead-css-scan.cjs，而它必须先有 DOM 类名普查才能出结论——**这条判据实跑它两次**：拿一个不存在的 census 去问，它必须拒绝出清单并以非零退出（R4-Dj 当年"走查覆盖不足所以不动手"就是这个洞，R4-En 补了 census 才有今天这把尺子）；拿当前 src 去问，它必须真跑出四票口径的清单。四票逐条钉（★R4-Ev 把 scoped 也接进全站精确字符串票，并补了插值前缀票）：本文件精确 class token、全站 class 属性 token（Vue 会把父组件写在你根元素上的类透传下去，跨文件的精确类名也算在用）、全站精确字符串与插值前缀、census；过渡件只豁免 <Transition name=x> 真生成的 x 与六件套', () => {
  const p = path.resolve(SCRIPTS_DIR, 'dead-css-scan.cjs');
  const s = fs.readFileSync(p, 'utf8');
  const refused = runGateSync(p, ['--census', '/tmp/zy_et_no_such_census.json']);
  const ran = runGateSync(p, ['--json']);
  let out = null
  try { out = JSON.parse(ran.stdout || '') } catch { }
  return !!refused && refused.status === 2 && /先跑一次 node scripts\/theme-audit\.cjs/.test((refused.stderr || '') + (refused.stdout || ''))
    && !!ran && ran.status === 0 && !!out && Array.isArray(out.死) && Array.isArray(out.祖先断) && out.规则总数 > 2500
    && !!out.census && /class-census\.json/.test(out.census)
    && s.includes('globalAttrTokens.has(tok)') && s.includes('transitionTokens.has(t)') && s.includes('blankComments')
    && !s.includes("txt.matchAll(/\\bname")            /* 宽口径 name= 会把表单控件当过渡名（name="batch" 放过 .batch-tagin） */
    && !s.includes("t.startsWith(n + '-')")           /* 同上：name="expand" 曾把 .goal-node .expand-icon 豁免掉 */
    && !s.includes('s.includes(tok)')                 /* 子串票：node 因 node-title 而"活着"，那是命名法不是拼接 */;
});
check('R4-Et② ★切片不许静默失效：fnBody 的起点/终点标记只要有一个找不到，切片就变成"到文件尾"或"空串"——前者让负判据误红（本轮 .cur-tree-caret 被删后 R94-7 就是），后者更坏：正判据在空串上永远假、负判据永远绿。现在两处都记账，判据要求账本为空（这一条同时是活体检查：现场任何一条 fnBody 标记漂了都会红在这里，而不是红在别的判据上却查不出原因）', () => {
  const h = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'regression/helpers.cjs'), 'utf8');
  const iF = h.indexOf('const fnBody'), jF = h.indexOf('const segOf');
  const region = iF >= 0 && jF > iF ? h.slice(iF, jF) : '';
  return region.includes("SLICE_MISS.push('起点缺失") && region.includes("SLICE_MISS.push('终点缺失")
    && !region.includes("if (i < 0) return '';")
    && h.includes('const getSliceMisses = () => SLICE_MISS') && h.includes('getSliceMisses,')
    && getSliceMisses().length === 0;
});
check('R4-Et③ ★普查每次走查都要重出，且**图与普查必须同一批**：theme-audit 在每张截图后数一遍页面上的 class token（含 content 浮层那条 ovPage，它不在扩展页文档里），最后与图同目录写出 class-census.json。锚点全部走"行首可执行语句"的形态——T3 变异把写文件那行整行注释掉，纯 includes 写法照样绿（R4-Dl/R4-En/R4-Ep 之后这族失效的第四次成形，这次一次修两处）。另核盘上那份产物：场景数=同目录 png 张数、token 数与 计数 表自洽、活类名在册而本轮退役的类名不在册', () => {
  const t = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8');
  const atLineStart = (re) => re.test(t);
  const dir = path.resolve(SCRIPTS_DIR, '..', '..', 'docs', '视觉归档');
  const day = fs.readdirSync(dir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
  const dd = path.join(dir, day);
  const c = JSON.parse(fs.readFileSync(path.join(dd, 'class-census.json'), 'utf8'));
  const pngs = fs.readdirSync(dd).filter(f => f.endsWith('.png')).length;
  return atLineStart(/^\s*fs\.writeFileSync\(path\.join\(outDir, 'class-census\.json'\)/m)
    && atLineStart(/^\s*const censusOf = /m)
    /* ★R4-Fe 随迁备案：两个包装行各多挂了一次 stateOf（截图时同时记 DOM 态），锚跟着盘上真实语句走。
       这条判据守的是"每张截图都当场记账、图与账同一批"，包装里多一件工具不改变它守的事；
       锚取的是整行形态，所以加东西必然红——这是设计（要人来确认加的正是这件事），不是锚写坏了。 */
    && atLineStart(/^\s*page\.screenshot = async \(opt\) => \{ const r = await orig\(opt\); await censusOf\(page\); await stateOf\(page, opt && opt\.path\); return r \}/m)
    && atLineStart(/^\s*ovPage\.screenshot = async \(opt\) => \{ const r = await os\(opt\); await censusOf\(ovPage\); await stateOf\(ovPage, opt && opt\.path\); return r \}/m)
    && c.场景数 === pngs && pngs > 90 && Object.keys(c.计数).length === c.token数 && c.token数 > 700
    && !!c.计数['thesis-banner'] && !c.计数['ts-note'] && !c.计数['goal-node'] && !c.计数['metric-item'] && !c.计数['gs-mc-section'];
});
const ET_RETIRE = {
  '/newtab/components/AiSuggestionDrawer.vue': ['.ai-badge.b-warn', '.ai-badge.b-ok', '.ai-badge.b-danger', '.ai-badge.b-neutral', '.ai-chg-tag.t-new', '.ai-chg-tag.t-edit', '.ai-chg-tag.t-move', '.ai-chg-tag.t-same'],
  '/newtab/App.vue': ['.home-logo'],
  '/newtab/components/GlobalPopups.vue': ['.gp-ai-row', '.gp-curio-src'],
  '/newtab/components/compass/NorthStarPanel.vue': ['.nd-group', '.nd-group-name', '.nd-drag', '.nd-input', '.nd-edit', '.nd-btn', '.nr-row', '.nr-k', '.nr-v', '.nr-actions', '.nd-btn.ghost', '.nr-v.link',],
  '/newtab/components/compass/TaskDetailDrawer.vue': ['.ts-label', '.ts-select', '.ts-input', '.ts-note', '.ts-field', '.ts-rel-up', '.ts-status-chip', '.ts-time-text', '.ts-status-chip.active',],
  '/newtab/components/compass/TaskManagerPanel.vue': ['.batch-tagin'],
  '/newtab/views/CompassHome.vue': ['.cf-go', '.pager', '.pg-num', '.cur-tree-caret', '.picker-item.sys', '.pi-check.pi-ghost',],
  '/newtab/views/CompassTree.vue': ['.node', '.sidebar', '.breadcrumb', '.main-area', '.goals-row', '.goal-col', '.goal-node', '.project-node', '.project-branch', '.vision-node', '.mission-node', '.metric-item', '.metric-name', '.metric-status', '.metrics-wrap', '.tasks-wrap', '.tasks-header', '.sub-tree', '.tree-connector', '.guide-line', '.branch-connector', '.progress-bar', '.progress-fill', '.focus-btn', '.linked-chips', '.add-btn-inline', '.sidebar-item.active', '.sidebar-item .tip', '.breadcrumb .root', '.breadcrumb .sep', '.project-node.primary', '.focus-btn.on', '.vision-node .node-title', '.tk-row:hover .tml-up',],
  '/newtab/views/FieldEditor.vue': ['.gs-fr-actions'],
  '/newtab/views/GlobalSettings.vue': ['.gs-manual', '.gs-manual-nav', '.gs-manual-body', '.gs-mc-section', '.gs-mc-content', '.gs-mc-title', '.gs-mn-part', '.gs-dd-seg', '.gs-dash-stats', '.gs-dash-stat', '.ai-days', '.gs-mn-item.active', '.gs-mc-content .mc-flow', '.gs-mc-content .mc-table', '.gs-dd-seg b.up',],
  '/newtab/views/workspace.css': ['.rc-action.mount.on'],
  '/newtab/views/ProjectCuration.vue': ['.back-row',],
};
check('R4-Et④ ★退役选择器登记表（本轮删掉的 150 条里挑出这些族名，全量账在交付说明 R4-Et 第一节）：样式可以重写，但"模板里已经没有这个类"这件事不该被一条同名规则悄悄带回——登记文件里任何一条选择器重新出现在自己的组件里即红，改表必须进 diff。为什么钉族名而不是整条规则文本：规则文本一改格式（空格、换行）锚点就静默失效，而"族名 + 紧跟一个左花括号"既能认出回流又不在乎排版', () => {
  const back = [];
  for (const [f, sels] of Object.entries(ET_RETIRE)) {
    const body = read(f);
    for (const s of sels) if (body.includes(s + ' {')) back.push(f + ' ← ' + s);
  }
  if (back.length) console.log('    回流：' + back.join(' / '));
  return back.length === 0;
});

// ============== R4-Eu 切片闸扩到 segOf，并把闸本身钉进门禁 ==============
console.log('【R4-Eu · 切片漂移闸（83 处全覆盖）】');
check('R4-Eu① ★闸必须装在收口处而不是某条分片里：segOf 的 69 处调用大多在判据体内惰性求值，任何分片里判"账本为空"都只覆盖到那一刻之前 ⇒ 由 regression.cjs 在**全部跑完之后**统一收口并影响退出码；helpers 侧的记账要覆盖 fnBody 与 segOf 两个工具的四条失败路径。★这条判据第一轮差点写成"文件里有 getSliceMisses 这个词"——那是 R4-Dl 那族失效的第五次，所以锚点全部取行首可执行语句，并负锚 runner 退回旧退出码写法', () => {
  const r = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'regression.cjs'), 'utf8');
  const h = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'regression/helpers.cjs'), 'utf8');
  const at = (re) => re.test(r) || re.test(h);
  return /^\s*const misses = \[\.\.\.new Set\(getSliceMisses\(\)\)\];/m.test(r)
    && /^\s*process\.exit\(fail \|\| misses\.length \? 1 : 0\);/m.test(r)
    && !/^\s*process\.exit\(fail \? 1 : 0\);/m.test(r)
    && at(/^\s*if \(i < 0\) \{ SLICE_MISS\.push\('segOf 起点缺失/m)
    && at(/^\s*if \(j < 0\) \{ SLICE_MISS\.push\('segOf 终点缺失/m)
    && getSliceMisses().length === 0;
});
check('R4-Eu② ★"标记还在"不等于"切片还对"：漂移闸只抓"标记找不到"，抓不到"标记还在但落点错了"（起点在文件里重复出现、终点被改成一个存在却很晚的串，都会静默把切片撑大）。所以再钉一层**形状**：三段 helpers 级切片必须还是那一段代码的量级，且各自的承重内容在、区外的东西不在。U3 变异把 CTX90 的终点从 composable 的 return 换成一个行首右花括号（旧标记与新标记在源码里都找得到、都不记漂移），宽度从 1,870 涨到上万且把 `openMirrorDetail` 卷进来——正是这一条把它抓住', () => {
  return CTX90.length > 200 && CTX90.length < 4000
    && CTX90.includes("icon: 'star'") && CTX90.includes('编辑详情')
    && !CTX90.includes('openMirrorDetail') && !CTX90.includes('onCardClick, onCardDblClick')
    && OPEN_LINK_FN.length > 200 && OPEN_LINK_FN.length < 2500
    && OPEN_LINK_FN.includes("if (meta.kind === 'image')") && !OPEN_LINK_FN.includes('previewName')
    && RES_CARD_IFACE.length > 100 && RES_CARD_IFACE.length < 3000
    && RES_CARD_IFACE.includes("kind: 'resource'")
    && RES_CARD_IFACE.split('export interface').length === 2;   /* 切片自带起点那一句，所以"只许出现一次"= 没串到下一个 interface */
});

// ============== R4-Ev 祖先段口径 + 行号自证：第二批孤儿 CSS 清账 ==============
console.log('【R4-Ev · 扫描器口径的四处修正与清零棘轮】');
check('R4-Ev① ★"祖先段整段判死"这条口径要能独立站住，就得先承认旧口径的四处误判并把救活它的四条票钉住：① 逗号选择器列表必须**逐段判**（旧版把整串当一条链，body .module-title .name, body .tc-module-title .tc-name 里第一段断了就把整条报成祖先断，而第二段活着）；② 括号要**配平**剥（:is(a, :not(b)) 用 [^)]* 会在第一个右括号早停，把 :is 的尾巴当成祖先段）；③ 运行时插值的类名（Heatmap 的 `l${lv}` ⇒ .dz-cell.l4）token 匹配天生看不见，要有"插值前缀"票；④ 类名值由**别的文件**的数据表产出（curiosity.ts 的 cls: exploring、DashboardLogDrawer 的 expanded）时，scoped 也要吃"全站精确字符串"这一票。**棘轮就是实跑扫描器两桶为零**：这四条里任何一条被拆掉，对应的规则立刻浮回名单 ⇒ 清零不是"把判据调松"能换来的。ET_RETIRE 已随本批扩到第二批的 40 条退役选择器。★V3.9.7 重指：画像指标的第三张 scoped 票由已删除的 `.pi-recon-cell` 改为同组件现役 `.recon-cell`，守的扫描器能力与零死规则口径不变', () => {
  const p = path.resolve(SCRIPTS_DIR, 'dead-css-scan.cjs');
  const s = fs.readFileSync(p, 'utf8');
  const ran = runGateSync(p, ['--json']);
  let out = null; try { out = JSON.parse(ran.stdout || '') } catch { }
  const ex = (sel) => runGateSync(p, ['--explain', sel]).status === 0;
  return !!out && out.规则总数 > 2900 && out.死.length === 0 && out.祖先断.length === 0
    && s.includes('function splitTopLevel') && s.includes('function stripParens')
    && s.includes('interpPrefixes.add') && s.includes('globalTokens.has(tok)')
    && ex('.metric-item.expanded') && ex('.dz-cell.l4') && ex('body .module-title')
    && ex('.picker-item') && ex('.toggle') && ex('.recon-cell') /* ★W9 退役重指带备案：本格原放 ex('.dz-hl')——那张票（运行时插值类名 + 跨文件产出的类名）在它随 R3-F38 开关退役后失去载体。四条票一条没拆：插值前缀票仍由 ex('.dz-cell.l4') 守，全站精确字符串票仍由 ex('.picker-item') / ex('.toggle') 守；本格改放画像指标的 scoped 类，顺带证明扫描器在新页的 <style scoped> 上照常工作。★B8 再随迁（V3.8.41）：第二张票随概览带整族判死而失效。★V3.9.7 再重指：抽屉拆成 PiMetricDetailDrawer 后类名改为 `.recon-cell`，不让已退役的 `.pi-recon-cell` 继续充当活性票。教训与头注①同源：**"证明扫描器在某类宿主上工作"的票必须选真正活着的宿主类，不能选一个恰好没被清理的同名残留**——票红时先问"被测物是不是已经退役了"，别急着换锚点。 */;
});

// ============== R4-Ew 三条运行时触点进 e2e ==============
console.log('【R4-Ew · 采集保存链路 / hover 动作区 / 下钻抽屉】');
check('R4-Ew① ★三条"改了没人报"的链各有了一条真点的 e2e：E2E-40 content 采集面板从 http 宿主页唤起、池提示行显示「资源卡池」且两枚下拉已退役、真点保存后核 toast 与**落库那张卡的 workspaceId=zy-curation 且分类留空**；E2E-41 ⌘K 结果行动作区三枚钮 title 齐、hover 前 opacity 为 0 后为 1、点星标**真写库**再点回**真复原**；E2E-42（V3.9.7 重指）画像洞察页四格 KPI 按各自真实响应形态判：两格落卡片清单抽屉、标签分布落四段解释抽屉、精力落主攻打开 focusOnly 全量记录抽屉，且四格数量必须恰为 4。锚点一律取判据表达式而非用例标题——标题留在文件里而条件被删掉，是 R4-Dl 那族失效的老形状', () => {
  const e = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8'));
  return e.includes("type: 'zy-open-capture'") && e.includes("capPoolText.includes('资源卡池')")
    && e.includes('capDropGone') && e.includes('/资源卡池/.test(capToast)')
    && e.includes('capRow.ws === \'zy-curation\'') && e.includes('capRow.catEmpty')
    && e.includes('Number(gpRow.actsOpacity) === 0') && e.includes('gpHover > 0.9')
    && e.includes('starAfter === true && starBack === false')
    && e.includes('heroKpiCount === 4')
    && e.includes('r.题在 && r.抽屉在 && (')
    && e.includes("const insightHeads = [...document.querySelectorAll('.pi-tag-insight h4')]")
    && e.includes("const LABELS = ['这个指标怎么看', '当前分布', '下一步建议', '交给 AI 助手处理']")
    && e.includes("insightHeads.every((h, i) => h.textContent.includes(LABELS[i]))")
    && e.includes("r.logNote.includes('近30天主攻动作')")
    && e.includes('r.rows > 0 || r.empty');
});
check('R4-Ew② ★content 侧用例的两条环境事实必须留在脚本里（本轮各踩一次）：① MV3 的 http 宿主页里**没有 chrome.storage**（浮层自己走消息，测试取库要回扩展页）——所以库读写一律 page.evaluate，出现 capPage.evaluate 里读 chrome.storage 即红；② 宿主页端口用 listen(0) 现取、用完关，不写死端口（写死会撞本机其它服务，且 theme-audit/perf 同一手法各自起）', () => {
  const e = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8'));
  return /^\s*await new Promise\(r => capServer\.listen\(0, '127\.0\.0\.1', r\)\)/m.test(e)
    && e.includes('capServer.close()') && e.includes("await capPage.goto(`http://127.0.0.1:${capPort}/`")
    && !/capPage\.evaluate\(\(t\) => chrome\.storage/.test(e)
    && /await page\.evaluate\(\(t\) => chrome\.storage\.local\.get\('zy_data_v2'\)\.then\(r => \{\s*const c = \(r\['zy_data_v2'\]\.resources \|\| \[\]\)\.find\(x => x\.title === t\)/.test(e);
});

// ============== W4 需求 #5 资源卡标签体系（V3.8.4） ==============
console.log('【W4 · 网页浮层入池对齐 + 保存后自动预打标】');
check('W4-1 ★网页浮层采集与应用内对齐（V3.8.4 用户拍板③「顺手清掉」）：overlay 采集的「存入」两枚下拉（台面 #__zy_cap_ws__ / 分类 #__zy_cap_cat__）整体退役，改静态池提示行 .zy-cap-pool，落点在 saveCapture 里写死 CURATION_WS_ID 且 categoryId 留空（R179 定案：池卡只由标签组织，没有分类）。回执只报「已入 资源卡池」，「未归档 · 去归位」一支随之退役。三条负锚钉死回流：不许出现两个下拉 id、不许 selectableWsOptions、不许重新 filter 原始 workspaces。★负锚纪律（R166/codeOnly）：负判据先剥注释再比——退役注释里按纪律必须留 selectableWsOptions / 未归档等旧词当知识锚，剥完才算残留；「未归档」那条额外收进 saveCapture 资源采集体（fnBody 已剥离注释），因为它在任务采集体（另一条链路，L1632 附近）里仍然合法存活，不能全仓负锚。', () => {
  const raw = read('/content/overlay-impl.ts');
  const ov = codeOnly(raw);
  const saveFn = fnBody(raw, 'async function saveCapture(', '/** 采集去重确认视图');
  return !ov.includes('__zy_cap_ws__') && !ov.includes('__zy_cap_cat__')
    && !ov.includes('selectableWsOptions') && !ov.includes('workspaces?.filter((w: any) => !w.archived)')
    && ov.includes('zy-cap-pool') && ov.includes('POOL_DISPLAY_NAME')
    && ov.includes('workspaceId: CURATION_WS_ID') && ov.includes("categoryId: ''")
    && saveFn.includes('已入 ${POOL_DISPLAY_NAME} · Enter 打开看板')
    && !saveFn.includes('未归档 · Enter 去归位');
});
check('W4-2 ★保存后自动预打标（用户拍板①）：captureEnrich 的语义从 opt-in 翻成「默认开」——新卡入库自动 AI 建议标签，采纳才写库（不动「AI 不替决策」红线）。存量库里存着旧默认 false，若直接覆盖 ref 会让老用户永远停在关闭态；若读取时粗暴 `!== false` 强制开回来，用户主动关掉的开关每次唤起都被翻回开。所以走一次性迁移：没跑过戳时把 false→true 落盘并打迁移戳，之后一律尊重存量值。config.ts 三件套（默认 true / 迁移戳常量 / migrateCaptureEnrichDefault）+ GlobalPopups 的 ref(true) 与迁移后的值读取，缺一即红', () => {
  const cfg = codeOnly(read('/shared/ai/config.ts'));
  const gp = codeOnly(read('/newtab/components/GlobalPopups.vue'));
  return cfg.includes('captureEnrich: true') && cfg.includes('CAPTURE_ENRICH_MIGRATED_KEY')
    && cfg.includes('migrateCaptureEnrichDefault') && cfg.includes('captureEnrich === false')
    && cfg.includes('captureEnrich: true }') && cfg.includes('MIGRATED_KEY]: true')
    && cfg.includes('await migrateCaptureEnrichDefault()')
    && gp.includes('const capEnrichOn = ref(true)')
    && gp.includes('capEnrichOn.value = m.aiConfig.value.captureEnrich')
    && !gp.includes('captureEnrich !== false');
});

// ============== W5 · 调度台五条反馈 + 今日战报（V3.8.5） ==============
console.log('【W5 · 调度台五条反馈 + 今日战报】');
check('W5-1 ★指标条三段分组块（用户拍板#1/#5）：MetricBar 模板三段 `.mb-group`（mb-nav 左槽+档位段控 / mb-metrics 5 格 / mb-right），组件内样式 `.mb-group` 用 surface-2 浅底圆角块、`.mb-metrics` 窄间距；旧 `.mb-divider` 退役删除。R120-10 锚不动：`min-height: 38px; max-height: 38px`、`<slot name="left/right"`、mb-right。★M2（V3.8.28）翻转带备案：原断言钉 `.mb-metrics gap:2px` 这个具体值，M2 把读数行间距统一到 8px 网格（2→4，与 mb-row/mb-group 的 8 同族），故数值锚改为「有 gap 声明且 ≤8px」——本条守的「三段分组 + 格间紧凑」一项未减，只是不再锁死 2px', () => {
  const mb = codeOnly(read('/newtab/components/compass/MetricBar.vue'));
  const gapM = mb.match(/\.mb-metrics \{[^}]*gap: (\d+)px/);
  return mb.includes('class="mb-group mb-nav"')
    && mb.includes('class="mb-group mb-metrics"')
    && mb.includes('class="mb-group mb-right"')
    && mb.includes('min-height: 38px; max-height: 38px')
    && mb.includes('<slot name="left"') && mb.includes('<slot name="right"')
    && mb.includes('.mb-group {') && mb.includes('background: var(--surface-2)')
    && mb.includes('.mb-metrics {') && !!gapM && Number(gapM[1]) <= 8
    && !mb.includes('.mb-divider');
});
check('W5-2（V3.9.1 重指）标题形态统一「图标 + 英文副标」：今日三件事与手边的卡都用 board-ico + kicker，旧 decks-title / 底部三卡 tab 退役', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  const ch = codeOnly(read('/newtab/views/CompassHome.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return hm.includes('dz-n dz-ico') && hm.includes('<svg viewBox="0 0 24 24"')
    && !hm.includes('今年第 {{ yearStat.days }}') // dz-n 数字标题退役
    && ch.includes('class="board-ico"') && ch.includes('class="board-title"')
    && ch.includes('class="hand-heading"') && ch.includes('THREE DECKS')
    && !ch.includes('decks-title') && !ch.includes('bottom-tabs')
    && css.includes('.dz-n.dz-ico') && css.includes('.dz-sec-h .dz-t');
});
check('W5-3 ★热力图摘要四卡图标化（用户拍板#2/#4c）：SUM_ICONS 四枚内联 SVG（act/done/streak/peak 键）+ summary 条目带 ic 字段 + `.dz-sum` 改 4 列 grid 图标卡（accent-light 底 icon 方块）；`.dz-sum .c` 与 `.dz-sum .d`（R174-5 保 DOM，display:none）两条判据锚不动；峰路径不含 L[0-5]（R172-6 负锚——SVG 路径里的 L21 曾误触发）', () => {
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  return hm.includes('SUM_ICONS') && hm.includes('act:') && hm.includes('done:')
    && hm.includes('streak:') && hm.includes('peak:')
    && hm.includes('class="ic" v-html="s.ic"')
    && hm.includes('<span class="d">{{ s.d }}</span>')
    && !/L[0-5]/.test(hm)
    && css.includes('.dz-sum {') && css.includes('grid-template-columns: repeat(4')
    && css.includes('.dz-sum .d { display: none; }');
});
check('W5-4 ★资源卡池排序接线（用户拍板#4）：PoolCardsPanel 接 DeckControls（POOL_SORTS / PoolSortBy / sortPrefs?.pool 持久化 / toggleSortDir / poolCards keyOf+pinned 浮顶 / watch([sortBy,sortDir]) 重置 visibleCount）；排序键用 pool 新键（不污染 sortPrefs.res），置顶卡恒浮顶', () => {
  const pc = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'));
  return pc.includes('POOL_SORTS') && pc.includes("type PoolSortBy")
    && pc.includes('sortPrefs?.pool') && pc.includes('toggleSortDir')
    && pc.includes('keyOf') && pc.includes('pinned')
    && pc.includes('visibleCount.value = PAGE')
    && pc.includes('<DeckControls')
    && !pc.includes('sortPrefs.res');
});
check('W5-5 ★弹窗居中（用户拍板#4b）：`.dz-day-modal-overlay` align-items 从 flex-start 改 center（4vh×2 + 92vh 不溢出），注释同步更新', () => {
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  const i = css.indexOf('.dz-day-modal-overlay');
  const body = css.slice(i, css.indexOf('}', i));
  return body.includes('align-items: center') && !body.includes('flex-start');
});
check('W5-6 ★今日战报双入口 + 合并弹窗（用户拍板#6 合并方案）：useDailyLog.ts 模块级单例（requestDailyLog/consume）；App.vue 品牌区 brand-chip 点击 onBrandClick（脉冲 brandPulse 1200ms、非 / 先导航再请求、role/tabindex/keydown）；HeatmapModule 消费（applyDailyLogDay 校正年份+置 selDay、watch pendingDay、onMounted 消费）；DayDetail 原地改战报+分析合一（props.day 参数化：今天=品牌区入口、历史=热力图入口）', () => {
  const dl = read('/newtab/composables/useDailyLog.ts');
  const ap = codeOnly(read('/newtab/App.vue'));
  const hm = codeOnly(read('/newtab/components/dashboard/HeatmapModule.vue'));
  const dd = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'));
  return dl.includes('requestDailyLog') && dl.includes('consume')
    && ap.includes('onBrandClick') && ap.includes('brandPulse')
    && ap.includes('brand-chip') && ap.includes('pulsing')
    && ap.includes("role=\"button\"") && ap.includes('tabindex="0"')
    && hm.includes('applyDailyLogDay') && hm.includes('consume')
    && hm.includes('dashSelDay.value = day')
    && dd.includes('dlSum') && dd.includes('flowGroups')
    && dd.includes("emit('open-log', day)");
});
check('W5-7 ★战报层：摘要行 + 分时段叙事时间线 + 导出三格式（#4a + #6 · ★W6 #1 再随迁：flowGroups 改降序对齐原型、分析段锚随裁剪退役改认新结构 · ★W6.1 再随迁带备案：四格统计可点击下钻，DrillCardList 与 groupEventRows 在日详情**重新在位**（W6 裁剪期退役、W6.1 用户拍板加回），故这两条负锚改为正锚；裁剪真正退役的是分析段的库容变化条与 hintline）：DayDetail dlSum + flowGroups 分组 + ACT_SYM/ACT_CLS 字面量表（dead-css-scan token 可见）+ 底部 ExportMenu formats=[png,html,md] + 四格统计 dz-stats + 热力带 dz-heat-band + exportView DailyReportShareSpec/dailyReportShareHtml/PngSpec.rows', () => {
  const dd = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'));
  const ev = codeOnly(read('/shared/utils/exportView.ts'));
  return dd.includes('dlSum') && dd.includes('flowGroups')
    && dd.includes('ACT_SYM') && dd.includes("create: 'act-create'")
    && dd.includes("purge: 'act-purge'")
    && dd.includes("formats=\"['png', 'html', 'md']\"")
    && dd.includes('exportPng') && dd.includes('exportHtml') && dd.includes('exportMd')
    && dd.includes("from '@/shared/utils/drillRows'")
    && dd.includes('EVENT_ACT_LABEL[e.action]')
    && dd.includes('b.ts - a.ts') /* W6：降序对齐原型 */
    && dd.includes('dz-stats') && dd.includes('dz-heat-band') && dd.includes('今日战报')
    && dd.includes("emit('open-log', day)") && dd.includes('查看全部记录')
    /* ★W6.1 随迁：下钻加回 ⇒ 这两条由负锚转正锚（承重处在调用与模板挂载，不在 import 行——删了 import 会连带类型错，删调用才红） */
    && dd.includes('groupEventRows(filtered') && dd.includes('<DrillCardList v-if="drillRows"')
    /* 裁剪期真正退役的三件仍守负锚：库容变化条 / hintline / 四列下钻容器 */
    && !dd.includes('deltaOf(') && !dd.includes('stockAt(') && !dd.includes('该日库容变化')
    && ev.includes('PngSpec') && ev.includes('rows?')
    && ev.includes('DailyReportShareSpec') && ev.includes('dailyReportShareHtml');
});
check('W5-8 ★三卡交互统一「单击详情 / 双击开链接」（V3.9.8 随迁）：资源卡池与同步入口同款 260ms 去重（pcpClickTimer），双击统一走 useResourceOpen.openResourceLink —— 该通道覆盖普通 URL、obsidian、本地文件以及 zy-asset:// 的 PDF / HTML / 图片附件，并统一记账；列表/网格两视图均绑 @dblclick，title 提示含「双击打开链接」。任务卡与好奇卡既有实现不动', () => {
  const pc = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'));
  const ro = codeOnly(read('/newtab/composables/useResourceOpen.ts'));
  const tm = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue'));
  const cz = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue'));
  return pc.includes('pcpClickTimer') && pc.includes('onCardDblClick')
    && pc.includes('const { openResourceLink } = useResourceOpen({ store, d: resourceData })')
    && pc.includes('function openCardLink(r: ResourceCard)')
    && pc.includes('openResourceLink(r)')
    && ro.includes('toOpenableUrl(r.linkType, r.link)') && ro.includes('openExternalLink(url)')
    && ro.includes('recordResourceOpen(d.value, r)') && ro.includes('store.persistHot?.()')
    && ro.includes("meta.kind === 'image'") && ro.includes("meta.kind === 'html' || meta.kind === 'pdf'")
    && pc.includes('@dblclick="onCardDblClick(r)"')
    && (pc.match(/@dblclick="onCardDblClick\(r\)"/g) || []).length >= 2 /* ★W15-T3 2026-10-16：列表视图新增分组分支后同款双击通道多一处（仍不许少于一档：列表 + 网格） */
    && pc.includes('双击打开链接')
    && tm.includes('onTaskRowDblClick') && tm.includes('260')
    && cz.includes('onCardDblClick') && cz.includes('260');
});
check('W5-9 ★全局检索键位语义升级（用户拍板 NEW-#2）：⌘K 单击/Enter 对三类卡都先开链接——res 走 toOpenableUrl、task 走 t.link、curio 走 c.sourceUrl（toOpenableRawLink 白名单），有链接即 openExternalLink + closeAll 并记热度；无链接回落 openItem（定位）；Ctrl+单击/Ctrl+Enter 仍是 locateOnly 仅定位。键位契约 title 提示与 R120 锚不动', () => {
  const gp = codeOnly(read('/newtab/components/GlobalPopups.vue'));
  return gp.includes("item.type === 'task'") && gp.includes('toOpenableRawLink(t.link)')
    && gp.includes("item.type === 'curio'") && gp.includes('toOpenableRawLink(c.sourceUrl)')
    && gp.includes('openLinkOrLocate') && gp.includes('locateOnly')
    && gp.includes('单击/Enter → 打开链接（无链接则定位）')
    && gp.includes('Ctrl+单击 或 Ctrl+Enter → 定位到卡片所在处')
    && gp.includes('recordCardOpen(d.value, t)') && gp.includes('recordCardOpen(d.value, c)');
});
check('W11-1 ★版本同步第七处「根 README 当前版本行」真正纳入门禁（此前只有 v2/README.md 自称七处同步含此项，实际全仓无一条断言读它——2026-10-13 盘点时根 README 停在 V3.8.9 而代码已到 V3.8.11，两版漂移无人拦）。判据：① 根 README 的「当前版本」行全篇恰好一处、且随版本锚走 ② changelog 逐版齐全：首条必须是当前版本，次新版本必须紧邻递减（本次补录前 3.8.11 之后直接跳 3.8.9，W10 整版对用户不可见）', () => {
  const rootR = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', '..', 'README.md'), 'utf8');
  const hits = [...rootR.matchAll(/当前版本\s+V([\d.]+)/g)].map(x => x[1]);
  const cl = read('/newtab/changelog-data.ts');
  const vs = [...cl.matchAll(/version:\s*'([\d.]+)'/g)].map(x => x[1]);
  const cmp = (a, b) => {
    const A = a.split('.').map(Number), B = b.split('.').map(Number);
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) - (B[i] || 0);
    }
    return 0;
  };
  return hits.length === 1 && hits[0] === CUR_VER
    && vs[0] === CUR_VER
    && vs.length > 1 && cmp(vs[0], vs[1]) > 0
    && vs.every((v, i) => i === 0 || cmp(vs[i - 1], v) > 0);
});

check('W5-10 ★设置页产品更新日志（用户拍板 NEW-#3）：changelog-data.ts 单一真源（CHANGELOG 倒序、裸版本号与 manifest 同格式、发版日期、要点数组）+ GlobalSettings 导航「系统信息」组 letter 与 about 之间挂 changelog 分区 + 时间线面板（gs-cl-* 样式、current 版本轨染 accent、当前版本徽标对照 runtimeVersion 不写字面量）；深链 /settings?page=changelog 经 navGroups 白名单自动生效。★V3.8.38（S5）重指：面板不再平铺渲染，改走 RichText + 三段式分组，导入语句由 `import { CHANGELOG }` 变为 `import { CHANGELOG, kindGroupsOf }`——断言改为「两个具名都取自 changelog-data」，不因多取一个具名而失效', () => {
  const cl = codeOnly(read('/newtab/changelog-data.ts'));
  const gs = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  return cl.includes('export const CHANGELOG') && cl.includes("version: '3.8.6'")
    && cl.includes("date: '2026-10-12'")
    && cl.includes("version: '3.8.5'") /* 历史条目保留（倒序最新在前） */
    && gs.includes("key: 'changelog'") && gs.includes("label: '产品更新日志'")
    && gs.includes("activePage === 'changelog'")
    /* ★V3.8.38 重指：原断言整串已不存在（S5 多取 kindGroupsOf），改为断言两者同源 */
    && /import \{ CHANGELOG, kindGroupsOf \} from '\.\.\/changelog-data'/.test(gs) && gs.includes('gs-cl-list') && gs.includes('gs-cl-item')
    && gs.includes("e.version === runtimeVersion")
    && !/version:\s*['"]3\.8\.[0-9]/.test(gs); // 面板不写字面量版本（对照走 runtimeVersion）
});

// ============== W6 · 调度台三条反馈（V3.8.6） ==============
console.log('【W6 · 调度台三条反馈（V3.8.6）】');
check('W6-1 ★日详情完全按原型（用户拍板：完全按原型裁剪 + 四格统计下方热力带 · ★W6.1 再随迁带备案：四格统计可点击下钻，DrillCardList 与 groupEventRows 加回日详情，故这两条负锚转正锚；退役的是分析段的四列下钻容器 / 库容变化条 / hintline）：DayDetail 五段结构（md-head 图标+标题+日期 / md-summary 摘要 / dz-stats 四格统计新增调出推进清理 / dz-heat-band 热力带加权分等级强度 / 降序时间线下午在前 / 页脚查看全部记录+导出）；dashboard.css 死样式清零（dz-mcols/dz-dstock/dz-hintline/dz-badge.hi）+ 新类字面量在位（dz-stats/dz-heat-band/dz-day-ic）；flowGroups 降序 b.ts-a.ts 对齐原型', () => {
  const dd = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'));
  const css = codeOnly(read('/newtab/components/dashboard/dashboard.css'));
  const ta = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  return dd.includes('今日战报') && dd.includes('dz-day-ic') && dd.includes('dz-day-title') && dd.includes('dz-day-sub')
    && dd.includes('dz-stats') && dd.includes('sc-create') && dd.includes('sc-call') && dd.includes('sc-status') && dd.includes('sc-del')
    && dd.includes('dz-heat-band') && dd.includes('lvIdx') && dd.includes('intensity')
    && dd.includes('b.ts - a.ts') && dd.includes('查看全部记录')
    && dd.includes("emit('open-log', day)") && dd.includes('EVENT_ACT_LABEL[e.action]')
    && !dd.includes('dz-mcol') && !dd.includes('dz-dstock') && !dd.includes('dz-hintline')
    /* ★W6.1 随迁：下钻加回 ⇒ 这两条由负锚转正锚 */
    && dd.includes('groupEventRows(filtered') && dd.includes('<DrillCardList v-if="drillRows"')
    && !dd.includes('deltaOf(') && !dd.includes('stockAt(')
    && css.includes('.dz-stats') && css.includes('.dz-heat-band') && css.includes('.dz-day-ic')
    && !css.includes('.dz-mcols') && !css.includes('.dz-dstock') && !css.includes('.dz-hintline') && !css.includes('.dz-badge.hi')
    && ta.includes("dz-stats > .dz-stat") && ta.includes('dz-heat-band');
});
check('W6-2（V3.9.1 重指）手边三卡入一张框：任务 / 好奇心 / 资源三列共用 .hand-board 外壳与框内头部，不再各自套框或使用底部 tab', () => {
  const ch = codeOnly(read('/newtab/views/CompassHome.vue'));
  return ch.includes('class="hand-board"') && ch.includes('class="hand-head"')
    && ch.includes('class="hand-grid"') && ch.includes('class="hand-col"')
    && (ch.match(/class="mini-list"/g) || []).length === 3
    && ch.includes('THREE DECKS')
    && !ch.includes('deck-frame') && !ch.includes('bottom-tabs') && !ch.includes('bt-tab');
});
check('W6-3 ★任务卡默认列表视图 + 卡片视图 AI 入口移右上角直跑补全（用户拍板：点图标直接跑补全，不弹菜单）：TaskManagerPanel viewMode 默认 list；卡片视图 3 处 TaskAiMenu 换 TaskAiCorner（列表/看板/项目页保留 TaskAiMenu）；TaskAiCorner 自包含（taic-btn + AI 零静态引用 dynamic import taskEnrich + buildTaskEnrichJob + AiDrawer 懒栈）；手册默认视图文案同步；R147-5 判据按 9+3 拆分', () => {
  const tm = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue'));
  const ca = codeOnly(read('/newtab/components/TaskAiCorner.vue'));
  const m = codeOnly(read('/newtab/manual-data.ts'));
  return tm.includes("ref<'card' | 'list' | 'kanban'>('list')")
    && (tm.match(/<TaskAiCorner :task=/g) || []).length === 3
    && (tm.match(/<TaskAiMenu :task=/g) || []).length === 9
    && tm.includes("import TaskAiCorner from '@/newtab/components/TaskAiCorner.vue'")
    && ca.includes('buildTaskEnrichJob') && ca.includes("import('@/shared/ai/taskEnrich')")
    && ca.includes('class="taic-btn"') && ca.includes("import { AiDrawer } from './lazyAiDrawer'")
    && !ca.includes("from '@/shared/ai/")
    && m.includes('默认列表视图 + 已完成任务自动沉底 + 分组三档');
});

