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
  // ★B3（V3.8.28）补：画像洞察是一级页面却一直不在 VIEWS 里 —— 只在 MODAL_VIEWS 里以「下钻/复盘/报告」
  //   浮层形式出现，于是**页面本身的四主题走查从来没有证据**。A2 那批改的是 KPI 数值与环比徽标的颜色，
  //   正好落在这个盲区里；补进来后 `--scenes=profile` 可单独取。
  { id: 'profile', hash: '#/profile', name: '画像洞察' },
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
/**
 * 打开画像页的周/月复盘弹窗（★W12 新增）。
 * 入口有两个，任选其一即可：PiHero 的「✦ AI 解读」与 PiRhythm 的「📈 周/月复盘」，
 * 两者在 ProfileInsights 里都 emit 到同一个 `openReview`（`.pi-rev-overlay` + `.pi-rev-modal`）。
 * 这里按 title 定位「✦ AI 解读」（PiHero 上有 title="AI 生成画像解读（进入复盘弹窗）"），
 * 不用按钮文案 —— 文案会随版本改，title 也在改，但两者都属文案层；真正的稳定锚是
 * 「点了之后 `.pi-rev-modal` 可见」，所以下面判空一次可见性才算开成功（开失败不静默，
 * 让后续 judge 如实报红）。
 */
