/**
 * V4.4.0 / V4.5.0 · 四主题、知源 Logo 蓝与策展节点操作分层。
 *
 * 这组断言锁的是本轮用户可见契约，而不是具体配色实现：
 *   ① 光速黑使用暗红强调，浅色知源主题保留 Logo 蓝，OPPO 绿独立成主题；
 *   ② 策展节点把「关联卡片」做成正文主 CTA，统一承接资源卡与选题卡；
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

check('V440-1（V4.5.0 重指）★四主题只保留正式主题：光速黑暗红、极简白/纸墨白 Logo 蓝、OPPO 绿独立成主题，色相门禁逐主题校验', () => {
  return APP.includes("name: '光速黑'")
    && APP.includes("name: '极简白'")
    && APP.includes("name: '纸墨白'")
    && APP.includes("name: 'OPPO 绿'")
    && !APP.includes("name: '深空薰衣草'")
    && !APP.includes("name: '跟随系统'")
    && TOKENS.includes('[data-theme=\'raycast\']')
    && TOKENS.includes('[data-theme=\'apple\']')
    && TOKENS.includes('[data-theme=\'notion\']')
    && TOKENS.includes('[data-theme=\'oppo\']')
    && THEME_GATE.includes('浅色主题 Logo 蓝')
    && THEME_GATE.includes("raycast: [345, 15]")
    && THEME_GATE.includes("apple: [185, 215]")
    && THEME_GATE.includes("notion: [185, 215]")
    && THEME_GATE.includes("oppo: [135, 170]")
})

check('V440-2 ★无资源节点：关联资源卡是正文全宽主 CTA，节点头部不再重复小资源按钮', () => {
  return NODE.includes('class="mind-resource-empty"')
    && NODE.includes('class="mind-resource-cta"')
    && NODE.includes('关联资源卡')
    && !NODE.includes('v-if="!cards().length" class="mind-head-action"')
    && NODE.includes('@click.stop="emit(\'link-resource\', node)"')
})

check('V440-3（V4.5.0 重指）★已有资源或选题节点：关联 chip 与“继续关联卡片”并存，主入口仍然可达', () => {
  return NODE.includes('class="mind-resources"')
    && NODE.includes('class="mind-topic"')
    && NODE.includes('继续关联卡片')
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
