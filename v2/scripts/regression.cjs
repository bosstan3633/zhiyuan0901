/* 知源调度台 V2.59.0 回归验证矩阵（交付前必须全绿；当前 934 项）
 * 运行：node scripts/regression.cjs
 * 新增功能时同步在对应域追加检查项 */
const fs = require('fs');
const path = require('path');
// 以脚本自身位置定位 src/，项目搬到任何盘符或系统都能跑
const base = path.resolve(__dirname, '..', 'src');
let pass = 0, fail = 0;
function check(name, fn) {
  try {
    if (fn()) { pass++; console.log('  ✅', name); }
    else { fail++; console.log('  ❌', name); }
  } catch (e) { fail++; console.log('  ❌', name, '-', e.message); }
}
// V2.21：content script 拆为三文件（search-overlay.ts 信号层 + overlay-impl.ts 浮层实现 + selection.ts 选区捕获）。
// 断言语义不变：「content script 源码包含 X」——按三文件拼接后的整体判断，历史断言无需逐条改写。
const CONTENT_SRC_FILES = ['/content/search-overlay.ts', '/content/overlay-impl.ts', '/content/selection.ts'];
function read(p) {
  if (p === '/content/search-overlay.ts') {
    return CONTENT_SRC_FILES.map(f => fs.readFileSync(base + f, 'utf8')).join('\n');
  }
  return fs.readFileSync(base + p, 'utf8');
}
function count(p, str) { return read(p).split(str).length - 1; }
function exists(p) { return fs.existsSync(base + p); }

/**
 * 版本锚 —— **升版只改这一行**（R90 补丁引入）。
 *
 * 此前各轮的「版本五处同步」断言各自硬编码版本号（如 `m.includes("version: '2.58.0'")`），
 * 每轮升版靠**全局替换**把所有版本号一路抬高（技能 §五·补十二）。副作用有两点：
 *   ① 历史轮次的**冻结版本被改错**——R87 的断言变成了校验 V2.59.0；
 *   ② 轮次标题（console 输出）与断言描述里的历史标注同样被抬高。
 *
 * 但这些断言真正要守的是**「五处写着同一个版本」这个不变量**，不是「等于某年某版的固定值」。
 * 现改为单一锚点：`VER_ANCHOR_LITERAL` 是期望版本，`CUR_VER` / `CUR_VTAG` 由它派生；
 * `reg` 分支（`reg.includes(...)`）靠本文件**保留该字面**来校验自身同步。
 */
const VER_ANCHOR_LITERAL = "version: '2.59.0'";
/** 期望版本（裸号，如 `2.59.0`） */
const CUR_VER = (VER_ANCHOR_LITERAL.match(/'([\d.]+)'/) || ['', ''])[1];
/** 期望版本（带 V 前缀，如 `V2.59.0`） */
const CUR_VTAG = 'V' + CUR_VER;

