// P0-3 第四批 · 拆 SettingsExportPanel（导出数据子域）
// 用法：node scripts/archive/move-export-subdomain.cjs [--dry] [--gen-only]
//
// 结构与 import 那支同源，但有三处 export 特有的坑，脚本里逐条标注：
//  ① 模板段有两处 activePage === 'export'（面板 + DataCheckupCard 挂载）——
//     组件内取不到 activePage，挂载那处的 v-if 必须一并摘掉（上一批 ResetPanel 无此情况）。
//  ② watch(activePage, p => p === 'export' && refreshAssetStats()) 不能搬——
//     那是**导航生命周期**，属于宿主；搬进子组件就变成组件内的 props 监听，
//     语义从"切到导出页"变成"宿主传进来的值变了"，且组件是 v-if 挂载的，等价但绕。
//     处置：子组件自己在 onMounted 里 refreshAssetStats()，宿主那行删掉。
//  ③ downloadFile / dateStr 由 import 子域共用，**真源留在本组件**、import 那边走 props。

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const VUE = path.join(ROOT, 'src/newtab/views/GlobalSettings.vue')
const OUT = path.join(ROOT, 'src/newtab/views/settings/SettingsExportPanel.vue')
const DRY = process.argv.includes('--dry')
const GEN_ONLY = process.argv.includes('--gen-only')
const NL = String.fromCharCode(10)

const hostLines = fs.readFileSync(VUE, 'utf8').split(NL)

const SEG = {
  tplPanel: [370, 452],   // 注释行 + <div v-if="activePage === 'export'"> … </div>
  jsAssets: [809, 851],   // 附件统计 + 孤儿清理（不含末尾那条 watch）
  jsPack: [853, 919],     // 附件包 zip 导出/导入 + 备份提醒开关
  jsExport: [1277, 1434], // 导出四路 + csvEscape（不含 downloadFile / dateStr 两行，脚本里滤掉）
  cssExport: [2329, 2333], // .gs-export-row / .gs-er-*（gs-switch 已并入 base.css：两子域共用）
}

function seg(a, b, name, headRe, tailRe) {
  const out = hostLines.slice(a - 1, b)
  const head = out[0].trim()
  const tail = out[out.length - 1].trim()
  if (headRe && !headRe.test(head)) throw new Error(name + ' 段首(' + a + ')形态不符：' + head.slice(0, 60))
  if (tailRe && !tailRe.test(tail)) throw new Error(name + ' 段尾(' + b + ')形态不符：' + tail.slice(0, 60))
  return out
}

function need(hay, needle, where) {
  if (hay.indexOf(needle) < 0) throw new Error(where + ' 缺：' + needle)
}

function dedent(s) {
  const arr = s.split(NL)
  const pads = arr.filter(l => l.trim()).map(l => l.match(/^[ \t]*/)[0].length)
  const min = Math.min.apply(null, pads)
  return arr.map(l => (l.trim() ? l.slice(min) : '')).join(NL)
}

// ---------- 模板 ----------
const panelLines = seg(SEG.tplPanel[0], SEG.tplPanel[1], 'export 面板',
  /^<!-- ===== 导出数据 ===== -->$/, /^<\/div>$/)
const shellRe = /^\s*<div v-if="activePage === 'export'" class="gs-panel">\s*$/
const shellAt = panelLines.findIndex(l => shellRe.test(l))
if (shellAt < 0) throw new Error('export 面板外壳行未找到，首行是：' + panelLines[0].trim())
const shellOuter = panelLines[shellAt].replace(/^\s*/, '').replace(/^<div v-if="activePage === 'export'" /, '<div ').trim()
if (shellOuter !== '<div class="gs-panel">') throw new Error('外壳摘 v-if 后形态不符：' + shellOuter)

// ★① DataCheckupCard 那行也带 activePage === 'export'，组件内取不到，一并摘成恒真
let tplBody = dedent(panelLines.slice(shellAt + 1, -1).join(NL))
const CHECKUP_OLD = '<DataCheckupCard v-if="activePage === \'export\'" />'
if (tplBody.indexOf(CHECKUP_OLD) < 0) throw new Error('模板缺 DataCheckupCard 挂载行')
tplBody = tplBody.replace(CHECKUP_OLD, '<DataCheckupCard />')
const tplFull = [shellOuter, tplBody, '</div>'].join(NL)
need(tplFull, '附件存储', '模板')
need(tplFull, '备份提醒', '模板')

