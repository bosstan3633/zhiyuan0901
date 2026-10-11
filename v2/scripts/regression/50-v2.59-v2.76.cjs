/**
 * R174-1 分片 · 50-v2.59-v2.76：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

console.log('【第九十轮 · V2.59.0：工具条收敛与右键菜单（R8 + R10 + R17）】');
/** 页头段（第一条 </div> 即闭合，段内无嵌套 div） */
/** 工具条段（以「③ 资源策展区」注释为界，避开气泡内的嵌套 div） */
/** 右键菜单函数体（到 B6 拖拽段为止） */
// R115：样式外置 workspace.css——锚点换源（断言口径不变）

// V3.7.0（R179）随迁重写：镜像域整体退役——教学气泡（wsh-help / HUB_HELP_TEXT）与「· 可镜像到策展台」一并退出，
// 不常驻 ≠ 删除的口径由 git 历史承担（原文案零残留为正例）。
check('R90-1 ★ R8-①（V3.7.0 重指）：常驻教学文案「· 可镜像到策展台」零出现；教学气泡（wsh-help / HUB_HELP_TEXT）随镜像域退役', () => {
  const summary = segOf(HEAD90, '<span class="wsh-summary"', '</span>');
  return !HEAD90.includes('· 可镜像到策展台') && !summary.includes('可镜像到策展台')
    && !HEAD90.includes('wsh-help') && !WS90.includes('HUB_HELP_TEXT');
});
check('R90-2 R8-①（V3.7.0 退役）：HUB_HELP_TEXT 四段文案现行源码零残留（卡片在此存储为真身 / 📡 单卡 / 📤 分类）', () => {
  return !WS90.includes('HUB_HELP_TEXT') && !WS90.includes('卡片在此存储为真身')
    && !WS90.includes('📡 单卡') && !WS90.includes('📤 分类');
});
check('R90-3 R8-② ★R1.5 重指带备案：主 CTA 前置位置不变，锚随「台内新建=论证卡」改 openNewArgument', () => {
  // R1.5：主 CTA 唯一 = 论证卡新建（openNewResource 仍存在于脚本段供论点创建，但模板内零出现）
  return !TB90.includes('openNewResource')
    && TB90.indexOf('openNewArgument') < TB90.indexOf('class="toolbar-search"')
    && (TB90.match(/openNewArgument/g) || []).length === 1;
});
check('R90-4 R8-②：右推职责交给 .toolbar-spacer（.toolbar-search 不再自带 margin-left:auto）', () => {
  const search = segOf(STYLE90, '.toolbar-search {', '}');
  return STYLE90.includes('.toolbar-spacer { flex: 1; }') && !search.includes('margin-left: auto');
});
// V3.7.0（R179）随迁重写：资源台 fallback 定位语（wsHeadDescFallback / wsh-locator）随退役下线，
// 页头描述收敛为单形态——用户自写描述内联（wsHeadDescOwn）。
check('R90-5 ★ R8-③（V3.7.0 重指）：页头描述单形态——用户自写描述内联（wsHeadDescOwn）；fallback 定位语零残留', () => {
  return !HEAD90.includes('{{ wsHeadDesc }}')
    && HEAD90.includes('v-if="wsHeadDescOwn"')
    && !HEAD90.includes('wsHeadDescFallback') && !HEAD90.includes('wsh-locator')
    && !WS90.includes('资源卡唯一存储');
});
check('R90-6 R10：右键菜单补「编辑详情」——直达抽屉（改前须先单击卡进详情）', () => {
  return CTX90.includes('编辑详情') && CTX90.includes('cb: () => openResource(r)');
});
check('R90-7 R10：右键菜单补星标（两态文案 + 调既有 toggleStar）', () => {
  return CTX90.includes('r.starred ?') && CTX90.includes('⭐ 星标') && CTX90.includes('cb: () => toggleStar(r)');
});
// V3.7.0（R179）退役：镜像推送入口（📡 镜像到策展台 · isHub 门控）随资源台退役整体下线；
// 引用侧（策展台内镜像卡定位源卡 locateMirrorSource）保留——本断言转守退役边界 + 引用侧不误伤。
check('R90-8 ★ R10（V3.7.0 退役）：右键菜单「📡 镜像到策展台」入口零残留（isHub 门控/推送调用下线）；引用侧 locateMirrorSource 仍在', () => {
  return !CTX90.includes('isHub') && !CTX90.includes('镜像到策展台') && !CTX90.includes('openMirrorCard')
    && WS90.includes('locateMirrorSource');
});
check('R90-9 ★ R17：wsOptions 首位注入补救（R165-A 重指：策展台字段整体退役——表单不再出现 wsOptions/CURATION_WS_ID 注入，静默迁移通道随之焊死）', () => {
  const f = read('/newtab/components/ResourceEditForm.vue');
  return !f.includes('wsOptions') && !f.includes('CURATION_WS_ID') && f.includes('策展台」下拉') && f.includes('真身静默迁');
});
check('R90-10 R10 附带（V3.7.0 重指）：Icon 仍备 edit/star/share 三定义；真身菜单用 edit/star + 中心论点 target；📡 镜像位退役（share 调用零残留）', () => {
  return ICON90.includes('edit:') && ICON90.includes('star:') && ICON90.includes('share:')
    && CTX90.includes("icon: 'edit'") && CTX90.includes("icon: 'star'")
    && !CTX90.includes("icon: 'share'") && CTX90.includes("icon: 'target'");
});
check('R90-11 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第九十一轮 · V2.60.0：主攻直通调度台速览】');
/** 速览条段（以「左右分栏」注释为界，避开模板内的嵌套 template） */

