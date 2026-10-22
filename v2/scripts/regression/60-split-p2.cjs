/**
 * R174-1 分片 · 60-split-p2：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');

console.log('【第一百零七轮 · V2.76.0：卡片内容自适应修复 + 安装包瘦身 + 生产复检】');
/** R107：生产复检反馈。F8 = 精确 N 列后长内容（长标题/长链接）经 grid 项 min-width:auto
 *  撑破轨道致列宽不一（变形）——三套卡片根补 min-width:0 + overflow:hidden（标题已有钳制）。
 *  F9a = 安装包瘦身：发布包剥离 sourcemap（70 文件 5.3M → 46 文件 ~1.5M）。
 *  另：两个 Markdown 模板导入（方向树/金字塔）已出设计与交互原型（04-55），待评审，未实装。 */
check('R107-1 ★ F8 卡片内容自适应：三套卡片根 min-width:0 + overflow:hidden（防长内容撑破轨道致列宽不一）· R155-③：资源富卡 min-height 86 → 120', () => {
  return WSP107.includes('min-height: 120px; min-width: 0; overflow: hidden;')
    && TM107.includes('gap: 6px; min-width: 0; overflow: hidden;')
    && CZ107.includes('position: relative; overflow: hidden; min-width: 0;');
});

console.log('【第一百零六轮 · V2.75.0：生产反馈首批（F1 乱码 + F2 顶栏对齐 + F3 精确列数 + F4 镜像三键 + F5 性能 + F7 清理镜像）】');
/** R106：生产环境实测反馈修复（附截图）。F1 = R105-E2 引入的 P0（属性插成文本节点）；
 *  F3 = R72-G6 公式在恰好 N 列时取整差一位（6/7 列永远少一），应用户拍板改精确 N 列；
 *  F4 = 镜像卡三键（单击只读详情 / 双击开链接 / Ctrl+Enter 定位源卡）；
 *  F5 = content 数据缓存 TTL 1.5s → 300s（onChanged 已兜底，消除每次开浮层全量重读整库）+ 测量脚本入仓；
 *  F7 = 一键清理本台镜像卡（只删投射，源卡保留）。 */
check('R106-1 ★ F1 乱码修复：mouseleave 回到 nav 开标签内，文本节点残留零命中', () => {
  return APP106.includes('<nav class="tabs" @mouseleave="wsOverflowOpen = false">')
    && !APP106.includes('> @mouseleave');
});
check('R106-2 F2 顶栏对齐（R108 重指：F10 资源台/策展台容器并入 1440，三档）', () => {
  return APP106.includes('const topbarAlign = computed(')
    && APP106.includes("if (p.startsWith('/settings')) return 'align-settings'")
    && APP106.includes("if (p.startsWith('/manual')) return 'align-manual'")
    && APP106.includes('.topbar-inner.align-page { max-width: 1440px; margin: 0 auto; padding: 0 36px; }')
    && !APP106.includes('align-ws');
});
check('R106-3 F4 镜像卡三键：单击只读详情（表单禁交互+只读守卫）/ Ctrl+Enter 定位源卡 / 定位落地调度台（R169 重指：只读态随两代容器合并挂壳 .drawer-body 的 bodyClass，选择器 .dr-body.dr-readonly → .dr-readonly；V3.7.0 重指：/curation?hl= 深链随资源台退役 → router.push(/) + 源卡在资源卡池 toast）', () => {
  return WSP106.includes('function openMirrorDetail(r: ResourceCard)')
    && WSP106.includes('const drawerReadonly = ref(false)')
    && WSP106.includes('.dr-readonly .ref-form { pointer-events: none; }')
    && WSP106.includes("if (drawerReadonly.value) { showToast('📡 镜像卡为引用——编辑请到源卡'); return }")
    && WSP106.includes("router.push('/')") && WSP106.includes('↗ 源卡在资源卡池 · ')
    && WSP106.includes("if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); locateMirrorSourceCard() }");
});
check('R106-4 F7 一键清理本台镜像卡：只删投射（源卡保留）+ 确认框报数 + 仅策展台入口', () => {
  return WSP106.includes('async function cleanAllMirrors()')
    && WSP106.includes("if (pp.targetWsId === workspaceId.value && removeProjection(d.value, pp.id)) removed++")
    && WSP106.includes('<Icon name="broom" :size="13"/> 清理本台镜像卡')
    && WSP106.includes("confirmText: '确认清理'");
});
check('R106-5 F5 性能（R128-A1 升级）：content 数据源改走 repository 缓存（TTL 手工缓存与裸 storage 读写退役，新鲜度由仓库统一保活）', () => {
  return OV106.includes("from '@/shared/storage/repository'") && OV106.includes('repoSubscribe(')
    && !OV106.includes('- dataCacheAt < (force ? 5000 : 300000)') && !OV106.includes('chrome.storage.local.set({ [DATA_KEY]')
    && !OV106.includes("chrome.storage.local.get(DATA_KEY)");
});
check('R106-6 F3 精确 N 列已在仓（三套网格 + 文档口径）——由 R72-8 重指把守，此处守 cardCols 文档口径', () => {
  return read('/shared/utils/cardCols.ts').includes('repeat(var(--grid-cols, N), minmax(0, 1fr))');
});

console.log('【第一百零五轮 · V2.74.0：P2 收官（B4 + C3 + D3 + E2 + W10）】');
/** R105：P2 最后五件（D-C 单独立项登记不在代码轮）。B4 好奇心培育降权（默认折叠一行摘要，
 *  直达锚点自动展开）；C3 浮层字号阶梯（文本档全走 --zy-fs-*，输入态 16-17px 保留）；D3 重复卡
 *  确认视图加「仍然新建一张」（整屏例外不变）；E2 策展台 >5 页签收起「≪ N」hover 展开（活动台
 *  恒可见）；W10 搜索纳入 link（两台与浮层范围统一，拍板按提案原文）。 */
