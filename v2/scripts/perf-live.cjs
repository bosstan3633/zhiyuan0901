/**
 * R106-F5 / R107：生产级真机性能实测脚本（Playwright + 加载本扩展）。
 *
 * 用法：
 *   1. 任意目录 `npm i playwright` 并 `npx playwright install chromium --no-shell`（扩展需完整 Chromium）
 *   2. 修改下方 EXT 指向安装包/构建产物目录（默认 v2/dist）
 *   3. `node scripts/perf-live.cjs`
 *
 * 基线数据（2026-09-12 · V2.76.0 · 合成数据 800 资源卡 + 200 任务 + 40 分类 + 100 好奇）：
 *   冷加载（reload→load→可交互）：843ms（MV3 固有成本，与 R71 基线 806ms 一致，无回归）
 *   路由切换 调度台→方向台 / →资源台：中位 32ms（首进 300-500ms 为会话内首次编译+挂载）
 *   应用内搜索浮层打开：中位 32ms
 *   搜索键入一字符（含 60ms 防抖+检索+渲染）：中位 122ms
 *   网页采集浮层（快捷键→可见）：~90ms
 *   网页搜索浮层（快捷键→可见）：~67ms
 * 结论：关键操作全部 <130ms；用户反馈的卡顿应主要来自 V2.75.0 之前（缓存 TTL 1.5s 整库重读）
 *   与冷加载固有成本。若 V2.76.0 仍有体感卡顿，用本脚本灌用户真实数据导出后定点分析。
 */

/* R106-F5 性能实测：加载扩展 → 灌生产级数据 → 计时关键操作 */
const { chromium } = require('playwright')
const path = require('path')

const EXT = '/Users/beantan/Downloads/zhiyuan0904/v2/dist'
const EXEC = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
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
    headless: true,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run'
    ]
  })
  // R106-F5：未打包扩展 id = sha256(绝对路径) 前 32 位 hex 映射 a-p（确定性，不依赖 SW 事件）
  const crypto = require('crypto')
  const abs = require('fs').realpathSync(EXT)
  const extId = crypto.createHash('sha256').update(abs).digest('hex').slice(0, 32).split('').map(c => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('')
  console.log('扩展 id（按路径推导）:', extId)

  const page = await ctx.newPage()
  await page.goto(`chrome-extension://${extId}/src/newtab/index.html`).catch(async e => {
    console.error('新标签页打开失败——扩展可能未加载:', e.message.split('\n')[0]); process.exit(1)
  })
  try { await page.waitForSelector('.topbar', { timeout: 8000 }) } catch (e) { console.error('FAILED: 8s 内未见 .topbar——扩展未正常加载'); process.exit(1) }
  console.log('扩展页面加载 OK（.topbar 在）')
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

  // 1) 冷加载（整页导航 → load 事件，外部计时）
  {
    const t0 = Date.now()
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.topbar', { timeout: 8000 })
    console.log(`冷加载（reload→load→topbar 可交互）: ${Date.now() - t0}ms`)
  }

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