check('R91-1 调度台消费 focusedProjects（改前唯一消费方在方向台，调度台零消费 ⇒ 手册承诺落空）', () => {
  return CH91.includes('focusedProjects') && STRIP91_C.includes('focusedProjects.length')
    && CH91.includes('useCompass()');
});
check('R91-2（R120-TB1 修订）主攻并入合流方向条', () => { const h = read('/newtab/views/CompassHome.vue'); const ci = h.indexOf('<MetricBar>'); const bar = h.indexOf('</MetricBar>'); const seg = h.slice(ci, bar); return ci >= 0 && seg.includes('class="cf-label"') && h.indexOf('class="card focus"') > bar;  });
check('R91-3 ★ 性能红线：进度/停滞/待办走预计算索引 focusMeta，模板内不逐项调用遍历型函数', () => {
  return CH91.includes('const focusMeta = computed(')
    && !STRIP91_C.includes('projectProgress(') && !STRIP91_C.includes('isProjectStalled(')
    && !STRIP91_C.includes('projectTasksOf(')
    && STRIP91_C.includes('focusMeta.get(p.id)');
});
check('R91-4 手册承诺的「14 天无推进自动亮 ⚠ 停滞」兑现（停滞取既有 isProjectStalled 口径）', () => {
  return stripComments(FOCUS_FN91).includes('isProjectStalled(p)') && STRIP91_C.includes('cf-stall')
    && STRIP91_C.includes('停滞');
});
check('R91-5 点击直达项目详情同路由（/compass/projects?p=<id>）★R3-B1 随宿主改靶：调度台主攻速览与方向树 ▾ 菜单「进入项目详情页」走同一条路由（原第三处=主航线聚焦条，随退役消失）', () => {
  const t = read('/newtab/views/CompassTree.vue');
  return CH91.includes("router.push({ path: '/compass/projects', query: { p: p.id } })")
    && t.includes("path: '/compass/projects', query: { p: proj.id, from: 'tree' }");
});
check('R91-6 无主攻时给轻引导，且**可点去方向台**（不是一句死文案）', () => {
  return STRIP91_C.includes('cf-hint') && STRIP91_C.includes("router.push('/compass')")
    && STRIP91_C.includes('去方向台指定');
});
check('R91-7 models 注释不再把主攻指向已退役的「任务中心顶部」（R49 已删 /tasks 路由）', () => {
  const mi = read('/shared/models/index.ts');
  const i = mi.indexOf('isFocused: boolean');
  const before = mi.slice(Math.max(0, i - 420), i);
  return i > 0 && before.includes('直通调度台速览')
    && !before.includes('（最多2个，同步至任务中心顶部）');
});
check('R91-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第九十二轮 · V2.61.0：浮层交互手感与未归档引导（D1 + D2 + E1）】');
// R105 重指：saveCapture 加 forceNew 参数（D3），切片头锚去闭括号
check('R92-1 ★ D1：浮层正文零「50ms 延迟聚焦」残留（四处已统一走 focusWhenReady）', () => {
  // 否定断言：注释里的同名字样已由 stripComments 剥离（§五·补十六：块注释亦剥）
  // ⚠ 判据用 [^\n]* 而非 [^)]* —— 后者穿不过 `setTimeout(() => input?.focus(), 50)` 里 focus() 的右括号，
  // 会漏检（R92 活性验证实测：注入探针后本条仍为绿，是断言的洞，不是代码对）。
  return !/setTimeout\([^\n]*,\s*50\s*\)/.test(OV92_C);
});
check('R92-2 D1：focusWhenReady 一个口径、四处调用（搜索 / 资源采集 / 任务采集 / 好奇采集）', () => {
  const calls = (OV92_C.match(/focusWhenReady\(/g) || []).length;
  return OV92_C.includes('function focusWhenReady(') && calls >= 5; // 1 处定义 + 4 处调用
});
check('R92-3 D1：兜底是「下一帧仅在失焦时才重聚焦」，不是无条件重复 focus', () => {
  const s = stripComments(FOCUS_FN92);
  return s.includes('requestAnimationFrame(') && s.includes('document.activeElement !== el');
});
check('R92-4 ★ D2：搜索框 Esc 两段式——有内容先清空并重跑搜索，空才关闭', () => {
  return ESC92.includes("document.getElementById('__zy_si__')")
    && ESC92.includes('if (input && input.value)')
    && ESC92.includes("input.value = ''")
    && ESC92.includes("runSearch('')")
    && ESC92.includes('closeOverlay()');
});
check('R92-5 D2 边界：右端「Esc」按钮仍直接 closeOverlay()（显式点击 ≠ 反射性按键，语义不同是有意的）', () => {
  return OV92_C.includes('id="__zy_esc__"')
    && OV92_C.includes("document.getElementById('__zy_esc__')?.addEventListener('click', closeOverlay)")
    && OV92_C.includes('title="关闭浮层（键盘 Esc 会先清空搜索框，空了才关闭）"');
});
check('R92-6 E1 ★W4（V3.8.4）随迁：采集回执不再有「未归档 · 去归位」一支——两枚下拉退役后统一入资源卡池，未分类/未归档这个分支随之消失。回执只剩「✓ 已入 资源卡池 · Enter 打开看板」一条，池名走 POOL_DISPLAY_NAME 单源', () => {
  return CAP_FN92.includes('已入 ${POOL_DISPLAY_NAME} · Enter 打开看板')
    && !CAP_FN92.includes('✓ 已入台 · 未归档 · Enter 去归位')
    && !CAP_FN92.includes('✓ 已入台 · Enter 打开看板');
});
check('R92-7 E1：任务卡未挂项目时回执带「未归档 · 去归位」；好奇采集 toEnd 条件保留', () => {
  return TC_FN92.includes('const filed = !!task.projectId')
    && TC_FN92.includes('未归档 · Enter 去归位')
    && OV92_C.includes('focusWhenReady(textarea, { toEnd: !selection })');
});
check('R92-8 T4 ★ 顺带修：无项目时回执写「调度台」而非「方向台」（与 /?hl= 落点一致）', () => {
  return TC_FN92.includes("'/?hl=' + task.id") && !TC_FN92.includes("'方向台'");
});
check('R92-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第九十三轮 · V2.62.0：浮层视觉收敛（A5 + A6）】');
/** A6 要清零的硬编码浅色：图标六色 + 徽标五色（均为"写死 + 无暗色覆盖"） */
check('R93-1 ★ A6：图标/徽标的硬编码浅底色清零，统一走 --zy-bg-3（含采集面板 .zy-cap-icon）', () => {
  return HEX93.every(h => !OV93_C.includes(h))
    && OV93_C.includes('font-size:15px;flex-shrink:0;background:var(--zy-bg-3);border:1px solid var(--zy-border);}')
    && OV93_C.includes('font-size:18px;flex-shrink:0;background:var(--zy-bg-3);border:1px solid var(--zy-border);}');
});
check('R93-2 A6 信息零损失：类型/状态仍靠 iconText 形状区分（📄 / ✓◐○ / 💡 一个未删）', () => {
  return OV93.includes("iconClass: 'res', iconText: '📄'")
    && OV93.includes("iconClass: `task-${t.status}`, iconText: statusIcon")
    && OV93.includes("const statusIcon = t.status === 'done' ? '✓' : t.status === 'doing' ? '◐' : '○'")
    && OV93.includes("iconClass: 'curio', iconText: '💡'");
});
check('R93-3 A6 三档令牌：--zy-warn / --zy-ok 明【暗】两套齐备（暗色值须在 media 块内）', () => {
  const iMedia = OV93.indexOf('@media (prefers-color-scheme: dark)');
  const iDark = OV93.indexOf('--zy-warn:#D9A03C;--zy-ok:#6FCE8B;');
  return OV93.includes('--zy-warn:#A66A00;--zy-ok:#1E7A34;') && iMedia > 0 && iDark > iMedia;
});
check('R93-4 A6 徽标三档：进行中=强调 / 高优先级=警示 / 已完成=中性+去饱和', () => {
  return OV93.includes('.zy-badge.status-doing{background:color-mix(in srgb, var(--zy-accent) 14%, transparent);color:var(--zy-accent);}')
    && OV93.includes('.zy-badge.prio-high{background:color-mix(in srgb, var(--zy-warn) 16%, transparent);color:var(--zy-warn);}')
    && /zy-badge\.status-done\{[^}]*opacity:\.6/.test(OV93);
});
check('R93-5 ★ A6：正文零 style="color:#BFC3C9" 残留（明色下浅灰几乎看不见，两处改 --zy-text-4）', () => {
  return !OV93.includes('color:#BFC3C9')
    && (OV93.split('style="color:var(--zy-text-4);font-weight:400"').length - 1) === 2;
});
check('R93-6 A6：.zy-saved-icon 走令牌（默认 --zy-ok / .warn 用 --zy-warn），无内联硬编码色', () => {
  return OV93.includes('color:var(--zy-ok);') && OV93.includes('.zy-saved-icon.warn{')
    && OV93.includes('<div class="zy-saved-icon warn">⚠️</div>')
    && !OV93.includes('zy-saved-icon" style=');
});
check('R93-7 A5 Tab 行轻量：无背景块，当前项用下划线 + 文字色（维持 R77 C2 中性口径，不引入强调色）', () => {
  return /\.zy-type-tab\{[^}]*border-bottom:2px solid transparent/.test(OV93)
    && /\.zy-type-tab\.active\{[^}]*border-bottom-color:var\(--zy-text-3\)/.test(OV93)
    && !/\.zy-type-tab\{[^}]*background:/.test(OV93)
    && !OV93.includes('.zy-type-tab:hover{color:var(--zy-text-2);background:');
});
check('R93-8 ★ A5 去重落点：chip 只在有输入时出现（判据含 lastQuery）；无输入时由 Tab 行 active 承担', () => {
  return OV93.includes("chip.style.display = (searchType === 'all' || !lastQuery) ? 'none' : 'inline-flex'");
});
check('R93-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第九十四轮 · V2.63.0：调度台首屏减重与完成态（B2 + B3）】');
/** B3 完成态样式段（.today-cards 去饱和 → .cur-tree-caret 之前），用于"安静"否定断言 */
check('R94-1 B2：curTreeOpen 存在', () => { const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return !h.includes('curTreeOpen') && pc.includes('metric-head2');  });
check('R94-2 B2：折叠时 .cur-cols 单列', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('curColsStyle') && !h.includes('cur-cols');  });
check('R94-3 ★ B2：任务树用 v-if 门控', () => { const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return !h.includes('curTreeOpen') && pc.includes('class="task-rows"');  });
check('R94-4 B2 能力保留：.cur-split 与 startCurSplitDrag 仍在', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('cur-split') && !h.includes('startCurSplitDrag');  });
check('R94-5 B3：focusAllDone = 非空 && every(done)（空列表不算完成）', () => {
  return CH94_C.includes('todayFocusList.value.length > 0 && todayFocusList.value.every(s => s.done)');
});
check('R94-6 B3：完成态挂在 .card.focus 上，.today-cards 走 filter: saturate( 去饱和 ★R175 重指带备案：去饱和幅距 .5→.65（新原型 spec，仍低饱和+安静收束哲学不变）', () => {
  return CH94.includes('<div class="card focus" :class="{ \'all-done\': focusAllDone }">')
    && CH94.includes('.card.focus.all-done .today-cards { filter: saturate(.65); }');
});
check('R94-7 ★ B3 安静（R120-TB2 文案对齐原型）：完成行「✓ 今日三件事已闭环 · 专注带来从容」；完成态样式零 --danger / 零 animation / 零百分比', () => {
  return TODAY94.includes('✓ 今日三件事已闭环 · 专注带来从容')
    && !DONE_STYLE94.includes('--danger') && !DONE_STYLE94.includes('animation') && !DONE_STYLE94.includes('%');
});
check('R94-8 ★ B2 不持久化：curTreeOpen 不写 saveUIPrefs / UIPrefs（写了就变成"记住上次"，与"默认折叠"矛盾）', () => {
  return !/saveUIPrefs\([^)]*curTreeOpen/.test(CH94_C)
    && !CH94_C.includes('ui?.curTreeOpen') && !CH94_C.includes('curTreeOpen:');
});
check('R94-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第九十五轮 · V2.64.0：P1 收官审计与清单坏账清偿（G7 真相）】');
/** R95：G7（cardCols 纳入界面偏好包）此前分散在 R66-3（导出整段）与 R72-9（导入归一）两条历史断言里，
 *  没有一条从"列数偏好"角度把往返串起来；清单却长期标"G7 待排期"。本轮补守门 + 文档清偿。 */