check('R105-1 B4（V3.9.1 重指）手边三卡预览：任务卡 / 好奇心卡 / 资源卡三列在位，查看全部进入独立二级页，旧 tab 挂载状态退役', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('class="hand-board"') && h.includes('class="hand-grid"') && h.includes('好奇心卡') && h.includes('任务卡') && h.includes('资源卡') && h.includes("goDeck('task')") && h.includes("goDeck('curiosity')") && h.includes("goDeck('resource')") && !h.includes('curioMounted'); });
check('R105-2 C3 浮层字号阶梯：--zy-fs-2xs/xs/sm/md/lg 五档定义 + 文本档字面量归并（10-14px 零命中）+ 输入态 17px 保留', () => {
  return OV105.includes('--zy-fs-2xs:10.5px;--zy-fs-xs:11px;--zy-fs-sm:12px;--zy-fs-md:13px;--zy-fs-lg:14px;')
    && !/font-size:1[0-4](\.\d)?px/.test(OV105)
    && OV105.includes('font-size:17px');
});
check('R105-3 D3 重复卡确认视图第三选项「仍然新建一张」：forceNew 跳过查重（Event 误传防护：点击监听箭头包装）', () => {
  return OV105.includes("document.getElementById('__zy_dup_force__')?.addEventListener('click', onForceNew)")
    && OV105.includes('async function saveCapture(forceNew = false)')
    && OV105.includes('if (!forceNew && linkType === \'url\' && linkInput.value.trim())')
    && OV105.includes("addEventListener('click', () => { void saveCapture() })");
});
check('R105-4 E2 策展台 >5 页签收起「≪ N」：溢出指示 + hover/点击展开 + 活动台恒可见', () => {
  return APP105.includes('const E2_TAB_MAX = 5')
    && APP105.includes('const wsOverflow = computed(() => store.workspaces.length > E2_TAB_MAX)')
    && APP105.includes('class="tab tab-overflow"') && APP105.includes('≪ {{ hiddenWsCount }}')
    && APP105.includes('@mouseleave="wsOverflowOpen = false"')
    && APP105.includes("if (active && !head.some(w => w.id === active)) {");
});
check('R105-5 W10 搜索纳入 link：matchCard 补链接匹配（两台与浮层 res blob 范围统一）', () => {
  return WSP105.includes("if ((r.link || '').toLowerCase().includes(p.kw)) return true");
});

console.log('【第一百零四轮 · V2.73.0：Workspace 纯拆分第五批·收缩版（分类 CRUD → useCategoryCrud）】');
/** R104：末批按勘验收缩——原计划「分类树与拖拽」中，拖拽/折叠/侧栏选择与金字塔深度工具、
 *  卡片拖拽状态双向咬合，硬拆需先立共享拖拽状态层（登记另立项）；本批拆分类 CRUD
 *  （新建/重命名含同名校验与 4 级上限/删除含镜像级联清理/置顶/重复合并）。
 *  拆分五批收官：3583 → 3026 行（-557），五个域级 composable。 */
check('R104-1（V3.9.8 随迁）画布分类 CRUD 收敛：新建/同级/改名/说明/删除/拖拽移动由 useCurationMindMap 单一实现，宿主只绑定事件', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  return h.includes('export function useCurationMindMap(')
    && h.includes('function createChild(') && h.includes('function createSibling(')
    && h.includes('function renameNode(') && h.includes('function updateDescription(')
    && h.includes('async function removeNode(') && h.includes('function moveNode(')
    && h.includes('MIND_TOTAL_LEVEL')
    && host.includes('useCurationMindMap({') && host.includes('@create-child="onMindCreateChild"')
    && host.includes('@rename="mind.renameNode"') && host.includes('@move="mind.moveNode"')
    && !host.includes('async function deleteCategory(cat: Category)')
    && !host.includes('async function mergeDupCats()');
});

console.log('【第一百零三轮 · V2.72.0：Workspace 纯拆分第四批（镜像域 → useWorkspaceMirror）】');
/** R103：第四刀（本批断言纠缠最大，32 行逐一勘验后仅 6 处需重指——其余靠模板零改动+绑定存续自然存活）。
 *  V3.7.0（R179）：推送侧（mirrorPushModal 单卡📡/分类📤）与拉取侧（mirrorCatModal）随资源台退役，
 *  本断言收窄为**引用侧**拆分不变量（isMirrorCat/moveMirrorTo/removeMirror/locateMirrorSource）。 */
check('R103-1 ★ 镜像域拆分不变量（V3.7.0 重指）：引用侧四函数实现在 composable + 宿主解构绑定 + 宿主零重复实现（推送/拉取侧随资源台退役）', () => {
  return MIR103.includes('export function useWorkspaceMirror(')
    && MIR103.includes('function moveMirrorTo(m: MirrorView, catId: string)')
    && MIR103.includes('function removeMirror(r: ResourceCard)') && MIR103.includes('function locateMirrorSource(r: ResourceCard)')
    && WSP103.includes('useWorkspaceMirror({ d, categories, router, persist: () => store.persist() })')
    && WSP103.includes('isMirrorCat, moveMirrorTo, removeMirror, locateMirrorSource,')
    && !WSP103.includes('function moveMirrorTo') && !WSP103.includes('function confirmMirrorPush')
    && !MIR103.includes('confirmMirrorPush') && !MIR103.includes('confirmMirrorCat')
    && !WSP103.includes('const hubCatOptions = computed');
});

console.log('【第一百零二轮 · V2.71.0：Workspace 纯拆分第三批（卡片整理动作 → useWorkspaceBatch）】');
/** R102：第三刀——批量选择/批量移动/单卡移动/挂载到任务 四个子域合一迁出（~130 行散布实现）。
 *  R82 单向挂载红线断言随实现迁入 composable（表达式随 mountTarget ref 化 / persist 注入重指）。
 *  本断言守拆分不变量。 */
check('R102-1（V3.9.8 重指）整理动作域迁移不变量：策展宿主不再接 useWorkspaceBatch / batch-bar；资源池改用 useBatchSelect + DeckBatchBar 的唯一实现，旧宿主零重复动作', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return BAT102.includes('export function useWorkspaceBatch(')
    && !BAT102.includes('toggleMountTask') && !BAT102.includes('mountedResourceIds')
    && !host.includes('useWorkspaceBatch(') && !host.includes('class="batch-bar"')
    && !host.includes('function toggleBatchMode()') && !host.includes('async function batchDelete()')
    && pool.includes("import { useBatchSelect, addTagToCards }")
    && pool.includes('const { selected, size: selSize, allSelected, toggle: toggleSel, selectAll, invert: invertSel, clear: clearSel, setMode } = useBatchSelect')
    && pool.includes('function toggleBatch()')
    && pool.includes('<DeckBatchBar v-if="batchMode"')
    && pool.includes('function deleteSelected()');
});

