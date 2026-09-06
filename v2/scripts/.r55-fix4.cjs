/* E2E-11 断言修正 + E2E-16 排障增强（用后即删） */
const fs = require('fs')
let s = fs.readFileSync('e2e.cjs', 'utf8')

// E2E-11：未归档格已随 MetricBar 迁调度台（E2E-4 已覆盖）→ 本用例聚焦主航线 chip
{
  const i = s.indexOf("  // E2E-11 主航线目标行 chip")
  const endMark = "' chip=' + goalChip"
  const end = s.indexOf(endMark, i) + endMark.length
  if (i < 0 || end < endMark.length) { console.error('E2E-11 not found'); process.exit(1) }
  const endLine = s.indexOf('\n', end)
  const newBlock = [
    "  report('E2E-11 主航线目标行 chip（未归档格随 MetricBar 迁调度台，E2E-4 已覆盖）', goalChip,",
    "    'chip=' + goalChip)"
  ].join('\n')
  s = s.slice(0, i) + newBlock + s.slice(endLine)
}

// E2E-16：加 pageerror 捕获 + 存储计数
s = s.replace("  const tcPanelOn = await page.getByText('快速采集任务').first().isVisible().catch(() => false)",
  "  const pageErrs = []\n  page.on('pageerror', e => pageErrs.push(String(e).slice(0, 150)))\n  const tcPanelOn = await page.getByText('快速采集任务').first().isVisible().catch(() => false)")
s = s.replace("'panel=' + tcPanelOn + ' saved=' + tcSavedOn + ' inDb=' + taskIn)",
  "'panel=' + tcPanelOn + ' saved=' + tcSavedOn + ' inDb=' + taskIn + ' errs=' + JSON.stringify(pageErrs))")

fs.writeFileSync('e2e.cjs', s)
console.log('E2E-11 fixed, E2E-16 instrumented')
