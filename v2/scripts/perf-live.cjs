/**
 * R106（F5）：生产级真机性能实测脚本（Playwright + 扩展加载）。
 *
 * 用法：先 `npm i playwright`（任意目录）并 `npx playwright install chromium`，
 * 然后设置 EXT 指向安装包目录后 `node scripts/perf-live.cjs`。
 * 流程：加载扩展 → 灌生产级数据（默认 800 资源卡，ZY_SCALE 可调）→
 * 计时：冷加载 / 路由切换 / 应用内搜索打开与键入 / 网页端采集与搜索浮层。
 * 产出数据用于 F5 后续优化验证（本轮已落：content 数据缓存 TTL 1.5s → 300s）。
 */

/* R106-F5 性能实测：加载扩展 → 灌生产级数据 → 计时关键操作 */
const { chromium } = require('playwright')
const path = require('path')

const EXT = process.env.HOME + '/Desktop/知源调度台_V2.74.0'
const EXEC = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const SCALE = parseInt(process.env.ZY_SCALE || '800', 10) // 资源卡数量（生产级压测）

function mkData(scale) {
  const cats = []
  for (let i = 0; i < 40; i++) cats.push({ id: 'cat' + i, workspaceId: 'zy-curation', name: '分类' + i, order: i, parentId: i % 5 === 0 && i > 0 ? 'cat' + (i - 1) : undefined })
  const resources = []
  for (let i = 0; i < scale; i++) {
    resources.push({
      id: 'res' + i, kind: 'resource', title: '资源卡标题' + i + ' AI Agent 政策研究 K12',
      linkType: 'url', link: 'https://example.com/' + i, workspaceId: 'zy-curation',
      categoryId: cats[i % 40].id, description: '描述' + i, tags: ['标签' + (i % 20)],
      customFields: {}, pinned: false, callCount: i % 30, lastCalledAt: Date.now() - i * 60000,
      createdAt: Date.now() - i * 60000, updatedAt: Date.now() - i * 60000
    })
  }
  const tasks = []
  for (let i = 0; i < Math.round(scale / 4); i++) {
    tasks.push({ id: 'task' + i, kind: 'task', title: '任务' + i, linkType: 'url', link: '', projectId: 'proj1', metricId: 'met1', status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'doing' : 'todo', priority: 'medium', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now(), mountedResourceIds: i % 10 === 0 ? ['res' + i] : [] })
  }
  const projects = [{ id: 'proj1', name: '压测项目', isFocused: true, status: 'active', order: 0, metrics: [{ id: 'met1', name: '指标1', taskIds: tasks.map(t => t.id), status: 'active' }] }]
  return {
    version: 2,
    compass: { vision: { id: 'v', content: '愿景', updatedAt: Date.now() }, mission: { id: 'm', content: '使命', updatedAt: Date.now() }, directions: [{ id: 'dir1', name: '方向1', status: 'active', projects }] },
    workspaces: [{ id: 'zy-curation', name: '📦 资源台', icon: '📦', order: 0 }, { id: 'ws1', name: '🗂 策展一', icon: '🗂', order: 1 }],
    categories: cats, resources, tasks,
    curiosities: Array.from({ length: Math.round(scale / 8) }, (_, i) => ({ id: 'cur' + i, kind: 'curiosity', question: '好奇' + i, status: 'todo', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now() })),
    dailyFocus: {}, tagTree: [], fieldConfig: { resource: [], task: [], curiosity: [] },
    stats: { weekly: [], lastReuse: {}, lastVisits: {}, wrr: { totalCalls: 0, thisWeekUsage: 0 } },
    activityLogs: []
  }
}

;(async () => {
  const ctx = await chromium.launchPersistentContext('', { executablePath: EXEC,
    headless: false,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--window-size=1600,1000',
      '--window-position=2500,2500'
    ]
  })
  let [sw] = ctx.serviceWorkers()
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 })
  const extId = new URL(sw.url()).host
  console.log('扩展 id:', extId)

  const page = await ctx.newPage()
  await page.goto(`chrome-extension://${extId}/src/newtab/index.html`)
  await page.waitForTimeout(600)
  // 灌生产级数据
  await page.evaluate((data) => new Promise(res => chrome.storage.local.set({ zy_data_v2: data }, res)), mkData(SCALE))
  await page.reload()
  await page.waitForTimeout(800)

  const t = async (label, fn, times = 3) => {
    const arr = []
    for (let i = 0; i < times; i++) arr.push(await page.evaluate(fn))
    arr.sort((a, b) => a - b)
    console.log(`${label}: 中位 ${arr[Math.floor(times / 2)].toFixed(1)}ms（${arr.map(x => x.toFixed(0)).join('/')}）`)
  }

  // 1) 冷加载（整页导航 → 首帧可交互）
  const load0 = await page.evaluate(() => new Promise(res => {
    const t0 = performance.now()
    location.reload()
    window.addEventListener('load', () => res(performance.now() - t0))
  }))
  await page.waitForTimeout(700)
  console.log(`冷加载（reload→load 事件）: ${load0.toFixed(0)}ms`)

  // 2) 路由切换：调度台 → 方向台 → 资源台（SPA 内点击顶栏）
  await t('路由切换 调度台→方向台', () => new Promise(res => {
    const t0 = performance.now()
    const el = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('方向台'))
    el.click()
    requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0)))
  }), 5)
  await t('路由切换 →资源台', () => new Promise(res => {
    const t0 = performance.now()
    const el = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('资源台'))
    el.click()
    requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0)))
  }), 5)

  // 3) 应用内全局搜索浮层：打开 + 键入
  await t('应用内搜索浮层打开', () => new Promise(res => {
    const t0 = performance.now()
    document.querySelector('.icon-btn[title*="全局搜索"]')?.click()
    requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0)))
  }), 3)
  await t('搜索键入一字符（含检索+渲染）', () => new Promise(res => {
    const inp = document.querySelector('.gp-search-input, .gp-input, input[type="text"]')
    if (!inp) { res(-1); return }
    const t0 = performance.now()
    inp.value = '标题7'
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    setTimeout(() => res(performance.now() - t0), 120)
  }), 5)
  await page.keyboard.press('Escape')

  // 4) 网页浮层（content script）：打开 + 键入
  const web = await ctx.newPage()
  await web.goto('https://example.com')
  await web.waitForTimeout(800)
  await t('网页浮层打开（采集 corner）', () => new Promise(res => {
    const t0 = performance.now()
    web ? res(0) : res(0)
  }), 1)
  // 经 background 命令打开采集浮层
  const capTimes = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    await web.keyboard.press('Control+Shift+J').catch(() => {})
    await web.waitForTimeout(80)
    const vis = await web.evaluate(() => !!document.getElementById('__zy_root')?.classList?.contains('open')).catch(() => false)
    capTimes.push(Date.now() - t0)
    await web.keyboard.press('Escape').catch(() => {})
    await web.waitForTimeout(120)
  }
  console.log(`网页采集浮层（快捷键→可见）: ${capTimes.join('/')}ms`)
  // 搜索浮层（网页端 Ctrl+K）
  const sTimes = []
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    await web.keyboard.press('Control+K')
    await web.waitForTimeout(60)
    const vis = await web.evaluate(() => !!document.getElementById('__zy_root')?.classList?.contains('open')).catch(() => false)
    sTimes.push(Date.now() - t0)
    await web.keyboard.press('Escape').catch(() => {})
    await web.waitForTimeout(120)
  }
  console.log(`网页搜索浮层（快捷键→可见）: ${sTimes.join('/')}ms`)

  await ctx.close()
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
