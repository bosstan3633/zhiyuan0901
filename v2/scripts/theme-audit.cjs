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

/* R4-Ea（挂账 #84）：浏览器可执行文件解析统一到 scripts/browser.cjs——四级回落的唯一实现。
   沿革：R165-A 跨机移植（原实现写死 Windows 路径，Mac 上门禁直接不可跑——防线不该绑死一台机器），
   当时把回落链在 7 个脚本里各抄一份，抄出了不一致（img-diff 只写死 chromium-1234，缓存换版本即失效）。 */
const { CHROME } = require('./browser.cjs')
const EXT_INDEX = 'src/newtab/index.html'
const ROOT = path.resolve(__dirname, '..', '..')

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a)
  return m ? [m[1], m[2] ?? true] : [a, true]
}))

/*
 * R4-Dl：截图可复现的两道闩（默认开）。R4-Dj 实测**同一份代码连采两次仍有 25-26/92 张逐像素不同**
 * ——原因是分钟级相对时间文本、hover 残留、动画窗口三种噪声，它们比一次真实改动还大，
 * 于是"改前改后截图对比"跨时间就不可用（那一轮只能退化成"同会话双构建 A/B"）。
 *   --no-freeze  不冻结墙上时钟（回到"每跑一次日期都在走"）
 *   --no-calm    截图前不关动画/过渡（回到"抓到动画中间帧"）
 * 关掉的用途不是偷懒，是让改前/改后能在**同一会话同一构建**上各测一次可复现率。
 */
const FREEZE = !argv['no-freeze']
const CALM = !argv['no-calm']
/** 冻结到本次运行的 UTC 日起点：分钟级"X 前"在同一天内恒定，跨日的差异是数据本身应有的变化
 *  ★R4-Ex：`--freeze-at=YYYY-MM-DD`（或完整 ISO / 毫秒数）把时钟钉到指定日。
 *  为什么开这个口子：默认零点跟着"今天"走 ⇒ 拿今天的重跑去比历史归档，字节级必然整片不同
 *  （R4-Ev 实测跨天 86/104 张不同），像素 A/B 因此只能当参考不能当门禁。钉住归档那一天，
 *  "改前构建 vs 改后构建"才可以在不同日期各跑一次而仍然可比。 */
const FREEZE_AT = (() => {
  const v = argv['freeze-at']
  if (v === undefined || v === true) return Math.floor(Date.now() / 86400000) * 86400000
  const s = String(v).trim()
  const t = /^\d+$/.test(s) ? Number(s) : Date.parse(s.length === 10 ? s + 'T00:00:00Z' : s)
  if (Number.isNaN(t)) {
    console.error(`--freeze-at=${s} 解析不出时间（收 YYYY-MM-DD、完整 ISO 或毫秒数）`)
    process.exit(2)
  }
  return Math.floor(t / 86400000) * 86400000
})()

