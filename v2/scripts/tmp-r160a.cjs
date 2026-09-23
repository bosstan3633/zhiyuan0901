const fs = require('fs');
let n = 0;
function rep(file, old, nw, expect = 1) {
  let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const c = s.split(old).length - 1;
  if (c === 0 && s.split(nw).length - 1 > 0) { console.log('↩︎ 跳过: ' + file + ' :: ' + old.slice(0, 34).trim()); return; }
  if (c !== expect) throw new Error('[' + file + '] 期望 ' + expect + ' 处，实得 ' + c + '：' + old.slice(0, 70));
  fs.writeFileSync(file, s.split(old).join(nw));
  n++;
}

/* ===== P4：RENDER_STEP 80 → 32（列表/卡片 + 全景右栏同口径） ===== */
rep('src/newtab/composables/useResourceView.ts', `const RENDER_STEP = 80`, `const RENDER_STEP = 32`);
rep('src/newtab/views/GlobalSettings.vue', `const PAN_RENDER_STEP = 80`, `const PAN_RENDER_STEP = 32`);
rep('scripts/regression.cjs', `const RENDER_STEP = 80`, `const RENDER_STEP = 32`, 2);
rep('scripts/regression.cjs', `PAN_RENDER_STEP=80`, `PAN_RENDER_STEP=32`);
rep('scripts/regression.cjs', `PAN_RENDER_STEP = 80`, `PAN_RENDER_STEP = 32`);

/* ===== A7：深链保全（R51-B5 白名单重定向退役） ===== */
{
  const f = 'src/newtab/main.ts';
  const L = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const s0 = L.findIndex((l) => l.includes('每次打开新标签页/刷新'));
  if (s0 < 0) throw new Error('未找到重定向块起点');
  let e0 = -1;
  for (let i = s0; i < s0 + 12; i++) { if (L[i] !== undefined && L[i].includes("router.replace('/')")) { e0 = i; break; } }
  if (e0 < 0) throw new Error('未找到 router.replace');
  // 含其后的收尾 }）
  let e1 = e0;
  while (e1 < L.length && !L[e1].includes('})')) e1++;
  const block = [
    '  // R160（A7）深链保全：新标签页是最高频落点——刷新/重开一律保留当前路由',
    '  // （/compass、/workspace、/recycle 等与 settings/manual 同等对待）；R51-B5 白名单重定向退役。'
  ];
  L.splice(s0, e1 - s0 + 1, ...block);
  fs.writeFileSync(f, L.join('\n'));
  console.log('✅ A7 深链保全已落（重定向块退役）');
  n++;
}

/* ===== 断言同步：R51-B5 / R51-1 重写 ===== */
{
  const f = 'scripts/regression.cjs';
  const L = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const idx = L.findIndex((l) => l.includes("check('R51-B5"));
  if (idx >= 0 && !L[idx].includes('R160（A7）')) {
    L[idx] = "check('R51-B5（R160-A7 重指）深链保全：刷新/重开一律保留当前路由（settings/manual 白名单重定向退役）', () => { const m = read('/newtab/main.ts'); return m.includes('R160（A7）深链保全') && !m.includes(\"router.replace('/')\"); });";
    n++;
  }
  const idx2 = L.findIndex((l) => l.includes("check('R51-1"));
  if (idx2 >= 0 && !L[idx2].includes('R160（A7）')) {
    L[idx2] = "check('R51-1 B5（R160-A7 重指）main.ts 不再强制回首页（方向树/项目详情/策展台深链全保留）', () => { const m = read('/newtab/main.ts'); return m.includes('R160（A7）') && !m.includes(\"startsWith('/compass/projects')\") && !m.includes(\"startsWith('/settings')\"); });";
    n++;
  }
  fs.writeFileSync(f, L.join('\n'));
}

/* ===== R160 新增断言 ===== */
let src = fs.readFileSync('scripts/regression.cjs', 'utf8').replace(/\r\n/g, '\n');
const BLOCK = `// ============== R160（A 批） · 性能收口：拼音两层表 / RENDER_STEP / 深链保全 ==============
console.log('【R160-A · 性能收口（拼音两层表 · RENDER_STEP 32 · 深链保全）】');
check('R160-1 拼音两层表替换 pinyin-pro：生成物 + 运行时零依赖（isPinyinReady 恒就绪）', () => { const t = read('/shared/utils/pinyinTable.ts'); const p = read('/shared/utils/pinyin.ts'); const g = read('/newtab/views/GlobalSettings.vue'); return t.includes('export const INITIALS =') && t.includes('export const FULLS =') && t.includes('export const PINYIN_RANGE_START') && !p.includes('pinyin-pro') && !p.includes("import('pinyin-pro')") && p.includes('export function isPinyinReady(): boolean {') && p.includes('return true') && g.includes('const PAN_RENDER_STEP = 32'); });
check('R160-2 全仓去 pinyin-pro 运行时引用 + 生成脚本入库', () => { const fs2 = require('fs'); const path2 = require('path'); const root = path2.resolve(__dirname, '..', 'src'); const hits = []; const walk = (d) => { for (const f of fs2.readdirSync(d)) { const p = path2.join(d, f); const st = fs2.statSync(p); if (st.isDirectory()) walk(p); else if (/\\.(ts|vue)$/.test(f)) { const s = fs2.readFileSync(p, 'utf8'); if (/pinyin-pro/.test(s)) hits.push(p.replace(/\\\\/g, '/')); } } }; walk(root); const vc = fs2.readFileSync(path2.resolve(__dirname, '..', 'vite.config.ts'), 'utf8'); return hits.length === 0 && vc.includes('gen-pinyin-table') === false; });
check('R160-3 增量渲染份额收紧：列表/卡片 RENDER_STEP=32（原 80）', () => { const u = read('/newtab/composables/useResourceView.ts'); return u.includes('const RENDER_STEP = 32') && u.includes('renderLimit.value += RENDER_STEP'); });
check('R160-4 A7 深链保全：main.ts 不再强制回首页（全路由保留）', () => { const m = read('/newtab/main.ts'); return m.includes('R160（A7）深链保全') && !m.includes("router.replace('/')"); });

`;
src = src.replace(`console.log('回归结果：' + pass + ' 通过 / ' + fail + ' 失败');`, BLOCK + `console.log('回归结果：' + pass + ' 通过 / ' + fail + ' 失败');`);
fs.writeFileSync('scripts/regression.cjs', src);
n++;
console.log('✅ R160-A 补丁完成，共 ' + n + ' 处');
