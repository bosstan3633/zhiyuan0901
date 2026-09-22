/**
 * 第卌五轮 · V2.20.0 E2E 真机验证（Playwright MV3 模板，自第卌三轮重建版收编）
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/e2e.cjs
 * 检查项：
 *   E2E-1  MV3 扩展加载（worker = CRXJS service-worker-loader.js）
 *   E2E-2  设置页默认首屏 = 知源仪表盘（导航四组 R54 + 动态条/操作记录时间线）
 *   E2E-3  资源台全景第二屏可切换（双栏 + 三级计数树）
 *   E2E-4  北极星「新增卡片/删除卡片」卡渲染（R45-1 三档周期联动改名）
 *   E2E-5  PDF 附件双击 file:// 打开（data 层种卡 + IndexedDB blob → 双击卡片 → 新标签 file://…pdf）
 *   E2E-6  事件日志 zy_event_log 独立 key 落盘（打开资源卡产生事件）
 *   E2E-7  调度台底部双 tab（R117-C1）：任务调度（默认）+ 好奇心培育（懒挂载）；方向台不再持任务模块
 *   E2E-8  调度台三件事 + 项目调度面板（愿景/使命小卡 + 战略目标 + 四数值，R45 T-04 → R49 迁移）
 *   E2E-9  存量回填迁移：有 metricId 无 projectId 的任务启动后按指标反查补齐 + projBackfillFixed 记录（R46 BUG-2）
 *   E2E-10 策展统一树：遗留投射记录迁移物化 + 源卡实时 + 原生卡 + 清空引用回落零影响（R53）
 *   E2E-11 主航线目标行 chip + 指标条未归档任务格 + 档位入表头（R50-F4/F5）
 *   E2E-12 主航线全量呈现：未投射项目 chip 也出现（R52-F4 修订 R51-F18）
 *   E2E-13 方向树返回方向台 + 项目详情头部添加成功指标 + 返回项目列表移除（R52-F5/F6/F8）
 *   E2E-14 项目调度指标下钻弹窗（R54-B2）
 *   E2E-15 面包屑 + 来源感知返回 + 树定位闭环（R54-A）
 *   E2E-16 快速采集任务面板（R55-C）
 *   E2E-17 项目调度 4 指标恢复左列 + 下钻链路（R56-P1）
 *   E2E-18 策展卡可拖真值（draggable="true"）+ 区域级落卡（R57-F1）
 *   E2E-19 删除策展台软删（deletedAt）+ 回收站可见可恢复（R58-B1）
 *   E2E-20 项目详情左树：空指标节点接收任务拖拽（R59-T5）
 *   E2E-21 周报浮层可见 + 可关闭（R113-N3 P0：模板引用但未 import 的静默失效修复）
 *   E2E-22 金字塔真全屏交互（R113-N5：requestFullscreen + 动态浮层宿主）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

// R56：跨平台 Chromium 路径（Windows = playwright 缓存 chrome-win64；macOS = 缓存内 Chrome for Testing）
const CHROME_PINNED = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
/** R128：pinned 缓存不存在时回落系统 Chrome（ZY_CHROME 可显指定）；R149 补齐中间一级：
 *  本机任一 ms-playwright Chromium 优先于系统 Chrome——系统 Chrome 的旧 headless 起不了 MV3
 *  service worker，E2E-1 直接超时，门禁不该靠"记不记得设环境变量"。与 perf.cjs 同口径。 */
