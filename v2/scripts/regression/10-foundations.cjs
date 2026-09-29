/**
 * R174-1 分片 · 10-foundations：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

console.log('【红线检查】');
check('卡间零挂载红线（R165 立 · R166 收口 fromCuriosityId + 明文豁免记录型关联）：三卡模型零互持 id + 载入与导入**两条路**都剥 + 建卡字面量零携带（活性验证：临时加回字段→红→撤→绿）。R166 定案 4/5：fromCuriosityId 退役（转化即出路，溯源由 link+描述承担）；CurationProjection / SupportLink 是独立表里的**记录**，卡对象互不持有 id，不属卡间挂载', () => { const fsx = require('fs'); const path2 = require('path'); const root = path2.resolve(SCRIPTS_DIR, '..', 'src'); const hits = []; const walk = (d) => { for (const f of fsx.readdirSync(d)) { const p = path2.join(d, f); const st = fsx.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|vue)$/.test(f)) { const s = codeOnly(fsx.readFileSync(p, 'utf8')); if (/mountedCuriosityIds:\s*\[|relatedResourceIds:\s*\[|fromCuriosityId:/.test(s)) hits.push(p.replace(/\\/g, '/')); } } }; walk(root); const m = codeOnly(read('/shared/models/index.ts')); const r = read('/shared/storage/repository.ts'); const gs = read('/newtab/views/GlobalSettings.vue'); const bodies = ['ResourceCard', 'TaskCard', 'CuriosityCard'].map(k => m.split('interface ' + k)[1].split('}')[0]); return hits.length === 0 && bodies.every(b => !/mountedResourceIds|mountedCuriosityIds|relatedResourceIds|fromCuriosityId|parentId/.test(b)) && (m.match(/fromCuriosityId/g) || []).length === 0 && r.includes("export const RETIRED_CARD_KEYS = ['mountedResourceIds', 'mountedCuriosityIds', 'relatedResourceIds', 'fromCuriosityId']") && r.includes('export function stripRetiredCardKeys') && ['tasks', 'curiosities', 'resources'].every(k => r.includes('stripRetiredCardKeys(data.' + k + ')')) && ['ResourceCard', 'TaskCard', 'CuriosityCard'].every(k => gs.includes('stripRetiredCardKeys<' + k + '>(imported.')) && m.includes('export interface SupportLink') && m.includes('supportLinks?: SupportLink[]') && bodies.every(b => !/supportLinks|resourceId/.test(b)); });
check('单向挂载：Curiosity 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface CuriosityCard')[1].split('}')[0]));
check('单向挂载：Resource 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface ResourceCard')[1].split('}')[0]));
check('数据 100% 本地：无 http 数据上传', () => !/fetch\(|XMLHttpRequest/.test(read('/newtab/App.vue')));

console.log('【架构检查】');
check('路由：首页/方向台二级页/工作台/设置（R49：actions 子页退役）', () => count('/newtab/router.ts', "path: 'actions'") === 0 && count('/newtab/router.ts', "path: 'projects'") === 1 && count('/newtab/router.ts', "path: 'tree'") === 1);
check('旧任务中心路由已退役', () => !read('/newtab/router.ts').includes("'/tasks'"));
check('此刻最重要已整体移除', () => !exists('/newtab/components/compass/FocusPanel.vue'));
check('R49 方向台容器（R117 重写：项目详情由二级提为一级）：page-head + 满宽两模块（主航线 LighthousePanel / 项目详情 ProjectCuration embedded）——项目总览与任务调度已迁出，MetricBar 在调度台', () => { const s = read('/newtab/views/CompassShell.vue'); return count('/newtab/views/CompassShell.vue', 'LighthousePanel') >= 1 && count('/newtab/views/CompassShell.vue', 'ProjectCuration') >= 1 && s.includes('<ProjectCuration embedded />') && !s.includes('TaskManagerPanel') && !s.includes('MetricBar'); });

console.log('【A组 弹窗工作流】');
check('四端 zy-locate-workspace 单例定位', () => ['background/index.ts', 'content/search-overlay.ts', 'newtab/components/GlobalPopups.vue', 'popup/App.vue'].every(f => count('/' + f, 'zy-locate-workspace') >= 1));
check('B14 网页浮层 corner 模式 display:flex', () => read('/content/search-overlay.ts').includes('.corner{display:flex'));
check('B12 应用内采集弹窗右上角', () => read('/newtab/components/GlobalPopups.vue').includes('.gp-overlay.corner { align-items: flex-start; justify-content: flex-end'));
check('B5 采集去重（应用内+网页端）', () => count('/newtab/components/GlobalPopups.vue', 'normalizeUrl') >= 1 && count('/content/search-overlay.ts', 'normalizeUrl') >= 1);
check('好奇心反馈 💗好奇心+1', () => read('/content/search-overlay.ts').includes('💗好奇心+1') && read('/newtab/components/GlobalPopups.vue').includes('💗好奇心+1'));
check('B9 已保存态 Enter 监听', () => read('/content/search-overlay.ts').includes("document.addEventListener('keydown', onSavedKeydown, true)"));

console.log('【B组 修复】');
check('B1/B2 任务抽屉级联+Ctrl+Enter 容器级', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('onSelProjectChange') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('task-sidebar" :style="{ width: drawerW + \'px\' }" @keydown.ctrl.enter.prevent'));
check('B3 单例询问链路（zy-where）', () => read('/background/index.ts').includes('zy-where'));
check('B4/R120 搜索两入口统一：单击/Enter=开链（openLinkOrLocate）· Ctrl+Enter=仅定位（locateOnly：hl+hk 三件套 + cat）· 行内 ↗ 保留', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('function openLinkOrLocate') && g.includes('function locateOnly') && g.includes("hk: 'res'") && g.includes("hk: 'task'") && g.includes("hk: 'curio'") && g.includes('function openResLink'); });
check('B10 open-dashboard 复用标签页', () => read('/background/index.ts').includes('B10：已有新标签页则聚焦回归'));
check('B11/B29 搜索 Tab 循环切换类型', () => read('/content/search-overlay.ts').includes('cycle.indexOf') && read('/newtab/components/GlobalPopups.vue').includes('cycle.indexOf'));

console.log('【O组 优化】');
check('O3 批量挂载', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('confirmBatchMount'));
check('O5 好奇心看板跨列拖拽', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCzKanbanDrop'));
check('O7 好奇心双击打开来源 URL', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCardDblClick'));
check('O14 任务列表按项目分组', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('groupedTasks'));
check('O15/R49 顶部导航「方向台」入口（/compass）', () => read('/newtab/App.vue').includes("navigate('/compass')"));
check('O16 挂载候选搜索浮层（R165-A 重指：卡间挂载退役，任务详情零挂载 UI——ts-mount-pop/挂载好奇心整面清零）', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return !s.includes('ts-mount-pop') && !s.includes('挂载好奇心') && !s.includes('toggleMountCuriosity'); });

console.log('【D组 设计】');
check('D2R 字段行样式在 FieldEditor 子组件内（B18）', () => count('/newtab/views/FieldEditor.vue', 'gs-field-row') >= 2 && count('/newtab/views/GlobalSettings.vue', '.gs-field-row') === 0);
check('D2R 无 prompt 依赖', () => !read('/newtab/views/GlobalSettings.vue').includes('prompt('));
check('D3 好奇弹窗 640 居中', () => read('/content/search-overlay.ts').includes('.center .zy-panel.curio{width:640px;}'));
check('D7 采集小窗贴近图标', () => read('/content/search-overlay.ts').includes('corner{display:flex;align-items:flex-start;justify-content:flex-end;padding:10px'));

console.log('【N组 新功能】');
check('N1 愿景/使命关联卡片入口+选择浮层', () => read('/newtab/views/CompassTree.vue').includes('toggleLinkPop') && read('/shared/models/index.ts').includes('linkedResourceIds'));
check('N2 回收站（设置面板）', () => read('/newtab/views/GlobalSettings.vue').includes('emptyRecycleBin'));
check('N4 标签管理：树CRUD+3级限制+路径', () => read('/newtab/views/GlobalSettings.vue').includes('最多两级') && read('/shared/components/TagPicker.vue').includes('tp-pathtext'));
check('N4 标签重命名级联卡片', () => read('/newtab/views/GlobalSettings.vue').includes('级联同步所有卡片'));
check('H1 策展台快捷键映射+五修饰键', () => read('/newtab/views/GlobalSettings.vue').includes('modLabel') && read('/newtab/App.vue').includes('switchToIndex'));

console.log('【第五轮】');
check('B17 方向树目录入 tree-layout 左栏', () => read('/newtab/views/CompassTree.vue').indexOf('tree-page-head') < read('/newtab/views/CompassTree.vue').indexOf('tree-layout') && read('/newtab/views/CompassTree.vue').includes('class="tree-layout"'));
check('B17 目录与策展目录样式统一(200px sticky)', () => read('/newtab/views/CompassTree.vue').includes('width: 200px; flex-shrink: 0;') && read('/newtab/views/CompassTree.vue').includes('position: sticky'));
check('B18 字段行样式迁入子组件', () => count('/newtab/views/FieldEditor.vue', 'gs-fr-action') >= 2);
check('B22 状态三选 chips', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('ts-status-chip'));
check('B23 文档级 Ctrl+Enter/Esc', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('onSidebarDocKey'));
check('O19/R121 主航线项目行卡（全宽行：名/停滞 + 统计 + 迷你进度条；双击进项目详情页）★R177 重指带备案：行卡对齐原型 project-mini-chip（pr-meta 并入 pr-row2 统计段），判据改 pr-stats', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); return l.includes('class="proj-row"') && l.includes('pr-stats') && l.includes('mini-bar') && l.includes('@dblclick="openProject(p)"') && !l.includes('ProjectDetailDrawer'); });
check('O20（R126 重指）标签最多两级守卫 + 缩进兜底', () => read('/newtab/views/GlobalSettings.vue').includes('最多两级') && read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));
check('O21 分组列表跨组拖拽改归属', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onListGroupDrop'));
check('Bug1 目标卡按钮/箭头不重叠', () => read('/newtab/views/CompassTree.vue').includes('margin-right: 52px'));
check('Bug2 标签缩进 !important 兜底', () => read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));

console.log('【第六轮】');
check('B24 关联卡片标题 chips + 详情抽屉', () => read('/newtab/views/CompassTree.vue').includes('linked-chip') && read('/newtab/views/CompassTree.vue').includes('peekData'));
check('B24 打开链接含 file:/// 转换（第卅二轮下沉至 shared/utils/link）', () => read('/shared/utils/link.ts').includes('file:///') && read('/newtab/views/CompassTree.vue').includes('toOpenableRawLink'));
check('B25 选取弹窗置灰（已完成/已选入）', () => read('/newtab/views/CompassHome.vue').includes('pickerDisabled') && read('/newtab/views/CompassHome.vue').includes('pickedIds'));
check('B26 方向树默认全局展开', () => read('/newtab/views/CompassTree.vue').includes('expandAllNodes'));
check('B27 孤儿任务小节', () => read('/newtab/views/ProjectCuration.vue').includes('orphanTasks') && read('/newtab/views/ProjectCuration.vue').includes('未归类任务'));
check('B28 全局确认弹窗组件', () => fs.existsSync(base + '/shared/components/ConfirmDialog.vue') && fs.existsSync(base + '/shared/components/confirm.ts'));
check('B28 原生 confirm 全清除', () => { let n = 0; ['newtab/views/Workspace.vue','newtab/views/ProjectCuration.vue','newtab/components/compass/CuriosityPanel.vue','newtab/components/GlobalPopups.vue','newtab/views/GlobalSettings.vue','newtab/views/FieldEditor.vue','newtab/views/CompassHome.vue'].forEach(f => { n += count('/' + f, 'confirm('); }); return n === 0; });
check('O22 使用手册完整内容（外置数据）', () => read('/newtab/manual-data.ts').includes('quick-1') && read('/newtab/manual-data.ts').includes('ref-2') && !read('/newtab/views/GlobalSettings.vue').includes('占位内容'));
check('产品 logo 替换（首页+关于页+扩展图标）★R174-2 备案：logo 单源化——src/assets/logo.png 与 public/icons/icon128.png 逐字节同物双份（18,631B×2），宿主改走公共路径 /icons/icon128.png，仓库不再保留第二份', () => read('/newtab/App.vue').includes('logoUrl') && read('/newtab/App.vue').includes("const logoUrl = '/icons/icon128.png'") && read('/newtab/views/GlobalSettings.vue').includes("const logoUrl = '/icons/icon128.png'") && fs.existsSync(path.join(base, '..', 'public', 'icons', 'icon128.png')) && !fs.existsSync(base + '/assets/logo.png'));

check('manifest 版本唯一来源', () => read('/manifest.ts').includes(VER_ANCHOR_LITERAL));
check('关于页版本动态（读取 manifest.version，无历史版本硬编码残留）', () => {
  const gs = read('/newtab/views/GlobalSettings.vue')
  return gs.includes('runtimeVersion') && !gs.includes('V2.14.0') && !gs.includes('V2.14.1') && !gs.includes('V2.14.2') && !gs.includes('V2.15.0') && !gs.includes('V2.16.0') && !gs.includes('V2.17.0') && !gs.includes('V2.17.1')
});

console.log('【第七轮】');
check('B29 Tab 过滤单一状态源（应用内 chip 与 Tab 行共用 currentType）', () => !read('/newtab/components/GlobalPopups.vue').includes('filterType') && read('/newtab/components/GlobalPopups.vue').includes("currentType.value = cycle[(cycle.indexOf(currentType.value) + 1) % cycle.length]"));
check('B29 关键词+Tab 直达（应用内）', () => read('/newtab/components/GlobalPopups.vue').includes("[['任务', 'task'], ['资源', 'res']"));
check('B29 网页浮层过滤 chip + 关键词直达', () => read('/content/search-overlay.ts').includes('__zy_chip__') && read('/content/search-overlay.ts').includes("updateChip()") && read('/content/search-overlay.ts').includes("searchType = cycle[(cycle.indexOf(searchType) + 1) % cycle.length]"));
check('B28 网页浮层原生 confirm 替换（showDupConfirm）', () => read('/content/search-overlay.ts').includes('showDupConfirm') && !read('/content/search-overlay.ts').includes('confirm('));
check('B27 详情抽屉删指标保留任务转未归类（R146 备案：确认+报数+撤销并入 compassCrud.removeMetricWithConfirm 真源，抽屉只调用）', () => { const pd = read('/newtab/components/ProjectDetailDrawer.vue'); const cr = read('/shared/utils/compassCrud.ts'); return pd.includes('removeMetricWithConfirm') && !pd.includes('d.value.compass.directions.flatMap') && cr.includes('useConfirm') && cr.includes('转为「未关联指标」') && cr.includes('任务本体不删') && cr.includes('restoreCompassNode'); });
check('第七轮编译修复/R49：GlobalSettings ttRemove async 化（ProjectCuration 老抽屉已由共享 TaskDetailDrawer 替代）', () => read('/newtab/views/GlobalSettings.vue').includes('async function ttRemove') && read('/newtab/views/ProjectCuration.vue').includes('TaskDetailDrawer ref="detailRef"'));
check('B5 应用内采集去重流程完整（dup 分支在 saveCapture 内）', () => count('/newtab/components/GlobalPopups.vue', 'saveCapture') >= 3 && read('/newtab/components/GlobalPopups.vue').includes('resetCaptureForm()\n      closeAll()\n      return'));

console.log('【第八轮 · 分类体系】');
check('W1 数据模型：Category +parentId?/pinned?', () => read('/shared/models/index.ts').includes('parentId?: ID') && read('/shared/models/index.ts').includes('pinned?: boolean'));
check('W2 分类新建走应用内弹窗、重命名改行内就地（R141 改写备案：无原生 prompt，弹窗 rename 分支退役）', () => read('/newtab/views/Workspace.vue').includes('confirmCatModal') && read('/newtab/views/Workspace.vue').includes('startCatRename') && !read('/newtab/views/Workspace.vue').includes('prompt('));
check('W3 分类删除（R104 重指：实现拆入 useCategoryCrud）：子级自动升级 + 资源并入/转待分类', () => read('/newtab/views/Workspace.vue').includes('deleteCategory') && read('/newtab/composables/useCategoryCrud.ts').includes('升级为一级分类'));
check('W4 左栏树形渲染 + 置顶分区 + 聚合计数', () => read('/newtab/views/Workspace.vue').includes('sidebarCats') && read('/newtab/views/Workspace.vue').includes('pinnedRootCats') && read('/newtab/views/Workspace.vue').includes('catAggCount') && read('/newtab/views/Workspace.vue').includes('familyIds'));
// R112 重指：familyIds 现在包一层 Set 再过滤（O(卡数×家族) → O(卡数)），聚合过滤语义不变 —— 承接 R112-7
check('W5 父分类聚合过滤（点击父分类含子分类资源）', () => read('/newtab/views/Workspace.vue').includes('const ids = new Set(familyIds(activeCategory.value))'));
check('W6 分类拖拽：挂子级/同级排序/升一级/防循环', () => read('/newtab/views/Workspace.vue').includes("catDropMode.value = 'child'") && read('/newtab/views/Workspace.vue').includes('onCatRootDrop') && read('/newtab/views/Workspace.vue').includes('不能移动到自己的子分类'));
check('W7 批量移动含当前工作台 + 分类层级缩进（R102 重指：实现拆入 useWorkspaceBatch）', () => read('/newtab/composables/useWorkspaceBatch.ts').includes('const moveWorkspaces = computed(() => d.value.workspaces.filter(w => !w.archived))') && read('/newtab/views/Workspace.vue').includes('treeCatOptions') && read('/newtab/views/Workspace.vue').includes('📦 移动到…'));
check('W8 单卡移动分类弹窗 + 工作台重命名/描述弹窗', () => read('/newtab/views/Workspace.vue').includes('openMoveOne') && read('/newtab/views/Workspace.vue').includes('openInputModal') && read('/newtab/views/Workspace.vue').includes('renameWs()'));
check('W9 采集浮层分类下拉层级化', () => read('/content/search-overlay.ts').includes('treeCatLabels'));

console.log('【第九轮 · 体验修复】');
check('W10 资源卡标注分类名（可点击跳分类）', () => read('/newtab/views/Workspace.vue').includes('catNameOfFamily') && count('/newtab/views/Workspace.vue', 'rc-cat') >= 3);
check('W11 TagPicker 空体系引导去标签管理', () => read('/shared/components/TagPicker.vue').includes('tp-guide') && read('/shared/components/TagPicker.vue').includes("query: { page: 'tags' }"));
check('W12 设置深链 ?page=（onMounted+watch）', () => read('/newtab/views/GlobalSettings.vue').includes('function pageFromQuery') && read('/newtab/views/GlobalSettings.vue').includes('watch(() => route.query.page'));
check('W13 使用手册富文本（五篇·图文并茂·独立页）', () => read('/newtab/views/ManualPage.vue').includes('v-html="sec.html"') && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-steps') && read('/newtab/manual-data.ts').includes('恩格尔巴特') && read('/newtab/manual-data.ts').includes('七不原则') && read('/newtab/manual-data.ts').includes('快捷键全表'));
check('W14 tagUsage 数据兜底', () => read('/newtab/views/GlobalSettings.vue').includes('for (const x of arr || [])'));

console.log('【第十轮 · 稳定性与性能】');
check('B30a 全局渲染错误边界（黑屏→错误卡片）', () => read('/newtab/App.vue').includes('onErrorCaptured') && read('/newtab/App.vue').includes('render-error'));
check('B30b 标签树残缺节点兜底', () => read('/newtab/views/GlobalSettings.vue').includes('safeNodes') && read('/newtab/views/GlobalSettings.vue').includes("filter(n => n && typeof n.id === 'string')"));
check('B31 新建工作台双创建守卫', () => read('/newtab/App.vue').includes('B31：Enter 与 blur 双触发守卫') && read('/newtab/App.vue').includes("newWsName.value = ''"));
check('B32 图标管理（选择/自定义/删除）', () => read('/newtab/views/Workspace.vue').includes('setWsIcon') && read('/newtab/views/Workspace.vue').includes('WS_ICONS') && read('/newtab/views/Workspace.vue').includes('删除图标'));
check('B32 Hero 名称剥离 icon 前缀', () => read('/newtab/views/Workspace.vue').includes('wsDisplayName') && read('/newtab/App.vue').includes("ws.icon || '📁'"));
check('B33 快捷键自定义说明（手册+设置页）', () => read('/newtab/views/GlobalSettings.vue').includes('chrome://extensions/shortcuts'));
check('B34 骨架屏内联', () => fs.existsSync(base + '/../src/newtab/index.html') && read('/../src/newtab/index.html').includes('zy-skl'));
check('B34 启动批量读 + V1 检测跳过（R160-P6：四键同批）', () => read('/newtab/main.ts').includes('cs.get([STORAGE_KEY, K.LEGACY[0], HOT_KEY, UI_KEY])') && read('/newtab/main.ts').includes('loadUIPrefs(boot.ui)') && read('/newtab/main.ts').includes('ensureBootData'));

console.log('【第十一轮 · tags 治理与流畅度】');
check('B35 tags 数据归一化（loadData 治本）', () => read('/shared/storage/repository.ts').includes('fixTags') && read('/shared/storage/repository.ts').includes("c.tags.split("));
check('B35 全读取点数组守卫（settings/workspace/tagpicker）', () => read('/newtab/views/GlobalSettings.vue').includes('Array.isArray(tags)') && read('/newtab/views/Workspace.vue').includes('Array.isArray(r.tags) ? r.tags : []') && read('/shared/components/TagPicker.vue').includes('Array.isArray(props.modelValue)'));
check('B36 网页端搜索缓存+防抖+容错（R117 重写：getData 带 force 参数——采集浮层强制读当前分类）', () => read('/content/search-overlay.ts').includes('async function getData(force = false)') && read('/content/search-overlay.ts').includes('searchTimer') && read('/content/search-overlay.ts').includes('collectResults(d, query0(q), results, maps)') && read('/content/search-overlay.ts').includes('Array.isArray(r.tags)'));
check('C1 路由切换 out-in 过渡移除', () => !read('/newtab/App.vue').includes('mode="out-in"'));

console.log('【第十二轮 · 标签编辑/未归档/好奇来源】');
check('B37a findTagNode 遍历原始数组（根级删除/拖拽落库）', () => read('/newtab/views/GlobalSettings.vue').includes('return walk(store.data!.tagTree || [], null)'));
check('B37b/c 删除/新增反馈（带名 toast + 高亮闪烁）', () => read('/newtab/views/GlobalSettings.vue').includes('ttFlash') && read('/newtab/views/GlobalSettings.vue').includes('已删除 ${names.join'));
check('B37d 树形隶属引导线 + 折叠箭头按需显示', () => read('/newtab/views/GlobalSettings.vue').includes("background: linear-gradient(to bottom, var(--accent), var(--accent-light))") && read('/newtab/views/GlobalSettings.vue').includes('tt-toggle'));
check('O23 北极星未归档任务（第卌四轮升级：项目+指标双重有效性校验，见 R44-3）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('未归档任务') && read('/newtab/components/compass/NorthStarPanel.vue').includes('taskArchiveIssue(t) !==') && !read('/newtab/components/compass/NorthStarPanel.vue').includes('pendingTasks'));
check('O24 好奇心采集带来源（两端+模型+详情）', () => read('/shared/models/index.ts').includes('sourceTitle') && read('/content/search-overlay.ts').includes('sourceTitle: srcTitleInput') && read('/newtab/components/GlobalPopups.vue').includes('v-model="curioForm.sourceTitle"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('detail-src'));

console.log('【第十四轮 · Linear 视觉重构】');
check('P1 六主题 Linear 体系（深空薰衣草默认）', () => read('/shared/styles/tokens.css').includes("[data-theme='linear']") && read('/shared/styles/tokens.css').includes('#0D0E11') && read('/shared/styles/tokens.css').includes('#5E6AD2'));
check('P1 默认主题迁移（green→linear 一次性）', () => read('/shared/storage/repository.ts').includes("theme: 'linear'") && read('/shared/storage/repository.ts').includes("uiCache.theme === 'green'"));
check('P2 封面扁平化（R64 修订：hero 已删，等效锚点换指标卡样式）', () => !read('/newtab/views/Workspace.vue').includes('COVER_THEMES') && !read('/newtab/views/Workspace.vue').includes('heroGradient') && read('/newtab/views/Workspace.vue').includes('.metric-card { background: var(--surface); border: 1px solid var(--border);'));
check('R49 方向台扁平化（原 P2 罗盘 Hero）：满宽 page-head + 无装饰渐变', () => read('/newtab/views/CompassShell.vue').includes('.page { max-width: 1440px; margin: 0 auto; padding: 20px 36px 64px; }'));
check('P3 去弹跳（hover 无位移）+ 焦点环', () => !read('/newtab/views/ProjectCuration.vue').includes('translateY(-3px)') && !read('/newtab/views/Workspace.vue').includes('.res-card:hover { border-color: var(--accent); box-shadow') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('P3 过渡统一 200ms 内', () => !read('/newtab/views/ProjectCuration.vue').includes('transform .26s') && read('/shared/styles/tokens.css').includes('font-feature-settings: "tnum"'));

console.log('【第廿七轮 · 身份与排版精修】');
check('R28/R49 信纸排版精修（衬线+留白，应用内+分享版；R49 调度台重写并加大行距留白）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 80px 64px') && read('/newtab/letter-data.ts').includes('padding: 96px 76px'));
check('R28 donge 哥身份（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R28 手册排版留白精修（三处同步）', () => read('/newtab/views/ManualPage.vue').includes('padding: 36px 44px') && read('/newtab/views/GlobalSettings.vue').includes('padding: 34px 40px') && read('/newtab/manual-data.ts').includes('padding: 38px 46px'));

console.log('【第廿六轮 · 信件身份与排版精修】');
check('R26-1 donge 哥身份融入（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R26-2/R49 信纸与手册排版留白精修（信纸参数 R49 更新）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 80px 64px') && read('/newtab/views/ManualPage.vue').includes('padding: 36px 44px') && read('/newtab/manual-data.ts').includes('padding: 38px 46px'));

console.log('【第廿五轮 · 手册分享/信件/深链】');
check('R25-1（R160-A7 重指）手册入口新标签页打开（深链在全路由保留下自然保留）', () => read('/newtab/main.ts').includes('R160（A7）深链保全') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab'));
check('R25-2 手册下载分享（独立 HTML）', () => read('/newtab/views/ManualPage.vue').includes('buildManualStandaloneHtml') && read('/newtab/manual-data.ts').includes('buildManualStandaloneHtml'));
check('R25-3 一封信全文（donge 哥署名）+ 下载分享', () => read('/newtab/letter-data.ts').includes('buildLetterStandaloneHtml') && read('/newtab/letter-data.ts').includes('donge') && read('/newtab/views/GlobalSettings.vue').includes('downloadLetter') && !read('/newtab/views/GlobalSettings.vue').includes('信件全文即将送达'));

console.log('【第廿四轮 · 选采可见字段】');
check('R24-1 采集弹窗可见来源字段（链接+标题，可编辑）', () => read('/content/search-overlay.ts').includes('__zy_cur_url__') && read('/content/search-overlay.ts').includes('__zy_cur_srctitle__') && read('/newtab/components/GlobalPopups.vue').includes('v-model="curioForm.sourceUrl"'));
check('R24-2 多选区兜底读取', () => read('/content/search-overlay.ts').includes('sel.rangeCount') && read('/content/search-overlay.ts').includes('getRangeAt(i).toString()'));
check('R24-3 保存从弹窗字段读取来源', () => read('/content/search-overlay.ts').includes('srcUrlInput') && read('/content/search-overlay.ts').includes('sourceTitle: srcTitleInput'));

console.log('【第廿三轮 · 选采加固】');
check('R23-1 all_frames + file 匹配（iframe 选区覆盖）', () => read('/manifest.ts').includes('all_frames: true') && read('/manifest.ts').includes("'file://*/*'"));
check('R23-2 子框选区转发 + 顶层汇聚 + 顶层守卫', () => read('/content/search-overlay.ts').includes('__zy_sel') && read('/content/search-overlay.ts').includes('IS_TOP') && read('/content/search-overlay.ts').includes('if (!IS_TOP) return'));
check('R23-3 缓存优先选区 + mouseup/keyup 立即捕获', () => read('/content/search-overlay.ts').includes('return selCache.text || getSelectionText()') && read('/content/search-overlay.ts').includes("document.addEventListener('mouseup', captureSel, true"));
check('R23-4 popup 降级好奇心接入来源 prefill', () => read('/popup/App.vue').includes('curioSource'));

