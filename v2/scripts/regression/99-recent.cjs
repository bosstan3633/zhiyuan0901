/**
 * R174-1 分片 · 99-recent：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

console.log('【R167 · 两卡详情 OPPO 质感重排 / AI 入口共享化 / 弹窗下半部主导】');
check('R167-1 ★分组面板体系是真源不是各写各的：detail-sheet.css 的 ds-* 七件套在位，资源与好奇两详情各自用满三块面板，焦点面板整块撑高（读起来是"内容区"不是又一个输入框）', () => {
  const css = read('/shared/styles/detail-sheet.css')
  const f = read('/newtab/components/ResourceEditForm.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue')
  return ['.ds-pnl', '.ds-pnl-h', '.ds-kv', '.ds-ai-strip', '.ds-hero-note', '.ds-h1', '.ds-kicker'].every(k => css.includes(k))
    && css.includes('.ds-pnl.hero') && /min-height:\s*34vh/.test(css)
    && (f.match(/class="ds-pnl( hero)?"/g) || []).length === 3 && (c.match(/class="ds-pnl( hero)?"/g) || []).length === 3
    && f.includes('class="ds-hero-note"') && c.includes('class="ds-hero-note"')
});
check('R167-2 ★资源详情 AI 入口全站只有一处实现：ResourceAiStrip 被两宿主同时挂载，而两宿主本体（Workspace.vue 自身与 RDD）零 AI 接线（不出现 shared/ai 路径，也不出现评审抽屉）。"并入口时只改一个宿主"正是 R165-A 被绕过的红线，这条把它变成正向门禁——新宿主想自装一枚，必须动这个组件', () => {
  const st = read('/newtab/components/ResourceAiStrip.vue'); const r = read('/newtab/components/ResourceDetailDrawer.vue')
  const w = read('/newtab/views/Workspace.vue')
  const wsx = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8').replace(/\r\n/g, '\n')
  return r.includes('<ResourceAiStrip') && w.includes('<ResourceAiStrip')
    && !r.includes('/shared/ai/') && !r.includes('AiEntryButton') && !wsx.includes('/shared/ai/') && !wsx.includes('AiEntryButton')
    && st.includes("import('@/shared/ai/config')") && st.includes('buildResourceLinkTaskJob') && st.includes("buildResourceEnrichJob(card, ctx)")
    && (st.match(/class="ds-ai-cell"/g) || []).length === 2 && st.includes('if (busy.value) return') && st.includes('props.onAdopted?.()')
});
check('R167-3 ★主标题全站只有一处：DetailTitle 单实现（kicker + .ds-h1 + 自增高 + readonly + 回车即保存，IME 合成期不许误存），资源两宿主各挂一份、正文零第二份标题框；好奇标题是「问题原文」的只读截断，故走 .cz-h1q 而非编辑控件', () => {
  const dt = read('/newtab/components/DetailTitle.vue'); const f = read('/newtab/components/ResourceEditForm.vue')
  const r = read('/newtab/components/ResourceDetailDrawer.vue'); const w = read('/newtab/views/Workspace.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue')
  return dt.includes('class="ds-h1"') && dt.includes('scrollHeight') && dt.includes('isComposing') && dt.includes('kicker') && dt.includes('readonly')
    && r.includes('<DetailTitle') && w.includes('<DetailTitle')
    && !f.includes('class="ref-title"') && !f.includes('showClose') && !r.includes('autoGrow')
    && c.includes('cz-h1q') && c.includes('ds-kicker')
});
check('R167-4 ★镜像只读卡三处不越界：标题 readonly（用 readonly 不用 disabled，后者把它压成灰底）、AI 行不给入口、回车=定位源卡而非保存', () => {
  const w = read('/newtab/views/Workspace.vue'); const dt = read('/newtab/components/DetailTitle.vue')
  return w.includes(':readonly="drawerReadonly"') && w.includes('<ResourceAiStrip v-if="!drawerReadonly"')
    && w.includes("@enter=\"drawerReadonly ? locateMirrorSourceCard() : saveResource()\"")
    && dt.includes(':readonly="readonly"') && !dt.includes(':disabled')
});
check('R167-5 ★转化即离场的数据口径：convertedAt/convertedTo 只记"转成了哪一类"（**不记目标卡 id**，否则就是卡间引用、撞零挂载红线）；两条转化路径都"软删 + 盖记"成对出现；回收站恢复把两键一起清（恢复=撤销这次转化，卡回池且不再算已转化）', () => {
  const md = read('/shared/models/index.ts'); const cp = read('/newtab/stores/curiosity.ts'); const rb = read('/newtab/views/RecycleBin.vue')
  const body = md.slice(md.indexOf('export interface CuriosityCard'), md.indexOf('export interface CuriosityCard') + 1600)
  return body.includes('convertedAt?: number') && body.includes("convertedTo?: 'task' | 'res'") && !/converted\w*\??:\s*string/.test(body) && !body.includes('convertedToId')
    && (cp.match(/c\.convertedAt = Date\.now\(\)/g) || []).length === 2 /* 两条转化路径各盖一次 */
    && (cp.match(/c\.deletedAt = Date\.now\(\)/g) || []).length === 3 /* 转化两条 + 纯删除一条：离场一律软删，没有第三条"硬删"出路 */
    && (rb.match(/convertedAt = undefined/g) || []).length === 2 && (rb.match(/convertedTo = undefined/g) || []).length === 2
    && rb.includes('rb-conv')
});
check('R167-6 ★「关联任务」只写记录不碰卡：apply 段里只有 addSupportLink（零 title/description/tags 写操作）、本地预筛先行且已挂过的排除在模型投料之前、采纳钮说出后果（✓ 关联为支持）', () => {
  const rl = read('/shared/ai/resourceLinkTask.ts'); const seg = segOf(rl, 'export function buildResourceLinkTaskJob', '\n}')
  return seg.includes('addSupportLink(') && !seg.includes('.title =') && !seg.includes('.description =') && !seg.includes('.tags =')
    && seg.includes('prefilterTasks(d,') && rl.includes('function prefilterTasks')
    && seg.includes('already.has(id)') && seg.includes("adoptLabel: '✓ 关联为支持'")
    && seg.includes("from: 'ai'")
});
check('R167-7 ★评审弹窗"下半部主导"：上半部压成一行头 + 三栏一次性指令条，对照区吃满剩余高度（外壳 .md-body 禁滚、由左右两栏各自滚）；分栏把手可拖（22%~70% 夹住，越界会把某一栏拖没）、拖拽靠 mousedown 上的 preventDefault 防选区**而不是给弹窗加 pointer-events:none**（那会让把手自己的 click 复位落空，原型实测踩过）；窄屏退成单列', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes('class="ai-dir"') && w.includes('class="ai-drag"') && w.includes('function startDrag') && w.includes('--split')
    && w.includes('.ai-modal :deep(.md-body)') && w.includes('overflow: hidden')
    && w.includes('Math.min(70, Math.max(22,') && w.includes('e.preventDefault()') && !w.includes('pointer-events: none')
    && /@media[^{]*\{[\s\S]{0,400}\.ai-drag \{ display: none \}/.test(w)
});
check('R167-8 ★单条判决卡（curio-triage 单卡态）：契约 layout:"verdict" 只在单卡时置；抽屉三态判决 + 判词另存走 secondary，且 secondary 段**零状态写**（"判词写进详情"不改转不转，改状态是主采纳按钮的权力）', () => {
  const j = read('/shared/ai/job.ts'); const bg = read('/shared/ai/batchG.ts'); const w = read('/newtab/components/AiSuggestionDrawer.vue')
  const sec = segOf(bg, "label: '📝 判词写进详情'", '\n    },')
  return j.includes("layout?: 'verdict'") && bg.includes("layout: 'verdict' as const")
    && w.includes('VERDICTS') && w.includes('verdictPick') && sec.includes("c.question = ") && !sec.includes('.status =')
    && read('/shared/ai/jobs/registry.ts').includes('secondary: true')
});
check('R167-9 ★抽屉宽度与视觉走查判据同频：两代资源详情与好奇详情一律 520px；theme-audit 的卡详情判据必须同时含「AI 格数」与「主标题处数」，并核弹窗三件套（对照区/指令条/分栏把手）——走查判据落后于版式等于白跑', () => {
  const r = read('/newtab/components/ResourceDetailDrawer.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue')
  const css = read('/newtab/views/workspace.css'); const g = read('/../scripts/theme-audit.cjs')
  return r.includes('width="520px"') && c.includes('width="520px"') && css.includes('width: 520px')
    && g.includes("h1: '.ds-h1'") && g.includes('aiCount: 2') && g.includes('aiCount: 1') && g.includes('aiCount: 3')
    && g.includes("class=\"ai-dir\"") === false && g.includes('.ai-dir') && g.includes('.ai-drag') && g.includes('if (modalFail.length)')
    && g.includes('const wantDrag = m.width >= 1200') /* 窄屏已降单栏 ⇒ 把手"不该在"也是判据（单栏挂一根拖宽把手=能拖一个不存在的分界） */
});

console.log('【R168 · 性能盘点轮（工作台切换 / 看板 / 常驻浮层 / 徽标节点）】');
check('R168-1 ★AI 徽标图形只挂一份：形状本体在 AiMarkSymbol（全站只挂 App 根一次），AiMark 退化为 <use> ⇒ 一枚徽标 7 节点降到 2（真库资源台一屏 32 枚 ⇒ 少插 160 节点）；入口仍只许 AiEntryButton 引 AiMark', () => {
  const zm = read('/shared/components/AiMark.vue'); const sym = read('/shared/components/AiMarkSymbol.vue'); const app = read('/newtab/App.vue')
  return !/<path|<circle|<rect/.test(zm) && zm.includes('<use href="#zy-ai-mark"') && zm.includes('viewBox="0 0 24 24"') && zm.includes('stroke="currentColor"')
    && (sym.match(/<path|<circle|<rect/g) || []).length === 6 && sym.includes('symbol id="zy-ai-mark"')
    && (app.match(/<AiMarkSymbol/g) || []).length === 1 && app.includes("import AiMarkSymbol from '@/shared/components/AiMarkSymbol.vue'")
    && read('/shared/components/AiEntryButton.vue').includes("from '@/shared/components/AiMark.vue'")
});
check('R168-2 ★台面零"常驻浮层"（V3.7.0 重指：镜像两弹窗随资源台退役，九副 → 七副）：Workspace 的浮层（详情抽屉 + 6 个 modal）一律 v-if——真库实测抽屉开着与否都在 DOM 里（168 节点含 88 个 option），而它是每次进台面都摊的固定成本；不得再用 transform 移出视口冒充"关掉"（R169 重指：抽屉进出场/Esc/遮罩随两代容器合并进 Drawer 壳单源，壳内 v-if="open" 点开才挂）', () => {
  const w = read('/newtab/views/Workspace.vue'); const css = read('/newtab/views/workspace.css'); const d = read('/shared/components/Drawer.vue')
  const openConds = ['importModalOpen', 'bookmarkModalOpen', 'moveModalOpen', 'moveOneOpen', 'catModal.open', 'inputModal.open']
  const stillMounted = openConds.filter(k => w.includes(`class="modal-overlay" :class="{open: ${k}`))
  return stillMounted.length === 0 && (w.match(/class="modal-overlay open"/g) || []).length === 7
    && w.includes('<Drawer :open="drawerOpen" width="520px"') && !w.includes('class="drawer" :class="{open: drawerOpen}"')
    && d.includes('<aside v-if="open" class="drawer"') && d.includes('.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }')
    && d.includes('prefers-reduced-motion: reduce') && !css.includes('.drawer.open { transform: translateX(0); }')
});
check('R168-3 ★三视图首屏都有渲染上限（"增量渲染"不许在某一个视图名存实亡）：卡片/列表 RENDER_STEP 与看板 KANBAN_COL_STEP 都在，且都有"还有 N 张"的显式续载入口 + 滚动续载通道', () => {
  const w = read('/newtab/composables/useResourceView.ts'); const t = read('/newtab/views/Workspace.vue')
  const step = Number((w.match(/const RENDER_STEP = (\d+)/) || [])[1] || 0)
  const kstep = Number((w.match(/const KANBAN_COL_STEP = (\d+)/) || [])[1] || 0)
  return step > 0 && step <= 32 && kstep > 0 && kstep <= 8 && w.includes('hiddenCount: items.length - shown.length')
    && t.includes('kanbanMore(cat.key)') && t.includes('onKanbanColScroll') && t.includes('renderMore()')
});
check('R168-4 ★盘点用的两个口径必须留在 perf 里（体感靠数字不靠印象）：--real 真实路径 R1~R7 与 DOM 账单 M14/R6 计数（可见节点/卡/svg/徽标）——散布 >2 倍时唯一可信的就是结构量', () => {
  const p = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'perf.cjs'), 'utf8').replace(/\r\n/g, '\n')
  return p.includes('M14 账单：可见节点') && p.includes('svg') && p.includes('AI 徽标')
    && p.includes("R7_全局搜索唤起(ms)") && p.includes('R2_冷挂资源台') && p.includes('--real=')
});

