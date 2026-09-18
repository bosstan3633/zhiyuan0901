#!/usr/bin/env node
/**
 * R128-A3 · 硬删引擎运行时测试（node scripts/test-purge.cjs）
 *
 * 为什么需要：regression.cjs 是**源码文本**断言，能守「口径合一」的结构不变量，
 * 但证不了「转卡共享本体不被误删 / 指标引用被摘 / 悬空投射被剪」这三条行为。
 * 本机又缺 Playwright Chromium（E2E 起不来），故用 esbuild 把 purge.ts 打成 CJS，
 * 配一个最小 IndexedDB 假实现记录真实删除调用，直接跑行为。
 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFileSync } = require('child_process')

const SRC = path.resolve(__dirname, '..', 'src', 'shared', 'storage', 'purge.ts')
const OUT = path.join(os.tmpdir(), 'zy_purge_test_' + Date.now() + '.cjs')

execFileSync(path.resolve(__dirname, '..', 'node_modules', '.bin', 'esbuild'),
  [SRC, '--bundle', '--format=cjs', '--platform=node', '--outfile=' + OUT],
  { stdio: 'inherit' })

// ---- 最小 IndexedDB 假实现：只服务 assets.ts 用到的 open / transaction / delete ----
const deletedIds = new Set()
const STORE = 'assets'
function makeReq() {
  const req = {}
  req.__fire = (fn) => { if (fn) setTimeout(() => fn.call(req), 0) }
  return req
}
globalThis.indexedDB = {
  open() {
    const req = makeReq()
    const db = {
      objectStoreNames: { contains: () => true },
      createObjectStore() {},
      transaction(store) {
        const tx = { objectStore: () => ({ delete(id) {
          // 假请求：调用方（reqToPromise）在本函数返回后才挂 onsuccess，故延后一拍再触发
          const r = {}
          setTimeout(() => { deletedIds.add(id); if (r.onsuccess) r.onsuccess() }, 0)
          return r
        } }) }
        setTimeout(() => { if (tx.oncomplete) tx.oncomplete() }, 0)
        return tx
      }
    }
    req.result = db
    setTimeout(() => { if (req.onupgradeneeded) req.onupgradeneeded(); req.__fire(req.onsuccess) }, 0)
    return req
  }
}

const { purgeCardsCompletely, recycledCardsOf } = require(OUT)

let pass = 0, fail = 0
function t(name, fn) {
  try { if (fn() === true) { pass++; console.log('  ✅', name) } else { fail++; console.log('  ❌', name) } }
  catch (e) { fail++; console.log('  ❌', name, '-', e.message) }
}
const card = (id, extra) => ({ id, kind: 'resource', title: id, createdAt: 1, updatedAt: 1, ...extra })

function buildTree() {
  const metric = { id: 'mt1', title: '指标一', taskIds: ['tk1', 'tk2', 'tkGone'] }
  return {
    workspaces: [
      { id: 'ws_cur', name: '资源台', kind: 'resource', order: -1 },
      { id: 'ws_board', name: '某策展台', kind: 'curation', order: 1 }
    ],
    categories: [
      { id: 'cat_alive', workspaceId: 'ws_cur', name: '在用分类', order: 0 },
      { id: 'cat_dead', workspaceId: 'ws_cur', name: '软删分类', order: 1, deletedAt: 5 }
    ],
    resources: [
      // 独立本体 B —— 本次硬删，必须真的删掉
      card('rc1', { workspaceId: 'ws_cur', categoryId: 'cat_alive', deletedAt: 9, assets: [{ id: 'as_B', kind: 'html', name: 'B', mime: 'text/html', size: 1, createdAt: 1 }] }),
      // 在用资源卡，持附件 C —— rc2 不删，所以其镜像投射应保留
      card('rc2', { workspaceId: 'ws_cur', categoryId: 'cat_alive', assets: [{ id: 'as_C', kind: 'image', name: 'C', mime: 'image/png', size: 1, createdAt: 1 }] })
    ],
    tasks: [
      // tk1 与好奇源卡 cz1 共享本体 A（REQ-050 转卡引用拷贝）——硬删 tk1 不能删 A
      { id: 'tk1', kind: 'task', title: '转出任务', status: 'todo', projectId: 'pj1', metricId: 'mt1', deletedAt: 8, updatedAt: 1, assets: [{ id: 'as_A', kind: 'pdf', name: 'A', mime: 'application/pdf', size: 1, createdAt: 1 }] },
      { id: 'tk2', kind: 'task', title: '在用任务', status: 'doing', updatedAt: 1 }
    ],
    curiosities: [
      // 转卡后从回收站**恢复**回来的源卡：与 tk1 共用本体 as_A —— 硬删 tk1 时 A 必须保留
      { id: 'cz1', kind: 'curiosity', question: '好奇源卡', status: 'todo', updatedAt: 1, assets: [{ id: 'as_A', kind: 'pdf', name: 'A', mime: 'application/pdf', size: 1, createdAt: 1 }] }
    ],
    compass: { directions: [{ id: 'dr1', projects: [{ id: 'pj1', name: '项目一', metrics: [metric] }] }] },
    curationProjections: [
      { id: 'p1', kind: 'card', wsId: 'ws_cur', cardId: 'rc2', targetWsId: 'ws_board', addedAt: 1 },
      // 悬空：源卡不存在 → 应剪
      { id: 'p2', kind: 'card', wsId: 'ws_cur', cardId: 'rcGone', targetWsId: 'ws_board', addedAt: 1 },
      // 悬空：目标台已删 → 应剪
      { id: 'p3', kind: 'card', wsId: 'ws_cur', cardId: 'rc1', targetWsId: 'wsGone', addedAt: 1 }
    ]
  }
}

;(async () => {
  console.log('【R128-A3 硬删引擎行为测试】')
  const d = buildTree()
  const targets = recycledCardsOf(d)
  t('recycledCardsOf 只捞软删项（资源/任务/分类；未删的转出源卡不入列）', () =>
    targets.resources.length === 1 && targets.tasks.length === 1 && targets.curiosities.length === 0 && targets.categories.length === 1)

  const r = await purgeCardsCompletely(d, targets)
  await new Promise(res => setTimeout(res, 30)) // 等 IDB 假请求回调

  t('转卡共享本体（as_A）不删——存活侧源卡仍在引用', () => !deletedIds.has('as_A'))
  t('独占本体（as_B）真删', () => deletedIds.has('as_B'))
  t('存活卡附件（as_C）不动', () => !deletedIds.has('as_C'))
  t('计数口径：purged=1 / shared=1 / failed=0', () => r.assetsPurged === 1 && r.assetsShared === 1 && r.assetsFailed === 0)
  t('硬删任务卡后 metric.taskIds 摘除（残留 tk2 与历史 tkGone 原样）', () =>
    JSON.stringify(d.compass.directions[0].projects[0].metrics[0].taskIds) === JSON.stringify(['tk2', 'tkGone']))
  t('数组移除：rc1/tk1/cat_dead 消失，rc2/tk2/cz1 保留', () =>
    !d.resources.some(x => x.id === 'rc1') && !d.tasks.some(x => x.id === 'tk1') &&
    d.curiosities.some(x => x.id === 'cz1') && !d.categories.some(x => x.id === 'cat_dead') &&
    d.resources.some(x => x.id === 'rc2') && d.tasks.some(x => x.id === 'tk2'))
  t('悬空投射剪枝：rcGone/wsGone 两条清除，在用镜像保留', () =>
    d.curationProjections.length === 1 && d.curationProjections[0].id === 'p1')

  // 最后一个引用者消失时，本体才真正回收（不留孤儿）
  d.curiosities[0].deletedAt = 7
  const r2 = await purgeCardsCompletely(d, recycledCardsOf(d))
  await new Promise(res => setTimeout(res, 30))
  t('两侧引用者都硬删后 → 共享本体 finally 回收', () => r2.assetsPurged === 1 && deletedIds.has('as_A'))

  // 回收站里并存的两个引用者：只清一侧不得影响另一侧（恢复后仍可打开）
  deletedIds.clear()
  const d2 = buildTree()
  d2.curiosities[0].deletedAt = 7
  await purgeCardsCompletely(d2, { curiosities: d2.curiosities.filter(c => c.deletedAt) })
  await new Promise(res => setTimeout(res, 30))
  t('只硬删一侧（另一侧尚在回收站）→ 本体保留、零删除', () => deletedIds.size === 0)

  const d3 = buildTree()
  const r3 = await purgeCardsCompletely(d3, {})
  t('空目标调用零副作用（卡数 0 / 树长不变）', () =>
    r3.cards === 0 && d3.resources.length === 2 && d3.tasks.length === 2 && d3.categories.length === 2)

  fs.rmSync(OUT, { force: true })
  console.log(`\npurge 引擎测试：${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
})()
