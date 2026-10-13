/* R169-EB 外带门禁实跑器（2026-09-26）
 * 背景：本机安全策略拦截 spawnSync——凡祖先链含 node.exe 的进程树内 spawnSync 一律 EBUSY
 *      （目标不限 node/cmd/复制 exe；重试无效）；而**异步 spawn 可用**、bash 直接调 node 也可用。
 *      regression.cjs 内的 spawnSync 实跑门禁（entry-matrix / entry-literals / gen-pinyin-table --check）
 *      因此拿不到子进程 ⇒ 本脚本用异步 spawn 把三个门禁**真实执行**一遍、把真实退出码 + 脚本 sha256
 *      指纹落 `.gate-cache.json`，随后同一进程内异步启动回归主程序。
 * 判据不变：缓存里的退出码来自真实执行；regression 侧校验指纹与 15 分钟时效，脚本被改/缓存过期即红。
 * 用法：node scripts/regression-eb.cjs   （等价于 node scripts/regression.cjs，仅多一步外带实跑）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GATES = [
  'entry-matrix.cjs',
  'entry-literals.cjs',
  ['gen-pinyin-table.cjs', ['--check']],
  /* ★W11(V3.8.11)新增：R4-Ev①（死 CSS 棘轮）要 --json 的**全文**才能判，
     而原缓存只存末 3 行 tail ⇒ JSON.parse 失败 → out=null → 那条判据恒红。
     而 dead-css-scan 直跑**不需要 Chromium**（V3.8.7 时误以为要浏览器链，导致这条挂了三个版本）。
     full: true 让它的 stdout 全文进缓存，其余门禁仍走 tail 省体积。 */
  ['dead-css-scan.cjs', ['--json'], { full: true }],
  /* R4-Ev① 还查这六个解释票（--explain 逐条），缺任一条即红 */
  ['dead-css-scan.cjs', ['--explain', '.metric-item.expanded']],
  ['dead-css-scan.cjs', ['--explain', '.dz-cell.l4']],
  ['dead-css-scan.cjs', ['--explain', 'body .module-title']],
  ['dead-css-scan.cjs', ['--explain', '.picker-item']],
  ['dead-css-scan.cjs', ['--explain', '.toggle']],
  ['dead-css-scan.cjs', ['--explain', '.dz-recentry']],
];

function runGate(name, args) {
  return new Promise((resolve) => {
    const p = path.join(__dirname, name);
    const t0 = Date.now();
    const c = spawn(process.execPath, [p, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('error', (e) => resolve({ failed: true, msg: e.message, p, out }));
    c.on('exit', (code) => resolve({ code, p, out, ms: Date.now() - t0 }));
  });
}

async function main() {
  const gates = {};
  for (const item of GATES) {
    const [name, args = [], opt = {}] = Array.isArray(item) ? item : [item, [], {}];
    const r = await runGate(name, args);
    if (r.failed) {
      console.error('❌ 外带实跑通道本身失败（' + name + '）：', r.msg);
      process.exit(2);
    }
    gates[name + (args.length ? ':' + args.join(' ') : '')] = {
      exit: r.code,
      ts: Date.now(),
      ms: r.ms,
      sha: crypto.createHash('sha256').update(fs.readFileSync(r.p)).digest('hex').slice(0, 16),
      /* full 的门禁存全文（判据要 parse JSON）；其余存末 3 行（够判 exit 又省体积） */
      tail: opt.full ? (r.out || '') : (r.out || '').split('\n').slice(-3).join('\n')
    };
    console.log((r.code === 0 ? '✅' : '❌') + ' 外带实跑 ' + name + (args.length ? ' ' + args.join(' ') : '') + ' → exit=' + r.code + ' (' + r.ms + 'ms)');
    if (r.code !== 0) console.log((r.out || '').split('\n').slice(-6).join('\n'));
  }
  fs.writeFileSync(path.join(__dirname, '.gate-cache.json'), JSON.stringify({ ts: Date.now(), gates }, null, 2), 'utf8');

  // 缓存落盘后立刻异步启动回归主程序（同一命令内完成，杜绝缓存与回归脱节）
  const c = spawn(process.execPath, [path.join(__dirname, 'regression.cjs')], { stdio: 'inherit' });
  c.on('error', (e) => { console.error('❌ 回归主程序启动失败：', e.message); process.exit(2); });
  c.on('exit', (code) => process.exit(code || 0));
}
main();
