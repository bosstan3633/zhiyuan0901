/**
 * V4.2.4 · 三方安全合并 / 立即同步快捷键 / 方向台就地编辑 / 空指标拖拽。
 *
 * 行为断言直接加载产品里的 threeWayMerge.ts：
 * - A 与本机、远端与共同基线三方比较；
 * - 不同记录、不同字段取并集；
 * - 只有同记录同字段冲突才要求选择；
 * - 删除 / 修改冲突不得被任何一端静默覆盖。
 */
const fs = require('fs')
const path = require('path')
const { check, read, SCRIPTS_DIR } = require('./helpers.cjs')

console.log('【V4.2.4 · 三方安全合并 / 立即同步快捷键 / 方向台就地编辑】')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* source fallback below */ }

function loadThreeWayMerge() {
  if (!esbuild) return null
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'cloud', 'threeWayMerge.ts')
  const out = path.resolve(SCRIPTS_DIR, '..', '.three-way-merge-v424.tmp.cjs')
  try {
    esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    })
    return require(out)
  } catch {
    return null
  } finally {
    try { fs.unlinkSync(out) } catch { /* no artifact on compile failure */ }
  }
}

const mergeTool = loadThreeWayMerge()

function resource(id, fields = {}) {
  return {
    id,
    kind: 'resource',
    title: `资源 ${id}`,
    description: '',
    linkType: 'url',
    link: `https://example.com/${id}`,
    workspaceId: 'zy-curation',
    categoryId: '',
    tags: [],
    pinned: false,
    callCount: 0,
    customFields: {},
    createdAt: 1,
    updatedAt: 1,
    ...fields,
  }
}

function snapshot(resources, extra = {}) {
  return {
    data: {
      version: 2,
      resources,
      tasks: [],
      curiosities: [],
      argCards: [],
      workspaces: [],
      categories: [],
      tagTree: [],
      activityLogs: [],
      dailyFocus: {},
      ...extra,
    },
    ui: null,
    eventLog: [],
  }
}

function rowsOf(result) {
  return new Map((result.state.data.resources || []).map(row => [row.id, row]))
}

check('V424-M1 ★不同记录取并集：本机修改 A、云端修改 B，同时两端各新增一张，合并后四类改动全部保留', () => {
  if (!mergeTool) return false
  const base = snapshot([resource('r1', { title: 'A0' }), resource('r2', { title: 'B0' })])
  const local = snapshot([
    resource('r1', { title: 'A-local', updatedAt: 20 }),
    resource('r2', { title: 'B0' }),
    resource('r3', { title: '只在 A 新增', updatedAt: 21 }),
  ])
  const remote = snapshot([
    resource('r1', { title: 'A0' }),
    resource('r2', { title: 'B-remote', updatedAt: 22 }),
    resource('r4', { title: '只在 B 新增', updatedAt: 23 }),
  ])
  const result = mergeTool.mergeThreeWaySnapshots(base, local, remote)
  const rows = rowsOf(result)
  return result.conflicts.length === 0
    && rows.get('r1')?.title === 'A-local'
    && rows.get('r2')?.title === 'B-remote'
    && rows.get('r3')?.title === '只在 A 新增'
    && rows.get('r4')?.title === '只在 B 新增'
})

check('V424-M2 ★同记录不同字段取并集：本机改标题、云端改描述，不弹冲突且两处修改都保留', () => {
  if (!mergeTool) return false
  const base = snapshot([resource('r1', { title: '标题 0', description: '描述 0' })])
  const local = snapshot([resource('r1', { title: '本机标题', description: '描述 0', updatedAt: 20 })])
  const remote = snapshot([resource('r1', { title: '标题 0', description: '云端描述', updatedAt: 22 })])
  const result = mergeTool.mergeThreeWaySnapshots(base, local, remote)
  const row = rowsOf(result).get('r1')
  return result.conflicts.length === 0
    && row?.title === '本机标题'
    && row?.description === '云端描述'
})

check('V424-M3 ★同记录同字段冲突才要求逐项选择：默认保留本机，显式选云端后结果改为云端值', () => {
  if (!mergeTool) return false
  const base = snapshot([resource('r1', { title: '标题 0' })])
  const local = snapshot([resource('r1', { title: '本机标题', updatedAt: 20 })])
  const remote = snapshot([resource('r1', { title: '云端标题', updatedAt: 22 })])
  const preview = mergeTool.mergeThreeWaySnapshots(base, local, remote)
  const conflict = preview.conflicts[0]
  if (!conflict) return false
  const resolved = mergeTool.mergeThreeWaySnapshots(base, local, remote, { [conflict.id]: 'remote' })
  return preview.conflicts.length === 1
    && conflict.kind === 'field'
    && conflict.field === 'title'
    && rowsOf(preview).get('r1')?.title === '本机标题'
    && rowsOf(resolved).get('r1')?.title === '云端标题'
    && !mergeTool.hasConflictChoices(resolved.conflicts, { [conflict.id]: 'remote' })
})

check('V424-M4 ★删除 / 修改冲突不得静默覆盖：保留本机则软删记录保留，保留云端则恢复云端修改稿', () => {
  if (!mergeTool) return false
  const base = snapshot([resource('r1', { title: '标题 0' })])
  const local = snapshot([resource('r1', { title: '标题 0', deletedAt: 30, updatedAt: 30 })])
  const remote = snapshot([resource('r1', { title: '云端修改稿', updatedAt: 31 })])
  const preview = mergeTool.mergeThreeWaySnapshots(base, local, remote)
  const conflict = preview.conflicts[0]
  if (!conflict) return false
  const keepLocal = mergeTool.mergeThreeWaySnapshots(base, local, remote, { [conflict.id]: 'local' })
  const keepRemote = mergeTool.mergeThreeWaySnapshots(base, local, remote, { [conflict.id]: 'remote' })
  return conflict.kind === 'delete-modify'
    && rowsOf(keepLocal).get('r1')?.deletedAt === 30
    && rowsOf(keepRemote).get('r1')?.title === '云端修改稿'
    && !rowsOf(keepRemote).get('r1')?.deletedAt
})

