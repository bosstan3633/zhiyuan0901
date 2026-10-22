/**
 * V3.9.8 · 策展台成果态：单一画布、思维导图键位、拖拽与分享合同。
 *
 * 这一片不锁像素，只锁“改版后仍然成立的产品行为”：
 * - 顶部论点卡是唯一 L1 入口，点击打开专用抽屉；
 * - 金字塔 / 树状共享同一份 Category 父子树；
 * - Tab 建子级、Enter 建同级、拖拽改父级，且不超过四级；
 * - 关联资源、缺证据、镜像证据、分享 HTML 都有明确出口；
 * - 旧四视图与左侧论证目录真正退役，不靠隐藏模板假绿。
 */
const {
  check, read, codeOnly, exists,
} = require('./helpers.cjs');

const WS = read('/newtab/views/Workspace.vue');
const MAP = read('/newtab/components/curation/CurationMindMap.vue');
const NODE = read('/newtab/components/curation/CurationMindNode.vue');
const HOOK = read('/newtab/composables/useCurationMindMap.ts');
const THESIS = read('/newtab/components/curation/CurationThesisDrawer.vue');
const SHARE_UI = read('/newtab/components/curation/CurationShareDrawer.vue');
const SHARE = read('/shared/utils/curationShare.ts');
const CSS = read('/newtab/components/curation/curation.css');

console.log('【V3.9.8 · 策展台成果态与思维导图】');

check('C101-1 顶部论点卡是 L1 唯一入口：整卡可点、键盘可开、空态可创建，打开专用论点卡抽屉', () => {
  return WS.includes('class="thesis-banner"')
    && WS.includes('@click="thesisCard ? openThesisCard() : openThesisCreate()"')
    && WS.includes('@keydown.enter.prevent="thesisCard ? openThesisCard() : openThesisCreate()"')
    && WS.includes('<CurationThesisDrawer')
    && THESIS.includes('中心论点卡')
    && THESIS.includes('论点标题')
    && THESIS.includes('论点内容')
    && THESIS.includes('创建时间')
    && THESIS.includes('最近更新');
});

check('C101-2 指标条恰两格，论证深度 / 来源覆盖真正退役，且两格都可下钻', () => {
  const s = WS.indexOf('<div class="ws-metrics cur2"');
  const e = WS.indexOf('<CurationDrillDrawer', s);
  if (s < 0 || e < 0) return false;
  const block = WS.slice(s, e);
  return (block.match(/class="metric-box"/g) || []).length === 2
    && block.includes('论据卡片总数')
    && block.includes('佐证附件数量')
    && block.includes("openDrill('total')")
    && block.includes("openDrill('assets')")
    && !block.includes('论证深度')
    && !block.includes('来源覆盖')
    && !WS.includes('const pyramidDepth = computed(');
});

check('C101-3 左侧论证目录与旧四视图 / 卡片网格 / 批量栏真正退役：画布是唯一工作区', () => {
  const code = codeOnly(WS);
  return !code.includes('class="ws-columns"')
    && !code.includes('class="ws-sidebar')
    && !code.includes('class="view-tabs"')
    && !code.includes('class="card-grid"')
    && !code.includes('class="res-card-actions"')
    && !code.includes('class="rr-actions"')
    && !code.includes('class="kc-actions"')
    && !code.includes('class="batch-bar"')
    && !code.includes('论证结构目录')
    && code.includes('<CurationMindMap');
});

check('C101-4 金字塔 / 树状共享同一份 Category 父子树：切换只改渲染，不复制第二棵树', () => {
  return HOOK.includes("export type CurationCanvasLayout = 'pyramid' | 'tree'")
    && HOOK.includes('const layout = ref<CurationCanvasLayout>')
    && HOOK.includes('catIdx.value.childrenOf.get(catId)')
    && HOOK.includes('dragged.parentId = target.id')
    && MAP.includes("emit('update:layout', 'pyramid')")
    && MAP.includes("emit('update:layout', 'tree')")
    && MAP.includes(':data-layout="layout"')
    && !MAP.includes('pyramidNodes')
    && !MAP.includes('treeNodes');
});

