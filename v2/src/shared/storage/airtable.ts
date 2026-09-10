/**
 * R63：Airtable 单向同步服务（知源 → Airtable）
 *
 * 语义（按用户拍板）：
 * - 单向推送，绝不回写知源；软删卡置「已删除」勾选，不物理删 Airtable 记录
 * - 缺失字段自动创建（用户为 Base Creator，schema.bases:write）；已存在列不改名不改类型；
 *   formula/rollup/lookup 计算列一律跳过
 * - 增量：updatedAt > cursorAt 的卡才推送；映射表 airtableMap（知源卡 id ↔ recordId）
 * - 限流：每批 ≤10 条、批间 200ms、429 退避 30s；累计调用计数仅作展示（R64：用户为付费会员，无配额口径）
 * - 主题卡：isThesis 仅作为「是否中心论点」列值（拍板 C：不额外加列，此列随基础字段自动建）
 *
 * 同步范围（拍板）：
 * - 调度台好奇心卡 / 方向台任务卡 / 资源台资源卡 / 各策展台台内卡（+ 主题卡标记）
 * - R64 拍板：镜像卡是独立记录（幂等键 cardId:m:targetWsId，所属工作台=落点台名），
 *   真身与镜像在 Airtable 各自成行，均带各自「所属工作台」列标识
 *
 * R64 自愈（用户报 422：Record does not exist）：
 * - 映射优先级改为远端索引优先（远端实测存在才可信，本地 map 仅兜底）
 * - 批量 PATCH 失败且含记录不存在语义 → 该批逐条重试，单条仍不存在 → 转 POST 重建写回映射
 * - 单条重建失败只记 log，不拖垮整轮同步
 */
import type { AppData, AirtableSyncState, AirtableLogEntry, AnyCard } from '../models'
import { CURATION_WS_ID } from '../models'
import { isHubWs, curationBoards } from './hub'

const API = 'https://api.airtable.com/v0'
/** 单批记录数上限（Airtable 硬限制） */
export const BATCH_SIZE = 10
/** 批间间隔 ms（5 req/s 限流内留余量） */
const BATCH_GAP = 200
/** 429 退避 ms */
const RATE_LIMIT_BACKOFF = 30000

// ===== 同步行收集 =====

/** 同步行 = 一条待推送记录的规范化视图 */
export interface SyncRow {
  /** 知源卡 id（Airtable「知源ID」列，幂等键） */
  key: string
  cardType: '资源' | '任务' | '好奇心'
  wsName: string
  catPath: string
  /** 金字塔层级（分类树深度，根=1；非策展范围为 0） */
  level: number
  isThesis: boolean
  title: string
  link: string
  description: string
  tags: string
  status: string
  priority: string
  dueDate: string
  updatedAt: number
  deleted: boolean
}

/** 分类路径与层级（根分类=1 级）；R63-2 导出 CSV 尾随列复用 */
export function catPathOf(d: AppData, wsId: string, catId?: string): { path: string; level: number } {
  if (!catId) return { path: '', level: 0 }
  const names: string[] = []
  let cur = d.categories.find(c => c.id === catId && c.workspaceId === wsId)
  let depth = 0
  while (cur && depth < 6) {
    names.unshift(cur.name)
    depth++
    cur = cur.parentId ? d.categories.find(c => c.id === cur!.parentId && c.workspaceId === wsId) : undefined
  }
  return { path: names.join(' / '), level: depth }
}

/** 任务卡分类路径 = 项目名（方向台语境） */
function taskContext(d: AppData, projectId?: string): { path: string; level: number } {
  if (!projectId) return { path: '', level: 0 }
  for (const dir of d.compass.directions) {
    const proj = dir.projects.find(p => p.id === projectId)
    if (proj) return { path: proj.name, level: 1 }
  }
  return { path: '', level: 0 }
}

