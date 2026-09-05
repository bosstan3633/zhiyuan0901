/**
 * R49-K 导入兼容实测（Playwright MV3 真机）
 * 场景：V2.21.3 形状的导出 JSON（Project 无 pinned/order、无 importedAt/callCount 新字段）
 *       导入 V2.22.0 → 可解析、取并集、缺省字段补默认、三件事仍显示于调度台首页。
 * 运行：node scripts/test-import-compat.cjs
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
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
    resources: [],
    tasks: [{
      id: 'k-task-1', kind: 'task', title: 'K 兼容任务卡', projectId: 'k-proj-1', metricId: 'k-met-1',
      status: 'doing', priority: 'medium', mountedResourceIds: [], mountedCuriosityIds: [], customFields: {}, tags: [], pinned: false, starred: false,
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
  report('K2 新字段缺省兼容（pinned/order 缺省，项目总览正常渲染）',
    !!proj && proj.pinned === undefined && proj.order === undefined,
    `pinned=${proj && proj.pinned} order=${proj && proj.order}`)

  // 验证 3：调度台首页正常打开（今日记录条/三件事区域不因旧数据报错）——先整页 reload（模拟重开新标签页）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const recStrip = await page.locator('.rec-strip').first().isVisible().catch(() => false)
  const errBoundary = await page.locator('.render-error').first().isVisible().catch(() => false)
  report('K4 调度台首页正常渲染（无渲染错误兜底）', recStrip && !errBoundary, `recStrip=${recStrip} error=${errBoundary}`)

  // 验证 4：方向台项目总览可见 K 项目（缺省字段渲染不炸）
  await page.goto(base + '#/compass', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const dbg = {
    err: await page.locator('.render-error').first().isVisible().catch(() => false),
    ov: await page.locator('.ov-card-item').count(),
    ovText: (await page.locator('.ov-card-item').first().textContent().catch(() => '')).slice(0, 80)
  }
  console.log('[debug]', JSON.stringify(dbg))
  report('K3 方向台项目总览正常渲染旧数据项目', dbg.ov >= 1 && dbg.ovText.includes('K 兼容项目'), dbg.ovText)

  await ctx.close()
  fs.unlinkSync(importPath)
  const fail = results.filter(r => !r.ok).length
  console.log(`\nK 导入兼容实测：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error('K 实测执行失败：', e); process.exit(2) })
