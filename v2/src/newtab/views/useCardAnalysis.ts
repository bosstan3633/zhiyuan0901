import { computed, type ComputedRef } from 'vue'
import type {
  AppData,
  CuriosityCard,
  ID,
  ResourceCard,
  TaskCard,
  TaskStatusDef,
  TaskStatusBucket,
  TopicCard,
  TopicStatusDef,
} from '@/shared/models'
import type { CardEvent } from '@/shared/utils/eventLog'
import { lifecycleState } from '@/shared/utils/lifecycle'
import { sortedTaskStatuses } from '@/shared/utils/taskStatus'
import { sortedTopicStatuses } from '@/shared/utils/topicStatus'
import { topicOutcomeLink } from '@/shared/utils/topicOutcome'
import {
  buildCardInventory,
  DAY_MS,
  hasUsableResourceLink,
  monthStartAt,
  resourceLinkKindOf,
  type CardInventoryIndex,
  type ResourceLinkKind,
} from '@/shared/analytics/cardInventory'
import { buildTaskOwnership, type TaskOwnershipIndex } from '@/shared/analytics/taskOwnership'
import { buildTaskEvidence, type TaskEvidenceIndex } from '@/shared/analytics/taskEvidence'
import {
  buildFocusUsage,
  focusCardSummary,
  focusUsageOfCard,
  type FocusCardSummary,
  type FocusUsageIndex,
} from '@/shared/analytics/focusUsage'

export type CardAnalysisKind = 'task' | 'resource' | 'curiosity' | 'topic'

export interface AnalysisBar {
  key: string
  label: string
  count: number
  pct: number
  tone?: 'accent' | 'warn' | 'success' | 'info' | 'muted'
  note?: string
}

export interface TaskAnalysisRow {
  id: ID
  card: TaskCard
  title: string
  statusId?: ID
  statusName: string
  statusBucket: TaskStatusBucket
  done: boolean
  projectId?: ID
  projectName: string
  metricId?: ID
  metricTitle: string
  attached: boolean
  scheduled: boolean
  dueDate: string
  focusCount: number
  supportCount: number
  conflict: boolean
  conflictLabel: string
  planChanges: number
  lastActivityAt: number
}

export interface TaskAnalysisBlock {
  rows: TaskAnalysisRow[]
  liveCount: number
  doneCount: number
  doneRate: number
  projectAttachedCount: number
  metricAttachedCount: number
  attachedCount: number
  scheduledCount: number
  unscheduledCount: number
  focusEnteredCount: number
  focusNeverCount: number
  focusAverageEntered: number
  focusAverageAll: number
  focusMax: number
  focusDistribution: AnalysisBar[]
  noSupportCount: number
  conflictCount: number
  ambiguousCount: number
  projectDistribution: AnalysisBar[]
  metricDistribution: AnalysisBar[]
  statusDistribution: AnalysisBar[]
  planCoverage: AnalysisBar[]
  supportDistribution: AnalysisBar[]
  monthAdded: number
}

export interface ResourceAnalysisRow {
  id: ID
  card: ResourceCard
  title: string
  linkKind: ResourceLinkKind
  linkLabel: string
  hasLink: boolean
  callCount: number
  lastCalledAt?: number
  folders: string[]
  folderIds: string[]
  taskRefs: number
  topicRefs: number
  curioRefs: number
  totalRefs: number
  zeroReference: boolean
  highValueCooling: boolean
  recentCalled: boolean
}

export interface ResourceAnalysisBlock {
  rows: ResourceAnalysisRow[]
  liveCount: number
  linkedCount: number
  noLinkCount: number
  taskReferencedCount: number
  zeroReferenceCount: number
  recentCalledCount: number
  highValueCoolingCount: number
  neverCalledCount: number
  linkDistribution: AnalysisBar[]
  folderDistribution: AnalysisBar[]
  highFrequency: ResourceAnalysisRow[]
  coolingRows: ResourceAnalysisRow[]
  monthAdded: number
}

