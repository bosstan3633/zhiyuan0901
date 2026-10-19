/**
 * move-shortcuts-subdomain.cjs —— P0-3 第五批 · 拆 SettingsShortcutsPanel（快捷键设置子域）
 *
 * 纪律（本批沿用的三条硬约束）：
 *  ① 搬移一律**程序化切原文**，禁止手抄/凭印象重打 —— 症状统一是「编译过、判据绿、只有像素知道」。
 *  ② **只按原始行号删一次**，避免行号漂移；取错就抛错，不静默产出坏产物。
 *  ③ 组件之间不得互相 import（会成环）；跨子域共用符号走 props 或 emit → 宿主中转。
 *
 * 段边界（行号取自 V3.8.42 第四批终态的宿主 GlobalSettings.vue，1-based）：
 *   tplShortcuts  [332, 371]  快捷键设置面板（全局快捷键表 + 应用内快捷键表 + 切台修饰键下拉）
 *   tplWorkspaceKeys [374, 392] 策展台快捷键面板（映射表 + 修饰键行）
 *   jsChrome      [853, 886]  chrome.commands 动态拉取 + wsMod computed + saveWsMod + modLabel
 *   jsAppShortcuts[1637, 1644] appShortcuts computed（切台/编辑与检索两组，自 shortcuts.ts 派生）
 *
 * ★第 324 行那个「===== 快捷键设置 =====」段注释是上一批插接线时被挤到 export 注释**前面**的
 *   （导出段本就在它后面，接线却插在了它下面）⇒ 本批顺手归位：删掉它，由宿主接线处重新给一段。
 *
 * 用法：
 *   node scripts/archive/move-shortcuts-subdomain.cjs --dry      只报告不落盘
 *   node scripts/archive/move-shortcuts-subdomain.cjs --gen-only 只生成组件，不改宿主（先过 vue-tsc）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const HOST = path.join(ROOT, 'src/newtab/views/GlobalSettings.vue')
const OUT = path.join(ROOT, 'src/newtab/views/settings/SettingsShortcutsPanel.vue')

const DRY = process.argv.includes('--dry')
const GEN_ONLY = process.argv.includes('--gen-only')

const Q = '"'
const A = "'"
const L = fs.readFileSync(HOST, 'utf8').split('\n')
/** 取 1-based 闭区间原文；越界即抛错——「取错就抛错」是本脚本唯一的守门约定 */
function seg(name, from, to) {
  if (from < 1 || to > L.length || to < from) throw new Error(`段 ${name} 行号越界：${from}~${to}（宿主共 ${L.length} 行）`)
  return L.slice(from - 1, to)
}
function must(cond, msg) { if (!cond) throw new Error('★守门失败：' + msg) }

/* ══════════════ 一、模板段 ══════════════ */
let tplShortcuts = seg('tplShortcuts', 332, 371)
let tplWsKeys = seg('tplWorkspaceKeys', 374, 392)

must(tplShortcuts[0].includes(Q + 'activePage === ' + A + 'shortcuts' + A + Q), 'tplShortcuts 起点不是 shortcuts 门控')
must(tplShortcuts[tplShortcuts.length - 1].trim() === '</div>', 'tplShortcuts 终点不是收尾 </div>')
must(tplWsKeys[0].includes(Q + 'activePage === ' + A + 'shortcuts' + A + Q), 'tplWsKeys 起点不是 shortcuts 门控')
must(tplWsKeys[tplWsKeys.length - 1].trim() === '</div>', 'tplWsKeys 终点不是收尾 </div>')
/* 两个面板各自带门控；进子域后 activePage 在宿主取不到 ⇒ 两处都摘成恒真 */
tplShortcuts[0] = tplShortcuts[0].replace(' v-if=' + Q + 'activePage === ' + A + 'shortcuts' + A + Q, '')
tplWsKeys[0] = tplWsKeys[0].replace(' v-if=' + Q + 'activePage === ' + A + 'shortcuts' + A + Q, '')
must(!/activePage/.test(tplShortcuts.concat(tplWsKeys).join('\n')), '子域模板里仍有 activePage 残留')

