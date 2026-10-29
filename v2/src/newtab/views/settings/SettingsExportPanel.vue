<script setup lang="ts">
/**
 * 导出数据子域（V3.8.42 P0-3 第四批，从 GlobalSettings.vue 搬出）
 *
 * ★宿主接线：<SettingsExportPanel v-if="activePage === 'export'" />
 *   v-if 与面板外壳上的 v-if 都归宿主——本页的显隐由导航决定。
 *
 * ★downloadFile / dateStr 的真源在本组件（导出四路 + 附件包 zip 都用），
 *   import 子域那边通过 props 拿同一个函数引用，两边共用一份口径。
 *
 * ★formatBytes / wsDisplayNameOf 走 props：前者与 AboutPanel 那份是逐字等价副本
 *   （改一个阈值会让「附件占用」与「数据存储」两处读数不一致），后者是纯工具函数。
 *
 * ★原先宿主里那条 watch(activePage, p => p === 'export' && refreshAssetStats())
 *   **没有搬过来**：那是导航生命周期，属于宿主。本组件用 onMounted 触发——
 *   组件是 v-if 挂载的，挂载即"切到导出页"，语义等价且少一层依赖。
 */
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { saveUIPrefs, loadUIPrefs } from '@/shared/storage/repository'
import { getAssetStats, cleanupOrphanAssetsOf, collectReferencedAssetIds, listOrphanAssetIds, getAllAssets, putAssets } from '@/shared/storage/assets'
import { buildZip, readZip, type ZipEntry } from '@/shared/utils/zip'
import { EXPORT_MARKERS } from '@/shared/storage/keys'
import { wsNameById } from '@/shared/utils/wsName'
import { visibleFields, allFields } from '@/shared/utils/fields'
import { assetSummary } from '@/shared/utils/assetKind'
import { isHubWs, boardCardsOf, isMirrorView } from '@/shared/storage/hub'
import { catPathOf } from '@/shared/storage/airtable'
import { downloadFile, dateStr } from './io-utils'
import Icon from '@/shared/components/Icon.vue'
import DataCheckupCard from '../../components/DataCheckupCard.vue'
import type { AppData, ResourceCard } from '@/shared/models'

const { formatBytes, wsDisplayNameOf } = defineProps<{
  /** 与 AboutPanel 那份逐字等价（附件占用 / 数据存储 两处读数必须一致） */
  formatBytes: (n: number) => string
  /** 显示名工具 */
  wsDisplayNameOf: (w: { id: string; name: string; icon: string }) => string
}>()

const store = useAppStore()

/** 宿主 gd = computed(() => store.data!) 的等价物：store 是单例，本组件自己算一份即可 */
const gd = computed(() => store.data!)

// ---- REQ-048：附件存储统计 + 孤儿清理（导出数据页） ----
const assetCount = ref(0)
const assetBytes = ref(0)
async function refreshAssetStats() {
  try {
    const s = await getAssetStats()
    assetCount.value = s.count
    assetBytes.value = s.bytes
  } catch (err) {
    console.error('[assets] stats failed:', err)
  }
}
/** 清理孤儿附件：与策展台钻取抽屉同一条实现（`cleanupOrphanAssetsOf` 一份 keepIds 算式，含论证卡）
 *  ★R4-Dc 补确认门：这一枚钮点下去是**物理删除不可恢复的 IndexedDB 本体**，此前单击即删；
 *  同一张卡上「导出附件包」被写成"完整可迁移备份"，两个相邻动作给出相反的风险信号——
 *  与 R146 当年给「清空回收站」补门是同一条理由（见本文件 emptyRecycleBin 那段注释）。 */
async function cleanupOrphanAssetsAction() {
  const all = store.data
  if (!all) return
  let orphans: string[] = []
  try {
    orphans = await listOrphanAssetIds(collectReferencedAssetIds(all))
  } catch (err) {
    console.error('[assets] scan failed:', err)
    showToast('盘点失败，请重试')
    return
  }
  if (!orphans.length) { showToast('无孤儿附件，一切干净'); return }
  const ok = await useConfirm({
    title: '清理孤儿附件',
    message: `共发现 ${orphans.length} 个未被任何卡片（含回收站里的卡与论证卡）引用的附件本体。\n清理后不可恢复，但不会影响任何现存卡片的附件。\n想先留一份，可点上面的「导出附件包」。`,
    confirmText: `清理 ${orphans.length} 个`
  })
  if (!ok) return
  try {
    const n = await cleanupOrphanAssetsOf(all)
    await refreshAssetStats()
    showToast(n > 0 ? `已清理 ${n} 个孤儿附件` : '无孤儿附件，一切干净')
  } catch (err) {
    console.error('[assets] cleanup failed:', err)
    showToast('清理失败，请重试')
  }
}

