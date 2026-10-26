<script setup lang="ts">
/**
 * 设置 · 数据管理（V3.9.23）
 *
 * 合并原「导入数据 / 导出数据 / Airtable 同步」三个一级导航，内部用分段切换：
 * 数据包 / 书签导入 / 附件管理 / Airtable。数据包导入导出共用 dataPackage.ts；
 * 附件本体只在「附件管理」读取，普通数据包不碰 Blob。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { saveUIPrefs, loadUIPrefs } from '@/shared/storage/repository'
import { testConnection, runSync, quotaHint, DEFAULT_TAG_COLUMN } from '@/shared/storage/airtable'
import { getAllAssetIndex, cleanupOrphanAssetsOf } from '@/shared/storage/assets'
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import DataCheckupCard from '../../components/DataCheckupCard.vue'
import { downloadFile, dateStr } from './io-utils'
import {
  applyDataPackageUIPrefs,
  buildDataPackage,
  buildSafeBackup,
  mergeDataPackage,
  readDataPackageEventLog,
  validateDataPackage,
  type DataPackage
} from './dataPackage'
import {
  buildAssetPack,
  collectAssetRows,
  filterAssetRows,
  importAssetPack,
  orphanAssetRows,
  type AssetOwnerKind,
  type AssetRow
} from './assetPack'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import type { AssetMeta } from '@/shared/models'

const props = defineProps<{
  formatBytes: (n: number) => string
  aiReady: boolean
  aiEnrichIds: (ids: Set<string>) => void
  initialTab?: 'package' | 'bookmark' | 'assets' | 'airtable'
}>()

const store = useAppStore()
type DataTab = 'package' | 'bookmark' | 'assets' | 'airtable'
const tab = ref<DataTab>(props.initialTab || 'package')
const gd = computed(() => store.data!)
watch(() => props.initialTab, v => { if (v) tab.value = v })

// ---- 数据包 ----
const packageInput = ref<HTMLInputElement | null>(null)
const assetPackInput = ref<HTMLInputElement | null>(null)
const bookmarkInput = ref<HTMLInputElement | null>(null)
const bookmarkTargetWs = ref('__new__')
const pendingImportEnrich = ref<string[] | null>(null)
const importReceipt = ref('')

/** 返回带事件日志的完整数据包；导出和导入前备份共用。 */
async function currentPackage(): Promise<DataPackage> {
  const log = await readDataPackageEventLog()
  let ui: Record<string, unknown> | undefined
  try { ui = await loadUIPrefs() as unknown as Record<string, unknown> } catch { ui = undefined }
  return buildDataPackage(store.data!, log, ui)
}

async function exportPackage() {
  try {
    const pkg = await currentPackage()
    downloadFile(`zhiyuan_data_package_${dateStr()}.json`, JSON.stringify(pkg, null, 2))
    const exportedAt = Date.now()
    lastBackupAt.value = exportedAt
    saveUIPrefs({ lastBackupAt: exportedAt })
    showToast(`知源数据包已导出（含最近 ${pkg.eventLog?.length || 0} 条事件）`)
  } catch (e) {
    showToast('数据包导出失败：' + (e instanceof Error ? e.message : '未知错误'))
  }
}

function triggerPackageImport() { packageInput.value?.click() }

async function handlePackageImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let pkg: DataPackage | null = null
  try { pkg = validateDataPackage(JSON.parse(await file.text())) } catch { pkg = null }
  if (!pkg) { showToast('数据版本不兼容（需 v2 格式），已取消导入'); return }
  try {
    const backup = buildSafeBackup(store.data!, await readDataPackageEventLog())
    downloadFile(`zhiyuan_auto_backup_before_import_${dateStr()}.json`, JSON.stringify(backup, null, 2))
  } catch (e) {
    console.warn('[zy] 导入前自动备份失败', e)
    if (!(await useConfirm({ title: '自动备份失败', message: '导入前备份未能下载。继续导入可能覆盖/合并现有数据，且没有本次安全备份。', confirmText: '仍然导入' }))) return
  }
  const r = await mergeDataPackage(pkg, store.data!)
  const uiApplied = applyDataPackageUIPrefs(pkg.uiPrefs)
  store.persist()
  importReceipt.value = `卡片 ${r.cards} · 方向 ${r.dirs} · 策展台 ${r.ws} · 事件 ${r.eventImported}/${r.eventKept}${uiApplied ? ' · 界面偏好已应用' : ''}`
  showToast(`数据包导入完成：${importReceipt.value}${r.catFix ? '；' + r.catFix : ''}${r.thesisClear ? `；中心论点净化 ${r.thesisClear}` : ''}`)
}

