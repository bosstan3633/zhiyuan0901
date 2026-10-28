/**
 * V3.9.23 · 跨模块体验收口。
 *
 * 本轮改动横跨方向台、任务详情、画像、策展台、调度台与数据管理。
 * 这些断言锁住各模块的真实接线和交互边界，防止后续局部重构只保留视觉外壳。
 */
const { check, read, codeOnly, segOf } = require('./helpers.cjs');

console.log('【V3.9.23 · 跨模块体验收口】');

check('XM-01 ★方向层级标签三处接线：战略目标 / 项目 / 指标共用 CompassLevelTag；当前主攻聚焦条已从方向台移除', () => {
  const tree = read('/newtab/views/CompassTree.vue');
  const tower = read('/newtab/components/compass/CompassTower.vue');
  const lane = read('/newtab/components/compass/CompassLane.vue');
  const pano = read('/newtab/components/compass/CompassPanoLane.vue');
  const tag = read('/newtab/components/compass/CompassLevelTag.vue');
  const treeCode = codeOnly(tree);
  const treeLogic = read('/newtab/views/useCompassTree.ts');
  return tree.includes("import CompassLevelTag from '../components/compass/CompassLevelTag.vue'")
    && tree.includes('<CompassLevelTag :level="3" kind="direction" icon="compass" label="战略目标" />')
    && tower.includes('<CompassLevelTag :level="4" kind="project" icon="package" label="项目" />')
    && lane.includes('<CompassLevelTag :level="5" kind="metric" icon="target" label="指标" />')
    && pano.includes('<CompassLevelTag :level="5" kind="metric" icon="target" label="指标" />')
    && tag.includes("kind: 'direction' | 'project' | 'metric'")
    && tag.includes('.level-tag.direction')
    && tag.includes('.level-tag.project')
    && tag.includes('.level-tag.metric')
    && treeCode.includes('focusTower')
    && treeCode.includes('gotoFocusTower')
    && treeLogic.includes('const focusTower = computed')
    && treeLogic.includes('function gotoFocusTower()')
    && !treeCode.includes('当前主攻');
});

check('XM-02（V3.9.26 重指）★任务详情首屏：导出上移标题栏右上；项目/指标压缩为轻量双栏；AI 三入口成组且「找资源」完整显示；所有宿主复用同一抽屉', () => {
  const td = read('/newtab/components/compass/TaskDetailDrawer.vue');
  const titleAt = td.indexOf('<div class="ts-title-wrap">');
  const exportAt = td.indexOf('<ExportMenu class="ts-title-export"');
  const ownerAt = td.indexOf('<div class="ts-section ts-owner ds-props2">');
  const actionsAt = td.indexOf('<div class="ts-action-bar">');
  const descAt = td.indexOf('<!-- R48：说明区上移为 Hero');
  const aiGroup = td.slice(td.indexOf('<div class="ts-ai-group"'), descAt);
  return titleAt >= 0 && exportAt > titleAt && exportAt < ownerAt && actionsAt > ownerAt && descAt > actionsAt
    && aiGroup.includes('aria-label="AI 任务工具"')
    && (aiGroup.match(/class="ts-ai-cell"/g) || []).length === 3
    && aiGroup.includes('@click="aiEnrich"')
    && aiGroup.includes('@click="aiBreakdown"')
    && aiGroup.includes('@click="aiSupport()"')
    && aiGroup.includes('label="找资源"')
    && td.includes('.ts-title-export :deep(.dz-exp-trigger)')
    && td.includes('.ts-owner { gap: 6px; padding: 0; border: 0; background: transparent;')
    && td.includes('@media (max-width: 560px)')
    && td.includes('.ts-action-bar { align-items: stretch; flex-wrap: wrap; }')
    && [
      '/newtab/views/CompassTree.vue',
      '/newtab/views/CompassHome.vue',
      '/newtab/views/ProjectCuration.vue',
      '/newtab/components/ProjectDetailDrawer.vue',
      '/newtab/components/compass/MetricDetailDrawer.vue',
      '/newtab/components/compass/TaskManagerPanel.vue',
      '/newtab/views/ProfileInsights.vue',
      '/newtab/views/settings/SettingsDataManagement.vue',
    ].every(file => read(file).includes('TaskDetailDrawer'));
});

