<script lang="ts">
/** 下钻行类型（宿主 Workspace.vue 消费；script setup 不允许 export，独立普通块承载） */
export interface DrillCatRow { id: string; name: string; count: number; depth: number }
export interface DrillCardRow { id: string; title: string; updatedAt: number }
export interface DrillAssetRow { cardId: string; cardTitle: string; assetId: string; name: string; kind: string; size: number; createdAt: number }
</script>

<script setup lang="ts">
/**
 * R62-2：策展台指标下钻抽屉（5 指标卡的明细层）
 * - mode='total'   卡片总数 → 按分类明细（点击分类 → emit jump-cat）
 * - mode='source'  来源构成 → 台内新建 / 资源台镜像 两栏明细（镜像点击 → emit locate）
 * - mode='assets'  附件数量 → 附件明细表（**点击行 = 定位来源卡**；行尾 👁 预览 / 🗑 清理；孤儿附件可逐个或批量清理）
 * - mode='recent'  最近更新 → 更新流水 Top 30（点击 → emit open-card / locate）
 * 数据由宿主（Workspace.vue）从 hub.curationMetrics + boardCardsOf 派生后传入，组件无 store 依赖。
 */
import { ref, computed, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import { getAssetBlob, getAllAssetIds } from '@/shared/storage/assets'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import type { AssetMeta } from '@/shared/models'

const props = defineProps<{
  open: boolean
  mode: 'total' | 'source' | 'assets' | 'recent'
  catRows: DrillCatRow[]
  nativeCards: DrillCardRow[]
  mirrorCards: DrillCardRow[]
  assetRows: DrillAssetRow[]
  recentRows: DrillCardRow[]
  /** R110-BUG2：来源卡是否存在（宿主跨台全量判定，含未软删条件）——不存在即「孤儿行」 */
  cardExists: (cardId: string) => boolean
  /** R110-BUG2：全局被引用附件 id 并集（含回收站软删卡的附件）——IndexedDB 中存在但不在其中的 = 孤儿附件 */
  referencedAssetIds: string[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'jump-cat', id: string): void
  (e: 'open-card', id: string): void
  (e: 'locate', id: string): void
  /** R110-BUG2：点击附件行 → 宿主关抽屉并定位到来源卡（本台高亮 / 跨台路由） */
  (e: 'locate-asset', cardId: string): void
  /** R110-BUG2：单条清理（摘除失效引用 / 删除残留本体） */
  (e: 'cleanup-asset', row: { cardId: string; assetId: string }): void
  /** R110-BUG2：批量清理全部孤儿附件（宿主复用 cleanupOrphanAssets 语义） */
  (e: 'cleanup-orphans'): void
}>()

const TITLE: Record<string, string> = {
  total: '📊 卡片总数 · 按分类明细',
  source: '🔀 来源构成 · 台内 vs 镜像',
  assets: '📎 附件明细',
  recent: '🕐 最近更新流水'
}

const sortedAssets = computed(() => [...props.assetRows].sort((a, b) => b.createdAt - a.createdAt))
const sortedRecent = computed(() => [...props.recentRows].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30))
/** 镜像卡 id 集（最近更新流水的图标与跳转分流） */
const mirrorIds = computed(() => new Set(props.mirrorCards.map(c => c.id)))

