<script setup lang="ts">
/**
 * R50-F3 策展中心 · 灵活策展空间（原资源台）
 * - 引用式镜像：卡片/分类/整个工作台从其他工作台投射而来，实时同步显示；移出/清空零影响源数据
 * - 原生内容：自有分类树（增删改）+ 原生卡片（新建/编辑/置顶/拖拽排序/删除），与投射卡视觉区分
 * - 页面结构与工作台一致（左目录树 + 右内容区）
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { CURATION_WS_ID, type ResourceCard, type Category, type CurationProjection } from '@/shared/models'
import { uid } from '@/shared/utils'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { recordResourceOpen } from '@/shared/storage/stats'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'

const router = useRouter()
const store = useAppStore()
const d = useCompass().d
const vFocus = { mounted: (el: HTMLElement) => el.focus() }

// ---- 分类树（策展中心自有，2 级） ----
const cats = computed(() => d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID).sort((a, b) => a.order - b.order))
const rootCats = computed(() => cats.value.filter(c => !c.parentId))
const childCats = (pid: string) => cats.value.filter(c => c.parentId === pid)
const activeCat = ref('')
const expandedCats = ref<Set<string>>(new Set())
const catAggCount = (pid: string) =>
  d.value.resources.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID && (r.categoryId === pid || childCats(pid).some(c => c.id === r.categoryId))).length
function toggleExpand(id: string) {
  if (expandedCats.value.has(id)) expandedCats.value.delete(id)
  else expandedCats.value.add(id)
}

// ---- 分类 CRUD ----
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
function moveCat(cat: Category, targetCatId: string) {
  if (cat.id === targetCatId) return
  cat.parentId = targetCatId || undefined
  store.persist()
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
  store.persist()
  showToast('🧹 已清空投射清单（源数据不受影响）')
}
function removeProjection(p: CurationProjection) {
  ensureProjArr()
  d.value.curationProjections = (d.value.curationProjections || []).filter(x => x.id !== p.id)
  store.persist()
  showToast('✓ 已移出投射（源数据不受影响）')
}
const wsName = (wsId: string) => d.value.workspaces.find(w => w.id === wsId)?.name || '（工作台已删除）'
const catName = (catId?: string) => d.value.categories.find(c => c.id === catId)?.name || '未分类'

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

// ---- 当前分类内容（原生 + 投射） ----
const projInCat = computed(() => projections.value.filter(p => (p.targetCatId || '') === activeCat.value))
const projCards = computed(() => projInCat.value.filter(p => p.kind === 'card'))
const projCats = computed(() => projInCat.value.filter(p => p.kind === 'category'))
const projWss = computed(() => projInCat.value.filter(p => p.kind === 'workspace'))
const projTotal = computed(() => projections.value.length)

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

// ---- 新建/编辑卡片 ----
const cardModal = ref<{ id?: string; title: string; link: string; desc: string; catId: string } | null>(null)
function openCreateCard() { cardModal.value = { title: '', link: '', desc: '', catId: activeCat.value || '' } }
function openEditCard(r: ResourceCard) { cardModal.value = { id: r.id, title: r.title, link: r.link || '', desc: r.description || '', catId: r.categoryId || '' } }
function confirmCard() {
  const m = cardModal.value
  if (!m) return
  const title = m.title.trim()
  if (!title) { showToast('⚠ 请填写卡片标题'); return }
  if (m.id) {
    const r = d.value.resources.find(x => x.id === m.id)
    if (r) { r.title = title; r.link = m.link.trim(); r.description = m.desc.trim(); r.categoryId = m.catId; r.updatedAt = Date.now() }
    showToast('✓ 卡片已更新')
  } else {
    const now = Date.now()
    d.value.resources.push({
      id: uid('res'), kind: 'resource', title, linkType: m.link.trim() ? 'url' : 'url', link: m.link.trim(),
      description: m.desc.trim(), workspaceId: CURATION_WS_ID, categoryId: m.catId, tags: [], pinned: false,
      callCount: 0, customFields: {}, createdAt: now, updatedAt: now, curOrder: (cardsIn(m.catId).length)
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

// ---- 拖拽：原生卡排序 + 投射排序 + 拖入分类 ----
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
function onTreeDrop(e: DragEvent, catId: string) {
  const id = dragId.value || e.dataTransfer?.getData('text/plain')
  dragId.value = ''
  const r = d.value.resources.find(x => x.id === id && x.workspaceId === CURATION_WS_ID)
  if (!r) return
  r.categoryId = catId
  const list = cardsIn(catId)
  list.forEach((x, i) => { x.curOrder = i })
  store.persist()
  showToast('✓ 已移入分类')
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
      <!-- 左 · 目录树（策展中心自有，增删改） -->
      <aside class="cur-side">
        <div class="side-title">🗂 策展目录</div>
        <div class="cat-item" :class="{ active: activeCat === '' }" @click="activeCat = ''">
          <span class="cat-icon">📥</span><span class="cat-name">未分类</span>
          <span class="cat-count">{{ cardsIn('').length }}</span>
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
        <div v-if="catCreating" class="cat-creating">
          <input v-model="catCreating.name" class="cat-edit" placeholder="分类名称，回车确认" v-focus
            @keydown.enter.prevent="confirmCreateCat" @keydown.esc="catCreating = null" @blur="confirmCreateCat" />
        </div>
        <div class="cat-add" @click="startCreateCat()"><span>＋</span><span>新建分类</span></div>
      </aside>

      <!-- 右 · 内容区 -->
      <div class="cur-main">
        <div class="cur-sec-label">
          {{ activeCat === '' ? '📥 未分类' : '📁 ' + (cats.find(c => c.id === activeCat)?.name || '') }}
          <span>原生 {{ cardsIn(activeCat).length }} · 投射 {{ projInCat.length }}</span>
        </div>

        <!-- 原生卡片区（与其他工作台一致的置顶/拖拽排序） -->
        <div class="cur-grid">
          <div v-for="r in cardsIn(activeCat)" :key="r.id" class="cur-card native" :class="{ pinned: r.pinned }"
            draggable @dragstart="onCardDragStart($event, r)" @dragover.prevent @drop="onCardDrop($event, r)"
            @dblclick="openCard(r)" :title="r.link ? '双击打开链接' : ''">
            <div class="cc-title">
              <span v-if="r.pinned" class="cc-pin">📌</span>{{ r.title }}
            </div>
            <div v-if="r.link" class="cc-link">{{ r.link }}</div>
            <div v-if="r.description" class="cc-desc">{{ r.description }}</div>
            <div class="cc-tools">
              <span v-if="r.link" class="cc-act" title="打开链接" @click.stop="openCard(r)">↗</span>
              <span class="cc-act" :class="{ on: r.pinned }" :title="r.pinned ? '取消置顶' : '置顶'" @click.stop="togglePin(r)">📌</span>
              <span class="cc-act" title="编辑" @click.stop="openEditCard(r)">✎</span>
              <span class="cc-act danger" title="删除（进回收站）" @click.stop="deleteNative(r)">🗑</span>
            </div>
          </div>
          <div v-if="!cardsIn(activeCat).length" class="cur-empty-native">暂无原生卡片 —— 右上角「＋ 新建卡片」创建策展卡</div>
        </div>

        <!-- 投射区：单卡镜像 -->
        <template v-if="projCards.length">
          <div class="cur-sec-label proj">📡 投射卡片 <span>{{ projCards.length }}</span></div>
          <div class="cur-grid">
            <div v-for="p in projCards" :key="p.id" class="cur-card mirror"
              draggable @dragstart="onProjDragStart($event, p)" @dragover.prevent @drop="onProjDrop($event, p)">
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

        <!-- 投射区：分类整组镜像 -->
        <template v-if="projCats.length">
          <div class="cur-sec-label proj">📡 投射分类 <span>{{ projCats.length }}</span></div>
          <div v-for="p in projCats" :key="p.id" class="proj-group">
            <div class="pg-head">
              <span class="pg-badge">📡</span>
              <span class="pg-name">{{ catName(p.catId) }}</span>
              <span class="pg-src">{{ wsName(p.wsId) }} · 实时镜像 {{ liveCardsOfCat(p.catId!).length }} 卡</span>
              <span class="spacer" />
              <span class="cc-act danger" title="移出投射（源数据不受影响）" @click="removeProjection(p)">✕</span>
            </div>
            <div class="cur-grid">
              <div v-for="it in liveCardsOfCat(p.catId!)" :key="it.card.id" class="cur-card mirror" :title="it.card.link ? '双击打开链接' : ''" @dblclick="openCard(it.card)">
                <div class="cc-title"><span v-if="it.sub" class="cc-subcat">↳{{ it.sub }}</span>{{ it.card.title }}</div>
                <div v-if="it.card.link" class="cc-link">{{ it.card.link }}</div>
                <div class="cc-tools">
                  <span class="cc-act" title="打开链接" @click.stop="openCard(it.card)">↗</span>
                  <span class="cc-act" title="定位到源工作台" @click.stop="locateSource(it.card)">🎯</span>
                </div>
              </div>
              <div v-if="!liveCardsOfCat(p.catId!).length" class="cur-empty-native">源分类当前没有卡片（实时镜像，源增卡即显）</div>
            </div>
          </div>
        </template>

        <!-- 投射区：工作台镜像 -->
        <template v-if="projWss.length">
          <div class="cur-sec-label proj">📡 投射工作台 <span>{{ projWss.length }}</span></div>
          <div v-for="p in projWss" :key="p.id" class="proj-group">
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
                <div v-for="r in g.cards" :key="r.id" class="cur-card mirror" :title="r.link ? '双击打开链接' : ''" @dblclick="openCard(r)">
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

        <div v-if="!cardsIn(activeCat).length && !projInCat.length" class="cur-empty">
          当前分类还是空的 —— 从其他工作台右键卡片/分类「投射到策展中心」，或在这里新建原生卡片
        </div>
      </div>
    </div>

    <!-- 新建/编辑卡片弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="cardModal" class="modal-mask" @click.self="cardModal = null">
          <div class="modal-card">
            <div class="mc-title">{{ cardModal.id ? '✎ 编辑策展卡' : '＋ 新建策展卡' }}</div>
            <div class="mc-field"><label>标题 *</label><input v-model="cardModal.title" placeholder="卡片标题" v-focus @keydown.enter.prevent="confirmCard" /></div>
            <div class="mc-field"><label>链接</label><input v-model="cardModal.link" placeholder="https://…（可留空）" /></div>
            <div class="mc-field"><label>描述</label><textarea v-model="cardModal.desc" rows="3" placeholder="策展备注（可留空）" /></div>
            <div class="mc-field"><label>所属分类</label>
              <select v-model="cardModal.catId">
                <option value="">未分类</option>
                <option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="mc-foot">
              <button class="mini-btn" @click="cardModal = null">取消</button>
              <button class="mini-btn primary" @click="confirmCard">{{ cardModal.id ? '保存' : '创建' }}</button>
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
.page-head .crumb b { color: var(--text); font-weight: 600; font-size: 15px; }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }
.mini-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12px; border-radius: 8px; padding: 5px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: all .15s; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }

.cur-layout { display: flex; gap: 16px; align-items: flex-start; }
.cur-side { width: 240px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; position: sticky; top: 72px; max-height: calc(100vh - 96px); overflow-y: auto; }
.side-title { font-size: 11px; font-weight: 700; letter-spacing: .5px; color: var(--text-3); padding: 4px 8px 10px; }
.cat-item { display: flex; align-items: center; gap: 7px; padding: 7px 8px; border-radius: 8px; cursor: pointer; font-size: 12.5px; color: var(--text-2); transition: background .12s; }
.cat-item:hover { background: var(--surface-2); }
.cat-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
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
.modal-card { width: 440px; max-width: 92vw; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 20px 22px; }
.mc-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 14px; }
.mc-field { margin-bottom: 12px; }
.mc-field label { display: block; font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 5px; }
.mc-field input, .mc-field textarea, .mc-field select { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px; font-size: 12.5px; color: var(--text); outline: none; font-family: inherit; resize: vertical; }
.mc-field input:focus, .mc-field textarea:focus { border-color: var(--accent); }
.mc-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.fade-enter-active, .fade-leave-active { transition: opacity .18s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
