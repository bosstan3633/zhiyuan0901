/**
 * V4.2.0 · 详情面板与 Inbox 转化契约。
 *
 * 由 99-recent.cjs 原样搬出，避免单分片超过 R164-2 的 900 行上限。
 * 断言只搬家，不删除、不放宽。
 */
const { fs, base, check, read, codeOnly, exists } = require('./helpers.cjs')

console.log('【R167 · 两卡详情 OPPO 质感重排 / AI 入口共享化 / 弹窗下半部主导】');
check('R167-1（V4.1.3 重指）★分组面板体系是真源不是各写各的：detail-sheet.css 的 ds-* 七件套在位，资源详情三块面板，好奇详情收为三块（资源支撑随关系白名单退役），焦点面板整块撑高', () => {
  const css = read('/shared/styles/detail-sheet.css')
  const f = read('/newtab/components/ResourceEditForm.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue')
  const curioPanels = c.match(/class="ds-pnl( hero)?"/g) || []
  return ['.ds-pnl', '.ds-pnl-h', '.ds-kv', '.ds-ai-strip', '.ds-hero-note', '.ds-h1', '.ds-kicker'].every(k => css.includes(k))
    && css.includes('.ds-pnl.hero') && /min-height:\s*34vh/.test(css)
    && (f.match(/class="ds-pnl( hero)?"/g) || []).length === 3
    && curioPanels.length === 3
    && curioPanels.filter(x => x === 'class="ds-pnl"').length === 2
    && curioPanels.filter(x => x === 'class="ds-pnl hero"').length === 1
    && c.includes('<b>来源与标签</b>')
    && !c.includes('<b>资源支撑</b>')
    && c.includes('<b>流转与凭证</b>')
    && (c.match(/<b>问题原文<\/b>/g) || []).length === 1
    && f.includes('class="ds-hero-note"') && c.includes('class="ds-hero-note"')
});
check('R167-2 ★资源详情 AI 入口全站只有一处实现：ResourceAiStrip 被两宿主同时挂载，而两宿主本体（Workspace.vue 自身与 RDD）零 AI 接线（不出现 shared/ai 路径，也不出现评审抽屉）。"并入口时只改一个宿主"正是 R165-A 被绕过的红线，这条把它变成正向门禁——新宿主想自装一枚，必须动这个组件', () => {
  const st = read('/newtab/components/ResourceAiStrip.vue'); const r = read('/newtab/components/ResourceDetailDrawer.vue')
  const w = read('/newtab/views/Workspace.vue')
  const wsx = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8').replace(/\r\n/g, '\n')
  return r.includes('<ResourceAiStrip') && w.includes('<ResourceAiStrip')
    && !r.includes('/shared/ai/') && !r.includes('AiEntryButton') && !wsx.includes('/shared/ai/') && !wsx.includes('AiEntryButton')
    && st.includes("import('@/shared/ai/config')") && !st.includes('buildResourceLinkTaskJob') && st.includes('buildResourceEnrichJob(card, ctx)')
    && (st.match(/class="ds-ai-cell"/g) || []).length === 1 && st.includes('if (busy.value) return') && st.includes('props.onAdopted?.()')
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
check('R167-5（V4.2.0 退役重指）★转化即离场的数据口径：好奇心不再转化；Inbox 三型转化在目标卡写入 sourceCaptureId，本机列表立即移除，云端采集补写 converted_at / converted_kind / converted_card_id；失败进本地补写队列，后续刷新重试', () => {
  const md = read('/shared/models/index.ts')
  const cp = codeOnly(read('/newtab/stores/curiosity.ts'))
  const inbox = read('/newtab/composables/useInbox.ts')
  const client = read('/shared/cloud/client.ts')
  return !cp.includes('convertedAt') && !cp.includes('convertedTo')
    && md.includes('sourceCaptureId?: string')
    && inbox.includes('sourceCaptureId: item.id')
    && inbox.includes('items.value = items.value.filter(row => row.id !== item.id)')
    && inbox.includes('enqueueConversion(')
    && inbox.includes('await retryPendingConversions()')
    && client.includes('converted_at: new Date().toISOString()')
    && client.includes('converted_kind: convertedKind')
    && client.includes('converted_card_id: convertedCardId')
});
check('R167-6（V4.1.3 退役重指）资源侧反向“关联任务”整体退役：不再存在 buildResourceLinkTaskJob / 资源详情入口；任务→资源仍由任务侧 taskSupport 发起并只写独立关系记录，资源卡不出现反向关联按钮', () => {
  const ts = read('/shared/ai/taskSupport.ts')
  const st = codeOnly(read('/newtab/components/ResourceAiStrip.vue'))
  return !exists('/shared/ai/resourceLinkTask.ts')
    && ts.includes('addSupportLink(') && ts.includes("adoptLabel: '✓ 关联为支持'")
    && !st.includes('addSupportLink') && !st.includes('关联任务')
    && read('/newtab/manual-data.ts').includes('资源卡本身不提供反向关联任务入口')
});
check('R167-7 ★评审弹窗"下半部主导"：上半部压成一行头 + 三栏一次性指令条，对照区吃满剩余高度（外壳 .md-body 禁滚、由左右两栏各自滚）；分栏把手可拖（22%~70% 夹住，越界会把某一栏拖没）、拖拽靠 mousedown 上的 preventDefault 防选区**而不是给弹窗加 pointer-events:none**（那会让把手自己的 click 复位落空，原型实测踩过）；窄屏退成单列', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes('class="ai-dir"') && w.includes('class="ai-drag"') && w.includes('function startDrag') && w.includes('--split')
    && w.includes('.ai-modal :deep(.md-body)') && w.includes('overflow: hidden')
    && w.includes('Math.min(70, Math.max(22,') && w.includes('e.preventDefault()') && !w.includes('pointer-events: none')
    && /@media[^{]*\{[\s\S]{0,400}\.ai-drag \{ display: none \}/.test(w)
});
check('R167-8（V4.2.0 退役重指）★好奇心单卡研判整体退役：batchG 不再产出 curio-triage / verdict 单卡态，好奇心面板无 AI 入口与转化入口；通用评审抽屉的 verdict 能力保留给非好奇心场景，但不得被注册表声明成好奇心入口', () => {
  const bg = read('/shared/ai/batchG.ts')
  const c = codeOnly(read('/newtab/components/compass/CuriosityPanel.vue'))
  const reg = read('/shared/ai/jobs/registry.ts')
  return !bg.includes('curio-triage') && !bg.includes("layout: 'verdict'")
    && !bg.includes('判词写进详情') && !c.includes('aiTriage') && !c.includes('AiEntryButton')
    && !reg.includes('curio-triage') && !reg.includes('好奇心研判')
});
check('R167-9 ★抽屉宽度与视觉走查判据同频：两代资源详情与好奇详情一律 520px；theme-audit 的卡详情判据必须同时含「AI 格数」与「主标题处数」，并核弹窗三件套（对照区/指令条/分栏把手）——走查判据落后于版式等于白跑', () => {
  const r = read('/newtab/components/ResourceDetailDrawer.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue')
  const drawer = read('/shared/components/Drawer.vue'); const g = read('/../scripts/theme-audit.cjs')
  return r.includes('width="520px"') && c.includes('width="520px"')
    && drawer.includes("parseInt(props.width || '', 10) || 440")
    && drawer.includes('const panelStyle = computed(')
    && drawer.includes("? { width: 'min(960px, 94vw)'")
    && drawer.includes(": { width: `${w.value}px`, zIndex: drawerZ.value })")
    && drawer.includes(':style="panelStyle"')
    && drawer.includes("mode?: 'drawer' | 'modal'")
    && g.includes("h1: '.ds-h1'")
    && (g.match(/aiCount: 1/g) || []).length >= 1
    && g.includes('aiCount: 0')
    && g.includes('aiCount: 3')
    && g.includes("class=\"ai-dir\"") === false && g.includes('.ai-dir') && g.includes('.ai-drag') && g.includes('if (modalFail.length)')
    && g.includes('const wantDrag = m.width >= 1200')
});
