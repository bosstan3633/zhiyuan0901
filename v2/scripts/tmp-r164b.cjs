const fs = require('fs');
const W = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(f + ' | 命中 ' + n + ' 次: ' + a.slice(0, 70));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(f, s);
  console.log('✅ ' + f);
};

/* ---- 参数：--real=<导出JSON> ---- */
W('scripts/perf.cjs', [
  [`const DIST_ARG = argv.find(a => a.startsWith('--dist='))
const DIST = DIST_ARG ? path.resolve(DIST_ARG.slice(7)) : DEFAULT_DIST`,
   `const DIST_ARG = argv.find(a => a.startsWith('--dist='))
const DIST = DIST_ARG ? path.resolve(DIST_ARG.slice(7)) : DEFAULT_DIST
/** R164：真实路径模式——\`--real=<知源备份 JSON>\`。数据换真实库、操作换真实高频路径
 *  （切台/单击/键入/滚动/视图切换），指标 R1~R7；与合成档（M 系）互不混用，报告 scale='real'。 */
const REAL_ARG = argv.find(a => a.startsWith('--real='))
const REAL_PATH = REAL_ARG ? path.resolve(REAL_ARG.slice(7)) : ''`],
]);

/* ---- main()：真实模式分支（首开自建数据之后） ---- */
W('scripts/perf.cjs', [
  [`  // ── 首次打开：让扩展自建默认数据 ──
  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
`,
   `  // ── 首次打开：让扩展自建默认数据 ──
  await page.goto(base + '#/workspace', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

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
    const r2 = await page.evaluate(async () => {
      const lt0 = (window.__lt || []).length
      const t0 = performance.now()
      const tab = [...document.querySelectorAll('.tabs .tab')].find(e => ((e.getAttribute('title') || '') + (e.textContent || '')).includes('资源台'))
      if (tab) tab.click()
      while (!document.querySelector('.res-card, .res-row, .kc-card')) await new Promise(r => setTimeout(r, 40))
      const wall = Math.round(performance.now() - t0)
      const lts = (window.__lt || []).slice(lt0).map(x => x.d)
      return { wall, block: lts.reduce((s, x) => s + x, 0), maxlt: lts.length ? Math.max.apply(null, lts) : 0, ltN: lts.length }
    })
    push('R2_冷挂资源台_墙钟(ms)', r2.wall, { 'R2_冷挂资源台_阻塞ms': r2.block, 'R2_冷挂资源台_最大单任务ms': r2.maxlt, 'R2_冷挂资源台_长任务数': r2.ltN })
    await page.waitForTimeout(400)

    // R3 单击开详情（中位账单：同步成本 + 1.5s 内阻塞 + 主数据被重写次数）
    const r3 = await page.evaluate(() => window.__clickMedian('.res-card', 3))
    if (r3) {
      out.metrics['R3_单击开详情_同步ms'] = r3.sync
      out.metrics['R3_单击开详情_阻塞ms'] = r3.block
      out.metrics['R3_单击开详情_主数据重写'] = r3.mainWrites
      log('  R3 单击开详情：同步 ' + r3.sync + 'ms · 阻塞 ' + r3.block + 'ms · 主数据重写 ' + r3.mainWrites + ' 次')
    }
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(300)

    // R4 三视图切换（卡片/列表/看板，主线程耗时中位）
    const r4 = await page.evaluate(() => window.__switchViews('.ws-toolbar .view-tab'))
    if (r4) for (const [k, v] of Object.entries(r4)) out.metrics['R4_视图切换_' + k + '(ms)'] = v

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
    const m14 = await page.evaluate(async () => {
      const gaps = []; let last = performance.now(); let raf = 0
      const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; raf = requestAnimationFrame(tick) }
      raf = requestAnimationFrame(tick)
      const t = [...document.querySelectorAll('.tab')].find(e => e.offsetParent && /资源台/.test(e.innerText || ''))
      if (t) t.click()
      while (!document.querySelector('.res-card, .res-row, .kc-card')) await new Promise(r => setTimeout(r, 40))
      await new Promise(r => setTimeout(r, 500))
      cancelAnimationFrame(raf)
      const vis = e => e.offsetParent !== null
      const cards = [...document.querySelectorAll('.res-card, .res-row, .kc-card')].filter(vis).length
      const all = [...document.querySelectorAll('body *')].filter(vis).length
      const svgs = [...document.querySelectorAll('svg')].filter(vis).length
      const marks = [...document.querySelectorAll('.ai-mark, .ai-entry')].filter(vis).length
      const g = gaps.slice(1).sort((x, y) => y - x)
      return { cards, all, svgs, marks, worst: Math.round(g[0] || 0), dropped: gaps.filter(x => x > 34).length, frames: gaps.length }
    })
    out.metrics['R6_真库首屏可见节点'] = m14.all; out.metrics['R6_真库首屏卡片数'] = m14.cards
    out.metrics['R6_真库最差帧ms'] = m14.worst; out.metrics['R6_真库掉帧数'] = m14.dropped
    out.metrics['R6_真库svg元素数'] = m14.svgs; out.metrics['R6_真库AI徽标数'] = m14.marks
    log('  R6 真库账单：可见节点 ' + m14.all + '（卡 ' + m14.cards + ' · svg ' + m14.svgs + ' · AI 徽标 ' + m14.marks + '）· 最差帧 ' + m14.worst + 'ms · 掉帧 ' + m14.dropped + '/' + m14.frames)

    // R7 全局搜索（content 宿主页）：唤起 + 键入 6 字净耗时
    try {
      await page.goto('http://127.0.0.1:' + gsPort + '/', { waitUntil: 'load' })
      await page.waitForTimeout(1200)
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
      await gsOpen()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      const xs = []
      for (let k = 0; k < 3; k++) { xs.push(await gsOpen()); if (k < 2) { await page.keyboard.press('Escape'); await page.waitForTimeout(400) } }
      xs.sort((a, b) => a - b)
      push('R7_全局搜索唤起(ms)', xs[Math.floor(xs.length / 2)])
      const gsType = await page.evaluate(() => window.__searchType('#__zy_si__', '教育规划', 60))
      if (gsType >= 0) push('R7_全局搜索键入6字净耗时(ms)', gsType)
    } catch (e) {
      log('  ⚠ R7 全局搜索采样失败：' + e.message)
      out.metrics.R7_采样失败 = 1
    }

    await ctx.close()
    log('\\n══════════ 真实路径汇总 ══════════')
    for (const [k, v] of Object.entries(out.metrics)) log('  ' + k + ': ' + v)
    fs.writeFileSync(reportPath, JSON.stringify(out, null, 2))
    if (JSON_ONLY) console.log(JSON.stringify(out))
    log('\\n报告已写入 ' + reportPath)
    return
  }
`],
]);

/* ---- regression：+R164-9 ---- */
{
  const F = 'scripts/regression.cjs';
  let L = fs.readFileSync(F, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const i = L.findIndex((l) => l.includes("check('R164-8"));
  if (i < 0) throw new Error('未找到 R164-8');
  L.splice(i + 1, 0, `check('R164-9 ★perf --real 真实路径模式在位：R1~R7 指标（冷启动/冷挂/单击/视图/滚动/真库 M14/搜索）+ 报告 scale=real', () => { const p = read('/../scripts/perf.cjs'); return p.includes('--real=') && p.includes('R1_冷启动_首页可交互(ms)') && p.includes('R2_冷挂资源台_墙钟(ms)') && p.includes('R3_单击开详情_同步ms') && p.includes('R5_滚动掉帧数') && p.includes('R6_真库首屏可见节点') && p.includes('R7_全局搜索键入6字净耗时(ms)') && p.includes("out.scale = 'real'"); });`);
  fs.writeFileSync(F, L.join('\n'));
  console.log('✅ regression.cjs（+R164-9）');
}

console.log('R164 #1 perf --real 补丁完成');
