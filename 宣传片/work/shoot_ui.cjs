/**
 * 宣传片界面补拍脚本（1920×1080 · 深空薰衣草 linear 主题）
 *
 * 目的：母本 02-9 要求「所有 UI 画面必须是实拍级高保真界面录屏风格」。
 * 仓库已有 1440×900 实拍（docs/视觉归档/2026-10-26），但：
 *   1) 分辨率不足 1920×1080；
 *   2) 缺「采集好奇心」浮层（Ctrl+Shift+I）实拍；
 *   3) 缺「资源卡 🔥 复用计数」特写；
 *   4) 缺「导出数据」面板特写。
 * 本脚本加载扩展 → 注入演示数据 → 逐屏补拍，产物落在 宣传片/shots/。
 *
 * 复用 theme-audit.cjs 的成熟机制：chrome.storage.local 注入 zy_data_v2 + 强制重载。
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('/Users/beantan/Downloads/zhiyuan0904/v2/node_modules/playwright-core')
const { CHROME } = require('/Users/beantan/Downloads/zhiyuan0904/v2/scripts/browser.cjs')

const DIST = '/Users/beantan/Downloads/zhiyuan0904/v2/dist'
const DATA = path.resolve(__dirname, 'demo_data.json')
const OUT = path.resolve(__dirname, '../shots')
const VP = { width: 1920, height: 1080 }
const WS_ID = 'zy-audit-curation'
const OV_HOST = process.env.OV_HOST || 'http://127.0.0.1:8799/host_page.html'

fs.mkdirSync(OUT, { recursive: true })
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const shots = []

const log = (m) => console.log(m)

async function shoot(page, name) {
  const f = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: f })
  shots.push(f)
  log(`  ✓ ${name}.png  ${(fs.statSync(f).size / 1024).toFixed(0)}KB`)
}

/** 复位：滚回顶部、清掉 hover 残留，避免上一屏的状态渗到下一屏 */
async function resetView(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.querySelectorAll('*').forEach(el => { el.classList.remove('hover', 'active', 'pressed') })
  })
  await page.mouse.move(10, 10)
  await page.waitForTimeout(250)
}

