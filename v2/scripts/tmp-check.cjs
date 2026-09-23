const fs = require('fs');
const R = fs.readFileSync('scripts/regression.cjs', 'utf8');
const i = R.indexOf("check('R160-2");
const j = R.indexOf('\n', i);
console.log(R.slice(i, j));