console.log('【第廿二轮 · 拖拽根修二段】');
check('R22 好奇 store 去虚拟排序（拖拽根修二段）', () => !read('/newtab/stores/curiosity.ts').includes('sort((a, b) => (b.createdAt'));

console.log('【第廿一轮 · 修复验收】');
check('R21-1 好奇心选采预取缓存', () => read('/content/search-overlay.ts').includes('selCache') && read('/content/search-overlay.ts').includes('function resolveSelection'));
check('R21-2 拖拽位置感知全落点（好奇列表/看板 + 任务分组行/看板 + 资源看板）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes("const after = dropMark.value.endsWith('-b')") && read('/newtab/components/compass/TaskManagerPanel.vue').includes("markTaskDrop($event, task.id)") && read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskCardDrop') && read('/newtab/views/Workspace.vue').includes("markDrop($event, r.id, 'y')"));
check('R21-3/R49 页面对齐（方向台/调度台统一页边距 max-width 1440）★R175 重指带备案：调度台 .page 顶/底距随原型改 18px/72px（左右 36px 与顶栏 align-page 同线不变），方向台仍 20px 顶距', () => read('/newtab/views/CompassShell.vue').includes('padding: 20px 36px 64px') && read('/newtab/views/CompassHome.vue').includes('padding: 18px 36px 72px'));
check('R21-4 手册独立页（/manual 路由 + 目录锚点 + 富文本非 scoped）', () => read('/newtab/router.ts').includes("path: '/manual'") && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-tip') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab'));

