/**
 * R174-1 分片 · 60-split-p2：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

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
    && WSP106.includes('🧹 清理本台镜像卡')
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
check('R105-1 B4（R117-C1 重写：「好奇心培育」折叠一行摘要的降权策略退役，改为调度台底部双 tab）：好奇心培育独立成 tab + 懒挂载（curioMounted）+ 直达锚点自动切 tab；旧折叠摘要态（curioCollapsed / curio-teaser）零残留', () => {
  return CH105.includes("const bottomTab = ref<'task' | 'curio'>('task')")
    && CH105.includes('const curioMounted = ref(false)')
    && CH105.includes('<CuriosityPanel v-if="curioMounted" />')
    && CH105.includes("if (name === 'curiosity') { bottomTab.value = 'curio'; curioMounted.value = true }")
    && !CH105.includes('curioCollapsed') && !CH105.includes('curio-teaser');
});
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
check('R104-1 ★ 分类 CRUD 拆分不变量：实现随迁 + 宿主解构绑定 + 宿主零重复实现 + 层级工具由宿主注入（唯一实现）', () => {
  return CC104.includes('export function useCategoryCrud(')
    && CC104.includes('function confirmCatModal()') && CC104.includes('async function deleteCategory(cat: Category)')
    && CC104.includes('async function mergeDupCats()')
    && CC104.includes('pyDepthOf(parent) + 2 > MAX_CAT_LEVEL')
    && WSP104.includes('useCategoryCrud({')
    && WSP104.includes('const { normalizeCatOrders, catModal, openCreateCat, catRenId, startCatRename, commitCatRename, catNameDup, confirmCatModal, deleteCategory, toggleCatPin, mergeDupCats } = useCategoryCrud({')
    && !WSP104.includes('async function deleteCategory(cat: Category)') && !WSP104.includes('async function mergeDupCats()')
    && WSP104.includes('function pyDepthOf(c: Category): number {');
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
check('R102-1（R162 重指）整理动作域拆分不变量：四子域实现在 composable + 宿主解构绑定 + 宿主零重复实现（挂载域随挂载退役）', () => {
  return BAT102.includes('export function useWorkspaceBatch(')
    && BAT102.includes('function toggleBatchMode()') && BAT102.includes('async function batchDelete()')
    && BAT102.includes('function confirmBatchMove()') && BAT102.includes('function confirmMoveOne()')
    && !BAT102.includes('toggleMountTask') && !BAT102.includes('mountedResourceIds')
    && WSP102.includes('} = useWorkspaceBatch({ d, persist: () => store.persist(), workspaceId, wsCats, allResources, sortedResources, openResourceLink, treeCatOptions })')
    && WSP102.includes('moveOneTarget,')
    && !WSP102.includes('function toggleBatchMode()') && !WSP102.includes('async function batchDelete()')
    && !WSP102.includes('function confirmBatchMove()');
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
    && WSP101.includes('const { drillOpen, drillMode, openDrill, drillCatRows, drillNative, drillMirror, drillRecent } = useCurationDrill({')
    && WSP101.includes('function onDrillJumpCat(id: string) {') && WSP101.includes('function onDrillOpenCard(id: string) {') && WSP101.includes('function onDrillLocate(id: string) {')
    && !WSP101.includes('const drillCatRows = computed');
});

console.log('【第一百轮 · V2.69.0：Workspace.vue 纯拆分第一批（导入域 → useWorkspaceImport）】');
/** R100：Workspace.vue 3583 行的技术债开始偿还——第一批拆出导入三链路（数据包/书签/本地文件，
 *  ~220 行）为独立 composable，实现原位迁出、零行为变更。拆分约定：实现随迁（composable 内实现），
 *  绑定留宿主（解构保持原标识符，模板与断言入口面不变），断言按域归位（R100 重指 13 处）。
 *  本断言守拆分不变量：实现在 composable、宿主有绑定、宿主无重复实现。 */
