/**
 * R174-1 分片 · 40-v2.47-v2.59：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, POOL_PANEL, DECK_CONTROLS, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');

console.log('【第七十七轮 · V2.46.0：浮层主题化（A1 主题接入 + A2 轻 scrim + C2 主色稀缺）】');
check('R77-1 浮层硬编码品牌色清零（#0E7A4E / #FDFDFC / #1A1D23 全文零命中，含注释）', () => {
  const o = read('/content/overlay-impl.ts');
  return !o.includes('#0E7A4E') && !o.includes('#FDFDFC') && !o.includes('#1A1D23');
});
check('R77-2 浮层 --zy-* 变量体系：明色为默认 + prefers-color-scheme 暗色覆盖', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes('--zy-bg:') && o.includes('--zy-text:') && o.includes('--zy-accent:')
    && o.includes('@media (prefers-color-scheme: dark)') && o.includes('--zy-on-accent');
});
check('R77-3（R156 解禁改写）四主题强调色与 tokens.css 一一对应（防漂移：改任一侧回归必红）', () => {
  const o = read('/content/overlay-impl.ts');
  const t = read('/shared/styles/tokens.css');
  const keys = ['linear', 'apple', 'raycast', 'notion'];
  /* R156：accent 解禁，四主题各自独立（R124~R155 期间此处四项全为 #5E6AD2） */
  const vals = ['#5E6AD2', '#8452E0', '#1E6FD9', '#9E3FAF'];
  return keys.every(function (k, i) {
    return o.includes(k + ': { accent: ') && o.includes(vals[i])
      && t.includes('--accent: ' + vals[i] + ';') && t.includes("data-theme='" + k + "'");
  });
});
check('R77-4 顶部绿色渐变装饰条（.zy-panel::before）已移除', () => {
  const o = read('/content/overlay-impl.ts');
  return !o.includes('.zy-panel::before') && !o.includes('linear-gradient(90deg,transparent,');
});
check('R77-5 A2 轻 scrim：rgba(0,0,0,.18) + blur 6px（原 blur(20px) 退役，页面内容仍可辨）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes('.zy-scrim{position:absolute;inset:0;background:rgba(0,0,0,.18);}')
    && o.includes('background:rgba(0,0,0,.18);backdrop-filter:blur(6px);') && !o.includes('blur(20px)');
});
check('R77-6 A2 浮层自身加 1px 边框与加强阴影（遮罩变轻后靠边界撑层级）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes('border:1px solid var(--zy-border);') && o.includes('0 32px 72px rgba(0,0,0,.22)');
});
check('R77-7 C2 强调色只保留主按钮 / 焦点环 / 当前选中行（chip、类型页签、分段控件、台徽标已中性化）', () => {
  const o = read('/content/overlay-impl.ts');
  const rule = (sel) => { const i = o.indexOf(sel); return i < 0 ? '' : o.slice(i, o.indexOf('}', i)); };
  return o.includes('.zy-btn-primary{background:var(--zy-accent)')
    && o.includes('border-left-color:var(--zy-accent)')
    && o.includes(':focus{border-color:var(--zy-accent)')
    && !rule('.zy-search-chip{').includes('--zy-accent')
    && !rule('.zy-type-tab.active{').includes('--zy-accent')
    && !rule('.zy-seg-btn.active{').includes('--zy-accent')
    && !rule('.zy-badge.ws{').includes('--zy-accent');
});
check('R77-8 applyThemeAccent 存在且在 openOverlay 内被调用（强调色取知源当前主题）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes('async function applyThemeAccent()') && o.includes('void applyThemeAccent()')
    && o.indexOf('void applyThemeAccent()') > o.indexOf('function openOverlay');
});
check('R77-9 主题读取失败回落默认 linear（try/catch + 兜底取值）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes("let theme = 'linear'") && o.includes('THEME_ACCENT[theme] || THEME_ACCENT.linear!')
    && o.includes('catch {') && o.includes("root.style.setProperty('--zy-accent', c.accent)");
});

console.log('【第七十八轮 · V2.47.0：浮层回执轻量化与三件事闭环（A3 + A7）】');
/** 截取具名函数体——断言只看实现，不被注释或同名字符串干扰 */
check('R78-1 A3 保存回执 toast 化：showSaved 只做「关浮层 + 一行 toast」，不再写整屏确认块', () => {
  const o = read('/content/overlay-impl.ts');
  const body = fnBody(o, 'function showSaved(', 'function clearSavedState');
  return o.includes('function showSaved(toastMsg: string, openAction: (() => void) | null)')
    && body.includes('closeOverlay()') && body.includes('showToast(toastMsg, 2500)')
    && !body.includes('zy-saved-title') && !body.includes('panel.innerHTML');
});
check('R78-2 A3 自动关闭 5000 → 2500（回执定时器统一走 clearSavedState）', () => {
  const o = read('/content/overlay-impl.ts');
  // ★V3.8.42 P0-4 精度修订：原负锚是全文件 `!o.includes(", 5000)")`，在 content 单文件下靠
  // 「恰好别处不用 5000」侥幸成立。overlay-impl 搬走 174 行样式、/content/overlay-impl.ts 改为
  // 返回 content 全量聚合后，DOM 节点清理里那个真·无关的 `setTimeout(…, 5000)`（el.remove 兜底，
  // 与回执时长无关）被聚合进来，负锚当场咬自己。
  // ★这就是负锚的通用病：**「某字面量在全文件里不存在」≠「在某处不存在」**，聚合会放大它。
  // 修法按既有纪律「豁免条件必须逐个旧值对齐它出现那一句的语义」：把范围收到**回执那一句**，
  // 而不是把 5000 从全文件里一刀切掉。
  return o.includes('savedTimer = setTimeout(clearSavedState, 2500)')
    && !/savedTimer\s*=\s*setTimeout\(\s*clearSavedState\s*,\s*5000\s*\)/.test(o);
});
check('R78-3 A3 例外：重复卡确认视图维持整屏（showDupConfirm 未被牵连）', () => {
  const o = read('/content/overlay-impl.ts');
  const body = fnBody(o, 'function showDupConfirm(', '/** R78（A3）');
  return body.includes('zy-saved-title') && body.includes('该页面已收录') && body.includes('可定位到原卡，或仍然新建一张') && body.includes('__zy_dup_force__');
});
check('R78-4 A7 仅任务卡提供「加入今日三件事」入口（渲染分支带 g.type 守卫）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes("const focusHtml = g.type === 'task'") && o.includes('data-focus-id=')
    && o.includes("b.textContent = on ? '✓ 已入选' : '→ 三件事'");
});
check('R78-5 A7 已接入 ArrowRight，且 Ctrl+Enter 语义未改（仍为定位并打开详情抽屉）', () => {
  const o = read('/content/overlay-impl.ts');
  const arrow = fnBody(o, "} else if (e.key === 'ArrowRight') {", '} else if (e.key === \'Tab\') {');
  const enter = fnBody(o, "} else if (e.key === 'Enter') {", "} else if (e.key === 'ArrowRight') {");
  return arrow.includes('void addTaskToDailyFocus(selItem)') && arrow.includes("selItem.type !== 'task'")
    && enter.includes('openSearchLocator(selItem)') && enter.includes('openSearchResult(selItem)')
    && enter.includes('if (e.ctrlKey || e.metaKey) {');
});
check('R78-6 A7 ≤3 槽硬上限（常量 FOCUS_LIMIT = 3 + 写入前长度判断）', () => {
  const o = read('/content/overlay-impl.ts');
  const body = fnBody(o, 'async function addTaskToDailyFocus(', 'function renderResults');
  return o.includes('const FOCUS_LIMIT = 3') && body.includes('if (list.length >= FOCUS_LIMIT)')
    && body.includes('pendingReplaceSlot === null');
});
check('R78-7 A7 去重按 sourceId（集合由 dailyFocus[todayKey] 派生，已入选直接定位不写库）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes("const list: any[] = dataCache?.dailyFocus?.[todayKeyStr()] || []")
    && o.includes('String(s?.sourceId || \'\')')
    && o.includes('if (todayFocusSourceIds.has(taskId)) { showToast(\'该任务已在今日三件事中\'); focusLocateTask(item); return }');
});
check('R78-8 A7 跨上下文合并：写入前 loadData 绕过 1500ms 缓存，写后同步 dataCache', () => {
  const o = read('/content/overlay-impl.ts');
  const body = fnBody(o, 'async function addTaskToDailyFocus(', 'function renderResults');
  return body.includes('const d = await loadData()') && !body.includes('await getData()')
    && body.includes('await saveData(d)') && body.includes('dataCache = d; dataCacheAt = Date.now()');
});
check('R78-9 A7 定位分流：有 projectId 走项目详情，无走调度台高亮', () => {
  const o = read('/content/overlay-impl.ts');
  const body = fnBody(o, 'function focusLocateTask(', 'async function addTaskToDailyFocus');
  return body.includes("'/compass/projects?p=' + t.projectId") && body.includes("'/?hl=' + id")
    && body.includes("type: 'zy-open-route'");
});
check('R78-10 A7 写入的槽位与 CompassHome.selectTaskForSlot 同构（sourceType/sourceId/text/done）', () => {
  const o = read('/content/overlay-impl.ts');
  const c = read('/newtab/views/CompassHome.vue');
  const body = fnBody(o, 'async function addTaskToDailyFocus(', 'function renderResults');
  return body.includes("sourceType: 'task'") && body.includes('sourceId: taskId')
    && body.includes('done: t?.status === \'done\'') && body.includes('doneAt: t?.completedAt')
    && c.includes("sourceType: 'task'") && c.includes('sourceId: task.id') && c.includes('doneAt: task.completedAt');
});

