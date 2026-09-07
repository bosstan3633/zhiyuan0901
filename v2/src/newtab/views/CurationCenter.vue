<script setup lang="ts">
/**
 * R50-F3 + R51 + R52 + R53-A2 策展中心 · 灵活策展空间
 * - R53-A2 统一树：镜像分类物化为带 curFrom 的**真实策展分类**（migrateCurationTree 启动期迁移），
 *   与原生分类同构——同一颗树、自由混排、拖拽排序、拖拽成父子（最多 2 级）
 * - R53-A2/E2：卡片自由拖拽——原生卡/投射卡均可拖入任意策展分类（含镜像分类）；
 *   删除分类/移出投射/清空投射时，停入的卡与投射引用一律回落（待分类/未分类），杜绝孤儿引用
 * - R52-F7a：整工作台镜像 = 分类镜像打包版（App.vue 物化，源后续变更不自动同步）
 * - R51-F25：单卡投射落入「待分类」；R51-F22：单击出详情、双击打开链接；R51-F23：自定义字段池
 * - 原生内容：新建/编辑/置顶/拖拽排序/删除；源数据零影响
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

// ---- 视图选择：''=未分类 '__pending__'=待分类 分类id=策展分类（原生/镜像同构） ----
const PENDING = '__pending__'
const activeCat = ref('')

// ---- 分类树（策展中心自有，2 级；镜像分类=带 curFrom 的真实分类，与原生同构） ----
const cats = computed(() => d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
const rootCats = computed(() => cats.value.filter(c => !c.parentId))
const childCats = (pid: string) => cats.value.filter(c => c.parentId === pid)
const isMirror = (c: Category) => !!c.curFrom
const mirrorSourceLabel = (c: Category) => c.curFrom ? `${wsName(c.curFrom.wsId)} · ${catName(c.curFrom.catId)}` : ''

// R51-F21 + R53：默认全部展开；一键收起/展开
const expandedCats = ref<Set<string>>(new Set())
watch(rootCats, (roots) => { for (const c of roots) expandedCats.value.add(c.id) }, { immediate: true })
function toggleExpand(id: string) {
  if (expandedCats.value.has(id)) expandedCats.value.delete(id)
  else expandedCats.value.add(id)
}
function expandAllCats() { for (const c of cats.value) expandedCats.value.add(c.id) }
function collapseAllCats() { expandedCats.value.clear() }

// ---- 节点计数（自身原生卡 + 自身投射卡 + 未投射源卡 + 子级聚合；R56-A：镜像分类不再双计已投射源卡） ----
function nodeCount(c: Category): number {
  let n = cardsIn(c.id).length + projCardsIn(c.id).length
    + (c.curFrom ? liveCardsOfCat(c.curFrom.catId).filter(it => !projections.value.some(p => p.kind === 'card' && p.cardId === it.card.id)).length : 0)
  for (const ch of childCats(c.id)) n += nodeCount(ch)
  return n
}
const catAggCount = (pid: string) => {
  const c = cats.value.find(x => x.id === pid)
  return c ? nodeCount(c) : 0
}

// ---- 分类 CRUD（原生/镜像统一：镜像 ✕=移出投射，引用一律回落） ----
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
  if (cat && name && name !== cat.name) { cat.name = name; store.persist(); showToast(cat.curFrom ? '✓ 镜像分类已重命名（源分类不受影响）' : '✓ 已重命名') }
  catEditing.value = null
}
/** R53-E2：删除分类 / 移出投射（镜像）——停入的卡与投射引用一律回落，杜绝孤儿 */
async function deleteCat(c: Category) {
  const mirror = isMirror(c)
  const n = nodeCount(c)
  const msg = mirror
    ? `移出投射「${c.name}」？镜像源卡与停入的卡片将回落到「待分类/未分类」，源工作台零影响`
    : `删除分类「${c.name}」？${n ? `其中卡片将移入「未分类」` : ''}`
  if (!await useConfirm({ message: msg, confirmText: mirror ? '移出投射' : '删除分类', danger: true })) return
  // ① 停在该分类（含子级）的原生卡 → 未分类
  const ids = new Set<string>([c.id, ...childCats(c.id).map(x => x.id)])
  for (const r of d.value.resources) if (r.workspaceId === CURATION_WS_ID && ids.has(r.categoryId || '')) r.categoryId = ''
  // ② 停在该分类（含子级）的投射卡 → 待分类
  ensureProjArr()
  for (const p of d.value.curationProjections || []) if (p.kind === 'card' && p.targetCatId && ids.has(p.targetCatId)) p.targetCatId = undefined
  // ③ 子分类提为根
  for (const ch of childCats(c.id)) ch.parentId = undefined
  d.value.categories = d.value.categories.filter(x => x.id !== c.id)
  if (activeCat.value === c.id) activeCat.value = ''
  store.persist()
  showToast(mirror ? '✓ 已移出投射（源数据不受影响）' : '✓ 分类已删除')
}

