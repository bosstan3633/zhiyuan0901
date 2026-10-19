/**
 * 第卌五轮 · V2.20.0 E2E 真机验证（Playwright MV3 模板，自第卌三轮重建版收编）
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/e2e.cjs
 * 检查项：
 *   E2E-1  MV3 扩展加载（worker = CRXJS service-worker-loader.js）
 *   E2E-2  设置页默认首屏 = 知源仪表盘（导航四组 R54 + 动态条/操作记录时间线）
 *   E2E-3  ★R4-Da 改靶：全景整页退役归零 + 标签管理双栏仍两列（连带 CSS 的活性证据）
 *   E2E-32 ★R4-Db 书签导入唯一路线（真喂书签 HTML 跑一次导入）
 *   E2E-33 ★R4-Dc 附件 keepIds 单源（活卡/软删卡/论证卡引用必留，仅孤儿被删）
 *   E2E-34 ★R4-Dd Airtable 标签列名落盘（不碰网络，核配置链与 PAT 遮罩）
 *   E2E-35 ★R4-De 池卡定位落调度台卡池（采集后 Enter 那条链路不再跳死页）
 *   E2E-36 ★R4-Dg 导出 Markdown 含池卡 + 台名走单源（「资源卡池」）
 *   E2E-4  调度台右栏「未归档」入口进入任务二级页并预选筛选
 *   E2E-5  PDF 附件双击 file:// 打开（data 层种卡 + IndexedDB blob → 双击卡片 → 新标签 file://…pdf）
 *   E2E-6  事件日志 zy_event_log 独立 key 落盘（打开资源卡产生事件）
 *   E2E-7  V3.9.1 三类“查看全部”独立二级路由：任务/好奇心/资源各自可直达，二级页无新建入口
 *   E2E-8  V3.9.1 两栏调度台：三件事工作单 + 手边卡预览 + 右侧案头栏；整行点击打开任务详情
 *   E2E-9  存量回填迁移：有 metricId 无 projectId 的任务启动后按指标反查补齐 + projBackfillFixed 记录（R46 BUG-2）
 *   E2E-10 策展统一树：遗留投射记录迁移物化 + 源卡实时 + 原生卡 + 清空引用回落零影响（R53）
 *   E2E-11 方向台首屏项目卡头（★R3-B1 树即一级）+ 指标条未归档任务格 + 档位入表头（R50-F4/F5）
 *   E2E-12 全量呈现：未投射项目卡头照样在（折叠态仍可见，★R3-B1 换呈现单位）
 *   E2E-29 ★R3-B2 方向树同目标拖拽排序 + 置顶（落位重写 order / 📌 钉到非主攻组前排）
 *   E2E-13 方向树返回方向台 + 项目详情头部添加成功指标 + 返回项目列表移除（R52-F5/F6/F8）
 *   E2E-14 项目调度指标下钻弹窗（R54-B2）
 *   E2E-15 面包屑 + 来源感知返回 + 树定位闭环（R54-A；按钮退役后由来路提示 + Esc 承接）
 *   E2E-16 快速采集任务面板（R55-C）
 *   E2E-17 项目调度 4 指标恢复左列 + 下钻链路（R56-P1）
 *   E2E-18 策展卡可拖真值（draggable="true"）+ 区域级落卡（R57-F1）
 *   E2E-19 删除策展台软删（deletedAt）+ 回收站可见可恢复（R58-B1）
 *   E2E-20 项目详情左树：空指标节点接收任务拖拽（R59-T5）
 *   E2E-21 调度台页脚「今日战报」就地开弹窗并可关闭
 *   E2E-24 R167 镜像只读详情边界（标题 readonly / AI 行不给入口 / 页脚两钮是定位）
 *   E2E-25 R174-3 按日快照落盘（画像页年度段读合并 + 写链路保存→pagehide→today）
 *   E2E-26 R2-④⑤ K 定位改靶「资源卡池」（tab 激活 + 目标卡高亮）+ 打开池卡详情记一次「调出」事件
 *   E2E-27 R2-⑧ 池控制行：新建单卡入池 → 批量全选打标签 → 批量软删进回收站
 *   E2E-28 R4-a 迁移报告卡：出卡 → 回退落停用开关并清报告 → 可重新执行迁移
 *   E2E-30 R3-Ca 池面板：列表视图 / 待打标筛选 / 批量反选 / 右键置顶
 *   E2E-31 R3-Cb 三张卡批量口径合一：栏即出 / 全选反选可达 / 退出清空 / 任务批量打标
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

// R56：跨平台 Chromium 路径（Windows = playwright 缓存 chrome-win64；macOS = 缓存内 Chrome for Testing）
/* R4-Ea（挂账 #84）：浏览器可执行文件解析统一到 scripts/browser.cjs——四级回落的唯一实现。
   此前这里各抄一份且抄得不一致（img-diff 只写死 chromium-1234，缓存换版本后直接起不来）。 */