// ---------- 脚本 ----------
const jsAssets = seg(SEG.jsAssets[0], SEG.jsAssets[1], '附件统计段', /^\/\/ ---- REQ-048/, /^\}$/).join(NL)
for (const n of ['const assetCount', 'const assetBytes', 'async function refreshAssetStats',
  'async function cleanupOrphanAssetsAction', 'async function exportAssetPack' === '' ? '' : 'listOrphanAssetIds(',
  'await useConfirm({', 'cleanupOrphanAssetsOf(all)']) need(jsAssets, n, '附件统计段')
// R4-Dc：起点在本段、终点在**下一段**（附件包段）。聚合读取是整目录拼接，
// 两段在产物里仍然首尾相接且顺序不变 ⇒ fnBody 切片照旧成立。
// ★所以这里校验的是「两段拼起来后顺序对」，不是「终点必须在本段内」——
//   我第一版误以为终点必须同段，写成硬断言后脚本直接抛错（V3.8.42 第四批）。
need(jsAssets, 'async function cleanupOrphanAssetsAction', 'R4-Dc 起点锚')

const jsPack = seg(SEG.jsPack[0], SEG.jsPack[1], '附件包段', /^\/\/ ---- 第卌二轮 REQ-059/, /^\}$/).join(NL)
need(jsPack, 'async function exportAssetPack', 'R4-Dc 终点锚')
for (const n of ['async function exportAssetPack', 'async function handleAssetPackImport',
  'backupReminderEnabled', 'function markBackupNow', 'function formatBackupAgo']) need(jsPack, n, '附件包段')

// ★downloadFile / dateStr 两行**不搬进本组件**——它们连同 import 子域那份一起进了
//   settings/io-utils.ts（两个子域共用，props 双向传会形成环）。这里先切全段再删那两行。
const jsExportRaw = seg(SEG.jsExport[0], SEG.jsExport[1], '导出段', /^\/\/ ---- 导出 ----$/, /^\}$/)
const ioStart = jsExportRaw.findIndex(l => l.startsWith('function downloadFile('))
const ioEnd = jsExportRaw.findIndex(l => l.startsWith('function dateStr('))
if (ioStart < 0 || ioEnd < 0) throw new Error('导出段里找不到 downloadFile / dateStr')
// ★downloadFile 是**多行**函数：只删首行会剩下一个孤零零的函数体，
//   产物报 TS1128（V3.8.42 第四批实测）。要按**配平**删到收尾 } 为止。
let ioClose = ioStart
let depth = 0
for (let i = ioStart; i < jsExportRaw.length; i++) {
  for (const ch of jsExportRaw[i]) { if (ch === '{') depth++; else if (ch === '}') depth-- }
  if (depth === 0) { ioClose = i; break }
}
if (ioClose <= ioStart) throw new Error('downloadFile 括号未配平，ioClose=' + ioClose)
// dateStr 是**单行**函数（声明与体同行），位置在 ioClose 之后 ⇒ 单独删那一行。
const jsExport = jsExportRaw.filter((_, i) => i < ioStart || (i > ioClose && i !== ioEnd)).join(NL)
if (jsExport.indexOf('const blob = new Blob') >= 0) throw new Error('downloadFile 函数体没删干净')
if (jsExport.indexOf('function dateStr') >= 0) throw new Error('dateStr 没删掉')
// ★async 不能想当然：导出四路里**只有 exportAll 是 async**（它 await loadUIPrefs），
//   另三个是同步的。写错 async 前缀的自检会假红（V3.8.42 第四批实测）。
// downloadFile / dateStr 已移交给 io-utils.ts，不再要求出现在本段
for (const n of ['async function exportAll',
  'function exportWorkspace', 'function exportCsvForWorkspace', 'function exportMarkdown',
  'function csvEscape']) need(jsExport, n, '导出段')
// R4-Dg 的两个锚（上一批已重指）
need(jsExport, 'function exportMarkdown', 'R4-Dg 起点锚')
need(jsExport, 'function csvEscape', 'R4-Dg 终点锚')
// P0-2-1b 依赖 import 子域的 mergeImport 终点锚，本段不得出现它
if (jsExport.indexOf('function mergeImport') >= 0) throw new Error('导出段混进了 mergeImport，边界切错')

