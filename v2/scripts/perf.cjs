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
 *   ★V3.9.19（2026-10-24）度量随迁备案（产品面退役后的锚点大修，同回归备案仪式）：
 *     · M1 探针锚 .storage-chip 已随页脚状态栏退役 ⇒ 恒 0ms 假指标，改锚 .page .desk-head（调度台真实首屏根，与 perf-slo 同锚）；
 *     · 策展台首帧锚 .res-card / .view-tab 已随 V3.9.8 策展成果态（四视图+左树退役、单一画布）⇒ 15s 超时被当耗时，
 *       改锚 .ws-page（工作区根）；调度台腿 .mb-cell 改锚 .page .desk-head；
 *     · 退役指标（产品面已不存在，不留假数）：M4 全家（资源台 R179 退役：左树/搜索/视图切换）、
 *       M2b 侧栏重渲染（左树退役）、M2d 视图切换（四视图退役）、M11 切到资源台；
 *     · M14 真库首屏从资源台改在策展画布量（.mind-stage / .mind-node，真库最重表面）；
 *     · M2c 策展台搜索键入保留（.toolbar-search input 现役）。
 *   M2  策展台：视图切换 / 侧栏分类树重渲染 / 搜索键入  （卡片+镜像混排的主战场）
 *   M4  资源台：视图切换 / 左树节点计数重渲染 / 搜索键入（nodeCount 类 O(n²) 重灾区）
 *   M3  长任务总计 / 最大单任务（ms）——交互序列（启动→M2b 窗口）的主线程阻塞量
 *   M3b 窗口二（M2c 回调度台 + M5 全局搜索）的主线程阻塞量（R114-59 新增，与 M3 分窗互不污染）
 *   M2c 回到调度台耗时（R114-59 新增——此前无度量）
 *   M5  全局搜索浮层：唤起 / 键入 6 字净耗时（R114-59 重写——旧 M6 在扩展页派发合成按键，无监听者，恒 ≈0ms 假指标）
 *   M5c/M5d 应用内 ⌘K 检索面板（newtab 侧 GlobalPopups.vue）：唤起 / 键入净耗时 + 命中与渲染行数
 *       （R4-P2 新增。M5/R7 量的是 content 浮层那条链，#71「检索链路瘦身」要瘦的是归一化+分组+v-html
 *        这条，改前它在整套指标里零覆盖——先立尺子再动手）
 *   M6  保存链路耗时（R131-C1 门禁）：整库 JSON 序列化 + 同载荷 storage.local.set 写盘
 *       （写独立探针键，不碰 zy_data_v2——避免触发应用合并路径污染采样）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

/* R4-Ea（挂账 #84）：浏览器可执行文件解析统一到 scripts/browser.cjs——四级回落的唯一实现。
   此前这里各抄一份且抄得不一致（img-diff 只写死 chromium-1234，缓存换版本后直接起不来）。 */
const { CHROME, swReady } = require('./browser.cjs')
const argv = process.argv.slice(2)
const DEFAULT_DIST = path.resolve(__dirname, '..', 'dist')
/** R155：支持 `--dist=<目录>` 指定被测包。
 *  为什么需要它：做同机 A/B（新版 vs 上一版）时，旧做法是 `mv` 换目录名——R155 实测踩到
 *  `mv A B` 撞上已存在的同名目录会**把 A 嵌进 B/**，于是 dist 变成不完整的包，
 *  扩展整体加载失败、采样抛错被重定向吞掉，最终读到上一轮残留报告，得出"两版完全一样"的
 *  假结论。改成只读指定目录，全程零移动，A/B 不再有破坏性动作。 */
const DIST_ARG = argv.find(a => a.startsWith('--dist='))
const DIST = DIST_ARG ? path.resolve(DIST_ARG.slice(7)) : DEFAULT_DIST
/** R164：真实路径模式——`--real=<知源备份 JSON>`。数据换真实库、操作换真实高频路径
 *  （切台/单击/键入/滚动/视图切换），指标 R1~R7；与合成档（M 系）互不混用，报告 scale='real'。 */
const REAL_ARG = argv.find(a => a.startsWith('--real='))
const REAL_PATH = REAL_ARG ? path.resolve(REAL_ARG.slice(7)) : ''
const EXT_INDEX = 'src/newtab/index.html'

const SCALES = {
  small:  { hubCards: 100, hubCats: 40,  boards: 3, boardCards: 30, boardCats: 12, tasks: 150, curiosities: 60 },
  medium: { hubCards: 400, hubCats: 100, boards: 6, boardCards: 60, boardCats: 20, tasks: 400, curiosities: 150 },
  large:  { hubCards: 900, hubCats: 200, boards: 8, boardCards: 80, boardCats: 25, tasks: 700, curiosities: 300 }
}

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
/** R173-T0：__switchViews 的结果是"每视图一份账单"（最小/中位/散布 + 阻塞 + 项数），逐视图展平成指标。
 *  ★ 口径（06-2 §B 通则）：本机 ms 级噪声压不干净 ⇒ 主指标取**同批最小值**（无噪声下界），
 *  中位与散布倍数并列写出供审——散布 >2 倍时只有最小值与结构量（项数）能读。 */
