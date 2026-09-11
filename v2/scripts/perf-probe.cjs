/**
 * 一次性启动时间线探针（R71 排障用，非持久脚本）
 * 每 100ms 采样一次 DOM/哈希状态，并记录关键资源的时间线，定位「mount 之后到视图出现」的 2.8s 真空。
 */
const path = require('path')
const { chromium } = require('playwright-core')
const CHROME = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
const DIST = path.resolve(__dirname, '..', 'vd')  // 占位，main 里覆盖

async function main() {
  const dist = path.resolve(__dirname, '..', 'dist')
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`]
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    window.__tl = []
    const t0 = performance.now()
    const push = (k) => window.__tl.push([k, Math.round(performance.now())])
    push('init')
    document.addEventListener('DOMContentLoaded', () => push('dcl'))
    window.addEventListener('load', () => push('load'))
    let lastHash = ''
    setInterval(() => { if (location.hash !== lastHash) { lastHash = location.hash; push('hash:' + location.hash) } }, 20)
    let sawVT = false, sawCI = false
    setInterval(() => {
      if (!sawVT && document.querySelector('.view-tab')) { sawVT = true; push('first .view-tab') }
      if (!sawCI && document.querySelector('.cat-item')) { sawCI = true; push('first .cat-item') }
      if (!window.__mount && document.querySelector('#app') && document.querySelector('#app').children.length) { window.__mount = true; push('app mounted') }
    }, 20)
    try {
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__tl.push(['longtask', Math.round(e.startTime), Math.round(e.duration)]) }).observe({ entryTypes: ['longtask'] })
    } catch (e) {}
  })
  await page.goto(`chrome-extension://${extId}/src/newtab/index.html#/curation`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  const tl = await page.evaluate(() => window.__tl)
  console.log('时间线：')
  for (const e of tl) console.log('  ', e.join('  '))
  const hash = await page.evaluate(() => location.hash)
  console.log('最终 hash =', hash)
  const counts = await page.evaluate(() => ({ cat: document.querySelectorAll('.cat-item').length, vt: document.querySelectorAll('.view-tab').length, rows: document.querySelectorAll('.cur-card').length }))
  console.log('元素计数：', JSON.stringify(counts))
  // 模块加载耗时（直接 import 已构建的 chunk）
  const imp = await page.evaluate(async () => {
    const files = ['chunk-CMa7wQ6m.js', 'chunk-D35Zzh6R.js']
    const out = []
    for (const f of files) {
      const t0 = performance.now()
      try { await import(chrome.runtime.getURL('src/newtab/assets/' + f)); out.push([f, Math.round(performance.now() - t0)]) }
      catch (e) { out.push([f, 'ERR ' + e.message]) }
    }
    return out
  })
  console.log('直接 import chunk 耗时：', JSON.stringify(imp))
  await ctx.close()
}
main().catch(e => { console.error(e); process.exit(1) })