console.log('【第七十九轮 · V2.48.0：资源池两视图信息量对齐（R1 收尾）】');
/** V3.9.8：旧策展台卡片 / 列表 / 看板三视图随单一画布退役。
 *  现役资源池保留网格与列表两种视图；两者都从卡面常驻动作区直达 AI、置顶、镜像、删除。
 *  原断言的产品语义不变：高频动作同序、打开走单击 / 双击 / 右键，不在卡面重复占位。 */
check('R79-1（V3.9.8 随迁）资源池网格一级动作 = AI徽标 / 星标 / 镜像 / 置顶 / 删除；打开走单击详情、双击链接、右键更多', () => {
  const seg = RES_CARD_ACTIONS;
  const a = seg.indexOf('<CardAiEntry :card="r" />');
  const s = seg.indexOf('toggleStar(r)');
  const m = seg.indexOf('openMirror(r)');
  const p = seg.indexOf('togglePin(r)');
  const d = seg.indexOf('removeCard(r)');
  return a >= 0 && s > a && m > s && p > m && d > p
    && !seg.includes('openMoveOne(r)') && !seg.includes('fixLink(r)')
    && !seg.includes('openMirrorCard(r)')
    && POOL_PANEL.includes('@dblclick="onCardDblClick(r)" @contextmenu="openCtx($event, r)"');
});
check('R79-2（V3.9.8 随迁）池卡右键菜单保留完整长尾：打开详情 → 星标 → 置顶 → 复制链接 → 删除；危险项恒居底', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const fn = stripComments(segOf(pool, 'function openCtx(', '/* ===== R2-⑧ 新建单卡'));
  const iOpen = fn.indexOf("label: '打开详情'");
  const iStar = fn.indexOf("r.starred ? '取消星标' : '星标'");
  const iPin = fn.indexOf("r.pinned ? '取消置顶' : '置顶'");
  const iCopy = fn.indexOf("label: '复制链接'");
  const iDel = fn.indexOf("label: '删除（进回收站）'");
  return iOpen >= 0 && iStar > iOpen && iPin > iStar && iCopy > iPin && iDel > iCopy
    && !fn.includes('openMoveOne') && !fn.includes('挂载到任务') && !fn.includes('openMirrorCard');
});
check('R79-3（V3.9.8 随迁）资源池列表动作条与网格同序：AI徽标 → 星标 → 镜像 → 置顶 → 删除', () => {
  const row = segOf(POOL_PANEL, '<span class="pcp-r-acts">', '</span>\n          </div>');
  const a = row.indexOf('<CardAiEntry');
  const s = row.indexOf('toggleStar(r)');
  const m = row.indexOf('openMirror(r)');
  const p = row.indexOf('togglePin(r)');
  const d = row.indexOf('removeCard(r)');
  return a >= 0 && s > a && m > s && p > m && d > p
    && !row.includes('openMoveOne(r)')
    && !row.includes('openMirrorCard(r)');
});
check('R79-4（V3.9.8 随迁备案）资源池列表与网格共用同一份 poolCards 排序读数：列表保留日期列，调用热度由“最近调出”排序与筛选承接；旧 rr-calls / rc-heat 随策展台三视图退役', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes('class="pcp-date"')
    && pool.includes("sortBy.value === 'called' ? (r.callCount || 0)")
    && pool.includes("id: 'called', label: '已调出'")
    && pool.includes("id: 'never', label: '从未调出'")
    && !pool.includes('class="rr-calls"') && !pool.includes('class="rc-heat"');
});
check('R79-5（V3.9.8 随迁备案）旧看板随资源池两视图退役（池卡无状态列可看）；网格 / 列表动作区共用常驻 pcp-r-acts，卡片定位与网格状态仍由 data-rid / picked 表达', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes('<span class="pcp-r-acts">')
    && pool.includes(':data-rid="r.id"')
    && pool.includes(':class="{ flash: highlightId === r.id, picked: selected.has(r.id) }"')
    && !pool.includes('class="kc-card"') && !pool.includes('class="kc-actions"');
});
check('R79-6（V3.9.8 随迁）池卡星标有三处同源入口：右键、卡面按钮、详情抽屉；旧看板 kc-star 零回流', () => {
  const drawer = read('/newtab/composables/useResourceDrawer.ts');
  return drawer.includes("r.starred ? '☆ 取消星标' : '⭐ 星标'")
    && drawer.includes('function toggleStar(r: ResourceCard)')
    && POOL_PANEL.includes("r.starred ? '取消星标' : '星标'")
    && (POOL_PANEL.match(/@click\.stop="toggleStar\(r\)"/g) || []).length >= 3
    && !POOL_PANEL.includes('kc-star');
});
check('R79-7（V3.9.8 随迁备案）调用次数读数从卡面迁移到排序 / 筛选数据口径：最近调出按 callCount，已调出 / 从未调出按 lastCalledAt；旧 kc-calls 随看板退役', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes("sortBy.value === 'called' ? (r.callCount || 0)")
    && pool.includes("calledFilter.value === 'called' ? !!r.lastCalledAt : !r.lastCalledAt")
    && !pool.includes('kc-calls');
});
check('R79-8（V3.9.8 随迁备案）资源池只呈现池卡源卡，不存在镜像引用侧；镜像推送统一走 openMirror → ResourceMirrorModal，旧三视图 locateMirrorSource / removeMirror 引用侧随策展台镜像列表退役', () => {
  return !RES_CARD_ACTIONS.includes('openMirrorCard(r)')
    && !RES_ROW_ACTIONS.includes('openMirrorCard(r)')
    && RES_CARD_ACTIONS.includes('openMirror(r)')
    && RES_ROW_ACTIONS.includes('openMirror(r)')
    && !RES_ROW_ACTIONS.includes('locateMirrorSource(r)')
    && !KANBAN_ACTIONS.includes('locateMirrorSource(r)')
    && POOL_PANEL.includes('<ResourceMirrorModal :open="mirrorOpen"');
});

