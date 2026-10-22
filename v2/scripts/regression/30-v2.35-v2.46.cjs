/**
 * R174-1 分片 · 30-v2.35-v2.46：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, srcFileEntries, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

console.log('【第六十五轮 · V2.35.0：资源台对齐旧工作台 + 金字塔 2~7 列树状自适应 + 节点双入口 + 导入导出语义修正】');
check('R65-1（V3.9.8 重指）工具能力分宿主保留：策展画布留搜索/新建论证卡/导入/分享；资源池留搜索/列表·网格/四档筛选/批量/新建/本地导入。旧卡片·列表·看板·金字塔四视图值域退役', () => {
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const hostCode = codeOnly(host);
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const dc = read('/newtab/components/compass/DeckControls.vue');
  return !hostCode.includes("viewMode = ref<'card'|'list'|'kanban'|'pyramid'>('card')")
    && !hostCode.includes('class="view-tabs"')
    && host.includes('class="ws-toolbar"') && host.includes('toolbar-search')
    && host.includes('＋ 新建分支') && host.includes('导入数据包') && host.includes('分享成果')
    && pool.includes('<DeckControls panel="pool"') && pool.includes('poolViews')
    && pool.includes("id: 'card'") && pool.includes("id: 'list'")
    && pool.includes('poolFilters') && pool.includes("id: 'all'") && pool.includes("id: 'untagged'")
    && pool.includes("id: 'called'") && pool.includes("id: 'never'")
    && pool.includes('toggleBatch')
    && pool.includes("'＋ 新建卡'") && pool.includes('导入本地文件')
    && dc.includes('class="dk-search"') && dc.includes('class="dk-btn dk-view"')
    && dc.includes('class="dk-btn dk-batch"') && dc.includes('class="dk-btn dk-new"');
});
check('R65-2（V3.9.8 重指）资源详情仍是共享抽屉：Workspace 渲染 ResourceEditForm + Drawer，点击分流在 useResourceDrawer（openResource / openMirrorDetail / 260ms），双击开链仍由 onCardDblClick 收口', () => {
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const dr = read('/newtab/composables/useResourceDrawer.ts');
  return host.includes('ResourceEditForm') && host.includes('<Drawer :open="drawerOpen"')
    && host.includes('useResourceDrawer({') && host.includes('@open-resource="onCardClick"')
    && dr.includes('function onCardClick(r: ResourceCard)')
    && dr.includes('function onCardDblClick(r: ResourceCard)')
    && dr.includes('openResource(r)') && dr.includes('openMirrorDetail(r)')
    && dr.includes('}, 260)');
});
check('R65-3（V3.9.8 重指）资源池批量栏：全选 / 反选 / 打标签 / 批量删除在位；旧策展台 batch-bar 零命中。批量打开与投射到策展台由资源池承接，旧“移动到分类”入口退役', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const bar = read('/newtab/components/compass/DeckBatchBar.vue');
  return !host.includes('class="batch-bar"') && !host.includes('batchOpen') && !host.includes('openBatchMove')
    && pool.includes('<DeckBatchBar v-if="batchMode"')
    && pool.includes('@select-all="selectAll"') && pool.includes('@invert="invertSel"')
    && pool.includes('@apply-tag="applyTagToSelected"') && pool.includes('@click="deleteSelected"')
    && pool.includes('@click="batchOpen"') && pool.includes('批量打开')
    && pool.includes('@click="openBatchMirror"') && pool.includes('投射到策展台')
    && !pool.includes('openBatchMove')
    && bar.includes("emit('select-all')") && bar.includes("emit('invert')")
    && bar.includes("emit('apply-tag', t)");
});
check('R65-4（R73 修订；R100 拆入 useWorkspaceImport；R2-⑧ 本地文件宿主迁「资源卡池」面板；★R4-Db 再重指带备案：书签链路的持有者从 Workspace 改为 useBookmarkImport——Workspace 那枚 bookmarkInput 是全站零 .click() 的 parked input（入口早收在设置页），本轮连它和它的文件夹勾选弹窗一并删除；makeHubResource 随建树死链退役（hub 是已废弃旧称，它又硬编码池 id），书签卡构造式改名 makeBookmarkCard 且不再指向池）导入链路一条口径：书签=useBookmarkImport 持有 bookmarkInput + handleBookmarkImport + parseBookmarksHtml 且构造式不落池 id，本地文件=PoolCardsPanel 持有 fileImportInput + handleFileImport 且 workspaceId 钉成池 id', () => { const bk = read('/newtab/composables/useBookmarkImport.ts'); const imp = read('/newtab/composables/useWorkspaceImport.ts'); const w = codeOnly(read('/newtab/views/Workspace.vue')); const pool = read('/newtab/components/compass/PoolCardsPanel.vue'); return bk.includes('bookmarkInput') && bk.includes('handleBookmarkImport') && bk.includes('parseBookmarksHtml') && bk.includes('function makeBookmarkCard') && imp.includes('handleFileImport') && !imp.includes('bookmarkInput') && !w.includes('bookmarkInput') && !w.includes('handleBookmarkImport') && !codeOnly(w).includes('fileImportInput') && pool.includes('fileImportInput') && pool.includes('handleFileImport') && pool.includes('workspaceId: computed(() => CURATION_WS_ID)'); });
check('R65-5/R66（V3.9.8 随迁备案）金字塔居中树布局：旧 CSS Grid 的 pyLayout/placeCat 随四视图退役；现役画布以 .mind-stage 居中、.mind-children 横排子组、每个父分支纵向居中，树状布局则整体向右展开', () => {
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const c = read('/newtab/components/curation/curation.css');
  return !host.includes('pyLayout') && !host.includes('placeCat')
    && c.includes('.mind-stage { width: max-content; min-width: 100%; display: flex; justify-content: center;')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-branch { display: flex; flex-direction: column; align-items: center; }')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children { display: flex; align-items: flex-start; justify-content: center;')
    && c.includes('.mindmap-canvas[data-layout="tree"] .mind-stage { justify-content: flex-start; }')
    && c.includes('.mindmap-canvas[data-layout="tree"] .mind-branch { display: flex; align-items: flex-start;');
});
check('R65-6（V3.9.8 重指）金字塔严格树状：递归组件按根序与子序先序展开（同父节点紧邻），旧 dfsOrder 手工排序退役', () => {
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  const map = read('/newtab/components/curation/CurationMindMap.vue');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const idx = read('/shared/utils/catIndex.ts');
  return !codeOnly(host).includes('const dfsOrder = new Map<string, number>()')
    && hook.includes('const rootCats = computed(() => catIdx.value.roots)')
    && hook.includes('return catIdx.value.childrenOf.get(catId) || []')
    && idx.includes('roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))')
    && idx.includes('for (const arr of childrenOf.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))')
    && map.includes('<CurationMindNode v-for="node in roots"')
    && node.includes('<CurationMindNode v-for="child in children()"');
});
check('R65-7 节点双入口（V3.9.8 重指：画布节点保留“关联资源/子分支”，旧 py-node-foot 四视图退役）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const m = read('/newtab/components/curation/CurationMindNode.vue');
  return w.includes('openLinkCards') && w.includes('confirmLinkCards')
    && m.includes('关联资源') && m.includes('子分支') && m.includes('@link-resource')
    && !host.includes('py-node-foot');
});
check('R65-8（R100 重指：实现拆入 useWorkspaceImport；R169-T1 再重指：资源段合并前先钳 updatedAt）策展台导入=策展台数据包 JSON：version 校验 + 按 ID 并集合并本台段 + 投射清单并入', () => { const imp = read('/newtab/composables/useWorkspaceImport.ts'); return imp.includes('handleBoardImport') && imp.includes("startsWith('2')") && imp.includes('mergeById(d.value.resources, clampUpdatedAt(d.value.resources, incRes)') && imp.includes('curationProjections = mergeById'); });
check('R65-9 ★R4-Da 退役重指带备案：原守「全景收窄为资源台全景（panHubWss 过滤 isHubWs，策展台不进全景）+ 导航/标题改名（label: 资源台全景 / 页标题 🗺 资源台全景），且旧措辞 label: 工作台全景 不得回流」——V3.7.0 资源台退役后该整页删除，"只呈现资源台"这一收敛语义不再靠过滤函数、而是由数据层直接承担：池卡唯一管理面=调度台资源卡池面板（恒以 workspaceId===CURATION_WS_ID 取数，连"选台"这一步都不存在），策展台管理面=Workspace.vue。判据＝全景侧实现与两种措辞（新旧都算）codeOnly 零命中 + 去向两处真实锚点在位（池过滤 + 隐藏池 id 定义）', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const pcp = read('/newtab/components/compass/PoolCardsPanel.vue');
  const mod = read('/shared/models/index.ts');
  const retired = ['const panHubWss = computed', "label: '资源台全景'", "label: '工作台全景'", '🗺 资源台全景', '🗺 工作台全景', 'gs-pan-ws'];
  return retired.every(k => !g.includes(k))
    && !g.includes('(store.data?.workspaces || []).filter(w => isHubWs(w) && !w.archived)')
    && pcp.includes('.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)')
    && pcp.includes("import { CURATION_WS_ID, type AppData, type ResourceCard } from '@/shared/models'")
    && mod.includes("export const CURATION_WS_ID = 'zy-curation'");
});
// R179-MIGRATED R65-10
// V3.7.0（R179）随迁重写：资源台退役后应用内数字键顺延——1=调度台 / 2=方向台 / 3 起=各策展台（无资源台号位）
check('R65-10 快捷键口径（V3.7.0 重指）：open-resource 退役 + 应用内 Alt+1 调度台 / Alt+2 方向台 / Alt+3 起各策展台', () => { const m = read('/manifest.ts'); const a = read('/newtab/App.vue'); return !m.includes("'open-resource'") && a.includes("if (n === 1) { navigate('/'); return }") && a.includes('if (n === 2) { openCompass(); return }') && a.includes('const ws = store.workspaces[n - 3]'); });
check('R65-11（R74 重写 · ★R3-B1 随宿主改靶）KeepAlive 切台缓存：主视图 include 含方向台一级（CompassTreeView，原 CompassShell 随退役换名）+ defineOptions 实例名 + 跨台 :id 复位局部状态', () => {
  const a = read('/newtab/App.vue');
  const w = read('/newtab/views/Workspace.vue');
  const h = read('/newtab/views/CompassHome.vue');
  const t = read('/newtab/views/CompassTree.vue');
  const inc = (a.match(/keep-alive include="([^"]+)"/) || [, ''])[1].split(',')
  return inc.includes('CompassHomeView') && inc.includes('WorkspaceView') && inc.includes('CompassTreeView') && !inc.includes('CompassShell') && t.includes("defineOptions({ name: 'CompassTreeView' })") && w.includes("defineOptions({ name: 'WorkspaceView' })") && h.includes("defineOptions({ name: 'CompassHomeView' })") && w.includes('watch(() => route.params.id');
});
check('R65-12（★M1/V3.8.28 翻转带备案）方向状态单行指标条：副行收 tooltip 的口径不变，末位读数由「琥珀警示」改中性 —— 本条守的三件事（单行 mb-row / key-value 分列 / 无 mb-head 表头）一字不动，只有"警示色"这一项翻转：原断言钉「末位读数带警示类」，M1 判定该染色把「还有多少没做完」读成催促（镜面不评价），故改钉「零警示类 + 读数仍有口径 tooltip」。翻转理由即 M1 验收：「指标条无红色计数/琥珀催促；每个读数可悬停看口径」', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('mb-row') && mb.includes('mb-k') && mb.includes('mb-v') && !mb.includes('st-warn') && mb.includes('尚未归位到方向') && !mb.includes('mb-head'); });

// ============== 第六十六轮：任务采集选区预填 + 项目调度瘦身 + 操作记录整合 + 全量导入导出 uiPrefs + 全景递归 + 金字塔居中树 + 品牌刷新 ==============
console.log('【第六十六轮 · V2.36.0：任务采集选区预填 + 金字塔居中树布局 + 品牌口径升级】');
check('R66-1 任务采集选区预填：openTaskCapture 接入选区链路（文本→内容/标题→名称/URL→链接字段，均可编辑）+ 保存写 link', () => { const c = read('/content/overlay-impl.ts'); return c.includes('R66-F1') && c.includes('resolveSelection()') && c.includes('clearSelCache()') && c.includes('__zy_tc_link__') && c.includes('（已填入选中文本，可编辑）') && c.includes('link: link || undefined'); });
check('R66-2（V3.9.8 随迁备案）金字塔直角连线：旧 SVG 路径字符串随 drawPyLinks 退役；现役以 CSS 伪元素生成横平竖直连接，画布本身是横向滚动域（overflow:auto + min-width:100%）', () => {
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const c = read('/newtab/components/curation/curation.css');
  return !host.includes('M ${a.x} ${a.bottom} L ${a.x} ${mid} L ${b.x} ${mid} L ${b.x} ${b.top}')
    && c.includes('.mindmap-canvas {') && c.includes('overflow: auto;')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children::before')
    && c.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children > .mind-branch::before');
});
check('R66-3（R156 解析改写）全量导出附 uiPrefs + 导入自动应用：exportAll 载入 UI 偏好并入包，导入侧落 data-theme（经 resolveTheme 解析 auto）/data-density', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('async function exportAll') && g.includes('loadUIPrefs') && g.includes('{ ...safeData, uiPrefs }') && g.includes("document.documentElement.setAttribute('data-theme', resolveTheme(ui.theme))") && g.includes("saveUIPrefs({ density: ui.density as 'compact' | 'cozy' })") && g.includes('界面偏好已应用'); });
check('R66-4 ★R4-Da 退役重指带备案：原守「资源台全景递归 N 级：panTree 的 toNode 递归 + flattenPanCats 扁平行渲染（折叠沿祖先链）+ row.depth * 14 缩进」——🗺 全景整页随资源台退役删除。四件事（多级递归 / 扁平序列 / 折叠沿祖先链 / 按层缩进）在两个存活管理面都还在，判据按它们点名：① 策展台分类树 useCatSidebar（sidebarCats 递归 pushTree depth+1 + seenSide 防环 = 扁平序列；selectSidebarCat 沿 parentId 上行走链展开祖先；卡片/列表视图按 g.depth * 16 缩进）② 设置页标签树按 tagDepth 缩进；panTree/toNode/flattenPanCats/panCollapsed 在 GS 按 codeOnly 零命中', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const ws = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const drill = read('/newtab/components/CurationDrillDrawer.vue');
  const retired = ['function flattenPanCats', '.map(toNode)', 'row.depth * 14', 'const panTree = computed', 'panCollapsed', 'togglePanCollapse'];
  return retired.every(k => !g.includes(k))
    && !ws.includes('const sidebarCats = computed<SidebarCat[]>')
    && !ws.includes('const seenSide = new Set<string>()')
    && !ws.includes('collapsedCats.value.has(pid)')
    && node.includes('<CurationMindNode v-for="child in children()"')
    && hook.includes('const flattenedIds = computed<string[]>(() => {')
    && hook.includes('walk(c.id)')
    && drill.includes('paddingLeft: (8 + c.depth * 16)')
    && g.includes('paddingLeft: 8 + tagDepth(root.id) * 18');
});
check('R66-5 品牌刷新落点：启动动画/采集浮层页脚/搜索页脚/一封信全部换新 Slogan（旧「你不缺信息」清零）', () => { const h = read('/newtab/index.html'); const ov = read('/content/overlay-impl.ts'); const gp = read('/newtab/components/GlobalPopups.vue'); const lt = read('/newtab/letter-data.ts'); return h.includes('万千可调用，自有我方向') && ov.includes('知源调度台 · 万千可调用，自有我方向') && gp.includes('知源调度台 · 万千可调用，自有我方向') && lt.includes('万千可调用，自有我方向') && !lt.includes('你不缺信息') && lt.includes('lp-creed'); });
check('R66-6 一封信按新叙事重写：新病根开场→三个看见工作流→信任承诺→新 Slogan 收束（旧「我也焦虑」开场退役）', () => { const lt = read('/newtab/letter-data.ts'); return lt.includes('外部可能性持续增加') && lt.includes('今天的行动有来处') && lt.includes('策展成可以讲给别人听的成果') && lt.includes('伊里奇') && lt.includes('万千可调用，自有我方向') && !lt.includes('我也焦虑') && lt.includes('R66'); });
check('R66-7 应用内手册对齐新口径：quick-1 三项核心价值表 + 方向状态指标条口径 + 金字塔居中树口径（★R4-Df 重指带备案：原两条轮次号锚「R66 整合」「R67 重排」钉的是手册正文里两句带内部轮次号的改版说明——① 「右端即今日记录四格（R66 自页头迁入右对齐）」，那四格连同明细入口已在 R172-T9 整体迁到知源仪表盘，页头现在只剩 存储 chip / 同步 chip / 📈 复盘；② 「项目调度（两列，R67 重排）」，该模块 R2-② 已退役。轮次号写进用户手册本就是坏味道（读者不知道 R66 是什么），删掉它们不是放宽判据。改为钉当下真形状：指标条在页头、五格；两条旧措辞转负判据。其余四条锚点一字未动）', () => { const m = read('/newtab/manual-data.ts'); return m.includes('三项核心价值') && m.includes('<strong>调用</strong>贯穿三者') && m.includes('方向状态指标条（页头）') && m.includes('五格') && m.includes('R66 居中树布局') && m.includes('界面偏好段 uiPrefs') && !m.includes('R66 整合') && !m.includes('R67 重排'); });
check('R66-8 docs 双文档升版 V2.36.0：功能手册/白皮书新定位与新 Slogan 落位', () => { const d1 = fs.readFileSync(path.resolve(SCRIPTS_DIR, '../../docs/产品功能手册_V2.36.0.md'), 'utf8'); const d2 = fs.readFileSync(path.resolve(SCRIPTS_DIR, '../../docs/产品白皮书_V2.36.0_对外版.md'), 'utf8'); return d1.includes('个人调度中台') && d1.includes('万千可调用，自有我方向') && d1.includes('V2.36.0 结构变化速览') && d2.includes('你在浏览器里的个人调度中台') && d2.includes('万千可调用，自有我方向') && !d2.includes('你不缺信息，你缺一座控制中心'); });

// ============== 第六十七轮 · R67：推进项目全称 + 紫框重排 + 策展主题高亮 + 任务采集居中 + 全景数据源修复 + 模块直达快捷键 + 项目目录拖拽 ==============
console.log('【第六十七轮 · R67：方向状态全称 + 紫框重排 + 全景数据源修复 + 模块直达】');
check('R67-1（R120-TB1 修订）方向状态「推进项目」全称标签独立成格（mb-k，与战略目标对仗）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('<span class="mb-k">推进项目</span>') && !mb.includes('mb-k2">推进 '); });
check('R67-2 项目调度归属呈现', () => { const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return !h.includes('cur-crumb') && !h.includes('cur-progress') && pc.includes('pc-current') && pc.includes('class="pb-crumb"');  });
check('R67-3（R123 重指）论点入大横幅常亮强调（tb-badge 实底 + tb-btn），原 thesis-hl 指标卡退役', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('class="tb-badge"') && w.includes('.tb-badge {') && w.includes('.tb-btn {') && !w.includes('metric-card thesis-hl'); });
check('R67-4 任务采集弹窗改页面正中（openTaskCapture center，资源采集保持 corner）', () => { const c = read('/content/overlay-impl.ts'); return c.includes('R67-F2') && c.split("openOverlay('center', closeOverlay)").length === 4 && c.split("openOverlay('corner', closeOverlay)").length === 2; });
check('R67-5 新卡落位口径守护：三卡入库 unshift + marksort 置顶>星标>普通（新卡落置顶之后、普通卡最前）', () => { const cu = read('/newtab/stores/curiosity.ts'); const ms = read('/shared/utils/marksort.ts'); const ov = read('/content/overlay-impl.ts'); return cu.includes('curiosities.unshift') && cu.includes('tasks.unshift') && cu.includes('resources.unshift') && ms.includes('markRank') && ov.includes('tasks?.unshift'); });
check('R67-6 ★R4-Da 退役重指带备案：原守「全景数据源修复：panHubWss 改读原始 store.data.workspaces 过滤（当时 store.workspaces getter 排除资源台 ⇒ 全景恒空）+ gWsById 全景判定 + 默认选中资源台（const hubWs = panHubWss.value[0]）」——整页退役，但它修的病（数据源走带排除语义的 getter ⇒ 管理面恒空）在现管理面已被结构性避免，判据改认那三处真实锚点：① 池面板与调度台池 tab 都直读原始数组 store.data.resources 并按 workspaceId===CURATION_WS_ID 过滤（不经过任何排除资源台的 getter）② "默认选中资源台" 的现形=调度台底部三张卡默认 tab 就是资源卡池 ③ 池 id 常量仍是模型层唯一真源；panHubWss/gWsById/hubWs 在 GS 按 codeOnly 零命中', () => {
  const g = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const pcp = read('/newtab/components/compass/PoolCardsPanel.vue');
  const ch = read('/newtab/views/CompassHome.vue');
  const retired = ['const panHubWss = computed', 'function gWsById', 'const hubWs = panHubWss.value[0]', 'isHubWs(gWsById(panSelWs.value))', 'panSelWs'];
  return retired.every(k => !g.includes(k))
    && pcp.includes('(store.data?.resources || [])')
    && pcp.includes('.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)')
    && pcp.includes("const poolCards = computed(")
    && ch.includes('const previewResources = computed<ResourceCard[]>(')
    && ch.includes('const liveResources = computed<ResourceCard[]>(')
    && ch.includes("function goDeck(kind: 'task' | 'curiosity' | 'resource')")
    && read('/shared/models/index.ts').includes("export const CURATION_WS_ID = 'zy-curation'");
});
check('R67-7（R68/V3.9.1 重指）模块直达快捷键：goto-tasks / goto-curiosity 仍保留，落点由首页锚点改为独立查看全部二级页', () => { const m = read('/manifest.ts'); const b = read('/background/index.ts'); const a = read('/newtab/App.vue'); const h = read('/newtab/views/CompassHome.vue'); return m.includes("'goto-curiosity'") && m.includes("'goto-tasks'") && m.includes('直达好奇心培养模块') && m.includes('直达任务调度模块') && !m.includes('直达项目调度模块') && b.includes("case 'goto-curiosity':") && b.includes('zy-anchor=') && a.includes('zy-goto-anchor') && h.includes("if (name === 'curiosity') { void router.push('/deck/curiosity'); return }") && h.includes("if (name === 'task') { void router.push('/deck/task'); return }") && h.includes('id="zy-mod-tasks"') && h.includes('anchor-flash'); });
check('R67-8/R121 左栏宽高拖拽随左栏退役（startRailResize/rail-grip 全量零残留）', () => { const p = read('/newtab/views/ProjectCuration.vue'); return !p.includes('startRailResize') && !p.includes('rail-grip'); });
check('R67-9 手册口径跟进：直达快捷键 + 中心论点横幅 + 三卡手势（★R4-Df 重指带备案：三条锚点各自钉着一件已不存在的东西——① 「R67 重排」与「战略目标小字在上、项目名称大字在下」是退役模块「项目调度」的版面说明；② 「常亮高亮」指的是策展台辅助条的 🏛 策展主题格，该格自 R123 随主题退役（辅助条 5→3），论点改由大横幅在四档视图常驻承载。判据跟着换成横幅的实名，并把三句旧话转负判据不许回流；「直达好奇心培养模块」（manifest 现役命令）与「单击详情 / 双击打开链接」（三张卡统一手势）两条保留、只把手势那句改成手册现在的写法）', () => { const m = read('/newtab/manual-data.ts'); return m.includes('直达好奇心培养模块') && m.includes('大横幅在四档视图常驻') && m.includes('单击开右侧详情') && m.includes('双击打开链接') && !m.includes('R67 重排') && !m.includes('战略目标小字在上、项目名称大字在下') && !m.includes('常亮高亮'); });

// ============== 第六十八轮 · R68：搜索遗留实体过滤 + 深色按钮修复 + 快捷键体系改造 + 加载动画美化 + 切台/搜索性能 ==============
console.log('【第六十八轮 · R68：搜索口径修复 + 深色可见性 + 快捷键改造 + 性能】');
check('R68-1 搜索工作台分组口径对齐台签栏：两端均排除资源台本体实体（CURATION_WS_ID）+ 已归档', () => { const g = read('/newtab/components/GlobalPopups.vue'); const c = read('/content/overlay-impl.ts'); return g.includes('!w.archived && w.id !== CURATION_WS_ID') && g.includes('ws: all.workspaces.filter(w=>!w.archived && w.id !== CURATION_WS_ID).length') && c.includes("!w.archived && w.id !== CURATION_WS_ID") && c.includes("import { CURATION_WS_ID } from '@/shared/models'"); });
check('R68-2 搜索项目分组尊重 showDoneProjects（浮层读 zy_ui_v2 + isProjDone 派生口径）', () => { const c = read('/content/overlay-impl.ts'); return c.includes('showDoneProjectsCache') && c.includes('loadShowDonePref') && c.includes('zy_ui_v2') && c.includes('function isProjDone') && c.includes('if (!showDoneProjectsCache && isProjDone(p, d)) return'); });
check('R68-3（R155 令牌化备案）任务卡删除按钮 emoji → 主题色 trash 线性图标（深色主题可见）', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return t.includes('import Icon from') && t.split('<Icon name="trash" :size="12" />').length >= 4 && t.includes('.k-del { position: absolute; top: 6px; right: 58px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: var(--fs-caption); cursor: pointer; opacity: 0; transition: all var(--dur) ease; z-index: 1; color: var(--text-3);') && t.includes('.kcard:hover .k-pin, .kcard:hover .k-star, .kcard:hover .k-del { opacity: .85; }'); });
check('R68-4 快捷键体系改造（R117 修订；V3.7.0 重指：资源台退役后策展台索引由 n-4 顺延到 n-3）：open-compass/open-resource 退役 + 数字键 1=调度台 2=方向台 3..=策展台（goto-tasks/goto-curiosity 同落调度台并锚对应 tab）', () => { const m = read('/manifest.ts'); const b = read('/background/index.ts'); const a = read('/newtab/App.vue'); return !m.includes("'open-compass'") && !m.includes("'open-resource'") && b.includes('open-compass/open-resource 已从 manifest 下架') && b.includes("const anchor = command === 'goto-curiosity' ? 'curiosity' : 'task'") && a.includes("if (n === 1) { navigate('/'); return }") && a.includes('if (n === 2) { openCompass(); return }') && a.includes('const ws = store.workspaces[n - 3]'); });
check('R68-5（V3.9.1 重指）任务调度直达落位：调度台承接 zy-goto-anchor 后进入对应独立二级页，方向台不再持任务模块', () => { const h = read('/newtab/views/CompassHome.vue'); const t = read('/newtab/views/CompassTree.vue'); return h.includes("addEventListener('zy-goto-anchor', onAnchorEvt)") && h.includes("if (name === 'curiosity') { void router.push('/deck/curiosity'); return }") && h.includes("if (name === 'task') { void router.push('/deck/task'); return }") && !t.includes('flashTaskModule') && !t.includes('TaskManagerPanel'); });
check('R68-6（R155 令牌化备案）方向树操作按钮主题感知（去硬编码白底，深色主题可见）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('.node-action { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: var(--fs-caption); cursor: pointer; color: var(--text-2); transition: all var(--dur); background: var(--surface-3); border: 1px solid var(--border); }') && !t.includes('rgba(255,255,255,.9)'); });
check('R68-7 加载动画排版重整：分隔线对齐轴 + slogan 升字号提对比', () => { const h = read('/newtab/index.html'); return h.includes('zy-skl-divider') && h.includes('font-size: 15.5px; font-weight: 500; color: #C6CBD4; letter-spacing: 0.22em;') && h.includes('万千可调用，自有我方向</div>') && !h.includes('万千可调用，自有我方向。'); });
check('R68-8（R160/V3.9.1 重指）性能：KeepAlive 保留调度台、查看全部二级页与方向台一级 + 拼音词典零分发（两层表内联，无 312KB 字典 chunk）', () => { const a = read('/newtab/App.vue'); const g = read('/newtab/components/GlobalPopups.vue'); const p = read('/shared/utils/pinyin.ts'); const inc = (a.match(/keep-alive include="([^"]+)"/) || [, ''])[1].split(','); return inc.includes('CompassHomeView') && inc.includes('CompassDeckView') && inc.includes('CompassTreeView') && !a.includes("from '@/shared/utils/pinyin'") && !a.includes('requestIdleCallback') && g.includes("if (p === 'search')") && g.includes('void ensurePinyin()') && !p.includes("import('pinyin-pro')"); });

// ============== 第六十九轮 · R69：术语统一（工作台→策展台）+ 资源台「全部分类」默认根节点 + 快捷键映射表键位修正 + 垃圾文件清理 ==============
console.log('【第六十九轮 · R69：术语统一 + 资源台全部分类 + 键位修正 + 清理】');
check('R69-1 术语统一：界面/浮层/设置/手册用户可见文案已无「工作台」旧称', () => {
  const bad = ['工作台图标', '导出工作台数据', '删除工作台', '存入工作台', '各工作台', '工作台不存在', '新建工作台', '工作台名称', '选择工作台', '跨全部工作台', '暂无工作台', '工作台已删除', '打开工作台', '已定位到卡片所在工作台', '请到工作台补全', '该工作台暂无分类', '没有匹配的工作台', '目标工作台', '导出指定工作台', '资源工作台', '新增工作台', '展开工作台', '收起工作台'];
  const files = ['/newtab/views/Workspace.vue', '/newtab/components/GlobalPopups.vue', '/content/search-overlay.ts', '/newtab/views/GlobalSettings.vue', '/newtab/manual-data.ts', '/newtab/App.vue'];
  return bad.every(k => files.every(f => !read(f).includes(k)));
});
check('R69-2（R74 重写）资源台默认根节点「全部分类」：聚合哨兵 + 默认选中 + 树节点 + 聚合视图分支', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('全部分类') && w.includes('function newCardCatId') && w.includes('待分类');
});
check('R69-3（R74 重写）资源台聚合哨兵不污染数据层：新建卡/文件导入/空白区拖拽 均回落未分类', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function newCardCatId(): string') && w.includes("return (c && c !== 'uncat' && c !== 'all') ? c : ''") && w.includes('editingResource.categoryId = newCardCatId()') && w.includes('const targetKey = catKeyToCatId(groupKey)');
});
/* R69-4 / R69-5 于 B7-e（V3.8.40）重指：原锚钉GlobalPopups 里那份**手写** SHORTCUT_GROUPS
   （含 `{ keys: 'Alt+1', desc: '调度台（修饰键可自定义）' }` 等字面量），而 H3 把它整份删除、
   换成从 shared/utils/shortcuts.ts 派生（切台键走 {MOD} 占位，按用户偏好解析）。
   判据意图（速查口径：1=调度台 / 2=方向台 / 3 起各策展台，且必须随偏好走）不变，
   重指到新形态：**判据改问真源，并要求速查面板真的从真源派生**——
   钉中文字面量会随文案迭代反复假红，而"面板不许再写第四份清单"是结构性保证。 */
