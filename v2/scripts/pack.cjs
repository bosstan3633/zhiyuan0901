#!/usr/bin/env node
/**
 * pack.cjs —— 发布包生成器（R112 固化）
 *
 * 背景：发布包体积的最大浪费是 **source map**。dist 产出约 5.5M / 73 文件，其中 25 个 *.map
 * 占 4.0M（约 73%）；剥离后生产包仅 1.6M / 48 文件。历史上桌面交付包曾直接拷贝整个 dist，
 * 等于白送用户 4M。本脚本把「剥离 map → 输出解压目录 → 输出 ZIP」固化为一步。
 *
 * 用法：
 *   node scripts/pack.cjs                 # 输出到 <桌面>/知源调度台_V<version>（+ 同名 .zip）
 *   node scripts/pack.cjs --out=<dir>     # 指定输出父目录
 *   node scripts/pack.cjs --no-zip        # 只出解压目录
 *
 * 体积预算（见 文档中心/06_测试与发布/06-2 发布验收清单 §G）：
 *   生产包 ≤ 2M · ZIP ≤ 600KB（R154 曾上调 660KB；R160 压回——拼音字典退役后实测 576,655 B）· 单文件 ≤ 400KB · **禁止把 *.map 打进发布包**
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

// ---------- 参数 ----------
const args = process.argv.slice(2)
const outArg = args.find(a => a.startsWith('--out='))
const noZip = args.includes('--no-zip')

// ---------- 读取版本 ----------
if (!fs.existsSync(DIST)) { console.error('✗ 找不到 dist —— 请先 npm run build'); process.exit(1) }
let manifest
try {
  manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'))
} catch {
  console.error('✗ 无法读取 dist/manifest.json —— 请先 npm run build'); process.exit(1)
}
const version = manifest.version
if (!version) { console.error('✗ dist/manifest.json 缺少 version 字段'); process.exit(1) }

const desktop = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, 'Desktop')
  : path.join(process.env.HOME || '.', 'Desktop')
const outParent = outArg ? outArg.slice('--out='.length) : desktop
const pkgName = `知源调度台_V${version}`
const outDir = path.join(outParent, pkgName)
const zipPath = path.join(outParent, `${pkgName}.zip`)

// ---------- 收集文件（剥离 map） ----------
function walk(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, base, acc)
    else acc.push(full)
  }
  return acc
}
const all = walk(DIST)
const kept = all.filter(f => !f.endsWith('.map'))
const dropped = all.length - kept.length

// ---------- 输出解压目录 ----------
fs.rmSync(outDir, { recursive: true, force: true })
for (const f of kept) {
  const rel = path.relative(DIST, f)
  const dest = path.join(outDir, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(f, dest)
}

// ---------- 生成 ZIP（deflate，Node 内置实现，不依赖 zip 命令） ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

let zipBytes = 0
if (!noZip) {
  const now = new Date()
  const { time, date } = dosTime(now)
  const locals = []
  const centrals = []
  let offset = 0

  for (const f of kept) {
    const rel = path.relative(DIST, f).split(path.sep).join('/')
    const nameBuf = Buffer.from(rel, 'utf8')
    const raw = fs.readFileSync(f)
    const comp = zlib.deflateRawSync(raw, { level: 9 })
    const sum = crc32(raw)

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)          // version needed
    lh.writeUInt16LE(0x0800, 6)      // flag: UTF-8 文件名
    lh.writeUInt16LE(8, 8)           // method: deflate
    lh.writeUInt16LE(time, 10)
    lh.writeUInt16LE(date, 12)
    lh.writeUInt32LE(sum, 14)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(raw.length, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)
    locals.push(lh, nameBuf, comp)

    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)          // version made by
    ch.writeUInt16LE(20, 6)          // version needed
    ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt16LE(8, 10)
    ch.writeUInt16LE(time, 12)
    ch.writeUInt16LE(date, 14)
    ch.writeUInt32LE(sum, 16)
    ch.writeUInt32LE(comp.length, 20)
    ch.writeUInt32LE(raw.length, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)          // extra
    ch.writeUInt16LE(0, 32)          // comment
    ch.writeUInt16LE(0, 34)          // disk
    ch.writeUInt16LE(0, 36)          // internal attrs
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38) // external attrs（普通文件 644）
    ch.writeUInt32LE(offset, 42)
    centrals.push(ch, nameBuf)

    offset += lh.length + nameBuf.length + comp.length
  }

  const centralStart = offset
  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(kept.length, 8)
  eocd.writeUInt16LE(kept.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(centralStart, 16)
  eocd.writeUInt16LE(0, 20)

  const zipBuf = Buffer.concat([Buffer.concat(locals), centralBuf, eocd])
  fs.rmSync(zipPath, { force: true })
  fs.writeFileSync(zipPath, zipBuf)
  zipBytes = zipBuf.length
}

// ---------- 报告 ----------
const sizeOf = p => walk(p).reduce((s, f) => s + fs.statSync(f).size, 0)
const fmt = n => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1024 / 1024).toFixed(1)}M`
const pkgBytes = sizeOf(outDir)
const rawBytes = kept.reduce((s, f) => s + fs.statSync(f).size, 0)

console.log('══════ 发布包 ══════')
console.log(`  版本        V${version}（${manifest.name}）`)
console.log(`  解压目录    ${outDir}`)
console.log(`              ${kept.length} 文件 · ${fmt(pkgBytes)}`)
if (!noZip) {
  console.log(`  ZIP         ${zipPath}`)
  console.log(`              ${fmt(zipBytes)} · 压缩率 ${(100 - zipBytes / rawBytes * 100).toFixed(0)}%`)
}
console.log(`  已剥离 map  ${dropped} 个（约 ${fmt(all.reduce((s, f) => s + (f.endsWith('.map') ? fs.statSync(f).size : 0), 0))}）`)
console.log('')
console.log('  体积预算（06-2 §G）：生产包 ≤2M · ZIP ≤600KB · 单文件 ≤400KB')

// ---------- 预算校验（超限只告警不中断，避免挡住发版） ----------
const biggest = kept.reduce((m, f) => Math.max(m, fs.statSync(f).size), 0)
const warn = []
if (pkgBytes > 2 * 1024 * 1024) warn.push(`生产包 ${fmt(pkgBytes)} 超 2M`)
if (!noZip && zipBytes > 600 * 1024) warn.push(`ZIP ${fmt(zipBytes)} 超 600KB`)
if (biggest > 400 * 1024) warn.push(`单文件最大 ${fmt(biggest)} 超 400KB`)
if (kept.some(f => f.endsWith('.map'))) warn.push('包内仍含 *.map')
if (warn.length) console.log('  ⚠ 预算告警：' + warn.join('；'))
else console.log('  ✓ 预算达标')
