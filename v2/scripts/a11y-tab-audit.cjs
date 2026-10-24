#!/usr/bin/env node
/* G4（V3.8.27）：键盘可达静态审计。

   为什么是静态而不是只跑 Tab：Tab 遍历只能覆盖"当前这一屏、这一份数据"，而角度在**模板结构**里
   —— 一个 `<div @click>` 只要数据里出现就永远不可达，不需要真的打开那个页面也知道。
   所以本工具做静态普查，theme-audit / e2e 的 Tab 走查作为交叉验证，两者不互相替代。

   口径（写死，免得下一轮争）：
     ① 只算模板段 —— script 里拼的 HTML 字符串不收（那是数据，不直接上屏）。
     ② 只算"点击入口" —— `@click` / `v-on:click`（含 .stop/.prevent 等修饰符）。
     ③ 原生可聚焦元素豁免 —— button / a[href] / input / select / textarea / summary / details /
        label / option / audio[controls] / video[controls]。`<a>` 无 href 不算豁免。
     ④ 只有 `v-pressable`（统一键盘桥）或**同时**具备可聚焦声明与真实键盘处理，才视为已修复。
        裸 `role=` / 裸 `tabindex=` 不再算修复——它们只改变语义或 Tab 顺序，不保证 Enter/Space 可用。
        `tabindex="-1"` 仍单独列一栏：它只把元素移出 Tab 序列，若没有配套的键盘处理就是**假修复**。
     ⑤ 先剥注释 —— 注释里举例的 `<div @click>` 不能算数。

   用法：
     node scripts/a11y-tab-audit.cjs            人读清单（按文件分组）
     node scripts/a11y-tab-audit.cjs --count    只输出总数，供 regression 棘轮消费
     node scripts/a11y-tab-audit.cjs --md       输出 Markdown 表格（写进审计报告）

   退出码恒为 0：**审计不等于当批全修**（B2 已拍板）。要拦回涨，用 --count 在 regression 里做棘轮。
*/
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'src')
const NATIVE = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'details', 'label', 'option',
  'audio', 'video'
])

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (e.name.endsWith('.vue')) acc.push(p)
  }
  return acc
}

function stripComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
}

function lineOf(src, idx) {
  let n = 1
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++
  return n
}

/** 解析一个开标签的属性串，返回 { hasClick, tabindex, role, href, pressable, keydown } */
function readAttrs(attrs) {
  const hasClick = /(^|\s)(@click|v-on:click)(\.|\s|=|$)/.test(attrs)
  const ti = /\stabindex\s*=\s*("([^"]*)"|'([^']*)')/.exec(attrs)
  const tabindex = ti ? (ti[2] !== undefined ? ti[2] : ti[3]) : null
  const role = /\srole\s*=/.test(attrs)
  // 动态 :href / v-bind:href 同样是真链接；旧口径只认静态 href，会把可打开的资源卡误报成缺口。
  const href = /(^|\s)(?::href|v-bind:href|href)\s*=/.test(attrs)
  const pressable = /(^|\s)v-pressable(?:\s|=|$)/.test(attrs)
  const keydown = /(^|\s)(@keydown|v-on:keydown)(\.|\s|=|$)/.test(attrs)
  return { hasClick, tabindex, role, href, pressable, keydown }
}

function audit() {
  const out = []
  const fakeFix = []
  const backdrops = []
  for (const file of walk(SRC)) {
    const raw = fs.readFileSync(file, 'utf8')
    const i0 = raw.indexOf('<template')
    const i1 = raw.lastIndexOf('</template>')
    if (i0 < 0) continue
    const tpl = stripComments(i1 > i0 ? raw.slice(i0, i1) : raw.slice(i0))
    const re = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)\/?>/g
    let m
    while ((m = re.exec(tpl))) {
      const tag = m[1].toLowerCase()
      const attrs = m[2] || ''
      const a = readAttrs(attrs)
      if (!a.hasClick) continue
      // 纯容器只负责阻止冒泡 / 关闭浮层，没有自身动作。给它们加按钮语义会制造空 Tab 停靠点。
      if (/(^|\s)data-a11y-container(?:\s|=|$)/.test(attrs)) continue
      if (NATIVE.has(tag)) {
        // <a> 无 href 不可聚焦；其余原生控件天然可达
        if (tag === 'a' && !a.href && a.tabindex === null) {
          out.push({ file, line: lineOf(raw, i0 + m.index), tag, snippet: m[0] })
        }
        continue
      }
      if (a.pressable) continue
      // A focus target only counts when the author also handles the keyboard.
      // A role alone is semantic sugar, not a working interaction.
      if (a.tabindex !== null && a.tabindex !== '-1' && a.keydown) continue
      // 遮罩层（overlay/scrim/mask/backdrop）是"点空白关闭"的惯例，键盘通道是 ESC —— 单独计数、不算缺口
      // （若某天 ESC 被删，e2e 的浮层用例会先红，不靠这条静态规则兜）。
      if (/(overlay|scrim|mask|backdrop)/i.test(attrs)) { backdrops.push({ file, line: lineOf(raw, i0 + m.index), tag }); continue }
      const rec = { file, line: lineOf(raw, i0 + m.index), tag, snippet: m[0] }
      if (a.tabindex === '-1') fakeFix.push(rec)
      else out.push(rec)
    }
  }
  return { out, fakeFix, backdrops }
}