check('R100-1 ★ 导入域拆分不变量：三链路实现在 composable + 宿主经 useWorkspaceImport 解构绑定 + 宿主零重复实现', () => {
  return IMP100.includes('export function useWorkspaceImport(')
    && IMP100.includes('function handleBoardImport(') && IMP100.includes('function parseBookmarksHtml(')
    && IMP100.includes('async function handleFileImport(') && IMP100.includes('function confirmBookmarkImport(')
    && WSP100.includes('useWorkspaceImport({ d, workspaceId, newCardCatId, persist: () => store.persist() })')
    && WSP100.includes('handleBoardImport, handleBookmarkImport, confirmBookmarkImport, toggleAllBk,')
    && !WSP100.includes('function parseBookmarksHtml') && !WSP100.includes('function ensureBookmarkCategory')
    && !WSP100.includes('async function handleFileImport(');
});

console.log('【第九十九轮 · V2.68.0：方向台组四件（M6 + M8 + D-D + D-E）】');
/** R99：P2 方向台组四条（三台面组收尾）。M6 网格顶对齐（展开不撑破网格）；M8 主航线筛选与项目
 *  总览共用 ovFilter（v-model 跨组件，一处切换两处生效，门控同 D-B）；D-D 页头主线状态摘要；
 *  D-E 跨区拖拽自动切换 pinned（连同 dragover 跨区放行——不改那条 drop 永远触发不了）。
 *  零数据模型改动、零迁移。 */
