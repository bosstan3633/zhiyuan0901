/**
 * R174-1 分片纪律的延续 · 98b-r4-visual：像素 A/B 与证据面收尾轮（R4-Ex 让像素 A/B 能当门禁 /
 * R4-Ey 评审交接包数字反漂 / R4-Ez 注释里的退役台面名 / R4-Fb 撤独立弹窗 / R4-Fc Airtable 台名列 /
 * R4-Fd 像素归因 / R4-Fe 场景 DOM 态 / R4-Fg 像素档改形 / R5 收口）。
 * 从 98-r4-gates.cjs 第 679 行**原样搬出**（分片是搬运不是重写，断言零丢失零改写）——搬的原因是
 * 98 被顶到 899 行、99 被顶到 896 行，两片均已贴死 R164-2 的「单片 ≤900 行」刹车，再加一条即破闸；
 * 按既有拍板处置是**加分片而不是放宽上限**。
 * 切点落在 R4-Ex 的注释块起始行（★纪律：切片起点必须落在注释块而非代码行，否则恒假红）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, srcFileEntries, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, getSliceMisses, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');
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
check('R4-Ex④ ★噪声地板是**形状判据**不是数值放宽：HARD 与 TOL 钉死在 6（实测同构建连采抖动 3–6/通道；真变化如采集面板那串 URL 是 232/通道）。★R4-Fg 随迁（用户拍板 A 案）：抖动档原来还要求"带高 ≤8 行"，两条缺一即算变化——9 对同构建连采量到光栅层非确定性会产出「幅度 ≤7、摊在几百行」的差且 DOM 态逐点全同，那条带宽腿于是变成「同一份产物两跑每对必红 1–3 张」的来源，已改由 hardPixels 单独定变化、带宽只报不判（见 R4-Fg①）。HARD 这条腿**没动**，它才是防"整片调淡"的那道闸', () => {
  const t = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  const iC = t.indexOf('const classify = (r) => {');
  const body = t.slice(iC, t.indexOf('\n}', iC) + 2);
  return /^\s*const TOL = 6$/m.test(t) && /^\s*const HARD = 6$/m.test(t) && /^\s*const JITTER_BAND_ROWS = 8$/m.test(t)
    && iC > 0 && body.includes("if (r.hardPixels > 0) return { 档: 'changed', rows }") && body.includes('if (!r.diffPixels) return')
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
check('R4-Fb① ★不可注入页（chrome:// / 扩展页 / Web Store）的降级出口必须是「进应用开对应面板」，不是那个从未进过构建的独立弹窗：background 的 openQuickPanel 在位（有已开新标签页就复用并发消息，一个都没有才新建并带 ?zy-panel=），四个出口都走它（open-tasks / quick-capture / inspire / action.onClicked），App.vue 两种入口都认（消息 zy-quick-panel 与查询参数 zy-panel），且 manifest 的 web_accessible_resources 不再声明 src/popup。★这条同时钉的是"半拉子入口不许回流"：出现 openPopupWindow 或 src/popup 路径即红。★负锚豁免带备案：changelog-data.ts（产品更新日志的用户可见历史叙述，V3.8.0 那条要点本身就是「src/popup/ 删除」这件事的记录）——半拉子入口的形态是**可执行的代码路径**，历史叙述里的路径字面量不是；这与 R4-Eq 把 changelog 列入退役名白名单同形态，不豁免就会逼着改用户可见文案', () => {
  const bg = codeOnly(read('/background/index.ts'));
  const ap = codeOnly(read('/newtab/App.vue'));
  const mf = codeOnly(read('/manifest.ts'));
  return /^\s*async function openQuickPanel\(panel: 'capture' \| 'curio' \| 'taskcapture'\): Promise<void> \{/m.test(bg)
    && (bg.match(/await openQuickPanel\('/g) || []).length === 4
    && bg.includes("type: 'zy-quick-panel', panel") && bg.includes('?zy-panel=${panel}')
    && ap.includes("msg?.type === 'zy-quick-panel'") && ap.includes("get('zy-panel')")
    && !bg.includes('openPopupWindow') && !bg.includes('src/popup') && !mf.includes('src/popup')
    && !srcFileEntries().some(e => !e.rel.includes('changelog-data') && codeOnly(e.text).includes('src/popup'));
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
check('R4-Fd① ★取景侧只钉"量出来确实有效"的那条噪声轴，并且**不许把已证无效的方向加回来**：① calm 的 style 里必须有 `caret-color:transparent`（实测 notion-ov-search 62 px / 只有 1 行 / 幅度 30 / 色偏在一侧＝搜索框光标在闪；钉掉后该场景从变化名单里消失）；② `--disable-lcd-text` **不许回流到代码里**——R4-Fd 曾据"单主题连采两跑 0 差"加它、并把 pool-list 判成文字 AA 模式差，R4-Fe 用**全量两跑**复测：带旗标仍差 368 px、色偏仍只在一侧（A=0 B=376），而 96 张主页面场景的 DOM 几何与计算样式逐点全同 ⇒ 那是光栅层非确定性，旗标管不到 ⇒ 撤。③ 撤的来龙去脉必须留在 args 上方的注释里（负锚吃 codeOnly，注释不算代码；但注释本身要被正锚钉住——下一个人得知道这条猜过、错在哪一步、被什么证据推翻，免得再猜一遍）', () => {
  const raw = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8');
  const code = codeOnly(raw);
  return code.includes('animation:none !important;transition:none !important;caret-color:transparent !important')
    && !code.includes('--disable-lcd-text') && code.includes('--hide-scrollbars')
    && raw.includes('R4-Fe 撤掉 R4-Fd 加的一条旗标') && raw.includes('单主题连采')
    && raw.includes('DOM 几何与计算样式') && raw.includes('光栅层的非确定性');
});
check('R4-Fd② ★img-diff 必须能自己回答「这张为什么算变化」（--why 两条算式，且**都不许自己读像素**）：① 位移抵消——把 B 在 ±2px 十个方向上各平移一次、**每次重新喂给同一把 DIFF_FN** 数变化像素，非零位移能压到 0,0 的 20% 以下即判「整片挪位置」（实测 linear-st-manual 93,410→1,440 @0,-1 ⇒ #127 那族跳变定性完成：1px 位移，不是内容变）；② 单侧色偏——DIFF_FN 顺手算好的 |R−B|>3 计数，只有一侧有且**幅度 ≤12** 才判渲染模式差，幅度更大判「瞬时态（光标/选区）」。★分界用幅度不用行数：行数这条我错过一次——pool-list 只有 2 行（胶囊上下各一条边线）却确实是同一类差 · ★R4-Fe 勘误：这一档曾叫「渲染模式差」并给出处置「加 --disable-lcd-text」，全量复测证伪（旗标压不住），档位现在只报形态、药方改成「先看 DOM 态一致否」', () => {
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

// ============== R4-Fe 证据面补齐：每张截图都要有 DOM 态可对（scene-state） ==============
console.log('【R4-Fe · 场景几何记账与像素归因接上】');
check('R4-Fe① ★每张截图都得有"那一刻的 DOM 态"可对，否则像素红了也没证据：theme-audit 必须把三个取样点（720,58 / 940,859 / 280,500＝三族跳变各自的现场）的元素几何与计算样式记进 scene-state.json，img-diff --why 必须读它并把红图分成「DOM 态一致 ⇒ 差异只在光栅层」与「不一致 ⇒ 点名哪一层变了」。★为什么钉在"两个包装都挂"上：R4-Fd 只包了主页面截图，104 张里 8 张浮层图没有账，于是 apple-ov-search 那条 1 行 / 幅度 30 的差**没有任何活证据可查**——证据面比断言窄，是本项目反复犯的形状', () => {
  const ta = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  const id = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  return ta.includes('const STATE_PTS = [[720, 58], [720, 120], [940, 859], [280, 500]]')
    && ta.includes('await stateOf(page, opt && opt.path)') && ta.includes('await stateOf(ovPage, opt && opt.path)')
    && ta.includes("scene-state.json") && ta.includes('elementsFromPoint')
    && id.includes('function readState(dir)') && id.includes('function stateDiffBrief(a, b)')
    && id.includes('DOM 态：') && id.includes('差异只在光栅层');
});
check('R4-Fe② ★归因不许给假药方：色偏低幅度那一档的文案里**不许再出现 --disable-lcd-text**（那条已被 R4-Fe 全量复测证伪），必须改成指向下一步该看的证据（DOM 态是否一致）；同时"瞬时态差""要人看"两档的处置文字必须还在——归因只报形态与下一步，不替人拍板', () => {
  const id = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8'));
  return !id.includes('--disable-lcd-text')
    && id.includes('实测无效（原因与复测记在 theme-audit 的 args 上方）') && id.includes('先看下面那行 DOM 态是否一致')
    && id.includes('瞬时态差（幅度') && id.includes('要人看：--crop=');
});

// ============== R4-Ff #127 收口：截图前等窗口滚动落定 ==============
console.log('【R4-Ff · 滚动落定与那 1px】');
check('R4-Ff① ★截图前必须等窗口滚动落定（#127 那 1px 的成因就是没等）：resetView 里 scrollTo 之后要**读回 window.scrollY、最多补五次、每次 60ms**，并顺手清 scrollingElement 的 scrollTop。★为什么值得钉成判据：四份全量跑两两成对判，`apple-st-manual` 红的那三对都留着同一句现场证据 `DOM 态：不一致 ⇒ scrollY 0.5→0 ｜ mn-head{y:47.5,h:52} → {y:48,h:52}`——不是平滑滚动（全站 grep `scroll-behavior` = 0 处），是滚动落定与截图抢时间；修后再跑三份两两成对，st-manual 三对全 0 差。锚取行首可执行语句 + 一条顺序锚（等落定必须发生在装 calm 之前），别只锚"文件里有 scrollY 这个词"——scene-state 也读 scrollY，那不算等它落定', () => {
  const ta = codeOnly(fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'));
  return /^\s*const settle = \(\) => \{$/m.test(ta)
    && ta.includes('for (let i = 0; i < 5; i++) { if (settle() === 0) break; await new Promise(r => setTimeout(r, 60)) }')
    && ta.includes('if (de && de.scrollTop !== 0) de.scrollTop = 0')
    && ta.indexOf('const settle =') > 0 && ta.indexOf('const settle =') < ta.indexOf('__zy_calm__');
});

// ============== R4-Fg 像素档按拍板改形（A 案）+ ⌘K 那一帧写进用户可见手册 ==============
console.log('【R4-Fg · 像素档与 ⌘K 取舍】');
check('R4-Fg① ★变化档只由 hardPixels 定（用户 2026-10-04 拍板 A 案），但带宽必须照样报出来、--strict 必须还能咬：classify 里不许再出现「rows > JITTER_BAND_ROWS 就算 changed」那条腿，改成 hardPixels>0 才 changed、其余落抖动并带「带宽超阈」标记；批量输出的抖动档那行必须把标记与「要严用 --strict」打出来。★改判依据必须留在代码注释里（9 对同构建连采：光栅层非确定性 ⇒ 每对必红 1–3 张、scene-state 逐点全同），否则下一个人只看到规则变松、不知道为什么。HARD/TOL 这条腿没动（见 R4-Ex④），它才是防「整片调淡」的闸', () => {
  const raw = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'img-diff.cjs'), 'utf8');
  const t = codeOnly(raw);
  const iC = t.indexOf('const classify = (r) => {');
  const body = t.slice(iC, t.indexOf('\n}', iC) + 2);
  return iC > 0 && body.includes("if (r.hardPixels > 0) return { 档: 'changed', rows }")
    && !body.includes("r.hardPixels > 0 || rows > JITTER_BAND_ROWS")
    && body.includes('带宽超阈: rows > JITTER_BAND_ROWS')
    /* 注释里的改判依据走 raw（codeOnly 会把它剥掉——这条锚第一轮就因此自己红过一次），
       代码里的输出串走 t。两种读法各管一件事，别混成一个 read。 */
    && raw.includes('光栅层非确定性') && raw.includes('要严的时候用 --strict')
    && t.includes('A 案计入抖动；要严用 --strict');
});
check('R4-Fg② ★⌘K 那一帧的取舍必须是用户读得到的一句话（拍板＝保留毛玻璃、接受 ~100ms 阻塞，那就不能只写在内部文档里）：手册「全局检索」章节要有这条 li，且必须同时说清三件事——发生在面板打开之后不影响打字、结论是保留、以及它是"明写不是暗病"的姿态。锚点取那句里的语义片段而不是整句（改文案不必重指，但少一个语义就红）', () => {
  const m = codeOnly(read('/newtab/manual-data.ts'));
  return m.includes('唤起那一帧的取舍') && m.includes('backdrop-filter: blur(20px)')
    && m.includes('一帧约 100ms 的渲染阻塞')
    && m.includes('发生在面板打开之后、不影响你开始打字与检索')
    && m.includes('保留毛玻璃、接受这一帧');
});

// ============== R5 收口：外向影响的代价必须写在用户读得到的地方 ==============
console.log('【R5 · 发版收口的文档账】');
check('R5① ★改到用户数据的那件事，必须写在用户读得到的手册里（不是只写在交付说明里）：R4-Fc 把「所属工作台」列值改成剥图标的台名，代价是**升级后第一次同步会覆盖远端已有的带图标值**——用户在 Base 里按这一列做过筛选/分组/着色的话条件会失配。手册 Airtable 章节必须同时说清三件事：列值写什么、第一次同步会覆盖、要自己去改 Base 条件。锚语义片段不锚整句（改文案不必重指，少一个语义就红）· ★这条判据和 R4-Fg② 是同一族纪律：拍板过的取舍要落到用户可见处，否则"文档与实装不一致"那笔坏账会以新的形式重来', () => {
  const m = codeOnly(read('/newtab/manual-data.ts'));
  return m.includes('「所属工作台」这一列写什么') && m.includes('剥掉图标前缀的台名文字')
    && m.includes('第一次同步会把该列原有的带图标值') && m.includes('筛选/分组/着色')
    && m.includes('资源卡池');
});