check('R69-4（V3.9.1 重指）设置页快捷键映射表：应用内固定 Alt+1…9 且只读，映射表由 shortcutsOf / resolveKeys 单一真源派生', () => {
  const s = read('/newtab/views/GlobalSettings.vue'); const sc = read('/shared/utils/shortcuts.ts');
  const panel = read('/newtab/views/settings/SettingsShortcutsPanel.vue');
  return panel.includes("{{ i + 3 <= 9 ? modLabel() + ' + ' + (i + 3) : '—' }}")
    && panel.includes('第 N 个策展台 = 修饰键 + (N+2)')
    && panel.includes('应用内固定按 <b>Alt + 数字</b> 切台')
    && panel.includes('知源内不提供修改')
    && !s.includes('3=资源台')
    && panel.includes("shortcutsOf('应用内', 'alt')")
    && sc.includes("{ keys: '{MOD}+3…9', action: '按台签顺序切各策展台'");
});
check('R69-5 快捷键速查口径修正（V3.7.0 重指资源台退役后 Alt+3 起整体让位各策展台；B7-e 重指到真源：三档落位在 shortcuts.ts，速查面板经 resolveKeys 按偏好渲染，负锚：面板不许再出现写死的 Alt+1/Alt+2）', () => {
  /* ★V3.9.6 重指带备案：速查面板已从 GlobalPopups.vue 拆到 GlobalPopupsShortcuts.vue
     （GlobalPopups 第二梯队拆分 · 第一块），派生量随之改名 `groups`。
     判据意图（真源三档 + 经 resolveKeys 渲染 + 不许写死 Alt）一字未改。 */
  const s = read('/newtab/components/GlobalPopupsShortcuts.vue'); const sc = read('/shared/utils/shortcuts.ts');
  const trio = ["{ keys: '{MOD}+1', action: '切到调度台'", "{ keys: '{MOD}+2', action: '切到方向台'", "{ keys: '{MOD}+3…9', action: '按台签顺序切各策展台'"];
  for (const t of trio) if (!sc.includes(t)) return false;
  return /resolveKeys\(it\.keys, SC_MOD\.value\)/.test(s)
    && /v-for="grp in groups"/.test(s)
    && !/keys: 'Alt\+1'/.test(s) && !/keys: 'Alt\+2'/.test(s) && !/keys: 'Alt\+3…9'/.test(s);
});
check('R69-6 垃圾清理：旧版浮层备份 search-overlay.ts.orig.bak 与 scripts/.r6a 已移除', () => !exists('/content/search-overlay.ts.orig.bak') && !fs.existsSync(path.resolve(SCRIPTS_DIR, '..', 'scripts', '.r6a')));
check('R69-7 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(ANCHOR_FILE, 'utf8'); const gs = read('/newtab/views/GlobalSettings.vue'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && gs.includes('runtimeVersion'); });

// ============== 第七十轮：全量代码审计缺陷修复（P0 分类树校验+递归防护 / P1 安全与引用一致性 / P2 健壮性） ==============
console.log('【第七十轮 · V2.39.0：审计缺陷全量修复】');

check('R70-1 P0 新增分类树结构校验工具（环/孤儿/超深净化 + 节点上限）', () => {
  const t = read('/shared/utils/catTree.ts');
  return t.includes('sanitizeCategoryTree') && t.includes('MAX_CAT_LEVEL') && t.includes('MAX_CAT_NODES') && t.includes('catTreeFixNote');
});
check('R70-2 P0 两条导入路径接入净化（全量导入 + 策展台数据包）', () => {
  const gs = read('/newtab/views/GlobalSettings.vue'); const imp = read('/newtab/composables/useWorkspaceImport.ts');
  return gs.includes('sanitizeCategoryTree(imported.categories') && gs.includes('mergeById(d.categories, safeCats)') && imp.includes('sanitizeCategoryTree(ext.categories');
});
check('R70-3（R74 重写）资源台递归/上行走链防环（R71 起收敛至索引层 visited + 缓存）', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const w = read('/newtab/views/Workspace.vue');
  const x = read('/shared/utils/catIndex.ts');
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  return !host.includes('function descendantIds') && !host.includes('function catAggCount') && !host.includes('function childCatsOf')
    && w.includes('const catIdx = computed(() => buildCatIndex(wsCats.value))')
    && x.includes('带 visited 的 DFS')
    && x.includes('const seen = new Set<string>([id])')
    && h.includes('if (seen.has(c.id)) continue')
    && h.includes('catIdx.value.descendants(dragId).includes(targetId)')
    && m.includes('if (descendants.has(child.id)) continue');
});
check('R70-4 P0 策展台递归防护 + 金字塔环内节点不再静默丢失', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const imp = read('/newtab/composables/useWorkspaceImport.ts');
  const x = read('/shared/utils/catIndex.ts');
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  return !host.includes('function descendantIds(catId: string): string[]')
    && !host.includes('function pyDepthOf(c: Category): number')
    && !host.includes('function pyHeightOf(c: Category, seen = new Set<string>())')
    && imp.includes('sanitizeCategoryTree(ext.categories')
    && x.includes('if (!c.parentId || c.parentId === c.id || !byId.has(c.parentId)) { roots.push(c); continue }')
    && x.includes('if (seen.has(ch.id)) continue')
    && h.includes('if (seen.has(c.id)) continue')
    && h.includes('catIdx.value.descendants(dragId).includes(targetId)')
    && m.includes('if (descendants.has(child.id)) continue');
});
check('R70-5 P1 导出与自动备份剥离 Airtable 凭证', () => {
  const gs = read('/newtab/views/GlobalSettings.vue'); const w = read('/newtab/views/Workspace.vue');
  const n = (gs.match(/delete \w+\.airtableSync/g) || []).length + (w.match(/delete \w+\.airtableSync/g) || []).length;
  return n >= 4;
});
check('R70-6 P1 全局搜索结果集排除资源台本体', () => {
  return read('/newtab/components/GlobalPopups.vue').includes('d.value.workspaces.filter(w => !w.archived && w.id !== CURATION_WS_ID)');
});
check('R70-7 P1 任务采集浮层监听器改模块级（不再重复写数据）', () => {
  const o = read('/content/overlay-impl.ts');
  return o.includes('let activeTcSave: (() => void) | null = null') && o.includes('function onTcKeydown(e: KeyboardEvent)') && o.includes('activeTcSave = null') && !o.includes('const onTcKey = (e: KeyboardEvent)');
});
check('R70-8 P1 好奇心转任务归属校验（视图复位 + 数据层兜底）', () => {
  const c = read('/newtab/components/compass/CuriosityPanel.vue'); const s = read('/newtab/stores/curiosity.ts');
  return c.includes('@change="onConvertProjChange"') && c.includes('function onConvertProjChange()') && s.includes('const safeMetricId = projectId ? metricId : undefined');
});
check('R70-9 P1 好奇心转任务补写 metric.taskIds（双向引用完整）', () => {
  const s = read('/newtab/stores/curiosity.ts');
  return s.includes('if (task.metricId) {') && s.includes('if (m.id === task.metricId && !m.taskIds.includes(task.id)) m.taskIds.push(task.id)');
});
check('R70-10 P1 多窗口快捷键定位优先当前窗口（5 处）', () => {
  const b = read('/background/index.ts');
  return (b.match(/t\.windowId === tab\?\.windowId/g) || []).length >= 5;
});
check('R70-11（R131-C1a 重写）isSelfWrite 由内容指纹升级为载荷 __wid（守卫生效且判定 O(1)）', () => {
  const r = read('/shared/storage/repository.ts');
  return r.includes('const SELF_CTX_ID = ') && r.includes('export function isSelfWrite(newValue: unknown): boolean') && r.includes('__wid: wid');
});
check('R70-12 P2 replaceData 加版本校验 + 遗漏段按 id 合并', () => {
  const r = read('/shared/storage/repository.ts');
  return r.includes('function mergeByIdArr') && r.includes('replaceData: 数据版本不兼容') && r.includes('mergeByIdArr(cur.categories') && r.includes('mergeByIdArr(cur.workspaces');
});
check('R70-13 P2 主数据只有一个写口 ★R4-Fb 重指带备案：原锚钉的是 popup 改走 repository，popup 端已随降级路径退役；这条性质升级成现扫负锚——除 shared/storage/repository.ts 自己，全 src 的**代码**里出现裸写 zy_data_v2 即红（吃 codeOnly，注释里讲历史不算）', () => {
  const bare = srcFileEntries().filter(e => e.rel !== 'shared/storage/repository.ts' && /local\.set\(\s*\{[^}]*zy_data_v2/.test(codeOnly(e.text)));
  const r = read('/shared/storage/repository.ts');
  return bare.length === 0 && r.includes('export async function saveDataNow') && r.includes('mergeExternalData');
});

check('R70-14 P2 链接协议黑名单（javascript/data/vbscript/blob）', () => {
  return read('/shared/utils/link.ts').includes('javascript|data|vbscript|blob');
});
check('R70-15 P2 weekStartKey 本地时区 + uid randomUUID + 429 指数退避', () => {
  const u = read('/shared/utils/index.ts'); const a = read('/shared/storage/airtable.ts');
  return u.includes('crypto.randomUUID') && u.includes('new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))') && a.includes('RATE_LIMIT_MAX_RETRY') && a.includes('retry429');
});
check('R70-16 P2 搜索高亮先定位后转义（AT&T 不再渲染成实体）', () => {
  const g = read('/newtab/components/GlobalPopups.vue');
  return g.includes('escapeHtmlTitle(title.slice(0, i))') && !g.includes('const i = esc.toLowerCase().indexOf');
});
check('R70-17 P2 悬空投射清理（启动期 + 回收站硬删；R128-A3 起统一在 purge.ts 内）', () => {
  const h = read('/shared/storage/hub.ts'); const r = read('/shared/storage/repository.ts'); const p = read('/shared/storage/purge.ts');
  return h.includes('export function pruneDanglingProjections') && r.includes('pruneDanglingProjections(data)') && p.includes('pruneDanglingProjections(d)');
});
check('R70-18 P2 构建配置（sourcemap + pinyin 独立 chunk）', () => {
  const v = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'vite.config.ts'), 'utf8');
  return v.includes("sourcemap: 'hidden'") && v.includes("if (id.includes('pinyin-pro')) return 'pinyin'");
});
check('R70-19 P2 内容脚本失败可感知（重试 + 页面提示）', () => {
  const s = read('/content/search-overlay.ts');
  return s.includes('function showLoadError') && s.includes('mod = await loadImpl()');
});
check('R70-20 P2 DHI 文案残留清理（用户可见）', () => {
  const n = read('/newtab/components/compass/NorthStarPanel.vue'); const p = read('/newtab/views/ProjectCuration.vue');
  return n.includes('方向健康度明细 · 战略目标 / 推进项目') && p.includes('回流指标与战略目标进度');
});

