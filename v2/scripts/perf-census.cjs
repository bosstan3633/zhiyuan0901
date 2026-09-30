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
 * R173-T0 修三处**量错东西**的缺陷（R172 实测真库 hub 默认视图是金字塔，以下三处全在此翻车）：
 *   ① 视图感知：卡元素按当前视图取（金字塔=`.py-card-chip`）。旧版一律数 `.res-card` ⇒ 金字塔下恒 0，
 *      被读成"首屏轻"；步骤标题还写着"卡片视图"。
 *   ② 禁静默失败：旧版视图标签点击包 `.catch(() => {})` ⇒ 选择器失效时**什么都没点**，数字照出、
 *      标签照贴"看板"。现改为显式找标签 + 显式就绪信号，任何一步取不到就打印 ⚠ 并**非零退出**。
 *   ③ 抽屉账取错宿主：`.ws-page > .drawer` 恒为 0——R169 起 Drawer.vue 是唯一壳、Teleport 到 body。
 *
 * 用法：
 *   node scripts/perf-census.cjs --real=<知源导出JSON>            # 真实库（推荐，规模才有意义）
 *   node scripts/perf-census.cjs --real=... --dist=<扩展包目录>    # A/B 时指向基线包
 *   可选：--steps=deck,kanban,drawer,search  只跑关心的几步
 * 退出码：0 = 全部步骤的就绪信号都取到；1 = 有步骤"没量到/量错"，明细在末尾 ⚠ 段落。
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
/* R4-Ea（挂账 #84）：浏览器可执行文件解析统一到 scripts/browser.cjs——四级回落的唯一实现。
   此前这里各抄一份且抄得不一致（img-diff 只写死 chromium-1234，缓存换版本后直接起不来）。 */
const { CHROME } = require('./browser.cjs')

const raw = JSON.parse(fs.readFileSync(REAL, 'utf8'))
const data = raw.zy_data_v2 || raw
if (!Array.isArray(data.resources)) { console.error('✗ --real 文件不是知源备份 JSON（缺 resources 数组）'); process.exit(1) }

/** 注入的视图探针（与 perf.cjs 同口径；本脚本不导航，装一次够用） */
const INSTRUMENT = `
window.__waitFor = function (pred, timeout) {
  return new Promise(res => {
    const t0 = performance.now()
    const t = setInterval(() => { if (pred()) { clearInterval(t); res(Math.round(performance.now() - t0)) } }, 8)
    setTimeout(() => { clearInterval(t); res(-1) }, timeout || 15000)
  })
}
window.__VIEW_CARD = { card: '.res-card', list: '.res-row', kanban: '.kc-card', pyramid: '.py-card-chip' }
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
`

/** 区域账：`sum` 数子树节点，`q` 数个数。卡片按**当前视图**取（旧版写死 .res-card，金字塔下恒 0） */
const CENSUS = () => {
  const sum = (sel) => [...document.querySelectorAll(sel)].reduce((s, e) => s + e.querySelectorAll('*').length, 0)
  const q = (sel) => document.querySelectorAll(sel).length
  const view = window.__viewOf()
  const cardSel = window.__cardSelOf(view)
  return {
    view: view || '(无视图)',
    all: q('*'),
    卡: q(cardSel), 卡内节点: sum(cardSel),
    res卡旧口径: q('.res-card'),
    /* R173-T1：列窗口化的不变量——窗口只该改变「渲染了几列」，不该改变可滚区域宽度（scrollWidth 一漂，
       滚动条长度与"还有多久到头"的手感就变，且滚动位置可能被浏览器夹回） */
    看板滚动宽: (() => { const el = document.querySelector('.kanban'); return el ? el.scrollWidth : 0 })(),
    看板列: q('.kanban .kanban-col'), 看板实列: q('.kanban .kanban-col:not(.kc-ghost)'),
    左树项: q('.cat-item'), 左树节点: sum('.ws-sidebar'),
    svg: q('svg'), use: q('use'), option: q('option'), select: q('select'),
    抽屉节点: sum('.drawer'), modal节点: sum('.modal-overlay'),
    检索面板: q('.gp-overlay.open'), 检索面板节点: sum('.gp-overlay.open'),
    浮层壳: q('.overlay,.modal-overlay,.drawer,.drawer-overlay,.gp-overlay.open'),
  }
}

