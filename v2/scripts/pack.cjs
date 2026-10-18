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
 *   生产包 ≤ 2M · ZIP ≤ 900KB · 单文件 ≤ 400KB · **禁止把 *.map 打进发布包**
 *
 * ★V3.8.33（用户拍板 2026-10-18）：ZIP 预算 700KB → **900KB**。理由链同样要写清，否则下一轮又会被问「凭什么是 900」：
 *   ① **700KB 是被用完的，不是被优化的**。V3.8.25 上调时实测 687,229 B（余 29KB）；V3.8.32 是 694,942 B，
 *      余量只剩 4,902 B（约 0.7%）。七个版本（B0→B5-b 的 UI 规范落地）净增约 7.7KB。
 *   ② **剩余工作必然还要加**：41 项里还剩 18 项未开工（B6 项目详情与策展台、B7 收尾），每批都要新增或改写样式与组件。
 *      4.9KB 连一个版本的自然增长都覆盖不住，"按 700KB 走"等于每批都要重新拍一次板。
 *   ③ **900KB 不是随手一抬，是按既有速率折算的额度**：20 个版本累积 +78KB（≈3.9KB/版本），
 *      从 695KB 到 900KB 的 205KB 相当于 **50+ 个版本**的余量，足够走完 41 项并再撑一段常规迭代。
 *      反过来讲，**若 900KB 也被很快吃满，说明增长不是"内容累积"而是结构性膨胀** ——
 *      那时该查重复依赖与打包冗余，而不是继续抬数字。
 *   ④ **只放宽 ZIP 这一条，另两条不动**：生产包仍 ≤2M、单文件仍 ≤400KB。ZIP 是分发形态的度量（用户下载的那一份），
 *      不是运行时成本；放宽它不触碰任何性能口径，也不改「数据 100% 本机」的约束。
 *   ⑤ 历史沿革：R154 上调 660KB → R160 因拼音字典退役压回 600KB（实测 576,655 B）→ V3.8.25 上调 700KB → V3.8.33 上调 900KB。
 *      660KB 那次没写理由链，所以后来没人敢动它；700KB 与 900KB 都是把账算完再调。
 *
 * ★V3.8.25 的旧账（已被上面 900KB 取代，留作沿革证据，勿再引用为现行预算）：
 *   600KB 当时已不可达：V3.8.0 实测 608,791 B（余 6KB）；且"手册与更新日志外置懒加载"对 ZIP 是空操作
 *   （两者本就在懒 chunk，ZIP 装全部产物，代码分割只影响首屏）；连整个删掉也只省 45–50K，仍超 600K。
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
// R174-2 减重：.vite/ 构建元数据（29KB manifest.json）运行时零引用，随 map 一并剥出发布包
const viteDir = path.sep + '.vite' + path.sep
const kept = all.filter(f => !f.endsWith('.map') && !f.includes(viteDir))
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
console.log('  体积预算（06-2 §G）：生产包 ≤2M · ZIP ≤900KB（V3.8.33 由 700 上调，理由见文件头注释）· 单文件 ≤400KB')

// ---------- 预算校验（超限只告警不中断，避免挡住发版） ----------
const biggest = kept.reduce((m, f) => Math.max(m, fs.statSync(f).size), 0)
const warn = []
if (pkgBytes > 2 * 1024 * 1024) warn.push(`生产包 ${fmt(pkgBytes)} 超 2M`)
if (!noZip && zipBytes > 900 * 1024) warn.push(`ZIP ${fmt(zipBytes)} 超 900KB`)
if (biggest > 400 * 1024) warn.push(`单文件最大 ${fmt(biggest)} 超 400KB`)
if (kept.some(f => f.endsWith('.map'))) warn.push('包内仍含 *.map')
if (warn.length) console.log('  ⚠ 预算告警：' + warn.join('；'))
else console.log('  ✓ 预算达标')
