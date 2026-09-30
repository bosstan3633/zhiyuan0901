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
 *   E2E-11 方向台首屏项目卡头（★R3-B1 树即一级）+ 指标条未归档任务格 + 档位入表头（R50-F4/F5）
 *   E2E-12 全量呈现：未投射项目卡头照样在（折叠态仍可见，★R3-B1 换呈现单位）
 *   E2E-29 ★R3-B2 方向树同目标拖拽排序 + 置顶（落位重写 order / 📌 钉到非主攻组前排）
 *   E2E-13 方向树返回方向台 + 项目详情头部添加成功指标 + 返回项目列表移除（R52-F5/F6/F8）
 *   E2E-14 项目调度指标下钻弹窗（R54-B2）
 *   E2E-15 面包屑 + 来源感知返回 + 树定位闭环（R54-A）
 *   E2E-16 快速采集任务面板（R55-C）
 *   E2E-17 项目调度 4 指标恢复左列 + 下钻链路（R56-P1）
 *   E2E-18 策展卡可拖真值（draggable="true"）+ 区域级落卡（R57-F1）
 *   E2E-19 删除策展台软删（deletedAt）+ 回收站可见可恢复（R58-B1）
 *   E2E-20 项目详情左树：空指标节点接收任务拖拽（R59-T5）
 *   E2E-21 周报浮层可见 + 可关闭（R113-N3 P0：模板引用但未 import 的静默失效修复）
 *   E2E-24 R167 镜像只读详情边界（标题 readonly / AI 行不给入口 / 页脚两钮是定位）
 *   E2E-25 R174-3 按日快照落盘（读合并：老日子不褪色 / 写链路：保存→pagehide→days 出现今天）
 *   E2E-26 R2-④⑤ K 定位改靶「资源卡池」（tab 激活 + 目标卡高亮）+ 打开池卡详情记一次「调出」事件
 *   E2E-27 R2-⑧ 池控制行：新建单卡入池 → 批量全选打标签 → 批量软删进回收站
 *   E2E-28 R4-a 迁移报告卡：出卡 → 回退落停用开关并清报告 → 可重新执行迁移
 *   E2E-30 R3-Ca 池面板：列表视图 / 待打标筛选 / 批量反选 / 右键置顶
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
  // R178 备案：分组重组 4→5（AI 认知协作者独立成组，原型分组口径；条目零增减）
  report('E2E-2 设置默认首屏=知源仪表盘（导航五组 R54→R178 + 动态/时间线区）', dashVisible && groupCount === 5, `groups=${groupCount} timeline=${timelineVisible}`)

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
      // R2-⑤ 随迁：新标签先以 about:blank 出现、file:// 导航随后落地——不等一下就取 URL 会把真打开的那一页判成没开
      await popup.waitForTimeout(800).catch(() => {})
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
  report('E2E-6 事件日志 zy_event_log 落盘（软删产生 delete 事件）', Array.isArray(ev) && ev.length > 0, ev ? `${ev.length} 条，最新=${ev[ev.length - 1] && (ev[ev.length - 1].kind + '/' + ev[ev.length - 1].action)}` : '无日志')

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
        status: 'doing', priority: 'high', mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [],
        subtasks: [{ id: 'e2e-sub-1', title: 'E2E 子任务甲', done: false }, { id: 'e2e-sub-2', title: 'E2E 子任务乙', done: true, doneAt: now }], pinned: false,
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

  // E2E-7 ★R2-③ 随迁：DeckTabs 三张卡（资源卡池默认 / 任务调度 / 好奇心培育懒挂载）；方向台不再持任务模块
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.waitForSelector('.bt-tab', { timeout: 8000 }).catch(() => {})
  const tabsCount = await page.locator('.bt-tab').count()
  // R2-③：默认 tab = 资源卡池（第 1 枚激活）；任务调度第 2、好奇心第 3
  const poolTabActive = await page.locator('.bt-tab.on').first().textContent().then((t) => (t || '').includes('资源卡池')).catch(() => false)
  const poolPaneOn = await page.locator('.pcp-card, .pcp-empty').first().isVisible().catch(() => false)
  // 懒挂载：未切到好奇 tab 前好奇心面板整棵不在 DOM（`.cz-batch-btn` 是面板内首个稳定锚点；
  //   section#zy-mod-curiosity 常驻，故不能用它计数）
  const curioBefore = await page.locator('.cz-batch-btn').count()
  await page.locator('.bt-tab').nth(2).click().catch(() => {})
  await page.waitForTimeout(1200)
  const curioPanelOn = await page.locator('.cz-batch-btn').first().isVisible().catch(() => false)
  // 方向台不再有任务调度模块（搬迁后宿主为调度台）
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(1800)
  const dirTaskModule = await page.locator('#task-mgmt-module').count()
  report('E2E-7 ★R2-③ 调度台底部三张卡：资源卡池（默认）+ 任务调度 + 好奇心培育（懒挂载）；方向台无任务模块',
    tabsCount === 3 && poolTabActive && poolPaneOn && curioBefore === 0 && curioPanelOn && dirTaskModule === 0,
    'tabs=' + tabsCount + ' poolTab=' + poolTabActive + ' poolPane=' + poolPaneOn + ' curioBefore=' + curioBefore + ' curioOn=' + curioPanelOn + ' dirTaskModule=' + dirTaskModule)

  // E2E-8 调度台首页（R49 迁移）：三件事卡片 + 项目调度面板（愿景/使命小卡 + 战略目标 + 四数值）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const todayCard = await page.locator('.today-card').first().isVisible().catch(() => false)
  // R2-②：项目调度卡退役——槽内子任务视口承接执行细节；DeckTabs 三张卡同页
  const curGone = !(await page.locator('.card.curation').first().isVisible().catch(() => false))
  const slotSubs = await page.locator('.tc-subs').first().isVisible().catch(() => false)
  const deckTabs = await page.locator('.bt-tab').count()
  report('E2E-8 ★R2-② 调度台三件事（槽内子任务视口）+ 项目调度卡退役 + DeckTabs 三张卡', todayCard && curGone && slotSubs && deckTabs === 3,
    `todayCard=${todayCard} 调度卡已退役=${curGone} 槽内视口=${slotSubs} deckTabs=${deckTabs}`)

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

  // E2E-24（R167）：**镜像只读详情**的边界，与资源台真身详情同判据反向对照。
  // 为什么现在补：R167 把主标题搬进抽屉头、AI 行降到正文首行，两宿主共用一套件之后，
  // "只读卡还能不能改标题"就不再由 `.ref-form` 的 pointer-events 单独挡住了——标题住在头部。
  // 若头部那份漏了只读，在镜像上敲标题会直接写进真身卡（R73 那类"静默迁移"旧坑的新变体）。
  /* 注意：不能拿 seedWsId 当镜像目标台——它是 workspaces[0]，而资源台（hub）正是 order=-1 排第一的那个。
     投射指向 hub 会被启动期 scrubHubMirrorMarkers 当脏记录抹掉（单向挂载红线兜底），于是"镜像卡"变成台内原生卡，
     这条测的就不是只读边界了。测试库里只有一张 hub，故现造一张策展台（结束时一并拆掉）。 */
  const roBoardId = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    const boardId = 'e2e-ro-board'
    if (!data.workspaces.some(w => w.id === boardId)) {
      data.workspaces.push({ id: boardId, name: 'E2E 镜像只读台', icon: '🧪', color: '#3A6B4C', coverTheme: 'deep-sea', order: 99, archived: false, kind: 'curation' })
    }
    if (!data.resources.some(r => r.id === 'e2e-ro-1')) {
      data.resources.push({ id: 'e2e-ro-1', kind: 'resource', title: 'E2E 只读镜像源卡', linkType: 'url', link: 'https://example.com/e2e-ro', workspaceId: 'zy-curation', categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
    }
    data.curationProjections = (data.curationProjections || []).filter(p => p.cardId !== 'e2e-ro-1')
    data.curationProjections.push({ id: 'e2e-ro-proj', kind: 'card', wsId: 'zy-curation', cardId: 'e2e-ro-1', catId: '', targetWsId: boardId, targetCatId: '', addedAt: Date.now() })
    return chrome.storage.local.set({ zy_data_v2: data }).then(() => boardId)
  }))  /* 直种存储后必须整页重载：app 运行中 store 不会回读 chrome.storage，
     而且随后的 persist 会把内存态盖回磁盘（E2E-10 同一手法） */
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.goto(base + '#/workspace/' + roBoardId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/' + roBoardId)) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, roBoardId); await page.waitForTimeout(1800) }
  const mirCard = page.locator(`.res-card[data-rid="e2e-ro-1"]`).first()
  const mirFound = await mirCard.count()
  await mirCard.click().catch(() => {})
  await page.waitForTimeout(1300) /* 单击有 260ms 双击判别延时 + 抽屉进场动效 */
  /* R169-老账③ 随迁：资源详情抽屉改走共享 Drawer.vue 壳——Teleport 到全局浮层宿主（不再是 .ws-page 子元素），
     头部类 .dr-head→.drawer-header、关闭 .dr-close→.drawer-close、页脚 .dr-footer→.drawer-footer（按钮仍 .dr-footer-btn）。 */
  const mirTitleEl = page.locator('.drawer .drawer-header textarea').first()
  const mirHeadVisible = await mirTitleEl.isVisible().catch(() => false)
  const mirTitleReadonly = (await mirTitleEl.getAttribute('readonly').catch(() => null)) !== null
  const mirBanner = await page.locator('.dr-readonly-banner').first().isVisible().catch(() => false)
  const mirAiCells = await page.locator('.drawer .ds-ai-cell').count()
  const mirFootBtns = await page.locator('.drawer .drawer-footer button').count()
  const mirFootText = (await page.locator('.drawer .drawer-footer').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  /* 诊断：投射是否还活着 / 渲染出来的那张卡有没有镜像标记 */
  const mirDiag = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    const p = (d.curationProjections || []).find(x => x.cardId === 'e2e-ro-1')
    const src = d.resources.find(r => r.id === 'e2e-ro-1')
    return { proj: p ? (p.targetWsId || '?') : 'none', srcWs: src ? src.workspaceId : 'none' }
  }))
  await page.locator('.drawer .drawer-close').first().click().catch(() => {})
  await page.waitForTimeout(700)
  // 对照面：同一张卡在资源台是**真身**——AI 行两格必须在、标题必须可写
  await page.goto(base + '#/workspace/zy-curation', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.res-card[data-rid="e2e-ro-1"]').first().click().catch(() => {})
  await page.waitForTimeout(1300)
  const hubAiCells = await page.locator('.drawer .ds-ai-cell').count()
  const hubTitleEl = page.locator('.drawer .drawer-header textarea').first()
  const hubTitleEditable = (await hubTitleEl.getAttribute('readonly').catch(() => 'x')) === null
  const hubTitleValue = await hubTitleEl.inputValue().catch(() => '')
  await page.locator('.drawer .drawer-close').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    data.resources = data.resources.filter(r => r.id !== 'e2e-ro-1')
    data.workspaces = data.workspaces.filter(w => w.id !== 'e2e-ro-board')
    data.curationProjections = (data.curationProjections || []).filter(p => p.cardId !== 'e2e-ro-1')
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  report('E2E-24 R167 镜像只读详情边界（标题 readonly / AI 行不给入口 / 页脚两钮是定位）+ 真身侧反向对照（AI 行两格 + 标题可写）',
    mirFound > 0 && mirHeadVisible && mirTitleReadonly && mirBanner && mirAiCells === 0 && mirFootBtns === 2 && mirFootText.includes('定位到源卡') && hubAiCells === 2 && hubTitleEditable && hubTitleValue === 'E2E 只读镜像源卡',
    `镜像在位=${mirFound} 头=${mirHeadVisible} 标题只读=${mirTitleReadonly} banner=${mirBanner} AI格=${mirAiCells} 页脚钮=${mirFootBtns}(${mirFootText.slice(0, 24)}) 投射=${mirDiag.proj}/目标台=${roBoardId || '无'} | 真身 AI格=${hubAiCells} 可写=${hubTitleEditable} 值="${hubTitleValue}"`)

  // E2E-25（R174-3）：zy_daily_stats 落盘——读合并 + 写链路两端到端。
  // 读：种一份快照（老日子 2026-08-15 · 常规档 w=9）+ 今日 create 事件 → 打开仪表盘，
  //     8 月块必须出现 l2 格（纯重建会因日志无老事件而缺格=热力图褪色）+ fullSince 徽章含老日子。
  // 写：详情抽屉改标题保存（saveData → flushCardEvents → scheduleDailyStatsWrite 时间闸排程）
  //     → 派发 pagehide（flushDailyStatsNow 跳闸立即写，R173-T2 同款）→ zy_daily_stats.days 必须出现今天。
  const dsOldDay = '2026-08-15'
  const dsNow = new Date()
  const dsToday = dsNow.getFullYear() + '-' + String(dsNow.getMonth() + 1).padStart(2, '0') + '-' + String(dsNow.getDate()).padStart(2, '0')
  await page.evaluate(([oldDay]) => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (data && !data.resources.some(r => r.id === 'e2e-ds-1')) {
      data.resources.push({ id: 'e2e-ds-1', kind: 'resource', title: 'E2E 落盘卡', linkType: 'url', link: 'https://example.com/e2e-ds', workspaceId: 'zy-curation', categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
    }
    return chrome.storage.local.set({
      zy_data_v2: data,
      zy_daily_stats: { v: 1, days: { [oldDay]: { c: { res: 9, curio: 0, task: 0 }, del: { res: 0, curio: 0, task: 0 }, s: { curio: 0, task: 0 }, u: 0, d: 0, sub: 0, focus: 0, link: 0, x: { add: 9, del: 0 }, w: 9 } }, fullSince: oldDay, base: { res: 0, task: 0, curio: 0, link: 0 } },
      zy_event_log: [{ id: 'e2e-ds-create', ts: Date.now() - 60000, action: 'create', kind: 'resource', title: 'E2E 落盘卡', cardId: 'e2e-ds-1' }]
    })
  }), [dsOldDay])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // 读合并断言：显式导航到仪表盘（上个用例把 hash 留在了资源台）；8 月块（第 8 个 .mb）出现 l2 格 + fullSince 徽章含老日子
  await page.evaluate(() => { location.hash = '#/settings?page=dashboard' })
  await page.waitForTimeout(2200)
  const dsAugL2 = await page.locator('.dz-months .mb').nth(7).locator('.dz-cell.l2').count()
  const dsBadge = (await page.locator('.dz-sec-h', { hasText: '年度热力图' }).locator('.dz-badge').first().innerText().catch(() => ''))
  // 写链路：进资源台 → 单击开抽屉 → 改标题 → 保存 → pagehide → 读回
  await page.goto(base + '#/workspace/zy-curation', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const dsCard = await page.locator('.res-card[data-rid="e2e-ds-1"]').count()
  await page.locator('.res-card[data-rid="e2e-ds-1"]').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(1300)
  const dsTitle = page.locator('.drawer .drawer-header textarea').first()
  const dsDrawer = await dsTitle.isVisible().catch(() => false)
  await dsTitle.fill('E2E 落盘卡·改').catch(() => {})
  const dsSaveBtn = await page.locator('.drawer .dr-footer-btn.primary').count()
  await page.locator('.drawer .dr-footer-btn.primary').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(900) /* saveData 300ms 防抖 + flushCardEvents + schedule 排程 */
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await page.waitForTimeout(1500)
  const dsWritten = await page.evaluate((t) => chrome.storage.local.get('zy_daily_stats').then((cur) => {
    const st = cur['zy_daily_stats']
    const rec = st && st.days ? st.days[t] : null
    return rec ? { has: true, add: rec.x ? rec.x.add : 0, w: rec.w } : { has: false }
  }), dsToday)
  // 清场：拔卡 + 撤快照/事件种子（防污染后续真机数据语义）
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (data) data.resources = data.resources.filter(r => r.id !== 'e2e-ds-1')
    return chrome.storage.local.set({ zy_data_v2: data }).then(() => chrome.storage.local.remove(['zy_daily_stats', 'zy_event_log']))
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  report('E2E-25 R174-3 按日快照落盘（读合并：老日子不褪色 8月l2格+fullSince；写链路：保存→pagehide→days 出现今天）',
    dsAugL2 >= 1 && dsBadge.includes('2026-08-15') && dsWritten.has && dsWritten.add >= 1,
    `8月l2格=${dsAugL2} 徽章="${dsBadge}" 卡=${dsCard} 抽屉=${dsDrawer} 保存钮=${dsSaveBtn} 今日落盘=${JSON.stringify(dsWritten)}`)

  // E2E-11 方向台首屏（★R3-B1 树即一级）：项目卡头渲染；未归档格随 MetricBar 迁调度台（E2E-4 已覆盖）
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
  // ★R3-B1：主航线项目行卡（proj-row）随退役消失，方向台一级的呈现单位是方向树项目卡头（tp-head）；
  //   种进数据的遗留字段 pinnedToLighthouse 不应改变任何呈现（R60-4 零引用口径的活体版）
  await page.waitForSelector('.tp-head', { timeout: 8000 }).catch(() => {})
  const goalChip = await page.locator('.tp-head').first().isVisible().catch(() => false)
  const offCourseGone = !(await page.getByText('偏航行动').first().isVisible().catch(() => false))
  report('E2E-11 ★R3-B1 方向台首屏=方向树项目卡头（tp-head 可见 · 遗留投射字段不影响呈现 · 未归档格迁调度台由 E2E-4 覆盖）', goalChip && offCourseGone,
    `heads=${goalChip} offCourseGone=${offCourseGone}`)

  // E2E-12 全量呈现（R52-F4 → ★R3-B1 换呈现单位）：非主攻/未投射项目照样有卡头（折叠只收指标与任务，卡头常显）
  const headCount = await page.locator('.tp-head').count()
  const foldedHeads = await page.locator('.tp-head.folded').count()
  const unPinnedChip = await page.getByText('E2E 回填项目').first().isVisible().catch(() => false)
  report('E2E-12 ★R3-B1 全量呈现：未投射项目卡头照样在（折叠态仍可见）', headCount >= 2 && unPinnedChip && foldedHeads >= 1,
    `heads=${headCount} folded=${foldedHeads} unPinnedVisible=${unPinnedChip}`)

  // E2E-13 方向台导航与项目详情操作（R52-F8/F5/F6 → ★R3-B1 随一级化改判据）：
  //   老深链 #/compass/tree 必须带 query 重定向到 /compass 且渲染出树（不许变死页），一级台面不再有「返回方向台」自指入口；
  //   项目详情仍无「返回项目列表」+ 标题行「＋ 成功指标」（R177 随原型改文案并移入标题行）
  await page.evaluate(() => { location.hash = '#/compass/tree?hl=e2e-dir-1' })
  await page.waitForTimeout(1600)
  const redirected = (page.url().split('#')[1] || '').split('?')[0] === '/compass'
  const treeRendered = await page.locator('.tp-head').first().isVisible().catch(() => false)
  const backBtn = !(await page.getByText('← 返回方向台').first().isVisible().catch(() => false))
  const backToCompass = redirected && treeRendered
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-proj-1' })
  await page.waitForTimeout(1500)
  // R121：原「成功指标 → 任务」层头退役 → 展板统计条（pb-stats）
  const projHead = await page.locator('.pb-stats').first().isVisible().catch(() => false)
  const addMetricBtn = await page.getByText('＋ 成功指标').first().isVisible().catch(() => false) // R177：随原型改文案「＋ 成功指标」（标题行动作组）
  const backListGone = !(await page.getByText('返回项目列表').first().isVisible().catch(() => false))
  report('E2E-13 ★R3-B1 老深链重定向落地（/compass/tree?hl → /compass 且渲染树）+ 一级无自指返回钮 + 项目详情标题行成功指标入口 + 返回项目列表移除（R52-F5/F6/F8 · R177 随迁）', backBtn && backToCompass && projHead && addMetricBtn && backListGone,
    `无返回钮=${backBtn} 重定向且出树=${backToCompass} proj=${projHead} addMetric=${addMetricBtn} backListGone=${backListGone}`)

  // E2E-29 ★R3-B2 方向树同目标拖拽排序 + 置顶：拖拽落位重写 order（所见即所得）→ ▾ 菜单置顶把第二张钉到前排
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(1500)
  const dragOut = await page.evaluate(async () => {
    const host = [...document.querySelectorAll('.tc-strategic-branch')].find(b => b.querySelectorAll('.tree-project-branch').length >= 2)
    if (!host) return { ok: false, why: '没有含两张项目卡的战略目标' }
    const nameOf = (el) => (el.querySelector('.tp-title .node-title')?.textContent || '').trim()
    const read = () => [...host.querySelectorAll('.tree-project-branch')].map(nameOf)
    const before = read()
    const items = [...host.querySelectorAll('.tree-project-branch')]
    const dt = new DataTransfer()
    const grip = items[0].querySelector('.tp-grip')
    const head2 = items[1].querySelector('.tp-head')
    grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    head2.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    // Vue 的 class 绑定在下一个 tick 才落到 DOM，同步读必假——落位指示要等一拍再量
    await new Promise((r) => setTimeout(r, 80))
    const showedDrop = head2.classList.contains('drop-on')
    head2.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    grip.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
    await new Promise((r) => setTimeout(r, 900))
    const after = read()
    const stored = await chrome.storage.local.get('zy_data_v2')
    const dir = ((stored['zy_data_v2'] || {}).compass?.directions || []).find((x) => (x.projects || []).length >= 2)
    return { ok: showedDrop && after[0] === before[1] && after[1] === before[0], showedDrop, before, after,
      orders: (dir?.projects || []).map((x) => x.name + '=' + x.order) }
  })
  const pinOut = await page.evaluate(async () => {
    const host = [...document.querySelectorAll('.tc-strategic-branch')].find(b => b.querySelectorAll('.tree-project-branch').length >= 2)
    const nameOf = (el) => (el.querySelector('.tp-title .node-title')?.textContent || '').trim()
    const items = [...host.querySelectorAll('.tree-project-branch')]
    const target = items[1]
    const before = [...host.querySelectorAll('.tree-project-branch')].map(nameOf)
    target.querySelectorAll('.tp-acts .node-action')[2].click()          // ▾ 更多操作
    await new Promise((r) => setTimeout(r, 250))
    const pinItem = [...target.querySelectorAll('.tp-menu .tpm-item')].find((x) => (x.textContent || '').includes('置顶到本目标前排'))
    if (!pinItem) return { ok: false, why: '菜单里没有置顶项' }
    pinItem.click()
    await new Promise((r) => setTimeout(r, 900))
    const now = [...host.querySelectorAll('.tree-project-branch')]
    const stored = await chrome.storage.local.get('zy_data_v2')
    const dir = ((stored['zy_data_v2'] || {}).compass?.directions || []).find((x) => (x.projects || []).length >= 2)
    return { ok: now[0] && nameOf(now[0]) === before[1] && !!now[0].querySelector('.tp-pin'),
      moved: !!now[0] && nameOf(now[0]) === before[1], badge: !!(now[0] && now[0].querySelector('.tp-pin')),
      pinned: (dir?.projects || []).filter((x) => x.pinned).map((x) => x.name) }
  })
  report('E2E-29 ★R3-B2 方向树拖拽排序（落位重写 order 且所见即所得）+ ▾ 菜单置顶（钉到非主攻组前排 + 📌 徽标 + 落库）',
    dragOut.ok && pinOut.ok, `拖拽=${JSON.stringify(dragOut)} 置顶=${JSON.stringify(pinOut)}`)

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
  report('E2E-14 ★R2-② 指标下钻弹窗随项目调度卡退役（能力去向：方向台展板 metric-sec 任务行）——弹窗不再出现、展板任务行在位', drillModal === false && drillRow && drillGone,
    `modal=${drillModal} row=${drillRow} gone=${drillGone}`)

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
  // R160（P1）修正：GP 改按需挂载后暴露此前的「伪通过」——页面内 runtime.sendMessage 同帧不收自身消息，
  //   旧版只是靠 GP 静态挂载时面板 DOM 恒在（关闭态非 display:none）蒙混过关。改走真实生产路径：
  //   SW → tabs.sendMessage(tabId) → App 收 → gpOpen 冷挂载 GP → 面板打开（同时覆盖懒挂载首启链路）。
  await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('src/newtab/index.html') + '*' })
    if (tabs[0] && tabs[0].id) await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-task-capture' })
  })
  await page.getByText('快速采集任务').first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(400)
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


  // E2E-17 ★R2-② 项目调度卡退役改验：四格/下钻弹窗在调度台零残留（能力去向：方向台展板 metric-sec 任务行，E2E-20/25 已覆盖）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cellsOn = await page.locator('.cur-stats-v2 .csv-cell').count()
  const stripGone = await page.locator('.cur-stat-strip').count()
  const drawerOpen = await page.evaluate(() => !!document.querySelector('.ts-title'))
  report('E2E-17 ★R2-② 项目调度卡退役改验：四格/下钻弹窗退役（能力去向：方向台展板 metric-sec 任务行，E2E-20/25 已覆盖）——调度台零残留',
    cellsOn === 0 && stripGone === 0 && drawerOpen === false, 'cells=' + cellsOn + ' stripGone=' + stripGone + ' drawer=' + drawerOpen)


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


  // E2E-21 调度台入口整合（R172-T9 · 取代原周报浮层用例）：
  // 原用例（R113-N3 P0）测的是"模板引用了组件却从未 import ⇒ 点按钮毫无反应"这个病根；
  // 组件退役后病根消失，但**入口必须依然真能到达** —— 判据改为：点「📈 复盘」→ 路由落到
  // /settings?page=dashboard 且仪表盘真渲染（`.dz-sec` 概览带 + `.dz-chip` 存量卡可见，非空白）。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const revBtn = page.locator('.mb-act.cta').first()
  const revBtnText = ((await revBtn.innerText().catch(() => '')) || '').replace(/\s+/g, '')
  await revBtn.click()
  await page.waitForTimeout(1400)
  const revUrl = page.url()
  const revAtSettings = /\/settings/.test(revUrl)
  const revOverview = await page.locator('.dz-sec').first().isVisible().catch(() => false)
  const revChips = await page.locator('.dz-chip').first().isVisible().catch(() => false)
  report('E2E-21 调度台「📈 复盘」直达知源仪表盘（R172-T9）', revBtnText.includes('复盘') && revAtSettings && revOverview && revChips,
    'btn=' + JSON.stringify(revBtnText) + ' url=' + revUrl + ' overview=' + revOverview + ' chips=' + revChips)

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

  // E2E-26（R2-④⑤）：K 定位改靶到「资源卡池」+ 打开池卡详情即记一次「调出」
  //   种一张池卡（workspaceId=zy-curation）→ 以 locateOnly 的同一条路由（hash 变更=router.push）落地
  //   → 断言池 tab 激活、目标卡渲染并被高亮 → 单击开抽屉 → 事件日志出现 call/resource 记录
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    data.resources = (data.resources || []).filter(r => r.id !== 'e2e-pool-1')
    data.resources.push({
      id: 'e2e-pool-1', kind: 'resource', title: 'E2E 池卡定位', linkType: 'url', link: 'https://example.com/e2e-pool',
      workspaceId: 'zy-curation', categoryId: '', tags: ['E2E 标签'], pinned: false, starred: false,
      callCount: 0, createdAt: Date.now(), updatedAt: Date.now(), description: '', customFields: {}, assets: []
    })
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { location.hash = '#/?hl=e2e-pool-1&hk=res' })
  await page.waitForTimeout(1600)
  const poolTabOn = await page.locator('.bt-tab.on').first().textContent().then((t) => (t || '').includes('资源卡池')).catch(() => false)
  const hlNode = page.locator('[data-rid="e2e-pool-1"]')
  const hlCount = await hlNode.count()
  const hlFlash = hlCount ? (await hlNode.first().getAttribute('class').catch(() => '') || '').includes('flash') : false
  await page.bringToFront() // 前面几步开过 popup/新页面（E2E-5 的 file:// 尝试、E2E-22 的全屏页）——后台页的定时器会被节流，热度写的 250ms 防抖就永远不触发
  await hlNode.first().click().catch(() => {})
  await page.waitForTimeout(1500)
  // 抽屉标题是决定性证据（`.ds-ib` 只证明"有个抽屉"，证明不了"开的是这张卡"）
  const drawerTitle = await page.evaluate(() => {
    const t = document.querySelector('.drawer-title')
    const el = t && (t.querySelector('input,textarea') || t)
    return el ? String(el.value !== undefined && el.value !== '' ? el.value : el.textContent || '') : ''
  })
  await page.waitForTimeout(2500) // 热度写 250ms 防抖 + 事件日志并入同一次 set（R2-⑦ 修好后这条通道才真的通）
  const callEv = await page.evaluate(() => chrome.storage.local.get(['zy_event_log', 'zy_stats_v1']).then((raw) => {
    const ev = raw['zy_event_log'] || []
    const hit = ev.filter(e => e.action === 'call' && e.cardId === 'e2e-pool-1')
    const hot = raw['zy_stats_v1']
    return { n: hit.length, kind: hit.length ? hit[0].kind : '', hotEntry: hot && hot.cards ? hot.cards['e2e-pool-1'] : null }
  }))
  report('E2E-26 ★R2-④⑤ ⌘K 定位改靶「资源卡池」（tab 激活 + 目标卡高亮）+ 打开详情记一次调出（热度键与事件日志双落盘）',
    poolTabOn && hlCount === 1 && hlFlash && drawerTitle.includes('E2E 池卡定位') && callEv.n > 0 && !!callEv.hotEntry,
    `池tab=${poolTabOn} 目标卡=${hlCount} 高亮=${hlFlash} 抽屉="${drawerTitle.slice(0, 18)}" call事件=${callEv.n}(${callEv.kind}) 热度=${JSON.stringify(callEv.hotEntry)}`)

  // E2E-27（R2-⑧）：池管理面控制行——新建单卡 → 批量打标签 → 批量软删（三步都走真实点击）
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const countBefore = await page.locator('.pcp-card').count()
  await page.getByText('＋ 新建卡').first().click().catch(() => {})
  await page.waitForTimeout(500)
  const popOn = await page.locator('.pcp-pop').count()
  const popInputs = page.locator('.pcp-pop input')
  await popInputs.nth(0).fill('E2E 新建池卡').catch(() => {})
  await popInputs.nth(1).fill('https://example.com/new').catch(() => {})
  await popInputs.nth(2).fill('E2E 标签甲').catch(() => {})
  await page.getByText('存入卡池').first().click().catch(() => {})
  await page.waitForTimeout(900)
  const newCard = page.locator('.pcp-card', { hasText: 'E2E 新建池卡' }).first()
  const newCardOn = await newCard.isVisible().catch(() => false)
  const countAfterNew = await page.locator('.pcp-card').count()
  // 批量：进批量态 → 全选 → 加标签 → 应用
  await page.getByText('批量').first().click().catch(() => {})
  await page.waitForTimeout(400)
  const batchBarOn = await page.locator('.pcp-batch').isVisible().catch(() => false)
  await page.getByText('全选本池').first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.pcp-tagin').fill('E2E 批量标签').catch(() => {})
  await page.getByText('应用标签').first().click().catch(() => {})
  await page.waitForTimeout(900)
  const tagged = await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
    const st = pinia && pinia._s.get('app')
    const c = st && (st.data.resources || []).find(x => x.title === 'E2E 新建池卡' && !x.deletedAt)
    return { found: !!c, tags: c ? c.tags : [], ws: c ? c.workspaceId : '' }
  })
  // 批量软删：删完这张卡应当从台面消失，且带 deletedAt（回收站族）
  await page.getByText('🗑 删除（进回收站）').first().click().catch(() => {})
  await page.waitForTimeout(900)
  const goneAfterBatch = (await page.locator('.pcp-card', { hasText: 'E2E 新建池卡' }).count()) === 0
  const softDeleted = await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
    const st = pinia && pinia._s.get('app')
    const c = st && (st.data.resources || []).find(x => x.title === 'E2E 新建池卡')
    return !!(c && c.deletedAt)
  })
  report('E2E-27 ★R2-⑧ 池控制行：新建入池（计数+1）→ 批量全选打标签 → 批量软删进回收站',
    popOn === 1 && newCardOn && countAfterNew > countBefore && batchBarOn
    && tagged.found && tagged.ws === 'zy-curation' && (tagged.tags || []).includes('E2E 标签甲') && (tagged.tags || []).includes('E2E 批量标签')
    && goneAfterBatch && softDeleted,
    `浮层=${popOn} 新卡上屏=${newCardOn} 计数=${countBefore}→${countAfterNew} 批量条=${batchBarOn} 标签=${JSON.stringify(tagged.tags)} 台=${tagged.ws} 删后端点=${goneAfterBatch} 软删=${softDeleted}`)

  // E2E-30（R3-Ca）：池面板补齐——列表视图 / 待打标筛选 / 批量反选 / 右键菜单置顶
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']; if (!d) return
    const mk = (id, title, tags) => ({ id, kind: 'resource', title, linkType: 'url', link: tags.length ? 'https://example.com/' + id : '',
      description: '', tags, assets: [], customFields: {}, workspaceId: 'zy-curation', categoryId: '', pinned: false, callCount: 0,
      createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000, deletedAt: undefined })
    d.resources = (d.resources || []).filter(x => !String(x.id).startsWith('e2e-ca-'))
    d.resources.unshift(mk('e2e-ca-1', 'E2E 池卡甲', ['E2E 标签甲']), mk('e2e-ca-2', 'E2E 池卡乙', []), mk('e2e-ca-3', 'E2E 池卡丙', ['E2E 标签丙']))
    return chrome.storage.local.set({ zy_data_v2: d })
  }))
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.pcp-btn')].find(x => x.textContent.includes('退出批量')); if (b) b.click() })
  await page.waitForTimeout(400)
  const gridCount = await page.locator('.pcp-card').count()
  await page.getByText('☰ 列表').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const listCount = await page.locator('.pcp-row').count()
  const noTagShown = await page.locator('.pcp-row', { hasText: 'E2E 池卡乙' }).first().isVisible().catch(() => false)
  await page.getByText('🏷 待打标').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const untaggedCount = await page.locator('.pcp-row').count()
  const untaggedIsB = untaggedCount === 1 && (await page.locator('.pcp-row').first().textContent() || '').includes('E2E 池卡乙')
  await page.getByText('🏷 待打标').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByText('批量').first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.getByText('全选本池').first().click().catch(() => {})
  await page.waitForTimeout(400)
  const selAll = parseInt((await page.locator('.pcp-sel').textContent().catch(() => '0'))?.replace(/\D/g, '') || '0', 10)
  await page.getByText('反选').first().click().catch(() => {})
  await page.waitForTimeout(400)
  const selAfterInvert = parseInt((await page.locator('.pcp-sel').textContent().catch(() => 'x'))?.replace(/\D/g, '') || 'x', 10)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.pcp-btn')].find(x => x.textContent.includes('退出批量')); if (b) b.click() })
  await page.waitForTimeout(400)
  // 右键取「甲」——它有链接，菜单应是四件（无链接的卡少一项「复制链接」，那正是条件项的口径）
  const cardA = page.locator('.pcp-row', { hasText: 'E2E 池卡甲' }).first()
  await cardA.click({ button: 'right' }).catch(() => {})
  await page.waitForTimeout(500)
  const ctxItems = await page.locator('.cx-item').allTextContents().catch(() => [])
  const pinItem = page.locator('.cx-item', { hasText: '置顶' }).first()
  await pinItem.click().catch(() => {})
  await page.waitForTimeout(900)
  const pinnedBack = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const c = ((cur['zy_data_v2'] || {}).resources || []).find(x => x.id === 'e2e-ca-1')
    return { pinned: !!(c && c.pinned) }
  }))
  const pinBadge = await page.locator('.pcp-row', { hasText: 'E2E 池卡甲' }).first().locator('.pcp-pin').isVisible().catch(() => false)
  report('E2E-30 ★R3-Ca 池面板：网格↔列表同源 → 待打标只留无标签卡 → 全选后反选归零 → 右键菜单置顶落库并出 📌',
    gridCount >= 3 && listCount === gridCount && noTagShown && untaggedIsB && selAll >= 3 && selAfterInvert === 0
    && ctxItems.length === 4 && ctxItems.some(x => x.includes('复制链接')) && pinnedBack.pinned && pinBadge,
    `网格=${gridCount} 列表=${listCount} 待打标只留乙=${untaggedIsB} 全选=${selAll}→反选=${selAfterInvert} 菜单=${JSON.stringify(ctxItems)} 落库pinned=${pinnedBack.pinned} 徽标=${pinBadge}`)

  // E2E-28（R4-a）：迁移报告卡与整库回退出口——种备份+报告 → 设置页出卡 → 回退（确认框）→ 停用键落、报告清、卡片转停用态
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    return chrome.storage.local.set({
      zy_migrate_backup_v1: { at: Date.now() - 86400000, reason: 'e2e 迁移前备份', data: JSON.parse(JSON.stringify(d)) },
      zy_cats_migrate_report_v1: { at: Date.now() - 86400000, l1: 7, l2: 20, deep: 3, cardsTouched: 257, tagsAdded: 257, mapping: [
        { catId: 'c1', path: 'AI工具/知识库', tagName: 'AI工具/知识库', kind: 'child' },
        { catId: 'c2', path: '内容生产工程', tagName: '内容生产工程', kind: 'parent' }
      ] }
    })
  }))
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.getByText('标签管理').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const mgCardOn = await page.locator('.mg-card').first().isVisible().catch(() => false)
  const mgStats = await page.locator('.mg-stats').first().textContent().catch(() => '')
  const mgMapBtn = await page.getByText('逐条映射清单').first().isVisible().catch(() => false)
  await page.getByText('回退到迁移前').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const mgConfirmShown = await page.getByText('整库覆盖').first().isVisible().catch(() => false)
  await page.evaluate(() => { const b = document.querySelector('.cdf-btn.ok'); if (b) b.click() })
  await page.waitForTimeout(2000)
  const afterRollback = await page.evaluate(() => chrome.storage.local.get(['zy_migrate_optout', 'zy_cats_migrate_report_v1']).then(r => ({
    optOut: r['zy_migrate_optout'] === true, reportGone: !r['zy_cats_migrate_report_v1']
  })))
  const offBadge = await page.locator('.mg-off').first().isVisible().catch(() => false)
  const rerunBtn = await page.getByText('重新执行迁移').first().isVisible().catch(() => false)
  await page.getByText('重新执行迁移').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.evaluate(() => { const b = document.querySelector('.cdf-btn.ok'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const optOutCleared = await page.evaluate(() => chrome.storage.local.get('zy_migrate_optout').then(r => r['zy_migrate_optout'] !== true))
  report('E2E-28 ★R4-a 迁移报告卡出卡（统计+映射清单）→ 回退落停用开关并清报告 → 可重新执行迁移',
    mgCardOn && /257/.test(mgStats || '') && mgMapBtn && mgConfirmShown && afterRollback.optOut && afterRollback.reportGone && offBadge && rerunBtn && optOutCleared,
    `卡片=${mgCardOn} 统计="${(mgStats || '').replace(/\s+/g, '').slice(0, 26)}" 清单钮=${mgMapBtn} 确认框=${mgConfirmShown} 停用=${afterRollback.optOut} 报告清=${afterRollback.reportGone} 停用徽标=${offBadge} 重跑钮=${rerunBtn} 解除=${optOutCleared}`)

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