console.log('【第一百零一轮 · V2.70.0：Workspace 纯拆分第二批（下钻抽屉 → useCurationDrill）】');
/** R101：第二刀。边界约定：状态与数据下沉（drillOpen/drillMode/openDrill + 四份惰性数据），
 *  落点导航回调（onDrillJumpCat/onDrillOpenCard/onDrillLocate）留宿主——它们写视图状态，是接线不是实现。
 *  R71-13/R76-1 按域重指；本断言守拆分不变量。 */
check('R101-1 ★ 下钻域拆分不变量：状态与数据在 composable（惰性求值随迁）+ 宿主解构绑定 + 落点导航回调留宿主', () => {
  return DR101.includes('export function useCurationDrill(')
    && DR101.includes("if (!drillOpen.value) return []")
    && DR101.includes('const drillNative = computed') && DR101.includes('const drillMirror = computed') && DR101.includes('const drillRecent = computed')
    && WSP101.includes('useCurationDrill({')
    && WSP101.includes('const { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillCardRows, drillRecent } = useCurationDrill({')
    && DR101.includes('drillCardRows')
    && WSP101.includes('function onDrillJumpCat(id: string) {') && WSP101.includes('function onDrillOpenCard(id: string) {') && WSP101.includes('function onDrillLocate(id: string) {')
    && !WSP101.includes('const drillCatRows = computed');
});

console.log('【第一百轮 · V2.69.0：Workspace.vue 纯拆分第一批（导入域 → useWorkspaceImport）】');
/** R100：Workspace.vue 3583 行的技术债开始偿还——第一批拆出导入三链路（数据包/书签/本地文件，
 *  ~220 行）为独立 composable，实现原位迁出、零行为变更。拆分约定：实现随迁（composable 内实现），
 *  绑定留宿主（解构保持原标识符，模板与断言入口面不变），断言按域归位（R100 重指 13 处）。
 *  本断言守拆分不变量：实现在 composable、宿主有绑定、宿主无重复实现。 */
check('R100-1 ★ 导入域拆分不变量（★R4-Db 重指带备案：书签那条自本模块搬出，唯一实现住在 useBookmarkImport.ts——拆分不变量本身一字未松，只是"实现在 composable、宿主只解构绑定、宿主零重复实现"这条管辖范围从三链路同文件变成两文件三链路，故判据按新落点点名，并把"宿主不得自带解析器"的负判据从 Workspace 扩到 GlobalSettings（它原先真有一份副本））：三链路实现在 composable + 宿主经解构绑定 + 宿主零重复实现', () => {
  const BK100 = read('/newtab/composables/useBookmarkImport.ts');
  const GS100 = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  return IMP100.includes('export function useWorkspaceImport(')
    && IMP100.includes('function handleBoardImport(') && IMP100.includes('async function handleFileImport(')
    && BK100.includes('export function useBookmarkImport(') && BK100.includes('function parseBookmarksHtml(')
    && WSP100.includes('useWorkspaceImport({ d, workspaceId, newCardCatId, persist: () => store.persist() })')
    && WSP100.includes('handleBoardImport')
    && GS100.includes('useBookmarkImport({') && GS100.includes('await handleBookmarkImport(e, bookmarkTargetWs.value)')
    && !WSP100.includes('function parseBookmarksHtml') && !WSP100.includes('function ensureBookmarkCategory')
    && !WSP100.includes('async function handleFileImport(')
    && !GS100.includes('function parseBookmarksHtml') && !GS100.includes('interface BkNode');
});

console.log('【第九十九轮 · V2.68.0：方向台组四件（M6 + M8 + D-D + D-E）】');
/** R99：P2 方向台组四条（三台面组收尾）。M6 网格顶对齐（展开不撑破网格）；M8 主航线筛选与项目
 *  总览共用 ovFilter（v-model 跨组件，一处切换两处生效，门控同 D-B）；D-D 页头主线状态摘要；
 *  D-E 跨区拖拽自动切换 pinned（连同 dragover 跨区放行——不改那条 drop 永远触发不了）。
 *  零数据模型改动、零迁移。 */
check('R99-1/R121 M6 「展开只长自己那张卡」的对齐语义 ★W11 再随迁带备案：主航线 goals-grid 退役，R3-B1 曾把这条钉到 .tree-columns-grid 三列网格；W11 用户拍板项目改纵向成舱 ⇒ 三列网格一并退役。纵向序列本身没有「同行高度对齐」问题（各舱独占一行），但「展开不牵连其他卡」这条意图改由**折叠而非拉伸**承担：非主攻项目走 projOpen 折叠、收起时指标不进渲染。本条改钉折叠在位 + 旧网格零残留，负锚防三列以任何名字回流', () => {
  return !CT_ALL.includes('.tree-columns-grid {') && !CT_ALL.includes('.goals-grid {')
    && CT_ALL.includes('function projOpen(') && CT_ALL.includes(':open="projOpen(row.proj)"')
    && CT_ALL.includes('v-if="!hideWhole"');
});
check('R99-2 M8 筛选传参链 ★R3-B1 退役重指带备案：ovFilter/tools-gate/selected-id 三件套（select→分段组→常驻）随主航线整体退役——方向台一级不再筛项目，密度由 R3-B′ 折叠控制；传参链不得在别处复刻', () => {
  const t = CT_ALL; const pc = read('/newtab/views/ProjectCuration.vue');
  return !t.includes('tools-gate') && !t.includes('toolsGate') && !t.includes('selectedId') && !pc.includes('ovFilter') && !t.includes('update:ovFilter');
});
check('R99-3 D-D 方向台页头主线状态摘要 ★R3-B1 随宿主改靶（R177 的 cph-summary-badge 形态随 Shell 退役）+ ★W12(V3.8.12)随迁备案：读数由方向树页头 treeStats 一次算齐、不在模板逐项调这条不变；载体随页头重构从 .tree-stats 一行密排改为 HERO 右栏的 .hero-stats（原型 .hero 右侧动作区下方的读数行）。★G1(V3.8.24)随迁带备案：主攻读数的 emoji 前缀迁移为 <Icon name="main-focus">，分段锚随迁（读数表达式不动）。★锚点用分段正则而非跨标签 includes —— 跨标签字面量对空白极敏感，一次格式化就静默失效', () => {
  const t = CT_ALL;
  return t.includes('Icon name="main-focus"') && t.includes('主攻 {{ treeStats.focused }}') && /战略目标 \{\{ treeStats\.dirs \}\}/.test(t)
    && t.includes('const treeStats = computed(') && !t.includes('focusCount')
    && t.includes('class="hero-stats"');
});
check('R99-4/R121 置顶与手动排序 ★R3-B2 回归方向树（右键菜单形态不再回来）：树内拖拽落位 + ▾ 菜单置顶，旧左栏拖拽与「跨区移动请先用 📌 置顶」文案仍须零残留', () => { const t = CT_ALL; const pc = read('/newtab/views/ProjectCuration.vue'); return t.includes('function onProjDrop(') && t.includes('function toggleProjectPin(') && !t.includes('class="proj-menu"') && !pc.includes('dragProjId') && !pc.includes('跨区移动请先用 📌 置顶/取消置顶'); });

