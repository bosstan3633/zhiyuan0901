/**
 * 数据存储层 · 封装 chrome.storage.local
 * 所有数据读写通过此模块，提供响应式订阅
 */
import type { AppData, UIPrefs } from '@/shared/models'
import { STORAGE_KEY, UI_KEY } from '@/shared/models'
// R148-P0b：热度统计独立键（口径见 hotStats.ts 顶部三条）
import { HOT_KEY, applyHot, pickHot, writeHot } from './hotStats'
import { setCoolingDefaultDays } from '@/shared/utils/lifecycle'
import { createDefaultData, defaultThesisFieldDefs } from './defaults'
import { safeDecodeText } from '@/shared/utils'
import { pruneDanglingProjections, scrubHubMirrorMarkers } from './hub'
// 第卌四轮 T-05：卡片操作事件日志——保存链路快照 diff 自动产出 create/delete/restore/purge
import { rebuildEventSnapshot, flushCardEvents } from '@/shared/utils/eventLog'

type Listener = (data: AppData) => void
type ErrorListener = (err: SaveError) => void

/** 第卅六轮 REQ-038：保存失败事件总线（配额超限 / 序列化失败 / 未知 IO 错误） */
export interface SaveError {
  at: number
  kind: 'quota' | 'serial' | 'unknown'
  message: string
  bytesInUse?: number
}

let cache: AppData | null = null
const listeners = new Set<Listener>()
const errorListeners = new Set<ErrorListener>()
let lastSaveError: SaveError | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
/**
 * R148-P1b：内存脏计数——每次 persist 意图（saveData/saveDataNow/外部合并）同步 +1。
 * 为什么不用 dataVersion：那个只在**写盘成功后**自增，防抖窗口内会读到旧值，
 * 派生缓存拿它当失效依据会算出过期结果（现存隐患，本项顺手修掉）。
 */
let mutationSeq = 0
export function getMutationSeq(): number { return mutationSeq }
export function markDataDirty(): void { mutationSeq++ }

// REQ-031 P-031-6 + R70 + R131-C1a：自身写入标记。
// 原实现是时间戳比较（守卫从未生效），R70 改内容指纹（每次 onChanged 对整树 stringify 一次，千卡 40–100ms）。
// R131-C1a：写入载荷带全局唯一 `__wid`（上下文随机前缀 + 自增序号），onChanged 只比一个字符串——
// 判定退化为 O(1)。跨上下文序号独立不碰撞（前缀不同）；旧存量数据无 __wid → 判为外部写入（保守正确）。
const SELF_CTX_ID = Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36)
let selfWriteSeq = 0
let lastSelfWriteId = ''

// R56-PERF-c：数据版本号——每次成功写入/外部同步自增（重计算 memo 的失效键）
let dataVersion = 0
export function getDataVersion(): number { return dataVersion }
/** 判断一次 storage 变更是否由本上下文写入（writeId 比对，O(1)；非本页写入返回 false，走合并路径） */
export function isSelfWrite(newValue: unknown): boolean {
  if (!lastSelfWriteId) return false
  return (newValue as { __wid?: unknown } | null)?.__wid === lastSelfWriteId
}

