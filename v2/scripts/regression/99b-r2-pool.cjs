/**
 * R174-1 分片纪律的延续 · 99b-r2-pool：由 99-recent.cjs 第 705 行**原样搬出**（分片是搬运不是重写，
 * 断言零丢失零改写）——搬的原因是 99 已被顶到 896 行，贴死 R164-2 的「单片 ≤900 行」刹车，再加一条即破闸；
 * 按既有拍板处置是**加分片而不是放宽上限**。
 * 内容：R2 第二批池语义收尾（死链改靶 / 调出记账 / 论证卡回收站族）、R2-⑦ 热度写通道修复、
 * R2-⑧ 池管理面收编、W2 热力图迁调度台、W3 ⌘K 浏览态双 Tab。
 * 切点落在 R2 第二批的注释块起始行（★纪律：切片起点必须落在注释块而非代码行，否则恒假红）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, srcFileEntries, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');
// ============== R2 第二批 · 池语义收尾（死链改靶 / 调出记账 / 论证卡回收站族） ==============
console.log('【R2 第二批 · 池语义收尾】');
check('R2-④ ★死链族全站清零：`/workspace/zy-curation` 自 R179 起恒落 Workspace「策展台不存在」死页，四处深链（⌘K locateOnly / content 浮层 resLocateRoute / AI 面板 panel.route ×4 / 仪表盘 R6 归因）全部改靶，代码内该路由字面量零残留（注释留痕说明改靶缘由，故走 codeOnly 剥注释判定）', () => {
  const gp = codeOnly(read('/newtab/components/GlobalPopups.vue')), ov = codeOnly(read('/content/overlay-impl.ts'))
  const rg = codeOnly(read('/shared/ai/jobs/registry.ts')), dr = codeOnly(read('/newtab/composables/useDashboardReport.ts'))
  return !gp.includes('/workspace/zy-curation') && !ov.includes('/workspace/zy-curation') && !rg.includes('/workspace/zy-curation') && !dr.includes('/workspace/zy-curation')
    && gp.includes('if (r.workspaceId === CURATION_WS_ID)') && gp.includes("hk: 'res'")
    && ov.includes('function resLocateRoute') && ov.includes('r.workspaceId === CURATION_WS_ID')
    && rg.includes("route: '/'") && dr.includes("R6: ['/', '资源卡池']")
});
check('R2-④ ★池面板是 `?hl&hk=res` 的真消费者，且守「hk 指明别的卡型就让路」纪律（R152 那类抢消费权的 bug 不再复发）；定位不清过滤即落空 ⇒ 先清 query，命中走 data-rid + flash', () => {
  const p = read('/newtab/components/compass/PoolCardsPanel.vue')
  return p.includes("watch(() => route.query.hl") && p.includes("if (hk && hk !== 'res') return")
    && p.includes('query.value =') && p.includes(':data-rid="r.id"') && p.includes('highlightId === r.id')
    && p.includes('@keyframes pcp-flash') && p.includes('router.replace({ path: route.path })')
    && p.includes("emitOpenDrawer({ kind: 'res', id: r.id })")
});
check('R2-⑤ ★「调出」记账两宿主合一：App 级抽屉 openFromId 与内联宿主 openResource 同口径（打开详情即一次调出 + 热度小载荷落盘），池卡不再系统性漏计热力图/复盘的调出维度', () => {
  const r = read('/newtab/components/ResourceDetailDrawer.vue'), u = read('/newtab/composables/useResourceDrawer.ts')
  const i0 = r.indexOf('function openFromId'), i1 = r.indexOf('function close()')
  const seg = i0 > 0 && i1 > i0 ? r.slice(i0, i1) : ''
  return seg.includes('recordResourceOpen(data, r)') && seg.includes('store.persistHot()')
    && u.includes('recordResourceOpen(d.value, r)') && u.includes('单击打开详情 = 一次调用')
});
check('R2-⑤ ★论证卡进回收站族（R1.5 硬删旁路退役）：软删 + 撤销 toast 不弹确认、台内呈现过滤 deletedAt、purge 引擎与 recycledCardsOf 双纳 argCards、回收站第五分区可恢复可永久删除', () => {
  const u = read('/newtab/composables/useResourceDrawer.ts'), pu = read('/shared/storage/purge.ts'), rb = read('/newtab/views/RecycleBin.vue')
  const i0 = u.indexOf('function deleteArgument'), i1 = u.indexOf('const argCardsOfWs')
  const seg = i0 > 0 && i1 > i0 ? u.slice(i0, i1) : ''
  return seg.includes('live.deletedAt = Date.now()') && !seg.includes('useConfirm') && seg.includes("label: '撤销'")
    && u.includes('a.workspaceId === workspaceId.value && !a.deletedAt')
    && pu.includes('argCards?: ArgumentCard[]') && pu.includes('d.argCards = (d.argCards || []).filter') && pu.includes('argCards: (d.argCards || []).filter(a => a.deletedAt)')
    && rb.includes('function restoreArg') && rb.includes("purgeWith('论证卡'") && rb.includes('<Icon name="compass"')
});

// ============== R2-⑦ 热度写通道修复（persistHot 空转的两层病根） ==============
console.log('【R2-⑦ · persistHot 真落盘】');
check('R2-⑦ ★热度写通道两层病根都在位修：① set 必须绑回 StorageArea 接收者（摘成裸引用即 Illegal invocation，被静默 catch 吞成全站 persistHot 空转）；② payload 必须净化 reactive 主树摘下的 stats（Vue Proxy 过不了结构化克隆 → DataCloneError，①修好后才暴露）', () => {
  const h = read('/shared/storage/hotStats.ts')
  const seg = h.slice(h.indexOf('function store('), h.indexOf('let hotTimer'))
  const ex = h.slice(h.indexOf('export function extractHot'), h.indexOf('export function applyHot'))
  return seg.includes('set.call(area, o)') && !/return typeof set === 'function' \? set : null/.test(seg)
    && ex.includes('JSON.parse(JSON.stringify(') && ex.includes('DataCloneError')
    && h.includes("import { takeEventLogPatch } from '@/shared/utils/eventLog'")
});
check('R2-⑦ ★调出事件不再等整库保存：writeHot 的 set 载荷并入 takeEventLogPatch()（无待写事件时返回 null，零额外开销），与 repository.saveData 同一条「一次动作 = 一次 IPC」口径', () => {
  const h = read('/shared/storage/hotStats.ts')
  const fire = h.slice(h.indexOf('const fire = ()'), h.indexOf('if (immediate) fire()'))
  return fire.includes('takeEventLogPatch()') && fire.includes('[HOT_KEY]: extractHot(d)')
});

// ============== R2-⑧ 池管理面收编（新建 / 本地导入入口 / 批量 / 增量渲染） ==============
console.log('【R2-⑧ · 池管理面收编】');
check('R2-⑧ ★控制行四件套在位且导入口径与旧宿主一致：新建卡 / 导入本地文件（accept 串逐字同 R80-6 那份，选了不支持的类型不会静默吞）/ 批量开关 / 计数', () => {
  const p = read('/newtab/components/compass/PoolCardsPanel.vue')
  return p.includes('＋ 新建卡') && p.includes('<Icon name="inbox"') && p.includes('导入本地文件') && p.includes('function toggleBatch')
    && p.includes('accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.avif,.ico,.html,.htm,.pdf,application/pdf,text/html"')
    && p.includes('fileImport()') && p.includes('handleFileImport')
});
check('R2-⑧ ★新建仍守池语义不变量：新卡 workspaceId=CURATION_WS_ID + categoryId 留空（标签独任组织，R179 已删分类控件）+ id 走 uid 前缀 rc，绝不再产出台内资源卡', () => {
  const p = codeOnly(read('/newtab/components/compass/PoolCardsPanel.vue'))
  return p.includes("workspaceId: CURATION_WS_ID, categoryId: ''") && p.includes("uid('rc')")
    && p.includes('store.data!.resources.unshift(card)') && !p.includes('workspaceId: workspaceId.value')
});
check('R2-⑧ ★批量口径（★R3-Cb 实现上收到 useBatchSelect/addTagToCards 一份，口径不变）：打标签只加不减（去标签回卡详情，面板里不得有第二套标签编辑）· 批量删除走软删带撤销不弹确认（与单卡/全站一致）', () => {
  const p = read('/newtab/components/compass/PoolCardsPanel.vue'), b = read('/newtab/composables/useBatchSelect.ts')
  return b.includes('Array.from(new Set([...(it.tags || []), t]))') && p.includes('addTagToCards(') && p.includes('只加不减')
    && p.includes('r.deletedAt = now') && p.includes("label: '撤销'") && !p.includes('useConfirm')
});
check('R2-⑧ ★增量渲染上限立住：默认一屏 60 张 + 滚动到底自动追加（IntersectionObserver rootMargin 240px）+ 手动「加载更多」兜底；?hl 定位会先把目标卡纳入渲染范围（否则分页之外滚不到）', () => {
  const p = read('/newtab/components/compass/PoolCardsPanel.vue')
  return p.includes('const PAGE = 60') && p.includes('new IntersectionObserver') && p.includes("rootMargin: '240px'")
    && p.includes('function renderMore()') && p.includes('visibleCount.value = Math.max(visibleCount.value')
    && p.includes('poolCards.value.slice(0, visibleCount.value)')
});

// ============== W2 ★热力图迁调度台（V3.8.2） ==============
console.log('【W2 · 热力图迁调度台】');
check('W2-1（V3.9.1 重指）热力图与 FocusDetail 均不常驻调度台：今日战报由 TodayBattleHost 自包含承载，首页只保留三件事工作单与手边卡预览，读日志仍只在宿主内', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const iH = ch.indexOf('<TodayBattleHost ref="battleHost" />');
  const iF = ch.indexOf('class="work-board"');
  const iC = ch.indexOf('class="hand-board"');
  return ch.includes("import TodayBattleHost from '../components/dashboard/TodayBattleHost.vue'")
    && !ch.includes('HeatmapModule') && !ch.includes('<FocusDetail')
    && iH > 0 && iF > 0 && iC > 0
    && iH > iF && iH > iC
    && !/readEventLog/.test(ch)
});
check('W2-2 ★GlobalSettings 不再挂热力图：无 Heatmap import / 无 <Heatmap> 模板 / 无 onDashOpenLog（日详情「查看全部记录」迁 HeatmapModule.onOpenLog）——★W9 再随迁带备案：本条原还要求「概览带 + 复盘段 + 操作记录保留」在 GlobalSettings 里，而这三样已随 V3.8.7 整块迁画像洞察页；负锚三条继续钉在 GS 上（热力图与 onDashOpenLog 都不许搬回设置页），正锚改指新宿主 ProfileInsights（dashYear/dashSelDay/dashStats + <ReviewPanel> + openLog(），能力一项未减', () => {
  const gs = read('/newtab/views/GlobalSettings.vue');
  const pi = read('/newtab/views/ProfileInsights.vue');
  const gc = codeOnly(gs);
  return !gs.includes("import Heatmap from")
    && !gs.includes('<Heatmap')
    && !gs.includes('onDashOpenLog')
    && !gc.includes('dashYear') && !gc.includes('dashSelDay') && !gc.includes('dashStats')
    && !gc.includes('<ReviewPanel') && !gc.includes('openLog(')
    && pi.includes('dashYear') && pi.includes('dashSelDay') && pi.includes('dashStats')
    /* ★W13-D5 再随迁带备案 2026-10-16：正锚原要求宿主挂 <ReviewPanel>——随复盘弹窗退役改钉
       openLog（能力去向：复盘数据引擎 reviewReport 仍在共享层，宿主挂载负锚见 R172-10） */
    && !codeOnly(pi).includes('<ReviewPanel')
    && pi.includes('openLog(');
});
check('W2-3 ★HeatmapModule 自包含宿主：useAppStore + gResLive/gTaskLive/gCurioLive + linkCardCount + readEventLog + derivedEvents 回退 + timelineEvents + useDashboardStats + dashYear/dashSelDay/dashStats + onOpenLog 开 DashboardLogDrawer', () => {
  const hm = read('/newtab/components/dashboard/HeatmapModule.vue');
  return hm.includes('useAppStore') && hm.includes('gResLive') && hm.includes('gTaskLive') && hm.includes('gCurioLive')
    && hm.includes('linkCardCount') && hm.includes('readEventLog') && hm.includes('derivedEvents')
    && hm.includes('timelineEvents') && hm.includes('useDashboardStats')
    && hm.includes('dashYear') && hm.includes('dashSelDay') && hm.includes('dashStats')
    && hm.includes('onOpenLog') && hm.includes('logOpen') && hm.includes(':preset="logPreset"')
    && hm.includes('<Heatmap')
    && hm.includes('DashboardLogDrawer');
});
check('W2-4 ★W12-D 退役重指带备案：日详情中央弹窗的 Teleport + overlay/modal 两样式 + CSS 三条一字未改，只是宿主从 Heatmap.vue 迁到 TodayBattleHost.vue（热力图退役但战报保留 ⇒ 日详情必须解耦）。导出仍挂 Heatmap 的 ExportMenu png/html（导出是热力图自己的事，与日详情无关，不动）。判据：① DayDetail import 与 Teleport 块在 TodayBattleHost，Heatmap 内零命中 ② overlay/modal/@click.self 三锚在新宿主 ③ dashboard.css 两样式仍在 ④ Heatmap 的 ExportMenu png/html 导出链未被动', () => {
  const tbh = read('/newtab/components/dashboard/TodayBattleHost.vue');
  const hm = read('/newtab/components/dashboard/Heatmap.vue');
  const css = read('/newtab/components/dashboard/dashboard.css');
  // ① 日详情 Teleport 在新宿主，热力图内已解耦（负锚走 codeOnly：改靶缘由注释里必然提到 DayDetail）
  if (!tbh.includes("import DayDetail from './DayDetail.vue'")) return false;
  if (codeOnly(hm).includes('DayDetail')) return false;
  // ② 三锚
  if (!tbh.includes('<Teleport to="body">')) return false;
  if (!tbh.includes('dz-day-modal-overlay') || !tbh.includes('dz-day-modal')) return false;
  if (!tbh.includes('@click.self')) return false;
  // ③ CSS 仍在
  if (!css.includes('.dz-day-modal-overlay') || !css.includes('.dz-day-modal')) return false;
  // ④ 热力图导出链未动
  return hm.includes('<ExportMenu :formats="[\'png\', \'html\']" @pick="onExport" />')
    && !hm.includes('tablesToCsv') && !hm.includes('exportCsv') && !hm.includes('exportMd');
});
check('W2-5 ★HTML 分享导出真在位：exportView.heatmapShareHtml 生成自包含单文件 HTML（内联 CSS、tok() 现取 --heat-0..5、escHtml 转义），Heatmap.exportHtml 调用之；PNG 导出走 pngBlobFromSpec 现取主题令牌', () => {
  const ev = codeOnly(read('/shared/utils/exportView.ts'));
  const hm = codeOnly(read('/newtab/components/dashboard/Heatmap.vue'));
  return ev.includes('heatmapShareHtml') && ev.includes('HeatmapShareSpec')
    && ev.includes("'--heat-0'") && ev.includes('escHtml')
    && hm.includes('exportHtml') && hm.includes('heatmapShareHtml')
    && hm.includes('pngBlobFromSpec');
});
check("W2-6 ★W12-D 退役重指带备案：日详情「查看全部记录 ›」的 open-log 出口随日详情一起迁到 TodayBattleHost —— 打开全量抽屉并按该日预筛、且先关日详情弹窗再开抽屉（遮罩不叠两层）这条语义一字未改，只是宿主从 HeatmapModule/Heatmap 换成 TodayBattleHost。判据：① 新宿主有 onOpenLog/logOpen/logPreset 且挂 DashboardLogDrawer ② 新宿主把 DayDetail 的 @open-log 接上（不再是 Heatmap emit，因为日详情已解耦出热力图）③ 预筛三字段（from/to = day）与「先关弹窗」那句动作都在", () => {
  const tbh = read('/newtab/components/dashboard/TodayBattleHost.vue');
  const heat = read('/newtab/components/dashboard/Heatmap.vue');
  return tbh.includes('function onOpenLog') && tbh.includes('logOpen') && tbh.includes('logPreset')
    && tbh.includes(':preset="logPreset"') && tbh.includes('<DashboardLogDrawer')
    && tbh.includes('@open-log="onOpenLog"') && tbh.includes('dashSelDay.value = null')
    && tbh.includes('from: day') && tbh.includes('to: day')
    && !heat.includes("emit('open-log'");
});

