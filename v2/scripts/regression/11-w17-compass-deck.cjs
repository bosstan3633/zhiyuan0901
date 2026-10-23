/**
 * 分片 · 11-w17-compass-deck：W17 调度台侧栏 + 三卡池体验（C01–C08，2026-10-20 批）。
 *
 * 为什么独立成分片：门禁上限靠加分片兑现，不靠放宽（R164-2 单片 ≤900 行）。
 * 本片只钉本批新增契约（W17-1 ~ W17-17），历史断言一条未动、只重指。
 * 依赖基建见 ./helpers.cjs。
 */
const { check, codeOnly, read } = require('./helpers.cjs');

const PI = read('/newtab/views/CompassHome.vue');
const PI_C = codeOnly(PI);
const POOL = read('/newtab/components/compass/PoolCardsPanel.vue');
const POOL_C = codeOnly(POOL);
const RDD = read('/newtab/components/ResourceDetailDrawer.vue');
const RDD_C = codeOnly(RDD);
const MIRROR = read('/newtab/components/ResourceMirrorModal.vue');
const MIRROR_C = codeOnly(MIRROR);
const HUB = read('/shared/storage/hub.ts');
const OPEN = read('/newtab/composables/useResourceOpen.ts');
const OPEN_C = codeOnly(OPEN);
const PIN = read('/newtab/composables/useResourcePin.ts');
const TASK = read('/newtab/components/compass/TaskManagerPanel.vue');
const TASK_C = codeOnly(TASK);
const CURIO = read('/newtab/components/compass/CuriosityPanel.vue');
const CURIO_C = codeOnly(CURIO);
const DECK = read('/newtab/views/CompassDeckView.vue');
const DECK_C = codeOnly(DECK);
const EQ = read('/newtab/composables/useEqualHeight.ts');
const STATUS = read('/newtab/components/compass/CompassStatusModal.vue');
const STATUS_C = codeOnly(STATUS);

console.log('【W17 · 调度台侧栏 + 三卡池体验（V3.9.4 / V3.9.5 批）】');

/* ══════════════ C01 · 三行状态 → 中央只读明细弹窗 ══════════════ */

