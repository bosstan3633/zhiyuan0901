const fs = require('fs')
let s = fs.readFileSync('e2e.cjs', 'utf8')
function repl(prefix, newBlock) {
  const i = s.indexOf(prefix)
  if (i < 0) { console.error('NOT FOUND: ' + prefix); process.exit(1) }
  const end = s.indexOf("report('E2E-4", i)
  // 通用：替换到该用例 report 行结尾
  const endLine = s.indexOf('\n', s.indexOf('report(', i))
  s = s.slice(0, i) + newBlock + s.slice(s.indexOf('\n', s.indexOf('report(', i)) + 1)
}
// E2E-4：MetricBar 迁调度台 → 断言在 / 上
{
  const i = s.indexOf("  // E2E-4 方向台指标条")
  const end = s.indexOf('\n', s.indexOf("offCourseGone", i)) 
  const endLine = s.indexOf('\n', end + 1)
  s = s.slice(0, i) + `  // E2E-4 方向状态四格（R55-D1：迁调度台顶部）：4 格 + 详细指标下钻含北极星「新增卡片/删除卡片」
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const metricBarOn = await page.locator('.mb-cells').first().isVisible().catch(() => false)
  const offCourse = await page.getByText('未归档任务').first().isVisible().catch(() => false)
  await page.locator('.mb-drill').click().catch(() => {})
  await page.waitForTimeout(1200)
  const todayAdd = await page.getByText('新增卡片').first().isVisible().catch(() => false)
  const todayDel = await page.getByText('删除卡片').first().isVisible().catch(() => false)
  const oldLabelGone = !(await page.getByText('今日新增', { exact: true }).first().isVisible().catch(() => false))
  report('E2E-4 方向状态四格迁调度台顶部 + 详细指标下钻（R55-D1）', metricBarOn && offCourse && todayAdd && todayDel && oldLabelGone,
    `bar=` + metricBarOn + ` unarch=` + offCourse + ` add=` + todayAdd + ` del=` + todayDel)` + s.slice(endLine + 1)
}
// E2E-7：底部单区直呈 + 方向台任务调度模块
{
  const i = s.indexOf("  // E2E-7 调度台底部 Tab")
  const endLine = s.indexOf('\n', s.indexOf("tmCardCount >= 1", i))
  s = s.slice(0, i) + `  // E2E-7 底部专区（R55-B2）：好奇心培育单区直呈（无 Tab 头）；任务调度模块在方向台
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const tabsCount = await page.locator('.zone-tab').count()
  const curioPanelOn = await page.locator('.module-card').filter({ hasText: '好奇心' }).first().isVisible().catch(() => false)
  const tmOnShell = await page.evaluate(() => { location.hash = '#/compass'; return true })
  await page.waitForTimeout(1800)
  const taskModuleOn = await page.locator('#task-mgmt-module .tm-grid, #task-mgmt-module .tm-panel, #task-mgmt-module').first().isVisible().catch(() => false)
  const cardTabActive = await page.locator('.view-tab.active').first().textContent().then((t) => (t || '').includes('卡片')).catch(() => false)
  const tmCardCount = await page.locator('.tm-card').count()
  report('E2E-7 底部好奇心单区 + 方向台任务调度模块（R55-B1/B2）', tabsCount === 0 && curioPanelOn && taskModuleOn && cardTabActive && tmCardCount >= 1,
    `tabs=` + tabsCount + ` curioOn=` + curioPanelOn + ` taskModule=` + taskModuleOn + ` cardActive=` + cardTabActive + ` tmCards=` + tmCardCount)` + s.slice(endLine + 1)
}
// E2E-8：stats 选择器 → 状态栏
s = s.replace("const statCount = await page.locator('.cur-stat').count()", "const statCount = await page.locator('.cur-stat-strip .css-item').count()")
s = s.replace("report('E2E-8 调度台三件事 + 项目调度面板（愿景/使命+战略目标+四数值）'", "report('E2E-8 调度台三件事 + 项目调度面板（愿景/使命+战略目标+状态栏四格 R55-D2）'")
// E2E-14：点击目标改状态栏首格
s = s.replace("await page.getByText('成功指标', { exact: true }).first().click().catch(() => {})", "await page.locator('.cur-stat-strip .css-item').first().click().catch(() => {})")
fs.writeFileSync('e2e.cjs', s)
console.log('E2E 4/7/8/14 updated')