// ============== 第七十一轮：结构性性能治理（分类树索引层 / 模板方法调用消除 / 数据聚合单遍化 / 持久化减负 / 长列表离屏） ==============
console.log('【第七十一轮 · V2.40.0：结构性性能治理】');

check('R71-1 P1 新增分类树索引层 buildCatIndex（byId/childrenOf/roots/depthOf/pathOf + 缓存）', () => {
  const t = read('/shared/utils/catIndex.ts');
  return t.includes('export function buildCatIndex') && t.includes('byId') && t.includes('childrenOf')
    && t.includes('depthOf') && t.includes('pathOf') && t.includes('export interface CatIndex');
});
check('R71-2 P1 新增分桶索引 buildBucketIndex（按 key 一次分桶）', () => {
  return read('/shared/utils/catIndex.ts').includes('export function buildBucketIndex');
});
check('R71-3（R74 重写）两视图主 computed 改走索引（消除模板内 O(n) find/filter）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('const catIdx = computed(() => buildCatIndex(wsCats.value))') && w.includes('const resBucket = computed(() => buildBucketIndex(allResources.value');
});
check('R71-4 P1 策展台侧栏预计算（hasChildren/aggCount/directCount 不再模板内递归）', () => {
  const w = read('/newtab/views/Workspace.vue');
  // R76：原按接口字段连串匹配，新增 childCount 后会被截断 ⇒ 改为分字段匹配（字段名与预计算赋值各验一次）
  return w.includes('hasChildren: boolean') && w.includes('aggCount: number') && w.includes('directCount: number')
    && w.includes('hasChildren: catIdx.value.hasChildren(c.id)')
    && w.includes('directCount: (resBucket.value.get(c.id) || []).length');
});
check('R71-5 P1 看板列改预计算 computed（每列不再各调一次分组函数）', () => {
  return read('/newtab/views/Workspace.vue').includes('const kanbanColumns = computed(');
});
check('R71-6（R74 重写）资源台节点计数改预计算表（catAggCount 查索引，替代模板内递归）', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  return !host.includes('function catAggCount')
    && h.includes('const cardsByCat = computed<Map<string, ResourceCard[]>>(() => {')
    && h.includes('const arr = out.get(key)')
    && h.includes('const nodeCount = computed(() => wsCats.value.length)')
    && n.includes('return props.cardsByCat.get(props.node.id) || []');
});
check('R71-7 P2 boardCardsOf 改 id 索引（O(投射×资源) → O(投射+资源)）', () => {
  const h = read('/shared/storage/hub.ts');
  return h.includes('const byId = new Map<ID, ResourceCard>()') && h.includes('export function boardCardsOf');
});
check('R71-8 P2 curationMetrics 单次遍历（卡数分布 / 附件 / 镜像计数一次得出）', () => {
  const h = read('/shared/storage/hub.ts');
  return h.includes('const cardCountByCat = new Map<string, number>()')
    && h.includes('const hasChild = new Set<string>()') && h.includes('if (!cardCountByCat.get(c.id) && !hasChild.has(c.id)) emptyNodes++');
});
check('R71-9 P2 持久化去掉冗余序列化往返（2 序列化+2 解析 → 1+1）', () => {
  const r = read('/shared/storage/repository.ts');
  return r.includes('payloadJson = JSON.stringify(cache)') && !r.includes('JSON.stringify(JSON.parse(JSON.stringify(cache)))');
});
check('R71-10（R131-C1a 重写 · R175 再收紧）isSelfWrite 判据 = 载荷 __wid O(1) 快路径 + old/new 写戳复用核（复制旧写戳的外部回写不得被误当回声）', () => {
  const r = read('/shared/storage/repository.ts');
  return r.includes('if (!lastSelfWriteId) return false')
    && r.includes('oldWid === newWid')
    && r.includes('isSelfWrite(ext) && !isStampReused(dch)')
    && !r.includes('__wh')
    && !r.includes('lastSelfWriteJson');
});
check('R71-11 P2 事件日志就地扫描三数组（不再 collectCards 建整张中间数组）', () => {
  const e = read('/shared/utils/eventLog.ts');
  return e.includes('const nextSnap = new Map<string, SnapshotEntry>()')
    && e.includes("scan('resource', d.resources)") && e.includes("scan('task', d.tasks)")
    && !e.includes('const current = collectCards(d)');
});
check('R71-12（V3.9.8 重指）长列表渲染抑制：资源池按 60 张一页，列表/网格都只渲染 rendered 批次；旧资源台 content-visibility 双锚退役', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !host.includes('content-visibility: auto')
    && !host.includes('contain-intrinsic-size: auto 44px')
    && pool.includes('const PAGE = 60')
    && pool.includes('const visibleCount = ref(PAGE)')
    && pool.includes('const rendered = computed(() => poolCards.value.slice(0, visibleCount.value))')
    && pool.includes('const hasMore = computed(() => poolCards.value.length > visibleCount.value)')
    && pool.includes('function renderMore() { if (hasMore.value) visibleCount.value += PAGE }')
    && (pool.match(/v-for="r in rendered"/g) || []).length >= 2;
});
check('R71-13 P3 下钻面板惰性求值（R101 重指：实现拆入 useCurationDrill，宿主保留绑定）', () => {
  return read('/newtab/composables/useCurationDrill.ts').includes('if (!drillOpen.value) return []') && read('/newtab/views/Workspace.vue').includes('useCurationDrill({');
});
check('R71-14 P0 性能基准测试台入库（A/B 可复现）', () => {
  return fs.existsSync(path.resolve(SCRIPTS_DIR, '..', 'scripts', 'perf.cjs'));
});

