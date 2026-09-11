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

export type CardKind = 'resource' | 'task' | 'curiosity'
export type EventAction = 'create' | 'delete' | 'restore' | 'purge'

export interface CardEvent {
  id: string
  ts: number
  action: EventAction
  /** system = 批量摘要事件（导入/回滚），不属于任何单一卡片类型 */
  kind: CardKind | 'system'
  title: string
  cardId: string
}

export const EVENT_LOG_KEY = 'zy_event_log'
/** 第卌四轮拍板 Q-1：5000 条滚动淘汰 */
export const EVENT_LOG_CAP = 5000
/** 单次 diff 超过该数量的同向变动视为批量操作（导入/回滚），合并摘要 */
const BULK_THRESHOLD = 200

type SnapshotEntry = { kind: CardKind; title: string; createdAt: number; deletedAt?: number }

let snapshot = new Map<string, SnapshotEntry>()
let writeQueue: Promise<void> = Promise.resolve()

function chromeStore(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

/** 读取全部事件（旧→新） */
export async function readEventLog(): Promise<CardEvent[]> {
  try {
    const cs = chromeStore()
    if (!cs) return []
    const cur = (await cs.get([EVENT_LOG_KEY]))[EVENT_LOG_KEY]
    return Array.isArray(cur) ? (cur as CardEvent[]) : []
  } catch { return [] }
}

async function writeEvents(events: CardEvent[]): Promise<void> {
  const cs = chromeStore()
  if (!cs) return
  // 滚动淘汰：保留最新 CAP 条
  const trimmed = events.length > EVENT_LOG_CAP ? events.slice(events.length - EVENT_LOG_CAP) : events
  await cs.set({ [EVENT_LOG_KEY]: trimmed })
}

/** 事件入队（串行化读改写，防并发覆盖） */
function enqueue(events: CardEvent[]): void {
  if (!events.length) return
  writeQueue = writeQueue
    .then(async () => {
      const cur = await readEventLog()
      await writeEvents([...cur, ...events])
    })
    .catch(() => { /* 日志失败不影响主数据保存 */ })
}

/** 卡片标题兜底（三卡标题字段名不同） */
function titleOf(kind: CardKind, c: { title?: string; question?: string }): string {
  return (kind === 'curiosity' ? c.question : c.title) || '（无标题）'
}

function collectCards(d: AppData): { id: string; kind: CardKind; title: string; createdAt: number; deletedAt?: number }[] {
  const out: { id: string; kind: CardKind; title: string; createdAt: number; deletedAt?: number }[] = []
  const push = (kind: CardKind, arr: { id?: string; title?: string; question?: string; createdAt?: number; deletedAt?: number }[] | undefined) =>
    (arr || []).forEach(c => { if (c && c.id) out.push({ id: c.id, kind, title: titleOf(kind, c), createdAt: c.createdAt || 0, deletedAt: c.deletedAt }) })
  push('resource', d.resources)
  push('task', d.tasks)
  push('curiosity', d.curiosities)
  return out
}

/** 静默重建快照（初始化 / 外部写入同步，不产生事件） */
export function rebuildEventSnapshot(d: AppData): void {
  snapshot = new Map()
  for (const c of collectCards(d)) {
    snapshot.set(c.id, { kind: c.kind, title: c.title, createdAt: c.createdAt, deletedAt: c.deletedAt })
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

  // R71 性能治理：原实现先 collectCards 出整张中间数组（每张卡一个对象）再遍历——
  // 本函数在**每次保存**时都会执行，1450 张卡就是 1450 次额外对象分配。
  // 改为就地三数组扫描，并顺手把新快照建出来（省掉「先建数组、再遍历建快照」的两趟）。
  const prevSnap = snapshot
  const nextSnap = new Map<string, SnapshotEntry>()
  const seen = new Set<string>()
  const scan = (kind: CardKind, arr: { id?: string; title?: string; question?: string; createdAt?: number; deletedAt?: number }[] | undefined) => {
    for (const c of arr || []) {
      if (!c || !c.id) continue
      seen.add(c.id)
      nextSnap.set(c.id, { kind, title: titleOf(kind, c), createdAt: c.createdAt || 0, deletedAt: c.deletedAt })
      const prev = prevSnap.get(c.id)
      if (!prev) {
        creates.push(mk('create', kind, titleOf(kind, c), c.id))
      } else if (!prev.deletedAt && c.deletedAt) {
        deletes.push(mk('delete', kind, titleOf(kind, c), c.id))
      } else if (prev.deletedAt && !c.deletedAt) {
        restores.push(mk('restore', kind, titleOf(kind, c), c.id))
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
  events.push(...restores)
  if (purges.length > BULK_THRESHOLD) {
    events.push(mk('purge', 'system', `批量清理 ${purges.length} 张卡片（回滚/清空回收站）`, ''))
  } else events.push(...purges)

  // 更新快照（已在扫描时同步建好）
  snapshot = nextSnap
  enqueue(events)
}
