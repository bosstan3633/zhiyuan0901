import { computed } from 'vue'
import { useAppStore } from './app'
import type { Direction, Project } from '@/shared/models'

// B40：recordResourceOpen 已下沉至 shared/storage/stats（应用端与网页端共用同一实现）
export { recordResourceOpen } from '@/shared/storage/stats'
import { getDataVersion } from '@/shared/storage/repository'

/**
 * 方向台数据管理
 * 六层链：Vision → Mission → Direction(战略目标) → Project(攻坚项目) → Metric(成功指标) → Task
 */
export function useCompass() {

  // ---- R56-PERF-c：项目任务索引（单次遍历，供 isProjectDone/isProjectStalled/projectProgress 共享） ----
  let ptIndexVersion = -1
  let ptIndex: Map<string, typeof d.value.tasks> = new Map()
  function projectTasksIndex(): Map<string, typeof d.value.tasks> {
    if (ptIndexVersion !== getDataVersion()) {
      const m: Map<string, typeof d.value.tasks> = new Map()
      for (const t of d.value.tasks) {
        if (t.deletedAt || !t.projectId) continue
        let arr = m.get(t.projectId)
        if (!arr) { arr = []; m.set(t.projectId, arr) }
        arr.push(t)
      }
      ptIndex = m
      ptIndexVersion = getDataVersion()
    }
    return ptIndex
  }
  function projectTasksOf(projectId: string) { return projectTasksIndex().get(projectId) || [] }

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

  // ---- 主攻项目（R60：原「投射至灯塔」语义已取消，重心口径统一收敛于此） ----
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
    const tasks = projectTasksOf(project.id)
    const done = tasks.filter(t => t.status === 'done').length
    const total = tasks.length
    const pct = total ? Math.round((done / total) * 100) : (project.progress || 0)
    return { done, total, pct }
  }

  /** R52-BUG-2：项目完成共享口径（一处定义、五处消费：主航线/项目总览/完整方向树/搜索项目类型）
   *  1) 手动 status=done/archived；2) 派生完成——项目下有任务且全部 done（纯计算，不回写 status） */
  function isProjectDone(project: Project): boolean {
    if (project.status === 'done' || project.status === 'archived') return true
    const tasks = projectTasksOf(project.id)
    return tasks.length > 0 && tasks.every(t => t.status === 'done')
  }

  /** R49-C2/C5：项目停滞判定（简版口径：有任务但近 14 天无推进/完成活动） */
  function isProjectStalled(project: Project): boolean {
    const tasks = projectTasksOf(project.id)
    if (!tasks.length) return false
    const recent = tasks.some(t =>
      t.status === 'doing' ||
      (t.updatedAt || 0) >= Date.now() - 14 * 86400_000 ||
      (t.completedAt || 0) >= Date.now() - 14 * 86400_000
    )
    return !recent
  }

  /** R49-C1：偏航行动 = 未关联项目（无 projectId）的活跃任务数（只读计算，不改写卡片） */
  function offCourseCount(): number {
    return d.value.tasks.filter(t => !t.deletedAt && t.status !== 'done' && !t.projectId).length
  }

  /** R50-F5：未归档任务口径（与 NorthStarPanel/O23 一致——项目存在 + 指标存在于该项目之下，缺一或失效即未归档） */
  function taskArchiveIssue(t: { projectId?: string; metricId?: string }): string {
    if (!t.projectId) return '未挂项目'
    const proj = allProjects().find(p => p.id === t.projectId)
    if (!proj) return '⚠ 项目失效'
    if (!t.metricId) return '未挂指标'
    if (!proj.metrics.some(mt => mt.id === t.metricId)) return '⚠ 指标失效'
    return ''
  }
  function unarchivedTaskCount(): number {
    return d.value.tasks.filter(t => !t.deletedAt && taskArchiveIssue(t) !== '').length
  }
  function totalTaskCount(): number {
    return d.value.tasks.filter(t => !t.deletedAt).length
  }

  // ---- 北极星指标 ----
  // R45-1（V2.20.0）：周期调整为「日/周/累计」三档（撤月档），上排 DHI/WCE/WRR 与下排新增/删除卡全档联动
  type Period = 'day' | 'week' | 'all'

  function isWithinDays(ts: number | undefined, days: number): boolean {
    if (!ts) return false
    return Date.now() - ts < days * 86400_000
  }

  // R56-PERF-d：北极星结果按 period+数据版本 memo（迁调度台后常驻首页，避免每次数据变更全量重算）
  let nsMemoKey = ''
  let nsMemo: ReturnType<typeof northStarMetricsRaw> | null = null
  function northStarMetrics(period: Period) {
    // R58-B3：memo 键拼上当日日期——跨零点后日窗口口径自动刷新，不再沿用昨日缓存
    const dayKey = new Date().toDateString()
    const key = period + ':' + dayKey + ':' + getDataVersion()
    if (nsMemo && nsMemoKey === key) return nsMemo
    nsMemoKey = key
    nsMemo = northStarMetricsRaw(period)
    return nsMemo
  }
  function northStarMetricsRaw(period: Period) {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 9999
    const pLabel = period === 'day' ? '今日' : period === 'week' ? '本周' : '累计'
    const dirs = d.value.compass.directions
    const projects = allProjects()

    // 方向状态（R64 拍板，DHI 百分比退役）：直接数数——
    //   战略目标 = 使命下拆解的方向数（Direction，非归档）；推进中项目 = 全部项目中「非软删任务数 ≠ 0」的项目数
    const goals = dirs.filter(x => x.status !== 'archived')
    let pushing = 0
    for (const dir of dirs) {
      for (const p of dir.projects) {
        if (p.status === 'archived') continue
        if (d.value.tasks.some(t => !t.deletedAt && t.projectId === p.id)) pushing++
      }
    }

    // WCE 好奇探索：激活数=「探索中+已求证」的好奇心数；新增=周期内捕获数
    const curiosities = d.value.curiosities.filter(c => !c.deletedAt)
    // R59-T9：WCE 口径扩展——激活好奇项 + 「好奇 → 任务/资源」转化卡数（fromCuriosityId 标记，按卡计）
    const wceCount = curiosities.filter(c => c.status === 'doing' || c.status === 'done').length
    const convertedCount = [...d.value.tasks, ...d.value.resources]
      .filter(x => !x.deletedAt && x.fromCuriosityId).length
    const newInPeriod = curiosities.filter(c => isWithinDays(c.createdAt, days)).length

    // WRR 有效复用：资源卡被打开的累计次数（策展台点击/双击打开/搜索打开均计数）
    // R45-1 副标随周期：日=今日打开卡数(lastCalledAt) / 周=本周次数(stats.wrr.thisWeekUsage) / 累计=累计口径
    const totalCalls = d.value.resources.filter(r => !r.deletedAt)
      .reduce((sum, r) => sum + (r.callCount || 0), 0)
    const thisWeekUsage = d.value.stats?.wrr?.thisWeekUsage ?? 0
    const totalCumUsage = d.value.stats?.wrr?.totalCumulativeUsage ?? totalCalls
    const sot = new Date(); sot.setHours(0, 0, 0, 0)
    const todayOpened = d.value.resources.filter(r => !r.deletedAt && (r.lastCalledAt || 0) >= sot.getTime()).length
    // R47-A1：主数字随档位联动（日=今日打开卡数 / 周=本周次数 / 累计=累计次数），副标给出参照口径
    const wrrMain = period === 'day' ? todayOpened : period === 'week' ? thisWeekUsage : totalCumUsage
    const wrrUnit = period === 'day' ? '今日' : period === 'week' ? '本周' : '累计'
    const wrrSub = period === 'all' ? `今日${todayOpened}卡打开` : `累计${totalCumUsage}次`

    // 模块分组数 = 所有策展台的文件夹（分组）总数
    const categoryCount = d.value.categories.length
    const resourceCount = d.value.resources.filter(r => !r.deletedAt).length
    const tasks = d.value.tasks.filter(t => !t.deletedAt)
    const doneTasks = tasks.filter(t => t.status === 'done').length
    const taskRate = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0

    return {
      dhi: { goals: goals.length, pushing, sub: `${goals.length} 战略目标 · ${pushing} 项目推进中` },
      wce: { label: `${wceCount + convertedCount} 项激活+转化`, sub: `${pLabel}新增 ${newInPeriod}`, count: wceCount + convertedCount },
      wrr: { label: `${wrrUnit}${wrrMain}次打开`, sub: wrrSub },
      categories: categoryCount,
      resources: resourceCount,
      taskRate: tasks.length ? `${taskRate}%` : '—'
    }
  }

  /** 北极星指标计算公式（用于下钻抽屉展示） */
  const formulas = {
    dhi: 'R64 口径：战略目标 = 使命下拆解的方向数（非归档 Direction）；推进中项目 = 全部项目中挂有非软删任务（任务数 ≠ 0）的项目数。不再计算 DHI 百分比。',
    wce: 'WCE（R59 扩展口径）= 「探索中 + 已求证」好奇项数 + 好奇卡转化为任务/资源的卡数；副指标 = 本周期新捕获数（日/周/累计随上方周期切换）',
    wrr: 'WRR 主数字随周期联动：日=今日打开卡数 / 周=本周打开次数(stats.wrr.thisWeekUsage) / 累计=所有资源卡被打开次数之和；副指标给出参照口径（日/周档显示累计值，累计档显示今日值）',
    groups: '模块分组数 = 所有策展台下的文件夹（分组）总数',
    resources: '链接卡片总数 = 全部资源卡数量（不含回收站）',
    taskRate: '未归档任务 = 未挂成功指标的任务数（含未挂项目的）；在抽屉中级联关联项目→指标后即完成归档'
  }

  return {
    d, visionText, missionText, directions, allProjects, projectById,
    focusedProjects, toggleFocusProject, projectProgress,
    isProjectStalled, isProjectDone, projectTasksOf, offCourseCount, taskArchiveIssue, unarchivedTaskCount, totalTaskCount,
    northStarMetrics, formulas
  }
}

