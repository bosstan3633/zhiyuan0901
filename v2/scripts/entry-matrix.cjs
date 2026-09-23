#!/usr/bin/env node
/**
 * R157 · AI 入口能力矩阵（生成 + 双向对账门禁）
 *
 * 真源：src/shared/ai/jobs/registry.ts（纯声明表，零运行时依赖——见该文件头注）。
 * 本脚本做四件事：
 *   ① 正向：声明的工厂必须真实存在（export function <factory> 在 factoryFile 里）
 *   ② 反向：源码里每个 build*Job 调用点（含宿主文件）必须被注册表覆盖 —— **未登记即红**（04-63 任务书 #3）
 *   ③ 能力对账：caps 声明了的能力必须在工厂/内联函数源码区间里找得到证据；反之，区间里出现的
 *      能力键而未声明，同样红（防"代码长了能力、矩阵不知道"）
 *   ④ 负向自检：影子改两处声明（删一条入口 / 抹掉一个能力声明）各自必须变红 —— 防断言恒真
 *
 * 用法：node scripts/entry-matrix.cjs [--out=<markdown 落盘路径>]
 * 退出码：0 全绿；1 有失败（含负向自检失败）。regression.cjs 会以子进程方式跑本脚本。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const REGISTRY = path.join(SRC, 'shared', 'ai', 'jobs', 'registry.ts');

/* ── 极简扫描器：从 TS 源里抠出一个「顶层 [] 字面量」，剥掉注释后可安全 eval ── */
function extractArray(src, varName) {
  const at = src.indexOf(`export const ${varName}`);
  if (at < 0) throw new Error(`registry.ts 里找不到 export const ${varName}`);
  const lb = src.indexOf('[', src.indexOf('=', at));
  let i = lb, depth = 0, out = '', line = true;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (line && c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; line = true; continue; }
    if (line && c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i++; continue; }
    if (c === "'") { out += c; i++; while (i < src.length) { out += src[i]; if (src[i] === '\\') { out += src[i + 1] || ''; i += 2; continue; } if (src[i] === "'") break; if (src[i] === '\n') throw new Error('字符串跨行？'); i++; } line = false; continue; }
    if (c === '\n') { out += '\n'; line = true; continue; }
    if (c === '[') depth++;
    if (c === ']') { depth--; if (depth === 0) { out += ']'; break; } }
    if (!line || !/\s/.test(c)) line = c !== ' ' && c !== '\t' ? false : line;
    out += c;
  }
  return new Function('return ' + out)();
}

