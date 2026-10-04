#!/usr/bin/env node
/* R4-Et 孤儿 CSS 扫描器（重建 + 收紧；R4-Dj 那份在 /tmp 已失）

   为什么"重建"：R4-Dj 当年判"走查覆盖不足、不动手"，是因为**没有任何一把尺子读得出"这个 class 真在屏上出现过吗"**。
   R4-En 给 theme-audit 装了 DOM class census（每张截图前记一遍页面上出现过的 class token），这把尺子才存在。
   所以本工具的第一条硬要求就是 census 文件在位——**没有 census 就拒绝出结论**（宁可不给候选，也不给一份"看起来能删"的清单）。

   口径（★R4-Ev 之后是**四票**，全零才算「死」，任一非零就留下；见 aliveTok 的实际来源）：
     ① 本文件静态票：token 出现在**同一个文件**的 class="…" / :class / 任意字符串字面量里 ⇒ 活。
        为什么按文件：被扫的组件几乎都是 <style scoped>，跨文件同名 class 不可能命中这里的 DOM。
        全局 .css（非 scoped）不适用这一条，退回全站票。
     ② 全站 class 属性票：Vue 把父组件写在 <Child class="x"> 上的类透传到子根元素 ⇒ 子的 scoped 规则照样命中。
     ③ 全站精确字符串票（★scoped 也吃这一票，R4-Ev 补）：类名值可以来自**别的文件**的数据表
        （curiosity.ts 的 cls:'exploring' 被 :class="statusMeta(...).cls" 用掉）；比的是精确 token，不是子串。
        同族还有**插值前缀票**：`l${lv}` 让 .dz-cell.l4 活着，而 l4 这个 token 全仓库不存在——
        只认"整串形如 前缀${…}"且尾巴 ≤3 字符，免得把整片 l* 都救活。
     ④ census 票：token 出现在 104 场景任一张截图的真实 DOM 里 ⇒ 活（全局、偏保守，只 veto 不误放）。
     另有拼接票（只认以 -/_ 结尾的字面量前缀，'gp-' + kind 这种），口径细节见 concatAlive。
   两类特殊桶（★现状：两桶都已在 R4-Ev 删清，此后**非空即棘轮红**——判据 R4-Ev①，
   处置是删掉或写备案，不是"留给下一轮"，更不是把票调松）：
     · 死：四票全零。
     · 祖先断：复合段 .a.b 要求元素同时带 a 与 b ⇒ 任一类名四票全零，整段就匹配不到。
       （R4-Et 的旧口径"任一 token 活就留"会把这种孤儿兄弟留下；逗号列表按顶层逗号拆段、每段都判死才算死，
       括号组按深度剥、:is/:not 的参数不参与段判定——这两处都是 R4-Ev 现场逼出来的。）
     · 过渡件：<Transition name="x"> 的 x-enter-active 等六件套永不进死桶。

   用法：
     node scripts/dead-css-scan.cjs                 人读输出
     node scripts/dead-css-scan.cjs --json          机器可读（死 + 祖先断）
     node scripts/dead-css-scan.cjs --src <目录> --census <文件>   A/B：拿删除前的副本复算，自证删的都是「死」
*/
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
const SRC = path.resolve(argOf('--src') || path.resolve(__dirname, '..', 'src'))
const ARCHIVE = path.resolve(__dirname, '..', '..', 'docs', '视觉归档')

/** 取最新一份 census（或 --census 指定）；拿不到就拒绝出结论 */
function loadCensus() {
  const pinned = argOf('--census')
  let p = pinned
  if (!p && fs.existsSync(ARCHIVE)) {
    p = fs.readdirSync(ARCHIVE).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()
      .map(d => path.join(ARCHIVE, d, 'class-census.json')).find(f => fs.existsSync(f))
  }
  if (!p || !fs.existsSync(p)) {
    console.error('✗ 没有 DOM class census（docs/视觉归档/<日期>/class-census.json 或 --census 指定）。')
    console.error('  先跑一次 node scripts/theme-audit.cjs（四主题全量，它会顺手产出 census）再来扫。')
    console.error('  这条硬闸是 R4-Et 立的：无 census 的"孤儿清单"曾经把 150 条规则的判据变成纯猜。')
    process.exit(2)
  }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (!j.计数 || Object.keys(j.计数).length < 100) {
    console.error(`✗ census 文件不像话（token 数=${j.计数 ? Object.keys(j.计数).length : '无'}），拒绝据此出结论：${p}`)
    process.exit(2)
  }
  return { file: p, 场景数: j.场景数, tokens: j.计数 }
}

