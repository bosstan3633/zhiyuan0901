/**
 * V3.9.28 · 策展台页头重设计。
 *
 * 锁三件事：三层信息架构、一个动作一个入口、窄屏可读。
 * 版本锚仍由 helpers.cjs 的唯一字面量负责。
 */
const { check, read, codeOnly, CUR_VER, CUR_VTAG, VER_ANCHOR_LITERAL } = require('./helpers.cjs')

console.log('【V3.9.28 · 策展台页头】')

const WS = read('/newtab/views/Workspace.vue')
const CSS = read('/newtab/views/workspace.css')
const MIND = read('/newtab/components/curation/CurationMindMap.vue')
const MIND_CSS = read('/newtab/components/curation/curation.css')

check('R185-A1 ★三层页头成立：台身份 ≤40px → 中心论点主舞台 → 页面级行动条；台名恢复 19px，描述空不占位', () => {
  return /\.ws-id-head \{[^}]*min-height: 36px;[^}]*max-height: 40px;/.test(CSS)
    && /\.wsh-name \{[^}]*font-size: 19px;/.test(CSS)
    && WS.includes('class="ws-id-head"') && WS.includes('v-if="wsHeadDescOwn"')
    && WS.indexOf('class="ws-id-head"') < WS.indexOf('class="thesis-banner"')
    && WS.indexOf('class="thesis-banner"') < WS.indexOf('class="ws-toolbar cur-toolbar"')
    && (WS.match(/<div class="thesis-banner"/g) || []).length === 1;
})

check('R185-A2（V3.9.29 重指）★中心论点成为镇台舞台：L1 / 论点卡 / 金字塔根节点三层语义、22px 主句、说明与详情提示同卡；卡内不再放金字塔或分享按钮', () => {
  const banner = WS.slice(WS.indexOf('<div class="thesis-banner"'), WS.indexOf('</div>', WS.indexOf('<div class="thesis-banner"')))
  return banner.includes('class="tb-kicker"')
    && banner.includes('L1')
    && banner.includes('中心论点 · 论点卡')
    && banner.includes('金字塔根节点')
    && banner.includes('class="tb-title"')
    && banner.includes('class="tb-desc"')
    && banner.includes('class="tb-open"')
    && CSS.includes('font-size: 22px')
    && CSS.includes('radial-gradient(600px 160px')
    && !banner.includes('分享成果')
    && !banner.includes("update:layout")
    && !banner.includes('查看金字塔');
})

check('R185-A3（V3.9.30 重指）★一个动作一个入口：分享只留行动条行尾一次并恢复 primary；普通视图布局切换只留页头行动条，画布内仅全屏补位', () => {
  const w = codeOnly(WS)
  const toolbar = w.slice(w.indexOf('<div class="ws-toolbar cur-toolbar"'), w.indexOf('<CurationMindMap', w.indexOf('<div class="ws-toolbar cur-toolbar"')))
  return (w.match(/分享成果/g) || []).length === 1
    && toolbar.includes('分享成果')
    && toolbar.includes('class="hero-btn primary share-action"')
    && toolbar.includes('class="cur-layout"')
    && toolbar.includes("@click=\"mind.setLayout('pyramid')\"")
    && toolbar.includes("@click=\"mind.setLayout('tree')\"")
    && !MIND.includes('<div class="mindmap-layout"')
    && MIND.includes('v-if="fullscreen" class="mindmap-layout"')
    && MIND.includes("@click=\"$emit('update:layout', 'pyramid')\"")
    && MIND.includes("@click=\"$emit('update:layout', 'tree')\"");
})

check('R185-A4（V3.9.29 重指）★行动条按职责分组：画布读数 / 内容导入 / 检索与成果三组；导入 HTML 与模板收进同一菜单并保持一级可达', () => {
  const toolbar = WS.slice(WS.indexOf('<div class="ws-toolbar cur-toolbar"'), WS.indexOf('<CurationMindMap', WS.indexOf('<div class="ws-toolbar cur-toolbar"')))
  return toolbar.includes('class="cur-toolbar-lead"')
    && (toolbar.match(/class="cur-sep"/g) || []).length === 3
    && toolbar.includes('class="cur-import"')
    && toolbar.includes('<b>导入成果 HTML</b>')
    && toolbar.includes('<b>导入模板</b>')
    && toolbar.includes('class="toolbar-search"')
    && toolbar.includes('class="hero-btn settings"')
    && toolbar.indexOf('导入成果 HTML') < toolbar.indexOf('class="toolbar-search"');
})

check('R185-A5（V3.9.29 重指）★未设立论点是单行轻引导：整卡可点创建 + 文本式开始提示，不再显示旧版大灰卡或卡内按钮', () => {
  return WS.includes('class="thesis-empty-inner"')
    && WS.includes('class="thesis-empty-pill"')
    && WS.includes('点击确立本策展台的 <b>L1 中心论点</b>')
    && WS.includes('class="tb-btn"')
    && !WS.includes('<button class="tb-btn"')
    && WS.includes('@click="thesisCard ? openThesisCard() : openThesisCreate()"')
    && (WS.match(/openThesisCreate\(\)/g) || []).length >= 2
    && CSS.includes('.thesis-banner.empty')
    && CSS.includes('padding: 10px 16px');
})

check('R185-A6 ★窄屏可读：描述让位、论点标题最多两行、行动条分组换行且分隔线隐藏', () => {
  const mobile = CSS.slice(CSS.indexOf('@media (max-width: 900px)'))
  return mobile.includes('.wsh-desc { display: none; }')
    && mobile.includes('-webkit-line-clamp: 2')
    && mobile.includes('.cur-toolbar-lead { width: 100%; flex-wrap: wrap; }')
    && mobile.includes('.cur-sep { display: none; }');
})

check('R185-V1（V3.9.29 重指）V3.9.28 历史记录仍在：更新日志保留页头重设计条目，当前版本同步由 115 分片承接', () => {
  const log = read('/newtab/changelog-data/entries-v3.ts')
  return log.includes("version: '3.9.28'")
    && log.includes('中心论点从单行横幅升级为镇台卡')
    && log.includes('台身份行回到 ≤40px')
    && log.includes('分享成果只留行动条行尾一处');
})
