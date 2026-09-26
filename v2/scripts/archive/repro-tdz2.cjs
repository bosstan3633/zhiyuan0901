/**
 * R48 排查脚本 #2：会话级复现 —— 种入导入前状态 → UI 走导入 → 同会话导航首页 → 抓错误
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const BASE_FILE = 'C:/Users/dongdonglaoshi2026/Downloads/zhiyuan_auto_backup_before_import_2026-09-04.json'
const IMPORT_FILE = 'C:/Users/dongdonglaoshi2026/Downloads/zhiyuan_backup_2026-09-04.json'

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host

  const errors = []
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 600)) })
  page.on('pageerror', e => errors.push('[pageerror] ' + String(e && e.stack || e).slice(0, 1200)))

  const base = `chrome-extension://${extId}/src/newtab/index.html`
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // 1) 种入用户「导入前状态」
  const baseData = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'))
  await page.evaluate(d => chrome.storage.local.set({ zy_data_v2: d }), baseData)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // 2) 走设置页 UI 导入
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const input = page.locator('input[type="file"][accept=".json"]')
  await input.setInputFiles(IMPORT_FILE)
  await page.waitForTimeout(2500)
  const toast = await page.evaluate(() => (document.body.innerText.match(/导入[^\n]*/g) || []).slice(0, 3))
  console.log('导入 toast:', JSON.stringify(toast))

  // 3) 同会话导航回首页（不重载 → 与用户场景一致），带 hl 参数
  await page.goto(base + '?hl=cz_test123', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  // hash 路由场景再试一次
  await page.evaluate(() => { location.hash = '#/' })
  await page.waitForTimeout(2500)

  const state = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      hasRenderError: t.includes('页面渲染出错'),
      errMsg: (t.match(/Cannot[^\n]{0,80}/) || [''])[0],
      url: location.href.slice(0, 90),
      homeCards: document.querySelectorAll('[class*=card]').length
    }
  })
  console.log('页面状态:', JSON.stringify(state, null, 2))
  console.log('--- 错误收集 (' + errors.length + ') ---')
  errors.slice(0, 12).forEach(e => console.log(e))

  await ctx.close()
}
main().catch(e => { console.error('脚本失败:', e); process.exit(1) })
