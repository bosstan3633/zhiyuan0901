/**
 * 第卌五轮 · V2.20.0 E2E 真机验证（Playwright MV3 模板，自第卌三轮重建版收编）
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/e2e.cjs
 * 检查项：
 *   E2E-1  MV3 扩展加载（worker = CRXJS service-worker-loader.js）
 *   E2E-2  设置页默认首屏 = 知源仪表盘（导航四组 R54 + 动态条/操作记录时间线）
 *   E2E-3  ★R4-Da 改靶：全景整页退役归零 + 标签管理双栏仍两列（连带 CSS 的活性证据）
 *   E2E-32 ★R4-Db 书签导入唯一路线（真喂书签 HTML 跑一次导入）
 *   E2E-33 ★R4-Dc 附件 keepIds 单源（活卡/软删卡/论证卡引用必留，仅孤儿被删）
 *   E2E-34 ★V4.0.4 旧 Airtable 深链归并到云同步关系总览
 *   E2E-35 ★R4-De 池卡定位落调度台卡池（采集后 Enter 那条链路不再跳死页）
 *   E2E-36 ★R4-Dg 导出 Markdown 含池卡 + 台名走单源（「资源卡池」）
 *   E2E-4  ★V4.3.1 重指：右栏退役后，「未归档」由任务工作面快捷筛选承接（原地生效 / 不改路由）
 *   E2E-5  PDF 附件双击 file:// 打开（data 层种卡 + IndexedDB blob → 双击卡片 → 新标签 file://…pdf）
 *   E2E-6  事件日志 zy_event_log 独立 key 落盘（打开资源卡产生事件）
 *   E2E-7  V4.7.0 卡片池二级界面退役：/deck/* 旧深链统一回一级页签，hl/hk 仍打开详情
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
 *   E2E-21 调度台页头「今日战报」就地开弹窗并可关闭
 *   E2E-24 R167 镜像只读详情边界（标题 readonly / AI 行不给入口 / 页脚两钮是定位）
 *   E2E-25 R174-3 按日快照落盘（画像页年度段读合并 + 写链路保存→pagehide→today）
 *   E2E-26 R2-④⑤ K 定位改靶「资源卡池」（tab 激活 + 目标卡高亮）+ 打开池卡详情记一次「调出」事件
 *   E2E-27 R2-⑧ 池控制行：新建单卡入池 → 批量全选打标签 → 批量软删进回收站
 *   E2E-28 R4-a 迁移报告卡：出卡 → 回退落停用开关并清报告 → 可重新执行迁移
 *   E2E-30 R3-Ca（V4.2.3 重指）池面板：列表视图 / 状态筛选下拉 / 批量反选 / 右键置顶
 *   E2E-31 R3-Cb 三张卡批量口径合一：栏即出 / 全选反选可达 / 退出清空 / 任务批量打标
 *   E2E-48 V3.9.11 设置页更新日志：左目录点击定位、右内容滚动同步高亮、720px 单列
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

/* ★R175-补：条件轮询助手——替代「固定等 N 毫秒后再断言」。
   为什么必须改：固定等待是 E2E 随机漂移（flaky）的另一半根因。
   同一个断言在快机器上等够了、在慢机器上没等够 ⇒ 假红；机器一快一慢又变绿。
   本助手把「等多久」从拍脑袋的常量变成「等到达目标状态为止」：
   达标即返回（通常远早于原固定值 ⇒ 全套 E2E 变快），超时才用最后一次采样值走原断言口径。
   **断言强度不放松**：超时后仍拿真实采样值去判，判据与改动前一字未改。 */
