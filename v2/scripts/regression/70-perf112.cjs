/**
 * R174-1 分片 · 70-perf112：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

console.log('【第 112 轮 · 性能专项第一批（04-59）】');
check('R112-1 ★ 增量渲染：卡片/列表视图按份额渲染（RENDER_STEP / renderLimit / renderedGroups / 滚动追加）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('const RENDER_STEP = 32')
    && w.includes('const renderLimit = ref(RENDER_STEP)')
    && w.includes('const renderedGroups = computed<ResourceGroup[]>(() =>')
    && w.includes('function onContentScroll(e: Event)')
    && w.includes('function renderMore()')
    && w.includes('const hasMoreToRender = computed(');
});
check('R112-2 ★ 模板接线：两处分组循环改走 renderedGroups + 滚动容器监听 + 加载更多入口（旧全量循环零残留）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return (w.match(/v-for="\(g, gi\) in renderedGroups"/g) || []).length === 2
    && w.includes('class="ws-content" @scroll.passive="onContentScroll"')
    && w.includes('class="render-more"')
    && w.includes('.render-more { margin: 16px 0 4px;')
    && !w.includes('v-for="(g, gi) in resourceGroups"');
});
check('R112-3（R162 重指）挂载计数反查表随挂载退役：mountedCountByResId/mountedTaskCount 零命中', () => {
  const b = read('/newtab/composables/useWorkspaceBatch.ts');
  return !b.includes('mountedCountByResId') && !b.includes('mountedTaskCount');
});
check('R112-4 ★ boardCardsOf 去重：curationMetrics 复用宿主 allResources（此前 metrics 与 allResources 各算一遍全量遍历）', () => {
  const h = read('/shared/storage/hub.ts');
  const w = read('/newtab/views/Workspace.vue');
  return h.includes('export function curationMetrics(d: AppData, wsId: ID, cardsIn?: ResourceCard[]): CurationMetrics')
    && h.includes('const cards = cardsIn || boardCardsOf(d, wsId)')
    && w.includes('curationMetrics(d.value, workspaceId.value, allResources.value)');
});
check('R112-5 ★ 字段组去新建：fieldsOf 返回缓存 computed 引用（thesisFields / rFields，不再逐卡 visibleFields）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("const thesisFields = computed(() => visibleFields(d.value.fieldConfig, 'thesis'))")
    && w.includes('return (r.isThesis && !isMirrorView(r)) ? thesisFields.value : rFields.value');
});
check('R112-6 ★ 日期格式化缓存：fieldValue 的 createdAt 分支走 fmtDateCN 记忆化（避免逐卡构造 Intl）', () => {
  const f = read('/shared/utils/fields.ts');
  return f.includes('const dateFmtCache = new Map<number, string>()')
    && f.includes('function fmtDateCN(ts: number): string')
    && f.includes("case 'createdAt': return c.createdAt ? fmtDateCN(Number(c.createdAt)) : ''");
});
check('R112-7 ★ 家族过滤复杂度：applyViewFilters 的 ids.includes 改 Set.has（O(卡数×家族) → O(卡数)）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('const ids = new Set(familyIds(activeCategory.value))')
    && w.includes('out = out.filter(r => r.categoryId && ids.has(r.categoryId))');
});
check('R112-8 渲染份额复位：换台 / 换视图 / 换分类 / 改检索词 / 改排序时回落 RENDER_STEP（R116 起看板列限额一并复位）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("watch([workspaceId, viewMode, activeCategory, debouncedQuery, sortBy, sortDir], () => { renderLimit.value = RENDER_STEP; kanbanColLimit.value = {} })");
});
check('R112-9 ★ 切台零重算：workspaceId 离开 /workspace 时保持上一个台 id（避免 KeepAlive 缓存组件在隐藏期被触发全量重算、切回再算一遍）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes("const lastWsId = ref('')")
    && w.includes("watch(() => route.params.id, (id) => { if (typeof id === 'string' && id) lastWsId.value = id }, { immediate: true })")
    && w.includes("return (typeof id === 'string' && id) ? id : lastWsId.value");
});
check('R112-10 ★ 切台热度落盘节流（R173-T2 重指备案：4s 后由 persist() 整库改 persistHot() 小载荷——真库每次进台省 49~84ms 整库序列化；热度键帧扩 ws；页隐藏补写 persistHot(true) 跳防抖）', () => {
  const w = read('/newtab/views/Workspace.vue'); const h = read('/shared/storage/hotStats.ts');
  return w.includes('function scheduleWsOpenPersist()')
    && w.includes('wsOpenPersistTimer = setTimeout(() => { wsOpenPersistTimer = null; store.persistHot() }, 4000)')
    && w.includes('function flushWsOpenPersist()') && w.includes('store.persistHot(true) }')
    && h.includes('ws?: Record<string, [number, number]>') && h.includes('writeHot(d: AppData, immediate?: boolean)')
    && w.includes("document.addEventListener('visibilitychange', onWsOpenVisibility)") && !w.includes('if (ws) { recordWorkspaceOpen(d.value, ws); store.persist() }');
});
check('R112-11 ★ perf 脚本漂移修复：tab-overflow 过滤 + 策展台切台改用 PERF0 定位（原「策展台」前缀误命中溢出指示「≪ N」，打满 15s 超时被误读为「慢」）', () => {
  const p = read('/../scripts/perf.cjs');
  return p.includes('|tab-overflow/')
    && p.includes("window.__navTo('PERF0', '.res-card')")
    && !p.includes("window.__navTo('策展台', '.res-card')");
});

check('R112-12 ★ 冷启动单次读取：ensureBootData 会话内幂等 + 首次 raw 快照复用给 loadData（原 STORAGE_KEY 被串行读 3 次，medium 实测 219+197+229ms）', () => {
  const m = read('/newtab/main.ts');
  const r = read('/shared/storage/repository.ts');
  return m.includes('let bootDataDone = false')
    && m.includes('if (bootDataDone) return')
    && m.includes('await loadData(r)')
    && r.includes('export async function loadData(prefetched?: Record<string, unknown>)')
    && r.includes('prefetched ? (prefetched[STORAGE_KEY] as AppData | undefined) : undefined');
});
check('R112-13 预取不跳过归一化：loadData 的 fixTags/fixEncoded/fixTagNames 修复段在预取分支之后仍无条件执行', () => {
  const r = read('/shared/storage/repository.ts');
  const iPrefetch = r.indexOf('let raw = prefetched ?');
  const iFix = r.indexOf('const fixTags =');
  return iPrefetch > 0 && iFix > iPrefetch && r.includes('fixTagNames(data.resources as { tags?: string[] }[])');
});

// ===== R113（V2.81.0）生产反馈第三批（六项）=====
// 本批次分四批施工（0 热修 / 1 入口交互 / 2 生命周期 / 3 全屏），断言随批次追加。

// ---- 批次 0：P0 周报失效 ----
check('R113-1 ★ P0 周报入口修复（R172-T9 重指带备案）：周报浮层退役 ⇒ "模板引用但从未 import"的病根整体消失；双向断言 = 旧浮层引用/导入零残留 + 新入口「📈 复盘」可见且其依赖（router / openReview）先于模板引用', () => {
  const h = read('/newtab/views/CompassHome.vue');
  const tagIdx = h.indexOf('mb-act cta');
  const routerIdx = h.indexOf("import { useRouter, useRoute } from 'vue-router'");
  const fnIdx = h.indexOf('function openReview');
  return tagIdx > 0 && routerIdx > 0 && routerIdx < tagIdx && fnIdx > 0 && fnIdx < tagIdx && !h.includes('wr-overlay') && !h.includes("from '../components/WeeklyReport");
});

/** R113-2 用：递归收集 src 下所有 .vue */

