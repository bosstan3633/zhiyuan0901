/**
 * 22-b7c-s5（S5 更新日志结构化 · V3.8.38）— 判据分片。
 *
 * ★这一项规范原文只有三行：「每条版本 = 版本号（mono）+ 日期（caption）+
 *   变更分组（新增/修复/优化 三段式 + 列表）；当前版本置顶并『最新』徽章；行宽 ≤68ch」。
 *   落地时撞上两个规范没写、但决定成败的事实，因此本分片守的不只是那三行：
 *
 * ① **247 条要点必须人工判定分类**——要点是叙事体的（「原来…现在…」），
 *   关键词自动匹配会把大量"版式调整"判成"优化"、把"文案换词"判成"修复"。
 *   所以 S5-2 不是格式检查，是**标注与内容必须一一对应**的合同：kinds 长度必须等于 points。
 *   这条一旦破，前面的三段式就变成"按数组下标硬套的假分类"——比不做更糟。
 *
 * ② **规范漏了一处真实缺陷**：要点正文里的 `**加粗**` 从来没被渲染过，
 *   模板一律 `{{ p }}` 平铺，145 条以加粗起头的要点，星号是原样显示给用户的。
 *   S5-5/S5-6 补 RichText 组件；但真正的护栏是 S5-7——**它不许用 v-html**：
 *   这里只需要"加粗"一种效果，为它开一个 HTML 注入面不划算（库里已有 24 处历史 v-html 存量）。
 *
 * ③ **单要点版本不许硬分三段**（S5-3）：95 个 v2 时代版本每版只有 1 条要点，
 *   无处可分。硬分会造出两个空段——给数据化妆。缺省 kinds 的版本走平铺列表。
 */
const { read, codeOnly, check } = require('./helpers.cjs')

const CD = read('/newtab/changelog-data.ts')
const GS = read('/newtab/views/GlobalSettings.vue')
const RT = read('/newtab/components/RichText.vue')
const CDO = codeOnly(CD)
/* ★凡判「不得出现某字面量」的负锚，一律读 codeOnly 而不是自己写剥注释正则——
   组件头注释里正写着「为什么不用 v-html」这句理由，不剥注释就会与自己的负锚撞车（R71 老坑）。
   codeOnly 是基建里唯一正确的剥法（R119 修过一次：旧实现会把字符串里的「斜杠星」当注释起点一路吞）。 */
const RTC = codeOnly(RT)
/* 同理：GlobalSettings 里也写了「置顶不靠运气」这类说明性 HTML 注释，
   模板正锚必须走 GSO，否则注释里复述的模板写法会让判据假绿。 */
const GSO = codeOnly(GS)

const NAME = (...p) => p.join('')

console.log('【S5 · 更新日志结构化（V3.8.38）】')

/* ────────── 数据侧：kinds 与 points 严格一一对应 ────────── */

check(NAME(
  'S5-1 数据侧单一真源：kinds 走平行数组而非拆进 points 对象。',
  '★为什么是平行数组而不是把每条要点改成 {kind,text}：后者要改 390 条字面量，',
  '每一处都是可能被手滑改坏的中文长句；平行数组只动 40 个版本的元数据，',
  '要点原文一个字节都不碰——改文案与改分类可以各自独立进行。'), () => {
  if (!CDO.includes('kinds?: ChangelogKind[]')) { console.log('     kinds 未声明为可选平行数组'); return false }
  if (!/export type ChangelogKind = 'add' \| 'fix' \| 'opt'/.test(CDO)) { console.log('     ChangelogKind 联合类型不在位'); return false }
  // 禁止把 points 改成对象数组（一旦拆进去，上面那条"原文不碰"就破了）
  if (/points:\s*Array<\{/.test(CDO)) { console.log('points 已被改成对象数组——本批约定不得拆'); return false }
  return true;
});

check(NAME(
  'S5-2 ★标注与内容一一对应：凡是写了 kinds 的版本，长度必须严格等于 points。',
  '★这是本批最要紧的一条：分类一旦与内容错位，三段式就成了按位置硬套的假分类，',
  '比不做分类更糟（用户会读到一个他并不信任的版本结构）。',
  '长度不符时 kindGroupsOf 返回 null 走平铺——**错分不可原样渲染**。'), () => {
  // 逐条取 points 与 kinds 的数组长度比对（源码级真源判定，不靠人工记账）
  const entRe = /version: '([^']+)', date: '([^']+)', title: '(?:[^'\\]|\\.)*',\s*points: \[/g
  let m, bad = 0, checked = 0
  while ((m = entRe.exec(CD))) {
    const ver = m[1]
    let i = m.index + m[0].length, depth = 1
    while (depth > 0) {
      const ch = CD[i]
      if (ch === '[') depth++
      else if (ch === ']') depth--
      else if (ch === "'") { i++; while (true) { if (CD[i] === '\\') { i += 2; continue } if (CD[i] === "'") break; i++ } }
      i++
    }
    const body = CD.slice(m.index + m[0].length, i - 1)
    const nPts = (body.match(/'(?:[^'\\]|\\.)*'/g) || []).length
    /* ★定位必须从 points 数组**闭合的那个 `]` 本身**开始（不是它后面一位），且先吃掉
       `\n    ],` 再锚 kinds。此前写成 `CD.slice(i)` 而 i 已指向 `]` 的下一位，slice 从逗号起，
       `^\s*\],\s*` 永远匹配不到 → checked 恒为 0 → 本条恒红成"未解析到任何 kinds"。
       这与 R3-B′ 是同一类错：**判据自己失配，却报成业务不达标。** */
    const after = CD.slice(i - 1, i + 400).replace(/^\s*\],\s*/, '')
    const km = after.match(/^kinds:\s*\[([^\]]*)\]/)
    if (!km) continue
    checked++
    const nKinds = (km[1].match(/'(?:[^'\\]|\\.)*'/g) || []).length
    if (nKinds !== nPts) { console.log(`     V${ver}：kinds ${nKinds} 条 ≠ points ${nPts} 条`); bad++ }
  }
  if (checked === 0) { console.log('     未解析到任何 kinds——S5-1 可能已失效'); return false }
  if (bad) return false
  console.log(`     已核对 ${checked} 个标注版本，长度全部一致`)
  return true;
});

