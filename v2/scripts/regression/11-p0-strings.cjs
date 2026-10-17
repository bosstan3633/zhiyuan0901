/**
 * 分片 · 11-p0-strings：P0 批 0-A（V3.8.25）—— G1「emoji → Icon」迁移的**终态棘轮**。
 *
 * 为什么另开一片：G1 的 41 项 UI 方案落地后，判据侧有 28 条锚点需要"重指"（旧的钉 emoji 字面量，
 * 新的钉 Icon 名）。重指本身只是跟随，真正需要**新增**的是这四类"迁移会留下的伤"，它们在
 * typecheck / build / 既有回归里**全都不报错**，只能靠现扫：
 *   ① 模板文本节点残留装饰符号（漏迁）；
 *   ② 模板孤儿空格（emoji 删了、空格留下，渲染成"标题前多一个洞"）；
 *   ③ **死三元**（`? '' : ''` 两支同值）—— 本轮实测挖出 8 处，是这个批次的头号真 bug：
 *      `linkIcon()` 三支全空、`catIconOf()` 两支全空、`kindIcon()` 三支全空、
 *      `statKindIcon()` 三支全空、CSV「镜像标记」恒空、`raw = rows.length ? '' : ''`、
 *      ProjectCuration 勾选圈恒空、GlobalPopups 链接图标恒空。它们的共同形态是
 *      **"机械剥离 emoji 时把内容一起删了"**：类型对、构建过、门禁绿、界面静默少一块。
 *   ④ Icon 名拼错（图标集里没有这个键 ⇒ 渲染成空白，且没有任何门禁会红）。
 *
 * ★口径纪律（写在这里，因为这条最容易下轮被放宽）：
 *  - **不做**「全站零 emoji」——`★` 是本项目的纪律标记，出现在上千行注释里；
 *  - **不做**「toast 文案零符号」——`Toast.vue` 没有图标位，`msg` 是纯文本，
 *    删掉 `✓/⚠` 等于把"这是成功还是失败"这条信息物理删除。要做得先给 Toast 加类型 + 图标位，
 *    那是新功能，不属于 P0 收口批（记在待办，不在这里立规则）。
 *  - **不扫 `content/`** —— content script 是纯 Vanilla + Shadow DOM，**没有 Icon 组件**，
 *    那里的 `↗ 🎯` 是唯一可用的视觉线索，按 G1 删除是错的。
 */
const { check, codeOnly, fs, path, SCRIPTS_DIR, walkVueFiles } = require('./helpers.cjs');
const SRC = path.resolve(SCRIPTS_DIR, '..', 'src');

/** 递归取 src 下指定扩展名的文件（绝对路径） */
function walkExt(dir, re, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkExt(p, re, acc);
    else if (re.test(e.name)) acc.push(p);
  }
  return acc;
}
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');
const VUE = walkVueFiles ? walkVueFiles(SRC) : walkExt(SRC, /\.vue$/);
const ALL_TS_VUE = walkExt(SRC, /\.(ts|vue)$/);

