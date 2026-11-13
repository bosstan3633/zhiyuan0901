#!/usr/bin/env node
/**
 * 知源本地性能 SLO 采样。
 *
 * 真实加载 dist 扩展，用 Playwright 驱动十一类高频路径，输出 P50/P95 与预算判定。
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
const ALIGNMENT_VIEWPORTS = [1440, 1280, 1024, 768, 390]
const ALIGNMENT_TOLERANCE = 1

const BUDGETS = {
  overlay_open: 800,
  cmdk_first_open: 1500,
  search_type: 400,
  page_switch: 800,
  pool_switch: 800,
  pool_filter: 500,
  pool_detail: 1200,
  folder_drawer: 800,
  sync_changes_drawer: 1200,
  share_drawer: 1000,
  long_image: 4000,
}

const LABELS = {
  overlay_open: '网页浮层唤起',
  cmdk_first_open: '⌘K / Ctrl+K 首屏',
  search_type: '搜索键入到结果更新',
  page_switch: '调度台 / 方向台切换',
  pool_switch: '任务 / 好奇心 / 资源卡池切换',
  pool_filter: '卡池状态 / 标签筛选',
  pool_detail: '三卡池详情打开',
  folder_drawer: '资源常用夹抽屉打开',
  sync_changes_drawer: '同步内容明细抽屉',
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

function summarizeLongTasks(samples, supported) {
  const clean = samples.filter((value) => Number.isFinite(value) && value >= 0).map((value) => round(value))
  return {
    supported,
    sampleCount: clean.length,
    p95: percentile(clean, 0.95),
    max: clean.length ? Math.max(...clean) : 0,
    samples: clean,
  }
}

function buildMetric(key, samples, notes, error, longTasks = [], longTaskSupported = false) {
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
    longTasks: summarizeLongTasks(longTasks, longTaskSupported),
  }
}

function markdown(report) {
  const rows = Object.values(report.metrics).map((metric) => {
    const status = metric.pass ? 'PASS' : 'FAIL'
    const longTaskMax = metric.longTasks.supported ? metric.longTasks.max : '-'
    const longTaskCount = metric.longTasks.supported ? metric.longTasks.sampleCount : '-'
    return `| ${metric.label} | ${metric.sampleCount} | ${metric.p50 ?? '-'} | ${metric.p95 ?? '-'} | ${metric.budgetP95} | ${longTaskMax} | ${longTaskCount} | ${status} |`
  })
  const failures = report.failures.length
    ? report.failures.map((item) => `- ${item}`).join('\n')
    : '- 无'
  const alignmentRows = (report.alignment?.viewports || []).map((item) => {
    const bounds = item.bounds || {}
    const fmt = (value) => Number.isFinite(value) ? `${value}px` : '-'
    return `| ${item.width}px | ${fmt(bounds.head?.left)} / ${fmt(bounds.head?.right)} | ${fmt(bounds.canvas?.left)} / ${fmt(bounds.canvas?.right)} | ${fmt(item.maxEdgeDelta)} | ${fmt(item.overflowPx)} | ${item.pass ? 'PASS' : 'FAIL'} |`
  })
  return `# 知源性能 SLO · 最新实测

> 生成时间：${report.generatedAt}
> 采样方式：真实 Chromium 加载 \`${report.dist}\`，Playwright 驱动，不使用历史读数或模拟数据。
> 构建版本：\`${report.manifestVersion}\`
> 总体判定：**${report.overallPass ? 'PASS' : 'FAIL'}**

| 路径 | 样本数 | P50 (ms) | P95 (ms) | P95 预算 (ms) | Long Task 峰值 (ms) | Long Task 样本 | 判定 |
|---|---:|---:|---:|---:|---:|---:|---|
${rows.join('\n')}

## 策展台横向对齐

容差：页头、中心论点卡、页内工具条相对画布的左右边界最大误差 ≤ ${report.alignment?.tolerancePx ?? ALIGNMENT_TOLERANCE}px；同时要求页面无横向溢出。

| 视口 | 页头左 / 右 | 画布左 / 右 | 最大边界误差 | 横向溢出 | 判定 |
|---:|---:|---:|---:|---:|---|
${alignmentRows.length ? alignmentRows.join('\n') : '| - | - | - | - | - | FAIL |'}

## 失败项

${failures}

## 说明

- 计时从真实用户入口触发开始，到目标 UI 可消费（浮层输入框、搜索首屏、结果更新、目标页根节点、卡池列表 / 筛选结果 / 详情标题、分享抽屉、长图完成信号）为止。
- 样本为本机实际观测值；P50/P95 使用升序样本的最近秩计算。
- Long Task 由 Chromium \`PerformanceObserver({ type: 'longtask' })\` 在每次动作窗口内采集；它只用于暴露主线程阻塞，不参与路径 P95 判定。
- 任一采样报错或 P95 超预算，脚本以非零退出码结束。
`
}

async function armLongTasks(page) {
  return page.evaluate(() => {
    if (!Array.isArray(window.__zyPerfSloLongTasks)) window.__zyPerfSloLongTasks = []
    window.__zyPerfSloLongTasks.length = 0
    return window.__zyPerfSloLongTaskSupported === true
  }).catch(() => false)
}

async function drainLongTasks(page) {
  // PerformanceObserver 的交付发生在任务结束后的微任务/后续任务；动作计时已经停止，
  // 这里的短暂等待只用于完整收齐观测值，不计入路径耗时。
  await sleep(40)
  return page.evaluate(() => {
    const rows = Array.isArray(window.__zyPerfSloLongTasks) ? window.__zyPerfSloLongTasks : []
    return rows.filter((value) => Number.isFinite(value) && value >= 0)
  }).catch(() => [])
}

async function captureAction(page, action) {
  const supported = await armLongTasks(page)
  const started = Date.now()
  try {
    const result = await action()
    const elapsed = Date.now() - started
    return { elapsed, longTasks: await drainLongTasks(page), supported, result }
  } catch (error) {
    await drainLongTasks(page)
    throw error
  }
}

async function waitForContentChange(page, selector, previousText, timeout = 6000) {
  return page.evaluate(async ({ selector, previousText, timeout }) => {
    const root = document.querySelector(selector)
    if (!root) return { ok: false, reason: '结果容器不存在' }
    const deadline = performance.now() + timeout
    return await new Promise((resolve) => {
      let done = false
      const timer = setTimeout(() => finish({ ok: false, reason: '结果未更新' }), timeout)
      const finish = (value) => {
        if (done) return
        done = true
        clearTimeout(timer)
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

async function waitForDeckPanel(page, panel, timeout = 10000) {
  await page.waitForSelector(`.dk-row[data-panel="${panel}"]`, { state: 'visible', timeout })
}

async function ensureDeckList(page, panel) {
  const listButton = page.locator(`.dk-row[data-panel="${panel}"] .dk-view`).filter({ hasText: '列表' }).first()
  await listButton.waitFor({ state: 'visible', timeout: 10000 })
  const className = await listButton.getAttribute('class')
  if (!/\bon\b/.test(className || '')) await listButton.click()
}

async function clickDeckTab(page, label) {
  await page.locator('.deck-kind-seg button').filter({ hasText: label }).first().click()
}

async function measureDeckDetail(page, base, path, panel, rowSelector, titleSelector) {
  const separator = path.includes('?') ? '&' : '?'
  await page.goto(base + `#${path}${separator}fresh=1&freshAt=${Date.now()}`, { waitUntil: 'domcontentloaded' })
  await waitForDeckPanel(page, panel)
  await ensureDeckList(page, panel)
  const row = page.locator(rowSelector).first()
  await row.waitFor({ state: 'visible', timeout: 10000 })

  const measured = await captureAction(page, async () => {
    await row.click()
    await page.waitForSelector(titleSelector, { state: 'visible', timeout: 12000 })
  })

  await page.locator('.drawer-close').first().click()
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
  return measured
}

async function measureAlignment(page, base, boardId) {
  const viewports = []
  for (const width of ALIGNMENT_VIEWPORTS) {
    try {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(base + `#/workspace/${boardId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.curation-workspace', { state: 'visible', timeout: 20000 })
      await page.waitForSelector('.ws-head', { state: 'visible', timeout: 10000 })
      await page.waitForSelector('.thesis-banner', { state: 'visible', timeout: 10000 })
      await page.waitForSelector('.cur-toolbar', { state: 'visible', timeout: 10000 })
      await sleep(120)

      const measured = await page.evaluate(() => {
        const selectors = {
          head: '.ws-head',
          thesis: '.thesis-banner',
          toolbar: '.cur-toolbar',
          canvas: '.curation-workspace',
        }
        const bounds = {}
        for (const [name, selector] of Object.entries(selectors)) {
          const element = document.querySelector(selector)
          if (!element) continue
          const rect = element.getBoundingClientRect()
          bounds[name] = {
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
          }
        }
        return {
          bounds,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }
      })
      const canvas = measured.bounds.canvas
      const compared = ['head', 'thesis', 'toolbar']
        .map((name) => measured.bounds[name])
        .filter(Boolean)
      const maxEdgeDelta = canvas && compared.length
        ? Math.max(...compared.flatMap((rect) => [
          Math.abs(rect.left - canvas.left),
          Math.abs(rect.right - canvas.right),
        ]))
        : null
      const overflowPx = Math.max(0, measured.scrollWidth - measured.innerWidth)
      viewports.push({
        width,
        height: 900,
        bounds: measured.bounds,
        innerWidth: measured.innerWidth,
        scrollWidth: measured.scrollWidth,
        maxEdgeDelta: Number.isFinite(maxEdgeDelta) ? round(maxEdgeDelta) : null,
        overflowPx: round(overflowPx),
        pass: Number.isFinite(maxEdgeDelta)
          && maxEdgeDelta <= ALIGNMENT_TOLERANCE
          && overflowPx <= 1,
      })
    } catch (error) {
      viewports.push({
        width,
        height: 900,
        bounds: {},
        maxEdgeDelta: null,
        overflowPx: null,
        pass: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  return {
    tolerancePx: ALIGNMENT_TOLERANCE,
    viewports,
  }
}

async function seedPerfBoard(page) {
  return page.evaluate(async () => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    const data = raw.zy_data_v2
    if (!data) throw new Error('主数据尚未初始化')

    const now = Date.now()
    const boardId = 'perf-slo-board'
    const catIds = ['perf-slo-l2', 'perf-slo-l3', 'perf-slo-l4']
    // 这是「迁移早已完成」的现役策展台夹具。若不落这些幂等戳，刷新后会被真实的
    // hub-merge / board-card-pool 启动迁移当成存量数据消费掉，分享入口也就不存在了。
    data.hubMigratedAt ||= now
    data.hubMergedAt ||= now
    data.catsMigratedAt ||= now
    data.boardCardsPooledAt ||= now
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

    // 只清脚本自己的夹具。真实卡即使也存在同一个性能台，也不会被误删。
    data.resources = (data.resources || []).filter((item) => !String(item.id).startsWith('perf-slo-'))
    data.tasks = (data.tasks || []).filter((item) => !String(item.id).startsWith('perf-slo-'))
    data.curiosities = (data.curiosities || []).filter((item) => !String(item.id).startsWith('perf-slo-'))

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

    const taskCount = 120
    const taskStatuses = ['todo', 'doing', 'done']
    const priorities = ['high', 'medium', 'low']
    for (let index = 0; index < taskCount; index++) {
      data.tasks.push({
        id: `perf-slo-task-${index}`,
        kind: 'task',
        title: index % 4 === 0 ? `性能验收任务 · 深度工作 ${index}` : `性能验收任务 ${index}`,
        description: `用于任务卡池真实性能采样的任务 ${index}`,
        status: taskStatuses[index % taskStatuses.length],
        priority: priorities[index % priorities.length],
        tags: index % 6 === 0 ? [] : ['性能', `任务组-${index % 8}`],
        pinned: false,
        customFields: {},
        createdAt: now - index * 1000,
        updatedAt: now - index * 1000,
      })
    }

    const curiosityCount = 120
    const curioStatuses = ['todo', 'doing', 'done', 'shelf']
    for (let index = 0; index < curiosityCount; index++) {
      data.curiosities.push({
        id: `perf-slo-curio-${index}`,
        kind: 'curiosity',
        question: index % 5 === 0 ? `为什么知识调度比继续生产更重要？· ${index}` : `性能验收好奇心 ${index}`,
        description: `用于好奇心卡池真实性能采样的卡片 ${index}`,
        status: curioStatuses[index % curioStatuses.length],
        pinned: false,
        tags: index % 7 === 0 ? [] : ['性能', `好奇组-${index % 6}`],
        customFields: {},
        createdAt: now - index * 1000,
        updatedAt: now - index * 1000,
      })
    }

    const poolCount = 240
    for (let index = 0; index < poolCount; index++) {
      const linkType = index % 11 === 0 ? 'obsidian' : index % 7 === 0 ? 'file' : 'url'
      const link = linkType === 'obsidian'
        ? `obsidian://open?vault=zhiyuan&file=perf-${index}`
        : linkType === 'file'
          ? `性能夹具-${index}.pdf`
          : `https://example.com/pool/${index}`
      data.resources.push({
        id: `perf-slo-pool-${index}`,
        kind: 'resource',
        title: index % 4 === 0 ? `知识调度性能验收资源 ${index}` : `性能验收资源卡 ${index}`,
        description: `用于资源卡池真实性能采样的池卡 ${index}`,
        linkType,
        link,
        workspaceId: 'zy-curation',
        categoryId: '',
        tags: index % 5 === 0 ? [] : ['性能', `资源组-${index % 8}`],
        pinned: false,
        callCount: index % 6,
        lastCalledAt: index % 6 ? now - index * 1000 : undefined,
        customFields: {},
        createdAt: now - index * 1000,
        updatedAt: now - index * 1000,
      })
    }

    const folderCount = 6
    data.resourceFolders = Array.from({ length: folderCount }, (_, index) => ({
      id: `perf-slo-folder-${index}`,
      name: `性能常用夹 ${index + 1}`,
      order: index,
      createdAt: now - index * 1000,
      updatedAt: now - index * 1000,
    }))
    data.resourceFolderMirrors = []
    for (let folderIndex = 0; folderIndex < folderCount; folderIndex++) {
      for (let memberIndex = 0; memberIndex < 40; memberIndex++) {
        const source = data.resources.find(item => item.id === `perf-slo-pool-${memberIndex}`)
        if (!source) continue
        data.resourceFolderMirrors.push({
          id: `perf-slo-folder-mirror-${folderIndex}-${memberIndex}`,
          folderId: `perf-slo-folder-${folderIndex}`,
          resourceId: source.id,
          order: memberIndex,
          addedAt: now - memberIndex * 1000,
          snapshot: JSON.parse(JSON.stringify(source)),
        })
      }
    }

    const receiptAt = now - 18 * 60 * 1000
    const receiptRows = [
      {
        key: 'task:perf-slo-task-0',
        type: 'task',
        id: 'perf-slo-task-0',
        title: '性能验收任务 · 深度工作 0',
        status: 'changed',
        updatedAt: now - 60_000,
        fields: ['title', 'status'],
      },
      {
        key: 'resource:perf-slo-pool-0',
        type: 'resource',
        id: 'perf-slo-pool-0',
        title: '知识调度性能验收资源 0',
        status: 'added',
        updatedAt: now - 120_000,
        fields: [],
      },
      {
        key: 'dailyFocus:perf-slo-focus-1',
        type: 'dailyFocus',
        id: 'perf-slo-focus-1',
        title: '今日三件事 · 第 2 槽',
        status: 'changed',
        updatedAt: now - 180_000,
        fields: ['sourceId', 'done'],
      },
      {
        key: 'category:perf-slo-l2',
        type: 'category',
        id: 'perf-slo-l2',
        title: '证据展开',
        status: 'changed',
        updatedAt: now - 240_000,
        fields: ['name', 'order'],
      },
    ]
    await chrome.storage.local.set({
      zy_data_v2: data,
      zy_cloud_env: { url: 'https://perf.invalid', anonKey: 'sb_publishable_perf' },
      zy_cloud_meta_v1: {
        userId: 'perf-user',
        email: 'perf@example.invalid',
        refreshToken: 'perf-refresh',
        revision: 12,
        checkOnStart: false,
        assetSyncEnabled: false,
        lastUploadAt: receiptAt,
        lastCheckedAt: receiptAt,
        syncReceipts: [{
          id: 'sync_perf_receipt',
          at: receiptAt,
          direction: 'upload',
          trigger: 'topbar',
          fromRevision: 11,
          toRevision: 12,
          added: 1,
          changed: 3,
          removed: 0,
          rows: receiptRows,
        }],
      },
    })
    return {
      boardId,
      resourceCount: 19,
      categoryCount: 3,
      taskCount,
      curiosityCount,
      poolCount,
      receiptRows: receiptRows.length,
    }
  })
}

async function inspectPerfBoard(page, boardId) {
  return page.evaluate(async (id) => {
    const raw = await chrome.storage.local.get('zy_data_v2')
    const data = raw.zy_data_v2
    const board = data?.workspaces?.find((item) => item.id === id)
    const cards = (data?.resources || []).filter((item) => item.workspaceId === id && !item.deletedAt)
    return {
      hash: location.hash,
      boardExists: !!board,
      boardArchived: !!board?.archived,
      cardCount: cards.length,
      bodyText: (document.body?.innerText || '').slice(0, 600),
    }
  }, boardId)
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
    alignment: null,
    failures: [],
    overallPass: false,
  }
  const longTaskSamples = Object.fromEntries(Object.keys(BUDGETS).map((key) => [key, []]))
  let longTaskSupported = false
  function recordAction(key, measured) {
    longTaskSupported ||= measured.supported === true
    if (measured.longTasks.length) longTaskSamples[key].push(...measured.longTasks)
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
    await page.addInitScript(() => {
      window.__zyPerfSloLongTasks = []
      window.__zyPerfSloLongTaskSupported = typeof PerformanceObserver !== 'undefined'
        && Array.isArray(PerformanceObserver.supportedEntryTypes)
        && PerformanceObserver.supportedEntryTypes.includes('longtask')
      if (!window.__zyPerfSloLongTaskSupported) return
      try {
        window.__zyPerfSloLongTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__zyPerfSloLongTasks.push(entry.duration)
          }
        })
        window.__zyPerfSloLongTaskObserver.observe({ type: 'longtask', buffered: true })
      } catch {
        window.__zyPerfSloLongTaskSupported = false
      }
    })

    await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.page .desk-head', { timeout: 20000 })
    const seeded = await seedPerfBoard(page)
    report.fixture = seeded
    await ctx.route('https://perf.invalid/**', async (route) => {
      const request = route.request()
      const url = request.url()
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      }
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers })
        return
      }
      if (url.includes('/auth/v1/token')) {
        await route.fulfill({
          status: 200,
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            access_token: 'perf-access-token',
            refresh_token: 'perf-refresh-token',
            user: { id: 'perf-user', email: 'perf@example.invalid' },
          }),
        })
        return
      }
      await route.fulfill({
        status: 404,
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'perf fixture endpoint not implemented' }),
      })
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.page .desk-head', { timeout: 20000 })

    // 1) 网页浮层唤起：真实宿主页 + content script + background 消息。
    overlayServer = http.createServer((_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        Connection: 'close',
      })
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
        const measured = await captureAction(page, async () => {
          await worker.evaluate(async ({ port }) => {
            const tabs = await chrome.tabs.query({ url: `http://127.0.0.1:${port}/*` })
            if (!tabs[0]?.id) throw new Error('宿主页 tab 未找到')
            await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-search' })
          }, { port })
          await page.waitForSelector('#__zy_si__', { timeout: 8000 })
        })
        overlaySamples.push(measured.elapsed)
        recordAction('overlay_open', measured)
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
      longTaskSamples.overlay_open,
      longTaskSupported,
    )

    // 2) ⌘K 首屏：每次整页重载后首次打开，避免把已挂载组件当成"首屏"。
    const cmdkSamples = []
    let cmdkError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.page .desk-head', { timeout: 20000 })
        await sleep(250)
        const measured = await captureAction(page, async () => {
          await page.locator('.icon-btn[title*="全局搜索"]').first().click()
          await page.waitForSelector('.gp-overlay.open .gp-results', { timeout: 12000 })
        })
        cmdkSamples.push(measured.elapsed)
        recordAction('cmdk_first_open', measured)
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
      longTaskSamples.cmdk_first_open,
      longTaskSupported,
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
        const previousText = await page.locator('.gp-results').textContent()
        const measured = await captureAction(page, async () => {
          const started = await page.evaluate(() => {
            const input = document.querySelector('.gp-search-input')
            if (!(input instanceof HTMLInputElement)) return false
            input.value = '知识库'
            input.dispatchEvent(new Event('input', { bubbles: true }))
            return true
          })
          if (!started) throw new Error('搜索输入框不存在')
          const changed = await waitForContentChange(page, '.gp-results', previousText || '')
          if (!changed.ok) throw new Error(changed.reason || '搜索结果没有更新')
        })
        typeSamples.push(measured.elapsed)
        recordAction('search_type', measured)
      }
    } catch (error) {
      typeError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.search_type = buildMetric(
      'search_type',
      typeSamples,
      ['从最终查询词触发 input 到 .gp-results 实际发生 DOM 更新；包含 120ms 输入防抖与 Vue 渲染。'],
      typeError,
      longTaskSamples.search_type,
      longTaskSupported,
    )
    await page.keyboard.press('Escape').catch(() => {})

    // 4) 页面切换：调度台 ↔ 方向台，KeepAlive 热切换。
    const switchSamples = []
    let switchError = ''
    try {
      await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.page .desk-head', { timeout: 12000 })
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        const toCompass = await captureAction(page, async () => {
          await page.locator('.tabs .tab').filter({ hasText: '方向台' }).first().click()
          await page.waitForSelector('.compass-layout', { timeout: 10000 })
        })
        switchSamples.push(toCompass.elapsed)
        recordAction('page_switch', toCompass)

        const toDesk = await captureAction(page, async () => {
          await page.locator('.tabs .tab').filter({ hasText: '调度台' }).first().click()
          await page.waitForSelector('.page .desk-head', { timeout: 10000 })
        })
        switchSamples.push(toDesk.elapsed)
        recordAction('page_switch', toDesk)
      }
    } catch (error) {
      switchError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.page_switch = buildMetric(
      'page_switch',
      switchSamples,
      ['每轮记录两次真实导航：调度台→方向台、方向台→调度台；计到目标页根节点出现。'],
      switchError,
      longTaskSamples.page_switch,
      longTaskSupported,
    )

    // 5) 三卡池切换：在同一二级页里真实点击类型 Tab，计到目标列表的首行出现。
    const poolSwitchSamples = []
    let poolSwitchError = ''
    try {
      await page.goto(base + '#/deck/task', { waitUntil: 'domcontentloaded' })
      await waitForDeckPanel(page, 'task')
      await ensureDeckList(page, 'task')
      await page.waitForSelector('.trow[data-tid]', { state: 'visible', timeout: 10000 })

      await clickDeckTab(page, '好奇心卡')
      await waitForDeckPanel(page, 'curio')
      await ensureDeckList(page, 'curio')
      await page.waitForSelector('.cz-list-item[data-czid]', { state: 'visible', timeout: 10000 })

      await clickDeckTab(page, '资源卡')
      await waitForDeckPanel(page, 'pool')
      await ensureDeckList(page, 'pool')
      await page.waitForSelector('.pcp-row[data-rid]', { state: 'visible', timeout: 10000 })

      await clickDeckTab(page, '任务卡')
      await waitForDeckPanel(page, 'task')
      await page.waitForSelector('.trow[data-tid]', { state: 'visible', timeout: 10000 })

      for (let index = 0; index < SAMPLE_COUNT; index++) {
        const transitions = [
          ['好奇心卡', 'curio', '.cz-list-item[data-czid]'],
          ['资源卡', 'pool', '.pcp-row[data-rid]'],
          ['任务卡', 'task', '.trow[data-tid]'],
        ]
        for (const [label, panel, rowSelector] of transitions) {
          const measured = await captureAction(page, async () => {
            await clickDeckTab(page, label)
            await waitForDeckPanel(page, panel)
            await page.waitForSelector(rowSelector, { state: 'visible', timeout: 10000 })
          })
          poolSwitchSamples.push(measured.elapsed)
          recordAction('pool_switch', measured)
        }
      }
    } catch (error) {
      poolSwitchError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.pool_switch = buildMetric(
      'pool_switch',
      poolSwitchSamples,
      ['每轮真实点击任务→好奇心→资源→任务三次 Tab；计到目标卡池列表首行出现，采样前已用真实「列表」按钮建立视图。'],
      poolSwitchError,
      longTaskSamples.pool_switch,
      longTaskSupported,
    )

    // 6) 卡池筛选：任务状态下拉、好奇心状态胶囊、资源池标签胶囊各走一遍真实控件。
    const poolFilterSamples = []
    let poolFilterError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.goto(base + '#/deck/task', { waitUntil: 'domcontentloaded' })
        await waitForDeckPanel(page, 'task')
        await ensureDeckList(page, 'task')
        await page.waitForSelector('.task-list', { state: 'visible', timeout: 10000 })

        let previousText = await page.locator('.task-list').textContent()
        let measured = await captureAction(page, async () => {
          await page.locator('.dk-row[data-panel="task"] .dk-filters select').selectOption('doing')
          const changed = await waitForContentChange(page, '.task-list', previousText || '')
          if (!changed.ok) throw new Error(`任务状态筛选：${changed.reason || '列表未更新'}`)
        })
        poolFilterSamples.push(measured.elapsed)
        recordAction('pool_filter', measured)
        previousText = await page.locator('.task-list').textContent()
        await page.locator('.dk-row[data-panel="task"] .dk-filters select').selectOption('all')
        const taskRestored = await waitForContentChange(page, '.task-list', previousText || '')
        if (!taskRestored.ok) throw new Error('任务状态筛选恢复失败')
        await page.waitForSelector('.trow[data-tid]', { state: 'visible', timeout: 10000 })

        await clickDeckTab(page, '好奇心卡')
        await waitForDeckPanel(page, 'curio')
        await ensureDeckList(page, 'curio')
        await page.waitForSelector('.cz-list', { state: 'visible', timeout: 10000 })
        previousText = await page.locator('.cz-list').textContent()
        measured = await captureAction(page, async () => {
          await page.locator('.dk-row[data-panel="curio"] .dk-pill').filter({ hasText: '探索中' }).first().click()
          const changed = await waitForContentChange(page, '.cz-list', previousText || '')
          if (!changed.ok) throw new Error(`好奇心状态筛选：${changed.reason || '列表未更新'}`)
        })
        poolFilterSamples.push(measured.elapsed)
        recordAction('pool_filter', measured)
        previousText = await page.locator('.cz-list').textContent()
        await page.locator('.dk-row[data-panel="curio"] .dk-pill').filter({ hasText: '全部' }).first().click()
        const curioRestored = await waitForContentChange(page, '.cz-list', previousText || '')
        if (!curioRestored.ok) throw new Error('好奇心状态筛选恢复失败')
        await page.waitForSelector('.cz-list-item[data-czid]', { state: 'visible', timeout: 10000 })

        await clickDeckTab(page, '资源卡')
        await waitForDeckPanel(page, 'pool')
        await ensureDeckList(page, 'pool')
        await page.waitForSelector('.pcp-list', { state: 'visible', timeout: 10000 })
        previousText = await page.locator('.pcp-list').textContent()
        measured = await captureAction(page, async () => {
          await page.locator('.dk-row[data-panel="pool"] .dk-filters.select .dk-select').selectOption('untagged')
          const changed = await waitForContentChange(page, '.pcp-list', previousText || '')
          if (!changed.ok) throw new Error(`资源池标签筛选：${changed.reason || '列表未更新'}`)
        })
        poolFilterSamples.push(measured.elapsed)
        recordAction('pool_filter', measured)
        previousText = await page.locator('.pcp-list').textContent()
        await page.locator('.dk-row[data-panel="pool"] .dk-filters.select .dk-select').selectOption('all')
        const poolRestored = await waitForContentChange(page, '.pcp-list', previousText || '')
        if (!poolRestored.ok) throw new Error('资源池标签筛选恢复失败')
        await page.waitForSelector('.pcp-row[data-rid]', { state: 'visible', timeout: 10000 })
      }
    } catch (error) {
      poolFilterError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.pool_filter = buildMetric(
      'pool_filter',
      poolFilterSamples,
      ['每轮真实操作任务「推进中」、好奇心「探索中」、资源池状态下拉「待打标」三次筛选；每次计到列表 DOM 实际变化。'],
      poolFilterError,
      longTaskSamples.pool_filter,
      longTaskSupported,
    )

    // 6.1) 常用夹抽屉：从资源池控制行点击到六组夹具与成员列表可消费。
    const folderDrawerSamples = []
    let folderDrawerError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.goto(base + `#/deck/resource?perf=folder-${index}`, { waitUntil: 'domcontentloaded' })
        await waitForDeckPanel(page, 'pool')
        const entry = page.locator('.pool-controls button, .pcp-toolbar button, button.pcp-btn')
          .filter({ hasText: /常用夹/ }).first()
        await entry.waitFor({ state: 'visible', timeout: 10000 })
        const measured = await captureAction(page, async () => {
          await entry.click()
          await page.waitForSelector('.drawer .rfd-folder .rfd-row', { state: 'visible', timeout: 8000 })
        })
        folderDrawerSamples.push(measured.elapsed)
        recordAction('folder_drawer', measured)
        await page.locator('.drawer-close').first().click()
        await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
      }
    } catch (error) {
      folderDrawerError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.folder_drawer = buildMetric(
      'folder_drawer',
      folderDrawerSamples,
      ['从资源池“常用夹”入口点击到抽屉内六组、每组 40 条镜像成员可消费。'],
      folderDrawerError,
      longTaskSamples.folder_drawer,
      longTaskSupported,
    )

    // 7) 三卡池详情：真实单击列表行，必须穿过现有的 260ms 双击去重等待。
    const poolDetailSamples = []
    let poolDetailError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        let measured = await measureDeckDetail(
          page,
          base,
          '/deck/task',
          'task',
          '.trow[data-tid^="perf-slo-task-"]',
          '.drawer .ts-title',
        )
        poolDetailSamples.push(measured.elapsed)
        recordAction('pool_detail', measured)
        measured = await measureDeckDetail(
          page,
          base,
          '/deck/curiosity',
          'curio',
          '.cz-list-item[data-czid^="perf-slo-curio-"]',
          '.drawer .cz-h1q',
        )
        poolDetailSamples.push(measured.elapsed)
        recordAction('pool_detail', measured)
        measured = await measureDeckDetail(
          page,
          base,
          '/deck/resource',
          'pool',
          '.pcp-row[data-rid^="perf-slo-pool-"]',
          '.drawer .ds-h1',
        )
        poolDetailSamples.push(measured.elapsed)
        recordAction('pool_detail', measured)
      }
    } catch (error) {
      poolDetailError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.pool_detail = buildMetric(
      'pool_detail',
      poolDetailSamples,
      ['每轮真实单击任务、好奇心、资源池列表行，计到对应详情标题可见；包含真实 260ms 双击去重等待。'],
      poolDetailError,
      longTaskSamples.pool_detail,
      longTaskSupported,
    )

    // 7.1) 同步明细抽屉：从「最近实际同步」事实卡点击到记录级回执抽屉出现。
    const syncDrawerSamples = []
    let syncDrawerError = ''
    try {
      await page.goto(base + '#/settings?page=cloud', { waitUntil: 'domcontentloaded' })
      await page.reload({ waitUntil: 'domcontentloaded' })
      const receiptTrigger = page.locator('[data-testid="latest-sync-receipt-trigger"]')
      await receiptTrigger.waitFor({ state: 'visible', timeout: 12000 })
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="latest-sync-receipt-trigger"]')
        const value = (button?.querySelector('b')?.textContent || '').trim()
        return !!value && value !== '尚未同步'
      }, null, { timeout: 12000 })
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        const measured = await captureAction(page, async () => {
          await receiptTrigger.click()
          await page.waitForSelector('.cscd .cct', { state: 'visible', timeout: 10000 })
        })
        syncDrawerSamples.push(measured.elapsed)
        recordAction('sync_changes_drawer', measured)
        await page.locator('.drawer-close').first().click()
        await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
      }
    } catch (error) {
      syncDrawerError = error instanceof Error ? error.message : String(error)
    }
    report.metrics.sync_changes_drawer = buildMetric(
      'sync_changes_drawer',
      syncDrawerSamples,
      ['从点击「最近实际同步」到右侧回执抽屉内分组表可见；不包含首次进入设置页的加载。'],
      syncDrawerError,
      longTaskSamples.sync_changes_drawer,
      longTaskSupported,
    )

    // 8) 五档横向对齐：与分享路径同一夹具策展台，在真实布局完成后逐档测量。
    const boardId = seeded.boardId
    report.alignment = await measureAlignment(page, base, boardId)
    for (const viewport of report.alignment.viewports) {
      if (!viewport.pass) {
        const reason = viewport.error
          ? viewport.error
          : `边界误差 ${viewport.maxEdgeDelta ?? '-'}px、横向溢出 ${viewport.overflowPx ?? '-'}px`
        report.failures.push(`策展台横向对齐 ${viewport.width}px：${reason}`)
      }
    }

    // 9) 分享抽屉：真实进入夹具策展台，点击「分享成果」，等到原生预览纸面可见。
    const drawerSamples = []
    let drawerError = ''
    try {
      for (let index = 0; index < SAMPLE_COUNT; index++) {
        await page.goto(base + `#/workspace/${boardId}`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.share-action', { timeout: 15000 })
        const measured = await captureAction(page, async () => {
          await page.locator('.share-action').first().click()
          await page.waitForSelector('.drawer .cs-paper', { state: 'visible', timeout: 12000 })
        })
        drawerSamples.push(measured.elapsed)
        recordAction('share_drawer', measured)
        await page.locator('.drawer-close').first().click()
        await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
      }
    } catch (error) {
      drawerError = error instanceof Error ? error.message : String(error)
      const diagnostic = await inspectPerfBoard(page, boardId).catch((inspectError) => ({
        inspectError: inspectError instanceof Error ? inspectError.message : String(inspectError),
      }))
      drawerError += `；夹具诊断=${JSON.stringify(diagnostic)}`
    }
    report.metrics.share_drawer = buildMetric(
      'share_drawer',
      drawerSamples,
      ['从点击分享成果到分享抽屉内原生预览 .cs-paper 可见。'],
      drawerError,
      longTaskSamples.share_drawer,
      longTaskSupported,
    )

    // 10) 长图生成：同一真实抽屉的完整生成链，等到 imageDataUrl 已回填的状态文案。
    const imageSamples = []
    let imageError = ''
    try {
      for (let index = 0; index < IMAGE_SAMPLE_COUNT; index++) {
        await page.goto(base + `#/workspace/${boardId}`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.share-action', { timeout: 15000 })
        const measured = await captureAction(page, async () => {
          await page.locator('.share-action').first().click()
          await waitForText(page, '.cs-image-state small', /已嵌入分享 HTML/, 20000)
        })
        imageSamples.push(measured.elapsed)
        recordAction('long_image', measured)
        await page.locator('.drawer-close').first().click()
        await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 })
      }
    } catch (error) {
      imageError = error instanceof Error ? error.message : String(error)
      const diagnostic = await inspectPerfBoard(page, boardId).catch((inspectError) => ({
        inspectError: inspectError instanceof Error ? inspectError.message : String(inspectError),
      }))
      imageError += `；夹具诊断=${JSON.stringify(diagnostic)}`
    }
    report.metrics.long_image = buildMetric(
      'long_image',
      imageSamples,
      ['从点击分享成果到完整 PNG 数据 URL 已回填、界面显示「已嵌入分享 HTML」。'],
      imageError,
      longTaskSamples.long_image,
      longTaskSupported,
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
    if (overlayServer) {
      // Playwright 会保留宿主页的 keep-alive 连接；只调 close 会永久等不到 callback。
      overlayServer.closeAllConnections?.()
      await new Promise((resolve) => overlayServer.close(resolve))
    }
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