console.log('【红线检查】');
check('单向挂载：Task 持有 mounted 字段', () => count('/shared/models/index.ts', 'mountedResourceIds: ID[]') === 1 && count('/shared/models/index.ts', 'mountedCuriosityIds: ID[]') === 1);
check('单向挂载：Curiosity 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface CuriosityCard')[1].split('}')[0]));
check('单向挂载：Resource 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface ResourceCard')[1].split('}')[0]));
check('数据 100% 本地：无 http 数据上传', () => !/fetch\(|XMLHttpRequest/.test(read('/newtab/App.vue')));

console.log('【架构检查】');
check('路由：首页/方向台二级页/工作台/设置（R49：actions 子页退役）', () => count('/newtab/router.ts', "path: 'actions'") === 0 && count('/newtab/router.ts', "path: 'projects'") === 1 && count('/newtab/router.ts', "path: 'tree'") === 1);
check('旧任务中心路由已退役', () => !read('/newtab/router.ts').includes("'/tasks'"));
check('此刻最重要已整体移除', () => !exists('/newtab/components/compass/FocusPanel.vue'));
check('R49 方向台容器（R55 重写）：page-head+满宽三模块（主航线 LighthousePanel/项目总览 ov-card/任务调度 TaskManagerPanel——MetricBar 已迁调度台）', () => count('/newtab/views/CompassShell.vue', 'LighthousePanel') >= 1 && count('/newtab/views/CompassShell.vue', 'ov-card') >= 1 && count('/newtab/views/CompassShell.vue', 'TaskManagerPanel') >= 1 && !read('/newtab/views/CompassShell.vue').includes('MetricBar'));

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
check('B4 搜索定位：任务/好奇→调度台首页（R49：任务定位随今日行动移除改指 /）', () => (read('/newtab/components/GlobalPopups.vue').split("path: '/', query: { hl: item.id }").length - 1) >= 2);
check('B10 open-dashboard 复用标签页', () => read('/background/index.ts').includes('B10：已有新标签页则聚焦回归'));
check('B11/B29 搜索 Tab 循环切换类型', () => read('/content/search-overlay.ts').includes('cycle.indexOf') && read('/newtab/components/GlobalPopups.vue').includes('cycle.indexOf'));

console.log('【O组 优化】');
check('O3 批量挂载', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('confirmBatchMount'));
check('O5 好奇心看板跨列拖拽', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCzKanbanDrop'));
check('O7 好奇心双击打开来源 URL', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCardDblClick'));
check('O14 任务列表按项目分组', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('groupedTasks'));
check('O15/R49 顶部导航「方向台」入口（/compass）', () => read('/newtab/App.vue').includes("navigate('/compass')"));
check('O16 挂载候选搜索浮层', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('ts-mount-pop'));

console.log('【D组 设计】');
check('D2R 字段行样式在 FieldEditor 子组件内（B18）', () => count('/newtab/views/FieldEditor.vue', 'gs-field-row') >= 2 && count('/newtab/views/GlobalSettings.vue', '.gs-field-row') === 0);
check('D2R 无 prompt 依赖', () => !read('/newtab/views/GlobalSettings.vue').includes('prompt('));
check('D3 好奇弹窗 640 居中', () => read('/content/search-overlay.ts').includes('.center .zy-panel.curio{width:640px;}'));
check('D7 采集小窗贴近图标', () => read('/content/search-overlay.ts').includes('corner{display:flex;align-items:flex-start;justify-content:flex-end;padding:10px'));

console.log('【N组 新功能】');
check('N1 愿景/使命关联卡片入口+选择浮层', () => read('/newtab/views/CompassTree.vue').includes('toggleLinkPop') && read('/shared/models/index.ts').includes('linkedResourceIds'));
check('N2 回收站（设置面板）', () => read('/newtab/views/GlobalSettings.vue').includes('emptyRecycleBin'));
check('N4 标签管理：树CRUD+3级限制+路径', () => read('/newtab/views/GlobalSettings.vue').includes('标签最多 3 级') && read('/shared/components/TagPicker.vue').includes('tp-pathtext'));
check('N4 标签重命名级联卡片', () => read('/newtab/views/GlobalSettings.vue').includes('级联同步所有卡片'));
check('H1 策展台快捷键映射+五修饰键', () => read('/newtab/views/GlobalSettings.vue').includes('modLabel') && read('/newtab/App.vue').includes('switchToIndex'));

console.log('【第五轮】');
check('B17 方向树目录入 tree-layout 左栏', () => read('/newtab/views/CompassTree.vue').indexOf('tree-page-head') < read('/newtab/views/CompassTree.vue').indexOf('tree-layout') && read('/newtab/views/CompassTree.vue').includes('class="tree-layout"'));
check('B17 目录与策展目录样式统一(200px sticky)', () => read('/newtab/views/CompassTree.vue').includes('width: 200px; flex-shrink: 0;') && read('/newtab/views/CompassTree.vue').includes('position: sticky'));
check('B18 字段行样式迁入子组件', () => count('/newtab/views/FieldEditor.vue', 'gs-fr-action') >= 2);
check('B22 状态三选 chips', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('ts-status-chip'));
check('B23 文档级 Ctrl+Enter/Esc', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('onSidebarDocKey'));
check('O19/R49+R50-F4 主航线行卡（详情改为路由进项目详情页，抽屉随改版退役；项目 chip 内嵌后 mr-progress 退役）', () => read('/newtab/components/compass/LighthousePanel.vue').includes('mr-meta') && read('/newtab/components/compass/LighthousePanel.vue').includes('chip-proj') && !read('/newtab/components/compass/LighthousePanel.vue').includes('ProjectDetailDrawer'));
check('O20 标签3级守卫+缩进兜底', () => read('/newtab/views/GlobalSettings.vue').includes('标签最多 3 级') && read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));
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
check('产品 logo 替换（首页+关于页+扩展图标）', () => read('/newtab/App.vue').includes('logoUrl') && read('/newtab/views/GlobalSettings.vue').includes('logoUrl') && fs.existsSync(base + '/assets/logo.png'));

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
check('B27 详情抽屉删指标保留任务转未归类（ProjectDetailDrawer 对齐）', () => read('/newtab/components/ProjectDetailDrawer.vue').includes('转为未归类任务') && read('/newtab/components/ProjectDetailDrawer.vue').includes('useConfirm'));
check('第七轮编译修复/R49：GlobalSettings ttRemove async 化（ProjectCuration 老抽屉已由共享 TaskDetailDrawer 替代）', () => read('/newtab/views/GlobalSettings.vue').includes('async function ttRemove') && read('/newtab/views/ProjectCuration.vue').includes('TaskDetailDrawer ref="detailRef"'));
check('B5 应用内采集去重流程完整（dup 分支在 saveCapture 内）', () => count('/newtab/components/GlobalPopups.vue', 'saveCapture') >= 3 && read('/newtab/components/GlobalPopups.vue').includes('resetCaptureForm()\n      closeAll()\n      return'));

console.log('【第八轮 · 分类体系】');
check('W1 数据模型：Category +parentId?/pinned?', () => read('/shared/models/index.ts').includes('parentId?: ID') && read('/shared/models/index.ts').includes('pinned?: boolean'));
check('W2 分类新建/重命名应用内弹窗（无原生 prompt）', () => read('/newtab/views/Workspace.vue').includes('confirmCatModal') && read('/newtab/views/Workspace.vue').includes('openRenameCat') && !read('/newtab/views/Workspace.vue').includes('prompt('));
check('W3 分类删除：子级自动升级 + 资源并入/转待分类', () => read('/newtab/views/Workspace.vue').includes('deleteCategory') && read('/newtab/views/Workspace.vue').includes('升级为一级分类'));
check('W4 左栏树形渲染 + 置顶分区 + 聚合计数', () => read('/newtab/views/Workspace.vue').includes('sidebarCats') && read('/newtab/views/Workspace.vue').includes('pinnedRootCats') && read('/newtab/views/Workspace.vue').includes('catAggCount') && read('/newtab/views/Workspace.vue').includes('familyIds'));
check('W5 父分类聚合过滤（点击父分类含子分类资源）', () => read('/newtab/views/Workspace.vue').includes('const ids = familyIds(activeCategory.value)'));
check('W6 分类拖拽：挂子级/同级排序/升一级/防循环', () => read('/newtab/views/Workspace.vue').includes("catDropMode.value = 'child'") && read('/newtab/views/Workspace.vue').includes('onCatRootDrop') && read('/newtab/views/Workspace.vue').includes('不能移动到自己的子分类'));
check('W7 批量移动含当前工作台 + 分类层级缩进', () => read('/newtab/views/Workspace.vue').includes('const moveWorkspaces = computed(() => d.value.workspaces.filter(w => !w.archived))') && read('/newtab/views/Workspace.vue').includes('treeCatOptions') && read('/newtab/views/Workspace.vue').includes('📦 移动到…'));
check('W8 单卡移动分类弹窗 + 工作台重命名/描述弹窗', () => read('/newtab/views/Workspace.vue').includes('openMoveOne') && read('/newtab/views/Workspace.vue').includes('openInputModal') && read('/newtab/views/Workspace.vue').includes('renameWs()'));
check('W9 采集浮层分类下拉层级化', () => read('/content/search-overlay.ts').includes('treeCatLabels'));

console.log('【第九轮 · 体验修复】');
check('W10 资源卡标注分类名（可点击跳分类）', () => read('/newtab/views/Workspace.vue').includes('catNameOfFamily') && count('/newtab/views/Workspace.vue', 'rc-cat') >= 3);
check('W11 TagPicker 空体系引导去标签管理', () => read('/shared/components/TagPicker.vue').includes('tp-guide') && read('/shared/components/TagPicker.vue').includes("query: { page: 'tags' }"));
check('W12 设置深链 ?page=（onMounted+watch）', () => read('/newtab/views/GlobalSettings.vue').includes('function pageFromQuery') && read('/newtab/views/GlobalSettings.vue').includes('watch(() => route.query.page'));
check('W13 使用手册富文本（五篇·图文并茂·独立页）', () => read('/newtab/views/ManualPage.vue').includes('v-html="sec.html"') && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-steps') && read('/newtab/manual-data.ts').includes('恩格尔巴特') && read('/newtab/manual-data.ts').includes('七不原则') && read('/newtab/manual-data.ts').includes('快捷键全表'));
check('W14 tagUsage 数据兜底', () => read('/newtab/views/GlobalSettings.vue').includes('(d.resources || []).forEach'));

console.log('【第十轮 · 稳定性与性能】');
check('B30a 全局渲染错误边界（黑屏→错误卡片）', () => read('/newtab/App.vue').includes('onErrorCaptured') && read('/newtab/App.vue').includes('render-error'));
check('B30b 标签树残缺节点兜底', () => read('/newtab/views/GlobalSettings.vue').includes('safeNodes') && read('/newtab/views/GlobalSettings.vue').includes("filter(n => n && typeof n.id === 'string')"));
check('B31 新建工作台双创建守卫', () => read('/newtab/App.vue').includes('B31：Enter 与 blur 双触发守卫') && read('/newtab/App.vue').includes("newWsName.value = ''"));
check('B32 图标管理（选择/自定义/删除）', () => read('/newtab/views/Workspace.vue').includes('setWsIcon') && read('/newtab/views/Workspace.vue').includes('WS_ICONS') && read('/newtab/views/Workspace.vue').includes('删除图标'));
check('B32 Hero 名称剥离 icon 前缀', () => read('/newtab/views/Workspace.vue').includes('wsDisplayName') && read('/newtab/App.vue').includes("ws.icon || '📁'"));
check('B33 快捷键自定义说明（手册+设置页）', () => read('/newtab/views/GlobalSettings.vue').includes('chrome://extensions/shortcuts'));
check('B34 骨架屏内联', () => fs.existsSync(base + '/../src/newtab/index.html') && read('/../src/newtab/index.html').includes('zy-skl'));
check('B34 启动并行 + V1 检测跳过', () => read('/newtab/main.ts').includes('Promise.all([loadUIPrefs(), ensureBootData()])') && read('/newtab/main.ts').includes('ensureBootData'));

console.log('【第十一轮 · tags 治理与流畅度】');
check('B35 tags 数据归一化（loadData 治本）', () => read('/shared/storage/repository.ts').includes('fixTags') && read('/shared/storage/repository.ts').includes("c.tags.split("));
check('B35 全读取点数组守卫（settings/workspace/tagpicker）', () => read('/newtab/views/GlobalSettings.vue').includes('Array.isArray(r.tags)') && read('/newtab/views/Workspace.vue').includes('Array.isArray(r.tags) ? r.tags : []') && read('/shared/components/TagPicker.vue').includes('Array.isArray(props.modelValue)'));
check('B36 网页端搜索缓存+防抖+容错', () => read('/content/search-overlay.ts').includes('async function getData()') && read('/content/search-overlay.ts').includes('searchTimer') && read('/content/search-overlay.ts').includes('collectResults(d, query0(q), results, maps)') && read('/content/search-overlay.ts').includes('Array.isArray(r.tags)'));
check('C1 路由切换 out-in 过渡移除', () => !read('/newtab/App.vue').includes('mode="out-in"'));

console.log('【第十二轮 · 标签编辑/未归档/好奇来源】');
check('B37a findTagNode 遍历原始数组（根级删除/拖拽落库）', () => read('/newtab/views/GlobalSettings.vue').includes('return walk(store.data!.tagTree || [], null)'));
check('B37b/c 删除/新增反馈（带名 toast + 高亮闪烁）', () => read('/newtab/views/GlobalSettings.vue').includes('ttFlash') && read('/newtab/views/GlobalSettings.vue').includes('已删除 ${names.join'));
check('B37d 树形隶属引导线 + 折叠箭头按需显示', () => read('/newtab/views/GlobalSettings.vue').includes("background: linear-gradient(to bottom, var(--accent), var(--accent-light))") && read('/newtab/views/GlobalSettings.vue').includes('tt-toggle'));
check('O23 北极星未归档任务（第卌四轮升级：项目+指标双重有效性校验，见 R44-3）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('未归档任务') && read('/newtab/components/compass/NorthStarPanel.vue').includes('taskArchiveIssue(t) !==') && !read('/newtab/components/compass/NorthStarPanel.vue').includes('pendingTasks'));
check('O24 好奇心采集带来源（两端+模型+详情）', () => read('/shared/models/index.ts').includes('sourceTitle') && read('/content/search-overlay.ts').includes('sourceTitle: srcTitleInput') && read('/newtab/components/GlobalPopups.vue').includes('v-model="curioForm.sourceTitle"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('detail-src'));

console.log('【第十四轮 · Linear 视觉重构】');
check('P1 六主题 Linear 体系（深空薰衣草默认）', () => read('/shared/styles/tokens.css').includes("[data-theme='linear']") && read('/shared/styles/tokens.css').includes('#010102') && read('/shared/styles/tokens.css').includes('#5E6AD2'));
check('P1 默认主题迁移（green→linear 一次性）', () => read('/shared/storage/repository.ts').includes("theme: 'linear'") && read('/shared/storage/repository.ts').includes("uiCache.theme === 'green'"));
check('P2 封面扁平化（R64 修订：hero 已删，等效锚点换指标卡样式）', () => !read('/newtab/views/Workspace.vue').includes('COVER_THEMES') && !read('/newtab/views/Workspace.vue').includes('heroGradient') && read('/newtab/views/Workspace.vue').includes('.metric-card { background: var(--surface); border: 1px solid var(--border);'));
check('R49 方向台扁平化（原 P2 罗盘 Hero）：满宽 page-head + 无装饰渐变', () => read('/newtab/views/CompassShell.vue').includes('.page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 48px; }'));
check('P3 去弹跳（hover 无位移）+ 焦点环', () => !read('/newtab/views/ProjectCuration.vue').includes('translateY(-3px)') && !read('/newtab/views/Workspace.vue').includes('.res-card:hover { border-color: var(--accent); box-shadow') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('P3 过渡统一 200ms 内', () => !read('/newtab/views/ProjectCuration.vue').includes('transform .26s') && read('/shared/styles/tokens.css').includes('letter-spacing: -0.011em'));

console.log('【第廿七轮 · 身份与排版精修】');
check('R28/R49 信纸排版精修（衬线+留白，应用内+分享版；R49 调度台重写并加大行距留白）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 80px 64px') && read('/newtab/letter-data.ts').includes('padding: 96px 76px'));
check('R28 donge 哥身份（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R28 手册排版留白精修（三处同步）', () => read('/newtab/views/ManualPage.vue').includes('padding: 36px 44px') && read('/newtab/views/GlobalSettings.vue').includes('padding: 34px 40px') && read('/newtab/manual-data.ts').includes('padding: 38px 46px'));

console.log('【第廿六轮 · 信件身份与排版精修】');
check('R26-1 donge 哥身份融入（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R26-2/R49 信纸与手册排版留白精修（信纸参数 R49 更新）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 80px 64px') && read('/newtab/views/ManualPage.vue').includes('padding: 36px 44px') && read('/newtab/manual-data.ts').includes('padding: 38px 46px'));

console.log('【第廿五轮 · 手册分享/信件/深链】');
check('R25-1 手册入口新标签页打开（深链保留）', () => read('/newtab/main.ts').includes("!p.startsWith('/settings') && !p.startsWith('/manual')") && read('/newtab/views/GlobalSettings.vue').includes('openManualTab'));
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
check('R21-3/R49 页面对齐（方向台/调度台统一页边距 max-width 1440）', () => read('/newtab/views/CompassShell.vue').includes('padding: 20px 24px 48px') && read('/newtab/views/CompassHome.vue').includes('padding: 20px 24px 48px'));
check('R21-4 手册独立页（/manual 路由 + 目录锚点 + 富文本非 scoped）', () => read('/newtab/router.ts').includes("path: '/manual'") && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-tip') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab'));

console.log('【第十九~二十轮 · 拼音搜索/拖拽修复/手册白皮书】');
check('R19 拼音/首字母搜索（两端）', () => read('/shared/utils/pinyin.ts').includes("pattern: 'pinyin'") && read('/newtab/components/GlobalPopups.vue').includes('matchPinyin') && read('/content/search-overlay.ts').includes('matchPinyin'));
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
check('V13-3 好奇心链接口径（sourceUrl+本地路径直达；R48 起链接失焦即存、保存链接按钮取消）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('toOpenableCurioLink') && read('/newtab/components/compass/CuriosityPanel.vue').includes('来源链接（网页 / 本地路径 / obsidian://，失焦即保存）'));
check('V13-4 文本框可拖拽调高（三卡详情）', () => read('/newtab/components/ResourceEditForm.vue').includes('.ref-note {') && read('/newtab/components/compass/CuriosityPanel.vue').includes('max-height: 400px') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('max-height: 320px'));
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
check('R29-6（R65 修订）分类/标签名 URL 编码归一化（书签解析移交资源台）', () => read('/shared/storage/repository.ts').includes('safeDecodeText') && read('/shared/utils/index.ts').includes('export function safeDecodeText') && read('/newtab/views/Workspace.vue').includes('safeDecodeText(h3.textContent'));
check('R29-7 「升为一级」落点先取引用再清理（修拖拽状态自吞）', () => read('/newtab/views/Workspace.vue').includes('先取引用再清理状态'));

console.log('【第卅轮 · 信件模块化/书签导入分类树 · V2.10.0】');
check('R30-1 信件节头+停顿+信念行（应用内样式）', () => read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-h') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-turn') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-creed'));
check('R30-2 信件 HTML 模块化结构（两处渲染共享）', () => read('/newtab/letter-data.ts').includes('<p class="lp-h">') && read('/newtab/letter-data.ts').includes('<p class="lp-turn">') && read('/newtab/letter-data.ts').includes('<p class="lp-creed">'));
check('R30-3 分享版分节样式同构', () => read('/newtab/letter-data.ts').includes('.lp-body p.lp-h'));
check('R30-4（R73 修订）书签文件夹→分类树（资源台 hub 分支承接：前 2 级建分类，同名同级复用）', () => read('/newtab/views/Workspace.vue').includes('ensureBookmarkCategory') && read('/newtab/views/Workspace.vue').includes('BK_ROOT_NAMES') && read('/newtab/views/Workspace.vue').includes('cat.parentId = parentId'));
check('R30-5（R73 修订）第 3 级+并入标签（资源台 hub 分支承接）', () => read('/newtab/views/Workspace.vue').includes('segs.slice(2)') && !read('/newtab/views/Workspace.vue').includes("b.path.filter(p => p && p !== '书签栏')"));

console.log('【第卅一轮 · 下钻抽屉重构/Esc修复/发版 · V2.11.0】');
check('R31-1 Drawer 组件 Esc 关闭（open 期间 document 级捕获）', () => read('/shared/components/Drawer.vue').includes("watch(() => props.open") && read('/shared/components/Drawer.vue').includes("document.addEventListener('keydown', onKey, true)"));
check('R31-2 模块分组下钻（第卌四轮退役：下排改今日增删卡，全景下钻移交设置页工作台全景）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('openWsPopup') && !s.includes('nd-ws-card') && s.includes("openDrawer('today-add')"); });
check('R31-3 链接卡片明细（第卌四轮退役：模块分组/链接卡片撤出北极星，计数树由工作台全景承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('groupedLinkCards') && !s.includes('allLinkCards') && s.includes('todayDelList'); });
check('R31-4 卡片行单击详情/双击打开（第卌四轮退役：wsPopup/卡片行随模块分组撤出，北极星仅剩指标抽屉）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('onCardRowClick') && !s.includes('resClickTimer') && s.includes('openDrawer'); });
check('R31-5 新建任务自动聚焦标题并全选', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes("document.querySelector('.ts-title')") && read('/newtab/components/compass/TaskManagerPanel.vue').includes('el.select()'));

console.log('【第卅二轮 · 十四需求包 · REQ-001~014】');
check('R32-1 REQ-001 战略目标层投射已移除（函数与字段三清）', () => !read('/newtab/views/CompassTree.vue').includes('toggleGoalProjection') && !read('/newtab/views/CompassTree.vue').includes('dir.pinnedToLighthouse') && !read('/shared/models/index.ts').split('interface Direction')[1].split('interface ')[0].includes('pinnedToLighthouse'));
check('R32-1b（R59-T2 修订）树内投射开关全部退役（愿景/使命/项目；数据字段保留供主航线 📡 徽标消费）+ 项目主攻按钮', () => { const t = read('/newtab/views/CompassTree.vue'); return !t.includes('toggleVisionProjection') && !t.includes('toggleMissionProjection') && !t.includes('toggleProjProjection') && !t.includes('投射至') && t.includes('class="focus-btn"') && t.includes('onToggleFocus(proj.id)') && t.includes('toggleFocusProject('); });
check('R32-1c（R64 修订）方向状态口径=战略目标数+推进中项目数（DHI 百分比退役）', () => { const c = read('/newtab/stores/compass.ts'); return c.includes('let pushing = 0') && c.includes('goals') && !c.includes('在轨项目 ÷ 主攻项目'); });
check('R32-2 REQ-003 方向树项目卡打开项目全景抽屉', () => read('/newtab/views/CompassTree.vue').includes('openProjectDrawer') && read('/newtab/views/CompassTree.vue').includes('ProjectDetailDrawer'));
check('R32-3 REQ-004 资源详情抽屉所属工作台字段+迁移反馈', () => read('/newtab/components/ResourceEditForm.vue').includes('wsOptions') && read('/newtab/components/ResourceEditForm.vue').includes('model.workspaceId') && read('/newtab/views/Workspace.vue').includes('已保存并迁移至'));
check('R32-4 REQ-005 分类随工作台联动重置', () => read('/newtab/components/ResourceEditForm.vue').includes('catOptions') && read('/newtab/components/ResourceEditForm.vue').includes("model.categoryId = ''"));
check('R32-5 REQ-006 CSV 导出含更新时间列（第卌一轮 REQ-055 起改动态列：更新时间以固定管理尾列导出）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("{ label: '更新时间', get: r => (r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '') }"); });
check('R32-5b REQ-006 三卡详情面板时间戳可见（R48 起好奇心 meta 精简为「捕获/更新」双行）', () => read('/newtab/components/ResourceEditForm.vue').includes('fmtTs') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes('fmtTaskTs') && read('/newtab/components/compass/CuriosityPanel.vue').includes('捕获') && read('/newtab/components/compass/CuriosityPanel.vue').includes('更新 '));
check('R32-6 REQ-007 排序偏好记忆（res/task/curio 三键）', () => read('/newtab/views/Workspace.vue').includes('sortPrefs?.res?.by') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('sortPrefs?.task?.by') && read('/newtab/components/compass/CuriosityPanel.vue').includes('sortPrefs?.curio?.dir'));
check('R32-6b REQ-007+bug 任务排序下拉此前未生效，已补排序逻辑', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes("if (sortBy.value !== 'manual')") && read('/newtab/components/compass/TaskManagerPanel.vue').includes("sortDir.value === 'asc' ? 1 : -1"));
check('R32-7 REQ-008 应用内搜索命中工作台实体', () => read('/newtab/components/GlobalPopups.vue').includes("type: 'ws'") && read('/newtab/components/GlobalPopups.vue').includes('策展台条目'));
check('R32-7b REQ-008 网页浮层搜索命中工作台实体', () => read('/content/search-overlay.ts').includes("type: 'ws'") && read('/content/search-overlay.ts').includes('策展台实体'));
check('R32-8 REQ-009 搜索打开规则：有链接直开/无链接定位工作台+高亮（双端）', () => read('/newtab/components/GlobalPopups.vue').includes('已定位到卡片所在资源台') && read('/content/search-overlay.ts').includes('已定位到卡片所在资源台') && read('/content/search-overlay.ts').includes('?hl='));
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
check('R33-2 REQ-023 星标字段 starred（CardBase 一份 + 三卡 extends，零迁移）', () => read('/shared/models/index.ts').split('export interface CardBase').length - 1 >= 1 && read('/shared/models/index.ts').split('extends CardBase').length - 1 === 3 && read('/shared/models/index.ts').includes('starred?: boolean'));
check('R33-2b REQ-023 导出 CSV 补置顶/星标两列（第卌一轮 REQ-055 资源改固定管理尾列；任务 CSV 仍含两列）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const t = read('/newtab/views/CompassHome.vue'); return g.includes("{ label: '置顶', get: r => (r.pinned ? '是' : '') }") && g.includes("{ label: '星标', get: r => (r.starred ? '是' : '') }") && t.includes("t?.pinned ? '是' : ''") && t.includes("t?.starred ? '是' : ''"); });
check('R33-3 BUG-A 好奇置顶分组错位修复（置顶卡前置 + 组内 sortOrder/时间序）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("from '@/shared/utils/marksort'"));
check('R33-4 BUG-B Ctrl+Enter 口径统一（采集浮层标题/链接去除裸 Enter 保存）', () => !read('/newtab/components/GlobalPopups.vue').includes('@keydown.enter.prevent="saveCapture"') && read('/newtab/components/GlobalPopups.vue').includes('💾 保存（Ctrl+Enter）'));
check('R33-5 BUG-C 新建子分类死代码修复（父级 hover ＋ 传 parentId，弹窗父级提示可达）', () => read('/newtab/views/Workspace.vue').includes('openCreateCat(sc.cat.id)') && read('/newtab/views/Workspace.vue').includes('title="创建子分类"'));

console.log('【第卅三轮 · V2.12 需求包第二批：标记体系 · REQ-019/020】');
check('R33-6 REQ-019 搜索结果行星标按钮替换编辑（三类型均有）', () => read('/newtab/components/GlobalPopups.vue').includes('toggleStar(item)') && !read('/newtab/components/GlobalPopups.vue').includes('title="编辑" @click.stop="editItem(item)"'));
check('R33-6b REQ-019 搜索结果排序加权（置顶>星标>命中度，双端同口径）', () => read('/newtab/components/GlobalPopups.vue').includes('markRank(b.raw as AnyCard) - markRank(a.raw as AnyCard)') && read('/content/search-overlay.ts').includes('x.raw.pinned ? 2 : x.raw.starred ? 1 : 0'));
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
check('R33-14 REQ-018 删除免二次确认（四组件删除类 confirm 移除，非删除类保留）', () => !read('/newtab/views/Workspace.vue').includes('删除后可在回收站恢复') && !read('/newtab/views/CompassHome.vue').includes('删除后可在回收站恢复') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('确定删除这条好奇心') && !read('/newtab/views/ProjectCuration.vue').includes('确定删除该任务') && read('/newtab/views/Workspace.vue').includes("danger: false"));
check('R33-14b REQ-018 回收站页面（路由 + 恢复 + 永久删除 + 分区清空）', () => read('/newtab/router.ts').includes("'/recycle'") && read('/newtab/views/RecycleBin.vue').includes('restoreTask') && read('/newtab/views/RecycleBin.vue').includes('purgeTask') && read('/newtab/views/RecycleBin.vue').includes('purgeAll'));
check('R33-14c REQ-018 回收站入口在设置页危险操作区', () => read('/newtab/views/GlobalSettings.vue').includes("router.push('/recycle')"));
check('R33-15 REQ-021 分类同名即时校验（标红 + 阻止保存，重命名排除自身）', () => read('/newtab/views/Workspace.vue').includes('const catNameDup') && read('/newtab/views/Workspace.vue').includes('c.name === name && c.id !== m.editId') && read('/newtab/views/Workspace.vue').includes('.ws-modal-input.dup') && read('/newtab/views/Workspace.vue').includes('该策展台已存在同名分类，请更换名称'));
check('R33-15b REQ-021 存量重复分类合并工具（分组 + 资源并入 + 子分类升级）', () => read('/newtab/views/Workspace.vue').includes('async function mergeDupCats') && read('/newtab/views/Workspace.vue').includes('r.categoryId = keep.id') && read('/newtab/views/Workspace.vue').includes('k.parentId = undefined') && read('/newtab/views/Workspace.vue').includes('class="cat-merge"'));

console.log('【第卅三轮 · V2.12 需求包第五批：视图与布局 · REQ-025/026】');
check('R33-16 REQ-025 模块分组平铺（第卌四轮退役：北极星撤模块分组，平铺下钻由设置页工作台全景替代）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); return !s.includes('nd-flat-ws') && !s.includes('openWsPopup') && gs.includes('const panTree = computed'); });
check('R33-16b REQ-025 打开即卡片列表级（第卌四轮退役：openWsPopup 移除，卡片列表级由工作台全景右栏承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); return !s.includes('wsPopupLevel') && gs.includes('const panCards = computed'); });
check('R33-17 REQ-026 tokens spacing 令牌（卡片网格一处切换全局生效）', () => read('/shared/styles/tokens.css').includes('--card-pad-vert') && read('/shared/styles/tokens.css').includes('--card-gap') && read('/shared/styles/tokens.css').includes('--card-min-w') && read('/shared/styles/tokens.css').includes("[data-density='compact']"));
check('R33-17b REQ-026 密度档位交互（视图控制区 select + UIPrefs 记忆 + 卡片样式引用令牌）', () => read('/newtab/views/Workspace.vue').includes('v-model="density"') && read('/newtab/views/Workspace.vue').includes("store.ui?.density || 'cozy'") && read('/newtab/views/Workspace.vue').includes('var(--card-gap)') && read('/newtab/views/Workspace.vue').includes('var(--card-min-w)') && read('/newtab/main.ts').includes("setAttribute('data-density', 'compact')") && read('/shared/models/index.ts').includes("density?: 'compact' | 'cozy'"));

console.log('【第卅四轮 · V2.13 需求包第一批：REQ-030 撤销修复 + Toast 四套收敛】');
check('R34-1 REQ-030 资源卡撤销按 id 定位当前树（单删/抽屉删/批量删；R61 批量拆 natives）', () => read('/newtab/views/Workspace.vue').includes('d.value.resources.find(x => x.id === r.id)') && read('/newtab/views/Workspace.vue').includes('d.value.resources.find(x => x.id === editingResource.id)') && read('/newtab/views/Workspace.vue').includes('natives.forEach(r => {'));
check('R34-2 REQ-030 任务卡撤销按 id（单删 taskId + 批量删）+ 指标 taskIds 回填保留', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('d.value.tasks.find(x => x.id === taskId)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('removed.forEach(t => {') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('m.id === cur.metricId'));
check('R34-3 REQ-030 好奇心卡撤销按 id 定位当前树', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('d.value.curiosities.find(x => x.id === c.id)'));
check('R34-4 Toast 四套实现收敛为模块单例（toast.ts 统一 3s + App 全局唯一挂载）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 3000') && read('/newtab/App.vue').includes('<Toast />') && !read('/newtab/views/GlobalSettings.vue').includes('gs-toast') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast') && !read('/newtab/views/GlobalSettings.vue').includes('toastVisible'));
check('R34-5 各组件不再持有本地 Toast 实例（ref/showToast 残留清零）', () => !read('/newtab/views/Workspace.vue').includes('toastVisible') && !read('/newtab/views/CompassHome.vue').includes('toast.value') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('toast.value') && !read('/newtab/views/CompassTree.vue').includes('toast.value') && !read('/newtab/views/ProjectCuration.vue').includes('toast.value') && !read('/newtab/views/RecycleBin.vue').includes('toast.value') && !read('/newtab/components/TaskAddDrawer.vue').includes('toast.value'));

console.log('【第卅四轮 · V2.13 需求包第二批：REQ-027 分组分区视图 + 折叠增强】');
check('R34-6（R64 修订）卡片/列表分类分区：树状递归分组（walk 直属卡+子分类下钻 depth 缩进）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('const resourceGroups') && w.includes("title: '待分类'") && w.includes('walk(sub.id, sub.name, depth + 1)'); });
check('R34-7 F-027-4 分组标题折叠/展开（collapsedGroups 内存态 + v-show + 箭头切换）', () => read('/newtab/views/Workspace.vue').includes('const collapsedGroups') && read('/newtab/views/Workspace.vue').includes('toggleGroupCollapse') && read('/newtab/views/Workspace.vue').includes("v-show=\"!collapsedGroups.has(g.key)\"") && read('/newtab/views/Workspace.vue').includes("collapsedGroups.has(g.key) ? '▸' : '▾'"));
check('R34-8（R64 修订）卡面徽标反向强化：全路径显示（R64-F10 用户拍板要明显体现所属文件夹）', () => { const w = read('/newtab/views/Workspace.vue'); return !w.includes('hideGroupBadge') && w.includes('return catIdx.value.pathOf(r.categoryId)'); });
check('R34-9 REQ-027 分区标题样式与首分区标记（ws-cat-head + 折叠箭头）', () => read('/newtab/views/Workspace.vue').includes('ws-cat-head') && read('/newtab/views/Workspace.vue').includes('ws-cat-collapse') && read('/newtab/views/Workspace.vue').includes('{first: gi===0, sub: g.depth>0}'));

console.log('【第卅四轮 · V2.13 需求包第三批：REQ-028 分组视图联动规范】');
check('R34-10 REQ-028 F-028-1 分区内置顶排序（applyGroupSort = applySort + marksort 稳定重排）', () => read('/newtab/views/Workspace.vue').includes('function applyGroupSort') && read('/newtab/views/Workspace.vue').includes('markRank(b) - markRank(a)') && read('/newtab/views/Workspace.vue').includes("import { markRank }") && read('/newtab/views/Workspace.vue').split('applyGroupSort(').length - 1 >= 2);
check('R34-11 REQ-028 F-028-3 拖拽分区边界（跨分区改分类归属 + 轻提示；同分区局部排序）', () => read('/newtab/views/Workspace.vue').includes('function groupKeyOf') && read('/newtab/views/Workspace.vue').includes('crossGroup') && read('/newtab/views/Workspace.vue').includes('catChanged') && read('/newtab/views/Workspace.vue').includes('已移动至「'));
check('R34-12（R64 修订）子分类组标题弱化样式（ws-cat-head.sub），徽标不隐藏', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('.ws-cat-head.sub span') && !w.includes('.rc-cat.hidden'); });
check('R34-13 REQ-028 F-028-4 列表视图共用分区拖拽规则（res-row @drop 绑定 onDropCard）', () => read('/newtab/views/Workspace.vue').includes('onDropCard($event,r)') && read('/newtab/views/Workspace.vue').split('onDropCard($event,r)').length - 1 >= 2);

console.log('【第卅四轮 · V2.13 需求包第四批：REQ-029 罗盘按需引导】');
check('R34-14 REQ-029 F-029-1 侧栏常驻三行文案移除（side-note 无残留）', () => !read('/newtab/views/CompassShell.vue').includes('side-note') && !read('/newtab/views/CompassShell.vue').includes('方向树给「为什么」'));
check('R34-15 退役（R49 方向台撤侧栏，气泡引导随撤）+ 无残留', () => !read('/newtab/views/CompassShell.vue').includes('guide-bubble') && !read('/newtab/views/CompassShell.vue').includes('zy_compass_guide_v1'));
check('R49 方向台满宽模块化（R55 重写）：「主航线→项目总览→任务调度」三模块（原 R34-16 侧栏 tooltip 随改版移除）', () => { const s = read('/newtab/views/CompassShell.vue'); return s.includes('方向台') && s.includes('LighthousePanel') && s.includes('ov-grid') && s.includes('TaskManagerPanel') && !s.includes('comp-sidebar') && !s.includes('MetricBar'); });

console.log('【第卅四轮 · V2.13 需求包第五批：REQ-031 系统性能调优】');
check('R34-17 REQ-031 P-031-1 搜索关联 Map 化（buildSearchMaps 一次遍历 + collectResults O(1) 查找 + 卡数累加）', () => read('/content/search-overlay.ts').includes('function buildSearchMaps') && read('/content/search-overlay.ts').includes('maps.wsName.get(r.workspaceId)') && read('/content/search-overlay.ts').includes('maps.projName.get(t.projectId)') && read('/content/search-overlay.ts').includes('maps.wsCount.get(w.id)'));
check('R34-18 REQ-031 P-031-2 结果分组一次遍历归桶（buckets 数组替代 filter+indexOf 嵌套）', () => read('/content/search-overlay.ts').includes("const buckets: Record<string, any[]>") && read('/content/search-overlay.ts').includes('buckets[r.type]') && read('/content/search-overlay.ts').includes('shown.forEach(function (item: any, j: number)') && read('/content/search-overlay.ts').includes('const i = offset + j'));
check('R34-19 REQ-031 P-031-3 计数缓存 + Tab DOM 按需重建（countCache 仅数据变更失效，searchType 不变只更计数）', () => read('/content/search-overlay.ts').includes('function invalidateCountCache') && read('/content/search-overlay.ts').includes('function computeCounts') && read('/content/search-overlay.ts').includes("tabs.getAttribute('data-search-type')") && read('/content/search-overlay.ts').includes('invalidateCountCache()'));
check('R34-20 REQ-031 P-031-4 escapeHtml 正则化（createElement → 正则白名单替换）', () => read('/content/search-overlay.ts').includes("String(s ?? '')\n    .replace(/&/g, '&amp;')") && !read('/content/search-overlay.ts').includes("const div = document.createElement('div')\n  div.textContent = s"));
check('R34-21 REQ-031 P-031-5 应用内搜索 150ms 防抖（debouncedQuery 驱动过滤，输入框即时回显）', () => read('/newtab/views/Workspace.vue').includes('const debouncedQuery = ref') && read('/newtab/views/Workspace.vue').includes('searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)') && read('/newtab/views/Workspace.vue').includes('if (debouncedQuery.value.trim())'));
check('R34-22 REQ-031 P-031-6 onChanged 自身写入跳过（repository 内容指纹 lastSelfWriteJson + app isSelfWrite 短路全树替换）', () => read('/shared/storage/repository.ts').includes('lastSelfWriteJson = payloadJson') && read('/shared/storage/repository.ts').includes('export function isSelfWrite') && read('/newtab/stores/app.ts').includes('isSelfWrite(newData)'));
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
check('R35-9 REQ-036 状态筛选四枚举（全部/待办/推进中/已完成，移除高优先级与 today 混入）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('type TaskFilter') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('if (filterBy.value !== \'all\') tasks = tasks.filter(t => t.status === filterBy.value)') && !read('/newtab/components/compass/TaskManagerPanel.vue').includes("filterBy.value === 'high'") && !read('/newtab/components/compass/TaskManagerPanel.vue').includes('option value="high"') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('<option value="todo">待办</option>'));
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
check('R36-8 REQ-038-② App.vue 订阅保存错误转发 Toast', () => { const src = read('/newtab/App.vue'); return src.includes('subscribeSaveError') && src.includes("数据保存失败：${tag}"); });

console.log('【第卅六轮 · V2.14.1 第二批：REQ-039 全局搜索交互统一（P1 方案）】');
check('R36-9 REQ-039-① bus 极简事件中心（避免引入 mitt）', () => { const src = read('/shared/utils/bus.ts'); return src.includes('onOpenDrawer') && src.includes('emitOpenDrawer') && src.includes('DrawerPayload'); });
check('R36-10 REQ-039-② ResourceDetailDrawer 存在且支持编辑保存（R37 升级覆盖只读断言）', () => { const src = read('/newtab/components/ResourceDetailDrawer.vue'); return src.includes('function save') && src.includes('store.persist'); });
check('R36-11 REQ-039-③ 任务卡接 kind=task 抽屉总线（R45 迁至 TaskManagerPanel）', () => { const src = read('/newtab/components/compass/TaskManagerPanel.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'task')"); });
check('R36-12 REQ-039-③ CuriosityPanel 接 kind=curio 抽屉总线', () => { const src = read('/newtab/components/compass/CuriosityPanel.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'curio')"); });
check('R36-13 REQ-039-③ CompassTree 接 kind=project 抽屉总线', () => { const src = read('/newtab/views/CompassTree.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'project')"); });
check('R36-14 REQ-039-① App.vue zy-route 监听扩展 drawer 参数', () => { const src = read('/newtab/App.vue'); return src.includes("msg?.type === 'zy-route'") && src.includes('emitOpenDrawer(msg.drawer)') && src.includes('msg.drawer'); });
check("R36-15 REQ-039-④ content script 单击/双击分离（openSearchLocator + 双击走原 openSearchResult）", () => { const src = read('/content/search-overlay.ts'); return src.includes('function openSearchLocator') && src.includes("addEventListener('dblclick'") && src.includes('title = '); });
check('R36-16 REQ-039-⑤ GlobalPopups 单击开链接 + Ctrl+Enter 定位抽屉（R60：点击改对象直传 selectItem）', () => { const src = read('/newtab/components/GlobalPopups.vue'); return src.includes('runFlatLocator') && src.includes('@click="selectItem(item)"') && src.includes('@dblclick="selectItem(item)"'); });
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
check('R37-2 REQ-042 抽屉内嵌完整编辑表单（标题/工作台/分类/TagPicker）', () => { const s = read('/newtab/components/ResourceEditForm.vue'); return s.includes('model.title') && s.includes('model.workspaceId') && s.includes('model.categoryId') && s.includes('TagPicker') && s.includes('model.description'); });
check('R37-3 REQ-042 抽屉删除 = 软删 deletedAt + 撤销', () => { const s = read('/newtab/components/ResourceDetailDrawer.vue'); return s.includes('deletedAt = Date.now()') && s.includes("label: '撤销'") && s.includes('function remove'); });
check('R37-4 REQ-042 抽屉总线触发（onOpenDrawer kind=res）保留', () => { const s = read('/newtab/components/ResourceDetailDrawer.vue'); return s.includes('onOpenDrawer') && s.includes("p.kind !== 'res'"); });
console.log('【第卅七轮 · V2.14.2 第二批：REQ-043 命名体系（首页→知源罗盘 / 知源罗盘→知源引擎）】');
check('R37-5/R50-F3 导航 Tab：首页→调度台、方向台、资源台（R45：任务角标彻底移除；R61 更名）', () => { const s = read('/newtab/App.vue'); return s.includes('>调度台') && s.includes('>方向台') && s.includes('>资源台') && !s.includes('taskBadge'); });
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
check('R38-3 REQ-045 content Enter=开链接 / Ctrl+Enter=定位+抽屉（R60：id 锚定 selItem）', () => { const s = read('/content/search-overlay.ts'); return s.includes("if (e.ctrlKey || e.metaKey)") && s.includes('openSearchLocator(selItem)') && s.includes('openSearchResult(selItem)'); });
check('R38-4 REQ-045 content 定位消息走 zy-open-route（不再用无分支的 zy-route）', () => { const s = read('/content/search-overlay.ts'); return s.includes("type: 'zy-open-route', route, drawer") && !s.includes("type: 'zy-route', route, drawer"); });
check('R38-5 REQ-045 GlobalPopups 单击 = 开链接（R60：selectItem 对象直传，无 selectResultLocator）', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes('@click="selectItem(item)"') && !s.includes('selectResultLocator'); });
check('R38-6 REQ-045 GlobalPopups Enter=runFlat / Ctrl+Enter=runFlatLocator', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes("if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)") && s.includes('else runFlat(selIndex.value)'); });
check('R38-7 REQ-045 双击去重防双开（300ms 同项）', () => { const s1 = read('/content/search-overlay.ts'); const s2 = read('/newtab/components/GlobalPopups.vue'); return s1.includes('lastOpenId') && s1.includes('now - lastOpenTs < 300') && s2.includes('lastOpenId') && s2.includes('now - lastOpenTs < 300'); });
console.log('【第卅八轮 · V2.14.3 第二批：REQ-046 交互响应速度优化（速度第一）】');
check('R38-8 REQ-046 content 结果每组限 30 条（防 DOM 爆炸）', () => { const s = read('/content/search-overlay.ts'); return s.includes('MAX_PER_GROUP = 30') && s.includes('zy-group-more'); });
check('R38-9 REQ-046 GlobalPopups 结果每组限 30 条', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes('MAX_PER_GROUP = 30') && s.includes('gp-group-more'); });
check('R38-10 REQ-046 content 输入防抖 90→60ms', () => { const s = read('/content/search-overlay.ts'); return s.includes('setTimeout(() => runSearch(input.value), 60)'); });

// ============== 第卅九轮 · V2.15.0 卡片附件功能（REQ-048，第卅八轮拍板） ==============
console.log('【第卅九轮 · V2.15.0：REQ-048 卡片附件（三类卡全支持 · IndexedDB 存储 · 单文件 20MB）】');
check('R39-1 REQ-048 模型 AssetMeta 接口 + assets 字段（CardBase 一份 + 三卡 extends）', () => { const s = read('/shared/models/index.ts'); return s.includes('export interface AssetMeta') && s.split('extends CardBase').length - 1 === 3 && s.split('assets?: AssetMeta[]').length - 1 >= 1; });
check('R39-2 REQ-048 IndexedDB 附件库 zy_assets 完整封装', () => { const s = read('/shared/storage/assets.ts'); return s.includes("DB_NAME = 'zy_assets'") && s.includes('export async function putAsset') && s.includes('export async function getAssetBlob') && s.includes('export async function deleteAsset') && s.includes('export async function getAssetStats') && s.includes('export async function cleanupOrphanAssets') && s.includes('export function assetIdsOf'); });
check('R39-3 REQ-048 性能红线：附件仅存元数据引用（AssetMeta 无二进制承载字段）', () => { const s = read('/shared/models/index.ts'); return s.includes('export interface AssetMeta') && s.includes("kind: 'image' | 'html'") && s.includes('mime: string') && s.includes('createdAt: number') && !s.includes('ArrayBuffer') && !s.includes('Uint8Array'); });
check('R39-4 REQ-048 共享组件 AssetManager 单文件上限（第卌四轮升级：accept 扩 .pdf + kind 三分支 limitMB）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('maxSizeMB: 20') && s.includes('accept="image/*,.html,.htm,.pdf"') && s.includes("const limitMB = kind === 'image' ? IMG_MAX_MB : kind === 'pdf' ? PDF_MAX_MB : props.maxSizeMB") && s.includes('f.size > limitMB * 1024 * 1024'); });
check('R39-5 REQ-048 AssetManager 上传即写 IndexedDB（putAsset + uid）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('putAsset(') && s.includes("uid('at')") && s.includes('emitList'); });
check('R39-6 REQ-048 AssetManager 打开：图片全屏弹窗预览（第卌二轮多图切换）/ HTML 走 openHtmlAsset（file:// 完整打开，REQ-058）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('URL.createObjectURL') && s.includes("meta.kind === 'image'") && s.includes('viewerOpen.value = true') && s.includes('await openHtmlAsset(meta)') && s.includes("import { openHtmlAsset }"); });
check('R39-7 REQ-048 AssetManager 删除联动 deleteAsset（软删保留、硬删由回收站清）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('async function removeAsset') && s.includes('deleteAsset(meta.id)'); });
check('R39-8 REQ-048 资源卡双入口接入：搜索抽屉 + 工作台内联抽屉', () => { const shared = read('/newtab/components/ResourceEditForm.vue'); const d1 = read('/newtab/components/ResourceDetailDrawer.vue'); const d2 = read('/newtab/views/Workspace.vue'); return shared.includes('AssetManager') && shared.includes('function onAssetsChange') && d1.includes('ResourceEditForm') && d1.includes('height-key') && d2.includes('ResourceEditForm') && d2.includes('height-key="ws-note"'); });
check('R39-9 REQ-048 任务卡接入（任务侧边栏，R45 迁至 TaskDetailDrawer）', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('AssetManager') && s.includes('function onTaskAssetsChange') && s.includes('selectedTask.assets'); });
check('R39-10 REQ-048 好奇心卡接入（详情抽屉）', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('AssetManager') && s.includes('function onCurioAssetsChange') && s.includes('update(detailId.value, { assets: v })'); });
check('R39-11 REQ-048 回收站硬删先清附件（purgeAssetsOf → deleteAsset）', () => { const s = read('/newtab/views/RecycleBin.vue'); return s.includes('async function purgeAssetsOf') && s.includes('await purgeAssetsOf(r.assets)') && s.includes('await purgeAssetsOf(t.assets)') && s.includes('await purgeAssetsOf(c.assets)') && s.includes("import { deleteAsset }"); });
check('R39-12 REQ-048 设置导出页附件存储统计 + 孤儿清理入口', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('getAssetStats') && s.includes('cleanupOrphanAssets') && s.includes('assetCount') && s.includes('assetBytes') && s.includes('📎 附件存储'); });
check('R39-13 #61 共享资源编辑表单 ResourceEditForm 抽取（双份合一：Workspace 内联 + RDD 搜索抽屉）', () => { const shared = read('/newtab/components/ResourceEditForm.vue'); const d1 = read('/newtab/components/ResourceDetailDrawer.vue'); const d2 = read('/newtab/views/Workspace.vue'); return shared.includes('defineProps') && shared.includes('heightKey') && shared.includes("'save'") && shared.includes("'goto-task'") && shared.includes("<slot name=\"extra\"") && d1.includes('<ResourceEditForm') && d1.includes('@save="save"') && d1.includes('#extra') && d2.includes('<ResourceEditForm') && d2.includes('@save="saveResource"') && d2.includes(':show-close="true"'); });

// ============== 第卌轮 · V2.16.0 统一卡片模型（REQ-049~REQ-052，第卅九轮拍板） ==============
console.log('【第卌轮 · V2.16.0 第一批：REQ-049 字段目录 + CardBase 公共基底】');
check('R40-1 REQ-049 字段目录 catalog.ts：FIELD_CATALOG 含 assets、kinds 覆盖三型', () => { const s = read('/shared/models/catalog.ts'); return s.includes('export const FIELD_CATALOG') && s.includes("{ key: 'assets', label: '附件'") && s.includes("kinds: ['resource', 'task', 'curiosity']") && s.includes('export function catalogMeta') && s.includes('export function catalogFor'); });
check('R40-2 REQ-049 FieldEditor 手写常量清空（无 curiosity:[\'question\' 特征串；改由 catalogMeta 推导）', () => { const s = read('/newtab/views/FieldEditor.vue'); return !s.includes("curiosity: ['question'") && !s.includes("const LOCKED_KEYS") && !s.includes('ICON_MAP:') && s.includes('catalogMeta') && s.includes('crossFields'); });
check('R40-3 REQ-049 CardBase 公共基底 + 三卡 extends', () => { const s = read('/shared/models/index.ts'); return s.includes('export interface CardBase') && s.split('extends CardBase').length - 1 === 3 && s.includes('assets?: AssetMeta[]'); });
console.log('【第卌轮 · V2.16.0 第二批：REQ-050 转卡无损（单向唯一：好奇→任务/资源）】');
check('R40-4 REQ-050 cards.ts 转卡引擎 convertCard + 状态显式映射 + curiosity.ts 调用（无本地重建）', () => { const c = read('/shared/utils/cards.ts'); const st = read('/newtab/stores/curiosity.ts'); return c.includes('export function convertCard') && c.includes('CURIOSITY_TO_TASK_STATUS') && c.includes('shelf: \'todo\'') && st.includes('convertCard') && st.includes('missingCustomDefs') && !st.includes('question: c.question'); });
check('R40-5 REQ-050 转卡公共字段无损搬运（tags/pinned/starred/assets/customFields/createdAt）', () => { const c = read('/shared/utils/cards.ts'); return c.includes('tags: c.tags ? [...c.tags] : []') && c.includes('assets: c.assets && c.assets.length ? [...c.assets] : undefined') && c.includes('customFields: { ...(c.customFields || {}) }') && c.includes('mountedCuriosityIds: [c.id]') && c.includes("link: c.sourceUrl || ''"); });
console.log('【第卌轮 · V2.16.0 第三批：REQ-051 附件卡片正面展示（AssetBadge）+ 好奇面板目录消费】');
check('R40-6 REQ-051 共享组件 AssetBadge：分组计数徽章 + 文件列表 + 预览/打开（第卌二轮：HTML 改 openHtmlAsset + AssetPreview 多图）', () => { const s = read('/shared/components/AssetBadge.vue'); return s.includes('ab-chip ab-img') && s.includes('ab-chip ab-html') && s.includes('getAssetBlob') && s.includes('await openHtmlAsset(meta)') && s.includes('@click.stop') && s.includes('<AssetPreview :open="viewerOpen"'); });
check('R40-7 REQ-051 AssetBadge 三视图接入（资源 Workspace/任务 CompassActions/好奇 CuriosityPanel）', () => { const w = read('/newtab/views/Workspace.vue'); const t = read('/newtab/views/CompassHome.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue'); return w.includes("import AssetBadge") && w.includes('rc-assets') && w.includes('rr-assets') && w.includes('kc-card-assets') && t.includes("import AssetBadge") && t.includes('taskAssetsOn') && t.includes('kc-assets') && c.includes("import AssetBadge") && c.includes('curioExtFields'); });
check('R40-8 REQ-051 好奇面板按 fieldConfig.curiosity 消费（visibleFields + 附件/tags/custom 字段流）', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('visibleFields(d.value.fieldConfig, \'curiosity\')') && s.includes("f.key === 'assets' || f.key === 'tags' || f.key.startsWith('custom_')") && s.includes('cz-ext-lbl'); });
check('R40-9 REQ-049 附件兜底：defaults 各型 assets def（R62 起 thesis 组亦含，四组）+ repository 老数据迁移', () => { const def = read('/shared/storage/defaults.ts'); const rep = read('/shared/storage/repository.ts'); return (def.split("key: 'assets'").length - 1) >= 4 && rep.includes('REQ-049：老数据字段配置补 assets'); });
console.log('【第卌轮 · V2.16.0 第四批：REQ-052 死代码清理 + 版本门禁】');
check('R40-10 REQ-052 fieldViewCfg 死代码全库零引用', () => { return !fs.existsSync(base + '/shared/models/index.ts') ? false : !read('/shared/models/index.ts').includes('fieldViewCfg') && !read('/shared/storage/repository.ts').includes('fieldViewCfg'); });
check('R40-11/R49 版本五处同步（manifest/package/关于页动态/ManualPage/regression）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const gs = read('/newtab/views/GlobalSettings.vue'); const mp = read('/newtab/views/ManualPage.vue'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && gs.includes('runtimeVersion') && mp.includes(CUR_VTAG); });

// ============== 第卌一轮 · V2.17.0 附件详情呈现修复 + 技术债收敛（REQ-054~REQ-057，V2.16.0 交付后用户反馈驱动） ==============
console.log('【第卌一轮 · V2.17.0 第一批：REQ-054 附件详情端到端呈现修复（详情面板徽章补齐：标题旁 + section 头）】');
check('R41-1 REQ-054 Drawer 具名插槽 #title-extra（详情标题区挂附件徽章）', () => { const s = read('/shared/components/Drawer.vue'); return s.includes('name="title-extra"') && s.includes('.drawer-title-extra'); });
check('R41-2 REQ-054 好奇心详情抽屉双徽章：标题旁(#title-extra) + 附件 section 头(.detail-sec-head)', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('#title-extra') && s.includes('.detail-sec-head') && s.includes('<AssetBadge v-if="detailItem?.assets?.length"'); });
check('R41-3 REQ-054 任务详情双徽章（R48 重设计后）：标题旁(.ts-title-assets) + 附件折叠区 summary 内徽章', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('ts-title-assets') && /<summary>📎 附件[\s\S]{0,220}AssetBadge/.test(s); });
check('R41-3b REQ-054 资源编辑表单双徽章：标题旁(.ref-title-assets) + section 头(.ref-label-row)', () => { const s = read('/newtab/components/ResourceEditForm.vue'); return s.includes('ref-title-assets') && s.includes('ref-label-row') && s.includes("import AssetBadge"); });
console.log('【第卌一轮 · V2.17.0 第二批：REQ-055 资源卡 CSV 动态列对齐字段目录】');
check('R41-4 REQ-055 CSV 动态列：allFields(fieldConfig) 目录驱动 + resCsvValue 取值 + 系统字段全导/自定义按可见性 + 列名取 label', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('function resCsvValue') && s.includes("allFields(d.fieldConfig, 'resource')") && s.includes("!f.key.startsWith('custom_') || f.visible") && s.includes("const headers = cols.map(c => c.label)"); });
check('R41-4b REQ-055 UI 文案同步动态列说明（旧硬编码 8 字段描述串已清除）', () => !read('/newtab/views/GlobalSettings.vue').includes('字段：标题/链接/链接类型/标签/分类/描述/创建时间/更新时间'));
console.log('【第卌一轮 · V2.17.0 第三批：REQ-056 AssetPreview 公共 viewer 抽取（AssetManager/AssetBadge 双份合一）】');
check('R41-5 REQ-056 公共组件 AssetPreview 存在（Teleport + Esc/←→ 键捕获 + img 渲染 + close/prev/next emits，第卌二轮升级多图导航）', () => { const s = read('/shared/components/AssetPreview.vue'); return s.includes('<Teleport to="body">') && s.includes("e.key === 'Escape' && props.open") && s.includes("e.key === 'ArrowLeft'") && s.includes('class="ap-viewer-img"') && s.includes("(e: 'close')") && s.includes("(e: 'prev')") && s.includes("(e: 'next')"); });
check('R41-6 REQ-056 AssetManager 改引公共组件（不再内嵌 .am-viewer viewer）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes("import AssetPreview from './AssetPreview.vue'") && s.includes('<AssetPreview :open="viewerOpen"') && !s.includes('.am-viewer'); });
check('R41-7 REQ-056 AssetBadge 改引公共组件（不再内嵌 .ab-viewer viewer）', () => { const s = read('/shared/components/AssetBadge.vue'); return s.includes("import AssetPreview from './AssetPreview.vue'") && s.includes('<AssetPreview :open="viewerOpen"') && !s.includes('.ab-viewer'); });
check('R41-7b REQ-056 双份 viewer 样式全库收敛（am-viewer/ab-viewer 在宿主零残留）', () => { let n = 0; ['/shared/components/AssetManager.vue','/shared/components/AssetBadge.vue','/newtab/components/compass/CuriosityPanel.vue','/newtab/views/CompassHome.vue','/newtab/components/ResourceEditForm.vue'].forEach(f => { if (read(f).includes('.am-viewer') || read(f).includes('.ab-viewer')) n++; }); return n === 0; });
console.log('【第卌一轮 · V2.17.0 第四批：REQ-057 业务静默 catch 收敛（仅用户主动操作失败补提示）】');
check('R41-8 REQ-057 AssetManager.removeAsset 本体删除失败补 toast（不再静默吞错）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('await deleteAsset(meta.id)') && s.includes("console.error('[assets] deleteAsset failed:', err)") && s.includes('附件本体删除失败，可到「设置 · 数据管理」清理孤儿'); });
check('R41-8b REQ-057 RecycleBin.purgeAssetsOf 硬删附件失败累计计数提示', () => { const rb = read('/newtab/views/RecycleBin.vue'); return rb.includes('let failed = 0') && rb.includes('failed++') && rb.includes('个附件本体删除失败'); });
// V2.17.1 热修：onFilesChange 必须先 Array.from 快照 FileList 再清空 input.value（设置 value='' 会重置 FileList，旧代码先存引用后清空导致真实上传链路 100% 静默失败）
check('R41-9 V2.17.1 onFilesChange 先快照 FileList 再清空 input.value（真实上传链路时序红线）', () => { const s = read('/shared/components/AssetManager.vue'); const snap = s.indexOf('Array.from(input.files || [])'); const clear = s.indexOf("input.value = ''"); return snap >= 0 && clear >= 0 && snap < clear && s.includes('const files = Array.from(input.files || [])'); });
// V2.17.1 热修②：persist 必须 JSON 纯净清洗——reactive 树中残留的 Vue Proxy（编辑表单展开的 assets 等）会被 chrome.storage 序列化为类数组对象 {"0":…}，读回 .length undefined → 卡片正面附件徽章永不渲染
check('R41-10 V2.17.1 saveData/saveDataNow 入存储前 JSON.parse(JSON.stringify(cache)) 纯净清洗', () => { const s = read('/shared/storage/repository.ts'); return s.includes('payloadJson = JSON.stringify(cache)') && (s.match(/JSON\.parse\(payloadJson\)/g) || []).length >= 2; });

// ============== 第卌二轮 · V2.18.0：REQ-058 file:// 完整打开 + REQ-059 附件包闭环 + REQ-060 性能专项 + REQ-061 附件上传规范 ==============
console.log('【第卌二轮 · V2.18.0 第一批：REQ-061 卡片附件上传规范（9 图/10MB/HTML 唯一/标题与 linkType 联动）】');
check('R42-1 REQ-061 AssetManager 单卡图片 ≤9 张（IMG_MAX_COUNT=9 + 超额 toast）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('const IMG_MAX_COUNT = 9') && s.includes('图片数量已达上限 ${IMG_MAX_COUNT} 张'); });
// R80 重指：图片/PDF 上限改由共享 ASSET_KIND_MB 供值（导入侧同口径），数值不变
check('R42-2 REQ-061 图片单张 ≤10MB（IMG_MAX_MB=10 独立上限；第卌四轮 limitMB 扩 PDF 分支）', () => { const s = read('/shared/components/AssetManager.vue'); const k = read('/shared/utils/assetKind.ts'); return s.includes('const IMG_MAX_MB = ASSET_KIND_MB.image') && k.includes('image: 10') && s.includes("kind === 'image' ? IMG_MAX_MB : kind === 'pdf' ? PDF_MAX_MB : props.maxSizeMB"); });
check('R42-3 REQ-061 文档单卡唯一：重复上传=替换（第卌四轮泛化 HTML/PDF：hadOldDoc + isDocKind + 旧本体删除）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('replacedOld') && s.includes('hadOldDoc') && s.includes("const isDocKind = (k: string) => k === 'html' || k === 'pdf'") && s.includes('已替换原同名类型附件'); });
check('R42-3b REQ-061 AssetManager emit html-added（带 replacedOld 参数供宿主判断标题覆盖）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes("emit('html-added', m, replacedOld)"); });
check('R42-4 REQ-061 AssetPreview 多图左右切换（‹› 箭头 + ←/→ 键 + prev/next emit + posLabel 计数）', () => { const s = read('/shared/components/AssetPreview.vue'); return s.includes('ap-viewer-prev') && s.includes('ap-viewer-next') && s.includes("e.key === 'ArrowLeft'") && s.includes("e.key === 'ArrowRight'") && s.includes("(e: 'prev')") && s.includes('posLabel'); });
check('R42-5 REQ-061 资源编辑表单文档联动（第卌四轮泛化 PDF：DOC_NAME_RE 剥 .html/.pdf 扩展名）+ linkType=file + link=zy-asset://id', () => { const s = read('/newtab/components/ResourceEditForm.vue'); return s.includes('function onHtmlAdded') && s.includes('DOC_NAME_RE = /\\.(html?|pdf)$/i') && s.includes("props.model.linkType = 'file'") && s.includes('props.model.link = `zy-asset://${meta.id}`'); });
check('R42-6 REQ-061 好奇卡 HTML 联动走 question 字段（CuriosityPanel onCurioHtmlAdded）', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('function onCurioHtmlAdded') && s.includes('detailItem.value.question'); });
check('R42-7 REQ-061 任务卡 HTML/PDF 联动接入（onTaskHtmlAdded + @html-added，R45 迁至 TaskDetailDrawer）', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('function onTaskHtmlAdded') && s.includes('@html-added="onTaskHtmlAdded"'); });
console.log('【第卌二轮 · V2.18.0 第二批：REQ-058 HTML 附件 file:// 完整打开（落盘 + 路径记忆 + 降级）】');
check('R42-8 REQ-058 htmlAsset.ts 公共通道存在（openHtmlAsset 导出，返回 file|blob|missing 三态）', () => { const s = read('/shared/utils/htmlAsset.ts'); return s.includes('export async function openHtmlAsset') && s.includes("Promise<'file' | 'blob' | 'missing'>"); });
check('R42-9 REQ-058 落盘→file:// 打开链路（chrome.downloads.download + tabs/file 打开 + 唯一确定性路径 + conflictAction overwrite）', () => { const s = read('/shared/utils/htmlAsset.ts'); return s.includes('chrome.downloads.download') && s.includes('openExternalLink(fileUrl)') && s.includes('conflictAction') && s.includes('toFileUrl'); });
check('R42-10 REQ-058 路径记忆复用：已落盘且文件仍在 → 直接打开不重复下载；丢失才重下', () => { const s = read('/shared/utils/htmlAsset.ts'); return s.includes('loadPathMap()') && s.includes('savePathMap(map)') && s.includes('remembered') && s.includes('fileStillThere'); });
check('R42-11 REQ-058 降级 blob 打开（无 downloads 权限/网页端）+ 60s+ revoke', () => { const s = read('/shared/utils/htmlAsset.ts'); return s.includes('URL.createObjectURL(blob)') && s.includes('URL.revokeObjectURL'); });
check('R42-12 REQ-058 资源卡双击 HTML 打开（linkType=file 且 link=zy-asset:// 正则匹配 → openHtmlAsset）', () => { const s = read('/newtab/views/Workspace.vue'); return s.includes("import { openHtmlAsset }") && s.includes('/^zy-asset:\\/\\//i.test'); });
console.log('【第卌二轮 · V2.18.0 第三批：REQ-059 附件导出/导入闭环（附件包 zip）】');
check('R42-13 REQ-059 零依赖 zip 工具（zip.ts buildZip/readZip + crc32 + PK 头 + STORE 模式）', () => { const s = read('/shared/utils/zip.ts'); return s.includes('export function buildZip') && s.includes('export function readZip') && s.includes('function crc32') && s.includes('0x04034b50') && s.includes('0x02014b50'); });
check('R42-14 REQ-059 IndexedDB 附件库批量能力（getAllAssets 全量读 + putAssets 批量写回）', () => { const s = read('/shared/storage/assets.ts'); return s.includes('export async function getAllAssets') && s.includes('export async function putAssets'); });
check('R42-15 REQ-059 设置页导出附件包（exportAssetPack 按钮 + zip 生成 + 附件本体不进主 JSON）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('async function exportAssetPack') && s.includes('导出附件包'); });
check('R42-16 REQ-059 设置页导入附件包（assetPackInput + handleAssetPackImport + 同 ID 覆盖写回文案）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('const assetPackInput') && s.includes('handleAssetPackImport') && s.includes('同 ID 覆盖'); });
check('R42-17 REQ-060 附件管理上传文案（第卌四轮更新：图片 / HTML / PDF 三类并列）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes("📎 添加附件（图片 / HTML / PDF）") && s.includes('PDF 单卡 1 份（≤100MB，重复上传=替换）'); });
check('R42-18 REQ-058 manifest 含 downloads 权限（chrome.downloads.download 可用，否则 file:// 落盘链路静默降级）', () => read('/manifest.ts').includes("'downloads'"));

// ============== 第卌三轮 · V2.18.1 补丁：BUG-2 双复选框 + R-1~R-5 任务中心/北极星迭代 ==============
console.log('【第卌三轮 · V2.18.1 第一批：任务中心 Bug 修复（批量双复选框 + 卡片删除 + 总数双值）】');
check('R43-1 BUG-2 批量模式只保留勾选框：mgr-body 携带 batch class 且 CSS 隐藏 check-sm（避免双复选框）', () => { const s = read('/newtab/components/compass/TaskManagerPanel.vue'); return s.includes('class="mgr-body" :class="{batch: batchMode}"') && s.includes('.mgr-body.batch .check-sm { display: none; }'); });
check('R43-2 R-1 任务卡 hover 删除按钮：t-del 样式 + 三处任务行均绑定 deleteTask', () => { const s = read('/newtab/components/compass/TaskManagerPanel.vue'); return s.includes('class="t-del" @click.stop="deleteTask(task.id)"') && (s.match(/class="t-del" @click\.stop="deleteTask\(task\.id\)"/g) || []).length === 3 && s.includes('.t-del:hover'); });
check('R43-3 R-2 任务列表总数双值：totalTaskCount 分母 + 工具栏 mgr-count（当前 N 条 / 全部 M 可点击清除筛选）', () => { const s = read('/newtab/components/compass/TaskManagerPanel.vue'); return s.includes('const totalTaskCount = computed') && s.includes('function clearTaskFilter()') && s.includes('class="mgr-count"') && s.includes('全部 {{ totalTaskCount }}'); });
console.log('【第卌三轮 · V2.18.1 第二批：今日三件事紧凑化】');
check('R43-4（R64 修订）今日三件事卡片再紧凑：padding 7px 12px 6px、today-body 底距收窄', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('padding: 7px 12px 6px') && s.includes('.today-body { padding: 0 20px 10px; }'); });
console.log('【第卌三轮 · V2.18.1 第三批：北极星指标迭代（N/M + 周期联动）】');
check('R43-5 R-4 北极星未归档任务 N/M（未归档/任务总数，totalTasks 分母）+ 保留级联归档抽屉', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes('const totalTasks = computed') && s.includes('{{ unarchivedTasks.length }}/{{ totalTasks }}') && s.includes("nd-task-row"); });
check('R43-6 R-5 北极星 bottom 三卡（第卌四轮改版：模块分组/链接卡片撤卡，bottom 仅剩未归档 + 今日增删两卡）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes('未挂指标 · 不分期') && !s.includes('全量 · 不分期') && s.includes('todayAddList'); });
check('R43-7（R64 重写）北极星方向状态口径：goals 过滤归档 + 任务数≠0 即推进（全项目扫描）', () => { const s = read('/newtab/stores/compass.ts'); return s.includes("dirs.filter(x => x.status !== 'archived')") && s.includes('d.value.tasks.some(t => !t.deletedAt && t.projectId === p.id)'); });
check('R43-8 R-5（R59-T9 修订）北极星 WCE/WRR 副标随周期（pLabel 新增 + thisWeekUsage + totalCumUsage；WCE 含转化）', () => { const s = read('/newtab/stores/compass.ts'); return s.includes('const pLabel = period') && s.includes('sub: `${pLabel}新增 ${newInPeriod}`') && s.includes('thisWeekUsage') && s.includes('totalCumUsage'); });
console.log('【第卌三轮 · V2.18.1 第四批：BUG-1 新建任务保存不更新（reactive Proxy 引用修复）】');
check('R43-9 BUG-1 根因修复：openTaskSidebar/saveTaskTitle 均经 d.value.tasks.find 取 store Proxy 元素写入（绕 Proxy set trap 会导致 Ctrl+Enter 保存后列表不刷新）', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('selectedTask.value = d.value.tasks.find(x => x.id === task.id) || task') && s.includes('const inStore = d.value.tasks.find(x => x.id === selectedTask.value!.id)'); });
// ============== 第卌四轮 · V2.19.0：北极星今日卡/未归档双校验 + 知源仪表盘 + 工作台全景 + 事件日志 + PDF 接入 ==============
console.log('【第卌四轮 第一批：T-01/T-02 北极星今日增删卡 + 未归档双校验 + 撤卡】');
check('R44-1 北极星下排改为今日新增/今日删除卡（todayAddList/todayDelList + DrawerType 移除 groups/resources）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes("type DrawerType = 'dhi' | 'wce' | 'wrr' | 'today-add' | 'today-del' | 'tasks'") && s.includes('const todayAddList = computed') && s.includes('const todayDelList = computed') && s.includes('{{ todayAddList.length }}') && s.includes('{{ todayDelList.length }}') && !s.includes("'groups'"); });
check('R44-2 北极星今日卡可点击开抽屉（openDrawer(today-add/today-del)）+ 空态文案随档位（R45：periodLabel 前缀）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes("openDrawer('today-add')") && s.includes("openDrawer('today-del')") && s.includes('{{ periodLabel }}还没有新增卡片') && s.includes('{{ periodLabel }}没有删除卡片'); });
check('R44-3 北极星未归档双校验：projectById Map + taskArchiveIssue（项目+指标双重有效性，悬挂引用计入未归档）+ nd-task-head 徽标', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes('const projectById = computed') && s.includes('function taskArchiveIssue') && s.includes("taskArchiveIssue(t) !== ''") && s.includes('nd-task-head') && s.includes('{{ taskArchiveIssue(t) }}'); });
console.log('【第卌四轮 第二批：T-05 卡片操作事件日志（repository 快照 diff 全覆盖）】');
check('R44-4 eventLog.ts 独立 key zy_event_log + 5000 条滚动上限 + CardEvent 接口 + 快照重建/flush 双导出', () => { const s = read('/shared/utils/eventLog.ts'); return s.includes("EVENT_LOG_KEY = 'zy_event_log'") && s.includes('EVENT_LOG_CAP = 5000') && s.includes('export interface CardEvent') && s.includes('export function rebuildEventSnapshot') && s.includes('export function flushCardEvents'); });
check('R44-5 repository 全路径挂载：loadData 重建快照 + saveData/saveDataNow flush + syncCache 外部写入静默重建', () => { const s = read('/shared/storage/repository.ts'); return s.includes("import { rebuildEventSnapshot, flushCardEvents } from '@/shared/utils/eventLog'") && (s.match(/rebuildEventSnapshot\(/g) || []).length >= 2 && (s.match(/flushCardEvents\(cache\)/g) || []).length === 2; });
console.log('【第卌四轮 第三批：T-03 知源仪表盘（默认首屏 + 动态条抽屉 + 操作记录时间线 + CSV 按筛选导出）】');
check('R44-6（R54 重写：四组）设置页导航：总览=知源仪表盘+工作台全景并列 / 卡片与字段（标签管理上移）/ 数据 / 系统，「整理」组取消', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("const activePage = ref('dashboard')") && s.includes("{ title: '总览', items: [") && s.includes("{ key: 'panorama', icon: '🗺', label: '资源台全景' }") && s.includes("{ title: '卡片与字段', items: [") && s.includes("{ title: '数据', items: [") && s.includes("{ title: '系统', items: [") && !s.includes("{ title: '整理'") && s.indexOf("'tags'") < s.indexOf("const activePage = ref"); });
check('R44-7 仪表盘核心指标 5 卡可点击开抽屉（openStatDrawer all/resource/task/curiosity/link）+ 动态条三段可点击（openDynDrawer today-add/week-add/cum-del）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("openStatDrawer('all')") && s.includes("openStatDrawer('resource')") && s.includes("openStatDrawer('task')") && s.includes("openStatDrawer('curiosity')") && s.includes("openStatDrawer('link')") && s.includes("openDynDrawer('today-add')") && s.includes("openDynDrawer('week-add')") && s.includes("openDynDrawer('cum-del')"); });
check('R44-8 操作记录时间线三维筛选（类型/动作/时间）+ filteredEvents 展示 + 超 200 条导出提示 + 老数据回退派生（derivedEvents）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('const filteredEvents = computed') && s.includes('filteredEvents.slice(0, 200)') && s.includes('导出 CSV 可获得完整筛选结果') && s.includes('derivedEvents'); });
check('R44-9 CSV 按筛选导出：exportEventsCsv 用 filteredEvents + UTF-8 BOM + 文件名 zhiyuan_操作记录_日期', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('function exportEventsCsv()') && s.includes('\\uFEFF') && s.includes('zhiyuan_操作记录_') && /exportEventsCsv[\s\S]{0,900}filteredEvents/.test(s); });
console.log('【第卌四轮 第四批：T-04 资源台全景（双栏 Master-Detail + 三级计数树 + 拖拽/按钮双通道）】');
check('R44-10 资源台全景第二屏：panorama 面板 + 双栏布局 + 三级计数树（工作台→分类→子分类，parentId 派生）默认全展开', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("activePage === 'panorama'") && s.includes('🗺 资源台全景') && s.includes('panHubWss') && s.includes('const panTree = computed') && s.includes('gs-pan-panel') && s.includes('panTotalCards'); });
check('R44-11 全景双通道：拖拽（draggable 卡片 + onPanDrop 工作台/分类落点）+ 按钮（movePanSelection 批量移动）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('function onPanDrop') && s.includes('function movePanCards') && s.includes('function movePanSelection') && s.includes('draggable="true"'); });
console.log('【第卌四轮 第五批：T-08 PDF 附件接入（沿 HTML 单卡唯一模式，100MB 上限，file:// 通道泛化）】');
check('R44-12 AssetMeta.kind 增加 pdf + htmlAsset 通道泛化（路径键 zy_file_paths + openFileAsset 别名）', () => { const s = read('/shared/models/index.ts'); const h = read('/shared/utils/htmlAsset.ts'); return s.includes("'image' | 'html' | 'pdf'") && h.includes("PATHS_KEY = 'zy_file_paths'") && h.includes('export const openFileAsset = openHtmlAsset'); });
// R80 重指：guessKind 抽到 shared/utils/assetKind.ts（导入侧复用），PDF_MAX_MB 改由 ASSET_KIND_MB 供值
check('R44-13 AssetManager PDF 规范：guessKind 识别 pdf + PDF_MAX_MB=100 + HTML/PDF 单卡唯一替换（isDocKind）+ accept 含 .pdf + 📕 图标', () => { const s = read('/shared/components/AssetManager.vue'); const k = read('/shared/utils/assetKind.ts'); return s.includes('const PDF_MAX_MB = ASSET_KIND_MB.pdf') && k.includes('pdf: 100') && k.includes("/\\.pdf$/i.test(name) || /^application\\/pdf$/i.test(mime)") && s.includes("const isDocKind = (k: string) => k === 'html' || k === 'pdf'") && s.includes('image/*,.html,.htm,.pdf') && s.includes("a.kind === 'pdf' ? '📕'"); });
check('R44-14 PDF 四宿主联动泛化：ResourceEditForm/CuriosityPanel/CompassActions 联动函数剥 .pdf 扩展名 + Workspace 双击放行 pdf + AssetBadge pdf 图标', () => { const re = read('/newtab/components/ResourceEditForm.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const ca = read('/newtab/components/compass/TaskDetailDrawer.vue'); const ws = read('/newtab/views/Workspace.vue'); const ab = read('/shared/components/AssetBadge.vue'); // R80 重指：放行判据由「非 html 非 pdf 则报错」改为「html/pdf 正向放行 + image 走预览」
return re.includes('/\\.(html?|pdf)$/i') && cp.includes('/\\.(html?|pdf)$/i') && ca.includes('/\\.(html?|pdf)$/i') && ws.includes("meta.kind === 'html' || meta.kind === 'pdf'") && ab.includes("a.kind === 'pdf' ? '📕'"); });

// ============== 第卌五轮 · V2.21.3：任务管理迁好奇心Tab+卡片视图 + 今日行动项目策展 + 北极星日/周/累计 + 角标移除 ==============
console.log('【第卌五轮 第一批：T-03 任务管理迁移（好奇心专区 Tab + 卡片视图默认 + 共享详情抽屉）】');
check('R45-1 TaskManagerPanel 组件落地 + 卡片视图默认（viewMode card|list|kanban 默认 card + 三视图 Tab）', () => { const s = read('/newtab/components/compass/TaskManagerPanel.vue'); return s.includes("const viewMode = ref<'card' | 'list' | 'kanban'>('card')") && s.includes("viewMode==='card'") && s.includes("viewMode==='list'") && s.includes("viewMode==='kanban'") && s.includes('▦ 卡片'); });
check('R45-2 TaskManagerPanel 全量能力保留：批量/分组/排序方向/状态筛选/搜索/拖拽（列表+看板+分组落点）/键盘导航/右键菜单/批量挂载', () => { const s = read('/newtab/components/compass/TaskManagerPanel.vue'); return s.includes('toggleBatchMode') && s.includes('groupedTasks') && s.includes('toggleSortDir') && s.includes('type TaskFilter') && s.includes('onListGroupDrop') && s.includes('onKanbanGroupDrop') && s.includes('onTaskNavKey') && s.includes('openTaskCtx') && s.includes('confirmBatchMount') && s.includes('class="mgr-count"'); });
check('R45-3 TaskDetailDrawer 共享抽屉：defineExpose({ open, close }) + 级联/挂载/Ctrl+Enter/宽度记忆内聚', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('defineExpose({ open, close })') && s.includes('onSelProjectChange') && s.includes('onSidebarDocKey') && s.includes('startDrawerResize') && s.includes("useTaHeight('task-note'"); });
check('R45-4 TaskManagerPanel 与 CompassActions 均接入共享抽屉（ref + drawerRef?.open）', () => { const tm = read('/newtab/components/compass/TaskManagerPanel.vue'); const ca = read('/newtab/views/CompassHome.vue'); return tm.includes('<TaskDetailDrawer ref="drawerRef" />') && ca.includes('<TaskDetailDrawer ref="drawerRef" />') && tm.includes('drawerRef.value?.open') && ca.includes('drawerRef?.open'); });
check('R45-5/R49（R55-B2 重写）调度台底部：好奇心培育单区直呈（无 Tab 头），任务调度已迁方向台', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('<CuriosityPanel />') && s.includes('好奇心培育单区直呈') && !s.includes('zone-tabs') && !s.includes('TaskManagerPanel'); });
check('R45-6 CompassActions 已移除全域任务管理（无 mgr-body/viewMode/批量挂载/看板），保留三件事与选取/导出弹窗', () => { const s = read('/newtab/views/CompassHome.vue'); return !s.includes('mgr-body') && !s.includes("ref<'list' | 'kanban'>") && !s.includes('confirmBatchMount') && !s.includes('kanban-board') && s.includes('openPicker') && s.includes('doExport') && s.includes('copyYesterday'); });
console.log('【第卌五轮 第二批：T-04 今日行动项目策展面板 + 三件事交互升级】');
check('R45-7/R66 项目调度面板结构（R66 瘦身）：项目名大字+战略目标+四项数值（愿景/使命呈现退役，数据留方向台）', () => { const s2 = read('/newtab/views/CompassHome.vue'); return s2.includes('cur-body-v') && s2.includes('cur-proj-name big') && !s2.includes('cur-vision-row') && !s2.includes('visionText') && s2.includes('cur-goal-name') && s2.includes('cur-stats') && s2.includes('projMetrics.length') && s2.includes('projDoneCount') && s2.includes('projDoingCount'); });
check('R45-8 右列按成功指标分组 + 新建（可指定指标）/关联任务入口（跨项目清原指标）', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('const metricGroups = computed') && s.includes('createProjectTask') && s.includes('openLinkPicker') && s.includes('linkTaskToProject') && s.includes('syncMetricTaskIds'); });
check('R45-9 三件事新交互（R56 修订）：单击 onFocusCardClick 联动 focusSelIdx→selTask→curProject + 双击开抽屉 + 呼吸灯移除（PERF-e）+ 选中态样式', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('function onFocusCardClick') && s.includes('const focusSelIdx = ref(0)') && s.includes('const curProject = computed') && s.includes('@dblclick="drawerRef?.open(todayTaskForSlot(slot)!)"') && !s.includes('tcBreathe') && s.includes('.today-card.sel'); });
console.log('【第卌五轮 第三批：T-01 北极星日/周/累计三档联动 + T-02 工作台今日增删 + T-05 角标移除】');
check('R45-10 北极星周期三档 day/week/all：NorthStarPanel period 默认 day + startOf 周期起点 + 新增卡片/删除卡片标题随档位', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes("ref<'day' | 'week' | 'all'>('day')") && s.includes('function startOf') && s.includes('periodStart') && s.includes('新增卡片') && s.includes('删除卡片') && s.includes('periodLabel'); });
check('R45-11 compass.ts Period 三档：days=1/7/9999（R60：DHI 与 WCE/WRR 统一用 days）+ WRR 日档今日打开卡数', () => { const s = read('/newtab/stores/compass.ts'); return s.includes("type Period = 'day' | 'week' | 'all'") && s.includes("period === 'day' ? 1 : period === 'week' ? 7 : 9999") && s.includes('todayOpened'); });
check('R45-12 工作台页头今日新增/删除字段：wsTodayAdd/wsTodayDel（当日 0 点起算）+ hero-stats 五项', () => { const s = read('/newtab/views/Workspace.vue'); return s.includes('const wsTodayAdd = computed') && s.includes('const wsTodayDel = computed') && s.includes('startOfToday') && s.includes('今日新增') && s.includes('今日删除'); });
check('R45-13/R49 角标彻底移除 + 手册导航说明改为三大系统页（调度台/方向台/资源台）', () => { const a = read('/newtab/App.vue'); const m = read('/newtab/manual-data.ts'); return !a.includes('taskBadge') && !m.includes('角标=今日三件事未完成数') && m.includes('方向台（指标条 / 主航线 / 项目总览）'); });
check('R45-14/R49 手册同步：项目详情章节 + 调度台 Tab 说明', () => { const m = read('/newtab/manual-data.ts'); return m.includes('📦 项目详情') && m.includes('单击</strong>任务卡') && m.includes('底部 Tab'); });

// ============== 第卌六轮 · V2.21.3：用户实测 5 问题修复（Tab 同屏/projectId 断链/下钻抽屉/三件事布局+呼吸灯） ==============
console.log('【第卌六轮 R46：BUG 修复与交互优化】');
check('R46-1/R49 BUG-1 CuriosityPanel 单根化（ContextMenu 移入 ModuleCard 内，v-show 可继承）+ ModuleCard 标题=好奇心培育', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); const lastM = s.lastIndexOf('</ModuleCard>'); const cm = s.lastIndexOf('<ContextMenu'); const tplEnd = s.lastIndexOf('</template>'); return lastM > 0 && cm > 0 && cm < lastM && s.lastIndexOf('</ContextMenu>') < lastM && s.includes('title="好奇心培育"') && s.slice(s.indexOf('</template>') - 200).includes('</ModuleCard>') && tplEnd > lastM; });
check('R46-2/R49 BUG-1 Tab 改名收口：CompassHome 无旧文案，CuriosityPanel/TaskManagerPanel ModuleCard 标题=好奇心培育/任务调度', () => { const h = read('/newtab/views/CompassHome.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const tm = read('/newtab/components/compass/TaskManagerPanel.vue'); return h.includes('好奇心培育') && h.includes('任务调度') && !h.includes('我的好奇心') && !h.includes('任务管理') && cp.includes('title="好奇心培育"') && tm.includes('title="任务调度"'); });
check('R46-3 BUG-2 TaskAddDrawer linkTasks 补写 projectId（关联即写项目归属）', () => { const s = read('/newtab/components/TaskAddDrawer.vue'); return s.includes('t.metricId = props.metricId; t.projectId = props.projectId; t.updatedAt = Date.now()'); });
check('R46-4 BUG-2 存量回填迁移：app.ts init 幂等回填（metricId 反查项目）+ AppData.projBackfillFixed 记录字段', () => { const a = read('/newtab/stores/app.ts'); const m = read('/shared/models/index.ts'); return a.includes('projBackfillFixed') && a.includes('projOfMetric.has(t.metricId)') && a.includes('if (fixed > 0)') && m.includes('projBackfillFixed?: number'); });
check('R46-5 BUG-2 设置页数据组留修复记录：导出页 projBackfillFixed 显示「存量归属修复」', () => read('/newtab/views/GlobalSettings.vue').includes('存量归属修复（V2.20.1）'));
check('R46-6 BUG-3a statDrawerTitle 补 .value（totalCards.value，无裸 computed 插值）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('（${totalCards.value}）') && !s.includes('（${totalCards}）'); });
check('R46-7 BUG-3b 下钻明细升级：statList 带 kind 分类型图标徽标 + 行点击定位（openStatCard 路由 hl）｜R48-B1 翻页改造后 STAT_PAGE=20 仍保留', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('kind: \'resource\' as const') && s.includes('statKindIcon') && s.includes('statKindLabel') && s.includes('const STAT_PAGE = 20') && s.includes('function openStatCard') && s.includes("query: { hl: r.id }"); });
check('R46-8 OPT-1 三件事卡布局：复选框并入标题行（tc-row + tc-check 16px）+ 移除 × 移到编号左侧（right: 32px）不再与复选框同角', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('class="tc-row"') && s.includes('.tc-check { width: 16px') && s.includes('.tc-remove { position: absolute; top: 7px; right: 32px') && !s.includes('top: 8px; left: 12px'); });
check('R46-9 OPT-1（R56-PERF-e 修订）呼吸灯移除：tcBreathe 动画/keyframes 全无，选中/完成态改恒定样式表达', () => { const s = read('/newtab/views/CompassHome.vue'); return !s.includes('tcBreathe') && s.includes('.today-card.sel { border-color: var(--accent); background: var(--accent-light); animation: none;') && s.includes('.today-card.done { opacity: .6; animation: none; }'); });
check('R46-10/R49 手册同步：好奇心培育/任务调度命名 + 下钻明细交互说明', () => { const m = read('/newtab/manual-data.ts'); return m.includes('好奇心培育') && m.includes('任务调度') && m.includes('单击明细行'); });


// ============== 第四十八轮 · V2.21.3：R48 修复+详情页重设计（A-1 错误留痕 / A-2 检索竞态 / B-1 明细翻页 / B-2 双口径 / 树折叠 / 删除入口 / DetailSheet 重构） ==============
console.log('【第四十八轮 R48：Bug 修复 + 详情页重设计 + 树美化】');
check('R48-1 A-2 检索竞态修复：拼音补跑 mergeAppend 冻结顺序仅追加 + 点击按 data-id 解析（resolveResult）', () => { const s = read('/content/overlay-impl.ts'); return s.includes('mergeAppend') && s.includes('resolveResult') && s.includes('const hit = searchResults.find(r => String(r?.id || \'\') === id)') && s.includes('data-id='); });
check('R48-2 A-1 运行错误留痕：runtimeError.ts（zy_error_log 滚动 50 条 + 去重）+ main.ts 最先 installRuntimeErrorCapture', () => { const s = read('/shared/utils/runtimeError.ts'); const m = read('/newtab/main.ts'); return s.includes("ERROR_LOG_KEY = 'zy_error_log'") && s.includes('ERROR_LOG_CAP = 50') && s.includes('installRuntimeErrorCapture') && m.indexOf('installRuntimeErrorCapture') < m.indexOf('bootstrap()'); });
check('R48-3 A-1 设置页错误弹药出口：⚠ 运行错误计数段 + exportErrorLog 导出含完整堆栈 txt', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('exportErrorLog') && s.includes('readErrorLog') && s.includes('运行错误'); });
check('R48-4 B-1 明细抽屉翻页 20 条 + 搜索过滤（statPage/statSearch/statShown/gs-pager + dynPage/dynSearch/dynShown）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('const STAT_PAGE = 20') && s.includes('statShown') && s.includes('statGo') && s.includes('dynShown') && s.includes('dynGo') && s.includes('gs-pager') && s.includes('gs-drawer-search') && !s.includes('onStatScroll') && !s.includes('gs-ev-more'); });
check('R48-5 B-2 双口径：CardBase.importedAt + mergeImport 导入打戳 + 今日/本周「导 N」徽标 + 明细 ⇪ 导入徽标（卡片字段派生同源）', () => { const m = read('/shared/models/index.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return m.includes('importedAt?: number') && g.includes('importedAt: importedNow') && g.includes('todayImportCount') && g.includes('weekImportCount') && g.includes("e.action === 'import' ? '⇪ 导入'"); });
check('R48-6 B-2 北极星双口径：FlatCard.importedAt + todayAddSub「含导入N」+ 明细行 ⇪ 导入徽标', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes('importedAt') && s.includes('含导入') && s.includes('ns-imp-badge'); });
check('R48-7 树折叠：Workspace collapsedCats + toggleCatCollapse + collapseAllCats/expandAllCats（目录工具条「⊟ 收起/⊞ 展开」）+ caret 旋转 + 选中子级自动展开父级', () => { const s = read('/newtab/views/Workspace.vue'); return s.includes('collapsedCats') && s.includes('function toggleCatCollapse') && s.includes('function collapseAllCats') && s.includes('function expandAllCats') && s.includes('selectSidebarCat') && s.includes('⊟ 收起') && s.includes('⊞ 展开') && s.includes('.cat-caret.open'); });
check('R48-8 任务删除入口全视图：卡片 tm-del + 列表 t-del + 看板 k-del（hover）+ 看板右键菜单（contextmenu）+ 详情 Footer 降级 ghost 删除', () => { const s = read('/newtab/components/compass/TaskManagerPanel.vue'); const d = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('class="k-del"') && s.includes('@contextmenu.prevent="openTaskCtx($event, task)"') && s.includes('.k-del:hover') && d.includes('ts-del-ghost') && d.includes('🗑 删除'); });
check('R48-9 详情重设计·任务：说明区上移 Hero（ds-desc）+ 状态下拉 chip（STATUS_UI/ds-status-menu）+ 属性双列（ds-props2）+ 附属折叠（ds-details）+ 主操作唯一', () => { const s = read('/newtab/components/compass/TaskDetailDrawer.vue'); return s.includes('ds-hero-label') && s.includes('STATUS_UI') && s.includes('statusMenuOpen') && s.includes('ds-props2') && s.includes('ds-details') && s.includes('setPriority') && !s.includes('ts-status-row'); });
check('R48-10 详情重设计·好奇心：摘录 Hero 引用体（ds-quote）+ 状态头部下拉 chip（curioStatusMenuOpen）+ 元数据 ds-meta 一行 + 保存链接按钮取消（@change 即存）', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('ds-quote') && s.includes('curioStatusMenuOpen') && s.includes('ds-meta') && !s.includes('detail-status-row') && !s.includes('>保存链接<'); });
check('R48-11 详情重设计·资源：链接 Hero + 工作台/分类双列 + 注解上移「为什么收藏它」+ 附件/被任务挂载折叠', () => { const s = read('/newtab/components/ResourceEditForm.vue'); return s.includes('ds-hero-label') && s.includes('ds-props2') && s.includes('为什么收藏它') && s.includes('ds-details') && s.includes('ds-desc'); });
check('R48-12 统一样式基建：shared/styles/detail-sheet.css（ds-quote/ds-desc/ds-props2/ds-meta/ds-details/ds-status-chip2）+ main.ts 引入', () => { const s = read('/shared/styles/detail-sheet.css'); const m = read('/newtab/main.ts'); return s.includes('.ds-quote') && s.includes('.ds-desc') && s.includes('.ds-props2') && s.includes('.ds-meta') && s.includes('.ds-details') && s.includes('.ds-status-chip2') && m.includes('detail-sheet.css'); });
check('R48-13 版本五处同步（manifest/package/ManualPage/关于页动态/regression）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG); });
check('R48-14 手册同步：双口径导入说明 + 树展开折叠 + 看板删除入口 + 明细翻页说明', () => { const m = read('/newtab/manual-data.ts'); return m.includes('新增/导入双口径') && m.includes('新建 X') && m.includes('导 Y') && m.includes('收起到根部') && m.includes('看板') && m.includes('每页 20 条'); });


// ============== 第四十九轮 · V2.24.0：三大系统页改版批次1（调度台/方向台骨架 + 今日行动移除 + 数字槽重排） ==============
console.log('【第四十九轮 R49 批次1：调度台/方向台骨架 + 旧页移除 + 快捷键重排】');
check('R49-1/R50-F3（R73 修订）顶部导航三系统页：调度台（默认/）+ 方向台（/compass）+ 资源台（/curation → redirect 到 hub 工作区）', () => { const a = read('/newtab/App.vue'); const r = read('/newtab/router.ts'); return a.includes('>调度台') && a.includes('>方向台') && a.includes('>资源台') && a.includes("navigate('/curation')") && r.includes("path: '/curation'") && r.includes('redirect: to =>'); });
check('R49-2 A4 旧今日行动页移除：CompassActions.vue 不存在 + 路由 redirect / + 全仓无组件引用', () => { const fsx = require('fs'); const gone = !fsx.existsSync(path.resolve(base, 'newtab/views/CompassActions.vue')); const s = read('/newtab/router.ts'); const app = read('/newtab/App.vue'); return gone && s.includes("path: '/compass/actions',") && s.includes("redirect: '/'") && !app.includes('CompassActions'); });
check('R49-3 A2/B 调度台首页成立（R56-P2 修订）：今日记录 4 计数缩至页头 rec-mini 一行 + 记录抽屉（搜索+翻页20）保留', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('rec-mini') && s.includes("openRec('in')") && s.includes("openRec('out')") && s.includes("openRec('called')") && s.includes("openRec('log')") && s.includes('readEventLog') && s.includes('REC_PAGE_SIZE = 20') && s.includes('recPageCount') && !s.includes('rec-strip'); });
check('R49-4（R64 修订）三件事硬上限 3：FOCUS_LIMIT=3 + focusFull 逻辑 + 空位满员隐藏（锁定条已删）', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('FOCUS_LIMIT = 3') && s.includes('focusFull') && !s.includes('lock-bar') && s.includes('v-if="!focusFull"'); });
check('R51-F10 三件事/项目调度上下联动：split 纵向排列，分栏拖拽移除', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('flex-direction: column; gap: 14px') && !s.includes('split-handle') && s.includes('单击上方任务卡联动'); });
check('R49-6 B7（R55 重写）底部专区：好奇心培育命名保留 + 任务调度面板迁方向台复用', () => { const s = read('/newtab/views/CompassHome.vue'); const sh = read('/newtab/views/CompassShell.vue'); return s.includes('好奇心培育') && s.includes('<CuriosityPanel />') && !s.includes('TaskManagerPanel') && sh.includes('TaskManagerPanel'); });
check('R49-7 I2（R68 修订）数字槽：switchToIndex 1=方向台 2=资源台，用户工作台从 3 起（n-3）按台签顺序', () => { const a = read('/newtab/App.vue'); return a.includes('if (n === 1) { openCompass(); return }') && a.includes('if (n === 2) { openResource(); return }') && a.includes('const ws = store.workspaces[n - 3]') && !a.includes('store.workspaces[n - 1]'); });
check('R49-8 方向台骨架（R55 重写）：主航线 + 项目总览 ov-grid + 任务调度模块 + 完整方向树入口，无旧 Tab 侧栏', () => { const s = read('/newtab/views/CompassShell.vue'); return s.includes('项目总览') && s.includes('完整方向树') && s.includes('ov-grid') && s.includes('task-mgmt-module') && !s.includes('MetricBar') && !s.includes('今日行动') && !s.includes('cat-item'); });
check('R49-9 跨页跳转收口：GlobalPopups/GlobalSettings/Workspace/ResourceDetailDrawer 任务定位均指向 /（调度台）', () => { const g = read('/newtab/components/GlobalPopups.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); const w = read('/newtab/views/Workspace.vue'); const rd = read('/newtab/components/ResourceDetailDrawer.vue'); return !g.includes('/compass/actions') && !gs.includes('/compass/actions') && !w.includes('/compass/actions') && !rd.includes('/compass/actions'); });
check('R49-10 overlay 快捷操作：打开方向台（/compass），任务定位改 /（调度台）', () => { const o = read('/content/overlay-impl.ts'); return o.includes("label: '打开方向台'") && o.includes("route: '/compass'") && !o.includes('/compass/actions'); });
check('R49-11/R51-F14（R65 修订）指标条单行四指标：战略目标/WCE/WRR/未归档 + 三档档位 + 独立下钻', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('战略目标') && mb.includes('WCE 探索') && mb.includes('WRR 复用') && mb.includes('未归档') && mb.includes('unarchivedTaskCount') && mb.includes('openCell') && mb.includes('MetricDrillDrawer') && mb.includes("openCell('unarch')") && mb.includes("openCell('dhi')") && !mb.includes('mb-cells'); });
check('R49-12/R50-F5 未归档口径：compass.ts offCourseCount 保留 + taskArchiveIssue/unarchivedTaskCount 与 NorthStarPanel O23 一致', () => { const c = read('/newtab/stores/compass.ts'); return c.includes('function offCourseCount') && c.includes('function taskArchiveIssue') && c.includes('function unarchivedTaskCount') && c.includes('⚠ 指标失效'); });
check('R49-13/R51-F18/F19 主航线：全部项目 chip（R60：🎯 主攻置前，>6 折更多行内展开）+ 点击 chip 进项目详情', () => { const s = read('/newtab/components/compass/LighthousePanel.vue'); return s.includes('主航线') && s.includes("path: '/compass/projects', query: { p: p.id }") && s.includes('chipsOf') && s.includes('moreOf') && !s.includes('pinnedToLighthouse') && s.includes('CHIP_LIMIT') && s.includes('chip-proj') && s.includes('chip-more') && !s.includes('goMore') && !s.includes('mr-progress'); });
check('R49-14 C3/C6（R86 重指：实现已抽到 store）已完成项目显隐**三处过滤同源**（主航线/项目总览/完整方向树均消费 store 的 showDone；主航线模块化重排后无树状折叠工具）', () => { const s = read('/newtab/components/compass/LighthousePanel.vue'); const sh = read('/newtab/views/CompassShell.vue'); const t = read('/newtab/views/CompassTree.vue'); const st = read('/newtab/stores/compass.ts'); const m = read('/shared/models/index.ts'); return !s.includes('expandAll') && !s.includes('collapseAll') && m.includes('showDoneProjects?: boolean') && st.includes('const showDone = computed') && st.includes('function toggleShowDone') && s.includes('showDone') && sh.includes('showDone') && t.includes('showDone'); });
check('R49-15 C7 完整方向树：顶部统计（treeStats）+ 一键展开/收起 + 已完成过滤（visibleProjectsOf）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('treeStats') && t.includes('collapseAllNodes') && t.includes('visibleProjectsOf') && t.includes('完整方向树'); });
check('R49-16 C4（R60 修订）主航线重心标记口径：仅 🎯 主攻 isFocused（📡 投射标记退役）', () => { const s = read('/newtab/components/compass/LighthousePanel.vue'); return !s.includes('pinnedToLighthouse') && !s.includes('已投射') && s.includes('p.isFocused'); });
check('R49-17 C8 项目总览 CRUD：新建（openCreate/confirmCreate）+ 原位改名 + 摘除式删除（removeProject：任务转未归档/指标随项目移除）', () => { const s = read('/newtab/views/CompassShell.vue'); return s.includes('function openCreate') && s.includes('function confirmCreate') && s.includes('function renameProject') && s.includes('async function removeProject') && s.includes('t.projectId = undefined') && s.includes('dir.projects.splice'); });
check('R49-18 C8 置顶分组：Project.pinned 字段（与 pinnedToLighthouse 独立）+ pinnedGroup/normalGroup 两组呈现 + 跨区拦截', () => { const m = read('/shared/models/index.ts'); const s = read('/newtab/views/CompassShell.vue'); return m.includes('pinned?: boolean') && s.includes('pinnedGroup') && s.includes('normalGroup') && s.includes('跨区移动请先用 📌'); });
check('R49-19 C8 拖拽排序：onProjDragStart/Drop 组内 order 全量规整回写 + 编辑中禁拖（editingProjId）+ 渲染副本排序（不原地 sort 源数组）', () => { const s = read('/newtab/views/CompassShell.vue'); return s.includes('function onProjDrop') && s.includes('editingProjId') && s.includes('sortedCopy') && s.includes('x.order = i'); });
check('R49-20 D 项目详情：?p 持久定位（刷新可恢复）+ 归属链四段可点击 + 头部 ID chip/＋添加任务', () => { const s = read('/newtab/views/ProjectCuration.vue'); return s.includes('router.replace({ path: route.path, query: { p: p.id } })') && s.includes('ch-node clickable') && s.includes('addTaskFromHeader') && s.includes('ID · '); });
check('R49-21 D4/D5/D6 附件区+规则条+共享详情抽屉：tasksWithAssets 聚合 + AssetBadge 复用 + 好奇心规则提示条 + TaskDetailDrawer ref', () => { const s = read('/newtab/views/ProjectCuration.vue'); return s.includes('tasksWithAssets') && s.includes('<AssetBadge') && s.includes('转为任务 / 归档为资源') && s.includes('<TaskDetailDrawer ref="detailRef" />') && !s.includes('tdrawer'); });
check('R49-22 G 应用内双类型：搜索 Tab 增工作台（ws）/项目（proj）+ counts.ws/proj + wsTree 分类树 + locateCat 定位', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes("currentType==='ws'") && g.includes("currentType==='proj'") && g.includes('wsTree') && g.includes('function locateCat') && g.includes('proj:'); });
check('R49-23 G 打开路由：项目条目 → /compass/projects?p=（双端）+ 工作台分类定位 ?cat=', () => { const g = read('/newtab/components/GlobalPopups.vue'); const o = read('/content/overlay-impl.ts'); const w = read('/newtab/views/Workspace.vue'); return g.includes("/compass/projects', query: { p: item.id }") && o.includes("route: '/compass/projects?p=' + item.id") && w.includes('route.query.cat') && w.includes('catFlashId'); });
check('R49-24 G overlay 端：searchType 增 proj + 分组渲染 proj + ws 树分支（data-wscat）+ Tab 关键词直达', () => { const o = read('/content/overlay-impl.ts'); return o.includes("'all' | 'res' | 'task' | 'curio' | 'ws' | 'proj'") && o.includes("label: '📦 项目'") && o.includes('data-wscat') && o.includes("['项目', 'proj']"); });
check('R49-25/R66 刷新动画：index.html 品牌两行（知源调度台/万千可调用，自有我方向）+ 完成态（资源归位·调度就绪）+ main.ts 300-600ms 节奏 + Esc/单击跳过', () => { const h = read('/newtab/index.html'); const m = read('/newtab/main.ts'); return h.includes('知源调度台') && h.includes('万千可调用，自有我方向') && !h.includes('你不缺信息') && h.includes('资源归位 · 调度就绪') && m.includes('elapsed < 360') && m.includes('skipSplash') && m.includes("e.key === 'Escape'"); });
check('R49-26/R50-F8（R68 修订）快捷键全链：background open-tree/goto 命令分发 + App zy-toast 透传 + 设置页快捷键中心（chrome.commands 动态拉取）', () => { const b = read('/background/index.ts'); const a = read('/newtab/App.vue'); const g = read('/newtab/views/GlobalSettings.vue'); return b.includes("case 'open-tree':") && b.includes("case 'goto-curiosity':") && a.includes("type === 'zy-toast'") && g.includes('chromeCommands') && g.includes('chrome.commands.getAll'); });

// ============== 第四十九轮批次4：E 命名清扫/E2 手册/J·K 实测/E4 版本探针 ==============
console.log('【第四十九轮 · 批次4：命名清扫 + 手册重写 + J/K 实测 + 版本探针】');
check('R49-27 E1 src 内旧品牌词清零（知源罗盘/知源引擎/好奇心卡库/任务卡库/知源北极星/项目策展 不再出现在 src）', () => { let hit = 0; for (const f of ['newtab/views/CompassHome.vue', 'newtab/views/CompassShell.vue', 'newtab/router.ts', 'newtab/App.vue', 'background/index.ts', 'content/overlay-impl.ts']) { const s = read('/' + f); if (s.includes('知源罗盘') || s.includes('知源引擎') || s.includes('好奇心卡库') || s.includes('任务卡库') || s.includes('知源北极星') || s.includes('项目策展')) hit++; } return hit === 0; });
check('R49-28 E2 手册全量重写：三件事/上限 + 项目总览管理 + 快捷键/刷新动画说明（R48-14 字符串保留）', () => { const s = read('/newtab/manual-data.ts'); return s.includes('三件事') && s.includes('上限') && s.includes('项目总览') && s.includes('快捷键') && s.includes('刷新动画') && s.includes('新增/导入双口径') && s.includes('每页 20 条'); });
check('R49-29 J 性能实测脚本：scripts/test-perf.cjs（首屏/Splash 探针/路由切换 ≤300ms 五次实测）', () => { const s = fs.readFileSync(path.resolve(__dirname, 'test-perf.cjs'), 'utf8'); return s.includes('__zySplashMs') && s.includes('ROUTE_SEL') && s.includes('routeSeq') && s.includes('300'); });
check('R49-30 K 导入兼容实测脚本：scripts/test-import-compat.cjs（V2.21.3 旧形状 → 并集合并 + pinned/order 缺省 + 方向台渲染）', () => { const s = fs.readFileSync(path.resolve(__dirname, 'test-import-compat.cjs'), 'utf8'); return s.includes('legacy') && s.includes('K 兼容项目') && s.includes('pinned === undefined') && s.includes('ov-card-item'); });
check('R49-31 Splash 节奏探针：main.ts mount 注入 __zySplashMs（J-2 实测口径）+ 第二段定时器漂移校正（220ms 淡出）', () => { const m = read('/newtab/main.ts'); return m.includes('__zySplashMs') && m.includes('220 - late') && m.includes('Math.max(0, 220 - late)'); });
check('R49-32 E4 版本五处同步（manifest/package/ManualPage + regression 两处版本断言）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG); });


// ============== 第五十轮 · V2.24.0：Bug修复 + 首页布局 + 主航线/指标条 + 策展中心 + 快捷键/Splash ==============
console.log('【第五十轮 · V2.24.0：方向树跳转修复 + 主航线紧凑化 + 策展中心 + 快捷键/Splash】');
check('R50-1 B1/B2 CompassShell 嵌套 RouterView：子路由激活渲染二级页（完整方向树/项目详情可跳转）', () => { const s = read('/newtab/views/CompassShell.vue'); return s.includes('<RouterView v-if="isChildActive" />') && s.includes("route.matched.length > 1"); });
check('R51-B5 刷新回调度台：isReady 后 replace，仅 /settings /manual 白名单（方向树/项目详情不再豁免）', () => { const m = read('/newtab/main.ts'); return m.includes('router.isReady()') && m.includes("startsWith('/settings')") && m.includes("startsWith('/manual')") && !m.includes("startsWith('/compass/projects')") && !m.includes("startsWith('/compass/tree')"); });
check('R50-3 B4 页面标题左对齐：CompassHome/CompassShell/ProjectCuration page-head 内缩 22px', () => { const h = read('/newtab/views/CompassHome.vue'); const sh = read('/newtab/views/CompassShell.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return h.includes('padding-left: 22px') && sh.includes('padding-left: 22px') && pc.includes('.page { max-width: 1440px'); });
check('R50-4 F1（R52 修订：三件事横向并列）三槽一行 + 项目调度右上角方向树入口', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('grid-template-columns: repeat(3, 1fr)') && s.includes("router.push('/compass/tree')") && s.includes('方向树'); });
check('R50-5 F2 数据存储状态栏：repository lastSaveOkAt + CompassHome storage-chip（正常/异常+重试）', () => { const r = read('/shared/storage/repository.ts'); const h = read('/newtab/views/CompassHome.vue'); return r.includes('getLastSaveOkAt') && r.includes('function markSaveOk') && h.includes('storage-chip') && h.includes('onStorageClick') && h.includes('saveDataNow'); });
check('R50-6 F7（R56-P2 修订）今日记录明细收进抽屉：CARD_KINDS 口径（三卡事件+调出，系统事件灰显不计数）+ 抽屉保留', () => { const s = read('/newtab/views/CompassHome.vue'); return s.includes('CARD_KINDS') && s.includes('loadEventLog') && s.includes('调出 · ') && s.includes('系统 · ') && !s.includes('breakdownOf'); });
check('R50-7 F6 更名好奇心培育：CompassHome Tab + CuriosityPanel + 手册 + E2E 全链无「问题探索」', () => { const h = read('/newtab/views/CompassHome.vue'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const m = read('/newtab/manual-data.ts'); return h.includes('好奇心培育') && cp.includes('好奇心培育') && m.includes('好奇心培育') && !h.includes('问题探索') && !cp.includes('问题探索'); });
check('R51-F15 DHI 明细定位（R57-F3 修订）：LighthousePanel 监听 zy-locate-goal 滚动+goalFlash；完整指标 Drawer 随「详细指标」移除', () => { const s = read('/newtab/components/compass/LighthousePanel.vue'); const mb = read('/newtab/components/compass/MetricBar.vue'); return s.includes('zy-locate-goal') && s.includes('goalFlash') && s.includes('data-dir-id') && !mb.includes('<Drawer') && !mb.includes('<NorthStarPanel />'); });
check('R50-9（R65 修订）指标条第4格未归档任务（N/M 分母）+ 统一下钻 + 档位并入单行 mb-row', () => { const s = read('/newtab/components/compass/MetricBar.vue'); const c = read('/newtab/stores/compass.ts'); return s.includes('未归档任务') && s.includes('mb-denom') && s.includes('unarchivedTaskCount') && s.includes('totalTaskCount') && s.includes('mb-row') && s.includes('mb-period') && c.includes('function taskArchiveIssue') && c.includes("if (!proj.metrics.some(mt => mt.id === t.metricId)) return '⚠ 指标失效'"); });
check('R50-10（R73 重写）资源台路由收敛：/curation 为 redirect（显式透传 query，保 ?hl= 定位）而非独立组件；hub 承接原生卡 curOrder', () => { const r = read('/newtab/router.ts'); const w = read('/newtab/views/Workspace.vue'); const m = read('/shared/models/index.ts'); return r.includes("path: '/curation'") && r.includes('CURATION_WS_ID') && r.includes('query: to.query') && w.includes('curOrder') && m.includes('CurationProjection') && m.includes("CURATION_WS_ID = 'zy-curation'"); });
check('R50-11 F3 投射入口（R61 方向反转）：资源台卡面 📡/分类 📤（CurationCenter）+ hub.ts 服务；旧方向入口已拆除', () => { const a = read('/newtab/App.vue'); const c = read('/newtab/views/Workspace.vue'); const h = read('/shared/storage/hub.ts'); return !a.includes('projectWorkspaceToCuration') && c.includes('openMirrorCard') && c.includes('openMirrorCat') && h.includes('projectCardToBoard') && h.includes('mirrorCategoryToBoard'); });
check('R50-12 F8 open-tree 快捷键：manifest 命令 + background 分发 /compass/tree + 设置页文案含完整方向树', () => { const mf = read('/manifest.ts'); const b = read('/background/index.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return mf.includes("'open-tree': {") && b.includes("case 'open-tree'") && b.includes("route: '/compass/tree'") && g.includes('完整方向树'); });
check('R50-13 F9 Splash 镂空「知」：index.html .dot 内 i 知 + 占位 logo 注释', () => { const h = read('/newtab/index.html'); return h.includes('<i>知</i>') && h.includes('R50-F9'); });
check('R63-15 手册重写（R63 口径）：资源台/策展台术语切换（无策展中心/用户工作台旧词）+ 金字塔/指标卡/中心论点 + Airtable 同步章节 + sync-airtable 快捷键', () => { const m = read('/newtab/manual-data.ts'); return m.includes('资源台：资源卡真身的唯一居所') && m.includes('策展台：为一次策展而生的专题空间') && !m.includes('策展中心') && !m.includes('用户工作台') && m.includes('5 指标卡') && m.includes('金字塔') && m.includes('设为中心论点') && m.includes('Airtable 同步（进阶）') && m.includes('同步到 Airtable') && m.includes('最多 4 级'); });

// ============== 第五十一轮 · V2.24.0：刷新回首页 + 详情抽屉回归 + 上下联动 + 下钻右侧抽屉 + 主航线投射口径 ==============
console.log('【第五十一轮 · V2.24.0：下钻右侧抽屉 + 上下联动 + 详情页回归】');
check('R51-1 B5 刷新回调度台：main.ts 仅 settings/manual 白名单（方向树/项目详情/策展中心一律回首页）', () => { const m = read('/newtab/main.ts'); return m.includes('R51-B5') && !m.includes("startsWith('/compass/projects')") && !m.includes("startsWith('/compass/tree')") && !m.includes("startsWith('/curation')"); });
check('R51-2 B6 新建任务后直接打开 R48 详情抽屉：TaskAddDrawer emit created + 三宿主接线', () => { const a = read('/newtab/components/TaskAddDrawer.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); const pd = read('/newtab/components/ProjectDetailDrawer.vue'); const ct = read('/newtab/views/CompassTree.vue'); return a.includes("@created") || (a.includes("created: [task: TaskCard]") && a.includes("emit('created', task)")) && (pc.includes('@created="onTaskCreated"') && pd.includes('@created="onTaskCreated"') && ct.includes('@created="onTaskCreated"')); });
check('R51-3 三类卡详情抽屉保持 R48 设计（TaskDetailDrawer ds 结构 + CuriosityPanel Drawer 详情 + ResourceDetailDrawer）', () => { const t = read('/newtab/components/compass/TaskDetailDrawer.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue'); return t.includes('ds-hero-label') && t.includes('ds-props2') && t.includes('ds-details') && c.includes('ds-quote') && c.includes('recordCardOpen'); });
check('R51-4 B7 仪表盘下钻抽屉撑满：gs-drawer-fill（搜索固定+列表 flex+翻页贴底）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('gs-drawer-fill') && g.includes('.gs-drawer-fill .gs-ev-list { flex: 1; max-height: none'); });
check('R51-5 F10 三件事上下联动：split 纵向 + 无分栏拖拽 + 项目调度文案「单击上方任务卡联动」', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.split { display: flex; flex-direction: column; gap: 14px') && !h.includes('split-handle') && h.includes('单击上方任务卡联动'); });
check('R51-6 F11 页头标题统一放大：三主页面 + 项目详情/方向树 crumb 19px', () => { const h = read('/newtab/views/CompassHome.vue'); const sh = read('/newtab/views/CompassShell.vue'); const cc = read('/newtab/views/Workspace.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); const ct = read('/newtab/views/CompassTree.vue'); const u = 'font-size: 19px; letter-spacing: .3px'; return h.includes(u) && sh.includes(u) && cc.includes(u) && pc.includes(u) && ct.includes(u); });
check('R51-7 F12（R52-BUG-1 合并明细）写入记录按时间倒序：三卡事件+调出+系统灰显合并降序', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('R52-BUG-1') && h.includes('sort((a, b) => b.ts - a.ts)') && h.includes('调出 · '); });
check('R51-8/R66 关于页 slogan 统一「万千可调用，自有我方向。」', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('万千可调用，自有我方向') && !g.includes('你不缺信息'); });
check('R51-9 F14/F17 方向台四格独立明细抽屉：MetricDrillDrawer（dhi/wce/wrr/unarch 各自明细 + 级联归档 + 定位）', () => { const m = read('/newtab/components/compass/MetricDrillDrawer.vue'); return m.includes("cell: '' | 'dhi' | 'wce' | 'wrr' | 'unarch'") && m.includes('locateGoal') && m.includes('locateCurio') && m.includes('locateRes') && m.includes('locateTask') && m.includes('changeTaskProject') && m.includes('taskArchiveIssue'); });
check('R51-10 F16 调度台记录条右侧抽屉：Drawer 组件 + rec-fill 撑满贴底', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('<Drawer :open="!!recOpen"') && h.includes('.rec-fill') && h.includes('.rec-list-scroll'); });
check('R51-11 F15（R55-B3 重写）定位链路：zone=task → CompassShell 滚动定位任务模块 + DHI 目标行 data-dir-id', () => { const sh = read('/newtab/views/CompassShell.vue'); const lp = read('/newtab/components/compass/LighthousePanel.vue'); return sh.includes('route.query.zone') && sh.includes('task-mgmt-module') && sh.includes('moduleFlash') && lp.includes('data-dir-id') && lp.includes('goalFlash'); });

check('R51-12（R74 重写）待分类落点：未归类投射与「待分类」根节点可接收拖拽', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('cardDropTarget') && w.includes('onUncatDragOver') && w.includes('onUncatDrop') && w.includes('待分类');
});
check('R51-13（R74 重写）目录树一键展开/收起（expandAllCats/collapseAllCats + collapsedCats 取反）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function expandAllCats') && w.includes('function collapseAllCats') && w.includes('collapsedCats') && w.includes('toggleCatCollapse');
});
// R74 退役 R51-14：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
check('R51-15（R74 重写）跨分类拖拽：投射卡改 targetCatId（源数据不动）+ 可拖入任意策展分类', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function moveMirrorTo') && w.includes('p.targetCatId = catId || undefined') && w.includes('function onCatDrop');
});
check('R51-16（R74 重写）单击详情/双击开链：onCardClick 260ms 判别 + onCardDblClick', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function onCardClick') && w.includes('function onCardDblClick') && w.includes('260');
});
check('R51-17（R65 修订）F23 字段池退役：资源台编辑对齐旧工作台统一走共享 ResourceEditForm（自定义字段经字段配置承接）', () => { const c = read('/newtab/views/Workspace.vue'); return !c.includes('fieldPool') && !c.includes('addPoolField') && !c.includes('mc-pool-select') && c.includes('ResourceEditForm'); });
check('R51-18（R74 重写）遗留 workspace/category 投射记录由 migrateCurationTree 启动期物化后移除', () => {
  const g = read('/shared/storage/curationMigration.ts');
  return g.includes("p.kind === 'workspace'") && g.includes("d.curationProjections = projections.filter(p => p.kind === 'card')");
});
console.log('【第五十二轮 · V2.25.0：三 Bug 修复 + 首页布局改版 + 主航线全量 + 策展镜像升级】');
check('R52-1 BUG-1 写入记录主计数=三卡事件+三卡调出（CARD_KINDS 过滤，主数=副行之和）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes("const CARD_KINDS = new Set(['task', 'curiosity', 'resource'])") && h.includes('logRaw.value.filter(e => CARD_KINDS.has(e.kind)).length + todayCalled.value.length'); });
check('R52-2 BUG-1 明细与指标同源：调出条目入写入记录明细 + 系统事件灰显不计数', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('调出 · ') && h.includes('系统 · ') && h.includes('.picker-item.sys'); });
check('R52-3 BUG-2 isProjectDone 共享口径（R56-PERF-c 修订：projectTasksOf 共享索引；口径不变=手动 done/archived + 全任务完成派生）', () => { const s = read('/newtab/stores/compass.ts'); return s.includes('function isProjectDone') && s.includes("tasks.length > 0 && tasks.every(t => t.status === 'done')") && s.includes('const tasks = projectTasksOf(project.id)') && s.includes('isProjectDone, projectTasksOf, offCourseCount'); });
check('R52-4 BUG-2 五处过滤统一 isProjectDone（主航线/项目总览/方向树/搜索计数/搜索列表），archived 旧口径清零', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); const sh = read('/newtab/views/CompassShell.vue'); const t = read('/newtab/views/CompassTree.vue'); const g = read('/newtab/components/GlobalPopups.vue'); const bad = "p.status !== 'archived'"; return l.includes('!isProjectDone(p)') && sh.includes('!isProjectDone(p)') && t.includes('!isProjectDone(p)') && (g.match(/isProjectDone\(p\)/g) || []).length >= 2 && !l.includes(bad) && !sh.includes(bad) && !t.includes(bad) && !g.includes(bad); });
check('R52-5 BUG-3 工作台枚举全局排除策展空间（app.ts workspaces computed 过滤 CURATION_WS_ID）', () => { const a = read('/newtab/stores/app.ts'); return a.includes("import { CURATION_WS_ID } from '@/shared/models'") && a.includes('w.id !== CURATION_WS_ID'); });
check('R52-6 F1 三件事横向并列 3 槽一行（窄窗口降级 1 列）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.today-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }') && h.includes('.today-cards { grid-template-columns: 1fr; }'); });
check('R52-7 F2（R56-P1 修订）项目调度左右两列可拖拽（cur-split 常显分隔条 + curSplit 持久化 + 列宽 value 绑定修复；4 指标恢复左列）', () => { const h = read('/newtab/views/CompassHome.vue'); const m = read('/shared/models/index.ts'); return h.includes('minmax(0, ' + String.fromCharCode(36) + '{curSplit.value}%) 8px 1fr') && h.includes('startCurSplitDrag') && h.includes('saveUIPrefs({ curSplit: curSplit.value })') && h.includes('cur-stats-v2') && h.includes('.cur-split::after') && m.includes('curSplit?: number'); });
check('R52-8 F2 指标组默认全展开可折叠（collapsedGroups）+ 任务去关联 unlinkTask（摘除 projectId/metricId 转未归档）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('collapsedGroups') && h.includes('function toggleGroup') && h.includes('function unlinkTask') && h.includes('转为未归档任务'); });
check('R52-9 F4 主航线全量呈现（R60 修订：🎯 主攻→order 排序，投射权重移除；>6 折更多）', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); return l.includes('R52-F4（修订 R51-F18 口径）') && !l.includes('.filter(p => p.pinnedToLighthouse)') && l.includes('Number(b.isFocused) - Number(a.isFocused)') && l.includes('CHIP_LIMIT = 6'); });
check('R52-10 F5 项目详情移除「← 返回项目列表」按钮（closeProject 清零；唯一返回=右上角返回方向台）', () => { const p = read('/newtab/views/ProjectCuration.vue'); return !p.includes('← 返回项目列表') && !p.includes('closeProject') && p.includes("router.push('/compass')"); });
check('R52-11 F6 添加成功指标并入头部操作区（headerMetricAdding 输入行；原底部通栏按钮移除）', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('startHeaderAddMetric') && p.includes('confirmHeaderAddMetric') && p.includes('metric-add-row') && !p.includes('＋ 添加成功指标（同步方向树）</button>'); });
check('R52-12 F8 完整方向树返回方向台入口（tree-tool accent）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('返回方向台') && t.includes("router.push('/compass')") && t.includes('tree-tool accent'); });
check('R52-13 F7a（R61 退役）整工作台打包镜像已移除——方向反转为资源台→策展台（mirrorCategoryToBoard）', () => { const a = read('/newtab/App.vue'); const h = read('/shared/storage/hub.ts'); return !a.includes('projectWorkspaceToCuration') && h.includes('mirrorCategoryToBoard') && h.includes('curFrom: { wsId: CURATION_WS_ID'); });
check('R52-14（R74 重写）分类节点拖拽：排序/成父子（最多两级）+ 新建子分类', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function onCatDragStart') && w.includes('function onCatDragOver') && w.includes('function onCatDrop') && w.includes('function onCatRootDrop') && w.includes('openCreateCat');
});
check('R52-15（R74 重写）卡片自由拖拽：资源台树落 + 策展台镜像卡拖拽=只改投射落点（moveMirrorTo）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('moveMirrorTo') && w.includes('isMirrorView') && w.includes('p.targetCatId = catId || undefined');
});
check('R52-16（R74 重写）策展归属统一 categoryId（curCatId 退役由迁移清空）+ 新建直入当前分类', () => {
  const m = read('/shared/models/index.ts');
  const w = read('/newtab/views/Workspace.vue');
  return m.includes('R53-A1 迁移后不再使用') && w.includes('editingResource.categoryId = newCardCatId()');
});
check('R52-17（R74 重写）镜像分类子分类同构呈现 + 遗留形状由迁移归一', () => {
  const w = read('/newtab/views/Workspace.vue');
  const g = read('/shared/storage/curationMigration.ts');
  return w.includes('childCatsOf') && g.includes('p.targetCatId = byRecordId.get(p.targetCatId)') && g.includes('r.curCatId = undefined');
});
check('R52-18 版本五处同步（manifest/package/ManualPage/regression 两处 + 关于页动态）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG); });
console.log('');

// ============== 第五十三轮 · V2.26.0：策展统一树（镜像物化/拖拽父子）+ 工作台卡面镜像 + 三件事精简强化 + 主题四套 + 盘点 P0/P1/P2 修复 ==============
console.log('【第五十三轮 · V2.26.0：策展统一树 + 主题精简 + 盘点修复】');
check('R53-1 A1 迁移模块：遗留 category/workspace 投射记录物化为 curFrom 真实分类（幂等：迁移后仅剩 card 记录）', () => { const g = read('/shared/storage/curationMigration.ts'); return g.includes('export function migrateCurationTree') && g.includes("materialize(d, p.wsId, p.catId, p.displayName || sourceCatName(d, p.catId))") && g.includes("p.kind === 'workspace'") && g.includes("d.curationProjections = projections.filter(p => p.kind === 'card')"); });
check('R53-2（R64 扩展）迁移接线：app.ts init 调用 migrateCurationTree + migrateHubStructure + migrateHubMerge 且变更时 persist', () => { const a = read('/newtab/stores/app.ts'); return a.includes('migrateCurationTree(data.value)') && a.includes('migrateHubStructure(data.value)') && a.includes('migrateHubMerge(data.value)') && a.includes('if (t1 || t2 || t3) saveData()'); });
check('R53-3 A1 模型：Category.curFrom 溯源字段（wsId/catId/projId）+ curCatId 退役注释', () => { const m = read('/shared/models/index.ts'); return m.includes('curFrom?: { wsId: ID; catId: ID; projId: ID }') && m.includes('R53-A1 迁移后不再使用'); });
check('R53-4（R74 重写）统一树：镜像分类与原生分类同一棵树渲染（isMirrorCat 徽标、无独立镜像分组分区）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('isMirrorCat(sc.cat)') && !w.includes('📡 镜像分组');
});
check('R53-5（R74 重写）节点拖拽落点标记：markDrop 命中区 + dropMark 状态 + onCatDrop 落位', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function markDrop') && w.includes('dropMark') && w.includes('function onCatDrop');
});
check('R53-6（R74 重写）层级上限 MAX_CAT_LEVEL=4 + 超限拒绝（levelOf+heightOf）+ 深查防环', () => {
  const t = read('/shared/utils/catTree.ts');
  const w = read('/newtab/views/Workspace.vue');
  return t.includes('export const MAX_CAT_LEVEL = 4') && w.includes('levelOf(target) + heightOf(dragged) > MAX_CAT_LEVEL') && w.includes('function descendantIds');
});
// R74 退役 R53-7：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
check('R53-8 A3 删除策展台级联：清理其策展镜像分类（卡回落/投射回待分类/子提根）', () => { const a = read('/newtab/App.vue'); return a.includes('级联清理该策展台的策展镜像分类') && a.includes('mirrorIds.has(p.targetCatId)'); });
check('R53-9 A3（R61 方向反转）分类镜像物化：hub.ts mirrorCategoryToBoard 在目标策展台生成 curFrom 分类（源=资源台）', () => { const h = read('/shared/storage/hub.ts'); const w = read('/newtab/views/Workspace.vue'); return h.includes('curFrom: { wsId: CURATION_WS_ID, catId: hubCatId') && !w.includes("kind: 'category'"); });
check('R53-10 A3 删除源分类级联：清理对应策展镜像分类（curFrom.catId === cat.id）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('curFrom?.catId === cat.id') && w.includes('级联清理该源分类的策展镜像分类'); });
check('R53-11（R74 重写）卡面镜像入口：资源台卡面 📡 镜像到策展台；策展台侧旧入口已拆', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('title="镜像到策展台"') && w.includes('openMirrorCard(r)') && !w.includes('projectCardToCuration');
});
check('R53-12 C1 三件事精简：从库选取按钮移除（today-toolbar 清零）+ 复制昨日/导出移卡片头部', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('today-toolbar') && h.includes('@click="copyYesterday"') && h.includes('@click="openExportModal"') && h.includes('<div class="card focus">'); });
check('R53-13 C1 视觉强化：card focus 焦点模块样式（渐变底/描边/标题放大/编号强调）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.card.focus') && h.includes('.card.focus .card-head .nm') && h.includes('.card.focus .tc-num'); });
check('R53-14 C2（R55-B3 重写）定位链路：locateRec 任务 → /compass?zone=task，好奇 → /?hl', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes("{ path: '/compass', query: { zone: 'task', hl: x.id } }") && h.includes("{ path: '/', query: { hl: x.id } }"); });
check('R53-15 D 主题精简四套：tokens.css 无 green/night 块 + App themes 四项 + repository 存量主题迁移', () => { const t = read('/shared/styles/tokens.css'); const a = read('/newtab/App.vue'); const r = read('/shared/storage/repository.ts'); return !t.includes("[data-theme='green']") && !t.includes("[data-theme='night']") && t.includes("[data-theme='linear']") && t.includes("[data-theme='apple']") && t.includes("[data-theme='raycast']") && t.includes("[data-theme='notion']") && a.includes("id: 'raycast'") && !a.includes("id: 'green'") && !a.includes("id: 'night'") && r.includes("uiCache.theme === 'green' || uiCache.theme === 'night'"); });
check('R53-16 E1（P0 修复）导入合并补 curationProjections（备份→恢复不再丢投射）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('d.curationProjections = mergeById(d.curationProjections || [], imported.curationProjections || [])'); });
check('R53-17（R74 重写）删除分类引用回落 + 镜像记录清理：子分类提根 + 卡片回落待分类 + 清 targetWsId 投射', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('kids.forEach(k => { k.parentId = undefined })') && w.includes('r.categoryId === cat.id') && w.includes('p.targetCatId = undefined') && w.includes('p.targetWsId === workspaceId.value && p.targetCatId === cat.id');
});
check('R53-18 E3 saveData 序列化 try 包裹（异常走 SaveError serial，不再定时器内未捕获）', () => { const r = read('/shared/storage/repository.ts'); return r.includes('R53-E3：序列化包 try') && r.includes('} catch (e) { emitSaveError(e); return }'); });
check('R53-19 E3 引导兜底：main.ts bootDataRobust 重试一次+失败不挂载（防空数据覆写真实数据）', () => { const m = read('/newtab/main.ts'); return m.includes('bootDataRobust') && m.includes('应用未启动以保护本地数据') && m.includes('bootstrapSafe'); });
check('R53-20 E3 子帧选区消息消毒：selection 接收侧字段类型校验+长度截断', () => { const s = read('/content/selection.ts'); return s.includes('const clip = (v: unknown, cap: number)') && s.includes('v.slice(0, cap)') && s.includes("clip(d0?.__zy_sel?.text, 8000)"); });

// ============== 第五十四轮 · V2.27.0：方向台二级导航闭环（方案A）+ 项目调度分栏拖拽/指标下钻 + 任务调度快捷键 + 策展拖拽修复 + 设置四组 + 图标去重 ==============
console.log('【第五十四轮 · V2.27.0：二级导航闭环 + 分栏拖拽/下钻 + 策展拖拽修复 + 设置四组】');
check('R54-1 A1（R59-T1 修订）项目详情返回按钮恒为「← 返回方向台」（完整方向树有独立入口）+ 面包屑 crumb-up', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('<button class="mini-btn" @click="goBack">← 返回方向台</button>') && p.includes('crumb-up') && !p.includes("返回方向树"); });
check('R54-2 A1 方向树来源感知返回 + 面包屑（from=proj&p= → 返回项目详情）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes("const fromProjId = computed") && t.includes("fromProjId ? '返回项目详情' : '返回方向台'") && t.includes('crumb-up'); });
check('R54-3 A3 项目详情跳树带定位：goTreeLocated 携带 from=proj & p & hl=<dirId>', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('function goTreeLocated') && p.includes("from: 'proj'") && p.includes('hl: dir.id') && !p.includes("@click=\"router.push('/compass/tree')\""); });
check('R54-4 A3 方向树接收 ?hl 定位：locateHlGoal 滚动+goal-flash 闪烁 + goal-node data-dir-id', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('function locateHlGoal') && t.includes(':data-dir-id="dir.id"') && t.includes('goal-flash'); });
check('R54-5 A2 方向树项目节点直达项目详情页（📄 node-action，from=tree 闭环）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes("title=\"进入项目详情页\"") && t.includes("{ path: '/compass/projects', query: { p: proj.id, from: 'tree' } }"); });
check('R54-6 A4 Esc 返回：两二级页 onPageEsc（抽屉/弹层打开时让位自关）', () => { const p = read('/newtab/views/ProjectCuration.vue'); const t = read('/newtab/views/CompassTree.vue'); const guard = "document.querySelector('.task-sidebar, .overlay, .modal-mask')"; return p.includes('function onPageEsc') && t.includes('function onPageEsc') && p.includes(guard) && t.includes(guard); });
check('R54-7 B1 分栏拖拽：cur-split 分隔条 + 30–75% 钳制 + UIPrefs.curSplit 持久化 + models 字段', () => { const h = read('/newtab/views/CompassHome.vue'); const m = read('/shared/models/index.ts'); return h.includes('Math.min(75, Math.max(30,') && h.includes('saveUIPrefs({ curSplit: curSplit.value })') && h.includes('class="cur-split"') && m.includes('curSplit?: number'); });
check('R54-8 B2 指标下钻：4 指标卡 openCurDrill 弹窗（指标清单/任务明细 + 单击任务开详情抽屉）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes("openCurDrill('metrics')") && h.includes("openCurDrill('total')") && h.includes("openCurDrill('done')") && h.includes("openCurDrill('doing')") && h.includes('drillTasks') && h.includes('drawerRef?.open(t)'); });
check('R54-9 C1（R55-C 重写）open-tasks = 快速采集任务：manifest 描述 + background 三端分发（浮层/降级 popup mode=task）', () => { const mf = read('/manifest.ts'); const b = read('/background/index.ts'); return mf.includes('快速采集任务') && b.includes("case 'open-tasks'") && b.includes("'zy-open-task-capture'") && b.includes("mode: 'task'"); });
check('R54-10（R74 重写）区域级落卡与混排重编号：onAreaDrop + reorderMixed + 卡对卡 drop', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function onAreaDrop') && w.includes('function reorderMixed') && w.includes('function onDropCard') && w.includes('@drop="onAreaDrop($event, g.key)"');
});
// R74 退役 R54-11：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
check('R54-12（R74 重写）dragend 统一复位 clearDragState + 卡片拖过落点标记 dropMark', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function clearDragState') && (w.match(/@dragend="clearDragState"/g) || []).length >= 2 && w.includes('dropMark');
});
check('R54-13 F1 工作台名图标去重：下拉渲染 name 去前缀（GlobalSettings 5 处 + CuriosityPanel 1 处）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue'); const bad = '{{ w.icon }} {{ w.name }}'; return !g.includes(bad) && !c.includes(bad) && g.split('w.name.replace(').length - 1 >= 5 && c.includes('w.name.replace('); });
check('R63-16 手册同步口径更新（替代 R54-14 策展段）：快速采集任务语义 + 二级导航 + 分栏下钻 + 金字塔拖拽语义（R61 结构反转后策展段重写）', () => { const m = read('/newtab/manual-data.ts'); return m.includes('快速采集任务') && m.includes('二级导航（R54）') && m.includes('中缝分隔条可左右拖拽') && m.includes('节点可拖挂子级'); });

// ============== 第五十五轮 · V2.28.0：策展混排平权 + 任务调度迁方向台 + 快速采集任务三端 + 方向状态迁调度台 + DHI 新口径 + 分栏修复 + 项目详情双列目录 + 检索免确认 + 体积 ==============
console.log('【第五十五轮 · V2.28.0：八包迭代】');
check('R55-1 E 分栏拖拽根因修复：列宽绑定补 .value（此前 ref 插值生成非法 CSS 被 CSSOM 静默拒绝）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('curSplit.value}%) 8px 1fr') && !h.includes('${curSplit}%)'); });
check('R55-2 E 分隔条常显 + 命中区 8px + 窄窗隐藏', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.cur-split::after') && h.includes('width: 8px') && h.includes('.cur-split { display: none; }'); });
check('R55-3/R66 方向状态迁调度台：CompassHome 顶部挂 MetricBar（带 #right 扩展位），CompassShell 不再引用', () => { const h = read('/newtab/views/CompassHome.vue'); const sh = read('/newtab/views/CompassShell.vue'); return h.includes('import MetricBar') && h.includes('<MetricBar>') && h.includes('template #right') && !sh.includes('MetricBar'); });
check('R55-4 D2（R56-P1 修订）项目调度 4 指标恢复左列一行四格（cur-stats-v2 点击下钻保留；头部混淆源 cur-stat-strip 移除）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('cur-stats-v2') && h.includes("openCurDrill('metrics')") && h.includes("openCurDrill('total')") && h.includes("openCurDrill('done')") && h.includes("openCurDrill('doing')") && !h.includes('cur-stat-strip'); });
check('R55-5（R64 修订）MetricBar 主数字=战略目标数（dhi.goals 直读）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('m.value.dhi.goals'); });
check('R55-6（R64 修订）MetricDrillDrawer dhiRows=项目数/推进中项目数（每目标行）', () => { const md = read('/newtab/components/compass/MetricDrillDrawer.vue'); return md.includes('const pushing = projs.filter') && md.includes('📦 项目 {{ row.pinned }} · 推进中 {{ row.active }}'); });
check('R55-7（R74 重写）资源台分组：curOrder 统一排序键 + resourceGroups 分区呈现', () => {
  const m = read('/shared/models/index.ts');
  const w = read('/newtab/views/Workspace.vue');
  return m.includes('curOrder?: number') && w.includes('resourceGroups') && w.includes('curOrder');
});
check('R55-8（R74 重写）混排重编号 reorderMixed（物化拖拽序，落位后写 curOrder）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function reorderMixed') && w.includes('curOrder');
});
check('R55-9 C1 应用内任务采集：GlobalPopups taskcapture 面板（四字段非必填 + Ctrl+Enter 保存全域任务）', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes("'taskcapture'") && g.includes('function saveTaskCapture') && g.includes('快速采集任务'); });
check('R55-10 C2 三端分发：App.vue 转发 zy-open-task-capture + overlay openTaskCapture + IMPL_ENTRY 注册 + popup mode=task', () => { const a = read('/newtab/App.vue'); const ov = read('/content/overlay-impl.ts'); const so = read('/content/search-overlay.ts'); const pp = read('/popup/App.vue'); return a.includes("zy-open-task-capture") && ov.includes('async function openTaskCapture') && so.includes("'zy-open-task-capture': 'openTaskCapture'") && pp.includes("mode.value = 'task'"); });
check('R55-11 H1 应用内检索删除免确认：deleteItem 无 useConfirm（allResults 过滤即时消失）', () => { const g = read('/newtab/components/GlobalPopups.vue'); const i = g.indexOf('async function deleteItem'); const seg = g.slice(i, i + 500); return seg.includes('deletedAt = Date.now()') && !seg.includes('useConfirm'); });
check('R55-12 H2 网页浮层补删除：结果行 🗑 + bindResultEvents 委托（stopPropagation 软删 + renderResults 刷新）', () => { const ov = read('/content/overlay-impl.ts'); return ov.includes('zy-ri-del') && ov.includes('已删除，可在回收站恢复') && ov.includes('searchResults = searchResults.filter'); });
check('R55-13 F3 拼音缓存 LRU（逐出最旧，不再整表 clear）', () => { const p = read('/shared/utils/pinyin.ts'); return p.includes('CACHE_MAX') && p.includes('oldest !== undefined) cache.delete(oldest)') && !p.includes('cache.clear()'); });
check('R55-14 F4 工作台卡片 content-visibility: auto（切台渲染段优化）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('content-visibility: auto'); });
check('R55-15 F1 图标瘦身：public/icons 仅保留 manifest 引用的 16/32/48/128', () => { const dir = path.resolve(__dirname, '..', 'public', 'icons'); const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []; return files.length === 4 && !files.some(f => f.includes('256') || f.includes('512')); });
check('R55-16 G1 项目详情左栏双列目录树：proj-rail（全部项目 + 当前项目树）+ 拖任务跨指标/拖指标重排 metrics', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('proj-rail') && pc.includes('function treeMetricDrop') && pc.includes('function treeTaskDropOnMetric') && pc.includes('tj + 1 : tj, 0, moved'); });
check('R55-17 G1 树任务双写归属（sync taskIds + 未归类区摘除指标保留项目）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('treeTaskDropOnMetric') && pc.includes('mt.taskIds = mt.taskIds.filter') && pc.includes('任务已转为未归类'); });
check('R55-18 G1 节点单击定位：scrollToMetric/scrollToTask + sec-flash/task-flash 高亮', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('function scrollToMetric') && pc.includes('function scrollToTask') && pc.includes('metric-sec-') && pc.includes('data-task-id'); });
check('R55-19 G2 归属链横向化：chain-line row + ch-link 横向', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('.chain-line { display: flex; flex-direction: row') && pc.includes('.ch-link { width: 18px; height: 2px'); });

// ============== 第五十六轮 · V2.29.0：项目调度4指标恢复 + 今日记录缩页头 + 纵向压缩 + 丝滑度 + 默认最新在前/删除图标 + 目录树微调 + 采集弹窗居中 + 镜像真混排 + 标签随导出 ==============
console.log('【第五十六轮 · V2.29.0：九包迭代】');
check('R56-1 P1 项目调度 4 指标恢复左列一行四格（cur-stats-v2：成功指标/任务总数/已完成/进行中，14px 级加粗数字）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('cur-stats-v2') && h.includes('csv-num') && h.includes('csv-lab') && h.includes('成功指标') && h.includes('任务总数') && h.includes('已完成') && h.includes('进行中') && !h.includes('cur-stat-strip'); });
check('R56-2 P1 两级下钻链路：指标卡 openCurDrill → 弹窗 drillTasks 行点击 drawerRef?.open(t) → TaskDetailDrawer', () => { const h = read('/newtab/views/CompassHome.vue'); const m = h.indexOf('R54-B2：4 指标下钻弹窗'); const seg = h.slice(m); return h.includes('function openCurDrill') && seg.includes('v-for="t in drillTasks"') && seg.includes('drawerRef?.open(t)') && h.includes('<TaskDetailDrawer ref="drawerRef" />'); });
check('R56-3/R66 今日记录 4 计数迁入方向状态指标条右端（rec-mini in-bar 右对齐；页头只留存储/同步 chip）', () => { const h = read('/newtab/views/CompassHome.vue'); const mb = read('/newtab/components/compass/MetricBar.vue'); const head = h.indexOf('class="page-head"'); const bar = h.indexOf('<MetricBar>'); const seg = h.slice(head, bar); return seg.includes('storage-chip') && seg.includes('sync-chip') && !seg.includes('rec-mini') && h.includes('rec-mini in-bar') && h.includes("openRec('in')") && h.includes("openRec('log')") && mb.includes('mb-right') && mb.includes('slot name="right"'); });
check('R56-4 P2 明细收进下钻抽屉（openRec 四态 + 记录抽屉保留）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes("recOpen = ref<'' | 'in' | 'out' | 'called' | 'log'>") && h.includes('<Drawer :open="!!recOpen"') && h.includes('recTitles'); });
check('R56-5（R65 修订）MetricBar 再压缩为单行指标条（mb-row 6px + 主数字 13.5px，副行收 tooltip）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('.mb-row { display: flex') && mb.includes('padding: 6px 14px') && mb.includes('.mb-v { font-size: 13.5px') && !mb.includes('mb-cells'); });
check('R56-6（R64 修订）三件事压缩（today-card 7px 12px 6px + card-head 10px 20px 6px + lock-bar 删除）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('border-radius: var(--radius-sm); padding: 7px 12px 6px;') && h.includes('padding: 10px 20px 6px;') && !h.includes('lock-bar'); });
check('R56-7 P3 模块间距 22→14px', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.page > .module { margin-top: 14px; }'); });
// R74 退役 R56-8：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
check('R56-9 PERF-c isProjectDone O(P×T) 修复：projectTasksIndex 单次遍历 + isProjectDone/isProjectStalled/projectProgress 共享 projectTasksOf', () => { const s = read('/newtab/stores/compass.ts'); return s.includes('function projectTasksIndex()') && s.includes('function projectTasksOf(projectId: string)') && s.includes('const tasks = projectTasksOf(project.id)') && (s.match(/projectTasksOf\(project.id\)/g) || []).length >= 3; });
check('R56-10 PERF-c repository 数据版本号（saveData/saveDataNow/syncCache 自增，memo 失效键）', () => { const r = read('/shared/storage/repository.ts'); return r.includes('let dataVersion = 0') && r.includes('export function getDataVersion()') && (r.match(/dataVersion\+\+/g) || []).length >= 3; });
check('R56-11 PERF-d northStarMetrics memo（period+数据版本号键）', () => { const s = read('/newtab/stores/compass.ts'); return s.includes('const dayKey = new Date().toDateString()') && s.includes('period + \':\' + dayKey + \':\' + getDataVersion()') && s.includes('function northStarMetricsRaw(period: Period)'); });
check('R56-12 PERF-e tcBreathe 呼吸灯移除（animation/keyframes/class 三处全无）', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('tcBreathe'); });
check('R56-13 V1 Workspace 手动（默认）= 拖拽序 curOrder 优先，无拖拽序 createdAt 降序', () => { const w = read('/newtab/views/Workspace.vue'); const i = w.indexOf('R56-V1：手动（默认）态'); const seg = w.slice(i, i + 500); return seg.includes('hasDrag') && seg.includes('(b.createdAt || 0) - (a.createdAt || 0)') && seg.includes('(a.curOrder ?? 999999) - (b.curOrder ?? 999999)'); });
check('R56-14 V1 拖拽序物化：onDropCard 落位分区重写 curOrder + onKanbanCardDrop 落位列重写（拖拽结果不被默认排序吞掉）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('R56-V1：拖拽序物化') && w.includes('groupKeyOf(r) === landedKey').toString() === 'true' || (w.includes('landedKey') && w.includes('colKey')); });
check('R56-15 V1 看板列内与三视图同口径：resourcesByCategory 走 applySort', () => { const w = read('/newtab/views/Workspace.vue'); const i = w.indexOf('function resourcesByCategory'); const seg = w.slice(i, i + 260); return seg.includes('applySort'); });
check('R56-16 V1 TaskManagerPanel manual = sortOrder 拖拽序优先/无拖拽序最新在前 + onTaskDrop 全量重写 sortOrder', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return t.includes('hasDrag = tasks.some(t => t.sortOrder != null)') && t.includes('(a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)') && t.includes('R56-V1：拖拽序物化'); });
check('R56-17 V1 TaskCard.sortOrder 模型可选字段（红线：非 Resource/Curiosity/TagNode）', () => { const m = read('/shared/models/index.ts'); const tc = m.split('interface TaskCard')[1].split('}')[0]; return tc.includes('sortOrder?: number'); });
check('R56-18 V1 CuriosityPanel 默认最新在前（dir 默认 desc；拖拽序 sortOrder 优先）', () => { const c = read('/newtab/components/compass/CuriosityPanel.vue'); return c.includes("(store.ui?.sortPrefs?.curio?.dir === 'asc') ? 'asc' : 'desc'") && c.includes('a.sortOrder != null || b.sortOrder != null'); });
// R79 重指：看板卡删除能力仍在，只是由孤立的 kc-del 图标并入统一动作条（.kc-actions / .kc-action.delete）
check('R56-19 V2 看板卡删除图标补齐（kc-del hover 显现 + deleteResource 软删）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('kc-action delete') && w.includes('deleteResource(r)') && w.includes('.kc-card:hover .kc-actions { opacity: 1; }'); });
check('R56-20 V2 项目展板任务行删除图标语义补齐（🗑 + title 进回收站）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return (pc.match(/title="删除任务（进回收站）"/g) || []).length >= 2 && !pc.includes('@click="removeTask(task)">×</button>'); });
check('R56-21 G 目录树横向收窄（proj-rail 372→302px，第一列 148→126px）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('width: 302px') && pc.includes('.pr-projects { width: 126px'); });
check('R56-22 G 行距放宽（prt-mrow 8px / prt-task 7px 纵向）', () => { const pc = read('/newtab/views/ProjectCuration.vue'); return pc.includes('.prt-mrow { display: flex; align-items: center; gap: 6px; padding: 8px 8px;') && pc.includes('padding: 7px 8px 7px 26px'); });
check('R56-23 C 任务采集弹窗居中（taskcapture overlay 去 corner）', () => { const g = read('/newtab/components/GlobalPopups.vue'); const i = g.indexOf("activePanel==='taskcapture'"); const seg = g.slice(Math.max(0, i - 120), i + 40); return seg.includes('gp-overlay') && !seg.includes('corner'); });
// R74 退役 R56-24：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
// R74 退役 R56-25：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
// R74 退役 R56-26：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
check('R56-27（R74 重写）无独立「源分类实时镜像」分区（统一网格唯一呈现）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return !w.includes('源分类实时镜像') && !w.includes('const viewLive = computed');
});
// R74 退役 R56-28：随 CurationCenter.vue 删除退役（锁 curFrom 死代码链，见 04-23 §六 A 组）
check('R56-29 I 工作台导出改 AppData 子集同构（...d 展开 + 全局段随行 + 工作台段按台过滤 + AppData 类型）', () => { const w = read('/newtab/views/Workspace.vue'); const i = w.indexOf('function exportWorkspace'); const seg = w.slice(i, i + 900); return seg.includes('...d.value') && seg.includes('workspaces: [ws]') && seg.includes("c.workspaceId === wsId") && seg.includes('r.workspaceId === wsId') && w.includes('type AppData'); });
check('R56-30 I 导出物可导回：含 version:2（导入端版本校验通过），tagTree/compass/tasks/curiosities/stats 全局段随行', () => { const w = read('/newtab/views/Workspace.vue'); const i = w.indexOf('function exportWorkspace'); const seg = w.slice(i, i + 900); return seg.includes('...d.value') && seg.includes('JSON.parse(JSON.stringify'); });
check('R56-31 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(__filename, 'utf8'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL); });
check('R56-32 E2E-17 注册（项目调度 4 指标恢复左列 + 下钻链路）', () => { const e = fs.readFileSync(path.resolve(__dirname, 'e2e.cjs'), 'utf8'); return e.includes('E2E-17 项目调度4指标恢复左列+下钻链路') && e.includes('.cur-stats-v2 .csv-cell'); });
check('R56-33 脚本跨平台：e2e/import-compat Chromium 路径 darwin 分支（Windows 原路径保留）', () => { const e = fs.readFileSync(path.resolve(__dirname, 'e2e.cjs'), 'utf8'); const k = fs.readFileSync(path.resolve(__dirname, 'test-import-compat.cjs'), 'utf8'); return e.includes("process.platform === 'darwin'") && k.includes("process.platform === 'darwin'"); });

// ============== 第五十七轮 · V2.30.0：策展拖拽根因修复 + 项目调度两行两列 + 详细指标移除 + 主航线模块化 ==============
console.log('【第五十七轮 · V2.30.0：四包迭代】');
check('R57-1（R74 重写）卡片 draggable 绑定规范（非裸 draggable，统一 onDragStart）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes(':draggable="!batchMode"') && w.includes('@dragstart="onDragStart($event,r)"');
});
check('R57-2（R74 重写）拖拽强化：acceptDragOver 设 dropEffect + effectAllowed=move', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function acceptDragOver') && w.includes("e.dataTransfer.dropEffect = 'move'") && w.includes('effectAllowed');
});
check('R57-3（R74 重写）区域级落卡：card-grid 绑定带分区键 + onAreaDrop/onAreaDragOver', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('@dragover="onAreaDragOver($event, g.key)"') && w.includes('@drop="onAreaDrop($event, g.key)"') && w.includes('function onAreaDrop') && w.includes('function onAreaDragOver');
});
check('R57-4 F2 项目调度 4 指标两两一行（cur-stats-v2 repeat(2, 1fr)）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.cur-stats-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }'); });
check('R57-5 F2 右列指标组两列网格（cur-groups repeat(2)+新增/空态跨双列+窄窗回退单列）', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('.cur-groups { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; align-items: start; }') && h.includes('.cur-groups > .cg-empty, .cur-groups > .cur-add-metric, .cur-groups > .cur-add-metric-link { grid-column: 1 / -1; }') && h.includes('.cur-groups { grid-template-columns: 1fr; }'); });
check('R57-6 F3 「详细指标」入口移除：mb-drill 按钮/openFull/fullOpen/完整指标 Drawer 与 NorthStarPanel 挂载全无（注释口径提及不受限）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return !mb.includes('mb-drill') && !mb.includes('openFull') && !mb.includes('fullOpen') && !mb.includes('<NorthStarPanel />') && !mb.includes('<Drawer '); });
check('R57-7 F3 四格自下钻保留（MetricDrillDrawer drillCell 四态）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes("ref<'' | 'dhi' | 'wce' | 'wrr' | 'unarch'>") && mb.includes('<MetricDrillDrawer :cell="drillCell"'); });
// R83 重指：形态由「两张并列卡」改为「一条 44px 锚点条」（M1），但**能力仍在**——
// 愿景/使命同屏呈现 + 愿景 tier 高亮 + 整条可点进方向树 + 1.2:1 重心比例不变。名冻结、只改断言体。
check('R57-8 F4 主航线第一行：愿景|使命同屏呈现（R83 起为 mr-vm-bar 一条锚点条）+ tier-vision 高亮 + 可点进方向树', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); return l.includes('class="mr-vm-bar"') && l.includes('tier-vision') && l.includes('@click="openTree"') && l.includes('.mr-vm-text { flex: 1.2') && l.includes('.mr-vm-sep ~ .mr-vm-text { flex: 1; }'); });
check('R57-9 F4 第二行战略目标模块网格：mr-goals-grid + mr-goal-card（mgc-head/mgc-projects + 项目小模块 chip-proj）', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); return l.includes('.mr-goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));') && l.includes('class="mr-goal-card"') && l.includes('mgc-head') && l.includes('mgc-projects') && l.includes('chip-proj'); });
check('R57-10 F4 定位链路保留：data-dir-id 落在目标模块 + goal-flash 闪烁（zy-locate-goal）', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); return l.includes(':data-dir-id="dir.id"') && l.includes('goal-flash') && l.includes("zy-locate-goal"); });
check('R57-11 F4 更多N折叠 + 已完成显隐保留（CHIP_LIMIT/moreOf/showDone；mr-meta/chip-proj 断言锚点延续）', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); const st = read('/newtab/stores/compass.ts'); return l.includes('const CHIP_LIMIT = 6') && l.includes('function moreOf') && l.includes('mr-meta') && l.includes('showDone') && st.includes('function toggleShowDone'); });
check('R57-12 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(__filename, 'utf8'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL); });
check('R57-13 E2E-18 注册（策展卡 draggable 真值 + 区域落卡）', () => { const e = fs.readFileSync(path.resolve(__dirname, 'e2e.cjs'), 'utf8'); return e.includes('E2E-18') && e.includes("getAttribute('draggable')"); });

// ============== 第五十八轮 · V2.31.0：产品体检修复（工作台软删红线/并发写合并/时间边界/搜索两端同构+召回排序/未归档筛选/P3三则） ==============
console.log('【第五十八轮 · V2.31.0：七包迭代】');
check('R58-1 B1 红线：删除工作台改软删（资源卡写 deletedAt 移入回收站，不再物理 filter 移除）+ 策展空间守卫', () => { const w = read('/newtab/views/Workspace.vue'); const i = w.indexOf('async function deleteWorkspace'); const seg = w.slice(i, i + 1100); return seg.includes('r.deletedAt = now') && !seg.includes('d.value.resources = d.value.resources.filter') && seg.includes('CURATION_WS_ID'); });
check('R58-2 B1 回收站孤卡回落：restore 前 rehomeIfOrphan（原工作台/分类已删 → 首个可用台未分类）', () => { const rb = read('/newtab/views/RecycleBin.vue'); return rb.includes('function rehomeIfOrphan') && rb.includes('rehomeIfOrphan(r)') && rb.includes('CURATION_WS_ID'); });
check('R58-3 B2 合并层：repository mergeExternalData（卡片 id+updatedAt LWW/外部新建收编/外部物理移除尊重）', () => { const r = read('/shared/storage/repository.ts'); return r.includes('export function mergeExternalData') && r.includes('function mergeCardArr') && r.includes('((e.updatedAt || 0) > (l.updatedAt || 0)) ? e : l') && r.includes('if (!cur || !saveTimer) { syncCache(ext); return ext }'); });
check('R58-4 B2 存储镜像：lastPersistedJson 三处维护（saveData 载荷/saveDataNow 载荷/syncCache+merge 外部树）', () => { const r = read('/shared/storage/repository.ts'); return (r.match(/lastPersistedJson = /g) || []).length >= 4 && r.includes('function markStorageMirror'); });
check('R58-5 B2 接线：app.ts onChanged 消费 mergeExternalData', () => { const a = read('/newtab/stores/app.ts'); return a.includes('data.value = mergeExternalData(newData)') && a.includes('mergeExternalData, isSelfWrite'); });
check('R58-6 B3 时间边界：CompassHome todayStart 改 computed（nowTick 30s 节拍）+ 北极星 memo 键拼当日日期', () => { const h = read('/newtab/views/CompassHome.vue'); const c = read('/newtab/stores/compass.ts'); return h.includes('const nowTick = ref(Date.now())') && h.includes('const todayStart = computed(') && !h.includes('(() => { const t = new Date(); t.setHours(0,0,0,0)') && h.includes('todayStart.value') && c.includes("const dayKey = new Date().toDateString()") && c.includes("period + ':' + dayKey + ':' + getDataVersion()"); });
check('R58-7 B4 搜索两端同构：应用内 blob 补标签；浮层任务 blob 补标签+项目名、好奇补标签', () => { const g = read('/newtab/components/GlobalPopups.vue'); const ov = read('/content/overlay-impl.ts'); return g.includes('rawTags') && ov.includes("const tTags = Array.isArray(t.tags) ? t.tags.join(' ') : ''") && ov.includes('cTags'); });
check('R58-8 O1 召回排序：置顶>星标 之下三级兜底（标题全词命中 > callCount > lastCalledAt）', () => { const g = read('/newtab/components/GlobalPopups.vue'); const i = g.indexOf('R58-O1'); const seg = g.slice(i, i + 700); return seg.includes('const th = (titleHit(b) ? 1 : 0) - (titleHit(a) ? 1 : 0)') && seg.includes('callCount || 0') && seg.includes('lastCalledAt || 0'); });
check('R58-9 O2 任务卡库「未归档」筛选：TaskFilter 加 unarchived + 口径走 taskArchiveIssue（O23 同源）+ 下拉项', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return t.includes("type TaskFilter = 'all' | 'todo' | 'doing' | 'done' | 'unarchived'") && t.includes("tasks.filter(t => !!taskArchiveIssue(t))") && t.includes('<option value="unarchived">⚠ 未归档</option>') && t.includes('taskArchiveIssue } = useCompass()'); });
check('R58-10（R74 重写）新建卡 curOrder 口径：新建资源卡落当前分类并参与排序', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('editingResource.categoryId = newCardCatId()') && w.includes('curOrder');
});
check('R58-11 B5-3 activityLogs 退役：loadData 启动清空 + 导入不再搬运', () => { const r = read('/shared/storage/repository.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return r.includes("data.activityLogs = []") && g.includes('d.activityLogs = []') && !g.includes('imported.activityLogs'); });
check('R58-12 版本五处同步', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(__filename, 'utf8'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL); });
check('R58-13 E2E-19 注册（删除工作台软删 + 回收站可见）', () => { const e = fs.readFileSync(path.resolve(__dirname, 'e2e.cjs'), 'utf8'); return e.includes('E2E-19') && e.includes('deletedAt'); });

// ============== 第五十九轮 · V2.32.0：返回方向台 + 树投射退役/主攻按钮 + 关联卡片弹窗 + 空指标拖拽 + 主航线凸显 + 总览去占位 + 指标分离 + WCE转化口径 + 策展父分类分区 ==============
console.log('【第五十九轮 · V2.32.0：十包迭代】');
check('R59-1 T1 项目详情返回恒「← 返回方向台」', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('← 返回方向台') && !p.includes('返回方向树'); });
check('R59-2 T2 树投射开关退役（vision/mission/proj 三处函数与 UI 全无）', () => { const t = read('/newtab/views/CompassTree.vue'); return !t.includes('投射至灯塔') && !t.includes('投射至知源灯塔') && !t.includes('toggleProjProjection'); });
check('R59-3 T3 主攻按钮 + 置前排序 + primary 强化', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('>🎯 主攻</button>') && t.includes('.sort((a, b) => (Number(b.isFocused) - Number(a.isFocused)))') && t.includes('inset 3px 0 0 var(--accent)'); });
check('R59-4 T4 关联卡片居中弹窗（lm-mask/lm-search/全量候选+拼音/勾选即存/已选计数）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('lm-mask') && t.includes('关键词或拼音首字母过滤') && t.includes('matchPinyin(text, q)') && !t.includes('.slice(0, 12)') && t.includes('已选 {{ linkCount(linkModal.node) }}'); });
check('R59-5 T5 左树空指标接收任务拖拽：treeMetricDrop 路由 treeDragTask + drop-into 高亮', () => { const p = read('/newtab/views/ProjectCuration.vue'); return p.includes('if (treeDragTask) { treeTaskDropOnMetric(e, target); return }') && p.includes("treeDrop.value = { id: m.id, mode: 'in' }") && p.includes("'drop-into': treeDrop?.id === m.id && treeDrop?.mode === 'in'"); });
check('R59-6 T6 主航线愿景/使命凸显 + 点击进方向树', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); return l.includes('@click="openTree"') && l.includes('进入方向树 ›') && l.includes('color-mix(in srgb, var(--accent) 7%, var(--surface))'); });
check('R59-7 T7 项目总览占位卡移除（ov-empty-hint 仅零项目）', () => { const sh = read('/newtab/views/CompassShell.vue'); return !sh.includes('ov-add-card') && sh.includes('ov-empty-hint') && sh.includes('还没有项目'); });
check('R59-8（R65 修订）方向状态与三件事分离（metric-bar margin-bottom 10px）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('.metric-bar { background') && mb.includes('margin-bottom: 10px; }'); });
check('R59-9 T9 WCE 转化口径：fromCuriosityId 模型/convertCard 写标记/WCE=激活+转化/MetricBar 消费 count', () => { const m = read('/shared/models/index.ts'); const c = read('/shared/utils/cards.ts'); const st = read('/newtab/stores/compass.ts'); const mb = read('/newtab/components/compass/MetricBar.vue'); return (m.match(/fromCuriosityId\?: ID/g) || []).length >= 2 && (c.match(/fromCuriosityId: c\.id/g) || []).length >= 2 && st.includes('const convertedCount = ') && st.includes('count: wceCount + convertedCount') && mb.includes('m.wce.count ?? 0'); });
check('R59-10（R74 重写）父分类分区呈现：resourceGroups 分区 + 区域级 drop 带分区键', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('resourceGroups') && w.includes('onAreaDragOver($event, g.key)') && w.includes('onAreaDrop($event, g.key)');
});
check('R59-11 版本五处同步', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(__filename, 'utf8'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL); });
check('R59-12 E2E-20 注册（空指标接收任务拖拽）', () => { const e = fs.readFileSync(path.resolve(__dirname, 'e2e.cjs'), 'utf8'); return e.includes('E2E-20'); });

console.log('【R60 组 检索 id 锚定 · 灯塔退役 · DHI 新口径】');
check('R60-1 路径B id 锚定：selectedId 状态 + selectItem/selectHover（对象直传，模板不再按下标 selectResult）', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('const selectedId = ref') && g.includes('function selectItem(item: SearchResult)') && g.includes('function selectHover(item: SearchResult)') && g.includes('@click="selectItem(item)"') && !g.includes('selectResult('); });
check('R60-2 路径B 补跑锚定：换词/类型重置锚点 + 结果集变化按 id 恢复（不再无条件弹回第一条）', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes("watch([searchQuery, currentType], () => { selectedId.value = '' })") && g.includes('x.item.id === selectedId.value') && /watch\(filteredResults[\s\S]{0,300}selIndex\.value = i; return/.test(g); });
check('R60-3 路径A id 锚定：searchSelId 状态 + Enter 优先按 id 解析 + mouseenter 同步', () => { const o = read('/content/overlay-impl.ts'); return o.includes('let searchSelId') && o.includes("searchSelId = e.dataset.id || ''") && o.includes("searchResults.find((r: any) => String(r?.id || '') === searchSelId)") && o.includes('openSearchLocator(selItem)'); });
check('R60-4 灯塔字段零引用：全部业务文件无 pinnedToLighthouse 字段读写（迁移清理字符串除外）', () => { const files = ['/shared/models/index.ts', '/newtab/stores/compass.ts', '/newtab/stores/app.ts', '/newtab/components/GlobalPopups.vue', '/content/overlay-impl.ts', '/newtab/views/ProjectCuration.vue', '/newtab/views/CompassShell.vue', '/newtab/views/GlobalSettings.vue', '/newtab/components/compass/LighthousePanel.vue', '/newtab/components/compass/MetricDrillDrawer.vue', '/shared/storage/defaults.ts', '/shared/storage/migration.ts']; return files.every(f => !/pinnedToLighthouse\??\s*[=:]/.test(read(f))); });
check('R60-5（R64 修订）方向状态：DHI 计算退役，goals/pushing 数数口径 + sub 文案', () => { const s = read('/newtab/stores/compass.ts'); return !s.includes('dhiPct') && s.includes('dhi: { goals: goals.length, pushing') && s.includes('项目推进中'); });
check('R60-6（R64 修订）下钻明细：目标行=非归档项目数+推进中数（不依赖主攻与窗口）', () => { const m = read('/newtab/components/compass/MetricDrillDrawer.vue'); return m.includes("dir.projects.filter(p => p.status !== 'archived')") && m.includes('推进中 = 该项目下挂有任务'); });
check('R60-7/R66 主航线/手册零灯塔文案：手册方向状态口径=战略目标/推进项目（DHI 计算口径退役）', () => { const l = read('/newtab/components/compass/LighthousePanel.vue'); const m = read('/newtab/manual-data.ts'); return !l.includes('已投射') && !m.includes('📡 投射') && !m.includes('已投射项目') && !m.includes('DHI 方向契合度') && m.includes('战略目标 / 推进项目'); });
check('R60-8 启动期迁移：app.ts 幂等清除存量 pinnedToLighthouse（vision/mission/projects）', () => { const a = read('/newtab/stores/app.ts'); return a.includes('R60：投射至灯塔功能取消') && a.includes('delete (cp.vision as Record<string, unknown>).pinnedToLighthouse') && a.includes('delete (cp.mission as Record<string, unknown>).pinnedToLighthouse') && a.includes('delete (p as Record<string, unknown>).pinnedToLighthouse'); });

// ===== R61 · 结构重构轮（资源台 + N 策展台 + 层级 4 级） =====
check('R61-1 数据模型：Workspace.kind / CurationProjection.targetWsId / ResourceCard.isThesis / AppData.hubMigratedAt', () => { const m = read('/shared/models/index.ts'); return m.includes("kind?: 'resource' | 'curation'") && m.includes('targetWsId?: ID') && m.includes('isThesis?: boolean') && m.includes('hubMigratedAt?: number'); });
check('R61-2 资源台转正迁移（幂等）：migrateHubStructure 建实体/补 kind/剥 curFrom/清旧投射 + 备份下载', () => { const m = read('/shared/storage/curationMigration.ts'); const a = read('/newtab/stores/app.ts'); return m.includes('export function migrateHubStructure') && m.includes("kind: 'resource'") && m.includes('d.curationProjections = []') && m.includes('if (d.hubMigratedAt) return false') && a.includes('backupBeforeHubMigration'); });
check('R61-3 hub.ts 服务：curationBoards/boardCardsOf/isMirrorView/moveMirror 落点/统计', () => { const h = read('/shared/storage/hub.ts'); return h.includes('export function curationBoards') && h.includes('export function boardCardsOf') && h.includes('export function isMirrorView') && h.includes('export function curationMetrics') && h.includes('canMountInNode') && h.includes("__mirrorProjId: p.id"); });
check('R61-4 镜像卡注入策展台全视图：allResources=boardCardsOf + 卡片/列表视图镜像徽标', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('boardCardsOf(d.value, workspaceId.value)') && w.includes('rc-mirror-badge') && w.includes("isMirrorView(r)"); });
check('R61-5 镜像卡写操作守卫：删除=移出镜像/置顶星标拦截/单击提示/批量删除拆 natives+mirrors', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('if (isMirrorView(r)) { removeMirror(r); return }') && w.includes('置顶请在资源台操作') && w.includes('星标请在资源台操作') && w.includes('const mirrors = removed.filter(isMirrorView)'); });
check('R61-6 决策A语义：策展台新建卡不写资源台（openNewResource 保持 workspaceId=台 id）+ 删除走回收站（软删链路不变）', () => { const w = read('/newtab/views/Workspace.vue'); const h = read('/shared/storage/hub.ts'); return w.includes("workspaceId: workspaceId.value, categoryId: ''") && w.includes('r.deletedAt = Date.now()') && h.includes('toWsId === CURATION_WS_ID) return null'); });
check('R61-7（R74 重写）层级 4 级落地：MAX_CAT_LEVEL 单一来源 + descendantIds 深化 + 看板/选项递归', () => {
  const t = read('/shared/utils/catTree.ts');
  const w = read('/newtab/views/Workspace.vue');
  return t.includes('MAX_CAT_LEVEL') && w.includes('function descendantIds') && w.includes('catAggCount');
});
check('R61-8 命名切换：顶栏/路由/弹窗 策展中心→资源台、工作台→策展台；App.vue 打包镜像退役', () => { const r = read('/newtab/router.ts'); const a = read('/newtab/App.vue'); const c = read('/newtab/views/Workspace.vue'); return r.includes("meta: { title: '知源调度台 · 资源台' }") && a.includes('>资源台') && a.includes('策展台「${name}」已创建')
  // R84 重指：原验写死的 `<b>资源台</b>`；W1 起页头台名取 workspace.name（种子数据里即"资源台"），
  // **不写死比写死更正确**——改名也能跟着变。旧称零出现仍守住（见下）。
  && c.includes('class="wsh-name">{{ workspace.name }}') && !c.includes('<b>资源台</b>')
  && !a.includes('>策展中心') && !a.includes('工作台「${name}」已创建'); });
check('R61-9 删除策展台级联：App.vue 移除该台收到的镜像记录（引用随台走，源卡零影响）', () => { const a = read('/newtab/App.vue'); return a.includes("p.targetWsId === ws.id") && a.includes('引用随台走'); });
check('R61-10（R74 重写）旧方向入口全拆除：Workspace 无 projectCardToCuration/projectCategoryToCuration', () => {
  const w = read('/newtab/views/Workspace.vue');
  return !w.includes('projectCardToCuration') && !w.includes('projectCategoryToCuration');
});
console.log('【R62 组 策展台 V3：五指标卡 · 下钻抽屉 · thesis 字段组 · 金字塔视图】');
check('R62-1 thesis 字段组四件套：FieldConfig.thesis 可选组 / defaults 默认字段 / catalog CardKind 扩 thesis / fields.ts FieldGroupKind', () => { const m = read('/shared/models/index.ts'); const dft = read('/shared/storage/defaults.ts'); const cat = read('/shared/models/catalog.ts'); const f = read('/shared/utils/fields.ts'); return m.includes('thesis?: FieldDef[]') && dft.includes("key: 'title', label: '论点'") && dft.includes('defaultThesisFieldDefs') && cat.includes("'resource' | 'task' | 'curiosity' | 'thesis'") && cat.includes("kinds: ['thesis']") && f.includes("export type FieldGroupKind = 'resource' | 'task' | 'curiosity' | 'thesis'"); });
check('R62-2 thesis 老数据归一化：repository 缺组补默认（幂等）+ assets 注入循环含 thesis', () => { const r = read('/shared/storage/repository.ts'); return r.includes('defaultThesisFieldDefs') && r.includes("if (data.fieldConfig && !data.fieldConfig.thesis) data.fieldConfig.thesis = defaultThesisFieldDefs()") && r.includes("for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const)"); });
check('R62-3 设计器第四页：设置导航「策展主题卡」+ thesis 面板 FieldEditor + 导入合并兼容 thesis 组', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes("key: 'thesis', icon: '🏛', label: '策展主题卡'") && g.includes("card-type=\"thesis\"") && g.includes("if (!cfg.thesis) cfg.thesis = defaultThesisFieldDefs()") && g.includes("for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const)"); });
check('R62-4 视图分流：Workspace fieldsOf（isThesis 走 thesis 组）+ 卡片视图消费 fieldsOf(r)', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('function fieldsOf(r: ResourceCard): FieldDef[]') && w.includes("visibleFields(d.value.fieldConfig, 'thesis')") && w.includes('v-for="f in fieldsOf(r)"'); });
check('R62-5 五指标条：ws-metrics 五卡（主题/总数/来源/附件/最近更新）+ curationMetrics 消费 + 资源台不显示（v-if !isHub）', () => { const w = read('/newtab/views/Workspace.vue'); const h = read('/shared/storage/hub.ts'); return w.includes('class="ws-metrics"') && w.includes('🏛 策展主题') && w.includes('🔀 来源构成') && w.includes('📎 附件数量') && w.includes('🕐 最近更新') && w.includes('curationMetrics(d.value, workspaceId.value)') && w.includes('v-if="!isHub"') && h.includes('attachmentItems'); });
check('R62-6 下钻抽屉：CurationDrillDrawer 四模式（total/source/assets/recent）+ 附件打开（getAssetBlob 图片预览 / openHtmlAsset 文档）+ 镜像跳源', () => { const d = read('/newtab/components/CurationDrillDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); return d.includes("mode: 'total' | 'source' | 'assets' | 'recent'") && d.includes('openDrillAsset') && d.includes('getAssetBlob') && d.includes('openHtmlAsset') && d.includes("emit('locate'") && w.includes('CurationDrillDrawer'); });
check('R62-7 中心论点设立：hub.setThesis（每台唯一）+ 右键菜单「设为中心论点/取消」+ 镜像卡拦截', () => { const h = read('/shared/storage/hub.ts'); const w = read('/newtab/views/Workspace.vue'); return h.includes('export function setThesis') && h.includes('if (r.id !== cardId) r.isThesis = undefined') && w.includes('function setThesisCard') && w.includes('🏛 设为中心论点') && w.includes('取消中心论点') && w.includes('镜像卡不能作为本台中心论点'); });
check('R62-8 金字塔视图：viewMode pyramid + pyramidLevels 按深度铺开（排除 thesis 卡）+ 卡片落节点（canMountInNode 校验）+ 镜像卡 moveMirrorTo', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes("viewMode = ref<'card'|'list'|'kanban'|'pyramid'>") && w.includes('const pyramidLevels = computed') && w.includes('if (r.isThesis) continue') && w.includes('canMountInNode(draggedItem)') && w.includes('金字塔节点只允许挂资源卡') && w.includes('moveMirrorTo(draggedItem, cat.id)'); });
check('R62-9 层级/成环校验 + 同级调序 + 根区升降级：onPyDrop childIds 防环 + 4 级上限 + moveCatSibling + 根区升为一级', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('function pyLevelOf') && w.includes('function pyHeightOf') && w.includes('childIds(dragged.id).includes(target.id)') && w.includes('pyLevelOf(target) + pyHeightOf(dragged) > 4') && w.includes('function moveCatSibling') && w.includes('已升为一级节点'); });
check('R62-10 节点菜单 6 项：新建子论点/同级/从资源台镜像分类/打包所选/重命名/删除（卡片回待分类）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('🌳 新建子论点') && w.includes('🌿 新建同级节点') && w.includes('📤 从资源台镜像分类') && w.includes('🗂 打包所选卡片入此节点') && w.includes('✎ 重命名') && w.includes('🗑 删除节点（卡片回待分类）') && w.includes('function packIntoNode'); });
check('R62-11 镜像分类弹窗：hubCatOptions（treeCatOptions）+ confirmMirrorCat 调 mirrorCategoryToBoard + 重复镜像提示', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('mirrorCatModal') && w.includes('treeCatOptions(d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID))') && w.includes('mirrorCategoryToBoard(d.value, catId, workspaceId.value)') && w.includes('该分类已镜像过本台'); });
check('R62-12 右键菜单接线修复：ContextMenu 组件渲染（此前导入未挂载，resCtx 死代码转生效）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('<ContextMenu :state="resCtx" :items="resCtxItems"') && w.includes('import ContextMenu from'); });

// ===== R63 · 设置改造 + Airtable 单向同步轮 =====
check('R63-1 同步数据层：AppData.airtableSync/airtableMap + AirtableSyncState/AirtableLogEntry/AirtableMapEntry 模型 + repository 归一化（log 截断 40）', () => { const m = read('/shared/models/index.ts'); const r = read('/shared/storage/repository.ts'); return m.includes('airtableSync?: AirtableSyncState') && m.includes('airtableMap?: Record<string, AirtableMapEntry>') && m.includes('interface AirtableSyncState') && m.includes('interface AirtableMapEntry') && m.includes('interface AirtableLogEntry') && r.includes('data.airtableSync = { pat: \'\', baseId: \'\', tableId: \'\', pollEnabled: false }') && r.includes('s.log.slice(-40)') && r.includes('if (!data.airtableMap || typeof data.airtableMap !== \'object\') data.airtableMap = {}'); });
check('R63-2 自动建字段：ensureColumns 比对 meta fields + POST meta/.../fields 补缺 + 已存在列跳过（不改名不改类型）', () => { const a = read('/shared/storage/airtable.ts'); return a.includes('async function ensureColumns') && a.includes('meta/bases/${state.baseId}/tables/${state.tableId}/fields') && a.includes('if (existing.has(col.name)) continue') && a.includes("name: '是否中心论点'") && a.includes("name: '知源ID'") && a.includes("name: '已删除'"); });
check('R63-3 增量推送：runSync updatedAt 游标 + 批≤10 + 批间 200ms + 429 退避 30s + 映射表写回 recordId', () => { const a = read('/shared/storage/airtable.ts'); return a.includes('export const BATCH_SIZE = 10') && a.includes('const BATCH_GAP = 200') && a.includes('const RATE_LIMIT_BACKOFF = 30000') && a.includes('state.cursorAt = maxAt') && a.includes('map[row.key] = { recordId: rid, syncedAt: row.updatedAt }') && a.includes('buildRemoteIndex'); });
check('R63-4（R64 修订）同步范围四来源：调度台好奇心 + 方向台任务 + 资源台资源 + 镜像独立记录（cardId:m:targetWsId）', () => { const a = read('/shared/storage/airtable.ts'); return a.includes("cardType: '好奇心', wsName: '调度台'") && a.includes("cardType: '任务', wsName: '方向台'") && a.includes('`${p.cardId}:m:${p.targetWsId}`') && a.includes('curationBoards(d)') && a.includes('boards.some(b => b.id === r.workspaceId)'); });
check('R63-5 软删语义：collectSyncRows deleted 透传 + rowToFields 已删除 checkbox（不物理删 Airtable 记录）', () => { const a = read('/shared/storage/airtable.ts'); return a.includes('deleted: !!c.deletedAt') && a.includes('deleted: !!t.deletedAt') && a.includes('deleted: !!r.deletedAt') && a.includes("'已删除': row.deleted"); });
check('R63-6 设置同步分区：导航 airtable 项 + PAT/Base/Table 配置 + 连接测试 + 立即同步 + 轮询开关 + 日志/配额', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes("{ key: 'airtable', icon: '⇄', label: 'Airtable 同步' }") && g.includes('async function testAtConnection') && g.includes('async function runAtSync') && g.includes('function toggleAtPoll') && g.includes('quotaHint') && g.includes('同步日志') && g.includes('type="password"'); });
check('R63-7 manifest sync-airtable 命令（无默认键）+ alarms 权限 + background 命令转发（不写主数据）', () => { const m = read('/manifest.ts'); const b = read('/background/index.ts'); return m.includes("'sync-airtable'") && !/sync-airtable[\s\S]{0,120}suggested_key/.test(m) && m.includes("'alarms'") && b.includes("case 'sync-airtable'") && b.includes('triggerAirtableSync') && b.includes('zy-autosync'); });
check('R63-8 3 小时轮询：AT_POLL_ALARM periodInMinutes 180 + alignAirtableAlarm 按 pollEnabled 对齐 + storage.onChanged 即时对齐 + 无页跳过', () => { const b = read('/background/index.ts'); return b.includes("const AT_POLL_ALARM = 'airtable-poll'") && b.includes('periodInMinutes: 180') && b.includes('async function alignAirtableAlarm') && b.includes('chrome.storage.onChanged.addListener') && b.includes('轮询跳过：无已开新标签页'); });
check('R63-9 newtab 执行器：App.vue zy-airtable-sync 消息 + runAirtableSync 单例防重入 + zy-autosync 查询参数自启', () => { const a = read('/newtab/App.vue'); return a.includes("msg?.type === 'zy-airtable-sync'") && a.includes('async function runAirtableSync') && a.includes('let atSyncBusy = false') && a.includes("new URLSearchParams(location.search).has('zy-autosync')") && a.includes("from '@/shared/storage/airtable'"); });
check('R63-10 首页同步状态卡：sync-chip（未配置/待同步/出错三态）+ pendingRows 待推计数 + 点击立即同步 + ⚙ 进设置', () => { const c = read('/newtab/views/CompassHome.vue'); return c.includes('class="sync-chip"') && c.includes('⇄ 未配置同步') && c.includes('⇄ 同步出错') && c.includes('pendingRows(store.data!)') && c.includes('async function onSyncChipClick') && c.includes("router.push('/settings?page=airtable')"); });
check('R63-11 全景两级：panCountByWs/panCountByCat 策展台含镜像（boardCardsOf）+ 台型徽标（资源台/策展台）+ 镜像卡 📡 标记与真身跳转', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('function panCountByWs') && g.includes('boardCardsOf(store.data!, cat.workspaceId)') && g.includes("isHubWs(gWsById(wsNode.ws.id)) ? '资源台' : '策展台'") && g.includes('isMirrorView(r)') && g.includes('panMirrorSrc') && g.includes('jumpMirrorSource'); });
check('R63-12 全景移动守卫：镜像卡=改投射落点（targetWsId/targetCatId）+ 资源台真身禁直接搬入策展台', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('p.targetWsId = targetWs') && g.includes('p.targetCatId = cat?.id') && g.includes('资源台真身不能直接搬入策展台'); });
check('R63-13 导出适配：CSV 策展台含镜像 + 尾随分类路径/层级/是否中心论点/镜像标记列 + exportWorkspace 只带本台投射 + mergeImport airtableMap 并集', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('boardCardsOf(d, ws.id)') && g.includes("label: '分类路径'") && g.includes("label: '层级'") && g.includes("label: '是否中心论点'") && g.includes("label: '镜像标记'") && g.includes('curationProjections: (d.curationProjections || []).filter(p => p.targetWsId === ws.id)') && g.includes('d.airtableMap = { ...(imported.airtableMap), ...(d.airtableMap || {}) }'); });
check('R63-14 导入兼容：mergeImport 四字段组（含 thesis）合并保留 R62 语义', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes("for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const)") && g.includes('if (!cfg.thesis) cfg.thesis = defaultThesisFieldDefs()'); });

// ============ R64：资源台归一 + 同步自愈 + 界面瘦身（V2.34.0） ============
check('R64-1 同步自愈 R1：映射优先级远端索引优先（remote.get 优先于 map 兜底）', () => { const a = read('/shared/storage/airtable.ts'); return a.includes('const rid = remote.get(row.key) || map[row.key]?.recordId'); });
check('R64-2 同步自愈 R2/R3：批量 PATCH 失败逐条降级 + 记录不存在转 POST 重建写回 map + 单条失败仅记 log', () => { const a = read('/shared/storage/airtable.ts'); return a.includes('isMissingRecord') && a.includes('逐条自愈重建') && a.includes('createOne') && a.includes("map[u.key] = { recordId: newId"); });
check('R64-3 镜像独立记录：投射行幂等键 cardId:m:targetWsId + wsName=落点台名 + catPath=投射分类', () => { const a = read('/shared/storage/airtable.ts'); return a.includes('`${p.cardId}:m:${p.targetWsId}`') && a.includes('R64-F2'); });
check('R64-4 去免费文案：quotaHint 无 Free/配额百分比口径 + 设置页同步范围说明改镜像独立记录', () => { const a = read('/shared/storage/airtable.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return !a.includes('Free 版') && !g.includes('Free 版配额') && g.includes('每条镜像为独立记录'); });
check('R64-5 方向状态新口径：战略目标=非归档 Direction 数 + 推进中项目=任务数≠0（不再计算 DHI 百分比）', () => { const c = read('/newtab/stores/compass.ts'); return c.includes('pushing') && c.includes('goals') && !c.includes('dhiPct'); });
check('R64-6（R67 修订）方向状态展示：MetricBar 单行主数字=战略目标数 + 推进项目 {{ m.dhi.pushing }}（DHI 标签退役；R67 补「项目」全称）', () => { const m = read('/newtab/components/compass/MetricBar.vue'); return m.includes('战略目标') && m.includes('推进项目 {{ m.dhi.pushing }}') && m.includes('m.value.dhi.goals') && !m.includes('DHI 方向契合度'); });
check('R64-7 下钻抽屉同步口径：各行=项目数/推进中项目数（挂有非软删任务即推进）', () => { const d = read('/newtab/components/compass/MetricDrillDrawer.vue'); return d.includes('推进中 = 该项目下挂有任务') && d.includes('任务数 ≠ 0'); });
check('R64-8 三件事瘦身：满员提示条与副文案删除 + lock-bar 样式清理', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('lock-bar') && !h.includes('锁定今日最重要的 3 件事') && !h.includes('已满 3/3'); });
check('R64-9 同步出错 chip 归因：出错态点击跳设置同步分区', () => { const h = read('/newtab/views/CompassHome.vue'); return h.includes('if (!atConfigured.value || atSyncErr.value)'); });
check('R64-10 hub-merge 迁移：旧台树挂资源台同名根分类 + 原生卡平移 + 实体删除 + 幂等 hubMergedAt', () => { const m = read('/shared/storage/curationMigration.ts'); const mod = read('/shared/models/index.ts'); return m.includes('export function migrateHubMerge') && m.includes('hubMergedAt') && m.includes('name === b.name') && m.includes("d.workspaces = d.workspaces.filter(w => w.id !== b.id)") && mod.includes('hubMergedAt?'); });
check('R64-11 迁移链挂载：app.ts 调 migrateHubMerge + 备份条件含 hubMergedAt', () => { const a = read('/newtab/stores/app.ts'); return a.includes('migrateHubMerge(data.value)') && a.includes('!data.value.hubMergedAt'); });
check('R64-12 采集默认资源台：defaultCaptureWsId 资源台优先 + 打开时回显', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes('function defaultCaptureWsId') && g.includes('capForm.workspaceId || defaultCaptureWsId()') && g.includes("if (!capForm.workspaceId) capForm.workspaceId = defaultCaptureWsId()"); });
check('R64-13 树状递归分组：resourceGroups 带 depth + walk 递归直属卡分组（子分类不再混入父组平铺）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('items: direct, depth') && w.includes('walk(sub.id, sub.name, depth + 1)') && w.includes("g.depth ? 'margin-left:'"); });
check('R64-14 卡面路径徽标：catNameOfFamily 全路径（根→当前 4 级链）+ 隐藏逻辑移除', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('return catIdx.value.pathOf(r.categoryId)') && !w.includes('hideGroupBadge') && !w.includes('rc-cat.hidden'); });
check('R64-15 金字塔连线：SVG py-links-svg + drawPyLinks 根/父→子贝塞尔 + resize 重绘', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('py-links-svg') && w.includes('function drawPyLinks') && w.includes("querySelectorAll('[data-pyid]')") && w.includes("addEventListener('resize', pyLinksThrottled)") && w.includes('function pyLinksThrottled'); });
check('R64-16 中心论点弹窗创建：空态点击 openThesisCreate 预置 isThesis 落 L1 + hero 删除按钮上移', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('function openThesisCreate') && w.includes('editingResource.isThesis = true') && w.includes('点击设立中心论点') && !w.includes('ws-hero') && w.includes('🎨 更换图标'); });

// ============== 第六十五轮：资源台对齐旧工作台 + 金字塔树状自适应 + 节点双入口 + 策展导入导出语义 + 全景收窄 + 快捷键口径 + KeepAlive ==============
console.log('【第六十五轮 · V2.35.0：资源台对齐旧工作台 + 金字塔 2~7 列树状自适应 + 节点双入口 + 导入导出语义修正】');
check('R65-1（R74 重写；R88 重指：导入/批量入口收进 ⚙）资源台工具条：卡片/列表/看板/金字塔四视图 + 搜索 + 批量管理 + 导入 + 新建', () => {
  const w = read('/newtab/views/Workspace.vue');
  // R88：导入与批量管理的入口由工具条一级收进 ⚙ 菜单（W6 / W3），能力仍在，只改入口判据
  return w.includes("viewMode = ref<'card'|'list'|'kanban'|'pyramid'>('card')") && w.includes('☰ 列表') && w.includes('▤ 看板') && w.includes('toolbar-search') && w.includes('toolbar-batch') && w.includes('importModalOpen.value = true') && w.includes('＋ 新建') && w.includes('function openImport(');
});
check('R65-2（R74 重写）资源台抽屉详情：单击 openResource 开抽屉（共享 ResourceEditForm）+ 双击打开 + 260ms 判别', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('ResourceEditForm') && w.includes('function openResource(r: ResourceCard)') && w.includes(':class="{open: drawerOpen}"') && w.includes('openResource(r') && w.includes('onCardDblClick(r)') && w.includes('260');
});
check('R65-3 资源台批量操作浮动栏：全选/批量打开/移动到/批量删除 + confirmBatchMove 落资源台分类树', () => { const c = read('/newtab/views/Workspace.vue'); return c.includes('batch-bar') && c.includes('selectAllVisible') && c.includes('batchOpen') && c.includes('openBatchMove') && c.includes('batchDelete') && c.includes('moveCatOptions'); });
check('R65-4（R73 修订）导入书签/本地文件落资源台：hub 分支持有 bookmarkInput + handleBookmarkImport + handleFileImport + parseBookmarksHtml', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('bookmarkInput') && w.includes('handleBookmarkImport') && w.includes('handleFileImport') && w.includes('parseBookmarksHtml') && w.includes('makeHubResource'); });
check('R65-5/R66 金字塔居中树布局：pyLayout 叶子占列+父跨子组全部列（父横向恒=子组、居中、不跨入其他父域）+ 列宽自适应 minmax(170,250)', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('const pyLayout = computed') && w.includes('placeCat') && w.includes('/ span ${cell.colSpan}') && w.includes('minmax(170px, 250px)') && !w.includes('pyLevelCols'); });
check('R65-6 金字塔严格树状：DFS 先序排序（同父节点紧邻）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('const dfsOrder = new Map<string, number>()') && w.includes("walk('')") && w.includes('dfsOrder.get(a.cat.id)'); });
check('R65-7 节点双入口：🔗 关联资源卡（linkCandidates 关键词过滤 + 已在该台去重 + confirmLinkCards projectCardToBoard 镜像）+ ➕ 新建卡片（addResourceToCategory 台内卡）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('openLinkCards') && w.includes('linkCandidates') && w.includes('confirmLinkCards') && w.includes('projectCardToBoard(d.value, id, workspaceId.value, m.catId)') && w.includes('🔗 关联资源卡') && w.includes('➕ 新建卡片') && w.includes('py-node-foot'); });
check('R65-8 策展台导入=策展台数据包 JSON：version 校验 + 按 ID 并集合并本台段 + 投射清单并入', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('handleBoardImport') && w.includes("startsWith('2')") && w.includes('mergeById(d.value.resources, incRes') && w.includes('curationProjections = mergeById'); });
check('R65-9 全景收窄为资源台全景：panHubWss 过滤 isHubWs + 导航/标题改名', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('const panHubWss = computed') && g.includes("(store.data?.workspaces || []).filter(w => isHubWs(w) && !w.archived)") && g.includes("label: '资源台全景'") && g.includes('🗺 资源台全景') && !g.includes("label: '工作台全景'"); });
check('R65-10（R68 修订）快捷键口径：open-resource 退役，资源台入口=应用内 Alt+2（switchToIndex）', () => { const m = read('/manifest.ts'); const a = read('/newtab/App.vue'); return !m.includes("'open-resource'") && a.includes('if (n === 2) { openResource(); return }'); });
check('R65-11（R74 重写）KeepAlive 切台缓存：三主视图 include（+CompassShell）+ defineOptions 实例名 + 跨台 :id 复位局部状态', () => {
  const a = read('/newtab/App.vue');
  const w = read('/newtab/views/Workspace.vue');
  const h = read('/newtab/views/CompassHome.vue');
  return a.includes('keep-alive include="CompassHomeView,WorkspaceView,CompassShell"') && read('/newtab/views/CompassShell.vue').includes("defineOptions({ name: 'CompassShell' })") && w.includes("defineOptions({ name: 'WorkspaceView' })") && h.includes("defineOptions({ name: 'CompassHomeView' })") && w.includes('watch(() => route.params.id');
});
check('R65-12 方向状态单行指标条：副行收 tooltip（mb-v 13.5px 单行 + st-warn 保留）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('mb-row') && mb.includes('mb-k') && mb.includes('mb-v') && mb.includes('st-warn') && !mb.includes('mb-head'); });

// ============== 第六十六轮：任务采集选区预填 + 项目调度瘦身 + 操作记录整合 + 全量导入导出 uiPrefs + 全景递归 + 金字塔居中树 + 品牌刷新 ==============
console.log('【第六十六轮 · V2.36.0：任务采集选区预填 + 金字塔居中树布局 + 品牌口径升级】');
check('R66-1 任务采集选区预填：openTaskCapture 接入选区链路（文本→内容/标题→名称/URL→链接字段，均可编辑）+ 保存写 link', () => { const c = read('/content/overlay-impl.ts'); return c.includes('R66-F1') && c.includes('resolveSelection()') && c.includes('clearSelCache()') && c.includes('__zy_tc_link__') && c.includes('（已填入选中文本，可编辑）') && c.includes('link: link || undefined'); });
check('R66-2 金字塔直角连线：drawPyLinks 改横平竖直折线（父底中点↓横移↑子顶中点）+ SVG 画布按滚动区设定', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('M ${a.x} ${a.bottom} L ${a.x} ${mid} L ${b.x} ${mid} L ${b.x} ${b.top}') && w.includes('scrollWidth') && !w.includes('C ${a.x} ${mid}'); });
check('R66-3 全量导出附 uiPrefs + 导入自动应用：exportAll 载入 UI 偏好并入包，导入侧落 data-theme/data-density', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('async function exportAll') && g.includes('loadUIPrefs') && g.includes('{ ...safeData, uiPrefs }') && g.includes("document.documentElement.setAttribute('data-theme', ui.theme)") && g.includes("saveUIPrefs({ density: ui.density as 'compact' | 'cozy' })") && g.includes('界面偏好已应用'); });
check('R66-4 资源台全景递归 N 级：panTree toNode 递归 + flattenPanCats 扁平渲染（折叠沿祖先链）', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('.map(toNode)') && g.includes('function flattenPanCats') && g.includes('row.depth * 14'); });
check('R66-5 品牌刷新落点：启动动画/采集浮层页脚/搜索页脚/一封信全部换新 Slogan（旧「你不缺信息」清零）', () => { const h = read('/newtab/index.html'); const ov = read('/content/overlay-impl.ts'); const gp = read('/newtab/components/GlobalPopups.vue'); const lt = read('/newtab/letter-data.ts'); return h.includes('万千可调用，自有我方向') && ov.includes('知源调度台 · 万千可调用，自有我方向') && gp.includes('知源调度台 · 万千可调用，自有我方向') && lt.includes('万千可调用，自有我方向') && !lt.includes('你不缺信息') && lt.includes('lp-creed'); });
check('R66-6 一封信按新叙事重写：新病根开场→三个看见工作流→信任承诺→新 Slogan 收束（旧「我也焦虑」开场退役）', () => { const lt = read('/newtab/letter-data.ts'); return lt.includes('外部可能性持续增加') && lt.includes('今天的行动有来处') && lt.includes('策展成可以讲给别人听的成果') && lt.includes('伊里奇') && lt.includes('万千可调用，自有我方向') && !lt.includes('我也焦虑') && lt.includes('R66'); });
check('R66-7 应用内手册对齐新口径：quick-1 三项核心价值表 + 方向状态 R66 整合口径 + 金字塔居中树口径', () => { const m = read('/newtab/manual-data.ts'); return m.includes('三项核心价值') && m.includes('<strong>调用</strong>贯穿三者') && m.includes('R66 整合') && m.includes('R67 重排') && m.includes('R66 居中树布局') && m.includes('界面偏好段 uiPrefs'); });
check('R66-8 docs 双文档升版 V2.36.0：功能手册/白皮书新定位与新 Slogan 落位', () => { const d1 = fs.readFileSync(path.resolve(__dirname, '../../docs/产品功能手册_V2.36.0.md'), 'utf8'); const d2 = fs.readFileSync(path.resolve(__dirname, '../../docs/产品白皮书_V2.36.0_对外版.md'), 'utf8'); return d1.includes('个人调度中台') && d1.includes('万千可调用，自有我方向') && d1.includes('V2.36.0 结构变化速览') && d2.includes('你在浏览器里的个人调度中台') && d2.includes('万千可调用，自有我方向') && !d2.includes('你不缺信息，你缺一座控制中心'); });

