/**
 * 视觉归档走查 · theme-audit（R155 新建）
 *
 * 为什么有它：R155~R161 是视觉/交互改造轮，"改动前 vs 改动后必须逐屏可辨"是本系列唯一
 *   能自证的手段。原 04-63 任务书引用的 `theme-audit.cjs` 当时并不存在（2026-09-22 勘误），
 *   本条即补齐该工具。
 *
 * 做什么：加载扩展 → 注入真实库数据 → 对 **四主题 × 四个台面** 出 16 张首屏图，归档到
 *   `docs/视觉归档/<tag>/`，供逐屏对照。
 *
 * 用法：
 *   node scripts/theme-audit.cjs                       # 用 dist + 默认真实数据 + 默认 tag
 *   node scripts/theme-audit.cjs --tag=R155-before      # 指定归档标签
 *   node scripts/theme-audit.cjs --data=<backup.json>   # 指定数据源（默认取 Downloads 下最新 zhiyuan_backup_*.json）
 *   node scripts/theme-audit.cjs --pkg=<解压包目录>      # 直接测"交付物"而非 dist
 *   node scripts/theme-audit.cjs --only=linear,apple    # 只跑部分主题
 *
 * 与 e2e.cjs 同法：playwright-core + 本机 ms-playwright Chromium + headless + --load-extension。
 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const { chromium } = require('playwright-core')

/* R165-A 跨机移植（与 e2e.cjs/perf.cjs 同口径）：pinned → ZY_CHROME → 本机任一 ms-playwright Chromium → 系统 Chrome。
   原实现写死 Windows 路径，Mac 上门禁直接不可跑——防线不该绑死一台机器。 */
const CHROME_PINNED = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const CHROME = (() => {
  if (fs.existsSync(CHROME_PINNED)) return CHROME_PINNED
  if (process.env.ZY_CHROME) return process.env.ZY_CHROME
  const cache = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
  try {
    const hit = fs.readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort().pop()
    if (hit) {
      for (const p of [
        path.join(cache, hit, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(cache, hit, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      ]) if (fs.existsSync(p)) return p
    }
  } catch { /* 无缓存目录 */ }
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return process.platform === 'darwin' && fs.existsSync(sys) ? sys : CHROME_PINNED
})()
const EXT_INDEX = 'src/newtab/index.html'
const ROOT = path.resolve(__dirname, '..', '..')

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
  return m ? [m[1], m[2] ?? true] : [a, true]
}))

const THEMES = ['linear', 'raycast', 'apple', 'notion']
const VIEWS = [
  { id: 'dashboard', hash: '#/', name: '调度台' },
  { id: 'compass', hash: '#/compass', name: '方向台' },
  { id: 'resource', hash: '#/workspace/zy-curation', name: '资源台' },
  { id: 'settings', hash: '#/settings', name: '设置页' }
]
/** R161：AI 评审已是**中央弹窗**（不再是右侧抽屉），只抓四个台面默认态等于没抓本轮主交付面。
 *  故按 04-63 §R161 的验收口径补 **4 主题 × 2 档 = 8 张**：档 1 双栏（1440）、档 2 窄屏降单栏（1000，
 *  走 `@media (max-width:1199px)` 的堆叠路径）。
 *  说明：用**不可达网关**打开弹窗（不依赖真实 Key）——左栏「当前形态」、阶段条、一次性指令条、
 *  差异汇总行、底栏这些**壳与模块**照常渲染，只有右栏落到错误态；这几张图的目的是"新壳在四主题下
 *  不破版 + 令牌生效 + 响应式两档成立"，不是评审结果本身。 */
const MODAL_VIEWS = [
  { id: 'ai-modal', name: 'AI 评审·双栏', width: 1440, height: 900 },
  { id: 'ai-modal-narrow', name: 'AI 评审·窄屏', width: 1000, height: 780 }
]

const VIEWPORT = { width: 1440, height: 900 }

/**
 * R165-A 补漏：本轮主交付面是**三张卡的详情抽屉**，而本脚本此前只抓四个台面默认态 + AI 评审弹窗
 * ——等于"走查过了，但没走过真正改动的那一面"。补 4 主题 × 3 卡详情 = 12 张。
 * 每张现场核三条判据：抽屉真开 / AI 主上下文动作在**标题行** / 页脚**恰好两钮**。
 * **任一不过即非零退出**——只出图不核判据的走查是自我安慰：首轮实跑就抓到"以为打开了其实打开的是空页面"。
 *
 * 选择器注意（都踩过）：
 *  · 任务行在卡片/列表/看板三形态类名各异（.tm-card / .trow / …），共有的是 `[data-tid]`；
 *  · 资源卡链接的 ↗/ 复用 `.dr-footer-btn` 类但住在正文里，页脚计数必须按 `.dr-footer` 容器取，不能按类名全站数；
 *  · 三张卡详情各在哪个台面：资源卡在资源台，任务/好奇在**调度台首页底部 Tab**（CompassHome 挂 '/'）。
 */