console.log('【第一百零八轮 · V2.77.0：Markdown 模板导入实装（T1-T5）+ 页边距统一（F10）】');
/** R108：① 用户确认的两项 Markdown 导入实装——方向树战略目标下批量生成项目/指标/任务
 *  （CompassTree 📋 入口 + 共享弹窗 + 写入链），策展台金字塔批量生成论点/分类节点/节点卡片
 *  （Workspace ⚙ 入口 + 同款弹窗 + 写入链，hasThesis 决定 H1 是否采用，完成后切金字塔视图）。
 *  解析器入 shared/utils/mdImport.ts（纯函数，容错链经 TS 补全：H3/H4 先于父级时逐级承接）。
 *  ② F10：资源台/策展台容器与调度台/方向台统一 1440 居中（生产反馈：三页切换左右跳动感）。 */
check('R108-1 ★ 解析器纯函数：parseGoalTemplate（H1项目/H2指标/H3任务/正文详情+通用执行承接）+ parsePyramidTemplate（H1论点/H2-H4层级嵌套+跳级提升）', () => {
  return MI108.includes('export function parseGoalTemplate(src: string): GoalParseResult')
    && MI108.includes('export function parsePyramidTemplate(src: string): PyramidParseResult')
    && MI108.includes("M = { name: '通用执行', tasks: [], auto: true }")
    && MI108.includes('已提升为 L2 承接（跳级容错）')
    && MI108.includes('已提升为 L3 承接（跳级容错）');
});
check('R108-2（V3.9.8 随迁）共享导入弹窗：goal/pyramid/project 三模式 + hasThesis 决定 H1 采用 + 实时解析预览 + 导入后节点关联资源说明', () => {
  return ITM108.includes("mode: 'goal' | 'pyramid'")
    && ITM108.includes('parseGoalTemplate(src.value)')
    && ITM108.includes('parsePyramidTemplate(src.value)')
    && ITM108.includes("mode === 'project'")
    && /<Icon name="link"[^>]*\/> 导入后关联资源卡/.test(ITM108)
    && ITM108.includes('hasThesis')

});
check('R108-3 ★ goal 写入链：任务双挂（projectId+metricId+taskIds 回写）+ 同名跳过幂等 + 单次持久化', () => {
  return CT_ALL.includes('function confirmGoalImport(payload: { goal?: GoalParseResult })')
    && CT_ALL.includes("met = { id: uid('met'), title: m.name, taskIds: [] }")
    && CT_ALL.includes('met.taskIds.push(task.id)')
    && CT_ALL.includes('d.value.tasks.some(x => !x.deletedAt && x.projectId === proj!.id && x.metricId === met!.id && x.title === t.name)')
    /* ★W11 随迁带备案：发起端 v-for 变量名由 dir 变 dg（.dir-head 落在 v-for="dg in towerGroups" 内） */
    && CT_ALL.includes('openGoalImport(dg.dir)');
});
check('R108-4（V3.9.8 随迁）pyramid 写入链：论点卡+setThesis（本台未设时）+ 分类同父同名复用 + 200 节点上限 + 导入后回到画布根节点', () => {
  return WSP108.includes('function confirmPyramidImport(payload: { pyramid?: PyramidParseResult })')
    && WSP108.includes('setThesis(d.value, workspaceId.value, card.id)')
    && WSP108.includes('const found = d.value.categories.find(c => c.workspaceId === workspaceId.value && !c.deletedAt && (c.parentId || undefined) === parentId && c.name === name') // R109 重指：同父同名复用排除软删分类
    && WSP108.includes('if (nodeTotal > 200) { showToast(\'⚠ 单次导入建议不超过 200 个节点——请分批导入\'); return }')
    && WSP108.includes("pyramidImportOpen.value = false") && WSP108.includes("mind.selectedId.value = 'root'")
    // R113-N4：入口从 ⚙ 溢出菜单提到一级工具条，文案缩短为「📋 导入模板」
    && WSP108.includes('📋 导入模板') && WSP108.includes('@click="pyramidImportOpen = true"><Icon name="filetext" :size="13"/> 导入模板</button>');
});
check('R108-5 F10 页边距统一：ws-page 1440 居中 + topbar 三档（align-ws 退役）', () => {
  return WSP108.includes('.ws-page { min-height: 100vh; background: var(--bg); max-width: 1440px; margin: 0 auto; }')
    && WSP108.includes('.ws-content { flex: 1; min-width: 0; padding: 20px 36px 90px; overflow-y: auto; }')
    && !read('/newtab/App.vue').includes('align-ws');
});

console.log('【第一百零九轮 · V2.79.0：生产反馈第三批（F11 规则入口 + F12 全景修复与分类软删 + F13 对齐 + F14 页头/指标条）】');
/** R109：生产反馈第三批五项。F11 导入弹窗内嵌 AI 整理规则（规则常量与 03-7 文档同源 + 复制按钮）；
 *  F12-a 资源台全景 workspaceId 收紧（修复：全景分类视图曾按 categoryId 裸匹配——策展台卡可混入）；
 *  F12-b 分类软删（Category.deletedAt + 回收站分类分区：删除分类/删除策展台/合并重复三链路统一软删）；
 *  F13 资源台/策展台单一滚动域（顶部三模块移入 ws-content，右缘对齐，工具条吸顶）；
 *  F14 页头单图标（台名剥离图标前缀）+ 指标卡纵向两行重设计。 */