check('R113-2 ★ 孤儿组件全量护栏：src 下所有 .vue 模板中出现的自研组件标签，本文件必须存在对应 import —— 防复现 R111「模板引用了但从未 import」被 Vue 静默渲染为空节点的失效', () => {
  const bad = [];
  for (const f of walkVueFiles(base)) {
    const src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    const i1 = src.indexOf('<template>');
    const i2 = src.lastIndexOf('</template>');
    const tplRaw = i1 >= 0 && i2 > i1 ? src.slice(i1, i2) : src;
    // 剥掉 HTML 注释：注释里出现的 `<Set>` 之类的泛型写法不是组件标签（曾致误报）
    const tpl = tplRaw.replace(/<!--[\s\S]*?-->/g, '');
    const tags = new Set([...tpl.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map(m => m[1]));
    for (const tag of tags) {
      if (VUE_BUILTIN_TAGS.has(tag)) continue;
      // R134 扩展：defineAsyncComponent 常量注册与 import 同罪同罚（懒加载组件不是孤儿）
      if (!new RegExp('import\\s+[^;]*\\b' + tag + '\\b[^;]*from').test(src) && !new RegExp('const\\s+' + tag + '\\s*=\\s*defineAsyncComponent').test(src)) bad.push(path.relative(base, f) + ' → ' + tag);
    }
  }
  if (bad.length) console.log('      孤儿组件：' + bad.join(' | '));
  return bad.length === 0;
});

// ---- R113 批次1（N1 / N4 / N6）----
check('R113-3 N4 导入金字塔模板一级入口：hero-btn settings 样式（R88-8 主色稀缺约束：非 primary 非 ghost）+ pyramidImportOpen 直连', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('class="hero-btn settings py-import-btn"') && w.includes('@click="pyramidImportOpen = true"><Icon name="filetext" :size="13"/> 导入模板</button>')
    && !w.includes('导入金字塔模板'); // 旧溢出菜单项已移除
});
check('R113-4 N1 分类行操作收敛（V3.7.0 重指）：hover 只余「＋/⋯」两入口，原平铺 🗑 等移入 ⋯ 溢出菜单（ctm），菜单收敛为置顶/重命名/删除三项（📤 镜像项随资源台退役）', () => {
  const w = read('/newtab/views/Workspace.vue');
  const i = w.indexOf('<span class="cat-actions">');
  const actions = i >= 0 ? w.slice(i, i + 500) : '';
  return !!actions && actions.includes("openCreateCat(sc.cat.id)") && actions.includes("openCatMenu($event, sc)")
    && !actions.includes("openRenameCat(sc.cat)") && !actions.includes("deleteCategory(sc.cat)") && !actions.includes("openMirrorCat(sc.cat)")
    && w.includes("runCatMenu('pin')") && w.includes("runCatMenu('rename')") && w.includes("runCatMenu('delete')")
    && !w.includes("runCatMenu('mirror')") && !w.includes('catMenu.canMirror') && w.includes('catMenu.depth === 0');
});
check('R113-5 N1 分类树宽度拖拽：ws-side-split 双向拖拽 + UIPrefs.wsSideW 持久化 + 160~420px 夹取 + 双击复位', () => {
  const w = read('/newtab/views/Workspace.vue');
  const m = read('/shared/models/index.ts');
  return w.includes('class="ws-side-split"') && w.includes('function startSideResize') && w.includes('function onSideResizeMove') && w.includes('function onSideResizeUp')
    && w.includes('function resetSideWidth') && w.includes("sideRail ? { width: '36px' } : { width: wsSideW + 'px' }")
    && w.includes('Math.min(SIDE_W_MAX, Math.max(SIDE_W_MIN') && w.includes('saveUIPrefs({ wsSideW: wsSideW.value })')
    && m.includes('wsSideW?: number') && w.includes('.ws-side-split:hover');
});
check('R113-6 N6 今日三件事任务选取弹框按项目筛选：picker 项目下拉（含「未关联项目」哨兵 __none__）+ 过滤链 + 打开时复位', () => {
  const h = read('/newtab/views/CompassHome.vue');
  return h.includes("const pickerProject = ref('')") && h.includes('v-model="pickerProject"') && h.includes("pickerProject.value = '' // R113-N6：每次打开复位为「全部项目」")
    && h.includes("pj === '__none__' ? !t.projectId : t.projectId === pj") && h.includes('value="__none__"') && h.includes('const pickerProjectOptions = computed');
});
check('R113-7 N6 TaskAddDrawer 关联任务同样支持按项目筛选：linkProject + effectiveProjectId 反查口径 + candidates 过滤', () => {
  const t = read('/newtab/components/TaskAddDrawer.vue');
  return t.includes("const linkProject = ref('')") && t.includes('v-model="linkProject"') && t.includes('function effectiveProjectId(t: TaskCard): string')
    && t.includes("pj === '__none__' ? !effectiveProjectId(t) : effectiveProjectId(t) === pj") && t.includes("linkProject.value = ''");
});