/* 宿主第 373 行那条「===== 策展台快捷键（R49-I2 …）=====」段注释在搬移段之外（它是 374 的上一行）。
   它是这条键位演进链的**唯一书面证据**（V3.7.0 R179 资源台退役 ⇒ 策展台顺延到 3 号位），
   本批随面板一起迁进子域、放第二个面板顶部。
   ★不迁也不删：删掉是「删了不解释」，留在宿主是「注释描述的东西已经不在这里」。
   ★必须放在守门**之后** push：守门要认「首行 = 带 v-if 的开标签」，
   提前 unshift 会把首行顶掉、守门立刻假红（第一次就这么踩了）。 */
tplWsKeys.unshift('      <!-- ===== 策展台快捷键（R49-I2 引入；V3.7.0 R179：资源台退役后策展台顺延——1=调度台、2=方向台、3 起=各策展台） ===== -->')

/* ══════════════ 二、脚本段 ══════════════ */
const jsChrome = seg('jsChrome', 853, 886)
const jsAppShortcuts = seg('jsAppShortcuts', 1637, 1644)

must(jsChrome[0].includes('---- 快捷键设置（H） ----'), 'jsChrome 起点不是快捷键段标')
must(jsChrome[jsChrome.length - 1] === '}', 'jsChrome 终点不是 modLabel 的收尾 }')
must(jsAppShortcuts[0].startsWith('// B7-e H3：应用内快捷键不再各写一份清单'), 'jsAppShortcuts 起点不对：' + jsAppShortcuts[0])
must(jsAppShortcuts[jsAppShortcuts.length - 1] === '])', 'jsAppShortcuts 终点不是 ])')
/* 这两段用到 shortcuts.ts 的 shortcutsOf / modLabelOf ⇒ 子域自己 import，不从宿主穿透 */
must(jsAppShortcuts.join('\n').includes('shortcutsOf('), 'jsAppShortcuts 未用 shortcutsOf')

/* ══════════════ 三、生成组件 ══════════════ */
/* ★用数组 join，不用模板串 —— 被搬源码里含 ${...} 插值（上一批实测踩过：当场求值炸 SyntaxError） */
const gen = []
/* ★两个面板**各自**都自带 `<div class="gs-panel">` 外壳且段内配平（原文核对：
   332~371 段 <div 18 / </div> 18，差 0）⇒ 组件模板**不得再加一层外壳**。
   上一版多套了一层 ⇒ 模板多一个 `</div>`（配平差 −1），肉眼能看出缩进乱、
   但 vue-tsc 与 build 都绿（Vue 模板容错：多余的闭合标签被静默忽略）。 */
gen.push('<template>')
gen.push(...tplShortcuts)
gen.push('')
gen.push(...tplWsKeys)
gen.push('</template>')
gen.push('')
gen.push('<script setup lang="ts">')
gen.push('/* V3.8.42 · P0-3 第五批：从 GlobalSettings.vue 原样搬出的「快捷键设置」子域。')
gen.push('   ★本子域含**两个** gs-panel（快捷键设置 / 策展台快捷键），二者原本各带一处')
gen.push('     `v-if="activePage === \'shortcuts\'"`。activePage 在宿主，组件内取不到，')
gen.push('     故两处都摘成恒真——**显隐统一交给宿主那一层**：')
gen.push('     `<SettingsShortcutsPanel v-if="activePage === \'shortcuts\'" />`。')
gen.push('     ★反过来做（把 v-if 留在子域、或让子域自己判断当前页）会让这一页常驻挂载、其余四页各冒一份。')
gen.push('   ★props 而非复制：shortcutsUrl 被 extension 子域的「全局快捷键配置」链接共用；')
gen.push('     wsDisplayNameOf 与 import/export 两个子域共用同一份（**沿用既有先例**：')
gen.push('     导出页那两份都是 props 通道，复制第三份就是三处都得改的隐患）。')
gen.push('   ★store / saveUIPrefs 由本组件直接取 —— wsMod 是本子域私有的偏好开关，')
gen.push('     留在宿主就得为一个下拉专设一条通道（先例：extension 子域的 capturePref 随迁）。')
gen.push('   ★样式：本子域**没有私有样式** —— 键帽 .gs-keycap / 行 .gs-setting-row / 下拉 .gs-select /')
gen.push('     快捷键链接 .gs-shortcut-link 与 Airtable、扩展子域共用，已在 settings/base.css（全局表）。 */')
gen.push('import { computed, ref } from ' + Q + 'vue' + Q)
gen.push('import Icon from ' + Q + '@/shared/components/Icon.vue' + Q)
gen.push("import { useAppStore } from '../../stores/app'")
gen.push("import { shortcutsOf, modLabelOf } from '@/shared/utils/shortcuts'")
gen.push("import { saveUIPrefs } from '@/shared/storage/repository'")
gen.push('')
gen.push('const { shortcutsUrl, wsDisplayNameOf } = defineProps<{')
gen.push('  shortcutsUrl: string')
gen.push('  wsDisplayNameOf: (w: { id: string; name: string; icon: string }) => string')
gen.push('}>()')
gen.push('')
gen.push('const store = useAppStore()')
gen.push('')
gen.push(...jsChrome)
gen.push('')
gen.push(...jsAppShortcuts)
gen.push('</script>')
gen.push('')
gen.push('<!-- 基类：.gs-panel / .gs-card / .gs-setting-row / .gs-keycap / .gs-select / .gs-shortcut-link')
gen.push('     （V3.8.42 外提为全局表 settings/base.css，非 scoped —— scoped 命中不了子组件内部元素） -->')
gen.push('<style src="./base.css"></style>')

