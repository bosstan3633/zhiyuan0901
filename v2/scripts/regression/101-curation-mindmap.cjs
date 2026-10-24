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
const SHARE_DATA = read('/shared/utils/curationShareData.ts');
const SHARE_IMAGE = read('/shared/utils/curationImage.ts');
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
  const s = WS.indexOf('<div class="cur-metrics" data-curation-metrics="2">');
  const e = WS.indexOf('<CurationDrillDrawer', s);
  if (s < 0 || e < 0) return false;
  const block = WS.slice(s, e);
  return (block.match(/class="cur-metric"/g) || []).length === 2
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
  // V3.9.10：根节点与普通节点都改按完整 tagName 排除控件。
  // 当前节点自身就是事件目标，`closest(...)` 只需查祖先链反而会放过自身控件；
  // 同批还发现 /A/ 子串会把 ARTICLE 误判成链接，因此必须钉完整标签与 contentEditable。
  return body.includes("const tag = target?.tagName || ''")
    && body.includes('/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag)')
    && body.includes('target?.isContentEditable')
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

check('C101-6b ★树画布空间导航（V3.9.17）：↑↓ 按可见节点顺序移动，← 回父级，→ 进第一个子级，Home/End 到首尾；导航只移焦点，不改变 Tab/Enter 建支语义。子节点把自身 id 一并上抛，避免选中态与焦点态不同步时导航跳到别处', () => {
  const map = MAP.slice(MAP.indexOf('function onRootKeydown'), MAP.indexOf('watch(() => props.layout'));
  const nav = MAP.slice(MAP.indexOf('function visibleMindNodes'), MAP.indexOf('function onSchedule') > 0 ? MAP.indexOf('function onSchedule') : MAP.indexOf('function scheduleTreeConnectors'));
  const node = NODE.slice(NODE.indexOf('function onNodeKeydown'), NODE.indexOf('function focusCard'));
  return map.includes("['ArrowUp', 'ArrowDown', 'ArrowRight', 'Home', 'End']")
    && map.includes("e.key === 'ArrowLeft'")
    && nav.includes("querySelectorAll<HTMLElement>('[data-mind-node]')")
    && nav.includes("key === 'Home'") && nav.includes("key === 'End'")
    && nav.includes("key === 'ArrowUp' ? -1 : 1")
    && nav.includes("key === 'ArrowRight' ? firstChild : (node.parentId || 'root')")
    && node.includes("['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']")
    && node.includes("emit('focus-node', e.key, props.node.id)")
    && NODE.includes("'focus-node': [key: string, id: string]")
    && MAP.includes('@focus-node="onNodeFocusRequest"')
    && MAP.includes('function onNodeFocusRequest(key: string, id: string)')
    && MAP.includes('<kbd>↑↓←→</kbd> 节点导航');
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

check('C101-13 分享入口先预览再下载：阅读长文 / 论证树、链接 / 附件 / 来源 / 日期四开关、纸白 / 墨黑双主题；预览消费规范树而不是私有平铺递归', () => {
  return SHARE_UI.includes('分享页预览')
    && SHARE_UI.includes('阅读长文')
    && SHARE_UI.includes('论证树')
    && SHARE_UI.includes('资源原文链接')
    && SHARE_UI.includes('附件清单')
    && SHARE_UI.includes('来源徽标')
    && SHARE_UI.includes('生成日期')
    && SHARE_UI.includes('纸白阅读版')
    && SHARE_UI.includes('墨黑演示版')
    && SHARE_UI.includes('class="cs-paper"')
    && SHARE_UI.includes('role="document"')
    && SHARE_UI.includes('cs-preview-section')
    /* G-01：预览、HTML 与长图共用 buildCurationRenderTree；私有 flattenPreviewNodes
       会让 L3/L4 在不同出口各算一遍，回归必须守住“单一规范树”。 */
    && SHARE_UI.includes('buildCurationRenderTree')
    && SHARE_UI.includes('const previewFlatNodes = computed(() => renderTree.value.flat)')
    && !SHARE_UI.includes('flattenPreviewNodes')
    && SHARE_UI.includes('v-for="node in previewFlatNodes"')
    && SHARE_UI.includes("downloadText(filename.value, html.value, 'html')");
});

check('C101-14 分享 HTML 安全边界与真实层级：自包含、无可执行脚本、无外链资源；仅输出 http(s)，按 node.level 输出 L1–L4，不泄露内部 ID / 路径', () => {
  /* 内部 ID 用于在内存中按节点归属筛选资源，不等于写进分享产物。
     这里守的是输出边界：论证树层级按真实 L1–L4 输出，JSON 快照必须 inert，同时仍钉住自包含与转义。 */
  const scripts = [...SHARE.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  const onlyInertSnapshot = scripts.length === 1
    && /type=["']application\/json["']/i.test(scripts[0][1])
    && /id=["']zy-curation-share-data["']/i.test(scripts[0][1])
  return SHARE.includes('<!doctype html>')
    && SHARE.includes('<style>')
    && onlyInertSnapshot
    && !SHARE.includes('http://')
    && SHARE.includes('/^https?:\\/\\//i.test(url)')
    && SHARE.includes('const esc =')
    && SHARE.includes('const renderTree = buildCurationRenderTree({ nodes, cards, thesis })')
    && SHARE.includes('node-kicker">L${node.level} · 论证节点')
    && !SHARE.includes('L${depth + 2}')
    && !SHARE.includes('L2+')
    && SHARE.includes('rel="noopener noreferrer"')
    && !SHARE.includes('${card.id}')
    && !SHARE.includes('${node.id}')
    && !SHARE.includes('zy-asset://')
    && !SHARE.includes('localStorage')
    && !SHARE.includes('airtable');
});

check('C101-15 分享两种版式都按节点挂卡：阅读长文与论证树都消费同一规范树、保留真实 L1–L4，空证据有明确文案', () => {
  return SHARE.includes('function nodeReadingHtml')
    && SHARE.includes('function nodeTreeHtml')
    && SHARE.includes('${node.children.map((child, i) => nodeReadingHtml(child, options, `${index}-${i + 1}`)).join(\'\')}')
    && SHARE.includes('${node.children.map(child => nodeTreeHtml(child, options)).join(\'\')}')
    && SHARE.includes('const renderTree = buildCurationRenderTree({ nodes, cards, thesis })')
    && !SHARE.includes('const byParent = new Map<string, Category[]>')
    && SHARE.includes('这个节点暂未挂资源卡')
    && SHARE.includes('暂未挂资源卡')
    && SHARE.includes("options.format === 'reading' ? reading : tree");
});

check('C101-G01-1 共享渲染树覆盖 L1–L4、稳定排序与路径：L1 是论点卡，L2–L4 按 order/id 稳定输出，路径随父子关系累积', () => {
  return SHARE_DATA.includes('export interface CurationRenderTree')
    && SHARE_DATA.includes('level: number')
    && SHARE_DATA.includes('path: string')
    && SHARE_DATA.includes('const roots = (byParent.get(\'\') || []).map(node => walk(node, 2, \'\'))')
    && SHARE_DATA.includes('node.parentId || \'\'')
    && SHARE_DATA.includes('arr.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))')
    && SHARE_DATA.includes('out.children = (byParent.get(node.id) || []).map(child => walk(child, level + 1, path))')
    && SHARE_DATA.includes('maxLevel = flat.reduce((n, node) => Math.max(n, node.level), input.thesis ? 1 : 0)');
});

check('C101-G01-2 共享渲染树排除论点卡、清洗附件与公开 URL：论点卡不进入节点资源，附件只保留 name/kind/size，非 http(s) 不进分享', () => {
  return SHARE_DATA.includes('if (!card || card.isThesis || !card.categoryId) continue')
    && SHARE_DATA.includes('url: safeUrl(card.link) || undefined')
    && SHARE_DATA.includes('return /^https?:\\/\\//i.test(url) ? url : \'\'')
    && SHARE_DATA.includes('assets: (card.assets || []).map(asset => ({')
    && SHARE_DATA.includes('name: asset.name || \'\'')
    && SHARE_DATA.includes('kind: asset.kind || \'\'')
    && SHARE_DATA.includes('size: asset.size || 0')
    && SHARE_DATA.includes('tags: (card.tags || []).slice(0, 8)');
});

check('C101-G01-3 共享渲染树守卫循环与上限：节点 5000 / 资源 5000 / 最深 L4，超限明确抛错；长图也复用同一极限常量', () => {
  return SHARE_DATA.includes('nodes: 5000')
    && SHARE_DATA.includes('cards: 5000')
    && SHARE_DATA.includes('maxLevel: 4')
    && SHARE_DATA.includes('maxLogicalWidth: 20000')
    && SHARE_DATA.includes('maxLogicalHeight: 30000')
    && SHARE_DATA.includes('maxPixelArea: 40_000_000')
    && SHARE_DATA.includes('const visiting = new Set<string>()')
    && SHARE_DATA.includes('if (visiting.has(node.id))')
    && SHARE_DATA.includes('if (tree.nodeCount > CURATION_RENDER_LIMITS.nodes)')
    && SHARE_DATA.includes('if (tree.cardCount > CURATION_RENDER_LIMITS.cards)')
    && SHARE_DATA.includes('if (tree.maxLevel > CURATION_RENDER_LIMITS.maxLevel)')
    && SHARE_IMAGE.includes('CURATION_RENDER_LIMITS.maxLogicalWidth')
    && SHARE_IMAGE.includes('CURATION_RENDER_LIMITS.maxLogicalHeight')
    && SHARE_IMAGE.includes('CURATION_RENDER_LIMITS.maxPixelArea')
    && !SHARE_IMAGE.includes('Math.max(0.5');
});

check('C101-16 V3.9.14 画布视觉契约：金字塔向下、树状向右；树状连线按真实父子节点盒生成 SVG 折线；窄屏无页面级溢出', () => {
  return CSS.includes('.mindmap-canvas[data-layout="pyramid"]')
    && CSS.includes('.mindmap-canvas[data-layout="tree"]')
    && CSS.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children > .mind-branch::after')
    && CSS.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children > .mind-branch:first-child::after { left: 50%; }')
    && CSS.includes('.mindmap-canvas[data-layout="pyramid"] .mind-children > .mind-branch:last-child::after { right: 50%; }')
    && !CSS.includes('left: calc(25% - 6.5px)')
    && MAP.includes('class="mind-connectors"')
    && MAP.includes('M ${px} ${py} H ${mx} V ${cy} H ${cx}')
    && CSS.includes('.mind-connectors path')
    && CSS.includes('vector-effect: non-scaling-stroke')
    && CSS.includes('@media (max-width: 900px)')
    && CSS.includes('.mindmap-canvas { min-height: 520px;')
    && CSS.includes('overflow: auto');
});

check('C101-17（V3.9.9 随迁）工具栏收敛：旧四视图与批量入口退役；建支只走节点键盘操作，成果 HTML 与分享成果常驻，全台搜索保留', () => {
  const s = WS.indexOf('<div class="ws-toolbar cur-toolbar"');
  const e = WS.indexOf('<CurationMindMap', s);
  const block = WS.slice(s, e);
  return s >= 0 && e > s
    && !block.includes('＋ 新建分支')
    && !block.includes('导入数据包')
    && block.includes('导入成果 HTML')
    && block.includes('分享成果')
    && block.includes('导入模板')
    && block.includes('检索论证节点')
    && !block.includes('quick-filter')
    && !block.includes('filter-pop')
    && !block.includes('toolbar-filter')
    && !block.includes('toggleBatchMode')
    && !block.includes('density');
});

check('C101-21 思维导图编辑闭环：整卡可拖、剪切粘贴共用校验、节点焦点支持 Tab / Enter、资源 chip 可解除关联', () => {
  return NODE.includes('draggable="true"')
    && NODE.includes("emit('drag-start', props.node.id)")
    && NODE.includes("emit('cut', props.node.id)")
    && NODE.includes("emit('paste', props.node.id)")
    && NODE.includes("emit('unlink-resource', props.node.id, card)")
    && NODE.includes('class="mind-resource-remove"')
    /* V3.9.10：`ARTICLE` 含字母 A，旧的子串正则会把节点自身误判成 `<a>`。
       这里钉住精确标签匹配，防止 L2/L3 的 Tab/Enter 再次被静默吞掉。 */
    && NODE.includes("if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag)) return")
    && !NODE.includes('/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(tag)')
    && MAP.includes("if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag) || target?.isContentEditable) return")
    && MAP.includes('if (e.defaultPrevented) return')
    && MAP.includes("emit('cut', props.selectedId)")
    && MAP.includes("emit('paste', props.selectedId)")
    && MAP.includes('<kbd>拖拽</kbd> 移动整棵子树')
    && MAP.includes('<kbd>⌘/Ctrl+X</kbd> 剪切');
});

check('C101-22 成果 HTML 回导：新建 / 合并双分支、按节点路径合并、同台重复投射去重且可更新落点', () => {
  const imp = read('/newtab/composables/useCurationShareImport.ts');
  return imp.includes('function importNew()')
    && imp.includes('function importMerge()')
    && imp.includes('function sameNode(')
    && imp.includes('function uniqueNodeName(')
    && imp.includes('function projectionExists(')
    && imp.includes('existed.targetCatId = categoryId || undefined')
    && imp.includes('if (projectionExists(d.value, pool.id, wsId, cat.id)) continue')
    && imp.includes('if (ensureProjection(d.value, pool.id, wsId, cat.id)) result.cards++')
    && WS.includes('confirmNewShareImport')
    && WS.includes('confirmMergeShareImport');
});

check('C101-23 删除策展台语义：本台原生卡软删进回收站，台内镜像投射仅移除引用，资源池源卡状态不变', () => {
  const crud = read('/shared/utils/compassCrud.ts');
  const meta = read('/newtab/composables/useWsMeta.ts');
  const start = crud.indexOf('export function deleteDeck');
  const body = start >= 0 ? crud.slice(start, crud.indexOf('\n}', start) + 2) : '';
  return crud.includes("for (const r of d.resources) if (r.workspaceId === wsId && !r.deletedAt)")
    && crud.includes("!(p.kind === 'card' && p.targetWsId === wsId)")
    && body.includes('return { ws, index, cardIds, catIds }')
    && !body.includes('pruneMirrorCats(d, wsId)')
    && meta.includes('本台原生资源卡')
    && meta.includes('镜像引用会移除')
    && meta.includes('资源卡池里的源卡状态不变')
    && meta.includes('池卡未受影响');
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

check('C101-24 调度台卡片池返回：三类卡切换后，「返回调度台」必须离开 /deck 路由族直达根页', () => {
  const deck = read('/newtab/views/CompassDeckView.vue');
  const body = deck.slice(deck.indexOf('function goBack()'), deck.indexOf('watch(', deck.indexOf('function goBack()')));
  return deck.includes('function switchKind')
    && deck.includes('router.push(`/deck/${next}`)')
    && codeOnly(body).includes("void router.push('/')")
    && !codeOnly(body).includes('router.back()');
});