// ---- 原生卡片 ----
const nativeCards = computed(() =>
  d.value.resources.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.curOrder ?? 999) - (b.curOrder ?? 999) || a.createdAt - b.createdAt)
)
const cardsIn = (catId: string) => nativeCards.value.filter(r => (r.categoryId || '') === catId)

// ---- 投射清单（R53 起仅单卡记录；镜像分类已物化为真实分类） ----
const projections = computed<CurationProjection[]>(() => d.value.curationProjections || [])
function ensureProjArr() { d.value.curationProjections = d.value.curationProjections || [] }
async function clearProjections() {
  if (!projections.value.length && !cats.value.some(isMirror)) { showToast('ℹ 当前没有投射内容'); return }
  const mirrorN = cats.value.filter(isMirror).length
  if (!await useConfirm({ message: `一键清空全部投射（${projections.value.length} 条单卡${mirrorN ? ` + ${mirrorN} 个镜像分类` : ''}）？停入的卡片回落「待分类/未分类」，源工作台数据零影响`, confirmText: '清空投射', danger: true })) return
  const mirrorIds = new Set(cats.value.filter(isMirror).map(c => c.id))
  for (const r of d.value.resources) if (r.workspaceId === CURATION_WS_ID && mirrorIds.has(r.categoryId || '')) r.categoryId = ''
  for (const p of d.value.curationProjections || []) if (p.kind === 'card' && p.targetCatId && mirrorIds.has(p.targetCatId)) p.targetCatId = undefined
  for (const c of cats.value) if (c.parentId && mirrorIds.has(c.parentId)) c.parentId = undefined
  d.value.categories = d.value.categories.filter(c => !mirrorIds.has(c.id))
  d.value.curationProjections = []
  if (activeCat.value && activeCat.value !== PENDING && (mirrorIds.has(activeCat.value) || !cats.value.some(c => c.id === activeCat.value))) activeCat.value = ''
  store.persist()
  showToast('🧹 已清空投射（源数据不受影响）')
}
function removeProjection(p: CurationProjection) {
  ensureProjArr()
  d.value.curationProjections = (d.value.curationProjections || []).filter(x => x.id !== p.id)
  store.persist()
  showToast('✓ 已移出投射（源数据不受影响）')
}
const wsName = (wsId: string) => d.value.workspaces.find(w => w.id === wsId)?.name || '（工作台已删除）'
const catName = (catId?: string) => d.value.categories.find(c => c.id === catId)?.name || '未分类'

/** 待分类投射卡（targetCatId 为空） */
const pendingProjections = computed(() => projections.value.filter(p => p.kind === 'card' && !(p.targetCatId)))
/** 某分类下的投射卡 */
const projCardsIn = (catId: string) => projections.value.filter(p => p.kind === 'card' && p.targetCatId === catId)
const projTotal = computed(() => projections.value.length)

/** 源卡实时解析（引用式镜像：源删即隐） */
const cardById = (id?: string) => d.value.resources.find(r => r.id === id && !r.deletedAt)
/** 镜像分类的源分类实时卡片（含源子分类） */
function liveCardsOfCat(sourceCatId: string): { card: ResourceCard; sub?: string }[] {
  const out: { card: ResourceCard; sub?: string }[] = []
  for (const r of d.value.resources) if (!r.deletedAt && r.categoryId === sourceCatId) out.push({ card: r })
  for (const child of d.value.categories.filter(c => c.parentId === sourceCatId)) {
    for (const r of d.value.resources) if (!r.deletedAt && r.categoryId === child.id) out.push({ card: r, sub: child.name })
  }
  return out
}
// R56-A：源分类实时卡已并入统一混排网格（未投射源卡垫后、拖动即物化），独立实时镜像视图取消

// ---- 内容区（按当前视图组装） ----
const viewLabel = computed(() => {
  if (activeCat.value === '') return '📥 未分类'
  if (activeCat.value === PENDING) return '📥 待分类（投射）'
  const c = cats.value.find(x => x.id === activeCat.value)
  return c ? (c.curFrom ? '📡 ' + c.name : '📁 ' + c.name) : ''
})
const viewNative = computed(() => {
  if (activeCat.value === PENDING) return []
  return cardsIn(activeCat.value)
})
const viewProjCards = computed(() => {
  if (activeCat.value === PENDING) return pendingProjections.value
  return projCardsIn(activeCat.value)
})
/** R59-T10：父分类分区呈现——「未细分」（直属混排卡）优先，其后按子分类顺序逐区（同工作台方式） */
const isParentView = computed(() => {
  if (activeCat.value === '' || activeCat.value === PENDING) return false
  return childCats(activeCat.value).length > 0
})
const secCounts = (cards: MixedCard[]) => ({
  n: cards.filter(m => m.type === 'native').length,
  p: cards.filter(m => m.type === 'proj').length,
  l: cards.filter(m => m.type === 'live').length
})
const renderSections = computed(() => {
  if (activeCat.value === PENDING) {
    return [{ key: PENDING, title: '', icon: '', isMirror: false, cards: viewMixed.value, ...secCounts(viewMixed.value) }]
  }
  if (!isParentView.value) {
    return [{ key: activeCat.value, title: '', icon: '', isMirror: false, cards: viewMixed.value, ...secCounts(viewMixed.value) }]
  }
  const direct = mixedCardsOf(activeCat.value)
  const secs: { key: string; title: string; icon: string; isMirror: boolean; cards: MixedCard[]; n: number; p: number; l: number }[] = [
    { key: activeCat.value, title: '未细分 · 直属卡片', icon: '📥', isMirror: false, cards: direct, ...secCounts(direct) }
  ]
  for (const ch of childCats(activeCat.value)) {
    const cards = mixedCardsOf(ch.id)
    secs.push({ key: ch.id, title: ch.name, icon: isMirror(ch) ? '📡' : '↳', isMirror: isMirror(ch), cards, ...secCounts(cards) })
  }
  return secs
})