const comp = gen.join('\n') + '\n'
/* 生成后自检：宿主私有符号必须走 props，不能靠"看着像全局"蒙过去。
   ★写法纪律：一个 `!/activePage|wsDisplayNameOf\(/` 的大正则，命中了只告诉你"有残留"，
   不告诉你**是哪一个** —— 本批第一次跑就靠它才发现了 wsDisplayNameOf 漏配。
   ⇒ 逐个符号点名，命中时报出符号名。允许清单见下。 */
/* ★清单只列**独立**符号。上一版多写了一个 `wsDisplayName`——它是 `wsDisplayNameOf` 的前缀，
   `includes` 逐字包含 ⇒ 误报（纪律 18：负锚加码也是负锚的一种错法）。 */
const HOST_ONLY_SYMS = ['activePage', 'gd', 'aiReady', 'aiEnrichIds']
/* ★口径与判据侧 `codeOnly` 对齐：先剥注释再查。
   不剥的话，本脚本自己写的头注释（「activePage 在宿主，组件内取不到…」）
   会把这条守门打红——上一批刚为此立过一条纪律（B4 老坑：注释里复述被禁字面量）。 */
const compCode = comp.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
for (const s of HOST_ONLY_SYMS) {
  if (s === 'wsDisplayNameOf') {
    /* 这个符号本批走 props ⇒ 允许出现在 defineProps 那一行与模板调用处，
       但**不允许**出现在子域自己定义一份的实现里。 */
    const defs = compCode.split('\n').filter(l => /function\s+wsDisplayNameOf|const\s+wsDisplayNameOf\s*=/.test(l))
    must(defs.length === 0, '子域自己定义了一份 wsDisplayNameOf（应走 props）')
    continue
  }
  must(!compCode.includes(s), '组件里残留宿主私有符号：' + s)
}
must(comp.includes('<div class="gs-panel">'), '组件缺 gs-panel 外壳')
must(comp.includes(':shortcuts-url=' + Q + 'shortcutsUrl' + Q) === false, '接线不该出现在组件内')

if (DRY) {
  console.log('--dry：段边界核对通过，不落盘。')
  console.log('  tplShortcuts   ', tplShortcuts.length, '行（门控已摘）')
  console.log('  tplWsKeys      ', tplWsKeys.length, '行（门控已摘）')
  console.log('  jsChrome       ', jsChrome.length, '行')
  console.log('  jsAppShortcuts ', jsAppShortcuts.length, '行')
  console.log('  组件产物       ', comp.split('\n').length, '行 →', path.relative(ROOT, OUT))
  process.exit(0)
}

fs.writeFileSync(OUT, comp)
console.log('✓ 已生成组件：' + path.relative(ROOT, OUT) + '（' + comp.split('\n').length + ' 行）')

if (GEN_ONLY) { console.log('--gen-only：未改宿主。先跑 vue-tsc，验过再不带此参数重跑。'); process.exit(0) }

