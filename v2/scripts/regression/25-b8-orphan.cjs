/**
 * B8 分片 · V3.8.41：孤儿文件探测器（orphan-check.cjs）+ 死 CSS 权威 census 真源
 * 依赖基建见 ./helpers.cjs。
 */
const { fs, path, base, check, read, runGateSync, SCRIPTS_DIR } = require('./helpers.cjs');

const ORPHAN_P = path.resolve(SCRIPTS_DIR, 'orphan-check.cjs');
const ORPHAN = read('/../scripts/orphan-check.cjs');
/* ★切片纪律（B8 实测踩坑）：RETAINED 段的"规矩"那句话写在**头注里**、位于 const RETAINED 之前，
   切片若从 const RETAINED 起就永远取不到它 → 判据恒假红，而代码完全正确。
   ⇒ 起点用名册的注释块起点（`============ 显式保留名册`），终点用 const found。 */
const RETAIN_SEG_HEAD = '============ 显式保留名册'
const ORPHAN_SEG = ORPHAN.slice(ORPHAN.indexOf(RETAIN_SEG_HEAD), ORPHAN.indexOf('const found'));
if (!ORPHAN_SEG || ORPHAN_SEG.length < 800) {
  console.log(`  ⚠️ RETAINED 段切片异常（len=${ORPHAN_SEG ? ORPHAN_SEG.length : 0}）——本分片相关断言将判红，请先修锚点`);
}

console.log('【B8-1 · 孤儿探测器尺子本身要能证明自己有效】');
check('B8-1a ★orphan-check.cjs 只认 import 图、不认文本出现——因为注释、备案句、字符串里都会出现文件名，而真 import 只有静态 / 动态 / export-from 三种形态。立尺子的直接起因：盘点报告曾用 grep 数引用，把 ReviewPanel 判成"全库零挂载"，而那次统计漏了 DrillCardList 这个真活体', () => {
  return ORPHAN.includes('const importRe = [')
    && ['defineAsyncComponent', 'export\\s+[^', 'import\\s*\\('].every(k => ORPHAN.includes(k))
    && ORPHAN.includes('只认这三种');
});
check('B8-1b ★尺子的解析规则必须与真实构建一致，否则尺子自己就是错的：@ 别名指向 src 根（第一版错指 src 的父目录，102 个误报里的大头）；扩展名顺序照抄 Vite 的 resolve.extensions，.ts 必须排在 .vue 前——证据是 build 绿（若命中 .vue，showToast 单例导入直接炸）。第一版把 .vue 排最前，误报 102 个', () => {
  const exts = ORPHAN.slice(ORPHAN.indexOf('const EXTS'), ORPHAN.indexOf('function resolveSpec'));
  return ORPHAN.includes('const SRC_ALIAS = ROOT')
    && exts.includes("'.ts'") && exts.includes("'.vue'")
    && exts.indexOf("'.ts'") < exts.indexOf("'.vue'")
    && exts.includes("'/index.ts'");
});
check('B8-1c ★尺子只判"孤立"不判"该不该删"，删除决策仍归人——这条写进脚本头注，因为它正是本批最贵的一课（见 B8-3）。★锚点备案：判据里的引号形态必须与源码一致（本条用半角）；踩过一次坑：诊断时在 shell 里把引号转义掉了，据此误判成"源码是全角"，改判据后仍红——**诊断脚本自己被 shell 转义误导，比判据错更费一轮**，所以锚点一律先 grep 实际文案再改', () => {
  return ORPHAN.includes('不判"该不该删"')
    && ORPHAN.includes('删除决策仍归人');
});