// ---- R113 批次2（N2 / T9）----
check('R113-8 ★ T9 snooze 口径修复（R117-E 修订：周期长度跟随该卡自定义冷却天数 coolingMsOf）：独立 snoozedUntil 字段承载「忽略一个评估周期」——snoozeCard 不再碰 lastCalledAt/updatedAt（热度排序与 WRR 统计零污染）；到期前恒活跃；重新激活清 snooze', () => {
  const e = read('/shared/utils/lifecycle.ts');
  const m = read('/shared/models/index.ts');
  return e.includes('snoozedUntil?: number') && e.includes('card.snoozedUntil = Date.now() + coolingMsOf(card)')
    && e.includes("if (card.snoozedUntil && card.snoozedUntil > now) return 'active'")
    && e.includes('card.snoozedUntil = undefined')
    && !/snoozeCard[\s\S]*?lastCalledAt\s*=\s*Date\.now/.test(e) // 旧实现（覆盖 lastCalledAt）必须不存在
    && m.includes('snoozedUntil?: number');
});
check('R113-9 ★ N5 金字塔真全屏：宿主上移 .ws-page（requestFullscreen）+ overlayHost 动态浮层宿主 + 七处浮层改 :to + :fullscreen 隐藏侧栏/指标条保留工具条', () => {
  const w = read('/newtab/views/Workspace.vue');
  const oh = read('/shared/utils/overlayHost.ts');
  const drawer = read('/shared/components/Drawer.vue');
  const cm = read('/shared/components/ContextMenu.vue');
  const cd = read('/shared/components/ConfirmDialog.vue');
  const ap = read('/shared/components/AssetPreview.vue');
  const ab = read('/shared/components/AssetBadge.vue');
  const tp = read('/shared/components/TagPicker.vue');
  return w.includes('ref="wsPageRef"') && w.includes('el = wsPageRef.value') && w.includes('setOverlayFsHost(el)')
    && w.includes(':to="overlayTarget"') && w.includes('.ws-page:fullscreen .ws-sidebar') && !w.includes('.ws-page:fullscreen .ws-toolbar') // 工具条保留（＋新建可用）
    && oh.includes('export function setOverlayFsHost') && oh.includes('export function useOverlayTarget')
    && drawer.includes(':to="overlayTarget"') && cm.includes(':to="overlayTarget"') && cd.includes(':to="overlayTarget"')
    && ap.includes(':to="overlayTarget"') && ab.includes(':to="overlayTarget"') && tp.includes(':to="overlayTarget"');
});

