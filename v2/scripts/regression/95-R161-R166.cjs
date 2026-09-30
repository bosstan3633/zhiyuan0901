/**
 * R174-1 分片 · 95-R161-R166：由 scripts/regression.cjs 原样搬出（分片是搬运不是重写，断言零丢失）。
 * 依赖基建见 ./helpers.cjs；__dirname/__filename 已换锚为 SCRIPTS_DIR/ANCHOR_FILE（语义=原 scripts/ 根与回归自体）。
 */
const {
  fs, path, base, check, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, MOUNT_FN, MOUNT_PICKER, RES_CARD_IFACE, LH, LH_TPL, LH_STYLE, TERM_FN, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, LH85, ST85, TPL85, STY85, FOCUS_FN, ADDP_FN, FBAR_TPL, CS86, LH86, CT86, ST86, CS_TPL, CS_STY, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, LP99, CS99, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE,
} = require('./helpers.cjs');

console.log('【R161 · V3.2.2：AI 中央弹窗、星标置顶、历史检索、全字段投料、镜像 AI】');
check('R161-1 ★新建中央弹窗壳 Modal.vue：沿用 useOverlayTarget()（金字塔真全屏时浮层必须 Teleport 进全屏元素，落 body 会不可见）、尺寸走 CSS 变量（--md-w/--md-mh，内联 width 会压过窄屏媒体查询）', () => {
  const m = read('/shared/components/Modal.vue')
  return m.includes("from '@/shared/utils/overlayHost'") && m.includes('useOverlayTarget()')
    && m.includes('<Teleport :to="overlayTarget">')
    && m.includes("'--md-w': width") && m.includes("'--md-mh': maxHeight")
    && m.includes('width: var(--md-w)') && m.includes('max-height: var(--md-mh)')
});
check('R161-2 ★中央弹窗三层 z 序与进出场：scrim 走 --z-modal、面板 calc(--z-modal + 1)；进出场 scale(0.975) 走 --ease-emphasis；窄屏 767px 全屏化', () => {
  const m = read('/shared/components/Modal.vue')
  return m.includes('z-index: var(--z-modal)') && m.includes('z-index: calc(var(--z-modal) + 1)')
    && m.includes('--ease-emphasis') && m.includes('scale(0.975)')
    && m.includes('@media (max-width: 767px)') && m.includes('prefers-reduced-motion');
});
check('R161-3 ★AI 评审从抽屉换壳为中央弹窗：不再 import Drawer.vue（它挂全站 30+ 抽屉宿主，本轮一字未动），模板根改 <Modal>，宽度按 dual 分档 1200/620', () => {
  const a = read('/newtab/components/AiSuggestionDrawer.vue')
  return !a.includes('shared/components/Drawer.vue')
    && a.includes("import Modal from '@/shared/components/Modal.vue'")
    && a.includes('<Modal :open="open"')
    && a.includes("dual ? 'min(1200px, 92vw)' : '620px'")
});
check('R161-4 ★AI 评审模块化五段：徽标+场景名(#title) / 专家下拉(#title-extra) / 步骤+指令条(#sub，从 body 迁出后固定在头部) / body / 按钮行(#footer，不滚动区天然 sticky)', () => {
  const a = read('/newtab/components/AiSuggestionDrawer.vue')
  return a.includes('<template #title>') && a.includes('#title-extra') && a.includes('#sub>') && a.includes('<template #footer>')
    && a.includes('class="ai-dir"') /* 一次性指令条已迁进 #sub */
    && a.includes('<AiEntryButton variant="inline" large') /* 场景名与全站 AI 入口同徽标 */
});
check('R161-5 ★差异汇总行从右栏迁到跨栏公共区：ai-sum 承载 ai-chg（N 处差异）+ 只看差异/原文切换 + ai-usage（投料/耗时），左右对照两栏共享同一条汇总', () => {
  const a = read('/newtab/components/AiSuggestionDrawer.vue')
  return a.includes('class="ai-sum"') && a.includes('ai-sum-end') && a.includes('.ai-sum .ai-usage')
    && a.includes('只看差异') && a.includes('原文');
});
check('R161-6 Cmd/Ctrl+Enter = 采纳选中：仅当可采纳（canApply）才生效，preventDefault + stopPropagation 防穿透，且 watch 必带 immediate（宿主 v-if 条件挂载时 open 出生即 true，缺它则监听从不注册）', () => {
  const a = read('/newtab/components/AiSuggestionDrawer.vue')
  return a.includes('function onDocKey') && a.includes("e.key !== 'Enter'") && a.includes('e.ctrlKey || e.metaKey')
    && a.includes('e.preventDefault()') && a.includes('e.stopPropagation()')
    && a.includes("addEventListener('keydown', onDocKey, true)")
    && /watch\(open, \(v\) => \{[\s\S]*?\}, \{ immediate: true \}\)/.test(a);
});
check('R161-⑦ ★Esc 真能关掉中央弹窗：watch 必带 immediate —— 宿主是 `<AiSuggestionDrawer v-if="aiJob">` 而 open = computed(() => !!props.job)，弹窗**出生即 open=true**，缺 immediate 则 keydown 监听从不注册（现象：点遮罩能关、× 能关、按 Esc 毫无反应；本轮实测抓到，E2E-23 已补「真关掉」断言；同源缺陷也吞掉了 Cmd/Ctrl+Enter）', () => {
  const m = read('/shared/components/Modal.vue')
  return /watch\(\(\) => props\.open, async \(v\) => \{[\s\S]*?\}, \{ immediate: true \}\)/.test(m)
    && m.includes("document.addEventListener('keydown', onKey, true)")
    && m.includes('panelRef.value?.focus()')   /* 打开即聚焦面板（键盘用户不丢锚点） */
    && m.includes('restoreTo.focus()')         /* 关闭归还焦点 */
    && m.includes('onUnmounted(');             /* 卸载兜底：条件挂载的宿主销毁时不留野监听 */
});
check('R161-7 ★令牌三新增（四主题各一份，动 tokens.css 必跑 theme-contrast）：--radius-xl 外框圆角 / --scrim-modal 统一遮罩 / --shadow-modal 四份（中央弹窗的悬浮感不进 shadow-lg 复用）', () => {
  const t = read('/shared/styles/tokens.css')
  return t.includes('--radius-xl: 18px;') && t.includes('--scrim-modal:')
    && count('/shared/styles/tokens.css', '--shadow-modal:') === 4;
});
check('R161-8 中央弹窗壳消费新令牌：外框 var(--radius-xl)、阴影 var(--shadow-modal)、遮罩 var(--scrim-modal)——零硬编码色值', () => {
  const m = read('/shared/components/Modal.vue')
  return m.includes('border-radius: var(--radius-xl)') && m.includes('box-shadow: var(--shadow-modal)')
    && m.includes('background: var(--scrim-modal)') && !m.includes('border-radius: 18px');
});
check('R161-⑧ ★视觉证据链的三处工具修正 + 新建像素级对照工具：theme-audit 必须①进主题先 closeOverlays（遗留浮层会串场盖住后续 18 张台面图）②截图前 resetView（滚动 + 鼠标 hover 归零 —— 实测 hover 残留伪造出 8140px「差异」）③Esc 关不掉即非零退出；并常驻 img-diff.cjs（md5 会双向骗人：同包重采 md5 不同却逐像素 0 差异）', () => {
  // ★ 门禁脚本自身不在 src/ 下，**不能用 read()**（它以 base=src 拼路径，read('/../v2/scripts/x') 会变成 v2/v2/scripts/x）。
  //   R161 实测：首版这么写，regression 直接 ENOENT 红一条 —— 读脚本一律走 SCRIPTS_DIR。
  const norm = (s) => s.replace(/\r\n/g, '\n')
  const t = norm(fs.readFileSync(path.join(SCRIPTS_DIR, 'theme-audit.cjs'), 'utf8'))
  const df = path.join(SCRIPTS_DIR, 'img-diff.cjs')
  const d = fs.existsSync(df) ? norm(fs.readFileSync(df, 'utf8')) : ''
  return t.includes('async function closeOverlays')
    && t.includes('async function resetView')
    && t.includes('page.mouse.move(0, 0)')
    && t.includes('window.scrollTo(0, 0)')
    && t.includes('escLeak.push')
    && t.includes('if (escLeak.length)')
    && d.includes('getImageData')
    && d.includes('diffPixels')
    && d.includes('bbox');
});
check('R161-① 星标置顶（仅组内靠前）：AI 检索开启时排序以 markRank 优先、AI 命中度次之——否则 AI 次序会把星标卡挤出组首，与「置顶 > 星标 > 命中度」口径打架', () => {
  const g = read('/newtab/components/GlobalPopups.vue')
  return g.includes('markRank(b.raw as AnyCard) - markRank(a.raw as AnyCard)')
    && g.includes("from '@/shared/utils/marksort'");
});
check('R161-② ★历史检索记录：本地记忆上限 20（SEARCH_HIST_MAX，不随数据同步），按次数降序只铺前 3 条，仅空检索态显示（gp-hist 挂在检索框下方 .gp-search-head 之后）', () => {
  const g = read('/newtab/components/GlobalPopups.vue')
  return g.includes('const SEARCH_HIST_MAX = 20') && g.includes('const topSearches = computed')
    && g.includes('.slice(0, 3)') /* 只呈现 3 个常用记录 */
    && g.includes('function recordSearch') && g.includes('function useHistory')
    && g.includes("saveUIPrefs({ searchHistory: searchHistory.value })")
    && g.includes('v-if="!searchQueryRaw && topSearches.length"') && g.includes('class="gp-hist"');
});
check('R161-② 历史记录写入点覆盖两条出口：打开/定位（openLinkOrLocate）与关闭面板（closeAll），且 2 字以下不记、同一轮 recordedQ 幂等防重复记账', () => {
  const g = read('/newtab/components/GlobalPopups.vue')
  return g.includes('recordSearch(searchQuery.value)') && g.includes('if (q.length < 2 || q === recordedQ) return')
    && g.includes("recordedQ = ''") /* 换了词就允许再记 */
    && (g.split('recordSearch(').length - 1) >= 3;
});
check('R161-③ ★全字段投料、只投地址不抓正文：AiSearchCand 补 fields（自定义字段折行）+ link（仅地址）；cardFieldText 单卡 120 字上限；系统提示写明「字段即全部依据、本功能不联网不抓正文」', () => {
  const s = read('/shared/ai/select.ts')
  const sc = read('/shared/ai/scenarios.ts')
  const g = read('/newtab/components/GlobalPopups.vue')
  return s.includes('fields?: string') && s.includes('link?: string') && s.includes('scope: string')
    && g.includes('function cardFieldText')
    && g.includes('fields: cardFieldText(raw)')
    && sc.includes('不联网、不抓正文') && sc.includes('这些字段就是你的全部依据');
});
check('R161-③ ★定向收窄 scopeSearch：按输入指向（点名的类型 / 台名 / 分类名）收窄候选池，收窄后不足 2 张就放弃；带两条纪律——只认字面不猜意图、收窄结果经 finish 作为 scope 回传上屏', () => {
  const s = read('/shared/ai/select.ts')
  return s.includes('export function scopeSearch')
    && s.includes('/资源卡|资源|链接卡|网站|工具卡/') && s.includes('/任务卡|任务|待办|要做|待到/') && s.includes('/好奇心|好奇卡|好奇|灵感|疑问|想法/')
    && s.includes('if (out.length < 2) return { cands, scope: ') /* 收窄过头就退回全库 */
    && s.includes('scopeSearch(query')
    && s.includes('scope = ');
});
check('R161-③ 收窄只影响投料池不影响判断口径：semanticSearch 与 semanticSearchAll 均先 scopeSearch 再排序/分批，total 取收窄后池大小，scope 经 finish 回传', () => {
  const s = read('/shared/ai/select.ts')
  return (s.split('scopeSearch(').length - 1) >= 3
    && s.includes('pool.slice') && s.includes("batches: number, scope = ''")
});
check('R161-④ ★策展台「关联卡片（镜像）」弹窗也接 AI 检索：linkBase 抽出（在册资源卡 + 分类过滤，**关键词不进底座**——否则"换个说法也能召回"失效），linkAiRun 懒引 AI 模块（启动零 AI 不变），命中贴标签、未字面命中的也能补入列表', () => {
  const u = read('/newtab/composables/usePyramid.ts')
  const w = read('/newtab/views/Workspace.vue')
  const lm = read('/newtab/components/LinkCardsModal.vue')
  return u.includes('const linkBase = computed')
    && u.includes('if (!q) return linkBase.value')
    && u.includes('async function linkAiRun')
    && u.includes("import('@/shared/ai/select')")
    && u.includes('const linkShowList = computed')
    && u.includes('function linkAiHitOf')
    && lm.includes('class="lc-ai-btn"') && lm.includes('v-for="c in list"')
    && w.includes(':list="linkShowList"');
});
check('R161-④ 镜像弹窗 AI 的 UI 纪律：入口复用 AiEntryButton（大小与兄弟入口对齐）、投料/范围/耗时单行回执（lc-ai-fed）、命中两种档位标签（lc-ai-tag / .weak 低置信）', () => {
  const lm = read('/newtab/components/LinkCardsModal.vue')
  return lm.includes('.lc-ai-btn') && lm.includes('.lc-ai-fed') && lm.includes('.lc-ai-tag') && lm.includes('.lc-ai-tag.weak')
    && lm.includes('<AiEntryButton variant="inline"') && lm.includes('aiFed.scanned');
});
check('R161-④ 弹窗抽组件并换 R161 新壳：宿主回到 ≤1500 行验收线（此前内联到 1515 行），新组件零自有状态（状态仍全在 usePyramid）、样式随组件迁（workspace.css 是宿主 scoped，跨不过组件边界）', () => {
  const w = fs.readFileSync(base + '/newtab/views/Workspace.vue', 'utf8')
  const lm = read('/newtab/components/LinkCardsModal.vue')
  return w.split('\n').length <= 1500
    && w.includes("import LinkCardsModal from '@/newtab/components/LinkCardsModal.vue'")
    && lm.includes("import Modal from '@/shared/components/Modal.vue'") && lm.includes('<Modal :open="open"')
    && lm.includes('<style scoped>') && lm.includes('.lc-item {')
    && !read('/newtab/views/workspace.css').includes('.lc-item {')
    && !lm.includes("from '@/shared/ai/")
});
check('R161-⑤ 检索历史进 UI 偏好：searchHistory 落在 UIPrefs（本地记忆，不随数据同步），字段形态 { q, n, at }', () => {
  const m = read('/shared/models/index.ts')
  return m.includes('searchHistory?: { q: string; n: number; at: number }[]');
});
check('R161-⑥ ★门禁补漏：全站 .vue 模板结构自检（SFC 解析零错误）—— 本轮实证 `vue-tsc --noEmit` 对「元素未闭合」**静默放行**（AiSuggestionDrawer.vue 少一个 </div>：vue-tsc EXIT=0，vite build 直接报 Element is missing end tag），模板结构错误必须在静态门禁就抓住 · 注意必须**裸 fs 读单文件**（read() 对 Workspace.vue 是聚合读取，把 composables/css 拼进来会假报错）', () => {
  const { parse: sfcParse } = require('@vue/compiler-sfc')
  const bad = []
  for (const f of ALL_VUE146) {
    const r = sfcParse(fs.readFileSync(base + f, 'utf8'), { filename: f })
    if (r.errors.length) bad.push(f + ' :: ' + r.errors[0].message)
  }
  if (bad.length) console.log('     模板结构错误：' + bad.join(' ｜ '))
  return bad.length === 0 && ALL_VUE146.length >= 52 // R165：MountCountBadge.vue 随卡间挂载退役删除（53 → 52）
});

