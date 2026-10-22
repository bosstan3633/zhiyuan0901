/**
 * 13-components.cjs —— B2「组件与门禁」（V3.8.27）常驻判据。
 *
 * 覆盖四项横切基建：
 *   G3 空状态组件统一（EmptyState 契约 + 10 个空态位收口 + 旧类清零）
 *   G5 Toast 回执统一（右上 320px / 默认 2.4s / 撤销 6s / 破坏性写清去向）
 *   G4 焦点环令牌 + 键盘可达棘轮（审计数只许降）
 *   G6 四主题走查常驻（pre-commit 钩子 + 交付说明模板 + npm 入口）
 *
 * 纪律：本条只锁「契约与结构」，不锁像素。像素走 AB，颜色走 theme-contrast。
 */
const { fs, path, check, read, walkSrcFiles, SCRIPTS_DIR, runGateSync, codeOnly } = require('./helpers.cjs');

const PKG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
const ROOT = path.resolve(__dirname, '..', '..', '..');

console.log('【B2 · V3.8.27：组件与门禁（G3 / G4 / G5 / G6）】');

/* ============ G3 · EmptyState 契约 ============ */
check('G3-1 EmptyState 契约四件：icon（系统 Icon）+ title（是什么）+ hint（怎么开始）+ action（主行动），并支持三档尺寸', () => {
  const s = read('/shared/components/EmptyState.vue');
  return s.includes("size?: 'page' | 'section' | 'inline'")
    && s.includes('hint?: string')
    && s.includes('actionLabel?: string')
    && s.includes('secondaryLabel?: string')
    && s.includes("import Icon from './Icon.vue'")
    && s.includes('<Icon :name="icon"')
    && s.includes("defineEmits<{ action: []; secondary: [] }>()")
    && s.includes('class="es-hint"')
    && s.includes('class="es-acts"');
});

check('G3-2 十个空态位全部走 EmptyState（方向台 / 项目详情×3 / 策展台×2 / 回收站 / 画像 / 资源卡池 / 好奇心池 / 任务列表）', () => {
  /* ★V3.8.37（B7-b C5/P3/W4/D3）三处重指，均为**文案迭代**，不是判据放宽：
       ① 四项（P3 之外的 C5/W4/D3）在 G3-2 之后做了场景专属化：原文要求 Icon(compass) +
          「主行动 + 场景文案」，旧文案（如「这台还没有资源卡」「还没有论点节点」）
          是 G3 时期的通用兜底措辞，已被按场景改写。守的是「这十处都走 EmptyState 且各有说法」，
          与具体用哪句话无关，故改锚到新文案，并把新增的零任务位补进清单（十处 → 十二处）。
       ② 读取一律走 codeOnly —— D3 在空态上方写了长备案注释复述了旧文案
          「这一类还没有删除项」作为对照，裸 read() 会让注释把负锚撑绿（教训 R71-4）。 */
  const hits = [
    ['/newtab/views/CompassTree.vue', '方向台还空着'],
    ['/newtab/views/ProjectCuration.vue', '还没有项目'],
    ['/newtab/views/ProjectCuration.vue', '这个项目还没有成功指标'],
    ['/newtab/views/ProjectCuration.vue', '项目有指标，还没有任务'],
    ['/newtab/views/ProjectCuration.vue', '这个项目暂无任务附件'],
    // V3.9.8 随迁：策展台两处空态已迁入现役 CurationMindMap；旧卡片网格空态随四视图退役。
    ['/newtab/components/curation/CurationMindMap.vue', '中心论点下面还没有分支'],
    ['/newtab/components/curation/CurationMindMap.vue', '先确立中心论点'],
    ['/newtab/views/RecycleBin.vue', '这台删除过的资源卡会停在这里'],
    ['/newtab/components/profile/PiMetricDetailDrawer.vue', '还没有可列出的卡片'],
    ['/newtab/components/compass/PoolCardsPanel.vue', '资源卡池还空着'],
    ['/newtab/components/compass/CuriosityPanel.vue', '还没有好奇心'],
    ['/newtab/components/compass/TaskManagerPanel.vue', '暂无任务'],
  ];
  const miss = [];
  for (const [f, t] of hits) {
    const s = codeOnly(read(f));
    if (!s.includes('<EmptyState') || !s.includes(t)) miss.push(f + ' :: ' + t);
  }
  const ws = codeOnly(read('/newtab/views/Workspace.vue'));
  if (ws.includes('这台策展台还空着') || ws.includes('金字塔还空着')) miss.push('Workspace 旧空态回流');
  if (miss.length) console.log('     缺：' + miss.join(' / '));
  return miss.length === 0;
});

check('G3-3 旧空态实现清零：裸 .empty-state / .empty-act / .cz-empty-icon / 「回收站空空如也」全部退役', () => {
  const files = read('/newtab/views/CompassTree.vue') + read('/newtab/views/ProjectCuration.vue') + read('/newtab/views/Workspace.vue')
    + read('/newtab/views/RecycleBin.vue') + read('/newtab/components/compass/CuriosityPanel.vue');
  const bad = [];
  if (files.includes('class="empty-state"')) bad.push('class="empty-state"');
  if (files.includes('empty-act')) bad.push('empty-act');
  if (files.includes('cz-empty-icon')) bad.push('cz-empty-icon');
  if (files.includes('回收站空空如也')) bad.push('回收站空空如也');
  if (bad.length) console.log('     残留：' + bad.join(' / '));
  return bad.length === 0;
});

