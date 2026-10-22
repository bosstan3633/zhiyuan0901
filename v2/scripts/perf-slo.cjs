#!/usr/bin/env node
/**
 * 知源本地性能 SLO 采样。
 *
 * 真实加载 dist 扩展，用 Playwright 驱动六类高频路径，输出 P50/P95 与预算判定。
 * 不读取历史报告、不生成模拟样本；任一采样失败或 P95 超预算，退出码为 1。
 *
 * 用法：
 *   node scripts/perf-slo.cjs
 *   node scripts/perf-slo.cjs --dist=/path/to/dist
 *
 * 产物：
 *   docs/perf-slo/latest.json
 *   docs/perf-slo/latest.md
 */
'use strict'

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { chromium } = require('playwright-core')
const { CHROME, swReady } = require('./browser.cjs')

const ROOT = path.resolve(__dirname, '..')
const argv = process.argv.slice(2)
const distArg = argv.find((arg) => arg.startsWith('--dist='))
const DIST = distArg ? path.resolve(distArg.slice('--dist='.length)) : path.join(ROOT, 'dist')
const OUT_DIR = path.join(ROOT, 'docs', 'perf-slo')
const EXT_INDEX = 'src/newtab/index.html'
const SAMPLE_COUNT = 5
const IMAGE_SAMPLE_COUNT = 3

const BUDGETS = {
  overlay_open: 800,
  cmdk_first_open: 1500,
  search_type: 400,
  page_switch: 800,
  share_drawer: 1000,
  long_image: 4000,
}

const LABELS = {
  overlay_open: '网页浮层唤起',
  cmdk_first_open: '⌘K / Ctrl+K 首屏',
  search_type: '搜索键入到结果更新',
  page_switch: '调度台 / 方向台切换',
  share_drawer: '分享抽屉打开',
  long_image: '高清长图生成完成',
}

function ensureDist() {
  const manifestFile = path.join(DIST, 'manifest.json')
  if (!fs.existsSync(manifestFile)) throw new Error(`不是有效扩展包：${DIST}`)
  return JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
}

function round(value, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function percentile(samples, p) {
  if (!samples.length) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil(p * sorted.length))
  return round(sorted[rank - 1])
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildMetric(key, samples, notes, error) {
  const clean = samples.filter((value) => Number.isFinite(value) && value >= 0).map((value) => round(value))
  const p50 = percentile(clean, 0.5)
  const p95 = percentile(clean, 0.95)
  const budget = BUDGETS[key]
  return {
    key,
    label: LABELS[key],
    unit: 'ms',
    samples: clean,
    sampleCount: clean.length,
    p50,
    p95,
    budgetP95: budget,
    pass: !error && clean.length > 0 && p95 != null && p95 <= budget,
    notes: notes || [],
    error: error || null,
  }
}

function markdown(report) {
  const rows = Object.values(report.metrics).map((metric) => {
    const status = metric.pass ? 'PASS' : 'FAIL'
    return `| ${metric.label} | ${metric.sampleCount} | ${metric.p50 ?? '-'} | ${metric.p95 ?? '-'} | ${metric.budgetP95} | ${status} |`
  })
  const failures = report.failures.length
    ? report.failures.map((item) => `- ${item}`).join('\n')
    : '- 无'
  return `# 知源性能 SLO · 最新实测

> 生成时间：${report.generatedAt}
> 采样方式：真实 Chromium 加载 \`${report.dist}\`，Playwright 驱动，不使用历史读数或模拟数据。
> 构建版本：\`${report.manifestVersion}\`
> 总体判定：**${report.overallPass ? 'PASS' : 'FAIL'}**

| 路径 | 样本数 | P50 (ms) | P95 (ms) | P95 预算 (ms) | 判定 |
|---|---:|---:|---:|---:|---|
${rows.join('\n')}

## 失败项

${failures}

## 说明

- 计时从真实用户入口触发开始，到目标 UI 可消费（浮层输入框、搜索首屏、结果更新、目标页根节点、分享抽屉、长图完成信号）为止。
- 样本为本机实际观测值；P50/P95 使用升序样本的最近秩计算。
- 任一采样报错或 P95 超预算，脚本以非零退出码结束。
`
}

async function waitForContentChange(page, selector, previousText, timeout = 6000) {
  return page.evaluate(async ({ selector, previousText, timeout }) => {
    const root = document.querySelector(selector)
    if (!root) return { ok: false, reason: '结果容器不存在' }
    const deadline = performance.now() + timeout
    return await new Promise((resolve) => {
      let done = false
      const finish = (value) => {
        if (done) return
        done = true
        observer.disconnect()
        resolve(value)
      }
      const check = () => {
        if ((root.textContent || '') !== previousText) finish({ ok: true })
        else if (performance.now() >= deadline) finish({ ok: false, reason: '结果未更新' })
      }
      const observer = new MutationObserver(check)
      observer.observe(root, { childList: true, subtree: true, characterData: true })
      check()
    })
  }, { selector, previousText, timeout })
}

async function waitForText(page, selector, pattern, timeout = 20000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const matched = await page.evaluate(
      ({ selector, source, flags }) => {
        const node = document.querySelector(selector)
        return !!node && new RegExp(source, flags).test(node.textContent || '')
      },
      { selector, source: pattern.source, flags: pattern.flags },
    )
    if (matched) return
    await sleep(50)
  }
  throw new Error(`等待文案超时：${selector} ${pattern}`)
}