// ============== 第七十二轮：卡片视图横向列数（4/5/6/7）+ 卡片宽度自适应 ==============
console.log('【第七十二轮 · V2.41.0：卡片视图列数布局】');
check('R72-1 UIPrefs.cardCols 偏好字段（模块键 → 列数，本地记忆 zy_ui_v2）', () => {
  return read('/shared/models/index.ts').includes('cardCols?: Record<string, number>');
});
check('R72-2 列数口径唯一来源：4/5/6/7 白名单 + 模块默认值 + 非法值回落 + 落库', () => {
  const s = read('/shared/utils/cardCols.ts');
  return s.includes('export const CARD_COL_OPTIONS = [4, 5, 6, 7]')
    && s.includes('export const CARD_COLS_DEFAULT')
    && s.includes('curio: 4, task: 5, res: 6')
    && s.includes('export function readCardCols') && s.includes('export function writeCardCols')
    && s.includes('export function useCardCols') && s.includes('saveUIPrefs({ cardCols: next })');
});
check('R72-3 共享列数选择器组件（4/5/6/7 分段控件，样式全走 tokens，无硬编码色）', () => {
  if (!exists('/shared/components/ColsPicker.vue')) return false;
  const s = read('/shared/components/ColsPicker.vue');
  return s.includes('CARD_COL_OPTIONS') && s.includes("emit('update:modelValue'")
    && s.includes('var(--accent)') && s.includes('var(--surface-2)')
    && !/#[0-9a-fA-F]{6}\b/.test(s);
});
check('R72-4 好奇心培育：列数选择器 + cz-grid 变量驱动（写死 repeat(4,1fr) 退役）', () => {
  const s = read('/newtab/components/compass/CuriosityPanel.vue');
  return s.includes("useCardCols('curio'") && s.includes('v-model="curioCols"')
    && s.includes("'--grid-cols': String(curioCols)")
    && /\.cz-grid \{[^}]*var\(--grid-cols/.test(s)
    && !/\.cz-grid \{[^}]*repeat\(4, 1fr\)/.test(s);
});
check('R72-5 任务调度：列数选择器 + tm-grid-inner 变量驱动（写死 minmax(240px,1fr) 退役）', () => {
  const s = read('/newtab/components/compass/TaskManagerPanel.vue');
  return s.includes("useCardCols('task'") && s.includes('v-model="taskCols"')
    && s.includes("'--grid-cols': String(taskCols)")
    && /\.tm-grid-inner \{[^}]*var\(--grid-cols/.test(s)
    && !/\.tm-grid-inner \{[^}]*minmax\(240px, 1fr\)/.test(s);
});
check('R72-6（R74 重写）资源台 + 策展台：列数选择器 + card-grid 变量驱动', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !host.includes("useCardCols('res'") && !host.includes('v-model="resCols"')
    && !host.includes('<ColsPicker') && !host.includes('class="card-grid"')
    && pool.includes("const viewMode = ref<'card' | 'list'>('list')")
    && pool.includes('class="pcp-grid"')
    && pool.includes('repeat(auto-fill, minmax(220px, 1fr))')
    && pool.includes('class="pcp-list"');
});
check('R72-7（R74 重写；R88 重指：门控可落在包裹行上）列数选择器仅在卡片视图出现（三处宿主均以 viewMode 门控）', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !host.includes('<ColsPicker') && !host.includes('useCardCols(')
    && pool.includes("v-else-if=\"viewMode === 'list'\"")
    && pool.includes('<div v-else class="pcp-grid">')
    && pool.includes(":groups=\"viewMode === 'list' ? POOL_GROUP_OPTIONS : []\"")
    && !pool.includes('<ColsPicker');
});
check('R72-8（V3.9.8 重指：F3 精确 N 列仍守两份卡片视图；资源台退役后资源池改为网格/列表两档）：好奇心 cz-grid 与任务 tm-grid-inner 保持精确 N 列，资源池网格走 auto-fill、列表走 pcp-list', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const curio = read('/newtab/components/compass/CuriosityPanel.vue');
  const task = read('/newtab/components/compass/TaskManagerPanel.vue');
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return curio.includes('repeat(var(--grid-cols, 4), minmax(0, 1fr))')
    && task.includes('repeat(var(--grid-cols, 5), minmax(0, 1fr))')
    && !host.includes('class="card-grid"')
    && !host.includes('repeat(var(--grid-cols, 5), minmax(0, 1fr))')
    && pool.includes("const viewMode = ref<'card' | 'list'>('list')")
    && pool.includes('class="pcp-grid"')
    && pool.includes('repeat(auto-fill, minmax(220px, 1fr))')
    && pool.includes('class="pcp-list"');
});
check('R72-9 G7 界面偏好包补齐列数：导入侧按白名单归一后落库（sanitizeCardCols）', () => {
  const g = read('/newtab/views/GlobalSettings.vue');
  return g.includes('sanitizeCardCols') && g.includes('saveUIPrefs({ cardCols: cols })')
    && read('/shared/utils/cardCols.ts').includes('export function sanitizeCardCols');
});

