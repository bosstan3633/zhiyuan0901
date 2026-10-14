/**
 * W11（V3.8.11）方向台战略金字塔 · 集中取数层。
 *
 * 为什么需要这个模块（不是"顺手抽一下"）：
 *  病根＝原型化改造前，`tasksForMetric()` 被写在视图里、又在模板内被调 6 次/指标（判据 W11-11 钉死 ≤2）。
 *  指标一多就是每轮重渲染几十次 filter + sort，是 R83-7 性能红线背后的暗债。
 *  修法＝一次聚合成 Map，模板只做 `meta.get(id)` 的 O(1) 取值。
 *
 * 三条纪律（照抄本项目既有红线，不新造）：
 *  1. **纯函数零副作用**：不写 store、不改传入对象
 *  2. **渲染 computed 内禁 `.sort()` 原地改**：这里 sort 的是 filter 出来的**新数组**，与红线不冲突
 *     （红线禁的是"在 computed 里对已有数组原地 sort"）
 *  3. **口径单一**：任务归属只认 `t.metricId`；项目归属只认 `t.projectId`
 */
import type { AppData, Direction, Metric, Project, TaskCard } from '@/shared/models'

/** 单条成功指标的聚合结果（第 5 层） */
export interface MetricMeta {
  id: string
  /** 指标名（原型 `.metric-name` 的文案源） */
  title: string
  /** 验收说明（`metric.acceptance`），原型指标卡第二行 */
  acceptance: string
  /** 目标值（`metric.target`） */
  target: string
  /** 挂在该指标下的任务（已去重、已按创建时间升序） */
  tasks: TaskCard[]
  total: number
  done: number
  /** 完成率 0~100 */
  pct: number
  /** 聚合状态点：○ 空 / ◐ 有进行中 / ✓ 全完成 */
  dot: '' | 'doing' | 'done'
  /** ★断链：一条支撑任务都没有（线索断在这） */
  orphanMetric: boolean
}

/** 单个攻坚项目的聚合结果（第 4 层） */
export interface ProjectMeta {
  id: string
  metrics: MetricMeta[]
  total: number
  done: number
  pct: number
  /** 近 14 天无推进/完成活动 */
  stall: boolean
  /** ★断链数＝缺任务指标数 + 无归属任务数 */
  risk: number
  /** 在项目内但既无 metricId 也无 projectId 的任务（原型「无归属收容区」） */
  orphanTasks: TaskCard[]
}

/** 全罗盘聚合（第 1~6 层统一口径，骨架条数字与项目塔数字必须同源） */
export interface CompassMeta {
  /** 战略目标（第 3 层） */
  dirs: { dir: Direction; projects: ProjectMeta[] }[]
  /** 各层实体数（骨架条六层数字） */
  counts: {
    vision: number
    mission: number
    dirs: number
    projects: number
    metrics: number
    tasks: number
    /** 断链总数＝缺任务指标 + 无归属任务 */
    risk: number
  }
  /** metricId → 聚合结果（模板 O(1) 取值） */
  byMetric: Map<string, MetricMeta>
  /** projectId → 聚合结果 */
  byProject: Map<string, ProjectMeta>
}

/**
 * 任务去重双保险。
 * ★为什么不能省：REQ-034 记录过同一个 task.id 在库里出现两次的历史脏数据，
 * 少了这层会让进度条 done+total 大于项目实际任务数。
 */
