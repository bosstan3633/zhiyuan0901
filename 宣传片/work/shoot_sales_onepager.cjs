/** 销售一页屏：从当前 dist 实拍纸墨白界面；只写隔离浏览器中的演示数据。 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('/Users/beantan/Downloads/zhiyuan0904/v2/node_modules/playwright-core')
const { CHROME } = require('/Users/beantan/Downloads/zhiyuan0904/v2/scripts/browser.cjs')

const ROOT = '/Users/beantan/Downloads/zhiyuan0904'
const OUT = path.join(ROOT, '文档中心/02_市场与销售/02-13_一页屏变体/assets')
const DIST = path.join(ROOT, 'v2/dist')
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo_data.json'), 'utf8'))
const now = Date.now()
const day = new Date()
const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
const WS = 'sales-consulting-delivery'
const PROJECT = 'sales-project-evidence'
const METRIC = 'sales-metric-evidence'

fs.mkdirSync(OUT, { recursive: true })

// 与一页屏共用同一顾问案例，避免界面和叙事各说各话。
data.compass = {
  vision: { content: '让专业经验成为可持续复用的解决方案。', updatedAt: now },
  mission: { content: '为企业客户把复杂问题讲清楚，把解决方法做扎实。', updatedAt: now },
  directions: [{
    id: 'sales-direction', name: '企业服务', term: 'mid', status: 'active',
    projects: [{
      id: PROJECT, name: '客户增长诊断与方案交付', nextStep: '完成判断与证据链，交付可追溯的诊断方案。',
      isFocused: true, progress: 45, status: 'active', order: 0,
      metrics: [{ id: METRIC, title: '每个核心判断都有依据与出处', target: '形成可交付方案', acceptance: '客户能沿证据回溯原始材料', taskIds: ['sales-task-1', 'sales-task-2', 'sales-task-3'] }],
    }],
  }],
}
data.tasks = [
  { id: 'sales-task-1', kind: 'task', title: '整理行业报告里的判断与依据', description: '', projectId: PROJECT, metricId: METRIC, status: 'doing', priority: 'high', customFields: {}, tags: ['研究'], pinned: false, createdAt: now, updatedAt: now },
  { id: 'sales-task-2', kind: 'task', title: '把客户追问补进方案的证据链', description: '', projectId: PROJECT, metricId: METRIC, status: 'todo', priority: 'high', customFields: {}, tags: ['交付'], pinned: false, createdAt: now, updatedAt: now },
  { id: 'sales-task-3', kind: 'task', title: '复盘本周行动与企业服务主线', description: '', projectId: PROJECT, metricId: METRIC, status: 'todo', priority: 'medium', customFields: {}, tags: ['校准'], pinned: false, createdAt: now, updatedAt: now },
]
data.dailyFocus = { [key]: data.tasks.map((t, i) => ({ id: `sales-focus-${i}`, sourceType: 'task', sourceId: t.id, text: t.title, done: false })) }
data.focusAutoDate = key
data.workspaces = [
  { archived: false, color: '#9E3FAF', coverTheme: 'paper', icon: '▦', id: 'zy-curation', kind: 'resource', name: '资源台', order: -1 },
  { id: WS, name: '企业增长诊断方案', icon: '◇', color: '#9E3FAF', coverTheme: 'paper', desc: '围绕客户问题组织判断与依据，形成可追溯的解决方案。', order: 90, archived: false, kind: 'curation', callCount: 6, lastCalledAt: now },
]
data.categories = [
  { id: 'sales-problem', workspaceId: WS, name: '看清真正的问题', description: '从客户现象回到影响增长的关键约束。', order: 0 },
  { id: 'sales-evidence', workspaceId: WS, name: '组织事实与依据', description: '行业报告、客户访谈与经营数据互相印证。', order: 1 },
  { id: 'sales-action', workspaceId: WS, name: '形成行动方案', description: '把判断转成有优先级的下一步。', order: 2 },
  { id: 'sales-interview', workspaceId: WS, name: '客户访谈', description: '客户反复提到的问题，比表面需求更接近根因。', order: 0, parentId: 'sales-problem' },
  { id: 'sales-report', workspaceId: WS, name: '行业报告', description: '外部数据为关键判断提供可回溯的依据。', order: 0, parentId: 'sales-evidence' },
]
const resource = (id, title, description, categoryId, extra = {}) => ({
  id, kind: 'resource', title, description, linkType: 'url', link: `https://example.com/${id}`,
  workspaceId: WS, categoryId, sourceType: 'official', tags: ['企业服务'], pinned: false,
  callCount: 5, lastCalledAt: now, customFields: {}, assets: [], createdAt: now, updatedAt: now, ...extra,
})
data.resources = [
  resource('sales-thesis-card', '客户真正需要的，不是更多观点，而是有依据的判断。', '把每一个建议放回事实、出处与适用边界中。', '', { isThesis: true, sourceType: 'own-work' }),
  resource('sales-r1', '三次客户访谈都指向同一个转化断点', '问题不是没有线索，而是关键决策缺少依据。', 'sales-interview'),
  resource('sales-r2', '行业报告：企业服务采购决策链', '原始报告与关键段落已经留存，可随时调出。', 'sales-report'),
  resource('sales-r3', '先统一判断，再排定行动优先级', '解决方案从关键约束出发，而不是从功能清单出发。', 'sales-action'),
]
data.curiosities = []
data.argCards = []
data.curationProjections = []

async function main() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    executablePath: CHROME, ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const base = `chrome-extension://${new URL(worker.url()).host}/src/newtab/index.html`
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.evaluate(async d => {
    await chrome.storage.local.set({ zy_data_v2: d, zy_ui_v2: { theme: 'notion', density: 'comfortable', wsViewMode: 'pyramid' } })
  }, data)
  await page.waitForTimeout(300)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  if (await page.evaluate(() => document.documentElement.dataset.theme) !== 'notion') throw new Error('纸墨白主题未生效')

  for (const [name, hash] of [['screen-dashboard-paper', ''], ['screen-direction-paper', '#/compass'], ['screen-curation-paper', `#/workspace/${WS}`]]) {
    await page.goto(base + hash, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2600)
    await page.mouse.move(4, 4)
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    console.log(`✓ ${name}.png · ${await page.title()}`)
  }
  await ctx.close()
}
main().catch(e => { console.error(e); process.exit(1) })