console.log('');
console.log('【第七十三轮 · V2.42.0：资源台收敛（R16）】');
// R179-MIGRATED R73-1 / R74-2
// V3.7.0（R179）随迁重写：资源台页退役——/curation 不再改投 /workspace/zy-curation（hub 分支已无），
// 改为 redirect 回调度台首页；旧深链零 404 仍由本断言守。
check('R73-1 资源台两入口合一（V3.7.0 重指）：/curation 为 redirect 到调度台首页（资源台页退役，独立组件与 hub 分支双清）', () => {
  const r = read('/newtab/router.ts');
  return r.includes("path: '/curation'") && r.includes("redirect: () => ({ path: '/' })") && !r.includes("import('./views/CurationCenter.vue')") && r.includes('资源台已随池语义退役');
});
// V3.7.0（R179）重指：同 R73-1，redirect 目标随资源台退役改投首页
check('R73-2 顶栏「资源台」Tab 退役（V3.7.0 重指：读码区剥注释＋/curation 残留负向）：固定页签=调度台/方向台，activeTab curation 分支与 /curation 导航一并下线', () => {
  const a = codeOnly(read('/newtab/App.vue'));
  return !a.includes("return 'curation'") && !a.includes("navigate('/curation')") && !a.includes('/curation') && a.includes('>调度台') && a.includes('>方向台');
});
check('R73-3 KeepAlive 不再缓存已收敛的 CurationCenterView（三主视图）', () => {
  const a = read('/newtab/App.vue');
  const inc = (a.match(/keep-alive include="([^"]+)"/) || [, ''])[1].split(',')
  return inc.includes('CompassHomeView') && inc.includes('WorkspaceView') && !inc.includes('CurationCenterView');
});
// R84 重指：页头由 R73 的 hub 专属 `.ws-hub-head`（写死「资源台」）升级为 W1 的全台通用 `.ws-id-head`
// （台名取 workspace.name、描述取 workspace.desc）。**能力仍在且更强**——资源台标题可见，
// 而且不再写死、策展台也有了。名冻结、只改断言体，零退役。
// R179-MIGRATED R73-4
// V3.7.0（R179）随迁重写：hub 回落文案（「资源卡唯一存储 · 镜像源头」）随资源台退役下线，
// .ws-id-head 收敛为策展台唯一形态（图标 + 台名 + 用户自写描述 + 结构摘要 + 更新流水入口）。
check('R73-4 页头全台渲染（V3.7.0 重指）：res台退役后 .ws-id-head 为唯一形态——图标+台名+自写描述+结构摘要', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('class="ws-id-head"') && w.includes('{{ wsDisplayNameOf(workspace) }}') && w.includes('class="wsh-desc"')
    && w.includes('class="wsh-summary"')
    && w.includes('font-size: 16px; letter-spacing: .2px');
});
// R179-MIGRATED R73-5
// V3.7.0（R179）随迁重写：导入弹窗收敛单形态「导入策展台数据包（JSON）」——hub 分支（书签/本地文件）
// 随资源台退役，书签导入唯一路线=设置→导入数据，本地文件导入待 R2 3张卡「新建」弹窗接手（composable 能力保留）。
check('R73-5 导入弹窗单形态（V3.7.0 重指）：只收策展台数据包 JSON，hub 双选项分支退役（boardImportInput 唯一入口）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return !w.includes("isHub ? '导入资源到资源台' : '导入策展台数据包'") && w.includes('导入策展台数据包（JSON）') && w.includes('boardImportInput?.click()');
});
check('R73-6（R100 拆入 useWorkspaceImport；★R4-Db 再重指：书签导入唯一实现搬到 useBookmarkImport）书签导入全链路一条走完：解析→根文件夹白名单→层级转标签→建/复用目标台与「待分类」→落库→回执；★其中「前 2 级建分类 + 文件夹勾选弹窗」两项按设计退役（判据见 R30-4），本条改为点名存活四件 + 退役两件零命中', () => {
  const bk = read('/newtab/composables/useBookmarkImport.ts');
  const imp = codeOnly(read('/newtab/composables/useWorkspaceImport.ts'));
  return bk.includes('function parseBookmarksHtml') && bk.includes('const BK_ROOT_NAMES = new Set(')
    && bk.includes('async function handleBookmarkImport(') && bk.includes("name: '待分类'")
    && bk.includes("'🔖 书签导入 '") && bk.includes('data.resources.unshift(card)') && bk.includes('persist()')
    && ['function ensureBookmarkCategory', 'function confirmBookmarkImport', 'bkFolders'].every(k => !bk.includes(k) && !imp.includes(k));
});
// V3.7.0（R179）退役：hub 镜像推送入口（右键菜单 📡 isHub 门控 / 分类 ⋯ 📤 canMirror 门控 / 目标台弹窗）
// 随资源台退役整体下线——池化架构下「从资源台推镜像」不再存在这回事（策展台取卡走「🔗 关联资源卡」与投射记录）。
// 实现侧：useWorkspaceMirror 只余引用侧四函数；useResourceDrawer 的 📡 菜单项与 canMirror 门控一并移除。
// R73-7 hub 镜像推送入口：右键菜单 📡（isHub 门控）/ 分类 📤（菜单）/ 目标台弹窗，且仅 hub 出现
check('R73-8（V3.9.8 重指）画布补齐落点：根节点可承接拖拽、拖拽结束复位、移动后新旧父级都重编号；旧区域落卡/混排函数零命中', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const map = read('/newtab/components/curation/CurationMindMap.vue');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return !host.includes('function onAreaDrop')
    && !host.includes('function acceptDragOver')
    && !host.includes('function clearDragState')
    && !host.includes('function reorderMixed')
    && !host.includes('function catKeyToCatId')
    && map.includes('function onDragStart(id: string): void')
    && map.includes('function onDragOver(e: DragEvent, id: string): void')
    && map.includes('function onDrop(e: DragEvent, id: string): void')
    && map.includes('function clearDrag(): void')
    && map.includes('@dragend="clearDrag"')
    && map.includes("@drop=\"onDrop($event, 'root')\"")
    && hook.includes('function moveNode(dragId: string, targetId: string): boolean')
    && hook.includes('normalizeSiblings(oldParent)')
    && hook.includes('normalizeSiblings(target.id)');
});
check('R73-9 聚合哨兵不污染数据层（hub 口径）：新建/文件导入/空白区落卡 均经 newCardCatId 回落未分类', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function newCardCatId(): string') && w.includes("return (c && c !== 'uncat' && c !== 'all') ? c : ''")
    && w.includes('editingResource.categoryId = newCardCatId()') && read('/newtab/composables/useWorkspaceImport.ts').includes('const catId = newCardCatId()')
    && w.includes('const targetKey = catKeyToCatId(groupKey)');
});
check('R73-10（R74 重写）旧入口组件已删除（路线乙收尾）：CurationCenter.vue 不复存在', () => {
  return !exists('/newtab/views/CurationCenter.vue') && !read('/newtab/router.ts').includes('CurationCenter');
});
check('R73-11（R74 重写）CurationCenter.vue 已删除：src 内零残留（router/App/其它视图均无引用）', () => {
  const r = read('/newtab/router.ts');
  const a = read('/newtab/App.vue');
  return !exists('/newtab/views/CurationCenter.vue') && !r.includes('CurationCenter') && !a.includes('include="CompassHomeView,CurationCenterView');
});