/** R55-A1：统一混排列表——原生卡+投射卡同一网格按 置顶 > curOrder > createdAt 排列，权重一致 */
type MixedCard = { id: string; type: 'native' | 'proj' | 'live'; r?: ResourceCard; p?: CurationProjection }
function mixedCardsOf(catKey: string): MixedCard[] {
  const nat: MixedCard[] = nativeCards.value.filter(r => (r.categoryId || '') === catKey).map(r => ({ id: r.id, type: 'native', r }))
  const prj: MixedCard[] = projections.value
    .filter(p => p.kind === 'card' && (p.targetCatId || '') === catKey && cardById(p.cardId))
    .map(p => ({ id: p.id, type: 'proj', p }))
  // R56-A：镜像分类——未投射源卡（curFrom 源分类实时卡）以源序垫后，拖动即物化为投射
  const cat = d.value.categories.find(c => c.id === catKey)
  if (cat?.curFrom) {
    for (const it of liveCardsOfCat(cat.curFrom.catId)) {
      if (projections.value.some(p => p.kind === 'card' && p.cardId === it.card.id)) continue
      prj.push({ id: 'live:' + it.card.id, type: 'live', p: { id: 'live:' + it.card.id, kind: 'card', wsId: it.card.workspaceId, cardId: it.card.id, catId: it.card.categoryId, targetCatId: catKey, addedAt: 0 } } as unknown as MixedCard)
    }
  }
  // R56-PERF-b：预建 cardId→createdAt Map，排序比较器 O(1)（旧实现每比较全量 find，O(n²)）
  const createdAtOf = new Map<string, number>()
  for (const m of prj) { const c = cardById(m.p!.cardId); if (c) createdAtOf.set(m.id, c.createdAt) }
  // R56-A：未投射源卡「源序垫后」——恒排在已排序卡（原生+投射）之后，按源分类内物理序
  const LIVE_BASE = 1e12
  const srcIndexOf = new Map<string, number>()
  if (cat?.curFrom) liveCardsOfCat(cat.curFrom.catId).forEach((it, i) => srcIndexOf.set(it.card.id, i))
  const orderOf = (m: MixedCard): number =>
    m.type === 'native' ? (m.r!.curOrder ?? m.r!.createdAt)
      : m.type === 'live' ? (LIVE_BASE + (m.p!.cardId ? (srcIndexOf.get(m.p!.cardId) ?? 0) : 0))
      : (m.p!.curOrder ?? createdAtOf.get(m.id) ?? 0)
  const pairs = [...nat, ...prj].map(m => ({ m, ord: orderOf(m), pinned: m.type === 'native' && m.r!.pinned ? 1 : 0 }))
  pairs.sort((a, b) => (b.pinned - a.pinned) || (a.ord - b.ord))
  return pairs.map(x => x.m)
}
const viewMixed = computed<MixedCard[]>(() => {
  if (activeCat.value === PENDING) return pendingProjections.value.map(p => ({ id: p.id, type: 'proj' as const, p }))
  return mixedCardsOf(activeCat.value)
})
const viewNativeCount = computed(() => viewMixed.value.filter(m => m.type === 'native').length)
const viewProjCount = computed(() => viewMixed.value.filter(m => m.type === 'proj').length)
/** R56-A：区块计数 = 混排网格实况（未投射源卡单列，不再双计已投射源卡） */
const viewLiveCount = computed(() => viewMixed.value.filter(m => m.type === 'live').length)

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

// ---- R51-F22：单击详情 / 双击打开链接（260ms 单双击判别） ----
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
  cardModal.value = { title: '', link: '', desc: '', catId: (activeCat.value && activeCat.value !== PENDING) ? activeCat.value : '', fields: [] }
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
      if (r.curCatId !== undefined) r.curCatId = undefined
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
      // R58-B5：curOrder 取混排全量长度（原生+投射），新卡稳定落在已排序段末尾，不与投射卡序号交错
      callCount: 0, customFields: cf, createdAt: now, updatedAt: now, curOrder: (mixedCardsOf(m.catId).length)
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

