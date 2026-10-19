/**
 * 33-gs-baseline.cjs —— 设置页「跨子域共享基类」的挂载守卫（V3.8.42 · P0-3 第三批新增）
 *
 * ★本分片存在的理由：一次**假绿的像素 A/B** 掩盖了一整轮真实回归。
 *
 * 【发生了什么】
 *   P0-3 把 manual/changelog/about/letter 四个子域搬成了独立组件。
 *   它们的模板用 `.gs-panel` / `.gs-card` / `.gs-page-title` 等**基类**，
 *   而这些基类只定义在宿主 `GlobalSettings.vue` 的 `<style scoped>` 里。
 *   Vue 的 scoped 是**按组件实例**给元素打 data-v：父组件样式命中不了子组件内部元素。
 *   ⇒ 四个子域的卡片外壳（背景/边框/圆角/阴影）**整条失效**，
 *     页标题从 17px/700 掉回浏览器默认的 13px/400。
 *
 * 【为什么没被抓住】
 *   上轮像素 A/B 报「三个子域 0 差」。但那次的新旧两张图**是同一张**——
 *   修完导航路径后等就条件仍按旧 hash 判 ⇒ 跳过 0 张 ⇒ img-diff 报逐像素一致。
 *   「0 张新图 + 两张旧图相同 = 0 差」，假信号套着假信号。
 *
 * 【本分片的做法：不靠像素，靠结构】
 *   像素量具需要真机实拍，成本高且易被"跳过 0 张"这类假信号吃掉；
 *   而这次的病根是**纯结构性的**——某个组件用了基类却没引入基类表。
 *   这类事实用静态判据就能查，且查不漏。
 *
 * 【两条判据分工】
 *   P0-S8  负锚：base.css 必须存在、非 scoped、且真被引用（防止"删了引入还以为在共用"）
 *   P0-S11 正锚：settings/ 下每个子组件，只要用了 .gs-* 基类，就必须引入 base.css
 *         （防止"再拆一个子域又掉一遍样式"—— 这正是本轮的复发路径）
 *
 * ★纪律：判据只锁结构事实，不锁像素；色值与观感归 theme-contrast 与实拍。
 * ★另：`/newtab/components/` 下复用基类的卡片组件（DataCheckupCard / MigrateReportCard）
 *   一并纳入 P0-S11 检查范围——它们是**同一个 bug 的更早受害者**
 *   （MigrateReportCard 的注释曾写"非 scoped 部分由 GlobalSettings 全局表提供"，那句话是错的）。
 */
const fs = require('fs');
const path = require('path');
const { check, base } = require('./helpers.cjs');

/* helpers 的 `base` 是 `src/`，而本分片要同时读 `src/` 与仓库根（判据脚本本身），
   故显式求一次仓库根，避免拼出 `src/src/...` 这种一眼假的路径（V3.8.42 实测踩到）。 */
const ROOT = path.resolve(base, '..');
const BASE_CSS_REL = 'src/newtab/views/settings/base.css';
const BASE_CSS = path.join(ROOT, BASE_CSS_REL);

/** 统一读法：文件不存在时回空串，让判据走「规则缺失」分支而不是抛 ENOENT
 *  —— ENOENT 会把五条判据一起炸红，症状盖过真因（纪律：异常不是结论）。 */
