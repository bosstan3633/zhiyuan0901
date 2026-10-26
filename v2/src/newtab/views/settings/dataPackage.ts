/**
 * 设置 · 数据管理：数据包的唯一导入/导出口径。
 *
 * 主数据仍是 AppData；事件日志来自独立键 zy_event_log，导出时作为包内 eventLog 段带走。
 * 附件本体永远不进数据包——完整附件迁移只走「附件管理 → 全部附件整体打包下载」。
 */
import type { AppData, CuriosityCard, ID, ResourceCard, TaskCard } from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { EVENT_LOG_CAP, mergeImportedEventLog, readEventLog } from '@/shared/utils/eventLog'
import { normalizeLegacyCards, stripRetiredCardKeys } from '@/shared/storage/repository'
import { saveUIPrefs } from '@/shared/storage/repository'
import { defaultThesisFieldDefs } from '@/shared/storage/defaults'
import { sanitizeCategoryTree, catTreeFixedAny, catTreeFixNote } from '@/shared/utils/catTree'
import { sanitizeCardCols } from '@/shared/utils/cardCols'
import { sanitizeWsView } from '@/shared/utils/wsView'
import { resolveTheme } from '@/shared/utils/theme'
import { sanitizeThesisDuplicates } from '@/shared/storage/hub'
import { dateKey, weekStartKey } from '@/shared/utils'

export interface DataPackage extends AppData {
  /** 数据包类型标识（可选；兼容旧版直接导出的 AppData） */
  packageType?: 'zhiyuan_data'
  exportedAt?: string
  /** UI 偏好（主题 / 密度 / 列数 / 各台视图），与主数据同包传输 */
  uiPrefs?: Record<string, unknown>
  /** 最近 5000 条事件日志；导入时按事件 ID 与本地并集 */
  eventLog?: CardEvent[]
}

export interface MergeImportResult {
  cards: number
  dirs: number
  ws: number
  catFix: string
  thesisClear: number
  eventImported: number
  eventKept: number
}

/** 导出载荷：剥离 Airtable 凭证与映射，只带业务数据和事件日志。 */
export function buildDataPackage(
  data: AppData,
  eventLog: CardEvent[],
  uiPrefs?: Record<string, unknown>
): DataPackage {
  const safe = { ...(data as unknown as Record<string, unknown>) }
  delete safe.airtableSync
  delete safe.airtableMap
  const payload: DataPackage = {
    ...(safe as unknown as DataPackage),
    packageType: 'zhiyuan_data',
    exportedAt: new Date().toISOString(),
    eventLog: eventLog.slice(-EVENT_LOG_CAP)
  }
  if (uiPrefs) payload.uiPrefs = uiPrefs
  return payload
}

/** 导入前自动备份与通用导出共用同一脱敏口径。 */
export function buildSafeBackup(data: AppData, eventLog: CardEvent[]): DataPackage {
  return buildDataPackage(data, eventLog)
}

export async function readDataPackageEventLog(): Promise<CardEvent[]> {
  return (await readEventLog()).slice(-EVENT_LOG_CAP)
}

export function validateDataPackage(raw: unknown): DataPackage | null {
  if (!raw || typeof raw !== 'object') return null
  const pkg = raw as Record<string, unknown>
  if (pkg.version !== 2) return null
  return pkg as unknown as DataPackage
}