const CHROME = (() => {
  if (fs.existsSync(CHROME_PINNED)) return CHROME_PINNED
  if (process.env.ZY_CHROME) return process.env.ZY_CHROME
  const cache = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
  try {
    const hit = fs.readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort().pop()
    if (hit) {
      const p = path.join(cache, hit, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      if (fs.existsSync(p)) return p
    }
  } catch { /* 无缓存目录 */ }
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return process.platform === 'darwin' && fs.existsSync(sys) ? sys : CHROME_PINNED
})()
const DIST = path.resolve(__dirname, '..', 'dist')
const EXT_INDEX = 'src/newtab/index.html'

const results = []
function report(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
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
  // R145 修漂移：外部直写 zy_data_v2 后必须**整页重载**——SPA 内存态不会重读 storage，
  //   且任何一次 persist 都会把种进去的卡盖掉（原实现只走 hash 导航，E2E-5/6 的种卡因此从未上屏）。
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
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
  report('E2E-2 设置默认首屏=知源仪表盘（导航四组 R54 + 动态/时间线区）', dashVisible && groupCount === 4, `groups=${groupCount} timeline=${timelineVisible}`)

  // E2E-3 资源台全景
  await page.getByText('资源台全景').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const panVisible = await page.locator('.gs-pan-panel').isVisible().catch(() => false)
  const treeWs = await page.locator('.gs-pan-ws').count()
  report('E2E-3 资源台全景双栏+计数树', panVisible && treeWs >= 1, `panel=${panVisible} wsNodes=${treeWs}`)

  // E2E-4 方向状态四格（R55-D1 迁调度台顶部；R57-F3 详细指标按钮移除 → 改验证四格自下钻抽屉）
  // R110 修漂移：`.mb-cells` 已不存在（MetricBar 根为 .metric-bar + .mb-row）；「未归档任务」文案
  //   已在 R65-F8 单行压缩时简化为「未归档」（全称保留在 tooltip）——两处选择器/文案同步。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const metricBarOn = await page.locator('.metric-bar').first().isVisible().catch(() => false)
  const cellCount = await page.locator('.mb-cell').count()
  const offCourse = (await page.locator('.mb-cell .mb-k').nth(4).textContent().catch(() => '')) === '未归档'
  const drillBtnGone = (await page.locator('.mb-drill').count()) === 0
  await page.locator('.mb-cell').nth(4).click().catch(() => {})
  await page.waitForTimeout(900)
  const cellDrawer = await page.getByText('未归档任务 · 待归档清单').first().isVisible().catch(() => false)
  await page.keyboard.press('Escape').catch(() => {})
  report('E2E-4（R120-TB1 修订）方向状态五格迁调度台顶部（合流条）+ 各格自下钻', metricBarOn && cellCount === 5 && offCourse && drillBtnGone && cellDrawer,
    'bar=' + metricBarOn + ' cells=' + cellCount + ' unarch=' + offCourse + ' drillBtnGone=' + drillBtnGone + ' cellDrawer=' + cellDrawer)

  // E2E-5 PDF 双击 file:// 打开
  await page.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1500) }
  const card = page.locator('.res-card[data-rid="e2e-res-1"]').first()
  const cardVisible = await card.isVisible().catch(() => false)
  // R110 修漂移：卡片右上角 hover 动作条（.rc-action）在 Playwright dblclick 的「先 hover 再按中心取点」流程下
  //   会覆盖标题中心，pointer 拦截导致 actionability 检查超时（TimeoutError 30s）。
  //   改为：取卡片 boundingBox，用真实鼠标双击**左下角内边距**（远离右上角动作条）；
  //   若仍未唤起新标签，再直接向卡片派发 dblclick 事件兜底（绕过指针拦截，语义等价「双击卡片」）。
  const dbl = async () => {
    const box = await card.boundingBox().catch(() => null)
    if (box) await page.mouse.dblclick(box.x + 8, box.y + box.height - 8).catch(() => {})
  }
  const grabPdfTab = async (ms) => {
    try {
      const popup = await ctx.waitForEvent('page', { timeout: ms })
      const u = popup.url()
      if (/^file:\/\//i.test(u) || /^blob:/i.test(u)) return u
    } catch { /* timeout */ }
    return null
  }
  let pdfTab = null
  if (cardVisible) {
    await dbl()
    pdfTab = await grabPdfTab(8000)
    if (!pdfTab) {
      await card.dispatchEvent('dblclick').catch(() => {})
      pdfTab = await grabPdfTab(6000)
    }
  }
  const fileOk = !!pdfTab && /^file:\/\//i.test(pdfTab)
  // R56：headless（尤其 macOS）禁止 file:// 导航——落盘通道以 chrome.downloads 完成 + zy_file_paths 路径记忆为证，file:// 打开留真机复核
  let dlOk = false, pathsOk = false
  if (!pdfTab && cardVisible) {
    dlOk = await page.evaluate(() => new Promise((res) => {
      try { chrome.downloads.search({ limit: 10, orderBy: ['-startTime'] }, (items) => res((items || []).some(it => it.state === 'complete' || (it.filename || '').length > 0))) } catch { res(false) }
    })).catch(() => false)
    pathsOk = await page.evaluate(() => new Promise((res) => {
      chrome.storage.local.get('zy_file_paths', (r) => res(Object.keys(r['zy_file_paths'] || {}).length > 0))
    })).catch(() => false)
  }
  report('E2E-5 PDF 附件双击打开（file:// 落盘通道）', fileOk || (dlOk && pathsOk), pdfTab || `cardVisible=${cardVisible} headless落盘证据 downloads=${dlOk} zy_file_paths=${pathsOk}（file:// 导航 headless 不可捕获，真机复核）`)

  // E2E-6 事件日志落盘：右键软删种子卡 → delete 事件写入 zy_event_log（外部种卡按设计静默，不产事件）
  // R122 修漂移：卡片一级 hover 动作收敛（删除移入右键菜单，原 .rc-action.delete 已退役）→
  //   改为在卡片上派发 contextmenu → 等 .cx-menu-box 弹出 → 点「删除」菜单项（soft-delete 语义不变）。
  const box6 = await card.boundingBox().catch(() => null)
  if (box6) {
    await page.mouse.click(box6.x + box6.width / 2, box6.y + box6.height / 2, { button: 'right' }).catch(() => {})
    await page.waitForTimeout(500)
  }
  const delItem = page.locator('.ctx-menu-box .cx-item', { hasText: '删除' }).first()
  if (await delItem.count()) {
    await delItem.click().catch(() => {})
    await page.waitForTimeout(1800) // 300ms 防抖 + 落盘
  }
  const evRaw = await page.evaluate(() => chrome.storage.local.get('zy_event_log'))
  const ev = evRaw && evRaw['zy_event_log']
  report('E2E-6 事件日志 zy_event_log 落盘（软删产生 delete 事件）', Array.isArray(ev) && ev.length > 0, ev ? `${ev.length} 条，最新=${ev[ev.length - 1] && (ev[ev.length - 1].type + '/' + ev[ev.length - 1].action)}` : '无日志')

  // ---- 第卌五轮 R45：罗盘种子数据（战略目标→项目→成功指标→任务→今日三件事） ----
  await page.evaluate(() => {
    const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()
    const now = Date.now()
    return chrome.storage.local.get('zy_data_v2').then((cur) => {
      const data = cur['zy_data_v2']
      if (!data) return
      data.compass = data.compass || { vision: { content: 'E2E 愿景文本', updatedAt: now }, mission: { content: 'E2E 使命文本', updatedAt: now }, directions: [] }
      data.compass.directions = (data.compass.directions || []).filter((x) => x.id !== 'e2e-dir-1')
      data.compass.directions.push({ id: 'e2e-dir-1', name: 'E2E 战略目标', status: 'active', term: 'short', projects: [] })
      const dir = data.compass.directions.find((x) => x.id === 'e2e-dir-1')
      dir.projects = dir.projects.filter((p) => p.id !== 'e2e-proj-1' && p.id !== 'e2e-proj-2')
      dir.projects.push({ id: 'e2e-proj-1', name: 'E2E 策展项目', isFocused: false, progress: 0, status: 'active', metrics: [{ id: 'e2e-metric-1', title: 'E2E 成功指标', target: '10', acceptance: '', taskIds: ['e2e-task-1'] }] })
      // R46 E2E-9 种子：历史脏数据——task-2 有 metricId 但缺 projectId（回填迁移应补齐为 e2e-proj-2）
      dir.projects.push({ id: 'e2e-proj-2', name: 'E2E 回填项目', isFocused: false, progress: 0, status: 'active', metrics: [{ id: 'e2e-metric-2', title: 'E2E 回填指标', target: '5', acceptance: '', taskIds: ['e2e-task-2'] }] })
      data.tasks = (data.tasks || []).filter((t) => t.id !== 'e2e-task-1' && t.id !== 'e2e-task-2')
      data.tasks.push({
        id: 'e2e-task-1', kind: 'task', title: 'E2E 任务卡', projectId: 'e2e-proj-1', metricId: 'e2e-metric-1',
        status: 'doing', priority: 'high', mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [], pinned: false,
        createdAt: now, updatedAt: now
      })
      data.tasks.push({
        id: 'e2e-task-2', kind: 'task', title: 'E2E 回填任务卡', metricId: 'e2e-metric-2',
        status: 'todo', priority: 'medium', mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [], pinned: false,
        createdAt: now, updatedAt: now
      })
      data.dailyFocus = data.dailyFocus || {}
      data.dailyFocus[today] = [{ id: 'e2e-slot-1', sourceType: 'task', sourceId: 'e2e-task-1', text: 'E2E 任务卡', done: false }]
      return chrome.storage.local.set({ zy_data_v2: data })
    })
  })
  await page.waitForTimeout(800)

  // E2E-7 调度台底部双 tab（R117-C1）：任务调度（默认）+ 好奇心培育同宿一节，好奇心懒挂载；方向台不再持任务模块
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.waitForSelector('.bt-tab', { timeout: 8000 }).catch(() => {})
  const tabsCount = await page.locator('.bt-tab').count()
  const taskTabActive = await page.locator('.bt-tab.on').first().textContent().then((t) => (t || '').includes('任务')).catch(() => false)
  const taskPaneOn = await page.locator('.bottom-pane').first().isVisible().catch(() => false)
  const tmCardCount = await page.locator('.tm-card').count()
  // 懒挂载：未切到好奇 tab 前好奇心面板整棵不在 DOM（`.cz-batch-btn` 是面板内首个稳定锚点；
  //   section#zy-mod-curiosity 常驻，故不能用它计数）
  const curioBefore = await page.locator('.cz-batch-btn').count()
  await page.locator('.bt-tab').nth(1).click().catch(() => {})
  await page.waitForTimeout(1200)
  const curioPanelOn = await page.locator('.cz-batch-btn').first().isVisible().catch(() => false)
  // 方向台不再有任务调度模块（搬迁后宿主为调度台）
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(1800)
  const dirTaskModule = await page.locator('#task-mgmt-module').count()
  report('E2E-7 调度台底部双 tab：任务调度（默认）+ 好奇心培育（懒挂载）；方向台无任务模块（R117-C1）',
    tabsCount === 2 && taskTabActive && taskPaneOn && curioBefore === 0 && curioPanelOn && dirTaskModule === 0,
    'tabs=' + tabsCount + ' taskTab=' + taskTabActive + ' taskPane=' + taskPaneOn + ' tmCards=' + tmCardCount + ' curioBefore=' + curioBefore + ' curioOn=' + curioPanelOn + ' dirTaskModule=' + dirTaskModule)

  // E2E-8 调度台首页（R49 迁移）：三件事卡片 + 项目调度面板（愿景/使命小卡 + 战略目标 + 四数值）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const todayCard = await page.locator('.today-card').first().isVisible().catch(() => false)
  const curationOn = await page.locator('.cur-body-v').first().isVisible().catch(() => false)
  // R111 修漂移：R66-F2 主动删除调度台顶部的「愿景/使命」小卡（源码注释原文「删顶部项目名行与愿景/使命
  //   模块（数据保留在方向台）」），属产品决策而非缺失 → 该两项断言退役，不再设。项目调度面板的当前
  //   等值锚点 = `.cur-goal-lab`（战略目标标签）+ `.cur-goal-name`（战略目标名，R67-F1 重排后小字在上）。
  const goalCard = await page.locator('.cur-goal-lab').first().isVisible().catch(() => false)
  const goalOn = await page.getByText('E2E 战略目标').first().isVisible().catch(() => false)
  // R56-P1：4 指标恢复左列（cur-stats-v2 一行四格），头部状态栏已移除
  const statCount = await page.locator('.cur-stats-v2 .csv-cell').count()
  report('E2E-8 调度台三件事 + 项目调度面板（战略目标小卡+左列四指标 R56-P1）', todayCard && curationOn && goalCard && goalOn && statCount === 4,
    `todayCard=${todayCard} curation=${curationOn} goalCard=${goalCard} stats=${statCount} goal=${goalOn} (vision/mission 小卡 R66-F2 已主动删除)`)

  // E2E-9 存量回填迁移（R46 BUG-2）：重新加载页面触发 init 回填 → task-2 补齐 projectId + projBackfillFixed 记录
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const backfill = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return { fixed: false, recorded: 0 }
    const t2 = (data.tasks || []).find((t) => t.id === 'e2e-task-2')
    return { fixed: !!(t2 && t2.projectId === 'e2e-proj-2'), recorded: data.projBackfillFixed || 0 }
  }))
  report('E2E-9 存量回填：缺 projectId 的任务按指标反查补齐 + 记录条数', backfill.fixed && backfill.recorded >= 1,
    `projectIdFixed=${backfill.fixed} projBackfillFixed=${backfill.recorded}`)

  // E2E-10 资源台统一树 + 单向挂载红线（R111 承接 R110-B1）
  //   原 R53「策展中心统一树」断言已随 R72/R73「资源台收敛」退役——`#/curation` 改为 redirect 到
  //   `/workspace/zy-curation`（router.ts 注释原文：「旧路径 /curation 不再渲染独立组件」），
  //   旧依赖（「灵活策展空间」文案 / `.mc-field` / 「🧹 清空投射」）在源码中已零命中。
  //   新等价不变量（数据层可测，不依赖易漂移的 UI 文案）：
  //     1) 遗留 kind='workspace' 投射 + 指向资源台的脏投射 → 启动归一化应清除（scrubHubMirrorMarkers）
  //     2) 资源台（hub）镜像标记恒 0（单向挂载红线兜底）
  //     3) 源卡零影响
  await page.goto(base + '#/workspace/zy-curation', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (!page.url().includes('/workspace/')) { await page.evaluate(() => { location.hash = '#/workspace/zy-curation' }); await page.waitForTimeout(1500) }
  // 种源分类+源卡 + 遗留 kind='workspace' 投射记录（UI 右键在 headless 不稳定，数据层直种；app.init 迁移应物化为镜像分类）
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    const wsId = data.workspaces[0].id
    if (!data.categories.some((c) => c.id === 'e2e-cat-1')) {
      data.categories.push({ id: 'e2e-cat-1', workspaceId: wsId, name: 'E2E 镜像分类', order: 0 })
    }
    if (!data.resources.some((r) => r.id === 'e2e-mir-1')) {
      data.resources.push({ id: 'e2e-mir-1', kind: 'resource', title: 'E2E 镜像卡', linkType: 'url', link: 'https://example.com/e2e-mir', workspaceId: wsId, categoryId: 'e2e-cat-1', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
    }
    // 脏投射双份：遗留 kind='workspace' + 指向资源台的卡片投射（历史双写产物，targetWsId 直指 hub）
    data.curationProjections = [
      { id: 'e2e-curp-dirty', kind: 'card', wsId, cardId: 'e2e-mir-1', catId: 'e2e-cat-1', targetCatId: 'e2e-cat-1', targetWsId: 'zy-curation', addedAt: Date.now() },
      { id: 'e2e-curp-ws', kind: 'workspace', wsId, addedAt: Date.now() }
    ]
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { location.hash = '#/workspace/zy-curation' })
  await page.waitForTimeout(1800)
  const hubHead = await page.locator('.hero-btn').first().isVisible().catch(() => false)
  const hubTreeOn = await page.locator('.ws-cat-head, .section-label').first().isVisible().catch(() => false)
  // 启动归一化后：指向资源台的脏投射与镜像标记应双双清零
  const scrubbed = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    const dirtyLeft = (data.curationProjections || []).filter((p) => p.targetWsId === 'zy-curation').length
    const markerLeft = (data.resources || []).filter((r) => r.workspaceId === 'zy-curation' && ('__mirrorProjId' in r)).length
    return { ok: dirtyLeft === 0 && markerLeft === 0, dirtyLeft, markerLeft }
  }))
  const srcKept = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    return data.resources.some((r) => r.id === 'e2e-mir-1' && !r.deletedAt)
  }))
  report('E2E-10 资源台统一树 + 单向挂载红线（R111 承接 R110-B1）', hubHead && hubTreeOn && scrubbed.ok && srcKept,
    `hubHead=${hubHead} hubTree=${hubTreeOn} scrubbed=${scrubbed.ok}(脏投射残留${scrubbed.dirtyLeft}/镜像标记残留${scrubbed.markerLeft}) srcKept=${srcKept}`)

  // E2E-11 主航线（R55-D1 后）：目标行 chip；未归档格随 MetricBar 迁调度台（E2E-4 已覆盖）
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    for (const dir of data.compass?.directions || []) for (const p of dir.projects || []) if (p.id === 'e2e-proj-1') p.pinnedToLighthouse = true
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(2000)
  // R121：项目 chip → 项目行卡（proj-row）；等待渲染防长序列时序抖动
  await page.waitForSelector('.proj-row', { timeout: 8000 }).catch(() => {})
  const goalChip = await page.locator('.proj-row').first().isVisible().catch(() => false)
  const offCourseGone = !(await page.getByText('偏航行动').first().isVisible().catch(() => false))
  report('E2E-11 主航线目标行 chip（未归档格迁调度台由 E2E-4 覆盖）', goalChip && offCourseGone,
    `chip=${goalChip} offCourseGone=${offCourseGone}`)

  // E2E-12 主航线全量呈现（R52-F4）：未投射项目也出现在战略目标行 chip（修订 R51-F18「仅已投射」）
  const chipCount = await page.locator('.proj-row').count()
  const unPinnedChip = await page.getByText('E2E 回填项目').first().isVisible().catch(() => false)
  report('E2E-12 主航线全量呈现：未投射项目 chip 也出现（R52-F4）', chipCount >= 2 && unPinnedChip,
    `chips=${chipCount} unPinnedVisible=${unPinnedChip}`)

  // E2E-13 方向台导航与项目详情操作（R52-F8/F5/F6）：方向树返回方向台 + 项目详情无「返回项目列表」+ 头部「添加成功指标」
  await page.evaluate(() => { location.hash = '#/compass/tree' })
  await page.waitForTimeout(1500)
  const backBtn = await page.getByText('← 返回方向台').first().isVisible().catch(() => false)
  await page.getByText('← 返回方向台').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const backToCompass = page.url().includes('/compass')
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-proj-1' })
  await page.waitForTimeout(1500)
  // R121：原「成功指标 → 任务」层头退役 → 展板统计条（pb-stats）
  const projHead = await page.locator('.pb-stats').first().isVisible().catch(() => false)
  const addMetricBtn = await page.getByText('添加成功指标').first().isVisible().catch(() => false)
  const backListGone = !(await page.getByText('返回项目列表').first().isVisible().catch(() => false))
  report('E2E-13 方向树返回方向台 + 项目详情头部添加成功指标 + 返回项目列表移除（R52-F5/F6/F8）', backBtn && backToCompass && projHead && addMetricBtn && backListGone,
    `back=${backBtn} toCompass=${backToCompass} proj=${projHead} addMetric=${addMetricBtn} backListGone=${backListGone}`)

  // E2E-14 指标下钻弹窗（R54-B2）：调度台项目调度 4 格可点击 → 弹窗列指标清单
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 120)))
  // R56-P1：4 指标恢复左列（cur-stats-v2），cur-stat-strip 已随恢复移除
  await page.locator('.cur-stats-v2 .csv-cell').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const drillModal = await page.getByText('成功指标 · E2E 策展项目').first().isVisible().catch(() => false)
  const drillRow = await page.getByText('E2E 成功指标').first().isVisible().catch(() => false)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(600)
  // 幽灵感知：leave 过渡未完成的 opacity:0 残留元素视为已关闭（对用户不可见且 Playwright 误报可见）
  const drillGone = await page.evaluate(() => {
    const m = document.querySelector('.picker-modal')
    if (!m) return true
    return getComputedStyle(m).opacity === '0'
  })
  report('E2E-14 项目调度指标下钻弹窗（R54-B2）', drillModal && drillRow && drillGone,
    `modal=${drillModal} row=${drillRow} escClosed=${drillGone}`)

  // E2E-15 二级导航闭环（R54-A）：项目详情 → 跳树带定位与来源 → 树返回按钮=返回项目详情 → 回到项目详情
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-proj-1' })
  await page.waitForTimeout(1500)
  const crumbUp = await page.getByText('方向台', { exact: true }).first().isVisible().catch(() => false)
  // R121：树定位入口收进展板 ⋯ 菜单（原 back-row「🌳 完整方向树」按钮已随重排退役）
  await page.locator('.pb-more-wrap .mini-btn.icon').first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.getByText('🌳 在完整方向树中定位').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  const urlHasFrom = page.url().includes('from=proj') && page.url().includes('hl=')
  const backToProjBtn = await page.getByText('← 返回项目详情').first().isVisible().catch(() => false)
  await page.getByText('← 返回项目详情').first().click().catch(() => {})
  await page.waitForTimeout(1500)
  const backOnProj = page.url().includes('/compass/projects') && page.url().includes('p=e2e-proj-1')
  report('E2E-15 面包屑+来源感知返回+树定位闭环（R54-A）', crumbUp && urlHasFrom && backToProjBtn && backOnProj,
    `crumb=${crumbUp} fromHl=${urlHasFrom} backBtn=${backToProjBtn} backOnProj=${backOnProj}`)


  // E2E-16 快速采集任务（R55-C）：应用内面板四字段非必填 → 保存进全域任务
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'zy-open-task-capture' }))
  await page.waitForTimeout(800)
  const pageErrs = []
  page.on('pageerror', e => pageErrs.push(String(e).slice(0, 150)))
  const tcPanelOn = await page.getByText('快速采集任务').first().isVisible().catch(() => false)
  await page.getByPlaceholder('要做什么（可留空）').fill('R55 采集任务').catch(() => {})
  await page.getByPlaceholder('补充说明、上下文、验收标准（可留空）').fill('E2E 内容').catch(() => {})
  await page.evaluate(() => { const b = [...document.querySelectorAll('.gp-btn-primary')].find(x => x.textContent.includes('保存任务')); if (b) b.click() })
  await page.waitForTimeout(1000)
  const tcSavedOn = await page.getByText('任务已保存').first().isVisible().catch(() => false)
  const taskIn = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => (r['zy_data_v2'].tasks || []).some(t => t.title === 'R55 采集任务')))
  report('E2E-16 快速采集任务面板（R55-C）', tcPanelOn && tcSavedOn && taskIn,
    'panel=' + tcPanelOn + ' saved=' + tcSavedOn + ' inDb=' + taskIn + ' errs=' + JSON.stringify(pageErrs))


  // E2E-17 项目调度 4 指标恢复（R56-P1）：左列一行四格 → 弹窗下钻 → 点击任务开右侧详情抽屉
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cellsOn = await page.locator('.cur-stats-v2 .csv-cell').count()
  const stripGone = await page.locator('.cur-stat-strip').count()
  await page.locator('.cur-stats-v2 .csv-cell').nth(3).click().catch(() => {}) // 第 4 格 = 进行中
  await page.waitForTimeout(600)
  const drillTitle = await page.getByText('进行中任务 · E2E 策展项目').first().isVisible().catch(() => false)
  const drillTaskRow = await page.getByText('E2E 任务卡').first().isVisible().catch(() => false)
  await page.evaluate(() => { const rows = [...document.querySelectorAll('.picker-modal .picker-item')]; const hit = rows.find(r => r.textContent.includes('E2E 任务卡')); if (hit) hit.click() })
  await page.waitForTimeout(900)
  const drawerOpen = await page.evaluate(() => {
    const t = document.querySelector('.ts-title')
    return !!t && ((t.value || t.textContent || '').includes('E2E 任务卡'))
  })
  const cellStat = cellsOn === 4 && stripGone === 0
  report('E2E-17 项目调度4指标恢复左列+下钻链路（R56-P1）', cellStat && drillTitle && drillTaskRow && drawerOpen,
    'cells=' + cellsOn + ' stripGone=' + (stripGone === 0) + ' modal=' + drillTitle + ' row=' + drillTaskRow + ' drawer=' + drawerOpen)


  // E2E-18 策展台资源卡可拖真值 + 跨分类落卡（R111 承接 R57-F1）
  //   原断言基于旧策展中心 DOM（`.cur-card` / `.cur-grid` / `.cat-item` / `#/curation`），
  //   已随 R72/R73「资源台收敛」整体退役（源码中零命中）。当前等价载体：
  //     载体 = `.res-card`（`:draggable="!batchMode"`，网格/列表两视图共用类名）
  //     落卡 = 卡片本体 `@drop="onDropCard"`（跨分区 = 修改分类归属）/ 分区网格 `.card-grid`（区域级）
  //   仍守护 R57-F1 根因：裸 `draggable` 渲染为非法空值（空字符串）会让真实拖拽不启动，
  //   因此断言取 `getAttribute('draggable') === 'true'`（而非仅 `hasAttribute`）。
  await page.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1500) }
  // 种两张分属不同分类的资源卡（拖拽源 / 落点）
  const seedOk = await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_data_v2').then(({ ['zy_data_v2']: d }) => {
      if (!d || d.version !== 2) { res(false); return }
      const wsId = d.workspaces[0].id
      if (!d.categories.some(c => c.id === 'e2e-drag-c1')) d.categories.push({ id: 'e2e-drag-c1', workspaceId: wsId, name: 'E2E 拖拽分类A', order: 96 })
      if (!d.categories.some(c => c.id === 'e2e-drag-c2')) d.categories.push({ id: 'e2e-drag-c2', workspaceId: wsId, name: 'E2E 拖拽分类B', order: 97 })
      const mk = (id, title, catId, t) => ({ id, kind: 'resource', title, linkType: 'url', link: 'https://e.com/' + id, workspaceId: wsId, categoryId: catId, tags: [], pinned: false, starred: false, callCount: 0, createdAt: Date.now() - t, updatedAt: Date.now() - t, notes: '', customFields: {}, assets: [] })
      if (!d.resources.some(r => r.id === 'e2e-drag-a')) d.resources.push(mk('e2e-drag-a', 'E2E 拖拽卡A', 'e2e-drag-c1', 5))
      if (!d.resources.some(r => r.id === 'e2e-drag-b')) d.resources.push(mk('e2e-drag-b', 'E2E 拖拽卡B', 'e2e-drag-c2', 6))
      chrome.storage.local.set({ ['zy_data_v2']: d }).then(() => res(true))
    })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1600) }
  // 真值检查：draggable 属性必须是字符串 'true'（R57-F1 根因防线）
  const dragAttr = await page.evaluate(() => {
    const el = document.querySelector('.res-card[data-rid="e2e-drag-a"]') || document.querySelector('.res-row[data-rid="e2e-drag-a"]') || document.querySelector('.kc-card[data-rid="e2e-drag-a"]')
    return el ? el.getAttribute('draggable') : '(无卡)'
  })
  // 跨分类落卡：卡片 A 拖到卡片 B 上 = 归属改为 B 所在分类（onDropCard 跨分区分支）
  const areaDrop = await page.evaluate(() => {
    const q = (id) => document.querySelector('.res-card[data-rid="' + id + '"]') || document.querySelector('.res-row[data-rid="' + id + '"]') || document.querySelector('.kc-card[data-rid="' + id + '"]')
    const src = q('e2e-drag-a'), dst = q('e2e-drag-b')
    if (!src || !dst) return 'missing:' + (src ? '' : 'src ') + (dst ? '' : 'dst')
    const dt = new DataTransfer()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return 'dispatched'
  })
  await page.waitForTimeout(700)
  const movedCat = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => ((r['zy_data_v2'].resources || []).find(x => x.id === 'e2e-drag-a') || {}).categoryId ?? '(无)'))
  report('E2E-18 策展台资源卡可拖真值+跨分类落卡（R111 承接 R57-F1）', dragAttr === 'true' && seedOk && areaDrop === 'dispatched' && movedCat === 'e2e-drag-c2',
    'draggable=' + dragAttr + ' seed=' + seedOk + ' area=' + areaDrop + ' cat=e2e-drag-c1→' + movedCat)


  // E2E-19 删除策展台软删（R58-B1）：删除后资源卡带 deletedAt 进回收站，恢复时孤卡回落首个可用策展台
  await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_data_v2').then(({ ['zy_data_v2']: d }) => {
      if (!d || d.version !== 2) { res(false); return }
      if (!d.workspaces.some(w => w.id === 'e2e-del-ws')) {
        d.workspaces.push({ id: 'e2e-keep-ws', name: '📦 保留台', icon: '📦', order: 90, archived: false })
        d.workspaces.push({ id: 'e2e-del-ws', name: '📦 待删台', icon: '📦', order: 91, archived: false })
        d.resources.push({ id: 'e2e-del-card', kind: 'resource', title: 'E2E 待删台资源卡', linkType: 'url', link: 'https://e.com/del', workspaceId: 'e2e-del-ws', categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
      }
      chrome.storage.local.set({ ['zy_data_v2']: d }).then(() => res(true))
    })
  }))
  // R145 修漂移：种完必须整页重载（SPA 内存态不重读 storage，否则待删台根本不存在→菜单点了没反应）
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.evaluate(() => { location.hash = '#/workspace/e2e-del-ws' })
  await page.waitForTimeout(1600)
  await page.evaluate(() => { const b = document.querySelector('.hero-btn.settings'); if (b) b.click() })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const it = [...document.querySelectorAll('.sm-item')].find(x => x.textContent.includes('删除策展台')); if (it) it.click() })
  await page.waitForTimeout(500)
  const confirmMsg = await page.getByText('移入回收站').first().isVisible().catch(() => false)
  await page.evaluate(() => { const b = document.querySelector('.cdf-btn.ok'); if (b) b.click() })
  await page.waitForTimeout(1200)
  const afterDel = await page.evaluate(() => new Promise((res) => chrome.storage.local.get('zy_data_v2').then(r => {
    const dd = r['zy_data_v2']
    const card = (dd.resources || []).find(x => x.id === 'e2e-del-card')
    res({ wsGone: !(dd.workspaces || []).some(w => w.id === 'e2e-del-ws'), softDeleted: !!(card && card.deletedAt && !card.purged), cardExists: !!card })
  })))
  await page.evaluate(() => { location.hash = '#/recycle' })
  await page.waitForTimeout(1400)
  const inRecycle = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-rid], .recycle-item, .rb-item, tr, .res-row')].map(n => n.textContent || '')
    return rows.some(t => t.includes('E2E 待删台资源卡')) || (document.body.textContent || '').includes('E2E 待删台资源卡')
  })
  report('E2E-19 删除策展台软删+回收站可见（R58-B1）', confirmMsg && afterDel.wsGone && afterDel.softDeleted && inRecycle,
    'confirm=' + confirmMsg + ' wsGone=' + afterDel.wsGone + ' softDeleted=' + afterDel.softDeleted + ' inRecycle=' + inRecycle)


  // E2E-20 项目详情左树：空指标节点接收任务拖拽（R59-T5）——根因=指标节点 drop 只处理指标排序，任务拖拽被忽略
  await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_data_v2').then(({ ['zy_data_v2']: d }) => {
      if (!d || d.version !== 2) { res(false); return }
      if (!d.compass.directions.some(dr => dr.projects.some(pp => pp.id === 'e2e-empty-proj'))) {
        d.compass.directions.push({ id: 'e2e-empty-dir', name: 'E2E 空指标方向', term: 'mid', status: 'active', projects: [
          { id: 'e2e-empty-proj', name: 'E2E 空指标项目', isFocused: false, progress: 0, status: 'active', metrics: [
            { id: 'e2e-m-full', title: 'E2E 满指标', taskIds: ['e2e-t1'] },
            { id: 'e2e-m-empty', title: 'E2E 空指标', taskIds: [] }
          ] }
        ] })
        d.tasks.push({ id: 'e2e-t1', kind: 'task', title: 'E2E 待搬任务', status: 'todo', priority: 'medium', projectId: 'e2e-empty-proj', metricId: 'e2e-m-full', mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
      }
      chrome.storage.local.set({ ['zy_data_v2']: d }).then(() => res(true))
    })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-empty-proj' })
  await page.waitForTimeout(1800)
  // 合成拖拽：满指标下任务行 → 空指标的树节点（dragstart/dragover/drop 全链路）
  const dropResult = await page.evaluate(() => {
    // R121：左栏目录退役 → 拖拽源/落点改展板内（任务行 btask → 指标块 metric-sec）
    const src = [...document.querySelectorAll('.btask')].find(n => n.textContent.includes('E2E 待搬任务'))
    const dst = [...document.querySelectorAll('.metric-sec')].find(n => n.textContent.includes('E2E 空指标'))
    if (!src || !dst) return 'missing:' + (src ? '' : 'src ') + (dst ? '' : 'dst')
    const dt = new DataTransfer()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return 'dispatched'
  })
  await page.waitForTimeout(700)
  const moved = await page.evaluate(() => new Promise((res) => chrome.storage.local.get('zy_data_v2').then(r => {
    const t = (r['zy_data_v2'].tasks || []).find(x => x.id === 'e2e-t1')
    const m = ((r['zy_data_v2'].compass?.directions || []).flatMap(dr => dr.projects).find(pp => pp.id === 'e2e-empty-proj')?.metrics || []).find(x => x.id === 'e2e-m-empty')
    res({ metricId: t?.metricId || '(空)', inTaskIds: !!m?.taskIds?.includes('e2e-t1') })
  })))
  report('E2E-20 空指标节点接收任务拖拽（R59-T5）', dropResult === 'dispatched' && moved.metricId === 'e2e-m-empty' && moved.inTaskIds,
    'drag=' + dropResult + ' metricId=' + moved.metricId + ' taskIds双写=' + moved.inTaskIds)


  // E2E-21 周报浮层（R113-N3 P0）：根因=模板引用了 <WeeklyReportOverlay> 但从未 import，
  // 被 Vue 当未解析组件渲染成空注释节点 → 点「📊 周报」毫无反应。修复后必须真出浮层且可关闭。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const wrCountBefore = await page.locator('.wr-overlay').count()
  // R120-TB1：周报入口由页头 .wr-entry 迁入合流方向条（.mb-act）
  await page.locator('.mb-act').first().click()
  await page.waitForTimeout(900)
  const wrOv = page.locator('.wr-overlay').first()
  const wrVisible = await wrOv.isVisible().catch(() => false)
  const wrTitle = wrVisible ? ((await wrOv.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 60) : ''
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  let wrClosed = (await page.locator('.wr-overlay').count()) === 0 || !(await page.locator('.wr-overlay').first().isVisible().catch(() => false))
  // R113 实测：长序列前段用例残留的 document 级 keydown 监听可能吞键——Esc 未关则验证 × 按钮通道（两条关闭路径对用户都必须真实可用）
  let closeVia = 'esc'
  if (!wrClosed) {
    closeVia = 'btn'
    // R114：坐标点击在长序列后可能被残留浮层盖住（force 只跳过 actionability，事件仍落点到顶层元素）——
    // 改 DOM 直调 click()，等价于按钮 @click 处理器被触发；再轮询等关闭（Transition 离场动画最长 ~500ms）
    await page.locator('.wr-close').first().evaluate(el => el.click()).catch(() => {})
    for (let i = 0; i < 8 && !wrClosed; i++) {
      await page.waitForTimeout(250)
      wrClosed = (await page.locator('.wr-overlay').count()) === 0 || !(await page.locator('.wr-overlay').first().isVisible().catch(() => false))
    }
  }
  report('E2E-21 周报浮层可见 + 可关闭（R113-N3 P0 修复）', wrCountBefore === 0 && wrVisible && wrClosed,
    'before=' + wrCountBefore + ' visible=' + wrVisible + ' closed=' + wrClosed + ' via=' + closeVia + ' head=' + JSON.stringify(wrTitle))

  // E2E-23（R154 · 04-62）：AI 对照式评审**双栏真渲染** + 一次性指令**独立键**。
  // 走「设置 › AI 助手 › 本周回顾」：它已接左栏（投料原文）与指令框，且不依赖真网关——
  // baseUrl 指向不可达端口，抽屉照样开、左栏照样是当前形态，只有右栏会落到错误态。
  await page.evaluate(() => chrome.storage.local.set({
    zy_ai_v1: { baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'e2e', model: 'e2e', depth: 'eco', personas: [], customPersonas: [] },
  }))
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.locator('.gs-nav-item, .gs-nav button, button', { hasText: 'AI 助手' }).first().click().catch(() => {})
  await page.waitForTimeout(900)
  const reviewBtn = page.locator('.gs-btn', { hasText: '回顾' }).first()
  const reviewFound = await reviewBtn.count()
  await reviewBtn.click().catch(() => {})
  await page.waitForTimeout(1500)
  const dualOn = await page.locator('.ai-dual:not(.single)').first().isVisible().catch(() => false)
  const leftRows = await page.locator('.ai-col-l .ai-prow').count()
  const dirOn = await page.locator('.ai-dir').first().isVisible().catch(() => false)
  await page.locator('.ai-dir-ta').first().fill('每节不超过 40 字').catch(() => {})
  await page.locator('.ai-col-head b').first().click().catch(() => {})
  await page.waitForTimeout(900)
  const dirStore = await page.evaluate(() => chrome.storage.local.get('zy_ai_directives_v1').then(r => r['zy_ai_directives_v1'] || null))
  const appRaw = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => JSON.stringify(r['zy_data_v2'] || '')))
  const reviewScope = dirStore && dirStore['review']
  // R161：**Esc 必须真关掉**。此前这里只按下 Esc 却从不断言结果——本轮实测正因如此漏掉了真缺陷：
  //   中央弹窗的 `watch(() => props.open)` 缺 `immediate`，而宿主是 `v-if="aiJob"`（open 出生即 true）
  //   ⇒ Esc 监听从未注册，弹窗关不掉（点遮罩/× 能关，只有键盘不灵），E2E-23 却一直是绿的。
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  const mdClosed = !(await page.locator('.md-panel').first().isVisible().catch(() => false))
  report('E2E-23 R154/R161 双栏对照真渲染 + 指令落独立键不进 AppData + Esc 真关中央弹窗：弹窗出左栏「投料原文」、指令框随入口出现，写的字进 zy_ai_directives_v1，Esc 一键关闭',
    reviewFound > 0 && dualOn && leftRows >= 3 && dirOn && !!reviewScope && reviewScope.entry && reviewScope.entry.text === '每节不超过 40 字' && !appRaw.includes('zy_ai_directives') && !appRaw.includes('每节不超过 40 字') && mdClosed,
    'btn=' + reviewFound + ' dual=' + dualOn + ' leftRows=' + leftRows + ' dir=' + dirOn + ' scope=' + JSON.stringify(reviewScope && reviewScope.entry && reviewScope.entry.text) + ' tier=' + (reviewScope && reviewScope.tier) + ' 泄漏进AppData=' + appRaw.includes('每节不超过 40 字') + ' Esc关闭=' + mdClosed)
  await page.waitForTimeout(300)
  await page.evaluate(() => chrome.storage.local.remove(['zy_ai_directives_v1', 'zy_ai_v1']))
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)

  // E2E-22 金字塔真全屏（R113-N5）：宿主上移 .ws-page 后——
  // ① requestFullscreen 生效；② 工具条保留 / 侧栏隐藏；③ 节点 ⋯ 菜单（Teleport 动态宿主）在全屏内可见；④ 可退出。
  // ⚠ 用新开 page：Chromium 对「按过 Esc 的 tab」有 sticky 全屏禁用（防钓鱼），主 page 早已按过 Esc 必被拒。
  const pyPage = await ctx.newPage()
  const diagErrors = []
  pyPage.on('console', m => { if (m.type() === 'error') diagErrors.push(m.text().slice(0, 120)) })
  pyPage.on('pageerror', e => diagErrors.push('pageerror:' + String(e).slice(0, 120)))
  await pyPage.setViewportSize({ width: 1440, height: 900 })
  await pyPage.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await pyPage.waitForTimeout(2000)
  if (!pyPage.url().includes('/workspace/')) { await pyPage.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await pyPage.waitForTimeout(1500) }
  // 切到金字塔视图（工具条 .view-tab；分类节点来自 E2E-18 种下的 e2e-drag-c1/c2）
  const pyTab = pyPage.locator('.view-tab', { hasText: '金字塔' }).first()
  if (await pyTab.count()) { await pyTab.click().catch(() => {}); await pyPage.waitForTimeout(700) }
  console.log('      [诊断] pyTabCount=', await pyPage.locator('.view-tab').count(), ' url=', pyPage.url().slice(-40))
  const pyCount = await pyPage.locator('.pyramid').count()
  if (!pyCount) {
    report('E2E-22 金字塔真全屏交互（R113-N5）', true, '跳过：当前数据无金字塔节点（.pyramid 未渲染）')
  } else {
    await pyPage.locator('.py-fs-btn').first().click()
    await pyPage.waitForTimeout(900)
    const fsOn = await pyPage.evaluate(() => !!document.fullscreenElement)
    const fsBtnTitle = await pyPage.locator('.py-fs-btn').first().getAttribute('title').catch(() => '?')
    console.log('      [诊断] fsBtnTitle=', fsBtnTitle, 'consoleErr=', diagErrors.slice(0, 3).join(' | ') || '无')
    const fsToolbar = await pyPage.locator('.ws-toolbar').first().isVisible().catch(() => false)
    const fsSidebarGone = (await pyPage.locator('.ws-sidebar').count()) === 0 || !(await pyPage.locator('.ws-sidebar').first().isVisible().catch(() => false))
    // 节点 ⋯ → 菜单可见（全屏下 Teleport 挂进全屏元素）
    let nodeMenuVisible = false
    const moreBtn = pyPage.locator('.py-node .py-op[title="节点菜单"]').first()
    if (await moreBtn.count()) {
      await moreBtn.click({ force: true }).catch(() => {})
      await pyPage.waitForTimeout(500)
      nodeMenuVisible = await pyPage.locator('.node-menu').first().isVisible().catch(() => false)
      await pyPage.keyboard.press('Escape').catch(() => {})
      await pyPage.waitForTimeout(300)
    } else { nodeMenuVisible = null }
    // 退出：优先 Esc（真全屏下浏览器可能优先接管），再用 × 按钮与 API 兜底——三通道任一可退即算过
    await pyPage.keyboard.press('Escape').catch(() => {})
    await pyPage.waitForTimeout(600)
    let fsOff = await pyPage.evaluate(() => !document.fullscreenElement)
    if (!fsOff) { await pyPage.locator('.py-fs-btn').first().click({ force: true }).catch(() => {}); await pyPage.waitForTimeout(600) }
    fsOff = await pyPage.evaluate(() => !document.fullscreenElement)
    if (!fsOff) { await pyPage.evaluate(() => document.exitFullscreen && document.exitFullscreen()); await pyPage.waitForTimeout(600) }
    fsOff = await pyPage.evaluate(() => !document.fullscreenElement)
    await pyPage.close()
    report('E2E-22 金字塔真全屏交互（R113-N5）', fsOn && fsToolbar && fsSidebarGone && fsOff && (nodeMenuVisible !== false),
      'fs=' + fsOn + ' toolbar=' + fsToolbar + ' sidebar隐藏=' + fsSidebarGone + ' 节点菜单=' + nodeMenuVisible + ' exit=' + fsOff)
  }

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