console.log('【R169 · 流水口径 / 链接三槽 / 三件事 AI 推荐 / 项目调度重设计 / 文案 / AI 图标】');
check('R169-1 ★任务勾选必须进事件流水（用户主诉"今日操作没进流水"的根因）：status 事件的卡种集合含 task，且原先那道 kind===\'curiosity\' 硬门槛不得回流；动词中文单一真源在 eventLog，调度台引它而不是各写一份（各写一份 ⇒ 新增 action 时必有一处漏，漏的那处直接吐英文原词）', () => {
  const e = read('/shared/utils/eventLog.ts'); const ch = read('/newtab/views/CompassHome.vue'); const lg = read('/newtab/components/dashboard/DashboardLogDrawer.vue'); const ec = codeOnly(e)
  return ec.includes("new Set(['curiosity', 'task'])") && !/kind === 'curiosity' && c\.status/.test(ec)
    && ec.includes('export const EVENT_ACT_LABEL') && ec.includes("status: '改状态'")
    /* R172-T8 重指：动词中文真源的消费方迁到全量记录抽屉（引 EVENT_ACT_LABEL，不各写一份） */
    && lg.includes('EVENT_ACT_LABEL') && !lg.includes("create: '新增', delete: '删除'")
    && !ch.includes("create: '新增', delete: '删除'")
});
check('R169-2 ★事件时间戳逐条取卡自己的 updatedAt，不许整批共用一个 now（"整屏同一分钟"就是它造成的：批量导入给每卡盖同一 now，diff 又给每事件盖同一 now）；缺 updatedAt 的老数据才回落，批量摘要事件本无单卡时间仍用 now', () => {
  const e = codeOnly(read('/shared/utils/eventLog.ts'))
  return e.includes('cardId: string, ts = now') && e.includes('const at = c.updatedAt || now')
    && e.includes("mk('create', kind, titleOf(kind, c), c.id, at)") && e.includes('prev.updatedAt || now')
    && !e.includes('ts: now, action')
});
check('R169-3 ★「最近更新流水」名副其实：数据源=事件流与本卡时间归并（一卡一行、取较晚者、动词跟随胜出的一侧），不再是纯 updatedAt Top30；翻页取代硬砍（第 31 条之后的今日操作"凭空消失"是原缺陷的另一半）；跨年补年份；范围口径写在界面上而不是留给用户猜', () => {
  const d = codeOnly(read('/newtab/composables/useCurationDrill.ts')); const o = read('/newtab/components/CurationDrillDrawer.vue')
  return d.includes('readEventLog') && d.includes("e.kind !== 'resource'") && d.includes('e.ts >= upd') && d.includes('EVENT_ACT_LABEL[e.action]')
    && o.includes('RECENT_PAGE = 30') && !o.includes('.slice(0, 30)') && o.includes('dd-more') && o.includes('getFullYear()')
    && o.includes('本台可见资源卡')
});
check('R169-4 ★导入不许让旧包时间戳盖掉今日改动：资源段合并前先过钳位（只钳 updatedAt，内容仍以来值为准——改内容语义会伤别的导入场景）', () => {
  const i = codeOnly(read('/newtab/composables/useWorkspaceImport.ts'))
  return i.includes('const clampUpdatedAt =') && i.includes('cur.updatedAt > i.updatedAt')
    && i.includes('mergeById(d.value.resources, clampUpdatedAt(d.value.resources, incRes)')
});
check('R169-5 ★三槽口径单一真源在 link.ts：槽序/文案/占位符一份（LINK_SLOT_TABS + linkPlaceholderFor），三处表单共用；两处采集表单不再各写一份 linkType 三元分支（各写一份 ⇒ 加第四种槽时必有一处漏）', () => {
  const l = codeOnly(read('/shared/utils/link.ts')); const gp = read('/newtab/components/GlobalPopups.vue'); const pp = read('/popup/App.vue')
  return l.includes('export const LINK_SLOT_TABS') && l.includes('export function linkPlaceholderFor')
    && l.includes('export function slotLinkOf') && l.includes('export function switchLinkSlot') && l.includes('export function setLinkSlot')
    && gp.includes('linkPlaceholderFor(capForm.linkType)') && !/capForm\.linkType === 'url'\) return/.test(gp)
    && pp.includes('linkPlaceholderFor(linkType)') && !pp.includes("linkType === 'url' ? 'https://…'")
});
check('R169-6 ★切槽语义（用户主诉"切过去没有就该为空"）：先把当前值存回它所属槽，再取目标槽值进 link；目标槽空 ⇒ link 置空、且空值不留键。同一条纪律也管住非手输路径（挂附件走 setLinkSlot，不许直写 linkType+link 冲掉别槽）', () => {
  const l = codeOnly(read('/shared/utils/link.ts'))
  return l.includes('if (v) m.linkSlots[cur] = m.link') && l.includes('else delete m.linkSlots[cur]')
    && l.includes("m.link = m.linkSlots[next] || ''") && l.includes('if (t === m.linkType) { m.link = value; return }')
});
check('R169-7 ★空槽 ≠ 断链：当前槽空走 .ds-slot-empty 中性说明，只有"有值但只有文件名"才走 .ref-warn 告警（旧行为是切到空槽立刻报"仅存文件名，请补全完整路径"，把没填说成坏了）；断链判据仍只有 linkStateOf 一处', () => {
  const f = read('/newtab/components/ResourceEditForm.vue')
  return f.includes("const slotEmpty = computed(() => !(props.model.link || '').trim())")
    && f.includes('v-if="slotEmpty" class="ds-slot-empty"') && f.includes('v-if="linkIncomplete" class="ref-warn"')
    && f.includes("linkStateOf(props.model.linkType, props.model.link) === 'incomplete'")
});
check('R169-8 ★linkSlots 这个字段名全仓只出现两处（模型声明 + link.ts 单一真源）：详情表单也只经 slotFillOf/switchLinkSlot/setLinkSlot 间接用，打开/筛选/导出/AI 抓正文一律仍只认 linkType+link ⇒ 全站约 30 处消费点零改动，也不会出现"一张卡两个答案"。第三处想直读字段，先把判据一起搬进 link.ts', () => {
  const fs2 = require('fs'); const path2 = require('path'); const root = path2.resolve(SCRIPTS_DIR, '..', 'src'); const hits = []
  const walk = (d) => { for (const f of fs2.readdirSync(d)) { const p = path2.join(d, f); const st = fs2.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|vue)$/.test(f)) { if (codeOnly(fs2.readFileSync(p, 'utf8')).includes('linkSlots')) hits.push(p.replace(/\\/g, '/')) } } }
  walk(root)
  const ref = codeOnly(read('/newtab/components/ResourceEditForm.vue'))
  return hits.length === 2 && ['shared/models/index.ts', 'shared/utils/link.ts'].every(a => hits.some(h => h.endsWith(a)))
    && ref.includes('switchLinkSlot(model,') && ref.includes('setLinkSlot(props.model,') && !ref.includes('linkSlots')
});
check('R169-9 ★自动写入的三条边界都在：一天只写一次（focusAutoDate）/ 可"今天别推荐"（focusMutedDate）/ 用户手工选过与已完成的格子永不覆盖。落笔口只有 utils 里的 applyFocusOrder 一处（本地与 AI 共用），判据 `s.auto !== true || s.done` 分两处写就会出现"本地守了、AI 那条忘了"：', () => {
  const u = codeOnly(read('/shared/utils/focusSuggest.ts')); const ch = codeOnly(read('/newtab/views/CompassHome.vue')); const m = read('/shared/models/index.ts')
  return m.includes('focusAutoDate?: string') && m.includes('focusMutedDate?: string') && m.includes('auto?: boolean')
    && u.includes('if (s.auto !== true || s.done) { next.push(s); continue }')
    && ch.includes('d.value.focusMutedDate === key || d.value.focusAutoDate === key')
    && ch.includes('d.value.focusMutedDate = todayKey.value')
    && (u.match(/export function applyFocusOrder/g) || []).length === 1
});
check('R169-10 ★AI 挂了不许影响主用途：本地候选先写三格（零 Key 可用），AI 只是"随后复核"；rankFocus 任何一环失败一律返回 null，宿主 catch 后静默保留本地顺序——不弹错、不把台面弄空', () => {
  const a = codeOnly(read('/shared/ai/focusSuggest.ts')); const ch = codeOnly(read('/newtab/views/CompassHome.vue'))
  return (a.match(/catch \{ return null \}/g) || []).length === 2 /* 网络失败一处、JSON 不可解析一处 */
    && ch.includes("const { suggestFocus, applyFocusOrder } = await import('@/shared/utils/focusSuggest')")
    && ch.includes('void refineWithAi(key)') && /catch \{\s*\}/.test(ch)
    && !ch.includes('showToast(\'⚠ AI')
});
check('R169-11 ★模型只有"排序 + 判词"的权力：投料里带本地事实、提示词禁编造数字与改归属、候选外的 taskId 计入消毒账、无判词或非 high 置信**不占格**（不是判弱还能被一键全选进去）', () => {
  const a = codeOnly(read('/shared/ai/focusSuggest.ts')); const sc = read('/shared/ai/scenarios.ts')
  return sc.includes('export const focusRankSystem') && sc.includes('不许编造候选里没有的数字') && sc.includes('不许替用户改归属或改优先级')
    && a.includes('if (!known.has(id) || order.includes(id)) continue')
    && a.includes("if (!w || it.confidence !== 'high') continue")
    && a.includes('c.facts.join')
});
check('R169-12 ★「为什么是这三件」是右上角一枚小图标，不是新增模块：入口在 card-head 内、浮层 v-if（不开就不在 DOM，与 R168-2 同一纪律）、荐标只给 auto 格、手工格明说"系统不评价"', () => {
  const ch = read('/newtab/views/CompassHome.vue')
  return ch.includes('data-testid="focus-why-ico"') && ch.includes('v-if="whyOpen" class="focus-why"')
    && ch.includes('v-if="c.slot?.auto === true"') && ch.includes('这一格是你自己选的，系统不评价')
    && ch.includes('不改任务卡、不改状态、不改归属')
});
check('R169-13 ★整行归属=进方向树的唯一入口', () => { const h = read('/newtab/views/CompassHome.vue'); return !h.includes('cur-crumb') && !h.includes('gotoTree');  });
check('R169-14 ★R2-② 重指带备案：项目调度卡「描述｜子任务」定高双栏退役，承接者=三件事槽内子任务视口（tc-subs 固定 5 行 + 底部渐隐 + 还有 N 项 + 滚动收敛）', () => {
  const h = read('/newtab/views/CompassHome.vue')
  return h.includes('class="tc-subs"') && h.includes('max-height: calc(5 * 24px + 4px)')
    && h.includes('mask-image: linear-gradient(to bottom, var(--text) calc(100% - 16px), transparent)') // R1.5 后置：渐隐黑改 var(--text)（R120-10 零硬编码色判据联动）
    && h.includes('还有 {{ subMoreCount(c.task) }} 项 · 进详情查看')
    && h.includes('function toggleSlotSub') && h.includes("doneAt: !s.done ? Date.now() : undefined")
    && h.includes('function onSubScroll') && !h.includes('spot-dual')
});
check('R169-15 ★R2-② 重指带备案：双栏「右栏只读可勾、编辑回详情」分工由槽内视口承接——槽内只勾选/进详情，零输入控件', () => {
  const h = read('/newtab/views/CompassHome.vue')
  const i0 = h.indexOf('class="tc-subs"'), i1 = h.indexOf('tc-sub-more')
  const seg = i0 >= 0 && i1 > i0 ? h.slice(i0, i1) : ''
  return i0 > 0 && i1 > i0 && !/<input|<textarea/.test(seg)
    && seg.includes('toggleSlotSub') && h.includes('openCellTask')
});
check('R169-16 ★有意偏离原型并备案', () => { const h = read('/newtab/views/CompassHome.vue'); const pc = read('/newtab/views/ProjectCuration.vue'); return !h.includes('展开关联任务树') && pc.includes('metric-head2') && pc.includes('openTaskAdd') && pc.includes('removeMetric');  });
check('R169-17 ★设置页导入导出文案（V3.7.0 重指：资源台「按文件夹建分类」括注随退役下线，书签导入单路径说清）：模板可见文字零轮次号（注释里的轮次号是开发者账，不算失真）；"导入前自动备份"与"附件要两步迁"写进界面而不是只存在于代码里', () => {
  const gs = read('/newtab/views/GlobalSettings.vue')
  const tplRaw = gs.slice(gs.indexOf('<template>'), gs.indexOf('</template>'))
  const tpl = codeOnly(tplRaw) /* 只判模板：注释里的轮次号是开发者账（且本文件 script 在 template 之后，整段切会连脚本一起判） */
  const ws = read('/newtab/views/Workspace.vue'); const man = read('/newtab/manual-data.ts')
  return !/第[卌卅卄一二三四五六七八九十]{1,4}轮/.test(tpl)
    && gs.includes('本页只把文件夹层级写成标签') && !gs.includes('前 2 级文件夹建成分类')
    && gs.includes('导入前会先自动下载一份当前数据备份')
    && !ws.includes('文件夹结构生成为分类（最多 2 级）')
    && man.includes('两步') && man.includes('不在 JSON 里')
});
check('R169-19 ★AI 徽标换骨第二轮（② 渐变实心脸）：图形仍只有一份、轮廓语义未动（头+双眼+天线，6 个形状），呈现改走两个可覆写口子 --ai-mark-fill / --ai-mark-eye；渐变两端一律取 accent 令牌，symbol 内零硬编码色（白眼睛除外——它是"头上的洞"，与宿主底色无关）', () => {
  const sym = read('/shared/components/AiMarkSymbol.vue'); const zm = read('/shared/components/AiMark.vue')
  const css = sym.slice(sym.indexOf('<style>'))
  return (sym.match(/<path|<circle|<rect/g) || []).length === 6 && sym.includes('symbol id="zy-ai-mark"')
    && css.includes('fill: var(--ai-mark-fill, url(#zy-ai-grad))') && css.includes('fill: var(--ai-mark-eye, #fff)')
    && css.includes('stop-color: var(--accent)') && css.includes('stop-color: var(--accent-2)')
    && !/#[0-9a-fA-F]{3,6}/.test(css.replace(/#fff\)/g, ''))
    && !/<path|<circle|<rect/.test(zm) && zm.includes('<use href="#zy-ai-mark"')
});
check('R169-20 ★accent 底上的徽标必须反相（本轮最贵的视觉陷阱）：三处"底色翻 accent + 文字翻白"且直接挂着 AiEntryButton 的宿主各自声明 --ai-mark-fill:#fff / --ai-mark-eye:var(--accent)。★这里只做"点名核对"，不做全仓自动扫——扫过一版就要红一遍：文件里别处存在 .mini-btn.primary 这类 accent 规则会被误判成冲突（宿主类名相同但元素不是它）。真正的"糊没糊"由 theme-audit 在真 DOM 上 hover 后读计算 fill 来判（活体门禁），那条才是这类视觉问题的正确归属', () => {
  const ch = read('/newtab/views/CompassHome.vue'); const tdd = read('/newtab/components/compass/TaskDetailDrawer.vue'); const tab = read('/newtab/components/ThesisAiBtn.vue')
  const ov = '--ai-mark-fill: #fff; --ai-mark-eye: var(--accent)'
  return tdd.includes('.ts-ai-cell:hover { background: var(--accent); color: #fff; box-shadow: 0 0 0 3px var(--accent-glow); ' + ov + '; }')
    && tab.includes('.th-ai-btn:hover { background: var(--accent); color: #fff; ' + ov + '; }')
    && ch.includes('.focus-why-ico.on { background: var(--accent); border-color: var(--accent); color: #fff; ' + ov + '; }')
});
check('R169-21 ★自动推荐的触发点注册顺序（本轮自查抓到的真缺陷）：watch(d) 必须在 todayKey/FOCUS_LIMIT/ensureAutoFocus 之后注册 —— immediate watch 在 setup 期就跑，放文件头会读尚未初始化的 const（TDZ），async 把异常吞成 unhandled rejection ⇒ 首屏三格永远空、界面上一个字都不说。perf-census A/B 实测到才修（641 vs 640）', () => {
  const ch = codeOnly(read('/newtab/views/CompassHome.vue'))
  const iWatch = ch.indexOf("watch(d, (dd) => { if (dd) void ensureAutoFocus() }, { immediate: true })")
  const iFn = ch.indexOf('async function ensureAutoFocus')
  const iKey = ch.indexOf('const todayKey = computed')
  const iMount = ch.indexOf('onMounted(() => { refreshWce?.() })')
  return iWatch > iFn && iWatch > iKey && iWatch > iMount && !ch.includes('void ensureAutoFocus() })')
});
check('R169-22 ★"今天已推荐过"的章只在真看过任务池之后才盖：候选为空且库里确实没有未完成事项 ⇒ 不写 focusAutoDate（否则 store.data 尚未载入的那一瞬间会被误当成"用户的一天"，这一整天再也不会有推荐）', () => {
  const ch = codeOnly(read('/newtab/views/CompassHome.vue'))
  const seg = ch.slice(ch.indexOf('async function ensureAutoFocus'), ch.indexOf('void refineWithAi(key)'))
  return seg.includes("if (!cands.length) {") && seg.includes("some(t => !t.deletedAt && t.status !== 'done')")
    && /if \(!cands\.length\) \{[\s\S]*?\n    return\n  \}/.test(seg) && !seg.includes('d.value.focusAutoDate = key\n  if (!cands.length)')
});

