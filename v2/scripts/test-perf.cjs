/**
 * R49-J 性能实测（Playwright MV3 真机）
 * 口径：路由切换 ≤300ms（门禁）；`/` 首屏；Splash 刷新动画时长（300–600ms 硬约束）。
 * 运行：node scripts/test-perf.cjs
 */
const { chromium } = require('playwright-core')
const path = require('path')
const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const results = []
function report(name, ok, detail) {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  → ' + detail : ''}`)
}
// 路由标记：各视图稳定存在的根元素（不依赖数据内容）
const ROUTE_SEL = { '#/compass': '.metric-bar', '#/': '.rec-strip', '#/workspace': '.ws-hero' }

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = 'chrome-extension://' + new URL(worker.url()).host
  const page = await ctx.newPage()
  const base = extId + '/src/newtab/index.html'

  // J-1 `/` 首屏：导航到 rec-strip 可见（含 Splash）
  const t0 = Date.now()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.rec-strip', { state: 'visible', timeout: 10000 })
  const firstLoad = Date.now() - t0
  report('J-1 `/` 首屏（导航 → 调度台今日记录条可见，含 Splash）', firstLoad > 0, `${firstLoad}ms`)

  // J-2 Splash 刷新动画节奏：bootstrap → splash 移除（main.ts 探针 __zySplashMs），规格 300–600ms
  await page.reload({ waitUntil: 'domcontentloaded' })
  const splashMs = await page.evaluate(() => new Promise((res) => {
    const t0 = Date.now()
    const tick = () => {
      if (window.__zySplashMs) return res(window.__zySplashMs)
      if (Date.now() - t0 > 10000) return res(-1)
      setTimeout(tick, 50)
    }
    tick()
  }))
  report('J-2 Splash 刷新动画节奏（300–600ms 区间）', splashMs >= 300 && splashMs <= 600, `${splashMs}ms`)

  // J-3 路由切换：hash 导航到目标视图标记元素可见，门禁 ≤300ms
  const routeSeq = ['#/compass', '#/', '#/compass', '#/', '#/compass']
  const routeTimes = []
  let maxRoute = 0
  for (const r of routeSeq) {
    const dt = await page.evaluate(({ hash, sel }) => new Promise((res) => {
      const t0 = performance.now()
      location.hash = hash
      const ob = new MutationObserver(() => {
        const el = document.querySelector(sel)
        if (el && el.getClientRects().length) { ob.disconnect(); res(Math.round(performance.now() - t0)) }
      })
      ob.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => { ob.disconnect(); res(-1) }, 3000)
    }), { hash: r, sel: ROUTE_SEL[r] })
    routeTimes.push(`${r}:${dt}ms`)
    if (dt > maxRoute) maxRoute = dt
  }
  report('J-3 路由切换 ≤300ms（五次实测取最大）', maxRoute > 0 && maxRoute <= 300, routeTimes.join(' / '))

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nJ 性能实测：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error('J 实测执行失败：', e); process.exit(2) })
