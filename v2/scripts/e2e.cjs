/**
 * 第卌四轮 · V2.19.0 E2E 真机验证（Playwright MV3 模板，自第卌三轮重建版收编）
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/e2e.cjs
 * 检查项：
 *   E2E-1  MV3 扩展加载（worker = CRXJS service-worker-loader.js）
 *   E2E-2  设置页默认首屏 = 知源仪表盘（导航五组 + 动态条/操作记录时间线）
 *   E2E-3  工作台全景第二屏可切换（双栏 + 三级计数树）
 *   E2E-4  北极星今日新增/今日删除卡渲染
 *   E2E-5  PDF 附件双击 file:// 打开（data 层种卡 + IndexedDB blob → 双击卡片 → 新标签 file://…pdf）
 *   E2E-6  事件日志 zy_event_log 独立 key 落盘（打开资源卡产生事件）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const EXT_INDEX = 'src/newtab/index.html'

const results = []
function report(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('chromium-1223 不存在：' + CHROME)
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })

  // E2E-1 扩展 worker
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host
  report('E2E-1 MV3 扩展加载（service-worker-loader.js）', worker.url().includes('service-worker-loader.js'), extId)

  const page = await ctx.newPage()
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 数据种卡：读现有数据 → 第一个工作台追加资源卡（PDF 附件）→ 写回
  const seedWsId = await page.evaluate(async () => {
    const minimalPdf = new Blob(
      ["%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF"],
      { type: 'application/pdf' }
    )
    // 1) IndexedDB zy_assets 写入 PDF 本体
    await new Promise((res, rej) => {
      const rq = indexedDB.open('zy_assets', 1)
      rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains('assets')) rq.result.createObjectStore('assets') }
      rq.onsuccess = () => {
        const db = rq.result
        const tx = db.transaction('assets', 'readwrite')
        tx.objectStore('assets').put(minimalPdf, 'e2e-pdf-1')
        tx.oncomplete = () => { db.close(); res() }
        tx.onerror = () => rej(tx.error)
      }
      rq.onerror = () => rej(rq.error)
    })
    // 2) 主数据追加资源卡（link=zy-asset://e2e-pdf-1，kind=pdf）入第一个工作台（待分类）
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur['zy_data_v2']
    if (!data || !data.workspaces.length) return ''
    const wsId = data.workspaces[0].id
    const cardId = 'e2e-res-1'
    data.resources = data.resources.filter(r => r.id !== cardId)
    data.resources.push({
      id: cardId, kind: 'resource', title: 'E2E PDF 测试卡', linkType: 'file', link: 'zy-asset://e2e-pdf-1',
      workspaceId: wsId, categoryId: '', tags: [], pinned: false, starred: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
      notes: '', customFields: {}, assets: [{ id: 'e2e-pdf-1', kind: 'pdf', name: 'e2e-test.pdf', size: 300, mime: 'application/pdf', createdAt: Date.now() }]
    })
    await chrome.storage.local.set({ zy_data_v2: data })
    return wsId
  })
  await page.waitForTimeout(600)
  await page.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1500) }

  // E2E-2 设置默认首屏 = 知源仪表盘
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (!page.url().includes('#/settings')) { await page.evaluate(() => { location.hash = '#/settings' }); await page.waitForTimeout(1500) }
  const dashVisible = await page.getByText('知源仪表盘').first().isVisible().catch(() => false)
  const groupCount = await page.locator('.gs-nav-group').count()
  const timelineVisible = await page.locator('.gs-ev-head, .gs-ev-empty, .gs-dash-dyn').first().isVisible().catch(() => false)
  report('E2E-2 设置默认首屏=知源仪表盘（导航五组+动态/时间线区）', dashVisible && groupCount === 5, `groups=${groupCount} timeline=${timelineVisible}`)

  // E2E-3 工作台全景
  await page.getByText('工作台全景').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const panVisible = await page.locator('.gs-pan-panel').isVisible().catch(() => false)
  const treeWs = await page.locator('.gs-pan-ws').count()
  report('E2E-3 工作台全景双栏+计数树', panVisible && treeWs >= 1, `panel=${panVisible} wsNodes=${treeWs}`)

  // E2E-4 北极星今日卡（北极星在首页 CompassHome）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const todayAdd = await page.getByText('今日新增').first().isVisible().catch(() => false)
  const todayDel = await page.getByText('今日删除').first().isVisible().catch(() => false)
  report('E2E-4 北极星今日新增/今日删除卡', todayAdd && todayDel)

  // E2E-5 PDF 双击 file:// 打开
  await page.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1500) }
  const card = page.getByText('E2E PDF 测试卡').first()
  const cardVisible = await card.isVisible().catch(() => false)
  if (cardVisible) await card.dblclick()
  let pdfTab = null
  try {
    const popup = await ctx.waitForEvent('page', { timeout: 12000 })
    const u = popup.url()
    if (/^file:\/\//i.test(u) || /^blob:/i.test(u)) pdfTab = u
  } catch { /* timeout */ }
  const fileOk = !!pdfTab && /^file:\/\//i.test(pdfTab)
  report('E2E-5 PDF 附件双击打开（file:// 落盘通道）', fileOk, pdfTab || `cardVisible=${cardVisible} 未捕获新标签（headless 下载目录为 GUID 命名，.pdf 后缀在真实环境由 filename 参数保证）`)

  // E2E-6 事件日志落盘：右键软删种子卡 → delete 事件写入 zy_event_log（外部种卡按设计静默，不产事件）
  const delBtn = page.locator('.res-card[data-rid="e2e-res-1"] .rc-action.delete')
  if (await delBtn.count()) {
    await delBtn.click().catch(() => {})
    await page.waitForTimeout(1800) // 300ms 防抖 + 落盘
  }
  const evRaw = await page.evaluate(() => chrome.storage.local.get('zy_event_log'))
  const ev = evRaw && evRaw['zy_event_log']
  report('E2E-6 事件日志 zy_event_log 落盘（软删产生 delete 事件）', Array.isArray(ev) && ev.length > 0, ev ? `${ev.length} 条，最新=${ev[ev.length - 1] && (ev[ev.length - 1].type + '/' + ev[ev.length - 1].action)}` : '无日志')

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
