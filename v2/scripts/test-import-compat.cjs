/**
 * R49-K 导入兼容实测（Playwright MV3 真机）
 * 场景：V2.21.3 形状的导出 JSON（Project 无 pinned/order、无 importedAt/callCount 新字段）
 *       导入 V2.22.0 → 可解析、取并集、缺省字段补默认、三件事仍显示于调度台首页。
 * 运行：node scripts/test-import-compat.cjs
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

// R56 跨平台路径 + R145 回落（与 e2e.cjs/perf.cjs 同规则）：pinned → ZY_CHROME → 本机任一 Chromium → 系统 Chrome
const CHROME_PINNED = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const CHROME = (() => {
  if (fs.existsSync(CHROME_PINNED)) return CHROME_PINNED
  if (process.env.ZY_CHROME) return process.env.ZY_CHROME
  const cache = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
  try {
    const hit = fs.readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort().pop()
    if (hit) { const p = path.join(cache, hit, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'); if (fs.existsSync(p)) return p }
  } catch { /* 无缓存目录 */ }
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return process.platform === 'darwin' && fs.existsSync(sys) ? sys : CHROME_PINNED
})()
const DIST = path.resolve(__dirname, '..', 'dist')
const results = []
function report(name, ok, detail) {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  → ' + detail : ''}`)
}

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })
  // 扩展 ID 动态获取（不依赖固定 ID）
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = 'chrome-extension://' + new URL(worker.url()).host
  const page = await ctx.newPage()
  const base = extId + '/src/newtab/index.html'
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 构造 V2.21.3 形状导出文件（无 pinned/order/importedAt/callCount 新字段；旧字段形状）
  const now = Date.now()
  const legacy = {
    version: 2,
    exportedAt: new Date(now - 86400_000).toISOString(),
    compass: {
      vision: { content: 'K 兼容测试愿景', updatedAt: now, pinnedToLighthouse: false, linkedResourceIds: [], linkedCuriosityIds: [] },
      mission: { content: 'K 兼容测试使命', updatedAt: now, pinnedToLighthouse: false, linkedResourceIds: [], linkedCuriosityIds: [] },
      directions: [{
        id: 'k-dir-1', name: 'K 兼容战略目标', status: 'active', term: 'short',
        projects: [{
          id: 'k-proj-1', name: 'K 兼容项目', isFocused: false, pinnedToLighthouse: false,
          progress: 0, status: 'active',
          metrics: [{ id: 'k-met-1', title: 'K 兼容指标', target: '', acceptance: '', taskIds: ['k-task-1'] }]
        }]
      }]
    },
    workspaces: [{ id: 'k-ws-1', name: '💼 K 兼容工作台', icon: '💼', color: '#3A6B4C', coverTheme: 'deep-sea', order: 0, archived: false }],
    categories: [{ id: 'k-cat-1', workspaceId: 'k-ws-1', name: '待分类', order: 0 }],
    resources: [{
      /* R166 定案 4：旧包（≤V3.4.x）资源卡带 fromCuriosityId 溯源字段——导入后必须静默剥离，
         既不报错也不留字段（卡间零挂载收口）。 */
      id: 'k-res-1', kind: 'resource', title: 'K 兼容资源卡', linkType: 'url', link: 'https://example.com',
      workspaceId: 'k-ws-1', categoryId: 'k-cat-1', tags: [], pinned: false, callCount: 0, customFields: {},
      fromCuriosityId: 'k-cur-gone', createdAt: now, updatedAt: now
    }],
    tasks: [{
      id: 'k-task-1', kind: 'task', title: 'K 兼容任务卡', projectId: 'k-proj-1', metricId: 'k-met-1',
      status: 'doing', priority: 'medium', mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [], pinned: false,
      fromCuriosityId: 'k-cur-gone', starred: false,
      createdAt: now, updatedAt: now
    }],
    curiosities: [],
    dailyFocus: {},
    tagTree: [], fieldConfig: { resource: [], task: [], curiosity: [], fieldViewCfg: {} },
    stats: {}, activityLogs: []
  }
  const importPath = path.resolve(__dirname, 'tmp-legacy-import.json')
  fs.writeFileSync(importPath, JSON.stringify(legacy), 'utf8')

  // 清空当前主数据（模拟全新 V2.22.0 安装），再从设置页走 UI 导入
  await page.evaluate(() => chrome.storage.local.set({ zy_data_v2: null }))
  await page.goto(base + '#/settings?page=import', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const input = page.locator('input[type="file"][accept=".json"]')
  await input.setInputFiles(importPath)
  await page.waitForTimeout(3000)

  // 验证 1：导入可解析 + 并集合并 + 项目进入罗盘
  const merged = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => r['zy_data_v2']))
  const dir = merged?.compass?.directions?.find(d => d.id === 'k-dir-1')
  const proj = dir?.projects?.find(p => p.id === 'k-proj-1')
  report('K1 旧版数据导入可解析并取并集（罗盘/工作台/任务进入主数据）',
    !!dir && !!proj && (merged?.workspaces || []).some(w => w.id === 'k-ws-1') && (merged?.tasks || []).some(t => t.id === 'k-task-1'),
    `dirs=${merged?.compass?.directions?.length} ws=${merged?.workspaces?.length} tasks=${merged?.tasks?.length}`)

  // 验证 2：新字段缺省兼容（pinned/order 缺省不炸，渲染正常）
  report('K2 新字段缺省兼容（pinned/order 缺省，项目列表正常渲染）',
    !!proj && proj.pinned === undefined && proj.order === undefined,
    `pinned=${proj && proj.pinned} order=${proj && proj.order}`)

  // 验证 3：调度台首页正常打开（今日记录条/三件事区域不因旧数据报错）——先整页 reload（模拟重开新标签页）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  // R56-P2：今日记录缩至页头 rec-mini
  const recStrip = await page.locator('.rec-mini').first().isVisible().catch(() => false)
  const errBoundary = await page.locator('.render-error').first().isVisible().catch(() => false)
  report('K4 调度台首页正常渲染（无渲染错误兜底）', recStrip && !errBoundary, `recStrip=${recStrip} error=${errBoundary}`)

  /* R166 定案 4/5 两用例。K5 分两条路各测一次——
     `merged` = 导入当场（测 mergeImport 的 stripRetiredCardKeys，这是 R166 新补的那道），
     `after`  = 整页 reload 之后（测 loadData 的 stripRetiredCardKeys）。
     只测后者会漏掉真缺陷：mergeById 用 {...existing, ...incoming} 覆盖，导入又发生在载入之后。 */
  const after = await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then(r => r['zy_data_v2']))
  const retiredIn = (obj) => [...(obj?.tasks || []), ...(obj?.resources || []), ...(obj?.curiosities || [])]
    .filter(c => ['mountedResourceIds', 'mountedCuriosityIds', 'relatedResourceIds', 'fromCuriosityId'].some(k => k in c)).length
  const mergedCards = (merged?.tasks || []).length + (merged?.resources || []).length + (merged?.curiosities || []).length
  report('K5a 导入当场剥离退役字段（mergeImport 这条路，R166 补的缺口）',
    mergedCards > 0 && retiredIn(merged) === 0,
    `cards=${mergedCards} 残留=${retiredIn(merged)}`)
  report('K5b 旧包 fromCuriosityId / 挂载字段零携带（reload 后载入路径再剥一次）',
    !!after && retiredIn(after) === 0,
    `残留=${retiredIn(after)}`)
  /* 可选段零迁移：旧包没有 supportLinks 时**保持缺省**就是设计——不补空数组、不报错、渲染正常 */
  report('K6 旧包无 supportLinks 段兼容（可选段零迁移：缺省即合法）',
    !!after && (after.supportLinks === undefined || Array.isArray(after.supportLinks)) && !errBoundary,
    `supportLinks=${JSON.stringify(after?.supportLinks)} recStrip=${recStrip}`)

  // 验证 4：旧数据项目在「项目详情」页正常渲染（R145 修漂移：R117 的左栏切换器 .pt-item 已于
  //   R130-N4 退役为「本项目目录」锚点导航 → 改测项目页真渲染：面包屑点名项目 + 指标块在位 + 无渲染错误兜底）
  await page.goto(base + '#/compass/projects?p=k-proj-1', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const dbg = {
    err: await page.locator('.render-error').first().isVisible().catch(() => false),
    crumb: (await page.locator('.crumb').first().textContent().catch(() => '')).trim(),
    metric: (await page.locator('.metric-sec').first().textContent().catch(() => '')).trim().slice(0, 40),
    msec: await page.locator('.metric-sec').count(),
  }
  console.log('[debug]', JSON.stringify(dbg))
  report('K3 旧数据项目在「项目详情」页正常渲染（面包屑点名 + 指标块在位 + 无渲染错误）',
    !dbg.err && dbg.crumb.includes('K 兼容项目') && dbg.msec >= 1 && dbg.metric.includes('K 兼容指标'),
    `crumb=${dbg.crumb.slice(0, 30)} msec=${dbg.msec} metric=${dbg.metric.slice(0, 16)}`)

  await ctx.close()
  fs.unlinkSync(importPath)
  const fail = results.filter(r => !r.ok).length
  console.log(`\nK 导入兼容实测：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error('K 实测执行失败：', e); process.exit(2) })