console.log('【第八十轮 · V2.49.0：附件卡闭环（R13 导入改为附件卡 + R14 开放附件卡打开）】');
// R100 重指：导入实现拆入 useWorkspaceImport（宿主保留绑定与入口面）
check('R80-1 R13 导入建卡带 zy-asset:// 链接 + assets（不再是只存文件名的哑卡）', () => {
  return IMPORT_FN.includes("link: `zy-asset://${id}`") && IMPORT_FN.includes('assets: [meta]')
    && IMPORT_FN.includes("linkType: 'file'");
});
check('R80-2 R13 putAsset 真写附件本体（导入链路落 IndexedDB，非仅存 meta）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return IMPORT_FN.includes('await putAsset(id, f)') && w.includes("from '@/shared/storage/assets'");
});
check('R80-3 R13 一文件一卡：循环内每卡 assets 恰 1 项，标题取去扩展名文件名', () => {
  return IMPORT_FN.includes('assets: [meta]') && IMPORT_FN.includes('title: stripExt(f.name) || f.name')
    && IMPORT_FN.includes('d.value.resources.unshift(');
});
check('R80-4 R13 不支持类型跳过不建卡，末尾汇总提示（skipped 数组 + ⚠ 已跳过）', () => {
  return IMPORT_FN.includes('const skipped: string[] = []') && IMPORT_FN.includes('skipped.push(f.name)')
    && IMPORT_FN.includes('⚠ 已跳过 ${skipped.length} 个不支持的文件');
});
check('R80-5 R13 guessAssetKind 抽为共享工具，AssetManager 改 import（全文零重复实现）', () => {
  const am = read('/shared/components/AssetManager.vue');
  const ak = read('/shared/utils/assetKind.ts');
  const w = read('/newtab/views/Workspace.vue');
  return ak.includes('export function guessAssetKind(') && ak.includes('export const ASSET_KIND_MB')
    && am.includes("from '@/shared/utils/assetKind'") && !am.includes('function guessKind(name: string, mime: string)')
    && read('/newtab/composables/useWorkspaceImport.ts').includes("from '@/shared/utils/assetKind'");
});
check('R80-6 R13 导入 input 的 accept 已列支持类型（图片 / HTML / PDF）★R2-⑧ 随迁：input 随入口搬到「资源卡池」面板', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  // ★R4-Eu 随迁备案：原终点 '/>' 不在了——R2-⑧ 把导入入口搬进池面板后这枚 input 不再自闭合（行尾是 `>`），
  // 切片一路吃到文件尾，accept 串是在整份文件里被找的。换成同一行尾的 @change 作为活边界。
  const inp = segOf(pool, '<input ref="fileImportInput"', '@change="handleFileImport"');
  return inp.includes('accept="image/*') && inp.includes('.pdf') && inp.includes('.html');
});
check('R80-7 R14 zy-asset:// 三分支齐全：image 走 AssetPreview / html·pdf 走 openHtmlAsset（★W17-C02 重指带备案：分支语义一件未减，只把 `return` 改成 `return true` —— openResourceLink 改返回 boolean 供调度台「最近调出」单击分流，image/html/pdf 三条分支仍由 useResourceOpen 同一份实现承载）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return OPEN_LINK_FN.includes("if (meta.kind === 'image') { void openImageAsset(meta); return true }")
    && OPEN_LINK_FN.includes("if (meta.kind === 'html' || meta.kind === 'pdf') { openHtmlAsset(meta); return true }")
    && w.includes('<AssetPreview :open="previewOpen"') && w.includes('async function openImageAsset(');
});
check('R80-8 R14 附件本体缺失提示「重新上传」（不静默失败）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const openImg = segOf(w, 'async function openImageAsset(', 'function openResourceLink');
  return openImg.includes('请重新上传') && OPEN_LINK_FN.includes('请重新上传');
});
check('R80-9 R1 遗留：字段池 resource 组 tags 默认 visible: true', () => {
  const d = read('/shared/storage/defaults.ts');
  // 注意 next 用 '\n  ]'（数组收尾）而非 ']'——字段里 options: [...] 内部就有 ']'
  const res = segOf(d, 'const resource: FieldDef[] = [', '\n  ]');
  return res.includes("{ key: 'tags', label: '标签', type: 'tags', visible: true");
});
check('R80-10 R1 遗留：存量迁移幂等（tagsVisibleMigratedAt 标记 + 只跑一次）', () => {
  const r = read('/shared/storage/repository.ts');
  const m = read('/shared/models/index.ts');
  return r.includes('if (!data.tagsVisibleMigratedAt)') && r.includes('data.tagsVisibleMigratedAt = Date.now()')
    && r.includes('tag.visible = true') && m.includes('tagsVisibleMigratedAt?: number');
});