// ============== R169-老账闭环（R168 交付说明 §七 + R164 提案 E3/E4） ==============
console.log('【R169-老账闭环】');
// V3.7.0（R179）退役：分类控件随池语义整体退役（ResourceEditForm 不再有分类行）——
// 「分类自绘选择器」这条老账随宿主消失而结清；CatPicker 组件本体保留（随 R2 管理面再议），
// 本断言转守退役边界：表单零分类控件 + 组件本体健在（可直接复用）。
check('R169-23 老账①（V3.7.0 退役）：ResourceEditForm 分类控件零残留（原生 select 与 CatPicker 一并下线）；CatPicker 组件本体保留待复用', () => {
  const f = codeOnly(read('/newtab/components/ResourceEditForm.vue'));
  const cp = read('/shared/components/CatPicker.vue').replace(/\r\n/g, '\n');
  return !f.includes('<select') && !f.includes('CatPicker') && !f.includes('catOptions')
    && cp.includes("defineProps<{") && cp.includes('modelValue?: string') && cp.includes("emit('update:modelValue', id)")
    && cp.includes("e.key === 'Escape'") && cp.includes("e.key === 'ArrowDown'") && cp.includes("e.key === 'Enter'")
    && cp.includes('useOverlayTarget');
});
check('R173-T1（R169-24 重指带备案；R173-T3 收口带备案）★ 看板列窗口化改**视口驱动**：R169 原口径「列数 > 60 才裁剪」在真库 50 台 / 33 列（48 个资源台）下永不触发、等于没做——R172 实测切看板仍 +1143 节点 / 阻塞 249ms。现口径：窗口 = 滚动位置 ± KANBAN_COL_BUFFER，窗口外两侧渲染等宽 ghost 占位（1 节点/列）保横向几何、scrollWidth 不随窗口漂移；拖拽源列由 setKanbanDragCol 钉住（源节点中途被摘 ⇒ dragend 可能不触发、dragState/dropMark 残留）。★空哨兵必须 null：「待分类」列 key 就是 \'\'，用 \'\' 表空闲会恒命中最后一列（实测 hi 恒 = n-1、窗口右缘收不回、切看板仍全量 23 列）。R173-T3 收口：窗口化的代价是「目标列不在窗外 ⇒ kc-card 节点根本不渲染」——kc-card 补 data-rid+flash、定位时 .kanban 先横滚到目标列（scrollLeft → measureKanbanWin）再抬列内限额。★备案：T3 另查过「检索面板独立合成层（.gp-panel will-change）」提案，真包 A/B 与顺序平衡变体轮转均无可复现收益（早前 lpanel=0 系顺序混淆），已撤下不入包，账见 docs/交付说明_R173-T_性能主线四刀.md', () => {
  const v = codeOnly(read('/newtab/composables/useResourceView.ts')); const w = codeOnly(read('/newtab/views/Workspace.vue')); const css = read('/newtab/views/workspace.css');
  return v.includes('const KANBAN_COL_PITCH = 274') && v.includes('const KANBAN_COL_BUFFER = 2') && v.includes('Math.floor(el.scrollLeft / KANBAN_COL_PITCH) - KANBAN_COL_BUFFER') && v.includes('const kanbanDragKey = ref<string | null>(null)') && v.includes('kanbanDragKey.value === null ? -1 :') && v.includes('function setKanbanDragCol(') && v.includes('function measureKanbanWin(') && v.includes('onActivated(onKanbanWinResize)') && v.includes('wrap.scrollLeft = Math.max(0, (ci - KANBAN_COL_BUFFER) * KANBAN_COL_PITCH)') /* R173-T3：目标列先入窗（否则节点不渲染、定位静默落空） */
    && w.includes('class="kanban" ref="kanbanWrapRef" @scroll="onKanbanWinScroll"') && w.includes('v-for="g in kanbanGhostL"') && w.includes('v-for="g in kanbanGhostR"') && w.includes('setKanbanDragCol(r.categoryId') && w.includes('setKanbanDragCol(null)')
    && w.includes('flash: highlightId===r.id, \'drop-line-t\'') /* R173-T3：kc-card 接 flash */ && w.includes(':data-rid="r.id" :draggable="!batchMode" @dragstart="onDragStart($event,r); setKanbanDragCol(') /* R173-T3：kc-card 补 data-rid（e2e 早就按这个选择器取卡） */ && css.includes('.res-card.flash, .res-row.flash, .kc-card.flash') /* R173-T3 */
    && !w.includes('kanbanWinMore') && !css.includes('.kc-col-more') && css.includes('.kanban-col.kc-ghost');
});
check('R169-25 老账③ 抽屉两代容器合并：Workspace 自绘 .drawer 退役、资源详情抽屉走共享 Drawer.vue 壳（Teleport/Esc/遮罩/进出场/reduced-motion 单源）；壳带 bodyClass prop 承载镜像只读态；workspace.css 零 .dr-head/.dr-close/.drawer{ 残留（.dr-footer-btn 家族因弹窗复用而保留，见交付说明）★备案：本条对 Workspace.vue 用裸读不用 codeOnly——模板 accept="image/*," 的 /* 会被注释剥离吞掉后续代码（R169 实踩）', () => {
  const w = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8').replace(/\r\n/g, '\n');
  const d = read('/shared/components/Drawer.vue').replace(/\r\n/g, '\n');
  const css = read('/newtab/views/workspace.css');
  return !w.includes('class="drawer"') && !w.includes('class="overlay"')
    && w.includes('<Drawer :open="drawerOpen" width="520px" :body-class="drawerReadonly') && w.includes("import Drawer from '@/shared/components/Drawer.vue'")
    && d.includes('bodyClass?: string') && d.includes(':class="bodyClass"') && d.includes('prefers-reduced-motion: reduce')
    && !css.includes('.dr-head') && !css.includes('.dr-close') && !css.includes('.drawer {') && !css.includes('.dr-enter-active')
    && css.includes('.dr-readonly .ref-form') && css.includes('.dr-footer-btn {');
});
check('R169-26 老账④ 脚本归档白名单：scripts/ 根目录只允许 17 个登记脚本（门禁/量具/生成器）；一次性探针 9 个已归档 scripts/archive/（R164 提案 E4：门禁清单只列活的）——根目录出现未登记文件即红 ★R174-1 备案：regression/ 分片目录（helpers + 11 时代分片，见 R164-2 行数门禁）随分片落地加入白名单', () => {
  const ALLOW = ['check-cycles.cjs', 'e2e.cjs', 'entry-literals.cjs', 'entry-matrix.cjs', 'gen-code-index.cjs', 'gen-pinyin-table.cjs', 'img-diff.cjs', 'pack.cjs', 'perf-census.cjs', 'perf.cjs', 'probe-f.cjs', 'regression-eb.cjs', 'regression.cjs', 'test-import-compat.cjs', 'theme-audit.cjs', 'theme-contrast.cjs', '.gate-cache.json'];
  const actual = fs.readdirSync(SCRIPTS_DIR).filter(f => f !== 'archive' && f !== 'regression' && !f.endsWith('.log'));
  return actual.length === ALLOW.length && actual.every(f => ALLOW.includes(f)) && fs.existsSync(path.join(SCRIPTS_DIR, 'archive', 'test-perf.cjs')) && fs.existsSync(path.join(SCRIPTS_DIR, 'regression', 'helpers.cjs'));
});
check('R174-2 ZIP 减重（04-69 T0-b）：pack.cjs 发布包剥离 .vite/ 构建元数据（dist/.vite/manifest.json 29,010B 运行时零引用，与 *.map 同列剥出）+ logo 单源化（src/assets/logo.png 退役，见 10-foundations logo 断言备案）——两项合计原始 −47,641B；判据：pack.cjs 含 viteDir 剥离逻辑 + logo 双源不复存在', () => {
  const p = read('/../scripts/pack.cjs');
  return p.includes("path.sep + '.vite' + path.sep") && p.includes("!f.includes(viteDir)") && !fs.existsSync(base + '/assets/logo.png');
});
check('R174-3 ★zy_daily_stats 落盘（04-69 T1）：热力图不褪色的数据地基——① 独立存储通道 dailyStatsStore.ts（时间闸 45s + 页隐藏/卸载 flushDailyStatsNow 跳闸补写 + 内容未变跳写 + base 恒存 0 由消费方反推）；② repository saveData/saveDataNow 两处保存链都挂 scheduleDailyStatsWrite（不进整库 set 包）；③ 纯合并 mergeDailyStats：边界日规则——k>boundary 重建权威 / k≤boundary 且重建无此日整日取快照 / 重建有此日则**事件段换快照（c/del/s/u/x）+ 字段段留重建（d/sub/focus/link）**，w = 快照事件分+重建字段分（防边界日幸存事件双计）；④ 数据桥 useDashboardStats 启动装载 readDailySnapshot + snapRef 触发重算（首帧不等快照）', () => {
  const st = read('/shared/storage/dailyStatsStore.ts');
  const rp = read('/shared/storage/repository.ts');
  const ds = read('/shared/utils/dailyStats.ts');
  const ub = read('/newtab/components/dashboard/useDashboardStats.ts');
  return st.includes('DAILY_STATS_WRITE_GATE_MS = 45_000') && st.includes("document.addEventListener('visibilitychange'") && st.includes("window.addEventListener('pagehide'")
    && st.includes('flushDailyStatsNow') && st.includes("base: { res: 0, task: 0, curio: 0, link: 0 }") && st.includes('json === lastWrittenJson')
    && (rp.match(/scheduleDailyStatsWrite\(cache\)/g) || []).length === 2 && !rp.includes('DAILY_STATS_STORE_KEY')
    && ds.includes('export function mergeDailyStats(') && ds.includes('export function boundaryDayOf(') && ds.includes('export function eventFieldW(')
    && ds.includes('c: sr.c, del: sr.del, s: sr.s, u: sr.u, x: sr.x') && ds.includes('if (k > boundary) continue')
    && ub.includes('readDailySnapshot') && ub.includes('mergeDailyStats(snapRef.value, rebuilt, boundaryDayOf(ev))') && ub.includes('snapRef.value = s');
});
check('R174-4 概览带 ★R178 重指带备案：用户 2026-09-28 设置中心原型把概览带改回堆叠指标卡（ov-metric-card：数字 20px/700 + tabular-nums 置顶、标签 11px 在下，卡距 10px），R174-4 的单行压缩完成历史使命——信息一项不删（R173-5 悬停说明、绑定态、口径表全保留），dz-sec-ov 专段内边距判据保留；判据：DashboardOverview 挂 dz-sec-ov + chip 内联三件 + css 纵向堆叠 + 专段三压（页头 3px/正文 4·8/行距 4px/药丸去边框）（探针量化记账存档：1280 档 188px → 94px，R174 版式）', () => {
  const o = read('/newtab/components/dashboard/DashboardOverview.vue');
  const css = read('/newtab/components/dashboard/dashboard.css');
  return o.includes('class="dz-sec dz-sec-ov"') && o.includes('<span class="k">{{ c.k }}</span><b class="v">')
    && css.includes('.dz-chip { display: flex; flex-direction: column;') && css.includes('.dz-sec-ov .dz-sec-h { padding: 3px var(--sp-4); }')
    && css.includes('.dz-sec-ov .dz-sec-b { padding: var(--sp-1) var(--sp-4) var(--sp-2); }');
});
check('R174-5 热力图焦点化（04-69 拍板 B）：摘要四卡压单行指标条（说明收 title tooltip，.d 保 DOM）+ 四主题六档色阶低两档拉距（亮主题 l0↔l1 原本 ΔL*≈3.3 肉眼不可辨——实测病根 #EFF2F6 vs #E3EBF5）；判据：① Heatmap 摘要条带 title + .d 仍在 DOM ② tokens.css 四主题新值在位 ③ 亮主题 ΔL*(l0,l1) ≥ 5 且 ΔL*(l1,l2) ≥ 4（Lab L* 实算，防"改了但仍不可辨"）④ 档位阈值/语义名不动（跨年可比红线）', () => {
  const h = read('/newtab/components/dashboard/Heatmap.vue');
  const tk = read('/shared/styles/tokens.css');
  const lv = read('/shared/utils/dailyStats.ts');
  const hex2lab = (hex) => {
    const c = [0, 2, 4].map(i => { let v = parseInt(hex.slice(i + 1, i + 3), 16) / 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; });
    const X = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, Y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, Z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return 116 * f(Y) - 16;
  };
  const dL = (a, b) => Math.abs(hex2lab(a) - hex2lab(b));
  const lightPairs = [['#EFF2F6', '#D4E1F2', '#B6CBE8'], ['#F0F1F4', '#D5DCEE', '#B8C8E6']];
  return h.includes(':title="s.d"') && h.includes('<span class="d">{{ s.d }}</span>')
    && ['--heat-1: #1E3455', '--heat-1: #203757', '--heat-1: #D4E1F2', '--heat-1: #D5DCEE'].every(x => tk.includes(x))
    && !tk.includes('--heat-1: #E3EBF5') && !tk.includes('--heat-1: #E4E9F2')
    && lightPairs.every(([l0, l1, l2]) => dL(l0, l1) >= 5 && dL(l1, l2) >= 4)
    && lv.includes("w <= 8 ? 1 : w <= 18 ? 2 : w <= 32 ? 3 : w <= 52 ? 4 : 5") && lv.includes("['静默', '轻触', '常规', '高负荷', '冲刺', '满格']");
});
check('R174-6 saveReportCard 刷新分支进撤销栈（04-69；04-68 §5 挂账「文案承诺可撤销而刷新分支不进」收口）：dup 分支捕获刷新前 description/tags/updatedAt 并 pushUndo 恢复型撤销（非软删——卡还在，被改的是内容），回执文案补 Ctrl/Cmd+Z 可撤销承诺——文案与行为一致', () => {
  const rp = read('/shared/ai/reports.ts');
  return rp.includes('const prevDesc = dup.description') && rp.includes('撤销报告卡刷新') && rp.includes('{ ...dup, description: prevDesc, tags: prevTags, updatedAt: prevAt }')
    && rp.includes('（同日重跑不另起新卡 · Ctrl/Cmd+Z 可撤销）');
});
check('R169-27 老账④ 文档冻结：docs/ 300+ 份交付说明标记为只读归档（README 冻结声明在位；现状唯一活清单 = 文档中心/06-2，R164 提案 E3）', () => {
  const rm = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', '..', 'docs', 'README.md'), 'utf8');
  return rm.includes('只读归档') && rm.includes('06-2');
});