const problems = []

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
  await page.addInitScript(INSTRUMENT)
  const ver = JSON.parse(fs.readFileSync(path.join(PKG, 'manifest.json'), 'utf8')).version
  console.log(`被测包 ${PKG} · manifest.version=${ver}`)
  console.log(`真库：资源 ${(data.resources || []).filter(r => !r.deletedAt).length}/${(data.resources || []).length} · 任务 ${(data.tasks || []).length} · 好奇 ${(data.curiosities || []).length} · 台 ${(data.workspaces || []).length} · 分类 ${(data.categories || []).length}`)

  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000)
  await page.evaluate((d) => chrome.storage.local.set({ zy_data_v2: d }), data)
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000)
  /* ★ 探针自检：注入串被撕碎（模板里混进反引号）时 node --check 不报错，但后面所有视图判定都静默失效 */
  const instMissing = await page.evaluate(() => ['__waitFor', '__viewOf', '__cardSelOf'].filter(k => typeof window[k] !== 'function'))
  if (instMissing.length) { console.error('✗ INSTRUMENT 注入失败，页面里缺：' + instMissing.join(', ')); process.exit(1) }
  /* ★ 长任务观察器必须在动作之前装好（装在之后 ⇒ 报"无长任务"，是探针自己的错） */
  await page.evaluate(() => {
    window.__lt = []
    new PerformanceObserver(l => window.__lt.push(...l.getEntries().map(e => Math.round(e.duration)))).observe({ entryTypes: ['longtask'] })
  })
  const boards = (data.workspaces || []).filter(x => x.id !== 'zy-curation' && !x.archived).slice(0, 2)

  const waitSel = (sel, timeout = 8000) => page.evaluate(async (a) => {
    const t0 = performance.now()
    const w = await window.__waitFor(() => document.querySelector(a.sel), a.timeout)
    return { ok: w >= 0, ms: Math.round(performance.now() - t0) }
  }, { sel, timeout })
  const waitGone = (sel, timeout = 5000) => page.evaluate(async (a) => {
    const t0 = performance.now()
    const w = await window.__waitFor(() => !document.querySelector(a.sel), a.timeout)
    return { ok: w >= 0, ms: Math.round(performance.now() - t0) }
  }, { sel, timeout })
  /** 点视图标签：找不到就记问题。旧版 `locator(...).click().catch(() => {})` 会**什么都没点**还照贴标签 */
  const tapView = async (label) => {
    const hit = await page.evaluate((lab) => {
      const tab = [...document.querySelectorAll('.view-tab')].find(e => e.offsetParent && (e.textContent || '').includes(lab))
      if (!tab) return false
      tab.click(); return true
    }, label)
    if (!hit) problems.push(`找不到可见的视图标签「${label}」`)
    return hit
  }

  async function step(tag, key, go, opts = {}) {
    if (key && !want(key)) return
    // prep：把"上一个动作的尾巴"（如导航挂台）挪出计量窗口——不分离的话，切视图/开详情/检索的
    // 长任务账里都混着冷挂的 635ms，读数无法归因（R173-T0 实测踩到）。
    if (opts.prep) await opts.prep()
    await page.evaluate(() => { window.__lt.length = 0 })
    const before = await page.evaluate(CENSUS)
    const t = Date.now()
    await go()
    // R173-T2：就绪墙钟必须打出来——"点击 → 抽屉出现"的感知口径此前被 settle 稀释（墙钟恒 5s 级）。
    //   开详情的真实感知 = 点击 → 就绪信号出现（含 260ms 单击/双击判别定时器），这才是可读的端到端口径。
    let readyNote = ''
    if (opts.ready) {
      const r = await waitSel(opts.ready, opts.readyTimeout)
      readyNote = r.ok ? `就绪 ${r.ms}ms · ` : '就绪失败 · '
      if (!r.ok) problems.push(`${tag}：等就绪信号「${opts.ready}」超时（${opts.readyTimeout || 8000}ms）`)
    }
    if (opts.gone) {
      const g = await waitGone(opts.gone, opts.goneTimeout)
      if (!g.ok) problems.push(`${tag}：等「${opts.gone}」消失超时`)
    }
    await page.waitForTimeout(opts.settle == null ? 2600 : opts.settle)
    const wall = Date.now() - t
    const after = await page.evaluate(CENSUS)
    const lt = await page.evaluate(() => window.__lt.slice())
    let viewNote = `视图 ${after.view}`
    if (opts.expectView) {
      if (after.view === opts.expectView) viewNote += ' ✓'
      else { viewNote += `（期望 ${opts.expectView}）`; problems.push(`${tag}：实际视图 ${after.view} ≠ 期望 ${opts.expectView}`) }
    }
    console.log(`\n【${tag}】${viewNote} · ${readyNote}墙钟 ${wall}ms · 长任务 ${lt.length} 个 [${lt.join(',')}] · 阻塞合计 ${lt.reduce((s, x) => s + x, 0)}ms`)
    console.log(`   DOM ${before.all} → ${after.all}（${after.all - before.all >= 0 ? '+' : ''}${after.all - before.all}）`
      + ` · 卡 ${after.卡}(内 ${after.卡内节点}) · 左树 ${after.左树项}项/${after.左树节点}节点 · svg ${after.svg} · use ${after.use} · option ${after.option}/${after.select}个select`)
    if (after.看板滚动宽 || before.看板滚动宽) console.log(`   看板：滚动宽 ${before.看板滚动宽} → ${after.看板滚动宽}px · 列 ${after.看板列}（实列 ${after.看板实列} + ghost ${after.看板列 - after.看板实列}）`)
    console.log(`   浮层：抽屉 ${after.抽屉节点} 节点 · modal ${after.modal节点} 节点 · 检索面板 ${after.检索面板}个/${after.检索面板节点}节点 · 浮层壳 ${after.浮层壳} 个`)
  }

  const goHome = () => page.evaluate(() => { location.hash = '#/' })
  const goHub = () => page.evaluate(() => { location.hash = '#/workspace/zy-curation' })
  await step('基线：调度台首页', 'home', goHome, { ready: '.storage-chip', settle: 1600 })
  await step('冷挂资源台（首帧）', 'deck', goHub, { ready: '.ws-page', readyTimeout: 15000 })
  await step('回调度台', 'deck', goHome, { ready: '.storage-chip', settle: 1600 })
  await step('再进资源台（keep-alive 复用）', 'deck', goHub, { ready: '.ws-page' })
  for (const b of boards) await step(`冷挂策展台「${String(b.name).slice(0, 12)}」`, 'deck',
    () => page.evaluate((id) => { location.hash = '#/workspace/' + id }, b.id), { ready: '.ws-page', readyTimeout: 15000 })
  // R173-T2：`prep` 回台后等待 2500 → 4600ms——`Workspace.vue` 的「进台 = 一次调用」在进台 **4s 后**
  //   有一笔落盘节流（scheduleWsOpenPersist；当时是整库写盘，真库实测 49~84ms 序列化+写）。等 2500 时它恰落在
  //   "点击后 ~1500ms"的计量窗口内（settle 覆盖），污染开详情/切看板的阻塞账（116ms 里混着它）。
  //   4600 > 4000 把它整条清出窗口，读到的才是纯动作成本。这是量具修正，不改被测程序。
  //   （T2 拍板 a 后该笔已改走热度键小载荷——本等待保留：清尾逻辑与落盘通道解耦，代价只是每步多等 2s）
  const PREP_HUB_SETTLE = 4600
  await step('切到看板视图', 'kanban', () => tapView('看板'), {
    prep: async () => { await goHub(); await page.waitForTimeout(PREP_HUB_SETTLE) },
    ready: '.kanban', expectView: 'kanban', settle: 3000
  })
  await step('切回卡片视图', 'kanban', () => tapView('卡片'), { ready: '.ws-view .res-card', expectView: 'card', settle: 2000 })
  await step('单击卡片开详情（内联抽屉）', 'drawer', async () => {
    const sel = await page.evaluate(() => window.__cardSelOf())
    const hit = await page.evaluate((s) => { const el = document.querySelector(s); if (el) { el.click(); return true } return false }, sel)
    if (!hit) problems.push(`开详情：当前视图（${sel}）取不到卡元素`)
  }, {
    prep: async () => { await goHub(); await page.waitForTimeout(PREP_HUB_SETTLE) },
    ready: 'body > .drawer', settle: 1800
  })
  await step('关抽屉（卸载应回收节点）', 'drawer', async () => {
    const hit = await page.evaluate(() => { const el = document.querySelector('.drawer-close'); if (el) { el.click(); return true } return false })
    if (!hit) problems.push('关抽屉：找不到 .drawer-close')
  }, { gone: 'body > .drawer', settle: 1200 })
  // R173-T2：热对照——同会话内**第二次**开卡。首次开卡含一次性成本（组件/样式/JIT 冷启动），
  //   只量一次会把"首开成本"读成"每次成本"（R172 的 116ms 就是这么被读的）。点第二张避免同卡缓存差异。
  await step('再开一张（热 · 对照首次）', 'drawer', async () => {
    const hit = await page.evaluate((s) => {
      const xs = document.querySelectorAll(s)
      const el = xs[Math.min(1, xs.length - 1)]
      if (el) { el.click(); return true } return false
    }, await page.evaluate(() => window.__cardSelOf()))
    if (!hit) problems.push('热开卡：取不到第二张卡元素')
  }, { ready: 'body > .drawer', settle: 1500 })
  await step('全局检索（顶栏放大镜 + 键入 5 字）', 'search', async () => {
    // 新tab 页没有 Ctrl+K 监听（快捷键由 background commands → zy-open-search 消息触发），
    // 真实 UI 入口 = 顶栏「全局搜索」图标钮（App.vue 的 .icon-btn）。旧版派发合成 Ctrl+K ⇒ 全程零事件，
    // 11.5s 墙钟里 8s 是等一个永远不会开的浮层——这正是本脚本 R173-T0 要消灭的"静默量空"。
    const hit = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.icon-btn')].find(e => (e.getAttribute('title') || '').includes('全局搜索'))
      if (!el) return false
      el.click(); return true
    })
    if (!hit) problems.push('全局检索：顶栏找不到「全局搜索」按钮')
    await page.waitForTimeout(420)
    await page.keyboard.type('知识库', { delay: 25 })
  }, {
    prep: async () => { await goHub(); await page.waitForTimeout(2500) },
    ready: '.gp-overlay.open', settle: 1500
  })

  if (problems.length) {
    console.log(`\n✗ 量具自检失败 ${problems.length} 项（上表数字不可全信，先修探针/选择器）：`)
    for (const p of problems) console.log('   ⚠ ' + p)
    process.exitCode = 1
  } else {
    console.log('\n✓ 全部步骤的就绪信号都取到了（上表每条都能对上是"哪个视图、等到了什么"）')
  }
  await ctx.close()
})().catch(e => { console.error('census 失败：', e); process.exit(1) })