check('C101-5 根节点键盘事件先排除内部控件：按钮 / 输入框不会误建分支；根节点 Tab / Enter 均建二级', () => {
  const body = MAP.slice(MAP.indexOf('function onRootKeydown'), MAP.indexOf('const layoutLabel'));
  return body.includes("closest('button,input,textarea,select,a,[contenteditable=\"true\"]')")
    && body.includes("e.key !== 'Tab' && e.key !== 'Enter'")
    && body.includes("emit('create-child', 'root')")
    && !MAP.includes('@keydown.tab.prevent="emit(\'create-child\', \'root\')"')
    && !MAP.includes('@keydown.enter.prevent="emit(\'create-child\', \'root\')"');
});

check('C101-6 节点键位合同：标题输入中 Tab=提交并建子级、Enter=提交并建同级；节点聚焦时同样支持；Esc 取消', () => {
  const body = NODE.slice(NODE.indexOf('function onEditKeydown'), NODE.indexOf('function onNodeKeydown'));
  const node = NODE.slice(NODE.indexOf('function onNodeKeydown'), NODE.indexOf('function onDragHandleKeydown'));
  return body.includes("if (e.key === 'Escape')")
    && body.includes("if (e.key === 'Tab')")
    && body.includes("commitEdit()")
    && body.includes("emit('create-child', props.node.id)")
    && body.includes("editingField.value === 'title'")
    && body.includes("emit('create-sibling', props.node.id)")
    && node.includes("if (e.key === 'Tab')")
    && node.includes("emit('create-child', props.node.id)")
    && node.includes("} else if (e.key === 'Enter')")
    && node.includes("emit('create-sibling', props.node.id)");
});

check('C101-7 新建 / 同级写入同一份 Category 树并立即进入标题编辑；新建同级插入当前节点之后', () => {
  return HOOK.includes('const cat: Category = {')
    && HOOK.includes('workspaceId: workspaceId.value')
    && HOOK.includes('parentId: parent?.id')
    && HOOK.includes('d.value.categories.push(cat)')
    && HOOK.includes('focusEdit(cat.id)')
    && NODE.includes('onMounted(() => {')
    && NODE.includes('nextTick(() => beginEdit(\'title\'))')
    && HOOK.includes('const idx = siblings.findIndex(c => c.id === cur.id)')
    && HOOK.includes('siblings.splice(idx >= 0 ? idx + 1 : siblings.length, 0, cat)')
    && HOOK.includes('siblings.forEach((c, i) => { c.order = i })');
});

check('C101-7b 新分支首次挂载即聚焦标题：只看 editRequestSeq 会漏掉「创建后才挂载」的节点', () => {
  const mounted = NODE.slice(NODE.indexOf('onMounted(() => {'), NODE.indexOf('</script>'));
  const seqWatch = NODE.slice(NODE.indexOf('watch(() => props.editRequestSeq'), NODE.indexOf('onMounted(() => {'));
  return mounted.includes('props.editRequestId !== props.node.id')
    && mounted.includes('beginEdit(\'title\')')
    && seqWatch.includes('props.editRequestId !== props.node.id')
    && seqWatch.includes('beginEdit(\'title\')');
});

check('C101-8 节点标题与说明就地持久化：改名去空白且查重，说明写回 Category.description 并落库', () => {
  return NODE.includes("emit('rename', props.node, value)")
    && NODE.includes("emit('update-description', props.node, value)")
    && NODE.includes('@blur="commitEdit"')
    && HOOK.includes('const name = raw.trim()')
    && HOOK.includes('已存在同名分支')
    && HOOK.includes("cat.description = description || undefined")
    && HOOK.includes('persist()');
});

check('C101-9 拖拽合同：合法落点才移动；禁止自身、后代、超四级；根节点只允许升为一级', () => {
  return HOOK.includes('function validateDrop')
    && HOOK.includes("if (dragId === targetId) return { ok: false, message: '不能移动到自身' }")
    && HOOK.includes('catIdx.value.descendants(dragId).includes(targetId)')
    && HOOK.includes('nodeLevel(target) + nodeHeight(dragged)')
    && HOOK.includes('deepest > MIND_TOTAL_LEVEL')
    && HOOK.includes("if (targetId === 'root')")
    && HOOK.includes('dragged.parentId = target.id')
    && HOOK.includes('normalizeSiblings(oldParent)')
    && HOOK.includes('normalizeSiblings(target.id)');
});

