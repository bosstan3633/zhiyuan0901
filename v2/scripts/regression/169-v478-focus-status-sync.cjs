/**
 * V4.7.8 · 进入今日三件事后的任务状态同步。
 *
 * 锁定的契约：
 *  ① `TaskCard.statusId` 是真源，`status` 只是三桶兼容镜像；
 *  ② “进入重点”只允许走 `enterFocusTaskStatus()`：todo → 实际 doing 状态，
 *     done / doing 不降级，状态 id 不硬编码；
 *  ③ 所有落槽入口（槽位、详情、任务池、两处日历拖入、网页浮层、历史复制、
 *     自动推荐 / 启动 reconcile / AI 无界面复核）在真正落槽后统一推进状态；
 *  ④ 移出槽位或取消排期不回滚状态；只有显式撤销且仍停在本次写入的 doing 时才恢复；
 *  ⑤ 旧脏签名 `status=doing + statusId∈todo桶` 只按版本修一次，之后尊重用户手改；
 *  ⑥ 槽位、详情、主列表、看板、月历、项目全景统一读 `taskStatusOf()`，
 *     自定义 doing 状态名直接显示，不再固定“进行中”。
 *
 * 本分片由 V4.7.8 主交付统一注册，不修改 regression.cjs。
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { check, read, codeOnly, fnBody, SCRIPTS_DIR } = require('./helpers.cjs')

console.log('【V4.7.8 · 今日重点任务状态同步】')

const TASK_STATUS = read('/shared/utils/taskStatus.ts')
const FOCUS_SUGGEST = read('/shared/utils/focusSuggest.ts')
const HOME = read('/newtab/views/useCompassHome.ts')
const COMPASS_HOME = read('/newtab/views/CompassHome.vue')
const APP_STORE = read('/newtab/stores/app.ts')
const TASK_DETAIL = read('/newtab/components/compass/TaskDetailDrawer.vue')
const TASK_MANAGER = read('/newtab/components/compass/TaskManagerPanel.vue')
const TASK_BOARD = read('/newtab/components/compass/TaskBoardView.vue')
const TASK_CALENDAR = read('/newtab/components/compass/TaskCalendarView.vue')
const PROJECT_DRAWER = read('/newtab/components/ProjectDetailDrawer.vue')
const COMPASS_LANE = read('/newtab/components/compass/CompassLane.vue')
const COMPASS_PANO_LANE = read('/newtab/components/compass/CompassPanoLane.vue')
const OVERLAY = read('/content/overlay-search.ts')
const MODELS = read('/shared/models/index.ts')
const REPOSITORY = read('/shared/storage/repository.ts')
const PLAN_SCHEDULE = read('/shared/storage/planSchedule.ts')

let esbuild = null
try { esbuild = require('esbuild') } catch { /* 依赖缺失时行为断言退到源码闭包 */ }