const CENSUS = loadCensus()
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}
const files = walk(SRC)
const sfc = files.filter(f => /\.(vue|ts|js)$/.test(f))

const strRe = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/gs
const concatBases = []             // 真正的拼接前缀（'gp-' 这类以 -/_ 结尾的字面量）
const globalStrings = new Set()      // 全站字符串（拼接票的语料）
const transitionNames = new Set()
const perFile = new Map()            // 文件 → { attr: Set, strings: Set }

const interpPrefixes = new Set() // 模板串整体就是 `前缀${…}` 形状时的那个前缀（Heatmap 的 `l${lv}` ⇒ l1…l4）
function harvest(txt) {
  const attr = new Set()
  const strings = new Set()
  let m
  const re = new RegExp(strRe.source, strRe.flags)
  while ((m = re.exec(txt))) {
    const body = (m[1] ?? m[2] ?? m[3] ?? '')
    for (const t of body.split(/[\s,;{}()?|&+:./`]+/)) if (t && /^[A-Za-z][\w-]*$/.test(t)) strings.add(t)
    for (const t of body.replace(/['"]/g, ' ').split(/[\s,;{}()?|&+:/]+/)) if (t && /^[A-Za-z][\w-]*$/.test(t)) strings.add(t)
    const it = body.match(/^([A-Za-z][\w-]*)\$\{[^}]*\}$/)
    if (it) interpPrefixes.add(it[1])
    strings.add(body)
  }
  for (const mm of txt.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
    // 同样要剥引号与冒号：:class="{ 'dz-hl': dzHl }" 里若留下 'dz-hl':，这枚**真在用**的类就被判死
    // （R4-Ev 的第一批假阳性就是这么来的——dz-hl 只在设置页"高亮可交互"打开时渲染，census 也看不见它）
    for (const t of mm[1].trim().split(/[\s'":]+/)) if (t) attr.add(t)
  }
  for (const mm of txt.matchAll(/<\s*(?:Transition|transition)[^>]*\bname\s*=\s*"([^"]+)"/g)) transitionNames.add(mm[1])
  return { attr, strings }
}
for (const f of sfc) {
  const txt = fs.readFileSync(f, 'utf8')
  // ★口径修正（A/B 复算时现抓的）：CSS 里的 content: '' 之类单引号会让"字符串字面量"正则从样式块里
  // 一路吞到下一处引号，把整段选择器当成字符串 harvest 进来 ⇒ 谁都被判活、死桶只剩 21 条。
  // 语料只取模板 + 脚本（样式块里不该有任何"引用"，它自己被扫）。
  const h = harvest(f.endsWith('.vue') ? txt.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '') : txt)
  perFile.set(f, h)
  for (const s of h.strings) globalStrings.add(s)
  collectBases(h.strings)
}

/**
 * ③ 拼接票：只认**真正的拼接形状**——形如 'gp-' + kind 的字面量必然以 - 或 _ 结尾。
 *   （A/B 复算时收紧的：旧口径"token 是任一字符串的子串/前缀"会把 nd-edit / node / stagnant 判活，
 *    理由是它们恰好是活类名 nd-edit-hint / node-title / stagnant-tag 的前缀——那是命名法，不是拼接。
 *    实测旧口径让本轮删掉的 150 条里有 19 条在扫描器面前"活着"，工具结论与动手依据就此分家。）
 */
function collectBases(strings) {
  for (const s of strings) if (s.length >= 3 && /[-_]$/.test(s)) concatBases.push(s)
}
function concatAlive(tok, strings) {
  for (const s of strings) if (s === tok) return true
  for (const b of concatBases) if (b !== tok && tok.startsWith(b)) return true
  return false
}

const globalTokens = new Set()   // 全站字符串里出现过的**精确 token**（不是子串）
function collectGlobals() { for (const h of perFile.values()) for (const s of h.strings) globalTokens.add(s) }

/** <Transition name="x"> 真实生成的 token 全集：x 本体 + 六件套。**只豁免这些**——
 *  v1 用 startsWith(name + '-') 判过渡件，于是 CuriosityPanel 的 name="expand" 顺手把 CompassTree 里
 *  毫不相干的 .goal-node .expand-icon 豁免了（Workspace 的 name="batch" 同理放过 .batch-tagin）。 */
const TRANSITION_SUF = ['-enter-from', '-enter-active', '-enter-to', '-leave-from', '-leave-active', '-leave-to']
const transitionTokens = new Set()
function expandTransitions() {
  for (const n of transitionNames) { transitionTokens.add(n); for (const s of TRANSITION_SUF) transitionTokens.add(n + s) }
}

/** 全站 class 属性 token（跨文件）——scoped 也要认这一票：Vue 会把父组件写在 <Child class="x"> 上的类
 *  透传到子组件根元素，而根元素同时带子组件的 scope id ⇒ 子组件的 scoped 规则照样能命中。
 *  v1 的跨文件池化把"任意字符串子串"都算上（太松，150 条里有 19 条被这种前缀误判救活）；
 *  这里只池化**精确的 class 属性 token**，既堵住 pass-through 又不再误救。 */
const globalAttrTokens = new Set()
function collectGlobalAttrs() { for (const h of perFile.values()) for (const t of h.attr) globalAttrTokens.add(t) }

/** 四票合一的存活判定（口径见文件头）。scoped=true 时本文件静态票只看本文件，但全站精确字符串票照吃 */
function aliveTok(tok, fileTokens, scoped) {
  if (fileTokens.attr.has(tok) || fileTokens.strings.has(tok)) return '静态(本文件)'
  if (globalAttrTokens.has(tok)) return 'class 属性(全站·pass-through)'
  // ★scoped 也要吃这一票：类名值可以由**别的文件**的数据表产出（curiosity.ts 的 cls:'exploring'
  //  被 CuriosityPanel 的 :class="statusMeta(...).cls" 用掉），只查本文件字符串会把它判死。
  //  这里比的是**精确 token**，不是 v1 的子串匹配，所以不会把 node 因 node-title 救活。
  if (globalTokens.has(tok)) return '字符串(全站)'
  // ★插值前缀票：Heatmap 的 cells.push({cls:[`l${lv}`]…}) 让 .dz-cell.l4 是活的，
  //   但 `l4` 这个 token 在任何源码里都不存在（是运行时拼出来的），token 匹配天生看不见。
  //   只认"整个模板串就是 前缀${…}"这一种形状，且要求尾巴 ≤3 字符（l4 / t2 这种），免得把整片 l* 都救活。
  for (const p of interpPrefixes) if (p !== tok && tok.startsWith(p) && tok.length - p.length >= 1 && tok.length - p.length <= 3) return '插值前缀(' + p + '${…})'
  if (!scoped && concatAlive(tok, globalStrings)) return '拼接'
  if (scoped && concatAlive(tok, fileTokens.strings)) return '拼接(本文件)'
  if (!scoped) { for (const h of perFile.values()) if (h.attr.has(tok)) return '静态(他文件)' }
  if (CENSUS.tokens[tok]) return 'census'
  return ''
}

const styleBlocks = []
/** 注释按等长空白抹掉：保行号，且不让样式说明里那些带点号的字（.lc-* / workspace.css）混进选择器被当成 token */
const blankComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
/** 从 `{` 往回走，跳过空白、再剥掉紧邻的注释块，落到选择器自身那一行。
    行号一律按**整份文件**数换行（absBase = 样式块内容在文件里的绝对起点），
    不再用"line0 + 块内行号"那种加减——R4-Et/R4-Ev 两轮的行号偏移都出在这套加减上。 */
function selectorLine(rawCss, fromIdx) {
  // 前向走：跳过空白 → 跳过紧邻的注释块（可多段）→ 落在选择器第一个字符上。
  // 比"从 { 往回走"对：逗号列表跨行时（`a .x,\n  b .y {`）往回走会停在最后一段那一行。
  let i = fromIdx
  for (let guard = 0; guard < 12; guard++) {
    while (i < rawCss.length && /\s/.test(rawCss[i])) i++
    if (rawCss.slice(i, i + 2) === '/*') {
      const close = rawCss.indexOf('*/', i + 2)
      if (close < 0) break
      i = close + 2
      continue
    }
    break
  }
  return i
}
for (const f of sfc.filter(x => x.endsWith('.vue'))) {
  const txt = fs.readFileSync(f, 'utf8')
  for (const mm of txt.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)) {
    const scoped = /\bscoped\b/.test(mm[1])
    // line0 = 样式块**第一行内容**所在的文件行号：`<style scoped>` 自己占一行，内容从下一行开始。
    // ★R4-Ev 修：原先直接取 <style> 那一行的行号，导致 .vue 里报出的行号一律比实际小 1
    //   （.css 文件 line0=1 不受影响）——按行号去定位删除会删错行，所以必须修准。
    styleBlocks.push({ file: f, css: blankComments(mm[2]), raw: mm[2], absBase: mm.index + mm[0].indexOf('>') + 1, scoped })
  }
}
for (const f of files.filter(x => x.endsWith('.css'))) {
  const raw = fs.readFileSync(f, 'utf8')
  styleBlocks.push({ file: f, css: blankComments(raw), raw, absBase: 0, scoped: false })
}

/** 逗号在括号里不算分隔（`:is(button, a, .x)` / `:not(.a, .b)`），选择器列表要先按顶层逗号拆开 */
function splitTopLevel(sel) {
  const out = []; let depth = 0, cur = ''
  for (const ch of sel) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
/** 去掉**配平的**括号组（`:is(a, :not(b))` 这种嵌套要用深度计数，`[^)]*` 会在第一个右括号处早停，
 *  把 `:is(... , .dz-ov-card, ...)` 的尾巴留在外面 ⇒ 尾巴被当成祖先段，整条规则被误报成祖先断） */
function stripParens(s) {
  let out = '', depth = 0
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') { if (depth > 0) depth-- }
    else if (depth === 0) out += ch
  }
  return out
}
/** 单个选择器段的判定：'活' | '死' | '祖先断'（断在哪一段）
 *  ★R4-Ev 口径收紧：复合段 `.a.b` 要求元素**同时**带 a 与 b ⇒ 其中一个类名四票全零，整段就匹配不到。
 *    旧口径"这一段里任一 token 活着就算活"把 `.toggle.on`（toggle 死、on 活）、`.metric-item.expanded`
 *    这类**孤儿兄弟**留下了——R4-Et 删完基类后它们已经谁也够不着，只是没人报。
 *    `:is(...)` / `:not(...)` 的参数一律剥掉不参与判定（那是"或"与"非"，不是必须同时成立）。 */
function judgePart(part, ft, scoped) {
  const bare = stripParens(part)
  const compounds = bare.split(/[>+~\s]+/).filter(Boolean)
  const deadOf = (c) => {
    const st = [...c.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(x => x[1])
    return st.length ? st.find(t => !aliveTok(t, ft, scoped)) : ''
  }
  const hit = compounds.map((c, idx) => ({ c, idx, t: deadOf(c) })).filter(x => x.t)
  if (!hit.length) return { kind: '无类或全活' }
  const last = compounds.length - 1
  const first = hit.find(x => x.idx < last) || (hit[0].idx === last && compounds.length === 1 ? null : null)
  if (compounds.length === 1) return { kind: '死', 因: hit[0].t }
  if (first) return { kind: '祖先断', 断在: first.c }
  return { kind: '尾段断', 断在: hit[0].c }      // 末段自己带了死类名（如 .x .toggle.on）
}

const RULE = /([^{}]+)\{([^{}]*)\}/g
const explainHits = []
/** 每个换行符记一行：行号 = 该字符之前的换行数 + 1（一次算好，避免各处加减口径不一） */
const TXTS = new Map()
const txtLineAt = (file) => {
  if (!TXTS.has(file)) {
    const t = fs.readFileSync(file, 'utf8')
    const arr = [1]
    for (let i = 0; i < t.length; i++) arr.push(arr[i] + (t[i] === '\n' ? 1 : 0))
    TXTS.set(file, { lineOf: arr, text: t })
  }
  return TXTS.get(file)
}
const dead = [], ancestorDead = []
collectGlobalAttrs()
collectGlobals()
expandTransitions()
let total = 0
for (const { file, css, raw, absBase, scoped } of styleBlocks) {
  const ft = perFile.get(file) || { attr: new Set(), strings: new Set() }
  let m
  const re = new RegExp(RULE.source, RULE.flags)
  while ((m = re.exec(css))) {
    const sel = m[1].trim()
    if (!sel || sel.startsWith('@') || /^\d/.test(sel)) continue
    total++
    const toks = [...sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(x => x[1])
    if (!toks.length) continue
    if (toks.some(t => transitionTokens.has(t))) continue
    const rel = path.relative(SRC, file)

    // 行号指到**选择器自己那一行**（R4-Ev 修的两处偏移：.vue 的 <style> 占一行；规则上面压着注释时
    //   旧算法会把规则报成注释那一行——按行号去删就会跳过错删）
    const line = txtLineAt(file).lineOf[absBase + selectorLine(raw, m.index)]
    explainHits.push({ file: path.relative(SRC, file), line, sel: sel.replace(/\s+/g, ' ').trim() })
    const rec = { file: rel, line, sel: sel.replace(/\s+/g, ' ').slice(0, 78), toks: toks.join(',') }
    /** ★整条规则要**每个逗号段**都判死才算死**（R4-Ev 修的口径）：旧版把带逗号的整串当一条链切，
     *  于是 `body .module-title .name, body .tc-module-title .tc-name` 里第一段被当成"祖先段"，
     *  只要它断了就把整条规则报成祖先断——而第二段完全可能活着。 */
    const parts = splitTopLevel(sel).map(p => judgePart(p, ft, scoped))
    const deadish = p => p.kind === '死' || p.kind === '祖先断' || p.kind === '尾段断'
    if (!parts.every(deadish)) continue
    if (parts.every(p => p.kind === '死')) { dead.push(rec); continue }
    ancestorDead.push({ ...rec, 断在: parts.map(p => p.断在 || p.因).filter(Boolean).join(' , ').slice(0, 40) })
  }
}

/* --explain <选择器>：打印扫描器为某条规则算出的 file:line，并回显该行真实内容。
   行号是这个工具最主要的"人用的坐标"，R4-Et/R4-Ev 两轮都栽在行号加减上（.vue 的 <style> 占一行、
   规则上面压着注释时又偏一行），所以给一条能被判据实跑自证的路。 */
const explain = argOf('--explain')
if (explain) {
  const hit = explainHits.find(h => h.sel.startsWith(explain))
  if (!hit) { console.log('未找到选择器：' + explain); process.exit(4) }
  const src = fs.readFileSync(path.join(SRC, hit.file), 'utf8').split('\n')[hit.line - 1] || ''
  console.log(JSON.stringify({ file: hit.file, line: hit.line, 该行: src.trim().slice(0, 90), 吻合: src.trim().startsWith(explain) }))
  process.exit(src.trim().startsWith(explain) ? 0 : 5)
}

const byFile = (rows) => rows.reduce((a, r) => ((a[r.file] = a[r.file] || []).push(r), a), {})
const JSONout = argv.includes('--json')
if (JSONout) {
  console.log(JSON.stringify({ census: path.relative(path.resolve(SRC, '..', '..'), CENSUS.file), census场景数: CENSUS.场景数, 规则总数: total, 死: dead, 祖先断: ancestorDead }, null, 1))
} else {
  console.log(`census=${CENSUS.file}（${CENSUS.场景数} 场景 / ${Object.keys(CENSUS.tokens).length} token）  作用域=${SRC}`)
  console.log(`扫了 ${total} 条规则：判死 ${dead.length} 条（四票全零）· 祖先断 ${ancestorDead.length} 条（棘轮：两桶非空即红，见判据 R4-Ev①）`)
  for (const [k, rows] of Object.entries(byFile(dead)).sort((a, b) => b[1].length - a[1].length)) {
    console.log('\n### 死 ' + k + '  (' + rows.length + ' 条)')
    for (const r of rows.slice(0, 30)) console.log(`   L${r.line}  {${r.toks}}  ${r.sel}`)
  }
  for (const [k, rows] of Object.entries(byFile(ancestorDead)).sort((a, b) => b[1].length - a[1].length)) {
    console.log('\n### 祖先断 ' + k + '  (' + rows.length + ' 条)')
    for (const r of rows.slice(0, 12)) console.log(`   L${r.line}  断在 ${r.断在}  ← ${r.sel}`)
  }
}
process.exit(0)
