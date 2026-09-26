/**
 * R48 排查脚本 #3：全路由冒烟巡检 + 注入用户导入数据 + 同会话操作流，抓渲染错误
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const IMPORT_FILE = 'C:/Users/dongdonglaoshi2026/Downloads/zhiyuan_backup_2026-09-04.json'

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host

  const errors = []
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 400)) })
  page.on('pageerror', e => errors.push('[pageerror] ' + String(e && e.stack || e).slice(0, 1000)))

  const base = `chrome-extension://${extId}/src/newtab/index.html`
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const data = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8'))
  await page.evaluate(d => chrome.storage.local.set({ zy_data_v2: d }), data)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  async function visit(route, name, wait = 2200) {
    const before = errors.length
    await page.evaluate(h => { location.hash = h }, route)
    await page.waitForTimeout(wait)
    const banner = await page.evaluate(() => (document.body.innerText || '').includes('页面渲染出错'))
    console.log(`${banner || errors.length > before ? '❌' : '✅'} ${name} (${route}) banner=${banner} 新增错误=${errors.length - before}`)
  }

  // 首页 → 罗盘各页 → 工作台（取导入数据里的真实 ws id）→ 设置 → 回收站 → 手册
  const wsId = await page.evaluate(async () => {
    const r = await chrome.storage.local.get('zy_data_v2')
    return (r.zy_data_v2.workspaces && r.zy_data_v2.workspaces[0] || {}).id || ''
  })
  await visit('#/', '罗盘首页')
  await visit('#/compass/actions', '今日行动')
  await visit('#/compass/tree', '方向树')
  await visit('#/compass/projects', '项目策展')
  if (wsId) await visit('#/workspace/' + wsId, '工作台(' + wsId + ')')
  await visit('#/settings', '设置')
  await visit('#/recycle', '回收站')

  // 打开全局搜索弹层（按键 Ctrl+K），输入触发拼音路径
  await page.evaluate(h => { location.hash = '#/' }, '#/')
  await page.waitForTimeout(1500)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(800)
  await page.keyboard.type('设计')
  await page.waitForTimeout(1200)
  // 模拟点击第 2 个结果
  const items = page.locator('.gp-result-item')
  const n = await items.count()
  console.log('搜索结果条数:', n)
  if (n > 1) { await items.nth(1).click(); await page.waitForTimeout(1200) }
  const bannerSearch = await page.evaluate(() => (document.body.innerText || '').includes('页面渲染出错'))
  console.log(`${bannerSearch ? '❌' : '✅'} 全局搜索交互 banner=${bannerSearch}`)

  console.log('--- 错误收集 (' + errors.length + ') ---')
  errors.slice(0, 12).forEach(e => console.log(e))
  await ctx.close()
}
main().catch(e => { console.error('脚本失败:', e); process.exit(1) })