console.log('【第八十一轮 · V2.50.0：附件徽标三档与一击直达（R15）】');
/** 去整行注释——否定断言（"不再有…"）最容易被注释里保留的历史写法绊倒 */
check('R81-1 R15 徽标三档独立计数：image / pdf / html 各自 filter，PDF 不再并入 HTML 档', () => {
  const s = stripComments(BADGE);
  return s.includes("const imgCount = computed(() => list.value.filter(a => a.kind === 'image').length)")
    && s.includes("const pdfCount = computed(() => list.value.filter(a => a.kind === 'pdf').length)")
    && s.includes("const htmlCount = computed(() => list.value.filter(a => a.kind === 'html').length)")
    && !s.includes('length - imgCount');
});
check('R81-2 R15 模板三档 chip 齐全且顺序为 图(🖼) → PDF(📕) → HTML(🧾)', () => {
  const at = (s) => BADGE_TPL.indexOf(s);
  return BADGE_TPL.includes('class="ab-chip ab-img"><Icon name="image" :size="13"/> {{ imgCount }}')
    && BADGE_TPL.includes('class="ab-chip ab-pdf"><Icon name="book" :size="13"/> {{ pdfCount }}')
    && BADGE_TPL.includes('class="ab-chip ab-html"><Icon name="receipt" :size="13"/> {{ htmlCount }}')
    && at('ab-img') < at('ab-pdf') && at('ab-pdf') < at('ab-html')
    && BADGE.includes('.ab-pdf { }');
});
check('R81-3 R15 徽标单击分流：单个一击直达、多个才弹列表；title 随数量变', () => {
  const fn = segOf(BADGE, 'function onBadgeClick(', '// ---- 文件列表浮层');
  const t = segOf(BADGE, 'const badgeTitle = computed(', 'function onBadgeClick');
  return BADGE_TPL.includes('@click.stop="onBadgeClick"') && BADGE_TPL.includes(':title="badgeTitle"')
    && fn.includes('if (!has.value) return')
    && fn.includes('if (list.value.length === 1) { void openAsset(list.value[0]); return }')
    && fn.includes('openList()')
    && t.includes('点击预览') && t.includes('点击打开') && t.includes('点击查看 ${n} 个附件');
});
check('R81-4 R15 附件摘要抽共享 assetSummary：三档齐全、空档不输出', () => {
  return ASSET_KIND.includes('export function assetSummary(')
    && ASSET_KIND.includes('if (imgs) parts.push(`${imgs} 图`)')
    && ASSET_KIND.includes('if (pdfs) parts.push(`${pdfs} PDF`)')
    && ASSET_KIND.includes('if (htmls) parts.push(`${htmls} HTML`)')
    && ASSET_KIND.includes("return parts.join(' · ')");
});
check('R81-5 R15 出口二 · 卡片字段值改调共享 assetSummary（不再本地算 HTML 数）', () => {
  const seg = segOf(FIELDS, "case 'assets'", "case 'workspaceId'");
  return FIELDS.includes("import { assetSummary } from './assetKind'")
    && seg.includes('return assetSummary(')
    && !stripComments(seg).includes('length - imgs');
});
check('R81-6 R15 出口三 · CSV 导出改调共享 assetSummary（三出口同源）', () => {
  const seg = segOf(GS, "case 'assets':", 'default: {');
  return GS.includes("import { assetSummary } from '@/shared/utils/assetKind'")
    && seg.includes('return assetSummary(r.assets)')
    && !stripComments(seg).includes('length - imgs');
});
check('R81-7 R15 口径错误零残留：三出口正文均无「总数减图片数」写法', () => {
  return !stripComments(BADGE).includes('length - img')
    && !stripComments(FIELDS).includes('length - img')
    && !stripComments(GS).includes('length - img');
});
check('R81-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十二轮 · V2.51.0：挂载到任务（R4）】');
// R102 重指：挂载实现拆入 useWorkspaceBatch
check('R82-1（V3.9.8 随迁备案：挂载到任务整体退役）资源池网格 / 列表动作条零挂载入口 + 池卡右键菜单零挂载项 + 卡面仍收敛到 AI / 置顶 / 镜像 / 删除', () => {
  const drawer = stripComments(read('/newtab/composables/useResourceDrawer.ts'));
  const pool = stripComments(POOL_PANEL);
  return RES_CARD_ACTIONS.includes('<CardAiEntry :card="r" />')
    && !RES_CARD_ACTIONS.includes('mount')
    && RES_ROW_ACTIONS.includes('<CardAiEntry')
    && !RES_ROW_ACTIONS.includes('mount')
    && !drawer.includes('挂载到任务') && !drawer.includes('openMountOne')
    && !pool.includes('openMountOne') && !pool.includes('mountTaskOptions');
});
check('R82-2（V3.9.8 随迁）池卡一级动作 AI徽标居首，星标 → 镜像 → 置顶 → 删除；网格 / 列表同序，移动分类与断链补全零回流', () => {
  const seq = (seg) => {
    const a = seg.indexOf('<CardAiEntry');
    const s = seg.indexOf('toggleStar(r)');
    const m = seg.indexOf('openMirror(r)');
    const p = seg.indexOf('togglePin(r)');
    const d = seg.indexOf('removeCard(r)');
    return a >= 0 && s > a && m > s && p > m && d > p;
  };
  const grid = segOf(POOL_PANEL, '<template v-else>\n            <CardAiEntry :card="r" />', '</template>');
  const row = segOf(POOL_PANEL, '<span class="pcp-r-acts">', '</span>\n          </div>');
  const seqAI = (seg) => seg.indexOf('<CardAiEntry') >= 0;
  return seqAI(grid) && seqAI(row) && seq(grid) && seq(row)
    && !grid.includes('openMoveOne')
    && !row.includes('openMoveOne')
    && !grid.includes('openMountOne')
    && !row.includes('openMirrorCard');
});
check('R82-3（R162 重指）右键菜单两分支零挂载入口（镜像只读口径不变）', () => {
  const own = stripComments(CTX_OWN), mir = stripComments(CTX_MIRROR);
  return !own.includes('openMountOne') && !own.includes('挂载到任务') && !mir.includes('openMountOne');
});
check('R82-4（R162 重指）挂载域实现从 useWorkspaceBatch 整体退役（零 toggleMountTask / 零 mountedResourceIds）', () => {
  const b = stripComments(read('/newtab/composables/useWorkspaceBatch.ts'));
  return !b.includes('toggleMountTask') && !b.includes('mountedResourceIds') && !b.includes('openMountOne');
});
check('R82-5（R162 重指）ResourceCard 模型零挂载类反向字段 + WorkspaceBatch 零 mountedTaskCount', () => {
  const rc = stripComments(RES_CARD_IFACE);
  return !rc.includes('mountedTaskIds') && !rc.includes('mountedTask') && !rc.includes('taskIds')
    && !read('/newtab/composables/useWorkspaceBatch.ts').includes('mountedTaskCount');
});
check('R82-6（R162 重指）挂载切换实现已退役（无 mountedResourceIds 整体替换/持久化路径）', () => {
  const b = stripComments(read('/newtab/composables/useWorkspaceBatch.ts'));
  return !b.includes('mountedResourceIds') && !b.includes('mountTarget');
});
check('R82-7（R162 重指）挂载选择器已退役（mountTaskOptions/mountProjectName/mountOneOpen 零命中）', () => {
  const b = stripComments(read('/newtab/composables/useWorkspaceBatch.ts'));
  return !b.includes('mountTaskOptions') && !b.includes('mountProjectName') && !b.includes('mountOneOpen');
});
check('R82-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十三轮 · V2.52.0：主航线信息密度（M1 + M2 + M3）】');
// ⚠ next 用 '\n</template>' —— 组件里还有嵌套的 <template #actions>，用裸 '</template>' 会在 437 字符处被截断
check('R83-1/R121 M1 愿景/使命一行呈现 ★R3-B1 退役重指带备案：主航线上方 .vm-bar（38px/单行省略/整条可点）随 LighthousePanel 退役——愿景/使命改为方向台首屏的第 1-2 层卡，就地可点编辑且同样单行省略', () => {
  const t = CT_ALL;
  return !exists('/newtab/components/compass/LighthousePanel.vue') && t.includes('class="node-title editable"') && t.includes("startEdit('vision'") && t.includes("startEdit('mission'") && t.includes('text-overflow: ellipsis');
});
check('R83-2/R121 M1 右端「进入方向树 ›」收敛为一个 ★R3-B1 退役重指带备案：树即一级后该入口整体消失（连 openTree 这个跳转函数都不该再有），残留即死链族', () => {
  const t = CT_ALL;
  return !codeOnly(t).includes('function openTree') && !codeOnly(t).includes('进入方向树');
});
check('R83-3 M1 空态文案在位 ★R3-B1 随宿主改靶：主航线的「尚未设定愿景/使命」随退役换成方向树第 1-2 层的就地引导文案（空态不许留白）', () => {
  const t = CT_ALL;
  return t.includes("visionText || '点击设定你的核心愿景…'") && t.includes("missionText || '点击设定你的核心使命…'");
});
check('R83-4 M2 期限三值映射齐全（远期/中期/近期）★R3-B1 去向点名：主航线目标卡的期限位随退役消失，读数由项目详情页承接（面包屑 + 目标行两处同口径），未设期限不显示', () => {
  const pc = read('/newtab/views/ProjectCuration.vue');
  return pc.includes("dir.term === 'long' ? '远期'") && pc.includes("'近期'") && pc.includes("'中期'") && pc.includes("dir.term==='long' ? '（远期）'");
});
check('R83-5/R121 M2 主攻数与进度读数 ★R3-B1 去向点名：主航线 goalPct/focusedOf 随退役消失，方向台页头改由 treeStats 一次算齐（战略目标/项目/主攻/停滞/指标/任务），不在模板里逐项调。★G1(V3.8.24)随迁带备案：主攻读数前缀由 emoji 「🚀」迁移为 <Icon name="main-focus">，锚点随迁（读数仍在）', () => {
  const t = CT_ALL;
  return t.includes('const treeStats = computed(') && t.includes('focused, stalled') && t.includes('Icon name="main-focus"') && t.includes('主攻 {{ treeStats.focused }}') && !t.includes('goalPct(');
});
check('R83-6/R121 M3 项目卡头三读数 ★W11(V3.8.11)随迁带备案：读数落点由 tp-mark/tp-flag/tp-pct 迁为 tw-badge.focus / tw-badge.stall / tw-ring-v（完成数同时常驻舱头 .tw-num）', () => {
  const T = TOWER;
  return T.includes('class="tw-badge focus"')
    && T.includes('class="tw-badge stall"')
    && T.includes('class="tw-ring-v"')
    && /任务完成/.test(T);
});

