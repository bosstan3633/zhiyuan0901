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
 *   M6  保存链路耗时（R131-C1 门禁）：整库 JSON 序列化 + 同载荷 storage.local.set 写盘
 *       （写独立探针键，不碰 zy_data_v2——避免触发应用合并路径污染采样）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME_PINNED = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
/** R145（承 e2e.cjs R128 同规则）：pinned 缓存不存在 → ZY_CHROME → 本机 ms-playwright 任一 Chromium → 系统 Chrome。
 *  门禁不因本机缺某个版本的浏览器而失守（06-2 B-1：门禁不跑 = 没有门禁）。 */
const CHROME = (() => {
  if (fs.existsSync(CHROME_PINNED)) return CHROME_PINNED
  if (process.env.ZY_CHROME) return process.env.ZY_CHROME
  const cache = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
  try {
    const hit = fs.readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort().pop()
    if (hit) {
      const p = path.join(cache, hit, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      if (fs.existsSync(p)) return p
    }
  } catch { /* 无缓存目录 */ }
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return process.platform === 'darwin' && fs.existsSync(sys) ? sys : CHROME_PINNED
})()
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
  // R148：写盘探针——记下每次 set 写了哪些键（判断"点一下改一个字段，主 JSON 被重写几次"）
  const __keysOf = (a) => { try { return a && typeof a === 'object' ? Object.keys(a).join(',') : '' } catch (e) { return '' } }
  window.__keysOf = __keysOf
  const wrap = (name) => {
    const orig = cs[name].bind(cs)
    cs[name] = function (...args) {
      const t0 = performance.now()
      const cbIdx = args.findIndex(a => typeof a === 'function')
      if (cbIdx >= 0) {
        const cb = args[cbIdx]
        args[cbIdx] = (...r) => { window.__io.push({ op: name, ms: Math.round(performance.now() - t0), at: Math.round(t0), keys: __keysOf(args[0]) }); cb(...r) }
        return orig(...args)
      }
      const p = orig(...args)
      if (p && typeof p.then === 'function') {
        return p.then(r => { window.__io.push({ op: name, ms: Math.round(performance.now() - t0), at: Math.round(t0), keys: __keysOf(args[0]) }); return r })
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
/** R148：一次点击的"卡顿账单"——同步成本 + 之后 1.5s 内的长任务阻塞量 + 主数据键被重写几次 */
window.__clickCost = async function (sel, waitMs) {
  const el = document.querySelector(sel)
  if (!el) return null
  const lt0 = (window.__lt || []).length
  const io0 = (window.__io || []).length
  await window.__flush()
  const t0 = performance.now()
  el.click()
  await window.__flush()
  const sync = performance.now() - t0
  await new Promise(r => setTimeout(r, waitMs == null ? 1500 : waitMs))
  const lts = (window.__lt || []).slice(lt0).map(x => x.d)
  const sets = (window.__io || []).slice(io0).filter(x => x.op === 'set')
  return {
    sync: Math.round(sync * 10) / 10,
    block: lts.reduce((s, x) => s + x, 0),
    maxlt: lts.length ? Math.max.apply(null, lts) : 0,
    mainWrites: sets.filter(x => /zy_data_v2/.test(x.keys || '')).length,
    allWrites: sets.length,
  }
}
/** R148：多次取中位的点击账单 */
window.__clickMedian = async function (sel, times) {
  const n = times || 3
  const xs = []
  for (let i = 0; i < n; i++) { const v = await window.__clickCost(sel); if (!v) return null; xs.push(v); await new Promise(r => setTimeout(r, 250)) }
  const pick = (k) => { const a = xs.map(x => x[k]).sort((p, q) => p - q); return a[Math.floor(a.length / 2)] }
  return { sync: pick('sync'), block: pick('block'), maxlt: pick('maxlt'), mainWrites: pick('mainWrites'), allWrites: pick('allWrites') }
}
/** R148：hash 导航到某视图并等首屏就位（测"切模块"的端到端主观耗时，含 chunk 加载与重挂载） */
window.__hashTo = async function (hash, sel, resetHash) {
  if (resetHash) { location.hash = resetHash; await new Promise(r => setTimeout(r, 900)); await window.__flush() }
  const lt0 = (window.__lt || []).length
  const t0 = performance.now()
  location.hash = hash
  const w = await window.__waitFor(() => document.querySelector(sel), 12000)
  await window.__flush()
  const wall = performance.now() - t0
  const lts = (window.__lt || []).slice(lt0).map(x => x.d)
  return { wall: Math.round(wall), wait: w, block: lts.reduce((s, x) => s + x, 0), maxlt: lts.length ? Math.max.apply(null, lts) : 0 }
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

  // ══════════ R151 M3d · 静置对照（--idle-control 才跑）：什么都不点，纯等 20s ══════════
  // 目的：M3c 那 6~9s 长任务到底是知源的 JS 还是测试环境本身？同样的库、同样的页面，
  // 不做任何交互再采一次——若静置也出同等量级的周期性长任务，这个指标就不能当"用户卡顿"读。
  if (argv.includes('--idle-control')) {
    await page.evaluate(() => { window.__ltMarkIdle = (window.__lt || []).length })
    await page.waitForTimeout(20000)
    const ltIdle = await page.evaluate(() => {
      const raw = (window.__lt || []).slice(window.__ltMarkIdle || 0)
      const arr = raw.map(x => x.d).sort((a, b) => b - a)
      return { count: arr.length, total: arr.reduce((s, x) => s + x, 0), max: arr[0] || 0 }
    })
    push('M3d_静置20s长任务总计(ms)', ltIdle.total, { M3d_长任务次数: ltIdle.count, M3d_最大单任务ms: ltIdle.max })
    log(`  M3d 静置对照（零交互 20s）：${ltIdle.count} 次 · 总计 ${ltIdle.total}ms · 最大 ${ltIdle.max}ms`)
  }

  // ══════════ R148 窗口三：用户点名的四类交互（单击卡片 / 置顶 / 切底部 tab / 进设置页）══════════
  // 单独开窗：M3（启动→切台）与 M3b（回调度台+全局搜索）的口径都不受影响。
  await page.evaluate(() => { window.__ltMark3 = (window.__lt || []).length; window.__t3 = Math.round(performance.now()) })
  // R151：--profile 时窗口三单独再采一次 CPU 谱。M3c 那 6~9s 长任务与本轮改的链路无关（R148/R149/R150
  // 三轮同量级），只靠长任务条数推不出是谁；采样间隔 1ms，只在归因跑里开（开采样本身会把数字抬高一点）。
  if (PROFILE && cdp) { await cdp.send('Profiler.start') }
  await page.evaluate(() => window.__navTo('资源台', '.view-tab'))
  await page.waitForTimeout(400)

  const m7 = await page.evaluate(() => window.__clickMedian('.res-card'))
  if (m7) { push('M7_单击卡片开详情_同步(ms)', m7.sync, { 'M7_阻塞总量ms': m7.block, 'M7_最大长任务ms': m7.maxlt, 'M7_主键重写次数': m7.mainWrites }); log(`  M7 明细：${JSON.stringify(m7)}`) }

  const m8 = await page.evaluate(() => window.__clickMedian('.rc-action.pin'))
  if (m8) { push('M8_点置顶_同步(ms)', m8.sync, { 'M8_阻塞总量ms': m8.block, 'M8_最大长任务ms': m8.maxlt, 'M8_主键重写次数': m8.mainWrites }); log(`  M8 明细：${JSON.stringify(m8)}`) }

  // 切底部 tab（任务调度 ↔ 好奇心培育；隐藏视图是否跟着重算就体现在这里）
  await page.evaluate(() => { location.hash = '#/' })
  await page.waitForTimeout(900)
  const m10 = await page.evaluate(() => window.__clickMedian('.bt-tab:last-child'))
  if (m10) { push('M10_切底部tab_同步(ms)', m10.sync, { 'M10_阻塞总量ms': m10.block, 'M10_最大长任务ms': m10.maxlt }); log(`  M10 明细：${JSON.stringify(m10)}`) }

  // 进设置页：冷挂载 vs 二次挂载（keep-alive 补齐后第二次应显著变快）
  const m9cold = await page.evaluate(() => window.__hashTo('#/settings', '.gs-nav-item', '#/'))
  const m9warm = await page.evaluate(() => window.__hashTo('#/settings', '.gs-nav-item', '#/'))
  push('M9a_进设置页_冷挂(ms)', m9cold.wall, { 'M9a_阻塞ms': m9cold.block })
  push('M9b_进设置页_二次(ms)', m9warm.wall, { 'M9b_阻塞ms': m9warm.block, 'M9_二次是否仍全量重挂': m9warm.block > m9cold.block * 0.5 ? 1 : 0 })
  log(`  M9 冷 ${JSON.stringify(m9cold)} / 暖 ${JSON.stringify(m9warm)}`)

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
    const top3 = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)
    log(`  窗口三 CDP 采样 Top（1ms/样本 · 合计 ${profile.samples ? profile.samples.length : 0}ms 命中）：`)
    for (const [k, v] of top3) log(`    ${String(v).padStart(6)}ms  ${k}`)
    fs.writeFileSync(path.resolve(__dirname, '..', '.prof-window3.json'), JSON.stringify(top3.map(([k, v]) => ({ samples: v, fn: k })), null, 1))
  }
  const lt3 = await page.evaluate(() => {
    const all = window.__lt || []
    const raw = all.slice(window.__ltMark3 || 0)
    const arr = raw.map(x => x.d).sort((a, b) => b - a)
    return { count: arr.length, total: arr.reduce((s, x) => s + x, 0), max: arr[0] || 0,
      at: raw.map(x => ({ d: x.d, t: x.s - (window.__t3 || 0) })).sort((p, q) => q.d - p.d).slice(0, 8) }
  })
  log(`  窗口三长任务时间轴（ms，距窗口起点）：${JSON.stringify(lt3.at)}`)
  push('M3c_窗口三长任务总计(ms)', lt3.total, { M3c_长任务次数: lt3.count, M3c_最大单任务ms: lt3.max })
  log(`  窗口三长任务（M7/M8/M10/M9）：${lt3.count} 次 · 总计 ${lt3.total}ms · 最大 ${lt3.max}ms`)

  // ══════════ R148 M11/M12：切台的"完整账单"（首帧就位 ≠ 渲染结束）══════════
  // __navTo 只量到目标选择器出现，760 卡的排版/增量渲染在其后仍在跑长任务——用户感知的"切换卡"正是这段。
  const switchBill = async (tabText, settleMs) => page.evaluate(async ([txt, settle]) => {
    const pick = () => [...document.querySelectorAll('.tabs .tab')]
      .filter(e => !/tab-add|tab-collapse|adding|tab-overflow/.test(e.className))
      .find(e => ((e.getAttribute('title') || '') + (e.textContent || '')).includes(txt))
    location.hash = '#/'; await new Promise(r => setTimeout(r, 1400)); await window.__flush()
    const lt0 = (window.__lt || []).length
    const t0 = performance.now()
    const el = pick(); if (!el) return null
    el.click()
    const first = await window.__waitFor(() => document.querySelector('.view-tab, .res-card'), 12000)
    const fms = Math.round(performance.now() - t0)
    await new Promise(r => setTimeout(r, settle))
    const lts = (window.__lt || []).slice(lt0).map(x => x.d)
    return { first: fms, block: lts.reduce((s, x) => s + x, 0), n: lts.length, max: lts.length ? Math.max.apply(null, lts) : 0 }
  }, [tabText, settleMs])

  const m11 = await switchBill('资源台', 3000)
  if (m11) { push('M11_切到资源台_首帧(ms)', m11.first, { 'M11_后3s阻塞ms': m11.block, 'M11_长任务次数': m11.n, 'M11_最大单任务ms': m11.max }); log(`  M11 明细：${JSON.stringify(m11)}`) }
  const m12 = await switchBill('PERF0', 3000)
  if (m12) { push('M12_切到策展台_首帧(ms)', m12.first, { 'M12_后3s阻塞ms': m12.block, 'M12_长任务次数': m12.n, 'M12_最大单任务ms': m12.max }); log(`  M12 明细：${JSON.stringify(m12)}`) }

  // ══════════ R148 M13：来回切台 4 次（用户说的"模块之间切换"就是这个动作序列）══════════
  const m13 = await page.evaluate(async () => {
    const pick = (txt) => [...document.querySelectorAll('.tabs .tab')]
      .filter(e => !/tab-add|tab-collapse|adding|tab-overflow/.test(e.className))
      .find(e => ((e.getAttribute('title') || '') + (e.textContent || '')).includes(txt))
    location.hash = '#/'; await new Promise(r => setTimeout(r, 1200))
    const lt0 = (window.__lt || []).length
    const t0 = performance.now()
    const per = []
    for (let k = 0; k < 4; k++) {
      const a = performance.now()
      pick('资源台')?.click(); await window.__waitFor(() => document.querySelector('.view-tab, .res-card'), 8000); await new Promise(r => setTimeout(r, 250))
      const b = performance.now()
      pick('调度台')?.click(); await window.__waitFor(() => document.querySelector('.mb-cell'), 8000); await new Promise(r => setTimeout(r, 250))
      per.push([Math.round(b - a), Math.round(performance.now() - b)])
    }
    const lts = (window.__lt || []).slice(lt0).map(x => x.d)
    return { wall: Math.round(performance.now() - t0), block: lts.reduce((s2, x) => s2 + x, 0), n: lts.length, max: lts.length ? Math.max.apply(null, lts) : 0, per }
  })
  push('M13_来回切台4次_墙钟(ms)', m13.wall, { 'M13_阻塞ms': m13.block, 'M13_长任务次数': m13.n, 'M13_最大单任务ms': m13.max })
  log(`  M13 每轮 [去资源台, 回调度台] = ${JSON.stringify(m13.per)} · 阻塞 ${m13.block}ms/${m13.n} 次 · 最大 ${m13.max}ms`)

  // ══════════ M2c 回调度台（R114-59：用户反馈「回到调度台慢」，此前无度量）══════════
  const navBack = await page.evaluate(() => window.__navTo('调度台', '.mb-cell')) // R145 修漂移：.wr-entry（周报入口）早已改名，15s 超时被当成耗时
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

  // ══════════ M6 保存链路耗时（R131-C1 门禁：保存路径此前无度量）══════════
  // 复刻 saveData 计时区间的两段主线程成本：整库 JSON.stringify + 同载荷 storage.local.set。
  // 写独立探针键（不碰 zy_data_v2）：直写现役键会被 isSelfWrite 判为外部写入 → 触发合并再写一轮，污染采样。
  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  let m6 = null
  try {
    m6 = await page.evaluate(async () => {
      const got = await new Promise(res => chrome.storage.local.get('zy_data_v2', r => res(r.zy_data_v2)))
      if (!got) return null
      const t1 = performance.now()
      const s = JSON.stringify(got)
      const t2 = performance.now()
      await new Promise(res => chrome.storage.local.set({ zy_perf_probe: s }, res))
      const t3 = performance.now()
      await new Promise(res => chrome.storage.local.remove('zy_perf_probe', res))
      return { json: Math.round(t2 - t1), set: Math.round(t3 - t2), kb: Math.round(s.length / 1024) }
    })
  } catch (e) { log('  ⚠ M6 保存采样失败：' + e.message) }
  if (m6) push('M6a_整库JSON序列化(ms)', m6.json, { 'M6b_同载荷set写盘(ms)': m6.set, M6_载荷KB: m6.kb })

  await ctx.close()

  log('\n══════════ 汇总 ══════════')
  for (const [k, v] of Object.entries(out.metrics)) log(`  ${k}: ${v}`)
  const outFile = path.resolve(__dirname, '..', '.perf-report.json')
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  if (JSON_ONLY) console.log(JSON.stringify(out))
  log(`\n报告已写入 ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