check('R95-1 ★ G7 往返闭环：导出侧 exportAll 并入 loadUIPrefs 整段 uiPrefs，导入侧 sanitizeCardCols 归一后落库', () => {
  return GS.includes('async function exportAll') && GS.includes('loadUIPrefs')
    && GS.includes('{ ...safeData, uiPrefs }')
    && GS.includes('sanitizeCardCols(ui.cardCols)') && GS.includes('saveUIPrefs({ cardCols: cols })')
    && CC95_C.includes('export function sanitizeCardCols');
});
check('R95-2 G7 三模块键同源：sanitizeCardCols 的键集合取自 CARD_COLS_DEFAULT（新增模块键自动跟随，不会漏归一）', () => {
  return CC95_C.includes('CARD_COLS_DEFAULT: Record<CardColsKey, number> = { curio: 4, task: 5, res: 6 }')
    && CC95_C.includes('for (const key of Object.keys(CARD_COLS_DEFAULT)')
    && !CC95_C.includes("['curio', 'task', 'res']");
});

console.log('【第九十六轮 · V2.65.0：P2 首轮勘验对账与坏账清偿 + 文档失真修复（零业务代码改动）】');
/** R96：P2 资源台组三项（R9/R11/R12）勘验全为坏账——能力早已交付、04-20 清单一直标「待排期」，
 *  与 R95 的 G7 同类（R9 随 R89/W5 交付；R11 由 stats.ts 统一入口 + R70 修复消解；R12 自第卅三轮即存在）。
 *  本轮零业务代码：① 把三项能力用断言钉住，防止再次劣化为坏账；
 *  ② 把两处「AI 接手最危险」的文档失真回正并纳入门禁——架构文档「无 IndexedDB」（附件层第卅九轮即上线）
 *  与 v2/README 版本停在 V2.14.2（后者自本轮成为版本同步第 6 处）。 */