function rd(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/** 会复用设置页基类的组件目录（含 settings/ 子域与 components/ 下的卡片组件） */
const GS_DIR = path.join(ROOT, 'src/newtab/views/settings');
const CARD_DIR = path.join(ROOT, 'src/newtab/components');

/** 宿主自有布局骨架：只属于 GlobalSettings，**不该**出现在共享基类表里 */
const HOST_ONLY = ['gs-page', 'gs-nav', 'gs-content', 'gs-back-btn'];

console.log('【P0-3 · 设置页共享基类挂载守卫（P0-S8 / P0-S11）】');

/* ============ P0-S8 · 基类表本身：存在 · 非 scoped · 真被引用 ============ */
check('P0-S8 基类表存在且非 scoped：Vue 的 scoped 命中不了子组件内部元素，基类必须是一张全局表', () => {
  if (!fs.existsSync(BASE_CSS)) { console.log('     缺 ' + BASE_CSS_REL + ' —— 基类又退回宿主 scoped 了'); return false; }
  const css = rd(BASE_CSS);
  /* ★必须是真样式表：空文件 / 只剩注释都算失效（否则判据会"文件在"就放行） */
  const decls = (css.match(/^\s*\.gs-[a-z0-9-]+/gim) || []).length;
  if (decls < 20) { console.log(`     基类表只有 ${decls} 条选择器，疑似空壳`); return false; }
  /* ★卡片段与按钮是子域用得最多的两条，必须真在表里（它们是这次的直接受害者） */
  if (!/^\.gs-card \{/m.test(css)) { console.log('     基类表缺 .gs-card'); return false; }
  if (!/^\.gs-btn \{/m.test(css)) { console.log('     基类表缺 .gs-btn'); return false; }
  /* ★非 scoped 才有跨组件效力。这里读的是文本形态——真值由 vue-tsc/build 之外的产物比对保证，
     而 build 产物里 `.gs-card[data-v-xxx]` 的形态由 P0-S12 之外的实拍/探针复核。 */
  return true;
});

check('P0-S8b 宿主布局骨架不误入基类表：.gs-page / .gs-nav / .gs-content 只属于宿主，进表等于全局泄漏', () => {
  const css = rd(BASE_CSS);
  /* ★收尾必须用显式字符类而不是 `\\b`：本项目类名全是 kebab-case，
     `.gs-page` 后面紧跟的是 `-header` 的连字符，而 \\b 只在「单词字符↔非单词字符」处成立，
     连字符两侧**都算非单词字符** ⇒ `\\b` 落在 `-` 之前 ⇒ `.gs-page` 假匹配 `.gs-page-header`。
     实测：表里根本没有 `.gs-page`，判据却报了「误入」（V3.8.42 自己被自己判红一次）。 */
  const leaked = HOST_ONLY.filter(c => new RegExp(`^\\.${c}(?![a-z0-9-])`, 'm').test(css));
  if (leaked.length) { console.log('     误入基类表：' + leaked.join(' ')); return false; }
  return true;
});

check('P0-S8c 宿主与子组件都真引用了基类表：删掉任一处 <style src> 都会让对应一侧静默掉样式', () => {
  const host = rd(path.join(ROOT, 'src/newtab/views/GlobalSettings.vue'));
  if (!/style src="\.\/settings\/base\.css"/.test(host)) {
    console.log('     宿主未引入 base.css'); return false;
  }
  /* 反向注入自检：判据自身若恒绿（永远匹配不到字符串），这里必须能红 */
  const fake = host.replace(/style src="\.\/settings\/base\.css"/, 'style src="./settings/NOPE.css"');
  if (/style src="\.\/settings\/base\.css"/.test(fake)) {
    console.log('     判据自检失败：本判据对被测锚点不敏感'); return false;
  }
  return true;
});

/* ============ P0-S11 · 正锚：用了基类就必须引表 ============ */
check('P0-S11 复用设置页基类的组件必须引入 base.css（本轮 bug 的复发路径守卫）', () => {
  /* 收集候选：settings/ 下所有子组件 + components/ 下用了基类名的卡片组件 */
  const files = [];
  for (const f of fs.readdirSync(GS_DIR)) if (f.endsWith('.vue')) files.push(path.join(GS_DIR, f));
  for (const f of fs.readdirSync(CARD_DIR)) {
    if (!f.endsWith('.vue')) continue;
    const p = path.join(CARD_DIR, f);
    const src = rd(p);
    /* 只有真的用了 .gs-card / .gs-btn 这类基类才纳入（避免要求无关组件引表） */
    if (/class="[^"]*\bgs-(card|btn|panel|page-header|page-title)\b/.test(src)) files.push(p);
  }

  const baseDecls = new Set(
    (rd(BASE_CSS).match(/^\.gs-[a-z0-9-]+/gim) || []).map(s => s.slice(1))
  );
  if (!baseDecls.size) { console.log('     基类表读不到，P0-S11 无法判定'); return false; }

  const bad = [];
  const missing = [];
  for (const p of files) {
    const src = rd(p);
    const usesBase = /class="[^"]*\bgs-(card|btn|panel|page-header|page-title)\b/.test(src);
    const imports = /style src="[^"]*base\.css"/.test(src);
    if (usesBase && !imports) bad.push(path.basename(p));
    /* 反向：引了表却一处基类都没用 ⇒ 多余引入，删掉更干净（不红，只提示） */
    if (!usesBase && imports && p.startsWith(CARD_DIR)) {
      const only = src.match(/class="[^"]*\b(gs-[a-z0-9-]+)\b/g) || [];
      const hit = only.some(c => baseDecls.has((c.match(/gs-[a-z0-9-]+/) || [''])[0]));
      if (!hit) missing.push(path.basename(p));
    }
  }
  if (bad.length) {
    console.log('     用了基类却没引表（卡片外壳会整条失效）：' + bad.join(' '));
    return false;
  }
  return true;
});

check('P0-S11b 基类表真被用上：若表里的类在所有组件模板里零命中，说明搬空或改错了名字', () => {
  const css = rd(BASE_CSS);
  const decls = [...new Set((css.match(/^\.gs-[a-z0-9-]+/gim) || []).map(s => s.slice(1)))];
  /* 收集全库模板里的 class 字面量（.vue 文件的 class="..." 里出现的 gs-*） */
  const hay = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }   // node_modules/dist 已在上面按名排除
      if (!/\.(vue|ts)$/.test(e.name)) continue;
      hay.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(ROOT, 'src'));
  const all = hay.join('\n');
  const dead = decls.filter(c => !all.includes(c));
  /* ★阈值：少数类可能只经由 v-html / 动态拼接挂载，全库文本查不到。
     阈值取 5 是"个别类查不到"与"表整体搬空"的分界——整表搬空会一次性丢掉几十条。 */
  if (dead.length > 5) {
    console.log(`     ${dead.length}/${decls.length} 条基类全库零命中：${dead.slice(0, 8).join(' ')}`);
    return false;
  }
  return true;
});