/**
 * V4.7.1 · F1 好奇心详情单宿主。
 *
 * 锁定三件事：
 *   ① CuriosityPanel 声明 detailsHost 并为 KeepAlive 缓存实例做路由守卫；
 *   ② 首页 / 设置页 / 旧二级池三处宿主都显式传值；
 *   ③ onOpenDrawer 只有一个消费点，且守卫位于入口、先于 openDetail / query / 热度记录。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs')

console.log('【V4.7.1 · 好奇心详情单宿主】')

const CURIO = read('/newtab/components/compass/CuriosityPanel.vue')
const CURIO_JS = codeOnly(CURIO)
const HOME = read('/newtab/views/CompassHome.vue')
const SETTINGS = read('/newtab/views/settings/SettingsDataManagement.vue')
const DECK = read('/newtab/views/CompassDeckView.vue')
const ROUTER = read('/newtab/router.ts')

function curioTag(src) {
  const start = src.indexOf('<CuriosityPanel')
  const end = src.indexOf('/>', start)
  return start >= 0 && end > start ? src.slice(start, end + 2) : ''
}

check('CURIO471-1 CuriosityPanel 声明 detailsHost 三值，并按 secondaryMode 推断默认宿主', () => {
  return CURIO.includes("type DetailsHost = 'home' | 'settings' | 'deck'")
    && CURIO.includes("detailsHost?: 'home' | 'settings' | 'deck'")
    && CURIO_JS.includes("props.detailsHost || (props.secondaryMode ? 'deck' : 'home')")
    && CURIO_JS.includes('const resolvedDetailsHost = computed<DetailsHost>')
})

check('CURIO471-2 三处宿主都显式传 details-host：首页 home / 设置页 settings / 旧二级池 deck', () => {
  const homeTag = curioTag(HOME)
  const settingsTag = curioTag(SETTINGS)
  const deckTag = curioTag(DECK)
  return homeTag.includes('details-only') && homeTag.includes('details-host="home"')
    && settingsTag.includes('details-only') && settingsTag.includes('details-host="settings"')
    && deckTag.includes('secondary-mode') && deckTag.includes('details-host="deck"')
    && [HOME, SETTINGS, DECK].every(s => (s.match(/<CuriosityPanel\b/g) || []).length === 1)
})

check('CURIO471-3 路由守卫按宿主匹配：home→route.name home（router.ts 真名）/ settings→settings / deck→/deck 前缀', () => {
  const guard = segOf(CURIO_JS, 'function detailsHostRouteMatches', 'function canConsumeCurioDrawer')
  return guard.includes("if (host === 'settings') return route.name === 'settings'")
    && guard.includes("if (host === 'deck') return route.path.startsWith('/deck')")
    && guard.includes("return route.name === 'home'")
    && CURIO_JS.includes('return hostActive.value && detailsHostRouteMatches()')
})

check('CURIO471-4 onActivated/onDeactivated 仅作辅助标记，路由仍是最终判据', () => {
  return CURIO_JS.includes('onActivated(() => { hostActive.value = true })')
    && CURIO_JS.includes('onDeactivated(() => { hostActive.value = false })')
    && CURIO_JS.includes('hostActive.value && detailsHostRouteMatches()')
})

check('CURIO471-5 onOpenDrawer 全组件只有一个消费点，守卫在 curio 分支入口且先于 openDetail / query / 热度记录', () => {
  const callback = segOf(CURIO_JS, 'const off = onOpenDrawer((p) => {', 'onUnmounted(() => { off() })')
  const branchAt = callback.indexOf("if (p.kind === 'curio') {")
  const guardAt = callback.indexOf("if (!canConsumeCurioDrawer()) return")
  return (CURIO_JS.match(/onOpenDrawer\(/g) || []).length === 1
    && branchAt >= 0
    && guardAt > branchAt
    && guardAt < callback.indexOf('openDetail')
    && !callback.includes('router.replace')
    && !callback.includes('recordCardOpen')
    && [HOME, SETTINGS, DECK].every(s => !s.includes('onOpenDrawer('))
})

check('CURIO471-6 单宿主只渲染一枚详情 Drawer；设置页 closed 刷新逻辑保持原样', () => {
  return (CURIO.match(/<Drawer\b/g) || []).length === 1
    && SETTINGS.includes('@closed="refreshAssetRows"')
    && read('/newtab/router.ts').includes("path: '/'")
    && segOf(ROUTER, "path: '/'", 'meta: {').includes("name: 'home'")
})
