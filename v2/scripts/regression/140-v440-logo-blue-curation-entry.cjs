/**
 * V4.4.0 · 知源 Logo 蓝与策展节点操作分层。
 *
 * 这组断言锁的是本轮用户可见契约，而不是具体配色实现：
 *   ① 三套主题的 accent 都在知源 Logo 蓝色相区间，且保留语义色；
 *   ② 策展节点把「关联资源卡」做成正文主 CTA；
 *   ③ 附件只保留轻量、直接可操作的行，不再与资源关联争夺节点头部；
 *   ④ 中心论点卡与子节点使用同一套主次关系。
 */
const { check, read } = require('./helpers.cjs')
const fs = require('fs')
const path = require('path')

console.log('【V4.4.0 · Logo 蓝与策展节点入口】')

const TOKENS = read('/shared/styles/tokens.css')
const APP = read('/newtab/App.vue')
const NODE = read('/newtab/components/curation/CurationMindNode.vue')
const MAP = read('/newtab/components/curation/CurationMindMap.vue')
const STRIP = read('/newtab/components/curation/CurationAssetStrip.vue')
const THEME_GATE = fs.readFileSync(path.join(__dirname, '..', 'theme-contrast.cjs'), 'utf8')

check('V440-1 ★三主题只保留标志性主题，accent 走知源 Logo 蓝并有蓝色相门禁', () => {
  return APP.includes("name: '光速黑'")
    && APP.includes("name: '极简白'")
    && APP.includes("name: '纸墨白'")
    && !APP.includes("name: '深空薰衣草'")
    && !APP.includes("name: '跟随系统'")
    && TOKENS.includes('[data-theme=\'raycast\']')
    && TOKENS.includes('[data-theme=\'apple\']')
    && TOKENS.includes('[data-theme=\'notion\']')
    && THEME_GATE.includes('知源 Logo 蓝色相')
    && THEME_GATE.includes('h < 185 || h > 215')
})

check('V440-2 ★无资源节点：关联资源卡是正文全宽主 CTA，节点头部不再重复小资源按钮', () => {
  return NODE.includes('class="mind-resource-empty"')
    && NODE.includes('class="mind-resource-cta"')
    && NODE.includes('关联资源卡')
    && !NODE.includes('v-if="!cards().length" class="mind-head-action"')
    && NODE.includes('@click.stop="emit(\'link-resource\', node)"')
})

check('V440-3 ★已有资源节点：资源 chip 与“继续关联资源”并存，主入口仍然可达', () => {
  return NODE.includes('class="mind-resources"')
    && NODE.includes('继续关联资源')
    && NODE.includes('class="mind-add mind-resource-cta mind-resource-cta-foot"')
    && NODE.includes('@click.stop="emit(\'link-resource\', node)"')
})

check('V440-4 ★附件降级为次级元数据行：compact 模式缩小尺寸、去掉边框和强调底色，添加附件保持直接可操作', () => {
  return STRIP.includes('compact?: boolean')
    && STRIP.includes(':class="{ selected, compact }"')
    && STRIP.includes('.curation-asset-strip.compact')
    && STRIP.includes('background: transparent')
    && STRIP.includes('@click.stop="pickFiles"')
    && NODE.includes('compact')
})

check('V440-5 ★中心论点卡与子节点共用资源优先语言：论点卡保留“继续关联资源”，附件不占据主体 CTA', () => {
  return MAP.includes('继续关联资源')
    && MAP.includes('class="mind-add mind-resource-cta mind-resource-cta-foot"')
    && MAP.includes('<CurationAssetStrip')
    && MAP.includes('compact')
    && !MAP.includes('aria-label="节点附件"')
})