// ============== W3 · ⌘K 浏览态双 Tab（常用内容/AI 动作）+ 常用内容前置 ==============
console.log('【W3 · ⌘K 浏览态双 Tab：常用内容/AI 动作】');
check('W3-1 ★⌘K 浏览态双 Tab 切换控件：browseTab state（common/ai 两值 + setBrowseTab 重置 selIndex/selectedId）+ 顶部 `.gp-browse-tabs` 两枚 `.gp-browse-tab`（常用内容/AI 动作，active 绑 browseTab）+ `.gp-browse-tabs` / `.gp-browse-tab` / `.gp-browse-tab.active` CSS 三段在位（active 用 --accent-ink/--accent-light 口径对齐 gp-type-tab）', () => {
  const gp = read('/newtab/components/GlobalPopups.vue');
  return gp.includes("type BrowseTab = 'common' | 'ai'")
    && gp.includes("browseTab = ref<BrowseTab>('common')")
    && gp.includes('function setBrowseTab')
    && gp.includes('selIndex.value = 0')
    && gp.includes("selectedId.value = ''")
    && gp.includes('class="gp-browse-tabs"')
    && gp.includes('class="gp-browse-tab"')
    && gp.includes('setBrowseTab(\'common\')')
    && gp.includes('setBrowseTab(\'ai\')')
    && gp.includes('.gp-browse-tabs {')
    && gp.includes('.gp-browse-tab.active {')
    && gp.includes('color: var(--accent-ink)');
});
check('W3-2 ★常用内容 Tab = 近期最常用置顶（用户拍板②）：flatList 常用内容分支顺序 recentResources→QUICK_ACTIONS→PALETTE_TOGGLES，且模板渲染序逐项一致（R60-1：近期最常用组在快捷操作组之前）；常用内容 Tab 三组索引基=当前 tab 可见集合内连续（近期=0、快捷操作=recentResources.length、快速开关=recentResources.length+QUICK_ACTIONS.length）', () => {
  const gp = read('/newtab/components/GlobalPopups.vue');
  // flatList 常用内容分支：近期最常用 → 快捷操作 → 快速开关
  const branchOrder = gp.indexOf('recentResources.value.forEach(item => out.push')
    < gp.indexOf('QUICK_ACTIONS.forEach(qa =>')
    && gp.indexOf('QUICK_ACTIONS.forEach(qa =>')
    < gp.indexOf('PALETTE_TOGGLES.value.forEach(tg => out.push');
  // 模板渲染序（R60-1）：近期最常用分组标题在快捷操作分组标题之前
  const tplOrder = gp.indexOf('🔥 近期最常用 · 按调用次数') < gp.indexOf('>快捷操作<');
  // 索引基：近期=0、快捷操作=recentResources.length、快速开关=recentResources.length+QUICK_ACTIONS.length
  const idxBase = gp.includes('@click="runFlat(j)"')
    && gp.includes('selIndex===recentResources.length+i')
    && gp.includes('selIndex===recentResources.length+QUICK_ACTIONS.length+i');
  return branchOrder && tplOrder && idxBase;
});
check('W3-3 ★AI 动作 Tab：flatList AI 分支顺序 proactive→passive、模板 AI 动作/AI 建议两组仅在 browseTab==\'ai\' 时渲染（v-if），常用内容三组仅在 browseTab==\'common\' 时渲染；tab 切换即重置选中（setBrowseTab 内 selIndex=0 + selectedId 清空，防止 selIndex 指向另一 tab 的集合并错位）', () => {
  const gp = read('/newtab/components/GlobalPopups.vue');
  return gp.includes("browseTab.value === 'ai'")
    && gp.includes("v-if=\"browseTab==='ai'\"")
    && gp.includes("v-if=\"browseTab==='common'\"")
    && gp.indexOf("aiPanelRows.value.proactive.forEach") < gp.indexOf("aiPanelRows.value.passive.forEach")
    && gp.includes('function setBrowseTab')
    && /function setBrowseTab[\s\S]{0,200}selIndex\.value = 0[\s\S]{0,80}selectedId\.value = ''/.test(gp);
});