function fmtTs(ts?: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtSize(n: number): string {
  if (!n) return '—'
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}
function rowClick(id: string, isMirror: boolean) {
  if (isMirror) emit('locate', id)
  else emit('open-card', id)
}

// ---- R110-BUG2：附件存在性索引（IndexedDB 只读扫描，抽屉打开且为附件模式时才做） ----
/** 本地 IndexedDB 中真实存在的附件 id 集；loaded=false 表示尚未扫描（此时不做「本体缺失」判定，避免误标） */
const assetIndexLoaded = ref(false)
const existingAssetIds = ref<Set<string>>(new Set())
/** 孤儿附件 id（IndexedDB 中存在，但全局无任何卡片引用） */
const orphanAssetIds = ref<string[]>([])
const orphanCount = computed(() => orphanAssetIds.value.length)

async function loadAssetIndex(force = false) {
  if (assetIndexLoaded.value && !force) return
  try {
    const ids = await getAllAssetIds()
    existingAssetIds.value = new Set(ids)
    const refd = new Set(props.referencedAssetIds)
    orphanAssetIds.value = ids.filter(id => !refd.has(id))
    assetIndexLoaded.value = true
  } catch {
    // IndexedDB 不可用 / 被禁用：退化为「不判定本体缺失」，不阻塞主流程
  }
}
// 打开且为附件模式时扫描；数据变化（清理 / 上传）后重扫
watch(() => [props.open, props.mode] as const, ([o, m]) => {
  if (o && m === 'assets') void loadAssetIndex(true)
}, { immediate: true })
watch(() => props.referencedAssetIds, () => {
  if (props.open && props.mode === 'assets') void loadAssetIndex(true)
})

/** R110-BUG2：附件行三态 —— ok 可定位可预览 / missing 本体缺失（引用残留）/ orphan 来源卡已不存在 */
type AssetRowState = 'ok' | 'missing' | 'orphan'
const assetRowsView = computed(() => sortedAssets.value.map(a => {
  let st: AssetRowState = 'ok'
  if (!props.cardExists(a.cardId)) st = 'orphan'
  else if (assetIndexLoaded.value && !existingAssetIds.value.has(a.assetId)) st = 'missing'
  return { ...a, st }
}))
/** R110-BUG2：行点击 —— 正常行 = 定位来源卡（主诉「点击不跳卡」的修复）；异常行 = 提示如何清理 */
function onAssetRowClick(row: { st: AssetRowState; cardId: string }) {
  if (row.st === 'missing') { showToast('⚠ 附件本体已不在本地——可点行尾 🗑 清理这条失效引用'); return }
  if (row.st === 'orphan') { showToast('⚠ 来源卡已不存在——可点行尾 🗑 清理这条残留'); return }
  emit('locate-asset', row.cardId)
}

// ---- 附件打开（复用 AssetManager 语义：图片行内预览 / HTML·PDF openHtmlAsset） ----
const previewUrl = ref('')
const previewName = ref('')
async function openDrillAsset(row: DrillAssetRow) {
  if (row.kind === 'image') {
    try {
      const b = await getAssetBlob(row.assetId)
      if (!b) { showToast('⚠ 附件本体缺失（可能已被清理）'); return }
      previewUrl.value = URL.createObjectURL(b)
      previewName.value = row.name
    } catch { showToast('⚠ 附件读取失败') }
  } else {
    const meta = { id: row.assetId, kind: row.kind, name: row.name, size: row.size, mime: '', createdAt: row.createdAt } as AssetMeta
    const r = await openHtmlAsset(meta)
    if (r === 'missing') showToast('⚠ 附件本体缺失（可能已被清理）')
  }
}
function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}
watch(() => props.open, (v) => { if (!v) closePreview() })

// ---- R110-BUG2：清理（单条 / 批量，均二次确认） ----
/** 宿主清理是异步落库 + persist——稍等一拍重扫索引，让行立即消失而不是等下次开抽屉 */
function rescanLater() { setTimeout(() => { void loadAssetIndex(true) }, 400) }
async function onCleanup(row: { st: AssetRowState; cardId: string; assetId: string; name: string; cardTitle: string }) {
  const ok = await useConfirm({
    title: row.st === 'missing' ? '清理失效引用' : '清理孤儿附件',
    message: row.st === 'missing'
      ? `「${row.name}」的附件本体已不在本地，将从来源卡「${row.cardTitle}」摘除这条失效引用。`
      : `「${row.name}」的来源卡已不存在，将删除本地残留的附件记录。`,
    confirmText: '确认清理'
  })
  if (!ok) return
  emit('cleanup-asset', { cardId: row.cardId, assetId: row.assetId })
  rescanLater()
}
async function onCleanupOrphanBlob(assetId: string) {
  const ok = await useConfirm({
    title: '删除残留附件',
    message: `将删除本地残留的附件本体「${assetId.slice(-8)}」（未被任何卡片引用，无法恢复）。`,
    confirmText: '确认删除'
  })
  if (!ok) return
  emit('cleanup-asset', { cardId: '', assetId })
  rescanLater()
}
async function onCleanupAll() {
  const n = orphanCount.value
  if (!n) { showToast('ℹ 没有需要清理的孤儿附件'); return }
  const ok = await useConfirm({
    title: '清理全部孤儿附件',
    message: `共发现 ${n} 个未被任何卡片引用的残留附件（来源卡已删除 / 上传中断等异常场景）。\n清理后不可恢复，但不会影响任何现存卡片（含回收站卡片）的附件。`,
    confirmText: `清理 ${n} 个`
  })
  if (!ok) return
  emit('cleanup-orphans')
  rescanLater()
}
</script>

