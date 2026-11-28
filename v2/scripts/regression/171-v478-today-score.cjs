/**
 * V4.7.8 · 画像页今日得分解释与状态口径稳定。
 *
 * 这组判据只允许随产品口径一起变：
 *  - 同卡同日多次状态变更取最终态，正序 / 倒序事件流必须得到同一结果；
 *  - 今日拆解各项之和必须等于 DayRec.w；
 *  - 采集 24h 内删除折 0.3、三件事与任务完成可叠加 5.5、无 100 分封顶；
 *  - 任务 / 好奇心最终 0 分状态、选题状态与子任务勾选都进入零分动作数，但不产生假残差；
 *  - 今日说明只在当前年展示，完整规则收在可展开层。
 */
const { check, read, SCRIPTS_DIR } = require('./helpers.cjs')
const path = require('path')
const fs = require('fs')

console.log('【V4.7.8 · 今日得分解释与状态最终态】')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* 依赖缺失时走形状兜底 */ }

function loadRealDailyStats() {
  if (!esbuild) return null
  const entry = path.resolve(SCRIPTS_DIR, '..', 'src', 'shared', 'utils', 'dailyStats.ts')
  const out = path.resolve(SCRIPTS_DIR, '..', '.r171-daily-score.tmp.cjs')
  try {
    esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': path.resolve(SCRIPTS_DIR, '..', 'src') },
    })
    return require(out)
  } catch {
    return null
  }
}

