/**
 * R174-1 分片 · 40-v2.47-v2.59：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

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
  return o.includes('savedTimer = setTimeout(clearSavedState, 2500)') && !o.includes(', 5000)');
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

console.log('【第七十九轮 · V2.48.0：三视图卡片信息量对齐（R1 收尾）】');
/** 截取具名函数/代码段——断言只看实现，不被注释或同名字符串干扰（R78 引入，沿用） */
/** 六动作在模板中的固定顺序（↗ 📌 ⭐ 📂 📡 🗑） */
check('R79-1（R158 重指）卡片一级 hover = AI徽标/移动/删除/⋯（+断链补全）；置顶降级进右键；打开走双击 / 右键菜单', () => { const seg = RES_CARD_ACTIONS; return seg.includes('<CardAiEntry :card="r" />') && seg.includes('openMoveOne(r)') && seg.includes('deleteResource(r)') && seg.includes('fixLink(r)') && seg.includes('openResCtx($event, r)') && !seg.includes('togglePin(r)') && !seg.includes('toggleStar(r)'); });
check('R79-2（R162 重指；V3.7.0 随迁：镜像位随资源台退役）卡片 hover 顺序 AI徽标→📂→🗑（→✏→⋯）；右键菜单新序固定：打开→复制→编辑→置顶→星标→移动→删除（挂载位随挂载关系退役、镜像位随资源台退役）', () => { const seg = RES_CARD_ACTIONS; const a = seg.indexOf('<CardAiEntry'), b = seg.indexOf('openMoveOne(r)'), c = seg.indexOf('deleteResource(r)'), x = seg.indexOf('fixLink(r)'), m = seg.indexOf('openResCtx($event, r)'); const res = read('/newtab/composables/useResourceDrawer.ts'); const k1 = res.indexOf('resCtxItems.value = ['); const k2 = res.indexOf('resCtxItems.value = [', k1 + 1); const own = k2 >= 0 ? res.slice(k2, res.indexOf('resCtx.value = {', k2)) : ''; const ownC = stripComments(own); const iOpen = ownC.indexOf('打开链接'), iEdit = ownC.indexOf('编辑详情'), iPin = ownC.indexOf('取消置顶'), iStar = ownC.indexOf('取消星标'), iMove = ownC.indexOf('移动分类'), iDel = ownC.indexOf("label: '删除'"); return a >= 0 && b > a && c > b && x > c && m > x && iOpen >= 0 && iEdit > iOpen && iPin > iEdit && iStar > iPin && iMove > iStar && iDel > iMove && !ownC.includes('挂载到任务') && !ownC.includes('镜像到策展台') && !ownC.includes('openMirrorCard'); });
check('R79-3 列表视图动作条（V3.7.0 重指：镜像推送退役后收敛五动作）= ↗ / 📌 / ⭐ / 📂 / 🗑，与卡片/看板视图同顺序', () => {
  return RES_ROW_ACTIONS.includes('openResourceLink(r)') && RES_ROW_ACTIONS.includes('openMoveOne(r)')
    && !RES_ROW_ACTIONS.includes('openMirrorCard(r)') && inOrder(RES_ROW_ACTIONS);
});
check('R79-4（R122 重指）列表 🔥 rr-calls 与卡片 🔥 rc-heat 同口径（v-if="r.callCount"）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('class="rr-calls"') && w.includes('<span v-if="r.callCount" class="rr-calls"')
    && w.includes('class="rc-heat"') && w.includes('🔥 {{ r.callCount }}');
});
check('R79-5 看板视图新增完整动作条 .kc-actions（六动作同顺序），.kc-card 已 position: relative', () => {
  const w = read('/newtab/views/Workspace.vue');
  const cardRule = segOf(w, '.kc-card {', '}');
  return KANBAN_ACTIONS.includes('openResourceLink(r)') && inOrder(KANBAN_ACTIONS)
    && cardRule.includes('position: relative;');
});
check('R79-6 看板视图 ⭐ 由只读标记改为可点切换（toggleStar + :class on），只读图标仍保留', () => {
  return KANBAN_ACTIONS.includes('toggleStar(r)') && KANBAN_ACTIONS.includes(':class="{on: r.starred}"')
    && read('/newtab/views/Workspace.vue').includes('kc-star');
});
check('R79-7 看板视图补 🔥 调用 N 次（kc-calls）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('<span v-if="r.callCount" class="kc-calls"') && w.includes('.rr-calls, .kc-calls');
});
check('R79-8（R123 重指；V3.7.0 随迁）三视图镜像口径：镜像推送（openMirrorCard）三视图全零——镜像卡引用侧 🎯 定位 / ✕ 移出仍在列表与看板', () => { return !RES_CARD_ACTIONS.includes('openMirrorCard(r)') && !RES_ROW_ACTIONS.includes('openMirrorCard(r)') && !KANBAN_ACTIONS.includes('openMirrorCard(r)') && RES_ROW_ACTIONS.includes('locateMirrorSource(r)') && KANBAN_ACTIONS.includes('locateMirrorSource(r)'); });

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
  const inp = segOf(pool, '<input ref="fileImportInput"', '/>');
  return inp.includes('accept="image/*') && inp.includes('.pdf') && inp.includes('.html');
});
check('R80-7 R14 zy-asset:// 三分支齐全：image 走 AssetPreview / html·pdf 走 openHtmlAsset', () => {
  const w = read('/newtab/views/Workspace.vue');
  return OPEN_LINK_FN.includes("if (meta.kind === 'image') { void openImageAsset(meta); return }")
    && OPEN_LINK_FN.includes("if (meta.kind === 'html' || meta.kind === 'pdf') { openHtmlAsset(meta); return }")
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
  return BADGE_TPL.includes('class="ab-chip ab-img">🖼 {{ imgCount }}')
    && BADGE_TPL.includes('class="ab-chip ab-pdf">📕 {{ pdfCount }}')
    && BADGE_TPL.includes('class="ab-chip ab-html">🧾 {{ htmlCount }}')
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
check('R82-1（R162 重指：挂载到任务整体退役）三视图动作条零挂载入口 + 右键菜单零挂载项 + 卡片 hover 仍收敛', () => {
  const G_WRAP = '<template v-if="!isMirrorView(r)">';
  return RES_CARD_ACTIONS.includes(G_WRAP) && !RES_CARD_ACTIONS.includes('rc-action mount')
    && !read('/newtab/composables/useResourceDrawer.ts').includes('挂载到任务')
    && RES_ROW_ACTIONS.includes(G_WRAP) && !RES_ROW_ACTIONS.includes('-action mount')
    && KANBAN_ACTIONS.includes(G_WRAP) && !KANBAN_ACTIONS.includes('-action mount');
});
check('R82-2（R162 重指；V3.7.0 随迁：镜像位随资源台退役）卡片 hover 移动→删除（断链再补全，AI徽标居首）；列表/看板 📂 后直接 🗑', () => {
  const at = (seg, s) => seg.indexOf(s);
  const ok = (seg) => { const m = at(seg, 'openMoveOne(r)'), d = at(seg, 'deleteResource(r)'); return m >= 0 && d > m && !seg.includes('openMountOne') && !seg.includes('openMirrorCard'); };
  const cardOk = at(RES_CARD_ACTIONS, 'deleteResource(r)') > at(RES_CARD_ACTIONS, 'openMoveOne(r)') && at(RES_CARD_ACTIONS, 'openResCtx($event, r)') > at(RES_CARD_ACTIONS, 'deleteResource(r)');
  return cardOk && ok(RES_ROW_ACTIONS) && ok(KANBAN_ACTIONS);
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
check('R83-1/R121 M1 愿景/使命一行锚点条：.vm-bar（R177 重指带备案：40→38px 对齐原型 vmb）+ 单行省略 + 整条可点', () => {
  return LH_TPL.includes('class="vm-bar"') && LH_TPL.includes('@click="openTree">')
    && LH_STYLE.includes('.vm-bar { display: flex') && LH_STYLE.includes('min-height: 38px')
    && LH_STYLE.includes('.vm-text {') && LH_STYLE.includes('font-size: var(--fs-body)')
    && LH_STYLE.includes('text-overflow: ellipsis');
});
check('R83-2/R121 M1 右端「进入方向树 ›」收敛为一个（不再每张卡各一个）', () => {
  return (LH_TPL.match(/vm-go/g) || []).length === 1 && (LH_TPL.match(/进入方向树 ›/g) || []).length === 1;
});
check('R83-3 M1 空态文案仍是「尚未设定愿景 / 尚未设定使命」', () => {
  return LH_TPL.includes("visionText || '尚未设定愿景'") && LH_TPL.includes("missionText || '尚未设定使命'");
});
check('R83-4 M2 期限三值映射齐全（远期/中期/近期）且未设期限不显示（v-if="dir.term"）', () => {
  const s = stripComments(TERM_FN);
  // ⚠ R85 重指：v-else 只在**目标头内**判——全模板判会被 R85 新增的「＋ 新建项目 / 内联输入」那对 v-if/v-else 误伤。
  //   本条要守的是"期限未设时不留空位"，与项目区无关。能力本身一字未动。
  const head = segOf(LH, '<div class="gc-meta">', '</div>');
  return s.includes("'远期'") && s.includes("'中期'") && s.includes("'近期'")
    && head.includes('v-if="termText(dir.term)"');
});
check('R83-5/R121 M2 主攻数只在 >0 时显示；进度百分比保留（goalPct 口径）', () => {
  return LH_TPL.includes('<template v-if="focusedOf(di)">（主攻 {{ focusedOf(di) }}）</template>')
    && LH_TPL.includes('goalPct(di)')
    && segOf(LH, 'function focusedOf(', 'function openProject').includes('filter(p => p.isFocused).length');
});
check('R83-6/R121 M3 项目行卡：🚀 主攻 / 停滞标 / 迷你进度条 / pct% · done/total / 已完成降透明度', () => {
  return LH_TPL.includes('class="pr-mark" title="主攻项目">🚀')
    && LH_TPL.includes('class="pr-flag"')
    && LH_TPL.includes('class="mini-bar"><i :style="{ width:')
    && LH_TPL.includes('}}% · {{ projMeta.get(p.id)?.done')
    && LH_TPL.includes("done: projMeta.get(p.id)?.finished")
    && LH_STYLE.includes('.proj-row.done { opacity: .6; }');
});
check('R83-7 ★ 性能红线：模板内不直接调 projectProgress / isProjectStalled（一律走 projMeta 索引）', () => {
  const t = stripComments(LH_TPL);
  return LH.includes('const projMeta = computed(')
    && !t.includes('projectProgress(') && !t.includes('isProjectStalled(')
    && t.includes('projMeta.get(p.id)');
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
check('R84-1 W1 页头四要素齐全：图标 + workspace.name + 台描述 + 右端结构摘要', () => {
  return HEAD_TPL.includes("class=\"wsh-icon\">{{ workspace.icon")
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
check('R84-3 W1 页头 ≤40px', () => {
  return read('/newtab/views/workspace.css').includes('.ws-id-head { display: flex; align-items: center; gap: 8px; min-height: 30px; max-height: 36px;');
});
check('R84-4 W1 页头对所有台渲染（不再是 v-if="isHub" 的 hub 专属）', () => {
  return !WS84.includes('class="ws-id-head" v-if="isHub"') && !WS84.includes('v-if="isHub" class="ws-id-head"')
    && WS84.includes('class="ws-id-head"');
});
check('R84-5 W2-① 论点横幅两态：已设 → 标题 + 查看金字塔；未设 → 轻引导', () => {
  return BANNER_TPL.includes('class="tb-title"') && BANNER_TPL.includes("setViewMode('pyramid')")
    && BANNER_TPL.includes('class="tb-hint"') && BANNER_TPL.includes('＋ 点击确立本策展台的 L1 中心论点');
});
check('R84-6 W2-① 横幅只在卡片视图出现（金字塔视图本身有 L1 根，不重复）', () => {
  return WS84.includes("<div v-if=\"viewMode==='card'\">\n          <!-- R84（W2-①）") || WS84.includes("<!-- R84（W2-①）：中心论点提到首屏");
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
check('R85-5 T0-B（R117 修订：CompassShell 出口随「项目总览」退役移除，改由 ProjectCuration 持）：三处新建出口都调 addProjectToDir（dir.projects.push 全项目收敛到 store 一处）', () => {
  const tr = stripComments(read('/newtab/views/CompassTree.vue'));
  const pc = stripComments(read('/newtab/views/ProjectCuration.vue'));
  const lh = stripComments(LH85);
  return tr.includes('addProjectToDir(')
    && pc.includes('addProjectToDir(') && lh.includes('addProjectToDir(')
    && !tr.includes('dir.projects.push')
    && !pc.includes('dir.projects.push') && !lh.includes('dir.projects.push')
    && ST85.includes('dir.projects.push(proj)');
});
check('R85-6/R121 M4：聚焦条走 focusedProjects + projMeta 索引（模板内不直接调 projectProgress / isProjectStalled）', () => {
  return FBAR_TPL.includes('focusedProjects') && FBAR_TPL.includes('projMeta.get(p.id)?.pct')
    && !FBAR_TPL.includes('projectProgress(') && !FBAR_TPL.includes('isProjectStalled(')
    && !FBAR_TPL.includes('isProjectDone(');
});
check('R85-7/R121 M4：两态齐全——有主攻横排 fs-chip（单击联动展板/双击进详情），无主攻轻引导且把「最多 N 个」说在前面', () => {
  return FBAR_TPL.includes('focusedProjects.length') && TPL85.includes('class="fs-chip"')
    && TPL85.includes('openProject(p)') && TPL85.includes('class="fp-hint"')
    && TPL85.includes('FOCUS_PROJECT_LIMIT') && TPL85.includes('最多');
});
check('R85-8 M5-①：目标卡底内联新建——回车创建 / Esc 取消 / 失焦取消 / 预选该目标（不弹窗）', () => {
  return TPL85.includes('@keyup.enter="confirmAdd(dir.id)"') && TPL85.includes('@keyup.esc="cancelAdd"')
    && TPL85.includes('@blur="cancelAdd"') && TPL85.includes('class="chip-add"')
    && TPL85.includes('startAdd(dir.id)') && stripComments(LH85).includes('addProjectToDir(dirId, name)');
});
check('R85-9/R121 M5-②：hover 两动作 🎯 / › 齐全且 .stop 防冒泡（不误触整卡点击）', () => {
  const i = TPL85.indexOf('<span class="pr-acts">');
  const acts = i >= 0 ? TPL85.slice(i, i + 420) : '';
  return acts.includes('onToggleFocus(p)') && acts.includes('openProject(p)')
    && (acts.match(/@click\.stop/g) || []).length >= 2
    && STY85.includes('.proj-row:hover .pr-acts { display: inline-flex; }');
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
check('R86-1 T0：showDone / toggleShowDone **只在 store 定义**（三处组件零残留，不再各写一份）', () => {
  return ST86.includes('const showDone = computed') && ST86.includes('function toggleShowDone')
    && !stripComments(LH86).includes('function toggleShowDone')
    && !stripComments(CS86).includes('function toggleShowDone')
    && !stripComments(CT86).includes('function toggleShowDone');
});
check('R86-2 M7：主航线与项目总览各自的开关已移除（.mr-tool 开关 / .ov-toggle 零残留）', () => {
  return !LH86.includes('class="mr-tool" :class="{ off') && !CS86.includes('class="ov-toggle"')
    && !CS_STY.includes('.ov-toggle {');
});
check('R86-3 M7：方向台页头有开关 ★R177 重指带备案：开关改原型 checkbox 形态（done-toggle-label）；完整方向树独立页那一处**保留**', () => {
  return CS_TPL.includes('class="done-toggle-label"') && CS_TPL.includes('toggleShowDone')
    && CT86.includes('toggleShowDone') && CT86.includes('class="tree-tool"');
});
check('R86-4 M7 ★R177 重指带备案：面板级「完整方向树 →」随原型退役（页头 tree-link 承担同一导航；面板内 vm-bar 整条也进树），openTree 函数保留', () => {
  return LH86.includes('function openTree') && CS_TPL.includes('class="tree-link"');
});
check('R86-5/R121 D-A：主航线「看主线」模块标签保留；项目详情改由展板单行面包屑（pb-crumb）承载上下文', () => {
  const pc = read('/newtab/views/ProjectCuration.vue');
  return LH86.includes('class="mod-role"') && LH86.includes('看主线')
    && !CS_TPL.includes('管项目') && CS_TPL.includes('<ProjectCuration embedded />')
    && pc.includes('class="pb-crumb"') && pc.includes('pb-title-row');
});
check('R86-6 D-B ★R177 重指带备案：M8 >12 门控退役（其存在理由「与项目总览可见性分裂」已随 R117 项目总览退役消失），筛选改分段组常驻（原型 lh-filter-group），ovFilter 单一来源不变', () => {
  const lh = read('/newtab/components/compass/LighthousePanel.vue');
  return CS_TPL.includes(':tools-gate="true"')
    && lh.includes('class="lh-filter-group"') && lh.includes("emit('update:ovFilter', f)");
});
check('R86-7 D-B：★ 状态判定复用 isProjectStalled / isProjectDone 且**预计算成索引**（模板内不逐项调）', () => {
  const fn = stripComments(segOf(CS86, 'const projState = computed(', 'const filteredProjects'));
  return fn.includes('isProjectStalled(p)') && fn.includes('isProjectDone(p)')
    && !CS_TPL.includes('isProjectStalled(') && !CS_TPL.includes('isProjectDone(');
});
check('R86-8 D-B（R117 重写 · R177 随分段化改判据：主航线筛选不提供绕过全局开关的入口）', () => {
  const lh = read('/newtab/components/compass/LighthousePanel.vue');
  return !CS_TPL.includes('ov-empty-act') && !CS_TPL.includes('resetOvTools')
    && !CS86.includes('resetOvTools') && lh.includes('class="lh-filter-group"');
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
check('R87-2 R5-①：排序五档齐备，hot 按 callCount 降序 + lastCalledAt 兜底；偏好读值走白名单', () => {
  const opts = segOf(WS_TPL, '<select class="toolbar-select" v-model="sortBy">', '</select>');
  const fn = stripComments(segOf(WS87, 'function applySort(', '// REQ-028'));
  return ['manual', 'recent', 'visited', 'hot', 'title'].every(k => opts.includes('value="' + k + '"'))
    && fn.includes("sortBy.value === 'hot'") && fn.includes('b.callCount||0') && fn.includes('b.lastCalledAt||0')
    && WS87.includes('const SORT_BY_KEYS') && WS87.includes('SORT_BY_KEYS.includes(store.ui.sortPrefs.res.by)');
});
check('R87-3（R162 重指）筛选 7 档（optgroup 两组；旧四档值不变，unmounted 随挂载退役）', () => {
  const sel = segOf(WS_TPL, '<select class="toolbar-select" v-model="filterBy">', '</select>');
  return sel.includes('optgroup label="按链接类型"') && sel.includes('optgroup label="按状态"')
    && ['all', 'url', 'file', 'obsidian', 'hasLink', 'brokenPath', 'hasAssets'].every(k => sel.includes('value="' + k + '"'))
    && !sel.includes('unmounted')
    && WS87.includes('const FILTER_KEYS') && WS87.includes('const FILTER_PREDICATES');
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
check('R87-6（R122 重指）断链三视图：卡片整卡警示 + 描述替换引导，列表/看板徽标沿用，样式全走 tokens', () => {
  return WS_TPL.includes('v-if="isBrokenPath(r)"')
    && WS_TPL.includes("'warning-broken': isBrokenPath(r)") && WS_TPL.includes('⚠ 本地路径断链 · 点击补全') && WS_TPL.includes('class="rr-broken"') && WS_TPL.includes('class="kc-broken"')
    && WS_STY.includes('.rr-broken, .kc-broken') && WS_STY.includes('.warning-broken')
    && WS_STY.includes('var(--warning)') && WS_STY.includes('var(--surface-2)')
    && !WS_STY.includes('#D9A03C');
});
check('R87-7 R7-②：一键补全 = fixLink 打开抽屉 + focusLink 聚焦链接框；镜像卡只读拦截', () => {
  const fn = stripComments(segOf(WS87, 'function fixLink(', '// 单击（详情）与双击（打开链接）区分'));
  return WS_TPL.includes('@click.stop="fixLink(r)"') && fn.includes('isMirrorView(r)')
    && fn.includes('openResource(r)') && fn.includes('resFormRef.value?.focusLink()')
    && REF87.includes('defineExpose({ focusLink })') && REF87.includes('function focusLink(')
    && REF87.includes('linkInputRef.value?.select()');
});
check('R87-8 R7-③：双击打不开的 toast 按三态分流（none / incomplete / 协议不受支持）', () => {
  const fn = stripComments(segOf(WS87, 'function openResourceLink(', '\nfunction fixLink('));
  return fn.includes("st === 'none'") && fn.includes("st === 'incomplete'")
    && fn.includes('该卡还没填链接') && fn.includes('仅存文件名') && fn.includes('协议不受支持')
    && !fn.includes('请先补全链接（本地文件需完整路径');
});
check('R87-9 R5 收尾：筛选为零时空态说明原因 + 一键「清除筛选」（不让人以为卡丢了）', () => {
  return WS_TPL.includes('hasActiveFilter') && WS_TPL.includes('当前筛选没有匹配的资源卡')
    && WS_TPL.includes('清除筛选') && WS87.includes('function resetFilters()')
    && WS87.includes('const FILTER_LABELS');
});
check('R87-10 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十八轮 · V2.57.0：工具条分级与导入归位（W3 + W6）】');
// 气泡是工具条**中间**的嵌套子元素——要判"一级还剩什么"，得把气泡段**剔除**（不是从它起截断，
// 那会把气泡之后的「＋新建 / ⚙」一并切掉）
check('R88-1 W3：筛选气泡点外部关闭（复用 ⚙ 的 document click 机制），且与 ⚙ 菜单互斥', () => {
  return WS88.includes('function closeFilterPop()') && WS88.includes("document.addEventListener('click', closeFilterPop)")
    && WS88.includes("document.removeEventListener('click', closeFilterPop)")
    && WS88.includes('function toggleSettingsMenu()')
    && segOf(WS88, 'function toggleSettingsMenu(', '/** R88（W6）').includes('filterPopOpen.value = false')
    && segOf(WS88, 'function toggleFilterPop(', 'function closeFilterPop').includes('settingsMenuOpen.value = false');
});
check('R88-2 W3-①：工具条一级 = 视图 Tab ｜ 搜索 ｜ 筛选 ｜ ＋新建 ｜ ⚙', () => {
  return TB1_88.includes('class="view-tabs"') && TB1_88.includes('class="toolbar-search"')
    && TB1_88.includes('class="toolbar-filter"') && TB1_88.includes('＋ 新建')
    && TB1_88.includes('class="hero-btn settings"');
});
check('R88-3（R122 重指）排序 / 方向 / 密度 / 八档类型筛选仍收在气泡；列数方片与状态快捷筛选按原型提权到一级', () => {
  return !TB1_88.includes('v-model="sortBy"') && !TB1_88.includes('sort-dir-btn')
    && !TB1_88.includes('v-model="filterBy"') && !TB1_88.includes('v-model="density"')
    && TB1_88.includes('<ColsPicker') && TB1_88.includes('chips') && TB1_88.includes('v-model="quickFilter"');
});
check('R88-4 W3-②：气泡内四行控件齐全（排序+方向 / 类型 / 密度 / 列数），列数仍仅卡片视图', () => {
  // ⚠ 方向按钮的 class 是 `"toolbar-select sort-dir-btn"`（两个类），只能判子串
  return POP88.includes('v-model="sortBy"') && POP88.includes('sort-dir-btn')
    && POP88.includes('v-model="filterBy"') && POP88.includes('v-model="density"')
    && POP88.includes('<ColsPicker') && POP88.includes('class="fp-row"')
    && POP88.includes('重置全部') && POP88.includes(`v-if="viewMode==='card'"`);
});
check('R88-5 W3-③：生效值徽标——四项非默认才计入、最多 2 个 chip、超出 +N、默认时无徽标', () => {
  const fn = stripComments(segOf(WS88, 'const filterSummary = computed', '/** 徽标挤不下时的兜底'));
  return fn.includes("sortBy.value !== 'manual'") && fn.includes("filterBy.value !== 'all'")
    && fn.includes("density.value !== 'cozy'") && fn.includes('CARD_COLS_DEFAULT.res')
    && fn.includes("viewMode.value === 'card'")          // 列数只在卡片视图算"生效中"
    && WS88_TPL.includes('filterSummary.slice(0, 2)') && WS88_TPL.includes('filterSummary.length - 2')
    && WS88_TPL.includes('class="tf-chip"') && WS88_TPL.includes(':class="{on: filterSummary.length}"');
});
check('R88-6（R122 重指）批量开关常驻一级：批量中显「✓ 完成批量」（toggleBatchMode），退出通道不断', () => {
  return WS88_TPL.includes("{{ batchMode ? '✓ 完成批量' : '☑ 批量' }}") && WS88_TPL.includes('toggleBatchMode');
});
check('R88-7 W6：导入收进 ⚙（V3.7.0 重指：资源台分支退役后单形态「⬇ 导入数据包」，按台改名消歧义不再需要）', () => {
  return SM88.includes('@click="openImport"') && SM88.includes('⬇ 导入数据包') && !SM88.includes("isHub ? '⬇ 导入资源'")
    && WS88.includes('function openImport(') && WS88.includes('importModalOpen.value = true')
    && !TB1_88.includes('importModalOpen = true');
});
check('R88-8（R122 重指；V3.7.0 随迁 · R1.5 重指带备案：主 CTA 文案随「台内新建=论证卡」改「＋ 新建论证卡」）主色稀缺：一级只有一个 primary（导入/批量为 ghost 次级）', () => {
  return (TB1_88.match(/hero-btn primary/g) || []).length === 1
    && TB1_88.includes('hero-btn primary" @click="openNewArgument"')
    && (TB1_88.match(/hero-btn ghost/g) || []).length === 2
    && TB1_88.includes('⬇ 导入数据包') && TB1_88.includes('☑ 批量');
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
  const pq = stripComments(segOf(WS89, 'function parseQuery(', '/**' + ' 卡片是否命中查询'));
  const mc = stripComments(segOf(WS89, 'function matchCard(', '// 筛选（第八轮'));
  return pq.includes("tok.startsWith('#')") && pq.includes('tok.length > 1')
    && mc.includes('if (cardTags.some(c => c.split(\'/\').pop() === t)) continue');
});
// R110-LC（T3）：过滤管线收敛到 applyViewFilters（分类 → 筛选器 → 搜索），filteredResources 只做委托 + 归档排除；
// 归档提示计数复用同一实现 ⇒「搜索判据只有一份」的约束仍在，只是落点从 filteredResources 换到 applyViewFilters。
check('R89-3（R110 重指）★ R6：搜索判据**只有一份** matchCard（收敛于 applyViewFilters；filteredResources 委托且不内联匹配）', () => {
  const fn = stripComments(segOf(WS89, 'function applyViewFilters(', 'const filteredResources = computed('));
  const fr = stripComments(segOf(WS89, 'const filteredResources = computed(', '// 排序（第卅二轮'));
  return fn.includes('parseQuery(debouncedQuery.value)') && fn.includes('matchCard(r, p)')
    && !fn.includes("r.title.toLowerCase().includes(q)")
    && fr.includes('applyViewFilters(allResources.value)')
    && !fr.includes('matchCard(')
    && WS89_TPL.includes('#标签 可按标签直筛');
});
check('R89-4 W5：starred 星标筛选**四处同步**（白名单 / 谓词 / 标签 / 下拉）', () => {
  const keys = stripComments(segOf(WS89, 'const FILTER_KEYS = [', '\n'));
  const pred = stripComments(segOf(WS89, 'const FILTER_PREDICATES', '// 筛选（第八轮'));
  const labels = stripComments(segOf(WS89, 'const FILTER_LABELS', 'const filterLabel'));
  return keys.includes("'starred'") && pred.includes('starred: (r) => !!r.starred')
    && labels.includes("starred: '⭐ 星标'") && WS89_TPL.includes('<option value="starred">⭐ 星标</option>');
});
check('R89-5 ★ W4：三视图写动作（📌📂🗑）对镜像卡隐藏——门控在包裹 template 上', () => {
  const wrap = '<template v-if="!isMirrorView(r)">';
  const segs = [RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS];
  return segs.every(seg => seg.includes(wrap) && seg.includes('openMoveOne(r)') && seg.includes('deleteResource(r)'));
});
check('R89-6 W4：三视图镜像专属两动作 🎯 定位源 / ✕ 移出镜像 齐备，走既有 locateMirrorSource / removeMirror', () => {
  const segs = [
    [RES_CARD_ACTIONS, 'class="rc-action locate"', 'locateMirrorSource(r)', 'removeMirror(r)'],
    [RES_ROW_ACTIONS, 'class="rr-action locate"', 'locateMirrorSource(r)', 'removeMirror(r)'],
    [KANBAN_ACTIONS, 'class="kc-action locate"', 'locateMirrorSource(r)', 'removeMirror(r)']
  ];
  return segs.every(([seg, cls, a, b]) => seg.includes(cls) && seg.includes(a) && seg.includes(b))
    && read('/newtab/composables/useWorkspaceMirror.ts').includes('function locateMirrorSource(') && read('/newtab/composables/useWorkspaceMirror.ts').includes('function removeMirror(');
});
check('R89-7 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});
