/** R120 批次B 视觉截图：调度台在 1440/1080 × 深色(默认)/浅色(notion) 四张 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const os = require('os')

async function main() {
  const dist = path.resolve(__dirname, '..', 'dist')
  const outDir = path.resolve(__dirname, '..', '.r120-shots')
  fs.mkdirSync(outDir, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r120b-'))
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    executablePath: path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe'),
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    viewport: { width: 1440, height: 980 }
  })
  let [sw] = ctx.serviceWorkers()
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const base = `chrome-extension://${new URL(sw.url()).host}/src/newtab/index.html`
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 种演示数据：2 个主攻项目（一个带进度/指标/任务）、战略目标、好奇、资源
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    const now = Date.now()
    const wsId = d.workspaces[0].id
    d.compass = d.compass || { vision: { content: '', pinnedToLighthouse: false, updatedAt: now }, mission: { content: '', pinnedToLighthouse: false, updatedAt: now }, directions: [] }
    d.compass.directions = (d.compass.directions || []).filter((x) => x.id !== 'shot-dir')
    d.compass.directions.push({
      id: 'shot-dir', name: 'AI知识管理+内容生产专家', status: 'active', term: 'mid', projects: [
        { id: 'shot-p1', name: 'workbuddy培训项目', isFocused: true, pinnedToLighthouse: true, progress: 33, status: 'active', metrics: [{ id: 'shot-m1', title: '教程文章20篇', target: '20', acceptance: '', taskIds: ['shot-t1', 'shot-t2', 'shot-t3'] }, { id: 'shot-m2', title: '课程产品研发', target: '', acceptance: '', taskIds: ['shot-t4'] }] },
        { id: 'shot-p2', name: '武汉地区教育政策研究', isFocused: true, pinnedToLighthouse: true, progress: 100, status: 'done', metrics: [] }
      ]
    })
    d.tasks = (d.tasks || []).filter((t) => !String(t.id).startsWith('shot-t'))
    d.tasks.push(
      { id: 'shot-t1', kind: 'task', title: 'AI Agent概念梳理，构建认知基础', status: 'doing', priority: 'high', projectId: 'shot-p1', metricId: 'shot-m1', tags: ['培训'], mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, createdAt: now - 86400000, updatedAt: now - 3600000 },
      { id: 'shot-t2', kind: 'task', title: '用workbuddy解决职场办公的100个方案', status: 'todo', priority: 'medium', projectId: 'shot-p1', metricId: 'shot-m1', tags: ['培训'], mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, createdAt: now - 172800000, updatedAt: now - 7200000 },
      { id: 'shot-t3', kind: 'task', title: '研究workbuddy核心功能架构', status: 'todo', priority: 'medium', projectId: 'shot-p1', metricId: 'shot-m1', tags: [], mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, createdAt: now - 259200000, updatedAt: now - 10800000 },
      { id: 'shot-t4', kind: 'task', title: '搭建课程产品V1.0', status: 'todo', priority: 'low', projectId: 'shot-p1', metricId: 'shot-m2', tags: [], mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, createdAt: now - 300000000, updatedAt: now - 9000000 }
    )
    // 今日三件事 = 3 槽
    const day = new Date(); const k = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0')
    d.dailyFocus = d.dailyFocus || {}
    d.dailyFocus[k] = [
      { id: 'shot-f1', sourceType: 'task', sourceId: 'shot-t1', text: 'AI Agent概念梳理，构建认知基础', done: false },
      { id: 'shot-f2', sourceType: 'task', sourceId: 'shot-t2', text: '用workbuddy解决职场办公的100个方案', done: false },
      { id: 'shot-f3', sourceType: 'task', sourceId: 'shot-t3', text: '研究workbuddy核心功能架构', done: false }
    ]
    d.resources = (d.resources || []).filter((r) => !String(r.id).startsWith('shot-r'))
    d.resources.push({ id: 'shot-r1', kind: 'resource', title: 'openCode 官方文档', linkType: 'url', link: 'https://opencode.ai/docs', workspaceId: wsId, categoryId: '', tags: [], pinned: false, callCount: 11, lastCalledAt: now - 600000, customFields: {}, createdAt: now - 500000000, updatedAt: now - 600000 })
    d.curiosities = (d.curiosities || []).filter((c) => !String(c.id).startsWith('shot-c'))
    d.curiosities.push({ id: 'shot-c1', kind: 'curiosity', question: 'AI Agent 与工作流的边界在哪？', status: 'doing', pinned: false, relatedResourceIds: [], customFields: {}, createdAt: now - 400000000, updatedAt: now - 800000 })
    return chrome.storage.local.set({ zy_data_v2: d })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => { location.hash = '#/' })
  await page.waitForTimeout(2000)

  const shoot = async (name) => {
    await page.screenshot({ path: path.join(outDir, name) })
    console.log('  已截图', name)
  }
  await shoot('01-dark-1440.png')

  // 浅色主题（notion = 纸墨白）
  await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_ui_v2').then((c) => {
      const ui = c['zy_ui_v2'] || {}
      ui.theme = 'notion'
      chrome.storage.local.set({ zy_ui_v2: ui }).then(() => res(true))
    })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await shoot('02-light-1440.png')

  // 1080 断点（浅色）
  await page.setViewportSize({ width: 1080, height: 980 })
  await page.waitForTimeout(1200)
  await shoot('03-light-1080.png')

  // 回深色 1080
  await page.evaluate(() => new Promise((res) => {
    chrome.storage.local.get('zy_ui_v2').then((c) => {
      const ui = c['zy_ui_v2'] || {}; ui.theme = 'green'
      chrome.storage.local.set({ zy_ui_v2: ui }).then(() => res(true))
    })
  }))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await shoot('04-dark-1080.png')

  await ctx.close()
  console.log('\n截图目录:', outDir)
}
main().catch((e) => { console.error(e); process.exit(2) })