/* ══════════════ 四、改宿主：先删光，再插接线（只按原始行号删一次） ══════════════ */
/* 删除清单（1-based，原始行号，倒序删） */
const DEL = [
  [373, 392],   // tplWsKeys + 它的段注释（R49-I2 那行）
  [332, 371],   // tplShortcuts
  [324, 324],   // 那条被挤错位的「===== 快捷键设置 =====」段注释（本批归位）
  [1637, 1644], // jsAppShortcuts
  [853, 886],   // jsChrome
]
/* 逐段自检：每段首行必须仍等于搬走前的内容（防止行号早就漂了还硬删） */
for (const [a, b] of DEL) {
  const first = L[a - 1]
  if (b - a > 0) must(first !== undefined, '段 ' + a + '~' + b + ' 首行为空')
}
must(L[323].includes('<!-- ===== 快捷键设置 ===== -->'), '324 行不是段注释——行号已漂，先核对再重跑')
must(L[372].includes('<!-- ===== 策展台快捷键（R49-I2'), '373 行不是策展台快捷键段注释——行号已漂')
must(L[852].includes('---- 快捷键设置（H） ----'), '853 行不是快捷键段标——行号已漂')
must(L[1636].startsWith('// B7-e H3：应用内快捷键不再各写一份清单'), '1637 行不是 appShortcuts 段标——行号已漂')

const drop = new Set()
for (const [a, b] of DEL) for (let i = a; i <= b; i++) drop.add(i)
/* 连带清理：jsChrome 段前后各留一个空行，删完会留三连空行；此处只处理段内，不动段外空行归属 */
const kept = L.filter((_, i) => !drop.has(i + 1))

/* 接线：插在 export 子域那段之后（即 SettingsExportPanel 那一行后面） */
const IMPORT_LINE = "import SettingsShortcutsPanel from './settings/SettingsShortcutsPanel.vue'"
/* ★锚行写死字面量，不用 `IMPORT_LINE.replace(...)` 拼——上一版拼出的是
   `import SettingsExportPanel from './settings/SettingsShortcutsPanel.vue'`
   （只换了标识符、没换路径），`indexOf` 恒 −1。与判据侧「锚点必须回源码核」同一个坑。
   ★★两个锚必须**分区**：模板区锚 `<SettingsExportPanel v-if=`（带 v-if，模板里唯一），
   import 区锚 `import SettingsExportPanel from`（脚本里唯一）。
   上一版两处都锚在import 行上 ⇒ 模板接线被插进了 import 区，
   症状是「编译过、判据绿、只有肉眼看得见」（纪律 25：捷径越短越容易漏）。 */
const TPL_ANCHOR = '<SettingsExportPanel v-if=' + Q + 'activePage === ' + A + 'export' + A + Q
const IMPORT_ANCHOR = "import SettingsExportPanel from './settings/SettingsExportPanel.vue'"
must(!kept.some(l => l === IMPORT_LINE), '★import SettingsShortcutsPanel 已存在——上次搬移可能只完成一半，先核对宿主再重跑')
must(kept.filter(l => l.includes(TPL_ANCHOR)).length === 1, '★模板锚行不唯一或不存在（' + TPL_ANCHOR + '）')
must(kept.filter(l => l === IMPORT_ANCHOR).length === 1, '★import 锚行不唯一或不存在')

/* ★★锚点必须是「整块标签的闭合行之后」，不能是开标签所在行。
   实测：宿主那行是 `<SettingsExportPanel v-if=... ref="exportRef"`——**开标签**，
   props 与 /> 在下一行。插在它"后面"= 插进了标签属性区 ⇒
   注释被当成 props（TS2345 说 `'<!'` 不是合法 prop）、后续 `activePage` 全部串成字符串比较（TS2367）。
   ⇒ 从开标签往下找第一个含 `/>` 的行，插在它**之后**。 */
const anchorOpen = kept.findIndex(l => l.includes(TPL_ANCHOR))
must(anchorOpen >= 0, '★模板锚行没找到')
let anchor = -1
for (let i = anchorOpen; i < Math.min(anchorOpen + 5, kept.length); i++) {
  if (kept[i].includes('/>')) { anchor = i; break }
}
must(anchor > 0, '★模板锚块未在 5 行内闭合——接线会插进标签属性区')

