/**
 * R174-1 分片 · helpers：check/read/codeOnly/版本锚等断言基建唯一真源。
 * 由 regression.cjs 序言与中段顶层定义**原样搬出**（搬运不改写）；
 * 各分片 scripts/regression/*.cjs 经 require 取用，pass/fail 走 getTally()。
 * ★版本锚（VER_ANCHOR_LITERAL）物理居本文件——版本六处同步断言经 ANCHOR_FILE 读这里。
 */
/* 知源调度台 V2.64.0 回归验证矩阵（交付前必须全绿；当前 971 项）
 * 运行：node scripts/regression.cjs
 * 新增功能时同步在对应域追加检查项 */
const fs = require('fs');
const path = require('path');
// 以脚本自身位置定位 src/，项目搬到任何盘符或系统都能跑
const SCRIPTS_DIR = path.join(__dirname, '..'); // R174-1 分片：helpers 居 scripts/regression/，scripts 根用 SCRIPTS_DIR 锚定
const base = path.resolve(SCRIPTS_DIR, '..', 'src');
let pass = 0, fail = 0;
function check(name, fn) {
  try {
    if (fn()) { pass++; console.log('  ✅', name); }
    else { fail++; console.log('  ❌', name); }
  } catch (e) { fail++; console.log('  ❌', name, '-', e.message); }
}
// R169-EB 备案（2026-09-26）：本机安全策略拦截 spawnSync——凡祖先链含 node.exe 的进程树内再执行
// node.exe 一律 EBUSY（cmd.exe 等非 node 目标可 spawn；bash 直接调 node 正常；重试/复制 exe 均无效）。
// ⇒ 实跑门禁通道改为：spawnSync 优先；通道被拦（error/status=null）时回退读 `.gate-cache.json`
// ——由 `scripts/regression-eb.sh`（bash 通道）**先真实执行**各门禁并把真实退出码落缓存。
// 缓存带门禁脚本 sha256 指纹 + 15 分钟时效：脚本被改、缓存过期或缺失即红，判据仍是真实退出码。
function runGateSync(scriptPath, args = [], timeoutMs = 120000) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8', timeout: timeoutMs });
  if (r.error || r.status === null || r.status === undefined) return readGateCache(scriptPath, args);
  return r;
}
function gateSha(p) { return require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16); }
function readGateCache(scriptPath, args = []) {
  const f = path.join(SCRIPTS_DIR, '.gate-cache.json');
  const key = path.basename(scriptPath) + (args.length ? ':' + args.join(' ') : '');
  if (!fs.existsSync(f)) throw new Error('本机 EBUSY 环境需外带实跑门禁：请用 node scripts/regression-eb.cjs（或 bash 等价流程）启动回归');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const g = j.gates && j.gates[key];
  if (!g) throw new Error('门禁缓存缺 ' + key + '——重跑外带实跑流程');
  if (Date.now() - j.ts > 15 * 60 * 1000) throw new Error('门禁缓存已过期（>15min）——重跑外带实跑流程');
  if (g.sha !== gateSha(scriptPath)) throw new Error('门禁脚本已变动而缓存未更新——重跑外带实跑流程');
  return { status: g.exit, stdout: g.tail || '', stderr: '' };
}
// V2.21：content script 拆为三文件（search-overlay.ts 信号层 + overlay-impl.ts 浮层实现 + selection.ts 选区捕获）。
// 断言语义不变：「content script 源码包含 X」——按三文件拼接后的整体判断，历史断言无需逐条改写。
const CONTENT_SRC_FILES = ['/content/search-overlay.ts', '/content/overlay-impl.ts', '/content/selection.ts'];
// R115（04-59 技术债第三批）：Workspace.vue 按域拆为 8 个 composable + 样式外置 workspace.css。
// 断言语义不变：「资源台/策展台源码包含 X」——按宿主 + 域文件拼接后的整体判断（沿用 content 三文件同一机制），历史断言无需逐条改写。
const WORKSPACE_SRC_FILES = [
  '/newtab/views/Workspace.vue',
  '/newtab/composables/useResourceView.ts',
  '/newtab/composables/useCatSidebar.ts',
  '/newtab/composables/useResourceOpen.ts',
  '/newtab/composables/useResourceDrawer.ts',
  '/newtab/composables/useResourceDragDrop.ts',
  '/newtab/composables/usePyramid.ts',
  '/newtab/composables/useWsMeta.ts',
  '/newtab/composables/useWsAssetHygiene.ts',
  // R117（04-61 B）：定位域抽出（04-59 宿主 ≤1500 行验收线）——同样纳入聚合读取
  '/newtab/composables/useWsLocate.ts',
  '/newtab/views/workspace.css',
];
function read(p) {
  // R110：CRLF/LF 归一化——Windows 检出（autocrlf）下多行锚串不再失配
  const norm = (t) => t.replace(/\r\n/g, '\n');
  if (p === '/content/search-overlay.ts') {
    return norm(CONTENT_SRC_FILES.map(f => fs.readFileSync(base + f, 'utf8')).join('\n'));
  }
  if (p === '/newtab/views/Workspace.vue') {
    return norm(WORKSPACE_SRC_FILES.map(f => fs.readFileSync(base + f, 'utf8')).join('\n'));
  }
  return norm(fs.readFileSync(base + p, 'utf8'));
}
function count(p, str) { return read(p).split(str).length - 1; }
function exists(p) { return fs.existsSync(base + p); }

