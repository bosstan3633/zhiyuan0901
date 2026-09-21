/**
 * R148-T：AI 任务注册表——**任务生命周期与抽屉解绑**。
 *
 * 用户实测的病（R148 需求 #4）：抽屉就是任务本体，`props.job` 一换即 abort 上一轮。
 * 于是①手滑点到别的诊断，正在跑的（多批归架要几分钟）直接蒸发；②再点同一个功能从头再来；
 * ③跑完的报告不落地的话，关掉抽屉就没了。
 *
 * 口径：
 *  1. **按 jobKey 幂等**——同一功能再点：在跑就 attach（看进度），跑完就看结果 +「↻ 重新运行」；
 *  2. **关抽屉不杀任务**——只有「⏹ 停止」和 drop() 才中止；停止后留下一条 stopped 记录（结果作废、可重跑），不把手上的任务抹没;
 *  3. **并发上限 2**，超了排队并如实显示「排队中」，不偷偷并行打满网关；
 *  4. **报告型自动落卡**（autoReport）——只写"报告卡自己那一行"（新建或刷新同日那张）、
 *     不改任何别的既有数据的产出，跑完自动进资源台待分类；
 *     会改既有数据的采纳动作**仍然必须勾选**，这条纪律不在本模块松动。
 */
import { ref } from 'vue'
import type { AiJob, AiRow } from './job'
import { chatStream, extractJson, setLlmFeedSink } from './llm'

export type JobPhase = 'queued' | 'running' | 'done' | 'error' | 'stopped'

export interface JobState {
  key: string
  title: string
  phase: JobPhase
  rows: AiRow[]
  raw: string
  err: string
  feed: { chars: number; calls: number; pt: number; ct: number }
  secs: number
  startedAt: number
  finishedAt: number
  /** 报告型自动落卡的回执（已存入哪张台 / 卡名） */
  savedNote: string
  job: AiJob
}

const MAX_PARALLEL = 2

const states = ref(new Map<string, JobState>())
const controllers = new Map<string, AbortController>()
const tickers = new Map<string, ReturnType<typeof setInterval>>()
const factories = new Map<string, () => AiJob | null>()
/** 每个 key 的"第几轮"——中止回来的只有当前轮才有资格动注册表（rerun 的旧请求晚到会误杀新一轮） */
const attempts = new Map<string, number>()

function activeCount(): number {
  let n = 0
  states.value.forEach(s => { if (s.phase === 'running') n++ })
  return n
}
function set(key: string, s: JobState): void {
  const next = new Map(states.value)
  next.set(key, s)
  states.value = next
}
/** 局部更新（保持 Map 引用更换，Vue 侧才能看到变化） */
function patch(key: string, p: Partial<JobState>): void {
  const cur = states.value.get(key)
  if (!cur) return
  set(key, Object.assign({}, cur, p))
}

export function getJobState(key: string): JobState | undefined { return states.value.get(key) }
export function listJobStates(): JobState[] { return [...states.value.values()].sort((a, b) => b.startedAt - a.startedAt) }
export function runningJobCount(): number { return activeCount() }

function stopTicker(key: string): void {
  const t = tickers.get(key)
  if (t) clearInterval(t)
  tickers.delete(key)
}

/** 排队中的任务在有空位时自动起飞 */
function pump(): void {
  if (activeCount() >= MAX_PARALLEL) return
  const next = listJobStates().find(s => s.phase === 'queued')
  if (next) void execute(next.key)
}

