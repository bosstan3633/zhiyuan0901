/**
 * R48 排查脚本：复现「Cannot access 'J' before initialization」
 * 加载 dist 扩展 → 注入用户真实导入数据（zhiyuan_backup_2026-09-04.json）→ 打开新标签页 → 抓控制台错误与错误横幅
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
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
  console.log('extId:', extId)

  const errors = []
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 500)) })
  page.on('pageerror', e => errors.push('[pageerror] ' + String(e && e.stack || e).slice(0, 900)))

  const base = `chrome-extension://${extId}/src/newtab/index.html`
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // 注入用户导入数据
  const data = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8'))
  await page.evaluate(async (d) => {
    await chrome.storage.local.set({ zy_data_v2: d })
    // 同步写一份缓存镜像（若仓库用内存 cache + 双写）——先只写主键，观察
  }, data)
  console.log('数据已注入: resources=' + data.resources.length + ' tasks=' + data.tasks.length)

  // 重载新标签页，观察渲染
  await page.goto(base + '?hl=cz_tjrlmeu', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const banner = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      hasRenderError: t.includes('页面渲染出错'),
      errMsg: (t.match(/Cannot[^\n]*/) || [''])[0],
      appChildren: (document.querySelector('#app') || {}).childElementCount ?? -1,
      hasCompass: !!document.querySelector('.compass-home, [class*=home]')
    }
  })
  console.log('页面状态:', JSON.stringify(banner, null, 2))
  console.log('--- 错误收集 (' + errors.length + ') ---')
  errors.slice(0, 10).forEach(e => console.log(e))

  await ctx.close()
}
main().catch(e => { console.error('脚本失败:', e); process.exit(1) })