/* ─────────────── R157 · 入口注册表与能力矩阵（V3.2.3）─────────────── */
const REG_TXT = read('/shared/ai/jobs/registry.ts').replace(/\r\n/g, '\n')

check('R157-1 ★注册表是纯声明表：零 import（连 import type 都不引）——注册表一旦被入口 chunk 触达就会把 17 个工厂一起拉进首屏，直接破「启动零 AI」；双导出 AI_ENTRIES / AI_CAP_KEYS，文件头写明唯一真源', () =>
  !/(^|\n)\s*import[\s(]/.test(REG_TXT)
  && REG_TXT.includes('export const AI_ENTRIES')
  && REG_TXT.includes('export const AI_CAP_KEYS')
  && REG_TXT.includes('唯一真源'));

check('R157-2 声明结构完备：kind 三值 job×19 / inline×3 / search×2、family 两值（proactive/passive —— R158 二分的字段）、入口共 24 条（R166 任务侧补全 + 找资源支持 +2；R169-T3 今日三件事排序 +1）且 id 唯一（数量锚：增删入口必须连文档一起改；R162 推荐挂载退役 -1）', () => {
  const ids = REG_TXT.match(/\n    id: '/g) || [];
  return ids.length === 24
    && (REG_TXT.match(/kind: 'job'/g) || []).length === 19
    && (REG_TXT.match(/kind: 'inline'/g) || []).length === 3
    && (REG_TXT.match(/kind: 'search'/g) || []).length === 2
    && REG_TXT.includes("family: 'proactive'") && REG_TXT.includes("family: 'passive'");
});

check('R157-3（R167 重指：名单不再手写）全部 build*Job 工厂必须登记（漏一个 = R154 手写「17 个入口」病根复发）——工厂清单**从 src/shared/ai/*.ts 现扫**，注册表少一条即红并点名；factoryFile 必须真存在且真含该工厂', () => {
  const dir = path.resolve(base, 'shared/ai')
  const found = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'registry.ts' || f.endsWith('.test.ts')) continue
    const s = read('/shared/ai/' + f).replace(/\r\n/g, '\n')
    for (const m of s.matchAll(/^export function (build\w+Job)/gm)) found.push({ name: m[1], file: f })
  }
  const unreg = found.filter(x => !REG_TXT.includes(`factory: '${x.name}'`))
  /* 反向也核：注册表里声明的 factory 必须真在其 factoryFile 里（声明先于实现/改名后忘了同步都算红） */
  const ghost = []
  for (const m of REG_TXT.matchAll(/factory: '(build\w+Job)', factoryFile: '(shared\/ai\/[\w.]+\.ts)'/g)) {
    if (!fs.existsSync(path.resolve(base, m[2])) || !read('/' + m[2]).includes(`export function ${m[1]}`)) ghost.push(`${m[1]} → ${m[2]}`)
  }
  return found.length >= 18 && unreg.length === 0 && ghost.length === 0
    && ['batchG.ts','chain.ts','govern.ts','select.ts','taskEnrich.ts','taskSupport.ts','resourceLinkTask.ts'].every(f => REG_TXT.includes(`factoryFile: 'shared/ai/${f}'`))
});

