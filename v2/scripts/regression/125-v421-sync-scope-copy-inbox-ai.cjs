/**
 * V4.2.1 · 云同步成功回执、业务数据边界、今日三件事复制、Inbox 行内操作与 AI 连接状态。
 *
 * 这些断言只锁用户确认过的行为，不把实现细节当成产品承诺：
 * - 同步成功后，辅助回执失败不能把状态误报成断线；
 * - 云快照只承载业务数据，界面偏好留在本机；
 * - 今日三件事复制文案必须逐字固定，缺项目或指标时不可生成半截句子；
 * - 完整 Inbox 行可直接转化 / 打开 / 编辑 / 删除；
 * - 拉取模型成功时显示成功态，而不是沿用错误态。
 */
const { check, read } = require('./helpers.cjs')

console.log('【V4.2.1 · 云同步边界 / 今日复制 / Inbox 行内操作 / AI 状态】')

check('V421-1 ★同步成功后辅助回执失败仍保持成功：undefined 载荷安全降级为只读，上传 / 拉回 / 无变更都先落一致性再生成明细', () => {
  const actions = read('/shared/cloud/syncActions.ts')
  const hook = read('/newtab/composables/useCloudSync.ts')
  const sync = read('/shared/cloud/sync.ts')
  return actions.includes('function cloneValue<T>(value: T | null | undefined): T | null')
    && actions.includes('if (value === null || value === undefined) return null')
    && actions.includes('function readonlyOne(')
    && actions.includes('return readonlyOne(receipt, row, error)')
    && hook.includes('async function recordReceiptBestEffort(')
    && hook.includes('await settleInSync(uploaded.revision, uploaded.fingerprint, captured.mutationSeq)')
    && hook.includes('await recordReceiptBestEffort(receipt, uploaded.beforeState, captured.snapshot)')
    && hook.includes('await settleInSync(downloaded.revision, downloaded.fingerprint, repository.getMutationSeq())')
    && hook.includes('await recordReceiptBestEffort(receipt, beforeSnapshot.snapshot, {')
    && sync.includes("throw new Error('云端暂无快照')")
})

check('V421-2 ★云同步只收业务数据：sanitizeCloudSnapshot 固定 ui:null，指纹不含 UIPrefs，保存本地界面偏好不再推高待上传序号', () => {
  const sync = read('/shared/cloud/sync.ts')
  const repo = read('/shared/storage/repository.ts')
  const mergeStart = repo.indexOf('function mergeExternalUIPrefs')
  const saveStart = repo.indexOf('export function saveUIPrefs')
  const mergeEnd = saveStart
  const saveEnd = repo.indexOf('\n}', saveStart)
  const mergeBody = mergeStart >= 0 && mergeEnd > mergeStart ? repo.slice(mergeStart, mergeEnd) : ''
  const saveBody = saveStart >= 0 && saveEnd > saveStart ? repo.slice(saveStart, saveEnd) : ''
  return sync.includes('const CLOUD_SYNC_SCOPE_VERSION = 2')
    && sync.includes('export function sanitizeCloudSnapshot(snapshot: SnapshotState): SnapshotState')
    && sync.includes('return { data: clean.data, ui: null, eventLog: clean.eventLog }')
    && sync.includes('const input = stableStringify(clean.data)')
    && !sync.includes('stableStringify({ data: clean.data, ui: clean.ui })')
    && sync.includes("syncScopeVersion: CLOUD_SYNC_SCOPE_VERSION")
    && mergeBody.length > 0 && !mergeBody.includes('markDataDirty()')
    && saveBody.length > 0 && !saveBody.includes('markDataDirty()')
    && sync.includes("dailyFocus: preserveDailyFocus(d.dailyFocus)")
    && sync.includes("focusAutoDate: d.focusAutoDate")
})

check('V421-3 ★今日三件事复制文案逐字固定：只拼接「推进[[{项目}]]项目，{任务}，助力【{指标}】指标落实到位」，缺任一字段返回空串并禁用行内复制', () => {
  const copy = read('/shared/utils/focusCopy.ts')
  const home = read('/newtab/views/CompassHome.vue')
  const hook = read('/newtab/views/useCompassHome.ts')
  return copy.includes('export interface DailyFocusCopyInput')
    && copy.includes('任一层级缺失时返回空串')
    && copy.includes('if (!project || !metric || !task) return')
    && copy.includes('推进[[${project}]]项目，${task}，助力【${metric}】指标落实到位')
    && hook.includes('projectTitleOfTask')
    && hook.includes('metricTitleOfTask')
    && hook.includes('function focusCopyReason(cell: FocusCell)')
    && hook.includes('任务未关联有效项目，复制内容不可生成')
    && hook.includes('任务未关联有效成功指标，复制内容不可生成')
    && home.includes(':disabled="!focusCopyText(c)"')
    && home.includes(':title="focusCopyReason(c)"')
    && home.includes('@click.stop="copyFocusText(c)"')
})

check('V421-4 ★Inbox 完整列表行内直接处理：三卡转化、打开原链、编辑、删除都在当前行出现，不需要先进入二级详情', () => {
  const panel = read('/newtab/components/compass/InboxPanel.vue')
  const home = read('/newtab/views/CompassHome.vue')
  return panel.includes('class="inbox-actions"')
    && panel.includes('@click.stop="convert(item, \'task\')"')
    && panel.includes('@click.stop="convert(item, \'curiosity\')"')
    && panel.includes('@click.stop="convert(item, \'resource\')"')
    && panel.includes('@click.stop="openSource(item)"')
    && panel.includes('@click.stop="openItemNow(item)"')
    && panel.includes('@click.stop="remove(item)"')
    && home.includes('class="mini-inbox-actions"')
    && home.includes("convertPreviewInbox(item, 'task')")
    && home.includes("convertPreviewInbox(item, 'curiosity')")
    && home.includes("convertPreviewInbox(item, 'resource')")
    && home.includes('openPreviewInboxSource(item)')
    && !home.includes('进入 Inbox 处理')
})

check('V421-5 ★AI 助手状态与结果分离：成功 / 警告 / 错误有独立 tone，模型列表成功显示绿色勾且不再出现错误 X；只有错误态显示再次测试', () => {
  const panels = read('/newtab/views/useGlobalSettingsPanels.ts')
  const view = read('/newtab/views/GlobalSettings.vue')
  const css = read('/newtab/views/settings/GlobalSettings.css')
  return panels.includes("export type AiFeedbackKind = 'idle' | 'success' | 'warning' | 'error'")
    && panels.includes("const aiMsgKind = ref<AiFeedbackKind>('idle')")
    && panels.includes("aiMsgKind.value = aiModels.value.length ? 'success' : 'warning'")
    && panels.includes("aiMsgKind.value = 'error'")
    && panels.includes("已获取 ${aiModels.value.length} 个模型，请选择或填写模型")
    && panels.includes("aiMsg.value = `连接已验证：${await aiTestConnection()}`")
    && !panels.includes("aiMsg.startsWith('')")
    && !panels.includes("return '❌ ' + t")
    && view.includes('class="ai-msg" :class="aiMsgKind"')
    && view.includes("aiMsgKind === 'success' ? 'check' : 'warn'")
    && view.includes("v-if=\"aiMsgKind === 'error' && aiReady\"")
    && css.includes('.ai-msg.success')
    && css.includes('.ai-msg.warning')
    && css.includes('.ai-msg.error')
})