function chromeStore(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

/** 加载数据（含首次初始化） */
export async function loadData(prefetched?: Record<string, unknown>): Promise<AppData> {
  if (cache) return cache
  const cs = chromeStore()
  if (!cs) {
    cache = createDefaultData()
    return cache
  }
  // R112 冷启动：允许调用方把**已经读到的** raw 快照传进来，省掉一次同 key 的
  //   chrome.storage.local 往返（启动链路里 STORAGE_KEY 曾被串行读 3 次，medium 实测单次
  //   197~229ms）。预取只跳过 IO，**归一化一律照常执行**。
  let raw = prefetched ? (prefetched[STORAGE_KEY] as AppData | undefined) : undefined
  let hotRaw: Record<string, unknown> | undefined
  // R128-A1：统一接线跨上下文同步——此前 onChanged→合并 只在新标签页 store 里手工接，
  // popup / content 各自裸读写 storage（既无合并、也不产事件）。改为仓库自身挂一次全局监听，
  // 凡走本模块的上下文自动获得合并保护。
  attachStorageSync()
  if (raw === undefined) {
    // R148-P0b：主键与热度键**同一次 get**取回——拆键不能变成多一次启动 IO
    const result = await cs.get([STORAGE_KEY, HOT_KEY])
    raw = result[STORAGE_KEY] as AppData | undefined
    hotRaw = result as Record<string, unknown>
  } else if (prefetched) {
    hotRaw = await cs.get([HOT_KEY]) as Record<string, unknown>
  }
  let data = raw
  if (!data) {
    data = createDefaultData()
    await cs.set({ [STORAGE_KEY]: data })
  }
  // N4：老数据补齐 tagTree 与任务/好奇心卡 tags 字段行
  if (!data.tagTree) data.tagTree = []
  // B35：卡片 tags 字段归一化——迁移/历史数据中存在非数组 tags（对象/数字等），
  // 会让 .includes/.join 崩溃（标签管理白屏、网页端搜索空白）。此处一次性修正并在下次 persist 固化。
  const fixTags = (cards: { tags?: unknown }[] | undefined) => (cards || []).forEach((c: { tags?: unknown }) => {
    if (!c) return
    if (!Array.isArray(c.tags)) {
      c.tags = typeof c.tags === 'string' && c.tags.trim()
        ? c.tags.split(/[,，、\s]+/).filter(Boolean)
        : []
    }
  })
  fixTags(data.resources as { tags?: unknown }[])
  fixTags(data.tasks as { tags?: unknown }[])
  fixTags(data.curiosities as { tags?: unknown }[])
  // 第廿九轮：分类名/标签名 URL 编码归一化——导入场景曾把 percent-encoding 的名称直接存库
  // （表现为界面上出现「%E5%AE%8B...」乱码分类）。此处一次性解码并在下次 persist 固化。
  const fixEncoded = (name: string): string => safeDecodeText(name);
  (data.categories || []).forEach(c => { if (c) c.name = fixEncoded(c.name) })
  const fixTagNames = (cards: { tags?: string[] }[] | undefined) => (cards || []).forEach(c => {
    if (!c || !Array.isArray(c.tags)) return
    c.tags = c.tags.map(t => (typeof t === 'string' ? fixEncoded(t) : t))
  })
  fixTagNames(data.resources as { tags?: string[] }[])
  fixTagNames(data.tasks as { tags?: string[] }[])
  fixTagNames(data.curiosities as { tags?: string[] }[])
  for (const key of ['task', 'curiosity'] as const) {
    if (data.fieldConfig?.[key] && !data.fieldConfig[key].some(f => f.key === 'tags')) {
      data.fieldConfig[key].push({ key: 'tags', label: '标签', type: 'tags', visible: false, order: data.fieldConfig[key].length })
    }
  }
  // R62-3：策展主题卡字段组——老数据无 thesis 组则补默认（幂等）
  if (data.fieldConfig && !data.fieldConfig.thesis) data.fieldConfig.thesis = defaultThesisFieldDefs()
  // 第卌轮 REQ-049：老数据字段配置补 assets（附件展示；字段目录 base 字段，目录化兜底迁移）
  for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const) {
    if (data.fieldConfig?.[key] && !data.fieldConfig[key].some(f => f.key === 'assets')) {
      data.fieldConfig[key].push({ key: 'assets', label: '附件', type: 'text', visible: true, order: data.fieldConfig[key].length })
    }
  }
  // R80（R1 遗留）：资源卡标签默认可见——一次性幂等迁移。
  // 背景：字段池四组的 tags 自建立起就是 visible:false，导致 R1「补齐 #标签」在存量数据上
  // 从未真正生效（用户不知道要去设置里打开）。此处对 resource 组一次性置 true。
  // ⚠ 取舍：若用户此前**主动**关掉过标签，本次会被重新打开——R1 是 P0 且标签是资源卡核心元数据，
  //   判"不知道能开"的概率远高于"主动关掉"。回退只需在设置里再关一次（或删掉标记后重启）。
  if (!data.tagsVisibleMigratedAt) {
    const res = data.fieldConfig?.resource
    const tag = res?.find(f => f.key === 'tags')
    if (tag) tag.visible = true
    data.tagsVisibleMigratedAt = Date.now()
  }
  // R58-B5：activityLogs 已无写入方（事件日志迁 zy_event_log 独立键）——启动期清空瘦身
  if (Array.isArray(data.activityLogs) && data.activityLogs.length) data.activityLogs = []
  // R63：Airtable 同步状态归一化（老数据无则补默认；log 截断防膨胀；map 保证为对象）
  if (!data.airtableSync) {
    data.airtableSync = { pat: '', baseId: '', tableId: '', pollEnabled: false }
  } else {
    const s = data.airtableSync
    if (typeof s.pat !== 'string') s.pat = ''
    if (typeof s.baseId !== 'string') s.baseId = ''
    if (typeof s.tableId !== 'string') s.tableId = ''
    if (!s.pollEnabled) s.pollEnabled = false
    if (Array.isArray(s.log) && s.log.length > 40) s.log = s.log.slice(-40)
  }
  if (!data.airtableMap || typeof data.airtableMap !== 'object') data.airtableMap = {}
  // R70：悬空投射清理——源卡被硬删（回收站清空）后指向它的投射记录会永久留存、无界增长。幂等，启动期一次。
  try { pruneDanglingProjections(data) } catch { /* noop */ }
  // R110-BUG1：资源台镜像标记净化——视图模型标记（__mirrorProjId/__mirrorCat）误持久化 + 指向资源台的投射
  // 记录，都是历史脏数据，启动期幂等剥离（资源台指标格不再出现「⚠ 镜像 N 条待清理」）。一次净化后下次 persist 固化。
  try { scrubHubMirrorMarkers(data) } catch { /* noop */ }
  // R148-P0b：热度段以独立键为权威覆盖回主树（视图读法一字不改）；
  //  老数据没有本键 → 首次以主树落一次并打戳，幂等（重启不会抽第二遍）。
  const hot = pickHot(hotRaw)
  if (hot) applyHot(data, hot)
  else if (!data.hotStatsSplitAt) { data.hotStatsSplitAt = Date.now(); writeHot(data) }
  cache = data
  markStorageMirror(data)
  // 第卌四轮 T-05：初始化快照（静默，不产生历史事件）
  rebuildEventSnapshot(data)
  markSaveOk()
  return data
}