/**
 * R166：**负向断言必须先剥注释再判**。退役类断言写的是"源码里不得再出现 X"，
 * 而讲"为什么退役 X"的注释里必然提到 X——不剥注释就有两种坏结果：
 * 断言假红（本轮 R144 系与红线五条同时中），或逼着实现把注释删掉（把知识丢了）。
 * 剥完还在，才是真残留。覆盖块注释整段、`//` 与 `*` 行、模板 `<!-- -->` 整段。
 */
function codeOnlyJs(text) {
  /* R119：剥注释必须先**跳过字符串与模板串**。
     旧实现是三条整段正则（块注释、HTML 注释、行首 // 或 *），所以源码里只要出现"斜杠紧跟星号"
     这两个字符——哪怕它在字符串里（URL 通配、accept 的图片类型、glob、被嵌进模板串的 HTML 与 CSS 注释）——
     就会被当成注释起点一路吞到下一个闭合的"星斜杠"，中间的真实代码对**所有负判据隐形**。
     R4-Er 实测：往 perf.cjs 加两段块注释后 codeOnly 只剩 26,398B / 65,465B（六成看不见），
     既有正锚集体红；更危险的是同族的静默方向——负锚在这种文件上会永远绿。
     口径变化清单：① 块注释与 HTML 注释只在**字符串外**生效（这是本轮要修的洞）；② 行注释从「只看行首」扩到「字符串外的双斜杠一律算注释」——第一版我保留了行首限制，结果模板里一个带反引号的行尾注释就让状态机误判成"模板串还没结束"，后半份文件的 HTML 注释全不剥（自查抓到的，见交付说明）；③ 行首的 * 仍按块注释续行剥。状态机要点：模板串的 ${ } 要按代码递归，
     花括号深度必须配对——第一版我把 ${ 之后又退回一格，导致输出出现 双花括号 且整份文件后
     半段被误当字符串内容（连带 HTML 注释也不剥了），这条判据自己就得先是对的。 */
  let out = ''
  let i = 0
  let head = 0                       // out 里当前行的起点，用于判"行首注释"
  const atLineHead = () => /^[ \t]*$/.test(out.slice(head))
  const eatBlock = () => { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2 }
  const eatLine = () => { while (i < text.length && text[i] !== '\n') i++ }
  const eatHtml = () => { i += 4; while (i < text.length && !text.startsWith('-->', i)) i++; i += 3 }
  const readStr = () => {
    const q = text[i]
    out += q; i++
    while (i < text.length) {
      const t = text[i]
      if (t === '\\') { out += t + (text[i + 1] || ''); i += 2; continue }
      if (t === q) { out += q; i++; return }
      if (t === '\n') return
      out += t; i++
    }
  }
  // 正则字面量：只在"运算符之后"的位置才当正则，避免把 a / b 读成串
  const regexLikely = () => {
    for (let k = out.length - 1; k >= 0; k--) {
      const ch = out[k]
      if (ch === ' ' || ch === '\t') continue
      return ch === '\n' || '(,=:;[{!&|?~^+'.includes(ch) || ch === '}'
    }
    return true
  }
  const eatRegex = () => {
    let j = i + 1, cls = false
    while (j < text.length) {
      const t = text[j]
      if (t === '\\') { j += 2; continue }
      if (t === '\n') break
      if (t === '[') cls = true
      else if (t === ']') cls = false
      else if (t === '/' && !cls) break
      j++
    }
    const lit = text.slice(i, Math.min(j + 1, text.length))
    if (lit.length > 1 && !/\s|=/.test(lit[1])) { out += lit; i += lit.length; return true }
    return false
  }
  const readTpl = () => {
    out += '`'; i++
    let depth = 0                    // 0 = 在模板正文里；>0 = 在 ${ … } 表达式里
    while (i < text.length) {
      const t = text[i], u = text[i + 1]
      if (t === '\\') { out += t + (u || ''); i += 2; continue }
      if (depth === 0) {
        if (t === '`') { out += '`'; i++; return }
        if (t === '$' && u === '{') { out += '${'; i += 2; depth = 1; continue }
        out += t; i++; continue
      }
      if (t === '/' && u === '*') { eatBlock(); continue }
      if (t === '/' && u === '/' && atLineHead()) { eatLine(); continue }
      if (t === '{') { depth++; out += t; i++; continue }
      if (t === '}') { depth--; out += t; i++; continue }
      if (t === '`') { readTpl(); continue }
      if (t === "'" || t === '"') { readStr(); continue }
      out += t; i++
    }
  }
  while (i < text.length) {
    const c = text[i], d = text[i + 1]
    if (c === '/' && d === '*') { eatBlock(); continue }
    if (c === '/' && d === '/' && atLineHead()) { eatLine(); continue }
    if (c === '*' && atLineHead()) { eatLine(); continue }
    if (c === '<' && text.startsWith('!--', i)) { eatHtml(); continue }
    if (c === "'" || c === '"') { readStr(); continue }
    if (c === '`') { readTpl(); continue }
    if (c === '/' && regexLikely() && eatRegex()) continue
    if (c === '\n') { out += c; head = out.length; i++; continue }
    out += c; i++
  }
  return out
}
/**
 * R119 的第二道闸：**Vue 的 template 区不按 JS 字符串解释**。
 * 状态机在 JS 里把成对引号当字符串是对的，但 HTML 文本里的引号（属性值、按钮里的 `width: 400px`、
 * 中文里夹的英文撇号）一多就会误开一个"字符串"，把后面真正的 HTML 注释整段留在视野里——
 * 实测 Workspace.vue 第 656 行那条注释里的 bookmarkInput 因此被 R4-Db 的负锚读到，判据假红。
 * 所以：SFC 只在 script 区跑状态机；template 与 style 区沿用旧整段正则（口径不变）。
 * 被修的洞（字符串里的 斜杠星 吞代码）在 JS/CSS 侧，模板区本来也没有那种字符串。
 */