check('R170-1 项目详情入口：ProjectCuration 标题行补「📄 详情」按钮（用户红框反馈）——本页挂 ProjectDetailDrawer（此前只挂在方向树/北极星，两宿主同源单份不重建）', () => {
  const pc = read('/newtab/views/ProjectCuration.vue');
  return pc.includes("import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'")
    && pc.includes('<ProjectDetailDrawer :open="projDetailOpen && !!currentProject" :project-id="currentProject?.id || \'\'" @close="projDetailOpen = false" />')
    && pc.includes('function openProjectDetail') && pc.includes('@click="openProjectDetail"')
    && pc.includes('pb-title .pd-open');
});

check('R170-2 详情抽屉全局统一拖宽：共享 Drawer.vue 壳左缘 .drawer-resize 把手（420~min(85vw,960) 夹住 + 双击复位默认宽）+ 记忆口径 = 全局单键 UIPrefs.drawerWs.shared（拍板：全局统一，不按抽屉分键；TaskDetailDrawer 自有 drawerWs.task 先于本机制存在、保持不动）；拖拽期 .dragging 禁选区禁过渡', () => {
  const d = read('/shared/components/Drawer.vue');
  return d.includes('drawer-resize') && d.includes('function startResize') && d.includes('clampW')
    && d.includes('drawerWs?.shared') && d.includes('shared: w.value') && d.includes('saveUIPrefs({ drawerWs: store.ui?.drawerWs || { shared: w.value } })')
    && d.includes('@dblclick="resetWidth"') && d.includes('user-select: none') && d.includes('W_MIN = 420');
});