check('W17-1 ★侧栏主攻行开只读项目详情，未归档 / 本周复用两行开只读清单；全部零 router.push', () => {
  return PI.includes("function openStatusDetail(k: StatusDetailKey): void { statusDetail.value = k }")
    && PI.includes('@click="openFocusProject(mainFocus)"')
    && PI.includes('@click="openFocusProject(extraFocus)"')
    && PI.includes("@click=\"openStatusDetail('unarchived')\"")
    && PI.includes("@click=\"openStatusDetail('reuse')\"")
    && PI.includes('<CompassStatusModal')
    /* 负锚：退役的跳转函数不许回来 */
    && !PI_C.includes('function openUnarchived(')
    && !PI_C.includes('function openWeeklyReuse(')
    /* 侧栏入口只切本地状态，不产生路由跳转。 */
    && !/class="stat-(?:row|focus-item)"[\s\S]{0,260}?router\.push\(/.test(PI);
});

check('W17-2 ★只读：明细弹窗里没有任何下钻/勾选交互，标题可选中复制', () => {
  return STATUS.includes('<Modal')                     /* 复用 R161 中央弹窗壳，不新造 */
    && !STATUS_C.includes('DrillCardList')             /* 负锚：它自带下钻，与只读冲突 */
    && !/@click/.test((STATUS.match(/<div v-for="\(it, i\) in props\.items"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0])
    && !STATUS_C.includes('role="button"')
    && !STATUS_C.includes('tabindex="0"')
    && /user-select:\s*text/.test(STATUS)
    && STATUS.includes('文本可选中复制');
});

check('W17-3 ★本周复用同源：清单按 wrr 周戳过滤，跨周后与行内 0 一致（不许把上周调用当本周）', () => {
  return PI.includes('const thisWeek = weekStartKeyOf(Date.now())')
    && PI.includes("const start = wrr?.thisWeekStart === thisWeek ? wrr.thisWeekStart : ''")
    && PI.includes('.filter(r => !!start && weekStartKeyOf(r.lastCalledAt || 0) === start)')
    && PI.includes('function weekStartKeyOf(ts: number): string');
});

/* ══════════════ C02 · 最近调出单击分流 ══════════════ */

check('W17-4 ★单一计数入口：CompassHome 不再定义本地 openResourceLink，单击分流走 useResourceOpen', () => {
  return !PI_C.includes('function openResourceLink(r: ResourceCard): void {')
    && PI.includes('useResourceOpen({ store, d })')
    && PI.includes('function openRecentResource(r: ResourceCard): void {')
    && PI.includes('if (openResourceLink(r)) return')
    && PI.includes('openResourcePreview(r)')
    && PI.includes('@click="openRecentResource(r)"');
});

check('W17-5 ★回落不双计：openResourceLink 记账后置（确认可打开才记），失败分支零 recordResourceOpen', () => {
  const fn = OPEN.slice(OPEN.indexOf('function openResourceLink('), OPEN.indexOf('  return { previewOpen'));
  const recordIdx = fn.indexOf('recordResourceOpen(');
  const firstGuard = fn.indexOf('if (!meta)');
  return recordIdx > firstGuard                          /* 记账在"附件存在"检查之后 */
    && (fn.match(/recordResourceOpen\(/g) || []).length === 2   /* 仅 asset 成功与 url 成功两处 */
    && fn.includes('return false')
    && fn.includes('openExternalLink(url)\n    return true');
});

check('W17-6 ★等高有实现：页面根写 CSS 变量，右栏读变量；最近调出列表内部滚动', () => {
  return EQ.includes('new ResizeObserver') && EQ.includes('--rail-top-h') && EQ.includes('--rail-bottom-h')
    && /\.rail-panel:not\(\.rail-panel-recent\) \{ height: var\(--rail-top-h, auto\)/.test(PI)
    && /\.rail-panel-recent \{ height: var\(--rail-bottom-h, auto\)/.test(PI)
    && /\.recent-list \{ flex: 1; min-height: 0; overflow-y: auto/.test(PI)
    && PI.includes('nextTick(() => onEqualHeightReady())');
});

check('W17-7 ★条数不写死 3：最近调出条数按面板可用高度算', () => {
  return PI.includes('const recentLimit = computed(() =>')
    && PI.includes('.slice(0, recentLimit.value)')
    && !/\.slice\(0, 3\)\s*\r?\n?\s*\)/.test(PI.split('const recentResources')[1]?.slice(0, 400) || '');
});

/* ══════════════ C07 · 置顶三处入口 ══════════════ */

check('W17-8 ★三处置顶同源：列表 / 网格 / 抽屉共用 togglePinOf，且抽屉两处同改（draft 同步）', () => {
  return PIN.includes('export function togglePinOf(')
    && PIN.includes('if (ctx.draft) ctx.draft.pinned = next')
    && POOL.includes("import { togglePinOf } from '@/newtab/composables/useResourcePin'")
    && POOL.includes('function togglePin(r: ResourceCard)')
    && (POOL.match(/@click\.stop="togglePin\(r\)"/g) || []).length >= 3   /* 列表两处 + 网格一处 */
    && RDD_C.includes('function togglePinnedHere()')
    && RDD_C.includes('togglePinOf({ card: src, draft: editing')
    && RDD.includes('@click.stop="togglePinnedHere"')
    /* 右键菜单也走同一出口（负锚：不许留内联取反） */
    && !POOL_C.includes('r.pinned = !r.pinned');
});

check('W17-9 ★星标与图钉都可点：列表 / 网格的星标、图钉均由 button 承载，title 明示当前态与动作', () => {
  return (POOL.match(/class="pcp-act pcp-pin-btn"/g) || []).length === 2
    && (POOL.match(/class="pcp-del pcp-pin-btn"/g) || []).length === 1
    && (POOL.match(/class="pcp-act pcp-star-btn"/g) || []).length === 2
    && (POOL.match(/class="pcp-del pcp-star-btn"/g) || []).length === 1
    && POOL.includes("r.pinned ? '已置顶，点击取消' : '置顶（排到最前）'")
    && POOL.includes("r.starred ? '已星标，点击取消' : '星标（搜索时优先展示）'")
    /* 负锚：行末动作区不许只有只读图标——星标与图钉动作位都必须是 button */
    && /class="pcp-r-acts">[\s\S]{0,700}pcp-star-btn[\s\S]{0,700}pcp-pin-btn/.test(POOL);
});

/* ══════════════ C06 · 镜像多选弹窗 ══════════════ */

check('W17-10 ★镜像弹窗多选：中央弹窗 + 复选框 + 打开时回显已有投射；行内浮层零残留', () => {
  return MIRROR.includes('镜像到策展台')
    && MIRROR.includes('type="checkbox"')
    && MIRROR.includes(':checked="checked.has(w.id)"')
    && MIRROR.includes('checked.value = new Set(existing.value.keys())')
    && POOL.includes("import ResourceMirrorModal from '../ResourceMirrorModal.vue'")
    && POOL.includes('<ResourceMirrorModal')
    && !POOL_C.includes('pcp-mirror-pop') && !POOL_C.includes('mirrorOpenFor');
});

check('W17-11 ★取消=移出 + 不误报：保存同时含写入与移出，按 created 判别新增；无改动说「没有改动」', () => {
  return MIRROR_C.includes('projectCardToBoardEx') && MIRROR_C.includes('removeProjection')
    && MIRROR.includes("showToast('没有改动')")
    && HUB.includes('export function projectCardToBoardEx(')
    && HUB.includes('return { id: existed.id, created: false }')
    && HUB.includes('return { id: rec.id, created: true }');
});

check('W17-12 ★网格入口：网格卡片内有镜像按钮，与列表共用同一弹窗', () => {
  const grid = POOL.slice(POOL.indexOf("class=\"pcp-grid\""));
  return grid.includes('@click.stop="openMirror(r)"')
    && grid.includes('mirrorNamesOf(r)')
    && POOL.includes('已镜像 · {{ mirrorNamesOf(r).length }}');
});

/* ══════════════ C08 · 分组下拉 + 持久化 ══════════════ */

check('W17-13 ★下拉同构：资源卡分组改 DeckControls 下拉，按钮条零残留', () => {
  return POOL.includes(':groups="viewMode === \'list\' ? POOL_GROUP_OPTIONS : []"')
    && POOL.includes('const POOL_GROUP_OPTIONS = computed')
    && !/<div[^>]*class="pcp-groupbar"/.test(POOL)   /* 模板里的按钮条退役；CSS 里同名规则随后由 dead-css 收口 */
    && !POOL_C.includes('function toggleGroup(');
});

check('W17-14 ★分组持久化：sortPrefs.pool.group 读写 + UIPrefs 类型扩字段', () => {
  const models = read('/shared/models/index.ts');
  return POOL.includes('store.ui?.sortPrefs?.pool?.group')
    && POOL.includes('group: groupBy.value')
    && /sortPrefs\?: Record<string, \{[^}]*group\?: string/.test(models);
});

/* ══════════════ C05 · 三页分组折叠 ══════════════ */

check('W17-15 ★三页同构折叠：三个面板都有组级折叠集合 + aria-expanded；负锚：未写入持久化', () => {
  return TASK.includes('const collapsedGroups = ref<Set<string>>(new Set())')
    && TASK.includes(':aria-expanded="!isGroupCollapsed(grp.key)"')
    && POOL.includes('const collapsedGroups = ref<Set<string>>(new Set())')
    && POOL.includes(':aria-expanded="!isGroupCollapsed(sec.id)"')
    && CURIO.includes('const collapsedGroups = ref<Set<string>>(new Set())')
    && CURIO.includes(':aria-expanded="!isGroupCollapsed(g.id)"')
    /* 负锚：折叠状态不落 UIPrefs（刷新即全展开）——三个面板的 saveUIPrefs 调用都不许带折叠状态 */
    && !/saveUIPrefs\(\{[^}]*collapsed/.test(TASK_C)
    && !/saveUIPrefs\(\{[^}]*collapsed/.test(POOL_C)
    && !/saveUIPrefs\(\{[^}]*collapsed/.test(codeOnly(CURIO))
    /* 任务卡折叠组仍可接落点（悬停 300ms 自动展开） */
    && TASK.includes('onGroupHeadDragOver') && TASK.includes('}, 300)');
});

check('W17-16 ★全局开关：三页都有「全部折叠 / 全部展开」按当前状态切换', () => {
  return TASK.includes('function toggleAllGroups()') && TASK.includes('全部折叠')
    && POOL.includes('function toggleAllGroups()') && POOL.includes('全部折叠')
    && CURIO.includes('function toggleAllGroups()') && CURIO.includes('allGroupsLabel')
    && CURIO.includes('▸ 全部折叠')
    && TASK.includes('allGroupsCollapsed ? \'▾ 全部展开\' : \'▸ 全部折叠\'');
});

/* ══════════════ C04 · 二级页页头对齐 ══════════════ */

check('W17-17 ★页头左缘单锚：返回按钮独立成行，标题块与列表左缘对齐，描述单行省略', () => {
  return DECK.includes('class="deck-head-top"')
    && DECK.includes('class="deck-head-copy"')
    && DECK_C.includes('<div class="deck-head-top">')
    && DECK_C.indexOf('<div class="deck-head-top">') < DECK_C.indexOf('<div class="deck-head-copy">')
    && /\.deck-head \{ display: flex; flex-direction: column;/.test(DECK)
    && /white-space: nowrap; overflow: hidden; text-overflow: ellipsis/.test(DECK);
});

/* ══════════════ V3.9.7 · 调度台与卡池收口 ══════════════ */
console.log('【V3.9.7 · 手边卡密度、项目详情、卡池切换】');

check('V3.9.7-1 ★手边的卡三类各 5 行；右栏最近调出按可用高度给 5–7 条', () => {
  const tasks = PI.slice(PI.indexOf('const previewTasks'), PI.indexOf('const liveCuriosities'));
  const curios = PI.slice(PI.indexOf('const previewCuriosities'), PI.indexOf('const liveResources'));
  const resources = PI.slice(PI.indexOf('const previewResources'), PI.indexOf('const hasAnyPreview'));
  return /\.slice\(0, 5\)/.test(tasks)
    && /\.slice\(0, 5\)/.test(curios)
    && /\.slice\(0, 5\)/.test(resources)
    && PI.includes('Math.max(5, Math.min(7, Math.floor((h - 48) / RECENT_ROW_H)))');
});

check('V3.9.13-2 ★主攻项目点击打开只读详情弹窗，不再跳方向树，也不再进入可编辑抽屉', () => {
  const fn = PI.slice(PI.indexOf('function openFocusProject'), PI.indexOf('// ================= 底部专区'));
  return PI.includes("import CompassProjectReadonlyModal from '../components/compass/CompassProjectReadonlyModal.vue'")
    && PI.includes('<CompassProjectReadonlyModal :open="readonlyProjectOpen"')
    && fn.includes('readonlyProjectOpen.value = true')
    && fn.includes('readonlyProjectId.value = p.id')
    && !fn.includes('router.push');
});

check('V3.9.7-3 ★卡池二级页可在任务 / 好奇心 / 资源三类自由切换，切换写路由以保留浏览器返回', () => {
  return DECK.includes('const DECK_TABS')
    && DECK.includes("kind: 'task'") && DECK.includes("kind: 'curiosity'") && DECK.includes("kind: 'resource'")
    && DECK.includes('function switchKind(next: DeckKind): void')
    && DECK.includes('router.push(`/deck/${next}`)')
    && DECK.includes('role="tablist" aria-label="卡片类型"')
    && DECK.includes(':aria-selected="kind === tab.kind"');
});