export interface CuriosityAnalysisRow {
  id: ID
  card: CuriosityCard
  question: string
  status: CuriosityCard['status']
  statusLabel: string
  hasSource: boolean
  assetCount: number
  supportCount: number
  planned: boolean
  converted: boolean
  stale: boolean
  lastActivityAt: number
}

export interface CuriosityAnalysisBlock {
  rows: CuriosityAnalysisRow[]
  liveCount: number
  statusCounts: Record<CuriosityCard['status'], number>
  todoCount: number
  doingCount: number
  doneCount: number
  shelfCount: number
  plannedCount: number
  sourcedCount: number
  assetCount: number
  supportedCount: number
  convertedCount: number
  staleCount: number
  statusDistribution: AnalysisBar[]
  evidenceDistribution: AnalysisBar[]
}

export interface TopicAnalysisRow {
  id: ID
  card: TopicCard
  title: string
  statusId: ID
  statusName: string
  terminal: boolean
  projectId?: ID
  projectName: string
  metricId?: ID
  metricTitle: string
  attached: boolean
  scheduled: boolean
  dueDate: string
  focusCount: number
  supportCount: number
  hasOutcome: boolean
  createdAt: number
  monthAdded: boolean
  recent30Added: boolean
  lastActivityAt: number
}

export interface TopicAnalysisBlock {
  rows: TopicAnalysisRow[]
  liveCount: number
  completedCount: number
  plannedCount: number
  focusEnteredCount: number
  focusNeverCount: number
  focusAverageEntered: number
  focusAverageAll: number
  focusMax: number
  focusDistribution: AnalysisBar[]
  attachedCount: number
  supportedCount: number
  monthAddedCount: number
  recent30AddedCount: number
  outcomeCount: number
  statusDistribution: AnalysisBar[]
  projectDistribution: AnalysisBar[]
  metricDistribution: AnalysisBar[]
  coverageDistribution: AnalysisBar[]
}

export interface CardAnalysisModel {
  inventory: CardInventoryIndex
  ownership: TaskOwnershipIndex
  evidence: TaskEvidenceIndex
  focus: FocusUsageIndex
  focusShare: number
  kindCounts: Record<CardAnalysisKind, number>
  task: TaskAnalysisBlock
  resource: ResourceAnalysisBlock
  curiosity: CuriosityAnalysisBlock
  topic: TopicAnalysisBlock
}

interface FlatProject {
  id: ID
  name: string
  directionName: string
}

function pctOf(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0
}

function bar(
  key: string,
  label: string,
  count: number,
  total: number,
  tone: AnalysisBar['tone'] = 'accent',
  note?: string,
): AnalysisBar {
  return { key, label, count, pct: pctOf(count, total), tone, note }
}

function focusBars(summary: FocusCardSummary): AnalysisBar[] {
  return summary.distribution.map((row, index) => ({
    key: row.key,
    label: row.label,
    count: row.count,
    pct: pctOf(row.count, Math.max(summary.entered + summary.never, 1)),
    tone: index === 0 ? 'muted' : index === summary.distribution.length - 1 ? 'accent' : 'info',
  }))
}

function taskConflictLabel(taskId: ID, ownership: TaskOwnershipIndex): string {
  const reasons = ownership.byTask.get(taskId)?.conflictReasons || []
  if (!reasons.length) return ''
  const labels: Record<string, string> = {
    'multiple-metric-matches': '多个指标同时命中',
    'project-metric-mismatch': '项目与指标不一致',
    'orphan-project': '项目引用悬空',
    'orphan-metric': '指标引用悬空',
  }
  return reasons.map(reason => labels[reason] || reason).join(' · ')
}

function resourceLinkLabel(kind: ResourceLinkKind): string {
  if (kind === 'file') return '本地文件'
  if (kind === 'obsidian') return 'Obsidian'
  if (kind === 'none') return '无链接'
  return '网页 URL'
}

function lastActivityOf(card: {
  createdAt?: number
  updatedAt?: number
  lastCalledAt?: number
  completedAt?: number
}): number {
  return Math.max(
    Number(card.lastCalledAt) || 0,
    Number(card.completedAt) || 0,
    Number(card.updatedAt) || 0,
    Number(card.createdAt) || 0,
  )
}

