/**
 * 静态回归断言 · 编排入口（R174-1 分片后只做加载编排）。
 * 运行：node scripts/regression.cjs —— 单命令入口不变；断言体分片至 scripts/regression/*.cjs，
 * 基建（check/read/codeOnly/版本锚）在 scripts/regression/helpers.cjs。
 * 纪律：分片是搬运不是重写，断言只增不减；每轮新断言写进对应时代分片。
 */
const { getTally, getSliceMisses } = require('./regression/helpers.cjs');

const SHARDS = [
  '01-w7-focus',
  '02-w8-compass',
  '03-w11-pyramid',
  '04-w12-restore',
  '05-compass-v3821',
  '06-compass-v3822',
  '07-w13-profile',
  '08-w14-focus',
  '09-w15-drill-focus',
  '10-w16-metrics',
  '11-w17-compass-deck',
  '12-w17-profile',
  '11-p0-strings',
  '13-components',
  '14-mirror-whip',
  '15-settings',
  '16-b5-compass',
  '17-b5-home',
  '18-b6-workspace',
  '19-b7-profile',
  '20-b7-a2',
  '21-b7b-empty',
  '22-b7c-s5',
  '23-b7d-d1',
  '24-b7e-h123-m6',
  '25-b8-orphan',
  '26-p02-legacy',
  '33-gs-baseline',
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
  '96-R176-daily-stats',
  '97-r3-rounds',
  '98-r4-gates',
  '98b-r4-visual',
  '99-recent',
  '99b-r2-pool',
  '100-p0-gates',
  '101-curation-mindmap',
  '102-v3918-desk-prototype',
  '102-g09-experience',
  '103-v3919-compass-prototype',
  '104-v3920-gp-split',
  '105-v3921-compass-round2',
  '106-v3922-profile',
  '107-v3922-desk',
  '108-v3922-compass',
  '109-shared-export',
  '110-v3923-cross-module',
];
for (const s of SHARDS) require('./regression/' + s + '.cjs');

/* R4-Eu：切片标记漂移闸（收口位，不在任何分片里）。
   为什么必须在**全部跑完之后**判：segOf 的 69 处调用大多在判据体内惰性求值，任何一条分片里判"账本为空"
   都只覆盖到那一刻之前的调用——起点缺失 ⇒ 切片是空串 ⇒ 正判据恒假、负判据永远绿（静默）；
   终点缺失 ⇒ 切片吃到文件尾 ⇒ 负判据误红。两种都不报错，所以只能由这里统一收。*/
const misses = [...new Set(getSliceMisses())];
if (misses.length) {
  console.log('\n❌ 切片标记漂移 ' + misses.length + ' 处（fnBody/segOf 的锚标记在源码里找不到了）：');
  for (const m of misses) console.log('   - ' + m);
  console.log('   处置：把标记改指到**现役边界**并在判据标题写「★随迁备案」；不要为了这条绿而删掉记账，也不要留着空切片。');
}
const { pass, fail } = getTally();
console.log('回归结果：' + pass + ' 通过 / ' + (fail + misses.length) + ' 失败'
  + (misses.length ? '（含切片漂移 ' + misses.length + ' 处）' : ''));
process.exit(fail || misses.length ? 1 : 0);
