/**
 * 第卌四轮 T-05：卡片操作事件日志（zy_event_log）
 *
 * 目的：回答"我什么时间新增/删除了什么卡片"——回收站 purge 物理删除与恢复会抹掉
 * createdAt/deletedAt 线索，纯派生有两个盲区；本日志 append-only 补齐，purge 后历史仍在。
 *
 * 实现要点：
 *  - 独立存储键 zy_event_log（不进主 JSON zy_data_v2，不碰卡片模型）
 *  - 由 repository 层在 saveData/saveDataNow 时对卡片做快照 diff 自动产出事件：
 *    新 id=create / deletedAt 置位=delete / deletedAt 清除=restore / id 消失=purge
 *    —— 任何业务路径（策展台/任务中心/罗盘/回收站/采集弹窗）统一覆盖，零散点挂钩易漏
 *  - 5000 条滚动淘汰（≈0.6MB）；批量导入/回滚等大规模变动合并为一条 system 摘要事件防爆量
 *  - 外部写入（chrome.storage.onChanged → syncCache）静默重建快照：事件由执行写入的上下文记录
 *  - 日志为空时（老数据）UI 回退纯派生（createdAt/deletedAt），新旧无缝
 */
import type { AppData } from '@/shared/models'
import { K } from '@/shared/storage/keys'

export type CardKind = 'resource' | 'task' | 'curiosity'
/**
 * R117（04-61 C3）：新增 `status` —— 好奇心卡**探索状态变更**（待探索/探索中/已求证/已搁置）。
 * 动机：用户要求「好奇心探索指标把采集 / 状态变更 / 删除都计入并取累计值」，
 * 而快照 diff 原先只认 createdAt / deletedAt，状态变化没有任何痕迹 ⇒ 累计值永远缺一半。
 */
export type EventAction = 'create' | 'delete' | 'restore' | 'purge' | 'status'

export interface CardEvent {
  id: string
  ts: number
  action: EventAction
  /** system = 批量摘要事件（导入/回滚），不属于任何单一卡片类型 */
  kind: CardKind | 'system'
  title: string
  cardId: string
}

export const EVENT_LOG_KEY = K.EVENT_LOG
/** 第卌四轮拍板 Q-1：5000 条滚动淘汰 */
export const EVENT_LOG_CAP = 5000
/** 单次 diff 超过该数量的同向变动视为批量操作（导入/回滚），合并摘要 */
const BULK_THRESHOLD = 200

type SnapshotEntry = { kind: CardKind; title: string; createdAt: number; deletedAt?: number; status?: string }

let snapshot = new Map<string, SnapshotEntry>()
let writeQueue: Promise<void> = Promise.resolve()
// R160（P5）：日志内存缓存——热路径纯内存追加，随下一次整库保存同一次 set 落盘（0.6MB 上限不回读）
let logCache: CardEvent[] | null = null
let dirty = false
function trimLog(events: CardEvent[]): CardEvent[] {
  return events.length > EVENT_LOG_CAP ? events.slice(events.length - EVENT_LOG_CAP) : events
}

