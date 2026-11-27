/**
 * V4.7.4 · 时间轴动作收口、卡片池控制条压缩、任务全景快捷键与资源夹瘦身。
 *
 * 本片只钉本轮新增 / 翻转的契约；被新口径覆盖的旧断言已在 159 / 160 / 154 / 155
 * 原地重指并备案。时间轴只展示存活卡片的 create / status；资源卡双击直达；
 * 资源与好奇心详情不再展示项目 / 指标归属。
 */
const { check, codeOnly, read } = require('./helpers.cjs')

console.log('【V4.7.4 · 时间轴、卡片池控制条、任务全景与资源夹】')

const TIMELINE = read('/newtab/components/profile/PiTimeline.vue')
const TIMELINE_C = codeOnly(TIMELINE)
const DRAWER = read('/newtab/components/profile/PiTimelineDrawer.vue')
const PROFILE = read('/newtab/views/ProfileInsights.vue')
const OVERVIEW = read('/newtab/components/profile/PiOverview.vue')
const PI_CSS = codeOnly(read('/newtab/components/profile/pi-timeline.css'))
const RES_OPEN = read('/newtab/composables/useResourceOpen.ts')
const HOME = read('/newtab/views/CompassHome.vue')
const HOME_CSS = read('/newtab/views/CompassHome.css')
const DECK = read('/newtab/components/compass/DeckControls.vue')
const TOPIC = read('/newtab/components/compass/TopicManagerPanel.vue')
const FOLDERS = read('/newtab/components/compass/HomeResourceFolderGrid.vue')
const MANIFEST = read('/manifest.ts')
const BACKGROUND = read('/background/index.ts')
const TREE = read('/newtab/views/useCompassTree.ts')
const TREE_PROJECTS = read('/newtab/views/useCompassTreeProjects.ts')
const LAYER_LIST = read('/newtab/components/compass/CompassLayerList.vue')
const SETTINGS_SHORTCUTS = read('/newtab/views/settings/SettingsShortcutsPanel.vue')
const SHORTCUTS = read('/shared/utils/shortcuts.ts')
const MANUAL = read('/newtab/manual-data.ts')

check('V474-1 ★时间轴只保留新增与改状态：删除 / 恢复 / 清理事件不进时间轴，当前已删除卡片连同其历史新增 / 修改记录一并隐藏', () => {
  return TIMELINE.includes("new Set<EventAction>(['create', 'status'])")
    && TIMELINE.includes('if (!TRACKED_ACTIONS.has(event.action)')
    && TIMELINE.includes('if (!card || card.deletedAt) continue')
    && !TIMELINE_C.includes('entry.deleted')
    && !TIMELINE_C.includes('.pit-card.deleted')
    && !TIMELINE_C.includes('已删除')
    && !TIMELINE.includes('restore')
    && !TIMELINE.includes('purge')
})

check('V474-2 ★时间轴单击延迟 260ms 开详情；双击取消详情，资源卡直接打开链接（无链接仍走统一资源打开提示，不回落详情）', () => {
  return TIMELINE.includes('@click="onCardClick(entry)"')
    && TIMELINE.includes('@dblclick.stop.prevent="onCardDblClick(entry)"')
    && TIMELINE.includes('function onCardClick(entry: PiTimelineEntry): void')
    && TIMELINE.includes('if (clickTimer && clickEntryKey === entry.key)')
    && TIMELINE.includes('}, 260)')
    && TIMELINE.includes('function onCardDblClick(entry: PiTimelineEntry): void')
    && TIMELINE.includes('clearClickTimer()')
    && TIMELINE.includes("if (entry.kind === 'resource' || entry.link) emit('open-link', entry)")
    && PROFILE.includes("if (entry.kind === 'resource')")
    && PROFILE.includes('openResourceLink(resource)')
    && RES_OPEN.includes('该卡还没填链接')
})

check('V474-3 ★资源卡 / 好奇心卡不展示项目与指标归属：时间轴小卡无「未关联项目」，详情抽屉仅任务与选题保留两行归属', () => {
  const affiliationRows = (DRAWER.match(/<div v-if="showAffiliation">/g) || []).length
  return TIMELINE.includes("if (entry.kind === 'resource' || entry.kind === 'curiosity') return ''")
    && TIMELINE.includes('v-if="metaOf(entry)" class="pit-card-meta"')
    && DRAWER.includes("const showAffiliation = computed(() => props.entry?.kind === 'task' || props.entry?.kind === 'topic')")
    && affiliationRows === 2
    && OVERVIEW.includes('pi-ov-titleline')
})

