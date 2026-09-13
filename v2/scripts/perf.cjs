/**
 * 知源调度台 · 性能基准测试台（R71 结构性治理专用）
 *
 * 运行：cd v2 && node scripts/perf.cjs
 * 可选：node scripts/perf.cjs --scale=large|medium|small   （默认 large）
 *       node scripts/perf.cjs --json                       （仅输出 JSON）
 *
 * 设计原则（保证可比、可信）：
 *  1) **只测主线程实际工作量**——计时区间内不含 requestAnimationFrame 的帧等待（那是 16.7ms 的常数，
 *     会把「一次 200ms 的卡顿」稀释成「33ms」）。主线程阻塞 = 用户感知的卡顿，这才是要治理的量。
 *  2) **每个交互测 3 次取中位数**，且每次测量前把状态复位到「另一个视图」，避免第二次点击变成空操作。
 *  3) 数据规模固定（SCALES），种子写入 chrome.storage.local 后 reload，保证前后完全同构。
 *
 * 指标：
 *   M1  冷启动到首屏可用（ms，自 document start 起算）
 *   M2  策展台：视图切换 / 侧栏分类树重渲染 / 搜索键入  （卡片+镜像混排的主战场）
 *   M4  资源台：视图切换 / 左树节点计数重渲染 / 搜索键入（nodeCount 类 O(n²) 重灾区）
 *   M3  长任务总计 / 最大单任务（ms）——交互序列（启动→M2b 窗口）的主线程阻塞量
 *   M3b 窗口二（M2c 回调度台 + M5 全局搜索）的主线程阻塞量（R114-59 新增，与 M3 分窗互不污染）
 *   M2c 回到调度台耗时（R114-59 新增——此前无度量）
 *   M5  全局搜索浮层：唤起 / 键入 6 字净耗时（R114-59 重写——旧 M6 在扩展页派发合成按键，无监听者，恒 ≈0ms 假指标）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const EXT_INDEX = 'src/newtab/index.html'

const SCALES = {
  small:  { hubCards: 100, hubCats: 40,  boards: 3, boardCards: 30, boardCats: 12, tasks: 150, curiosities: 60 },
  medium: { hubCards: 400, hubCats: 100, boards: 6, boardCards: 60, boardCats: 20, tasks: 400, curiosities: 150 },
  large:  { hubCards: 900, hubCats: 200, boards: 8, boardCards: 80, boardCats: 25, tasks: 700, curiosities: 300 }
}

const argv = process.argv.slice(2)
const SCALE_NAME = (argv.find(a => a.startsWith('--scale=')) || '--scale=large').split('=')[1]
const JSON_ONLY = argv.includes('--json')
const S = SCALES[SCALE_NAME] || SCALES.large

const out = { scale: SCALE_NAME, config: S, metrics: {}, raw: [] }
function log(...a) { if (!JSON_ONLY) console.log(...a) }
function push(name, ms, extra) {
  out.metrics[name] = Math.round(ms * 10) / 10
  if (extra) Object.assign(out.metrics, extra)
  log(`  ${name} = ${Math.round(ms)}ms`)
}

/** 页面内计时工具（随每次导航注入） */
const HARNESS = `
window.__ready = null
window.__marks = {}
window.__io = []
window.__lt = []
// 长任务观察器：从 document start 起就装好，才能抓到「启动期」的阻塞
try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push({ d: Math.round(e.duration), s: Math.round(e.startTime) }) }).observe({ entryTypes: ['longtask'] }) } catch (e) {}
// 存储 IO 计时（定位「启动慢」到底慢在读盘、算数还是等定时器）
try {
  const cs = chrome.storage.local
  const wrap = (name) => {
    const orig = cs[name].bind(cs)
    cs[name] = function (...args) {
      const t0 = performance.now()
      const cbIdx = args.findIndex(a => typeof a === 'function')
      if (cbIdx >= 0) {
        const cb = args[cbIdx]
        args[cbIdx] = (...r) => { window.__io.push({ op: name, ms: Math.round(performance.now() - t0), at: Math.round(t0) }); cb(...r) }
        return orig(...args)
      }
      const p = orig(...args)
      if (p && typeof p.then === 'function') {
        return p.then(r => { window.__io.push({ op: name, ms: Math.round(performance.now() - t0), at: Math.round(t0) }); return r })
      }
      return p
    }
  }
  wrap('get'); wrap('set')
} catch (e) {}
// 首屏就绪 + 应用挂载探针：等 documentElement 存在后再挂 MutationObserver（同步触发，不受定时器节流影响）
function __armProbes() {
  const t = setInterval(() => {
    if (!document.documentElement) return
    clearInterval(t)
    window.__marks.appStart = 0
    const app = document.querySelector('#app') || document.body
    const mo2 = new MutationObserver(() => {
      if (window.__marks.mounted == null && app.children.length && !document.querySelector('.zy-skl')) window.__marks.mounted = Math.round(performance.now())
    })
    mo2.observe(app, { childList: true, subtree: true })
    document.addEventListener('DOMContentLoaded', () => { window.__marks.dcl = Math.round(performance.now()) })
    window.addEventListener('load', () => { window.__marks.load = Math.round(performance.now()) })
    // 冷启动 = 调度台首页可交互（顶栏 + 首页状态 chip 同时在位）
    const home = () => document.querySelector('.tabs') && document.querySelector('.storage-chip')
    const mo = new MutationObserver(() => { if (window.__ready == null && home()) window.__ready = performance.now() })
    mo.observe(document.documentElement, { childList: true, subtree: true })
    if (home()) window.__ready = performance.now()
  }, 0)
}
__armProbes()
/** 轮询等待条件成立，返回耗时（-1 = 超时） */
window.__waitFor = function (pred, timeout) {
  return new Promise(res => {
    const t0 = performance.now()
    const t = setInterval(() => { if (pred()) { clearInterval(t); res(Math.round(performance.now() - t0)) } }, 8)
    setTimeout(() => { clearInterval(t); res(-1) }, timeout || 15000)
  })
}
/** 点击顶栏某个导航 Tab，测「点下去 → 目标视图就位」的端到端耗时（首次会含 chunk 加载） */
window.__navTo = async function (prefix, sel) {
  // 排除「＋新增策展台」「折叠」等功能性 tab（它们的 title 也含「策展台」）
  // R112 修脚本漂移：新增 tab-overflow 过滤——溢出指示「≪ N」的 title 是「其余 N 个策展台」，
  // 含「策展台」三字，会被前缀匹配误命中（点它只展开溢出列表、不导航）。
  const pick = () => [...document.querySelectorAll('.tabs .tab')]
    .filter(e => !/tab-add|tab-collapse|adding|tab-overflow/.test(e.className))
    .find(e => ((e.getAttribute('title') || '') + (e.textContent || '')).includes(prefix))
  const tab0 = pick()
  if (!tab0) return -1
  const xs = []
  for (let k = 0; k < 4; k++) {
    if (k) { document.querySelector('.tabs .tab')?.click(); await window.__flush(); await new Promise(r => setTimeout(r, 250)) }
    const t0 = performance.now()
    ;(pick() || tab0).click()
    await window.__waitFor(() => document.querySelector(sel))
    await window.__flush()
    if (k >= 1) xs.push(performance.now() - t0)
  }
  xs.sort((a, b) => a - b)
  return Math.round(xs[Math.floor(xs.length / 2)])
}
/** 等渲染稳定：微任务清空（Vue 的 nextTick 渲染在此完成），不包含帧等待 */
window.__flush = () => new Promise(r => setTimeout(r, 0))
/** 等渲染稳定：微任务清空（Vue 的 nextTick 渲染在此完成），不包含帧等待 */
window.__flush = () => new Promise(r => setTimeout(r, 0))
/** 主线程工作量计时：测「点下去 → DOM 更新完毕」的同步/微任务耗时，剔除帧等待 */
window.__tick = async function (fn) {
  await window.__flush()
  const t0 = performance.now()
  await fn()
  await window.__flush()
  return performance.now() - t0
}
window.__median = async function (fn, times) {
  const n = times || 5
  for (let i = 0; i < 2; i++) await window.__tick(fn)   // JIT / 样式缓存预热，不计入
  const xs = []
  for (let i = 0; i < n; i++) xs.push(await window.__tick(fn))
  xs.sort((a, b) => a - b)
  return Math.round(xs[Math.floor(n / 2)] * 10) / 10
}
/** 依次切到每个视图标签，只计「切到目标视图」这一次的主线程耗时（复位切换不计入） */
window.__switchViews = async function (sel) {
  const res = {}
  const tabs = [...document.querySelectorAll(sel)]
  const timeOne = async (from, to) => {
    from.click(); await window.__flush()      // 复位到另一视图（不计时）
    const t0 = performance.now()
    to.click()
    await window.__flush()
    return performance.now() - t0
  }
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i], other = tabs[(i + 1) % tabs.length]
    const xs = []
    for (let k = 0; k < 5; k++) { const v = await timeOne(other, tab); if (k >= 1) xs.push(v) }  // 首轮预热
    xs.sort((a, b) => a - b)
    res[tab.textContent.trim()] = Math.round(xs[Math.floor(xs.length / 2)] * 10) / 10
  }
  if (tabs[0]) { tabs[0].click(); await window.__flush() }
  return res
}
/** 分类树整树重渲染（折叠↔展开交替，确保每次都是真实全量重算） */
window.__treeRerender = async function () {
  const btns = [...document.querySelectorAll('.ct-btn')]
  const expand = btns.find(b => b.textContent.includes('展开'))
  const collapse = btns.find(b => b.textContent.includes('收起'))
  if (!expand || !collapse) return -1
  return await window.__median(async () => {
    collapse.click(); await window.__flush()
    expand.click()
  }, 5)
}
/** 搜索键入：连打全部字符 + 越过防抖窗口，扣除人为等待后的净主线程成本 */
window.__searchType = async function (sel, q, debounceMs) {
  const inp = document.querySelector(sel)
  if (!inp) return -1
  const GAP = 8, DEBOUNCE = debounceMs || 240
  const xs = []
  for (let k = 0; k < 5; k++) {
    const t0 = performance.now()
    for (let i = 1; i <= q.length; i++) {
      inp.value = q.slice(0, i)
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise(r => setTimeout(r, GAP))
    }
    await new Promise(r => setTimeout(r, DEBOUNCE))
    await window.__flush()
    if (k >= 2) xs.push(performance.now() - t0 - q.length * GAP - DEBOUNCE)   // 前 2 轮预热
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 60))
  }
  xs.sort((a, b) => a - b)
  return Math.round(xs[Math.floor(xs.length / 2)] * 10) / 10
}
`

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) throw new Error('dist 不存在，请先 npm run build')

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

  // R114-59：全局搜索浮层的采样宿主页（content script 只注入 http/https，扩展页内测不到——
  // 旧 M6 在 newtab 上派发合成 Ctrl+K，无监听者，恒 ≈0ms，是假指标）
  const http = require('http')
  const gsServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><title>zy-perf-host</title><p>知源全局搜索采样宿主页</p>')
  })
  await new Promise(r => gsServer.listen(0, '127.0.0.1', r))
  const gsPort = gsServer.address().port

  const page = await ctx.newPage()
  if (!JSON_ONLY) {
    page.on('pageerror', e => console.error('[pageerror]', e.message))
    page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()) })
  }
  await page.addInitScript(HARNESS)

  // ── 首次打开：让扩展自建默认数据 ──
  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // ── 种入大规模合成数据（在原默认数据上覆写集合，保留 fieldConfig/stats 等必需段）──
  const seed = await page.evaluate(async (S) => {
    const HUB = 'zy-curation'
    const got = await new Promise(res => chrome.storage.local.get('zy_data_v2', r => res(r)))
    const base = got.zy_data_v2 || {}
    const now = Date.now()
    const pad = (n, w = 3) => String(n).padStart(w, '0')

    const hubCats = []
    const roots = Math.max(4, Math.round(S.hubCats / 6))
    for (let i = 0; i < roots; i++) hubCats.push({ id: `hc-r${pad(i)}`, workspaceId: HUB, name: `主域 ${i}`, order: i })
    let lvl2 = 0, lvl3 = 0, lvl4 = 0
    for (let i = roots; i < S.hubCats; i++) {
      const mod = i % 4
      if (mod === 0 && lvl2 < roots * 2) {
        const p = hubCats[Math.floor(lvl2 / 2) % roots]
        hubCats.push({ id: `hc-l2-${pad(lvl2)}`, workspaceId: HUB, name: `子集 ${lvl2}`, order: lvl2, parentId: p.id }); lvl2++
      } else if (mod === 1 && lvl3 < roots * 3) {
        const p = hubCats.find(c => c.id.startsWith('hc-l2-')) || hubCats[0]
        hubCats.push({ id: `hc-l3-${pad(lvl3)}`, workspaceId: HUB, name: `分组 ${lvl3}`, order: lvl3, parentId: p.id }); lvl3++
      } else if (mod === 2 && lvl4 < roots * 3) {
        const p = hubCats.find(c => c.id.startsWith('hc-l3-')) || hubCats[0]
        hubCats.push({ id: `hc-l4-${pad(lvl4)}`, workspaceId: HUB, name: `细目 ${lvl4}`, order: lvl4, parentId: p.id }); lvl4++
      } else {
        hubCats.push({ id: `hc-x-${pad(i)}`, workspaceId: HUB, name: `子域 ${i}`, order: i, parentId: hubCats[i % roots].id })
      }
    }

    const boards = []
    const boardCats = []
    for (let b = 0; b < S.boards; b++) {
      const wid = `ws-b${pad(b)}`
      // 注意：顶栏 Tab 文本 = ws.icon + name.replace(/^[^\s]+\s/, '')，会剥掉首个空格前 token。
      // 故名字第二段（PERF0、PERF1…）才是 Tab 上真正可匹配的文本，__navTo 用「PERF0」定位。
      boards.push({ id: wid, name: `策展台 PERF${b}`, icon: '📘', color: '#4A7FB5', coverTheme: 'deep-sea', desc: '', order: b, archived: false })
      const bn = Math.max(4, Math.round(S.boardCats / 4))
      for (let i = 0; i < S.boardCats; i++) {
        boardCats.push({ id: `bc-${pad(b)}-${pad(i)}`, workspaceId: wid, name: `类别 ${i}`, order: i, parentId: i < bn ? undefined : `bc-${pad(b)}-${pad(i % bn)}` })
      }
    }

    const resources = []
    const mkRes = (id, wsId, catId, i) => ({
      id, kind: 'resource', title: `资源条目 ${i} · 深度学习与教育规划方法论研究笔记`,
      linkType: i % 5 === 0 ? 'file' : 'url',
      link: i % 5 === 0 ? `file:///tmp/doc-${i}.pdf` : `https://example.com/article/${i}`,
      workspaceId: wsId, categoryId: catId || '', tags: i % 3 === 0 ? ['AI', '效率'] : ['研究'],
      pinned: i % 37 === 0, starred: i % 23 === 0, callCount: i % 11,
      lastCalledAt: now - i * 3600000, curOrder: i,
      description: `这是第 ${i} 条资源的描述文本，用于测试搜索与卡片渲染性能。`,
      customFields: { custom_a: '张三', custom_b: `备注${i}` },
      createdAt: now - i * 60000, updatedAt: now - i * 30000,
      assets: i % 17 === 0 ? [{ id: `as-${i}`, kind: 'pdf', name: `附件${i}.pdf`, size: 1024 * (i + 1), mime: 'application/pdf', createdAt: now }] : []
    })
    for (let i = 0; i < S.hubCards; i++) resources.push(mkRes(`hr-${pad(i)}`, HUB, hubCats[i % hubCats.length].id, i))
    for (let b = 0; b < S.boards; b++) for (let i = 0; i < S.boardCards; i++) {
      resources.push(mkRes(`br-${pad(b)}-${pad(i)}`, `ws-b${pad(b)}`, `bc-${pad(b)}-${pad(i % S.boardCats)}`, b * 1000 + i))
    }

    const projections = []
    let pj = 0
    for (let b = 0; b < S.boards; b++) {
      for (let i = 0; i < Math.round(S.hubCards / S.boards); i++) {
        projections.push({ id: `cp-${pad(pj)}`, kind: 'card', wsId: HUB, cardId: `hr-${pad(pj % S.hubCards)}`,
          catId: hubCats[pj % hubCats.length].id, targetWsId: `ws-b${pad(b)}`,
          targetCatId: `bc-${pad(b)}-${pad(i % S.boardCats)}`, addedAt: now - pj * 1000 })
        pj++
      }
    }

    const tasks = []
    for (let i = 0; i < S.tasks; i++) {
      tasks.push({ id: `tk-${pad(i)}`, kind: 'task', title: `任务 ${i} · 完成教育规划访谈提纲`,
        status: ['todo', 'doing', 'done'][i % 3], priority: ['high', 'medium', 'low'][i % 3],
        tags: ['规划'], customFields: {}, mountedResourceIds: [], mountedCuriosityIds: [],
        projectId: `pj-${i % 12}`, metricId: `mt-${i % 36}`, dueDate: '2026-10-01',
        createdAt: now - i * 60000, updatedAt: now - i * 30000 })
    }
    const curiosities = []
    for (let i = 0; i < S.curiosities; i++) {
      curiosities.push({ id: `cu-${pad(i)}`, kind: 'curiosity', question: `好奇心问题 ${i}：AI 时代的教育规划该怎么做？`,
        status: ['todo', 'doing', 'done', 'shelf'][i % 4], pinned: false, tags: ['教育'],
        customFields: {}, relatedResourceIds: [], createdAt: now - i * 60000, updatedAt: now - i * 30000 })
    }

    const directions = []
    for (let dIdx = 0; dIdx < 6; dIdx++) {
      const projects = []
      for (let p = 0; p < 6; p++) {
        const metrics = []
        for (let m = 0; m < 3; m++) metrics.push({ id: `mt-${dIdx * 18 + p * 3 + m}`, title: `指标 ${m}`, target: '10', acceptance: '', taskIds: [] })
        projects.push({ id: `pj-${dIdx * 6 + p}`, name: `项目 ${p}`, isFocused: p === 0, progress: 30, status: 'active', order: p, metrics })
      }
      directions.push({ id: `dr-${dIdx}`, name: `方向 ${dIdx}`, status: 'active', term: 'mid', projects })
    }

    const data = Object.assign({}, base, {
      version: 2, hubMigratedAt: now, hubMergedAt: now,
      workspaces: [{ id: HUB, name: '资源台', icon: '🗂', color: '#3A6B4C', coverTheme: 'deep-sea', desc: '', order: -1, archived: false, kind: 'resource' }, ...boards],
      categories: [...hubCats, ...boardCats],
      resources, tasks, curiosities, curationProjections: projections,
      compass: { vision: { content: '愿景', updatedAt: now }, mission: { content: '使命', updatedAt: now }, directions },
      tagTree: [{ id: 'tg-1', name: 'AI', children: [] }, { id: 'tg-2', name: '效率', children: [] }, { id: 'tg-3', name: '研究', children: [] }],
      dailyFocus: {}, airtableSync: { pat: '', baseId: '', tableId: '', pollEnabled: false }, airtableMap: {}
    })
    return new Promise((resolve) => {
      chrome.storage.local.set({ zy_data_v2: data }, () => resolve({
        hubCats: hubCats.length, resources: resources.length, projections: projections.length,
        tasks: tasks.length, boards: S.boards
      }))
    })
  }, S)
  log(`种子数据：分类 ${seed.hubCats} · 资源卡 ${seed.resources} · 投射 ${seed.projections} · 任务 ${seed.tasks} · 策展台 ${seed.boards}`)
  out.seed = seed
  await page.waitForTimeout(400)

  // ══════════ M1 冷启动（真·全新加载，到调度台首页可交互）══════════
  // 注意：page.goto 只改 hash 时不会重新加载文档——必须先离开再进入，否则测到的是客户端路由切换
  await page.goto('about:blank')
  await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => new Promise(r => {
    const t = setInterval(() => { if (window.__ready != null) { clearInterval(t); r() } }, 12)
    setTimeout(() => { clearInterval(t); r() }, 20000)
  }))
  const m1 = await page.evaluate(() => window.__ready)
  push('M1_冷启动_首页可交互(ms)', m1)
  log('  实际路由：' + await page.evaluate(() => location.hash))
  // 冷启动剖析：脚本加载耗时 / 首屏绘制 / 存储 IO / 启动期长任务
  const boot = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource')
      .map(e => ({ n: e.name.split('/').pop().split('?')[0], it: e.initiatorType, s: Math.round(e.startTime), d: Math.round(e.duration), end: Math.round(e.responseEnd) }))
      .filter(e => /\.js$/.test(e.n))
    return {
      marks: window.__marks || {},
      io: window.__io || [],
      paint: (performance.getEntriesByType('paint') || []).map(x => ({ n: x.name, t: Math.round(x.startTime) })),
      scripts: res.sort((a, b) => a.end - b.end),
      longtasks: (window.__lt || []).slice()
    }
  })
  out.boot = boot
  log(`  时间标记：${JSON.stringify(boot.marks)}`)
  log(`  存储 IO：${JSON.stringify(boot.io)}`)
  log(`  首屏绘制：${JSON.stringify(boot.paint)}`)
  log(`  脚本加载（按完成时间）：${boot.scripts.map(s => `${s.n}(+${s.end}ms/${s.d}ms,${s.it})`).join(' ')}`)
  log(`  启动期长任务：${boot.longtasks.length} 次 ${JSON.stringify(boot.longtasks.slice(0, 8))}`)

  // 交互期长任务从此刻起单独计数
  await page.evaluate(() => { window.__ltMark = (window.__lt || []).length })

  // R114-59：--profile = CDP CPU 采样包住交互窗口，函数级归因 M3 长任务
  const PROFILE = argv.includes('--profile')
  let cdp = null
  if (PROFILE) {
    cdp = await ctx.newCDPSession(page)
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
    await cdp.send('Profiler.start')
  }

  // ══════════ M2 切台耗时（顶栏导航 → 视图就位；含首次 chunk 加载）══════════
  log('  顶栏 Tab：' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.tabs .tab')].map(e => (e.textContent || '').trim().slice(0, 14)))))
  const navCC = await page.evaluate(() => window.__navTo('资源台', '.view-tab'))
  if (navCC >= 0) push('M2a_切到资源台(ms)', navCC)
  // R112 修脚本漂移：原用前缀 '策展台'，但顶栏策展台 Tab 文本已被剥成「📘PERF0」，
  // 唯一含「策展台」三字的可匹配项是溢出指示（见 __navTo 内注释）→ 打满 15000ms 超时。
  // R109/R111 记录的 15006/15019ms 即此超时值，非真实耗时。改用与下方一致的 PERF0 定位。
  const navWS = await page.evaluate(() => window.__navTo('PERF0', '.res-card'))
  if (navWS >= 0) push('M2b_切到策展台(ms)', navWS)

  // ══════════ 资源台 ══════════
  await page.evaluate(() => window.__navTo('资源台', '.view-tab'))
  const ccTree = await page.evaluate(() => window.__treeRerender())
  if (ccTree >= 0) push('M4a_资源台左树重渲染(ms)', ccTree)
  out.metrics.ccCatRows = await page.locator('.cat-item').count()
  log(`  （资源台左树节点数 ${out.metrics.ccCatRows}）`)

  const ccSearch = await page.evaluate(() => window.__searchType('.toolbar-search input', '资源条目'))
  if (ccSearch >= 0) push('M4b_资源台搜索键入6字(ms)', ccSearch)

  const ccViews = await page.evaluate(() => window.__switchViews('.view-tab'))
  log('  资源台视图切换：' + JSON.stringify(ccViews))
  out.raw.push({ target: '资源台视图切换', data: ccViews })

  // ══════════ 策展台（原生+镜像混排）══════════
  await page.evaluate(() => window.__navTo('PERF0', '.res-card'))
  await page.evaluate(() => window.__flush())
  log('  实际路由：' + await page.evaluate(() => location.hash))

  const wsTree = await page.evaluate(() => window.__treeRerender())
  if (wsTree >= 0) push('M2b_策展台侧栏重渲染(ms)', wsTree)
  out.metrics.wsCatRows = await page.locator('.ws-sidebar .cat-item').count()
  log(`  （策展台左树节点数 ${out.metrics.wsCatRows}）`)

  const wsSearch = await page.evaluate(() => window.__searchType('.toolbar-search input', '资源条目'))
  if (wsSearch >= 0) push('M2c_策展台搜索键入6字(ms)', wsSearch)

  const wsViews = await page.evaluate(() => window.__switchViews('.ws-toolbar .view-tab'))
  log('  策展台视图切换：' + JSON.stringify(wsViews))
  out.raw.push({ target: '策展台视图切换', data: wsViews })

  // ══════════ M3 长任务汇总（交互期，不含启动期）══════════
  const lt = await page.evaluate(() => {
    const all = window.__lt || []
    const arr = all.slice(window.__ltMark || 0).map(x => x.d).sort((a, b) => b - a)
    return { count: arr.length, total: arr.reduce((s, x) => s + x, 0), max: arr[0] || 0, top5: arr.slice(0, 5) }
  })
  push('M3_交互期长任务总计(ms)', lt.total, { M3_长任务次数: lt.count, M3_最大单任务ms: lt.max })
  log(`  交互期长任务：${lt.count} 次 · 总计 ${lt.total}ms · 最大 ${lt.max}ms · Top5 ${JSON.stringify(lt.top5)}`)

  if (PROFILE && cdp) {
    const { profile } = await cdp.send('Profiler.stop')
    const nodes = new Map(profile.nodes.map(n => [n.id, n]))
    const self = new Map()
    for (const id of profile.samples || []) {
      const n = nodes.get(id)
      if (!n) continue
      const cf = n.callFrame
      const label = (cf.functionName || '(anonymous)') + ' @ ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1)
      self.set(label, (self.get(label) || 0) + 1)
    }
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
    log('  CDP 采样 Top（样本数≈ms @1kHz）：')
    for (const [k, v] of top) log(`    ${String(v).padStart(6)}  ${k}`)
    fs.writeFileSync(path.resolve(__dirname, '..', '.prof-report.json'), JSON.stringify(top.map(([k, v]) => ({ samples: v, fn: k })), null, 1))
  }

  // ══════════ M2c 回调度台（R114-59：用户反馈「回到调度台慢」，此前无度量）══════════
  const navBack = await page.evaluate(() => window.__navTo('调度台', '.wr-entry'))
  if (navBack >= 0) push('M2c_回到调度台(ms)', navBack)

  // ══════════ M5 全局搜索浮层（content 脚本，http 宿主页；R114-59 重写假 M6）══════════
  // 新开独立长任务窗口：M3 已按原窗口（启动→M2b）汇总完毕，此处窗口二只覆盖 M2c+M5，互不污染。
  await page.evaluate(() => { window.__ltMark2 = (window.__lt || []).length })
  await page.goto(`http://127.0.0.1:${gsPort}/`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)   // 等 content script 注入 + 空闲预热浮层实现

  const gsOpen = async () => {
    const t0 = Date.now()
    await worker.evaluate(async (port) => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:' + port + '/*' })
      if (!tabs[0]) throw new Error('宿主页 tab 未找到')
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-search' })
    }, gsPort)
    await page.waitForSelector('#__zy_si__', { timeout: 8000 })
    return Date.now() - t0
  }
  const gsXs = []
  try {
    await gsOpen()                                   // 首次唤起（含字典 chunk 并行加载，不计入）
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    for (let k = 0; k < 2; k++) { gsXs.push(await gsOpen()); if (!k) { await page.keyboard.press('Escape'); await page.waitForTimeout(400) } }
    gsXs.sort((a, b) => a - b)
    push('M5a_全局搜索唤起(ms)', gsXs[Math.floor(gsXs.length / 2)])

    const gsType = await page.evaluate(() => window.__searchType('#__zy_si__', '资源条目', 60))  // 浮层防抖 60ms
    if (gsType >= 0) push('M5b_全局搜索键入6字净耗时(ms)', gsType)
    const gsCount = await page.locator('.zy-result-item').count()
    out.metrics.M5_结果行数 = gsCount
  } catch (e) {
    log('  ⚠ M5 全局搜索采样失败：' + e.message)
    out.metrics.M5_采样失败 = 1
  }
  await page.keyboard.press('Escape').catch(() => {})
  gsServer.close()

  // M3b：窗口二（回调度台 + 全局搜索）的长任务汇总
  const lt2 = await page.evaluate(() => {
    const all = window.__lt || []
    const arr = all.slice(window.__ltMark2 || 0).map(x => x.d).sort((a, b) => b - a)
    return { count: arr.length, total: arr.reduce((s, x) => s + x, 0), max: arr[0] || 0, top5: arr.slice(0, 5) }
  })
  push('M3b_窗口二长任务总计(ms)', lt2.total, { M3b_长任务次数: lt2.count, M3b_最大单任务ms: lt2.max })
  log(`  窗口二长任务（M2c+M5）：${lt2.count} 次 · 总计 ${lt2.total}ms · 最大 ${lt2.max}ms · Top5 ${JSON.stringify(lt2.top5)}`)

  await ctx.close()

  log('\n══════════ 汇总 ══════════')
  for (const [k, v] of Object.entries(out.metrics)) log(`  ${k}: ${v}`)
  const outFile = path.resolve(__dirname, '..', '.perf-report.json')
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  if (JSON_ONLY) console.log(JSON.stringify(out))
  log(`\n报告已写入 ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
