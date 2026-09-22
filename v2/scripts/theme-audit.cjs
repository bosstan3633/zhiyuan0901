/**
 * 视觉归档走查 · theme-audit（R155 新建）
 *
 * 为什么有它：R155~R161 是视觉/交互改造轮，"改动前 vs 改动后必须逐屏可辨"是本系列唯一
 *   能自证的手段。原 04-63 任务书引用的 `theme-audit.cjs` 当时并不存在（2026-09-22 勘误），
 *   本条即补齐该工具。
 *
 * 做什么：加载扩展 → 注入真实库数据 → 对 **四主题 × 四个台面** 出 16 张首屏图，归档到
 *   `docs/视觉归档/<tag>/`，供逐屏对照。
 *
 * 用法：
 *   node scripts/theme-audit.cjs                       # 用 dist + 默认真实数据 + 默认 tag
 *   node scripts/theme-audit.cjs --tag=R155-before      # 指定归档标签
 *   node scripts/theme-audit.cjs --data=<backup.json>   # 指定数据源（默认取 Downloads 下最新 zhiyuan_backup_*.json）
 *   node scripts/theme-audit.cjs --pkg=<解压包目录>      # 直接测"交付物"而非 dist
 *   node scripts/theme-audit.cjs --only=linear,apple    # 只跑部分主题
 *
 * 与 e2e.cjs 同法：playwright-core + 本机 ms-playwright Chromium + headless + --load-extension。
 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const { chromium } = require('playwright-core')

const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const EXT_INDEX = 'src/newtab/index.html'
const ROOT = path.resolve(__dirname, '..', '..')

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
  return m ? [m[1], m[2] ?? true] : [a, true]
}))

const THEMES = ['linear', 'raycast', 'apple', 'notion']
const VIEWS = [
  { id: 'dashboard', hash: '#/', name: '调度台' },
  { id: 'compass', hash: '#/compass', name: '方向台' },
  { id: 'resource', hash: '#/workspace/zy-curation', name: '资源台' },
  { id: 'settings', hash: '#/settings', name: '设置页' }
]

const VIEWPORT = { width: 1440, height: 900 }

function pickData() {
  if (argv.data) return path.resolve(String(argv.data))
  const dl = path.join(os.homedir(), 'Downloads')
  const hits = fs.readdirSync(dl).filter(f => /^zhiyuan_backup_.*\.json$/.test(f)).sort()
  if (!hits.length) throw new Error('未找到备份数据；请用 --data=<path> 指定')
  return path.join(dl, hits[hits.length - 1])
}

async function main() {
  const dataFile = pickData()
  const pkg = argv.pkg ? path.resolve(String(argv.pkg)) : path.resolve(__dirname, '..', 'dist')
  const tag = String(argv.tag || new Date().toISOString().slice(0, 10))
  const outDir = path.resolve(ROOT, 'docs', '视觉归档', tag)
  const themes = argv.only ? String(argv.only).split(',') : THEMES

  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  if (!fs.existsSync(path.join(pkg, 'manifest.json'))) throw new Error('目标不是有效扩展包：' + pkg)
  fs.mkdirSync(outDir, { recursive: true })

  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const data = raw.zy_data_v2 || raw
  const alive = (data.resources || []).filter(r => !r.deletedAt).length
  console.log(`数据源：${path.basename(dataFile)}（资源 ${(data.resources || []).length} / 活 ${alive} · 分类 ${(data.categories || []).length} · 策展台 ${(data.workspaces || []).length}）`)
  console.log(`扩展包：${pkg}`)
  console.log(`归档到：${outDir}`)

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${pkg}`, `--load-extension=${pkg}`, `--hide-scrollbars`]
  })

  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)

  // 首次进入让扩展完成初始化（否则随后注入会被 createDefaultData 覆盖）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const ui = { ...(data.uiPrefs || {}) }
  await page.evaluate(async ({ d, u }) => {
    await chrome.storage.local.set({ zy_data_v2: d, zy_ui_v2: u })
  }, { d: data, u: ui })
  await page.waitForTimeout(400)

  const shots = []
  for (const theme of themes) {
    // 切主题：直接改 <html data-theme> —— tokens.css 的四套主题全部以该属性为选择器，
    //   改属性即时生效。**不用整页重载**：2026-09-22 实测 reload 会丢掉 URL hash，
    //   导致同主题内 4 张图全部截到 `#/`（首版 16 图里 9 张 md5 重复即此坑）。
    //   同时写回 storage 保持一致，防路由切换时被 store 覆盖回旧值。
    const okTheme = await page.evaluate(async (t) => {
      const cur = (await chrome.storage.local.get('zy_ui_v2'))['zy_ui_v2'] || {}
      cur.theme = t
      await chrome.storage.local.set({ zy_ui_v2: cur })
      document.documentElement.dataset.theme = t
      return document.documentElement.dataset.theme
    }, theme)
    for (const v of VIEWS) {
      await page.goto(base + v.hash, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2300)
      const hash = await page.evaluate(() => location.hash)
      const file = path.join(outDir, `${theme}-${v.id}.png`)
      await page.screenshot({ path: file })
      const kb = Math.round(fs.statSync(file).size / 1024)
      shots.push(file)
      console.log(`  ✓ ${theme.padEnd(8)} ${v.name.padEnd(4)} hash=${(hash || '#/').padEnd(26)} → ${path.basename(file)} (${kb}KB)`)
    }
    console.log(`  主题 ${theme} 落盘（data-theme=${okTheme}）`)
  }

  await ctx.close()
  console.log(`\ntheme-audit 完成：${shots.length} 图 → ${outDir}`)
  if (shots.length !== themes.length * VIEWS.length) process.exit(1)
}
main().catch(e => { console.error('theme-audit 失败：', e); process.exit(2) })