check('R99-1/R121 M6 主航线 3 列网格顶对齐：goals-grid align-items:start——「更多 N」展开只长自己这张卡', () => {
  return LP99.includes('.goals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-items: start; }');
});
check('R99-2 M8 主航线筛选共用 ovFilter ★R177 重指带备案：select 改分段组常驻（原型 lh-filter-group，M8 门控退役）、宿主 tools-gate=true；ovFilter 单一来源与空态双文案不变', () => {
  return LP99.includes("ovFilter?: 'all' | 'active' | 'stalled' | 'done'") && LP99.includes('toolsGate?: boolean') && LP99.includes('selectedId?: string')
    && LP99.includes("(e: 'update:ovFilter', v: 'all' | 'active' | 'stalled' | 'done')")
    && LP99.includes("if (f === 'stalled') return !!st?.stall")
    && LP99.includes("if (f === 'done') return !!st?.finished")
    && LP99.includes('return !st?.finished && !st?.stall // active')
    && LP99.includes('class="lh-filter-group"')
    && LP99.includes('无符合当前筛选的项目')
    && LP99.includes('function rawVisibleCount(dirIdx: number): number {')
    && CS99.includes('<LighthousePanel v-model:ov-filter="ovFilter" :tools-gate="true" :selected-id="selectedProjectId" @select-project="onSelectProject" />');
});
check('R99-3 D-D 方向台页头主线状态摘要 ★R177 重指带备案：对齐原型 cph-summary-badge「战略目标 N · 推进项目 N · 🚀 主攻 N · ⚠ 停滞 N」（粗值；🚀 图标语义按 R139 契约），projState 预计算消费不变', () => {
  return CS99.includes('战略目标 <b>{{ d.compass.directions.length }}</b> · 推进项目 <b>{{ visibleProjects.length }}</b> · 🚀 主攻 <b>{{ focusCount }}</b> · ⚠ 停滞 <b>{{ stalledCount }}</b>')
    && CS99.includes('const focusCount = computed(() => visibleProjects.value.filter(p => p.isFocused).length)')
    && CS99.includes('const stalledCount = computed(() => visibleProjects.value.filter(p => projState.value.get(p.id)?.stall).length)')
    && CS99.includes('class="mainline-summary"');
});
check('R99-4/R121 置顶能力收敛右键菜单（左栏退役）：togglePin 落库 + 上移/下移 moveProject + 旧左栏拖拽零残留', () => {
  const l = read('/newtab/components/compass/LighthousePanel.vue');
  const pc = read('/newtab/views/ProjectCuration.vue');
  return l.includes('function togglePin') && l.includes('function moveProject')
    && !pc.includes('dragProjId') && !pc.includes('跨区移动请先用 📌 置顶/取消置顶');
});

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
check('R108-2 共享导入弹窗：双模式（goal/pyramid）+ hasThesis 决定 H1 采用 + 实时解析预览 + 节点双入口绘制', () => {
  return ITM108.includes("mode: 'goal' | 'pyramid'")
    && ITM108.includes('parseGoalTemplate(src.value)')
    && ITM108.includes('parsePyramidTemplate(src.value)')
    && ITM108.includes('🔗 关联资源卡') && ITM108.includes('➕ 新建卡片')
    && ITM108.includes('hasThesis')

});
check('R108-3 ★ goal 写入链：任务双挂（projectId+metricId+taskIds 回写）+ 同名跳过幂等 + 单次持久化', () => {
  return CT108.includes('function confirmGoalImport(payload: { goal?: GoalParseResult })')
    && CT108.includes("met = { id: uid('met'), title: m.name, taskIds: [] }")
    && CT108.includes('met.taskIds.push(task.id)')
    && CT108.includes('d.value.tasks.some(x => !x.deletedAt && x.projectId === proj!.id && x.metricId === met!.id && x.title === t.name)')
    && CT108.includes('openGoalImport(dir)');
});
check('R108-4 ★ pyramid 写入链：论点卡+setThesis（本台未设时）+ 分类同父同名复用 + 每节点同名台内卡 + 200 节点上限 + 完成切金字塔视图', () => {
  return WSP108.includes('function confirmPyramidImport(payload: { pyramid?: PyramidParseResult })')
    && WSP108.includes('setThesis(d.value, workspaceId.value, card.id)')
    && WSP108.includes('const found = d.value.categories.find(c => c.workspaceId === workspaceId.value && !c.deletedAt && (c.parentId || undefined) === parentId && c.name === name') // R109 重指：同父同名复用排除软删分类
    && WSP108.includes('if (nodeTotal > 200) { showToast(\'⚠ 单次导入建议不超过 200 个节点——请分批导入\'); return }')
    && WSP108.includes("pyramidImportOpen.value = false") && WSP108.includes("setViewMode('pyramid')")
    // R113-N4：入口从 ⚙ 溢出菜单提到一级工具条，文案缩短为「📋 导入模板」
    && WSP108.includes('📋 导入模板') && WSP108.includes('@click="pyramidImportOpen = true">📋 导入模板</button>');
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
    && ITM109.includes('📖 AI 整理规则');
});
check('R109-2 ★ F13 资源台/策展台单一滚动域：顶部三模块移入 ws-content + 工具条吸顶', () => {
  return WSP109.includes('.ws-content { flex: 1; min-width: 0; padding: 20px 36px 90px; overflow-y: auto; }')
    && WSP109.includes('class="ws-columns">') && WSP109.includes('.ws-columns { display: flex; align-items: flex-start; }')
    && WSP109.includes('.ws-toolbar { position: sticky; top: 0; z-index: 5;')
    && WSP109.indexOf('class="ws-id-head"') > WSP109.indexOf('class="ws-content"');
});
check('R109-3 F14 页头单图标 + 指标卡两行重设计：台名剥离图标前缀 + 纵向布局 + hover 抬升', () => {
  return WSP109.includes("wsDisplayNameOf(workspace)")
    && WSP109.includes("align-items: flex-start; gap: 3px; }")
    && WSP109.includes('.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px;')
    && WSP109.includes('.metric-card:hover { border-color: var(--accent); transform: translateY(-1px);')
    && WSP109.includes('.mc-value { font-size: 20px;');
});
check('R109-4 ★ F12-a 资源台全景 workspaceId 收紧：分类视图/计数补 ws 过滤（策展台卡不得混入；R131-C3 计数改 ws|cat 复合键 bucket，收紧语义由键承载）+ 树头措辞修正', () => {
  return GS109.includes('return gResLive.value.filter(r => r.workspaceId === panSelWs.value && r.categoryId === panSelCat.value)')
    && GS109.includes("cat.workspaceId + '|' + cat.id")
    && GS109.includes('全景 · 资源台 · {{ panTotalCats }} 分类');
});
check('R109-5 ★ F12-b 分类软删：Category.deletedAt + 删除分类/合并重复/删除策展台三链路统一软删 + 回收站分类分区（恢复=清 deletedAt）', () => {
  return read('/shared/models/index.ts').includes('deletedAt?: number')
    && WSP109.includes('deleteDeck(d.value, workspaceId.value)') && read('/shared/utils/compassCrud.ts').includes('for (const c of d.categories) if (c.workspaceId === wsId && !c.deletedAt) { c.deletedAt = now; catIds.push(c.id) }')
    && WSP109.includes('const wsCats = computed(() => d.value.categories.filter(c => c.workspaceId === workspaceId.value && !c.deletedAt))')
    && GS109.includes('!c.parentId && !c.deletedAt')
    && RB109.includes("const tab = ref<'res' | 'task' | 'curio' | 'cat'>('res')")
    && RB109.includes('function restoreCat(c: { id: ID; deletedAt?: number })')
    && RB109.includes('分类分区');
});


