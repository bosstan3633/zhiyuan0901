/**
 * R174-1 分片 · 10-foundations：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, srcFileEntries, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');

console.log('【红线检查】');
check('卡间零挂载红线（R165 立 · R166 收口 fromCuriosityId + 明文豁免记录型关联）：三卡模型零互持 id + 载入与导入**两条路**都剥 + 建卡字面量零携带（活性验证：临时加回字段→红→撤→绿）。R166 定案 4/5：fromCuriosityId 退役（转化即出路，溯源由 link+描述承担）；CurationProjection / SupportLink 是独立表里的**记录**，卡对象互不持有 id，不属卡间挂载', () => { const fsx = require('fs'); const path2 = require('path'); const root = path2.resolve(SCRIPTS_DIR, '..', 'src'); const hits = []; const walk = (d) => { for (const f of fsx.readdirSync(d)) { const p = path2.join(d, f); const st = fsx.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|vue)$/.test(f)) { const s = codeOnly(fsx.readFileSync(p, 'utf8')); if (/mountedCuriosityIds:\s*\[|relatedResourceIds:\s*\[|fromCuriosityId:/.test(s)) hits.push(p.replace(/\\/g, '/')); } } }; walk(root); const m = codeOnly(read('/shared/models/index.ts')); const r = read('/shared/storage/repository.ts'); const gs = read('/newtab/views/GlobalSettings.vue'); const bodies = ['ResourceCard', 'TaskCard', 'CuriosityCard'].map(k => m.split('interface ' + k)[1].split('}')[0]); return hits.length === 0 && bodies.every(b => !/mountedResourceIds|mountedCuriosityIds|relatedResourceIds|fromCuriosityId|parentId/.test(b)) && (m.match(/fromCuriosityId/g) || []).length === 0 && r.includes("export const RETIRED_CARD_KEYS = ['mountedResourceIds', 'mountedCuriosityIds', 'relatedResourceIds', 'fromCuriosityId']") && r.includes('export function stripRetiredCardKeys') && ['tasks', 'curiosities', 'resources'].every(k => r.includes('stripRetiredCardKeys(data.' + k + ')')) && ['ResourceCard', 'TaskCard', 'CuriosityCard'].every(k => gs.includes('stripRetiredCardKeys<' + k + '>(imported.')) && m.includes('export interface SupportLink') && m.includes('supportLinks?: SupportLink[]') && bodies.every(b => !/supportLinks|resourceId/.test(b)); });
check('单向挂载：Curiosity 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface CuriosityCard')[1].split('}')[0]));
check('单向挂载：Resource 无 taskId', () => !/taskId\??\s*:/.test(read('/shared/models/index.ts').split('interface ResourceCard')[1].split('}')[0]));
check('数据 100% 本地：无 http 数据上传', () => !/fetch\(|XMLHttpRequest/.test(read('/newtab/App.vue')));

console.log('【架构检查】');
check('路由：首页/方向台一级（★R3-B1 树即首屏：/compass 直挂 CompassTree、/compass/tree 转带 query 重定向、/compass/projects 平铺成一级）/工作台/设置（R49：actions 子页退役）', () => { const r = read('/newtab/router.ts'); return r.includes("name: 'compass'") && r.includes("import('./views/CompassTree.vue')") && count('/newtab/router.ts', "path: '/compass/projects'") === 1 && count('/newtab/router.ts', "path: '/compass/tree'") === 1 && count('/newtab/router.ts', "path: 'actions'") === 0 && r.includes("redirect: to => ({ path: '/compass', query: to.query })"); });
check('旧任务中心路由已退役', () => !read('/newtab/router.ts').includes("'/tasks'"));
check('此刻最重要已整体移除', () => !exists('/newtab/components/compass/FocusPanel.vue'));
check('R49 方向台容器（R117 重写 → ★R3-B1 再重写：树即一级）：router 把 /compass 直挂 CompassTree，方向台不再嵌项目详情/任务调度/MetricBar', () => { const r = read('/newtab/router.ts'); const t = CT_ALL; return r.includes("path: '/compass'") && r.includes("component: () => import('./views/CompassTree.vue')") && !codeOnly(r).includes('CompassShell') && !r.includes('children:') && !t.includes('ProjectCuration') && !t.includes('TaskManagerPanel') && !t.includes('MetricBar'); });

console.log('【A组 弹窗工作流】');
check('四端 zy-locate-workspace 单例定位 ★R4-Fb 重指带备案：第四端 popup 随降级路径退役（那个独立弹窗从未进过构建，在 chrome:// 按快捷键只得到空白窗口），三端锚保留 + 加一条负锚——src 的**代码**里不许再出现 src/popup 路径（注释里讲历史不算，所以判据吃 codeOnly），否则半拉子入口会静默回流。★2026-10-12 再随迁带备案：网页端锚从 search-overlay.ts 迁到 overlay-impl.ts（content 拆两层后单例定位的实现落在重型实现层，与 R4-Fb① 的负锚豁免同批处理——changelog 那条用户可见历史叙述不算代码路径）', () => ['background/index.ts', 'content/overlay-impl.ts', 'newtab/components/GlobalPopups.vue'].every(f => count('/' + f, 'zy-locate-workspace') >= 1) && !srcFileEntries().some(e => !e.rel.endsWith('changelog-data.ts') && codeOnly(e.text).includes('src/popup')));
check('B14 网页浮层 corner 模式 display:flex', () => read('/content/search-overlay.ts').includes('.corner{display:flex'));
check('B12 应用内采集弹窗右上角', () => read('/newtab/components/GlobalPopups.vue').includes('.gp-overlay.corner { align-items: flex-start; justify-content: flex-end'));
check('B5 采集去重（应用内+网页端）', () => count('/newtab/components/GlobalPopups.vue', 'normalizeUrl') >= 1 && count('/content/search-overlay.ts', 'normalizeUrl') >= 1);
check('好奇心反馈 好奇心+1', () => read('/content/overlay-impl.ts').includes('好奇心+1') && read('/newtab/components/GlobalPopups.vue').includes('好奇心+1'));
check('B9 已保存态 Enter 监听', () => read('/content/search-overlay.ts').includes("document.addEventListener('keydown', onSavedKeydown, true)"));

console.log('【B组 修复】');
check('B1/B2（V3.9.1 重指）任务抽屉级联 + Ctrl+Enter 容器级：共享 Drawer 壳承接 Esc/宽度，任务详情仍负责项目级联与文档级保存快捷键', () => {
  const f = read('/newtab/components/compass/TaskDetailDrawer.vue');
  return f.includes('onSelProjectChange')
    && f.includes('<Drawer :open="sidebarOpen && !!selectedTask"')
    && f.includes('width="520px"')
    && f.includes('width-storage-key="task"')
    && f.includes(':close-on-escape="!aiJob"')
    && f.includes('function onSidebarDocKey(')
    && f.includes("(e.ctrlKey || e.metaKey) && e.key === 'Enter'");
});
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
check('N1 愿景/使命关联卡片入口+选择浮层', () => CT_ALL.includes('toggleLinkPop') && read('/shared/models/index.ts').includes('linkedResourceIds'));
check('N2 回收站（设置面板）', () => read('/newtab/views/GlobalSettings.vue').includes('emptyRecycleBin'));
check('N4 标签管理：树CRUD+3级限制+路径', () => read('/newtab/views/GlobalSettings.vue').includes('最多两级') && read('/shared/components/TagPicker.vue').includes('tp-pathtext'));
check('N4 标签重命名级联卡片', () => read('/newtab/views/GlobalSettings.vue').includes('级联同步所有卡片'));
check('H1 策展台快捷键映射+五修饰键', () => read('/newtab/views/GlobalSettings.vue').includes('modLabel') && read('/newtab/App.vue').includes('switchToIndex'));

console.log('【第五轮】');
check('B17 方向树目录入 tree-layout 左栏 ★W12(V3.8.12)随迁备案：.tree-page-head 密排页头被 HERO 区（.hero）取代，承重锚改钉 .hero 在 .tree-layout 之前 —— 本条守的是"页头在左栏之前、不在内容流里"这条布局关系，不是某个类名', () => CT_ALL.indexOf('<section class="hero">') < CT_ALL.indexOf('class="tree-layout"') && CT_ALL.includes('class="tree-layout"'));
check('B17 目录与策展目录样式统一(200px sticky) ★W12 随迁备案：左栏宽度由 200px 调整为 210px（对齐原型 .split 的 grid-template-columns:210px 1fr）· ★C2（V3.8.31）二次备案：方向台树区升为主角面后，左栏 210 → 176px（大板接管视觉重量，目录退为支撑层）。本条守的仍是「左栏定宽 + sticky」这两条布局纪律，宽度值随设计决策走并留痕', () => CT_ALL.includes('width: 176px; flex-shrink: 0;') && CT_ALL.includes('position: sticky'));
check('B18 字段行样式迁入子组件', () => count('/newtab/views/FieldEditor.vue', 'gs-fr-action') >= 2);
check('B22 状态三选 chips · ★R4-Ev 随迁备案：原锚 ts-status-chip 只剩一条死样式在撑着——模板早在 R167 换成 ds-status-chip2 + STATUS_UI[...].cls，而 CSS 里那份 .ts-status-chip.active 是旧实现留下的孤儿（R4-Et 删了基规则，本轮删了 .active 这条），所以这条判据一直在核一件不再存在的事。改钉现役三件：钮在位 + 状态类由 STATUS_UI 映射 + 三档 st-* 各有规则；并负锚旧类名不许回流', () => {
  const f = read('/newtab/components/compass/TaskDetailDrawer.vue');
  return f.includes('class="ds-status-chip2"') && f.includes('STATUS_UI[selectedTask.status].cls')
    && ['.st-todo', '.st-doing', '.st-done'].every(c => f.includes('.ds-status-chip2' + c))
    && !f.includes('ts-status-chip');
});
check('B23 文档级 Ctrl+Enter/Esc', () => read('/newtab/components/compass/TaskDetailDrawer.vue').includes('onSidebarDocKey'));
check('O19/R121 主航线项目行卡 ★R3-B1 退役重指带备案：行卡（proj-row/mini-bar/双击）随 LighthousePanel 整面退役，能力去向=方向树项目卡头（tp-head 名称 + tp-pct 进度 + 停滞读数在页头 + ▾ 菜单「进入项目详情页」取代双击）', () => { const t = CT_ALL; return !exists('/newtab/components/compass/LighthousePanel.vue') && t.includes('class="tw-head"') && t.includes('class="tw-ring-v"') && t.includes('📄 进入项目详情页') && t.includes('function openProjectDrawer('); });
check('O20（R126 重指）标签最多两级守卫 + 缩进兜底', () => read('/newtab/views/GlobalSettings.vue').includes('最多两级') && read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));
check('O21 分组列表跨组拖拽改归属', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onListGroupDrop'));
check('Bug1 目标卡按钮/箭头不重叠 · ★R4-Et 随迁备案：原锚 margin-right: 52px 挂在 .goal-node .expand-icon 上，而 .goal-node/.expand-icon 是主航线时代留下的死选择器（模板零引用 + 104 场景 DOM census 零命中 + 全站字符串/classList 零出现，本轮随孤儿 CSS 一并清）。当年按钮是绝对定位、要给箭头留 52px 才不叠；今天的形状是卡头走 flex（标题 flex:1 + min-width:0 可缩）、动作组作为**流内兄弟**占自己的槽——重叠在新形状里结构上不可能，判据改钉这个形状，并钉住旧的魔数预留不许回流。★W11 随迁：动作组从 display:none（hover 才占槽）改为常驻 flex。★W12(V3.8.12)再随迁：`.tw-head` 从 align-items:flex-start + gap:10px 改为 align-items:center + gap:14px，`.tw-id` 加 min-width:200px，`.tw-right` 从 gap:10 改为 gap:14 —— 起因是实际截图里舱头右侧（进度环 / 完成数 / 六个按钮）在窄栏下挤成两行。判据本轮起改钉**右区固定一块不换行**这条承重：.tw-right 必须 flex:none，且 .tw-head 的 wrap 只能在 tw-id 那一层发生，不能发生在 tw-right 内部', () => {
  const t = CT_ALL;
  return t.includes('.tw-head {')
    && /\.tw-head \{[^}]*display: flex[^}]*align-items: center[^}]*gap: 14px/.test(t)
    /* ★标题可缩是「不重叠」的结构前提：flex:1 + min-width 让长标题收缩而不是把动作组挤出卡头 */
    && /\.tw-id \{ flex: 1; min-width: 200px; \}/.test(t)
    /* ★V3.8.18（N5）随迁备案：本条原逐字钉 `.dh-acts { ... gap: 4px; ... }` 的整行字面量。
     N5 把这五枚按钮分成 t1/t2/t3 三级时把 gap 调到 5px（t3 是文字型，22px 方块之间的
     4px 贴着读作"同一个控件的碎片"），整行字面量随之失配。
     ★但这条守的不是 4px 这个数——它守的是**动作组作为一个不换行的整体占自己的槽**
     （flex 容器 + flex: none + align-items: center）。这三个承重特征一条没动，
     所以改钉这三个特征本身，不再钉 gap 的具体整数值（钉死一个间隔整数，
     下次调间距就会假红一次，而重叠与否跟它无关）。 */
  && /\.dh-acts \{[^}]*display: flex[^}]*align-items: center[^}]*flex: none/.test(t)
    /* ★右区必须 flex:none —— 舱头唯一的换行点是 .tw-head 本身（右区一旦参与换行，
       进度环/完成数/按钮组就会叠成两行，正是 W12 要修的失真） */
    && t.includes('.tw-right { display: flex; align-items: center; gap: 14px; flex: none; }')
    && t.includes('.mc-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }')
    && !t.includes('margin-right: 52px') && !t.includes('padding-right: 58px');
});
check('Bug2 标签缩进 !important 兜底', () => read('/newtab/views/GlobalSettings.vue').includes('padding-left: 58px !important'));