check('R96-1 ★ P2 资源台组三项能力在位 ★R1.5 重指带备案：rc-add-card 锚随「台内新建=论证卡」改 openNewArgument——starred 筛选（R89/W5）+ 抽屉 recordResourceOpen 统一入口（R70）+ 网格末尾 rc-add-card', () => {
  return WS96.includes("const FILTER_KEYS = ['all', 'url', 'file', 'obsidian', 'hasLink', 'brokenPath', 'hasAssets', 'starred', 'hot']")
    && WS96.includes('starred: (r) => !!r.starred')
    && WS96.includes('class="rc-add-card"') && WS96.includes('@click="openNewArgument"')
    && RDD96.includes("import { recordResourceOpen } from '@/shared/storage/stats'")
    && RDD96.includes('recordResourceOpen(store.data, r)');
});
check('R96-2 架构文档事实守卫：存储段含 IndexedDB / zy_assets 附件层事实，「无 IndexedDB」失真表述零命中', () => {
  return ARCH96.includes('IndexedDB') && ARCH96.includes('zy_assets') && !ARCH96.includes('无 IndexedDB');
});
check('R96-3 v2/README 版本行纳入门禁（版本同步第 6 处）：版本行随版本锚走，V2.14.2 失真零命中', () => {
  return README96.includes('**产品版本**：' + CUR_VTAG) && !README96.includes('V2.14.2');
});