// ---- 书签导入 ----
const bookmarkBusy = ref(false)
async function handleBookmarkFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  bookmarkBusy.value = true
  try {
    const { useBookmarkImport } = await import('@/newtab/composables/useBookmarkImport')
    const api = useBookmarkImport({ d: gd, persist: () => store.persist() })
    const fakeEvent = { target: { files: [file], value: '' } } as unknown as Event
    const ids = await api.handleBookmarkImport(fakeEvent, bookmarkTargetWs.value)
    if (ids.length) pendingImportEnrich.value = ids
  } finally { bookmarkBusy.value = false }
}

function aiImportEnrichNow() {
  const ids = pendingImportEnrich.value
  if (!ids?.length) return
  pendingImportEnrich.value = null
  props.aiEnrichIds(new Set(ids))
}

// ---- 附件管理 ----
const assetRows = ref<AssetRow[]>([])
const assetIndexCount = ref(0)
const assetIndexBytes = ref(0)
const assetLoading = ref(false)
const assetPacking = ref(false)
const assetPackProgress = ref({ done: 0, total: 0 })
const assetQuery = ref('')
const assetKind = ref<'all' | AssetMeta['kind']>('all')
const assetStorage = ref<'all' | 'ok' | 'missing'>('all')
const assetOwnerKind = ref<'all' | AssetOwnerKind>('all')

const filteredAssetRows = computed(() =>
  filterAssetRows(assetRows.value, assetQuery.value, assetKind.value, assetStorage.value, assetOwnerKind.value)
)
async function refreshAssetRows() {
  assetLoading.value = true
  try {
    const index = await getAllAssetIndex()
    assetIndexCount.value = index.length
    assetIndexBytes.value = index.reduce((s, x) => s + x.size, 0)
    const rows = collectAssetRows(gd.value, index)
    assetRows.value = [...rows, ...orphanAssetRows(index, rows)]
  } catch (e) {
    console.error('[assets] refresh failed:', e)
    showToast('附件列表读取失败，请重试')
  } finally { assetLoading.value = false }
}

async function packAssets() {
  if (!assetRows.value.length) { showToast('暂无附件可打包'); return }
  assetPacking.value = true
  assetPackProgress.value = { done: 0, total: assetRows.value.filter(r => r.storage === 'ok').length }
  try {
    const { blob, manifest, missing } = await buildAssetPack(assetRows.value, (done, total) => {
      assetPackProgress.value = { done, total }
    })
    if (!manifest.count) { showToast('附件本体均缺失，无法生成附件包'); return }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `zhiyuan_attachments_${dateStr()}.zip`; a.click()
    URL.revokeObjectURL(url)
    showToast(`附件包已导出：${manifest.count} 个附件${missing ? `，${missing} 个本体缺失已跳过` : ''}`)
  } catch (e) {
    console.error('[assets] pack failed:', e)
    showToast('附件包导出失败：' + (e instanceof Error ? e.message : '未知错误'))
  } finally { assetPacking.value = false }
}

async function handleAssetPackImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const r = await importAssetPack(file, gd.value)
    if (r.linked) store.persist()
    await refreshAssetRows()
    const reasons: string[] = []
    if (r.skippedMissingOwner) reasons.push(`${r.skippedMissingOwner} 个所属卡片不存在`)
    if (r.skippedMissingFile) reasons.push(`${r.skippedMissingFile} 个本体缺失`)
    if (r.skippedInvalid) reasons.push(`${r.skippedInvalid} 个清单无效`)
    const msg = `附件包导入完成：成功 ${r.imported} 个，未导入 ${r.skipped} 个${reasons.length ? '（' + reasons.join('；') + '）' : ''}${r.overwritten ? `；覆盖 ${r.overwritten} 个` : ''}${r.linked ? `；补回卡片关联 ${r.linked} 个` : ''}`
    await useConfirm({ title: '附件包导入结果', message: msg, confirmText: '知道了', danger: false })
    showToast(msg)
  } catch (e) {
    showToast('附件包导入失败：' + (e instanceof Error ? e.message : '格式不符'))
  }
}