check('R157-4 search 型豁免口径钉住（R154 拍板②「检索不属赋能」）：全局 AI 检索 + R161 镜像弹窗检索两条、caps 为空、宿主指对', () => {
  const gs = REG_TXT.slice(REG_TXT.indexOf("id: 'global-search'"), REG_TXT.indexOf("id: 'mirror-search'"));
  const ms = REG_TXT.slice(REG_TXT.indexOf("id: 'mirror-search'"));
  return gs.includes('caps: {}') && ms.includes('caps: {}')
    && gs.includes("hosts: ['newtab/components/GlobalPopups.vue']")
    && ms.includes("hosts: ['newtab/composables/usePyramid.ts']");
});

check('R157-5 矩阵门禁脚本具备双向对账与负向自检（影子删条目/抹声明必须各自变红，防断言恒真）；错误汇必须走当次 sink（首版推模块级数组，负向自检拿到空壳恒不红——实踩）', () => {
  const m = fs.readFileSync(path.join(SCRIPTS_DIR, 'entry-matrix.cjs'), 'utf8').replace(/\r\n/g, '\n');
  return m.includes('function accounting') && m.includes('function scanCallSites')
    && m.includes('负向自检') && m.includes('恒真') && m.includes('let sink = []');
});

check('R157-6 ★实跑矩阵门禁：node scripts/entry-matrix.cjs 必须零退出——未登记入口（反向）/ 幽灵工厂（正向）/ 能力声明与源码漂移（双向）/ 负向自检失败，任一红即整体红（R169-EB：实跑通道改 runGateSync，判据不变）', () => {
  const r = runGateSync(path.join(SCRIPTS_DIR, 'entry-matrix.cjs'));
  if (r.status !== 0 && process.env.VERBOSE) console.log('\n' + (r.stdout || '') + (r.stderr || ''));
  return r.status === 0;
});

check('R157-7 ★Drawer.vue 补 immediate：Esc 监听注册不再依赖「宿主常驻挂载」——现网 14 个宿主全是响应式 :open 所以正常，但任何未来 v-if 条件挂载的宿主（组件出生即 open=true）会让 Esc 静默失效，与 R161 在 Modal.vue 实踩的坑同源（勘验修正：R161 曾记 Drawer「同款缺陷」，实为理论陷阱非活缺陷）', () => {
  const d = read('/shared/components/Drawer.vue').replace(/\r\n/g, '\n');
  return /\}, \{ immediate: true \}\)/.test(d) && d.includes('R157')
    && d.includes("document.addEventListener('keydown', onKey, true)")
    && d.includes("document.removeEventListener('keydown', onKey, true)");
});

// ============== R158 · V3.2.4：入口激进重构（命令面板 AI 分组 + 卡面 ⋯ + 被动建议流） ==============
console.log('【R158 · V3.2.4：入口激进重构——少开入口，不是少做功能】');
const REGISTRY_FILE = read('/shared/ai/jobs/registry.ts');
const GP_FILE = read('/newtab/components/GlobalPopups.vue');
const SETTINGS_FILE = read('/newtab/views/GlobalSettings.vue');