/** 一次建好状态 id / 语义桶的查找表，避免四卡列表逐行 find + 重排。 */
function buildTaskStatusLookup(data: AppData): (
  task: Pick<TaskCard, 'statusId'> & Partial<Pick<TaskCard, 'status'>>,
) => TaskStatusDef | undefined {
  const statuses = sortedTaskStatuses(data)
  const byId = new Map(statuses.map(status => [status.id, status] as const))
  const defaultIds: Record<TaskStatusBucket, ID> = {
    todo: 'task-todo',
    doing: 'task-doing',
    done: 'task-done',
  }
  const fallbackByBucket = new Map<TaskStatusBucket, TaskStatusDef>()
  for (const bucket of ['todo', 'doing', 'done'] as const) {
    const fallback = byId.get(defaultIds[bucket])
      || statuses.find(status => status.bucket === bucket)
      || statuses.find(status => !status.terminal)
      || statuses[0]
    if (fallback) fallbackByBucket.set(bucket, fallback)
  }
  return task => byId.get(task.statusId || '') || fallbackByBucket.get(task.status || 'todo')
}

function buildTopicStatusLookup(data: AppData): (statusId?: ID) => TopicStatusDef | undefined {
  const statuses = sortedTopicStatuses(data)
  const byId = new Map(statuses.map(status => [status.id, status] as const))
  return statusId => (statusId ? byId.get(statusId) : undefined) || statuses[0]
}

/**
 * 画像卡片分析唯一聚合入口。
 *
 * 组件只消费这里返回的索引与行模型：状态、归属、证据、三件事、标签与分布
 * 都在一次 computed 里建 Map，避免在模板或行渲染中重复 find/filter。
 */