async function cleanupOrphans() {
  const refs = new Set<string>()
  const all = await getAllAssetIndex()
  // 主数据里被引用的 id 才保留；回收站卡也还在 arrays 里，所以 collectReferenced 会算进去
  const { collectReferencedAssetIds } = await import('@/shared/storage/assets')
  collectReferencedAssetIds(gd.value).forEach(id => refs.add(id))
  const orphans = all.filter(x => !refs.has(x.id))
  if (!orphans.length) { showToast('无孤儿附件，一切干净'); return }
  if (!(await useConfirm({ title: '清理孤儿附件', message: `共发现 ${orphans.length} 个未被任何卡片引用的附件本体。清理后不可恢复。`, confirmText: `清理 ${orphans.length} 个` }))) return
  try {
    const n = await cleanupOrphanAssetsOf(gd.value)
    await refreshAssetRows()
    showToast(n ? `已清理 ${n} 个孤儿附件` : '无孤儿附件，一切干净')
  } catch (e) { showToast('清理失败：' + (e instanceof Error ? e.message : '未知错误')) }
}

// ---- Airtable ----
const atBusy = ref(false)
const atTableName = ref('')
const atPat = ref('')
const atBaseId = ref('')
const atTableId = ref('')
const atTagColumn = ref('')
const atTagColumnDefault = DEFAULT_TAG_COLUMN
let atTagTouched = false
function applyTagColumn() {
  const st = store.data?.airtableSync
  atTagTouched = true
  if (!st) return
  st.tagColumn = atTagColumn.value.trim()
  store.persist()
}
const atPatSaved = ref(false)
watch(() => store.data?.airtableSync, s => {
  if (!s) return
  if (s.pat) atPatSaved.value = true
  if (!atBaseId.value) atBaseId.value = s.baseId
  if (!atTableId.value) atTableId.value = s.tableId
  if (s.tableName && !atTableName.value) atTableName.value = s.tableName
  if (!atTagTouched && s.tagColumn) atTagColumn.value = s.tagColumn
}, { immediate: true })
function syncAtConfig() {
  const s = store.data!.airtableSync!
  const typedPat = atPat.value.trim()
  if (typedPat) s.pat = typedPat
  s.baseId = atBaseId.value.trim()
  s.tableId = atTableId.value.trim()
  store.persist()
}
const atCredReady = computed(() => !!atPat.value.trim() || atPatSaved.value)
/** 只在「填了但格式不对」时提示；未填交给徽章显示未连接，不制造噪声。 */
const atFieldErr = computed<Record<string, string>>(() => {
  const e: Record<string, string> = {}
  const pat = atPat.value.trim()
  const base = atBaseId.value.trim()
  const tbl = atTableId.value.trim()
  if (pat && !pat.startsWith('pat')) e.pat = 'PAT 以 pat 开头——请从 Airtable 账户页「创建令牌」后整段复制'
  if (base && !base.startsWith('app')) e.base = 'Base ID 以 app 开头——在表 URL 的 /appXXXX/ 段里'
  if (tbl && !tbl.startsWith('tbl')) e.tbl = 'Table ID 以 tbl 开头——在表 URL 的 /tblXXXX/ 段里'
  return e
})
const atPoll = computed(() => !!store.data?.airtableSync?.pollEnabled)
const atLog = computed(() => store.data?.airtableSync?.log || [])
const quotaText = computed(() => quotaHint(store.data!.airtableSync!))
const atStatusText = computed(() => {
  const s = store.data!.airtableSync
  if (!s?.lastSyncAt) return ''
  const parts = [new Date(s.lastSyncAt).toLocaleString('zh-CN')]
  if (s.lastSyncedCount != null) parts.push(`推送 ${s.lastSyncedCount} 条`)
  if (s.lastSyncMs != null) parts.push(`耗时 ${(s.lastSyncMs / 1000).toFixed(1)}s`)
  if (s.lastSyncCalls != null) parts.push(`调用 ${s.lastSyncCalls} 次`)
  return parts.join('· ')
})
const atBadge = computed(() => {
  const s = store.data!.airtableSync
  if (s?.lastError) return { cls: 'error', label: '推送异常' }
  if (atTableName.value || s?.tableName) return { cls: 'connected', label: '已连接' }
  return { cls: 'idle', label: '未连接' }
})
async function testAtConnection() {
  if (atBusy.value) return
  atBusy.value = true
  try {
    syncAtConfig()
    const name = await testConnection(store.data!.airtableSync!)
    atTableName.value = name
    store.data!.airtableSync!.tableName = name
    store.persist()
    showToast('连接成功：' + name)
  } catch (e) { showToast(String(e instanceof Error ? e.message : e)) } finally { atBusy.value = false }
}
async function runAtSync() {
  if (atBusy.value) return
  if (!atCredReady.value || !atBaseId.value.trim() || !atTableId.value.trim()) { showToast('请先填写完整连接配置'); return }
  atBusy.value = true
  try {
    syncAtConfig()
    const r = await runSync(store.data!)
    store.persist()
    showToast(`同步完成：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) { store.persist(); showToast('同步失败：' + String(e instanceof Error ? e.message : e)) } finally { atBusy.value = false }
}
function toggleAtPoll() {
  const s = store.data!.airtableSync!
  s.pollEnabled = !s.pollEnabled
  store.persist()
  showToast(s.pollEnabled ? '已开启 3 小时自动轮询' : '已关闭自动轮询')
}

// ---- 备份提醒 ----
const backupReminderEnabled = ref(store.ui?.backupReminderEnabled !== false)
const lastBackupAt = ref<number | undefined>(store.ui?.lastBackupAt)
function toggleBackupReminder(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  backupReminderEnabled.value = checked
  saveUIPrefs({ backupReminderEnabled: checked })
}
function backupAgo(ts?: number) {
  if (!ts) return '尚无导出记录'
  const day = Math.floor((Date.now() - ts) / 86400000)
  if (day <= 0) return '今天'
  if (day === 1) return '昨天'
  if (day < 30) return `${day} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

onMounted(() => { void refreshAssetRows() })
watch(tab, v => { if (v === 'assets') void refreshAssetRows() })
</script>

<template>
<div class="gs-panel">
  <div class="gs-page-header">
    <div class="gs-page-title"><Icon name="database" :size="13"/> 数据管理</div>
    <div class="gs-page-desc">数据包备份迁移 · 书签导入 · 附件整体迁移 · Airtable 单向同步</div>
  </div>

  <div class="dm-tabs">
    <button class="dm-tab" :class="{ on: tab === 'package' }" @click="tab = 'package'">数据包</button>
    <button class="dm-tab" :class="{ on: tab === 'bookmark' }" @click="tab = 'bookmark'">书签导入</button>
    <button class="dm-tab" :class="{ on: tab === 'assets' }" @click="tab = 'assets'">附件管理</button>
    <button class="dm-tab" :class="{ on: tab === 'airtable' }" @click="tab = 'airtable'">Airtable</button>
  </div>

  <!-- 数据包 -->
  <template v-if="tab === 'package'">
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">备份提醒</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row">
          <span class="gs-sr-label">自动提醒</span>
          <div class="gs-sr-control">
            <span class="gs-sr-hint">30 天未导出或超过 50 MB 时提醒 · 上次导出：{{ backupAgo(lastBackupAt) }}</span>
            <label class="gs-switch"><input type="checkbox" :checked="backupReminderEnabled" @change="toggleBackupReminder" /><span class="gs-switch-slider"></span></label>
          </div>
        </div>
      </div>
    </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">知源调度台数据包</span><span class="gs-card-desc">唯一通用导出；含最近 5000 条事件，不含附件本体与 Airtable 凭证</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row">
          <span class="gs-sr-label">导出数据包</span>
          <div class="gs-sr-control">
            <button class="gs-btn gs-btn-primary" @click="exportPackage"><Icon name="upload" :size="13"/> 导出知源调度台数据包</button>
          </div>
        </div>
        <div class="gs-setting-row gs-setting-row--top">
          <span class="gs-sr-label">导入数据包</span>
          <div class="gs-sr-control gs-sr-control-wrap">
            <span class="gs-sr-hint">JSON 全量包；按 ID 并集合并。导入前会自动下载当前数据备份（不含 Airtable 凭证）。</span>
            <button class="gs-btn" @click="triggerPackageImport">选择文件</button>
          </div>
        </div>
        <div v-if="importReceipt" class="gs-setting-row">
          <span class="gs-sr-label">最近回执</span><div class="gs-sr-control gs-sr-note">{{ importReceipt }}</div>
        </div>
      </div>
    </div>
    <DataCheckupCard />
  </template>

  <!-- 书签导入 -->
  <template v-else-if="tab === 'bookmark'">
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">浏览器书签 HTML</span><span class="gs-card-desc">不读取浏览器标签页；文件夹层级写入标签</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row">
          <span class="gs-sr-label">导入书签</span>
          <div class="gs-sr-control">
            <button class="gs-btn gs-btn-primary" :disabled="bookmarkBusy" @click="bookmarkInput?.click()">{{ bookmarkBusy ? '导入中…' : '选择书签 HTML' }}</button>
          </div>
        </div>
        <div class="gs-setting-row">
          <span class="gs-sr-label">导入到</span>
          <div class="gs-sr-control">
            <select class="gs-select" v-model="bookmarkTargetWs">
              <option value="__new__">新建「书签导入 &lt;今天日期&gt;」策展台</option>
              <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
            </select>
          </div>
        </div>
        <div v-if="pendingImportEnrich?.length" class="gs-setting-row gs-setting-row--gap">
          <span class="gs-sr-label">刚导入 {{ pendingImportEnrich.length }} 张卡</span>
          <div class="gs-sr-control">
            <button class="gs-btn" :disabled="!props.aiReady" @click="aiImportEnrichNow">{{ props.aiReady ? '归类并补全这批' : '先在 AI 助手完成接入' }}</button>
            <button class="gs-btn" @click="pendingImportEnrich = null">这次不用</button>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- 附件管理 -->
  <template v-else-if="tab === 'assets'">
    <div class="gs-card">
      <div class="gs-card-header">
        <span class="gs-card-title"><Icon name="paperclip" :size="12"/> 附件管理</span>
        <span class="gs-card-desc">{{ assetIndexCount }} 个 · {{ props.formatBytes(assetIndexBytes) }} · 本体在 IndexedDB</span>
      </div>
      <div class="gs-card-body">
        <div class="dm-tools">
          <input v-model="assetQuery" class="gs-input dm-search" placeholder="搜索附件名 / 所属卡片" />
          <select v-model="assetKind" class="gs-select"><option value="all">全部类型</option><option value="image">图片</option><option value="pdf">PDF</option><option value="html">HTML</option></select>
          <select v-model="assetStorage" class="gs-select"><option value="all">全部状态</option><option value="ok">正常</option><option value="missing">本体缺失</option></select>
          <select v-model="assetOwnerKind" class="gs-select"><option value="all">全部卡片</option><option value="resource">资源卡</option><option value="task">任务卡</option><option value="curiosity">好奇心卡</option><option value="argument">论证卡</option></select>
          <button class="gs-btn" @click="refreshAssetRows">{{ assetLoading ? '读取中…' : '刷新' }}</button>
          <button class="gs-btn gs-btn-primary" :disabled="assetPacking || !assetIndexCount" @click="packAssets">{{ assetPacking ? `打包中 ${assetPackProgress.done}/${assetPackProgress.total}` : '全部附件整体打包下载' }}</button>
          <button class="gs-btn" @click="assetPackInput?.click()">导入附件包</button>
        </div>
        <div class="dm-asset-head"><span>附件</span><span>所属卡片</span><span>位置 / 链接</span><span>状态</span></div>
        <EmptyState v-if="!filteredAssetRows.length" size="inline" icon="paperclip" title="没有匹配的附件" hint="上传卡片附件后会在这里出现" />
        <div v-for="r in filteredAssetRows" :key="r.assetId + r.owner.cardId" class="dm-asset-row">
          <div class="dm-asset-main">
            <div class="dm-asset-name">{{ r.name }}</div>
            <div class="dm-asset-meta">{{ r.kind.toUpperCase() }} · {{ props.formatBytes(r.size) }} · {{ new Date(r.createdAt).toLocaleDateString('zh-CN') }}</div>
          </div>
          <div class="dm-asset-main"><div class="dm-asset-name">{{ r.owner.cardTitle }}</div><div class="dm-asset-meta">{{ r.owner.kind === 'resource' ? '资源卡' : r.owner.kind === 'task' ? '任务卡' : r.owner.kind === 'curiosity' ? '好奇心卡' : '论证卡' }}</div></div>
          <div class="dm-asset-main"><div class="dm-asset-meta">{{ r.owner.location }}</div><div class="dm-asset-link" :title="r.owner.originalLink || ''">{{ r.owner.originalLink || '—' }}</div></div>
          <div><span class="dm-badge" :class="r.storage === 'ok' ? 'ok' : 'miss'">{{ r.storage === 'ok' ? '正常' : '本体缺失' }}</span></div>
        </div>
        <div class="gs-setting-row gs-setting-row--gap">
          <span class="gs-sr-label">孤儿附件</span>
          <div class="gs-sr-control"><span class="gs-sr-hint">删除未被任何卡片引用的残留本体（不可恢复）</span><button class="gs-btn" @click="cleanupOrphans">清理</button></div>
        </div>
      </div>
    </div>
  </template>

  <!-- Airtable -->
  <template v-else>
    <div class="gs-card">
      <div class="gs-card-header">
        <span class="gs-card-title">连接配置</span>
        <span class="gs-status-badge" :class="atBadge.cls"><span class="gs-status-dot"></span>{{ atBadge.label }}</span>
        <span class="gs-card-desc">PAT 仅存本机，数据包永不携带</span>
      </div>
      <div class="gs-card-body">
        <div class="gs-setting-row"><span class="gs-sr-label">Personal Access Token</span><div class="gs-sr-control gs-sr-control-wrap"><input class="gs-input gs-input--pat" :class="{ 'is-invalid': atFieldErr.pat }" type="password" v-model="atPat" :placeholder="atPatSaved ? '已保存（不回显）· 替换请直接重填' : 'pat…（需 data.records 读写 + schema.bases 写权限）'" /><span v-if="atFieldErr.pat" class="gs-field-err">{{ atFieldErr.pat }}</span><span v-else-if="atPatSaved && !atPat" class="gs-sr-hint">已保存，替换需重填（原值不回显，避免凭据被复制）</span></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">Base ID</span><div class="gs-sr-control gs-sr-control-wrap"><input class="gs-input gs-input--ident" :class="{ 'is-invalid': atFieldErr.base }" v-model="atBaseId" placeholder="app 开头" /><span v-if="atFieldErr.base" class="gs-field-err">{{ atFieldErr.base }}</span></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">Table ID</span><div class="gs-sr-control gs-sr-control-wrap"><input class="gs-input gs-input--ident" :class="{ 'is-invalid': atFieldErr.tbl }" v-model="atTableId" placeholder="tbl 开头（表 URL 中获取）" /><span v-if="atFieldErr.tbl" class="gs-field-err">{{ atFieldErr.tbl }}</span></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">标签列名</span><div class="gs-sr-control"><input class="gs-input gs-input--ident" v-model="atTagColumn" :placeholder="atTagColumnDefault" @change="applyTagColumn" /></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">连接测试</span><div class="gs-sr-control gs-sr-control--inline"><button class="gs-btn" :disabled="atBusy || !atCredReady || !atBaseId || !atTableId" @click="testAtConnection">{{ atBusy ? '测试中…' : '测试连接' }}</button><span v-if="atTableName" class="gs-sr-ok"><Icon name="check" :size="13"/> 已连上「{{ atTableName }}」</span></div></div>
      </div>
    </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">同步范围与触发</span></div>
      <div class="gs-card-body">
        <div class="gs-setting-row"><span class="gs-sr-label">同步范围</span><div class="gs-sr-control gs-sr-note gs-sr-note--wrap">调度台好奇心卡 · 方向台任务卡 · 资源卡池资源卡 · 各策展台镜像卡；单向知源 → Airtable，不回写本地</div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">3 小时自动轮询</span><div class="gs-sr-control"><label class="gs-switch"><input type="checkbox" :checked="atPoll" @change="toggleAtPoll" /><span class="gs-switch-slider"></span></label></div></div>
        <div class="gs-setting-row"><span class="gs-sr-label">立即同步</span><div class="gs-sr-control gs-sr-control--inline"><button class="gs-btn gs-btn-primary" :disabled="atBusy || !atCredReady || !atBaseId || !atTableId" @click="runAtSync">{{ atBusy ? '同步中…' : '立即同步' }}</button><span v-if="quotaText" class="gs-sr-note gs-sr-note--muted">{{ quotaText }}</span></div></div>
        <div class="gs-setting-row" v-if="atStatusText"><span class="gs-sr-label">上次同步</span><div class="gs-sr-control gs-sr-note">{{ atStatusText }}</div></div>
        <div class="gs-setting-row" v-if="store.data?.airtableSync?.lastError"><span class="gs-sr-label">上次错误</span><div class="gs-sr-control gs-sr-note gs-sr-note--danger">{{ store.data.airtableSync.lastError }}</div></div>
      </div>
    </div>
    <div class="gs-card">
      <div class="gs-card-header"><span class="gs-card-title">同步日志</span><span class="gs-card-desc">最近 {{ atLog.length }} 条</span></div>
      <div class="gs-card-body">
        <EmptyState v-if="!atLog.length" size="inline" icon="refresh" title="暂无同步记录" hint="配好连接后点「立即同步」" />
        <div v-for="(l, i) in atLog" :key="i" class="gs-setting-row gs-setting-row--top">
          <span class="gs-sr-label gs-sr-label--nowrap">{{ new Date(l.at).toLocaleString('zh-CN') }}</span>
          <div class="gs-sr-control gs-sr-note gs-sr-note--log"><Icon v-if="l.kind === 'ok'" name="check" :size="12" class="gs-log-ico ok" /><Icon v-else-if="l.kind === 'error'" name="warn" :size="12" class="gs-log-ico err" /><span>{{ l.msg }}</span></div>
        </div>
      </div>
    </div>
  </template>

  <input ref="packageInput" type="file" accept=".json" class="gs-file-hidden" @change="handlePackageImport" />
  <input ref="assetPackInput" type="file" accept=".zip" class="gs-file-hidden" @change="handleAssetPackImport" />
  <input ref="bookmarkInput" type="file" accept=".html,.htm" class="gs-file-hidden" @change="handleBookmarkFile" />
</div>
</template>

<style src="./base.css"></style>
<style scoped>
.dm-tabs { display: flex; gap: 4px; padding: 4px; margin-bottom: 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-2); width: fit-content; }
.dm-tab { border: none; background: transparent; color: var(--text-3); padding: 6px 14px; border-radius: var(--radius-sm); font-size: var(--fs-sub); font-family: inherit; cursor: pointer; }
.dm-tab.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); font-weight: 600; }
.dm-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.dm-search { flex: 1; min-width: 180px; }
.dm-asset-head, .dm-asset-row { display: grid; grid-template-columns: 1.5fr 1.2fr 1.4fr 84px; gap: 12px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border); }
.dm-asset-head { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: var(--tracking-sm); }
.dm-asset-main { min-width: 0; }
.dm-asset-name { font-size: var(--fs-body); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-asset-meta, .dm-asset-link { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: var(--fs-caption); }
.dm-badge.ok { background: var(--tag-ok-bg); color: var(--success); }
.dm-badge.miss { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
@media (max-width: 900px) { .dm-asset-head { display: none; } .dm-asset-row { grid-template-columns: 1fr; gap: 6px; } }
</style>
