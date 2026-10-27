import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount, onDeactivated, nextTick, shallowRef } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { visibleFields } from '@/shared/utils/fields'
import type { FieldDef } from '@/shared/models'
import { subscribeSaveError, getLastSaveOkAt, getBytesInUse, hasUnlimitedStorage, saveDataNow } from '@/shared/storage/repository'
import { pendingRows, runSync } from '@/shared/storage/airtable'
import type { SaveError } from '@/shared/storage/repository'
import { showToast } from '@/shared/components/toast'
import type { useCompassHome } from './useCompassHome'

export function useCompassHomeStorage(deps: Pick<ReturnType<typeof useCompassHome>, 'd' | 'pickerOpen' | 'exportOpen' | 'whyOpen' | 'focusMoreOpen' | 'shiftDate' | 'route' | 'router' | 'onDocClickCloseWhy' | 'store'>): {
  tFields: ComputedRef<FieldDef[]>
  taskAssetsOn: ComputedRef<boolean>
  onDateKey: (e: KeyboardEvent) => void
  gotoAnchor: (name: string) => void
  onAnchorEvt: (e: Event) => void
  saveErr: Ref<SaveError | null>
  lastOkTick: Ref<number>
  saveErrSub: (() => void) | null
  storageTimer: number
  storageOk: ComputedRef<boolean>
  ERR_LABEL: Record<string, string>
  storageText: ComputedRef<string>
  timeAgo: (ts: number) => string
  onStorageClick: () => Promise<void>
  atSync: ComputedRef<{ pat: string; baseId: string; tableId: string; tableName?: string; tagColumn?: string; pollEnabled?: boolean; lastSyncAt?: number; lastSyncMs?: number; lastSyncCalls?: number; lastSyncedCount?: number; pendingCount?: number; cursorAt?: number; totalApiCalls?: number; log?: { at: number; msg: string; kind: 'ok' | 'error' | 'info' }[]; lastError?: string } | undefined>
  atConfigured: ComputedRef<boolean>
  atSyncErr: ComputedRef<string>
  atPending: ComputedRef<number>
  atChipText: ComputedRef<string>
  atChipTitle: ComputedRef<string>
  atSyncing: boolean
  onSyncChipClick: () => Promise<void>
} {
  const { d, pickerOpen, exportOpen, whyOpen, focusMoreOpen, shiftDate, route, router, onDocClickCloseWhy, store } = deps
const tFields = computed(() => visibleFields(d.value.fieldConfig, 'task'))
const taskAssetsOn = computed(() => tFields.value.some(f => f.key === 'assets'))

// ================= R2-②：项目调度卡退役 =================
// 指标结构管理归方向台（ProjectCuration 展板 metric-head2 ＋/🗑/AI 与完整方向树指标行齐全，
// R169-16「全站唯一指标结构管理面」语义由二者承接）；「描述｜子任务」双栏由三件事槽内子任务
// 视口（R2-①）承接；单击三件事联动右栏的联动语义随 DeckTabs 单页化退役。
// 退役的机制：项目归属链、四事实统计、指标分组树、分栏拖拽、下钻弹窗、描述子任务双栏——一并退役
// 各类选中/分栏/联动/树编辑机制（连同其函数名）一并退役
// 各类分组/树编辑/关联/下钻/统计与任务删改机制（连同其函数名）一并退役

// ---- Ctrl+←/→ 切换三件事日期（非输入焦点时） ----
function onDateKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if (e.key === 'Escape') {
    if (pickerOpen.value) { pickerOpen.value = false; e.preventDefault(); return }
    if (exportOpen.value) { exportOpen.value = false; e.preventDefault(); return }
    if (whyOpen.value) { whyOpen.value = false; e.preventDefault(); return }
    if (focusMoreOpen.value) { focusMoreOpen.value = false; e.preventDefault(); return }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); shiftDate(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
}
// R67-F4：浏览器模块直达。V3.9.1 起首页不再常驻完整面板，直达改为进入对应二级列表。
watch(() => route.query.hl, (hl) => {
  if (!hl) return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk === 'curio') void router.replace({ path: '/deck/curiosity', query: { hl, hk } })
  else if (hk === 'task') void router.replace({ path: '/deck/task', query: { hl, hk } })
  else if (hk === 'res') void router.replace({ path: '/deck/resource', query: { hl, hk } })
}, { immediate: true })
watch(() => route.query.bottom, (b) => {
  if (b === 'curio') void router.replace('/deck/curiosity')
  else if (b === 'task') void router.replace('/deck/task')
  else if (b === 'pool') void router.replace('/deck/resource')
}, { immediate: true })

