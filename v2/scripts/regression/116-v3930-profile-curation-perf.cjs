/**
 * V3.9.30 · 画像年度热力图、策展台页头与发布包减重。
 *
 * 本轮三条用户可见主线：
 *   ① 今日必须高亮，年度热力图收紧纵向节奏与重复标题；
 *   ② 策展台页头按审核原型收成连续三层，布局切换与分享各只有一个入口；
 *   ③ 不删历史内容，通过消除重复加载与构建期格式压缩降低发布包体积。
 */
const {
  fs, path, base, check, read, codeOnly, CUR_VER, CUR_VTAG, VER_ANCHOR_LITERAL,
  SCRIPTS_DIR,
} = require('./helpers.cjs')

console.log('【V3.9.30 · 画像年度热力图、策展台页头与发布包减重】')

const WS = read('/newtab/views/Workspace.vue')
const WSC = codeOnly(WS)
const WSCSS = read('/newtab/views/workspace.css')
const MIND = read('/newtab/components/curation/CurationMindMap.vue')
const HEATMAP = read('/newtab/components/dashboard/Heatmap.vue')
const DASH_CSS = read('/newtab/components/dashboard/dashboard.css')
const PI_YEAR = read('/newtab/components/profile/PiYear.vue')
const PI_CSS = read('/newtab/components/profile/pi-timeline.css')
const VITE = fs.readFileSync(path.resolve(SCRIPTS_DIR, '..', 'vite.config.ts'), 'utf8')
const APP = read('/newtab/App.vue')

check('R187-1 ★策展台页头收成一个连续三层：台身份 → 中心论点主舞台 → 页面行动条；行动条不再吸附到页头之外', () => {
  const head = WSC.indexOf('<div class="ws-head">')
  const identity = WSC.indexOf('<div class="ws-id-head">', head)
  const thesis = WSC.indexOf('<div class="thesis-banner"', identity)
  const toolbar = WSC.indexOf('<div class="ws-toolbar cur-toolbar"', thesis)
  const headCss = (WSCSS.match(/\.ws-head\s*\{([^}]*)\}/) || [])[1] || ''
  const toolbarCss = (WSCSS.match(/\.ws-head\s*>\s*\.cur-toolbar\s*\{([^}]*)\}/) || [])[1] || ''
  return head >= 0 && identity > head && thesis > identity && toolbar > thesis
    && /flex-direction:\s*column/.test(headCss)
    && /gap:\s*10px/.test(headCss)
    && /position:\s*static/.test(toolbarCss)
    && /margin-top:\s*2px/.test(toolbarCss)
})

check('R187-2 ★普通视图的布局切换与分享各只有一个入口：布局在页头行动条，画布仅在全屏补位；分享固定行尾一次', () => {
  const toolbarStart = WS.indexOf('<div class="ws-toolbar cur-toolbar"')
  const mindStart = WS.indexOf('<CurationMindMap', toolbarStart)
  const toolbar = WS.slice(toolbarStart, mindStart)
  return toolbar.includes('class="cur-layout"')
    && (toolbar.match(/mind\.setLayout\('pyramid'\)/g) || []).length === 1
    && (toolbar.match(/mind\.setLayout\('tree'\)/g) || []).length === 1
    && (WSC.match(/分享成果/g) || []).length === 1
    && toolbar.includes('class="hero-btn primary share-action"')
    && toolbar.lastIndexOf('分享成果') > toolbar.lastIndexOf('class="toolbar-search"')
    && !MIND.includes('<div class="mindmap-layout"')
    && MIND.includes('<div v-if="fullscreen" class="mindmap-layout"')
})

check('R75-6（V3.9.30 重指）hub 卡片总数补充口径退役：分类 / 论据卡 / 附件读数并入页头，指标格无「镜像异常」分支', () => {
  return !WSC.includes('hubCountHint')
    && WSC.includes('<b>{{ categories.length }}</b> 个分类')
    && WSC.includes('论据卡 <b>{{ metrics.total }}</b>')
    && WSC.includes('附件 <b>{{ metrics.attachmentCount }}</b>')
})