check(NAME(
  'S5-3 三段口径与回落：CL_SECTIONS 顺序为 新增→修复→优化；空段不返回；',
  'kinds 缺失 / 长度脱节 / 少于三条要点 三种情形一律回落 null 走平铺。',
  '★为什么少于三条不分段：95 个 v2 时代版本每版只有 1 条要点，硬分三段会造出两个空标题，',
  '让人以为"这一版没有这类变化"——而真实原因是"这一版没有这类可分的变化"。'), () => {
  const o = CDO.indexOf('export const CL_SECTIONS')
  if (o < 0) { console.log('CL_SECTIONS 缺失'); return false }
  const seg = CDO.slice(o, o + 400)
  const order = [...seg.matchAll(/kind: '(\w+)'/g)].map(x => x[1]).slice(0, 3)
  if (order.join(',') !== 'add,fix,opt') { console.log('三段顺序不是 新增→修复→优化，实为', order.join(',')); return false }
  if (!/label: '新增'/.test(seg) || !/label: '修复'/.test(seg) || !/label: '优化'/.test(seg)) { console.log('三段中文标签不齐'); return false }
  const fn = CDO.slice(CDO.indexOf('export function kindGroupsOf'), CDO.indexOf('export function kindGroupsOf') + 900)
  if (!/!k \|\| k\.length !== e\.points\.length \|\| e\.points\.length < 3/.test(fn)) { console.log('三重回落条件缺失'); return false }
  if (!/if \(items\.length\)/.test(fn)) { console.log('空段未被过滤'); return false }
  return true;
});

/* ────────── 呈现层：mono / caption / 三段 / 置顶 / 68ch ────────── */

check(NAME(
  'S5-4 四条验收（V3.9.14 重指）：版本号等宽 + 日期 caption + 三段式分组 + 单列正文铺满并两端对齐。'), () => {
  const ver = /\.gs-cl-ver \{[^}]*font-family:\s*ui-monospace/.exec(GS)
  if (!ver) { console.log('版本号未走等宽字体'); return false }
  if (!/\.gs-cl-date \{[^}]*font-size:\s*var\(--fs-caption\)/.test(GS)) { console.log('日期非 caption'); return false }
  if (!/\.gs-cl-points \{[^}]*max-width:\s*none/.test(GSO)) { console.log('正文未取消固定 68ch 行宽'); return false }
  if (!/\.gs-cl-points \{[^}]*text-align:\s*justify/.test(GSO)) { console.log('单列正文未两端对齐'); return false }
  if (/grid-template-columns:\s*repeat\(2/.test(GSO)) { console.log('版本正文回流成双列'); return false }
  if (!GSO.includes('v-for="g in kindGroupsOf(e)"')) { console.log('模板未按三段分组渲染'); return false }
  return true;
});

check(NAME(
  'S5-4′ 回染棘轮：日期色不得退回 --text-4。',
  '★原值是 --text-4（浅色主题约 2:1，真机近乎隐形）。降噪只能动字号与间距，不能动对比度——',
  '这条钉的是纪律不是效果：将来谁想让它"更淡一点"，会在这里变红。'), () => {
  const m = /\.gs-cl-date \{([^}]*)\}/.exec(GS)
  if (!m) return false
  if (m[1].includes('--text-4')) { console.log('日期退回 --text-4（W12-G 同款判红）'); return false }
  if (!m[1].includes('--text-3')) { console.log('日期未用 --text-3'); return false }
  return true;
});

