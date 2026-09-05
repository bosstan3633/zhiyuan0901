<script setup lang="ts">
/**
 * R50-F3 + R51-F20~F25 策展中心 · 灵活策展空间（原资源台）
 * - 引用式镜像：卡片/分类/整个工作台从其他工作台投射而来，实时同步显示；移出/清空零影响源数据
 * - R51-F25：单卡投射落入「待分类」；分类投射作为镜像分组进入左侧树（显示名可改、可移出投射）
 * - R51-F20：投射卡可跨分类拖拽（只改 targetCatId，源数据不动）；原生卡拖拽归位（categoryId）
 * - R51-F21：目录树标准化——默认全部展开、一键收起/展开、树状层级
 * - R51-F22：卡片单击出详情、双击打开链接（与好奇心卡一致）
 * - R51-F23：策展卡自定义字段——默认 标题+描述文本框；字段池=三类卡字段并集，可增删
 * - 原生内容：自有分类树（增删改）+ 原生卡片（新建/编辑/置顶/拖拽排序/删除），与投射卡视觉区分
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { CURATION_WS_ID, type ResourceCard, type Category, type CurationProjection } from '@/shared/models'
import { uid } from '@/shared/utils'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { recordResourceOpen } from '@/shared/storage/stats'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import { visibleFields } from '@/shared/utils/fields'
import type { FieldDef } from '@/shared/models'

const router = useRouter()
const store = useAppStore()
const d = useCompass().d
const vFocus = { mounted: (el: HTMLElement) => el.focus() }

// ---- 视图选择：''=未分类 '__pending__'=待分类 分类id=原生分类 'mirror:pid'=镜像分组 ----
const PENDING = '__pending__'
const activeCat = ref('')

// ---- 分类树（策展中心自有，2 级） ----
const cats = computed(() => d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID).sort((a, b) => a.order - b.order))
const rootCats = computed(() => cats.value.filter(c => !c.parentId))
const childCats = (pid: string) => cats.value.filter(c => c.parentId === pid)
const catAggCount = (pid: string) =>
  d.value.resources.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID && (r.categoryId === pid || childCats(pid).some(c => c.id === r.categoryId))).length

// R51-F21：默认全部展开；一键收起/展开
const expandedCats = ref<Set<string>>(new Set())
watch(rootCats, (roots) => { for (const c of roots) expandedCats.value.add(c.id) }, { immediate: true })
function toggleExpand(id: string) {
  if (expandedCats.value.has(id)) expandedCats.value.delete(id)
  else expandedCats.value.add(id)
}
function expandAllCats() { for (const c of cats.value) expandedCats.value.add(c.id) }
function collapseAllCats() { expandedCats.value.clear() }

// ---- 分类 CRUD（原生） ----
const catEditing = ref<{ id: string; name: string } | null>(null)
const catCreating = ref<{ parentId?: string; name: string } | null>(null)
function startCreateCat(parentId?: string) { catCreating.value = { parentId, name: '' } }
function confirmCreateCat() {
  const name = (catCreating.value?.name || '').trim()
  if (!name) { catCreating.value = null; return }
  const siblings = cats.value.filter(c => c.parentId === (catCreating.value?.parentId || undefined))
  const cat: Category = { id: uid('cat'), workspaceId: CURATION_WS_ID, name, order: siblings.length, parentId: catCreating.value?.parentId }
  d.value.categories.push(cat)
  store.persist()
  catCreating.value = null
  showToast('✓ 分类已创建')
}
function startRenameCat(c: Category) { catEditing.value = { id: c.id, name: c.name } }
function confirmRenameCat() {
  const e = catEditing.value
  const cat = e && cats.value.find(c => c.id === e.id)
  const name = (e?.name || '').trim()
  if (cat && name && name !== cat.name) { cat.name = name; store.persist(); showToast('✓ 已重命名') }
  catEditing.value = null
}
async function deleteCat(c: Category) {
  const n = catAggCount(c.id)
  if (!await useConfirm({ message: `删除分类「${c.name}」？${n ? `其中 ${n} 张原生卡将移入「未分类」` : ''}`, confirmText: '删除分类', danger: true })) return
  for (const r of d.value.resources) if (r.workspaceId === CURATION_WS_ID && (r.categoryId === c.id || childCats(c.id).some(x => x.id === r.categoryId))) r.categoryId = ''
  for (const child of childCats(c.id)) child.parentId = undefined
  d.value.categories = d.value.categories.filter(x => x.id !== c.id)
  if (activeCat.value === c.id) activeCat.value = ''
  store.persist()
  showToast('✓ 分类已删除')
}

// ---- 原生卡片 ----
const nativeCards = computed(() =>
  d.value.resources.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.curOrder ?? 999) - (b.curOrder ?? 999) || a.createdAt - b.createdAt)
)
const cardsIn = (catId: string) => nativeCards.value.filter(r => (r.categoryId || '') === catId)

// ---- 投射清单 ----
const projections = computed<CurationProjection[]>(() => d.value.curationProjections || [])
function ensureProjArr() { d.value.curationProjections = d.value.curationProjections || [] }
async function clearProjections() {
  if (!projections.value.length) { showToast('ℹ 当前没有投射内容'); return }
  if (!await useConfirm({ message: `一键清空全部投射（${projections.value.length} 条）？源工作台数据零影响`, confirmText: '清空投射', danger: true })) return
  d.value.curationProjections = []
  if (activeCat.value.startsWith('mirror:')) activeCat.value = ''
  store.persist()
  showToast('🧹 已清空投射清单（源数据不受影响）')
}
function removeProjection(p: CurationProjection) {
  ensureProjArr()
  d.value.curationProjections = (d.value.curationProjections || []).filter(x => x.id !== p.id)
  if (activeCat.value === 'mirror:' + p.id) activeCat.value = ''
  store.persist()
  showToast('✓ 已移出投射（源数据不受影响）')
}
const wsName = (wsId: string) => d.value.workspaces.find(w => w.id === wsId)?.name || '（工作台已删除）'
const catName = (catId?: string) => d.value.categories.find(c => c.id === catId)?.name || '未分类'

/** R51-F21：分类镜像分组（树节点 + 可改显示名） */
const mirrorGroups = computed(() => projections.value.filter(p => p.kind === 'category'))
const mirrorName = (p: CurationProjection) => p.displayName || catName(p.catId)
const mirrorEditing = ref<{ id: string; name: string } | null>(null)
function startRenameMirror(p: CurationProjection) { mirrorEditing.value = { id: p.id, name: mirrorName(p) } }
function confirmRenameMirror() {
  const e = mirrorEditing.value
  const p = e && projections.value.find(x => x.id === e.id)
  const name = (e?.name || '').trim()
  if (p && name && name !== mirrorName(p)) { p.displayName = name; store.persist(); showToast('✓ 镜像分组显示名已更新（源分类不受影响）') }
  mirrorEditing.value = null
}