export function useCardAnalysis(
  data: ComputedRef<AppData>,
  events: ComputedRef<CardEvent[]>,
) {
  const inventory = computed(() => buildCardInventory(data.value, Date.now()))
  const ownership = computed(() => buildTaskOwnership(data.value))
  const evidence = computed(() => buildTaskEvidence(data.value))
  const focus = computed(() => buildFocusUsage(data.value))
  const focusShare = computed(() => {
    const now = Date.now()
    const from = now - 30 * DAY_MS
    const focusedProjectIds = new Set<ID>()
    for (const direction of data.value.compass?.directions || []) {
      for (const project of direction.projects || []) {
        if (project.isFocused && project.status !== 'archived') focusedProjectIds.add(project.id)
      }
    }
    const liveCardKeys = new Set<string>([
      ...inventory.value.live.resources.map(card => `resource:${card.id}`),
      ...inventory.value.live.tasks.map(card => `task:${card.id}`),
      ...inventory.value.live.curiosities.map(card => `curiosity:${card.id}`),
      ...inventory.value.live.topics.map(card => `topic:${card.id}`),
    ])
    let total = 0
    let hit = 0
    for (const event of events.value) {
      if (!event || event.kind === 'system' || event.ts < from || event.ts > now) continue
      if (event.action !== 'create' && event.action !== 'call' && event.action !== 'status') continue
      if (!liveCardKeys.has(`${event.kind}:${event.cardId}`)) continue
      total += 1
      if (event.kind !== 'task') continue
      const projectId = ownership.value.byTask.get(event.cardId)?.projectId
      if (projectId && focusedProjectIds.has(projectId)) hit += 1
    }
    return total ? Math.round((hit / total) * 100) : 0
  })

  const task = computed<TaskAnalysisBlock>(() => {
    const d = data.value
    const inv = inventory.value
    const own = ownership.value
    const ev = evidence.value
    const fc = focus.value
    const monthStart = monthStartAt()
    const statuses = sortedTaskStatuses(d)
    const statusFor = buildTaskStatusLookup(d)
    const projectNameById = new Map(own.projectBuckets.map(bucket => [bucket.id, bucket.name] as const))
    const metricTitleById = new Map(own.metricBuckets.map(bucket => [bucket.id, bucket.title] as const))
    const planEventCount = new Map<ID, number>()
    for (const event of d.planScheduleEvents || []) {
      if (!event || event.removedAt || event.cardKind !== 'task') continue
      planEventCount.set(event.cardId, (planEventCount.get(event.cardId) || 0) + 1)
    }
    const focusSummary = focusCardSummary(fc, 'task', inv.live.tasks.length)
    const rows: TaskAnalysisRow[] = inv.live.tasks.map(card => {
      const owner = own.byTask.get(card.id)
      const status = statusFor(card)
      const bucket = status?.bucket || card.status || 'todo'
      const supportCount = ev.taskResourceIds.get(card.id)?.size || 0
      return {
        id: card.id,
        card,
        title: card.title || '（无标题任务）',
        statusId: status?.id || card.statusId,
        statusName: status?.name || '未命名状态',
        statusBucket: bucket,
        done: bucket === 'done',
        projectId: owner?.projectId,
        projectName: owner?.projectName || '未归属项目',
        metricId: owner?.metricId,
        metricTitle: owner?.metricTitle || '未挂指标',
        attached: !!owner?.projectId || !!owner?.metricId,
        scheduled: !!card.dueDate,
        dueDate: card.dueDate || '',
        focusCount: focusUsageOfCard(fc, 'task', card.id).count,
        supportCount,
        conflict: own.conflictIds.has(card.id),
        conflictLabel: taskConflictLabel(card.id, own),
        planChanges: planEventCount.get(card.id) || 0,
        lastActivityAt: lastActivityOf(card),
      }
    })
    const liveCount = rows.length
    const doneCount = rows.filter(row => row.done).length
    const scheduledCount = rows.filter(row => row.scheduled).length
    const noSupportCount = rows.filter(row => row.supportCount === 0).length
    const statusCount = new Map<ID, number>()
    for (const row of rows) statusCount.set(row.statusId || '', (statusCount.get(row.statusId || '') || 0) + 1)
    const projectCount = new Map<string, number>()
    for (const row of rows) {
      const key = row.projectId || '__unassigned'
      projectCount.set(key, (projectCount.get(key) || 0) + 1)
    }
    const metricCount = new Map<string, number>()
    for (const row of rows) {
      const key = row.metricId || '__unassigned'
      metricCount.set(key, (metricCount.get(key) || 0) + 1)
    }
    const projectDistribution = [...projectCount.entries()]
      .map(([id, count]) => bar(
        id,
        id === '__unassigned' ? '未归属' : (projectNameById.get(id) || '未知项目'),
        count,
        liveCount,
        id === '__unassigned' ? 'warn' : 'accent',
      ))
      .sort((a, b) => (a.key === '__unassigned' ? 1 : b.key === '__unassigned' ? -1 : b.count - a.count))
    const metricDistribution = [...metricCount.entries()]
      .map(([id, count]) => bar(
        id,
        id === '__unassigned' ? '未挂指标' : (metricTitleById.get(id) || '未知指标'),
        count,
        liveCount,
        id === '__unassigned' ? 'warn' : 'info',
      ))
      .filter(row => row.key !== '__unassigned' || row.count > 0)
      .sort((a, b) => (a.key === '__unassigned' ? 1 : b.key === '__unassigned' ? -1 : b.count - a.count))
      .slice(0, 8)
    const statusDistribution = statuses.map(status =>
      bar(
        status.id,
        status.name,
        statusCount.get(status.id) || 0,
        liveCount,
        status.bucket === 'done' ? 'success' : status.bucket === 'doing' ? 'info' : 'muted',
      ),
    )
    const supportBuckets = [
      { key: 'zero', label: '0 张', test: (row: TaskAnalysisRow) => row.supportCount === 0 },
      { key: 'one', label: '1 张', test: (row: TaskAnalysisRow) => row.supportCount === 1 },
      { key: 'two-three', label: '2–3 张', test: (row: TaskAnalysisRow) => row.supportCount >= 2 && row.supportCount <= 3 },
      { key: 'four-plus', label: '4 张以上', test: (row: TaskAnalysisRow) => row.supportCount >= 4 },
    ]
    const supportDistribution = supportBuckets.map((bucket, index) => {
      const count = rows.filter(bucket.test).length
      return bar(bucket.key, bucket.label, count, liveCount, index === 0 ? 'warn' : index === 3 ? 'success' : 'info')
    })
    return {
      rows,
      liveCount,
      doneCount,
      doneRate: pctOf(doneCount, liveCount),
      projectAttachedCount: own.projectAttachedCount,
      metricAttachedCount: own.metricAttachedCount,
      attachedCount: rows.filter(row => row.attached).length,
      scheduledCount,
      unscheduledCount: Math.max(0, liveCount - scheduledCount),
      focusEnteredCount: focusSummary.entered,
      focusNeverCount: focusSummary.never,
      focusAverageEntered: focusSummary.averageEntered,
      focusAverageAll: focusSummary.averageAll,
      focusMax: focusSummary.maxCount,
      focusDistribution: focusBars(focusSummary),
      noSupportCount,
      conflictCount: own.conflictIds.size,
      ambiguousCount: own.ambiguousIds.size,
      projectDistribution,
      metricDistribution,
      statusDistribution,
      planCoverage: [
        bar('scheduled', '已落计划', scheduledCount, liveCount, 'success'),
        bar('unscheduled', '未落计划', Math.max(0, liveCount - scheduledCount), liveCount, 'warn'),
      ],
      supportDistribution,
      monthAdded: rows.filter(row => (row.card.createdAt || 0) >= monthStart).length,
    }
  })

  const resource = computed<ResourceAnalysisBlock>(() => {
    const d = data.value
    const inv = inventory.value
    const ev = evidence.value
    const now = Date.now()
    const recentFrom = now - 30 * DAY_MS
    const monthStart = monthStartAt(now)
    const liveResourceIds = new Set(inv.live.resources.map(card => card.id))
    const liveFolderIds = new Set((d.resourceFolders || []).map(folder => folder.id))
    const folderNameById = new Map((d.resourceFolders || []).map(folder => [folder.id, folder.name] as const))
    const foldersByResource = new Map<ID, string[]>()
    const folderIdsByResource = new Map<ID, string[]>()
    const folderResourceCount = new Map<ID, Set<ID>>()
    for (const mirror of d.resourceFolderMirrors || []) {
      if (!mirror || !liveResourceIds.has(mirror.resourceId) || !liveFolderIds.has(mirror.folderId)) continue
      const names = foldersByResource.get(mirror.resourceId)
      const idsForResource = folderIdsByResource.get(mirror.resourceId)
      const name = folderNameById.get(mirror.folderId) || '未知常用夹'
      if (names) {
        if (!names.includes(name)) names.push(name)
      } else {
        foldersByResource.set(mirror.resourceId, [name])
      }
      if (idsForResource) {
        if (!idsForResource.includes(mirror.folderId)) idsForResource.push(mirror.folderId)
      } else {
        folderIdsByResource.set(mirror.resourceId, [mirror.folderId])
      }
      const ids = folderResourceCount.get(mirror.folderId)
      if (ids) ids.add(mirror.resourceId)
      else folderResourceCount.set(mirror.folderId, new Set([mirror.resourceId]))
    }
    const recentCallIds = new Set<string>()
    for (const event of events.value) {
      if (!event || event.action !== 'call' || event.ts < recentFrom) continue
      if (event.kind === 'resource' && liveResourceIds.has(event.cardId)) recentCallIds.add(event.cardId)
    }
    const rows: ResourceAnalysisRow[] = inv.live.resources.map(card => {
      const refs = ev.resourceRefs.get(card.id)
      const linkKind = inv.linkKindById.get(card.id) || resourceLinkKindOf(card)
      return {
        id: card.id,
        card,
        title: card.title || '（无标题资源）',
        linkKind,
        linkLabel: resourceLinkLabel(linkKind),
        hasLink: hasUsableResourceLink(card),
        callCount: card.callCount || 0,
        lastCalledAt: card.lastCalledAt,
        folders: foldersByResource.get(card.id) || [],
        folderIds: folderIdsByResource.get(card.id) || [],
        taskRefs: refs?.taskIds.size || 0,
        topicRefs: refs?.topicIds.size || 0,
        curioRefs: refs?.curioIds.size || 0,
        totalRefs: refs?.totalRefs || 0,
        zeroReference: !refs || refs.totalRefs === 0,
        highValueCooling: (card.callCount || 0) >= 3 && lifecycleState(card, now) === 'cooling',
        recentCalled: recentCallIds.has(card.id),
      }
    })
    const linkKinds: ResourceLinkKind[] = ['url', 'file', 'obsidian', 'none']
    const linkCount = new Map<ResourceLinkKind, number>()
    for (const row of rows) linkCount.set(row.linkKind, (linkCount.get(row.linkKind) || 0) + 1)
    const filedIds = new Set(rows.filter(row => row.folders.length).map(row => row.id))
    const folderDistribution = [...folderResourceCount.entries()]
      .map(([id, ids]) => bar(id, folderNameById.get(id) || '未知常用夹', ids.size, rows.length, 'info'))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
    if (rows.length > filedIds.size) {
      folderDistribution.push(bar('__unfiled', '未入常用夹', rows.length - filedIds.size, rows.length, 'muted'))
    }
    const highFrequency = rows
      .filter(row => row.totalRefs > 0)
      .sort((a, b) => b.totalRefs - a.totalRefs || b.callCount - a.callCount)
      .slice(0, 6)
    return {
      rows,
      liveCount: rows.length,
      linkedCount: rows.filter(row => row.hasLink).length,
      noLinkCount: rows.filter(row => !row.hasLink).length,
      taskReferencedCount: rows.filter(row => row.taskRefs > 0).length,
      zeroReferenceCount: rows.filter(row => row.zeroReference).length,
      recentCalledCount: rows.filter(row => row.recentCalled).length,
      highValueCoolingCount: rows.filter(row => row.highValueCooling).length,
      neverCalledCount: rows.filter(row => row.callCount === 0).length,
      linkDistribution: linkKinds.map((kind, index) =>
        bar(kind, resourceLinkLabel(kind), linkCount.get(kind) || 0, rows.length,
          kind === 'none' ? 'warn' : index === 0 ? 'accent' : index === 1 ? 'info' : 'success'),
      ),
      folderDistribution,
      highFrequency,
      coolingRows: rows.filter(row => row.highValueCooling),
      monthAdded: rows.filter(row => (row.card.createdAt || 0) >= monthStart).length,
    }
  })

  const curiosity = computed<CuriosityAnalysisBlock>(() => {
    const inv = inventory.value
    const ev = evidence.value
    const now = Date.now()
    const statusLabels: Record<CuriosityCard['status'], string> = {
      todo: '待探索',
      doing: '探索中',
      done: '已求证',
      shelf: '已搁置',
    }
    const statusOrder: CuriosityCard['status'][] = ['todo', 'doing', 'done', 'shelf']
    const statusCounts: Record<CuriosityCard['status'], number> = { todo: 0, doing: 0, done: 0, shelf: 0 }
    const rows: CuriosityAnalysisRow[] = inv.live.curiosities.map(card => {
      const status = statusOrder.includes(card.status) ? card.status : 'todo'
      statusCounts[status] += 1
      const lastAt = lastActivityOf(card)
      return {
        id: card.id,
        card,
        question: card.question || '（无标题好奇心）',
        status,
        statusLabel: statusLabels[status],
        hasSource: !!String(card.sourceUrl || '').trim(),
        assetCount: card.assets?.length || 0,
        supportCount: ev.curioResourceIds.get(card.id)?.size || 0,
        planned: !!card.dueDate,
        converted: !!card.convertedAt,
        stale: !!lastAt && now - lastAt >= 30 * 86_400_000,
        lastActivityAt: lastAt,
      }
    })
    const liveCount = rows.length
    const supportedCount = rows.filter(row => row.supportCount > 0).length
    return {
      rows,
      liveCount,
      statusCounts,
      todoCount: statusCounts.todo,
      doingCount: statusCounts.doing,
      doneCount: statusCounts.done,
      shelfCount: statusCounts.shelf,
      plannedCount: rows.filter(row => row.planned).length,
      sourcedCount: rows.filter(row => row.hasSource).length,
      assetCount: rows.filter(row => row.assetCount > 0).length,
      supportedCount,
      convertedCount: rows.filter(row => row.converted).length,
      staleCount: rows.filter(row => row.stale).length,
      statusDistribution: statusOrder.map((status, index) =>
        bar(status, statusLabels[status], statusCounts[status], liveCount,
          status === 'doing' ? 'info' : status === 'done' ? 'success' : status === 'shelf' ? 'muted' : 'accent'),
      ),
      evidenceDistribution: [
        bar('source', '有来源链接', rows.filter(row => row.hasSource).length, liveCount, 'info'),
        bar('support', '有资源支撑', supportedCount, liveCount, 'success'),
        bar('assets', '有附件', rows.filter(row => row.assetCount > 0).length, liveCount, 'accent'),
        bar('stale', '超过 30 天未动', rows.filter(row => row.stale).length, liveCount, 'warn'),
      ],
    }
  })

  const topic = computed<TopicAnalysisBlock>(() => {
    const d = data.value
    const inv = inventory.value
    const ev = evidence.value
    const fc = focus.value
    const now = Date.now()
    const recentFrom = now - 30 * DAY_MS
    const monthStart = monthStartAt(now)
    const statuses = sortedTopicStatuses(d)
    const statusFor = buildTopicStatusLookup(d)
    const projectById = new Map<ID, FlatProject>()
    const metricById = new Map<ID, { id: ID; title: string; project: FlatProject }>()
    const topicIdsByMetric = new Map<ID, ID[]>()
    for (const direction of d.compass?.directions || []) {
      for (const project of direction.projects || []) {
        const flat: FlatProject = { id: project.id, name: project.name, directionName: direction.name }
        projectById.set(project.id, flat)
        for (const metric of project.metrics || []) {
          metricById.set(metric.id, { id: metric.id, title: metric.title, project: flat })
          for (const topicId of metric.topicIds || []) {
            const ids = topicIdsByMetric.get(topicId)
            if (ids) ids.push(metric.id)
            else topicIdsByMetric.set(topicId, [metric.id])
          }
        }
      }
    }
    for (const [topicId, ids] of topicIdsByMetric) {
      topicIdsByMetric.set(topicId, [...new Set(ids)])
    }
    const liveTopicIds = new Set(inv.live.topics.map(topic => topic.id))
    for (const [topicId, ids] of topicIdsByMetric) {
      if (!liveTopicIds.has(topicId)) topicIdsByMetric.delete(topicId)
    }
    const focusSummary = focusCardSummary(fc, 'topic', inv.live.topics.length)
    const statusCount = new Map<ID, number>()
    const projectCount = new Map<string, number>()
    const metricCount = new Map<string, number>()
    const rows: TopicAnalysisRow[] = inv.live.topics.map(card => {
      const status = statusFor(card.statusId)
      const statusId = status?.id || card.statusId
      statusCount.set(statusId, (statusCount.get(statusId) || 0) + 1)
      const topicIds = topicIdsByMetric.get(card.id) || []
      const metric = (card.metricId ? metricById.get(card.metricId) : undefined)
        || (topicIds.length === 1 ? metricById.get(topicIds[0]) : undefined)
      const project = metric?.project || (card.projectId ? projectById.get(card.projectId) : undefined)
      const projectKey = project?.id || '__unassigned'
      const metricKey = metric?.id || '__unassigned'
      projectCount.set(projectKey, (projectCount.get(projectKey) || 0) + 1)
      metricCount.set(metricKey, (metricCount.get(metricKey) || 0) + 1)
      return {
        id: card.id,
        card,
        title: card.title || '（无标题选题）',
        statusId,
        statusName: status?.name || '未命名状态',
        terminal: !!status?.terminal,
        projectId: project?.id,
        projectName: project?.name || '未挂项目',
        metricId: metric?.id,
        metricTitle: metric?.title || '未挂指标',
        attached: !!project || !!metric,
        scheduled: !!card.dueDate,
        dueDate: card.dueDate || '',
        focusCount: focusUsageOfCard(fc, 'topic', card.id).count,
        supportCount: ev.topicResourceIds.get(card.id)?.size || 0,
        // 成果口径只认可打开的网页 / Obsidian 地址；普通本地文件不算“已发布”。
        hasOutcome: !!topicOutcomeLink(card),
        createdAt: card.createdAt || 0,
        monthAdded: (card.createdAt || 0) >= monthStart,
        recent30Added: (card.createdAt || 0) >= recentFrom,
        lastActivityAt: lastActivityOf(card),
      }
    })
    const liveCount = rows.length
    const completedCount = rows.filter(row => row.terminal).length
    const plannedCount = rows.filter(row => row.scheduled).length
    const supportedCount = rows.filter(row => row.supportCount > 0).length
    const attachedCount = rows.filter(row => row.attached).length
    const monthAddedCount = rows.filter(row => row.monthAdded).length
    const recent30AddedCount = rows.filter(row => row.recent30Added).length
    const statusDistribution = statuses.map(status => {
      const count = statusCount.get(status.id) || 0
      return bar(status.id, status.name, count, liveCount, status.terminal ? 'success' : 'accent')
    })
    const projectDistribution = [...projectCount.entries()]
      .map(([id, count]) => bar(
        id,
        id === '__unassigned' ? '未挂项目' : (projectById.get(id)?.name || '未知项目'),
        count,
        liveCount,
        id === '__unassigned' ? 'warn' : 'info',
      ))
      .sort((a, b) => (a.key === '__unassigned' ? 1 : b.key === '__unassigned' ? -1 : b.count - a.count))
    const metricDistribution = [...metricCount.entries()]
      .map(([id, count]) => bar(
        id,
        id === '__unassigned' ? '未挂指标' : (metricById.get(id)?.title || '未知指标'),
        count,
        liveCount,
        id === '__unassigned' ? 'warn' : 'info',
      ))
      .sort((a, b) => (a.key === '__unassigned' ? 1 : b.key === '__unassigned' ? -1 : b.count - a.count))
      .slice(0, 8)
    return {
      rows,
      liveCount,
      completedCount,
      plannedCount,
      focusEnteredCount: focusSummary.entered,
      focusNeverCount: focusSummary.never,
      focusAverageEntered: focusSummary.averageEntered,
      focusAverageAll: focusSummary.averageAll,
      focusMax: focusSummary.maxCount,
      focusDistribution: focusBars(focusSummary),
      attachedCount,
      supportedCount,
      monthAddedCount,
      recent30AddedCount,
      outcomeCount: rows.filter(row => row.hasOutcome).length,
      statusDistribution,
      projectDistribution,
      metricDistribution,
      coverageDistribution: [
        bar('planned', '已落计划', plannedCount, liveCount, 'info'),
        bar('focused', '进入过三件事', focusSummary.entered, liveCount, 'accent'),
        bar('supported', '有资源支撑', supportedCount, liveCount, 'success'),
        bar('outcome', '有成果链接', rows.filter(row => row.hasOutcome).length, liveCount, 'accent'),
      ],
    }
  })

  const model = computed<CardAnalysisModel>(() => ({
    inventory: inventory.value,
    ownership: ownership.value,
    evidence: evidence.value,
    focus: focus.value,
    focusShare: focusShare.value,
    kindCounts: {
      task: inventory.value.counts.task,
      resource: inventory.value.counts.resource,
      curiosity: inventory.value.counts.curiosity,
      topic: inventory.value.counts.topic,
    },
    task: task.value,
    resource: resource.value,
    curiosity: curiosity.value,
    topic: topic.value,
  }))

  return { model, inventory, ownership, evidence, focus, focusShare }
}
