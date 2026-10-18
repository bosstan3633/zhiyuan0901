/**
 * 18-b6-workspace.cjs —— B6「项目详情与策展台」（V3.8.34）常驻判据。
 *
 * 六项（两页）：
 *   P1 项目详情对账读数弱化（数字与标签降 caption、去结论色、口径进 tooltip）
 *   P2 双列节奏（目录退支撑列：发丝线 + caption 标题 + sp-5 列间距；窄窗单列优先任务树）
 *   W1 金字塔树主角强化（树区 surface 大板 + xl 圆角 + 中轴发丝线 + 节点 lg / 支撑 sm）
 *   W2 镜像引用可视化（角标 text-3 中性 + tooltip 统一含「编辑回源处生效」+ 只读合同仍在）
 *   W3 台头信息行弱化（分类/镜像/更新计数降 caption）
 *   W5 中心论点层级（论点卡 headline 17 + accent 左竖条；论点下 AI 入口降 caption 弱显）
 *
 * 纪律：锁结构事实与令牌档位，不锁观感；观感归四主题截图（docs/视觉归档/B6-workspace）。
 * ★注释里不写被禁的字面量本身 —— 判据用 includes 扫源码，写进注释等于自己把判据喂绿（R71）。
 * ★判据不钉图标尺寸 —— 字号档位一调就假红（R39-12 / W11-3⑤ 两次同坑）。
 */
const { check, read, codeOnly } = require('./helpers.cjs');

const PC = read('/newtab/views/ProjectCuration.vue');
const WSV = read('/newtab/views/Workspace.vue');
const CSS = read('/newtab/views/workspace.css');
const TAB = read('/newtab/components/ThesisAiBtn.vue');
const DRW = read('/newtab/composables/useResourceDrawer.ts');

/**
 * 取一条顶层规则。传入**原始选择器**（含点），转义由本函数负责 ——
 * ★调用点不要自己写 `\.pyramid`：再转义一次会得到 `\\.`，规则永远取不到，整片判红（R71 变体）。
 * 锚行首 + m 标志：避免被嵌套规则或先行装饰规则命中（B3 教训）。
 */
function rule(src, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (src.match(new RegExp('^' + esc + ' \\{[^}]*\\}', 'm')) || [''])[0];
}

console.log('【B6 · V3.8.34：项目详情（P1 / P2）与策展台（W1 / W2 / W3 / W5）】');

