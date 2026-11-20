/**
 * V4.7.1 · 任务状态数据底座。
 *
 * 锁定 F7/E1 的数据契约：
 *   · TaskStatusDef / TaskStatusBucket / TaskCard.statusId / AppData.taskStatuses；
 *   · 默认三档与兼容层 status；
 *   · 旧数据迁移、悬空引用、重复 id、多完成态与唯一 terminal 收敛；
 *   · 数据包、云同步 manifest/计数/记录类型、三方合并与回执动作；
 *   · 设置页“任务卡字段与状态”及编辑器的改名/改色/排序/增删/设完成态。
 */
const { check, read, exists } = require('./helpers.cjs')

console.log('【V4.7.1 · 任务状态数据底座】')

const MODELS = read('/shared/models/index.ts')
const DEFAULTS = read('/shared/storage/defaults.ts')
const TASK_STATUS = read('/shared/utils/taskStatus.ts')
const LEGACY = read('/shared/storage/legacy-normalize.ts')
const REPOSITORY = read('/shared/storage/repository.ts')
const MIGRATION = read('/shared/storage/migration.ts')
const DATA_PACKAGE = read('/newtab/views/settings/dataPackage.ts')
const RESET = read('/newtab/views/settings/SettingsResetPanel.vue')
const GLOBAL_SETTINGS = read('/newtab/views/GlobalSettings.vue')
const TASK_STATUS_EDITOR = read('/newtab/views/settings/TaskStatusEditor.vue')
const CLOUD_SYNC = read('/shared/cloud/sync.ts')
const CLOUD_MERGE = read('/shared/cloud/threeWayMerge.ts')
const CLOUD_ACTIONS = read('/shared/cloud/syncActions.ts')

check('V471-1 ★任务状态契约：三桶枚举、状态定义、TaskCard.statusId 与 AppData.taskStatuses 均为业务数据', () => {
  return MODELS.includes("export type TaskStatusBucket = 'todo' | 'doing' | 'done'")
    && MODELS.includes('export interface TaskStatusDef')
    && MODELS.includes('bucket: TaskStatusBucket')
    && MODELS.includes('terminal?: boolean')
    && MODELS.includes('statusId?: ID')
    && MODELS.includes('status: \'todo\' | \'doing\' | \'done\'')
    && MODELS.includes('taskStatuses: TaskStatusDef[]')
})

check('V471-2 ★默认三档固定 ID/颜色/顺序，仅 task-done 为完成态', () => {
  return DEFAULTS.includes('export function defaultTaskStatuses()')
    && DEFAULTS.includes("id: 'task-todo'")
    && DEFAULTS.includes("name: '待开始'")
    && DEFAULTS.includes("color: '#6F7C86'")
    && DEFAULTS.includes("id: 'task-doing'")
    && DEFAULTS.includes("color: '#0F6F9E'")
    && DEFAULTS.includes("id: 'task-done'")
    && DEFAULTS.includes("color: '#168457'")
    && DEFAULTS.includes("bucket: 'done', terminal: true")
    && DEFAULTS.includes('taskStatuses: defaultTaskStatuses()')
})

check('V471-3 ★taskStatus 工具齐备：排序/取状态/设状态/切换完成/归一化，并保持旧 status 兼容写入', () => {
  return TASK_STATUS.includes('export function sortedTaskStatuses(')
    && TASK_STATUS.includes('export function taskStatusOf(')
    && TASK_STATUS.includes('export function taskStatusById(')
    && TASK_STATUS.includes('export function taskTerminalStatus(')
    && TASK_STATUS.includes('export function taskInProgressStatus(')
    && TASK_STATUS.includes('export function isTaskDone(')
    && TASK_STATUS.includes('export function setTaskStatusById(')
    && TASK_STATUS.includes('export function toggleTaskDone(')
    && TASK_STATUS.includes('export function normalizeTaskStatusDomain(')
    && TASK_STATUS.includes('export function setTaskStatus(')
    && TASK_STATUS.includes('export function toggleTaskStatus(')
    && TASK_STATUS.includes('task.status = next.bucket')
    && TASK_STATUS.includes('task.status = current.bucket')
})