/** 获取当前数据缓存（必须先 loadData） */
export function getData(): AppData {
  if (!cache) throw new Error('Data not loaded. Call loadData() first.')
  return cache
}

/** 保存数据（防抖 300ms，自动持久化） */
export function saveData(): void {
  markDataDirty() // R148-P1b：先让派生缓存作废，再排防抖写盘
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    // 第卌四轮 T-05：保存前快照 diff 产出操作事件（fire-and-forget，失败不影响主数据）
    if (cache) { try { flushCardEvents(cache) } catch { /* noop */ } }
    // V2.17.1 修复：JSON 纯净清洗后再入存储——reactive 树中可能残留 Vue Proxy（如编辑表单展开出的
    // assets Proxy 数组），chrome.storage 序列化 Proxy 时会把数组降级为类数组对象 {"0":…}，
    // 读回后 .length 为 undefined → 卡片正面附件徽章永不渲染。JSON round-trip 保证入存储永远是 plain 结构。
    // R53-E3：序列化包 try——异常走 SaveError('serial')（此前在定时器内未捕获会静默丢保存）
    let payload: Record<string, unknown>
    let payloadJson = ''
    try {
      // R71 性能治理：原实现是「序列化 → 解析 → 再序列化」三重往返 —— 整树 2 次序列化 + 1 次多余解析。
      // 但 JSON.stringify(JSON.parse(X)) ≡ X（键序由插入序保持），中间那趟往返纯属冗余。
      // 现在：一次 stringify 得到「存储实际内容」（同时充当自身写入指纹），再一次 parse 得到纯净 plain 树。
      // 语义完全等价（reactive Proxy → plain JSON 的净化仍然发生），成本减半。
      payloadJson = JSON.stringify(cache)
      const wid = SELF_CTX_ID + '-' + (++selfWriteSeq)
      payload = { [STORAGE_KEY]: Object.assign(JSON.parse(payloadJson), { __wid: wid }) }
      lastSelfWriteId = wid  // R131-C1a：onChanged 以 writeId 做 O(1) 自身写入判定
    } catch (e) { emitSaveError(e); return }
    const p = cs!.set(payload)
    if (p && typeof (p as Promise<void>).then === 'function') {
      ;(p as Promise<void>)
        .then(() => {
          dataVersion++
          lastPersistedJson = payloadJson
          if (cache) writeHot(cache) // R148-P0b：整库写成功后同步热度键（两键永远同刻）
          markSaveOk()
          if (lastSaveError) { lastSaveError = null; listeners.forEach((fn) => fn(cache!)) }
          listeners.forEach((fn) => fn(cache!))
        })
        .catch((e: unknown) => emitSaveError(e))
    } else {
      markSaveOk()
      listeners.forEach((fn) => fn(cache!))
    }
  }, 300)
}