/* ── 源码区间：工厂函数体 / 宿主内联函数体（剥注释后再对账，防注释假阳性）── */
function regionOf(file, startRe, endRe) {
  const txt = fs.readFileSync(path.join(SRC, file), 'utf8');
  const m = startRe.exec(txt);
  if (!m) return null;
  const tail = txt.slice(m.index + 1);
  const em = endRe.exec(tail);
  const body = em ? tail.slice(0, em.index) : tail;
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/(^|[^:'"])\/\/.*$/, '$1')).join('\n');
}
const factoryRegion = (file, name) =>
  regionOf(file, new RegExp(`export function ${name}\\s*\\(`), /\nexport |(?:^|\n)function /);
const inlineRegion = (file, anchor) =>
  regionOf(file, new RegExp(`function ${anchor}\\s*\\(`), /\n(?:async )?function /);

/* ── 能力键 → 源码证据正则（双向对账共用同一套，杜绝"两把尺子"）──
 * 键型证据统一加 (^|[^.\w'"]) 守卫：排掉 bag.steps : 这类「属性名 + 三元冒号」假阳性
 * （2026-09-23 实踩：chain.ts:86 `bag.steps : bag.items` 曾把步骤条误判成已接）。 */
const KEY = (k) => new RegExp(`(^|[^.\\w'"])${k}\\s*:`);
const CAP_EVIDENCE = {
  before:      KEY('before'),
  paneMode:    KEY('paneMode'),
  impact:      KEY('impact'),
  confirm:     KEY('confirm'),
  steps:       KEY('steps'),
  persona:     /(^|[^.\w'"])persona\s*:|\.persona\s*=/,
  promptScope: KEY('promptScope'),
  secondary:   KEY('secondary'),
  rawText:     KEY('rawText'),
  autoReport:  /(\bautoReport\b|withReport\s*\()/,
  resave:      /(\bresave\b|withReport\s*\()/,
  run:         KEY('run'),
  apply:       KEY('apply'),
};

/* 错误汇：accounting 每次进把自己 errs 挂上来 —— capsCheck/entryRegion 的 bad() 必须流进**当次**对账，
 * 否则负向自检拿到的是空壳（2026-09-23 实踩：首版 bad 推模块级数组，负向 B 恒不红）。 */
let sink = [];
const bad = (msg) => sink.push(msg);

function entryRegion(e) {
  if (e.kind === 'job') {
    if (!e.factory || !e.factoryFile) { bad(`[${e.id}] job 型缺 factory/factoryFile`); return null; }
    const r = factoryRegion(e.factoryFile, e.factory);
    if (r === null) bad(`[${e.id}] 工厂 ${e.factory}() 在 ${e.factoryFile} 里找不到（正向对账失败）`);
    return r;
  }
  if (e.kind === 'inline') {
    if (!e.anchor) { bad(`[${e.id}] inline 型缺 anchor`); return null; }
    const host = e.hosts[0];
    const r = inlineRegion(host, e.anchor);
    if (r === null) bad(`[${e.id}] 内联函数 ${e.anchor}() 在 ${host} 里找不到`);
    else if (!/aiJob\.value\s*=\s*\{|aiAdviceJob\.value\s*=\s*|aiOpenJob\(/.test(r)) bad(`[${e.id}] ${e.anchor}() 区间里没有 aiJob/aiAdviceJob 赋值或 aiOpenJob( —— 它真的是 AI 入口吗`);
    return r;
  }
  /* search 型：只验证锚点函数确实被宿主引用 */
  const host = e.hosts[0];
  const txt = fs.readFileSync(path.join(SRC, host), 'utf8');
  if (e.anchor && !txt.includes(e.anchor)) bad(`[${e.id}] 锚点 ${e.anchor} 在 ${host} 里找不到`);
  return null;
}

function capsCheck(e, region) {
  const caps = e.caps || {};
  for (const [k, v] of Object.entries(caps)) {
    if (!(k in CAP_EVIDENCE)) { bad(`[${e.id}] caps.${k} 不是已知能力键（两处同步：AI_CAP_KEYS / CAP_EVIDENCE）`); continue; }
    if (!v) continue;
    const ev = CAP_EVIDENCE[k];
    if (!ev.test(region)) { bad(`[${e.id}] caps.${k}=true 但源码区间里没有证据（${ev}）——声明与代码漂移`); }
    if (k === 'promptScope' && v !== true) {
      const want = `promptScope: '${v}'`;
      if (!region.includes(want)) bad(`[${e.id}] caps.promptScope='${v}' 与源码字面量不符`);
    }
    if (k === 'paneMode' && v !== true) {
      const want = `paneMode: '${v}'`;
      if (!region.includes(want)) bad(`[${e.id}] caps.paneMode='${v}' 与源码字面量不符`);
    }
  }
  /* 反向：区间里出现能力证据但没声明 → 红 */
  for (const [k, ev] of Object.entries(CAP_EVIDENCE)) {
    if (caps[k]) continue;
    if (ev.test(region)) bad(`[${e.id}] 源码区间里有 ${k} 的证据但 caps 未声明（矩阵漏记）`);
  }
}

/* ── 反向全量：扫源码里的 build*Job 调用点，必须全部被登记 ── */
function scanCallSites() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!/\.(ts|vue)$/.test(f.name)) continue;
      const rel = path.relative(SRC, p).replace(/\\/g, '/');
      if (rel.startsWith('shared/ai/')) continue;               /* 工厂定义处不算调用点 */
      const txt = fs.readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').map(l => l.replace(/(^|[^:'"])\/\/.*$/, '$1')).join('\n');
      for (const m of txt.matchAll(/\b(build[A-Z]\w*Job)\s*\(/g)) out.push({ factory: m[1], host: rel });
    }
  };
  walk(SRC);
  return out;
}

function accounting(entries) {
  const errs = [];
  sink = errs;
  const callSites = scanCallSites();
  const covered = new Set();
  for (const e of entries) {
    if (!e.id || !e.title || !e.kind || !Array.isArray(e.hosts) || !e.hosts.length) { errs.push(`入口声明缺关键字段（id/title/kind/hosts）：${JSON.stringify(e).slice(0, 80)}`); continue; }
    if (!['job', 'inline', 'search'].includes(e.kind)) errs.push(`[${e.id}] kind 非法：${e.kind}`);
    if (!['proactive', 'passive'].includes(e.family)) errs.push(`[${e.id}] family 非法：${e.family}（R158 二分的字段，必须是两分之一）`);
    const region = entryRegion(e);
    if (region !== null) capsCheck(e, region);
    if (e.kind === 'job') for (const h of e.hosts) covered.add(e.factory + '@' + h);
  }
  for (const cs of callSites) {
    if (!entries.some(e => e.kind === 'job' && e.factory === cs.factory)) {
      errs.push(`未登记的 AI 入口：${cs.factory}() 在 ${cs.host} 被调用，但注册表里没有它的条目（04-63 #3）`);
      continue;
    }
    if (!covered.has(cs.factory + '@' + cs.host)) {
      errs.push(`调用点漏登记：${cs.factory}() 在 ${cs.host} 的挂载不在任何条目的 hosts 里`);
    }
  }
  const ids = entries.map(e => e.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) errs.push(`注册表 id 重复：${dup.join(', ')}`);
  return { errs, callSites };
}

/* ── 负向自检：影子改声明，必须各自变红（防"断言恒真"）── */
function negativeSelfTest(srcText) {
  const results = [];
  /* A：删掉第一条入口 → 反向对账必须红 */
  const firstEntry = /(\{\s*\n\s*id: ')[^]*?(\n  \},)/;
  const mA = srcText.match(firstEntry);
  if (!mA) { results.push(['A 删条目', false, '没匹配到第一条入口（注册表结构变了？）']); }
  else {
    const mutated = srcText.slice(0, mA.index) + srcText.slice(mA.index + mA[0].length);
    try { results.push(['A 删一条入口', accounting(extractArray(mutated, 'AI_ENTRIES')).errs.length > 0, '删除后对账仍全绿=门禁恒真']); }
    catch (e) { results.push(['A 删一条入口', true, '']); }
  }
  /* B：抹掉 card-enrich 的 before 声明 → 能力对账必须红 */
  const mB = srcText.match(/before: true, promptScope: 'enrich:card'/);
  if (!mB) { results.push(['B 抹声明', false, "没找到 card-enrich 的 before 声明样例"]); }
  else {
    const mutated = srcText.replace("before: true, promptScope: 'enrich:card'", "promptScope: 'enrich:card'");
    try {
      const errsB = accounting(extractArray(mutated, 'AI_ENTRIES')).errs;
      results.push(['B 抹一个能力声明', errsB.some(x => x.includes('card-enrich')), errsB.length ? '变红但没点名 card-enrich：' + errsB[0] : '抹掉声明后未变红=能力对账恒真']);
    }
    catch (e) { results.push(['B 抹一个能力声明', true, '']); }
  }
  return results;
}

/* ── 主流程 ── */
const srcText = fs.readFileSync(REGISTRY, 'utf8');
const entries = extractArray(srcText, 'AI_ENTRIES');
const capKeys = extractArray(srcText, 'AI_CAP_KEYS');
const { errs, callSites } = accounting(entries);

/* 矩阵表（由代码生成——文档里的表必须从这里复制，不许手写） */
const cell = (v) => v === undefined || v === false ? '—' : (v === true ? '✓' : String(v));
const shortHosts = (hosts) => hosts.map(h => h.replace(/^newtab\//, '').replace(/^components\//, 'c/').replace(/^views\//, 'v/').replace(/^composables\//, 'x/')).join('<br>');
const head = '| # | 入口 | 分 | 型 | 宿主 | ' + capKeys.map(k => ({ before: '左栏', paneMode: '模式', impact: '影响条', confirm: '二次确认', steps: '步骤条', persona: '角色', promptScope: '指令作用域', secondary: '次通道', autoReport: '自动落卡', resave: '存为卡', run: '自定义run', apply: '采纳' }[k] || k)).join(' | ') + ' |';
const rows = entries.map((e, i) => `| ${i + 1} | ${e.title} \`${e.id}\` | ${e.family === 'proactive' ? '主动' : '被动'} | ${e.kind} | ${shortHosts(e.hosts)} | ` + capKeys.map(k => cell((e.caps || {})[k])).join(' | ') + ' |');
const counts = {
  total: entries.length,
  job: entries.filter(e => e.kind === 'job').length,
  inline: entries.filter(e => e.kind === 'inline').length,
  search: entries.filter(e => e.kind === 'search').length,
  factories: new Set(entries.filter(e => e.factory).map(e => e.factory)).size,
  callSites: callSites.length,
  hostFiles: new Set(entries.flatMap(e => e.hosts)).size,
};
const summary = `> 由 \`scripts/entry-matrix.cjs\` 生成（R157）：**${counts.total} 个 AI 能力入口**（job ${counts.job} · inline ${counts.inline} · search ${counts.search}）· 工厂 ${counts.factories} 个 · 调用点 ${counts.callSites} 处 · 宿主文件 ${counts.hostFiles} 个。\n> 能力列 \`—\` = 未声明（对账过源码确实没有）：**影响条 / 二次确认 / 步骤条 / 自定义 run 四列全空** —— R154 只建了契约地基，尚无任何工厂喂（这正是矩阵要让遗漏自己浮出来的地方）。`;

const md = ['<!-- 由 scripts/entry-matrix.cjs 生成，勿手改 -->', summary, '', head, '| ' + capKeys.map(() => '---').join(' | ') + ' |'].join('\n') + '\n' + rows.join('\n') + '\n';
console.log(summary);
console.log('');
console.log(md.split('\n').slice(4).join('\n'));

const neg = negativeSelfTest(srcText);
console.log('');
for (const [name, ok, why] of neg) console.log((ok ? '✅' : '❌') + ` 负向自检 ${name}：` + (ok ? '按预期变红' : why));

const negBad = neg.filter(([, ok]) => !ok).length;
if (errs.length) { console.log('\n❌ 能力矩阵对账失败 ' + errs.length + ' 条：'); for (const e of errs) console.log('  - ' + e); }
else console.log(`\n✅ 能力矩阵对账通过：${counts.total} 条声明 ↔ 源码 ${counts.callSites} 个调用点双向一致`);

const outArg = process.argv.find(a => a.startsWith('--out='));
if (outArg) { fs.writeFileSync(outArg.slice(6), md, 'utf8'); console.log('矩阵表已落盘 → ' + outArg.slice(6)); }
process.exit(errs.length || negBad ? 1 : 0);