function codeOnly(text) {
  /* R119 分派器：SFC 的 template/style 区不按 JS 字符串语义走（HTML 文本里的引号不是字符串定界符，
     误判会把后面的真注释整段留在视野里，实测 Workspace.vue 656 行那条注释就害得 R4-Db 假红）；
     script 区才用状态机——要修的洞（字符串里的 斜杠星 吞掉后面代码）本来也只发生在 JS 侧。 */
  const i = text.indexOf('<script')
  const j = text.lastIndexOf('</script>')
  if (i >= 0 && j > i) return codeOnlyNaive(text.slice(0, i)) + codeOnlyJs(text.slice(i, j + 9)) + codeOnlyNaive(text.slice(j + 9))
  /* 判据也会只切一段模板喂进来（R169-17 切 <template>…</template>、R65-4 切一段 div）——
     这种整段都是标记的，引号不是 JS 字符串定界符，退回旧口径；纯 JS 文件与脚本切片走状态机。 */
  if (/^\s*</.test(text)) return codeOnlyNaive(text)
  return codeOnlyJs(text)
}
function codeOnlyNaive(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
    .split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n')
}
function codeOnlyVueUnused(text) {
  const naive = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n')
  const i = text.indexOf('<script')
  const j = text.lastIndexOf('</script>')
  if (i < 0 || j < 0 || j < i) return naive(text)
  return naive(text.slice(0, i)) + codeOnly(text.slice(i, j + 9)) + naive(text.slice(j + 9))
}

