/**
 * V3.8.42 · P0-3 审核件：设置页 17 个子域的高保真实拍（原型审核用，非门禁）
 *
 * 为什么要它：P0-3 拆设置页是**纯结构重构**（实测 diff：搬走的模板与样式逐字进子组件，
 * 宿主换成组件标签，**零像素意图变更**）。因此「拆分后的高保真原型」不该由人手绘——
 * 手绘原型会引入一份与代码无关的第二个真相源，正是本项目 V3.8.41 刚治好的病。
 * ⇒ 这里做的是**从真实构建产物实拍**：dist 扩展 + 真实备份数据 + 真实路由，逐个子域截图。
 *
 * ★照抄 theme-audit.cjs 的实拍纪律（不是重新发明）：
 *   ① 用 `browser.cjs` 的四级回落定位 Chromium（P0：脚本自己抄一份解析逻辑 = R4-Ea 治过的病）；
 *   ② host 从 `serviceWorkers()` 动态取，不写死扩展 id；
 *   ③ **首次 goto 后等初始化完成再注入**，否则 createDefaultData 会覆盖种子数据（theme-audit 备案）；
 *   ④ 注入完**强制整页重载**一次，否则运行中的 store 拿不到新偏好（R170 备案：这是"注入生效"的唯一可靠办法）；
 *   ⑤ **等选择器真出现，不等固定时长**（纪律第 9 条）；
 *   ⑥ 每张截图前**核对当前子域是否真的在路由上**（goto(hash) 只改 hash，判据会量到上一页）。
 *
 * 用法：node scripts/shoot-settings-prototype.cjs [--only=resource,tags] [--theme=linear]
 * 产物：docs/视觉归档/prototype-V3.8.42/settings-<theme>-<page>.png + index.html 索引页
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { chromium } = require('playwright-core')
const { CHROME } = require('./browser.cjs')

const ROOT = path.resolve(__dirname, '..', '..')
const EXT_INDEX = 'src/newtab/index.html'
const VIEWPORT = { width: 1440, height: 900 }
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]
}))

/* 17 个子域。key 必须与 GlobalSettings.vue 的 navGroups 逐字一致（★回源码核过，
   不是凭印象抄的）；`route` 表示该项另有独立路由、点击后不在设置页内。 */
const PAGES = [
  { key: 'resource',    label: '资源卡' },
  { key: 'task',        label: '任务卡' },
  { key: 'curiosity',   label: '好奇心卡' },
  { key: 'thesis',      label: '策展主题卡' },
  { key: 'tags',        label: '标签管理' },
  { key: 'ai',          label: 'AI 助手' },
  { key: 'import',      label: '导入数据' },
  { key: 'export',      label: '导出数据' },
  { key: 'reset',       label: '重置与回滚' },
  { key: 'extension',   label: '扩展设置' },
  { key: 'shortcuts',   label: '快捷键设置' },
  { key: 'airtable',    label: 'Airtable 同步' },
  { key: 'manual',      label: '使用手册' },
  { key: 'letter',      label: '一封信' },   // V3.8.42 P0-3 第一批已拆出的子域
  { key: 'changelog',   label: '产品更新日志' },
  { key: 'about',       label: '关于' },
]
const GROUPS = [
  { title: '卡片与字段',   keys: ['resource', 'task', 'curiosity', 'thesis', 'tags'] },
  { title: 'AI 认知协作者', keys: ['ai'] },
  { title: '数据与信任',   keys: ['import', 'export', 'reset'] },
  { title: '系统信息',     keys: ['extension', 'shortcuts', 'airtable', 'manual', 'letter', 'changelog', 'about'] },
]

function pickData() {
  if (argv.data) return path.resolve(String(argv.data))
  const dl = path.join(os.homedir(), 'Downloads')
  const hits = fs.readdirSync(dl).filter(f => /^zhiyuan_backup_.*\.json$/.test(f)).sort()
  if (!hits.length) throw new Error('未找到备份数据；请用 --data=<path> 指定')
  return path.join(dl, hits[hits.length - 1])
}