const TPL_WIRE = [
  '',
  '      <!-- ===== 快捷键设置 =====（V3.8.42 P0-3 第五批：已拆为 settings/SettingsShortcutsPanel.vue，',
  '           含「快捷键设置」与「策展台快捷键」两个 gs-panel、chrome.commands 动态拉取、',
  '           wsMod 切台修饰键下拉与 appShortcuts（经 shortcuts.ts 派生）。',
  '           shortcutsUrl 继续由宿主传入（extension 子域共用同一份）。',
  '           判据锚：R49-26/R50-F8 命令表动态拉取、R69-4 键位随偏好派生、H1 策展台映射、',
  '           H3-4 回落值与生效值一致、B7-e H3 三处同源 —— 均走 read() 聚合层可命中） -->',
  '      <SettingsShortcutsPanel v-if=' + Q + 'activePage === ' + A + 'shortcuts' + A + Q,
  '        :shortcuts-url=' + Q + 'shortcutsUrl' + Q,
  '        :ws-display-name-of=' + Q + 'wsDisplayNameOf' + Q + ' />',
]
kept.splice(anchor + 1, 0, ...TPL_WIRE)

const importAt = kept.findIndex(l => l === IMPORT_ANCHOR)
must(importAt >= 0, '★import 锚行没找到')
kept.splice(importAt + 1, 0, IMPORT_LINE)

fs.writeFileSync(HOST, kept.join('\n'))
console.log('✓ 宿主已改：' + kept.length + ' 行（原 ' + L.length + ' 行）')

/* ══════════════ 五、搬后自检（把「以为搬对了」变成可查的事实） ══════════════ */
const now = fs.readFileSync(HOST, 'utf8').split('\n')
must(!now.some(l => l.includes('activePage === ' + A + 'shortcuts' + A + ' class=' + Q + 'gs-panel')), '宿主仍有 shortcuts 的裸面板')
must(!now.some(l => l.includes('chrome.commands.getAll')), '宿主仍留着 chrome.commands.getAll')
must(!now.some(l => l.includes('const appShortcuts = computed')), '宿主仍留着 appShortcuts')
must(!now.some(l => l.includes('function modLabel()')), '宿主仍留着 modLabel')
must(now.some(l => l.trim() === '<SettingsShortcutsPanel v-if=' + Q + 'activePage === ' + A + 'shortcuts' + A + Q), '模板接线未落盘（trim 后逐字比对）')
must(now.some(l => l === IMPORT_LINE), 'import 未落盘')
/* ★接线必须落在模板区（<template> 与 <script setup> 之间），不能落进 import 区。
   上一版两处都锚在 import 行上 ⇒ 模板块整块插到 import 列表中间；
   vue-tsc / build / 判据全绿，只有肉眼看得见（纪律 25）。 */
/* ★上界取「第一个 <script setup」，而不是第一个 </template>——
   模板里嵌着 `<option>`/`<span>` 等成对标签，但 `</template>` 只应出现一次；
   用 trim()==='</template>' 抓第一个出现的写法在实测中命中了别处（判据自身也会骗自己）。
   更稳的判法：接线必须落在**导航 <div> 之后**——那才是设置页内容区的位置。 */
const sctStart = now.findIndex(l => l.includes('<script setup'))
must(sctStart > 0, '宿主找不到 <script setup> 边界')
const tplWireAt = now.findIndex(l => l.includes("<SettingsShortcutsPanel"))
must(tplWireAt > 0 && tplWireAt < sctStart, '模板接线落到了 <script setup> 之后（实际第 ' + (tplWireAt + 1) + ' 行，<script setup> 起于第 ' + (sctStart + 1) + ' 行）')
/* 再钉一条：接线必须夹在设置页导航段与内容段之间（宿主第 1~40 行是 gs-page/gs-nav 骨架） */
must(tplWireAt > 40, '模板接线落到了导航骨架区（实际第 ' + (tplWireAt + 1) + ' 行）')
console.log('✓ 搬后自检通过（宿主零残留 + 接线在模板区内第 ' + (tplWireAt + 1) + ' 行 + import 在位）')