check('V474-4（V4.7.7 重指）★画像卡片构成压缩为单面板：标题同排、四格 17/10px 分层、选题成果单行；四格与四个选题下钻一个不少。方向状态模块按用户拍板退役，不再出现主攻双列。', () => {
  const card = PI_CSS.match(/\.pi-ov-card \{[\s\S]*?\}/)?.[0] || ''
  const kpi = PI_CSS.match(/\.pi-ov-kpi \{[^}]*\}/)?.[0] || ''
  const band = OVERVIEW.match(/\.pi-ov-topic-band \{[^}]*\}/)?.[0] || ''
  return card.includes('gap: 6px')
    && card.includes('padding: 12px 16px 10px')
    && PI_CSS.includes('.pi-ov-titleline { display: flex; align-items: baseline;')
    && kpi.includes('min-height: 50px')
    && PI_CSS.includes('.pi-ov-kpi .v { display: block; font-size: var(--fs-headline)')
    && PI_CSS.includes('.pi-ov-kpi .l { display: block; margin-top: 1px; font-size: var(--fs-tiny)')
    && !PI_CSS.includes('.pi-ov-kpi .d {')
    && band.includes('display: flex')
    && OVERVIEW.includes('pi-ov-topic-grid')
    && OVERVIEW.includes('class="pi-ov-topic-all"')
    && /\.pi-ov-topic-grid \{ display: grid; flex: 1; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(OVERVIEW)
    && !codeOnly(OVERVIEW).includes('pi-dir-foot')
    && /\.pi-overview \{ display: block; \}/.test(OVERVIEW)
    && !OVERVIEW.includes('你的方向状态')
    && !OVERVIEW.includes('focusProjects')
    && (OVERVIEW.match(/emit\('kpi-drill', '/g) || []).length === 4
    && (OVERVIEW.match(/emit\('topic-drill', '/g) || []).length === 5
})

check('V474-5 ★四类卡片池控制条统一压缩：任务单行不换行，资源 / 好奇共用 160–260px 搜索，选题 30px 控件；宽屏检索框不再拉满整行', () => {
  return HOME_CSS.includes('.twt-primary {')
    && HOME_CSS.includes('flex-wrap: nowrap')
    && HOME_CSS.includes('max-width: 270px')
    && !HOME_CSS.includes('.twt-secondary')
    && HOME_CSS.includes('@media (max-width: 1260px)')
    && HOME_CSS.includes('.task-work-search { flex-basis: 100%; max-width: none; }')
    && DECK.includes('.dk-search { display: flex; min-width: 160px; max-width: 260px;')
    && DECK.includes('min-height: 28px')
    && TOPIC.includes('.topic-search { display: flex; flex: 0 1 240px; min-width: 180px;')
    && TOPIC.includes('.topic-toolbar select { min-height: 30px;')
    && TOPIC.includes('.topic-new { display: inline-flex; align-items: center; gap: 5px; min-height: 30px;')
})

check('V474-6 ★goto-tasks 名称改为「直达任务全景」，快捷键 / 设置 / 手册三处同口径；路由落方向台 layer=6 并保留 freshAt 以便重复触发', () => {
  return MANIFEST.includes("description: '直达任务全景'")
    && !MANIFEST.includes("description: '直达任务卡池'")
    && BACKGROUND.includes("await openNewtabRoute(`/compass?layer=6&fresh=1&freshAt=${Date.now()}`)")
    && SETTINGS_SHORTCUTS.includes("'goto-tasks': '直达任务全景'")
    && SHORTCUTS.includes("'直达任务全景'")
    && !SHORTCUTS.includes("'直达任务卡池'")
    && MANUAL.includes('直达任务全景')
    && !MANUAL.includes('直达任务卡池')
})

check('V474-7 ★任务全景直接打开第 6 层：切项目塔、清筛选、展开战略骨架并滚到列表；列表按项目分组且包含未归属任务', () => {
  return TREE.includes("if (route.query.layer !== '6') return")
    && TREE.includes("viewMode.value = 'tower'")
    && TREE.includes("dirFilter.value = ''")
    && TREE.includes('riskOnly.value = false')
    && TREE.includes('layerView.value = 6')
    && TREE.includes('spineRef.value?.expandSpine()')
    && TREE.includes("document.getElementById('lvlist-anchor')?.scrollIntoView")
    && TREE.includes('watch(() => route.query, openTaskPanoramaFromQuery)')
    && TREE_PROJECTS.includes('return d.value.tasks.filter(t => !t.deletedAt).map(t => {')
    && TREE_PROJECTS.includes('const directProj = !p && t.projectId ? findProject(t.projectId) : undefined')
    && TREE_PROJECTS.includes('projName: p?.projName || directProj?.name || null')
    && TREE_PROJECTS.includes("projId: p?.projId || directProj?.id || ''")
    && LAYER_LIST.includes('function groupByProject')
    && LAYER_LIST.includes("const key = row.projName ? (row.projId || '__orphan__') : '__orphan__'")
    && LAYER_LIST.includes("name: row.projName || '未归属项目'")
    && LAYER_LIST.includes('v-for="group in taskGroups"')
    && LAYER_LIST.includes('未归属')
})

check('V474-8 ★资源系统夹与常用夹同步瘦身：系统夹 48px、常用夹 54px、宽屏常用夹三列；单行预览取代多行预览，所有点击出口保留', () => {
  return /\.hrf-system-folder \{[^}]*min-height: 48px/.test(FOLDERS)
    && /\.hrf-folder \{[^}]*min-height: 54px/.test(FOLDERS)
    && /\.hrf-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/.test(FOLDERS)
    && !FOLDERS.includes('class="hrf-preview"')
    && FOLDERS.includes('title="打开全部资源卡"')
    && FOLDERS.includes('title="查看今日采集的资源卡"')
    && FOLDERS.includes(':title="`${item.folder.name} · ${item.count} 张资源镜像`"')
    && FOLDERS.includes('@click="openFolderDetail(item.folder)"')
})
