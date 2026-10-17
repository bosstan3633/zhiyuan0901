/**
 * R174-1 分片 · 99-recent：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, srcFileEntries, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
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
check('R168-2 ★台面零"常驻浮层"（V3.7.0 重指：镜像两弹窗随资源台退役，九副 → 七副；★R4-Db 再重指带备案：七副 → 六副，减的那一副是书签「文件夹勾选」弹窗——它随整条够不着的建树死链删除，**不是**把某副常驻浮层改成了 v-if，本条守的语义反而更硬：openConds 少一项、计数判据同步下调，且加一条负判据要求那副弹窗与它的开关都不许回流；★V3.8.18（N8）再加一副：镜像选台弹窗 mirrorOpen，六副 → 七副。★加的是「第七副」而不是「把某副改回常驻」——本条守的语义没变：它同样走 v-if，不开就不在 DOM；顺手把 mirrorOpen 也塞进 openConds 负锚，谁把它改成 v-show 或 transform 冒充关掉就红）：Workspace 的浮层（详情抽屉 + 6 个 modal）一律 v-if——真库实测抽屉开着与否都在 DOM 里（168 节点含 88 个 option），而它是每次进台面都摊的固定成本；不得再用 transform 移出视口冒充"关掉"（R169 重指：抽屉进出场/Esc/遮罩随两代容器合并进 Drawer 壳单源，壳内 v-if="open" 点开才挂）', () => {
  const w = read('/newtab/views/Workspace.vue'); const css = read('/newtab/views/workspace.css'); const d = read('/shared/components/Drawer.vue')
  const openConds = ['importModalOpen', 'moveModalOpen', 'moveOneOpen', 'catModal.open', 'inputModal.open', 'mirrorOpen']
  const stillMounted = openConds.filter(k => w.includes(`class="modal-overlay" :class="{open: ${k}`))
  return stillMounted.length === 0 && (w.match(/class="modal-overlay open"/g) || []).length === 7 && !w.includes('bookmarkModalOpen')
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
check('R169-5 ★三槽口径单一真源在 link.ts：槽序/文案/占位符一份（LINK_SLOT_TABS + linkPlaceholderFor），两处采集/详情表单共用 ★R4-Fb 随迁：第三处原锚在 popup/App.vue，那个独立弹窗从未进过构建、已随降级路径一起撤，这一格换成 ResourceEditForm（详情抽屉里的表单）；两处采集表单不再各写一份 linkType 三元分支（各写一份 ⇒ 加第四种槽时必有一处漏）', () => {
  const l = codeOnly(read('/shared/utils/link.ts')); const gp = read('/newtab/components/GlobalPopups.vue'); const rf = read('/newtab/components/ResourceEditForm.vue')
  return l.includes('export const LINK_SLOT_TABS') && l.includes('export function linkPlaceholderFor')
    && l.includes('export function slotLinkOf') && l.includes('export function switchLinkSlot') && l.includes('export function setLinkSlot')
    && gp.includes('linkPlaceholderFor(capForm.linkType)') && !/capForm\.linkType === 'url'\) return/.test(gp)
    && rf.includes('linkPlaceholderFor(') && !rf.includes("=== 'url' ? 'https://…'")
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
check('R169-14 ★R2-②→★P5 重指带备案（2026-10-16）：原「项目调度卡双栏退役 → 承接者=槽内 tc-subs 视口」的两跳重指，第二跳随 P5 一并退役——子任务现在由 P4 全貌单行唯一承接（FocusDetail：前 3 条 visibleSubs + 溢出 +N + 单击勾选），本条改钉「卡内视口零残留 + 落库链仍在」', () => {
  const h = read('/newtab/views/CompassHome.vue'); const c = codeOnly(h)
  return !c.includes('class="tc-subs"') && !c.includes('function onSubScroll')      /* 视口本体与滚动监听已删（codeOnly 剥退役注释） */
    && h.includes('function toggleSlotSub') && h.includes("doneAt: !s.done ? Date.now() : undefined") /* 落库链保留：FocusDetail 单行 @toggle-sub 仍走这条（P4-1） */
    && h.includes('@toggle-sub=')                                                    /* 宿主接线在位 */
    && !h.includes('spot-dual')
});
check('R169-15 ★R2-② 重指带备案（2026-10-16 P5 翻转）：原「槽内视口只勾选/进详情、零输入控件」随视口退役改钉「FocusDetail 单行零输入 + 溢出 +N + openCellTask 进详情仍在」', () => {
  const h = read('/newtab/views/CompassHome.vue'); const c = codeOnly(h)
  const fd = read('/newtab/components/compass/FocusDetail.vue')
  const i0 = fd.indexOf('visibleSubs'), i1 = fd.indexOf('onSplit')
  const seg = i0 >= 0 && i1 > i0 ? fd.slice(i0, i1) : ''
  return i0 > 0 && i1 > i0 && !/<input|<textarea/.test(seg)                        /* 单行子任务区零输入控件（勾选由 span @click 承担） */
    && fd.includes('const VISIBLE_MAX = 3') && fd.includes('+{{ overflow }}')        /* 前 3 条 + 溢出 +N 结构在位 */
    && !c.includes('class="tc-subs"') && !c.includes('tc-sub-more')                 /* 旧视口与溢出行零残留 */
    && h.includes('openCellTask')
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
check('R169-26 老账④ 脚本归档白名单：scripts/ 根目录只允许 20 个登记脚本（门禁/量具/生成器）；一次性探针 9 个已归档 scripts/archive/（R164 提案 E4：门禁清单只列活的）——根目录出现未登记文件即红 ★R174-1 备案：regression/ 分片目录（helpers + 时代分片，见 R164-2 行数门禁）随分片落地加入白名单；★R4-Ea 备案：browser.cjs 是七个门禁脚本共用的浏览器解析实现，属门禁基建不是探针；★G4/G6(V3.8.27)：a11y-tab-audit.cjs（键盘可达审计）与 install-hooks.cjs（pre-commit 安装器）登记入册', () => {
  const ALLOW = ['a11y-tab-audit.cjs', 'install-hooks.cjs', 'browser.cjs', 'check-cycles.cjs', 'dead-css-scan.cjs', 'e2e.cjs', 'entry-literals.cjs', 'entry-matrix.cjs', 'gen-code-index.cjs', 'gen-pinyin-table.cjs', 'img-diff.cjs', 'pack.cjs', 'perf-census.cjs', 'perf.cjs', 'probe-f.cjs', 'regression-eb.cjs', 'regression.cjs', 'test-import-compat.cjs', 'theme-audit.cjs', 'theme-contrast.cjs', '.gate-cache.json'];
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
check('R174-4 概览带 ★W10 退役重指带备案：概览带（DashboardOverview + dz-sec-ov 专段版式）随 W10 时间轴三段式重构整体退役——D1 拍板砍假六维、Hero KPI 卡承接存量摘要职责；判据转退役三条腿：① DashboardOverview.vue 文件不存在（删干净的凭据）② 新宿主 PiHero 底盘卡在位（★W13-D1 再随迁 2026-10-16：原 5 枚 pi-hchip 改 4 枚 .hero-kpi total/entropy/support/focus，时间三指标迁 PiYear）③ 宿主 import pi-timeline.css 且不再 import DashboardOverview', () => {
  const fsx = require('fs');
  const gone = !fsx.existsSync(path.resolve(base, 'newtab/components/dashboard/DashboardOverview.vue'));
  const hero = read('/newtab/components/profile/PiHero.vue');
  const pi = read('/newtab/views/ProfileInsights.vue');
  return gone
    && (hero.match(/class="hero-kpi"/g) || []).length === 4
    && hero.includes("emit('drill', 'total')") && hero.includes("emit('drill', 'entropy')")
    && hero.includes("emit('drill', 'support')") && hero.includes("emit('drill', 'focus')")
    && pi.includes("import '@/newtab/components/profile/pi-timeline.css'")
    && !codeOnly(pi).includes('DashboardOverview');
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
  return dc.includes('<Icon name="stethoscope"') && dc.includes('数据体检') && dc.includes('refreshThesisScan') && dc.includes('fixThesisDuplicates')
    && dc.includes("countThesisDuplicates(store.data!)") && dc.includes('onMounted(refreshThesisScan)')
    && gs.includes('<DataCheckupCard v-if="activePage === \'export\'" />');
});

check('R171-4 ★命令面板「快速开关」组（04-63「全部开关收进去」收口；★W3 随迁：常用内容 Tab 内快速开关索引基=近期最常用+快捷操作）：GlobalPopups 出 PALETTE_TOGGLES（暗色主题/紧凑密度/已完成项目/备份提醒，computed 行内明示当前态）、模板渲染序同步插组、runFlat/runFlatLocator 两键位都认 tgl；store.ui 手改与 saveUIPrefs 双写（R170 uiCache/store.ui 两份引用教训）', () => {
  const gp = read('/newtab/components/GlobalPopups.vue');
  return gp.includes('PALETTE_TOGGLES') && gp.includes("kind: 'tgl'") && gp.includes("it.kind === 'tgl'")
    && gp.includes('recentResources.length+QUICK_ACTIONS.length+i') && gp.includes('if (store.ui) (store.ui as')
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
  const pi = read('/newtab/views/ProfileInsights.vue');
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
    /* ★W9 退役重指带备案：「调出」标签与 call 动作筛选的宿主随全量记录抽屉迁画像洞察页；
       抽屉侧（lg）与宿主侧（pi）两侧各守一半，GS 加 codeOnly 零命中负锚 */
    && pi.includes('openLogFocus()') /* ★W13-T7 再随迁带备案 2026-10-16：宿主侧「↗ 调出」标签与 action==='call' 筛选随
       eventActionLabel/dynDrawer 退役——call 动作筛选的唯一宿主就是 DashboardLogDrawer（lg 已钉），宿主侧入口等价性
       改钉 openLogFocus()（主攻动作明细预设经抽屉三维筛选呈现调出事件） */
&& pi.includes("openStatDrawer('today-call')") /* ★W15-T1 2026-10-16 改钉：调出入口改卡片清单 */
    && pi.includes("openLog('log')") /* 写入记录（全量流水）入口仍在页头，能力未减 */
    && !codeOnly(read('/newtab/views/GlobalSettings.vue')).includes("action === 'call'");
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

check('R172-5 ★W10 退役重指带备案：概览带 UI（DashboardOverview 5 存量 chip + dz-ov-say + bind 高亮）随时间轴三段式整体退役——能力拆解为：① 存量摘要移交 PiHero（★W13-D1 再随迁带备案 2026-10-16：原 total/streak/active/entropy/longest 5 枚 chip 改 4 枚底盘卡 total/entropy/support/focus——streak/active/longest 三枚时间指标不再留在 Hero，迁 PiYear 年度段，消除全页重复）② 窗口聚合移交 PiRhythm（aggregateRange + 等长窗口 prevWindow/pct）③ W_ROWS 口径表单一真源留 dailyStats.ts ④ 数据桥 useDashboardStats 三锚不变（buildDailyStats 重建 + 快照合并 + selDay 态）⑤ GS 零命中负锚不变', () => {
  const fsx = require('fs');
  const gone = !fsx.existsSync(path.resolve(base, 'newtab/components/dashboard/DashboardOverview.vue'));
  const hero = read('/newtab/components/profile/PiHero.vue');
  const rh = read('/newtab/components/profile/PiRhythm.vue');
  const rr = read('/shared/utils/reviewReport.ts');
  const ds = read('/shared/utils/dailyStats.ts');
  const pi = read('/newtab/views/ProfileInsights.vue');
  const ud = read('/newtab/components/dashboard/useDashboardStats.ts');
  return gone
    && hero.includes("emit('drill', 'total')") && hero.includes("emit('drill', 'entropy')")
    && hero.includes("emit('drill', 'support')") && hero.includes("emit('drill', 'focus')")
    && rh.includes('aggregateRange(') && rh.includes('prevWindow(') && rh.includes('pct(')
    && ds.includes('export const W_ROWS')
    && rr.includes('export function stockBoundTo(') && ds.includes('export function aggregateRange(')
    && ud.includes('buildDailyStats(data(), ev)') && ud.includes('mergeDailyStats(snapRef.value, rebuilt, boundaryDayOf(ev))') && ud.includes('const selDay = ref<string | null>(null)')
    && pi.includes("from '@/newtab/components/dashboard/useDashboardStats'")
    && pi.includes('const dashStats = dash.stats')
    && !codeOnly(read('/newtab/views/GlobalSettings.vue')).includes('useDashboardStats');
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
check('R172-7 ★T6 日详情（04-67 F12~F17 · ★W6 #1 重指带备案：日详情完全按原型裁剪——四列下钻/库容变化条/hintline 整体退役，分析入口收敛到复盘段；分组逻辑仍在 drillRows.ts 单一实现且 ReviewPanel 消费 · ★W6.1 再随迁带备案：四格统计可点击下钻把 DrillCardList/groupEventRows 加回日详情，两条负锚转正锚；退役的是库容变化条与四列下钻容器）：日详情原型结构（头部图标+标题+日期 / 摘要 / 四格统计 dz-stats ≥4 / 热力带 dz-heat-band / 降序时间线 / 查看全部记录 ›）', () => {
  const d = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'));
  const dr = read('/shared/utils/drillRows.ts');
  const rp = read('/newtab/components/dashboard/ReviewPanel.vue');
  return dr.includes('export function groupEventRows(') && dr.includes('cur.row.n++') && dr.includes('x.row.time = hm(x.t1)')
    && rp.includes('groupEventRows(') && rp.includes("from '@/shared/utils/drillRows'") /* ★随迁：下钻消费方改认复盘段 */
    && d.includes('今日战报') && d.includes('dz-day-ic') && d.includes('dz-day-title')
    && d.includes('dz-stats') && d.includes('dz-heat-band')
    && d.includes("emit('open-log', day)") && d.includes('查看全部记录')
    && d.includes('EVENT_ACT_LABEL[e.action]')
    /* ★W6.1 随迁：日详情复用同一分组实现，故 groupEventRows 由负锚转正锚（锚调用处 groupEventRows(filtered） */
    && d.includes('groupEventRows(filtered') && d.includes('<DrillCardList v-if="drillRows"')
    && !d.includes('dz-mcol') && !d.includes('deltaOf(') && !d.includes('stockAt(')
    && !d.includes('该日库容变化');
});
check('R172-8 ★T6 共用下钻卡片列表（04-66 §6.2 组件复用 · ★W6 #1 随迁 + ★W6.1 再随迁带备案：日详情不再挂 DrillCardList——消费方改认复盘段 ReviewPanel；W6.1 用户拍板四格统计可下钻后**两处消费方并存**，故原「日详情不得 import」那条负锚改为「两处都 import」的正锚，组件仍是单一实现）：单一实现（DrillCardList.vue），单击=定位并高亮（locateTargetOf）、双击=直达链接/打开文件（openExternalLink）+「N 类卡片 · 共 M 条记录（同卡多次已合并 ×N）」表头', () => {
  const c = read('/newtab/components/dashboard/DrillCardList.vue');
  const rp = read('/newtab/components/dashboard/ReviewPanel.vue');
  const d = codeOnly(read('/newtab/components/dashboard/DayDetail.vue'));
  return c.includes('locateTargetOf(') && c.includes('asLocateKind(') && c.includes('openExternalLink(')
    && c.includes('@click="pick(r)"') && c.includes('@dblclick="open(r)"')
    && c.includes('同卡多次已合并 ×N') && c.includes('dz-row-n')
    && rp.includes("import DrillCardList from './DrillCardList.vue'")
    /* ★W6.1：两处消费方都认这一个组件——全站 import DrillCardList 只允许这两处，杜绝第二套实现 */
    && d.includes("import DrillCardList from './DrillCardList.vue'")
    && (srcFileEntries().filter(e => codeOnly(e.text).includes("import DrillCardList from './DrillCardList.vue'")).length === 2);
});
check('R172-9 ★W10 退役重指带备案：「只吃 stats prop 不扫 store」性能红线随概览带退役移交时间轴模块——PiToday/PiRhythm/PiMonth/PiYear 四组件零 useAppStore/零扫 store.data/零扫 resources（props-only），聚合全在宿主算好再传 + zy_daily_stats 走前缀和（stockAt 只累加 days）不变。★V3.8.20：PiMonth 新增后纳入同一红线（轻量月度段同款性能契约）', () => {
  const today = read('/newtab/components/profile/PiToday.vue');
  const rhythm = read('/newtab/components/profile/PiRhythm.vue');
  const month = read('/newtab/components/profile/PiMonth.vue');
  const year = read('/newtab/components/profile/PiYear.vue');
  const ds = read('/shared/utils/dailyStats.ts');
  const propsOnly = (t) => !t.includes('useAppStore') && !t.includes('store.data') && !t.includes('resources');
  return propsOnly(today) && propsOnly(rhythm) && propsOnly(month) && propsOnly(year)
    && rhythm.includes('defineProps') && rhythm.includes('stats')
    && month.includes('defineProps') && month.includes('stats')
    && year.includes('defineProps') && year.includes('stats')
    && ds.includes('export function stockAt(')
    && /for \(const k of Object\.keys\(stats\.days\)\.sort\(\)/.test(ds);
});

/* ================= R172 · 知源仪表盘 R3 第 3 轮：复盘段 + 记录抽屉 + 入口整合 ================= */

check('R172-10 ★T7 复盘段（04-67 F21~F26）：紧凑两栏（`.dz-rev-grid` 实测 2 列）+ 四范围（周/月/自定义/项目）+ 粒度自适应（week→day / month→week / >120 天→month）+ 6 KPI 可下钻（复用同一 `DrillCardList`）+ 目标对账条形可下钻（`objectivesOf`/`tasksOfDirection` 真实多跳接线）+ 规则下钻给出阈值与实际值（`runRules` 同处产出 thr/act）+ 纯读取零写入（不碰 store）', () => {
  const rp = read('/newtab/components/dashboard/ReviewPanel.vue');
  const css = fs.readFileSync(path.resolve(base, 'newtab', 'components', 'dashboard', 'dashboard.css'), 'utf8');
  const rr = read('/shared/utils/reviewReport.ts');
  const pi = read('/newtab/views/ProfileInsights.vue');
  return css.includes('.dz-rev-grid { display: grid; grid-template-columns: 1fr 1fr;')
    && rp.includes('buildReview(') && rp.includes("pickRange('week')") && rp.includes("pickRange('month')")
    && rp.includes("pickRange('custom')") && rp.includes("pickRange('project')")
    && rp.includes('trendMode') && rp.includes('days > 120')
    && rp.includes("import DrillCardList from './DrillCardList.vue'") && rp.includes('objectivesOf(') && rp.includes('tasksOfDirection(')
    && rp.includes('ruleHit') && rp.includes('ruleHit.thr') && rp.includes('ruleHit.act')
    && rr.includes('thr: string; act: string')
    /* ★W9 退役重指带备案：复盘段宿主由 GlobalSettings 改指 ProfileInsights，props 接线照搬；
       GS 加 codeOnly 零命中负锚（dashDirections / dashTasks 不许回流） */
    /* ★W13-D5 再随迁带备案 2026-10-16 用户拍板：复盘能力四段常驻化 ⇒ ReviewPanel 随整页复盘弹窗
       下线（组件文件保留待复用，宿主零挂载零 import）——正锚改钉退役负锚（宿主 codeOnly 零 <ReviewPanel>；
       注意 :directions="dashDirections" 不许当负锚——它是 LifecyclePanel 的现役接线，T6 起在位），
       复盘引擎（rp/rr/css）与 GS 负锚一字未动 */
    && !codeOnly(pi).includes('<ReviewPanel')
    && pi.includes('★W13-D5') /* 退役备案带必须写明去向，防"删了不解释" */
    && !codeOnly(read('/newtab/views/GlobalSettings.vue')).includes('dashDirections')
    && !rp.includes('useAppStore') && !rp.includes('store.persist');
});

check('R172-11 ★T8 全量记录抽屉（04-67 F18~F20）：三维筛选（类型 × 动作 × 时间）均生效 + 动作下拉**必须含「调出」**（旧设置页缺这一项）+ CSV 导出对象 = **当前筛选结果**（非全量）+ 容量提示与 `EVENT_LOG_CAP` 同源 + 四类记录入口承接（今日入台/移出/调出/写入记录）', () => {
  const d = read('/newtab/components/dashboard/DashboardLogDrawer.vue');
  const pi = read('/newtab/views/ProfileInsights.vue');
  return d.includes('v-model="kind"') && d.includes('v-model="action"') && d.includes('v-model="from"') && d.includes('v-model="to"')
    && d.includes('<option value="call">调出</option>')
    && d.includes('rows: filtered.value.map(e =>')
    && d.includes('EVENT_LOG_CAP') && d.includes('日志容量')
    /* ★W9 退役重指带备案：四类记录入口 + :preset/:open 接线随仪表盘迁 ProfileInsights，
       四个 openLog 调用点与两枚 prop 绑定一字未减；GS 加 codeOnly 零命中负锚 */
    && pi.includes("openStatDrawer('today-in')") && pi.includes("openStatDrawer('today-call')")
    && pi.includes("openLog('out')") && pi.includes("openLog('log')")
    /* ★W15-T1 2026-10-16 再随迁备案：入台/调出两枚由事件流水预设改卡片清单分支；
       移出与写入记录两枚仍走事件抽屉 —— 四类入口一项未减，抽屉三维筛选与 CSV 能力一字未动 */
    && pi.includes(':preset="logPreset"') && pi.includes(':open="logOpen"')
    && !codeOnly(read('/newtab/views/GlobalSettings.vue')).includes('openLog(');
});

check('R172-12 ★T9 调度台入口整合（04-67 F33~F36）：删 5 个旧入口（`.rec-mini` 四格 / 今日记录抽屉 / `wrOpen` / `onWrDrill` / 周报浮层）—— CompassHome 零残留；`MetricBar.vue` 中段 5 指标零改动（Q8）；被删的四类记录能力在画像洞察页内等价可用。★W12-D 退役重指带备案：右槽那一枚由「📈 复盘 · 跳 /profile」改为「📈 今日战报 · 就地开弹窗」—— 热力图退役后调度台仍需今天的全貌入口，跳去画像洞察页等于离开手边的三件事去看另一个尺度（用户 2026-10-13 拍板）。原「被删的四类记录能力在画像洞察页等价可用」这句随 W12-B 进一步收紧为「全页唯一入口在画像洞察页页头」；日详情「查看全部记录」的宿主第三次随迁到 TodayBattleHost', () => {
  const h = read('/newtab/views/CompassHome.vue');
  const mb = read('/newtab/components/compass/MetricBar.vue');
  const gs = read('/newtab/views/GlobalSettings.vue');
  const pi = read('/newtab/views/ProfileInsights.vue');
  const tbh = read('/newtab/components/dashboard/TodayBattleHost.vue');
  const fsx = require('fs');
  return !h.includes('rec-mini') && !h.includes('openRec(') && !h.includes('recOpen') && !h.includes('wrOpen')
    && !h.includes('onWrDrill') && !h.includes('📊 周报')
    && h.includes('📈 今日战报') && !h.includes("router.push('/profile')")
    && !fsx.existsSync(path.resolve(base, 'newtab', 'components', 'WeeklyReportOverlay.vue'))
    && !fsx.existsSync(path.resolve(base, 'shared', 'utils', 'weeklyReport.ts'))
    && mb.includes('战略目标') && mb.includes('未归档') && mb.includes('mb-right')
    && pi.includes("openStatDrawer('today-call')") /* ★W15-T1 2026-10-16 改钉：调出格落点卡片清单 */
    && pi.includes("openLog('log')") /* 全量流水入口仍在页头唯一一处 */
    && !gs.includes('onDashOpenLog')
    && !codeOnly(gs).includes('openLog(')
    && tbh.includes('onOpenLog') && tbh.includes('logOpen') && tbh.includes(':preset="logPreset"');
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

check('R172-21 ★F39 导出：ExportMenu 四项可配（CSV / Markdown / PNG / HTML，formats prop 决定开哪几项）且 v-if 不开即零节点、菜单右锚定不越视口右缘；复盘段仍是 CSV/MD/PNG 三件套、热力图段收为 PNG/HTML 两项（★W2 重指带备案：热力图逐日 CSV/年度 MD 随迁取消，新增自包含 HTML 分享页）；PNG 走 canvas 自绘并现取当前主题令牌（不引 html2canvas：体积 + foreignObject 不吃外部样式表必然丢色）；CSV 出口全站并轨（抽屉那份不再自己 createObjectURL / 手写 BOM）', () => { const ex = codeOnly(read('/newtab/components/dashboard/ExportMenu.vue')); const css = read('/newtab/components/dashboard/dashboard.css'); const rp = read('/newtab/components/dashboard/ReviewPanel.vue'); const hm = read('/newtab/components/dashboard/Heatmap.vue'); const dl = codeOnly(read('/newtab/components/dashboard/DashboardLogDrawer.vue')); const ev = codeOnly(read('/shared/utils/exportView.ts')); return has(ex, ["pick('csv')", "pick('md')", "pick('png')", "pick('html')", 'v-if="open"', "formats"]) && css.includes('.dz-exp {') && css.includes('right: 0') && css.includes('repeat(12, minmax(0, 1fr))') /* R173-4：一行 12 月块 */ && css.includes('@media (max-width: 1279px) { .dz-wk { display: none; } }') /* R173-4b 带备案：星期行 7×9px 汉字 + 6×2px 缝 = 75px，月块窄于 75px 时每块横向溢出（1100 档实测 +15px）；1280 档月块 75.5px 是实测最小装得下的档 ⇒ 以下隐去（该档格子只剩 8px，日期仍在 tooltip 里） */ && has(rp, ['<ExportMenu @pick="onExport" />', 'tablesToCsv', 'sectionsToMd', 'pngBlobFromSpec']) && has(hm, ['<ExportMenu :formats="[\'png\', \'html\']" @pick="onExport" />', 'pngBlobFromSpec', 'heatmapShareHtml', 'exportHtml']) && !hm.includes('tablesToCsv') && dl.includes('tablesToCsv') && !dl.includes('URL.createObjectURL') && has(ev, ['getComputedStyle(document.documentElement)', "'--heat-5'", 'toBlob', 'heatmapShareHtml']); });
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
check('W2-1 ★W12-D 退役重指带备案：热力图从调度台退役后，「那个槽位」与「读日志只在宿主做」两条纪律都还在，只是宿主换了。年度热力图由画像洞察页全量覆盖，用户 2026-10-13 拍板调度台这份退役；槽位改成「全貌」模块（今日三件事选中项详情）。判据：① CompassHome 挂 TodayBattleHost（今日战报自包含宿主）且无 HeatmapModule ② 槽位顺序仍在「今日三件事之后、三卡之前」（原 HeatmapModule 的位置锚点）③ CompassHome 源码内仍无 readEventLog（R49-3：读日志的活只在宿主组件做）④ 全貌模块 FocusDetail 存在且挂在该槽位', () => {
  const ch = read('/newtab/views/CompassHome.vue');
  const iH = ch.indexOf('<TodayBattleHost ref="battleHost" />');
  const iF = ch.indexOf('focusAllDone');
  const iC = ch.indexOf('id="zy-mod-curiosity"');
  const iFocus = ch.indexOf('<FocusDetail');
  return ch.includes("import TodayBattleHost from '../components/dashboard/TodayBattleHost.vue'")
    && !ch.includes('HeatmapModule')
    && iH > 0 && iF > 0 && iC > 0
    && iH > iF && iH < iC
    && ch.includes("import FocusDetail from '../components/compass/FocusDetail.vue'")
    && iFocus > iF && iFocus < iC
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
