#!/usr/bin/env node
/**
 * G1：emoji → Icon 系统迁移脚本（2026-10-16，第二轮修复版）
 *
 * 处理范围：v2/src/ 目录下全部 .vue 文件
 * - template 段：文本节点 emoji → Icon 组件；属性值/插值内 emoji 剥离（保留逻辑字符串）；
 *   注释与 kbd 内容原样保留；版式几何符号保留；箭头类符号按文本替换。
 * - script 段：仅剥离字符串字面量中的 emoji（toast / badge / label 文案），
 *   注释与 wsIcons 用户数据白名单原样保留。
 * - 自动注入 import Icon（模板新增 Icon 且 script 尚未引入时）。
 *
 * 关键修复（相对 V1）：
 *  1) 全部 emoji 遍历走 codePoint + 完整序列（含 VS16 与 ZWJ 组合），避免代理对拆半、ZWJ 序列拆散；
 *  2) 模板文本节点未映射 emoji：写回原文并记 UNMAPPED_TEXT 手工清单，不再删除；
 *  3) wsIcons 用户数据白名单行原样保留。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src')
const MANUAL = '/tmp/emoji_manual.txt'

// ---------- emoji 判定 ----------
const RANGES = [
  [0x1f000, 0x1faff], [0x2600, 0x27bf], [0x2190, 0x21ff],
  [0x2b00, 0x2bff], [0xfe00, 0xfe0f], [0x1f1e6, 0x1f1ff],
]
function isEmojiCode(o) {
  return RANGES.some(([a, b]) => a <= o && o <= b)
}
function isEmoji(ch) {
  return isEmojiCode(ch.codePointAt(0))
}

// 从 code point 索引 start 起抓取完整 emoji 序列（含 VS15/VS16 与 ZWJ 组合），返回序列文本与结束索引
function grabSeq(str, start) {
  let j = start
  let whole = ''
  let expectEmoji = false
  const o0 = str.codePointAt(j)
  if (o0 === undefined) return { whole, end: j }
  whole += String.fromCodePoint(o0)
  j += o0 > 0xffff ? 2 : 1
  for (;;) {
    const o = str.codePointAt(j)
    if (o === undefined) break
    if (o === 0xfe0f || o === 0xfe0e) { whole += String.fromCodePoint(o); j++; continue }
    if (o === 0x200d) { whole += String.fromCodePoint(o); j++; expectEmoji = true; continue }
    if (expectEmoji && isEmojiCode(o)) {
      whole += String.fromCodePoint(o)
      j += o > 0xffff ? 2 : 1
      expectEmoji = false
      continue
    }
    break
  }
  return { whole, end: j }
}

// ---------- 版式几何符号（保留） ----------
const GEOM_KEEP = new Set(['▸', '▾', '▴', '◐', '○', '●', '◎', '◈', '▦', '▤', '⏎', '⌘', '⌨', '⛶', '↑', '↓', '←', '…', '›', '➜', '☆', '☐'])
const GEOM_CP = new Set([...GEOM_KEEP].map((s) => s.codePointAt(0)))

// 剥离判定：真 emoji 才剥（验收 grep 范围 1F000-1FAFF / 2600-27BF 等）；
// 2190-21FF 箭头区与 GEOM_KEEP 几何符号一律保留（箭头在 UI 上语义需要，且不在验收 grep 范围）
function isStripEmoji(o) {
  if (!isEmojiCode(o)) return false
  if (o >= 0x2190 && o <= 0x21ff) return false
  if (GEOM_CP.has(o)) return false
  return true
}

// ---------- 文本替换 ----------
const TEXT_REPLACE = { '→': '›', '⇒': '，', '↔': '与' }

// ---------- emoji → Icon name ----------
const ICON_MAP = {
  '🚀': 'main-focus', '⚠': 'warn', '🧭': 'compass', '🧠': 'brain', '💡': 'bulb',
  '🔍': 'search', '🗑': 'trash', '📦': 'package', '📌': 'pin', '🎯': 'target',
  '⭐': 'star', '🔗': 'link', '📁': 'folder', '📂': 'folderopen', '📋': 'filetext',
  '📖': 'book', '📄': 'filetext', '📊': 'barchart', '📅': 'calendar', '🗓': 'calendar',
  '🕘': 'clock', '🕓': 'clock', '🕐': 'clock', '⏰': 'clock', '⏳': 'clock', '⏱': 'clock',
  '🖥': 'monitor', '📡': 'satellite', '🖼': 'image', '📕': 'book', '🧾': 'receipt',
  '🩺': 'stethoscope', '🧬': 'dna', '🔥': 'flame', '🧊': 'snowflake', '🤖': 'bot',
  '🧹': 'broom', '👁': 'eye', '🗂': 'folder', '🏛': 'landmark', '🏷': 'tag',
  '💾': 'save', '⚡': 'zap', '🛡': 'shield', '🌐': 'globe', '⬇': 'download',
  '⬆': 'upload', '↗': 'external', '↻': 'refresh', '🔄': 'refresh', '⇄': 'refresh',
  '↺': 'rotateccw', '↕': 'arrowupdown', '⇅': 'arrowupdown', '↳': 'corner', '↩': 'arrowleft',
  '✎': 'edit', '✏️': 'edit', '✏': 'edit', '✍️': 'edit', '✍': 'edit', '✕': 'x', '✗': 'x', '✅': 'check',
  '✓': 'check', '➕': 'plus', '🆕': 'squareplus', '🪄': 'wand', '🪹': 'inbox',
  '🪞': 'mirror', '🔀': 'shuffle', '⚙': 'settings', '📥': 'inbox', '🗺': 'map',
  '♻': 'refresh', '📝': 'filetext',
  // G1 收尾补充映射（第二轮 UNMAPPED 补全）
  '🎉': 'star', '📈': 'trendup', '📉': 'trenddown', '📐': 'ruler', '📎': 'paperclip',
  '🚨': 'alert', '📇': 'contact', '🔌': 'plug', '🙋': 'contact', '🧑🏫': 'school', '🧑': 'user',
  '🔖': 'bookmark', '🛠': 'wrench', '🎛': 'sliders', '🌳': 'tree', '🔭': 'telescope',
  '🎨': 'palette', '🔣': 'symbol', '📍': 'mappin', '🧩': 'puzzle', '🌿': 'tree',
  // G1 预扫描补全（模板文本节点可见的裸符号）
  '✦': 'sparkle', '☑': 'checksquare', '⇪': 'upload', '✨': 'sparkles',
  '☰': 'menu', '⬡': 'hexagon', '✉': 'mail', '↵': 'arrowleft',
}

// 特殊：🔴🟡🟢 文本节点 → dot + 语义 class（替换通用模板）
const DOT_TMPL = {
  '🔴': '<Icon name="dot" :size="9" class="zy-dot zy-dot-hi"/>',
  '🟡': '<Icon name="dot" :size="9" class="zy-dot zy-dot-mi"/>',
  '🟢': '<Icon name="dot" :size="9" class="zy-dot zy-dot-lo"/>',
}

// ---------- 工具 ----------
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith('.vue')) acc.push(p)
  }
  return acc
}

// ---------- 模板段处理 ----------
function processTemplate(tpl) {
  let out = ''
  const manual = []
  let i = 0
  const n = tpl.length

  function flushTextChunk(chunk) {
    // 逐 code point 处理文本节点；emoji 按完整序列（VS/ZWJ）统一处理
    let res = ''
    let j = 0
    while (j < chunk.length) {
      const o = chunk.codePointAt(j)
      const ch = String.fromCodePoint(o)
      if (o === 0xfe0f || o === 0xfe0e) { j++; continue }
      if (!isEmojiCode(o)) { res += ch; j += o > 0xffff ? 2 : 1; continue }
      const seq = grabSeq(chunk, j)
      const seqCh = seq.whole
      if (GEOM_KEEP.has(ch) || GEOM_KEEP.has(seqCh)) { res += seqCh; j = seq.end; continue }
      if (TEXT_REPLACE[ch]) { res += TEXT_REPLACE[ch]; j = seq.end; continue }
      if (DOT_TMPL[ch]) { res += DOT_TMPL[ch]; j = seq.end; continue }
      const mapped = ICON_MAP[seqCh] || ICON_MAP[ch]
      if (mapped) {
        res += `<Icon name="${mapped}" :size="13"/>`
        j = seq.end
        continue
      }
      // 未映射：写回原文（不删除），记人工清单
      res += seqCh
      manual.push(`UNMAPPED_TEXT ${JSON.stringify(seqCh)} in text node`)
      j = seq.end
    }
    return res
  }

  function flushAttrString(str) {
    // 属性字符串内：剥离真 emoji（保留逻辑字符串），组合变体与 ZWJ 序列整体跳过，箭头/几何保留
    let res = ''
    let k = 0
    while (k < str.length) {
      const o = str.codePointAt(k)
      if (o === undefined) break
      const c = String.fromCodePoint(o)
      if (o === 0xfe0f || o === 0xfe0e) { k++; continue }
      if (isStripEmoji(o)) { k = grabSeq(str, k).end; continue }
      res += c
      k += o > 0xffff ? 2 : 1
    }
    return res
  }

  function flushMustache(str) {
    // 插值内：剥离真 emoji，保留其余（含引号与逻辑与箭头）
    let res = ''
    let hadEmoji = false
    let k = 0
    while (k < str.length) {
      const o = str.codePointAt(k)
      if (o === undefined) break
      const c = String.fromCodePoint(o)
      if (o === 0xfe0f || o === 0xfe0e) { k++; continue }
      if (isStripEmoji(o)) { hadEmoji = true; k = grabSeq(str, k).end; continue }
      res += c
      k += o > 0xffff ? 2 : 1
    }
    return { res, hadEmoji }
  }

  while (i < n) {
    // HTML 注释：原样保留
    if (tpl.startsWith('<!--', i)) {
      const end = tpl.indexOf('-->', i + 4)
      if (end === -1) { out += tpl.slice(i); break }
      out += tpl.slice(i, end + 3)
      i = end + 3
      continue
    }
    // kbd 内容：原样保留
    if (tpl.startsWith('<kbd', i) && /^<kbd[ >]/.test(tpl.slice(i, i + 6))) {
      const end = tpl.indexOf('</kbd>', i)
      if (end !== -1) {
        out += tpl.slice(i, end + 6)
        i = end + 6
        continue
      }
    }
    // 标签开始：复制标签，属性字符串内剥离 emoji
    if (tpl[i] === '<') {
      let j = i + 1
      let tag = '<'
      let quote = null
      while (j < n) {
        const co = tpl.codePointAt(j)
        if (co === undefined) { tag += tpl.slice(j); j = n; break }
        const ch = String.fromCodePoint(co)
        if (quote) {
          if (ch === quote) { quote = null; tag += ch; j++; continue }
          if (isStripEmoji(co)) {
            j = grabSeq(tpl, j).end
            continue
          }
          tag += ch
          j += co > 0xffff ? 2 : 1
          continue
        }
        if (ch === '"' || ch === "'") { quote = ch; tag += ch; j++; continue }
        if (ch === '>') { tag += ch; j++; break }
        tag += ch
        j += co > 0xffff ? 2 : 1
      }
      out += tag
      i = j
      continue
    }
    // 插值
    if (tpl.startsWith('{{', i)) {
      const end = tpl.indexOf('}}', i + 2)
      const raw = end === -1 ? tpl.slice(i) : tpl.slice(i, end + 2)
      const { res, hadEmoji } = flushMustache(raw)
      out += res
      if (hadEmoji) {
        const stripped = raw.replace(/[\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '')
        if (stripped.includes("''") || stripped.includes('""') || /:\s*''\s*:/.test(stripped) || /\|\|\s*''\s*$/.test(stripped)) {
          manual.push(`MUSTACHE-ICON-ONLY ${raw.trim()}`)
        }
      }
      i = end === -1 ? n : end + 2
      continue
    }
    // 普通文本节点
    let j = i
    while (j < n && tpl[j] !== '<' && !tpl.startsWith('{{', j)) j++
    const chunk = tpl.slice(i, j)
    out += flushTextChunk(chunk)
    i = j
  }
  return { tpl: out, changed: out !== tpl, manual }
}

// ---------- script 段处理（字符串剥离） ----------
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
    // wsIcons 用户数据白名单：emoji 原样保留（用户自定义工作区图标）
    if (line.includes('wsIcons')) {
      out.push(line)
      continue
    }
    // 行内块注释起点
    if (trimmed.includes('/*')) {
      const idx = line.indexOf('/*')
      const pre = line.slice(0, idx)
      const post = line.slice(idx)
      let processed = processStringEmoji(pre)
      processed += post
      if (!post.includes('*/')) inBlock = true
      out.push(processed)
      continue
    }
    out.push(processStringEmoji(line))
  }
  return out.join('\n')
}

