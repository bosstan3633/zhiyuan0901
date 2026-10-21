/**
 * 16-b5-compass.cjs —— B5-a「方向台：树画布主角 / 视图过渡 / 圆角层级」（V3.8.31）常驻判据。
 *
 * 三项：
 *   C2 树画布主角强化（树区大板 + navside 收窄 + 骨架条发丝线）
 *   C3 视图形态切换过渡（150ms 淡入 + 8px 上浮；reduced-motion 归零）
 *   C4 圆角层级（板 xl / 舱 lg / 子卡 sm，同族同圆角）
 *
 * 纪律：锁结构事实与令牌档位，不锁观感；观感归四主题截图（docs/视觉归档/B5a-compass）。
 * ★注释里不写被禁的字面量本身 —— 判据用 includes 扫源码，写进注释等于自己把判据喂绿（R71）。
 */
const { check, read } = require('./helpers.cjs');

const CT = read('/newtab/views/CompassTree.vue');
const TOWER = read('/newtab/components/compass/CompassTower.vue');
const PANO = read('/newtab/components/compass/CompassPano.vue');
const LIST = read('/newtab/components/compass/CompassLayerList.vue');

console.log('【B5-a · V3.8.31：方向台（C2 / C3 / C4）】');

/* ============ C2 · 树画布主角 ============ */
check('C2-1 树区是「主角面」：canvas-inner 有大板底色 + xl 圆角 + 发丝边（不再是裸排版浮在页面底色上）', () => {
  const rule = (CT.match(/^\.canvas-inner \{[^}]*\}/m) || [''])[0];
  if (!rule) { console.log('     规则缺失'); return false; }
  return rule.includes('background: color-mix(')
    && rule.includes('border: 1px solid var(--border)')
    && rule.includes('border-radius: var(--radius-xl)')
    && rule.includes('padding:');
});

check('C2-2 左栏退为支撑：navside 收窄到 ≤180px，且吸顶三件套（sticky + align-self + max-height）一件都没丢', () => {
  const rule = (CT.match(/^\.navside \{[^}]*\}/m) || [''])[0];
  if (!rule) { console.log('     规则缺失'); return false; }
  const m = rule.match(/width:\s*(\d+)px/);
  const w = m ? Number(m[1]) : 999;
  if (w > 180) console.log('     当前宽度 ' + w + 'px');
  return w <= 180
    && rule.includes('position: sticky')
    && rule.includes('align-self: flex-start')
    && rule.includes('max-height:');
});

check('C2-3 骨架条与树区之间有一条全宽发丝线：spine-bar 带 border-bottom，且不再是"两块之间纯靠留白"', () => {
  const rule = (CT.match(/^\.spine-bar \{[^}]*\}/m) || [''])[0];
  return !!rule && rule.includes('border-bottom: 1px solid var(--border)') && rule.includes('padding-bottom');
});

/* ★B5-c（V3.8.33）：C2 的最后一件 —— 过滤条并入 hero 工具行。
   病根：它横在引导条与项目舱之间，把树区拦腰切成两段；而它表达的是"当前视图被什么收窄"，属页头状态。
   判据钉**位置**（在 hero 动作行内、且在画布之前）与**形态**（单行胶囊），不钉观感。 */
check('C2-4 筛选态提示条在 hero 动作行内，且在树画布之前 —— 不再横在引导条与项目舱之间', () => {
  const heroStart = CT.indexOf('<section class="hero">');
  const heroEnd = CT.indexOf('</section>', heroStart);
  if (heroStart < 0 || heroEnd < 0) { console.log('     hero 区切片失败'); return false; }
  const heroBlock = CT.slice(heroStart, heroEnd);
  const at = CT.indexOf('class="hero-filter"');
  const canvasAt = CT.indexOf('class="canvas-inner"');
  const inHero = heroBlock.includes('class="hero-filter"');
  const beforeCanvas = at >= 0 && canvasAt >= 0 && at < canvasAt;
  /* 旧横幅类名必须整体消失（模板与样式都不得残留，否则就是两处各画一份） */
  const legacyGone = !CT.includes('class="filter-bar"') && !/^\.fb-(t|n|clear)\b/m.test(CT);
  if (!inHero || !beforeCanvas || !legacyGone) {
    console.log('     hero 内=' + inHero + ' / 画布前=' + beforeCanvas + ' / 旧类已清=' + legacyGone);
    return false;
  }
  return true;
});