// ---------- 样式 ----------
// 单行规则（选择器与声明同行、收尾 } 在行尾）——tail 不能要求 } 独占一行
const cssExport = seg(SEG.cssExport[0], SEG.cssExport[1], 'export 样式',
  /^\.gs-export-row \{/, /^\.gs-er-desc \{.*\}$/).join(NL)
need(cssExport, '.gs-er-name', 'export 样式')

console.log('✔ 模板 ' + SEG.tplPanel[0] + '-' + SEG.tplPanel[1] + '（' + tplFull.split(NL).length + ' 行）')
console.log('✔ 附件统计 ' + SEG.jsAssets[0] + '-' + SEG.jsAssets[1] + '（' + jsAssets.split(NL).length + ' 行）')
console.log('✔ 附件包 ' + SEG.jsPack[0] + '-' + SEG.jsPack[1] + '（' + jsPack.split(NL).length + ' 行）')
console.log('✔ 导出段 ' + SEG.jsExport[0] + '-' + SEG.jsExport[1] + '（' + jsExport.split(NL).length + ' 行）')
console.log('✔ 样式 ' + SEG.cssExport[0] + '-' + SEG.cssExport[1])
if (DRY) { console.log(NL + '[dry] 未写盘'); process.exit(0) }

// ---------- 生成子组件 ----------
const comp = [
  '<script setup lang="ts">',
  '/**',
  ' * 导出数据子域（V3.8.42 P0-3 第四批，从 GlobalSettings.vue 搬出）',
  ' *',
  ' * ★宿主接线：<SettingsExportPanel v-if="activePage === \'export\'" />',
  ' *   v-if 与面板外壳上的 v-if 都归宿主——本页的显隐由导航决定。',
  ' *',
  ' * ★downloadFile / dateStr 的真源在本组件（导出四路 + 附件包 zip 都用），',
  ' *   import 子域那边通过 props 拿同一个函数引用，两边共用一份口径。',
  ' *',
  ' * ★formatBytes / wsDisplayNameOf 走 props：前者与 AboutPanel 那份是逐字等价副本',
  ' *   （改一个阈值会让「附件占用」与「数据存储」两处读数不一致），后者是纯工具函数。',
  ' *',
  ' * ★原先宿主里那条 watch(activePage, p => p === \'export\' && refreshAssetStats())',
  ' *   **没有搬过来**：那是导航生命周期，属于宿主。本组件用 onMounted 触发——',
  ' *   组件是 v-if 挂载的，挂载即"切到导出页"，语义等价且少一层依赖。',
  ' */',
  "import { ref, computed, onMounted } from 'vue'",
  "import { useAppStore } from '../../stores/app'",
  "import { showToast } from '@/shared/components/toast'",
  "import { useConfirm } from '@/shared/components/confirm'",
  "import { saveUIPrefs, loadUIPrefs } from '@/shared/storage/repository'",
  "import { getAssetStats, cleanupOrphanAssetsOf, collectReferencedAssetIds, listOrphanAssetIds, getAllAssets, putAssets } from '@/shared/storage/assets'",
  "import { buildZip, readZip, type ZipEntry } from '@/shared/utils/zip'",
  "import { EXPORT_MARKERS } from '@/shared/storage/keys'",
  "import { wsNameById } from '@/shared/utils/wsName'",
  "import { visibleFields, allFields } from '@/shared/utils/fields'",
  "import { assetSummary } from '@/shared/utils/assetKind'",
  "import { isHubWs, boardCardsOf, isMirrorView } from '@/shared/storage/hub'",
  "import { catPathOf } from '@/shared/storage/airtable'",
  "import { downloadFile, dateStr } from './io-utils'",
  "import Icon from '@/shared/components/Icon.vue'",
  "import DataCheckupCard from '../../components/DataCheckupCard.vue'",
  "import type { AppData, ResourceCard } from '@/shared/models'",
  '',
  'const { formatBytes, wsDisplayNameOf } = defineProps<{',
  '  /** 与 AboutPanel 那份逐字等价（附件占用 / 数据存储 两处读数必须一致） */',
  '  formatBytes: (n: number) => string',
  '  /** 显示名工具 */',
  '  wsDisplayNameOf: (w: { id: string; name: string; icon: string }) => string',
  '}>()',
  '',
  'const store = useAppStore()',
  '',
  '/** 宿主 gd = computed(() => store.data!) 的等价物：store 是单例，本组件自己算一份即可 */',
  'const gd = computed(() => store.data!)',
  '',
  jsAssets,
  '',
  jsPack,
  '',
  jsExport,
  '',
  '/** 附件统计：本组件挂载即"切到导出页"（宿主 v-if 控制），替代原宿主那条 watch */',
  'onMounted(refreshAssetStats)',
  '',
  '/** 导入页那枚 zip input 要用的解包写回实现——它住在本组件（附件包 zip 段），',
  ' *  但两个子域不能互相 import（会成环），故 expose 出去由宿主中转。 */',
  'defineExpose({ handleAssetPackImport })',
  '</' + 'script>',
  '',
  '<template>',
  tplFull,
  '</' + 'template>',
  '',
  '<style src="./base.css"></' + 'style>',
  '',
  '<style scoped>',
  '/* 以下规则由 move-export-subdomain.cjs 从宿主样式段逐行切出，未重打一字 */',
  cssExport,
  '</' + 'style>',
  '',
].join(NL)
fs.writeFileSync(OUT, comp)
console.log(NL + '✔ 已写 ' + path.relative(ROOT, OUT) + '（' + comp.split(NL).length + ' 行）')
if (GEN_ONLY) {
  console.log('[gen-only] 宿主未改动（组件已生成，先用 vue-tsc 验它能编译）')
  process.exit(0)
}

// ---------- 改宿主：先删光，再插接线 ----------
const drop = new Set()
for (const k of Object.keys(SEG)) for (let i = SEG[k][0]; i <= SEG[k][1]; i++) drop.add(i)
// downloadFile 整个函数区 + dateStr 单行（真源已迁 settings/io-utils.ts）
for (let i = ioStart; i <= ioClose; i++) drop.add(SEG.jsExport[0] + i)
drop.add(SEG.jsExport[0] + ioEnd)
// 宿主那条 watch(activePage, …export…) 一并删（职责移交子组件的 onMounted）
const watchLine = hostLines.findIndex(l => l.trim() === "watch(activePage, (p) => { if (p === 'export') refreshAssetStats() })")
if (watchLine < 0) throw new Error('宿主那条 export watch 未找到（位置变了？）')
drop.add(watchLine + 1)
// 宿主 onMounted 里的深链分支
const mountedLine = hostLines.findIndex(l => /if \(activePage\.value === 'export'\) refreshAssetStats\(\)/.test(l))
if (mountedLine < 0) throw new Error('宿主 onMounted 深链那行未找到')
drop.add(mountedLine + 1)

const arr = hostLines.filter((_, i) => !drop.has(i + 1))

const shortcutTrim = '<div v-if="activePage === \'shortcuts\'" class="gs-panel">'
const scAt = arr.findIndex(l => l.trim() === shortcutTrim)
if (scAt < 0) throw new Error('宿主模板锚未找到：shortcuts 面板那行')
const ind = arr[scAt].match(/^[ \t]*/)[0]
arr.splice(scAt, 0,
  ind + '<!-- ===== 导出数据 =====（V3.8.42 P0-3 第四批：已拆为 settings/SettingsExportPanel.vue，',
  ind + '     连带附件统计 / 孤儿清理 / 附件包 zip / 备份提醒 / 导出四路 与 export-row、er-* 样式随迁。',
  ind + '     downloadFile 与 dateStr 的真源随之迁入本子域，import 子域改为 props 取同一份引用。',
  ind + '     判据锚：R42-15/16 附件包、R39-12 附件存储入口、R46-5 存量归属修复、R95-1 uiPrefs 并段、',
  ind + '     R110-B2-2 csvWsId 软删过滤、R171-3 数据体检卡挂载 —— 均走 read() 聚合层可命中） -->',
  ind + '<SettingsExportPanel v-if="activePage === \'export\'" ref="exportRef"',
  ind + '  :format-bytes="formatBytes" :ws-display-name-of="wsDisplayNameOf" />')

// 锚在 SettingsExtensionPanel 那行（一定存在）。★不要锚在 SettingsImportPanel——
//   两个子域的搬移脚本各跑一次，先后顺序不定，被锚的那次可能对方还没搬。
const importAnchor = "import SettingsExtensionPanel from './settings/SettingsExtensionPanel.vue'"
const importNew = "import SettingsExportPanel from './settings/SettingsExportPanel.vue'"
const impAt = arr.findIndex(l => l === importAnchor)
if (impAt < 0) throw new Error('宿主 import 锚未找到：SettingsExtensionPanel 那行')
if (arr.some(l => l === importNew)) throw new Error('★import SettingsExportPanel 已存在——上次搬移可能只完成一半，先核对宿主再重跑')
arr.splice(impAt + 1, 0, importNew)

fs.writeFileSync(VUE, arr.join(NL))
console.log('✔ 宿主 ' + hostLines.length + ' → ' + arr.length + ' 行（删 ' + drop.size + ' 行 + 插 7 行接线）')