console.log('');
console.log('【第七十四轮 · V2.43.0：资源台收敛收尾（删 CurationCenter.vue）】');
check('R74-1 旧入口组件删除 + 全仓零残留（router 不 import / App KeepAlive 不含 / 文件不存在）', () => {
  const r = read('/newtab/router.ts'); const a = read('/newtab/App.vue');
  return !exists('/newtab/views/CurationCenter.vue') && !r.includes('CurationCenter') && !a.includes('CurationCenterView');
});
// V3.7.0（R179）重指：同 R73-1——/curation 现改投调度台首页（旧深链不 404 的不变量保持）
check('R74-2 路由收敛保持（V3.7.0 重指）：/curation 仍为 redirect（改投 /），hub 工作区路由不再存在', () => {
  const r = read('/newtab/router.ts');
  return r.includes("path: '/curation'") && r.includes("redirect: () => ({ path: '/' })") && !r.includes("'/workspace/' + CURATION_WS_ID");
});
check('R74-3（V3.9.8 重指：四视图入口退役，画布保留搜索/新建分支/导入/分享与金字塔、树状布局切换）', () => {
  const w = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const wc = codeOnly(w);
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  return w.includes('toolbar-search') && w.includes('＋ 新建分支')
    && w.includes('导入数据包') && w.includes('分享成果')
    && m.includes("emit('update:layout', 'pyramid')") && m.includes("emit('update:layout', 'tree')")
    && !wc.includes('class="view-tabs"') && !wc.includes('toggleBatchMode');
});
check('R74-4 hub 抽屉详情与双击开链（ResourceEditForm + 260ms 判别）', () => {
  const w = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const dr = read('/newtab/composables/useResourceDrawer.ts');
  return w.includes('ResourceEditForm') && w.includes('<Drawer :open="drawerOpen"')
    && dr.includes('function openResource(r: ResourceCard)')
    && dr.includes('function onCardDblClick(r: ResourceCard)')
    && dr.includes('openResourceLink(r)') && dr.includes('}, 260)');
});
check('R74-5（V3.9.8 重指）资源池批量栏：全选/反选/打标签 + 批量打开 + 投射到策展台 + 批量删除；旧移动到分类入口零命中', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !w.includes('class="batch-bar"') && !w.includes('openBatchMove')
    && pool.includes('<DeckBatchBar v-if="batchMode"')
    && pool.includes('@select-all="selectAll"') && pool.includes('@invert="invertSel"')
    && pool.includes('@apply-tag="applyTagToSelected"') && pool.includes('@click="deleteSelected"')
    && pool.includes('@click="batchOpen"') && pool.includes('批量打开')
    && pool.includes('@click="openBatchMirror"') && pool.includes('投射到策展台')
    && pool.includes('删除（进回收站）')
    && !pool.includes('openBatchMove');
});
check('R74-6（V3.9.8 重指）资源池分组折叠：全部展开/收起 + 单组折叠取反 + 组头取当前组卡数；画布节点计数走索引，旧分类树函数零命中', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return !w.includes('function expandAllCats')
    && !w.includes('function collapseAllCats')
    && !w.includes('function catAggCount')
    && pool.includes('const collapsedGroups = ref<Set<string>>(new Set())')
    && pool.includes('const allGroupsCollapsed = computed(() =>')
    && pool.includes('function toggleGroupCollapsed(id: string): void')
    && pool.includes('function toggleAllGroups(): void')
    && pool.includes(':aria-expanded="!isGroupCollapsed(sec.id)"')
    && pool.includes('{{ sec.cards.length }} 张')
    && hook.includes('const nodeCount = computed(() => wsCats.value.length)')
    && hook.includes('const rootCats = computed(() => catIdx.value.roots)');
});
check('R74-7（V3.9.8 重指）镜像卡同树呈现：boardCardsOf 先并入 allResources，cardsByCat 再挂到画布节点；旧镜像分类徽标与独立镜像分组零命中', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  return !w.includes('isMirrorCat(sc.cat)') && !w.includes('📡 镜像分组')
    && w.includes('const allResources = computed<ResourceCard[]>(() => boardCardsOf(d.value, workspaceId.value))')
    && hook.includes('const cardsByCat = computed<Map<string, ResourceCard[]>>(() => {')
    && hook.includes('for (const r of allResources.value)')
    && node.includes('return props.cardsByCat.get(props.node.id) || []')
    && node.includes('<button v-for="card in cards().slice(0, 2)"');
});
// V3.7.0（R179）退役：hub 镜像推送入口（卡面 📡 / 分类 ⋯ 📤 / 目标台弹窗）随资源台退役整体下线——
// 宿主 Workspace.vue 与 useWorkspaceMirror.ts 双清；策展台内镜像**引用侧**（📡 徽标 / 定位 / 移出）仍在。
// R74-8 hub 镜像推送入口：卡面 📡 / 分类 📤（R113-N1 起走 ⋯ 菜单 runCatMenu） / 目标台弹窗
check('R74-9（V3.9.8 重指）画布拖拽落点 + 移动后重编号 + 拖拽复位：节点 drop 进入 moveNode，新旧父级都 normalizeSiblings，dragend 清空拖拽态', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const map = read('/newtab/components/curation/CurationMindMap.vue');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return !host.includes('onAreaDragOver')
    && !host.includes('onAreaDrop')
    && !host.includes('reorderMixed')
    && !host.includes('acceptDragOver')
    && !host.includes('clearDragState')
    && map.includes('@dragend="clearDrag"')
    && node.includes('@dragover="emit(\'drag-over\', $event, node.id)"')
    && node.includes('@drop="emit(\'drop\', $event, node.id)"')
    && hook.includes('function moveNode(dragId: string, targetId: string): boolean')
    && hook.includes('normalizeSiblings(oldParent)')
    && hook.includes('normalizeSiblings(target.id)');
});
check('R74-10（V3.9.8 重指）画布节点拖拽体系：dragstart/dragover/drop 三事件 + 校验后 moveNode + 新建子分支 createChild；旧分类拖拽函数零命中', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const map = read('/newtab/components/curation/CurationMindMap.vue');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return !w.includes('function onCatDragStart')
    && !w.includes('function onCatDragOver')
    && !w.includes('function onCatDrop')
    && !w.includes('function onCatRootDrop')
    && !w.includes('openCreateCat')
    && node.includes('@dragstart="dragStart"')
    && node.includes('@dragover="emit(\'drag-over\', $event, node.id)"')
    && node.includes('@drop="emit(\'drop\', $event, node.id)"')
    && map.includes('function onDragStart(id: string): void')
    && map.includes('function onDragOver(e: DragEvent, id: string): void')
    && map.includes('function onDrop(e: DragEvent, id: string): void')
    && hook.includes('function validateDrop(dragId: string, targetId: string)')
    && hook.includes('function moveNode(dragId: string, targetId: string): boolean')
    && hook.includes('function createChild(parentId = \'root\'): Category | null');
});
check('R74-11 hub 删除分类回落：子分类提根 + 卡片回落待分类 + 清 targetWsId 投射', () => {
  const w = read('/newtab/views/Workspace.vue');
  const cc = read('/newtab/composables/useCategoryCrud.ts');
  return cc.includes('kids.forEach(k => { k.parentId = undefined })') && cc.includes('r.categoryId === cat.id') && cc.includes('p.targetWsId === workspaceId.value && p.targetCatId === cat.id');
});
check('R74-12（V3.9.8 重指）递归防环与索引层：catIndex 的 descendants/family/depthOf/pathOf 全带 visited 与缓存，画布经 descendants 拒绝落到自己子树', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const x = read('/shared/utils/catIndex.ts');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return !w.includes('function descendantIds')
    && !w.includes('function childCatsOf')
    && !w.includes('function catAggCount')
    && x.includes('带 visited 的 DFS')
    && x.includes('descendants(id: string): string[]')
    && x.includes('family(id: string): string[]')
    && x.includes('depthOf(id: string): number')
    && x.includes('pathOf(id: string, sep?: string): string')
    && x.includes('const descCache = new Map<string, string[]>()')
    && x.includes('const familyCache = new Map<string, string[]>()')
    && x.includes('const depthCache = new Map<string, number>()')
    && x.includes('const pathCache = new Map<string, string>()')
    && hook.includes('catIdx.value.descendants(dragId).includes(targetId)')
    && hook.includes('return catIdx.value.depthOf(cat.id) + 1');
});
check('R74-13（V3.9.8 重指）资源池滚动自动续载：IntersectionObserver + setSentinel + 240px 预取 + 卸载 disconnect；旧 content-visibility 双锚退役', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !w.includes('content-visibility: auto')
    && !w.includes('contain-intrinsic-size: auto 44px')
    && pool.includes('let io: IntersectionObserver | null = null')
    && pool.includes('const setSentinel = (el: unknown) => {')
    && pool.includes("new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) renderMore() }, { rootMargin: '240px' })")
    && pool.includes('io.observe(sentinel)')
    && pool.includes(':ref="setSentinel"')
    && pool.includes('onBeforeUnmount(() => { io?.disconnect(); io = null })');
});
check('R74-14 资源台两入口合一（V3.7.0 重指：资源台页与 tab 高亮分支退役；KeepAlive 三视图不变，★R3-B1 方向台侧由 CompassShell 换成 CompassTreeView）', () => {
  const a = read('/newtab/App.vue');
  const inc = (a.match(/keep-alive include="([^"]+)"/) || [, ''])[1].split(',')
  return !a.includes("if (activeWorkspaceId.value === CURATION_WS_ID) return 'curation'") && inc.includes('WorkspaceView') && inc.includes('CompassTreeView');
});
check('R74-15 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(ANCHOR_FILE, 'utf8'); const gs = read('/newtab/views/GlobalSettings.vue');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && gs.includes('runtimeVersion');
});