check(NAME(
  'S5-5 富文本真渲染：要点不再走 `{{ p }}` 平铺，RichText 已接进两种渲染分支（分段 / 平铺）。',
  '★这是规范没写、但真实存在的一处缺陷：要点里的加粗标记从来没被渲染过，星号原样显示给用户。'), () => {
  if (!/<RichText :text="p" \/>/.test(GS)) { console.log('模板未使用 RichText'); return false }
  // 平铺分支（v-else）与分段分支各一处
  const n = (GS.match(/<RichText :text="p" \/>/g) || []).length
  if (n < 2) { console.log(`RichText 只出现 ${n} 处，分段/平铺两分支应各一处`); return false }
  // 负锚：不得有直接 {{ p }} 的裸渲染
  if (/<li[^>]*>\{\{ p \}\}<\/li>/.test(GS)) { console.log('仍有 {{ p }} 裸渲染，星号会漏到用户面前'); return false }
  if (!/<template v-else>/.test(GS)) { console.log('平铺分支缺失'); return false }
  return true;
});

check(NAME(
  'S5-6 ★RichText 只认成对 `**`，单星号原样输出；未闭合不吞字符。',
  '★为什么强调「成对」：要点正文里有 `ds-*` 这类 CSS 通配符（含单个星号，1 处）。',
  '「成对才认」天然避开它——单星号既不匹配也不闭合。'), () => {
  /* ★读 codeOnly 而非 RT 原文：组件头注释里正写着「为什么不用 v-html」这句理由，
   而下一条负锚判的正是 v-html 字面量——两者会在注释里撞车（R71 老坑：注释复述被禁字面量）。
   ★匹配的是**源码里的转义形态** `\*\*([^*]+)\*\*`（codeOnly 不还原转义），
   早先误写成未转义的 `\*\*([^*]+)\*\*` 之外的等价形式，导致本条恒红。 */
  if (!/const re = \/\\\*\\\*\(\[\^\*\]\+\)\\\*\\\*\/g/.test(RTC)) { console.log('未使用成对标记正则'); return false }
  if (!RTC.includes('last < s.length')) { console.log('尾部残留未输出，未闭合星号会被吞'); return false }
  return true;
});

check(NAME(
  'S5-7 ★负锚：RichText 不得用 v-html / innerHTML。',
  '只为「加粗」一种效果开一个 HTML 注入面不划算——库里已有 24 处历史 v-html 存量，',
  '不该再添新的；输出文本节点数组，由 Vue 自动转义。',
  '★读的是剥注释后的源码：组件头注释里正写着「不用 v-html」这句理由，不剥注释会与自己的负锚撞车。'), () => {
  if (/v-html/.test(RTC)) { console.log('RichText 用了 v-html'); return false }
  if (/innerHTML/.test(RTC)) { console.log('RichText 用了 innerHTML'); return false }
  if (!/<b v-if="s\.bold">/.test(RTC)) { console.log('加粗段未走 b 标签'); return false }
  return true;
});

/* ────────── 置顶与徽章 ────────── */

check(NAME(
  'S5-8 当前版本恒在首位，且徽章仍由 runtimeVersion 对照（不写字面量版本号）。',
  '★为什么显式排序而不靠数组倒序：数据本就倒序，"当前版本在首"目前是巧合；',
  '一旦有人把数组改成正序、或未发 tag 的版本先进表，验收会静默失效。'), () => {
  if (!/v-for="e in orderedChangelog"/.test(GS)) { console.log('模板未走 orderedChangelog'); return false }
  if (!/const orderedChangelog/.test(GS)) { console.log('orderedChangelog 未定义'); return false }
  const seg = GS.slice(GS.indexOf('const orderedChangelog'), GS.indexOf('const orderedChangelog') + 600)
  if (!/CHANGELOG\.find\(e => e\.version === runtimeVersion\)/.test(seg)) { console.log('未按 runtimeVersion 找当前版本'); return false }
  if (!seg.includes('[cur, ...CHANGELOG.filter')) { console.log('未把当前版本提到首位'); return false }
  if (!GS.includes('class="gs-cl-now">当前版本')) { console.log('当前版本徽标缺失'); return false }
  // 负锚：徽章不得改用数组下标或字面量
  if (/gs-cl-now[\s\S]{0,120}index\s*===\s*0/.test(GS)) { console.log('徽章改用下标判定——版本号一改就错'); return false }
  return true;
});