/**
 * 版本锚 —— **升版只改这一行**（R90 补丁引入）。
 *
 * 此前各轮的「版本五处同步」断言各自硬编码版本号（如 `m.includes("version: '2.58.0'")`），
 * 每轮升版靠**全局替换**把所有版本号一路抬高（技能 §五·补十二）。副作用有两点：
 *   ① 历史轮次的**冻结版本被改错**——R87 的断言变成了校验 V2.59.0；
 *   ② 轮次标题（console 输出）与断言描述里的历史标注同样被抬高。
 *
 * 但这些断言真正要守的是**「五处写着同一个版本」这个不变量**，不是「等于某年某版的固定值」。
 * 现改为单一锚点：`VER_ANCHOR_LITERAL` 是期望版本，`CUR_VER` / `CUR_VTAG` 由它派生；
 * `reg` 分支（`reg.includes(...)`）靠本文件**保留该字面**来校验自身同步。
 */
const VER_ANCHOR_LITERAL = "version: '3.8.6'";
/** 期望版本（裸号，如 `2.59.0`） */
const CUR_VER = (VER_ANCHOR_LITERAL.match(/'([\d.]+)'/) || ['', ''])[1];
/** 期望版本（带 V 前缀，如 `V2.59.0`） */
const CUR_VTAG = 'V' + CUR_VER;


/* ---- R174-1：中段顶层定义原样上提（原执行位在各分节之间，全部为源文件只读计算，先于断言执行语义等价） ---- */
/**
 * R4-Et：切片工具的**失效方向不对称**，所以要有闸。
 *   终点标记没了 → 切片一路吃到文件尾 ⇒ 负判据误红（本轮 `.cur-tree-caret` 被删后 R94-7 就是这样响的）；
 *   起点标记没了 → 切片变成空串 ⇒ **正判据恒假、负判据恒真**，一条"永远绿"的空哨兵静默上岗。
 * 两种都记进下面这张表，由判据 R4-Et② 统一要求它为空（只上 fnBody 这 14 处；segOf 的 69 处同题另立 #120，
 * 一次只改一把尺子——R4-Es 的教训）。
 */