async function seedPerfBoard(page) {
  return page.evaluate(async () => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    const data = raw.zy_data_v2
    if (!data) throw new Error('主数据尚未初始化')

    const now = Date.now()
    const boardId = 'perf-slo-board'
    const catIds = ['perf-slo-l2', 'perf-slo-l3', 'perf-slo-l4']
    if (!data.workspaces.some((item) => item.id === boardId)) {
      data.workspaces.push({
        id: boardId,
        name: '性能验收策展台',
        icon: '⏱',
        color: '#3A6B4C',
        coverTheme: 'deep-sea',
        desc: '性能 SLO 脚本夹具',
        order: 999,
        archived: false,
        kind: 'curation',
      })
    }

    data.categories = (data.categories || []).filter((item) => item.workspaceId !== boardId)
    data.categories.push(
      { id: catIds[0], workspaceId: boardId, name: '核心判断', description: '第一论证层', order: 0 },
      { id: catIds[1], workspaceId: boardId, name: '证据展开', description: '第二论证层', parentId: catIds[0], order: 0 },
      { id: catIds[2], workspaceId: boardId, name: '案例与边界', description: '第三论证层', parentId: catIds[1], order: 0 },
    )

    data.resources = (data.resources || []).filter((item) => item.workspaceId !== boardId)
    data.resources.push({
      id: 'perf-slo-thesis',
      kind: 'resource',
      title: '知识工作的瓶颈正在从生产转向调度',
      description: '性能夹具中心论点：在正确时刻调回正确信息，比继续生产更多内容更重要。',
      linkType: 'url',
      link: 'https://example.com/perf-thesis',
      workspaceId: boardId,
      categoryId: '',
      tags: ['性能', '知识库'],
      pinned: false,
      callCount: 0,
      customFields: {},
      createdAt: now,
      updatedAt: now,
      isThesis: true,
    })

    for (let index = 0; index < 18; index++) {
      data.resources.push({
        id: `perf-slo-res-${index}`,
        kind: 'resource',
        title: index % 3 === 0 ? `知识库证据 ${index}` : `论证材料 ${index}`,
        description: `用于真实性能采样的资源卡 ${index}`,
        linkType: 'url',
        link: `https://example.com/perf/${index}`,
        workspaceId: boardId,
        categoryId: catIds[index % catIds.length],
        tags: ['性能', '论证'],
        pinned: false,
        callCount: 0,
        customFields: {},
        createdAt: now - index * 1000,
        updatedAt: now - index * 1000,
        assets: index % 6 === 0
          ? [{ id: `perf-asset-${index}`, kind: 'pdf', name: `证据-${index}.pdf`, size: 1024 * (index + 1), mime: 'application/pdf', createdAt: now }]
          : [],
      })
    }

    await chrome.storage.local.set({ zy_data_v2: data })
    return { boardId, resourceCount: 19, categoryCount: 3 }
  })
}

