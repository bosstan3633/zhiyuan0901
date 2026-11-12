/**
 * V4.2.5 · 首次同步 / 无共同基线时的派生字段安全合并。
 *
 * 回归事故：V4.2.4 在两端缺少不同派生时间字段时，把内部 MISSING Symbol
 * 直接交给 Number()，导致 "Cannot convert a Symbol value to a number"。
 */
const fs = require('fs')
const path = require('path')
const { check, read, SCRIPTS_DIR } = require('./helpers.cjs')

console.log('【V4.2.5 · 无共同基线的派生字段安全合并】')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* source fallback below */ }

function loadThreeWayMerge() {
  if (!esbuild) return null
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'cloud', 'threeWayMerge.ts')
  const out = path.resolve(SCRIPTS_DIR, '..', '.three-way-merge-v425.tmp.cjs')
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

function snapshot(resources) {
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
    },
    ui: null,
    eventLog: [],
  }
}

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

check('V425-S1 ★无共同基线且一端缺 createdAt 时不再抛 Symbol 转数字异常，缺失端使用另一端有效时间', () => {
  if (!mergeTool) return false
  const shared = {
    title: '同一张资源卡',
    description: '同一内容',
  }
  const local = snapshot([resource('r1', {
    ...shared,
    createdAt: 100,
    updatedAt: 200,
  })])
  const remoteRow = resource('r1', {
    ...shared,
    updatedAt: 300,
  })
  delete remoteRow.createdAt
  const remote = snapshot([remoteRow])
  const result = mergeTool.mergeThreeWaySnapshots(null, local, remote)
  const row = result.state.data.resources?.[0]
  return result.conflicts.length === 0
    && row?.createdAt === 100
    && row?.updatedAt === 300
})

check('V425-S2 ★无共同基线且两端缺不同派生字段时按“保留可用值”合并，不把缺失占位符写入结果', () => {
  if (!mergeTool) return false
  const localRow = resource('r1', { title: '本地标题', createdAt: 100 })
  delete localRow.updatedAt
  delete localRow.callCount
  const remoteRow = resource('r1', {
    title: '本地标题',
    updatedAt: 300,
    callCount: 9,
  })
  delete remoteRow.createdAt
  const result = mergeTool.mergeThreeWaySnapshots(
    null,
    snapshot([localRow]),
    snapshot([remoteRow]),
  )
  const row = result.state.data.resources?.[0]
  return result.conflicts.length === 0
    && row?.createdAt === 100
    && row?.updatedAt === 300
    && row?.callCount === 9
    && typeof row?.createdAt === 'number'
    && typeof row?.updatedAt === 'number'
})

check('V425-S3 ★派生字段合并不再直接 Number(MISSING)：数值读取只接受有限数字或数字字符串', () => {
  const merge = read('/shared/cloud/threeWayMerge.ts')
  const derived = merge.slice(merge.indexOf('function finiteNumber'), merge.indexOf('function mergePrimitiveArray'))
  const directLocalNumber = /(^|[^\w])Number\(local\)/m.test(derived)
  const directRemoteNumber = /(^|[^\w])Number\(remote\)/m.test(derived)
  return derived.includes("typeof value === 'number'")
    && derived.includes('Number.isFinite(value)')
    && derived.includes("typeof value === 'string'")
    && !directLocalNumber
    && !directRemoteNumber
    && !derived.includes('[local, remote].map(Number)')
})
