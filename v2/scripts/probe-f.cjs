/**
 * 06-2 §F · 分发路径复测（**R155 从临时探针提升为常驻门禁**）
 *
 * 与 `e2e.cjs` 同法：playwright-core + 本机 ms-playwright Chromium + headless + `--load-extension`。
 * 唯一区别：**加载的是真实交付物**（桌面生产包），不是 `v2/dist` —— 这样复测走的才是"用户拿到包以后"的路径。
 *
 * 为什么值得常驻：`06-2 §F` 是每次发版都要过的验收项，靠人手在浏览器里点容易漏、也不好留痕。
 * 首跑即抓出一处**文档漂移**：§F 原写「Alt+1 方向台 / Alt+2 资源台」，实际（R117 起）是
 * `Alt+1 调度台 / Alt+2 方向台 / Alt+3 资源台`——探针把三条都实测了一遍才发现。
 * V3.7.0（R179）：资源台页签退役 ⇒ 键位口径改 `Alt+1 调度台 / Alt+2 方向台 / Alt+3 起=各策展台`
 * （按台签顺序，与 App.vue switchToIndex 的 n-3 落位一致）；F-3c 判据（hash 含 workspace）不变，
 * ★但空档口经 R64 合台后**用户策展台为 0**（只剩资源台实体，不属前台列表）⇒ 直按 Alt+3 按设计
 * 只弹「没有第 N 号台」提示、不跳转（V3.7.0 首跑实测红即此因）。探针先种一台「探针台」再验，
 * 才是在验「键位 → 台签首台」这条真实路径（夹具缺口，非产品缺陷；诊断留痕见 archive/r179-probe-f3-diag.cjs）。
 *
 * 用法：
 *   node scripts/probe-f.cjs                                  # 自动取桌面最新 `知源调度台_V*` 包
 *   node scripts/probe-f.cjs "C:\path\to\知源调度台_V3.2.0"     # 指定包
 * 依赖：需可解析 `playwright-core`（与 e2e.cjs 同：设 NODE_PATH 或装在 v2/node_modules）。
 *
 * 三项：
 *   F-1 开发者模式「加载已解压的扩展程序」→ MV3 service worker 起来 + 包内 manifest 自洽
 *   F-2 新标签页接管（`chrome_url_overrides.newtab`）
 *   F-3 应用内三快捷键 Alt+1 / Alt+2 / Alt+3
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

// 与 e2e.cjs / perf.cjs 同一条浏览器回落链（06-2 §B 的 R145/R149 口径）：
// pinned Chrome for Testing → ZY_CHROME → 本机任一 ms-playwright Chromium → 系统 Chrome。
// 「本机没钉那个版本」不该成为跳过门禁的理由。
const CHROME_PINNED = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
function resolveChrome() {
  if (fs.existsSync(CHROME_PINNED)) return CHROME_PINNED
  if (process.env.ZY_CHROME) return process.env.ZY_CHROME
  const cache = process.platform === 'darwin'
    ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
    : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  try {
    const hits = fs.readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort()
    for (const hit of hits.reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome']) {
        const p = path.join(cache, hit, rel)
        if (fs.existsSync(p)) return p
      }
    }
  } catch { /* 无缓存目录 */ }
  const sys = process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : ''
  return sys && fs.existsSync(sys) ? sys : CHROME_PINNED
}

const ROOT = path.resolve(__dirname, '..')
const EXT_INDEX = 'src/newtab/index.html'