const DRAWER_VIEWS = [
  {
    id: 'drawer-resource', name: '资源卡详情', hash: '#/workspace/zy-curation',
    card: '.res-card', open: '.ref-form', ai: '.ref-title-row .dr-footer-btn.ai', foot: '.dr-footer button',
  },
  {
    id: 'drawer-task', name: '任务卡详情', hash: '#/', tab: '任务调度',
    card: '[data-tid]', open: '.task-sidebar', ai: '.task-sidebar .ts-ai-cell', aiCount: 3, foot: '.ts-foot button',
  },
  {
    id: 'drawer-curio', name: '好奇心详情', hash: '#/', tab: '好奇心培育',
    card: '.cz-card', open: '.drawer .ds-quote', ai: '.drawer-header .cz-ai-btn', foot: '.drawer-footer button',
  },
]

/** 浮层是否还挂着（两代壳都认：R161 起的中央弹窗 `.md-panel` + V3.2.1 及以前的右侧抽屉 `.drawer`）。 */
async function overlayOpen(page) {
  return await page.locator('.md-panel, .drawer').first().isVisible().catch(() => false)
}
/**
 * 关掉遗留浮层，返回"仍关不掉"。为什么需要它：主题之间**只切 hash 不整页重载**（见下），
 * 浮层是全局的 ⇒ 上一主题收尾没关掉的评审面板会一路盖住后面所有台面图。
 * 先按 Esc；还不掉就点关闭按钮（两代壳都试）——「Esc 关不掉」本身是产品缺陷（R161 实测修掉），
 * 这里兜底是为了让**旧包（V3.2.1）的 before 套**也能出一份干净对照，而不是让缺陷污染证据。
 */
async function closeOverlays(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await overlayOpen(page))) return
    if (i === 0) await page.keyboard.press('Escape').catch(() => {})
    else await page.locator('.md-close, .drawer-close').first().click().catch(() => {})
    await page.waitForTimeout(400)
  }
}
/**
 * 截图前把「视角」归零：滚动条 + 鼠标位置。
 * **这是可比性的前提**，不是美化 —— 主题之间只切 hash 不重载（SPA），三种残留都会伪造差异：
 *   ① 滚动位置：R161 实测同一包同一页两次采样，一张在页顶、一张滚到项目详情（体积差 22KB）；
 *   ② 鼠标 hover：实测 `after` 套里某张卡左上多出一个悬浮工具条（📌/📁/🗑/🤖），
 *      就是上一轮点击留下的鼠标位置造成的 hover 态 —— 逐像素 diff 显示 8140 px 差异集中在那一个 196×150 方块里；
 *   ③ 弹窗内部滚动容器同理（`.md-body`）。
 * 归零后 before/after 才是同一视角；差异才只可能来自代码。
 */
async function resetView(page) {
  await page.mouse.move(0, 0).catch(() => {}) /* 鼠标挪到左上角空白，清掉卡片 hover 态 */
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.scrollTop) el.scrollTop = 0
    }
  }).catch(() => {})
  await page.waitForTimeout(300)
}

function pickData() {
  if (argv.data) return path.resolve(String(argv.data))
  const dl = path.join(os.homedir(), 'Downloads')
  const hits = fs.readdirSync(dl).filter(f => /^zhiyuan_backup_.*\.json$/.test(f)).sort()
  if (!hits.length) throw new Error('未找到备份数据；请用 --data=<path> 指定')
  return path.join(dl, hits[hits.length - 1])
}

