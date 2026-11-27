/**
 * V4.7.6 · 历史镜像隐藏跨设备 / 外部写入安全合并。
 * 不同日期、同日不同槽取并集；同日同槽异值必须进入人工选择。
 */
const fs = require('fs')
const path = require('path')
const { check, SCRIPTS_DIR } = require('./helpers.cjs')

console.log('【V4.7.6 · 历史镜像隐藏安全合并】')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* behavior unavailable without compiler */ }

function loadModule(relative, outfile) {
  if (!esbuild) return null
  const out = path.resolve(SCRIPTS_DIR, outfile)
  try {
    esbuild.buildSync({
      entryPoints: [path.resolve(SCRIPTS_DIR, '..', 'src', relative)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    })
    return require(out)
  } finally {
    try { fs.unlinkSync(out) } catch { /* no artifact */ }
  }
}

const mergeTool = loadModule('shared/cloud/threeWayMerge.ts', '.focus-history-merge-v476.tmp.cjs')

function snapshot(hidden) {
  return {
    data: {
      version: 2,
      resources: [],
      tasks: [],
      curiosities: [],
      argCards: [],
      workspaces: [],
      categories: [],
      tagTree: [],
      activityLogs: [],
      dailyFocus: {},
      focusHistoryHidden: hidden,
    },
    ui: null,
    eventLog: [],
  }
}

check('V476-FHM1 ★云合并：不同日期与同日不同槽自动并集，不制造整日数组冲突', () => {
  if (!mergeTool) return false
  const base = snapshot({})
  const local = snapshot({
    '2026-11-20': [{ slotId: 'local-day', hiddenAt: 20 }],
    '2026-11-21': [{ slotId: 'local-slot', hiddenAt: 21 }],
  })
  const remote = snapshot({
    '2026-11-22': [{ slotId: 'remote-day', hiddenAt: 22 }],
    '2026-11-21': [{ slotId: 'remote-slot', hiddenAt: 23 }],
  })
  const result = mergeTool.mergeThreeWaySnapshots(base, local, remote)
  const hidden = result.state.data.focusHistoryHidden
  return result.conflicts.length === 0
    && hidden['2026-11-20'][0].slotId === 'local-day'
    && hidden['2026-11-22'][0].slotId === 'remote-day'
    && hidden['2026-11-21'].map(row => row.slotId).sort().join(',') === 'local-slot,remote-slot'
})

check('V476-FHM2 ★云合并：同日同槽异值默认保留本机并生成冲突，显式选远端才取远端', () => {
  if (!mergeTool) return false
  const local = snapshot({ '2026-11-21': [{ slotId: 'same-slot', hiddenAt: 30 }] })
  const remote = snapshot({ '2026-11-21': [{ slotId: 'same-slot', hiddenAt: 40 }] })
  const preview = mergeTool.mergeThreeWaySnapshots(null, local, remote)
  const conflict = preview.conflicts[0]
  if (!conflict) return false
  const resolved = mergeTool.mergeThreeWaySnapshots(null, local, remote, { [conflict.id]: 'remote' })
  return preview.conflicts.length === 1
    && conflict.type === 'dailyFocus'
    && preview.state.data.focusHistoryHidden['2026-11-21'][0].hiddenAt === 30
    && resolved.state.data.focusHistoryHidden['2026-11-21'][0].hiddenAt === 40
})

check('V476-FHM3 ★外部写入：本页未落盘的不同日 / 异槽隐藏与外部新增自动并集', () => {
  let repository
  try { repository = loadModule('shared/storage/repository.ts', '.repository-focus-history-v476.tmp.cjs') } catch { return false }
  if (!repository) return false
  const date = '2026-11-21'
  const base = { [date]: [{ slotId: 'base-slot', hiddenAt: 10 }] }
  const local = {
    [date]: [{ slotId: 'base-slot', hiddenAt: 10 }, { slotId: 'local-slot', hiddenAt: 20 }],
    '2026-11-20': [{ slotId: 'local-day', hiddenAt: 21 }],
  }
  const remote = {
    [date]: [{ slotId: 'base-slot', hiddenAt: 10 }, { slotId: 'remote-slot', hiddenAt: 30 }],
    '2026-11-22': [{ slotId: 'remote-day', hiddenAt: 31 }],
  }
  const merged = repository.mergeFocusHistoryHidden(local, base, remote)
  return merged[date].map(row => row.slotId).sort().join(',') === 'base-slot,local-slot,remote-slot'
    && merged['2026-11-20'][0].slotId === 'local-day'
    && merged['2026-11-22'][0].slotId === 'remote-day'
})

check('V476-FHM4 ★外部写入：同日同槽双边异值保留本页未落盘值，不被外部静默覆盖', () => {
  let repository
  try { repository = loadModule('shared/storage/repository.ts', '.repository-focus-history-v476.tmp.cjs') } catch { return false }
  if (!repository) return false
  const date = '2026-11-21'
  const merged = repository.mergeFocusHistoryHidden(
    { [date]: [{ slotId: 'same-slot', hiddenAt: 20 }] },
    { [date]: [{ slotId: 'same-slot', hiddenAt: 10 }] },
    { [date]: [{ slotId: 'same-slot', hiddenAt: 30 }] },
  )
  return merged[date][0].hiddenAt === 20
})
