#!/usr/bin/env node
/**
 * 入口静态闭包 AI 字面量闸（R149 定的口径，R151 落成脚本，免得每轮现推）
 * 从 newtab 入口沿「静态 import」爬闭包，逐个查 AI 实现/场景字面量——入口链路上必须全 0，
 * 否则首屏就要解析 AI 栈。动态 import / defineAsyncComponent 不算（懒 chunk）。
 * 用法：node scripts/entry-literals.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ENTRY = path.join(SRC, 'newtab/main.ts');

/** 15 项：AI 传输层、存储键、job 后台化内部件、场景系统提示词、抽屉行契约
 *  （R151 曾把 flattenTaskTree 移出——它是 R144-a 的子任务展平工具，与 AI 无关却住在启动链路上。
 *   R154 订正：注释原写「16 项」，数组实为 15 项，属清单坏账。） */
const LITERALS = [
  'chat/completions', 'zy_ai_v1', 'autoReport', 'openJob', 'withReport',
  '检索参谋', 'semanticSearchSystem', 'rerank', 'batchG', 'thesisDraftSystem',
  '可被反驳', '资源调度参谋', '做结构性体检', 'AiRow', 'searchLines',
];
/** R151 口径修正：旧清单里的 flattenTaskTree 移出——它是 R144-a 的子任务展平工具（shared/utils/taskLinks），
 *  与 AI 无关却住在启动链路上，继续留着只会每轮产出一条假阳性。 */

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
/** 只剥「注释行 + 纯类型声明行」：type/`import('…').X` 类型别名编译期即消失，不构成启动依赖 */
const STRIP = /^\s*(?:\/\/|\/\*|\*|import\s+type\b|export\s+type\b|type\s+[A-Za-z_$][\w$]*\s*[=:<])/

function resolve(spec, fromFile) {
  let base = null;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  if (!base) return null;
  const cands = [base, base + '.ts', base + '.vue', base + '.js', path.join(base, 'index.ts')];
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return c; } catch (e) { /* 下一个候选 */ } }
  return null;
}

const seen = new Set();
const aiEdges = [];
const walk = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  const txt = fs.readFileSync(file, 'utf8');
  for (const m of txt.matchAll(STATIC_IMPORT)) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    const next = resolve(spec, file);
    if (!next) continue;
    if (next.includes('/shared/ai/') && !/^import\s+type\b/.test(m[0])) aiEdges.push(path.relative(SRC, file) + ' → ' + path.relative(SRC, next));
    walk(next);
  }
};
walk(ENTRY);

const files = [...seen].sort();
const codeOf = f => fs.readFileSync(f, 'utf8').split('\n').filter(ln => !STRIP.test(ln)).join('\n');
/* ASCII 字面量按词边界匹配（AiRowLite 这类本地类型别名不该冒领 AiRow）；中文/带斜杠的按子串 */
const matchIn = (txt, l) => /^[A-Za-z]/.test(l) ? new RegExp('\\b' + l.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\b').test(txt) : txt.includes(l)
const hits = LITERALS.map(l => {
  /* R165-A 口径修正（R159 键字典豁免）：shared/storage/keys.ts 是全站存储键字面量的唯一真源（R159-6 门禁
   * 要求其余文件零裸键名），AI 键名 zy_ai_v1 作为**元数据字符串**必然住在这里——它不是 AI 运行时依赖，
   * 键名本身也不含任何凭证。豁免只认这一个文件、且 aiEdges（对 src/shared/ai/** 的静态依赖）照旧零容忍。 */
  const where = files.filter(f => matchIn(codeOf(f), l) && path.relative(path.join(__dirname, '..'), f) !== 'src/shared/storage/keys.ts')
    .map(f => path.relative(path.join(__dirname, '..'), f));
  return { l, where };
});
const bad = hits.filter(h => h.where.length);

console.log(`入口静态闭包 ${files.length} 文件：\n  ` + files.map(f => path.relative(path.join(__dirname, '..'), f)).join('\n  '));
for (const h of hits) console.log((h.where.length ? '❌ ' : '✅ ') + h.l + (h.where.length ? ' → ' + h.where.join(', ') : ''));
if (aiEdges.length) console.log('\n❌ 入口闭包里的 AI 运行时静态依赖：\n  ' + aiEdges.join('\n  '));
else console.log('\n✅ 入口闭包对 src/shared/ai/** 零静态运行时依赖（import type 与 dynamic import 不计）');
let chunkBad = 0;
const htmlPath = path.join(__dirname, '..', 'dist', 'src', 'newtab', 'index.html');
if (fs.existsSync(htmlPath)) {
  const m = (fs.readFileSync(htmlPath, 'utf8').match(/src="\/(assets\/[^"]+\.js)"/) || [])[1];
  if (!m) { console.log('\n⚠ 没能从 dist/src/newtab/index.html 里认出入口 chunk（先跑 npm run build）'); process.exit(1) }
  const chunk = fs.readFileSync(path.join(__dirname, '..', 'dist', m), 'utf8');
  const inChunk = LITERALS.filter(l => chunk.includes(l));
  chunkBad = inChunk.length;
  console.log(`\n入口 chunk ${m}：${inChunk.length ? '命中 ' + inChunk.join('、') : LITERALS.length + ' 项全 0 ✓'}`);
} else {
  console.log('\n（dist 不存在，跳过入口 chunk 一栏——先跑 npm run build 再复核）');
}
const fail = bad.length + chunkBad + aiEdges.length;
console.log(fail ? `\n入口字面量：源码闭包 ${bad.length} 项命中、chunk ${chunkBad} 项命中 → 启动链路被 AI 依赖污染` : `\n入口字面量：源码闭包与入口 chunk 双向 ${LITERALS.length} 项全 0 ✓`);
process.exit(fail ? 1 : 0);
