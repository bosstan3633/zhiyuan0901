import { computed } from 'vue'
import { useAppStore } from './app'
import type { Direction, Project } from '@/shared/models'

// B40：recordResourceOpen 已下沉至 shared/storage/stats（应用端与网页端共用同一实现）
export { recordResourceOpen } from '@/shared/storage/stats'

/**
 * 知源引擎数据管理
 * 六层链：Vision → Mission → Direction(战略目标) → Project(攻坚项目) → Metric(成功指标) → Task
 */
export function useCompass() {
  const store = useAppStore()
  const d = computed(() => store.data!)

  // ---- 愿景 / 使命 ----
  const visionText = computed({
    get: () => d.value.compass.vision.content,
    set: (v: string) => {
      d.value.compass.vision.content = v
      d.value.compass.vision.updatedAt = Date.now()
      store.persist()
    }
  })
  const missionText = computed({
    get: () => d.value.compass.mission.content,
    set: (v: string) => {
      d.value.compass.mission.content = v
      d.value.compass.mission.updatedAt = Date.now()
      store.persist()
    }
  })

  // ---- 方向 / 项目 / 指标 ----
  const directions = computed<Direction[]>(() => d.value.compass.directions)

  /** 所有项目（跨方向扁平） */
  function allProjects(): Project[] {
    return d.value.compass.directions.flatMap(dir => dir.projects)
  }

  function projectById(id: string): Project | undefined {
    return allProjects().find(p => p.id === id)
  }

  // ---- 灯塔投射：isFocused 项目 ----
  const focusedProjects = computed<Project[]>(() =>
    allProjects().filter(p => p.isFocused && p.status !== 'archived')
  )

  function toggleFocusProject(projectId: string) {
    const p = projectById(projectId)
    if (p) { p.isFocused = !p.isFocused; store.persist() }
  }

  // ---- 项目进度计算 ----
  function projectProgress(project: Project): { done: number; total: number; pct: number } {
    const metricIds = project.metrics.map(m => m.id)
    const tasks = d.value.tasks.filter(t =>
      !t.deletedAt && t.projectId === project.id
    )
    const done = tasks.filter(t => t.status === 'done').length
    const total = tasks.length
    const pct = total ? Math.round((done / total) * 100) : (project.progress || 0)
    return { done, total, pct }
  }

  // ---- 北极星指标 ----
  // R45-1（V2.20.0）：周期调整为「日/周/累计」三档（撤月档），上排 DHI/WCE/WRR 与下排新增/删除卡全档联动
  type Period = 'day' | 'week' | 'all'

  function isWithinDays(ts: number | undefined, days: number): boolean {
    if (!ts) return false
    return Date.now() - ts < days * 86400_000
  }

  function northStarMetrics(period: Period) {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 9999
    const pLabel = period === 'day' ? '今日' : period === 'week' ? '本周' : '累计'
    const dirs = d.value.compass.directions
    const projects = allProjects()

    // DHI 方向健康度（第卅二轮 REQ-001 口径调整：仅统计已投射至灯塔的项目）
    // 清晰=已投射项目 窗口内 全部有任务推进；关注=过半；模糊=不足半数；未投射=—
    // R43-3/R45-1 「在轨」活跃窗口随周期联动：日=今日有推进 / 周=近14天(沿用历史口径) / 累计=全部
    // 投射能力仅项目层支持（战略目标层级开关已移除，REQ-001）
    const pinnedProjects = projects.filter(p => p.pinnedToLighthouse)
    const dhiDays = period === 'day' ? 1 : period === 'week' ? 14 : 9999
    const activeProjects = pinnedProjects.filter(p => {
      return d.value.tasks.some(t =>
        !t.deletedAt && t.projectId === p.id &&
        (t.status === 'doing' || (t.completedAt && isWithinDays(t.completedAt, dhiDays)))
      )
    }).length
    const dhiLabel = pinnedProjects.length === 0 ? '—' :
      activeProjects === pinnedProjects.length ? '清晰' :
      activeProjects >= pinnedProjects.length / 2 ? '关注' : '模糊'

    // WCE 好奇探索：激活数=「探索中+已求证」的好奇心数；新增=周期内捕获数
    const curiosities = d.value.curiosities.filter(c => !c.deletedAt)
    const wceCount = curiosities.filter(c => c.status === 'doing' || c.status === 'done').length
    const newInPeriod = curiosities.filter(c => isWithinDays(c.createdAt, days)).length

    // WRR 有效复用：资源卡被打开的累计次数（工作台点击/双击打开/搜索打开均计数）
    // R45-1 副标随周期：日=今日打开卡数(lastCalledAt) / 周=本周次数(stats.wrr.thisWeekUsage) / 累计=累计口径
    const totalCalls = d.value.resources.filter(r => !r.deletedAt)
      .reduce((sum, r) => sum + (r.callCount || 0), 0)
    const thisWeekUsage = d.value.stats?.wrr?.thisWeekUsage ?? 0
    const totalCumUsage = d.value.stats?.wrr?.totalCumulativeUsage ?? totalCalls
    const sot = new Date(); sot.setHours(0, 0, 0, 0)
    const todayOpened = d.value.resources.filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= sot.getTime()).length

    // 模块分组数 = 所有工作台的文件夹（分组）总数
    const categoryCount = d.value.categories.length
    const resourceCount = d.value.resources.filter(r => !r.deletedAt).length
    const tasks = d.value.tasks.filter(t => !t.deletedAt)
    const doneTasks = tasks.filter(t => t.status === 'done').length
    const taskRate = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0

    return {
      dhi: { label: dhiLabel, sub: `${dirs.length}方向·${pinnedProjects.length}已投射·${activeProjects}在轨` },
      wce: { label: `${wceCount}项激活`, sub: `${pLabel}+${newInPeriod}` },
      wrr: { label: `${totalCalls}次打开`, sub: period === 'day' ? `今日${todayOpened}卡打开` : period === 'week' ? `本周${thisWeekUsage}次` : `累计${totalCumUsage}次` },
      categories: categoryCount,
      resources: resourceCount,
      taskRate: tasks.length ? `${taskRate}%` : '—'
    }
  }

  /** 北极星指标计算公式（用于下钻抽屉展示） */
  const formulas = {
    dhi: 'DHI = 已投射至灯塔的项目中「周期窗口内有任务推进」的占比：全部=清晰，过半=关注，不足半数=模糊；活跃窗口随周期联动（日=今日/周=近14天/累计=全部）；投射仅项目层支持（战略目标层级已移除）',
    wce: 'WCE = 状态为「探索中 + 已求证」的好奇心卡片数；副指标 = 本周期新捕获数（日/周/累计随上方周期切换）',
    wrr: 'WRR = 所有资源卡「被打开次数」之和（累计不清零）；副指标 = 日档今日打开卡数 / 周档本周打开次数 / 累计档累计次数',
    groups: '模块分组数 = 所有工作台下的文件夹（分组）总数',
    resources: '链接卡片总数 = 全部资源卡数量（不含回收站）',
    taskRate: '未归档任务 = 未挂成功指标的任务数（含未挂项目的）；在抽屉中级联关联项目→指标后即完成归档'
  }

  return {
    d, visionText, missionText, directions, allProjects, projectById,
    focusedProjects, toggleFocusProject, projectProgress,
    northStarMetrics, formulas
  }
}