// R114-59（批次A）：静默 catch 清零护栏——src 内不允许再出现空 catch；content 路由消息统一走 safeSend 收敛点
check('R114-1 技术债59-⑤ 静默 catch 清零：overlay-impl 路由消息收敛 safeSend（双通道吞错+注释），App/GlobalSettings 三处可感知告警', () => {
  const o = read('/content/overlay-impl.ts');
  const app = read('/newtab/App.vue');
  const g = read('/newtab/views/GlobalSettings.vue');
  return !new RegExp('catch\s*\{\s*\}').test(o)
    && (o.match(/safeSend\(/g) || []).length >= 11 && o.includes('function safeSend')
    && app.includes('storage.onChanged 监听注册失败')
    && g.includes('导入前自动备份失败') && g.includes('读取 UI 偏好失败');
});
check('R114-2 技术债59-B 构建期修复：modulePreload 禁用（content 隔离世界 preload 链接误解析宿主页 origin → 每次 Ctrl+K 白吃 404）+ 相对动态 import 改写插件', () => {
  const v = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'vite.config.ts'), 'utf8');
  return v.includes('modulePreload: false') && v.includes('fix-content-dynamic-imports') && v.includes('chrome.runtime.getURL');
});
check('R114-3 技术债59-B drawPyLinks 减负：每节点单次 rect 读 + 分类 Map 反查（原 O(节点×分类) find 为交互窗口最大热点 505ms）', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('const anchors = new Map<string, { x: number; top: number; bottom: number }>()')
    && w.includes('const catById = new Map(wsCats.value.map(c => [c.id, c]))')
    && !w.includes('wsCats.value.find(c => c.id === el.dataset.pyid)');
});