check('R109-1 ★ F11 导入弹窗内嵌 AI 整理规则：GOAL_RULE/PYRAMID_RULE 常量 + 面板展开 + 一键复制', () => {
  return MI109.includes('export const GOAL_RULE') && MI109.includes('export const PYRAMID_RULE')
    && ITM109.includes('GOAL_RULE, PYRAMID_RULE')
    && ITM109.includes('async function copyRule()')
    && ITM109.includes("navigator.clipboard.writeText(ruleText.value")
    && /<Icon name="book"[^>]*\/> AI 整理规则/.test(ITM109) /* ★G1(V3.8.25)随迁带备案：📖 迁 <Icon name="book"> */;
});
check('R109-2（V3.9.8 随迁）单一滚动域：页头/指标/工具条/画布同处 ws-content，工具条吸顶；旧双栏 ws-columns 退役', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  return WSP109.includes('.ws-content { flex: 1; min-width: 0; padding: 20px 36px 90px; overflow-y: auto; }')
    && WSP109.includes('.ws-toolbar { position: sticky; top: 0; z-index: 5;')
    && WSP109.indexOf('class="ws-id-head"') > WSP109.indexOf('class="ws-content"')
    && host.includes('<CurationMindMap')
    && !host.includes('class="ws-columns"');
});
check('R109-3（V3.9.8 随迁）页头单图标 + 双指标盒：台名剥离图标前缀，指标盒横向 label/value，画布节点有 hover 抬升反馈', () => {
  const c = read('/newtab/components/curation/curation.css');
  return WSP109.includes("wsDisplayNameOf(workspace)")
    && WSP109.includes('.metric-box { background: var(--surface); border: 1px solid var(--border);')
    && c.includes('.mind-node:hover { border-color: var(--border-strong); box-shadow: var(--shadow); }')
    && !WSP109.includes('.mc-value') && !WSP109.includes('.metric-card'); /* ★R4-Dj：原第三条正判据 .mc-value{font-size:20px} 与被搬走的 .metric-card 同属退役指标卡，改为负判据钉"死类名不许回流"——数值字号这件事在现役 UI 里没有对应物（台面指标区 R98/R123 起逐步退役、读数移到调度台 MetricBar），硬找等价样式来钉只会再养一条假证据 */
});
check('R109-4 ★ F12-a workspaceId 收紧（★R4-Da 退役重指带备案：原判据点名全景右栏的 panSelWs+panSelCat 双过滤、计数的 ws|cat 复合键、树头措辞「全景 · 资源台 · N 分类」——🗺 全景整页随资源台退役删除。"卡列表/计数必须按所在台收紧，别台卡不得混入"这条口径本身没有松：三个存活管理面各自仍有硬判据——① 池面板 workspaceId===CURATION_WS_ID ② 策展台 boardCardsOf(d, workspaceId) + 分类计数走 catId 桶 resBucket ③ 设置页按台导出 CSV 亦带 workspaceId 过滤；全景那三条锚点改为 codeOnly 零命中判据防回流）+ 树头措辞修正随页面退役一并归档', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const pcp = read('/newtab/components/compass/PoolCardsPanel.vue');
  const ws = read('/newtab/views/Workspace.vue');
  const retired = ['r.workspaceId === panSelWs.value && r.categoryId === panSelCat.value', "cat.workspaceId + '|' + cat.id", '全景 · 资源台 · {{ panTotalCats }} 分类'];
  return retired.every(k => !g.includes(k))
    && pcp.includes('.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)')
    && pcp.includes('const poolTotal = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID).length)')
    && ws.includes('boardCardsOf(d.value, workspaceId.value)')
    && ws.includes('const resBucket = computed(() => buildBucketIndex(allResources.value')
    && ws.includes('directCount: (resBucket.value.get(c.id) || []).length')
    && g.includes('!r.deletedAt && r.workspaceId === csvWsId.value');
});
check('R109-5 ★ F12-b 分类软删：Category.deletedAt + 删除分类/合并重复/删除策展台三链路统一软删 + 回收站分类分区（恢复=清 deletedAt）（★R4-Da 退役重指带备案：原判据里 GS 那一处 !c.parentId && !c.deletedAt 是全景根分类的过滤，随整页退役删除——同一条「软删分类不参与组织与回填」纪律在设置页仍有一处活落点：AI 建议采纳回填 categoryId 前先确认该分类未软删，判据改指它，并对全景旧过滤做 codeOnly 零命中防回流；models / 策展台 / 回收站三侧判据一字未动）', () => {
  return read('/shared/models/index.ts').includes('deletedAt?: number')
    && WSP109.includes('deleteDeck(d.value, workspaceId.value)') && read('/shared/utils/compassCrud.ts').includes('for (const c of d.categories) if (c.workspaceId === wsId && !c.deletedAt) { c.deletedAt = now; catIds.push(c.id) }')
    && WSP109.includes('const wsCats = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value && !c.deletedAt))')
    && GS109.includes('dd.categories.some(c => c.id === s.categoryId && !c.deletedAt)')
    && !codeOnly(GS109).includes('!c.parentId && !c.deletedAt')
    && RB109.includes("const tab = ref<'res' | 'task' | 'curio' | 'cat' | 'arg'>('res')") // R2-⑤：论证卡入族，分区联合类型随之扩一枚
    && RB109.includes('function restoreCat(c: { id: ID; deletedAt?: number })')
    && RB109.includes('分类分区');
});


