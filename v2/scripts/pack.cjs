/**
 * R124：交付包打包脚本（桌面包 + zip）
 *
 * 规范（承接 R70 注释「用户安装包在打包时排除 *.map」）：
 *   - dist 内 *.map 为 hidden sourcemap（错误诊断用，仅本地/开发保留）
 *   - **交付包一律排除 *.map**——纯调试文件，运行期零作用，不进用户安装包
 *   - 同版本旧目录/旧 zip 自动清理；其他历史版本目录一并清除（只保留最新）
 *
 * 用法：node scripts/pack.cjs  （在 v2/ 目录下执行）
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const DIST = path.resolve(__dirname, '..', 'dist')
const DESK = path.join(os.homedir(), 'Desktop')

if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('❌ dist/manifest.json 不存在——先执行 npm run build')
  process.exit(1)
}
const version = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8')).version
const NAME = `知源调度台_V${version}`
const TARGET = path.join(DESK, NAME)

/** 递归拷贝（排除 *.map），返回 { files, bytes } */
function copyDir(src, dst) {
  let files = 0, bytes = 0, skipped = 0
  fs.mkdirSync(dst, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dst, name)
    const st = fs.statSync(s)
    if (st.isDirectory()) {
      const r = copyDir(s, d)
      files += r.files; bytes += r.bytes; skipped += r.skipped
    } else if (name.endsWith('.map')) {
      skipped++
    } else {
      fs.copyFileSync(s, d)
      files++; bytes += st.size
    }
  }
  return { files, bytes, skipped }
}

/** 清理桌面上的历史版本目录 / zip（保留当前版本） */
function cleanOld() {
  for (const name of fs.readdirSync(DESK)) {
    if (!name.startsWith('知源调度台_V')) continue
    const full = path.join(DESK, name)
    const isDir = fs.statSync(full).isDirectory()
    const base = isDir ? name : name.replace(/\.zip$/, '')
    if (base === NAME) continue
    fs.rmSync(full, { recursive: true, force: true })
    console.log('🧹 移除旧包: ' + name)
  }
}

if (fs.existsSync(TARGET)) fs.rmSync(TARGET, { recursive: true, force: true })
const { files, bytes, skipped } = copyDir(DIST, TARGET)
console.log(`📦 ${NAME}：${files} 个文件 / ${(bytes / 1048576).toFixed(2)} MB（排除 ${skipped} 个 .map）`)

const zip = TARGET + '.zip'
if (fs.existsSync(zip)) fs.rmSync(zip, { force: true })
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${TARGET}\\*' -DestinationPath '${zip}'"`, { stdio: 'inherit' })
const zipMB = (fs.statSync(zip).size / 1048576).toFixed(2)
console.log(`🗜 ${NAME}.zip：${zipMB} MB`)

cleanOld()
console.log('✅ 打包完成（运行期文件与 dist 一致，仅去调试用 .map；零性能影响）')
