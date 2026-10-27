import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount, onDeactivated, nextTick, shallowRef } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { TaskCard, Project, FocusSlot, CuriosityCard, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import CompassStatusModal, { type StatusDetailKey, type StatusDetailItem } from '../components/compass/CompassStatusModal.vue'
import type { useCompassHome } from './useCompassHome'

export function useCompassHomeDetail(deps: Pick<ReturnType<typeof useCompassHome>, 'todayStart' | 'd' | 'fmtRecentTime' | 'projectName' | 'focusedProjects' | 'focusMeta' | 'taskArchiveIssue' | 'readonlyProjectId' | 'readonlyProjectOpen' | 'openTaskPreview' | 'openResourcePreview'>): {
  statusDetail: Ref<StatusDetailKey | ''>
  closeStatusDetail: () => void
  statusDetailTitle: ComputedRef<string>
  statusDetailItems: ComputedRef<StatusDetailItem[]>
  statusDetailNote: ComputedRef<string>
  statusDetailEmpty: ComputedRef<string>
  weekStartKeyOf: (ts: number) => string
  openStatusDetail: (k: StatusDetailKey) => void
  onStatusItemAction: (item: StatusDetailItem) => void
  curioStatusLabel: (c: CuriosityCard) => string
  resourceKindLabel: (r: ResourceCard) => string
  taskDueLabel: (t: TaskCard) => string
  focusSlotSourceLabel: (slot: FocusSlot) => string
} {
  const { todayStart, d, fmtRecentTime, projectName, focusedProjects, focusMeta, taskArchiveIssue, readonlyProjectId, readonlyProjectOpen, openTaskPreview, openResourcePreview } = deps
const statusDetail = ref<StatusDetailKey | ''>('')
/** V3.9.14：明细行可在中央弹窗 / 右侧任务或资源详情之间切换；
 *  先关明细再开详情，避免两层遮罩叠在一起、Esc 只关到上层。 */
function closeStatusDetail(): void { statusDetail.value = '' }
const statusDetailTitle = computed(() => ({
  focus: '主攻项目明细', unarchived: '未归档任务明细', reuse: '本周复用明细',
  in: '今日入台明细', out: '今日调出明细', '': ''
}[statusDetail.value]))
const statusDetailItems = computed<StatusDetailItem[]>(() => {
  const k = statusDetail.value
  /* V3.9.18：今日入台 = 三类卡 createdAt ≥ 今日 0 点（按创建时间派生；导入/恢复的旧卡不计入） */
  if (k === 'in') {
    const t0 = todayStart.value
    const rows: { ts: number; item: StatusDetailItem }[] = []
    for (const r of d.value.resources) {
      if (!r.deletedAt && (r.createdAt || 0) >= t0) rows.push({ ts: r.createdAt || 0, item: { title: r.title || '（无标题）', meta: `资源卡 · ${fmtRecentTime(r.createdAt)}`, extra: resourceKindLabel(r), action: '打开资源', actionKind: 'resource', actionId: r.id } })
    }
    for (const t of d.value.tasks) {
      if (!t.deletedAt && (t.createdAt || 0) >= t0) rows.push({ ts: t.createdAt || 0, item: { title: t.title || '（无标题）', meta: `任务卡 · ${fmtRecentTime(t.createdAt)}`, extra: projectName(t.projectId) || '未挂项目', action: '打开任务', actionKind: 'task', actionId: t.id } })
    }
    for (const c of d.value.curiosities) {
      if (!c.deletedAt && (c.createdAt || 0) >= t0) rows.push({ ts: c.createdAt || 0, item: { title: c.question || '（无标题）', meta: `好奇心卡 · ${fmtRecentTime(c.createdAt)}`, extra: curioStatusLabel(c) } })
    }
    return rows.sort((a, b) => b.ts - a.ts).map(x => x.item)
  }
  /* V3.9.18：今日调出 = lastCalledAt 落在今日的资源卡（按「张」计；与战报事件计次口径不同，见 note） */
  if (k === 'out') {
    const t0 = todayStart.value
    return (d.value.resources || [])
      .filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= t0)
      .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
      .map(r => ({
        title: r.title || '（无标题）',
        meta: `最近 ${fmtRecentTime(r.lastCalledAt)}`,
        extra: `累计 ${r.callCount || 0} 次`,
        action: '打开资源',
        actionKind: 'resource',
        actionId: r.id
      }))
  }
  if (k === 'focus') {
    return focusedProjects.value.map(p => {
      const m = focusMeta.value.get(p.id)
      return {
        title: p.name,
        meta: m ? `${m.finished ? '已完成' : m.stall ? '停滞' : '推进中'} · 未完成任务 ${m.open} 项` : '推进中',
        extra: `${m?.pct ?? 0}%`,
        action: '查看项目',
        actionKind: 'project',
        actionId: p.id
      }
    })
  }
  if (k === 'unarchived') {
    return (d.value.tasks || [])
      .filter(x => !x.deletedAt && taskArchiveIssue(x) !== '')
      .map(x => ({
        title: x.title || '（无标题）',
        meta: taskArchiveIssue(x),
        extra: projectName(x.projectId) || '未挂项目',
        action: '打开任务',
        actionKind: 'task',
        actionId: x.id
      }))
  }
  if (k === 'reuse') {
    /* ★C01.3 陷阱：跨周后 stats.lastVisits 不会自动清空，只有 thisWeekStart 才是本周戳时数字才不为 0；
       清单必须按同一周戳过滤，否则会把上周的调用当本周列出来，而顶部数字是 0。 */
    const wrr = d.value.stats?.wrr
    const thisWeek = weekStartKeyOf(Date.now())
    const start = wrr?.thisWeekStart === thisWeek ? wrr.thisWeekStart : ''
    const list = (d.value.resources || [])
      .filter(r => !r.deletedAt && r.lastCalledAt)
      .filter(r => !!start && weekStartKeyOf(r.lastCalledAt || 0) === start)
      .sort((a, b) => (b.lastCalledAt || 0) - (a.lastCalledAt || 0))
    const visits = d.value.stats?.lastVisits || {}
    return start ? list.map(r => ({
      title: r.title || '（无标题）',
      meta: `本周调用 ${visits[r.id] || 0} 次`,
      extra: new Date(r.lastCalledAt || 0).toLocaleDateString('zh-CN'),
      action: '打开资源',
      actionKind: 'resource',
      actionId: r.id
    })) : []
  }
  return []
})
const statusDetailNote = computed(() => ({
  focus: '主攻项目 = 方向台上标记为主攻且未归档的项目；进度与停滞判定与方向台同一口径。',
  unarchived: '未归档 = 未删除、但缺项目归属或已完成未归档的任务；与行内数字同源。',
  reuse: '本周复用 = 本周内被打开过的资源卡（按最近调出倒序）；跨周后清单为空，与行内 0 一致。',
  in: '今日入台 = 今日 0 点起新建的三类卡（按创建时间派生；导入与恢复的旧卡不计入）。与「今日战报」的新增计次口径不同（战报按事件日志），两者不冒充同源。',
  out: '今日调出 = 今日 0 点起 lastCalledAt 落在今日的资源卡张数。与「今日战报」的调出计次口径不同（战报按事件日志逐次累计），两者不冒充同源。',
  '': ''
}[statusDetail.value]))
const statusDetailEmpty = computed(() => ({
  focus: '还没有设定主攻项目。去方向台把最重要的 1-2 个项目标为主攻。',
  unarchived: '没有待归档的任务——当前任务都有项目归属。',
  reuse: '本周还没有调出记录。打开一张资源卡后，会出现在这里。',
  in: '今天还没有新卡入台。用扩展快捷键采集一张，回执会告诉你它去了哪。',
  out: '今天还没有调出过资源卡。⌘K 或卡池里打开一张后，会出现在这里。',
  '': ''
}[statusDetail.value]))
/** 周戳工具：与 stats.weekStartKey 同口径（本地周一为一周起点） */
function weekStartKeyOf(ts: number): string {
  const dt = new Date(ts)
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function openStatusDetail(k: StatusDetailKey): void { statusDetail.value = k }
/** V3.9.14：状态明细不再止于“看一眼”。行内动作复用既有详情出口，
 *  不新增第二套编辑面：项目 → 只读项目详情；任务 → 任务抽屉；资源 → 资源详情。 */
function onStatusItemAction(item: StatusDetailItem): void {
  closeStatusDetail()
  if (!item.actionId) return
  if (item.actionKind === 'project') {
    readonlyProjectId.value = item.actionId
    readonlyProjectOpen.value = true
    return
  }
  if (item.actionKind === 'task') {
    const task = (d.value.tasks || []).find(t => t.id === item.actionId && !t.deletedAt)
    if (task) openTaskPreview(task)
    else showToast('这张任务已不在任务池中')
    return
  }
  if (item.actionKind === 'resource') {
    const resource = (d.value.resources || []).find(r => r.id === item.actionId && !r.deletedAt)
    if (resource) openResourcePreview(resource)
    else showToast('这张资源卡已不在资源池中')
  }
}
function curioStatusLabel(c: CuriosityCard): string {
  return c.status === 'done' ? '已求证' : c.status === 'doing' ? '探索中' : c.status === 'shelf' ? '已搁置' : '待探索'
}
function resourceKindLabel(r: ResourceCard): string {
  return r.linkType === 'file' ? '本地文件' : r.linkType === 'obsidian' ? 'Obsidian' : r.link ? '网页链接' : '文字卡'
}
function taskDueLabel(t: TaskCard): string {
  if (!t.dueDate) return projectName(t.projectId)
  return `${t.dueDate} · ${projectName(t.projectId)}`
}
function focusSlotSourceLabel(slot: FocusSlot): string {
  if (slot.sourceType === 'text') return '自由文本'
  if (slot.sourceType === 'resource') return '资源卡'
  if (slot.sourceType === 'curiosity') return '好奇心卡'
  return '卡片'
}



  return {
    statusDetail, closeStatusDetail, statusDetailTitle, statusDetailItems, statusDetailNote, statusDetailEmpty, weekStartKeyOf, openStatusDetail, onStatusItemAction, curioStatusLabel, resourceKindLabel, taskDueLabel, focusSlotSourceLabel,
  }
}
