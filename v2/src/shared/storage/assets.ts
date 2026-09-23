/**
 * 第卅九轮 REQ-048：卡片附件存储层 · IndexedDB 库 zy_assets
 *
 * 设计（性能红线）：附件二进制（Blob）绝不进主 JSON zy_data_v2——
 * 主 JSON 只存 AssetMeta 引用（shared/models AssetMeta），本体按 key 存取，读写 O(1)。
 * 几百 MB 附件数据对主链路（保存/启动/搜索/跨页同步）零影响。
 *
 * 库结构：zy_assets / objectStore 'assets'（keyPath 缺省，key = assetId，value = Blob）
 */
import { K } from './keys'
const DB_NAME = K.ASSETS_DB
const STORE = 'assets'

let dbPromise: Promise<IDBDatabase> | null = null

/** 打开库（惰性单例；不支持 IndexedDB 的环境 resolve null，调用方容错） */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error || new Error('open zy_assets failed'))
    } catch (e) {
      reject(e)
    }
  })
  return dbPromise
}

/** 通用 request 包装 */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('idb request failed'))
  })
}

/** 存入附件 Blob（assetId → Blob） */
export async function putAsset(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  if (!db) return
  await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, id))
}

/** 读取附件 Blob（不存在返回 null） */
export async function getAssetBlob(id: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  const blob = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(id))
  return (blob instanceof Blob) ? blob : null
}

/** 删除单个附件 */
export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
}

/** 遍历全部附件（供统计 / 孤儿清理） */
async function forEachAsset(fn: (id: string, blob: Blob) => void): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const curReq = tx.objectStore(STORE).openCursor()
    let n = 0
    curReq.onsuccess = () => {
      const cur = curReq.result
      if (cur) {
        const v = cur.value
        if (v instanceof Blob) { fn(String(cur.key), v); n++ }
        cur.continue()
      }
    }
    tx.oncomplete = () => resolve(n)
    tx.onerror = () => reject(tx.error || new Error('idb cursor failed'))
  })
}

/** 附件占用统计（数量 / 字节）——设置页容量展示用 */
export async function getAssetStats(): Promise<{ count: number; bytes: number }> {
  let count = 0
  let bytes = 0
  try {
    count = await forEachAsset((_id, blob) => { bytes += blob.size || 0 })
  } catch { /* 容错 */ }
  return { count, bytes }
}

/** 收集全部附件 ID（孤儿清理对比用） */
export async function getAllAssetIds(): Promise<string[]> {
  const db = await openDb()
  if (!db) return []
  const ids: string[] = []
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const curReq = tx.objectStore(STORE).openCursor()
    curReq.onsuccess = () => {
      const cur = curReq.result
      if (cur) { ids.push(String(cur.key)); cur.continue() }
    }
    tx.oncomplete = () => resolve(ids)
    tx.onerror = () => reject(tx.error || new Error('idb cursor failed'))
  })
}

/** 清理孤儿附件：删除不在 keepIds 中的所有附件，返回清理数量。
 *  调用方应传「全部卡片（含回收站软删卡）的 assets id 并集」——软删可恢复，故其附件必须保留 */
export async function cleanupOrphanAssets(keepIds: Set<string>): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  const orphans: string[] = []
  await forEachAsset((id) => { if (!keepIds.has(id)) orphans.push(id) }).catch(() => {})
  if (!orphans.length) return 0
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const id of orphans) store.delete(id)
    tx.oncomplete = () => resolve(orphans.length)
    tx.onerror = () => reject(tx.error || new Error('idb cleanup failed'))
  })
}

/** 收集一组 AssetMeta 的 id 集合（工具：卡片数组 → keepIds） */
export function assetIdsOf(metas: { id: string }[] | null | undefined): Set<string> {
  const s = new Set<string>()
  ;(metas || []).forEach(m => s.add(m.id))
  return s
}

/** 第卌二轮 REQ-059：读取全部附件（id + Blob）——附件包导出用 */
export async function getAllAssets(): Promise<{ id: string; blob: Blob }[]> {
  const out: { id: string; blob: Blob }[] = []
  await forEachAsset((id, blob) => out.push({ id, blob }))
  return out
}

/** 第卌二轮 REQ-059：批量写入附件（附件包导入用；同 ID 覆盖，q-3 拍板） */
export async function putAssets(items: { id: string; blob: Blob }[]): Promise<void> {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const it of items) store.put(it.blob, it.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('idb bulk put failed'))
  })
}