check('R170-3 导入页「选择文件」按钮防挤压：.gs-io-btn 加 flex-shrink:0 + nowrap + align-self:center（描述文字一长按钮被压到换行，用户截图反馈）', () => {
  const gs = read('/newtab/views/GlobalSettings.vue');
  return gs.includes('.gs-io-btn { margin-left: auto; flex-shrink: 0; white-space: nowrap; align-self: center; }')
    && (gs.match(/class="gs-btn[^"]*gs-io-btn"/g) || []).length === 3;
});

check('R170-4 ★视觉走查工具注入时序修复：theme-audit 注入 zy_data/zy_ui 后必须整页重载一次——后注入的 uiPrefs 到不了运行中的 store.ui（mergeExternalUIPrefs 替换 uiCache 对象而 store.ui 持旧引用），真库有脏 isThesis 卡时资源台回落默认金字塔 ⇒ 资源卡详情镜头 .res-card 恒命中 0（v3.6.1 基线同现，纯工具盲区）；reload 丢 hash 坑以「记下→重载→写回」闭环', () => {
  const t = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8');
  return t.includes('keepHash') && t.includes('page.reload(') && t.includes('location.hash = h') && t.includes('R170 备案');
});

// ===== R171 V3.6.4（数据卫生 + 命令面板收口 + AiMark 改名） =====

check('R171-1 ★中心论点重复双函数真源：hub.ts 出 countThesisDuplicates（纯盘点不改数据）+ sanitizeThesisDuplicates（落地修复，幂等、只动活卡、保留每台数组序首张、软删卡不动）——不变量「每台最多一张 isThesis」的老数据违规有了统一修复原语', () => {
  const h = read('/shared/storage/hub.ts');
  return h.includes('export function countThesisDuplicates') && h.includes('export function sanitizeThesisDuplicates')
    && h.includes('R171-A1') && h.includes('r.deletedAt || !r.isThesis');
});

check('R171-2 ★两条导入链即净化：策展台数据包导入（useWorkspaceImport.handleBoardImport）与设置页全量导入（GlobalSettings.mergeImport）合并后都跑 sanitizeThesisDuplicates，且 toast 明示清理张数——导入不再制造幽灵论点', () => {
  const im = read('/newtab/composables/useWorkspaceImport.ts');
  const gs = read('/newtab/views/GlobalSettings.vue');
  return im.includes('sanitizeThesisDuplicates(d.value)') && im.includes('中心论点重复已净化')
    && gs.includes('const thesisFix = sanitizeThesisDuplicates(d)') && gs.includes('n.thesisClear');
});

check('R171-3 ★数据体检卡（设置→导出数据页）：中心论点重复检测（纯盘点 countThesisDuplicates，挂载即刷新）+ 一键修复按钮（useConfirm 确认 → sanitizeThesisDuplicates → persist → 复扫）——真库脏卡有了不进 AI 链的修复入口（R171 重指：R164-2 增长门禁，卡片实现抽独立组件 DataCheckupCard.vue，宿主一行挂载）', () => {
  const dc = read('/newtab/components/DataCheckupCard.vue');
  const gs = read('/newtab/views/GlobalSettings.vue');
  return dc.includes('🩺 数据体检') && dc.includes('refreshThesisScan') && dc.includes('fixThesisDuplicates')
    && dc.includes("countThesisDuplicates(store.data!)") && dc.includes('onMounted(refreshThesisScan)')
    && gs.includes('<DataCheckupCard v-if="activePage === \'export\'" />');
});

check('R171-4 ★命令面板「快速开关」组（04-63「全部开关收进去」收口）：GlobalPopups 出 PALETTE_TOGGLES（暗色主题/紧凑密度/已完成项目/备份提醒，computed 行内明示当前态），扁平列表与模板渲染序同步插组、runFlat/runFlatLocator 两键位都认 tgl；store.ui 手改与 saveUIPrefs 双写（R170 uiCache/store.ui 两份引用教训）', () => {
  const gp = read('/newtab/components/GlobalPopups.vue');
  return gp.includes('PALETTE_TOGGLES') && gp.includes("kind: 'tgl'") && gp.includes("it.kind === 'tgl'")
    && gp.includes('QUICK_ACTIONS.length+PALETTE_TOGGLES.length+j') && gp.includes('if (store.ui) (store.ui as')
    && (gp.match(/label: '(暗色主题|紧凑密度|已完成项目|备份提醒)'/g) || []).length === 4;
});

check('R171-5 ★ZhiMark→AiMark 全站改名（备案：语义对齐，symbol id="zy-ai-mark" 与 class ai-mark 本就是 ai 命名不动）：真源 AiMark.vue/AiMarkSymbol.vue 落位、src 全树零 ZhiMark 残留、入口唯一引用 AiEntryButton→AiMark、App 根只挂一次 AiMarkSymbol', () => {
  const zm = read('/shared/components/AiMark.vue'); const sym = read('/shared/components/AiMarkSymbol.vue');
  const ae = read('/shared/components/AiEntryButton.vue'); const app = read('/newtab/App.vue');
  const residue = ALL_VUE146.filter(f => f !== '/shared/components/AiMark.vue' && /ZhiMark/.test(read(f))); // 真源头部备案行本身提到旧名，豁免
  return zm.includes('R171-C3') && ae.includes("import AiMark from '@/shared/components/AiMark.vue'")
    && (app.match(/<AiMarkSymbol/g) || []).length === 1 && app.includes("import AiMarkSymbol from '@/shared/components/AiMarkSymbol.vue'")
    && residue.length === 0;
});

check('R171-6 ★accent-ink 淡底文字令牌（04-63 后账：accent+accent-light 暗主题对比度 3.28/3.40 裸奔）：tokens.css 四主题各落 --accent-ink（压 accent-light 底专用文字色，暗取提亮档/亮取深档），配对处 color: var(--accent)→var(--accent-ink) 全站随迁，theme-contrast 门禁升硬判据 ≥4.5（实测 5.37/4.78/5.64/6.22）', () => {
  const tk = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'styles', 'tokens.css'), 'utf8');
  const ct = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-contrast.cjs'), 'utf8');
  const ws = read('/newtab/views/workspace.css');
  return (tk.match(/--accent-ink:/g) || []).length === 4 && tk.includes('R171-C4')
    && ct.includes("'accent-ink/accent-light'") && ct.includes(', 4.5)')
    && ws.includes('var(--accent-ink)');
});