// ---- 第卌二轮 REQ-059：附件包导出/导入（zip STORE 模式，零依赖） ----
/** 导出附件包：全部附件本体 → 附件包 zip（manifest + assets/<id> 原件）。与主数据 JSON 备份配合 = 完整可迁移备份 */
async function exportAssetPack() {
  try {
    const all = await getAllAssets()
    if (!all.length) { showToast('暂无附件可导出'); return }
    const manifest = JSON.stringify({
      type: EXPORT_MARKERS.ASSET_PACK, version: 1, exportedAt: new Date().toISOString(), count: all.length,
      items: all.map(a => ({ id: a.id, size: a.blob.size, mime: a.blob.type || '' }))
    }, null, 2)
    const entries: ZipEntry[] = [
      { name: 'manifest.json', data: new TextEncoder().encode(manifest) }
    ]
    for (const a of all) entries.push({ name: `assets/${a.id}`, data: new Uint8Array(await a.blob.arrayBuffer()) })
    const zip = buildZip(entries)
    const url = URL.createObjectURL(zip)
    const aEl = document.createElement('a')
    aEl.href = url; aEl.download = `zhiyuan_assets_${dateStr()}.zip`; aEl.click()
    URL.revokeObjectURL(url)
    showToast(`附件包已导出：${all.length} 个附件`)
  } catch (err) {
    console.error('[assets] export pack failed:', err)
    showToast('附件包导出失败，请重试')
  }
}

/** 导入附件包：解包 zip → 按 assetId 写回 zy_assets（同 ID 覆盖，q-3 拍板） */
async function handleAssetPackImport(e: Event) {
  const input = e.target as HTMLInputElement
  // ⚠ 第卌一轮教训：先快照再清空 input.value（清空会重置 FileList）
  const file = (input.files || [])[0]
  input.value = ''
  if (!file) return
  try {
    const entries = readZip(await file.arrayBuffer())
    const assets = entries.filter(en => en.name.startsWith('assets/'))
    if (!assets.length) { showToast('附件包内无附件数据（manifest 或 zip 格式不符）'); return }
    await putAssets(assets.map(en => ({ id: en.name.slice('assets/'.length), blob: new Blob([en.data]) })))
    await refreshAssetStats()
    showToast(`附件包导入完成：${assets.length} 个附件（同 ID 已覆盖）`)
  } catch (err) {
    console.error('[assets] import pack failed:', err)
    showToast(`附件包导入失败：${err instanceof Error ? err.message : '格式不符'}`)
  }
}

