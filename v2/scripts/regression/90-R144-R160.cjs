/**
 * R174-1 分片 · 90-R144-R160：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT_ALL, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, CT_W11, TOWER, LANE, SPINE, PANEL, CMETA} = require('./helpers.cjs');

console.log('【R144 · V2.112.0：批次 G 四场景 + 子任务软层级】');
check('R144-1 ★子任务改卡内嵌（R166 定案 1/2 重写本条）：detachChildren / flattenTaskTree 随 parentId 整体退役、真源零残留；解绑与软删不再摘子（只摘指标引用）；折叠迁移 foldParentIdSubtasks 挂在载入链上且幂等标记在位；拆解链不再给步骤打父指针', () => { const l = codeOnly(read('/shared/utils/taskLinks.ts')); const r = read('/shared/storage/repository.ts'); const c = codeOnly(read('/shared/ai/chain.ts')); const m = codeOnly(read('/shared/models/index.ts')); return !l.includes('detachChildren') && !l.includes('flattenTaskTree') && !l.includes('parentId') && (l.match(/detachTaskFromMetrics\(d, t\.id\)/g) || []).length === 2 && m.includes('subtasks?: Subtask[]') && m.includes('export interface Subtask') && r.includes('function foldParentIdSubtasks(data: AppData)') && r.includes('foldParentIdSubtasks(data)') && r.includes('if (data.subtasksFoldedAt) return') && r.includes('data.subtasksFoldedAt = Date.now()') && !c.includes('parentId') && !c.includes('mkTask(s, t.projectId, t.metricId, t.id)'); });
check('R144-2 呈现触点随迁（R166 定案 1 重写）：方向树与项目抽屉改一维列表（flattenTaskTree/⤴ 退役）；面板 ↳ 由「标父名」改「子任务 done/total 进度」且卡片/列表/看板现役视图共用一个 helper；详情头部进度胶囊与清单同源；四个消费文件 parentId 零读写（完成态永不联动到卡级评分）· V3.9.16 按现役模板精确钉 4 处，删除死平铺后不允许计数继续虚高', () => { const ct = codeOnly(CT_ALL); const pd = codeOnly(read('/newtab/components/ProjectDetailDrawer.vue')); const tp = codeOnly(read('/newtab/components/compass/TaskManagerPanel.vue')); const td = codeOnly(read('/newtab/components/compass/TaskDetailDrawer.vue')); return !ct.includes('flattenTaskTree') && !ct.includes('promoteTask') && !ct.includes('.tk-row.sub') && !pd.includes('flattenTaskTree') && !pd.includes('promoteTask') && !pd.includes('.pd-task.sub') && !tp.includes('parentTitleOf') && (tp.match(/v-if="subProgress\(task\)"/g) || []).length === 4 && td.includes('const subtasks = computed') && td.includes('const subtaskDone = computed') && !td.includes('parentTask') && [ct, pd, tp, codeOnly(read('/shared/utils/taskLinks.ts'))].every(x => !x.includes('parentId')); });
check('R144-3 ★G1 论点契约与消毒：提示词要「一句可被反驳的判断」+ MECE 互斥穷尽；parse 消毒=论点≤40、支≤5 去重、cardIds 只认本台活卡且一卡只归一支；采纳只写主题卡 🤖 块（整段替换不堆积），建分类是显式次通道（顶层≤12 封顶）', () => {
  const s = read('/shared/ai/scenarios.ts'); const g = read('/shared/ai/batchG.ts'); const p = read('/shared/ai/project.ts'); const w = read('/newtab/views/Workspace.vue');
  return s.includes('一句可被反驳的判断') && s.includes('彼此互斥、合起来穷尽卡群主体（MECE）')
    && g.includes('known.has(id) && !used.has(id)') && g.includes('(bag.parts || []).slice(0, 5)') && g.includes('THESIS_BLOCK') && g.includes('function ensureThesisCard')
    && g.includes("label: '🗂 分论点建成分类并归架'") && g.includes('kids.length >= 12')
    && p.includes('export function projectDeckThesis') && p.includes('别假装有读过') && w.includes('<ThesisAiBtn :ws-id="workspaceId"');
});
check('R144-4 ★G2 三判决与写入边界：verdict 白名单（第四种全丢）、convert 缺 taskTitle 即丢行、转化只走宿主 convertToTask 唯一通道、drop=置 shelf 不删卡、keep 零写入；投料吃 R142 的 curioRelated 并集', () => {
  const g = read('/shared/ai/batchG.ts'); const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const p = read('/shared/ai/project.ts');
  return g.includes("['convert', 'keep', 'drop'].includes(v)") && g.includes("if (v === 'convert' && !title) { drop.noTitle++; return }") && g.includes("c.status = 'shelf'")
    && !g.includes('deletedAt = Date.now()') && g.includes('ctx.onConvert(c, title)')
    && cp.includes('convertToTask(c)') && cp.includes('t.title = title.slice(0, 40)') && cp.includes('转化研判') && cp.includes('AiEntryButton')
    && p.includes('export function projectCurioPool') && !p.includes('curioRelated');
});
check('R144-5（V3.9.8 随迁）G3/G4 语义：佐证 id 只认资源台目录且未挂本分支（≤6 张），采纳=projectCardToBoard 镜像零源改动；文稿 rawText 成文（剥代码围栏），次通道下载 .md 不改库 · R149 备案：文稿主通道由「采纳=存卡」改成 withReport 自动落卡（无 apply / adoptable:false），下载 .md 保留为唯一按钮；现役资源入口从画布节点「关联资源」进入 LinkCardsModal，旧 EvidenceMenuItem/nodeMenu 宿主已退役', () => {
  const g = read('/shared/ai/batchG.ts'); const em = read('/newtab/components/EvidenceMenuItem.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); const w = codeOnly(read('/newtab/views/Workspace.vue'));
  const mm = read('/newtab/components/curation/CurationMindMap.vue'); const node = read('/newtab/components/curation/CurationMindNode.vue'); const lm = read('/newtab/components/LinkCardsModal.vue');
  return g.includes('!taken.has(r.id)') && g.includes('(bag.items || []).slice(0, 6)') && g.includes('projectCardToBoard(d, id, ctx.wsId, ctx.catId)') && g.includes('function boardCardsInCat')
    && /export function buildDeliverJob[\s\S]*?adoptable: false[\s\S]*?return withReport\(job, ctx,[\s\S]*?\['成果文稿'\]/.test(g) && !/export function buildDeliverJob[\s\S]{0,900}?apply:/.test(g)
    && g.includes('rawText: true') && g.includes("label: '📥 下载 .md'") && g.includes('replace(/^```(?:md|markdown)?')
    && em.includes("import('@/shared/ai/batchG')") && gs.includes('成果文稿') /* ★G1(V3.8.25)随迁带备案：设置页卡片头 📄 前缀迁 <Icon name="compass">，「成果文稿」入口文案仍在 */
    && node.includes("emit('link-resource', node)") && mm.includes("@link-resource=\"emit('link-resource', $event)\"")
    && w.includes('@link-resource="openLinkCards"') && w.includes('<LinkCardsModal') && lm.includes('全部分类（资源卡池）')
    && !w.includes('<EvidenceMenuItem') && !w.includes('nodeMenu');
});
check('R144-6 入口零净增与懒化：Workspace 物理行数仍 ≤1500（裸 fs 尺，与 R115-1/R140-3 同刀）；G1/G3 两组件 AI 依赖全懒 + 自带样式（scoped 宿主跨不到 fragment 根）；手册 ai-3 收录四场景与软层级三规矩', () => {
  const ws = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8');
  const ta = read('/newtab/components/ThesisAiBtn.vue'); const em = read('/newtab/components/EvidenceMenuItem.vue'); const m = read('/newtab/manual-data.ts');
  return ws.split('\n').length <= 1500 && !ta.includes("from '@/shared/ai/") && !em.includes("from '@/shared/ai/")
    && ta.includes("import('@/shared/ai/batchG')") && ta.includes('.th-ai-btn {') && em.includes('.ev-item {')
    && m.includes("id: 'ai-3'") && m.includes('完成状态永不联动');
});

// ============== R146 · V3.1.0：视觉/交互审计第一刀（回退契约 + 「知」徽标 + 检索浮层两刀） ==============
/* R155：视觉底座类断言需要**同时覆盖 .css**——ALL_VUE146 只收 .vue，会漏掉 workspace.css / tokens.css
   这两个 z-index、字号、缓动散点最集中的地方（全站最大那片散点就在 workspace.css）。 */