/** 收集全量同步行（内部先全量算，再由游标过滤，保证软删/回流正确） */
export function collectSyncRows(d: AppData): SyncRow[] {
  const rows: SyncRow[] = []
  const hubName = d.workspaces.find(w => w.id === CURATION_WS_ID)?.name || '资源台'

  // 1) 调度台好奇心卡
  for (const c of d.curiosities) {
    rows.push({
      key: c.id, cardType: '好奇心', wsName: '调度台', catPath: '', level: 0, isThesis: false,
      title: c.question || '', link: c.sourceUrl || '', description: c.description || '',
      tags: (c.tags || []).join(';'), status: ({ todo: '待探索', doing: '探索中', done: '已求证', shelf: '已搁置' } as Record<string, string>)[c.status] || c.status,
      priority: '', dueDate: '', updatedAt: c.updatedAt, deleted: !!c.deletedAt
    })
  }
  // 2) 方向台任务卡
  for (const t of d.tasks) {
    const ctx = taskContext(d, t.projectId)
    rows.push({
      key: t.id, cardType: '任务', wsName: '方向台', catPath: ctx.path, level: ctx.level, isThesis: false,
      title: t.title || '', link: t.link || '', description: t.description || '',
      tags: (t.tags || []).join(';'), status: ({ todo: '待办', doing: '进行中', done: '已完成' } as Record<string, string>)[t.status] || t.status,
      priority: ({ high: '高', medium: '中', low: '低' } as Record<string, string>)[t.priority] || '',
      dueDate: t.dueDate || '', updatedAt: t.updatedAt, deleted: !!t.deletedAt
    })
  }
  // 3) 资源卡：R64 拍板——镜像卡是独立记录（幂等键 cardId:m:targetWsId），真身/台内卡仍以卡 id 为键
  const boards = curationBoards(d)
  for (const r of d.resources) {
    if (r.workspaceId === CURATION_WS_ID) {
      const cp = catPathOf(d, CURATION_WS_ID, r.categoryId)
      rows.push({
        key: r.id, cardType: '资源', wsName: hubName,
        catPath: cp.path, level: cp.level, isThesis: !!r.isThesis,
        title: r.title || '', link: r.link || '', description: r.description || '',
        tags: (r.tags || []).join(';'), status: '', priority: '', dueDate: '',
        updatedAt: r.updatedAt, deleted: !!r.deletedAt
      })
    } else if (boards.some(b => b.id === r.workspaceId)) {
      const cp = catPathOf(d, r.workspaceId, r.categoryId)
      rows.push({
        key: r.id, cardType: '资源', wsName: d.workspaces.find(w => w.id === r.workspaceId)?.name || '',
        catPath: cp.path, level: cp.level, isThesis: !!r.isThesis,
        title: r.title || '', link: r.link || '', description: r.description || '',
        tags: (r.tags || []).join(';'), status: '', priority: '', dueDate: '',
        updatedAt: r.updatedAt, deleted: !!r.deletedAt
      })
    }
    // 归档台/其它来源卡不同步（范围拍板外）
  }
  // 4) 镜像卡独立行：内容取真身，所属工作台/分类路径取投射落点（R64-F2）
  for (const p of d.curationProjections || []) {
    if (p.kind !== 'card' || !p.targetWsId || !p.cardId) continue
    const src = d.resources.find(r => r.id === p.cardId)
    if (!src) continue
    const targetName = d.workspaces.find(w => w.id === p.targetWsId)?.name
    if (!targetName) continue
    const cp = catPathOf(d, p.targetWsId, p.targetCatId)
    rows.push({
      key: `${p.cardId}:m:${p.targetWsId}`, cardType: '资源', wsName: targetName,
      catPath: cp.path, level: cp.level, isThesis: !!src.isThesis,
      title: src.title || '', link: src.link || '', description: src.description || '',
      tags: (src.tags || []).join(';'), status: '', priority: '', dueDate: '',
      updatedAt: src.updatedAt, deleted: !!src.deletedAt
    })
  }
  return rows
}

// ===== Airtable REST =====

interface AirtableField { id: string; name: string; type: string }