check('C2-5 它是动作行里的一枚胶囊（inline-flex + 999px，宽度由内容决定），不是整宽横幅：不带 margin-bottom 撑行', () => {
  const rule = (CT.match(/^\.hero-filter \{[^}]*\}/m) || [''])[0];
  if (!rule) { console.log('     规则缺失'); return false; }
  const pill = rule.includes('display: inline-flex') && rule.includes('border-radius: 999px');
  const noBlockGap = !rule.includes('margin-bottom');
  if (!pill || !noBlockGap) console.log('     胶囊=' + pill + ' / 无块级下边距=' + noBlockGap);
  return pill && noBlockGap;
});

/* ============ C3 · 视图过渡 ============ */
check('C3-1 形态切换走 Transition 且三分支各有 key：没有 key 时同标签节点会被复用，过渡根本不触发', () => {
  return CT.includes('<Transition name="viewfade" mode="out-in">')
    && CT.includes(':key="\'lv-\' + layerView"')
    && CT.includes('key="pano"')
    && CT.includes('key="tower"')
    && CT.includes('</Transition>');
});

check('C3-2 过渡参数与降级都在：150ms + 8px 上浮；reduced-motion 下彻底不加过渡（不是缩短时长）', () => {
  return CT.includes('transition: opacity 150ms ease, transform 150ms ease')
    && CT.includes('transform: translateY(8px)')
    && /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,220}transition: none/.test(CT);
});

/* ============ C4 · 圆角层级 ============ */
check('C4-1 同族同圆角：板 xl（18）/ 项目舱 · 泳道 · 层级列表 lg（14）——三种视图形态的节点卡圆角一致。★V3.9.6 重指带备案（方向台视觉聚焦）：原锚把泳道写成 `background: var(--surface); border-radius: var(--radius-lg)` 连写，等于把"泳道必须有底色"也钉进了圆角判据 —— 本轮泳道改为透明底（与项目舱、指标同一条"去容器底色"的决定），底色不该由圆角判据代管。重指后只钉**圆角同族**这条本意，底色归 dead-css / theme-audit 的视觉走查管', () => {
  const board = (CT.match(/^\.canvas-inner \{[^}]*\}/m) || [''])[0];
  const tower = (TOWER.match(/border-radius: var\(--radius-lg\)/) || [''])[0];
  const lane = (PANO.match(/border-radius: var\(--radius-lg\)/) || [''])[0];
  const list = (LIST.match(/border-radius: var\(--radius-lg\)/) || [''])[0];
  if (!board.includes('--radius-xl') || !tower || !lane || !list) {
    console.log('     板 xl=' + board.includes('--radius-xl') + ' / 舱 lg=' + !!tower + ' / 泳道 lg=' + !!lane + ' / 列表 lg=' + !!list);
    return false;
  }
  return true;
});

check('C4-2 没有游离的大圆角：四个方向台组件里不出现 20px 以上的字面量圆角（胶囊用 999px 表达，不算游离）', () => {
  const bad = [];
  for (const [name, src] of [['CompassTree', CT], ['CompassTower', TOWER], ['CompassPano', PANO], ['CompassLayerList', LIST]]) {
    const hit = (src.match(/border-radius:\s*(2\d|3\d|4\d)px/g) || []);
    if (hit.length) bad.push(name + ':' + hit.join(','));
  }
  if (bad.length) console.log('     ' + bad.join(' | '));
  return bad.length === 0;
});
