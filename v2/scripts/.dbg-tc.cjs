/* 独立复现：应用内任务采集保存链路（用后即删） */
const path = require('path')
const { chromium } = require('playwright-core')
const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(process.cwd(), 'dist')
;(async () => {
  const ctx = await chromium.launchPersistentContext('', { headless: true, executablePath: CHROME, ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`] })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host
  const page = await ctx.newPage()
  const base = `chrome-extension://${extId}/src/newtab/index.html`
  const errs = []
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)) })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'zy-open-task-capture' }))
  await page.waitForTimeout(800)
  const st1 = await page.evaluate(() => ({
    overlay: !!document.querySelector('.gp-overlay'),
    open: [...document.querySelectorAll('.gp-overlay')].some(o => o.classList.contains('open')),
    btns: [...document.querySelectorAll('.gp-btn-primary')].map(b => b.textContent)
  }))
  console.log('state1=', JSON.stringify(st1))
  await page.getByPlaceholder('要做什么（可留空）').fill('DBG 任务')
  // 直接用 evaluate 点按钮（排除 Playwright 命中问题）
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.gp-btn-primary')].find(b => b.textContent.includes('保存任务'))
    if (!btn) return 'no-btn'
    btn.click()
    return 'clicked'
  })
  await page.waitForTimeout(800)
  const st2 = await page.evaluate(() => ({
    savedText: [...document.querySelectorAll('.gp-saved-title')].map(x => x.textContent),
    modalOpen: [...document.querySelectorAll('.gp-overlay')].some(o => o.classList.contains('open')),
    taskIn: null
  }))
  const inDb = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => (r['zy_data_v2'].tasks || []).some(t => t.title === 'DBG 任务' || t.title === '快速任务')))
  console.log('clicked=', clicked, ' state2=', JSON.stringify(st2), ' inDb=', inDb)
  console.log('errs=', JSON.stringify(errs))
  await ctx.close()
})().catch(e => { console.error(e); process.exit(1) })