/** 全量并集合并：与旧设置页导入保持同一口径，并追加事件日志合并。 */
export async function mergeDataPackage(imported: DataPackage, current: AppData): Promise<MergeImportResult> {
  const d = current
  const catSan = sanitizeCategoryTree(imported.categories || [])
  const safeCats = catSan.ok ? catSan.cats : []
  const catFix = catSan.ok
    ? (catTreeFixedAny(catSan.fixed) ? catTreeFixNote(catSan.fixed) : '')
    : '分类数量超上限，已跳过分类段'

  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map(existing.map(x => [x.id, x]))
    for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item })
    return [...map.values()]
  }
  const union = (...lists: (ID[] | undefined)[]): ID[] => Array.from(new Set(lists.flatMap(l => l || [])))
  const wsBefore = d.workspaces.length
  const importedNow = Date.now()

  d.workspaces = mergeById(d.workspaces, imported.workspaces || [])
  d.categories = mergeById(d.categories, safeCats)
  d.resources = mergeById(d.resources, stripRetiredCardKeys<ResourceCard>(imported.resources).map(r => ({ ...r, importedAt: importedNow })))
  d.tasks = mergeById(d.tasks, stripRetiredCardKeys<TaskCard>(imported.tasks).map(t => ({ ...t, importedAt: importedNow })))
  d.curiosities = mergeById(d.curiosities, stripRetiredCardKeys<CuriosityCard>(imported.curiosities).map(c => ({ ...c, importedAt: importedNow })))
  normalizeLegacyCards(d)
  const cardsAdded = (imported.resources?.length || 0) + (imported.tasks?.length || 0) + (imported.curiosities?.length || 0)

  if (imported.compass) {
    const ic = imported.compass
    for (const key of ['vision', 'mission'] as const) {
      const inc = ic[key]
      if (!inc) continue
      const cur = d.compass[key]
      if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) {
        d.compass[key] = {
          ...inc,
          linkedResourceIds: union(cur?.linkedResourceIds, inc.linkedResourceIds),
          linkedCuriosityIds: union(cur?.linkedCuriosityIds, inc.linkedCuriosityIds)
        }
      } else {
        cur.linkedResourceIds = union(cur.linkedResourceIds, inc.linkedResourceIds)
        cur.linkedCuriosityIds = union(cur.linkedCuriosityIds, inc.linkedCuriosityIds)
      }
    }
    for (const incDir of ic.directions || []) {
      const curDir = d.compass.directions.find(x => x.id === incDir.id)
      if (!curDir) { d.compass.directions.push(JSON.parse(JSON.stringify(incDir))); continue }
      curDir.name = incDir.name ?? curDir.name
      curDir.status = incDir.status ?? curDir.status
      curDir.term = incDir.term ?? curDir.term
      curDir.calibratedAt = incDir.calibratedAt ?? curDir.calibratedAt
      for (const incProj of incDir.projects || []) {
        const curProj = curDir.projects.find(x => x.id === incProj.id)
        if (!curProj) { curDir.projects.push(JSON.parse(JSON.stringify(incProj))); continue }
        Object.assign(curProj, incProj, { metrics: curProj.metrics })
        for (const incMet of incProj.metrics || []) {
          const curMet = curProj.metrics.find(x => x.id === incMet.id)
          if (!curMet) { curProj.metrics.push(JSON.parse(JSON.stringify(incMet))); continue }
          Object.assign(curMet, incMet, { taskIds: union(curMet.taskIds, incMet.taskIds) })
        }
      }
    }
  }

  if (imported.dailyFocus) {
    for (const [date, slots] of Object.entries(imported.dailyFocus)) {
      const cur = d.dailyFocus[date]
      if (!cur) { d.dailyFocus[date] = slots; continue }
      const seen = new Set(cur.map(s => s.id))
      for (const s of slots) if (!seen.has(s.id)) cur.push(s)
    }
  }

  if (imported.stats) {
    if (imported.stats.wrr && d.stats.wrr) {
      d.stats.wrr.totalCumulativeUsage = Math.max(d.stats.wrr.totalCumulativeUsage || 0, imported.stats.wrr.totalCumulativeUsage || 0)
      const wkNow = weekStartKey(dateKey(new Date()))
      const weekVal = (w?: { thisWeekUsage?: number; thisWeekStart?: string }) =>
        !w ? 0 : (!w.thisWeekStart || w.thisWeekStart === wkNow) ? (w.thisWeekUsage || 0) : 0
      d.stats.wrr.thisWeekUsage = Math.max(weekVal(d.stats.wrr), weekVal(imported.stats.wrr))
      d.stats.wrr.thisWeekStart = wkNow
      d.stats.wrr.lastUpdatedAt = Math.max(d.stats.wrr.lastUpdatedAt || 0, imported.stats.wrr.lastUpdatedAt || 0)
    }
    for (const key of ['lastReuse', 'lastVisits'] as const) {
      const inc = imported.stats[key]
      if (!inc) continue
      const cur = d.stats[key] as Record<string, number>
      for (const [k, v] of Object.entries(inc)) cur[k] = Math.max(cur[k] || 0, v)
    }
  }

  d.activityLogs = []

  if (imported.curationProjections?.length || d.curationProjections?.length) {
    d.curationProjections = mergeById(d.curationProjections || [], imported.curationProjections || [])
  }
  if (imported.supportLinks?.length || d.supportLinks?.length) {
    d.supportLinks = mergeById(d.supportLinks || [], imported.supportLinks || [])
  }
  if (imported.curioSupportLinks?.length || d.curioSupportLinks?.length) {
    d.curioSupportLinks = mergeById(d.curioSupportLinks || [], imported.curioSupportLinks || [])
  }
  if (imported.argCards?.length || d.argCards?.length) {
    d.argCards = mergeById(d.argCards || [], imported.argCards || [])
  }

  if (imported.tagTree?.length) {
    const existIds = new Set(d.tagTree.map(t => t.id))
    for (const root of imported.tagTree) if (!existIds.has(root.id)) d.tagTree.push(root)
  }
  if (imported.fieldConfig) {
    const cfg = d.fieldConfig
    if (!cfg.thesis) cfg.thesis = defaultThesisFieldDefs()
    for (const key of ['resource', 'task', 'curiosity', 'thesis'] as const) {
      const importedGroup = imported.fieldConfig[key]
      const group = cfg[key]
      if (!importedGroup || !group) continue
      const existingKeys = new Set(group.map(f => f.key))
      for (const f of importedGroup) if (!existingKeys.has(f.key)) group.push(f)
    }
  }

  const thesisFix = sanitizeThesisDuplicates(d)
  const eventResult = await mergeImportedEventLog(imported.eventLog)
  return {
    cards: cardsAdded,
    dirs: imported.compass?.directions?.length || 0,
    ws: d.workspaces.length - wsBefore + (imported.workspaces?.length || 0),
    catFix,
    thesisClear: thesisFix.cleared,
    eventImported: eventResult.imported,
    eventKept: eventResult.kept
  }
}

/** 全量包附带 UI 偏好时即时应用；非法值丢弃，不覆盖现有偏好。 */
export function applyDataPackageUIPrefs(ui: Record<string, unknown> | undefined): boolean {
  if (!ui || typeof ui !== 'object') return false
  if (typeof ui.theme === 'string' && ui.theme) {
    document.documentElement.setAttribute('data-theme', resolveTheme(ui.theme))
    saveUIPrefs({ theme: ui.theme })
  }
  if (typeof ui.density === 'string' && ui.density) {
    if (ui.density === 'compact') document.documentElement.setAttribute('data-density', 'compact')
    else document.documentElement.removeAttribute('data-density')
    saveUIPrefs({ density: ui.density as 'compact' | 'cozy' })
  }
  const cols = sanitizeCardCols(ui.cardCols)
  if (Object.keys(cols).length) saveUIPrefs({ cardCols: cols })
  const wv = sanitizeWsView(ui.wsViewMode)
  if (Object.keys(wv).length) saveUIPrefs({ wsViewMode: wv })
  return true
}
