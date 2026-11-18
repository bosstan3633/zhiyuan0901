/** V4.3.7: project panorama location and curation controls. */
const { check, read } = require('./helpers.cjs')

console.log('【V4.3.7 · 方向定位与策展折叠】')

check('V437-1 层级列表退场后等待全景挂载，再按指标与任务定位', () => {
  const logic = read('/newtab/views/useCompassTreeProjects.ts')
  const locate = logic.slice(logic.indexOf('function onListLocate('), logic.indexOf('\nfunction onListEditDir('))
  return locate.includes('openPano(projId)')
    && locate.includes('requestAnimationFrame(locateWhenMounted)')
    && locate.includes('pano.dataset.project !== projId')
    && locate.includes("querySelectorAll<HTMLElement>('[data-metric]')")
    && locate.includes("querySelectorAll<HTMLElement>('[data-task]')")
    && read('/newtab/components/compass/CompassPano.vue').includes(':data-task="t.id"')
    && !locate.includes('任务已不在该项目')
})

check('V437-2 金字塔与树状模式共用目标折叠集合', () => {
  const page = read('/newtab/views/CompassCurationPage.vue')
  const pyramid = read('/newtab/components/compass/curation/CurationPyramidLayout.vue')
  return page.includes(':collapsed="collapsedIds"')
    && page.includes("next.add('g' + g.dir.id)")
    && pyramid.includes("!collapsed.has('g' + g.dir.id)")
})

check('V437-3 首页资源列表只开右侧详情，不直接调出链接', () => {
  const logic = read('/newtab/views/useCompassHome.ts')
  const home = read('/newtab/views/CompassHome.vue')
  const action = logic.slice(logic.indexOf('function openRecentResource('), logic.indexOf('\nfunction goDeck('))
  return action.includes('openResourcePreview(r)')
    && !action.includes('openResourceLink(r)')
    && home.includes('title="查看资源卡详情" @click="openRecentResource(r)"')
})