async function main() {
  const manifest = ensureDist()
  if (!fs.existsSync(CHROME)) throw new Error(`Chromium 不存在：${CHROME}`)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'real-local-browser',
    dist: DIST,
    manifestVersion: manifest.version,
    chrome: CHROME,
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    host: os.hostname(),
    budgets: BUDGETS,
    metrics: {},
    failures: [],
    overallPass: false,
  }

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: { width: 1440, height: 900 },
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--hide-scrollbars',
    ],
  })

  let overlayServer = null
  try {
    let [worker] = ctx.serviceWorkers()
    if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
    const loaded = await swReady(worker)
    report.manifestVersion = loaded.version
    const extId = new URL(worker.url()).host
    const base = `chrome-extension://${extId}/${EXT_INDEX}`
    const page = await ctx.newPage()
    page.setDefaultTimeout(20000)

    await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.page .desk-head', { timeout: 20000 })
    const seeded = await seedPerfBoard(page)
    report.fixture = seeded
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.page .desk-head', { timeout: 20000 })

    // 1) 网页浮层唤起：真实宿主页 + content script + background 消息。
    overlayServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><title>perf-slo-host</title><main><h1>知源性能采样宿主页</h1></main>')
    })
    await new Promise((resolve) => overlayServer.listen(0, '127.0.0.1', resolve))
    const port = overlayServer.address().port
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
    await sleep(1200)

    const overlaySamples = []
    let overlayError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        const start = Date.now()
        await worker.evaluate(async ({ port }) => {
          const tabs = await chrome.tabs.query({ url: `http://127.0.0.1:${port}/*` })
          if (!tabs[0]?.id) throw new Error('宿主页 tab 未找到')
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-search' })
        }, { port })
        await page.waitForSelector('#__zy_si__', { timeout: 8000 })
        overlaySamples.push(Date.now() - start)
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => !document.querySelector('#__zy_si__'), null, { timeout: 5000 })
        await sleep(120)
      }
    } catch (error) {
      overlayError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.overlay_open = buildMetric(
      'overlay_open',
      overlaySamples,
      ['从 background 发出 zy-open-search 到宿主页搜索输入框出现；包含 content UI 就绪。'],
      overlayError,
    )

    // 2) ⌘K 首屏：每次整页重载后首次打开，避免把已挂载组件当成"首屏"。
    const cmdkSamples = []
    let cmdkError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.page .desk-head', { timeout: 20000 })
        await sleep(250)
        const start = Date.now()
        await page.locator('.icon-btn[title*="全局搜索"]').first().click()
        await page.waitForSelector('.gp-overlay.open .gp-results', { timeout: 12000 })
        cmdkSamples.push(Date.now() - start)
        await page.keyboard.press('Escape')
        await page.waitForSelector('.gp-overlay.open', { state: 'detached', timeout: 5000 }).catch(() => {})
      }
    } catch (error) {
      cmdkError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.cmdk_first_open = buildMetric(
      'cmdk_first_open',
      cmdkSamples,
      ['每个样本都从整页重载后的首次打开计时，计到检索面板与结果容器出现。'],
      cmdkError,
    )

    // 3) 搜索键入：从最后按键派发到结果区域真实变化。
    await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.page .desk-head', { timeout: 20000 })
    await page.locator('.icon-btn[title*="全局搜索"]').first().click()
    await page.waitForSelector('.gp-overlay.open .gp-search-input', { timeout: 12000 })
    const typeSamples = []
    let typeError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.locator('.gp-search-input').fill('')
        await sleep(180)
        const started = await page.evaluate(() => {
          const input = document.querySelector('.gp-search-input')
          const results = document.querySelector('.gp-results')
          if (!(input instanceof HTMLInputElement) || !results) return null
          window.__perfSloSearch = {
            previousText: results.textContent || '',
            startedAt: performance.now(),
          }
          input.value = '知识库'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          return window.__perfSloSearch.startedAt
        })
        if (started == null) throw new Error('搜索输入框或结果容器不存在')
        const changed = await waitForContentChange(
          page,
          '.gp-results',
          await page.evaluate(() => window.__perfSloSearch.previousText),
        )
        if (!changed.ok) throw new Error(changed.reason || '搜索结果没有更新')
        typeSamples.push(await page.evaluate(() => performance.now() - window.__perfSloSearch.startedAt))
      }
    } catch (error) {
      typeError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.search_type = buildMetric(
      'search_type',
      typeSamples,
      ['从最终查询词触发 input 到 .gp-results 实际发生 DOM 更新；包含 120ms 输入防抖与 Vue 渲染。'],
      typeError,
    )
    await page.keyboard.press('Escape').catch(() => {})

    // 4) 页面切换：调度台 ↔ 方向台，KeepAlive 热切换。
    const switchSamples = []
    let switchError = ''
    try {
      await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.page .desk-head', { timeout: 12000 })
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        let start = Date.now()
        await page.locator('.tabs .tab').filter({ hasText: '方向台' }).first().click()
        await page.waitForSelector('.compass-layout', { timeout: 10000 })
        switchSamples.push(Date.now() - start)

        start = Date.now()
        await page.locator('.tabs .tab').filter({ hasText: '调度台' }).first().click()
        await page.waitForSelector('.page .desk-head', { timeout: 10000 })
        switchSamples.push(Date.now() - start)
      }
    } catch (error) {
      switchError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.page_switch = buildMetric(
      'page_switch',
      switchSamples,
      ['每轮记录两次真实导航：调度台→方向台、方向台→调度台；计到目标页根节点出现。'],
      switchError,
    )

    // 5) 分享抽屉：真实进入夹具策展台，点击「分享成果」，等到原生预览纸面可见。
    const boardId = seeded.boardId
    const drawerSamples = []
    let drawerError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.goto(base + `#/workspace/${boardId}`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.share-action', { timeout: 15000 })
        const start = Date.now()
        await page.locator('.share-action').first().click()
        await page.waitForSelector('.drawer .cs-paper', { state: 'visible', timeout: 12000 })
        drawerSamples.push(Date.now() - start)
        await page.locator('.drawer-close').first().click()
        await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
      }
    } catch (error) {
      drawerError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.share_drawer = buildMetric(
      'share_drawer',
      drawerSamples,
      ['从点击分享成果到分享抽屉内原生预览 .cs-paper 可见。'],
      drawerError,
    )

    // 6) 长图生成：同一真实抽屉的完整生成链，等到 imageDataUrl 已回填的状态文案。
    const imageSamples = []
    let imageError = ''
    try {
      for (let index = 0; index < IMAGE_SAMPLE_COUNT; index++) {
        await page.goto(base + `#/workspace/${boardId}`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.share-action', { timeout: 15000 })
        const start = Date.now()
        await page.locator('.share-action').first().click()
        await waitForText(page, '.cs-image-state small', /已嵌入分享 HTML/, 20000)
        imageSamples.push(Date.now() - start)
        await page.locator('.drawer-close').first().click()
        await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
      }
    } catch (error) {
      imageError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.long_image = buildMetric(
      'long_image',
      imageSamples,
      ['从点击分享成果到完整 PNG 数据 URL 已回填、界面显示「已嵌入分享 HTML」。'],
      imageError,
    )

    for (const metric of Object.values(report.metrics)) {
      if (metric.error) report.failures.push(`${metric.label}：${metric.error}`)
      else if (!metric.sampleCount) report.failures.push(`${metric.label}：没有有效样本`)
      else if (metric.p95 > metric.budgetP95) report.failures.push(`${metric.label}：P95 ${metric.p95}ms > ${metric.budgetP95}ms`)
    }
    report.overallPass = report.failures.length === 0
  } catch (error) {
    report.failures.push(`采样器异常：${error instanceof Error ? error.stack || error.message : String(error)}`)
    report.overallPass = false
  } finally {
    if (overlayServer) await new Promise((resolve) => overlayServer.close(resolve))
    await ctx.close().catch(() => {})
  }

  const json = JSON.stringify(report, null, 2)
  fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), json + '\n')
  fs.writeFileSync(path.join(OUT_DIR, 'latest.md'), markdown(report))

  console.log('== 知源性能 SLO · 真实本地采样 ==')
  console.log(`构建：${report.manifestVersion} · ${report.dist}`)
  for (const metric of Object.values(report.metrics)) {
    console.log(
      `${metric.pass ? 'PASS' : 'FAIL'}  ${metric.label} · n=${metric.sampleCount}`
      + ` · P50=${metric.p50 ?? '-'}ms · P95=${metric.p95 ?? '-'}ms · 预算=${metric.budgetP95}ms`,
    )
  }
  if (report.failures.length) {
    console.error('\n失败项：')
    for (const failure of report.failures) console.error(`- ${failure}`)
  }
  console.log(`\n报告：${path.join(OUT_DIR, 'latest.json')}`)
  console.log(`摘要：${path.join(OUT_DIR, 'latest.md')}`)
  console.log(`\n总体：${report.overallPass ? 'PASS' : 'FAIL'}`)
  // Chromium 的 crashpad pipe 在部分 macOS 环境不会随 ctx.close() 释放。
  // 报告已落盘后显式退出，避免 CI / 终端误判为“采样仍在运行”。
  process.exit(report.overallPass ? 0 : 1)
}

main().catch((error) => {
  console.error('perf-slo 执行失败：', error)
  process.exit(1)
})