function pushViews(prefix, obj) {
  if (!obj) return
  for (const [k, v] of Object.entries(obj)) {
    if (v && v.ms != null && v.ms >= 0) {
      out.metrics[prefix + k + '(ms)'] = v.ms
      out.metrics[prefix + k + '_中位ms'] = v.msMed
      out.metrics[prefix + k + '_散布倍数'] = v.spread
      out.metrics[prefix + k + '_阻塞ms'] = v.block
      out.metrics[prefix + k + '_最大单任务ms'] = v.max
      out.metrics[prefix + k + '_项数'] = v.items
      log(`  ${prefix}${k}（→${v.mode}）：最小 ${v.ms}ms / 中位 ${v.msMed}ms（散布 ${v.spread}×）· 阻塞 ${v.block}ms（峰值 ${v.max}）· 项数 ${v.items}${v.itemsOk ? '' : ' ⚠未等到卡元素'}`)
    } else {
      out.metrics[prefix + k + '_失败'] = 1
      log(`  ⚠ ${prefix}${k}：未取到（视图根未渲染）`)
    }
  }
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
    const home = () => document.querySelector('.page .desk-head')  /* ★V3.9.19：原 .storage-chip 已退役（恒 0 假指标）；desk-head = 调度台真实首屏根 */
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
/* ═══ R173-T0：视图感知（量具修正）═══
   缺陷（R172 实测）：真库 hub 有中心论点 ⇒ 默认渲染「金字塔」视图，而量具一律等「.res-card」。
   后果不是"慢"，是**量错了东西**——等待条件永不成立（无上限 while ⇒ 打满超时甚至挂死），
   而静默 catch 会把卡片视图的数字贴上「看板」的标签。修法：量具先认当前视图，按视图取
   就绪元素与卡片元素，并把"实际看到的视图"写进结果，读的人一眼能校验。 */
window.__VIEW_ROOT = { card: '.ws-view', list: '.ws-view', kanban: '.kanban', pyramid: '.pyramid' }
window.__VIEW_CARD = { card: '.res-card', list: '.res-row', kanban: '.kc-card', pyramid: '.py-card-chip' }
/** 当前工作台视图。限定在 .ws-page 内取——旧版全文档扫类名，别的页面残留同名节点会被误认成本台视图 */
window.__viewOf = function () {
  const pg = document.querySelector('.ws-page')
  if (!pg) return ''
  if (pg.querySelector('.pyramid')) return 'pyramid'
  if (pg.querySelector('.kanban')) return 'kanban'
  const v = pg.querySelector('.ws-view')
  if (!v) return ''
  return v.querySelector('.res-row') ? 'list' : 'card'
}
window.__cardSelOf = function (mode) { return window.__VIEW_CARD[mode || window.__viewOf()] || '.res-card, .res-row, .kc-card, .py-card-chip' }
/** 等「当前视图根」出现（不预设卡片类）：{mode, ms, ok} */
window.__waitViewRoot = async function (timeout) {
  const t0 = performance.now()
  const w = await window.__waitFor(() => !!window.__viewOf(), timeout || 10000)
  return { mode: window.__viewOf(), ms: Math.round(performance.now() - t0), ok: w >= 0 }
}
/** 等该视图的卡片元素（等不到不算失败：返回 n=0 + ok=false，由调用方决定怎么记账） */
window.__waitItems = async function (mode, timeout) {
  const sel = window.__cardSelOf(mode)
  const t0 = performance.now()
  const w = await window.__waitFor(() => document.querySelector(sel), timeout || 3000)
  return { n: document.querySelectorAll(sel).length, ms: Math.round(performance.now() - t0), ok: w >= 0 }
}
/** 长任务窗口（T0 口径：每个动作报「窗口内合计」，不只看最大单条——切看板正是"墙钟短、阻塞重"） */
window.__ltCap = function () { return (window.__lt || []).length }
window.__ltSince = function (cap) {
  const lts = (window.__lt || []).slice(cap).map(x => x.d)
  return { block: lts.reduce((s, x) => s + x, 0), max: lts.length ? Math.max.apply(null, lts) : 0, n: lts.length }
}
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
/** 依次切到每个视图标签，只计「切到目标视图」这一次的主线程耗时（复位切换不计入）。
 *  R173-T0 重写：① 就绪信号按**目标视图**取（旧版只等一个 microtask flush，切看板那 211ms 卡顿量不到）；
 *  ② 每个视图报「窗口内长任务合计 + 最大单条 + 实际渲染出的项数」；③ 结果带视图名，读的人能校验量的是谁。 */
window.__switchViews = async function (sel) {
  const res = {}
  const tabs = [...document.querySelectorAll(sel)]
  const initMode = window.__viewOf()   // 收尾复位到这个视图：本台默认视图（真库 hub=金字塔），
                                       // 旧版一律复位到 tabs[0]（卡片）⇒ 复现出的"默认首屏"被量具自己改掉了
  const modeOf = (tab) => {
    const t = tab.textContent || ''
    return /金字塔/.test(t) ? 'pyramid' : /看板/.test(t) ? 'kanban' : /列表/.test(t) ? 'list' : /卡片/.test(t) ? 'card' : ''
  }
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i], other = tabs[(i + 1) % tabs.length]
    const mode = modeOf(tab)
    if (!mode) continue
    const otherMode = modeOf(other)
    const xs = []
    for (let k = 0; k < 5; k++) {          // 首轮预热
      other.click(); await window.__waitViewRoot(3000); await window.__flush()   // 复位到另一视图（不计时）
      const cap = window.__ltCap()
      const t0 = performance.now()
      tab.click()
      const items = await window.__waitItems(mode, 1200)
      await window.__flush()
      const w = window.__ltSince(cap)
      if (k >= 1) xs.push({ ms: performance.now() - t0, block: w.block, max: w.max, n: w.n, items: items.n, itemsOk: items.ok, itemMs: items.ms })
    }
    xs.sort((a, b) => a.ms - b.ms)
    const lo = xs[0], hi = xs[xs.length - 1]
    const med = xs[Math.floor(xs.length / 2)]
    res[(tab.textContent || '').trim()] = lo
      ? { ms: Math.round(lo.ms * 10) / 10, msMed: Math.round(med.ms * 10) / 10, spread: Math.round((hi.ms / Math.max(lo.ms, 0.1)) * 10) / 10, block: lo.block, max: lo.max, n: lo.n, items: lo.items, itemsOk: lo.itemsOk, itemMs: lo.itemMs, from: otherMode, mode }
      : { ms: -1, mode }
  }
  const back = initMode ? tabs.find(t => modeOf(t) === initMode) : null
  if (back) { back.click(); await window.__waitViewRoot(3000); await window.__flush() }
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
/** R173-T0：键入的完整账单（净耗时 + 窗口内长任务合计 + 最大单条）——合成路径的 __searchType 数字口径保持不变，
 *  真实路径改用本函数（检索是用户点名要调快的动作，只看净耗时看不出"键入时主线程被谁占了"）。 */
window.__searchTypeBill = async function (sel, q, debounceMs) {
  const inp = document.querySelector(sel)
  if (!inp) return null
  const GAP = 8, DEBOUNCE = debounceMs || 240
  const xs = []
  for (let k = 0; k < 5; k++) {
    const cap = window.__ltCap()
    const t0 = performance.now()
    for (let i = 1; i <= q.length; i++) {
      inp.value = q.slice(0, i)
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise(r => setTimeout(r, GAP))
    }
    await new Promise(r => setTimeout(r, DEBOUNCE))
    await window.__flush()
    const net = performance.now() - t0 - q.length * GAP - DEBOUNCE
    const w = window.__ltSince(cap)
    if (k >= 2) xs.push({ net, block: w.block, max: w.max, n: w.n })   // 前 2 轮预热
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 60))
  }
  xs.sort((a, b) => a.net - b.net)
  const lo = xs[0], hi = xs[xs.length - 1], med = xs[Math.floor(xs.length / 2)]
  return lo ? { net: Math.round(lo.net * 10) / 10, netMed: Math.round(med.net * 10) / 10, spread: Math.round((hi.net / Math.max(lo.net, 0.1)) * 10) / 10, block: lo.block, max: lo.max, n: lo.n } : null
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
/** R173-T2：开详情墙钟口径。旧 R3 用 __clickMedian 量 click() 同步段（0.4ms）——开抽屉发生在 260ms
    单双击判别定时器里，同步段够不着它，"单击开详情"名不副实；R172 的 116ms 是 census 的阻塞口径，
    且混着进台 4s 整库写盘。新口径对齐用户感知：关净抽屉 → t0 → 点卡 → 等 body 直属 .drawer 出现 →
    墙钟（判别器成本如实计入）。三次取中位/最小；并记窗口内长任务与主数据键/热度键写盘次数
    ——后两者是结构量，不受 ms 抖动影响。长任务/写盘采集窗延到点击后约 1s：热度键写盘在
    「260 判别器 + 250ms 防抖」之后才落，收集太早会把它读成"零写盘"的假账。 */