/** 去注释但保留结构：HTML 注释 + 块注释 + 整行行注释。行尾 `//` 不动（会误伤 http:// 与模板文本） */
function stripAll(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
/** 取 .vue 的 <template> 段（没有则返回 ''） */
function tplOf(src) {
  const m = stripAll(src).match(/<template>([\s\S]*)<\/template>/);
  return m ? m[1] : '';
}

/** G1 要清的装饰符号。★注意：`⚠ ◐ ○ ● ☑` 是 G1 类 C 明确**保留**的几何符号，不在此列。 */
const DECO = /[\u{1F300}-\u{1FAFF}\u{FE0F}]|✅|❌|✓|✕|🔍|📄|📎|🗑|📦|🎯|🚀|💡|⚡|📊|📈|🧭|🔄|⬇|⬆|↗|↙|👁|🏷|🪞|🤖|🧠|✦|✚|📋|📌|⏱|💾|🔒|⛔|🚫|🔗|📝|🗂|🕐|◇|◆/u;

console.log('【P0-S · G1 迁移终态棘轮（V3.8.25 批 0-A）】');

// ────────────────────────── S1 · 模板文本节点零装饰符号 ──────────────────────────
// ★与 `100-p0-gates.cjs` 的 P0-G1-A 的关系（别当成新覆盖）：P0-G1-A 是**整个 .vue 文件剥注释后 emoji = 0**
// （带 3 个白名单文件 + GEOM_KEEP 几何符号表），覆盖面比本条**更宽**。本条只是把口径收窄到
// 「<template> 段 + 不含 content/」，用于在模板侧单独定位"图标位缺内容"这类问题；两者重叠，P0-G1-A 是主闸。
check('P0-S1 ★模板文本节点不得残留装饰符号（G1 的"漏迁"棘轮）：现扫 src 全部 .vue 的 <template> 段（去注释），`✅❌✓✕🔍📄📎🗑📦🎯🚀💡⚡📊📈🧭🔄⬇⬆↗👁🏷🪞🤖🧠✦✚📋📌⏱💾🔒⛔🚫` 一律零命中。★口径备案：① 不扫 `content/`——content script 是纯 Vanilla + Shadow DOM，没有 Icon 组件，`↗ 🎯` 是唯一视觉线索；② `⚠ ◐ ○ ● ☑` 是 G1 类 C 明确保留的几何符号，不判违规；③ `★` 是纪律标记（注释里上千处），本判据只看模板段且先剥注释', () => {
  const bad = [];
  for (const f of VUE) {
    if (rel(f).startsWith('content/')) continue;
    for (const ln of tplOf(fs.readFileSync(f, 'utf8')).split('\n')) {
      if (DECO.test(ln)) bad.push(rel(f) + ' :: ' + ln.trim().slice(0, 80));
    }
  }
  if (bad.length) console.log('     违规 ' + bad.length + ' 处：\n       ' + bad.slice(0, 8).join('\n       '));
  return bad.length === 0;
});

// ────────────────────────── S2 · 模板孤儿空格 ──────────────────────────
check('P0-S2 ★模板孤儿空格为零（G1 的"删了 emoji 留下空格"棘轮）：现扫 src 全部 .vue 的 <template> 段，`>` 之后连续 ≥2 个空格再接中文一律零命中。病根形态：`<span>{{ 图标 }}</span> 标题` 里的图标被删后，模板缩进空格变成可见的"标题前一个洞"，而 build/typecheck 全绿', () => {
  const bad = [];
  for (const f of VUE) {
    for (const ln of tplOf(fs.readFileSync(f, 'utf8')).split('\n')) {
      if (/>\s{2,}[\u4e00-\u9fa5]/.test(ln)) bad.push(rel(f) + ' :: ' + ln.trim().slice(0, 80));
    }
  }
  if (bad.length) console.log('     违规 ' + bad.length + ' 处：\n       ' + bad.slice(0, 8).join('\n       '));
  return bad.length === 0;
});

// ────────────────────────── S3 · 死三元负锚 ──────────────────────────
check('P0-S3 ★死三元全站零命中（`? \'\' : \'\'` 两支同值）——本轮 P0 批的头号真 bug 形态，实测挖出 8 处：`linkIcon()` 三支全空、`catIconOf()` 两支全空、`kindIcon()` 三支全空、`statKindIcon()` 三支全空、CSV「镜像标记」恒空、`raw = rows.length ? \'\' : \'\'`、ProjectCuration 勾选圈恒空、GlobalPopups 链接图标恒空。共同点：**类型对、构建过、门禁绿、界面静默少一块**，靠人眼看不出。凡"按类型取图标/文案"的三元，每一支都必须给出**真实不同**的值；确实无内容时改用 `v-if` 或直接删字段，不许留空三元占位。★V3.8.25（B1-a）扩面：原判据只认 `? \'\' : \'\'` 这一种写法，而同类 bug 还有两个变体——**两支同为空格**（`GlobalSettings` 同步日志 `l.kind===\'error\' ? \' \' : l.kind===\'ok\' ? \' \' : \'· \'`，成功与失败两种日志视觉完全一样）与**两支同为任意字面量**（`PoolCardsPanel` 的 `startsWith(\'http\') ? \'url\' : \'url\'`）。现改为「两支是同一条字符串字面量即红」（反向引用），一次性覆盖三种写法；这两个变体都是本轮扩面时当场扫出来的，不是预防性推测', () => {
  const bad = [];
  for (const f of ALL_TS_VUE) {
    const s = stripAll(fs.readFileSync(f, 'utf8'));
    // 反向引用 \1：左右两支必须是**逐字相同**的字符串字面量。单双引号都收，不跨行（避免把两个无关分支连起来）
    for (const m of s.matchAll(/\?\s*('[^'\\\n]*'|"[^"\\\n]*")\s*:\s*\1/g)) bad.push(rel(f) + ' :: ' + m[0]);
  }
  if (bad.length) console.log('     违规 ' + bad.length + ' 处：\n       ' + bad.slice(0, 8).join('\n       '));
  return bad.length === 0;
});

// ────────────────────────── S4 · Icon 名必须在图标集里 ──────────────────────────
check('P0-S4 ★每一个 Icon 名都必须真实存在于图标集：现扫 src 全部 .vue/.ts，① 静态 `name="xxx"` ② `:name="expr"` 里剥离比较字面量（`=== \'done\'` 那种）后的每个字符串字面量，全部必须是 Icon.vue 的键。★为什么值得钉：G1 把 20+ 处导航图标从 emoji 改成 Icon 名时，名字拼错不会有任何报错——`<Icon name="checksqure"/>` 只是渲染成空白，typecheck 过、build 过、回归全绿，界面少一个图标没人发现。同时钉住"不得为空串"（那正是本轮 8 处死三元的产物）。★本条自己先误报过一次，记在这里当纪律：首版正则只认裸标识符键（`^  ([a-z][a-z0-9]*): `），把 `Icon.vue` 里带连字符的引号键 `\'main-focus\':` 判成"不存在"，一口气点名 13 处 `main-focus`，我据此往三份文档写了"主攻图标一直渲染成指南针"的错误结论 —— 实际那个键从 G1 批一起就在第 47 行，**错在尺子不在数据**。修法是正则补上引号键（`^ {2}\'?([a-z][a-z0-9-]*)\'?: `），不是往图标表塞重复键（那会触发 TS1117）。**新增"现扫型"判据必须先拿已知正确的样本验一遍不误报，再上棘轮**：否则它一红，你会去改数据，而该改的是它', () => {
  const iconSrc = fs.readFileSync(path.join(SRC, 'shared/components/Icon.vue'), 'utf8');
  // 键名允许带连字符（'main-focus' 就是引号键），故正则同时接受裸标识符与引号键
  const keys = new Set([...iconSrc.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?: '/gm)].map(m => m[1]));
  if (keys.size < 80) return false; // 图标集被改坏/正则失配时不许静默通过
  const bad = [];
  for (const f of ALL_TS_VUE) {
    const s = stripAll(fs.readFileSync(f, 'utf8'));
    for (const m of s.matchAll(/<Icon\b[^>]*?(?<!:)\bname="([^"]*)"/g)) {
      if (!m[1]) bad.push(rel(f) + ' :: 空 name');
      else if (!keys.has(m[1])) bad.push(rel(f) + ' :: name="' + m[1] + '"');
    }
    for (const m of s.matchAll(/<Icon\b[^>]*?:name="([^"]*)"/g)) {
      const expr = m[1].replace(/[=!]==?\s*'[^']*'/g, '').replace(/[=!]==?\s*`[^`]*`/g, '');
      for (const q of expr.matchAll(/'([a-z][a-zA-Z0-9-]*)'/g)) {
        if (!keys.has(q[1])) bad.push(rel(f) + ' :: :name 里 ' + q[1] + '（' + m[1].slice(0, 40) + '）');
      }
    }
  }
  if (bad.length) console.log('     违规 ' + bad.length + ' 处：\n       ' + bad.slice(0, 8).join('\n       '));
  return bad.length === 0;
});

// ────────────────────────── S5 · G1 五类各留一条正锚 ──────────────────────────
check('P0-S5 ★G1 五类处置各留一条正锚（防"下轮当成漏实现又改回 emoji"）：A 状态彩点→`Icon dot` + `.zy-dot-*` 令牌；B AI 徽标→方向树弱显 `Icon sparkle`（`.mc-ai` 指标卡 AI 拆解钮）；C 动作文本节点前置 Icon（工作区批量开关 `:name="batchMode ? \'check\' : \'checksquare\'"` 双态）；D 字符串 prop 去 emoji 且**图标名真实存在**（设置页导航 `icon: \'trash\'` 回收站项）；E toast 文案的符号**不在本批处置范围**（Toast.vue 无图标位，删了就是丢信息）—— 此处以负锚钉住"不许有人来加这条规则"：Toast.vue 的 `.toast-msg` 仍是纯文本插值', () => {
  const iconSrc = fs.readFileSync(path.join(SRC, 'shared/components/Icon.vue'), 'utf8');
  const lane = fs.readFileSync(path.join(SRC, 'newtab/components/compass/CompassLane.vue'), 'utf8');
  const toast = fs.readFileSync(path.join(SRC, 'shared/components/Toast.vue'), 'utf8');
  const gs = stripAll(fs.readFileSync(path.join(SRC, 'newtab/views/GlobalSettings.vue'), 'utf8'));
  const ws = stripAll(fs.readFileSync(path.join(SRC, 'newtab/views/Workspace.vue'), 'utf8'));
  const tokens = fs.readFileSync(path.join(SRC, 'shared/styles/tokens.css'), 'utf8');
  return iconSrc.includes("dot: '")                                    // A 类载体在图标集里
    && lane.includes('class="mc-ai"') && lane.includes('name="sparkle"') // B 类：AI 弱显走 Icon
    && ws.includes(":name=\"batchMode ? 'check' : 'checksquare'\"")    // C 类：动作图标双态
    && gs.includes("{ key: 'recycle', icon: 'trash', label: '回收站'") // D 类：字符串 prop 里是真图标名
    && tokens.includes('.zy-dot-ok') && tokens.includes('.zy-dot-warn') && tokens.includes('.zy-dot-mut') // A 类：三态点令牌仍在
    && /class="toast-msg">\{\{ t\.msg \}\}/.test(toast)                // E 类：消息体是纯文本插值（不判违规）
    // ★注意别把这条写成「Toast.vue 里不许有 <Icon」——它有一枚，是右侧关闭钮的 Icon x。
    // 本条守的是"消息体没有图标位"，所以只钉 .toast-msg 的内部形态；谁给消息体加图标位必须同步改这条。
    && !/class="toast-msg">[^<]*<Icon/.test(toast);
});

// ────────────────────────── S6 · 分片必须入库（防"新克隆跑不动回归"） ──────────────────────────
check('P0-S6 ★`regression.cjs` 的 SHARDS 里每一个分片都必须①文件存在 ②已被 git 跟踪：本条是"门禁静默失能"的第四种形态 —— 前三种（正则写坏导致加载期崩、断言被删、切片标记漂移）都已在别处钉住，这一种是**分片文件没入库**：本地跑得通，新克隆 `require` 直接 MODULE_NOT_FOUND，整条回归在加载阶段就死，而"上次跑还是全绿"的结论会被继续引用。2026-10-14 已因同类问题吃过一次（`1f014bb` 的正则未转义），当时的教训写进了透视卡：**发版后必须真跑并读退出码**；本条把"跑得动"的前提也钉住', () => {
  const regSrc = fs.readFileSync(path.join(SCRIPTS_DIR, 'regression.cjs'), 'utf8');
  const m = regSrc.match(/const SHARDS = \[([\s\S]*?)\]/);
  if (!m) return false;
  const names = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  if (names.length < 20) return false; // 分片表被改坏时不许静默通过
  const missing = names.filter(n => !fs.existsSync(path.join(SCRIPTS_DIR, 'regression', n + '.cjs')));
  // git 跟踪状态：只读 `git ls-files`，不在门禁里做任何写操作；git 不可用（无仓库/无 git）时跳过该项而非误红
  let untracked = [];
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync('git', ['ls-files', '--', 'scripts/regression'], {
      cwd: path.resolve(SCRIPTS_DIR, '..'), encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore']
    });
    const tracked = new Set(out.split('\n').map(s => s.trim().split('/').pop()));
    untracked = names.filter(n => !tracked.has(n + '.cjs'));
  } catch { untracked = []; }
  if (missing.length) console.log('     缺文件：' + missing.join(', '));
  if (untracked.length) console.log('     未入库（新克隆会崩）：' + untracked.join(', '));
  return missing.length === 0 && untracked.length === 0;
});

// ────────────────────────── S7 · 内联样式棘轮（B1 收口过的文件不许回涨） ──────────────────────────
check('P0-S7 ★内联视觉样式棘轮：已被 B1 收口过的 **22 个文件**（B1-a/b 的 `Workspace.vue` / `GlobalSettings.vue` + B1-c 的 20 个）模板内**静态** `style="…"` 必须为 0。★边界写死在这里，免得下一轮又争：`① 只算静态写法 —— `(?<!:)style="` 负向断言排除 `:style="…"`，动态绑定（树深度缩进、确认按钮禁用态透明度等由运行时求值的那几处）按 Q2 拍板**保留**，不计违规；② 只算模板段 —— 取第一个 `<template` 到最后一个 `</template>`（不依赖 script 在前后，SFC 两种写法都成立），`<script>` 里生成 HTML 字符串用的样式不收（那是数据不是版面，且 `GlobalSettings` 的预览骨架已改为走 `:deep()` 类）；③ 先剥注释 —— 否则"说明这里原本有个内联样式"的注释会把棘轮自己顶红。★为什么值得钉：内联样式是**令牌体系唯一的合法绕行口**，一个 `color:#3A6B4C` 写进模板就绕过了四主题跟随，而 `vue-tsc`、build、其余判据全都看不见它；B1-a 实测在 `GlobalSettings.vue` 里就挖到 `var(--ok,var(--info-green,#3A6B4C))` 两个令牌全不存在、实际一直渲染硬编码深绿，B1-c 又在 `GlobalPopups.vue` 挖到 `var(--text-tertiary)` 根本不存在、整条声明被浏览器丢弃。收口完成后若不加棘轮，下一轮加功能时"顺手写个 style"是最省事的路径，收口等于白做', () => {
  const FILES = [
    'newtab/views/Workspace.vue', 'newtab/views/GlobalSettings.vue',
    'newtab/views/ManualPage.vue', 'shared/components/AiMarkSymbol.vue',
    'newtab/views/RecycleBin.vue', 'newtab/components/ResourceEditForm.vue',
    'newtab/components/ResourceDetailDrawer.vue', 'newtab/components/compass/PoolCardsPanel.vue',
    'newtab/components/dashboard/Heatmap.vue', 'newtab/components/dashboard/ReviewPanel.vue',
    'newtab/components/profile/PiHero.vue', 'newtab/components/profile/PiRhythm.vue',
    'newtab/views/CompassHome.vue', 'newtab/components/profile/PiYear.vue',
    'newtab/components/compass/TaskManagerPanel.vue', 'newtab/components/GlobalPopups.vue',
    'newtab/components/compass/CuriosityPanel.vue', 'newtab/views/ProfileInsights.vue',
    'newtab/components/CurationDrillDrawer.vue', 'newtab/components/compass/TaskDetailDrawer.vue',
    'newtab/components/dashboard/DayDetail.vue', 'newtab/views/ProjectCuration.vue',
  ];
  const bad = [];
  for (const f of FILES) {
    const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
    const i0 = raw.indexOf('<template'), i1 = raw.lastIndexOf('</template>');
    if (i0 < 0 || i1 < i0) { bad.push(f + ' :: 取不到模板段（文件结构变了？本条必须重写而不是静默通过）'); continue; }
    const t = raw.slice(i0, i1).replace(/<!--[\s\S]*?-->/g, '');
    for (const m of t.matchAll(/(?<!:)style="([^"]*)"/g)) bad.push(f + ' :: style="' + m[1] + '"');
  }
  if (bad.length) console.log('     违规 ' + bad.length + ' 处：\n       ' + bad.slice(0, 8).join('\n       '));
  return bad.length === 0;
});