// ---- 拖拽：卡片（原生/投射自由拖入任意策展分类） ----
const dragId = ref('')
function onCardDragStart(e: DragEvent, r: ResourceCard) {
  dragId.value = r.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id) }
}
function onProjDragStart(e: DragEvent, p: CurationProjection) {
  dragId.value = p.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id) }
}
/** R54-D2：源镜像卡拖拽起点（源卡 id 进 dragId，drop 侧识别为「拖拽即投射」） */
function onSrcDragStart(e: DragEvent, r: ResourceCard) {
  dragId.value = r.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id) }
}
function moveProjectionTo(pid: string, targetCatId: string) {
  const p = projections.value.find(x => x.id === pid)
  if (!p || p.kind !== 'card') return
  p.targetCatId = targetCatId || undefined
  store.persist()
}
/** R54-D3：拖拽结束统一复位（drop 后也会触发，防取消拖拽时状态残留） */
function clearDragState() { dragId.value = ''; dragCatId.value = ''; dropMark.value = null }
/** R54-D2 + R56-A：未投射源卡拖拽即投射——落目标分类（已有记录则移动；源数据零影响） */
function projectSourceCardTo(srcCardId: string, targetCatId: string) {
  const src = d.value.resources.find(x => x.id === srcCardId && !x.deletedAt && x.workspaceId !== CURATION_WS_ID)
  if (!src) return false
  ensureProjArr()
  const p = (d.value.curationProjections || []).find(x => x.kind === 'card' && x.cardId === src.id)
  if (p) {
    p.targetCatId = targetCatId || undefined
    store.persist()
    showToast('📡 镜像卡已移入该分组')
  } else {
    d.value.curationProjections!.push({ id: uid('curp'), kind: 'card', wsId: src.workspaceId, cardId: src.id, catId: src.categoryId, targetCatId: targetCatId || undefined, addedAt: Date.now() })
    store.persist()
    showToast('📡 已镜像入该分组（源数据零影响）')
  }
  return true
}
/** R55-A1：混排列表内把 pid 插到 targetId 之前并统一重编号（原生写 r.curOrder / 投射写 p.curOrder） */
function reorderMixed(catKey: string, pid: string, targetId: string): boolean {
  const mixed = mixedCardsOf(catKey)
  const fi = mixed.findIndex(m => m.id === pid)
  const ti = mixed.findIndex(m => m.id === targetId)
  if (fi < 0 || ti < 0) return false
  const [moved] = mixed.splice(fi, 1)
  const tj = mixed.findIndex(m => m.id === targetId)
  mixed.splice(tj, 0, moved)
  mixed.forEach((m, i) => {
    if (m.type === 'native') m.r!.curOrder = i
    else m.p!.curOrder = i
  })
  return true
}
/** R54-D1 + R55-A1：卡对卡统一 drop——混排列表内同组排序 / 跨组移动（原生↔投射↔源镜像卡权重一致） */
function onAnyCardDrop(e: DragEvent, target: ResourceCard | CurationProjection, targetIsProj: boolean) {
  const pid = dragId.value || e.dataTransfer?.getData('text/plain') || ''
  dragId.value = ''
  if (!pid || pid === (target as { id: string }).id) return
  const targetKey = targetIsProj
    ? ((target as CurationProjection).targetCatId || '')
    : ((target as ResourceCard).categoryId || '')
  // 源镜像卡拖到卡上 = 镜像入该卡所在分组
  const srcCard = d.value.resources.find(x => x.id === pid && !x.deletedAt && x.workspaceId !== CURATION_WS_ID)
  if (srcCard) { projectSourceCardTo(srcCard.id, targetKey); reorderMixed(targetKey, projectRecordIdOf(pid) || '', (target as { id: string }).id); return }
  const draggedIsProj = pid.startsWith('curp-') || projections.value.some(x => x.id === pid)
  let moved = false
  if (draggedIsProj) {
    const p = projections.value.find(x => x.id === pid)
    if (!p) return
    if (p.targetCatId !== (targetKey || undefined)) { p.targetCatId = targetKey || undefined; moved = true }
  } else {
    const r = d.value.resources.find(x => x.id === pid && x.workspaceId === CURATION_WS_ID)
    if (!r) return
    if (r.categoryId !== targetKey) { r.categoryId = targetKey; moved = true }
  }
  const sorted = reorderMixed(targetKey, pid, (target as { id: string }).id)
  store.persist()
  showToast(moved ? '✓ 卡片已移入该分组' : sorted ? '✓ 卡片已排序' : '✓ 已更新')
}
/** 源卡被拖入后其投射记录 id（用于混排插入定位） */
function projectRecordIdOf(srcCardId: string): string | undefined {
  return projections.value.find(x => x.kind === 'card' && x.cardId === srcCardId)?.id
}
/** R56-A：拖到未投射源卡上——目标键 = 镜像分类自身（源卡 categoryId 是源台分类，不可用）；
 *  源卡拖入 = 物化并落位到该源卡之前；原生/投射卡拖入 = 移入分组并落位 */