/** 立即保存（用于关键操作） */
export async function saveDataNow(): Promise<void> {
  markDataDirty()
  if (!cache) return
  const cs = chromeStore()
  if (!cs) return
  if (saveTimer) clearTimeout(saveTimer)
  // 第卌四轮 T-05：同 saveData——保存前 diff 产出操作事件
  try { flushCardEvents(cache) } catch { /* noop */ }
  try {
    // V2.17.1 修复：同 saveData——JSON 纯净清洗防 reactive Proxy 泄漏入存储（数组降级类数组对象）
    // R71：同 saveData，去掉冗余的中间往返（1 次 stringify + 1 次 parse）
    const payloadJson = JSON.stringify(cache)
    const wid = SELF_CTX_ID + '-' + (++selfWriteSeq)
    lastSelfWriteId = wid  // R131-C1a：同上
    await cs.set({ [STORAGE_KEY]: Object.assign(JSON.parse(payloadJson), { __wid: wid }) })
    dataVersion++
    lastPersistedJson = payloadJson
    writeHot(cache) // R148-P0b：同上（立即保存路径）
    markSaveOk()
    if (lastSaveError) { lastSaveError = null }
    listeners.forEach((fn) => fn(cache!))
  } catch (e) {
    emitSaveError(e)
    throw e
  }
}

/** 第卅六轮 REQ-038：保存失败时分类告警（含最近一次写入的容量水位） */
function emitSaveError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)
  const kind: SaveError['kind'] =
    /quota|QUOTA_EXCEEDED|maxBytes/i.test(msg) ? 'quota' :
    /circular|JSON|stringify|serializ/i.test(msg) ? 'serial' : 'unknown'
  lastSaveError = { at: Date.now(), kind, message: msg }
  // 异步取一次当前已用字节（best-effort，配额错误才有意义，但容错写入）
  try {
    chromeStore()?.getBytesInUse?.((bytes) => {
      if (lastSaveError) lastSaveError.bytesInUse = bytes
      errorListeners.forEach((fn) => fn(lastSaveError!))
    })
  } catch {
    errorListeners.forEach((fn) => fn(lastSaveError!))
  }
}

/** 订阅保存失败事件（用于触发 Toast / 设置页红点 / 顶栏告警） */
export function subscribeSaveError(fn: ErrorListener): () => void {
  errorListeners.add(fn)
  if (lastSaveError) fn(lastSaveError)
  return () => errorListeners.delete(fn)
}

/** 取最近一次保存失败（用于设置页诊断） */
export function getLastSaveError(): SaveError | null { return lastSaveError }

/** R50-F2：最近一次成功写入时间戳（0 = 本次会话尚无成功写入；loadData 成功也会置位） */
let lastSaveOkAt = 0
export function getLastSaveOkAt(): number { return lastSaveOkAt }
function markSaveOk(): void { lastSaveOkAt = Date.now() }

/** 清除最近一次保存失败标记（恢复后调用） */
export function clearLastSaveError(): void { lastSaveError = null }

/** 第卅六轮 REQ-038：当前 chrome.storage.local 已用字节（同步回调包装成 Promise） */
export function getBytesInUse(): Promise<number> {
  return new Promise((resolve) => {
    const cs = chromeStore()
    if (!cs || !cs.getBytesInUse) return resolve(0)
    cs.getBytesInUse([STORAGE_KEY], (bytes) => resolve(bytes || 0))
  })
}