// ===== 第 115 轮 · 架构拆分 + 骨架屏就绪即过渡（04-59 第三批） =====
check('R115-1 ★ Workspace.vue 物理拆分：宿主 ≤1500 行 + 六域 composable + 样式外置 workspace.css（04-59 验收线）', () => {
  const lines = (p) => fs.readFileSync(base + p, 'utf8').split('\n').length;
  const wsLines = lines('/newtab/views/Workspace.vue');
  return wsLines <= 1500
    && exists('/newtab/composables/useResourceView.ts')
    && exists('/newtab/composables/useCatSidebar.ts')
    && exists('/newtab/composables/useResourceOpen.ts')
    && exists('/newtab/composables/useResourceDrawer.ts')
    && exists('/newtab/composables/useResourceDragDrop.ts')
    && exists('/newtab/composables/usePyramid.ts')
    && exists('/newtab/composables/useWsMeta.ts')
    && exists('/newtab/composables/useWsAssetHygiene.ts')
    && exists('/newtab/views/workspace.css')
    && read('/newtab/views/Workspace.vue').includes('<style scoped src="./workspace.css"></style>');
});
check('R115-2 ★ 断言聚合读取机制：read(Workspace.vue) = 宿主 + 8 composable + css 拼接（沿用 content 三文件机制，历史断言零改写）', () => {
  const src = fs.readFileSync(ANCHOR_FILE, 'utf8');
  return src.includes('const WORKSPACE_SRC_FILES') && src.includes("'/newtab/composables/useResourceView.ts'") && src.includes("'/newtab/views/workspace.css'");
});
check('R115-3 ★ 共享拖拽状态层：dragState（.card/.cat）为卡片/分类双拖拽唯一状态源，金字塔域消费同一份（原宿主共享 let 变量升层）', () => {
  const drag = read('/newtab/composables/useResourceDragDrop.ts');
  const py = read('/newtab/composables/usePyramid.ts');
  return drag.includes('const dragState: DragState = { card: null, cat: null }')
    && drag.includes('export interface DragState { card: ResourceCard | null; cat: string | null }')
    && py.includes('dragState: DragState')
    && py.includes('dragState.card') && py.includes('dragState.cat')
    && !py.includes('let draggedItem') && !py.includes('let dragCatId');
});
check('R115-4 ★ 骨架屏「就绪即过渡」：快加载废止 360ms 补足（原 360+220=580ms 地板）→ 150ms 最短防白闪 + 160ms 完成态淡出', () => {
  const m = read('/newtab/main.ts');
  return m.includes('const SKELETON_MIN_SHOW = 150')
    && m.includes('const DONE_FADE_MS = 160')
    && m.includes('elapsed < SKELETON_MIN_SHOW')
    && !m.includes('elapsed < 360')
    && !m.includes('Math.max(0, 220 - late)');
});

// ===== R116（看板渲染增量优化）=====
check('R116-1 ★ 看板列增量渲染：KANBAN_COL_STEP + 每列切片（items: shown）+ count 恒为全量长度（hiddenCount 为差值）· R168 备案：档位 20 → **6**——真库实测 20 × 33 列 ≥ 全量 380 卡，等于"增量渲染"名存实亡（切看板 +3520 节点 / 阻塞 488ms，全站最慢一次交互）。判据改为**从源码读那个常量并断言 ≤8**，写死等值只会让下次调档又红一条', () => {
  const w = read('/newtab/composables/useResourceView.ts');
  const step = Number((w.match(/const KANBAN_COL_STEP = (\d+)/) || [])[1] || 999);
  return step > 0 && step <= 8
    && w.includes('const shown = items.slice(0, kanbanLimitOf(c.key))')
    && w.includes('return { key: c.key, name: c.name, items: shown, count: items.length, hiddenCount: items.length - shown.length }')
    && w.includes('function kanbanLimitOf(key: string) { return kanbanColLimit.value[key] || KANBAN_COL_STEP }');
});
check('R116-2 看板列追加双通道：列体滚动近底 60px 自动追加（onKanbanColScroll）+ 列底显式入口（kanbanMore → kc-more 按钮）', () => {
  const v = read('/newtab/views/Workspace.vue');
  const u = read('/newtab/composables/useResourceView.ts');
  return u.includes('if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) kanbanMore(key)')
    && v.includes('@scroll="onKanbanColScroll($event, cat.key)"')
    && v.includes('v-if="cat.hiddenCount > 0" class="kc-more" @click="kanbanMore(cat.key)"')
    && v.includes('显示更多 {{ cat.hiddenCount }} 张');
});
check('R116-3 看板列限额上下文复位 + 列表/卡片增量渲染机制未被误改（RENDER_STEP=80 仍在）', () => {
  const u = read('/newtab/composables/useResourceView.ts');
  return u.includes('kanbanColLimit.value = {}')
    && u.includes('const RENDER_STEP = 32')
    && u.includes('renderLimit.value += RENDER_STEP');
});
check('R116-4（R155 令牌化备案）列底入口样式就位（.kc-more 于 workspace.css，hover 下划线）', () => {
  const s = read('/newtab/views/workspace.css');
  return s.includes('.kc-more { text-align: center; padding: 8px 0 4px; font-size: var(--fs-sub); color: var(--accent); cursor: pointer; user-select: none; }')
    && s.includes('.kc-more:hover { text-decoration: underline; }');
});

// ============== 第一百二十轮 · V2.88.0：搜索键位统一（两入口：单击/Enter=开链 · Ctrl+Enter=仅定位） ==============