check('V471-4 ★归一化修复重复 id/非法颜色/缺失列表/悬空 statusId，并强制唯一完成态属于 done 桶', () => {
  return TASK_STATUS.includes('seen.has(status.id)')
    && TASK_STATUS.includes("/^#[0-9a-f]{6}$/i")
    && TASK_STATUS.includes('data.taskStatuses = statuses.length ? statuses : defaultTaskStatuses()')
    && TASK_STATUS.includes("status.bucket = status.bucket === 'todo' || status.bucket === 'doing' || status.bucket === 'done'")
    && TASK_STATUS.includes("const terminal = doneStatuses.find(status => status.id === 'task-done' && status.terminal)")
    && TASK_STATUS.includes('for (const status of data.taskStatuses) status.terminal = status.id === terminal.id')
    && TASK_STATUS.includes('const fallback = fallbackStatusForBucket(ordered, task.status || \'todo\')')
    && TASK_STATUS.includes('task.status = current.bucket')
    && TASK_STATUS.includes('task.completedAt = task.updatedAt || Date.now()')
    && TASK_STATUS.includes('task.completedAt = undefined')
})

check('V471-5 ★旧库/导入/云恢复共用归一化；V1 迁移写 taskStatuses 与 task-* statusId', () => {
  return LEGACY.includes('normalizeTaskStatusDomain(d)')
    && REPOSITORY.includes('normalizeTaskStatusDomain(data)')
    && REPOSITORY.includes('data.taskStatuses = Array.isArray(data.taskStatuses)')
    && REPOSITORY.includes('taskStatuses: mergeByIdArr(')
    && MIGRATION.includes('taskStatuses: defaults.taskStatuses')
    && MIGRATION.includes("statusId: status === 'done' ? 'task-done'")
})

check('V471-6 ★云同步新增 taskStatus 记录类型、计数与字段指纹；任务卡同步 statusId/statusBeforeDone', () => {
  return CLOUD_SYNC.includes("| 'topicResourceLink' | 'topicStatus' | 'taskStatus'")
    && CLOUD_SYNC.includes('taskStatuses: number')
    && CLOUD_SYNC.includes('taskStatuses: 0')
    && CLOUD_SYNC.includes("manifestRecord('taskStatus'")
    && CLOUD_SYNC.includes("taskStatus: ['name', 'color', 'order', 'bucket', 'terminal']")
    && CLOUD_SYNC.includes("'statusId', 'status', 'statusBeforeDone'")
    && CLOUD_SYNC.includes('+ counts.taskStatuses')
})

check('V471-7 ★三方合并识别 taskStatuses，合并结果统一归一化；回执行支持 taskStatus 增删恢复', () => {
  return CLOUD_MERGE.includes("taskStatuses: 'taskStatus'")
    && CLOUD_MERGE.includes("taskStatus: '任务状态'")
    && CLOUD_MERGE.includes('normalizeTaskStatusDomain(next)')
    && CLOUD_ACTIONS.includes("'taskStatus'")
    && CLOUD_ACTIONS.includes("case 'taskStatus': return byId(data.taskStatuses)")
    && CLOUD_ACTIONS.includes("case 'taskStatus': return arrayLocation(data.taskStatuses")
    && CLOUD_ACTIONS.includes('normalizeTaskStatusDomain(data)')
})

check('V471-8 ★数据包导出/合并与一键回滚包含 taskStatuses', () => {
  return DATA_PACKAGE.includes('taskStatuses: Array.isArray(data.taskStatuses)')
    && DATA_PACKAGE.includes('d.taskStatuses = mergeById(')
    && DATA_PACKAGE.includes('imported.taskStatuses || []')
    && RESET.includes('store.data!.taskStatuses = fresh.taskStatuses')
})

check('V471-9 ★设置页入口为“任务卡字段与状态”并挂载 TaskStatusEditor', () => {
  return GLOBAL_SETTINGS.includes('任务卡字段与状态')
    && GLOBAL_SETTINGS.includes("import TaskStatusEditor from './settings/TaskStatusEditor.vue'")
    && GLOBAL_SETTINGS.includes('<TaskStatusEditor />')
    && exists('/newtab/views/settings/TaskStatusEditor.vue')
})

check('V471-10 ★编辑器支持改名/改色/排序/新增语义桶/删除迁移/设完成态，并说明云同步与唯一完成态', () => {
  return TASK_STATUS_EDITOR.includes('function rename(')
    && TASK_STATUS_EDITOR.includes('function recolor(')
    && TASK_STATUS_EDITOR.includes('function move(')
    && TASK_STATUS_EDITOR.includes('function addStatus(')
    && TASK_STATUS_EDITOR.includes('function removeStatus(')
    && TASK_STATUS_EDITOR.includes('function setTerminal(')
    && TASK_STATUS_EDITOR.includes('draftBucket')
    && TASK_STATUS_EDITOR.includes('正在被 ${affectedLive.length} 张任务卡使用')
    && TASK_STATUS_EDITOR.includes('setTaskStatusById(store.data!, task, fallback.id)')
    && TASK_STATUS_EDITOR.includes('随云同步')
    && TASK_STATUS_EDITOR.includes('完成态有且只有一个')
})
