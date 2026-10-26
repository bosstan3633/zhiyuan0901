/**
 * 附件整体打包 / 导入的唯一实现。
 *
 * manifest 同时记录附件元数据与所属卡片，导入时据此判断「所属卡片是否存在」。
 * 读取本体按顺序逐项进行，不把全部 Blob 同时转成 ArrayBuffer 常驻内存。
 */
import { CURATION_WS_ID, type AppData, type AssetMeta } from '@/shared/models'
import type { ZipBlobEntry } from '@/shared/utils/zip'
import { buildZipFromBlobs, readZip } from '@/shared/utils/zip'
import { getAllAssetIndex, getAssetBlob, putAssets } from '@/shared/storage/assets'
import { EXPORT_MARKERS } from '@/shared/storage/keys'
import { wsNameById } from '@/shared/utils/wsName'

export type AssetOwnerKind = 'resource' | 'task' | 'curiosity' | 'argument'

export interface AssetOwnerRef {
  kind: AssetOwnerKind
  cardId: string
  cardTitle: string
  workspaceId?: string
  workspaceName?: string
  /** 面向用户的归属位置：策展台 / 资源卡池 / 方向台 / 调度台。 */
  location: string
  originalLink?: string
}

export interface AssetRow {
  assetId: string
  name: string
  kind: AssetMeta['kind']
  size: number
  mime: string
  createdAt: number
  owner: AssetOwnerRef
  storage: 'ok' | 'missing'
}

export interface AssetPackManifestItem {
  assetId: string
  name: string
  kind: AssetMeta['kind']
  size: number
  mime: string
  createdAt: number
  owner: AssetOwnerRef
}

export interface AssetPackManifest {
  type: typeof EXPORT_MARKERS.ASSET_PACK
  version: 2
  exportedAt: string
  count: number
  items: AssetPackManifestItem[]
}

export interface AssetPackImportResult {
  imported: number
  skipped: number
  skippedMissingOwner: number
  skippedInvalid: number
  skippedMissingFile: number
  overwritten: number
  linked: number
}

interface CardLike {
  id: string
  title?: string
  question?: string
  workspaceId?: string
  linkType?: string
  link?: string
  assets?: AssetMeta[]
}

/**
 * 从主数据构建附件行：主数据中每个 AssetMeta 一行；本体缺失时仍保留并标注。
 * 池卡与镜像卡的原始链接直接取卡自身 link；镜像不另开详情页。
 */
