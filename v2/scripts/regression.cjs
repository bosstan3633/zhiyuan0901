/**
 * 静态回归断言 · 编排入口（R174-1 分片后只做加载编排）。
 * 运行：node scripts/regression.cjs —— 单命令入口不变；断言体分片至 scripts/regression/*.cjs，
 * 基建（check/read/codeOnly/版本锚）在 scripts/regression/helpers.cjs。
 * 纪律：分片是搬运不是重写，断言只增不减；每轮新断言写进对应时代分片。
 */
const { getTally } = require('./regression/helpers.cjs');

const SHARDS = [
  '10-foundations',
  '20-req39-64',
  '30-v2.35-v2.46',
  '40-v2.47-v2.59',
  '50-v2.59-v2.76',
  '60-split-p2',
  '70-perf112',
  '80-R120-R143',
  '90-R144-R160',
  '95-R161-R166',
  '97-r3-rounds',
  '99-recent',
];
for (const s of SHARDS) require('./regression/' + s + '.cjs');

const { pass, fail } = getTally();
console.log('回归结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