async function main() {
  const dataFile = pickData()
  const pkg = argv.pkg ? path.resolve(String(argv.pkg)) : path.resolve(__dirname, '..', 'dist')
  const tag = String(argv.tag || new Date().toISOString().slice(0, 10))
  const outDir = path.resolve(ROOT, 'docs', '视觉归档', tag)
  const themes = argv.only ? String(argv.only).split(',') : THEMES

  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  if (!fs.existsSync(path.join(pkg, 'manifest.json'))) throw new Error('目标不是有效扩展包：' + pkg)
  fs.mkdirSync(outDir, { recursive: true })

  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const data = raw.zy_data_v2 || raw
  const alive = (data.resources || []).filter(r => !r.deletedAt).length
  console.log(`数据源：${path.basename(dataFile)}（资源 ${(data.resources || []).length} / 活 ${alive} · 分类 ${(data.categories || []).length} · 策展台 ${(data.workspaces || []).length}）`)
  console.log(`扩展包：${pkg}`)
  console.log(`归档到：${outDir}`)

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${pkg}`, `--load-extension=${pkg}`, `--hide-scrollbars`]
  })

  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)

  // 首次进入让扩展完成初始化（否则随后注入会被 createDefaultData 覆盖）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const ui = { ...(data.uiPrefs || {}) }
  await page.evaluate(async ({ d, u }) => {
    await chrome.storage.local.set({ zy_data_v2: d, zy_ui_v2: u })
  }, { d: data, u: ui })
  await page.waitForTimeout(400)

  // R161：AI 评审弹窗用不可达网关打开（左栏/阶段条/指令条/底栏照常渲染，不依赖真实 Key）
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      zy_ai_v1: { baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'audit', model: 'audit', depth: 'eco', personas: [], customPersonas: [] }
    })
  })
  await page.waitForTimeout(300)

  const shots = []
  /** R161：Esc 若关不掉弹窗，遗留浮层会串场到下一主题的四个台面图（同文档内切 hash 不重载），
   *  24 张图里有 18 张就被一条弹窗盖住了 —— 这正是本轮实测抓到的 Modal.vue 缺陷，故列为硬告警。 */
  const escLeak = []
  const drawerFail = []
  for (const theme of themes) {
    // 上一主题遗留的浮层先清掉（best-effort）：不掩盖问题——下面每张弹窗图收尾都会判一次 Esc
    if (await overlayOpen(page)) {
      console.log(`    ⚠ 进入主题 ${theme} 时仍有一条评审浮层挂着（说明上一主题的 Esc 没生效）—— 先清场`)
      await closeOverlays(page)
    }
    // 切主题：直接改 <html data-theme> —— tokens.css 的四套主题全部以该属性为选择器，
    //   改属性即时生效。**不用整页重载**：2026-09-22 实测 reload 会丢掉 URL hash，
    //   导致同主题内 4 张图全部截到 `#/`（首版 16 图里 9 张 md5 重复即此坑）。
    //   同时写回 storage 保持一致，防路由切换时被 store 覆盖回旧值。
    const okTheme = await page.evaluate(async (t) => {
      const cur = (await chrome.storage.local.get('zy_ui_v2'))['zy_ui_v2'] || {}
      cur.theme = t
      await chrome.storage.local.set({ zy_ui_v2: cur })
      document.documentElement.dataset.theme = t
      return document.documentElement.dataset.theme
    }, theme)
    for (const v of VIEWS) {
      await page.goto(base + v.hash, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2300)
      await resetView(page) /* 视角归零（滚动 + 鼠标 hover），否则 md5/像素对照全是假的 */
      const hash = await page.evaluate(() => location.hash)
      const file = path.join(outDir, `${theme}-${v.id}.png`)
      await page.screenshot({ path: file })
      const kb = Math.round(fs.statSync(file).size / 1024)
      shots.push(file)
      console.log(`  ✓ ${theme.padEnd(8)} ${v.name.padEnd(4)} hash=${(hash || '#/').padEnd(26)} → ${path.basename(file)} (${kb}KB)`)
    }
    // R161：AI 评审中央弹窗（走 设置 › AI 助手 › 本周回顾 —— 该入口已接左栏与指令条）
    for (const m of MODAL_VIEWS) {
      await page.setViewportSize({ width: m.width, height: m.height })
      await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1600)
      await page.locator('.gs-nav-item, .gs-nav button, button', { hasText: 'AI 助手' }).first().click().catch(() => {})
      await page.waitForTimeout(700)
      await page.locator('.gs-btn', { hasText: '回顾' }).first().click().catch(() => {})
      await page.waitForTimeout(2000)
      await resetView(page) /* 弹窗内部滚动容器与鼠标位置同样归零：两档图的差异必须只来自宽度 */
      const shell = await page.locator('.md-panel').first().isVisible().catch(() => false)
      const dual = await page.locator('.ai-dual').first().isVisible().catch(() => false)
      const file = path.join(outDir, `${theme}-${m.id}.png`)
      await page.screenshot({ path: file })
      const kb = Math.round(fs.statSync(file).size / 1024)
      shots.push(file)
      console.log(`  ✓ ${theme.padEnd(8)} ${m.name.padEnd(6)} 壳=${shell ? 'md-panel' : '未开'} 对照区=${dual ? '有' : '无'}   → ${path.basename(file)} (${kb}KB)`)
      if (!shell) console.log(`    ⚠ ${theme}/${m.id} 没抓到 .md-panel —— 弹窗未打开，这张图不作数`)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(400)
      // R161：Esc 必须**真**关掉 —— 本轮实测 Modal.vue 的 `watch(() => open)` 缺 `immediate`，
      //   而宿主是 `<AiSuggestionDrawer v-if="aiJob" :job="…">`（open 出生即 true）⇒ 监听从未注册
      //   ⇒ Esc 无效、面板不聚焦。这条判据把该缺陷钉死在每一次视觉归档里（关不掉即非零退出）。
      if (await page.locator('.md-panel').first().isVisible().catch(() => false)) {
        escLeak.push(`${theme}/${m.id}`)
        console.log(`    ⚠ ${theme}/${m.id} Esc 没关掉弹窗 —— 会让下一主题的台面图全部被盖住`)
      }
      await closeOverlays(page) /* 兜底清场（旧包的 .drawer 在此清掉，不把遗留带进下一主题） */
    }
    // R165-A 补漏：三张卡的详情抽屉（本轮主交付面）——判据不过即记账，收尾统一非零退出
    for (const v of DRAWER_VIEWS) {
      await page.setViewportSize(VIEWPORT)
      await page.goto(base + v.hash, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1800)
      if (v.tab) {
        await page.locator('.bt-tab', { hasText: v.tab }).first().click().catch(() => {})
        await page.waitForTimeout(1200)
      }
      const n = await page.locator(v.card).count().catch(() => 0)
      if (!n) {
        drawerFail.push(`${theme}/${v.id}：台面上没有卡片可点（${v.card} 命中 0）——数据没种上或视图没渲染`)
        console.log(`  ✗ ${theme.padEnd(8)} ${v.name} — ${v.card} 命中 0，这张图不作数`)
        continue
      }
      await page.locator(v.card).first().click().catch(() => {})
      await page.waitForTimeout(900) /* 抽屉有进场动效，等它落位再截 */
      await resetView(page)
      const opened = await page.locator(v.open).first().isVisible().catch(() => false)
      /* R166 定案 6：任务详情是**三格等宽独立行** ⇒ 声明 aiCount 时要求"恰好 N 格"，
         少一格（比如合并回单枚钮）或多一格都算不过；未声明的仍按"至少一枚可见"判。 */
      const aiCount = await page.locator(v.ai).count().catch(() => 0)
      const aiInHead = v.aiCount ? aiCount === v.aiCount : aiCount > 0
      const footCount = await page.locator(v.foot).count().catch(() => -1)
      const file = path.join(outDir, `${theme}-${v.id}.png`)
      await page.screenshot({ path: file })
      const kb = Math.round(fs.statSync(file).size / 1024)
      shots.push(file)
      const ok = opened && aiInHead && footCount === 2
      console.log(`  ${ok ? '✓' : '✗'} ${theme.padEnd(8)} ${v.name.padEnd(6)} 开=${opened ? '是' : '否'} AI在标题行=${aiInHead ? '是' : '否'}(${aiCount}${v.aiCount ? '/' + v.aiCount : ''}) 页脚钮=${footCount}   → ${path.basename(file)} (${kb}KB)`)
      if (!ok) drawerFail.push(`${theme}/${v.id}：开=${opened} AI在标题行=${aiInHead}(计${aiCount}，应${v.aiCount || '≥1'}) 页脚钮数=${footCount}（应为 2）`)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(400)
      await closeOverlays(page)
    }
    await page.setViewportSize(VIEWPORT)
    console.log(`  主题 ${theme} 落盘（data-theme=${okTheme}）`)
  }

  await page.evaluate(async () => { await chrome.storage.local.remove(['zy_ai_v1']) }).catch(() => {})
  await ctx.close()
  console.log(`\ntheme-audit 完成：${shots.length} 图 → ${outDir}`)
  const want = themes.length * (VIEWS.length + MODAL_VIEWS.length + DRAWER_VIEWS.length)
  if (shots.length !== want) { console.log(`❌ 图数 ${shots.length} ≠ 应有 ${want}（${themes.length} 主题 × (${VIEWS.length} 台面 + ${MODAL_VIEWS.length} 弹窗 + ${DRAWER_VIEWS.length} 卡详情)）`); process.exit(1) }
  if (escLeak.length) {
    console.log(`❌ Esc 未能关闭中央弹窗：${escLeak.join(' / ')}（台面图已受影响，请查 Modal.vue 的 watch immediate）`)
    process.exit(1)
  }
  if (drawerFail.length) {
    console.log(`❌ 卡详情抽屉判据未过 ${drawerFail.length} 项：\n  ` + drawerFail.join('\n  '))
    process.exit(1)
  }
}
main().catch(e => { console.error('theme-audit 失败：', e); process.exit(2) })