// ============== 第六十七轮 · R67：推进项目全称 + 紫框重排 + 策展主题高亮 + 任务采集居中 + 全景数据源修复 + 模块直达快捷键 + 项目目录拖拽 ==============
console.log('【第六十七轮 · R67：方向状态全称 + 紫框重排 + 全景数据源修复 + 模块直达】');
check('R67-1 方向状态「推进项目」全称标签（MetricBar mb-k2，与战略目标对仗）', () => { const mb = read('/newtab/components/compass/MetricBar.vue'); return mb.includes('<span class="mb-k2">推进项目 {{ m.dhi.pushing }}</span>') && !mb.includes('<span class="mb-k2">推进 {{'); });
check('R67-2 项目调度紫框重排：顶部项目名行删除，紫框内=战略目标小字上→项目名大字下（进度+进入详情保留）', () => { const h = read('/newtab/views/CompassHome.vue'); const iGoal = h.indexOf('<div class="cur-goal">'); const iName = h.indexOf('📦 {{ curProject.name }}'); const iLab = h.indexOf('cur-goal-lab'); return h.includes('R67-F1') && iGoal >= 0 && iName > iGoal && iLab > -1 && iLab < iName && h.includes('项目进度 {{ projectProgress(curProject).pct }}%') && h.includes('进入项目详情'); });
check('R67-3 策展主题指标卡常亮高亮（thesis-hl 主题色描边+淡底+标签着色）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('metric-card thesis-hl') && w.includes('.metric-card.thesis-hl') && w.includes('.metric-card.thesis-hl .mc-label'); });
check('R67-4 任务采集弹窗改页面正中（openTaskCapture center，资源采集保持 corner）', () => { const c = read('/content/overlay-impl.ts'); return c.includes('R67-F2') && c.split("openOverlay('center', closeOverlay)").length === 4 && c.split("openOverlay('corner', closeOverlay)").length === 2; });
check('R67-5 新卡落位口径守护：三卡入库 unshift + marksort 置顶>星标>普通（新卡落置顶之后、普通卡最前）', () => { const cu = read('/newtab/stores/curiosity.ts'); const ms = read('/shared/utils/marksort.ts'); const ov = read('/content/overlay-impl.ts'); return cu.includes('curiosities.unshift') && cu.includes('tasks.unshift') && cu.includes('resources.unshift') && ms.includes('markRank') && ov.includes('tasks?.unshift'); });
check('R67-6 全景数据源修复：panHubWss 改原始 workspaces 过滤（getter 排除资源台致恒空）+ gWsById 全景判定 + 默认选中资源台', () => { const g = read('/newtab/views/GlobalSettings.vue'); return g.includes('(store.data?.workspaces || []).filter(w => isHubWs(w) && !w.archived)') && g.includes('function gWsById') && g.includes('const hubWs = panHubWss.value[0]') && g.includes('isHubWs(gWsById(panSelWs.value))'); });
check('R67-7（R68 修订）模块直达快捷键：goto-tasks 描述升级为「直达任务调度模块」（锚方向台），goto-curiosity 不变', () => { const m = read('/manifest.ts'); const b = read('/background/index.ts'); const a = read('/newtab/App.vue'); const h = read('/newtab/views/CompassHome.vue'); return m.includes("'goto-curiosity'") && m.includes("'goto-tasks'") && m.includes('直达好奇心培养模块') && m.includes('直达任务调度模块') && !m.includes('直达项目调度模块') && b.includes("case 'goto-curiosity':") && b.includes('zy-anchor=') && a.includes('zy-goto-anchor') && h.includes('zy-mod-curiosity') && h.includes('zy-mod-tasks') && h.includes('anchor-flash'); });
check('R67-8 项目详情左栏宽高拖拽：rail-grip 双手柄 + UIPrefs.projRailW/H 持久化 + railStyle 绑定', () => { const p = read('/newtab/views/ProjectCuration.vue'); const mo = read('/shared/models/index.ts'); return p.includes('startRailResize') && p.includes('rail-grip-w') && p.includes('rail-grip-h') && p.includes('projRailW: railW.value') && p.includes('projRailH: railH.value') && mo.includes('projRailW?: number'); });
check('R67-9 手册口径跟进：项目调度 R67 重排 + 直达快捷键 + 策展主题常亮高亮', () => { const m = read('/newtab/manual-data.ts'); return m.includes('R67 重排') && m.includes('战略目标小字在上、项目名称大字在下') && m.includes('直达好奇心培养模块') && m.includes('常亮高亮') && m.includes('单击开右侧详情抽屉、双击打开链接'); });

// ============== 第六十八轮 · R68：搜索遗留实体过滤 + 深色按钮修复 + 快捷键体系改造 + 加载动画美化 + 切台/搜索性能 ==============
console.log('【第六十八轮 · R68：搜索口径修复 + 深色可见性 + 快捷键改造 + 性能】');
check('R68-1 搜索工作台分组口径对齐台签栏：两端均排除资源台本体实体（CURATION_WS_ID）+ 已归档', () => { const g = read('/newtab/components/GlobalPopups.vue'); const c = read('/content/overlay-impl.ts'); return g.includes('!w.archived && w.id !== CURATION_WS_ID') && g.includes('ws: all.workspaces.filter(w=>!w.archived && w.id !== CURATION_WS_ID).length') && c.includes("!w.archived && w.id !== CURATION_WS_ID") && c.includes("import { CURATION_WS_ID } from '@/shared/models'"); });
check('R68-2 搜索项目分组尊重 showDoneProjects（浮层读 zy_ui_v2 + isProjDone 派生口径）', () => { const c = read('/content/overlay-impl.ts'); return c.includes('showDoneProjectsCache') && c.includes('loadShowDonePref') && c.includes('zy_ui_v2') && c.includes('function isProjDone') && c.includes('if (!showDoneProjectsCache && isProjDone(p, d)) return'); });
check('R68-3 任务卡删除按钮 emoji → 主题色 trash 线性图标（深色主题可见）', () => { const t = read('/newtab/components/compass/TaskManagerPanel.vue'); return t.includes('import Icon from') && t.split('<Icon name="trash" :size="12" />').length >= 4 && t.includes('.k-del { position: absolute; top: 6px; right: 58px; width: 22px; height: 22px; border: none; background: transparent; border-radius: 6px; font-size: 11px; cursor: pointer; opacity: 0; transition: all .15s ease; z-index: 1; color: var(--text-3);') && t.includes('.kcard:hover .k-pin, .kcard:hover .k-star, .kcard:hover .k-del { opacity: .85; }'); });
check('R68-4 快捷键体系改造：open-compass/open-resource 退役 + goto-tasks 锚方向台 + 数字键 1=方向台 2=资源台 3..=工作台', () => { const m = read('/manifest.ts'); const b = read('/background/index.ts'); const a = read('/newtab/App.vue'); return !m.includes("'open-compass'") && !m.includes("'open-resource'") && b.includes('open-compass/open-resource 已从 manifest 下架') && b.includes("const anchor = command === 'goto-curiosity' ? 'curiosity' : 'task'") && a.includes('if (n === 1) { openCompass(); return }') && a.includes('const ws = store.workspaces[n - 3]'); });
check('R68-5 方向台任务调度直达落位：CompassShell flashTaskModule + zy-goto-anchor 监听（zone=task 共用）', () => { const sh = read('/newtab/views/CompassShell.vue'); return sh.includes('function flashTaskModule') && sh.includes("addEventListener('zy-goto-anchor', onGotoAnchor)") && sh.includes("(e as CustomEvent).detail === 'task'") && sh.includes("id=\"task-mgmt-module\""); });
check('R68-6 方向树操作按钮主题感知（去硬编码白底，深色主题可见）', () => { const t = read('/newtab/views/CompassTree.vue'); return t.includes('.node-action { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; color: var(--text-2); transition: all .15s; background: var(--surface-3); border: 1px solid var(--border); }') && !t.includes('rgba(255,255,255,.9)'); });
check('R68-7 加载动画排版重整：分隔线对齐轴 + slogan 升字号提对比', () => { const h = read('/newtab/index.html'); return h.includes('zy-skl-divider') && h.includes('font-size: 15.5px; font-weight: 500; color: #C6CBD4; letter-spacing: 0.22em;') && h.includes('万千可调用，自有我方向</div>') && !h.includes('万千可调用，自有我方向。'); });
check('R68-8（R73 修订）性能：KeepAlive 保留方向台 CompassShell + 拼音字典启动 idle 预热', () => { const a = read('/newtab/App.vue'); return a.includes('CompassHomeView,WorkspaceView,CompassShell') && a.includes('ensurePinyin') && a.includes('requestIdleCallback'); });

// ============== 第六十九轮 · R69：术语统一（工作台→策展台）+ 资源台「全部分类」默认根节点 + 快捷键映射表键位修正 + 垃圾文件清理 ==============
console.log('【第六十九轮 · R69：术语统一 + 资源台全部分类 + 键位修正 + 清理】');
check('R69-1 术语统一：界面/浮层/设置/手册用户可见文案已无「工作台」旧称', () => {
  const bad = ['工作台图标', '导出工作台数据', '删除工作台', '存入工作台', '各工作台', '工作台不存在', '新建工作台', '工作台名称', '选择工作台', '跨全部工作台', '暂无工作台', '工作台已删除', '打开工作台', '已定位到卡片所在工作台', '请到工作台补全', '该工作台暂无分类', '没有匹配的工作台', '目标工作台', '导出指定工作台', '资源工作台', '新增工作台', '展开工作台', '收起工作台'];
  const files = ['/newtab/views/Workspace.vue', '/newtab/components/GlobalPopups.vue', '/content/search-overlay.ts', '/newtab/views/GlobalSettings.vue', '/newtab/manual-data.ts', '/newtab/App.vue', '/popup/App.vue'];
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
check('R69-4 设置页快捷键映射表键位修正：第 N 个策展台 = 修饰键 + (N+2)', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("{{ i + 3 <= 9 ? modLabel() + ' + ' + (i + 3) : '—' }}") && s.includes('第 N 个策展台 = 修饰键 + (N+2)') && s.includes('1 = 方向台、2 = 资源台、3 起按台签顺序对应各策展台') && s.includes('Alt + 数字键（1=方向台、2=资源台、3 起=各策展台）'); });
check('R69-5 快捷键速查口径修正：Ctrl+Shift+K 打开调度台 + Alt+3…9 各策展台', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes("desc: '打开调度台'") && s.includes("desc: '各策展台（按台签顺序）'") && s.includes("{ keys: 'Alt+1', desc: '方向台（修饰键可自定义）' }") && s.includes("{ keys: 'Alt+2', desc: '资源台' }"); });
check('R69-6 垃圾清理：旧版浮层备份 search-overlay.ts.orig.bak 与 scripts/.r6a 已移除', () => !exists('/content/search-overlay.ts.orig.bak') && !fs.existsSync(path.resolve(__dirname, '..', 'scripts', '.r6a')));
check('R69-7 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(__filename, 'utf8'); const gs = read('/newtab/views/GlobalSettings.vue'); return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && gs.includes('runtimeVersion'); });

// ============== 第七十轮：全量代码审计缺陷修复（P0 分类树校验+递归防护 / P1 安全与引用一致性 / P2 健壮性） ==============
console.log('【第七十轮 · V2.39.0：审计缺陷全量修复】');

check('R70-1 P0 新增分类树结构校验工具（环/孤儿/超深净化 + 节点上限）', () => {
  const t = read('/shared/utils/catTree.ts');
  return t.includes('sanitizeCategoryTree') && t.includes('MAX_CAT_LEVEL') && t.includes('MAX_CAT_NODES') && t.includes('catTreeFixNote');
});
check('R70-2 P0 两条导入路径接入净化（全量导入 + 策展台数据包）', () => {
  const gs = read('/newtab/views/GlobalSettings.vue'); const wsp = read('/newtab/views/Workspace.vue');
  return gs.includes('sanitizeCategoryTree(imported.categories') && gs.includes('mergeById(d.categories, safeCats)') && wsp.includes('sanitizeCategoryTree(ext.categories');
});
check('R70-3（R74 重写）资源台递归/上行走链防环（R71 起收敛至索引层 visited + 缓存）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const x = read('/shared/utils/catIndex.ts');
  return w.includes('function descendantIds') && w.includes('function catAggCount') && w.includes('function childCatsOf') && x.includes('带 visited') && x.includes('DFS');
});
check('R70-4 P0 策展台递归防护 + 金字塔环内节点不再静默丢失', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function descendantIds(catId: string): string[]') && w.includes('function pyDepthOf(c: Category): number') && w.includes('function pyHeightOf(c: Category, seen = new Set<string>())') && w.includes('if (!placed.has(c.id)) placeCat(c, 0)');
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
check('R70-11 P2 isSelfWrite 改内容指纹（守卫真正生效）', () => {
  const r = read('/shared/storage/repository.ts');
  return r.includes("let lastSelfWriteJson = ''") && r.includes('export function isSelfWrite(newValue: unknown): boolean') && r.includes('lastSelfWriteJson = payloadJson');
});
check('R70-12 P2 replaceData 加版本校验 + 遗漏段按 id 合并', () => {
  const r = read('/shared/storage/repository.ts');
  return r.includes('function mergeByIdArr') && r.includes('replaceData: 数据版本不兼容') && r.includes('mergeByIdArr(cur.categories') && r.includes('mergeByIdArr(cur.workspaces');
});
check('R70-13 P2 popup 改走 repository（进事件日志 + 统一落盘）', () => {
  const p = read('/popup/App.vue');
  return p.includes("import { loadData, saveDataNow } from '@/shared/storage/repository'") && p.includes('async function setData(): Promise<void>') && !p.includes('chrome.storage.local.set({ zy_data_v2: d })');
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
check('R70-17 P2 悬空投射清理（启动期 + 回收站硬删）', () => {
  const h = read('/shared/storage/hub.ts'); const r = read('/shared/storage/repository.ts'); const rb = read('/newtab/views/RecycleBin.vue');
  return h.includes('export function pruneDanglingProjections') && r.includes('pruneDanglingProjections(data)') && rb.includes('aliveRes.has(p.cardId');
});
check('R70-18 P2 构建配置（sourcemap + pinyin 独立 chunk）', () => {
  const v = fs.readFileSync(path.resolve(__dirname, '..', 'vite.config.ts'), 'utf8');
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
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function catAggCount') && w.includes('aggCount: catAggCount(c.id)') && w.includes('directCount: (resBucket.value.get(c.id) || []).length');
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
check('R71-10 P2 isSelfWrite 先比长度再比内容（非本页写入短路）', () => {
  return read('/shared/storage/repository.ts').includes('s.length === lastSelfWriteJson.length && s === lastSelfWriteJson');
});
check('R71-11 P2 事件日志就地扫描三数组（不再 collectCards 建整张中间数组）', () => {
  const e = read('/shared/utils/eventLog.ts');
  return e.includes('const nextSnap = new Map<string, SnapshotEntry>()')
    && e.includes("scan('resource', d.resources)") && e.includes("scan('task', d.tasks)")
    && !e.includes('const current = collectCards(d)');
});
check('R71-12（R74 重写）长列表离屏渲染抑制（资源台 2 处 content-visibility）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return (w.match(/content-visibility: auto/g) || []).length >= 2 && w.includes('contain-intrinsic-size: auto 44px');
});
check('R71-13 P3 下钻面板惰性求值（抽屉未开不做全量计算）', () => {
  return read('/newtab/views/Workspace.vue').includes('if (!drillOpen.value) return []');
});
check('R71-14 P0 性能基准测试台入库（A/B 可复现）', () => {
  return fs.existsSync(path.resolve(__dirname, '..', 'scripts', 'perf.cjs'));
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
    && s.includes('curio: 4, task: 5, res: 5')
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
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("useCardCols('res'") && w.includes('v-model="resCols"') && w.includes("'--grid-cols': String(resCols)") && /.card-grid \{[^}]*var\(--grid-cols/.test(w);
});
check('R72-7（R74 重写；R88 重指：门控可落在包裹行上）列数选择器仅在卡片视图出现（三处宿主均以 viewMode 门控）', () => {
  // R88（W3）：Workspace 的列数选择器收进「筛选」气泡后，门控由 ColsPicker 自身移到其包裹行
  // （<div v-if="viewMode==='card'" class="fp-row">）——整行消失才不会留下一条空的「列数」标签。
  // 好奇心/任务两处仍是门控挂在组件自身（<ColsPicker v-if="viewMode ..."）。两种写法能力等价，
  // 故判定放宽为「<ColsPicker 与 viewMode 门控在 200 字符内互为前后」。
  const files = ['/newtab/components/compass/CuriosityPanel.vue', '/newtab/components/compass/TaskManagerPanel.vue', '/newtab/views/Workspace.vue'];
  const GATED = /v-if="viewMode[\s\S]{0,200}<ColsPicker|<ColsPicker v-if="viewMode/;
  return files.every(f => {
    const flat = read(f).replace(/\n\s*/g, ' ');
    return flat.includes('<ColsPicker') && GATED.test(flat);
  });
});
check('R72-8（R74 重写）卡片宽度自适应：三套网格模板均为 minmax(max(最小卡宽, 均分宽), 1fr)', () => {
  const pats = [
    ['/newtab/components/compass/CuriosityPanel.vue', 'max(200px, calc((100% - (var(--grid-cols, 4) - 1) * 12px) / var(--grid-cols, 4)))'],
    ['/newtab/components/compass/TaskManagerPanel.vue', 'max(240px, calc((100% - (var(--grid-cols, 5) - 1) * 12px) / var(--grid-cols, 5)))'],
    ['/newtab/views/Workspace.vue', 'max(var(--card-min-w), calc((100% - (var(--grid-cols, 5) - 1) * var(--card-gap)) / var(--grid-cols, 5)))']
  ];
  return pats.every(([f, p]) => read(f).includes(p));
});
check('R72-9 G7 界面偏好包补齐列数：导入侧按白名单归一后落库（sanitizeCardCols）', () => {
  const g = read('/newtab/views/GlobalSettings.vue');
  return g.includes('sanitizeCardCols') && g.includes('saveUIPrefs({ cardCols: cols })')
    && read('/shared/utils/cardCols.ts').includes('export function sanitizeCardCols');
});

console.log('');
console.log('【第七十三轮 · V2.42.0：资源台收敛（R16）】');
check('R73-1 资源台两入口合一：/curation 为 redirect（透传 query）到 /workspace/zy-curation，不再渲染独立组件', () => {
  const r = read('/newtab/router.ts');
  return r.includes("path: '/curation'") && r.includes('redirect: to => ({ path: ' + "'/workspace/' + CURATION_WS_ID" + ', query: to.query })')
    && !r.includes("import('./views/CurationCenter.vue')") && r.includes('CURATION_WS_ID');
});
check('R73-2 顶栏「资源台」Tab 高亮认 hub：activeTab 在 activeWorkspaceId === CURATION_WS_ID 时返回 curation', () => {
  const a = read('/newtab/App.vue');
  return a.includes("if (activeWorkspaceId.value === CURATION_WS_ID) return 'curation'") && a.includes("navigate('/curation')");
});
check('R73-3 KeepAlive 不再缓存已收敛的 CurationCenterView（三主视图）', () => {
  const a = read('/newtab/App.vue');
  return a.includes('keep-alive include="CompassHomeView,WorkspaceView,CompassShell"') && !a.includes('CompassHomeView,CurationCenterView,WorkspaceView');
});
// R84 重指：页头由 R73 的 hub 专属 `.ws-hub-head`（写死「资源台」）升级为 W1 的全台通用 `.ws-id-head`
// （台名取 workspace.name、描述取 workspace.desc）。**能力仍在且更强**——资源台标题可见，
// 而且不再写死、策展台也有了。名冻结、只改断言体，零退役。
check('R73-4 hub 补页头：资源台标题在页面内可见（R64-F13 删 hero 后的空档；R84 起走 W1 通用页头）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('class="ws-id-head"') && w.includes('class="wsh-name">{{ workspace.name }}')
    && w.includes('资源卡唯一存储 · 镜像源头')
    && w.includes('font-size: 19px; letter-spacing: .3px');
});
check('R73-5 导入弹窗 mode-aware：hub 提供书签+本地文件，策展台只收数据包 JSON', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("isHub ? '导入资源到资源台' : '导入策展台数据包'") && w.includes('bookmarkInput?.click()') && w.includes('@click="fileImport"') && w.includes('boardImportInput?.click()');
});
check('R73-6 书签导入全链路在 hub：解析/根文件夹白名单/前 2 级建分类/第 3 级+转标签/文件夹勾选弹窗', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function parseBookmarksHtml') && w.includes('function ensureBookmarkCategory') && w.includes('const BK_ROOT_NAMES = new Set(')
    && w.includes('segs.slice(2)') && w.includes('function confirmBookmarkImport') && w.includes('bkFolders');
});
check('R73-7（R89 重指：非镜像门控上移到包裹 template）hub 镜像推送入口：卡面 📡 / 分类 📤 / 目标台弹窗，且仅 hub 出现', () => {
  const w = read('/newtab/views/Workspace.vue');
  // R89（W4）：📡 自身的 `!isMirrorView(r)` 上移到包裹整条动作条的 <template>，语义等价（镜像卡整条不渲染写动作）
  return w.includes('title="镜像到策展台"') && w.includes('openMirrorCard(r)') && w.includes('openMirrorCat(sc.cat)')
    && w.includes('v-if="isHub" class="rc-action" title="镜像到策展台"') && w.includes('<template v-if="!isMirrorView(r)">')
    && w.includes('v-if="isHub && !isMirrorCat(sc.cat)"')
    && w.includes('function confirmMirrorPush') && w.includes('mirrorPushTargetCats');
});
check('R73-8 hub 补齐 L5：区域级落卡（空白区可落）+ 拖拽结束复位 + 混排重编号', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('@dragover="onAreaDragOver($event, g.key)"') && w.includes('@drop="onAreaDrop($event, g.key)"')
    && w.includes('function onAreaDrop') && w.includes('function acceptDragOver') && w.includes('function clearDragState')
    && w.includes('function reorderMixed') && w.includes('function catKeyToCatId');
});
check('R73-9 聚合哨兵不污染数据层（hub 口径）：新建/文件导入/空白区落卡 均经 newCardCatId 回落未分类', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function newCardCatId(): string') && w.includes("return (c && c !== 'uncat' && c !== 'all') ? c : ''")
    && w.includes('editingResource.categoryId = newCardCatId()') && w.includes('const catId = newCardCatId()')
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
check('R74-2 路由收敛保持：/curation 仍为 redirect（透传 query）到 /workspace/zy-curation', () => {
  const r = read('/newtab/router.ts');
  return r.includes("path: '/curation'") && r.includes('redirect: to => ({ path: ' + "'/workspace/' + CURATION_WS_ID" + ', query: to.query })') && r.includes('CURATION_WS_ID');
});
check('R74-3（R88 重指：导入入口收进 ⚙）hub 资源台工具条：四视图 + 搜索 + 批量 + 导入 + 新建', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("viewMode = ref<'card'|'list'|'kanban'|'pyramid'>('card')") && w.includes('☰ 列表') && w.includes('▤ 看板') && w.includes('toolbar-search') && w.includes('toolbar-batch') && w.includes('importModalOpen.value = true') && w.includes('function openImport(');
});
check('R74-4 hub 抽屉详情与双击开链（ResourceEditForm + 260ms 判别）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('ResourceEditForm') && w.includes('function openResource(r: ResourceCard)') && w.includes('onCardDblClick(r)') && w.includes('260');
});
check('R74-5 hub 批量浮动栏：全选/批量打开/移动到/批量删除 + 分类树选项', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('batch-bar') && w.includes('selectAllVisible') && w.includes('openBatchMove') && w.includes('batchDelete') && w.includes('moveCatOptions');
});
check('R74-6 hub 分类树：一键展开/收起 + 折叠态取反 + 节点计数走索引', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function expandAllCats') && w.includes('function collapseAllCats') && w.includes('collapsedCats') && w.includes('function catAggCount');
});
check('R74-7 hub 镜像分类同树呈现（isMirrorCat 徽标，无独立镜像分区）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('isMirrorCat(sc.cat)') && !w.includes('📡 镜像分组');
});
check('R74-8 hub 镜像推送入口：卡面 📡 / 分类 📤 / 目标台弹窗', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('title="镜像到策展台"') && w.includes('openMirrorCard(r)') && w.includes('openMirrorCat(sc.cat)') && w.includes('mirrorPushTargetCats') && w.includes('function confirmMirrorPush');
});
check('R74-9 hub 区域级落卡 + 混排重编号 + 拖拽复位', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('@dragover="onAreaDragOver($event, g.key)"') && w.includes('@drop="onAreaDrop($event, g.key)"') && w.includes('function reorderMixed') && w.includes('function acceptDragOver') && w.includes('function clearDragState');
});
check('R74-10 hub 分类节点拖拽体系：onCatDragStart/onCatDragOver/onCatDrop/onCatRootDrop + 新建子分类', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('function onCatDragStart') && w.includes('function onCatDragOver') && w.includes('function onCatDrop') && w.includes('function onCatRootDrop') && w.includes('openCreateCat');
});
check('R74-11 hub 删除分类回落：子分类提根 + 卡片回落待分类 + 清 targetWsId 投射', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('kids.forEach(k => { k.parentId = undefined })') && w.includes('r.categoryId === cat.id') && w.includes('p.targetWsId === workspaceId.value && p.targetCatId === cat.id');
});
check('R74-12 hub 递归防环与索引层：descendantIds/childCatsOf/catAggCount + catIndex 带 visited', () => {
  const w = read('/newtab/views/Workspace.vue'); const x = read('/shared/utils/catIndex.ts');
  return w.includes('function descendantIds') && w.includes('function childCatsOf') && w.includes('function catAggCount') && x.includes('带 visited');
});
check('R74-13 hub 离屏渲染抑制：content-visibility 2 处 + contain-intrinsic-size', () => {
  const w = read('/newtab/views/Workspace.vue');
  return (w.match(/content-visibility: auto/g) || []).length >= 2 && w.includes('contain-intrinsic-size: auto 44px');
});
check('R74-14 资源台两入口合一（顶栏 tab 高亮认 hub + KeepAlive 三视图）', () => {
  const a = read('/newtab/App.vue');
  return a.includes("if (activeWorkspaceId.value === CURATION_WS_ID) return 'curation'") && a.includes('keep-alive include="CompassHomeView,WorkspaceView,CompassShell"');
});
check('R74-15 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue'); const reg = fs.readFileSync(__filename, 'utf8'); const gs = read('/newtab/views/GlobalSettings.vue');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"') && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && gs.includes('runtimeVersion');
});

