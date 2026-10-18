#!/usr/bin/env node
/* B8 · V3.8.41 孤儿文件探测器（组件 / 工具模块的 import 图孤立检测）

   **为什么立这把尺子**：V3.8.40 四主题实拍收尾时发现 `theme-audit` 有 4 条场景判据
   量的东西**产品侧早已退役**（W13-D5，2026-10-16），而当时盘点报告据此写下
   「三个组件全库零挂载」。本批复查时用 import 图一算，发现那个结论本身**错了一个**：
   `DrillCardList.vue` 被 `DayDetail.vue` 真实 import（今日战报在用），只有
   `ReviewPanel.vue` / `ReviewReportModal.vue` / `HeatmapModule.vue` 是真孤儿。
   ★教训：**"grep 文件名"数不出引用数**——注释、备案句、字符串里都会出现文件名，
     而真正的 import 只有 `import X from '…'` 与 `import('…')` 两种形态。
     于是有了本脚本：只认 import 图，不认文本出现。

   口径：
   · 节点 = src 下全部 .vue/.ts/.js（.d.ts 除外——类型声明本来就没有入边）
   · 边  = 静态 import / export from / defineAsyncComponent 的 dynamic import
   · 入口 = 构建入口（main.ts / router.ts / manifest.ts / content / background / options），
           以及被入口直接引用的文件——由图的传递闭包天然算出，不手工列白名单
   · 孤儿 = 非入口、入边为 0 的文件
   · --json 输出机器可读；退出码 0=无孤儿，1=有孤儿，2=自身用法/环境错误

   ★判据用法的两条纪律（B8 实测后补）：
   ① 反向注入必须真建文件再删：回归判据在 src 里临时造一个无人 import 的 .vue，
       跑本脚本要求 exit 1，finally 删掉——只改字符串不真建文件，测的是想象力。
   ② 本脚本**只判"孤立"**，不判"该不该删"：删除决策仍归人（要先确认没有判据守着、
      没有"保留待复用"的备案）。 */

const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const ROOT = path.resolve(argOf('--src') || path.resolve(__dirname, '..', 'src'))

if (!fs.existsSync(ROOT)) {
  console.error(`✗ src 目录不存在：${ROOT}`)
  process.exit(2)
}

const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(vue|ts|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p)
  }
  return acc
}

const files = walk(ROOT)
/* ★扩展名顺序必须与 Vite 实际解析顺序一致（B8 实测踩坑）：`shared/components/` 下同时存在
   `toast.ts`（单例）与 `Toast.vue`（组件），`import … from '@/shared/components/toast'`
   （无扩展名）在 Vite 里命中 **.ts**——证据是 build 绿（若命中 .vue，showToast 导入直接炸）。
   Vite 核心 resolve.extensions = ['.mjs','.js','.mts','.ts','.jsx','.tsx','.json']，
   plugin-vue 的 .vue 排在其后。第一版把 .vue 放最前 ⇒ toast.ts 被误判成 102 个孤儿之一。
   ⇒ **判据工具的解析顺序要和被测构建链一致**，否则尺子自己就是错的。 */