function chromeStore(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

/** 读取全部事件（旧→新）——R160（P5）：内存缓存优先 */
export async function readEventLog(): Promise<CardEvent[]> {
  if (logCache) return [...logCache]
  try {
    const cs = chromeStore()
    if (!cs) return []
    const cur = (await cs.get([EVENT_LOG_KEY]))[EVENT_LOG_KEY]
    const arr = Array.isArray(cur) ? (cur as CardEvent[]) : []
    logCache = arr
    return [...arr]
  } catch { return [] }
}

/** 冷路径自愈落盘（本上下文尚未预热缓存时用；失败留待下次整库保存带上） */
async function flushEventLogNow(): Promise<void> {
  const cs = chromeStore()
  if (!cs || !logCache || !dirty) return
  const payload = logCache
  dirty = false
  try { await cs.set({ [EVENT_LOG_KEY]: payload }) } catch { dirty = true }
}

/** R160（P5）：把待写日志并入调用方的整库 set（同一次 IPC） */
export function takeEventLogPatch(): Record<string, unknown> | null {
  if (!logCache || !dirty) return null
  dirty = false
  return { [EVENT_LOG_KEY]: logCache }
}

/** R160（P5）：外部写入（onChanged）刷新缓存——本地有待写事件时不覆盖 */
export function initEventLog(raw: unknown): void {
  if (!dirty && Array.isArray(raw)) logCache = raw as CardEvent[]
}

/** 事件入队：热路径纯内存追加（随下次整库 set）；冷路径串行读改写后立即落盘并建缓存 */
function enqueue(events: CardEvent[]): void {
  if (!events.length) return
  if (logCache) {
    logCache = trimLog([...logCache, ...events])
    dirty = true
    return
  }
  writeQueue = writeQueue
    .then(async () => {
      const cur = await readEventLog()
      logCache = trimLog([...cur, ...events])
      dirty = true
      await flushEventLogNow()
    })
    .catch(() => { /* 日志失败不影响主数据保存 */ })
}

/** 卡片标题兜底（三卡标题字段名不同） */
function titleOf(kind: CardKind, c: { title?: string; question?: string }): string {
  return (kind === 'curiosity' ? c.question : c.title) || '（无标题）'
}

function collectCards(d: AppData): { id: string; kind: CardKind; title: string; createdAt: number; deletedAt?: number; status?: string }[] {
  const out: { id: string; kind: CardKind; title: string; createdAt: number; deletedAt?: number; status?: string }[] = []
  const push = (kind: CardKind, arr: { id?: string; title?: string; question?: string; createdAt?: number; deletedAt?: number; status?: string }[] | undefined) =>
    (arr || []).forEach(c => { if (c && c.id) out.push({ id: c.id, kind, title: titleOf(kind, c), createdAt: c.createdAt || 0, deletedAt: c.deletedAt, status: c.status }) })
  push('resource', d.resources)
  push('task', d.tasks)
  push('curiosity', d.curiosities)
  return out
}

/** 静默重建快照（初始化 / 外部写入同步，不产生事件） */
export function rebuildEventSnapshot(d: AppData): void {
  snapshot = new Map()
  for (const c of collectCards(d)) {
    snapshot.set(c.id, { kind: c.kind, title: c.title, createdAt: c.createdAt, deletedAt: c.deletedAt, status: c.status })
  }
}

/**
 * 快照 diff → 产出事件并写日志（repository 保存链路调用）。
 * 新 id=create / deletedAt 置位=delete / 清除=restore / id 消失=purge；批量变动合并摘要。
 */
export function flushCardEvents(d: AppData): void {
  const now = Date.now()
  const events: CardEvent[] = []
  let eid = 0
  const mk = (action: EventAction, kind: CardKind | 'system', title: string, cardId: string): CardEvent =>
    ({ id: `${now}-${++eid}`, ts: now, action, kind, title, cardId })

  const creates: CardEvent[] = []
  const deletes: CardEvent[] = []
  const restores: CardEvent[] = []
  const purges: CardEvent[] = []
  /** R117（04-61 C3）：好奇探索状态变更（不入批量合并——状态变更本就是逐条的用户动作） */
  const statusChanges: CardEvent[] = []

  // R71 性能治理：原实现先 collectCards 出整张中间数组（每张卡一个对象）再遍历——
  // 本函数在**每次保存**时都会执行，1450 张卡就是 1450 次额外对象分配。
  // 改为就地三数组扫描，并顺手把新快照建出来（省掉「先建数组、再遍历建快照」的两趟）。
  const prevSnap = snapshot
  const nextSnap = new Map<string, SnapshotEntry>()
  const seen = new Set<string>()
  const scan = (kind: CardKind, arr: { id?: string; title?: string; question?: string; createdAt?: number; deletedAt?: number; status?: string }[] | undefined) => {
    for (const c of arr || []) {
      if (!c || !c.id) continue
      seen.add(c.id)
      nextSnap.set(c.id, { kind, title: titleOf(kind, c), createdAt: c.createdAt || 0, deletedAt: c.deletedAt, status: c.status })
      const prev = prevSnap.get(c.id)
      if (!prev) {
        creates.push(mk('create', kind, titleOf(kind, c), c.id))
      } else if (!prev.deletedAt && c.deletedAt) {
        deletes.push(mk('delete', kind, titleOf(kind, c), c.id))
      } else if (prev.deletedAt && !c.deletedAt) {
        restores.push(mk('restore', kind, titleOf(kind, c), c.id))
      } else if (kind === 'curiosity' && c.status && prev.status && prev.status !== c.status) {
        // 仅在「未删未恢复」的稳定态比对状态，避免与 delete/restore 事件同帧刷双条
        statusChanges.push(mk('status', kind, titleOf(kind, c), c.id))
      }
    }
  }
  scan('resource', d.resources)
  scan('task', d.tasks)
  scan('curiosity', d.curiosities)
  for (const [id, prev] of prevSnap) {
    if (!seen.has(id)) purges.push(mk('purge', prev.kind, prev.title, id))
  }

  // 批量合并：导入/回滚等场景防日志洪泛
  if (creates.length > BULK_THRESHOLD) {
    events.push(mk('create', 'system', `批量导入/新建 ${creates.length} 张卡片`, ''))
  } else events.push(...creates)
  if (deletes.length > BULK_THRESHOLD) {
    events.push(mk('delete', 'system', `批量删除 ${deletes.length} 张卡片`, ''))
  } else events.push(...deletes)
  // R117（04-61 C3）：状态变更事件恒定逐条记录（它是"探索推进"的痕迹，不能被摘要吞掉）
  events.push(...statusChanges)
  events.push(...restores)
  if (purges.length > BULK_THRESHOLD) {
    events.push(mk('purge', 'system', `批量清理 ${purges.length} 张卡片（回滚/清空回收站）`, ''))
  } else events.push(...purges)

  // 更新快照（已在扫描时同步建好）
  snapshot = nextSnap
  enqueue(events)
}

/* ================= R117（04-61 C3）：好奇心「探索累计」口径 ================= */

/**
 * 「本版起算」的落盘点：首次运行本版时写入，此后只统计 `ts >= 该时刻` 的事件。
 * 拍板「5. 接受 / 本版起算」——**不回填历史** create/delete 事件，
 * 否则一升级就会冒出一个来路不明的历史大数（那时也还没有 status 事件，口径本就不齐）。
 */
export const CURIO_CUM_SINCE_KEY = K.CURIO_SINCE
let cumSinceCache: number | null = null

export async function curioCumulativeSince(): Promise<number> {
  if (cumSinceCache != null) return cumSinceCache
  const cs = chromeStore()
  const now = Date.now()
  if (!cs) { cumSinceCache = now; return now }
  try {
    const cur = (await cs.get([CURIO_CUM_SINCE_KEY]))[CURIO_CUM_SINCE_KEY]
    if (typeof cur === 'number' && cur > 0) { cumSinceCache = cur; return cur }
  } catch { /* 读取失败 → 按「此刻起算」 */ }
  try { await cs.set({ [CURIO_CUM_SINCE_KEY]: now }) } catch { /* 落盘失败不阻塞 UI */ }
  cumSinceCache = now
  return now
}

/** 好奇心探索累计值 = 采集(create) + 状态变更(status) + 删除(delete) 三类操作计数（限 `since` 之后） */
export function countCurioCumulative(events: CardEvent[], since: number): number {
  let n = 0
  for (const e of events) {
    if (e.kind !== 'curiosity' || e.ts < since) continue
    if (e.action === 'create' || e.action === 'status' || e.action === 'delete') n++
  }
  return n
}