/** 默认包 = 桌面最新的 `知源调度台_V*` 解压目录（交付物真实落点） */
function defaultPkg() {
  const desktop = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop')
  try {
    const cands = fs.readdirSync(desktop)
      .filter(n => /^知源调度台_V[\d.]+$/.test(n) && fs.existsSync(path.join(desktop, n, 'manifest.json')))
      .map(n => ({ n, t: fs.statSync(path.join(desktop, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    if (cands.length) return path.join(desktop, cands[0].n)
  } catch { /* 桌面不可读 */ }
  return path.join(ROOT, 'dist')
}

/** 版本号唯一来源 = `src/manifest.ts`（06-2 §B 版本六处同步的口径） */
function sourceVersion() {
  try {
    const s = fs.readFileSync(path.join(ROOT, 'src', 'manifest.ts'), 'utf8')
    const m = s.match(/version:\s*'([^']+)'/)
    return m ? m[1] : ''
  } catch { return '' }
}

const PKG = path.resolve(process.argv[2] || defaultPkg())
const CHROME = resolveChrome()

const results = []
function report(name, ok, detail) { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —— ' + detail : ''}`) }

async function main() {
  const srcVer = sourceVersion()
  console.log('加载包：' + PKG)
  console.log('源码版本（src/manifest.ts）：' + (srcVer || '读取失败'))
  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  if (!fs.existsSync(path.join(PKG, 'manifest.json'))) throw new Error('包内无 manifest.json，不是有效的解压扩展包：' + PKG)

  const mf = JSON.parse(fs.readFileSync(path.join(PKG, 'manifest.json'), 'utf8'))
  console.log(`包内版本：${mf.version} · 文件数：${walkCount(PKG)}`)

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${PKG}`, `--load-extension=${PKG}`]
  })

  // ---- F-1 扩展加载（开发者模式「加载已解压的扩展程序」等价路径）----
  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  report('F-1a 加载已解压扩展 · MV3 worker 起来', worker.url().includes('service-worker-loader.js'), worker.url().split('/').pop())
  // 与源码版本比对，而不是写死某个版本号 —— 否则每轮发版这条断言都要改
  report('F-1b 包内 manifest.version = 源码版本', !!srcVer && mf.version === srcVer, `${mf.version}${srcVer && mf.version !== srcVer ? ' ≠ ' + srcVer : ''}`)
  report('F-1c manifest 声明 newtab 覆盖', mf.chrome_url_overrides && mf.chrome_url_overrides.newtab === EXT_INDEX, String(mf.chrome_url_overrides && mf.chrome_url_overrides.newtab))

  // ---- F-2 新标签页接管 ----
  const page = await ctx.newPage()
  let nd = { ok: false, detail: '' }
  try {
    await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(3000)
    const u = page.url()
    nd = { ok: u.startsWith('chrome-extension://' + extId) && u.includes(EXT_INDEX), detail: u.replace('chrome-extension://' + extId + '/', 'ext://') }
  } catch (e) { nd = { ok: false, detail: 'goto 失败: ' + String(e.message).split('\n')[0] } }
  report('F-2 新标签页接管（chrome://newtab → 扩展页）', nd.ok, nd.detail)

  // 兜底：headless 下 chrome://newtab 可能不可导航，至少验证扩展页可独立渲染为新标签页
  if (!nd.ok) {
    const base = `chrome-extension://${extId}/${EXT_INDEX}`
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const bodyOk = await page.evaluate(() => document.body.innerText.length > 20)
    report('F-2b 扩展页可独立渲染（兜底证据）', bodyOk, 'body 文本长度>20=' + bodyOk)
  }

  // ---- F-3 应用内三快捷键（Alt+1/2/3）----
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  const wt = async (h) => { await page.goto(base + h, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2200) }
  await wt('#/settings')
  await page.waitForTimeout(800)

  // ★R179：先种一台「探针台」——空档口用户策展台为 0（R64 合台把默认台并入资源台并删实体），
  //   Alt+3 无台可落只会弹提示。种一台后 F-3c 验的才是「Alt+3 → 台签首台」的真实路径。
  await page.evaluate(() => chrome.storage.local.get('zy_data_v2').then((cur) => {
    const d = cur['zy_data_v2']
    if (!d) return
    d.workspaces = (d.workspaces || []).filter((w) => w.id !== 'probe-f-ws-1')
    d.workspaces.push({ id: 'probe-f-ws-1', name: '探针台', icon: '🧪', color: '#4A7FB5', coverTheme: 'deep-sea', desc: '', order: 0, archived: false, kind: 'curation' })
    return chrome.storage.local.set({ zy_data_v2: d })
  }))
  // R145 律：外部直写 zy_data_v2 后必须整页重载（SPA 内存态不重读 storage）
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  async function press(code) {
    await page.evaluate(() => window.focus())
    await page.keyboard.down('Alt')
    await page.keyboard.press(code)
    await page.keyboard.up('Alt')
    await page.waitForTimeout(1200)
    return page.url()
  }

  const hash = (u) => u.split('#')[1] || ''

  const u1 = await press('Digit1')
  report('F-3a Alt+1 → 调度台（落地 /）', /^\/?$/.test(hash(u1)), hash(u1) || '(无 hash)')

  const u2 = await press('Digit2')
  report('F-3b Alt+2 → 方向台', hash(u2).includes('compass'), hash(u2) || '(无 hash)')

  const u3 = await press('Digit3')
  report('F-3c Alt+3 → 台签首台「探针台」（workspace 路由；V3.7.0/R179：资源台页签退役后 3 起=各策展台）', hash(u3).includes('workspace'), hash(u3) || '(无 hash)')

  // 浏览器级 commands 清单（manifest 定义）——只作信息输出，便于比对 §F 的键位说明
  const cmds = Object.keys(mf.commands || {})
  console.log('\nmanifest commands（浏览器级，' + cmds.length + ' 项）: ' + cmds.join(', '))
  const withKey = cmds.filter(k => mf.commands[k].suggested_key)
  console.log('带默认键的 commands: ' + withKey.map(k => `${k}=${mf.commands[k].suggested_key.default}`).join(' / '))

  await ctx.close()
  const fail = results.filter(r => !r.ok).length
  console.log(`\n§F 复测结果：${results.length - fail} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

function walkCount(dir) {
  let n = 0
  const st = [dir]
  while (st.length) {
    const d = st.pop()
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) st.push(p); else n++
    }
  }
  return n
}

main().catch((e) => { console.error('探针执行失败：', e); process.exit(2) })