const { CHROME } = require('./browser.cjs')
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

  // E2E-2 设置默认首屏 = 资源卡字段（★W9 退役重指带备案：原判据「默认首屏=知源仪表盘」——
  //   知源仪表盘整块随 V3.8.7 迁画像洞察页 /profile，设置页默认页回到「资源卡字段」。
  //   守的两件事一字未松：① 导航五组齐备（R54→R178，组数仍为 5）；② 默认页是真实可见面板（不是空白）。
  //   时间线区判据转为负锚：.gs-ev-* / .gs-dash-* 不该再出现在设置页 DOM）。
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (!page.url().includes('#/settings')) { await page.evaluate(() => { location.hash = '#/settings' }); await page.waitForTimeout(1500) }
  const activeNavText = ((await page.locator('.gs-nav-item.active').first().innerText().catch(() => '')) || '').replace(/\s+/g, '')
  const defaultPanelVisible = await page.locator('.gs-page-title').first().isVisible().catch(() => false)
  const groupCount = await page.locator('.gs-nav-group').count()
  const timelineVisible = await page.locator('.gs-ev-head, .gs-ev-empty, .gs-dash-dyn').first().isVisible().catch(() => false)
  // R178 备案：分组重组 4→5（AI 认知协作者独立成组，原型分组口径；条目零增减）
  report('E2E-2 设置默认首屏=资源卡字段（★W9 仪表盘迁 /profile；导航五组 R54→R178 + 默认面板真渲染 + 时间线区归零）', defaultPanelVisible && groupCount === 5 && !timelineVisible && !activeNavText.includes('仪表盘'), `groups=${groupCount} active=${JSON.stringify(activeNavText)} panel=${defaultPanelVisible} timeline=${timelineVisible}`)

  // E2E-3 ★R4-Da 改靶：「资源台全景」整页随资源台退役删除，本场景原先只核那一屏能否切出。
  //   不写"页面没了所以恒过"的空转判据，改测两件本轮真实交付面：
  //   ① 全景版面与导航格在 DOM 里归零（删干净）；
  //   ② 标签管理双栏还活着——.tt-wrap 实测必须是两列 grid。这条是本轮补回连带 CSS 的活性证据：
  //      那段样式原先与全景样式同处一批被删（右列卡片还借用了全景类名），tt-wrap 一旦失样式就退化成
  //      单列流，纯文本断言看不出来。回归 R130-3 核规则文本在不在，这里核它真的作用到盒子上。
  await page.locator('.gs-nav-item').filter({ hasText: '标签管理' }).first().click()
  await page.waitForTimeout(1200)
  const panNodes = await page.locator('.gs-pan-panel, .gs-pan-ws, .gs-pan-tree').count()
  const navPan = await page.locator('.gs-nav-item').filter({ hasText: '资源台全景' }).count()
  const wrapCols = await page.locator('.tt-wrap').first()
    .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length).catch(() => 0)
  const treeRows = await page.locator('.gs-tt-row').count()
  report('E2E-3 全景退役归零 + 标签双栏仍两列', panNodes === 0 && navPan === 0 && wrapCols === 2 && treeRows >= 1, `panNodes=${panNodes} navPan=${navPan} cols=${wrapCols} treeRows=${treeRows}`)

  // E2E-4（V3.9.1 重指）：合流指标条已退役，方向状态由两栏首页右栏承接。
  // 本用例守的真实链路：右栏「未归档」读数 → 独立任务二级页 → 状态筛选预选 unarchived。
  // 不再在首页寻找已迁走的 `.metric-bar/.mb-cell`。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const sideRail = page.locator('.side-rail').first()
  const unarchivedRow = sideRail.locator('.stat-row').filter({ hasText: '未归档' }).first()
  const sideRailOn = await sideRail.isVisible().catch(() => false)
  const unarchivedText = ((await unarchivedRow.innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  await unarchivedRow.click().catch(() => {})
  await page.waitForTimeout(1500)
  const unarchivedUrl = page.url()
  const unarchivedRoute = unarchivedUrl.includes('#/deck/task') && unarchivedUrl.includes('filter=unarchived')
  const taskDeckOn = await page.locator('.deck-page .mgr-body').first().isVisible().catch(() => false)
  const taskFilter = await page.locator('.deck-page select[title="状态筛选"]').first().inputValue().catch(() => '')
  report('E2E-4 V3.9.1 右栏「未归档」→ 任务二级页并预选筛选',
    sideRailOn && unarchivedText.includes('未归档') && unarchivedRoute && taskDeckOn && taskFilter === 'unarchived',
    `rail=${sideRailOn} row="${unarchivedText.slice(0, 32)}" url=${unarchivedUrl.split('#')[1] || ''} deck=${taskDeckOn} filter=${taskFilter}`)

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

  // E2E-7 V3.9.1：三类“查看全部”是独立二级路由，旧的底部 .bt-tab 已整体退役。
  // 同时守“二级页无新建入口”：筛选/排序/批量仍在，但新建任务与新建资源卡按钮必须为 0。
  const deckChecks = []
  for (const [kind, host] of [['task', '.mgr-body'], ['curiosity', '.cz-body'], ['resource', '.pcp']]) {
    await page.goto(base + '#/deck/' + kind, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    const panel = await page.locator(host).first().isVisible().catch(() => false)
    const newButtons = await page.locator('.dk-new').count()
    const importButton = kind === 'resource'
      ? await page.locator('button', { hasText: '导入本地文件' }).count()
      : 0
    deckChecks.push({ kind, panel, newButtons, importButton })
  }
  const deckOk = deckChecks.every(x => x.panel && x.newButtons === 0 && x.importButton === 0)
  const oldTabsGone = (await page.locator('.bt-tab').count()) === 0
  // 浏览器返回：先回到首页，再同文档进入任务二级页；点“返回调度台”必须落回两栏首页。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await page.evaluate(() => { location.hash = '#/deck/task' })
  await page.waitForTimeout(1200)
  await page.locator('.deck-back').first().click().catch(() => {})
  await page.waitForTimeout(1000)
  const backHome = (await page.locator('.desk-layout').count()) > 0
  report('E2E-7 V3.9.1 三类查看全部独立二级路由：任务/好奇心/资源直达 + 二级页零新建入口 + 返回调度台',
    deckOk && oldTabsGone && backHome,
    deckChecks.map(x => `${x.kind}:panel=${x.panel},new=${x.newButtons},import=${x.importButton}`).join(' | ') + ` oldTabs=${oldTabsGone} backHome=${backHome}`)

  // E2E-8 V3.9.1 两栏调度台：左工作单 + 手边卡，右案头栏；旧的纵向卡片堆叠与卡内子任务视口退役。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const home = await page.evaluate(() => ({
    workBoard: !!document.querySelector('.work-board'),
    focusRows: document.querySelectorAll('.focus-row').length,
    handBoard: !!document.querySelector('.hand-board'),
    handGrid: !!document.querySelector('.hand-grid'),
    sideRail: !!document.querySelector('.side-rail'),
    oldCuration: !!document.querySelector('.card.curation'),
    oldSubs: !!document.querySelector('.tc-subs'),
  }))
  const firstFocus = page.locator('.focus-row[role="button"]').first()
  if (await firstFocus.count()) await firstFocus.click().catch(() => {})
  await page.waitForTimeout(900)
  const drawerOpened = await page.locator('.drawer').first().isVisible().catch(() => false)
  report('E2E-8 V3.9.1 两栏调度台：工作单 + 手边卡预览 + 案头栏；旧纵向卡面退役；整行点击打开右侧任务详情',
    home.workBoard && home.focusRows === 3 && home.handBoard && home.handGrid && home.sideRail
      && !home.oldCuration && !home.oldSubs && drawerOpened,
    `workBoard=${home.workBoard} focusRows=${home.focusRows} handBoard=${home.handBoard} handGrid=${home.handGrid} sideRail=${home.sideRail} oldCuration=${home.oldCuration} oldSubs=${home.oldSubs} drawer=${drawerOpened}`)

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
  // 读合并断言（V3.9.1 重指）：热力图已迁画像洞察页 PiYear。
  // 先到 #/profile，再用 PiRail「本年度」定位年度段，最后点「看全年 ›」进入展开态。
  // 所守行为未变：种下的老日快照必须在 8 月块里出现 l2 格，且 fullSince 说明仍含老日子。
  await page.goto(base + '#/profile', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const yearRail = page.locator('.pi-rail .pi-rnode').filter({ hasText: '本年度' }).first()
  await yearRail.click().catch(() => {})
  await page.waitForTimeout(700)
  const yearModuleOn = await page.locator('#mod-year').first().isVisible().catch(() => false)
  await page.locator('#mod-year .dz-mini-more').first().click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  const dsExpanded = await page.locator('.dz-months .mb').count()
  const dsAugL2 = await page.locator('.dz-months .mb').nth(7).locator('.dz-cell.l2').count()
  // fullSince 徽章真实落点在网格下方的 .note 区（文案「调出维度自 X 起完整」），不在 .dz-sec-h 里
  const dsBadge = await page.locator('#mod-year .dz-sec-b .note').first().innerText().catch(() => '')
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
  report('E2E-25 R174-3 按日快照落盘（画像页年度段读合并 + 保存→pagehide→今日写链路）',
    yearModuleOn && dsAugL2 >= 1 && dsBadge.includes('2026-08-15') && dsWritten.has && dsWritten.add >= 1,
    `年度段=${yearModuleOn} 月块=${dsExpanded} 8月l2格=${dsAugL2} note="${(dsBadge || '').replace(/\s+/g, ' ').slice(0, 60)}" 卡=${dsCard} 抽屉=${dsDrawer} 保存钮=${dsSaveBtn} 今日落盘=${JSON.stringify(dsWritten)}`)

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
  // ★R3-B1：主航线项目行卡（proj-row）随退役消失，方向台一级的呈现单位是方向树项目卡头；
  //   种进数据的遗留字段 pinnedToLighthouse 不应改变任何呈现（R60-4 零引用口径的活体版）
  // ★W12(V3.8.12)随迁备案：呈现单位随 W11 纵向项目舱由 .tp-head 改钉 .tw-head（舱卡头）。
  //   所守行为未变：首屏能看见项目卡头、遗留投射字段不影响呈现、未归档格由 E2E-4 覆盖。
  await page.waitForSelector('.tw-head', { timeout: 8000 }).catch(() => {})
  const goalChip = await page.locator('.tw-head').first().isVisible().catch(() => false)
  const offCourseGone = !(await page.getByText('偏航行动').first().isVisible().catch(() => false))
  report('E2E-11 ★R3-B1 方向台首屏=方向台项目舱卡头（.tw-head 可见 · 遗留投射字段不影响呈现 · 未归档格迁调度台由 E2E-4 覆盖）★W12随迁：呈现单位由已退役的 .tp-head 改钉 .tw-head',
    goalChip && offCourseGone,
    `heads=${goalChip} offCourseGone=${offCourseGone}`)

  // E2E-12 全量呈现（R52-F4 → ★R3-B1 换呈现单位）：非主攻/未投射项目照样有卡头（折叠只收指标与任务，卡头常显）
  const headCount = await page.locator('.tw-head').count()
  // ★W12随迁：折叠标记原锚 .tp-head.folded，舱卡头的收起/展开由 .tw-fold 的 aria-expanded 承担
  const foldedHeads = await page.locator('.tw-fold[aria-expanded="false"]').count()
  const unPinnedChip = await page.getByText('E2E 回填项目').first().isVisible().catch(() => false)
  report('E2E-12 ★R3-B1 全量呈现：未投射项目照样有舱卡头（折叠态仍可见）★W12随迁：卡头 .tp-head→.tw-head，折叠标记改钉 .tw-fold[aria-expanded="false"]（舱卡头无 .folded 类，收起态由按钮 aria 承担）',
    headCount >= 2 && unPinnedChip && foldedHeads >= 1,
    `heads=${headCount} folded=${foldedHeads} unPinnedVisible=${unPinnedChip}`)

  // E2E-13 方向台导航与项目详情操作（R52-F8/F5/F6 → ★R3-B1 随一级化改判据）：
  //   老深链 #/compass/tree 必须带 query 重定向到 /compass 且渲染出树（不许变死页），一级台面不再有「返回方向台」自指入口；
  //   项目详情仍无「返回项目列表」+ 标题行「＋ 成功指标」（R177 随原型改文案并移入标题行）
  await page.evaluate(() => { location.hash = '#/compass/tree?hl=e2e-dir-1' })
  await page.waitForTimeout(1600)
  const redirected = (page.url().split('#')[1] || '').split('?')[0] === '/compass'
  const treeRendered = await page.locator('.tw-head').first().isVisible().catch(() => false)
  const backBtn = !(await page.getByText('← 返回方向台').first().isVisible().catch(() => false))
  const backToCompass = redirected && treeRendered
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-proj-1' })
  await page.waitForTimeout(1500)
  // R121：原「成功指标 → 任务」层头退役 → 展板统计条（pb-stats）
  const projHead = await page.locator('.pb-stats').first().isVisible().catch(() => false)
  const addMetricBtn = await page.getByText('＋ 成功指标').first().isVisible().catch(() => false) // R177：随原型改文案「＋ 成功指标」（标题行动作组）
  const backListGone = !(await page.getByText('返回项目列表').first().isVisible().catch(() => false))
  report('E2E-13 ★R3-B1 老深链重定向落地（/compass/tree?hl → /compass 且渲染出方向台）+ 一级无自指返回钮 + 项目详情标题行成功指标入口 + 返回项目列表移除（R52-F5/F6/F8 · R177 随迁 · ★W12随迁：「渲染树」判据由 .tp-head 改钉 .tw-head）', backBtn && backToCompass && projHead && addMetricBtn && backListGone,
    `无返回钮=${backBtn} 重定向且出树=${backToCompass} proj=${projHead} addMetric=${addMetricBtn} backListGone=${backListGone}`)

  // E2E-29 ★R3-B2 方向树同目标拖拽排序 + 置顶：拖拽落位重写 order（所见即所得）→ ▾ 菜单置顶把第二张钉到前排
  await page.evaluate(() => { location.hash = '#/compass' })
  await page.waitForTimeout(1500)
  // ★W12(V3.8.12)随迁备案：方向台第 4 层已随 W11 由「三列并排网格」改为纵向项目舱，
  //   原锚 .tc-strategic-branch / .tree-project-branch / .tp-* 六个类名全部退役 ⇒ 本段曾因 host=undefined
  //   直接抛未捕获异常**终止整个脚本**，其后约 30 条用例从未执行（skill §0.1「中断比失败更危险」）。
  //   现按真实结构重写：舱=.tower（平级序列，用卡头 .tw-crumb 里的「战略目标 · X」判归属），
  //   卡头=.tw-head（整块可拖）/ 标题=.tw-name-t / 动作组=.tw-acts .tw-act / 菜单=.tw-menu .twm-item。
  //   所守行为未变：同目标内拖拽落位重写 order 且所见即所得、▾ 菜单置顶钉到前排并落库出 📌 徽标。
  const dragOut = await page.evaluate(async () => {
    const dirNameOf = (t) => {
      const cr = [...t.querySelectorAll('.tw-cr')].find((x) => (x.textContent || '').trim().startsWith('战略目标'))
      return (cr?.textContent || '').replace('战略目标 ·', '').trim()
    }
    const towers = [...document.querySelectorAll('.tower')]
    const nameOf = (el) => (el.querySelector('.tw-name-t')?.textContent || '').trim()
    // 同目标 = 卡头面包屑里「战略目标 · X」相同；取项目数 ≥2 的第一个目标
    const byDir = new Map()
    for (const t of towers) {
      const d = dirNameOf(t)
      if (!byDir.has(d)) byDir.set(d, [])
      byDir.get(d).push(t)
    }
    const group = [...byDir.values()].find((g) => g.length >= 2)
    if (!group) return { ok: false, why: '没有同属一个战略目标且至少两舱的分组', dirs: [...byDir.keys()] }
    const read = () => group.map(nameOf)
    const before = read()
    const dt = new DataTransfer()
    // ★V3.9.1：独立手柄 .tw-grip 已退役，dragstart/dragover/drop 三件套全部绑在整块卡头 .tw-head 上。
    //   卡头同时负责点击进全景；onHeadDragStart 会在按钮/输入/菜单上取消拖拽。
    //   drop-on 落位指示仍绑在**舱容器 .tower** 上（dropOn prop → :class），两处各挂各的。
    const head = group[0].querySelector('.tw-head')
    const head2 = group[1].querySelector('.tw-head')
    const tower2 = group[1]
    if (!head || !head2) return { ok: false, why: '舱头缺少可拖拽卡头 .tw-head' }
    const headDraggable = head.getAttribute('draggable') === 'true'
    head.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    head2.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    // Vue 的 class 绑定在下一个 tick 才落到 DOM，同步读必假——落位指示要等一拍再量
    await new Promise((r) => setTimeout(r, 120))
    const showedDrop = tower2.classList.contains('drop-on')
    head2.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    head.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
    // 落位后走 store.persist() → Vue 重渲染 → DOM 重排；数据层 order 已即时写入，
    // 但 DOM 顺序要等下一个 tick 后的重排落定。900ms 实测偏紧（读到的仍是旧序），给到 1600ms。
    await new Promise((r) => setTimeout(r, 1600))
    // 重排后 DOM 顺序会变，重新按数据 dir 定位该组当前的舱序
    const nowTowers = [...document.querySelectorAll('.tower')].filter((t) => dirNameOf(t) === dirNameOf(group[0]))
    const after = nowTowers.map(nameOf)
    const stored = await chrome.storage.local.get('zy_data_v2')
    const dirs = ((stored['zy_data_v2'] || {}).compass?.directions || [])
    const dir = dirs.find((x) => (x.projects || []).length >= 2 && x.name === dirNameOf(group[0]))
    return { ok: headDraggable && showedDrop && after[0] === before[1] && after[1] === before[0], headDraggable, showedDrop, before, after,
      // order 是可选字段（`order?: number`），种的数据本来没有；用 ?? '-' 免得诊断里一串 undefined 掩盖真因
      orders: (dir?.projects || []).map((x) => x.name + '=' + (x.order ?? '-')) }
  })
  const pinOut = await page.evaluate(async () => {
    const dirNameOf = (t) => {
      const cr = [...t.querySelectorAll('.tw-cr')].find((x) => (x.textContent || '').trim().startsWith('战略目标'))
      return (cr?.textContent || '').replace('战略目标 ·', '').trim()
    }
    const nameOf = (el) => (el.querySelector('.tw-name-t')?.textContent || '').trim()
    const towers = [...document.querySelectorAll('.tower')]
    const byDir = new Map()
    for (const t of towers) {
      const d = dirNameOf(t)
      if (!byDir.has(d)) byDir.set(d, [])
      byDir.get(d).push(t)
    }
    const group = [...byDir.values()].find((g) => g.length >= 2)
    if (!group) return { ok: false, why: '没有同属一个战略目标且至少两舱的分组' }
    const dirKey = dirNameOf(group[0])
    const before = group.map(nameOf)
    const target = group[1]
    // ▾ 更多操作 = .tw-acts 里title 含「更多操作」的那枚（不用下标，下标随动作增减会漂）
    const more = [...target.querySelectorAll('.tw-acts .tw-act')].find((b) => (b.getAttribute('title') || '').includes('更多操作'))
    if (!more) return { ok: false, why: '舱头没有「更多操作」钮' }
    more.click()
    await new Promise((r) => setTimeout(r, 250))
    const pinItem = [...target.querySelectorAll('.tw-menu .twm-item')].find((x) => (x.textContent || '').includes('置顶'))
    if (!pinItem) return { ok: false, why: '菜单里没有置顶项', menu: [...target.querySelectorAll('.tw-menu .twm-item')].map((x) => (x.textContent || '').trim()) }
    pinItem.click()
    await new Promise((r) => setTimeout(r, 1600))
    const now = [...document.querySelectorAll('.tower')].filter((t) => dirNameOf(t) === dirKey)
    const stored = await chrome.storage.local.get('zy_data_v2')
    const dir = (((stored['zy_data_v2'] || {}).compass?.directions || [])).find((x) => x.name === dirKey)
    // 📌 徽标 = 卡头 .tw-badge 里 title「已置顶」那枚
    const badge = !!(now[0] && [...now[0].querySelectorAll('.tw-badge')].some((b) => (b.getAttribute('title') || '') === '已置顶'))
    return { ok: now[0] && nameOf(now[0]) === before[1] && badge,
      moved: !!now[0] && nameOf(now[0]) === before[1], badge,
      pinned: (dir?.projects || []).filter((x) => x.pinned).map((x) => x.name) }
  })
  report('E2E-29 ★R3-B2 方向台整块舱头拖拽排序 + ▾ 菜单置顶（落位重写 order / 📌 徽标 / 落库）★V3.9.1：独立 .tw-grip 手柄退役，改钉 .tw-head',
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

  // E2E-15 二级导航闭环（R54-A / V3.9.1）：项目详情 → 跳树带定位与来源 → 来路提示可见 → Esc 返回项目详情。
  // 「← 返回项目详情」按钮已退役，但 fromProjId / goBack / Esc 的来源感知能力保留。
  await page.evaluate(() => { location.hash = '#/compass/projects?p=e2e-proj-1' })
  await page.waitForTimeout(1500)
  const crumbUp = await page.getByText('方向台', { exact: true }).first().isVisible().catch(() => false)
  // R121：树定位入口收进展板 ⋯ 菜单（原 back-row「🌳 完整方向树」按钮已随重排退役）
  await page.locator('.pb-more-wrap .mini-btn.icon').first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.pb-menu .pm-item', { hasText: '在完整方向树中定位' }).first().click().catch(() => {})
  await page.waitForTimeout(1500)
  const urlHasFrom = page.url().includes('from=proj') && page.url().includes('hl=')
  const fromProjLabel = ((await page.locator('.hero-from').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(1500)
  const backOnProj = page.url().includes('/compass/projects') && page.url().includes('p=e2e-proj-1')
  report('E2E-15 面包屑+来源感知返回+树定位闭环（R54-A · V3.9.1 按钮退役后由来源提示 + Esc 承接）',
    crumbUp && urlHasFrom && fromProjLabel.includes('来自项目「E2E 策展项目」') && backOnProj,
    `crumb=${crumbUp} fromHl=${urlHasFrom} fromLabel="${fromProjLabel}" backOnProj=${backOnProj}`)


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


  // E2E-21（V3.9.1 重指）：调度台页脚「今日战报」不再跳画像页，而是由 TodayBattleHost 就地打开弹窗。
  // 本用例守「入口真的连到组件」这件事：点页脚入口 → 战报弹窗出现 → 关闭钮收起。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const battleBtn = page.locator('.page-foot .foot-link').first()
  const battleBtnText = ((await battleBtn.innerText().catch(() => '')) || '').replace(/\s+/g, '')
  await battleBtn.click()
  await page.waitForTimeout(1400)
  const battleModal = page.locator('.dz-day-modal').first()
  const battleOpen = await battleModal.isVisible().catch(() => false)
  const battleTitle = ((await battleModal.locator('.dz-day-title').first().innerText().catch(() => '')) || '').replace(/\s+/g, '')
  const battleCloseBtn = battleModal.locator('[aria-label="关闭"]').first()
  const battleCloseVisible = await battleCloseBtn.isVisible().catch(() => false)
  await battleCloseBtn.click().catch(() => {})
  await page.waitForTimeout(700)
  const battleClosed = !(await page.locator('.dz-day-modal').first().isVisible().catch(() => false))
  report('E2E-21 V3.9.1 调度台页脚「今日战报」就地开弹窗并可关闭',
    battleBtnText.includes('今日战报') && battleOpen && battleTitle.includes('今日战报') && battleCloseVisible && battleClosed,
    `btn="${battleBtnText}" modal=${battleOpen} title="${battleTitle}" closeBtn=${battleCloseVisible} closed=${battleClosed}`)

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
  await page.evaluate(() => { location.hash = '#/deck/resource?hl=e2e-pool-1&hk=res' })
  await page.waitForTimeout(1600)
  const poolDeckOn = await page.locator('.deck-page .pcp').first().isVisible().catch(() => false)
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
  report('E2E-26 ★R2-④⑤ ⌘K 定位改靶「资源卡池」（独立资源二级页 + 目标卡高亮）+ 打开详情记一次调出（热度键与事件日志双落盘）',
    poolDeckOn && hlCount === 1 && hlFlash && drawerTitle.includes('E2E 池卡定位') && callEv.n > 0 && !!callEv.hotEntry,
    `资源二级页=${poolDeckOn} 目标卡=${hlCount} 高亮=${hlFlash} 抽屉="${drawerTitle.slice(0, 18)}" call事件=${callEv.n}(${callEv.kind}) 热度=${JSON.stringify(callEv.hotEntry)}`)

  // E2E-27（R2-⑧ · V3.9.1 重指）：独立资源二级页不得再有新建入口；
  //   批量全选打标签 → 批量软删仍走真实点击，种卡只是替代已退役的“新建”准备步骤。
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const poolNewGone = (await page.locator('.dk-new').count()) === 0
  const seedTitle = 'E2E 批量探针池卡'
  await page.evaluate((title) => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    d.resources = (d.resources || []).filter(r => r.title !== title)
    d.resources.unshift({
      id: 'e2e-batch-pool', kind: 'resource', title, linkType: 'url', link: 'https://example.com/batch-pool',
      workspaceId: 'zy-curation', categoryId: '', tags: ['E2E 标签甲'], pinned: false, callCount: 0,
      createdAt: Date.now(), updatedAt: Date.now(), description: '', customFields: {}, assets: []
    })
    return chrome.storage.local.set({ zy_data_v2: d })
  }), seedTitle)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const countBefore = await page.locator('.pcp-card, .pcp-row').count()
  const seedCard = page.locator('.pcp-card, .pcp-row', { hasText: seedTitle }).first()
  const seedCardOn = await seedCard.isVisible().catch(() => false)
  // 批量：进批量态 → 全选 → 加标签 → 应用
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b && (b.textContent || '').trim() === '批量') b.click() })
  await page.waitForTimeout(400)
  const batchBarOn = await page.locator('.pcp .dkb-bar').isVisible().catch(() => false)
  await page.locator('.pcp .dkb-bar button', { hasText: /^全选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.pcp .dkb-tagin').fill('E2E 批量标签').catch(() => {})
  await page.getByText('应用标签').first().click().catch(() => {})
  await page.waitForTimeout(900)
  const tagged = await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
    const st = pinia && pinia._s.get('app')
    const c = st && (st.data.resources || []).find(x => x.title === 'E2E 批量探针池卡' && !x.deletedAt)
    return { found: !!c, tags: c ? c.tags : [], ws: c ? c.workspaceId : '' }
  })
  // 批量软删：删完这张卡应当从台面消失，且带 deletedAt（回收站族）
  await page.locator('.pcp .dkb-bar button', { hasText: '删除（进回收站）' }).first().click().catch(() => {})
  await page.waitForTimeout(900)
  const goneAfterBatch = (await page.locator('.pcp-card, .pcp-row', { hasText: seedTitle }).count()) === 0
  const softDeleted = await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
    const st = pinia && pinia._s.get('app')
    const c = st && (st.data.resources || []).find(x => x.title === 'E2E 批量探针池卡')
    return !!(c && c.deletedAt)
  })
  report('E2E-27 ★R2-⑧ V3.9.1 二级资源页零新建入口 → 批量全选打标签 → 批量软删进回收站',
    poolNewGone && seedCardOn && countBefore >= 1 && batchBarOn
    && tagged.found && tagged.ws === 'zy-curation' && (tagged.tags || []).includes('E2E 标签甲') && (tagged.tags || []).includes('E2E 批量标签')
    && goneAfterBatch && softDeleted,
    `新建入口归零=${poolNewGone} 种子卡上屏=${seedCardOn} 初始计数=${countBefore} 批量条=${batchBarOn} 标签=${JSON.stringify(tagged.tags)} 台=${tagged.ws} 删后端点=${goneAfterBatch} 软删=${softDeleted}`)

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
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b && (b.textContent || '').includes('退出批量')) b.click() })
  await page.waitForTimeout(400)
  // V3.9.1：池面板默认列表视图；先显式切网格量一次，再切列表量一次，才是在测“两视图同源”。
  await page.locator('.dk-row[data-panel="pool"] .dk-view', { hasText: '网格' }).click().catch(() => {})
  await page.waitForTimeout(600)
  const gridCount = await page.locator('.pcp-card').count()
  await page.locator('.dk-row[data-panel="pool"] .dk-view', { hasText: '列表' }).click().catch(() => {})
  await page.waitForTimeout(600)
  const listCount = await page.locator('.pcp-row').count()
  const noTagShown = await page.locator('.pcp-row', { hasText: 'E2E 池卡乙' }).first().isVisible().catch(() => false)
  await page.locator('.dk-row[data-panel="pool"] .dk-pill', { hasText: '待打标' }).click().catch(() => {})
  await page.waitForTimeout(600)
  const untaggedCount = await page.locator('.pcp-row').count()
  const untaggedIsB = untaggedCount === 1 && (await page.locator('.pcp-row').first().textContent() || '').includes('E2E 池卡乙')
  await page.locator('.dk-row[data-panel="pool"] .dk-pill', { hasText: '待打标' }).click().catch(() => {})
  await page.waitForTimeout(500)
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b && (b.textContent || '').trim() === '批量') b.click() })
  await page.waitForTimeout(400)
  await page.locator('.pcp .dkb-bar button', { hasText: /^全选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  const selAll = parseInt((await page.locator('.pcp .dkb-count').textContent().catch(() => '0'))?.replace(/\D/g, '') || '0', 10)
  await page.locator('.pcp .dkb-bar button', { hasText: /^反选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  const selAfterInvert = parseInt((await page.locator('.pcp .dkb-count').textContent().catch(() => 'x'))?.replace(/\D/g, '') || 'x', 10)
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b && (b.textContent || '').includes('退出批量')) b.click() })
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

  // E2E-31（R3-Cb）：三张卡批量口径合一——批量栏进来就在、全选/反选可达、退出即清空、任务补批量打标
  // 好奇面板：先种两张卡再测（E2E 库里可能一张不剩，"全选后 0 项"会被误读成反选生效）
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']; if (!d) return
    d.curiosities = (d.curiosities || []).filter(x => !String(x.id).startsWith('e2e-cb-'))
    const mk = (id, q) => ({ id, kind: 'curiosity', question: q, sourceUrl: 'https://example.com/' + id, status: 'todo', pinned: false, tags: [], customFields: {}, assets: [], createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000 })
    d.curiosities.unshift(mk('e2e-cb-1', 'E2E 好奇甲'), mk('e2e-cb-2', 'E2E 好奇乙'))
    return chrome.storage.local.set({ zy_data_v2: d })
  }))
  await page.goto(base + '#/deck/task', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // 按钮文案是「☑ 批量管理」/「✓ 完成」——按文案找，别按 .cz-batch-btn 的第一枚（那是 AI 转化研判钮）
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="task"] .dk-batch'); if (b && (b.textContent || '').includes('批量管理')) b.click() })
  await page.waitForTimeout(600)
  const barWithoutSel = await page.locator('.mgr-body .dkb-bar').isVisible().catch(() => false)
  const sel0 = (await page.locator('.mgr-body .dkb-count').textContent().catch(() => '')) || ''
  await page.locator('.mgr-body .dkb-bar button', { hasText: /^全选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(500)
  const tSelAll = parseInt(((await page.locator('.mgr-body .dkb-count').textContent().catch(() => '0')) || '').replace(/\D/g, '') || '0', 10)
  await page.locator('.mgr-body .dkb-tagin').fill('E2E 批量任务标签').catch(() => {})
  await page.locator('.mgr-body .dkb-bar button', { hasText: '应用标签' }).first().click().catch(() => {})
  await page.waitForTimeout(900)
  const taskTagged = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const ts = ((cur['zy_data_v2'] || {}).tasks || []).filter(t => !t.deletedAt && (t.tags || []).includes('E2E 批量任务标签'))
    return { n: ts.length, ids: ts.map(t => t.id) }
  }))
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="task"] .dk-batch'); if (b && (b.textContent || '').includes('完成')) b.click() })
  await page.waitForTimeout(500)
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="task"] .dk-batch'); if (b && (b.textContent || '').includes('批量管理')) b.click() })
  await page.waitForTimeout(600)
  const selAfterReenter = parseInt(((await page.locator('.mgr-body .dkb-count').textContent().catch(() => 'x')) || '').replace(/\D/g, '') || 'x', 10)
  await page.goto(base + '#/deck/curiosity', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="curio"] .dk-batch'); if (b && (b.textContent || '').includes('批量管理')) b.click() })
  await page.waitForTimeout(600)
  const czBar = await page.locator('.cz-body .dkb-bar').isVisible().catch(() => false)
  await page.locator('.cz-body .dkb-bar button', { hasText: /^全选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(500)
  const czAll = (await page.locator('.cz-body .dkb-count').textContent().catch(() => '')) || ''
  await page.locator('.cz-body .dkb-bar button', { hasText: /^反选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(500)
  const czInvert = (await page.locator('.cz-body .dkb-count').textContent().catch(() => '')) || ''
  report('E2E-31 ★R3-Cb 批量合一：任务批量栏未选即出 → 全选可点 → 批量打标落库 → 退出再进不残留勾选；好奇全选→反选归零',
    barWithoutSel && /已选 0/.test(sel0) && tSelAll >= 2 && taskTagged.n === tSelAll && selAfterReenter === 0
    && czBar && /已选 2/.test(czAll) && /已选 0/.test(czInvert),
    `栏即出=${barWithoutSel} 初始="${sel0.trim()}" 全选=${tSelAll} 打标落库=${taskTagged.n} 重进残留=${selAfterReenter} 好奇栏=${czBar} 全选="${czAll.trim()}" 反选="${czInvert.trim()}"`)

  // E2E-32 ★R4-Db 书签导入唯一路线：真喂一份 Netscape 书签 HTML 进设置页那枚 input，核四件
  //   此前**只有源码文本断言**在管的事（书签链路过去零行为覆盖，删一整条死链却没有活性凭据
  //   就等于"合一"可能只是"删坏了"）：
  //   ① 落库张数 == 解析张数；② 文件夹层级进标签、浏览器根栏名不混进标签；
  //   ③ percent-encoding 标题被解码（合一从旧实现带来的那处硬化）；④ 卡不落隐藏池 + 回执挂出
  //   「归类并补全这批」（R138-H3：导入完不自动弹抽屉）。
  const bkHtml = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>',
    '  <DT><H3>书签栏</H3><DL><p>',
    '    <DT><H3>AI工具</H3><DL><p>',
    '      <DT><A HREF="https://e2e-db.test/a">%E4%B9%A0%E6%83%AF%E5%85%BB%E6%88%90</A>',
    '      <DT><A HREF="https://e2e-db.test/b">普通标题乙</A>',
    '    </DL><p>',
    '    <DT><A HREF="obsidian://e2e-db">Obsidian 直达</A>',
    '  </DL><p>',
    '</DL><p>'
  ].join('\n')
  const bkBefore = await page.evaluate(() => chrome.storage.local.get('zy_data_v2')
    .then(r => (r['zy_data_v2'].resources || []).filter(x => !x.deletedAt).length))
  await page.goto(base + '#/settings?page=import', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('input[accept=".html,.htm"]').first()
    .setInputFiles({ name: 'bookmarks.html', mimeType: 'text/html', buffer: Buffer.from(bkHtml, 'utf8') })
  await page.waitForTimeout(2000)
  const bk = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const d = r['zy_data_v2']
    const cards = (d.resources || []).filter(x => /^https:\/\/e2e-db\.test|^obsidian:\/\/e2e-db/.test(x.link || ''))
    const ws = d.workspaces.find(w => w.id === (cards[0] || {}).workspaceId)
    return {
      added: cards.length,
      tags: Array.from(new Set(cards.flatMap(c => c.tags || []))),
      decoded: cards.map(c => c.title).find(t => t === '习惯养成') || '',
      linkTypes: Array.from(new Set(cards.map(c => c.linkType))).sort(),
      wsName: ws ? ws.name : '(无)',
      inPool: cards.some(c => c.workspaceId === 'zy-curation'),
      catUncat: cards.every(c => !!c.categoryId)
    }
  }))
  /* ★回执钮文案是**条件式**的：接入未配时印「先在 AI 助手完成接入」、配了才印「归类并补全这批」，
     按后者找在 E2E 环境里永远命不中（首轮就红在这里，而导入本身其实已经成功）。
     改核那一行无条件存在的「刚导入 N 张卡」——它才证明 pendingImportEnrich 真的被赋值了。 */
  const bkReceipt = await page.getByText(/刚导入 3 张卡/).first().isVisible().catch(() => false)
  const bkCount = await page.evaluate(() => chrome.storage.local.get('zy_data_v2')
    .then(r => (r['zy_data_v2'].resources || []).filter(x => !x.deletedAt).length))
  report('E2E-32 ★R4-Db 书签导入唯一路线：落库张数=解析张数 / 层级进标签且根栏名排除 / 编码标题解码 / 不落池 + 回执在位',
    bk.added === 3 && bkCount === bkBefore + 3 && JSON.stringify(bk.tags) === '["AI工具"]'
    && bk.decoded === '习惯养成' && JSON.stringify(bk.linkTypes) === '["obsidian","url"]'
    && bk.wsName.startsWith('🔖 书签导入') && !bk.inPool && bk.catUncat && bkReceipt,
    `落库=${bk.added} 总数=${bkBefore}→${bkCount} 标签=${JSON.stringify(bk.tags)} 解码="${bk.decoded}" 型=${JSON.stringify(bk.linkTypes)} 台="${bk.wsName}" 落池=${bk.inPool} 回执=${bkReceipt}`)

  // E2E-33 ★R4-Dc 附件 keepIds 单源：真跑一次设置页「清理孤儿附件」，核四类本体的生死。
  //   这条守的是**不可恢复的物理删除**判错一次的代价：
  //   活卡引用 / 回收站软删卡引用 / 论证卡引用（★本轮新补进 keepIds 的那一类）三者必须留，
  //   只有谁都不引用的残留本体才准删。此前这条性质零行为覆盖，只有源码文本断言在管。
  //   顺带验确认门：点钮先出弹窗，不确认就一个字节都不该动。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.evaluate(async () => {
    const blob = new Blob(['zy-e2e-hygiene'], { type: 'text/plain' })
    const db = await new Promise((res, rej) => {
      const rq = indexedDB.open('zy_assets', 1)
      rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains('assets')) rq.result.createObjectStore('assets') }
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    await new Promise((res, rej) => {
      const tx = db.transaction('assets', 'readwrite')
      for (const k of ['e2e-hy-live', 'e2e-hy-del', 'e2e-hy-arg', 'e2e-hy-orphan']) tx.objectStore('assets').put(blob, k)
      tx.oncomplete = () => { db.close(); res() }
      tx.onerror = () => rej(tx.error)
    })
    const meta = (id) => ({ id, kind: 'text', name: id, size: 12, mime: 'text/plain', createdAt: Date.now() })
    const cur = await chrome.storage.local.get('zy_data_v2')
    const d = cur['zy_data_v2']
    const wsId = d.workspaces[0].id
    const mk = (id, assets, deleted) => ({
      id, kind: 'resource', title: 'E2E 卫生 ' + id, linkType: 'file', link: 'zy-asset://' + assets[0].id,
      workspaceId: wsId, categoryId: '', description: '', tags: [], assets, customFields: {},
      pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now(), ...(deleted ? { deletedAt: Date.now() } : {})
    })
    d.resources = d.resources.filter(r => !r.id.startsWith('e2e-hy-'))
    d.resources.push(mk('e2e-hy-live', [meta('e2e-hy-live')], false))
    d.resources.push(mk('e2e-hy-del', [meta('e2e-hy-del')], true))
    d.argCards = (d.argCards || []).filter(c => !String(c.id).startsWith('e2e-hy-'))
    d.argCards.push({ id: 'e2e-hy-arg-card', kind: 'argument', statement: 'E2E 论证卡带附件', workspaceId: wsId, assets: [meta('e2e-hy-arg')], createdAt: Date.now(), updatedAt: Date.now() })
    await chrome.storage.local.set({ zy_data_v2: d })
  })
  await page.goto(base + '#/settings?page=export', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const hyBtn = page.locator('.gs-export-row').filter({ hasText: '清理孤儿附件' }).locator('button')
  await hyBtn.click()
  await page.waitForTimeout(900)
  /* 确认门必须在：弹窗没点掉之前一个字节都不许动（本轮补的就是这道门） */
  const hyGateShown = await page.getByText('清理孤儿附件').last().isVisible().catch(() => false)
  /* ★不写"库里正好 4 个键"这种绝对数——同一轮跑里前面的场景（E2E-5 的 e2e-pdf-1）也会往 zy_assets 里留东西。
     要验的性质是**相对的**：弹窗还开着的时候，我种的这四个键一个都还没被删。 */
  const hyAfterCancel = await page.evaluate(() => new Promise((res, rej) => {
    const rq = indexedDB.open('zy_assets', 1)
    rq.onsuccess = () => {
      const tx = rq.result.transaction('assets', 'readonly')
      const all = tx.objectStore('assets').getAllKeys()
      all.onsuccess = () => { rq.result.close(); res(all.result) }
      all.onerror = () => rej(all.error)
    }
    rq.onerror = () => rej(rq.error)
  }))
  await page.evaluate(() => { const b = document.querySelector('.cdf-btn.ok'); if (b) b.click() })
  await page.waitForTimeout(2000)
  const hyKeys = await page.evaluate(() => new Promise((res, rej) => {
    const rq = indexedDB.open('zy_assets', 1)
    rq.onsuccess = () => {
      const tx = rq.result.transaction('assets', 'readonly')
      const all = tx.objectStore('assets').getAllKeys()
      all.onsuccess = () => { rq.result.close(); res(all.result) }
      all.onerror = () => rej(all.error)
    }
    rq.onerror = () => rej(rq.error)
  }))
  const hy = {
    live: hyKeys.includes('e2e-hy-live'), del: hyKeys.includes('e2e-hy-del'),
    arg: hyKeys.includes('e2e-hy-arg'), orphanGone: !hyKeys.includes('e2e-hy-orphan'),
    untouchedBeforeConfirm: ['e2e-hy-live', 'e2e-hy-del', 'e2e-hy-arg', 'e2e-hy-orphan'].every(k => hyAfterCancel.includes(k))
  }
  report('E2E-33 ★R4-Dc keepIds 单源：活卡/软删卡/论证卡引用一律留，仅孤儿本体被删，且删前必有确认门',
    hyGateShown && hy.untouchedBeforeConfirm && hy.live && hy.del && hy.arg && hy.orphanGone,
    `弹窗=${hyGateShown} 未确认前不动=${hy.untouchedBeforeConfirm}(${hyAfterCancel.length}) 留活=${hy.live} 留软删=${hy.del} 留论证卡=${hy.arg} 孤儿已删=${hy.orphanGone}`)
  await page.evaluate(async () => {
    const d0 = (await chrome.storage.local.get('zy_data_v2'))['zy_data_v2']
    d0.resources = d0.resources.filter(r => !String(r.id).startsWith('e2e-hy-'))
    d0.argCards = (d0.argCards || []).filter(c => !String(c.id).startsWith('e2e-hy-'))
    await chrome.storage.local.set({ zy_data_v2: d0 })
  })

  // E2E-34 ★R4-Dd Airtable 标签列映射：这一轮不碰网络（真推要用户 PAT，测试里绝不引入凭据），
  //   但配置链路本身此前零覆盖——列名改了到底落没落库、PAT 是不是仍然按密码框呈现，都只靠文本断言。
  //   这里真点真读：改列名 → 失焦即写 → 回读 zy_data_v2.airtableSync.tagColumn；顺带核 PAT 输入框是 password。
  await page.goto(base + '#/settings?page=airtable', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const atTagInput = page.locator('.gs-setting-row').filter({ hasText: '标签列名' }).locator('input.gs-input')
  const atTagVisible = await atTagInput.isVisible().catch(() => false)
  await atTagInput.fill('Tags（知源同步）').catch(() => {})
  await atTagInput.blur().catch(() => {})
  await page.waitForTimeout(900)
  const atPatType = await page.locator('.gs-setting-row').filter({ hasText: 'Personal Access Token' })
    .locator('input').first().getAttribute('type').catch(() => '')
  const atStored = await page.evaluate(() => chrome.storage.local.get('zy_data_v2')
    .then(r => (r['zy_data_v2'].airtableSync || {}).tagColumn))
  /* 清空要回落默认列名：留空不是"没配"，是"用默认"，这条也得是真跑过的 */
  await atTagInput.fill('').catch(() => {})
  await atTagInput.blur().catch(() => {})
  await page.waitForTimeout(900)
  const atCleared = await page.evaluate(() => chrome.storage.local.get('zy_data_v2')
    .then(r => (r['zy_data_v2'].airtableSync || {}).tagColumn))
  report('E2E-34 ★R4-Dd 标签列名落盘 + 留空回落 + PAT 仍按密码框呈现',
    atTagVisible && atStored === 'Tags（知源同步）' && (atCleared === '' || atCleared === undefined) && atPatType === 'password',
    `列名框=${atTagVisible} 落库="${atStored}" 清空后="${atCleared}" PAT型=${atPatType}`)

  // E2E-35 ★R4-De 池卡定位不许落死页：真发一次 background 的单例定位消息（采集后按 Enter 走的就是这条），
  //   核三件事：① 落点是调度台资源卡池（URL 带 hl + hk=res）而不是 /workspace/zy-curation；
  //   ② 目标卡真的渲染出来并被高亮（flash 类 + data-rid）；③ 屏幕上没有「策展台不存在」死页文案。
  //   ★R2-④ 当年改了四处深链的落点，却漏了这四处共用的那个算式本身——所以采集侧一直还在跳死页。
  const deCardId = 'e2e-de-pool-card'
  await page.evaluate(async (cid) => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const d = cur['zy_data_v2']
    d.resources = (d.resources || []).filter(r => r.id !== cid)
    d.resources.unshift({
      id: cid, kind: 'resource', title: 'E2E 池卡定位', linkType: 'url', link: 'https://e2e-de.test/pool',
      workspaceId: 'zy-curation', categoryId: '', description: '', tags: ['E2E 定位'], assets: [],
      customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
    })
    await chrome.storage.local.set({ zy_data_v2: d })
  }, deCardId)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.evaluate((cid) => chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: 'zy-curation', hl: cid }), deCardId)
  /* ★两个时间窗都是踩过才知道的：
     ① 落点 query 是**瞬态**的——PoolCardsPanel 消费完 hl 会 router.replace 把 query 抹掉（防止下次进页面重复定位），
        所以 hash 必须早读（400ms），晚读只会看到干净的 `#/`，那不是没定位上；
     ② 高亮 flash 类只活 2s（highlightId 到点自清），所以要用轮询抓"曾经亮过"，不能睡完再查。 */
  await page.waitForTimeout(400)
  const deHash = await page.evaluate(() => location.hash)
  let deFlash = false
  for (let i = 0; i < 14 && !deFlash; i++) {
    deFlash = await page.evaluate((cid) => !!document.querySelector(`[data-rid="${cid}"].flash`), deCardId)
    if (!deFlash) await page.waitForTimeout(200)
  }
  const de = await page.evaluate((cid) => ({
    dead: document.body.innerText.includes('策展台不存在'),
    row: !!document.querySelector(`[data-rid="${cid}"]`)
  }), deCardId)
  de.hash = deHash
  de.flash = deFlash
  /* ★落点 query 核不了，而且**不该**核：PoolCardsPanel 的 hl watcher 是 immediate 的，
     消费完在同一拍里就 router.replace 把 hl/hk 抹掉（防下次进页面重复定位），
     400ms 时读到的 hash 已经是干净的 `#/`。所以这里判的是可观测的三件事：
     ① 没落在工作区路由上（这正是本轮修的 bug：/workspace/zy-curation 死页）；
     ② 没有「策展台不存在」文案；③ 目标卡真的在池面板里渲染出来并被高亮过。 */
  report('E2E-35 ★R4-De 池卡定位落调度台卡池并高亮，不落「策展台不存在」死页',
    !de.hash.includes('/workspace/') && !de.dead && de.row && de.flash,
    `落点=${de.hash.slice(0, 46)} 非工作区死链=${!de.hash.includes('/workspace/')} 死页=${de.dead} 卡上屏=${de.row} 高亮=${de.flash}`)

  // E2E-36 ★R4-Dg 池的显示名单源 + 导出 Markdown 不许漏池卡。
  //   改前的两层漏：① 台名取 workspace 实体的 name ⇒ 存量库印「资源台」（R61 留下的历史名）、新库印「未知」（根本没有那枚实体）；
  //   ② 导出按 `for (const ws of d.workspaces)` 再按「该台的分类」分组 ⇒ 池卡在新库里没有实体、
  //      而且池卡 categoryId 恒空（R179 起标签独任组织），两层 for 都接不住它们——整批池卡从导出物里静默消失。
  //   判据：真点一次「导出MD」，读导出物本体（不是读界面）。
  const dgTitles = ['E2E-Dg 池卡甲', 'E2E-Dg 池卡乙']
  await page.evaluate((titles) => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    d.resources = (d.resources || []).filter(r => !String(r.title || '').startsWith('E2E-Dg 池卡'))
    titles.forEach((t, i) => d.resources.unshift({
      id: 'e2e-dg-' + i, kind: 'resource', title: t, linkType: 'url', link: `https://e2e-dg.test/${i}`,
      workspaceId: 'zy-curation', categoryId: '', tags: ['E2E-Dg'], description: `导出核收 ${i}`, assets: [],
      customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
    }))
    return chrome.storage.local.set({ zy_data_v2: d })
  }), dgTitles)
  await page.goto(base + '#/settings?page=export', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  /* 抓 Blob 而不是抓下载文件：downloadFile 走 createObjectURL + a.click()，headless 里落盘路径不可控，
     而"导出物里到底有没有池卡"这件事只看内容。 */
  await page.evaluate(() => {
    const orig = URL.createObjectURL.bind(URL)
    window.__dgBlob = null
    URL.createObjectURL = (b) => { window.__dgBlob = b; return orig(b) }
  })
  const dgBtn = page.locator('button.gs-btn', { hasText: '导出MD' }).first()
  const dgClicked = (await dgBtn.count()) ? await dgBtn.click().then(() => true).catch(() => false) : false
  await page.waitForTimeout(1200)
  const dgMd = await page.evaluate(async () => (window.__dgBlob ? await window.__dgBlob.text() : ''))
  const dgPoolH2 = /^##\s*资源卡池\s*$/m.test(dgMd)
  const dgTitlesIn = dgTitles.filter(t => dgMd.includes(t)).length
  const dgOldName = dgMd.includes('资源台')
  const dgNoCat = /^###\s*待分类\s*$/m.test(dgMd)
  report('E2E-36 ★R4-Dg 导出 Markdown 含池卡且台名走单源（「资源卡池」，无分类的池卡落「待分类」段）',
    dgClicked && dgPoolH2 && dgTitlesIn === dgTitles.length && !dgOldName && dgNoCat,
    `点击=${dgClicked} 导出物长度=${dgMd.length} 资源卡池段=${dgPoolH2} 池卡入列=${dgTitlesIn}/${dgTitles.length} 待分类段=${dgNoCat} 旧名残留=${dgOldName}`)

  // E2E-37（R4-Pa）★应用内 ⌘K 检索面板的真跑覆盖 + 召回逐条核。
  //   ★为什么这一条必须存在：GlobalPopups.vue 那条链（allResults → blobOf/normKey → hitRank →
  //   groupedResults）此前在 e2e 与 theme-audit 里都是零触点（grep 'gp-overlay' / 'gp-search-input'
  //   两个脚本各零命中），也就是说**面板只有源码文本可见**——R4-Pa 动的正是命中判据（拼音闸门、
  //   归一化改缓存），这类改动一旦把召回改窄，页面照样能打开、typecheck 照样 0、老断言照样绿。
  //   六种词面各盯一条通道：中文子串 / 拼音首字母 / 归一化跨分隔符 / 数字词（闸门判 false 的那类）/
  //   多词 AND / 零命中不许误报；归档卡走另一份判据（archivedMatchCount）但共用同一个 hitResult。
  //   最后一档验"结果表按数据失效"：关面板 → 真新建一张卡 → 再开面板要能搜到（缓存不能把新卡吞了）。
  const paTitles = {
    cjk: 'E2E-Pa 深度学习笔记', py: 'E2E-Pa 知识汇总', norm: 'E2E-Pa db-skill 手册',
    digit: 'E2E-Pa 第 12 号', archived: 'E2E-Pa 归档卡', deleted: 'E2E-Pa 回收站卡'
  }
  await page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    const mk = (id, title, extra) => Object.assign({
      id, kind: 'resource', title, linkType: 'url', link: `https://e2e-pa.test/${id}`,
      workspaceId: 'zy-curation', categoryId: '', tags: ['E2E-Pa'], description: '判据覆盖用',
      assets: [], customFields: {}, pinned: false, starred: false, callCount: 0,
      createdAt: Date.now(), updatedAt: Date.now()
    }, extra || {})
    d.resources = (d.resources || []).filter(r => !String(r.title || '').startsWith('E2E-Pa'))
    d.resources.unshift(
      mk('e2e-pa-1', t.cjk),
      mk('e2e-pa-2', t.py),
      mk('e2e-pa-3', t.norm),
      mk('e2e-pa-4', t.digit),
      mk('e2e-pa-5', t.archived, { lifecycleArchived: true }),
      mk('e2e-pa-6', t.deleted, { deletedAt: Date.now() })
    )
    return chrome.storage.local.set({ zy_data_v2: d })
  }), paTitles)
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const paOpen = async () => {
    await page.evaluate(() => {
      if (!document.querySelector('.gp-overlay.open')) {
        const btn = [...document.querySelectorAll('.icon-btn')].find(e => (e.getAttribute('title') || '').includes('全局搜索'))
        if (btn) btn.click()
      }
    })
    await page.waitForTimeout(500)
  }
  const paSearch = async (q) => {
    await paOpen()
    await page.locator('.gp-search-input').fill(q)
    await page.waitForTimeout(420)   // 面板防抖 120ms + 一轮渲染
    const titles = await page.locator('.gp-result-item .gp-ri-title').allTextContents()
    const hint = (await page.locator('.gp-archived-hint').count()) ? await page.locator('.gp-archived-hint').first().textContent() : ''
    return { titles: titles.map(s => (s || '').trim()), hint: (hint || '').trim() }
  }
  await paSearch('E2E-Pa')
  const paAll = await paSearch('E2E-Pa')
  // 拼音通道：'zshz' 是「知识汇总」的首字母串，逐字取自 pinyinTable 的 INITIALS（第一次我凭读感写成
  //   'zhhz'，跑出来 false —— 那条错在测试自己的期望值，不在被测代码；这类词面一律按表算）
  const paPy = await paSearch('zshz')
  const paNorm = await paSearch('db skill')                 // 词间空格 ≡ 数据里的连字符（R117-F6 归一化）
  const paDigit = await paSearch('12 号')                    // 数字词：拼音通道不可能成立，必须靠子串
  const paAnd = await paSearch('E2E-Pa 汇总')                // 多词 AND
  const paNone = await paSearch('zzqqxx')                    // 零命中不许捞出一张
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // 结果表失效验证：先在关面板的状态下经真实快捷键采集面板新建一张卡，再开面板搜它。
  // V3.9.1 二级页已按要求移除“新建”，所以这条准备步骤改走用户真正的建卡主路径。
  const paPreMissing = (await paSearch('E2E-Pa 新建缓存卡')).titles.length === 0
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('src/newtab/index.html') + '*' })
    if (tabs[0] && tabs[0].id) await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-capture' })
  })
  await page.getByText('快速采集资源卡').first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
  await page.locator('.gp-overlay.open .gp-field-input').nth(0).fill('E2E-Pa 新建缓存卡').catch(() => {})
  await page.locator('.gp-overlay.open .gp-field-input').nth(1).fill('https://e2e-pa.test/new').catch(() => {})
  await page.locator('.gp-overlay.open button', { hasText: '保存（Ctrl+Enter）' }).first().click().catch(() => {})
  await page.waitForTimeout(1200)
  // 保存后采集面板仍以“已保存”状态留在屏幕上。先按用户真实路径关掉浮层，
  // 再打开搜索，避免 paOpen() 看到已有 open 浮层后误以为搜索面板已经打开。
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('.gp-overlay.open'), null, { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(300)
  const paAfterCreate = (await paSearch('E2E-Pa 新建缓存卡')).titles
  const paHits = (r, s) => r.titles.some(t => t.includes(s))
  const paAllOk = [paTitles.cjk, paTitles.py, paTitles.norm, paTitles.digit].every(s => paAll.titles.some(t => t.includes(s)))
    && !paAll.titles.some(t => t.includes(paTitles.archived)) && !paAll.titles.some(t => t.includes(paTitles.deleted))
  report('E2E-37 ★R4-Pa 应用内 ⌘K 面板真跑：中文/拼音/归一化/数字/多词 AND/零命中六档召回逐条核 + 归档卡只进「另有 N 张」+ 新建卡立刻可搜（结果表按数据失效，不是按开合）',
    paAllOk && /另有\s*1\s*张/.test(paAll.hint) && paHits(paPy, paTitles.py) && paHits(paNorm, paTitles.norm) &&
    paHits(paDigit, paTitles.digit) && paAnd.titles.length === 1 && paAnd.titles[0].includes(paTitles.py) &&
    paNone.titles.length === 0 && paPreMissing && paAfterCreate.length === 1 && paAfterCreate[0].includes('E2E-Pa 新建缓存卡'),
    `六档：全量=${paAll.titles.length}（归档提示「${paAll.hint}」）拼音 zshz=${paHits(paPy, paTitles.py)} 归一「db skill」=${paHits(paNorm, paTitles.norm)} 数字「12 号」=${paHits(paDigit, paTitles.digit)} AND=${paAnd.titles.length} 零命中=${paNone.titles.length} ｜ 缓存失效：建前搜不到=${paPreMissing} 建后搜到=${paAfterCreate.length}`)

  // E2E-38（R4-Dk）★⌘K 面板「转化为资源卡」真点一次：落点、公共字段、出路记账、回执与「查看」落点
  //   为什么必须真点：这条路径的三种库形状差异（默认库落进事业策展台 / 存量库落到退役的「资源台」空台面 /
  //   没有 hub 实体的库点「查看」是「策展台不存在」）与字段搬运，只有运行时看得见——源码里它就是一行 workspaces[0]。
  const dkQ = 'R4-Dk 转化探针好奇心'
  await page.evaluate((q) => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    d.curiosities = (d.curiosities || []).filter(c => !String(c.question || '').startsWith(q))
    d.resources = (d.resources || []).filter(r => !String(r.title || '').startsWith(q))
    d.curiosities.unshift({
      id: 'e2e-dk-1', kind: 'curiosity', question: q + '：它到底落在哪个台', description: 'DK 描述必须活着',
      status: 'doing', tags: ['DK 标签', 'AI'], starred: true, pinned: true,
      assets: [{ id: 'e2e-dk-as', kind: 'pdf', name: 'DK 附件.pdf', size: 8, mime: 'application/pdf', createdAt: Date.now() }],
      customFields: { custom_dk: '带过来的值' }, relatedResourceIds: [], createdAt: Date.now(), updatedAt: Date.now()
    })
    return chrome.storage.local.set({ zy_data_v2: d })
  }), dkQ)
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await paOpen()
  await page.locator('.gp-search-input').fill(dkQ)
  await page.waitForTimeout(500)
  const dkRowFound = await page.locator('.gp-result-item', { hasText: dkQ }).count()
  // .gp-ri-actions 在面板里被 tab 条挡住命中（真机靠 hover 露出），这里点 handler 而不是坐标
  const dkMenuHit = (await page.locator('.gp-result-item', { hasText: dkQ }).first().locator('.convert span').count())
    ? await page.evaluate((q) => {
      const row = [...document.querySelectorAll('.gp-result-item')].find(e => (e.textContent || '').includes(q))
      const sp = row && row.querySelector('.convert span')
      if (!sp) return false
      sp.click()
      return true
    }, dkQ) : false
  await page.waitForTimeout(350)
  const dkItemHit = await page.evaluate((q) => {
    const it = [...document.querySelectorAll('.gp-convert-menu-item')].find(e => (e.textContent || '').includes('转化为资源卡'))
    if (!it) return false
    it.click()
    return true
  }, dkQ)
  await page.waitForTimeout(900)
  const dkAfter = await page.evaluate((q) => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
    const st = pinia && pinia._s.get('app')
    const dd = st && st.data
    const r = (dd.resources || []).find(x => String(x.title).startsWith(q))
    const c = (dd.curiosities || []).find(x => x.id === 'e2e-dk-1')
    return {
      有卡: !!r, ws: r ? r.workspaceId : '', cat: r ? r.categoryId : '',
      tags: r ? JSON.stringify(r.tags) : '', 描述: r ? r.description === 'DK 描述必须活着' : false,
      附件: r ? (r.assets || []).length === 1 : false, 自定义: r ? r.customFields && r.customFields.custom_dk === '带过来的值' : false,
      星标: r ? !!r.starred : false, 置顶: r ? !!r.pinned : false,
      软删好奇: !!(c && c.deletedAt), 出路: c ? c.convertedTo : ''
    }
  }, dkQ)
  const dkToast = (await page.locator('.toast-msg', { hasText: '已转化为资源卡' }).count()) > 0
  const dkPoolReceipt = (await page.locator('.toast-msg', { hasText: '存入资源卡池' }).count()) > 0
  const dkView = (await page.locator('.toast-action', { hasText: '查看' }).count()) > 0
    ? await page.locator('.toast-action', { hasText: '查看' }).first().click({ force: true }).then(() => true).catch(() => false) : false
  await page.waitForTimeout(1300)
  const dkLanding = await page.evaluate((q) => ({
    hash: location.hash,
    死页: document.body.innerText.includes('策展台不存在'),
    旧台面: document.body.innerText.includes('中心论点') && document.body.innerText.includes('个分类'),
    高亮: document.querySelectorAll('.pcp-card.flash, .pcp-row.flash').length,
    池面可见: [...document.querySelectorAll('.pcp-card, .pcp-row')].some(e => (e.textContent || '').includes(q))
  }), dkQ)
  report('E2E-38 ★R4-Dk ⌘K 面板真点「转化为资源卡」：落点=资源卡池（不是 workspaces[0] 那枚恰好排第一的台）、标签/描述/附件/自定义字段/星标/置顶整片带过来、写 convertedTo=res、回执改口「存入资源卡池」、「查看」落调度台卡池并高亮（不进死页也不进退役空台面）',
    dkRowFound === 1 && dkMenuHit && dkItemHit && dkAfter.有卡 && dkAfter.ws === 'zy-curation' && dkAfter.cat === ''
    && dkAfter.tags === '["DK 标签","AI"]' && dkAfter.描述 && dkAfter.附件 && dkAfter.自定义 && dkAfter.星标 && dkAfter.置顶
    && dkAfter.软删好奇 && dkAfter.出路 === 'res' && dkToast && dkPoolReceipt && dkView
    // ★落点判"没去策展台"而不是"hash 里带 hl="：消费端（CompassHome/PoolCardsPanel）定位后会清掉 query
    //   （R2-④ 那条"定位不清过滤即落空"），1.3 秒后读到的 hash 就是 #/ ——拿 ?hl 当证据会假红。
    && !dkLanding.hash.startsWith('#/workspace/') && !dkLanding.死页 && !dkLanding.旧台面
    && dkLanding.池面可见 && dkLanding.高亮 >= 1,
    `搜到=${dkRowFound} 菜单=${dkMenuHit}/${dkItemHit} 落点=${dkAfter.ws} 分类=${JSON.stringify(dkAfter.cat)} 标签=${dkAfter.tags} 描述/附件/自定义/星标/置顶=${dkAfter.描述}/${dkAfter.附件}/${dkAfter.自定义}/${dkAfter.星标}/${dkAfter.置顶} 出路=${dkAfter.出路} 回执含「资源卡池」=${dkPoolReceipt} ｜ 查看→${dkLanding.hash} 死页=${dkLanding.死页} 旧台面=${dkLanding.旧台面} 高亮=${dkLanding.高亮} 池面可见=${dkLanding.池面可见}`)

  // E2E-39（R4-Ep）★好奇心「归档为资源」弹窗在两种库形状下真点一次。
  //   起因（/tmp/zy_ep_probe.cjs 实测改前）：下拉的可选台列表由本组件自己从**原始 d.workspaces** filter，
  //   存量库第一枚是 R61 留下的 hub 实体 ⇒ 选项印「🗂 资源台」且是默认项，确认后回执印成
  //   「✓ 已归档至「🗂 资源台」资源台」（台名 + 硬后缀撞成两个旧世界词）；新库没有那枚实体 ⇒ 同一个动作默认落进「💼 事业策展台」。
  //   ★这条为什么值得运行时覆盖：源码文本断言里"下拉印什么名、默认选谁"表现为什么都没变，而它是用户每天点的动作。
  const epQ = 'R4-Ep 归档探针好奇心'
  const epSnapshot = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(c => JSON.stringify(c['zy_data_v2'])))
  async function epRun(label, wsList) {
    await page.evaluate(({ ws, q }) => chrome.storage.local.get('zy_data_v2').then(cur => {
      const d = cur['zy_data_v2']
      d.workspaces = ws
      const keep = (d.curiosities || []).filter(c => !String(c.question || '').includes(q))
      d.curiosities = [{
        id: 'ep-curo-1', kind: 'curiosity', question: q, status: 'doing', pinned: false,
        tags: [], assets: [], customFields: {}, callCount: 0, createdAt: 1760000000000, updatedAt: 1760000000000
      }, ...keep]
      d.resources = (d.resources || []).filter(r => !String(r.title || '').includes(q))
      return chrome.storage.local.set({ zy_data_v2: d })
    }), { ws: wsList, q: epQ })
    await page.goto(base + '#/deck/curiosity', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    /* ★点的是探针那张卡所在的行，不是"第一行"：面板默认按创建时间排，硬造的探针卡不一定排最前——
       取第一行会转化到别人的卡上，toast 照样绿、落库核收空（第一版就红在这）。 */
    await page.locator('.cz-list-item, .cz-card', { hasText: epQ }).first().click().catch(() => {})
    await page.waitForTimeout(800)
    const kv = page.locator('.ds-kv', { hasText: '归档资源' }).first()
    if (await kv.count()) await kv.click().catch(() => {})
    else await page.locator('button', { hasText: '归档' }).first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(900)
    const form = await page.evaluate(() => {
      const m = document.querySelector('.cz-modal')
      const sel = document.querySelector('.cz-modal-select')
      const labels = m ? [...m.querySelectorAll('.cz-modal-label')].map(l => (l.textContent || '').trim()) : []
      return {
        开: !!m && !!sel,
        选项: sel ? [...sel.options].map(o => (o.textContent || '').trim() + '→' + o.value) : [],
        文本: sel ? [...sel.options].map(o => (o.textContent || '').trim()) : [],
        默认: sel ? sel.value : '',
        标签: labels
      }
    })
    await page.locator('.cz-modal-foot button', { hasText: '确认转化' }).first().click().catch(() => {})
    await page.waitForTimeout(1300)
    const toast = await page.evaluate(() => {
      const t = document.querySelector('[class*=toast]')
      return t ? (t.textContent || '').trim() : ''
    })
    /* 读**内存态 store**而不是 chrome.storage：转化走 store.persist()，落盘是异步的（E2E-38 同一取证面，
       拿 storage 当证据会把"已转化"读成"无卡"——我第一次就踩了这个）。 */
    await page.waitForFunction((q) => {
      const app = document.querySelector('#app').__vue_app__
      const prov = app && app._context && app._context.provides
      let pinia = null
      for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
      const dd = pinia && pinia._s.get('app') && pinia._s.get('app').data
      return !!dd && (dd.resources || []).some(x => String(x.title || '').includes(q))
    }, epQ, { timeout: 5000 }).catch(() => {})
    const after = await page.evaluate((q) => {
      const app = document.querySelector('#app').__vue_app__
      const prov = app && app._context && app._context.provides
      let pinia = null
      for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
      const dd = pinia && pinia._s.get('app') && pinia._s.get('app').data
      const r = dd ? (dd.resources || []).find(x => String(x.title || '').includes(q)) : null
      return { 有卡: !!r, ws: r ? r.workspaceId : '无', cat: r ? JSON.stringify(r.categoryId) : '-' }
    }, epQ)
    return { label, form, toast, after }
  }
  const epHub = await epRun('存量库（hub 实体排第一）', [
    { id: 'zy-curation', name: '🗂 资源台', icon: '🗂', order: -1, archived: false, kind: 'resource' },
    { id: 'ws-biz-000', name: '💼 事业策展台', icon: '💼', order: 0, archived: false }
  ])
  const epFresh = await epRun('新库（无 hub 实体）', [
    { id: 'ws-biz-000', name: '💼 事业策展台', icon: '💼', order: 0, archived: false },
    { id: 'ws-b-1', name: '🧪 另一个台', icon: '🧪', order: 1, archived: false }
  ])
  // 还原快照，别把后面的用例建在同一份改造过的库上
  await page.evaluate((raw) => chrome.storage.local.set({ zy_data_v2: JSON.parse(raw) }), epSnapshot)
  await page.goto(base + '#/deck/curiosity', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const epOk = (r) => r.form.开 && r.form.文本[0] === '资源卡池' && r.form.选项[0].endsWith('→zy-curation')
    && r.form.文本.filter(t => t.includes('资源台')).length === 0 && r.form.默认 === 'zy-curation'
    && r.form.标签.includes('存入位置') && r.toast.includes('已归档至「资源卡池」') && !r.toast.includes('资源台')
    && r.after.有卡 && r.after.ws === 'zy-curation'
  report('E2E-39 ★R4-Ep 好奇心归档弹窗真点（两种库形状）：下拉首项=「资源卡池」且退役名残留 0、默认选中=zy-curation（不再随实体顺序漂移）、标签=「存入位置」、回执=「已归档至「资源卡池」」且不含「资源台」、落库 workspaceId=zy-curation',
    epOk(epHub) && epOk(epFresh),
    `${epHub.label} 开=${epHub.form.开} 选项=${JSON.stringify(epHub.form.选项)} 默认=${epHub.form.默认} 标签=${JSON.stringify(epHub.form.标签)} 退役名残留=${epHub.form.文本.filter(t => t.includes('资源台')).length} toast=${JSON.stringify(epHub.toast)} 落点=${epHub.after.ws} ｜ ${epFresh.label} 选项=${JSON.stringify(epFresh.form.选项)} 默认=${epFresh.form.默认} toast=${JSON.stringify(epFresh.toast)} 落点=${epFresh.after.ws}`)

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

  // ══════════ E2E-40（R4-Ew）★content 采集面板的「保存」写库链路 ══════════
  // 此前 theme-audit 只拍了面板的样子（ov-capture 场景），从"点保存"到"卡真进资源卡池"这一段
  // 在 e2e 与 theme-audit 里都是零触点——保存路径坏了（比如落错台、回执文案变了）视觉门禁照样全绿。
  // 浮层注入在 http/https 页，扩展页没有它的宿主 ⇒ 与 theme-audit / perf 同一手法起一个本地宿主页。
  const http = require('http')
  const capServer = http.createServer((rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    rs.end('<!doctype html><title>E2E 采集宿主</title><h1>采集浮层宿主</h1><p>用于验证 content 侧保存写库链路。</p>')
  })
  await new Promise(r => capServer.listen(0, '127.0.0.1', r))
  const capPort = capServer.address().port
  const capPage = await ctx.newPage(); capPage.setDefaultTimeout(20000)
  await capPage.goto(`http://127.0.0.1:${capPort}/`, { waitUntil: 'load' })
  await capPage.waitForTimeout(1600)
  const capTitle = 'E2Ew 采集链路探针'
  await page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then(cur => {
    const d = cur['zy_data_v2']; d.resources = (d.resources || []).filter(x => x.title !== t)
    return chrome.storage.local.set({ zy_data_v2: d })
  }), capTitle)
  await worker.evaluate(async (p) => {
    const tabs = await chrome.tabs.query({ url: `http://127.0.0.1:${p}/*` })
    if (!tabs[0]) throw new Error('宿主页 tab 未找到')
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-capture' })
  }, capPort)
  // W4（V3.8.4）：采集面板台/分类下拉已退役，改静态池提示行 .zy-cap-pool（统一入资源卡池）。
  // 就绪锚从 #__zy_cap_ws__ 换成保存钮 #__zy_cap_save__；下拉「已删」用负锚钉死，防止门禁和实现一起漂回下拉形态。
  const capReady = !!(await capPage.waitForSelector('#__zy_cap_save__', { timeout: 9000 }).catch(() => null))
  let capToast = '', capRow = { 有卡: false, ws: '无', catEmpty: false, link: '' }, capPoolText = '', capDropGone = false
  if (capReady) {
    capPoolText = (await capPage.evaluate(() => {
      const r = document.querySelector('.zy-cap-pool')
      return r ? (r.textContent || '').trim() : ''
    })) || ''
    capDropGone = await capPage.evaluate(() => !document.getElementById('__zy_cap_ws__') && !document.getElementById('__zy_cap_cat__'))
    await capPage.fill('#__zy_cap_title__', capTitle)
    await capPage.click('#__zy_cap_save__')
    await capPage.waitForTimeout(1000)
    capToast = ((await capPage.locator('#__zy_toast__').textContent().catch(() => '')) || '').trim()
    // ★踩坑记账（本轮第一版就是这么写的，当场 Cannot read properties of undefined (reading 'local')）：
    // MV3 的 http 宿主页里没有 chrome.storage，写错成 capPage.evaluate((t) => chrome.storage.local.get(...)) 一定取不到库，
    // 测试取库/写库一律回扩展页 page.evaluate ——这条由判据 R4-Ew② 的负锚守着（所以它必须吃 codeOnly，注释不算代码）。
    capRow = await page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then(r => {
      const c = (r['zy_data_v2'].resources || []).find(x => x.title === t)
      return c ? { 有卡: true, ws: c.workspaceId || '无', catEmpty: !c.categoryId, link: c.link || '' } : { 有卡: false, ws: '无', catEmpty: false, link: '' }
    }), capTitle)
    await page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then(cur => {
      const d = cur['zy_data_v2']; d.resources = (d.resources || []).filter(x => x.title !== t)
      return chrome.storage.local.set({ zy_data_v2: d })
    }), capTitle)
  }
  await capPage.close(); capServer.close()
  report('E2E-40 ★R4-Ew/W4 content 采集面板真点「保存」：浮层在 http 宿主页唤起、台/分类下拉已退役改静态池提示行、保存后回执 toast 出现、卡落库 workspaceId=zy-curation 且分类留空',
    capReady && capPoolText.includes('资源卡池') && capDropGone && /资源卡池/.test(capToast) && capRow.有卡 && capRow.ws === 'zy-curation' && capRow.catEmpty,
    `唤起=${capReady} 池行=${JSON.stringify(capPoolText.slice(0, 40))} 下拉已删=${capDropGone} toast=${JSON.stringify(capToast)} 落库=${JSON.stringify(capRow)}`)

  // ══════════ E2E-41（R4-Ew）★⌘K 结果行 hover 动作区：三枚钮 + 星标真写库再复原 ══════════
  // theme-audit 的 gp-search 只数了"hover 露出几枚钮"，没钉**是哪三枚、点了有没有落库**——
  // 把 title 改错或把 toggleStar 接断，像素层看不出来。词面故意自己种一张探针卡（E2E-38 的教训：
  // 靠库里现成的卡当锚点，会随库变化而搜不到，那一屏就退化成"什么都没测"）。
  const gpQ = 'E2Ew 星标探针'
  await page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then(cur => {
    const d = cur['zy_data_v2']
    d.resources = (d.resources || []).filter(r => !String(r.title || '').startsWith(t))
    d.resources.unshift({ id: 'e2e-ew-star2', kind: 'resource', title: t + ' 乙卡', link: 'https://example.com/ew2', workspaceId: 'zy-curation', categoryId: '', tags: [], starred: false, createdAt: Date.now(), updatedAt: Date.now() })
    d.resources.unshift({ id: 'e2e-ew-star', kind: 'resource', title: t, link: 'https://example.com/ew', workspaceId: 'zy-curation', categoryId: '', tags: [], starred: false, createdAt: Date.now(), updatedAt: Date.now() })
    // ★W1.1 取景侧稳健化（非产品改动）：R60-2 的默认选中（watch(filteredResults) → syncIdFromIndex）
    //   会把 selected 锚到结果第一行 ⇒ 若探针卡自己排第一，hover 前 opacity 恒为 1（.selected 同样抬不透明度）、
    //   「未选中」断言必假。种一张置顶诱饵卡（markRank 2 > 0）吸走第一行与默认选中态，
    //   探针卡落非首行 ⇒ hover 前 opacity=0 才是它自己的读数。排序口径：置顶>星标>命中强度（marksort.ts）。
    d.resources.unshift({ id: 'e2e-ew-decoy', kind: 'resource', title: t + ' 置顶诱饵', link: 'https://example.com/ewd', workspaceId: 'zy-curation', categoryId: '', tags: [], starred: false, pinned: true, createdAt: Date.now(), updatedAt: Date.now() })
    return chrome.storage.local.set({ zy_data_v2: d })
  }), gpQ)
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
await paOpen()
  await page.locator('.gp-search-input').fill(gpQ)
  await page.waitForTimeout(900)
  // ★W1.1 取景侧稳健化（非产品改动）：面板默认 selected 落第一行=探针行本身时会把 hover 前 opacity 抬成 1；
  //   另有上一用例残留鼠标坐标恰落在结果行上也会触发 :hover/ mouseenter 选中。先把鼠标挪出结果区再采样。
  await page.mouse.move(4, 4)
  await page.waitForTimeout(250)
  const gpRow = await page.evaluate((t) => {
    // 搜索结果的首行会被默认选中，且鼠标扫过结果区也会把 hover 行保持为 selected。
    // 本用例要验的是「未选中行 hover 才显动作区」，因此从真实结果中挑一条非选中资源行，
    // 而不是假设固定探针一定是未选中态。
    const rows = [...document.querySelectorAll('.gp-result-item')]
    const candidates = rows.filter(r =>
      r.querySelector('.gp-ri-actions') && !r.classList.contains('selected') &&
      ((r.querySelector('.gp-ri-title') || {}).textContent || '').trim()
    )
    const row = candidates.find(r => ((r.querySelector('.gp-ri-title') || {}).textContent || '').trim() === t) || candidates[0]
    if (!row) return { found: false, titles: [], actsOpacity: '' }
    const target = ((row.querySelector('.gp-ri-title') || {}).textContent || '').trim()
    const box = row.querySelector('.gp-ri-actions')
    return {
      found: true,
      target,
      titles: [...row.querySelectorAll('.gp-ri-act')].map(b => (b.getAttribute('title') || '').trim()),
      未选中: !row.classList.contains('selected'),
      actsOpacity: box ? getComputedStyle(box).opacity : '无动作区',
      全部行: [...document.querySelectorAll('.gp-result-item .gp-ri-title')].map(x => ((x.textContent || '').trim())).slice(0, 5),
    }
  }, gpQ)
  const gpTarget = gpRow.target || gpQ
  await page.locator('.gp-result-item', { has: page.locator('.gp-ri-title', { hasText: new RegExp('^' + gpTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).first().hover().catch(() => {})
  await page.waitForTimeout(350)
  const gpHover = await page.evaluate((t) => {
    const row = [...document.querySelectorAll('.gp-result-item')].find(r => ((r.querySelector('.gp-ri-title') || {}).textContent || '').trim() === t)
    const box = row && row.querySelector('.gp-ri-actions')
    return box ? Number(getComputedStyle(box).opacity) : -1
  }, gpTarget)
  const gpClickStar = () => page.evaluate((q) => {
    const row = [...document.querySelectorAll('.gp-result-item')].find(r => ((r.querySelector('.gp-ri-title') || {}).textContent || '').trim() === q)
    const b = row && row.querySelector('.gp-ri-act')          // 第一枚就是星标（.gp-ri-actions 被 tab 条挡住，点 handler 不点坐标）
    if (b) b.click()
    return !!b
  }, gpTarget)
  // 星标会立即改内存 store，写盘则走 300ms 防抖；读 storage 会在“点后/复原前”读到旧值。
  // 这里读同一份内存态，仍核真实 toggleStar 是否改变卡片字段。
  const gpReadStar = () => page.evaluate((t) => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
    const st = pinia && pinia._s.get('app')
    const c = st && (st.data.resources || []).find(x => x.title === t)
    return c ? !!c.starred : '无卡'
  }, gpTarget)
  await gpClickStar()
  await page.waitForTimeout(1500)
  const starAfter = await gpReadStar()
  // 星标会改变排序权重，行可能被默认选中；按标题重新取卡后再点一次，避免点到重排后的另一行。
  await page.mouse.move(4, 4)
  await page.waitForTimeout(250)
  await gpClickStar()
  await page.waitForTimeout(1500)
  const starBack = await gpReadStar()
  await page.keyboard.press('Escape').catch(() => {})
  await page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then(cur => {
    const d = cur['zy_data_v2']; d.resources = (d.resources || []).filter(x => !String(x.title || '').startsWith(t))
    return chrome.storage.local.set({ zy_data_v2: d })
  }), gpQ)
  report('E2E-41 ★R4-Ew ⌘K 结果行 hover 动作区是真控件不是装饰：资源行三枚钮的 title 齐（星标/删除/打开链接）、hover 才从不透明变可见，点星标**真写库**再点回**真复原**',
    gpRow.found && gpRow.titles.length === 3 && gpRow.titles.some(x => x.includes('星标')) && gpRow.titles.some(x => x.includes('删除')) && gpRow.titles.some(x => x.includes('打开链接'))
    && gpRow.未选中 && Number(gpRow.actsOpacity) === 0 && gpHover > 0.9 && starAfter === true && starBack === false,
    `行=${gpRow.found} 钮=${JSON.stringify(gpRow.titles)} hover 前 opacity=${gpRow.actsOpacity} 面板行=${JSON.stringify(gpRow.全部行)} hover 后=${gpHover} starred: 点后=${JSON.stringify(starAfter)} 复原=${JSON.stringify(starBack)}`)

  // ══════════ E2E-42（R4-Ew）★画像洞察页四格 KPI 的下钻出口都真响应 ══════════
  // V3.9.1：调度台合流指标条退役，四类指标能力迁画像洞察页 PiHero。
  // 本用例保留 R4-Ew「不能只有数字、没有真出口」的原意，按新宿主的三种真实响应形态判：
  //   total/support → 卡片清单抽屉；entropy → 口径 toast；focus → 全量记录抽屉（focusOnly 预设）。
  await page.goto(base + '#/profile', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const heroKpiCount = await page.locator('.hero-kpis-grid .hero-kpi').count()
  const heroDrillRes = []
  for (const dr of [
    { i: 0, 名: '全库净资产', 型: 'drawer', 题: '全部卡片明细' },
    { i: 1, 名: '知识熵', 型: 'toast', 题: '知识熵' },
    { i: 2, 名: '任务有证据支撑', 型: 'drawer', 题: '任务证据支撑明细' },
    { i: 3, 名: '近30天精力落主攻', 型: 'log', 题: '全部记录' },
  ]) {
    await page.locator('.hero-kpis-grid .hero-kpi').nth(dr.i).click().catch(() => {})
    await page.waitForTimeout(900)
    const one = await page.evaluate((d) => {
      const drawerTitle = ((document.querySelector('.drawer-title') || {}).textContent || '').trim()
      const toast = [...document.querySelectorAll('.toast-msg')].map(x => (x.textContent || '').trim()).join(' ')
      const rows = document.querySelectorAll('.drawer .gs-ev-row').length
      const empty = !!document.querySelector('.drawer .gs-ev-empty')
      const logRows = document.querySelectorAll('.drawer .dz-log-row').length
      const logEmpty = !!document.querySelector('.drawer .dz-log-empty')
      const logNote = ((document.querySelector('.drawer .dz-log-note') || {}).textContent || '').trim()
      return {
        名: d.名,
        抽屉在: !!document.querySelector('.drawer'),
        题在: d.型 === 'toast' ? toast.includes(d.题) : drawerTitle.includes(d.题),
        题: drawerTitle.slice(0, 36),
        toast: toast.slice(0, 60),
        rows,
        empty,
        logRows,
        logEmpty,
        logNote: logNote.slice(0, 60),
      }
    }, dr)
    heroDrillRes.push({ ...one, 型: dr.型 })
    if (dr.型 === 'toast') {
      await page.waitForTimeout(1900)
    } else {
      await page.locator('.drawer .drawer-close').first().click().catch(() => {})
      await page.waitForFunction(() => document.querySelectorAll('.drawer').length === 0, null, { timeout: 4000 }).catch(() => {})
    }
  }
  const heroDrillOk = heroKpiCount === 4 && heroDrillRes.every(r =>
    r.题在 && (r.型 === 'toast'
      ? r.toast.includes('知识熵')
      : r.型 === 'log'
        ? r.抽屉在 && r.logNote.includes('近30天主攻动作') && (r.logRows > 0 || r.logEmpty)
        : r.抽屉在 && (r.rows > 0 || r.empty)))
  report('E2E-42 ★R4-Ew 画像洞察页四格 KPI 真响应：卡片清单抽屉 / 知识熵口径 toast / 主攻动作全量记录抽屉',
    heroDrillOk,
    heroDrillRes.map(r => `${r.名}:题=${r.题在} 抽屉=${r.抽屉在} 行=${r.rows} 日志行=${r.logRows} 空态=${r.logEmpty} note=${r.logNote} toast=${r.toast}`).join(' ｜ '))

  // ══════════ E2E-43（R4-Fb）★不可注入页的降级出口：两种入口都要真开面板 ══════════
  // 原来这条链的末端是一个**从未进过构建**的独立弹窗（dist/src/popup/index.html 仍引 ./main.ts、
  // manifest 无 default_popup）⇒ 用户在 chrome:// 按快捷键得到空白窗口。撤降级后出口是"进应用开对应面板"，
  // 有两种走法：有已开的新标签页就复用并发消息，一个都没有才新建并带 ?zy-panel=。**两条都得真跑**，
  // 只测一条会放过"另一条其实接不上"的半拉子实现。
  await page.goto(base + '?zy-panel=curio#/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  let qCurio = await page.locator('textarea.gp-curio-text').isVisible().catch(() => false)
  if (!qCurio) { await page.waitForTimeout(2500); qCurio = await page.locator('textarea.gp-curio-text').isVisible().catch(() => false) }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(600)
  const msgOk = await worker.evaluate(() => chrome.tabs.query({ url: chrome.runtime.getURL('src/newtab/index.html') + '*' })
    .then(ts => ts[0] ? chrome.tabs.sendMessage(ts[0].id, { type: 'zy-quick-panel', panel: 'capture' }).then(() => true) : '无新标签页')
    .catch(e => '发消息失败：' + e.message))
  await page.waitForTimeout(1600)
  const capHead = (((await page.locator('.gp-cap-title').first().textContent().catch(() => '')) || '') + '').trim()
  report('E2E-43 ★R4-Fb 撤掉那个从未进过构建的独立弹窗后，不可注入页的降级出口两种入口都真开面板：?zy-panel=curio 开出好奇面板；background 复用已开新标签页发 zy-quick-panel 开出采集面板',
    qCurio === true && msgOk === true && capHead.includes('快速采集资源卡'),
    `查询入口=好奇面板 ${qCurio} ｜ 消息入口回执=${JSON.stringify(msgOk)} 面板标题="${capHead}"`)

  // ══════════ E2E-44（R4-Fc）★Airtable「所属工作台」列值真出网形态：不许带图标前缀 ══════════
  // 这条量的是**离开机器那一列的值**，不是源码字符串：`Workspace.name` 存的是「icon + 空格 + 名称」，
  // 台内卡与镜像行改前各自 `find(w => w.id === …)?.name` 原样取实体名 ⇒ 同一列混着两种形态
  // （台内卡 `💼 事业策展台`、池卡/调度台/方向台不带图标），而下游按这列筛选分组的人得同时匹配两种写法。
  // 取证姿势：给 api.airtable.com 挂 route 桩（**绝不碰真网络、绝不引入真 PAT**），种一枚带图标的探针台 +
  // 一枚池卡投射到它，真点「立即同步」，把 POST/PATCH 的 fields 收进 Node 侧数组逐条判。
  const AT_FIELDS = [
    ['知源ID', 'singleLineText'], ['标题', 'singleLineText'], ['卡片类型', 'singleSelect'], ['所属工作台', 'singleLineText'],
    ['分类路径', 'singleLineText'], ['层级', 'number'], ['是否中心论点', 'checkbox'], ['链接', 'url'],
    ['描述', 'multilineText'], ['标签', 'singleLineText'], ['状态', 'singleLineText'], ['优先级', 'singleLineText'],
    ['截止日期', 'singleLineText'], ['已删除', 'checkbox'], ['更新时间', 'singleLineText']
  ].map(([name, type], i) => ({ id: 'fldE2E' + i, name, type }))
  const atCells = []
  await page.route('**://api.airtable.com/**', (route) => {
    const req = route.request()
    const u = req.url(), m = req.method()
    const body = (m === 'POST' || m === 'PATCH') ? (() => { try { return JSON.parse(req.postData() || '{}') } catch { return {} } })() : {}
    if ((m === 'POST' || m === 'PATCH') && /\/appE2EPROBE\/tblE2EPROBE/.test(u)) {
      for (const r of body.records || []) atCells.push(r.fields)
      const recs = (body.records || []).map((r, i) => ({ id: r.id || 'recE2E' + m + i }))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: recs }) })
    }
    if (u.includes('/meta/bases/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tables: [{ id: 'tblE2EPROBE', name: '知源同步（E2E 桩）', fields: AT_FIELDS }] }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [] }) })
  })
  const seedNote = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const d = r['zy_data_v2'] || {}
    const now = Date.now()
    const next = {
      ...d,
      workspaces: [{ id: 'ws-e2e-fc', name: '🧪 探针策展台', icon: '🧪' }],
      resources: [
        { id: 'card-e2e-fc', title: 'E2E-44 台内探针卡', workspaceId: 'ws-e2e-fc', categoryId: '', tags: [], updatedAt: now },
        { id: 'card-e2e-fc2', title: 'E2E-44 池卡（投射真身）', workspaceId: 'zy-curation', categoryId: '', tags: [], updatedAt: now }
      ],
      tasks: [], curiosities: [],
      curationProjections: [{ kind: 'card', cardId: 'card-e2e-fc2', targetWsId: 'ws-e2e-fc', targetCatId: '' }],
      airtableSync: { ...(d.airtableSync || {}), pat: 'pat-e2e-stub-only', baseId: 'appE2EPROBE', tableId: 'tblE2EPROBE', pollEnabled: false, cursorAt: 0, log: [] },
      airtableMap: {}
    }
    return chrome.storage.local.set({ zy_data_v2: next }).then(() => ({ hadRealWorkspaces: (d.workspaces || []).length }))
  }))
  await page.goto(base + '#/settings?page=airtable', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.locator('button.gs-btn-primary:has-text("立即同步")').first().click().catch(() => {})
  await page.waitForTimeout(2500)
  const atVals = atCells.map(f => String(f['所属工作台'] ?? ''))
  const cellOf = (id) => { const hit = atCells.find(f => f['知源ID'] === id); return hit ? String(hit['所属工作台']) : '(没推到)' }
  const iconRows = atVals.filter(v => /^\p{Extended_Pictographic}/u.test(v))
  report('E2E-44 ★R4-Fc 真点「立即同步」收到出网那一列的值（route 桩、零真网络、零真凭据）：台内卡与镜像行的「所属工作台」必须是剥图标的显示名，同一列不许两种形态',
    atCells.length > 0 && iconRows.length === 0
    && cellOf('card-e2e-fc') === '探针策展台' && cellOf('card-e2e-fc2:m:ws-e2e-fc') === '探针策展台'
    && cellOf('card-e2e-fc2') === '资源卡池',
    `出网 ${atCells.length} 行 · 带图标前缀 ${iconRows.length} 行${iconRows.length ? '（' + JSON.stringify(iconRows) + '）' : ''} ｜ 台内卡="${cellOf('card-e2e-fc')}" 镜像行="${cellOf('card-e2e-fc2:m:ws-e2e-fc')}" 池卡="${cellOf('card-e2e-fc2')}" ｜ 桩前真实台面数=${seedNote.hadRealWorkspaces}`)
  // 不用清场：ctx 是 launchPersistentContext('')——每次跑都是临时新 profile，探针库随进程结束一起没。
  await page.unroute('**://api.airtable.com/**').catch(() => {})

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
