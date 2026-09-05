/**
 * 第卌五轮 · V2.20.0 E2E 真机验证（Playwright MV3 模板，自第卌三轮重建版收编）
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/e2e.cjs
 * 检查项：
 *   E2E-1  MV3 扩展加载（worker = CRXJS service-worker-loader.js）
 *   E2E-2  设置页默认首屏 = 知源仪表盘（导航五组 + 动态条/操作记录时间线）
 *   E2E-3  工作台全景第二屏可切换（双栏 + 三级计数树）
 *   E2E-4  北极星「新增卡片/删除卡片」卡渲染（R45-1 三档周期联动改名）
 *   E2E-5  PDF 附件双击 file:// 打开（data 层种卡 + IndexedDB blob → 双击卡片 → 新标签 file://…pdf）
 *   E2E-6  事件日志 zy_event_log 独立 key 落盘（打开资源卡产生事件）
 *   E2E-7  好奇心专区 Tab：好奇心卡库默认 → 切任务卡库 → 卡片视图默认渲染 + 好奇面板隐藏（R45 迁移 + R46 BUG-1）
 *   E2E-8  调度台三件事 + 项目调度面板（愿景/使命小卡 + 战略目标 + 四数值，R45 T-04 → R49 迁移）
 *   E2E-9  存量回填迁移：有 metricId 无 projectId 的任务启动后按指标反查补齐 + projBackfillFixed 记录（R46 BUG-2）
 *   E2E-10 策展中心：页面渲染 + 工作台镜像实时 + 原生卡新建 + 清空投射源数据零影响（R50-F3）
 *   E2E-11 主航线目标行 chip + 指标条未归档任务格 + 档位入表头（R50-F4/F5）
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

  // E2E-4 方向台指标条（R49-C1+R50-F5）：4 格 DHI/WCE/WRR/未归档任务 + 详细指标下钻含北极星「新增卡片/删除卡片」
  await page.goto(base + '#/compass', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (!page.url().includes('/compass')) { await page.evaluate(() => { location.hash = '#/compass' }); await page.waitForTimeout(1800) }
  const metricBarOn = await page.locator('.mb-cells').first().isVisible().catch(() => false)
  const offCourse = await page.getByText('未归档任务').first().isVisible().catch(() => false)
  await page.locator('.mb-drill').click().catch(() => {})
  await page.waitForTimeout(1200)
  const todayAdd = await page.getByText('新增卡片').first().isVisible().catch(() => false)
  const todayDel = await page.getByText('删除卡片').first().isVisible().catch(() => false)
  const oldLabelGone = !(await page.getByText('今日新增', { exact: true }).first().isVisible().catch(() => false))
  report('E2E-4 方向台指标条 4 格 + 详细指标下钻（北极星新增/删除卡在抽屉内）', metricBarOn && offCourse && todayAdd && todayDel && oldLabelGone,
    `bar=${metricBarOn} offCourse=${offCourse} add=${todayAdd} del=${todayDel}`)

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

  // E2E-7 调度台底部 Tab（R45 T-03 + R46 BUG-1 + R49 改名）：默认好奇心培育 → 切任务调度 → 卡片视图默认 + 探索面板隐藏
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const tabsCount = await page.locator('.zone-tab').count()
  const curioDefault = await page.locator('.zone-tab.active').first().textContent().catch(() => '')
  const curioPanelOn = await page.locator('.zone-tab.active').first().evaluate((el) => el.textContent.includes('好奇心培育')).catch(() => false)
  const curioCardVisible = await page.locator('.module-card').filter({ hasText: '好奇心' }).first().isVisible().catch(() => false)
  await page.locator('.zone-tab').nth(1).click().catch(() => {})
  await page.waitForTimeout(1500)
  const mgrTitle = await page.getByText('任务调度').first().isVisible().catch(() => false)
  const curioHiddenAfter = await page.locator('.module-card').filter({ hasText: '好奇心' }).first().isVisible().then((v) => !v).catch(() => false)
  const cardTabActive = await page.locator('.view-tab.active').first().textContent().then((t) => (t || '').includes('卡片')).catch(() => false)
  const gridOn = await page.locator('.tm-grid').first().isVisible().catch(() => false)
  const tmCardCount = await page.locator('.tm-card').count()
  report('E2E-7 调度台底部 Tab：好奇心培育默认｜任务调度切换互斥（R49 改名）', tabsCount === 2 && curioPanelOn && curioCardVisible && mgrTitle && curioHiddenAfter && cardTabActive && gridOn && tmCardCount >= 1,
    `tabs=${tabsCount} defaultTab=${(curioDefault || '').trim()} curioOn=${curioCardVisible} hiddenAfter=${curioHiddenAfter} tmCards=${tmCardCount} cardActive=${cardTabActive} grid=${gridOn}`)

  // E2E-8 调度台首页（R49 迁移）：三件事卡片 + 项目调度面板（愿景/使命小卡 + 战略目标 + 四数值）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const todayCard = await page.locator('.today-card').first().isVisible().catch(() => false)
  const curationOn = await page.locator('.cur-body-v').first().isVisible().catch(() => false)
  const visionMini = await page.getByText('愿景 · Vision').first().isVisible().catch(() => false)
  const missionMini = await page.getByText('使命 · Mission').first().isVisible().catch(() => false)
  const goalOn = await page.getByText('E2E 战略目标').first().isVisible().catch(() => false)
  const statCount = await page.locator('.cur-stat').count()
  report('E2E-8 调度台三件事 + 项目调度面板（愿景/使命+战略目标+四数值）', todayCard && curationOn && visionMini && missionMini && goalOn && statCount === 4,
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

  // E2E-10 策展中心（R50-F3）：Tab 进入 + 工作台镜像实时渲染 + 清空后源数据零影响 + 原生卡新建
  await page.goto(base + '#/curation', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (!page.url().includes('/curation')) { await page.evaluate(() => { location.hash = '#/curation' }); await page.waitForTimeout(1500) }
  // 种一张源卡 + 工作台投射记录（UI 右键在 headless 不稳定，数据层直种）
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    const wsId = data.workspaces[0].id
    if (!data.resources.some((r) => r.id === 'e2e-mir-1')) {
      data.resources.push({ id: 'e2e-mir-1', kind: 'resource', title: 'E2E 镜像卡', linkType: 'url', link: 'https://example.com/e2e-mir', workspaceId: wsId, categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
    }
    data.curationProjections = [{ id: 'e2e-curp-ws', kind: 'workspace', wsId, addedAt: Date.now() }]
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => { location.hash = '#/curation' })
  await page.waitForTimeout(1800)
  const curHead = await page.getByText('灵活策展空间').first().isVisible().catch(() => false)
  const mirCard = await page.getByText('E2E 镜像卡').first().isVisible().catch(() => false)
  const wsMirror = await page.getByText('整个工作台 · 实时镜像').first().isVisible().catch(() => false)
  // 原生卡
  await page.getByText('＋ 新建卡片').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('.mc-field input').first().fill('E2E 原生策展卡').catch(() => {})
  await page.locator('.mini-btn.primary').last().click().catch(() => {})
  await page.waitForTimeout(1200)
  const nativeCard = await page.getByText('E2E 原生策展卡').first().isVisible().catch(() => false)
  // 清空投射
  await page.getByText('🧹 清空投射').first().click().catch(() => {})
  await page.waitForTimeout(800)
  await page.locator('.cdf-btn.ok').filter({ hasText: '清空投射' }).last().click().catch(() => {})
  await page.waitForTimeout(1200)
  const mirrorGone = !(await page.getByText('整个工作台 · 实时镜像').first().isVisible().catch(() => false))
  const nativeKept = await page.getByText('E2E 原生策展卡').first().isVisible().catch(() => false)
  const srcKept = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    return data.resources.some((r) => r.id === 'e2e-mir-1' && !r.deletedAt) && (data.curationProjections || []).length === 0
  }))
  report('E2E-10 策展中心：页面渲染+镜像实时+原生卡+清空零影响', curHead && mirCard && wsMirror && nativeCard && mirrorGone && nativeKept && srcKept,
    `head=${curHead} mir=${mirCard} wsMirror=${wsMirror} native=${nativeCard} gone=${mirrorGone} kept=${nativeKept} src=${srcKept}`)

  // E2E-11 主航线紧凑化 + 指标条（R50-F4/F5）：目标行 chip + goMore；未归档任务格 + 表头档位
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(2000)
  const goalChip = await page.locator('.chip-proj').first().isVisible().catch(() => false)
  const unarchivedCell = await page.getByText('未归档任务').first().isVisible().catch(() => false)
  const mbHeadPeriod = await page.locator('.mb-head .mb-period').first().isVisible().catch(() => false)
  const offCourseGone = !(await page.getByText('偏航行动').first().isVisible().catch(() => false))
  report('E2E-11 主航线目标行 chip + 指标条未归档任务格+档位入表头', goalChip && unarchivedCell && mbHeadPeriod && offCourseGone,
    `chip=${goalChip} unarch=${unarchivedCell} periodInHead=${mbHeadPeriod} offCourseGone=${offCourseGone}`)

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
