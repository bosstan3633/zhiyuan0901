const fs = require('fs');
const W = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(f + ' | 命中 ' + n + ' 次: ' + a.slice(0, 70));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(f, s);
  console.log('✅ ' + f);
};

/* ---- P4：pinyin-pro 降级为 devDependency ---- */
W('package.json', [
  [`    "pinia": "^2.2.4",
    "pinyin-pro": "^3.29.3",
    "vue": "^3.5.12",`,
   `    "pinia": "^2.2.4",
    "vue": "^3.5.12",`],
  [`    "playwright-core": "^1.63.0",
    "typescript": "^5.6.3",`,
   `    "pinyin-pro": "^3.29.3",
    "playwright-core": "^1.63.0",
    "typescript": "^5.6.3",`],
]);

/* ---- perf.cjs：M3 改名 + A1 触发门禁 ---- */
W('scripts/perf.cjs', [
  [`  push('M3_交互期长任务总计(ms)', lt.total, { M3_长任务次数: lt.count, M3_最大单任务ms: lt.max })`,
   `  // R164：M3 标注「合成压力测试」——它量的是合成库 + 合成操作序列下的布局/绘制，不是用户真实路径；
  // 用户体感口径 = M14 + 掉帧 + 各交互墙钟（真实路径见 --real 模式）。
  push('M3_合成压力测试_交互期长任务总计(ms)', lt.total, { M3_长任务次数: lt.count, M3_最大单任务ms: lt.max })`],
  [`  if (m6) push('M6a_整库JSON序列化(ms)', m6.json, { 'M6b_同载荷set写盘(ms)': m6.set, M6_载荷KB: m6.kb })

  await ctx.close()`,
   `  if (m6) push('M6a_整库JSON序列化(ms)', m6.json, { 'M6b_同载荷set写盘(ms)': m6.set, M6_载荷KB: m6.kb })

  // R164（A1）：ADR-02 复审条件量化——写盘 >50ms 或主数据 >2MB 即触发「启动单根 JSON 分域评估」（记录型门禁，随报告输出）
  const a1M6b = out.metrics['M6b_同载荷set写盘(ms)'] || 0
  const a1Kb = out.metrics['M6_载荷KB'] || 0
  const a1Hit = a1M6b > 50 || a1Kb > 2048
  out.metrics['A1_分域评估触发'] = a1Hit
    ? '触发：M6b=' + a1M6b + 'ms / 载荷=' + a1Kb + 'KB（阈值 50ms / 2048KB）'
    : '未触发（M6b=' + a1M6b + 'ms / 载荷=' + a1Kb + 'KB）'
  if (a1Hit) log('  ⚠ A1 触发：写盘或载荷超阈值 → 启动单根 JSON 分域评估（ADR-02）')

  await ctx.close()`],
]);

/* ---- regression：R39-2 迁移 + 新增 R164 段 ---- */
W('scripts/regression.cjs', [
  [`s.includes('DB_NAME = K.ASSETS_DB')`, `s.includes('DB_NAME = IDB_NAMES.ASSETS')`],
]);
{
  const F = 'scripts/regression.cjs';
  let L = fs.readFileSync(F, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const sec = `// ============== R164 · 度量与刹车（CRLF 门禁修复 / 增长门禁 / 键边界 / 依赖纪律 / 生成物二期 / A1 触发） ==============
console.log('【R164 · 度量与刹车】');
check('R164-1 ★代码索引门禁 CRLF 双修：索引读取归一化 + 脚本体积按 LF 计算（Windows checkout 不再 171 项全量误报）', () => { const g = read('/../scripts/gen-code-index.cjs'); return g.includes('R164') && g.includes('Buffer.byteLength') && (g.match(/CRLF/g) || []).length >= 1 && (g.match(/replace\\(\\/\\\\r\\\\n\\/g/g) || []).length >= 2; });
check('R164-2 ★增长门禁：GlobalSettings ≤3,565 行 + regression.cjs ≤5,500 行（超限即红并提示分片评估）', () => { const gs = read('/newtab/views/GlobalSettings.vue').split('\\n').length; const reg = fs.readFileSync(__filename, 'utf8').split('\\n').length; if (reg > 5500) console.error('   ⚠ regression.cjs 破 5,500 行 → 启动分片评估（04-65 §〇 拍板 4）'); return gs <= 3565 && reg <= 5500; });
check('R164-3 配额文案括号配对：App.vue 保存失败 toast 补齐右括号 + 破文案零残留', () => { const a = read('/newtab/App.vue'); return a.includes('请清理或导出后重试）') && !a.includes('请清理或导出后重试\`'); });
check('R164-4 ★键边界（A3）：K 只装 storage 键；IDB_NAMES / EXPORT_MARKERS 另立（非存储命名空间）', () => { const k = read('/shared/storage/keys.ts'); const a = read('/shared/storage/assets.ts'); const g = read('/newtab/views/GlobalSettings.vue'); const kBody = k.slice(k.indexOf('export const K'), k.indexOf('export const IDB_NAMES')); return k.includes('export const IDB_NAMES') && k.includes('export const EXPORT_MARKERS') && k.includes("ASSETS: 'zy_assets'") && k.includes("ASSET_PACK: 'zy_asset_pack'") && !kBody.includes('ASSETS_DB') && !kBody.includes('ASSET_PACK') && a.includes('IDB_NAMES.ASSETS') && !a.includes('K.ASSETS_DB') && g.includes('EXPORT_MARKERS.ASSET_PACK') && !g.includes('K.ASSET_PACK'); });
check('R164-5 ★依赖纪律：pinyin-pro 不进 dependencies（生成器专用 devDependency）+ 生成器仍可复现', () => { const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')); const g = read('/../scripts/gen-pinyin-table.cjs'); return !(pkg.dependencies && pkg.dependencies['pinyin-pro']) && !!(pkg.devDependencies && pkg.devDependencies['pinyin-pro']) && g.includes("require('pinyin-pro')"); });
check('R164-6 ★生成物防腐化二期：pinyinTable.ts 漂移即红（--check 与代码索引同法，含 CRLF 归一化）', () => { const g = read('/../scripts/gen-pinyin-table.cjs'); if (!(g.includes('--check') && g.includes('已漂移'))) return false; const r = require('child_process').spawnSync(process.execPath, [path.resolve(__dirname, '..', 'scripts', 'gen-pinyin-table.cjs'), '--check'], { encoding: 'utf8' }); return r.status === 0; });
check('R164-7 A1 触发门禁（记录型）：写盘 >50ms 或主数据 >2MB → perf 提示「启动分域评估」（ADR-02 复审条件量化）', () => { const p = read('/../scripts/perf.cjs'); return p.includes('分域评估') && p.includes('a1M6b > 50') && p.includes('a1Kb > 2048') && p.includes("A1_分域评估触发"); });
check('R164-8 M3 改名「合成压力测试」：不再冒充用户体感口径（真实路径走 --real）', () => { const p = read('/../scripts/perf.cjs'); return p.includes('M3_合成压力测试_交互期长任务总计(ms)') && p.includes('用户体感口径 = M14 + 掉帧'); });

console.log('回归结果：'`;
  const idx = L.findIndex((l) => l.startsWith("console.log('回归结果：'"));
  if (idx < 0) throw new Error('未找到汇总行');
  L.splice(idx, 0, ...sec.split('\n'));
  fs.writeFileSync(F, L.join('\n'));
  console.log('✅ regression.cjs（+R164-1~8）');
}
console.log('R164 批次补丁（续）完成');