function processStringEmoji(line) {
  // 扫描字符串字面量（单双反引号），内部 emoji 整体剥离；注释已在外层跳过
  let res = ''
  let i = 0
  const n = line.length
  while (i < n) {
    const o = line.codePointAt(i)
    const ch = String.fromCodePoint(o)
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch
      let j = i + 1
      let str = q
      while (j < n) {
        const co = line.codePointAt(j)
        const c = String.fromCodePoint(co)
        if (c === '\\') { str += c + (line[j + 1] || ''); j += 2; continue }
        if (c === q) { str += c; j++; break }
        if (isStripEmoji(co)) {
          j = grabSeq(line, j).end
          continue
        }
        str += c
        j += co > 0xffff ? 2 : 1
      }
      res += str
      i = j
      continue
    }
    res += ch
    i += o > 0xffff ? 2 : 1
  }
  return res
}

// ---------- import 注入 ----------
function ensureIconImport(fullSrc, tplChanged, newTpl) {
  if (!tplChanged) return false
  if (!newTpl.includes('<Icon')) return false
  if (fullSrc.includes("components/Icon.vue")) return false
  const m = fullSrc.match(/^\s*import [^\n]*\n/m)
  if (!m) return false
  const idx = fullSrc.indexOf(m[0])
  const out = fullSrc.slice(0, idx) + `import Icon from '@/shared/components/Icon.vue'\n` + fullSrc.slice(idx)
  return out
}

