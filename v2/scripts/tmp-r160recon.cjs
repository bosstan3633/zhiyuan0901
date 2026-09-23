const fs = require('fs');
const show = (f, a, b) => {
  if (!fs.existsSync(f)) { console.log('==== ' + f + ' (不存在)'); return; }
  const L = fs.readFileSync(f, 'utf8').split('\n');
  console.log('==== ' + f + ' ' + a + '-' + b + '（共 ' + L.length + ' 行）====');
  console.log(L.slice(a - 1, b).map((l, i) => (a + i) + ': ' + l.slice(0, 170)).join('\n'));
  console.log();
};

console.log('==== node_modules/pinyin-pro 包结构（找小字典变体）====');
const pnpm = 'node_modules/pinyin-pro';
if (fs.existsSync(pnpm)) {
  console.log('package.json exports:', JSON.stringify(JSON.parse(fs.readFileSync(pnpm + '/package.json', 'utf8')).exports || {}, null, 1).slice(0, 800));
  for (const d of ['dist', 'lib', 'data']) {
    const p = pnpm + '/' + d;
    if (fs.existsSync(p)) {
      console.log('-- ' + d + ' --');
      for (const f of fs.readdirSync(p).slice(0, 20)) {
        const st = fs.statSync(p + '/' + f);
        console.log('  ' + f + (st.isFile() ? '  ' + (st.size / 1024).toFixed(0) + 'KB' : '/'));
      }
    }
  }
} else console.log('(未安装)');

show('src/newtab/main.ts', 1, 80);
show('src/shared/storage/repository.ts', 72, 96);
show('src/newtab/components/GlobalPopups.vue', 40, 52);
show('src/background/index.ts', 266, 282);
