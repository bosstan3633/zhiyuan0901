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

check('R185-A2 ★中心论点成为镇台卡：L1 / 论点卡 / 金字塔根节点三层语义、标题、说明与详情入口同卡；卡内不再放金字塔或分享按钮', () => {
  const banner = WS.slice(WS.indexOf('<div class="thesis-banner"'), WS.indexOf('</div>', WS.indexOf('<div class="thesis-banner"')))
  return banner.includes('class="tb-kicker"')
    && banner.includes('L1')
    && banner.includes('中心论点 · 论点卡')
    && banner.includes('金字塔根节点')
    && banner.includes('class="tb-title"')
    && banner.includes('class="tb-desc"')
    && banner.includes('class="tb-open"')
    && !banner.includes('分享成果')
    && !banner.includes("update:layout")
    && !banner.includes('查看金字塔');
})

check('R185-A3 ★一个动作一个入口：分享只留行动条行尾一次，仍为 ghost 次级；视图切换只留画布头，不在页头重复', () => {
  const w = codeOnly(WS)
  const toolbar = w.slice(w.indexOf('<div class="ws-toolbar cur-toolbar"'), w.indexOf('<CurationMindMap', w.indexOf('<div class="ws-toolbar cur-toolbar"')))
  return (w.match(/分享成果/g) || []).length === 1
    && toolbar.includes('分享成果')
    && toolbar.includes('class="hero-btn ghost share-action"')
    && !toolbar.includes('update:layout')
    && !toolbar.includes('mindmap-layout')
    && MIND.includes('class="mindmap-layout"')
    && MIND.includes("@click=\"$emit('update:layout', 'pyramid')\"")
    && MIND.includes("@click=\"$emit('update:layout', 'tree')\"");
})

check('R185-A4 ★行动条按职责分组：画布读数 / 内容导入 / 检索与成果三组，用发丝分隔；导入 HTML 与模板仍是一级入口', () => {
  const toolbar = WS.slice(WS.indexOf('<div class="ws-toolbar cur-toolbar"'), WS.indexOf('<CurationMindMap', WS.indexOf('<div class="ws-toolbar cur-toolbar"')))
  return toolbar.includes('class="cur-toolbar-lead"')
    && (toolbar.match(/class="cur-sep"/g) || []).length === 2
    && toolbar.includes('导入成果 HTML')
    && toolbar.includes('导入模板')
    && toolbar.includes('class="toolbar-search"')
    && toolbar.includes('class="hero-btn settings"')
    && toolbar.indexOf('导入成果 HTML') < toolbar.indexOf('class="toolbar-search"');
})

check('R185-A5 ★未设立论点仍是轻引导：整卡可点创建 + 单一明确按钮，不新增第二套空态或第二个分享入口', () => {
  return WS.includes('class="tb-hint"')
    && WS.includes('＋ 点击确立本策展台的 L1 中心论点')
    && WS.includes('class="tb-btn" @click.stop="openThesisCreate"')
    && WS.includes('@click="thesisCard ? openThesisCard() : openThesisCreate()"')
    && (WS.match(/openThesisCreate\(\)/g) || []).length >= 2
    && !WS.includes('thesis-empty-panel');
})

check('R185-A6 ★窄屏可读：描述让位、论点标题最多两行、行动条分组换行且分隔线隐藏', () => {
  const mobile = CSS.slice(CSS.indexOf('@media (max-width: 900px)'))
  return mobile.includes('.wsh-desc { display: none; }')
    && mobile.includes('-webkit-line-clamp: 2')
    && mobile.includes('.cur-toolbar-lead { width: 100%; flex-wrap: wrap; }')
    && mobile.includes('.cur-sep { display: none; }');
})

check('R185-V1 ★版本与更新日志同步到 V3.9.28：manifest / package / lock / 手册 / 回归锚一致，更新日志首条记录本轮页头重设计', () => {
  const pkg = require('../../package.json')
  const lock = require('../../package-lock.json')
  const manifest = read('/manifest.ts')
  const manual = read('/newtab/views/ManualPage.vue')
  const log = read('/newtab/changelog-data/entries-v3.ts')
  const helpers = read('/../scripts/regression/helpers.cjs')
  return pkg.version === CUR_VER
    && lock.version === CUR_VER
    && lock.packages[''].version === CUR_VER
    && manifest.includes(VER_ANCHOR_LITERAL)
    && manual.includes(CUR_VTAG)
    && helpers.includes(VER_ANCHOR_LITERAL)
    && log.includes("version: '3.9.28'")
    && log.includes('中心论点从单行横幅升级为镇台卡')
    && log.includes('台身份行回到 ≤40px')
    && log.includes('分享成果只留行动条行尾一处');
})
