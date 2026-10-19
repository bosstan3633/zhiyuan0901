// P0-3 第四批 · 拆 SettingsImportPanel（导入数据子域）
// 用法：node scripts/archive/move-import-subdomain.cjs [--dry]
//
// 为什么用脚本切而不用手抄：前几批手抄 CSS 连续出过四次错（类名写错、注释闭合、缩进漂移），
// 每一处都要靠实拍才发现。这里一律按行号从原文切，产物与被搬走的字节逐字一致。
//
// 边界自检必须"取错就抛错"：V3.8.42 第三批切错行号两次，一次少 1 行导致括号不配平，
// 一次正则漏缩进容差导致 findIndex 恒 -1。两次都被守门接住，本批继续沿用。
//
// ★顺序纪律（本脚本第一版就踩了）：**先按行号一次性删光所有段，再插接线**。
//   反过来（先插接线再按行号删）会让后面的行号全部漂移；第一版为了绕开这点又加了
//   "按内容二次定位"，结果引入了行内容重复匹配的风险。删在前、插在后，只有一个真相源。

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const VUE = path.join(ROOT, 'src/newtab/views/GlobalSettings.vue')
const OUT = path.join(ROOT, 'src/newtab/views/settings/SettingsImportPanel.vue')
const DRY = process.argv.includes('--dry')
// ★--gen-only：只生成子组件、不动宿主。搬移必须分两步走——
//   先写组件、用 vue-tsc 验它能编译，再改宿主。合成一步的话，
//   组件有语法错时宿主已经被拆完，回滚要靠 git（V3.8.42 第四批实测踩到）。
const GEN_ONLY = process.argv.includes('--gen-only')
const NL = String.fromCharCode(10)
const Q = String.fromCharCode(39)

const hostLines = fs.readFileSync(VUE, 'utf8').split(NL)

const SEG = {
  tplPanel: [322, 368],
  jsTop: [876, 943],
  jsMerge: [949, 1087],
  jsPending: [1538, 1545],
  cssImport: [1978, 1983],
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
const panelLines = seg(SEG.tplPanel[0], SEG.tplPanel[1], 'import 面板',
  /^<!-- ===== 导入数据 ===== -->$/, /^<\/div>$/)
// 外壳行用**字面量正则**而不是字符串拼接：属性值两侧是双引号、内层才是单引号，
// 拼接时把两者搞混过一次（V3.8.42 第四批实测：正则能构造出来但恒不匹配，
// 症状是 findIndex 返 -1 而看不出构造错了）。
const shellRe = /^\s*<div v-if="activePage === 'import'" class="gs-panel">\s*$/
const shellAt = panelLines.findIndex(l => shellRe.test(l))
if (shellAt < 0) throw new Error('import 面板外壳行未找到，首行是：' + panelLines[0].trim())
// ★面板外壳 `<div class="gs-panel">` **随组件走**（v-if 提到宿主调用处，外壳留在组件内）。
//   第一版把外壳也剥了，组件根直接是 .gs-page-header ⇒ 页面上没有 .gs-panel，
//   实拍报「标题=导入数据 panel=false」——标题在、面板不在，看起来像"没渲染"，
//   实际整页好好地渲染着，只是少了那层壳。与上一批 ResetPanel 的做法保持一致。
// 外壳随组件走，但**壳上的 v-if 要摘掉**——activePage 在宿主，组件内取不到，
// 留着会编译失败（build 报 v-if 表达式引用未定义变量）。
// 显隐由宿主调用处的 v-if 承担，与上一批 ResetPanel 同一形态。
// 只摘 v-if 那一段，别把整行（含缩进与 class）一起替换掉——
// shellRe 锚的是整行，整体 replace 会连 <div class="gs-panel"> 一起清空。
const shellOuter = panelLines[shellAt]
  .replace(/^\s*/, '')
  .replace(/^<div v-if="activePage === 'import'" /, '<div ')
  .trim()
if (shellOuter !== '<div class="gs-panel">') throw new Error('外壳摘 v-if 后形态不符：' + shellOuter)
let tplBody = [shellOuter, dedent(panelLines.slice(shellAt + 1, -1).join(NL)), '</div>'].join(NL)
need(tplBody, 'ref="bookmarkInput"', '模板')
// 附件包那枚 input 的 change 改为 emit：实现随「导出数据」子域搬走了，
// 而驱动它的是本页这枚 input。两个子域不能互相 import（会成环），
// 唯一不环的路径是 emit 给宿主、宿主转交给 export 的 expose。
const PACK_OLD = '@change="handleAssetPackImport"'
if (tplBody.indexOf(PACK_OLD) < 0) throw new Error('模板里找不到附件包 input 的 change')
tplBody = tplBody.replace(PACK_OLD, '@change="emit(\'asset-pack\', $event)"')
if (tplBody.indexOf('handleAssetPackImport') >= 0) throw new Error('模板里还残留 handleAssetPackImport')

// ---------- 脚本 ----------
const jsTop = seg(SEG.jsTop[0], SEG.jsTop[1], 'import 脚本上段', /^\/\/ ---- 导入 ----$/, /^\}$/).join(NL)
for (const n of ['const fileInput', 'const assetPackInput', 'function handleFileImport',
  'function triggerFileImport', 'async function onBookmarkFile', 'downloadFile(']) need(jsTop, n, 'jsTop')