const THEMES = ['linear', 'raycast', 'apple', 'notion']
const VIEWS = [
  { id: 'dashboard', hash: '#/', name: '调度台' },
  // R3-B1：树即方向台一级——#/compass 拍的就是完整方向树（原 CompassShell 主航线 + 内嵌展板退役）
  { id: 'compass', hash: '#/compass', name: '方向台（树即首屏）' },
  // R3-B1：老深链 #/compass/tree（content 快捷动作 / 浏览器命令 / 用户收藏）必须带 query 落到 /compass
  { id: 'compass-tree', hash: '#/compass/tree', name: '方向台老深链重定向' },
  // R1.5：资源台台面场随 R179 资源台退役（/workspace/zy-curation 为隐藏池 id，用户不可达，拍了也是空调试面）
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
 * 每张现场核：抽屉真开 / AI 入口**独立成行且格数对** / 页脚**恰好两钮**（资源卡另核「标题只有一处」）。
 * **任一不过即非零退出**——只出图不核判据的走查是自我安慰：首轮实跑就抓到"以为打开了其实打开的是空页面"。
 *
 * R167 随迁：AI 入口从标题行搬到正文首行 `.ds-ai-cell`（资源 2 格 / 好奇 1 格 / 任务 3 格），
 * 主标题搬进抽屉头 `.ds-h1`——所以资源卡这里多核一条"全抽屉只有一处主标题"，
 * 它正是本轮删掉的正向残留（正文里那份 `.ref-title` 若被哪个宿主加回来，这里就红）。
 *
 * 选择器注意（都踩过）：
 *  · 任务行在卡片/列表/看板三形态类名各异（.tm-card / .trow / …），共有的是 `[data-tid]`；
 *  · 页脚计数必须按**容器**取且两代容器都认（内联抽屉 `.dr-footer` / 共享 Drawer `.drawer-footer`）——
 *    按 `.dr-footer-btn` 类名全站数会把链接行的动作钮算进来；
 *  · 三张卡详情各在哪个台面：资源卡在资源台（内联抽屉；App 级抽屉由总线打开，同一套件），
 *    任务/好奇在**调度台首页底部 Tab**（CompassHome 挂 '/'）。
 */
const DRAWER_VIEWS = [
  {
    id: 'drawer-resource', name: '资源卡详情', hash: '#/workspace/zy-curation',
    card: '.res-card', open: '.ref-form', ai: '.ds-ai-cell', aiCount: 2, h1: '.ds-h1',
    foot: '.dr-footer button, .drawer-footer button',
  },
  {
    id: 'drawer-task', name: '任务卡详情', hash: '#/', tab: '任务卡',
    card: '[data-tid]', open: '.task-sidebar', ai: '.task-sidebar .ts-ai-cell', aiCount: 3, foot: '.ts-foot button',
    invert: '.task-sidebar .ts-ai-cell',
  },
  {
    id: 'drawer-curio', name: '好奇心详情', hash: '#/', tab: '好奇心卡',
    card: '.cz-card', open: '.drawer .ds-hero-note', ai: '.ds-ai-cell', aiCount: 1, foot: '.drawer-footer button',
  },
]

/**
 * R172-T13（04-67 §8.2）：知源仪表盘七场景 —— 本轮主交付面就是这三段，
 * 而 40 图里**一张仪表盘场景都没有**（只拍到 `#/settings` 外壳）。补 4 主题 × 7 = 28 张 ⇒ 68 图。
 * 每张都在页内核**结构判据**（不是只看图）：概览带五 chip + 口径表、热力图格子数与语义图例、
 * 日详情四列、共用下钻列表、复盘两栏的**实测列数**、AI 文本报告的四段顺序与「以上统下」闭环、
 * 调度台新「📈 复盘」方向条。任一不过即非零退出。
 */
const DASH_SCENES = [
  {
    id: 'dz-overview', name: '概览带',
    /* R173-5：说明默认「藏」、悬停才「现」——判据两侧都实测（只查节点会放过"又摊开了"） */
    judge: async (page) => {
      const base = await page.evaluate(() => {
        const sec = document.querySelector('.dz-ov')
        const chips = document.querySelectorAll('.dz-ov .dz-chip').length
        const tip = document.querySelector('.dz-ov-tip')
        const vis = tip ? getComputedStyle(tip).visibility : 'missing'
        const calib = document.querySelectorAll('.dz-calib .cb .r').length
        const errPill = !!document.querySelector('.dz-ov-err')
        /* R173-5：5 张存量卡必须同排（删掉人话块后 meta 行会抢整行，把 chip 挤成 1 列竖排） */
        const chipRows = new Set([...document.querySelectorAll('.dz-ov .dz-chip')].map(c => Math.round(c.getBoundingClientRect().top))).size
        return { sec: !!sec, chips, vis, calib, errPill, chipRows }
      })
      await page.locator('.dz-ov-info').first().hover().catch(() => {})
      await page.waitForTimeout(260)
      const shown = await page.evaluate(() => {
        const tip = document.querySelector('.dz-ov-tip')
        if (!tip || getComputedStyle(tip).visibility !== 'visible' || Number(getComputedStyle(tip).opacity) <= 0.5) return false
        /* 裁剪检测：自 tip 向上找所有 overflow 非 visible 的祖先，浮层必须完整落在其内（`.dz-sec` 就是 overflow:hidden） */
        const r = tip.getBoundingClientRect()
        let clip = false
        for (let n = tip.parentElement; n && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n)
          if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
          const b = n.getBoundingClientRect()
          if (r.top < b.top - 1 || r.bottom > b.bottom + 1 || r.left < b.left - 1 || r.right > b.right + 1) { clip = true; break }
        }
        const inView = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth
        return !clip && inView
      })
      await page.mouse.move(4, 4)
      await page.waitForTimeout(320) /* 等浮层落回静息态再截图，否则归档图停在半悬停态 */
      return { ok: base.sec && base.chips === 5 && base.calib >= 10 && base.vis === 'hidden' && shown && !base.errPill && base.chipRows === 1, txt: `chip=${base.chips}/5 同排=${base.chipRows === 1 ? '是' : base.chipRows + '行'} 口径表=${base.calib}行 默认藏=${base.vis === 'hidden'} hover现且不被裁=${shown} 错误徽章0不现=${!base.errPill}` }
    }
  },
  {
    id: 'dz-heatmap', name: '年度热力图', hash: '#/', /* W2 V3.8.2：热力图迁调度台 */
    judge: async (page) => page.evaluate(() => {
      const cells = document.querySelectorAll('.dz-cell').length
      const legend = [...document.querySelectorAll('.dz-legend .lv')].map(x => x.textContent.trim())
      const bad = /\bL[0-5]\b/.test(document.querySelector('.dz-legend')?.textContent || '')
      const sum = document.querySelectorAll('.dz-sum .c').length
            const tops = [...document.querySelectorAll('.dz-mb-h')].map(h => Math.round(h.getBoundingClientRect().top))
      const oneRow = tops.length === 12 && new Set(tops).size === 1
      const overflow = Math.round(document.documentElement.scrollWidth - window.innerWidth)
      return { ok: cells >= 360 && legend.length === 6 && !bad && sum === 4 && oneRow && overflow <= 1, txt: `格=${cells}(应≥360) 图例=${legend.join('/')} 裸代号=${bad ? '有(红)' : '无'} 摘要卡=${sum}/4 月块同行=${oneRow} 溢出=${overflow}px` }
    })
  },
  {
    id: 'dz-day', name: '日详情', hash: '#/', /* W2 V3.8.2：热力图迁调度台 */
    /* R170 备案的"补等重数一次"口径：慢机日首击可能还没回流到父级 selDay ⇒ 补点另一格，等够再判死（判据不放宽） */
    act: async (page) => { await page.locator('.dz-cell:not([disabled])').first().click().catch(() => {}); await page.waitForTimeout(900); if (!(await page.locator('.dz-day').first().isVisible().catch(() => false))) { await page.locator('.dz-cell:not([disabled])').nth(3).click().catch(() => {}); await page.waitForTimeout(1500) } },
    judge: async (page) => page.evaluate(() => {
      const d = document.querySelector('.dz-day')
      const stats = document.querySelectorAll('.dz-day .dz-stats > .dz-stat').length
      const band = !!document.querySelector('.dz-day .dz-heat-band')
      const tl = !!document.querySelector('.dz-day .dz-tl')
      return { ok: !!d && stats >= 4 && band && tl, txt: `日详情=${!!d} 四格统计=${stats}(应≥4) 热力带=${band ? '有' : '无'} 时间线=${tl ? '有' : '无'}` }
    })
  },
  {
    id: 'dz-drill', name: '下钻卡片列表',
    act: async (page) => { await page.locator('.dz-kpi').first().click().catch(() => {}); await page.waitForTimeout(700) },
    judge: async (page) => page.evaluate(() => {
      const h = document.querySelector('.dz-drill-h')
      const rows = document.querySelectorAll('.dz-drill .dz-row').length
      const empty = !!document.querySelector('.dz-drill-empty')
      const txt = h ? h.textContent.replace(/\s+/g, '') : ''
      return { ok: !!h && (/类卡片/.test(txt) || /共.*条记录/.test(txt) || empty), txt: `表头=${txt.slice(0, 26) || '无'} 行=${rows} 空态=${empty ? '有' : '无'}` }
    })
  },
  {
    id: 'dz-review', name: '复盘两栏',
    judge: async (page) => page.evaluate(() => {
      const g = document.querySelector('.dz-rev-grid')
      const cols = g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0
      const kpi = document.querySelectorAll('.dz-kpi').length
      const rules = document.querySelectorAll('.dz-rule, .dz-rule.ok').length
      const tabs = document.querySelectorAll('.dz-tabs button').length
      return { ok: cols === 2 && kpi >= 6 && rules >= 1 && tabs === 4, txt: `实测列=${cols}(应2) KPI=${kpi} 规则=${rules} 范围=${tabs}/4` }
    })
  },
  {
    id: 'dz-report', name: 'AI文本报告',
    /* ★R2-② 备案：本报告的数据源=zy_daily_stats 快照，而快照只在「saveData 后 45s 时间闸」或「页卸载补写」时重建——
       播种的备份数据会在早期某次整库保存时被 flushCardEvents diff 成 create 事件、经时间闸落进快照。
       本文件任何位置（含 deck 探针）**不得在 dz-report 之前 page.reload**：reload 会连同 pending 定时器一起死掉，
       快照断源，报告退化成「本期没有任何动作记录」零态（2026-09-29 实测断过一次）。 */
    act: async (page) => { await page.locator('button:has-text("AI 复盘")').first().click().catch(() => {}); await page.waitForTimeout(1500) },
    judge: async (page) => page.evaluate(() => {
      const r = document.querySelector('.dz-rpt')
      const h3 = [...document.querySelectorAll('.dz-rpt h3')].map(x => x.textContent.trim())
      const lead = document.querySelector('.dz-rpt .lead')?.textContent.replace(/\s+/g, '') || ''
      const rels = [...document.querySelectorAll('.dz-rpt .arg .rel')].map(x => (x.textContent.match(/「([^」]+)」/) || [])[1]).filter(Boolean)
      const miss = rels.filter(c => !lead.includes(c))
      const shape = /polygon|clip-path/.test(r ? r.innerHTML : '')
      return { ok: !!r && JSON.stringify(h3) === JSON.stringify(['结论', '支撑论据', '洞察', '建议（按优先级）']) && rels.length === 3 && miss.length === 0 && !shape, txt: `四段=${h3.join('/') || '无'} 主张=${rels.join('/')} 断链=${miss.join('/') || '0'} 图形=${shape ? '有(红)' : '无'}` }
    })
  },
  {
    id: 'dz-entry', name: '调度台复盘入口', hash: '#/',
    judge: async (page) => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /复盘/.test(x.textContent))
      return { ok: !!b && !document.querySelector('.dz-rpt'), txt: `入口=${b ? b.textContent.trim().replace(/\s+/g, '') : '无'} 报告未开=${!document.querySelector('.dz-rpt') ? '是' : '否'}` }
    })
  },
  /* ★W9 退役重指带备案：原 R3-F38「dz-hl 交互点高亮」场景随开关退役删除——量的是「圈出数 == 面板内
     全部可点元素数」，而开关本身（GS 页头工具条按钮 + UIPrefs.dzHl + 面板根 dz-hl 类 + dashboard.css
     两条规则）已整体清账，留着这一屏会让每次走查都红一次「开关=否」。想复活：先把开关写回
     ProfileInsights 页头工具条，再把这一屏抄回来（圈出数 == 交互点数的硬核判据一字不减）。 */
  {
    /* R4-Da：标签管理双栏是「删一整页」最容易伤到的存活页面——它的样式原先和全景样式同批删除，
       右列卡片还直接借用了全景类名。文本断言只看规则在不在文件里，看不见规则有没有作用到盒子上，
       所以这一屏拍的是**量出来的版式**：① .tt-wrap 实测两列（掉了 CSS 就退化成单列流），
       ② 点中的标签行底色真的变了（.gs-tt-row.active 那条规则在生效）。两条都可失败，不空转。 */
    id: 'st-tags', name: '标签双栏版式', hash: '#/settings?page=tags',
    act: async (page) => {
      /* 点第一枚「有名字的」标签行：data-depth 才是真行（首枚可能是就地新建输入行），
         点完等一拍——Vue 的 class 绑定在下一个 tick 才落 DOM（E2E-29 同一条时序坑） */
      await page.locator('.gs-tt-row[data-depth]').first().click().catch(() => {})
      await page.waitForTimeout(900)
    },
    judge: async (page) => page.evaluate(() => {
      const w = document.querySelector('.tt-wrap')
      const cols = w ? getComputedStyle(w).gridTemplateColumns.trim().split(/\s+/).length : 0
      const rows = [...document.querySelectorAll('.gs-tt-row[data-depth]')]
      const active = document.querySelector('.gs-tt-row.active')
      const plain = rows.find(r => !r.classList.contains('active'))
      const bgA = active ? getComputedStyle(active).backgroundColor : ''
      const bgP = plain ? getComputedStyle(plain).backgroundColor : ''
      const card = document.querySelector('.tt-card')
      const radius = card ? getComputedStyle(card).borderTopLeftRadius : ''
      const pad = card ? getComputedStyle(card).paddingTop : ''
      return { ok: cols === 2 && rows.length > 0 && !!active && !!plain && bgA !== bgP,
        txt: `列=${cols} 标签行=${rows.length} 选中=${!!active} 底色变=${bgA !== bgP} 右列卡=${card ? `圆角${radius}/内边距${pad}` : '无'}` }
    })
  },
  {
    /* R4-Dd：⇄ Airtable 同步面板从未进过视觉审计。这一屏要看的不是好看，是两件安全/可用事实：
       ① 标签列那一行真的渲染出来了（本轮新加的控件）；② PAT 输入框仍是 password 型——
       凭据以明文出现在输入框里是这一屏最坏的失效，而它在源码文本断言里表现为「什么都没变」。 */
    id: 'st-airtable', name: 'Airtable 面板', hash: '#/settings?page=airtable',
    judge: async (page) => page.evaluate(() => {
      const rows = [...document.querySelectorAll('.gs-setting-row')]
      const tagRow = rows.find(r => (r.textContent || '').includes('标签列名'))
      const pat = rows.find(r => (r.textContent || '').includes('Personal Access Token'))?.querySelector('input')
      const syncBtn = rows.some(r => (r.textContent || '').includes('立即同步'))
      /* ★同类输入框必须看起来是同一个东西：这一屏的输入框原先靠一个**全站没有定义**的
         .gs-input 类名撑着（和 .gs-panel 一样是死类名），实际观感来自别处的选择器——
         新加一行时最容易"功能对、长得不对"，而文本断言看不见。按计算样式核同一性。
         ★R4-Dh 补第二条判据，它当场抓到了那条死类名的代价：四主题下这排输入框全是
         浏览器默认白底（rgb(255,255,255) + 黑字 + 2px 灰框），在 linear/raycast 两个深色主题里是白块，
         其中一枚是 PAT 凭据框。核法＝输入框底色必须等于所在卡片的底色（两者同取 var(--surface)），
         这样浅色主题不会被误判，而"没走主题 token"一定红。 */
      const ins = [...document.querySelectorAll('.gs-setting-row input[type="text"], .gs-setting-row input:not([type]), .gs-setting-row input[type="password"]')]
      const bgs = Array.from(new Set(ins.map(i => getComputedStyle(i).backgroundColor)))
      const cardBg = getComputedStyle(document.querySelector('.gs-card')).backgroundColor
      const offToken = ins.filter(i => getComputedStyle(i).backgroundColor !== cardBg)
      return { ok: !!tagRow && !!pat && pat.getAttribute('type') === 'password' && syncBtn
          && bgs.length === 1 && offToken.length === 0,
        txt: `标签列行=${!!tagRow} PAT型=${pat ? pat.getAttribute('type') : '无'} 同步钮=${syncBtn} 输入框底色=${bgs.length}种/${ins.length}枚 与卡同色=${offToken.length === 0}(卡=${cardBg})` }
    })
  },
  {
    /* R4-Df：手册页从来没有过活体门禁——它只被 read() 字符串断言管着，
       于是「章节数对不上、目录点了不跳、正文里 <b> 被当字面量印出来」这类失效全都看不见。
       这一屏量三件：① 目录条目数 == 正文 section 数（少一节就是渲染断了）；
       ② 点目录真的把 active 挪过去（只允许一枚选中）；③ 正文不许漏出未渲染的 HTML 字面量。 */
    id: 'st-manual', name: '使用手册', hash: '#/manual',
    act: async (page) => {
      await page.locator('.mn-item').nth(4).click().catch(() => {})
      await page.waitForTimeout(700)
    },
    judge: async (page) => page.evaluate(() => {
      const toc = [...document.querySelectorAll('.mn-item')]
      const secs = [...document.querySelectorAll('section[id^="mn-"]')]
      const active = toc.filter(t => (t.className || '').includes('active')).length
      const body = secs.map(x => x.textContent || '').join('')
      const leaked = /<\/(?:b|strong|kbd|code)>/.test(body)
      return { ok: toc.length >= 20 && secs.length === toc.length && active === 1 && !leaked,
        txt: `目录=${toc.length} 节=${secs.length} 选中=${active} 漏标签=${leaked}` }
    })
  },
  {
    /* R4-Dl：⌘K 检索面板进视觉门禁。此前这条链在 theme-audit 与 e2e 里都是零触点（R4-Pa 补了 E2E-37、
       R4-Dk 补了 E2E-38 的运行时判据，但**像素层仍然没人看**——纯样式/版式改动只靠源码文本断言，
       而"面板真开、高亮真渲染、hover 才露出的那排钮真能露"这三件事在源码里都表现为什么都没变。
       词面故意从当前结果流第一行取：写死词会随用户库内容变化而搜不到，那一屏就退化成空态图。 */
    id: 'gp-search', name: '⌘K 检索面板', hash: '#/',
    act: async (page) => {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.icon-btn')].find(e => (e.getAttribute('title') || '').includes('全局搜索'))
        if (!document.querySelector('.gp-overlay.open') && btn) btn.click()
      })
      await page.waitForTimeout(900)
      const word = await page.evaluate(() => {
        const t = document.querySelector('.gp-result-item .gp-ri-title')
        return t ? (t.textContent || '').trim().slice(0, 2) : ''
      })
      if (word) { await page.locator('.gp-search-input').fill(word); await page.waitForTimeout(800) }
      /* hover 判据必须在 resetView 把鼠标挪走**之前**测完——那排动作钮就是靠 hover 露出的 */
      await page.locator('.gp-result-item').first().hover().catch(() => {})
      await page.waitForTimeout(350)
      await page.evaluate(() => {
        const row = document.querySelector('.gp-result-item')
        const acts = row ? row.querySelector('.gp-ri-actions') : null
        const vis = acts ? [...acts.querySelectorAll('button, .convert')].filter(b => {
          const r = b.getBoundingClientRect()
          return r.width > 4 && r.height > 4
        }).length : 0
        window.__gpHover = { acts: !!acts, vis }
      })
    },
    judge: async (page) => page.evaluate(() => {
      const ov = document.querySelector('.gp-overlay.open')
      const panel = document.querySelector('.gp-panel')
      const input = document.querySelector('.gp-search-input')
      const pr = panel ? panel.getBoundingClientRect() : null
      const op = ov ? Number(getComputedStyle(ov).opacity) : 0
      const marks = [...document.querySelectorAll('mark.gp-hl')]
      const panelBg = panel ? getComputedStyle(panel).backgroundColor : ''
      const markBg = marks.length ? getComputedStyle(marks[0]).backgroundColor : ''
      const inputBg = input ? getComputedStyle(input).backgroundColor : ''
      const rows = document.querySelectorAll('.gp-result-item').length
      const groups = document.querySelectorAll('.gp-group-title').length
      const tabs = document.querySelectorAll('.gp-type-tab').length
      const hover = window.__gpHover || { acts: false, vis: 0 }
      const overflow = pr ? (pr.right > window.innerWidth + 1 || pr.left < -1) : true
      /* ★面板必须压在页面之上且不越视口；输入框不许是浏览器白底（R4-Dh 在设置页抓到过同一类失效） */
      const ok = !!ov && op > 0.9 && !!panel && !!pr && pr.width > 320 && !overflow &&
        rows > 0 && groups >= 1 && tabs >= 6 && marks.length > 0 && markBg !== panelBg &&
        [ 'rgba(0, 0, 0, 0)', panelBg ].includes(inputBg) && hover.acts && hover.vis >= 3
      return { ok, txt: `开=${!!ov}/opacity${op.toFixed(2)} 宽=${panel ? Math.round(pr.width) : 0} 越视口=${overflow} 行=${rows} 组=${groups} tab=${tabs} 高亮=${marks.length} 高亮底色≠卡底=${markBg !== panelBg && !!markBg} 输入框底色=${inputBg === 'rgba(0, 0, 0, 0)' ? '透明(随面板)' : inputBg} hover露钮=${hover.vis}` }
    })
  }
]