/* ================= R172 · 知源仪表盘 R3（04-66 / 04-67）第 1 轮：数据与算法 ================= */

check('R172-1 ★T1 事件日志增 call（调出）——EventAction 扩枚举 + 中文标签 + recordCallEvent 原语；stats.ts 两个打开入口（recordResourceOpen/recordCardOpen）成对记账；动作筛选与标签（含「调出」下拉，此前 call 会错落到「永久删除」）R172-T8 起迁入全量记录抽屉', () => {
  const el = read('/shared/utils/eventLog.ts');
  const st = read('/shared/storage/stats.ts');
  const gs = read('/newtab/views/GlobalSettings.vue');
  const lg = read('/newtab/components/dashboard/DashboardLogDrawer.vue');
  return el.includes("export type EventAction = 'create' | 'delete' | 'restore' | 'purge' | 'status' | 'call'")
    && el.includes("call: '调出'")
    && el.includes('export function recordCallEvent(')
    && el.includes("action: 'call'")
    && st.includes("emitCall(resource as OpenableCard, 'resource')")
    && st.includes('emitCall(card, fallbackKind)')
    && st.includes('recordCallEvent(k, card.title || card.question')
    && lg.includes('<option value="call">调出</option>')
    && lg.includes("call: '↗ 调出'")
    && lg.includes("type EventAction")
    && gs.includes("'↗ 调出'")
    && gs.includes("action === 'call'");
});

check('R172-2 ★T2 zy_daily_stats 聚合引擎（04-67 §7.4）：按日只增不淘汰 · 事件为主（六类折叠）+ 卡字段为辅（推进三维）· 前缀和查询不重扫 · 防刷分双规则（同卡同日第 2 次起调出 0.5 / 采集后 24h 内即软删该笔 ×0.3）· 零迁移', () => {
  const ds = read('/shared/utils/dailyStats.ts');
  const kt = read('/shared/storage/keys.ts');
  const md = read('/shared/models/index.ts');
  const el = read('/shared/utils/eventLog.ts');
  return kt.includes("DAILY_STATS: 'zy_daily_stats'")
    && ds.includes('export function buildDailyStats(')
    && ds.includes('export function stockAt(')
    && ds.includes('export function aggregateRange(')
    && ds.includes('export function actsOf(')
    && ds.includes('export const LV_NAME')
    && ds.includes('export function levelOf(')
    && ds.includes('export const CALL_REPEAT_FACTOR = 0.5')
    && ds.includes('export const QUICK_DELETE_FACTOR = 0.3')
    // 六类事件全在折叠 switch 里（漏一类即"时间序列缺一维"）
    && ['create', 'call', 'delete', 'purge', 'restore', 'status'].every(a => ds.includes(`case '${a}'`))
    // 空态/零迁移：无任何事件时 fullSince 回落当日，不抛错
    && ds.includes('fullSince: keys[0] || dayOf(nowTs)')
    // 子任务完成时刻字段（零迁移可选）+ 两处勾选点落 doneAt
    && md.includes('doneAt?: number')
    && read('/shared/components/SubtaskList.vue').includes('doneAt: !x.done ? Date.now() : undefined')
    && read('/newtab/views/CompassHome.vue').includes('doneAt: !s.done ? Date.now() : undefined')
    // 状态变更目标态（加权按目标态分档）
    && el.includes('to?: string')
    && el.includes('c.status))');
});

check('R172-3 ★T3 热力令牌组：tokens.css 四主题各 8 个（--heat-0..5 + --heat-ink + --heat-ring），顶档 --heat-5 四主题互不相同；theme-contrast 升硬判据（heat-ink/surface 与 heat-ink/surface-2 各 ≥4.5 + 令牌 8/8 + heat-5 唯一性）', () => {
  const tk = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'styles', 'tokens.css'), 'utf8');
  const ct = fs.readFileSync(path.resolve(SCRIPTS_DIR, 'theme-contrast.cjs'), 'utf8');
  const n = (re) => (tk.match(re) || []).length;
  return n(/--heat-0:/g) === 4 && n(/--heat-1:/g) === 4 && n(/--heat-2:/g) === 4 && n(/--heat-3:/g) === 4
    && n(/--heat-4:/g) === 4 && n(/--heat-5:/g) === 4 && n(/--heat-ink:/g) === 4 && n(/--heat-ring:/g) === 4
    && tk.includes('R172-T3')
    && ct.includes("'heat-ink/surface'") && ct.includes("'heat-ink/surface-2'")
    && ct.includes('HEAT_TOKENS') && ct.includes('heat5');
});