/** 第卅六轮 REQ-038：备份提醒开关 + 上次备份时间 */
const backupReminderEnabled = ref<boolean>(typeof store.ui?.backupReminderEnabled === 'boolean' ? store.ui.backupReminderEnabled : true)
const lastBackupAt = ref<number | undefined>(store.ui?.lastBackupAt)
function toggleBackupReminder(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  backupReminderEnabled.value = checked
  saveUIPrefs({ backupReminderEnabled: checked })
}
function markBackupNow() {
  const t = Date.now()
  lastBackupAt.value = t
  saveUIPrefs({ lastBackupAt: t })
}
function formatBackupAgo(ts: number): string {
  const ms = Date.now() - ts
  const day = Math.floor(ms / 86400000)
  if (day <= 0) return '今天'
  if (day === 1) return '昨天'
  if (day < 30) return `${day} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

// ---- 导出 ----
const exportWsId = ref('')
const csvWsId = ref('')


/** R66-F4：全量导出 = AppData 全段 + UI 偏好（主题/密度等 zy_ui_v2 独立键并入 uiPrefs 段，导入侧自动应用） */
async function exportAll() {
  const d = store.data!
  let uiPrefs: Record<string, unknown> | undefined
  // R114-59：读 UI 偏好失败 → 降级为「不带 uiPrefs 段导出」，需告警而非静默（导出物缺主题段会让用户困惑）
  try { uiPrefs = await loadUIPrefs() as unknown as Record<string, unknown> } catch (e) { console.warn('[zy] 导出时读取 UI 偏好失败，本次导出将不含 uiPrefs 段', e) }
  // R70：剥离 Airtable 凭证与同步映射——导出物会被分享/传网盘（产品本身就鼓励「导出即带走」），
  // airtableSync.pat 明文随文件外流＝拿到的人可读写用户的 Airtable Base，与「数据 100% 本机、不代持凭证」冲突。
  const safeData = { ...(d as unknown as Record<string, unknown>) }
  delete safeData.airtableSync
  const payload = uiPrefs ? { ...safeData, uiPrefs } : safeData
  downloadFile(`zhiyuan_backup_${dateStr()}.json`, JSON.stringify(payload, null, 2))
  markBackupNow()
  showToast('全量数据已导出（含全部策展台与界面偏好）')
}

/** 第卌一轮 REQ-055：资源目录字段 → CSV 单元格文本（系统字段键值映射；自定义字段取 customFields） */
function resCsvValue(r: ResourceCard, key: string): string {
  if (key.startsWith('custom_')) {
    const v = r.customFields?.[key]
    return v == null ? '' : String(v)
  }
  switch (key) {
    case 'title': return r.title
    case 'link': return r.link || ''
    case 'description': return r.description || ''
    case 'sourceType': return r.sourceType || ''
    case 'tags': return (r.tags || []).join(';')
    case 'createdAt': return new Date(r.createdAt).toISOString().slice(0, 10)
    case 'assets':
      // 附件列 = 文本摘要（与 fieldValue assets 同规则：N 图 · N PDF · M HTML）
      // R81（R15）：原实现把 PDF 算进 HTML 档，改调共享 assetSummary，与徽标/字段值三出口同源
      return assetSummary(r.assets)
    default: {
      const v = (r as unknown as Record<string, unknown>)[key]
      return v == null ? '' : String(v)
    }
  }
}

/** 按策展台导出 CSV —— 第卌一轮 REQ-055：动态列对齐字段目录
 * 目录字段（title/link/description/sourceType/tags/createdAt/assets + 自定义）全按目录配置：
 * 系统字段无条件导出、自定义字段按可见性过滤，列顺序 = fieldDef.order、列标题 = fieldDef.label（跟随重命名/显隐/排序）；
 * 目录外管理列（链接类型/分类/置顶/星标/更新时间）为卡片固有元数据，固定尾随。 */
function exportCsvForWorkspace() {
  if (!csvWsId.value) return
  const d = store.data!
  const ws = d.workspaces.find(w => w.id === csvWsId.value)
  if (!ws) return
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  // R63-2：资源台 = 原生卡；策展台 = 台内 + 镜像（boardCardsOf），与台内视图一致
  const isBoard = !isHubWs(ws)
  const cards = isBoard
    ? boardCardsOf(d, ws.id)
    : d.resources.filter(r => !r.deletedAt && r.workspaceId === csvWsId.value)
  // 动态目录列：系统字段全导出（无视 visible，保证数据基线完整）+ 自定义字段按可见性过滤，按 order 排序
  const dirCols = allFields(d.fieldConfig, 'resource')
    .filter(f => !f.key.startsWith('custom_') || f.visible)
    .sort((a, b) => a.order - b.order)
  const cols: Array<{ label: string; get: (r: ResourceCard) => string }> = dirCols.map(f => ({ label: f.label, get: r => resCsvValue(r, f.key) }))
  // 目录外管理列（卡片固有元数据，固定尾随）
  cols.push(
    { label: '链接类型', get: r => (r.linkType === 'url' ? 'URL' : r.linkType === 'file' ? '本地文件' : 'Obsidian') },
    { label: '分类', get: r => catMap.get(r.categoryId || "") || '待分类' },
    // R63-2：金字塔路径/层级/中心论点（适配多维表分层分析）
    { label: '分类路径', get: r => catPathOf(d, r.workspaceId, r.categoryId).path || '待分类' },
    { label: '层级', get: r => String(catPathOf(d, r.workspaceId, r.categoryId).level) },
    { label: '是否中心论点', get: r => (r.isThesis ? '是' : '') },
    { label: '镜像标记', get: r => (isMirrorView(r) ? '是' : '') },
    { label: '置顶', get: r => (r.pinned ? '是' : '') },
    { label: '星标', get: r => (r.starred ? '是' : '') },
    { label: '更新时间', get: r => (r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : '') }
  )
  const headers = cols.map(c => c.label)
  const rows = cards.map(r => cols.map(c => csvEscape(c.get(r))))
  downloadFile(`zhiyuan_${wsDisplayNameOf(ws)}_${dateStr()}.csv`,
    '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n'),
    'text/csv;charset=utf-8')
  markBackupNow()
  showToast(`「${wsDisplayNameOf(ws)}」已导出 ${cards.length} 条资源卡 CSV`)
}

function exportWorkspace() {
  if (!exportWsId.value) return
  const d = store.data!
  const ws = d.workspaces.find(w => w.id === exportWsId.value)
  if (!ws) return
  const cats = d.categories.filter(c => c.workspaceId === ws.id)
  // R70：同 exportAll——导出物不含 Airtable 凭证
  const rootForExport = { ...(d as unknown as Record<string, unknown>) }
  delete rootForExport.airtableSync
  const subset: AppData = {
    ...(rootForExport as unknown as AppData), workspaces: [ws], categories: cats,
    resources: d.resources.filter(r => r.workspaceId === ws.id),
    tasks: d.tasks,
    curiosities: d.curiosities,
    // R63-2：只带本台的镜像引用（projection 指向资源台真身，导入合并按 id 并集恢复）
    curationProjections: (d.curationProjections || []).filter(p => p.targetWsId === ws.id)
  }
  downloadFile(`zhiyuan_${ws.name}_${dateStr()}.json`, JSON.stringify(subset, null, 2))
  markBackupNow()
  showToast(`「${ws.name}」已导出`)
}

function exportMarkdown() {
  const d = store.data!
  const wsMap = new Map(d.workspaces.map(w => [w.id, wsNameById(d.workspaces, w.id)]))
  const catMap = new Map(d.categories.map(c => [c.id, c.name]))
  let md = '# 知源调度台 · 资源卡导出\n\n'
  // R4-Dg：按**卡自己的** workspaceId/categoryId 分组，不再按 workspace 实体枚举——
  // 资源卡池既可能没有实体（新建库），其卡又恒无分类（categoryId 置空＝待分类），
  // 旧的两层 for（先台后分类）会把池卡整批静默漏掉。
  const byWs = new Map<string, ResourceCard[]>()
  for (const r of d.resources.filter(x => !x.deletedAt)) {
    const arr = byWs.get(r.workspaceId)
    if (arr) arr.push(r); else byWs.set(r.workspaceId, [r])
  }
  for (const [wsId, cards] of byWs) {
    md += `## ${wsNameById(d.workspaces, wsId) || '未知来源'}\n\n`
    const byCat = new Map<string, ResourceCard[]>()
    for (const r of cards) {
      const k = r.categoryId || ''
      const arr = byCat.get(k)
      if (arr) arr.push(r); else byCat.set(k, [r])
    }
    for (const [catId, catCards] of byCat) {
      md += `### ${catMap.get(catId) || '待分类'}\n\n`
      for (const r of catCards) {
        md += `- [${r.title}](${r.link})`
        if (r.description) md += `— ${r.description}`
        if (r.tags?.length) md += `${r.tags.map(t => `#${t}`).join(' ')}`
        md += '\n'
      }
      md += '\n'
    }
  }
  downloadFile(`zhiyuan_resources_${dateStr()}.md`, md, 'text/markdown;charset=utf-8')
  markBackupNow()
  showToast('资源卡已导出为Markdown')
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

