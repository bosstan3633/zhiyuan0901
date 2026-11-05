/**
 * V3.9.29 · 策展台页头审核原型对齐。
 *
 * V3.9.28 只改到了“已有中心论点”的一部分：空态仍是旧灰卡 + 卡内按钮，
 * 两个导入仍平铺，分享仍是次级样式。本分片把原型里真正承重的视觉与交互
 * 约束锁成门禁，避免字符串存在、观感却未落地。
 */
const {
  fs, base, check, read, codeOnly, CUR_VER, CUR_VTAG, VER_ANCHOR_LITERAL,
} = require('./helpers.cjs')

console.log('【V3.9.29 · 策展台页头审核原型对齐】')

const WS_PATH = base + '/newtab/views/Workspace.vue'
const WS = fs.readFileSync(WS_PATH, 'utf8').replace(/\r\n/g, '\n')
const WSC = codeOnly(WS)
const CSS = read('/newtab/views/workspace.css')
const MIND = read('/newtab/components/curation/CurationMindMap.vue')

const bannerStart = WS.indexOf('<div class="thesis-banner"')
const bannerEnd = WS.indexOf('<!-- ③ 行动条', bannerStart)
const toolbarStart = WS.indexOf('<div class="ws-toolbar cur-toolbar"')
const mindmapStart = WS.indexOf('<CurationMindMap', toolbarStart)
const banner = WS.slice(bannerStart, bannerEnd)
const toolbar = WS.slice(toolbarStart, mindmapStart)

check('R186-1（V4.0.3 重指）★空论点态按原型收成单行轻引导：虚线 L1 图标 + 一行说明 + 原生创建按钮；不再用整卡伪造按钮语义', () => {
  const emptyCss = (CSS.match(/\.thesis-banner\.empty\s*\{([^}]*)\}/) || [])[1] || ''
  return WS.includes('v-pressable="!!thesisCard"')
    && WS.includes('<button class="thesis-empty-inner" type="button" @click.stop="openThesisCreate">')
    && WS.includes('class="thesis-empty-pill"')
    && WS.includes('点击确立本策展台的 <b>L1 中心论点</b>')
    && WS.includes('class="tb-btn"')
    && !WS.includes('<button class="tb-btn"')
    && WS.includes('<div class="thesis-banner" :class="{ empty: !thesisCard }"')
    && /min-height:\s*42px/.test(emptyCss)
    && /padding:\s*10px 16px/.test(emptyCss)
    && /background:\s*var\(--surface-2\)/.test(emptyCss)
})

check('R186-2（V4.0.3 重指）★有论点态是镇台主舞台：22px 主句、600 字重、径向渐变、14px 圆角与大留白；卡片读数与详情同卡，但不混入分享和布局切换', () => {
  const stageCss = (CSS.match(/\.thesis-banner\s*\{([^}]*)\}/) || [])[1] || ''
  const titleCss = (CSS.match(/\.tb-title\s*\{([^}]*)\}/) || [])[1] || ''
  return stageCss.includes('radial-gradient(600px 160px')
    && stageCss.includes('border-radius: 14px')
    && stageCss.includes('padding: 18px 20px 16px')
    && !stageCss.includes('inset 3px 0 0')
    && titleCss.includes('font-size: 22px')
    && titleCss.includes('font-weight: 600')
    && WS.includes('class="tb-desc-row"')
    && WS.includes('class="tb-detail" type="button" @click.stop="openThesisCard"')
    && WS.includes('查看论点详情')
    && banner.includes('class="cur-metrics" data-curation-metrics="2"')
    && banner.includes('论据卡')
    && banner.includes('佐证附件')
    && !banner.includes('分享成果')
    && !banner.includes('update:layout')
})

check('R186-3 ★分享只有一个入口且是行尾主行动：页头“分享成果”恰好一次，class 为 hero-btn primary，论点卡内不重复', () => {
  const shareCount = (WSC.match(/分享成果/g) || []).length
  const shareAt = toolbar.indexOf('分享成果')
  const searchAt = toolbar.indexOf('class="toolbar-search"')
  const settingsAt = toolbar.indexOf('class="hero-btn settings"')
  return shareCount === 1
    && toolbar.includes('class="hero-btn primary share-action"')
    && shareAt > searchAt && shareAt > settingsAt
    && !banner.includes('分享成果')
})