async function execute(key: string): Promise<void> {
  const st = states.value.get(key)
  if (!st || st.phase === 'running' || st.phase === 'done') return
  if (activeCount() >= MAX_PARALLEL) { patch(key, { phase: 'queued' }); return }
  const job = st.job
  patch(key, { phase: 'running', startedAt: Date.now(), rows: [], raw: '', err: '', savedNote: '', feed: { chars: 0, calls: 0, pt: 0, ct: 0 }, secs: 0 })
  stopTicker(key)
  tickers.set(key, setInterval(() => {
    const c = states.value.get(key)
    if (c && c.phase === 'running') patch(key, { secs: Math.round((Date.now() - c.startedAt) / 1000) })
  }, 1000))
  const ac = new AbortController()
  controllers.set(key, ac)
  const myAttempt = (attempts.get(key) || 0) + 1
  attempts.set(key, myAttempt)
  // 投料账在线路处结算（R147-b 同一口径，只是宿主从抽屉搬到了任务）
  const mine = () => attempts.get(key) === myAttempt
  setLlmFeedSink((m) => {
    if (!mine()) return
    const c = states.value.get(key)
    if (!c || c.phase !== 'running') return
    c.feed.chars += m.inChars; c.feed.calls++; c.feed.pt += m.promptTokens || 0; c.feed.ct += m.completionTokens || 0
  })
  try {
    let rows: AiRow[]
    let raw = ''
    if (job.run) {
      rows = await job.run({ signal: ac.signal, onDelta: (t) => { const c = states.value.get(key); if (c && mine()) c.raw = t } })
      raw = rows.length ? '' : ''
    } else {
      const { messages, jsonMode } = await job.build()
      raw = await chatStream({ messages, jsonMode: job.rawText ? false : jsonMode !== false, signal: ac.signal, onDelta: (t) => { if (mine()) patch(key, { raw: t }) } })
      if (!raw.trim()) throw new Error('模型返回为空（可能超时或余额不足）')
      rows = job.parse(job.rawText ? raw : extractJson(raw))
    }
    const live = states.value.get(key)
    if (!mine() || !live || live.phase !== 'running') return
    patch(key, { phase: 'done', rows, raw, finishedAt: Date.now() })
    stopTicker(key)
    // 报告型自动落卡：只新增卡，不改既有数据（纪律边界见文件头第 4 条）
    if (job.autoReport) {
      try {
        const p = job.autoReport.build(rows)
        if (p) patch(key, { savedNote: job.autoReport.save(p) || '✓ 报告已存为资源卡' })
      } catch (e) { patch(key, { savedNote: '⚠ 报告落卡失败：' + (e as Error).message }) }
    }
  } catch (e) {
    if (!mine()) return
    const msg = (e as Error).message || String(e)
    if ((e as Error).name === 'AbortError') { patch(key, { phase: 'stopped', finishedAt: Date.now() }); return }
    patch(key, { phase: 'error', err: msg, finishedAt: Date.now() })
  } finally {
    if (controllers.get(key) === ac) controllers.delete(key)
    if (mine()) { stopTicker(key); setLlmFeedSink(null); pump() }
  }
}

/**
 * 入口：点一下某功能。
 * 已有结果 → 直接返回（宿主据此展开结果，不重跑）；在跑/排队 → attach（看进度）；没有 → 起一个。
 */
export function openJob(key: string, title: string, make: () => AiJob | null): JobState | null {
  const cur = states.value.get(key)
  if (cur) return cur
  const job = make()
  if (!job) return null
  // 先入队，由 execute 提升为 running——否则 execute 的"已在跑"守卫会把它自己挡掉（首版踩过的坑）
  const st: JobState = {
    key, title: title || job.title, phase: 'queued',
    rows: [], raw: '', err: '', feed: { chars: 0, calls: 0, pt: 0, ct: 0 },
    secs: 0, startedAt: Date.now(), finishedAt: 0, savedNote: '', job,
  }
  factories.set(key, make)
  set(key, st)
  void execute(key)
  return states.value.get(key) || st
}

/** ↻ 重新运行：丢掉旧结果，用宿主工厂重建任务再跑 */
export function rerunJob(key: string, make?: () => AiJob | null): JobState | null {
  const f = make || factories.get(key)
  const old = states.value.get(key)
  drop(key)
  if (!f || !old) return null
  return openJob(key, old.title, f)
}

/** ⏹ 停止（唯一会中止任务的用户动作） */
export function stop(key: string): void {
  const ac = controllers.get(key)
  if (ac) { ac.abort(); controllers.delete(key) }
  stopTicker(key)
}

/** 从列表里彻底移除一条任务记录（不 abort 已在跑的，先 stop） */
export function drop(key: string): void {
  stop(key)
  const next = new Map(states.value)
  next.delete(key)
  states.value = next
  factories.delete(key)
}

/** 清掉已完成/失败的历史（设置页「收起列表」用） */
export function clearFinished(): void {
  const next = new Map(states.value)
  let changed = false
  next.forEach((s, k) => { if (s.phase === 'done' || s.phase === 'error' || s.phase === 'stopped') { next.delete(k); factories.delete(k); changed = true } })
  if (changed) states.value = next
}

/** 供 apply 后回收：某 key 的结果作废（采纳完 = 这轮结束） */
export function retire(key: string): void { drop(key) }