// ---------- 主流程 ----------
const files = walk(ROOT)
const manualLines = []
let changedFiles = 0
let totalEmojiRemoved = 0

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const tplMatch = src.match(/<template>([\s\S]*)<\/template>/)
  if (!tplMatch) continue
  const { tpl, changed, manual } = processTemplate(tplMatch[1])
  if (manual.length) manualLines.push(`===== ${path.relative(ROOT, f)} =====`, ...manual)

  const scriptMatch = src.match(/<script[^>]*>([\s\S]*)<\/script>/)
  let scriptBody = scriptMatch ? scriptMatch[1] : null
  let scriptNew = null
  if (scriptBody) {
    scriptNew = processScript(scriptBody)
    if (scriptNew === scriptBody) scriptNew = null
  }

  if (!changed && !scriptNew) continue

  let out = src
  if (changed) out = out.replace(tplMatch[1], tpl)
  if (scriptNew && scriptMatch) out = out.replace(scriptMatch[1], scriptNew)

  const injected = ensureIconImport(out, changed, tpl)
  if (typeof injected === 'string') out = injected

  fs.writeFileSync(f, out, 'utf8')
  changedFiles++
  totalEmojiRemoved += (src.match(/[\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu) || []).length -
    (out.match(/[\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu) || []).length
}

fs.writeFileSync(MANUAL, manualLines.join('\n') || '(无手工项)', 'utf8')
console.log(`处理完成：${changedFiles} 个文件有变更；预计移除 emoji 字符 ${totalEmojiRemoved} 个`)
console.log(`手工清单：${MANUAL}`)