<template>
  <Drawer :open="open" :title="TITLE[mode] || '明细'" width="480px" @close="emit('close')">
    <!-- 总数 · 按分类 -->
    <div v-if="mode === 'total'" class="dd-list">
      <div v-for="c in catRows" :key="c.id" class="dd-row clickable" :style="{ paddingLeft: (8 + c.depth * 16) + 'px' }" @click="emit('jump-cat', c.id)">
        <span class="dd-ico">{{ c.depth ? '↳' : '📂' }}</span>
        <span class="dd-name">{{ c.name }}</span>
        <span class="dd-count">{{ c.count }}</span>
      </div>
      <div v-if="!catRows.length" class="dd-empty">暂无分类节点</div>
    </div>

    <!-- 来源构成 -->
    <div v-else-if="mode === 'source'" class="dd-list">
      <div class="dd-group-title">🖥 台内新建（{{ nativeCards.length }}）</div>
      <div v-for="c in nativeCards" :key="c.id" class="dd-row clickable" @click="rowClick(c.id, false)">
        <span class="dd-ico">🖥</span><span class="dd-name">{{ c.title }}</span><span class="dd-time">{{ fmtTs(c.updatedAt) }}</span>
      </div>
      <div v-if="!nativeCards.length" class="dd-empty">暂无台内卡</div>
      <div class="dd-group-title" style="margin-top:14px">📡 资源台镜像（{{ mirrorCards.length }}）</div>
      <div v-for="c in mirrorCards" :key="c.id" class="dd-row clickable" @click="rowClick(c.id, true)">
        <span class="dd-ico">📡</span><span class="dd-name">{{ c.title }}</span><span class="dd-hint">定位源卡 →</span>
      </div>
      <div v-if="!mirrorCards.length" class="dd-empty">暂无镜像卡</div>
    </div>

    <!-- 附件明细（R110-BUG2：点击行 = 定位来源卡；行尾 👁 预览 / 🗑 清理） -->
    <div v-else-if="mode === 'assets'" class="dd-list">
      <div v-if="orphanCount" class="dd-orphan-bar">
        <span class="dd-orphan-txt">🧹 检测到 {{ orphanCount }} 个孤儿附件（未被任何卡片引用）</span>
        <button class="dd-orphan-btn" @click="onCleanupAll">清理全部</button>
      </div>
      <div v-for="(a, i) in assetRowsView" :key="a.assetId + i" class="dd-row clickable" :class="{ 'dd-row-warn': a.st !== 'ok' }" @click="onAssetRowClick(a)">
        <span class="dd-ico">{{ a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📕' : '🧾' }}</span>
        <span class="dd-name" :title="a.cardTitle">
          <span class="dd-asset-name">{{ a.name }}</span>
          <span class="dd-sub">来自：{{ a.cardTitle }}<template v-if="a.st === 'missing'"> · ⚠ 本体缺失</template><template v-else-if="a.st === 'orphan'"> · ⚠ 来源卡已不存在</template></span>
        </span>
        <span class="dd-time">{{ fmtSize(a.size) }} · {{ fmtTs(a.createdAt) }}</span>
        <button class="dd-act" :title="a.st === 'ok' ? '预览 / 打开附件' : '清理这条残留'" @click.stop="a.st === 'ok' ? openDrillAsset(a) : onCleanup(a)">{{ a.st === 'ok' ? '👁' : '🗑' }}</button>
      </div>
      <div v-if="!assetRowsView.length" class="dd-empty">暂无附件</div>

      <!-- 孤儿附件（本体在本地、但无任何卡片引用）：逐个可删 + 顶部批量 -->
      <template v-if="orphanAssetIds.length">
        <div class="dd-group-title" style="margin-top:14px">🧹 孤儿附件本体（{{ orphanAssetIds.length }}）</div>
        <div v-for="id in orphanAssetIds" :key="'or-' + id" class="dd-row dd-row-warn">
          <span class="dd-ico">🗑</span>
          <span class="dd-name">
            <span class="dd-asset-name">未命名残留 · {{ id.slice(-8) }}</span>
            <span class="dd-sub">未被任何卡片引用（来源卡已删除 / 上传中断）</span>
          </span>
          <span class="dd-time">—</span>
          <button class="dd-act" title="删除这个残留附件" @click.stop="onCleanupOrphanBlob(id)">🗑</button>
        </div>
      </template>
    </div>

    <!-- 最近更新流水 -->
    <div v-else class="dd-list">
      <div v-for="c in sortedRecent" :key="c.id" class="dd-row clickable" @click="rowClick(c.id, mirrorIds.has(c.id))">
        <span class="dd-ico">{{ mirrorIds.has(c.id) ? '📡' : '🖥' }}</span>
        <span class="dd-name">{{ c.title }}</span>
        <span class="dd-time">{{ fmtTs(c.updatedAt) }}</span>
      </div>
      <div v-if="!sortedRecent.length" class="dd-empty">暂无更新记录</div>
    </div>

    <!-- 图片预览覆盖层 -->
    <div v-if="previewUrl" class="dd-preview" @click="closePreview">
      <div class="dd-preview-name">{{ previewName }} <span>（点击任意处关闭）</span></div>
      <img :src="previewUrl" alt="附件预览" />
    </div>
  </Drawer>
</template>

<style scoped>
.dd-list { display: flex; flex-direction: column; }
.dd-group-title { font-size: var(--fs-caption); font-weight: 700; color: var(--text-3); letter-spacing: .4px; padding: 4px 0; }
.dd-row { display: flex; align-items: center; gap: 8px; padding: 8px 8px; border-radius: 6px; font-size: var(--fs-sub); color: var(--text-2); }
.dd-row.clickable { cursor: pointer; transition: background var(--dur-fast); }
.dd-row.clickable:hover { background: var(--surface-3); color: var(--text); }
.dd-ico { flex-shrink: 0; font-size: var(--fs-sub); }
.dd-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; flex-direction: column; gap: 1px; }
.dd-asset-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dd-sub { font-size: var(--fs-tiny); color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dd-count { font-size: var(--fs-caption); color: var(--accent); background: var(--accent-light); padding: 1px 8px; border-radius: 99px; font-weight: 600; flex-shrink: 0; }
.dd-time { font-size: var(--fs-caption); color: var(--text-3); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.dd-hint { font-size: var(--fs-caption); color: var(--accent); flex-shrink: 0; }
.dd-empty { padding: 24px 8px; text-align: center; color: var(--text-3); font-size: var(--fs-sub); }
.dd-preview { position: fixed; inset: 0; z-index: var(--z-modal); background: rgba(0,0,0,.75); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; cursor: zoom-out; }
.dd-preview-name { color: #fff; font-size: var(--fs-body); margin-bottom: 12px; }
.dd-preview-name span { opacity: .6; font-size: var(--fs-caption); }
.dd-preview img { max-width: 92%; max-height: 84%; object-fit: contain; border-radius: 8px; }
/* R110-BUG2：附件行操作按钮 + 异常行 + 孤儿批量条 */
.dd-row-warn { color: var(--warn, #b8860b); }
.dd-act { flex-shrink: 0; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 5px; padding: 2px 7px; font-size: var(--fs-caption); line-height: 1.5; cursor: pointer; font-family: inherit; transition: all var(--dur-fast); }
.dd-act:hover { border-color: var(--accent); color: var(--accent); }
.dd-orphan-bar { display: flex; align-items: center; gap: 8px; padding: 7px 8px; margin-bottom: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-3); }
.dd-orphan-txt { flex: 1; min-width: 0; font-size: var(--fs-caption); color: var(--text-2); }
.dd-orphan-btn { flex-shrink: 0; border: 1px solid var(--accent); background: var(--accent-light); color: var(--accent); border-radius: 5px; padding: 3px 9px; font-size: var(--fs-caption); cursor: pointer; font-family: inherit; }
.dd-orphan-btn:hover { background: var(--accent); color: #fff; }
</style>