const SLICE_MISS = []
const fnBody = (src, head, next) => {
  const i = src.indexOf(head);
  if (i < 0) { SLICE_MISS.push('起点缺失「' + String(head).slice(0, 48) + '」'); return ''; }
  const j = src.indexOf(next, i + head.length);
  if (j < 0) { SLICE_MISS.push('终点缺失「' + String(next).slice(0, 48) + '」'); return src.slice(i); }
  return src.slice(i, j);
};
const getSliceMisses = () => SLICE_MISS;
const segOf = (src, head, next) => {
  const i = src.indexOf(head);
  if (i < 0) { SLICE_MISS.push('segOf 起点缺失「' + String(head).slice(0, 48) + '」'); return ''; }
  const j = src.indexOf(next, i + head.length);
  if (j < 0) { SLICE_MISS.push('segOf 终点缺失「' + String(next).slice(0, 48) + '」'); return src.slice(i); }
  return src.slice(i, j);
};
const RES_CARD_ACTIONS = segOf(read('/newtab/views/Workspace.vue'), '<div class="res-card-actions">', '<div class="rc-head">');
const RES_ROW_ACTIONS = segOf(read('/newtab/views/Workspace.vue'), '<span class="rr-actions">', '</span>\n              </div>');
const KANBAN_ACTIONS = segOf(read('/newtab/views/Workspace.vue'), '<div class="kc-actions">', '</div>\n                <div class="kc-card-title">');
// R179（V3.7.0）：镜像域退役（资源卡真身统一入池，「镜像到策展台」入口整域删除）——
// 六动作序列收敛为五动作（原 openMirrorCard(r) 居 📂 与 🗑 之间，随其退役一并移出）。
const ACTION_SEQ = ['openResourceLink(r)', 'togglePin(r)', 'toggleStar(r)', 'openMoveOne(r)', 'deleteResource(r)'];
const inOrder = (seg) => {
  let at = -1;
  for (const fn of ACTION_SEQ) {
    const i = seg.indexOf(fn, at + 1);
    if (i < 0) return false;
    at = i;
  }
  return true;
};
const IMPORT_FN = segOf(read('/newtab/composables/useWorkspaceImport.ts'), 'async function handleFileImport(', '\n  return {');
// ★R4-Eu 随迁备案：原终点 `// 单击（详情）与双击（打开链接）区分` 随 R115 物理拆分搬走了（该注释在宿主文件里，
// 函数搬进 composable 后切片一路吃到聚合文本末尾）⇒ OPEN_LINK_FN 从"一个函数"变成"后面所有代码"。
const OPEN_LINK_FN = segOf(read('/newtab/views/Workspace.vue'), 'function openResourceLink(', '\n  return { previewOpen, previewUrl');
const stripComments = (s) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const BADGE = read('/shared/components/AssetBadge.vue');
const BADGE_TPL = segOf(BADGE, '<template>', '</template>');
const FIELDS = read('/shared/utils/fields.ts');
const GS = read('/newtab/views/GlobalSettings.vue');
const ASSET_KIND = read('/shared/utils/assetKind.ts');
const WS82 = read('/newtab/views/Workspace.vue');
const CTX_FN = segOf(WS82, 'function openResCtx(', '// B6：拖拽插入线');
const CTX_MIRROR = segOf(CTX_FN, 'if (isMirrorView(r)) {', '} else {');
const CTX_OWN = segOf(CTX_FN, '} else {', 'resCtx.value = {');
// ★R4-Eu：MOUNT_FN / MOUNT_PICKER 两条切片随挂载选择器一起退役（R82-7 已把 mountTaskOptions /
// mountProjectName / mountOneOpen 判成零命中），两条起点标记在 src 里早已不存在 ⇒ 切片恒为空串、
// 没有任何判据在用它们。删掉，不留"永远绿"的空哨兵。
const RES_CARD_IFACE = segOf(read('/shared/models/index.ts'), 'export interface ResourceCard extends CardBase {', '\n}');
// R3-B1：CompassShell.vue / LighthousePanel.vue 退役——原 LH / LH_TPL / LH_STYLE / TERM_FN /
// LH85 / TPL85 / STY85 / FBAR_TPL / CS86 / LH86 / CS_TPL / CS_STY / LP99 / CS99 一并撤走，
// 引用它们的断言逐条重指到方向台新现实（不再静默指向空串，避免"判据还在、证据已空"）。
const WS84 = read('/newtab/views/Workspace.vue');
const WSVIEW = read('/shared/utils/wsView.ts');
const HEAD_TPL = segOf(WS84, '<div class="ws-id-head">', '</div>');
const BANNER_TPL = segOf(WS84, '<div class="thesis-banner"', '</div>');
const ST85 = read('/newtab/stores/compass.ts');
const FOCUS_FN = segOf(ST85, 'function toggleFocusProject(', 'function addProjectToDir');
const ADDP_FN = segOf(ST85, 'function addProjectToDir(', '// ---- 项目进度计算');
const CT86 = read('/newtab/views/CompassTree.vue');
const ST86 = read('/newtab/stores/compass.ts');
const WS87 = read('/newtab/views/Workspace.vue');
const LINK87 = read('/shared/utils/link.ts');
const REF87 = read('/newtab/components/ResourceEditForm.vue');
const MOD87 = read('/shared/models/index.ts');
const WS_TPL = segOf(WS87, '<template>', '\n</template>');
const WS_STY = read('/newtab/views/workspace.css');
const WS88 = read('/newtab/views/Workspace.vue');
const WS88_TPL = segOf(WS88, '<template>', '\n</template>');
const TB88 = segOf(WS88, '<div class="ws-toolbar">', '\n    </div>');
const POP88 = segOf(WS88, '<div class="filter-pop"', '\n        </div>');
const TB1_88 = TB88.replace(POP88, '');
const SM88 = segOf(WS88, '<div class="settings-menu"', '\n    </div>');
const WS89 = read('/newtab/views/Workspace.vue');
const WS89_TPL = segOf(WS89, '<template>', '\n</template>');
const WS90 = read('/newtab/views/Workspace.vue');
const REF90 = read('/newtab/components/ResourceEditForm.vue');
const ICON90 = read('/shared/components/Icon.vue');
const HEAD90 = segOf(WS90, '<div class="ws-id-head">', '</div>');
const TB90 = segOf(WS90, '<div class="ws-toolbar">', '<!-- ③ 资源策展区 -->');
// ★R4-Eu 随迁备案：原终点 `// ===== 拖拽排序` 在 R115 拆分后不再紧跟 openResCtx ⇒ 切片一路到聚合文本末尾，
// 里面既有 `openMirrorDetail` 又有各域 return —— 三条负锚（isHub / openMirrorCard / icon: 'share'）
// 核的早就不是"右键菜单那一段"了。换成 composable 的 return 作为活边界。
const CTX90 = stripComments(segOf(WS90, 'function openResCtx(', '\n  return {\n    onCardClick, onCardDblClick,'));
const STYLE90 = read('/newtab/views/workspace.css');
const CH91 = read('/newtab/views/CompassHome.vue');
const STRIP91 = segOf(CH91, '<span class="cf-label"', '</MetricBar>');
const STRIP91_C = stripComments(STRIP91);
const FOCUS_FN91 = segOf(CH91, 'const focusMeta = computed(', 'function openFocusProject');
const OV92 = read('/content/overlay-impl.ts');
const OV92_C = stripComments(OV92);
const FOCUS_FN92 = fnBody(OV92, 'function focusWhenReady(', '/** 打开浮层');
const ESC92 = fnBody(OV92, "} else if (e.key === 'Escape') {\n    // R92（D2）", 'function openSearchLocator');
// ★R4-Et 随迁备案（非本轮删的，是查切片闸时现抓的两条潜伏松动）：原终点 `document.getElementById('__zy_cap_save__')`
// 在源码里只出现在 saveCapture **之前**的那一行（钮的 addEventListener），indexOf 从起点往后找不到 ⇒ 切片一路吃到文件尾，
// R92-6 那三条正锚（filed / 两种回执文案）从此在整份文件里找——文案挪出函数也不会红。换成紧随其后的块注释头。
const CAP_FN92 = fnBody(OV92, 'async function saveCapture(', '/** 采集去重确认视图');
const TC_FN92 = fnBody(OV92, 'const saveTc = async () => {', "document.getElementById('__zy_tc_save__')");
const OV93 = read('/content/overlay-impl.ts');
const OV93_C = stripComments(OV93);
const HEX93 = ['#E9F1FA', '#E4F2E8', '#FBF1DE', '#EFEFEA', '#F9F3E4', '#E9EAF6', '#FBEAEA', '#C03B3B', '#8A5A00', '#6E6E66', '#2E7D42', '#3D439B'];
const CH94 = read('/newtab/views/CompassHome.vue');
const CH94_C = stripComments(CH94);
// ★R4-Et 随迁备案：原终点 `<!-- 下 · 项目调度` 是 R117（任务调度整体迁出方向台）改写那段注释时留下的旧措辞，
// 标记找不到 ⇒ 切片从 today-body 一路吃到文件尾（连整个 <style> 块都算进"今日三件事"），R94-7 的正锚从此在整份文件里找文案。
// ★W1.1 再随迁：那段注释在 V3.8.1 改三张卡名（底部章节头改为 `<!-- 底部 · 三张卡`）时又被抹掉一次 ⇒ 终点改指现役边界。
const TODAY94 = fnBody(CH94, '<div class="today-body">', '<!-- 底部 · 三张卡');
// ★R4-Et 随迁备案：原终点标记 `.cur-tree-caret` 是 R4-Et 清掉的孤儿规则（该 class 在本文件模板、104 场景 DOM census、
// 全站字符串/classList 三处都为零）——标记一没，切片一路吃到文件尾，把无关的 --danger/animation/% 卷进"完成态样式"里，
// R94-7 当场误红。换成同文件里的活边界 `.today-cards { display: grid`，切片仍然只覆盖安静完成态那四条规则。
const DONE_STYLE94 = fnBody(CH94, '.card.focus.all-done .today-cards', '.today-cards { display: grid');
const CC95 = read('/shared/utils/cardCols.ts');
const CC95_C = stripComments(CC95);
const WS96 = read('/newtab/views/Workspace.vue');
const RDD96 = read('/newtab/components/ResourceDetailDrawer.vue');
const ARCH96 = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', '..', 'docs', '技术架构与数据模型.md'), 'utf8');
const README96 = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'README.md'), 'utf8');
const OV97 = read('/content/overlay-impl.ts');
const WS98 = read('/newtab/views/Workspace.vue');
const WSP107 = read('/newtab/views/Workspace.vue');
const TM107 = read('/newtab/components/compass/TaskManagerPanel.vue');
const CZ107 = read('/newtab/components/compass/CuriosityPanel.vue');
const APP106 = read('/newtab/App.vue');
const WSP106 = read('/newtab/views/Workspace.vue');
const OV106 = read('/content/overlay-impl.ts');
const CH105 = read('/newtab/views/CompassHome.vue');
const APP105 = read('/newtab/App.vue');
const OV105 = read('/content/overlay-impl.ts');
const WSP105 = read('/newtab/views/Workspace.vue');
const CC104 = read('/newtab/composables/useCategoryCrud.ts');
const WSP104 = read('/newtab/views/Workspace.vue');
const MIR103 = read('/newtab/composables/useWorkspaceMirror.ts');
const WSP103 = read('/newtab/views/Workspace.vue');
const BAT102 = read('/newtab/composables/useWorkspaceBatch.ts');
const WSP102 = read('/newtab/views/Workspace.vue');
const DR101 = read('/newtab/composables/useCurationDrill.ts');
const WSP101 = read('/newtab/views/Workspace.vue');
const IMP100 = read('/newtab/composables/useWorkspaceImport.ts');
const WSP100 = read('/newtab/views/Workspace.vue');
const MI108 = read('/shared/utils/mdImport.ts');
const ITM108 = read('/newtab/components/ImportTemplateModal.vue');
const CT108 = read('/newtab/views/CompassTree.vue');
const WSP108 = read('/newtab/views/Workspace.vue');
const ITM109 = read('/newtab/components/ImportTemplateModal.vue');
const MI109 = read('/shared/utils/mdImport.ts');
const APP109 = read('/newtab/App.vue');
const WSP109 = read('/newtab/views/Workspace.vue');
const GS109 = read('/newtab/views/GlobalSettings.vue');
const RB109 = read('/newtab/views/RecycleBin.vue');
/** 现扫 src 的全部 .ts/.vue（判据要"现算而不是我以为有哪些文件"时的唯一入口） */
function walkSrcFiles(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir || base, { withFileTypes: true })) {
    const p = path.join(dir || base, e.name);
    if (e.isDirectory()) walkSrcFiles(p, out);
    else if (/\.(ts|vue)$/.test(e.name)) out.push(p);
  }
  return out;
}
/** src 相对路径（posix 风格）→ 文件内容；给"全 src 扫一遍"类判据用 */
function srcFileEntries() {
  return walkSrcFiles(base).map(p => ({ rel: path.relative(base, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') }));
}
function walkVueFiles(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkVueFiles(p, out);
    else if (e.name.endsWith('.vue')) out.push(p);
  }
  return out;
}
const VUE_BUILTIN_TAGS = new Set(['Teleport', 'Transition', 'TransitionGroup', 'KeepAlive', 'Component', 'Suspense', 'Slot', 'RouterView', 'RouterLink', 'template', 'slot', 'component']);
function walkStyleFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...walkStyleFiles(p)); }
    else if (/\.(vue|css)$/.test(e.name)) out.push(fs.readFileSync(p, 'utf8'));
  }
  return out;
}
const STYLE_ALL = walkStyleFiles(path.resolve(SCRIPTS_DIR, '..', 'src'));
const CRUD146 = read('/shared/utils/compassCrud.ts')
const ALL_VUE146 = (() => { const out = []; const walk = (rel) => { for (const f of fs.readdirSync(base + rel)) { const abs = rel + '/' + f; if (fs.statSync(base + abs).isDirectory()) walk(abs); else if (f.endsWith('.vue')) out.push(abs) } }; walk(''); return out })()
const ALL_STYLE155 = (() => { const out = []; const walk = (rel) => { for (const f of fs.readdirSync(base + rel)) { const abs = rel + '/' + f; if (fs.statSync(base + abs).isDirectory()) walk(abs); else if (f.endsWith('.vue') || f.endsWith('.css')) out.push(abs) } }; walk(''); return out })()
const DRAWER147 = read('/newtab/components/AiSuggestionDrawer.vue')
const REPO148 = read('/shared/storage/repository.ts')
const HOT148 = read('/shared/storage/hotStats.ts')