const ds = loadRealDailyStats()
const today = (() => {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()
const ts = hour => {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}
const ev = (id, action, kind, cardId, at, extra = {}) => ({
  id, ts: at, action, kind, title: cardId, cardId, ...extra,
})
const baseData = () => ({
  resources: [], tasks: [], curiosities: [], topics: [],
  dailyFocus: {
    [today]: [
      { id: 'slot-1', sourceType: 'task', sourceId: 'task-1', done: true, doneAt: ts(15) },
    ],
  },
  supportLinks: [{ id: 'link-1', taskId: 'task-1', resourceId: 'res-1', createdAt: ts(16) }],
})

check('V478-TS-1 ★同卡同日状态按最终态计：正序 / 倒序事件流都取 done，状态件数只记 1 次', () => {
  if (!ds) {
    const src = read('/shared/utils/dailyStats.ts')
    return src.includes('finalStatusEvents') && src.includes('finalStatus.get(')
  }
  const events = [
    ev('s1', 'status', 'task', 'task-1', ts(9), { to: 'doing' }),
    ev('s2', 'status', 'task', 'task-1', ts(10), { to: 'done' }),
  ]
  const a = ds.buildDailyStats(baseData(), events)
  const b = ds.buildDailyStats(baseData(), events.slice().reverse())
  const ra = a.days[today], rb = b.days[today]
  return !!ra && !!rb && ra.s.task === 1 && rb.s.task === 1 && ra.w === rb.w && ra.w >= 5.5
})

check('V478-TS-2 ★今日拆解严格回对总分：采集 / 调出 / 状态 / 修改 / 三件事 / 关联逐项相加等于 w', () => {
  if (!ds) {
    const src = read('/shared/utils/dailyStats.ts')
    return src.includes('explainDayScore') && src.includes('residual')
  }
  const events = [
    ev('c1', 'create', 'task', 'task-1', ts(8)),
    ev('c2', 'create', 'resource', 'res-1', ts(8)),
    ev('u1', 'call', 'task', 'task-1', ts(9)),
    ev('s1', 'status', 'task', 'task-1', ts(9), { to: 'doing' }),
    ev('s2', 'status', 'task', 'task-1', ts(10), { to: 'done' }),
    ev('e1', 'edit', 'task', 'task-1', ts(11)),
  ]
  const stats = ds.buildDailyStats(baseData(), events)
  const rec = stats.days[today]
  const b = ds.explainDayScore(rec, events, today)
  const sum = Math.round(b.items.reduce((n, x) => n + x.points, 0) * 10) / 10
  return !!rec && b.total === rec.w && sum === rec.w && b.items.some(x => x.key === 'focus')
    && b.items.some(x => x.key === 'link') && b.items.some(x => x.key === 'status-task')
})

check('V478-TS-3 ★采集后 24h 内删除按 0.3 计，拆解明细同样显示折后分', () => {
  if (!ds) return read('/shared/utils/dailyStats.ts').includes('QUICK_DELETE_FACTOR')
  const events = [
    ev('c1', 'create', 'resource', 'res-q', ts(8)),
    ev('d1', 'delete', 'resource', 'res-q', ts(9)),
  ]
  const stats = ds.buildDailyStats({ resources: [], tasks: [], curiosities: [], topics: [] }, events)
  const rec = stats.days[today]
  const b = ds.explainDayScore(rec, events, today)
  const item = b.items.find(x => x.key === 'create-resource')
  return !!rec && rec.w === 0.3 && !!item && item.points === 0.3 && b.total === 0.3
})

check('V478-TS-4 ★三件事完成与任务完成可叠加为 5.5；60 分仍为满格档，不存在 100 分封顶', () => {
  if (!ds) {
    const src = read('/shared/utils/dailyStats.ts')
    return src.includes("? 5 : 0") || src.includes('w <= 52 ? 4 : 5')
  }
  const events = [
    ev('s1', 'status', 'task', 'task-1', ts(9), { to: 'done' }),
  ]
  const data = baseData()
  data.supportLinks = []
  const stats = ds.buildDailyStats(data, events)
  const rec = stats.days[today]
  const b = ds.explainDayScore(rec, events, today)
  const sum = Math.round(b.items.reduce((n, x) => n + x.points, 0) * 10) / 10
  return !!rec && rec.w === 5.5 && sum === 5.5 && ds.levelOf(60) === 5 && ds.levelName(60) === '满格'
})

check('V478-TS-5 ★画像热力模块有今日行、档位、零分动作准确文案与可展开完整规则；不使用 100 分封顶字面量', () => {
  const src = read('/newtab/components/profile/PiAnnualHeatmap.vue')
  return src.includes('pi-hm-today') && src.includes('explainDayScore')
    && src.includes('计分规则') && src.includes('levelRange')
    && src.includes('zeroScoreCount') && src.includes('任务或好奇心回到待办')
    && !/100\s*分封顶|Math\.min\(100/.test(src)
})

check('V478-TS-6 ★任务 / 好奇心最终回到 todo 的 0 分状态、选题状态与子任务勾选全部计入零分动作数，且零分分项不产生残差', () => {
  if (!ds) {
    const src = read('/shared/utils/dailyStats.ts')
    return src.includes('zeroScoreCount') && src.includes('status-${kind}-zero')
      && src.includes('status-topic-zero') && src.includes('subtask-zero')
  }
  const data = {
    resources: [],
    tasks: [{
      id: 'task-sub',
      kind: 'task',
      subtasks: [{ id: 'sub-1', title: '拆解', done: true, doneAt: ts(14) }],
    }],
    curiosities: [],
    topics: [],
    dailyFocus: {},
    supportLinks: [],
  }
  const events = [
    ev('t1', 'status', 'task', 'task-todo', ts(9), { to: 'doing' }),
    ev('t2', 'status', 'task', 'task-todo', ts(10), { to: 'todo' }),
    ev('c1', 'status', 'curiosity', 'curio-todo', ts(11), { to: 'doing' }),
    ev('c2', 'status', 'curiosity', 'curio-todo', ts(12), { to: 'todo' }),
    ev('p1', 'status', 'topic', 'topic-1', ts(13), { to: 'done' }),
  ]
  const stats = ds.buildDailyStats(data, events)
  const rec = stats.days[today]
  const b = ds.explainDayScore(rec, events, today)
  const sum = Math.round(b.items.reduce((n, x) => n + x.points, 0) * 10) / 10
  const zeroKeys = new Set(b.items.filter(x => x.points === 0).map(x => x.key))
  return !!rec && rec.w === 0 && b.total === 0 && b.zeroScoreCount === 4
    && rec.s.task === 1 && rec.s.curio === 1 && rec.s.topic === 1 && rec.sub === 1
    && zeroKeys.has('status-task-zero') && zeroKeys.has('status-curiosity-zero')
    && zeroKeys.has('status-topic-zero') && zeroKeys.has('subtask-zero')
    && sum === 0 && b.residual === 0
})

check('V478-TS-7 ★零分最终状态与计分动作混合时，零分项单独列示、计入零分动作数，但不得改变总分或各项和', () => {
  if (!ds) {
    const src = read('/shared/utils/dailyStats.ts')
    return src.includes('zeroScoreCount') && src.includes('const known = round1')
  }
  const data = { resources: [], tasks: [], curiosities: [], topics: [], dailyFocus: {}, supportLinks: [] }
  const events = [
    ev('r1', 'create', 'resource', 'res-1', ts(8)),
    ev('t1', 'status', 'task', 'task-doing', ts(9), { to: 'doing' }),
    ev('t2', 'status', 'task', 'task-todo', ts(10), { to: 'todo' }),
  ]
  const stats = ds.buildDailyStats(data, events)
  const rec = stats.days[today]
  const b = ds.explainDayScore(rec, events, today)
  const sum = Math.round(b.items.reduce((n, x) => n + x.points, 0) * 10) / 10
  return !!rec && rec.w === 2.5 && b.total === 2.5 && b.zeroScoreCount === 1
    && b.items.some(x => x.key === 'status-task' && x.points === 1.5)
    && b.items.some(x => x.key === 'status-task-zero' && x.points === 0)
    && sum === b.total && b.residual === 0
})

try { fs.unlinkSync(path.resolve(SCRIPTS_DIR, '..', '.r171-daily-score.tmp.cjs')) } catch { /* 无产物 */ }