check('R158-1 注册表 panel 声明完备：panel.mode 三值（nav/popup/hidden）；21 条显式 panel + search 型 2 条缺省 hidden（R169-T3 focus-rank 亦 nav → 22）；popup 只认 ai-advice；nav 必带 route+hint', () => {
  const modes = (REGISTRY_FILE.match(/mode: '(nav|popup|hidden)',/g) || []).length;
  return REGISTRY_FILE.includes('export interface AiPanelDecl')
    && modes === 22 /* R166 +2：task-enrich / task-support；R169-T3 +1：focus-rank，均 nav */
    && (REGISTRY_FILE.match(/popup: 'ai-advice'/g) || []).length === 3
    && REGISTRY_FILE.includes('route?: string')
    && REGISTRY_FILE.includes('hint?: string')
    && REGISTRY_FILE.includes('R158 定稿被动');
});
check('R158-2 命令面板 AI 分组：GlobalPopups 只引注册表纯声明（零工厂 import）+ aiPanelRows 按 family 两视图 + flatList 渲染序一致（AI 动作→AI 建议→快捷操作→近期）', () => {
  return GP_FILE.includes("import { AI_ENTRIES } from '@/shared/ai/jobs/registry'")
    && !GP_FILE.includes("from '@/shared/ai/govern'\n") // 静态引 AI 工厂即红（懒 import 除外）
    && GP_FILE.includes("AI_ENTRIES.filter(e => e.family === 'proactive'")
    && GP_FILE.includes("AI_ENTRIES.filter(e => e.family === 'passive'")
    && GP_FILE.indexOf("aiPanelRows.value.proactive.forEach") < GP_FILE.indexOf("QUICK_ACTIONS.forEach(qa =>")
    && GP_FILE.indexOf("QUICK_ACTIONS.forEach(qa =>") < GP_FILE.indexOf("recentResources.value.forEach(item => out.push")
});
check('R158-3 AI 建议面板：PanelType 含 ai-advice + gp-panel-advice 壳 + 3 张建议卡（跨台镜像/主题漂移/沉睡）+ 评审抽屉共用懒实例（gpAiJob）', () => {
  return GP_FILE.includes("'ai-advice'")
    && GP_FILE.includes('gp-panel-advice')
    && GP_FILE.includes("aiAdviceRun('cross-deck')")
    && GP_FILE.includes("aiAdviceRun('thesis-drift')")
    && GP_FILE.includes("aiAdviceRun('dormant-scan')")
    && GP_FILE.includes('const gpAiJob = computed(() => aiEnrichJob.value || aiAdviceJob.value)')
    && GP_FILE.includes('<AiDrawerGP v-if="gpAiJob" :job="gpAiJob" @close="gpAiJobClose" />');
});
check('R158-4 AI 建议面板零启动 AI：AI 工厂只经动态 import 触达（import(...govern/project)），无静态 import AI 栈；projectDormant/dormantSystem 从共享 AI 层取', () => {
  return GP_FILE.includes("import('@/shared/ai/project')") && GP_FILE.includes("import('@/shared/ai/govern')")
    && GP_FILE.includes('proj.projectDormant') && GP_FILE.includes('dormantSystem()')
    && !GP_FILE.includes('} from \'@/shared/ai/govern\'') && !GP_FILE.includes('} from \'@/shared/ai/project\'');
});
check('R158-5 设置页被动入口退役：无 aiCrossDeck/aiThesisDrift/aiDormantScan 函数与按钮、无 aiDormantDays；留迁址指引（Ctrl+K → AI 建议）；主动型三钮仍在', () => {
  return !SETTINGS_FILE.includes('function aiCrossDeck')
    && !SETTINGS_FILE.includes('function aiThesisDrift')
    && !SETTINGS_FILE.includes('function aiDormantScan')
    && !SETTINGS_FILE.includes('aiDormantDays')
    && !SETTINGS_FILE.includes('@click="aiCrossDeck"')
    && SETTINGS_FILE.includes('被动建议在命令面板 Ctrl+K → AI 建议')
    && SETTINGS_FILE.includes('@click="aiTrashRescue"')
    && SETTINGS_FILE.includes('@click="aiWeeklyReview"')
    && SETTINGS_FILE.includes('@click="aiDeliver"');
});
check('R158-6 右键重排（高频在卡面、长尾在右键）：置顶/星标位于编辑详情之后、移动分类之前；中心论点居删除之前；删除恒居底', () => {
  const u = read('/newtab/composables/useResourceDrawer.ts');
  const iEdit = u.indexOf("'✏️ 编辑详情'"), iPin = u.indexOf("r.pinned ? '取消置顶' : '置顶'"), iStar = u.indexOf("r.starred ? '☆ 取消星标' : '⭐ 星标'"), iMove = u.indexOf("{ label: '移动分类'"), iThesis = u.indexOf("'🏛 设为中心论点'"), iDel = u.indexOf("{ label: '删除', icon: 'trash', danger: true");
  return iEdit > 0 && iEdit < iPin && iPin < iStar && iStar < iMove && iMove < iThesis && iThesis < iDel;
});
check('R158-7 ★入口数量锚（V3.7.0 重指）：注册表 24 条不变；命令面板导航改「方向台/项目详情/方向树/回收站/手册/设置」6 条（资源台入口随退役下线）不改 ai-advice 语义', () => {
  const ids = (REGISTRY_FILE.match(/\n    id: '/g) || []).length;
  return ids === 24
    && !GP_FILE.includes("label: '打开资源台'")
    && GP_FILE.includes("label: '打开方向台'") && GP_FILE.includes("label: '打开回收站'") && GP_FILE.includes("label: '打开使用手册'");
});
check('R158-8 矩阵门禁常驻复核：R158 后 entry-matrix 仍零退出（宿主迁移漂移已被对账抓过一次——dormant-scan 锚 aiDormantScan→aiAdviceRun、cross-deck/thesis-drift 宿主随迁 GlobalPopups；R169-EB：实跑通道改 runGateSync，判据不变）', () => {
  const r = runGateSync(path.join(SCRIPTS_DIR, 'entry-matrix.cjs'));
  return r.status === 0;
});

// ============== R159 · V3.2.5：信任层（全局撤销 / AI 采纳快照 / 落盘状态 / 错误下一步 / 键字典） ==============
console.log('【R159 · V3.2.5：信任层】');
check('R159-1 全局撤销：undo.ts（9s 窗口 + 栈 + 输入框不拦截）+ toast 自动入栈 + App 安装', () => { const u = read('/shared/utils/undo.ts'); const t = read('/shared/components/toast.ts'); const a = read('/newtab/App.vue'); return u.includes('export const UNDO_WINDOW_MS = 9000') && u.includes('export function pushUndo(') && u.includes('export function runLastUndo(') && u.includes('export function installGlobalUndo(') && u.includes("t.tagName === 'INPUT'") && t.includes('pushUndo(msg, act.cb)') && t.includes('UNDO_WINDOW_MS') && a.includes('installGlobalUndo((m) => showToast(m))'); });
check('R159-2 批量回执固定：isBatchMsg 判定 + sticky 不自动消失 + Toast ✕ 关闭', () => { const t = read('/shared/components/toast.ts'); const v = read('/shared/components/Toast.vue'); return t.includes('function isBatchMsg(') && t.includes('const sticky = opts?.sticky ?? (!!act && isBatchMsg(msg))') && t.includes('if (duration <= 0) { timers.delete(it.id); return }') && v.includes('v-if="t.sticky" class="toast-x"'); });
check('R159-3 AI 采纳快照：采纳前压整库 JSON 进撤销栈 + Toast 撤销可回退', () => { const d = read('/newtab/components/AiSuggestionDrawer.vue'); return d.includes('const store = useAppStore()') && d.includes('const snap = JSON.stringify(store.data)') && d.includes('pushUndo(`AI 采纳（${sel.length} 项）`') && d.includes('store.data = JSON.parse(snap); store.persist()'); });
check('R159-4 落盘状态可见：repository SaveState 订阅（saving/saved/error）+ 顶栏状态点', () => { const r = read('/shared/storage/repository.ts'); const a = read('/newtab/App.vue'); return r.includes("export type SaveState = 'idle' | 'saving' | 'saved' | 'error'") && r.includes('export function subscribeSaveState(') && r.includes("emitSaveState('saving')") && r.includes("emitSaveState('saved')") && r.includes("emitSaveState('error')") && a.includes('subscribeSaveState((s) =>') && a.includes('class="save-dot"') && a.includes('.save-dot.saving {'); });
check('R159-5 错误态带下一步动作：quota → 一键清理回收站（/recycle）', () => { const a = read('/newtab/App.vue'); return a.includes("? { label: '清理回收站', cb: () => { clearLastSaveError(); navigate('/recycle') } }") && a.includes(": { label: '查看', cb: () => { clearLastSaveError(); navigate('/settings?page=about') } }"); });
check('R159-6 存储键字典：keys.ts 唯一真源 + 全仓裸字面量即红（扫描 src，仅 keys.ts 允许）', () => { const fs2 = require('fs'); const path2 = require('path'); const root = path2.resolve(SCRIPTS_DIR, '..', 'src'); const hits = []; const walk = (d) => { for (const f of fs2.readdirSync(d)) { const p = path2.join(d, f); const st = fs2.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|vue)$/.test(f)) { const s = fs2.readFileSync(p, 'utf8'); if (/['"](zy_[a-z0-9_]+|lm_data_v5[a-z_]*)['"]/.test(s)) hits.push(p.replace(/\\/g, '/')); } } }; walk(root); const only = hits.every((h) => h.endsWith('shared/storage/keys.ts')); const k = read('/shared/storage/keys.ts'); return only && hits.length === 1 && k.includes("DATA: 'zy_data_v2'") && k.includes("UI: 'zy_ui_v2'") && k.includes("EVENT_LOG: 'zy_event_log'") && k.includes("LEGACY: ['lm_data_v5', 'lm_data_v5_backup']"); });
check('R159-7 遗留键清理：cleanupLegacyKeys（幂等移除 V1 键）+ 启动接线', () => { const r = read('/shared/storage/repository.ts'); const a = read('/newtab/App.vue'); return r.includes('export function cleanupLegacyKeys()') && r.includes('chromeStore()?.remove([...K.LEGACY])') && a.includes('cleanupLegacyKeys()'); });

// ============== R160（A 批） · 性能收口：拼音两层表 / RENDER_STEP / 深链保全 ==============
console.log('【R160-A · 性能收口（拼音两层表 · RENDER_STEP 32 · 深链保全）】');
check('R160-1 拼音两层表替换 pinyin-pro：生成物 + 运行时零依赖（isPinyinReady 恒就绪）（★R4-Da 随迁备案：本条末锚原先借全景右栏的 const PAN_RENDER_STEP = 32 作「运行时调用点在场」的旁证，🗺 全景整页退役后那一行随之消失——判据换成拼音仍然在跑的三个真实调用点（全局搜索浮层 GlobalPopups / 网页浮层 overlay-impl / 方向树 CompassTree 都 import 并调 matchPinyin + isPinyinReady），同时把 PAN_RENDER_STEP 转成 codeOnly 零命中的退役判据防回流；增量渲染 32 档由 R160-3 继续守 useResourceView，不在此条松口）', () => { const t = read('/shared/utils/pinyinTable.ts'); const p = read('/shared/utils/pinyin.ts'); const gc = codeOnly(read('/newtab/views/GlobalSettings.vue')); const gp = read('/newtab/components/GlobalPopups.vue'); const ov = read('/content/overlay-impl.ts'); const ct = read('/newtab/views/CompassTree.vue'); return t.includes('export const INITIALS =') && t.includes('export const FULLS =') && t.includes('export const PINYIN_RANGE_START') && !p.includes("from 'pinyin-pro'") && !p.includes("import('pinyin-pro')") && p.includes('export function isPinyinReady(): boolean {') && p.includes('return true') && !gc.includes('const PAN_RENDER_STEP = 32') && gp.includes("import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'") && gp.includes('const pinyinReady = ref(isPinyinReady())') && gp.includes('matchPinyin(r.title, p)') && ov.includes("matchPinyin(r.title || '', kw)") && ct.includes('const pinyinOn = ref(isPinyinReady())'); });
check('R160-2 全仓去 pinyin-pro 运行时引用 + 生成脚本入库', () => { const fs2 = require('fs'); const path2 = require('path'); const root = path2.resolve(SCRIPTS_DIR, '..', 'src'); const hits = []; const walk = (d) => { for (const f of fs2.readdirSync(d)) { const p = path2.join(d, f); const st = fs2.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|vue)$/.test(f)) { const s = fs2.readFileSync(p, 'utf8'); if (/from 'pinyin-pro'|import\('pinyin-pro'\)|require\('pinyin-pro'\)/.test(s)) hits.push(p.replace(/\\/g, '/')); } } }; walk(root); const gen = fs2.existsSync(path2.resolve(SCRIPTS_DIR, '..', 'scripts', 'gen-pinyin-table.cjs')); return hits.length === 0 && gen; });
check('R160-3 增量渲染份额收紧：列表/卡片 RENDER_STEP=32（原 80）', () => { const u = read('/newtab/composables/useResourceView.ts'); return u.includes('const RENDER_STEP = 32') && u.includes('renderLimit.value += RENDER_STEP'); });
check('R160-4 A7 深链保全：main.ts 不再强制回首页（全路由保留）', () => { const m = read('/newtab/main.ts'); return m.includes('R160（A7）深链保全') && !m.includes("router.replace('/')"); });
check('R160-5 ★P1 懒挂载：GlobalPopups defineAsyncComponent + 首次呼出才挂载（gpOpen 收口，热键/顶栏/消息/问号四处全走）· 面板在 chunk 就绪后自动打开', () => { const a = read('/newtab/App.vue'); return a.includes("defineAsyncComponent(() => import('./components/GlobalPopups.vue'))") && a.includes('const gpMounted = ref(false)') && a.includes('watch(globalPopups, (v) => { if (v && pendingPanel)') && !a.includes("globalPopups.value?.openPanel") && !a.includes("globalPopups?.openPanel") && a.includes('<GlobalPopups v-if="gpMounted" ref="globalPopups" />') });
check('R160-6 ★P1 懒挂载：详情抽屉 defineAsyncComponent + 首个 bus 事件挂载 + setPendingDrawer/consumePendingDrawer 回放（异步 chunk 加载期间不丢事件）', () => { const a = read('/newtab/App.vue'); const b = read('/shared/utils/bus.ts'); const d = read('/newtab/components/ResourceDetailDrawer.vue'); return a.includes("defineAsyncComponent(() => import('./components/ResourceDetailDrawer.vue'))") && a.includes('setPendingDrawer(p)') && a.includes('<ResourceDetailDrawer v-if="detailDrawerMounted" />') && b.includes('export function consumePendingDrawer') && d.includes('const p = consumePendingDrawer(); if (p) onBus(p)') });
check('R160-7 ★P1 懒挂载：Airtable 同步器动态 import（仅真正同步时加载，入口零静态引用）', () => { const a = read('/newtab/App.vue'); return !a.includes("import { runSync } from '@/shared/storage/airtable'") && a.includes("const { runSync } = await import('@/shared/storage/airtable')") });
check('R160-8 ★P6 boot 四键同批读：main 一次 get（主数据+V1+热度+UI）· loadData 复用热度键不再补读 · loadUIPrefs(prefetchedUI) 省一次往返', () => { const m = read('/newtab/main.ts'); const r = read('/shared/storage/repository.ts'); return m.includes('cs.get([STORAGE_KEY, K.LEGACY[0], HOT_KEY, UI_KEY])') && m.includes('loadUIPrefs(boot.ui)') && r.includes('prefetched[HOT_KEY] !== undefined ? prefetched : await cs.get([HOT_KEY])') && r.includes('loadUIPrefs(prefetchedUI?: unknown)') });
check('R160-9 ★P5 写盘合并：整库 set 同批带热度键与待写事件日志（1 次 IPC）· 日志内存缓存 + 冷路径自愈落盘 + 外部写入刷缓存', () => { const r = read('/shared/storage/repository.ts'); const e = read('/shared/utils/eventLog.ts'); return (r.match(/\[HOT_KEY\]: extractHot\(cache!?\)/g) || []).length === 2 && r.includes('...(takeEventLogPatch() || {})') && !r.includes('writeHot(cache)') && e.includes('export function takeEventLogPatch') && e.includes('let logCache: CardEvent[] | null = null') && e.includes('export function initEventLog') && e.includes('flushEventLogNow') });

// ============== R162 · 挂载关系退役 / 附件链路修复 / AI 标签优先复用 ==============
console.log('【R162 · 挂载退役 · 附件修复 · AI 标签复用】');
check('R162-1 ★任务↔资源挂载关系整体退役：模型零字段 + 全仓零业务引用（仅 models 注释/迁移读型/存储清理器允许）+ 详情两处区块退役', () => {
  const fs2 = require('fs'); const path2 = require('path'); const root = path2.resolve(SCRIPTS_DIR, '..', 'src'); const hits = [];
  const allow = ['shared/models/index.ts', 'shared/storage/migration.ts', 'shared/storage/repository.ts'];
  const walk = (d) => { for (const f of fs2.readdirSync(d)) { const p = path2.join(d, f); const st = fs2.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|vue)$/.test(f)) { const s = fs2.readFileSync(p, 'utf8'); if (s.includes('mountedResourceIds') && !allow.some(a => p.replace(/\\/g, '/').endsWith(a))) hits.push(p); } } };
  walk(root);
  const m = read('/shared/models/index.ts');
  const ref = read('/newtab/components/ResourceEditForm.vue');
  const td = read('/newtab/components/compass/TaskDetailDrawer.vue');
  return hits.length === 0 && !m.includes('mountedResourceIds: ID[]') && !ref.includes('mountedTasks') && !td.includes('挂载资源卡') && !td.includes('toggleMountResource');
});
check('R162-2 ★附件串卡修复：两处宿主单例清键（resetEditing）+ emptyResource 带 assets', () => {
  const a = read('/newtab/composables/useResourceDrawer.ts'); const b = read('/newtab/components/ResourceDetailDrawer.vue');
  return a.includes('function resetEditing(target: ResourceCard, src: ResourceCard)') && (a.match(/resetEditing\(editingResource/g) || []).length === 4 && a.includes('updatedAt: 0, assets: [] }') && b.includes('function resetEditing(src: ResourceCard)') && b.includes('updatedAt: 0, assets: [] }');
});
check('R162-3 ★附件双击打开：行级 dblclick + 去抖；打开通道按文件权限分流（isAllowedFileSchemeAccess → file:// / downloads.open → 系统程序）', () => {
  const am = read('/shared/components/AssetManager.vue'); const ab = read('/shared/components/AssetBadge.vue'); const h = read('/shared/utils/htmlAsset.ts');
  return am.includes('function openAssetOnce(meta: AssetMeta)') && am.includes('@dblclick="openAssetOnce(a)"') && ab.includes('@dblclick="openAsset(a)"') && h.includes('function isFileAccessAllowed()') && h.includes('function openDownloaded(id: number)') && h.includes('isAllowedFileSchemeAccess') && h.includes('dl.open(id)');
});
check('R162-4 ★AI 标签优先复用：词表带父/子路径 + 批量/优化提示词硬指令 + canonicalTagsOf 归一（R167 重指：单卡侧两枚工厂并一枚，"三处 parse"改为**按写库文件各自核**——资源 enrich 与任务 enrich 都要 parse 归一 + apply 归一成对出现，批量在设置页；缺一处就是"某一入口写脏标签"的入口）', () => {
  const p = read('/shared/ai/project.ts'); const s = read('/shared/ai/scenarios.ts'); const sel = read('/shared/ai/select.ts'); const te = read('/shared/ai/taskEnrich.ts'); const gs = read('/newtab/views/GlobalSettings.vue'); const tg = read('/shared/utils/tags.ts');
  return tg.includes('export function canonicalTagOf(') && tg.includes('export function canonicalTagsOf(') && p.includes("prefix + '/' + n.name") && s.includes('优先复用给定标签词表中的写法（含「父/子」路径）') && s.includes('**优先从材料里的【现有标签词表】选**')
    && (sel.match(/canonicalTagsOf\(/g) || []).length === 2 && (te.match(/canonicalTagsOf\(/g) || []).length === 2
    && gs.includes('canonicalTagsOf(d,') && gs.includes('canonicalTagsOf(dd,');
});
check('R162-5 详情底部不再挤压（R165-A 重指：页脚收敛两钮后不再五钮争行 · R167 再重指：AI 入口不再挤页脚/标题行，改为等宽两格 + 说明行禁折行走省略号）：Workspace 动作钮禁折行+最小宽度在位 + Drawer 页脚允许折行 + AI 行省略号在位 + RDD 保存钮禁折行 + 二次确认钮禁折行', () => {
  const css = read('/newtab/views/workspace.css'); const d = read('/shared/components/Drawer.vue'); const ds = read('/shared/styles/detail-sheet.css'); const rdd = read('/newtab/components/ResourceDetailDrawer.vue'); const arm = read('/shared/components/ArmDeleteButton.vue');
  return css.includes('white-space: nowrap; min-width: 84px;') && !css.includes('.dr-footer-btn.ai {') && ds.includes('.ds-ai-cell .tx small') && ds.includes('text-overflow: ellipsis') && d.includes('flex-wrap: wrap') && rdd.includes('white-space: nowrap') && arm.includes('white-space: nowrap');
});

/* ===== R163 · 生成物防腐化 ===== */
check('R163-1 ★代码索引是生成物，不许漂：调 gen-code-index.cjs --check 与 src/ 实际结构逐项比对（缺项 / 死引用 / 行数·职责·导出符号变了都算漂），漂移即红并点名要重跑的命令 · 立这条的当天就自证了价值：首次运行抓到 31 项过期（R160/R162 改完代码没重跑生成器，索引里全是错行号，外部评审模型照着下判断必然错判）', () => {
  const { execFileSync } = require('child_process')
  try {
    execFileSync(process.execPath, [path.join(SCRIPTS_DIR, '..', 'scripts', 'gen-code-index.cjs'), '--check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return true
  } catch (e) {
    const detail = String((e && (e.stderr || e.stdout)) || e.message || e).split('\n').filter(Boolean).slice(0, 3).join(' ⏐ ')
    throw new Error(detail.slice(0, 300))
  }
});

// ============== R164 · 度量与刹车（CRLF 门禁修复 / 增长门禁 / 键边界 / 依赖纪律 / 生成物二期 / A1 触发） ==============
console.log('【R164 · 度量与刹车】');
check('R164-1 ★代码索引门禁 CRLF 双修：索引读取归一化 + 脚本体积按 LF 计算（Windows checkout 不再 171 项全量误报）', () => { const g = read('/../scripts/gen-code-index.cjs'); return g.includes('R164') && g.includes('Buffer.byteLength') && (g.match(/CRLF/g) || []).length >= 1 && (g.match(/replace\(\/\\r\\n\/g/g) || []).length >= 2; });
check('R164-2 ★增长门禁（R172-T8/T9 重指并**收紧**：GlobalSettings 3,575→3,560 —— 记录条与筛选/明细实现整体迁入 `DashboardLogDrawer.vue`、复盘段抽 `ReviewPanel.vue`，宿主净减约 40 行却只回收 15 行余量，剩下的余量留给 T11 的 AI 报告挂载）+ regression 行数门禁随 R174-1 分片随迁带备案：原「单文件 ≤5,500 行（超限即红并提示分片评估）」在分片落地后改判**每个分片文件（含 runner）≤900 行**——分片是搬运不是重写，断言只增不减的纪律不变，刹车从「总量」改为「单片」（04-65 拍板 4 的分片处置到此兑现）', () => { const gs = read('/newtab/views/GlobalSettings.vue').split('\n').length; const regDir = path.join(ANCHOR_FILE, '..'); const files = fs.readdirSync(regDir).filter(f => f.endsWith('.cjs')).map(f => fs.readFileSync(path.join(regDir, f), 'utf8').split('\n').length); const runner = fs.readFileSync(path.resolve(ANCHOR_FILE, '..', '..', 'regression.cjs'), 'utf8').split('\n').length; const max = Math.max(...files, runner); if (max > 900) console.error('   ⚠ 回归分片单片破 900 行 → 评估再分片（R174-1 分片门禁）'); return gs <= 3560 && max <= 900; });
check('R164-3 配额文案括号配对：App.vue 保存失败 toast 补齐右括号 + 破文案（无右括号版）零残留', () => { const a = read('/newtab/App.vue'); return a.includes('），请清理或导出后重试') && !a.includes('${sz}，请清理或导出后重试'); });
check('R164-4 ★键边界（A3）：K 只装 storage 键；IDB_NAMES / EXPORT_MARKERS 另立（非存储命名空间）', () => { const k = read('/shared/storage/keys.ts'); const a = read('/shared/storage/assets.ts'); const g = read('/newtab/views/GlobalSettings.vue'); const kBody = k.slice(k.indexOf('export const K'), k.indexOf('export const IDB_NAMES')); return k.includes('export const IDB_NAMES') && k.includes('export const EXPORT_MARKERS') && k.includes("ASSETS: 'zy_assets'") && k.includes("ASSET_PACK: 'zy_asset_pack'") && !kBody.includes('ASSETS_DB') && !kBody.includes('ASSET_PACK') && a.includes('IDB_NAMES.ASSETS') && !a.includes('K.ASSETS_DB') && g.includes('EXPORT_MARKERS.ASSET_PACK') && !g.includes('K.ASSET_PACK'); });
check('R164-5 ★依赖纪律：pinyin-pro 不进 dependencies（生成器专用 devDependency）+ 生成器仍可复现', () => { const pkg = JSON.parse(fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'package.json'), 'utf8')); const g = read('/../scripts/gen-pinyin-table.cjs'); return !(pkg.dependencies && pkg.dependencies['pinyin-pro']) && !!(pkg.devDependencies && pkg.devDependencies['pinyin-pro']) && g.includes("require('pinyin-pro')"); });
check('R164-6 ★生成物防腐化二期：pinyinTable.ts 漂移即红（--check 与代码索引同法，含 CRLF 归一化；R169-EB：实跑通道改 runGateSync，判据不变）', () => { const g = read('/../scripts/gen-pinyin-table.cjs'); if (!(g.includes('--check') && g.includes('已漂移'))) return false; const r = runGateSync(path.resolve(SCRIPTS_DIR, '..', 'scripts', 'gen-pinyin-table.cjs'), ['--check']); return r.status === 0; });
check('R164-7 A1 触发门禁（记录型）：写盘 >50ms 或主数据 >2MB → perf 提示「启动分域评估」（ADR-02 复审条件量化）', () => { const p = read('/../scripts/perf.cjs'); return p.includes('分域评估') && p.includes('a1M6b > 50') && p.includes('a1Kb > 2048') && p.includes("A1_分域评估触发"); });
check('R164-8 M3 改名「合成压力测试」：不再冒充用户体感口径（真实路径走 --real）', () => { const p = read('/../scripts/perf.cjs'); return p.includes('M3_合成压力测试_交互期长任务总计(ms)') && p.includes('用户体感口径 = M14 + 掉帧'); });
check('R164-9 ★perf --real 真实路径模式在位：R1~R7 指标（冷启动/冷挂/单击/视图/滚动/真库 M14/搜索）+ 报告 scale=real（R173-T2 重指备案：R3 由「click() 同步段 0.4ms」改「点击→抽屉出现」墙钟口径 + __openDetailWall）', () => { const p = read('/../scripts/perf.cjs'); return p.includes('--real=') && p.includes('R1_冷启动_首页可交互(ms)') && p.includes('R2_冷挂资源台_墙钟(ms)') && p.includes('__openDetailWall') && p.includes('R3_开详情_点击到抽屉ms') && p.includes('R5_滚动掉帧数') && p.includes('R6_真库首屏可见节点') && p.includes('R7_全局搜索键入6字净耗时(ms)') && p.includes("out.scale = 'real'"); });

// ============== R165-A · 三卡详情页重设计（方案 A 标准落地：AI 进标题行三态 / 页脚两钮 / 动作贴对象） ==============
console.log('【R165-A · 三卡详情重设计（方案 A）】');
check('R165-A1 ★统一标准（R167 重指：AI 主上下文入口由"标题行"下沉到**正文首行独立成行** .ds-ai-cell；主标题只在抽屉头一处）：三抽屉页脚零 AI 钮 + 格数按卡种钉（任务 3 / 资源 2 / 好奇 1）+ 资源正文零第二份标题框（评审抽屉不受限）', () => {
  const f = read('/newtab/components/ResourceEditForm.vue'); const st = read('/newtab/components/ResourceAiStrip.vue');
  const r = read('/newtab/components/ResourceDetailDrawer.vue'); const w = read('/newtab/views/Workspace.vue');
  const t = read('/newtab/components/compass/TaskDetailDrawer.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue');
  const footAi = (s, seg) => { const i = s.indexOf(seg); return i >= 0 && /<AiEntryButton|CardAiEntry|ResourceAiStrip|ds-ai-cell/.test(s.slice(i, i + 700)); };
  return !f.includes('name="title-extra"') && !f.includes('ref-title-row') && !f.includes('hideTitle')
    && st.includes('class="ds-ai-strip"') && (st.match(/class="ds-ai-cell"/g) || []).length === 2
    && r.includes('<ResourceAiStrip') && r.includes('<DetailTitle') && !footAi(r, '<template #footer>')
    && w.includes('<ResourceAiStrip') && w.includes('<DetailTitle') && !footAi(w, '<div class="dr-footer">')
    && t.includes('ts-head-row') && t.includes('ts-ai-row') && (t.match(/class="ts-ai-cell"/g) || []).length === 3 /* R166 定案 6：三入口独立行等宽三格 */ && t.includes('@click="aiBreakdown"') && !footAi(t, '<div class="ts-foot">')
    && c.includes('ds-ai-strip one') && (c.match(/class="ds-ai-cell"/g) || []).length === 1 && c.includes('aiTriage(detailItem)') && !footAi(c, '<template #footer>');
});
check('R165-A2 ★页脚两钮收敛（四宿主）：ArmDeleteButton + 唯一 primary 提交；旧页脚动作（复制链接/拆解步骤/研判/置顶/转化/ghost 直删）全部出页脚', () => {
  const r = read('/newtab/components/ResourceDetailDrawer.vue'); const w = read('/newtab/views/Workspace.vue');
  const t = read('/newtab/components/compass/TaskDetailDrawer.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue');
  const seg = (s, a, b) => { const i = s.indexOf(a); const j = b ? s.indexOf(b, i) : s.length; return s.slice(i, j >= 0 ? j : undefined); };
  const rf = seg(r, '<template #footer>', '</Drawer>'); const wf = seg(w, '<template #footer>', '</Drawer>'); const tf = seg(t, '<div class="ts-foot">', '</div>\n    </div>'); const cf = seg(c, '<template #footer>', '</Drawer>');
  return [r, w, t, c].every(s => s.includes('ArmDeleteButton')) && [rf, wf, tf, cf].every(s => s.includes('ArmDeleteButton'))
    && !rf.includes('复制链接') && !wf.includes('🔗 复制链接') && !tf.includes('拆解步骤') && !tf.includes('ts-del-ghost') && !cf.includes('转为任务') && !cf.includes('研判') && !cf.includes('置顶');
});
check('R165-A3 二次确认删除单实现：armed 文案/3s 回落/卸载清定时器只在 ArmDeleteButton，四宿主零复制', () => {
  const arm = read('/shared/components/ArmDeleteButton.vue');
  return arm.includes('确认删除？（进回收站）') && arm.includes('3000') && arm.includes('onUnmounted')
    && !read('/newtab/components/ResourceDetailDrawer.vue').includes('确认删除？') && !read('/newtab/views/Workspace.vue').includes('确认删除？')
    && !read('/newtab/components/compass/TaskDetailDrawer.vue').includes('确认删除？') && !read('/newtab/components/compass/CuriosityPanel.vue').includes('确认删除？');
});
check('R165-A4 三态凭据全链：aiTouchedAt 上移 CardBase（三卡共用零迁移）+ 每枚写入口各自落戳（R167 重指：改为**按文件点名六处**，不再用"select×2"这种按次数记账——并入口之后次数会变、"谁没盖戳"不会）+ 凭据可见两条通道都在位（任务抽屉 AiTouchedChip ／ 资源与好奇 AI 行尾「最近 ·」），chip 组件本体走真源零 emoji', () => {
  const m = read('/shared/models/index.ts'); const chip = read('/shared/components/AiTouchedChip.vue'); const st = read('/newtab/components/ResourceAiStrip.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue'); const t = read('/newtab/components/compass/TaskDetailDrawer.vue')
  const base = m.slice(m.indexOf('export interface CardBase'), m.indexOf('export interface ResourceCard'))
  const missing = ['select.ts', 'resourceLinkTask.ts', 'batchG.ts', 'chain.ts', 'taskEnrich.ts', 'taskSupport.ts'].filter(f => !read('/shared/ai/' + f).includes('aiTouchedAt = Date.now()'))
  return base.includes('aiTouchedAt?: number') && !m.slice(m.indexOf('export interface ResourceCard')).includes('aiTouchedAt?: number')
    && missing.length === 0
    && chip.includes('AiEntryButton') && !chip.includes('🤖') && t.includes('AiTouchedChip')
    && st.includes('ds-ai-when') && c.includes('ds-ai-when')
});
check('R165-A5 动作跟着对象走：三卡链接/来源行自带 ↗/⧉（R167 重指：两宿主链接行统一用 .ds-ib；好奇 `.cz-src-row` 随分组面板退役，动作改住「来源与标签」面板的来源行）', () => {
  const f = read('/newtab/components/ResourceEditForm.vue'); const r = read('/newtab/components/ResourceDetailDrawer.vue'); const w = read('/newtab/views/Workspace.vue');
  const t = read('/newtab/components/compass/TaskDetailDrawer.vue'); const c = read('/newtab/components/compass/CuriosityPanel.vue');
  return f.includes('name="link-actions"') && !f.includes('ref-link-row') && r.includes('#link-actions') && r.includes('class="ds-ib"') && w.includes('#link-actions') && w.includes('class="ds-ib"')
    && t.includes('ts-link-row') && t.includes('openTaskLink') && t.includes('copyTaskLink')
    && c.includes('copySourceUrl') && c.includes('openSourceUrl(detailItem.sourceUrl)') && (c.match(/class="ds-ib"/g) || []).length === 2
});
check('R165-A6（R167 重指）好奇详情五件：① 流转双入口进「流转与凭证」面板（弹窗链路不变，openConvert(detailItem 恰两处）；② ★转化即离场——转任务/归档资源即软删出池并记 convertedAt+convertedTo，池头「已转化」计数补上（卡一走池里数不到它，产出必须换地方记账），回收站恢复=撤销这次转化；③ 详情可删（ArmDeleteButton）；④ Hero 正名「问题原文」（实绑 question，editDraft 通道不变）；⑤ 置顶不在详情重复（卡面悬停角标与右键都有，详情再放一份就是第三个入口）', () => {
  const c = read('/newtab/components/compass/CuriosityPanel.vue'); const cp = read('/newtab/stores/curiosity.ts'); const rb = read('/newtab/views/RecycleBin.vue'); const md = read('/shared/models/index.ts')
  return (c.match(/openConvert\(detailItem/g) || []).length === 2 && c.includes('cz-converted') && c.includes('convertedCount')
    && c.includes('@confirm="detailItem && deleteCard(detailItem)"') && c.includes('问题原文') && c.includes('v-model="editDraft"')
    && !c.includes('.cz-pin-btn {') && !c.includes('class="cz-flow-btn"') && c.includes('cz-pin-corner') && c.includes('从池中离场')
    && cp.includes("c.convertedTo = 'task'") && cp.includes("c.convertedTo = 'res'") && md.includes('convertedTo?:') && rb.includes('convertedAt')
});
check('R165-A7 任务详情优先级 3 段 segment（单击直达，语义色 tint 过对比度）+ 项目/指标级联双列保留', () => {
  const t = read('/newtab/components/compass/TaskDetailDrawer.vue');
  return t.includes('ts-prio') && t.includes('data-p="high"') && t.includes('color-mix(in srgb, var(--warning) 16%') && !t.includes('selectedTask.priority" @change')
    && t.includes('onSelProjectChange') && t.includes('onSelMetricChange');
});

// ============== R165-A 补漏（V3.4.3 · 门禁诚实性三项） ==============
console.log('【R165-A 补漏 · 门禁自己得真的跑、真的判】');
check('R165-A8 ★实跑入口字面量门禁：node scripts/entry-literals.cjs 必须零退出。此前 R151-7 只验"脚本存在且写着这些字"、从不跑它 ⇒ R159 键边界引入的红潜伏了一整轮（R164/R165-A 都没跑），全绿通过验收。从本轮起它与 entry-matrix / theme-contrast 同级常驻实跑（R169-EB：实跑通道改 runGateSync，判据不变）', () => {
  const r = runGateSync(path.join(SCRIPTS_DIR, 'entry-literals.cjs'));
  if (r.status !== 0 && process.env.VERBOSE) console.log('\n' + (r.stdout || '') + (r.stderr || ''));
  return r.status === 0;
});
check('R165-A9 ★键字典豁免面钉死：只认「两个 AI 键名 × 只在 keys.ts」。R165-A 原写法是"keys.ts 里任何字面量都免"——真 AI 逻辑（batchG/semanticSearchSystem）若落进 keys.ts 会被宽豁免放过去。豁免清单变长 / 不再要求文件等于键字典 / aiEdges 托底判据被删，任一即红', () => {
  const g = read('/../scripts/entry-literals.cjs')
  const only = (g.match(/const KEY_NAME_ONLY = \[[^\]]*\]/) || [''])[0]
  return (only.match(/'zy_/g) || []).length === 2 && only.includes("'zy_ai_v1'") && only.includes("'zy_ai_directives_v1'")
    && g.includes('KEY_NAME_ONLY.includes(l)') && g.includes('const KEY_REGISTRY = path.join(SRC') && g.includes('const exempt = (l, f) =>')
    /* 豁免比较必须走绝对路径：R165-A 那版用 path.relative 的字符串比，Windows 反斜杠下静默失效（见脚本内备案） */
    && !/path\.relative\([^)]*\)\s*===\s*['"]src\//.test(g)
    && g.includes('aiEdges.length') && /process\.exit\(fail \? 1 : 0\)/.test(g)
});
check('R165-A10 ★视觉走查覆盖到"本轮真正改的那一面"：theme-audit 必须含三张卡详情场景，且判据不是空转——DRAWER_VIEWS 三条各自带 开/AI在标题行/页脚钮数 三条现场判据，任一不过要能进 drawerFail 并参与退出码，图数下限也要把这三条算进去（否则"少抓一面"会静默通过）', () => {
  const g = read('/../scripts/theme-audit.cjs')
  return (g.match(/id: 'drawer-(resource|task|curio)'/g) || []).length === 3
    && g.includes('const drawerFail = []') && g.includes('drawerFail.push') && g.includes('if (drawerFail.length)')
    && g.includes('DRAWER_VIEWS.length') && g.includes("footCount === 2") && g.includes("'[data-tid]'")
});
check('R165-A11 ★手册宣传面与功能现状对账：已退役能力不得留在使用手册里（「🤖 推荐卡」R162 已整体退役、代码全仓零命中，手册却仍挂着这句假承诺四轮）；AI 入口位置措辞须随版式（R165-A 标题行 → R166 任务三入口独立行 → R167 「AI 入口行」）· R167 备案：本条原把"标题行右侧"钉成合格判据，正是它让手册在版式再迁一次后仍显绿——判据改为**只认现行版式词，且旧位置词出现即红**', () => {
  const m = read('/newtab/manual-data.ts')
  return !m.includes('推荐卡') && !m.includes('按任务挂资源')
    && m.includes('AI 入口行') && m.includes('三格独立行') && m.includes('转化即离场')
    && !m.includes('标题行右侧') && !m.includes('详情抽屉页脚') && !m.includes('任务详情底部')
    /* 手册说的两枚资源入口必须真有对应实现，否则"入口地图"本身就成假承诺 */
    && m.includes('关联任务') && read('/newtab/components/ResourceAiStrip.vue').includes('关联任务')
});

// ============== R166 · 任务卡×子任务×AI 三入口×资源支持 ==============
console.log('【R166 · 子任务内嵌 / SupportLink 独立表 / 三入口独立行 / 拆解改向】');
check('R166-1 ★三入口独立行（定案 6）：任务详情头部三行——勾选+标题+关闭 / AI 三格等宽独立行 / 状态·成熟度·子任务·凭据；三枚共用一把 aiBusy 互斥锁（同时只跑一个，点了没反应一直等是最难查的"卡"）；页脚仍是 ArmDeleteButton + 主钮两枚不回退', () => {
  const t = read('/newtab/components/compass/TaskDetailDrawer.vue')
  return (t.match(/class="ts-ai-cell"/g) || []).length === 3 && (t.match(/:spin="aiBusy"/g) || []).length === 3
    && t.includes('ts-ai-row')
    && t.includes("const aiEnrich = () => runAi('enrich')") && t.includes("const aiBreakdown = () => runAi('breakdown')")
    && t.includes("const aiSupport = (subId?: string) => runAi('support', subId)") && t.includes('if (!t || aiBusy.value) return')
    && t.includes('<ArmDeleteButton')
});
check('R166-2 ★SupportLink 域契约（定案 5）：同一 (task,sub,resource) 不重复挂；解绑只删这一条记录、两端本体一律不动；purge 只服务硬删（软删靠索引过滤隐藏，恢复即回挂）；索引一次建、两端任一软删即不进表；纯函数零 UI 依赖', () => {
  const u = read('/shared/utils/supportLinks.ts')
  return u.includes('export function addSupportLink') && u.includes('if (list.some(same)) return { dup: true }')
    && u.includes('export function removeSupportLink') && u.includes('list.splice(i, 1)')
    && u.includes('export function purgeSupportLinks') && !u.includes('deletedAt = Date.now()')
    && u.includes('if (!l || !liveTask.has(l.taskId) || !liveRes.has(l.resourceId)) continue')
    && u.includes('if (l.subId && liveSub.get(l.subId) !== l.taskId) continue')
    && !u.includes('useAppStore') && !u.includes('@/newtab/')
});
check('R166-3 ★找资源支持两段式（F4）：本地按词面/标签预筛取 top N 并排除已关联，模型只做排序+一句判词；无判词或非 high 置信一律判弱默认不勾；点名不存在的卡计入消毒账；采纳只写关联表——任务与资源两张卡本体零改动', () => {
  const j = read('/shared/ai/taskSupport.ts')
  return j.includes('function prefilter(') && j.includes('exclude.has(r.id)') && j.includes('linkedResourceIds(buildSupportIndex(d), task.id)')
    && j.includes('CANDIDATE_CAP') && j.includes("from: 'ai'")
    && j.includes('weak: !why || it.confidence') && j.includes('drop.ghost++')
    && j.includes('export function buildTaskSupportJob')
    && !j.includes('live.title =') && !j.includes('live.tags =') && !j.includes('task.description =') && !j.includes('task.subtasks =')
});
check('R166-4 ★任务补全"已填不覆盖"（F5）：说明里已有验收标准就不再建议；归属建议判弱默认不勾（替用户乱挂归属=替他做决策）；R147-4 新词闸同装（第三个单卡写库工厂不得漏）；估时只作提醒不写字段', () => {
  const e = read('/shared/ai/taskEnrich.ts')
  return e.includes('const hasAcceptance') && e.includes('if (acc && !descHasAcc)')
    && e.includes('低置信，勾了才改') && e.includes('freshTagsOf(cand, known)')
    && e.includes("badge: '新词', badgeType: 'warn', weak: true")
    && e.includes('__note: true') && e.includes('if (s.__note) continue')
    && e.includes('liveTarget(d, s.projectId, s.metricId)')
});
check('R166-5 ★子任务清单行为（定案 1/3 + F2）：改名走 input 失焦落库（不引 contenteditable 的粘贴与光标陷阱）；勾选只改本行 done；删除是数组过滤——清单行不是卡，无回收站无撤销；成熟度与周报零消费 subtasks（不计分）［R172-2 重指备案：勾选处随 `doneAt` 落时刻，字面量扩为 `{ ...x, done: !x.done, doneAt: … }`；断言本意「只改本行 done」不变。语义边界另注：`maturity.ts` / `ai/reports.ts` 仍零消费 subtasks（本断言原意），而 R172 新增的**年度加权分**按 04-67 §7.2 给子任务完成计 0.8——与定案 3 的张力已登记待拍板］', () => {
  const c = codeOnly(read('/shared/components/SubtaskList.vue')); const mt = read('/shared/utils/maturity.ts'); const rp = read('/shared/ai/reports.ts')
  return c.includes('@change="rename(s, $event)"') && c.includes('{ ...x, done: !x.done, doneAt:') && c.includes('write(list => list.filter(x => x.id !== s.id))')
    && !c.includes('contenteditable') && !c.includes('softDelete') && !c.includes('deletedAt')
    && !mt.includes('subtasks') && !rp.includes('subtasks')
});
check('R166-6 ★列表就地展开（F2）：胶囊带 ▾/▴ 且点击 stopPropagation（不顺手把详情抽屉也打开）；展开面板绝对定位浮在行下——改行高会让整列在展开瞬间重排、点击点跳走；写回走 writeSubtasks 随卡 persist', () => {
  const tp = read('/newtab/components/compass/TaskManagerPanel.vue')
  return tp.includes('@click.stop="toggleSubExpand(task.id)"') && tp.includes("'▴' : '▾'")
    && tp.includes('.trow-subs { position: absolute') && tp.includes('function writeSubtasks(t: TaskCard, v: Subtask[])')
    && tp.includes('const subExpanded = ref<Set<string>>(new Set())')
});
check('R166-7 ★资源侧只读反查（定案 10）：组件内**没有**解绑通道（removeSupportLink / persist 都不出现），只给"打开该任务归属页"这一读操作；两宿主共用同一组件不各写一套', () => {
  const sp = read('/shared/components/SupportTasksPanel.vue'); const rdd = read('/newtab/components/ResourceDetailDrawer.vue'); const ws = read('/newtab/views/Workspace.vue')
  return sp.includes('idx.byResource.get(props.resource.id)') && !sp.includes('removeSupportLink') && !sp.includes('store.persist')
    && rdd.includes('<SupportTasksPanel') && ws.includes('<SupportTasksPanel')
});
check('R166-8 ★Esc 分层关闭（定案 7）：AI 弹窗在场时抽屉的 document 级键盘监听必须让位——Modal 的 stopPropagation 挡不住**同一节点上更早注册**的监听，"一次 Esc 只关一层"在两层都挂 document 时不成立，故由下层主动 return', () => {
  const t = read('/newtab/components/compass/TaskDetailDrawer.vue')
  return t.includes('if (aiJob.value) return') && t.includes('function onSidebarDocKey')
    && read('/shared/components/Modal.vue').includes('e.stopPropagation()')
});
check('R166-9 ★采纳按钮说出后果（定案 8）：AiJob.adoptLabel 契约在位且抽屉优先用它；三枚各写各的——拆解「✓ 采纳为子任务」/ 找资源「✓ 关联为支持」/ 补全「✓ 采纳补全（写本卡）」，不再统一一句"采纳（直接写库）"把后果藏起来', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes('cur.value?.adoptLabel ||') && read('/shared/ai/job.ts').includes('adoptLabel?: string')
    && read('/shared/ai/chain.ts').includes("job.adoptLabel = '✓ 采纳为子任务'")
    && read('/shared/ai/taskSupport.ts').includes("adoptLabel: '✓ 关联为支持'")
    && read('/shared/ai/taskEnrich.ts').includes("adoptLabel: '✓ 采纳补全（写本卡）'")
});
check('R166-10 ★D9 单一编辑处：弹窗内角色下拉只跳设置页，不建第二套专家编辑器', () => {
  const w = read('/newtab/components/AiSuggestionDrawer.vue')
  return w.includes('gotoPersonaAdmin') && w.includes('#/settings?page=ai') && !w.includes('customPersonas.push')
});
check('R166-11 ★依赖锁自证：package-lock 每条 .tgz 依赖的 version 字段必须等于 tarball 里的版本（升版本禁"把旧版号全局换成新版号"）', () => {
  // 立因：R165-A 补漏 / R166 两次用"全局替换旧版本号"升六处，命中过 lock 里 consola 的 version 字段
  // （装的、resolved 的都是 3.4.2，字段却被连改成 3.4.3 → 3.5.0）。依赖版本是解析结果，不是产品版本，
  // 一旦被写脏，`npm ci` 与审计都对不上，而且**它长得像版本号，人眼扫过去只会当成已同步**。
  const lock = JSON.parse(fs.readFileSync(path.resolve(base, '..', 'package-lock.json'), 'utf8'))
  const bad = []
  for (const [dir, e] of Object.entries(lock.packages || {})) {
    if (!dir || !e.resolved || !e.resolved.endsWith('.tgz')) continue
    const m = /-((?:\d+)\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\.tgz$/.exec(e.resolved)
    if (m && m[1] !== e.version) bad.push(`${dir}: version=${e.version} ≠ tarball=${m[1]}`)
  }
  if (bad.length) throw new Error('与 tarball 不符：' + bad.join(' | '))
  return true
});