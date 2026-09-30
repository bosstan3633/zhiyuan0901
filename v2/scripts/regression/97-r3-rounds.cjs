/**
 * R174-1 分片纪律的延续 · 97-r3-rounds：V3.7.x 重构轮次（R3-F38 / R4-a / R3-B′ / R3-B1 / R3-B2 /
 * R3-Ca / R3-Cb / R3-Cc2）的断言。从 99-recent 尾部**原样搬出**（分片是搬运不是重写，断言零丢失）——
 * 搬的原因是 R164-2 的「每个分片 ≤900 行」刹车被这批新断言顶到了 914 行，
 * 按既有拍板处置是加分片而不是放宽上限。
 */
/**
 * R174-1 分片 · 99-recent：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');
console.log('【R3-F38 · 高亮可交互】');
check('R3-F38 ★仪表盘「👁 高亮可交互」开关三件齐全：页头工具条按钮 + UIPrefs.dzHl 持久化（saveUIPrefs，不是会话态）+ 面板根挂 dz-hl 类；CSS 走 outline 不占布局（圈出来不该把版面挤动）且色只取令牌', () => {
  const gs = read('/newtab/views/GlobalSettings.vue'), css = read('/newtab/components/dashboard/dashboard.css'), m = read('/shared/models/index.ts')
  return gs.includes('👁 高亮可交互') && gs.includes(':class="{ \'dz-hl\': dzHl }"') && gs.includes('saveUIPrefs({ dzHl: dzHl.value })')
    && m.includes('dzHl?: boolean')
    && css.includes('.dz-hl :is(') && css.includes('outline: 1px dashed var(--accent)') && css.includes('outline-offset: 1px')
    && !/\.dz-hl[^{]*\{[^}]*(#[0-9a-fA-F]{3,8}|rgba?\()/.test(css)
});
check('R3-F38 ★覆盖判据是硬核的：theme-audit 新增 dz-hl 场景，量「圈出数 == 面板内全部可点元素数」（差一个即红），并当场把开关关回去免得污染后续截图；未来日热力格是 disabled button，按"看得见但点不动"走虚点、不计入漏圈', () => {
  const a = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8')
  return a.includes("id: 'dz-hl'") && a.includes('outlined === marked.length') && a.includes('const marked = all.filter(e => !e.disabled)') && a.includes('btn.click()')
});

// ============== R4-a 迁移报告卡与整库回退出口 ==============
console.log('【R4-a · 迁移报告卡】');
check('R4-a ★迁移原语有了出口：设置页标签管理读 K.MIGRATE_REPORT + K.MIGRATE_BACKUP 出报告卡（统计 + 逐条映射清单 + 下载备份），restoreMigrateBackup 不再是零调用方（卡片组件化：GS 有 ≤3,560 行增长门禁 R164-2）；回退走 useConfirm 报数（备份时间/迁移前卡数 vs 当前卡数与任务数）', () => {
  const gs = read('/newtab/components/MigrateReportCard.vue'), pm = read('/shared/storage/poolMigration.ts'), host = read('/newtab/views/GlobalSettings.vue')
  return host.includes('<MigrateReportCard />') && gs.includes('K.MIGRATE_REPORT') && gs.includes('K.MIGRATE_BACKUP') && gs.includes('mg-card')
    && gs.includes('restoreMigrateBackup()') && gs.includes('readMigrateBackup()') && gs.includes('report.mapping')
    && gs.includes('async function rollback') && gs.includes('整库回退') && gs.includes('async function reRun')
    && pm.includes('export async function restoreMigrateBackup')
});
check('R4-a ★回退要停得住：回退同时落 K.MIGRATE_OPTOUT，启动期 stores/app.ts 以 hasMigrateOptOut() 守卫跳过整段池迁移（不清开关的话幂等落戳被清 = 下次启动原样再迁一遍，回退只活一次刷新）；UI 侧给「重新执行迁移」解除', () => {
  const pm = read('/shared/storage/poolMigration.ts'), ap = read('/newtab/stores/app.ts'), gs = read('/newtab/components/MigrateReportCard.vue'), k = read('/shared/storage/keys.ts')
  return k.includes("MIGRATE_OPTOUT: 'zy_migrate_optout'")
    && pm.includes('export async function setMigrateOptOut') && pm.includes('export async function hasMigrateOptOut')
    && ap.includes('const poolOptOut = await hasMigrateOptOut()') && ap.includes('if (!poolOptOut)')
    && gs.includes('setMigrateOptOut(true)') && gs.includes('setMigrateOptOut(false)') && gs.includes('重新执行迁移')
});

// ============== R3-B′ 方向台树：项目层折叠 + 卡头收敛 + 页头整合 ==============
console.log('【R3-B′ · 方向台树交互收敛】');
check('R3-B′ ★项目层折叠口径：主攻自动展开、非主攻折叠成卡头（caret 开合），折叠项目不再渲染其指标（不是 v-show 藏起来）；开合态是**会话记忆**走 sessionStorage 键（浏览态不进 UIPrefs，不随导出/同步跑掉）；⊞⊟ 两级一起管', () => {
  const t = read('/newtab/views/CompassTree.vue'), m = read('/shared/models/index.ts'), k = read('/shared/storage/keys.ts')
  return t.includes('function projOpen(') && t.includes('o === undefined ? !!p.isFocused : o')
    && t.includes('projOpen(proj) ? proj.metrics : []') && t.includes('function toggleProjectFold(')
    && t.includes('PROJ_FOLD_KEY = K.TREE_PROJ_FOLD_SS') && k.includes("TREE_PROJ_FOLD_SS: 'zy_tree_proj_fold_v1'")
    && !m.includes('treeProjFold') && t.includes('function collapseAllNodes') && t.includes('for (const proj of dir.projects) projFoldOverride.value[proj.id] = false')
    && t.includes('if (projOpen(proj)) expandMetricsOf(proj)')
});
check('R3-B′ ★卡头 6 入口收敛为「全景 / AI / ▾」：设主攻·添加指标·进详情·删除四项收进 .tp-menu（各自全文件只剩菜单里一处触发点），删除仍走 compassNodeCounts 报数 + useConfirm + 撤销（收敛不降防呆），点菜单外区域关闭', () => {
  const t = read('/newtab/views/CompassTree.vue')
  const once = (re) => (t.match(new RegExp(re, 'g')) || []).length === 1
  return t.includes('class="tp-menu"') && t.includes('🚀 设为主攻') && t.includes('＋ 添加成功指标') && t.includes('🗑 删除项目')
    && once('onToggleFocus\\(proj\\.id\\)') && once('addMetric\\(proj\\.id\\)') && once("deleteNode\\('proj'")
    && t.includes('toggleProjMenu(proj.id)') && t.includes('openProjectDrawer(proj.id)') && t.includes("aiChain('metrics', proj.id)")
    && t.includes('onDocClickCloseProjMenu') && t.includes("closest('.tp-acts')")
    && t.includes('compassNodeCounts') && t.includes('useConfirm')
});
check('R3-B′ ★目标级入口上收页头：＋添加战略目标 与 建议目标 在 tree-page-head（原埋第 3 层卡头），层内只留 badge + hint', () => {
  const t = read('/newtab/views/CompassTree.vue')
  const head = t.slice(t.indexOf('<div class="tree-page-head">'), t.indexOf('</div>\n\n      <!-- 画布'))
  const layer = t.slice(t.indexOf('<div class="tl-head-row">'), t.indexOf('<div v-if="!d.compass.directions.length"'))
  return head.includes('addDirection') && head.includes("aiChain('directions'") && !layer.includes('addDirection')
});
function pc0() { return read('/newtab/views/ProjectCuration.vue') }

// ============== R3-B1 方向台一级化：树即首屏 + CompassShell/LighthousePanel 退役 ==============
console.log('【R3-B1 · 方向台一级化（树即首屏）】');
check('R3-B1 ★路由一级化与老深链兼容：/compass 直挂方向树、/compass/projects 平铺成一级、/compass/tree 转成带 query 的重定向（老深链不许变死页）；CompassShell 与 LighthousePanel 物理不存在；App 级 keep-alive 同时缓存两面', () => {
  const r = read('/newtab/router.ts'), a = read('/newtab/App.vue')
  return r.includes("name: 'compass'") && r.includes("import('./views/CompassTree.vue')")
    && r.includes("path: '/compass/projects'") && r.includes("path: '/compass/tree'")
    && r.includes("redirect: to => ({ path: '/compass', query: to.query })")
    && !exists('/newtab/views/CompassShell.vue') && !exists('/newtab/components/compass/LighthousePanel.vue')
    && (a.match(/keep-alive include="([^"]+)"/) || [, ''])[1].split(',').filter(x => ['CompassTreeView', 'ProjectCurationView'].includes(x)).length === 2
});
check('R3-B1 ★退役不悬空（能力去向逐条点名；★R3-B2 拍板后置顶与排序已回归树内，不在本条清单里）：主航线实现（vm-bar/focus-bar/goals-grid/proj-row/proj-menu/ovFilter/toolsGate/CHIP_LIMIT）随宿主整体退役，三面全站零命中；读数改由树页头 treeStats（主攻/停滞）+ 卡头 tp-flag 承担，密度由 R3-B′ 折叠承担', () => {
  const t = read('/newtab/views/CompassTree.vue'), h = read('/newtab/views/CompassHome.vue'), pc = read('/newtab/views/ProjectCuration.vue')
  const gone = ['vm-bar', 'focus-bar', 'goals-grid', 'proj-row', 'proj-menu', 'ovFilter', 'toolsGate', 'CHIP_LIMIT']
  return gone.every(k => !t.includes(k) && !h.includes(k) && !pc.includes(k))
    && t.includes('⚠ 停滞 {{ treeStats.stalled }}') && t.includes('class="tp-flag"') && t.includes('🚀 主攻 {{ treeStats.focused }}')
});
check('R3-B1 ★修掉一条既存坏链：指标下钻「定位」原先只 dispatch zy-locate-goal（唯一监听者住在 /compass 主航线，而抽屉挂在调度台首页 ⇒ 点了什么都没发生）；改走 /compass?hl=<dirId> 深链由方向树 locateHlGoal 承接滚动+闪烁，事件链两端一起清零', () => {
  const md = codeOnly(read('/newtab/components/compass/MetricDrillDrawer.vue')), t = read('/newtab/views/CompassTree.vue')
  return !md.includes('zy-locate-goal') && md.includes("router.push({ path: '/compass', query: { hl: dirId } })")
    && t.includes('function locateHlGoal') && t.includes("route.query.hl")
    && !codeOnly(pc0()).includes('zy-open-project-detail') && !codeOnly(t).includes('zy-open-project-detail')
});
check('R3-B1 ★树担得起首屏：项目级读数走 projMeta 预计算表（模板内零逐项调 projectProgress/isProjectStalled、零模板内 filter 任务），一级页头不再自指（无「返回方向台」/tree-link/进入方向树 三类残留入口），UIPrefs.compassTab（二级页停留记忆）随合并退役', () => {
  const t = read('/newtab/views/CompassTree.vue'), tpl = segOf(t, '<template>', '\n</template>'), m = read('/shared/models/index.ts')
  return t.includes('const projMeta = computed(') && !tpl.includes('projectProgress(') && !tpl.includes('isProjectStalled(') && !tpl.includes('d.tasks.filter(')
    && !codeOnly(t).includes('返回方向台') && !codeOnly(t).includes('tree-link') && !codeOnly(t).includes('进入方向树')
    && !codeOnly(m).includes('compassTab')
});

// ============== R3-B2 方向树：同目标内手动拖拽排序 + 置顶（用户拍板回归） ==============
console.log('【R3-B2 · 方向树拖拽排序与置顶】');
check('R3-B2 ★拖拽只在同一战略目标内且所见即所得：⠿ 手柄 draggable → dragover 只在同 dir 且非自身时给落位指示（.drop-on 用 inset box-shadow，不许把版面挤动）→ drop 取「当前所见序」重排并逐位重写 order，落完清 pinned（否则排序键把它弹回前排＝看着拖不动）；跨目标 drop 直接 return（改归属是另一件事，走项目详情）', () => {
  const t = read('/newtab/views/CompassTree.vue')
  return t.includes('function onProjDragStart(') && t.includes('function onProjDragOver(') && t.includes('function onProjDrop(')
    && t.includes('draggable="true"') && t.includes('@dragover.prevent="onProjDragOver(dir.id, proj)"') && t.includes('@drop.prevent="onProjDrop(dir.id, proj)"')
    && t.includes('drag.dirId !== dirId') && t.includes('drag.id === target.id')
    && t.includes('list.splice(to, 0, moved)') && t.includes('list.forEach((p, i) => { p.order = i })') && t.includes('moved.pinned = false')
    && t.includes('.tp-head.drop-on { box-shadow: inset 0 2px 0 0 var(--accent); }') && !t.includes('.tp-head.drop-on { border')
});
check('R3-B2 ★排序键口径：主攻 → 置顶 → order（pinned 不是第二个排序真源而是"钉到非主攻组前排"的快捷方式，置顶时把 order 压到该组最小）；toggleProjectPin 落库 + toast，卡头 📌 徽标显式可见，▾ 菜单第五项进/出两态文案', () => {
  const t = read('/newtab/views/CompassTree.vue')
  return t.includes("(Number(b.isFocused) - Number(a.isFocused)) || (Number(!!b.pinned) - Number(!!a.pinned)) || ((a.order ?? 999) - (b.order ?? 999))")
    && t.includes('function toggleProjectPin(dir: Direction, p: Project)') && t.includes('p.order = minOrder - 1') && t.includes('store.persist()')
    && t.includes('class="tp-pin"') && t.includes('📌 置顶到本目标前排') && t.includes('☆ 取消置顶')
});

// ============== R3-Ca 池面板补齐：列表视图 / 待打标筛选 / 批量反选 / 右键菜单 ==============
console.log('【R3-Ca · 资源卡池面板补齐】');
check('R3-Ca ★两视图同一份数据源 + 待打标筛选：viewMode 存组件内 ref（与任务/好奇面板同口径，不单开持久化）；列表与网格都从 rendered（poolCards 分页切片）渲染，**不许复制第二份过滤链**；列表行同样带 data-rid/flash/picked（定位高亮与批量选择两视图等价）；无标签的行显式标出来；「🏷 待打标 N」是 R179 迁移承诺的兜底出口（无标签=任何筛选都召回不到）', () => {
  const t = read('/newtab/components/compass/PoolCardsPanel.vue')
  return t.includes("const viewMode = ref<'card' | 'list'>('card')") && t.includes('v-else-if="viewMode === \'list\'"') && t.includes('class="pcp-list"')
    && (t.match(/v-for="r in rendered"/g) || []).length === 2
    && t.includes('class="pcp-row"') && t.includes(':data-rid="r.id"') && t.includes('.pcp-card.flash, .pcp-row.flash')
    && t.includes('class="pcp-tag-none"') && t.includes('const onlyUntagged = ref(false)') && t.includes("{ id: 'untagged', label: '🏷 待打标', count: untaggedCount.value")
    && t.includes('const untaggedCount = computed(') && !t.includes('wsViewMode')
});
check('R3-Ca ★批量反选只在当前过滤结果内取反（★R3-Cb 收归 useBatchSelect，三面板共用同一份语义）：invert 遍历 visibleIds()（各面板传的是**当前过滤结果**，不是全量集合）——过滤态下"反选全量"会把看不见的卡卷进批量动作，而批量动作里就有删除', () => {
  const b = codeOnly(read('/newtab/composables/useBatchSelect.ts'))
  const p = read('/newtab/components/compass/PoolCardsPanel.vue'), t = read('/newtab/components/compass/TaskManagerPanel.vue'), c = read('/newtab/components/compass/CuriosityPanel.vue')
  return b.includes('function invert()') && b.includes('visibleIds().filter(id => !selected.value.has(id))') && !b.includes('store.data')
    && p.includes("useBatchSelect(() => poolCards.value.map(r => r.id))") && t.includes("useBatchSelect(() => filteredTasks.value.map(t => t.id))") && c.includes("useBatchSelect(() => filtered.value.map(c => c.id))")
});
check('R3-Ca ★右键菜单复用 ContextMenu 单根（不新写第二套菜单 DOM），四项动作全部复用既有函数：删除仍走 removeCard 的软删+撤销、置顶就地翻 pinned、复制链接走剪贴板且失败有提示', () => {
  const t = read('/newtab/components/compass/PoolCardsPanel.vue')
  return t.includes("import ContextMenu from '@/shared/components/ContextMenu.vue'") && t.includes('<ContextMenu :state="ctx" :items="ctxItems" @close="ctx.open = false" />')
    && t.includes('@contextmenu="openCtx($event, r)"') && t.includes('function openCtx(') && !t.includes('ctx-menu')
    && t.includes("cb: () => removeCard(r)") && t.includes("label: r.pinned ? '取消置顶' : '📌 置顶'") && t.includes('navigator.clipboard?.writeText')
});

// ============== R3-Cb 批量口径合一：三张卡共用一份选择与打标实现 ==============
console.log('【R3-Cb · 三面板批量选择与打标合一】');
check('R3-Cb ★批量选择唯一实现：三面板全部 import useBatchSelect，面板内不得再留第二份 selectAll / 自建 selected 容器（改前三份各写各的，任务与好奇的按钮文案写「全选/反选」而函数体只做满选↔清空）', () => {
  const p = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue')), t = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue')), c = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue'))
  const b = read('/newtab/composables/useBatchSelect.ts')
  return [p, t, c].every(x => x.includes("from '../../composables/useBatchSelect'"))
    && [p, t, c].every(x => !x.includes('function selectAll')) && [p, t, c].every(x => !x.includes('const selected: Ref<Set<string>> = ref') && !(x.match(/selected\w*(TaskIds)? = ref<Set<string>>/g) || []).length)
    && b.includes('export function useBatchSelect') && b.includes('export function addTagToCards') && b.includes('function setMode(on: boolean)')
});
check('R3-Cb ★批量栏在批量态即出现（不是"先选中才给你按钮"）★R3-Cc 收进 DeckBatchBar 一份：三面板一律 <DeckBatchBar v-if="batchMode">，全选/反选/应用标签在组件内且反选看 total、打标与应用看 size 才禁用，禁用态有 var(--opacity-disabled) 可见反馈（该样式必须由组件自带——scoped 边界下父面板的 .mini-btn:disabled 选不到子组件节点）', () => {
  const b = read('/newtab/components/compass/DeckBatchBar.vue')
  const t = read('/newtab/components/compass/TaskManagerPanel.vue'), c = read('/newtab/components/compass/CuriosityPanel.vue'), p = read('/newtab/components/compass/PoolCardsPanel.vue')
  return [t, c, p].every(x => x.includes('<DeckBatchBar v-if="batchMode"'))
    && b.includes(':disabled="!total"') && b.includes(':disabled="!size"') && b.includes('.dkb-bar button:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }')
    && [t, c].every(x => x.includes('.mini-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }'))
});
check('R3-Cb ★退出批量必须清空选择（三处同一句 setMode）：改前好奇面板退出批量不清空 selected，下一轮进来上一轮勾选还在而可见集合可能已变——批量动作里就有删除，那是"我以为没选"的误删配方', () => {
  const b = read('/newtab/composables/useBatchSelect.ts')
  const t = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue')), c = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue')), p = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'))
  return b.includes('if (!on) clear()') && [t, c, p].every(x => /set(Batch)?Mode\(!batchMode(\.value)?\)/.test(x))
    && !c.includes('batchMode = !batchMode')
});
check('R3-Cb ★三类卡批量打标签齐全且同一写入式（★R3-Cc：输入框与「回车应用」也在 DeckBatchBar 里，一处改三处生效）：三处都调 addTagToCards（只加不减、软删卡跳过、updatedAt 置当前），去标签一律回卡详情不在面板里做第二套编辑', () => {
  const b = read('/newtab/components/compass/DeckBatchBar.vue')
  const t = read('/newtab/components/compass/TaskManagerPanel.vue'), c = read('/newtab/components/compass/CuriosityPanel.vue'), p = read('/newtab/components/compass/PoolCardsPanel.vue')
  return b.includes('加一个标签，回车应用') && b.includes("@keydown.enter=\"apply\"")
    && t.includes('function batchAddTag(t: string)') && c.includes('function batchAddTag(t: string)') && p.includes('function applyTagToSelected(t: string)')
    && t.includes('addTagToCards(d.value.tasks') && c.includes('addTagToCards(d.value.curiosities') && p.includes('addTagToCards(store.data!.resources')
    && [t, c, p].every(x => x.includes('只加不减'))
});
check('R3-Cc ★批量栏唯一实现：三面板 import DeckBatchBar，面板内不得再留第二份「全选 / 反选 / 应用标签」DOM 或自建 tagDraft 输入（C-b 修掉的三条缺陷正是三份各写各的写出来的，留着三份就会再漂回去）；卡型专属动作走默认槽，不复制整栏', () => {
  const t = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue')), c = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue')), p = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'))
  return [t, c, p].every(x => x.includes("import DeckBatchBar from './DeckBatchBar.vue'"))
    && [t, c, p].every(x => !x.includes('>反选</button>') && !x.includes('应用标签</button>'))
    && [t, c, p].every(x => !x.includes('batchTagDraft') && !x.includes('tagDraft'))
    && t.includes('<DeckBatchBar') && c.includes('<DeckBatchBar') && p.includes('<DeckBatchBar')
});

// ============== R3-Cc2 控制行合一：DeckControls（用户拍板"形式上也要在一个组件里"） ==============
console.log('【R3-Cc2 · 三面板控制行合一】');
check('R3-Cc2 ★控制行唯一实现：三面板都渲染 DeckControls 且各带 data-panel 锚点，面板内不得再留第二份搜索框 / 视图切换 / 批量钮 / 下拉值域模板（`.pcp-toolbar`、`.view-tabs`、`.cz-filters`、`.mgr-actions`、`class="sel"` 全部零命中）', () => {
  const t = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue')), c = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue')), p = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'))
  const dc = read('/newtab/components/compass/DeckControls.vue')
  return [t, c, p].every(x => x.includes("import DeckControls from './DeckControls.vue'") && x.includes('<DeckControls panel='))
    && !t.includes('class="mgr-toolbar"') && !t.includes('class="view-tabs"') && !t.includes('class="search-box"') && !t.includes('class="mgr-actions"') && !t.includes('class="sel"')
    && !c.includes('class="cz-filters"') && !c.includes('class="cz-view-btn"') && !p.includes('class="pcp-toolbar"') && !p.includes('class="pcp-search"')
    && dc.includes(':data-panel="panel"')
});
check('R3-Cc2 ★差异是数据不是三份模板：三面板把值域以数组常量/computed 传入（TASK_VIEWS / TASK_FILTERS / TASK_SORTS / TASK_GROUPS / CURIO_VIEWS / curioFilters / poolViews / poolFilters），共用组件按固定顺序渲染 搜索→筛选→视图→排序→方向→分组→槽→计数→批量→新建', () => {
  const t = read('/newtab/components/compass/TaskManagerPanel.vue'), c = read('/newtab/components/compass/CuriosityPanel.vue'), p = read('/newtab/components/compass/PoolCardsPanel.vue')
  const dc = read('/newtab/components/compass/DeckControls.vue')
  const order = ['v-if="search"', 'v-if="filters.length"', 'v-if="views.length"', 'v-if="sorts.length"', 'v-if="sortDir"', 'v-if="groups.length"', '<slot />', 'name="count"', 'dk-batch', 'dk-new']
  let at = -1
  for (const k of order) { const i = dc.indexOf(k); if (i < 0 || i < at) return false; at = i }
  return t.includes('const TASK_VIEWS =') && t.includes('const TASK_FILTERS =') && t.includes('const TASK_SORTS =') && t.includes('const TASK_GROUPS =')
    && c.includes('const CURIO_VIEWS =') && c.includes('const curioFilters = computed(')
    && p.includes('const poolViews =') && p.includes('const poolFilters = computed(')
});

// ============== R4-Db · 旧世界清账：书签导入单路线合一 ==============
console.log('【R4-Db · 书签导入单路线合一】');
check('R4-Db ★书签导入唯一实现：全站只有一处书签解析器与一处根文件夹白名单，宿主零副本', () => {
  const bk = read('/newtab/composables/useBookmarkImport.ts');
  const hosts = ['/newtab/views/GlobalSettings.vue', '/newtab/views/Workspace.vue',
    '/newtab/components/compass/PoolCardsPanel.vue', '/newtab/composables/useWorkspaceImport.ts'];
  const dup = hosts.filter(f => codeOnly(read(f)).includes('function parseBookmarksHtml'));
  const imp = codeOnly(read('/newtab/composables/useWorkspaceImport.ts'));
  return bk.includes('function parseBookmarksHtml') && bk.includes('const BK_ROOT_NAMES = new Set(')
    && dup.length === 0 && !imp.includes('BK_ROOT_NAMES') && !imp.includes('bookmarkInput')
    && imp.includes('export function useWorkspaceImport(') && imp.includes('function handleBoardImport(');
});
check('R4-Db ★合一不是"留下活的那份"就完事：死链身上三处硬化必须搬进唯一实现，且绝不写隐藏池（★本条一律走 codeOnly——唯一实现的头注释为了讲清退役缘由点了池 id 的字面量，用裸 read 会让这条负判据恒假：R166 那条纪律第四次咬人，这次咬的是我自己刚写的判据）', () => {
  const bk = codeOnly(read('/newtab/composables/useBookmarkImport.ts'));
  return bk.includes('safeDecodeText(h3.textContent') && bk.includes('safeDecodeText(a.textContent')
    && bk.includes('find(c => !c.deletedAt && c.workspaceId === target.id')
    && bk.includes("'Bookmarks Toolbar'") && bk.includes("'移动书签'")
    && !bk.includes('CURATION_WS_ID') && bk.includes('assets: []') && bk.includes('return ids');
});
check('R4-Db ★书签入口只有设置页一枚，Workspace 台面不再挂着够不着的 parked input 与其弹窗样式', () => {
  const gs = read('/newtab/views/GlobalSettings.vue');
  const wc = codeOnly(read('/newtab/views/Workspace.vue'));
  const css = codeOnly(read('/newtab/views/workspace.css'));
  return gs.includes('ref="bookmarkInput"') && gs.includes('@click="bookmarkImport()"') && gs.includes('@change="onBookmarkFile"')
    && !wc.includes('bookmarkInput') && !wc.includes('accept=".html,.htm"')
    && !css.includes('.bk-hint') && !css.includes('.bk-item');
});

// ============== R4-Dc · 旧世界清账：附件卫生 keepIds 单源 + 破坏性入口必有门 ==============
console.log('【R4-Dc · 数据体检与附件卫生合流】');
check('R4-Dc ★keepIds 只有一个算式：两个清理入口共用一份实现，宿主不得再手写 keep 集合', () => {
  const bk = codeOnly(read('/newtab/composables/useWsAssetHygiene.ts'));
  const gs = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  return bk.includes('collectReferencedAssetIds(d.value)') && bk.includes('cleanupOrphanAssetsOf(d.value)')
    && gs.includes('collectReferencedAssetIds(all)') && gs.includes('cleanupOrphanAssetsOf(all)')
    && !bk.includes('new Set(referencedAssetIds.value)') && !gs.includes('cleanupOrphanAssets(keep)');
});
check('R4-Dc ★不可恢复的物理删除必须先数清再确认：设置页那枚「清理」钮此前单击即删（与 R146 给清空回收站补门同一条理由——同一张卡上「导出附件包」被写成完整备份，两个相邻动作给出相反的风险信号）', () => {
  const gs = read('/newtab/views/GlobalSettings.vue');
  const seg = gs.slice(gs.indexOf('async function cleanupOrphanAssetsAction'), gs.indexOf("watch(activePage, (p) => { if (p === 'export')"));
  return seg.includes('listOrphanAssetIds(') && seg.includes('await useConfirm({')
    && seg.includes('清理 ${orphans.length} 个') && seg.includes('if (!ok) return')
    && seg.indexOf('listOrphanAssetIds(') < seg.indexOf('cleanupOrphanAssetsOf(')
    && seg.includes('导出附件包');
});
check('R4-Dc ★只删 IndexedDB 本体的那条动作不许多写一遍主 JSON（AppData 一个字节没变 ⇒ persist 是纯开销）', () => {
  const seg = segOf(read('/newtab/composables/useWsAssetHygiene.ts'), 'async function onDrillCleanupOrphans', '\n  return {');
  return !seg.includes('store.persist()') && seg.includes('cleanupOrphanAssetsOf(d.value)');
});

// ============== R4-Dd · 旧世界清账：Airtable 标签列映射 ==============
console.log('【R4-Dd · Airtable 标签列映射】');
check('R4-Dd ★标签列名可配且按远端实际类型落值：数组流到写出处才来得及决定发什么（多选发数组、文本发分号串），且两种都无条件写含空值', () => {
  const a = read('/shared/storage/airtable.ts');
  const m = read('/shared/models/index.ts');
  return a.includes("export const DEFAULT_TAG_COLUMN = '\u6807\u7b7e'") && a.includes('export function tagColumnOf(')
    && a.includes('tags: string[]') && !a.includes("tags: (c.tags || []).join(';')") && !a.includes("tags: (r.tags || []).join(';')")
    && a.includes("tagType === 'multipleSelects' ? row.tags : row.tags.join(';')")
    && a.includes('[tagCol]: tagsCell') && !a.includes("if (row.tags) f[tagCol]")
    && a.includes('const { created: createdCols, fields: remoteFields } = await ensureColumns(state)')
    && m.includes('tagColumn?: string');
});
check('R4-Dd ★只读计算列当场报错中止，不推一批注定失败的记录；列名与实际类型每轮只读一次远端真值（不落地存类型，存了必与 Airtable 漂移）', () => {
  const a = read('/shared/storage/airtable.ts');
  const gs = read('/newtab/views/GlobalSettings.vue');
  const seg = a.slice(a.indexOf('const { created: createdCols'), a.indexOf('// 2) 远端索引'));
  return seg.includes("tagType === 'formula' || tagType === 'rollup' || tagType === 'lookup'")
    && seg.includes('throw new Error(') && seg.includes('只读计算列')
    && seg.includes("remoteFields.get(tagCol)?.type")
    && gs.includes('@change="applyTagColumn"') && gs.includes('st.tagColumn = atTagColumn.value.trim()')
    && !gs.includes('tagColumnType');
});
check('R4-Dd ★422 不等于「记录被删」：写值错误（INVALID_VALUE_FOR_COLUMN 等）不得触发自愈重建，否则一次类型不匹配会变成表里一批重复行', () => {
  const a = read('/shared/storage/airtable.ts');
  const seg = a.slice(a.indexOf('const isMissingRecord = (msg: string) =>'), a.indexOf('const createOne'));
  return !/\|422\|/.test(seg) && !/422\//.test(seg)
    && seg.includes('INVALID_VALUE_FOR_COLUMN') && seg.includes('record (was )?not found')
    && seg.includes('UNKNOWN_RECORD') && a.includes('isMissingRecord(batchMsg)') && a.includes('isMissingRecord(oneMsg)');
});

// ============== R4-De · 旧世界清账：池卡定位落点收进唯一算式 ==============
console.log('【R4-De · 池卡定位链路对齐】');
check('R4-De ★池卡不是 workspace 实体：定位落点必须由 resourceLocateRoute 一处算，zy-curation 一律落调度台卡池 tab（R2-④ 当年改了四处深链，漏了这个被四处共用的算式本身）', () => {
  const l = read('/shared/utils/locate.ts');
  return l.includes('export function resourceLocateRoute')
    && l.includes('workspaceId === CURATION_WS_ID')
    && l.includes("path: '/', query")
    && l.includes('hk: LOCATE_HK.resource')
    && l.includes('return { path: t.path, query: { hl: id, ...t.query } }')
    && !/return \{ path: `\/workspace\/\$\{r\.workspaceId\}`/.test(l);
});
check('R4-De ★三个消费端不再各自拼工作区路径：App 的 zy-locate 与 background 的 handleLocate 都走同一算式（两边各拼一次正是这次死链能活到今天的形状）', () => {
  const app = read('/newtab/App.vue');
  const bg = read('/background/index.ts');
  return app.includes('resourceLocateRoute(wsId)') && bg.includes('resourceLocateRoute(wsId)')
    && bg.includes('const target = route.path') && bg.includes('${hashQuery}')
    && !app.includes("path: `/workspace/${wsId}`, query: hl")
    && !bg.includes('const target = `/workspace/${wsId}`')
    && !bg.includes('?hl=${encodeURIComponent(hl)}');
});
check('R4-De ★采集后按 Enter 的落点不许是死页：savedWsId 自 R179 起恒为池 id，这条链路必须与检索侧同源（检索侧 R2-④ 已改靶、采集侧当时没跟上）', () => {
  const gp = codeOnly(read('/newtab/components/GlobalPopups.vue'));
  const seg = gp.slice(gp.indexOf('function openSavedBoard'), gp.indexOf('function openSavedBoard') + 400);
  return seg.includes("type: 'zy-locate-workspace'") && seg.includes('savedWsId.value')
    && gp.includes('savedWsId.value = r.workspaceId')
    && !gp.includes('/workspace/zy-curation');
});

// ============== R4-Df · 旧世界清账：手册口径对齐 V3.7.0 之后的真形状 ==============
console.log('【R4-Df · 手册重写（界面全景 / 快捷键表 / 退役模块说明）】');
// 命令清单的唯一真源是 manifest：手册与设置页里那些"几条无默认键命令"的说法一律从这里现算，
// 不许再手抄（ref-1 反复漂移的根因就是手抄一份命令清单与条数）。
function noKeyCmds() {
  const mf = read('/manifest.ts');
  const re = /'([a-z][a-z-]+)':\s*\{([\s\S]*?)\n    \}/g;
  const out = [];
  let mt = null;
  while ((mt = re.exec(mf))) {
    if (!mt[2].includes('suggested_key')) {
      const dd = (mt[2].match(/description: '([^']+)'/) || [])[1];
      if (dd) out.push(dd);
    }
  }
  return out;
}
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
check('R4-Df ★手册命令表必须跟 manifest 真值一致：无默认键的每条命令都要在手册里实名出现（少一条＝用户去 shortcuts 页找不到手册说的那条），两条已下架旧命令不许以"可分配清单"的形式回流。★不硬编码条数——名单与条数都从 manifest 现算，将来加/删命令时这条自动要求同步手册', () => {
  const m = read('/newtab/manual-data.ts');
  const noKey = noKeyCmds();
  return noKey.length === 6 && noKey.every(k => m.includes(k))
    && m.includes('chrome://extensions/shortcuts')
    && !m.includes('打开方向台 / 打开资源台 / 打开完整方向树 / 打开设置')
    && !m.includes('打开设置 / 方向台 / 资源台 / 完整方向树 / 任务调度 / 同步到 Airtable');
});
check('R4-Df ★应用内切台键位口径写对：1=调度台、2=方向台、3 起才是策展台（手册原写「1…N 各策展台，从 1 起按导航顺序计数」，与 App.vue switchToIndex 的 n-3 差两位——照手册按 Alt+1 会进第一个策展台而不是调度台）', () => {
  const m = read('/newtab/manual-data.ts');
  const a = read('/newtab/App.vue');
  return m.includes('1 = 调度台') && m.includes('2 = 方向台') && m.includes('3 起才是各策展台')
    && !m.includes('从 1 起按导航顺序计数') && a.includes('switchToIndex');
});
check('R4-Df2 ★手册改对了而界面在打对台＝白改：设置页用户可见文案不许把已退役台面/已下架命令写成现役功能，且那句「N 条无默认键命令」的 N 必须等于 manifest 现算值。★判据不写死"六"——将来增删一条命令，界面这句就得跟着改口；另加一条语境判据：设置页里每一枚「资源台」字样都必须落在"这东西已退役"的句子里，否则等于给用户指一个不存在的去处', () => {
  const gs = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const nk = noKeyCmds();
  const stray = [...gs.matchAll(/资源台/g)]
    .filter(x => !/退役|已删|旧世界/.test(gs.slice(Math.max(0, x.index - 14), x.index + 14)))
    .map(x => gs.slice(Math.max(0, x.index - 18), x.index + 18));
  return nk.length >= 1 && gs.includes(`${CN_NUM[nk.length]}条无默认键命令`)
    && stray.length === 0
    && !gs.includes('资源台：双击卡片打开链接') && !gs.includes('资源台工具条')
    && !gs.includes('含方向台/资源台/完整方向树/任务调度') && !gs.includes('资源台资源卡')
    && !gs.includes('方向台/资源台/完整方向树无默认键')
    && gs.includes('资源卡池控制行「批量」') && gs.includes('资源卡池资源卡');
});
check('R4-Df2 ★手册里五处"照做会走进死路"的事实订正必须在位且旧说法不许回流：撤销窗口 9 秒（不是 3 秒）、生命周期入口只有一个（不是三处 ⏳）、阈值是可配的（不是"本期固定 30/90"）、不再教用户去分配已下架的命令、没有"台面级入口"的旧句式。★这几条各钉一句曾经逐字教错的话——判据只核新说法在场且旧说法回不来，回潮即红', () => {
  const m = read('/newtab/manual-data.ts');
  return !m.includes('打开设置/方向台/资源台/完整方向树/任务调度')
    && !m.includes('「打开方向台」「打开资源台」') && !m.includes('直达项目调度模块')
    && m.includes('窗口 9 秒') && !m.includes('给 3 秒撤销')
    && m.includes('入口只有一个') && m.includes('阈值是可配的') && !m.includes('阈值本期固定');
});
check('R4-Df ★章节标题本身不许带退役物：手册目录是用户唯一的导航入口，标题写着「与资源台操作」「与项目调度」就等于在目录层许诺一个不存在的去处（正文改对了、目录还在骗人）', () => {
  const m = read('/newtab/manual-data.ts');
  const titles = [...m.matchAll(/\{ id: '[\w-]+', title: '([^']+)'/g)].map(x => x[1]);
  const banned = ['资源台', '项目调度', '项目总览', '主航线', '灯塔', '策展中心'];
  return titles.length === 24 && titles.every(t => !banned.some(b => t.includes(b)))
    && titles.some(t => t.includes('资源卡池')) && titles.some(t => t.includes('三大台面'));
});
check('R4-Df ★退役结构不许作为现役功能写回手册：资源台台面 / 主航线 / 项目总览 / 项目调度面板 / 今日记录四格 / 策展主题格 六件各自点名，且手册必须明说它们去哪了（只删不说＝用户按旧记忆找而手册沉默，等于没写）', () => {
  const m = read('/newtab/manual-data.ts');
  return m.includes('资源卡没有台面') && m.includes('唯一管理面是调度台底部默认打开的「资源卡池」tab')
    && m.includes('一级就是完整方向树') && m.includes('这块面板已退役')
    && m.includes('已整体退役，调度台现在') && m.includes('三格辅助条')
    && !m.includes('资源台：资源卡真身的唯一居所') && !m.includes('主航线（R52 全量呈现）')
    && !m.includes('项目总览</b>：满宽三列卡') && !m.includes('5 指标条')
    && !m.includes('🏛 策展主题（R67 起');
});

// ============== R4-Df3 · 报告卡落点归池（D-f2 收尾时撞出来的巧合落点） ==============
console.log('【R4-Df3 · 报告卡落点与地名（hubDeck 巧合退役）】');
check('R4-Df3 ★报告卡落点不许靠"找 kind===resource 的 workspace 实体"这种巧合：唯一写法是 CURATION_WS_ID 常量 + categoryId 恒空（与 R2-⑧ 新建入池同一条池不变量），hubDeck 那类算式不许回流。★成因：那枚实体只在存量库里存在（R61 migrateHubStructure 建的，store getter 过滤掉了但原始数组还在）⇒ 旧写法在老库"看起来是对的"，而 defaults.ts 新建库根本不建它 ⇒ 新库第一条报告卡会掉进第一张策展台，回执还写着台面旧名', () => {
  const rp = codeOnly(read('/shared/ai/reports.ts'));
  return rp.includes("import { CURATION_WS_ID } from '@/shared/models'")
    && rp.includes('workspaceId: CURATION_WS_ID') && rp.includes("categoryId: ''")
    && rp.includes("export const REPORT_TAG = 'AI 报告·待审阅'")
    && !rp.includes('hubDeck') && !rp.includes('d.workspaces') && !/kind\s*===\s*'resource'/.test(rp)
    && rp.includes('资源卡池 › 待分类') && !rp.includes('资源台 › 待分类')
    && (rp.match(/资源卡池 › 待分类/g) || []).length === 2;
});
check('R4-Df3 ★把 D-f2 给设置页加的语境判据扩到手册：手册里每一枚「资源台」字样都必须落在"这东西已退役"的句子里（前后 20 字内要有退役/作废/早期/曾经/下架/移除/不许/旧词），并且「资源台 › 待分类」这个地名在手册与代码两侧都不许回流。★这条正是抓出 ai-1:342 那一处的手法——枚举"我改过的串"抓不到没改的，语境判据不依赖事先想到', () => {
  const m = read('/newtab/manual-data.ts');
  const rp = codeOnly(read('/shared/ai/reports.ts'));
  const ctxOk = (seg) => /退役|作废|早期|曾经|下架|移除|不许|旧词/.test(seg);
  const stray = [...m.matchAll(/资源台/g)]
    .filter(x => !ctxOk(m.slice(Math.max(0, x.index - 20), x.index + 20)))
    .map(x => m.slice(Math.max(0, x.index - 24), x.index + 24));
  return stray.length === 0 && m.includes('资源卡池 › 待分类') && !m.includes('资源台 › 待分类')
    && !rp.includes('资源台 › 待分类');
});

// ============== R4-Dg · 池的显示名单源（顺带修「导出 Markdown 整批漏池卡」） ==============
console.log('【R4-Dg · workspaceId→展示名 单源 + 导出按卡分组】');
check('R4-Dg ★wsName.ts 是 workspaceId→展示名 的唯一口径：wsNameById 必须**先判池再落实体**（顺序反了就会拿到 R61 留下的历史名「资源台」，新库则根本没有那枚实体），POOL_DISPLAY_NAME 全站只在这一处定义，剥图标仍走 wsDisplayNameOf', () => {
  const n = codeOnly(read('/shared/utils/wsName.ts'));
  const iPool = n.indexOf('if (id === CURATION_WS_ID) return POOL_DISPLAY_NAME');
  const iFind = n.indexOf('wsDisplayNameOf((workspaces || []).find');
  return iPool > 0 && iFind > iPool
    && n.includes('export function wsNameById') && n.includes("export const POOL_DISPLAY_NAME = '资源卡池'")
    && n.includes('export function wsDisplayNameOf') && count('/shared/utils/wsName.ts', 'export const POOL_DISPLAY_NAME') === 1
    && !n.includes("|| '资源台'");
});
check('R4-Dg ★十一个消费点不许再各自把 workspaceId 翻成台名：全部走 wsNameById / POOL_DISPLAY_NAME，ad-hoc 取法（裸 .name 拼兜底、find(w => w.id === id)?.name、把池写成「资源台」字面量）一律不许回流。★成因不是难看：存量库里那枚 id=zy-curation 的实体名还叫「资源台」（R61 建、store getter 过滤但原始数组还在），照实体取名＝把用户指向退役台面；新库没有那枚实体，照实体取名＝显示「未知」', () => {
  const files = ['/newtab/components/GlobalPopups.vue', '/newtab/views/RecycleBin.vue', '/newtab/components/compass/NorthStarPanel.vue',
    '/content/overlay-impl.ts', '/shared/ai/project.ts', '/shared/ai/govern.ts', '/newtab/views/Workspace.vue',
    '/newtab/views/GlobalSettings.vue', '/newtab/composables/usePyramid.ts', '/newtab/views/CompassTree.vue', '/shared/ai/taskSupport.ts'];
  const bad = files.filter(f => { const c = codeOnly(read(f)); return !(c.includes('wsNameById') || c.includes('POOL_DISPLAY_NAME')) });
  const gp = codeOnly(read('/newtab/components/GlobalPopups.vue'));
  const ns = codeOnly(read('/newtab/components/compass/NorthStarPanel.vue'));
  const ov = codeOnly(read('/content/overlay-impl.ts'));
  const ct = codeOnly(read('/newtab/views/CompassTree.vue'));
  const py = codeOnly(read('/newtab/composables/usePyramid.ts'));
  const ts = codeOnly(read('/shared/ai/taskSupport.ts'));
  return bad.length === 0 && !gp.includes('ws?.name ||') && !ns.includes('find(w => w.id === id)?.name')
    && !ov.includes("w.name || '未知'") && !ct.includes("'资源台'") && !py.includes("'资源台'") && !ts.includes("'资源台'");
});
check('R4-Dg ★导出 Markdown 必须按**卡**分组，不许再按 workspace 实体 + 该台分类两层枚举：池卡在新库里没有实体、且 categoryId 恒空（R179 起标签独任组织），旧两层 for 会把用户的全部资源卡静默漏出导出物（★这不是命名问题，是数据缺失——而它此前只有源码文本可见，E2E-36 真点一次导出并读导出物本体）', () => {
  const gs = codeOnly(read('/newtab/views/GlobalSettings.vue'));
  const iFn = gs.indexOf('function exportMarkdown');
  const seg = gs.slice(iFn, gs.indexOf('function dateStr', iFn));
  return iFn > 0 && seg.includes('byWs.get(r.workspaceId)') && seg.includes('for (const [wsId, cards] of byWs)')
    && seg.includes("catMap.get(catId) || '待分类'") && seg.includes('wsNameById(d.workspaces, wsId)')
    && !seg.includes('for (const ws of d.workspaces)') && !seg.includes('r.workspaceId === ws.id');
});

// ============== R4-Dh · 设置页输入框补齐（.gs-input 是一条全站无定义的死类名） ==============
console.log('【R4-Dh · .gs-input 定义与深色主题观感】');
check('R4-Dh ★`.gs-input` 必须有自有规则且全部取令牌：此前全站只有三处 `.ai-field .gs-input` 这类复合选择器改宽度/字号，**没有一条 .gs-input 本体规则** ⇒ 四主题实测这排输入框吃浏览器默认（底色 rgb(255,255,255)、黑字、2px 灰框），在 linear/raycast 两个深色主题里是白块，其中一枚是 PAT 凭据框。★判据核"取令牌"而不是核"不许白"，因为 apple/notion 的令牌底色本来就是白——只看计算样式会两样都对', () => {
  const gs = read('/newtab/views/GlobalSettings.vue');
  const i = gs.indexOf('.gs-input {');
  const rule = i < 0 ? '' : gs.slice(i, gs.indexOf('}', i));
  return i > 0 && rule.includes('var(--surface)') && rule.includes('var(--text)')
    && rule.includes('var(--border)') && rule.includes('var(--fs-sub)') && rule.includes('font-family: inherit')
    && gs.includes('.gs-input:focus') && gs.includes('var(--accent)')
    && gs.includes('.gs-input::placeholder') && gs.includes('var(--text-4)')
    && gs.indexOf('.gs-input {') < gs.indexOf('.gs-select {');
});
check('R4-Dh ★视觉门禁必须真的在量这件事：theme-audit 的 st-airtable 场景要把输入框底色与所在卡片底色对比（同取 var(--surface)），并把 PAT 框纳入取样——这条场景改动若被悄悄删掉，回归与截图都不会红，只有这一条会', () => {
  const t = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8');
  const seg = t.slice(t.indexOf("id: 'st-airtable'"), t.indexOf("id: 'st-manual'"));
  return seg.includes('cardBg') && seg.includes('offToken.length === 0') && seg.includes('input[type="password"]')
    && seg.includes('与卡同色');
});

// ============== R4-Di · 推给 Airtable 的台名列也走单源（用户拍板：值改「资源卡池」） ==============
console.log('【R4-Di · Airtable「所属工作台」列值 = 资源卡池】');
check('R4-Di ★池卡推给 Airtable 的「所属工作台」列值必须走显示名单源，不许再取那枚历史实体的名字：改前 `hubName = d.workspaces.find(w => w.id === CURATION_WS_ID)?.name || \'资源台\'` 有两个错法——存量库里那枚实体（R61 建、store getter 过滤）名字仍叫「资源台」，推过去的就是已退役的台面名，而设置页同步范围早就写着「资源卡池资源卡」，界面与数据互相打脸；新库没有那枚实体，只剩兜底字面量。★值口径变更由用户 2026-10-01 拍板（代价：Base 里按该列筛选/分组/着色的视图需同步改条件，已在交付说明点名）', () => {
  const a = codeOnly(read('/shared/storage/airtable.ts'));
  return a.includes("import { POOL_DISPLAY_NAME } from '../utils/wsName'")
    && a.includes('const hubName = POOL_DISPLAY_NAME') && a.includes("wsName: hubName")
    && !a.includes("?.name || '资源台'") && !a.includes("'资源台'")
    && a.includes('if (r.workspaceId === CURATION_WS_ID)');
});

// ============== R4-Ea（挂账 #84）· 浏览器回落链合一 ==============
console.log('【R4-Ea · scripts/browser.cjs 是浏览器解析的唯一实现】');
check('R4-Ea ★四级回落链只允许一份实现（scripts/browser.cjs）：pinned → ZY_CHROME → 本机任一 ms-playwright Chromium → 系统 Chrome，顺序不许倒（系统 Chrome 的旧 headless 起不了 MV3 service worker，缓存必须优先）。★起因不是洁癖：这条链此前在 7 个门禁脚本里各抄一份，抄出来的那份 img-diff 只写死 chromium-1234，Playwright 缓存换版本后它直接起不来（实测报错：executable doesn exist at …/chromium-1234/…），而它是 R161 用来回答"这次到底改了像素没有"的工具，坏掉没有任何门禁会红', () => {
  const b = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'browser.cjs'), 'utf8');
  const iPin = b.indexOf('for (const p of pinnedCandidates())');
  const iEnv = b.indexOf("if (process.env.ZY_CHROME)");
  const iCache = b.indexOf('const cached = anyCachedChromium()');
  const iSys = b.indexOf('const sys = systemChrome()');
  return b.includes('module.exports = { CHROME, resolveChromium, cacheRoot }')
    && iPin > 0 && iEnv > iPin && iCache > iEnv && iSys > iCache
    && b.includes('chrome-win64') && b.includes('chrome-linux') && b.includes('chrome-mac-arm64')
    && b.includes('chromium-1234') && !b.includes('process.argv');
});
check('R4-Ea ★七个用浏览器的门禁脚本必须都从 browser.cjs 取，且不许再自己拼 ms-playwright 路径（剥注释判定——browser.cjs 的缘由注释里就要写这些字面量，裸读会自匹配）：e2e / perf / perf-census / probe-f / theme-audit / test-import-compat / img-diff', () => {
  const files = ['e2e.cjs', 'perf.cjs', 'perf-census.cjs', 'probe-f.cjs', 'theme-audit.cjs', 'test-import-compat.cjs', 'img-diff.cjs'];
  const bad = files.filter(f => {
    const src = fs.readFileSync(path.resolve(SCRIPTS_DIR, f), 'utf8');
    return !src.includes("require('./browser.cjs')") || codeOnly(src).includes('ms-playwright');
  });
  return bad.length === 0 && files.every(f => fs.existsSync(path.resolve(SCRIPTS_DIR, f)));
});
