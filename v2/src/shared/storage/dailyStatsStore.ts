/**
 * R174-3：`zy_daily_stats` 落盘通道（04-69 T1）——热力图不褪色的数据地基。
 *
 * 病根：`buildDailyStats` 每次从 `zy_event_log` 现算，而事件日志 5000 条**滚动淘汰**
 * ⇒ 老日子被挤掉即从热力图消失、`fullSince` 漂移（04-68 §5 登记「要求落盘，实际没写」）。
 * dailyStats.ts 文件头的设计（「只增不淘汰的聚合快照」）由本文件补上缺失的最后一环。
 *
 * 口径（与 hotStats.ts 同构的三条，缺一不可）：
 *  1. **重建是权威**：事件日志覆盖区间内（> 边界日）以重算为准——防刷分 ×0.5、24h 内软删 ×0.3
 *     这类只在事件重放时成立的修正不能被快照固化；
 *  2. **快照只补淘汰的老日子**（≤ 边界日）：事件段以快照为准、字段段以重算为准（见
 *     dailyStats.mergeDailyStats——字段是 doneAt 类时间戳，不进日志、不会被淘汰）；
 *  3. **写是低频小载荷**：随整库保存时间闸（45s）重建+落盘，内容未变跳写；页隐藏/卸载
 *     `flushDailyStatsNow` 跳闸立即写——防抖定时器会随页面冻结丢失，补写必须立即发出
 *     （R173-T2 同款教训）。载荷只有 days（一年活跃 ~200 日 ≈ 20KB 量级），永不整库写。
 *
 * base 一律不存不读：消费方 useDashboardStats 按真实在库数反推校准（重建值透传，见 mergeDailyStats）。
 */
import type { AppData } from '@/shared/models'
import { K } from '@/shared/storage/keys'
import { buildDailyStats, boundaryDayOf, mergeDailyStats, type DailyStats } from '@/shared/utils/dailyStats'
import { readEventLog } from '@/shared/utils/eventLog'

export const DAILY_STATS_STORE_KEY = K.DAILY_STATS

/** 写闸：两次快照落盘的最小间隔——重建是毫秒级，代价在写盘载荷，按时间闸不按次数 */
export const DAILY_STATS_WRITE_GATE_MS = 45_000

function store(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

/** 读快照（启动期一次；坏形状静默按无快照处理——零迁移，无键时合并退化为纯重建） */
export async function readDailySnapshot(): Promise<DailyStats | null> {
  const cs = store()
  if (!cs) return null
  try {
    const cur = (await cs.get([DAILY_STATS_STORE_KEY]))[DAILY_STATS_STORE_KEY]
    if (!cur || (cur as DailyStats).v !== 1 || typeof (cur as DailyStats).days !== 'object') return null
    return cur as DailyStats
  } catch { return null }
}

/** 清快照（回滚/清空数据的 companion，与 clearHot 同位） */
export function clearDailySnapshot(): void {
  const cs = store()
  try { cs?.remove([DAILY_STATS_STORE_KEY]) } catch { /* noop */ }
  snapCache = null
  lastWrittenJson = ''
}

let snapCache: DailyStats | null = null
let snapCacheLoaded = false
let lastWrittenJson = ''
let writeTimer: ReturnType<typeof setTimeout> | null = null
let writeInFlight = false
let snapshotLoad: Promise<DailyStats | null> | null = null
let scheduledData: AppData | null = null
let pendingWriteData: AppData | null = null

/** 读取并注入快照缓存；并发调用复用同一请求，避免多个宿主在启动时互相覆盖缓存。 */
export function loadDailySnapshotCache(): Promise<DailyStats | null> {
  if (snapCacheLoaded) return Promise.resolve(snapCache)
  if (!snapshotLoad) {
    snapshotLoad = readDailySnapshot()
      .then((s) => { setDailySnapshotCache(s); return s })
      .finally(() => { snapshotLoad = null })
  }
  return snapshotLoad
}

/** 快照缓存注入（数据桥显示完成后回填，供合并与写侧共用） */
export function setDailySnapshotCache(s: DailyStats | null): void {
  snapCache = s
  snapCacheLoaded = true
}

/** 重建 + 合并（boundary 取当前事件日志），落盘内容未变则跳写。
 *  ★V3.9.7：画像页是唯一读快照的宿主，但保存链可能在画像页首次挂载前已经排程。
 *  首次写必须等缓存装载（含“无快照”的 null），否则会把已有快照当空值覆盖。
 *  只在 writeDailyStatsNow 的内层等待 loadPromise；外层单飞锁防并发写入。 */
export async function writeDailyStatsNow(data: AppData): Promise<void> {
  const cs = store()
  if (!cs || !data) return
  if (writeInFlight) {
    // 页隐藏补写可能撞上时间闸正在写盘。若直接丢弃，这一次用户动作会等到
    // 下一次整库保存才进入快照；页面已卸载时没有下一次。保留最新数据，写完后再补。
    pendingWriteData = data
    return
  }
  writeInFlight = true
  try {
    const snap = await loadDailySnapshotCache()
    const events = await readEventLog()
    const rebuild = buildDailyStats(data, events)
    const merged = mergeDailyStats(snap, rebuild, boundaryDayOf(events))
    const json = JSON.stringify({ v: 1, days: merged.days, fullSince: merged.fullSince, base: { res: 0, task: 0, curio: 0, link: 0 } })
    if (json === lastWrittenJson) return
    lastWrittenJson = json
    await cs.set({ [DAILY_STATS_STORE_KEY]: JSON.parse(json) })
  } catch { /* 快照写失败不影响主数据，下轮时间闸重试 */ }
  finally {
    writeInFlight = false
    const pending = pendingWriteData
    pendingWriteData = null
    if (pending) void writeDailyStatsNow(pending)
  }
}

/**
 * 整库保存后的时间闸调度（repository saveData/saveDataNow 调用）：
 * 闸内已有排程不重复排；到点走 writeDailyStatsNow。首次调用挂页隐藏/卸载补写监听。
 */
export function scheduleDailyStatsWrite(data: AppData): void {
  lastData = data
  scheduledData = data
  bindLifecycle()
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    const pending = scheduledData
    scheduledData = null
    if (pending) void writeDailyStatsNow(pending)
  }, DAILY_STATS_WRITE_GATE_MS)
}

/** 页隐藏/卸载补写（跳闸立即发出；R173-T2 同款：防抖窗口里的写会随页面一起丢） */
export function flushDailyStatsNow(data: AppData): void {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null }
  scheduledData = null
  void writeDailyStatsNow(data)
}

/* ---- 页隐藏/卸载自动补写：模块级单注册（首次 schedule 时挂上），数据引用取最近一次调度值 ---- */
let lastData: AppData | null = null
let listenersBound = false
function bindLifecycle(): void {
  if (listenersBound || typeof document === 'undefined') return
  listenersBound = true
  const onHide = (): void => { if (document.visibilityState === 'hidden' && lastData) flushDailyStatsNow(lastData) }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', () => { if (lastData) flushDailyStatsNow(lastData) })
}