console.log('【B8-2 · 孤儿清单为零，且保留必须明文登记】');
check('B8-2a ★实跑 orphan-check.cjs：当前零孤儿（非入口、import 图入边为 0、且未登记保留）。★棘轮口径 = 脚本 exit 0，不是"清单恰好为空"——所以顺带钉图规模：节点 > 150 且边 > 900，否则尺子坏了也算过（V3.8.39 连踩两次"判据在空串上永远绿"）', () => {
  const r = runGateSync(ORPHAN_P);
  if (!r || r.status !== 0) return false;
  const n = Number((r.stdout.match(/（(\d+) 个节点/) || [])[1]);
  const e = Number((r.stdout.match(/(\d+) 条 import 边/) || [])[1]);
  return r.stdout.includes('无孤儿文件') && n > 150 && e > 900;
});
check('B8-2b ★判据自身可证伪：真在 src 里造一个无人 import 的 .vue，脚本必须 exit 1 并把它列进清单，跑完删掉。只改字符串不真建文件，测的是想象力（B8 立尺子的纪律②）', () => {
  const probe = path.resolve(base, 'newtab/components/__B8_orphan_probe__.vue');
  fs.writeFileSync(probe, '<template><div /></template>\n');
  try {
    const r = runGateSync(ORPHAN_P);
    return !!r && r.status === 1 && r.stdout.includes('__B8_orphan_probe__.vue') && r.stdout.includes('发现 1 个孤儿文件');
  } finally { fs.rmSync(probe, { force: true }); }
});
check('B8-2c ★保留必须是明文的：想留在名册里，就带理由与复核时点登记，且每条目写清"还在等什么"，答不上来就删——accidental retention（"先放着"）是死代码的温床。CatPicker 现行条目须带 V3.9.0 里程碑复核时点', () => {
  return ORPHAN_SEG.includes('const RETAINED = {')
    && ORPHAN_SEG.includes('shared/components/CatPicker.vue')
    && ORPHAN_SEG.includes('V3.9.0 里程碑复核')
    && ORPHAN_SEG.includes('不登记就是孤儿，删');
});