console.log('【第六轮】');
check('B24 关联卡片标题 chips + 详情抽屉', () => CT_ALL.includes('linked-chip') && CT_ALL.includes('peekData'));
check('B24 打开链接含 file:/// 转换（第卅二轮下沉至 shared/utils/link）', () => read('/shared/utils/link.ts').includes('file:///') && CT_ALL.includes('toOpenableRawLink'));
check('B25 选取弹窗置灰（已完成/已选入）', () => read('/newtab/views/CompassHome.vue').includes('pickerDisabled') && read('/newtab/views/CompassHome.vue').includes('pickedIds'));
check('B26 方向树默认全局展开', () => CT_ALL.includes('expandAllNodes'));
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
check('W2（V3.9.8 随迁）分类新建 / 改名统一收进思维导图画布：宿主不再保留第二套分类弹窗与侧栏，Tab/Enter 直建分支、就地编辑标题，无原生 prompt', () => {
  const w = read('/newtab/views/Workspace.vue');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  return w.includes('<CurationMindMap') && w.includes('@create-child="onMindCreateChild"')
    && w.includes('@create-sibling="onMindCreateSibling"')
    && m.includes("emit('create-child', 'root')") && n.includes("emit('create-child', props.node.id)")
    && n.includes("emit('create-sibling', props.node.id)") && n.includes("beginEdit('title')")
    && !w.includes('confirmCatModal') && !w.includes('catModal.open') && !w.includes('prompt(');
});
check('W3（V3.9.8 随迁）分类删除由画布空分支入口承接：有子级或有资源时拒绝并说明原因，空分支软删除；旧侧栏删除链退役', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  return h.includes('async function removeNode(id: string)')
    && h.includes('下还有 ${children.length} 个子分支')
    && h.includes('下还关联着 ${n} 张资源卡')
    && h.includes('node.deletedAt = Date.now()')
    && n.includes('删除这个空分支') && n.includes("emit('remove-node', node.id)")
    && !read('/newtab/views/Workspace.vue').includes('deleteCategory');
});
check('W4（V3.9.8 随迁）左栏树退役，递归结构改由画布节点承载：Category.parentId 树 + 子节点递归 + 每节点资源计数，旧侧栏/置顶分区/聚合计数零回流', () => {
  const w = read('/newtab/views/Workspace.vue');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  return w.includes('<CurationMindMap') && m.includes('<CurationMindNode') && n.includes('<CurationMindNode')
    && n.includes('(n.parentId || \'\') === props.node.id')
    && n.includes('cards().length')
    && h.includes('const cardsByCat = computed<Map<string, ResourceCard[]>>')
    && !host.includes('sidebarCats') && !host.includes('pinnedRootCats') && !host.includes('catAggCount');
});
// R112 重指：familyIds 现在包一层 Set 再过滤（O(卡数×家族) → O(卡数)），聚合过滤语义不变 —— 承接 R112-7
check('W5（V3.9.8 随迁）父分类聚合视图退役，资源归属以「节点直接挂卡」为唯一口径：节点只显示直属资源，全台计数走 linkedResourceCount，不再混算子分类', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  return h.includes('const key = r.categoryId || \'\'')
    && h.includes('const arr = out.get(key)')
    && h.includes('allResources.value.filter(r => !r.isThesis && !!r.categoryId')
    && n.includes('props.cardsByCat.get(props.node.id)')
    && !host.includes('familyIds(activeCategory.value)');
});
check('W6（V3.9.8 随迁）分类拖拽升级为整棵子树移动：拖到节点改父级、拖到根区升为一级，禁止自身/后代/超四级；旧侧栏拖拽链退役', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  return h.includes('function validateDrop')
    && h.includes("if (dragId === targetId) return { ok: false, message: '不能移动到自身' }")
    && h.includes('catIdx.value.descendants(dragId).includes(targetId)')
    && h.includes('if (targetId === \'root\')')
    && h.includes('dragged.parentId = target.id')
    && m.includes("@drop=\"onDrop($event, 'root')\"")
    && !codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8')).includes('onCatRootDrop');
});
check('W7（V3.9.8 随迁）池卡批量语义改为“引用投射”，不再搬动源卡：批量栏提供打开 / 投射 / 删除，目标台只列现役策展台且允许多选，旧移动分类入口零回流', () => {
  const p = read('/newtab/components/compass/PoolCardsPanel.vue');
  return p.includes('<DeckBatchBar v-if="batchMode"')
    && p.includes('批量打开') && p.includes('投射到策展台') && p.includes('删除（进回收站）')
    && p.includes('const batchBoards = computed(() =>')
    && p.includes('w.kind !== \'resource\' && w.id !== CURATION_WS_ID && !w.archived')
    && p.includes('function confirmBatchMirror()')
    && p.includes('源卡仍留在资源卡池；目标台只是新增引用')
    && !p.includes('moveWorkspaces') && !p.includes('treeCatOptions');
});
check('W8（V3.9.8 随迁）资源不再做「单卡移动分类」：池卡组织改为标签，策展归属改为节点关联；台名/描述弹窗仍保留', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('openInputModal') && w.includes('renameWs()') && w.includes('editDesc()')
    && !w.includes('openMoveOne') && !w.includes('moveOneOpen');
});
check('W9 采集浮层分类下拉层级化', () => read('/content/search-overlay.ts').includes('treeCatLabels'));

