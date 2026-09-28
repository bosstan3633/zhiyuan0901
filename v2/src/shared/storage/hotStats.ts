/**
 * R148-P0b：热度统计拆独立存储键。
 *
 * 病根（实测）：单击一张卡看详情 → recordResourceOpen 改 callCount/lastCalledAt/stats.* →
 * store.persist() 把**整库**（medium 档 760 卡 ≈ 600KB）重新序列化再写盘一次。
 * 用户最高频的动作，付的是最贵的账。
 *
 * 口径（三条，缺一不可）：
 *  1. **主树仍是唯一消费口径**——视图代码照旧读 card.callCount / data.stats，本键不改变任何读取路径；
 *  2. **本键只是"小载荷落盘通道 + 重启后的权威值"**——启动期把本键覆盖回主树；
 *  3. **任何整库写入（saveData / saveDataNow / 外部合并 / 导入）都顺手刷新本键**——
 *     于是"旧热度盖住刚导入的新热度"这类岔路不存在，本键永远与最后一次整库保存同刻。
 *
 * 迁移：老数据没有本键时，首次启动以主树落一次（幂等，落 `hotStatsSplitAt` 戳）。
 *
 * R173-T2：帧扩展 `ws`（台热度）。进台/切台只改 workspaces[].callCount/lastCalledAt，
 *   而 Workspace.vue 原来「4s 后整库 persist」——真库实测每次进台付 49~84ms 整库序列化
 *   （每次进台都付的存量大头）。现改走本键小载荷；页隐藏/卸载的补写走 writeHot(d, true)
 *   立即落盘（防抖窗口里的写会随页面一起丢，补写必须跳过防抖）。
 */
import type { AppData } from '@/shared/models'
import { K } from '@/shared/storage/keys'

export const HOT_KEY = K.STATS

/** 卡片级热度：id → [callCount, lastCalledAt]（数组而非对象，1300 张卡省约一半字节） */
export interface HotStats {
  v: 1
  t: number
  cards: Record<string, [number, number]>
  /** R173-T2：台热度（id → [callCount, lastCalledAt]）——进台/切台的小载荷落盘通道（见文件头） */
  ws?: Record<string, [number, number]>
  stats: AppData['stats'] | null
}

interface HotTarget { id: string; callCount?: number; lastCalledAt?: number }

function eachCard(d: AppData, fn: (c: HotTarget | undefined) => void): void {
  for (const list of [d.resources, d.tasks, d.curiosities]) {
    const arr = (list || []) as HotTarget[]
    for (const c of arr) fn(c)
  }
}

/** R173-T2：台列表（workspaces）迭代——帧扩展 ws 用；Workspace.id/callCount/lastCalledAt 与 HotTarget 同形 */
function eachWs(d: AppData, fn: (w: HotTarget | undefined) => void): void {
  for (const w of (d.workspaces || []) as HotTarget[]) fn(w)
}

/** 从主树抽出热度段（整库保存后调用，保证两键同步） */
export function extractHot(d: AppData): HotStats {
  const cards: Record<string, [number, number]> = {}
  eachCard(d, c => {
    if (!c || !c.id) return
    const cc = c.callCount || 0
    const lc = c.lastCalledAt || 0
    if (cc || lc) cards[c.id] = [cc, lc]
  })
  const ws: Record<string, [number, number]> = {}
  eachWs(d, w => {
    if (!w || !w.id) return
    const cc = w.callCount || 0
    const lc = w.lastCalledAt || 0
    if (cc || lc) ws[w.id] = [cc, lc]
  })
  return { v: 1, t: Date.now(), cards, ws, stats: d.stats || null }
}

/** 把热度段覆盖回主树（启动期调用；不在库的 id 自然被忽略，等于自动修剪） */
export function applyHot(d: AppData, h: HotStats | null | undefined): void {
  if (!h || !h.cards) return
  const byId = new Map<string, HotTarget>()
  eachCard(d, c => { if (c && c.id) byId.set(c.id, c) })
  for (const id in h.cards) {
    const c = byId.get(id)
    const v = h.cards[id]
    if (!c || !Array.isArray(v)) continue
    c.callCount = v[0] || 0
    c.lastCalledAt = v[1] || 0
  }
  const wsr = h.ws
  if (wsr) {
    eachWs(d, w => {
      if (!w || !w.id) return
      const v = wsr[w.id]
      if (!Array.isArray(v)) return
      w.callCount = v[0] || 0
      w.lastCalledAt = v[1] || 0
    })
  }
  if (h.stats) d.stats = h.stats
}

function store(): ((o: Record<string, unknown>) => unknown) | null {
  const g = globalThis as unknown as { chrome?: { storage?: { local?: { set?: (o: Record<string, unknown>) => unknown } } } }
  const set = g.chrome?.storage?.local?.set
  return typeof set === 'function' ? set : null
}

let hotTimer: ReturnType<typeof setTimeout> | null = null
/** 只写热度键（小载荷）——热度类改动的落盘通道。
 *  R173-T2：immediate=true 跳过 250ms 防抖立即落盘——页面隐藏/卸载路径专用（补写必须赶在页面被
 *  冻结/销毁前发出；防抖窗口里的 setTimeout 会随页面一起丢）。 */
export function writeHot(d: AppData, immediate?: boolean): void {
  const set = store()
  if (!set) return
  if (hotTimer) { clearTimeout(hotTimer); hotTimer = null }
  const fire = (): void => {
    try {
      const p = set({ [HOT_KEY]: extractHot(d) }) as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => { /* 热度写失败不影响主数据，下次整库保存会补 */ })
    } catch { /* noop */ }
  }
  if (immediate) fire()
  else hotTimer = setTimeout(() => { hotTimer = null; fire() }, 250)
}

/** 清空热度键（回滚至初始状态用）——不清的话下次启动会把旧 stats 覆盖回来 */
export function clearHot(): void {
  const g = globalThis as unknown as { chrome?: { storage?: { local?: { remove?: (k: string[]) => unknown } } } }
  try { g.chrome?.storage?.local?.remove?.([HOT_KEY]) } catch { /* noop */ }
  if (hotTimer) { clearTimeout(hotTimer); hotTimer = null }
}

/** 读热度键（与主键同一次 get 拿回，见 repository.loadData） */
export function pickHot(raw: Record<string, unknown> | undefined | null): HotStats | null {
  const h = raw ? (raw[HOT_KEY] as HotStats | undefined) : undefined
  return h && h.v === 1 && h.cards ? h : null
}