function onLiveDrop(e: DragEvent, m: MixedCard) {
  const catKey = m.p!.targetCatId || ''
  const targetId = m.id // 'live:' + cardId，与 mixedCardsOf 的 id 同构
  const pid = dragId.value || e.dataTransfer?.getData('text/plain') || ''
  dragId.value = ''
  if (!pid || pid === m.p!.cardId) return
  const srcCard = d.value.resources.find(x => x.id === pid && !x.deletedAt && x.workspaceId !== CURATION_WS_ID)
  if (srcCard) {
    projectSourceCardTo(srcCard.id, catKey)
    reorderMixed(catKey, projectRecordIdOf(srcCard.id) || '', targetId)
    store.persist()
    return
  }
  const draggedIsProj = pid.startsWith('curp-') || projections.value.some(x => x.id === pid)
  let moved = false
  if (draggedIsProj) {
    const p = projections.value.find(x => x.id === pid)
    if (!p) return
    if (p.targetCatId !== (catKey || undefined)) { p.targetCatId = catKey || undefined; moved = true }
  } else {
    const r = d.value.resources.find(x => x.id === pid && x.workspaceId === CURATION_WS_ID)
    if (!r) return
    if (r.categoryId !== catKey) { r.categoryId = catKey; moved = true }
  }
  const sorted = reorderMixed(catKey, pid, targetId)
  store.persist()
  showToast(moved ? '✓ 卡片已移入该分组' : sorted ? '✓ 卡片已排序' : '✓ 已更新')
}
/** 卡/投射拖入树节点（R53：任意策展分类，含镜像分类——同为真实分类） */
function onTreeDrop(e: DragEvent, catId: string) {
  const id = dragId.value || e.dataTransfer?.getData('text/plain')
  dragId.value = ''
  if (!id) return
  const isProj = id.startsWith('curp-') || projections.value.some(x => x.id === id)
  if (isProj) { moveProjectionTo(id, catId); showToast('✓ 投射卡已移入该分类'); return }
  // R54-D2：源镜像卡拖入树节点 = 拖拽即投射
  if (projectSourceCardTo(id, catId)) return
  const r = d.value.resources.find(x => x.id === id && x.workspaceId === CURATION_WS_ID)
  if (!r) return
  r.categoryId = catId
  const list = cardsIn(catId)
  list.forEach((x, i) => { x.curOrder = i })
  store.persist()
  showToast('✓ 已移入分类')
}

