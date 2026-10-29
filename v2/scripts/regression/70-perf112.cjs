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
check('R112-2（V3.9.8 随迁）模板接线：策展画布由递归节点按需展开，资源池分页仍由 sentinel + 加载更多承接；旧全量分组循环零残留', () => {
  const w = read('/newtab/views/Workspace.vue');
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const node = read('/newtab/components/curation/CurationMindNode.vue');
  return node.includes('v-for="child in children()"')
    && pool.includes('v-if="hasMore" :ref="setSentinel" class="render-more"')
    && pool.includes('function renderMore()')
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
check('R112-5（V3.9.8 随迁）字段组去新建：普通资源由共享 ResourceEditForm 单份承载，论点由专用抽屉承载；宿主不再逐卡建字段数组', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const form = read('/newtab/components/ResourceEditForm.vue');
  const thesis = read('/newtab/components/curation/CurationThesisDrawer.vue');
  return host.includes('<ResourceEditForm') && host.includes('<CurationThesisDrawer')
    && form.includes('<TagPicker v-model="model.tags"') && form.includes('<AssetManager')
    && thesis.includes('论点标题') && thesis.includes('论点内容')
    && !host.includes('const thesisFields = computed(') && !host.includes('function fieldsOf(');
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
    && p.includes("window.__navTo('PERF0', '.ws-page')")   /* ★V3.9.19 随迁备案：.res-card 随策展四视图退役（V3.9.8 成果态），首帧锚改工作区根 .ws-page；所守纪律（PERF0 定位不误命中溢出指示）一字未变 */
    && !p.includes("window.__navTo('策展台', '.ws-page')")
    && !p.includes("window.__navTo('PERF0', '.res-card')");
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
check('R112-13 预取不跳过归一化：loadData 的归一化段在预取分支之后仍无条件执行。★P0-2(V3.8.41) 重指带备案：归一化段原是 loadData 里的内联 `const fixTags =`，现已抽成导出的 `normalizeLegacyCards`，loadData 内只剩一次调用——**锚点随之换居所，守的行为（预取不豁免归一化）一字未变**', () => {
  const r = read('/shared/storage/repository.ts');
  const iPrefetch = r.indexOf('let raw = prefetched ?');
  const iCall = r.indexOf('normalizeLegacyCards(data)');
  return iPrefetch > 0 && iCall > iPrefetch
    && r.includes('export function normalizeLegacyCards')
    /* ★口径备案：`fixTagNames`（标签名 URL 解码）**仍在 loadData 里**且仍用 `data.`——
       它归一化的是名字不是卡片字段，不随 P0-2 搬迁（registry 会抄错形参）。故此条查它仍在原地。 */
    && r.includes('fixTagNames(data.resources as { tags?: string[] }[])');
});

// ===== R113（V2.81.0）生产反馈第三批（六项）=====
// 本批次分四批施工（0 热修 / 1 入口交互 / 2 生命周期 / 3 全屏），断言随批次追加。

// ---- 批次 0：P0 周报失效 ----
check('R113-1 ★ P0 周报入口修复（R172-T9 重指带备案 · M4/V3.8.32 再重指）：周报浮层退役 ⇒ "模板引用但从未 import"的病根整体消失；双向断言 = 旧浮层引用/导入零残留 + 右槽战报工具入口的**使用点**可见且其依赖（router / openReview）先于该使用点', () => {
  const h = read('/newtab/views/CompassHome.vue');
  const cmp = read('/newtab/views/useCompassHome.ts');
  // ★M4（V3.8.32）重指：锚点从类名 mb-act cta 改为入口的使用点，类名不是契约，使用点才是。
  // ★R181 随迁带备案：openReview 与它用到的 router 随域逻辑下沉 useCompassHome.ts，
  //   "依赖先于使用点"拆成两处各自成立——① 宿主模板仍在使用点；② composable 里 router import 先于 openReview 定义。
  const tagIdx = h.indexOf('@click="openReview"');
  const routerIdx = cmp.indexOf("import { useRouter, useRoute } from 'vue-router'");
  const fnIdx = cmp.indexOf('function openReview');
  return tagIdx > 0 && routerIdx > 0 && fnIdx > 0 && routerIdx < fnIdx && !h.includes('wr-overlay') && !h.includes("from '../components/WeeklyReport");
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
      // ★R181 扩展：结构优化把"懒加载组件常量"下沉到 composable、宿主改为 `const { X } = useXxx()` 解构接回时，
      //   宿主仍是"有绑定"（不是静默空节点），故把"解构自本地 composable 的具名绑定"也算有效登记；
      //   孤儿定义（既无绑定也无 defineAsyncComponent）仍照旧红。
      if (!new RegExp('import\\s+[^;]*\\b' + tag + '\\b[^;]*from').test(src)
        && !new RegExp('const\\s+' + tag + '\\s*=\\s*defineAsyncComponent').test(src)
        && !new RegExp('const\\s+\\{[^}]*\\b' + tag + '\\b[^}]*\\}\\s*=').test(src)) bad.push(path.relative(base, f) + ' → ' + tag);
    }
  }
  if (bad.length) console.log('      孤儿组件：' + bad.join(' | '));
  return bad.length === 0;
});

// ---- R113 批次1（N1 / N4 / N6）----
check('R113-3（V3.9.29 重指）导入金字塔模板一级入口：收进页头「导入」菜单，菜单项经 importPyramidTemplateFromMenu 打开同一弹窗', () => {
  const w = read('/newtab/views/Workspace.vue');
  return w.includes('class="cur-import"') && w.includes('<b>导入模板</b>')
    && w.includes('@click="importPyramidTemplateFromMenu"')
    && w.includes('function importPyramidTemplateFromMenu()')
    && w.includes('pyramidImportOpen.value = true')
    && !w.includes('导入金字塔模板'); // 旧溢出菜单项已移除
});
check('R113-4（V3.9.9 随迁）节点动作收敛：建支只走 Tab / Enter，节点原位只留“关联资源 / 删除空节点”，标题与说明单击选中、双击编辑；旧分类溢出菜单零回流', () => {
  const n = read('/newtab/components/curation/CurationMindNode.vue');
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  return n.includes('关联资源') && n.includes('删除')
    && !n.includes("emit('create-child', node.id)")
    && n.includes('@dblclick.stop="beginEdit(\'title\')"') && n.includes('@dblclick.stop="beginEdit(\'desc\')"')
    && n.includes('<kbd>Tab</kbd> 子级 · <kbd>Enter</kbd> 同级')
    && !m.includes('子分支</button>')
    && !host.includes('class="cat-actions"') && !host.includes('openCatMenu(');
});
check('R113-5（V3.9.8 随迁）画布宽度控制：旧侧栏拖宽退役，画布在宿主内自适应占满；兼容偏好字段保留但页面不再渲染侧栏', () => {
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  const m = read('/shared/models/index.ts');
  const c = read('/newtab/components/curation/curation.css');
  return host.includes('<CurationMindMap') && !host.includes('class="ws-side-split"')
    && !host.includes('function startSideResize')
    && m.includes('wsSideW?: number')
    && c.includes('.mindmap-shell {') && c.includes('width: 100%;');
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
check('R113-9（V3.9.8 随迁）画布真全屏：全屏壳由 CurationMindMap 自持，overlayHost 动态浮层宿主与六处浮层 :to 接线保持', () => {
  const m = read('/newtab/components/curation/CurationMindMap.vue');
  const oh = read('/shared/utils/overlayHost.ts');
  const drawer = read('/shared/components/Drawer.vue');
  const cm = read('/shared/components/ContextMenu.vue');
  const cd = read('/shared/components/ConfirmDialog.vue');
  const ap = read('/shared/components/AssetPreview.vue');
  const ab = read('/shared/components/AssetBadge.vue');
  const tp = read('/shared/components/TagPicker.vue');
  return m.includes('ref="shellRef"') && m.includes('setOverlayFsHost(props.fullscreen ? shellRef.value : null)')
    && m.includes('function enterFullscreen()')
    && oh.includes('export function setOverlayFsHost') && oh.includes('export function useOverlayTarget')
    && drawer.includes(':to="overlayTarget"') && cm.includes(':to="overlayTarget"') && cd.includes(':to="overlayTarget"')
    && ap.includes(':to="overlayTarget"') && ab.includes(':to="overlayTarget"') && tp.includes(':to="overlayTarget"');
});

// R114-59（批次A）：静默 catch 清零护栏——src 内不允许再出现空 catch；content 路由消息统一走 safeSend 收敛点
check('R114-1 技术债59-⑤ 静默 catch 清零：overlay-impl 路由消息收敛 safeSend（双通道吞错+注释），App/GlobalSettings 三处可感知告警', () => {
  const o = read('/content/overlay-impl.ts');
  const app = read('/newtab/App.vue');
  const dm = read('/newtab/views/settings/SettingsDataManagement.vue');
  const dp = read('/newtab/views/settings/dataPackage.ts');
  return !new RegExp('catch\s*\{\s*\}').test(o)
    && (o.match(/safeSend\(/g) || []).length >= 11 && o.includes('function safeSend')
    && app.includes('storage.onChanged 监听注册失败')
    && dm.includes('导入前自动备份失败')
    && dp.includes('applyDataPackageUIPrefs')
    && dm.includes('界面偏好已应用');
});
check('R114-2 技术债59-B 构建期修复：modulePreload 禁用（content 隔离世界 preload 链接误解析宿主页 origin → 每次 Ctrl+K 白吃 404）+ 相对动态 import 改写插件', () => {
  const v = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'vite.config.ts'), 'utf8');
  return v.includes('modulePreload: false') && v.includes('fix-content-dynamic-imports') && v.includes('chrome.runtime.getURL');
});
check('R114-3（V3.9.8 随迁）画布热路径：旧 drawPyLinks 的逐节点 rect 测量与 O(节点×分类) 查找退役，资源按 categoryId 一次建桶、子节点由 CatIndex 索引读取', () => {
  const h = read('/newtab/composables/useCurationMindMap.ts');
  const host = codeOnly(fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8'));
  return h.includes('const cardsByCat = computed<Map<string, ResourceCard[]>>')
    && h.includes('const key = r.categoryId || \'\'')
    && h.includes('return catIdx.value.childrenOf.get(catId) || []')
    && !host.includes('function drawPyLinks(') && !host.includes('getBoundingClientRect()');
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
check('R115-3（V3.9.8 随迁）画布拖拽唯一状态源：dragSource/dropTarget 由 CurationMindMap 持有，校验与落库统一走 useCurationMindMap.moveNode', () => {
  const drag = read('/newtab/composables/useResourceDragDrop.ts');
  const map = read('/newtab/components/curation/CurationMindMap.vue');
  const hook = read('/newtab/composables/useCurationMindMap.ts');
  return drag.includes('const dragState: DragState = { card: null, cat: null }')
    && drag.includes('export interface DragState { card: ResourceCard | null; cat: string | null }')
    && map.includes("const dragSource = ref('')") && map.includes("const dropTarget = ref('')")
    && map.includes("emit('move', source, id)")
    && hook.includes('function validateDrop(') && hook.includes('function moveNode(')
    && !hook.includes('let draggedItem') && !hook.includes('let dragCatId');
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
check('R116-2（V3.9.8 随迁）旧看板追加通道退役：资源池改用 sentinel 自动加载 + 显式“加载更多”入口，两者共用 renderMore', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  return pool.includes('IntersectionObserver') && pool.includes('function renderMore()')
    && pool.includes('@click="renderMore"') && pool.includes('已显示 {{ rendered.length }} / {{ poolCards.length }} 张');
});
check('R116-3 看板列限额上下文复位 + 列表/卡片增量渲染机制未被误改（RENDER_STEP=80 仍在）', () => {
  const u = read('/newtab/composables/useResourceView.ts');
  return u.includes('kanbanColLimit.value = {}')
    && u.includes('const RENDER_STEP = 32')
    && u.includes('renderLimit.value += RENDER_STEP');
});
check('R116-4（V3.9.8 随迁）资源池加载更多样式在位：render-more 居中、弱文本色、悬停强调；旧看板 kc-more 零回流', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue');
  const s = read('/newtab/views/workspace.css');
  return pool.includes('.render-more {') && pool.includes('.render-more:hover {')
    && !s.includes('.kc-more');
});

// ============== 第一百二十轮 · V2.88.0：搜索键位统一（两入口：单击/Enter=开链 · Ctrl+Enter=仅定位） ==============