async function openReviewModal(page) {
  await page.locator('.pi-btn[title*="AI"]').first().click({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(700)
  if (!(await page.locator('.pi-rev-modal').first().isVisible().catch(() => false))) {
    await page.locator('.pi-btn:has-text("周/月复盘")').first().click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(700)
  }
}

const DASH_SCENES = [
  {
    id: 'dz-overview', name: '页头 KPI 带',
    /* ★W12(V3.8.12)随迁备案：原判据守的是 DashboardOverview 的「概览带」——`.dz-ov` 容器 + 五枚
       `.dz-chip` + `.dz-calib` 口径表 + 说明默认藏/悬停才现。而 DashboardOverview.vue 已随 W10 三段式
       时间轴重构整体退役（本轮实测 `components/dashboard/` 下确无该文件），职责落到 PiHero：
       五枚 `.pi-hchip` 就是那五枚 chip，每枚的 `title` 就是那格口径。
       —— 换的是承重锚（宿主文件换了），守的仍是同一批行为：① 五枚 ② 同排一行（R173-5 原意：
       删掉人话块后 meta 行抢整行会把 chip 挤成竖排）③ 每枚必须带口径说明（原 .dz-calib 口径表的
       承载物，如今是 title）④ 出错时不得冒错误徽章（原 .dz-ov-err）。
       「说明默认藏/悬停才现」一条随组件退役删去：PiHero 用原生 title，不自建浮层，
       原 R173-5 的裁剪检测（防 .dz-sec overflow:hidden 裁掉浮层）在无自建浮层后无处施放。
       口径表 `.dz-calib` 在 dashboard.css 里仍有 7 条规则，但已无任何模板挂载点 ⇒ 随判据一并退役。 */
    judge: async (page) => {
      const base = await page.evaluate(() => {
        const chips = [...document.querySelectorAll('.pi-hero-sum .pi-hchip')]
        const rows = new Set(chips.map(c => Math.round(c.getBoundingClientRect().top))).size
        const titled = chips.filter(c => (c.getAttribute('title') || '').trim().length > 0).length
        const errPill = !!document.querySelector('.pi-btn[style*="warning"]')
        return { sec: !!document.querySelector('.pi-hero-sum'), n: chips.length, rows, titled, errPill }
      })
      return {
        ok: base.sec && base.n === 5 && base.rows === 1 && base.titled === 5 && !base.errPill,
        txt: `chip=${base.n}/5 同排=${base.rows === 1 ? '是' : base.rows + '行'} 带口径=${base.titled}/5 错误徽章0不现=${!base.errPill}`
      }
    }
  },
  {
    id: 'dz-heatmap', name: '年度热力图', hash: '#/', /* W2 V3.8.2：热力图迁调度台 */
    /* ★W12(V3.8.12)随迁备案：图例判据原写死 `legend.length === 6`，而 V3.8.7「补丁三」给图例
       加了第 7 枚「今天」说明项（Heatmap.vue:272，class `.lv today-key`，用 ::before 画 accent 描边块，
       因为当日格的底色是 heat-N 而不是固定色）。判据自那版起就一直红着（实测 7 项），
       是「判据写死数量」这类漂移的又一份样本 ⇒ 改成钉**前六项严格等于 LV_NAME 六档**，
       第七项单独钉必须是「今天」——这样既守住六档语义，又守住「当日格高亮有说明」，
       将来真少一档或改名都会红，而多出一枚无关项也会红。 */
    judge: async (page) => page.evaluate(() => {
      const cells = document.querySelectorAll('.dz-cell').length
      const legend = [...document.querySelectorAll('.dz-legend .lv')].map(x => x.textContent.trim())
      const SIX = ['静默', '轻触', '常规', '高负荷', '冲刺', '满格']
      const sixOk = legend.length === 7 && legend.slice(0, 6).join('/') === SIX.join('/')
      const todayOk = legend[6] === '今天'
      const bad = /\bL[0-5]\b/.test(document.querySelector('.dz-legend')?.textContent || '')
      const sum = document.querySelectorAll('.dz-sum .c').length
      const tops = [...document.querySelectorAll('.dz-mb-h')].map(h => Math.round(h.getBoundingClientRect().top))
      const oneRow = tops.length === 12 && new Set(tops).size === 1
      const overflow = Math.round(document.documentElement.scrollWidth - window.innerWidth)
      return { ok: cells >= 360 && sixOk && todayOk && !bad && sum === 4 && oneRow && overflow <= 1, txt: `格=${cells}(应≥360) 图例=${legend.join('/')} 六档名=${sixOk ? '符' : '不符'} 今天项=${todayOk ? '有' : '无'} 裸代号=${bad ? '有(红)' : '无'} 摘要卡=${sum}/4 月块同行=${oneRow} 溢出=${overflow}px` }
    })
  },
  {
    id: 'dz-day', name: '日详情', hash: '#/',
    /* ★W12(V3.8.12)随迁备案：① 日详情随 W10 搬进 Heatmap 的 Teleport 弹窗 `.dz-day-modal-overlay`，
       act 必须先点「看全年 ›」把 366 格展开（V3.8.7 起 expanded 初值 false）才有点得着的格子；
       ② 原 act 点的 `.dz-cell:not([disabled])` 首格 = 全年第一格，几乎必然是空白日，而四格统计
       带 `v-if="dlSum.n"` 前置（DayDetail.vue:229）——空白日就不渲染，「四格统计=0」是选格选错，
       不是四格丢了。改为**优先点有记录的格子**（level ≥1，即 class 带 l1~l5），无记录时才退回首格。
       判据本身不放宽：仍要求 ≥4 格 + 热力带 + 时间线三者齐全。 */
    act: async (page) => {
      await page.locator('.dz-mini-more').first().click({ timeout: 6000 }).catch(() => {})
      await page.waitForTimeout(700)
      /* R170 备案的"补等重数一次"口径：慢机日首击可能还没回流到父级 selDay ⇒ 补点另一格再判死（判据不放宽） */
      const has = page.locator('.dz-cell.l1:not(.future), .dz-cell.l2:not(.future), .dz-cell.l3:not(.future), .dz-cell.l4:not(.future), .dz-cell.l5:not(.future)').first()
      await (await has.count() ? has : page.locator('.dz-cell:not([disabled])').first()).click().catch(() => {})
      await page.waitForTimeout(900)
      if (!(await page.locator('.dz-day').first().isVisible().catch(() => false))) {
        await page.locator('.dz-cell:not([disabled])').nth(3).click().catch(() => {})
        await page.waitForTimeout(1500)
      }
    },
    judge: async (page) => page.evaluate(() => {
      const d = document.querySelector('.dz-day')
      const stats = document.querySelectorAll('.dz-day .dz-stats > .dz-stat').length
      const band = !!document.querySelector('.dz-day .dz-heat-band')
      const tl = !!document.querySelector('.dz-day .dz-tl')
      return { ok: !!d && stats >= 4 && band && tl, txt: `日详情=${!!d} 四格统计=${stats}(应≥4) 热力带=${band ? '有' : '无'} 时间线=${tl ? '有' : '无'}` }
    })
  },
  {
    id: 'dz-drill', name: '下钻卡片列表', hash: '#/profile',
    /* ★W12(V3.8.12)随迁备案：ReviewPanel 随 W10 从「页面内一屏」变成画像页的中央弹窗
       （ProfileInsights 的 `v-if="reviewOpen"` + `.pi-rev-overlay`），而本场景 act 直接找 `.dz-kpi`
       —— 那节点在未开弹窗时压根不在 DOM 里 ⇒ 「表头=无 行=0」。act 补上开弹窗这一步。 */
    act: async (page) => { await openReviewModal(page); await page.locator('.dz-kpi').first().click().catch(() => {}); await page.waitForTimeout(700) },
    judge: async (page) => page.evaluate(() => {
      const h = document.querySelector('.dz-drill-h')
      const rows = document.querySelectorAll('.dz-drill .dz-row').length
      const empty = !!document.querySelector('.dz-drill-empty')
      const txt = h ? h.textContent.replace(/\s+/g, '') : ''
      return { ok: !!h && (/类卡片/.test(txt) || /共.*条记录/.test(txt) || empty), txt: `表头=${txt.slice(0, 26) || '无'} 行=${rows} 空态=${empty ? '有' : '无'}` }
    })
  },
  {
    id: 'dz-review', name: '复盘两栏', hash: '#/profile',
    /* ★W12(V3.8.12)随迁备案：同 dz-drill —— 宿主搬进弹窗，本场景原无 act（靠上一场残留的弹窗才看得到），
       弹窗一关就全 0。改为自带 act 显式开弹窗，本场不再依赖上一场的残留状态。 */
    act: async (page) => { await openReviewModal(page) },
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
    id: 'dz-report', name: 'AI文本报告', hash: '#/profile',
    /* ★R2-② 备案：本报告的数据源=zy_daily_stats 快照，而快照只在「saveData 后 45s 时间闸」或「页卸载补写」时重建——
       播种的备份数据会在早期某次整库保存时被 flushCardEvents diff 成 create 事件、经时间闸落进快照。
       本文件任何位置（含 deck 探针）**不得在 dz-report 之前 page.reload**：reload 会连同 pending 定时器一起死掉，
       快照断源，报告退化成「本期没有任何动作记录」零态（2026-09-29 实测断过一次）。 */
    /* ★W12(V3.8.12)随迁备案：「AI 复盘」钮随 ReviewPanel 搬进 `.pi-rev-modal` 弹窗，
       原 act 在空 body 上找那个按钮 ⇒ 点不到 ⇒ `.dz-rpt` 不存在 ⇒ 「四段=无」。
       改为先开复盘弹窗再点报告钮。 */
    act: async (page) => { await openReviewModal(page); await page.locator('button:has-text("AI 复盘")').first().click().catch(() => {}); await page.waitForTimeout(1500) },
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
    /* ★B1-a（2026-10-17）新增：设置页里的「使用手册已升级为独立阅读页」入口面板。
       为什么必须有这一屏：`st-manual` 走的是 `#/manual`（独立阅读页），而 V3.8.25 B1-a 改的是
       **设置页 `#/settings?page=manual` 那张空态卡**——那上面有一颗书图标，原先外层写死
       `font-size:34px`、图标本体却按 `:size="13"` 渲染（Icon 用 width/height 定尺寸，外层字号对它无效），
       于是那颗"大图标"一直比正文还小。改完必须有人看过，而原来 26 个镜头一个都不走这条 hash，
       文本断言更是完全看不见尺寸。判据：图标宽落在 30–40px 档即脱盲。 */
    id: 'st-settings-manual', name: '手册入口卡（设置页）', hash: '#/settings?page=manual',
    judge: async (page) => page.evaluate(() => {
      const card = document.querySelector('.gs-empty')
      const ico = card ? card.querySelector('.gs-empty-ico svg') : null
      const box = ico ? ico.getBoundingClientRect() : null
      const title = document.querySelector('.gs-empty-title')
      const btn = document.querySelector('.gs-manual-open')
      return { ok: !!card && !!box && box.width >= 30 && box.width <= 40 && !!title && !!btn,
        txt: `卡=${!!card} 图标=${box ? Math.round(box.width) + '×' + Math.round(box.height) : '无'}px 标题=${!!title} 主钮=${!!btn}` }
    })
  },
  {
    /* ★B1-a（2026-10-17）新增：字段管理的"实时预览"。
       V3.8.25 发现这一大片**从未生效过**：预览 HTML 走 `v-html` 注入，注入节点拿不到 scoped 的
       scope id ⇒ `.gs-pv-field[data-v-xxxx]` 匹配不到，8 条预览样式一条都没命中，标签是一串纯文字
       而不是胶囊。判据：胶囊必须有底色与圆角（两者齐 = 令牌样式真的进来了，不再是裸文本）。

       ★★B1-a 当日补录（**第一版这份门禁是空转的，记下来免得再犯**）：
       预览卡 `#/settings?page=resource` 页面**更下方**，实测 `.gs-preview-card` 视口坐标
       y=922、卡高 before 113 / after 127，而截图视口只有 1440×900 且 `fullPage` 没开 ⇒
       取景前 `resetView()` 把滚动归零后，**改动的整张卡在取景框外**。后果：两边截图字节级相同
       （md5 都是 c5be96a9…）、img-diff 判"0 差"，而按 computed style 量，before 的胶囊
       `bg=rgba(0,0,0,0) / radius=0 / pad=0`（裸文本）、after 是 `rgba(94,106,210,0.16) / 99px / 1px 6px`
       ——**判据量到了变化、像素一屏都没看见**。这正是"判据与截图同源才可信"的反面教材：
       判据读的是 `getComputedStyle`（视口外也算），截图只拍视口内。*/
    id: 'st-fields-preview', name: '字段实时预览', hash: '#/settings?page=resource',
    /* 取景前把预览卡滚进视口。用 `block:'start'` 而不是 `block:'end'`/`center`：卡在文档里的
       绝对位置两边同为 y=922，对齐卡顶 ⇒ 两次跑的 scrollTop 相同、胶囊在视口里的落点也相同，
       像素差就只剩胶囊本身那点变化；`center/end` 会因 before/after 卡高 113 vs 127 差出
       不同滚动量，把"位移"混进"变化"里，A/B 反而说不清。 */
    scrollTo: '.gs-preview-card',
    judge: async (page) => page.evaluate(() => {
      const tags = [...document.querySelectorAll('.gs-pv-tag')]
      const bg = tags.length ? getComputedStyle(tags[0]).backgroundColor : ''
      const r = tags.length ? getComputedStyle(tags[0]).borderTopLeftRadius : ''
      const title = document.querySelector('.gs-pv-field-title')
      return { ok: tags.length > 0 && bg !== 'rgba(0, 0, 0, 0)' && parseFloat(r) > 2 && !!title,
        txt: `胶囊=${tags.length} 底色=${bg} 圆角=${r} 标题=${!!title}` }
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
  },
  {
    /* ★S4（V3.8.29）：主题选择器从「一行文字 + 单色圆点」改成三色样例卡之后，
       四主题下"卡里的色点是否还看得见、选中描边是否被底色吃掉"必须逐主题看一眼——
       而它只在**展开态**存在，任何静态截图都拍不到。 */
    id: 'dz-theme-menu', name: '主题色板',
    hash: '#/profile',
    act: async (page) => {
      // 幂等：已经开着就不再点（再点等于关掉 —— 见 closeOverlays 里的交替红说明）
      if ((await page.locator('.theme-dropdown').count()) === 0) {
        await page.locator('.theme-btn').first().click({ timeout: 6000 }).catch(() => {})
      }
      await page.waitForTimeout(280)
    },
    judge: async (page) => {
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.theme-dropdown .theme-option')]
        const act = cards.filter((c) => c.classList.contains('active'))
        const dots = cards.map((c) => c.querySelectorAll('.theme-swatch i').length)
        return {
          n: cards.length,
          tag: cards[0] ? cards[0].tagName : '',
          dots,
          act: act.length,
          border: act[0] ? getComputedStyle(act[0]).borderTopColor : '',
          borderW: act[0] ? getComputedStyle(act[0]).borderTopWidth : '',
          nameEmpty: cards.filter((c) => !(c.querySelector('.theme-name') || {}).textContent).length
        }
      })
      const ok = r.n === 5 && r.tag === 'BUTTON' && r.dots.every((x) => x === 3) && r.act === 1
        && r.borderW !== '0px' && r.nameEmpty === 0
      return { ok, txt: `卡=${r.n}/${r.tag} 色点=${r.dots.join(',')} 选中=${r.act} 描边=${r.borderW} ${r.border} 无名称=${r.nameEmpty}` }
    }
  }
]

/**
 * 浮层是否还挂着（三代壳都认：R161 起的中央弹窗 `.md-panel` + V3.2.1 及以前的右侧抽屉 `.drawer`
 * + content ⌘K 浮层 `.gp-overlay.open`）。
 *
 * ★W12(V3.8.12)随迁备案：W10 把画像洞察页重构成三段式后，仪表盘段有两个新弹窗壳，
 * 而本函数只认前两代 ⇒ closeOverlays 判「没开」直接 return，**弹窗会跨场景残留**：
 * 上一场开的复盘弹窗挂在 body 上，下一场的判据与截图全带着它（这是 dz-drill / dz-review /
 * dz-report 三项「全 0」的直接放大器 —— 它们的宿主本就在弹窗里，判据却在空 body 上找）。
 * `.dz-day-modal-overlay` = Heatmap 点格子弹出的日详情；`.pi-rev-overlay` = 画像页周/月复盘。
 */
async function overlayOpen(page) {
  return await page.locator('.md-panel, .drawer, .gp-overlay.open, .dz-day-modal-overlay, .pi-rev-overlay').first().isVisible().catch(() => false)
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
  /* ★B4（V3.8.29）：顶栏主题选择器是「点一下开、再点一下关」的下拉，不属于 overlay/scrim/mask
     任何一种语义，原先这里收不到它 ⇒ 展开态会泄漏到下一个主题的全部场景（实测 raycast 的
     st-airtable 截图里就挂着一块打开的主题菜单）。泄漏还会反向打断下一个主题：act 再点一次
     等于关掉，于是 dz-theme-menu 在 raycast/notion 上判 0、linear/apple 上判 5——**交替红**。
     这里按「点同一个按钮收回」处理，同时 act 侧也做幂等保护。 */
  if (await page.locator('.theme-dropdown').count()) {
    await page.locator('.theme-btn').first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(120)
  }
  for (let i = 0; i < 3; i++) {
    if (!(await overlayOpen(page))) return
    if (i === 0) await page.keyboard.press('Escape').catch(() => {})
    else {
      await page.locator('.md-close, .drawer-close, .pi-rev-close, .dz-day-modal .dz-btn.ghost').first().click().catch(() => {})
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

/**
 * ★B1-a（2026-10-17）新增：把镜头声明的 `scrollTo` 目标滚进视口，并等滚动落定。
 *
 * 为什么加：判据读的是 `getComputedStyle`（**视口外一样算得出值**），截图只拍视口内 ——
 * 这两件事不同源。st-fields-preview 第一版就把整个改动放在了取景框外：判据报"胶囊=2 底色=…"，
 * 而两侧截图字节级相同、像素 A/B 判 0 差，等于这一屏根本没进过门禁。修法是让镜头能自报取景目标。
 *
 * 对齐方式取 `block:'start'`：元素在文档里的绝对位置若两边相同，两次跑的滚动量就相同、
 * 元素在视口里的落点也相同，像素差只剩目标自身那点变化。若用 `center/end`，只要目标高度
 * 在改动前后不同（本例卡高 113 vs 127），滚动量就会差出几 px，把"位移"混进"变化"里。
 *
 * `scrollIntoView` 会自动把内层滚动容器（设置页正文 `.gs-content` 自带 overflow）一起滚到位，
 * 所以写窗口滚动是滚不动的（这点第一版也踩过：`window.scrollY` 全程 0）。
 */
async function scrollIntoView(page, sel) {
  return page.evaluate(async (s) => {
    const el = document.querySelector(s)
    if (!el) return { ok: false, why: '选择器没命中：' + s }
    el.scrollIntoView({ block: 'start', inline: 'nearest' })
    // 与 resetView 同思路：等滚动落定，别和截图抢那 0.5px。
    // 落定判据取「元素视口 top 连续两次相同」——比盯 scrollTop 更直接：top 不变就说明不再动了。
    let last = null
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 70))
      const top = Math.round(el.getBoundingClientRect().top)
      if (top === last) break
      last = top
    }
    const r = el.getBoundingClientRect()
    return { ok: true, scrollY: window.scrollY, top: Math.round(r.top), h: Math.round(r.height) }
  }, sel).catch(e => ({ ok: false, why: e instanceof Error ? e.message : String(e) }))
}

/**
 * ★B1-a（2026-10-17）新增：DOM 沉降等待，替掉"盲等 2300ms"。
 *
 * 为什么加：跑 V3.8.25 B1-a 的像素 A/B 时，`st-tags` / `st-airtable` 两屏**偶发**抓不到面板 ——
 * 同一段代码、同一份种子数据，连跑两次：一次 `goto('#/settings?page=tags')` 后 250ms 标签行就在（rows=4），
 * 另一次 2300ms 时还没挂上（rows=0，`.gs-card` 取空 ⇒ judge 里 `getComputedStyle(null)` 直接抛异常，
 * 整个走查中断在后半程）。已验证路由本身没走丢（改用 `location.hash` 赋值就能稳定出现），
 * 是 SPA 挂载慢 + 固定盲等的抽样偶合。
 *
 * 判据：**DOM 指纹连续两次采样不变即视为沉降**（节点数 + hash），每 200ms 一次，最长 6s；
 * 沉降后再走原有的 resetView。失败不抛（超时只是退化成原来的盲等），保持"能跑完"优先。
 *
 * 为什么这不破坏 A/B 可比性：改动前（--pkg=旧 dist）与改动后用**同一个版本的工具**跑，
 * 两边都多等同一道沉降 —— 只减少"抓到半张脸"的噪声，不引入任何方向性偏移。
 */
async function settle(page, label) {
  let last = null
  let stable = 0
  for (let i = 0; i < 30; i++) {
    const fp = await page.evaluate(() => {
      const n = document.getElementsByTagName('*').length
      const h = location.hash
      const panel = document.querySelectorAll('.gs-panel, .mn-list, .deck-frame').length
      return n + '|' + h + '|' + panel
    }).catch(() => null)
    if (fp === null) return
    if (fp === last) { stable++; if (stable >= 1) return } else { stable = 0; last = fp }
    await page.waitForTimeout(200)
  }
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
/* ★B1-a（2026-10-17）新增 `--scenes=a,b,c`：只跑指定镜头。
   为什么加：26 个镜头里有若干带 `act` 点击的深镜头（抽屉 / 看板 / 池列表 / 下钻 / 复盘 / 热力图），
   它们要求种子数据里有对应内容；数据不全时这些镜头是空态不算数，而**它们开过抽屉/切过 tab 的
   副作用会把后面的设置类镜头带进异常路由**（实测：跑完 19 个深镜头后 `#/settings?page=tags`
   抓到的是空壳）。所以"改动只碰设置页"的时候必须能只取这几个镜头做 A/B，而不是每次都被
   前 19 个空态镜头干扰。默认不加过滤 = 原有全量行为不变。 */
const SCENES = argv.scenes ? String(argv.scenes).split(',').map(s => s.trim()).filter(Boolean) : null
const pick = (list) => SCENES ? list.filter(v => SCENES.includes(v.id)) : list
const views = pick(VIEWS)
const modalViews = pick(MODAL_VIEWS)
const drawerViews = pick(DRAWER_VIEWS)
const dashScenes = pick(DASH_SCENES)
if (argv.scenes) {
  const hit = [...views, ...modalViews, ...drawerViews, ...dashScenes].length
  if (!hit) throw new Error('--scenes 没匹配到任何镜头，可选：' + [MODAL_VIEWS, VIEWS, MODAL_VIEWS, DRAWER_VIEWS, DASH_SCENES].flat().map(v => v.id).join(' / '))
  console.log(`镜头过滤：${argv.scenes} → 命中 ${hit} 个`)
}

  if (!fs.existsSync(CHROME)) throw new Error('Chromium 不存在：' + CHROME)
  if (!fs.existsSync(path.join(pkg, 'manifest.json'))) throw new Error('目标不是有效扩展包：' + pkg)
  fs.mkdirSync(outDir, { recursive: true })

  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const data = raw.zy_data_v2 || raw
  /* ★B5-a：折叠判据的数据前置——方向树里至少得有一个项目舱，否则 .tw-head 恒为 0，
     "每舱都有卡头 / 折叠真的摘节点"这两条无从判起（见 treeSkip 处注释）。 */
  const dataHasProjects = (data.directions || []).some(d => Array.isArray(d.projects) && d.projects.length > 0)
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
  const frameFail = [] /* ★B1-a：scrollTo 取景失败 / 判据目标落在取景框外的记账 */
  const treeFail = [] /* R3-B′：完整方向树项目层折叠活体判据 */
  const treeSkip = [] /* ★B5-a：数据前置不满足时的**显式跳过**，与 ❌ 分开记账 */
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
    for (const v of views) {
      await page.goto(base + v.hash, { waitUntil: 'domcontentloaded' })
      await settle(page, v.id) /* ★B1-a：DOM 沉降后再盲等，避免抓到"设置子页还没挂载"的半张脸 */
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
          /* ★W12(V3.8.12)随迁备案：方向台第 4 层已随 W11 由「三列并排网格」改为纵向项目舱，
             原锚 .tree-project-branch / .tp-head / .tp-caret / .tree-metric-branch / .folded
             五个类名全部退役 ⇒ 本段自 W11 起就「一张卡头都没有」空转，
             而判据把空转当失败报出，W11/W12 两轮都误读成环境缺口（实为选择器失效）。
             现按真实结构重写：舱=.tower / 卡头=.tw-head / 开合把手=.tw-fold（aria-expanded 承担折叠态）
             / 指标卡=.metric-card（挂在 .tw-body 内）。
             所守行为未变：① 每个舱都有卡头（有卡头无把手 = 假折叠的反面）
             ② 收起的舱不得渲染指标卡（折叠是假折叠）③ 老深链重定向仍成立。 */
          const towers = [...document.querySelectorAll('.tower')]
          const heads = [...document.querySelectorAll('.tw-head')]
          // 收起态 = .tw-fold[aria-expanded="false"]
          const foldedTowers = towers.filter((t) => {
            const f = t.querySelector('.tw-fold')
            return f && f.getAttribute('aria-expanded') === 'false'
          })
          /* ★判定必须查「可见性」而不是「DOM 里有没有」—— 舱身用的是 v-show，
             收起时 display:none 但节点仍在 DOM 里（这是 v-show 的定义，不是缺陷）。
             先量到这个坑：判据按 querySelectorAll('.metric-card').length 判，
             于�� 4 个收起舱全部误报「折叠是假折叠」，而用户看到的是正确折叠。
             改用 offsetParent（display:none 时为 null）判真实可见性。 */
          const bad = foldedTowers.filter(t => {
            const body = t.querySelector('.tw-body')
            if (!body) return false
            const vis = body.offsetParent !== null || getComputedStyle(body).display !== 'none'
            return vis && t.querySelectorAll('.metric-card').length > 0
          }).length
          // 另记：收起舱仍带指标卡 DOM 是 v-show 的正常形态，单独报个数供人判断是否需要改 v-if
          const domInFolded = foldedTowers.reduce((s, t) => s + t.querySelectorAll('.metric-card').length, 0)
          return {
            branches: towers.length,
            heads: heads.length,
            folded: foldedTowers.length,
            carets: document.querySelectorAll('.tw-fold').length,
            metrics: document.querySelectorAll('.metric-card').length,
            bad, domInFolded, hash: location.hash
          }
        })
        extra = ` 舱=${j.branches} 卡头=${j.heads} 开合把手=${j.carets} 收起=${j.folded} 指标卡=${j.metrics} 收起舱内DOM残留=${j.domInFolded}`
        if (!j.heads && !dataHasProjects) treeSkip.push(`${theme}/${v.id}：数据里没有项目舱（备份的 directions[].projects 全空）⇒ 折叠判据**跳过**`)
        else if (!j.heads) treeFail.push(`${theme}/${v.id}：一张项目舱卡头都没有（数据没种上或视图没渲染）——判据空转`)
        else if (j.bad) treeFail.push(`${theme}/${v.id}：${j.bad} 个收起的舱里指标卡**仍然可见** ⇒ 折叠是假折叠`)
        else if (j.carets !== j.heads) treeFail.push(`${theme}/${v.id}：开合把手 ${j.carets} != 卡头 ${j.heads} ⇒ 有卡头没有开合把手`)
        if (v.id === 'compass-tree') {
          extra += ` 落点=${j.hash}`
          if (!/^#\/compass(\?|$)/.test(j.hash)) treeFail.push(`${theme}/${v.id}：#/compass/tree 未重定向到 /compass（实际 ${j.hash}）⇒ 老深链在丢命`)
        }
      }
      console.log(`  ✓ ${theme.padEnd(8)} ${v.name.padEnd(4)} hash=${(hash || '#/').padEnd(26)}${extra} → ${path.basename(file)} (${kb}KB)`)
    }
    // R161：AI 评审中央弹窗（走 设置 › AI 助手 › 本周回顾 —— 该入口已接左栏与指令条）
    for (const m of modalViews) {
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
    for (const v of drawerViews) {
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
    /* ★B4（V3.8.29）：池面板是懒挂载的。500ms 盲等在每个 run 的**第一个主题**上会量到"面板还没进 DOM"，
       于是 paneOn 假红（实测只在 linear 复现，raycast 起数据已就绪就绿了——交替出现的红最容易被当成偶发忽略）。
       改成显式等容器 `.pcp` 出现，超时才退回盲等；判据本身一个都没放松。 */
    await page.locator('.pcp').first().waitFor({ state: 'attached', timeout: 6000 }).catch(() => {})
    /* 视图模式（网格/列表）是持久化的：上一次 run 停在列表时，这一屏既没有 .pcp-card 也没有 .pcp-empty，
       paneOn 会假红。判据只认「面板在不在」，但截图必须与其它主题同构 ⇒ 先幂等切回网格。 */
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.dk-row[data-panel="pool"] .dk-view')].find(x => (x.textContent || '').includes('网格'))
      if (b) b.click()
    })
    await page.waitForTimeout(300)
    await resetView(page)
    const spot = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.bt-tab'))
      const poolBtn = tabs.find(x => (x.textContent || '').includes('资源卡'))
      const poolOn = !!poolBtn && poolBtn.classList.contains('on')
      const pane = document.querySelector('.pcp-card, .pcp-empty') || document.querySelector('.pcp')
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
    for (const sc of dashScenes) {
      await page.setViewportSize(VIEWPORT)
      await page.goto(base + (sc.hash || '#/profile'), { waitUntil: 'domcontentloaded' }) // ★W9 退役重指带备案：仪表盘/复盘段宿主由 /settings?page=dashboard迁画像洞察页 /profile
      await page.waitForTimeout(2400)
      /* ★B1-a：补上 DOM 沉降等待。st-tags / st-airtable 就在这个循环里，实测偶发"2400ms 到了
         面板还没挂上"（rows=0、.gs-card 取空 ⇒ judge 里 getComputedStyle(null) 抛 TypeError）。
         上面 views 循环早已用 settle() 替盲等，这一段当时漏了。放在盲等之后：稳定就立刻返回，
         不稳定才继续等，只会更稳不会更慢。 */
      await settle(page, sc.id)
      /* ★W12(V3.8.12)随迁备案：全年 366 格自 V3.8.7 起收进「看全年 ›」展开态
         （Heatmap 的 expanded 初值 false），而 dz-heatmap 的判据直接数 .dz-cell ——
         这些节点**在收起态不存在** ⇒「格=0(应≥360)」是从 V3.8.7 起就一直红着的，
         与方向台那批同根因（漏迁三轮）。这里先展开再判。
         折叠本身由 W7-3 守着（双向可达），本处只负责让场景拿到节点。
         ★只对 dz-heatmap 生效：dz-day 的 act 自己要挑「有记录的格子」（四格统计带 v-if="dlSum.n"
         前置，展开后点首格必是空白日），若这里也展开一次，它的 act 会点到第二层去。 */
      if (sc.id === 'dz-heatmap') {
        await page.locator('.dz-mini-more').first().click({ timeout: 6000 }).catch(() => {})
        await page.waitForTimeout(800)
      }
      if (sc.act) await sc.act(page)
      await resetView(page)
      /* ★B1-a：判据与截图必须同源。resetView 刚把滚动归零，而 `judge` 读的是 getComputedStyle
         ——**视口外一样算得出值**；截图只拍视口内。两件事不同源，这一屏就可以"判据量到了变化、
         两侧截图却字节相同、像素 A/B 判 0 差"地空转（st-fields-preview 第一版实测正是如此：
         预览卡在文档 y=922、视口高 900，整张卡在取景框外）。
         镜头可声明 scrollTo 把取景目标滚进视口；滚不动/没命中记进 frameFail，不允许静默。
         注意钩子必须放在 **resetView 之后、screenshot 之前**：resetView 会把所有滚动容器归零。 */
      if (sc.scrollTo) {
        const sv = await scrollIntoView(page, sc.scrollTo)
        if (!sv.ok) frameFail.push(`${theme}/${sc.id}：scrollTo 失败（${sv.why}）⇒ 这一屏可能又拍在取景框外`)
      }
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
  // ★B3（V3.8.28）修：原式一律用 VIEWS / MODAL_VIEWS / DRAWER_VIEWS / DASH_SCENES 的**全量长度**，
  //   于是 `--scenes=` 过滤时「拍到的图」永远少于「应有图数」，收尾必假红 exit 1 —— 明明全拍成功了。
  //   这里改用 pick 之后的实际镜头数（overlay 两场景不走过滤，仍按全量算）。
  const want = themes.length * (views.length + modalViews.length + drawerViews.length  + 3 /* R2-②③ DeckTabs deck 判据 + R3-Ca 池列表视图 + R3-Cc 共用批量栏 */ + dashScenes.length + OVERLAY_SCENES.length /* R4-En content 浮层 2 场景 ⇒ 96→104；R172-T13 仪表盘七场景 + R3-B′ 方向台台面 ⇒ 68→72；R3-Ca 池列表 + R3-Cc 批量栏 ⇒ 72→80；R4-Da 标签双栏 ⇒ 80→84；R4-Dd Airtable 面板 ⇒ 84→88；R4-Df 使用手册 ⇒ 88→92；R4-Dl ⌘K 检索面板 ⇒ 92→96 */)
  if (shots.length !== want) { console.log(`❌ 图数 ${shots.length} ≠ 应有 ${want}（${themes.length} 主题 × (${views.length} 台面 + ${modalViews.length} 弹窗 + ${drawerViews.length} 卡详情 + 3 deck + ${dashScenes.length} 仪表盘 + ${OVERLAY_SCENES.length} content 浮层${SCENES ? '；本次带 --scenes 过滤' : ''})）`); process.exit(1) }
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
  if (treeSkip.length) {
    /* ★B5-a（V3.8.31）新增：**跳过 ≠ 通过**。
       由来：本机唯一备份 `zhiyuan_backup_20261017.json` 里 directions[].projects 全空，
       方向台只剩骨架条与空态，折叠判据无从判起 → 一直判红。但这不是代码缺陷，
       是数据前置不满足；把它混进 ❌ 会让"真红"和"没法判"同形（R71 教训的翻版）。
       所以单列 ⚠ 且**逐条写明跳过了什么**；要真验证折叠，得给 --data 一份含项目的备份。 */
    console.log(`⚠ 方向树折叠判据跳过 ${treeSkip.length} 项（数据前置不满足，**不等于通过**）：\n  ` + treeSkip.join('\n  '))
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
  /* ★B1-a 取景框守卫：放在最后单独报，且单独退出码 3 —— 它与"产品判据不过"是两件事，
     混在一个出口里下次就会为了看产品结论而把它忽略掉。 */
  if (frameFail.length) {
    console.log(`❌ 取景框守卫未过 ${frameFail.length} 项（判据可能又量在了视口外）：\n  ` + frameFail.join('\n  '))
    process.exit(3)
  }
}
main().catch(e => { console.error('theme-audit 失败：', e); process.exit(2) })