function dedupeSorted(tasks: TaskCard[]): TaskCard[] {
  const seen = new Set<string>()
  const out: TaskCard[] = []
  for (const t of tasks) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  // 新数组上的 sort，不违反"渲染 computed 禁原地 sort"红线
  return out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

/** 单条指标的聚合（口径与旧 tasksForMetric + metricMaturity 一致） */
function aggMetric(m: Metric, byMetric: TaskCard[]): MetricMeta {
  const tasks = dedupeSorted(byMetric.filter(t => t.metricId === m.id))
  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const anyDoing = tasks.some(t => t.status === 'doing')
  return {
    id: m.id,
    title: m.title,
    acceptance: m.acceptance || '',
    target: m.target || '',
    tasks,
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    dot: total && done === total ? 'done' : anyDoing ? 'doing' : '',
    /* 断链判据：任务数为零。原型的「缺任务」黄标与虚线空位都吃这个字段 */
    orphanMetric: total === 0
  }
}

/**
 * 主入口：从 AppData 一次算出整棵罗盘的聚合结果。
 * @param d 全量数据
 * @param isStalled 项目停滞判定（由 store 提供，方向台现役口径：近 14 天无推进）
 */
export function buildCompassMeta(d: AppData, isStalled: (p: Project) => boolean): CompassMeta {
  const live = d.tasks.filter(t => !t.deletedAt)
  /* 按 metricId 分桶一次，避免每个指标各扫一遍全表 */
  const bucket = new Map<string, TaskCard[]>()
  for (const t of live) {
    const k = t.metricId || ''
    if (!k) continue
    const arr = bucket.get(k)
    if (arr) arr.push(t)
    else bucket.set(k, [t])
  }
  const byMetric = new Map<string, MetricMeta>()
  const byProject = new Map<string, ProjectMeta>()
  let nProjects = 0, nMetrics = 0, nTasks = 0

  const dirs = d.compass.directions.map(dir => {
    /* 排序键要用到 isFocused / pinned / order，先建 id→Project 查表，避免每个舱都 find（O(n²)） */
    const projById = new Map(dir.projects.map((x) => [x.id, x]))
    const projects = dir.projects.map(p => {
      /* 项目内任务＝挂在该项目任一指标下的 + projectId 命中的（后者是「未挂指标」的候选） */
      const projTasks = live.filter(t => t.projectId === p.id)
      const ownedIds = p.metrics.map(m => m.id)
      const metrics = p.metrics.map(m => aggMetric(m, bucket.get(m.id) || []))
      for (const mm of metrics) byMetric.set(mm.id, mm)
      const total = metrics.reduce((s, mm) => s + mm.total, 0)
      const done = metrics.reduce((s, mm) => s + mm.done, 0)
      /* 无归属＝在本项目内、却没挂到本项目任何一个指标下 */
      const ownedSet = new Set(ownedIds)
      const orphanTasks = dedupeSorted(projTasks.filter(t => !t.metricId || !ownedSet.has(t.metricId)))
      const risk = metrics.filter(mm => mm.orphanMetric).length + orphanTasks.length
      const pm: ProjectMeta = {
        id: p.id,
        metrics,
        total,
        done,
        pct: total ? Math.round((done / total) * 100) : (p.progress || 0),
        stall: isStalled(p),
        risk,
        orphanTasks
      }
      byProject.set(p.id, pm)
      nProjects++
      nMetrics += metrics.length
      return pm
    })
    /* ★W12(V3.8.12)真缺陷修复（E2E-29 实跑抓到）：项目舱的渲染顺序原先直接沿用
       `dir.projects` 的**原始数组序**，而 CompassTree 的排序键是
       「主攻 → 置顶 → order」写在 `visibleProjectsOf` 里 —— 两套口径不一致：
         · 用户拖过的 order 只写进字段、**从不重排数组** ⇒ 视觉顺序一动不动（toast 却报"排到第 N 位"）
         · 主攻/置顶项目也**不一定真在前排**（E2E-30 只验了徽标，从没验过排序位置）
       这里把同一套排序键施加到取数层，让本函数成为顺序的**唯一真源**，
       模板侧不必再各自排一次。★不改 CompassTree.visibleProjectsOf —— 它承担
       「已完成项目显隐过滤」，过滤后的子集仍需同一套键，故保留；两处键值必须同源维护。
       （排序键：主攻 → 置顶 → order，order 缺省 999，与 visibleProjectsOf 完全一致） */
    const sorted = projects.slice().sort((a, b) => {
      const pa = projById.get(a.id)
      const pb = projById.get(b.id)
      return (Number(!!pb?.isFocused) - Number(!!pa?.isFocused))
        || (Number(!!pb?.pinned) - Number(!!pa?.pinned))
        || (((pa?.order) ?? 999) - ((pb?.order) ?? 999))
    })
    return { dir, projects: sorted }
  })

  /* 全站任务数口径：未删除即算（与现役 treeStats.tasks 一致） */
  nTasks = live.length
  let risk = 0
  for (const pm of byProject.values()) risk += pm.risk

  return {
    dirs,
    counts: {
      vision: d.compass.vision ? 1 : 0,
      mission: d.compass.mission ? 1 : 0,
      dirs: dirs.length,
      projects: nProjects,
      metrics: nMetrics,
      tasks: nTasks,
      risk
    },
    byMetric,
    byProject
  }
}

/**
 * 成熟度等级 → 颜色令牌。
 * ★判据 W11-5 的配套：等级色只做**小圆点/小徽标**，
 * 绝不许用在指标名或任务名上（那会造成"等级压过标题"的层级倒置）。
 * 令牌真名以 tokens.css 为准：--success / --info-blue / --warning / --danger（无 --ok / --info）。
 */
export function gradeColorVar(grade: string): string {
  return grade === 'A' ? 'var(--success)'
    : grade === 'B' ? 'var(--info-blue)'
      : grade === 'C' ? 'var(--warning)'
        : 'var(--danger)'
}