/** 焦点可见性杀手：全站 outline:none / outline: 0 */
function outlineKillers() {
  const hits = []
  for (const file of walk(SRC)) {
    const raw = fs.readFileSync(file, 'utf8')
    const lines = raw.split('\n')
    lines.forEach((l, i) => {
      if (/outline\s*:\s*(none|0)\b/.test(l) && !/^\s*\/\*/.test(l)) {
        hits.push({ file, line: i + 1, text: l.trim() })
      }
    })
  }
  return hits
}

function rel(p) { return path.relative(path.join(__dirname, '..'), p) }

const { out, fakeFix, backdrops } = audit()
const killers = outlineKillers()

if (process.argv.includes('--count')) {
  console.log(out.length)
  process.exit(0)
}

if (process.argv.includes('--json')) {
  const rows = out.map(r => ({
    file: rel(r.file),
    line: r.line,
    tag: r.tag,
    snippet: r.snippet.replace(/\s+/g, ' '),
  }))
  console.log(JSON.stringify({
    total: rows.length,
    files: new Set(rows.map(r => r.file)).size,
    fakeFix: fakeFix.length,
    outlineKillers: killers.length,
    backdrops: backdrops.length,
    rows,
  }, null, 2))
  process.exit(0)
}

if (process.argv.includes('--md')) {
  const byFile = new Map()
  for (const r of out) {
    const k = rel(r.file)
    if (!byFile.has(k)) byFile.set(k, [])
    byFile.get(k).push(r)
  }
  console.log('| 文件 | 处数 | 首次出现行 |')
  console.log('|---|---|---|')
  for (const [f, rs] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`| \`${f}\` | ${rs.length} | ${rs[0].line} |`)
  }
  console.log(`\n合计 **${out.length}** 处 / ${byFile.size} 文件；另有 \`tabindex="-1"\` 假修复 ${fakeFix.length} 处、\`outline:none\` 焦点杀手 ${killers.length} 处、遮罩层（ESC 关闭，不计缺口）${backdrops.length} 处。`)
  process.exit(0)
}

const byFile = new Map()
for (const r of out) {
  const k = rel(r.file)
  if (!byFile.has(k)) byFile.set(k, [])
  byFile.get(k).push(r)
}
console.log('\n=== G4 键盘可达审计：可点击但不可聚焦 ===\n')
for (const [f, rs] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${f}  (${rs.length})`)
  for (const r of rs.slice(0, 6)) {
    const s = r.snippet.replace(/\s+/g, ' ').slice(0, 110)
    console.log(`  L${r.line}  <${r.tag}>  ${s}`)
  }
  if (rs.length > 6) console.log(`  … 另 ${rs.length - 6} 处（--md 看全量）`)
}
console.log(`\n合计 ${out.length} 处 / ${byFile.size} 文件（另有遮罩层 ${backdrops.length} 处已按 ESC 惯例豁免）`)

if (fakeFix.length) {
  console.log(`\n=== tabindex="-1" 假修复（移出 Tab 序列但无键盘处理） ${fakeFix.length} 处 ===`)
  for (const r of fakeFix.slice(0, 15)) console.log(`  ${rel(r.file)}:${r.line}  <${r.tag}>`)
}

if (killers.length) {
  console.log(`\n=== outline:none / 0（会掐掉焦点环） ${killers.length} 处 ===`)
  for (const r of killers.slice(0, 15)) console.log(`  ${rel(r.file)}:${r.line}  ${r.text.slice(0, 100)}`)
}
console.log('')
