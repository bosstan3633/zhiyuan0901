import { computed, ref } from 'vue'
import { useAppStore } from './app'
import { uid } from '@/shared/utils'
import type { Direction, Project } from '@/shared/models'

/**
 * R85（T0-A）：主攻项目上限。
 * 同一口径的三处出处——models/index.ts:65「最多2个」、manual-data.ts:229「🎯 主攻（最多 2 个）」、
 * 以及 ProjectCuration.vue 原先那句 toast。此前只有 ProjectCuration 一处校验，
 * 而本 store 的 toggleFocusProject（方向树在用）直接翻转、零校验 ⇒ 方向树能设出任意多个主攻。
 * 现把校验下沉到这里，三处出口共用。
 */
export const FOCUS_PROJECT_LIMIT = 2

// B40：recordResourceOpen 已下沉至 shared/storage/stats（应用端与网页端共用同一实现）
export { recordResourceOpen } from '@/shared/storage/stats'
import { getDataVersion, saveUIPrefs } from '@/shared/storage/repository'
import { readEventLog, curioCumulativeSince, countCurioCumulative, type CardEvent } from '@/shared/utils/eventLog'

/**
 * 方向台数据管理
 * 六层链：Vision → Mission → Direction(战略目标) → Project(攻坚项目) → Metric(成功指标) → Task
 */
export function useCompass() {
  // ---- R127：WCE 事件流水缓存（zy_event_log 读取一次缓存；computed 同步消费；与仪表盘同源） ----
  const wceEvents = ref<CardEvent[]>([])
  const wceBaseline = ref(0)
  async function refreshWce() {
    try {
      wceEvents.value = await readEventLog()
      wceBaseline.value = await curioCumulativeSince()
    } catch { /* 无 storage 权限：保持空（WCE 显示 0） */ }
  }

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

  /**
   * R86（T0）：已完成项目显隐——**三处模块共用同一份实现**（主航线 / 项目总览 / 完整方向树）。
   * 改前三个组件各写了一份**逐字相同**的 `showDone` + `toggleShowDone`（三份拷贝），
   * M7 要把 UI 开关从三处收敛到一处，不先抽共享函数就会变成两份或三份残留。
   * 口径 `isProjectDone`（R52-BUG-2：手动 done/archived 或全任务完成派生）。
   * ⚠ 这是**全局偏好**——一处切换，三处模块同时生效（这正是"收敛"的意义，不是 bug）。
   */
  const showDone = computed(() => store.ui?.showDoneProjects !== false)
  function toggleShowDone() {
    const next = !showDone.value
    if (store.ui) store.ui.showDoneProjects = next
    saveUIPrefs({ showDoneProjects: next })
  }

  // ---- 主攻项目（R60：原「投射至灯塔」语义已取消，重心口径统一收敛于此） ----
  const focusedProjects = computed<Project[]>(() =>
    allProjects().filter(p => p.isFocused && p.status !== 'archived')
  )

  /**
   * R85（T0-A）：切换主攻——**上限校验下沉到此处**，三处出口（方向树 / 项目策展页 / 主航线）共用。
   * 改前直接翻转、零校验 ⇒ 方向树能设出任意多个主攻，违反 models「最多2个」与手册口径。
   * ⚠ 存量已超上限的用户**不受阻断**：超限只拒绝新增，取消与查看一律正常（不强制裁剪）。
   * 返回结构化结果由**调用方** toast——store 是数据层，不碰 UI。
   */
  function toggleFocusProject(projectId: string): { ok: boolean; msg: string } {
    const p = projectById(projectId)
    if (!p) return { ok: false, msg: '项目不存在' }
    if (!p.isFocused) {
      const others = allProjects().filter(x => x.isFocused && x.id !== p.id)
      if (others.length >= FOCUS_PROJECT_LIMIT) {
        return { ok: false, msg: `主攻项目最多 ${FOCUS_PROJECT_LIMIT} 个，请先取消其他主攻` }
      }
    }
    p.isFocused = !p.isFocused
    store.persist()
    return { ok: true, msg: p.isFocused ? '🎯 已设为主攻' : '已取消主攻' }
  }

  /**
   * R85（T0-B）：新建项目——**四处**出口共用（项目总览 / 项目策展页 / 方向树 / 主航线）。
   * 改前两处各写一份且**字段已不一致**：CompassShell 有 `pinned`+`order`，
   * CompassTree 两者都缺 ⇒ 方向树建的项目 `order` 走 `?? 999`，永远排在最后。
   * 字段以 CompassShell 的既有口径为准（最完整）。
   */
  function addProjectToDir(dirId: string, name: string): Project | null {
    const dir = d.value.compass.directions.find(x => x.id === dirId)
    if (!dir) return null
    const proj: Project = {
      id: uid('proj'), name, isFocused: false, pinned: false,
      progress: 0, status: 'active', order: dir.projects.length, metrics: []
    }
    dir.projects.push(proj)
    store.persist()
    return proj
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
  // R45-1（V2.20.0）：周期调整为「日/周/累计」三档（撤月档），上排 战略目标/WCE/WRR 与下排新增/删除卡全档联动
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

        // R127：WCE 口径变更——好奇卡「创建 + 状态变更 + 删除」事件数（与仪表盘「探索累计」同源；旧口径退役）
    const curiosities = d.value.curiosities.filter(c => !c.deletedAt)
        const wceSince = period === 'all' ? wceBaseline.value : Math.max(wceBaseline.value, Date.now() - days * 86400_000)
    const wceCount = countCurioCumulative(wceEvents.value, wceSince)
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
      wce: { label: `${pLabel}探索 ${wceCount} 次`, sub: `${pLabel}新增 ${newInPeriod}`, count: wceCount },
      wrr: { label: `${wrrUnit}${wrrMain}次打开`, sub: wrrSub },
      categories: categoryCount,
      resources: resourceCount,
      taskRate: tasks.length ? `${taskRate}%` : '—'
    }
  }

  /** 北极星指标计算公式（用于下钻抽屉展示） */
  const formulas = {
    dhi: 'R64 口径：战略目标 = 使命下拆解的方向数（非归档 Direction）；推进中项目 = 全部项目中挂有非软删任务（任务数 ≠ 0）的项目数。不再计算 DHI 百分比。',
        wce: 'WCE（R127 新口径）：好奇卡「创建 + 状态变更 + 删除」的事件数（与仪表盘「探索累计」同源）；副指标 = 本周期新捕获数（日/周/累计随上方周期切换）',
    wrr: 'WRR 主数字随周期联动：日=今日打开卡数 / 周=本周打开次数(stats.wrr.thisWeekUsage) / 累计=所有资源卡被打开次数之和；副指标给出参照口径（日/周档显示累计值，累计档显示今日值）',
    groups: '模块分组数 = 所有策展台下的文件夹（分组）总数',
    resources: '链接卡片总数 = 全部资源卡数量（不含回收站）',
    taskRate: '未归档任务 = 未挂成功指标的任务数（含未挂项目的）；在抽屉中级联关联项目→指标后即完成归档'
  }

  return {
    refreshWce,
    d, visionText, missionText, directions, allProjects, projectById,
    showDone, toggleShowDone,
    focusedProjects, toggleFocusProject, addProjectToDir, projectProgress,
    isProjectStalled, isProjectDone, projectTasksOf, offCourseCount, taskArchiveIssue, unarchivedTaskCount, totalTaskCount,
    northStarMetrics, formulas
  }
}