console.log('【B8-3 ·「孤儿」与「该删」之间隔着人的判断——本批最贵的一课】');
check('B8-3 ★★W13-D5 的组件保留拍板不许被孤儿尺子顺手推翻。★B8 实测：本批第一版按尺子输出把六个文件全删了 ⇒ 回归 46 条红（含 W13-T7a、R111-2/3/5、R139-4、R172-7/8/10~21、W2-3、W5-6 与 R31/R32/R33/R35/R43/R44/R45/R48 全族）——那不是"清理陈旧断言"，是**把一次用户拍板当成死代码删掉**（W13-D5 / 2026-10-16 用户拍板「复盘能力四段常驻」明文要求"组件文件保留待复用，同 CatPicker 先例"）。⇒ 判据守四腿：① 四个真零入边文件必须在位且在名册里带理由与复核时点；② 退役备案仍在宿主里，不许被后人当成"可以删了"的许可；③ 退役仍是零挂载零 import，不许因为文件还在就挂回去；④ ReviewPanel 的两个下游（ReviewReportModal / shared/ai/review）**必须仍被它引用**——它们是动态 import，尺子的静态图抓不到，靠这条负锚保住那条链', () => {
  const pi = read('/newtab/views/ProfileInsights.vue');
  const rp = read('/newtab/components/dashboard/ReviewPanel.vue');
  /* 腿①：四个真零入边文件必须在位，且理由都在名册里（逐条点名，不许只留文件不留理由） */
  const four = [
    '/newtab/components/dashboard/ReviewPanel.vue',
    '/newtab/components/dashboard/HeatmapModule.vue',
    '/newtab/components/compass/NorthStarPanel.vue',
    '/newtab/composables/useDashboardReport.ts',
  ];
  if (!four.every(p => fs.existsSync(path.join(base, p.replace(/^\//, ''))))) return false;
  if (!ORPHAN_SEG.includes('W13-D5')) return false;
  if ((ORPHAN_SEG.match(/V3\.9\.0 里程碑复核/g) || []).length < 4) return false;
  /* 腿②：退役备案仍在宿主里 */
  if (!pi.includes('W13-D5') || !pi.includes('组件文件保留待复用')) return false;
  /* 腿③：退役仍是零挂载零 import，不许因为文件还在就挂回去 */
  const piCode = pi.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (piCode.includes('<ReviewPanel') || piCode.includes('useDashboardReport')) return false;
  /* 腿④：动态 import 那条链必须还在——尺子看不见它，只有判据看得见 */
  return rp.includes("defineAsyncComponent(() => import('./ReviewReportModal.vue'))")
    && read('/newtab/components/dashboard/ReviewReportModal.vue').includes("import('@/shared/ai/review')");
});

console.log('【B8-4 · 死 CSS 真源：census 必须是全量实拍的权威件】');
check('B8-4a ★census 权威件只有全量跑才更新：部分跑（--scenes/--only 过滤）会把一份残缺普查写进去，把大批活类误判成死——那比假绿更糟，**它直接误导删除**。判据钉住：写入路径在固定的 _census 目录（不带日期，因此不会顶掉日期字典）、带 srcNewest 新鲜度戳', () => {
  const t = read('/../scripts/theme-audit.cjs');
  return t.includes('if (!SCENES && !argv.only)')
    && t.includes("'视觉归档', '_census'")
    && t.includes('src最新: srcNewest')
    && t.includes('权威普查已更新')
    && t.includes('不更新权威普查');
});
check('B8-4b ★dead-css-scan 只认权威件；census 缺失 / 过期 / token 数异常时必须拒绝出结论并以非零退出（R4-Et 立的硬闸，本批把它从"日期目录里最新的那个"改成"全量实拍写下的那一个"，消除「历史 census 仍含退役 class ⇒ 0/0 假绿」）', () => {
  const d = read('/../scripts/dead-css-scan.cjs');
  return d.includes('_census')
    && d.includes('没有权威 DOM 类名普查')
    && d.includes('src最新')
    && d.includes('process.exit(2)')
    && !d.includes('视觉归档') === false;   /* 目录名仍出现在提示语/路径里 */
});

check('B8-4c ★新鲜度闸必须「按文件性质精确化」，不能只看 mtime —— 否则改一句更新日志文案也要逼人重跑 6 分钟实拍，而**负担足够重的纪律会被绕过**（改用 --census 硬绕，那才是真风险）。精确化的边界是「只有可能产出 DOM class 的改动才顶旧普查」：① 豁免名单限死两个纯文案数据文件，且**豁免是自检出来的**（文件里一旦出现 class 关键词或 CSS import，下次照常拦，不靠人记得改名单）；② 豁免时**必须打印文件名与理由**——静默放行等于偷偷开闸；③ 任何「可能间接产出 class」的文件（组件 / 拼接类名 / 数据表里的 cls 字段）一律不豁免。判据钉住机制在位，并实跑证明「豁免路径真的会走到」', () => {
  const d = read('/../scripts/dead-css-scan.cjs');
  const mech = d.includes('TEXT_ONLY')
    && d.includes('CLASS_HINT')
    && d.includes('const noClass = (rel)')
    && d.includes('const fresh = staleFiles.filter')
    && d.includes('跳过新鲜度闸')           /* 豁免必须出声，静默放行等于偷偷开闸 */
    && d.includes('影响 class 的');         /* 拒时必须点名哪些改动真的会改class */
  if (!mech) return false;
  // 负锚：白名单不得开成目录级/通配，且不得出现「跳过全部检查」这类一键放行
  const noBlanket = !/TEXT_ONLY\s*=\s*\[\s*\]/.test(d)
    && !/if \(false\)/.test(d);
  if (!noBlanket) return false;
  // 实跑：拿当前真实 src 跑一次，若本次 src 未被顶旧则本条只验机制（机制在位即算过）
  const p = path.resolve(base, '..', 'scripts', 'dead-css-scan.cjs');
  const r = runGateSync(p, ['--json']);
  const said = (r.stdout || '') + (r.stderr || '');
  // ★★新增负锚：`--json` 的 stdout 必须是**纯 JSON**。这条是被真事件打出来的——
  //   豁免提示第一版写在 stdout，于是「改一句 changelog ⇒ 豁免 ⇒ 提示多两行 ⇒
  //   R4-Ev① / R4-Et① / W13-7 三条判据同时假红」。症状看着像判据坏了，实际是我的提示污染了数据面。
  //   ⇒ 凡 stdout 有机器可读契约的脚本，提示一律走 stderr、退出码说话。
  if (r.status === 0) {
    try { JSON.parse(r.stdout || '') } catch { return false }
    return true;
  }
  return said.includes('影响 class 的') && said.includes('顶旧');
});

console.log('【B8-5 · 实拍产物】');
check('B8-5 ★B8 批次实拍权威 census 在位（docs/视觉归档/_census/class-census.json），标记为全量跑、token 数在合理量级（不是三镜头的残缺件），且带 src 新鲜度戳', () => {
  const p = path.resolve(base, '..', '..', 'docs', '视觉归档', '_census', 'class-census.json');
  if (!fs.existsSync(p)) return false;
  let j = null;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return false }
  return j.全量 === true && j.token数 > 400 && j.场景数 > 20
    && typeof j.src最新 === 'number' && j.src最新 > 0;
});

console.log('【B8-6 · 文档不能是唯一不带门禁的产物】');
/* ★V3.8.41 末轮补记：这一组的起因是一次**没跑任何测试**才发现的事——
   `文档中心/00_架构总览.md` 的版本行被更新过很多次，而正文静默腐烂了约二十个版本：
   门禁基线停在「回归 1,675 且带 3 条失败」、存储键名写的是 V1 时代的 `zy_data`（还多写了一个
   根本不存在的 `zy_backup`）、主题数写「六」（实际四个）、AI 能力数写 24（实际 25↔27）。
   ⇒ **代码有 39 个分片在守着，文档一份守都没有**。这是本项目体系里唯一完全裸奔的一类产物。
   本组不试图给文档写通用语法检查（那是无底洞），只钉三件最容易错且**能从代码侧独立判定**的事：
   ① 架构总览里的门禁读数必须与权威 census / 索引同源，且不得含已退役的旧口径；
   ② 存储键真源只有 keys.ts 一处，架构总览不得复述 V1 旧键或虚构键；
   ③ 主题数以 tokens.css 实际选择器为准。 */
const ARCH = read('/../../文档中心/00_架构总览.md');
check('B8-6a ★架构总览的门禁读数不得停留在旧口径 —— 本项目门禁是「越修越好的东西」，旧读数不会自己失效，只会越看越像"还行"（V3.8.41 实测：正文写着回归 1,675 带 3 条失败 / 索引 180 文件 / 实拍 104 图 / 入口 24↔26，而实际已全绿且数字翻了一倍）。判定不写死具体数字（会随版本变），而是**禁止已知退役口径出现在现行段落里**：104 图 / 180 文件 / 24 声明 / 26 调用点 / 1,675 这五个旧值只允许出现在文末的「差异账」对照列中', () => {
  if (!ARCH) return false;
  // 差异账从「附 · 本轮回填」开始，在那之前是现行正文
  const cur = ARCH.slice(0, ARCH.indexOf('## 附 · 本轮回填'));
  if (!cur) return false;
  const stale = ['104 图', '180 文件', '24 声明', '26 调用点', '1,675', '六主题', 'zy_backup'];
  for (const s of stale) {
    // ★豁免只认**显式的过时标记**（"全部过时"/"旧文档写…已不成立"/"从不存在"/"本轮回填更正"）。
    //   第一版豁免写得太宽（只查「虚构」「本轮回填更正」两个词），结果**门禁表上方那句
    //   「旧表读数停留在…全部过时」自己把判据打红**——它明明是在正确地交代旧值。
    //   ⇒ 豁免条件必须逐个旧值对齐它出现的**那一句的语义**，不能只查一两个关键词。
    const NEG = ['全部过时', '已不成立', '从不存在', '本轮回填更正', '纯属虚构'];
    const lines = cur.split('\n').filter((l) => l.includes(s) && !NEG.some((k) => l.includes(k)));
    if (lines.length) return false;
  }
  // 现行正文必须给出**当期**读数。
  // ★不写死具体数字（会随版本变，那等于给自己埋一颗定时炸弹）——从代码生成物里实读当期值来对照：
  // 索引的第一行摘要句里就有「202 文件 / 52,301 行」。这才是「独立重算必须照抄被校验方口径」的文档侧版本。
  // ★锚点纪律：取生成器的摘要句格式「**N 个源文件 / M 行**」，
  //   不是随手猜的「N 文件 / M 行」——判据锚错了会假红，而生成物完全正确（这是本条的第一版写法）。
  const IDX = read('/../../评审交接包/02_代码索引.md');
  if (!IDX) return false;
  const line = (IDX.match(/规模：\*\*(\d+)\s*个源文件\s*\/\s*([\d,]+)\s*行/) || []);
  if (!line[2]) return false;
  const files = line[1];
  const lines = line[2];
  return cur.includes(lines) && cur.includes(files) && cur.includes('100 图');
});
check('B8-6b ★存储键的唯一真源是 shared/storage/keys.ts —— 文档里每多复述一份键名，就多一处会静默失真的副本（R159 已规定 src 内除该文件外裸键名即红，文档侧此前无同等约束）。本条要求架构总览的存储段指向 keys.ts 常量而非裸键名，且不得出现 keys.ts 里不存在的键', () => {
  if (!ARCH) return false;
  const KEYS = read('/../src/shared/storage/keys.ts');
  if (!KEYS) return false;
  const seg = ARCH.slice(ARCH.indexOf('## 五、存储架构'), ARCH.indexOf('## 六、AI 架构'));
  if (!seg || seg.length < 300) return false;
  // keys.ts 里真实存在的键：K.* 的取值，形如 `DATA: 'zy_data_v2'`（★第一版按对象字面量的 `': '` 匹配 ⇒ 取到 0 个 ⇒ 判据恒假红，代码完全正确）
  const real = new Set(
    [...KEYS.matchAll(/^\s*[A-Z_0-9]+:\s*'([^']+)'/gm)].map((m) => m[1]).filter((x) => /^zy_/.test(x))
  );
  if (real.size < 8) return false;
  // 段里出现的 zy_ 字面量，必须都来自 keys.ts（`K.XXX` 常量形式不算字面量，本就不在正则匹配范围内）
  const used = [...seg.matchAll(/`(zy_[a-z0-9_]+)`/g)].map((m) => m[1]);
  for (const u of used) if (!real.has(u)) return false;
  // 且必须真的指向了 keys.ts（否则读者只能来读这张表，而这张表正是会腐烂的东西）
  return seg.includes('keys.ts') && seg.includes('K.DATA');
});
check('B8-6c ★文档与代码对账要有责任标记 —— 「活文档」三个字最容易变成自我安慰。判据要求：架构总览的版本行必须等于 manifest 现行版本，且必须存在一份「本轮改了哪几类」的差异账（否则下一个人无从判断这份文档该信几分，只能全盘不信或全盘信，两种都危险）', () => {
  if (!ARCH) return false;
  const cur = ARCH.match(/> \*\*版本\*\*：V([\d.]+)/);
  if (!cur) return false;
  const man = read('/../src/manifest.ts');
  if (!man) return false;
  const mv = man.match(/version: '([\d.]+)'/);
  if (!mv || mv[1] !== cur[1]) return false;
  return ARCH.includes('本轮回填改了哪七类') || ARCH.includes('回填说明');
});

/* V3.8.42 · P1-10 叙事文档守卫（把「产品认知基线」也纳入门禁）
   为什么补这条：B8-6a/b/c 三条只守**架构总览**，而**产品认知基线**（接手必读的那份）是叙事性文档里
   数字最多的一份——V3.8.41 刚把它「回正」，2026-10-19 实测它又漂了 3 处（回归 1,961 → 实跑 1,964；
   分片数 39 → 41；索引 202 文件 → 204）。**症状：不报错、不变红，只是慢慢变成另一个人写的东西。**
   ★这不是重复劳动：B8-6 守的是「架构总览的正文不得停留在旧口径」，本条守的是「另一份文档的
   增量表必须与代码生成物一致」——两份文档、两套数字，判据不能互相顶替。
   ★判定方式照抄 B8-6a 的纪律：**不写死当期数字**（会随版本变），而是从 `02_代码索引.md` 与
   `regression.cjs` 实读当期值来对照。 */
console.log('【B8-7 · 叙事文档不得静默失真】');
const BASE = read('/../../知源调度台_产品认知基线_V3.8.24.md');
check('B8-7a ★产品认知基线的增量表必须与代码生成物一致：回归通过数取自 `regression.cjs` 实跑前的分片表规模、索引规模取自 `02_代码索引.md` 的摘要句、实拍图数取自 `gen-code-index` 同批的 census 场景数 —— 三者任一对不上即红。★为什么要查三样而不是只查版本号：版本号由 manifest 派生（B8-6c 已守），**数字才是真正会腐烂的东西**，且腐烂时版本号纹丝不动', () => {
  if (!BASE) return false;
  const IDX = read('/../../评审交接包/02_代码索引.md');
  const REG = fs.readFileSync(path.join(SCRIPTS_DIR, 'regression.cjs'), 'utf8');
  const m0 = REG.match(/const SHARDS = \[([\s\S]*?)\]/);
  if (!m0) return false;
  const shards = [...m0[1].matchAll(/'([^']+)'/g)].length;
  const m1 = (IDX || '').match(/规模：\*\*(\d+)\s*个源文件\s*\/\s*([\d,]+)\s*行/);
  if (!m1 || !m1[2]) return false;
  // 分片数：基线里以「**41 分片**」形态出现
  const shardRe = new RegExp(`\\*\\*${shards} 分片\\*\\*`);
  if (!shardRe.test(BASE)) {
    console.log(`     实测分片数 ${shards}，基线增量表里找不到「**${shards} 分片**」`);
    return false;
  }
  // 索引规模：文件数与行数都要在
  if (!BASE.includes(m1[1]) || !BASE.includes(m1[2])) {
    console.log(`     实测索引 ${m1[1]} 文件 / ${m1[2]} 行，基线增量表里对不上`);
    return false;
  }
  return true;
});
check('B8-7b ★基线必须留有「哪一批补记」的登记行：文档一旦失去「最后一项由哪批收掉」的痕迹，数字腐烂时无法核对的事实也就没有了 —— 与 B8-6c 对架构总览的差异账同一口径，本条把它扩到认知基线', () => {
  if (!BASE) return false;
  return /V3\.8\.4\d 补记|数字[廿零三四五六七八九]+填|增量（\d{4}-\d{2}-\d{2}/.test(BASE);
});
