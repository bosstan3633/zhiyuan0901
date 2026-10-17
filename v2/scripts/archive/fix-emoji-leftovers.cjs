#!/usr/bin/env node
/**
 * G1 收尾：修复迁移脚本遗留问题（2026-10-16 第二轮）
 * 1) script 字符串字面量内：emoji 剥离后残留的「前导空格」清理
 *    —— 形如 showToast(' 已保存')（原为 '✓ 已保存'）→ showToast('已保存')
 * 2) 模板文本节点：UNMAPPED 裸字符按语义映射（✏→edit、↵→arrowleft、✦→sparkle、
 *    ⇪→upload、✉→mail、✨→sparkles、⬡→hexagon、☑→checksquare、☰→menu）
 * 3) 输出二次手工清单：仍未处理的 icon-only/残留 emoji 位置
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src')
const MANUAL2 = '/tmp/emoji_manual2.txt'

// 裸字符 → Icon name（仅针对文本节点中脚本未映射的字符）
const CH_UNMAPPED = {
  '✏': 'edit', '↵': 'arrowleft', '✦': 'sparkle', '⇪': 'upload',
  '✉': 'mail', '✨': 'sparkles', '⬡': 'hexagon', '☑': 'checksquare', '☰': 'menu',
}

const RANGES = [
  [0x1f000, 0x1faff], [0x2600, 0x27bf], [0x2190, 0x21ff],
  [0x2b00, 0x2bff], [0xfe00, 0xfe0f], [0x1f1e6, 0x1f1ff],
]
function isEmoji(ch) {
  const o = ch.codePointAt(0)
  return RANGES.some(([a, b]) => a <= o && o <= b)
}
function isVS(ch) {
  const o = ch.codePointAt(0)
  return o === 0xfe0f || o === 0xfe0e
}

// ---------- script 字符串前导空格清理 ----------
function fixStringLeadingSpaces(line) {
  let res = ''
  let i = 0
  const n = line.length
  while (i < n) {
    const ch = line[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch
      let j = i + 1
      let str = q
      while (j < n) {
        const c = line[j]
        if (c === '\\') { str += c + (line[j + 1] || ''); j += 2; continue }
        if (c === q) { str += c; j++; break }
        // 字符串内容：若开头是空格，剥掉（迁移剥离 emoji 的残留）
        if (str.length === 1 && c === ' ' && j + 1 < n && line[j + 1] !== ' ') {
          j++
          continue
        }
        str += c
        j++
      }
      res += str
      i = j
      continue
    }
    res += ch
    i++
  }
  return res
}

function processScript(scriptBody) {
  const lines = scriptBody.split('\n')
  let inBlock = false
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (inBlock) {
      out.push(line)
      if (trimmed.includes('*/')) inBlock = false
      continue
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      out.push(line)
      if (trimmed.startsWith('/*') && !trimmed.includes('*/')) inBlock = true
      continue
    }
    if (trimmed.includes('/*')) {
      const idx = line.indexOf('/*')
      const pre = line.slice(0, idx)
      const post = line.slice(idx)
      out.push(fixStringLeadingSpaces(pre) + post)
      if (!post.includes('*/')) inBlock = true
      continue
    }
    out.push(fixStringLeadingSpaces(line))
  }
  return out.join('\n')
}

// ---------- 模板文本节点 UNMAPPED 映射 ----------
function processTemplate(tpl) {
  let out = ''
  let i = 0
  const n = tpl.length
  while (i < n) {
    if (tpl.startsWith('<!--', i)) {
      const end = tpl.indexOf('-->', i + 4)
      if (end === -1) { out += tpl.slice(i); break }
      out += tpl.slice(i, end + 3)
      i = end + 3
      continue
    }
    if (tpl.startsWith('<kbd', i) && /^<kbd[ >]/.test(tpl.slice(i, i + 6))) {
      const end = tpl.indexOf('</kbd>', i)
      if (end !== -1) { out += tpl.slice(i, end + 6); i = end + 6; continue }
    }
    if (tpl[i] === '<') {
      let j = i + 1
      let tag = '<'
      let quote = null
      while (j < n) {
        const ch = tpl[j]
        if (quote) {
          if (ch === quote) { quote = null; tag += ch; j++; continue }
          tag += ch; j++; continue
        }
        if (ch === '"' || ch === "'") { quote = ch; tag += ch; j++; continue }
        if (ch === '>') { tag += ch; j++; break }
        tag += ch; j++
      }
      out += tag
      i = j
      continue
    }
    if (tpl.startsWith('{{', i)) {
      const end = tpl.indexOf('}}', i + 2)
      const raw = end === -1 ? tpl.slice(i) : tpl.slice(i, end + 2)
      out += raw
      i = end === -1 ? n : end + 2
      continue
    }
    let j = i
    while (j < n && tpl[j] !== '<' && !tpl.startsWith('{{', j)) j++
    const chunk = tpl.slice(i, j)
    // 逐字符：裸字符 → Icon；其他 emoji 残留 → 保留并按 icon-only 记日志
    let res = ''
    let k = 0
    while (k < chunk.length) {
      const o = chunk.codePointAt(k)
      const ch = String.fromCodePoint(o)
      if (isVS(ch)) { k += o > 0xffff ? 2 : 1; continue }
      if (!isEmoji(ch)) { res += ch; k += o > 0xffff ? 2 : 1; continue }
      const mapped = CH_UNMAPPED[ch]
      if (mapped) {
        res += `<Icon name="${mapped}" :size="13"/>`
      } else {
        res += ch // 保留但记录
        manualHits.push(`UNK_EMOJI ${JSON.stringify(ch)} @ ${path.relative(ROOT, curFile)}`)
      }
      k += o > 0xffff ? 2 : 1
    }
    out += res
    i = j
  }
  return out
}

const files = []
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (ent.name.endsWith('.vue')) files.push(p)
  }
}
walk(ROOT)

const manualHits = []
let changedFiles = 0
for (const f of files) {
  curFile = f
  const src = fs.readFileSync(f, 'utf8')
  let out = src

  const tplMatch = src.match(/<template>([\s\S]*)<\/template>/)
  if (tplMatch) {
    const newTpl = processTemplate(tplMatch[1])
    if (newTpl !== tplMatch[1]) out = out.replace(tplMatch[1], newTpl)
  }

  const scriptMatch = src.match(/<script[^>]*>([\s\S]*)<\/script>/)
  if (scriptMatch) {
    const newScript = processScript(scriptMatch[1])
    if (newScript !== scriptMatch[1]) out = out.replace(scriptMatch[1], newScript)
  }

  if (out !== src) {
    fs.writeFileSync(f, out, 'utf8')
    changedFiles++
  }
}

fs.writeFileSync(MANUAL2, manualHits.join('\n') || '(无残留)', 'utf8')
console.log(`第二轮修复：${changedFiles} 个文件变更；残留清单：${MANUAL2}`)