check('C101-10 拖拽反馈完整：拖动源淡出、合法 / 非法落点异色、提示原因；布局切换回到左上起点', () => {
  return MAP.includes(':drag-source="dragSource"')
    && NODE.includes('dragging: dragSource === node.id')
    && CSS.includes('.mind-node.dragging')
    && CSS.includes('.mind-node.drop-target')
    && CSS.includes('.mind-node.drop-invalid')
    && NODE.includes('mind-drop-hint')
    && MAP.includes('canvasRef')
    && MAP.includes("canvasRef.value?.scrollTo({ top: 0, left: 0 })");
});

check('C101-11 节点关联资源与证据缺口：按钮文案明确为“关联资源”，无资源叶节点可一键补证据', () => {
  return NODE.includes('关联资源')
    && NODE.includes("emit('link-resource', node)")
    && NODE.includes('缺证据 · 关联')
    && NODE.includes('cards().length')
    && MAP.includes("emit('link-resource', $event)")
    && WS.includes(':list="linkShowList"')
    && WS.includes('@confirm="confirmLinkCards"');
});

check('C101-12 分享收集全部非论点证据（含镜像），不再把镜像卡漏出分享内容', () => {
  return WS.includes('const shareCards = computed(() => allResources.value.filter(r => !r.isThesis))')
    && !WS.includes('allResources.value.filter(r => !r.isThesis && !isMirrorView(r))')
    && WS.includes(':cards="shareCards"');
});

check('C101-13 分享入口先预览再下载：阅读长文 / 论证树、链接 / 附件 / 来源 / 日期四开关、纸白 / 墨黑双主题', () => {
  return SHARE_UI.includes('真实效果预览')
    && SHARE_UI.includes('阅读长文')
    && SHARE_UI.includes('论证树')
    && SHARE_UI.includes('资源原文链接')
    && SHARE_UI.includes('附件清单')
    && SHARE_UI.includes('来源徽标')
    && SHARE_UI.includes('生成日期')
    && SHARE_UI.includes('纸白阅读版')
    && SHARE_UI.includes('墨黑演示版')
    && SHARE_UI.includes('sandbox="allow-popups allow-popups-to-escape-sandbox"')
    && SHARE_UI.includes("downloadText(filename.value, html.value, 'html')");
});

check('C101-14 分享 HTML 安全边界：自包含、无脚本、无外链资源；仅输出 http(s)，转义文本，不泄露内部 ID / 路径', () => {
  /* 内部 ID 用于在内存中按节点归属筛选资源，不等于写进分享产物。
     这里守的是输出边界：禁止把 `${node.id}` / `${card.id}` 插进 HTML，同时仍钉住自包含与转义。 */
  return SHARE.includes('<!doctype html>')
    && SHARE.includes('<style>')
    && !/<script/i.test(SHARE)
    && !SHARE.includes('http://')
    && SHARE.includes('/^https?:\\/\\//i.test(url)')
    && SHARE.includes('const esc =')
    && SHARE.includes('rel="noopener noreferrer"')
    && !SHARE.includes('${card.id}')
    && !SHARE.includes('${node.id}')
    && !SHARE.includes('zy-asset://')
    && !SHARE.includes('localStorage')
    && !SHARE.includes('airtable');
});

check('C101-15 分享两种版式都按节点挂卡：阅读长文递归章节、论证树递归横向树，空证据有明确文案', () => {
  return SHARE.includes('function nodeReadingHtml')
    && SHARE.includes('function nodeTreeHtml')
    && SHARE.includes('children.map((child, i) => nodeReadingHtml')
    && SHARE.includes('children.map((child, i) => nodeTreeHtml')
    && SHARE.includes('这个节点暂未挂资源卡')
    && SHARE.includes('暂未挂资源卡')
    && SHARE.includes("options.format === 'reading' ? reading : tree");
});

check('C101-16 画布视觉契约：金字塔向下、树状向右；金字塔同层横向连接线在位；窄屏无页面级溢出', () => {
  return CSS.includes('.mindmap-canvas[data-layout="pyramid"]')
    && CSS.includes('.mindmap-canvas[data-layout="tree"]')
    && CSS.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children::before')
    && CSS.includes('left: calc(25% - 6.5px)')
    && CSS.includes('right: calc(25% - 6.5px)')
    && CSS.includes('@media (max-width: 900px)')
    && CSS.includes('.mindmap-canvas { min-height: 520px;')
    && CSS.includes('overflow: auto');
});