check('R146-1 ★罗盘节点删除真源（回退契约①③）：确认先报数（项目/指标/任务）→ 快照摘除 → 3 秒撤销按原 index 插回；父已不在如实放弃不静默吞；四视图零就地 splice', () => {
  const ct = CT_ALL; const pc = read('/newtab/views/ProjectCuration.vue'); const pd = read('/newtab/components/ProjectDetailDrawer.vue'); const ch = read('/newtab/views/CompassHome.vue')
  return CRUD146.includes('export function removeCompassNode') && CRUD146.includes('export function restoreCompassNode') && CRUD146.includes('list.splice(Math.min(snap.index, list.length), 0, snap.node)')
    && CRUD146.includes('export function compassNodeCounts') && CRUD146.includes("label: '战略目标'") && CRUD146.includes("label: '攻坚项目'") && CRUD146.includes("label: '成功指标'")
    && CRUD146.includes('if (!list) return false') && ct.includes('removeCompassNode') && ct.includes('restoreCompassNode') && ct.includes('compassNodeCounts')
    && !/directions\[[^\]]*\]\.projects\.splice/.test(ct) && !pc.includes('metrics.splice') && !pd.includes('metrics.splice') && !ch.includes('metrics.splice')
});
check('R146-2 ★策展台两语义拆名（回退契约④）：归档=archived+卡搬他台待分类+投射与镜像随台摘；删除=台移除+卡与分类一律软删进回收站+3 秒整台撤销；两入口文案自解释、零原生 confirm', () => {
  const app = read('/newtab/App.vue'); const wm = read('/newtab/composables/useWsMeta.ts')
  return CRUD146.includes('export function archiveWorkspace') && CRUD146.includes('ws.archived = true') && CRUD146.includes("name === '待分类'")
    && CRUD146.includes('export function deleteDeck') && CRUD146.includes('if (wsId === CURATION_WS_ID) return null')
    && app.includes('async function archiveDeck') && /<Icon name="package"[^>]*\/> 归档此台（卡移至待分类）/.test(app) && app.includes('archiveWorkspace(store.data, ws)') && !app.includes('async function deleteWorkspace')
    && wm.includes('const snap = deleteDeck(d.value, workspaceId.value)') && wm.includes('restoreDeck(d.value, snap)') && wm.includes('deckCardCount')
    && !app.includes('confirm(') && !wm.includes('window.confirm')
});
check('R146-3 回收站两口径（回退契约⑤⑥）：永久删除必过确认且回执点名对象、批量恢复只报一条账、清空带条数与后果、分类分区补齐永久删除；硬删仍统一引擎（附件在引擎内清）', () => {
  const rb = read('/newtab/views/RecycleBin.vue'); const gs = read('/newtab/views/GlobalSettings.vue')
  const seg = segOf(rb, 'async function purgeWith', '// ---- 全部恢复 / 清空 ----')
  return seg.includes("title: '永久删除'") && seg.includes('此操作不可恢复') && seg.includes('已永久删除') && rb.includes('function purgeCat')
    && (rb.match(/purgeWith\('/g) || []).length === 5 // R2-⑤：论证卡分区补齐，永久删除回执点名对象由四路增至五路
    && rb.includes('show(`已恢复 ${list.length} 项') && rb.includes('confirmText: `清空 ${list.length} 项`')
    && gs.includes('confirmText: `永久删除 ${n} 项`') && gs.includes('recycledCardsOf(d)')
});
check('R146-4 toast 队列（回退契约⑦）：最多叠 3 条、同文案+同动作合并计数、撤销动作在合并项上仍可点、时长 2400ms（★G5(V3.8.27) 重指：3000 → 2400，队列与合并语义一字不动）', () => {
  const t = read('/shared/components/toast.ts'); const v = read('/shared/components/Toast.vue')
  return t.includes('const TOAST_DURATION = 2400') && t.includes('const TOAST_STACK = 3') && t.includes('while (items.value.length > TOAST_STACK)')
    && t.includes('last.msg === msg') && t.includes('last.n++') && t.includes('export function runToastAction') && t.includes('export const toastState')
    && v.includes('toastState') && v.includes('TransitionGroup') && v.includes('var(--toast-bg)')
});
check('R146-5 ★AI 入口徽标全站统一（**R155 换骨：emoji → 单色线性 SVG**）：AiMark 除 AiEntryButton 外零引用、徽标尺寸只走令牌、以 currentColor 随主题着色；入口组件带 spin 态，五处原零反馈入口补互斥锁', () => {
  const dirty = ALL_VUE146.filter(f => read(f).includes('🤖') && !f.endsWith('AiMark.vue') && !f.endsWith('GlobalPopups.vue') && !f.endsWith('LinkCardsModal.vue')) /* R152 起口径：写进卡片的「AI 出品」数据前缀（aiMarks/chain）与检索命中徽标不算入口；R155 后入口徽标已无 emoji，余下 emoji 只活在数据与手册里。R161：镜像弹窗（LinkCardsModal.vue）的命中徽标与检索面板（GlobalPopups.vue）同款同义，按同一条口径豁免 */
  const zm = read('/shared/components/AiMark.vue')
  const ae = read('/shared/components/AiEntryButton.vue')
  /* R155-⑤：全站只许 AiEntryButton 引 AiMark（原 24 处/17 文件直挂已收敛） */
  const zhiRefs = ALL_VUE146.filter(f => read(f).includes('@/shared/components/AiMark.vue') && !f.endsWith('AiEntryButton.vue') && !f.endsWith('AiMark.vue'))
  const aeUsers = ALL_VUE146.filter(f => read(f).includes('AiEntryButton')).length
  return dirty.length === 0 && zhiRefs.length === 0 && aeUsers >= 16
    && zm.includes('viewBox') && zm.includes('currentColor') && zm.includes('stroke-width') && !zm.includes('>🤖<') && !zm.includes('fontSize')
    && zm.includes('@keyframes ai-turn') && zm.includes('prefers-reduced-motion')
    && ae.includes("from '@/shared/components/AiMark.vue'") && ae.includes('var(--icon-sm)') && ae.includes('var(--icon-lg)') && !ae.includes(':size=')
    && read('/newtab/components/ResourceAiStrip.vue').includes("const busy = ref<'' | 'enrich' | 'linkTask'>('')") /* R167：两枚入口的互斥锁随入口一起搬进共享组件 */
    && read('/newtab/components/CardAiEntry.vue').includes('if (busy.value) return') && read('/newtab/components/EvidenceMenuItem.vue').includes('if (busy.value) return')
    && read('/newtab/components/TaskAddDrawer.vue').includes('if (aiBusy.value || !aiSay.value.trim()) return')
});
check('R146-6 ★检索类 AI 入口的提速骨架（实测"点了就一直等"后定）：流式 + JSON 一闭合即掐连接 + 30 秒硬超时 + 外部可中止；浮层侧秒数/字数回显、再点取消、改词与关面板静默中止、同词走缓存；零写库不变 · R150 备案：这套骨架原本钉在 rerankSearch 上，随「AI 理解」并入「AI 检索」已整体搬进 select.ts 的 askOnce/semanticSearch（maxTokens 420→520 因候选量变大），机制一字未松', () => {
  const g = read('/newtab/components/GlobalPopups.vue'); const sel = read('/shared/ai/select.ts')
  return sel.includes('export async function semanticSearch') && sel.includes('await chatStream(') && sel.includes('maxTokens: 520') && sel.includes('const SEARCH_TIMEOUT_MS = 30000')
    && sel.includes('function searchReady') && sel.includes('if (!early && searchReady(a)) { early = true; ac.abort() }') && sel.includes("opts.signal?.addEventListener('abort', relay)")
    && g.includes('点击取消本次 AI 检索') && g.includes('const aiCache = new Map<string, AiOut>()') && g.includes("watch(searchQuery, () => { aiSearch.value = null; aiAbort(''); recordedQ = '' })") && g.includes('watch(activePanel, (p) => { if (p !== \'search\') aiAbort(null) })')
    && g.includes('检索中 ') && g.includes('已回 ') && !sel.includes('export async function rerankSearch')
});
check('R146-7 检索浮层类型 tab 版式（实测 emoji 把「搜全部」劈成两行）：七枚 tab 零图标前缀 + 单枚 nowrap + 窄窗整枚换行（flex-wrap）', () => {
  const g = read('/newtab/components/GlobalPopups.vue'); const tabs = segOf(g, '<div class="gp-type-tabs"', '<div class="gp-results"')
  return !/gp-type-tab[^>]*>[^\n<]*[🔍📄✅💡🗂📦]/.test(tabs) && (tabs.match(/class="gp-type-tab"/g) || []).length === 6 && tabs.includes('gp-ai-tab')
    && g.includes('.gp-type-tabs { display: flex; flex-wrap: wrap;') && g.includes('white-space: nowrap; flex-shrink: 0;')
});
check('R146-8 设置页左栏与清缓存真回执（回退契约⑧⑨）：回收站作路由出口常驻「数据」组（深链不接受路由项）、导航项支持「知」徽标；清除缓存点名清了什么（网页正文 + 抽读缓存计数），不再空报', () => {
  const gs = read('/newtab/views/GlobalSettings.vue'); const lf = read('/shared/ai/linkFetch.ts')
  return gs.includes("interface NavItem { key: string; icon?: string; label: string; route?: string; mark?: boolean }") && gs.includes("function onNavClick(item: NavItem)")
    && gs.includes("{ key: 'recycle', icon: 'trash', label: '回收站', route: '/recycle' }") && gs.includes('i.key === p && !i.route') /* ★G1(V3.8.25)随迁带备案：🗑 迁 Icon 名 'trash'（导航图标统一走 <Icon :name>），路由出口与深链纪律不变 */
    && gs.includes('clearLinkCache()') && gs.includes('reviseSnips.size') && gs.includes('卡片数据与附件本体不动') && lf.includes('export function clearLinkCache')
});
check('R146-9（R155-⑤ 备案：入口组件化，末尾锚点 AiMark → AiEntryButton）项目页 AI 入口补位（用户点名需求）：每个指标行有「按本指标建议近两周任务」、每个任务行（含未归类区）有 AI 辅助菜单（拆解/推荐卡/详情）· R147 备案：菜单搬进 TaskAiMenu 共享组件，页面只留引用', () => {
  const pc = read('/newtab/views/ProjectCuration.vue')
  return pc.includes("async function aiChainAt(level: 'tasks', anchorId: string)") && pc.includes("aiChainAt('tasks', m.id)") && pc.includes("buildChainJob(level, anchorId,")
    && (pc.match(/<TaskAiMenu :task=/g) || []).length === 2 && pc.includes("import TaskAiMenu from '@/newtab/components/TaskAiMenu.vue'")
    && !pc.includes('openAiMenu') && (pc.match(/<AiEntryButton/g) || []).length >= 2
});

// ============== R147 · V3.2.0：视觉/交互审计第二刀（AI 表达） ==============
check('R147-1 ★弱相关建议行默认不勾（不再用勾选率假装准确）：抽屉 picked 初始化剔除 weak、行上有「低置信」徽标与「只留高置信」，全选仍可整批勾上（判定权在人）；判弱只准用客观信号——缺理由 / 体系外新词 / 没点到佐证卡', () => {
  const j = read('/shared/ai/job.ts'); const sel = read('/shared/ai/select.ts'); const g = read('/shared/ai/batchG.ts'); const c = read('/shared/ai/chain.ts')
  return j.includes('weak?: boolean') && DRAWER147.includes("out.filter(r => !r.advisory && !r.weak && !r.optIn && r.changeType !== 'same')") && DRAWER147.includes("function pickStrongOnly()")
    && DRAWER147.includes('低置信') && DRAWER147.includes('只留高置信') && DRAWER147.includes('picked.value.size === adoptableRows.length')
    && g.includes('weak: !cardIds.length') && g.includes('weak: !reason') && c.includes('weak: !s.why?.trim()')
});
check('R147-2 ★投料计数改在线路处结算：chat/chatStream 真正发出那一刻回调上报（含网关 usage 真 token），自定义 run（多批归架/多专家会诊/按需抓正文）不再是「投料 0 字」；抽屉累计并显示次数与耗时', () => {
  const l = read('/shared/ai/llm.ts'); const gv = read('/shared/ai/govern.ts')
  return l.includes('export function setLlmFeedSink') && l.includes('function reportFeed(') && (l.match(/reportFeed\(opts\.messages/g) || []).length === 2 && l.includes('if (j?.usage) usage = j.usage')
    && DRAWER147.includes('setLlmFeedSink((m) =>') && DRAWER147.includes('f.chars += m.inChars') && DRAWER147.includes('const secs = ref(0)') && DRAWER147.includes('setLlmFeedSink(null)')
    && !DRAWER147.includes('inputChars') && (gv.match(/async run\(\{ signal, onDelta \}\)/g) || []).length === 2
});
check('R147-3 消毒账与空态真因点名：AiJob.audit 契约（零参、计数由工厂闭包按次攒）；五处工厂记丢弃原因，抽屉工具条显示一行、空态直接说清"投料多少/丢了几行为什么"；拆解的「思路」行改 advisory（勾了什么都不发生的行不再算采纳项）', () => {
  const j = read('/shared/ai/job.ts'); const sel = read('/shared/ai/select.ts'); const g = read('/shared/ai/batchG.ts'); const c = read('/shared/ai/chain.ts'); const gs = read('/newtab/views/GlobalSettings.vue')
  return j.includes('audit?: () => string | null') && DRAWER147.includes("auditLine.value = job.audit?.() || ''") && DRAWER147.includes('模型没有给出可采纳的建议')
    && (sel.match(/audit: \(\) =>/g) || []).length === 0 && sel.includes('searchDropCount') && (g.match(/audit: \(\) =>/g) || []).length === 3 && gs.includes('audit: () =>')
    && c.includes("key: 'breakdown:plan', badge: '思路', advisory: true") && g.includes('drop.badVerdict++') && g.includes('drop.ghost++')
});
check('R147-4 ★打标克制落到行级：AI 造的体系外新词单独成行且默认不勾；knownTagSet/freshTagsOf 为唯一口径（树上路径∪叶子名活卡在用），三处消费（单卡补全/批量补全/详情抽屉）同判；RDD 仍零静态引 shared/ai（启动链红线不破）· R167 重指：select 里两枚单卡工厂并成一枚 buildResourceEnrichJob，"每个单卡写库入口都要切这道闸"的判据随之改为**跨文件按工厂分段核**（资源 enrich + 任务 enrich 各一段），合并入口不得再留下"没装闸的那条"', () => {
  const tg = read('/shared/utils/tags.ts'); const sel = read('/shared/ai/select.ts'); const te = read('/shared/ai/taskEnrich.ts'); const rdd = read('/newtab/components/ResourceDetailDrawer.vue'); const st = read('/newtab/components/ResourceAiStrip.vue'); const gs = read('/newtab/views/GlobalSettings.vue')
  const NEWWORD = "badge: '新词', badgeType: 'warn', weak: true"
  return tg.includes('export function knownTagSet') && tg.includes('export function freshTagsOf') && tg.includes('if ((c as { deletedAt?: number }).deletedAt) continue')
    && sel.includes(NEWWORD) && te.includes(NEWWORD) && gs.includes('const fresh = freshTagsOf(addTags, known)')
    /* 计数按"文件里出现几次"不够：同一工厂写两遍、另一工厂零遍也会等于 2 ⇒ 按工厂分段各自必含 */
    && (sel.match(new RegExp(NEWWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1
    && segOf(sel, 'export function buildResourceEnrichJob', '\nexport function buildTaskParseJob').includes(NEWWORD)
    && segOf(sel, 'export function buildResourceEnrichJob', '\nexport function buildTaskParseJob').includes('freshTagsOf(')
    && segOf(te, 'export function buildTaskEnrichJob', '\n}').includes(NEWWORD) && segOf(te, 'export function buildTaskEnrichJob', '\n}').includes('freshTagsOf(')
    && st.includes('buildResourceEnrichJob(card, ctx)')
    && !rdd.includes("from '@/shared/ai/llm'") && !rdd.includes("import { chat") && !st.includes("from '@/shared/ai/llm'")
});
check('R147-5 ★任务级「知」菜单共享化并跨视图落位：TaskAiMenu.vue 自包含（按钮+浮层菜单+评审抽屉+样式+AI 懒栈），项目详情页两处行位与任务面板列表/看板 9 处行位同组件 · W6 再随迁（V3.8.6 #3）：卡片视图 3 处行位改 TaskAiCorner（右上角角标直跑补全，自包含+AI 懒栈，打开详情走单击卡片 onTaskRowClick），菜单形态零残留于卡片视图 · R151 备案：本条原写"6 处（卡/列表/看板×2 形态）"，实为卡片与列表两视图共 6 处、看板 6 处一直缺位（写断言时按字面数了行数没核视图），R151 补齐后按 12 处钉，W6 按 9+3 拆分', () => {
  const m = read('/newtab/components/TaskAiMenu.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); const tp = read('/newtab/components/compass/TaskManagerPanel.vue'); const ca = read('/newtab/components/TaskAiCorner.vue')
  return !m.includes("from '@/shared/ai/") && m.includes("import('@/shared/ai/chain')") && !m.includes("import('@/shared/ai/select')") && m.includes("import { AiDrawer } from './lazyAiDrawer'") /* R152：并入全站单例 */
    && m.includes('.tam-menu {') && m.includes('拆解成子任务') && m.includes("emit('detail'") && m.includes('if (busy.value) return')
    && (pc.match(/<TaskAiMenu :task=/g) || []).length === 2 && (tp.match(/<TaskAiMenu :task=/g) || []).length === 7 && (tp.match(/<TaskAiCorner :task=/g) || []).length === 3 && tp.includes('function openTaskFromAi')
    && ca.includes("import('@/shared/ai/taskEnrich')") && ca.includes('buildTaskEnrichJob') && ca.includes('class="taic-btn"') && ca.includes("import { AiDrawer } from './lazyAiDrawer'")
    && !ca.includes("from '@/shared/ai/") /* W6：角标同款 AI 零静态引用纪律 */
    && !pc.includes('ai-menu-item') && fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8').split('\n').length <= 1500
});
check('R147-6 论点骨架结构化只读预览：aiMarks 写读同源真源（batchG 写、ThesisBlock 读同一串字面量）；解析不出中心论点就整块不渲染（回落原文，绝不编结论）；与一级分类只做 ✓已建架/○未建架 只读对照，零写库', () => {
  const mk = read('/shared/models/aiMarks.ts'); const tb = read('/newtab/components/ThesisBlock.vue'); const g = read('/shared/ai/batchG.ts'); const rdd = read('/newtab/components/ResourceDetailDrawer.vue')
  return mk.includes("export const THESIS_MARK = '🤖 中心论点：'") && g.includes('new RegExp(`\\n*${THESIS_MARK}') && g.includes('seg.push(\'\', THESIS_PARTS_MARK)')
    && tb.includes('const i = t.indexOf(THESIS_MARK)') && tb.includes('if (!thesis) return null') && tb.includes('v-if="parsed"') && !tb.includes('store.persist') && !tb.includes('saveData')
    && tb.includes('shelved: catNames.has(name)') && rdd.includes('<ThesisBlock v-if="resource?.isThesis"')
});

// ============== R148 · V3.3.0：性能刀（实测驱动）+ AI 任务后台化 ==============
check('R148-1 ★热度统计拆独立键（单击卡片不再重写整库）：zy_stats_v1 只装 callCount/lastCalledAt + stats 段；主树仍是唯一消费口径；整库写入必同步刷新热度键（杜绝"旧热度盖住新导入"）；回滚连热度键一起清', () => {
  const st = read('/shared/storage/stats.ts'); const app = read('/newtab/stores/app.ts'); const gs = read('/newtab/views/GlobalSettings.vue')
  return HOT148.includes('export const HOT_KEY = K.STATS') && HOT148.includes('export function applyHot') && HOT148.includes('export function clearHot')
    && REPO148.includes('cs.get([STORAGE_KEY, HOT_KEY])') && REPO148.includes('if (hot) applyHot(data, hot)') && REPO148.includes('data.hotStatsSplitAt')
    && (REPO148.match(/writeHot\(/g) || []).length >= 1 && (REPO148.match(/extractHot\(cache!?\)/g) || []).length === 2 && app.includes('function persistHot(immediate?: boolean)') /* R173-T2：签名扩 immediate（页隐藏补写跳防抖） */
    && (read('/newtab/composables/useResourceDrawer.ts').includes('persistHot') && read('/newtab/components/GlobalPopups.vue').includes('persistHot')) && gs.includes('clearHot()') && !/recordWorkspaceOpen\([\s\S]{0,120}?store\.persist\(\)/.test(read('/newtab/components/GlobalPopups.vue')) /* R173-T3：两处台跳转（locateCat / ws 条目）只动 ws 热度，改走 persistHot 小载荷——再出现整库 persist() 即红 */
    && !st.includes('TODO')
});
check('R148-2 内存脏计数取代"写盘成功才自增"的 dataVersion 作派生缓存依据（防抖窗口内读到旧索引这条隐患一并堵）', () => {
  const m = read('/shared/utils/maturity.ts')
  return REPO148.includes('export function getMutationSeq') && REPO148.includes('export function markDataDirty') && (REPO148.match(/markDataDirty\(\)/g) || []).length >= 3
    && m.includes('import { getMutationSeq }') && m.includes('const taskMemo = new WeakMap') && m.includes('function bumpAggSeq') && m.includes('aggMemo.clear()')
});
check('R148-3 标签用量一次建表（原按树节点各扫全库 = O(标签数 × 全部卡)）：排除回收站软删卡逐字保留 · R151 备案：表键从"标签字符串"升级为"树节点路径 + 祖先"（根含子树合计），缓存失效多一道树版本戳', () => {
  const g = read('/newtab/views/GlobalSettings.vue')
  return g.includes('function tagUsageMap()') && g.includes('if (x.deletedAt || !Array.isArray(x.tags)) continue') && g.includes("const lf = t.split('/').pop() || t")
    && g.includes("for (const n of nodes) { bump(n); const i = n.indexOf('/'); if (i > 0) bump(n.slice(0, i)) }")
    && g.includes('const rev = d.tagTreeRevision || 0') && g.includes('function tagUsage(name: string): number {') && !g.includes('tagUsageOld')
});
check('R148-4 KeepAlive 扩到设置页/回收站/项目详情/方向树（四页都是重计算首屏，此前每次进全量重挂）+ 显式实例名 ★R3-B1：方向台两级从 Shell 内层 keep-alive 上收到 App 级 include', () => {
  const a = read('/newtab/App.vue');
  const inc = (a.match(/keep-alive include="([^"]+)"/) || [, ''])[1].split(',')
  return inc.includes('GlobalSettingsView') && inc.includes('RecycleBinView') && inc.includes('CompassTreeView') && inc.includes('ProjectCurationView')
    && read('/newtab/views/GlobalSettings.vue').includes("defineOptions({ name: 'GlobalSettingsView' })") && read('/newtab/views/RecycleBin.vue').includes("defineOptions({ name: 'RecycleBinView' })")
    && read('/newtab/views/ProjectCuration.vue').includes("defineOptions({ name: 'ProjectCurationView' })") && CT_ALL.includes("defineOptions({ name: 'CompassTreeView' })")
});
check('R148-5 ★AI 任务与抽屉解绑：runner 按 jobKey 幂等（在跑 attach / 跑完看结果 + 重新运行）、关抽屉不杀任务、并发上限 2 超出排队、投料账随任务走 · R149 备案两处：① 绑 key 的活从"宿主各传 job-key"改成抽屉自己认 job.key（见 R149-3），close 判据锚随之由 props.jobKey 换成 keyOf；② 中止后不再 drop 整条任务而是记 stopped（见 R149-7），AbortError 分支字面量随之改写', () => {
  const r = read('/shared/ai/runner.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); const g = read('/newtab/views/GlobalSettings.vue')
  return r.includes('const MAX_PARALLEL = 2') && r.includes('export function openJob') && r.includes('export function rerunJob') && r.includes("if ((e as Error).name === 'AbortError') { patch(key, { phase: 'stopped', finishedAt: Date.now() }); return }")
    && r.includes('function pump()') && r.includes('setLlmFeedSink(')
    && w.includes('const props = defineProps<{ job: AiJob | null; jobKey?: string }>()') && w.includes("if (keyOf.value) { emit('close'); return }") && w.includes('↻ 重新运行') && w.includes('排队中')
    && g.includes('const aiJobKey') && g.includes('const aiTray = computed') && g.includes('listJobStates') && g.includes('ai-tray-row')
});
check('R149-1 ★三处报告型统一「跑完自动落一张卡、采纳按钮撤掉」（用户拍板）：周回顾/深度洞察/成果文稿全部 withReport + adoptable:false 且不再自带 apply；旧文案里的「采纳=存卡」改写为「跑完自动存…不必再点采纳」，成果文稿保留 📥 下载 .md 作次通道', () => {
  const s = read('/shared/ai/select.ts'); const g = read('/shared/ai/batchG.ts')
  const fns = { review: /export function buildReviewJob[\s\S]*?\n}/.exec(s)?.[0] || '', insight: /export function buildInsightJob[\s\S]*?\n}/.exec(s)?.[0] || '', deliver: /export function buildDeliverJob[\s\S]*?\n}/.test(g) ? g.slice(g.indexOf('export function buildDeliverJob')) : '' }
  return Object.values(fns).every(b => b.includes('withReport(') && b.includes('adoptable: false') && !/^ {4}apply: \(/m.test(b))
    && fns.review.includes("['周回顾']") && fns.insight.includes("['深度洞察']") && fns.deliver.includes("['成果文稿']")
    && !/采纳=存为|采纳=存「/.test(s + g) && s.includes('不必再点采纳') && fns.deliver.includes("label: '📥 下载 .md'")
});
check('R149-2 ★报告型撤采纳后"只一张卡"：saveReportCard 先按同名 + 报告标签查重，命中就刷新那张（description/tags/updatedAt）不再 unshift——同日重跑是刷新不是攒卡；新建路径仍只进资源台待分类', () => {
  const rp = read('/shared/ai/reports.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return rp.includes('const dup = (d.resources || []).find(') && rp.includes('r.title === title') && rp.includes('includes(REPORT_TAG)')
    && rp.includes('报告已刷新') && rp.includes('d.resources.unshift(card)') && !rp.includes('d.resources =') && !rp.includes('splice(')
    && w.includes('const hasAdopt = computed(() => !!cur.value?.apply')
});
check('R149-3 ★jobKey 收口在抽屉一处（keyOf = 显式 jobKey > job.key > 空=一次性）：13 个宿主零改动即获得后台化/attach/托盘，工厂加场景不必记着接线；据此每条 build*Job 都必须自带 key（缺 key 就退回"关抽屉=杀任务"，用正则当场点名）· R167：扫描面补上 R166/R167 新增的三个工厂文件（taskEnrich/taskSupport/resourceLinkTask），新文件不并进扫描面=新入口可以无 key 溜过', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue'); const j = read('/shared/ai/job.ts')
  const files = ['select.ts', 'batchG.ts', 'chain.ts', 'govern.ts', 'taskEnrich.ts', 'taskSupport.ts', 'resourceLinkTask.ts'].map(f => '/shared/ai/' + f)
  const noKey = files.flatMap(f => { const s = read(f); return (s.match(/export function build\w+Job[^\n]*\n/g) || []).map(hdr => { const i = s.indexOf(hdr); return /key: /.test(s.slice(i, i + 4000)) ? '' : f + hdr.slice(0, 40) }).filter(Boolean) })
  return w.includes("const keyOf = computed(() => props.jobKey || props.job?.key || '')") && w.includes('const bound = computed<JobState | null>(() => (keyOf.value ? getJobState(keyOf.value) || null : null))')
    && j.includes('key?: string') && noKey.length === 0 && read('/newtab/views/GlobalSettings.vue').includes("key: 'enrich:batch:'") && read('/newtab/components/ResourceAiStrip.vue').includes('buildResourceEnrichJob(card, ctx)')
});
check('R149-4 ★runner 轮次所有权：每个 key 记第几轮（attempts），只有当前轮能落结果/清投料 sink/回收任务——rerun 与被停旧请求晚到的回调不再误杀新一轮；rerunJob 走 drop 而非裸 delete', () => {
  const r = read('/shared/ai/runner.ts')
  return r.includes('const attempts = new Map<string, number>()') && r.includes('const myAttempt = (attempts.get(key) || 0) + 1') && r.includes('const mine = () => attempts.get(key) === myAttempt')
    && (r.match(/if \(!mine\(\)\)/g) || []).length >= 2 && r.includes('if (mine()) { stopTicker(key); setLlmFeedSink(null); pump() }')
    && /export function rerunJob[\s\S]*?drop\(key\)/.test(r) && !/states\.value\.delete\(key\)/.test(r)
});
check('R149-5 换专家=新起一轮，同 key 再点=attach：抽屉 watch 只在 persona.current 变了才 rerunJob（换视角是用户点名重问），其余一律不重跑；报告型无 apply 时抽屉撤勾选框/全选/低置信按钮（没有要采纳的东西还让人勾是假动作），产出行仍整篇呈现', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes('if (j && st.job.persona && j.persona && j.persona.current !== st.job.persona.current) rerunJob(k, () => withDirective(j))')
    && w.includes('const picksSomething = computed(() => hasAdopt.value || !!cur.value?.secondary)')
    && w.includes('<label v-if="picksSomething" class="ai-all">') && w.includes('整篇成文，跑完自动落卡')
    && w.includes(':class="{ on: picksSomething && !r.advisory && picked.has(r.key), advisory: r.advisory || !picksSomething')
});
check('R149-6 落卡兜底不脱钩：宿主漏绑 key 且 job 是报告型时，抽屉自己结算 autoReport（撤了采纳按钮就不能再依赖 runner 才落卡）；跑完中途被停/被换轮则不落（phase 必须是 running 才结算）', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue'); const r = read('/shared/ai/runner.ts')
  return w.includes('if (job.autoReport && !keyOf.value) {') && w.includes('savedNote.value = job.autoReport.save(p)') && w.includes('const vSaved = computed(')
    && r.includes('if (!mine() || !live || live.phase !== \'running\') return') && w.includes('v-if="vSaved" class="ai-saved"')
});
check('R149-7 ⏹ 停止不留空白：AbortError 改记 stopped（旧版直接 drop 整条任务，抽屉只剩一片什么都没有的空壳），托盘行同步标「已停止」，抽屉给「↻ 重新运行」出口；停止=本轮作废，autoReport 不得落半张卡', () => {
  const r = read('/shared/ai/runner.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); const g = read('/newtab/views/GlobalSettings.vue')
  return r.includes("export type JobPhase = 'queued' | 'running' | 'done' | 'error' | 'stopped'")
    && r.includes("if ((e as Error).name === 'AbortError') { patch(key, { phase: 'stopped', finishedAt: Date.now() }); return }")
    && r.includes("if (!mine() || !live || live.phase !== 'running') return")
    && w.includes("v-else-if=\"vPhase === 'stopped'\"") && w.includes('本轮结果作废') && w.includes('.ai-stopped {')
    && g.includes("s.phase === 'stopped' ? '已停止（本轮结果作废，可重跑）'") && g.includes('.ai-tray-dot.stopped')
});
check('R151-2 ★梳理范围与证据边界：tagCards() 把资源/任务/好奇三类卡并成一套读法（label 对好奇卡取 question），蓝图与归架两阶段共用；findTagCard 三数组找卡（apply 不再只查 resources）；两段提示词都写死"只有卡面字段、没有正文"，归架描述只在完全为空时补', () => {
  const g = read('/shared/ai/govern.ts'); const sc = read('/shared/ai/scenarios.ts')
  return g.includes('function tagCards(d: AppData): TagCardLike[]') && g.includes('label: c.question') && g.includes('const cards = tagCards(ctx.d)')
    && g.includes('function findTagCard(d: AppData, id: string)') && g.includes('const card = findTagCard(ctx.d, s.cardId)')
    && sc.includes('**只有卡面字段**') && sc.includes('没有链接正文') && g.includes('if (x.deletedAt) return')
});
check('R151-3 ★预估收卡数必须是本地核算，不是模型口算：estimateFit 用「卡面现有标签 × 迁移映射」数出 byPath/byRoot，命中子标签时按卡去重后计入祖先（与 R151 角标同口径）；行文案显示「预计 N 张」，参谋行报 covered/bare/total；提示词的输出 schema 里没有 count 字段（模型拿不到也报不了）', () => {
  const g = read('/shared/ai/govern.ts'); const sc = read('/shared/ai/scenarios.ts')
  return g.includes('function estimateFit(') && g.includes('预计 ${est.byRoot.get(r.name) || 0} 张') && g.includes('${est.byPath.get(r.name + \'/\' + c.name) || 0} 张')
    && g.includes('张卡已有归宿') && g.includes('数字是本地数出来的，不是模型报的')
    && !/tree":\[\{[^}]*count/.test(sc) && sc.includes('按这张表逐卡改写标签')
});
check('R151-4 ★采纳=真·整树替换（四坑逐条钉住）：① TagNode.definition 落库（阶段③与刷新后都读得到，内存态 lastTagTreeBlueprint 已删）；② tagTreeRevision +1 且 repository 合并按版本胜出（旧节点不会再被并回来）；③ apply 先按映射改写再把不在新树里的标签**剪掉**并分开报 moved/cleared；④ 快照含描述、还原也推版本戳', () => {
  const g = read('/shared/ai/govern.ts'); const m = read('/shared/models/index.ts'); const r = read('/shared/storage/repository.ts')
  return m.includes('definition?: string') && m.includes('tagTreeRevision?: number')
    && g.includes('definition: r.definition || undefined') && g.includes('ctx.d.tagTreeRevision = (ctx.d.tagTreeRevision || 0) + 1') && !g.includes('lastTagTreeBlueprint')
    && r.includes('function mergeTagTree(') && r.includes('if (re > rs) return ext.tagTree || []') && r.includes('tagTree: mergeTagTree(cur, snap, ext)')
    && g.includes('张旧标签已剪空') && g.includes('const keep = new Set<string>()')
});
check('R151-5 ★角标与预估同源（否则用户没法信方案）：cardHasTag 认「名/子」前缀，tagUsageMap 命中子标签时给祖先 bump，一张卡在同一子树里只算一次', () => {
  const g = read('/newtab/views/GlobalSettings.vue')
  const seg = g.slice(g.indexOf('function tagUsageMap()'), g.indexOf('function tagUsage(name'))
  return g.includes("t.startsWith(name + '/')") && seg.includes('const nodes = new Set<string>()') && seg.includes("bump(n.slice(0, i))") && seg.includes('nodes.add(p)')
});

/* ===== R151-B2 · 三类卡 × 四视图（卡片/列表/看板 + 详情）AI 入口齐活 ===== */
check('R151-6（V3.9.8 随迁备案）★AI 入口按“卡种 × 现役视图”点齐：资源卡池列表 / 网格各一 + 策展详情正文首行 ResourceAiStrip（镜像只读不给）；任务卡看板 6 处补齐（见 R147-5 随迁）；好奇卡卡片 hover / 列表 / 看板 / 详情四处单卡研判 + 批量钮走同一条 aiTriage 通道。旧 Workspace 三视图动作条零命中', () => {
  const w = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8')
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue')
  const cp = read('/newtab/components/compass/CuriosityPanel.vue'); const ce = read('/newtab/components/CardAiEntry.vue'); const bg = read('/shared/ai/batchG.ts'); const m = read('/newtab/manual-data.ts')
  // 资源卡现役两视图：列表 / 网格各一；策展台内详情另有 ResourceAiStrip
  const poolListAi = (pool.match(/<CardAiEntry v-if="!batchMode" :card="r" \/>/g) || []).length
  const poolGridAi = (pool.match(/<CardAiEntry :card="r" \/>/g) || []).length
  const lineGate = w.split('\n').length <= 1500
  // 好奇卡：三视图单卡 + 详情一处；批量钮必须显式空参（否则 MouseEvent 会被当成单卡入参）
  const curioEntries = (cp.match(/aiTriage\(c\)/g) || []).length
  return poolListAi === 2 && poolGridAi === 1 && lineGate && !ce.includes('label?: string') /* R167：卡面入口只留徽标形态，label 变体随"AI 进标题行"退役 */
    && !w.includes('<CardAiEntry :card="r" />')
    && w.includes('<ResourceAiStrip') && read('/newtab/components/ResourceDetailDrawer.vue').includes('<ResourceAiStrip')
    && ce.includes('class="rc-action ai"') && !ce.includes('dr-footer-btn') && w.includes('<template #title>')
    && curioEntries === 3 && cp.includes('aiTriage(detailItem)') && cp.includes('@click="aiTriage()"') && cp.includes('one.status !== \'todo\'')
    && bg.includes("pool.length < (single ? 1 : 3)") && bg.includes("'triage:' + pool[0].id")
    && m.includes('镜像卡不给入口') && m.includes('资源卡的补全与关联从资源卡池或卡详情进入') && m.includes('是同一条通道') && m.includes('换一张卡再点就是另起一轮')
});

/* ===== R151-C1/C2 · 门禁与归因工具收口 ===== */
check('R151-7 ★入口字面量闸落成脚本（不再每轮现推）：scripts/entry-literals.cjs 三件事一起做——① 从 newtab 入口沿静态 import 爬闭包（动态 import 与 import type 不算依赖），② 闭包内 src/shared/ai/** 零静态运行时依赖（有边就点名"文件 → 目标"），③ 15 项字面量双向扫源码与 dist 入口 chunk；ASCII 项按词边界匹配（AiRowLite 这类本地别名不冒领 AiRow），flattenTaskTree 已移出清单并写明理由', () => {
  const t = fs.readFileSync(base + '/../scripts/entry-literals.cjs', 'utf8')
  return t.includes("path.join(SRC, 'newtab/main.ts')") && t.includes("next.includes('/shared/ai/')") && t.includes('const STRIP =')
    && t.includes('入口 chunk') && t.includes("\\b") && t.includes('flattenTaskTree 移出')
});
check('R151-8 ★M3c 归因工具留在门禁里：perf.cjs --profile 现在也单开一段窗口三 CPU 谱（写 .prof-window3.json），并加 --idle-control 静置对照——零交互 20s 出 0 条长任务，据此判掉"环境周期性噪声"这个错猜，结论改记"Blink 侧非 JS 时间"（下一刀用 trace 分类而不是 JS 采样器）', () => {
  const t = fs.readFileSync(base + '/../scripts/perf.cjs', 'utf8')
  return t.includes("--idle-control") && t.includes("M3d_静置20s长任务总计(ms)") && t.includes('.prof-window3.json') && t.includes("窗口三 CDP 采样 Top")
});

/* ===== R152 · 真机反馈刀（V3.7.0）：体检补账 / 定位让路 / 页脚状态 / 懒抽屉单例 ===== */
check('R152-1 ★标签体检不再"空得没有理由"：drop 四类账（契约不认/标签对不上库/目标不在树/自己合自己）+ audit() 点名，且带一条真实例证（最多两行原文写法）；蓝图与体检共用同一个 findTagIn 归一（剥 # 前缀、剥「（N 次）」尾巴、全名/叶子双口径）——判据变准不是变松，落库一律用回查到的库里真名', () => {
  const g = read('/shared/ai/govern.ts')
  return g.includes("const drop = { noContract: 0, notInUse: 0, notInTree: 0, self: 0 }") && g.includes('audit: () =>')
    && g.includes('模型没按契约给 merges/rehome') && g.includes('bad.length < 2') && g.includes('function findTagIn')
    && g.includes('const from = findTagIn(usedTags, m?.from); const to = findTagIn(known, m?.to)')
    && read('/shared/ai/scenarios.ts').includes('不要加 # 前缀')
});
check('R152-2 ★keep-alive 视图不许替别人消费 ?hl：资源台定位器在 hk 指明别的卡型时直接让路（真机"Ctrl+Enter 定位任务卡没反应"的真因——它抢着处理、弹"该卡片不在当前视图"并把 query 抹掉，任务面板随后滚不到）；纪律与 TaskManagerPanel 一字同源', () => {
  const w = read('/newtab/composables/useWsLocate.ts'); const t = read('/newtab/components/compass/TaskManagerPanel.vue')
  return w.includes("if (hkQ && hkQ !== 'res') return") && w.includes('别替别人消费') && t.includes("if (hk && hk !== 'task') return")
});
check('R152-3 ★手势矩阵收口：单击/Enter=打开、Ctrl+单击 与 Ctrl+Enter 同为"只定位"（把键盘约定平移到鼠标），AI 命中并入主列表每卡只一行（重复 id 曾让选中行与执行行不是同一条）；弱相关仍显式标「低置信」不许随并组藏掉', () => {
  const g = read('/newtab/components/GlobalPopups.vue')
  return g.includes('function pickRow(item: SearchResult, ev?: MouseEvent)') && g.includes('if (ev && (ev.ctrlKey || ev.metaKey)) { locateOnly(item); return }')
    && g.includes('const aiHitById = computed') && g.includes('name="sparkle"') && !g.includes('pair.hit.weak')
    && g.includes('rank.has(a.id)') && !g.includes("for (const pair of aiTopRows.value) out.push")
});
check('R152-4 ★"AI 动过"要有凭据：aiTouchedAt 由**每一枚会写卡/写关联的入口**共同盖戳（别做两套定义，也不能有一枚不盖）· R167 备案：资源侧入口从"页脚钮"变成共享 AI 行的两格，凭据据此翻「↻ 重新补全」＋行尾「最近 · 」；入口钮不再均分挤压的口径随版式搬到 .ds-ai-cell（说明行禁折行）；抽屉懒组件提到模块作用域单例（script setup 顶层=setup 函数体，原来每张卡新建一份组件定义）', () => {
  const m = read('/shared/models/index.ts'); const st = read('/newtab/components/ResourceAiStrip.vue'); const css = read('/shared/styles/detail-sheet.css')
  const c = read('/newtab/components/CardAiEntry.vue'); const lz = fs.readFileSync(base + '/newtab/components/lazyAiDrawer.ts', 'utf8')
  const stampFiles = ['select.ts', 'resourceLinkTask.ts', 'batchG.ts', 'chain.ts', 'taskEnrich.ts', 'taskSupport.ts']
  const missing = stampFiles.filter(f => !read('/shared/ai/' + f).includes('aiTouchedAt = Date.now()'))
  return m.includes('aiTouchedAt?: number') && missing.length === 0
    && st.includes("'↻ 重新补全' : 'AI 补全'") && st.includes('ds-ai-when')
    && css.includes('.ds-ai-cell .tx small') && css.includes('white-space: nowrap')
    && c.includes('class="rc-action ai"') && lz.includes("defineAsyncComponent(() => import('./AiSuggestionDrawer.vue'))") && !c.includes('defineAsyncComponent')
});

/* ===== R153 · 真库体检刀（版式 + 自诊） ===== */
check('R153-1（R155-③ 备案：摘要 2 行的取舍已由用户拍板）★体检发现的"真溢出"要修（页脚标签 chip 从 flex-shrink:0 改成可缩 + 省略号 + 页脚 min-width:0/overflow:hidden 兜底）；原「.rc-desc 摘要截断属刻意取舍、改两行会破网格」的待决状态随富卡形态解除——卡高已改 120~160，等高网格前提不再成立', () => {
  const c = read('/newtab/components/compass/PoolCardsPanel.vue')
  const foot = c.slice(c.indexOf('.pcp-foot {'), c.indexOf('.pcp-mark'))
  const tag = c.slice(c.indexOf('.pcp-tag {'), c.indexOf('.pcp-date'))
  return foot.includes('min-width: 0') && foot.includes('overflow: hidden')
    && tag.includes('flex-shrink: 1') && tag.includes('text-overflow: ellipsis')
    && !c.includes('视觉取舍留给用户定')
});
/* R153-2 于 B7-e（V3.8.40）重指下限：R153 时按当时规范钉26px，M6 把热区下限抬到 28px
   （实测首屏仍有 27 处 <28px 的真交互元素，含 .tam-btn 20×17 这类）⇒ 原锚 26 假红。
   判据意图（命中区只量真交互元素 + 逐个抬到下限）不变，下限改为 28并写死为常量，
   将来再调只需改这一个数字、判据自己跟着走。 */
const HOT_MIN = 28;
check(`R153-2 ★命中区只量真交互元素并抬到 ${HOT_MIN}px（B7-e 从 26 抬到 28，M6 实测首屏热区下限；任务 AI 菜单钮 20×17 → min ${HOT_MIN}×${HOT_MIN}、排序下拉 15px 高 → min-height ${HOT_MIN}。★体检脚本同时修了假阳性——原来把 pointer 继承来的 span 也算成点击目标，一堆误报）`, () => {
  const m = read('/newtab/components/TaskAiMenu.vue')
  const deck = read('/newtab/components/compass/DeckControls.vue')
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue')
  return m.includes(`min-width: ${HOT_MIN}px; min-height: ${HOT_MIN}px`)
    && deck.includes(`min-height: ${HOT_MIN}px`)
    && pool.includes(`width: ${HOT_MIN}px`) && pool.includes(`height: ${HOT_MIN}px`)
});
check('R153-3 ★空态必须能自证：抽屉 0 行时给「看模型原文（N 字）」折叠 + 复制，判"模型没答"还是"答了被消毒丢掉"不必再猜；开关随每轮 run 收起（别拿上一轮原文糊弄这一轮）', () => {
  const d = read('/newtab/components/AiSuggestionDrawer.vue')
  return d.includes('看模型原文（') && d.includes('function copyRaw()') && d.includes('navigator.clipboard') && d.includes('showRaw.value = false')
});

check('R153-4（V3.9.13 重指）主攻百分比与指标条分母保持中性小字可读：sf-meta / mb-denom 走 --text-2，列数钮 24px；旧 fp-pct / cf-pct 随主攻项精简退役', () => {
  const ch = read('/newtab/views/CompassHome.vue'); const mb = read('/newtab/components/compass/MetricBar.vue'); const cp = read('/shared/components/ColsPicker.vue')
  return ch.includes('.sf-meta { color: var(--text-3);')
    && !ch.includes('.fp-pct')
    && !ch.includes('.cf-pct')
    && mb.includes('.mb-denom { font-size: var(--fs-caption); font-weight: 500; color: var(--text-2)') && cp.includes('width: 24px; min-width: 24px; height: 24px')
});
check('R150-1 ★检索类 AI 入口全站只留一枚：旧「AI 理解」通道整体退场（rerankSearch/rerankSystem/rerankReady/「AI 理解」字样在源码与断言锚点里都不该再存在），合并后的「AI 检索」把候选从"字面命中前 14 条"换成"库内三类卡"——用户换个说法也能召得回', () => {
  const g = read('/newtab/components/GlobalPopups.vue'); const sel = read('/shared/ai/select.ts'); const sc = read('/shared/ai/scenarios.ts')
  return !sel.includes('export async function rerankSearch') && !sc.includes('export const rerankSystem') && !sc.includes('搜索意图理解器') && !g.includes('aiRerankRun')
    && g.includes("'AI 检索'") && !g.includes("'AI 理解'") && sel.includes('export async function semanticSearch') && sel.includes('export async function semanticSearchAll')
    && g.includes('const aiCands = computed<AiCand[]>') && !g.includes('filteredResults.value.find')
});
check('R150-2 ★候选集口径说实话：res/task/curio 三类一视同仁、排除归档卡、跟着类型 tab 收窄，切到「策展台/项目」直接不给候选（它们不是卡）；投料上限按档位（eco80/std180/deep320）而非悄悄截断，结果里回报 scanned/total 让"只看了三成库"这件事可见', () => {
  const g = read('/newtab/components/GlobalPopups.vue'); const sel = read('/shared/ai/select.ts')
  return g.includes("if (r.archived) continue") && g.includes("if (want === 'ws' || want === 'proj') return []") && g.includes("r.type !== 'res' && r.type !== 'task' && r.type !== 'curio'")
    && sel.includes("SEARCH_CAP: Record<AiDepth, number> = { eco: 80, std: 180, deep: 320 }") && sel.includes('scanned, total, dropped: searchDropCount')
    && g.includes('投料 {{ aiSearch?.scanned }}/{{ aiSearch?.total }} 张')
});
check('R150-3 ★手势与主列表逐字一致且不写库：AI 行走同一个 pickRow + 同一句 title 文案（两处字面量一模一样）+ 同一个 hover 选中；键盘扁平列表把 AI 组排在主列表之前（渲染顺序=flatList 顺序，修掉旧「AI 理解」组的方向键错位）；AI 组之上零 persist', () => {
  const g = read('/newtab/components/GlobalPopups.vue')
  const a = g.indexOf('<template v-if="aiTopRows.length && !isBrowseMode">'); const b = g.indexOf('<template v-for="grp in groupedResults"')
  const TIP = "'单击/Enter → 打开链接（无链接则定位） · Ctrl+单击 或 Ctrl+Enter → 定位到卡片所在处'"
  return a >= 0 && b > a && g.split(TIP).length - 1 >= 1 && g.includes('@click="pickRow(item, $event)"')
    && g.includes('const aiHitById = computed') && g.includes('class="gp-ri-badge ai"')
    && !g.includes("for (const pair of aiTopRows.value) out.push") /* R152 备案：本条原钉"AI 组另列一批行 + 前置进 flatList"，真机发现同一 id 在扁平列表出现两次→选中行与执行行不是同一条；改成命中并入主列表、每卡一行，手势文案随 Ctrl+单击 一并更新 */
    && !g.slice(a - 3000, a).includes('persist')
});

check('R150-4 「全库分批扫」是显式慢路径不默认：仅在 scanned<total 时出现、按钮 title 点名要发几次请求；批间可取消、命中够 2×8 条即止损（别为已够用的结果继续烧钱）；不进同词缓存（慢路径的结果不该被"秒回"冒领）；超时钟按批数放大', () => {
  const g = read('/newtab/components/GlobalPopups.vue'); const sel = read('/shared/ai/select.ts')
  return g.includes('v-if="aiSearch && aiSearch.scanned < aiSearch.total"') && g.includes('次请求、会慢') && g.includes('if (!allScope) {')
    && sel.includes('if (acc.size >= HIT_CAP * 2) break') && sel.includes("if (opts.signal?.aborted) throw new Error('已取消')")
    && sel.includes('SEARCH_TIMEOUT_MS * Math.max(1, Math.ceil(total / size))') && sel.includes('onProgress')
    && sel.includes('const aborters = new Set<AbortController>()') && sel.includes('finally { aborters.delete(ac) }') && sel.includes('const relay = () => aborters.forEach(a => a.abort())')
});
check('R150-5 中文查询要有能用的字面近似 + 判弱只用客观信号：粗筛分词含整句/空格词/连续中文 2-gram（只按空格切会让中文长句整条落空）；weak = 模型自报把握 <0.55 或干脆没给 why，行上挂「低置信」而非默认藏掉', () => {
  const sel = read('/shared/ai/select.ts'); const g = read('/newtab/components/GlobalPopups.vue')
  return sel.includes('function queryTokens') && sel.includes('/[一-龥]{3,}/g') && sel.includes("if (t.includes(p)) n += 6")
    && sel.includes("weak: ok < 0.55 || !String(h?.why || '').trim()") && g.includes('class="gp-ri-badge ai"') && g.includes('name="sparkle"') /* R152：命中徽标并入主列表行，弱相关仍显式标出来 */
});
check('R150-6 跑动态那句话必须渲染成数字而不是对象：computed 里插值 ref 必须带 .value（首版写了 ${aiSecs} 直接露出 [object Object]），且单次投料没有中间进度时不许假装有进度（改说"库内 N 张里挑"）', () => {
  const g = read('/newtab/components/GlobalPopups.vue')
  const body = g.slice(g.indexOf('const aiProgress = computed'), g.indexOf('const aiMoreBatches'))
  return body.includes('${aiSecs.value}s') && !body.includes('${aiSecs}s') && body.includes('const mid = aiScanned.value > 0')
    && body.includes('库内 ${aiTotal.value} 张里挑') && body.includes('已扫 ${aiScanned.value}/${aiTotal.value} 张')
});
check('R151-1（R155-⑤ 换骨重写）★AI 入口图标单一真源换形不换责：AiMark.vue 出一枚 **inline 单色线性 SVG 机器人脸**（viewBox + currentColor 随主题、stroke-width 固定单位、无外部图标/字体依赖、12px 可辨），spin 与 prefers-reduced-motion 两条行为一字未动；「知」只留在品牌位（启动 Splash 的 <i>知</i> 仍在 index.html），入口组件引用数不降（R155 起锚点由 AiMark 直挂改为 AiEntryButton 收敛）；手册把"为什么换"与两处例外写清', () => {
  const zm = read('/shared/components/AiMark.vue'); const h = read('/newtab/index.html'); const m = read('/newtab/manual-data.ts')
  /* 先剥块注释再检：本文件顶部的"换骨理由"注释里引用了旧写法的 font-size 字样，直接 includes 会假命中 */
  const zmCode = zm.replace(/\/\*[\s\S]*?\*\//g, '')
  return zmCode.includes('viewBox="0 0 24 24"') && zmCode.includes('stroke="currentColor"') && zmCode.includes('stroke-width="2"') && zmCode.includes(':width="size"')
    && zmCode.includes('.ai-mark.spin') && zmCode.includes('@keyframes ai-turn') && zmCode.includes('prefers-reduced-motion')
    && !zmCode.includes('🤖') && !zmCode.includes('font-size') && !zmCode.includes('text-stroke') && !zmCode.includes('>知<') && h.includes('<i>知</i>')
    && ALL_VUE146.filter(f => read(f).includes('AiEntryButton')).length >= 16 && m.includes('品牌位') && m.includes('换过三轮') && m.includes('可辨性优先') /* R152 备案：本条曾钉"inline SVG 四角星"，用户真机判可辨性不如 🤖 → 换回表情图标；R155-⑤ 用户拍板"入口图标统一（布局一致/大小一致）"，换骨为单色线性 SVG 并注回"脸"语义，四条职责（单一真源/spin/降级动效/知留品牌位）始终一字未动 */
});
check('R148-6 报告型自动落卡只新增不改既有：withReport 只把带「AI 报告·待审阅」的卡放进**资源卡池**的待分类 · R149 备案：本条原写"本轮仅深度诊断接入（其余报告型仍走勾选采纳）"，R149 用户拍板后周回顾/深度洞察/成果文稿一并接上并撤采纳按钮（见 R149-1），故此处只锁"报告标签 + 待分类 + 零 splice"这条下界 · ★R4-Df3 备案：判据体一字未动，标题里的"资源台待分类"是当时的地名，V3.7.0 后资源卡真身只住隐藏池，地名随迁为"资源卡池"（落点算式本身由 R4-Df3 那两条钉）', () => {
  const rp = read('/shared/ai/reports.ts'); const g = read('/newtab/views/GlobalSettings.vue'); const j = read('/shared/ai/job.ts')
  return rp.includes("export const REPORT_TAG = 'AI 报告·待审阅'") && rp.includes('d.resources.unshift(card)') && rp.includes("categoryId: ''")
    && !rp.includes('d.resources =') && !rp.includes('splice(') && j.includes('autoReport?: {')
    && g.includes("withReport({") && g.includes("key: 'diag'") && g.includes("['深度诊断'])")
});
check('R148-7 ★本轮不做的要说出来：面板增量渲染经实测判停（M1 冷启动 433ms 已含 400 任务面板挂载、单次切台阻塞仅 70ms），改数据结构与渲染层的收益不再覆盖风险 · R149 备案：本条原写"jobKey 后台化本轮只接设置页，其余入口沿用旧绑法"，R149 已把绑法收口进抽屉 keyOf（见 R149-3），全站入口一并后台化', () => {
  const perf = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'scripts/perf.cjs'), 'utf8')
  return perf.includes('window.__clickCost') && perf.includes('window.__hashTo') && perf.includes('M11_切到资源台_首帧(ms)') && perf.includes('M7_主键重写次数')
    && !read('/newtab/components/compass/TaskManagerPanel.vue').includes('RENDER_STEP')
});

// ============== R154 · V3.1.9：AI 对照式评审范式（结构刀） ==============
console.log('【R154 · V3.1.9：AI 对照式评审（双栏 + 一次性指令）】');
check('R154-1 ★左栏是"当前形态"不是装饰：before/paneMode 全可选（缺省退单栏，23 入口因此可分批接），配对统一走 pair.ts（id 优先、归一化文本兜底），工厂不必各写一遍对齐', () => {
  const j = read('/shared/ai/job.ts'); const pr = read('/shared/ai/pair.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return j.includes('before?: AiPaneLine[] | (() => AiPaneLine[])') && j.includes("paneMode?: 'pair' | 'context'") && j.includes('export interface AiPaneLine')
    && pr.includes('export function pairRows') && pr.includes('export function unpairedBefore') && pr.includes('export function changeSummary') && pr.includes('export function resolveBefore')
    && w.includes('const dual = computed(() => pane.value.length > 0)') && w.includes('pairRows(pane.value, base)')
});
check('R154-2 ★可编辑必须声明写回（toRow），没写回就不给编辑——宁可不能改，也不能"看着改了、写库还是原值"', () => {
  const j = read('/shared/ai/job.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); const s = read('/shared/ai/select.ts')
  return j.includes('toRow?: (row: AiRow, texts: { main?: string; sub?: string }) => AiRow')
    && w.includes('function canEdit(r: AiRow): boolean { return !!(r.edit?.main && r.edit.toRow) }')
    && s.includes('edit: { main: true, toRow:') && s.includes("data: { description: (t.main || '').trim() }")
});
check('R154-3 ★编辑即自动勾选；Esc 取消与"一个字没改"都不算已编辑（原型实测抓出的瑕疵：取消也被标脏）', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes('if (next === origin) return') && w.includes('if (next && !picked.value.has(r.key))') && w.includes('@keydown.esc.stop="editing = null"')
});
check('R154-4 ★未变行不许勾（计数剔除 same + 行内不渲染勾选框），只读参谋行照旧不进勾选', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes("shown.value.filter(r => !r.advisory && r.changeType !== 'same').length")
    && w.includes('v-if="!r.advisory && picksSomething && r.changeType !== \'same\'"')
});
check('R154-5 ★一次性指令：独立键 zy_ai_directives_v1（与密钥同侧、不进 AppData）+ 优先级裁决句 + 2000 字上限 + 历史 5 条；作用域默认对象级，升档须用户点', () => {
  const d = read('/shared/ai/directive.ts'); const m = read('/shared/models/index.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return d.includes('AI_DIRECTIVES_KEY = K.AI_DIRECTIVES') && d.includes('DIRECTIVE_CAP = 2000') && d.includes('HISTORY_CAP = 5')
    && d.includes('【用户附加指令 · 优先级最高】') && d.includes('但输出结构与字段不得增删')
    && d.includes("tierOf(scope: string): DirTier { return store.value[scope]?.tier ?? 'object' }")
    && !m.includes('irective') && w.includes("switchTier('entry')")
});
check('R154-6 ★指令零宿主改造的支点：runner 每轮重新调 job.build()（谁缓存 build 结果就静默失效），抽屉单点 withDirective 且幂等', () => {
  const r = read('/shared/ai/runner.ts'); const d = read('/shared/ai/directive.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return r.includes('await job.build()') && d.includes('const wrapped = new WeakSet<AiJob>()') && d.includes('if (!job.promptScope || wrapped.has(job)')
    && w.includes('run(withDirective(j))') && w.includes('openJob(k, j.title, () => withDirective(j))')
});
check('R154-7 ★报告型「存为卡」（拍板③）：编辑过才点亮、走 saveReportCard 同名刷新不新增第二张，跑完自动落卡那条不变；左栏=投料原文（paneMode context，不假称逐行配对）', () => {
  const rp = read('/shared/ai/reports.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue'); const s = read('/shared/ai/select.ts')
  return rp.includes('job.resave = (rows) =>') && rp.includes('job.autoReport.save(p)')
    && w.includes('const canResave = computed(() => !!cur.value?.resave && dirty.value)') && w.includes('存为卡（已编辑')
    && s.includes("paneMode: 'context'") && s.includes('before: () => digestPane(digest)')
});
check('R154-8 ★采纳文案全站统一「采纳（直接写库）」（拍板①）；配了 confirm 才走二次确认，第一下只弹红条不写库（★G1(V3.8.25)随迁带备案：✓ 前缀由文案迁到按钮图标，语义句「（直接写库）」一字未动）', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue'); const j = read('/shared/ai/job.ts')
  return w.includes("'采纳（直接写库）'") && !w.includes('采纳勾选项') && j.includes('confirm?: (rows: AiRow[]) => string')
    && w.includes('if (cf && !confirmText.value) { confirmText.value = cf; return }')
});
check('R154-9 ★E3 导入归类不再自动弹 + 采纳直接写库：两处旧语义退役且不留死代码（inline job 与 knownTags 缓存一并删）· R167 备案：apply 的同步包装层随入口搬进共享 ResourceAiStrip，判据改指该组件（宿主只留 onAdopted 回调）', () => {
  const g = read('/newtab/views/GlobalSettings.vue'); const r = read('/newtab/components/ResourceDetailDrawer.vue'); const st = read('/newtab/components/ResourceAiStrip.vue')
  return g.includes('if (ids.length) pendingImportEnrich.value = ids') && !g.includes('aiEnrichIds(new Set(importedIds))')
    && st.includes('const base = j.apply') && !st.includes('建议已回填表单') && !st.includes('function knownTags()') && !st.includes('AiRowLite')
    && !r.includes('建议已回填表单') && !r.includes('const baseApply = job.apply!')
});

// ============== R155 · V3.2.0：视觉底座与形态分层（令牌 + 形态 + AI 入口统一） ==============
console.log('【R155 · V3.2.0：视觉底座、富卡形态、AI 入口统一】');

check('R155-1a ★间距令牌阶就位：--sp-1..7 定义完整，卡片密度令牌改为**引用阶**（原有 9/11/10 三个"非阶值"归位 8/12/12）', () => {
  const t = read('/shared/styles/tokens.css')
  return ['--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7'].every(v => t.includes(v + ':'))
    && t.includes('--card-pad-vert: var(--sp-2)') && t.includes('--card-pad-horz: var(--sp-3)') && t.includes('--card-gap: var(--sp-3)')
    && !t.includes('--card-pad-vert: 9px') && !t.includes('--card-pad-horz: 11px') && !t.includes('--card-gap: 10px')
});

check('R155-1c ★z-index 只许走令牌：跨组件层（值 ≥100）零裸数字；组件内相对微层（1~99）保留字面量；六档令牌齐备', () => {
  const t = read('/shared/styles/tokens.css')
  const need = ['--z-sticky', '--z-batch', '--z-cover', '--z-overlay', '--z-raised', '--z-modal', '--z-menu', '--z-confirm', '--z-mask-lg', '--z-popover', '--z-context', '--z-picker', '--z-global', '--z-media', '--z-media-top', '--z-toast']
  if (!need.every(v => t.includes(v + ':'))) return false
  const bad = []
  for (const f of ALL_STYLE155) {
    if (f.endsWith('/tokens.css')) continue /* 令牌定义处 */
    const s = read(f)
    const re = /z-index:\s*(\d+)/g
    let m
    while ((m = re.exec(s))) { if (Number(m[1]) >= 100) bad.push(f.replace(/^\//, '') + ':' + m[1]) }
  }
  return bad.length === 0
});

check('R155-U4 ★字号只走 --fs-* 阶：非阶值（9.5/10.5/11.5/12.5/13.5/14.5/15.5）零残留，阶内字面量已全量 token 化（引用 ≥900 处）', () => {
  const t = read('/shared/styles/tokens.css')
  const need = ['--fs-micro', '--fs-tiny', '--fs-caption', '--fs-sub', '--fs-body', '--fs-title', '--fs-headline', '--fs-display']
  if (!need.every(v => t.includes(v + ':'))) return false
  if (!['--lh-micro', '--lh-display'].every(v => t.includes(v + ':'))) return false
  const bad = []
  let refs = 0
  for (const f of ALL_STYLE155) {
    if (f.endsWith('/tokens.css')) continue
    const s = read(f)
    refs += (s.match(/font-size:\s*var\(--fs-/g) || []).length
    const re = /font-size:\s*(9\.5|10\.5|11\.5|12\.5|13\.5|14\.5|15\.5)px/g
    let m
    while ((m = re.exec(s))) bad.push(f.replace(/^\//, '') + ':' + m[1])
  }
  return bad.length === 0 && refs >= 900
});

check('R155-U8 缓动收敛为 3 套令牌（勘误：实测原为 **4 套**而非 3 套）：tokens 外零 cubic-bezier 字面量，标准/弹层/回弹三档齐备', () => {
  const t = read('/shared/styles/tokens.css')
  const bad = ALL_STYLE155.filter(f => !f.endsWith('/tokens.css') && read(f).includes('cubic-bezier'))
  return bad.length === 0 && t.includes('--ease-out-soft:') && t.includes('--ease-emphasis:') && t.includes('--ease-spring:')
});

check('R155-① ★容器宽度统一 1440：顶栏三档 + 设置页容器 + 手册容器全部 1440，且 padding 一致（只统一 max-width 会让左缘差 12px）', () => {
  const app = read('/newtab/App.vue'); const gs = read('/newtab/views/GlobalSettings.vue'); const mn = read('/newtab/views/ManualPage.vue')
  return app.includes('.topbar-inner.align-page { max-width: 1440px; margin: 0 auto; padding: 0 36px; }')
    && app.includes('.topbar-inner.align-settings { max-width: 1440px; margin: 0 auto; padding: 0 36px; }')
    && app.includes('.topbar-inner.align-manual { max-width: 1440px; margin: 0 auto; padding: 0 36px; }')
    && !app.includes('max-width: 1200px') && !app.includes('max-width: 1120px')
    && gs.includes('.gs-page { display: flex; width: min(1440px, 100%); margin: 0 auto; padding: 24px 36px 64px;')
    && gs.includes('.gs-content { flex: 1; min-width: 0; padding: 0; overflow: visible;') /* V3.9.13：设置页与其它台面共用 1440 + 36px */
    && mn.includes('max-width: 1440px');
});

check('R155-③（V3.9.8 随迁）★资源池富卡形态：网格卡保留可读卡高、标题 2 行、页脚标签可缩，字段上限 3 个仍由 shared/utils/fields 单源提供；旧 Workspace 富卡模板已退役', () => {
  const pool = read('/newtab/components/compass/PoolCardsPanel.vue'); const ws = codeOnly(read('/newtab/views/Workspace.vue')); const fd = read('/shared/utils/fields.ts')
  return pool.includes('.pcp-card {') && /min-height:\s*94px/.test(pool)
    && /\.pcp-title \{[^}]*-webkit-line-clamp: 2/.test(pool)
    && /\.pcp-foot \{[^}]*flex-wrap: wrap/.test(pool)
    && /\.pcp-tag \{[^}]*overflow: hidden[^}]*text-overflow: ellipsis/.test(pool)
    && fd.includes('export const CARD_EXTRA_FIELD_LIMIT = 3') && fd.includes('export function cardExtraFields(') && fd.includes('CARD_SLOT_KEYS')
    && pool.includes('class="pcp-foot"') && pool.includes('class="pcp-row"')
    && !ws.includes('class="rc-title"') && !ws.includes('class="rc-desc"');
});

check('R155-10d ★AI 入口调用纪律：业务 .vue 零直挂 AiMark、零给徽标写死尺寸；AiEntryButton 尺寸只认 --icon-sm/--icon-lg 且不引 font-size', () => {
  const ae = read('/shared/components/AiEntryButton.vue')
  const rawUse = ALL_VUE146.filter(f => !f.endsWith('AiEntryButton.vue') && !f.endsWith('AiMark.vue') && /<AiMark[\s/>]/.test(read(f)))
  const numSize = ALL_VUE146.filter(f => /<AiEntryButton[^>]*:size=/.test(read(f)))
  const aeUsers = ALL_VUE146.filter(f => read(f).includes('AiEntryButton')).length
  return rawUse.length === 0 && numSize.length === 0 && aeUsers >= 16
    && ae.includes('var(--icon-sm)') && ae.includes('var(--icon-lg)') && !ae.includes('font-size:') /* 尺寸只走 width/height 令牌，不靠字号间接控制 */
    && ae.includes('gap: 5px'); /* 图标—文案点距全站唯一值 */
});
check('R155-11 ★06-2 §F 分发路径复测常驻化：scripts/probe-f.cjs 加载**真实交付包**（桌面解压目录，不是 v2/dist）复测三项 —— MV3 worker / 新标签页接管 / Alt+1·2·3；版本比对以**源码 manifest.ts 为唯一真源**（不写死版本号，否则每轮发版都得改这条断言）· R155 首跑即抓到 §F 的 Alt 键位文档漂移', () => {
  const p = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'probe-f.cjs'), 'utf8')
  return p.includes('launchPersistentContext') && p.includes('--load-extension') && p.includes('--disable-extensions-except')
    && p.includes('chrome_url_overrides') && p.includes("'Digit1'") && p.includes("'Digit2'") && p.includes("'Digit3'")
    && p.includes('function sourceVersion') && p.includes("'src', 'manifest.ts'")
    && p.includes("require('./browser.cjs')") /* ★R4-Ea 随迁：与 e2e/perf 同一条浏览器回落链——链本身已上收到 scripts/browser.cjs，这里核「probe-f 从它取」，四级顺序与 ZY_CHROME 由 R4-Ea 那两条钉 */
    && fs.readFileSync(path.resolve(SCRIPTS_DIR, 'browser.cjs'), 'utf8').includes('ZY_CHROME')
    && !/mf\.version === '\d+\.\d+\.\d+'/.test(p) /* 反例：写死版本号 */
});
check('R155-12 ★同机 A/B 改为「零移动」+ 报告自证：perf.cjs 认 `--dist=<目录>`（旧做法靠 `mv` 换目录名，撞同名目录会把包嵌套成不完整包 ⇒ 扩展加载不出 worker ⇒ 报错被重定向吞掉 ⇒ 读到上一轮残留报告，得出"两版读数一字不差"的假结论）；报告新增 `build` 字段（从 service worker 回读 manifest.version，磁盘上的 manifest 不代表浏览器加载的就是它）与 `M14b/M14c` 归因计量；**开跑即删旧报告**。★R4-Pa 随迁备案（口径不放宽）：那句 getManifest 从 perf 搬进 browser.cjs 的 swReady（裸调 evaluate 会抢在扩展 chrome.runtime 注入前，本机实测稳定抛错、perf 一个指标都不写），所以判据改成三条腿：① perf 仍把 swReady 的 version 写进 out.build；② getManifest 那句确实在 browser.cjs 里；③ perf 自己不许再拼回裸调用', () => {
  const p = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'perf.cjs'), 'utf8')
  const b = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'browser.cjs'), 'utf8')
  return p.includes("a.startsWith('--dist=')") && p.includes('const loadedVer = (await swReady(worker)).version') && p.includes('out.build = loadedVer')
    && b.includes('chrome.runtime.getManifest().version') && !p.includes('chrome.runtime.getManifest')
    && p.includes('M14b_资源台svg元素数') && p.includes('M14c_资源台AI徽标数')
    && /fs\.unlinkSync\(reportPath\)/.test(p);
});

// ============== R156 · V3.2.1：四主题差异化（accent 解禁 + 跟随系统） ==============
console.log('【R156 · V3.2.1：四主题差异化、accent 解禁、跟随系统】');
check('R156-1 ★四主题不再是"伪选择"：linear 与 raycast 五项关键令牌逐项不同（R155 theme-audit 首跑实证两者四张截图字节完全相同 —— 19 个色值逐字相同）', () => {
  const t = read('/shared/styles/tokens.css')
  const pair = (a, b) => t.includes(a) && t.includes(b)
  return pair('--bg: #0D0E11;', '--bg: #08080A;')
    && pair('--surface: #14161B;', '--surface: #101014;')
    && pair('--border: rgba(255, 255, 255, 0.08);', '--border: rgba(255, 255, 255, 0.12);')
    && pair('--text: rgba(255, 255, 255, 0.92);', '--text: rgba(255, 255, 255, 0.95);')
    && pair('--accent: #5E6AD2;', '--accent: #1E6FD9;')
})
check('R156-2 ★accent 三件套按主题独立产出（accent-light 随 accent 重算，不得沿用旧紫色）：暗主题 rgba(本主题 accent) · 浅主题独立实色；hover 四主题各自定义；旧全局紫浅底 #EEF0FC 已退役', () => {
  const t = read('/shared/styles/tokens.css')
  return t.includes('--accent-light: rgba(94, 106, 210, 0.16);') && t.includes('--accent-light: rgba(30, 111, 217, 0.16);')
    && t.includes('--accent-light: #EFEBFB;') && t.includes('--accent-light: #F6EDF8;')
    && t.includes('--accent-hover: #828FFF;') && t.includes('--accent-hover: #3E86E0;')
    && t.includes('--accent-hover: #6C3FC8;') && t.includes('--accent-hover: #85349A;')
    && (t.split('--accent-light: #EEF0FC;').length - 1) === 0
})
check('R156-3 ★主题对比度改由机器判定并常驻（scripts/theme-contrast.cjs）：解析 tokens.css 真源、10 项/主题（含 --text-3/--surface-3 最苛刻层与 toast 两项）+ 四主题 accent 唯一性，失败即非零退出', () => {
  const p = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-contrast.cjs'), 'utf8')
  return p.includes("'src', 'shared', 'styles', 'tokens.css'") && p.includes('toast-action/toast-bg')
    && p.includes("'text-3/surface-3'") && p.includes("'text-3/bg'") && p.includes('#fff/accent')
    && p.includes('uniq.size !== THEMES.length') && p.includes('process.exit(fail === 0 ? 0 : 1)')
})
check('R156-4 ★主题「跟随系统」（auto）：shared/utils/theme.ts 提供 resolveTheme/watchSystemTheme（系统深→linear / 浅→apple）；App.vue 主题列表含 auto；三处落 data-theme 的入口（启动 / 切换 / 导入偏好包）统一经 resolveTheme；auto 模式下刷新后仍注册系统配色监听', () => {
  const th = read('/shared/utils/theme.ts'); const a = read('/newtab/App.vue')
  const m = read('/newtab/main.ts'); const s = read('/newtab/stores/app.ts'); const g = read('/newtab/views/GlobalSettings.vue')
  return th.includes('export function resolveTheme') && th.includes('export function watchSystemTheme')
    && th.includes("t === 'auto'") && th.includes('prefers-color-scheme: dark') && th.includes('? SYSTEM_DARK : SYSTEM_LIGHT')
    && a.includes("id: 'auto'") && a.includes('跟随系统')
    && m.includes("setAttribute('data-theme', resolveTheme(ui.theme))")
    && s.includes('function applyTheme(t: string)') && s.includes('watchSystemTheme((r) =>')
    && s.includes('applyTheme(ui.value?.theme') /* 启动即注册监听，否则刷新后 auto 不再跟随 */
    && g.includes("setAttribute('data-theme', resolveTheme(ui.theme))")
})
check('R156-5 ★accent 落地纪律（解禁 ≠ 滥用）写进令牌头：每主题只许一个 accent、只用于主行动与当前态，且四主题色相成阶梯两两可辨', () => {
  const t = read('/shared/styles/tokens.css')
  return t.includes('每主题只许一个 accent') && t.includes('只用于主行动与当前态')
    && t.includes('色相成阶梯') && t.includes('解禁的是') && t.includes('不是"克制"')
})
check('R156-6（R155 复核）★AI 徽标随主题 accent 自动变色：AiMark 走 currentColor（四主题 accent 解禁后零额外成本自动成立），且零硬编码 fill/stroke 色值', () => {
  const z = read('/shared/components/AiMark.vue')
  return z.includes('stroke="currentColor"') && z.includes('fill="none"') && !z.includes('fill="#') && !z.includes('stroke="#')
})
check('R156-7 raycast 独立配套：纯黑遮罩 .7 + 冷蓝动作色回执条（#5AA9FF）—— 不再与 linear 共用同一套 toast 配色', () => {
  const t = read('/shared/styles/tokens.css')
  return t.includes('--toast-bg: #0B0B0E; --toast-fg: #F2F3F5; --toast-action: #5AA9FF;') && t.includes('--overlay-bg: rgba(0, 0, 0, 0.7);')
})
check('R156-8 浅色双主题彻底分开：apple 冷灰白 #F5F5F7 + 纯黑文本基色 ／ notion 暖纸白 #F7F6F3 + 暖褐黑文本基色（border 与文本基色不再趋同；notion 旧冷黑基色已退役）', () => {
  const t = read('/shared/styles/tokens.css')
  return t.includes('--bg: #F5F5F7;') && t.includes('--bg: #F7F6F3;')
    && t.includes('--text: rgba(0, 0, 0, 0.90);') && t.includes('--text: rgba(35, 31, 25, 0.90);')
    && t.includes('--border: rgba(0, 0, 0, 0.09);') && t.includes('--border: rgba(40, 34, 24, 0.11);')
    && (t.split('--border: rgba(15, 15, 15, 0.08);').length - 1) === 0
})

// ============== R161 · V3.2.2：AI 评审中央弹窗 + 四项检索需求 ==============
