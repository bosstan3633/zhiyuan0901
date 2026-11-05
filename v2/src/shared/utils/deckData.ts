import type { AppData, Workspace } from '@/shared/models'
import { removeProjection } from '@/shared/storage/hub'

/** Export a single deck without cloud credentials, keeping global data for lossless re-import. */
export function buildWorkspaceExportData(data: AppData, workspaceId: string): Record<string, unknown> {
  const root = { ...data } as Record<string, unknown>
  delete root.airtableSync
  delete root.airtableMap
  const workspace = (data.workspaces || []).find(row => row.id === workspaceId)
  return JSON.parse(JSON.stringify({
    ...root,
    workspaces: workspace ? [workspace] : [],
    categories: (data.categories || []).filter(row => row.workspaceId === workspaceId),
    resources: (data.resources || []).filter(row => row.workspaceId === workspaceId),
  })) as Record<string, unknown>
}

/** Remove mirror projections for one deck only; source pool cards remain untouched. */
export function cleanWorkspaceMirrors(data: AppData, workspaceId: string): number {
  let removed = 0
  for (const projection of [...(data.curationProjections || [])]) {
    if (projection.targetWsId === workspaceId && removeProjection(data, projection.id)) removed += 1
  }
  return removed
}

export function workspaceFileName(workspace: Workspace | undefined): string {
  return `${workspace?.name || '策展台'}_数据.json`
}