console.log('【第九十七轮 · V2.66.0：浮层检索升级与键盘收口（A8 + A9 + D4 + D5）】');
/** R97：P2 浮层组首批四条，全部落 overlay-impl.ts。A8 空态「最近调出 · 近 7 天」（顺带修热词行
 *  type 误标真 bug：此前一律标 res，任务/好奇/策展台行 Enter 会误按资源逻辑分发）；A9 `#标签`/`@项目`
 *  前缀直筛（对齐主应用 R89 口径）；D4 资源采集边界说明（模型无 projectId，走提案「或明确边界并说明」
 *  分支，零迁移）；D5 document 级 Esc 收口（R92 登记遗留：焦点一离开输入框 Esc 即失效、表单浮层无 Esc）。 */
check('R97-1 ★ A8 空态：「最近调出 · 近 7 天」段（7 天窗口 + lastCalledAt 降序 + 最常用段按 id 去重）+ 热词行按真实 type 分发', () => {
  return OV97.includes('🕐 最近调出 · 近 7 天')
    && OV97.includes('(x.raw.lastCalledAt || 0) >= nowTs - WEEK_MS')
    && OV97.includes('.sort(function (a: any, b: any) { return (b.raw.lastCalledAt || 0) - (a.raw.lastCalledAt || 0) })')
    && OV97.includes('!recentIdSet.has(String(x.id || \'\'))')
    && OV97.includes('const toRow = function (r: any) {')
    && OV97.includes('type: r.type, iconClass: r.iconClass, iconText: r.iconText')
    && !OV97.includes("{ type: 'res', iconClass: 'res', iconText: '📄', id: r.id, title: r.title, ws: '', cat: '', badges: [], raw: r }");
});
check('R97-2 A9 前缀直筛：parseOverlayQuery（# 交集 / @ 收窄 / 单字符回落普通词），四类型消费 + 高亮只吃 kw', () => {
  return OV97.includes('function parseOverlayQuery')
    && OV97.includes("if (tok.length > 1 && tok[0] === '#') tags.push(tok.slice(1).toLowerCase())")
    && OV97.includes("else if (tok.length > 1 && tok[0] === '@') proj = tok.slice(1).toLowerCase()")
    && OV97.includes('pq.tags.every')
    && OV97.includes('const projHit = (name: any) => !pq.proj ||')
    && OV97.includes('if (pq.proj) return // R97（A9）：`@项目` 下资源卡不隶属项目，排除')
    && OV97.includes('hlKw = parseOverlayQuery(lastQuery).kw');
});
check('R97-3 D4 资源采集边界说明：表单文案 + .zy-cap-boundary 令牌样式（零新增字段、零迁移）', () => {
  return OV97.includes('资源卡不挂项目——资源由台面与分类组织，任务才是行动归属') && OV97.includes('卡间零挂载红线')
    && OV97.includes('.zy-cap-boundary{font-size:var(--zy-fs-xs);line-height:1.5;color:var(--zy-text-3);padding:8px 20px 0;}')
    && !OV97.includes('__zy_cap_proj__');
});
check('R97-4 D5 document 级 Esc 收口：openOverlay 注册（capture）/ closeOverlay 移除 + savedState 让位 + 焦点在输入框让位两段式', () => {
  return OV97.includes('function onDocEsc')
    && OV97.includes("document.addEventListener('keydown', onDocEsc, true)")
    && OV97.includes("document.removeEventListener('keydown', onDocEsc, true)")
    && OV97.includes('if (savedState) return // 回执态有自己的 document 级监听，让位')
    && OV97.includes('if (e.target === input) return // 输入框自己的两段式 handler 管（target 阶段），避免双重处理');
});

