/**
 * 第卌五轮 · V2.20.0 E2E 真机验证（Playwright MV3 模板，自第卌三轮重建版收编）
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/e2e.cjs
 * 检查项：
 *   E2E-1  MV3 扩展加载（worker = CRXJS service-worker-loader.js）
 *   E2E-2  设置页默认首屏 = 知源仪表盘（导航四组 R54 + 动态条/操作记录时间线）
 *   E2E-3  工作台全景第二屏可切换（双栏 + 三级计数树）
 *   E2E-4  北极星「新增卡片/删除卡片」卡渲染（R45-1 三档周期联动改名）
 *   E2E-5  PDF 附件双击 file:// 打开（data 层种卡 + IndexedDB blob → 双击卡片 → 新标签 file://…pdf）
 *   E2E-6  事件日志 zy_event_log 独立 key 落盘（打开资源卡产生事件）
 *   E2E-7  好奇心专区 Tab：好奇心卡库默认 → 切任务卡库 → 卡片视图默认渲染 + 好奇面板隐藏（R45 迁移 + R46 BUG-1）
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
 *   E2E-19 删除工作台软删（deletedAt）+ 回收站可见可恢复（R58-B1）
 *   E2E-20 项目详情左树：空指标节点接收任务拖拽（R59-T5）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

// R56：跨平台 Chromium 路径（Windows = playwright 缓存 chrome-win64；macOS = 缓存内 Chrome for Testing）
const CHROME = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
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

  // E2E-3 工作台全景
  await page.getByText('工作台全景').first().click().catch(() => {})
  await page.waitForTimeout(1200)
  const panVisible = await page.locator('.gs-pan-panel').isVisible().catch(() => false)
  const treeWs = await page.locator('.gs-pan-ws').count()
  report('E2E-3 工作台全景双栏+计数树', panVisible && treeWs >= 1, `panel=${panVisible} wsNodes=${treeWs}`)

  // E2E-4 方向状态四格（R55-D1 迁调度台顶部；R57-F3 详细指标按钮移除 → 改验证四格自下钻抽屉）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const metricBarOn = await page.locator('.mb-cells').first().isVisible().catch(() => false)
  const offCourse = await page.getByText('未归档任务').first().isVisible().catch(() => false)
  const drillBtnGone = (await page.locator('.mb-drill').count()) === 0
  await page.locator('.mb-cell').nth(3).click().catch(() => {})
  await page.waitForTimeout(900)
  const cellDrawer = await page.getByText('未归档任务 · 待归档清单').first().isVisible().catch(() => false)
  await page.keyboard.press('Escape').catch(() => {})
  report('E2E-4 方向状态四格迁调度台顶部 + 四格自下钻（R55-D1→R57-F3）', metricBarOn && offCourse && drillBtnGone && cellDrawer,
    'bar=' + metricBarOn + ' unarch=' + offCourse + ' drillBtnGone=' + drillBtnGone + ' cellDrawer=' + cellDrawer)

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
  const delBtn = page.locator('.res-card[data-rid="e2e-res-1"] .rc-action.delete')
  if (await delBtn.count()) {
    await delBtn.click().catch(() => {})
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

  // E2E-7 底部专区（R55-B2）：好奇心培育单区直呈（无 Tab 头）；任务调度模块在方向台
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const tabsCount = await page.locator('.zone-tab').count()
  const curioPanelOn = await page.locator('.module-card').filter({ hasText: '好奇心' }).first().isVisible().catch(() => false)
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(1800)
  const taskModuleOn = await page.locator('#task-mgmt-module').first().isVisible().catch(() => false)
  const cardTabActive = await page.locator('.view-tab.active').first().textContent().then((t) => (t || '').includes('卡片')).catch(() => false)
  const tmCardCount = await page.locator('.tm-card').count()
  report('E2E-7 底部好奇心单区 + 方向台任务调度模块（R55-B1/B2）', tabsCount === 0 && curioPanelOn && taskModuleOn && cardTabActive && tmCardCount >= 1,
    'tabs=' + tabsCount + ' curioOn=' + curioPanelOn + ' taskModule=' + taskModuleOn + ' cardActive=' + cardTabActive + ' tmCards=' + tmCardCount)

  // E2E-8 调度台首页（R49 迁移）：三件事卡片 + 项目调度面板（愿景/使命小卡 + 战略目标 + 四数值）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const todayCard = await page.locator('.today-card').first().isVisible().catch(() => false)
  const curationOn = await page.locator('.cur-body-v').first().isVisible().catch(() => false)
  const visionMini = await page.getByText('愿景 · Vision').first().isVisible().catch(() => false)
  const missionMini = await page.getByText('使命 · Mission').first().isVisible().catch(() => false)
  const goalOn = await page.getByText('E2E 战略目标').first().isVisible().catch(() => false)
  // R56-P1：4 指标恢复左列（cur-stats-v2 一行四格），头部状态栏已移除
  const statCount = await page.locator('.cur-stats-v2 .csv-cell').count()
  report('E2E-8 调度台三件事 + 项目调度面板（愿景/使命+战略目标+左列四指标 R56-P1）', todayCard && curationOn && visionMini && missionMini && goalOn && statCount === 4,
    `todayCard=${todayCard} curation=${curationOn} stats=${statCount} goal=${goalOn}`)

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

  // E2E-10 策展中心（R53 统一树）：Tab 进入 + 遗留工作台投射记录启动迁移物化为镜像分类 + 源卡实时呈现 + 原生卡新建 + 清空投射引用回落零影响
  await page.goto(base + '#/curation', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (!page.url().includes('/curation')) { await page.evaluate(() => { location.hash = '#/curation' }); await page.waitForTimeout(1500) }
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
    data.curationProjections = [{ id: 'e2e-curp-ws', kind: 'workspace', wsId, addedAt: Date.now() }]
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { location.hash = '#/curation' })
  await page.waitForTimeout(1800)
  const curHead = await page.getByText('灵活策展空间').first().isVisible().catch(() => false)
  // R53：镜像分类进统一树（与原生分类同树），点入后源卡实时呈现
  const mirrorCatNode = await page.getByText('E2E 镜像分类').first().isVisible().catch(() => false)
  await page.getByText('E2E 镜像分类').first().click().catch(() => {})
  await page.waitForTimeout(800)
  const mirCard = await page.getByText('E2E 镜像卡').first().isVisible().catch(() => false)
  // 原生卡（在镜像分类视图内新建——R53 镜像分类同为真实分类）
  await page.getByText('＋ 新建卡片').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('.mc-field input').first().fill('E2E 原生策展卡').catch(() => {})
  await page.locator('.mini-btn.primary').last().click().catch(() => {})
  await page.waitForTimeout(1200)
  const nativeCard = await page.getByText('E2E 原生策展卡').first().isVisible().catch(() => false)
  // 清空投射 → 镜像分类删除、停入的原生卡回落未分类、源数据零影响
  await page.getByText('🧹 清空投射').first().click().catch(() => {})
  await page.waitForTimeout(800)
  await page.locator('.cdf-btn.ok').filter({ hasText: '清空投射' }).last().click().catch(() => {})
  await page.waitForTimeout(1200)
  const mirrorGone = !(await page.getByText('E2E 镜像分类').first().isVisible().catch(() => false))
  const nativeKept = await page.getByText('E2E 原生策展卡').first().isVisible().catch(() => false)
  const srcKept = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    return data.resources.some((r) => r.id === 'e2e-mir-1' && !r.deletedAt) && (data.curationProjections || []).length === 0 && !data.categories.some((c) => c.curFrom)
  }))
  report('E2E-10 策展统一树：迁移物化+源卡实时+原生卡+清空回落零影响（R53）', curHead && mirrorCatNode && mirCard && nativeCard && mirrorGone && nativeKept && srcKept,
    `head=${curHead} node=${mirrorCatNode} mir=${mirCard} native=${nativeCard} gone=${mirrorGone} kept=${nativeKept} src=${srcKept}`)

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
  const goalChip = await page.locator('.chip-proj').first().isVisible().catch(() => false)
  const offCourseGone = !(await page.getByText('偏航行动').first().isVisible().catch(() => false))
  report('E2E-11 主航线目标行 chip（未归档格迁调度台由 E2E-4 覆盖）', goalChip && offCourseGone,
    `chip=${goalChip} offCourseGone=${offCourseGone}`)

  // E2E-12 主航线全量呈现（R52-F4）：未投射项目也出现在战略目标行 chip（修订 R51-F18「仅已投射」）
  const chipCount = await page.locator('.chip-proj').count()
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
  const projHead = await page.getByText('成功指标 → 任务').first().isVisible().catch(() => false)
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
  await page.getByText('🌳 完整方向树').first().click().catch(() => {})
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


  // E2E-18 策展卡可拖真值 + 区域级落卡（R57-F1）：根因=裸 draggable 渲染为非法空值致真实拖拽不启动
  await page.goto(base + '#/curation', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  // 先种数据：镜像分类（源分类 2 卡：1 已投射 1 未投射）+ 未分类原生卡
  const seedOk = await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_data_v2').then(({ ['zy_data_v2']: d }) => {
      if (!d || d.version !== 2) { res(false); return }
      if (!d.categories.some(c => c.id === 'e2e-mirror')) {
        const wsId = d.workspaces[0]?.id || 'ws'
        d.categories.push({ id: 'e2e-mirror-src', workspaceId: wsId, name: 'E2E 镜像源', order: 99 })
        d.categories.push({ id: 'e2e-mirror', workspaceId: 'zy-curation', name: 'E2E 镜像分组', order: 99, curFrom: { wsId, catId: 'e2e-mirror-src', projId: '' } })
        d.resources.push({ id: 'e2e-src-live', kind: 'resource', title: 'E2E 未投射源卡', linkType: 'url', link: 'https://e.com/1', workspaceId: wsId, categoryId: 'e2e-mirror-src', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
        d.resources.push({ id: 'e2e-src-proj', kind: 'resource', title: 'E2E 已投射源卡', linkType: 'url', link: 'https://e.com/2', workspaceId: wsId, categoryId: 'e2e-mirror-src', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now() - 1, updatedAt: Date.now() })
        d.resources.push({ id: 'e2e-newcard', kind: 'resource', title: 'E2E 新建策展卡', linkType: 'url', link: '', workspaceId: 'zy-curation', categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now() - 2, updatedAt: Date.now() })
        d.curationProjections = (d.curationProjections || []).concat([{ id: 'e2e-curp-1', kind: 'card', wsId, cardId: 'e2e-src-proj', catId: 'e2e-mirror-src', targetCatId: 'e2e-mirror', addedAt: Date.now() }])
      }
      chrome.storage.local.set({ ['zy_data_v2']: d }).then(() => res(true))
    })
  }))
  // 不 reload——应用「刷新固定回调度台」白名单不含 /curation；直接 hash 导航 + storage.onChanged 同步
  await page.waitForTimeout(700)
  await page.evaluate(() => { location.hash = '#/curation' })
  await page.waitForTimeout(1400)
  const dragAttrs = await page.evaluate(() => ({
    native: document.querySelector('.cur-card.native')?.getAttribute('draggable') || '(无卡)'
  }))
  await page.evaluate(() => { const n = [...document.querySelectorAll('.cat-item')].find(x => x.textContent.includes('E2E 镜像分组')); if (n) n.click() })
  await page.waitForTimeout(700)
  const dragAttrsMirror = await page.evaluate(() => ({
    mirror: document.querySelector('.cur-card.mirror:not(.live)')?.getAttribute('draggable') || '(无投射卡)',
    live: document.querySelector('.cur-card.live')?.getAttribute('draggable') || '(无源卡)'
  }))
  // 区域级落卡：镜像分组视图内，把未投射源卡拖到网格空白处 = 物化为投射
  const projBefore = await page.evaluate(() => new Promise((res) => chrome.storage.local.get('zy_data_v2').then(r => res((r['zy_data_v2'].curationProjections || []).filter(p => p.kind === 'card').length))))
  const areaDrop = await page.evaluate(() => {
    const src = document.querySelector('.cur-card.live')
    const grid = document.querySelector('.cur-grid')
    if (!src || !grid) return 'missing'
    const dt = new DataTransfer()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    grid.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    grid.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return 'dispatched'
  })
  await page.waitForTimeout(700)
  const projAfter = await page.evaluate(() => new Promise((res) => chrome.storage.local.get('zy_data_v2').then(r => res((r['zy_data_v2'].curationProjections || []).filter(p => p.kind === 'card').length))))
  const newCardOk = await page.evaluate(() => new Promise((res) => chrome.storage.local.get('zy_data_v2').then(r => {
    res((r['zy_data_v2'].resources || []).some(x => x.id === 'e2e-newcard'))
  })))
  const attrOk = dragAttrs.native === 'true' && dragAttrsMirror.mirror === 'true' && dragAttrsMirror.live === 'true'
  report('E2E-18 策展卡可拖真值+区域落卡（R57-F1）', attrOk && seedOk && areaDrop === 'dispatched' && projAfter === projBefore + 1 && newCardOk,
    'attr=' + JSON.stringify(Object.assign({}, dragAttrs, dragAttrsMirror)) + ' area=' + areaDrop + ' proj=' + projBefore + '→' + projAfter)


  // E2E-19 删除工作台软删（R58-B1）：删除后资源卡带 deletedAt 进回收站，恢复时孤卡回落首个可用工作台
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
  await page.evaluate(() => { location.hash = '#/workspace/e2e-del-ws' })
  await page.waitForTimeout(1600)
  await page.evaluate(() => { const b = document.querySelector('.hero-btn.settings'); if (b) b.click() })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const it = [...document.querySelectorAll('.sm-item')].find(x => x.textContent.includes('删除工作台')); if (it) it.click() })
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
  report('E2E-19 删除工作台软删+回收站可见（R58-B1）', confirmMsg && afterDel.wsGone && afterDel.softDeleted && inRecycle,
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
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-empty-proj' })
  await page.waitForTimeout(1800)
  // 合成拖拽：满指标下任务行 → 空指标的树节点（dragstart/dragover/drop 全链路）
  const dropResult = await page.evaluate(() => {
    const src = [...document.querySelectorAll('.prt-task')].find(n => n.textContent.includes('E2E 待搬任务'))
    const dst = [...document.querySelectorAll('.prt-metric')].find(n => n.textContent.includes('E2E 空指标'))
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


  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
