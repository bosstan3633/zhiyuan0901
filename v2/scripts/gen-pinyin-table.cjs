/** R160（P2）：由 pinyin-pro 生成两层表（开发期一次性；生成物入库，运行时不依赖 pinyin-pro）
 *  收窄口径：首字母=全表（U+4E00..U+9FFF）；全拼=常用字区（U+4E00..U+6800，约 6.6K 字）
 */
const fs = require('fs');
const { pinyin } = require('pinyin-pro');
const OUT = 'src/shared/utils/pinyinTable.ts'

const START = 0x4e00, END = 0x9fff, COMMON_CAP = 0x6800;
let initials = '';
const fulls = [];
for (let cp = START; cp <= END; cp++) {
  const ch = String.fromCharCode(cp);
  let first = '';
  try { first = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' })[0] || '' } catch { /* skip */ }
  const ok = /^[a-z]$/.test(first) ? first : '_';
  initials += ok;
  if (cp <= COMMON_CAP && ok !== '_') {
    let full = '';
    try { full = pinyin(ch, { pattern: 'pinyin', toneType: 'none', type: 'array' })[0] || '' } catch { /* skip */ }
    if (/^[a-z]{2,7}$/.test(full)) fulls.push(ch + full);
  }
}
const fullStr = fulls.join('|');
const out = `/**
 * R160（P2）：拼音两层表（**生成物，勿手改**；生成脚本：v2/scripts/gen-pinyin-table.cjs）
 * - INITIALS：U+4E00..U+9FFF 全表首字母（每字 1 字符，'_' = 未知），约 21KB
 * - FULLS：常用字区全拼（"字拼" 以 | 分隔，约 6.6K 常用字），首用时懒解析为 Map；区外汉字仅支持首字母
 * 用途：替换 pinyin-pro 全量字典（317KB / 压缩 ~142KB）→ 默认层零依赖、ZIP 回 ≤600KB
 */
export const PINYIN_RANGE_START = 0x4e00
export const INITIALS = '${initials}'
export const FULLS = '${fullStr}'
`;
const kb = (x) => (x.length / 1024).toFixed(1) + 'KB';

/* R164（E2 二期）：--check 只比不写——生成物"改了不重生成"必须当场红（与代码索引同法）。
   读取归一化 CRLF：Windows checkout 会把 .ts 转成 CRLF，逐字比对会误报。 */
if (process.argv.includes('--check')) {
  let disk = ''
  try { disk = fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') } catch { console.error('❌ 生成物不存在：' + OUT + '（跑 node v2/scripts/gen-pinyin-table.cjs）'); process.exit(1) }
  if (disk === out) { console.log('✓ pinyinTable.ts 与生成器一致（' + kb(out) + '）'); process.exit(0) }
  console.error('❌ pinyinTable.ts 已漂移（改了不重生成）：重跑 node v2/scripts/gen-pinyin-table.cjs')
  process.exit(1)
}

fs.writeFileSync(OUT, out);
console.log('✅ 生成完成：首字母表 ' + kb(initials) + ' · 全拼表 ' + kb(fullStr) + ' · 全拼字 ' + fulls.length + ' · 总 ' + kb(out));