check('R172-4 ★T4 复盘计算引擎（04-67 §6/§7.6）：四范围窗口 + 等长环比（prevWindow 按 win.days 回推，杜绝"部分月 vs 整月"假下跌）+ 分位/排名 + 年度聚合 + 8 条偏离规则（R1~R8 齐全、非 AI 可断言）+ 6 KPI + 汇总入口；纯读取零写入', () => {
  const rr = read('/shared/utils/reviewReport.ts');
  return rr.includes('export function windowOf(')
    && rr.includes('export function prevWindow(')
    && rr.includes('const s = addDays(e, -(win.days - 1))')
    && rr.includes('export function pct(')
    && rr.includes('export function quantile(')
    && rr.includes('export function rankOf(')
    && rr.includes('export function yearAgg(')
    && rr.includes('export function longestStreak(')
    && rr.includes('export function runRules(')
    && rr.includes('export function kpisOf(')
    && rr.includes('export function buildReview(')
    // R172-T7 重指带备案：原「分发内核」（按方向均摊的假分布）已删，换成真实多跳接线
    //   产出 → 任务 → projectId → 所属 direction（objectivesOf / tasksOfDirection）
    && rr.includes('export function objectivesOf(')
    && rr.includes('export function tasksOfDirection(')
    && ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'].every(r => rr.includes(`id: '${r}'`))
    && rr.includes('const k = Math.max(0.25, days / 30)')
    // 只读纪律：不得出现任何存储写入
    && !/\.persist\(|saveData|chrome\.storage/.test(rr);
});

check('R172-5 ★T5 概览带（04-66 §4.2 可读性三层 / 04-67 F1~F6）：5 张存量 chip + 时间绑定（Q11：selDay 非空 ⇒ 截至那天的库容 + 当日增减 + bind 高亮）+ 人话总结（主数字=有效动作件数，加权分降副行）+ 参照系行（等长窗口环比 近30vs前30 / 近7vs前7 + P 分位 + 年度移出）+ 分数口径表 12 行', () => {
  const o = read('/newtab/components/dashboard/DashboardOverview.vue');
  const gs = read('/newtab/views/GlobalSettings.vue');
  const ud = read('/newtab/components/dashboard/useDashboardStats.ts'), css = read('/newtab/components/dashboard/dashboard.css');
  return o.includes('dz-ov-info') && o.includes('dz-ov-tip') /* R173-5：说明改 hover，不再占整行 */ && css.includes(':focus-within .dz-ov-tip') /* hover-only 会把信息锁在鼠标后面，键盘 Tab 也要能看到 */ && css.includes('.dz-sec.dz-tip-open { overflow: visible; }') /* R173-5：悬停期间放开圆角裁切（`.dz-sec` 默认 overflow:hidden，浮层向下展开会被切掉） */ && /\.dz-ov-meta \{[^}]*flex: 1 1 100%/.test(css) && /\.dz-ov-meta \{[^}]*position: relative/.test(css) && !/\.dz-ov-info \{[^}]*position: relative/.test(css) /* R173-5 真机截图：指标行不再独占整行后 5 张 chip 被挤成 100px 竖列；浮层锚在**整行**上（锚药丸在窄屏会把 460px 浮层顶出左边界 388px） */ && o.includes('stockBoundTo(')                    // ★ 时间绑定走前缀和（不重扫全库）
    && o.includes('aggregateRange(')                    // 环比用区间聚合
    && o.includes('addDays(ref, -29)') && o.includes('addDays(ref, -59)')  // 等长窗口：近30 vs 前30
    && o.includes('addDays(ref, -6)') && o.includes('addDays(ref, -13)')
    && o.includes('W_ROWS')                             // 分数口径表 12 行（单一真源）
    && o.includes('dz-chip') && o.includes("'📇 资源卡'") && o.includes("'🔗 链接卡'")
    && o.includes('dz-ov-say') && o.includes('次有效动作')  // 人话总结
    && o.includes('加权分是内部量') /* R173-5：括注挪进 title，屏上不占字 */            // 加权分降为副行
    && o.includes('bind: !!selDay')                      // 绑定态高亮
    // 数据桥（R164-2 增长门禁：聚合与选中态抽 useDashboardStats，不占视图行数；R174-3 重指带备案：重建行改名 `ev` 且后接快照合并）
    && ud.includes('buildDailyStats(data(), ev)') && ud.includes('mergeDailyStats(snapRef.value, rebuilt, boundaryDayOf(ev))') && ud.includes('const selDay = ref<string | null>(null)')
    && gs.includes("from '@/newtab/components/dashboard/useDashboardStats'")
    && gs.includes('const dashStats = dash.stats');
});
check('R172-6 ★T6 年度热力图（04-67 F7~F11）：12 月块 × 366 格（周一~周日 + future/today/sel 三态；★R172-T13 重指带备案：月首偏移改走 `grid-column-start`，不再渲染 void 占位格 ⇒ 一年多 38 个不可点的假控件 button 与 38 个节点被消掉）+ 六档语义图例（LV_NAME 单一真源；不出现分档裸代号）+ 4 张摘要卡（活跃天数/有效动作/最长连续/最猛的一天「MM-DD · 档名」）+ P90 由实际数据算出（非硬编码）+ 切年', () => {
  const h = read('/newtab/components/dashboard/Heatmap.vue');
  return h.includes('LV_NAME') && h.includes('LV_DESC') && h.includes('LV_RANGE')
    && h.includes('longestStreak(') && h.includes('yearAgg(')
    && h.includes("shiftYear(-1)") && h.includes('emit(\'update:year\'')
    && h.includes('agg.p90')                    // P90 实算
    && h.includes('今年第 1') && h.includes('· ${LV_NAME[lv]}')  // 「MM-DD · 满格」带分隔
    && h.includes("'future'") && h.includes('start: firstDow + 1') && h.includes('grid-column-start:')
    // ★ F8 可读性硬判据：图例区不得出现分档裸代号（大写 L+数字）
    && !/L[0-5]/.test(h);
});
check('R172-7 ★T6 日详情（04-67 F12~F17）：四列指标（采集/调出/状态变更/推进）可点开下钻 + 下钻同卡聚合 ×N（R172-T7 起分组逻辑上移 `shared/utils/drillRows.ts` 单一实现，顺带修掉 `t1/t2` 与 `time/time2` 契约不一致导致的时间列空白）+ 库容变化条（deltaOf 分卡种净增减）+ 当日流水（zy_event_log 按日过滤）+ [查看全部记录 ›] 入口', () => {
  const d = read('/newtab/components/dashboard/DayDetail.vue');
  const dr = read('/shared/utils/drillRows.ts');
  return dr.includes('export function groupEventRows(') && dr.includes('cur.row.n++') && dr.includes('x.row.time = hm(x.t1)')
    && d.includes('groupEventRows(') && d.includes("from '@/shared/utils/drillRows'")
    && d.includes("sel = ref<MetricKey>('create')") && d.includes('dz-mcol')
    && d.includes('deltaOf(props.stats, props.day)') && d.includes('stockAt(props.stats, props.day')
    && d.includes('该日库容变化') && d.includes('当天入台') && d.includes('当天移出')
    && d.includes("emit('open-log', day)") && d.includes('查看全部记录')
    && d.includes('EVENT_ACT_LABEL[e.action]')      // 流水动作标签单一真源
    && d.includes('subtasks') && d.includes('supportLinks') && d.includes('dailyFocus');
});
check('R172-8 ★T6 共用下钻卡片列表（04-66 §6.2 组件复用）：单一实现（DrillCardList.vue），单击=定位并高亮（locateTargetOf）、双击=直达链接/打开文件（openExternalLink）+「N 类卡片 · 共 M 条记录（同卡多次已合并 ×N）」表头', () => {
  const c = read('/newtab/components/dashboard/DrillCardList.vue');
  const d = read('/newtab/components/dashboard/DayDetail.vue');
  return c.includes('locateTargetOf(') && c.includes('asLocateKind(') && c.includes('openExternalLink(')
    && c.includes('@click="pick(r)"') && c.includes('@dblclick="open(r)"')
    && c.includes('同卡多次已合并 ×N') && c.includes('dz-row-n')
    && d.includes("import DrillCardList from './DrillCardList.vue'");
});
check('R172-9 ★T6 性能红线：概览带时间绑定不触发整库重扫（DashboardOverview 只吃 stats prop，不得自行扫 store.data / resources）+ zy_daily_stats 走前缀和（stockAt 只累加 days）', () => {
  const o = read('/newtab/components/dashboard/DashboardOverview.vue');
  const ds = read('/shared/utils/dailyStats.ts');
  return !o.includes('useAppStore') && !o.includes('store.data') && !o.includes('resources')
    && o.includes('props.stats')
    && ds.includes('export function stockAt(')
    && /for \(const k of Object\.keys\(stats\.days\)\.sort\(\)\)/.test(ds);
});

/* ================= R172 · 知源仪表盘 R3 第 3 轮：复盘段 + 记录抽屉 + 入口整合 ================= */

check('R172-10 ★T7 复盘段（04-67 F21~F26）：紧凑两栏（`.dz-rev-grid` 实测 2 列）+ 四范围（周/月/自定义/项目）+ 粒度自适应（week→day / month→week / >120 天→month）+ 6 KPI 可下钻（复用同一 `DrillCardList`）+ 目标对账条形可下钻（`objectivesOf`/`tasksOfDirection` 真实多跳接线）+ 规则下钻给出阈值与实际值（`runRules` 同处产出 thr/act）+ 纯读取零写入（不碰 store）', () => {
  const rp = read('/newtab/components/dashboard/ReviewPanel.vue');
  const css = fs.readFileSync(path.resolve(base, 'newtab', 'components', 'dashboard', 'dashboard.css'), 'utf8');
  const rr = read('/shared/utils/reviewReport.ts');
  const gs = read('/newtab/views/GlobalSettings.vue');
  return css.includes('.dz-rev-grid { display: grid; grid-template-columns: 1fr 1fr;')
    && rp.includes('buildReview(') && rp.includes("pickRange('week')") && rp.includes("pickRange('month')")
    && rp.includes("pickRange('custom')") && rp.includes("pickRange('project')")
    && rp.includes('trendMode') && rp.includes('days > 120')
    && rp.includes("import DrillCardList from './DrillCardList.vue'") && rp.includes('objectivesOf(') && rp.includes('tasksOfDirection(')
    && rp.includes('ruleHit') && rp.includes('ruleHit.thr') && rp.includes('ruleHit.act')
    && rr.includes('thr: string; act: string')
    && gs.includes('<ReviewPanel') && gs.includes(':directions="dashDirections"') && gs.includes(':tasks="dashTasks"')
    && !rp.includes('useAppStore') && !rp.includes('store.persist');
});

check('R172-11 ★T8 全量记录抽屉（04-67 F18~F20）：三维筛选（类型 × 动作 × 时间）均生效 + 动作下拉**必须含「调出」**（旧设置页缺这一项）+ CSV 导出对象 = **当前筛选结果**（非全量）+ 容量提示与 `EVENT_LOG_CAP` 同源 + 四类记录入口承接（今日入台/移出/调出/写入记录）', () => {
  const d = read('/newtab/components/dashboard/DashboardLogDrawer.vue');
  const gs = read('/newtab/views/GlobalSettings.vue');
  return d.includes('v-model="kind"') && d.includes('v-model="action"') && d.includes('v-model="from"') && d.includes('v-model="to"')
    && d.includes('<option value="call">调出</option>')
    && d.includes('rows: filtered.value.map(e =>')
    && d.includes('EVENT_LOG_CAP') && d.includes('日志容量')
    && gs.includes("openLog('in')") && gs.includes("openLog('out')") && gs.includes("openLog('called')") && gs.includes("openLog('log')")
    && gs.includes(':preset="logPreset"') && gs.includes(':open="logOpen"');
});

check('R172-12 ★T9 调度台入口整合（04-67 F33~F36）：删 5 个旧入口（`.rec-mini` 四格 / 今日记录抽屉 / `wrOpen` / `onWrDrill` / 周报浮层）—— CompassHome 零残留；右槽仅「📈 复盘」直达 `/settings?page=dashboard`；`MetricBar.vue` 中段 5 指标零改动（Q8）；被删的四类记录能力在仪表盘内等价可用', () => {
  const h = read('/newtab/views/CompassHome.vue');
  const mb = read('/newtab/components/compass/MetricBar.vue');
  const gs = read('/newtab/views/GlobalSettings.vue');
  const fsx = require('fs');
  return !h.includes('rec-mini') && !h.includes('openRec(') && !h.includes('recOpen') && !h.includes('wrOpen')
    && !h.includes('onWrDrill') && !h.includes('📊 周报')
    && h.includes('📈 复盘') && h.includes("router.push('/settings?page=dashboard')")
    && !fsx.existsSync(path.resolve(base, 'newtab', 'components', 'WeeklyReportOverlay.vue'))
    && !fsx.existsSync(path.resolve(base, 'shared', 'utils', 'weeklyReport.ts'))
    && mb.includes('战略目标') && mb.includes('未归档') && mb.includes('mb-right')
    && gs.includes("openLog('called')") && gs.includes('onDashOpenLog');
});

check('R172-13 ★规格张力收口（R166 定案 3 优先于 04-67 §7.2 初值）：子任务完成计分 `W.subtask = 0`（不进加权分 ⇒ 不影响热力图档位），分数口径表第 10 行标注「不计分」；件数口径**不动**（`DayRec.sub` 仍计入推进与有效动作件数，R3/R5 仍以它作"完成项"凭据）—— 边界已在 dailyStats 文件头登记，未外延。★2026-09-27 用户拍板：子任务完成不计分（本条即终态，非临时）', () => {
  const ds = read('/shared/utils/dailyStats.ts');
  return ds.includes('subtask: 0, focus: 2.5, link: 1.0')
    && ds.includes('R166 定案 3')
    && ds.includes('子任务勾选完成（R166 定案 3：不计分）')
    && ds.includes('r.sub++; r.d++; r.w += W.subtask')
    && !ds.includes('subtask: 0.8');
});

/* R172 第 4 轮 T11/T12：AI 复盘文本报告 + 导出三件套 —— 本组只测**构造**，不测模型输出（闭环与可回溯若靠模型自由发挥就永远不可验证） */
const RV = () => codeOnly(read('/shared/ai/review.ts')); const RVM = () => codeOnly(read('/newtab/components/dashboard/ReviewReportModal.vue')); const has = (src, list) => list.every(s => src.includes(s));
check('R172-14 ★F29「以上统下」闭环是构造保证而非祈祷：主张词单一真源 `CLAIM`，结论句与论据 `rel` 都从 `CLAIM.` 取值（不允许两处各写一遍字面量）', () => {
  const rv = RV();
  return has(rv, ['export const CLAIM = {', "run: '有在推进'", "skew: '方向明显偏斜'", "steady: '方向没有被跑偏'",
    '支撑「${CLAIM.run}」', '<b>${CLAIM.run}</b>', '<b>${CLAIM.skew}</b>', '<b>${CLAIM.steady}</b>',
    'rel: `支撑「${pc.claim}」`', 'const pc = progressClaim(pg.done, pg.doing)', 'const claims = [CLAIM.run, claim2, pc.claim]']);
});
check('R172-15 ★F30 论据③三态由证据决定（完成>0 → 有实物产出 / 进行中>0 → 开了口没闭合 / 皆无 → 完全没被触碰），且有完成项的那一分支内不得出现"偏弱 / 没闭合 / 没被触碰"', () => {
  const rv = RV(), i = rv.indexOf('function progressClaim');
  const body = rv.slice(i, rv.indexOf('export function buildReviewReport', i));
  const doneBranch = body.slice(body.indexOf('if (done > 0)'), body.indexOf('if (doing > 0)'));
  return body.includes('if (done > 0)') && body.includes('if (doing > 0)') && doneBranch.includes('CLAIM.output')
    && !/偏弱|没闭合|没被触碰/.test(doneBranch) && body.includes('claim: CLAIM.open') && body.includes('claim: CLAIM.untouched') /* R173-3 零态（真机截图：0 动作却写"有在推进"）：整期无动作必须先分流，主张词换成「本期没有任何动作记录」 */ && rv.includes('if (!a.acts)') && rv.includes("zero: '本期没有任何动作记录'") && rv.includes('claims: [CLAIM.zero]');
});
check('R172-16 ★F28 四段文本 + 无金字塔图形：弹框按 结论→支撑论据→洞察→建议 出 4 个 h3（顺序即断言），运行态文案含「金字塔原理」，报告链两文件零 polygon / clip-path / 梯形 / 带宽 残留', () => {
  const m = RVM();
  const order = ['<h3>结论</h3>', '<h3>支撑论据</h3>', '<h3>洞察</h3>', '<h3>建议（按优先级）</h3>'].map(s => m.indexOf(s));
  return order.every(v => v >= 0) && order.every((v, k) => k === 0 || v > order[k - 1])
    && has(m, ['组织本期内容：先核对结论与论据', '金字塔原理', 'class="lead"', 'class="rel"', 'dz-rpt-ctl', 'personaId', 'directive: dirText.value']) /* R173-2：角色与一次性提示词必须真的进 build 消息 */
    && !/polygon|clip-path|梯形|带宽|pyramid/i.test(m) && !/polygon|clip-path|梯形|pyramid/i.test(RV());
});
check('R172-17 ★AI 只续写「洞察 / 建议」且数字回查：prompt 明令不许改动数字、投料给「可用数字」白名单与"已定稿"标注，输出越界即整段弃用留本地版（结论与论据不由模型改写）', () => {
  const rv = RV(), sc = codeOnly(read('/shared/ai/scenarios.ts')), m = RVM();
  return sc.includes('reviewNarrateSystem') && sc.includes('**不许新增、删改或换算任何数字**') && sc.includes('不得出现"维持当前节奏"')
    && has(rv, ['【可用数字（只能用这些，不许新增或改动）】', '【结论（已定稿，不要改写）】', 'if (numbersOutside(joined, rep.facts)) return null', 'catch { return null }'])
    && m.includes("if (!out) { narrate.value = 'idle'; return }") && m.includes('未配置 AI');
});
check('R172-18 ★建议与结论同源：偏斜 ⇒ 必插「收敛到主攻方向」（规则已命中也插在最前），未偏斜且零命中才给「保持节奏」——杜绝"结论说方向问题、建议维持现状"的自相矛盾', () => {
  const rv = RV();
  return has(rv, ["if (skew && !sugs.some(s => s.id === 'skew')) sugs.unshift(SKEW_SUG)", 'sugs.push(skew ? SKEW_SUG : STEADY_SUG)',
    'const STEADY_SUG', "id: 'skew', title: '收敛到主攻方向'"]);
});
check('R172-19 ★启动零 AI + 打开零写入（T11 两条红线）：ReviewPanel 对 `shared/ai/review` 只有 `import type`，实现在点击函数里 dynamic import，弹框 defineAsyncComponent + v-if；报告出口的运行时 AI 代码全走宿主 dynamic import。★另钉一条活性坑：弹框 watch(open) 必须 immediate —— 异步组件挂载时 open 已是 true，不 immediate 则 AI 执笔与 F27 运行态整条路径静默失效（探针 A8 抓到）', () => {
  const rp = codeOnly(read('/newtab/components/dashboard/ReviewPanel.vue'));
  const gs = codeOnly(read('/newtab/composables/useDashboardReport.ts'));
  return !/^\s*import \{[^}]*\} from '@\/shared\/ai\//m.test(rp)
    && rp.includes("import type { ReviewReport, ReviewSug } from '@/shared/ai/review'")
    && rp.includes("const ReviewReportModal = defineAsyncComponent(() => import('./ReviewReportModal.vue'))")
    && rp.includes('v-if="repOpen"') && read('/newtab/components/dashboard/ReviewReportModal.vue').includes('immediate: true') && rp.includes("await import('@/shared/ai/review')")
    && has(gs, ["import('@/shared/ai/reports')", "import('@/shared/ai/review')", 'import type { ReviewReport'])
    && !/^\s*import \{[^}]*\} from '@\/shared\/ai\//m.test(gs);
});
check('R172-20 ★F31/F32 采纳出口是真的：落卡登记进全局撤销栈（撤销=软删，不越"删除一律软删"红线）；「生成任务」走页面内 bus 预填快速采集（同文档自发消息收不到 ⇒ 不能复用 chrome.runtime 那条路），保存键仍在用户手里', () => {
  const rp = codeOnly(read('/shared/ai/reports.ts')), gs = codeOnly(read('/newtab/composables/useDashboardReport.ts'));
  const gp = codeOnly(read('/newtab/App.vue')), pop = codeOnly(read('/newtab/components/GlobalPopups.vue')), bus = codeOnly(read('/shared/utils/bus.ts'));
  return has(rp, ["import { pushUndo } from '@/shared/utils/undo'", 'deletedAt: Date.now()', 'Ctrl/Cmd+Z 可撤销', 'd.resources[i] = { ...card, deletedAt'])
    && bus.includes('export function emitOpenPanel') && bus.includes('prefill?: { title?: string; description?: string }')
    && gp.includes('onOpenPanel((p) => gpOpen(p.name, p.prefill))')
    && gs.includes("emitOpenPanel({ name: 'taskcapture', prefill:")
    && pop.includes("tcForm.title = prefill?.title || ''") && pop.includes('tcSaved.value = false');
});