async function main() {
  const dataFile = pickData()
  const pkg = path.resolve(__dirname, '..', 'dist')
  if (!fs.existsSync(path.join(pkg, 'manifest.json'))) throw new Error('dist 不是有效扩展包，请先 vite build')
  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const data = raw.zy_data_v2 || raw
  const theme = String(argv.theme || 'linear')
  const only = argv.only ? String(argv.only).split(',').map(s => s.trim()) : null
  const outDir = path.join(ROOT, 'docs', '视觉归档', 'prototype-V3.8.42')

  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    executablePath: CHROME,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${pkg}`, `--load-extension=${pkg}`, '--hide-scrollbars'],
  })

  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  const page = await ctx.newPage()

  /* ★V3.8.42 P0-3 第四批新增：抓运行期错误并**在"未就绪"提示里一并打印**。
     动机：拆子域那批出现的症状是「标题空、panel=false」，看不出任何原因——
     而真因（模板引用了未导入的组件 / props 少传一个）在浏览器 console 里一句话就说清。
     ⇒ **页面没渲染时，先看有没有运行期异常，再猜别的**。这与纪律 9 的
     「四主题全 0 不是一致，是都没渲染」同源：先证明"没渲染"的原因，别急着调选择器。 */
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)))
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('[console] ' + m.text()) })

  // ③ 先进一次让扩展初始化完成（否则随后注入被 createDefaultData 覆盖）
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const ui = { ...(data.uiPrefs || {}), theme }
  await page.evaluate(async ({ d, u }) => {
    await chrome.storage.local.set({ zy_data_v2: d, zy_ui_v2: u })
  }, { d: data, u: ui })
  await page.waitForTimeout(400)

  // ④ 注入后强制整页重载：运行中的 store 持有旧 ui 引用，不重载就读不到新偏好（R170 备案）
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 先确认设置页真的在（纪律第 9 条 ⑤：量到别的东西上比红更糟）
  await page.goto(base + '#/settings', { waitUntil: 'domcontentloaded' })
  try {
    await page.waitForSelector('.gs-nav-group', { timeout: 15000 })
  } catch {
    throw new Error('设置页左栏未出现 ⇒ 宿主没渲染，后续截图会全是空白页（拒不在此继续出图）')
  }
  console.log(`扩展：${extId} · 数据：${path.basename(dataFile)} · 主题：${theme}`)

  const shots = []
  const groups = only
    ? GROUPS.map(g => ({ ...g, keys: g.keys.filter(k => only.includes(k)) })).filter(g => g.keys.length)
    : GROUPS

  for (const g of groups) {
    for (const key of g.keys) {
      const meta = PAGES.find(p => p.key === key)
      if (!meta) continue
      // 用 hash 参数进子域（★这是设置页的真路由形态：#/settings?page=xxx）
      const expectHash = `#/settings?page=${key}`
      /* ★移开鼠标：Playwright 默认把指针停在 (0,0)，而导航条首项「调度台」的热区恰好覆盖那里，
         于是每次截图都把它的 hover 高亮拍进去 —— 表现为「同构建两跑差异包围盒 (11,17,239,722)、
         单通道最大差 36」，看起来像页面变了，实际变的是上一次 goto 留下的指针位置。
         这与 theme-audit 的「Esc 残留浮层串场」是同一族：**上一页的状态漏进下一页的图**。
         ⇒ 每张截图前先把指针移出视口，让 hover 态不成立。 */
      await page.mouse.move(1439, 899)
      /* ★**点左栏导航项**进子域，而不是改 hash —— 三种试过的做法里只有这一种两个问题同时消失：
         ① 改 hash 不重挂载 ⇒ 左栏 `.active` 停在上一子域（正文对、左栏错）；
         ② 整页 goto 重载 ⇒ 顶栏「调度台」的 active 态在两次运行间不一致（同构建两跑就差 62px）；
         ③ 点左栏 = 用户真实路径，左栏 active 由点击必然同步，顶栏也不再被路由切走。
         ★教训与 theme-audit 的 Esc 残留同族：**截图工具的每一条"快捷路径"都会漏掉某种状态**，
         捷径越短越容易漏；优先选与用户操作同构的那条。 */
      const navHit = await page.evaluateHandle((label) => {
        const nodes = [...document.querySelectorAll('.gs-nav-item')]
        return nodes.find(n => n.textContent.trim() === label) || null
      }, meta.label)
      const el = navHit.asElement()
      if (el) {
        await el.click()
      } else {
        // 左栏无该键（理论上不该发生）⇒ 记下来，不静默走 hash 兜底（那正是上面 ① 的坑）
        console.log(`  ⚠ ${key}: 左栏找不到「${meta.label}」`)
        await page.goto(base + expectHash, { waitUntil: 'domcontentloaded' })
      }
      // ⑤ 等这个子域真的渲染出来：判据是「页面标题非空 + 面板在 + hash 仍是目标子域」三者同时成立，
      // **不等固定时长**（纪律第 9 条：等固定时长会把上一页的残留当成本页已就绪）。
      /* ★等就条件改为「页面标题 + 面板在」，**不再要求 hash 带 page 参数**：
   走点击路径时 hash 恒为 `#/settings`（`onNavClick` 不改 URL，只改 activePage），
   若仍拿 `expectHash` 当就绪条件，会永远等不到 ⇒ 表现为「跳过 0 张」，
   而此时新旧两张图都还是上一次的，img-diff 便报"逐像素一致"——
   **一个假信号套着另一个假信号**（0 张新图 + 两张旧图相同 = 0 差）。
   ★这就是纪律第 9 条的现场：宁可漏拍，不可谎报。核对改用**页面标题**（唯一且逐子域不同）。 */
      const ready = await page.waitForFunction((label) => {
        const t = document.querySelector('.gs-page-title')
        const txt = t ? t.textContent.replace(/\s+/g, '') : ''
        return txt.includes(label.replace(/\s+/g, '')) && !!document.querySelector('.gs-panel')
      }, meta.label, { timeout: 8000 }).then(() => true).catch(() => false)
      if (!ready) {
        const now = await page.evaluate(() => ({ hash: location.hash, title: (document.querySelector('.gs-page-title')?.textContent || '').trim(), panel: !!document.querySelector('.gs-panel') }))
        console.log(`  ⚠ ${key}: 未就绪（标题=${now.title} panel=${now.panel}）跳过`)
        /* 打印本轮累积的运行期异常 —— 「没渲染」几乎总是它引起的，
           不打印就等于让读数的人靠猜（V3.8.42 第四批：真因是 props 少传一个，
           症状只有「标题空、panel=false」，两者毫无关联）。 */
        if (pageErrors.length) {
          console.log('    ↳ 运行期异常：')
          for (const e of [...new Set(pageErrors)].slice(0, 5)) console.log('      ' + e.slice(0, 300))
          pageErrors.length = 0
        }
        continue
      }
      const onPage = await page.evaluate(() => ({
        hash: location.hash,
        title: (document.querySelector('.gs-page-title')?.textContent || '').trim(),
        panel: !!document.querySelector('.gs-panel'),
        bodyLen: document.body.innerText.length,
        // ★左栏 active 必须落在本子域，否则图会骗人（正文对、左栏高亮停在上一项）
        navActive: (document.querySelector('.gs-nav-item.active')?.textContent || '').trim(),
      }))
      // ⑥ 核对真在目标子域上：hash 在点击路径下恒为 #/settings，改用**左栏 active + 标题**双条件
      if (onPage.navActive !== meta.label || onPage.bodyLen < 200) {
        console.log(`  ⚠ ${key}: 核对失败（左栏 active=${onPage.navActive} bodyLen=${onPage.bodyLen}）跳过`)
        continue
      }
      const file = path.join(outDir, `settings-${theme}-${key}.png`)
      await page.screenshot({ path: file, fullPage: true })
      shots.push({ ...meta, group: g.title, file: path.basename(file), title: onPage.title })
      console.log(`  ✓ ${key.padEnd(11)} → ${onPage.title || '(无标题)'}  ${path.basename(file)}`)
    }
  }

  fs.mkdirSync(outDir, { recursive: true })
  /* ★--only 必须**合并**进既有记录，不能整份覆盖：实测本轮先跑全量（16 张）再带 --only=changelog
     补拍一次，索引页就从 16 张塌成 1 张 —— 而截图文件都还在，只有索引被抹掉。
     这类"产物文件在、索引丢了"的失败模式很难在第一时间发现（页面能打开，只是少了几张），
     所以写入前一律先读既有 JSON 做并集。 */
  const shotsPath = path.join(outDir, `shots-${theme}.json`)
  let all = shots
  if (fs.existsSync(shotsPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(shotsPath, 'utf8'))
      const byKey = new Map(prev.map(s => [s.key, s]))
      for (const s of shots) byKey.set(s.key, s)   // 本轮拍的覆盖旧记录（重拍即更新）
      all = GROUPS.flatMap(g => g.keys.map(k => byKey.get(k)).filter(Boolean))
    } catch { /* 既有 JSON 坏了就以本轮为准，不因索引损坏阻断出图 */ }
  }
  fs.writeFileSync(shotsPath, JSON.stringify(all, null, 1))

  // 索引页：给用户一个能一次看完 16 张图的入口
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>设置页高保真实拍 · ${theme} · V3.8.42</title>
<style>
  body{margin:0;padding:32px;background:#0d0f12;color:#e6e8eb;
       font:14px/1.6 -apple-system,"PingFang SC",sans-serif}
  h1{font-size:20px;margin:0 0 4px}
  .note{color:#8b939c;margin:0 0 28px;font-size:13px}
  .g{margin:0 0 32px}
  .gt{font-size:13px;color:#8b939c;border-left:3px solid #3a6ea5;padding-left:10px;margin:0 0 14px}
  .row{display:flex;flex-wrap:wrap;gap:16px}
  .c{background:#16191d;border:1px solid #24282e;border-radius:8px;overflow:hidden;width:640px}
  .c img{width:100%;display:block}
  .cap{padding:8px 12px;font-size:12px;color:#9aa3ab}
  .cap b{color:#e6e8eb}
</style></head><body>
<h1>设置页 · 高保真实拍（${theme} 主题）</h1>
<p class="note">V3.8.42 P0-3 拆分审核件 · 来自 dist 真实构建产物实拍，非手绘 ·
数据 ${path.basename(dataFile)} · ${all.length} / ${PAGES.length} 个子域 · ${new Date().toLocaleString('zh-CN')}</p>
${groups.map(g => `<div class="g"><div class="gt">${g.title}</div><div class="row">${
  all.filter(s => s.group === g.title).map(s =>
    `<div class="c"><img src="${s.file}" alt="${s.label}"><div class="cap"><b>${s.label}</b> · ${s.key}${s.key === 'letter' ? ' · 本批已拆出' : ''}</div></div>`
  ).join('')}</div></div>`).join('\n')}
</body></html>`
  fs.writeFileSync(path.join(outDir, `index-${theme}.html`), html)

  console.log(`\n本轮 ${shots.length} 张 · 索引累计 ${all.length} 张 → ${path.join(outDir, `index-${theme}.html`)}`)
  await ctx.close()
}

main().catch(e => { console.error('实拍失败：' + e.message); process.exit(1) })
