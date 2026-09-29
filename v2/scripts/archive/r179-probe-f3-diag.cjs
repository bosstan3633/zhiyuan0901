/**
 * R179 诊断探针（一次性 · 归档）：Alt+3 首跑红（F-3c）根因隔离
 *
 * 背景：V3.7.0 首轮 probe-f 报 F-3c 红（Alt+3 期望落 `/workspace/*`，实测停在 `/compass`）。
 * 本探针在**真实交付包**上分场景复测 Alt+3，并同时打印：所在页 · 按键后 hash · toast 文案 ·
 * 库内 workspaces（id|name|archived|order）+ document.activeElement —— 用来区分三种可能：
 *   ① 键位没生效（handler 不触发）② 键位生效但无台可落（设计提示）③ 台存在但路由不对。
 *
 * 结论（2026-09-29 实跑）：**②**。空档口经 R64 合台（`migrateHubMerge` 把默认策展台并入资源台并删实体）
 * 后，库内只剩资源台实体 `zy-curation|资源台|archived=false|order=-1`，前台策展台列表为 0
 * ⇒ `switchToIndex(3)` 走 `store.workspaces[0]` 落空分支，弹「没有第 3 号台（当前共 0 个策展台）」、不跳转。
 * 与所在页无关（/settings · / · /compass 三处同现）。⇒ 探针夹具缺口（缺「先种一台」），非产品缺陷；
 * 已在 `probe-f.cjs` F-3 段补种「探针台」后 7/0 复绿。
 *
 * 用法：node scripts/archive/r179-probe-f3-diag.cjs [包目录]   # 缺省取桌面最新 知源调度台_V*
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

function defaultPkg() {
  const desktop = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop')
  try {
    const cands = fs.readdirSync(desktop)
      .filter(n => /^知源调度台_V[\d.]+$/.test(n) && fs.existsSync(path.join(desktop, n, 'manifest.json')))
      .map(n => ({ n, t: fs.statSync(path.join(desktop, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    if (cands.length) return path.join(desktop, cands[0].n)
  } catch { /* 桌面不可读 */ }
  return path.join(__dirname, '..', '..', 'dist')
}
const PKG = path.resolve(process.argv[2] || defaultPkg())

const CACHE = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
let CHROME = ''
try {
  for (const hit of fs.readdirSync(CACHE).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const p = path.join(CACHE, hit, 'chrome-win64', 'chrome.exe')
    if (fs.existsSync(p)) { CHROME = p; break }
  }
} catch { /* 无缓存 */ }
console.log('包：' + PKG + '\n浏览器：' + CHROME)

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${PKG}`, `--load-extension=${PKG}`]
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/src/newtab/index.html`

  const dump = async (tag) => {
    const info = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
      const d = cur['zy_data_v2'] || {}
      return {
        ws: (d.workspaces || []).map(w => `${w.id}|${w.name}|archived=${w.archived}|order=${w.order}`),
        active: document.activeElement ? (document.activeElement.tagName + (document.activeElement.className ? '.' + String(document.activeElement.className).slice(0, 30) : '')) : 'null'
      }
    }))
    console.log(`[${tag}] active=${info.active}\n        ws=${JSON.stringify(info.ws)}`)
  }
  const press = async (code, note) => {
    await page.evaluate(() => window.focus())
    await page.keyboard.down('Alt')
    await page.keyboard.press(code)
    await page.keyboard.up('Alt')
    await page.waitForTimeout(1200)
    const hash = page.url().split('#')[1] || '(无)'
    const toast = await page.evaluate(() => Array.from(document.querySelectorAll('[class*="toast"]')).map(e => e.textContent || '').join(' | ').slice(0, 120)).catch(() => '')
    console.log(`  ▶ ${note} ${code} → hash=${hash}${toast ? ' · toast=' + toast : ''}`)
  }

  const page = await ctx.newPage()
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await dump('boot')
  await press('Digit3', '在 /settings 按')
  await press('Digit3', '再按一次')
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  await press('Digit3', '在 / 按')
  await page.goto(base + '#/compass', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  await press('Digit3', '在 /compass 按')
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  await press('Digit2', '（对照）Alt+2')
  await press('Digit3', '紧跟 Alt+2 后 Alt+3')

  await ctx.close()
}
main().catch(e => { console.error(e); process.exit(2) })