console.log('');
console.log('【第七十五轮 · V2.44.0：资源台（hub）指标条 3 格版（R18）】');
// V3.7.0（R179）退役：hub 指标条 3 格块随资源台退役——策展台三格（.ws-metrics.cur3）收敛为唯一形态，
// 指标条样式分流（R75-1/2/3）失去第二形态，判据由 R75-4（选择器零残留）承接。
// R75-1 资源台（hub）指标条 3 格块：v-if="isHub" class="ws-metrics hub3"
// V3.7.0（R179）退役：hub 三格 label（📊 卡片总数 / 📎 附件数量 / 🕐 最近更新）随资源台退役——
// 资源总量口径由调度台「3张卡」与设置页资源卡池全景承接。
// R75-2 hub 三格 label 齐备：📊 卡片总数 / 📎 附件数量 / 🕐 最近更新
// V3.7.0（R179）退役：hub 块的「不含论点格」守护随块退役——策展台 cur3 本就不含论点格（论点上横幅）。
// R75-3 hub 块不含论点格与来源构成格（无 openThesisDetail / 无 source 模式调用 / 无策展主题字样）
check('R75-4 指标条样式（V3.9.8 重指：资源台退役 + 策展台按用户决策收为两格；.ws-metrics.hub3 零残留，cur2 两列在位）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return !w.includes('.ws-metrics.hub3') && !w.includes('hub3') && w.includes('.ws-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 0; }') && w.includes('.ws-metrics.cur2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
});
check('R75-5（V3.9.8 重指：策展台只保留可统计的两格——论据卡片总数 / 佐证附件数量；“论证深度”与“来源覆盖”按用户决策退役）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const s = w.indexOf('<div class="ws-metrics cur2"');
  if (s < 0) return false;
  const e = w.indexOf('<CurationDrillDrawer', s);
  if (e < 0) return false;
  const blk = w.slice(s, e);
  return (blk.match(/class="metric-box"/g) || []).length === 2 && blk.includes('论据卡片总数') && blk.includes('佐证附件数量') && !blk.includes('论证深度') && !blk.includes('来源覆盖');
});
// R110-B1-3 承接：hub 卡片总数口径不再保留「⚠ 镜像 N 条待清理」异常分支——脏数据改由启动期
// scrubHubMirrorMarkers 净化 + curationMetrics 对 hub 镜像恒 0 双重兜底（见 R110-B1-2/B1-3）。
check('R75-6（R122 重指）hub 卡片总数补充口径退役：分类数并入页头描述，指标格无「镜像异常」分支', () => {
  const w = read('/newtab/views/Workspace.vue');
  return !w.includes('hubCountHint') && w.includes('{{ categories.length }} 个分类');
});
check('R75-7 hub 三格复用既有下钻（V3.7.0 重指：hub 块退役；下钻组件与模式不新增——CurationDrillDrawer 仍是唯一 Driller）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const dd = read('/newtab/components/CurationDrillDrawer.vue');
  const names = w.match(/[A-Za-z]*Drill[A-Za-z]*\.vue/g) || [];
  return w.includes("openDrill('total')") && w.includes("openDrill('assets')") && w.includes("openDrill('recent')")
    && dd.includes("mode: 'total' | 'source' | 'assets' | 'recent'") && names.length > 0 && names.every(n => n === 'CurationDrillDrawer.vue');
});
check('R75-8（R110/R112 改写）指标条数据源仍为 curationMetrics：未新增统计函数；hub.ts 统计段改动 = R110-B1-2 红线兜底镜像恒 0 + R112-4 第三参复用宿主 cards（纯签名扩展，零行为变更）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const h = read('/shared/storage/hub.ts');
  return w.includes('const metrics = computed(() => curationMetrics(d.value, workspaceId.value, allResources.value))') && h.includes('export function curationMetrics') && h.includes('R110-BUG1：资源台（hub）按单向挂载红线镜像恒 0') && h.includes('cardsIn?: ResourceCard[]');
});
// V3.7.0（R179）退役：hub3 样式块随资源台退役；本断言转守退役边界——选择器零残留，
// 且承接其形态的 .metric-box 样式块仍零硬编码色（只用 tokens）。
check('R75-9 hub3 样式块（V3.7.0 退役）：选择器零残留 + .metric-box 样式零硬编码色（tokens 不变）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const i = w.indexOf('.metric-box {');
  if (i < 0) return false;
  const seg = w.slice(i, w.indexOf('\n', i));
  return !w.includes('.ws-metrics.hub3') && !/#[0-9a-fA-F]{3,8}\b/.test(seg);
});