console.log('【第十九~二十轮 · 拼音搜索/拖拽修复/手册白皮书】');
check('R19（R160 重指）拼音/首字母搜索（两端）：两层表实现（INITIALS/FULLS）+ 两入口 matchPinyin', () => read('/shared/utils/pinyin.ts').includes('INITIALS') && read('/shared/utils/pinyin.ts').includes('FULLS') && read('/shared/utils/pinyin.ts').includes('export function matchPinyin') && read('/newtab/components/GlobalPopups.vue').includes('matchPinyin') && read('/content/search-overlay.ts').includes('matchPinyin'));
check('R20a 拖拽失效修复（去虚拟置顶排序；物理置顶已于第卅三轮 R33-1 改为独立分区）', () => !read('/newtab/views/CompassHome.vue').includes('置顶任务优先（稳定排序') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('第十七轮：置顶优先'));
// 第卅三轮 R33-1：BUG-D 修复 —— 物理 unshift 会破坏手动拖拽排序，置顶改独立分区（R20a 旧断言随行为变更同步更新）
check('R33-1 BUG-D 任务置顶独立分区（不再物理 unshift 源数组）', () => !read('/newtab/components/compass/TaskManagerPanel.vue').includes('置顶动作物理移到列表顶部') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('pinnedTasks') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('normalTasks') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('📌 置顶 · {{ pinnedTasks.length }}'));
check('R20b 使用手册五篇重写（外置数据源）', () => read('/newtab/manual-data.ts').includes('速览 · 一页上手') && read('/newtab/manual-data.ts').includes('理念篇 · 知源哲学') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab') && read('/newtab/views/ManualPage.vue').includes("from '../manual-data'") && read('/newtab/router.ts').includes("'/manual'"));

console.log('【第十八轮 · 交互视觉全面优化】');
check('A1/A2 图标体系 + EmptyState 组件', () => read('/shared/components/Icon.vue').includes('download') && read('/shared/components/EmptyState.vue').includes('es-art') && read('/shared/components/ModuleCard.vue').includes('iconName'));
check('A3~A10 全局形态（徽章/滚动条/负字距/等宽/焦点环）', () => read('/shared/styles/tokens.css').includes('body .tag, body .rc-tag') && read('/shared/styles/tokens.css').includes('font-variant-numeric: tabular-nums') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('B1 命令面板升级（分组/高亮/快捷操作/最近）', () => read('/newtab/components/GlobalPopups.vue').includes('groupedResults') && read('/newtab/components/GlobalPopups.vue').includes('QUICK_ACTIONS') && read('/newtab/components/GlobalPopups.vue').includes('hlTitle') && read('/content/search-overlay.ts').includes('QUICK_ACTIONS_ZY'));
check('B2 删除可撤销（Toast 全局单例统一 3s，REQ-030 收敛）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 3000') && read('/newtab/App.vue').includes('<Toast />') && read('/newtab/views/Workspace.vue').includes("label: '撤销'") && read('/shared/components/Toast.vue').includes('toastState') && !read('/newtab/views/Workspace.vue').includes('runToastAction') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast'));
check('B3 快捷键速查面板（? 呼出）', () => read('/newtab/components/GlobalPopups.vue').includes('SHORTCUT_GROUPS') && read('/newtab/App.vue').includes("e.key === '?'"));
check('B4/B9 键盘导航（任务列表 + 日期）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskNavKey') && read('/newtab/views/CompassHome.vue').includes('onDateKey'));
check('B5 统一右键菜单（三卡）', () => read('/shared/components/ContextMenu.vue').includes('cx-item') && read('/newtab/views/Workspace.vue').includes('openResCtx') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('openTaskCtx') && read('/newtab/components/compass/CuriosityPanel.vue').includes('openCurioCtx'));
check('B6 拖拽插入线', () => read('/newtab/views/Workspace.vue').includes('drop-line-t') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('drop-line-t') && read('/newtab/components/compass/CuriosityPanel.vue').includes('drop-line-t'));
check('B7 抽屉宽度记忆', () => read('/shared/models/index.ts').includes('drawerWs') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('startDrawerResize'));
check('B8/B10/B11 焦点返还/列头sticky/加载态', () => read('/newtab/components/GlobalPopups.vue').includes('lastFocused') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('.khead { position: sticky;') && read('/newtab/views/CompassHome.vue').includes('exportBusy'));

console.log('【第十七轮 · 修复与功能补全】');
check('R17-1 三件事导出弹窗（时间范围+6字段 CSV）', () => read('/newtab/views/CompassHome.vue').includes('openExportModal') && read('/newtab/views/CompassHome.vue').includes('任务内容,所属项目,项目→成功指标,任务状态,安排时间,创建时间') && read('/newtab/views/CompassHome.vue').includes('doExport'));
check('R17-2 好奇心来源仅选中时附带（两端，可为空）', () => read('/newtab/components/GlobalPopups.vue').includes("if (sel) {") && read('/content/search-overlay.ts').includes('const hasSel = !!selection'));
check('R17-3 项目策展创建项目（视觉链+选战略目标+直接进展板）', () => read('/newtab/views/ProjectCuration.vue').includes('openCreateProject') && read('/newtab/views/ProjectCuration.vue').includes('confirmCreateProject') && read('/newtab/views/ProjectCuration.vue').includes('createDirId') && read('/newtab/views/ProjectCuration.vue').includes('cm-chain'));
check('R17-4/R49 主航线工具组在模块右上角（actions 插槽：展开收起/显隐/完整方向树入口）', () => read('/newtab/components/compass/LighthousePanel.vue').includes('<template #actions>') && read('/newtab/components/compass/LighthousePanel.vue').includes('mr-tools') && !read('/newtab/components/compass/LighthousePanel.vue').includes('lh-footer">'));
check('R17-5 置顶右上角统一（好奇三视图）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('cz-pin-corner') && read('/newtab/components/compass/CuriosityPanel.vue').includes('置顶优先'));
check('R17-6 任务卡置顶（模型+列表+看板+选取）', () => read('/shared/models/index.ts').includes('pinned?: boolean') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('toggleTaskPin') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('.k-pin') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('.t-pin'));

console.log('【第十三轮 · V2.2.0 正式版】');
check('V13-1 任务卡链接字段 + 单/双击统一', () => read('/shared/models/index.ts').includes('link?: string') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskRowDblClick') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('openCardLink'));
check('V13-2 任务抽屉链接+备注（可拖拽调高）', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('selectedTask.link') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('selectedTask.description') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('.ts-note {'));
check('V13-3 好奇心链接口径（sourceUrl+本地路径直达；R129-B5 起统一走 link.toOpenableRawLink）', () => { const cp = read('/newtab/components/compass/CuriosityPanel.vue'); return cp.includes('toOpenableRawLink') && !cp.includes('function toOpenableCurioLink') && cp.includes('来源链接（网页 / 本地路径 / obsidian://，失焦即保存）'); });
check('V13-4 文本框可拖拽调高（三卡详情）· R167 重指：资源表单的 `.ref-note` 搬进 ds-* 面板成 `.ds-hero-note`，判据跟着换成「焦点区 + 拖拽把手 + 记忆 hook」三件同在（把手没了就是"调了不记"，比不调更气人）', () => { const f = read('/newtab/components/ResourceEditForm.vue'); return f.includes('ds-hero-note') && f.includes('ref-ta-resize') && f.includes('useTaHeight') && read('/newtab/components/compass/CuriosityPanel.vue').includes('max-height: 400px') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('max-height: 320px') });
check('V13-5 罗盘子页 out-in 过渡移除（切换即时）', () => !read('/newtab/views/CompassShell.vue').includes('mode="out-in"'));
check('V13-6 刷新骨架品牌动画保留（仅加载时）', () => read('/../src/newtab/index.html').includes('zy-skl'));

console.log('【第廿八轮 · 拖拽体系修复】');
check('R28-1 资源卡片/列表/看板可拖拽（draggable 修复，分区 v-for 单模板复用）', () => read('/newtab/views/Workspace.vue').split(':draggable="!batchMode"').length - 1 >= 4 && read('/newtab/views/Workspace.vue').includes('onDropCard($event,r)') && read('/newtab/views/Workspace.vue').includes('onKanbanCardDrop($event, r)'));
check('R28-1b 资源列表行插入线 CSS', () => read('/newtab/views/Workspace.vue').includes('.res-row.drop-line-t') && read('/newtab/views/Workspace.vue').includes('.res-row.drop-line-b'));
check('R28-2 任务看板跨列落卡=改状态（统一状态出口）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskCardDrop($event, task, groupByProject)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('setTaskStatusOf(moved, status)'));
check('R28-3 任务跨组落卡=改归属清指标（列表+看板）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskDrop(task, true)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('moved.metricId = undefined'));
check('R28-4 好奇看板跨列落卡=改状态 + 轴向修正', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCzDrop($event, c.id, col.status)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("axis === 'x'"));
check('R28-5 资源看板跨分类落卡=改分类', () => read('/newtab/views/Workspace.vue').includes("moved.categoryId = target.categoryId || ''"));
check('R28-6 展板任务拖拽 off-by-one 修复+落库', () => read('/newtab/views/ProjectCuration.vue').includes('const after = (e.clientY - rect.top) / rect.height > 0.5'));

console.log('【第廿九轮 · Tab排序/拖卡归档/信纸留白 · V2.9.0】');
check('R29-1 工作台 Tab 拖拽排序（插入线+order 全量规整落库）', () => read('/newtab/App.vue').includes('onWsTabDrop') && read('/newtab/App.vue').includes('wsDropMark') && read('/newtab/App.vue').includes('list.forEach((w, i) => { w.order = i })'));
check('R29-2 快捷键跟随位置（顺序即快捷键，自定义绑定移除）', () => read('/newtab/views/GlobalSettings.vue').includes('顺序即快捷键') && read('/newtab/App.vue').includes('switchToIndex') && !read('/newtab/views/GlobalSettings.vue').includes('setWsHotkey'));
check('R29-3 资源卡拖到侧栏分类改归属（三视图通用+待分类落点）', () => read('/newtab/views/Workspace.vue').includes('cardDropTarget') && read('/newtab/views/Workspace.vue').includes('onDropToCategory(e, cat.id)') && read('/newtab/views/Workspace.vue').includes("onDropToCategory(e, '')"));
check('R29-4 分类落点高亮（与分类拖拽指示区分）', () => read('/newtab/views/Workspace.vue').includes('.cat-item.card-drop'));
check('R29-5/R49 信纸明显留白（应用内+分享版同步；R49 行距 3.1）', () => read('/newtab/views/GlobalSettings.vue').includes('line-height: 3.1') && read('/newtab/letter-data.ts').includes('line-height: 3.1'));
check('R29-6（R65 修订）分类/标签名 URL 编码归一化（书签解析移交资源台）', () => read('/shared/storage/repository.ts').includes('safeDecodeText') && read('/shared/utils/index.ts').includes('export function safeDecodeText') && read('/newtab/composables/useWorkspaceImport.ts').includes('safeDecodeText(h3.textContent'));
check('R29-7 「升为一级」落点先取引用再清理（修拖拽状态自吞）', () => read('/newtab/views/Workspace.vue').includes('先取引用再清理状态'));

console.log('【第卅轮 · 信件模块化/书签导入分类树 · V2.10.0】');
check('R30-1 信件节头+停顿+信念行（应用内样式）', () => read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-h') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-turn') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-creed'));
check('R30-2 信件 HTML 模块化结构（两处渲染共享）', () => read('/newtab/letter-data.ts').includes('<p class="lp-h">') && read('/newtab/letter-data.ts').includes('<p class="lp-turn">') && read('/newtab/letter-data.ts').includes('<p class="lp-creed">'));
check('R30-3 分享版分节样式同构', () => read('/newtab/letter-data.ts').includes('.lp-body p.lp-h'));
check('R30-4（R73 修订；R100 重指：实现拆入 useWorkspaceImport，宿主保留绑定）书签文件夹→分类树（资源台 hub 分支承接：前 2 级建分类，同名同级复用）', () => { const imp = read('/newtab/composables/useWorkspaceImport.ts'); return imp.includes('ensureBookmarkCategory') && imp.includes('BK_ROOT_NAMES') && imp.includes('cat.parentId = parentId'); });
check('R30-5（R73 修订；R100 重指：实现拆入 useWorkspaceImport）第 3 级+并入标签（资源台 hub 分支承接）', () => { const imp = read('/newtab/composables/useWorkspaceImport.ts'); return imp.includes('segs.slice(2)') && !imp.includes("b.path.filter(p => p && p !== '书签栏')"); });

console.log('【第卅一轮 · 下钻抽屉重构/Esc修复/发版 · V2.11.0】');
check('R31-1 Drawer 组件 Esc 关闭（open 期间 document 级捕获）', () => read('/shared/components/Drawer.vue').includes("watch(() => props.open") && read('/shared/components/Drawer.vue').includes("document.addEventListener('keydown', onKey, true)"));
check('R31-2 模块分组下钻（第卌四轮退役：下排改今日增删卡，全景下钻移交设置页工作台全景）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('openWsPopup') && !s.includes('nd-ws-card') && s.includes("openDrawer('today-add')"); });
check('R31-3 链接卡片明细（第卌四轮退役：模块分组/链接卡片撤出北极星，计数树由工作台全景承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('groupedLinkCards') && !s.includes('allLinkCards') && s.includes('todayDelList'); });
check('R31-4 卡片行单击详情/双击打开（第卌四轮退役：wsPopup/卡片行随模块分组撤出，北极星仅剩指标抽屉）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('onCardRowClick') && !s.includes('resClickTimer') && s.includes('openDrawer'); });
check('R31-5 新建任务自动聚焦标题并全选', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes("document.querySelector('.ts-title')") && read('/newtab/components/compass/TaskManagerPanel.vue').includes('el.select()'));

console.log('【第卅二轮 · 十四需求包 · REQ-001~014】');
check('R32-1 REQ-001 战略目标层投射已移除（函数与字段三清）', () => !read('/newtab/views/CompassTree.vue').includes('toggleGoalProjection') && !read('/newtab/views/CompassTree.vue').includes('dir.pinnedToLighthouse') && !read('/shared/models/index.ts').split('interface Direction')[1].split('interface ')[0].includes('pinnedToLighthouse'));
check('R32-1b/R121（原型三列分支）树内投射开关全部退役 + 项目主攻按钮收进 hover 动作（onToggleFocus）', () => { const t = read('/newtab/views/CompassTree.vue'); return !t.includes('toggleVisionProjection') && !t.includes('toggleMissionProjection') && !t.includes('toggleProjProjection') && !t.includes('投射至') && t.includes('onToggleFocus(proj.id)') && t.includes('tp-acts') && t.includes('toggleFocusProject('); });
check('R32-1c（R64 修订）方向状态口径=战略目标数+推进中项目数（DHI 百分比退役）', () => { const c = read('/newtab/stores/compass.ts'); return c.includes('let pushing = 0') && c.includes('goals') && !c.includes('在轨项目 ÷ 主攻项目'); });
check('R32-2 REQ-003 方向树项目卡打开项目全景抽屉', () => read('/newtab/views/CompassTree.vue').includes('openProjectDrawer') && read('/newtab/views/CompassTree.vue').includes('ProjectDetailDrawer'));
check('R32-3 REQ-004 资源详情抽屉所属工作台字段+迁移反馈（R165-A 重指：策展台字段整体退役——表单零 wsOptions、composable 零迁移检测/迁移 toast，真身只在资源台）', () => { const f = read('/newtab/components/ResourceEditForm.vue'); const u = read('/newtab/composables/useResourceDrawer.ts'); const w = read('/newtab/views/Workspace.vue'); const r = read('/newtab/components/ResourceDetailDrawer.vue'); return !f.includes('wsOptions') && !f.includes('🗂 策展台') && !f.includes('onWsChange') && !u.includes('drawerOriginalWsId') && !u.includes('已保存并迁移至') && !w.includes('已保存并迁移至') && !r.includes('已保存并迁移至'); });
// R179-MIGRATED R32-4
// V3.7.0（R179）随迁重写：hub 分类退役后「分类随工作台联动」失去控件载体——分类行（CatPicker/catOptions）
// 整体下线，卡的组织机制由「标签」（TagPicker）独任；本断言转为守退役边界（负向须先剥注释，R166 纪律）。
check('R32-4 REQ-005 分类随工作台联动重置（V3.7.0 重指）：分类控件整体下线——表单零 select/CatPicker/catOptions，标签独任组织', () => { const f = codeOnly(read('/newtab/components/ResourceEditForm.vue')); return !f.includes('catOptions') && !f.includes('CatPicker') && !f.includes('<select') && f.includes('<TagPicker') && f.includes('model.tags'); });
check('R32-5 REQ-006 CSV 导出含更新时间列（第卌一轮 REQ-055 起改动态列：更新时间以固定管理尾列导出）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("{ label: '更新时间', get: r => (r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '') }"); });
check('R32-5b REQ-006 三卡详情面板时间戳可见（R48 起好奇心 meta 精简为「捕获/更新」双行）', () => read('/newtab/components/ResourceEditForm.vue').includes('fmtTs') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('fmtTaskTs') && read('/newtab/components/compass/CuriosityPanel.vue').includes('捕获') && read('/newtab/components/compass/CuriosityPanel.vue').includes('更新 '));
check('R32-6 REQ-007 排序偏好记忆（res/task/curio 三键）', () => read('/newtab/views/Workspace.vue').includes('sortPrefs?.res?.by') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('sortPrefs?.task?.by') && read('/newtab/components/compass/CuriosityPanel.vue').includes('sortPrefs?.curio?.dir'));
check('R32-6b REQ-007+bug 任务排序下拉此前未生效，已补排序逻辑', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes("if (sortBy.value !== 'manual')") && read('/newtab/components/compass/TaskManagerPanel.vue').includes("sortDir.value === 'asc' ? 1 : -1"));
check('R32-7 REQ-008 应用内搜索命中工作台实体', () => read('/newtab/components/GlobalPopups.vue').includes("type: 'ws'") && read('/newtab/components/GlobalPopups.vue').includes('策展台条目'));
check('R32-7b REQ-008 网页浮层搜索命中工作台实体', () => read('/content/search-overlay.ts').includes("type: 'ws'") && read('/content/search-overlay.ts').includes('策展台实体'));
/* V3.7.0（R179）随迁重写：资源卡定位落地调度台（3张卡），不再指向资源台 */
check('R32-8 REQ-009 搜索打开规则（V3.7.0 重指）：资源卡结果落地调度台（3张卡）+ content 端 ?hl 兼容旧深链', () => read('/newtab/components/GlobalPopups.vue').includes('资源卡在 3张卡中检索查看') && read('/newtab/router.ts').includes("path: '/curation'") && read('/newtab/router.ts').includes("redirect: () => ({ path: '/' })"));
check('R32-9 REQ-009 修复：文件类型卡片单击只弹 toast 不打开（旧 bug）', () => !read('/newtab/components/GlobalPopups.vue').includes('打开本地文件：${r.link}'));
check('R32-10 REQ-010 打开通道统一下沉 shared/utils/link（三处调用方迁移）', () => exists('/shared/utils/link.ts') && read('/newtab/views/Workspace.vue').includes("from '@/shared/utils/link'") && read('/newtab/components/compass/NorthStarPanel.vue').includes("from '@/shared/utils/link'") && read('/newtab/views/CompassTree.vue').includes("from '@/shared/utils/link'"));
check('R32-11 REQ-012 关联卡片 chips 双击打开链接（含 WRR 计数口径统一）', () => read('/newtab/views/CompassTree.vue').includes("openChipLink('res', rid)") && read('/newtab/views/CompassTree.vue').includes("openChipLink('curio', cid)") && read('/newtab/views/CompassTree.vue').includes('recordResourceOpen(d.value, r)'));
check('R32-12 REQ-013/014 模块分组下钻（第卌四轮退役：二级/三级下钻随 wsPopup 移除，由设置页工作台全景承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('wsPopupLevel') && !s.includes('wsPopupCats') && s.includes("type DrawerType = 'dhi' | 'wce' | 'wrr' | 'today-add' | 'today-del' | 'tasks'"); });
check('R32-13 recordResourceOpen 下沉 shared/storage/stats（应用端统一引用）', () => exists('/shared/storage/stats.ts') && read('/newtab/views/Workspace.vue').includes("from '@/shared/storage/stats'") && read('/newtab/components/GlobalPopups.vue').includes("from '@/shared/storage/stats'"));
check('R32-14 REQ-002 项目层级＋=加指标 / 指标条目＋=加任务（职责单一，防回归）', () => read('/newtab/views/CompassTree.vue').includes('addMetric(proj.id)') && read('/newtab/views/CompassTree.vue').includes('openTaskAdd(metric.id, proj.id)'));
check('R32-15 REQ-011（R59-T4 修订）关联卡片选择器升级为居中弹窗（实时关键词+拼音过滤、资源/好奇分区、计数徽标、勾选即存）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('lm-mask') && t.includes('lm-search') && t.includes('link-count') && t.includes('function linkCandidates') && t.includes('toggleLinked'); });
check('R32-16 REQ-007 三视图均提供排序方向切换按钮', () => read('/newtab/views/Workspace.vue').includes('toggleSortDir') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('toggleSortDir') && read('/newtab/components/compass/CuriosityPanel.vue').includes('toggleSortDir'));
check('R32-17 REQ-008 工作台实体进入搜索类型 Tab 与分组计数（双端）', () => read('/content/search-overlay.ts').includes("key: 'ws'") && read('/content/search-overlay.ts').includes("label: '🗂 策展台'") && read('/newtab/components/GlobalPopups.vue').includes("{ type: 'ws', label: '🗂 策展台' }"));

console.log('【第卅三轮 · V2.12 需求包第一批：模型/Bug · REQ-023 + BUG-A~D】');
check('R33-2 REQ-023 星标字段 starred（CardBase 一份 + 卡 extends，零迁移；V3.7.0 备案：三卡 → 四卡，+论证节点卡 ArgumentCard）', () => read('/shared/models/index.ts').split('export interface CardBase').length - 1 >= 1 && read('/shared/models/index.ts').split('extends CardBase').length - 1 === 4 && read('/shared/models/index.ts').includes('starred?: boolean'));
check('R33-2b REQ-023 导出 CSV 补置顶/星标两列（第卌一轮 REQ-055 资源改固定管理尾列；任务 CSV 仍含两列）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const t = read('/newtab/views/CompassHome.vue'); return g.includes("{ label: '置顶', get: r => (r.pinned ? '是' : '') }") && g.includes("{ label: '星标', get: r => (r.starred ? '是' : '') }") && t.includes("t?.pinned ? '是' : ''") && t.includes("t?.starred ? '是' : ''"); });
check('R33-3 BUG-A 好奇置顶分组错位修复（置顶卡前置 + 组内 sortOrder/时间序）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("from '@/shared/utils/marksort'"));
check('R33-4 BUG-B Ctrl+Enter 口径统一（采集浮层标题/链接去除裸 Enter 保存）', () => !read('/newtab/components/GlobalPopups.vue').includes('@keydown.enter.prevent="saveCapture"') && read('/newtab/components/GlobalPopups.vue').includes('💾 保存（Ctrl+Enter）'));
check('R33-5 BUG-C 新建子分类死代码修复（父级 hover ＋ 传 parentId，弹窗父级提示可达）', () => read('/newtab/views/Workspace.vue').includes('openCreateCat(sc.cat.id)') && read('/newtab/views/Workspace.vue').includes('title="创建子分类"'));

console.log('【第卅三轮 · V2.12 需求包第二批：标记体系 · REQ-019/020】');
check('R33-6 REQ-019 搜索结果行星标按钮替换编辑（三类型均有）', () => read('/newtab/components/GlobalPopups.vue').includes('toggleStar(item)') && !read('/newtab/components/GlobalPopups.vue').includes('title="编辑" @click.stop="editItem(item)"'));
check('R33-6b REQ-019 搜索结果排序加权（置顶>星标>命中度，双端同口径；R131-C2 起 newtab 侧改装饰-排序，权重口径不变）', () => read('/newtab/components/GlobalPopups.vue').includes('mr: markRank(r.raw as AnyCard)') && read('/newtab/components/GlobalPopups.vue').includes('const mr = b.mr - a.mr') && read('/content/search-overlay.ts').includes('x.raw.pinned ? 2 : x.raw.starred ? 1 : 0'));
check('R33-7 REQ-020 三视图星标入口齐备（资源/任务/好奇）', () => read('/newtab/views/Workspace.vue').includes('toggleStar(r)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('toggleTaskStar(t)') && read('/newtab/components/compass/CuriosityPanel.vue').includes('toggleStar(c.id)'));
check('R33-7b REQ-020 置顶独立分区三视图一致（资源已改分组分区，任务已分区，好奇 markRank 分区前置）', () => read('/newtab/views/Workspace.vue').includes('resourceGroups') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('pinnedTasks') && read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)'));
check('R33-8 REQ-020 星标卡图标呈现（看板/列表/卡片角标）', () => read('/newtab/views/Workspace.vue').includes('kc-star') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('k-star') && read('/newtab/components/compass/CuriosityPanel.vue').includes('cz-star-corner'));
check('R33-9 REQ-020 双标记独立可叠加（置顶卡不因星标降级）', () => read('/shared/utils/marksort.ts').includes('if (c.pinned) return 2') && read('/shared/utils/marksort.ts').includes('if (c.starred) return 1'));

console.log('【第卅三轮 · V2.12 需求包第三批：交互补齐 · REQ-015/017/024】');
check('R33-10 REQ-015 三卡抽屉 Ctrl+Enter 保存统一（资源标题/好奇/任务 Toast）', () => read('/newtab/components/ResourceEditForm.vue').split('emit(\'save\')').length >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').includes('@keydown.ctrl.enter.prevent="saveDetail"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('detailId.value = null') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes("showToast('✓ 已保存')"));
check('R33-11 REQ-017 关联卡片卡片化（lc-ico/lc-text 两行截断，非胶囊）', () => read('/newtab/views/CompassTree.vue').includes('lc-ico') && read('/newtab/views/CompassTree.vue').includes('-webkit-line-clamp: 2') && read('/newtab/views/CompassTree.vue').includes('border-radius: var(--radius-sm)'));
check('R33-12 REQ-024 文本框高度记忆（UIPrefs.taHeights + 三组件接线）', () => read('/shared/models/index.ts').includes('taHeights?: Record<string, number>') && read('/shared/utils/taHeight.ts').includes('saveUIPrefs') && read('/newtab/components/ResourceEditForm.vue').includes("useTaHeight(props.heightKey") && read('/newtab/views/Workspace.vue').includes('height-key="ws-note"') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes("useTaHeight('task-note'") && read('/newtab/components/compass/CuriosityPanel.vue').includes("useTaHeight('curio-detail'"));
check('R33-12b REQ-024 默认高度加大（180px 起步 + 拖拽手柄三处）', () => read('/shared/utils/taHeight.ts').includes('def = 180') && read('/newtab/components/ResourceEditForm.vue').includes('.ref-ta-resize') && read('/newtab/components/compass/TaskDetailDrawer.vue').split('.ta-resize').length >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').split('.ta-resize').length >= 2);

console.log('【第卅三轮 · V2.12 需求包第四批：结构改造 · REQ-016/018/021/022】');
check('R33-13 REQ-016 共享任务添加抽屉（新建/关联双 Tab + Ctrl+Enter）', () => read('/newtab/components/TaskAddDrawer.vue').includes("tab === 'create'") && read('/newtab/components/TaskAddDrawer.vue').includes("tab === 'link'") && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="createTask"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="linkTasks"'));
check('R33-13b REQ-016 三处入口统一接入抽屉（罗盘树/项目策展/项目抽屉）', () => read('/newtab/views/CompassTree.vue').includes('openTaskAdd(metric.id, proj.id)') && read('/newtab/views/ProjectCuration.vue').includes('openTaskAdd(m)') && read('/newtab/components/ProjectDetailDrawer.vue').includes('openTaskAdd(m.id)') && read('/newtab/views/CompassTree.vue').includes('TaskAddDrawer') && read('/newtab/views/ProjectCuration.vue').includes('TaskAddDrawer') && read('/newtab/components/ProjectDetailDrawer.vue').includes('TaskAddDrawer'));
check('R33-13c REQ-016 关联任务同步写入 metricId 与 taskIds（转移归属防多挂）', () => read('/newtab/components/TaskAddDrawer.vue').includes('t.metricId = props.metricId') && read('/newtab/components/TaskAddDrawer.vue').includes('m.taskIds.filter(id => !ids.includes(id))') && read('/newtab/components/TaskAddDrawer.vue').includes('m.taskIds.push(id)'));
check('R33-14 REQ-018 删除免二次确认（四组件删除类 confirm 移除，非删除类保留）', () => !read('/newtab/views/Workspace.vue').includes('删除后可在回收站恢复') && !read('/newtab/views/CompassHome.vue').includes('删除后可在回收站恢复') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('确定删除这条好奇心') && !read('/newtab/views/ProjectCuration.vue').includes('确定删除该任务') && read('/newtab/composables/useWorkspaceBatch.ts').includes("danger: false"));
check('R33-14b REQ-018 回收站页面（路由 + 恢复 + 永久删除 + 分区清空）', () => read('/newtab/router.ts').includes("'/recycle'") && read('/newtab/views/RecycleBin.vue').includes('restoreTask') && read('/newtab/views/RecycleBin.vue').includes('purgeTask') && read('/newtab/views/RecycleBin.vue').includes('purgeAll'));
check('R33-14c REQ-018 回收站入口在设置页危险操作区', () => read('/newtab/views/GlobalSettings.vue').includes("router.push('/recycle')"));
check('R33-15 REQ-021 分类同名即时校验（R104 重指：实现拆入 useCategoryCrud，标红样式留宿主；R141 备案：弹窗只管新建，行内改名在 commitCatRename 里同口径查重）', () => read('/newtab/composables/useCategoryCrud.ts').includes('const catNameDup') && read('/newtab/composables/useCategoryCrud.ts').includes('c.name === name && c.id !== cat.id') && read('/newtab/views/Workspace.vue').includes('.ws-modal-input.dup') && read('/newtab/composables/useCategoryCrud.ts').includes('该策展台已存在同名分类，请更换名称'));
check('R33-15b REQ-021 存量重复分类合并工具（R104 重指：实现拆入 useCategoryCrud，入口样式留宿主）', () => read('/newtab/composables/useCategoryCrud.ts').includes('async function mergeDupCats') && read('/newtab/composables/useCategoryCrud.ts').includes('r.categoryId = keep.id') && read('/newtab/composables/useCategoryCrud.ts').includes('k.parentId = undefined') && read('/newtab/views/Workspace.vue').includes('class="cat-merge"'));

console.log('【第卅三轮 · V2.12 需求包第五批：视图与布局 · REQ-025/026】');
check('R33-16 REQ-025 模块分组平铺（第卌四轮退役：北极星撤模块分组，平铺下钻由设置页工作台全景替代）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); return !s.includes('nd-flat-ws') && !s.includes('openWsPopup') && gs.includes('const panTree = computed'); });
check('R33-16b REQ-025 打开即卡片列表级（第卌四轮退役：openWsPopup 移除，卡片列表级由工作台全景右栏承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); return !s.includes('wsPopupLevel') && gs.includes('const panCards = computed'); });
check('R33-17 REQ-026 tokens spacing 令牌（卡片网格一处切换全局生效）', () => read('/shared/styles/tokens.css').includes('--card-pad-vert') && read('/shared/styles/tokens.css').includes('--card-gap') && read('/shared/styles/tokens.css').includes('--card-min-w') && read('/shared/styles/tokens.css').includes("[data-density='compact']"));
check('R33-17b REQ-026 密度档位交互（视图控制区 select + UIPrefs 记忆 + 卡片样式引用令牌）', () => read('/newtab/views/Workspace.vue').includes('v-model="density"') && read('/newtab/views/Workspace.vue').includes("store.ui?.density || 'cozy'") && read('/newtab/views/workspace.css').includes("[data-density='compact'] .res-row") && read('/shared/styles/tokens.css').includes('--card-min-w') && read('/newtab/main.ts').includes("setAttribute('data-density', 'compact')") && read('/shared/models/index.ts').includes("density?: 'compact' | 'cozy'"));

console.log('【第卅四轮 · V2.13 需求包第一批：REQ-030 撤销修复 + Toast 四套收敛】');
check('R34-1 REQ-030 资源卡撤销按 id 定位当前树（单删/抽屉删/批量删；R61 批量拆 natives）', () => read('/newtab/views/Workspace.vue').includes('d.value.resources.find(x => x.id === r.id)') && read('/newtab/views/Workspace.vue').includes('d.value.resources.find(x => x.id === editingResource.id)') && read('/newtab/views/Workspace.vue').includes('natives.forEach(r => {'));
check('R34-2 REQ-030 任务卡撤销按 id（单删 taskId + 批量删）+ 指标 taskIds 回填保留', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('d.value.tasks.find(x => x.id === taskId)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('removed.forEach(t => {') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('m.id === cur.metricId'));
check('R34-3 REQ-030 好奇心卡撤销按 id 定位当前树', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('d.value.curiosities.find(x => x.id === c.id)'));
check('R34-4 Toast 四套实现收敛为模块单例（toast.ts 统一 3s + App 全局唯一挂载）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 3000') && read('/newtab/App.vue').includes('<Toast />') && !read('/newtab/views/GlobalSettings.vue').includes('gs-toast') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast') && !read('/newtab/views/GlobalSettings.vue').includes('toastVisible'));
check('R34-5 各组件不再持有本地 Toast 实例（ref/showToast 残留清零）', () => !read('/newtab/views/Workspace.vue').includes('toastVisible') && !read('/newtab/views/CompassHome.vue').includes('toast.value') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('toast.value') && !read('/newtab/views/CompassTree.vue').includes('toast.value') && !read('/newtab/views/ProjectCuration.vue').includes('toast.value') && !read('/newtab/views/RecycleBin.vue').includes('toast.value') && !read('/newtab/components/TaskAddDrawer.vue').includes('toast.value'));

console.log('【第卅四轮 · V2.13 需求包第二批：REQ-027 分组分区视图 + 折叠增强】');
check('R34-6（R64 修订）卡片/列表分类分区：树状递归分组（walk 直属卡+子分类下钻 depth 缩进）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('const resourceGroups') && w.includes("title: '待分类'") && w.includes('walk(sub.id, sub.name, depth + 1)'); });
check('R34-7 F-027-4 分组标题折叠/展开（collapsedGroups 内存态 + v-show + 箭头切换）', () => read('/newtab/views/Workspace.vue').includes('const collapsedGroups') && read('/newtab/views/Workspace.vue').includes('toggleGroupCollapse') && read('/newtab/views/Workspace.vue').includes("v-show=\"!collapsedGroups.has(g.key)\"") && read('/newtab/views/Workspace.vue').includes("collapsedGroups.has(g.key) ? '▸' : '▾'"));
/* V3.7.0（R179）退役 R34-8：卡面分类全路径徽标随 hub 分类退役（池语义，卡面组织=标签）；原断言锚 catIdx.pathOf(r.categoryId) 已改写并将于 R1-3 随分类树 UI 一并移除。 */
check('R34-9 REQ-027 分区标题样式与首分区标记（ws-cat-head + 折叠箭头）', () => read('/newtab/views/Workspace.vue').includes('ws-cat-head') && read('/newtab/views/Workspace.vue').includes('ws-cat-collapse') && read('/newtab/views/Workspace.vue').includes('{first: gi===0, sub: g.depth>0}'));

console.log('【第卅四轮 · V2.13 需求包第三批：REQ-028 分组视图联动规范】');
check('R34-10 REQ-028 F-028-1 分区内置顶排序（applyGroupSort = applySort + marksort 稳定重排）', () => read('/newtab/views/Workspace.vue').includes('function applyGroupSort') && read('/newtab/views/Workspace.vue').includes('markRank(b) - markRank(a)') && read('/newtab/views/Workspace.vue').includes("import { markRank }") && read('/newtab/views/Workspace.vue').split('applyGroupSort(').length - 1 >= 2);
check('R34-11 REQ-028 F-028-3 拖拽分区边界（跨分区改分类归属 + 轻提示；同分区局部排序）', () => read('/newtab/views/Workspace.vue').includes('function groupKeyOf') && read('/newtab/views/Workspace.vue').includes('crossGroup') && read('/newtab/views/Workspace.vue').includes('catChanged') && read('/newtab/views/Workspace.vue').includes('已移动至「'));
check('R34-12（R64 修订）子分类组标题弱化样式（ws-cat-head.sub），徽标不隐藏', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('.ws-cat-head.sub span') && !w.includes('.rc-cat.hidden'); });
check('R34-13 REQ-028 F-028-4 列表视图共用分区拖拽规则（res-row @drop 绑定 onDropCard）', () => read('/newtab/views/Workspace.vue').includes('onDropCard($event,r)') && read('/newtab/views/Workspace.vue').split('onDropCard($event,r)').length - 1 >= 2);

console.log('【第卅四轮 · V2.13 需求包第四批：REQ-029 罗盘按需引导】');
check('R34-14 REQ-029 F-029-1 侧栏常驻三行文案移除（side-note 无残留）', () => !read('/newtab/views/CompassShell.vue').includes('side-note') && !read('/newtab/views/CompassShell.vue').includes('方向树给「为什么」'));
check('R34-15 退役（R49 方向台撤侧栏，气泡引导随撤）+ 无残留', () => !read('/newtab/views/CompassShell.vue').includes('guide-bubble') && !read('/newtab/views/CompassShell.vue').includes('zy_compass_guide_v1'));
check('R49 方向台满宽模块化（R117 重写）：「主航线 → 项目详情」两模块（原 R55 三模块中「项目总览」「任务调度」已退役/迁出；侧栏与 MetricBar 零残留）', () => { const s = read('/newtab/views/CompassShell.vue'); return s.includes('方向台') && s.includes('LighthousePanel') && s.includes('<ProjectCuration embedded />') && !s.includes('ov-grid') && !s.includes('TaskManagerPanel') && !s.includes('comp-sidebar') && !s.includes('MetricBar'); });

console.log('【第卅四轮 · V2.13 需求包第五批：REQ-031 系统性能调优】');
check('R34-17 REQ-031 P-031-1 搜索关联 Map 化（buildSearchMaps 一次遍历 + collectResults O(1) 查找 + 卡数累加）', () => read('/content/search-overlay.ts').includes('function buildSearchMaps') && read('/content/search-overlay.ts').includes('maps.wsName.get(r.workspaceId)') && read('/content/search-overlay.ts').includes('maps.projName.get(t.projectId)') && read('/content/search-overlay.ts').includes('maps.wsCount.get(w.id)'));
check('R34-18 REQ-031 P-031-2 结果分组一次遍历归桶（buckets 数组替代 filter+indexOf 嵌套）', () => read('/content/search-overlay.ts').includes("const buckets: Record<string, any[]>") && read('/content/search-overlay.ts').includes('buckets[r.type]') && read('/content/search-overlay.ts').includes('shown.forEach(function (item: any, j: number)') && read('/content/search-overlay.ts').includes('const i = offset + j'));
check('R34-19 REQ-031 P-031-3 计数缓存 + Tab DOM 按需重建（countCache 仅数据变更失效，searchType 不变只更计数）', () => read('/content/search-overlay.ts').includes('function invalidateCountCache') && read('/content/search-overlay.ts').includes('function computeCounts') && read('/content/search-overlay.ts').includes("tabs.getAttribute('data-search-type')") && read('/content/search-overlay.ts').includes('invalidateCountCache()'));
check('R34-20 REQ-031 P-031-4 escapeHtml 正则化（createElement → 正则白名单替换）', () => read('/content/search-overlay.ts').includes("String(s ?? '')\n    .replace(/&/g, '&amp;')") && !read('/content/search-overlay.ts').includes("const div = document.createElement('div')\n  div.textContent = s"));
check('R34-21 REQ-031 P-031-5 应用内搜索 150ms 防抖（debouncedQuery 驱动过滤，输入框即时回显）', () => read('/newtab/views/Workspace.vue').includes('const debouncedQuery = ref') && read('/newtab/views/Workspace.vue').includes('searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)') && read('/newtab/views/Workspace.vue').includes('if (debouncedQuery.value.trim())'));
check('R34-22 REQ-031 P-031-6 onChanged 自身写入跳过（R131-C1a 起改载荷 __wid O(1) 判定；R128-A1 统一接线不变）', () => read('/shared/storage/repository.ts').includes('__wid === lastSelfWriteId') && read('/shared/storage/repository.ts').includes('export function isSelfWrite') && read('/shared/storage/repository.ts').includes('if (ext && !isSelfWrite(ext))'));
check('R34-23 REQ-031 P-031-7 定位并行化（Promise.all 并行询问 + 150ms 短超时取首个命中）', () => read('/background/index.ts').includes('await Promise.all(tabs.map') && read('/background/index.ts').includes('askRoute(tab.id, 150)') && read('/background/index.ts').includes('hits.find((t) => t !== null)'));
check('R34-24 REQ-031 P-031-8 采集去重 Map 化（capUrlMap 打开时构建一次 + 保存 O(1) 查重 + 增量写入）', () => read('/content/search-overlay.ts').includes('let capUrlMap: Map<string, any> | null = null') && read('/content/search-overlay.ts').includes('capUrlMap?.get(fp)') && read('/content/search-overlay.ts').includes('capUrlMap.set(nfp, resource)'));

console.log('【第卅五轮 · V2.14 需求包第一批：REQ-034 任务重复项修复】');
check('R35-1 REQ-034 根因：移除裸 Enter 双重 keydown（仅 ctrl/meta 触发一次保存）', () => !read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.enter.prevent="createTask"') && !read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.enter.prevent="linkTasks"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="createTask" @keydown.meta.enter.prevent="createTask"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="linkTasks" @keydown.meta.enter.prevent="linkTasks"'));
check('R35-2 REQ-034 提交锁防重复触发（createTask/linkTasks creating/linking 标志 + finally 解锁）', () => read('/newtab/components/TaskAddDrawer.vue').includes('if (creating) return') && read('/newtab/components/TaskAddDrawer.vue').includes('if (linking) return') && read('/newtab/components/TaskAddDrawer.vue').includes('creating = true') && read('/newtab/components/TaskAddDrawer.vue').includes('finally {'));
check('R35-3 REQ-034 渲染侧按 id 去重双保险（三处 tasksForMetric seen 集合）', () => read('/newtab/views/CompassTree.vue').includes('seen.has(t.id)') && read('/newtab/views/ProjectCuration.vue').includes('seen.has(t.id)') && read('/newtab/components/ProjectDetailDrawer.vue').includes('seen.has(t.id)'));

console.log('【第卅五轮 · V2.14 需求包第二批：REQ-035 好奇心排序持久化】');
check('R35-4 REQ-035 模型新增 sortOrder 字段（CuriosityCard 拖拽排序持久化载体）', () => read('/shared/models/index.ts').includes('sortOrder?: number') && read('/shared/models/index.ts').includes('第卅五轮 REQ-035'));
check('R35-5 REQ-035 渲染管道 sortOrder 优先 createdAt 回退（filtered + kanbanCols 同口径）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('Number.MAX_SAFE_INTEGER') && read('/newtab/components/compass/CuriosityPanel.vue').split('Number.MAX_SAFE_INTEGER').length - 1 >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)'));
check('R35-6 REQ-035 拖拽落位后全量重写 sortOrder（排序拖拽固化，跨列改状态不重写）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('if (!status)') && read('/newtab/components/compass/CuriosityPanel.vue').includes('list.forEach((c, i) => { c.sortOrder = i })'));

console.log('【第卅五轮 · V2.14 需求包第三批：REQ-032 直属未细分资源置顶】');
check('R35-7（R64 修订）直属卡先于子分类组（walk 内 direct push 在子分类递归之前）', () => { const src = read('/newtab/views/Workspace.vue'); const a = src.indexOf('if (direct.length) groups.push'); const b = src.indexOf('walk(sub.id, sub.name, depth + 1)'); return a >= 0 && b >= 0 && a < b; });

console.log('【第卅五轮 · V2.14 需求包第四批：REQ-036 任务状态筛选器】');
check('R35-8 REQ-036 模型 sortPrefs 扩展 filter 字段（状态筛选偏好持久化载体）', () => read('/shared/models/index.ts').includes("dir?: 'asc' | 'desc'; filter?: string"));
check('R35-9（R110 重指）REQ-036 状态筛选四枚举（全部/待办/推进中/已完成，移除高优先级与 today 混入）——R110 起过滤管线收敛到 applyTaskFilters', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('type TaskFilter') && read('/newtab/components/compass/TaskManagerPanel.vue').includes("else if (filterBy.value !== 'all') out = out.filter(t => t.status === filterBy.value)") && !read('/newtab/components/compass/TaskManagerPanel.vue').includes("filterBy.value === 'high'") && !read('/newtab/components/compass/TaskManagerPanel.vue').includes('option value="high"') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('<option value="todo">待办</option>'));
check('R35-10 REQ-036 筛选偏好持久化（初始化读取 savedFilter + watch 写入 sortPrefs.task.filter，R45 迁至 TaskManagerPanel）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('const savedFilter = store.ui?.sortPrefs?.task?.filter') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('filter: filterBy.value'));

console.log('【第卅五轮 · V2.14 需求包第五批：REQ-033 北极星视觉重构】');
check('R35-11 REQ-033 底部冗余状态条彻底移除（ns-summary/summaryText 无残留）', () => !read('/newtab/components/compass/NorthStarPanel.vue').includes('ns-summary') && !read('/newtab/components/compass/NorthStarPanel.vue').includes('summaryText'));
check('R35-12 REQ-033 2×3 指标网格撑满对齐（grid-auto-rows:1fr + flex:1 + 卡片居中留白）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('grid-auto-rows: 1fr') && read('/newtab/components/compass/NorthStarPanel.vue').includes('justify-content: center'));

console.log('【第卅五轮 · V2.14 需求包第六批：REQ-037 浏览器快捷键新增「打开全局设置」命令】');
check('R35-13/R49-I1（R68 修订）manifest 命令：仅 description 不配 suggested_key；open-compass/open-resource 已退役，goto/采集系命令在位', () => { const m = read('/manifest.ts'); return !m.includes("'open-compass'") && !m.includes("'open-resource'") && m.includes("'open-settings'") && m.includes("'open-tasks'") && m.includes("'sync-airtable'") && m.includes("'goto-curiosity'") && m.includes("'goto-tasks'") && m.includes("description: '全局设置'"); });
check('R35-14 REQ-037 background 监听 open-settings（复用聚焦 + zy-route /settings；新建标签 #/settings 直达）', () => { const src = read('/background/index.ts'); return src.includes("case 'open-settings':") && src.includes("route: '/settings'") && src.includes("index.html#/settings"); });

// ============== 第卅六轮 · V2.14.1 数据持久化加固 + 全局搜索交互统一（REQ-038~041） ==============
console.log('【第卅六轮 · V2.14.1 第一批：REQ-038 数据持久化加固】');
check('R36-1 REQ-038-① unlimitedStorage 权限已申请', () => read('/manifest.ts').includes("'unlimitedStorage'"));
check('R36-2 REQ-038-② repository 保存失败告警（saveError bus + .catch 异常处理）', () => { const src = read('/shared/storage/repository.ts'); return src.includes('subscribeSaveError') && src.includes('errorListeners') && src.includes('.catch') && src.includes('SaveError'); });
check('R36-3 REQ-038-③ 容量水位显示（getBytesInUse + UI bytesInUse）', () => { const a = read('/shared/storage/repository.ts'); const b = read('/newtab/views/GlobalSettings.vue'); return a.includes('getBytesInUse') && b.includes('bytesInUse') && b.includes('formatBytes'); });
check('R36-4 REQ-038-③ unlimitedStorage 运行时检测 hasUnlimitedStorage', () => { const a = read('/shared/storage/repository.ts'); return a.includes('hasUnlimitedStorage') && a.includes('getManifest'); });
check('R36-5 REQ-038-④ 备份提醒 UI 偏好字段已建模（backupReminderEnabled / lastBackupAt）', () => { const src = read('/shared/models/index.ts'); return src.includes('backupReminderEnabled?') && src.includes('lastBackupAt?') && src.includes('backupReminderSnoozedAt?'); });
check('R36-6 REQ-038-④ 顶栏备份提醒红点（30 天未导出 或 容量 > 50MB[第卅八轮自 5MB 上调]，显示 .bell-dot）', () => { const src = read('/newtab/App.vue'); return src.includes('backupReminderDot') && src.includes('BACKUP_REMIND_DAYS = 30') && src.includes('BACKUP_REMIND_BYTES = 50 * 1024 * 1024') && src.includes('bell-dot'); });
check('R36-7 REQ-038-④ 导出动作写入 lastBackupAt（markBackupNow 在四个 export 函数内）', () => { const src = read('/newtab/views/GlobalSettings.vue'); return src.includes('function markBackupNow') && (src.match(/markBackupNow\(\)/g) || []).length >= 4; });
check('R36-8 REQ-038-② App.vue 订阅保存错误转发 Toast（R159：错误态带下一步动作）', () => { const src = read('/newtab/App.vue'); return src.includes('subscribeSaveError') && src.includes('数据保存失败'); });

console.log('【第卅六轮 · V2.14.1 第二批：REQ-039 全局搜索交互统一（P1 方案）】');
check('R36-9 REQ-039-① bus 极简事件中心（避免引入 mitt）', () => { const src = read('/shared/utils/bus.ts'); return src.includes('onOpenDrawer') && src.includes('emitOpenDrawer') && src.includes('DrawerPayload'); });
check('R36-10 REQ-039-② ResourceDetailDrawer 存在且支持编辑保存（R37 升级覆盖只读断言）', () => { const src = read('/newtab/components/ResourceDetailDrawer.vue'); return src.includes('function save') && src.includes('store.persist'); });
check('R36-11 REQ-039-③ 任务卡接 kind=task 抽屉总线（R45 迁至 TaskManagerPanel）', () => { const src = read('/newtab/components/compass/TaskManagerPanel.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'task')"); });
check('R36-12 REQ-039-③ CuriosityPanel 接 kind=curio 抽屉总线', () => { const src = read('/newtab/components/compass/CuriosityPanel.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'curio')"); });
check('R36-13 REQ-039-③ CompassTree 接 kind=project 抽屉总线', () => { const src = read('/newtab/views/CompassTree.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'project')"); });
check('R36-14 REQ-039-① App.vue zy-route 监听扩展 drawer 参数', () => { const src = read('/newtab/App.vue'); return src.includes("msg?.type === 'zy-route'") && src.includes('emitOpenDrawer(msg.drawer)') && src.includes('msg.drawer'); });
check("R36-15 REQ-039-④ content script 单击/双击分离（openSearchLocator + 双击走原 openSearchResult）", () => { const src = read('/content/search-overlay.ts'); return src.includes('function openSearchLocator') && src.includes("addEventListener('dblclick'") && src.includes('title = '); });
check('R36-16/R120 GlobalPopups 单击=开链（pickRow→openLinkOrLocate）+ Ctrl+Enter=仅定位（runFlatLocator→locateOnly）+ 结果行不再绑双击', () => { const src = read('/newtab/components/GlobalPopups.vue'); return src.includes('function runFlatLocator') && src.includes('@click="pickRow(item, $event)"') && src.includes('if (ev && (ev.ctrlKey || ev.metaKey)) { locateOnly(item); return }') /* R152 备案：pickRow 加了第二参承载鼠标事件，Ctrl/⌘+单击与 Ctrl+Enter 同义 */ && !src.includes('@dblclick="pickRow(item)"') && !src.includes('@dblclick="selectItem(item)"'); });
check('R36-17 REQ-039 Enter 键走开链接（Ctrl+Enter 走定位+抽屉，R38 固化后）', () => { const src = read('/newtab/components/GlobalPopups.vue'); return src.includes("if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)") && src.includes('else runFlat(selIndex.value)'); });

console.log('【第卅六轮 · V2.14.1 第三批：REQ-041 产品文案与对外呈现】');
check("R36-18 REQ-041-① README.md（GitHub 根）不再含 V3.1 演进对照", () => { const src = read('/../../README.md'); return !src.includes('V3.1') && !src.includes('演进对照') && !src.includes('回归 218/218') && !src.includes('V2.13.0'); });
check("R36-19 REQ-041-② v2/README.md 含产品定位与对位叙事（按 April Dunford 视角落地）", () => { const src = read('/../README.md'); return src.includes('个人资源调度台与认知增强系统') || src.includes('April Dunford'); });
check('R36-20 REQ-041-③ ManualPage 头部版本与当前版本一致', () => { const src = read('/newtab/views/ManualPage.vue'); return src.includes(CUR_VTAG); });
check("R36-21 REQ-041-① 根 README 按「是什么/给谁用/解决什么/如何解决」重写", () => { const src = read('/../../README.md'); return src.includes('## 它是什么') && src.includes('## 它给谁用') && src.includes('## 它解决什么问题') && src.includes('资源失血症'); });
check("R36-22 REQ-041-③ 使用手册「速览」篇新增定位与六动作（quick-1 / quick-2）", () => { const src = read('/newtab/manual-data.ts'); return src.includes("id: 'quick-1'") && src.includes("id: 'quick-2'") && src.includes('它是什么') && src.includes('六个核心动作'); });
check('R36-23 两份 README 的相对文档链接无死链（防止文档导航撒谎）', () => {
  const pairs = [['/../../README.md', path.resolve(base, '..', '..')], ['/../README.md', path.resolve(base, '..')]];
  let total = 0;
  for (const [rel, dir] of pairs) {
    const src = read(rel);
    const links = [...src.matchAll(/\]\((\.\/[^)]+?\.md)\)/g)].map((m) => m[1].replace(/^\.\//, ''));
    for (const l of links) { total++; if (!fs.existsSync(path.resolve(dir, l))) return false; }
  }
  return total >= 5;
});

// ============== 第卅七轮 · V2.14.2 抽屉可编辑 + 命名体系 + 定位文案（REQ-042~044） ==============
console.log('【第卅七轮 · V2.14.2 第一批：REQ-042 搜索抽屉升级（可编辑 + 共享 Drawer + 删除）】');
check('R37-1 REQ-042 ResourceDetailDrawer 改用共享 Drawer.vue 容器', () => { const s = read('/newtab/components/ResourceDetailDrawer.vue'); return s.includes("import Drawer from '@/shared/components/Drawer.vue'") && s.includes('<Drawer'); });
// R179-MIGRATED R37-2
// V3.7.0（R179）随迁重写：编辑表单契约重构后（R162/R165-A/R167 三连）判据对齐现状——
// 标题移抽屉头 DetailTitle（就地可编辑）；表单内三件套 = 链接三槽 / 标签 TagPicker / 描述。
check('R37-2 REQ-042 抽屉内嵌完整编辑表单（V3.7.0 重指：标题在抽屉头 DetailTitle + 表单三件套=链接三槽/标签/描述）', () => { const s = read('/newtab/components/ResourceDetailDrawer.vue'); const f = codeOnly(read('/newtab/components/ResourceEditForm.vue')); return s.includes('<DetailTitle') && s.includes('<ResourceEditForm') && s.includes('@update:model-value="editing.title = $event"') && f.includes('LINK_SLOT_TABS') && f.includes('<TagPicker') && f.includes('model.description'); });
check('R37-3 REQ-042 抽屉删除 = 软删 deletedAt + 撤销', () => { const s = read('/newtab/components/ResourceDetailDrawer.vue'); return s.includes('deletedAt = Date.now()') && s.includes("label: '撤销'") && s.includes('function remove'); });
check('R37-4 REQ-042 抽屉总线触发（onOpenDrawer kind=res）保留', () => { const s = read('/newtab/components/ResourceDetailDrawer.vue'); return s.includes('onOpenDrawer') && s.includes("p.kind !== 'res'"); });
console.log('【第卅七轮 · V2.14.2 第二批：REQ-043 命名体系（首页→知源罗盘 / 知源罗盘→知源引擎）】');
// R179-MIGRATED R37-5
// V3.7.0（R179）随迁重写：固定页签 = 调度台 / 方向台（资源台退役，收敛到调度台「3张卡」）
check('R37-5/R50-F3 导航 Tab（V3.7.0 重指：读码区剥注释＋/curation 残留负向）：首页→调度台、方向台两固定页签；资源台页签退役', () => { const s = codeOnly(read('/newtab/App.vue')); return s.includes('>调度台') && s.includes('>方向台') && !s.includes('>资源台') && !s.includes('taskBadge') && !s.includes('/curation'); });
check('R37-6/R49 路由 meta：home=调度台、compass 二级页=项目详情/完整方向树、旧 actions 重定向 /', () => { const s = read('/newtab/router.ts'); return s.includes("title: '知源调度台 · 调度台'") && s.includes("title: '知源调度台 · 项目详情'") && s.includes("title: '知源调度台 · 完整方向树'") && s.includes("path: '/compass/actions',"); });
check('R37-7/R49 好奇心卡归属名保持「调度台」（首页即调度台，归属自洽）', () => { const s1 = read('/content/search-overlay.ts'); const s2 = read('/newtab/components/GlobalPopups.vue'); return s1.includes("ws: '调度台'") && s2.includes("ws: '调度台'"); });
check('R37-8/R49 使用手册命名统一（方向台/调度台新章节标题，无旧「首页：30 秒」）', () => { const s = read('/newtab/manual-data.ts'); return s.includes('方向台') && s.includes('调度台：今天，从哪里出发') && !s.includes('首页：30 秒方向确认仪式') && !s.includes('🏠 首页（看方向'); });
console.log('【第卅七轮 · V2.14.2 第三批：REQ-044 定位文案深化 + 竞品对比】');
check('R37-9/R66 品牌口径升级：manifest 描述=个人调度中台 + 手册主 Slogan=万千可调用（旧「控制中心」叙事退役）', () => { const m = read('/manifest.ts'); const mp = read('/newtab/manual-data.ts'); return m.includes('个人调度中台') && !m.includes('控制中心') && mp.includes('万千可调用，自有我方向') && mp.includes('你在浏览器里的个人调度中台'); });
check('R37-10 REQ-044 手册新增「它与同类相比 · 独特价值」节（quick-3）', () => { const s = read('/newtab/manual-data.ts'); return s.includes("id: 'quick-3'") && s.includes('直接竞品') && s.includes('间接竞品'); });
check('R37-11 REQ-044 根 README 竞品对比增强（直接竞品/间接竞品两表）', () => { const s = read('/../../README.md'); return s.includes('### 直接竞品') && s.includes('### 间接竞品') && s.includes('Notion') && s.includes('Flomo'); });
check('R37-12 REQ-044 旧浅表述「17 个 AI 工具入口」已从 README 移除', () => { const r1 = read('/../../README.md'); const r2 = read('/../README.md'); return !r1.includes('17 个 AI 工具入口') && !r2.includes('17 个 AI 工具入口'); });

// ============== 第卅八轮 · V2.14.3 搜索交互固化 + 响应速度优化（REQ-045 ~ REQ-046） ==============
console.log('【第卅八轮 · V2.14.3 第一批：REQ-045 搜索交互固化（单击/Enter 开链接，Ctrl+Enter 定位+抽屉）】');
check('R38-1 REQ-045 background zy-open-route 支持 drawer 透传（修复单击落空根因）', () => { const s = read('/background/index.ts'); return s.includes('const drawer') && s.includes('...(drawer ? { drawer } : {})'); });
check('R38-2 REQ-045 content 单击 = 开链接（bindResultEvents click → openSearchResult）', () => { const s = read('/content/search-overlay.ts'); const m = s.match(/addEventListener\('click', \(\) => \{([\s\S]*?)openSearchResult/); return !!m; });
check('R38-3/R120 content Enter=开链 / Ctrl+Enter=仅定位（openSearchLocator 不再透传 drawer，改带 hl+hk 路由）', () => { const s = read('/content/search-overlay.ts'); return s.includes('openSearchLocator(selItem)') && s.includes('openSearchResult(selItem)') && !s.includes("route, drawer }") && s.includes("/?hl="); });
check('R38-4/R120 content 定位消息走 zy-open-route（不再用无分支的 zy-route；R120 起不再透传 drawer）', () => { const s = read('/content/search-overlay.ts'); return s.includes("type: 'zy-open-route', route") && !s.includes("route, drawer") && !s.includes("type: 'zy-route', route, drawer"); });
check('R38-5/R120 GlobalPopups 单击 = 开链接（pickRow 对象直传 → openLinkOrLocate，无 selectResultLocator）', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes('@click="pickRow(item, $event)"') /* R152：同上一条，签名带上了 MouseEvent */ && s.includes('function openLinkOrLocate') && !s.includes('selectResultLocator'); });
check('R38-6 REQ-045 GlobalPopups Enter=runFlat / Ctrl+Enter=runFlatLocator', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes("if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)") && s.includes('else runFlat(selIndex.value)'); });
check('R38-7 REQ-045 双击去重防双开（300ms 同项）', () => { const s1 = read('/content/search-overlay.ts'); const s2 = read('/newtab/components/GlobalPopups.vue'); return s1.includes('lastOpenId') && s1.includes('now - lastOpenTs < 300') && s2.includes('lastOpenId') && s2.includes('now - lastOpenTs < 300'); });
console.log('【第卅八轮 · V2.14.3 第二批：REQ-046 交互响应速度优化（速度第一）】');
check('R38-8 REQ-046 content 结果每组限 30 条（防 DOM 爆炸）', () => { const s = read('/content/search-overlay.ts'); return s.includes('MAX_PER_GROUP = 30') && s.includes('zy-group-more'); });
check('R38-9 REQ-046 GlobalPopups 结果每组限 30 条', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes('MAX_PER_GROUP = 30') && s.includes('gp-group-more'); });
check('R38-10 REQ-046 content 输入防抖 90→60ms', () => { const s = read('/content/search-overlay.ts'); return s.includes('setTimeout(() => runSearch(input.value), 60)'); });

// ============== 第卅九轮 · V2.15.0 卡片附件功能（REQ-048，第卅八轮拍板） ==============