;(async () => {
  log('▶ 启动浏览器（加载扩展）…')
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: VP,
    deviceScaleFactor: 1,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  })

  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/src/newtab/index.html`
  log(`  扩展已加载：${extId}`)

  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)

  // ① 先进一次让扩展完成初始化（否则注入会被 createDefaultData 覆盖）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // ② 注入演示数据 + 锁定 linear 主题（母本 §5.2：全片统一 deep-space lavender）
  await page.evaluate(async ({ d }) => {
    await chrome.storage.local.set({
      zy_data_v2: d,
      zy_ui_v2: { theme: 'linear', density: 'comfortable', wsViewMode: 'pyramid' },
    })
  }, { d: data })
  await page.waitForTimeout(400)

  // ③ 强制重载：后注入的 uiPrefs 到不了运行中的 store（theme-audit R170 备案）
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)

  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  log(`  当前主题：${theme}`)

  log('▶ 补拍主界面…')

  // —— 镜头 3-1：调度台首屏（今日三件事） ——
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await resetView(page)
  await shoot(page, '01-dashboard')

  // —— 镜头 3-2：整行点开任务详情抽屉 ——
  {
    const row = page.locator('.fc-row, .focus-row, [class*="focus"] [class*="row"]').first()
    if (await row.count() > 0 && await row.isVisible().catch(() => false)) {
      await row.click({ position: { x: 300, y: 12 } }).catch(() => {})
      await page.waitForTimeout(1400)
      await shoot(page, '02-drawer-task')
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(600)
    } else {
      log('  ! 未定位到今日三件事行，改用备选选择器')
      const alt = page.locator('text=整理浏览器现场里的判断与证据').first()
      if (await alt.count() > 0) {
        await alt.click().catch(() => {})
        await page.waitForTimeout(1400)
        await shoot(page, '02-drawer-task')
        await page.keyboard.press('Escape').catch(() => {})
        await page.waitForTimeout(600)
      }
    }
  }

  // —— 镜头 4：策展台（中心论点 + 金字塔论证树） ——
  await page.goto(`${base}#/workspace/${WS_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  await resetView(page)
  await shoot(page, '03-curation')

  // 策展台整体视图（读数条 + 工具条）
  {
    const full = page.locator('.curation-workspace, [class*="mindmap"], [class*="mind-map"]').first()
    if (await full.count() > 0) {
      await full.screenshot({ path: path.join(OUT, '04-curation-canvas.png') }).catch(() => {})
      shots.push(path.join(OUT, '04-curation-canvas.png'))
      log('  ✓ 04-curation-canvas.png')
    }
  }

  // —— 镜头 5-1：设置页「导出数据」面板 ——
  await page.goto(`${base}#/settings`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  {
    const link = page.locator('text=导出数据').first()
    if (await link.count() > 0) {
      await link.click().catch(() => {})
      await page.waitForTimeout(1400)
    }
    /* 母本红线 5：本片不出现 Airtable。设置页左导航有「Airtable 同步」项、
       CSV 导出说明里写了「适配 Airtable 等多维表」——两处都在这一屏里。
       处理方式是**取景时避开**（隐藏含该词的元素），不改产品任何行为，
       也不改动其它任何文案或控件。 */
    const hidden = await page.evaluate(() => {
      /* 只处理「直接承载该词」的元素：取元素的**直接文本节点**拼接后判定，
         不看 textContent（那会把祖先链一起命中 → 整页隐藏，实测画面全黑 8KB）。
         · 导航项「Airtable 同步」：其 <span>/<button> 的直接文本命中 → 隐藏该项
         · CSV 说明「…适配 Airtable 等多维表」：整句所在 <p> 的直接文本命中 → 隐藏整句，
           不留「…更新时间,适配」这种断句 */
      let n = 0
      document.querySelectorAll('body *').forEach(el => {
        const direct = Array.from(el.childNodes)
          .filter(nd => nd.nodeType === Node.TEXT_NODE)
          .map(nd => nd.nodeValue || '')
          .join('')
        if (/Airtable/i.test(direct)) { el.style.display = 'none'; n++ }
      })
      return n
    })
    log(`  导出页：已隐藏含 Airtable 的元素 ${hidden} 处（母本红线 5）`)
    await page.waitForTimeout(400)
    await resetView(page)
    await shoot(page, '05-export')
  }

  // —— 三个网页浮层（母本镜头 2：Ctrl+Shift+J / I / K） ——
  const ovPage = await ctx.newPage()
  ovPage.setDefaultTimeout(30000)
  /* 宿主页必须是真 http(s)：data: URL 被 Chromium 拦截，且 content 脚本只注入 http/https 页 */
  await ovPage.goto(OV_HOST, { waitUntil: 'domcontentloaded' })
  await ovPage.waitForTimeout(1500)

  const overlays = [
    { id: 'ov-capture', msg: 'zy-open-capture', ready: '#__zy_cap_save__', name: '06-overlay-capture' },
    { id: 'ov-curiosity', msg: 'zy-open-curiosity', ready: '#__zy_cur_save__', name: '07-overlay-curiosity' },
    { id: 'ov-search', msg: 'zy-open-search', ready: '#__zy_si__', name: '08-overlay-search' },
  ]

  /* content script 由 MV3 按 manifest 注入，注入时刻受 service worker 唤醒时机影响。
     判据不用固定等待时间（theme-audit V3.8.41 备案：固定 1400ms 会随机假红），
     而是**用一次探测消息去问**——问的就是后面真要发的那条消息，能问通就是就绪。 */
  const probeContent = () => worker.evaluate(async ({ url }) => {
    const tabs = await chrome.tabs.query({ url: `${url}*` })
    if (!tabs[0]) return false
    try { await chrome.tabs.sendMessage(tabs[0].id, { type: '__zy_probe__' }); return true }
    catch (e) { return false }
  }, { url: OV_HOST }).catch(() => false)

  let contentReady = false
  const READY_UNTIL = Date.now() + 20000
  while (Date.now() < READY_UNTIL) {
    contentReady = await probeContent()
    if (contentReady) break
    await ovPage.waitForTimeout(300)
  }
  log(`  content script 就绪：${contentReady ? '是' : '否'}`)
  if (!contentReady) log('  ! content script 未注入，浮层镜头将缺证据')

  /* 母本镜头 2 明写「选中文本自动填入」。这里先在宿主页选中一段正文，
     让采集/好奇浮层真的带上预填内容——不是靠 prompt 声称，是画面上看得见。 */
  await ovPage.evaluate(() => {
    const el = document.querySelector('.quote')
    if (!el) return
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  })
  await ovPage.waitForTimeout(300)

  for (const o of overlays) {
    /* 唤起必须走 chrome.tabs.sendMessage（从 service worker 派发）——
       页面内 postMessage 不会触发 content script 的 handler。 */
    const opened = await worker.evaluate(async ({ url, t }) => {
      const tabs = await chrome.tabs.query({ url: `${url}*` })
      if (!tabs[0]) throw new Error('宿主页 tab 未找到')
      await chrome.tabs.sendMessage(tabs[0].id, { type: t })
    }, { url: OV_HOST, t: o.msg }).then(() => true).catch(e => {
      log(`  ! ${o.id} 唤起失败：${e.message}`); return false
    })
    if (!opened) continue
    const ready = await ovPage.waitForSelector(o.ready, { timeout: 8000 }).catch(() => null)
    if (!ready) { log(`  ! ${o.id} 未就绪（${o.ready} 未命中）`); continue }
    await ovPage.waitForTimeout(400)
    await resetView(ovPage)
    await shoot(ovPage, o.name)
    await ovPage.keyboard.press('Escape').catch(() => {})
    await ovPage.waitForTimeout(500)
  }

  // —— 🔥 复用计数特写：网页搜索浮层「近期最常用 · 按调用次数」分组 ——
  {
    await worker.evaluate(async ({ url }) => {
      const tabs = await chrome.tabs.query({ url: `${url}*` })
      if (tabs[0]) await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-search' })
    }, { url: OV_HOST }).catch(() => {})
    await ovPage.waitForSelector('#__zy_si__', { timeout: 8000 }).catch(() => null)
    await ovPage.waitForTimeout(700)
    const hot = ovPage.locator('text=近期最常用').first()
    if (await hot.count() > 0) {
      await hot.scrollIntoViewIfNeeded().catch(() => {})
      await ovPage.waitForTimeout(500)
      await shoot(ovPage, '09-reuse-count')
    } else {
      log('  ! 未定位到「近期最常用」分组（资源卡 callCount 需 ≥ 3）')
    }
    await ovPage.keyboard.press('Escape').catch(() => {})
  }

  log(`\n✅ 补拍完成，共 ${shots.length} 张 → ${OUT}`)
  await ctx.close()
})().catch(e => { console.error('❌ 补拍失败:', e); process.exit(1) })