console.log('【第九轮 · 体验修复】');
check('W10（V3.9.8 随迁）卡片分类标注退役，节点下资源 chip 以标题 + 来源点标识证据；点击开详情、右键开卡片菜单', () => {
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  return n.includes('class="mind-resource-dot"')
    && n.includes(":data-source=\"card.sourceType || 'personal'\"")
    && n.includes('@click.stop="onResourceClick(card)"')
    && n.includes('resourceClickTimer = setTimeout(() => {')
    && n.includes("emit('open-resource', card)")
    && n.includes('@dblclick.stop="onResourceDblClick(card)"')
    && n.includes("emit('open-resource-link', card)")
    && n.includes('@contextmenu.prevent.stop="emit(\'open-resource-context\', $event, card)"')
    && !read('/newtab/views/Workspace.vue').includes('catNameOfFamily');
});
check('W11 TagPicker 空体系引导去标签管理', () => read('/shared/components/TagPicker.vue').includes('tp-guide') && read('/shared/components/TagPicker.vue').includes("query: { page: 'tags' }"));
check('W12 设置深链 ?page=（onMounted+watch）', () => read('/newtab/views/GlobalSettings.vue').includes('function pageFromQuery') && read('/newtab/views/GlobalSettings.vue').includes('watch(() => route.query.page'));
check('W13 使用手册富文本（五篇·图文并茂·独立页）', () => read('/newtab/views/ManualPage.vue').includes('v-html="sec.html"') && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-steps') && read('/newtab/manual-data.ts').includes('恩格尔巴特') && read('/newtab/manual-data.ts').includes('七不原则') && read('/newtab/manual-data.ts').includes('快捷键全表'));
check('W14 tagUsage 数据兜底', () => read('/newtab/views/GlobalSettings.vue').includes('for (const x of arr || [])'));

console.log('【第十轮 · 稳定性与性能】');
check('B30a 全局渲染错误边界（黑屏→错误卡片）', () => read('/newtab/App.vue').includes('onErrorCaptured') && read('/newtab/App.vue').includes('render-error'));
check('B30b 标签树残缺节点兜底', () => read('/newtab/views/GlobalSettings.vue').includes('safeNodes') && read('/newtab/views/GlobalSettings.vue').includes("filter(n => n && typeof n.id === 'string')"));
check('B31 新建工作台双创建守卫', () => read('/newtab/App.vue').includes('B31：Enter 与 blur 双触发守卫') && read('/newtab/App.vue').includes("newWsName.value = ''"));
check('B32 图标管理（选择/自定义/删除）', () => read('/newtab/views/Workspace.vue').includes('setWsIcon') && read('/newtab/views/Workspace.vue').includes('WS_ICONS') && read('/newtab/views/Workspace.vue').includes('删除图标'));
check('B32 Hero 名称剥离 icon 前缀', () => read('/newtab/views/Workspace.vue').includes('wsDisplayName') && read('/newtab/App.vue').includes('<Icon v-else name="folder" :size="13"/>'));
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
check('O24 好奇心采集带来源（两端+模型+详情）', () => read('/shared/models/index.ts').includes('sourceTitle') && read('/content/search-overlay.ts').includes('sourceTitle: srcTitleInput') && read('/newtab/components/GlobalPopups.vue').includes('v-model="curioForm.sourceTitle"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('class="cz-ext-src"') && read('/newtab/components/compass/CuriosityPanel.vue').includes("f.key === 'sourceUrl'")) /* ★R4-Dj 随迁备案（收紧不是放宽）：原判据只核 Curio 里出现 "detail-src" 字样——那是 R117 详情重设计后只剩在 CSS 里的死类名（模板零引用，删规则才暴露）。现改核现役两件事：来源行真的按 fieldConfig 的 sourceUrl 渲染 + 用的是 cz-ext-src 这个真类名 */;

console.log('【第十四轮 · Linear 视觉重构】');
check('P1 六主题 Linear 体系（深空薰衣草默认）', () => read('/shared/styles/tokens.css').includes("[data-theme='linear']") && read('/shared/styles/tokens.css').includes('#0D0E11') && read('/shared/styles/tokens.css').includes('#5E6AD2'));
check('P1 默认主题迁移（green→linear 一次性）', () => read('/shared/storage/repository.ts').includes("theme: 'linear'") && read('/shared/storage/repository.ts').includes("uiCache.theme === 'green'"));
check('P2 封面扁平化（R64 修订：hero 已删，等效锚点换指标卡样式）', () => !read('/newtab/views/Workspace.vue').includes('COVER_THEMES') && !read('/newtab/views/Workspace.vue').includes('heroGradient') && read('/newtab/views/Workspace.vue').includes('.res-card { background: var(--surface); border: 1px solid var(--border);') && !read('/newtab/views/Workspace.vue').includes('.metric-card')); /* ★R4-Dj 随迁备案：R64 那次把"等效锚点"换成 .metric-card，而指标卡随资源台台面一起退役了、CSS 里只剩没人用的规则——锚点跟能力搬到现役卡片语言 .res-card；另加一条负判据：.metric-card 不许再作为 Workspace 的锚点回流 */
check('R49 方向台扁平化（原 P2 罗盘 Hero）★R3-B1 随宿主改靶 + ★W12 随迁备案：满宽页头口径落在方向树（.compass-layout 1440 居中 + 页头区），页头区本体由 .tree-page-head 一行工具条改为 .hero 两栏（文案左 / 动作右）——守的是"满宽 + 页头区存在"这两条，不是那一行密排的写法。★容器 padding 仍钉 20px 36px 64px（R125 跨页一致性，W12 只改页头区形态不动容器）', () => CT_ALL.includes('.compass-layout { display: block; min-height: 100%; padding: 20px 36px 64px; max-width: 1440px; margin: 0 auto; }') && /^\.hero \{/m.test(CT_ALL));
check('P3 去弹跳（hover 无位移）+ 焦点环', () => !read('/newtab/views/ProjectCuration.vue').includes('translateY(-3px)') && !read('/newtab/views/Workspace.vue').includes('.res-card:hover { border-color: var(--accent); box-shadow') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('P3 过渡统一 200ms 内', () => !read('/newtab/views/ProjectCuration.vue').includes('transform .26s') && read('/shared/styles/tokens.css').includes('font-feature-settings: "tnum"'));

console.log('【第廿七轮 · 身份与排版精修】');
check('R28/R49 信纸排版精修（衬线+留白，应用内+分享版；R49 调度台重写并加大行距留白）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 80px 64px') && read('/newtab/letter-data.ts').includes('padding: 96px 76px'));
check('R28 donge 哥身份（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
/* R28 / R26-2 于 B7-e（V3.8.40）重指：原锚是「手册正文 padding: 36px 44px / 38px 46px」，
   而 H1 把章节从「卡片盒」改成「通栏发丝线 + 上下留白」⇒ 那两个字面量随章节盒一起退役。
   重指后守的是**同一条意图的当代形态**：① 应用内与分享版的章节分隔形态必须同步（都走发丝线）；
   ② 两处都必须留上下呼吸（padding 三值 Y 0 Y′），不许压成一行；
   ③ 负锚：卡片盒（章节自带 border-radius + 四边 border）不许回流。
   ★为什么不直接删判据：钉字面量会随排版迭代反复假红，但"两处同步"这件事本身永远该有人守。 */
check('R28 手册排版留白精修（应用内 + 分享版同步 · B7-e 重指到发丝线形态）· ★R4-Et 随迁备案：第三处原锚 padding: 34px 40px 挂在 .gs-mc-section 上——那是设置页内嵌手册正文时代的容器，手册自第廿一轮起独立成页，设置页现在只剩一个「打开使用手册」按钮（模板里 gs-mc-section 零引用、census 零命中，本轮清掉）。三处同步因此收敛成两处活锚（阅读页 + 手册数据），第三处换成"设置页不许再把手册正文嵌回来"的负锚：.gs-mc-section 与内联手册容器 .gs-manual 回流即红', () => {
  const mp = read('/newtab/views/ManualPage.vue');
  const md = read('/newtab/manual-data.ts');
  // ① 两处章节都必须走发丝线分隔
  if (!/\.mn-section \{[^}]*border-top: 1px solid/.test(mp)) { console.log('阅读页章节未走发丝线'); return false }
  if (!/^\s*section \{[^}]*border-top: 1px solid/m.test(md)) { console.log('分享版章节未走发丝线（与应用内不同步）'); return false }
  // ② 两处都必须留上下呼吸：padding 三值「上 左右 下」，左右为 0 才是通栏
  if (!/\.mn-section \{[^}]*padding: \d+px 0 \d+px/.test(mp)) { console.log('阅读页章节缺上下呼吸'); return false }
  if (!/^\s*section \{[^}]*padding: \d+px 0 \d+px/m.test(md)) { console.log('分享版章节缺上下呼吸'); return false }
  // ③ 负锚：章节不许回退成卡片盒
  const mpSec = mp.slice(mp.indexOf('\n.mn-section {'), mp.indexOf('\n.mn-section:first-of-type'));
  if (/border-radius:/.test(mpSec)) { console.log('阅读页章节回流卡片盒（border-radius）'); return false }
  if (/border: 1px solid/.test(mpSec)) { console.log('阅读页章节回流卡片盒（四边 border）'); return false }
  return !read('/newtab/views/GlobalSettings.vue').includes('.gs-mc-section') && !read('/newtab/views/GlobalSettings.vue').includes('.gs-manual {');
});

console.log('【第廿六轮 · 信件身份与排版精修】');
check('R26-1 donge 哥身份融入（教育科技/AI 探索者）', () => read('/newtab/letter-data.ts').includes('教育科技行业深耕了十余年') && read('/newtab/letter-data.ts').includes('AI 如何真正赋能学习与工作'));
check('R26-2/R49 信纸与手册排版留白精修（信纸参数 R49 更新 · 手册两侧于 B7-e 重指：手册章节留白改走发丝线 + 上下呼吸，具体数值由 R28 守，两条分工不重）', () => read('/newtab/views/GlobalSettings.vue').includes('padding: 80px 64px') && /padding: \d+px 0 \d+px/.test(read('/newtab/views/ManualPage.vue')) && /^\s*section \{[^}]*padding: \d+px 0 \d+px/m.test(read('/newtab/manual-data.ts')));

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
check('R23-4 好奇心面板接来源 prefill ★R4-Fb 重指带备案：原锚在 popup/App.vue 的 curioSource 上，popup 端已随降级路径退役；这条性质现在的家是应用内好奇面板——开面板先清空来源，只有存在选中文本时才从最近的网页标签补 title/url', () => { const g = read('/newtab/components/GlobalPopups.vue'); return g.includes("curioForm.sourceTitle = ''") && g.includes('getRecentWebTab') && g.includes('curioForm.sourceUrl = t.url'); });

console.log('【第廿二轮 · 拖拽根修二段】');
check('R22 好奇 store 去虚拟排序（拖拽根修二段）', () => !read('/newtab/stores/curiosity.ts').includes('sort((a, b) => (b.createdAt'));

console.log('【第廿一轮 · 修复验收】');
check('R21-1 好奇心选采预取缓存', () => read('/content/search-overlay.ts').includes('selCache') && read('/content/search-overlay.ts').includes('function resolveSelection'));
check('R21-2（V3.9.8 随迁）拖拽位置感知不丢：好奇列表/看板与任务分组行/看板仍按上下半区判落点；策展画布改按整棵子树落点并给出合法/非法原因', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  return read('/newtab/components/compass/CuriosityPanel.vue').includes("const after = dropMark.value.endsWith('-b')")
    && read('/newtab/components/compass/TaskManagerPanel.vue').includes('markTaskDrop($event, task.id)')
    && read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskCardDrop')
    && m.includes('function onDragOver(e: DragEvent, id: string)')
    && m.includes('dropInvalid.value = !check.ok')
    && m.includes('dropHint.value = check.message')
    && !read('/newtab/views/Workspace.vue').includes("markDrop($event, r.id, 'y')");
});
check('R21-3/R49 页面对齐（方向台/调度台统一页边距 max-width 1440）★R175/R3-B1 重指带备案：调度台 .page 18px/72px 不变，方向台 20px 顶距的宿主由 CompassShell 换成方向树 .compass-layout', () => CT_ALL.includes('padding: 20px 36px 64px') && read('/newtab/views/CompassHome.vue').includes('padding: 18px 36px 72px'));
check('R21-4 手册独立页（/manual 路由 + 目录锚点 + 富文本非 scoped）', () => read('/newtab/router.ts').includes("path: '/manual'") && read('/newtab/views/ManualPage.vue').includes('mn-content .mc-tip') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab'));

console.log('【第十九~二十轮 · 拼音搜索/拖拽修复/手册白皮书】');
check('R19（R160 重指）拼音/首字母搜索（两端）：两层表实现（INITIALS/FULLS）+ 两入口 matchPinyin', () => read('/shared/utils/pinyin.ts').includes('INITIALS') && read('/shared/utils/pinyin.ts').includes('FULLS') && read('/shared/utils/pinyin.ts').includes('export function matchPinyin') && read('/newtab/components/GlobalPopups.vue').includes('matchPinyin') && read('/content/search-overlay.ts').includes('matchPinyin'));
check('R20a 拖拽失效修复（去虚拟置顶排序；物理置顶已于第卅三轮 R33-1 改为独立分区）', () => !read('/newtab/views/CompassHome.vue').includes('置顶任务优先（稳定排序') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('第十七轮：置顶优先'));
// 第卅三轮 R33-1：BUG-D 修复 —— 物理 unshift 会破坏手动拖拽排序，置顶改独立分区（R20a 旧断言随行为变更同步更新）
check('R33-1 BUG-D 任务置顶独立分区（不再物理 unshift 源数组）', () => !read('/newtab/components/compass/TaskManagerPanel.vue').includes('置顶动作物理移到列表顶部') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('pinnedTasks') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('normalTasks') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('<Icon name="pin" :size="13"/> 置顶 · {{ pinnedTasks.length }}'));
check('R20b 使用手册五篇重写（外置数据源）', () => read('/newtab/manual-data.ts').includes('速览 · 一页上手') && read('/newtab/manual-data.ts').includes('理念篇 · 知源哲学') && read('/newtab/views/GlobalSettings.vue').includes('openManualTab') && read('/newtab/views/ManualPage.vue').includes("from '../manual-data'") && read('/newtab/router.ts').includes("'/manual'"));

console.log('【第十八轮 · 交互视觉全面优化】');
check('A1/A2 图标体系 + EmptyState 组件', () => read('/shared/components/Icon.vue').includes('download') && read('/shared/components/EmptyState.vue').includes('es-art') && read('/shared/components/ModuleCard.vue').includes('iconName'));
check('A3~A10 全局形态（徽章/滚动条/负字距/等宽/焦点环）', () => read('/shared/styles/tokens.css').includes('body .tag, body .rc-tag') && read('/shared/styles/tokens.css').includes('font-variant-numeric: tabular-nums') && read('/shared/styles/tokens.css').includes(':focus-visible'));
check('B1 命令面板升级（分组/高亮/快捷操作/最近）', () => read('/newtab/components/GlobalPopups.vue').includes('groupedResults') && read('/newtab/components/GlobalPopups.vue').includes('QUICK_ACTIONS') && read('/newtab/components/GlobalPopups.vue').includes('hlTitle') && read('/content/search-overlay.ts').includes('QUICK_ACTIONS_ZY'));
check('B2 删除可撤销（Toast 全局单例统一 2.4s，REQ-030 收敛；★G5(V3.8.27) 重指：3s → 2.4s，回执是确认不是阅读材料）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 2400') && read('/newtab/App.vue').includes('<Toast />') && read('/newtab/views/Workspace.vue').includes("label: '撤销'") && read('/shared/components/Toast.vue').includes('toastState') && !read('/newtab/views/Workspace.vue').includes('runToastAction') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast'));
/* ★V3.9.6 重指带备案：速查面板已从 GlobalPopups.vue 拆到 GlobalPopupsShortcuts.vue
   （GlobalPopups 第二梯队拆分 · 第一块），清单真源的消费点随之搬进那个组件。
   判据意图（速查面板吃真源清单 + ? 键可呼出）一字未改。 */
check('B3 快捷键速查面板（? 呼出）', () => read('/newtab/components/GlobalPopupsShortcuts.vue').includes('SHORTCUT_GROUPS') && read('/newtab/App.vue').includes("e.key === '?'"));
check('B4/B9 键盘导航（任务列表 + 日期）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskNavKey') && read('/newtab/views/CompassHome.vue').includes('onDateKey'));
check('B5 统一右键菜单（三卡）', () => read('/shared/components/ContextMenu.vue').includes('cx-item') && read('/newtab/views/Workspace.vue').includes('openResCtx') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('openTaskCtx') && read('/newtab/components/compass/CuriosityPanel.vue').includes('openCurioCtx'));
check('B6 拖拽插入线', () => read('/newtab/views/Workspace.vue').includes('drop-line-t') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('drop-line-t') && read('/newtab/components/compass/CuriosityPanel.vue').includes('drop-line-t'));
check('B7（V3.9.1 重指）抽屉宽度记忆：任务详情经共享 Drawer 的 widthStorageKey 落 drawerWs.task，全站其余抽屉共用 shared', () => { const f = read('/newtab/components/compass/TaskDetailDrawer.vue'); const dr = read('/shared/components/Drawer.vue'); return read('/shared/models/index.ts').includes('drawerWs') && f.includes('width-storage-key="task"') && dr.includes('widthStorageKey') && dr.includes('store.ui?.drawerWs?.[props.widthStorageKey]') && dr.includes("const key = props.widthStorageKey || 'shared'"); });
check('B8/B10/B11 焦点返还/列头sticky/加载态', () => read('/newtab/components/GlobalPopups.vue').includes('lastFocused') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('.khead { position: sticky;') && read('/newtab/views/CompassHome.vue').includes('exportBusy'));

console.log('【第十七轮 · 修复与功能补全】');
check('R17-1 三件事导出弹窗（时间范围+6字段 CSV）', () => read('/newtab/views/CompassHome.vue').includes('openExportModal') && read('/newtab/views/CompassHome.vue').includes('任务内容,所属项目,项目→成功指标,任务状态,安排时间,创建时间') && read('/newtab/views/CompassHome.vue').includes('doExport'));
check('R17-2 好奇心来源仅选中时附带（两端，可为空）', () => read('/newtab/components/GlobalPopups.vue').includes("if (sel) {") && read('/content/search-overlay.ts').includes('const hasSel = !!selection'));
check('R17-3 项目策展创建项目（视觉链+选战略目标+直接进展板）', () => read('/newtab/views/ProjectCuration.vue').includes('openCreateProject') && read('/newtab/views/ProjectCuration.vue').includes('confirmCreateProject') && read('/newtab/views/ProjectCuration.vue').includes('createDirId') && read('/newtab/views/ProjectCuration.vue').includes('cm-chain'));
check('R17-4/R49 工具组右上角 ★R3-B1 重指带备案 + ★V3.8.20 翻转带备案（用户拍板 2026-10-15）+ ★F6 二次翻转带备案（用户拍板 2026-10-16）：主航线 #actions 插槽退役后工具组曾落在方向台页头一行；V3.8.20 收进「⚙ 工具」下拉（视图切换成为动作行唯一主焦点）；本轮 F6 二次翻转恢复常驻并排——下拉让高频操作变两跳，且「👁 已完成项目：显示/隐藏」状态开关藏菜单后当前状态不可见。翻转不删断言：「↕ 反向开关 + 👁 已完成 + dhi-badge 读数行首位」三项锚贯穿三代形态不变，形态锚改回常驻（两枚 tree-tool 并排于 .hero-tools，右上角定位 margin-left:auto）+ 负锚钉下拉壳零残留；面板级 footer 负锚保留', () => { const t = codeOnly(CT_ALL); return !exists('/newtab/components/compass/LighthousePanel.vue') && t.includes('class="hero-tools"') && !t.includes('hero-tools-menu') && t.includes('↕ ') && t.includes('已完成项目') && t.includes('dhi-badge') && !t.includes('lh-footer">'); });
check('R17-5 置顶右上角统一（好奇三视图）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('cz-pin-corner') && read('/newtab/components/compass/CuriosityPanel.vue').includes('置顶优先'));
check('R17-6 任务卡置顶（模型+列表+看板+选取）', () => read('/shared/models/index.ts').includes('pinned?: boolean') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('toggleTaskPin') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('.k-pin') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('.t-pin'));

console.log('【第十三轮 · V2.2.0 正式版】');
check('V13-1 任务卡链接字段 + 单/双击统一', () => read('/shared/models/index.ts').includes('link?: string') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskRowDblClick') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('openCardLink'));
check('V13-2 任务抽屉链接+备注（可拖拽调高）· ★R4-Et 随迁备案：第三处原锚 .ts-note { 是 R167 详情重设计后遗留的死规则（备注框早已换 class="ds-desc"，模板/census/字符串三处零引用，本轮清掉）。第三处换成今天真在渲染的那三件：备注 textarea 绑 selectedTask.description + 记忆高度的 :style + 拖拽把手，并钉住 .ts-note 不许回流', () => { const f = read('/newtab/components/compass/TaskDetailDrawer.vue'); return f.includes('selectedTask.link') && f.includes('selectedTask.description')
  && f.includes('<textarea v-model="selectedTask.description" class="ds-desc" :style="{ height: taskNoteH + \'px\' }"')
  && f.includes('<div class="ta-resize" @mousedown="startTaskNoteResize"') && !f.includes('.ts-note {') });
check('V13-3 好奇心链接口径（sourceUrl+本地路径直达；R129-B5 起统一走 link.toOpenableRawLink）', () => { const cp = read('/newtab/components/compass/CuriosityPanel.vue'); return cp.includes('toOpenableRawLink') && !cp.includes('function toOpenableCurioLink') && cp.includes('来源链接（网页 / 本地路径 / obsidian://，失焦即保存）'); });
check('V13-4 文本框可拖拽调高（三卡详情）· R167 重指：资源表单的 `.ref-note` 搬进 ds-* 面板成 `.ds-hero-note`，判据跟着换成「焦点区 + 拖拽把手 + 记忆 hook」三件同在（把手没了就是"调了不记"，比不调更气人）', () => { const f = read('/newtab/components/ResourceEditForm.vue'); return f.includes('ds-hero-note') && f.includes('ref-ta-resize') && f.includes('useTaHeight') && read('/newtab/components/compass/CuriosityPanel.vue').includes('class="ds-hero-note"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('height: detailH') /* ★R4-Dj 随迁备案：原锚 max-height:400px 挂在 .detail-textarea 上，而 .detail-textarea 模板零引用（R167 详情重设计后 Curio 走 ds-hero-note + detailH 记忆高度）；换成"类名与记忆高度两件事都在"，比只看一条 max-height 更实 */ && read('/newtab/components/compass/TaskDetailDrawer.vue').includes("useTaHeight('task-note'") /* ★R4-Et 随迁备案：原锚 max-height: 320px 是死规则 .ts-note 的属性（同 V13-2），换成任务抽屉这一路的"记忆 hook"本体——三件同在的口径本来就比一条写死的 max-height 承重 */ });
check('V13-5 罗盘子页 out-in 过渡移除（切换即时）★R3-B1 随宿主改靶：过渡宿主是 App 级 router-view（方向台一级化后仍不得回添 out-in）· ★C3（V3.8.31）二次靶：方向台**页内**视图形态切换现在明确要求 out-in（C3 规格），与「路由级零动画」不是一回事——本条的靶收窄为「App 级 router-view 不许多余过渡」+「页内至多一处 out-in 且必须是 viewfade」', () => {
  const appNoOutIn = !read('/newtab/App.vue').includes('mode="out-in"');
  const n = (CT_ALL.match(/mode="out-in"/g) || []).length;
  const onlyViewfade = n === 0 || (n === 1 && CT_ALL.includes('<Transition name="viewfade" mode="out-in">'));
  return appNoOutIn && onlyViewfade;
});
check('V13-6 刷新骨架品牌动画保留（仅加载时）', () => read('/../src/newtab/index.html').includes('zy-skl'));

console.log('【第廿八轮 · 拖拽体系修复】');
check('R28-1（V3.9.8 随迁）资源四视图拖拽退役，策展画布节点可拖拽：拖动把手 draggable=true，落点事件接在递归节点上，整棵子树随父级移动', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  return n.includes('draggable="true"')
    && n.includes('@dragstart="dragStart"')
    && n.includes('@dragover="emit(\'drag-over\', $event, node.id)"')
    && n.includes('@drop="emit(\'drop\', $event, node.id)"')
    && m.includes('@drag-start="onDragStart"') && m.includes('@drop="onDrop"')
    && !read('/newtab/views/Workspace.vue').includes(':draggable="!batchMode"');
});
check('R28-1b（V3.9.8 随迁）拖拽反馈覆盖拖动源、合法落点、非法落点与原因提示，旧列表插入线样式零回流', () => {
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const css = read('/newtab/components/curation/curation.css');
  return n.includes("dragging: dragSource === node.id")
    && n.includes("'drop-target': dropTarget === node.id && !dropInvalid")
    && n.includes("'drop-invalid': dropTarget === node.id && dropInvalid")
    && n.includes('class="mind-drop-hint"')
    && css.includes('.mind-node.dragging') && css.includes('.mind-node.drop-target') && css.includes('.mind-node.drop-invalid')
    && !read('/newtab/views/Workspace.vue').includes('.res-row.drop-line-t');
});
check('R28-2 任务看板跨列落卡=改状态（统一状态出口）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskCardDrop($event, task, groupByProject)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('setTaskStatusOf(moved, status)'));
check('R28-3 任务跨组落卡=改归属清指标（列表+看板）', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('onTaskDrop(task, true)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('moved.metricId = undefined'));
check('R28-4 好奇看板跨列落卡=改状态 + 轴向修正', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('onCzDrop($event, c.id, col.status)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("axis === 'x'"));
check('R28-5 资源看板跨分类落卡=改分类', () => read('/newtab/views/Workspace.vue').includes("moved.categoryId = target.categoryId || ''"));
check('R28-6 展板任务拖拽 off-by-one 修复+落库', () => read('/newtab/views/ProjectCuration.vue').includes('const after = (e.clientY - rect.top) / rect.height > 0.5'));

console.log('【第廿九轮 · Tab排序/拖卡归档/信纸留白 · V2.9.0】');
check('R29-1 工作台 Tab 拖拽排序（插入线+order 全量规整落库）', () => read('/newtab/App.vue').includes('onWsTabDrop') && read('/newtab/App.vue').includes('wsDropMark') && read('/newtab/App.vue').includes('list.forEach((w, i) => { w.order = i })'));
check('R29-2（V3.9.1 重指）应用内切台键随台签顺序：固定 Alt+1…9、设置页只读，自定义绑定入口零残留', () => { const s = read('/newtab/views/settings/SettingsShortcutsPanel.vue'); const a = read('/newtab/App.vue'); const g = read('/newtab/views/GlobalSettings.vue'); return s.includes('拖拽改序后数字键跟随顺序') && s.includes('知源内不提供修改') && a.includes('function switchToIndex(') && a.includes('e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey') && !g.includes('setWsHotkey'); });
check('R29-3 资源卡拖到侧栏分类改归属（三视图通用+待分类落点）', () => read('/newtab/views/Workspace.vue').includes('cardDropTarget') && read('/newtab/views/Workspace.vue').includes('onDropToCategory(e, cat.id)') && read('/newtab/views/Workspace.vue').includes("onDropToCategory(e, '')"));
check('R29-4（V3.9.8 随迁）分类落点高亮改由画布表达：合法落点、非法落点、键盘目标三种状态互不混淆，旧侧栏分类落点零回流', () => {
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const c = read('/newtab/components/curation/curation.css');
  return n.includes("'drop-target': dropTarget === node.id && !dropInvalid")
    && n.includes("'drop-invalid': dropTarget === node.id && dropInvalid")
    && n.includes("'keyboard-target': keyboardDragSource && keyboardDragTarget === node.id")
    && c.includes('.mind-node.drop-target') && c.includes('.mind-node.drop-invalid')
    && c.includes('.mind-node.keyboard-target')
    && !read('/newtab/views/Workspace.vue').includes('.cat-item.card-drop');
});
check('R29-5/R49 信纸明显留白（应用内+分享版同步；R49 行距 3.1）', () => read('/newtab/views/GlobalSettings.vue').includes('line-height: 3.1') && read('/newtab/letter-data.ts').includes('line-height: 3.1'));
check('R29-6（R65 修订；★R4-Db 重指带备案：书签解析器自 useWorkspaceImport 搬进唯一实现 useBookmarkImport，解码锚点跟着搬到新落点，判据一字未松）分类/标签名 URL 编码归一化——三处解码点：仓库读取层 + 工具真源 + 书签解析', () => read('/shared/storage/repository.ts').includes('safeDecodeText') && read('/shared/utils/index.ts').includes('export function safeDecodeText') && read('/newtab/composables/useBookmarkImport.ts').includes('safeDecodeText(h3.textContent') && read('/newtab/composables/useBookmarkImport.ts').includes('safeDecodeText(a.textContent'));
check('R29-7 「升为一级」落点先取引用再清理（修拖拽状态自吞）', () => read('/newtab/views/Workspace.vue').includes('先取引用再清理状态'));

console.log('【第卅轮 · 信件模块化/书签导入分类树 · V2.10.0】');
check('R30-1 信件节头+停顿+信念行（应用内样式）', () => read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-h') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-turn') && read('/newtab/views/GlobalSettings.vue').includes('.gs-letter .lp-body p.lp-creed'));
check('R30-2 信件 HTML 模块化结构（两处渲染共享）', () => read('/newtab/letter-data.ts').includes('<p class="lp-h">') && read('/newtab/letter-data.ts').includes('<p class="lp-turn">') && read('/newtab/letter-data.ts').includes('<p class="lp-creed">'));
check('R30-3 分享版分节样式同构', () => read('/newtab/letter-data.ts').includes('.lp-body p.lp-h'));
check('R30-4（R73 修订；R100 拆入 composable；★R4-Db 退役重指带备案：本条守的「书签文件夹前 2 级建分类 + 同名同级复用」**整条能力按设计删除**，不是搬家——它建的分类挂在隐藏池 CURATION_WS_ID 下，而 models 明令「池卡 categoryId 恒空、hub 分类实体已由迁移器移除」，清理器又被 catsMigratedAt 幂等戳挡住不会重跑 ⇒ 触发一次就留下金字塔仍在枚举的永久残留；且它的触发钮自 V3.7.0 起全站零 .click()，是一条够不着的死链。判据转退役三条腿：① 两份实现（旧 composable 与唯一实现）剥注释后一律零命中那套建树符号；② 存活口径点名=书签层级**只进标签**（BK_ROOT_NAMES 过滤后整条 path 进 tags）+ 台内单「待分类」承接归属；③ 设置页文案照旧写明"建树导入已随资源台退役"（R169-17 同锚，两处不许互相打架）', () => {
  const bk = codeOnly(read('/newtab/composables/useBookmarkImport.ts'));
  const imp = codeOnly(read('/newtab/composables/useWorkspaceImport.ts'));
  const gs = read('/newtab/views/GlobalSettings.vue');
  const retired = ['function ensureBookmarkCategory', 'cat.parentId = parentId', 'segs.slice(0, 2)', 'bkFolders', 'bookmarkModalOpen'];
  return retired.every(k => !bk.includes(k) && !imp.includes(k))
    && bk.includes('b.path.filter(p => p && !BK_ROOT_NAMES.has(p))') && bk.includes("name: '待分类'")
    && !bk.includes('CURATION_WS_ID') && !imp.includes('CURATION_WS_ID')
    && gs.includes('建树导入已随资源台退役');
});
check('R30-5（R73 修订；R100 拆入 composable；★R4-Db 重指带备案：口径由「第 3 级+转标签（前 2 级已建分类）」改成「整条路径全部转标签」——建树那条已随上一条退役，层级不再有第二处去处；本条原先那条负判据禁的正是旧设置页那枚只排 书签栏 的公式，本轮唯一实现用的就是它当初要求的那一侧：按 BK_ROOT_NAMES 八枚排净，中英文与移动端栏名都不漏进标签）书签层级→标签唯一口径', () => { const bk = read('/newtab/composables/useBookmarkImport.ts'); const imp = codeOnly(read('/newtab/composables/useWorkspaceImport.ts')); const gs = codeOnly(read('/newtab/views/GlobalSettings.vue')); return bk.includes('!BK_ROOT_NAMES.has(p)') && bk.includes("const BK_ROOT_NAMES = new Set(['书签栏', '收藏栏', '其他书签'") && !bk.includes('segs.slice(2)') && !bk.includes("p !== '书签栏'") && !imp.includes("p !== '书签栏'") && !gs.includes("p !== '书签栏'") && !gs.includes('function parseBookmarksHtml'); });

console.log('【第卅一轮 · 下钻抽屉重构/Esc修复/发版 · V2.11.0】');
check('R31-1 Drawer 组件 Esc 关闭（open 期间 document 级捕获）', () => read('/shared/components/Drawer.vue').includes("watch(() => props.open") && read('/shared/components/Drawer.vue').includes("document.addEventListener('keydown', onKey, true)"));
check('R31-2 模块分组下钻（第卌四轮退役：下排改今日增删卡，全景下钻移交设置页工作台全景）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('openWsPopup') && !s.includes('nd-ws-card') && s.includes("openDrawer('today-add')"); });
check('R31-3 链接卡片明细（第卌四轮退役：模块分组/链接卡片撤出北极星，计数树由工作台全景承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('groupedLinkCards') && !s.includes('allLinkCards') && s.includes('todayDelList'); });
check('R31-4 卡片行单击详情/双击打开（第卌四轮退役：wsPopup/卡片行随模块分组撤出，北极星仅剩指标抽屉）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('onCardRowClick') && !s.includes('resClickTimer') && s.includes('openDrawer'); });
check('R31-5 新建任务自动聚焦标题并全选', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes("document.querySelector('.ts-title')") && read('/newtab/components/compass/TaskManagerPanel.vue').includes('el.select()'));

console.log('【第卅二轮 · 十四需求包 · REQ-001~014】');
check('R32-1 REQ-001 战略目标层投射已移除（函数与字段三清）', () => !CT_ALL.includes('toggleGoalProjection') && !CT_ALL.includes('dir.pinnedToLighthouse') && !read('/shared/models/index.ts').split('interface Direction')[1].split('interface ')[0].includes('pinnedToLighthouse'));
check('R32-1b/R121（原型三列分支）树内投射开关全部退役 + 项目主攻按钮收进 hover 动作（onToggleFocus）', () => { const t = CT_ALL; return !t.includes('toggleVisionProjection') && !t.includes('toggleMissionProjection') && !t.includes('toggleProjProjection') && !t.includes('投射至') && /@focus="onToggleFocus"/.test(t) && t.includes('tw-acts') && t.includes('toggleFocusProject('); });
check('R32-1c（R64 修订）方向状态口径=战略目标数+推进中项目数（DHI 百分比退役）', () => { const c = read('/newtab/stores/compass.ts'); return c.includes('let pushing = 0') && c.includes('goals') && !c.includes('在轨项目 ÷ 主攻项目'); });
check('R32-2 REQ-003 方向树项目卡打开项目全景抽屉', () => CT_ALL.includes('openProjectDrawer') && CT_ALL.includes('ProjectDetailDrawer'));
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
check('R32-8 REQ-009 搜索打开规则（V3.7.0 重指 → R2-④ 再重指：资源卡结果与 Ctrl+Enter 同一条定位链路，池卡落「资源卡池」并高亮）+ content 端 ?hl 兼容旧深链', () => read('/newtab/components/GlobalPopups.vue').includes('已定位到资源卡池') && !read('/newtab/components/GlobalPopups.vue').includes('资源卡在 3张卡中检索查看') && read('/newtab/router.ts').includes("path: '/curation'") && read('/newtab/router.ts').includes("redirect: () => ({ path: '/' })"));
check('R32-9 REQ-009 修复：文件类型卡片单击只弹 toast 不打开（旧 bug）', () => !read('/newtab/components/GlobalPopups.vue').includes('打开本地文件：${r.link}'));
check('R32-10 REQ-010 打开通道统一下沉 shared/utils/link（三处调用方迁移）', () => exists('/shared/utils/link.ts') && read('/newtab/views/Workspace.vue').includes("from '@/shared/utils/link'") && read('/newtab/components/compass/NorthStarPanel.vue').includes("from '@/shared/utils/link'") && CT_ALL.includes("from '@/shared/utils/link'"));
check('R32-11 REQ-012 关联卡片 chips 双击打开链接（含 WRR 计数口径统一）', () => CT_ALL.includes("openChipLink('res', rid)") && CT_ALL.includes("openChipLink('curio', cid)") && CT_ALL.includes('recordResourceOpen(d.value, r)'));
check('R32-12 REQ-013/014 模块分组下钻（第卌四轮退役：二级/三级下钻随 wsPopup 移除，由设置页工作台全景承接）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); return !s.includes('wsPopupLevel') && !s.includes('wsPopupCats') && s.includes("type DrawerType = 'dhi' | 'wce' | 'wrr' | 'today-add' | 'today-del' | 'tasks'"); });
check('R32-13 recordResourceOpen 下沉 shared/storage/stats（应用端统一引用）', () => exists('/shared/storage/stats.ts') && read('/newtab/views/Workspace.vue').includes("from '@/shared/storage/stats'") && read('/newtab/components/GlobalPopups.vue').includes("from '@/shared/storage/stats'"));
check('R32-14 REQ-002 项目层级＋=加指标 / 指标条目＋=加任务（职责单一，防回归）★W11(V3.8.11)随迁带备案：两级加法随结构拆分——项目级 ＋指标 在舱卡头（CompassTower emit addMetric，父组件 @add-metric="addMetric" 承接）；指标级 ＋任务 在指标卡（CompassLane .mc-add → addTask 事件，父组件经 findMetric 补 projId 调 openTaskAdd），本条守「两级出口各在一处、未被合并成同一入口」', () => CT_ALL.includes('@add-metric="addMetric"') && CT_ALL.includes("if (r) openTaskAdd(mid, r.proj.id)") && CT_ALL.includes('class="mc-add"'));
check('R32-15 REQ-011（R59-T4 修订）关联卡片选择器升级为居中弹窗（实时关键词+拼音过滤、资源/好奇分区、计数徽标、勾选即存）', () => { const t = CT_ALL; return t.includes('lm-mask') && t.includes('lm-search') && t.includes('link-count') && t.includes('function linkCandidates') && t.includes('toggleLinked'); });
check('R32-16 REQ-007 三视图均提供排序方向切换按钮', () => read('/newtab/views/Workspace.vue').includes('toggleSortDir') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('toggleSortDir') && read('/newtab/components/compass/CuriosityPanel.vue').includes('toggleSortDir'));
check('R32-17 REQ-008 工作台实体进入搜索类型 Tab 与分组计数（双端）', () => read('/content/search-overlay.ts').includes("key: 'ws'") && read('/content/overlay-impl.ts').includes("label: '🗂 策展台'") && read('/newtab/components/GlobalPopups.vue').includes("{ type: 'ws', label: '策展台' }"));

console.log('【第卅三轮 · V2.12 需求包第一批：模型/Bug · REQ-023 + BUG-A~D】');
check('R33-2 REQ-023 星标字段 starred（CardBase 一份 + 卡 extends，零迁移；V3.7.0 备案：三卡 → 四卡，+论证节点卡 ArgumentCard）', () => read('/shared/models/index.ts').split('export interface CardBase').length - 1 >= 1 && read('/shared/models/index.ts').split('extends CardBase').length - 1 === 4 && read('/shared/models/index.ts').includes('starred?: boolean'));
check('R33-2b REQ-023 导出 CSV 补置顶/星标两列（第卌一轮 REQ-055 资源改固定管理尾列；任务 CSV 仍含两列）', () => { const g = read('/newtab/views/GlobalSettings.vue'); const t = read('/newtab/views/CompassHome.vue'); return g.includes("{ label: '置顶', get: r => (r.pinned ? '是' : '') }") && g.includes("{ label: '星标', get: r => (r.starred ? '是' : '') }") && t.includes("t?.pinned ? '是' : ''") && t.includes("t?.starred ? '是' : ''"); });
check('R33-3 BUG-A 好奇置顶分组错位修复（置顶卡前置 + 组内 sortOrder/时间序）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)') && read('/newtab/components/compass/CuriosityPanel.vue').includes("from '@/shared/utils/marksort'"));
check('R33-4 BUG-B Ctrl+Enter 口径统一（采集浮层标题/链接去除裸 Enter 保存）', () => !read('/newtab/components/GlobalPopups.vue').includes('@keydown.enter.prevent="saveCapture"') && read('/newtab/components/GlobalPopups.vue').includes('<Icon name="save" :size="13"/> 保存（Ctrl+Enter）'));
check('R33-5（V3.9.8 随迁）新建子分类死链退役：改由画布节点「子分支」按钮与 Tab 创建，父级 id 直接写入 Category.parentId，旧侧栏弹窗入口零回流', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const h = read('/newtab/composables/useCurationMindMap.ts');
  return n.includes('@click.stop="emit(\'create-child\', node.id)"')
    && m.includes("emit('create-child', 'root')")
    && h.includes('parentId: parent?.id')
    && !read('/newtab/views/Workspace.vue').includes('openCreateCat');
});

console.log('【第卅三轮 · V2.12 需求包第二批：标记体系 · REQ-019/020】');
check('R33-6 REQ-019 搜索结果行星标按钮替换编辑（三类型均有）', () => read('/newtab/components/GlobalPopups.vue').includes('toggleStar(item)') && !read('/newtab/components/GlobalPopups.vue').includes('title="编辑" @click.stop="editItem(item)"'));
check('R33-6b REQ-019 搜索结果排序加权（置顶>星标>命中度，双端同口径；R131-C2 起 newtab 侧改装饰-排序，权重口径不变）', () => read('/newtab/components/GlobalPopups.vue').includes('mr: markRank(r.raw as AnyCard)') && read('/newtab/components/GlobalPopups.vue').includes('const mr = b.mr - a.mr') && read('/content/search-overlay.ts').includes('x.raw.pinned ? 2 : x.raw.starred ? 1 : 0'));
check('R33-7 REQ-020 三视图星标入口齐备（资源/任务/好奇）', () => read('/newtab/views/Workspace.vue').includes('toggleStar(r)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('toggleTaskStar(t)') && read('/newtab/components/compass/CuriosityPanel.vue').includes('toggleStar(c.id)'));
check('R33-7b REQ-020 置顶独立分区三视图一致（资源已改分组分区，任务已分区，好奇 markRank 分区前置）', () => read('/newtab/views/Workspace.vue').includes('resourceGroups') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('pinnedTasks') && read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)'));
check('R33-8（V3.9.8 随迁）REQ-020 星标呈现覆盖三张卡：资源池列表 / 网格均显式标记，任务卡与好奇卡沿用原角标', () => {
  const p = read('/newtab/components/compass/PoolCardsPanel.vue');
  return p.includes('function toggleStar(r: ResourceCard)')
    && p.split('pcp-star-btn').length - 1 >= 3
    && p.includes("r.starred = !r.starred")
    && p.includes("r.starred ? '已星标，点击取消' : '星标（搜索时优先展示）'")
    && read('/newtab/components/compass/TaskManagerPanel.vue').includes('class="k-star"')
    && read('/newtab/components/compass/CuriosityPanel.vue').includes('cz-star-corner');
});
check('R33-9 REQ-020 双标记独立可叠加（置顶卡不因星标降级）', () => read('/shared/utils/marksort.ts').includes('if (c.pinned) return 2') && read('/shared/utils/marksort.ts').includes('if (c.starred) return 1'));

console.log('【第卅三轮 · V2.12 需求包第三批：交互补齐 · REQ-015/017/024】');
check('R33-10 REQ-015 三卡抽屉 Ctrl+Enter 保存统一（资源标题/好奇/任务 Toast）', () => read('/newtab/components/ResourceEditForm.vue').split('emit(\'save\')').length >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').includes('@keydown.ctrl.enter.prevent="saveDetail"') && read('/newtab/components/compass/CuriosityPanel.vue').includes('detailId.value = null') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes("showToast('已保存')"));
check('R33-11 REQ-017 关联卡片卡片化（lc-ico/lc-text 两行截断，非胶囊）', () => CT_ALL.includes('lc-ico') && CT_ALL.includes('-webkit-line-clamp: 2') && CT_ALL.includes('border-radius: var(--radius-sm)'));
check('R33-12 REQ-024 文本框高度记忆（UIPrefs.taHeights + 三组件接线）', () => read('/shared/models/index.ts').includes('taHeights?: Record<string, number>') && read('/shared/utils/taHeight.ts').includes('saveUIPrefs') && read('/newtab/components/ResourceEditForm.vue').includes("useTaHeight(props.heightKey") && read('/newtab/views/Workspace.vue').includes('height-key="ws-note"') && read('/newtab/components/compass/TaskDetailDrawer.vue').includes("useTaHeight('task-note'") && read('/newtab/components/compass/CuriosityPanel.vue').includes("useTaHeight('curio-detail'"));
check('R33-12b REQ-024 默认高度加大（180px 起步 + 拖拽手柄三处）', () => read('/shared/utils/taHeight.ts').includes('def = 180') && read('/newtab/components/ResourceEditForm.vue').includes('.ref-ta-resize') && read('/newtab/components/compass/TaskDetailDrawer.vue').split('.ta-resize').length >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').split('.ta-resize').length >= 2);

console.log('【第卅三轮 · V2.12 需求包第四批：结构改造 · REQ-016/018/021/022】');
check('R33-13 REQ-016 共享任务添加抽屉（新建/关联双 Tab + Ctrl+Enter）', () => read('/newtab/components/TaskAddDrawer.vue').includes("tab === 'create'") && read('/newtab/components/TaskAddDrawer.vue').includes("tab === 'link'") && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="createTask"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="linkTasks"'));
check('R33-13b REQ-016 三处入口统一接入抽屉（罗盘树/项目策展/项目抽屉）★W11(V3.8.11)随迁带备案：罗盘树侧的加任务出口随指标卡迁进 CompassLane（跨两层组件到父组件才补得出 projId），承重锚点改钉「指标卡 ＋任务 挂载点 + 父组件 findMetric 补参接线」，不再要求同文件内 openTaskAdd(metric.id, proj.id) 直调字面量', () => CT_ALL.includes("if (r) openTaskAdd(mid, r.proj.id)") && CT_ALL.includes('class="mc-add"') && read('/newtab/views/ProjectCuration.vue').includes('openTaskAdd(m)') && read('/newtab/components/ProjectDetailDrawer.vue').includes('openTaskAdd(m.id)') && CT_ALL.includes('TaskAddDrawer') && read('/newtab/views/ProjectCuration.vue').includes('TaskAddDrawer') && read('/newtab/components/ProjectDetailDrawer.vue').includes('TaskAddDrawer'));
check('R33-13c REQ-016 关联任务同步写入 metricId 与 taskIds（转移归属防多挂）', () => read('/newtab/components/TaskAddDrawer.vue').includes('t.metricId = props.metricId') && read('/newtab/components/TaskAddDrawer.vue').includes('m.taskIds.filter(id => !ids.includes(id))') && read('/newtab/components/TaskAddDrawer.vue').includes('m.taskIds.push(id)'));
check('R33-14 REQ-018 删除免二次确认（四组件删除类 confirm 移除，非删除类保留）', () => !read('/newtab/views/Workspace.vue').includes('删除后可在回收站恢复') && !read('/newtab/views/CompassHome.vue').includes('删除后可在回收站恢复') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('确定删除这条好奇心') && !read('/newtab/views/ProjectCuration.vue').includes('确定删除该任务') && read('/newtab/composables/useWorkspaceBatch.ts').includes("danger: false"));
check('R33-14b REQ-018 回收站页面（路由 + 恢复 + 永久删除 + 分区清空）', () => read('/newtab/router.ts').includes("'/recycle'") && read('/newtab/views/RecycleBin.vue').includes('restoreTask') && read('/newtab/views/RecycleBin.vue').includes('purgeTask') && read('/newtab/views/RecycleBin.vue').includes('purgeAll'));
check('R33-14c REQ-018 回收站入口在设置页危险操作区', () => read('/newtab/views/GlobalSettings.vue').includes("router.push('/recycle')"));
check('R33-15 REQ-021 分类同名即时校验（R104 重指：实现拆入 useCategoryCrud，标红样式留宿主；R141 备案：弹窗只管新建，行内改名在 commitCatRename 里同口径查重）', () => read('/newtab/composables/useCategoryCrud.ts').includes('const catNameDup') && read('/newtab/composables/useCategoryCrud.ts').includes('c.name === name && c.id !== cat.id') && read('/newtab/views/Workspace.vue').includes('.ws-modal-input.dup') && read('/newtab/composables/useCategoryCrud.ts').includes('该策展台已存在同名分类，请更换名称'));
check('R33-15b（V3.9.8 随迁）存量重复分类合并入口随侧栏退役；现役分类改名/新建均在同台同名校验下拒绝重复，避免再生成第二棵同名分支', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  return h.includes('wsCats.value.some(c => c.id !== cat.id && c.name.trim() === name)')
    && h.includes('已存在同名分支，请换一个名称')
    && !read('/newtab/views/Workspace.vue').includes('mergeDupCats')
    && !read('/newtab/views/Workspace.vue').includes('class="cat-merge"');
});

console.log('【第卅三轮 · V2.12 需求包第五批：视图与布局 · REQ-025/026】');
check('R33-16 REQ-025 模块分组平铺（★R4-Da 退役重指带备案：本条原以 GS 的 const panTree = computed 作「承接方在场」凭据——R4-Da 把「🗺 资源台全景」整页随资源台退役删除，判据不许把凭据改成永真，故改点名现居所：平铺下钻 = 策展台分类树（Workspace 聚合读 sidebarCats 递归 pushTree）+ 调度台资源卡池面板（poolCards）。北极星两处死符号照旧零回流，全景侧实现按 codeOnly 零命中核验（注释里讲退役缘由不算残留，R166 纪律）', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); const gc = codeOnly(read('/newtab/views/GlobalSettings.vue')); return !s.includes('nd-flat-ws') && !s.includes('openWsPopup') && !gc.includes('const panTree = computed') && !gc.includes('panHubWss') && !gc.includes('gs-pan-tree') && read('/newtab/views/Workspace.vue').includes('const sidebarCats = computed<SidebarCat[]>') && read('/newtab/views/Workspace.vue').includes('for (const k of childCatsOf(c.id)) pushTree(k, depth + 1') && read('/newtab/components/compass/PoolCardsPanel.vue').includes('const poolCards = computed('); });
check('R33-16b REQ-025 打开即卡片列表级（★R4-Da 退役重指带备案：原凭据 GS 的 const panCards = computed 随「🗺 资源台全景」整页退役删除；「打开即列表级」这一现在调度台资源卡池面板承接——判据改认其真实锚点（poolCards + 网格/列表两视图 :data-rid 行），并加一条全景侧零命中判据防实现回流；北极星 wsPopupLevel 死符号照旧零回流', () => { const s = read('/newtab/components/compass/NorthStarPanel.vue'); const gc = codeOnly(read('/newtab/views/GlobalSettings.vue')); const pcp = read('/newtab/components/compass/PoolCardsPanel.vue'); return !s.includes('wsPopupLevel') && !gc.includes('const panCards = computed') && !gc.includes('panVisibleCards') && !gc.includes('gs-pan-list') && pcp.includes('const poolCards = computed(') && pcp.includes(':data-rid="r.id"') && pcp.includes("const viewMode = ref<'card' | 'list'>('list')" /* ★W15-T2 2026-10-16 用户拍板：默认视图改列表 */); });
check('R33-17 REQ-026 tokens spacing 令牌（卡片网格一处切换全局生效）', () => read('/shared/styles/tokens.css').includes('--card-pad-vert') && read('/shared/styles/tokens.css').includes('--card-gap') && read('/shared/styles/tokens.css').includes('--card-min-w') && read('/shared/styles/tokens.css').includes("[data-density='compact']"));
check('R33-17b（V3.9.8 随迁）卡片密度档位从策展宿主退役：画布以固定节点密度 + 金字塔/树状两种布局表达信息层级；全局密度偏好与令牌仍保留给其余卡面', () => {
  const w = read('/newtab/views/Workspace.vue');
  const css = read('/newtab/components/curation/curation.css');
  return !w.includes('v-model="density"')
    && css.includes('.mind-node {')
    && read('/shared/styles/tokens.css').includes('--card-min-w')
    && read('/newtab/main.ts').includes("setAttribute('data-density', 'compact')")
    && read('/shared/models/index.ts').includes("density?: 'compact' | 'cozy'");
});

console.log('【第卅四轮 · V2.13 需求包第一批：REQ-030 撤销修复 + Toast 四套收敛】');
check('R34-1（V3.9.8 随迁）资源卡撤销仍按 id 定位当前真源：单卡删除/抽屉删除均按卡 id 找活卡；策展画布删除改为空分支软删，不再走卡片批量撤销链', () => {
  const d = read('/newtab/composables/useResourceDrawer.ts');
  const h = read('/newtab/composables/useCurationMindMap.ts');
  return d.includes('d.value.resources.find(x => x.id === r.id)')
    && d.includes('d.value.resources.find(x => x.id === editingResource.id)')
    && h.includes('node.deletedAt = Date.now()')
    && !read('/newtab/views/Workspace.vue').includes('natives.forEach(r => {');
});
check('R34-2 REQ-030 任务卡撤销按 id（单删 taskId + 批量删）+ 指标 taskIds 回填保留', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('d.value.tasks.find(x => x.id === taskId)') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('removed.forEach(t => {') && read('/newtab/components/compass/TaskManagerPanel.vue').includes('m.id === cur.metricId'));
check('R34-3 REQ-030 好奇心卡撤销按 id 定位当前树', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('d.value.curiosities.find(x => x.id === c.id)'));
check('R34-4 Toast 四套实现收敛为模块单例（toast.ts 统一 2.4s + App 全局唯一挂载；★G5(V3.8.27) 重指：3s → 2.4s）', () => read('/shared/components/toast.ts').includes('TOAST_DURATION = 2400') && read('/newtab/App.vue').includes('<Toast />') && !read('/newtab/views/GlobalSettings.vue').includes('gs-toast') && !read('/newtab/components/GlobalPopups.vue').includes('gp-toast') && !read('/newtab/views/GlobalSettings.vue').includes('toastVisible'));
check('R34-5 各组件不再持有本地 Toast 实例（ref/showToast 残留清零）', () => !read('/newtab/views/Workspace.vue').includes('toastVisible') && !read('/newtab/views/CompassHome.vue').includes('toast.value') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('toast.value') && !CT_ALL.includes('toast.value') && !read('/newtab/views/ProjectCuration.vue').includes('toast.value') && !read('/newtab/views/RecycleBin.vue').includes('toast.value') && !read('/newtab/components/TaskAddDrawer.vue').includes('toast.value'));

console.log('【第卅四轮 · V2.13 需求包第二批：REQ-027 分组分区视图 + 折叠增强】');
check('R34-6（R64 修订）卡片/列表分类分区：树状递归分组（walk 直属卡+子分类下钻 depth 缩进）', () => { const w = read('/newtab/views/Workspace.vue'); return w.includes('const resourceGroups') && w.includes("title: '待分类'") && w.includes('walk(sub.id, sub.name, depth + 1)'); });
check('R34-7（V3.9.8 随迁）分组折叠退役，画布用节点展开表达层级：子节点随父节点递归渲染，空分支/空画布各有独立主动作', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const host = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  return n.includes('v-if="children().length" class="mind-children"')
    && n.includes('<CurationMindNode v-for="child in children()"')
    && m.includes('v-if="thesis && !nodes.length"')
    && m.includes('v-if="!thesis"')
    && m.includes('action-label="＋ 新建论据分支"')
    && m.includes('action-label="＋ 写下中心论点"')
    && !host.includes('collapsedGroups');
});
/* V3.7.0（R179）退役 R34-8：卡面分类全路径徽标随 hub 分类退役（池语义，卡面组织=标签）；原断言锚 catIdx.pathOf(r.categoryId) 已改写并将于 R1-3 随分类树 UI 一并移除。 */
check('R34-9（V3.9.8 随迁）旧分区标题与折叠箭头退役，节点层级、选中态、搜索命中、证据缺口四类状态各自可见', () => {
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const css = read('/newtab/components/curation/curation.css');
  return n.includes('class="mind-level"')
    && n.includes("selected: selectedId === node.id")
    && n.includes("'search-hit': isHit()")
    && n.includes('class="evidence-gap"')
    && css.includes('.mind-node.selected') && css.includes('.mind-node.search-hit')
    && !read('/newtab/views/Workspace.vue').includes('ws-cat-head');
});

console.log('【第卅四轮 · V2.13 需求包第三批：REQ-028 分组视图联动规范】');
check('R34-10 REQ-028 F-028-1 分区内置顶排序（applyGroupSort = applySort + marksort 稳定重排）', () => read('/newtab/views/Workspace.vue').includes('function applyGroupSort') && read('/newtab/views/Workspace.vue').includes('markRank(b) - markRank(a)') && read('/newtab/views/Workspace.vue').includes("import { markRank }") && read('/newtab/views/Workspace.vue').split('applyGroupSort(').length - 1 >= 2);
check('R34-11 REQ-028 F-028-3 拖拽分区边界（跨分区改分类归属 + 轻提示；同分区局部排序）', () => read('/newtab/views/Workspace.vue').includes('function groupKeyOf') && read('/newtab/views/Workspace.vue').includes('crossGroup') && read('/newtab/views/Workspace.vue').includes('catChanged') && read('/newtab/views/Workspace.vue').includes('已移动至「'));
check('R34-12（V3.9.8 随迁）子层级视觉弱化由画布承担：L2-L4 层级徽标常驻、子分支类型说明与父节点区分，旧分区标题零回流', () => {
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const c = read('/newtab/components/curation/curation.css');
  return n.includes('class="mind-level"') && n.includes('class="mind-type"')
    && c.includes('.mind-level {') && c.includes('.mind-type {')
    && !read('/newtab/views/Workspace.vue').includes('.ws-cat-head.sub span');
});
check('R34-13（V3.9.8 随迁）列表分区拖拽规则退役，金字塔/树状两种布局共用同一套节点拖拽校验与落库路径，不复制第二套规则', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const h = read('/newtab/composables/useCurationMindMap.ts');
  return m.includes(':data-layout="layout"')
    && m.includes('function validate(sourceId: string, targetId: string)')
    && h.includes('function validateDrop(dragId: string, targetId: string)')
    && m.includes("emit('move', source, id)")
    && !read('/newtab/views/Workspace.vue').includes('onDropCard($event,r)');
});

console.log('【第卅四轮 · V2.13 需求包第四批：REQ-029 罗盘按需引导】');
check('R34-14 REQ-029 F-029-1 侧栏常驻三行文案移除（side-note 无残留）★R3-B1 随宿主改靶：方向台两面（树 + 项目详情）都不得回添', () => !CT_ALL.includes('side-note') && !read('/newtab/views/ProjectCuration.vue').includes('side-note') && !CT_ALL.includes('方向树给「为什么」'));
check('R34-15 退役（R49 方向台撤侧栏，气泡引导随撤）★R3-B1 随宿主改靶：树与项目详情两面均无残留', () => !CT_ALL.includes('guide-bubble') && !read('/newtab/views/ProjectCuration.vue').includes('zy_compass_guide_v1'));
check('R49 方向台满宽模块化（R117 重写 → ★R3-B1 收成一面）：方向台一级=完整方向树，主航线/项目总览/任务调度/MetricBar 全部不在台面内（各自去向：树层、调度台底部双 tab、调度台顶栏）', () => { const t = CT_ALL; return t.includes('方向台') && !exists('/newtab/views/CompassShell.vue') && !t.includes('LighthousePanel') && !t.includes('ov-grid') && !t.includes('TaskManagerPanel') && !t.includes('comp-sidebar') && !t.includes('MetricBar'); });

console.log('【第卅四轮 · V2.13 需求包第五批：REQ-031 系统性能调优】');
check('R34-17 REQ-031 P-031-1 搜索关联 Map 化（buildSearchMaps 一次遍历 + collectResults O(1) 查找 + 卡数累加）', () => read('/content/search-overlay.ts').includes('function buildSearchMaps') && read('/content/search-overlay.ts').includes('maps.wsName.get(r.workspaceId)') && read('/content/search-overlay.ts').includes('maps.projName.get(t.projectId)') && read('/content/search-overlay.ts').includes('maps.wsCount.get(w.id)'));
check('R34-18 REQ-031 P-031-2 结果分组一次遍历归桶（buckets 数组替代 filter+indexOf 嵌套）', () => read('/content/search-overlay.ts').includes("const buckets: Record<string, any[]>") && read('/content/search-overlay.ts').includes('buckets[r.type]') && read('/content/search-overlay.ts').includes('shown.forEach(function (item: any, j: number)') && read('/content/search-overlay.ts').includes('const i = offset + j'));
check('R34-19 REQ-031 P-031-3 计数缓存 + Tab DOM 按需重建（countCache 仅数据变更失效，searchType 不变只更计数）', () => read('/content/search-overlay.ts').includes('function invalidateCountCache') && read('/content/search-overlay.ts').includes('function computeCounts') && read('/content/search-overlay.ts').includes("tabs.getAttribute('data-search-type')") && read('/content/search-overlay.ts').includes('invalidateCountCache()'));
check('R34-20 REQ-031 P-031-4 escapeHtml 正则化（createElement → 正则白名单替换）', () => read('/content/search-overlay.ts').includes("String(s ?? '')\n    .replace(/&/g, '&amp;')") && !read('/content/search-overlay.ts').includes("const div = document.createElement('div')\n  div.textContent = s"));
check('R34-21 REQ-031 P-031-5 应用内搜索 150ms 防抖（debouncedQuery 驱动过滤，输入框即时回显）', () => read('/newtab/views/Workspace.vue').includes('const debouncedQuery = ref') && read('/newtab/views/Workspace.vue').includes('searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)') && read('/newtab/views/Workspace.vue').includes('if (debouncedQuery.value.trim())'));
check('R34-22 REQ-031 P-031-6 onChanged 自身写入跳过（R131-C1a 载荷 __wid O(1) 快路径 + R175 old/new 写戳复用核；R128-A1 统一接线不变）', () => {
  const r = read('/shared/storage/repository.ts')
  return r.includes('return oldWid === newWid')
    && r.includes('export function isStampReused')
    && r.includes('export function isSelfWrite')
    && r.includes('isSelfWrite(ext) && !isStampReused(dch)')
});
check('R34-23 REQ-031 P-031-7 定位并行化（Promise.all 并行询问 + 150ms 短超时取首个命中）', () => read('/background/index.ts').includes('await Promise.all(tabs.map') && read('/background/index.ts').includes('askRoute(tab.id, 150)') && read('/background/index.ts').includes('hits.find((t) => t !== null)'));
check('R34-24 REQ-031 P-031-8 采集去重 Map 化（capUrlMap 打开时构建一次 + 保存 O(1) 查重 + 增量写入）', () => read('/content/search-overlay.ts').includes('let capUrlMap: Map<string, any> | null = null') && read('/content/search-overlay.ts').includes('capUrlMap?.get(fp)') && read('/content/search-overlay.ts').includes('capUrlMap.set(nfp, resource)'));

console.log('【第卅五轮 · V2.14 需求包第一批：REQ-034 任务重复项修复】');
check('R35-1 REQ-034 根因：移除裸 Enter 双重 keydown（仅 ctrl/meta 触发一次保存）', () => !read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.enter.prevent="createTask"') && !read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.enter.prevent="linkTasks"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="createTask" @keydown.meta.enter.prevent="createTask"') && read('/newtab/components/TaskAddDrawer.vue').includes('@keydown.ctrl.enter.prevent="linkTasks" @keydown.meta.enter.prevent="linkTasks"'));
check('R35-2 REQ-034 提交锁防重复触发（createTask/linkTasks creating/linking 标志 + finally 解锁）', () => read('/newtab/components/TaskAddDrawer.vue').includes('if (creating) return') && read('/newtab/components/TaskAddDrawer.vue').includes('if (linking) return') && read('/newtab/components/TaskAddDrawer.vue').includes('creating = true') && read('/newtab/components/TaskAddDrawer.vue').includes('finally {'));
check('R35-3 REQ-034 渲染侧按 id 去重双保险 ★W11(V3.8.11)随迁带备案：方向台旧 seen 集合已退役，统一由 compassMeta 的 dedupeSorted / tasksOfProject / tasksOfMetric 收口（同 id 只算一次，否则 done+total 会大于项目实际任务数）。★V3.9.1 再随迁：项目详情不再自写 seen，改为直接复用唯一口径 tasksOfProject / tasksOfMetric；策展页保留自己的本地 seen。负锚仍守旧函数与抽屉内第二套去重实现不许回流', () => {
  const m = read('/newtab/views/compassMeta.ts'); const pd = read('/newtab/components/ProjectDetailDrawer.vue');
  return m.includes('seen.has(t.id)') && m.includes('export function tasksOfProject') && m.includes('export function tasksOfMetric')
    && !CT_ALL.includes('function tasksForMetric(') && read('/newtab/views/ProjectCuration.vue').includes('seen.has(t.id)')
    && pd.includes('tasksOfProject(project.value, d.value.tasks)') && pd.includes('tasksOfMetric(metric, d.value.tasks)')
    && !pd.includes('const seen = new Set<string>()');
});

console.log('【第卅五轮 · V2.14 需求包第二批：REQ-035 好奇心排序持久化】');
check('R35-4 REQ-035 模型新增 sortOrder 字段（CuriosityCard 拖拽排序持久化载体）', () => read('/shared/models/index.ts').includes('sortOrder?: number') && read('/shared/models/index.ts').includes('第卅五轮 REQ-035'));
check('R35-5 REQ-035 渲染管道 sortOrder 优先 createdAt 回退（filtered + kanbanCols 同口径）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('Number.MAX_SAFE_INTEGER') && read('/newtab/components/compass/CuriosityPanel.vue').split('Number.MAX_SAFE_INTEGER').length - 1 >= 2 && read('/newtab/components/compass/CuriosityPanel.vue').includes('markRank(b) - markRank(a)'));
check('R35-6 REQ-035 拖拽落位后全量重写 sortOrder（排序拖拽固化，跨列改状态不重写）', () => read('/newtab/components/compass/CuriosityPanel.vue').includes('if (!status)') && read('/newtab/components/compass/CuriosityPanel.vue').includes('list.forEach((c, i) => { c.sortOrder = i })'));

console.log('【第卅五轮 · V2.14 需求包第三批：REQ-032 直属未细分资源置顶】');
check('R35-7（R64 修订）直属卡先于子分类组（walk 内 direct push 在子分类递归之前）', () => { const src = read('/newtab/views/Workspace.vue'); const a = src.indexOf('if (direct.length) groups.push'); const b = src.indexOf('walk(sub.id, sub.name, depth + 1)'); return a >= 0 && b >= 0 && a < b; });

console.log('【第卅五轮 · V2.14 需求包第四批：REQ-036 任务状态筛选器】');
check('R35-8 REQ-036 模型 sortPrefs 扩展 filter 字段（状态筛选偏好持久化载体）', () => read('/shared/models/index.ts').includes("dir?: 'asc' | 'desc'; filter?: string"));
check('R35-9（R110 重指 · ★R3-Cc2 值域进 TASK_FILTERS 配置）REQ-036 状态筛选四枚举（全部/待办/推进中/已完成，移除高优先级与 today 混入）——R110 起过滤管线收敛到 applyTaskFilters', () => read('/newtab/components/compass/TaskManagerPanel.vue').includes('type TaskFilter') && read('/newtab/components/compass/TaskManagerPanel.vue').includes("else if (filterBy.value !== 'all') out = out.filter(t => t.status === filterBy.value)") && !read('/newtab/components/compass/TaskManagerPanel.vue').includes("filterBy.value === 'high'") && !read('/newtab/components/compass/TaskManagerPanel.vue').includes('option value="high"') && read('/newtab/components/compass/TaskManagerPanel.vue').includes("{ id: 'todo', label: '待办' }"));
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
check('R36-13 REQ-039-③ CompassTree 接 kind=project 抽屉总线', () => { const src = CT_ALL; return src.includes('onOpenDrawer') && src.includes("if (p.kind === 'project')"); });
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
check('R37-6/R49 路由 meta：home=调度台、一级=方向台（★R3-B1：树即一级，独立标题「完整方向树」随合并退役）、二级=项目详情、旧 actions 重定向 /', () => { const s = read('/newtab/router.ts'); return s.includes("title: '知源调度台 · 调度台'") && s.includes("title: '知源调度台 · 项目详情'") && s.includes("title: '知源调度台 · 方向台'") && !s.includes("title: '知源调度台 · 完整方向树'") && s.includes("path: '/compass/actions',"); });
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