check('G3-4 空态棘轮：全站 <EmptyState 使用数 ≥ 12（只许增，不许退回各写各的）', () => {
  let n = 0;
  for (const f of walkSrcFiles()) {
    const s = fs.readFileSync(f, 'utf8');
    n += (s.match(/<EmptyState\b/g) || []).length;
  }
  if (n < 12) console.log('     当前 ' + n + ' 处');
  return n >= 12;
});

/* ============ G5 · Toast 契约 ============ */
check('G5-1 Toast 位置与尺寸契约：右上角 + 固定 320px（原居底中、随文案涨到 72vw）', () => {
  const s = read('/shared/components/Toast.vue');
  return s.includes('position: fixed; top: 14px; right: 14px;')
    && s.includes('width: 320px;')
    && s.includes('max-width: calc(100vw - 28px);')
    && !s.includes('max-width: 72vw');
});

check('G5-2 时长契约：默认 2.4s / 撤销 6s（Toast 驻留与撤销窗口同寿：按钮还在就一定还能撤）', () => {
  const t = read('/shared/components/toast.ts');
  const u = read('/shared/utils/undo.ts');
  return t.includes('const TOAST_DURATION = 2400')
    && u.includes('export const UNDO_WINDOW_MS = 6000')
    && u.includes('撤销窗口 6 秒')
    && !u.includes('UNDO_WINDOW_MS = 9000');
});

check('G5-3 回执可操作：撤销与关闭是 <button>（span 不可聚焦 = 键盘用户删错后没有退路）', () => {
  const s = read('/shared/components/Toast.vue');
  return s.includes('<button v-if="t.action" class="toast-action"')
    && s.includes('<button v-if="t.sticky" class="toast-x"')
    && !s.includes('<span v-if="t.action"')
    && !s.includes('<span v-if="t.sticky"');
});

check('G5-4 破坏性操作写清去向：删除类回执必须说明「去了哪 / 怎么回来」', () => {
  return read('/newtab/components/compass/CuriosityPanel.vue').includes('已移入回收站')
    && read('/newtab/composables/useCategoryCrud.ts').includes('其下卡片已回到「待分类」')
    && read('/newtab/views/ProjectCuration.vue').includes('回收站可恢复')
    && read('/content/overlay-impl.ts').includes('可在回收站恢复');
});

/* ============ G4 · 焦点环 + 键盘可达棘轮 ============ */
check('G4-1 焦点环成令牌：--focus-ring / --focus-ring-offset 单一来源，:focus-visible 消费它', () => {
  const s = read('/shared/styles/tokens.css');
  return s.includes('--focus-ring: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);')
    && s.includes('--focus-ring-offset: 1px;')
    && s.includes('outline: var(--focus-ring);')
    && s.includes('outline-offset: var(--focus-ring-offset);');
});

check('G4-2 键盘可达棘轮：可点击不可聚焦处 ≤ 352（V3.8.27 基线；只许降，涨一处即红）', () => {
  const r = runGateSync(path.join(SCRIPTS_DIR, 'a11y-tab-audit.cjs'), ['--count'], 60000);
  const n = parseInt(String(r.stdout || '').trim(), 10);
  if (!Number.isFinite(n)) { console.log('     读不到审计数：' + (r.stdout || r.stderr || '').slice(0, 120)); return false; }
  if (n > 352) console.log('     当前 ' + n + ' 处 > 基线 352');
  return n <= 352;
});

check('G4-3 审计报告在位且写明口径（不是一张光秃秃的数字）', () => {
  const p = path.join(ROOT, 'docs', '审计_键盘可达_G4_V3.8.27.md');
  if (!fs.existsSync(p)) return false;
  const s = fs.readFileSync(p, 'utf8');
  return s.includes('352 处 / 44 文件') && s.includes('遮罩层') && s.includes('假修复');
});

/* ============ G6 · 四主题走查常驻 ============ */
check('G6-1 theme-contrast 挂提交前：pre-commit 安装器 + npm 入口，且只在样式变更时触发', () => {
  const inst = path.join(SCRIPTS_DIR, 'install-hooks.cjs');
  if (!fs.existsSync(inst)) return false;
  const s = fs.readFileSync(inst, 'utf8');
  return s.includes('pre-commit') && s.includes('theme-contrast.cjs')
    && s.includes('\\.(vue|css|scss)$')
    && PKG.scripts && PKG.scripts['gate:theme'] === 'node scripts/theme-contrast.cjs'
    && PKG.scripts['hooks:install'] === 'node scripts/install-hooks.cjs';
});

check('G6-2 交付说明模板含「四主题走查」表（linear / raycast / apple / notion 四行，不许留空）', () => {
  const p = path.join(ROOT, 'docs', '模板_交付说明.md');
  if (!fs.existsSync(p)) return false;
  const s = fs.readFileSync(p, 'utf8');
  return s.includes('四主题走查') && s.includes('`linear`') && s.includes('`raycast`')
    && s.includes('`apple`') && s.includes('`notion`') && s.includes('不许留空');
});