console.log('');
console.log('【第七十五轮 · V2.44.0：资源台（hub）指标条 3 格版（R18）】');
check('R75-1 资源台（hub）指标条 3 格块：v-if="isHub" class="ws-metrics hub3"', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('<div v-if="isHub" class="ws-metrics hub3">');
});
check('R75-2 hub 三格 label 齐备：📊 卡片总数 / 📎 附件数量 / 🕐 最近更新', () => {
  const w = read('/newtab/views/Workspace.vue');
  const s = w.indexOf('<div v-if="isHub" class="ws-metrics hub3">');
  const e = w.indexOf('<div v-if="!isHub" class="ws-metrics">');
  if (s < 0 || e < 0 || e < s) return false;
  const blk = w.slice(s, e);
  return blk.includes('📊 卡片总数') && blk.includes('📎 附件数量') && blk.includes('🕐 最近更新') && blk.includes('hubCountHint');
});
check('R75-3 hub 块不含论点格与来源构成格（无 openThesisDetail / 无 source 模式调用 / 无策展主题字样）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const s = w.indexOf('<div v-if="isHub" class="ws-metrics hub3">');
  const e = w.indexOf('<div v-if="!isHub" class="ws-metrics">');
  if (s < 0 || e < 0 || e < s) return false;
  const blk = w.slice(s, e);
  return !blk.includes('openThesisDetail') && !blk.includes("openDrill('source')") && !blk.includes('来源构成') && !blk.includes('策展主题');
});
check('R75-4 指标条样式分流：.ws-metrics.hub3 三列，.ws-metrics 本体仍 5 列（策展台布局未被改坏）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const i = w.indexOf('.ws-metrics.hub3');
  if (i < 0) return false;
  const seg = w.slice(i, i + 140);
  return seg.includes('grid-template-columns: repeat(3, 1fr)') && w.includes('.ws-metrics { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr; gap: 8px; margin: 10px 0 0; }');
});
check('R75-5 策展台 5 格块保留：v-if="!isHub" 块内仍为 5 张 metric-card', () => {
  const w = read('/newtab/views/Workspace.vue');
  const s = w.indexOf('<div v-if="!isHub" class="ws-metrics">');
  if (s < 0) return false;
  const e = w.indexOf('<CurationDrillDrawer', s);
  if (e < 0) return false;
  return (w.slice(s, e).match(/class="metric-card/g) || []).length === 5;
});
check('R75-6 hub 卡片总数补充口径 hubCountHint：镜像异常优先暴露，否则分类数 / 待分类数', () => {
  const w = read('/newtab/views/Workspace.vue');
  const i = w.indexOf('const hubCountHint = computed(');
  if (i < 0) return false;
  const seg = w.slice(i, i + 300);
  return seg.includes('metrics.value.mirrored > 0') && seg.includes('待清理') && seg.includes('metrics.value.categoryCount') && seg.includes('uncategorizedCount.value');
});
check('R75-7 hub 三格复用既有下钻：total / assets / recent 三 mode，未新增 mode 与下钻组件', () => {
  const w = read('/newtab/views/Workspace.vue');
  const s = w.indexOf('<div v-if="isHub" class="ws-metrics hub3">');
  const e = w.indexOf('<div v-if="!isHub" class="ws-metrics">');
  if (s < 0 || e < 0 || e < s) return false;
  const blk = w.slice(s, e);
  const dd = read('/newtab/components/CurationDrillDrawer.vue');
  const names = w.match(/[A-Za-z]*Drill[A-Za-z]*\.vue/g) || [];
  return blk.includes("openDrill('total')") && blk.includes("openDrill('assets')") && blk.includes("openDrill('recent')")
    && dd.includes("mode: 'total' | 'source' | 'assets' | 'recent'") && names.length > 0 && names.every(n => n === 'CurationDrillDrawer.vue');
});
check('R75-8 指标条数据源仍为 curationMetrics：未新增统计函数，hub.ts 统计段零改动', () => {
  const w = read('/newtab/views/Workspace.vue');
  const h = read('/shared/storage/hub.ts');
  return w.includes('const metrics = computed(() => curationMetrics(d.value, workspaceId.value))') && h.includes('export function curationMetrics') && !h.includes('R75');
});
check('R75-9 hub3 样式块零硬编码色（只用 tokens 变量）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const i = w.indexOf('.ws-metrics.hub3');
  if (i < 0) return false;
  const seg = w.slice(i, w.indexOf('\n', i));
  return !/#[0-9a-fA-F]{3,8}\b/.test(seg);
});

console.log('【第七十六轮 · V2.45.0：资源台计数口径统一（R3）】');
check('R76-1 待分类判据收敛为唯一实现 isUncat（含悬空卡口径）并被多处共用', () => {
  const w = read('/newtab/views/Workspace.vue');
  return (w.match(/isUncat\(/g) || []).length >= 6 && w.includes("function isUncat(r: ResourceCard, validIds: { has(id: string): boolean }): boolean") && w.includes('return !r.categoryId || !validIds.has(r.categoryId)');
});
check('R76-2 左树待分类计数改走 isUncat：严格口径（只看 !categoryId）退役', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('const uncategorizedCount = computed(() => allResources.value.filter(r => isUncat(r, catIdx.value.byId)).length)') && !w.includes("filter(r => !r.categoryId).length");
});
check('R76-3 左树分类计数统一取 directCount：聚合/直属三元混用退役（同屏不再两个数）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('{{ sc.directCount }}') && !w.includes('sc.hasChildren ? sc.aggCount : sc.directCount');
});
check('R76-4 看板列计数仍等于列内卡片数（items.length，与列内渲染自洽，未被误改）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('return { key: c.key, name: c.name, items, count: items.length }') && w.includes('{{ cat.count }}');
});
check('R76-5 卡片/列表分组计数仍等于组内卡片数（direct.length，未被误改）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('count: direct.length, items: direct, depth') && w.includes('· {{ g.count }}');
});
check('R76-6 左树「全部」与「待分类」均带口径 title，数值来源不变', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("<span class=\"cat-count\" title=\"本台全部可见卡（策展台含资源台镜像卡）\">{{ allResources.length }}</span>") && w.includes("<span class=\"cat-count\" title=\"未归入任何分类，或所属分类已失效\">{{ uncategorizedCount }}</span>");
});
check('R76-7 有子分类的侧栏节点以 title 补充子分类数与聚合数（childCount / aggCount 仍被消费）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('childCount: childCatsOf(c.id).length') && w.includes('childCount: number') && w.includes('含 ${sc.childCount} 个子分类（共 ${sc.aggCount} 张）');
});
check('R76-8 口径自洽前提：全部 / 各分类 / 待分类三者同源（allResources + 同一 resBucket 分桶 + isUncat）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('{{ allResources.length }}') && w.includes('directCount: (resBucket.value.get(c.id) || []).length') && w.includes("const resBucket = computed(() => buildBucketIndex(allResources.value, (r) => r.categoryId || ''))") && w.includes('filter(r => isUncat(r, catIdx.value.byId)).length');
});
check('R76-9 R18 指标条 hint 仍消费 uncategorizedCount（口径随本轮自动统一）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const i = w.indexOf('const hubCountHint = computed(');
  if (i < 0) return false;
  return w.slice(i, i + 300).includes('uncategorizedCount.value');
});
check('R76-10 卡面「所在分类」与分组归属判据同源 isUncat（五处共用同一实现）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('isUncat(r, catIdx.value.byId)') && w.includes('isUncat(r, validIds)');
});

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
check('R77-3 四主题强调色与 tokens.css 一一对应（防漂移：改任一侧回归必红）', () => {
  const o = read('/content/overlay-impl.ts');
  const t = read('/shared/styles/tokens.css');
  const keys = ['linear', 'apple', 'raycast', 'notion'];
  const vals = ['#5E6AD2', '#0071E3', '#FF6363', '#2383E2'];
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
const fnBody = (src, head, next) => {
  const i = src.indexOf(head);
  if (i < 0) return '';
  const j = src.indexOf(next, i + head.length);
  return j < 0 ? src.slice(i) : src.slice(i, j);
};
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
  return body.includes('zy-saved-title') && body.includes('该页面已收录') && body.includes('只能定位不能重复收录');
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
const segOf = (src, head, next) => {
  const i = src.indexOf(head);
  if (i < 0) return '';
  const j = src.indexOf(next, i + head.length);
  return j < 0 ? src.slice(i) : src.slice(i, j);
};
const RES_CARD_ACTIONS = segOf(read('/newtab/views/Workspace.vue'), '<div class="res-card-actions">', '</div>\n                <div class="rc-fields">');
const RES_ROW_ACTIONS = segOf(read('/newtab/views/Workspace.vue'), '<span class="rr-actions">', '</span>\n              </div>');
const KANBAN_ACTIONS = segOf(read('/newtab/views/Workspace.vue'), '<div class="kc-actions">', '</div>\n                <div class="kc-card-title">');
/** 六动作在模板中的固定顺序（↗ 📌 ⭐ 📂 📡 🗑） */
const SIX = ['openResourceLink(r)', 'togglePin(r)', 'toggleStar(r)', 'openMoveOne(r)', 'openMirrorCard(r)', 'deleteResource(r)'];
const inOrder = (seg) => {
  let at = -1;
  for (const fn of SIX) {
    const i = seg.indexOf(fn, at + 1);
    if (i < 0) return false;
    at = i;
  }
  return true;
};
check('R79-1 卡片视图动作条补 ↗ 打开（R1 方案首项；无链接时点击提示补全，显性化"待补全"）', () => {
  return RES_CARD_ACTIONS.includes('openResourceLink(r)') && RES_CARD_ACTIONS.includes('无链接则提示补全');
});
check('R79-2 卡片视图六动作齐全且顺序固定（↗ 📌 ⭐ 📂 📡 🗑）', () => inOrder(RES_CARD_ACTIONS));
check('R79-3 列表视图动作条补齐 ↗ / 📂 / 📡，与卡片视图同六动作同顺序', () => {
  return RES_ROW_ACTIONS.includes('openResourceLink(r)') && RES_ROW_ACTIONS.includes('openMoveOne(r)')
    && RES_ROW_ACTIONS.includes('openMirrorCard(r)') && inOrder(RES_ROW_ACTIONS);
});
check('R79-4 列表视图补 🔥 调用 N 次（rr-calls，与卡片视图同为 v-if="r.callCount"）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('class="rr-calls"') && w.includes('<span v-if="r.callCount" class="rr-calls"')
    && w.includes('<span v-if="r.callCount" class="rc-calls"');
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
check('R79-8（R89 重指：门控上移到包裹 template）三视图 📡 镜像口径一致：均只对真身卡出现', () => {
  // R89（W4）：`!isMirrorView(r)` 由 📡 自身上移到包裹整条动作条的 <template>，能力等价
  const G_WRAP = '<template v-if="!isMirrorView(r)">';
  const has = (seg) => seg.includes(G_WRAP) && seg.includes('openMirrorCard(r)');
  return has(RES_CARD_ACTIONS) && has(RES_ROW_ACTIONS) && has(KANBAN_ACTIONS);
});

console.log('【第八十轮 · V2.49.0：附件卡闭环（R13 导入改为附件卡 + R14 开放附件卡打开）】');
const IMPORT_FN = segOf(read('/newtab/views/Workspace.vue'), 'async function handleFileImport(', '\n// ===== 设置菜单');
const OPEN_LINK_FN = segOf(read('/newtab/views/Workspace.vue'), 'function openResourceLink(', '\n// 单击（详情）与双击（打开链接）区分');
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
    && w.includes("from '@/shared/utils/assetKind'");
});
check('R80-6 R13 导入 input 的 accept 已列支持类型（图片 / HTML / PDF）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const inp = segOf(w, '<input ref="fileImportInput"', '/>');
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
const stripComments = (s) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const BADGE = read('/shared/components/AssetBadge.vue');
const BADGE_TPL = segOf(BADGE, '<template>', '</template>');
const FIELDS = read('/shared/utils/fields.ts');
const GS = read('/newtab/views/GlobalSettings.vue');
const ASSET_KIND = read('/shared/utils/assetKind.ts');
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
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十二轮 · V2.51.0：挂载到任务（R4）】');
const WS82 = read('/newtab/views/Workspace.vue');
const CTX_FN = segOf(WS82, 'function openResCtx(', '// B6：拖拽插入线');
const CTX_MIRROR = segOf(CTX_FN, 'if (isMirrorView(r)) {', '} else {');
const CTX_OWN = segOf(CTX_FN, '} else {', 'resCtx.value = {');
const MOUNT_FN = segOf(WS82, 'function toggleMountTask(', 'function closeMountOne');
const MOUNT_PICKER = segOf(WS82, 'const mountTaskOptions = computed<TaskCard[]>(', 'function mountProjectName');
const RES_CARD_IFACE = segOf(read('/shared/models/index.ts'), 'export interface ResourceCard {', '\n}');
check('R82-1（R89 重指：门控上移到包裹 template）R4 三视图动作条均有 📋 挂载，且镜像卡不给入口', () => {
  // R89（W4）：📋 自身的 `v-if="!isMirrorView(r)"` 上移到包裹 <template>，语义等价
  const G_WRAP = '<template v-if="!isMirrorView(r)">';
  return RES_CARD_ACTIONS.includes(G_WRAP) && RES_CARD_ACTIONS.includes('class="rc-action mount"')
    && RES_ROW_ACTIONS.includes(G_WRAP) && RES_ROW_ACTIONS.includes('class="rr-action mount"')
    && KANBAN_ACTIONS.includes(G_WRAP) && KANBAN_ACTIONS.includes('class="kc-action mount"');
});
check('R82-2 R4 动作顺序：📋 在 📡 之后、🗑 之前（三视图一致）', () => {
  const at = (seg, s) => seg.indexOf(s);
  const ok = (seg) => {
    const m = at(seg, 'openMirrorCard(r)'), n = at(seg, 'openMountOne(r)'), d = at(seg, 'deleteResource(r)');
    return m >= 0 && n > m && d > n;
  };
  return ok(RES_CARD_ACTIONS) && ok(RES_ROW_ACTIONS) && ok(KANBAN_ACTIONS);
});
check('R82-3 R4 右键菜单双入口：非镜像分支有挂载项，镜像分支没有（只读引用口径）', () => {
  const own = stripComments(CTX_OWN), mir = stripComments(CTX_MIRROR);
  return own.includes('cb: () => openMountOne(r)') && own.includes("icon: 'clipboard'")
    && !mir.includes('openMountOne');
});
check('R82-4 R4 单向挂载红线：写入函数只改 task，资源卡零赋值', () => {
  const s = stripComments(MOUNT_FN);
  return s.includes('const rid = mountTarget?.id')
    && !/mountTarget\??\.\w+\s*=/.test(s)
    && !s.includes('.categoryId =') && !s.includes('.pinned =') && !s.includes('.starred =');
});
check('R82-5 R4 单向挂载红线：ResourceCard 模型零新增挂载类反向字段', () => {
  const rc = stripComments(RES_CARD_IFACE);
  return !rc.includes('mountedTaskIds') && !rc.includes('mountedTask') && !rc.includes('taskIds')
    && WS82.includes('function mountedTaskCount(r: ResourceCard): number');
});
check('R82-6 R4 选择器多选切换即生效：已挂载 filter 移出、未挂载展开加入（整体替换，非 push）', () => {
  const s = stripComments(MOUNT_FN);
  return s.includes('t.mountedResourceIds = arr.includes(rid) ? arr.filter(x => x !== rid) : [...arr, rid]')
    && !s.includes('.push(')
    && s.includes('t.updatedAt = Date.now()') && s.includes('store.persist()');
});
check('R82-7 R4 选择器：软删过滤 + 已挂载优先排序 + computed 内先 slice 再 sort + 上限 50', () => {
  const p = stripComments(MOUNT_PICKER);
  return p.includes('.filter(t => !t.deletedAt)') && p.includes('.slice()') && p.includes('.sort(')
    && p.includes('.slice(0, 50)') && p.includes("mountedResourceIds || []).includes(rid) ? 0 : 1");
});
check('R82-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十三轮 · V2.52.0：主航线信息密度（M1 + M2 + M3）】');
const LH = read('/newtab/components/compass/LighthousePanel.vue');
// ⚠ next 用 '\n</template>' —— 组件里还有嵌套的 <template #actions>，用裸 '</template>' 会在 437 字符处被截断
const LH_TPL = segOf(LH, '<template>', '\n</template>');
const LH_STYLE = segOf(LH, '<style scoped>', '</style>');
const TERM_FN = segOf(LH, 'function termText(', '/** R83（M2）：主攻项目数');
check('R83-1 M1 愿景/使命压成一行锚点条：.mr-vm-bar ≤44px + 12px 单行省略 + 整条可点', () => {
  return LH_TPL.includes('class="mr-vm-bar"') && LH_TPL.includes('@click="openTree">')
    && LH_STYLE.includes('.mr-vm-bar { display: flex') && LH_STYLE.includes('height: 44px')
    && LH_STYLE.includes('.mr-vm-text { flex: 1.2') && LH_STYLE.includes('font-size: 12px')
    && LH_STYLE.includes('text-overflow: ellipsis');
});
check('R83-2 M1 右端「进入方向树 ›」收敛为一个（不再每张卡各一个）', () => {
  return LH_TPL.split('进入方向树').length === 2 && LH_TPL.split('mr-vm-go').length === 2;
});
check('R83-3 M1 空态文案仍是「尚未设定愿景 / 尚未设定使命」', () => {
  return LH_TPL.includes("visionText || '尚未设定愿景'") && LH_TPL.includes("missionText || '尚未设定使命'");
});
check('R83-4 M2 期限三值映射齐全（远期/中期/近期）且未设期限不显示（v-if="dir.term"）', () => {
  const s = stripComments(TERM_FN);
  // ⚠ R85 重指：v-else 只在**目标头内**判——全模板判会被 R85 新增的「＋ 新建项目 / 内联输入」那对 v-if/v-else 误伤。
  //   本条要守的是"期限未设时不留空位"，与项目区无关。能力本身一字未动。
  const head = segOf(LH, '<div class="mgc-head">', '</div>');
  return s.includes("'远期'") && s.includes("'中期'") && s.includes("'近期'")
    && head.includes('v-if="dir.term" class="mgc-term"')
    && !head.includes('v-else');
});
check('R83-5 M2 主攻数只在 >0 时显示；进度百分比带 ⓘ 口径 tooltip', () => {
  return LH_TPL.includes('<template v-if="focusedOf(di)">（主攻 {{ focusedOf(di) }}）</template>')
    && LH_TPL.includes('class="mgc-pct-tip" title="各项目进度的算术平均')
    && segOf(LH, 'function focusedOf(', 'function openProject').includes('filter(p => p.isFocused).length');
});
check('R83-6 M3 项目小卡两行：🎯 主攻 / 停滞标 / 迷你进度条 / pct% · done/total / 已完成降透明度', () => {
  return LH_TPL.includes('class="cp-mark" title="主攻项目">🎯')
    && LH_TPL.includes('class="cp-flag"')
    && LH_TPL.includes('class="cp-bar"><i :style="{ width:')
    && LH_TPL.includes('}}% · {{ projMeta.get(p.id)?.done')
    && LH_TPL.includes("done: projMeta.get(p.id)?.finished }")
    && LH_STYLE.includes('.chip-proj.done { opacity: .55; }');
});
check('R83-7 ★ 性能红线：模板内不直接调 projectProgress / isProjectStalled（一律走 projMeta 索引）', () => {
  const t = stripComments(LH_TPL);
  return LH.includes('const projMeta = computed(')
    && !t.includes('projectProgress(') && !t.includes('isProjectStalled(')
    && t.includes('projMeta.get(p.id)');
});
check('R83-8 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十四轮 · V2.53.0：策展台身份与中心论点（W1 + W2）】');
const WS84 = read('/newtab/views/Workspace.vue');
const WSVIEW = read('/shared/utils/wsView.ts');
const HEAD_TPL = segOf(WS84, '<div class="ws-id-head">', '</div>');
const BANNER_TPL = segOf(WS84, '<div class="thesis-banner"', '</div>');
check('R84-1 W1 页头四要素齐全：图标 + workspace.name + 台描述 + 右端结构摘要', () => {
  return HEAD_TPL.includes("class=\"wsh-icon\">{{ workspace.icon")
    && HEAD_TPL.includes('class="wsh-name">{{ workspace.name }}')
    && HEAD_TPL.includes('class="wsh-desc"')
    && HEAD_TPL.includes('class="wsh-summary"');
});
check('R84-2 W1 描述为空不占位（v-if 而非三元）+ hub 回落 R73 既有文案', () => {
  // R90 重指：wsHeadDesc 拆成两态（自写描述内联 / 资源台 fallback 降为 ⓘ tooltip），
  // 能力完全一致——描述为空仍不占位（v-if + v-else-if，非三元），hub 回落文案一字未改。
  const fnOwn = segOf(WS84, 'const wsHeadDescOwn = computed(', 'const wsHeadDescFallback');
  const fnFb = segOf(WS84, 'const wsHeadDescFallback = computed(', 'const HUB_HELP_TEXT');
  return (HEAD_TPL.includes('v-if="wsHeadDescOwn"') || HEAD_TPL.includes('v-if="wsHeadDesc"'))
    && (HEAD_TPL.includes('v-else-if="wsHeadDescFallback"') || HEAD_TPL.includes('class="wsh-locator"'))
    && (stripComments(fnOwn) + stripComments(fnFb)).includes('workspace.value?.desc')
    && (stripComments(fnOwn) + stripComments(fnFb)).includes("'资源卡唯一存储 · 镜像源头'");
});
check('R84-3 W1 页头 ≤40px', () => {
  return segOf(WS84, '<style scoped>', '</style>').includes('.ws-id-head { display: flex; align-items: center; gap: 8px; min-height: 34px; max-height: 40px;');
});
check('R84-4 W1 页头对所有台渲染（不再是 v-if="isHub" 的 hub 专属）', () => {
  return !WS84.includes('class="ws-id-head" v-if="isHub"') && !WS84.includes('v-if="isHub" class="ws-id-head"')
    && WS84.includes('class="ws-id-head"');
});
check('R84-5 W2-① 论点横幅两态：已设 → 标题 + 查看金字塔；未设 → 轻引导', () => {
  return BANNER_TPL.includes('class="tb-title"') && BANNER_TPL.includes("setViewMode('pyramid')")
    && BANNER_TPL.includes('class="tb-hint"') && BANNER_TPL.includes('尚未设立中心论点');
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
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十五轮 · V2.54.0：主攻聚焦与就地可操作（M4 + M5）】');
const LH85 = read('/newtab/components/compass/LighthousePanel.vue');
const ST85 = read('/newtab/stores/compass.ts');
// ⚠ next 不能用裸 '</template>'——组件里有嵌套 <template #actions>，会在 437 字符处截断（R83 同款坑）
const TPL85 = segOf(LH85, '<template>', '\n</template>');
const STY85 = segOf(LH85, '<style scoped>', '</style>');
const FOCUS_FN = segOf(ST85, 'function toggleFocusProject(', 'function addProjectToDir');
const ADDP_FN = segOf(ST85, 'function addProjectToDir(', '// ---- 项目进度计算');
const FBAR_TPL = segOf(LH85, '<div class="mr-focus-bar"', '</div>');
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
check('R85-5 T0-B：四处新建出口都调 addProjectToDir（dir.projects.push 全项目收敛到 store 一处）', () => {
  const sh = stripComments(read('/newtab/views/CompassShell.vue'));
  const tr = stripComments(read('/newtab/views/CompassTree.vue'));
  const pc = stripComments(read('/newtab/views/ProjectCuration.vue'));
  const lh = stripComments(LH85);
  return sh.includes('addProjectToDir(') && tr.includes('addProjectToDir(')
    && pc.includes('addProjectToDir(') && lh.includes('addProjectToDir(')
    && !sh.includes('dir.projects.push') && !tr.includes('dir.projects.push')
    && !pc.includes('dir.projects.push') && !lh.includes('dir.projects.push')
    && ST85.includes('dir.projects.push(proj)');
});
check('R85-6 M4：聚焦条走 focusedProjects + projMeta 索引（模板内不直接调 projectProgress / isProjectStalled）', () => {
  return FBAR_TPL.includes('focusedProjects') && FBAR_TPL.includes('projMeta.get(p.id)?.pct')
    && !FBAR_TPL.includes('projectProgress(') && !FBAR_TPL.includes('isProjectStalled(')
    && !FBAR_TPL.includes('isProjectDone(');
});
check('R85-7 M4：两态齐全——有主攻横排 fp-item（可点进详情），无主攻轻引导且把「最多 N 个」说在前面', () => {
  return FBAR_TPL.includes('focusedProjects.length') && TPL85.includes('class="fp-item"')
    && TPL85.includes('openProject(p)') && TPL85.includes('class="fp-hint"')
    && TPL85.includes('FOCUS_PROJECT_LIMIT') && TPL85.includes('最多');
});
check('R85-8 M5-①：目标卡底内联新建——回车创建 / Esc 取消 / 失焦取消 / 预选该目标（不弹窗）', () => {
  return TPL85.includes('@keyup.enter="confirmAdd(dir.id)"') && TPL85.includes('@keyup.esc="cancelAdd"')
    && TPL85.includes('@blur="cancelAdd"') && TPL85.includes('class="chip-add"')
    && TPL85.includes('startAdd(dir.id)') && stripComments(LH85).includes('addProjectToDir(dirId, name)');
});
check('R85-9 M5-②：hover 两动作 🎯 / › 齐全且 .stop 防冒泡（不误触整卡点击进详情）', () => {
  const i = TPL85.indexOf('<span class="cp-acts">');
  const acts = i >= 0 ? TPL85.slice(i, i + 420) : '';
  return acts.includes('onToggleFocus(p)') && acts.includes('openProject(p)')
    && (acts.match(/@click\.stop/g) || []).length >= 2
    && STY85.includes('.chip-proj:hover .cp-acts { display: flex; }');
});
check('R85-10 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十六轮 · V2.55.0：方向台分工与项目总览检索（M7 + D-A + D-B）】');
const CS86 = read('/newtab/views/CompassShell.vue');
const LH86 = read('/newtab/components/compass/LighthousePanel.vue');
const CT86 = read('/newtab/views/CompassTree.vue');
const ST86 = read('/newtab/stores/compass.ts');
// ⚠ next 不能用裸 '</template>'——子组件模板里有嵌套 <template #actions>（R83 同款坑）
const CS_TPL = segOf(CS86, '<template>', '\n</template>');
const CS_STY = segOf(CS86, '<style scoped>', '</style>');
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
check('R86-3 M7：方向台页头有开关；完整方向树独立页那一处**保留**', () => {
  return CS_TPL.includes('class="done-toggle"') && CS_TPL.includes('toggleShowDone')
    && CT86.includes('toggleShowDone') && CT86.includes('class="tree-tool"');
});
check('R86-4 M7：主航线的「完整方向树 →」导航入口**未被误删**（只删开关，不删导航）', () => {
  return LH86.includes('class="mr-tool accent"') && LH86.includes('完整方向树 →') && LH86.includes('function openTree');
});
check('R86-5 D-A：两模块各有分工标签（主航线「看主线」/ 项目总览「管项目」）', () => {
  return LH86.includes('class="mod-role"') && LH86.includes('看主线')
    && CS_TPL.includes('class="mod-role"') && CS_TPL.includes('管项目')
    && CS_STY.includes(':deep(.mod-role)');
});
check('R86-6 D-B：搜索 + 筛选**仅在 >12 项时渲染**（OV_TOOLS_MIN = 12）', () => {
  return stripComments(CS86).includes('const OV_TOOLS_MIN = 12')
    && CS_TPL.includes('v-if="showOverviewTools"')
    && CS_TPL.includes('class="ov-search"') && CS_TPL.includes('class="ov-filter"');
});
check('R86-7 D-B：★ 状态判定复用 isProjectStalled / isProjectDone 且**预计算成索引**（模板内不逐项调）', () => {
  const fn = stripComments(segOf(CS86, 'const projState = computed(', 'const filteredProjects'));
  return fn.includes('isProjectStalled(p)') && fn.includes('isProjectDone(p)')
    && !CS_TPL.includes('isProjectStalled(') && !CS_TPL.includes('isProjectDone(');
});
check('R86-8 D-B：筛「已完成」而全局开关隐藏时给提示 + 一键显示（**不绕过全局口径**）', () => {
  return CS_TPL.includes("ovFilter === 'done' && !showDone") && CS_TPL.includes('显示已完成')
    && CS_TPL.includes('resetOvTools') && CS_TPL.includes('清除筛选');
});
check('R86-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十七轮 · V2.56.0：资源台检索（R5 + R7）】');
const WS87 = read('/newtab/views/Workspace.vue');
const LINK87 = read('/shared/utils/link.ts');
const REF87 = read('/newtab/components/ResourceEditForm.vue');
const MOD87 = read('/shared/models/index.ts');
// ⚠ next 不能用裸 '</template>'——Workspace 模板里有大量嵌套 <template>（v-for / v-if），会提前截断
const WS_TPL = segOf(WS87, '<template>', '\n</template>');
const WS_STY = segOf(WS87, '<style scoped>', '</style>');
check('R87-1 T0：链接三态判据只在 shared/utils/link.ts 定义（ResourceEditForm 的本地 isFullPath 已退役）', () => {
  return LINK87.includes('export function isZyAssetLink(') && LINK87.includes('export function isFullPath(')
    && LINK87.includes('export function linkStateOf(')
    && !stripComments(REF87).includes('function isFullPath(')
    && REF87.includes("import { linkStateOf } from '@/shared/utils/link'")
    && WS87.includes('linkStateOf');
});
check('R87-2 R5-①：排序五档齐备，hot 按 callCount 降序 + lastCalledAt 兜底；偏好读值走白名单', () => {
  const opts = segOf(WS_TPL, '<select class="toolbar-select" v-model="sortBy">', '</select>');
  const fn = stripComments(segOf(WS87, 'function applySort(', '// REQ-028'));
  return ['manual', 'recent', 'visited', 'hot', 'title'].every(k => opts.includes('value="' + k + '"'))
    && fn.includes("sortBy.value === 'hot'") && fn.includes('b.callCount||0') && fn.includes('b.lastCalledAt||0')
    && WS87.includes('const SORT_BY_KEYS') && WS87.includes('SORT_BY_KEYS.includes(store.ui.sortPrefs.res.by)');
});
check('R87-3 R5-②：筛选由 4 档扩到 8 档（optgroup 分「按链接类型 / 按状态」两组；旧四档值不变）', () => {
  const sel = segOf(WS_TPL, '<select class="toolbar-select" v-model="filterBy">', '</select>');
  return sel.includes('optgroup label="按链接类型"') && sel.includes('optgroup label="按状态"')
    && ['all', 'url', 'file', 'obsidian', 'hasLink', 'brokenPath', 'hasAssets', 'unmounted'].every(k => sel.includes('value="' + k + '"'))
    && WS87.includes('const FILTER_KEYS') && WS87.includes('const FILTER_PREDICATES');
});
check('R87-4 ★ R5-②：unmounted 走 mountedResIds 反查索引（筛选里不逐卡 filter tasks；单向挂载红线）', () => {
  const idx = stripComments(segOf(WS87, 'const mountedResIds = computed', 'function isBrokenPath'));
  const pred = stripComments(segOf(WS87, 'const FILTER_PREDICATES', '// 筛选（第八轮'));
  return idx.includes('d.value.tasks') && idx.includes('new Set<string>') && idx.includes('mountedResourceIds')
    && pred.includes('unmounted: (r) => !mountedResIds.value.has(r.id)')
    && !pred.includes('d.value.tasks.filter')
    && !MOD87.includes('mountedTaskIds');
});
check('R87-5 R7：zy-asset:// 附件卡判为 ok（不再被误报「待补全」）——三态判据先 zy 后 file', () => {
  const fn = stripComments(segOf(LINK87, 'export function linkStateOf(', '/** 统一打开通道'));
  const iZy = fn.indexOf('isZyAssetLink(t)');
  const iFile = fn.indexOf("linkType === 'file'");
  return fn.includes("if (isZyAssetLink(t)) return 'ok'") && iZy > 0 && iFile > iZy
    && REF87.includes('const linkIncomplete = computed') && REF87.includes('linkStateOf(props.model.linkType');
});
check('R87-6 R7-①：⚠ 待补全徽标三视图齐备（.rc-broken / .rr-broken / .kc-broken），样式全走 tokens', () => {
  return WS_TPL.includes('v-if="isBrokenPath(r)"')
    && WS_TPL.includes('class="rc-broken"') && WS_TPL.includes('class="rr-broken"') && WS_TPL.includes('class="kc-broken"')
    && WS_STY.includes('.rc-broken, .rr-broken, .kc-broken')
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
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十八轮 · V2.57.0：工具条分级与导入归位（W3 + W6）】');
const WS88 = read('/newtab/views/Workspace.vue');
const WS88_TPL = segOf(WS88, '<template>', '\n</template>');
const TB88 = segOf(WS88, '<div class="ws-toolbar">', '\n    </div>');
const POP88 = segOf(WS88, '<div class="filter-pop"', '\n        </div>');
// 气泡是工具条**中间**的嵌套子元素——要判"一级还剩什么"，得把气泡段**剔除**（不是从它起截断，
// 那会把气泡之后的「＋新建 / ⚙」一并切掉）
const TB1_88 = TB88.replace(POP88, '');
const SM88 = segOf(WS88, '<div class="settings-menu"', '\n    </div>');
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
check('R88-3 ★ W3-①：排序 / 方向 / 类型筛选 / 密度 / 列数 五个控件**已离开一级**（收进气泡，否定断言）', () => {
  return !TB1_88.includes('v-model="sortBy"') && !TB1_88.includes('sort-dir-btn')
    && !TB1_88.includes('v-model="filterBy"') && !TB1_88.includes('v-model="density"')
    && !TB1_88.includes('<ColsPicker');
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
check('R88-6 W3：批量模式激活时一级仍保留「✓ 完成批量」（.batch-bar 只在有选中时出现，退出通道不能断）', () => {
  return WS88_TPL.includes('v-if="batchMode" class="toolbar-batch active"') && WS88_TPL.includes('✓ 完成批量');
});
check('R88-7 W6：导入收进 ⚙ 且**按台身份改名**消歧义（资源台=导入资源 / 策展台=导入数据包）', () => {
  return SM88.includes('@click="openImport"') && SM88.includes("isHub ? '⬇ 导入资源' : '⬇ 导入数据包'")
    && WS88.includes('function openImport(') && WS88.includes('importModalOpen.value = true')
    && !TB1_88.includes('importModalOpen = true');
});
check('R88-8 主色稀缺：一级只有「＋ 新建」一个 primary（导入的 primary 按钮已随 W6 移除）', () => {
  return (TB1_88.match(/hero-btn primary/g) || []).length === 1
    && TB1_88.includes('hero-btn primary" @click="openNewResource"')
    && !TB1_88.includes('hero-btn ghost');
});
check('R88-9 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第八十九轮 · V2.58.0：检索补完与镜像卡只读（R6 + W5 + W4）】');
const WS89 = read('/newtab/views/Workspace.vue');
const WS89_TPL = segOf(WS89, '<template>', '\n</template>');
check('R89-1 R6：搜索纳入**自定义字段值**（此前能在卡片上显示却搜不到）', () => {
  const fn = stripComments(segOf(WS89, 'function matchCard(', '// 筛选（第八轮'));
  return fn.includes('Object.values(r.customFields || {})') && fn.includes('String(v).toLowerCase().includes(p.kw)');
});
check('R89-2 R6：`#标签` 直筛 —— 多个取**交集**，单个 # 回落为普通词', () => {
  const pq = stripComments(segOf(WS89, 'function parseQuery(', '/**' + ' 卡片是否命中查询'));
  const mc = stripComments(segOf(WS89, 'function matchCard(', '// 筛选（第八轮'));
  return pq.includes("tok.startsWith('#')") && pq.includes('tok.length > 1')
    && mc.includes('for (const t of p.tags) if (!cardTags.includes(t)) return false');
});
check('R89-3 ★ R6：搜索判据**只有一份** matchCard（filteredResources 内不再内联匹配表达式）', () => {
  const fr = stripComments(segOf(WS89, 'const filteredResources = computed(', '// 排序（第卅二轮'));
  return fr.includes('parseQuery(debouncedQuery.value)') && fr.includes('matchCard(r, p)')
    && !fr.includes("r.title.toLowerCase().includes(q)")
    && WS89_TPL.includes('#标签 可按标签直筛');
});
check('R89-4 W5：starred 星标筛选**四处同步**（白名单 / 谓词 / 标签 / 下拉）', () => {
  const keys = stripComments(segOf(WS89, 'const FILTER_KEYS = [', '\n'));
  const pred = stripComments(segOf(WS89, 'const FILTER_PREDICATES', '// 筛选（第八轮'));
  const labels = stripComments(segOf(WS89, 'const FILTER_LABELS', 'const filterLabel'));
  return keys.includes("'starred'") && pred.includes('starred: (r) => !!r.starred')
    && labels.includes("starred: '⭐ 星标'") && WS89_TPL.includes('<option value="starred">⭐ 星标</option>');
});
check('R89-5 ★ W4：三视图写动作（📌⭐📂🗑）对镜像卡隐藏——门控在包裹 template 上', () => {
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
    && WS89.includes('function locateMirrorSource(') && WS89.includes('function removeMirror(');
});
check('R89-7 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('【第九十轮 · V2.59.0：工具条收敛与右键菜单（R8 + R10 + R17）】');
const WS90 = read('/newtab/views/Workspace.vue');
const REF90 = read('/newtab/components/ResourceEditForm.vue');
const ICON90 = read('/shared/components/Icon.vue');
/** 页头段（第一条 </div> 即闭合，段内无嵌套 div） */
const HEAD90 = segOf(WS90, '<div class="ws-id-head">', '</div>');
/** 工具条段（以「③ 资源策展区」注释为界，避开气泡内的嵌套 div） */
const TB90 = segOf(WS90, '<div class="ws-toolbar">', '<!-- ③ 资源策展区 -->');
/** 右键菜单函数体（到 B6 拖拽段为止） */
const CTX90 = stripComments(segOf(WS90, 'function openResCtx(', '// ===== 拖拽排序'));
const STYLE90 = segOf(WS90, '<style scoped>', '</style>');

check('R90-1 ★ R8-①：常驻教学文案「· 可镜像到策展台」退出右端摘要（改「?」气泡）', () => {
  const summary = segOf(HEAD90, '<span class="wsh-summary"', '</span>');
  return !HEAD90.includes('· 可镜像到策展台') && !summary.includes('可镜像到策展台')
    && HEAD90.includes('class="wsh-help"') && HEAD90.includes('HUB_HELP_TEXT');
});
check('R90-2 R8-①：HUB_HELP_TEXT 逐字保留 04-18 原文案（不常驻 ≠ 删除）', () => {
  const t = stripComments(segOf(WS90, 'const HUB_HELP_TEXT =', '\n'));
  return t.includes('卡片在此存储为真身') && t.includes('📡 单卡') && t.includes('📤 分类') && t.includes('源数据零影响');
});
check('R90-3 R8-②：主 CTA「＋新建」前置——出现位置早于 .toolbar-search', () => {
  return TB90.includes('openNewResource')
    && TB90.indexOf('openNewResource') < TB90.indexOf('class="toolbar-search"')
    && (TB90.match(/openNewResource/g) || []).length === 1; // 不因重排出现两个主 CTA
});
check('R90-4 R8-②：右推职责交给 .toolbar-spacer（.toolbar-search 不再自带 margin-left:auto）', () => {
  const search = segOf(STYLE90, '.toolbar-search {', '}');
  return STYLE90.includes('.toolbar-spacer { flex: 1; }') && !search.includes('margin-left: auto');
});
check('R90-5 ★ R8-③：资源台 fallback 定位语不再内联（降为 ⓘ + title）；用户自写台描述**仍内联**', () => {
  return !HEAD90.includes('{{ wsHeadDesc }}')
    && HEAD90.includes('v-if="wsHeadDescOwn"') && HEAD90.includes('v-else-if="wsHeadDescFallback"')
    && HEAD90.includes('class="wsh-locator"')
    && stripComments(segOf(WS90, 'const wsHeadDescFallback = computed(', 'const HUB_HELP_TEXT')).includes('资源卡唯一存储 · 镜像源头');
});
check('R90-6 R10：右键菜单补「编辑详情」——直达抽屉（改前须先单击卡进详情）', () => {
  return CTX90.includes('编辑详情') && CTX90.includes('cb: () => openResource(r)');
});
check('R90-7 R10：右键菜单补星标（两态文案 + 调既有 toggleStar）', () => {
  return CTX90.includes('r.starred ?') && CTX90.includes('⭐ 星标') && CTX90.includes('cb: () => toggleStar(r)');
});
check('R90-8 ★ R10：「📡 镜像到策展台」带 isHub 门控（策展台的卡再推给别的台无意义）', () => {
  return CTX90.includes('isHub.value ?') && CTX90.includes('📡 镜像到策展台') && CTX90.includes('openMirrorCard(r)');
});
check('R90-9 ★ R17：wsOptions 在 workspaceId===CURATION_WS_ID 时首位注入「资源台（真身）」', () => {
  const fn = stripComments(segOf(REF90, 'const wsOptions = computed(', '/** 分类随所选策展台联动'));
  return fn.includes('CURATION_WS_ID') && fn.includes('资源台（真身）') && fn.includes('store.workspaces')
    && REF90.includes("import { CURATION_WS_ID } from '@/shared/models'");
});
check('R90-10 R10 附带：Icon 补齐 edit / star / share（此前 icon:"star" 静默回落罗盘）；中心论点让位 target', () => {
  return ICON90.includes('edit:') && ICON90.includes('star:') && ICON90.includes('share:')
    && CTX90.includes("icon: 'edit'") && CTX90.includes("icon: 'star'") && CTX90.includes("icon: 'share'")
    && CTX90.includes("icon: 'target'");
});
check('R90-11 版本五处同步（manifest/package/ManualPage/regression/关于页动态）', () => {
  const m = read('/manifest.ts');
  const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8');
  const mp = read('/newtab/views/ManualPage.vue');
  const reg = fs.readFileSync(__filename, 'utf8');
  return m.includes(VER_ANCHOR_LITERAL) && pkg.includes('"version": "' + CUR_VER + '"')
    && mp.includes(CUR_VTAG) && reg.includes(VER_ANCHOR_LITERAL) && GS.includes('runtimeVersion');
});

console.log('回归结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