async function atFetch(state: AirtableSyncState, url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${state.pat}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    })
  } catch (e) {
    throw new Error('网络请求失败：' + (e instanceof Error ? e.message : String(e)))
  }
  if (res.status === 429) {
    // 限流退避后单次重试
    await sleep(RATE_LIMIT_BACKOFF)
    res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${state.pat}`, 'Content-Type': 'application/json', ...(init?.headers || {}) }
    })
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json() as { error?: { message?: string } }
      detail = body?.error?.message || ''
    } catch { /* ignore */ }
    if (res.status === 401) throw new Error('PAT 无效或权限不足（401）——需要 data.records:read/write + schema.bases:write')
    if (res.status === 403) throw new Error('无权访问该 Base（403）——确认 PAT 已授权此 Base 且你是 Creator')
    if (res.status === 404) throw new Error('Base 或 Table 不存在（404）——检查 ID 是否填对')
    throw new Error(`Airtable ${res.status}：${detail || res.statusText}`)
  }
  return res
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }

/** 连接测试：返回表名（找不到 tableId 时抛错） */
export async function testConnection(state: AirtableSyncState): Promise<string> {
  if (!state.pat || !state.baseId) throw new Error('请先填写 PAT 与 Base ID')
  const res = await atFetch(state, `${API}/meta/bases/${state.baseId}/tables`)
  const body = await res.json() as { tables: { id: string; name: string }[] }
  const table = body.tables.find(t => t.id === state.tableId)
  if (!table) throw new Error('Table ID 不在此 Base 中——可从表 URL（以 tbl 开头段）获取')
  return table.name
}

/** 表内现有字段名集合 */
async function listFields(state: AirtableSyncState): Promise<Map<string, AirtableField>> {
  const res = await atFetch(state, `${API}/meta/bases/${state.baseId}/tables`)
  const body = await res.json() as { tables: { id: string; fields: AirtableField[] }[] }
  const table = body.tables.find(t => t.id === state.tableId)
  const map = new Map<string, AirtableField>()
  for (const f of table?.fields || []) map.set(f.name, f)
  return map
}

/** 目标列定义（自动建字段用；已存在的列绝不动） */
export function targetColumns(): { name: string; type: string; options?: Record<string, unknown>; desc: string }[] {
  return [
    { name: '知源ID', type: 'singleLineText', desc: '幂等键' },
    { name: '标题', type: 'singleLineText', desc: '资源/任务=标题，好奇心=问题' },
    { name: '卡片类型', type: 'singleSelect', options: { choices: [{ name: '资源' }, { name: '任务' }, { name: '好奇心' }] }, desc: '资源/任务/好奇心' },
    { name: '所属工作台', type: 'singleLineText', desc: '调度台/方向台/资源台/策展台名' },
    { name: '分类路径', type: 'singleLineText', desc: '金字塔分类链（A / B / C）' },
    { name: '层级', type: 'number', options: { precision: 0 }, desc: '分类树深度，根=1' },
    { name: '是否中心论点', type: 'checkbox', options: { icon: 'check', color: 'greenBright' }, desc: '主题卡标记' },
    { name: '链接', type: 'url', desc: '' },
    { name: '描述', type: 'multilineText', desc: '' },
    { name: '标签', type: 'singleLineText', desc: '分号分隔' },
    { name: '状态', type: 'singleLineText', desc: '' },
    { name: '优先级', type: 'singleLineText', desc: '' },
    { name: '截止日期', type: 'singleLineText', desc: 'YYYY-MM-DD' },
    { name: '已删除', type: 'checkbox', options: { icon: 'check', color: 'redBright' }, desc: '软删标记（不物理删）' },
    { name: '更新时间', type: 'singleLineText', desc: 'ISO 时间' }
  ]
}

/** 比对缺列并自动补建（跳过 formula/rollup/lookup 与任何已存在列） */
async function ensureColumns(state: AirtableSyncState): Promise<number> {
  const existing = await listFields(state)
  let created = 0
  for (const col of targetColumns()) {
    if (existing.has(col.name)) continue // 已存在列不改名不改类型
    const payload: Record<string, unknown> = { name: col.name, type: col.type }
    if (col.options) payload.options = col.options
    await atFetch(state, `${API}/meta/bases/${state.baseId}/tables/${state.tableId}/fields`, {
      method: 'POST', body: JSON.stringify(payload)
    })
    created++
  }
  return created
}

function rowToFields(row: SyncRow): Record<string, unknown> {
  const f: Record<string, unknown> = {
    '知源ID': row.key,
    '标题': row.title,
    '所属工作台': row.wsName,
    '分类路径': row.catPath,
    '层级': row.level,
    '是否中心论点': row.isThesis,
    '描述': row.description,
    '标签': row.tags,
    '已删除': row.deleted,
    '更新时间': new Date(row.updatedAt).toISOString()
  }
  if (row.cardType) f['卡片类型'] = row.cardType
  if (row.link) f['链接'] = row.link
  if (row.status) f['状态'] = row.status
  if (row.priority) f['优先级'] = row.priority
  if (row.dueDate) f['截止日期'] = row.dueDate
  return f
}

/** 拉取表内「知源ID → recordId」（首配/映射丢失时重建，分页 100） */
async function buildRemoteIndex(state: AirtableSyncState): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  let offset: string | undefined
  do {
    const url = `${API}/${state.baseId}/${state.tableId}?pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`
    const res = await atFetch(state, url)
    const body = await res.json() as { records: { id: string; fields: Record<string, unknown> }[]; offset?: string }
    for (const rec of body.records || []) {
      const key = rec.fields['知源ID']
      if (typeof key === 'string' && key) out.set(key, rec.id)
    }
    offset = body.offset
  } while (offset)
  return out
}

function pushLog(state: AirtableSyncState, kind: AirtableLogEntry['kind'], msg: string) {
  state.log = state.log || []
  state.log.push({ at: Date.now(), kind, msg })
  if (state.log.length > 40) state.log = state.log.slice(-40)
}

/** 全量行 × 游标 → 待推送集合（映射表已有且远端未变则跳过） */
export function pendingRows(d: AppData): { rows: SyncRow[]; unsynced: number } {
  const state = d.airtableSync
  if (!state) return { rows: [], unsynced: 0 }
  const cursor = state.cursorAt || 0
  const all = collectSyncRows(d)
  const rows = all.filter(r => !cursor || r.updatedAt > cursor || r.deleted)
  return { rows, unsynced: rows.length }
}

/**
 * 执行一次单向同步（入口）。
 * @returns 推送条数；失败抛错（状态/log 由调用方兜底记录）
 */
export async function runSync(d: AppData): Promise<{ pushed: number; created: number; calls: number }> {
  const state = d.airtableSync
  if (!state) throw new Error('同步未初始化')
  const t0 = Date.now()
  let calls = 0
  try {
    // 1) 建表字段比对（失败即中止——结构未就绪推送无意义）
    const createdCols = await ensureColumns(state)
    calls += 2 // tables GET（ensureColumns 内含 listFields 一次；连接测试不计入本次）
    if (createdCols) pushLog(state, 'info', `自动补建字段 ${createdCols} 个`)

    // 2) 远端索引（映射表缺失的 key 用远端扫描补）
    const map = d.airtableMap = d.airtableMap || {}
    const remote = await buildRemoteIndex(state)
    calls++

    // 3) 游标过滤
    const cursor = state.cursorAt || 0
    const all = collectSyncRows(d)
    const todo = all.filter(r => !cursor || r.updatedAt > cursor || r.deleted)
      .filter(r => !map[r.key] || map[r.key].syncedAt < r.updatedAt || r.deleted)

    let pushed = 0
    /** 记录不存在语义（422/404）——触发单条降级重建 */
    const isMissingRecord = (msg: string) => /does not exist|422|404/i.test(msg)
    /** 单条创建（自愈重建用），返回新 recordId */
    const createOne = async (fields: Record<string, unknown>): Promise<string> => {
      const res = await atFetch(state, `${API}/${state.baseId}/${state.tableId}`, {
        method: 'POST', body: JSON.stringify({ records: [{ fields }] })
      })
      const body = await res.json() as { records: { id: string }[] }
      calls++
      return body.records?.[0]?.id || ''
    }
    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const batch = todo.slice(i, i + BATCH_SIZE)
      const creates: { fields: Record<string, unknown>; key: string }[] = []
      const updates: { id: string; fields: Record<string, unknown>; key: string }[] = []
      for (const row of batch) {
        const fields = rowToFields(row)
        // R64 自愈 R1：远端索引优先（远端实测存在的 recordId 才可信），本地 map 仅兜底
        const rid = remote.get(row.key) || map[row.key]?.recordId
        if (rid) { updates.push({ id: rid, fields, key: row.key }); map[row.key] = { recordId: rid, syncedAt: row.updatedAt } }
        else creates.push({ fields, key: row.key })
      }
      if (creates.length) {
        const res = await atFetch(state, `${API}/${state.baseId}/${state.tableId}`, {
          method: 'POST', body: JSON.stringify({ records: creates.map(c => ({ fields: c.fields })) })
        })
        const body = await res.json() as { records: { id: string; fields: Record<string, unknown> }[] }
        body.records?.forEach((rec, idx) => { map[creates[idx].key] = { recordId: rec.id, syncedAt: Date.now() } })
        calls++; pushed += creates.length
      }
      if (updates.length) {
        try {
          await atFetch(state, `${API}/${state.baseId}/${state.tableId}`, {
            method: 'PATCH', body: JSON.stringify({ records: updates.map(u => ({ id: u.id, fields: u.fields })) })
          })
          calls++; pushed += updates.length
        } catch (batchErr) {
          const batchMsg = batchErr instanceof Error ? batchErr.message : String(batchErr)
          if (!isMissingRecord(batchMsg)) throw batchErr
          // R64 自愈 R2：批量 PATCH 撞到已删记录 → 逐条降级；仍不存在则转 POST 重建
          pushLog(state, 'info', `检测到远端记录被删除，逐条自愈重建（${updates.length} 条）`)
          for (const u of updates) {
            try {
              await atFetch(state, `${API}/${state.baseId}/${state.tableId}`, {
                method: 'PATCH', body: JSON.stringify({ records: [{ id: u.id, fields: u.fields }] })
              })
              calls++; pushed++
            } catch (oneErr) {
              const oneMsg = oneErr instanceof Error ? oneErr.message : String(oneErr)
              if (!isMissingRecord(oneMsg)) throw oneErr
              const newId = await createOne(u.fields)
              if (newId) { map[u.key] = { recordId: newId, syncedAt: Date.now() }; pushed++ }
              else pushLog(state, 'error', `重建失败：${u.key}`)
            }
            await sleep(BATCH_GAP)
          }
        }
      }
      if (i + BATCH_SIZE < todo.length) await sleep(BATCH_GAP)
    }

    // 4) 游标推进（只推到本次见到的最大 updatedAt，避免时钟漂移漏推）
    const maxAt = Math.max(cursor, ...todo.map(r => r.updatedAt), 0)
    state.cursorAt = maxAt
    state.lastSyncAt = Date.now()
    state.lastSyncMs = Date.now() - t0
    state.lastSyncCalls = calls
    state.lastSyncedCount = pushed
    state.pendingCount = 0
    state.lastError = ''
    state.totalApiCalls = (state.totalApiCalls || 0) + calls
    pushLog(state, 'ok', `同步完成：推送 ${pushed} 条（新建字段 ${createdCols}）· 调用 ${calls} 次 · ${(state.lastSyncMs / 1000).toFixed(1)}s`)
    return { pushed, created: createdCols, calls }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    state.lastError = msg
    state.lastSyncAt = Date.now()
    state.lastSyncMs = Date.now() - t0
    state.totalApiCalls = (state.totalApiCalls || 0) + calls
    pushLog(state, 'error', msg)
    throw e
  }
}

/** 调用计数提示（R64：用户为付费会员版，去掉 Free 配额口径，仅报次数） */
export function quotaHint(state: AirtableSyncState): string {
  const used = state.totalApiCalls || 0
  if (!used) return ''
  return `累计调用 ${used} 次`
}

/** 卡片类型守卫（同步行只来自三类卡） */
export function isSyncableCard(card: AnyCard): boolean {
  return card.kind === 'resource' || card.kind === 'task' || card.kind === 'curiosity'
}

/** 资源台判定重导出（设置页/首页状态卡复用，避免散落 import） */
export { isHubWs }
