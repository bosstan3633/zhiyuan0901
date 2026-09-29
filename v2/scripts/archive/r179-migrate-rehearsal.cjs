/* R179 迁移真库演练（一次性探针 · 归档）：真库备份上跑 ①分类→标签 ②台内卡入池 的完整链路
 * 口径：数据源 = Downloads 最新 zhiyuan_backup_*.json（与 theme-audit 同源）；迁移模块用 esbuild
 *       现场打包真实 TS 源码（零改写、零 mock）；chrome.storage.local 垫片 set 走 structuredClone
 *       ——与浏览器序列化语义一致，防「备份随迁移被就地改写」的假绿灯。
 * 验四件事：迁移前有活可干 → 迁移前备份落地且是迁移前快照 → 迁移后幂等（再跑零变更、逐字节同哈希）
 *          → 回退（restore 后逐字节等于迁移前）。
 * ★合成样本段：真库样本 boardNative=0（无台内原生非主题卡）⇒ ② 收编分支在真库上是空跑。
 *   故在真库克隆体上追加 3 张合成卡（已有投射 / 主题卡 / 无投射）覆盖收编语义：改写与清空、
 *   主题卡不动、原位投射落 targetWsId+targetCatId、已有投射去重、幂等。
 * 运行：node scripts/archive/r179-migrate-rehearsal.cjs
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const ROOT = path.resolve(__dirname, '..', '..') // v2
const esbuild = require('esbuild')

const dl = path.join(os.homedir(), 'Downloads')
const hits = fs.readdirSync(dl).filter(f => /^zhiyuan_backup_.*\.json$/.test(f)).sort()
if (!hits.length) { console.error('❌ Downloads 无 zhiyuan_backup_*.json'); process.exit(2) }
const srcFile = path.join(dl, hits[hits.length - 1])
const raw = JSON.parse(fs.readFileSync(srcFile, 'utf8'))
const dataIn = raw.zy_data_v2 || raw
console.log(`数据源：${hits[hits.length - 1]}（version=${dataIn.version}）`)

const entry = path.join(ROOT, '.tmp-r179-rehearsal-entry.ts')
const out = path.join(ROOT, '.tmp-r179-rehearsal-entry.cjs')
fs.writeFileSync(entry, [
  "export { migrateCatsToTags, migrateBoardCardsToPool, migratePoolWorkPending, writeMigrateBackup, readMigrateBackup, restoreMigrateBackup } from './src/shared/storage/poolMigration'",
  "export { K } from './src/shared/storage/keys'",
  '',
].join('\n'))
esbuild.buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' })
const M = require(out)

const mem = new Map()
global.chrome = { storage: { local: {
  get: async (k) => { const key = typeof k === 'string' ? k : Array.isArray(k) ? k[0] : Object.keys(k)[0]; return mem.has(key) ? { [key]: structuredClone(mem.get(key)) } : {} },
  set: async (o) => { for (const [k, v] of Object.entries(o)) mem.set(k, structuredClone(v)) },
} } }

const HUB = 'zy-curation'
const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16)
const stats = (d) => ({
  cats: d.categories.length,
  hubCats: d.categories.filter(c => c.workspaceId === HUB).length,
  tagRoots: (d.tagTree || []).length,
  tagChildren: (d.tagTree || []).reduce((n, t) => n + ((t.children || []).length), 0),
  resources: d.resources.length,
  poolCards: d.resources.filter(r => r.workspaceId === HUB && !r.isThesis).length,
  boardNative: d.resources.filter(r => r.workspaceId && r.workspaceId !== HUB && !r.isThesis).length,
  thesisCards: d.resources.filter(r => r.isThesis).length,
  projections: (d.curationProjections || []).length,
})

let ok = true
const assert = (name, cond, extra = '') => { console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? ' — ' + extra : '')); if (!cond) ok = false }

async function main() {
const d = structuredClone(dataIn)
const pre = stats(d)
const preHash = hash(d)
console.log('\n[迁移前]', JSON.stringify(pre))
assert('迁移活可干（migratePoolWorkPending = true）', M.migratePoolWorkPending(d) === true)

M.writeMigrateBackup(d)
const backup = await M.readMigrateBackup()
assert('迁移前备份落地（K.MIGRATE_BACKUP 可读）', !!backup, `at=${backup ? new Date(backup.at).toISOString() : '—'} reason=${backup?.reason}`)
assert('备份是迁移前快照（structuredClone 语义下逐字节等于迁移前）', backup && hash(backup.data) === preHash)

const t0 = Date.now()
const r1 = M.migrateCatsToTags(d)
const t1 = Date.now()
const r2 = M.migrateBoardCardsToPool(d)
const t2 = Date.now()
const post = stats(d)
const rep = d.catsMigrateReport
console.log('\n[迁移后]', JSON.stringify(post))
console.log(`[分工耗时] ①分类→标签 ${t1 - t0}ms · ②台内卡入池 ${t2 - t1}ms`)
if (rep) console.log(`[迁移报告] l1=${rep.l1} l2=${rep.l2} deep=${rep.deep} 卡面触及=${rep.cardsTouched} 标签新增=${rep.tagsAdded} 映射条数=${rep.mapping.length}`)
assert('① 分类→标签 返回变更', r1 === true)
assert('② 台内卡→池 返回变更', r2 === true)
assert('hub 分类实体全退（cats.hubCats → 0）', post.hubCats === 0, `${pre.hubCats} → ${post.hubCats}`)
assert('台内非主题卡全收编（boardNative → 0）', post.boardNative === 0, `${pre.boardNative} → ${post.boardNative}`)
assert('主题卡不收编（isThesis 留台内）', post.thesisCards === pre.thesisCards, `${pre.thesisCards} 张不变`)
assert('策展台自有分类原样保留（cats 减数 = hubCats）', pre.cats - post.cats === pre.hubCats, `${pre.cats} → ${post.cats}（−${pre.cats - post.cats}）`)
assert('投射数增 = 收编卡数', post.projections - pre.projections === pre.boardNative, `${pre.projections} → ${post.projections}（+${post.projections - pre.projections}）`)
assert('池卡 categoryId 全清空', d.resources.every(r => r.workspaceId !== HUB || !r.categoryId))

const postHash = hash(d)
const r1b = M.migrateCatsToTags(d)
const r2b = M.migrateBoardCardsToPool(d)
assert('幂等：二跑双双返回 false', r1b === false && r2b === false)
assert('幂等：数据逐字节不变', hash(d) === postHash)

const restored = await M.restoreMigrateBackup()
assert('回退可用（restore 拿到数据）', !!restored)
assert('回退后逐字节等于迁移前', restored && hash(restored) === preHash)
assert('回退清除迁移落戳', restored && !restored.catsMigratedAt && !restored.boardCardsPooledAt && !restored.catsMigrateReport)

// ===== 合成样本：② 台内卡收编（真库 boardNative=0，收编分支缺真实实例——补合成卡覆盖） =====
const base = { callCount: 0, categoryId: '', createdAt: 1, curOrder: 0, customFields: {}, deletedAt: 0, description: '', importedAt: 1, kind: 'resource', link: '', linkType: 'url', pinned: false, tags: [], title: '', updatedAt: 1 }
const s = structuredClone(dataIn)
s.catsMigratedAt = undefined; s.boardCardsPooledAt = undefined // 刻意构造「迁移前」状态
s.resources.push(
  { ...base, id: 'syn-b1', title: '合成·已有投射的台内卡', workspaceId: 'ws-syn', categoryId: 'cat-syn-1' },
  { ...base, id: 'syn-b2', title: '合成·台内主题卡', workspaceId: 'ws-syn', categoryId: 'cat-syn-2', isThesis: true },
  { ...base, id: 'syn-b3', title: '合成·无投射的台内卡', workspaceId: 'ws-syn', categoryId: 'cat-syn-3' }
)
s.curationProjections = s.curationProjections || []
s.curationProjections.push({ id: 'curp_syn1', kind: 'card', wsId: HUB, cardId: 'syn-b1', targetWsId: 'ws-syn', targetCatId: 'cat-syn-1', addedAt: 1 })
const synPre = stats(s)
const moved = M.migrateBoardCardsToPool(s)
const synPost = stats(s)
const b1 = s.resources.find(r => r.id === 'syn-b1')
const b2 = s.resources.find(r => r.id === 'syn-b2')
const b3 = s.resources.find(r => r.id === 'syn-b3')
const proj = (id) => s.curationProjections.filter(p => p.kind === 'card' && p.cardId === id)
const p3 = proj('syn-b3')[0]
console.log('\n[合成样本 · ②收编]', `boardNative ${synPre.boardNative} → ${synPost.boardNative} · 投射 ${synPre.projections} → ${synPost.projections}`)
assert('② 合成样本返回变更', moved === true)
assert('② 收编：workspaceId → 池 + categoryId 清空', b1.workspaceId === HUB && b1.categoryId === '' && b3.workspaceId === HUB && b3.categoryId === '')
assert('② 主题卡不收编（真身留台内，字段原样）', b2.workspaceId === 'ws-syn' && b2.isThesis === true && b2.categoryId === 'cat-syn-2')
assert('② 原位投射：指向原台与原分类', !!p3 && p3.wsId === HUB && p3.targetWsId === 'ws-syn' && p3.targetCatId === 'cat-syn-3')
assert('② 已有投射不重复生成', proj('syn-b1').length === 1)
const synHash = hash(s)
assert('② 合成样本幂等（二跑 false + 逐字节不变）', M.migrateBoardCardsToPool(s) === false && hash(s) === synHash)

fs.rmSync(entry, { force: true })
fs.rmSync(out, { force: true })
console.log(ok ? '\n✓ R179 迁移真库演练全绿（迁移 → 备份 → 幂等 → 回退）' : '\n❌ R179 迁移真库演练有红')
process.exit(ok ? 0 : 1)
}
main()