console.log('【第九十八轮 · V2.67.0：策展台组三件（W7 + W8 + W9）】');
/** R98：P2 策展台组三条，全部落 Workspace.vue（与 R97 浮层组对称）。W7 金字塔层级折叠
 *  （布局层收口而非渲染层隐藏，父节点跨度只跨可见子组）；W8 指标条 5→3 格（来源构成本就与
 *  总数格 hint 同源、最近更新降页头摘要且保住流水下钻入口）；W9 分组标题补「含 N 个子分类」
 *  （直属口径与左树聚合口径写明，消「对不上账」观感）。零数据模型改动、零迁移。 */
check('R98-1 W7 金字塔层级折叠：pyFold 三档（仅 L2/到 L3/全部）+ placeCat 深度收口 + 控制条 pyramidLevels>=2 门控', () => {
  return WS98.includes("const pyFold = ref<'l2' | 'l3' | 'all'>('all')")
    && WS98.includes("pyFold.value === 'l2' ? 0 : pyFold.value === 'l3' ? 1 : Number.POSITIVE_INFINITY")
    && WS98.includes('const kids = depth >= maxDepth ? [] : (catIdx.value.childrenOf.get(cat.id) || []).filter(x => !placed.has(x.id))')
    && WS98.includes('v-if="pyramidLevels.length >= 2" class="py-fold"')
    && WS98.includes('@click="pyFold=\'l2\'"') && WS98.includes('@click="pyFold=\'l3\'"') && WS98.includes('@click="pyFold=\'all\'"');
});
check('R98-2 W8 策展台指标条 5→3 格：来源构成零命中（并入总数 hint）+ 最近更新降页头 wsh-upd 且保留流水下钻', () => {
  return WS98.includes('.ws-metrics { display: grid; grid-template-columns: repeat(3, 1fr);')
    && !WS98.includes('🔀 来源构成')
    && WS98.includes("class=\"wsh-upd\" title=\"查看最近更新流水\" @click.stop=\"openDrill('recent')\"")
    && WS98.includes('· 更新 {{ lastUpdateText }}');
});
check('R98-3 W9 分组标题补含子分类数：groupChildCount（uncat→0）+ 卡片/列表两处组标题同款呈现', () => {
  const occ = WS98.split('· 含 {{ groupChildCount(g.key) }} 个子分类').length - 1;
  return WS98.includes('function groupChildCount(key: string): number {')
    && WS98.includes("if (key === 'uncat') return 0")
    && WS98.includes('return catIdx.value.childrenOf.get(key)?.length || 0')
    && occ === 2;
});