/** 浮层是否还挂着（两代壳都认：R161 起的中央弹窗 `.md-panel` + V3.2.1 及以前的右侧抽屉 `.drawer`）。 */
async function overlayOpen(page) {
  return await page.locator('.md-panel, .drawer, .gp-overlay.open').first().isVisible().catch(() => false)
}
/**
 * R4-En：两个 content 浮层进视觉门禁（#115）。
 * 为什么必须补（★写于 R4-En 当时）：那时采集面板与网页 ⌘K 浮层在 theme-audit 与 e2e 里**都是零触点**
 * （grep e2e.cjs 的 `__zy_cap_*` = 0 条，grep 本脚本的浮层场景 = 0 条）。
 * ★R4-Ew 已把 e2e 侧那半边补上（E2E-40 真点保存核落库、E2E-41 结果行动作区、E2E-42 下钻抽屉）；
 *   本脚本这半边只负责"拍下来"，"点了会不会写库"归 e2e——两把尺子各管一段，别互相顶。
 * 而 R4-Dm 刚在采集下拉里量出一枚本该不可达的退役台面——"资源台"三个字印在选项里且是默认项，
 * 这种形状在源码文本断言里表现为什么都没变。判据里的数都是 2026-10-01 用
 * /tmp/zy_en_probe.cjs 实测出来的（面板 402×521、越界 -10/-189、控件底色 5 枚 1 种、输入框透明随面板）。
 * 浮层注入在宿主页普通 DOM（A4 的 Shadow DOM 隔离仍挂账），主题靠它自己读 `zy_ui_v2` 判一次，
 * 所以这里同时核一件事：**浮层强调色必须与应用内 `--accent` 同值**（两端各写一份映射，早晚会漂）。
 */