const jsMerge = seg(SEG.jsMerge[0], SEG.jsMerge[1], 'mergeImport',
  /^function mergeImport\(imported: AppData\)/, /^\}$/).join(NL)
// P0-2-1b 的切片终点锚：搬走前必须确认它在本段内（判据靠它收口）
for (const n of ['normalizeLegacyCards(d)', 'return { cards: cardsAdded']) need(jsMerge, n, 'mergeImport')

const jsPending = seg(SEG.jsPending[0], SEG.jsPending[1], 'pendingImportEnrich', null, /^\}$/).join(NL)
for (const n of ['const pendingImportEnrich', 'function aiImportEnrichNow']) need(jsPending, n, 'pendingImportEnrich 段')

// ---------- 样式 ----------
// ★样式段是**单行规则**（选择器与声明同一行、收尾 } 在行尾），
//   不能用 /^\}$/ 这种要求 } 独占一行的判据——用了就会在真源上假红。
const cssImport = seg(SEG.cssImport[0], SEG.cssImport[1], 'import 样式',
  /^\.gs-import-option \{/, /\.gs-io-btn \{.*\}$/).join(NL)
need(cssImport, '.gs-io-btn', 'import 样式')

// .gs-file-hidden 已在共享基类 settings/base.css（V3.8.42 第三批外提时带过去的），
// 本子域引 base.css 即生效，无需再搬一次。搬第二次就是「同一个类两处定义」。
const CSS_FILE_HIDDEN_NOTE = '/* .gs-file-hidden 由 base.css 提供（共享基类，第三批外提），此处不重复定义 */'

console.log('✔ 模板 ' + SEG.tplPanel[0] + '-' + SEG.tplPanel[1] + '（面板体 ' + tplBody.split(NL).length + ' 行）')
console.log('✔ 脚本上段 ' + SEG.jsTop[0] + '-' + SEG.jsTop[1] + '（' + jsTop.split(NL).length + ' 行）')
console.log('✔ mergeImport ' + SEG.jsMerge[0] + '-' + SEG.jsMerge[1] + '（' + jsMerge.split(NL).length + ' 行）')
console.log('✔ pendingImportEnrich ' + SEG.jsPending[0] + '-' + SEG.jsPending[1])
console.log('✔ 样式 ' + SEG.cssImport[0] + '-' + SEG.cssImport[1] + '（file-hidden 已在 base.css）')
if (DRY) { console.log(NL + '[dry] 未写盘'); process.exit(0) }

// ---------- 生成子组件 ----------
// 刻意用数组 join 而非模板串：被搬进来的源码含大量模板串插值，
// 写进模板字面量会被当场求值（V3.8.42 第四批第一版实测，连错两次）
// ★import 行一律用双引号字面量，不用引号拼接：第一版用 Q（单引号字符）拼双引号，
// 写出的是两对单引号，产物里每条 import 都变成 ''...''，vue-tsc 报 TS1005 一片
// （V3.8.42 第四批实测）。引号交给语言本身，自己拼。
const comp = [
  '<script setup lang="ts">',
  '/**',
  ' * 导入数据子域（V3.8.42 P0-3 第四批，从 GlobalSettings.vue 搬出）',
  ' *',
  ' * ★宿主接线：<SettingsImportPanel v-if="activePage === ' + Q + 'import' + Q + '" />',
  ' *   v-if 在宿主——本组件只管「导入」这一页的内部结构，面板显隐归宿主。',
  ' *',
  ' * ★downloadFile / dateStr 不走 props、也不复制：它们与导出子域共用，已一并抽进',
  ' *   settings/io-utils.ts（两个子域都要用；props 双向传会成环，复制会造出第二个',
  ' *   「文件下载」口径，而口径分叉是这类工具函数的典型死法）。',
  ' *',
  ' * ★aiEnrichIds 走 props 而不把 AI 段一起搬过来：它属于 AI 子域（宿主 1894 行起，牵连',
  ' *   aiConfig/aiGuard/aiCatVocab 一整套），跟导入链路只是「书签导入完想批量补全」一个调用点。',
  ' *   aiReady 同理：由宿主 AI 配置派生，本页只读它决定那颗钮能不能点。',
  ' */',
  // ★import 路径必须与宿主**逐字一致**（含 @/newtab/ 这种从 src 起的别名写法），
  //   不能"看着像"就改写——第一版把 useBookmarkImport 写成 @/composables/… 就编译不过。
  "import { ref, computed } from 'vue'",
  "import { useAppStore } from '../../stores/app'",
  "import { showToast } from '@/shared/components/toast'",
  "import { saveUIPrefs, normalizeLegacyCards, stripRetiredCardKeys } from '@/shared/storage/repository'",
  "import { useBookmarkImport } from '@/newtab/composables/useBookmarkImport'",
  "import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'",
  "import { sanitizeCardCols } from '@/shared/utils/cardCols'",
  "import { sanitizeWsView } from '@/shared/utils/wsView'",
  "import { resolveTheme } from '@/shared/utils/theme'",
  "import { sanitizeThesisDuplicates } from '@/shared/storage/hub'",
  "import { freshTagsOf, canonicalTagsOf } from '@/shared/utils/tags'",
  "import { DEFAULT_TAG_COLUMN } from '@/shared/storage/airtable'",
  "import Icon from '@/shared/components/Icon.vue'",
  "import { downloadFile, dateStr } from './io-utils'",
  "import { defaultThesisFieldDefs } from '@/shared/storage/defaults'",
  "import { dateKey, weekStartKey } from '@/shared/utils'",
  "import type { AppData, ResourceCard, TaskCard, CuriosityCard, ID } from '@/shared/models'",
  '',
  // ★defineProps 的返回值要么解构、要么整体用 props.x —— 只声明不取用，
  //   模板与脚本里那个名字就是"未定义"（vue-tsc 报 TS2304）。
  //   这里解构：这些符号在本子域被直接调用，不带 props. 前缀更贴近原宿主写法。
  'const { aiReady, aiEnrichIds, wsDisplayNameOf } = defineProps<{',
  '  /** AI 是否已接入（决定「归类并补全这批」那颗钮能不能点） */',
  '  aiReady: boolean',
  '  /** 宿主的批量补全入口（AI 子域，不随本子域搬） */',
  '  aiEnrichIds: (ids: Set<string>) => void',
  '  /** 显示名工具，用于「书签导入到」下拉 */',
  '  wsDisplayNameOf: (w: { id: string; name: string; icon: string }) => string',
  '}>()',
  '',
  '/** 附件包 zip 的解包写回实现住在**导出子域**，驱动它的是本页那枚 accept=".zip" 的 input。',
  ' *  ★走 emit 而不是 props：export 组件不能被 import 组件 import（会成环），',
  ' *  而 props 方向是「宿主 → 子组件」，宿主此刻并没有这个函数（它随 export 搬走了）。',
  ' *  ⇒ 唯一不环的路径是：input 事件 emit 给宿主，宿主转交给 export 组件的 expose。 */',
  "const emit = defineEmits<{ (e: 'asset-pack', ev: Event): void }>()",
  '',
  'const store = useAppStore()',
  '',
  jsTop,
  '',
  jsMerge,
  '',
  jsPending,
  '</' + 'script>',
  '',
  '<template>',
  tplBody,
  '</' + 'template>',
  '',
  '<style src="./base.css"></' + 'style>',
  '',
  '<style scoped>',
  '/* 以下规则由 move-import-subdomain.cjs 从宿主样式段逐行切出，未重打一字 */',
  cssImport,
  '',
  CSS_FILE_HIDDEN_NOTE,
  '</' + 'style>',
  '',
].join(NL)
fs.writeFileSync(OUT, comp)
console.log(NL + '✔ 已写 ' + path.relative(ROOT, OUT) + '（' + comp.split(NL).length + ' 行）')

// ---------- 改宿主：先删光，再插接线 ----------
const drop = new Set()
for (const [a, b] of Object.keys(SEG).map(k => SEG[k])) for (let i = a; i <= b; i++) drop.add(i)
const arr = hostLines.filter((_, i) => !drop.has(i + 1))

// 接线 1：模板里挂组件（插在 SettingsResetPanel 之前，按同缩进对齐）
// 接线锚一律用**字面量**而不是拼接：模板里属性值是双引号、内层是单引号，
// 拼接时漏掉一个引号就会得到一个"看起来对"的字符串而恒不匹配（V3.8.42 第四批实测）。
const resetTrim = '<SettingsResetPanel v-if="activePage === \'reset\'" />'
const resetAt = arr.findIndex(l => l.trim() === resetTrim)
if (resetAt < 0) throw new Error('宿主模板锚未找到：' + resetTrim)
const ind = arr[resetAt].match(/^[ \t]*/)[0]
arr.splice(resetAt, 0,
  ind + '<!-- ===== 导入数据 =====（V3.8.42 P0-3 第四批：已拆为 settings/SettingsImportPanel.vue，',
  ind + '     连带 import-option / io-* / file-hidden 五条专属样式随迁。判据锚：R42-16 assetPackInput、',
  ind + '     R110-B2-3 useBookmarkImport 握手、P0-2-1b 归一化位置、R170-3 gs-io-btn 三处按钮、',
  ind + '     R138-5 pendingImportEnrich 回执 —— 全部走 read() 聚合层，正文在 settings/ 下仍可命中） -->',
  ind + '<SettingsImportPanel v-if="activePage === ' + Q + 'import' + Q + '"',
  ind + '  :ai-ready="aiReady" :ai-enrich-ids="aiEnrichIds"',
  ind + '  :ws-display-name-of="wsDisplayNameOf"',
  ind + '  @asset-pack="onAssetPack" />')

// 接线 2：import 语句（自检查 import 本身，不查组件名——模板里已有同名标签，查名字恒真）
const importAnchor = "import SettingsExtensionPanel from './settings/SettingsExtensionPanel.vue'"
const importNew = "import SettingsImportPanel from './settings/SettingsImportPanel.vue'" 
const impAt = arr.findIndex(l => l === importAnchor)
if (impAt < 0) throw new Error('宿主 import 锚未找到：SettingsExtensionPanel 那行')
if (arr.some(l => l === importNew)) throw new Error('★import SettingsImportPanel 已存在——上次搬移可能只完成一半，先核对宿主再重跑')
arr.splice(impAt + 1, 0, importNew)

if (GEN_ONLY) {
  console.log('[gen-only] 宿主未改动（组件已生成，先用 vue-tsc 验它能编译）')
  process.exit(0)
}
// 宿主中转：import emit 上来 → 转给 export 的 expose（组件之间不直接引用）
const relayAt = arr.findIndex(l => l.trim().startsWith('const activePage = ref('))
if (relayAt < 0) throw new Error('宿主中转锚未找到：const activePage = ref(')
arr.splice(relayAt, 0,
  '/** 附件包导入的**中转**：实现随「导出数据」子域搬走了（连附件统计刷新一起），',
  ' *  而驱动它的是导入页那枚 zip input。两个子域不能互相引用（会成环），',
  ' *  所以由宿主当一次转发点：import emit → 这里 → export 的 expose。 */',
  'const exportRef = ref<{ handleAssetPackImport?: (e: Event) => void } | null>(null)',
  'function onAssetPack(e: Event) { exportRef.value?.handleAssetPackImport?.(e) }',
  '')

fs.writeFileSync(VUE, arr.join(NL))
console.log('✔ 宿主 ' + hostLines.length + ' → ' + arr.length + ' 行（删 ' + drop.size + ' 行 + 插 5 行接线）')