/** 第卅六轮 REQ-038：是否已申请 unlimitedStorage（直接读运行时 manifest，零依赖） */
export function hasUnlimitedStorage(): boolean {
  try {
    const m = (chrome as { runtime?: { getManifest?: () => { permissions?: string[] } } }).runtime?.getManifest?.()
    const perms = m?.permissions || []
    return Array.isArray(perms) && perms.includes('unlimitedStorage')
  } catch {
    return false
  }
}

/** 订阅数据变更 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 替换全部数据（导入用） */
export async function replaceData(newData: AppData): Promise<void> {
  // R70：纵深校验——本函数此前零校验直接落盘（调用方虽然有 version 校验，但函数本身不设防）。
  // 非法结构一旦进库，会被后续每一次 persist 固化，且分类树等递归路径会直接卡死页面。
  if (!newData || typeof newData !== 'object' || (newData as { version?: unknown }).version !== 2) {
    throw new Error('replaceData: 数据版本不兼容（需 v2 格式），已拒绝写入')
  }
  cache = newData
  await saveDataNow()
}

/** 同步缓存引用（外部 storage 变更时调用，保持 cache 与最新数据一致） */
export function syncCache(newData: AppData): void {
  cache = newData
  markDataDirty() // R148-P1b：整份缓存被换掉（外部写入/合并/导入）= 派生缓存一律作废
  dataVersion++
  markStorageMirror(newData)
  // 第卌四轮 T-05：外部写入静默重建快照——事件由执行写入的上下文记录，避免双记
  rebuildEventSnapshot(newData)
}

