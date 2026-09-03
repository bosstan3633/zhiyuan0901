/* 知源工作台 V2.11.0 回归验证矩阵（交付前必须全绿；当前 337 项）
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
function read(p) { return fs.readFileSync(base + p, 'utf8'); }
function count(p, str) { return read(p).split(str).length - 1; }
function exists(p) { return fs.existsSync(base + p); }

console.log('【红线检查】');
check('单向挂载：Task 持有 mounted 字段', () => count('/shared/models/index.ts', 'mountedResourceIds: ID[]') === 1 && count('/shared/models/index.ts', 'mountedCuriosityIds: ID[]') === 1);
check('单向挂载：Curiosity 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface CuriosityCard')[1].split('}')[0]));
check('单向挂载：Resource 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface ResourceCard')[1].split('}')[0]));
check('数据 100% 本地：无 http 数据上传', () => !/fetch\(|XMLHttpRequest/.test(read('/newtab/App.vue')));

console.log('【架构检查】');
check('路由：首页/罗盘三子页/工作台/设置', () => count('/newtab/router.ts', "path: 'actions'") === 1 && count('/newtab/router.ts', "path: 'projects'") === 1 && count('/newtab/router.ts', "path: 'tree'") === 1);
check('旧任务中心路由已退役', () => !read('/newtab/router.ts').includes("'/tasks'"));
check('此刻最重要已整体移除', () => !exists('/newtab/components/compass/FocusPanel.vue'));
check('罗盘容器：Hero+左栏+三子页', () => count('/newtab/views/CompassShell.vue', 'compass-hero') >= 1 && count('/newtab/views/CompassShell.vue', 'cat-item') >= 3);

console.log('【A组 弹窗工作流】');
check('四端 zy-locate-workspace 单例定位', () => ['background/index.ts', 'content/search-overlay.ts', 'newtab/components/GlobalPopups.vue', 'popup/App.vue'].every(f => count('/' + f, 'zy-locate-workspace') >= 1));
check('B14 网页浮层 corner 模式 display:flex', () => read('/content/search-overlay.ts').includes('.corner{display:flex'));
check('B12 应用内采集弹窗右上角', () => read('/newtab/components/GlobalPopups.vue').includes('.gp-overlay.corner { align-items: flex-start; justify-content: flex-end'));
check('B5 采集去重（应用内+网页端）', () => count('/newtab/components/GlobalPopups.vue', 'normalizeUrl') >= 1 && count('/content/search-overlay.ts', 'normalizeUrl') >= 1);
check('好奇心反馈 💗好奇心+1', () => read('/content/search-overlay.ts').includes('💗好奇心+1') && read('/newtab/components/GlobalPopups.vue').includes('💗好奇心+1'));
check('B9 已保存态 Enter 监听', () => read('/content/search-overlay.ts').includes("document.addEventListener('keydown', onSavedKeydown, true)"));

console.log('【B组 修复】');
check('B1/B2 任务抽屉级联+Ctrl+Enter 容器级', () => read('/newtab/views/CompassActions.vue').includes('onSelProjectChange') && read('/newtab/views/CompassActions.vue').includes('task-sidebar" :style="{ width: drawerW + \'px\' }" @keydown.ctrl.enter.prevent'));
check('B3 单例询问链路（zy-where）', () => read('/background/index.ts').includes('zy-where'));
check('B4 搜索定位：任务→今日行动/好奇→首页', () => read('/newtab/components/GlobalPopups.vue').includes("path: '/compass/actions', query: { hl: item.id }") && read('/newtab/components/GlobalPopups.vue').includes("path: '/', query: { hl: item.id }"));
check('B10 open-dashboard 复用标签页', () => read('/background/index.ts').includes('B10：已有新标签页则聚焦回归'));
check('B11/B29 搜索 Tab 循环切换类型', () => read('/content/search-overlay.ts').includes('cycle.indexOf') && read('/newtab/components/GlobalPopups.vue').includes('cycle.indexOf'));

console.log('【O组 优化】');
check('O3 批量挂载', () => read('/newtab/views/CompassActions.vue').includes('confirmBatchMount'));
check('O5 好奇心看板跨列拖拽', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCzKanbanDrop'));
check('O7 好奇心双击打开来源 URL', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCardDblClick'));
check('O14 任务列表按项目分组', () => read('/newtab/views/CompassActions.vue').includes('groupedTasks'));
check('O15 罗盘固定回今日行动', () => read('/newtab/App.vue').includes("navigate('/compass/actions')"));
check('O16 挂载候选搜索浮层', () => read('/newtab/views/CompassActions.vue').includes('ts-mount-pop'));

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
check('H1 工作台快捷键映射+五修饰键', () => read('/shared/utils/index.ts').includes('effectiveWsHotkeys') && read('/newtab/views/GlobalSettings.vue').includes('modLabel'));

console.log('【第五轮】');
check('B17 方向树目录入 tree-layout 左栏', () => read('/newtab/views/CompassTree.vue').indexOf('tree-page-head') < read('/newtab/views/CompassTree.vue').indexOf('tree-layout') && read('/newtab/views/CompassTree.vue').includes('class="tree-layout"'));
check('B17 目录与策展目录样式统一(200px sticky)', () => read('/newtab/views/CompassTree.vue').includes('width: 200px; flex-shrink: 0;') && read('/newtab/views/CompassTree.vue').includes('position: sticky'));
check('B18 字段行样式迁入子组件', () => count('/newtab/views/FieldEditor.vue', 'gs-fr-action') >= 2);
check('B22 状态三选 chips', () => read('/newtab/views/CompassActions.vue').includes('ts-status-chip'));
check('B23 文档级 Ctrl+Enter/Esc', () => read('/newtab/views/CompassActions.vue').includes('onSidebarDocKey'));
check('O19 灯塔极简卡+详情抽屉', () => read('/newtab/components/compass/LighthousePanel.vue').includes('ProjectDetailDrawer') && read('/newtab/components/compass/LighthousePanel.vue').includes('lhp-nums'));
check('O20 标签3级守卫+缩进兜底', () => read('/newtab/views/GlobalSettings.vue').includes('标签最多 3 级') && read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));
check('O21 分组列表跨组拖拽改归属', () => read('/newtab/views/CompassActions.vue').includes('onListGroupDrop'));
check('Bug1 目标卡按钮/箭头不重叠', () => read('/newtab/views/CompassTree.vue').includes('margin-right: 52px'));
check('Bug2 标签缩进 !important 兜底', () => read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));

console.log('【第六轮】');
check('B24 关联卡片标题 chips + 详情抽屉', () => read('/newtab/views/CompassTree.vue').includes('linked-chip') && read('/newtab/views/CompassTree.vue').includes('peekData'));
check('B24 打开链接含 file:/// 转换（第卅二轮下沉至 shared/utils/link）', () => read('/shared/utils/link.ts').includes('file:///') && read('/newtab/views/CompassTree.vue').includes('toOpenableRawLink'));
check('B25 选取弹窗置灰（已完成/已选入）', () => read('/newtab/views/CompassActions.vue').includes('pickerDisabled') && read('/newtab/views/CompassActions.vue').includes('pickedIds'));
check('B26 方向树默认全局展开', () => read('/newtab/views/CompassTree.vue').includes('expandAllNodes'));
check('B27 孤儿任务小节', () => read('/newtab/views/ProjectCuration.vue').includes('orphanTasks') && read('/newtab/views/ProjectCuration.vue').includes('未归类任务'));
check('B28 全局确认弹窗组件', () => fs.existsSync(base + '/shared/components/ConfirmDialog.vue') && fs.existsSync(base + '/shared/components/confirm.ts'));
check('B28 原生 confirm 全清除', () => { let n = 0; ['newtab/views/Workspace.vue','newtab/views/ProjectCuration.vue','newtab/components/compass/CuriosityPanel.vue','newtab/components/GlobalPopups.vue','newtab/views/GlobalSettings.vue','newtab/views/FieldEditor.vue','newtab/views/CompassActions.vue'].forEach(f => { n += count('/' + f, 'confirm('); }); return n === 0; });
check('O22 使用手册完整内容（外置数据）', () => read('/newtab/manual-data.ts').includes('quick-1') && read('/newtab/manual-data.ts').includes('ref-2') && !read('/newtab/views/GlobalSettings.vue').includes('占位内容'));
check('产品 logo 替换（首页+关于页+扩展图标）', () => read('/newtab/App.vue').includes('logoUrl') && read('/newtab/views/GlobalSettings.vue').includes('logoUrl') && fs.existsSync(base + '/assets/logo.png'));

check('manifest 2.18.1', () => read('/manifest.ts').includes("version: '2.18.1'"));
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
check('第七轮编译修复：drawerDelete/ttRemove async 化', () => read('/newtab/views/ProjectCuration.vue').includes('async function drawerDelete') && read('/newtab/views/GlobalSettings.vue').includes('async function ttRemove'));
check('B5 应用内采集去重流程完整（dup 分支在 saveCapture 内）', () => count('/newtab/components/GlobalPopups.vue', 'saveCapture') >= 3 && read('/newtab/components/GlobalPopups.vue').includes('resetCaptureForm()\n      closeAll()\n      return'));

console.log('【第八轮 · 分类体系】');
check('W1 数据模型：Category +parentId?/pinned?', () => read('/shared/models/index.ts').includes('parentId?: ID') && read('/shared/models/index.ts').includes('pinned?: boolean'));
check('W2 分类新建/重命名应用内弹窗（无原生 prompt）', () => read('/newtab/views/Workspace.vue').includes('confirmCatModal') && read('/newtab/views/Workspace.vue').includes('openRenameCat') && !read('/newtab/views/Workspace.vue').includes('prompt('));
check('W3 分类删除：子级自动升级 + 资源并入/转待分类', () => read('/newtab/views/Workspace.vue').includes('deleteCategory') && read('/newtab/views/Workspace.vue').includes('升级为一级分类'));
check('W4 左栏树形渲染 + 置顶分区 + 聚合计数', () => read('/newtab/views/Workspace.vue').includes('sidebarCats') && read('/newtab/views/Workspace.vue').includes('pinnedRootCats') && read('/newtab/views/Workspace.vue').includes('catAggCount') && read('/newtab/views/Workspace.vue').includes('familyIds'));
check('W5 父分类聚合过滤（点击父分类含子分类资源）', () => read('/newtab/views/Workspace.vue').includes('const ids = familyIds(activeCategory.value)'));
check('W6 分类拖拽：挂子级/同级排序/升一级/防循环', () => read('/newtab/views/Workspace.vue').includes("catDropMode.value = 'child'") && read('/newtab/views/Workspace.vue').includes('onCatRootDrop') && read('/newtab/views/Workspace.vue').includes('不能移动到自己的子分类') && read('/newtab/views/Workspace.vue').includes('最多 2 级'));
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
check('O23 北极星未归档任务（指标缺失也算）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('未归档任务') && read('/newtab/components/compass/NorthStarPanel.vue').includes('!t.deletedAt && !t.metricId') && !read('/newtab/components/compass/NorthStarPanel.vue').includes('pendingTasks'));
check('O24 好奇心采集带来源（两端+模型+详情）', () => read('/shared/models/index.ts').includes('sourceTitle') && read('/content/search-overlay.ts').includes('sourceTitle: srcTitleInput') && read('/newtab/components/GlobalPopups.vue').includes('v-model="curioForm.sourceTitle"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('detail-src'));

console.log('【第十四轮 · Linear 视觉重构】');
check('P1 六主题 Linear 体系（深空薰衣草默认）', () => read('/shared/styles/tokens.css').includes("[data-theme='linear']") && read('/shared/styles/tokens.css').includes('#010102') && read('/shared/styles/tokens.css').includes('#5E6AD2'));
check('P1 默认主题迁移（green→linear 一次性）', () => read('/shared/storage/repository.ts').includes("theme: 'linear'") && read('/shared/storage/repository.ts').includes("uiCache.theme === 'green'"));
check('P2 封面扁平化（移除渐变封面功能）', () => !read('/newtab/views/Workspace.vue').includes('COVER_THEMES') && !read('/newtab/views/Workspace.vue').includes('heroGradient') && read('/newtab/views/Workspace.vue').includes('background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;'));
check('P2 罗盘 Hero 扁平化', () => read('/newtab/views/CompassShell.vue').includes('.compass-hero { position: relative; height: 128px; background: var(--surface); border-bottom: 1px solid var(--border);'));
check('P3 去弹跳（hover 无位移）+ 焦点环', () => !read('/newtab/views/ProjectCuration.vue').includes('translateY(-3px)') && !read('/newtab/views/Workspace.vue').includes('.res-card:hover { border-color: var(--accent); box-shadow') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('P3 过渡统一 200ms 内', () => !read('/newtab/views/ProjectCuration.vue').includes('transform .26s') && read('/shared/styles/tokens.css').includes('letter-spacing: -0.011em'));

console.log('【第廿七轮 · 身份与排版精修】');
check('R28 信纸排版精修（衬线+留白，应用内+分享版；第廿九轮更新为明显留白参数）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 72px 64px') && read('/newtab/letter-data.ts').includes('padding: 88px 76px'));
check('R28 donge 哥身份（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R28 手册排版留白精修（三处同步）', () => read('/newtab/views/ManualPage.vue').includes('padding: 36px 44px') && read('/newtab/views/GlobalSettings.vue').includes('padding: 34px 40px') && read('/newtab/manual-data.ts').includes('padding: 38px 46px'));

console.log('【第廿六轮 · 信件身份与排版精修】');
check('R26-1 donge 哥身份融入（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R26-2 信纸与手册排版留白精修（信纸参数第廿九轮更新）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 72px 64px') && read('/newtab/views/ManualPage.vue').includes('padding: 36px 44px') && read('/newtab/manual-data.ts').includes('padding: 38px 46px'));

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
check('R21-2 拖拽位置感知全落点（好奇列表/看板 + 任务分组行/看板 + 资源看板）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes("const after = dropMark.value.endsWith('-b')") && read('/newtab/views/CompassActions.vue').includes("markTaskDrop($event, task.id)") && read('/newtab/views/CompassActions.vue').includes('onTaskCardDrop') && read('/newtab/views/Workspace.vue').includes("markDrop($event, r.id, 'y')"));
check('R21-3 页面对齐（罗盘/工作台统一页边距）', () => read('/newtab/views/CompassShell.vue').includes('padding: 0 20px 24px') && read('/newtab/views/Workspace.vue').includes('padding: 0 20px 24px'));
check('R21-4 手册独立页（/manual 路由 + 目录锚点 + 富文本非 scoped）', () => read('/newtab/router.ts').includes("path: '/manual'") && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-tip') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab'));

console.log('【第十九~二十轮 · 拼音搜索/拖拽修复/手册白皮书】');
check('R19 拼音/首字母搜索（两端）', () => read('/shared/utils/pinyin.ts').includes("pattern: 'pinyin'") && read('/newtab/components/GlobalPopups.vue').includes('matchPinyin') && read('/content/search-overlay.ts').includes('matchPinyin'));
check('R20a 拖拽失效修复（去虚拟置顶排序；物理置顶已于第卅三轮 R33-1 改为独立分区）', () => !read('/newtab/views/CompassActions.vue').includes('置顶任务优先（稳定排序') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('第十七轮：置顶优先'));
// 第卅三轮 R33-1：BUG-D 修复 —— 物理 unshift 会破坏手动拖拽排序，置顶改独立分区（R20a 旧断言随行为变更同步更新）
check('R33-1 BUG-D 任务置顶独立分区（不再物理 unshift 源数组）', () => !read('/newtab/views/CompassActions.vue').includes('置顶动作物理移到列表顶部') && read('/newtab/views/CompassActions.vue').includes('pinnedTasks') && read('/newtab/views/CompassActions.vue').includes('normalTasks') && read('/newtab/views/CompassActions.vue').includes('📌 置顶 · {{ pinnedTasks.length }}'));
check('R20b 使用手册五篇重写（外置数据源）', () => read('/newtab/manual-data.ts').includes('速览 · 一页上手') && read('/newtab/manual-data.ts').includes('理念篇 · 知源哲学') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab') && read('/newtab/views/ManualPage.vue').includes("from '../manual-data'") && read('/newtab/router.ts').includes("'/manual'"));

console.log('【第十八轮 · 交互视觉全面优化】');
check('A1/A2 图标体系 + EmptyState 组件', () => read('/shared/components/Icon.vue').includes('download') && read('/shared/components/EmptyState.vue').includes('es-art') && read('/shared/components/ModuleCard.vue').includes('iconName'));
check('A3~A10 全局形态（徽章/滚动条/负字距/等宽/焦点环）', () => read('/shared/styles/tokens.css').includes('body .tag, body .rc-tag') && read('/shared/styles/tokens.css').includes('font-variant-numeric: tabular-nums') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('B1 命令面板升级（分组/高亮/快捷操作/最近）', () => read('/newtab/components/GlobalPopups.vue').includes('groupedResults') && read('/newtab/components/GlobalPopups.vue').includes('QUICK_ACTIONS') && read('/newtab/components/GlobalPopups.vue').includes('hlTitle') && read('/content/search-overlay.ts').includes('QUICK_ACTIONS_ZY'));
check('B2 删除可撤销（Toast 全局单例统一 3s，REQ-030 收敛）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 3000') && read('/newtab/App.vue').includes('<Toast />') && read('/newtab/views/Workspace.vue').includes("label: '撤销'") && read('/shared/components/Toast.vue').includes('toastState') && !read('/newtab/views/Workspace.vue').includes('runToastAction') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast'));
check('B3 快捷键速查面板（? 呼出）', () => read('/newtab/components/GlobalPopups.vue').includes('SHORTCUT_GROUPS') && read('/newtab/App.vue').includes("e.key === '?'"));
check('B4/B9 键盘导航（任务列表 + 日期）', () => read('/newtab/views/CompassActions.vue').includes('onTaskNavKey') && read('/newtab/views/CompassActions.vue').includes('onDateKey'));
check('B5 统一右键菜单（三卡）', () => read('/shared/components/ContextMenu.vue').includes('cx-item') && read('/newtab/views/Workspace.vue').includes('openResCtx') && read('/newtab/views/CompassActions.vue').includes('openTaskCtx') && read('/newtab/components/compass/CuriosityPanel.vue').includes('openCurioCtx'));
check('B6 拖拽插入线', () => read('/newtab/views/Workspace.vue').includes('drop-line-t') && read('/newtab/views/CompassActions.vue').includes('drop-line-t') && read('/newtab/components/compass/CuriosityPanel.vue').includes('drop-line-t'));
check('B7 抽屉宽度记忆', () => read('/shared/models/index.ts').includes('drawerWs') && read('/newtab/views/CompassActions.vue').includes('startDrawerResize'));
check('B8/B10/B11 焦点返还/列头sticky/加载态', () => read('/newtab/components/GlobalPopups.vue').includes('lastFocused') && read('/newtab/views/CompassActions.vue').includes('.khead { position: sticky;') && read('/newtab/views/CompassActions.vue').includes('exportBusy'));

console.log('【第十七轮 · 修复与功能补全】');
check('R17-1 三件事导出弹窗（时间范围+6字段 CSV）', () => read('/newtab/views/CompassActions.vue').includes('openExportModal') && read('/newtab/views/CompassActions.vue').includes('任务内容,所属项目,项目→成功指标,任务状态,安排时间,创建时间') && read('/newtab/views/CompassActions.vue').includes('doExport'));
check('R17-2 好奇心来源仅选中时附带（两端，可为空）', () => read('/newtab/components/GlobalPopups.vue').includes("if (sel) {") && read('/content/search-overlay.ts').includes('const hasSel = !!selection'));
check('R17-3 项目策展创建项目（视觉链+选战略目标+直接进展板）', () => read('/newtab/views/ProjectCuration.vue').includes('openCreateProject') && read('/newtab/views/ProjectCuration.vue').includes('confirmCreateProject') && read('/newtab/views/ProjectCuration.vue').includes('createDirId') && read('/newtab/views/ProjectCuration.vue').includes('cm-chain'));
check('R17-4 灯塔入口移至模块右上角', () => read('/newtab/components/compass/LighthousePanel.vue').includes('<template #actions>') && read('/newtab/components/compass/LighthousePanel.vue').includes('lh-top-action') && !read('/newtab/components/compass/LighthousePanel.vue').includes('lh-footer">'));
check('R17-5 置顶右上角统一（好奇三视图）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('cz-pin-corner') && read('/newtab/components/compass/CuriosityPanel.vue').includes('置顶优先'));
check('R17-6 任务卡置顶（模型+列表+看板+选取）', () => read('/shared/models/index.ts').includes('pinned?: boolean') && read('/newtab/views/CompassActions.vue').includes('toggleTaskPin') && read('/newtab/views/CompassActions.vue').includes('.k-pin') && read('/newtab/views/CompassActions.vue').includes('.t-pin'));

console.log('【第十三轮 · V2.2.0 正式版】');
check('V13-1 任务卡链接字段 + 单/双击统一', () => read('/shared/models/index.ts').includes('link?: string') && read('/newtab/views/CompassActions.vue').includes('onTaskRowDblClick') && read('/newtab/views/CompassActions.vue').includes('openCardLink'));
check('V13-2 任务抽屉链接+备注（可拖拽调高）', () => read('/newtab/views/CompassActions.vue').includes('selectedTask.link') && read('/newtab/views/CompassActions.vue').includes('selectedTask.description') && read('/newtab/views/CompassActions.vue').includes('.ts-note {'));
check('V13-3 好奇心链接口径（sourceUrl+本地路径直达）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('toOpenableCurioLink') && read('/newtab/components/compass/CuriosityPanel.vue').includes('链接（网页 / 本地路径 / obsidian://，双击卡片直达）'));
check('V13-4 文本框可拖拽调高（三卡详情）', () => read('/newtab/components/ResourceEditForm.vue').includes('.ref-note {') && read('/newtab/components/compass/CuriosityPanel.vue').includes('max-height: 400px') && read('/newtab/views/CompassActions.vue').includes('max-height: 320px'));
check('V13-5 罗盘子页 out-in 过渡移除（切换即时）', () => !read('/newtab/views/CompassShell.vue').includes('mode="out-in"'));
check('V13-6 刷新骨架品牌动画保留（仅加载时）', () => read('/../src/newtab/index.html').includes('zy-skl'));

console.log('【第廿八轮 · 拖拽体系修复】');
check('R28-1 资源卡片/列表/看板可拖拽（draggable 修复，分区 v-for 单模板复用）', () => read('/newtab/views/Workspace.vue').split(':draggable="!batchMode"').length - 1 >= 4 && read('/newtab/views/Workspace.vue').includes('onDropCard($event,r)') && read('/newtab/views/Workspace.vue').includes('onKanbanCardDrop($event, r)'));
check('R28-1b 资源列表行插入线 CSS', () => read('/newtab/views/Workspace.vue').includes('.res-row.drop-line-t') && read('/newtab/views/Workspace.vue').includes('.res-row.drop-line-b'));
check('R28-2 任务看板跨列落卡=改状态（统一状态出口）', () => read('/newtab/views/CompassActions.vue').includes('onTaskCardDrop($event, task, groupByProject)') && read('/newtab/views/CompassActions.vue').includes('setTaskStatusOf(moved, status)'));
check('R28-3 任务跨组落卡=改归属清指标（列表+看板）', () => read('/newtab/views/CompassActions.vue').includes('onTaskDrop(task, true)') && read('/newtab/views/CompassActions.vue').includes('moved.metricId = undefined'));
check('R28-4 好奇看板跨列落卡=改状态 + 轴向修正', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCzDrop($event, c.id, col.status)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("axis === 'x'"));
check('R28-5 资源看板跨分类落卡=改分类', () => read('/newtab/views/Workspace.vue').includes("moved.categoryId = target.categoryId || ''"));
check('R28-6 展板任务拖拽 off-by-one 修复+落库', () => read('/newtab/views/ProjectCuration.vue').includes('const after = (e.clientY - rect.top) / rect.height > 0.5'));

console.log('【第廿九轮 · Tab排序/拖卡归档/信纸留白 · V2.9.0】');
check('R29-1 工作台 Tab 拖拽排序（插入线+order 全量规整落库）', () => read('/newtab/App.vue').includes('onWsTabDrop') && read('/newtab/App.vue').includes('wsDropMark') && read('/newtab/App.vue').includes('list.forEach((w, i) => { w.order = i })'));
check('R29-2 快捷键跟随位置（顺序即快捷键，自定义绑定移除）', () => read('/newtab/views/GlobalSettings.vue').includes('顺序即快捷键') && read('/newtab/App.vue').includes('switchToIndex') && !read('/newtab/views/GlobalSettings.vue').includes('setWsHotkey'));
check('R29-3 资源卡拖到侧栏分类改归属（三视图通用+待分类落点）', () => read('/newtab/views/Workspace.vue').includes('cardDropTarget') && read('/newtab/views/Workspace.vue').includes('onDropToCategory(e, cat.id)') && read('/newtab/views/Workspace.vue').includes("onDropToCategory(e, '')"));
check('R29-4 分类落点高亮（与分类拖拽指示区分）', () => read('/newtab/views/Workspace.vue').includes('.cat-item.card-drop'));
check('R29-5 信纸明显留白（应用内+分享版同步）', () => read('/newtab/views/GlobalSettings.vue').includes('line-height: 2.75') && read('/newtab/letter-data.ts').includes('line-height: 2.8'));
check('R29-6 分类/标签名 URL 编码归一化（loadData 治本+导入容错）', () => read('/shared/storage/repository.ts').includes('safeDecodeText') && read('/shared/utils/index.ts').includes('export function safeDecodeText') && read('/newtab/views/Workspace.vue').includes('safeDecodeText(h3.textContent'));
check('R29-7 「升为一级」落点先取引用再清理（修拖拽状态自吞）', () => read('/newtab/views/Workspace.vue').includes('先取引用再清理状态'));

console.log('【第卅轮 · 信件模块化/书签导入分类树 · V2.10.0】');
check('R30-1 信件节头+停顿+信念行（应用内样式）', () => read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-h') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-turn') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-creed'));
check('R30-2 信件 HTML 模块化结构（两处渲染共享）', () => read('/newtab/letter-data.ts').includes('<p class="lp-h">') && read('/newtab/letter-data.ts').includes('<p class="lp-turn">') && read('/newtab/letter-data.ts').includes('<p class="lp-creed">'));
check('R30-3 分享版分节样式同构', () => read('/newtab/letter-data.ts').includes('.lp-body p.lp-h'));
check('R30-4 书签文件夹→分类树（前 2 级建分类，同名同级复用）', () => read('/newtab/views/Workspace.vue').includes('ensureBookmarkCategory') && read('/newtab/views/Workspace.vue').includes('BK_ROOT_NAMES') && read('/newtab/views/Workspace.vue').includes('cat.parentId = parentId'));
check('R30-5 第 3 级+并入标签（分类层级不重复打标签）', () => read('/newtab/views/Workspace.vue').includes('segs.slice(2)') && !read('/newtab/views/Workspace.vue').includes("b.path.filter(p => p && p !== '书签栏')"));

console.log('【第卅一轮 · 下钻抽屉重构/Esc修复/发版 · V2.11.0】');
check('R31-1 Drawer 组件 Esc 关闭（open 期间 document 级捕获）', () => read('/shared/components/Drawer.vue').includes("watch(() => props.open") && read('/shared/components/Drawer.vue').includes("document.addEventListener('keydown', onKey, true)"));
check('R31-2 模块分组下钻=模块卡点击弹窗（不可编辑）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('openWsPopup') && read('/newtab/components/compass/NorthStarPanel.vue').includes('nd-ws-card') && !read('/newtab/components/compass/NorthStarPanel.vue').includes('renameCat'));
check('R31-3 链接卡片明细=全量+搜索框+按模块分组', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('nd-search') && read('/newtab/components/compass/NorthStarPanel.vue').includes('groupedLinkCards') && read('/newtab/components/compass/NorthStarPanel.vue').includes('allLinkCards'));
check('R31-4 卡片行单击详情/双击打开（260ms 判定）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('onCardRowClick') && read('/newtab/components/compass/NorthStarPanel.vue').includes('onCardRowDblClick') && read('/newtab/components/compass/NorthStarPanel.vue').includes('resClickTimer'));
check('R31-5 新建任务自动聚焦标题并全选', () => read('/newtab/views/CompassActions.vue').includes("document.querySelector('.ts-title')") && read('/newtab/views/CompassActions.vue').includes('el.select()'));

console.log('【第卅二轮 · 十四需求包 · REQ-001~014】');
check('R32-1 REQ-001 战略目标层投射已移除（函数与字段三清）', () => !read('/newtab/views/CompassTree.vue').includes('toggleGoalProjection') && !read('/newtab/views/CompassTree.vue').includes('dir.pinnedToLighthouse') && !read('/shared/models/index.ts').split('interface Direction')[1].split('interface ')[0].includes('pinnedToLighthouse'));
check('R32-1b REQ-001 愿景/使命/项目投射保留（用户拍板）', () => read('/newtab/views/CompassTree.vue').includes('toggleVisionProjection') && read('/newtab/views/CompassTree.vue').includes('toggleMissionProjection') && read('/newtab/views/CompassTree.vue').includes('toggleProjProjection'));
check('R32-1c REQ-001 DHI 口径=已投射项目', () => read('/newtab/stores/compass.ts').includes('pinnedProjects') && read('/newtab/stores/compass.ts').includes('已投射至灯塔的项目'));
check('R32-2 REQ-003 方向树项目卡打开项目全景抽屉', () => read('/newtab/views/CompassTree.vue').includes('openProjectDrawer') && read('/newtab/views/CompassTree.vue').includes('ProjectDetailDrawer'));
check('R32-3 REQ-004 资源详情抽屉所属工作台字段+迁移反馈', () => read('/newtab/components/ResourceEditForm.vue').includes('wsOptions') && read('/newtab/components/ResourceEditForm.vue').includes('model.workspaceId') && read('/newtab/views/Workspace.vue').includes('已保存并迁移至'));
check('R32-4 REQ-005 分类随工作台联动重置', () => read('/newtab/components/ResourceEditForm.vue').includes('catOptions') && read('/newtab/components/ResourceEditForm.vue').includes("model.categoryId = ''"));
check('R32-5 REQ-006 CSV 导出含更新时间列（第卌一轮 REQ-055 起改动态列：更新时间以固定管理尾列导出）', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes("{ label: '更新时间', get: r => (r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '') }"); });
check('R32-5b REQ-006 三卡详情面板时间戳可见', () => read('/newtab/components/ResourceEditForm.vue').includes('fmtTs') && read('/newtab/views/CompassActions.vue').includes('fmtTaskTs') && read('/newtab/components/compass/CuriosityPanel.vue').includes('更新于'));
check('R32-6 REQ-007 排序偏好记忆（res/task/curio 三键）', () => read('/newtab/views/Workspace.vue').includes('sortPrefs?.res?.by') && read('/newtab/views/CompassActions.vue').includes('sortPrefs?.task?.by') && read('/newtab/components/compass/CuriosityPanel.vue').includes('sortPrefs?.curio?.dir'));
check('R32-6b REQ-007+bug 任务排序下拉此前未生效，已补排序逻辑', () => read('/newtab/views/CompassActions.vue').includes("if (sortBy.value !== 'manual')") && read('/newtab/views/CompassActions.vue').includes("sortDir.value === 'asc' ? 1 : -1"));
check('R32-7 REQ-008 应用内搜索命中工作台实体', () => read('/newtab/components/GlobalPopups.vue').includes("type: 'ws'") && read('/newtab/components/GlobalPopups.vue').includes('工作台条目'));
check('R32-7b REQ-008 网页浮层搜索命中工作台实体', () => read('/content/search-overlay.ts').includes("type: 'ws'") && read('/content/search-overlay.ts').includes('工作台实体'));
check('R32-8 REQ-009 搜索打开规则：有链接直开/无链接定位工作台+高亮（双端）', () => read('/newtab/components/GlobalPopups.vue').includes('已定位到卡片所在工作台') && read('/content/search-overlay.ts').includes('已定位到卡片所在工作台') && read('/content/search-overlay.ts').includes('?hl='));
check('R32-9 REQ-009 修复：文件类型卡片单击只弹 toast 不打开（旧 bug）', () => !read('/newtab/components/GlobalPopups.vue').includes('打开本地文件：${r.link}'));
check('R32-10 REQ-010 打开通道统一下沉 shared/utils/link（三处调用方迁移）', () => exists('/shared/utils/link.ts') && read('/newtab/views/Workspace.vue').includes("from '@/shared/utils/link'") && read('/newtab/components/compass/NorthStarPanel.vue').includes("from '@/shared/utils/link'") && read('/newtab/views/CompassTree.vue').includes("from '@/shared/utils/link'"));
check('R32-11 REQ-012 关联卡片 chips 双击打开链接（含 WRR 计数口径统一）', () => read('/newtab/views/CompassTree.vue').includes("openChipLink('res', rid)") && read('/newtab/views/CompassTree.vue').includes("openChipLink('curio', cid)") && read('/newtab/views/CompassTree.vue').includes('recordResourceOpen(d.value, r)'));
check('R32-12 REQ-013/014 模块分组下钻二级=分类+数量，三级=分类卡列表+返回', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('wsPopupLevel') && read('/newtab/components/compass/NorthStarPanel.vue').includes('wsPopupCats') && read('/newtab/components/compass/NorthStarPanel.vue').includes('backToCats') && read('/newtab/components/compass/NorthStarPanel.vue').includes('nw-back'));
check('R32-13 recordResourceOpen 下沉 shared/storage/stats（应用端统一引用）', () => exists('/shared/storage/stats.ts') && read('/newtab/views/Workspace.vue').includes("from '@/shared/storage/stats'") && read('/newtab/components/GlobalPopups.vue').includes("from '@/shared/storage/stats'"));
check('R32-14 REQ-002 项目层级＋=加指标 / 指标条目＋=加任务（职责单一，防回归）', () => read('/newtab/views/CompassTree.vue').includes('addMetric(proj.id)') && read('/newtab/views/CompassTree.vue').includes('openTaskAdd(metric.id, proj.id)'));
check('R32-15 REQ-011 关联卡片选择器（实时过滤+资源/好奇分组+计数徽标）', () => read('/newtab/views/CompassTree.vue').includes('linkPopFor') && read('/newtab/views/CompassTree.vue').includes('link-pop-search') && read('/newtab/views/CompassTree.vue').includes('link-count'));
check('R32-16 REQ-007 三视图均提供排序方向切换按钮', () => read('/newtab/views/Workspace.vue').includes('toggleSortDir') && read('/newtab/views/CompassActions.vue').includes('toggleSortDir') && read('/newtab/components/compass/CuriosityPanel.vue').includes('toggleSortDir'));
check('R32-17 REQ-008 工作台实体进入搜索类型 Tab 与分组计数（双端）', () => read('/content/search-overlay.ts').includes("key: 'ws'") && read('/content/search-overlay.ts').includes("label: '🗂 工作台'") && read('/newtab/components/GlobalPopups.vue').includes("{ type: 'ws', label: '🗂 工作台' }"));

console.log('【第卅三轮 · V2.12 需求包第一批：模型/Bug · REQ-023 + BUG-A~D】');
check('R33-2 REQ-023 星标字段 starred（CardBase 一份 + 三卡 extends，零迁移）', () => read('/shared/models/index.ts').split('export interface CardBase').length - 1 >= 1 && read('/shared/models/index.ts').split('extends CardBase').length - 1 === 3 && read('/shared/models/index.ts').includes('starred?: boolean'));
check('R33-2b REQ-023 导出 CSV 补置顶/星标两列（第卌一轮 REQ-055 资源改固定管理尾列；任务 CSV 仍含两列）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const t = read('/newtab/views/CompassActions.vue'); return g.includes("{ label: '置顶', get: r => (r.pinned ? '是' : '') }") && g.includes("{ label: '星标', get: r => (r.starred ? '是' : '') }") && t.includes("t?.pinned ? '是' : ''") && t.includes("t?.starred ? '是' : ''"); });
check('R33-3 BUG-A 好奇置顶分组错位修复（置顶卡前置 + 组内 sortOrder/时间序）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("from '@/shared/utils/marksort'"));
check('R33-4 BUG-B Ctrl+Enter 口径统一（采集浮层标题/链接去除裸 Enter 保存）', () => !read('/newtab/components/GlobalPopups.vue').includes('@keydown.enter.prevent="saveCapture"') && read('/newtab/components/GlobalPopups.vue').includes('💾 保存（Ctrl+Enter）'));
check('R33-5 BUG-C 新建子分类死代码修复（父级 hover ＋ 传 parentId，弹窗父级提示可达）', () => read('/newtab/views/Workspace.vue').includes('openCreateCat(sc.cat.id)') && read('/newtab/views/Workspace.vue').includes('title="创建子分类"'));

console.log('【第卅三轮 · V2.12 需求包第二批：标记体系 · REQ-019/020】');
check('R33-6 REQ-019 搜索结果行星标按钮替换编辑（三类型均有）', () => read('/newtab/components/GlobalPopups.vue').includes('toggleStar(item)') && !read('/newtab/components/GlobalPopups.vue').includes('title="编辑" @click.stop="editItem(item)"'));
check('R33-6b REQ-019 搜索结果排序加权（置顶>星标>命中度，双端同口径）', () => read('/newtab/components/GlobalPopups.vue').includes('markRank(b.raw as AnyCard) - markRank(a.raw as AnyCard)') && read('/content/search-overlay.ts').includes('x.raw.pinned ? 2 : x.raw.starred ? 1 : 0'));
check('R33-7 REQ-020 三视图星标入口齐备（资源/任务/好奇）', () => read('/newtab/views/Workspace.vue').includes('toggleStar(r)') && read('/newtab/views/CompassActions.vue').includes('toggleTaskStar(t)') && read('/newtab/components/compass/CuriosityPanel.vue').includes('toggleStar(c.id)'));
check('R33-7b REQ-020 置顶独立分区三视图一致（资源已改分组分区，任务已分区，好奇 markRank 分区前置）', () => read('/newtab/views/Workspace.vue').includes('resourceGroups') && read('/newtab/views/CompassActions.vue').includes('pinnedTasks') && read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)'));
check('R33-8 REQ-020 星标卡图标呈现（看板/列表/卡片角标）', () => read('/newtab/views/Workspace.vue').includes('kc-star') && read('/newtab/views/CompassActions.vue').includes('k-star') && read('/newtab/components/compass/CuriosityPanel.vue').includes('cz-star-corner'));
check('R33-9 REQ-020 双标记独立可叠加（置顶卡不因星标降级）', () => read('/shared/utils/marksort.ts').includes('if (c.pinned) return 2') && read('/shared/utils/marksort.ts').includes('if (c.starred) return 1'));

console.log('【第卅三轮 · V2.12 需求包第三批：交互补齐 · REQ-015/017/024】');
check('R33-10 REQ-015 三卡抽屉 Ctrl+Enter 保存统一（资源标题/好奇/任务 Toast）', () => read('/newtab/components/ResourceEditForm.vue').split('emit(\'save\')').length >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').includes('@keydown.ctrl.enter.prevent="saveDetail"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('detailId.value = null') && read('/newtab/views/CompassActions.vue').includes("showToast('✓ 已保存')"));
check('R33-11 REQ-017 关联卡片卡片化（lc-ico/lc-text 两行截断，非胶囊）', () => read('/newtab/views/CompassTree.vue').includes('lc-ico') && read('/newtab/views/CompassTree.vue').includes('-webkit-line-clamp: 2') && read('/newtab/views/CompassTree.vue').includes('border-radius: var(--radius-sm)'));
check('R33-12 REQ-024 文本框高度记忆（UIPrefs.taHeights + 三组件接线）', () => read('/shared/models/index.ts').includes('taHeights?: Record<string, number>') && read('/shared/utils/taHeight.ts').includes('saveUIPrefs') && read('/newtab/components/ResourceEditForm.vue').includes("useTaHeight(props.heightKey") && read('/newtab/views/Workspace.vue').includes('height-key="ws-note"') && read('/newtab/views/CompassActions.vue').includes("useTaHeight('task-note'") && read('/newtab/components/compass/CuriosityPanel.vue').includes("useTaHeight('curio-detail'"));
check('R33-12b REQ-024 默认高度加大（180px 起步 + 拖拽手柄三处）', () => read('/shared/utils/taHeight.ts').includes('def = 180') && read('/newtab/components/ResourceEditForm.vue').includes('.ref-ta-resize') && read('/newtab/views/CompassActions.vue').split('.ta-resize').length >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').split('.ta-resize').length >= 2);

console.log('【第卅三轮 · V2.12 需求包第四批：结构改造 · REQ-016/018/021/022】');
check('R33-13 REQ-016 共享任务添加抽屉（新建/关联双 Tab + Ctrl+Enter）', () => read('/newtab/components/TaskAddDrawer.vue').includes("tab === 'create'") && read('/newtab/components/TaskAddDrawer.vue').includes("tab === 'link'") && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="createTask"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="linkTasks"'));
check('R33-13b REQ-016 三处入口统一接入抽屉（罗盘树/项目策展/项目抽屉）', () => read('/newtab/views/CompassTree.vue').includes('openTaskAdd(metric.id, proj.id)') && read('/newtab/views/ProjectCuration.vue').includes('openTaskAdd(m)') && read('/newtab/components/ProjectDetailDrawer.vue').includes('openTaskAdd(m.id)') && read('/newtab/views/CompassTree.vue').includes('TaskAddDrawer') && read('/newtab/views/ProjectCuration.vue').includes('TaskAddDrawer') && read('/newtab/components/ProjectDetailDrawer.vue').includes('TaskAddDrawer'));
check('R33-13c REQ-016 关联任务同步写入 metricId 与 taskIds（转移归属防多挂）', () => read('/newtab/components/TaskAddDrawer.vue').includes('t.metricId = props.metricId') && read('/newtab/components/TaskAddDrawer.vue').includes('m.taskIds.filter(id => !ids.includes(id))') && read('/newtab/components/TaskAddDrawer.vue').includes('m.taskIds.push(id)'));
check('R33-14 REQ-018 删除免二次确认（四组件删除类 confirm 移除，非删除类保留）', () => !read('/newtab/views/Workspace.vue').includes('删除后可在回收站恢复') && !read('/newtab/views/CompassActions.vue').includes('删除后可在回收站恢复') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('确定删除这条好奇心') && !read('/newtab/views/ProjectCuration.vue').includes('确定删除该任务') && read('/newtab/views/Workspace.vue').includes("danger: false"));
check('R33-14b REQ-018 回收站页面（路由 + 恢复 + 永久删除 + 分区清空）', () => read('/newtab/router.ts').includes("'/recycle'") && read('/newtab/views/RecycleBin.vue').includes('restoreTask') && read('/newtab/views/RecycleBin.vue').includes('purgeTask') && read('/newtab/views/RecycleBin.vue').includes('purgeAll'));
check('R33-14c REQ-018 回收站入口在设置页危险操作区', () => read('/newtab/views/GlobalSettings.vue').includes("router.push('/recycle')"));
check('R33-15 REQ-021 分类同名即时校验（标红 + 阻止保存，重命名排除自身）', () => read('/newtab/views/Workspace.vue').includes('const catNameDup') && read('/newtab/views/Workspace.vue').includes('c.name === name && c.id !== m.editId') && read('/newtab/views/Workspace.vue').includes('.ws-modal-input.dup') && read('/newtab/views/Workspace.vue').includes('该工作台已存在同名分类，请更换名称'));
check('R33-15b REQ-021 存量重复分类合并工具（分组 + 资源并入 + 子分类升级）', () => read('/newtab/views/Workspace.vue').includes('async function mergeDupCats') && read('/newtab/views/Workspace.vue').includes('r.categoryId = keep.id') && read('/newtab/views/Workspace.vue').includes('k.parentId = undefined') && read('/newtab/views/Workspace.vue').includes('class="cat-merge"'));

console.log('【第卅三轮 · V2.12 需求包第五批：视图与布局 · REQ-025/026】');
check('R33-16 REQ-025 模块分组平铺（抽屉内工作台分区→分类行，点击直达卡片列表）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('nd-flat-ws') && read('/newtab/components/compass/NorthStarPanel.vue').includes('openWsPopup(grp.workspace.id, c.id)') && read('/newtab/components/compass/NorthStarPanel.vue').includes('uncatCountOf') && read('/newtab/components/compass/NorthStarPanel.vue').includes('catCount(c.id)'));
check('R33-16b REQ-025 打开即卡片列表级（openWsPopup 直达 cards，无中间模块层）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes("wsPopupLevel.value = 'cards'") && read('/newtab/components/compass/NorthStarPanel.vue').includes("activeCatId.value = catId ?? null"));
check('R33-17 REQ-026 tokens spacing 令牌（卡片网格一处切换全局生效）', () => read('/shared/styles/tokens.css').includes('--card-pad-vert') && read('/shared/styles/tokens.css').includes('--card-gap') && read('/shared/styles/tokens.css').includes('--card-min-w') && read('/shared/styles/tokens.css').includes("[data-density='compact']"));
check('R33-17b REQ-026 密度档位交互（视图控制区 select + UIPrefs 记忆 + 卡片样式引用令牌）', () => read('/newtab/views/Workspace.vue').includes('v-model="density"') && read('/newtab/views/Workspace.vue').includes("store.ui?.density || 'cozy'") && read('/newtab/views/Workspace.vue').includes('var(--card-gap)') && read('/newtab/views/Workspace.vue').includes('var(--card-min-w)') && read('/newtab/main.ts').includes("setAttribute('data-density', 'compact')") && read('/shared/models/index.ts').includes("density?: 'compact' | 'cozy'"));

console.log('【第卅四轮 · V2.13 需求包第一批：REQ-030 撤销修复 + Toast 四套收敛】');
check('R34-1 REQ-030 资源卡撤销按 id 定位当前树（单删/抽屉删/批量删）', () => read('/newtab/views/Workspace.vue').includes('d.value.resources.find(x => x.id === r.id)') && read('/newtab/views/Workspace.vue').includes('d.value.resources.find(x => x.id === editingResource.id)') && read('/newtab/views/Workspace.vue').includes('removed.forEach(r => {'));
check('R34-2 REQ-030 任务卡撤销按 id（单删 taskId + 批量删）+ 指标 taskIds 回填保留', () => read('/newtab/views/CompassActions.vue').includes('d.value.tasks.find(x => x.id === taskId)') && read('/newtab/views/CompassActions.vue').includes('removed.forEach(t => {') && read('/newtab/views/CompassActions.vue').includes('m.id === cur.metricId'));
check('R34-3 REQ-030 好奇心卡撤销按 id 定位当前树', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('d.value.curiosities.find(x => x.id === c.id)'));
check('R34-4 Toast 四套实现收敛为模块单例（toast.ts 统一 3s + App 全局唯一挂载）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 3000') && read('/newtab/App.vue').includes('<Toast />') && !read('/newtab/views/GlobalSettings.vue').includes('gs-toast') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast') && !read('/newtab/views/GlobalSettings.vue').includes('toastVisible'));
check('R34-5 各组件不再持有本地 Toast 实例（ref/showToast 残留清零）', () => !read('/newtab/views/Workspace.vue').includes('toastVisible') && !read('/newtab/views/CompassActions.vue').includes('toast.value') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('toast.value') && !read('/newtab/views/CompassTree.vue').includes('toast.value') && !read('/newtab/views/ProjectCuration.vue').includes('toast.value') && !read('/newtab/views/RecycleBin.vue').includes('toast.value') && !read('/newtab/components/TaskAddDrawer.vue').includes('toast.value'));

console.log('【第卅四轮 · V2.13 需求包第二批：REQ-027 分组分区视图 + 折叠增强】');
check('R34-6 REQ-027 卡片/列表取消全平铺改分类分区（resourceGroups 一级/子分类/未细分/待分类）', () => read('/newtab/views/Workspace.vue').includes('const resourceGroups') && read('/newtab/views/Workspace.vue').includes("title: '待分类'") && read('/newtab/views/Workspace.vue').includes("title: '未细分'"));
check('R34-7 F-027-4 分组标题折叠/展开（collapsedGroups 内存态 + v-show + 箭头切换）', () => read('/newtab/views/Workspace.vue').includes('const collapsedGroups') && read('/newtab/views/Workspace.vue').includes('toggleGroupCollapse') && read('/newtab/views/Workspace.vue').includes("v-show=\"!collapsedGroups.has(g.key)\"") && read('/newtab/views/Workspace.vue').includes("collapsedGroups.has(g.key) ? '▸' : '▾'"));
check('R34-8 REQ-028 分组视图徽标隐藏（hideGroupBadge + rc-cat.hidden 弱化分区噪音）', () => read('/newtab/views/Workspace.vue').includes('const hideGroupBadge') && read('/newtab/views/Workspace.vue').includes('{hidden: hideGroupBadge}') && read('/newtab/views/Workspace.vue').includes('.rc-cat.hidden'));
check('R34-9 REQ-027 分区标题样式与首分区标记（ws-cat-head + 折叠箭头）', () => read('/newtab/views/Workspace.vue').includes('ws-cat-head') && read('/newtab/views/Workspace.vue').includes('ws-cat-collapse') && read('/newtab/views/Workspace.vue').includes('{first: gi===0}'));

console.log('【第卅四轮 · V2.13 需求包第三批：REQ-028 分组视图联动规范】');
check('R34-10 REQ-028 F-028-1 分区内置顶排序（applyGroupSort = applySort + marksort 稳定重排）', () => read('/newtab/views/Workspace.vue').includes('function applyGroupSort') && read('/newtab/views/Workspace.vue').includes('markRank(b) - markRank(a)') && read('/newtab/views/Workspace.vue').includes("import { markRank }") && read('/newtab/views/Workspace.vue').split('applyGroupSort(').length - 1 >= 4);
check('R34-11 REQ-028 F-028-3 拖拽分区边界（跨分区改分类归属 + 轻提示；同分区局部排序）', () => read('/newtab/views/Workspace.vue').includes('function groupKeyOf') && read('/newtab/views/Workspace.vue').includes('crossGroup') && read('/newtab/views/Workspace.vue').includes('catChanged') && read('/newtab/views/Workspace.vue').includes('已移动至「'));
check('R34-12 REQ-028 F-028-2 徽标视觉降级保留点击（opacity 弱化而非 display:none）', () => read('/newtab/views/Workspace.vue').includes('.rc-cat.hidden { opacity: 0.35') && !read('/newtab/views/Workspace.vue').includes('.rc-cat.hidden { display: none'));
check('R34-13 REQ-028 F-028-4 列表视图共用分区拖拽规则（res-row @drop 绑定 onDropCard）', () => read('/newtab/views/Workspace.vue').includes('onDropCard($event,r)') && read('/newtab/views/Workspace.vue').split('onDropCard($event,r)').length - 1 >= 2);

console.log('【第卅四轮 · V2.13 需求包第四批：REQ-029 罗盘按需引导】');
check('R34-14 REQ-029 F-029-1 侧栏常驻三行文案移除（side-note 无残留）', () => !read('/newtab/views/CompassShell.vue').includes('side-note') && !read('/newtab/views/CompassShell.vue').includes('方向树给「为什么」'));
check('R34-15 REQ-029 F-029-2 首次气泡引导（localStorage 持久化 + 6s 超时 + 点击消失）', () => read('/newtab/views/CompassShell.vue').includes("zy_compass_guide_v1") && read('/newtab/views/CompassShell.vue').includes('setTimeout(dismissGuide, 6000)') && read('/newtab/views/CompassShell.vue').includes('localStorage.setItem(GUIDE_KEY') && read('/newtab/views/CompassShell.vue').includes('guide-glow') && read('/newtab/views/CompassShell.vue').includes('guide-bubble'));
check('R34-16 REQ-029 F-029-3 hover tooltip 固定文案（三入口 data-tip 一句话定位）', () => read('/newtab/views/CompassShell.vue').includes("tipActions = '今日行动 · 回答「做什么」'") && read('/newtab/views/CompassShell.vue').includes("tipProjects = '项目策展 · 回答「是什么」'") && read('/newtab/views/CompassShell.vue').includes("tipTree = '方向树 · 回答「为什么」'") && read('/newtab/views/CompassShell.vue').includes('content: attr(data-tip)'));

console.log('【第卅四轮 · V2.13 需求包第五批：REQ-031 系统性能调优】');
check('R34-17 REQ-031 P-031-1 搜索关联 Map 化（buildSearchMaps 一次遍历 + collectResults O(1) 查找 + 卡数累加）', () => read('/content/search-overlay.ts').includes('function buildSearchMaps') && read('/content/search-overlay.ts').includes('maps.wsName.get(r.workspaceId)') && read('/content/search-overlay.ts').includes('maps.projName.get(t.projectId)') && read('/content/search-overlay.ts').includes('maps.wsCount.get(w.id)'));
check('R34-18 REQ-031 P-031-2 结果分组一次遍历归桶（buckets 数组替代 filter+indexOf 嵌套）', () => read('/content/search-overlay.ts').includes("const buckets: Record<string, any[]>") && read('/content/search-overlay.ts').includes('buckets[r.type]') && read('/content/search-overlay.ts').includes('shown.forEach(function (item: any, j: number)') && read('/content/search-overlay.ts').includes('const i = offset + j'));
check('R34-19 REQ-031 P-031-3 计数缓存 + Tab DOM 按需重建（countCache 仅数据变更失效，searchType 不变只更计数）', () => read('/content/search-overlay.ts').includes('function invalidateCountCache') && read('/content/search-overlay.ts').includes('function computeCounts') && read('/content/search-overlay.ts').includes("tabs.getAttribute('data-search-type')") && read('/content/search-overlay.ts').includes('invalidateCountCache()'));
check('R34-20 REQ-031 P-031-4 escapeHtml 正则化（createElement → 正则白名单替换）', () => read('/content/search-overlay.ts').includes("String(s ?? '')\n    .replace(/&/g, '&amp;')") && !read('/content/search-overlay.ts').includes("const div = document.createElement('div')\n  div.textContent = s"));
check('R34-21 REQ-031 P-031-5 应用内搜索 150ms 防抖（debouncedQuery 驱动过滤，输入框即时回显）', () => read('/newtab/views/Workspace.vue').includes('const debouncedQuery = ref') && read('/newtab/views/Workspace.vue').includes('searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)') && read('/newtab/views/Workspace.vue').includes('if (debouncedQuery.value.trim())'));
check('R34-22 REQ-031 P-031-6 onChanged 自身写入跳过（repository selfWriteAt + app isSelfWrite 短路全树替换）', () => read('/shared/storage/repository.ts').includes('selfWriteAt = Date.now()') && read('/shared/storage/repository.ts').includes('export function isSelfWrite') && read('/newtab/stores/app.ts').includes('isSelfWrite(Date.now())'));
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
check('R35-7 REQ-032 父分类下未细分区块强制置前（direct 分区在子分类循环之前插入）', () => { const src = read('/newtab/views/Workspace.vue'); return src.includes('REQ-032：直属未细分资源强制排在最上方第一区块') && src.indexOf("key: 'direct', title: '未细分'") < src.indexOf('for (const sub of childCatsOf(activeCategory.value))'); });

console.log('【第卅五轮 · V2.14 需求包第四批：REQ-036 任务状态筛选器】');
check('R35-8 REQ-036 模型 sortPrefs 扩展 filter 字段（状态筛选偏好持久化载体）', () => read('/shared/models/index.ts').includes("dir?: 'asc' | 'desc'; filter?: string"));
check('R35-9 REQ-036 状态筛选四枚举（全部/待办/推进中/已完成，移除高优先级与 today 混入）', () => read('/newtab/views/CompassActions.vue').includes('type TaskFilter') && read('/newtab/views/CompassActions.vue').includes('if (filterBy.value !== \'all\') tasks = tasks.filter(t => t.status === filterBy.value)') && !read('/newtab/views/CompassActions.vue').includes("filterBy.value === 'high'") && !read('/newtab/views/CompassActions.vue').includes('option value="high"') && read('/newtab/views/CompassActions.vue').includes('<option value="todo">待办</option>'));
check('R35-10 REQ-036 筛选偏好持久化（初始化读取 savedFilter + watch 写入 sortPrefs.task.filter）', () => read('/newtab/views/CompassActions.vue').includes('const savedFilter = store.ui?.sortPrefs?.task?.filter') && read('/newtab/views/CompassActions.vue').includes('filter: filterBy.value'));

console.log('【第卅五轮 · V2.14 需求包第五批：REQ-033 北极星视觉重构】');
check('R35-11 REQ-033 底部冗余状态条彻底移除（ns-summary/summaryText 无残留）', () => !read('/newtab/components/compass/NorthStarPanel.vue').includes('ns-summary') && !read('/newtab/components/compass/NorthStarPanel.vue').includes('summaryText'));
check('R35-12 REQ-033 2×3 指标网格撑满对齐（grid-auto-rows:1fr + flex:1 + 卡片居中留白）', () => read('/newtab/components/compass/NorthStarPanel.vue').includes('grid-auto-rows: 1fr') && read('/newtab/components/compass/NorthStarPanel.vue').includes('justify-content: center'));

console.log('【第卅五轮 · V2.14 需求包第六批：REQ-037 浏览器快捷键新增「打开全局设置」命令】');
check('R35-13 REQ-037 manifest 新增 open-settings 命令（仅 description，不配 suggested_key 不占 4 键上限）', () => { const src = read('/manifest.ts'); return src.includes("'open-settings': {") && src.includes("description: '打开全局设置'") && !src.includes("'open-settings': {\n      suggested_key"); });
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
check('R36-11 REQ-039-③ CompassActions 接 kind=task 抽屉总线', () => { const src = read('/newtab/views/CompassActions.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'task')"); });
check('R36-12 REQ-039-③ CuriosityPanel 接 kind=curio 抽屉总线', () => { const src = read('/newtab/components/compass/CuriosityPanel.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'curio')"); });
check('R36-13 REQ-039-③ CompassTree 接 kind=project 抽屉总线', () => { const src = read('/newtab/views/CompassTree.vue'); return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'project')"); });
check('R36-14 REQ-039-① App.vue zy-route 监听扩展 drawer 参数', () => { const src = read('/newtab/App.vue'); return src.includes("msg?.type === 'zy-route'") && src.includes('emitOpenDrawer(msg.drawer)') && src.includes('msg.drawer'); });
check("R36-15 REQ-039-④ content script 单击/双击分离（openSearchLocator + 双击走原 openSearchResult）", () => { const src = read('/content/search-overlay.ts'); return src.includes('function openSearchLocator') && src.includes("addEventListener('dblclick'") && src.includes('title = '); });
check('R36-16 REQ-039-⑤ GlobalPopups 单击开链接 + Ctrl+Enter 定位抽屉（R38 固化后）', () => { const src = read('/newtab/components/GlobalPopups.vue'); return src.includes('runFlatLocator') && src.includes('@click="selectResult(grp.offset+j, true)"') && src.includes("@dblclick=\"selectResult(grp.offset+j, true)\""); });
check('R36-17 REQ-039 Enter 键走开链接（Ctrl+Enter 走定位+抽屉，R38 固化后）', () => { const src = read('/newtab/components/GlobalPopups.vue'); return src.includes("if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)") && src.includes('else runFlat(selIndex.value)'); });

console.log('【第卅六轮 · V2.14.1 第三批：REQ-041 产品文案与对外呈现】');
check("R36-18 REQ-041-① README.md（GitHub 根）不再含 V3.1 演进对照", () => { const src = read('/../../README.md'); return !src.includes('V3.1') && !src.includes('演进对照') && !src.includes('回归 218/218') && !src.includes('V2.13.0'); });
check("R36-19 REQ-041-② v2/README.md 含产品定位与对位叙事（按 April Dunford 视角落地）", () => { const src = read('/../README.md'); return src.includes('个人资源调度台与认知增强系统') || src.includes('April Dunford'); });
check('R36-20 REQ-041-③ ManualPage 头部版本 V2.18.1', () => { const src = read('/newtab/views/ManualPage.vue'); return src.includes('V2.18.1'); });
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
check('R37-5 REQ-043 导航 Tab：首页→知源罗盘、知源罗盘→知源引擎', () => { const s = read('/newtab/App.vue'); return s.includes('>知源罗盘') && s.includes('知源引擎<span'); });
check('R37-6 REQ-043 路由 meta：home=知源罗盘、compass 三子页=知源引擎', () => { const s = read('/newtab/router.ts'); return s.includes("title: '知源工作台 · 知源罗盘'") && s.includes("title: '知源引擎 · 今日行动'") && s.includes("title: '知源引擎 · 项目策展'") && s.includes("title: '知源引擎 · 方向树'"); });
check('R37-7 REQ-043 好奇心卡归属名保持「知源罗盘」（首页即知源罗盘，归属自洽）', () => { const s1 = read('/content/search-overlay.ts'); const s2 = read('/newtab/components/GlobalPopups.vue'); return s1.includes("ws: '知源罗盘'") && s2.includes("ws: '知源罗盘'"); });
check('R37-8 REQ-043 使用手册命名统一（含知源引擎与知源罗盘新章节标题，无旧「首页：30 秒」）', () => { const s = read('/newtab/manual-data.ts'); return s.includes('知源引擎') && s.includes('知源罗盘：30 秒方向确认仪式') && !s.includes('首页：30 秒方向确认仪式') && !s.includes('🏠 首页（看方向'); });
console.log('【第卅七轮 · V2.14.2 第三批：REQ-044 定位文案深化 + 竞品对比】');
check('R37-9 REQ-044 新定位「个人资源调度台与认知增强系统」三处统一（README/v2/手册）', () => { const r1 = read('/../../README.md'); const r2 = read('/../README.md'); const m = read('/newtab/manual-data.ts'); return r1.includes('个人资源调度台与认知增强系统') && r2.includes('个人资源调度台与认知增强系统') && m.includes('个人资源调度台与认知增强系统'); });
check('R37-10 REQ-044 手册新增「它与同类相比 · 独特价值」节（quick-3）', () => { const s = read('/newtab/manual-data.ts'); return s.includes("id: 'quick-3'") && s.includes('直接竞品') && s.includes('间接竞品'); });
check('R37-11 REQ-044 根 README 竞品对比增强（直接竞品/间接竞品两表）', () => { const s = read('/../../README.md'); return s.includes('### 直接竞品') && s.includes('### 间接竞品') && s.includes('Notion') && s.includes('Flomo'); });
check('R37-12 REQ-044 旧浅表述「17 个 AI 工具入口」已从 README 移除', () => { const r1 = read('/../../README.md'); const r2 = read('/../README.md'); return !r1.includes('17 个 AI 工具入口') && !r2.includes('17 个 AI 工具入口'); });

// ============== 第卅八轮 · V2.14.3 搜索交互固化 + 响应速度优化（REQ-045 ~ REQ-046） ==============
console.log('【第卅八轮 · V2.14.3 第一批：REQ-045 搜索交互固化（单击/Enter 开链接，Ctrl+Enter 定位+抽屉）】');
check('R38-1 REQ-045 background zy-open-route 支持 drawer 透传（修复单击落空根因）', () => { const s = read('/background/index.ts'); return s.includes('const drawer') && s.includes('...(drawer ? { drawer } : {})'); });
check('R38-2 REQ-045 content 单击 = 开链接（bindResultEvents click → openSearchResult）', () => { const s = read('/content/search-overlay.ts'); const m = s.match(/addEventListener\('click', \(\) => \{([\s\S]*?)openSearchResult/); return !!m; });
check('R38-3 REQ-045 content Enter=开链接 / Ctrl+Enter=定位+抽屉', () => { const s = read('/content/search-overlay.ts'); return s.includes("if (e.ctrlKey || e.metaKey)") && s.includes('openSearchLocator(searchResults[searchSelIndex])') && s.includes('openSearchResult(searchResults[searchSelIndex])'); });
check('R38-4 REQ-045 content 定位消息走 zy-open-route（不再用无分支的 zy-route）', () => { const s = read('/content/search-overlay.ts'); return s.includes("type: 'zy-open-route', route, drawer") && !s.includes("type: 'zy-route', route, drawer"); });
check('R38-5 REQ-045 GlobalPopups 单击 = 开链接（selectResult 而非 selectResultLocator）', () => { const s = read('/newtab/components/GlobalPopups.vue'); return s.includes('@click="selectResult(grp.offset+j, true)"') && !s.includes('selectResultLocator'); });
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
check('R39-4 REQ-048 共享组件 AssetManager 单文件上限 + 限定图片/HTML（第卌二轮升级：图片 10MB 独立上限 kind 分支）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('maxSizeMB: 20') && s.includes('accept="image/*,.html,.htm"') && s.includes("const limitMB = kind === 'image' ? IMG_MAX_MB : props.maxSizeMB") && s.includes('f.size > limitMB * 1024 * 1024'); });
check('R39-5 REQ-048 AssetManager 上传即写 IndexedDB（putAsset + uid）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('putAsset(') && s.includes("uid('at')") && s.includes('emitList'); });
check('R39-6 REQ-048 AssetManager 打开：图片全屏弹窗预览（第卌二轮多图切换）/ HTML 走 openHtmlAsset（file:// 完整打开，REQ-058）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('URL.createObjectURL') && s.includes("meta.kind === 'image'") && s.includes('viewerOpen.value = true') && s.includes('await openHtmlAsset(meta)') && s.includes("import { openHtmlAsset }"); });
check('R39-7 REQ-048 AssetManager 删除联动 deleteAsset（软删保留、硬删由回收站清）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('async function removeAsset') && s.includes('deleteAsset(meta.id)'); });
check('R39-8 REQ-048 资源卡双入口接入：搜索抽屉 + 工作台内联抽屉', () => { const shared = read('/newtab/components/ResourceEditForm.vue'); const d1 = read('/newtab/components/ResourceDetailDrawer.vue'); const d2 = read('/newtab/views/Workspace.vue'); return shared.includes('AssetManager') && shared.includes('function onAssetsChange') && d1.includes('ResourceEditForm') && d1.includes('height-key') && d2.includes('ResourceEditForm') && d2.includes('height-key="ws-note"'); });
check('R39-9 REQ-048 任务卡接入（任务侧边栏）', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('AssetManager') && s.includes('function onTaskAssetsChange') && s.includes('selectedTask.assets'); });
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
check('R40-7 REQ-051 AssetBadge 三视图接入（资源 Workspace/任务 CompassActions/好奇 CuriosityPanel）', () => { const w = read('/newtab/views/Workspace.vue'); const t = read('/newtab/views/CompassActions.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue'); return w.includes("import AssetBadge") && w.includes('rc-assets') && w.includes('rr-assets') && w.includes('kc-card-assets') && t.includes("import AssetBadge") && t.includes('taskAssetsOn') && t.includes('kc-assets') && c.includes("import AssetBadge") && c.includes('curioExtFields'); });
check('R40-8 REQ-051 好奇面板按 fieldConfig.curiosity 消费（visibleFields + 附件/tags/custom 字段流）', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('visibleFields(d.value.fieldConfig, \'curiosity\')') && s.includes("f.key === 'assets' || f.key === 'tags' || f.key.startsWith('custom_')") && s.includes('cz-ext-lbl'); });
check('R40-9 REQ-049 附件兜底：defaults 三型 assets def + repository 老数据迁移', () => { const def = read('/shared/storage/defaults.ts'); const rep = read('/shared/storage/repository.ts'); return (def.split("key: 'assets'").length - 1) === 3 && rep.includes('REQ-049：老数据字段配置补 assets'); });
console.log('【第卌轮 · V2.16.0 第四批：REQ-052 死代码清理 + 版本门禁】');
check('R40-10 REQ-052 fieldViewCfg 死代码全库零引用', () => { return !fs.existsSync(base + '/shared/models/index.ts') ? false : !read('/shared/models/index.ts').includes('fieldViewCfg') && !read('/shared/storage/repository.ts').includes('fieldViewCfg'); });
check('R40-11 版本 2.18.1 五处同步（manifest/package/关于页动态/ManualPage/regression）', () => { const m = read('/manifest.ts'); const pkg = fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'); const gs = read('/newtab/views/GlobalSettings.vue'); const mp = read('/newtab/views/ManualPage.vue'); return m.includes("version: '2.18.1'") && pkg.includes('"version": "2.18.1"') && gs.includes('runtimeVersion') && mp.includes('V2.18.1'); });

// ============== 第卌一轮 · V2.17.0 附件详情呈现修复 + 技术债收敛（REQ-054~REQ-057，V2.16.0 交付后用户反馈驱动） ==============
console.log('【第卌一轮 · V2.17.0 第一批：REQ-054 附件详情端到端呈现修复（详情面板徽章补齐：标题旁 + section 头）】');
check('R41-1 REQ-054 Drawer 具名插槽 #title-extra（详情标题区挂附件徽章）', () => { const s = read('/shared/components/Drawer.vue'); return s.includes('name="title-extra"') && s.includes('.drawer-title-extra'); });
check('R41-2 REQ-054 好奇心详情抽屉双徽章：标题旁(#title-extra) + 附件 section 头(.detail-sec-head)', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('#title-extra') && s.includes('.detail-sec-head') && s.includes('<AssetBadge v-if="detailItem?.assets?.length"'); });
check('R41-3 REQ-054 任务详情侧栏双徽章：ts-head 标题旁(.ts-title-assets) + section 头(.ts-label-row)', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('ts-title-assets') && s.includes('ts-label-row') && s.includes('class="ts-label ts-label-row"'); });
check('R41-3b REQ-054 资源编辑表单双徽章：标题旁(.ref-title-assets) + section 头(.ref-label-row)', () => { const s = read('/newtab/components/ResourceEditForm.vue'); return s.includes('ref-title-assets') && s.includes('ref-label-row') && s.includes("import AssetBadge"); });
console.log('【第卌一轮 · V2.17.0 第二批：REQ-055 资源卡 CSV 动态列对齐字段目录】');
check('R41-4 REQ-055 CSV 动态列：allFields(fieldConfig) 目录驱动 + resCsvValue 取值 + 系统字段全导/自定义按可见性 + 列名取 label', () => { const s = read('/newtab/views/GlobalSettings.vue'); return s.includes('function resCsvValue') && s.includes("allFields(d.fieldConfig, 'resource')") && s.includes("!f.key.startsWith('custom_') || f.visible") && s.includes("const headers = cols.map(c => c.label)"); });
check('R41-4b REQ-055 UI 文案同步动态列说明（旧硬编码 8 字段描述串已清除）', () => !read('/newtab/views/GlobalSettings.vue').includes('字段：标题/链接/链接类型/标签/分类/描述/创建时间/更新时间'));
console.log('【第卌一轮 · V2.17.0 第三批：REQ-056 AssetPreview 公共 viewer 抽取（AssetManager/AssetBadge 双份合一）】');
check('R41-5 REQ-056 公共组件 AssetPreview 存在（Teleport + Esc/←→ 键捕获 + img 渲染 + close/prev/next emits，第卌二轮升级多图导航）', () => { const s = read('/shared/components/AssetPreview.vue'); return s.includes('<Teleport to="body">') && s.includes("e.key === 'Escape' && props.open") && s.includes("e.key === 'ArrowLeft'") && s.includes('class="ap-viewer-img"') && s.includes("(e: 'close')") && s.includes("(e: 'prev')") && s.includes("(e: 'next')"); });
check('R41-6 REQ-056 AssetManager 改引公共组件（不再内嵌 .am-viewer viewer）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes("import AssetPreview from './AssetPreview.vue'") && s.includes('<AssetPreview :open="viewerOpen"') && !s.includes('.am-viewer'); });
check('R41-7 REQ-056 AssetBadge 改引公共组件（不再内嵌 .ab-viewer viewer）', () => { const s = read('/shared/components/AssetBadge.vue'); return s.includes("import AssetPreview from './AssetPreview.vue'") && s.includes('<AssetPreview :open="viewerOpen"') && !s.includes('.ab-viewer'); });
check('R41-7b REQ-056 双份 viewer 样式全库收敛（am-viewer/ab-viewer 在宿主零残留）', () => { let n = 0; ['/shared/components/AssetManager.vue','/shared/components/AssetBadge.vue','/newtab/components/compass/CuriosityPanel.vue','/newtab/views/CompassActions.vue','/newtab/components/ResourceEditForm.vue'].forEach(f => { if (read(f).includes('.am-viewer') || read(f).includes('.ab-viewer')) n++; }); return n === 0; });
console.log('【第卌一轮 · V2.17.0 第四批：REQ-057 业务静默 catch 收敛（仅用户主动操作失败补提示）】');
check('R41-8 REQ-057 AssetManager.removeAsset 本体删除失败补 toast（不再静默吞错）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('await deleteAsset(meta.id)') && s.includes("console.error('[assets] deleteAsset failed:', err)") && s.includes('附件本体删除失败，可到「设置 · 数据管理」清理孤儿'); });
check('R41-8b REQ-057 RecycleBin.purgeAssetsOf 硬删附件失败累计计数提示', () => { const rb = read('/newtab/views/RecycleBin.vue'); return rb.includes('let failed = 0') && rb.includes('failed++') && rb.includes('个附件本体删除失败'); });
// V2.17.1 热修：onFilesChange 必须先 Array.from 快照 FileList 再清空 input.value（设置 value='' 会重置 FileList，旧代码先存引用后清空导致真实上传链路 100% 静默失败）
check('R41-9 V2.17.1 onFilesChange 先快照 FileList 再清空 input.value（真实上传链路时序红线）', () => { const s = read('/shared/components/AssetManager.vue'); const snap = s.indexOf('Array.from(input.files || [])'); const clear = s.indexOf("input.value = ''"); return snap >= 0 && clear >= 0 && snap < clear && s.includes('const files = Array.from(input.files || [])'); });
// V2.17.1 热修②：persist 必须 JSON 纯净清洗——reactive 树中残留的 Vue Proxy（编辑表单展开的 assets 等）会被 chrome.storage 序列化为类数组对象 {"0":…}，读回 .length undefined → 卡片正面附件徽章永不渲染
check('R41-10 V2.17.1 saveData/saveDataNow 入存储前 JSON.parse(JSON.stringify(cache)) 纯净清洗', () => { const s = read('/shared/storage/repository.ts'); return (s.match(/JSON\.parse\(JSON\.stringify\(cache\)\)/g) || []).length >= 2; });

// ============== 第卌二轮 · V2.18.0：REQ-058 file:// 完整打开 + REQ-059 附件包闭环 + REQ-060 性能专项 + REQ-061 附件上传规范 ==============
console.log('【第卌二轮 · V2.18.0 第一批：REQ-061 卡片附件上传规范（9 图/10MB/HTML 唯一/标题与 linkType 联动）】');
check('R42-1 REQ-061 AssetManager 单卡图片 ≤9 张（IMG_MAX_COUNT=9 + 超额 toast）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('const IMG_MAX_COUNT = 9') && s.includes('图片数量已达上限 ${IMG_MAX_COUNT} 张'); });
check('R42-2 REQ-061 图片单张 ≤10MB（IMG_MAX_MB=10 独立于 HTML 上限，kind 分支区分）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('const IMG_MAX_MB = 10') && s.includes("const limitMB = kind === 'image' ? IMG_MAX_MB : props.maxSizeMB"); });
check('R42-3 REQ-061 HTML 单卡唯一：重复上传=替换（replacedOld 记录 + 旧本体删除 + 列表移除）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes('replacedOld') && s.includes('hadOldHtml') && s.includes('已替换原 HTML 附件'); });
check('R42-3b REQ-061 AssetManager emit html-added（带 replacedOld 参数供宿主判断标题覆盖）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes("emit('html-added', m, replacedOld)"); });
check('R42-4 REQ-061 AssetPreview 多图左右切换（‹› 箭头 + ←/→ 键 + prev/next emit + posLabel 计数）', () => { const s = read('/shared/components/AssetPreview.vue'); return s.includes('ap-viewer-prev') && s.includes('ap-viewer-next') && s.includes("e.key === 'ArrowLeft'") && s.includes("e.key === 'ArrowRight'") && s.includes("(e: 'prev')") && s.includes('posLabel'); });
check('R42-5 REQ-061 资源编辑表单 HTML 联动：标题取文件名（仅空/旧文件名覆盖）+ linkType=file + link=zy-asset://id', () => { const s = read('/newtab/components/ResourceEditForm.vue'); return s.includes('function onHtmlAdded') && s.includes("replace(/\\.html?$/i, '')") && s.includes('props.model.linkType = \'file\'') && s.includes('props.model.link = `zy-asset://${meta.id}`'); });
check('R42-6 REQ-061 好奇卡 HTML 联动走 question 字段（CuriosityPanel onCurioHtmlAdded）', () => { const s = read('/newtab/components/compass/CuriosityPanel.vue'); return s.includes('function onCurioHtmlAdded') && s.includes('detailItem.value.question'); });
check('R42-7 REQ-061 任务卡 HTML 联动接入（CompassActions onTaskHtmlAdded + @html-added 绑定）', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('function onTaskHtmlAdded') && s.includes('@html-added="onTaskHtmlAdded"'); });
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
check('R42-17 REQ-060 附件管理 maxSizeMB 文案（上传区按钮提示单文件 ≤10MB——图片独立上限）', () => { const s = read('/shared/components/AssetManager.vue'); return s.includes("'📎 添加附件（图片 / HTML，单文件 ≤ ' + maxSizeMB + 'MB）'"); });
check('R42-18 REQ-058 manifest 含 downloads 权限（chrome.downloads.download 可用，否则 file:// 落盘链路静默降级）', () => read('/manifest.ts').includes("'downloads'"));

// ============== 第卌三轮 · V2.18.1 补丁：BUG-2 双复选框 + R-1~R-5 任务中心/北极星迭代 ==============
console.log('【第卌三轮 · V2.18.1 第一批：任务中心 Bug 修复（批量双复选框 + 卡片删除 + 总数双值）】');
check('R43-1 BUG-2 批量模式只保留勾选框：mgr-body 携带 batch class 且 CSS 隐藏 check-sm（避免双复选框）', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('class="mgr-body" :class="{batch: batchMode}"') && s.includes('.mgr-body.batch .check-sm { display: none; }'); });
check('R43-2 R-1 任务卡 hover 删除按钮：t-del 样式 + 三处任务行均绑定 deleteTask', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('class="t-del" @click.stop="deleteTask(task.id)"') && (s.match(/class="t-del" @click\.stop="deleteTask\(task\.id\)"/g) || []).length === 3 && s.includes('.t-del:hover'); });
check('R43-3 R-2 任务列表总数双值：totalTaskCount 分母 + 工具栏 mgr-count（当前 N 条 / 全部 M 可点击清除筛选）', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('const totalTaskCount = computed') && s.includes('function clearTaskFilter()') && s.includes('class="mgr-count"') && s.includes('全部 {{ totalTaskCount }}'); });
console.log('【第卌三轮 · V2.18.1 第二批：今日三件事紧凑化】');
check('R43-4 R-3 今日三件事卡片紧凑化：取消 min-height、padding 收窄（12px 14px 11px）、标题行高 1.4', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('padding: 12px 14px 11px') && !s.includes('min-height: 128px') && s.includes('line-height: 1.4; flex: 1'); });
console.log('【第卌三轮 · V2.18.1 第三批：北极星指标迭代（N/M + 周期联动）】');
check('R43-5 R-4 北极星未归档任务 N/M（未归档/任务总数，totalTasks 分母）+ 保留级联归档抽屉', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes('const totalTasks = computed') && s.includes('{{ unarchivedTasks.length }}/{{ totalTasks }}') && s.includes("nd-task-row"); });
check('R43-6 R-5 北极星 bottom 三卡（模块分组/链接卡片/未归档）标注「全量/未挂指标 · 不分期」副标', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return s.includes('全量 · 不分期') && s.includes('未挂指标 · 不分期'); });
check('R43-7 R-5 北极星 DHI「在轨」活跃窗口随周期联动（week=近14天/month=近30天/all=全部，dhiDays）', () => { const s = read('/newtab/stores/compass.ts'); return s.includes('const dhiDays = period') && s.includes('isWithinDays(t.completedAt, dhiDays)') && s.includes('已投射至灯塔的项目'); });
check('R43-8 R-5 北极星 WCE/WRR 副标随周期（pLabel 周/月/累计新增 + thisWeekUsage 本周次数 + totalCumUsage 累计口径）', () => { const s = read('/newtab/stores/compass.ts'); return s.includes("const pLabel = period") && s.includes('sub: `${pLabel}+${newInPeriod}`') && s.includes('thisWeekUsage') && s.includes('totalCumUsage'); });
console.log('【第卌三轮 · V2.18.1 第四批：BUG-1 新建任务保存不更新（reactive Proxy 引用修复）】');
check('R43-9 BUG-1 根因修复：openTaskSidebar/saveTaskTitle 均经 d.value.tasks.find 取 store Proxy 元素写入（绕 Proxy set trap 会导致 Ctrl+Enter 保存后列表不刷新）', () => { const s = read('/newtab/views/CompassActions.vue'); return s.includes('selectedTask.value = d.value.tasks.find(x => x.id === task.id) || task') && s.includes('const inStore = d.value.tasks.find(x => x.id === selectedTask.value!.id)'); });

console.log('');
console.log('回归结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