function gotoAnchor(name: string) {
  if (name === 'curiosity') { void router.push('/deck/curiosity'); return }
  if (name === 'task') { void router.push('/deck/task'); return }
  const id = name === 'project' ? 'zy-mod-tasks' : ''
  if (!id) return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.remove('anchor-flash')
  requestAnimationFrame(() => el.classList.add('anchor-flash'))
  setTimeout(() => el.classList.remove('anchor-flash'), 2400)
}
function onAnchorEvt(e: Event) { gotoAnchor(String((e as CustomEvent).detail || '')) }
onMounted(() => {
  document.addEventListener('keydown', onDateKey, true)
  document.addEventListener('click', onDocClickCloseWhy, true)
  window.addEventListener('zy-goto-anchor', onAnchorEvt)
  // R172-T9：`loadEventLog()` 随记录族退役 —— 本页不再需要事件日志（仪表盘自取）
  saveErrSub = subscribeSaveError(e => { saveErr.value = e })
  lastOkTick.value = getLastSaveOkAt()
  storageTimer = window.setInterval(() => {
    lastOkTick.value = getLastSaveOkAt()
  }, 30000)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDateKey, true)
  document.removeEventListener('click', onDocClickCloseWhy, true)
  window.removeEventListener('zy-goto-anchor', onAnchorEvt)
  if (saveErrSub) saveErrSub()
  if (storageTimer) clearInterval(storageTimer)
})

// ================= 数据存储状态栏（R50-F2） =================
const saveErr = ref<SaveError | null>(null)
const lastOkTick = ref(0)
let saveErrSub: (() => void) | null = null
let storageTimer = 0
const storageOk = computed(() => !saveErr.value)
const ERR_LABEL: Record<string, string> = { quota: '存储空间已满', serial: '数据序列化失败', unknown: '未知写入错误' }
const storageText = computed(() => saveErr.value
  ? `存储异常 · ${ERR_LABEL[saveErr.value.kind] || '写入失败'}`
  : lastOkTick.value
    ? `本机存储正常 · ${timeAgo(lastOkTick.value)}`
    : '本机存储正常')
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚写入'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前写入`
  return `${Math.floor(diff / 3_600_000)} 小时前写入`
}
async function onStorageClick() {
  if (saveErr.value) {
    try { await saveDataNow(); showToast('已重试写入，存储恢复正常') }
    catch { showToast('重试仍失败，建议导出备份（设置 → 导出数据）') }
    return
  }
  const bytes = await getBytesInUse()
  showToast(`存储正常 · 已用 ${(bytes / 1024).toFixed(0)} KB${hasUnlimitedStorage() ? ' · 不限容量' : ''}`)
}

// ================= Airtable 同步状态卡（R63-9） =================
const atSync = computed(() => store.data?.airtableSync)
const atConfigured = computed(() => !!(atSync.value?.pat && atSync.value?.baseId && atSync.value?.tableId))
const atSyncErr = computed(() => atSync.value?.lastError || '')
const atPending = computed(() => {
  if (!atConfigured.value) return 0
  return pendingRows(store.data!).rows.length
})
const atChipText = computed(() => {
  const s = atSync.value
  if (!atConfigured.value) return '⇄ 未配置同步'
  if (atSyncErr.value) return '⇄ 同步出错'
  if (!s?.lastSyncAt) return `⇄ 待同步 ${atPending.value}`
  const ago = Date.now() - s.lastSyncAt
  const agoText = ago < 3600_000 ? Math.max(1, Math.round(ago / 60000)) + '分钟前' : ago < 86400_000 ? Math.round(ago / 3600_000) + '小时前' : Math.round(ago / 86400_000) + '天前'
  return `⇄ ${agoText}同步${atPending.value ? ` · 待推 ${atPending.value}`: ''}`
})
const atChipTitle = computed(() => {
  const s = atSync.value
  if (!atConfigured.value) return '点击完成 Airtable 连接配置'
  const parts = ['点击立即同步到 Airtable']
  if (s?.lastSyncedCount != null) parts.push(`上次推送 ${s.lastSyncedCount} 条`)
  if (s?.lastSyncCalls != null) parts.push(`调用 ${s.lastSyncCalls} 次`)
  return parts.join('· ')
})
let atSyncing = false
async function onSyncChipClick() {
  // R64-F5：出错态点击 → 直落设置同步分区归因（日志含具体原因），不再盲目重试
  if (!atConfigured.value || atSyncErr.value) { router.push('/settings?page=airtable'); return }
  if (atSyncing) return
  atSyncing = true
  try {
    const r = await runSync(store.data!)
    store.persist()
    showToast(`已同步到 Airtable：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    showToast('同步失败：' + (e instanceof Error ? e.message : String(e)))
  } finally { atSyncing = false }
}

// R51-F10：恢复上下联动布局——三件事居上（视觉焦点），项目调度联动在下；原左右分栏拖拽移除

// ================= R91：主攻速览条（手册「直通调度台速览」的落点） =================
/**
 * R83 性能红线：`projectProgress` / `isProjectStalled` / `projectTasksOf` 内部都要遍历 `d.tasks`，
 * 在模板里对每个主攻各调一次就是 O(主攻数 × 任务数) 每次重渲染。故**预计算成索引**
 * （与 R83 的 `projMeta`、R86 的 `projState` 同款）。主攻上限 2 个，成本可忽略。
 */

  return {
    tFields, taskAssetsOn, onDateKey, gotoAnchor, onAnchorEvt, saveErr, lastOkTick, saveErrSub, storageTimer, storageOk, ERR_LABEL, storageText, timeAgo, onStorageClick, atSync, atConfigured, atSyncErr, atPending, atChipText, atChipTitle, atSyncing, onSyncChipClick,
  }
}
