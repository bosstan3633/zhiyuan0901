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