check('XM-03 ★画像年度段：只撤年度诊断提示条；四格指标均可下钻；热力图按 12 自然月分组、月间留空列、全年单行且窄屏横滚', () => {
  const py = read('/newtab/components/profile/PiYear.vue');
  const hm = read('/newtab/components/dashboard/Heatmap.vue');
  const css = read('/newtab/components/dashboard/dashboard.css');
  const pi = read('/newtab/views/ProfileInsights.vue');
  const drill = read('/newtab/components/profile/PiYearMetricDrawer.vue');
  return !py.includes('one-insight')
    && !py.includes('去下方唤醒')
    && (py.match(/class="pi-chip/g) || []).length === 4
    && (py.match(/@click="emit\('drill'/g) || []).length === 4
    && py.includes("'yr-active'") && py.includes("'yr-streak'") && py.includes("'yr-assets'") && py.includes("'yr-high'")
    && pi.includes('<PiYearMetricDrawer') && pi.includes(':days="yearMetricDays"') && pi.includes(':cards="yearMetricCardRows"')
    && drill.includes("mode: 'days' | 'streak' | 'cards'")
    && drill.includes("emit('open-day', row.day)") && drill.includes("emit('open-card', row)")
    && hm.includes('const yearLayout = computed')
    && hm.includes('const MONTH_GAP = 2')
    && hm.includes('offset += cols + MONTH_GAP')
    && hm.includes('gridColumnStart: t.col + 2')
    && hm.includes('gridColumnStart: c.col + 2')
    && hm.includes('12 个自然月分组')
    && css.includes('.dz-year-scroll') && css.includes('min-width: 760px');
});

check('XM-04 ★策展台真删除：右键不再提供归档；资源卡/分类/论证卡进回收站；镜像释放不落池；3 秒整台撤销可恢复', () => {
  const app = read('/newtab/App.vue');
  const meta = read('/newtab/composables/useWsMeta.ts');
  const crud = read('/shared/utils/compassCrud.ts');
  return app.includes("async function deleteDeckFromTab()")
    && /<div class="ctx-item danger"[^>]*@click="deleteDeckFromTab"[^>]*><Icon name="trash"[^>]*\/> 删除策展台<\/div>/.test(app)
    && !app.includes('归档此台')
    && !app.includes('archiveWorkspace(store.data, ws)')
    && app.includes('deleteDeck(store.data, ws.id)')
    && app.includes('restoreDeck(store.data, snap)')
    && app.includes('DECK_DELETE_UNDO_WINDOW_MS')
    && meta.includes('deleteDeck(d.value, workspaceId.value)')
    && meta.includes('restoreDeck(d.value, snap)')
    && crud.includes('export function deleteDeck')
    && crud.includes('export function restoreDeck')
    && crud.includes('for (const r of d.resources) if (r.workspaceId === wsId && !r.deletedAt) { r.deletedAt = now; cardIds.push(r.id) }')
    && crud.includes('for (const c of d.categories) if (c.workspaceId === wsId && !c.deletedAt) { c.deletedAt = now; catIds.push(c.id) }')
    && crud.includes('for (const a of d.argCards || []) if (a.workspaceId === wsId && !a.deletedAt) { a.deletedAt = now; argCardIds.push(a.id) }')
    && crud.includes('if (wsId === CURATION_WS_ID) return null')
    && crud.includes('const mirrorIds = new Set')
    && crud.includes('for (const row of snap.mirrorResourceCategoryIds)')
    && !crud.includes('r.workspaceId = CURATION_WS_ID');
});

check('XM-05 ★中心论点操作收口：编辑与 AI 只在论点卡详情；详情无分享；页头不再堆三枚按钮；画布保留整台分享', () => {
  const ws = read('/newtab/views/Workspace.vue');
  const td = read('/newtab/components/curation/CurationThesisDrawer.vue');
  const mm = read('/newtab/components/curation/CurationMindMap.vue');
  const css = read('/newtab/views/workspace.css');
  return ws.includes('<CurationThesisDrawer')
    && ws.includes(':ws-id="workspaceId"') && ws.includes(':ws-name="wsDisplayName"')
    && ws.includes('@open-thesis="openThesisCard"')
    && ws.includes('shareOpen = true') && ws.includes('<CurationShareDrawer')
    && !ws.includes('编辑中心论点') && !ws.includes('AI 提炼骨架')
    && td.includes('v-model="title"') && td.includes('v-model="description"')
    && td.includes('<ThesisAiBtn :ws-id="wsId" :ws-name="wsName"')
    && !td.includes('分享')
    && mm.includes("emit('open-thesis')") && mm.includes("emit('open-create-thesis')")
    && css.includes('.ws-hero { display: grid;')
    && css.includes('.ws-id-head { display: flex;');
});

check('XM-06 ★策展连线：按真实节点坐标生成正交折线，父右缘到子左缘完整咬合，布局/节点尺寸变化自动重算', () => {
  const mm = read('/newtab/components/curation/CurationMindMap.vue');
  return mm.includes('V3.9.14：树状连线改用真实节点坐标生成 SVG 正交折线')
    && mm.includes('const connectors = ref<Connector[]>([])')
    && mm.includes('connectorObserver = new ResizeObserver')
    && mm.includes('scheduleTreeConnectors')
    && mm.includes("querySelectorAll<HTMLElement>('.mind-node')")
    && mm.includes('<svg v-if="layout === \'tree\'" class="mind-connectors"')
    && mm.includes('<path v-for="(line, i) in connectors"')
    && mm.includes('父右 → 中线 → 子左');
});

check('XM-07 ★V3.9.26 重指：调度台右栏只保留今天状态与最近调出；固定 6 条；左右模块共享内容网格，状态轨移出网格并取消右栏吸附，滚动时不再覆盖', () => {
  const home = read('/newtab/views/CompassHome.vue');
  const logic = read('/newtab/views/useCompassHome.ts');
  const css = read('/newtab/views/CompassHome.css');
  const homeCode = codeOnly(home);
  return !homeCode.includes('好奇心培育')
    && home.includes('<b>今天的状态</b>')
    && home.includes('<b>最近调出</b>')
    && home.includes('rail-panel-recent')
    && logic.includes('const recentLimit = computed(() => 6)')
    && logic.includes('.slice(0, recentLimit.value)')
    && css.includes('.desk-layout {')
    && !css.includes('grid-template-rows: auto minmax(0, 1fr) auto;')
    && css.includes('.desk-status-rail { margin-top: 18px; position: relative; z-index: 0; }')
    && css.includes('.side-rail { position: relative; top: auto; }')
    && css.includes('左右模块仍保持起点、间距与底部收口一致')
    && !css.includes('.rail-panel-recent { height: 100%')
    && !css.includes('.side-rail { height: 100%')
    && !home.includes('useEqualHeight')
    && !logic.includes('useEqualHeight');
});

check('XM-08 ★附件管理：附件行打开所属卡片详情；任务详情关闭与资源详情关闭都会刷新；删除附件后回到列表读到最新状态', () => {
  const dm = read('/newtab/views/settings/SettingsDataManagement.vue');
  const row = segOf(dm, '<button v-for="r in filteredAssetRows"', '</button>');
  return row.includes('@click="openAssetOwner(r)"')
    && row.includes(':disabled="!r.owner.cardId"')
    && dm.includes('taskDetailRef.value?.open(task)')
    && dm.includes('curiosityPanelRef.value?.openDetail(curiosity.id)')
    && dm.includes('argumentDrawerOpen.value = true')
    && dm.includes('@closed="refreshAssetRows"')
    && dm.includes("if (payload.kind === 'res') void refreshAssetRows()")
    && dm.includes('void refreshAssetRows()')
    && dm.includes('await getAllAssetIndex()')
    && dm.includes('collectAssetRows(gd.value, index)');
});

check('XM-09 ★书签导入并入数据包：无目标策展台选择；解析后直接写资源卡池；不建台/分类；文件夹路径只转标签', () => {
  const dm = read('/newtab/views/settings/SettingsDataManagement.vue');
  const bk = read('/newtab/composables/useBookmarkImport.ts');
  return dm.includes("type DataTab = 'package' | 'assets' | 'airtable'")
    && dm.includes("tab === 'package'") && dm.includes('浏览器书签')
    && dm.includes('解析后直接进入资源卡池；文件夹路径转为资源标签')
    && !dm.includes("tab === 'bookmark'")
    && !dm.includes('目标策展台')
    && bk.includes('workspaceId: CURATION_WS_ID')
    && bk.includes("categoryId: ''")
    && bk.includes('tags, assets: [], customFields: {}')
    && bk.includes('data.resources.unshift(card)')
    && bk.includes('const tags = Array.from(new Set(b.path.filter')
    && bk.includes('不创建“书签导入”策展台或台内分类')
    && !bk.includes('workspaces.push')
    && !bk.includes('categories.push');
});

check('XM-10 ★数据管理信息架构：只保留数据包 / 附件管理 / Airtable 三个页签，旧独立书签页签零残留', () => {
  const dm = read('/newtab/views/settings/SettingsDataManagement.vue');
  return (dm.match(/class="dm-tab"/g) || []).length === 3
    && dm.includes("tab = 'package'") && dm.includes("tab = 'assets'") && dm.includes("tab = 'airtable'")
    && !dm.includes('书签导入</button>')
    && !dm.includes('targetWorkspace')
    && !dm.includes('folderPicker');
});

check('XM-11 ★V3.9.24 高频交互预热：首屏稳定后空闲预取全局检索与常用台面；预取失败不阻塞主流程，卸载时清理计时器', () => {
  const app = read('/newtab/App.vue');
  return app.includes("const loadGlobalPopups = () => import('./components/GlobalPopups.vue')")
    && app.includes('requestIdleCallback(run, { timeout: 2000 })')
    && app.includes("import('./views/CompassTree.vue')")
    && app.includes("import('./views/Workspace.vue')")
    && app.includes('Promise.allSettled([')
    && app.includes('clearTimeout(prefetchTimer)')
    && app.includes('cancelIdleCallback(prefetchIdle)');
});