const OVERLAY_SCENES = [
  {
    id: 'ov-capture', name: '采集面板', msg: 'zy-open-capture', ready: '#__zy_cap_save__',
    /* ★R4-Ex：取景前把「链接」框钉成常量。噪声源实测在 `overlay-impl.ts:1418`
       （`linkInput.value = location.href`）——宿主页服务用 listen(0) 现取端口，端口号被印进画面，
       于是这四张 `*-ov-capture` 每次跑都不同（R4-Ev 量到 261 px/张，正好压在同构建噪声地板 305 px 之下，
       像素 A/B 因此一直"看不出问题"）。端口该保持现取（写死会撞本机其它服务，见 R4-Ew②），
       所以消噪在取景侧做，不动产品代码。 */
    pin: async (pg) => pg.evaluate(() => {
      const i = document.getElementById('__zy_cap_link__')
      if (i) i.value = 'https://zy-visual-baseline.invalid/doc'
    }),
    judge: async (page, expectAccent) => page.evaluate((exp) => {
      const panel = document.querySelector('.zy-panel')
      const root = document.getElementById('__zy_global_overlay__') || (panel && panel.closest('div[id^="__zy"]')) || document.body
      const toRgb = (v) => { const sp = document.createElement('span'); sp.style.color = v; document.body.appendChild(sp); const c = getComputedStyle(sp).color; sp.remove(); return c }
      if (!panel) return { ok: false, txt: '面板没渲染' }
      const pr = panel.getBoundingClientRect()
      // W4（V3.8.4）：采集「存入」下拉已退役——统一入资源卡池，改静态 .zy-cap-pool 池提示行。
      // 判据翻转：正向钉池提示行在、文本对；负向钉两枚下拉（#__zy_cap_ws__ / #__zy_cap_cat__）不许回流。
      const poolRow = panel.querySelector('.zy-cap-pool')
      const poolText = poolRow ? (poolRow.textContent || '').trim() : ''
      const wsGone = !document.getElementById('__zy_cap_ws__')
      const catGone = !document.getElementById('__zy_cap_cat__')
      const ctrls = [...panel.querySelectorAll('input, select, textarea')]
      const bgs = [...new Set(ctrls.map(c => getComputedStyle(c).backgroundColor))]
      const accent = toRgb((getComputedStyle(root).getPropertyValue('--zy-accent') || '').trim() || '#000')
      const ok = Number(getComputedStyle(panel).opacity) > 0.9 && pr.width > 320 && pr.right <= window.innerWidth + 1 && pr.left >= 0
        && !!poolRow && poolText.includes('资源卡池')
        && wsGone && catGone && bgs.length === 1
        && !!document.getElementById('__zy_cap_save__') && accent === exp
      return { ok, txt: `宽=${Math.round(pr.width)} 越界=${Math.round(pr.right - window.innerWidth)}px 池行=${poolRow ? '有' : '无'} 池文本=${JSON.stringify(poolText.slice(0, 40))} 台下拉已删=${wsGone} 分类下拉已删=${catGone} 控件底色=${bgs.length}种/${bgs[0] || '无'} 浮层accent==应用accent=${accent === exp}(${accent})` }
    }, expectAccent)
  },
  {
    id: 'ov-search', name: '网页 ⌘K 浮层', msg: 'zy-open-search', ready: '#__zy_si__',
    act: async (page, needle) => {
      await page.locator('#__zy_si__').fill(needle)
      await page.waitForTimeout(900)
    },
    judge: async (page, expectAccent) => page.evaluate((exp) => {
      const inp = document.getElementById('__zy_si__')
      const panel = inp && inp.closest('.zy-panel')
      if (!panel) return { ok: false, txt: '浮层面板没找到' }
      const pr = panel.getBoundingClientRect()
      const rows = [...document.querySelectorAll('.zy-result-item')]
      const mark = document.querySelector('.zy-hl, mark')
      const toRgb = (v) => { const sp = document.createElement('span'); sp.style.color = v; document.body.appendChild(sp); const c = getComputedStyle(sp).color; sp.remove(); return c }
      const root = document.getElementById('__zy_global_overlay__') || panel.closest('div[id^="__zy"]') || document.body
      const accent = toRgb((getComputedStyle(root).getPropertyValue('--zy-accent') || '').trim() || '#000')
      const inputBg = getComputedStyle(inp).backgroundColor
      const ok = pr.width > 320 && pr.right <= window.innerWidth + 1 && rows.length >= 1
        && !!mark && (inputBg === 'rgba(0, 0, 0, 0)' || inputBg === getComputedStyle(panel).backgroundColor) && accent === exp
      return { ok, txt: `宽=${Math.round(pr.width)} 越界=${Math.round(pr.right - window.innerWidth)}px 行=${rows.length} 高亮=${!!mark} 输入框底色=${inputBg === 'rgba(0, 0, 0, 0)' ? '透明(随面板)' : inputBg} 首行=${rows[0] ? JSON.stringify((rows[0].textContent || '').trim().slice(0, 18)) : '无'} accent一致=${accent === exp}` }
    }, expectAccent)
  }
]

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
    else {
      await page.locator('.md-close, .drawer-close').first().click().catch(() => {})
      /* R4-Dl：⌘K 浮层没有关闭钮，靠 Esc 或点遮罩空白（`.gp-overlay` 的 @click.self）——
         点面板中心会命中结果行并打开详情，所以点遮罩盒子左上角 */
      await page.locator('.gp-overlay.open').click({ position: { x: 6, y: 6 } }).catch(() => {})
    }
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
  /* ★R4-Ff 修 #127（找了一整轮的那 1px）：`scrollTo(0, 0)` 之后**窗口可以停在 0.5px 上没落定**，
     于是整页内容 y=47.5 而不是 48 —— 截图就差出「y=58 以下整体挪 1px、93,152 变化像素」。
     定位靠的是 R4-Fe 的 scene-state：四份全量跑两两成对判，凡是红的那几对都写着
     `DOM 态：不一致 ⇒ scrollY 0.5→0 ｜ mn-head{y:47.5} → {y:48}`，一次就点到；
     产品 CSS 里没有 scroll-behavior（grep 全站 0 处）⇒ 不是平滑滚动，是滚动落定与截图抢时间。
     处置＝取景侧等它落定：最多补五次、每次 60ms，仍不落定就把残值留在 scene-state 里（红的时候能自证）。 */
  await page.evaluate(async () => {
    const settle = () => {
      window.scrollTo(0, 0)
      const de = document.scrollingElement || document.documentElement
      if (de && de.scrollTop !== 0) de.scrollTop = 0
      return window.scrollY
    }
    for (let i = 0; i < 5; i++) { if (settle() === 0) break; await new Promise(r => setTimeout(r, 60)) }
  }).catch(() => {})
  await page.evaluate((calm) => {
    window.scrollTo(0, 0)
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.scrollTop) el.scrollTop = 0
    }
    /* R4-Dl：关动画/过渡并跑完非循环动画。静照里本来就没有"正在动"这件事，
       留着它只会让两次采样差在随机帧上；hover 露出这类**终态**判据不受影响（transition:none 让终态瞬时生效）。 */
    if (calm && window.__ZY_CALM__ !== true) {
      window.__ZY_CALM__ = true
      const st = document.createElement('style')
      st.id = '__zy_calm__'
      /* ★R4-Fd（#130 同轮量到的第二条噪声轴）：连光标也钉掉。实测 notion-ov-search 在同构建两跑之间
         差 62 px、**差异带高只有 1 行**、单通道最大差 30、包围盒 422,186–483,186 —— 那是搜索框光标在闪，
         截图赶上了"亮"与"灭"两个相位。光标闪烁不是 CSS animation（calm 管不到它），但静照里同样
         不存在"正在闪"这件事，与关动画是同一类：取景侧钉掉，产品一行没动。
         两类噪声轴的分界见 img-diff 的 --why：幅度 ≤12 且色偏在一侧＝渲染模式差（--disable-lcd-text），
         幅度 ≥30 且只有一两行＝瞬时态差（这条 caret）。 */
      st.textContent = '*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}'
      document.head.appendChild(st)
    }
    try { for (const a of (document.getAnimations ? document.getAnimations() : [])) { try { a.finish() } catch (e) {} } } catch (e) {}
  }, CALM).catch(() => {})
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
    /* ★R4-Ex 试过又撤掉的一条路（记录免得重走）：给 chromium 加
       --disable-skia-runtime-opts / --disable-partial-raster / --disable-gpu-shader-disk-cache，
       想消掉边线带的取色抖动。实测**没消掉**（连采仍每次有 3–7 张在 1–5 行高的边线上差 3–20 px），
       反而让 raycast-st-manual 整页差 98,518 px（包围盒 0,58–1439,899）——一次改动没带来确定性，
       只带来新的不确定。⇒ 抖动改由 img-diff 的"变化像素 / 抖动像素"二分来判，见该脚本。 */
    /* ★R4-Fe 撤掉 R4-Fd 加的一条旗标（**我自己的归因错了一次，记在这里免得再走**）：R4-Fd 量到池卡列表
       同构建两跑差 368 px、色偏只在一侧，判成"LCD 子像素 vs 灰度"，于是加 `--disable-lcd-text` 钉灰度，
       当时拿"钉完两跑 0 差"当证据。★但那是**单主题连采**（--only=notion）——R4-Fd 自己又量过：
       单主题跑与全量跑不可互比（会话顺序影响画面）。R4-Fe 用**全量两跑**复测：加了旗标之后
       `notion-deck-pool-list` 仍然差 368 px、色偏仍然只在一侧（A=0 B=376），而 96 张主页面场景的
       DOM 几何与计算样式**逐点全同** ⇒ 这一族不在文字 AA 模式上，是**光栅层的非确定性**，
       这条旗标管不到它 ⇒ 撤。与 R4-Ex 那三条的区别现在清楚了：那三条改不了，这一条也改不了，
       区别只在我这次误以为改得了。 */
    args: [`--disable-extensions-except=${pkg}`, `--load-extension=${pkg}`, `--hide-scrollbars`]
  })

  let [worker] = ctx.serviceWorkers()
  if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 })
  const extId = new URL(worker.url()).host
  const base = `chrome-extension://${extId}/${EXT_INDEX}`
  /* R4-Dl：冻结 Date（只冻无参构造与 Date.now，带参的 new Date(x) 原样透传）。
     性能计时不受影响——本脚本不测时间，只测像素。 */
  if (FREEZE) await ctx.addInitScript((ms) => {
    const Real = Date
    const F = class FrozenDate extends Real {
      constructor(...a) { if (a.length === 0) super(ms); else super(...a) }
      static now() { return ms }
    }
    window.Date = F
  }, FREEZE_AT)

  /* R4-En：content 浮层注入在 http/https 页，扩展页里没有它的宿主 —— 与 perf 的 M5 同一手法 */
  const http = require('http')
  const ovServer = http.createServer((rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    rs.end('<!doctype html><title>知源浮层走查宿主页</title><h1>浮层走查宿主页</h1><p>这一段文字用来确认浮层是注入在本页而不是扩展页。</p>')
  })
  await new Promise(r => ovServer.listen(0, '127.0.0.1', r))
  const ovPort = ovServer.address().port
  const ovUrl = `http://127.0.0.1:${ovPort}/`
  let ovPage = null

  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)

  /* R4-Et 类名普查：包一层 screenshot，每拍一张就把当时 DOM 里所有 class token 记账（主页面与浮层页都包）。
     为什么要它：孤儿 CSS 的静态扫描会误杀（Transition 生成的类、数据修饰类、v-html 里的类），
     R4-Dj 那次就因为"没有活证据"一条没删。以后删除要同时满足：静态零引用 + 全部场景截图时刻的 DOM 里查无此类。 */
  const classSeen = new Map()
  const censusOf = async (pg) => {
    try {
      const toks = await pg.evaluate(() => [...document.querySelectorAll('[class]')]
        .flatMap(e => (e.getAttribute('class') || '').split(/\s+/)).filter(Boolean))
      for (const t of toks) classSeen.set(t, (classSeen.get(t) || 0) + 1)
    } catch { /* 采不到不影响截图 */ }
  }
  /* ★R4-Fd/Fe 场景几何记账：给三处已知跳变坐标留下"截图那一刻"的元素链，用来把"同构建两跑差 1px"
     这类跳变**点到具体元素**（#127 手册页 y=58 以下整体下移 1px、#131 设置页标签区 y=859 一条 1 行的线、
     #130 池卡列表胶囊 y≈500——那一条已由 --disable-lcd-text 钉掉，留坐标是为了下次换轴时还有对照）。
     两次 --tag 跑完把两份 scene-state.json 一比即可，不必再靠人眼在 104 张图里找。 */
  /* 四个点各盯一族：(720,58) 手册页那条分界本身、(720,120) **分界下方**——整片挪 1px 只有采下方才看得见
     （只采分界上那一个点会两边同 y，错过 #127 的形态）、(940,859) 设置页标签区那条 1 行的线、
     (280,500) 池卡列表胶囊（光栅层那一族的现场）。 */
  const STATE_PTS = [[720, 58], [720, 120], [940, 859], [280, 500]]
  const sceneState = {}
  const stateOf = async (pg, file) => {
    if (!file) return
    try {
      sceneState[path.basename(file)] = await pg.evaluate((pts) => ({
        scrollY: window.scrollY,
        docH: document.scrollingElement ? document.scrollingElement.scrollHeight : -1,
        pts: pts.map(([x, y]) => ({
          at: `${x},${y}`,
          chain: document.elementsFromPoint(x, y).slice(0, 3).map((e) => {
            const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
            return {
              cls: (e.getAttribute('class') || e.tagName).slice(0, 40),
              y: +r.y.toFixed(2), h: +r.height.toFixed(2),
              bt: cs.borderTopWidth, bb: cs.borderBottomWidth, bbc: cs.borderBottomColor,
              bg: cs.backgroundColor, op: cs.opacity, tr: cs.transform
            }
          })
        }))
      }), STATE_PTS)
    } catch { /* 采不到不影响截图 */ }
  }
  {
    const orig = page.screenshot.bind(page)
    page.screenshot = async (opt) => { const r = await orig(opt); await censusOf(page); await stateOf(page, opt && opt.path); return r }
  }

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

  /* R170 备案：后注入的 zy_ui_v2 到不了**运行中**的 store.ui（R128-A1 的 mergeExternalUIPrefs
     会替换 uiCache 对象，而 store.ui 持有旧引用）⇒ boot 后注入的 wsViewMode 永远读不到，
     真库一旦存在脏 isThesis 卡（curationMetrics 取第一张），资源台就回落「默认金字塔」，
     资源卡详情镜头 .res-card 恒命中 0（v3.6.1 基线同样复现 ⇒ 工具盲区，非产品回退）。
     注入完成后强制整页重载一次，让 boot 重新 loadUIPrefs 读全量偏好；
     R161「reload 丢 hash」的坑用「记下 → 重载 → 写回」闭环（此处 hash 恒为空，防御性保留）。 */
  {
    const keepHash = await page.evaluate(() => location.hash)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.evaluate((h) => { if (location.hash !== h) location.hash = h }, keepHash)
    await page.waitForTimeout(600)
  }

  const shots = []
  /** R161：Esc 若关不掉弹窗，遗留浮层会串场到下一主题的四个台面图（同文档内切 hash 不重载），
   *  24 张图里有 18 张就被一条弹窗盖住了 —— 这正是本轮实测抓到的 Modal.vue 缺陷，故列为硬告警。 */
  const escLeak = []
  const drawerFail = []
  /** R167：AI 评审弹窗的三条新结构（对照区 / 一次性指令条 / 分栏把手）缺一即记账 */
  const modalFail = []
  /** R2-②③：DeckTabs 三张卡 + 槽内子任务视口判据（原 R169-T4 项目调度 spotlight 改靶） */
  const spotFail = []
  const dashFail = []
  const overlayFail = [] /* R4-En：content 浮层两场景 */ /* R172-T13：仪表盘七场景 */
  const treeFail = [] /* R3-B′：完整方向树项目层折叠活体判据 */
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
      let extra = ''
      /* R3-B′/B1：方向台两条镜头共用同一套活体判据——静态断言只证明代码在，不证明渲染对。
         ① 卡头数 == 分支数 == caret 数（每张卡头都有开合把手）
         ② 折叠卡里 **一个指标分支都没有**（v-if 真摘节点，不是 v-show 藏起来）
         ③ 有数据可判（0 张卡头 = 数据没种上，判据空转）
         ④ compass-tree 另判「重定向真的发生了」：hash 必须落到 #/compass（老深链不许变成死页） */
      if (v.id === 'compass' || v.id === 'compass-tree') {
        const j = await page.evaluate(() => {
          const branches = [...document.querySelectorAll('.tree-project-branch')]
          const heads = [...document.querySelectorAll('.tp-head')]
          const folded = heads.filter(h => h.classList.contains('folded'))
          const bad = folded.filter(h => h.parentElement && h.parentElement.querySelector('.tree-metric-branch')).length
          return { branches: branches.length, heads: heads.length, folded: folded.length, carets: document.querySelectorAll('.tp-caret').length, metrics: document.querySelectorAll('.tree-metric-branch').length, bad, hash: location.hash }
        })
        extra = ` 卡头=${j.heads}/${j.branches} caret=${j.carets} 折叠=${j.folded} 指标=${j.metrics}`
        if (!j.heads) treeFail.push(`${theme}/${v.id}：一张项目卡头都没有（数据没种上或视图没渲染）——判据空转`)
        else if (j.bad) treeFail.push(`${theme}/${v.id}：${j.bad} 张折叠项目卡里仍渲染了指标分支 ⇒ 折叠是假折叠`)
        else if (j.carets !== j.heads) treeFail.push(`${theme}/${v.id}：caret ${j.carets} != 卡头 ${j.heads} ⇒ 有卡头没有开合把手`)
        if (v.id === 'compass-tree') {
          extra += ` 落点=${j.hash}`
          if (!/^#\/compass(\?|$)/.test(j.hash)) treeFail.push(`${theme}/${v.id}：#/compass/tree 未重定向到 /compass（实际 ${j.hash}）⇒ 老深链在丢命`)
        }
      }
      console.log(`  ✓ ${theme.padEnd(8)} ${v.name.padEnd(4)} hash=${(hash || '#/').padEnd(26)}${extra} → ${path.basename(file)} (${kb}KB)`)
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
      /* R167：上半部压缩后的两条新结构——一次性指令条（三栏）与可拖分栏把手。
         它们在弹窗里都是"占住下半部"的前提，缺一个就说明上半部又胖回去了。 */
      const dir = await page.locator('.ai-dir').first().isVisible().catch(() => false)
      /* 分栏把手按宽度判：≥1200 双栏必须有把手，≤1199 已降单栏 ⇒ 把手**不该在**
         （单栏还挂一根拖宽把手，是"能拖一个不存在的分界"那种假控件） */
      const wantDrag = m.width >= 1200
      const drag = await page.locator('.ai-drag').first().isVisible().catch(() => false)
      const file = path.join(outDir, `${theme}-${m.id}.png`)
      await page.screenshot({ path: file })
      const kb = Math.round(fs.statSync(file).size / 1024)
      shots.push(file)
      const modalOk = shell && dual && dir && drag === wantDrag
      console.log(`  ${modalOk ? '✓' : '✗'} ${theme.padEnd(8)} ${m.name.padEnd(6)} 壳=${shell ? 'md-panel' : '未开'} 对照区=${dual ? '有' : '无'} 指令条=${dir ? '有' : '无'} 分栏把手=${drag ? '有' : '无'}(应${wantDrag ? '有' : '无'})   → ${path.basename(file)} (${kb}KB)`)
      if (!shell) console.log(`    ⚠ ${theme}/${m.id} 没抓到 .md-panel —— 弹窗未打开，这张图不作数`)
      if (shell && !modalOk) modalFail.push(`${theme}/${m.id}：对照区=${dual} 指令条=${dir} 分栏把手=${drag}（宽 ${m.width} 应为 ${wantDrag}）`)
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
      const n0 = await page.locator(v.card).count().catch(() => 0)
      /* R170 备案：慢机日（冷挂墙钟 ~2.7s）1800ms 等不够懒 chunk+挂载落位 ⇒ 补等重数一次，等够再判死（不放宽判据） */
      let n = n0
      if (!n) { await page.waitForTimeout(2200); n = await page.locator(v.card).count().catch(() => 0) }
      if (!n) {
        drawerFail.push(`${theme}/${v.id}：台面上没有卡片可点（${v.card} 命中 0）——数据没种上或视图没渲染`)
        console.log(`  ✗ ${theme.padEnd(8)} ${v.name} — ${v.card} 命中 0，这张图不作数`)
        continue
      }
      await page.locator(v.card).first().click().catch(() => {})
      await page.waitForTimeout(900) /* 抽屉有进场动效，等它落位再截 */
      await resetView(page)
      const opened = await page.locator(v.open).first().isVisible().catch(() => false)
      /* R166 定案 6 / R167：AI 入口一律**独立成行**，格数按卡种固定（任务 3 / 资源 2 / 好奇 1）
         ⇒ 声明 aiCount 时要求"恰好 N 格"，少一格（合并回单枚钮）或多一格都算不过；未声明的按"≥1 枚"判。 */
      const aiCount = await page.locator(v.ai).count().catch(() => 0)
      const aiInRow = v.aiCount ? aiCount === v.aiCount : aiCount > 0
      /* R167 红线：主标题只准出现在抽屉头一处（正文里那份 .ref-title 已退役，加回来即红） */
      const h1Count = v.h1 ? await page.locator(v.h1).count().catch(() => -1) : 1
      const footCount = await page.locator(v.foot).count().catch(() => -1)
      /* R169-T5b：徽标反相只在"真 hover + 真 accent 底"上才暴露，静态读源码判不了 ——
         在真 DOM 上悬停后读宿主上的 --ai-mark-fill：声明成 #fff 才算"白头 accent 眼"生效。
         （渐变填在 accent 底上会糊成一片，这是本轮最贵的视觉陷阱。） */
      let invertOk = true, invertInfo = ''
      if (v.invert) {
        await page.locator(v.invert).first().hover().catch(() => {})
        await page.waitForTimeout(280)
        const got = await page.evaluate((sel) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const cs = getComputedStyle(el)
          return { fill: cs.getPropertyValue('--ai-mark-fill').trim(), bg: cs.backgroundColor }
        }, v.invert)
        invertOk = !!got && got.fill === '#fff' && !!got.bg && got.bg !== 'rgba(0, 0, 0, 0)'
        invertInfo = ` 反相=${invertOk ? '是' : '否'}(${got ? (got.fill || '未声明') : '无元素'})`
        if (!invertOk) drawerFail.push(`${theme}/${v.id}：hover accent 底未反相（--ai-mark-fill=${got ? got.fill || '未声明' : '无元素'}）⇒ 徽标会糊进底色`)
      }
      const file = path.join(outDir, `${theme}-${v.id}.png`)
      await page.screenshot({ path: file })
      const kb = Math.round(fs.statSync(file).size / 1024)
      shots.push(file)
      const ok = opened && aiInRow && footCount === 2 && h1Count === 1 && invertOk
      console.log(`  ${ok ? '✓' : '✗'} ${theme.padEnd(8)} ${v.name.padEnd(6)} 开=${opened ? '是' : '否'} AI入口行=${aiInRow ? '是' : '否'}(${aiCount}${v.aiCount ? '/' + v.aiCount : ''}) 主标题=${h1Count === 1 ? '一处' : h1Count + ' 处'} 页脚钮=${footCount}${invertInfo}   → ${path.basename(file)} (${kb}KB)`)
      if (!ok && (footCount !== 2 || h1Count !== 1 || !opened || !aiInRow)) drawerFail.push(`${theme}/${v.id}：开=${opened} AI入口行=${aiInRow}(计${aiCount}，应${v.aiCount || '≥1'}) 主标题处数=${h1Count}（应为 1） 页脚钮数=${footCount}（应为 2）`)
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(400)
      await closeOverlays(page)
    }
    // R2-②③ 改靶判据（原 R169-T4 项目调度 spotlight 随调度卡退役）：现场核调度台新主交付面
    //   = DeckTabs 三张卡（资源卡池默认 / 任务调度 / 好奇心培育）+ R2-① 槽内子任务视口（固定 5 行 / 零编辑控件）
    await page.setViewportSize(VIEWPORT)
    await page.goto(base + '#/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    /* ★R2 判据坑两条：① 同 hash 的 goto 不触发 SPA 重载，上一阶段留下的 tab 态会污染默认档判定
       ⇒ 用真实点击复位（第一枚 tab）。② 不可用 page.reload 复位：dailyStats 快照走 saveData 后 45s 时间闸，
       reload 会连同模块内 pending timer 一起死掉，下游 dz-report 的「本期动作」就断了来源。 */
    await page.locator('.bt-tab').first().click().catch(() => {})
    await page.waitForTimeout(500)
    /* ★W1.1 随迁（V3.8.1 三张卡改名改序 + 默认切任务卡）：默认档这一格先钉新形状——
       第一枚 tab 必须激活且文案是「任务卡」。随后**显式点到「资源卡」tab**再量池面板
       （旧口径靠「第一枚=资源卡池默认」顺带量到池面板，改序后那条捷径没了；
        场景要量的是池面板本身，不是它恰好是默认档）。 */
    const dflt = await page.evaluate(() => {
      const first = document.querySelector('.bt-tab')
      return { on: !!first && first.classList.contains('on'), text: (first && first.textContent || '').trim() }
    })
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.bt-tab')].find(x => (x.textContent || '').includes('资源卡'))
      if (b) b.click()
    })
    await page.waitForTimeout(500)
    await resetView(page)
    const spot = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.bt-tab'))
      const poolBtn = tabs.find(x => (x.textContent || '').includes('资源卡'))
      const poolOn = !!poolBtn && poolBtn.classList.contains('on')
      const pane = document.querySelector('.pcp-card, .pcp-empty')
      /* 不靠数据碰运气：无 .tc-subs 时视口判据记「无数据」，DeckTabs 结构判据恒核 */
      const subs = document.querySelector('.today-cards .tc-subs')
      let subInfo = null
      if (subs) {
        const rows = Array.from(subs.querySelectorAll('.tc-sub'))
        const sRect = subs.getBoundingClientRect()
        const visible = rows.filter(r => r.getBoundingClientRect().bottom <= sRect.bottom + 1).length
        subInfo = { rows: rows.length, visible, maxH: Math.round(sRect.height), editors: subs.querySelectorAll('input,textarea,[contenteditable]').length }
      }
      return { tabN: tabs.length, poolOn, paneOn: !!pane, subInfo }
    })
    const spotFile = path.join(outDir, `${theme}-deck.png`)
    await page.screenshot({ path: spotFile })
    shots.push(spotFile)
    const dfltOk = dflt.on && dflt.text.includes('任务卡')
    const spotOk = dfltOk && spot.tabN === 3 && spot.poolOn && spot.paneOn
      && (!spot.subInfo || (spot.subInfo.editors === 0 && spot.subInfo.visible <= 6))
    console.log(`  ${spotOk ? '✓' : '✗'} ${theme.padEnd(8)} ${'deck'.padEnd(4)} tabs=${spot.tabN}/3 默认档=${dfltOk ? '任务卡' : dflt.text.slice(0, 4) + '(非任务卡)'} 池面板=${spot.paneOn ? '有' : '无'} 槽内子任务=${spot.subInfo ? spot.subInfo.visible + '/' + spot.subInfo.rows + '可见·编辑' + spot.subInfo.editors : '无数据'}   → ${path.basename(spotFile)} (${Math.round(fs.statSync(spotFile).size / 1024)}KB)`)
    if (!spotOk) spotFail.push(`${theme}/deck：${JSON.stringify({ ...spot, dflt })}（应：三张卡 + 默认档=任务卡 + 资源卡面板可见 + 槽内视口≤6可见/零编辑控件）`)
    /* R3-Ca：池面板新增的列表视图（四主题各一张）——量完当场切回网格，别把视图态留给后面的场景 */
    await page.evaluate(() => { const b = [...document.querySelectorAll('.dk-row[data-panel="pool"] .dk-view')].find(x => (x.textContent || '').includes('列表')); if (b) b.click() })
    await page.waitForTimeout(700)
    await resetView(page)
    const pl = await page.evaluate(() => {
      const rows = document.querySelectorAll('.pcp-row').length
      const cards = document.querySelectorAll('.pcp-card').length
      const none = document.querySelectorAll('.pcp-tag-none').length
      const untaggedBtn = !!document.querySelector('.dk-row[data-panel="pool"] .dk-pill')
      return { rows, cards, none, untaggedBtn }
    })
    const plFile = path.join(outDir, `${theme}-deck-pool-list.png`)
    await page.screenshot({ path: plFile })
    shots.push(plFile)
    /* 量完当场切回网格再往下走——视图态是组件内的，不切回会串到后面的场景截图里 */
    await page.evaluate(() => { const b = [...document.querySelectorAll('.dk-row[data-panel="pool"] .dk-view')].find(x => (x.textContent || '').includes('网格')); if (b) b.click() })
    await page.waitForTimeout(500)
    const plOk = pl.rows > 0 && pl.cards === 0 && pl.untaggedBtn
    console.log(`  ${plOk ? '✓' : '✗'} ${theme.padEnd(8)} ${'池列表'.padEnd(4)} 行=${pl.rows} 网格残留=${pl.cards} 无标签标=${pl.none} 待打标钮=${pl.untaggedBtn ? '是' : '否'}   → ${path.basename(plFile)} (${Math.round(fs.statSync(plFile).size / 1024)}KB)`)
    if (!plOk) spotFail.push(`${theme}/deck-pool-list：${JSON.stringify(pl)}（应：列表有行、网格零残留、控制行含「待打标」）`)
    /* R3-Cc：三张卡共用的批量栏（DeckBatchBar）——池面板这侧底色由 surface-2 换成 accent-light，
       四主题各拍一张，量「栏在 / 全选·反选·应用标签三枚齐 / 卡型动作在槽内」，量完退出批量免得串染 */
    await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b) b.click() })
    await page.waitForTimeout(700)
    await resetView(page)
    const bb = await page.evaluate(() => {
      const bar = document.querySelector('.dkb-bar')
      const labels = bar ? [...bar.querySelectorAll('button')].map(x => (x.textContent || '').trim()) : []
      return { on: !!bar, hasSel: labels.includes('全选'), hasInv: labels.includes('反选'), hasTag: labels.includes('应用标签'), del: labels.some(x => x.includes('删除')) }
    })
    const bbFile = path.join(outDir, `${theme}-deck-batch.png`)
    await page.screenshot({ path: bbFile })
    shots.push(bbFile)
    await page.evaluate(() => { const b = document.querySelector('.dk-row[data-panel="pool"] .dk-batch'); if (b) b.click() })
    await page.waitForTimeout(400)
    const bbOk = bb.on && bb.hasSel && bb.hasInv && bb.hasTag && bb.del
    console.log(`  ${bbOk ? '✓' : '✗'} ${theme.padEnd(8)} ${'批量栏'.padEnd(4)} 栏=${bb.on ? '是' : '否'} 全选=${bb.hasSel ? '是' : '否'} 反选=${bb.hasInv ? '是' : '否'} 打标=${bb.hasTag ? '是' : '否'} 卡型动作=${bb.del ? '在' : '缺'}   → ${path.basename(bbFile)} (${Math.round(fs.statSync(bbFile).size / 1024)}KB)`)
    if (!bbOk) spotFail.push(`${theme}/deck-batch：${JSON.stringify(bb)}（应：共用栏渲染且 全选/反选/应用标签/卡型动作 齐全）`)
    await closeOverlays(page)
    await page.setViewportSize(VIEWPORT)
    for (const sc of DASH_SCENES) {
      await page.setViewportSize(VIEWPORT)
      await page.goto(base + (sc.hash || '#/profile'), { waitUntil: 'domcontentloaded' }) // ★W9 退役重指带备案：仪表盘/复盘段宿主由 /settings?page=dashboard 迁画像洞察页 /profile
      await page.waitForTimeout(2400)
      if (sc.act) await sc.act(page)
      await resetView(page)
      const info = await sc.judge(page)
      const f = path.join(outDir, `${theme}-${sc.id}.png`)
      await page.screenshot({ path: f })
      shots.push(f)
      console.log(`  ${info.ok ? '✓' : '✗'} ${theme.padEnd(8)} ${sc.name.padEnd(6)} ${info.txt}   → ${path.basename(f)} (${Math.round(fs.statSync(f).size / 1024)}KB)`)
      if (!info.ok) dashFail.push(`${theme}/${sc.id}：${info.txt}`)
      await closeOverlays(page)
    }
    /* ===== R4-En：content 浮层两场景（采集面板 / 网页 ⌘K）===== */
    // 浮层自己读 zy_ui_v2 判主题（普通 DOM，不共享扩展页的 data-theme），故上面刚写回的 storage 主题对它生效。
    let appAccent = ''
    try {
      appAccent = await page.evaluate(() => {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
        const sp = document.createElement('span'); sp.style.color = v; document.body.appendChild(sp)
        const c = getComputedStyle(sp).color; sp.remove(); return c
      })
    } catch (e) { /* 取不到就走判据红 */ }
    // 检索词面从注入的真实库里取一张卡的标题前 4 字（写死词会随库变化而搜不到 ⇒ 空态图 + 判据仍绿）
    const ovNeedle = ((data.resources || []).find(r => r && r.title) || {}).title
    const needle = String(ovNeedle || '资源').replace(/\s+/g, '').slice(0, 4)
    for (const sc of OVERLAY_SCENES) {
      if (!ovPage) { ovPage = await ctx.newPage(); ovPage.setDefaultTimeout(20000) }
      await ovPage.goto(ovUrl, { waitUntil: 'load' })
      await ovPage.waitForTimeout(1400)   // content script 注入 + 读 storage
    {
      const os = ovPage.screenshot.bind(ovPage)
      /* ★R4-Fe：浮层页也要记 DOM 态。R4-Fd 的 scene-state 只包在主页面截图上（104 张里只覆盖 96 张），
         于是 apple-ov-search 那条 1 行、幅度 30 的差**没有活证据可查**——正是"证据面比断言窄"的老形状。 */
      ovPage.screenshot = async (opt) => { const r = await os(opt); await censusOf(ovPage); await stateOf(ovPage, opt && opt.path); return r }
    }
      let ready = false
      let opened = true
      try {
        await worker.evaluate(async ({ p, t }) => {
          const tabs = await chrome.tabs.query({ url: `http://127.0.0.1:${p}/*` })
          if (!tabs[0]) throw new Error('宿主页 tab 未找到')
          await chrome.tabs.sendMessage(tabs[0].id, { type: t })
        }, { p: ovPort, t: sc.msg })
        ready = !!(await ovPage.waitForSelector(sc.ready, { timeout: 8000 }).catch(() => null))
      } catch (e) { opened = false; overlayFail.push(`${theme}/${sc.id}：唤起消息失败 ${e.message}`) }
      if (ready && sc.act) await sc.act(ovPage, needle)
      if (ready && sc.pin) await sc.pin(ovPage)
      if (ready) await resetView(ovPage)
      const info = ready ? await sc.judge(ovPage, appAccent) : { ok: false, txt: opened ? '浮层没开（等不到就绪选择器）' : '唤起失败' }
      const f = path.join(outDir, `${theme}-${sc.id}.png`)
      await ovPage.screenshot({ path: f })
      shots.push(f)
      console.log(`  ${info.ok ? '✓' : '✗'} ${theme.padEnd(8)} ${sc.name.padEnd(9)} ${info.txt}   → ${path.basename(f)} (${Math.round(fs.statSync(f).size / 1024)}KB)`)
      if (!info.ok) overlayFail.push(`${theme}/${sc.id}：${info.txt}`)
      await ovPage.keyboard.press('Escape').catch(() => {})
      await ovPage.waitForTimeout(300)
    }

    console.log(`  主题 ${theme} 落盘（data-theme=${okTheme}）`)
  }

  await page.evaluate(async () => { await chrome.storage.local.remove(['zy_ai_v1']) }).catch(() => {})
  await ctx.close()
  fs.writeFileSync(path.join(outDir, 'class-census.json'), JSON.stringify({
    生成: new Date().toISOString(), 场景数: shots.length, token数: classSeen.size,
    计数: Object.fromEntries([...classSeen.entries()].sort())
  }, null, 1))
  console.log(`类名普查：${classSeen.size} 个 class token → ${path.join(outDir, 'class-census.json')}`)
  fs.writeFileSync(path.join(outDir, 'scene-state.json'), JSON.stringify({ 生成: new Date().toISOString(), 场景数: Object.keys(sceneState).length, 取样点: STATE_PTS, 状态: sceneState }, null, 1))
  console.log(`场景几何记账：${Object.keys(sceneState).length} 张图的 ${STATE_PTS.length} 个取样点 → ${path.join(outDir, 'scene-state.json')}`)
  console.log(`\ntheme-audit 完成：${shots.length} 图 → ${outDir}`)
  const want = themes.length * (VIEWS.length + MODAL_VIEWS.length + DRAWER_VIEWS.length  + 3 /* R2-②③ DeckTabs deck 判据 + R3-Ca 池列表视图 + R3-Cc 共用批量栏 */ + DASH_SCENES.length + OVERLAY_SCENES.length /* R4-En content 浮层 2 场景 ⇒ 96→104；R172-T13 仪表盘七场景 + R3-B′ 方向台台面 ⇒ 68→72；R3-Ca 池列表 + R3-Cc 批量栏 ⇒ 72→80；R4-Da 标签双栏 ⇒ 80→84；R4-Dd Airtable 面板 ⇒ 84→88；R4-Df 使用手册 ⇒ 88→92；R4-Dl ⌘K 检索面板 ⇒ 92→96 */)
  if (shots.length !== want) { console.log(`❌ 图数 ${shots.length} ≠ 应有 ${want}（${themes.length} 主题 × (${VIEWS.length} 台面 + ${MODAL_VIEWS.length} 弹窗 + ${DRAWER_VIEWS.length} 卡详情 + 1 deck)）`); process.exit(1) }
  if (escLeak.length) {
    console.log(`❌ Esc 未能关闭中央弹窗：${escLeak.join(' / ')}（台面图已受影响，请查 Modal.vue 的 watch immediate）`)
    process.exit(1)
  }
  if (modalFail.length) {
    console.log(`❌ AI 评审弹窗判据未过 ${modalFail.length} 项：\n  ` + modalFail.join('\n  '))
    process.exit(1)
  }
  if (drawerFail.length) {
    console.log(`❌ 卡详情抽屉判据未过 ${drawerFail.length} 项：\n  ` + drawerFail.join('\n  '))
    process.exit(1)
  }
  if (treeFail.length) {
    console.log(`❌ 方向树折叠判据未过 ${treeFail.length} 项：\n  ` + treeFail.join('\n  '))
    process.exit(1)
  }
  if (dashFail.length) {
    console.log(`❌ 仪表盘场景判据未过 ${dashFail.length} 项：\n  ` + dashFail.join('\n  '))
    process.exit(1)
  }
  if (overlayFail.length) {
    console.log(`❌ content 浮层判据未过 ${overlayFail.length} 项：\n  ` + overlayFail.join('\n  '))
    process.exit(1)
  }
  await ovServer.close()
  if (spotFail.length) {
    console.log(`❌ DeckTabs/deck 判据未过 ${spotFail.length} 项：\n  ` + spotFail.join('\n  '))
    process.exit(1)
  }
}
main().catch(e => { console.error('theme-audit 失败：', e); process.exit(2) })
