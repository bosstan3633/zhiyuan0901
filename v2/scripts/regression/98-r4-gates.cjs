/**
 * R174-1 分片纪律的延续 · 98-r4-gates：V3.7.x 后半程的门禁/证据轮（R4-Dl ⌘K 面板进视觉门禁、
 * R4-Dm 路由拼法登记、R4-En content 浮层场景、R4-Ep 可选台列表单源、R4-Eq 用户可见文案退役名）。
 * 从 97-r3-rounds 尾部**原样搬出**（分片是搬运不是重写，断言零丢失）——搬的原因是 R4-Eq 的新断言把
 * 97 顶到 956 行，撞上 R164-2 的「每个分片 ≤900 行」刹车；按既有拍板处置是**加分片而不是放宽上限**。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, srcFileEntries, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, getSliceMisses,
} = require('./helpers.cjs');
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
  const iC = t.indexOf('async function closeOverlays');
  return t.slice(iO, iO + 260).includes("'.md-panel, .drawer, .gp-overlay.open'")
    && iC > 0 && t.slice(iC, iC + 700).includes("locator('.gp-overlay.open').click({ position:")
    && t.slice(iC, iC + 700).includes('x: 6, y: 6');
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
  return loc.includes('workspaceId === CURATION_WS_ID') && loc.includes("path: '/', query") && loc.includes('LOCATE_HK')
    && !read('/shared/utils/locate.ts').includes('/workspace/${CURATION_WS_ID}')
    && !codeOnly(read('/newtab/components/GlobalPopups.vue')).includes('/workspace/${CURATION_WS_ID}')
    && !codeOnly(read('/newtab/components/compass/MetricDrillDrawer.vue')).includes('/workspace/${');
});
check('R4-Dm ★采集浮层的「存入位置」下拉不许再让隐藏池冒充一枚台面：实测存量库里那枚 hub 实体排在 workspaces[0]，改前下拉第一项直接印退役实体名「资源台」且是默认选中（手册明写"照那句话去找是找不到的"，结果用户在采集面板里找到了它）；现在台名走 wsName.ts 单源、池那一枚显示 POOL_DISPLAY_NAME，旧文案「存入台面」不许回流 · ★R4-Ep 随迁带备案：选项文本来自单源，判池与剥图标两条从正锚翻成负锚（不许在消费者里抄第二份算式），三条旧腿一条不少', () => {
  /* R4-Ep 随迁（备案）：这一栏的选项文本改由 selectableWsOptions 一处给出——原判据的两条正向锚点
     （在这里判池、在这里剥图标）翻成负锚点：同一份算式不许在消费者里抄第二份；
     「存入位置/无退役名/无裸 w.name 模板」三条腿一条不少。 */
  const ov = codeOnly(read('/content/overlay-impl.ts'));
  const i = ov.indexOf('__zy_cap_ws__');
  const seg = ov.slice(Math.max(0, i - 700), i + 700);
  return i > 0 && ov.includes('selectableWsOptions(d?.workspaces)') && seg.includes('escapeHtml(o.label)')
    && !seg.includes('w.id === CURATION_WS_ID ? POOL_DISPLAY_NAME') && !seg.includes('wsDisplayNameOf(w)')
    && seg.includes('存入位置') && !ov.includes('存入台面</label>')
    && !/option value="\$\{escapeHtml\(w\.id\)\}">\$\{escapeHtml\(w\.name\)\}/.test(seg) && !seg.includes('workspaces?.filter((w: any) => !w.archived)');
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
check('R4-En ★两个 content 浮层终于有像素门禁：theme-audit 必须有 ov-capture（采集面板）与 ov-search（网页 ⌘K）两条场景，且都在**宿主页**上拍（浮层只注入 http/https 页，扩展页里拍到的是空文档），任一判据不过即非零退出。起因是 R4-Dm 在采集下拉里量出一枚本该不可达的退役台面「资源台」且它是默认项——那件事只有真开一次浮层看得见，而 e2e 驱动采集浮层 0 条、本脚本此前浮层场景 0 条', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const i1 = t.indexOf("id: 'ov-capture'");
  const i2 = t.indexOf("id: 'ov-search'");
  return i1 > 0 && i2 > i1
    && t.includes("msg: 'zy-open-capture'") && t.includes("ready: '#__zy_cap_ws__'")
    && t.includes("msg: 'zy-open-search'") && t.includes("ready: '#__zy_si__'")
    && t.includes('chrome.tabs.sendMessage') && t.includes('ovServer.listen')
    && t.includes('if (!ovPage) { ovPage = await ctx.newPage()')
    && t.includes('if (overlayFail.length)') && /overlayFail\.length\) \{\s*console\.log\(`❌ content 浮层判据未过/.test(t)
    && t.includes('DASH_SCENES.length + OVERLAY_SCENES.length');
});
check('R4-En ★采集面板的判据钉的是形状不是条数：真实库里可见台可能只剩一枚（实测台选项=["资源卡池"]，其它台已归档），所以条数不是判据；判据是「选项文本非空 + 全站不许再出现退役实体名『资源台』+ 池那一枚必须显示单源名『资源卡池』+ 同类控件底色只能有一种 + 浮层强调色必须与应用内 --accent 同值（两端各写一份主题映射，早晚会漂）」。第一版我写了 opts.length >= 2，真库当场假红——这条把那个错也钉住', () => {
  const t = stripComments(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const i = t.indexOf("id: 'ov-capture'");
  const seg = t.slice(i, t.indexOf("id: 'ov-search'"));
  /* 切"逻辑那一段"而不是整段：段首有个 `if (!panel) return { ok: false, … }` 的早退分支，
     用 indexOf('return { ok') 会切到它前面、得到空串，而"切片为空"在 includes 下会恒真 */
  const iOk = seg.indexOf('const ok =')
  const okExpr = seg.slice(iOk, seg.lastIndexOf('return {'))
  return i > 0 && iOk > 0 && okExpr.length > 40 && seg.includes("poolOpt.t === '资源卡池'") && seg.includes("t.includes('资源台')")
    && okExpr.includes('opts.length >= 1') && okExpr.includes('opts.every(t => t.length > 0)')
    && !okExpr.includes('opts.length >= 2') && okExpr.includes('bgs.length === 1') && okExpr.includes('accent === exp')
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
    && codeOnly(read('/content/overlay-impl.ts')).includes('selectableWsOptions(d?.workspaces)')
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
check('R4-Ep ★批量移动的目标列表里不许出现池，也不许再用那枚 hub 实体冒充台面：moveWorkspaces 走 boardWsOptions、宿主模板走 label 单源——改前「目标策展台」下拉第一项就是「🗂 资源台」，选中它等于把卡移进池还顺带新建一枚池「待分类」；模板里现拼图标 + wsDisplayNameOf 的旧写法不许回流', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const i = w.indexOf('v-for="w in moveWorkspaces"');
  const seg = w.slice(i, w.indexOf('</select>', i));
  return i > 0 && seg.includes('{{ w.label }}') && !seg.includes('wsDisplayNameOf(w)')
    && read('/newtab/views/Workspace.vue').includes('目标策展台（含当前策展台，可只换分类）')
    && codeOnly(read('/newtab/composables/useWorkspaceBatch.ts')).includes('boardWsOptions(d.value.workspaces)');
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
check('R4-Eq ★退役台面名「资源台」只许活在带理由的三处：字符串字面量现扫（剥注释）与登记表逐文件比条数——多一处红、少一处也红（改表必须出现在 diff 里）。白名单：迁移写入的 hub 实体名（改名=动迁移语义，与 hub 存废待拍板绑在一起）、手册与迁移报告卡里的**退役说明**（那是"早期版本曾叫资源台，现已作废"这句话本身）。界面文案、AI hint/投料标签、Airtable 字段说明一律不许再出现它——R4-Dg 定名单源、R4-Dm 收采集下拉、R4-Ep 收可选台列表，这轮收最后一类：写死的字', () => {
  const root = path.resolve(SCRIPTS_DIR, '..', 'src');
  const REG = {
    'shared/storage/curationMigration.ts': 2,   // R61 迁移给 hub 实体写的 name，用户库实测仍叫「资源台」；显示一律走 wsNameById（R4-Dg），这里不许被当文案改
    'newtab/manual-data.ts': 4,                 // 手册的退役说明与历史叙述（"早期版本顶部导航里有一个资源台的说法已作废"等），R4-De 明确保留这一形态
    'newtab/components/MigrateReportCard.vue': 1 // 整库回退确认里的"回退后分类树会回来，但资源台页面已退役"——历史事实陈述
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
  const py = codeOnly(read('/newtab/composables/usePyramid.ts'));
  const wm = codeOnly(read('/newtab/composables/useWsMeta.ts'));
  const at = codeOnly(read('/shared/storage/airtable.ts'));
  return iDup > 0 && segDup.includes('已经收过了（在「${POOL_DISPLAY_NAME}」里）') && !segDup.includes('已存在于资源台')
    && py.includes('镜像只是引用，打包请在它的源卡上做') && !py.includes('打包请在资源台操作')
    && wm.includes('「资源卡池」是系统空间，不在此删除') && !wm.includes('资源台为系统空间')
    && at.includes('调度台/方向台/资源卡池/策展台名') && !at.includes('调度台/方向台/资源台/策展台名');
});
check('R4-Eq ★改口过的界面文案要留下"旧串不许回来"的锚：左树「全部」计数的口径 title 与金字塔节点「关联资源卡」的 title 都从「资源台」改成了「资源卡池」（前者是 R76-6 的正锚随迁，后者本轮新钉）；两处旧拼法各一条负锚', () => {
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  return w.includes('从资源卡池选择资源卡镜像到该节点') && !w.includes('从资源台选择资源卡镜像到该节点')
    && w.includes('策展台含资源卡池镜像卡') && !w.includes('策展台含资源台镜像卡');
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
    && !wsTpl.includes('R167（OPPO 质感') && wsTpl.includes('class="cat-count"')
    && !ws.includes('parked 的 bookmarkInput') && ws.includes('const pyLayout = computed');
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
    && atLineStart(/^\s*page\.screenshot = async \(opt\) => \{ const r = await orig\(opt\); await censusOf\(page\); return r \}/m)
    && atLineStart(/^\s*ovPage\.screenshot = async \(opt\) => \{ const r = await os\(opt\); await censusOf\(ovPage\); return r \}/m)
    && c.场景数 === pngs && pngs > 90 && Object.keys(c.计数).length === c.token数 && c.token数 > 700
    && !!c.计数['cat-count'] && !c.计数['ts-note'] && !c.计数['goal-node'] && !c.计数['metric-item'] && !c.计数['gs-mc-section'];
});
const ET_RETIRE = {
  '/newtab/components/AiSuggestionDrawer.vue': ['.ai-badge.b-warn', '.ai-badge.b-ok', '.ai-badge.b-danger', '.ai-badge.b-neutral', '.ai-chg-tag.t-new', '.ai-chg-tag.t-edit', '.ai-chg-tag.t-move', '.ai-chg-tag.t-same'],
  '/newtab/App.vue': ['.home-logo'],
  '/newtab/components/GlobalPopups.vue': ['.gp-ai-row', '.gp-curio-src'],
  '/newtab/components/compass/NorthStarPanel.vue': ['.nd-group', '.nd-group-name', '.nd-drag', '.nd-input', '.nd-edit', '.nd-btn', '.nr-row', '.nr-k', '.nr-v', '.nr-actions', '.nd-btn.ghost', '.nr-v.link',],
  '/newtab/components/compass/TaskDetailDrawer.vue': ['.ts-label', '.ts-select', '.ts-input', '.ts-note', '.ts-field', '.ts-rel-up', '.ts-status-chip', '.ts-time-text', '.ts-status-chip.active',],
  '/newtab/components/compass/TaskManagerPanel.vue': ['.batch-tagin'],
  '/newtab/views/CompassHome.vue': ['.cf-go', '.pager', '.pg-num', '.cur-tree-caret', '.picker-item.sys', '.pi-check.pi-ghost',],
  '/newtab/views/CompassTree.vue': ['.node', '.sidebar', '.breadcrumb', '.main-area', '.goals-row', '.goal-col', '.goal-node', '.project-node', '.project-branch', '.vision-node', '.mission-node', '.metric-item', '.metric-name', '.metric-status', '.metrics-wrap', '.tasks-wrap', '.tasks-header', '.sub-tree', '.tree-connector', '.guide-line', '.branch-connector', '.progress-bar', '.progress-fill', '.focus-btn', '.linked-chips', '.add-btn-inline', '.sidebar-item.active', '.sidebar-item .tip', '.breadcrumb .root', '.breadcrumb .sep', '.project-node.primary', '.focus-btn.on', '.vision-node .node-title', '.tm-task-leaf:hover .tml-up',],
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
check('R4-Ev① ★"祖先段整段判死"这条口径要能独立站住，就得先承认旧口径的四处误判并把救活它的四条票钉住：① 逗号选择器列表必须**逐段判**（旧版把整串当一条链，body .module-title .name, body .tc-module-title .tc-name 里第一段断了就把整条报成祖先断，而第二段活着）；② 括号要**配平**剥（:is(a, :not(b)) 用 [^)]* 会在第一个右括号早停，把 :is 的尾巴当成祖先段）；③ 运行时插值的类名（Heatmap 的 `l${lv}` ⇒ .dz-cell.l4）token 匹配天生看不见，要有"插值前缀"票；④ 类名值由**别的文件**的数据表产出（curiosity.ts 的 cls: exploring、DashboardLogDrawer 的 expanded）时，scoped 也要吃"全站精确字符串"这一票。**棘轮就是实跑扫描器两桶为零**：这四条里任何一条被拆掉，对应的规则立刻浮回名单 ⇒ 清零不是"把判据调松"能换来的。ET_RETIRE 已随本批扩到第二批的 40 条退役选择器', () => {
  const p = path.resolve(SCRIPTS_DIR, 'dead-css-scan.cjs');
  const s = fs.readFileSync(p, 'utf8');
  const ran = runGateSync(p, ['--json']);
  let out = null; try { out = JSON.parse(ran.stdout || '') } catch { }
  const ex = (sel) => runGateSync(p, ['--explain', sel]).status === 0;
  return !!out && out.规则总数 > 2900 && out.死.length === 0 && out.祖先断.length === 0
    && s.includes('function splitTopLevel') && s.includes('function stripParens')
    && s.includes('interpPrefixes.add') && s.includes('globalTokens.has(tok)')
    && ex('.metric-item.expanded') && ex('.dz-cell.l4') && ex('body .module-title')
    && ex('.picker-item') && ex('.toggle') && ex('.dz-hl');
});

// ============== R4-Ew 三条运行时触点进 e2e ==============
console.log('【R4-Ew · 采集保存链路 / hover 动作区 / 下钻抽屉】');
check('R4-Ew① ★三条"改了没人报"的链各有了一条真点的 e2e：E2E-40 content 采集面板从 http 宿主页唤起、台下拉默认选中池且显示「资源卡池」、真点保存后核 toast 与**落库那张卡的 workspaceId=zy-curation 且分类留空**；E2E-41 ⌘K 结果行动作区三枚钮 title 齐、hover 前 opacity 为 0 后为 1、点星标**真写库**再点回**真复原**；E2E-42 指标条四种下钻抽屉各自真渲染，且每格按**自己的动作面形状**判（三格=每行一个「定位 ›」，未归档=每行两支归档下拉）。锚点一律取判据表达式而非用例标题——标题留在文件里而条件被删掉，是 R4-Dl 那族失效的老形状', () => {
  const e = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8'));
  return e.includes("type: 'zy-open-capture'") && e.includes("capSelDefault === 'zy-curation'")
    && e.includes('/已入台/.test(capToast)') && e.includes('capRow.ws === \'zy-curation\'') && e.includes('capRow.catEmpty')
    && e.includes('Number(gpRow.actsOpacity) === 0') && e.includes('gpHover > 0.9')
    && e.includes('starAfter === true && starBack === false')
    && e.includes('r.sel === r.rows * 2') && e.includes('r.loc === r.rows')
    && e.includes("题在: title.includes(d.题)");
});
check('R4-Ew② ★content 侧用例的两条环境事实必须留在脚本里（本轮各踩一次）：① MV3 的 http 宿主页里**没有 chrome.storage**（浮层自己走消息，测试取库要回扩展页）——所以库读写一律 page.evaluate，出现 capPage.evaluate 里读 chrome.storage 即红；② 宿主页端口用 listen(0) 现取、用完关，不写死端口（写死会撞本机其它服务，且 theme-audit/perf 同一手法各自起）', () => {
  const e = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8'));
  return /^\s*await new Promise\(r => capServer\.listen\(0, '127\.0\.0\.1', r\)\)/m.test(e)
    && e.includes('capServer.close()') && e.includes("await capPage.goto(`http://127.0.0.1:${capPort}/`")
    && !/capPage\.evaluate\(\(t\) => chrome\.storage/.test(e)
    && /await page\.evaluate\(\(t\) => chrome\.storage\.local\.get\('zy_data_v2'\)\.then\(r => \{\s*const c = \(r\['zy_data_v2'\]\.resources \|\| \[\]\)\.find\(x => x\.title === t\)/.test(e);
});

// ============== R4-Ex 让像素 A/B 能当门禁（#120 的③ / #125） ==============
console.log('【R4-Ex · 跨天时钟钉 / 取景侧消噪 / 整归档像素对照】');

check('R4-Ex① ★跨天像素 A/B 的前提是把时钟钉到指定那一天：theme-audit 的 --freeze-at 在位、非法值实跑必须退 2 并点名怎么改、不传时仍按当天零点冻。默认零点跟着今天走，拿今天的重跑去比历史归档必然整片不同（R4-Ev 实测跨天 86/104 逐字节不同），像素 A/B 因此只能当参考不能当门禁', () => {
  const f = path.resolve(SCRIPTS_DIR, 'theme-audit.cjs');
  const t = codeOnly(fs.readFileSync(f, 'utf8'));
  const r = runGateSync(f, ['--freeze-at=不是个日期']);
  return /^\s*const FREEZE_AT = \(\(\) => \{/m.test(t) && t.includes("argv['freeze-at']")
    && /^\s*if \(v === undefined \|\| v === true\) return Math\.floor\(Date\.now\(\) \/ 86400000\) \* 86400000$/m.test(t)
    && r.status === 2 && /解析不出时间/.test(r.stderr + r.stdout)
    && /process\.exit\(2\)/.test(t);
});
check('R4-Ex② ★采集面板那四张的噪声在取景侧消掉，而不是把宿主服务改成写死端口：pin 钩子挂在 ov-capture 场景里、调用点在 judge 之前（拍的就是钉过的那一框），钉的是链接框常量；宿主页服务仍必须 listen(0) 现取（写死会撞本机其它服务，与 R4-Ew② 同一条口径）', () => {
  const t = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const iPin = t.indexOf('if (ready && sc.pin) await sc.pin(ovPage)');
  return /^\s*pin: async \(pg\) => pg\.evaluate\(\(\) => \{$/m.test(t)
    && t.includes('zy-visual-baseline.invalid') && iPin > 0
    && iPin < t.indexOf('await sc.judge(ovPage, appAccent)')
    && /^\s*await new Promise\(r => ovServer\.listen\(0, '127\.0\.0\.1', r\)\)/m.test(t);
});
check('R4-Ex③ ★像素对照要能一次判整归档（逐张起浏览器时 104 张根本没法当门禁跑）：img-diff 的 --batch 分支在位、两侧张数不齐即红、退出码由有变化的张数决定；且逐张算式只有 DIFF_FN 一份——批量、单对、以及 R4-Fd 的位移抵消三处**共用同一把尺子**（调用点 3 个），getImageData 出现第二次就是有人另抄了一份（★R4-Fd 实测被自己咬一次：--why 第一版抄了逐像素循环，这条当场红）', () => {
  const t = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  return /const DIFF_FN = async/.test(t) && /^\s*async function runBatch\(page, dirA, dirB\) \{$/m.test(t)
    && t.includes("argv.includes('--batch')") && t.includes('张数不齐')
    && /^\s*process\.exit\(changed\.length \|\| 不齐 \? 1 : 0\)$/m.test(t)
    && (t.match(/getImageData/g) || []).length === 1
    /* ★R4-Fd 随迁备案：调用点从 2 个变 3 个——--why 的位移抵消测试**不另抄算式**，而是把 B 平移后
       再喂给同一把 DIFF_FN（第三个调用点）。这条判据真正在守的是"逐像素算式只有一份"，
       那由上一行的 getImageData === 1 钉死；调用点数只是"别有人绕过尺子"的旁证，所以随形态改数字，
       并把 getImageData 那条的优先级写进标题。 */
    && (t.match(/await page\.evaluate\(DIFF_FN/g) || []).length === 3;
});
check('R4-Ex④ ★噪声地板必须是**形状判据**而不是数值放宽：抖动档要求"每个差异像素单通道 ≤HARD"**且**"差异带高 ≤8 行"，两者缺一即算变化；两个阈值都钉死在 6 与 8（实测同构建连采抖动为 3–6/通道、带高 4–6 行；真变化如采集面板那串 URL 是 232/通道、带高 13 行）。把 HARD 调大或把带高去掉，就是把门禁改成"看不见小改动"', () => {
  const t = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  const iC = t.indexOf('const classify = (r) => {');
  const body = t.slice(iC, t.indexOf('\n}', iC) + 2);
  return /^\s*const TOL = 6$/m.test(t) && /^\s*const HARD = 6$/m.test(t) && /^\s*const JITTER_BAND_ROWS = 8$/m.test(t)
    && iC > 0 && body.includes('r.hardPixels > 0 || rows > JITTER_BAND_ROWS') && body.includes('if (!r.diffPixels) return')
    && /if \(mx > hard\) \{/.test(t) && t.includes('hardPixels: hardN');
});

// ============== R4-Ey 评审交接包数字反漂 ==============
console.log('【R4-Ey · 评审交接包与真源对齐】');

check('R4-Ey① ★评审交接包的数字不许漂：透视卡 §2.1 的合计行与 §2.2 的债务候选条数，必须与 02_代码索引.md 现读到的值一致（索引是生成物、由 R163-1 守着不漂 ⇒ 真源只有一处，卡上抄的数字必须跟着走）；本卡还必须写明数据时效并附与上一版的差异账', () => {
  const PKG = path.resolve(SCRIPTS_DIR, '..', '..', '评审交接包');
  const idx = fs.readFileSync(path.resolve(PKG, '02_代码索引.md'), 'utf8');
  const card = fs.readFileSync(path.resolve(PKG, '01_项目透视卡.md'), 'utf8');
  const m = idx.match(/规模：\*\*(\d+) 个源文件 \/ ([\d,]+) 行\*\*/);
  if (!m) return false;
  const h = idx.indexOf('## 一、结构性债务候选');
  if (h < 0) return false;
  const sec = idx.slice(h, idx.indexOf('\n## ', h + 5) > 0 ? idx.indexOf('\n## ', h + 5) : idx.length);
  const rows = [...sec.matchAll(/^\| `[^`]+` \| (\d+) \|$/gm)];
  const big = rows.filter(r => Number(r[1]) >= 800).length;
  return big > 0 && card.includes(`| **合计** | **${m[1]}** | **${m[2]}** |`)
    && card.includes(`### 2.2 结构性债务候选（≥800 行的单文件，实测 ${big} 个）`)
    && /^> \*\*数据时效\*\*：/m.test(card) && card.includes('## 附 · 与 09-23 版的差异账');
});


// ============== R4-Ez 注释里的退役台面名：只许出现在"写明是历史"的地方 ==============
console.log('【R4-Ez · 注释旧称清账棘轮】');
check('R4-Ez① ★注释里的退役台面名（资源台 / 策展中心 / 主航线 / 项目总览 / CompassShell / LighthousePanel）只许出现在"同一处写明这是历史"的行里：现扫 src 的注释，命中退役名又找不到历史标记词即红。R4-Ez 把 22 处"用退役名描述现状"的注释逐条改成池/任务调度的现行称呼后清零，此后新增即红（要复现清单：把本判据的 RETIRED/MARK 两个表抄进一行 node 脚本跑 src 即可，无需新工具）', () => {
  const RETIRED = ['资源台', '策展中心', '主航线', '项目总览', 'CompassShell', 'LighthousePanel'];
  const MARK = /退役|已删|已下架|旧|原|历史|曾|转正|随|不再|R\d{2,}|V3\.|迁入|搬|改前|改后|改造前|此前|当年|既有口径|第[一二三四五六七八九十百卅零〇\d]+轮|REQ-/;
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|vue)$/.test(e.name)) files.push(p);
    }
  })(base);
  let offenders = 0;
  for (const p of files) {
    const L = fs.readFileSync(p, 'utf8').split('\n');
    for (let i = 0; i < L.length; i++) {
      const raw = L[i], s = raw.trim();
      // 注释文本：整行注释（// 或块注释续行 * 或 /* 或 <!--），以及代码行尾的 // 之后
      // （协议里的 `//` 不算注释起点——'http://' 会让后半串被当注释扫）
      let cmt = '';
      if (/^(\/\/|\*|\/\*|<!--)/.test(s)) cmt = s;
      else { const k = raw.indexOf('//'); if (k > 0 && raw[k - 1] !== ':') cmt = raw.slice(k); }
      if (!cmt || !RETIRED.some(r => cmt.includes(r))) continue;
      if (MARK.test(cmt)) continue;
      const ctx = L.slice(Math.max(0, i - 2), i + 1).join(' ');
      if (MARK.test(ctx)) continue;
      offenders++;
    }
  }
  return offenders === 0 && files.length > 150;
});

// ============== R4-Fb 撤掉从未进过构建的独立弹窗，降级出口改「进应用开面板」 ==============
console.log('【R4-Fb · 不可注入页的降级出口】');
check('R4-Fb① ★不可注入页（chrome:// / 扩展页 / Web Store）的降级出口必须是「进应用开对应面板」，不是那个从未进过构建的独立弹窗：background 的 openQuickPanel 在位（有已开新标签页就复用并发消息，一个都没有才新建并带 ?zy-panel=），四个出口都走它（open-tasks / quick-capture / inspire / action.onClicked），App.vue 两种入口都认（消息 zy-quick-panel 与查询参数 zy-panel），且 manifest 的 web_accessible_resources 不再声明 src/popup。★这条同时钉的是"半拉子入口不许回流"：出现 openPopupWindow 或 src/popup 路径即红', () => {
  const bg = codeOnly(read('/background/index.ts'));
  const ap = codeOnly(read('/newtab/App.vue'));
  const mf = codeOnly(read('/manifest.ts'));
  return /^\s*async function openQuickPanel\(panel: 'capture' \| 'curio' \| 'taskcapture'\): Promise<void> \{/m.test(bg)
    && (bg.match(/await openQuickPanel\('/g) || []).length === 4
    && bg.includes("type: 'zy-quick-panel', panel") && bg.includes('?zy-panel=${panel}')
    && ap.includes("msg?.type === 'zy-quick-panel'") && ap.includes("get('zy-panel')")
    && !bg.includes('openPopupWindow') && !bg.includes('src/popup') && !mf.includes('src/popup')
    && !srcFileEntries().some(e => codeOnly(e.text).includes('src/popup'));
});
check('R4-Fb② ★降级出口的两种入口各有一条真跑的 e2e（E2E-43），锚点取算 ok 的那个表达式里的片段：?zy-panel=curio 要真开出好奇面板（含"等不够就补等一次再判死"的形状）、background 复用已开新标签页发的 zy-quick-panel 要真开出采集面板并按标题文本认，两条都成立才算过——只测一条会放过"另一条其实接不上"的半拉子实现', () => {
  const e = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8'));
  return e.includes("base + '?zy-panel=curio#/'") && e.includes("textarea.gp-curio-text")
    && e.includes("if (!qCurio) { await page.waitForTimeout(2500)")
    && e.includes("type: 'zy-quick-panel', panel: 'capture'") && e.includes("capHead.includes('快速采集资源卡')")
    && e.includes('qCurio === true && msgOk === true');
});

// ============== R4-Fc 推给 Airtable 的「所属工作台」列值 = 剥图标的显示名（用户 2026-10-04 拍板"全站去前缀"） ==============
console.log('【R4-Fc · Airtable「所属工作台」出网值形态】');
check('R4-Fc① ★「所属工作台」列值必须走剥图标的显示名单源：`Workspace.name` 存的是「icon + 空格 + 名称」（图标另有 icon 字段，两份都写），改前台内卡与镜像行各自 `find(w => w.id === …)?.name` 把实体名原样推出去 ⇒ E2E-44 实测出网三行里两行是「🧪 探针策展台」、一行「资源卡池」——**同一列两种形态**，而界面、手册、设置页「同步范围」写的都是不带图标的那份，用户在 Base 里按这列筛选/分组/着色得同时匹配两种写法。现两处都走 wsNameById（与界面同一口径，池仍显 POOL_DISPLAY_NAME、查不到返回空串由调用方兜底）。★值口径变更是外向影响：下一次同步会覆盖远端已有的带前缀值。负锚两条——ad-hoc 取实体名不许回流、wsNameWithIcon 不许进这条链（拼图标只用于"可选台去处"的下拉 label）', () => {
  const a = codeOnly(read('/shared/storage/airtable.ts'));
  return a.includes("import { POOL_DISPLAY_NAME, wsNameById } from '../utils/wsName'")
    && a.includes('wsName: wsNameById(d.workspaces, r.workspaceId)')
    && a.includes('const targetName = wsNameById(d.workspaces, p.targetWsId)')
    && !/find\(w => w\.id === (r\.workspaceId|p\.targetWsId)\)\?\.name/.test(a)
    && !a.includes('wsNameWithIcon');
});
check('R4-Fc② ★这条链的运行时证据必须真在跑且不许退化成"只看同步成功回执"：E2E-44 的三条腿缺一不可——① 拦 `**://api.airtable.com/**` 并把 POST/PATCH 的 fields 逐条收进 Node 侧数组（量的是**离开机器那一列的值**，源码断言看不到 rowToFields 之后的形态）；② 判据是「带图标前缀 0 行」**加上三格各自点名**（台内卡 / 镜像行 / 池卡各自的值），只判有无图标会放过"整列取错字段"；③ 桩对 /meta/bases/ 返回 15 列全名——少一列 ensureColumns 就会去 POST 建列，测试就变成了改远端结构。凭据一律是明写的桩值 pat-e2e-stub-only，不许出现真 PAT 的形状', () => {
  const e = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'e2e.cjs'), 'utf8'));
  return e.includes("page.route('**://api.airtable.com/**'") && e.includes('atCells.push(r.fields)')
    && e.includes('iconRows.length === 0') && e.includes('/^\\p{Extended_Pictographic}/u')
    && e.includes("cellOf('card-e2e-fc') === '探针策展台'") && e.includes("cellOf('card-e2e-fc2:m:ws-e2e-fc') === '探针策展台'")
    && e.includes("cellOf('card-e2e-fc2') === '资源卡池'") && e.includes("u.includes('/meta/bases/')")
    && e.includes('fields: AT_FIELDS')
    && e.includes("atCells.length > 0") && e.includes("pat: 'pat-e2e-stub-only'");
});

// ============== R4-Fd 同构建跳变两族归因 + 把"归因"做成尺子的一部分（#130 关闭 / #127 推进） ==============
console.log('【R4-Fd · 像素 A/B 的噪声轴与归因】');
check('R4-Fd① ★取景侧两条噪声轴必须钉在脚本里（都是量出来的，不是猜的）：① chromium 参数带 `--disable-lcd-text`——notion-deck-pool-list 同构建两跑差 368 px，位移抵消测试证明几何完全对齐（0,0 最小，平移 1px 反涨到 1,426），而色偏统计是**一侧 376 个像素 |R−B|>3、另一侧 0 个**（平均 4.98 vs 2.94）⇒ 一侧 LCD 子像素、一侧灰度；② calm 的 style 里带 `caret-color:transparent`——notion-ov-search 那一族是 62 px / 只有 1 行 / 幅度 30 / 色偏在一侧，搜索框光标在闪。★两条都只动取景，产品一行没改', () => {
  const t = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8');
  return /args:\s*\[[^\]]*'--disable-lcd-text'[^\]]*\]/.test(t)
    && t.includes('animation:none !important;transition:none !important;caret-color:transparent !important')
    && t.includes('--hide-scrollbars');
});
check('R4-Fd② ★img-diff 必须能自己回答「这张为什么算变化」（--why 两条算式，且**都不许自己读像素**）：① 位移抵消——把 B 在 ±2px 十个方向上各平移一次、**每次重新喂给同一把 DIFF_FN** 数变化像素，非零位移能压到 0,0 的 20% 以下即判「整片挪位置」（实测 linear-st-manual 93,410→1,440 @0,-1 ⇒ #127 那族跳变定性完成：1px 位移，不是内容变）；② 单侧色偏——DIFF_FN 顺手算好的 |R−B|>3 计数，只有一侧有且**幅度 ≤12** 才判渲染模式差，幅度更大判「瞬时态（光标/选区）」。★分界用幅度不用行数：行数这条我错过一次——pool-list 只有 2 行（胶囊上下各一条边线）却确实是渲染模式差', () => {
  const t = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  return t.includes('const WHY_SHIFTS = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [2, 0], [-2, 0]]')
    && /^const SHIFT_FN = async/m.test(t) && /^function 归因\(r, best, crop\) \{$/m.test(t)
    && t.includes('await page.evaluate(DIFF_FN, [a64, shifted, TOL, HARD])')
    && t.includes('best.n <= zero * 0.2') && t.includes('oneSided && maxD <= 12')
    && t.includes('if (Math.abs(d1[i] - d1[i + 2]) > 3) chromaA++')
    && t.includes('if (Math.abs(d2[i] - d2[i + 2]) > 3) chromaB++')
    && t.includes("argv.includes('--why')");
});
check('R4-Fd③ ★归因只许「多说话」，不许「改判」：--why 必须挂在已经判成「有变化」的分支里（changed.push 在前、归因在后），且**不能动退出码**——一张「整片挪 1px」的图仍然是红（要人拍板是不是布局回退），只是红的时候直接告诉你它红在哪一类。锚三件：changed.push 早于位移循环、退出码那行仍是 `changed.length || 不齐`、兜底分支必须明写「要人看」并给 --crop 坐标（归因不明的图**不许**被判成噪声放过去）', () => {
  const t = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  const iP = t.indexOf('changed.push('), iW = t.indexOf('for (const [dx, dy] of WHY_SHIFTS)'), iE = t.indexOf('process.exit(changed.length || 不齐 ? 1 : 0)');
  return iP > 0 && iW > iP && iE > iW
    && t.includes('非位移、非单侧色偏') && t.includes('要人看：--crop=')
    && /^\s*process\.exit\(changed\.length \|\| 不齐 \? 1 : 0\)$/m.test(t);
});
