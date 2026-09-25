#!/usr/bin/env node
/**
 * R168：DOM 账 + 逐动作长任务账（性能盘点的量具，与 perf.cjs 互补）
 *
 * 为什么另立一个量具：perf.cjs 的指标是"耗时"，而耗时在开发机上被环境负载支配（R167 连采三批散布
 * 2.8~5.3 倍，中位完全不可用）。本脚本量的是**两件不受 CPU 噪声影响的事**：
 *   ① 每一步的 **DOM 节点增量**（含常驻浮层、卡片内节点、svg、`<option>` 数）；
 *   ② 每一步的 **长任务清单**（PerformanceObserver 在动作之前装好——装在之后就会报"无"，这是本脚本
 *      第一版自己的错，写在这里当反面教材）。
 * 优化是否有效，先看这两项；ms 只在同批交错 A/B 且散布 ≤2 倍时才拿来下结论（06-2 §B 通则）。
 *
 * 用法：
 *   node scripts/perf-census.cjs --real=<知源导出JSON>            # 真实库（推荐，规模才有意义）
 *   node scripts/perf-census.cjs --real=... --dist=<扩展包目录>    # A/B 时指向基线包
 *   可选：--steps=deck,kanban,drawer,search  只跑关心的几步
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { chromium } = require('playwright-core')

const argv = process.argv.slice(2)
const REAL_ARG = argv.find(a => a.startsWith('--real='))
const DIST_ARG = argv.find(a => a.startsWith('--dist='))
const PKG = DIST_ARG ? DIST_ARG.split('=')[1] : path.resolve(__dirname, '..', 'dist')
if (!fs.existsSync(path.join(PKG, 'manifest.json'))) { console.error('✗ 不是有效扩展包：' + PKG); process.exit(1) }
if (!REAL_ARG) { console.error('✗ 必须给 --real=<导出的知源备份 JSON>（规模不真实的盘点没有意义；medium 档合成库只有 3 个分类列，看不出看板问题）'); process.exit(1) }
const REAL = REAL_ARG.split('=')[1]
if (!fs.existsSync(REAL)) { console.error('✗ --real 文件不存在：' + REAL); process.exit(1) }
const ONLY = (argv.find(a => a.startsWith('--steps=')) || '--steps=').split('=')[1].split(',').filter(Boolean)
const want = (s) => !ONLY.length || ONLY.includes(s)

/* 浏览器四级回落（与 e2e/perf 同口径：本机没钉某个版本不是跳过门禁的理由） */
const CHROME = (() => {
  const pinned = process.platform === 'darwin'
    ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
    : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
  if (process.env.ZY_CHROME && fs.existsSync(process.env.ZY_CHROME)) return process.env.ZY_CHROME
  if (fs.existsSync(pinned)) return pinned
  const roots = process.platform === 'darwin'
    ? [path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')]
    : [path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright')]
  for (const root of roots) {
    try {
      const hit = fs.readdirSync(root).filter(x => /^chromium-\d+$/.test(x)).sort().pop()
      if (!hit) continue
      const cand = process.platform === 'darwin'
        ? path.join(root, hit, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
        : path.join(root, hit, 'chrome-win64', 'chrome.exe')
      if (fs.existsSync(cand)) return cand
    } catch (e) { /* 换下一个根 */ }
  }
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (process.platform === 'darwin' && fs.existsSync(sys)) return sys
  console.error('✗ 找不到可用 Chromium（ZY_CHROME / ms-playwright / 系统 Chrome 全部落空）'); process.exit(1)
})()

const raw = JSON.parse(fs.readFileSync(REAL, 'utf8'))
const data = raw.zy_data_v2 || raw
if (!Array.isArray(data.resources)) { console.error('✗ --real 文件不是知源备份 JSON（缺 resources 数组）'); process.exit(1) }

/** 区域账：`sum` 数子树节点，`q` 数个数。常驻浮层单独列——它是最容易被忽略的"每次进台面都摊"的成本 */
const CENSUS = () => {
  const sum = (sel) => [...document.querySelectorAll(sel)].reduce((s, e) => s + e.querySelectorAll('*').length, 0)
  const q = (sel) => document.querySelectorAll(sel).length
  return {
    all: q('*'),
    卡: q('.res-card'), 卡内节点: sum('.res-card'),
    左树项: q('.cat-item'), 左树节点: sum('.ws-sidebar'),
    svg: q('svg'), use: q('use'), option: q('option'), select: q('select'),
    常驻抽屉节点: sum('.ws-page > .drawer'), 常驻modal节点: sum('.modal-overlay'), 浮层壳: q('.overlay,.modal-overlay,.drawer'),
  }
}

;(async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, viewport: { width: 1440, height: 900 }, executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${PKG}`, `--load-extension=${PKG}`, '--hide-scrollbars']
  })
  let [w] = ctx.serviceWorkers(); if (!w) w = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(w.url()).host
  const base = `chrome-extension://${extId}/src/newtab/index.html`
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  const ver = JSON.parse(fs.readFileSync(path.join(PKG, 'manifest.json'), 'utf8')).version
  console.log(`被测包 ${PKG} · manifest.version=${ver}`)
  console.log(`真库：资源 ${(data.resources || []).filter(r => !r.deletedAt).length}/${(data.resources || []).length} · 任务 ${(data.tasks || []).length} · 好奇 ${(data.curiosities || []).length} · 台 ${(data.workspaces || []).length} · 分类 ${(data.categories || []).length}`)

  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000)
  await page.evaluate((d) => chrome.storage.local.set({ zy_data_v2: d }), data)
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000)
  /* ★ 长任务观察器必须在动作之前装好（装在之后 ⇒ 报"无长任务"，是探针自己的错） */
  await page.evaluate(() => {
    window.__lt = []
    new PerformanceObserver(l => window.__lt.push(...l.getEntries().map(e => Math.round(e.duration)))).observe({ entryTypes: ['longtask'] })
  })
  const boards = (data.workspaces || []).filter(x => x.id !== 'zy-curation' && !x.archived).slice(0, 2)

  async function step(tag, key, go, settle = 2600) {
    if (key && !want(key)) return
    await page.evaluate(() => { window.__lt.length = 0 })
    const before = await page.evaluate(CENSUS)
    const t = Date.now()
    await go()
    await page.waitForTimeout(settle)
    const wall = Date.now() - t
    const after = await page.evaluate(CENSUS)
    const lt = await page.evaluate(() => window.__lt.slice())
    console.log(`\n【${tag}】墙钟 ${wall}ms · 长任务 ${lt.length} 个 [${lt.join(',')}] · 阻塞合计 ${lt.reduce((s, x) => s + x, 0)}ms`)
    console.log(`   DOM ${before.all} → ${after.all}（${after.all - before.all >= 0 ? '+' : ''}${after.all - before.all}）`
      + ` · 卡 ${after.卡}(内 ${after.卡内节点}) · 左树 ${after.左树项}项/${after.左树节点}节点 · svg ${after.svg} · use ${after.use} · option ${after.option}/${after.select}个select`)
    console.log(`   常驻：抽屉 ${after.常驻抽屉节点} 节点 · modal ${after.常驻modal节点} 节点 · 浮层壳 ${after.浮层壳} 个`)
  }

  const goHome = () => page.evaluate(() => { location.hash = '#/' })
  const goHub = () => page.evaluate(() => { location.hash = '#/workspace/zy-curation' })
  await step('基线：调度台首页', 'home', async () => { await goHome() }, 1600)
  await step('冷挂资源台（首帧卡片视图）', 'deck', goHub)
  await step('回调度台', 'deck', async () => { await goHome() }, 1600)
  await step('再进资源台（keep-alive 复用）', 'deck', goHub)
  for (const b of boards) await step(`冷挂策展台「${String(b.name).slice(0, 12)}」`, 'deck', () => page.evaluate((id) => { location.hash = '#/workspace/' + id }, b.id))
  await step('切到看板视图', 'kanban', async () => { await goHub(); await page.waitForTimeout(1500); await page.locator('.view-tab', { hasText: '▤' }).first().click().catch(() => {}) }, 3000)
  await step('切回卡片视图', 'kanban', async () => { await page.locator('.view-tab', { hasText: '▦' }).first().click().catch(() => {}) }, 2000)
  await step('单击卡片开详情（内联抽屉）', 'drawer', async () => { await goHub(); await page.waitForTimeout(1500); await page.locator('.res-card').first().click().catch(() => {}) }, 1800)
  await step('关抽屉（卸载应回收节点）', 'drawer', async () => { await page.locator('.drawer-close, .dr-close').first().click().catch(() => {}) }, 1200)
  await step('Ctrl+K 全局检索 + 键入 5 字', 'search', async () => { await goHub(); await page.waitForTimeout(1500); await page.keyboard.press('Control+k'); await page.waitForTimeout(420); await page.keyboard.type('知识库', { delay: 25 }) }, 1500)
  await ctx.close()
})().catch(e => { console.error('census 失败：', e); process.exit(1) })