function getTally() { return { pass, fail }; }

/* R174-1：分片锚——ANCHOR_FILE = 本文件（版本锚 VER_ANCHOR_LITERAL 与聚合读取机制断言读这里） */
const ANCHOR_FILE = __filename;

module.exports = { fs, path, base, check, walkSrcFiles, srcFileEntries, runGateSync, gateSha, readGateCache, CONTENT_SRC_FILES, WORKSPACE_SRC_FILES, read, count, exists, codeOnly, VER_ANCHOR_LITERAL, CUR_VER, CUR_VTAG, fnBody, segOf, RES_CARD_ACTIONS, RES_ROW_ACTIONS, KANBAN_ACTIONS, ACTION_SEQ, inOrder, IMPORT_FN, OPEN_LINK_FN, stripComments, getSliceMisses, BADGE, BADGE_TPL, FIELDS, GS, ASSET_KIND, WS82, CTX_FN, CTX_MIRROR, CTX_OWN, RES_CARD_IFACE, WS84, WSVIEW, HEAD_TPL, BANNER_TPL, ST85, FOCUS_FN, ADDP_FN, CT86, ST86, WS87, LINK87, REF87, MOD87, WS_TPL, WS_STY, WS88, WS88_TPL, TB88, POP88, TB1_88, SM88, WS89, WS89_TPL, WS90, REF90, ICON90, HEAD90, TB90, CTX90, STYLE90, CH91, STRIP91, STRIP91_C, FOCUS_FN91, OV92, OV92_C, FOCUS_FN92, ESC92, CAP_FN92, TC_FN92, OV93, OV93_C, HEX93, CH94, CH94_C, TODAY94, DONE_STYLE94, CC95, CC95_C, WS96, RDD96, ARCH96, README96, OV97, WS98, WSP107, TM107, CZ107, APP106, WSP106, OV106, CH105, APP105, OV105, WSP105, CC104, WSP104, MIR103, WSP103, BAT102, WSP102, DR101, WSP101, IMP100, WSP100, MI108, ITM108, CT108, WSP108, ITM109, MI109, APP109, WSP109, GS109, RB109, walkVueFiles, VUE_BUILTIN_TAGS, walkStyleFiles, STYLE_ALL, CRUD146, ALL_VUE146, ALL_STYLE155, DRAWER147, REPO148, HOT148, SCRIPTS_DIR, ANCHOR_FILE, getTally };