check('C101-17 旧版卡片网格的排序 / 筛选 / 密度 / 快捷筛选 / 批量入口从画布工具条移除，只留画布动作与全台搜索', () => {
  const s = WS.indexOf('<div class="ws-toolbar">');
  const e = WS.indexOf('<CurationMindMap', s);
  const block = WS.slice(s, e);
  return s >= 0 && e > s
    && block.includes('＋ 新建分支')
    && block.includes('导入数据包')
    && block.includes('分享成果')
    && block.includes('导入模板')
    && block.includes('检索论证节点')
    && !block.includes('quick-filter')
    && !block.includes('filter-pop')
    && !block.includes('toolbar-filter')
    && !block.includes('toggleBatchMode')
    && !block.includes('density');
});

check('C101-18 全台检索覆盖节点与节点下资源卡，资源 chip 右键菜单从画布可达', () => {
  return WS.includes('全台检索：匹配节点标题与说明，以及节点下资源卡的标题、描述、标签与来源')
    && NODE.includes('function cardMatches(card: ResourceCard)')
    && NODE.includes('card.description')
    && NODE.includes('...(card.tags || [])')
    && NODE.includes("SOURCE_LABELS[card.sourceType || '']")
    && NODE.includes('cards().some(cardMatches)')
    && NODE.includes("'open-resource-context': [event: MouseEvent, card: ResourceCard]")
    && NODE.includes('@contextmenu.prevent.stop="emit(\'open-resource-context\', $event, card)"')
    && MAP.includes("'open-resource-context': [event: MouseEvent, card: ResourceCard]")
    && MAP.includes("@open-resource-context=\"(e, card) => emit('open-resource-context', e, card)\"")
    && WS.includes('@open-resource-context="openResCtx"')
    && WS.includes('<ContextMenu :state="resCtx"');
});

check('C101-18b 资源 chip 的三条交互通道在位：单击详情、双击打开链接、右键菜单；附件统一走 useResourceOpen', () => {
  const ro = read('/newtab/composables/useResourceOpen.ts');
  return NODE.includes('class="mind-resource"')
    && NODE.includes(':data-rid="card.id"')
    && NODE.includes('@click.stop="onResourceClick(card)"')
    && NODE.includes('@dblclick.stop="onResourceDblClick(card)"')
    && NODE.includes("'open-resource-link': [card: ResourceCard]")
    && NODE.includes("emit('open-resource-link', card)")
    && MAP.includes("'open-resource-link': [card: ResourceCard]")
    && WS.includes('@open-resource-link="openResourceLink"')
    && WS.includes('useResourceOpen({ store, d })')
    && ro.includes("r.linkType === 'file' && /^zy-asset:\\/\\//i.test")
    && ro.includes("meta.kind === 'html' || meta.kind === 'pdf'")
    && ro.includes("meta.kind === 'image'");
});

check('C101-19 模板导入只创建论点卡与 Category 分支树，不再承诺每节点新建台内卡', () => {
  const itm = read('/newtab/components/ImportTemplateModal.vue');
  const hook = read('/newtab/composables/usePyramid.ts');
  return hook.includes('Markdown 模板只写两份数据：可选的 L1 论点卡 + Category 论证树')
    && !hook.includes("kind: 'argument'")
    && !hook.includes('argCards')
    && itm.includes('导入不会为每个分支新建台内卡片')
    && itm.includes('论证分支')
    && !itm.includes('新建卡片')
    && !itm.includes('节点卡片');
});

check('C101-20 文件与注册齐备：专用组件、composable、分享工具、回归分片全部入库', () => {
  return exists('/newtab/components/curation/CurationMindMap.vue')
    && exists('/newtab/components/curation/CurationMindNode.vue')
    && exists('/newtab/components/curation/CurationThesisDrawer.vue')
    && exists('/newtab/components/curation/CurationShareDrawer.vue')
    && exists('/newtab/composables/useCurationMindMap.ts')
    && exists('/shared/utils/curationShare.ts')
    && exists('/newtab/components/curation/curation.css');
});