export function collectAssetRows(d: AppData, index: { id: string; size: number; mime: string }[]): AssetRow[] {
  const present = new Map(index.map(x => [x.id, x]))
  const workspaceMap = new Map(d.workspaces.map(w => [w.id, w]))
  const projectByMetric = new Map<string, string>()
  for (const dir of d.compass?.directions || []) {
    for (const project of dir.projects || []) {
      for (const metric of project.metrics || []) projectByMetric.set(metric.id, project.name)
    }
  }
  const rows: AssetRow[] = []
  const push = (kind: AssetOwnerKind, cards: CardLike[]) => {
    for (const card of cards || []) {
      if (!card || typeof card.id !== 'string') continue
      const workspace = card.workspaceId ? workspaceMap.get(card.workspaceId) : undefined
      let location = '资源卡池'
      if (kind === 'argument') location = workspace?.name || '未知策展台'
      else if (kind === 'task') {
        const task = card as CardLike & { projectId?: string; metricId?: string }
        const projectName = d.compass.directions
          .flatMap(dir => dir.projects || [])
          .find(project => project.id === task.projectId)?.name
        location = ['方向台', projectName || projectByMetric.get(task.metricId || '')].filter(Boolean).join(' · ')
      } else if (kind === 'curiosity') location = '调度台'
      else if (card.workspaceId && card.workspaceId !== CURATION_WS_ID && workspace?.kind !== 'resource') {
        location = workspace?.name || '未知策展台'
      }
      for (const meta of card.assets || []) {
        if (!meta || typeof meta.id !== 'string') continue
        const actual = present.get(meta.id)
        rows.push({
          assetId: meta.id,
          name: meta.name || meta.id,
          kind: meta.kind,
          size: actual?.size ?? meta.size ?? 0,
          mime: actual?.mime || meta.mime || '',
          createdAt: meta.createdAt || 0,
          owner: {
            kind,
            cardId: card.id,
            cardTitle: (kind === 'curiosity' ? card.question : card.title) || '未命名',
            workspaceId: card.workspaceId,
            workspaceName: card.workspaceId ? (wsNameById(d.workspaces, card.workspaceId) || '未知策展台') : undefined,
            location,
            originalLink: card.link || undefined
          },
          storage: actual ? 'ok' : 'missing'
        })
      }
    }
  }
  push('resource', d.resources as CardLike[])
  push('task', d.tasks as CardLike[])
  push('curiosity', d.curiosities as CardLike[])
  push('argument', (d.argCards || []) as CardLike[])
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

/** 主数据中没有、但 IndexedDB 里仍有本体的附件——附件管理里显示为孤儿行。 */
export function orphanAssetRows(index: { id: string; size: number; mime: string }[], rows: AssetRow[]): AssetRow[] {
  const referenced = new Set(rows.map(r => r.assetId))
  return index
    .filter(x => !referenced.has(x.id))
    .map(x => ({
      assetId: x.id,
      name: x.id,
      kind: 'html',
      size: x.size,
      mime: x.mime,
      createdAt: 0,
      owner: { kind: 'resource', cardId: '', cardTitle: '无卡片引用', location: '无卡片引用', originalLink: undefined },
      storage: 'ok' as const
    }))
}

/** 生成本次打包的 manifest（不含 Blob）。 */
export function buildAssetManifest(rows: AssetRow[], onlyPresent = true): AssetPackManifest {
  const items = rows
    .filter(r => !onlyPresent || r.storage === 'ok')
    .map(r => ({
      assetId: r.assetId,
      name: r.name,
      kind: r.kind,
      size: r.size,
      mime: r.mime,
      createdAt: r.createdAt,
      owner: {
        ...r.owner,
        isMirror: false
      }
    }))
  return { type: EXPORT_MARKERS.ASSET_PACK, version: 2, exportedAt: new Date().toISOString(), count: items.length, items }
}

/** 逐项读取本体并打包；进度回调用于 CLI/UI 显示处理中状态。 */
export async function buildAssetPack(
  rows: AssetRow[],
  onProgress?: (done: number, total: number) => void
): Promise<{ blob: Blob; manifest: AssetPackManifest; missing: number }> {
  const presentRows = rows.filter(r => r.storage === 'ok')
  const manifest = buildAssetManifest(presentRows)
  const entries: ZipBlobEntry[] = []
  const enc = new TextEncoder()
  let done = 0
  for (const row of presentRows) {
    const blob = await getAssetBlob(row.assetId)
    if (!blob) { done++; onProgress?.(done, presentRows.length); continue }
    entries.push({ name: `assets/${row.assetId}`, data: blob })
    done++
    onProgress?.(done, presentRows.length)
  }
  // manifest 最后放入，避免清单声明了未打包成功的条目
  const packedIds = new Set(entries.map(e => e.name.slice('assets/'.length)))
  manifest.items = manifest.items.filter(i => packedIds.has(i.assetId))
  manifest.count = manifest.items.length
  entries.unshift({ name: 'manifest.json', data: new Blob([enc.encode(JSON.stringify(manifest, null, 2))], { type: 'application/json' }) })
  return { blob: await buildZipFromBlobs(entries), manifest, missing: presentRows.length - manifest.items.length }
}

/** 导入结果：资源卡/所属卡片不存在则跳过；同 assetId 覆盖。 */
export async function importAssetPack(
  file: File,
  d: AppData
): Promise<AssetPackImportResult> {
  const result: AssetPackImportResult = { imported: 0, skipped: 0, skippedMissingOwner: 0, skippedInvalid: 0, skippedMissingFile: 0, overwritten: 0, linked: 0 }
  const entries = readZip(await file.arrayBuffer())
  const manifestEntry = entries.find(e => e.name === 'manifest.json')
  if (!manifestEntry) throw new Error('附件包缺少 manifest.json')
  let manifest: AssetPackManifest
  try { manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as AssetPackManifest } catch { throw new Error('manifest.json 格式错误') }
  if (manifest.type !== EXPORT_MARKERS.ASSET_PACK || manifest.version !== 2 || !Array.isArray(manifest.items)) {
    throw new Error('附件包类型或版本不兼容')
  }
  const owners = {
    resource: new Map<string, CardLike>(d.resources.map(c => [c.id, c as CardLike])),
    task: new Map<string, CardLike>(d.tasks.map(c => [c.id, c as CardLike])),
    curiosity: new Map<string, CardLike>(d.curiosities.map(c => [c.id, c as CardLike])),
    argument: new Map<string, CardLike>((d.argCards || []).map(c => [c.id, c as CardLike]))
  }
  const byName = new Map(entries.map(e => [e.name, e]))
  const writes: { id: string; blob: Blob }[] = []
  const existing = new Set((await getAllAssetIndex()).map(x => x.id))
  for (const item of manifest.items) {
    if (!item || typeof item.assetId !== 'string' || !item.owner) { result.skippedInvalid++; result.skipped++; continue }
    const ownerMap = owners[item.owner.kind]
    const ownerCard = ownerMap?.get(item.owner.cardId)
    if (!ownerCard) { result.skippedMissingOwner++; result.skipped++; continue }
    const entry = byName.get(`assets/${item.assetId}`)
    if (!entry) { result.skippedMissingFile++; result.skipped++; continue }
    if (existing.has(item.assetId)) result.overwritten++
    writes.push({ id: item.assetId, blob: new Blob([entry.data], { type: item.mime || 'application/octet-stream' }) })
    if (!Array.isArray(ownerCard.assets)) ownerCard.assets = []
    if (!ownerCard.assets.some(a => a.id === item.assetId)) {
      ownerCard.assets.push({
        id: item.assetId,
        kind: item.kind,
        name: item.name,
        size: item.size,
        mime: item.mime,
        createdAt: item.createdAt || Date.now()
      })
      result.linked++
    }
    result.imported++
  }
  await putAssets(writes)
  return result
}

/** 附件行可见性：附件管理只用「全部」和下列筛选，不做单项下载。 */
export function filterAssetRows(
  rows: AssetRow[],
  query: string,
  kind: 'all' | AssetMeta['kind'],
  storage: 'all' | AssetRow['storage'],
  ownerKind: 'all' | AssetOwnerKind
): AssetRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter(r =>
    (!q || r.name.toLowerCase().includes(q) || r.owner.cardTitle.toLowerCase().includes(q)) &&
    (kind === 'all' || r.kind === kind) &&
    (storage === 'all' || r.storage === storage) &&
    (ownerKind === 'all' || r.owner.kind === ownerKind)
  )
}