/** 附件统计：本组件挂载即"切到导出页"（宿主 v-if 控制），替代原宿主那条 watch */
onMounted(refreshAssetStats)

/** 导入页那枚 zip input 要用的解包写回实现——它住在本组件（附件包 zip 段），
 *  但两个子域不能互相 import（会成环），故 expose 出去由宿主中转。 */
defineExpose({ handleAssetPackImport })
</script>

<template>
<div class="gs-panel">
<div class="gs-page-header">
  <div class="gs-page-title"><Icon name="upload" :size="13"/> 导出数据</div>
  <div class="gs-page-desc">导出数据用于备份或跨设备迁移（全量 JSON + 附件包两步才算完整迁移）</div>
</div>
<div class="gs-card">
  <div class="gs-card-header"><span class="gs-card-title">备份提醒</span></div>
  <div class="gs-card-body">
    <!-- V2.20.1 BUG-2：存量归属修复记录（静默回填，仅修复时显示） -->
    <div v-if="gd.projBackfillFixed" class="gs-export-row">
      <div class="gs-er-info">
        <div class="gs-er-name"><Icon name="wrench" :size="13"/> 存量归属修复（V2.20.1）</div>
        <div class="gs-er-desc">启动时已自动修复 {{ gd.projBackfillFixed }} 个任务的项目归属（有成功指标但缺项目关联的历史数据，按指标反查所属项目补齐），数据一致性已恢复。</div>
      </div>
    </div>
    <div class="gs-export-row">
      <div class="gs-er-info">
        <div class="gs-er-name">自动提醒</div>
        <div class="gs-er-desc">
          开启后，若 30 天未导出备份、或存储容量超过 50 MB 时，顶部右上角显示红点提醒。
          {{ backupReminderEnabled ? '当前已启用' : '当前已关闭' }}
          {{ lastBackupAt ? '· 上次导出：' + formatBackupAgo(lastBackupAt) : '· 尚无导出记录' }}
        </div>
      </div>
      <label class="gs-switch">
        <input type="checkbox" :checked="backupReminderEnabled" @change="toggleBackupReminder" />
        <span class="gs-switch-slider"></span>
      </label>
    </div>
  </div>