check('V424-M5 ★共同基线参与判定：远端未改而本机删卡时可删除；云快照输出仍固定 ui:null', () => {
  if (!mergeTool) return false
  const base = snapshot([resource('r1'), resource('r2')])
  const local = snapshot([resource('r1')])
  const remote = snapshot([resource('r1'), resource('r2')])
  const result = mergeTool.mergeThreeWaySnapshots(base, local, remote)
  return result.state.ui === null
    && !rowsOf(result).has('r2')
    && result.conflicts.length === 0
})

check('V424-M6 ★共同基线持久化与安全上传接线：独立 storage key、上传 / 拉回后都写基线，三方合并先算预览再决定', () => {
  const keys = read('/shared/storage/keys.ts')
  const sync = read('/shared/cloud/sync.ts')
  const merge = read('/shared/cloud/threeWayMerge.ts')
  const hook = read('/newtab/composables/useCloudSync.ts')
  return keys.includes('CLOUD_SYNC_BASE:')
    && sync.includes('export async function getSyncBaseline(userId: string)')
    && sync.includes('export async function writeSyncBaseline(')
    && sync.includes('const preview = mergeThreeWaySnapshots(baseline?.state || null, localState, beforeState)')
    && sync.includes('await writeSyncBaseline(meta.userId, candidate, rev, fingerprint)')
    && hook.includes('await sync.markDownloaded(')
    && hook.includes('downloaded.state,')
    && merge.includes('baseKnown')
})

check('V424-M7 ★快捷键已变更为独立动作：注册“立即同步云端”，后台直接派发 zy:sync-cloud-now，不再打开云同步页', () => {
  const manifest = read('/manifest.ts')
  const background = read('/background/index.ts')
  const shortcuts = read('/shared/utils/shortcuts.ts')
  const settings = read('/newtab/views/settings/SettingsShortcutsPanel.vue')
  const manual = read('/newtab/manual-data.ts')
  return manifest.includes("'sync-cloud-now': {")
    && manifest.includes("description: '立即同步云端'")
    && !manifest.includes("'open-cloud-sync': {")
    && background.includes("case 'sync-cloud-now'")
    && background.includes("type: 'zy-sync-cloud-now'")
    && background.includes("zy-action=sync-cloud")
    && shortcuts.includes("'立即同步云端'")
    && settings.includes("'sync-cloud-now': '立即同步云端'")
    && manual.includes('立即同步云端')
})

check('V424-M8 ★项目 / 指标就地编辑：项目名有独立编辑入口，指标双击标题改名并失焦或 Enter 保存，全局走同一 store.persist', () => {
  const projectTitle = read('/newtab/components/compass/CompassProjectTitle.vue')
  const panoProject = read('/newtab/components/compass/CompassPanoProjectName.vue')
  const metricTitle = read('/newtab/components/compass/CompassMetricTitle.vue')
  const projects = read('/newtab/views/useCompassTreeProjects.ts')
  const compassTree = read('/newtab/views/CompassTree.vue')
  return projectTitle.includes('aria-label="重命名项目"')
    && projectTitle.includes('@click.stop="emit(\'rename\')"')
    && panoProject.includes('aria-label="重命名项目"')
    && metricTitle.includes('@dblclick.stop="emit(\'edit\', $event)"')
    && metricTitle.includes('@blur="saveOnBlur"')
    && metricTitle.includes('@keydown.enter.prevent="saveOnEnter"')
    && projects.includes('function startEdit(field: string')
    && projects.includes('function saveEdit(field: string')
    && projects.includes("const separator = field.indexOf('-')")
    && projects.includes('field.slice(separator + 1)')
    && projects.includes("} else if (type === 'metric') {")
    && projects.includes('m.title = val')
    && projects.includes('store.persist()')
    && compassTree.includes("@edit-metric-title=\"(id, ev) => startEdit('metric-' + id, ev)\"")
    && compassTree.includes("@save-metric-title=\"(id, ev) => saveEdit('metric-' + id, ev)\"")
    && compassTree.includes("@edit-title=\"(mid, ev) => startEdit('metric-' + mid, ev)\"")
    && compassTree.includes("@save-title=\"(mid, ev) => saveEdit('metric-' + mid, ev)\"")
})

check('V424-M9 ★空成功指标整卡可接收任务：dragover / dragleave / drop 挂在指标卡根节点，而非只在非空任务列表上', () => {
  const lane = read('/newtab/components/compass/CompassLane.vue')
  const card = lane.slice(lane.indexOf('class="metric-card"'), lane.indexOf('</section>', lane.indexOf('class="metric-card"')))
  return card.includes('@dragover.prevent="taskDnd?.onLaneDragOver($event, m.id)"')
    && card.includes('@dragleave="taskDnd?.onLaneDragLeave($event, m.id)"')
    && card.includes('@drop.prevent="taskDnd?.onLaneDrop($event, m.id)"')
    && card.indexOf('@drop.prevent="taskDnd?.onLaneDrop') < card.indexOf('<ul v-if="open && m.tasks.length"')
})