let loadError = ''
function loadRealFocusStatus() {
  if (!esbuild) return null
  const srcRoot = path.resolve(SCRIPTS_DIR, '..', 'src')
  const out = path.resolve(SCRIPTS_DIR, '..', `.r169-focus-status.${process.pid}.tmp.cjs`)
  try {
    esbuild.buildSync({
      stdin: {
        contents: [
          "export * from '@/shared/utils/taskStatus'",
          "export * from '@/shared/utils/focusSuggest'",
          "export { scheduleCardDate } from '@/shared/storage/planSchedule'",
        ].join('\n'),
        resolveDir: srcRoot,
        sourcefile: 'r169-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: out,
      logLevel: 'silent',
      alias: { '@': srcRoot },
    })
    return require(out)
  } catch (error) {
    loadError = error && error.message ? error.message : String(error)
    return null
  } finally {
    try { fs.unlinkSync(out) } catch { /* 临时文件可能尚未生成 */ }
  }
}

const API = loadRealFocusStatus()

const STATUS_FIXTURE = [
  { id: 'todo-custom', name: '待安排', color: '#6F7C86', order: 0, bucket: 'todo' },
  { id: 'doing-custom', name: '推进中', color: '#0F6F9E', order: 1, bucket: 'doing' },
  { id: 'doing-alt', name: '打磨中', color: '#9A6B12', order: 2, bucket: 'doing' },
  { id: 'done-custom', name: '已收束', color: '#168457', order: 3, bucket: 'done', terminal: true },
]

function localDateKey(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const TODAY = localDateKey()

function statusFixture() {
  return STATUS_FIXTURE.map(status => ({ ...status }))
}

function baseData(overrides = {}) {
  return {
    taskStatuses: statusFixture(),
    tasks: [],
    topics: [],
    topicStatuses: [],
    dailyFocus: {},
    planScheduleEvents: [],
    compass: { directions: [] },
    ...overrides,
  }
}

function makeTask(id, statusId = 'todo-custom', extra = {}) {
  const status = STATUS_FIXTURE.find(row => row.id === statusId) || STATUS_FIXTURE[0]
  return {
    id,
    kind: 'task',
    title: id,
    statusId,
    status: status.bucket,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  }
}

function makeSlot(taskId, extra = {}) {
  return {
    id: `focus-${taskId}`,
    slotIndex: 0,
    sourceType: 'task',
    sourceId: taskId,
    text: taskId,
    done: false,
    updatedAt: 1,
    ...extra,
  }
}

check('V478-FS-1 ★唯一“进入重点”写入器：按 taskStatusOf 判桶，done/doing 不降级，todo 用 taskInProgressStatus 的实际 doing id 并同步 status 镜像；不硬编码 task-doing', () => {
  const source = codeOnly(TASK_STATUS)
  const enter = fnBody(source, 'export function enterFocusTaskStatus(', 'export function restoreFocusTaskStatus(')
  const setter = fnBody(source, 'export function setTaskStatusById(', 'export interface FocusTaskStatusWrite')

  assert.ok(enter.includes('const current = taskStatusOf(data, task)'), 'enterFocusTaskStatus 必须先读 taskStatusOf')
  assert.ok(enter.includes("current.bucket === 'done' || current.bucket === 'doing'"), 'done / doing 必须直接返回')
  assert.ok(enter.includes('const next = taskInProgressStatus(data)'), 'doing 目标必须来自 taskInProgressStatus')
  assert.ok(enter.includes('setTaskStatusById(data, task, next.id, stamp)'), '必须经 setTaskStatusById 同步真源与镜像')
  assert.ok(!enter.includes("'task-doing'"), '唯一写入器不得硬编码 task-doing')
  assert.ok(setter.includes('task.statusId = next.id'), 'setTaskStatusById 必须写 statusId 真源')
  assert.ok(setter.includes('task.status = next.bucket'), 'setTaskStatusById 必须同步兼容 status')

  if (!API) return true

  const d = baseData({ tasks: [] })
  const task = makeTask('task-enter')
  d.tasks.push(task)
  const write = API.enterFocusTaskStatus(d, task, 101)
  assert.deepStrictEqual(write, {
    changed: true,
    beforeId: 'todo-custom',
    writtenId: 'doing-custom',
  })
  assert.strictEqual(task.statusId, 'doing-custom')
  assert.strictEqual(task.status, 'doing')
  assert.strictEqual(task.updatedAt, 101)
  assert.strictEqual(API.taskStatusOf(d, task).name, '推进中')

  const repeat = API.enterFocusTaskStatus(d, task, 202)
  assert.strictEqual(repeat.changed, false)
  assert.strictEqual(task.updatedAt, 101, '已在 doing 桶时不得重复改 updatedAt')

  const done = makeTask('task-done', 'done-custom')
  d.tasks.push(done)
  const doneWrite = API.enterFocusTaskStatus(d, done, 303)
  assert.strictEqual(doneWrite.changed, false)
  assert.strictEqual(done.statusId, 'done-custom')
  assert.strictEqual(done.status, 'done')
  assert.strictEqual(done.updatedAt, 1, '已完成任务进入重点不得降级或改时间')
  return true
})

check('V478-FS-2 ★主动入口矩阵收敛：槽位选择、详情设为重点、任务池两入口、两处日历拖入今天、网页浮层、历史复制全部接线；启动与云恢复 reconcile 均在位', () => {
  const home = codeOnly(HOME)
  const detail = codeOnly(TASK_DETAIL)
  const manager = codeOnly(TASK_MANAGER)
  const overlay = codeOnly(OVERLAY)
  const appStore = codeOnly(APP_STORE)

  const picker = fnBody(home, 'function selectTaskForSlot(', 'type FocusPickerCandidate')
  const copy = fnBody(home, 'async function copyFocusToToday(', 'function copyYesterday(')
  const requestFocus = fnBody(home, 'async function requestTaskFocus(', 'async function replaceTaskFocus(')
  const setWorkDue = fnBody(home, 'async function setTaskWorkDue(', 'function clearTaskWorkDue(')
  const addToToday = fnBody(detail, 'async function addToTodayFocus(', 'function gotoProjectPano(')
  const addFromManager = fnBody(manager, 'function addTaskToTodayFocus(', 'function cycleTaskStatus(')
  const setManagerDue = fnBody(manager, 'function setTaskDueDate(', 'function clearTaskDueDate(')
  const overlayFocus = fnBody(overlay, 'async function addTaskToDailyFocus(', 'function renderResults(')
  const init = fnBody(appStore, 'async function init() {', 'async function refreshAfterCloudRestore(')
  const cloudRestore = fnBody(appStore, 'async function refreshAfterCloudRestore(', 'function setTheme(')

  assert.ok(picker.includes('addManualFocus(d.value, key, task.id, pickerSlot.value)'), '三件事槽位选择器必须走 addManualFocus')
  assert.ok(addToToday.includes('addManualFocus(d.value, key, task.id)'), '详情“设为今日重点”必须走 addManualFocus')
  assert.ok(requestFocus.includes('addManualFocus(d.value, todayKey.value, task.id)'), '任务池 requestTaskFocus 必须走 addManualFocus')
  assert.ok(addFromManager.includes('addManualFocus(d.value, key, task.id)'), '任务池 addTaskToTodayFocus 必须走 addManualFocus')
  assert.ok(setWorkDue.includes('if (date === today)') && setWorkDue.includes('addManualFocus(d.value, today, task.id)'), '任务工作台拖入今天必须走 addManualFocus')
  assert.ok(setManagerDue.includes('if (date === today)') && setManagerDue.includes('addManualFocus(d.value, today, task.id)'), '月历拖入今天必须走 addManualFocus')
  assert.ok(copy.includes('if (task) enterFocusTaskStatus(d.value, task)'), '历史三件事复制必须走唯一写入器')
  assert.ok(copy.includes("done: status === 'done'"), '历史复制必须保留已完成快照，不得降级')

  const fullAt = overlayFocus.indexOf('active.length >= FOCUS_LIMIT && freeIndex < 0')
  const overlayWriteAt = overlayFocus.indexOf('if (task) enterFocusTaskStatus(d, task)')
  assert.ok(fullAt >= 0 && overlayWriteAt > fullAt, '网页浮层必须先判满额/替换，再推进状态')
  assert.ok(overlayFocus.includes('if (task && task.dueDate !== key)') && overlayFocus.includes("scheduleCardDate(d, task, key, { source: 'focus' })"), '网页浮层写入后仍走 scheduleCardDate 同步今日计划')

  assert.ok(init.includes('reconcileTodayFocusSchedule(data.value)'), '启动链必须接 reconcileTodayFocusSchedule')
  assert.ok(cloudRestore.includes('reconcileTodayFocusSchedule(d)'), '云恢复链必须接 reconcileTodayFocusSchedule')
  assert.ok(!/enterFocusTaskStatus|setTaskStatusById|adoptFocusOrder/.test(init), '启动链不得绕过 reconcile 直写任务状态')
  assert.ok(!/enterFocusTaskStatus|setTaskStatusById|adoptFocusOrder/.test(cloudRestore), '云恢复链不得绕过 reconcile 直写任务状态')
  return true
})

check('V478-FS-3 ★自动推荐 / 启动 reconcile / AI 无界面复核进入槽位后统一推进任务状态；已完成保持完成，显式采纳复用同一落槽口', () => {
  const focus = codeOnly(FOCUS_SUGGEST)
  const home = codeOnly(HOME)
  const reconcile = fnBody(focus, 'export function reconcileTodayFocusSchedule(', 'export function applyFocusOrder(')
  const apply = fnBody(focus, 'export function applyFocusOrder(', 'export function adoptFocusOrder(')
  const adopt = fnBody(focus, 'export function adoptFocusOrder(', 'export type ManualFocusResult')
  const advance = fnBody(focus, 'export function advanceFocusTaskStatuses(', 'function localDateKey(')
  const ensure = fnBody(home, 'async function ensureAutoFocus(', 'async function refineWithAi(')
  const refine = fnBody(home, 'async function refineWithAi(', 'function toggleWhy')
  const reshuffle = fnBody(home, 'async function reshuffleFocus(', 'function muteFocusToday')

  assert.ok(advance.includes('(slots || []).filter(') && advance.includes('activeFocusSlots(liveSlots)'), '状态同步器只能扫描实际占用的槽位')
  assert.ok(advance.includes('enterFocusTaskStatus(d, task, stamp)'), '状态同步器必须走唯一写入器')
  assert.ok(reconcile.includes('advanceFocusTaskStatuses(d, anchorKey, cells, stamp)'), 'reconcile 自动补槽后必须同步槽内任务状态')
  assert.ok(reconcile.includes('auto: true'), 'reconcile 自动补槽必须标 auto:true')
  assert.ok(apply.includes('advanceFocusTaskStatuses(d, anchorKey, d.dailyFocus[anchorKey])'), 'applyFocusOrder 落槽后必须同步槽内任务状态')
  assert.ok(apply.includes('const done = isTaskDone(d, task)'), 'applyFocusOrder 写入已完成任务时必须保留完成态')
  assert.ok(apply.includes('auto: true'), 'applyFocusOrder 写入的推荐位必须标 auto:true')
  assert.ok(apply.includes('return { changed, statusChanged }'), 'applyFocusOrder 必须同时报告槽位变化与状态推进数')
  assert.ok(adopt.includes('return applyFocusOrder(d, anchorKey, orderedIds, limit)'), '显式采纳必须复用 applyFocusOrder 的落槽与状态收敛')
  const ensureAdvanceAt = ensure.indexOf('const focusStatusChanged = advanceFocusTaskStatuses(d.value, key)')
  const ensureMuteAt = ensure.indexOf('if (d.value.focusMutedDate === key')
  assert.ok(ensureAdvanceAt >= 0 && ensureMuteAt > ensureAdvanceAt, 'ensureAutoFocus 必须在所有早退守卫之前同步已有槽位状态')
  assert.ok(ensure.includes('applyFocusOrder(d.value, key, cands.map(c => c.taskId), FOCUS_LIMIT)'), '本地自动推荐只走 applyFocusOrder')
  assert.ok(refine.includes('applyFocusOrder(d.value, key, r.order, FOCUS_LIMIT)'), 'AI 无界面复核必须复用 applyFocusOrder')
  assert.ok(reshuffle.includes('applyFocusOrder(d.value, key, next.map(c => c.taskId), FOCUS_LIMIT)'), '换一批必须复用 applyFocusOrder')
  assert.ok(codeOnly(read('/shared/ai/focusSuggest.ts')).includes('adoptFocusOrder(d, ctx.anchorKey, ids, limit)'), 'AI 评审抽屉的“采纳”必须走显式 adoptFocusOrder')

  if (!API) return true

  const applied = baseData()
  const applyTask = makeTask('task-auto-apply')
  const applyDone = makeTask('task-auto-done', 'done-custom')
  applied.tasks.push(applyTask, applyDone)
  const result = API.applyFocusOrder(applied, TODAY, ['task-auto-apply', 'task-auto-done'])
  assert.strictEqual(result.changed, 2)
  assert.strictEqual(result.statusChanged, 1)
  assert.strictEqual(applied.dailyFocus[TODAY][0].auto, true)
  assert.strictEqual(applyTask.statusId, 'doing-custom', 'applyFocusOrder 必须把待开始推进到 doing')
  assert.strictEqual(applyTask.status, 'doing')
  assert.strictEqual(applyDone.statusId, 'done-custom', 'applyFocusOrder 不得把已完成降级')
  assert.strictEqual(applied.dailyFocus[TODAY][1].done, true)

  const existingApplied = baseData()
  const existingApplyTask = makeTask('task-existing-apply')
  existingApplied.tasks.push(existingApplyTask)
  existingApplied.dailyFocus[TODAY] = [makeSlot('task-existing-apply')]
  const existingAppliedResult = API.applyFocusOrder(existingApplied, TODAY, ['task-existing-apply'])
  assert.strictEqual(existingAppliedResult.changed, 0)
  assert.strictEqual(existingAppliedResult.statusChanged, 1, '槽位结构未变时也必须推进槽内待开始任务')
  assert.strictEqual(existingApplyTask.statusId, 'doing-custom')

  const reconciled = baseData()
  const dueTask = makeTask('task-auto-reconcile', 'todo-custom', { dueDate: TODAY })
  const dueDone = makeTask('task-auto-reconcile-done', 'done-custom', { dueDate: TODAY, updatedAt: 2 })
  reconciled.tasks.push(dueTask, dueDone)
  const reconciledCount = API.reconcileTodayFocusSchedule(reconciled, TODAY)
  assert.ok(reconciledCount > 0)
  assert.ok(reconciled.dailyFocus[TODAY].filter(slot => slot && !slot.cleared).every(slot => slot.auto === true))
  assert.strictEqual(dueTask.statusId, 'doing-custom', 'reconcile 到期补槽必须把待开始推进到 doing')
  assert.strictEqual(dueTask.status, 'doing')
  assert.strictEqual(dueDone.statusId, 'done-custom', 'reconcile 不得把已完成降级')
  assert.ok(reconciled.dailyFocus[TODAY].some(slot => slot.sourceId === dueDone.id && slot.done === true))

  const existingDue = baseData()
  const existingDueTask = makeTask('task-existing-reconcile', 'todo-custom', { dueDate: TODAY })
  existingDue.tasks.push(existingDueTask)
  existingDue.dailyFocus[TODAY] = [makeSlot('task-existing-reconcile', { auto: true })]
  assert.ok(API.reconcileTodayFocusSchedule(existingDue, TODAY) > 0, '仅状态变化也必须计入 reconcile 返回，保证启动链落盘')
  assert.strictEqual(existingDueTask.statusId, 'doing-custom')
  return true
})

check('V478-FS-4 ★addManualFocus：done 可显式选入且保持完成；已有 auto 槽被用户选择后清 auto；满额先返回 full、不提前写状态或 dueDate', () => {
  const focus = codeOnly(FOCUS_SUGGEST)
  const manual = fnBody(focus, 'export function addManualFocus(', 'export function addManualTopicFocus(')
  const fullGuard = "if (requested < 0 && freeIndex < 0) return { status: 'full' }"
  const fullAt = manual.indexOf(fullGuard)
  const writeAt = manual.indexOf('const statusWrite = enterFocusTaskStatus(d, task, stamp)', fullAt)

  assert.ok(!manual.includes('if (isTaskDone(d, task)) return'), 'addManualFocus 不得拒绝已完成任务')
  assert.ok(manual.includes('auto: undefined'), '用户显式选择已有 auto 槽必须清除 auto 标记')
  assert.ok(fullAt >= 0 && writeAt > fullAt, '满额判断必须先于新槽状态写入')
  assert.ok(!manual.slice(fullAt, writeAt).includes('scheduleCardDate'), '满额返回前不得提前写 dueDate')
  assert.ok((manual.match(/const statusWrite = enterFocusTaskStatus\(d, task, stamp\)/g) || []).length >= 2, '已有槽与新槽都必须先走统一写入器')

  if (!API) return true

  const doneData = baseData()
  const done = makeTask('task-manual-done', 'done-custom')
  doneData.tasks.push(done)
  const doneResult = API.addManualFocus(doneData, TODAY, 'task-manual-done')
  assert.strictEqual(doneResult.status, 'added')
  assert.strictEqual(done.statusId, 'done-custom')
  assert.strictEqual(done.status, 'done')
  assert.strictEqual(doneData.dailyFocus[TODAY][0].done, true)
  assert.strictEqual(doneData.dailyFocus[TODAY][0].auto, undefined)

  const autoData = baseData()
  const autoTask = makeTask('task-auto-slot')
  autoData.tasks.push(autoTask)
  autoData.dailyFocus[TODAY] = [makeSlot('task-auto-slot', { auto: true })]
  const autoResult = API.addManualFocus(autoData, TODAY, 'task-auto-slot')
  assert.strictEqual(autoResult.status, 'exists')
  assert.strictEqual(autoData.dailyFocus[TODAY][0].auto, undefined)
  assert.strictEqual(autoTask.statusId, 'doing-custom')
  assert.strictEqual(autoTask.status, 'doing')

  const fullData = baseData()
  const fullTasks = ['f1', 'f2', 'f3', 'f4'].map(id => makeTask(id))
  fullData.tasks.push(...fullTasks)
  fullData.dailyFocus[TODAY] = ['f1', 'f2', 'f3'].map((id, index) =>
    makeSlot(id, { id: `focus-${index}`, slotIndex: index }))
  const fullResult = API.addManualFocus(fullData, TODAY, 'f4')
  assert.deepStrictEqual(fullResult, { status: 'full' })
  assert.strictEqual(fullTasks[3].statusId, 'todo-custom')
  assert.strictEqual(fullTasks[3].status, 'todo')
  assert.strictEqual(fullTasks[3].dueDate, undefined)
  return true
})

check('V478-FS-5 ★移出槽位 / 取消排期不回滚状态；restoreFocusTaskStatus 只在显式撤销且当前仍等于 writtenId 时恢复', () => {
  const taskStatus = codeOnly(TASK_STATUS)
  const home = codeOnly(HOME)
  const manager = codeOnly(TASK_MANAGER)
  const restore = fnBody(taskStatus, 'export function restoreFocusTaskStatus(', 'export function toggleTaskDone(')
  const removeSlot = fnBody(home, 'function removeTodaySlot(', 'async function copyFocusToToday')
  const clearFocusDay = fnBody(home, 'function clearTaskFromFocusDay(', 'function restoreTaskToFocusDay(')
  const setWorkDue = fnBody(home, 'async function setTaskWorkDue(', 'function clearTaskWorkDue(')
  const clearWorkDue = fnBody(home, 'function clearTaskWorkDue(', 'function clearTopicFromFocusDay(')
  const setManagerDue = fnBody(manager, 'function setTaskDueDate(', 'function clearTaskDueDate(')
  const clearManagerDue = fnBody(manager, 'function clearTaskDueDate(', 'function toggleTaskCompletion(')

  assert.ok(restore.includes('if (!write?.changed || !write.beforeId || !write.writtenId) return false'), '无写入痕迹不得恢复')
  assert.ok(restore.includes("taskStatusOf(data, task)?.id !== write.writtenId"), '只能恢复仍停在本次 writtenId 的任务')
  assert.ok(!/restoreFocusTaskStatus|enterFocusTaskStatus/.test(removeSlot), '移出槽位不得回滚状态')
  assert.ok(!/restoreFocusTaskStatus|enterFocusTaskStatus/.test(clearFocusDay), '清理槽位不得回滚状态')
  assert.ok(!/restoreFocusTaskStatus/.test(clearWorkDue), '取消排期不得回滚状态')
  assert.ok(!/restoreFocusTaskStatus/.test(clearManagerDue), '任务池取消排期不得回滚状态')

  const workUndoAt = setWorkDue.indexOf("label: '撤销'")
  const workRestoreAt = setWorkDue.indexOf('restoreFocusTaskStatus(d.value, current, focusWrite)')
  assert.ok(workUndoAt >= 0 && workRestoreAt > workUndoAt, '任务工作台的恢复只允许在显式撤销回调里')
  const managerUndoAt = setManagerDue.indexOf("label: '撤销'")
  const managerRestoreAt = setManagerDue.indexOf('restoreFocusTaskStatus(d.value, current, focusWrite)')
  assert.ok(managerUndoAt >= 0 && managerRestoreAt > managerUndoAt, '月历的恢复只允许在显式撤销回调里')

  if (!API) return true

  const d = baseData()
  const task = makeTask('task-restore')
  d.tasks.push(task)
  const write = API.enterFocusTaskStatus(d, task, 501)
  task.statusId = 'todo-custom'
  task.status = 'todo'
  assert.strictEqual(API.restoreFocusTaskStatus(d, task, write, 502), false, '用户已手改 todo 时不得覆盖')
  assert.strictEqual(task.statusId, 'todo-custom')

  const otherDoingData = baseData()
  const otherDoing = makeTask('task-other-doing')
  otherDoingData.tasks.push(otherDoing)
  const otherWrite = API.enterFocusTaskStatus(otherDoingData, otherDoing, 503)
  otherDoing.statusId = 'doing-alt'
  otherDoing.status = 'doing'
  assert.strictEqual(API.restoreFocusTaskStatus(otherDoingData, otherDoing, otherWrite, 504), false, '已切到另一个 doing 状态时不得恢复')
  assert.strictEqual(otherDoing.statusId, 'doing-alt')

  const restoreData = baseData()
  const restoreTask = makeTask('task-restore-ok')
  restoreData.tasks.push(restoreTask)
  const restoreWrite = API.enterFocusTaskStatus(restoreData, restoreTask, 505)
  assert.strictEqual(API.restoreFocusTaskStatus(restoreData, restoreTask, restoreWrite, 506), true)
  assert.strictEqual(restoreTask.statusId, 'todo-custom')
  assert.strictEqual(restoreTask.status, 'todo')
  return true
})

check('V478-FS-6 ★旧脏签名一次性修复：今天槽位内 status=doing 且 statusId 属于 todo 桶 → 实际 doing 状态；版本戳只修一次，用户后来手改 todo 不再覆盖', () => {
  const source = codeOnly(TASK_STATUS)
  const repair = fnBody(source, 'function repairLegacyFocusTaskStatus(', 'export function normalizeTaskStatusDomain')
  const normalize = fnBody(source, 'export function normalizeTaskStatusDomain(', 'export function setTaskStatus(')

  assert.ok(repair.includes('repairedVersion >= FOCUS_TASK_STATUS_REPAIR_VERSION'), '版本戳已达必须直接返回')
  assert.ok(repair.includes('todayFocusTaskIds(data, localDateKey())'), '只扫描今天的三件事槽位')
  assert.ok(repair.includes("task.status !== 'doing' || currentById?.bucket !== 'todo'"), '只命中已知脏签名')
  assert.ok(repair.includes('setTaskStatusById(data, task, doing.id)'), '修复必须写实际 doing 状态 id')
  assert.ok(repair.includes('data.focusTaskStatusRepairVersion = FOCUS_TASK_STATUS_REPAIR_VERSION'), '修完必须落版本戳')
  assert.ok(normalize.includes('repairLegacyFocusTaskStatus(data)'), 'normalize 边界必须调用一次性修复')
  assert.ok(/focusTaskStatusRepairVersion\?:\s*number/.test(MODELS), '修复版本字段必须 optional')
  assert.ok(REPOSITORY.includes('normalizeTaskStatusDomain(data)'), '导入 / 载入 / 云恢复统一走 normalizeAppData')

  if (!API) return true

  const d = baseData()
  const dirty = makeTask('task-dirty', 'todo-custom', { status: 'doing' })
  d.tasks.push(dirty)
  d.dailyFocus[TODAY] = [makeSlot('task-dirty')]
  API.normalizeTaskStatusDomain(d)
  assert.strictEqual(dirty.statusId, 'doing-custom')
  assert.strictEqual(dirty.status, 'doing')
  assert.strictEqual(d.focusTaskStatusRepairVersion, 1)

  dirty.statusId = 'todo-custom'
  dirty.status = 'todo'
  API.normalizeTaskStatusDomain(d)
  assert.strictEqual(dirty.statusId, 'todo-custom', '版本戳后不得再次强制覆盖用户手改状态')
  assert.strictEqual(dirty.status, 'todo')
  return true
})

check('V478-FS-7 ★槽位 / 详情 / 主列表 / 月历 / 项目全景统一读 taskStatusOf；自定义 doing 状态名走 .name，不固定“进行中”', () => {
  const home = codeOnly(HOME)
  const detail = codeOnly(TASK_DETAIL)
  const manager = codeOnly(TASK_MANAGER)
  const calendar = codeOnly(TASK_CALENDAR)
  const project = codeOnly(PROJECT_DRAWER)
  const lane = codeOnly(COMPASS_LANE)
  const panoLane = codeOnly(COMPASS_PANO_LANE)
  const maturity = codeOnly(read('/shared/utils/maturity.ts'))
  const nextStep = codeOnly(read('/newtab/views/compassNextStep.ts'))
  const curationUtils = codeOnly(read('/newtab/views/projectCurationUtils.ts'))

  const slotStatus = fnBody(home, 'function focusSlotStatus(', 'function focusSlotDone(')
  const slotLabel = fnBody(home, 'function focusSlotStatusLabel(', 'function focusSlotStatusIcon(')
  const taskName = fnBody(home, 'function taskStatusNameOf(', 'function taskStatusIconOf(')
  const managerMeta = fnBody(manager, 'function taskStatusMeta(', 'function taskBucketOf(')
  const managerName = fnBody(manager, 'function taskStatusNameOf(', 'function taskStatusIconOf(')
  const calendarDef = fnBody(calendar, 'function taskStatusDef(', 'function taskBucket(')
  const calendarLabel = fnBody(calendar, 'function statusLabel(', 'function projectLabel(')

  assert.ok(slotStatus.includes('taskStatusOf(d.value, task)?.bucket'), '今日槽位状态必须读 taskStatusOf')
  assert.ok(slotLabel.includes('taskStatusOf(d.value, task)') && slotLabel.includes('status.name'), '今日槽位必须显示自定义状态名')
  assert.ok(taskName.includes('taskStatusOf(d.value, task)?.name'), '主列表任务名必须读自定义状态名')
  assert.ok(detail.includes('taskStatusOf(d.value, selectedTask.value)'), '任务详情当前状态必须读 taskStatusOf')
  assert.ok(detail.includes('{{ currentTaskStatus?.name || \'待开始\' }}'), '任务详情必须显示自定义状态名')
  assert.ok(managerMeta.includes('taskStatusOf(d.value, t)') && managerMeta.includes('name: status?.name'), '任务池状态元数据必须读 taskStatusOf 的 name')
  assert.ok(managerName.includes('taskStatusMeta(t).name'), '任务池状态文案必须复用统一状态元数据')
  assert.ok(calendarDef.includes('taskStatusOf({ taskStatuses: props.taskStatuses }, task)'), '月历状态必须读 taskStatusOf')
  assert.ok(calendarLabel.includes('taskStatusDef(task)?.name'), '月历必须显示自定义状态名')
  assert.ok(project.includes('taskStatusOf(store.data!, task)?.name'), '项目全景必须读 taskStatusOf 的自定义状态名')
  assert.ok(lane.includes('taskStatusOf(d.value, t)?.bucket'), 'CompassLane 必须读 taskStatusOf')
  assert.ok(panoLane.includes('taskStatusOf(d.value, t)?.bucket'), 'CompassPanoLane 必须读 taskStatusOf')
  assert.ok(maturity.includes('isTaskDone(data, t)'), '项目/指标成熟度的完成态必须读 isTaskDone')
  assert.ok(maturity.includes("taskStatusOf(d, t)?.bucket === 'doing'"), '项目成熟度的进行中判定必须读 taskStatusOf')
  assert.ok(!/t\.status === '(done|doing)'/.test(maturity), '成熟度不得再按 status 镜像判定完成/进行中')
  assert.ok(nextStep.includes('filter(task => !isTaskDone(data, task))'), '项目下一步必须读 isTaskDone')
  assert.ok(!/task\.status !== 'done'/.test(nextStep), '项目下一步不得回退到 status 镜像')
  assert.ok(curationUtils.includes('rows.filter(t => isTaskDone(data, t))'), '项目策展进度必须读 isTaskDone')
  assert.ok(COMPASS_HOME.includes('focusSlotStatusLabel(c.slot)'), 'CompassHome 模板必须走槽位状态文案')

  if (!API) return true
  const d = baseData()
  const task = makeTask('task-name')
  d.tasks.push(task)
  API.enterFocusTaskStatus(d, task, 601)
  assert.strictEqual(API.taskStatusOf(d, task).name, '推进中')
  assert.notStrictEqual(API.taskStatusOf(d, task).name, '进行中')
  return true
})

check('V478-FS-8 ★任务看板以 statusId 真源分组且不读 task.status 桶；看板状态解析收敛到统一 taskStatusOf（不得保留另一套桶回退）', () => {
  const board = codeOnly(TASK_BOARD)
  const grouped = fnBody(board, 'const grouped = computed(', 'const projectGroups = computed(')
  const isDone = fnBody(board, 'function isDone(', 'function projectLabel(')

  assert.ok(
    /import\s*\{\s*isTaskDone,\s*taskStatusOf\s*\}\s*from\s*'@\/shared\/utils\/taskStatus'/.test(board),
    'TaskBoardView 必须 import 统一 isTaskDone / taskStatusOf',
  )
  assert.ok(grouped.includes('const statusId = taskStatusOf({ taskStatuses: props.statuses }, task)?.id'), '看板分组必须走 taskStatusOf 的实际状态 id')
  assert.ok(isDone.includes('isTaskDone({ taskStatuses: props.statuses }, task)'), '看板完成态必须走 isTaskDone')
  assert.ok(!/\btask\.status\b/.test(board), '看板不得再按 task.status 桶读取')
  assert.ok(!/function\s+statusDefFor\s*\(/.test(board), '看板不得保留本地 statusDefFor 第二套解析')
  assert.ok(!/function\s+statusIdFor\s*\(/.test(board), '看板不得保留本地 statusIdFor 桶回退')
  return true
})

check('V478-FS-9 ★静态写路径清洁：useCompassHome / focusSuggest / ProjectDetailDrawer 无 task.status 直写；scheduleCardDate 只改 dueDate，拖入重点后再改计划日期不重复破坏状态', () => {
  const home = codeOnly(HOME)
  const focus = codeOnly(FOCUS_SUGGEST)
  const project = codeOnly(PROJECT_DRAWER)
  const schedule = fnBody(codeOnly(PLAN_SCHEDULE), 'export function scheduleCardDate(', 'export function removePlanEvent(')
  const manager = codeOnly(TASK_MANAGER)
  const managerDue = fnBody(manager, 'function setTaskDueDate(', 'function clearTaskDueDate(')
  const homeDue = fnBody(home, 'async function setTaskWorkDue(', 'function clearTaskWorkDue(')

  assert.ok(!/\btask\.status\s*=(?!=)/.test(home), 'useCompassHome 不得直接 task.status =')
  assert.ok(!/\btask\.status\s*=(?!=)/.test(focus), 'focusSuggest 不得直接 task.status =')
  assert.ok(!/\btask\.status\s*=(?!=)/.test(project), 'ProjectDetailDrawer 不得直接 task.status =')
  assert.ok(!/\bstatusId\s*=/.test(schedule), 'scheduleCardDate 不得写 statusId')
  assert.ok(!/\.status\s*=(?!=)/.test(schedule), 'scheduleCardDate 不得写状态镜像')
  assert.ok(schedule.includes('card.dueDate = next'), 'scheduleCardDate 的唯一状态相邻写入应是 dueDate')

  const managerElseStart = managerDue.indexOf('} else {')
  const managerElseEnd = managerDue.indexOf('showToast', managerElseStart)
  const managerElse = managerDue.slice(managerElseStart, managerElseEnd < 0 ? undefined : managerElseEnd)
  assert.ok(!/enterFocusTaskStatus|setTaskStatusById|restoreFocusTaskStatus/.test(managerElse), '月历改为非今天只改日期，不得再写/回滚状态')
  const homeElse = homeDue.slice(homeDue.indexOf('if (date !== today && dateChanged)'))
  assert.ok(!/enterFocusTaskStatus|setTaskStatusById/.test(homeElse.slice(0, homeElse.indexOf("label: '撤销'"))), '任务工作台改为非今天只改日期，不得再写状态')

  if (!API) return true
  const d = baseData()
  const task = makeTask('task-schedule-only')
  d.tasks.push(task)
  API.enterFocusTaskStatus(d, task, 701)
  const before = { statusId: task.statusId, status: task.status }
  assert.strictEqual(API.scheduleCardDate(d, task, '2030-01-02', { source: 'calendar' }), true)
  assert.strictEqual(task.dueDate, '2030-01-02')
  assert.strictEqual(task.statusId, before.statusId)
  assert.strictEqual(task.status, before.status)
  assert.strictEqual(API.scheduleCardDate(d, task, '2030-01-03', { source: 'calendar' }), true)
  assert.strictEqual(task.statusId, before.statusId)
  assert.strictEqual(task.status, before.status)
  return true
})

if (!API) {
  console.log(`  ℹ 行为级断言已降级为源码闭包（esbuild 不可用：${loadError || 'missing'}）`)
}