</div>
<div class="gs-card">
  <div class="gs-card-header"><span class="gs-card-title">导出方式</span></div>
  <div class="gs-card-body">
    <div class="gs-export-row">
      <div class="gs-er-info"><div class="gs-er-name">导出全部数据</div><div class="gs-er-desc">全量JSON：调度台（愿景/使命/方向/项目/成功指标）+ 方向台（策展台/三卡/标签/统计）及全部数据关系，用于整体迁移备份</div></div>
      <button class="gs-btn gs-btn-primary" @click="exportAll">导出</button>
    </div>
    <div class="gs-export-row">
      <div class="gs-er-info"><div class="gs-er-name">按策展台导出 CSV</div><div class="gs-er-desc">字段：系统字段全导 + 自定义字段按可见性，列名/顺序跟随「字段管理」；尾随 链接类型/分类/置顶/星标/更新时间，适配 Airtable 等多维表</div></div>
      <select class="gs-select" v-model="csvWsId">
        <option value="">选择策展台…</option>
        <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
      </select>
      <button class="gs-btn" @click="exportCsvForWorkspace" :disabled="!csvWsId">导出CSV</button>
    </div>
    <div class="gs-export-row">
      <div class="gs-er-info"><div class="gs-er-name">导出指定策展台</div><div class="gs-er-desc">选择一个策展台导出为 JSON（只含该台的分类与卡，用于跨设备搬台）</div></div>
      <select class="gs-select" v-model="exportWsId">
        <option value="">选择策展台…</option>
        <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
      </select>
      <button class="gs-btn" @click="exportWorkspace" :disabled="!exportWsId">导出</button>
    </div>
    <div class="gs-export-row">
      <div class="gs-er-info"><div class="gs-er-name">导出为Markdown</div><div class="gs-er-desc">将资源卡导出为带链接和注解的Markdown文档</div></div>
      <button class="gs-btn" @click="exportMarkdown">导出MD</button>
    </div>
  </div>
</div>
<div class="gs-card">
  <div class="gs-card-header"><span class="gs-card-title"><Icon name="paperclip" :size="12"/> 附件存储</span><span class="gs-card-desc">图片/HTML 本体在 IndexedDB，不占主数据</span></div>
  <div class="gs-card-body">
    <div class="gs-export-row">
      <div class="gs-er-info">
        <div class="gs-er-name">附件占用：{{ assetCount }} 个 · {{ formatBytes(assetBytes) }}</div>
        <div class="gs-er-desc">JSON 导出不含附件本体（保持轻量）；附件本体用下方附件包导出/导入迁移</div>
      </div>
      <button class="gs-btn" @click="refreshAssetStats">刷新</button>
    </div>
    <div class="gs-export-row">
      <div class="gs-er-info"><div class="gs-er-name">导出附件包</div><div class="gs-er-desc">全部附件本体打包为 zip；与「导出全部数据 JSON」配合 = 完整可迁移备份</div></div>
      <button class="gs-btn gs-btn-primary" @click="exportAssetPack">导出附件包</button>
    </div>
    <div class="gs-export-row">
      <div class="gs-er-info"><div class="gs-er-name">清理孤儿附件</div><div class="gs-er-desc">删除未被任何卡片引用的残留附件（上传中断等异常场景产生）</div></div>
      <button class="gs-btn" @click="cleanupOrphanAssetsAction">清理</button>
    </div>
  </div>
</div>
<DataCheckupCard /><!-- R171-A2/A3 数据体检卡：独立组件（R164-2 增长门禁） -->
</div>
</template>

<style src="./base.css"></style>

<style scoped>
/* 以下规则由 move-export-subdomain.cjs 从宿主样式段逐行切出，未重打一字 */
.gs-export-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.gs-export-row:last-child { border-bottom: none; }
.gs-er-info { flex: 1; }
.gs-er-name { font-size: var(--fs-body); font-weight: 500; color: var(--text); }
.gs-er-desc { font-size: var(--fs-caption); color: var(--text-3); margin-top: 2px; }
</style>
