/**
 * R118（T5）主题自适应走查 · 4 主题 × 4 台面截图
 *
 * 目的：主题色自适应是「视觉层」改动，静态断言只能保证「零裸 hex / 零幽灵令牌」，
 *       无法保证「浅色主题下没有白底白字、深色主题下没有刺眼反差」。
 *       本脚本把 4 套主题 × 4 个核心台面逐一渲染并截图，供人工走查。
 *
 * 运行：NODE_PATH=<pw-core 所在 node_modules> node scripts/theme-audit.cjs
 * 产出：v2/.theme-audit/<主题>-<台面>.png（16 张）
 *
 * 注意：
 *   ① 本脚本只截图，不做像素级判定——「白底白字」的自动化判定极易误报，
 *      交给眼睛比交给阈值可靠。它是**走查辅助**，不进回归门禁。
 *   ② 本版默认数据经 curationMigration 合并后**只剩「资源台」一个工作台**（无策展台），
 *      故脚本会自建一个演示策展台并种少量演示卡；跑在**全新临时 profile** 中，
 *      不触及真实数据。
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright', 'chromium-1234', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe')
const DIST = path.resolve(__dirname, '..', 'dist')
const EXT_INDEX = 'src/newtab/index.html'
const OUT = path.resolve(__dirname, '..', '.theme-audit')

/** 与 App.vue `themes` 数组同序（主题选择器按索引点击） */
const THEMES = [
  { id: 'linear', name: '深空薰衣草' },
  { id: 'raycast', name: '光速黑' },
  { id: 'apple', name: '极简白' },
  { id: 'notion', name: '纸墨白' }
]

const HUB = 'zy-curation'
const DEMO_WS = 'ta-demo-ws'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  fs.mkdirSync(OUT, { recursive: true })

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: CHROME,
    viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`]
  })

  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/${EXT_INDEX}`

  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await wait(3000)

  // 种演示数据（含自建策展台）——数据由 App 异步初始化，先轮询等它就绪
  const seeded = await page.evaluate(async ({ HUB, DEMO_WS }) => {
    const KEY = 'zy_data_v2' // = STORAGE_KEY（shared/models）
    const read = () => new Promise((res) => chrome.storage.local.get([KEY], (r) => res(r[KEY])))
    let d = null
    for (let i = 0; i < 20; i++) {
      const raw = await read()
      if (raw) { d = typeof raw === 'string' ? JSON.parse(raw) : raw; break }
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!d) return { ok: false, reason: '数据未初始化' }

    // 自建演示策展台（本版默认数据只有资源台一个工作台）
    if (!d.workspaces.some((w) => w.id === DEMO_WS)) {
      d.workspaces.push({ id: DEMO_WS, name: '演示策展台', icon: '💼', color: '#3A6B4C', coverTheme: 'deep-sea', desc: 'R118 主题走查演示', order: 1, archived: false })
    }
    if (!d.categories.some((c) => c.id === 'ta-demo-wc1')) {
      d.categories.push({ id: 'ta-demo-wc1', workspaceId: DEMO_WS, name: '论据素材', order: 0 })
      d.categories.push({ id: 'ta-demo-wc2', workspaceId: DEMO_WS, name: '反方资料', order: 1 })
    }
    if (!d.categories.some((c) => c.id === 'ta-demo-c1')) {
      d.categories.push({ id: 'ta-demo-c1', workspaceId: HUB, name: '设计参考', order: 0 })
      d.categories.push({ id: 'ta-demo-c2', workspaceId: HUB, name: '开发工具', order: 1 })
    }

    const push = (id, title, wsId, categoryId, link, tags, i) => {
      if (d.resources.some((r) => r.id === id)) return
      d.resources.push({
        id, kind: 'resource', title, linkType: 'url', link, workspaceId: wsId, categoryId, tags,
        pinned: i < 2, callCount: (i * 3) % 7, customFields: {},
        createdAt: Date.now() - i * 86400000, updatedAt: Date.now()
      })
    }
    // 资源台 8 张
    const hubSeed = [
      ['Figma 设计系统规范库', 'ta-demo-c1', 'https://figma.com', ['设计', '规范']],
      ['Coolors 配色生成器', 'ta-demo-c1', 'https://coolors.co', ['配色']],
      ['Dribbble 灵感流', 'ta-demo-c1', 'https://dribbble.com', ['灵感']],
      ['Linear 设计原则', 'ta-demo-c1', 'https://linear.app', ['设计', '产品']],
      ['Vite 官方文档', 'ta-demo-c2', 'https://vitejs.dev', ['构建']],
      ['Playwright 测试手册', 'ta-demo-c2', 'https://playwright.dev', ['测试']],
      ['TypeScript 语言手册', 'ta-demo-c2', 'https://ts.dev', ['语言']],
      ['MDN Web Docs', 'ta-demo-c2', 'https://developer.mozilla.org', ['文档']]
    ]
    hubSeed.forEach(([t, c, l, g], i) => push('ta-demo-r' + i, t, HUB, c, l, g, i))
    // 策展台 4 张
    const wsSeed = [
      ['行业报告：AI 教育渗透率', 'ta-demo-wc1', 'https://example.com/r1', ['报告']],
      ['用户访谈纪要 · 12 位', 'ta-demo-wc1', 'https://example.com/r2', ['访谈']],
      ['反例：某平台失败复盘', 'ta-demo-wc2', 'https://example.com/r3', ['复盘']],
      ['竞品定价横向对比', 'ta-demo-wc2', 'https://example.com/r4', ['竞品']]
    ]
    wsSeed.forEach(([t, c, l, g], i) => push('ta-demo-wr' + i, t, DEMO_WS, c, l, g, i))
    await new Promise((res) => chrome.storage.local.set({ [KEY]: d }, res))
    return { ok: true, wsCount: d.workspaces.length, resCount: d.resources.length }
  }, { HUB, DEMO_WS })
  console.log('种数据：', JSON.stringify(seeded))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await wait(2500)

  const PAGES = [
    { key: '1-dispatch', hash: '#/' },
    { key: '2-compass', hash: '#/compass' },
    { key: '3-resource', hash: '#/curation' },
    { key: '4-curation', hash: '#/workspace/' + DEMO_WS }
  ]

  const shots = []
  for (let ti = 0; ti < THEMES.length; ti++) {
    const t = THEMES[ti]
    // 回调度台切主题（主题按钮在顶栏，任意台面都有，但调度台最稳）
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await wait(2200)
    await page.locator('.theme-btn').first().click().catch(() => {})
    await wait(300)
    const opts = page.locator('.theme-option')
    const n = await opts.count()
    if (n > ti) await opts.nth(ti).click().catch(() => {})
    else console.log(`⚠ 主题下拉项不足（${n}），跳过 ${t.name}`)
    await wait(500)

    for (const p of PAGES) {
      await page.goto(base + p.hash, { waitUntil: 'domcontentloaded' })
      await wait(2000)
      const file = path.join(OUT, `${t.id}-${p.key}.png`)
      await page.screenshot({ path: file, fullPage: false })
      shots.push(file)
      console.log(`📸 ${t.name} · ${p.key} → ${path.basename(file)}`)
    }
  }

  await ctx.close()
  console.log(`\n完成：${shots.length} 张截图 → ${OUT}`)
}

main().catch((e) => {
  console.error('走查失败：', e)
  process.exit(1)
})