window.__openDetailWall = async function (sel, times) {
  const n = times || 3
  const xs = []
  const blocks = []
  let blockSum = 0, mainWrites = 0, hotWrites = 0
  const closeDrawer = async function () {
    if (!document.querySelector('body > .drawer')) return
    const c = document.querySelector('.drawer-close')
    if (c) c.click()
    await window.__waitFor(() => !document.querySelector('body > .drawer'), 3000)
    await new Promise(r => setTimeout(r, 350))
  }
  for (let i = 0; i < n; i++) {
    await closeDrawer()
    const el = document.querySelector(sel)
    if (!el) return null
    const cap = window.__ltCap()
    const io0 = (window.__io || []).length
    const t0 = performance.now()
    el.click()
    const w = await window.__waitFor(() => document.querySelector('body > .drawer'), 4000)
    if (w < 0) return { xs: xs.slice().sort((p, q) => p - q), blocks, failAt: i, block: blockSum, mainWrites, hotWrites }
    xs.push(Math.round(performance.now() - t0))
    await new Promise(r => setTimeout(r, 700))
    const bt = window.__ltSince(cap)
    blockSum += bt.block
    blocks.push(bt.block)
    const sets = (window.__io || []).slice(io0).filter(x => x.op === 'set')
    mainWrites += sets.filter(x => /zy_data_v2/.test(x.keys || '')).length
    hotWrites += sets.filter(x => /zy_stats_v1/.test(x.keys || '')).length
    await new Promise(r => setTimeout(r, 350))
  }
  await closeDrawer()
  const a = xs.slice().sort((p, q) => p - q)
  return { xs: a, min: a[0], med: a[Math.floor(a.length / 2)], max: a[a.length - 1], block: Math.round(blockSum / Math.max(a.length, 1)), blocks, mainWrites, hotWrites }
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

  // R155：先把上一轮的报告删掉。报告是"本次真的跑完了"的证据，不是"上次跑过"的缓存——
  //   做 A/B 时调用方常把失败输出重定向掉（`>/dev/null 2>&1`），若本次中途抛错，
  //   旧报告文件会原封不动留在盘上冒充新读数。R155 实测踩到：扩展加载失败 ⇒ 两轮数字
  //   一字不差（连 0.1ms 都相同），据此一度误判"R155 零性能影响"。
  const reportPath = path.resolve(__dirname, '..', '.perf-report.json')
  try { fs.unlinkSync(reportPath) } catch { /* 本来就没有 */ }

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

  // R155：报告必须自证"测的是哪个构建"。做同机 A/B 时若两轮读数完全相同，第一件要排除的
  // 就是"其实两次测的是同一个包"——从 service worker 里回读 manifest.version 是唯一硬证据
  // （磁盘上的 dist/manifest.json 可能已被换走，不代表浏览器加载的就是它）。
  // R4-Pa：这条 evaluate 必须走 swReady。`serviceworker` 事件在目标挂上时就发，扩展的
  //   chrome.runtime 绑定晚一拍才进上下文——本机实测裸调稳定抛 "Cannot read properties of
  //   undefined (reading 'getManifest')"，perf 因此在第 435 行就退出、连一个指标都不写
  //   （而 perf 是手动工具、不在回归链里，坏了没有任何门禁会红）。
  const loadedVer = (await swReady(worker)).version
  out.build = loadedVer
  console.log(`[perf] 实测构建：manifest.version = ${loadedVer}    (dist = ${DIST})`)

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
  // R173-T0：HARNESS 注入自检——注释里混进反引号会把模板串撕碎（本脚本真实踩过：`.res-card`
  // 被解析成 `res - card`，`node --check` **不报错**，跑起来才 ReferenceError），而探针一旦没装上，
  // 后面的指标全是静默空值。装完立刻验，验不过立即抛。
  const harnessMissing = await page.evaluate(() => ['__waitFor', '__viewOf', '__cardSelOf', '__waitViewRoot', '__waitItems', '__ltCap', '__ltSince', '__switchViews', '__searchTypeBill'].filter(k => typeof window[k] !== 'function'))
  if (harnessMissing.length) throw new Error('HARNESS 注入失败，页面里缺：' + harnessMissing.join(', '))

  // ══════════ R164：--real=<导出 JSON> 真实路径模式 ══════════
  // 为什么单开一条路：M3（合成压力测试）量的是合成库 + 合成操作序列的布局/绘制，与真库体感互相矛盾
  // （R152 真库体检：冷挂 626ms 里主线程阻塞仅 106~173ms、滚动 0 掉帧；M3 恒 20s 级）。
  // 用户体感口径 = 墙钟 + 阻塞 + 掉帧。本模式：数据=真实备份、操作=真实高频路径（切台/单击/键入/滚动/视图切换）。
  if (REAL_PATH) {
    if (!fs.existsSync(REAL_PATH)) throw new Error('--real 文件不存在：' + REAL_PATH)
    const raw = JSON.parse(fs.readFileSync(REAL_PATH, 'utf8'))
    const realData = (raw && typeof raw === 'object' && (raw.data || raw.backup)) || raw
    if (!realData || !Array.isArray(realData.resources)) throw new Error('--real 文件不是知源备份 JSON（需含 resources 数组）')
    out.scale = 'real'
    out.realPath = REAL_PATH
    const seedInfo = await page.evaluate(async (d) => {
      await new Promise(res => chrome.storage.local.set({ zy_data_v2: d }, res))
      return {
        resources: (d.resources || []).length, tasks: (d.tasks || []).length,
        curiosities: (d.curiosities || []).length, workspaces: (d.workspaces || []).length,
        categories: (d.categories || []).length,
      }
    }, realData)
    out.seed = seedInfo
    log('[real] 真实库：资源 ' + seedInfo.resources + ' · 任务 ' + seedInfo.tasks + ' · 好奇 ' + seedInfo.curiosities + ' · 台 ' + seedInfo.workspaces + ' · 分类 ' + seedInfo.categories)
    await page.waitForTimeout(400)

    // R1 冷启动（调度台首页可交互）
    await page.goto('about:blank')
    await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => new Promise(r => {
      const t = setInterval(() => { if (window.__ready != null) { clearInterval(t); r() } }, 12)
      setTimeout(() => { clearInterval(t); r() }, 20000)
    }))
    push('R1_冷启动_首页可交互(ms)', await page.evaluate(() => window.__ready))

    // R2 冷挂资源台（墙钟 + 主线程阻塞 + 长任务）——真实库体感第一现场
    // R173-T0：就绪信号按**当前视图**取（真库 hub 有中心论点 ⇒ 默认金字塔，旧版等 .res-card 会打满超时），
    //   并把实际视图/项数写进报告——否则"量到的是我等错了东西"会被读成"产品很快"。
    const r2 = await page.evaluate(async () => {
      const cap = window.__ltCap()
      const t0 = performance.now()
      /* ★V3.9.19：资源台退役，冷挂目标改第一个策展台 Tab（真库最重表面） */
      const tab = [...document.querySelectorAll('.tabs .tab')].find(e => {
        const txt = ((e.getAttribute('title') || '') + (e.textContent || '')).trim()
        return txt && !/调度台|方向台|设置|手册|画像|回收/.test(txt)
      })
      if (tab) tab.click()
      const rootOk = (await window.__waitFor(() => document.querySelector('.ws-page'), 12000)) >= 0
      const itemsOk2 = (await window.__waitFor(() => document.querySelector('.mind-node'), 2500)) >= 0
      const items = document.querySelectorAll('.mind-node').length
      const wall = Math.round(performance.now() - t0)
      const w = window.__ltSince(cap)
      return { wall, block: w.block, maxlt: w.max, ltN: w.n, view: '策展画布', rootMs: 0, rootOk, items, itemMs: 0, itemsOk: itemsOk2 }
    })
    push('R2_冷挂资源台_墙钟(ms)', r2.wall, { 'R2_冷挂资源台_阻塞ms': r2.block, 'R2_冷挂资源台_最大单任务ms': r2.maxlt, 'R2_冷挂资源台_长任务数': r2.ltN, 'R2_冷挂资源台_视图': r2.view, 'R2_冷挂资源台_视图就绪ms': r2.rootMs, 'R2_冷挂资源台_项数': r2.items })
    await page.waitForTimeout(400)

    // R3 单击开详情（R173-T2 重写口径：点击 → body 直属 .drawer 出现的墙钟中位——含 260ms 单双击判别器，
    //   这是用户真实等待的那段时间；旧口径量 click() 同步段 0.4ms，"单击开详情"名不副实。
    //   R173-T0 保留：点的是"当前视图"的卡元素（真库 hub 默认金字塔 ⇒ .py-card-chip 才是卡），
    //   并把实际视图与选择器写进报告。
    //   前置 4600ms：R2 点进资源台即安排「进台 4s + 防抖」的落盘（当时是整库写盘，真库 49~84ms 序列化），
    //   不等过它会砸进前几轮计量窗——R172 的 116ms 就是这么被读出来的。（T2 拍板 a 后该笔已改走热度键
    //   小载荷，本等待保留：清尾逻辑与落盘通道解耦。）
    await page.waitForTimeout(4600)
    const r3 = await page.evaluate(async () => {
      const mode = window.__viewOf()
      const sel = window.__cardSelOf(mode)
      const bill = await window.__openDetailWall(sel, 3)
      return { mode, sel, bill }
    })
    if (r3.bill && r3.bill.med != null) {
      out.metrics['R3_开详情_点击到抽屉ms'] = r3.bill.med
      out.metrics['R3_开详情_点击到抽屉_最小ms'] = r3.bill.min
      out.metrics['R3_开详情_阻塞均值ms'] = r3.bill.block
      out.metrics['R3_开详情_主数据重写'] = r3.bill.mainWrites
      out.metrics['R3_开详情_热度键写盘'] = r3.bill.hotWrites
      out.metrics['R3_开详情_视图'] = r3.mode
      log('  R3 开详情（' + r3.mode + ' 视图 · ' + r3.sel + '）：点击→抽屉 中位 ' + r3.bill.med + 'ms（三次 ' + r3.bill.xs.join('/') + '，各轮阻塞 ' + (r3.bill.blocks || []).join('/') + 'ms）· 主数据重写 ' + r3.bill.mainWrites + ' 次 · 热度键写盘 ' + r3.bill.hotWrites + ' 次')
    } else {
      out.metrics['R3_开详情_未取到'] = 1
      log('  ⚠ R3 未取到卡元素或抽屉未出现（视图 ' + (r3.mode || '?') + ' · 选择器 ' + r3.sel + '）')
    }
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(300)

    // R4 四视图切换（卡片/列表/看板/金字塔；每视图：中位墙钟 + 窗口内长任务合计 + 实渲染项数）
    const r4 = await page.evaluate(() => window.__switchViews('.ws-toolbar .view-tab'))
    pushViews('R4_视图切换_', r4)

    // R5 滚动掉帧（资源台网格滚动 90 帧）
    const r5 = await page.evaluate(async () => {
      const host = document.querySelector('.ws-content, .card-grid') || document.scrollingElement
      const gaps = []; let last = performance.now(); let raf = 0
      const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; raf = requestAnimationFrame(tick) }
      raf = requestAnimationFrame(tick)
      for (let i = 0; i < 9; i++) { host.scrollTop = host.scrollTop + 240; await new Promise(r => setTimeout(r, 90)) }
      await new Promise(r => setTimeout(r, 200))
      cancelAnimationFrame(raf)
      const g = gaps.slice(1)
      return { frames: g.length, dropped: g.filter(x => x > 34).length, worst: Math.round(Math.max.apply(null, g.concat([0]))) }
    })
    out.metrics['R5_滚动掉帧数'] = r5.dropped
    out.metrics['R5_滚动帧数'] = r5.frames
    out.metrics['R5_滚动最差帧ms'] = r5.worst
    log('  R5 滚动：' + r5.frames + ' 帧 · 掉帧 ' + r5.dropped + ' · 最差 ' + r5.worst + 'ms')

    // R6 M14 真库账单（与合成路径同口径，可直接对比）
    // R173-T0：等待改为有界（旧版无上限 while + 写死 .res-card ⇒ 金字塔下会一直空转、把"量错东西"读成"很轻"）；
    //   卡数按当前视图取，并把视图名写进报告。
    const m14 = await page.evaluate(async () => {
      const gaps = []; let last = performance.now(); let raf = 0
      const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; raf = requestAnimationFrame(tick) }
      raf = requestAnimationFrame(tick)
      /* ★V3.9.19：资源台退役，真库首屏改在策展画布量（真库最重表面：节点 + 连线 + 镜像卡） */
      const t = [...document.querySelectorAll('.tab')].find(e => e.offsetParent && /PERF0/.test(e.innerText || ''))
      if (t) t.click()
      const t0v = performance.now()
      const viewOk = (await window.__waitFor(() => document.querySelector('.mind-stage'), 12000)) >= 0
      const viewMs = Math.round(performance.now() - t0v)
      const itemsOk = (await window.__waitFor(() => document.querySelector('.mind-node'), 2500)) >= 0
      await new Promise(r => setTimeout(r, 500))
      cancelAnimationFrame(raf)
      const vis = e => e.offsetParent !== null
      const cards = [...document.querySelectorAll('.mind-node')].filter(vis).length
      const all = [...document.querySelectorAll('body *')].filter(vis).length
      const svgs = [...document.querySelectorAll('svg')].filter(vis).length
      const marks = [...document.querySelectorAll('.ai-mark, .ai-entry')].filter(vis).length
      const g = gaps.slice(1).sort((x, y) => y - x)
      return { view: '策展画布', viewOk, viewMs, itemsOk, cards, all, svgs, marks, worst: Math.round(g[0] || 0), dropped: gaps.filter(x => x > 34).length, frames: gaps.length }
    })
    out.metrics['R6_真库首屏可见节点'] = m14.all; out.metrics['R6_真库首屏卡片数'] = m14.cards
    out.metrics['R6_真库视图'] = m14.view || '未知'
    out.metrics['R6_真库最差帧ms'] = m14.worst; out.metrics['R6_真库掉帧数'] = m14.dropped
    out.metrics['R6_真库svg元素数'] = m14.svgs; out.metrics['R6_真库AI徽标数'] = m14.marks
    log('  R6 真库账单：视图 ' + (m14.view || '未知') + (m14.viewOk ? '' : ' ⚠视图未就绪') + '（' + m14.viewMs + 'ms）· 可见节点 ' + m14.all
      + '（卡 ' + m14.cards + (m14.itemsOk ? '' : ' ⚠未等到卡元素') + ' · svg ' + m14.svgs + ' · AI 徽标 ' + m14.marks + '）· 最差帧 ' + m14.worst + 'ms · 掉帧 ' + m14.dropped + '/' + m14.frames)

    // R7 全局搜索（content 宿主页）：唤起 + 键入 6 字净耗时
    // R173-T0：唤起也带"窗口内长任务合计"（浮层注入与结果是主线程渲染，墙钟短不代表不卡）；
    //   键入改用完整账单（净耗时 + 阻塞），并保留旧指标名以保持跨版本可比。
    try {
      await page.goto('http://127.0.0.1:' + gsPort + '/', { waitUntil: 'load' })
      await page.waitForTimeout(1200)
      const gsOpen = async () => {
        const cap = await page.evaluate(() => window.__ltCap())
        const t0 = Date.now()
        await worker.evaluate(async (port) => {
          const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:' + port + '/*' })
          if (!tabs[0]) throw new Error('宿主页 tab 未找到')
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'zy-open-search' })
        }, gsPort)
        await page.waitForSelector('#__zy_si__', { timeout: 8000 })
        const w = await page.evaluate((c) => window.__ltSince(c), cap)
        return { wall: Date.now() - t0, block: w.block, max: w.max }
      }
      await gsOpen()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      const xs = []
      for (let k = 0; k < 3; k++) { xs.push(await gsOpen()); if (k < 2) { await page.keyboard.press('Escape'); await page.waitForTimeout(400) } }
      xs.sort((a, b) => a.wall - b.wall)
      const gsMid = xs[Math.floor(xs.length / 2)]
      push('R7_全局搜索唤起(ms)', gsMid.wall, { 'R7_全局搜索唤起_阻塞ms': gsMid.block, 'R7_全局搜索唤起_最大单任务ms': gsMid.max })
      const gsType = await page.evaluate(() => window.__searchTypeBill('#__zy_si__', '教育规划', 60))
      if (gsType && gsType.net >= 0) {
        push('R7_全局搜索键入6字净耗时(ms)', gsType.net, {
          'R7_全局搜索键入_中位ms': gsType.netMed, 'R7_全局搜索键入_散布倍数': gsType.spread,
          'R7_全局搜索键入_阻塞ms': gsType.block, 'R7_全局搜索键入_最大单任务ms': gsType.max, 'R7_全局搜索键入_长任务数': gsType.n
        })
      }
    } catch (e) {
      log('  ⚠ R7 全局搜索采样失败：' + e.message)
      out.metrics.R7_采样失败 = 1
    }

    gsServer.close()
    await ctx.close()
    log('\n══════════ 真实路径汇总 ══════════')
    for (const [k, v] of Object.entries(out.metrics)) log('  ' + k + ': ' + v)
    fs.writeFileSync(reportPath, JSON.stringify(out, null, 2))
    if (JSON_ONLY) console.log(JSON.stringify(out))
    log('\n报告已写入 ' + reportPath)
    return
  }

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

  // ══════════ R153 M14：资源台首屏"渲染量账单"══════════
  // 现有指标全在量交互耗时，没人量"这一屏到底画了多少东西、掉了几帧"——
  // R152 真库体检发现用户说的"卡"不在 JS（冷挂 626ms 里阻塞只有 106~173ms），
  // 所以这里把节点数与逐帧间隔钉成指标，以后任何让首屏变重的改动都会被它抓住。
  const m14 = await page.evaluate(async () => {
    const gaps = []; let last = performance.now(); let raf = 0
    const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    /* ★V3.9.19：资源台退役，改在策展画布量（真库最重表面）；键名保留「资源台」字样仅为报告消费方兼容 */
    const t = [...document.querySelectorAll('.tab')].find(e => e.offsetParent && /PERF/.test(e.innerText || ''))
    if (t) t.click()
    const t0v = performance.now()
    const viewOk = (await window.__waitFor(() => document.querySelector('.mind-stage'), 12000)) >= 0
    const itemsOk = (await window.__waitFor(() => document.querySelector('.mind-node'), 2500)) >= 0
    await new Promise(r => setTimeout(r, 500))
    cancelAnimationFrame(raf)
    const vis = e => e.offsetParent !== null
    const cards = [...document.querySelectorAll('.mind-node')].filter(vis).length
    const all = [...document.querySelectorAll('body *')].filter(vis).length
    // R155：节点数是"总账"，不足以归因。徽标从 emoji（1 个 span）换成 SVG（svg + 6 个子元素）
    // 后每张卡 +6 节点——这是**有意的结构代价**，不是渲染劣化。把它单列成计量，
    // 以后谁看到 M14 上涨，先看这两行就能分清"图标换骨"与"真的画更多东西"。
    const svgs = [...document.querySelectorAll('svg')].filter(vis).length
    const marks = [...document.querySelectorAll('.ai-mark, .ai-entry')].filter(vis).length
    const g = gaps.slice(1).sort((x, y) => y - x)
    return { view: '策展画布', viewOk, itemsOk, cards, all, svgs, marks, worst: Math.round(g[0] || 0), dropped: gaps.filter(x => x > 34).length, frames: gaps.length }
  })
  out.metrics['M14_资源台首屏可见节点'] = m14.all; out.metrics['M14_首屏卡片数'] = m14.cards
  out.metrics['M14_视图'] = m14.view || '未知'
  out.metrics['M14_最差帧ms'] = m14.worst; out.metrics['M14_掉帧数'] = m14.dropped
  out.metrics['M14b_资源台svg元素数'] = m14.svgs; out.metrics['M14c_资源台AI徽标数'] = m14.marks
  log(`  M14 账单：可见节点 ${m14.all}（卡 ${m14.cards} 张 · svg ${m14.svgs} · AI 徽标 ${m14.marks}）· 最差帧 ${m14.worst}ms · 掉帧 ${m14.dropped}/${m14.frames} · 视图 ${m14.view || '未知'}${m14.itemsOk ? '' : ' ⚠未等到卡元素'}`)
  // R112 修脚本漂移：原用前缀 '策展台'，但顶栏策展台 Tab 文本已被剥成「📘PERF0」，
  // 唯一含「策展台」三字的可匹配项是溢出指示（见 __navTo 内注释）→ 打满 15000ms 超时。
  // R109/R111 记录的 15006/15019ms 即此超时值，非真实耗时。改用与下方一致的 PERF0 定位。
  const navWS = await page.evaluate(() => window.__navTo('PERF0', '.ws-page'))  /* ★V3.9.19：.res-card 随策展四视图退役，改锚工作区根 */
  if (navWS >= 0) push('M2b_切到策展台(ms)', navWS)

  /* ★V3.9.19 退役记账（度量随迁备案，见文件头）：M4 全家（资源台 R179 退役）、
     M2b 侧栏重渲染与 M2d 视图切换（V3.9.8 策展成果态：左树与四视图退役、单一画布）
     ——产品面不存在了，继续跑只会产出「打满超时 / 在错误页面上测」的假数。 */
  log('  退役：M4a/M4b/M4c（资源台）· M2b 侧栏重渲染 · M2d 视图切换（产品面已不存在，见文件头 V3.9.19 备案）')

  // ══════════ 策展台（V3.9.8 起为单一画布：检索框现役）══════════
  await page.evaluate(() => window.__navTo('PERF0', '.ws-page'))
  await page.evaluate(() => window.__flush())
  log('  实际路由：' + await page.evaluate(() => location.hash))

  const wsSearch = await page.evaluate(() => window.__searchType('.toolbar-search input', '资源条目'))
  if (wsSearch >= 0) push('M2c_策展台搜索键入6字(ms)', wsSearch)

  // ══════════ M3 长任务汇总（交互期，不含启动期）══════════
  const lt = await page.evaluate(() => {
    const all = window.__lt || []
    const arr = all.slice(window.__ltMark || 0).map(x => x.d).sort((a, b) => b - a)
    return { count: arr.length, total: arr.reduce((s, x) => s + x, 0), max: arr[0] || 0, top5: arr.slice(0, 5) }
  })
  // R164：M3 标注「合成压力测试」——它量的是合成库 + 合成操作序列下的布局/绘制，不是用户真实路径；
  // 用户体感口径 = M14 + 掉帧 + 各交互墙钟（真实路径见 --real 模式）。
  push('M3_合成压力测试_交互期长任务总计(ms)', lt.total, { M3_长任务次数: lt.count, M3_最大单任务ms: lt.max })
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
    const first = await window.__waitFor(() => document.querySelector('.ws-page'), 12000)  /* ★V3.9.19：.view-tab/.res-card 随策展四视图退役 */
    const fms = Math.round(performance.now() - t0)
    await new Promise(r => setTimeout(r, settle))
    const lts = (window.__lt || []).slice(lt0).map(x => x.d)
    return { first: fms, block: lts.reduce((s, x) => s + x, 0), n: lts.length, max: lts.length ? Math.max.apply(null, lts) : 0 }
  }, [tabText, settleMs])

  /* ★V3.9.19 退役记账：M11（切到资源台）随资源台 R179 退役——pick 找不到 Tab 恒返回 null 静默跳过。 */
  log('  退役：M11 切到资源台（资源台 R179 退役）')
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
      pick('PERF0')?.click(); await window.__waitFor(() => document.querySelector('.ws-page'), 8000); await new Promise(r => setTimeout(r, 250))  /* ★V3.9.19：资源台退役，此腿改策展台——原写法 pick 落空后 ws-page 永不出现，每轮白等 8s */
      const b = performance.now()
      pick('调度台')?.click(); await window.__waitFor(() => document.querySelector('.page .desk-head'), 8000)  /* ★V3.9.19：.mb-cell 已退役，改锚调度台首屏根 */; await new Promise(r => setTimeout(r, 250))
      per.push([Math.round(b - a), Math.round(performance.now() - b)])
    }
    const lts = (window.__lt || []).slice(lt0).map(x => x.d)
    return { wall: Math.round(performance.now() - t0), block: lts.reduce((s2, x) => s2 + x, 0), n: lts.length, max: lts.length ? Math.max.apply(null, lts) : 0, per }
  })
  push('M13_来回切台4次_墙钟(ms)', m13.wall, { 'M13_阻塞ms': m13.block, 'M13_长任务次数': m13.n, 'M13_最大单任务ms': m13.max })
  log(`  M13 每轮 [去策展台, 回调度台] = ${JSON.stringify(m13.per)} · 阻塞 ${m13.block}ms/${m13.n} 次 · 最大 ${m13.max}ms`)

  // ══════════ M2c 回调度台（R114-59：用户反馈「回到调度台慢」，此前无度量）══════════
  const navBack = await page.evaluate(() => window.__navTo('调度台', '.page .desk-head')) // R145 修漂移 + ★V3.9.19：.mb-cell 再随调度台改版退役，改锚 .page .desk-head
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

  // ══════════ M5c/M5d 应用内 ⌘K 检索面板（R4-P2 新增尺子）══════════
  // ★为什么要补这一档：#71（R148-P2「全局检索链路瘦身」）要瘦的是 **newtab 侧 GlobalPopups.vue** 那条链
  //   （allResults → blobOf/normKey 归一化 → hitRank 命中分级 → groupedResults 五组各过一遍 → v-html 高亮），
  //   而本脚本的 M5 与真实档 R7 量的都是 **content 浮层 overlay-impl**——它的 match() 只做
  //   toLowerCase().includes()，既没归一化也没分组。开工前在整套 perf 指标里 grep
  //   `gp-search-input` / `gp-result-item`：零命中 ⇒ P2 的验收标准「键入单帧 <16ms、唤起 <60ms」
  //   从来没有尺子可读（R148 资产 #1：先立尺子再动手——没有基线的"优化"等于没做）。
  // 入口用顶栏「全局搜索」按钮（与 perf-census R173-T2 同一真实路径）。不在新tab 页派发合成 Ctrl+K：
  //   快捷键是 background commands → zy-open-search 消息触发的，页面里没有 keydown 监听者，
  //   合成按键会重演旧 M6「墙钟全花在等一个永远不会开的浮层」（R114-59 教训）。
  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.evaluate(() => { window.__ltMark5c = (window.__lt || []).length })
  const gpOpenXs = []
  let gpErr = ''
  for (let k = 0; k < 3; k++) {
    const r = await page.evaluate(async () => {
      const t0 = performance.now()
      const cap = window.__ltCap()
      const btn = [...document.querySelectorAll('.icon-btn')].find(e => (e.getAttribute('title') || '').includes('全局搜索'))
      if (!btn) return { err: '顶栏「全局搜索」按钮未找到（M5c/M5d 无入口）' }
      btn.click()
      const ok = await window.__waitFor(() => {
        const el = document.querySelector('.gp-overlay.open .gp-results')
        return el && el.children.length ? el : null
      }, 8000)
      await window.__flush()
      const w = window.__ltSince(cap)
      return { wall: ok ? Math.round((performance.now() - t0) * 10) / 10 : -1, block: w.block, max: w.max }
    })
    if (r.err) { gpErr = r.err; break }
    gpOpenXs.push(r)
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(350)
  }
  if (gpErr) { log('  ⚠ M5c ' + gpErr); out.metrics.M5c_采样失败 = 1 }
  try {
    // 键入档在第 4 次唤起里做（前 3 次只做唤起，避免"首开含拼音 chunk + JIT 冷启动"混进键入读数）
    await page.evaluate(async () => {
      const btn = [...document.querySelectorAll('.icon-btn')].find(e => (e.getAttribute('title') || '').includes('全局搜索'))
      if (btn) btn.click()
      await window.__waitFor(() => document.querySelector('.gp-overlay.open .gp-results')?.children.length, 8000)
    })
    // 词面故意取"大面积命中"：'资源条目 1' 在合成库里命中上千张卡 ⇒ 归一化/分组/渲染全按最坏档走
    const gpType = await page.evaluate(() => window.__searchTypeBill('.gp-search-input', '资源条目 1', 240))
    const gpCount = await page.evaluate(() => ({
      rows: document.querySelectorAll('.gp-result-item').length,
      matched: [...document.querySelectorAll('.gp-group-cnt')].reduce((s, e) => s + (parseInt(e.textContent || '', 10) || 0), 0)
    }))
    const gpLt = await page.evaluate(() => {
      const arr = (window.__lt || []).slice(window.__ltMark5c || 0).map(x => x.d).sort((a, b) => b - a)
      return { count: arr.length, total: arr.reduce((s, x) => s + x, 0), max: arr[0] || 0 }
    })
    if (gpOpenXs.length) {
      const xs = gpOpenXs.map(x => x.wall).sort((a, b) => a - b)
      push('M5c_应用内搜索面板唤起(ms)', xs[0], {
        'M5c_唤起_中位ms': xs[Math.floor(xs.length / 2)],
        'M5c_唤起_阻塞ms': Math.max(...gpOpenXs.map(x => x.block)),
        'M5c_唤起_最大单任务ms': Math.max(...gpOpenXs.map(x => x.max))
      })
    }
    if (gpType) push('M5d_应用内搜索键入净耗时(ms)', gpType.net, {
      'M5d_键入_中位ms': gpType.netMed, 'M5d_键入_散布倍数': gpType.spread,
      'M5d_键入_阻塞ms': gpType.block, 'M5d_键入_最大单任务ms': gpType.max, 'M5d_键入_长任务数': gpType.n
    })
    out.metrics.M5d_命中行数 = gpCount.matched
    out.metrics.M5d_渲染行数 = gpCount.rows
    push('M3f_搜索面板窗口长任务总计(ms)', gpLt.total, { M3f_长任务次数: gpLt.count, M3f_最大单任务ms: gpLt.max })
    log(`  M5d 命中 ${gpCount.matched} 行 · 渲染 ${gpCount.rows} 行（窗口三b 长任务 ${gpLt.count} 次 / ${gpLt.total}ms）`)
  } catch (e) {
    log('  ⚠ M5d 应用内搜索键入采样失败：' + e.message)
    out.metrics.M5d_采样失败 = 1
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(250)

  // ══════════ M15 ⌘K 结果表**驻留**（R4-Er 新增尺子）══════════
  // ★为什么要补这一档：#114 的③写的是「结果表 ~1.3MB 派生串驻留」，那是**按字符数 ×2 估出来的**，
  //   本脚本此前所有指标都是墙钟与长任务，没有一个"面板关掉之后到底还占着多少"的读数。
  //   口径：CDP 堆用量（GC 后的稳定态）在「新文档」与「开过一次 ⌘K 再关掉并 GC」之间的差
  //   = 关着面板时被永久占住的那一份（结果表按数据缓存，见 R4-Pa 那条拆层，它不会随面板释放）。
  //   另存「开面板瞬时」与「每卡驻留 B」——每卡数才是能被跨库大小比较的形状量。
  let m15 = null
  try {
    const mp = await ctx.newPage()
    await mp.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
    await mp.waitForTimeout(2600)
    const mcdp = await ctx.newCDPSession(mp)
    await mcdp.send('HeapProfiler.enable').catch(() => {})
    const heapKB = async () => {
      await mcdp.send('HeapProfiler.collectGarbage').catch(() => {})
      return Math.round((await mcdp.send('Runtime.getHeapUsage')).usedSize / 1024)
    }
    const h0 = await heapKB()
    const opened = await mp.evaluate(async () => {
      const btn = [...document.querySelectorAll('.icon-btn')].find(e => (e.getAttribute('title') || '').includes('全局搜索'))
      if (!btn) throw new Error('顶栏「全局搜索」按钮未找到（M15 无入口）')
      btn.click()
      const ok = await new Promise(res => {
        const t = setInterval(() => { if (document.querySelector('.gp-result-item')) { clearInterval(t); res(true) } }, 100)
        setTimeout(() => { clearInterval(t); res(false) }, 8000)
      })
      // ★等落定再采样：懒加载 chunk（拼音字典按中文查询才进）与空闲回调若没跑完，会被算进「关掉后的驻留」——
      //   小库上实测出现过「关着比开着还占」的假读数，就是这个没等。
      await new Promise(r => setTimeout(r, ok ? 2200 : 400))
      return ok
    })
    if (!opened) throw new Error('面板没真开出结果行（M15 采样作废，不报假数）')
    const hOpen = await heapKB()
    await mp.keyboard.press('Escape').catch(() => {})
    await mp.waitForTimeout(700)
    if (await mp.locator('.gp-overlay.open').count()) {
      await mp.locator('.gp-overlay.open').click({ position: { x: 6, y: 6 } }).catch(() => {})
      await mp.waitForTimeout(500)
    }
    const closedOk = (await mp.locator('.gp-overlay.open').count()) === 0
    const h1 = await heapKB()
    const cnt = await mp.evaluate(() => {
      const app = document.querySelector('#app').__vue_app__
      const prov = app && app._context && app._context.provides
      let pinia = null
      for (const k of Object.getOwnPropertySymbols(prov || {})) { const v = prov[k]; if (v && v._s && v.state) pinia = v }
      const dd = pinia._s.get('app').data
      const live = (a) => (a || []).filter(x => !x.deletedAt).length
      let proj = 0
      for (const dir of (dd.compass && dd.compass.directions) || []) proj += ((dir.projects || []).filter(x => !x.deletedAt).length)
      return { res: live(dd.resources), task: live(dd.tasks), curio: live(dd.curiosities), ws: (dd.workspaces || []).filter(x => !x.archived && x.id !== 'zy-curation').length, proj }
    })
    await mp.close()
    const rows = cnt.res + cnt.task + cnt.curio + cnt.ws + cnt.proj
    // 闸只设三条真事实：面板确实关掉了、关掉后的堆不低于稳定态、结果集确实有行。
    // ★曾经加过第四条「开着 ≥ 关着」，那是我想当然——SPA 里关掉面板时缓存与派生表留下、DOM 与 vnode
    //   释放，两个读数之间没有必然大小关系（小库实测就是关着 2,072KB > 开着 1,782KB）。
    //   拿臆造的不变式当作废条件，会把真样本判成假数，比不设闸更坏。
    // ★这里故意只用行注释：本文件里有 `url: 'http://127.0.0.1:' + port + '/*'` 这样的**字符串里的 /***，
    //   而回归的注释剥离器不跳字符串，块注释会把后面所有代码吞进"注释"里 ⇒ 依赖 codeOnly 的判据集体失明
    //   （R4-Er 实测：加了两段块注释后 codeOnly 只剩 65,236B 中的 26,398B，R4-Pa 的 M5c/M5d 锚点全红）。
    if (!closedOk || h1 < h0 || !rows) {
      log('  ⚠ M15 采样作废（关面板=' + closedOk + ' 堆差=' + (h1 - h0) + 'KB 行数=' + rows + '）——宁可不报也不报假数')
      out.metrics.M15_采样失败 = 1
    } else m15 = { h0, hOpen, h1, rows, cnt }
  } catch (e) { log('  ⚠ M15 驻留采样失败：' + e.message); out.metrics.M15_采样失败 = 1 }
  if (m15) {
    // ★不走 push()：那是 ms 专用（名字后面硬拼 "ms"），而驻留是 KB —— 单位标错比不标更坏，
    //   所以这里直写 out.metrics（与 M5d_命中行数 同一形态）。
    const retained = m15.h1 - m15.h0, transient = m15.hOpen - m15.h0
    const perCard = Math.round(retained * 1024 / m15.rows)
    Object.assign(out.metrics, {
      'M15_面板关着仍驻留(KB)': retained,
      'M15_开面板瞬时(KB)': transient,
      'M15_每卡驻留(B)': perCard,
      'M15_结果集行数': m15.rows,
      'M15_明细_资源/任务/好奇/台/项目': [m15.cnt.res, m15.cnt.task, m15.cnt.curio, m15.cnt.ws, m15.cnt.proj].join('/'),
      M15_稳定态基线KB: m15.h0
    })
    log(`  M15_面板关着仍驻留(KB) = ${retained}（开着时 ${transient}KB）· 结果集 ${m15.rows} 行 · M15_每卡驻留(B) = ${perCard}`)
  }

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

  // R164（A1）：ADR-02 复审条件量化——写盘 >50ms 或主数据 >2MB 即触发「启动单根 JSON 分域评估」（记录型门禁，随报告输出）
  const a1M6b = out.metrics['M6b_同载荷set写盘(ms)'] || 0
  const a1Kb = out.metrics['M6_载荷KB'] || 0
  const a1Hit = a1M6b > 50 || a1Kb > 2048
  out.metrics['A1_分域评估触发'] = a1Hit
    ? '触发：M6b=' + a1M6b + 'ms / 载荷=' + a1Kb + 'KB（阈值 50ms / 2048KB）'
    : '未触发（M6b=' + a1M6b + 'ms / 载荷=' + a1Kb + 'KB）'
  if (a1Hit) log('  ⚠ A1 触发：写盘或载荷超阈值 → 启动单根 JSON 分域评估（ADR-02）')

  await ctx.close()

  log('\n══════════ 汇总 ══════════')
  for (const [k, v] of Object.entries(out.metrics)) log(`  ${k}: ${v}`)
  const outFile = path.resolve(__dirname, '..', '.perf-report.json')
  // R155：报告是"本次真的跑完了"的证据，不是"上一次跑过"的缓存。做 A/B 时脚本常把
  //   失败输出重定向掉，旧报告会冒充新读数（R155 实测踩到：扩展加载失败 → 两轮数字一字不差）。
  //   故开跑即清空 + 结束写 build 自证字段，读报告的人一定看得出新鲜度。
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
  if (JSON_ONLY) console.log(JSON.stringify(out))
  log(`\n报告已写入 ${outFile}`)
}

main().catch(e => { console.error(e); process.exit(1) })