check('R172-21 ★F39 导出三件套：ExportMenu 三项（CSV / Markdown / PNG）且 v-if 不开即零节点、菜单右锚定不越视口右缘；复盘段与热力图段两处都挂上；PNG 走 canvas 自绘并现取当前主题令牌（不引 html2canvas：体积 + foreignObject 不吃外部样式表必然丢色）；CSV 出口全站并轨（抽屉那份不再自己 createObjectURL / 手写 BOM）', () => { const ex = codeOnly(read('/newtab/components/dashboard/ExportMenu.vue')); const css = read('/newtab/components/dashboard/dashboard.css'); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); const hm = read('/newtab/components/dashboard/Heatmap.vue'); const dl = codeOnly(read('/newtab/components/dashboard/DashboardLogDrawer.vue')); const ev = codeOnly(read('/shared/utils/exportView.ts')); return has(ex, ["pick('csv')", "pick('md')", "pick('png')", 'v-if="open"']) && css.includes('.dz-exp {') && css.includes('right: 0') && css.includes('repeat(12, minmax(0, 1fr))') /* R173-4：一行 12 月块 */ && css.includes('@media (max-width: 1279px) { .dz-wk { display: none; } }') /* R173-4b 带备案：星期行 7×9px 汉字 + 6×2px 缝 = 75px，月块窄于 75px 时每块横向溢出（1100 档实测 +15px）；1280 档月块 75.5px 是实测最小装得下的档 ⇒ 以下隐去（该档格子只剩 8px，日期仍在 tooltip 里） */ && has(rp, ['<ExportMenu @pick="onExport" />', 'tablesToCsv', 'sectionsToMd', 'pngBlobFromSpec']) && has(hm, ['<ExportMenu @pick="onExport" />', 'pngBlobFromSpec', 'tablesToCsv']) && dl.includes('tablesToCsv') && !dl.includes('URL.createObjectURL') && has(ev, ['getComputedStyle(document.documentElement)', "'--heat-5'", 'toBlob']); });
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
    && rb.includes('function restoreArg') && rb.includes("purgeWith('论证卡'") && rb.includes("'🧭 论证卡'")
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
