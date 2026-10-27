import type { AppData, CuriosityCard, Direction, FieldConfig, FieldDef, ResourceCard } from '@/shared/models'
import { markRank } from '@/shared/utils/marksort'
import { visibleFields } from '@/shared/utils/fields'
import { buildSupportIndex, listByCurio } from '@/shared/utils/supportLinks'
import type { CuriStatus } from '@/newtab/stores/curiosity'

export interface CurioGroup {
  id: string
  name: string
  items: CuriosityCard[]
}

export function filterCuriosities(
  curiosities: CuriosityCard[],
  statusFilter: CuriStatus | 'all',
  searchQuery: string,
  sortDir: 'asc' | 'desc',
): CuriosityCard[] {
  const alive = curiosities.filter(c => !c.lifecycleArchived)
  let list = statusFilter === 'all' ? alive : alive.filter(c => c.status === statusFilter)
  const q = searchQuery.trim().toLowerCase()
  if (q) list = list.filter(c => c.question.toLowerCase().includes(q))
  const dirMul = sortDir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const rank = markRank(b) - markRank(a)
    if (rank !== 0) return rank
    if (a.sortOrder != null || b.sortOrder != null) {
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    }
    return dirMul * ((a.createdAt || 0) - (b.createdAt || 0))
  })
}

export function archivedHintCount(curiosities: CuriosityCard[], statusFilter: CuriStatus | 'all'): number {
  return curiosities
    .filter(c => c.lifecycleArchived && (statusFilter === 'all' || c.status === statusFilter)).length
}

export function statusCountsOf(curiosities: CuriosityCard[]): Record<string, number> {
  const counts: Record<string, number> = { all: curiosities.length }
  for (const c of curiosities) counts[c.status] = (counts[c.status] || 0) + 1
  return counts
}

export function groupCuriosities(filtered: CuriosityCard[]): CurioGroup[] {
  return [
    { id: 'pin', name: '已置顶', items: filtered.filter(c => c.pinned) },
    { id: 'rest', name: '全部好奇心', items: filtered.filter(c => !c.pinned) },
  ].filter(g => g.items.length)
}

export function kanbanColumnsOf(
  curiosities: CuriosityCard[],
  statusMap: Record<CuriStatus, { label: string; icon: string }>,
): Array<{ status: CuriStatus; label: string; icon: string; items: CuriosityCard[] }> {
  const statuses: CuriStatus[] = ['todo', 'doing', 'done', 'shelf']
  return statuses.map(status => ({
    status,
    ...statusMap[status],
    items: curiosities
      .filter(c => c.status === status && !c.lifecycleArchived)
      .sort((a, b) => {
        if (a.sortOrder != null || b.sortOrder != null) {
          return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        }
        return (a.createdAt || 0) - (b.createdAt || 0)
      }),
  }))
}

export const CZ_SKELETON_KEYS = ['question', 'status', 'createdAt']

export function isCurioFieldVisible(fieldConfig: FieldConfig, key: string): boolean {
  return visibleFields(fieldConfig, 'curiosity').some(f => f.key === key)
}

export function visibleCurioExtFields(fieldConfig: FieldConfig): FieldDef[] {
  return visibleFields(fieldConfig, 'curiosity').filter(f => !CZ_SKELETON_KEYS.includes(f.key))
}

export function curioExtValue(card: CuriosityCard, field: FieldDef): string {
  const value = card.customFields?.[field.key]
  return value == null ? '' : String(value)
}

export function shortDate(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  return `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function shortSource(url: string): string {
  try {
    const u = new URL(url)
    return (u.hostname + u.pathname).replace(/^www\./, '').slice(0, 42)
  } catch {
    return url.slice(0, 42)
  }
}

export function supportRowsOf(d: AppData, curioId: string | null) {
  if (!curioId) return [] as Array<{ link: ReturnType<typeof listByCurio>[number]; resource: ResourceCard }>
  return listByCurio(buildSupportIndex(d), curioId)
    .map(link => ({
      link,
      resource: (d.resources || []).find(r => r.id === link.resourceId && !r.deletedAt),
    }))
    .filter((row): row is { link: ReturnType<typeof listByCurio>[number]; resource: ResourceCard } => !!row.resource)
}

export function supportCandidatesOf(resources: ResourceCard[], linkedIds: Set<string>, query: string): ResourceCard[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return resources
    .filter(r => !r.deletedAt && !linkedIds.has(r.id) && (r.title || '').toLowerCase().includes(q))
    .slice(0, 8)
}

export interface FlatProjectOption {
  id: string
  name: string
  dir: string
  metrics: { id: string; title: string }[]
}

export function flattenProjectOptions(directions: Direction[]): FlatProjectOption[] {
  const list: FlatProjectOption[] = []
  for (const dir of directions) {
    for (const project of dir.projects) {
      list.push({
        id: project.id,
        name: project.name,
        dir: dir.name,
        metrics: project.metrics.map(m => ({ id: m.id, title: m.title })),
      })
    }
  }
  return list
}