check('R187-3 ★今日高亮不再是静默失效：状态类以空格分隔，今日格带 today / aria-current，月份标题也有「今天」标记', () => {
  return HEATMAP.includes("cells.push({ k, lv, cls: cls.join(' ') })")
    && !HEATMAP.includes("cls: cls.join('')")
    && HEATMAP.includes("if (k === today.value) cls.push('today')")
    && HEATMAP.includes(':aria-current="c.k === today ? \'date\' : undefined"')
    && HEATMAP.includes('class="dz-month-today"')
    && DASH_CSS.includes('.dz-cell.today::before')
    && DASH_CSS.includes('border: 1.5px solid var(--accent)')
    && DASH_CSS.includes('.dz-cell.today.l0')
    && DASH_CSS.includes('.dz-month-today')
})

check('R187-4 ★画像年度段更紧凑且不再重复标题：编号并入热力图页头，外层第二标题与第二套色阶图例已移除', () => {
  const yearShell = PI_YEAR.slice(PI_YEAR.indexOf('<div class="pi-hmbox">'), PI_YEAR.indexOf('<div id="lc-sec">'))
  const yearCss = (PI_CSS.match(/#mod-year \.pi-mod-b\s*\{([^}]*)\}/) || [])[1] || ''
  return PI_YEAR.includes(':show-legend-note="false"')
    && PI_YEAR.includes(':section-number="1"')
    && !yearShell.includes('class="pi-sect"')
    && !yearShell.includes('class="pi-hm-legend"')
    && PI_CSS.includes('.pi-hmbox .dz-year { min-width: 900px; gap: 7px; }')
    && /gap:\s*12px/.test(yearCss)
    && DASH_CSS.includes('min-width: 920px')
    && DASH_CSS.includes('grid-template-columns: repeat(12, minmax(72px, 1fr))')
})

check('R187-5 ★发布包减重只压缩构建产物、不删历史：手册 HTML 与 V2/V3 更新日志在 build 阶段压缩，开发源与全部条目保留', () => {
  const log3 = read('/newtab/changelog-data/entries-v3.ts')
  const log2 = read('/newtab/changelog-data/entries-v2.ts')
  return VITE.includes('function compactManualHtmlData()')
    && VITE.includes('function compactChangelogData()')
    && VITE.includes('compactManualHtmlData(),')
    && VITE.includes('compactChangelogData(),')
    && VITE.includes('config.command === \'build\'')
    && VITE.includes("id.replace(/\\\\/g, '/').endsWith('/src/newtab/manual-data.ts')")
    && /entries-v2\|entries-v3/.test(VITE)
    && log3.includes("version: '3.9.29'")
    && log2.includes("version: '2.")
})

check('R187-6 ★重复动态 import 已清零：撤销窗口常量走顶部静态导入，删除策展台时不再二次拉同一模块', () => {
  return APP.includes("import { DECK_DELETE_UNDO_WINDOW_MS, installGlobalUndo } from '@/shared/utils/undo'")
    && (APP.match(/DECK_DELETE_UNDO_WINDOW_MS/g) || []).length === 3
    && !APP.includes("const { DECK_DELETE_UNDO_WINDOW_MS } = await import('@/shared/utils/undo')")
})

check('R187-7 ★V3.9.30 全版本同步：manifest / package / lock 双行 / 手册 / 回归锚 / 两份 README / 架构总览一致，更新日志首条为本版', () => {
  const pkg = require('../../package.json')
  const lock = require('../../package-lock.json')
  const manifest = read('/manifest.ts')
  const manual = read('/newtab/views/ManualPage.vue')
  const v2Readme = read('/../../v2/README.md')
  const rootReadme = read('/../../README.md')
  const arch = read('/../../文档中心/00_架构总览.md')
  const log = read('/newtab/changelog-data/entries-v3.ts')
  const reg = read('/../scripts/regression.cjs')
  const current = `version: '${CUR_VER}'`
  return pkg.version === CUR_VER
    && lock.version === CUR_VER
    && lock.packages[''].version === CUR_VER
    && manifest.includes(VER_ANCHOR_LITERAL)
    && current === VER_ANCHOR_LITERAL
    && manual.includes(CUR_VTAG)
    && v2Readme.includes(`产品版本**：${CUR_VTAG}`)
    && rootReadme.includes(`当前版本 ${CUR_VTAG}`)
    && arch.includes(`版本**：${CUR_VTAG}`)
    && log.indexOf(current) >= 0
    && log.indexOf(current) < log.indexOf("version: '3.9.29'")
    && reg.includes("'116-v3930-profile-curation-perf'")
})