check('R186-4（V4.1.2 重指）★策展台数据动作收进一个菜单且触发器阻止冒泡：导入 JSON / 成果 HTML / 模板与导出 / 清理镜像五项齐备，document 级监听仍可关闭菜单', () => {
  return toolbar.includes('class="cur-import"')
    && toolbar.includes('@click.stop="toggleImportMenu"')
    && toolbar.includes(':aria-expanded="importMenuOpen"')
    && toolbar.includes('v-if="importMenuOpen" class="cur-import-popover"')
    && toolbar.includes('<b>导入 JSON 备份</b>')
    && toolbar.includes('<b>导入成果 HTML</b>')
    && toolbar.includes('<b>导入模板</b>')
    && toolbar.includes('<b>导出 JSON 备份</b>')
    && toolbar.includes('<b>清理本台镜像卡</b>')
    && (toolbar.match(/class="cur-import-item"/g) || []).length === 5
    && !toolbar.includes('@click="openShareHtmlImport"')
    && !toolbar.includes('@click="pyramidImportOpen = true"')
    && WSC.includes("document.addEventListener('click', closeHeaderMenus)")
    && WSC.includes("document.removeEventListener('click', closeHeaderMenus)")
    && WSC.includes('function importShareHtmlFromMenu()')
    && WSC.includes('function importPyramidTemplateFromMenu()')
})

check('R186-5（V4.0.3 重指）★布局切换只保留一个高频入口：金字塔 / 树状固定归画布工具条，普通视图与全屏常驻', () => {
  return !toolbar.includes('class="cur-layout"')
    && !toolbar.includes('mind.setLayout(')
    && MIND.includes('<div class="mindmap-layout" role="group" aria-label="切换画布布局">')
    && !MIND.includes('v-if="fullscreen" class="mindmap-layout"')
    && MIND.includes("@click=\"$emit('update:layout', 'pyramid')\"")
    && MIND.includes("@click=\"$emit('update:layout', 'tree')\"")
})

check('R186-6（V4.0.3 重指）★全版本同步：manifest / package / lock 双行 / 手册 / 回归锚 / v2 README / 根 README / 架构总览一致，V4 更新日志首条为现行版本', () => {
  const pkg = require('../../package.json')
  const lock = require('../../package-lock.json')
  const manifest = read('/manifest.ts')
  const manual = read('/newtab/views/ManualPage.vue')
  const v2Readme = read('/../../v2/README.md')
  const rootReadme = read('/../../README.md')
  const arch = read('/../../文档中心/00_架构总览.md')
  const log = read('/newtab/changelog-data/entries-v4.ts')
  const reg = read('/../scripts/regression.cjs')
  return pkg.version === CUR_VER
    && lock.version === CUR_VER
    && lock.packages[''].version === CUR_VER
    && manifest.includes(VER_ANCHOR_LITERAL)
    && manual.includes(CUR_VTAG)
    && VER_ANCHOR_LITERAL === `version: '${CUR_VER}'`
    && v2Readme.includes(`产品版本**：${CUR_VTAG}`)
    && rootReadme.includes(`当前版本 ${CUR_VTAG}`)
    && arch.includes(`版本**：${CUR_VTAG}`)
    && log.indexOf(`version: '${CUR_VER}'`) >= 0
    && log.indexOf(`version: '${CUR_VER}'`) < log.indexOf("version: '4.0.2'")
    && reg.includes("'115-v3929-curation-head-prototype'")
})

check('R186-7（V4.1.2 重指）★页头菜单互斥且动作先收口：打开台数据会关台名编辑，打开台名编辑会关台数据；选择导入项时先关闭菜单再打开对应弹窗', () => {
  return /function toggleImportMenu\(\)[\s\S]*?wsInfoMenuOpen\.value = false/.test(WSC)
    && /function toggleWsInfoMenu\(\)[\s\S]*?importMenuOpen\.value = false/.test(WSC)
    && /function importShareHtmlFromMenu\(\)\s*\{\s*closeImportMenu\(\)\s*openShareHtmlImport\(\)/.test(WSC)
    && /function importPyramidTemplateFromMenu\(\)\s*\{\s*closeImportMenu\(\)\s*pyramidImportOpen\.value = true/.test(WSC)
    && /function openImport\(\)\s*\{\s*closeImportMenu\(\)\s*wsInfoMenuOpen\.value = false/.test(WSC)
})