console.log('【第七十六轮 · V2.45.0：资源台计数口径统一（R3）】');
check('R76-1（V3.9.8 重指）待分类判据仍只有宿主一份实现 isUncat；下钻经 ctx 注入复用，不再按聚合文件出现次数托底', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const drill = read('/newtab/composables/useCurationDrill.ts');
  return (w.match(/function isUncat\(/g) || []).length === 1
    && w.includes('function isUncat(r: ResourceCard, validIds: { has(id: string): boolean }): boolean {')
    && w.includes('return !r.categoryId || !validIds.has(r.categoryId)')
    && drill.includes('isUncat: (r: ResourceCard, validIds: { has(id: string): boolean }) => boolean')
    && drill.includes('const { allResources, resBucket, catIdx, isUncat } = ctx')
    && drill.includes('isUncat(r, catIdx.value.byId)')
    && !drill.includes('function isUncat(');
});
check('R76-2（V3.9.8 重指）下钻「待分类」计数改走 isUncat：失效 categoryId 也计入，严格口径（只看 !categoryId）退役', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const drill = read('/newtab/composables/useCurationDrill.ts');
  return drill.includes('const uncat = allResources.value.filter(r => isUncat(r, catIdx.value.byId)).length')
    && drill.includes("if (uncat) rows.push({ id: 'uncat', name: '待分类', count: uncat, depth: 0 })")
    && !drill.includes('filter(r => !r.categoryId).length')
    && !w.includes('filter(r => !r.categoryId).length');
});
check('R76-3（V3.9.8 重指）分类计数不再聚合/直属三元混用：画布节点只展示直属资源 cards().length，池分组头只展示该组 sec.cards.length', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !w.includes('{{ sc.directCount }}')
    && !w.includes('sc.hasChildren ? sc.aggCount : sc.directCount')
    && node.includes('return props.cardsByCat.get(props.node.id) || []')
    && node.includes('<button v-for="card in cards().slice(0, 2)"')
    && pool.includes('{{ sec.cards.length }} 张');
});
check('R76-4（V3.9.8 重指）分页只影响渲染集，不影响计数：列表/网格均渲染 rendered，头部仍显示 poolCards.length / poolTotal', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return !w.includes('return { key: c.key, name: c.name, items: shown, count: items.length, hiddenCount: items.length - shown.length }')
    && pool.includes('const rendered = computed(() => poolCards.value.slice(0, visibleCount.value))')
    && (pool.match(/v-for="r in rendered"/g) || []).length >= 2
    && pool.includes('<b>{{ poolCards.length }}</b> / 全部 {{ poolTotal }} 张')
    && pool.includes('↓ 已显示 {{ rendered.length }} / {{ poolCards.length }} 张');
});
check('R76-5（V3.9.8 重指）画布节点计数不再并列三套口径：节点头只显示子分支数，节点资源区只显示直属 cards() 数', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  return !w.includes('count: direct.length, total, items: direct, depth')
    && !w.includes('直属 {{ g.count }}')
    && !w.includes('共 {{ g.total }}')
    && node.includes('{{ children().length ? `${children().length} 个子分支` : \'论证节点\' }}')
    && node.includes('return props.cardsByCat.get(props.node.id) || []')
    && node.includes('v-if="cards().length > 2"')
    && node.includes('{{ cards().length - 2 }}');
});
check('R76-6（V3.9.8 重指）计数入口保留口径说明：资源池筛选胶囊带 title（全部/待打标/已调出/从未调出），下钻待分类行走统一 isUncat 口径', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const drill = read('/newtab/composables/useCurationDrill.ts');
  return !w.includes('class="cat-count" title="本台全部可见卡')
    && !w.includes('class="cat-count" title="未归入任何分类')
    && !w.includes('策展台含资源台镜像卡')
    && pool.includes("{ id: 'all', label: '全部', count: poolTotal.value }")
    && pool.includes("{ id: 'untagged', label: '待打标', count: untaggedCount.value, title: '无标签的卡在任何筛选下都召回不到——这里单独捞出来补标' }")
    && pool.includes("title: '至少被打开过一次'")
    && pool.includes("title: '还没有被打开过的卡'")
    && drill.includes("name: '待分类'")
    && drill.includes('isUncat(r, catIdx.value.byId)');
});
check('R76-7（V3.9.8 重指）有子分支的节点直接显示子分支数，资源计数仍从 cardsByCat 取直属卡；旧 childCount/aggCount 侧栏口径零命中', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return !w.includes('childCount: childCatsOf(c.id).length')
    && !w.includes('含 ${sc.childCount} 个子分类（共 ${sc.aggCount} 张）')
    && node.includes('function children(): Category[]')
    && node.includes('${children().length} 个子分支')
    && node.includes('return props.cardsByCat.get(props.node.id) || []')
    && hook.includes('const cardsByCat = computed<Map<string, ResourceCard[]>>(() => {');
});
check('R76-8（V3.9.8 重指）口径自洽：画布卡片、节点直属计数与下钻待分类同源 allResources；resBucket 与 cardsByCat 都按 categoryId 分桶，待分类统一走 isUncat', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  const drill = read('/newtab/composables/useCurationDrill.ts');
  return w.includes('const allResources = computed<ResourceCard[]>(() => boardCardsOf(d.value, workspaceId.value))')
    && w.includes("const resBucket = computed(() => buildBucketIndex(allResources.value, (r) => r.categoryId || ''))")
    && w.includes('useCurationDrill({')
    && hook.includes('for (const r of allResources.value)')
    && hook.includes("const key = r.categoryId || ''")
    && hook.includes('const arr = out.get(key)')
    && drill.includes('const uncat = allResources.value.filter(r => isUncat(r, catIdx.value.byId)).length')
    && drill.includes('count: (bucket.get(c.id) || []).length');
});
check('R76-9（V3.9.8 重指）「待分类」入口仍有真实消费：下钻行由 isUncat 计算，宿主点击跳回画布根节点并提示去资源卡池关联；旧侧栏计数与指标 hint 退役', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const drill = read('/newtab/composables/useCurationDrill.ts');
  return !w.includes('hubCountHint')
    && !w.includes('uncategorizedCount')
    && drill.includes("if (uncat) rows.push({ id: 'uncat', name: '待分类'")
    && w.includes("if (id === 'uncat')")
    && w.includes("mind.selectNode('root')")
    && w.includes('待分类资源尚未挂到论证分支——可在资源卡池中打开卡片并关联到具体节点');
});
check('R76-10（V3.9.8 重指）卡面所属分类与分组归属同源：宿主唯一 isUncat 定义注入下钻，镜像卡经 cardsByCat 进入同一节点资源列表', () => {
  const w = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const drill = read('/newtab/composables/useCurationDrill.ts');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  return w.includes('function isUncat(r: ResourceCard, validIds: { has(id: string): boolean }): boolean')
    && w.includes('return !r.categoryId || !validIds.has(r.categoryId)')
    && w.includes('allResources, resBucket, catIdx, isUncat')
    && drill.includes('isUncat(r, catIdx.value.byId)')
    && hook.includes('if (r.isThesis) continue')
    && hook.includes("const key = r.categoryId || ''")
    && node.includes('return props.cardsByCat.get(props.node.id) || []');
});
