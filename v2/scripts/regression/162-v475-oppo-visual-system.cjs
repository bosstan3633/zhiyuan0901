const { check, codeOnly, read } = require('./helpers.cjs')

console.log('【V4.7.5 · OPPO 易简视觉系统】')

const TOKENS = read('/shared/styles/tokens.css')
const APP = read('/newtab/App.vue')
const PROFILE = read('/newtab/views/ProfileInsights.css')
const PI = read('/newtab/components/profile/pi-timeline.css')
const HOME = codeOnly(read('/newtab/views/CompassHome.css'))
const TREE = read('/newtab/views/CompassTree.css')
const WORKSPACE = read('/newtab/views/Workspace.vue')
const SETTINGS = read('/newtab/views/settings/GlobalSettings.css')
const SETTINGS_BASE = read('/newtab/views/settings/base.css')
const SPINE = read('/newtab/components/compass/CompassSpine.vue')
const MINDMAP = read('/newtab/components/curation/CurationMindMap.vue')
const CURATION = read('/newtab/components/curation/curation.css')

check('V475-1 全局表面、圆角和页边距有共享语义令牌，四主题继续共用同一结构语言', () => {
  return TOKENS.includes('--surface-panel: var(--surface)')
    && TOKENS.includes('--shadow-panel: none')
    && TOKENS.includes('--radius-panel: var(--radius-lg)')
    && TOKENS.includes('--radius-control: var(--radius-xs)')
    && TOKENS.includes('--page-gutter: var(--sp-6)')
})

check('V475-2 页面与顶栏移除氛围渐变和大面积模糊，不新增持续重绘装饰', () => {
  return TOKENS.includes('background: var(--surface-canvas)')
    && !TOKENS.includes('radial-gradient(circle at 8% -8%')
    && APP.includes('background: var(--surface); border-bottom: 1px solid var(--border)')
    && !codeOnly(APP).includes('backdrop-filter: blur(12px)')
    && !HOME.includes('focus-breathe')
    && !HOME.includes('.work-board::before')
})

check('V475-3（V4.7.7 重指）画像页头压缩、年度热力前置，时间轴保持首屏可达；方向状态模块退役后视觉焦点落在热力图而非指标数字。', () => {
  return PROFILE.includes('padding: 12px var(--page-gutter) 48px')
    && PI.includes('background: var(--surface-panel)')
    && PI.includes('gap: 12px')
    && !PI.includes('.pi-dir-')
})

check('V475-4 调度台使用统一页面留白与轻表面，今日工作板保持唯一主视觉', () => {
  return HOME.includes('padding: 24px var(--page-gutter) 72px')
    && HOME.includes('--lv-card-shadow: var(--shadow-panel)')
    && HOME.includes('border-radius: var(--radius-panel)')
    && HOME.includes('.work-board { box-shadow: var(--shadow-sm); }')
})

check('V475-5 方向与策展使用本轮视觉优化实现，保持结构与操作路径', () => {
  return TREE.includes('.tree-layout.is-pano .canvas-inner { border-radius: var(--radius-lg); }')
    && SPINE.includes('.spine-h:focus-visible { outline: 2px solid var(--accent)')
    && MINDMAP.includes('v-show="helpOpen"')
    && MINDMAP.includes('aria-controls="mindmap-shortcuts"')
    && CURATION.includes('.mind-node:focus-visible { outline: var(--focus-ring)')
    && WORKSPACE.length > 0
})

check('V475-6 设置页采用清晰导航、分组面板和统一控件表面', () => {
  return SETTINGS.includes('.gs-nav-item.active::before')
    && SETTINGS.includes('.gs-nav-item:focus-visible')
    && SETTINGS_BASE.includes('min-height: 32px')
    && SETTINGS_BASE.includes('border-radius: var(--radius-xs)')
    && SETTINGS_BASE.includes('.gs-btn:focus-visible, .gs-input:focus-visible, .gs-select:focus-visible')
})

check('V475-7 全站尊重减少动态效果设置', () => {
  return TOKENS.includes("@media (prefers-reduced-motion: reduce)")
    && TOKENS.includes('animation-iteration-count: 1 !important')
    && TOKENS.includes('transition-duration: 0.01ms !important')
})