// ============== 第 111 轮 · V2.79.0：调度画像周报（04-58 方向③）——引擎/全屏浮层/页头入口/全数字下钻 ==============
console.log('【第 111 轮 · V2.79.0：调度画像周报】');
check('R111-1（R172-T9 重指带备案）周报引擎并档：`weeklyReport.ts` 退役，唯一留存能力 `weekWindow`（周一锚定 + 按日期分量减一周、不按毫秒减）并入 `shared/utils/reviewReport.ts`；四段式装配链（buildWeeklyReport / conversionRate）随组件退役删除', () => { const fsx = require('fs'); const gone = !fsx.existsSync(path.resolve(base, 'shared/utils/weeklyReport.ts')); const rr = read('/shared/utils/reviewReport.ts'); return gone && rr.includes('export function weekWindow') && rr.includes('周一锚定') && !rr.includes('buildWeeklyReport') && !rr.includes('conversionRate') && !rr.includes('fetch(') && !rr.includes('XMLHttpRequest'); });
check('R111-2（R172-T9 重指带备案）复盘零写入红线：`reviewReport.ts` 与复盘段 `ReviewPanel.vue` 均零 storage 写、且复盘段不碰 store（数据全由宿主以 prop 传入）；AI 采纳写库随 T11 报告弹框落地时另补该场景断言', () => { const rr = read('/shared/utils/reviewReport.ts'); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); return !rr.includes('saveData') && !rr.includes('localStorage') && !rr.includes('.persist(') && !rp.includes('saveData') && !rp.includes('store.persist') && !rp.includes('useAppStore'); });
check('R111-3（R172-T9 重指带备案）周报全屏浮层退役：调度画像周报组件文件已不存在；复盘能力改由仪表盘「复盘段」承接（四范围切换 + 节奏曲线粒度自适应 + KPI/条形/规则三类下钻 + 两栏网格）', () => { const fsx = require('fs'); const gone = !fsx.existsSync(path.resolve(base, 'newtab/components/WeeklyReportOverlay.vue')); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); const css = fsx.readFileSync(path.resolve(base, 'newtab/components/dashboard/dashboard.css'), 'utf8'); return gone && rp.includes('周复盘') && rp.includes('月复盘') && rp.includes('自定义区间') && rp.includes('项目复盘') && rp.includes('dz-rev-grid') && rp.includes('trendPts') && css.includes('.dz-rev-grid { display: grid; grid-template-columns: 1fr 1fr;'); });
check('R111-4 ★W12-D 再退役重指带备案：调度台入口整合 ——「不含旧入口」四条负锚（📊周报 / wrOpen / onWrDrill / wr-overlay）一字未动；右上角那一枚由「📈 复盘 · 跳 /profile」改为「📈 今日战报 · 就地开弹窗」。改判据的依据：热力图退役后调度台仍需一个「今天的全貌」入口，而跳去画像洞察页等于离开手边的三件事去看另一个尺度，就地弹窗更贴处境（用户 2026-10-13 拍板）。落点由 router.push 改指 battleHost.openToday()，复盘本身仍由画像洞察页承载（能力未从产品消失，只是入口语义的分工变了）', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('📊 周报') && !h.includes('wrOpen') && !h.includes('onWrDrill') && !h.includes('wr-overlay') && h.includes('📈 今日战报') && !h.includes("router.push('/profile')") && h.includes('battleHost.value?.openToday()') && h.includes('function openReview'); });
// ★W9 退役重指带备案：R111-5 原判「gs.includes("openLog('called')") && !gs.includes('onDashOpenLog')」——
// openLog 宿主随仪表盘迁 ProfileInsights，onDashOpenLog 的负锚仍在 GlobalSettings（两侧各守一半）。
// 守的三件一字未减：① CompassHome 旧下钻链零残留 ② 日详情「查看全部记录」由 HeatmapModule 承接 ③ 复盘段下钻三件在位。
check('R111-5（R172-T9 重指带备案）四大数字下钻能力等价迁入仪表盘：四类记录入口（入台/移出/调出/写入记录）+ 日详情「查看全部记录 ›」按日预筛 + 复盘段 KPI/方向/规则下钻；CompassHome 的旧下钻链（openRec/gotoAnchor）零残留。★W2 重指带备案：日详情宿主自 GlobalSettings.onDashOpenLog 迁至 HeatmapModule.onOpenLog（热力图迁调度台）。★W9 再随迁带备案：四类记录入口的宿主自 GlobalSettings 再迁 ProfileInsights', () => { const h = read('/newtab/views/CompassHome.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); const pi = read('/newtab/views/ProfileInsights.vue'); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); const hmod = read('/newtab/components/dashboard/HeatmapModule.vue'); return !h.includes("openRec('in')") && !h.includes("openRec('called')") && pi.includes("openStatDrawer('today-call')") /* ★W15-T1 再随迁带备案 2026-10-16：调出入口由事件流水改卡片清单 */ && pi.includes("openLog('log')") && !gs.includes('onDashOpenLog') && hmod.includes('onOpenLog') && hmod.includes('logOpen') && hmod.includes(':preset="logPreset"') && rp.includes('DrillCardList') && rp.includes('tasksOfDirection(') && rp.includes('ruleHit'); });
check('R111-6（R172-T9 重指带备案）卡片行下钻定位的单一实现：TOP5 / 四段式下钻随周报浮层退役 —— 卡片级"单击定位 / 双击开链"收敛到 `DrillCardList.vue`（资源卡带 link 时 `openExternalLink`，否则 `locateTargetOf`），定位落位仍由 `locate.ts` 统一给出 `/workspace/<wsId>?hl=<cardId>`', () => { const c = read('/newtab/components/dashboard/DrillCardList.vue'); const u = read('/shared/utils/locate.ts'); return c.includes('toOpenableUrl(card.linkType, card.link)') && c.includes('openExternalLink(url)') && c.includes('locateTargetOf(store.data!, kind, r.id)') && u.includes('hl: id'); });
check('R111-7（R172-T9 重指带备案）环比真实聚合：`reviewReport.ts` 走等长窗口环比（`prevWindow` 按 `win.days` 回推）+ `buildReview` 同期算本期与前一期聚合（杜绝"部分月 vs 整月"假下跌）', () => { const rr = read('/shared/utils/reviewReport.ts'); return rr.includes('export function prevWindow(') && rr.includes('const s = addDays(e, -(win.days - 1))') && rr.includes('const prevAgg = aggregateRange(stats, prev.s, prev.e)') && rr.includes('delta: { acts: pct(agg.acts, prevAgg.acts), W: pct(agg.W, prevAgg.W) }'); });
check('R111-8（R172-T9/T11 重指带备案）手册同步：复盘与热力图章节（入口/位置/下钻/纯读取）——原「调度画像周报」章随浮层退役，判据改认新居所。★W2 重指带备案：热力图迁调度台。★W9 退役重指带备案：仪表盘/复盘段宿主再迁画像洞察页，mid-8 标题由「调度台 + 知源仪表盘」改「调度台 + 画像洞察页」，入口措辞同步（设置→知源仪表盘 已不在手册宣传面）', () => { const m = read('/newtab/manual-data.ts'); return m.includes('复盘与热力图（调度台 + 画像洞察页）') /* R172-T9/T11 重指带备案：周报浮层退役，mid-8 整章重写为「复盘与热力图」；W2 热力图迁调度台；W9 宿主改画像洞察页 */ && m.includes('周 / 月 / 自定义区间 / 项目') /* 同上：窗口切换现为四个范围 */ && m.includes('在<b>调度台</b>，位于今日三件事下方') /* W2：热力图新位置明写 */ && !m.includes('设置 → 知源仪表盘') && !m.includes('设置 → 资源生命周期'); /* W9 负锚：宣传面不许再把仪表盘/生命周期说成设置页 */ });

// ============== 第 110 轮 · V2.79.0（并入 111）：资源生命周期 + BUG×2 + 金字塔全屏 ==============
console.log('【第 110 轮 · V2.79.0：LC + BUG-1/BUG-2 + FS】');
// ---- BUG-1：资源台镜像脏数据 ----
check('R110-B1-1 ★ 镜像净化函数：scrubHubMirrorMarkers（幂等剥离 __mirrorProjId/__mirrorCat + 清除 targetWsId 指向资源台的投射记录）', () => { const h = read('/shared/storage/hub.ts'); return h.includes('export function scrubHubMirrorMarkers(d: AppData): number') && h.includes("'__mirrorProjId' in r") && h.includes("'__mirrorCat' in r") && h.includes('p.targetWsId !== CURATION_WS_ID'); });
check('R110-B1-2 ★ 红线兜底：curationMetrics 对 hub 台镜像计数恒 0（不再依赖「数据一定干净」）', () => { const h = read('/shared/storage/hub.ts'); return h.includes('const isHub = isHubWs(d.workspaces.find(w => w.id === wsId))') && h.includes('if (isMirrorView(r) && !isHub) mirrored++') && h.includes('if (!isMirrorView(r) || isHub) native++'); });
check('R110-B1-3（R122 重指）★ 启动期接线保留；hub 提示格退役（分类数转入页头描述，无「待清理」分支）', () => { const r = read('/shared/storage/repository.ts'); const w = read('/newtab/views/Workspace.vue'); return r.includes("import { pruneDanglingProjections, scrubHubMirrorMarkers } from './hub'") && r.includes('try { scrubHubMirrorMarkers(data) } catch { /* noop */ }') && !w.includes('hubCountHint') && w.includes('{{ categories.length }} 个分类') && !w.includes('待清理'); });
// ---- BUG-2：附件明细跳卡 / 孤儿清理 ----
check('R110-B2-1 ★ 附件行三态：cardExists 判定 + 本体缺失（IndexedDB 只读索引）+ 孤儿本体清单', () => { const o = read('/newtab/components/CurationDrillDrawer.vue'); return o.includes('cardExists: (cardId: string) => boolean') && o.includes('referencedAssetIds: string[]') && o.includes('getAllAssetIds') && o.includes("type AssetRowState = 'ok' | 'missing' | 'orphan'") && o.includes('orphanAssetIds'); });
check('R110-B2-2 ★ 点击行 = 定位来源卡：本台高亮 / 跨台定位（★R4-De 重指带备案：原判据逐字钉 query 字面量 `{ hl: cardId }`，并默认跨台一定走 `/workspace/<id>`——而 R179 之后资源卡真身在隐藏池，池卡的跨台兜底若照旧直拼就会落「策展台不存在」死页。锚点跟着实现搬到共用算式 resourceLocateRoute 的调用上，口径不降反升：现在既钉住 hl=cardId 仍在 query 里，又钉住落点必须由算式算、不许再手拼路径字面量）', () => { const o = read('/newtab/components/CurationDrillDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); return o.includes("emit('locate-asset', row.cardId)") && w.includes('function onDrillLocateAsset') && w.includes('query: { ...fb.query, hl: cardId }') && w.includes('resourceLocateRoute(r.workspaceId)') && !w.includes("path: `/workspace/${r.workspaceId}`"); });
check('R110-B2-3 ★ 清理双入口（单条 🗑 + 顶部批量条）均二次确认，且复用 REQ-048 清理语义（★R4-Dc 重指带备案：批量那条自本文件改走共用实现 cleanupOrphanAssetsOf(d.value)，单条的 deleteAsset 形参随载荷收敛改名——两条锚点跟着实现搬落点，「两个入口都要有门」这一句一字未松，且本轮把同一句话补到了此前单击即删的设置页第三枚钮上，见 R4-Dc 新增判据）', () => { const o = read('/newtab/components/CurationDrillDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); return o.includes("emit('cleanup-asset'") && o.includes("emit('cleanup-orphans')") && o.includes('useConfirm') && o.includes('dd-orphan-bar') && w.includes('function onDrillCleanupAsset') && w.includes('cleanupOrphanAssetsOf(d.value)') && w.includes('deleteAsset(assetId)'); });
check('R110-B2-4 ★ 清理口径含回收站软删卡（软删可恢复 ⇒ 其附件必须保留）（★R4-Dc 重指带备案：keepIds 算式原先在两个宿主里各写一遍（钻取抽屉那份手写 collect、设置页那份手写 forEach），两份只差签名、可各自漂移，而它们算的是「哪些本体不许删」——收进 shared/storage/assets.ts 的 collectReferencedAssetIds 一份，判据跟着搬到真源，并★点名第四类卡 argCards：assets 字段挂在 CardBase 上、论证卡本就继承（R39-1 断言四张卡 extends CardBase），原先两份都漏了它，今天没出事只是侥幸）', () => {
  const a = read('/shared/storage/assets.ts');
  const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const gs = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  return a.includes('export function collectReferencedAssetIds')
    && a.includes('collect(d.resources)') && a.includes('collect(d.tasks)')
    && a.includes('collect(d.curiosities)') && a.includes('collect(d.argCards)')
    && a.includes('export async function cleanupOrphanAssetsOf')
    && !w.includes('const collect =') && !gs.includes('const collect =')
    && !w.includes('.forEach(r => collect(') && !gs.includes('.forEach(r => collect(');
});
// ---- LC：资源生命周期 ----
check('R110-LC-1 生命周期引擎（R117-E 修订：阈值由全局写死改为 per-card 自定义，出厂默认仍是 30/90 = 3:1）：三态纯计算 + 新卡 14 天宽限 + 进行中任务恒活跃', () => { const l = read('/shared/utils/lifecycle.ts'); return l.includes('export function lifecycleState') && l.includes('export const DEFAULT_COOLING_DAYS = 30') && l.includes('export const ARCHIVE_RATIO = 3') && l.includes('export const DAY_MS = 86400_000') && l.includes('export const COOLING_MS = DEFAULT_COOLING_DAYS * DAY_MS') && l.includes('export const ARCHIVE_MS = COOLING_MS * ARCHIVE_RATIO') && l.includes('export const NEW_GRACE_MS = 14 * DAY_MS') && l.includes('export function coolingMsOf(card: LifecycleInput)') && l.includes("card.kind === 'task' && card.status === 'doing'"); });
check('R110-LC-2（R113-N2 重指：内嵌化 + 实体切换）生命周期面板：甜甜圈三态 + 数字可点击切换列表 + 归档/忽略30d/恢复 + 点击条目定位 + 顶部实体切换', () => { const v = read('/newtab/components/LifecyclePanel.vue'); return v.includes('lc-donut') && v.includes("setFilter('archived')") && v.includes("emit('archive', e.card.id)") && v.includes("emit('snooze', e.card.id)") && v.includes("emit('reactivate', e.card.id)") && v.includes("emit('locate', e.card.id, e.card.kind)") && v.includes('lc-kind-tab') && v.includes('lc-kind-badge') && !v.includes('<Drawer'); });
check('R110-LC-3 ★（R113-N2 重指：宿主=GlobalSettings）面板被动化：面板只发意图、不改 props；宿主对真实卡对象落库 + persist（修复「传副本 ⇒ 归档落空」）（★W9 退役重指带备案：宿主由 GlobalSettings 改指 ProfileInsights §3——lcFind / lifecycleArchived 落库 / reactivateCard / snoozeCard / persist 五件逐条照搬，「面板被动化」这条红线一字未动，并对 GS 加 codeOnly 零命中负锚）', () => { const v = read('/newtab/components/LifecyclePanel.vue'); const g = read('/newtab/views/ProfileInsights.vue'); const gc = codeOnly(read('/newtab/views/GlobalSettings.vue')); return v.includes('archive: [id: string]') && !v.includes('e.card.lifecycleArchived = true') && g.includes('function lcFind(id: string)') && g.includes('c.lifecycleArchived = true') && g.includes('store.persist()') && g.includes('reactivateCard(c)') && g.includes('snoozeCard(c)') && !gc.includes('lcFind') && !gc.includes('reactivateCard') && !gc.includes('snoozeCard'); });
check('R110-LC-4（R113-N2 重指：入口收敛）生命周期唯一入口 = 画像洞察页 §3（★W9 退役重指带备案：原「设置→总览·资源生命周期」这一入口随知源仪表盘整块迁 /profile，设置页导航里 dashboard / lifecycle 两个键位一并消失——收敛语义不因此变松：① LifecyclePanel 仍只有一处挂载点，且就在 /profile；② 设置页按 codeOnly 零命中 lifecycle 键位与 <LifecyclePanel>（不许把面板搬回设置页）；③ 三宿主就地面板/⏳ 已移除照旧；④ 归档提示条深链由 /settings?page=lifecycle 改指 /profile#lifecycle，三处一字不漏）· ★W10 退役重指带备案：LifecyclePanel 挂载点随 T6 并段迁 PiYear（#lc-sec 锚保留），宿主 ProfileInsights 只传 :lc-cards + import type，唯一挂载语义不变', () => { const g = read('/newtab/views/GlobalSettings.vue'); const gc = codeOnly(g); const p = read('/newtab/views/ProfileInsights.vue'); const py = read('/newtab/components/profile/PiYear.vue'); const w = read('/newtab/views/Workspace.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const tp = read('/newtab/components/compass/TaskManagerPanel.vue'); const router = read('/newtab/router.ts'); return !gc.includes("key: 'lifecycle'") && !gc.includes("key: 'dashboard'") && !gc.includes("key: 'panorama'") && !gc.includes("label: '资源台全景'") && !gc.includes('<LifecyclePanel') && router.includes("path: '/profile'") && py.includes('<LifecyclePanel kind="all" :cards="lcCards"') && py.includes('id="lc-sec"') && p.includes(':lc-cards="lcCards"') && p.includes("import type { LifecycleCard } from '@/newtab/components/LifecyclePanel.vue'") && !w.includes('<LifecyclePanel') && !cp.includes('<LifecyclePanel') && !tp.includes('<LifecyclePanel') && w.includes('/profile#lifecycle') && cp.includes('/profile#lifecycle') && tp.includes('/profile#lifecycle'); });
check('R110-LC-5 ★ T3 归档集成：默认视图排除归档卡 + 三处降级提示 + 全局搜索排除归档并按同口径报数', () => { const w = read('/newtab/views/Workspace.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const tp = read('/newtab/components/compass/TaskManagerPanel.vue'); const g = read('/newtab/components/GlobalPopups.vue'); return w.includes('.filter(r => !r.lifecycleArchived)') && w.includes('ws-archived-hint') && cp.includes('!c.lifecycleArchived') && cp.includes('cz-archived-hint') && tp.includes('!t.lifecycleArchived') && tp.includes('tm-archived-hint') && g.includes('allResults.value.filter(r => !r.archived)') && g.includes('archivedMatchCount') && g.includes('gp-archived-hint') && g.includes('function hitResult('); });
check('R110-LC-6 零迁移：lifecycleArchived 为 CardBase 可选字段（三卡共享，老数据无需迁移）', () => { const m = read('/shared/models/index.ts'); return m.includes('/** R110-LC：生命周期归档标记（可选字段，零迁移）') && m.includes('lifecycleArchived?: boolean'); });
// ---- FS：金字塔全屏 ----
check('R110-FS-1（V3.9.8 随迁）路线 A：画布壳元素级 requestFullscreen + 原生 fullscreenchange 同步 + exitFullscreen', () => { const m = read('/newtab/components/curation/CurationMindMap.vue'); return m.includes('await el.requestFullscreen()') && m.includes("document.addEventListener('fullscreenchange', onFullscreenChange)") && m.includes('document.exitFullscreen()') && m.includes('const localFallback = ref(false)'); });
check('R110-FS-2（V3.9.8 随迁）路线 B 自动降级：requestFullscreen 缺失/被拒 → is-fs-fallback 覆盖层 + Esc 退出 + 显式“退出全屏”双保险', () => { const m = read('/newtab/components/curation/CurationMindMap.vue'); const c = read('/newtab/components/curation/curation.css'); return m.includes('localFallback.value = true') && m.includes("e.key === 'Escape' && props.fullscreen && props.fullscreenFallback") && m.includes("fullscreen ? '退出全屏' : '全屏'") && c.includes('.mindmap-shell.is-fs-fallback') && c.includes('position: fixed;'); });

// ============== 第 112 轮 · 性能专项（04-59）第一批：渲染规模治理 + 热路径削减 ==============
