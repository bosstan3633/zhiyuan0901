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

check('R185-A2（V4.0.3 重指）★中心论点成为镇台舞台：L1 / 论点卡 / 金字塔根节点三层语义、22px 主句、卡片读数与详情入口同卡；卡内不再放金字塔或分享按钮', () => {
  const start = WS.indexOf('<div class="thesis-banner"')
  const banner = WS.slice(start, WS.indexOf('<!-- ③ 行动条', start))
  return banner.includes('class="tb-kicker"')
    && banner.includes('L1')
    && banner.includes('中心论点 · 论点卡')
    && banner.includes('金字塔根节点')
    && banner.includes('class="tb-title"')
    && banner.includes('class="tb-desc"')
    && banner.includes('class="cur-metrics" data-curation-metrics="2"')
    && banner.includes('class="tb-detail" type="button"')
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
    && !toolbar.includes('class="cur-layout"')
    && !toolbar.includes("mind.setLayout(")
    && MIND.includes('<div class="mindmap-layout" role="group" aria-label="切换画布布局">')
    && !MIND.includes('v-if="fullscreen" class="mindmap-layout"')
    && MIND.includes("@click=\"$emit('update:layout', 'pyramid')\"")
    && MIND.includes("@click=\"$emit('update:layout', 'tree')\"");
})

check('R185-A4（V4.1.2 重指）★页面设置退役后数据动作仍可达：台数据菜单集中导入 JSON / 成果 HTML / 模板与导出备份 / 清理镜像，检索与分享保持原位', () => {
  const toolbar = WS.slice(WS.indexOf('<div class="ws-toolbar cur-toolbar"'), WS.indexOf('<CurationMindMap', WS.indexOf('<div class="ws-toolbar cur-toolbar"')))
  return !toolbar.includes('class="cur-toolbar-lead"')
    && !toolbar.includes('class="cur-sep"')
    && !toolbar.includes('class="cur-metrics"')
    && !toolbar.includes('class="cur-layout"')
    && toolbar.includes('class="cur-import"')
    && !toolbar.includes('class="hero-btn settings"')
    && toolbar.includes('class="hero-btn ghost cur-import-trigger"')
    && toolbar.includes('<b>导入 JSON 备份</b>')
    && toolbar.includes('<b>导入成果 HTML</b>')
    && toolbar.includes('<b>导入模板</b>')
    && toolbar.includes('<b>导出 JSON 备份</b>')
    && toolbar.includes('<b>清理本台镜像卡</b>')
    && toolbar.includes('class="toolbar-spacer"')
    && toolbar.includes('class="toolbar-search"')
    && toolbar.includes('class="hero-btn primary share-action"')
    && toolbar.indexOf('class="cur-import"') < toolbar.indexOf('class="toolbar-search"')
    && toolbar.indexOf('class="toolbar-search"') < toolbar.indexOf('class="hero-btn primary share-action"');
})

check('R185-A5（V3.9.29 重指）★未设立论点是单行轻引导：整卡可点创建 + 文本式开始提示，不再显示旧版大灰卡或卡内按钮', () => {
  return WS.includes('v-pressable="!!thesisCard"')
    && WS.includes('<button class="thesis-empty-inner" type="button" @click.stop="openThesisCreate">')
    && WS.includes('class="thesis-empty-pill"')
    && WS.includes('点击确立本策展台的 <b>L1 中心论点</b>')
    && WS.includes('class="tb-btn"')
    && !WS.includes('<button class="tb-btn"')
    && (WS.match(/openThesisCreate\(\)/g) || []).length >= 2
    && CSS.includes('.thesis-banner.empty')
    && CSS.includes('padding: 10px 16px');
})

check('R185-A6 ★窄屏可读：描述让位、论点标题最多两行、行动条分组换行且分隔线隐藏', () => {
  const mobile = CSS.slice(CSS.indexOf('@media (max-width: 900px)'))
  return mobile.includes('.wsh-desc { display: none; }')
    && mobile.includes('-webkit-line-clamp: 2')
    && mobile.includes('.thesis-banner:not(.empty) { flex-direction: column;')
    && mobile.includes('.tb-side { width: 100%; flex-direction: row;')
    && mobile.includes('.ws-toolbar { flex-wrap: wrap;')
    && mobile.includes('.toolbar-spacer { display: none; }')
    && !mobile.includes('.cur-toolbar-lead')
    && !mobile.includes('.cur-sep');
})

check('R185-V1（V3.9.29 重指）V3.9.28 历史记录仍在：更新日志保留页头重设计条目，当前版本同步由 115 分片承接', () => {
  const log = read('/newtab/changelog-data/entries-v3.ts')
  return log.includes("version: '3.9.28'")
    && log.includes('中心论点从单行横幅升级为镇台卡')
    && log.includes('台身份行回到 ≤40px')
    && log.includes('分享成果只留行动条行尾一处');
})
