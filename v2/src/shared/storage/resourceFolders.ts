import {
  CURATION_WS_ID,
  type AppData,
  type ID,
  type ResourceCard,
  type ResourceFolder,
  type ResourceFolderMirror,
} from '@/shared/models'
import { uid } from '@/shared/utils'
import { cloneResourceMirrorSnapshot } from './resourceMirrors'

export const RESOURCE_FOLDER_NAME_MAX = 20

export interface ResourceFolderCreateResult {
  ok: boolean
  folder?: ResourceFolder
  message: string
}

export interface ResourceFolderMirrorResult {
  ok: boolean
  created: boolean
  mirror?: ResourceFolderMirror
  message: string
}

export function resourceFoldersOf(d: AppData): ResourceFolder[] {
  return [...(d.resourceFolders || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt)
}

export function resourceFolderMirrorsOf(d: AppData, folderId: ID): ResourceFolderMirror[] {
  return (d.resourceFolderMirrors || [])
    .filter(mirror => mirror.folderId === folderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.addedAt - b.addedAt)
}

export function mirrorResourceOf(mirror: ResourceFolderMirror, resources: ResourceCard[]): ResourceCard | null {
  if (mirror.snapshot) return mirror.snapshot
  return resources.find(resource => resource.id === mirror.resourceId && !resource.deletedAt) || null
}

export function folderIdsOfResource(d: AppData, resourceId: ID): Set<ID> {
  return new Set(
    (d.resourceFolderMirrors || [])
      .filter(mirror => mirror.resourceId === resourceId)
      .map(mirror => mirror.folderId),
  )
}

function cleanFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function validateResourceFolderName(
  d: AppData,
  name: string,
  excludeId?: ID,
): { ok: boolean; name: string; message: string } {
  const clean = cleanFolderName(name)
  if (!clean) return { ok: false, name: clean, message: '请输入常用夹名称' }
  if (clean.length > RESOURCE_FOLDER_NAME_MAX) {
    return { ok: false, name: clean, message: `名称最多 ${RESOURCE_FOLDER_NAME_MAX} 个字` }
  }
  const duplicate = (d.resourceFolders || []).some(folder =>
    folder.id !== excludeId && cleanFolderName(folder.name).toLocaleLowerCase() === clean.toLocaleLowerCase()
  )
  if (duplicate) return { ok: false, name: clean, message: '已有同名常用夹' }
  return { ok: true, name: clean, message: '' }
}

export function createResourceFolder(d: AppData, name: string, at = Date.now()): ResourceFolderCreateResult {
  const checked = validateResourceFolderName(d, name)
  if (!checked.ok) return { ok: false, message: checked.message }
  const order = (d.resourceFolders || []).reduce((max, folder) => Math.max(max, folder.order ?? 0), -1) + 1
  const folder: ResourceFolder = {
    id: uid('rf'),
    name: checked.name,
    order,
    createdAt: at,
    updatedAt: at,
  }
  d.resourceFolders = [...(d.resourceFolders || []), folder]
  d.resourceFolderMirrors = d.resourceFolderMirrors || []
  return { ok: true, folder, message: `已新建常用夹「${folder.name}」` }
}

export function renameResourceFolder(
  d: AppData,
  folderId: ID,
  name: string,
  at = Date.now(),
): ResourceFolderCreateResult {
  const folder = (d.resourceFolders || []).find(row => row.id === folderId)
  if (!folder) return { ok: false, message: '常用夹已不存在' }
  const checked = validateResourceFolderName(d, name, folderId)
  if (!checked.ok) return { ok: false, message: checked.message }
  if (folder.name === checked.name) return { ok: true, folder, message: '名称没有变化' }
  folder.name = checked.name
  folder.updatedAt = at
  return { ok: true, folder, message: `已重命名为「${folder.name}」` }
}

export function deleteResourceFolder(d: AppData, folderId: ID): { ok: boolean; mirrors: number; folder?: ResourceFolder } {
  const folder = (d.resourceFolders || []).find(row => row.id === folderId)
  if (!folder) return { ok: false, mirrors: 0 }
  const before = (d.resourceFolderMirrors || []).length
  d.resourceFolders = (d.resourceFolders || []).filter(row => row.id !== folderId)
  d.resourceFolderMirrors = (d.resourceFolderMirrors || []).filter(row => row.folderId !== folderId)
  return { ok: true, mirrors: before - (d.resourceFolderMirrors || []).length, folder }
}

export function addResourceFolderMirror(
  d: AppData,
  folderId: ID,
  resourceId: ID,
  at = Date.now(),
): ResourceFolderMirrorResult {
  const folder = (d.resourceFolders || []).find(row => row.id === folderId)
  if (!folder) return { ok: false, created: false, message: '常用夹已不存在' }
  const source = d.resources.find(resource =>
    resource.id === resourceId && !resource.deletedAt && resource.workspaceId === CURATION_WS_ID
  )
  if (!source) return { ok: false, created: false, message: '只能镜像资源卡池里的有效资源卡' }
  d.resourceFolderMirrors = d.resourceFolderMirrors || []
  const existed = d.resourceFolderMirrors.find(row => row.folderId === folderId && row.resourceId === resourceId)
  if (existed) {
    if (!existed.snapshot) existed.snapshot = cloneResourceMirrorSnapshot(source)
    return { ok: true, created: false, mirror: existed, message: '这张资源卡已在该常用夹内' }
  }
  const order = resourceFolderMirrorsOf(d, folderId).reduce((max, row) => Math.max(max, row.order ?? 0), -1) + 1
  const mirror: ResourceFolderMirror = {
    id: uid('rfm'),
    folderId,
    resourceId,
    order,
    addedAt: at,
    snapshot: cloneResourceMirrorSnapshot(source),
  }
  d.resourceFolderMirrors.push(mirror)
  return { ok: true, created: true, mirror, message: `已加入「${folder.name}」` }
}

export function removeResourceFolderMirror(d: AppData, mirrorId: ID): boolean {
  const before = (d.resourceFolderMirrors || []).length
  d.resourceFolderMirrors = (d.resourceFolderMirrors || []).filter(row => row.id !== mirrorId)
  return (d.resourceFolderMirrors || []).length < before
}

export function pruneResourceFolderMirrors(d: AppData): number {
  const folderIds = new Set((d.resourceFolders || []).map(folder => folder.id))
  const before = (d.resourceFolderMirrors || []).length
  d.resourceFolderMirrors = (d.resourceFolderMirrors || []).filter(row => folderIds.has(row.folderId))
  return before - (d.resourceFolderMirrors || []).length
}

export function hydrateResourceFolderMirrorSnapshots(d: AppData): number {
  d.resourceFolders = d.resourceFolders || []
  d.resourceFolderMirrors = d.resourceFolderMirrors || []
  const sources = new Map(d.resources.map(resource => [resource.id, resource]))
  let changed = 0
  for (const mirror of d.resourceFolderMirrors) {
    if (mirror.snapshot) continue
    const source = sources.get(mirror.resourceId)
    if (!source) continue
    mirror.snapshot = cloneResourceMirrorSnapshot(source)
    changed++
  }
  return changed
}

export function uniqueUrlsForFolder(
  d: AppData,
  folderId: ID,
  toOpenableUrl: (type: ResourceCard['linkType'], link: string) => string,
): { cards: ResourceCard[]; skipped: number; duplicate: number } {
  const seen = new Set<string>()
  const cards: ResourceCard[] = []
  let skipped = 0
  let duplicate = 0
  for (const mirror of resourceFolderMirrorsOf(d, folderId)) {
    const card = mirrorResourceOf(mirror, d.resources)
    if (!card) {
      skipped++
      continue
    }
    const url = toOpenableUrl(card.linkType, card.link)
    if (!url) {
      skipped++
      continue
    }
    if (seen.has(url)) {
      duplicate++
      continue
    }
    seen.add(url)
    cards.push({ ...card, id: mirror.id })
  }
  return { cards, skipped, duplicate }
}