const EXTS = ['', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.vue', '/index.ts', '/index.js', '/index.vue']

function resolveSpec(spec, fromFile) {
  if (!spec.startsWith('.')) return null /* @/ 别名在下面单独处理 */
  const base = path.resolve(path.dirname(fromFile), spec)
  for (const e of EXTS) {
    const p = base + e
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  return null
}

/* vite 配置里 @ → src 根（tsconfig/vite.config 的 paths 一致），这里同步认这个别名 */
const SRC_ALIAS = ROOT
function resolveAlias(spec, fromFile) {
  const m = /^@\/(.+)$/.exec(spec)
  if (!m) return null
  const base = path.join(SRC_ALIAS, m[1])
  for (const e of EXTS) {
    const p = base + e
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  return null
}

/* import 形态采集：static / dynamic / export-from。
   ★只认这三种：`import X from 'p'` / `import('p')` / `export … from 'p'`。
     注释与字符串里的文件名不算——这正是本脚本存在的理由。 */
const importRe = [
  /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /defineAsyncComponent\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
]

const edges = new Map()   // file → Set<imported file>
const incoming = new Map() // file → number
for (const f of files) { edges.set(f, new Set()); incoming.set(f, 0) }

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const specs = new Set()
  for (const re of importRe) {
    let m
    re.lastIndex = 0
    while ((m = re.exec(src))) specs.add(m[1])
  }
  for (const s of specs) {
    const target = resolveSpec(s, f) || resolveAlias(s, f)
    if (target && edges.has(target) && target !== f) {
      if (!edges.get(f).has(target)) {
        edges.get(f).add(target)
        incoming.set(target, (incoming.get(target) || 0) + 1)
      }
    }
  }
}

/* 入口 = 入边 > 0 的全部文件，加上**没有任何入边但名字命中入口模式**的根文件
   （main.ts / router.ts / manifest.ts / content 三件 / background / options）。
   只把"根级 + 入口目录"算入口，别把任何零入边文件都赦免——那会让孤儿永远查不出。 */
const ENTRY_NAMES = new Set(['main.ts', 'router.ts', 'manifest.ts', 'search-overlay.ts', 'selection.ts', 'overlay-impl.ts', 'index.ts'])
const isEntry = (f) => {
  const rel = path.relative(ROOT, f)
  if (rel.includes(`${path.sep}background${path.sep}`) || rel.includes(`${path.sep}content${path.sep}`) || rel.includes(`${path.sep}options${path.sep}`)) return true
  if (!rel.includes(path.sep)) return true /* src 根级文件 */
  return ENTRY_NAMES.has(path.basename(f)) && rel.split(path.sep).length === 2
}

/* ============ 显式保留名册（RETAINED）============
   **孤儿不等于该删**。有些文件是"有意留下待复用"的——但保留必须是**明文的**：
   写进这张表、带理由、带复核时点。 accidental retention（"先放着"）是死代码的温床：
   V3.8.40 复盘时发现 ReviewPanel 的文件头写着"保留待复用"，而它已经死了两周没人管。
   ⇒ 规矩：想保留，来这里登记；不登记就是孤儿，删。
   每条目在版本复核时重新表态（还在等什么？还要等多久？），答不上来就删。

   ★★B8 实测踩坑备案（V3.8.41）：本表第一版只有 CatPicker，于是 orphan-check 报出 6 个孤儿，
     **本批据此把它列的六个文件全删了**——其中 ReviewPanel / ReviewReportModal / HeatmapModule /
     NorthStarPanel / useDashboardReport / ai-review 是 W13-D5（2026-10-16 用户拍板「复盘能力四段常驻」）
     明文要求"组件文件保留待复用，同 CatPicker 先例"的，W13-T7a 判据正逐条读其中一份的本体。
     后果：回归 46 条红。那不是"清理陈旧断言"，是**把一次用户拍板当成死代码删掉**——
     尺子（判孤立）没错，错在把它的输出直接当成了删除许可。
     ⇒ 三条规矩，从此生效：① 本脚本 exit 1 只是"该看一眼"，不是"可以删"；
       ② 删任何一个文件前先 grep regression/ 看有没有判据在读它的本体（读它的注释不算，读 includes 才算）；
       ③ "保留待复用"必须在**本表**里明文登记——只写在组件文件头的注释里，不算登记（它不会跟着 git diff 走评审）。 */
const RETAINED = {
  'shared/components/CatPicker.vue':
    '通用分类选择器（搜索过滤 + 键盘上下选）。R2 时代的"管理面再议"一直没再议，' +
    '但它是纯展示组件、无数据耦合，复用成本低。**V3.9.0 里程碑复核**：届时仍无复用方就删。',

  /* —— W13-D5 一族（2026-10-16 用户拍板「复盘能力四段常驻」）：能力退役、组件保留待复用 ——
     ★只登记**真零入边**的那几个。ReviewReportModal 与 shared/ai/review 不在此列：
       它们是 ReviewPanel 的**下游**（defineAsyncComponent 动态 import / 运行期 dynamic import），
       有真入边，尺子本来就抓不到它们——把它们写进名册是拿名册当安慰剂用，反而让它失去意义。 */
  'newtab/components/dashboard/ReviewPanel.vue':
    'W13-D5 用户拍板：复盘弹窗挂载退役，但**组件文件保留待复用（同 CatPicker 先例）**。' +
    'W13-T7a 判据正逐条读它的本体（buildReview/objectivesOf），删它就是推翻一次拍板。' +
    '能力去向已另立四段模块常驻承接。**V3.9.0 里程碑复核**：确认不复用则连判据整组下线后删。',
  'newtab/composables/useDashboardReport.ts':
    'W13-D5 一族：复盘报告的四个出口（save/task/goto/export）随弹窗退役，composable 本体零入边。' +
    '保留理由 = ProfileInsights 的退役备案逐条点名了它的四个出口（那是"删了不解释"的反证）。' +
    '**V3.9.0 里程碑复核**：确认四出口不复用则删。',
  'newtab/components/dashboard/HeatmapModule.vue':
    '★热力图能力随 V3.8.7 迁画像洞察页后，本模块零挂载；但它是"数据桥 + onOpenLog 接线"的' +
    '**参照实现**，TodayBattleHost 的文件头明文写着"解耦方式照搬 HeatmapModule 那个已被 W2-3 ' +
    '判据认可的写法"，W2-3 判据亦读它的本体。**V3.9.0 里程碑复核**：确认 TodayBattleHost 已独立站稳则删。',
  'newtab/components/compass/NorthStarPanel.vue':
    '北极星面板：功能随第卌四轮改版退役（O23/R31/R43/R44 等整族断言现为退役负锚），' +
    '本体零挂载。保留理由 = 它是 O23「未归档任务」口径的**原始实现**，现由 MetricDrillDrawer ' +
    '承接并在其文件头注明"口径同 NorthStarPanel O23"——口径的活证。**V3.9.0 里程碑复核**：同上。',
}


const found = files.filter(f => !isEntry(f) && (incoming.get(f) || 0) === 0)
  .map(f => path.relative(ROOT, f))
const orphans = found.filter(f => !RETAINED[f])
const retained = found.filter(f => RETAINED[f])

if (argv.includes('--json')) {
  console.log(JSON.stringify({
    孤儿: orphans, 保留: retained,
    节点数: files.length, 边数: [...edges.values()].reduce((a, s) => a + s.size, 0)
  }, null, 1))
} else if (orphans.length) {
  console.log(`✗ 发现 ${orphans.length} 个孤儿文件（非入口、import 图入边为 0，且未登记保留）：`)
  for (const o of orphans) console.log(`   ${o}`)
  console.log('  确认无人引用后可删；若是"保留待复用"，请把理由写进上方 RETAINED 名册并在判据里立负锚。')
} else {
  console.log(`✓ 无孤儿文件（${files.length} 个节点 / ${[...edges.values()].reduce((a, s) => a + s.size, 0)} 条 import 边）`)
  for (const r of retained) console.log(`  · 显式保留：${r} —— ${RETAINED[r]}`)
}
process.exit(orphans.length ? 1 : 0)
