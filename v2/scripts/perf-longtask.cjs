/**
 * R56-PERF-a/f · 长任务打点（Playwright MV3）
 * 场景：种入大库数据（400 资源 / 200 任务 / 80 好奇 / 12 镜像源卡+投射），
 *       在 home（/）、compass（/compass）、curation（/curation）三路由采集：
 *       - PerformanceObserver longtask（>50ms）条数 / 总耗时 / 最差单帧
 *       - 交互段：策展分类切换 ×6 / 检索输入 / 三件事联动（长任务最容易聚集的路径）
 * 运行：node scripts/perf-longtask.cjs ｜ 结果打印 JSON（供交付说明前后对比）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const EXT_INDEX = 'src/newtab/index.html'

const OBSERVER_BOOTSTRAP = `
window.__longtasks = []
try {
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__longtasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration), name: e.name })
    }
  })
  po.observe({ entryTypes: ['longtask'] })
} catch (err) { window.__longtasks = [{ start: 0, dur: 0, name: 'observer-failed:' + err.message }] }
`
function summarize(tasks) {
  const total = tasks.reduce((a, t) => a + t.dur, 0)
  const worst = tasks.reduce((a, t) => Math.max(a, t.dur), 0)
  return { count: tasks.length, totalMs: total, worstMs: worst }
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // ---- 种入大库数据（模拟重度用户的量级）----
  await page.evaluate(() => new Promise((resolve) => {
    chrome.storage.local.get('zy_data_v2').then(({ ['zy_data_v2']: prev }) => {
      const d = prev && typeof prev === 'object' ? prev : { version: 2 }
      d.version = 2
      const wsId = 'perf-ws'
      d.workspaces = [{ id: wsId, name: '📦 压测工作台', icon: '📦', order: 0, archived: false, hotkey: undefined }]
      d.categories = Array.from({ length: 8 }, (_, i) => ({ id: `perf-cat-${i}`, workspaceId: wsId, name: `分类${i}`, order: i }))
      const now = Date.now()
      // 规模设定：镜像源分类 perf-cat-0 挂 400 张（未投射源卡垫后面），其余 1600 张散布 7 分类
      d.resources = Array.from({ length: 2000 }, (_, i) => ({
        id: `perf-res-${i}`, kind: 'resource', title: `压测资源卡${i} 性能长任务策展混排`,
        linkType: 'url', link: 'https://example.com/' + i, workspaceId: wsId,
        categoryId: i < 400 ? 'perf-cat-0' : `perf-cat-${1 + (i % 7)}`, tags: i % 3 === 0 ? ['压测'] : [], pinned: false,
        callCount: 0, customFields: {}, createdAt: now - i * 1000, updatedAt: now - i * 1000
      }))
      const dir = (d.compass && d.compass.directions && d.compass.directions[0]) || { id: 'perf-dir', name: '压测方向', status: 'active', projects: [] }
      dir.projects = (dir.projects || []).filter(p => p.id !== 'perf-proj')
      dir.projects.push({ id: 'perf-proj', name: '压测项目', isFocused: false, progress: 0, status: 'active', metrics: [{ id: 'perf-metric', title: '压测指标', taskIds: [] }] })
      d.compass = Object.assign({ vision: { content: '' }, mission: { content: '' }, directions: [dir] }, (d.compass && d.compass.vision) ? {} : {})
      d.compass.directions = [dir]
      d.tasks = Array.from({ length: 600 }, (_, i) => ({
        id: `perf-task-${i}`, kind: 'task', title: `压测任务${i}`, status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'doing' : 'todo',
        priority: 'medium', projectId: 'perf-proj', metricId: 'perf-metric',
        mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, createdAt: now - i * 2000, updatedAt: now - i * 2000
      }))
      d.curiosities = Array.from({ length: 120 }, (_, i) => ({
        id: `perf-cur-${i}`, kind: 'curiosity', question: `压测好奇心${i}`, status: 'todo',
        tags: [], pinned: false, createdAt: now - i * 3000, updatedAt: now - i * 3000
      }))
      // 策展中心：1 个原生分类 + 1 个镜像分类（源=压测分类0）+ 60 投射
      d.categories.push({ id: 'perf-ccat', workspaceId: 'CURATION', name: '压测策展分类', order: 0 })
      d.categories.push({ id: 'perf-cmirror', workspaceId: 'CURATION', name: '压测镜像分类', order: 1, curFrom: { wsId, catId: 'perf-cat-0', projId: 'perf-proj' } })
      d.resources.push(...Array.from({ length: 40 }, (_, i) => ({
        id: `perf-curres-${i}`, kind: 'resource', title: `策展原生卡${i}`, linkType: 'url', link: 'https://example.com/cur' + i,
        workspaceId: 'CURATION', categoryId: 'perf-ccat', tags: [], pinned: false, callCount: 0,
        customFields: {}, createdAt: now - i * 1000, updatedAt: now, curOrder: i
      })))
      d.curationProjections = Array.from({ length: 300 }, (_, i) => ({
        id: `perf-curp-${i}`, kind: 'card', wsId, cardId: `perf-res-${i}`, catId: `perf-cat-${i % 8}`,
        targetCatId: 'perf-ccat', addedAt: now - i * 1000
      }))
      chrome.storage.local.set({ ['zy_data_v2']: d }).then(resolve)
    })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const report = { routes: {} }
  await page.addInitScript(OBSERVER_BOOTSTRAP) // 每次导航/刷新都会重跑，注册一次即可

  async function sampleRoute(name, hash, interactions) {
    await page.goto(base + hash, { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2800) // 挂载稳定 + 观察空闲段
    const idle = summarize(await page.evaluate(() => window.__longtasks.splice(0)))
    await interactions()
    await page.waitForTimeout(700)
    const act = summarize(await page.evaluate(() => window.__longtasks.splice(0)))
    report.routes[name] = { idleLongTasks: idle, interactionLongTasks: act }
  }

  // home：三件事单击联动 + 项目调度 4 指标下钻开关（P1 恢复后的路径）
  await sampleRoute('home', '#/', async () => {
    for (let i = 0; i < 4; i++) { await page.evaluate(() => { const el = document.querySelectorAll('.today-card')[0]; if (el) el.click() }).catch(() => {}); await page.waitForTimeout(120) }
    await page.evaluate(() => { const el = document.querySelector('.cur-stats-v2 .csv-cell'); if (el) el.click() }).catch(() => {})
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
  })

  // compass：任务管理筛选/搜索（TaskManagerPanel 渲染最重的方向台段）
  await sampleRoute('compass', '#/compass', async () => {
    for (const kw of ['压测', '任务1', '任务2', '0']) {
      await page.fill('.tm-search input, input[type="text"], input[type="search"]', kw).catch(() => {})
      await page.waitForTimeout(200)
    }
  })

  // curation：镜像分类混排（PERF-b 修复面）——分类切换 ×6 + 单击详情
  await sampleRoute('curation', '#/curation', async () => {
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.cat-item')]
        const mirror = nodes.find(n => n.textContent.includes('压测镜像分类')) || nodes[3]
        if (mirror) mirror.click()
      }).catch(() => {})
      await page.waitForTimeout(150)
      await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.cat-item')]
        const plain = nodes.find(n => n.textContent.includes('压测策展分类')) || nodes[2]
        if (plain) plain.click()
      }).catch(() => {})
      await page.waitForTimeout(150)
    }
  })

  console.log(JSON.stringify(report, null, 2))
  const outPath = process.env.PERF_OUT || ''
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  await ctx.close()
}

main().catch((e) => { console.error('perf 打点失败：', e); process.exit(2) })
