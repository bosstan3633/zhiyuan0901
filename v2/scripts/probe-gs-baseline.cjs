/**
 * V3.8.42 · 探针：设置页「共享基类」在子组件里是否真的生效
 *
 * ★为什么需要它：P0-3 把 manual/changelog/about/letter 四个子域搬成了独立组件，
 * 但它们模板里用的 `.gs-panel` / `.gs-card` / `.gs-card-body` / `.gs-page-header` 等基类
 * **只定义在宿主 GlobalSettings.vue 的 `<style scoped>` 里**。
 * Vue 的 scoped 是「按组件实例打 data-v」，子组件内部元素拿不到父组件的 data-v
 * ⇒ 理论上这些基类在子组件里应当全部失效。
 * 而上轮像素 A/B 报的是「0 差」，两者必有一假 ⇒ 本脚本不靠推理，直接读 computed style。
 *
 * 用法：node scripts/probe-gs-baseline.cjs
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { chromium } = require('playwright-core')
const { CHROME } = require('./browser.cjs')

const ROOT = path.resolve(__dirname, '..', '..')
const EXT_INDEX = 'src/newtab/index.html'

function pickData() {
  const dl = path.join(os.homedir(), 'Downloads')
  const hits = fs.readdirSync(dl).filter(f => /^zhiyuan_backup_.*\.json$/.test(f)).sort()
  if (!hits.length) throw new Error('未找到备份数据')
  return path.join(dl, hits[hits.length - 1])
}

/** 要量的属性：基类的视觉签名（有值 = 生效；全空/初始值 = 掉了） */
const PROBE_CSS = {
  '.gs-card': ['borderTopWidth', 'borderRadius', 'backgroundColor', 'boxShadow', 'overflow'],
  '.gs-panel': ['padding'],
  '.gs-page-header': ['marginBottom', 'display'],
  '.gs-page-title': ['fontSize', 'fontWeight'],
  '.gs-btn': ['padding', 'borderRadius', 'cursor'],
}

async function main() {
  const dataFile = pickData()
  const pkg = path.resolve(__dirname, '..', 'dist')
  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const data = raw.zy_data_v2 || raw

  const ctx = await chromium.launchPersistentContext('', {
    headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    executablePath: CHROME, ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${pkg}`, `--load-extension=${pkg}`, '--hide-scrollbars'],
  })
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const base = `chrome-extension://${new URL(worker.url()).host}/${EXT_INDEX}`
  const page = await ctx.newPage()

  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(async (d) => { await chrome.storage.local.set({ zy_data_v2: d }) }, data)
  await page.waitForTimeout(400)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.gs-nav-group', { timeout: 15000 })

  // 已拆子域（子组件内） vs 未拆子域（仍在宿主模板内）
  const TARGETS = [
    { key: 'manual', label: '使用手册', split: true },
    { key: 'about', label: '关于', split: true },
    { key: 'letter', label: '一封信', split: true },
    { key: 'resource', label: '资源卡', split: false },
    { key: 'reset', label: '重置与回滚', split: true },
  ]

  for (const t of TARGETS) {
    await page.mouse.move(1439, 899)
    const h = await page.evaluateHandle((label) =>
      [...document.querySelectorAll('.gs-nav-item')].find(n => n.textContent.trim() === label) || null, t.label)
    const el = h.asElement()
    if (el) await el.click()
    await page.waitForFunction((label) => {
      const n = document.querySelector('.gs-page-title')
      return !!n && n.textContent.replace(/\s+/g, '').includes(label.replace(/\s+/g, ''))
    }, t.label, { timeout: 8000 }).catch(() => {})

    const res = await page.evaluate((probe) => {
      const out = {}
      for (const [sel, props] of Object.entries(probe)) {
        const n = document.querySelector(sel)
        if (!n) { out[sel] = null; continue }
        const cs = getComputedStyle(n)
        out[sel] = Object.fromEntries(props.map(p => [p, cs[p]]))
        // ★同时记下 data-v：证明"父组件 scoped 选择器能不能命中这个元素"
        out[sel].__attrs = [...n.attributes].map(a => a.name).filter(x => x.startsWith('data-v'))
      }
      return out
    }, PROBE_CSS)

    console.log(`\n===== ${t.key}（${t.label}）${t.split ? '★已拆子组件' : '·未拆，仍在宿主'} =====`)
    for (const [sel, v] of Object.entries(res)) {
      if (!v) { console.log(`  ${sel.padEnd(16)} 元素不存在`); continue }
      console.log(`  ${sel.padEnd(16)} data-v=[${v.__attrs.join(',')}]  ${propsStr(v)}`)
    }
  }
  await ctx.close()
}

function propsStr(v) {
  return Object.entries(v).filter(([k]) => k !== '__attrs')
    .map(([k, val]) => `${k}=${val}`).join('  ')
}

main().catch(e => { console.error('探针失败：' + e.message); process.exit(1) })