// ============== 第 111 轮 · V2.79.0：调度画像周报（04-58 方向③）——引擎/全屏浮层/页头入口/全数字下钻 ==============
console.log('【第 111 轮 · V2.79.0：调度画像周报】');
check('R111-1（R172-T9 重指带备案）周报引擎并档：`weeklyReport.ts` 退役，唯一留存能力 `weekWindow`（周一锚定 + 按日期分量减一周、不按毫秒减）并入 `shared/utils/reviewReport.ts`；四段式装配链（buildWeeklyReport / conversionRate）随组件退役删除', () => { const fsx = require('fs'); const gone = !fsx.existsSync(path.resolve(base, 'shared/utils/weeklyReport.ts')); const rr = read('/shared/utils/reviewReport.ts'); return gone && rr.includes('export function weekWindow') && rr.includes('周一锚定') && !rr.includes('buildWeeklyReport') && !rr.includes('conversionRate') && !rr.includes('fetch(') && !rr.includes('XMLHttpRequest'); });
check('R111-2（R172-T9 重指带备案）复盘零写入红线：`reviewReport.ts` 与复盘段 `ReviewPanel.vue` 均零 storage 写、且复盘段不碰 store（数据全由宿主以 prop 传入）；AI 采纳写库随 T11 报告弹框落地时另补该场景断言', () => { const rr = read('/shared/utils/reviewReport.ts'); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); return !rr.includes('saveData') && !rr.includes('localStorage') && !rr.includes('.persist(') && !rp.includes('saveData') && !rp.includes('store.persist') && !rp.includes('useAppStore'); });
check('R111-3（R172-T9 重指带备案）周报全屏浮层退役：调度画像周报组件文件已不存在；复盘能力改由仪表盘「复盘段」承接（四范围切换 + 节奏曲线粒度自适应 + KPI/条形/规则三类下钻 + 两栏网格）', () => { const fsx = require('fs'); const gone = !fsx.existsSync(path.resolve(base, 'newtab/components/WeeklyReportOverlay.vue')); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); const css = fsx.readFileSync(path.resolve(base, 'newtab/components/dashboard/dashboard.css'), 'utf8'); return gone && rp.includes('周复盘') && rp.includes('月复盘') && rp.includes('自定义区间') && rp.includes('项目复盘') && rp.includes('dz-rev-grid') && rp.includes('trendPts') && css.includes('.dz-rev-grid { display: grid; grid-template-columns: 1fr 1fr;'); });
check('R111-4（R172-T9 反转）调度台入口整合：CompassHome **不含** `📊 周报` / `wrOpen` / `onWrDrill` / 周报浮层组件引用；**含** `📈 复盘` 且点击执行 `router.push(\'/settings?page=dashboard\')`', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('📊 周报') && !h.includes('wrOpen') && !h.includes('onWrDrill') && !h.includes('wr-overlay') && h.includes('📈 复盘') && h.includes("router.push('/settings?page=dashboard')") && h.includes("function openReview"); });
check('R111-5（R172-T9 重指带备案）四大数字下钻能力等价迁入仪表盘：四类记录入口（入台/移出/调出/写入记录）+ 日详情「查看全部记录 ›」按日预筛 + 复盘段 KPI/方向/规则下钻；CompassHome 的旧下钻链（openRec/gotoAnchor）零残留', () => { const h = read('/newtab/views/CompassHome.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); return !h.includes("openRec('in')") && !h.includes("openRec('called')") && gs.includes("openLog('called')") && gs.includes('onDashOpenLog') && rp.includes('DrillCardList') && rp.includes('tasksOfDirection(') && rp.includes('ruleHit'); });
check('R111-6（R172-T9 重指带备案）卡片行下钻定位的单一实现：TOP5 / 四段式下钻随周报浮层退役 —— 卡片级"单击定位 / 双击开链"收敛到 `DrillCardList.vue`（资源卡带 link 时 `openExternalLink`，否则 `locateTargetOf`），定位落位仍由 `locate.ts` 统一给出 `/workspace/<wsId>?hl=<cardId>`', () => { const c = read('/newtab/components/dashboard/DrillCardList.vue'); const u = read('/shared/utils/locate.ts'); return c.includes('toOpenableUrl(card.linkType, card.link)') && c.includes('openExternalLink(url)') && c.includes('locateTargetOf(store.data!, kind, r.id)') && u.includes('hl: id'); });
check('R111-7（R172-T9 重指带备案）环比真实聚合：`reviewReport.ts` 走等长窗口环比（`prevWindow` 按 `win.days` 回推）+ `buildReview` 同期算本期与前一期聚合（杜绝"部分月 vs 整月"假下跌）', () => { const rr = read('/shared/utils/reviewReport.ts'); return rr.includes('export function prevWindow(') && rr.includes('const s = addDays(e, -(win.days - 1))') && rr.includes('const prevAgg = aggregateRange(stats, prev.s, prev.e)') && rr.includes('delta: { acts: pct(agg.acts, prevAgg.acts), W: pct(agg.W, prevAgg.W) }'); });
check('R111-8（R172-T9/T11 重指带备案）手册同步：复盘与热力图章节（入口/三段/下钻/纯读取）——原「调度画像周报」章随浮层退役，判据改认新居所', () => { const m = read('/newtab/manual-data.ts'); return m.includes('复盘与热力图（知源仪表盘）') /* R172-T9/T11 重指带备案：周报浮层退役，mid-8 整章重写为「复盘与热力图」 */ && m.includes('周 / 月 / 自定义区间 / 项目') /* 同上：窗口切换现为四个范围 */; });

// ============== 第 110 轮 · V2.79.0（并入 111）：资源生命周期 + BUG×2 + 金字塔全屏 ==============
console.log('【第 110 轮 · V2.79.0：LC + BUG-1/BUG-2 + FS】');
// ---- BUG-1：资源台镜像脏数据 ----
check('R110-B1-1 ★ 镜像净化函数：scrubHubMirrorMarkers（幂等剥离 __mirrorProjId/__mirrorCat + 清除 targetWsId 指向资源台的投射记录）', () => { const h = read('/shared/storage/hub.ts'); return h.includes('export function scrubHubMirrorMarkers(d: AppData): number') && h.includes("'__mirrorProjId' in r") && h.includes("'__mirrorCat' in r") && h.includes('p.targetWsId !== CURATION_WS_ID'); });
check('R110-B1-2 ★ 红线兜底：curationMetrics 对 hub 台镜像计数恒 0（不再依赖「数据一定干净」）', () => { const h = read('/shared/storage/hub.ts'); return h.includes('const isHub = isHubWs(d.workspaces.find(w => w.id === wsId))') && h.includes('if (isMirrorView(r) && !isHub) mirrored++') && h.includes('if (!isMirrorView(r) || isHub) native++'); });
check('R110-B1-3（R122 重指）★ 启动期接线保留；hub 提示格退役（分类数转入页头描述，无「待清理」分支）', () => { const r = read('/shared/storage/repository.ts'); const w = read('/newtab/views/Workspace.vue'); return r.includes("import { pruneDanglingProjections, scrubHubMirrorMarkers } from './hub'") && r.includes('try { scrubHubMirrorMarkers(data) } catch { /* noop */ }') && !w.includes('hubCountHint') && w.includes('{{ categories.length }} 个分类') && !w.includes('待清理'); });
// ---- BUG-2：附件明细跳卡 / 孤儿清理 ----
check('R110-B2-1 ★ 附件行三态：cardExists 判定 + 本体缺失（IndexedDB 只读索引）+ 孤儿本体清单', () => { const o = read('/newtab/components/CurationDrillDrawer.vue'); return o.includes('cardExists: (cardId: string) => boolean') && o.includes('referencedAssetIds: string[]') && o.includes('getAllAssetIds') && o.includes("type AssetRowState = 'ok' | 'missing' | 'orphan'") && o.includes('orphanAssetIds'); });
check('R110-B2-2 ★ 点击行 = 定位来源卡：本台高亮 / 跨台 /workspace/<id>?hl=<cardId>', () => { const o = read('/newtab/components/CurationDrillDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); return o.includes("emit('locate-asset', row.cardId)") && w.includes('function onDrillLocateAsset') && w.includes('query: { hl: cardId }'); });
check('R110-B2-3 ★ 清理双入口（单条 🗑 + 顶部批量条）均二次确认，且复用 REQ-048 cleanupOrphanAssets 语义', () => { const o = read('/newtab/components/CurationDrillDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); return o.includes("emit('cleanup-asset'") && o.includes("emit('cleanup-orphans')") && o.includes('useConfirm') && o.includes('dd-orphan-bar') && w.includes('function onDrillCleanupAsset') && w.includes('cleanupOrphanAssets(new Set(referencedAssetIds.value))') && w.includes('deleteAsset(row.assetId)'); });
check('R110-B2-4 ★ 清理口径含回收站软删卡（软删可恢复 ⇒ 其附件必须保留）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('const collect = (cards: { assets?: AssetMeta[] }[] | undefined) =>') && w.includes('collect(d.value.resources)') && w.includes('collect(d.value.tasks)') && w.includes('collect(d.value.curiosities)') && w.includes('referencedAssetIds = computed'); });
// ---- LC：资源生命周期 ----
check('R110-LC-1 生命周期引擎（R117-E 修订：阈值由全局写死改为 per-card 自定义，出厂默认仍是 30/90 = 3:1）：三态纯计算 + 新卡 14 天宽限 + 进行中任务恒活跃', () => { const l = read('/shared/utils/lifecycle.ts'); return l.includes('export function lifecycleState') && l.includes('export const DEFAULT_COOLING_DAYS = 30') && l.includes('export const ARCHIVE_RATIO = 3') && l.includes('export const DAY_MS = 86400_000') && l.includes('export const COOLING_MS = DEFAULT_COOLING_DAYS * DAY_MS') && l.includes('export const ARCHIVE_MS = COOLING_MS * ARCHIVE_RATIO') && l.includes('export const NEW_GRACE_MS = 14 * DAY_MS') && l.includes('export function coolingMsOf(card: LifecycleInput)') && l.includes("card.kind === 'task' && card.status === 'doing'"); });
check('R110-LC-2（R113-N2 重指：内嵌化 + 实体切换）生命周期面板：甜甜圈三态 + 数字可点击切换列表 + 归档/忽略30d/恢复 + 点击条目定位 + 顶部实体切换', () => { const v = read('/newtab/components/LifecyclePanel.vue'); return v.includes('lc-donut') && v.includes("setFilter('archived')") && v.includes("emit('archive', e.card.id)") && v.includes("emit('snooze', e.card.id)") && v.includes("emit('reactivate', e.card.id)") && v.includes("emit('locate', e.card.id, e.card.kind)") && v.includes('lc-kind-tab') && v.includes('lc-kind-badge') && !v.includes('<Drawer'); });
check('R110-LC-3 ★（R113-N2 重指：宿主=GlobalSettings）面板被动化：面板只发意图、不改 props；设置页对真实卡对象落库 + persist（修复「传副本 ⇒ 归档落空」）', () => { const v = read('/newtab/components/LifecyclePanel.vue'); const g = read('/newtab/views/GlobalSettings.vue'); return v.includes('archive: [id: string]') && !v.includes('e.card.lifecycleArchived = true') && g.includes('function lcFind(id: string)') && g.includes('c.lifecycleArchived = true') && g.includes('store.persist()') && g.includes('reactivateCard(c)') && g.includes('snoozeCard(c)'); });
check('R110-LC-4（R113-N2 重指：入口收敛）生命周期唯一入口 = 设置→总览·资源生命周期（navGroups 位于仪表盘与全景之间）；三宿主就地面板/⏳ 已移除；归档提示条跳设置页', () => { const g = read('/newtab/views/GlobalSettings.vue'); const w = read('/newtab/views/Workspace.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const tp = read('/newtab/components/compass/TaskManagerPanel.vue'); const gi = g.indexOf("key: 'dashboard'"), gl = g.indexOf("key: 'lifecycle'"), gp = g.indexOf("key: 'panorama'"); return gi >= 0 && gi < gl && gl < gp && g.includes('<LifecyclePanel kind="all" :cards="lcCards"') && !w.includes('<LifecyclePanel') && !cp.includes('<LifecyclePanel') && !tp.includes('<LifecyclePanel') && w.includes('/settings?page=lifecycle') && cp.includes('/settings?page=lifecycle') && tp.includes('/settings?page=lifecycle'); });
check('R110-LC-5 ★ T3 归档集成：默认视图排除归档卡 + 三处降级提示 + 全局搜索排除归档并按同口径报数', () => { const w = read('/newtab/views/Workspace.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const tp = read('/newtab/components/compass/TaskManagerPanel.vue'); const g = read('/newtab/components/GlobalPopups.vue'); return w.includes('.filter(r => !r.lifecycleArchived)') && w.includes('ws-archived-hint') && cp.includes('!c.lifecycleArchived') && cp.includes('cz-archived-hint') && tp.includes('!t.lifecycleArchived') && tp.includes('tm-archived-hint') && g.includes('allResults.value.filter(r => !r.archived)') && g.includes('archivedMatchCount') && g.includes('gp-archived-hint') && g.includes('function hitResult('); });
check('R110-LC-6 零迁移：lifecycleArchived 为 CardBase 可选字段（三卡共享，老数据无需迁移）', () => { const m = read('/shared/models/index.ts'); return m.includes('/** R110-LC：生命周期归档标记（可选字段，零迁移）') && m.includes('lifecycleArchived?: boolean'); });
// ---- FS：金字塔全屏 ----
check('R110-FS-1 ★ 路线 A：元素级 requestFullscreen 真全屏 + 浏览器原生 ESC（fullscreenchange 同步状态）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('await el.requestFullscreen()') && w.includes("document.addEventListener('fullscreenchange', onPyFsChange)") && w.includes('document.exitFullscreen()') && w.includes('const pyFsFallback = ref(false)'); });
check('R110-FS-2 ★ 路线 B 自动降级：requestFullscreen 缺失/被拒 → fixed 覆盖层 + 自行监听 ESC + 显式「⛶ 退出全屏」双保险', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('pyFsFallback.value = true') && w.includes('py-fs-fallback { position: fixed; inset: 0;') && w.includes("e.key === 'Escape' && pyFsFallback.value") && w.includes('⛶ 退出全屏') && w.includes(':fullscreen { background: var(--bg);'); });

// ============== 第 112 轮 · 性能专项（04-59）第一批：渲染规模治理 + 热路径削减 ==============
