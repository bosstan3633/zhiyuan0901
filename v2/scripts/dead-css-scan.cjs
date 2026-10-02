#!/usr/bin/env node
/* R4-Et 孤儿 CSS 扫描器（重建 + 收紧；R4-Dj 那份在 /tmp 已失）

   为什么"重建"：R4-Dj 当年判"走查覆盖不足、不动手"，是因为**没有任何一把尺子读得出"这个 class 真在屏上出现过吗"**。
   R4-En 给 theme-audit 装了 DOM class census（每张截图前记一遍页面上出现过的 class token），这把尺子才存在。
   所以本工具的第一条硬要求就是 census 文件在位——**没有 census 就拒绝出结论**（宁可不给候选，也不给一份"看起来能删"的清单）。

   口径（三票都零才算「死」，任一票 nonzero 就留下）：
     ① 静态票：token 出现在**同一个文件**的 class="…" / :class 字符串 / 任意字符串字面量里 ⇒ 活。
        为什么按文件：本轮动的 10 个组件全是 <style scoped>，跨文件的同名 class 不可能命中这里的 DOM。
        全局 .css（非 scoped）不适用这一条，退回全站静态票。
     ② census 票：token 出现在 104 场景任一张截图的真实 DOM 里 ⇒ 活（这一票是全局的，偏保守，只 veto 不误放）。
     ③ 拼接票：token 是某个字符串字面量的前缀/后缀/子串（'gp-' + kind、`class="x ${y}"`） ⇒ 活。
   另加两类只报不删的桶：
     · 祖先断：`.a .b` 里 .a 三票全零而 .b 活着 ⇒ 整条规则匹配不到任何东西（R4-Et 删完才暴露出来的口径盲区：
       旧版"任一 token 活就留"会把这种孤儿兄弟留下）。这一桶留给下一轮，本轮不动手。
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

function harvest(txt) {
  const attr = new Set()
  const strings = new Set()
  let m
  const re = new RegExp(strRe.source, strRe.flags)
  while ((m = re.exec(txt))) {
    const body = (m[1] ?? m[2] ?? m[3] ?? '')
    // 分隔符含引号与点，但**不含连字符**（类名里的 - 必须保住）：
    // :class="{ 'ai-clickable': canEdit(r) }" 里若不剥引号，token 就成了带撇的 'ai-clickable'，
    // 本文件的静态票就漏判——A/B 复算时 AiSuggestionDrawer 的 .ai-clickable 因此被误列进死桶。
    for (const t of body.split(/[\s,;{}()?|&+:./`]+/)) if (t && /^[A-Za-z][\w-]*$/.test(t)) strings.add(t)
    for (const t of body.replace(/['"]/g, ' ').split(/[\s,;{}()?|&+:/]+/)) if (t && /^[A-Za-z][\w-]*$/.test(t)) strings.add(t)
    strings.add(body)
  }
  for (const mm of txt.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
    for (const t of mm[1].trim().split(/\s+/)) if (t) attr.add(t)
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

/** 三票合一的存活判定。scoped=true 时静态票只看本文件 */
function aliveTok(tok, fileTokens, scoped) {
  if (fileTokens.attr.has(tok) || fileTokens.strings.has(tok)) return '静态(本文件)'
  if (globalAttrTokens.has(tok)) return 'class 属性(全站·pass-through)'
  if (!scoped && concatAlive(tok, globalStrings)) return '拼接'
  if (scoped && concatAlive(tok, fileTokens.strings)) return '拼接(本文件)'
  if (!scoped) { for (const h of perFile.values()) if (h.attr.has(tok)) return '静态(他文件)' }
  if (CENSUS.tokens[tok]) return 'census'
  return ''
}

const styleBlocks = []
/** 注释按等长空白抹掉：保行号，且不让样式说明里那些带点号的字（.lc-* / workspace.css）混进选择器被当成 token */
const blankComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
for (const f of sfc.filter(x => x.endsWith('.vue'))) {
  const txt = fs.readFileSync(f, 'utf8')
  for (const mm of txt.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)) {
    const scoped = /\bscoped\b/.test(mm[1])
    styleBlocks.push({ file: f, css: blankComments(mm[2]), line0: txt.slice(0, mm.index).split('\n').length, scoped })
  }
}
for (const f of files.filter(x => x.endsWith('.css'))) {
  styleBlocks.push({ file: f, css: blankComments(fs.readFileSync(f, 'utf8')), line0: 1, scoped: false })
}

const RULE = /([^{}]+)\{([^{}]*)\}/g
const dead = [], ancestorDead = []
collectGlobalAttrs()
expandTransitions()
let total = 0
for (const { file, css, line0, scoped } of styleBlocks) {
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
    const why = toks.map(t => aliveTok(t, ft, scoped))
    const rel = path.relative(SRC, file)
    const line = line0 + css.slice(0, m.index).split('\n').length - 1
    const rec = { file: rel, line, sel: sel.replace(/\s+/g, ' ').slice(0, 78), toks: toks.join(',') }
    if (why.every(w => !w)) { dead.push(rec); continue }
    // 祖先断：选择器按组合符切成几段，任意**前置段**整段三票全零 ⇒ 这条规则永远匹配不到
    const compounds = sel.split(/[>+~\s]+/).filter(Boolean)
    if (compounds.length > 1) {
      const deadSeg = compounds.slice(0, -1).find(seg => {
        const st = [...seg.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(x => x[1])
        return st.length > 0 && st.every(t => !aliveTok(t, ft, scoped))
      })
      if (deadSeg) ancestorDead.push({ ...rec, 断在: deadSeg.slice(0, 40) })
    }
  }
}

const byFile = (rows) => rows.reduce((a, r) => ((a[r.file] = a[r.file] || []).push(r), a), {})
const JSONout = argv.includes('--json')
if (JSONout) {
  console.log(JSON.stringify({ census: path.relative(path.resolve(SRC, '..', '..'), CENSUS.file), census场景数: CENSUS.场景数, 规则总数: total, 死: dead, 祖先断: ancestorDead }, null, 1))
} else {
  console.log(`census=${CENSUS.file}（${CENSUS.场景数} 场景 / ${Object.keys(CENSUS.tokens).length} token）  作用域=${SRC}`)
  console.log(`扫了 ${total} 条规则：判死 ${dead.length} 条（三票全零）· 祖先断 ${ancestorDead.length} 条（只报不删，留给下一轮）`)
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