check('R83-7 ★性能红线 ★W11(V3.8.11)随迁带备案：方向台模板内不得逐项调 projectProgress / isProjectStalled，也不得在模板里 filter 任务。W11 更进一步：全部取数收进 compassMeta.ts 一次聚合成 Map，模板只做 O(1) 取值——本条改钉这条更强的口径。★V3.9.1 再随迁：指标任务桶扩为 `task.metricId / metric.taskIds` 双路单次建桶，仍不得在每个指标里各扫全表', () => {
  const tpl = CT_W11.slice(CT_W11.indexOf('<template>'));
  /* 模板内零逐项调 */
  const noInline = !/projectProgress\(/.test(tpl) && !/isProjectStalled\(/.test(tpl);
  /* 模板内零 filter 任务（集中取数后不该再有） */
  const noFilter = !/tasks\.filter\(/.test(tpl);
  /* 集中取数层真身在位 */
  const meta = CMETA;
  const centralized = meta.includes('export function buildCompassMeta')
    && meta.includes('const bucket = new Map<string, TaskCard[]>()')
    && meta.includes('for (const taskId of metric.taskIds || [])')
    && meta.includes('byMetric')
    && meta.includes('byProject');
  /* 视图确实吃这份聚合 */
  const used = /compassMeta = computed\(\(\) => buildCompassMeta\(/.test(CT_W11);
  return noInline && noFilter && centralized && used;
});

check('R83-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十四轮 · V2.53.0：策展台身份与中心论点（W1 + W2）】');
check('R84-1 W1 页头四要素齐全：图标 + workspace.name + 台描述 + 右端结构摘要（★G1(V3.8.25)随迁带备案：页头图标由固定 <Icon name="landmark" :size="15"/> 改为「用户自设 workspace.icon 优先、缺省回落 <Icon name="folder">」——四要素里的「有图标」一项未减，且自设图标属用户数据（G1 白名单），不参与 emoji 清理）', () => {
  return HEAD_TPL.includes('class="wsh-icon">')
    && HEAD_TPL.includes('v-if="workspace.icon"') && HEAD_TPL.includes('<Icon v-else name="folder" :size="13"/>')
    && HEAD_TPL.includes("class=\"wsh-name\">{{ wsDisplayNameOf(workspace) }}")
    && HEAD_TPL.includes('class="wsh-desc"')
    && HEAD_TPL.includes('class="wsh-summary"');
});
// R179-MIGRATED R84-2
// V3.7.0（R179）随迁重写：hub 回落文案（'资源卡唯一存储 · 镜像源头' + wsHeadDescFallback + ? 教学气泡）
// 随资源台退役整体下线——页头描述收敛单形态：wsHeadDescOwn（用户自写台描述）为空即不占位（v-if 非三元）。
check('R84-2 W1 描述为空不占位（v-if 而非三元）——V3.7.0：hub 回落形态退役，自写描述为唯一形态', () => {
  const i = WS84.indexOf('const wsHeadDescOwn = computed(');
  const body = i >= 0 ? WS84.slice(i, i + 300) : '';
  return HEAD_TPL.includes('v-if="wsHeadDescOwn"')
    && !HEAD_TPL.includes('wsh-locator')
    && !WS84.includes('wsHeadDescFallback')
    && body.includes('workspace.value?.desc');
});
check('R84-3 W1 页头 ≤56px（V3.9.13 重指：台身份与论点卡合并成同一上下文带，仍不许退回两条大横条）', () => {
  const c = read('/newtab/views/workspace.css');
  return c.includes('.ws-id-head { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 52px; max-height: 56px;')
    && c.includes('.ws-hero { display: grid; grid-template-columns: minmax(280px, .78fr) minmax(0, 1.35fr);');
});
check('R84-4 W1 页头对所有台渲染（不再是 v-if="isHub" 的 hub 专属）', () => {
  return !WS84.includes('class="ws-id-head" v-if="isHub"') && !WS84.includes('v-if="isHub" class="ws-id-head"')
    && WS84.includes('class="ws-id-head"');
});
check('R84-5（V3.9.8 随迁备案）论点横幅两态：已设 → 标题 + 论点卡详情入口；未设 → 轻引导 + 确立按钮。旧“查看金字塔”随四视图退役，能力改由常驻画布承接', () => {
  return BANNER_TPL.includes('class="tb-title"')
    && BANNER_TPL.includes('class="tb-open"') && BANNER_TPL.includes('论点卡详情')
    && BANNER_TPL.includes('class="tb-hint"') && BANNER_TPL.includes('＋ 点击确立本策展台的 L1 中心论点')
    && BANNER_TPL.includes("openThesisCard()") && BANNER_TPL.includes('openThesisCreate()')
    && !BANNER_TPL.includes("setViewMode('pyramid')");
});
check('R84-6（V3.9.8 随迁备案）论点横幅单形态常驻：旧“只在卡片视图出现”随四视图退役；现役页头后只有一处横幅，画布根节点复用同一张论点卡但不再渲染第二份横幅', () => {
  const w = codeOnly(WS84);
  return !w.includes("v-if=\"viewMode==='card'\"")
    && (w.match(/<div class="thesis-banner"/g) || []).length === 1
    && w.includes('@open-thesis="openThesisCard"')
    && read('/newtab/components/curation/CurationMindMap.vue').includes('class="mind-node mind-root"');
});
check('R84-7 W2-② 视图偏好按台持久化：四值白名单 + 读写 + sanitize + 默认「有论点→金字塔」', () => {
  const v = stripComments(WSVIEW);
  const fn = segOf(WS84, 'function applyWsView(', 'function setViewMode');
  return v.includes("['card', 'list', 'kanban', 'pyramid']") && v.includes('export function readWsView(')
    && v.includes('export function writeWsView(') && v.includes('export function sanitizeWsView(')
    && stripComments(fn).includes("saved || (thesisCard.value ? 'pyramid' : 'card')")
    && WS84.includes('watch(workspaceId, () => nextTick(applyWsView))')
    && read('/shared/models/index.ts').includes('wsViewMode?: Record<string,');
});
check('R84-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十五轮 · V2.54.0：主攻聚焦与就地可操作（M4 + M5）】');
// ⚠ next 不能用裸 '</template>'——组件里有嵌套 <template #actions>，会在 437 字符处截断（R83 同款坑）
check('R85-1 T0-A：主攻上限常量在 store 定义，且被 toggleFocusProject 引用（不是某个 UI 里的魔法数）', () => {
  return ST85.includes('export const FOCUS_PROJECT_LIMIT = 2')
    && stripComments(FOCUS_FN).includes('others.length >= FOCUS_PROJECT_LIMIT');
});
check('R85-2 T0-A：超限时拒绝写入（返回 ok:false + msg，且不翻转 isFocused）；正常时返回 ok:true', () => {
  const fn = stripComments(FOCUS_FN);
  return fn.includes('if (!p.isFocused)') && fn.includes('return { ok: false, msg:')
    && fn.includes('p.isFocused = !p.isFocused') && fn.includes('return { ok: true, msg:')
    && fn.includes('store.persist()');
});
check('R85-3 T0-A：ProjectCuration 不再有自己那份上限校验（改调 store，零残留）', () => {
  const pc = stripComments(read('/newtab/views/ProjectCuration.vue'));
  return pc.includes('toggleFocusProject(p.id)') && !pc.includes('focused.length >= 2')
    && pc.includes('已设为主攻，同步今日行动');
});
check('R85-4 T0-B：addProjectToDir 建的项目字段完整（pinned + order 齐全——方向树此前两个都缺）', () => {
  const fn = stripComments(ADDP_FN);
  return fn.includes('pinned: false') && fn.includes('order: dir.projects.length')
    && fn.includes('isFocused: false') && fn.includes('dir.projects.push(proj)');
});
check('R85-5 T0-B（R117 修订 · ★R3-B1 出口由三处收敛为两处）：方向树与项目详情两处新建出口都调 addProjectToDir（dir.projects.push 全项目收敛到 store 一处）', () => {
  const tr = stripComments(CT_ALL);
  const pc = stripComments(read('/newtab/views/ProjectCuration.vue'));
  return tr.includes('addProjectToDir(')
    && pc.includes('addProjectToDir(')
    && !tr.includes('dir.projects.push')
    && !pc.includes('dir.projects.push')
    && ST85.includes('dir.projects.push(proj)');
});
check('R85-6/R121 M4 聚焦条 ★R3-B1 退役重指带备案：主航线「当前主攻」横条（focusedProjects + projMeta 索引）随 LighthousePanel 退役，主攻一览由树的「主攻置前 + 自动展开 + 🚀 标记」承担；调度台速览仍是 focusedProjects 唯一消费方', () => {
  const t = CT_ALL; const h = read('/newtab/views/CompassHome.vue');
  return !exists('/newtab/components/compass/LighthousePanel.vue') && t.includes('Number(b.isFocused) - Number(a.isFocused)') && t.includes('o === undefined ? !!p.isFocused : o') && h.includes('focusedProjects');
});
check('R85-7/R121 M4 两态齐全 ★R3-B1 退役重指带备案：fs-chip/fp-hint（含「最多 N 个」提示）随聚焦条退役；「最多 2 个」的口径仍在 store 的 toggleFocusProject 里拒绝超限，树 ▾ 菜单点主攻走同一条（返回 msg 即提示）', () => {
  const t = CT_ALL; const st = read('/newtab/stores/compass.ts');
  return !t.includes('fs-chip') && !t.includes('fp-hint') && st.includes('FOCUS_PROJECT_LIMIT') && t.includes('onToggleFocus(') && t.includes('<Icon v-if="!proj.isFocused" name="main-focus"');
});
check('R85-8 M5-① 目标下新建项目 ★R3-B1 退役重指带备案：主航线目标卡底的内联输入（回车/Esc/失焦）随退役消失，树的出口是目标头 ＋ 直建「新攻坚项目」+ 就地改名；两处都经 addProjectToDir，不得回添第二份 projects.push', () => {
  const t = CT_ALL;
  /* ★W11 随迁带备案：按钮 title 随术语统一改「添加攻坚项目」（第 4 层叫攻坚项目，不再笼统叫项目） */
  return t.includes("function addProject(dirId: string)") && t.includes("addProjectToDir(dirId, '新攻坚项目')") && t.includes('title="添加攻坚项目"') && !t.includes('chip-add-input');
});
check('R85-9/R121 M5-② 卡头动作防冒泡 ★W11(V3.8.11)随迁带备案 + ★F5 拖拽形态翻转（2026-10-15 拍板激进瘦身）：动作组已收为 tw-acts 且带 @click.stop 防冒泡（不误触卡头跳转）这条不变；★翻转点：独立 ⠿ 拖拽手柄退役，改为**整块舱头 draggable + onHeadDragStart 拦截**（按下 button/contenteditable/input/.tw-menu 即 preventDefault，防"想点按/改名却被拽走"）。防冒泡的承重点从「动作组」扩到「舱头整块」——舱头 @click 要跳全景，所以舱内任何点击都得 stop，手柄退役不等于防冒泡退役', () => {
  const tc = codeOnly(TOWER)
  return /class="tw-acts"[^>]*@click\.stop/.test(TOWER)
    && /class="tw-head"[\s\S]*?draggable="true"/.test(tc)
    && tc.includes("function onHeadDragStart(")
    && tc.includes("closest('button, [contenteditable=\"true\"], input, .tw-menu')")
    && /@dragstart="onHeadDragStart\(/.test(tc)
    /* ★退役负锚：手柄与其拖拽绑定不许回流（缘由留注释里，判据只看剥注释形态） */
    && !tc.includes('tw-grip') && !/class="tw-grip"/.test(tc)
    && /@click\.stop/.test(TOWER);
});

check('R85-10 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十六轮 · V2.55.0：方向台分工与项目总览检索（M7 + D-A + D-B）】');
// ⚠ next 不能用裸 '</template>'——子组件模板里有嵌套 <template #actions>（R83 同款坑）
check('R86-1 T0：showDone / toggleShowDone **只在 store 定义**（★R3-B1 组件面收敛为方向树/项目详情/调度台三处，零份组件级复刻）', () => {
  return ST86.includes('const showDone = computed') && ST86.includes('function toggleShowDone')
    && !stripComments(CT86).includes('function toggleShowDone')
    && !stripComments(read('/newtab/views/ProjectCuration.vue')).includes('function toggleShowDone')
    && !stripComments(read('/newtab/views/CompassHome.vue')).includes('function toggleShowDone');
});
check('R86-2 M7：面板级显隐开关零残留（★R3-B1 随宿主改靶：主航线 .mr-tool 与项目总览 .ov-toggle 连宿主一起退役，方向台只留页头一处开关）', () => {
  const t = CT86; const h = read('/newtab/views/CompassHome.vue');
  return !t.includes('class="mr-tool" :class="{ off') && !t.includes('class="ov-toggle"') && !h.includes('class="ov-toggle"') && !t.includes('.ov-toggle {');
});
check('R86-3 M7 方向台页头有已完成开关 ★R3-B1 形态收敛带备案：R177 的 checkbox 形态（done-toggle-label）随 CompassShell 退役，一级页头改由树的 tree-tool 按钮承担同一开关——两处形态不同但**同一份 store 口径**，"一处切换全台生效"不变', () => {
  return CT86.includes('toggleShowDone') && CT86.includes('class="tree-tool"') && CT86.includes('👁 已完成项目') && ST86.includes('function toggleShowDone');
});
check('R86-4 M7 ★R3-B1 退役重指带备案：面板级「完整方向树 →」与页头 tree-link 双双退役（树即一级，不需要跳自己的入口）；openTree 函数不得残留', () => {
  const t = CT86; const h = read('/newtab/views/CompassHome.vue');
  return !codeOnly(t).includes('class="tree-link"') && !codeOnly(h).includes('tree-link') && !codeOnly(t).includes('function openTree');
});
check('R86-5/R121 D-A ★R3-B1 退役重指带备案：主航线「看主线」模块标签随面板退役（方向台只剩一面，无需再标"这块是读还是写"）；项目详情上下文仍由单行面包屑 pb-crumb 承载', () => {
  const pc = read('/newtab/views/ProjectCuration.vue');
  return !exists('/newtab/components/compass/LighthousePanel.vue') && !pc.includes('管项目')
    && pc.includes('class="pb-crumb"') && pc.includes('pb-title-row');
});
check('R86-6 D-B ★R3-B1 退役重指带备案（R3 计划点名项）：主航线状态筛选（all/active/stalled/done 分段组 + ovFilter/tools-gate 传参链）整体退役，全站零残留；停滞读数改由树页头「停滞 N」+ 卡头停滞标承担（只读不筛）。★G1(V3.8.24)随迁带备案：页头停滞前缀由 emoji 「⚠」迁移为 <Icon name="stall">，锚点随迁（读数仍在）', () => {
  const t = CT_ALL; /* ★W11 随迁：读数锚点从旧树切片 CT86 改 CT_ALL（W11 起六层分居四文件，CT86 只覆盖树本体，承重处已迁到舱组件） */ const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue');
  return !t.includes('ovFilter') && !h.includes('ovFilter') && !pc.includes('ovFilter') && !t.includes('lh-filter-group')
    /* ★W11 随迁带备案：停滞徽标承重处迁到舱卡头 CompassTower（.tw-badge.stall），页头读数仍在树本体 */
    && t.includes('Icon name="stall"') && t.includes('停滞 {{ treeStats.stalled }}') && t.includes('class="tw-badge stall"') && t.includes('title="近 14 天无推进/完成活动"');
});
check('R86-7 D-B：★ 状态判定复用 isProjectStalled / isProjectDone 且**预计算成索引**（★R3-B1 随首屏换宿主：判据从 CompassShell 的 projState 换成方向树的 projMeta，模板内仍不得逐项调）', () => {
  const fn = stripComments(segOf(CT86, 'const projMeta = computed(', 'function toggleMetric'));
  const tpl = segOf(CT86, '<template>', '\n</template>');
  return fn.includes('isProjectStalled(p)') && fn.includes('projectProgress(p)')
    && !tpl.includes('isProjectStalled(') && !tpl.includes('isProjectDone(');
});
check('R86-8 D-B（R117 重写 · R177 随分段化 → ★R3-B1 随筛选退役）：筛选绕过入口（ov-empty-act / resetOvTools）全站零残留', () => {
  const t = CT86; const h = read('/newtab/views/CompassHome.vue');
  return !t.includes('ov-empty-act') && !t.includes('resetOvTools') && !h.includes('resetOvTools') && !exists('/newtab/components/compass/LighthousePanel.vue');
});
check('R86-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十七轮 · V2.56.0：资源台检索（R5 + R7）】');
// ⚠ next 不能用裸 '</template>'——Workspace 模板里有大量嵌套 <template>（v-for / v-if），会提前截断
// R115：样式外置 workspace.css——锚点换源（断言口径不变）
check('R87-1 T0：链接三态判据只在 shared/utils/link.ts 定义（ResourceEditForm 的本地 isFullPath 已退役）', () => {
  return LINK87.includes('export function isZyAssetLink(') && LINK87.includes('export function isFullPath(')
    && LINK87.includes('export function linkStateOf(')
    && !stripComments(REF87).includes('function isFullPath(')
    && REF87.includes("import { linkStateOf,") /* R169-T2 备案：同一行还引三槽口径（LINK_SLOT_TABS/switchLinkSlot…），判据收窄到前缀，"单一真源"不变 */
    && WS87.includes('linkStateOf');
});
check('R87-2（V3.9.8 随迁备案）R5-①：旧策展台五档排序下拉随卡片网格退役；现役资源池排序保留“最近更新 / 最近采集 / 最近调出”三档，排序方向与偏好白名单仍在', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const deck = read('/newtab/components/compass/DeckControls.vue');
  return !WS_TPL.includes('<select class="toolbar-select" v-model="sortBy">')
    && !WS_TPL.includes('value="manual"')
    && pool.includes("type PoolSortBy = 'updated' | 'created' | 'called'")
    && ['updated', 'created', 'called'].every(k => pool.includes("id: '" + k + "'"))
    && pool.includes('const POOL_SORT_KEYS: PoolSortBy[]')
    && pool.includes('POOL_SORT_KEYS.includes(savedPoolSort as PoolSortBy)')
    && pool.includes("sortBy.value === 'created' ? (r.createdAt || 0)")
    && pool.includes("sortBy.value === 'called' ? (r.callCount || 0)")
    && pool.includes('(r.updatedAt || 0)')
    && pool.includes("sortDir.value === 'asc' ? 1 : -1")
    && deck.includes('class="dk-select dk-sort"')
    && deck.includes('@change="emit(\'sort\'');
});
check('R87-3（V3.9.8 随迁备案）旧策展台七档类型筛选随四视图退役；现役资源池筛选保留全部 / 待打标 / 已调出 / 从未调出四态，并仍由同一过滤管线消费', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !WS_TPL.includes('<select class="toolbar-select" v-model="filterBy">')
    && !WS_TPL.includes('optgroup label="按链接类型"')
    && !WS_TPL.includes('optgroup label="按状态"')
    && !pool.includes('unmounted')
    && ['all', 'untagged', 'called', 'never'].every(k => pool.includes("id: '" + k + "'"))
    && pool.includes('const activeFilter = computed(')
    && pool.includes('function onPoolFilter(v: string)')
    && pool.includes('onlyUntagged.value || !(r.tags || []).length')
    && pool.includes("calledFilter.value === 'called' ? !!r.lastCalledAt : !r.lastCalledAt")
    && pool.includes('<DeckControls panel="pool"')
    && pool.includes(':filters="poolFilters"')
    && pool.includes(':filter="activeFilter"');
});
check('R87-4（R162 重指）unmounted 筛档与 mountedResIds 反查索引随挂载退役（谓词表零 unmounted）', () => {
  const pred = stripComments(segOf(WS87, 'const FILTER_PREDICATES', '// 筛选（第八轮'));
  return !WS87.includes('mountedResIds') && !pred.includes('unmounted') && !MOD87.includes('mountedTaskIds');
});
check('R87-5 R7：zy-asset:// 附件卡判为 ok（不再被误报「待补全」）——三态判据先 zy 后 file', () => {
  const fn = stripComments(segOf(LINK87, 'export function linkStateOf(', '/** 统一打开通道'));
  const iZy = fn.indexOf('isZyAssetLink(t)');
  const iFile = fn.indexOf("linkType === 'file'");
  return fn.includes("if (isZyAssetLink(t)) return 'ok'") && iZy > 0 && iFile > iZy
    && REF87.includes('const linkIncomplete = computed') && REF87.includes('linkStateOf(props.model.linkType');
});
check('R87-6（V3.9.8 随迁备案）断链提示保留在资源编辑表单：linkStateOf 判定 incomplete 时以 warn 图标提示补全完整路径，颜色只走 tokens；旧卡片整卡警示 / 列表 / 看板徽标随策展台三视图退役', () => {
  const form = read('/newtab/components/ResourceEditForm.vue');
  const warn = segOf(form, '<div v-if="linkIncomplete" class="ref-warn">', '</div>');
  return form.includes("linkStateOf(props.model.linkType, props.model.link) === 'incomplete'")
    && warn.includes('<Icon name="warn" :size="13"/>')
    && warn.includes('请补全完整路径')
    && form.includes('.ref-warn {')
    && form.includes('var(--danger)') && form.includes('var(--danger-bg-soft)')
    && !form.includes('#D9A03C')
    && !WS_TPL.includes('class="rr-broken"') && !WS_TPL.includes('class="kc-broken"');
});
check('R87-7（V3.9.8 随迁备案）一键补全能力保留在共享资源抽屉：fixLink 对镜像卡只读拦截，普通卡打开详情后 focusLink 聚焦并全选链接框；旧卡面 fixLink 按钮随策展台三视图退役', () => {
  const fn = stripComments(segOf(WS87, 'function fixLink(', '\n  // B5：右键菜单'));
  return fn.includes('isMirrorView(r)')
    && fn.includes('openResource(r)') && fn.includes('resFormRef.value?.focusLink()')
    && REF87.includes('defineExpose({ focusLink })') && REF87.includes('function focusLink(')
    && REF87.includes('linkInputRef.value?.focus()') && REF87.includes('linkInputRef.value?.select()')
    && !WS_TPL.includes('@click.stop="fixLink(r)"');
});
check('R87-8 R7-③：双击打不开的 toast 按三态分流（none / incomplete / 协议不受支持）', () => {
  // ★R4-Eu 随迁备案：fixLink 现在是 `async function`，`'\nfunction fixLink('` 永不命中 ⇒ 切片过宽；
  const fn = stripComments(segOf(WS87, 'function openResourceLink(', '\n  return { previewOpen, previewUrl'));
  return fn.includes("st === 'none'") && fn.includes("st === 'incomplete'")
    && fn.includes('该卡还没填链接') && fn.includes('仅存文件名') && fn.includes('协议不受支持')
    && !fn.includes('请先补全链接（本地文件需完整路径');
});
check('R87-9（V3.9.8 随迁备案）资源池筛选为零时空态说明具体原因 + 一键「清空筛选」：搜索词、待打标、已调出 / 从未调出三种空态各自给出口，不让人以为卡丢了', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes("query ? `没有匹配「${query}」的资源卡`")
    && pool.includes("onlyUntagged ? '池里每张卡都有标签了'")
    && pool.includes("calledFilter !== 'all' ? '这个调用状态没有资源卡'")
    && pool.includes("(onlyUntagged || query || calledFilter !== 'all') ? '清空筛选'")
    && pool.includes('@action="clearPoolFilter"')
    && pool.includes('function clearPoolFilter(): void');
});
check('R87-10 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十八轮 · V2.57.0：资源池控制行分级与导入归位（W3 + W6）】');
// V3.9.8：旧策展台筛选气泡与设置菜单随四视图退役。现役资源池把排序 / 方向 / 筛选 / 视图
// 统一放进 DeckControls 单行；打开外部页不依赖气泡互斥，而是各按钮自洽。
check('R88-1（V3.9.8 随迁备案）旧筛选气泡与 ⚙ 菜单随策展台四视图退役；资源池控制行不保留第二套浮层关闭机制，排序 / 筛选 / 视图均直接驱动同一个 poolCards', () => {
  const pool = stripComments(POOL_PANEL);
  const deck = stripComments(DECK_CONTROLS);
  return !WS88.includes('filterPopOpen') && !WS88.includes('function closeFilterPop()')
    && deck.includes('@click="emit(\'filter\', f.id)"')
    && deck.includes('@change="emit(\'sort\'' ) && deck.includes('@click="emit(\'sort-dir\')"')
    && pool.includes(':filter="activeFilter" @filter="onPoolFilter"')
    && pool.includes(':sorts="POOL_SORTS" :sort="sortBy"');
});
check('R88-2（V3.9.8 随迁备案）资源池控制行一级顺序 = 搜索 ｜ 筛选 ｜ 视图 ｜ 排序 ｜ 方向 ｜ 分组 ｜ 面板动作 ｜ 计数 ｜ 批量 ｜ 新建；旧视图 Tab / ⚙ 专属文案随策展台四视图退役', () => {
  const deck = stripComments(DECK_CONTROLS);
  const iSearch = deck.indexOf('class="dk-search"');
  const iFilter = deck.indexOf('class="dk-filters"');
  const iView = deck.indexOf('class="dk-views"');
  const iSort = deck.indexOf('class="dk-select dk-sort"');
  const iDir = deck.indexOf('class="dk-btn dk-sort-dir"');
  const iGroup = deck.indexOf('class="dk-select dk-group"');
  const iCount = deck.indexOf('class="dk-count"');
  const iBatch = deck.indexOf('class="dk-btn dk-batch"');
  const iNew = deck.indexOf('class="dk-btn dk-new"');
  return iSearch >= 0 && iFilter > iSearch && iView > iFilter && iSort > iView
    && iDir > iSort && iGroup > iDir && iCount > iGroup && iBatch > iCount && iNew > iBatch
    && !TB1_88.includes('class="view-tabs"') && !TB1_88.includes('class="toolbar-filter"');
});
check('R88-3（V3.9.8 随迁备案）旧筛选气泡内的排序 / 方向 / 密度 / 八档类型筛选随四视图退役；现役资源池把排序、方向、分组、视图与筛选直接放在控制行，列数不再由策展台持有', () => {
  const pool = stripComments(POOL_PANEL);
  return !TB1_88.includes('v-model="sortBy"') && !TB1_88.includes('sort-dir-btn')
    && !TB1_88.includes('v-model="filterBy"') && !TB1_88.includes('v-model="density"')
    && pool.includes(':views="poolViews" :view="viewMode"')
    && pool.includes(':sorts="POOL_SORTS" :sort="sortBy"')
    && pool.includes(':sort-dir="sortDir"')
    && pool.includes(':groups="viewMode === \'list\' ? POOL_GROUP_OPTIONS : []"')
    && !pool.includes('<ColsPicker') && !pool.includes('v-model="quickFilter"');
});
check('R88-4（V3.9.8 随迁备案）控制行组件内控件齐全：搜索 / 筛选 / 视图 / 排序 / 方向 / 分组 / 面板插槽 / 计数 / 批量 / 新建；旧气泡四行控件随四视图退役', () => {
  const deck = stripComments(DECK_CONTROLS);
  return deck.includes('v-if="search" class="dk-search"')
    && deck.includes('v-if="filters.length" class="dk-filters"')
    && deck.includes('v-if="views.length" class="dk-views"')
    && deck.includes('v-if="sorts.length" class="dk-select dk-sort"')
    && deck.includes('v-if="sortDir" class="dk-btn dk-sort-dir"')
    && deck.includes('v-if="groups.length" class="dk-select dk-group"')
    && deck.includes('<slot />') && deck.includes('<slot name="count" />')
    && deck.includes('v-if="batchLabels" class="dk-btn dk-batch"')
    && deck.includes('v-if="newLabel" class="dk-btn dk-new"')
    && !POP88.includes('class="fp-row"') && !POP88.includes('重置全部');
});
check('R88-5（V3.9.8 随迁备案）旧生效值徽标随筛选气泡退役；资源池把生效值直接体现在控件状态与计数：筛选胶囊 on、视图 on、方向箭头、分组下拉与「N / 全部 M 张」读数', () => {
  const pool = stripComments(POOL_PANEL);
  const deck = stripComments(DECK_CONTROLS);
  return !WS88_TPL.includes('filterSummary') && !WS88_TPL.includes('filterPopTitle')
    && !WS88_TPL.includes('class="tf-chip"') && !pool.includes('class="tf-chip"')
    && deck.includes(':class="{ on: filter === f.id }"')
    && deck.includes(':class="{ on: view === v.id }"')
    && deck.includes("props.sortDir === 'desc' ? '↓ 倒序' : '↑ 正序'")
    && pool.includes('class="pcp-count"><b>{{ poolCards.length }}</b> / 全部 {{ poolTotal }} 张');
});
check('R88-6（V3.9.8 随迁备案）批量开关常驻资源池控制行：批量中显示「退出批量」，批量栏出现全选 / 反选 / 打标签与池专属动作；旧“完成批量”文案随共享控件换代，退出通道不变', () => {
  const pool = stripComments(POOL_PANEL);
  return pool.includes(":batch-labels=\"['批量', '退出批量']\" :batch-on=\"batchMode\"")
    && pool.includes('@batch="toggleBatch"')
    && pool.includes('function toggleBatch()')
    && pool.includes('<DeckBatchBar v-if="batchMode"')
    && pool.includes('@select-all="selectAll"')
    && pool.includes('@invert="invertSel"')
    && !WS88_TPL.includes('toggleBatchMode');
});
check('R88-7（V3.9.9 重指）双入口各守其责：⚙ 内导入 JSON 备份（全库合并）；一级工具栏导入成果 HTML（新台或合并）并分享成果', () => {
  return SM88.includes('@click="openImport"') && /<Icon name="download"[^>]*\/> 导入 JSON 备份/.test(SM88) && !SM88.includes("isHub ? '⬇ 导入资源'")
    && /<Icon name="download"[^>]*\/> 导入成果 HTML/.test(WS88) && /<Icon name="share"[^>]*\/> 分享成果/.test(WS88)
    && WS88.includes('function openImport(') && WS88.includes('importModalOpen.value = true')
    && !TB1_88.includes('importModalOpen = true');
});
check('R88-8（V3.9.9 随迁备案）策展画布主色稀缺：建支改由节点键盘触发后，一级工具条零 primary；导入成果 HTML / 分享成果为 ghost 次级，导入模板与设置保持 settings 次级；旧资源池批量与建支 CTA 不回流', () => {
  return (TB1_88.match(/hero-btn primary/g) || []).length === 0
    && !TB1_88.includes("mind.createChild('root')")
    && (TB1_88.match(/hero-btn ghost/g) || []).length === 2
    && /<Icon name="download"[^>]*\/> 导入成果 HTML/.test(TB1_88)
    && /<Icon name="share"[^>]*\/> 分享成果/.test(TB1_88)
    && !TB1_88.includes('openNewArgument')
    && !TB1_88.includes('batchMode');
});
check('R88-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十九轮 · V2.58.0：检索补完与镜像卡只读（R6 + W5 + W4）】');
check('R89-1 R6：搜索纳入**自定义字段值**（此前能在卡片上显示却搜不到）', () => {
  const fn = stripComments(segOf(WS89, 'function matchCard(', '// 筛选（第八轮'));
  return fn.includes('Object.values(r.customFields || {})') && fn.includes('String(v).toLowerCase().includes(p.kw)');
});
check('R89-2 R6：`#标签` 直筛 —— 多个取**交集**，单个 # 回落为普通词', () => {
  // ★R4-Eu 随迁备案：JSDoc 是 `/**\n * 卡片是否命中查询` 两行式，旧标记（同一行）永不命中 ⇒ 切片过宽。
  const pq = stripComments(segOf(WS89, 'function parseQuery(', '\n  /**\n   * 卡片是否命中查询'));
  const mc = stripComments(segOf(WS89, 'function matchCard(', '// 筛选（第八轮'));
  return pq.includes("tok.startsWith('#')") && pq.includes('tok.length > 1')
    && mc.includes('if (cardTags.some(c => c.split(\'/\').pop() === t)) continue');
});
// R110-LC（T3）：过滤管线收敛到 applyViewFilters（分类 → 筛选器 → 搜索），filteredResources 只做委托 + 归档排除；
// 归档提示计数复用同一实现 ⇒「搜索判据只有一份」的约束仍在，只是落点从 filteredResources 换到 applyViewFilters。
check('R89-3（V3.9.8 随迁备案）资源池搜索判据只有一份：poolCards 先按标题 / 标签模糊匹配，再叠加待打标与调用状态，不在模板另写第二套过滤', () => {
  const pool = stripComments(POOL_PANEL);
  const fn = segOf(pool, 'const poolCards = computed(', 'const poolTotal = computed(');
  return fn.includes("r.title.toLowerCase().includes(q)")
    && fn.includes("(r.tags || []).some(t => t.toLowerCase().includes(q))")
    && fn.includes('!onlyUntagged.value || !(r.tags || []).length')
    && fn.includes("calledFilter.value === 'all' || (calledFilter.value === 'called' ? !!r.lastCalledAt : !r.lastCalledAt)")
    && !pool.includes('function matchCard(') && !pool.includes('function parseQuery(');
});
check('R89-4（V3.9.8 随迁备案）星标筛选随旧八档筛选退役；星标能力保留在共享资源抽屉右键与 toggleStar，资源池用待打标 / 已调出 / 从未调出组织召回，四项筛选值域仍完整', () => {
  const drawer = stripComments(read('/newtab/composables/useResourceDrawer.ts'));
  const pool = stripComments(POOL_PANEL);
  return drawer.includes("r.starred ? '☆ 取消星标' : '⭐ 星标'")
    && drawer.includes('function toggleStar(r: ResourceCard)')
    && !pool.includes("id: 'starred'")
    && ['all', 'untagged', 'called', 'never'].every(k => pool.includes("id: '" + k + "'"))
    && pool.includes('const activeFilter = computed(')
    && pool.includes('const poolFilters = computed(');
});
check('R89-5（V3.9.8 随迁备案）资源池只管理池内源卡，写动作不暴露镜像只读语义：网格与列表都直接提供置顶 / 镜像 / 删除，且批量态以 v-if 收起卡面动作', () => {
  const grid = segOf(POOL_PANEL, '<template v-else>\n            <CardAiEntry :card="r" />', '</template>');
  const row = segOf(POOL_PANEL, '<span class="pcp-r-acts">', '</span>\n          </div>');
  return grid.includes('<CardAiEntry :card="r" />') && row.includes('<CardAiEntry v-if="!batchMode"')
    && grid.includes('togglePin(r)') && row.includes('togglePin(r)')
    && grid.includes('removeCard(r)') && row.includes('removeCard(r)')
    && !grid.includes('isMirrorView(r)') && !row.includes('isMirrorView(r)')
    && !KANBAN_ACTIONS.includes('class="kc-actions"');
});
check('R89-6（V3.9.8 随迁备案）镜像能力保留为“池卡投射到策展台”：网格 / 列表 openMirror → ResourceMirrorModal，批量投射走 openBatchMirror；旧三视图镜像专属“定位源 / 移出镜像”随镜像列表退役', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return RES_CARD_ACTIONS.includes('openMirror(r)')
    && RES_ROW_ACTIONS.includes('openMirror(r)')
    && pool.includes('<ResourceMirrorModal :open="mirrorOpen"')
    && pool.includes('function openBatchMirror()')
    && pool.includes('projectCardToBoardEx(store.data!, cardId, wsId)')
    && !RES_CARD_ACTIONS.includes('locateMirrorSource(r)')
    && !RES_ROW_ACTIONS.includes('removeMirror(r)')
    && !KANBAN_ACTIONS.includes('class="kc-action locate"');
});
check('R89-7 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});
