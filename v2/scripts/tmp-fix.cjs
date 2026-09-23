const fs = require('fs');
const f = 'scripts/regression.cjs';
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const a = `if (/pinyin-pro/.test(s)) hits.push`;
const b = `if (/from 'pinyin-pro'|import\\('pinyin-pro'\\)|require\\('pinyin-pro'\\)/.test(s)) hits.push`;
if (s.split(a).length - 1 !== 1) throw new Error('未找到（次数 ' + (s.split(a).length - 1) + '）');
fs.writeFileSync(f, s.split(a).join(b));
console.log('✅ R160-2 扫描正则收紧');