// ---- R53-A2：树节点拖拽——兄弟间排序（drop-line 前后）+ 拖入节点成子级（中段），最多 2 级 ----
const dragCatId = ref('')
const dropMark = ref<{ id: string; mode: 't' | 'b' | 'in' } | null>(null)
function onCatDragStart(e: DragEvent, c: Category) {
  dragCatId.value = c.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'cat:' + c.id) }
}
/** R57-F1：接受拖入的 dragover 统一应答（preventDefault + dropEffect=move，防真实拖拽被判定为不可落） */
function acceptDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
/** R57-F1：区域级 dragover——卡片拖拽悬停于当前分类网格任意处（含空白）均可落 */
function onAreaDragOver(e: DragEvent, catKey?: string) {
  if (dragId.value) acceptDragOver(e)
  void catKey
}
/** R57-F1：区域级 drop——拖到当前分类网格空白处 = 移入当前分类（镜像分类下源卡 = 物化垫后追加） */
function onAreaDrop(e: DragEvent, catKey?: string) {
  const pid = dragId.value || e.dataTransfer?.getData('text/plain') || ''
  dragId.value = ''
  dropMark.value = null
  if (!pid) return
  const secKey = catKey ?? activeCat.value
  const targetKey = secKey === PENDING ? '' : secKey
  const srcCard = d.value.resources.find(x => x.id === pid && !x.deletedAt && x.workspaceId !== CURATION_WS_ID)
  if (srcCard) { projectSourceCardTo(srcCard.id, targetKey); store.persist(); return }
  if (secKey === PENDING) {
    const p = projections.value.find(x => x.id === pid)
    if (p && p.kind === 'card' && p.targetCatId) { p.targetCatId = undefined; store.persist(); showToast('✓ 投射卡已移入待分类') }
    return
  }
  const draggedIsProj = pid.startsWith('curp-') || projections.value.some(x => x.id === pid)
  if (draggedIsProj) {
    const p = projections.value.find(x => x.id === pid)
    if (!p || p.kind !== 'card') return
    if (p.targetCatId !== (targetKey || undefined)) { p.targetCatId = targetKey || undefined; store.persist(); showToast('✓ 投射卡已移入该分组') }
    return
  }
  const r = d.value.resources.find(x => x.id === pid && x.workspaceId === CURATION_WS_ID)
  if (!r || r.categoryId === targetKey) return
  r.categoryId = targetKey
  cardsIn(targetKey).forEach((x, i) => { x.curOrder = i })
  store.persist()
  showToast('✓ 已移入分类')
}
/** 节点 dragover：卡片拖入（放行 drop + drop-into 高亮反馈 R54-D4）与分类节点拖拽（dropMark 三段位）双语义 */
function onNodeDragOver(e: DragEvent, c: Category) {
  if (dragId.value) { acceptDragOver(e); dropMark.value = { id: c.id, mode: 'in' }; return }
  if (!dragCatId.value || dragCatId.value === c.id) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (e.clientY - rect.top) / rect.height
  dropMark.value = { id: c.id, mode: ratio < 0.35 ? 't' : ratio > 0.65 ? 'b' : 'in' }
}
function onCatDragLeave() { dropMark.value = null }
function onNodeDrop(e: DragEvent, c: Category) {
  if (dragId.value) { dropMark.value = null; onTreeDrop(e, c.id); return }
  onCatDrop(e, c)
}
function onCatDrop(e: DragEvent, target: Category) {
  const mark = dropMark.value
  dropMark.value = null
  const id = dragCatId.value
  dragCatId.value = ''
  if (!id || !mark || id === target.id || mark.id !== target.id) return
  const dragged = cats.value.find(c => c.id === id)
  if (!dragged) return
  // 防环：不能把自己拖进自己的子级
  if (childCats(dragged.id).some(ch => ch.id === target.id)) { showToast('ℹ 最多两级——子分类不能包含父分类'); return }
  const depth = (c: Category) => c.parentId ? 1 : 0
  if (mark.mode === 'in') {
    if (depth(target) !== 0 || depth(dragged) !== 0) { showToast('ℹ 最多两级——仅一级分类可拖入另一级成为子分类'); return }
    dragged.parentId = target.id
    const siblings = childCats(target.id)
    siblings.forEach((s, i) => { s.order = i })
    store.persist()
    showToast(`✓ 「${dragged.name}」已移入「${target.name}」`)
    return
  }
  // 兄弟排序（跨父级拖拽 = 移动到目标同级位置）
  dragged.parentId = target.parentId
  const siblings = (dragged.parentId ? childCats(dragged.parentId) : rootCats.value).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter(c => c.id !== dragged.id)
  const ti = siblings.findIndex(c => c.id === target.id)
  if (ti < 0) return
  siblings.splice(mark.mode === 't' ? ti : ti + 1, 0, dragged)
  siblings.forEach((s, i) => { s.order = i })
  store.persist()
  showToast('✓ 分类顺序已更新')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="crumb"><b>策展中心</b> · 灵活策展空间</div>
      <div class="spacer" />
      <span class="hint-chip">镜像分类与原生分类同树混排 · 卡片自由拖拽 · 源数据零影响 · 单卡投射 {{ projTotal }} 条</span>
      <button class="mini-btn" title="清空全部投射（源数据不受影响）" @click="clearProjections">🧹 清空投射</button>
      <button class="mini-btn primary" @click="openCreateCard">＋ 新建卡片</button>
    </div>

    <div class="cur-layout">
      <!-- 左 · 统一策展树（R53：原生 + 镜像同树混排，拖拽排序/父子） -->
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
          <div class="cat-item" :class="{ active: activeCat === c.id, 'mirror-node': isMirror(c), 'drop-into': dropMark?.id === c.id && dropMark?.mode === 'in', 'drop-line-t': dropMark?.id === c.id && dropMark?.mode === 't', 'drop-line-b': dropMark?.id === c.id && dropMark?.mode === 'b' }"
            draggable="true" @dragstart="onCatDragStart($event, c)" @dragover="onNodeDragOver($event, c)" @dragleave="onCatDragLeave" @drop.prevent="onNodeDrop($event, c)" @dragend="clearDragState"
            @click="activeCat = c.id" :title="isMirror(c) ? `镜像分类 · 源：${mirrorSourceLabel(c)} · 拖拽排序/拖入其他分类成子级` : '拖拽排序/拖入其他分类成子级'">
            <span v-if="childCats(c.id).length" class="cat-caret" :class="{ open: expandedCats.has(c.id) }" @click.stop="toggleExpand(c.id)">▸</span>
            <span v-else class="cat-caret placeholder" />
            <span class="cat-icon">{{ isMirror(c) ? '📡' : (childCats(c.id).length ? (expandedCats.has(c.id) ? '📂' : '📁') : '📁') }}</span>
            <template v-if="catEditing?.id === c.id">
              <input v-model="catEditing.name" class="cat-edit" v-focus @keydown.enter.prevent="confirmRenameCat" @keydown.esc="catEditing = null" @blur="confirmRenameCat" />
            </template>
            <template v-else>
              <span class="cat-name">{{ c.name }}</span>
            </template>
            <span class="cat-actions">
              <span class="cat-act" title="创建子分类" @click.stop="startCreateCat(c.id)">＋</span>
              <span class="cat-act" :title="isMirror(c) ? '重命名（源分类不受影响）' : '重命名'" @click.stop="startRenameCat(c)">✎</span>
              <span class="cat-act danger" :title="isMirror(c) ? '移出投射（源数据不受影响）' : '删除分类'" @click.stop="deleteCat(c)">{{ isMirror(c) ? '✕' : '🗑' }}</span>
            </span>
            <span class="cat-count">{{ nodeCount(c) }}</span>
          </div>
          <template v-if="expandedCats.has(c.id)">
            <div v-for="ch in childCats(c.id)" :key="ch.id" class="cat-item sub" :class="{ active: activeCat === ch.id, 'mirror-node': isMirror(ch), 'drop-into': dropMark?.id === ch.id && dropMark?.mode === 'in', 'drop-line-t': dropMark?.id === ch.id && dropMark?.mode === 't', 'drop-line-b': dropMark?.id === ch.id && dropMark?.mode === 'b' }"
              draggable="true" @dragstart="onCatDragStart($event, ch)" @dragover="onNodeDragOver($event, ch)" @dragleave="onCatDragLeave" @drop.prevent="onNodeDrop($event, ch)" @dragend="clearDragState"
              @click="activeCat = ch.id" :title="isMirror(ch) ? `镜像分类 · 源：${mirrorSourceLabel(ch)}` : ''">
              <span class="cat-caret placeholder" />
              <span class="cat-icon">{{ isMirror(ch) ? '📡' : '↳' }}</span>
              <template v-if="catEditing?.id === ch.id">
                <input v-model="catEditing.name" class="cat-edit" v-focus @keydown.enter.prevent="confirmRenameCat" @keydown.esc="catEditing = null" @blur="confirmRenameCat" />
              </template>
              <template v-else>
                <span class="cat-name">{{ ch.name }}</span>
              </template>
              <span class="cat-actions">
                <span class="cat-act" :title="isMirror(ch) ? '重命名（源分类不受影响）' : '重命名'" @click.stop="startRenameCat(ch)">✎</span>
                <span class="cat-act danger" :title="isMirror(ch) ? '移出投射（源数据不受影响）' : '删除分类'" @click.stop="deleteCat(ch)">{{ isMirror(ch) ? '✕' : '🗑' }}</span>
              </span>
              <span class="cat-count">{{ nodeCount(ch) }}</span>
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
          <span>原生 {{ viewNativeCount }} · 投射 {{ viewProjCount }}<template v-if="viewLiveCount"> · 源镜像 {{ viewLiveCount }}</template></span>
        </div>

        <!-- R55-A1 统一混排网格 ｜ R59-T10：父分类视图分区呈现（未细分优先 + 子分类依次），区域级 drop 指向所在分区 -->
        <template v-for="sec in renderSections" :key="sec.key">
          <div v-if="sec.title" class="cur-sec-label sec-child" :class="{ proj: sec.isMirror }">
            {{ sec.icon }} {{ sec.title }}
            <span>原生 {{ sec.n }} · 投射 {{ sec.p }}<template v-if="sec.l"> · 源镜像 {{ sec.l }}</template></span>
          </div>
          <div class="cur-grid" @dragover="onAreaDragOver($event, sec.key)" @drop="onAreaDrop($event, sec.key)">
          <template v-for="m in sec.cards" :key="sec.key + m.type + m.id">
            <!-- 原生卡 -->
            <div v-if="m.type === 'native' && m.r" class="cur-card native" :class="{ pinned: m.r.pinned }"
              draggable="true" @dragstart="onCardDragStart($event, m.r)" @dragover.prevent @drop.stop="onAnyCardDrop($event, m.r, false)" @dragend="clearDragState"
              @click="onCardClick(() => openEditCard(m.r!))" @dblclick="onCardDblClick(() => openCard(m.r!))"
              :title="'单击详情 · 双击打开链接 · 拖拽移入其他分类/与镜像卡相互排列'">
              <div class="cc-title">
                <span v-if="m.r.pinned" class="cc-pin">📌</span>{{ m.r.title }}
              </div>
              <div v-if="m.r.link" class="cc-link">{{ m.r.link }}</div>
              <div v-if="m.r.description" class="cc-desc">{{ m.r.description }}</div>
              <div v-if="Object.keys(m.r.customFields || {}).length" class="cc-fields">
                <span v-for="(v, k) in m.r.customFields" :key="k" class="cc-field-chip">{{ v }}</span>
              </div>
              <div class="cc-tools">
                <span v-if="m.r.link" class="cc-act" title="打开链接" @click.stop="openCard(m.r)">↗</span>
                <span class="cc-act" :class="{ on: m.r.pinned }" :title="m.r.pinned ? '取消置顶' : '置顶'" @click.stop="togglePin(m.r)">📌</span>
                <span class="cc-act" title="编辑" @click.stop="openEditCard(m.r)">✎</span>
                <span class="cc-act danger" title="删除（进回收站）" @click.stop="deleteNative(m.r)">🗑</span>
              </div>
            </div>
            <!-- 投射卡（镜像） -->
            <div v-else-if="m.type === 'proj' && m.p" class="cur-card mirror"
              draggable="true" @dragstart="onProjDragStart($event, m.p)" @dragover.prevent @drop.stop="onAnyCardDrop($event, m.p, true)" @dragend="clearDragState"
              @click="cardById(m.p!.cardId) && onCardClick(() => { mirrorDetail = { card: cardById(m.p!.cardId)!, proj: m.p! } })"
              @dblclick="cardById(m.p!.cardId) && onCardDblClick(() => openCard(cardById(m.p!.cardId)!))"
              title="单击详情 · 双击打开链接 · 拖拽移入其他分类/与原生卡相互排列">
              <template v-if="cardById(m.p.cardId)">
                <div class="cc-title"><span class="cc-badge">📡</span>{{ cardById(m.p.cardId)!.title }}<span class="cc-src">· {{ wsName(m.p.wsId) }}</span></div>
                <div v-if="cardById(m.p.cardId)!.link" class="cc-link">{{ cardById(m.p.cardId)!.link }}</div>
                <div v-if="cardById(m.p.cardId)!.description" class="cc-desc">{{ cardById(m.p.cardId)!.description }}</div>
                <div class="cc-tools">
                  <span class="cc-act" title="打开链接" @click.stop="openCard(cardById(m.p.cardId)!)">↗</span>
                  <span class="cc-act" title="定位到源工作台" @click.stop="locateSource(cardById(m.p.cardId)!)">🎯</span>
                  <span class="cc-act danger" title="移出投射（源数据不受影响）" @click.stop="removeProjection(m.p)">✕</span>
                </div>
              </template>
              <template v-else>
                <div class="cc-title cc-gone">📡 源卡已删除/移出 <span class="cc-src">· {{ wsName(m.p.wsId) }}</span></div>
                <div class="cc-tools"><span class="cc-act danger" title="移出投射" @click.stop="removeProjection(m.p)">✕</span></div>
              </template>
            </div>
            <!-- R56-A：未投射源卡（📡 源序垫后，拖动即物化为投射；可作落位锚点） -->
            <div v-else-if="m.type === 'live' && m.p" class="cur-card mirror live" draggable="true"
              @dragstart="onSrcDragStart($event, cardById(m.p!.cardId)!)" @dragover.prevent @drop.stop="onLiveDrop($event, m)" @dragend="clearDragState"
              @click="onCardClick(() => { const src = cardById(m.p!.cardId); if (src) mirrorDetail = { card: src, proj: { id: '', kind: 'card', wsId: src.workspaceId, addedAt: 0 } } })"
              @dblclick="cardById(m.p!.cardId) && onCardDblClick(() => openCard(cardById(m.p!.cardId)!))"
              title="📡 未投射源卡 · 单击详情 · 双击打开 · 拖动即物化为投射卡">
              <template v-if="cardById(m.p!.cardId)">
                <div class="cc-title"><span class="cc-badge">📡</span>{{ cardById(m.p!.cardId)!.title }}<span class="cc-src">· {{ wsName(m.p.wsId) }}</span></div>
                <div v-if="cardById(m.p!.cardId)!.link" class="cc-link">{{ cardById(m.p!.cardId)!.link }}</div>
                <div class="cc-tools">
                  <span class="cc-act" title="打开链接" @click.stop="openCard(cardById(m.p!.cardId)!)">↗</span>
                  <span class="cc-act" title="定位到源工作台" @click.stop="locateSource(cardById(m.p!.cardId)!)">🎯</span>
                </div>
              </template>
            </div>
          </template>
          <div v-if="!sec.cards.length" class="cur-empty-native">当前分组还没有卡片 —— 右上角「＋ 新建卡片」，或从工作台拖卡/右键镜像过来</div>
          </div>
        </template>

        <div v-if="!isParentView && !viewMixed.length" class="cur-empty">
          当前分类还是空的 —— 从其他工作台右键卡片「📡 镜像到策展中心」/ 目录树 📤 镜像分类 / 工作台 Tab 右键整台打包镜像，或在这里新建原生卡片
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
                <option v-for="c in cats" :key="c.id" :value="c.id">{{ isMirror(c) ? '📡 ' : '' }}{{ c.name }}</option>
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
            <div class="mc-field"><label>来源</label><div class="mc-ro">{{ wsName(mirrorDetail.card.workspaceId) }} · {{ catName(mirrorDetail.card.categoryId) }}</div></div>
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
.cat-item.mirror-node .cat-name { border-bottom: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent); }
.cat-item.sub { padding-left: 30px; }
.cat-item[draggable="true"] { cursor: grab; }
.cat-item.drop-into { outline: 2px dashed var(--accent); outline-offset: -2px; background: var(--accent-light); }
.cat-item.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.cat-item.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
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
/* R59-T10：父分类视图的子分区标题 */
.cur-sec-label.sec-child { margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--border); }
.cur-sec-label.sec-child:first-of-type { border-top: none; margin-top: 4px; padding-top: 0; }
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
