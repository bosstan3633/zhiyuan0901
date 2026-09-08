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
 * - mode='assets'  附件数量 → 附件明细表（点击行打开：图片行内预览 / HTML·PDF 新标签）
 * - mode='recent'  最近更新 → 更新流水 Top 30（点击 → emit open-card / locate）
 * 数据由宿主（Workspace.vue）从 hub.curationMetrics + boardCardsOf 派生后传入，组件无 store 依赖。
 */
import { ref, computed, watch } from 'vue'
import Drawer from '@/shared/components/Drawer.vue'
import { getAssetBlob } from '@/shared/storage/assets'
import { openHtmlAsset } from '@/shared/utils/htmlAsset'
import { showToast } from '@/shared/components/toast'
import type { AssetMeta } from '@/shared/models'

const props = defineProps<{
  open: boolean
  mode: 'total' | 'source' | 'assets' | 'recent'
  catRows: DrillCatRow[]
  nativeCards: DrillCardRow[]
  mirrorCards: DrillCardRow[]
  assetRows: DrillAssetRow[]
  recentRows: DrillCardRow[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'jump-cat', id: string): void
  (e: 'open-card', id: string): void
  (e: 'locate', id: string): void
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

    <!-- 附件明细 -->
    <div v-else-if="mode === 'assets'" class="dd-list">
      <div v-for="(a, i) in sortedAssets" :key="a.assetId + i" class="dd-row clickable" @click="openDrillAsset(a)">
        <span class="dd-ico">{{ a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📕' : '🧾' }}</span>
        <span class="dd-name" :title="a.cardTitle">
          <span class="dd-asset-name">{{ a.name }}</span>
          <span class="dd-sub">来自：{{ a.cardTitle }}</span>
        </span>
        <span class="dd-time">{{ fmtSize(a.size) }} · {{ fmtTs(a.createdAt) }}</span>
      </div>
      <div v-if="!sortedAssets.length" class="dd-empty">暂无附件</div>
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
.dd-group-title { font-size: 11px; font-weight: 700; color: var(--text-3); letter-spacing: .4px; padding: 4px 0; }
.dd-row { display: flex; align-items: center; gap: 8px; padding: 8px 8px; border-radius: 6px; font-size: 12px; color: var(--text-2); }
.dd-row.clickable { cursor: pointer; transition: background .12s; }
.dd-row.clickable:hover { background: var(--surface-3); color: var(--text); }
.dd-ico { flex-shrink: 0; font-size: 12px; }
.dd-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; flex-direction: column; gap: 1px; }
.dd-asset-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dd-sub { font-size: 10px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dd-count { font-size: 10.5px; color: var(--accent); background: var(--accent-light); padding: 1px 8px; border-radius: 99px; font-weight: 600; flex-shrink: 0; }
.dd-time { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.dd-hint { font-size: 10.5px; color: var(--accent); flex-shrink: 0; }
.dd-empty { padding: 24px 8px; text-align: center; color: var(--text-3); font-size: 12px; }
.dd-preview { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.75); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; cursor: zoom-out; }
.dd-preview-name { color: #fff; font-size: 13px; margin-bottom: 12px; }
.dd-preview-name span { opacity: .6; font-size: 11px; }
.dd-preview img { max-width: 92%; max-height: 84%; object-fit: contain; border-radius: 8px; }
</style>
