/**
 * V4.2.1 · 同一资源卡可在同一策展台的不同节点各挂一份：
 * - 判重域必须精确到“本台 + 本节点”，不能扩大到整个策展台；
 * - 同一节点重复提交仍幂等，不生成第二条投射；
 * - 选择器徽标明确写“已在本节点”，不把同台其他节点的挂载误报成该台已有。
 */
const fs = require('fs')
const { check, read, path, SCRIPTS_DIR } = require('./helpers.cjs')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* source assertions below remain available */ }

function loadHub() {
  if (!esbuild) return null
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'storage', 'hub.ts')
  const out = path.resolve(SCRIPTS_DIR, '..', '.hub-v421.tmp.cjs')
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
  } finally {
    try { fs.unlinkSync(out) } catch { /* no artifact on compile failure */ }
  }
}

const hub = loadHub()

function fixture() {
  return {
    resources: [{
      id: 'pool-card-421',
      kind: 'resource',
      title: '同一张资源卡',
      linkType: 'url',
      link: 'https://example.com/multi-node',
      workspaceId: 'zy-curation',
      categoryId: '',
      tags: [],
      pinned: false,
      callCount: 0,
      customFields: {},
      createdAt: 1,
      updatedAt: 1,
    }],
    workspaces: [
      { id: 'ws-audit', name: '策展台', kind: 'curation', archived: false },
    ],
    categories: [
      { id: 'node-a', workspaceId: 'ws-audit', name: '节点 A', order: 0 },
      { id: 'node-b', workspaceId: 'ws-audit', name: '节点 B', order: 1 },
    ],
    curationProjections: [],
  }
}

console.log('【V4.2.1 · 同台多节点重复挂载同一资源卡】')

check('V421-14 ★同一池卡先挂 A 节点，再挂 B 节点必须都成功：两条独立投射分别落在各自节点，A 的记录不会被 B 改写', () => {
  if (!hub) {
    const src = read('/shared/storage/hub.ts')
    return src.includes('export function projectionsAtNode')
      && src.includes("(p.targetCatId || '') === (targetCatId || '')")
  }
  const data = fixture()
  const a = hub.projectCardToBoardEx(data, 'pool-card-421', 'ws-audit', 'node-a')
  const b = hub.projectCardToBoardEx(data, 'pool-card-421', 'ws-audit', 'node-b')
  return a.created && b.created
    && data.curationProjections.length === 2
    && data.curationProjections.some(p => p.targetCatId === 'node-a')
    && data.curationProjections.some(p => p.targetCatId === 'node-b')
})

check('V421-15 ★判重精确到本节点：A/B 都显示已挂该卡，未挂的 C 节点仍可再次挂；同一节点重复提交保持幂等', () => {
  if (!hub) {
    const src = read('/shared/storage/hub.ts')
    return src.includes('export function mirroredCardIdsAtNode')
      && src.includes("(p.targetCatId || '') === (targetCatId || '')")
  }
  const data = fixture()
  hub.projectCardToBoardEx(data, 'pool-card-421', 'ws-audit', 'node-a')
  hub.projectCardToBoardEx(data, 'pool-card-421', 'ws-audit', 'node-b')
  const atA = hub.mirroredCardIdsAtNode(data, 'ws-audit', 'node-a')
  const atB = hub.mirroredCardIdsAtNode(data, 'ws-audit', 'node-b')
  const atC = hub.mirroredCardIdsAtNode(data, 'ws-audit', 'node-c')
  const again = hub.projectCardToBoardEx(data, 'pool-card-421', 'ws-audit', 'node-a')
  return atA.has('pool-card-421')
    && atB.has('pool-card-421')
    && !atC.has('pool-card-421')
    && !again.created
    && data.curationProjections.length === 2
})

check('V421-16 ★选择器消费单源节点判重并说清边界：使用 mirroredCardIdsAtNode，徽标改为“已在本节点”，不再显示“已在该台”', () => {
  const pyramid = read('/newtab/composables/usePyramid.ts')
  const modal = read('/newtab/components/LinkCardsModal.vue')
  return pyramid.includes('mirroredCardIdsAtNode(d.value, workspaceId.value, linkCardsModal.value.catId)')
    && pyramid.includes('projectCardToBoardEx(d.value, id, workspaceId.value, m.catId).created')
    && modal.includes('已在本节点')
    && modal.includes('同一资源卡可分别挂到本台的不同节点')
    && !modal.includes('已在该台')
})