// ============ R58-B2 · 跨上下文并发写合并 ============
// 旧语义：外部写入到达 → syncCache 整树替换 → 本页 300ms 防抖窗口内（以及表单直改树、尚未落盘）的
// 修改被静默吞掉（双标签页/新标签页+网页浮层组合实机复现丢改）。新语义：本页有未落盘改动时做
// 卡片级 LWW 合并；非卡段「本页相对存储镜像有改动则保留本页，否则取外部」。
// lastPersistedJson 恒等「storage 当前内容」的镜像：本地保存成功=载荷，外部接收=外部树，合并后=外部树
//（合并结果随后经 saveData 落盘时再刷新）。
let lastPersistedJson = ''
function markStorageMirror(data: AppData): void {
  try { lastPersistedJson = JSON.stringify(data) } catch { lastPersistedJson = '' }
}
function jsonEq(a: unknown, b: unknown): boolean {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}
interface MergeCard { id: string; updatedAt?: number }
/** 卡片数组合并：以本页数组顺序为骨架；本页未动的卡取外部；本页动过的卡与外部按 updatedAt LWW（平手取本地，保护正在输入的表单）；外部新建收编；外部物理移除（回收站清空）且本页未动 → 尊重外部 */
function mergeCardArr<T extends MergeCard>(localArr: T[], snapArr: T[], extArr: T[]): T[] {
  const snapById = new Map(snapArr.map(c => [c.id, c]))
  const extById = new Map(extArr.map(c => [c.id, c]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const l of localArr) {
    seen.add(l.id)
    const e = extById.get(l.id)
    const sn = snapById.get(l.id)
    const localDirty = !sn || !jsonEq(l, sn)
    if (!e) { if (localDirty) out.push(l); continue }
    if (!localDirty) { out.push(e); continue }
    out.push(((e.updatedAt || 0) > (l.updatedAt || 0)) ? e : l)
  }
  for (const e of extArr) if (!seen.has(e.id)) out.push(e)
  return out
}
/** R70：通用「按 id 并集」合并——用于**无 updatedAt 的实体段**（策展台/分类/标签树/投射）。
 *  此前这些段走的是「全有或全无」：只要本页与外部都动过就整段取本地，
 *  外部新建的策展台/分类/投射会被静默丢弃（本页只改了一个字段，代价却是别人新建的整段消失）。
 *  规则：本页没动 → 取外部；本页动过外部也动过 → 取本地（无版本可比，保护正在输入的表单）；
 *  外部新增收编；外部已删且本页没动 → 尊重外部删除。 */
function mergeByIdArr<T extends { id: string }>(localArr: T[], snapArr: T[], extArr: T[]): T[] {
  const snapById = new Map(snapArr.map(c => [c.id, c]))
  const extById = new Map(extArr.map(c => [c.id, c]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const l of localArr) {
    seen.add(l.id)
    const e = extById.get(l.id)
    const sn = snapById.get(l.id)
    if (!e) { if (!sn || !jsonEq(l, sn)) out.push(l); continue }
    if (!sn || jsonEq(l, sn)) { out.push(e); continue }
    out.push(l)
  }
  for (const e of extArr) if (!seen.has(e.id)) out.push(e)
  return out
}
/** dailyFocus 按日期键合并：单边改动整键取该侧；双边同键都改过 → 槽级 LWW（按槽 id，FocusSlot 无 updatedAt，平手取本地） */
function mergeDailyFocus(curD: AppData['dailyFocus'], snapD: AppData['dailyFocus'], extD: AppData['dailyFocus']): AppData['dailyFocus'] {
  const out: AppData['dailyFocus'] = { ...(extD || {}) }
  const keys = new Set([...Object.keys(curD || {}), ...Object.keys(snapD || {})])
  for (const k of keys) {
    const c = (curD || {})[k], sn = (snapD || {})[k], e = (extD || {})[k]
    if (jsonEq(c, sn)) { if (e) out[k] = e; else delete out[k]; continue }
    if (jsonEq(e, sn) || !e) { if (c && c.length) out[k] = c; else delete out[k]; continue }
    out[k] = mergeCardArr(c || [], sn || [], e || []).slice(0, 3)
  }
  return out
}
/** 外部写入合并入口：无未落盘修改时走原整树替换（零开销快路径）；有则按段合并；合并结果与外部全等时不再回写（切断「回声→合并→写→回声」环） */
export function mergeExternalData(ext: AppData): AppData {
  const cur = cache
  if (!cur || !saveTimer) { syncCache(ext); return ext }
  let snap: AppData | null = null
  try { snap = lastPersistedJson ? (JSON.parse(lastPersistedJson) as AppData) : null } catch { snap = null }
  if (!snap) { syncCache(ext); return ext }
  const merged: AppData = {
    ...ext,
    resources: mergeCardArr(cur.resources || [], snap.resources || [], ext.resources || []),
    tasks: mergeCardArr(cur.tasks || [], snap.tasks || [], ext.tasks || []),
    curiosities: mergeCardArr(cur.curiosities || [], snap.curiosities || [], ext.curiosities || []),
    dailyFocus: mergeDailyFocus(cur.dailyFocus, snap.dailyFocus, ext.dailyFocus),
    compass: jsonEq(cur.compass, snap.compass) ? ext.compass : cur.compass,
    // R70：数组型实体段改「按 id 并集」；compass（三层嵌套）/ fieldConfig / stats 仍是对象型，
    // 深度合并风险大于收益，保留原判据（单边改动时取改动侧）。
    workspaces: mergeByIdArr(cur.workspaces || [], snap.workspaces || [], ext.workspaces || []),
    categories: mergeByIdArr(cur.categories || [], snap.categories || [], ext.categories || []),
    tagTree: mergeByIdArr(cur.tagTree || [], snap.tagTree || [], ext.tagTree || []),
    fieldConfig: jsonEq(cur.fieldConfig, snap.fieldConfig) ? ext.fieldConfig : cur.fieldConfig,
    stats: jsonEq(cur.stats, snap.stats) ? ext.stats : cur.stats,
    curationProjections: mergeByIdArr(cur.curationProjections || [], snap.curationProjections || [], ext.curationProjections || [])
  }
  // 合并结果与外部全等 = 本页没有需要保全的改动（例如自有写入的回声）→ 只同步不回写，杜绝写环
  if (jsonEq(merged, ext)) { syncCache(ext); return ext }
  cache = merged
  dataVersion++
  // 存储镜像仍指向 storage 实际内容（ext）——本页未落盘改动在后续外部事件到达时保持「脏」判定
  markStorageMirror(ext)
  rebuildEventSnapshot(merged)
  saveData()
  return merged
}

// ============ R128-A1 · 跨上下文同步统一接线 ============
/**
 * 外部写入的唯一消费点。注册一次即覆盖 newtab / popup / content / options 全上下文：
 *  - 数据键：非本页写入 → mergeExternalData（本页无未落盘改动时整树替换）→ 通知订阅者；
 *  - UI 键：逐键合并（见 mergeExternalUIPrefs）。
 * 此前该链路只在新标签页 store 内手工注册，其余上下文的「读—改—整树写」没有任何合并保护。
 */
let syncAttached = false
export function attachStorageSync(): void {
  if (syncAttached) return
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged || !chromeStore()) return
  syncAttached = true
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const dch = changes[STORAGE_KEY]
    if (dch) {
      const ext = dch.newValue as AppData | undefined
      // 键被删除（清库/重置）时 newValue 为 undefined：保持既有语义，不触发合并
      if (ext && !isSelfWrite(ext)) {
        try { mergeExternalData(ext) } catch { /* 合并失败保持本页树，下次写入仍按本页为准 */ }
        if (cache) listeners.forEach((fn) => fn(cache!))
      }
    }
    const uch = changes[UI_KEY]
    if (uch) mergeExternalUIPrefs(uch.newValue as UIPrefs | undefined)
  })
}

