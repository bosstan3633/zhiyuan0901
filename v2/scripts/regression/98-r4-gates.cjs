/**
 * R174-1 分片纪律的延续 · 98-r4-gates：V3.7.x 后半程的门禁/证据轮（R4-Dl ⌘K 面板进视觉门禁、
 * R4-Dm 路由拼法登记、R4-En content 浮层场景、R4-Ep 可选台列表单源、R4-Eq 用户可见文案退役名）。
 * 从 97-r3-rounds 尾部**原样搬出**（分片是搬运不是重写，断言零丢失）——搬的原因是 R4-Eq 的新断言把
 * 97 顶到 956 行，撞上 R164-2 的「每个分片 ≤900 行」刹车；按既有拍板处置是**加分片而不是放宽上限**。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
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
    'popup/App.vue': 2,                 // 降级独立弹窗：action 无 default_popup，靠命令 chrome.windows.create 打开。实测 dist/src/popup/index.html 仍引 ./main.ts（构建没打这个入口）⇒ 打开即白屏；本轮不动它——修法是补构建入口还是撤降级路径属产品取舍，挂 #117 待拍板
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