/** 待分类投射卡（targetCatId 为空） */
const pendingProjections = computed(() => projections.value.filter(p => p.kind === 'card' && !(p.targetCatId)))
/** 某原生分类下的投射卡 */
const projCardsIn = (catId: string) => projections.value.filter(p => p.kind === 'card' && p.targetCatId === catId)
/** 某镜像分组下的投射卡（targetCatId = 'mirror:'+pid） */
const projCardsInMirror = (pid: string) => projections.value.filter(p => p.kind === 'card' && p.targetCatId === 'mirror:' + pid)
const projTotal = computed(() => projections.value.length)

/** 源卡实时解析（引用式镜像：源删即隐） */
const cardById = (id?: string) => d.value.resources.find(r => r.id === id && !r.deletedAt)
/** 分类投射实时卡片（含子分类） */
function liveCardsOfCat(catId: string): { card: ResourceCard; sub?: string }[] {
  const out: { card: ResourceCard; sub?: string }[] = []
  for (const r of d.value.resources) if (!r.deletedAt && r.categoryId === catId) out.push({ card: r })
  for (const child of d.value.categories.filter(c => c.parentId === catId)) {
    for (const r of d.value.resources) if (!r.deletedAt && r.categoryId === child.id) out.push({ card: r, sub: child.name })
  }
  return out
}
/** 工作台投射：全部分类（含待分类）实时分组 */
function liveGroupsOfWs(wsId: string): { catId: string; name: string; cards: ResourceCard[] }[] {
  const out: { catId: string; name: string; cards: ResourceCard[] }[] = []
  const wsCats = d.value.categories.filter(c => c.workspaceId === wsId).sort((a, b) => a.order - b.order)
  for (const c of wsCats.filter(c => !c.parentId)) {
    out.push({ catId: c.id, name: c.name, cards: d.value.resources.filter(r => !r.deletedAt && (r.categoryId === c.id || wsCats.some(x => x.parentId === c.id && x.id === r.categoryId))) })
  }
  out.push({ catId: '', name: '待分类', cards: d.value.resources.filter(r => !r.deletedAt && r.workspaceId === wsId && !wsCats.some(c => c.id === r.categoryId)) })
  return out
}

// ---- 内容区（按当前视图组装） ----
const viewLabel = computed(() => {
  if (activeCat.value === '') return '📥 未分类'
  if (activeCat.value === PENDING) return '📥 待分类（投射）'
  if (activeCat.value.startsWith('mirror:')) return '📡 ' + mirrorName(projections.value.find(p => p.id === activeCat.value.slice(7)) || ({} as CurationProjection))
  return '📁 ' + (cats.value.find(c => c.id === activeCat.value)?.name || '')
})
const viewNative = computed(() => {
  if (activeCat.value === PENDING || activeCat.value.startsWith('mirror:')) return []
  return cardsIn(activeCat.value)
})
const viewProjCards = computed(() => {
  if (activeCat.value === PENDING) return pendingProjections.value
  if (activeCat.value.startsWith('mirror:')) return projCardsInMirror(activeCat.value.slice(7))
  if (activeCat.value === '') return []
  return projCardsIn(activeCat.value)
})
const viewMirror = computed(() => activeCat.value.startsWith('mirror:') ? projections.value.find(p => p.id === activeCat.value.slice(7)) || null : null)
// R51：分类镜像走树节点（不重复出现在内容区）；工作台镜像为页面级常显分区（R50 语义保留）
const viewProjCats = computed(() => [] as CurationProjection[])
const viewProjWss = computed(() => viewMirror.value ? [] : projections.value.filter(p => p.kind === 'workspace'))

// ---- 卡片打开（原生/镜像共用 WRR 口径） ----
function openCard(r: ResourceCard) {
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    showToast('ℹ 附件卡请到源工作台打开（策展中心为镜像展示）'); return
  }
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) {
    if (r.workspaceId === CURATION_WS_ID) { showToast('ℹ 该卡未设置链接'); return }
    locateSource(r)
    return
  }
  recordResourceOpen(d.value, r)
  store.persist()
  openExternalLink(url)
}
function locateSource(r: ResourceCard) {
  if (r.workspaceId === CURATION_WS_ID) return
  router.push(`/workspace/${r.workspaceId}?cat=${r.categoryId || 'uncat'}`)
  showToast('↗ 已定位到源工作台')
}

