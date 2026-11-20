/**
 * V4.7.1 · 卡片池入口退役：页头不再提供“进入卡片池”，资源页“查看全部/全部”
 * 一律经由 HomeResourceFolderGrid 的 openAll() 直接打开全部资源卡抽屉。
 */
const { check, read, segOf } = require('./helpers.cjs')

console.log('【V4.7.1 · 卡片池入口退役与资源抽屉直达】')

const HOME = read('/newtab/views/CompassHome.vue')
const GRID = read('/newtab/components/compass/HomeResourceFolderGrid.vue')
const ROUTER = read('/newtab/router.ts')

check('POOL471-1 页头「进入卡片池 →」整块退役：hand-head-actions 与文案零残留，四枚页签仍在同一 hand-head', () => {
  const head = segOf(HOME, '<header class="hand-head">', '</header>')
  return head.includes('class="hand-tabs"')
    && (head.match(/class="hand-tab(?=[ "])/g) || []).length === 4
    && !head.includes('hand-head-actions')
    && !head.includes('进入卡片池')
    && !head.includes('goDeck(')
})

check('POOL471-2 资源页「查看全部 / 全部」经 ref 调 openAll 直达抽屉，不再调用 goDeck', () => {
  return HOME.includes('const resourceFolderGridRef = ref<InstanceType<typeof HomeResourceFolderGrid> | null>(null)')
    && HOME.includes('function openAllResources(): void')
    && HOME.includes('resourceFolderGridRef.value?.openAll()')
    && (HOME.match(/@click="openAllResources"/g) || []).length === 2
    && !HOME.includes('@click="goDeck')
    && !HOME.includes('class="hand-head-actions"')
})

check('POOL471-3 HomeResourceFolderGrid 暴露 openAll：置 allOpen=true，抽屉仍由同一实例承载', () => {
  return GRID.includes('function openAll(): void')
    && GRID.includes('allOpen.value = true')
    && GRID.includes('defineExpose({ openAll })')
    && GRID.includes('<Drawer :open="allOpen"')
    && GRID.includes('title="全部资源卡"')
})

check('POOL471-4 退役只删 UI 入口：/deck 四类旧地址与 /deck/inbox 仍保留兼容重定向', () => {
  return ROUTER.includes("path: '/deck/:kind(task|topic|curiosity|resource)'")
    && ROUTER.includes("path: '/'")
    && ROUTER.includes('tab: String(to.params.kind || \'task\')')
    && ROUTER.includes("path: '/deck/inbox'")
    && ROUTER.includes("redirect: '/'")
})