// ============ UI 偏好 ============

let uiCache: UIPrefs | null = null
/**
 * R128-A1：本上下文对某键的最后一次写入值（JSON 串）。
 * saveUIPrefs 是整对象覆盖写，多上下文各持一份 uiCache → A 改主题、B 改列数时，
 * B 的整对象写会把 A 的主题回退成 B 内存里的旧值。策略：外部事件里**只接受本上下文没写过的键**，
 * 我方写过的键在外部确认收到之前保持本地值；外部值一旦等于我方值即解除保护（回声落地），此后跟随外部。
 */
const uiSelfWritten = new Map<string, string>()

function mergeExternalUIPrefs(ext: UIPrefs | undefined): void {
  if (!uiCache || !ext || typeof ext !== 'object') return
  const next = { ...uiCache } as Record<string, unknown>
  const src = ext as unknown as Record<string, unknown>
  let changed = false
  for (const k of Object.keys(src)) {
    const extJson = JSON.stringify(src[k])
    const mine = uiSelfWritten.get(k)
    if (mine !== undefined) {
      if (mine === extJson) uiSelfWritten.delete(k)
      continue
    }
    if (extJson !== JSON.stringify(next[k])) { next[k] = src[k]; changed = true }
  }
  if (changed) uiCache = next as unknown as UIPrefs
}

export async function loadUIPrefs(): Promise<UIPrefs> {
  if (uiCache) return uiCache
  const cs = chromeStore()
  const defaults: UIPrefs = {
    theme: 'linear',
    viewMode: 'card',
    tcSplitRatio: 50,
    wsSwitchMod: 'alt'
  }
  if (!cs) {
    uiCache = defaults
    return uiCache
  }
  const result = await cs.get([UI_KEY])
  uiCache = { ...defaults, ...(result[UI_KEY] as UIPrefs | undefined) }
  // O18：旧默认 ctrl 迁移为 alt
  if (uiCache.wsSwitchMod === 'ctrl') { uiCache.wsSwitchMod = 'alt'; saveUIPrefs({ wsSwitchMod: 'alt' }) }
  // 视觉重构（V2.3）：旧默认 green 迁移为 linear；R53-D：主题精简四套——已删除的 green/night 一并迁移（幂等）
  if (uiCache.theme === 'green' || uiCache.theme === 'night') { uiCache.theme = 'linear'; saveUIPrefs({ theme: 'linear' }) }
  // R126（诉求 5）：应用全局默认冷却天数（缺省 30）
  setCoolingDefaultDays(uiCache.coolingDaysDefault ?? 30)
  return uiCache
}

export function getUIPrefs(): UIPrefs {
  if (!uiCache) throw new Error('UI prefs not loaded.')
  return uiCache
}

export function saveUIPrefs(patch: Partial<UIPrefs>): void {
  if (!uiCache) return
  uiCache = { ...uiCache, ...patch }
  // R128-A1：记下我方写过的键与值，供 mergeExternalUIPrefs 判定「哪些键不许被外部旧值回退」
  for (const k of Object.keys(patch)) {
    try { uiSelfWritten.set(k, JSON.stringify((uiCache as unknown as Record<string, unknown>)[k])) } catch { /* 不可序列化值不保护 */ }
  }
  chromeStore()?.set({ [UI_KEY]: uiCache })
}