// ---- R51-F22：单击详情 / 双击打开链接（260ms 单双击判别，与好奇心卡一致） ----
let clickTimer: ReturnType<typeof setTimeout> | null = null
function onCardClick(fn: () => void) {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return }
  clickTimer = setTimeout(() => { clickTimer = null; fn() }, 260)
}
function onCardDblClick(fn: () => void) {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  fn()
}

// ---- R51-F23：字段池（三类卡字段并集，按 key 去重；排除详情弹窗内建字段） ----
const BUILTIN_KEYS = new Set(['title', 'question', 'link', 'sourceUrl', 'description', 'categoryId', 'workspaceId', 'assets', 'pinned', 'starred'])
const fieldPool = computed<FieldDef[]>(() => {
  const cfg = d.value.fieldConfig
  const map = new Map<string, FieldDef>()
  for (const kind of ['resource', 'task', 'curiosity'] as const) {
    for (const f of (cfg[kind] || [])) {
      if (BUILTIN_KEYS.has(f.key) || map.has(f.key)) continue
      map.set(f.key, f)
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

// ---- 新建/编辑卡片（详情弹窗 = 单击详情 + 字段增删） ----
const cardModal = ref<{ id?: string; title: string; link: string; desc: string; catId: string; fields: { key: string; label: string; type: string; options?: string[]; value: string }[] } | null>(null)
const fieldAdding = ref(false)
function poolLeft(m: { fields: { key: string }[] }) {
  return fieldPool.value.filter(f => !m.fields.some(x => x.key === f.key))
}
function addPoolField(m: typeof cardModal.value & object, key: string) {
  const def = fieldPool.value.find(f => f.key === key)
  if (!def) return
  m.fields.push({ key: def.key, label: def.label, type: def.type, options: def.options, value: '' })
  fieldAdding.value = false
}
function addCustomField(m: typeof cardModal.value & object) {
  const label = fieldCustomLabel.value.trim()
  if (!label) { showToast('⚠ 请输入字段名'); return }
  m.fields.push({ key: 'custom_' + uid('f'), label, type: 'text', value: '' })
  fieldCustomLabel.value = ''
  fieldAdding.value = false
}
const fieldCustomLabel = ref('')
function openCreateCard() {
  cardModal.value = { title: '', link: '', desc: '', catId: (activeCat.value && activeCat.value !== PENDING && !activeCat.value.startsWith('mirror:')) ? activeCat.value : '', fields: [] }
}
function openEditCard(r: ResourceCard) {
  const fields: { key: string; label: string; type: string; options?: string[]; value: string }[] = []
  for (const [k, v] of Object.entries(r.customFields || {})) {
    if (BUILTIN_KEYS.has(k)) continue
    const def = fieldPool.value.find(f => f.key === k)
    fields.push({ key: k, label: def?.label || k.replace(/^custom_/, ''), type: def?.type || 'text', options: def?.options, value: v == null ? '' : String(v) })
  }
  cardModal.value = { id: r.id, title: r.title, link: r.link || '', desc: r.description || '', catId: r.categoryId || '', fields }
}
function confirmCard() {
  const m = cardModal.value
  if (!m) return
  const title = m.title.trim()
  if (!title) { showToast('⚠ 请填写卡片标题'); return }
  const now = Date.now()
  if (m.id) {
    const r = d.value.resources.find(x => x.id === m.id)
    if (r) {
      r.title = title; r.link = m.link.trim(); r.description = m.desc.trim(); r.categoryId = m.catId; r.updatedAt = now
      // R51-F23：已添加字段即使空值也保留（结构即增删语义）
      const cf: Record<string, string> = {}
      for (const f of m.fields) cf[f.key] = f.value.trim()
      r.customFields = cf
    }
    showToast('✓ 卡片已更新')
  } else {
    const cf: Record<string, string> = {}
    for (const f of m.fields) cf[f.key] = f.value.trim()
    d.value.resources.push({
      id: uid('res'), kind: 'resource', title, linkType: 'url', link: m.link.trim(),
      description: m.desc.trim(), workspaceId: CURATION_WS_ID, categoryId: m.catId, tags: [], pinned: false,
      callCount: 0, customFields: cf, createdAt: now, updatedAt: now, curOrder: (cardsIn(m.catId).length)
    } as ResourceCard)
    showToast('✓ 策展卡已创建')
  }
  store.persist()
  cardModal.value = null
}
async function deleteNative(r: ResourceCard) {
  if (!await useConfirm({ message: `删除策展卡「${r.title}」？可到回收站恢复`, confirmText: '删除卡片', danger: true })) return
  r.deletedAt = Date.now()
  store.persist()
  showToast('✓ 已删除（进回收站）')
}
function togglePin(r: ResourceCard) {
  r.pinned = !r.pinned
  store.persist()
}

// ---- 镜像卡详情（只读） ----
const mirrorDetail = ref<{ card: ResourceCard; proj: CurationProjection } | null>(null)

// ---- 拖拽：原生卡排序 + 投射排序 + 跨分类拖拽（R51-F20：投射只改 targetCatId，源数据不动） ----
const dragId = ref('')
function onCardDragStart(e: DragEvent, r: ResourceCard) {
  dragId.value = r.id
  e.dataTransfer?.setData('text/plain', r.id)
}
function onProjDragStart(e: DragEvent, p: CurationProjection) {
  dragId.value = p.id
  e.dataTransfer?.setData('text/plain', p.id)
}
function onCardDrop(e: DragEvent, target: ResourceCard) {
  if (!dragId.value || dragId.value === target.id) { dragId.value = ''; return }
  const list = cardsIn(target.categoryId || '')
  const from = list.findIndex(x => x.id === dragId.value)
  const to = list.findIndex(x => x.id === target.id)
  if (from < 0 || to < 0) { dragId.value = ''; return }
  const moved = list.splice(from, 1)[0]
  list.splice(to, 0, moved)
  list.forEach((x, i) => { x.curOrder = i })
  store.persist()
  dragId.value = ''
}
function moveProjectionTo(pid: string, targetCatId: string) {
  const p = projections.value.find(x => x.id === pid)
  if (!p || p.kind !== 'card') return
  p.targetCatId = targetCatId || undefined
  store.persist()
}
function onTreeDrop(e: DragEvent, catId: string) {
  const id = dragId.value || e.dataTransfer?.getData('text/plain')
  dragId.value = ''
  if (!id) return
  // R51-F20：投射卡跨分类拖拽只改 targetCatId（源数据不动）；原生卡改 categoryId
  const isProj = id.startsWith('curp-') || projections.value.some(x => x.id === id)
  if (isProj) { moveProjectionTo(id, catId); showToast('✓ 投射卡已移入该分类'); return }
  const r = d.value.resources.find(x => x.id === id && x.workspaceId === CURATION_WS_ID)
  if (!r) return
  r.categoryId = catId
  const list = cardsIn(catId)
  list.forEach((x, i) => { x.curOrder = i })
  store.persist()
  showToast('✓ 已移入分类')
}
/** 投射卡拖入镜像分组（targetCatId 指向镜像分组） */
function onMirrorTreeDrop(e: DragEvent, mirrorPid: string) {
  const id = dragId.value || e.dataTransfer?.getData('text/plain')
  dragId.value = ''
  if (!id) return
  if (!id.startsWith('curp-')) { showToast('ℹ 镜像分组只收投射卡（原生卡请拖入策展分类）'); return }
  moveProjectionTo(id, 'mirror:' + mirrorPid)
  showToast('✓ 投射卡已移入镜像分组')
}
function onProjDrop(e: DragEvent, target: CurationProjection) {
  const pid = e.dataTransfer?.getData('text/plain') || dragId.value
  dragId.value = ''
  if (!pid || !pid.startsWith('curp-') || pid === target.id) return
  ensureProjArr()
  const list = [...(d.value.curationProjections || [])]
  const fi = list.findIndex(p => p.id === pid)
  const ti = list.findIndex(p => p.id === target.id)
  if (fi < 0 || ti < 0) return
  const [moved] = list.splice(fi, 1)
  list.splice(ti, 0, moved)
  d.value.curationProjections = list
  store.persist()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="crumb"><b>策展中心</b> · 灵活策展空间</div>
      <div class="spacer" />
      <span class="hint-chip">引用式镜像 · 清空/移出零影响源数据 · 当前投射 {{ projTotal }} 条</span>
      <button class="mini-btn" title="清空全部投射（源数据不受影响）" @click="clearProjections">🧹 清空投射</button>
      <button class="mini-btn primary" @click="openCreateCard">＋ 新建卡片</button>
    </div>

    <div class="cur-layout">
      <!-- 左 · 目录树（R51-F21：默认全展开 + 一键收起/展开 + 镜像分组入树） -->
      <aside class="cur-side">
        <div class="side-title">🗂 策展目录
          <span class="side-tools">
            <span class="cat-act" title="收起全部分类" @click="collapseAllCats">⇤ 收起</span>
            <span class="cat-act" title="展开全部分类" @click="expandAllCats">展开 ⇥</span>
          </span>
        </div>
        <div class="cat-item" :class="{ active: activeCat === '' }" @click="activeCat = ''"
          @dragover.prevent @drop="onTreeDrop($event, '')">
          <span class="cat-caret placeholder" /><span class="cat-icon">📥</span><span class="cat-name">未分类</span>
          <span class="cat-count">{{ cardsIn('').length }}</span>
        </div>
        <div class="cat-item" :class="{ active: activeCat === PENDING }" @click="activeCat = PENDING"
          @dragover.prevent @drop="onTreeDrop($event, '')">
          <span class="cat-caret placeholder" /><span class="cat-icon">📡</span><span class="cat-name">待分类</span>
          <span class="cat-count">{{ pendingProjections.length }}</span>
        </div>
        <div class="cat-divider" />
        <template v-for="c in rootCats" :key="c.id">
          <div class="cat-item" :class="{ active: activeCat === c.id }"
            @click="activeCat = c.id"
            @dragover.prevent @drop="onTreeDrop($event, c.id)">
            <span v-if="childCats(c.id).length" class="cat-caret" :class="{ open: expandedCats.has(c.id) }" @click.stop="toggleExpand(c.id)">▸</span>
            <span v-else class="cat-caret placeholder" />
            <span class="cat-icon">{{ childCats(c.id).length ? (expandedCats.has(c.id) ? '📂' : '📁') : '📁' }}</span>
            <template v-if="catEditing?.id === c.id">
              <input v-model="catEditing.name" class="cat-edit" v-focus @keydown.enter.prevent="confirmRenameCat" @keydown.esc="catEditing = null" @blur="confirmRenameCat" />
            </template>
            <template v-else>
              <span class="cat-name">{{ c.name }}</span>
            </template>
            <span class="cat-actions">
              <span class="cat-act" title="创建子分类" @click.stop="startCreateCat(c.id)">＋</span>
              <span class="cat-act" title="重命名" @click.stop="startRenameCat(c)">✎</span>
              <span class="cat-act danger" title="删除分类" @click.stop="deleteCat(c)">🗑</span>
            </span>
            <span class="cat-count">{{ catAggCount(c.id) }}</span>
          </div>
          <template v-if="expandedCats.has(c.id)">
            <div v-for="ch in childCats(c.id)" :key="ch.id" class="cat-item sub" :class="{ active: activeCat === ch.id }"
              @click="activeCat = ch.id" @dragover.prevent @drop="onTreeDrop($event, ch.id)">
              <span class="cat-caret placeholder" />
              <span class="cat-icon">↳</span>
              <template v-if="catEditing?.id === ch.id">
                <input v-model="catEditing.name" class="cat-edit" v-focus @keydown.enter.prevent="confirmRenameCat" @keydown.esc="catEditing = null" @blur="confirmRenameCat" />
              </template>
              <template v-else>
                <span class="cat-name">{{ ch.name }}</span>
              </template>
              <span class="cat-actions">
                <span class="cat-act" title="重命名" @click.stop="startRenameCat(ch)">✎</span>
                <span class="cat-act danger" title="删除分类" @click.stop="deleteCat(ch)">🗑</span>
              </span>
              <span class="cat-count">{{ cardsIn(ch.id).length }}</span>
            </div>
          </template>
        </template>
        <!-- R51-F25：分类镜像分组（树节点，显示名可改、可移出投射、可收投射卡） -->
        <template v-if="mirrorGroups.length">
          <div class="cat-divider" />
          <div class="side-title">📡 镜像分组</div>
          <template v-for="p in mirrorGroups" :key="p.id">
            <div class="cat-item mirror-node" :class="{ active: activeCat === 'mirror:' + p.id }"
              @click="activeCat = 'mirror:' + p.id"
              @dragover.prevent @drop="onMirrorTreeDrop($event, p.id)">
              <span class="cat-caret placeholder" />
              <span class="cat-icon">📡</span>
              <template v-if="mirrorEditing?.id === p.id">
                <input v-model="mirrorEditing.name" class="cat-edit" v-focus @keydown.enter.prevent="confirmRenameMirror" @keydown.esc="mirrorEditing = null" @blur="confirmRenameMirror" />
              </template>
              <template v-else>
                <span class="cat-name">{{ mirrorName(p) }}</span>
              </template>
              <span class="cat-actions">
                <span class="cat-act" title="改显示名（源分类不受影响）" @click.stop="startRenameMirror(p)">✎</span>
                <span class="cat-act danger" title="移出投射（源数据不受影响）" @click.stop="removeProjection(p)">✕</span>
              </span>
              <span class="cat-count">{{ liveCardsOfCat(p.catId!).length + projCardsInMirror(p.id).length }}</span>
            </div>
          </template>
        </template>
        <div v-if="catCreating" class="cat-creating">
          <input v-model="catCreating.name" class="cat-edit" placeholder="分类名称，回车确认" v-focus
            @keydown.enter.prevent="confirmCreateCat" @keydown.esc="catCreating = null" @blur="confirmCreateCat" />
        </div>
        <div class="cat-add" @click="startCreateCat()"><span>＋</span><span>新建分类</span></div>
      </aside>

      <!-- 右 · 内容区 -->
      <div class="cur-main">
        <div class="cur-sec-label">
          {{ viewLabel }}
          <span>原生 {{ viewNative.length }} · 投射 {{ viewProjCards.length + viewProjCats.length + viewProjWss.length }}</span>
        </div>

        <!-- 原生卡片区 -->
        <div class="cur-grid">
          <div v-for="r in viewNative" :key="r.id" class="cur-card native" :class="{ pinned: r.pinned }"
            draggable @dragstart="onCardDragStart($event, r)" @dragover.prevent @drop="onCardDrop($event, r)"
            @click="onCardClick(() => openEditCard(r))" @dblclick="onCardDblClick(() => openCard(r))"
            :title="'单击详情 · 双击打开链接'">
            <div class="cc-title">
              <span v-if="r.pinned" class="cc-pin">📌</span>{{ r.title }}
            </div>
            <div v-if="r.link" class="cc-link">{{ r.link }}</div>
            <div v-if="r.description" class="cc-desc">{{ r.description }}</div>
            <div v-if="Object.keys(r.customFields || {}).length" class="cc-fields">
              <span v-for="(v, k) in r.customFields" :key="k" class="cc-field-chip">{{ v }}</span>
            </div>
            <div class="cc-tools">
              <span v-if="r.link" class="cc-act" title="打开链接" @click.stop="openCard(r)">↗</span>
              <span class="cc-act" :class="{ on: r.pinned }" :title="r.pinned ? '取消置顶' : '置顶'" @click.stop="togglePin(r)">📌</span>
              <span class="cc-act" title="编辑" @click.stop="openEditCard(r)">✎</span>
              <span class="cc-act danger" title="删除（进回收站）" @click.stop="deleteNative(r)">🗑</span>
            </div>
          </div>
          <div v-if="!viewNative.length && activeCat !== PENDING && !viewMirror" class="cur-empty-native">暂无原生卡片 —— 右上角「＋ 新建卡片」创建策展卡</div>
        </div>

        <!-- R51-F25：视图内投射卡（待分类 / 分类 / 镜像分组） -->
        <template v-if="viewProjCards.length">
          <div class="cur-sec-label proj">📡 投射卡片 <span>{{ viewProjCards.length }}</span></div>
          <div class="cur-grid">
            <div v-for="p in viewProjCards" :key="p.id" class="cur-card mirror"
              draggable @dragstart="onProjDragStart($event, p)" @dragover.prevent @drop="onProjDrop($event, p)"
              @click="cardById(p.cardId) && onCardClick(() => { mirrorDetail = { card: cardById(p.cardId)!, proj: p } })"
              @dblclick="cardById(p.cardId) && onCardDblClick(() => openCard(cardById(p.cardId)!))"
              title="单击详情 · 双击打开链接">
              <template v-if="cardById(p.cardId)">
                <div class="cc-title"><span class="cc-badge">📡</span>{{ cardById(p.cardId)!.title }}<span class="cc-src">· {{ wsName(p.wsId) }}</span></div>
                <div v-if="cardById(p.cardId)!.link" class="cc-link">{{ cardById(p.cardId)!.link }}</div>
                <div v-if="cardById(p.cardId)!.description" class="cc-desc">{{ cardById(p.cardId)!.description }}</div>
                <div class="cc-tools">
                  <span class="cc-act" title="打开链接" @click.stop="openCard(cardById(p.cardId)!)">↗</span>
                  <span class="cc-act" title="定位到源工作台" @click.stop="locateSource(cardById(p.cardId)!)">🎯</span>
                  <span class="cc-act danger" title="移出投射（源数据不受影响）" @click.stop="removeProjection(p)">✕</span>
                </div>
              </template>
              <template v-else>
                <div class="cc-title cc-gone">📡 源卡已删除/移出 <span class="cc-src">· {{ wsName(p.wsId) }}</span></div>
                <div class="cc-tools"><span class="cc-act danger" title="移出投射" @click.stop="removeProjection(p)">✕</span></div>
              </template>
            </div>
          </div>
        </template>

        <!-- 视图内工作台镜像 -->
        <template v-if="viewProjWss.length">
          <div class="cur-sec-label proj">📡 投射工作台 <span>{{ viewProjWss.length }}</span></div>
          <div v-for="p in viewProjWss" :key="p.id" class="proj-group">
            <div class="pg-head">
              <span class="pg-badge">🗃</span>
              <span class="pg-name">{{ wsName(p.wsId) }}</span>
              <span class="pg-src">整个工作台 · 实时镜像</span>
              <span class="spacer" />
              <span class="cc-act danger" title="移出投射（源数据不受影响）" @click="removeProjection(p)">✕</span>
            </div>
            <div v-for="g in liveGroupsOfWs(p.wsId)" :key="g.catId || '__uncat__'" class="pg-cat">
              <div class="pg-cat-name">📁 {{ g.name }} <span>{{ g.cards.length }}</span></div>
              <div class="cur-grid">
                <div v-for="r in g.cards" :key="r.id" class="cur-card mirror" title="单击详情 · 双击打开链接"
                  @click="onCardClick(() => { mirrorDetail = { card: r, proj: p } })" @dblclick="onCardDblClick(() => openCard(r))">
                  <div class="cc-title">{{ r.title }}</div>
                  <div v-if="r.link" class="cc-link">{{ r.link }}</div>
                  <div class="cc-tools">
                    <span class="cc-act" title="打开链接" @click.stop="openCard(r)">↗</span>
                    <span class="cc-act" title="定位到源工作台" @click.stop="locateSource(r)">🎯</span>
                  </div>
                </div>
                <div v-if="!g.cards.length" class="cur-empty-native">该分类暂无卡片</div>
              </div>
            </div>
          </div>
        </template>

        <!-- 镜像分组视图内容 -->
        <template v-if="viewMirror">
          <div class="proj-group">
            <div class="pg-head">
              <span class="pg-badge">📡</span>
              <span class="pg-name">{{ mirrorName(viewMirror) }}</span>
              <span class="pg-src">{{ wsName(viewMirror.wsId) }} · 实时镜像 {{ liveCardsOfCat(viewMirror.catId!).length }} 卡</span>
              <span class="spacer" />
              <span class="cc-act" title="改显示名（源分类不受影响）" @click="startRenameMirror(viewMirror)">✎</span>
              <span class="cc-act danger" title="移出投射（源数据不受影响）" @click="removeProjection(viewMirror)">✕</span>
            </div>
            <div class="cur-grid">
              <div v-for="it in liveCardsOfCat(viewMirror.catId!)" :key="it.card.id" class="cur-card mirror" title="单击详情 · 双击打开链接"
                @click="onCardClick(() => { mirrorDetail = { card: it.card, proj: viewMirror! } })" @dblclick="onCardDblClick(() => openCard(it.card))">
                <div class="cc-title"><span v-if="it.sub" class="cc-subcat">↳{{ it.sub }}</span>{{ it.card.title }}</div>
                <div v-if="it.card.link" class="cc-link">{{ it.card.link }}</div>
                <div class="cc-tools">
                  <span class="cc-act" title="打开链接" @click.stop="openCard(it.card)">↗</span>
                  <span class="cc-act" title="定位到源工作台" @click.stop="locateSource(it.card)">🎯</span>
                </div>
              </div>
              <div v-if="!liveCardsOfCat(viewMirror.catId!).length && !viewProjCards.length" class="cur-empty-native">源分类当前没有卡片（实时镜像，源增卡即显）</div>
            </div>
          </div>
        </template>

        <div v-if="!viewNative.length && !viewProjCards.length && !viewProjCats.length && !viewProjWss.length && !viewMirror" class="cur-empty">
          当前分类还是空的 —— 从其他工作台右键卡片/分类「投射到策展中心」，或在这里新建原生卡片
        </div>
      </div>
    </div>

    <!-- 新建/编辑卡片弹窗（R51-F22 详情 + R51-F23 自定义字段增删） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="cardModal" class="modal-mask" @click.self="cardModal = null">
          <div class="modal-card">
            <div class="mc-title">{{ cardModal.id ? '✎ 卡片详情' : '＋ 新建策展卡' }}</div>
            <div class="mc-field"><label>标题 *</label><input v-model="cardModal.title" placeholder="卡片标题" v-focus @keydown.enter.prevent="confirmCard" /></div>
            <div class="mc-field"><label>链接</label><input v-model="cardModal.link" placeholder="https://…（可留空）" /></div>
            <div class="mc-field"><label>描述</label><textarea v-model="cardModal.desc" rows="3" placeholder="策展备注（可留空）" /></div>
            <div class="mc-field"><label>所属分类</label>
              <select v-model="cardModal.catId">
                <option value="">未分类</option>
                <option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <!-- R51-F23：自定义字段（字段池 = 三类卡字段并集，可增删） -->
            <div v-if="cardModal.fields.length" class="mc-fields">
              <div v-for="(f, fi) in cardModal.fields" :key="f.key" class="mc-field mc-custom">
                <label>{{ f.label }}
                  <span class="mc-field-rm" title="移除该字段" @click="cardModal.fields.splice(fi, 1)">✕</span>
                </label>
                <select v-if="f.type === 'select' && f.options?.length" v-model="f.value">
                  <option value="">（未设置）</option>
                  <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                </select>
                <input v-else-if="f.type === 'date'" type="date" v-model="f.value" />
                <input v-else v-model="f.value" :placeholder="f.label" />
              </div>
            </div>
            <div class="mc-addfield">
              <template v-if="fieldAdding && cardModal">
                <select class="mc-pool-select" @change="addPoolField(cardModal as any, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
                  <option value="">从字段池选择…</option>
                  <option v-for="f in poolLeft(cardModal)" :key="f.key" :value="f.key">{{ f.label }}</option>
                </select>
                <input v-model="fieldCustomLabel" class="mc-pool-input" placeholder="或自定义字段名，回车添加"
                  @keydown.enter.prevent="addCustomField(cardModal as any)" />
                <button class="mini-btn" @click="fieldAdding = false">取消</button>
              </template>
              <template v-else>
                <span class="mc-add-btn" @click="fieldAdding = true">＋ 添加字段（字段池 / 自定义）</span>
              </template>
            </div>
            <div class="mc-foot">
              <button class="mini-btn" @click="cardModal = null">取消</button>
              <button class="mini-btn primary" @click="confirmCard">{{ cardModal.id ? '保存' : '创建' }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 镜像卡详情（只读，R51-F22） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="mirrorDetail" class="modal-mask" @click.self="mirrorDetail = null">
          <div class="modal-card">
            <div class="mc-title">📡 镜像卡详情</div>
            <div class="mc-field"><label>标题</label><div class="mc-ro">{{ mirrorDetail.card.title }}</div></div>
            <div v-if="mirrorDetail.card.link" class="mc-field"><label>链接</label><div class="mc-ro">{{ mirrorDetail.card.link }}</div></div>
            <div v-if="mirrorDetail.card.description" class="mc-field"><label>描述</label><div class="mc-ro">{{ mirrorDetail.card.description }}</div></div>
            <div class="mc-field"><label>来源</label><div class="mc-ro">{{ wsName(mirrorDetail.proj.wsId) }} · {{ catName(mirrorDetail.card.categoryId) }}</div></div>
            <div class="mc-foot">
              <button class="mini-btn" @click="locateSource(mirrorDetail.card)">🎯 定位源卡</button>
              <button class="mini-btn primary" @click="openCard(mirrorDetail.card); mirrorDetail = null">↗ 打开链接</button>
              <button class="mini-btn" @click="mirrorDetail = null">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 48px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-left: 22px; }
.page-head .crumb { font-size: 13px; color: var(--text-2); flex: 1; }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 19px; letter-spacing: .3px; }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }
.mini-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12px; border-radius: 8px; padding: 5px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: all .15s; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }

.cur-layout { display: flex; gap: 16px; align-items: flex-start; }
.cur-side { width: 240px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; position: sticky; top: 72px; max-height: calc(100vh - 96px); overflow-y: auto; }
.side-title { font-size: 11px; font-weight: 700; letter-spacing: .5px; color: var(--text-3); padding: 4px 8px 10px; display: flex; align-items: center; justify-content: space-between; }
.side-tools { display: inline-flex; gap: 6px; font-weight: 500; }
.cat-item { display: flex; align-items: center; gap: 7px; padding: 7px 8px; border-radius: 8px; cursor: pointer; font-size: 12.5px; color: var(--text-2); transition: background .12s; }
.cat-item:hover { background: var(--surface-2); }
.cat-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.cat-item.mirror-node { color: color-mix(in srgb, var(--accent) 80%, var(--text-2)); }
.cat-item.sub { padding-left: 30px; }
.cat-caret { width: 14px; text-align: center; font-size: 10px; color: var(--text-3); transition: transform .15s; flex-shrink: 0; }
.cat-caret.open { transform: rotate(90deg); }
.cat-caret.placeholder { visibility: hidden; }
.cat-icon { font-size: 13px; flex-shrink: 0; }
.cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-count { font-size: 10.5px; color: var(--text-4); font-variant-numeric: tabular-nums; }
.cat-actions { display: none; gap: 2px; flex-shrink: 0; }
.cat-item:hover .cat-actions { display: inline-flex; }
.cat-act { font-size: 11px; color: var(--text-3); cursor: pointer; padding: 1px 3px; border-radius: 4px; }
.cat-act:hover { color: var(--accent); background: var(--surface-3); }
.cat-act.danger:hover { color: #F85149; }
.cat-edit { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--accent); border-radius: 6px; padding: 3px 7px; font-size: 12px; color: var(--text); outline: none; font-family: inherit; }
.cat-creating { padding: 6px 8px; }
.cat-divider { height: 1px; background: var(--border); margin: 8px 4px; }
.cat-add { display: flex; align-items: center; gap: 7px; padding: 7px 8px; border-radius: 8px; cursor: pointer; font-size: 12px; color: var(--text-3); margin-top: 4px; }
.cat-add:hover { background: var(--surface-2); color: var(--accent); }

.cur-main { flex: 1; min-width: 0; }
.cur-sec-label { font-size: 12px; font-weight: 700; color: var(--text-2); margin: 4px 0 10px; display: flex; align-items: center; gap: 8px; }
.cur-sec-label span { font-size: 10.5px; font-weight: 500; color: var(--text-4); }
.cur-sec-label.proj { margin-top: 22px; color: var(--accent); }
.cur-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.cur-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 6px; }
.cur-card:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.cur-card.native { border-left: 3px solid var(--accent); }
.cur-card.native.pinned { background: color-mix(in srgb, var(--accent) 5%, var(--surface)); }
.cur-card.mirror { border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--border)); background: color-mix(in srgb, var(--surface) 92%, var(--accent-light)); }
.cc-title { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.45; word-break: break-all; display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
.cc-badge { font-size: 11px; flex-shrink: 0; }
.cc-src { font-size: 10px; color: var(--text-4); font-weight: 400; }
.cc-subcat { font-size: 10px; color: var(--text-4); font-weight: 500; flex-shrink: 0; }
.cc-link { font-size: 10.5px; color: var(--text-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-desc { font-size: 11px; color: var(--text-3); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cc-fields { display: flex; flex-wrap: wrap; gap: 4px; }
.cc-field-chip { font-size: 10px; color: var(--text-3); background: var(--surface-2); border: 1px solid var(--border); border-radius: 99px; padding: 1px 7px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-gone { color: var(--text-4); font-weight: 500; }
.cc-pin { font-size: 11px; }
.cc-tools { position: absolute; top: 6px; right: 8px; display: none; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 2px; box-shadow: 0 1px 4px rgba(0,0,0,.12); z-index: 2; }
.cur-card:hover .cc-tools { display: inline-flex; }
.cc-act { font-size: 11px; color: var(--text-3); cursor: pointer; padding: 2px 5px; border-radius: 5px; }
.cc-act:hover { color: var(--accent); background: var(--surface-3); }
.cc-act.on { color: var(--accent); }
.cc-act.danger:hover { color: #F85149; }

.proj-group { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 12px; }
.pg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.pg-badge { font-size: 13px; }
.pg-name { font-size: 13px; font-weight: 600; color: var(--text); }
.pg-src { font-size: 10.5px; color: var(--text-4); }
.pg-head .spacer { flex: 1; }
.pg-cat { margin-top: 12px; }
.pg-cat-name { font-size: 11.5px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
.pg-cat-name span { font-size: 10px; color: var(--text-4); font-weight: 400; margin-left: 4px; }

.cur-empty-native { grid-column: 1 / -1; text-align: center; padding: 18px; font-size: 12px; color: var(--text-4); border: 1px dashed var(--border); border-radius: var(--radius-sm); }
.cur-empty { text-align: center; padding: 60px 20px; font-size: 13px; color: var(--text-4); border: 1px dashed var(--border); border-radius: var(--radius-sm); margin-top: 8px; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 300; display: flex; align-items: center; justify-content: center; }
.modal-card { width: 440px; max-width: 92vw; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 20px 22px; max-height: 86vh; overflow-y: auto; }
.mc-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 14px; }
.mc-field { margin-bottom: 12px; }
.mc-field label { display: block; font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 5px; }
.mc-field input, .mc-field textarea, .mc-field select { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px; font-size: 12.5px; color: var(--text); outline: none; font-family: inherit; resize: vertical; }
.mc-field input:focus, .mc-field textarea:focus { border-color: var(--accent); }
.mc-ro { font-size: 12.5px; color: var(--text-2); background: var(--surface-2); border-radius: 8px; padding: 8px 11px; word-break: break-all; }
.mc-custom label { display: flex; align-items: center; justify-content: space-between; }
.mc-field-rm { font-size: 10.5px; color: var(--text-4); cursor: pointer; padding: 1px 5px; border-radius: 4px; }
.mc-field-rm:hover { color: #F85149; background: var(--surface-3); }
.mc-addfield { margin: 4px 0 0; }
.mc-add-btn { font-size: 11.5px; color: var(--accent); cursor: pointer; }
.mc-add-btn:hover { text-decoration: underline; }
.mc-pool-select { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--text); outline: none; font-family: inherit; }
.mc-pool-input { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--text); outline: none; font-family: inherit; }
.mc-addfield template > * { display: inline-block; }
.mc-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.fade-enter-active, .fade-leave-active { transition: opacity .18s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