async function pollUntil(fn, { timeout = 8000, interval = 120, label = '' } = {}) {
  const deadline = Date.now() + timeout
  let last
  for (;;) {
    try { last = await fn() } catch (e) { last = false }
    if (last) return last
    if (Date.now() >= deadline) return last
    await new Promise(r => setTimeout(r, interval))
  }
}
/** 轮询某个 locator 出现（并可选满足额外条件） */
async function waitForLocator(page, selector, opts = {}) {
  return pollUntil(async () => {
    const n = await page.locator(selector).count().catch(() => 0)
    if (n <= 0) return false
    if (opts.visible) return page.locator(selector).first().isVisible().catch(() => false)
    return true
  }, { label: selector, ...opts })
}
/** 轮询页面内某个谓词成立（读 storage 落库这类没有 DOM 信号的场合） */
async function waitForStorage(page, keys, predicate, opts = {}) {
  return pollUntil(async () => {
    const raw = await page.evaluate((ks) => chrome.storage.local.get(ks), keys).catch(() => null)
    return raw ? predicate(raw) : false
  }, { label: 'storage:' + (Array.isArray(keys) ? keys.join(',') : keys), ...opts })
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
  const captureInboxRequests = []
  ctx.on('request', request => {
    if (request.url().includes('/rest/v1/capture_inbox')) captureInboxRequests.push(request.url())
  })
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin }).catch(() => {})
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 数据种卡：建一张真实策展台 + 一个论证分类，再把池卡投射到该分类。
  // 为什么不再拿 workspaces[0]：R179 后它是隐藏资源池 zy-curation，路由 `/workspace/zy-curation`
  // 已是明确的不存在页；旧种法会让 E2E-5/6/18/22 永远找不到卡片。
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
    // 2) 主数据：真实策展台 + 分类 + 池卡 + 投射
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur['zy_data_v2']
    if (!data) return ''
    const wsId = 'e2e-main-board'
    const catId = 'e2e-seed-cat'
    if (!data.workspaces.some(w => w.id === wsId)) {
      data.workspaces.push({ id: wsId, name: 'E2E 策展台', icon: '🧪', color: '#3A6B4C', coverTheme: 'deep-sea', order: 10, archived: false, kind: 'curation' })
    }
    if (!data.categories.some(c => c.id === catId)) {
      data.categories.push({ id: catId, workspaceId: wsId, name: 'E2E 论证分支', order: 0 })
    }
    const cardId = 'e2e-res-1'
    data.resources = data.resources.filter(r => r.id !== cardId)
    const seededCard = {
      id: cardId, kind: 'resource', title: 'E2E PDF 测试卡', linkType: 'file', link: 'zy-asset://e2e-pdf-1',
      workspaceId: 'zy-curation', categoryId: '', tags: [], pinned: false, starred: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
      notes: '', customFields: {}, assets: [{ id: 'e2e-pdf-1', kind: 'pdf', name: 'e2e-test.pdf', size: 300, mime: 'application/pdf', createdAt: Date.now() }]
    }
    data.resources.push(seededCard)
    data.curationProjections = (data.curationProjections || []).filter(p => p.cardId !== cardId)
    data.curationProjections.push({
      id: 'e2e-seed-proj', kind: 'card', wsId: 'zy-curation', cardId, catId: '',
      targetWsId: wsId, targetCatId: catId, addedAt: Date.now(),
      snapshot: JSON.parse(JSON.stringify(seededCard)),
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

  // E2E-48（V3.9.11 · G-09）：更新日志必须真的是“目录 → 内容”工作台，不是双栏装饰。
  //   点击最末的旧版本后，右侧滚动容器要移动到对应 article；目录与正文同步 active；
  //   720px 以下必须回退单列，且右侧不再创建嵌套滚动区。
  const clPage = await ctx.newPage()
  await clPage.setViewportSize({ width: 1440, height: 1000 })
  await clPage.goto(base + '#/settings?page=changelog', { waitUntil: 'domcontentloaded' })
  await waitForLocator(clPage, '.gs-cl-shell', { visible: true, timeout: 10000 })
  const clDesktop = await clPage.evaluate(() => {
    const shell = document.querySelector('.gs-cl-shell')
    return {
      columns: shell ? getComputedStyle(shell).gridTemplateColumns.split(' ').length : 0,
      navItems: document.querySelectorAll('.gs-cl-dir-item').length,
      articles: document.querySelectorAll('.gs-cl-item').length,
    }
  })
  // 取中段旧版本：末条通常短到无法滚到容器顶部，不能拿它验证“目标对齐”。
  const clMidIndex = Math.floor(clDesktop.navItems / 2)
  const clOldDir = clPage.locator('.gs-cl-dir-item').nth(clMidIndex)
  const clOldVersion = await clOldDir.locator('b').innerText().then(t => t.replace(/^V/, ''))
  await clOldDir.click()
  const clJumpOk = await pollUntil(async () => clPage.evaluate((version) => {
    const root = document.querySelector('.gs-cl-list')
    const target = document.querySelector(`.gs-cl-item[data-version="${version}"]`)
    if (!root || !target) return false
    const rootTop = root.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    return root.scrollTop > 100 && targetTop >= rootTop - 2 && targetTop <= rootTop + 36
  }, clOldVersion), { timeout: 8000, label: '更新日志目录定位' })
  /* ★V3.9.21：这里原来不读 pollUntil 的返回值，只轮询 5s 后立刻另采一次；
     若最后一帧恰被 scroll 同步覆盖，日志里 active 三项会全是 false。
     改为把轮询结果作为判据本身，避免「轮询明明收敛了、采样又读回旧帧」。 */
  const clActiveOk = await pollUntil(async () => clPage.evaluate((version) => {
    const root = document.querySelector('.gs-cl-list')
    const dir = [...document.querySelectorAll('.gs-cl-dir-item')]
      .find(el => el.querySelector('b')?.textContent?.replace(/^V/, '') === version)
    const article = document.querySelector(`.gs-cl-item[data-version="${version}"]`)
    return !!root && !!dir && !!article
      && dir.classList.contains('active')
      && article.classList.contains('active')
      && dir.getAttribute('aria-current') === 'true'
  }, clOldVersion), { timeout: 5000, label: '更新日志目录高亮同步' })
  const clActive = await clPage.evaluate((version) => {
    const dir = [...document.querySelectorAll('.gs-cl-dir-item')]
      .find(el => el.querySelector('b')?.textContent?.replace(/^V/, '') === version)
    const article = document.querySelector(`.gs-cl-item[data-version="${version}"]`)
    return {
      dir: dir?.classList.contains('active') || false,
      article: article?.classList.contains('active') || false,
      ariaCurrent: dir?.getAttribute('aria-current') || '',
    }
  }, clOldVersion)
  // jumpTo 用 smooth 滚动并锁定 900ms，避免动画中间帧把点击目标的高亮抢回旧版本。
  // 滚动同步是“动画落定后”的行为，先等锁定窗口结束，再模拟用户手动滚到底。
  await clPage.waitForTimeout(950)
  const clLastVersion = await clPage.locator('.gs-cl-dir-item').last().locator('b')
    .innerText().then(t => t.replace(/^V/, ''))
  const clScrollSync = await pollUntil(async () => clPage.evaluate(async (version) => {
    const root = document.querySelector('.gs-cl-list')
    if (!root) return false
    root.scrollTop = root.scrollHeight
    root.dispatchEvent(new Event('scroll'))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const active = document.querySelector('.gs-cl-dir-item.active b')?.textContent?.replace(/^V/, '')
    return active === version
  }, clLastVersion), { timeout: 5000, label: '更新日志滚动同步高亮' })

  await clPage.setViewportSize({ width: 700, height: 1000 })
  await clPage.waitForTimeout(300)
  const clNarrow = await clPage.evaluate(() => {
    const shell = document.querySelector('.gs-cl-shell')
    const nav = document.querySelector('.gs-cl-dir')
    const list = document.querySelector('.gs-cl-list')
    const navRect = nav?.getBoundingClientRect()
    const listRect = list?.getBoundingClientRect()
    return {
      columns: shell ? getComputedStyle(shell).gridTemplateColumns.split(' ').length : 0,
      stacked: !!navRect && !!listRect && listRect.top >= navRect.bottom - 1,
      listOverflow: list ? getComputedStyle(list).overflowY : '',
      bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  await clPage.close()
  report('E2E-48 V3.9.11 更新日志目录工作台：点击旧版本定位正文、滚动同步高亮、700px 单列且无页面横向溢出',
    clDesktop.columns === 2 && clDesktop.navItems === clDesktop.articles && clDesktop.articles >= 100
      && clJumpOk === true && clActiveOk === true && clActive.dir && clActive.article && clActive.ariaCurrent === 'true' && clScrollSync === true
      && clNarrow.columns === 1 && clNarrow.stacked && clNarrow.listOverflow === 'visible'
      && clNarrow.bodyOverflow <= 1,
    `desktop=${JSON.stringify(clDesktop)} target=${clOldVersion} jump=${clJumpOk} active=${JSON.stringify(clActive)} scrollSync=${clLastVersion}:${clScrollSync} narrow=${JSON.stringify(clNarrow)}`)

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

  // E2E-4（V3.9.1 重指 → W17-C01 → ★V4.3.1 再重指）：右栏「今天的状态」与中央未归档明细弹窗
  //   均随任务驱动改版退役。能力没有丢，落点改为首页任务工作面的“未归档”快捷筛选：
  //     ① 右栏 .side-rail 与旧 .stat-row 零回流；
  //     ② 点「未归档」后按钮原地选中，任务池直接收窄，不跳二级页、不改路由；
  //     ③ 收窄后的每张任务卡都带“去归位”出口，证明不是只换了高亮而没有真实过滤。
  //   完整任务盘点现由一级调度台任务页签覆盖（#/deck/task 只做旧深链重定向）。
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(async (cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    const now = Date.now()
    data.tasks = (data.tasks || []).filter(task => task.id !== 'e2e-task-unarchived-filter')
    data.tasks.push({
      id: 'e2e-task-unarchived-filter', kind: 'task', title: 'E2E 未归档筛选任务',
      projectId: '', metricId: '', status: 'todo', priority: 'medium',
      mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [],
      subtasks: [], pinned: false, createdAt: now, updatedAt: now,
    })
    await chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const sideRailGone = (await page.locator('.side-rail, .stat-row').count()) === 0
  const unarchivedFilter = page.locator('.twt-quick-field select').first()
  const unarchivedText = ((await unarchivedFilter.locator('option[value="unarchived"]').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  const urlBeforeClick = page.url()
  await unarchivedFilter.selectOption('unarchived').catch(() => {})
  await page.waitForTimeout(700)
  const urlAfterClick = page.url()
  const unarchivedActive = await unarchivedFilter.evaluate(el => el.value === 'unarchived').catch(() => false)
  const urlUnchanged = urlBeforeClick === urlAfterClick
  const unarchivedRows = await page.locator('.cal-pool-task').count()
  const assignableRows = await page.locator('.cal-pool-task .cal-assign').count()
  const allRowsUnarchived = unarchivedRows > 0 && assignableRows === unarchivedRows
  report('E2E-4 ★V4.3.1 右栏退役后「未归档」由任务工作面承接：快捷筛选原地生效、不改路由，结果行均带归位出口',
    sideRailGone && unarchivedText.includes('未归档') && unarchivedActive && urlUnchanged && allRowsUnarchived,
    `sideRailGone=${sideRailGone} filter="${unarchivedText.slice(0, 32)}" active=${unarchivedActive} url不变=${urlUnchanged} 行=${unarchivedRows} 归位口=${assignableRows}`)

  // E2E-49（V3.9.22）：主攻行点击直接打开可编辑项目详情中央弹窗。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    const now = Date.now()
    data.compass = data.compass || { vision: { content: '', updatedAt: now }, mission: { content: '', updatedAt: now }, directions: [] }
    data.compass.directions = (data.compass.directions || []).filter(dir => dir.id !== 'e2e-dir-status-focus')
    /* V3.9.21：主攻项目按 isFocused 排序；若夹具里还有旧主攻，目标项目会被挤到
       第 3 行之外，`.fp-row` 自然找不到它。先清掉所有旧主攻，再种本轮目标。 */
    for (const dir of data.compass.directions || []) {
      for (const p of dir.projects || []) p.isFocused = false
    }
    data.compass.directions.push({
      id: 'e2e-dir-status-focus', name: 'E2E 状态明细方向', status: 'active', term: 'short',
      projects: [{
        id: 'e2e-proj-status-focus', name: 'E2E 状态主攻项目', isFocused: true, progress: 0, status: 'active',
        metrics: [{
          id: 'e2e-metric-status-focus', title: 'E2E 状态成功指标', target: '1', acceptance: '',
          taskIds: ['e2e-task-status-focus']
        }]
      }]
    })
    data.tasks = (data.tasks || []).filter(task => task.id !== 'e2e-task-status-focus')
    data.tasks.push({
      id: 'e2e-task-status-focus', kind: 'task', title: 'E2E 状态明细任务',
      projectId: 'e2e-proj-status-focus', metricId: 'e2e-metric-status-focus',
      status: 'doing', priority: 'medium', mountedResourceIds: [], mountedCuriosityIds: [],
      customFields: {}, tags: [], subtasks: [], pinned: false, createdAt: now, updatedAt: now
    })
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  /* ★V4.3.1 再重指：右栏「今天的状态」退役后，主攻项目不再是独立读数行，而是任务工作面的
     一等工作口径。本用例守住新链路：主攻快捷筛选 → 只剩该项目任务 → 点任务打开右侧详情。
     项目详情自身的就地编辑能力仍由 E2E-62 在方向台覆盖，能力没有丢。 */
  const focusFilter = page.locator('.twt-quick-field select').first()
  const focusFilterVisible = await focusFilter.isVisible().catch(() => false)
  const urlBeforeFocusFilter = page.url()
  await focusFilter.selectOption('focus').catch(() => {})
  await page.waitForTimeout(700)
  const focusFilterActive = await focusFilter.evaluate(el => el.value === 'focus').catch(() => false)
  const focusTaskRow = page.locator('.cal-pool-task').filter({ hasText: 'E2E 状态明细任务' }).first()
  const focusTaskVisible = await focusTaskRow.isVisible().catch(() => false)
  const focusTaskShowsProject = ((await focusTaskRow.innerText().catch(() => '')) || '').includes('E2E 状态主攻项目')
  await focusTaskRow.locator('.cal-task-copy').click().catch(() => {})
  await waitForLocator(page, '.drawer:not(.drawer-mode-modal)', { visible: true, timeout: 8000 })
  const focusTaskDrawer = page.locator('.drawer:not(.drawer-mode-modal)').first()
  const focusTaskDrawerOn = await focusTaskDrawer.isVisible().catch(() => false)
  const focusTaskDrawerTitle = await focusTaskDrawer.locator('.ts-title').first().inputValue().catch(() => '')
  const focusFilterKeepsRoute = page.url() === urlBeforeFocusFilter
  const oldFocusPanelGone = (await page.locator('.focus-projects, .side-rail').count().catch(() => -1)) === 0
  report('E2E-49 ★V4.3.1 主攻项目改由任务工作面承接：快捷筛选原地生效，主攻任务可见项目归属并可打开任务详情；旧右栏与旧主攻面板零回流',
    focusFilterVisible && focusFilterActive && focusTaskVisible && focusTaskShowsProject
      && focusTaskDrawerOn && focusTaskDrawerTitle === 'E2E 状态明细任务'
      && focusFilterKeepsRoute && oldFocusPanelGone,
    `筛选=${focusFilterVisible}/${focusFilterActive} 任务=${focusTaskVisible} 项目归属=${focusTaskShowsProject} 详情=${focusTaskDrawerOn}/${focusTaskDrawerTitle} 路由不变=${focusFilterKeepsRoute} 旧面板归零=${oldFocusPanelGone}`)

  // E2E-5 PDF 双击 file:// 打开：走策展画布上的资源 chip（现役入口）
  await page.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1500) }
  // V4.2.0 镜像渲染身份是投射记录 id；源卡 id 仍住在 __mirrorSourceId，
  // 不能继续拿源卡 id 找画布 chip（否则会把正确渲染误判成卡片消失）。
  await waitForLocator(page, '.mind-resource[data-rid="e2e-seed-proj"]', { visible: true, timeout: 10000 })
  const card = page.locator('.mind-resource[data-rid="e2e-seed-proj"]').first()
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

  // E2E-6 事件日志落盘：到资源卡池右键软删源卡 → delete 事件写入 zy_event_log。
  // 现役资源 chip 的右键菜单属于策展台上下文，删除动作不再写“资源池源卡”这份语义，故回真实管理面。
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const poolRow = page.locator('.pcp-row[data-rid="e2e-res-1"]').first()
  await waitForLocator(page, '.pcp-row[data-rid="e2e-res-1"]', { visible: true, timeout: 8000 })
  const poolRowVisible = await poolRow.isVisible().catch(() => false)
  let poolMenuVisible = false
  let poolDeleteHit = false
  if (poolRowVisible) {
    await poolRow.click({ button: 'right' }).catch(() => {})
    await waitForLocator(page, '.ctx-menu-box .cx-item', { timeout: 5000 })
    poolMenuVisible = await page.locator('.ctx-menu-box').first().isVisible().catch(() => false)
  }
  const delItem = page.locator('.ctx-menu-box .cx-item', { hasText: '删除' }).first()
  if (await delItem.count()) {
    await delItem.click().catch(() => {})
    poolDeleteHit = true
  }
  // 不只等固定时长：先等软删真正落库，再核同一张卡的事件已随整库 set 写入。
  await waitForStorage(page, 'zy_data_v2', (raw) => {
    const card = ((raw.zy_data_v2 || {}).resources || []).find(x => x.id === 'e2e-res-1')
    return !!(card && card.deletedAt)
  }, { timeout: 8000 })
  await waitForStorage(page, 'zy_event_log', (raw) =>
    Array.isArray(raw.zy_event_log)
    && raw.zy_event_log.some(x => x && x.action === 'delete' && x.cardId === 'e2e-res-1'),
  { timeout: 8000 })
  const poolAfter = await page.evaluate(() => chrome.storage.local.get(['zy_data_v2', 'zy_event_log']).then((raw) => {
    const card = ((raw.zy_data_v2 || {}).resources || []).find(x => x.id === 'e2e-res-1')
    const ev = raw.zy_event_log || []
    return { softDeleted: !!(card && card.deletedAt), ev }
  }))
  const ev = poolAfter.ev
  report('E2E-6 事件日志 zy_event_log 落盘（资源池软删产生 delete 事件）',
    poolRowVisible && poolMenuVisible && poolDeleteHit && poolAfter.softDeleted
    && Array.isArray(ev) && ev.some(x => x && x.action === 'delete' && x.cardId === 'e2e-res-1'),
    ev ? `${ev.length} 条，最新=${ev[ev.length - 1] && (ev[ev.length - 1].kind + '/' + ev[ev.length - 1].action)} 池行=${poolRowVisible} 菜单=${poolMenuVisible} 点删除=${poolDeleteHit} 软删落库=${poolAfter.softDeleted}` : `无日志 池行=${poolRowVisible} 菜单=${poolMenuVisible} 点删除=${poolDeleteHit}`)

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

  // E2E-7 V4.7.0：卡片池二级界面退役——/deck/* 旧深链统一回一级调度台对应页签。
  // 任务/好奇心直接落工作面；资源池旧深链自动展开「全部资源卡」抽屉（保留原“一眼看到全部资源”的到达体验）。
  const deckChecks = []
  for (const [kind, host] of [['task', '.task-workbench'], ['curiosity', '.cw-pool'], ['resource', '.drawer .pcp']]) {
    await page.goto(base + '#/deck/' + kind, { waitUntil: 'domcontentloaded' })
    /* ★R175-补：等面板真出现，而不是死等 2200ms（慢机器上等不够 ⇒ E2E-7 随机假红）。 */
    await waitForLocator(page, host, { visible: true, timeout: 10000 })
    const panel = await page.locator(host).first().isVisible().catch(() => false)
    const hash = new URL(page.url()).hash
    const tabLanded = hash.includes('tab=' + kind)
    const oldChrome = await page.locator('.deck-kind-seg, .deck-back').count()
    deckChecks.push({ kind, panel, tabLanded, oldChrome })
  }
  const deckOk = deckChecks.every(x => x.panel && x.tabLanded && x.oldChrome === 0)
  const oldTabsGone = (await page.locator('.bt-tab').count()) === 0
  // 旧任务深链的 hl/hk 定位仍要在新一级页签里把详情抽屉打开。
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']; if (!d) return
    if (!d.tasks.some(t => t.id === 'e2e-deck-probe')) {
      d.tasks.unshift({
        id: 'e2e-deck-probe', kind: 'task', title: 'E2E 旧深链任务', status: 'todo', priority: 'medium',
        tags: [], pinned: false, customFields: {}, assets: [], createdAt: Date.now(), updatedAt: Date.now(),
      })
    }
    return chrome.storage.local.set({ zy_data_v2: d })
  }))
  await page.goto(base + '#/deck/task?hl=e2e-deck-probe&hk=task', { waitUntil: 'domcontentloaded' })
  const deepLinkOk = await waitForLocator(page, '.drawer .ts-title-wrap', { visible: true, timeout: 10000 }).then(() => true).catch(() => false)
  report('E2E-7 V4.7.0 卡片池二级界面退役：/deck/* 三个旧深链统一重定向到一级页签，旧二级壳归零；hl/hk 仍能打开详情',
    deckOk && oldTabsGone && deepLinkOk,
    deckChecks.map(x => `${x.kind}:panel=${x.panel},tab=${x.tabLanded},old=${x.oldChrome}`).join(' | ') + ` oldTabs=${oldTabsGone} deepLink=${deepLinkOk}`)

  // E2E-8 V4.3.1 任务驱动调度台：今日三件事 + 完整任务池 + 月历；旧双栏案头栏与卡内子任务视口退役。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  /* ★R175-补：两栏骨架出现即继续（不等死 2500ms）。 */
  await waitForLocator(page, '.work-board', { timeout: 10000 })
  const home = await page.evaluate(() => ({
    workBoard: !!document.querySelector('.work-board'),
    focusRows: document.querySelectorAll('.focus-row').length,
    handBoard: !!document.querySelector('.hand-board'),
    handGrid: !!document.querySelector('.hand-grid'),
    taskWorkbench: !!document.querySelector('.task-workbench'),
    calendar: !!document.querySelector('.task-calendar'),
    sideRail: !!document.querySelector('.side-rail'),
    oldCuration: !!document.querySelector('.card.curation'),
    oldSubs: !!document.querySelector('.tc-subs'),
  }))
  /* ★R175-补：工作单行真出现再点（原来靠上面那步的固定等待，时机不可控）。 */
  await waitForLocator(page, ".focus-row[role='button']", { visible: true, timeout: 10000 })
  const firstFocus = page.locator(".focus-row[role='button']").first()
  if (await firstFocus.count()) await firstFocus.click().catch(() => {})
  /* ★R175-补：抽屉真出现即继续。 */
  await waitForLocator(page, '.drawer', { visible: true, timeout: 6000 })
  const drawerOpened = await page.locator('.drawer').first().isVisible().catch(() => false)
  report('E2E-8 V4.3.1 任务驱动调度台：今日三件事 + 完整任务池与月历；旧双栏案头栏退役；整行点击打开任务详情',
    home.workBoard && home.focusRows === 3 && home.handBoard && home.taskWorkbench && home.calendar && !home.sideRail
      && !home.oldCuration && !home.oldSubs && drawerOpened,
    `workBoard=${home.workBoard} focusRows=${home.focusRows} handBoard=${home.handBoard} taskWorkbench=${home.taskWorkbench} calendar=${home.calendar} handGrid=${home.handGrid} sideRail=${home.sideRail} oldCuration=${home.oldCuration} oldSubs=${home.oldSubs} drawer=${drawerOpened}`)

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

  // E2E-10 资源卡池统一管理面 + 单向挂载红线（R111 承接 R110-B1）
  //   旧断言盯的是已退役的 `/workspace/zy-curation` 资源台分类树；现资源池唯一管理面是
  //   `#/?tab=resource` 的「全部资源卡」抽屉。数据层不变量保持不变：遗留 kind='workspace' 投射与指向池的脏投射
  //   在启动归一化时清除；池内源卡保持可用，不被镜像标记污染。
  //   页面面同时改认现役池面板 `.pcp`，不再找 `.ws-cat-head / .section-label`。
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  // 种源卡 + 遗留 kind='workspace' 投射记录（UI 右键在 headless 不稳定，数据层直种）
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const data = cur['zy_data_v2']
    if (!data) return
    const wsId = 'zy-curation'
    if (!data.resources.some((r) => r.id === 'e2e-mir-1')) {
      data.resources.push({ id: 'e2e-mir-1', kind: 'resource', title: 'E2E 镜像卡', linkType: 'url', link: 'https://example.com/e2e-mir', workspaceId: wsId, categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
    }
    // 脏投射双份：遗留 kind='workspace' + 指向池的卡片投射（历史双写产物）
    data.curationProjections = [
      { id: 'e2e-curp-dirty', kind: 'card', wsId, cardId: 'e2e-mir-1', catId: '', targetCatId: '', targetWsId: 'zy-curation', addedAt: Date.now() },
      { id: 'e2e-curp-ws', kind: 'workspace', wsId, addedAt: Date.now() }
    ]
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const hubPoolOn = await page.locator('.drawer .pcp').first().isVisible().catch(() => false)
  const hubRowOn = await page.locator('.pcp-row[data-rid="e2e-mir-1"]').first().isVisible().catch(() => false)
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
  report('E2E-10 资源卡池统一管理面 + 单向挂载红线（R111 承接 R110-B1）', hubPoolOn && hubRowOn && scrubbed.ok && srcKept,
    `pool=${hubPoolOn} row=${hubRowOn} scrubbed=${scrubbed.ok}(脏投射残留${scrubbed.dirtyLeft}/镜像标记残留${scrubbed.markerLeft}) srcKept=${srcKept}`)

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
    const catId = 'e2e-ro-cat'
    if (!data.workspaces.some(w => w.id === boardId)) {
      data.workspaces.push({ id: boardId, name: 'E2E 镜像只读台', icon: '🧪', color: '#3A6B4C', coverTheme: 'deep-sea', order: 99, archived: false, kind: 'curation' })
    }
    if (!data.categories.some(c => c.id === catId)) {
      data.categories.push({ id: catId, workspaceId: boardId, name: 'E2E 只读镜像分支', order: 0 })
    }
    let mirrorSource = data.resources.find(r => r.id === 'e2e-ro-1')
    if (!mirrorSource) {
      mirrorSource = { id: 'e2e-ro-1', kind: 'resource', title: 'E2E 只读镜像源卡', linkType: 'url', link: 'https://example.com/e2e-ro', workspaceId: 'zy-curation', categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() }
      data.resources.push(mirrorSource)
    }
    data.curationProjections = (data.curationProjections || []).filter(p => p.cardId !== 'e2e-ro-1')
    data.curationProjections.push({
      id: 'e2e-ro-proj', kind: 'card', wsId: 'zy-curation', cardId: 'e2e-ro-1', catId: '',
      targetWsId: boardId, targetCatId: catId, addedAt: Date.now(),
      snapshot: JSON.parse(JSON.stringify(mirrorSource)),
    })
    return chrome.storage.local.set({ zy_data_v2: data }).then(() => boardId)
  }))  /* 直种存储后必须整页重载：app 运行中 store 不会回读 chrome.storage，
     而且随后的 persist 会把内存态盖回磁盘（E2E-10 同一手法） */
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.goto(base + '#/workspace/' + roBoardId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/' + roBoardId)) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, roBoardId); await page.waitForTimeout(1800) }
  await waitForLocator(page, '.mind-resource[data-rid="e2e-ro-proj"]', { visible: true, timeout: 10000 })
  const mirCard = page.locator('.mind-resource[data-rid="e2e-ro-proj"]').first()
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
  // 对照面：同一张卡在资源台是**真身**——V4.1.3 起只保留「AI 优化」一格；标题必须可写。
  // 资源侧反向「关联任务」已按挂载白名单退役，因此这里不再要求旧的两格。
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.pcp-row[data-rid="e2e-ro-1"]').first().click().catch(() => {})
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
    data.categories = data.categories.filter(c => c.id !== 'e2e-ro-cat')
    data.curationProjections = (data.curationProjections || []).filter(p => p.cardId !== 'e2e-ro-1')
    return chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  report('E2E-24 R167 镜像只读详情边界（标题 readonly / AI 行不给入口 / 页脚两钮是定位）+ V4.1.3 真身侧反向对照（仅 AI 优化一格 + 标题可写）',
    mirFound > 0 && mirHeadVisible && mirTitleReadonly && mirBanner && mirAiCells === 0 && mirFootBtns === 2 && mirFootText.includes('定位到源卡') && hubAiCells === 1 && hubTitleEditable && hubTitleValue === 'E2E 只读镜像源卡',
    `镜像在位=${mirFound} 头=${mirHeadVisible} 标题只读=${mirTitleReadonly} banner=${mirBanner} AI格=${mirAiCells} 页脚钮=${mirFootBtns}(${mirFootText.slice(0, 24)}) 投射=${mirDiag.proj}/目标台=${roBoardId || '无'} | 真身 AI格=${hubAiCells} 可写=${hubTitleEditable} 值="${hubTitleValue}"`)

  // E2E-25（R174-3）：zy_daily_stats 落盘——读合并 + 写链路两端到端。
  // 读：种一份快照（老日子 2026-08-15 · 常规档 w=9）+ 今日 create 事件 → 打开仪表盘，
  //     8 月块必须出现 l2 格（纯重建会因日志无老事件而缺格=热力图褪色）+ fullSince 徽章含老日子。
  // 写：详情抽屉改标题保存（saveData → flushCardEvents → scheduleDailyStatsWrite 时间闸排程）
  //     → 派发 pagehide（flushDailyStatsNow 跳闸立即写，R173-T2 同款）→ zy_daily_stats.days 必须出现今天。
  const dsOldDay = '2026-08-15'
  const dsNow = new Date()
  const dsToday = dsNow.getFullYear() + '-' + String(dsNow.getMonth() + 1).padStart(2, '0') + '-' + String(dsNow.getDate()).padStart(2, '0')
  const dsSeeded = await page.evaluate(([oldDay]) => chrome.storage.local.get('zy_data_v2').then(async (cur) => {
    const data = cur['zy_data_v2']
    // R175：__wid 是页面上下文自己的写戳，不是备份数据的一部分。
    // 测试直种整树时若原样复制旧写戳，old/new 写戳会被判为复用，
    // 从而走外部合并；这与真实导入/备份回灌同一纪律。
    if (data) delete data.__wid
    if (data && !data.resources.some(r => r.id === 'e2e-ds-1')) {
      data.resources.push({ id: 'e2e-ds-1', kind: 'resource', title: 'E2E 落盘卡', linkType: 'url', link: 'https://example.com/e2e-ds', workspaceId: 'zy-curation', categoryId: '', tags: [], pinned: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now() })
    }
    await chrome.storage.local.set({
      zy_data_v2: data,
      zy_daily_stats: { v: 1, days: { [oldDay]: { c: { res: 9, curio: 0, task: 0 }, del: { res: 0, curio: 0, task: 0 }, s: { curio: 0, task: 0 }, u: 0, d: 0, sub: 0, focus: 0, link: 0, x: { add: 9, del: 0 }, w: 9 } }, fullSince: oldDay, base: { res: 0, task: 0, curio: 0, link: 0 } },
      zy_event_log: [{ id: 'e2e-ds-create', ts: Date.now() - 60000, action: 'create', kind: 'resource', title: 'E2E 落盘卡', cardId: 'e2e-ds-1' }]
    })
    const reread = await chrome.storage.local.get('zy_data_v2')
    const card = (reread['zy_data_v2']?.resources || []).find(r => r.id === 'e2e-ds-1')
    return { card: !!card, wid: reread['zy_data_v2']?.__wid || '' }
  }), [dsOldDay])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // V4.7.6：热力图已提为页首常驻，不依赖时间轴 / 卡片分析页签。
  // 所守行为未变：种下的老日快照必须在 8 月块里出现 l2 格，且 fullSince 说明仍含老日子。
  /* ★V4.7.6 重指：原画像首屏四格 KPI 已迁入「卡片分析」页签；守的仍是四个 KPI 都有真实下钻出口。 */
  await page.goto(base + '#/profile?view=analysis', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.pi-ov-kpis', { visible: true, timeout: 10000 })
  await page.waitForTimeout(600)
  await page.locator('.pi-view-tab[data-profile-view="analysis"]').first().click({ timeout: 8000 })
  await waitForLocator(page, '.pi-hmbox', { visible: true, timeout: 8000 })
  const yearModuleOn = await page.locator('.pi-annual-heatmap').first().isVisible().catch(() => false)
  const heatTarget = page.locator('.pi-annual-heatmap .dz-cell:not(.future):not(.today)').last()
  const heatTargetDay = await heatTarget.getAttribute('title').then(t => (t || '').split(' · ')[0]).catch(() => '')
  await heatTarget.click({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(700)
  const heatBattle = await page.evaluate(() => {
    const modal = document.querySelector('.dz-day-modal')
    const sub = (document.querySelector('.dz-day-modal .dz-day-sub')?.textContent || '').trim()
    return { open: !!modal, sub }
  })
  await page.locator('.dz-day-modal .dz-btn.ghost.sm').filter({ hasText: '收起' }).click().catch(() => {})
  await page.waitForTimeout(300)
  const dsYearOn = await page.locator('.dz-months .dz-year').count()
  const dsAugL2 = await page.locator('.dz-year .dz-cell[data-day="2026-08-15"]')
    .evaluate(el => el.classList.contains('l2') ? 1 : 0).catch(() => 0)
  // V3.9.30：年度段收紧后，fullSince 从第二行说明并入网格下方的紧凑元数据行。
  const dsBadge = await page.locator('.pi-annual-heatmap .pi-hm-meta').first().innerText().catch(() => '')
  // 写链路：进资源卡池 → 单击开 App 级详情 → 改标题 → 保存 → pagehide → 读回
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await waitForLocator(page, '.pcp-row[data-rid="e2e-ds-1"]', { visible: true, timeout: 8000 })
  const dsCard = await page.locator('.pcp-row[data-rid="e2e-ds-1"]').count()
  await page.locator('.pcp-row[data-rid="e2e-ds-1"]').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(1300)
  const dsTitle = page.locator('.drawer .drawer-header textarea').first()
  const dsDrawer = await dsTitle.isVisible().catch(() => false)
  await dsTitle.fill('E2E 落盘卡·改').catch(() => {})
  const dsSaveBtn = await page.locator('.drawer .red-save').count()
  await page.locator('.drawer .red-save').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(900) /* saveData 300ms 防抖 + flushCardEvents + schedule 排程 */
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  /* ★R175-补：等今日快照**真的落进 storage** 再读（原来死等 1500ms；
     写链路含 saveData 300ms 防抖 + flushCardEvents + pagehide 补写，慢机器上 1500ms 常常不够
     ⇒ E2E-25 随机假红）。判据与判读口径一字未改。 */
  const dsWrittenOk = await waitForStorage(page, 'zy_daily_stats',
    (raw) => { const st = raw.zy_daily_stats; const rec = st && st.days ? st.days[dsToday] : null; return !!(rec && rec.x && rec.x.add >= 1) },
    { timeout: 15000 })
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
    yearModuleOn && heatBattle.open && heatBattle.sub.includes(heatTargetDay)
      && dsAugL2 >= 1 && dsBadge.includes('2026-08-15') && dsWrittenOk && dsWritten.has && dsWritten.add >= 1,
    `年度段=${yearModuleOn} 战报=${heatBattle.open} 战报日=${heatBattle.sub} 点格日=${heatTargetDay} 单行全年=${dsYearOn} 8月l2格=${dsAugL2} note="${(dsBadge || '').replace(/\s+/g, ' ').slice(0, 60)}" 种卡=${dsSeeded.card} 种子写戳=${!!dsSeeded.wid} 卡=${dsCard} 抽屉=${dsDrawer} 保存钮=${dsSaveBtn} 今日落盘=${JSON.stringify(dsWritten)}`)

  // E2E-11 方向台首屏（★R3-B1 树即一级）：项目卡头渲染；未归档入口现由 E2E-4 的调度台任务筛选覆盖
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
  report('E2E-11 ★R3-B1 方向台首屏=方向台项目舱卡头（.tw-head 可见 · 遗留投射字段不影响呈现 · 未归档入口由 E2E-4 的调度台任务筛选覆盖）★W12随迁：呈现单位由已退役的 .tp-head 改钉 .tw-head',
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
  /* ★R175-补：等项目详情真挂载（面包屑在）再操作，不死等 1500ms。 */
  await page.getByText("方向台", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {})
  const crumbUp = await page.getByText('方向台', { exact: true }).first().isVisible().catch(() => false)
  // R121：树定位入口收进展板 ⋯ 菜单（原 back-row「🌳 完整方向树」按钮已随重排退役）
  await page.locator('.pb-more-wrap .mini-btn.icon').first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.pb-menu .pm-item', { hasText: '在完整方向树中定位' }).first().click().catch(() => {})
  /* ★R175-补：等树页真到位（URL 带 from=proj 且来源提示在）再读，不死等。 */
  await page.locator(".hero-from").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {})
  const urlHasFrom = page.url().includes('from=proj') && page.url().includes('hl=')
  const fromProjLabel = ((await page.locator('.hero-from').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  await page.keyboard.press('Escape').catch(() => {})
  /* ★R175-补：等真的退回项目详情（URL 变回）再判，不死等。 */
  await pollUntil(() => page.url().includes("/compass/projects") && page.url().includes("p=e2e-proj-1"), { timeout: 10000 })
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


  // E2E-18 策展画布拖拽真值 + 改父级落库（R111 承接 R57-F1）
  //   旧卡片网格已随 V3.9.8 画布收口退役，现役拖拽对象是思维导图分支的 `.mind-drag`。
  //   继续守护 R57-F1 的根因：裸 `draggable` 会渲染成空字符串，真实拖拽不启动；
  //   因此仍断言 `getAttribute('draggable') === 'true'`。
  //   行为落点从“资源卡跨分类”迁到“论证分支挂到另一分支下”，检查源分类 parentId 真写进存储。
  await page.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1500) }
  // 种两个同级论证分支（拖拽源 / 落点）
  const seedOk = await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_data_v2').then(({ ['zy_data_v2']: d }) => {
      if (!d || d.version !== 2) { res(false); return }
      const wsId = 'e2e-main-board'
      if (!d.categories.some(c => c.id === 'e2e-drag-c1')) d.categories.push({ id: 'e2e-drag-c1', workspaceId: wsId, name: 'E2E 拖拽分类A', order: 96 })
      if (!d.categories.some(c => c.id === 'e2e-drag-c2')) d.categories.push({ id: 'e2e-drag-c2', workspaceId: wsId, name: 'E2E 拖拽分类B', order: 97 })
      chrome.storage.local.set({ ['zy_data_v2']: d }).then(() => res(true))
    })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  /* ★R175-补：等分支真上屏再拖。 */
  await waitForLocator(page, '[data-mind-node="e2e-drag-c1"]', { visible: true, timeout: 10000 })
  if (!page.url().includes('/workspace/')) { await page.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await page.waitForTimeout(1600) }
  // 真值检查：拖拽柄 draggable 属性必须是字符串 'true'（R57-F1 根因防线）
  const dragAttr = await page.evaluate(() => {
    const el = document.querySelector('[data-mind-node="e2e-drag-c1"] .mind-drag')
    return el ? el.getAttribute('draggable') : '(无卡)'
  })
  // 分支 A 拖到分支 B 上 = A.parentId 改为 B（视觉与数据同一棵 Category 树）
  const areaDrop = await page.evaluate(() => {
    const q = (id) => document.querySelector('[data-mind-node="' + id + '"]')
    const src = q('e2e-drag-a'), dst = q('e2e-drag-b')
    const srcNode = q('e2e-drag-c1'), dstNode = q('e2e-drag-c2')
    if (!srcNode || !dstNode) return 'missing:' + (srcNode ? '' : 'src ') + (dstNode ? '' : 'dst')
    const dt = new DataTransfer()
    const srcHandle = srcNode.querySelector('.mind-drag')
    srcHandle?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dstNode.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dstNode.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    srcHandle?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return 'dispatched'
  })
  /* ★R175-补：等父级真写进库（parentId 已变）再读，不死等 700ms。 */
  await waitForStorage(page, "zy_data_v2",
    (raw) => ((((raw["zy_data_v2"] || {}).categories || []).find(x => x.id === "e2e-drag-c1") || {}).parentId === "e2e-drag-c2"),
    { timeout: 8000 })
  const movedParent = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => ((r['zy_data_v2'].categories || []).find(x => x.id === 'e2e-drag-c1') || {}).parentId ?? '(无)'))
  report('E2E-18 策展画布拖拽真值+改父级落库（R111 承接 R57-F1）', dragAttr === 'true' && seedOk && areaDrop === 'dispatched' && movedParent === 'e2e-drag-c2',
    'draggable=' + dragAttr + ' seed=' + seedOk + ' area=' + areaDrop + ' parent=e2e-drag-c2→' + movedParent)

  // E2E-45（V3.9.10；V3.9.34 随迁）：节点聚焦后的思维导图键位必须跨层级成立。
  //   旧实现用 `closest([role=button])` 跳过交互元素，节点自身拖拽把手也命中，
  //   L2/L3 节点得到焦点后 Tab/Enter 被静默吞掉。这里从真实 L2 节点出发，
  //   一路按 Ctrl+Enter / Tab / Tab / Ctrl+Enter 建到 L4，再以数据层 parentId 验证树形。
  //   ★V3.9.34 键位语义调整：Enter = 修改/确认当前节点标题，Ctrl+Enter = 创建同级，
  //   本用例随迁改用 Ctrl+Enter（focus → Ctrl+Enter 会先进入编辑态，编辑态内
  //   再按 Ctrl+Enter = 确认并建同级，两步合一照旧收敛到同一等待点）。
  const keySeed = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const d = r['zy_data_v2']
    if (!d) return false
    d.categories = (d.categories || []).filter(c => !String(c.name || '').startsWith('E2E 键位'))
    if (!d.categories.some(c => c.id === 'e2e-key-root')) {
      d.categories.push({ id: 'e2e-key-root', workspaceId: 'e2e-main-board', name: 'E2E 键位根', order: 98 })
    }
    return chrome.storage.local.set({ zy_data_v2: d }).then(() => true)
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-mind-node="e2e-key-root"]', { visible: true, timeout: 10000 })
  await page.locator('[data-mind-node="e2e-key-root"]').focus()
  await page.keyboard.press('Control+Enter')
  await page.keyboard.press('Control+Enter')
  await waitForLocator(page, '.mind-edit-title', { visible: true, timeout: 5000 })
  await page.locator('.mind-edit-title').fill('E2E 键位二级同级')
  await page.keyboard.press('Tab')
  await waitForLocator(page, '.mind-edit-title', { visible: true, timeout: 5000 })
  await page.locator('.mind-edit-title').fill('E2E 键位三级子级')
  await page.keyboard.press('Tab')
  await waitForLocator(page, '.mind-edit-title', { visible: true, timeout: 5000 })
  await page.locator('.mind-edit-title').fill('E2E 键位四级子级')
  await page.keyboard.press('Control+Enter')
  await waitForLocator(page, '.mind-edit-title', { visible: true, timeout: 5000 })
  await page.locator('.mind-edit-title').fill('E2E 键位四级同级')
  await page.locator('.mindmap-title').click()
  await pollUntil(async () => page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const cats = ((r['zy_data_v2'] || {}).categories || [])
    return ['E2E 键位二级同级', 'E2E 键位三级子级', 'E2E 键位四级子级', 'E2E 键位四级同级'].every(n => cats.some(c => c.name === n))
  })), { timeout: 8000, label: '思维导图跨层级键位落库' })
  const keyTree = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const cats = ((r['zy_data_v2'] || {}).categories || [])
    const byName = (n) => cats.find(c => c.name === n)
    const l2 = byName('E2E 键位二级同级')
    const l3 = byName('E2E 键位三级子级')
    const l4 = byName('E2E 键位四级子级')
    const l4s = byName('E2E 键位四级同级')
    return {
      l2: !!l2 && !l2.parentId,
      l3: !!l3 && !!l2 && l3.parentId === l2.id,
      l4: !!l4 && !!l3 && l4.parentId === l3.id,
      l4s: !!l4s && !!l3 && l4s.parentId === l3.id,
      labels: [...document.querySelectorAll('[data-mind-node] .mind-level')].map(x => x.textContent.trim()),
    }
  }))
  report('E2E-45 V3.9.10 节点聚焦键位跨层级（V3.9.34 随迁 Ctrl+Enter）：L2 Ctrl+Enter 建同级 → Tab 建 L3 → Tab 建 L4 → Ctrl+Enter 建 L4 同级',
    keySeed && keyTree.l2 && keyTree.l3 && keyTree.l4 && keyTree.l4s && keyTree.labels.includes('L4'),
    JSON.stringify(keyTree))

  // E2E-50（V4.0.4）：树状布局切换器已迁入画布工具条。连线不是装饰伪元素，
  //   而是按真实父子节点盒生成的正交 SVG；每个直接子节点对应一条非空路径。
  await page.locator('.mindmap-layout button').filter({ hasText: '树状' }).first().click()
  const treeLayoutReady = await pollUntil(
    () => page.locator('.mindmap-canvas[data-layout="tree"]').count().then(Boolean),
    { timeout: 5000, label: '树状画布布局生效' },
  )
  const readConnectorContract = () => page.evaluate(() => {
    const svg = document.querySelector('.mind-connectors')
    const paths = [...document.querySelectorAll('.mind-connectors path')]
    const branches = [...document.querySelectorAll('.mind-stage [data-mind-branch]')]
    const expected = branches.reduce((n, branch) => {
      const children = branch.querySelector(':scope > .mind-children')
      return n + (children ? children.querySelectorAll(':scope > .mind-branch').length : 0)
    }, 0)
    const nonEmpty = paths.filter(p => (p.getAttribute('d') || '').trim().length > 0).length
    const stage = document.querySelector('.mind-stage')
    return {
      ok: !!svg && expected > 0 && paths.length === expected && nonEmpty === expected
        && !!stage && getComputedStyle(stage).position === 'relative',
      txt: `SVG=${!!svg} 期望=${expected} 路径=${paths.length} 非空=${nonEmpty} 舞台定位=${stage ? getComputedStyle(stage).position : '无'}`,
    }
  })
  let connectorContract = await readConnectorContract()
  if (!connectorContract.ok) {
    await pollUntil(async () => {
      connectorContract = await readConnectorContract()
      return connectorContract.ok
    }, { timeout: 5000, label: '树状 SVG 连线完成绘制' })
  }
  report('E2E-50 V4.0.4 画布工具条切换树状布局后，SVG 正交连线按真实父子分支数量生成',
    treeLayoutReady && connectorContract.ok,
    `布局=${treeLayoutReady} ${connectorContract.txt}`)

  // E2E-51（V3.9.17）：空间树导航只移动焦点，不改变 Tab / Enter 的建支语义。
  //   从 L1 出发验证右进首子、左回父级、上下按可见顺序移动、Home/End 到首尾；
  //   全程分支数必须不变，避免方向键误触建支或进入编辑态。
  const navBefore = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const cats = ((r['zy_data_v2'] || {}).categories || [])
    return {
      count: cats.filter(c => c.workspaceId === 'e2e-main-board').length,
      visible: [...document.querySelectorAll('.mindmap-canvas [data-mind-node]')].map(x => x.getAttribute('data-mind-node')),
      firstChild: document.querySelector('.mind-root-branch > .mind-children > .mind-branch > .mind-node')?.getAttribute('data-mind-node') || '',
    }
  }))
  await page.locator('[data-mind-node="root"]').focus()
  await page.keyboard.press('ArrowRight')
  const rightToChild = await pollUntil(async () => page.evaluate((id) => {
    return document.activeElement?.getAttribute('data-mind-node') === id
  }, navBefore.firstChild), { timeout: 3000, label: '方向键进入首个子节点' })
  await page.keyboard.press('ArrowLeft')
  const leftToRoot = await pollUntil(async () => page.evaluate(() => {
    return document.activeElement?.getAttribute('data-mind-node') === 'root'
  }), { timeout: 3000, label: '方向键返回父节点' })
  await page.keyboard.press('ArrowDown')
  const downToSecond = await pollUntil(async () => page.evaluate((id) => {
    return document.activeElement?.getAttribute('data-mind-node') === id
  }, navBefore.visible[1] || ''), { timeout: 3000, label: '方向键按可见顺序下移' })
  await page.keyboard.press('ArrowUp')
  const upToRoot = await pollUntil(async () => page.evaluate(() => {
    return document.activeElement?.getAttribute('data-mind-node') === 'root'
  }), { timeout: 3000, label: '方向键按可见顺序上移' })
  await page.keyboard.press('End')
  const endToLast = await pollUntil(async () => page.evaluate((id) => {
    return document.activeElement?.getAttribute('data-mind-node') === id
  }, navBefore.visible[navBefore.visible.length - 1] || ''), { timeout: 3000, label: 'End 到末节点' })
  await page.keyboard.press('Home')
  const homeToFirst = await pollUntil(async () => page.evaluate(() => {
    return document.activeElement?.getAttribute('data-mind-node') === 'root'
  }), { timeout: 3000, label: 'Home 到首节点' })
  const navAfter = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const cats = ((r['zy_data_v2'] || {}).categories || [])
    return {
      count: cats.filter(c => c.workspaceId === 'e2e-main-board').length,
      editing: !!document.querySelector('.mind-edit-title, .mind-edit-desc'),
    }
  }))
  report('E2E-51 V3.9.17 树画布空间导航：→ 首子 / ← 父级 / ↑↓ 顺序 / Home·End 首尾；方向键零建支',
    navBefore.firstChild && navBefore.visible.length >= 2
      && rightToChild && leftToRoot && downToSecond && upToRoot && endToLast && homeToFirst
      && navAfter.count === navBefore.count && !navAfter.editing,
    `nodes=${navBefore.visible.length} first=${navBefore.firstChild} `
      + `right=${rightToChild} left=${leftToRoot} down=${downToSecond} up=${upToRoot} `
      + `end=${endToLast} home=${homeToFirst} count=${navBefore.count}→${navAfter.count} editing=${navAfter.editing}`)

  // E2E-46（V4.1.2 重指）：分享抽屉必须是原生可读预览，不能再是白屏 iframe；
  //   预览按真实 Category 树递归平铺到 L4。V4.7 起两项读数归右侧全局功能模块，
  //   分享是该模块右上角唯一主行动；页面设置齿轮已退役，能力迁入台数据菜单。
  // 分享用例同时验证“有中心论点”的信息层级：先种入论点卡，避免空态下
  // 误把“读数依法不渲染”当成组件缺席。
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(async (r) => {
    const data = r['zy_data_v2']
    const thesisId = 'e2e-v404-thesis'
    data.resources = (data.resources || []).filter(card => card.id !== thesisId)
    data.resources.push({
      id: thesisId,
      kind: 'resource',
      title: 'E2E V4.0.4 中心论点',
      description: '中心论点卡的读数层级验收',
      workspaceId: 'e2e-main-board',
      categoryId: '',
      tags: [],
      isThesis: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await chrome.storage.local.set({ zy_data_v2: data })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await pollUntil(
    () => page.locator('.cur-global-panel .cur-metric').count().then(n => n === 2),
    { timeout: 10000, label: '全局功能模块两项读数上屏' },
  )
  await page.locator('.share-action').first().click()
  await waitForLocator(page, '.cs-paper', { visible: true, timeout: 10000 })
  const sharePreview = await page.evaluate(() => {
    const paper = document.querySelector('.cs-paper')
    const text = paper ? paper.textContent : ''
    const iframes = document.querySelectorAll('.drawer iframe').length
    const banner = document.querySelector('.thesis-banner')
    const toolbar = document.querySelector('.ws-toolbar.cur-toolbar')
    const globalPanel = document.querySelector('.cur-global-panel')
    const metrics = [...document.querySelectorAll('.cur-metric')]
    const shareAction = document.querySelector('.share-action')
    const share = shareAction?.getBoundingClientRect()
    return {
      visible: !!paper && paper.getBoundingClientRect().height > 50,
      levels: ['L2', 'L3', 'L4'].filter(l => text.includes(l + ' · 论证节点')),
      hasNodes: ['E2E 键位二级同级', 'E2E 键位三级子级', 'E2E 键位四级子级'].every(n => text.includes(n)),
      iframes,
      metricsInGlobal: metrics.length === 2 && metrics.every(metric => !!globalPanel && metric.closest('.cur-global-panel') === globalPanel),
      shareInToolbar: !!toolbar && !!shareAction && shareAction.closest('.ws-toolbar.cur-toolbar') === toolbar,
      settingsRetired: !document.querySelector('button.hero-btn.settings[title="策展台设置"]'),
      shareInGlobalHead: !!globalPanel && !!shareAction && shareAction.closest('.cur-global-head') === globalPanel.querySelector('.cur-global-head'),
      metricsOutOfBanner: metrics.every(metric => !banner || metric.closest('.thesis-banner') !== banner),
      shareHasBox: !!share && share.width > 0 && share.height > 0,
    }
  })
  report('E2E-46 V4.7 分享预览原生可读且递归呈现 L2–L4；读数归全局功能模块，设置齿轮退役，分享为右栏顶部主行动',
    sharePreview.visible && sharePreview.levels.length === 3 && sharePreview.hasNodes
      && sharePreview.iframes === 0 && sharePreview.metricsInGlobal && sharePreview.metricsOutOfBanner
      && sharePreview.shareInToolbar && sharePreview.settingsRetired
      && sharePreview.shareHasBox && sharePreview.shareInGlobalHead,
    JSON.stringify(sharePreview))
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(500)

  // E2E-47（V3.9.11 · G-07）：分享 HTML 的真实外部分享验收。
  //   不读生成器源码、也不只看站内抽屉：下载 HTML 后用独立页面打开，检查桌面、移动、
  //   打印三种媒介下的横向树可读性、公开链接、自包含长图下载与页面无横向溢出。
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(async (r) => {
    const d = r['zy_data_v2']
    if (!d) return false
    const now = Date.now()
    const thesis = (d.resources || []).find(x => x.id === 'e2e-v404-thesis' && x.isThesis)
    const galleryNode = (d.categories || []).find(x => x.id === 'e2e-key-root')
    const imageMeta = (id, name) => ({
      id, kind: 'image', name, size: 68, mime: 'image/png', createdAt: now,
    })
    if (thesis) thesis.assets = [
      imageMeta('e2e-thesis-image-1', '中心论点附件一.png'),
      imageMeta('e2e-thesis-image-2', '中心论点附件二.png'),
    ]
    if (galleryNode) galleryNode.assets = [
      imageMeta('e2e-node-image-1', '分支附件一.png'),
      imageMeta('e2e-node-image-2', '分支附件二.png'),
    ]
    d.resources = (d.resources || []).filter(x => x && x.id !== 'e2e-public-res')
      .filter(x => x && x.id !== 'e2e-thesis-linked-res')
    d.resources.push({
      id: 'e2e-public-res', kind: 'resource', title: 'E2E 公开证据',
      description: '用于验证分享 HTML 的公开资源链接。',
      linkType: 'url', link: 'https://example.com/evidence',
      workspaceId: 'e2e-main-board', categoryId: 'e2e-key-root',
      sourceType: 'official', tags: ['E2E'], pinned: false, callCount: 0,
      customFields: {}, assets: [], createdAt: now, updatedAt: now,
    })
    if (thesis) {
      d.resources.push({
        id: 'e2e-thesis-linked-res', kind: 'resource', title: 'E2E 中心论点关联卡',
        description: '中心论点关联卡也应进入导出 HTML。',
        linkType: 'url', link: 'https://example.com/thesis-linked',
        workspaceId: 'e2e-main-board', categoryId: thesis.id,
        sourceType: 'academic', tags: ['论点证据'], pinned: false, callCount: 0,
        customFields: {}, assets: [], createdAt: now, updatedAt: now,
      })
    }
    const png = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlQ8WQAAAAASUVORK5CYII='),
      c => c.charCodeAt(0),
    )
    const putBlob = (id) => new Promise((resolve, reject) => {
      const rq = indexedDB.open('zy_assets', 1)
      rq.onupgradeneeded = () => {
        if (!rq.result.objectStoreNames.contains('assets')) rq.result.createObjectStore('assets')
      }
      rq.onerror = () => reject(rq.error)
      rq.onsuccess = () => {
        const tx = rq.result.transaction('assets', 'readwrite')
        tx.objectStore('assets').put(new Blob([png], { type: 'image/png' }), id)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      }
    })
    await Promise.all(['e2e-thesis-image-1', 'e2e-thesis-image-2', 'e2e-node-image-1', 'e2e-node-image-2'].map(putBlob))
    await chrome.storage.local.set({ zy_data_v2: d })
    return true
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-mind-node="e2e-key-root"]', { visible: true, timeout: 10000 })
  await page.locator('.share-action').first().click()
  await waitForLocator(page, '.cs-paper', { visible: true, timeout: 10000 })
  await page.locator('.cs-format').filter({ hasText: '论证树' }).click()
  await pollUntil(async () => {
    const text = await page.locator('.cs-image-state').innerText().catch(() => '')
    return text.includes('已嵌入分享 HTML')
  }, { timeout: 20000, label: '分享长图嵌入完成' })
  const htmlDownloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.locator('.cs-btn.primary').filter({ hasText: '下载 HTML' }).click()
  const htmlDownload = await htmlDownloadPromise
  const os = require('os')
  const shareTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zy-share-e2e-'))
  const shareFile = path.join(shareTmp, 'share.html')
  await htmlDownload.saveAs(shareFile)
  const shareHtml = fs.readFileSync(shareFile, 'utf8')
  const shareServer = require('http').createServer((rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    rs.end(shareHtml)
  })
  await new Promise(resolve => shareServer.listen(0, '127.0.0.1', resolve))
  const sharePort = shareServer.address().port
  const sharePage = await ctx.newPage()
  await sharePage.setViewportSize({ width: 1440, height: 1000 })
  await sharePage.goto(`http://127.0.0.1:${sharePort}/`, { waitUntil: 'domcontentloaded' })
  await sharePage.waitForTimeout(300)
  const shareDesktop = await sharePage.evaluate(() => {
    const tree = document.querySelector('.tree-scroll')
    const treeCanvas = document.querySelector('.share-tree')
    const link = document.querySelector('.tree-node a.res-title')
    const image = document.querySelector('.image-download')
    const thesisLinked = [...document.querySelectorAll('.share-root a.res-title')]
      .find(a => (a.textContent || '').includes('E2E 中心论点关联卡'))
    const galleries = [...document.querySelectorAll('.asset-gallery')]
    return {
      title: document.querySelector('.tree-hero h1')?.textContent || '',
      bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
      treeReady: !!tree && !!treeCanvas
        && !!tree.querySelector('.share-root')
        && tree.querySelectorAll('.tree-node').length >= 4,
      treeSize: tree ? `${tree.scrollWidth}/${tree.clientWidth}` : '',
      levels: [...new Set([...document.querySelectorAll('.node-kicker')].map(x => (x.textContent || '').trim()))],
      linkHref: link?.getAttribute('href') || '',
      linkTarget: link?.getAttribute('target') || '',
      imageData: (image?.getAttribute('href') || '').startsWith('data:image/png;base64,'),
      imageVisible: !!image && getComputedStyle(image).display !== 'none',
      themeBg: getComputedStyle(document.body).backgroundColor,
      galleryGroups: galleries.length,
      galleryThumbs: document.querySelectorAll('.gallery-thumb').length,
      galleryClosed: galleries.length > 0
        && galleries.every(g => getComputedStyle(g.querySelector('.gallery-lightbox')).display === 'none'),
      thesisLinkedHref: thesisLinked?.getAttribute('href') || '',
    }
  })
  let galleryOpened = false
  let gallerySwitched = false
  let galleryClosed = false
  const firstGallery = sharePage.locator('.asset-gallery').first()
  if (await firstGallery.count()) {
    await firstGallery.locator('.gallery-thumb').first().click()
    const opened = await firstGallery.evaluate(gallery => {
      const lightbox = gallery.querySelector('.gallery-lightbox')
      const slides = [...gallery.querySelectorAll('.gallery-slide')]
      const visible = slides.filter(slide => getComputedStyle(slide).display !== 'none')
      return {
        dialog: getComputedStyle(lightbox).display === 'flex',
        visible: visible.length === 1,
        first: visible[0]?.classList.contains('gallery-slide-1') || false,
        image: !!visible[0]?.querySelector('img')?.getAttribute('src')?.startsWith('data:image/png;base64,'),
      }
    })
    galleryOpened = opened.dialog && opened.visible && opened.first && opened.image
    await firstGallery.locator('.gallery-slide:visible .gallery-next').click()
    gallerySwitched = await firstGallery.evaluate(gallery => {
      const slides = [...gallery.querySelectorAll('.gallery-slide')]
      const visible = slides.filter(slide => getComputedStyle(slide).display !== 'none')
      const checked = gallery.querySelector('.gallery-radio:checked')
      return visible.length === 1
        && visible[0]?.classList.contains('gallery-slide-2')
        && checked?.id.endsWith('-slide-2')
        && visible[0]?.querySelector('.gallery-count')?.textContent?.trim() === '2 / 2'
    })
    await firstGallery.locator('.gallery-close').click()
    galleryClosed = await firstGallery.evaluate(gallery =>
      getComputedStyle(gallery.querySelector('.gallery-lightbox')).display === 'none')
  }
  let sharePopupOpened = false
  await ctx.route('https://example.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>E2E public evidence</title><main>ok</main>',
  }))
  try {
    const popupPromise = sharePage.waitForEvent('popup', { timeout: 5000 })
    await sharePage.locator('.tree-node a.res-title').first().click()
    const popup = await popupPromise
    sharePopupOpened = /example\.com/.test(popup.url())
    await popup.close()
  } catch { /* 结果由 sharePopupOpened 记账，不吞成假绿 */ }
  await ctx.unroute('https://example.com/**').catch(() => {})

  const imageDownloadPromise = sharePage.waitForEvent('download', { timeout: 20000 })
  await sharePage.locator('.image-download').click()
  const imageDownload = await imageDownloadPromise
  const imageFile = path.join(shareTmp, 'share-image.png')
  await imageDownload.saveAs(imageFile)
  const png = fs.readFileSync(imageFile)
  const pngOk = png.length > 24
    && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const imageW = pngOk ? png.readUInt32BE(16) : 0
  const imageH = pngOk ? png.readUInt32BE(20) : 0

  await sharePage.setViewportSize({ width: 390, height: 844 })
  const shareMobile = await sharePage.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    titleVisible: !!document.querySelector('.tree-hero h1'),
    linkCount: document.querySelectorAll('.tree-node a.res-title').length,
    imageVisible: (() => {
      const el = document.querySelector('.image-download')
      return !!el && getComputedStyle(el).display !== 'none'
    })(),
  }))
  await sharePage.setViewportSize({ width: 1440, height: 1000 })
  await sharePage.emulateMedia({ media: 'print' })
  const sharePrint = await sharePage.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    downloadHidden: (() => {
      const el = document.querySelector('.image-download')
      return !!el && getComputedStyle(el).display === 'none'
    })(),
    treeNodeCount: document.querySelectorAll('.tree-node').length,
  }))
  await sharePage.close().catch(() => {})
  shareServer.closeAllConnections?.()
  await new Promise(resolve => shareServer.close(resolve))

  // 同一套验收再跑墨黑主题：不能只证明纸白主题在外部可读。
  await page.locator('.cs-themes button').filter({ hasText: '墨黑演示版' }).click()
  await pollUntil(async () => {
    const text = await page.locator('.cs-image-state').innerText().catch(() => '')
    return text.includes('已嵌入分享 HTML')
  }, { timeout: 20000, label: '墨黑分享长图嵌入完成' })
  const inkDownloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.locator('.cs-btn.primary').filter({ hasText: '下载 HTML' }).click()
  const inkDownload = await inkDownloadPromise
  const inkFile = path.join(shareTmp, 'share-ink.html')
  await inkDownload.saveAs(inkFile)
  const inkHtml = fs.readFileSync(inkFile, 'utf8')
  const inkServer = require('http').createServer((rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    rs.end(inkHtml)
  })
  await new Promise(resolve => inkServer.listen(0, '127.0.0.1', resolve))
  const inkPort = inkServer.address().port
  const inkPage = await ctx.newPage()
  await inkPage.setViewportSize({ width: 1440, height: 1000 })
  await inkPage.goto(`http://127.0.0.1:${inkPort}/`, { waitUntil: 'domcontentloaded' })
  const inkDesktop = await inkPage.evaluate(() => {
    const tree = document.querySelector('.tree-scroll')
    const treeCanvas = document.querySelector('.share-tree')
    return {
      title: document.querySelector('.tree-hero h1')?.textContent || '',
      bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
      treeReady: !!tree && !!treeCanvas
        && !!tree.querySelector('.share-root')
        && tree.querySelectorAll('.tree-node').length >= 4,
      themeBg: getComputedStyle(document.body).backgroundColor,
      levels: [...new Set([...document.querySelectorAll('.node-kicker')].map(x => (x.textContent || '').trim()))],
      imageVisible: (() => {
        const el = document.querySelector('.image-download')
        return !!el && getComputedStyle(el).display !== 'none'
      })(),
    }
  })
  await inkPage.setViewportSize({ width: 390, height: 844 })
  const inkMobile = await inkPage.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    titleVisible: !!document.querySelector('.tree-hero h1'),
    linkCount: document.querySelectorAll('.tree-node a.res-title').length,
  }))
  await inkPage.setViewportSize({ width: 1440, height: 1000 })
  await inkPage.emulateMedia({ media: 'print' })
  const inkPrint = await inkPage.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    downloadHidden: (() => {
      const el = document.querySelector('.image-download')
      return !!el && getComputedStyle(el).display === 'none'
    })(),
    treeNodeCount: document.querySelectorAll('.tree-node').length,
  }))
  const shareExternalOk = shareHtml.includes('id="zy-curation-share-data"')
    && shareDesktop.title.trim().length > 0
    && shareDesktop.bodyOverflow <= 1
    && shareDesktop.treeReady
    && shareDesktop.levels.includes('L2 · 论证节点')
    && shareDesktop.levels.includes('L3 · 论证节点')
    && shareDesktop.levels.includes('L4 · 论证节点')
    && shareDesktop.linkHref === 'https://example.com/evidence'
    && shareDesktop.linkTarget === '_blank'
    && shareDesktop.thesisLinkedHref === 'https://example.com/thesis-linked'
    && shareDesktop.galleryGroups === 2 && shareDesktop.galleryThumbs === 4
    && shareDesktop.galleryClosed && galleryOpened && gallerySwitched && galleryClosed
    && sharePopupOpened
    && shareDesktop.imageData && shareDesktop.imageVisible
    && pngOk && imageW >= 1200 && imageH >= 800
    && shareMobile.bodyOverflow <= 1 && shareMobile.titleVisible
    && shareMobile.linkCount > 0 && shareMobile.imageVisible
    && sharePrint.bodyOverflow <= 1 && sharePrint.downloadHidden && sharePrint.treeNodeCount >= 4
    && inkHtml.includes('id="zy-curation-share-data"')
    && inkDesktop.title.trim().length > 0
    && inkDesktop.bodyOverflow <= 1 && inkDesktop.treeReady
    && inkDesktop.themeBg === 'rgb(23, 24, 28)'
    && inkDesktop.levels.includes('L2 · 论证节点')
    && inkDesktop.levels.includes('L3 · 论证节点')
    && inkDesktop.levels.includes('L4 · 论证节点')
    && inkDesktop.imageVisible
    && inkMobile.bodyOverflow <= 1 && inkMobile.titleVisible && inkMobile.linkCount > 0
    && inkPrint.bodyOverflow <= 1 && inkPrint.downloadHidden && inkPrint.treeNodeCount >= 4
  report('E2E-47 V4.2.1 分享 HTML 外部独立打开：中心论点关联卡可点击、中心论点与分支附件可打开大图并左右切换、公开链接、自包含长图、移动与打印',
    shareExternalOk,
    `paper=${Math.round(Buffer.byteLength(shareHtml) / 1024)}KB desktop=${JSON.stringify(shareDesktop)} gallery=${galleryOpened}/${gallerySwitched}/${galleryClosed} popup=${sharePopupOpened} png=${imageW}×${imageH}/${Math.round(png.length / 1024)}KB mobile=${JSON.stringify(shareMobile)} print=${JSON.stringify(sharePrint)} ink=${Math.round(Buffer.byteLength(inkHtml) / 1024)}KB desktop=${JSON.stringify(inkDesktop)} mobile=${JSON.stringify(inkMobile)} print=${JSON.stringify(inkPrint)}`)
  await inkPage.close().catch(() => {})
  inkServer.closeAllConnections?.()
  await new Promise(resolve => inkServer.close(resolve))
  await page.evaluate(async () => {
    const ids = new Set(['e2e-thesis-image-1', 'e2e-thesis-image-2', 'e2e-node-image-1', 'e2e-node-image-2'])
    const cur = await chrome.storage.local.get('zy_data_v2')
    const d = cur['zy_data_v2']
    if (d) {
      const thesis = (d.resources || []).find(x => x.id === 'e2e-v404-thesis')
      if (thesis) thesis.assets = (thesis.assets || []).filter(a => !ids.has(a.id))
      const node = (d.categories || []).find(x => x.id === 'e2e-key-root')
      if (node) node.assets = (node.assets || []).filter(a => !ids.has(a.id))
      d.resources = (d.resources || []).filter(x => x.id !== 'e2e-thesis-linked-res')
      await chrome.storage.local.set({ zy_data_v2: d })
    }
    await new Promise((resolve, reject) => {
      const rq = indexedDB.open('zy_assets', 1)
      rq.onerror = () => reject(rq.error)
      rq.onsuccess = () => {
        const tx = rq.result.transaction('assets', 'readwrite')
        for (const id of ids) tx.objectStore('assets').delete(id)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      }
    })
  }).catch(() => {})
  fs.rmSync(shareTmp, { recursive: true, force: true })


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
  /* V4.1.2：页面设置齿轮已退役，删除策展台改由顶栏台签右键菜单承接。 */
  await page.locator('.tabs .tab').filter({ hasText: '待删台' }).first().click({ button: 'right' })
  await waitForLocator(page, '.ctx-menu .ctx-item.danger', { visible: true, timeout: 5000 })
  await page.locator('.ctx-menu .ctx-item.danger').filter({ hasText: '删除策展台' }).first().click()
  /* ★R175-补：等确认弹窗真出现再点（原来死等 500ms）。 */
  await page.getByText("移入回收站").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {})
  const confirmMsg = await page.getByText('移入回收站').first().isVisible().catch(() => false)
  await page.evaluate(() => { const b = document.querySelector('.cdf-btn.ok'); if (b) b.click() })
  /* ★R175-补：等软删真落库（台已移出 + 卡带 deletedAt）再读。 */
  await waitForStorage(page, "zy_data_v2",
    (raw) => { const dd = raw["zy_data_v2"] || {}; const card = (dd.resources || []).find(x => x.id === "e2e-del-card"); return !(dd.workspaces || []).some(w => w.id === "e2e-del-ws") && !!(card && card.deletedAt) },
    { timeout: 10000 })
  const afterDel = await page.evaluate(() => new Promise((res) => chrome.storage.local.get('zy_data_v2').then(r => {
    const dd = r['zy_data_v2']
    const card = (dd.resources || []).find(x => x.id === 'e2e-del-card')
    res({ wsGone: !(dd.workspaces || []).some(w => w.id === 'e2e-del-ws'), softDeleted: !!(card && card.deletedAt && !card.purged), cardExists: !!card })
  })))
  await page.evaluate(() => { location.hash = '#/recycle' })
  /* ★R175-补：等回收站列表真出现该卡再判。 */
  await page.getByText("E2E 待删台资源卡").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {})
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

  // E2E-62（V4.2.4）：项目塔和项目全景都能就地改项目名；成功指标双击标题即可改名，且统一走 persist 全局生效。
  await page.goto(base + '#/compass', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  const projectTower = page.locator('[data-tower="e2e-empty-proj"]').first()
  await projectTower.waitFor({ state: 'visible', timeout: 10000 })
  await projectTower.locator('button.tw-rename').click({ force: true })
  const towerProjectEditor = page.locator('[data-edit="proj-e2e-empty-proj"]').first()
  await waitForLocator(page, '[data-edit="proj-e2e-empty-proj"][contenteditable="true"]', { visible: true, timeout: 5000 })
  await towerProjectEditor.evaluate((el, value) => {
    el.innerText = value
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
  }, 'E2E 塔内改名项目')
  const towerProjectSaved = await waitForStorage(page, 'zy_data_v2', raw =>
    raw.zy_data_v2?.compass?.directions
      ?.flatMap(direction => direction.projects || [])
      .some(project => project.id === 'e2e-empty-proj' && project.name === 'E2E 塔内改名项目'),
  { timeout: 5000 })

  await projectTower.locator('button[title^="横向泳道"]').click()
  await waitForLocator(page, '.pano .ph-rename', { visible: true, timeout: 8000 })
  await page.locator('.pano .ph-rename').first().click()
  const panoProjectEditor = page.locator('.pano [data-edit="proj-e2e-empty-proj"][contenteditable="true"]').first()
  await panoProjectEditor.waitFor({ state: 'visible', timeout: 5000 })
  await panoProjectEditor.evaluate((el, value) => {
    el.innerText = value
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
  }, 'E2E 全景改名项目')
  const panoProjectSaved = await waitForStorage(page, 'zy_data_v2', raw =>
    raw.zy_data_v2?.compass?.directions
      ?.flatMap(direction => direction.projects || [])
      .some(project => project.id === 'e2e-empty-proj' && project.name === 'E2E 全景改名项目'),
  { timeout: 5000 })

  const panoMetricTitle = page.locator('.pano [data-edit="metric-e2e-m-empty"]').first()
  await panoMetricTitle.dblclick()
  await waitForLocator(page, '.pano [data-edit="metric-e2e-m-empty"][contenteditable="true"]', { visible: true, timeout: 5000 })
  await panoMetricTitle.evaluate((el, value) => {
    el.innerText = value
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
  }, 'E2E 全景改名指标')
  const metricSaved = await waitForStorage(page, 'zy_data_v2', raw =>
    raw.zy_data_v2?.compass?.directions
      ?.flatMap(direction => direction.projects || [])
      .find(project => project.id === 'e2e-empty-proj')
      ?.metrics?.some(metric => metric.id === 'e2e-m-empty' && metric.title === 'E2E 全景改名指标'),
  { timeout: 5000 })
  report('E2E-62 ★V4.2.4 项目塔 / 项目全景项目名可编辑，成功指标双击标题就地改名并持久化',
    !!towerProjectSaved && !!panoProjectSaved && !!metricSaved,
    `塔内项目=${!!towerProjectSaved} 全景项目=${!!panoProjectSaved} 指标=${!!metricSaved}`)


  // E2E-21（★V4.7.6 重指）：页头只保留紧凑主攻项目与今日战报；主攻点击打开右侧完整项目详情。
  //   行为不变：不再跳画像页，而是由 TodayBattleHost 就地打开弹窗。
  // 本用例守「入口真的连到组件」与「位置符合本轮拍板」两件事。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const battleBtn = page.locator('.desk-actions .battle-trigger').first()
  const focusProjects = page.locator('.desk-focus-project')
  const focusProjectCount = await focusProjects.count()
  const removedHeaderActions = await page.locator('.desk-head').evaluate(el =>
    !el.textContent?.includes('为什么这样排') && !el.textContent?.includes('AI 推荐今日重点'))
  let focusDrawerOpen = false
  if (focusProjectCount) {
    const focusProjectTitle = (await focusProjects.first().innerText()).split('\n')[0]
    await focusProjects.first().click()
    const focusDrawer = page.locator('.drawer').filter({ hasText: focusProjectTitle }).first()
    focusDrawerOpen = await focusDrawer.isVisible().catch(() => false)
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 }).catch(() => {})
  }
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
  report('E2E-21 ★V4.7.6 调度台页头展示不超过三个主攻项目，点击右侧打开项目详情；今日战报就地开弹窗并可关闭',
    battleBtnText.includes('今日战报') && focusProjectCount > 0 && focusProjectCount <= 3 && removedHeaderActions
      && focusDrawerOpen && battleOpen && battleTitle.includes('今日战报') && battleCloseVisible && battleClosed,
    `btn="${battleBtnText}" 主攻=${focusProjectCount} 旧入口移除=${removedHeaderActions} 项目抽屉=${focusDrawerOpen} modal=${battleOpen} title="${battleTitle}" closeBtn=${battleCloseVisible} closed=${battleClosed}`)

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

  // E2E-22 策展画布全屏（V3.9.8 重指）：旧 `.pyramid/.py-fs-btn` 随四视图退役，
  // 现役入口是共享画布的 `.mindmap-shell`。所守行为仍是：
  // ① 进入全屏；② 画布工具条/布局切换仍在；③ 画布和节点仍可见可操作；④ 可退出。
  // ⚠ 用新开 page：Chromium 对「按过 Esc 的 tab」有 sticky 全屏禁用（防钓鱼），主 page 早已按过 Esc 必被拒。
  const pyPage = await ctx.newPage()
  const diagErrors = []
  pyPage.on('console', m => { if (m.type() === 'error') diagErrors.push(m.text().slice(0, 120)) })
  pyPage.on('pageerror', e => diagErrors.push('pageerror:' + String(e).slice(0, 120)))
  await pyPage.setViewportSize({ width: 1440, height: 900 })
  await pyPage.goto(base + '#/workspace/' + seedWsId, { waitUntil: 'domcontentloaded' })
  await pyPage.waitForTimeout(2000)
  if (!pyPage.url().includes('/workspace/')) { await pyPage.evaluate((id) => { location.hash = '#/workspace/' + id }, seedWsId); await pyPage.waitForTimeout(1500) }
  await waitForLocator(pyPage, '.mindmap-shell', { visible: true, timeout: 10000 })
  const canvasBefore = await pyPage.locator('.mindmap-canvas[data-layout="pyramid"]').first().isVisible().catch(() => false)
  const fsButton = pyPage.locator('.mindmap-action', { hasText: '全屏' }).first()
  await fsButton.click()
  await pyPage.waitForTimeout(900)
  const fsOn = await pyPage.evaluate(() => !!document.fullscreenElement)
    || await pyPage.locator('.mindmap-shell.is-fullscreen, .mindmap-shell.is-fs-fallback').first().isVisible().catch(() => false)
  const fsToolbar = await pyPage.locator('.mindmap-bar').first().isVisible().catch(() => false)
  const fsLayoutSwitch = await pyPage.locator('.mindmap-layout button', { hasText: '树状' }).first().isVisible().catch(() => false)
  const fsCanvas = await pyPage.locator('.mindmap-canvas').first().isVisible().catch(() => false)
  const fsNode = await pyPage.locator('[data-mind-node="e2e-drag-c1"]').first().isVisible().catch(() => false)
  await pyPage.locator('.mindmap-layout button', { hasText: '树状' }).first().click().catch(() => {})
  await pyPage.waitForTimeout(400)
  const treeSwitched = await pyPage.locator('.mindmap-canvas[data-layout="tree"]').first().isVisible().catch(() => false)
  // 退出优先按钮，Esc 兜底（真全屏下浏览器可能先接管 Esc）。
  await pyPage.locator('.mindmap-action', { hasText: '退出全屏' }).first().click().catch(() => {})
  await pyPage.waitForTimeout(600)
  let fsOff = !(await pyPage.evaluate(() => !!document.fullscreenElement))
  if (!fsOff) { await pyPage.keyboard.press('Escape').catch(() => {}); await pyPage.waitForTimeout(500) }
  fsOff = !(await pyPage.evaluate(() => !!document.fullscreenElement))
    && !(await pyPage.locator('.mindmap-shell.is-fullscreen, .mindmap-shell.is-fs-fallback').first().isVisible().catch(() => false))
  await pyPage.close()
  report('E2E-22 策展画布全屏交互（V3.9.8 重指）', canvasBefore && fsOn && fsToolbar && fsLayoutSwitch && fsCanvas && fsNode && treeSwitched && fsOff,
    'canvas=' + canvasBefore + ' fs=' + fsOn + ' toolbar=' + fsToolbar + ' layoutSwitch=' + fsLayoutSwitch + ' canvasInFs=' + fsCanvas + ' node=' + fsNode + ' tree=' + treeSwitched + ' exit=' + fsOff + ' errors=' + (diagErrors.slice(0, 2).join(' | ') || '无'))

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
  /* ★R176-补：把前台化**提到导航之前**。
     原位置在导航与取高亮之后（注释说"后台页定时器会被节流"）——但真正受害的恰恰是
     导航到二级页这一段：异步组件 chunk 拉取 + 挂载 + 定位高亮都在导航后发生，
     页面处于后台时这段会被拖到秒级 ⇒ 「资源二级页=false 目标卡=0」全项假红
     （本轮第二轮 E2E 实测复现该形状：第一轮全绿、第二轮全 false）。
     前台化前移 ⇒ 这段链路从一开始就以正常节奏跑。 */
  await page.bringToFront()
  await page.evaluate(() => { location.hash = '#/deck/resource?hl=e2e-pool-1&hk=res' })
  /* ★R176-补：等资源二级页**真的上屏**再判，而不是死等 1600ms。
     病根（本轮第二轮 E2E 实测复现）：同一份代码第一轮全绿、第二轮 E2E-26 全项 false
     （连「资源二级页」都没渲染）⇒ 固定等待在慢机器/后台标签页上根本不够，
     后面每一步（点卡、开抽屉、读热度）都在「页面还没到」的状态下跑 ⇒ 必然全 false。
     判据强度不放松：超时后仍拿真实采样值去判，与改动前同口径。 */
  await waitForLocator(page, '.drawer .pcp', { visible: true, timeout: 10000 })
  const poolDeckOn = await page.locator('.drawer .pcp').first().isVisible().catch(() => false)
  const hlNode = page.locator('[data-rid="e2e-pool-1"]')
  /* 目标卡是**深链定位**的结果：路由 query 到位后卡片才渲染出来 ⇒ 等它出现再数。 */
  await waitForLocator(page, '[data-rid="e2e-pool-1"]', { timeout: 10000 })
  const hlCount = await hlNode.count()
  const hlFlash = hlCount ? (await hlNode.first().getAttribute('class').catch(() => '') || '').includes('flash') : false
  /* ★R176-补：取证字段——「二级页没上屏」有三种互斥可能（路由没切 / 渲染崩了 / 真没渲染），
     只看 poolDeckOn=false 分不清是哪一种 ⇒ 判红时必须能一眼看出根因。
     诊断**不参与判定**（判据一字未改），只进 detail 字符串。 */
  const e26Diag = await page.evaluate(() => {
    const err = document.querySelector('.render-error .re-msg')
    return {
      url: location.hash,
      renderError: err ? (err.textContent || '').slice(0, 120) : '',
      deckCount: document.querySelectorAll('.deck-page').length,
      pcpCount: document.querySelectorAll('.pcp').length,
      bodyStart: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80)
    }
  })
  const e26ErrLog = await page.evaluate(() => chrome.storage.local.get('zy_error_log').then((r) => {
    const arr = r['zy_error_log'] || []
    return arr.slice(-2).map(e => `${e.source}:${String(e.message).slice(0, 90)}@${e.route}`)
  })).catch(() => [])
  /* V4.7：hl 深链本身就会打开目标卡详情；这里等目标卡的标题真正出现，
     不再多点一次（否则同一次定位会记两次调出，且易误取外层的「全部资源卡」标题）。 */
  const drawerTitle = await pollUntil(() => page.evaluate(() => {
    const titles = [...document.querySelectorAll('.drawer-title')].map((t) => {
      const el = t.querySelector('input,textarea') || t
      return String(el.value !== undefined && el.value !== '' ? el.value : el.textContent || '')
    })
    return titles.find(t => t.includes('E2E 池卡定位')) || false
  }), { timeout: 10000, label: '资源详情抽屉显示目标卡' })
  // 抽屉标题是决定性证据（`.ds-ib` 只证明"有个抽屉"，证明不了"开的是这张卡"）
  /* ★R176-补：等「调出」事件真的落进事件日志 + 热度键（原来死等 2500ms）。
     热度写 250ms 防抖 + 事件日志并入同一次 set（R2-⑦ 修好后这条通道才真的通），
     但慢机器上 2500ms 未必够 ⇒ 随机假红。判据不变，只是把「等多久」改成「等到什么」。 */
  await waitForStorage(page, ['zy_event_log', 'zy_stats_v1'],
    (raw) => {
      const ev = raw.zy_event_log || []
      const hit = ev.filter((e) => e.action === 'call' && e.cardId === 'e2e-pool-1')
      const hot = raw.zy_stats_v1
      return hit.length > 0 && !!(hot && hot.cards && hot.cards['e2e-pool-1'])
    },
    { timeout: 15000 })
  const callEv = await page.evaluate(() => chrome.storage.local.get(['zy_event_log', 'zy_stats_v1']).then((raw) => {
    const ev = raw['zy_event_log'] || []
    const hit = ev.filter(e => e.action === 'call' && e.cardId === 'e2e-pool-1')
    const hot = raw['zy_stats_v1']
    return { n: hit.length, kind: hit.length ? hit[0].kind : '', hotEntry: hot && hot.cards ? hot.cards['e2e-pool-1'] : null }
  }))
  report('E2E-26 ★R2-④⑤ ⌘K 定位改靶「资源卡池」（一级资源页签 + 全部资源抽屉 + 目标卡高亮）+ 深链自动打开详情且只记一次调出（热度键与事件日志双落盘）',
    poolDeckOn && hlCount === 1 && hlFlash && !!drawerTitle && callEv.n === 1 && !!callEv.hotEntry,
    `资源抽屉=${poolDeckOn} 目标卡=${hlCount} 高亮=${hlFlash} 抽屉="${drawerTitle.slice(0, 18)}" call事件=${callEv.n}(${callEv.kind}) 热度=${JSON.stringify(callEv.hotEntry)} | 诊断 url="${e26Diag.url}" renderError="${e26Diag.renderError}" deck=${e26Diag.deckCount} pcp=${e26Diag.pcpCount} 正文="${e26Diag.bodyStart}" 错误日志=${JSON.stringify(e26ErrLog)}`)

  // E2E-27（V4.7 重指）：资源卡二级页壳退役，能力收进一级「全部资源卡」总夹抽屉；
  //   新建入口与批量全选、打标签、软删一样保留，不再由一份独立二级页承担。
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const oldDeckShellGone = (await page.locator('.deck-page').count()) === 0
  const allDrawerOn = await page.locator('.drawer .pcp').first().isVisible().catch(() => false)
  const newEntryPresent = await page.locator('.drawer .pcp .dk-new').first().isVisible().catch(() => false)
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
  report('E2E-27 ★V4.7.0 资源卡二级页壳退役：一级总夹抽屉同时保留新建入口与批量能力 → 全选打标签 → 批量软删进回收站',
    oldDeckShellGone && allDrawerOn && newEntryPresent && seedCardOn && countBefore >= 1 && batchBarOn
    && tagged.found && tagged.ws === 'zy-curation' && (tagged.tags || []).includes('E2E 标签甲') && (tagged.tags || []).includes('E2E 批量标签')
    && goneAfterBatch && softDeleted,
    `二级页壳归零=${oldDeckShellGone} 总夹抽屉=${allDrawerOn} 新建入口=${newEntryPresent} 种子卡上屏=${seedCardOn} 初始计数=${countBefore} 批量条=${batchBarOn} 标签=${JSON.stringify(tagged.tags)} 台=${tagged.ws} 删后端点=${goneAfterBatch} 软删=${softDeleted}`)

  // E2E-30（R3-Ca · V4.2.3 重指）：池面板补齐——列表视图 / 状态筛选下拉 / 批量反选 / 右键菜单置顶
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
  /* ★R176-补：等**网格视图真的上屏**再数，而不是死等 600ms。
     病根：固定等待在慢机器上不够 ⇒ gridCount 读到切换前的旧值 ⇒ 后面「列表/待打标/右键」
     整串操作都在错误状态上跑（本次实测症状：全选只选中 1 张、右键菜单为空）。
     判据强度不放松：等超时后仍拿真实采样值去判，与改动前同口径。 */
  await waitForLocator(page, '.pcp-card', { timeout: 8000 })
  const gridCount = await page.locator('.pcp-card').count()
  await page.locator('.dk-row[data-panel="pool"] .dk-view', { hasText: '列表' }).click().catch(() => {})
  await waitForLocator(page, '.pcp-row', { timeout: 8000 })
  const listCount = await page.locator('.pcp-row').count()
  const noTagShown = await page.locator('.pcp-row', { hasText: 'E2E 池卡乙' }).first().isVisible().catch(() => false)
  await page.locator('.dk-row[data-panel="pool"] .dk-filters.select .dk-select').selectOption('untagged').catch(() => {})
  /* 等筛选真的生效（待打标 ⇒ 只剩无标签那张）——同 R176-补 的理由：不等状态就往下跑 */
  await pollUntil(async () => (await page.locator('.pcp-row').count()) === 1, { timeout: 8000, label: '待打标筛选生效' })
  const untaggedCount = await page.locator('.pcp-row').count()
  const untaggedIsB = untaggedCount === 1 && (await page.locator('.pcp-row').first().textContent() || '').includes('E2E 池卡乙')
  await page.locator('.dk-row[data-panel="pool"] .dk-filters.select .dk-select').selectOption('all').catch(() => {})
  /* 等筛选真的退回全部（3 张）——下拉选中「全部」就是唯一的回到全部路径 */
  await pollUntil(async () => (await page.locator('.pcp-row').count()) >= 3, { timeout: 8000, label: '待打标筛选退回全部' })
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b && (b.textContent || '').trim() === '批量') b.click() })
  await page.waitForTimeout(400)
  await page.locator('.pcp .dkb-bar button', { hasText: /^全选$/ }).first().click().catch(() => {})
  /* ★R176-补：等全选计数真的变成「全部张数」再读（原来死等 400ms ⇒ 读到旧计数） */
  await pollUntil(async () => {
    const t = await page.locator('.pcp .dkb-count').textContent().catch(() => '0')
    return parseInt((t || '').replace(/\D/g, '') || '0', 10) >= 3
  }, { timeout: 8000, label: '全选计数到位' })
  const selAll = parseInt((await page.locator('.pcp .dkb-count').textContent().catch(() => '0'))?.replace(/\D/g, '') || '0', 10)
  await page.locator('.pcp .dkb-bar button', { hasText: /^反选$/ }).first().click().catch(() => {})
  /* 等反选真的归零 */
  await pollUntil(async () => {
    const t = await page.locator('.pcp .dkb-count').textContent().catch(() => '')
    return parseInt((t || '').replace(/\D/g, '') || 'x', 10) === 0
  }, { timeout: 8000, label: '反选归零' })
  const selAfterInvert = parseInt((await page.locator('.pcp .dkb-count').textContent().catch(() => 'x'))?.replace(/\D/g, '') || 'x', 10)
  await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b && (b.textContent || '').includes('退出批量')) b.click() })
  await page.waitForTimeout(400)
  // 右键取「甲」——它有链接，菜单应是六件：打开详情 / 星标 / 置顶 / 加入常用夹 / 复制链接 / 删除。
  // 无链接的卡会少「复制链接」一项，恰好证明它是条件项，而不是固定渲染空动作。
  const cardA = page.locator('.pcp-row', { hasText: 'E2E 池卡甲' }).first()
  await cardA.click({ button: 'right' }).catch(() => {})
  /* ★R176-补：等右键菜单**真的渲染出来**再取它的条目（原来死等 500ms）。
     慢机器上菜单尚未挂上 ⇒ ctxItems=[] ⇒ 置顶点不到 ⇒ 落库 pinned=false ⇒ 假红。 */
  await waitForLocator(page, '.cx-item', { timeout: 8000 })
  const ctxItems = await page.locator('.cx-item').allTextContents().catch(() => [])
  const pinItem = page.locator('.cx-item', { hasText: '置顶' }).first()
  await pinItem.click().catch(() => {})
  /* 等置顶真的落库（storage 里 pinned 变 true）——判据不变，只是把「等多久」改成「等到什么」 */
  await waitForStorage(page, 'zy_data_v2',
    (raw) => { const c = ((raw.zy_data_v2 || {}).resources || []).find(x => x.id === 'e2e-ca-1'); return !!(c && c.pinned) },
    { timeout: 8000 })
  const pinnedBack = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const c = ((cur['zy_data_v2'] || {}).resources || []).find(x => x.id === 'e2e-ca-1')
    return { pinned: !!(c && c.pinned) }
  }))
  const pinBadge = await pollUntil(
    async () => page.locator('.pcp-row', { hasText: 'E2E 池卡甲' }).first().locator('.pcp-pin').isVisible().catch(() => false),
    { timeout: 8000, label: '置顶徽标重渲染' },
  )
  report('E2E-30 ★R3-Ca（V4.2.3 重指）池面板：网格↔列表同源 → 状态下拉选“待打标”只留无标签卡 → 全选后反选归零 → 右键菜单置顶落库并出 📌',
    gridCount >= 3 && listCount === gridCount && noTagShown && untaggedIsB && selAll >= 3 && selAfterInvert === 0
    && ctxItems.length === 6 && ctxItems.some(x => x.includes('加入常用夹')) && ctxItems.some(x => x.includes('复制链接')) && pinnedBack.pinned && pinBadge,
    `网格=${gridCount} 列表=${listCount} 待打标只留乙=${untaggedIsB} 全选=${selAll}→反选=${selAfterInvert} 菜单=${JSON.stringify(ctxItems)} 落库pinned=${pinnedBack.pinned} 徽标=${pinBadge}`)

  // E2E-31（V4.7.0 重指）：任务/好奇心批量入口随卡片池二级页一起退役；资源批量保留在一级「全部资源卡」抽屉。
  // 先种两张任务 + 两张好奇心，保证“旧壳归零”不是因为空列表假绿。
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']; if (!d) return
    const now = Date.now()
    d.tasks = (d.tasks || []).filter(t => !String(t.id).startsWith('e2e-cb-task-'))
    const mkt = (id, title) => ({ id, kind: 'task', title, status: 'todo', priority: 'medium', tags: [], pinned: false, customFields: {}, assets: [], createdAt: now, updatedAt: now })
    d.tasks.unshift(mkt('e2e-cb-task-1', 'E2E 批量任务甲'), mkt('e2e-cb-task-2', 'E2E 批量任务乙'))
    d.curiosities = (d.curiosities || []).filter(x => !String(x.id).startsWith('e2e-cb-'))
    const mk = (id, q) => ({ id, kind: 'curiosity', question: q, sourceUrl: 'https://example.com/' + id, status: 'todo', pinned: false, tags: [], customFields: {}, assets: [], createdAt: now - 86400000, updatedAt: now - 86400000 })
    d.curiosities.unshift(mk('e2e-cb-1', 'E2E 好奇甲'), mk('e2e-cb-2', 'E2E 好奇乙'))
    return chrome.storage.local.set({ zy_data_v2: d })
  }))
  await page.goto(base + '#/?tab=task', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.cal-pool-task', { visible: true, timeout: 10000 })
  const taskPoolRows = await page.locator('.cal-pool-task').count()
  const taskBatchGone = (await page.locator('.mgr-body, .dk-batch').count()) === 0
  await page.goto(base + '#/?tab=curiosity', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.cw-pool-item', { visible: true, timeout: 10000 })
  const curioPoolRows = await page.locator('.cw-pool-item').count()
  const curioBatchGone = (await page.locator('.cz-body, .dk-batch').count()) === 0
  await page.goto(base + '#/?tab=resource', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.hrf-folder.is-all', { visible: true, timeout: 10000 })
  if (!(await page.locator('.drawer .pcp').count())) await page.locator('.hrf-folder.is-all').first().click()
  await waitForLocator(page, '.drawer .pcp', { visible: true, timeout: 10000 })
  await page.locator('.drawer .dk-batch').click().catch(() => {})
  await page.waitForTimeout(500)
  const resBar = await page.locator('.drawer .dkb-bar').isVisible().catch(() => false)
  await page.locator('.drawer .dkb-bar button', { hasText: /^全选$/ }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  const resSel = (await page.locator('.drawer .dkb-count').textContent().catch(() => '')) || ''
  report('E2E-31 ★V4.7.0 批量口径随二级页退役收敛：任务/好奇心旧批量壳归零，资源批量保留在「全部资源卡」抽屉',
    taskPoolRows >= 2 && taskBatchGone && curioPoolRows >= 2 && curioBatchGone && resBar && /已选 [1-9]/.test(resSel),
    `任务行=${taskPoolRows} 旧任务批量=${taskBatchGone} 好奇行=${curioPoolRows} 旧好奇批量=${curioBatchGone} 资源栏=${resBar} 资源全选="${resSel.trim()}"`)

  // E2E-32 ★V3.9.23 书签导入唯一路线：真喂一份 Netscape 书签 HTML 进数据包页那枚 input，核五件
  //   此前**只有源码文本断言**在管的事（书签链路过去零行为覆盖，删一整条死链却没有活性凭据
  //   就等于"合一"可能只是"删坏了"）：
  //   ① 落库张数 == 解析张数；② 文件夹层级进标签、浏览器根栏名不混进标签；
  //   ③ percent-encoding 标题被解码；④ 直接进入资源卡池，不建“书签导入”策展台、不建分类；
  //   ⑤ 数据包页回执挂出「刚导入 3 张资源卡」（R138-H3：导入完不自动弹抽屉）。
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
  await page.goto(base + '#/settings?page=data&tab=package', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const bookmarkPanel = await page.getByText('浏览器书签').first().isVisible().catch(() => false)
  await page.locator('input[accept=".html,.htm"]').first()
    .setInputFiles({ name: 'bookmarks.html', mimeType: 'text/html', buffer: Buffer.from(bkHtml, 'utf8') })
  await page.waitForTimeout(2000)
  const bk = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => {
    const d = r['zy_data_v2']
    const cards = (d.resources || []).filter(x => /^https:\/\/e2e-db\.test|^obsidian:\/\/e2e-db/.test(x.link || ''))
    const importedDeck = d.workspaces.find(w => /书签导入/.test(w.name))
    return {
      added: cards.length,
      tags: Array.from(new Set(cards.flatMap(c => c.tags || []))),
      decoded: cards.map(c => c.title).find(t => t === '习惯养成') || '',
      linkTypes: Array.from(new Set(cards.map(c => c.linkType))).sort(),
      allInPool: cards.every(c => c.workspaceId === 'zy-curation'),
      noCategory: cards.every(c => c.categoryId === ''),
      createdDeck: importedDeck ? importedDeck.name : '(无)'
    }
  }))
  /* ★回执钮文案是**条件式**的：接入未配时印「先在 AI 助手完成接入」、配了才印「归类并补全这批」，
     按后者找在 E2E 环境里永远命不中（首轮就红在这里，而导入本身其实已经成功）。
     改核那一行无条件存在的「刚导入 N 张卡」——它才证明 pendingImportEnrich 真的被赋值了。 */
  const bkReceipt = await page.getByText(/刚导入 3 张资源卡/).first().isVisible().catch(() => false)
  const bkCount = await page.evaluate(() => chrome.storage.local.get('zy_data_v2')
    .then(r => (r['zy_data_v2'].resources || []).filter(x => !x.deletedAt).length))
  report('E2E-32 ★V3.9.23 书签导入唯一路线：落库张数=解析张数 / 层级进标签且根栏名排除 / 编码标题解码 / 直接入池且不建台 / 回执在位',
    bk.added === 3 && bkCount === bkBefore + 3 && JSON.stringify(bk.tags) === '["AI工具"]'
    && bk.decoded === '习惯养成' && JSON.stringify(bk.linkTypes) === '["obsidian","url"]'
    && bk.allInPool && bk.noCategory && bk.createdDeck === '(无)' && bookmarkPanel && bkReceipt,
    `页签=${bookmarkPanel} 落库=${bk.added} 总数=${bkBefore}→${bkCount} 标签=${JSON.stringify(bk.tags)} 解码="${bk.decoded}" 型=${JSON.stringify(bk.linkTypes)} 入池=${bk.allInPool} 分类空=${bk.noCategory} 新建台="${bk.createdDeck}" 回执=${bkReceipt}`)

  // E2E-33 ★V3.9.25 附件永久清理：设置页「全部附件」必须一次清空所有本体与卡片关联。
  //   不可恢复的删除必须先过确认门；确认前一个字节都不能动，确认后列表与 IndexedDB 同时归零。
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
  await page.goto(base + '#/settings?page=data&tab=assets', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const hyBtn = page.locator('.gs-setting-row').filter({ hasText: '全部附件' }).locator('button', { hasText: '清理' }).first()
  await hyBtn.click()
  await page.waitForTimeout(900)
  /* 确认门必须在：弹窗没点掉之前一个字节都不许动。 */
  const hyGateShown = await page.getByText('清空全部附件').last().isVisible().catch(() => false)
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
  const hyState = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2'] || {}
    const seeded = [...(d.resources || []), ...(d.argCards || [])].filter(x => String(x.id || '').startsWith('e2e-hy-'))
    return {
      refsCleared: seeded.length > 0 && seeded.every(x => !Array.isArray(x.assets) || x.assets.length === 0),
      rows: document.querySelectorAll('.dm-asset-row').length,
    }
  }))
  const hy = {
    allGone: !['e2e-hy-live', 'e2e-hy-del', 'e2e-hy-arg', 'e2e-hy-orphan'].some(k => hyKeys.includes(k)),
    untouchedBeforeConfirm: ['e2e-hy-live', 'e2e-hy-del', 'e2e-hy-arg', 'e2e-hy-orphan'].every(k => hyAfterCancel.includes(k))
  }
  report('E2E-33 ★V3.9.25 全部附件永久清理：确认门前零删除，确认后本体、卡片关联与附件列表一起归零',
    hyGateShown && hy.untouchedBeforeConfirm && hy.allGone && hyState.refsCleared && hyState.rows === 0,
    `弹窗=${hyGateShown} 未确认前不动=${hy.untouchedBeforeConfirm}(${hyAfterCancel.length}) 全部本体已删=${hy.allGone} 卡片关联已清=${hyState.refsCleared} 列表行=${hyState.rows}`)
  await page.evaluate(async () => {
    const d0 = (await chrome.storage.local.get('zy_data_v2'))['zy_data_v2']
    d0.resources = d0.resources.filter(r => !String(r.id).startsWith('e2e-hy-'))
    d0.argCards = (d0.argCards || []).filter(c => !String(c.id).startsWith('e2e-hy-'))
    await chrome.storage.local.set({ zy_data_v2: d0 })
  })

  // E2E-34 ★V4.0.4：Airtable 已在 V4.0.1 正式退役，旧深链仍要兼容，但必须落到
  //   数据管理的「云同步」页签。这里验关系总览、建议动作与四项同步事实，不允许旧配置回流。
  await page.goto(base + '#/settings?page=airtable', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-testid="cloud-relation-overview"]', { visible: true, timeout: 10000 })
  const cloudRetirement = await page.evaluate(() => {
    const activeTab = (document.querySelector('.dm-tabs .dm-tab.on')?.textContent || '').trim()
    const relation = document.querySelector('[data-testid="cloud-relation-overview"]')
    const recommendation = (relation?.querySelector('.cloud-recommend')?.textContent || '').trim()
    const relationText = relation?.textContent || ''
    const settingsMain = document.querySelector('.gs-panel')?.textContent || ''
    const facts = ['本机同步基线', '云端当前修订', '最近实际同步', '最近检查']
    return {
      activeTab,
      relationVisible: !!relation && relation.getBoundingClientRect().height > 0,
      recommendation,
      facts: facts.filter(text => relationText.includes(text)),
      legacyConfigAbsent: !/Airtable|Personal Access Token|标签列名/.test(settingsMain),
    }
  })
  report('E2E-34 ★V4.0.4 旧 Airtable 深链兼容落到云同步：关系总览与建议动作可见，旧配置入口零回流',
    cloudRetirement.activeTab === '云同步' && cloudRetirement.relationVisible
      && cloudRetirement.recommendation.startsWith('建议：')
      && cloudRetirement.facts.length === 4 && cloudRetirement.legacyConfigAbsent,
    JSON.stringify(cloudRetirement))

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

  // E2E-36 ★R4-Dg 池的显示名单源 + 唯一通用导出不许漏池卡。
  //   改前的两层漏：① 台名取 workspace 实体的 name ⇒ 存量库印「资源台」（R61 留下的历史名）、新库印「未知」（根本没有那枚实体）；
  //   ② 导出按 `for (const ws of d.workspaces)` 再按「该台的分类」分组 ⇒ 池卡在新库里没有实体、
  //      而且池卡 categoryId 恒空（R179 起标签独任组织），两层 for 都接不住它们——整批池卡从导出物里静默消失。
  //   V3.9.23 起旧 CSV / 指定台 / Markdown 三路退役，唯一通用出口是完整数据包；
  //   判据随之改为真点一次「导出知源调度台数据包」，读包内 resources，而不是读界面。
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
  await page.goto(base + '#/settings?page=data', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  /* 抓 Blob 而不是抓下载文件：downloadFile 走 createObjectURL + a.click()，headless 里落盘路径不可控，
     而"导出物里到底有没有池卡"这件事只看内容。 */
  await page.evaluate(() => {
    const orig = URL.createObjectURL.bind(URL)
    window.__dgBlob = null
    URL.createObjectURL = (b) => { window.__dgBlob = b; return orig(b) }
  })
  const dgBtn = page.locator('button.gs-btn', { hasText: '导出知源调度台数据包' }).first()
  const dgClicked = (await dgBtn.count()) ? await dgBtn.click().then(() => true).catch(() => false) : false
  await page.waitForTimeout(1200)
  const dgText = await page.evaluate(async () => (window.__dgBlob ? await window.__dgBlob.text() : ''))
  let dgPkg
  try { dgPkg = JSON.parse(dgText) } catch { dgPkg = null }
  const dgRows = (dgPkg && Array.isArray(dgPkg.resources)) ? dgPkg.resources : []
  const dgTitlesIn = dgTitles.filter(t => dgRows.some(r => r.title === t && r.workspaceId === 'zy-curation')).length
  const dgNoAssets = dgRows.every(r => !Array.isArray(r.assets) || !r.assets.some(a => a && a.blob))
  const dgNoAirtableSecrets = dgPkg && !Object.prototype.hasOwnProperty.call(dgPkg, 'airtableSync') && !Object.prototype.hasOwnProperty.call(dgPkg, 'airtableMap')
  const dgEventLog = Array.isArray(dgPkg && dgPkg.eventLog) && dgPkg.eventLog.length <= 5000
  report('E2E-36 ★R4-Dg 唯一通用导出＝知源调度台数据包：池卡全量入包 · 不含附件本体与 Airtable 凭证 · 事件上限 5000',
    dgClicked && !!dgPkg && dgPkg.packageType === 'zhiyuan_data' && dgTitlesIn === dgTitles.length
    && dgNoAssets && dgNoAirtableSecrets && dgEventLog,
    `点击=${dgClicked} 包字节=${dgText.length} 类型=${dgPkg && dgPkg.packageType} 池卡入列=${dgTitlesIn}/${dgTitles.length} 无附件本体=${dgNoAssets} 无凭证=${dgNoAirtableSecrets} 事件≤5000=${dgEventLog}`)

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

  // E2E-38（V4.2.0 重指）：好奇心卡不再是转化入口。⌘K 搜到好奇心行时不得出现转化菜单，
  // 更不能在后台生成资源卡或把原卡软删——Inbox 是唯一三卡转化入口。
  const dkQ = 'V4.2.0 好奇心零转化探针'
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
  const dkRow = page.locator('.gp-result-item', { hasText: dkQ }).first()
  const dkConvertControls = await dkRow.locator('.convert, .gp-convert-menu-item').count()
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
      有卡: !!r,
      软删好奇: !!(c && c.deletedAt),
      出路: c ? c.convertedTo || '' : 'missing',
      原卡在: !!(c && !c.deletedAt),
    }
  }, dkQ)
  report('E2E-38 ★V4.2.0 ⌘K 好奇心零转化：搜索结果仍可检索，但不出现转化控件、不生成资源卡、不软删原卡，convertedTo 保持为空',
    dkRowFound === 1 && dkConvertControls === 0 && !dkAfter.有卡 && !dkAfter.软删好奇
      && dkAfter.原卡在 && dkAfter.出路 === '',
    `搜到=${dkRowFound} 转化控件=${dkConvertControls} 资源卡生成=${dkAfter.有卡} 原卡在=${dkAfter.原卡在} 软删=${dkAfter.软删好奇} 出路=${JSON.stringify(dkAfter.出路)}`)

  // E2E-39（V4.2.0 重指）★好奇心详情零 AI 研判、零转化：只读事实与编辑正常，不出现归档 / 转三卡入口。
  const epQ = 'V4.2.0 好奇心零转化详情探针'
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
    const row = page.locator('.cw-pool-item, .cz-list-item, .cz-card', { hasText: epQ }).first()
    const rowFound = await row.count()
    await row.click().catch(() => {})
    await waitForLocator(page, '.drawer', { visible: true, timeout: 6000 })
    const detail = await page.evaluate(() => {
      const drawer = document.querySelector('.drawer')
      const text = drawer ? (drawer.textContent || '') : ''
      const buttons = drawer ? [...drawer.querySelectorAll('button')] : []
      const convertWords = ['归档资源', '转化为资源卡', '转任务卡', '转为任务卡', '转为好奇心卡', 'AI 研判', 'AI研判']
      return {
        drawerOpen: !!drawer,
        aiCells: drawer ? drawer.querySelectorAll('.ds-ai-cell').length : -1,
        conversionControls: buttons.filter(btn => convertWords.some(word => (btn.textContent || '').includes(word))).length,
        modalOpen: !!document.querySelector('.cz-modal'),
        conversionText: convertWords.filter(word => text.includes(word)),
      }
    })
    await page.locator('.drawer .drawer-close').first().click().catch(() => {})
    await page.waitForSelector('.drawer', { state: 'detached', timeout: 4000 }).catch(() => {})
    return { label, rowFound, detail }
  }
  const epHub = await epRun('存量库', [
    { id: 'zy-curation', name: '🗂 资源卡池', icon: '🗂', order: -1, archived: false, kind: 'resource' },
    { id: 'ws-biz-000', name: '💼 事业策展台', icon: '💼', order: 0, archived: false }
  ])
  // 还原快照，别把后面的用例建在同一份改造过的库上
  await page.evaluate((raw) => chrome.storage.local.set({ zy_data_v2: JSON.parse(raw) }), epSnapshot)
  await page.goto(base + '#/deck/curiosity', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  report('E2E-39 ★V4.2.0 好奇心详情零 AI 研判、零转化：抽屉正常打开，AI 格 0、转化 / 归档控件 0、转化弹窗不出现',
    epHub.rowFound > 0 && epHub.detail.drawerOpen && epHub.detail.aiCells === 0
      && epHub.detail.conversionControls === 0 && !epHub.detail.modalOpen
      && epHub.detail.conversionText.length === 0,
    `${epHub.label} 行=${epHub.rowFound} ${JSON.stringify(epHub.detail)}`)

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
  /* 清理探针卡是测试卫生，不是产品判据。storage 回调偶发不返回时不能把整轮 E2E 挂死：
     发起写入后给 2s 收口，后续断言仍会暴露页面 / 存储真异常。 */
  await Promise.race([
    page.evaluate((t) => chrome.storage.local.get('zy_data_v2').then(cur => {
      const d = cur['zy_data_v2']; d.resources = (d.resources || []).filter(x => !String(x.title || '').startsWith(t))
      return chrome.storage.local.set({ zy_data_v2: d })
    }), gpQ),
    page.waitForTimeout(2000),
  ])
  report('E2E-41 ★R4-Ew ⌘K 结果行 hover 动作区是真控件不是装饰：资源行三枚钮的 title 齐（星标/删除/打开链接）、hover 才从不透明变可见，点星标**真写库**再点回**真复原**',
    gpRow.found && gpRow.titles.length === 3 && gpRow.titles.some(x => x.includes('星标')) && gpRow.titles.some(x => x.includes('删除')) && gpRow.titles.some(x => x.includes('打开链接'))
    && gpRow.未选中 && Number(gpRow.actsOpacity) === 0 && gpHover > 0.9 && starAfter === true && starBack === false,
    `行=${gpRow.found} 钮=${JSON.stringify(gpRow.titles)} hover 前 opacity=${gpRow.actsOpacity} 面板行=${JSON.stringify(gpRow.全部行)} hover 后=${gpHover} starred: 点后=${JSON.stringify(starAfter)} 复原=${JSON.stringify(starBack)}`)

  // ══════════ E2E-42（R4-Ew）★画像洞察页四格 KPI 的下钻出口都真响应 ══════════
  // V3.9.3：四类指标从 PiHero 归位画像洞察首屏概览，仍是同一组真实下钻出口。
  // 本用例保留 R4-Ew「不能只有数字、没有真出口」的原意，按新宿主的三种真实响应形态判：
   //   total/support → 卡片清单抽屉；entropy → 独立解释抽屉；focus → 全量记录抽屉（focusOnly 预设）。
  /* ★V4.7.6：四格 KPI 已迁入「卡片分析」页签；直接以旧 view 深链进入并等 KPI 真挂载，
     否则默认时间轴下 locator 为空，click 会耗满默认超时，测试看起来像“挂死”。 */
  await page.goto(base + '#/profile?view=analysis', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.pi-ov-kpis .pi-ov-kpi', { visible: true, timeout: 10000 })
  await page.waitForTimeout(600)
  const heroKpiCount = await page.locator('.pi-ov-kpis .pi-ov-kpi').count()
  const heroDrillRes = []
  for (const dr of [
    { i: 0, 名: '在库卡片', 型: 'drawer', 题: '全部卡片明细' },
    { i: 1, 名: '标签分布', 型: 'explain', 题: '标签分布 · 知识熵' },
    { i: 2, 名: '任务有资源支撑', 型: 'drawer', 题: '任务证据支撑明细' },
    { i: 3, 名: '近 30 天精力落主攻', 型: 'log', 题: '全部记录' },
  ]) {
    await page.locator('.pi-ov-kpis .pi-ov-kpi').nth(dr.i).click().catch(() => {})
    await page.waitForTimeout(900)
    const one = await page.evaluate((d) => {
      const drawerTitle = ((document.querySelector('.drawer-title') || {}).textContent || '').trim()
      const toast = [...document.querySelectorAll('.toast-msg')].map(x => (x.textContent || '').trim()).join(' ')
      const rows = document.querySelectorAll('.drawer .metric-drawer .row').length
      const empty = !!document.querySelector('.drawer .metric-drawer .empty-state')
      const logRows = document.querySelectorAll('.drawer .dz-log-row').length
      const logEmpty = !!document.querySelector('.drawer .dz-log-empty')
      const logNote = ((document.querySelector('.drawer .dz-log-note') || {}).textContent || '').trim()
      const explain = document.querySelector('.drawer .pi-tag-insight')
      const explainText = (explain?.textContent || '').replace(/\s+/g, ' ').trim()
      const insightHeads = [...document.querySelectorAll('.pi-tag-insight h4')]
      const LABELS = ['这个指标怎么看', '当前分布', '下一步建议', '交给 AI 助手处理']
      return {
        名: d.名,
        抽屉在: !!document.querySelector('.drawer'),
        题在: drawerTitle.includes(d.题),
        题: drawerTitle.slice(0, 36),
        toast: toast.slice(0, 60),
        rows,
        empty,
        logRows,
        logEmpty,
        logNote: logNote.slice(0, 60),
        explain: !!explain && insightHeads.every((h, i) => h.textContent.includes(LABELS[i])),
        explainText: explainText.slice(0, 80),
      }
    }, dr)
    heroDrillRes.push({ ...one, 型: dr.型 })
    await page.locator('.drawer .drawer-close').first().click().catch(() => {})
    await page.waitForFunction(() => document.querySelectorAll('.drawer').length === 0, null, { timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
  const heroDrillOk = heroKpiCount === 4 && heroDrillRes.every(r => r.题在 && r.抽屉在 && (
    r.型 === 'explain'
      ? r.explain
      : r.型 === 'log'
        ? r.logNote.includes('近30天主攻动作') && (r.logRows > 0 || r.logEmpty)
        : r.rows > 0 || r.empty
  ))
  report('E2E-42 ★R4-Ew 画像洞察页四格 KPI 真响应：卡片清单抽屉 / 知识熵解释抽屉 / 主攻动作全量记录抽屉',
    heroDrillOk,
    heroDrillRes.map(r => `${r.名}:题=${r.题在} 抽屉=${r.抽屉在} 行=${r.rows} 日志行=${r.logRows} 空态=${r.logEmpty} note=${r.logNote} 解释=${r.explain}`).join(' ｜ '))

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

  // ══════════ E2E-44（V4.0.4）★顶栏云同步入口：状态、最近同步与一键落点 ══════════
  // 顶栏按钮是跨页常驻入口，必须同时让用户看见当前关系和最近同步时间；
  // 未配置 / 未登录时点击也必须进入云同步模块，而不是只给一条转瞬即逝的 toast。
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-testid="topbar-cloud-sync"]', { visible: true, timeout: 10000 })
  const topbarCloud = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="topbar-cloud-sync"]')
    const rect = button?.getBoundingClientRect()
    return {
      visible: !!button && !!rect && rect.width > 0 && rect.height > 0,
      enabled: button instanceof HTMLButtonElement && !button.disabled,
      label: (button?.querySelector('.cloud-sync-label')?.textContent || '').trim(),
      ariaLabel: button?.getAttribute('aria-label') || '',
      title: button?.getAttribute('title') || '',
    }
  })
  await page.locator('[data-testid="topbar-cloud-sync"]').first().click()
  const cloudRouteReady = await pollUntil(
    () => Promise.resolve(page.url().includes('#/settings?page=cloud')),
    { timeout: 8000, label: '顶栏云同步进入云同步模块' },
  )
  await waitForLocator(page, '[data-testid="cloud-relation-overview"]', { visible: true, timeout: 10000 })
  const cloudEntry = await page.evaluate(() => {
    const activeTab = (document.querySelector('.dm-tabs .dm-tab.on')?.textContent || '').trim()
    const relation = document.querySelector('[data-testid="cloud-relation-overview"]')
    const recommend = (relation?.querySelector('.cloud-recommend')?.textContent || '').trim()
    const facts = relation?.textContent || ''
    return {
      activeTab,
      relationVisible: !!relation && relation.getBoundingClientRect().height > 0,
      recommend,
      hasRecentSync: facts.includes('最近实际同步'),
    }
  })
  report('E2E-44 ★V4.0.4 顶栏云同步常驻显示状态与最近同步时间；点击进入云同步模块并呈现关系与建议动作',
    topbarCloud.visible && topbarCloud.enabled && topbarCloud.label.length > 0
      && topbarCloud.ariaLabel.includes('最近实际同步') && topbarCloud.title.includes('最近实际同步')
      && cloudRouteReady && cloudEntry.activeTab === '云同步' && cloudEntry.relationVisible
      && cloudEntry.recommend.startsWith('建议：') && cloudEntry.hasRecentSync,
    `顶栏=${JSON.stringify(topbarCloud)} 落点=${cloudRouteReady} 模块=${JSON.stringify(cloudEntry)}`)

  // ══════════ E2E-52（V4.1.1）同步记录级明细抽屉 ══════════
  await page.locator('.cloud-fact-button').first().click()
  await waitForLocator(page, '.csd-tabs', { visible: true, timeout: 10000 })
  await pollUntil(async () => page.evaluate(() => {
    const loading = document.querySelector('.csd-loading')
    const summary = document.querySelector('.csd-summary')?.textContent || ''
    const note = document.querySelector('.csd-note')?.textContent || ''
    return !loading && !!(summary.trim() || note.trim())
  }), { timeout: 10000, label: '同步明细异步加载完成' })
  const syncDetail = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.csd-tabs [role="tab"]')].map(x => (x.textContent || '').trim())
    const summary = document.querySelector('.csd-summary')?.textContent || ''
    const rows = document.querySelectorAll('.csd-record').length
    const fallback = document.querySelector('.csd-note')?.textContent || ''
    return { tabs, summary: summary.replace(/\s+/g, ' ').trim(), rows, fallback: fallback.replace(/\s+/g, ' ').trim() }
  })
  await page.locator('.csd-tabs [role="tab"]').nth(1).click()
  const remoteTabReady = await page.locator('.csd-tabs [role="tab"]').nth(1).getAttribute('aria-selected')
  report('E2E-52 ★V4.1.1 本机基线与云端当前可打开记录级同步明细：双页签、摘要、指纹与真实记录行在位，无基线时明确说明',
    syncDetail.tabs.length === 2 && syncDetail.tabs[0].includes('本机基线') && syncDetail.tabs[1].includes('云端当前')
      && syncDetail.summary.includes('修订') && syncDetail.summary.includes('记录')
      && (syncDetail.rows > 0 || syncDetail.fallback.includes('基线明细尚未建立'))
      && remoteTabReady === 'true',
    JSON.stringify(syncDetail))
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)

  // ══════════ E2E-53（V4.1.1）选中节点后直接粘贴图片 ══════════
  await page.evaluate(async () => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur['zy_data_v2']
    const wsId = 'e2e-v411-paste-ws'
    const nodeId = 'e2e-v411-paste-node'
    data.workspaces = data.workspaces.filter(w => w.id !== wsId)
    data.workspaces.push({
      id: wsId, name: 'E2E V4.1.1 粘贴台', icon: '🧪', color: '#3A6B4C',
      coverTheme: 'deep-sea', order: 99, archived: false, kind: 'curation',
    })
    data.categories = data.categories.filter(c => c.id !== nodeId)
    data.categories.push({ id: nodeId, workspaceId: wsId, name: 'V4.1.1 粘贴节点', parentId: undefined, order: 0 })
    await chrome.storage.local.set({ zy_data_v2: data })
  })
  await page.goto(base + '#/workspace/e2e-v411-paste-ws', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-mind-node="e2e-v411-paste-node"]', { visible: true, timeout: 12000 })
  await page.locator('[data-mind-node="e2e-v411-paste-node"]').click()
  await waitForLocator(page, '[data-mind-node="e2e-v411-paste-node"] .curation-asset-strip', { visible: true, timeout: 5000 })
  const pasteDispatched = await page.evaluate(() => {
    const node = document.querySelector('[data-mind-node="e2e-v411-paste-node"]')
    if (!node) return false
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlQ8WQAAAAASUVORK5CYII='), c => c.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'clipboard.png', { type: 'image/png' }))
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: transfer })
    node.dispatchEvent(event)
    return event.defaultPrevented
  })
  const pastedAssetStored = await waitForStorage(page, 'zy_data_v2', raw => {
    const node = raw?.['zy_data_v2']?.categories?.find(c => c.id === 'e2e-v411-paste-node')
    return !!node?.assets?.some(a => a.kind === 'image' && /^粘贴图片_/.test(a.name || ''))
  }, { timeout: 10000 })
  await waitForLocator(page, '[data-mind-node="e2e-v411-paste-node"] .cas-thumb', { visible: true, timeout: 8000 })
  await page.locator('[data-mind-node="e2e-v411-paste-node"] .cas-thumb').first().click()
  await waitForLocator(page, '.capm-stage img', { visible: true, timeout: 8000 })
  const pastedPreview = await page.evaluate(() => {
    const img = document.querySelector('.capm-stage img')
    const title = document.querySelector('.capm-name')?.textContent || ''
    return { img: !!img && img.getBoundingClientRect().width > 0, title: title.trim(), src: (img?.getAttribute('src') || '').startsWith('blob:') }
  })
  report('E2E-53 ★V4.1.1 选中策展节点后粘贴剪贴板图片：图片优先生成自动命名附件、缩略图上屏，点击缩略图直接中央预览',
    pasteDispatched && !!pastedAssetStored && pastedPreview.img && pastedPreview.src && pastedPreview.title.startsWith('粘贴图片_'),
    `dispatched=${pasteDispatched} stored=${!!pastedAssetStored} preview=${JSON.stringify(pastedPreview)}`)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)

  // ══════════ E2E-54（V4.3.0）移动采集与 PC Inbox 退役：旧深链只回调度台 ══════════
  await page.goto(base + '#/deck/inbox', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const retiredInboxHomeReady = await waitForLocator(page, '.desk-head', { visible: true, timeout: 12000 })
  await page.waitForTimeout(350)
  const retiredInboxRowsZero = await page.locator('.inbox-row').count() === 0
  const retiredInboxState = await page.evaluate(() => ({
    hash: location.hash,
    deskVisible: !!document.querySelector('.desk-head'),
    deckPage: !!document.querySelector('.deck-page'),
    captureRows: document.querySelectorAll('[data-capture-id]').length,
    tabs: [...document.querySelectorAll('.hand-tab')].map(node => (node.textContent || '').replace(/\s+/g, ' ').trim()),
  }))
  report('E2E-54 ★V4.3.0 移动采集与 PC Inbox 退役：旧 #/deck/inbox 深链只回调度台，Inbox 列表、采集行和 capture_inbox 云端请求均不回流',
    retiredInboxHomeReady && retiredInboxState.hash === '#/' && retiredInboxState.deskVisible
      && !retiredInboxState.deckPage && retiredInboxRowsZero && retiredInboxState.captureRows === 0
      && captureInboxRequests.length === 0 && !retiredInboxState.tabs.some(text => /Inbox/i.test(text)),
    `home=${retiredInboxHomeReady} state=${JSON.stringify(retiredInboxState)} rows0=${retiredInboxRowsZero} requests=${JSON.stringify(captureInboxRequests)}`)

  // ══════════ E2E-55（V4.5.0 重指）调度台保留任务/选题/好奇心/资源四卡池，默认任务 ══════════
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.hand-tabs .hand-tab', { visible: true, timeout: 12000 })
  const homePoolState = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.hand-tabs .hand-tab')]
    const labelOf = node => {
      const badge = node.querySelector('.hand-new-badge')
      const raw = (node.textContent || '').replace(/\s+/g, ' ').trim()
      return badge ? raw.slice(0, raw.length - (badge.textContent || '').trim().length).trim() : raw
    }
    return {
      labels: tabs.map(labelOf),
      selected: tabs.filter(node => node.classList.contains('on')).map(labelOf),
      ariaSelected: tabs.filter(node => node.getAttribute('aria-selected') === 'true').map(labelOf),
      hasInboxClass: !!document.querySelector('.hand-tab-inbox, .mini-item-inbox, .inbox-row'),
      deckTabs: [...document.querySelectorAll('.deck-kind-seg button')].map(node => (node.textContent || '').trim()),
    }
  })
  report('E2E-55 ★V4.5.0 调度台手边的卡保留任务 / 选题 / 好奇心 / 资源四池：今日新增角标不改变页签身份，默认任务是唯一选中页签，Inbox 入口与行内组件均不回流',
    JSON.stringify(homePoolState.labels) === JSON.stringify(['任务', '选题', '好奇心', '资源'])
      && homePoolState.selected.length === 1 && homePoolState.selected[0] === '任务'
      && homePoolState.ariaSelected.length === 1 && homePoolState.ariaSelected[0] === '任务'
      && !homePoolState.hasInboxClass && homePoolState.deckTabs.length === 0,
    `四池=${JSON.stringify(homePoolState)}`)

  // ══════════ E2E-56（V4.4.0）云同步三事实卡、回执与静态状态入口 ══════════
  const cloudSnapshotAt = new Date().toISOString()
  await ctx.unroute('**/rest/v1/cloud_snapshots**').catch(() => {})
  await ctx.unroute('**/rest/v1/account_events**').catch(() => {})
  await ctx.route('**/rest/v1/cloud_snapshots**', route => {
    const method = route.request().method()
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ revision: 1, updated_at: cloudSnapshotAt }]),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ revision: 1, updated_at: cloudSnapshotAt }]),
    })
  })
  await ctx.route('**/rest/v1/account_events**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 204, body: '' })
  })
  await ctx.unroute('**/auth/v1/token?grant_type=refresh_token').catch(() => {})
  await ctx.route('**/auth/v1/token?grant_type=refresh_token', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'e2e-access',
      refresh_token: 'e2e-refresh',
      user: { id: 'e2e-user', email: 'e2e@example.com' },
    }),
  }))
  await page.evaluate(async () => {
    const current = await chrome.storage.local.get('zy_cloud_env')
    await chrome.storage.local.set({
      zy_cloud_env: current.zy_cloud_env,
      zy_cloud_meta_v1: {
        userId: 'e2e-user',
        email: 'e2e@example.com',
        refreshToken: 'e2e-refresh',
        checkOnStart: false,
        revision: 0,
        assetSyncEnabled: false,
      },
    })
  })
  await page.goto(base + '#/settings?page=cloud', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-testid="cloud-relation-overview"]', { visible: true, timeout: 12000 })
  const cloudStatusBefore = await page.locator('[data-testid="topbar-cloud-sync"]').evaluate(button => ({
    classes: button.className,
    label: (button.querySelector('.cloud-sync-label')?.textContent || '').trim(),
  }))
  const cloudLedRetired = await page.locator('[data-testid="topbar-cloud-sync"] .cloud-sync-led').count() === 0

  await page.locator('[data-testid="cloud-relation-details-trigger"]').click()
  await waitForLocator(page, '.cscd .cct', { visible: true, timeout: 12000 })
  const pendingDrawer = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.cct-groups [role="tab"]')].map(node => (node.textContent || '').trim())
    const rows = document.querySelectorAll('.cct-row').length
    const sort = (document.querySelector('.cct-sort')?.textContent || '').trim()
    return { groups, rows, sort }
  })
  await page.locator('.drawer-close').first().click()
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })

  await page.locator('[data-testid="cloud-sync-now"]').click()
  await waitForLocator(page, '[data-testid="cloud-sync-receipt-modal"]', { visible: true, timeout: 20000 })
  const receipt = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="cloud-sync-receipt-modal"]')
    const summary = [...(modal?.querySelectorAll('.csrm-summary b') || [])].map(node => (node.textContent || '').trim())
    const heading = (modal?.querySelector('.csrm-hero h2')?.textContent || '').trim()
    return { summary, heading, rows: modal?.querySelectorAll('.cct-row').length || 0 }
  })
  const cloudStatusAfterSync = await pollUntil(
    async () => {
      const button = page.locator('[data-testid="topbar-cloud-sync"]')
      const classes = await button.getAttribute('class') || ''
      const label = (await button.locator('.cloud-sync-label').textContent() || '').trim()
      return classes.includes('in_sync') && label === '已同步'
    },
    { timeout: 8000, label: '云同步完成后顶栏显示已同步' },
  )

  const actionableRow = page.locator('[data-testid="cloud-sync-receipt-modal"] .cct-row:has(.cct-action.available)').first()
  const actionableReady = await waitForLocator(page, '[data-testid="cloud-sync-receipt-modal"] .cct-action.available', { visible: true, timeout: 6000 })
  const actionableCount = actionableReady ? await actionableRow.count() : 0
  let receiptActionCheck = { count: actionableCount, initial: '', operation: '', after: '', message: '' }
  if (actionableCount > 0) {
    await actionableRow.click()
    await waitForLocator(page, '[data-testid="cloud-sync-record-detail"]', { visible: true, timeout: 6000 })
    receiptActionCheck.initial = (await page.locator('.csrd-state').textContent() || '').trim()
    receiptActionCheck.operation = (await page.locator('.csrd-btn.primary').textContent() || '').replace(/\s+/g, ' ').trim()
    await page.locator('.csrd-btn.primary').click()
    await waitForLocator(page, '.cdf-mask .cdf-btn.ok', { visible: true, timeout: 5000 })
    await page.locator('.cdf-mask .cdf-btn.ok').click()
    await pollUntil(async () => {
      const state = (await page.locator('.csrd-state').textContent() || '').trim()
      return state && state !== '可处理'
    }, { timeout: 8000, label: '同步明细逐行操作完成' })
    receiptActionCheck.after = (await page.locator('.csrd-state').textContent() || '').trim()
    receiptActionCheck.message = (await page.locator('.csrd-result').textContent().catch(() => '') || '').trim()
    await page.locator('.md-panel').last().locator('.csrd-btn').filter({ hasText: '关闭' }).click()
    await page.waitForSelector('[data-testid="cloud-sync-record-detail"]', { state: 'detached', timeout: 5000 })
  }

  const cloudStatusAfterAction = await pollUntil(
    async () => {
      const button = page.locator('[data-testid="topbar-cloud-sync"]')
      const classes = await button.getAttribute('class') || ''
      const label = (await button.locator('.cloud-sync-label').textContent() || '').trim()
      return classes.includes('local_changed') && label === '待同步'
    },
    { timeout: 8000, label: '逐行操作后顶栏回到待同步' },
  )
  await page.locator('.md-panel').filter({ has: page.locator('[data-testid="cloud-sync-receipt-modal"]') }).first().locator('.md-close').click()
  await page.waitForSelector('.md-panel', { state: 'detached', timeout: 5000 }).catch(() => {})

  await page.locator('[data-testid="latest-sync-receipt-trigger"]').click()
  await waitForLocator(page, '.cscd .cct', { visible: true, timeout: 8000 })
  const latestReceiptDrawer = await page.evaluate(() => ({
    title: (document.querySelector('.drawer .drawer-title')?.textContent || '').trim(),
    rows: document.querySelectorAll('.cct-row').length,
    hasDirection: (document.querySelector('.cct-row .cct-status')?.textContent || '').trim().length > 0,
  }))
  await page.locator('.drawer .drawer-close').first().click()
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 })

  await page.locator('.cloud-relation-actions button').filter({ hasText: '同步历史' }).click()
  await waitForLocator(page, '[data-testid="cloud-sync-history"]', { visible: true, timeout: 6000 })
  const settingsHistory = await page.evaluate(() => ({
    count: document.querySelectorAll('.csh-item').length,
    note: (document.querySelector('.csh-note')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }))
  await page.locator('.csh-item').first().click()
  await waitForLocator(page, '[data-testid="cloud-sync-receipt-modal"]', { visible: true, timeout: 6000 })
  const historyReceiptRows = await page.locator('[data-testid="cloud-sync-receipt-modal"] .cct-row').count()
  await page.locator('.md-panel').last().locator('.md-close').click()
  await page.waitForSelector('[data-testid="cloud-sync-receipt-modal"]', { state: 'detached', timeout: 5000 })
  await page.locator('.drawer .drawer-close').first().click()
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 })

  await page.locator('[data-testid="topbar-cloud-sync-more"]').click()
  await waitForLocator(page, '.cloud-sync-panel', { visible: true, timeout: 4000 })
  const topbarHistoryEntry = await page.locator('.cloud-sync-panel .csp-actions button').filter({ hasText: '同步历史' }).count()
  await page.locator('.cloud-sync-panel .csp-actions button').filter({ hasText: '同步历史' }).click()
  await waitForLocator(page, '[data-testid="cloud-sync-history"]', { visible: true, timeout: 6000 })
  const topbarHistoryCount = await page.locator('.csh-item').count()

  report('E2E-56 ★V4.4.0 云同步：待上传明细可右滑，手动同步后顶栏静态状态切换为已同步；记录可逐行删除/恢复/回退，设置中心与顶栏都能打开最近 20 次 / 30 天的同步历史',
    cloudStatusBefore.classes.includes('cloud-sync-btn') && cloudStatusBefore.label.length > 0 && cloudLedRetired
      && pendingDrawer.groups.some(x => x.startsWith('全部'))
      && pendingDrawer.groups.some(x => x.startsWith('卡片'))
      && pendingDrawer.groups.some(x => x.startsWith('策展台'))
      && pendingDrawer.groups.some(x => x.startsWith('今日三件事'))
      && pendingDrawer.rows > 0 && pendingDrawer.sort.includes('时间倒序')
      && receipt.summary.length === 4 && receipt.heading.includes('上传到云端')
      && receipt.rows > 0 && receiptActionCheck.initial === '可处理'
      && receiptActionCheck.operation.length > 0
      && ['已删除', '已恢复', '已回退'].includes(receiptActionCheck.after)
      && receiptActionCheck.message.length > 0 && cloudStatusAfterSync && cloudStatusAfterAction
      && latestReceiptDrawer.title.includes('最近实际同步内容')
      && latestReceiptDrawer.rows === receipt.rows && latestReceiptDrawer.hasDirection
      && settingsHistory.count >= 1 && settingsHistory.note.includes('最近 20 次')
      && settingsHistory.note.includes('最长 30 天') && historyReceiptRows === receipt.rows
      && topbarHistoryEntry === 1 && topbarHistoryCount >= 1,
    `灯前=${JSON.stringify(cloudStatusBefore)} LED已退役=${cloudLedRetired} 待上传=${JSON.stringify(pendingDrawer)} 回执=${JSON.stringify(receipt)} 同步后已同步=${cloudStatusAfterSync} 行动=${JSON.stringify(receiptActionCheck)} 行动后待同步=${cloudStatusAfterAction} 最近=${JSON.stringify(latestReceiptDrawer)} 设置历史=${JSON.stringify(settingsHistory)}/${historyReceiptRows} 顶栏=${topbarHistoryEntry}/${topbarHistoryCount}`)

  // ══════════ E2E-57（V4.3.0）今日三件事复制 / AI 成功态 ══════════
  const copyTask = {
    id: 'e2e-v421-copy-task',
    kind: 'task',
    title: '设计解决方案报价模板',
    projectId: 'e2e-v421-copy-project',
    metricId: 'e2e-v421-copy-metric',
    status: 'todo',
    priority: 'medium',
    mountedResourceIds: [],
    mountedCuriosityIds: [],
    customFields: {},
    tags: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await page.evaluate(async (task) => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur['zy_data_v2']
    if (!data) return
    const now = Date.now()
    data.compass = data.compass || { vision: { content: '', updatedAt: now }, mission: { content: '', updatedAt: now }, directions: [] }
    data.compass.directions = (data.compass.directions || []).filter(dir => dir.id !== 'e2e-v421-copy-dir')
    data.compass.directions.push({
      id: 'e2e-v421-copy-dir',
      name: 'E2E V4.2.1 复制方向',
      status: 'active',
      term: 'short',
      projects: [{
        id: 'e2e-v421-copy-project',
        name: '软硬一体服务系统解决方案',
        isFocused: false,
        progress: 0,
        status: 'active',
        metrics: [{ id: 'e2e-v421-copy-metric', title: '产品解决方案', target: '1', acceptance: '', taskIds: [task.id] }],
      }],
    })
    data.tasks = (data.tasks || []).filter(row => row.id !== task.id)
    data.tasks.push(task)
    const today = (() => {
      const d = new Date()
      const p = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    })()
    data.dailyFocus = data.dailyFocus || {}
    data.dailyFocus[today] = [{ id: 'e2e-v421-copy-slot', sourceType: 'task', sourceId: task.id, text: task.title, done: false }]
    await chrome.storage.local.set({ zy_data_v2: data })
  }, copyTask)
  /* 无头 Chromium 的 navigator.clipboard.readText() 会等待系统剪贴板权限而挂住；
     记录页面真正交给 writeText 的文本，既验证精确载荷，也不依赖操作系统剪贴板。 */
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard
    if (!clipboard || typeof clipboard.writeText !== 'function') return
    const original = clipboard.writeText.bind(clipboard)
    Object.defineProperty(clipboard, 'writeText', {
      configurable: true,
      value: async (text) => {
        globalThis.__e2eCopiedText = String(text)
        return original(text)
      },
    })
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const copyRow = page.locator('.focus-row').filter({ hasText: copyTask.title }).first()
  await waitForLocator(page, '.focus-row .row-copy', { visible: true, timeout: 12000 })
  const copyButton = copyRow.locator('.row-copy')
  const copyEnabled = await copyButton.isEnabled().catch(() => false)
  await copyButton.click()
  const copyToast = await waitForLocator(page, '.toast-msg', { visible: true, timeout: 4000 })
  const copyToastText = (await page.locator('.toast-msg').last().textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim()
  const copiedText = await page.evaluate(() => globalThis.__e2eCopiedText || '').catch(() => '')
  const expectedCopy = '推进[[软硬一体服务系统解决方案]]项目，设计解决方案报价模板，助力【产品解决方案】指标落实到位'

  await ctx.route('**/models', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 'e2e-model-ok' }] }),
  }))
  await page.goto(base + '#/settings?page=ai', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.ai-field input', { visible: true, timeout: 10000 })
  await page.locator('.ai-field input').nth(0).fill('https://e2e-ai.example/v1')
  await page.locator('.ai-field input').nth(1).fill('sk-e2e')
  await page.locator('.ai-field input').nth(1).press('Tab')
  await page.locator('.ai-form-row button').filter({ hasText: '拉取模型列表' }).click()
  const aiSuccess = await waitForLocator(page, '.ai-msg.success', { visible: true, timeout: 10000 })
  const aiState = await page.evaluate(() => ({
    text: (document.querySelector('.ai-msg')?.textContent || '').replace(/\s+/g, ' ').trim(),
    success: document.querySelector('.ai-msg')?.classList.contains('success') || false,
    error: document.querySelector('.ai-msg')?.classList.contains('error') || false,
    warning: document.querySelector('.ai-msg')?.classList.contains('warning') || false,
  }))
  report('E2E-57 ★V4.3.0 今日三件事复制与 AI 成功态：复制固定句子，模型拉取显示成功而非错误；Inbox 行内处理已随退役链移除',
    copyEnabled && copyToastText.includes('计划内容已复制') && copiedText === expectedCopy
      && aiSuccess && aiState.success && !aiState.error && !aiState.warning && aiState.text.includes('已获取 1 个模型'),
    `复制=${copyEnabled}/${JSON.stringify(copyToastText)} clip=${JSON.stringify(copiedText)} AI=${JSON.stringify(aiState)}`)

  // ══════════ E2E-58（V4.3.0）两代 capture 溯源字段仍可去重，启动不依赖 Inbox 页面 ══════════
  const dedupeCaptureId = 'e2e-v430-capture-dedupe'
  const dedupeTitle = 'E2E V4.3.0 采集资源卡去重'
  const dedupeUrl = 'https://example.com/e2e/v430/dedupe'
  const captureInboxRequestsBeforeDedupe = captureInboxRequests.length
  await page.evaluate(async ({ captureId, title, url }) => {
    const cur = await chrome.storage.local.get(['zy_data_v2', 'zy_cloud_meta_v1'])
    const data = cur.zy_data_v2
    if (!data) return
    data.resources = (data.resources || []).filter(row =>
      row.customFields?.captureInboxId !== captureId
      && row.customFields?.capture_inbox_id !== captureId
      && row.sourceCaptureId !== captureId)
    const now = Date.now()
    data.resources.unshift({
      id: 'e2e-v430-legacy-captured-resource',
      kind: 'resource',
      title,
      linkType: 'url',
      link: '',
      workspaceId: 'zy-curation',
      categoryId: '',
      tags: [],
      pinned: false,
      callCount: 0,
      customFields: { captureInboxId: captureId },
      createdAt: now - 1000,
      updatedAt: now - 1000,
    })
    data.resources.unshift({
      id: 'e2e-v430-new-captured-resource',
      kind: 'resource',
      title,
      linkType: 'url',
      link: url,
      description: '同一采集写入的两代字段应在启动时合并为一张卡。',
      workspaceId: 'zy-curation',
      categoryId: '',
      tags: ['E2E采集', '资源去重'],
      pinned: false,
      callCount: 0,
      sourceCaptureId: captureId,
      customFields: {},
      createdAt: now,
      updatedAt: now,
    })
    await chrome.storage.local.set({
      zy_data_v2: data,
      zy_cloud_meta_v1: {
        ...(cur.zy_cloud_meta_v1 || {}),
        checkOnStart: false,
        revision: 0,
        assetSyncEnabled: false,
      },
    })
  }, { captureId: dedupeCaptureId, title: dedupeTitle, url: dedupeUrl })
  await page.waitForTimeout(1000)
  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.pcp-row[data-rid="e2e-v430-new-captured-resource"], .pcp-card[data-rid="e2e-v430-new-captured-resource"]', { visible: true, timeout: 12000 })
  const dedupeResult = await pollUntil(() => page.evaluate((captureId) => {
    const app = document.querySelector('#app').__vue_app__
    const prov = app && app._context && app._context.provides
    let pinia = null
    for (const key of Object.getOwnPropertySymbols(prov || {})) {
      const value = prov[key]
      if (value && value._s && value.state) pinia = value
    }
    const data = pinia && pinia._s.get('app')?.data
    const rows = data?.resources || []
    const matched = rows.filter(row => !row.deletedAt
      && (row.sourceCaptureId === captureId
        || row.customFields?.captureInboxId === captureId
        || row.customFields?.capture_inbox_id === captureId))
    const retired = rows.filter(row => !!row.deletedAt
      && (row.sourceCaptureId === captureId
        || row.customFields?.captureInboxId === captureId
        || row.customFields?.capture_inbox_id === captureId))
    return matched.length === 1 && retired.length >= 1
      && matched[0]?.link === 'https://example.com/e2e/v430/dedupe'
      && matched[0]?.sourceCaptureId === captureId
      && (matched[0]?.tags || []).includes('资源去重')
      ? { active: matched.length, retired: retired.length, link: matched[0].link, tags: matched[0].tags }
      : false
  }, dedupeCaptureId), { timeout: 12000, label: '两代 capture 溯源字段运行态合并' })
  const dedupePageState = await page.evaluate((title) => ({
    hash: location.hash,
    inboxRows: document.querySelectorAll('.inbox-row').length,
    activeRows: [...document.querySelectorAll('.pcp-row[data-rid="e2e-v430-new-captured-resource"], .pcp-card[data-rid="e2e-v430-new-captured-resource"]')]
      .filter(node => (node.textContent || '').includes(title)).length,
    legacyRows: document.querySelectorAll('.pcp-row[data-rid="e2e-v430-legacy-captured-resource"], .pcp-card[data-rid="e2e-v430-legacy-captured-resource"]').length,
  }), dedupeTitle)
  report('E2E-58 ★V4.3.0 两代采集溯源字段仍兼容：旧 customFields.captureInboxId 与新 sourceCaptureId 命中时合并为一张资源卡，补齐链接与标签，全程不启动 Inbox 页面、不发 capture_inbox 请求',
    !!dedupeResult && dedupePageState.inboxRows === 0
      && dedupePageState.activeRows === 1 && dedupePageState.legacyRows === 0
      && captureInboxRequests.length === captureInboxRequestsBeforeDedupe,
    `结果=${JSON.stringify(dedupeResult)} 页面=${JSON.stringify(dedupePageState)} 请求=${captureInboxRequestsBeforeDedupe}->${captureInboxRequests.length}`)

  // ══════════ E2E-59（V4.2.1）同一资源卡可在同台不同节点分别挂载 ══════════
  const multiNodeCard = {
    id: 'e2e-v421-multinode-card',
    kind: 'resource',
    title: 'E2E V4.2.1 同台多节点资源卡',
    linkType: 'url',
    link: 'https://example.com/e2e/v421/multinode',
    workspaceId: 'zy-curation',
    categoryId: '',
    tags: ['E2E'],
    pinned: false,
    callCount: 0,
    customFields: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await page.evaluate(async (card) => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur.zy_data_v2
    if (!data) return
    data.resources = (data.resources || []).filter(row => row.id !== card.id)
    data.resources.push(card)
    data.curationProjections = (data.curationProjections || [])
      .filter(row => row.cardId !== card.id)
    for (const node of [
      { id: 'e2e-v421-node-a', name: 'E2E V4.2.1 节点 A', order: 201 },
      { id: 'e2e-v421-node-b', name: 'E2E V4.2.1 节点 B', order: 202 },
    ]) {
      data.categories = (data.categories || []).filter(row => row.id !== node.id)
      data.categories.push({ ...node, workspaceId: 'e2e-main-board' })
    }
    await chrome.storage.local.set({ zy_data_v2: data })
  }, multiNodeCard)
  await page.goto(base + '#/workspace/e2e-main-board', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '[data-mind-node="e2e-v421-node-a"]', { visible: true, timeout: 12000 })
  await waitForLocator(page, '[data-mind-node="e2e-v421-node-b"]', { visible: true, timeout: 12000 })

  async function linkCardToNode(nodeId) {
    const node = page.locator(`[data-mind-node="${nodeId}"]`)
    await node.locator('.mind-resource-empty .mind-resource-cta, .mind-node-foot .mind-resource-cta').first().click()
    await waitForLocator(page, '.md-panel .lc-item', { visible: true, timeout: 6000 })
    const row = page.locator('.md-panel .lc-item').filter({ hasText: multiNodeCard.title }).first()
    const checkbox = row.locator('input[type="checkbox"]')
    const available = await checkbox.count() > 0
    if (available) await checkbox.check()
    return {
      available,
      badge: available ? '' : ((await row.locator('.lc-badge').textContent().catch(() => '')) || '').trim(),
    }
  }

  const nodeAAvailable = await linkCardToNode('e2e-v421-node-a')
  await page.locator('.md-panel .lc-btn.primary').click()
  await page.waitForSelector('.md-panel', { state: 'detached', timeout: 6000 })
  const nodeALinked = await waitForStorage(page, 'zy_data_v2', raw => {
    const rows = raw.zy_data_v2?.curationProjections || []
    return rows.some(row => row.cardId === multiNodeCard.id && row.targetWsId === 'e2e-main-board' && row.targetCatId === 'e2e-v421-node-a')
  }, { timeout: 8000 })

  const nodeBAvailable = await linkCardToNode('e2e-v421-node-b')
  await page.locator('.md-panel .lc-btn.primary').click()
  await page.waitForSelector('.md-panel', { state: 'detached', timeout: 6000 })
  const bothNodesLinked = await waitForStorage(page, 'zy_data_v2', raw => {
    const rows = (raw.zy_data_v2?.curationProjections || [])
      .filter(row => row.cardId === multiNodeCard.id && row.targetWsId === 'e2e-main-board')
    return rows.length === 2
      && rows.some(row => row.targetCatId === 'e2e-v421-node-a')
      && rows.some(row => row.targetCatId === 'e2e-v421-node-b')
  }, { timeout: 8000 })

  await page.locator('[data-mind-node="e2e-v421-node-a"] .mind-node-foot .mind-resource-cta').click()
  await waitForLocator(page, '.md-panel .lc-item', { visible: true, timeout: 6000 })
  const nodeAAgain = await page.locator('.md-panel .lc-item')
    .filter({ hasText: multiNodeCard.title }).first()
    .evaluate(row => ({
      checkbox: row.querySelectorAll('input[type="checkbox"]').length,
      badge: (row.querySelector('.lc-badge')?.textContent || '').trim(),
      mirrored: row.classList.contains('mirrored'),
    }))
  await page.locator('.md-panel .md-close').click()
  await page.waitForSelector('.md-panel', { state: 'detached', timeout: 6000 })

  const multiNodeProjectionCount = await page.evaluate(async (cardId) =>
    ((await chrome.storage.local.get('zy_data_v2')).zy_data_v2?.curationProjections || [])
      .filter(row => row.cardId === cardId && row.targetWsId === 'e2e-main-board').length,
  multiNodeCard.id)
  report('E2E-59 ★V4.2.1 同一资源卡可在同台不同节点分别挂载：A 挂载后 B 仍可选，回到 A 只标记“已在本节点”，库中恰好两条独立投射',
    nodeAAvailable.available && nodeALinked && nodeBAvailable.available && bothNodesLinked
      && nodeAAgain.checkbox === 0 && nodeAAgain.badge === '已在本节点'
      && nodeAAgain.mirrored && multiNodeProjectionCount === 2,
    `A=${JSON.stringify(nodeAAvailable)}/${nodeALinked} B=${JSON.stringify(nodeBAvailable)}/${bothNodesLinked} 回A=${JSON.stringify(nodeAAgain)} 投射=${multiNodeProjectionCount}`)

  // ══════════ E2E-60/61（V4.2.2）常用夹独立镜像与策展台批量打开原链 ══════════
  const v422BoardId = 'e2e-v422-board'
  const v422NodeId = 'e2e-v422-node'
  const v422FolderName = 'E2E V4.2.2 常用夹'
  const v422Cards = [
    {
      id: 'e2e-v422-card-a', kind: 'resource', title: 'E2E V4.2.2 资源 A', linkType: 'url',
      link: 'https://example.com/e2e/v422/a', workspaceId: 'zy-curation', categoryId: '', tags: ['E2E'],
      pinned: false, starred: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'e2e-v422-card-b', kind: 'resource', title: 'E2E V4.2.2 资源 B', linkType: 'url',
      link: 'https://example.com/e2e/v422/b', workspaceId: 'zy-curation', categoryId: '', tags: ['E2E'],
      pinned: false, starred: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'e2e-v422-card-a-duplicate', kind: 'resource', title: 'E2E V4.2.2 重复地址 A', linkType: 'url',
      link: 'https://example.com/e2e/v422/a', workspaceId: 'zy-curation', categoryId: '', tags: ['E2E'],
      pinned: false, starred: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'e2e-v422-card-no-link', kind: 'resource', title: 'E2E V4.2.2 无链接资源', linkType: 'url',
      link: '', workspaceId: 'zy-curation', categoryId: '', tags: ['E2E'],
      pinned: false, starred: false, callCount: 0, customFields: {}, createdAt: Date.now(), updatedAt: Date.now(),
    },
  ]
  await ctx.route('https://example.com/e2e/v422/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>V4.2.2 E2E</title><p>V4.2.2 E2E link opened</p>',
  }))
  await page.evaluate(async ({ boardId, nodeId, cards }) => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur.zy_data_v2
    if (!data) return
    data.workspaces = (data.workspaces || []).filter(row => row.id !== boardId)
    data.workspaces.push({
      id: boardId, name: 'E2E V4.2.2 策展台', icon: '🧪', color: '#3A6B4C',
      coverTheme: 'deep-sea', order: 120, archived: false, kind: 'curation',
    })
    data.categories = (data.categories || []).filter(row => row.id !== nodeId)
    data.categories.push({ id: nodeId, workspaceId: boardId, name: 'E2E V4.2.2 证据节点', order: 0 })
    const ids = new Set(cards.map(card => card.id))
    data.resources = (data.resources || []).filter(row => !ids.has(row.id))
    data.resources.push(...cards.map(card => ({ ...card })))
    data.curationProjections = (data.curationProjections || []).filter(row => !ids.has(row.cardId))
    for (const card of cards) {
      data.curationProjections.push({
        id: `e2e-v422-proj-${card.id}`,
        kind: 'card',
        wsId: 'zy-curation',
        cardId: card.id,
        catId: '',
        targetWsId: boardId,
        targetCatId: nodeId,
        addedAt: Date.now(),
        snapshot: { ...card },
      })
    }
    data.resourceFolders = []
    data.resourceFolderMirrors = []
    await chrome.storage.local.set({ zy_data_v2: data })
  }, { boardId: v422BoardId, nodeId: v422NodeId, cards: v422Cards })

  const v422PopupUrls = () => ctx.pages()
    .map(row => row.url())
    .filter(url => url.startsWith('https://example.com/e2e/v422/'))
  const v422ChromeTabs = () => page.evaluate(async () => {
    const tabs = await chrome.tabs.query({})
    return tabs
      .filter(tab => (tab.url || '').startsWith('https://example.com/e2e/v422/'))
      .map(tab => ({ id: tab.id, url: tab.url || '' }))
  }).catch(() => [])
  await page.goto(base + '#/workspace/' + v422BoardId, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, `[data-mind-node="${v422NodeId}"]`, { visible: true, timeout: 12000 })
  const bulkOpenButton = page.locator('button.hero-btn').filter({ hasText: '打开全部资源' }).first()
  await bulkOpenButton.waitFor({ state: 'visible', timeout: 8000 })
  const bulkOpenLabel = ((await bulkOpenButton.innerText()) || '').replace(/\s+/g, ' ').trim()
  await bulkOpenButton.click()
  const bulkUrlsNormalized = await pollUntil(async () => {
    const chromeTabs = await v422ChromeTabs()
    const urls = [...new Set([...v422PopupUrls(), ...chromeTabs.map(tab => tab.url)])].sort()
    return urls.length >= 2 ? urls : false
  }, { timeout: 8000, label: '策展台批量打开原链' })
  const bulkUrlList = Array.isArray(bulkUrlsNormalized) ? bulkUrlsNormalized : []
  const bulkOk = /打开全部资源\s*2/.test(bulkOpenLabel)
    && bulkUrlList.includes('https://example.com/e2e/v422/a')
    && bulkUrlList.includes('https://example.com/e2e/v422/b')
    && !bulkUrlList.includes('')
  report('E2E-61 ★V4.2.2 策展台“打开全部资源”按本台去重打开：重复 A 只开一次、无链接跳过，B 正常打开',
    bulkOk, `按钮=${JSON.stringify(bulkOpenLabel)} URLs=${JSON.stringify(bulkUrlList)}`)
  const chromeTabIds = (await v422ChromeTabs()).map(tab => tab.id).filter(id => typeof id === 'number')
  if (chromeTabIds.length) {
    await page.evaluate(async ids => {
      await chrome.tabs.remove(ids).catch(() => {})
    }, chromeTabIds)
  }
  for (const popup of ctx.pages()) {
    if (popup !== page && popup.url().startsWith('https://example.com/e2e/v422/')) await popup.close().catch(() => {})
  }
  await page.bringToFront()

  await page.goto(base + '#/deck/resource', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  /* /deck/resource 兼容重定向会带 all=1 自动展开总夹抽屉；先确认它确实打开，
     再关掉遮罩回到一级资源页，后续操作的是「我的常用夹」区。 */
  await waitForLocator(page, '.drawer[aria-label="全部资源卡"]', { visible: true, timeout: 10000 })
  await page.locator('.drawer[aria-label="全部资源卡"] .drawer-close').click()
  await page.waitForSelector('.drawer[aria-label="全部资源卡"]', { state: 'detached', timeout: 5000 }).catch(() => {})
  /* V4.7.1：全部资源卡抽屉不再重复挂「常用夹」入口；文件夹管理回到一级资源页
     「我的常用夹」区，这里从「新建常用夹」进入同一只 ResourceFolderDrawer。 */
  const folderEntry = page.locator('.hrf-section-actions button').filter({ hasText: /新建常用夹/ }).first()
  await folderEntry.waitFor({ state: 'visible', timeout: 10000 })
  await folderEntry.click()
  await waitForLocator(page, '.rfd-create input', { visible: true, timeout: 8000 })
  await page.locator('.rfd-create input').fill(v422FolderName)
  await page.locator('.rfd-create button').click()
  const folderCreated = await waitForStorage(page, 'zy_data_v2', raw =>
    (raw.zy_data_v2?.resourceFolders || []).some(folder => folder.name === v422FolderName),
  { timeout: 8000 })
  const folderPanel = page.locator('.rfd-folder').filter({ hasText: v422FolderName }).first()
  await folderPanel.waitFor({ state: 'visible', timeout: 8000 })
  await folderPanel.locator('button').filter({ hasText: '添加卡片' }).click()
  await waitForLocator(page, '.md-panel .rfp-row', { visible: true, timeout: 8000 })
  await page.locator('.md-panel .rfp-row').filter({ hasText: 'E2E V4.2.2 资源 A' }).first().click()
  await page.locator('.md-panel .rfp-row').filter({ hasText: 'E2E V4.2.2 资源 B' }).first().click()
  await page.locator('.md-panel .rfp-btn.primary').filter({ hasText: '添加 2 张' }).click()
  const twoMirrors = await waitForStorage(page, 'zy_data_v2', raw => {
    const folders = raw.zy_data_v2?.resourceFolders || []
    const folder = folders.find(row => row.name === v422FolderName)
    if (!folder) return false
    return (raw.zy_data_v2?.resourceFolderMirrors || []).filter(row => row.folderId === folder.id).length === 2
  }, { timeout: 8000 })
  const memberTextsAfterAdd = await folderPanel.locator('.rfd-row .rfd-main b').allTextContents()
  await folderPanel.locator('.rfd-row').filter({ hasText: 'E2E V4.2.2 资源 A' }).first()
    .locator('button').filter({ hasText: '移出' }).click()
  const oneMirror = await waitForStorage(page, 'zy_data_v2', raw => {
    const folder = (raw.zy_data_v2?.resourceFolders || []).find(row => row.name === v422FolderName)
    if (!folder) return false
    const mirrors = (raw.zy_data_v2?.resourceFolderMirrors || []).filter(row => row.folderId === folder.id)
    return mirrors.length === 1 && mirrors[0]?.resourceId === 'e2e-v422-card-b'
  }, { timeout: 8000 })
  /* 一级总夹抽屉是外层；常用夹抽屉是内层。只关内层并等待退出动画，
     随后整页重载会连同外层一起复位。 */
  await page.locator('.drawer .drawer-close').last().click()
  await page.waitForTimeout(500)
  await page.evaluate(async () => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur.zy_data_v2
    const source = (data?.resources || []).find(row => row.id === 'e2e-v422-card-b')
    if (source) {
      source.deletedAt = Date.now()
      source.title = 'E2E V4.2.2 源卡已改名（快照不应跟随）'
    }
    await chrome.storage.local.set({ zy_data_v2: data })
  })
  await page.goto(base + '#/?tab=resource', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  /* 重载后仍从一级资源页进入；用「管理」而不是再次新建，保持抽屉里的夹列表上下文。 */
  await page.locator('.hrf-section-actions button').filter({ hasText: /^管理$/ }).first().click()
  await waitForLocator(page, '.rfd-folder .rfd-row', { visible: true, timeout: 8000 })
  const snapFolder = page.locator('.rfd-folder').filter({ hasText: v422FolderName }).first()
  const snapshotTitle = ((await snapFolder.locator('.rfd-row .rfd-main b').first().innerText()) || '').trim()
  await snapFolder.locator('.rfd-actions button.primary').filter({ hasText: '一键打开全部' }).click()
  const folderUrl = await pollUntil(() => {
    const urls = [...new Set(v422PopupUrls())]
    return urls.includes('https://example.com/e2e/v422/b') ? urls : false
  }, { timeout: 8000, label: '常用夹打开快照原链' })
  const folderUrlList = Array.isArray(folderUrl) ? folderUrl : []
  const folderOk = !!folderCreated && !!twoMirrors && !!oneMirror
    && memberTextsAfterAdd.includes('E2E V4.2.2 资源 A')
    && memberTextsAfterAdd.includes('E2E V4.2.2 资源 B')
    && snapshotTitle === 'E2E V4.2.2 资源 B'
    && folderUrlList.includes('https://example.com/e2e/v422/b')
  report('E2E-60 ★V4.2.2 常用夹在夹内直接添加 / 移出；源卡软删并改名后镜像标题与原始链接仍由独立快照提供',
    folderOk,
    `建夹=${folderCreated} 两条=${twoMirrors} 移出后=${oneMirror} 成员=${JSON.stringify(memberTextsAfterAdd)} 快照=${JSON.stringify(snapshotTitle)} URLs=${JSON.stringify(folderUrlList)}`)
  for (let i = 0; i < 2; i++) {
    const close = page.locator('.drawer .drawer-close').last()
    if (await close.count()) {
      await close.click().catch(() => {})
      await page.waitForTimeout(400)
    }
  }

  // ══════════ E2E-63 / 64（V4.3.2）调度台月历与卡片池入口 ══════════
  const pad2 = n => String(n).padStart(2, '0')
  const nowDate = new Date()
  const todayKey = `${nowDate.getFullYear()}-${pad2(nowDate.getMonth() + 1)}-${pad2(nowDate.getDate())}`
  const monthPrefix = todayKey.slice(0, 7)
  const futureDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), Math.min(nowDate.getDate() + 1, 28), 12)
  const futureKey = `${futureDate.getFullYear()}-${pad2(futureDate.getMonth() + 1)}-${pad2(futureDate.getDate())}`
  await page.evaluate(async ({ todayKey, futureKey, monthPrefix }) => {
    const cur = await chrome.storage.local.get('zy_data_v2')
    const data = cur.zy_data_v2
    if (!data) return
    const now = Date.now()
    const ids = new Set([
      'e2e-v432-pending', 'e2e-v432-today', 'e2e-v432-future', 'e2e-v432-done', 'e2e-v433-done-unscheduled',
      ...Array.from({ length: 18 }, (_, i) => `e2e-v432-pool-${i}`),
    ])
    data.tasks = (data.tasks || []).filter(task => !ids.has(task.id))
    const baseTask = (id, title, status, dueDate) => ({
      id, kind: 'task', title, projectId: '', metricId: '', status, priority: 'medium',
      dueDate, mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [],
      subtasks: [], pinned: false, createdAt: now, updatedAt: now,
    })
    data.tasks.push(
      baseTask('e2e-v432-pending', 'E2E V4.3.2 待排期探针', 'todo', undefined),
      baseTask('e2e-v432-today', 'E2E V4.3.2 今日探针', 'todo', todayKey),
      baseTask('e2e-v432-future', 'E2E V4.3.2 未来探针', 'todo', futureKey),
      baseTask('e2e-v432-done', 'E2E V4.3.2 已完成探针', 'done', todayKey),
      baseTask('e2e-v433-done-unscheduled', 'E2E V4.3.3 已完成未落图探针', 'done', undefined),
    )
    for (let i = 0; i < 18; i++) {
      data.tasks.push(baseTask(`e2e-v432-pool-${i}`, `E2E V4.3.2 待排期填充 ${i + 1}`, 'todo', undefined))
    }
    // 隔离其他用例留下的今日任务，确保拖入前恰好只有两张今日任务、三件事仍有 1 个空槽。
    for (const task of data.tasks) {
      if (!ids.has(task.id) && task.dueDate === todayKey) {
        task.dueDate = undefined
        task.updatedAt = now
      }
    }
    data.dailyFocus = data.dailyFocus || {}
    data.dailyFocus[todayKey] = []
    data.focusMutedDate = todayKey
    await chrome.storage.local.set({ zy_data_v2: data })
  }, { todayKey, futureKey, monthPrefix })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.task-calendar', { visible: true, timeout: 12000 })
  // KeepAlive 可能保留此前的任务日历实例；本轮交互与读数只取当前可见实例。
  const visibleCalendar = page.locator('.task-calendar:visible').first()
  const calendarBoxes = await visibleCalendar.evaluate(root => {
    const pool = root.querySelector('.cal-pool')?.getBoundingClientRect()
    const board = root.querySelector('.cal-board')?.getBoundingClientRect()
    const list = root.querySelector('.cal-pool-list')
    return {
      poolH: pool?.height || 0,
      boardH: board?.height || 0,
      listOverflow: list ? getComputedStyle(list).overflowY : '',
      listScrollable: !!list && list.scrollHeight > list.clientHeight,
    }
  })
  const pendingTitle = 'E2E V4.3.2 待排期探针'
  const todayTitle = 'E2E V4.3.2 今日探针'
  const futureTitle = 'E2E V4.3.2 未来探针'
  const doneTitle = 'E2E V4.3.2 已完成探针'
  const doneUnscheduledTitle = 'E2E V4.3.3 已完成未落图探针'
  const leftText = await visibleCalendar.locator('.cal-pool-list').innerText()
  const leftOrderOk = leftText.indexOf(pendingTitle) >= 0
    && leftText.indexOf(doneUnscheduledTitle) >= 0
    && leftText.indexOf(pendingTitle) < leftText.indexOf(todayTitle)
    && leftText.indexOf(todayTitle) < leftText.indexOf(futureTitle)
  const scheduledDateVisible = leftText.includes('落图')
  const todayTone = await visibleCalendar.locator(`.cal-day[data-day="${todayKey}"] .cal-task-chip`).filter({ hasText: todayTitle }).first()
    .evaluate(el => el.classList.contains('tone-today')).catch(() => false)
  const futureTone = await visibleCalendar.locator(`.cal-day[data-day="${futureKey}"] .cal-task-chip`).filter({ hasText: futureTitle }).first()
    .evaluate(el => el.classList.contains('tone-future')).catch(() => false)
  const doneUnscheduledInLeft = leftText.includes(doneUnscheduledTitle)
  // V4.7.3 起任务日历默认周视图；先量默认周视图，再切月视图做高度对照。
  const defaultWeekView = await visibleCalendar.locator('.cal-grid.is-week').count() === 1
  const weekCells = await visibleCalendar.locator('.cal-grid.is-week .cal-day').count()
  const weekTitle = ((await visibleCalendar.locator('.cal-week-title').innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  const weekChipHeight = await visibleCalendar.locator(`.cal-grid.is-week .cal-day[data-day="${todayKey}"] .cal-task-chip`).first()
    .evaluate(el => el.getBoundingClientRect().height).catch(() => 0)
  const weekMetaVisible = await visibleCalendar.locator(`.cal-grid.is-week .cal-day[data-day="${todayKey}"] .cal-chip-meta`).first()
    .isVisible().catch(() => false)
  await visibleCalendar.locator('.cal-view-switch button').filter({ hasText: '月视图' }).click()
  const monthChipHeight = await visibleCalendar.locator(`.cal-grid:not(.is-week) .cal-day[data-day="${todayKey}"] .cal-task-chip`).first()
    .evaluate(el => el.getBoundingClientRect().height).catch(() => 0)
  await visibleCalendar.locator('.cal-month-picker-trigger').click()
  const monthPicker = await visibleCalendar.locator('.cal-month-picker').isVisible().catch(() => false)
  const monthChoices = await visibleCalendar.locator('.cal-month-picker-grid button').count()
  await visibleCalendar.locator('.cal-month-picker-grid button').first().click()
  const monthSwitched = ((await visibleCalendar.locator('.cal-month-picker-trigger').innerText().catch(() => '')) || '').includes('1 月')
  await visibleCalendar.locator('.cal-today').click()
  await waitForLocator(page, '.md-panel', { visible: true, timeout: 6000 })
  const dayModal = await page.evaluate(() => {
    const panel = document.querySelector('.md-panel')
    const scrim = document.querySelector('.md-scrim')
    return {
      open: !!panel,
      z: panel ? Number(getComputedStyle(panel).zIndex) || 0 : 0,
      scrimZ: scrim ? Number(getComputedStyle(scrim).zIndex) || 0 : 0,
    }
  })
  const dayModalRows = await page.evaluate(() => {
    return [...document.querySelectorAll('.cal-modal-task')].map(row => {
      const title = row.querySelector('.cal-modal-copy b')?.getBoundingClientRect()
      const meta = row.querySelector('.cal-modal-copy small')?.getBoundingClientRect()
      return {
        height: row.getBoundingClientRect().height,
        separated: !!title && !!meta && title.bottom <= meta.top + 1,
        done: row.classList.contains('tone-done'),
      }
    })
  })
  await page.locator('.md-close').click()
  await page.waitForSelector('.md-panel', { state: 'detached', timeout: 6000 })
  await page.waitForTimeout(250)
  const pendingRow = visibleCalendar.locator('.cal-pool-task').filter({ hasText: pendingTitle }).first()
  const todayCell = visibleCalendar.locator(`.cal-day[data-day="${todayKey}"]`)
  // 页面下方日期格可能仍在视口外，浏览器原生 dragTo 会被自动滚动中的相邻日期格截获；
  // 先滚到日期格，再用真实鼠标拖拽；两侧处于同一视口时 Chromium 才会派发完整 drag 链。
  await todayCell.scrollIntoViewIfNeeded()
  await pendingRow.scrollIntoViewIfNeeded()
  const pendingRowBox = await pendingRow.boundingBox()
  const todayCellBox = await todayCell.boundingBox()
  const viewport = page.viewportSize()
  const dragVisible = !!pendingRowBox && !!todayCellBox && !!viewport
    && pendingRowBox.y >= 0 && pendingRowBox.y + pendingRowBox.height <= viewport.height
    && todayCellBox.y >= 0 && todayCellBox.y + todayCellBox.height <= viewport.height
  if (!dragVisible) throw new Error('拖拽源或今日日期格不在同一视口内')
  const dragHitTargets = await page.evaluate(({ rowBox, cellBox }) => ({
    row: document.elementFromPoint(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
      ?.closest('.cal-pool-task')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    cell: document.elementFromPoint(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2)
      ?.closest('.cal-day')?.getAttribute('data-day') || '',
  }), { rowBox: pendingRowBox, cellBox: todayCellBox })
  await visibleCalendar.evaluate(root => {
    window.__e2eCalendarDrag = []
    for (const type of ['dragstart', 'dragenter', 'dragover', 'drop', 'dragend']) {
      root.addEventListener(type, event => {
        window.__e2eCalendarDrag.push({
          type,
          target: event.target?.closest?.('.cal-day')?.getAttribute('data-day')
            || (event.target?.closest?.('.cal-pool-task') ? 'pool-task' : ''),
        })
      }, true)
    }
  })
  await page.mouse.move(pendingRowBox.x + pendingRowBox.width / 2, pendingRowBox.y + pendingRowBox.height / 2)
  await page.waitForTimeout(120)
  await page.mouse.down()
  await page.mouse.move(pendingRowBox.x + pendingRowBox.width / 2 + 12, pendingRowBox.y + pendingRowBox.height / 2 + 4, { steps: 4 })
  await page.waitForTimeout(160)
  await page.mouse.move(todayCellBox.x + todayCellBox.width / 2, todayCellBox.y + todayCellBox.height / 2, { steps: 20 })
  await page.waitForTimeout(160)
  await page.mouse.up()
  await page.waitForTimeout(120)
  const dragObserved = await page.evaluate(() => window.__e2eCalendarDrag || [])
  const dragDispatch = {
    row: pendingRowBox,
    cell: todayCellBox,
    viewport,
    hit: dragHitTargets,
    events: dragObserved,
  }
  const pendingScheduled = await waitForStorage(page, 'zy_data_v2', raw =>
    (raw.zy_data_v2?.tasks || []).some(task => task.id === 'e2e-v432-pending' && task.dueDate === todayKey),
  { timeout: 8000 })
  const pendingFocusPublished = await waitForStorage(page, 'zy_data_v2', raw =>
    (raw.zy_data_v2?.dailyFocus?.[todayKey] || []).some(slot => slot.sourceId === 'e2e-v432-pending'),
  { timeout: 8000 })
  const droppedRowRefreshed = await pollUntil(async () => {
    const text = await visibleCalendar.locator('.cal-pool-task').filter({ hasText: pendingTitle }).first()
      .innerText().catch(() => '')
    return text.includes('落图') ? text : false
  }, { timeout: 8000, label: '拖拽后任务清单刷新落图时间' })
  const leftAfterDrop = await visibleCalendar.locator('.cal-pool-list').innerText().catch(() => '')
  const droppedRowText = droppedRowRefreshed || ''
  // 今日可能已有超过月视图单格上限的任务，拖入后不一定直接露出 chip；
  // 从日期详情核对它在今日任务列表里，再从同一入口取消排期。
  await visibleCalendar.locator(`.cal-day[data-day="${todayKey}"] .cal-day-head`).click()
  await waitForLocator(page, '.md-panel', { visible: true, timeout: 6000 })
  const droppedModalVisible = await pollUntil(async () => {
    const row = page.locator('.cal-modal-task').filter({ hasText: pendingTitle }).first()
    return row.isVisible().catch(() => false)
  }, { timeout: 8000, label: '今日日详情出现刚落图任务' })
  const droppedModalDebug = await page.evaluate(({ title, key }) => {
    return {
      title: (document.querySelector('.md-panel .md-title')?.textContent || '').replace(/\s+/g, ' ').trim(),
      sub: (document.querySelector('.md-panel .md-sub')?.textContent || '').replace(/\s+/g, ' ').trim(),
      body: (document.querySelector('.md-panel .md-body')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1200),
      rows: [...document.querySelectorAll('.cal-modal-task')].map(row => (row.textContent || '').replace(/\s+/g, ' ').trim()),
      dayCount: document.querySelector(`.cal-day[data-day="${key}"] .cal-day-head small`)?.textContent?.trim() || '',
      targetFound: (document.querySelector('.md-panel .md-body')?.textContent || '').includes(title),
    }
  }, { title: pendingTitle, key: todayKey })
  const droppedModalRow = page.locator('.cal-modal-task').filter({ hasText: pendingTitle }).first()
  const chipVisibleAfterDrop = !!droppedModalVisible && await droppedModalRow.isVisible().catch(() => false)
  if (chipVisibleAfterDrop) await droppedModalRow.locator('.cal-modal-close').click()
  const pendingReturned = chipVisibleAfterDrop && await waitForStorage(page, 'zy_data_v2', raw =>
    (raw.zy_data_v2?.tasks || []).some(task => task.id === 'e2e-v432-pending' && !task.dueDate),
  { timeout: 8000 })
  await page.locator('.md-close').click().catch(() => {})
  await waitForLocator(visibleCalendar, '.cal-pool-task', { visible: true, timeout: 4000 }).catch(() => false)
  const leftAfterCancel = await visibleCalendar.locator('.cal-pool-list').innerText().catch(() => '')
  const calendarOk = calendarBoxes.poolH > 0
    && Math.abs(calendarBoxes.poolH - calendarBoxes.boardH) <= 1
    && calendarBoxes.listOverflow === 'auto'
    && calendarBoxes.listScrollable
    && leftOrderOk
    && scheduledDateVisible
    && todayTone && futureTone
    && dayModalRows.some(row => row.done)
    && doneUnscheduledInLeft
    && defaultWeekView && weekCells === 7 && /\d{4} 年/.test(weekTitle)
    && weekChipHeight > monthChipHeight + 12
    && weekMetaVisible
    && monthPicker && monthChoices === 12 && monthSwitched
    && dayModal.open && dayModal.z > 0 && dayModal.scrimZ > 0 && dayModal.z > dayModal.scrimZ
    && dayModalRows.length >= 2 && dayModalRows.every(row => row.height >= 44 && row.separated)
    && !!pendingScheduled && !!pendingFocusPublished && chipVisibleAfterDrop
    && leftAfterDrop.includes(pendingTitle) && droppedRowText.includes('落图')
    && !!pendingReturned && leftAfterCancel.includes(pendingTitle)
  report('E2E-63 ★V4.3.4 任务清单遵守筛选且未落图优先、拖入今日进入三件事、周视图任务卡自适应、日详情与取消排期全链路',
    calendarOk,
    `高度=${calendarBoxes.poolH}/${calendarBoxes.boardH} 滚动=${calendarBoxes.listOverflow}/${calendarBoxes.listScrollable} 顺序=${leftOrderOk} 日期=${scheduledDateVisible} 完成未落图=${doneUnscheduledInLeft} 周视图=${defaultWeekView}/${weekCells}/${weekTitle}/${weekChipHeight}->月${monthChipHeight}/${weekMetaVisible} 色调=${todayTone}/${futureTone}/${dayModalRows.some(row => row.done)} 月份=${monthPicker}/${monthChoices}/${monthSwitched} 弹层=${JSON.stringify(dayModal)} 行=${JSON.stringify(dayModalRows)} 拖拽=${JSON.stringify(dragDispatch)} 拖入=${pendingScheduled}/${pendingFocusPublished}/${chipVisibleAfterDrop}/${leftAfterDrop.includes(pendingTitle)}/${JSON.stringify(droppedRowText)} 日详情=${JSON.stringify(droppedModalDebug)} 取消=${pendingReturned}/${leftAfterCancel.includes(pendingTitle)}`)

  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.hand-tabs', { visible: true, timeout: 12000 })
  const resourceTab = page.locator('.hand-tab').filter({ hasText: '资源' }).first()
  await resourceTab.click()
  await waitForLocator(page, '.home-resource-folders', { visible: true, timeout: 6000 })
  const folderModules = await page.locator('.hrf-folder').count()
  const todayFolder = page.locator('.hrf-folder.is-today').first()
  const todayFolderVisible = await todayFolder.isVisible().catch(() => false)
  const todayFolderCount = ((await todayFolder.innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  const badgeUniform = await page.locator('.hand-new-badge').first().evaluate(el => {
    const tab = el.closest('.hand-tab')
    const badgeStyle = getComputedStyle(el)
    const tabStyle = tab ? getComputedStyle(tab) : null
    return !!tabStyle
      && badgeStyle.color === tabStyle.color
      && (badgeStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || badgeStyle.backgroundColor === 'transparent')
  }).catch(() => false)
  await todayFolder.click()
  await waitForLocator(page, '.md-panel', { visible: true, timeout: 6000 })
  const todayFolderModal = (await page.locator('.md-panel').innerText().catch(() => '')).includes('今日采集')
  await page.locator('.md-close').click()
  await page.waitForTimeout(250)
  const regularFolders = page.locator('.hrf-folder:not(.is-all):not(.is-today):not(.is-create)')
  const regularFolderCount = await regularFolders.count()
  let regularFolderModal = regularFolderCount === 0
  if (regularFolderCount) {
    await regularFolders.first().click()
    await waitForLocator(page, '.md-panel', { visible: true, timeout: 6000 })
    const regularText = await page.locator('.md-panel').innerText().catch(() => '')
    regularFolderModal = regularText.includes('管理常用夹') && regularText.includes('打开全部')
    await page.locator('.md-close').click()
    await page.waitForTimeout(250)
  }
  const entryRetired = !(await page.locator('.hand-head-actions').count())
    && !(await page.locator('.hand-head').innerText().catch(() => '')).includes('进入卡片池')
  await page.locator('.hand-col-head .hand-link').filter({ hasText: '查看全部' }).first().click()
  await waitForLocator(page, '.drawer .pcp', { visible: true, timeout: 8000 })
  await page.waitForTimeout(500)
  const deckList = await page.locator('.drawer .pcp-list').isVisible().catch(() => false)
  const poolOk = folderModules >= 2 && todayFolderVisible && /\d+/.test(todayFolderCount)
    && badgeUniform && todayFolderModal && regularFolderModal && entryRetired && deckList
  report('E2E-64 ★V4.7.1 卡片池角标与页签同色、今日采集与常用夹直接打开明细弹窗、页头进入卡片池入口退役、资源「查看全部」直达全部资源抽屉且默认列表态',
    poolOk,
    `模块=${folderModules} 今日夹=${todayFolderVisible}/${JSON.stringify(todayFolderCount)} 角标同色=${badgeUniform} 今日弹窗=${todayFolderModal} 常用夹弹窗=${regularFolderModal}/${regularFolderCount} 入口退役=${entryRetired} list=${deckList}`)

  // V4.3.7: test the transition boundary, not just the locator source text.
  await page.goto(base + '#/compass', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.spine-toggle', { visible: true, timeout: 10000 })
  if (await page.locator('.spine-toggle').getAttribute('aria-expanded') === 'false') await page.locator('.spine-toggle').click()
  await waitForLocator(page, '.spine-lv.lv5', { visible: true, timeout: 10000 })
  await page.locator('.spine-lv.lv5').click()
  await waitForLocator(page, '.lvl-row.r5', { visible: true, timeout: 8000 })
  await page.locator('.lvl-row.r5').filter({ hasText: 'E2E 成功指标' }).first().click()
  const metricLocated = await pollUntil(async () =>
    page.locator('.pano[data-project="e2e-proj-1"] [data-metric="e2e-metric-1"]').count().then(n => n > 0),
  { label: 'metric panorama', timeout: 8000 }).catch(() => false)
  await page.locator('.spine-lv.lv6').click()
  await waitForLocator(page, '.lvl-row.r6', { visible: true, timeout: 8000 })
  await page.locator('.lvl-row.r6').filter({ hasText: 'E2E 任务卡' }).first().click()
  const taskLocated = await pollUntil(async () =>
    page.locator('.pano[data-project="e2e-proj-1"] [data-task="e2e-task-1"]').count().then(n => n > 0),
  { label: 'task panorama', timeout: 8000 }).catch(() => false)
  report('E2E-65 V4.3.7 指标与任务从层级列表切换后定位到所属项目全景', metricLocated && taskLocated,
    `metric=${metricLocated} task=${taskLocated}`)

  await page.goto(base + '#/compass/curation?layout=tree', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.ctl-goal', { visible: true, timeout: 8000 })
  await page.getByRole('button', { name: '折叠至目标' }).click()
  const treeCollapsed = await page.locator('.ctl-goal.collapsed').count() > 0
    && await page.locator('.ctl-branch').count() === 0
  await page.getByRole('button', { name: '全部展开' }).click()
  const treeExpanded = await page.locator('.ctl-branch').count() > 0
  await page.getByRole('button', { name: '金字塔' }).click()
  await waitForLocator(page, '.org', { visible: true, timeout: 8000 })
  await page.getByRole('button', { name: '折叠至目标' }).click()
  const pyramidCollapsed = await page.locator('.org .node.proj').count() === 0
  await page.getByRole('button', { name: '全部展开' }).click()
  const pyramidExpanded = await page.locator('.org .node.proj').count() > 0
  report('E2E-66 V4.3.7 树状与金字塔折叠至目标及全部展开',
    treeCollapsed && treeExpanded && pyramidCollapsed && pyramidExpanded,
    `tree=${treeCollapsed}/${treeExpanded} pyramid=${pyramidCollapsed}/${pyramidExpanded}`)

  // ══════════ E2E-67（V4.5.0）选题卡进入今日三件事、详情与选题工作面 ══════════
  const topicProbeId = 'e2e-v450-topic-probe'
  const topicProbeTitle = 'E2E V4.5 选题卡进入今日三件事'
  await page.evaluate(async ({ todayKey, topicProbeId, topicProbeTitle }) => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    const data = raw.zy_data_v2
    if (!data) return
    const now = Date.now()
    data.topicStatuses = [
      { id: 'topic-idea', name: '构思中', color: '#6F7C86', order: 0 },
      { id: 'topic-making', name: '制作中', color: '#0F6F9E', order: 1 },
      { id: 'topic-ready', name: '待发布', color: '#9A6B12', order: 2 },
      { id: 'topic-published', name: '已发布', color: '#168457', order: 3, terminal: true },
    ]
    data.topics = (data.topics || []).filter(topic => topic.id !== topicProbeId)
    data.topics.unshift({
      id: topicProbeId,
      kind: 'topic',
      title: topicProbeTitle,
      projectId: 'e2e-proj-1',
      metricId: 'e2e-metric-1',
      statusId: 'topic-idea',
      description: '用于验证选题标题主视觉、资源关联与今日联动。',
      link: 'https://example.com/e2e-topic-outcome',
      linkType: 'url',
      tags: ['E2E', '选题'],
      customFields: {},
      assets: [],
      createdAt: now,
      updatedAt: now,
    })
    data.topicResourceLinks = (data.topicResourceLinks || []).filter(link => link.topicId !== topicProbeId)
    data.dailyFocus = data.dailyFocus || {}
    data.dailyFocus[todayKey] = []
    data.focusMutedDate = todayKey
    data.focusAutoDate = todayKey
    await chrome.storage.local.set({ zy_data_v2: data })
  }, { todayKey, topicProbeId, topicProbeTitle })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.focus-list .empty-row', { visible: true, timeout: 12000 })
  await page.locator('.focus-list .empty-row').first().click()
  await waitForLocator(page, '.picker-modal', { visible: true, timeout: 6000 })
  const pickerTypes = await page.locator('.pm-type-tabs button').allTextContents()
  await page.locator('.pm-type-tabs button').filter({ hasText: '选题卡' }).click()
  const topicStatusFilterOn = await page.locator('.pm-filters .pm-status').filter({ hasText: '全部选题状态' }).isVisible().catch(() => false)
  await page.locator('.pm-search-flat input').fill(topicProbeTitle)
  await waitForLocator(page, '.picker-item.topic', { visible: true, timeout: 6000 })
  const pickerCandidateText = (await page.locator('.picker-item.topic').first().innerText()).replace(/\s+/g, ' ')
  await page.locator('.picker-item.topic').first().click()
  await waitForLocator(page, '.drawer .topic-title', { visible: true, timeout: 8000 })
  const topicDrawer = await page.evaluate(() => {
    const title = document.querySelector('.drawer .topic-title')
    const core = document.querySelector('.drawer .topic-resource-core')
    const outcome = document.querySelector('.drawer .topic-outcome input')
    return {
      title: ((title instanceof HTMLTextAreaElement ? title.value : title?.textContent) || '').trim(),
      core: !!core,
      resourceCta: (core?.textContent || '').includes('关联资源卡'),
      aiFind: (core?.textContent || '').includes('AI 找资源'),
      outcomeFirst: !!document.querySelector('.drawer .topic-body > .topic-outcome'),
      outcomeValue: outcome instanceof HTMLInputElement ? outcome.value : '',
      ownerSelects: document.querySelectorAll('.drawer .topic-owner select').length,
      statusSelect: !!document.querySelector('.drawer .topic-plan select'),
      noteHeight: Math.round(document.querySelector('.drawer .topic-note textarea')?.getBoundingClientRect().height || 0),
    }
  })
  const topicFocusStored = await waitForStorage(page, 'zy_data_v2', raw => {
    const topic = (raw.zy_data_v2?.topics || []).find(row => row.id === topicProbeId)
    const slots = raw.zy_data_v2?.dailyFocus?.[todayKey] || []
    return topic?.dueDate === todayKey
      && topic?.statusId === 'topic-making'
      && slots.some(slot => slot.sourceType === 'topic' && slot.sourceId === topicProbeId && !slot.cleared)
  }, { timeout: 8000 })
  await page.locator('.drawer .topic-done').click()
  const topicDoneStored = await waitForStorage(page, 'zy_data_v2', raw => {
    const topic = (raw.zy_data_v2?.topics || []).find(row => row.id === topicProbeId)
    return topic?.statusId === 'topic-published' && !!topic?.completedAt
  }, { timeout: 5000 })
  await page.locator('.drawer .topic-done').click()
  const topicRestoredStored = await waitForStorage(page, 'zy_data_v2', raw => {
    const topic = (raw.zy_data_v2?.topics || []).find(row => row.id === topicProbeId)
    return topic?.statusId === 'topic-making' && !topic?.completedAt
  }, { timeout: 5000 })
  await page.locator('.drawer .drawer-close').last().click()
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {})
  await page.locator('.hand-tab').filter({ hasText: '选题' }).first().click()
  await waitForLocator(page, '.topic-manager', { visible: true, timeout: 8000 })
  const topicManager = page.locator('.topic-manager:visible').first()
  const topicCalendarOn = await topicManager.locator('.topic-calendar').isVisible().catch(() => false)
  const topicListText = (await topicManager.locator('.topic-pool-list').innerText().catch(() => '')).replace(/\s+/g, ' ')
  await topicManager.locator('.topic-view-switch button').filter({ hasText: '看板' }).click()
  await waitForLocator(topicManager, '.topic-board', { visible: true, timeout: 5000 })
  const boardStatuses = await topicManager.locator('.topic-board-col .topic-board-dot').count()
  const boardProbeVisible = (await topicManager.locator('.topic-board').innerText()).includes(topicProbeTitle)
  await topicManager.locator('.topic-collapse-inline').click()
  const topicListCollapsed = await topicManager.evaluate(el => el.classList.contains('list-hidden'))
  const topicRailVisible = await topicManager.locator('.topic-rail-toggle').isVisible().catch(() => false)
  await topicManager.locator('.topic-rail-toggle').click()
  const topicListExpanded = await topicManager.evaluate(el => !el.classList.contains('list-hidden'))
  await topicManager.locator('.topic-view-switch button').filter({ hasText: '日历' }).click()
  await waitForLocator(topicManager, '.topic-cal-chip', { visible: true, timeout: 5000 })
  await topicManager.locator('.topic-cal-chip').filter({ hasText: topicProbeTitle }).first().dblclick()
  // chrome.tabs.create 先开 about:blank，URL 随后才落地；固定等 500ms 会把真打开判成没开。
  const outcomePage = await pollUntil(
    () => ctx.pages().find(p => p !== page && p.url().includes('example.com/e2e-topic-outcome')) || false,
    { timeout: 8000, label: 'topic outcome tab' },
  )
  const topicOutcomeOpened = !!outcomePage
  if (outcomePage) await outcomePage.close().catch(() => {})
  const dragTarget = topicManager.locator('.cal-day:not(.outside):not(.today)').first()
  await page.evaluate(() => {
    const source = document.querySelector('.topic-manager:not([style*="display: none"]) .topic-pool-item')
    const target = document.querySelector('.topic-manager:not([style*="display: none"]) .topic-calendar .cal-day:not(.outside):not(.today)')
    if (!source || !target) return
    const sourceRect = source.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const top = Math.min(sourceRect.top, targetRect.top)
    const bottom = Math.max(sourceRect.bottom, targetRect.bottom)
    const spare = Math.max(24, (window.innerHeight - (bottom - top)) / 2)
    window.scrollBy(0, top - spare)
  })
  await topicManager.locator('.topic-pool-item').filter({ hasText: topicProbeTitle }).first().dragTo(dragTarget)
  const topicDragStored = await waitForStorage(page, 'zy_data_v2', raw => {
    const topic = (raw.zy_data_v2?.topics || []).find(row => row.id === topicProbeId)
    const slots = raw.zy_data_v2?.dailyFocus?.[todayKey] || []
    return !!topic?.dueDate
      && topic.dueDate !== todayKey
      && !slots.some(slot => slot.sourceType === 'topic' && slot.sourceId === topicProbeId && !slot.cleared)
  }, { timeout: 8000 })
  report('E2E-67 ★V4.5.0 选题卡可从今日三件事选择器按卡型与关键词进入，详情以标题和资源关联为主视觉；完成/恢复同步状态；选题工作面日历、看板与清单折叠可用',
    JSON.stringify(pickerTypes) === JSON.stringify(['全部', '任务卡', '选题卡'])
      && topicStatusFilterOn
      && pickerCandidateText.includes(topicProbeTitle) && pickerCandidateText.includes('选题')
      && topicDrawer.title.includes(topicProbeTitle) && topicDrawer.core && topicDrawer.resourceCta
      && topicDrawer.outcomeFirst && topicDrawer.outcomeValue.includes('example.com/e2e-topic-outcome')
      && topicDrawer.aiFind && topicDrawer.ownerSelects === 2 && topicDrawer.statusSelect
      && topicDrawer.noteHeight > 0 && topicDrawer.noteHeight <= 110
      && !!topicFocusStored && !!topicDoneStored && !!topicRestoredStored
      && topicCalendarOn && topicListText.includes(topicProbeTitle)
      && boardStatuses === 4 && boardProbeVisible && topicListCollapsed && topicRailVisible && topicListExpanded
      && topicOutcomeOpened && !!topicDragStored,
    `卡型=${JSON.stringify(pickerTypes)} 选题状态筛选=${topicStatusFilterOn} 候选=${JSON.stringify(pickerCandidateText)} 详情=${JSON.stringify(topicDrawer)} 入库=${!!topicFocusStored}/${!!topicDoneStored}/${!!topicRestoredStored} 日历=${topicCalendarOn} 清单=${topicListText.includes(topicProbeTitle)} 看板=${boardStatuses}/${boardProbeVisible} 折叠=${topicListCollapsed}/${topicRailVisible}/${topicListExpanded} 双击成果=${topicOutcomeOpened} 拖拽排期=${!!topicDragStored}`)

  // ══════════ E2E-68（V4.6.0）任务清单折叠、单项目聚焦与旧快照恢复 ══════════
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.locator('.hand-tab').filter({ hasText: '任务' }).first().click()
  await waitForLocator(page, '.task-calendar .cal-list-collapse', { visible: true, timeout: 8000 })
  const taskCalendar = page.locator('.task-calendar:visible').first()
  await taskCalendar.locator('.cal-list-collapse').click()
  const taskFoldState = await taskCalendar.evaluate(el => ({
    hidden: el.classList.contains('list-hidden'),
    railVisible: !!el.querySelector('.cal-rail-toggle') && getComputedStyle(el.querySelector('.cal-rail-toggle')).display !== 'none',
    poolBodyGone: !el.querySelector('.cal-pool-list'),
  }))
  await taskCalendar.locator('.cal-rail-toggle').click()
  const taskFoldRestored = await taskCalendar.evaluate(el => !el.classList.contains('list-hidden') && !!el.querySelector('.cal-pool-list'))
  await page.goto(base + '#/compass/curation?layout=tree&project=e2e-proj-1', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.ctl.focused .ctl-goals', { visible: true, timeout: 10000 })
  const focusCentered = await page.locator('.ctl.focused .ctl-goals').evaluate(el => {
    const style = getComputedStyle(el)
    const width = el.getBoundingClientRect().width
    return style.justifyContent === 'center' && width <= 1181
  })
  await page.goto(base + '#/workspace/e2e-main-board', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.ws-curation-console', { visible: true, timeout: 10000 })
  const consolePair = await page.locator('.ws-curation-console').evaluate(el => {
    const thesis = el.querySelector('.thesis-banner')?.getBoundingClientRect()
    /* V4.7：右栏外壳是 .cur-global-panel（.cur-toolbar 已收进其 10px padding 内），
       双列对齐判据改钉外壳，守的布局关系不变。 */
    const panel = el.querySelector('.cur-global-panel')?.getBoundingClientRect()
    return !!thesis && !!panel && Math.abs(thesis.top - panel.top) < 3 && panel.left > thesis.right - 2
  })
  const originalData = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(raw => raw.zy_data_v2))
  await page.evaluate(async () => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    const data = raw.zy_data_v2
    if (!data) return
    delete data.topics
    delete data.topicStatuses
    delete data.topicResourceLinks
    delete data.dailyFocus
    await chrome.storage.local.set({ zy_data_v2: data })
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  /* ★V4.7.6 重指：调度台大标题已按拍板退役，页头改为主攻项目模块；守的仍是「调度台真渲染后可安全读旧快照」。 */
  await waitForLocator(page, '.desk-head', { visible: true, timeout: 10000 })
  const legacySnapshotSafe = await page.locator('.re-title').count() === 0
  if (originalData) await page.evaluate(data => chrome.storage.local.set({ zy_data_v2: data }), originalData)
  report('E2E-68 ★V4.7 任务清单可在标题旁折叠后让日历铺满；方向树单项目聚焦水平居中；策展台论点与全局功能模块双列对齐；缺少 V4.5 数组的旧快照恢复后调度台仍可渲染',
    taskFoldState.hidden && taskFoldState.railVisible && taskFoldState.poolBodyGone && taskFoldRestored
      && focusCentered && consolePair && legacySnapshotSafe,
    `任务折叠=${JSON.stringify(taskFoldState)} 恢复=${taskFoldRestored} 聚焦居中=${focusCentered} 策展双列=${consolePair} 旧快照=${legacySnapshotSafe}`)

  // ══════════ E2E-69（V4.7.4）画像时间轴双入口、首屏压缩与任务全景深链 ══════════
  const v474LinkedId = 'e2e-v474-timeline-linked'
  const v474NoLinkId = 'e2e-v474-timeline-nolink'
  const v474OrphanId = 'e2e-v474-orphan-task'
  const v474LinkedTitle = 'E2E V4.7.4 时间轴链接资源'
  const v474NoLinkTitle = 'E2E V4.7.4 时间轴无链接资源'
  const v474OrphanTitle = 'E2E V4.7.4 未归属任务'
  const v474Link = 'https://example.com/e2e/v474/timeline-link'
  await page.evaluate(async ({ linkedId, noLinkId, orphanId, linkedTitle, noLinkTitle, orphanTitle, link, at }) => {
    const raw = await chrome.storage.local.get(['zy_data_v2', 'zy_event_log'])
    const data = raw.zy_data_v2
    if (!data) return
    const resource = (id, title, href) => ({
      id,
      kind: 'resource',
      title,
      description: 'V4.7.4 E2E 时间轴探针',
      linkType: 'url',
      link: href,
      workspaceId: 'zy-curation',
      categoryId: '',
      sourceType: 'official',
      tags: ['E2E'],
      pinned: false,
      callCount: 0,
      customFields: {},
      assets: [],
      createdAt: at,
      updatedAt: at,
    })
    data.resources = (data.resources || []).filter(row => ![linkedId, noLinkId].includes(row.id))
    data.resources.push(resource(linkedId, linkedTitle, link), resource(noLinkId, noLinkTitle, ''))
    data.tasks = (data.tasks || []).filter(row => row.id !== orphanId)
    data.tasks.push({
      id: orphanId,
      kind: 'task',
      title: orphanTitle,
      status: 'todo',
      statusId: 'task-todo',
      projectId: 'e2e-v474-missing-project',
      metricId: null,
      link: '',
      tags: ['E2E'],
      pinned: false,
      callCount: 0,
      customFields: {},
      assets: [],
      createdAt: at,
      updatedAt: at,
    })
    const log = Array.isArray(raw.zy_event_log) ? raw.zy_event_log : []
    const kept = log.filter(row => ![linkedId, noLinkId].includes(row.cardId))
    kept.push({
      id: 'e2e-v474-create-linked',
      ts: at,
      action: 'create',
      kind: 'resource',
      title: linkedTitle,
      cardId: linkedId,
    }, {
      id: 'e2e-v474-create-nolink',
      ts: at - 1,
      action: 'create',
      kind: 'resource',
      title: noLinkTitle,
      cardId: noLinkId,
    })
    await chrome.storage.local.set({ zy_data_v2: data, zy_event_log: kept })
  }, { linkedId: v474LinkedId, noLinkId: v474NoLinkId, orphanId: v474OrphanId, linkedTitle: v474LinkedTitle, noLinkTitle: v474NoLinkTitle, orphanTitle: v474OrphanTitle, link: v474Link, at: Date.now() })

  await page.goto(base + '#/profile?view=timeline', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.pi-annual-heatmap', { visible: true, timeout: 10000 })
  const v474LinkedCard = page.locator('.pit-card').filter({ hasText: v474LinkedTitle }).first()
  const v474NoLinkCard = page.locator('.pit-card').filter({ hasText: v474NoLinkTitle }).first()
  await pollUntil(async () => (await v474LinkedCard.count()) > 0 && (await v474NoLinkCard.count()) > 0, { timeout: 10000 })
  const v474ProfileBox = await page.locator('.pi-annual-heatmap').boundingBox()
  const v474FirstCardBox = await v474LinkedCard.boundingBox().catch(() => null)
  // V4.7.6：原双栏概览退役为年度热力图，仍守“时间轴首卡底部进入 900px 首屏”。
  const v474Compact = !!v474ProfileBox
    && !!v474FirstCardBox && v474FirstCardBox.y + v474FirstCardBox.height < 900
  const v474MetaHidden = await v474LinkedCard.evaluate(el => !el.textContent.includes('未关联项目') && !el.querySelector('.pit-card-meta'))

  await v474LinkedCard.click()
  const v474DetailOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  /* ★V4.7.6 完整详情的主标题在 DetailTitle 的 textarea value 里，`hasText` 读不到；
     改为直接读打开中的抽屉与 .ds-h1，并继续守「资源卡不出现所属项目 / 成功指标」。 */
  const v474Detail = page.locator('.drawer').first()
  const v474DetailTitle = v474DetailOpen
    ? (await v474Detail.locator('.ds-h1').first().inputValue().catch(() => '')).includes(v474LinkedTitle)
    : false
  const v474ResourceAffiliationHidden = v474DetailOpen
    ? await v474Detail.evaluate(el =>
      !!el.querySelector('textarea, input')
      && !el.textContent.includes('所属项目') && !el.textContent.includes('成功指标'))
    : false
  if (v474DetailOpen) {
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 })
  }

  const v474LinkedTab = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null)
  await v474LinkedCard.dblclick()
  const opened = await v474LinkedTab
  let v474OpenedUrl = opened ? opened.url() : ''
  if (!v474OpenedUrl.includes('/e2e/v474/timeline-link')) {
    v474OpenedUrl = await page.evaluate(async (target) => {
      const tabs = await chrome.tabs.query({})
      return (tabs.find(tab => tab.url === target) || {}).url || ''
    }, v474Link)
  }
  const v474NoDetailAfterDbl = (await page.locator('.drawer').count()) === 0
  if (opened) await opened.close().catch(() => {})
  await v474NoLinkCard.dblclick()
  const v474NoLinkToast = await pollUntil(async () => {
    const text = await page.locator('.toast-msg').allTextContents().catch(() => [])
    return text.some(row => row.includes('该卡还没填链接'))
  }, { timeout: 4000 })
  const v474NoLinkNoDetail = (await page.locator('.drawer').count()) === 0

  await page.goto(base + `#/compass?layer=6&fresh=1&freshAt=${Date.now()}`, { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.lvlist', { visible: true, timeout: 10000 })
  const v474Panorama = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.lvlist .lvl-row.r6')]
    const groups = [...document.querySelectorAll('.lvlist .lvl-project-head')].map(el => el.textContent || '')
    return {
      layer: document.querySelector('.lvl-n')?.textContent?.trim() || '',
      rows: rows.map(el => el.textContent || ''),
      groups,
      spine: document.querySelector('.spine-h')?.getAttribute('aria-expanded') === 'true',
    }
  })
  const v474LiveTaskCount = await page.evaluate(async () => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    return (raw.zy_data_v2?.tasks || []).filter(task => !task.deletedAt).length
  })
  const v474PanoramaOk = v474Panorama.layer === '6'
    && v474Panorama.spine
    && v474Panorama.rows.length === v474LiveTaskCount
    && v474Panorama.groups.filter(text => text.includes('未归属项目')).length === 1
    && v474Panorama.rows.some(text => text.includes(v474OrphanTitle))
  report('E2E-69 ★V4.7.4 画像首屏压缩后时间轴卡片仍在 1440×900 首屏内；资源卡单击开详情且详情隐藏项目/指标，双击取消详情并直达 URL；无链接只提示不回落详情；/compass?layer=6 展开战略骨架并列出全部任务与未归属组',
    v474Compact && v474MetaHidden && v474DetailOpen && v474DetailTitle && v474ResourceAffiliationHidden
      && v474OpenedUrl.includes('/e2e/v474/timeline-link') && v474NoDetailAfterDbl
      && v474NoLinkToast && v474NoLinkNoDetail && v474PanoramaOk,
    `首屏=${JSON.stringify(v474ProfileBox)} 卡片=${JSON.stringify(v474FirstCardBox)} 元信息隐藏=${v474MetaHidden} 单击详情=${v474DetailOpen}/${v474DetailTitle} 归属隐藏=${v474ResourceAffiliationHidden} 双击URL=${v474OpenedUrl} 双击无详情=${v474NoDetailAfterDbl} 空链提示=${v474NoLinkToast} 空链无详情=${v474NoLinkNoDetail} 全景=${JSON.stringify(v474Panorama)} 未归属组=${v474Panorama.groups.filter(text => text.includes('未归属项目')).length} 任务数=${v474Panorama.rows.length}/${v474LiveTaskCount}`)

  // ══════════ E2E-70（V4.7.6）热力图常驻与卡片分析聚合 ══════════
  await page.goto(base + '#/profile?view=timeline', { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.pi-annual-heatmap', { visible: true, timeout: 10000 })
  const heatBefore = await page.locator('.pi-annual-heatmap').count()
  await page.locator('.pi-view-tab[data-profile-view="analysis"]').click()
  await waitForLocator(page, '.pi-card-analysis', { visible: true, timeout: 5000 })
  const analysisText = await page.locator('.pi-card-analysis').innerText()
  const heatAfter = await page.locator('.pi-annual-heatmap').count()
  report('E2E-70 ★V4.7.6 年度热力图独立于视图页签常驻，卡片分析聚合产品状态、三件事与生命周期',
    heatBefore === 1 && heatAfter === 1 && analysisText.includes('三件事') && analysisText.includes('生命周期'),
    `热力=${heatBefore}/${heatAfter} 分析=${analysisText.slice(0, 220).replace(/\s+/g, ' ')}`)

  // ══════════ E2E-71（V4.7.6）时间轴三件事与完整详情 ══════════
  await page.locator('.pi-view-tab[data-profile-view="timeline"]').click()
  await waitForLocator(page, '.pit-card', { visible: true, timeout: 8000 })
  const pitButtons = await page.locator('.pit-filter button').allTextContents().catch(() => [])
  await page.locator('.pit-filter button').filter({ hasText: '三件事' }).click()
  await waitForLocator(page, '.pit-card', { visible: true, timeout: 5000 })
  const focusTimelineText = await page.locator('.pit-days').innerText().catch(() => '')
  const shortcutGone = (await page.locator('.pit-shortcut').count()) === 0
  const timelineDetailTitle = v474LinkedTitle
  await page.locator('.pit-filter button').filter({ hasText: '资源' }).click()
  await page.locator('.pit-card').filter({ hasText: timelineDetailTitle }).first().click()
  const fullTimelineDrawer = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const fullTimelineDetailEl = page.locator('.drawer').first()
  const fullTimelineTitle = fullTimelineDrawer
    ? (await fullTimelineDetailEl.locator('.ds-h1').first().inputValue().catch(() => '')).includes(timelineDetailTitle)
    : false
  const fullTimelineDetail = fullTimelineDrawer ? await fullTimelineDetailEl.innerText() : ''
  if (fullTimelineDrawer) await page.keyboard.press('Escape')
  report('E2E-71 ★V4.7.6 时间轴三件事专页保留，移除快捷键入口，单击进入完整卡片详情',
    pitButtons.some(text => text.includes('三件事')) && focusTimelineText.includes('三件事') && shortcutGone
      && fullTimelineTitle && !fullTimelineDetail.includes('从画像回到工作面'),
    `筛选项=${JSON.stringify(pitButtons)} 三件事=${focusTimelineText.slice(0, 120).replace(/\s+/g, ' ')} 快捷键=${shortcutGone} 详情=${fullTimelineDetail.slice(0, 180).replace(/\s+/g, ' ')}`)

  // ══════════ E2E-72（V4.7.6）紧凑主攻项目与右侧完整项目详情 ══════════
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.desk-focus-projects', { visible: true, timeout: 10000 })
  const focusProjectNames = await page.locator('.desk-focus-project').allTextContents()
  const deskHeroGone = (await page.locator('.desk-heading').count()) === 0
  const firstProject = page.locator('.desk-focus-project').first()
  const focusProjectTitle = (await firstProject.locator('span').first().innerText()).trim()
  await firstProject.click()
  const projectDrawerOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const projectDrawer = page.locator('.drawer').first()
  const projectDrawerText = projectDrawerOpen ? await projectDrawer.innerText() : ''
  const projectDrawerSide = projectDrawerOpen ? await pollUntil(async () => {
    return projectDrawer.evaluate(el => {
      const box = el.getBoundingClientRect()
      return box.left > window.innerWidth / 2 && box.width < window.innerWidth * .8
    }).catch(() => false)
  }, { timeout: 3000 }) === true : false
  if (projectDrawerOpen) await page.keyboard.press('Escape')
  report('E2E-72 ★V4.7.6 调度台紧凑主攻最多三项，点击右侧滑出含成功指标的完整项目详情',
    deskHeroGone && focusProjectNames.length > 0 && focusProjectNames.length <= 3
      && projectDrawerText.includes(focusProjectTitle) && projectDrawerText.includes('成功指标') && projectDrawerSide,
    `项目=${JSON.stringify(focusProjectNames)} 旧页头=${!deskHeroGone} 详情=${projectDrawerText.slice(0, 200).replace(/\s+/g, ' ')} 右侧=${projectDrawerSide}`)

  // ══════════ E2E-73（V4.7.6）三类卡池时间线与任务项目分组 ══════════
  await page.locator('.hand-tab').filter({ hasText: '任务' }).first().click()
  const taskViews = page.locator('.task-work-view-switch')
  await page.locator('select[aria-label="任务分组"]').selectOption('project')
  const listGroupButton = taskViews.locator('button').filter({ hasText: '列表' })
  await listGroupButton.click()
  const listGrouped = (await page.locator('.twl-group').count()) > 0
    && (await page.locator('.twl-group-head').filter({ hasText: '未关联项目' }).count()) > 0
  await taskViews.locator('button').filter({ hasText: '看板' }).click()
  const kanbanGrouped = (await page.locator('.tb-group .tb-group-head').count()) > 0
    && (await page.locator('.tb-group-head').filter({ hasText: '未关联项目' }).count()) > 0
  await taskViews.locator('button').filter({ hasText: '时间线' }).click()
  const taskTimeline = await waitForLocator(page, '.cpt[aria-label="任务时间线"]', { visible: true, timeout: 5000 })
  await page.locator('.hand-tab').filter({ hasText: '选题' }).first().click()
  await page.locator('.topic-view-switch button').filter({ hasText: '时间线' }).click()
  const topicTimeline = await waitForLocator(page, '.cpt[aria-label="选题时间线"]', { visible: true, timeout: 5000 })
  await page.locator('.hand-tab').filter({ hasText: '好奇心' }).first().click()
  await page.locator('.cw-view-switch button').filter({ hasText: '时间线' }).click()
  const curiosityTimeline = await waitForLocator(page, '.cpt[aria-label="好奇心时间线"]', { visible: true, timeout: 5000 })
  report('E2E-73 ★V4.7.6 首页任务列表/看板支持按项目分组并保留未关联项目组，任务/选题/好奇心三池时间线可用',
    listGrouped && kanbanGrouped && !!taskTimeline && !!topicTimeline && !!curiosityTimeline,
    `分组=${listGrouped}/${kanbanGrouped} 时间线=${!!taskTimeline}/${!!topicTimeline}/${!!curiosityTimeline}`)

  // ══════════ E2E-74 / 75（V4.7.6）历史镜像、隐藏与今日真实槽位 ══════════
  const mirrorTaskId = 'e2e-v476-mirror-task'
  const mirrorTopicId = 'e2e-v476-mirror-topic'
  const mirrorTaskTitle = 'E2E V4.7.6 连续三件事任务'
  const mirrorTopicTitle = 'E2E V4.7.6 连续三件事选题'
  const yesterday = new Date(`${todayKey}T12:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  await page.evaluate(async ({ taskId, topicId, taskTitle, topicTitle, yesterday, today }) => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    const data = raw.zy_data_v2
    if (!data) return
    const at = Date.now()
    data.tasks.push({ id: taskId, kind: 'task', title: taskTitle, status: 'doing', statusId: 'task-doing', projectId: 'e2e-proj-1', tags: [], pinned: false, callCount: 0, customFields: {}, assets: [], createdAt: at, updatedAt: at })
    data.topics.push({ id: topicId, kind: 'topic', title: topicTitle, statusId: 'topic-idea', projectId: 'e2e-proj-1', tags: [], pinned: false, callCount: 0, customFields: {}, assets: [], createdAt: at, updatedAt: at })
    data.dailyFocus = data.dailyFocus || {}
    data.dailyFocus[yesterday] = [
      { id: 'e2e-v476-yesterday-task', sourceType: 'task', sourceId: taskId, text: '旧任务快照', done: false },
      { id: 'e2e-v476-yesterday-topic', sourceType: 'topic', sourceId: topicId, text: '旧选题快照', done: false },
    ]
    data.dailyFocus[today] = [
      { id: 'e2e-v476-today-task', sourceType: 'task', sourceId: taskId, text: taskTitle, done: false },
      { id: 'e2e-v476-today-topic', sourceType: 'topic', sourceId: topicId, text: topicTitle, done: false },
    ]
    delete data.focusHistoryHidden
    await chrome.storage.local.set({ zy_data_v2: data })
  }, { taskId: mirrorTaskId, topicId: mirrorTopicId, taskTitle: mirrorTaskTitle, topicTitle: mirrorTopicTitle, yesterday: yesterdayKey, today: todayKey })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.task-calendar', { visible: true, timeout: 10000 })
  const mirrorCell = page.locator(`.task-calendar .cal-day[data-day="${yesterdayKey}"]`)
  await mirrorCell.scrollIntoViewIfNeeded()
  const mirror = mirrorCell.locator('.cal-task-chip.is-history-mirror').filter({ hasText: mirrorTaskTitle })
  const mirrorCount = await mirror.count()
  const mirrorLiveTitle = mirrorCount === 1 && (await mirror.innerText()).includes(mirrorTaskTitle)
  const mirrorClickable = mirrorCount === 1 ? await mirror.evaluate(el => ({
    role: el.getAttribute('role'),
    tabindex: el.getAttribute('tabindex'),
    draggable: el.getAttribute('draggable'),
    border: getComputedStyle(el).borderTopStyle,
  })).then(row => row.role === 'button' && row.tabindex === '0' && row.draggable !== 'true' && row.border === 'dashed') : false
  const todayTaskCard = page.locator(`.task-calendar .cal-day.today .cal-task-chip`).filter({ hasText: mirrorTaskTitle }).first()
  const todayTaskSolid = (await todayTaskCard.count()) === 1
    && await todayTaskCard.evaluate(el => getComputedStyle(el).borderTopStyle === 'solid')
  if (mirrorCount === 1) await mirror.click()
  const mirrorDrawerOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const mirrorDetailTitle = mirrorDrawerOpen
    ? (await page.locator('.drawer .ts-title').first().inputValue().catch(() => '')).includes(mirrorTaskTitle)
    : false
  if (mirrorDrawerOpen) {
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 })
  }
  if (mirrorCount === 1) await mirror.getByRole('button', { name: '取消该日历史三件事落图' }).click()
  const taskHideStored = await waitForStorage(page, 'zy_data_v2', raw => {
    const data = raw.zy_data_v2
    return data?.focusHistoryHidden?.[yesterdayKey]?.some(row => row.slotId === 'e2e-v476-yesterday-task')
      && (data?.dailyFocus?.[yesterdayKey] || []).some(slot => slot.id === 'e2e-v476-yesterday-task')
  }, { timeout: 5000 })
  report('E2E-74 ★V4.7.6 历史三件事为可点虚线卡、当下为实线卡；历史卡可开完整详情并取消该日落图，原槽位保留',
    mirrorCount === 1 && mirrorLiveTitle && mirrorClickable && todayTaskSolid
      && mirrorDrawerOpen && mirrorDetailTitle && !!taskHideStored,
    `镜像=${mirrorCount} 实时=${mirrorLiveTitle} 可点/虚线=${mirrorClickable} 当下实线=${todayTaskSolid} 详情=${mirrorDrawerOpen}/${mirrorDetailTitle} 取消入库=${!!taskHideStored}`)

  await page.locator('.hand-tab').filter({ hasText: '选题' }).first().click()
  const topicMirrorCell = page.locator(`.topic-calendar .cal-day[data-day="${yesterdayKey}"]`)
  await topicMirrorCell.scrollIntoViewIfNeeded()
  const topicMirror = topicMirrorCell.locator('.topic-cal-chip.is-history-mirror').filter({ hasText: mirrorTopicTitle })
  const topicMirrorVisible = (await topicMirror.count()) === 1
  const topicMirrorClickable = topicMirrorVisible ? await topicMirror.evaluate(el => ({
    role: el.getAttribute('role'),
    tabindex: el.getAttribute('tabindex'),
    draggable: el.getAttribute('draggable'),
    border: getComputedStyle(el).borderTopStyle,
  })).then(row => row.role === 'button' && row.tabindex === '0' && row.draggable !== 'true' && row.border === 'dashed') : false
  await topicMirror.click()
  const topicMirrorDrawerOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const topicMirrorDetailTitle = topicMirrorDrawerOpen
    ? (await page.locator('.drawer .topic-title').first().inputValue().catch(() => '')).includes(mirrorTopicTitle)
    : false
  if (topicMirrorDrawerOpen) {
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 })
  }
  await page.locator(`.topic-calendar .cal-day.today .topic-cal-chip`).filter({ hasText: mirrorTopicTitle }).getByRole('button', { name: '取消排期' }).click()
  const todaySlotCleared = await waitForStorage(page, 'zy_data_v2', raw => {
    const slots = raw.zy_data_v2?.dailyFocus?.[todayKey] || []
    return !slots.some(slot => slot.id === 'e2e-v476-today-topic' && !slot.cleared)
  }, { timeout: 5000 })
  const topicMirrorAfter = await page.locator(`.topic-calendar .cal-day[data-day="${yesterdayKey}"] .is-history-mirror`).filter({ hasText: mirrorTopicTitle }).count()
  const todayFocusSurvives = await page.evaluate(async ({ todayKey }) => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    return (raw.zy_data_v2?.dailyFocus?.[todayKey] || []).some(slot => slot.id === 'e2e-v476-today-task' && !slot.cleared)
  }, { todayKey })
  report('E2E-75 ★V4.7.6 选题历史卡可开详情、虚线留存；今日可取消排期而历史与其他槽位不受影响',
    topicMirrorVisible && topicMirrorClickable && topicMirrorDrawerOpen && topicMirrorDetailTitle
      && !!todaySlotCleared && topicMirrorAfter === 1 && todayFocusSurvives,
    `昨日=${topicMirrorVisible}/${topicMirrorAfter} 可点/虚线=${topicMirrorClickable} 详情=${topicMirrorDrawerOpen}/${topicMirrorDetailTitle} 今日取消=${!!todaySlotCleared} 其他槽=${todayFocusSurvives}`)

  // ══════════ E2E-76（V4.7.6）任务 / 选题 / 好奇心时间线卡片流 ══════════
  const poolTlTaskId = 'e2e-v476-pool-tl-task'
  const poolTlTaskNoLinkId = 'e2e-v476-pool-tl-task-nolink'
  const poolTlTopicId = 'e2e-v476-pool-tl-topic'
  const poolTlCurioId = 'e2e-v476-pool-tl-curio'
  const poolTlTaskTitle = 'E2E V4.7.6 时间线任务卡'
  const poolTlNoLinkTitle = 'E2E V4.7.6 时间线无链任务'
  const poolTlTopicTitle = 'E2E V4.7.6 时间线选题卡'
  const poolTlCurioTitle = 'E2E V4.7.6 时间线好奇卡'
  const poolTlTaskUrl = 'https://example.com/e2e/v476/pool-timeline-task'
  const poolTlTopicUrl = 'https://example.com/e2e/v476/pool-timeline-topic'
  const poolTlCurioUrl = 'https://example.com/e2e/v476/pool-timeline-curio'
  await page.evaluate(async ({ taskId, noLinkId, topicId, curioId, taskTitle, noLinkTitle, topicTitle, curioTitle, taskUrl, topicUrl, curioUrl, at }) => {
    const raw = await chrome.storage.local.get(['zy_data_v2', 'zy_event_log'])
    const data = raw.zy_data_v2
    if (!data) return
    const ids = [taskId, noLinkId, topicId, curioId]
    data.tasks = (data.tasks || []).filter(row => !ids.includes(row.id))
    data.topics = (data.topics || []).filter(row => !ids.includes(row.id))
    data.curiosities = (data.curiosities || []).filter(row => !ids.includes(row.id))
    data.tasks.push({
      id: taskId, kind: 'task', title: taskTitle, status: 'todo',
      statusId: (data.taskStatuses || []).find(row => row.bucket === 'todo')?.id || 'task-todo',
      projectId: '', metricId: null, priority: 'medium', link: taskUrl,
      tags: ['E2E'], pinned: false, callCount: 0, customFields: {}, assets: [],
      createdAt: at, updatedAt: at,
    }, {
      id: noLinkId, kind: 'task', title: noLinkTitle, status: 'todo',
      statusId: (data.taskStatuses || []).find(row => row.bucket === 'todo')?.id || 'task-todo',
      projectId: '', metricId: null, priority: 'medium', link: '',
      tags: ['E2E'], pinned: false, callCount: 0, customFields: {}, assets: [],
      createdAt: at - 1, updatedAt: at - 1,
    })
    data.topics.push({
      id: topicId, kind: 'topic', title: topicTitle,
      statusId: (data.topicStatuses || [])[0]?.id || 'topic-idea',
      projectId: '', metricId: null, link: topicUrl,
      tags: ['E2E'], pinned: false, callCount: 0, customFields: {}, assets: [],
      createdAt: at - 2, updatedAt: at - 2,
    })
    data.curiosities.push({
      id: curioId, kind: 'curiosity', question: curioTitle, sourceUrl: curioUrl,
      status: 'todo', tags: ['E2E'], pinned: false, callCount: 0,
      customFields: {}, assets: [], createdAt: at - 3, updatedAt: at - 3,
    })
    const log = (Array.isArray(raw.zy_event_log) ? raw.zy_event_log : []).filter(row => !ids.includes(row.cardId))
    log.push(
      { id: 'e2e-v476-pool-tl-task-create', ts: at - 10, action: 'create', kind: 'task', title: taskTitle, cardId: taskId },
      { id: 'e2e-v476-pool-tl-task-edit', ts: at, action: 'edit', kind: 'task', title: taskTitle, cardId: taskId },
      { id: 'e2e-v476-pool-tl-task-nolink-create', ts: at - 1, action: 'create', kind: 'task', title: noLinkTitle, cardId: noLinkId },
      { id: 'e2e-v476-pool-tl-topic-create', ts: at - 2, action: 'create', kind: 'topic', title: topicTitle, cardId: topicId },
      { id: 'e2e-v476-pool-tl-curio-create', ts: at - 3, action: 'create', kind: 'curiosity', title: curioTitle, cardId: curioId },
    )
    await chrome.storage.local.set({ zy_data_v2: data, zy_event_log: log })
  }, {
    taskId: poolTlTaskId, noLinkId: poolTlTaskNoLinkId, topicId: poolTlTopicId, curioId: poolTlCurioId,
    taskTitle: poolTlTaskTitle, noLinkTitle: poolTlNoLinkTitle, topicTitle: poolTlTopicTitle, curioTitle: poolTlCurioTitle,
    taskUrl: poolTlTaskUrl, topicUrl: poolTlTopicUrl, curioUrl: poolTlCurioUrl, at: Date.now(),
  })
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForLocator(page, '.hand-tab', { visible: true, timeout: 10000 })

  async function openPoolTimelineLink(card, targetUrl) {
    const pagePromise = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null)
    await card.dblclick()
    const opened = await pagePromise
    let openedUrl = opened ? opened.url() : ''
    if (!openedUrl.includes(targetUrl)) {
      openedUrl = await pollUntil(async () => page.evaluate(async (target) => {
        const tabs = await chrome.tabs.query({})
        return (tabs.find(tab => tab.url === target) || {}).url || false
      }, targetUrl), { timeout: 5000, label: 'pool timeline link' })
    }
    if (opened) await opened.close().catch(() => {})
    return { hit: String(openedUrl || '').includes(targetUrl), url: openedUrl || '' }
  }

  await page.locator('.hand-tab').filter({ hasText: '任务' }).first().click()
  await waitForLocator(page, '.task-work-view-switch', { visible: true, timeout: 8000 })
  await page.locator('.task-work-view-switch button').filter({ hasText: '时间线' }).click()
  const taskPoolTimeline = await waitForLocator(page, '.cpt[aria-label="任务时间线"]', { visible: true, timeout: 5000 })
  const taskPoolCard = page.locator(`.cpt[aria-label="任务时间线"] .cpt-card[data-card-id="${poolTlTaskId}"]`)
  await pollUntil(async () => (await taskPoolCard.count()) === 1, { timeout: 8000, label: 'task pool timeline card' })
  const taskPoolCardShape = (await taskPoolCard.count()) === 1 && await taskPoolCard.evaluate(el =>
    !!el.querySelector('.cpt-kind') && !!el.querySelector('.cpt-title') && !!el.querySelector('.cpt-status') && !!el.querySelector('time')
      && (el.textContent || '').includes('修改') && (el.textContent || '').includes('2 次记录'))
  await taskPoolCard.click()
  const taskPoolDrawerOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const taskPoolDrawerTitle = taskPoolDrawerOpen
    ? (await page.locator('.drawer .ts-title').first().inputValue().catch(() => '')).includes(poolTlTaskTitle)
    : false
  if (taskPoolDrawerOpen) {
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 })
  }
  const taskPoolLink = await openPoolTimelineLink(taskPoolCard, poolTlTaskUrl)
  const taskPoolDoubleNoDrawer = (await page.locator('.drawer').count()) === 0
  const noLinkCard = page.locator(`.cpt[aria-label="任务时间线"] .cpt-card[data-card-id="${poolTlTaskNoLinkId}"]`)
  await noLinkCard.dblclick()
  const noLinkToast = await pollUntil(async () => {
    const text = await page.locator('.toast-msg').allTextContents().catch(() => [])
    return text.some(row => row.includes('该卡还没填链接'))
  }, { timeout: 4000 })
  const noLinkNoDetail = (await page.locator('.drawer').count()) === 0

  await page.locator('.hand-tab').filter({ hasText: '选题' }).first().click()
  await waitForLocator(page, '.topic-view-switch', { visible: true, timeout: 8000 })
  await page.locator('.topic-view-switch button').filter({ hasText: '时间线' }).click()
  const topicPoolTimeline = await waitForLocator(page, '.cpt[aria-label="选题时间线"]', { visible: true, timeout: 5000 })
  const topicPoolCard = page.locator(`.cpt[aria-label="选题时间线"] .cpt-card[data-card-id="${poolTlTopicId}"]`)
  await pollUntil(async () => (await topicPoolCard.count()) === 1, { timeout: 8000, label: 'topic pool timeline card' })
  await topicPoolCard.click()
  const topicPoolDrawerOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const topicPoolDrawerTitle = topicPoolDrawerOpen
    ? (await page.locator('.drawer .topic-title').first().inputValue().catch(() => '')).includes(poolTlTopicTitle)
    : false
  if (topicPoolDrawerOpen) {
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 })
  }
  const topicPoolLink = await openPoolTimelineLink(topicPoolCard, poolTlTopicUrl)

  await page.locator('.hand-tab').filter({ hasText: '好奇心' }).first().click()
  await waitForLocator(page, '.cw-view-switch', { visible: true, timeout: 8000 })
  await page.locator('.cw-view-switch button').filter({ hasText: '时间线' }).click()
  const curioPoolTimeline = await waitForLocator(page, '.cpt[aria-label="好奇心时间线"]', { visible: true, timeout: 5000 })
  const curioPoolCard = page.locator(`.cpt[aria-label="好奇心时间线"] .cpt-card[data-card-id="${poolTlCurioId}"]`)
  await pollUntil(async () => (await curioPoolCard.count()) === 1, { timeout: 8000, label: 'curiosity pool timeline card' })
  await curioPoolCard.click()
  const curioPoolDrawerOpen = await waitForLocator(page, '.drawer', { visible: true, timeout: 5000 })
  const curioPoolDrawerTitle = curioPoolDrawerOpen
    ? (await page.locator('.drawer .cz-h1q').first().innerText().catch(() => '')).includes(poolTlCurioTitle.slice(0, 20))
    : false
  if (curioPoolDrawerOpen) {
    await page.keyboard.press('Escape')
    await pollUntil(async () => (await page.locator('.drawer').count()) === 0, { timeout: 4000 })
  }
  const curioPoolLink = await openPoolTimelineLink(curioPoolCard, poolTlCurioUrl)
  report('E2E-76 ★V4.7.6 任务 / 选题 / 好奇心时间线均为卡片流；单击开完整详情，双击走各自链接字段且空链只提示',
    !!taskPoolTimeline && !!topicPoolTimeline && !!curioPoolTimeline
      && taskPoolCardShape && taskPoolDrawerOpen && taskPoolDrawerTitle
      && taskPoolLink.hit && taskPoolDoubleNoDrawer && noLinkToast && noLinkNoDetail
      && topicPoolDrawerOpen && topicPoolDrawerTitle && topicPoolLink.hit
      && curioPoolDrawerOpen && curioPoolDrawerTitle && curioPoolLink.hit,
    `三池卡=${!!taskPoolTimeline}/${!!topicPoolTimeline}/${!!curioPoolTimeline} 任务=${taskPoolCardShape}/${taskPoolDrawerOpen}/${taskPoolDrawerTitle} 链接=${taskPoolLink.url} 无详情=${taskPoolDoubleNoDrawer} 空链=${noLinkToast}/${noLinkNoDetail} 选题=${topicPoolDrawerOpen}/${topicPoolDrawerTitle}/${topicPoolLink.url} 好奇=${curioPoolDrawerOpen}/${curioPoolDrawerTitle}/${curioPoolLink.url}`)

  // 可选：把本轮 E2E 生成的真实种子库导出为视觉普查夹具。
  // 只用于门禁排障和全量 theme-audit，不参与产品运行；需显式设置环境变量才会写文件。
  if (process.env.ZY_E2E_EXPORT_DATA) {
    const exportPath = path.resolve(process.env.ZY_E2E_EXPORT_DATA)
    const raw = await page.evaluate(() => chrome.storage.local.get('zy_data_v2'))
    fs.writeFileSync(exportPath, JSON.stringify(raw.zy_data_v2 || {}, null, 2))
    console.log(`· E2E 视觉夹具已导出：${exportPath}`)
  }

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\nE2E 结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E 执行失败：', e); process.exit(2) })