/* ============ P1 · 对账读数弱化 ============ */
check('P1-1 对账读数只该被查到、不该被看见：pb-stats 降 caption 档且数字中性（无 success/accent 结论色），逐项口径进 title', () => {
  const root = rule(PC, '.pb-stats');
  const b = rule(PC, '.pb-stats .pbs b');
  if (!root || !b) { console.log('     规则缺失'); return false; }
  const painted = /color:\s*var\(--(success|danger|accent)/.test(b);
  if (painted) console.log('     数字仍染结论色：' + b.slice(0, 120));
  return root.includes('font-size: var(--fs-caption)')
    && b.includes('color: var(--text-2)')
    && !painted;
});

check('P1-2 四项读数各自带口径（不是「解释堆在文档里」）：成功指标 / 关联任务 / 已推进完成 / 正在进行中 四处 title 齐全，且账目自洽（任务 = 完成 + 在做）', () => {
  const seg = PC.slice(PC.indexOf('<div class="pb-stats">'), PC.indexOf('</div>', PC.indexOf('<div class="pb-stats">')));
  if (!seg) { console.log('     切片为空（模板标记漂移）'); return false; }
  const tips = (seg.match(/class="pbs[^"]*" title="([^"]+)"/g) || []);
  const dated = seg.includes('pb-tail-inline') && seg.includes('title="项目起止日期"');
  return tips.length >= 4 && dated
    && tips.some(t => t.includes('成功指标')) && tips.some(t => t.includes('关联任务'))
    && tips.some(t => t.includes('已完成')) && tips.some(t => t.includes('正在进行中'))
    && seg.includes('projectProgress(currentProject).total - projectProgress(currentProject).done');
});

/* ============ P2 · 双列节奏 ============ */
check('P2-1 目录列退为支撑列：右缘一条发丝线与主列分开、标题降到 caption+tracking 档（不再是 fs-sub 600）', () => {
  const dir = rule(PC, '.pd-dir');
  const title = rule(PC, '.pd-dir-title');
  if (!dir || !title) { console.log('     规则缺失'); return false; }
  return dir.includes('border-right: 1px solid var(--border)')
    && dir.includes('position: sticky')
    && title.includes('var(--fs-caption)')
    && title.includes('font-weight: 700')
    && title.includes('var(--tracking-sm)')
    && !title.includes('font-size: var(--fs-sub)');
});

check('P2-2 列间距按令牌记账：把手左右外边距 10+4+10 = 24 = var(--sp-5) 的实际值，不再额外叠 gap', () => {
  const split = rule(PC, '.pd-split');
  if (!split) { console.log('     规则缺失'); return false; }
  return split.includes('width: 4px') && split.includes('margin: 4px 10px');
});

check('P2-3 窄窗单列优先任务树：≤1024px 时目录列与把手一起退场（先让路的是支撑列，不是主体）', () => {
  const i = PC.indexOf('@media (max-width: 1024px)');
  if (i < 0) { console.log('     断点缺失'); return false; }
  const seg = PC.slice(i, PC.indexOf('}', PC.indexOf('.pd-dir, .pd-split', i)) + 1);
  return seg.includes('.board-layout.with-dir') && seg.includes('display: block')
    && seg.includes('.pd-dir, .pd-split') && seg.includes('display: none');
});

/* ============ W1 · 金字塔树主角强化 ============ */
check('W1-1 树区是主角面：surface 大板 + xl 圆角（台头 .ws-id-head 本无底色 ⇒ 主从靠「有板/无板」分层，不靠留白猜）', () => {
  const py = rule(CSS, '.pyramid');
  if (!py) { console.log('     规则缺失'); return false; }
  return py.includes('background: color-mix(in srgb, var(--surface) 55%, var(--bg))')
    && py.includes('border: 1px solid var(--border)')
    && py.includes('border-radius: var(--radius-xl)')
    && py.includes('overflow-x: auto') && py.includes('width: 100%');
});

check('W1-2 中轴发丝线贯穿：挂在 .py-board（树的真实中轴，横向滚动时随内容走），节点面不透明故线只在缝隙露出', () => {
  const axis = rule(CSS, '.py-board::before');
  if (!axis) { console.log('     中轴规则缺失'); return false; }
  return axis.includes('left: 50%') && axis.includes('background: var(--border)')
    && axis.includes('z-index: 0') && axis.includes('pointer-events: none');
});

check('W1-3 圆角层级三档：节点主卡 lg / 支撑 chip sm / 树区板 xl（原 10px、6px 硬编码已归零）', () => {
  const node = rule(CSS, '.py-node'), chip = rule(CSS, '.py-card-chip'), py = rule(CSS, '.pyramid');
  if (!node || !chip || !py) { console.log('     规则缺失'); return false; }
  return node.includes('border-radius: var(--radius-lg)')
    && chip.includes('border-radius: var(--radius-sm)')
    && py.includes('border-radius: var(--radius-xl)')
    && !/border-radius:\s*\d+px/.test(node + chip);
});

check('W1-4 全屏态大板归零：真全屏与降级全屏都是「只剩内容」，圆角与描边在满屏里无意义', () => {
  const a = rule(CSS, '.pyramid:fullscreen'), b = rule(CSS, '.pyramid.py-fs-fallback');
  if (!a || !b) { console.log('     规则缺失'); return false; }
  return [a, b].every(r => r.includes('border: none') && r.includes('border-radius: 0'));
});

/* ============ W2 · 镜像引用可视化 ============ */
check('W2-1 角标中性：取 --text-3 且不再用滤镜压暗（原 opacity .85 + saturate(.9) 是「压下去」不是「中性」，颜色仍随主题偏）', () => {
  const badge = rule(CSS, '.rc-mirror-badge');
  if (!badge) { console.log('     规则缺失'); return false; }
  return badge.includes('color: var(--text-3)')
    && !badge.includes('opacity:')
    && !badge.includes('filter:')
    && badge.includes('cursor: help');
});

check('W2-2 三视图角标同一份 tooltip，且含只读合同（不只是「源在哪」，还要说清「编辑去哪生效」）', () => {
  const badges = WSV.match(/class="rc-mirror-badge" title="([^"]+)"/g) || [];
  if (badges.length !== 3) { console.log('     角标处数 = ' + badges.length + '（应为 3：卡片/列表/金字塔）'); return false; }
  const texts = badges.map(b => (b.match(/title="([^"]+)"/) || ['', ''])[1]);
  return texts.every(t => t.includes('镜像自原资源卡') && t.includes('编辑回源处生效'));
});

check('W2-3 只读合同没被这次改动碰坏：镜像卡写动作整组拦截（v-else 分支只留「打开链接 / 定位到源卡」）、单击开只读详情、跳真身回落调度台首页', () => {
  const i = WSV.indexOf('class="res-card-actions"');
  const seg = i >= 0 ? WSV.slice(i, i + 1200) : '';
  if (!seg) { console.log('     切片为空（模板标记漂移）'); return false; }
  const mir = read('/newtab/composables/useWorkspaceMirror.ts');
  return seg.includes('<template v-if="!isMirrorView(r)">')
    && seg.includes('locateMirrorSource(r)')
    && DRW.includes('if (isMirrorView(r))')
    && DRW.includes('openMirrorDetail(r)')
    && mir.includes('function locateMirrorSource')
    && mir.includes("router.push('/')");
});

/* ============ W3 · 台头信息行弱化 ============ */
check('W3-1 计数行降 caption：分类数/镜像数/更新流水一行可忽略但不缺失，「更新」入口的 tooltip 仍在（流水下钻不丢）', () => {
  const sum = rule(CSS, '.wsh-summary');
  const i = WSV.indexOf('class="wsh-summary"');
  const seg = i >= 0 ? WSV.slice(i, WSV.indexOf('</span>', WSV.indexOf('</span>', i) + 1)) : '';
  if (!sum || !seg) { console.log('     规则或模板缺失'); return false; }
  return sum.includes('font-size: var(--fs-caption)')
    && sum.includes('color: var(--text-3)')
    && seg.includes('个分类') && seg.includes('镜像')
    && seg.includes('title="查看最近更新流水"') && seg.includes('openDrill(\'recent\')');
});

/* ============ W5 · 中心论点层级 ============ */
check('W5-1 论点卡是题眼：标题 headline 17 + accent 左竖条作身份标识；竖条用 inset box-shadow 内画，不与已有 accent 描边叠成双线', () => {
  const banner = rule(CSS, '.thesis-banner');
  const tbt = rule(CSS, '.tb-title');
  const root = rule(CSS, '.py-root-card');
  const rtitle = rule(CSS, '.py-root-title');
  if (!banner || !tbt || !root || !rtitle) { console.log('     规则缺失'); return false; }
  return tbt.includes('var(--fs-headline)')
    && rtitle.includes('var(--fs-headline)')
    && banner.includes('inset 3px 0 0 var(--accent)')
    && root.includes('inset 3px 0 0 var(--accent)')
    && !root.includes('border-left')
    && !banner.includes('border-left');
});

check('W5-2 论点下的支撑链退一档：AI 提炼入口降 caption（虚线描边不撤 —— 虚线正是「待勾选、未落库」的语义，去掉会读成普通主行动）', () => {
  const btn = rule(TAB, '.th-ai-btn');
  if (!btn) { console.log('     规则缺失'); return false; }
  return btn.includes('font-size: var(--fs-caption)')
    && btn.includes('border: 1px dashed')
    && !btn.includes('font-size: var(--fs-sub)');
});

check('W5-3 accent 底上的 AI 徽标仍反相（R169-T5b 的活体陷阱，弱显不能把反相一起弱掉）', () => {
  const hov = rule(TAB, '.th-ai-btn:hover');
  if (!hov) { console.log('     规则缺失'); return false; }
  return hov.includes('--ai-mark-fill: #fff') && hov.includes('--ai-mark-eye: var(--accent)');
});

/* ============ 口径备案：规范 W2 那一半在本页另有既存实现 ============ */
check('B6-注 规范 W2 所称「编辑入口显形为打开原卡」在本页已由既有两件承担，本批不新增第三枚按钮：① 镜像分支动作条只留「打开链接 / 定位到源卡」（写动作整组拦截）② 单击进只读详情。硬加一枚「打开原卡」按钮会是第三份只读合同，且与「定位到源卡」重复', () => {
  const i = WSV.indexOf('class="res-card-actions"');
  const seg = i >= 0 ? WSV.slice(i, i + 1200) : '';
  const noDup = !seg.includes('打开原卡');
  if (!noDup) console.log('     出现「打开原卡」按钮：若确为拍板新增，须同时更新本条');
  return noDup && seg.includes('title="定位到源卡"') && DRW.includes('openMirrorDetail');
});

/* 代码侧不允许残留的旧写法（负判据，防回流） */
check('B6-负 旧写法零残留：对账条的结论色类名、目录列的旧内距、镜像旧文案、三张卡片的硬编码圆角', () => {
  const pcCode = codeOnly(PC);
  const cssCode = codeOnly(CSS);
  const bad = [];
  if (/class="(ok|acc)"/.test(pcCode)) bad.push('pb-stats 的 ok/acc 类');
  if (/\.pb-stats \.pbs b\.ok|\.pb-stats \.pbs b\.acc/.test(cssCode)) bad.push('pb-stats 结论色规则');
  if (/title="镜像卡 · 源在资源卡池"/.test(WSV)) bad.push('旧镜像 tooltip 文案');
  /* 只守**卡片层**三张（板/节点/chip）——徽标 4px、计数胶囊 99px、悬浮钮 6px 都是正当的小元素圆角，
     一并扫会把正常值判成违规，久了就没人看这条断言（判据失信比没有判据更糟）。 */
  for (const sel of ['.pyramid', '.py-node', '.py-card-chip', '.py-root-card', '.py-root-empty']) {
    const r = rule(CSS, sel);
    if (r && /border-radius:\s*[0-9]+px/.test(r)) bad.push(sel + ' 硬编码圆角');
  }
  if (bad.length) console.log('     残留：' + bad.join('、'));
  return bad.length === 0;
});