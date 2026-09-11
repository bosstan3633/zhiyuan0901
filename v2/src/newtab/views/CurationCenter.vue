<script setup lang="ts">
/**
 * ⚠️ @deprecated R73（V2.42.0）· R16 资源台收敛 —— **本文件已摘除路由，请勿再挂载。**
 * - 收敛决策：`/curation` 已改为 redirect 到 `/workspace/zy-curation`（见 `router.ts`），
 *   资源台统一由 `Workspace.vue` 的 `isHub` 分支渲染；本组件的 3 组活能力
 *   （书签 HTML 导入 / 本地文件导入 / 资源台侧镜像到策展台 📡📤）已迁入 hub 分支。
 * - 保留原因：本文件仍被 **58 条回归断言**引用，暂留可让回归项数**只增不减**（零回归损失）。
 *   删除文件 + 断言处置 **推迟到 R74**（见 `文档中心/04_产品与设计/04-23_S1等价性审计报告_资源台收敛.md` §七 路线乙）。
 * - 其中约 20% 的代码（依赖 `curFrom` 的旧方向镜像机械）**恒不执行**，属死代码，清单见 `04-23 §三`。
 *
 * ── 以下为原实现说明（R61 起已由 hub 分支承接）──
 * R50-F3 + R51 + R52 + R53-A2 策展中心 · 灵活策展空间
 * - R53-A2 统一树：镜像分类物化为带 curFrom 的**真实策展分类**（migrateCurationTree 启动期迁移），
 *   与原生分类同构——同一颗树、自由混排、拖拽排序、拖拽成父子（最多 2 级）
 * - R53-A2/E2：卡片自由拖拽——原生卡/投射卡均可拖入任意策展分类（含镜像分类）；
 *   删除分类/移出投射/清空投射时，停入的卡与投射引用一律回落（待分类/未分类），杜绝孤儿引用
 * - R52-F7a：整策展台镜像 = 分类镜像打包版（App.vue 物化，源后续变更不自动同步）
 * - R51-F25：单卡投射落入「待分类」；R51-F22：单击出详情、双击打开链接；R51-F23：自定义字段池
 * - 原生内容：新建/编辑/置顶/拖拽排序/删除；源数据零影响
 * - R65-F1 资源台对齐策展台：顶部工具条（卡片/列表/看板视图切换 + 搜索 + 批量管理 + 导入 + 新建）、
 *   单击右侧抽屉详情（共享 ResourceEditForm，替代居中弹窗）、批量操作浮动栏、书签/本地文件导入
 */
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { CURATION_WS_ID, type ResourceCard, type Category, type CurationProjection } from '@/shared/models'
import { curationBoards, projectCardToBoard, mirrorCategoryToBoard } from '@/shared/storage/hub'
import { uid, safeDecodeText } from '@/shared/utils'
import { MAX_CAT_LEVEL } from '@/shared/utils/catTree'
import { buildCatIndex, buildBucketIndex } from '@/shared/utils/catIndex'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { recordResourceOpen } from '@/shared/storage/stats'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { useCardCols } from '@/shared/utils/cardCols'
import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'

const router = useRouter()
const store = useAppStore()
// R65-F7：KeepAlive 缓存实例名（App.vue router-view include）
defineOptions({ name: 'CurationCenterView' })
const d = useCompass().d
const vFocus = { mounted: (el: HTMLElement) => el.focus() }

// ---- 视图选择：'__all__'=全部分类（默认根节点，聚合全台卡片） ''=未分类 '__pending__'=待分类 分类id=策展分类（原生/镜像同构） ----
const ALL_CAT = '__all__'
const PENDING = '__pending__'
const activeCat = ref(ALL_CAT)

// ---- 分类树（资源台自有；R61 起层级放开 4 级，L1 中心论点为根——金字塔呈现见 R62） ----
const cats = computed(() => d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
/**
 * R71 性能治理：资源台分类树索引。
 * 此前 childCats 是 filter 全表、levelOf 是沿父链 find 全表，而它们既出现在模板表达式里
 * （左树每个节点都要算展开箭头、图标、节点计数），又被递归函数反复调用 —— 整树一次重渲染 O(n²)。
 * 索引把「一次 O(n) 建表」与「之后 O(1) 查表」固化，模板调用签名保持不变以降低回归风险。
 */
const catIdx = computed(() => buildCatIndex(cats.value))
const rootCats = computed(() => catIdx.value.roots)
const childCats = (pid: string) => catIdx.value.childrenOf.get(pid) || []
/** 子树高度（含自身）——预计算，O(1)（仅拖拽层级校验用，此前每次递归全表 filter） */
const catHeightMap = computed(() => {
  const idx = catIdx.value
  const m = new Map<string, number>()
  const depthSorted = [...cats.value].sort((a, b) => idx.depthOf(b.id) - idx.depthOf(a.id))
  for (const c of depthSorted) {
    let h = 1
    for (const ch of idx.childrenOf.get(c.id) || []) h = Math.max(h, (m.get(ch.id) || 1) + 1)
    m.set(c.id, h)
  }
  return m
})
const isMirror = (c: Category) => !!c.curFrom
const mirrorSourceLabel = (c: Category) => c.curFrom ? `${wsName(c.curFrom.wsId)} · ${catName(c.curFrom.catId)}` : ''

// R61-4：层级工具（4 级上限）——真实层级（沿父链上行）与子树高度（防拖入超限/防环）
// R70：MAX_CAT_LEVEL 收敛到 shared/utils/catTree；下面的上行走链与向下递归一律带 visited——
// 导入数据可能已含环（历史坏数据/跨设备合并/手工编辑），而这里是**渲染与计数路径**，一旦死转页面就永久打不开。
function levelOf(c: Category): number {
  // R71：索引缓存（含 visited 防环，与 R70 口径一致）
  return catIdx.value.depthOf(c.id)
}
function subtreeHeight(c: Category): number {
  // R71：预计算高度表（此前每次调用都向下递归并全表 filter）
  return catHeightMap.value.get(c.id) || 1
}
function deepDescendantIds(id: string): string[] {
  return catIdx.value.descendants(id)
}

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
/**
 * R71 性能治理：节点计数从「模板内递归调用」改为**一次自底向上的预计算**。
 * 原实现每次调用都会向下递归整棵子树、并对每个节点 filter 全量卡 —— 模板里每个节点调一次，
 * 整树渲染是 O(节点数² × 卡数)。现在：先算每个节点的「自身计数」，再把自身计数累加到全部祖先，
 * 总复杂度 O(节点数 × 深度 + 卡数)，且模板只做一次 Map 查表。
 */
const nodeCountMap = computed(() => {
  const idx = catIdx.value
  const self = new Map<string, number>()
  for (const c of cats.value) {
    let v = (nativeBucket.value.get(c.id) || []).length + (projBucket.value.get(c.id) || []).length
    if (c.curFrom) {
      for (const it of liveCardsOfCat(c.curFrom.catId)) {
        if (!projectedCardIds.value.has(it.card.id)) v++
      }
    }
    self.set(c.id, v)
  }
  const total = new Map<string, number>(self)
  for (const c of cats.value) {
    const add = self.get(c.id) || 0
    if (!add) continue
    const seen = new Set<string>([c.id])
    let p: Category | undefined = c.parentId ? idx.byId.get(c.parentId) : undefined
    while (p && !seen.has(p.id)) {          // R70：带 visited，环数据不得死转
      seen.add(p.id)
      total.set(p.id, (total.get(p.id) || 0) + add)
      p = p.parentId ? idx.byId.get(p.parentId) : undefined
    }
  }
  return total
})
function nodeCount(c: Category): number {
  return nodeCountMap.value.get(c.id) || 0
}
const catAggCount = (pid: string) => {
  const c = catIdx.value.byId.get(pid)
  return c ? nodeCount(c) : 0
}

// ---- 分类 CRUD（原生/镜像统一：镜像 ✕=移出投射，引用一律回落） ----
const catEditing = ref<{ id: string; name: string } | null>(null)
const catCreating = ref<{ parentId?: string; name: string } | null>(null)
function startCreateCat(parentId?: string) { catCreating.value = { parentId, name: '' } }
function confirmCreateCat() {
  const name = (catCreating.value?.name || '').trim()
  if (!name) { catCreating.value = null; return }
  const parentId = catCreating.value?.parentId
  // R61-4：4 级上限校验
  if (parentId) {
    const parent = cats.value.find(c => c.id === parentId)
    if (parent && levelOf(parent) + 1 > MAX_CAT_LEVEL) { showToast(`ℹ 最多 ${MAX_CAT_LEVEL} 级——该节点已处于最深层`); return }
  }
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
    ? `移出投射「${c.name}」？镜像源卡与停入的卡片将回落到「待分类/未分类」，源策展台零影响`
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
  if (activeCat.value === c.id) activeCat.value = ALL_CAT
  store.persist()
  showToast(mirror ? '✓ 已移出投射（源数据不受影响）' : '✓ 分类已删除')
}

// ---- 原生卡片 ----
const nativeCards = computed(() =>
  d.value.resources.filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.curOrder ?? 999) - (b.curOrder ?? 999) || a.createdAt - b.createdAt)
)
/** R71：分类 → 卡 分桶（一次 O(n)，替代每次都 filter 全量卡） */
const nativeBucket = computed(() => buildBucketIndex(nativeCards.value, (r) => r.categoryId || ''))
const cardsIn = (catId: string) => nativeBucket.value.get(catId || '') || []

// ---- 投射清单（R61 起只保留「无 targetWsId」的历史残留过滤；新镜像方向为资源台→策展台，由 hub.ts 管理） ----
const projections = computed<CurationProjection[]>(() => (d.value.curationProjections || []).filter(p => !p.targetWsId))
function ensureProjArr() { d.value.curationProjections = d.value.curationProjections || [] }
// ---- 投射清单过滤后不再有入站内容：clearProjections（R60 前功能）随方向反转退役 ----
function removeProjection(p: CurationProjection) {
  ensureProjArr()
  d.value.curationProjections = (d.value.curationProjections || []).filter(x => x.id !== p.id)
  store.persist()
  showToast('✓ 已移出投射（源数据不受影响）')
}
/** R71：台名 / 分类名索引（O(1)）——两者都在模板与镜像来源标签里被反复调用 */
const wsNameById = computed(() => { const m = new Map<string, string>(); for (const w of d.value.workspaces) m.set(w.id, w.name); return m })
const catNameByIdFull = computed(() => { const m = new Map<string, string>(); for (const c of d.value.categories) m.set(c.id, c.name); return m })
const wsName = (wsId: string) => wsNameById.value.get(wsId) || '（策展台已删除）'
const catName = (catId?: string) => (catId && catNameByIdFull.value.get(catId)) || '未分类'

/** 待分类投射卡（targetCatId 为空） */
const pendingProjections = computed(() => projections.value.filter(p => p.kind === 'card' && !(p.targetCatId)))
/** 某分类下的投射卡 */
/** R71：目标分类 → 投射 分桶 */
const projBucket = computed(() => buildBucketIndex(projections.value.filter(p => p.kind === 'card'), (p) => p.targetCatId || ''))
const projCardsIn = (catId: string) => projBucket.value.get(catId || '') || []
/** R71：已投射源卡 id 集合——替代循环内 projections.value.some(...)（O(卡数×投射数)） */
const projectedCardIds = computed(() => new Set(projections.value.filter(p => p.kind === 'card').map(p => p.cardId)))
const projTotal = computed(() => projections.value.length)

/** 源卡实时解析（引用式镜像：源删即隐）——R71：改 Map 查表。
 *  此函数在模板里被调用 20+ 次（每张投射卡的标题/链接/描述/工具条各一次），
 *  原先每次都是一次 O(n) 的 resources.find —— 400 张投射卡 × 760 张源卡 × 5 = 150 万次比较/渲染。 */
const resById = computed(() => {
  const m = new Map<string, ResourceCard>()
  for (const r of d.value.resources) if (!r.deletedAt) m.set(r.id, r)
  return m
})
const cardById = (id?: string) => (id ? resById.value.get(id) : undefined)
/** 全量源卡按分类分桶（含非资源台卡，与旧实现口径一致） */
const liveSrcBucket = computed(() => buildBucketIndex(d.value.resources.filter(r => !r.deletedAt), (r) => r.categoryId || ''))
/** 全量分类索引（镜像源分类可能不在本台分类集合内） */
const allCatIdx = computed(() => buildCatIndex(d.value.categories))
/** 镜像分类的源分类实时卡片（含源子分类）——R71：分桶取用，不再嵌套全表扫描 */
function liveCardsOfCat(sourceCatId: string): { card: ResourceCard; sub?: string }[] {
  const out: { card: ResourceCard; sub?: string }[] = []
  for (const card of liveSrcBucket.value.get(sourceCatId) || []) out.push({ card })
  for (const child of allCatIdx.value.childrenOf.get(sourceCatId) || []) {
    for (const card of liveSrcBucket.value.get(child.id) || []) out.push({ card, sub: child.name })
  }
  return out
}
// R56-A：源分类实时卡已并入统一混排网格（未投射源卡垫后、拖动即物化），独立实时镜像视图取消

// ---- 内容区（按当前视图组装） ----
const viewLabel = computed(() => {
  if (activeCat.value === ALL_CAT) return '🗂 全部分类'
  if (activeCat.value === '') return '📥 未分类'
  if (activeCat.value === PENDING) return '📥 待分类（投射）'
  const c = cats.value.find(x => x.id === activeCat.value)
  return c ? (c.curFrom ? '📡 ' + c.name : '📁 ' + c.name) : ''
})
const viewNative = computed(() => {
  if (activeCat.value === PENDING) return []
  if (activeCat.value === ALL_CAT) return nativeCards.value
  return cardsIn(activeCat.value)
})
const viewProjCards = computed(() => {
  if (activeCat.value === PENDING) return pendingProjections.value
  if (activeCat.value === ALL_CAT) return projections.value.filter(p => p.kind === 'card' && cardById(p.cardId))
  return projCardsIn(activeCat.value)
})
/** R59-T10：父分类分区呈现——「未细分」（直属混排卡）优先，其后按子分类顺序逐区（同策展台方式）；R69：「全部分类」扁平聚合，不进分区 */
const isParentView = computed(() => {
  if (activeCat.value === '' || activeCat.value === PENDING || activeCat.value === ALL_CAT) return false
  return childCats(activeCat.value).length > 0
})
/** R71：单遍统计（此前对同一数组 filter 三次） */
const secCounts = (cards: MixedCard[]) => {
  let n = 0, p = 0, l = 0
  for (const m of cards) { if (m.type === 'native') n++; else if (m.type === 'proj') p++; else l++ }
  return { n, p, l }
}
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
  // R69：「全部分类」聚合视图——不按分类过滤，返回全台原生卡 + 全部投射卡
  const all = catKey === ALL_CAT
  const nat: MixedCard[] = nativeCards.value.filter(r => all || (r.categoryId || '') === catKey).map(r => ({ id: r.id, type: 'native', r }))
  const prj: MixedCard[] = projections.value
    .filter(p => p.kind === 'card' && (all || (p.targetCatId || '') === catKey) && cardById(p.cardId))
    .map(p => ({ id: p.id, type: 'proj', p }))
  const mirroredNow = projectedCardIds.value
  // R56-A：镜像分类——未投射源卡（curFrom 源分类实时卡）以源序垫后，拖动即物化为投射（聚合视图不涉及）
  const cat = all ? undefined : d.value.categories.find(c => c.id === catKey)
  if (cat?.curFrom) {
    for (const it of liveCardsOfCat(cat.curFrom.catId)) {
      if (mirroredNow.has(it.card.id)) continue
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
/** R71：混排网格三类计数一次遍历算全（此前三个 computed 各 filter 一遍） */
const viewCounts = computed(() => {
  let native = 0, proj = 0, live = 0
  for (const m of viewMixed.value) { if (m.type === 'native') native++; else if (m.type === 'proj') proj++; else live++ }
  return { native, proj, live }
})
const viewNativeCount = computed(() => viewCounts.value.native)
const viewProjCount = computed(() => viewCounts.value.proj)
/** R56-A：区块计数 = 混排网格实况（未投射源卡单列，不再双计已投射源卡） */
const viewLiveCount = computed(() => viewCounts.value.live)

// ---- R65-F1：视图切换 + 搜索（对齐策展台工具条） ----
const viewMode = ref<'card' | 'list' | 'kanban'>('card')
// R72：卡片视图横向列数（4/5/6/7，记忆 UIPrefs.cardCols.res；网格模板由 --grid-cols 驱动）
// 与 Workspace.vue（资源台 isHub 分支 / 策展台）共用 'res' 键 ⇒ R16 收敛后偏好无缝延续
const resCols = useCardCols('res', store.ui)
const resSearch = ref('')
/** 关键词命中（标题/链接/描述；proj/live 卡解析真身后匹配） */
function searchHit(m: MixedCard): boolean {
  const q = resSearch.value.trim().toLowerCase()
  if (!q) return true
  const r = m.r || cardById(m.p?.cardId)
  if (!r) return false
  return (r.title + ' ' + (r.link || '') + ' ' + (r.description || '')).toLowerCase().includes(q)
}
/** 搜索过滤后的分区视图（计数随过滤实时重算） */
const sectionsView = computed(() => renderSections.value
  .map(s => {
    const cards = s.cards.filter(searchHit)
    return { ...s, cards, ...secCounts(cards) }
  })
  .filter(s => s.cards.length > 0 || s.key === activeCat.value))
/** 看板列：未分类 + 根分类（直属混排卡） */
const kanbanCols = computed<{ key: string; name: string; mirror?: boolean }[]>(() => [
  { key: '', name: '未分类' },
  ...rootCats.value.map(c => ({ key: c.id, name: c.name, mirror: isMirror(c) }))
])
/** 列表/看板行取卡（原生 or 投射/源卡解析真身） */
function rowCard(m: MixedCard): ResourceCard | undefined {
  return m.r || (m.p ? cardById(m.p.cardId) : undefined)
}
function rowClick(m: MixedCard) {
  const r = rowCard(m)
  if (!r) return
  if (batchMode.value && m.type === 'native') { toggleSelect(r.id); return }
  onCardClick(() => openResource(r))
}
function rowDblClick(m: MixedCard) {
  const r = rowCard(m)
  if (r) onCardDblClick(() => openCard(r))
}

// ---- 卡片打开（原生/镜像共用 WRR 口径） ----
function openCard(r: ResourceCard) {
  if (r.linkType === 'file' && /^zy-asset:\/\//i.test((r.link || '').trim())) {
    showToast('ℹ 附件卡请到源策展台打开'); return
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
  showToast('↗ 已定位到源策展台')
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

// ---- R65-F1：资源卡详情右侧抽屉（共享 ResourceEditForm，对齐策展台；替代原居中编辑弹窗） ----
const drawerOpen = ref(false)
const editingResource = reactive<ResourceCard>({ id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: CURATION_WS_ID, categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0 })
const isNewResource = ref(false)

function emptyResource(): ResourceCard {
  return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: CURATION_WS_ID, categoryId: '', description: '', tags: [], customFields: {}, pinned: false, callCount: 0, createdAt: 0, updatedAt: 0 }
}
/** 新建卡片：抽屉打开，落当前视图分类（真身=资源台）；R69：聚合/待分类视图落「未分类」 */
function newCardCatId(): string {
  const c = activeCat.value
  return (c && c !== PENDING && c !== ALL_CAT) ? c : ''
}
function openCreateCard() {
  Object.assign(editingResource, emptyResource())
  editingResource.id = uid('res')
  editingResource.createdAt = Date.now()
  if (activeCat.value && activeCat.value !== PENDING && activeCat.value !== ALL_CAT) editingResource.categoryId = activeCat.value
  isNewResource.value = true
  drawerOpen.value = true
}
/** 单击详情：抽屉打开 + WRR 记一次调用 */
function openResource(r: ResourceCard) {
  Object.assign(editingResource, JSON.parse(JSON.stringify(r)))
  isNewResource.value = false
  drawerOpen.value = true
  recordResourceOpen(d.value, r)
  store.persist()
}
function closeDrawer() { drawerOpen.value = false }
function saveResource() {
  if (!editingResource.title.trim()) { showToast('请输入标题'); return }
  editingResource.updatedAt = Date.now()
  if (isNewResource.value) {
    // R58-B5 口径延续（R65 抽屉化）：新卡 curOrder = 混排全量长度，稳定落在已排序段末尾
    editingResource.curOrder = mixedCardsOf(editingResource.categoryId).length
    d.value.resources.unshift({ ...editingResource })
  } else {
    const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
    if (idx >= 0) d.value.resources[idx] = { ...editingResource }
  }
  store.persist()
  drawerOpen.value = false
  showToast(isNewResource.value ? '✓ 策展卡已创建' : '✓ 已保存')
}
async function deleteCurrentResource() {
  const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
  if (idx >= 0) d.value.resources[idx].deletedAt = Date.now()
  store.persist()
  drawerOpen.value = false
  const target = idx >= 0 ? d.value.resources[idx] : null
  showToast(target ? `已删除「${target.title.slice(0, 20)}」` : '资源卡已删除', { label: '撤销', cb: () => {
    const cur = d.value.resources.find(x => x.id === editingResource.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}
function copyLink() {
  if (!editingResource.link) { showToast('无链接'); return }
  navigator.clipboard.writeText(editingResource.link).then(() => showToast('✓ 链接已复制'))
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

// ---- R65-F1：批量管理（对齐策展台：勾选浮栏 + 批量打开/移动/删除） ----
const batchMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selectedIds.value.clear()
}
function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}
function visibleNativeCards(): ResourceCard[] {
  const q = resSearch.value.trim().toLowerCase()
  return nativeCards.value.filter(r => {
    if (activeCat.value !== '' && activeCat.value !== PENDING && activeCat.value !== ALL_CAT) {
      const cat = cats.value.find(c => c.id === activeCat.value)
      const ids = cat ? new Set([cat.id, ...deepDescendantIds(cat.id)]) : null
      if (ids && !ids.has(r.categoryId || '')) return false
    }
    if (activeCat.value === PENDING) return false
    if (!q) return true
    return (r.title + ' ' + (r.link || '') + ' ' + (r.description || '')).toLowerCase().includes(q)
  })
}
function selectAllVisible() {
  const all = visibleNativeCards()
  if (selectedIds.value.size >= all.length) selectedIds.value.clear()
  else all.forEach(r => selectedIds.value.add(r.id))
}
function selectedCards(): ResourceCard[] {
  return nativeCards.value.filter(r => selectedIds.value.has(r.id))
}
async function batchOpen() {
  const items = selectedCards().filter(r => r.link)
  if (!items.length) { showToast('所选资源卡均无链接'); return }
  if (items.length > 15 && !(await useConfirm({ title: '批量打开链接', message: `即将打开 ${items.length} 个标签页，确认继续？`, confirmText: '继续打开', danger: false }))) return
  items.forEach(r => openCard(r))
  showToast(`✓ 已打开 ${items.length} 个链接`)
}
async function batchDelete() {
  const removed = selectedCards()
  if (!removed.length) return
  if (!(await useConfirm({ message: `批量删除 ${removed.length} 张资源卡？可到回收站恢复`, confirmText: '批量删除', danger: true }))) return
  removed.forEach(r => { r.deletedAt = Date.now() })
  store.persist()
  selectedIds.value.clear()
  showToast(`已删除 ${removed.length} 张资源卡`, { label: '撤销', cb: () => {
    removed.forEach(r => {
      const cur = d.value.resources.find(x => x.id === r.id)
      if (cur && cur.deletedAt) cur.deletedAt = undefined
    })
    store.persist()
  } })
}
// 批量移动（目标 = 资源台分类树；层级化选项与策展台同构）
const moveModalOpen = ref(false)
const moveTarget = ref('')
const moveCatOptions = computed(() => {
  const out: { id: string; label: string }[] = [{ id: '', label: '未分类' }]
  const push = (c: Category, depth: number) => {
    out.push({ id: c.id, label: '└'.repeat(depth) + (depth ? ' ' : '') + c.name })
    for (const ch of childCats(c.id)) push(ch, depth + 1)
  }
  for (const r0 of rootCats.value) push(r0, 0)
  return out
})
function openBatchMove() { moveTarget.value = ''; moveModalOpen.value = true }
function confirmBatchMove() {
  const items = selectedCards()
  if (!items.length) { moveModalOpen.value = false; return }
  items.forEach(r => { r.categoryId = moveTarget.value })
  const list = cardsIn(moveTarget.value)
  list.forEach((x, i) => { x.curOrder = i })
  store.persist()
  moveModalOpen.value = false
  showToast(`✓ 已移动 ${items.length} 张资源卡`)
}

// ---- R65-F1：导入（书签 HTML / 本地文件，对齐策展台；真身落资源台） ----
const importModalOpen = ref(false)
const bookmarkInput = ref<HTMLInputElement | null>(null)
const fileImportInput = ref<HTMLInputElement | null>(null)

interface BkFolder { path: string; name: string; count: number; checked: boolean }
interface BkNode { title: string; url: string; path: string[] }

const bookmarkModalOpen = ref(false)
const bkFolders = ref<BkFolder[]>([])
let bkBookmarks: BkNode[] = []

function makeResource(title: string, linkType: ResourceCard['linkType'], link: string, categoryId: string, tags: string[] = []): ResourceCard {
  return {
    id: uid('res'), kind: 'resource', title, linkType, link,
    workspaceId: CURATION_WS_ID, categoryId, description: '', tags,
    customFields: {}, pinned: false, callCount: 0, createdAt: Date.now(), updatedAt: Date.now()
  }
}

/** 解析 Netscape 书签 HTML（浏览器导出格式） */
function parseBookmarksHtml(html: string): BkNode[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: BkNode[] = []
  function walk(dl: Element | null, path: string[]) {
    if (!dl) return
    for (const dt of Array.from(dl.children).filter(el => el.tagName === 'DT')) {
      const h3 = dt.querySelector(':scope > h3')
      const a = dt.querySelector(':scope > a')
      if (h3) {
        const name = safeDecodeText(h3.textContent?.trim() || '未命名')
        walk(dt.querySelector(':scope > dl'), [...path, name])
      } else if (a) {
        const url = a.getAttribute('href') || ''
        if (url && /^(https?:|file:|obsidian:)/i.test(url)) {
          out.push({ title: safeDecodeText(a.textContent?.trim() || url), url, path })
        }
      }
    }
  }
  walk(doc.querySelector('dl'), [])
  return out
}

function handleBookmarkImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      bkBookmarks = parseBookmarksHtml(reader.result as string)
      if (!bkBookmarks.length) { showToast('未在文件中解析到书签，请确认是浏览器导出的书签 HTML'); return }
      const groups = new Map<string, BkNode[]>()
      for (const b of bkBookmarks) {
        const key = b.path.length ? b.path.join(' / ') : '未分组'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(b)
      }
      bkFolders.value = Array.from(groups.entries())
        .map(([path, items]) => ({ path, name: path.split(' / ').pop() || path, count: items.length, checked: true }))
        .sort((a, b) => b.count - a.count)
      bookmarkModalOpen.value = true
      importModalOpen.value = false
    } catch { showToast('✗ 书签文件解析失败') }
  }
  reader.readAsText(file)
  input.value = ''
}

const allBkChecked = computed(() => bkFolders.value.length > 0 && bkFolders.value.every(f => f.checked))
const bkTotalCount = computed(() => bkBookmarks.length)
function toggleAllBk() {
  const next = !allBkChecked.value
  bkFolders.value.forEach(f => { f.checked = next })
}

/** 浏览器标准根文件夹不生成分类 */
const BK_ROOT_NAMES = new Set(['书签栏', '收藏栏', '其他书签', 'Bookmarks bar', 'Bookmarks Toolbar', 'Favorites bar', 'Mobile bookmarks', '移动书签'])

/** 按路径前 2 级确保资源台分类存在（同名同级复用），返回卡片归属分类 id（'' = 未分类） */
function ensureBookmarkCategory(segs: string[]): string {
  let parentId: string | undefined
  let catId = ''
  for (const seg of segs.slice(0, 2)) {
    const name = seg.trim()
    if (!name) break
    let cat = d.value.categories.find(c => c.workspaceId === CURATION_WS_ID && (c.parentId || undefined) === parentId && c.name === name)
    if (!cat) {
      cat = { id: uid('cat'), workspaceId: CURATION_WS_ID, name, order: d.value.categories.filter(c => c.workspaceId === CURATION_WS_ID && (c.parentId || undefined) === parentId).length }
      if (parentId) cat.parentId = parentId
      d.value.categories.push(cat)
    }
    catId = cat.id
    parentId = cat.id
  }
  return catId
}

function confirmBookmarkImport() {
  const checkedPaths = new Set(bkFolders.value.filter(f => f.checked).map(f => f.path))
  const items = bkBookmarks.filter(b => checkedPaths.has(b.path.length ? b.path.join(' / ') : '未分组'))
  if (!items.length) { showToast('未选择任何文件夹'); return }
  for (const b of items) {
    const segs = b.path.filter(p => p && !BK_ROOT_NAMES.has(p))
    const catId = ensureBookmarkCategory(segs)
    const tags = Array.from(new Set(segs.slice(2)))
    let linkType: ResourceCard['linkType'] = 'url'
    if (b.url.startsWith('file:')) linkType = 'file'
    else if (b.url.startsWith('obsidian:')) linkType = 'obsidian'
    d.value.resources.unshift(makeResource(b.title.substring(0, 120), linkType, b.url, catId, tags))
  }
  store.persist()
  bookmarkModalOpen.value = false
  showToast(`✓ 已导入 ${items.length} 个书签（文件夹结构已生成为分类，可自行增删改）`)
}

function fileImport() { fileImportInput.value?.click() }
function handleFileImport(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  files.forEach(f => d.value.resources.unshift(makeResource(f.name.replace(/\.[^.]+$/, ''), 'file', f.name, newCardCatId())))
  store.persist()
  input.value = ''
  importModalOpen.value = false
  showToast(`✓ 已导入 ${files.length} 个文件（双击打开前请补全完整路径）`)
}

// ---- 镜像卡详情（只读） ----
const mirrorDetail = ref<{ card: ResourceCard; proj: CurationProjection } | null>(null)

// ---- R61：镜像到策展台（单卡 📡 / 分类 📤；方向反转：资源台 → 策展台） ----
const boards = computed(() => curationBoards(d.value))
const mirrorModal = ref<{ kind: 'card' | 'cat'; cardId?: string; catId?: string; catName?: string; toWs: string; toCat: string } | null>(null)
function openMirrorCard(r: ResourceCard) {
  if (!boards.value.length) { showToast('ℹ 还没有策展台——顶栏「＋ 新建策展台」先建一个'); return }
  mirrorModal.value = { kind: 'card', cardId: r.id, toWs: boards.value[0].id, toCat: '' }
}
function openMirrorCat(c: Category) {
  if (!boards.value.length) { showToast('ℹ 还没有策展台——顶栏「＋ 新建策展台」先建一个'); return }
  mirrorModal.value = { kind: 'cat', catId: c.id, catName: c.name, toWs: boards.value[0].id, toCat: '' }
}
const mirrorTargetCats = computed(() => {
  const m = mirrorModal.value
  return m ? d.value.categories.filter(c => c.workspaceId === m.toWs) : []
})
function confirmMirror() {
  const m = mirrorModal.value
  if (!m) return
  if (!m.toWs) { showToast('ℹ 请选择目标策展台'); return }
  if (m.kind === 'card') {
    const ok = projectCardToBoard(d.value, m.cardId!, m.toWs, m.toCat || undefined)
    if (ok) showToast('📡 已镜像到策展台（引用式，源数据零影响）')
    else showToast('ℹ 未完成——该卡可能已在该台镜像中')
  } else {
    const ok = mirrorCategoryToBoard(d.value, m.catId!, m.toWs)
    if (ok) showToast('📤 已镜像分类到策展台（现有卡片一并投射）')
    else showToast('ℹ 该分类已在该策展台镜像中')
  }
  store.persist()
  mirrorModal.value = null
}

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
  const secKey = catKey ?? (activeCat.value === ALL_CAT ? '' : activeCat.value)
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
  // R61-4：防环（深查所有后代）+ 4 级上限（目标层级 + 拖动子树高度）
  if (deepDescendantIds(dragged.id).includes(target.id)) { showToast('ℹ 不能把自己拖进自己的子级'); return }
  if (mark.mode === 'in') {
    if (levelOf(target) + subtreeHeight(dragged) > MAX_CAT_LEVEL) { showToast(`ℹ 最多 ${MAX_CAT_LEVEL} 级——「${dragged.name}」（含 ${subtreeHeight(dragged) - 1} 层子级）放入后将超出层级上限`); return }
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
  <div class="page" :style="{ '--grid-cols': String(resCols) }">
    <!-- R65-F1：顶部工具条（对齐策展台：视图切换 + 搜索 + 批量 + 导入 + 新建） -->
    <div class="page-head">
      <div class="crumb"><b>资源台</b> · 资源卡唯一存储 · 镜像源头</div>
      <div class="spacer" />
      <div class="view-tabs">
        <div class="view-tab" :class="{active: viewMode==='card'}" @click="viewMode='card'">▦ 卡片</div>
        <div class="view-tab" :class="{active: viewMode==='list'}" @click="viewMode='list'">☰ 列表</div>
        <div class="view-tab" :class="{active: viewMode==='kanban'}" @click="viewMode='kanban'">▤ 看板</div>
      </div>
      <!-- R72：卡片视图横向列数（4/5/6/7，仅卡片视图出现） -->
      <ColsPicker v-if="viewMode==='card'" v-model="resCols" label="列数" />
      <div class="toolbar-search">
        <span class="s-icon">🔍</span>
        <input type="text" v-model="resSearch" placeholder="搜索资源台内资源...">
      </div>
      <button class="toolbar-batch" :class="{active: batchMode}" @click="toggleBatchMode">{{ batchMode ? '✓ 完成批量' : '☑ 批量管理' }}</button>
      <button class="mini-btn" @click="importModalOpen = true">⬇ 导入</button>
      <span class="hint-chip">卡片在此存储为真身 · 📡 单卡/📤 分类可镜像到各策展台 · 源数据零影响</span>
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
        <!-- R69：默认根节点「全部分类」——聚合全台卡片，作为进入资源台的默认落点 -->
        <div class="cat-item" :class="{ active: activeCat === ALL_CAT }" @click="activeCat = ALL_CAT"
          title="聚合资源台全部分类下的卡片">
          <span class="cat-caret placeholder" /><span class="cat-icon">🗂</span><span class="cat-name">全部分类</span>
          <span class="cat-count">{{ nativeCards.length }}</span>
        </div>
        <div class="cat-item" :class="{ active: activeCat === '' }" @click="activeCat = ''"
          @dragover.prevent @drop="onTreeDrop($event, '')">
          <span class="cat-caret placeholder" /><span class="cat-icon">📥</span><span class="cat-name">未分类</span>
          <span class="cat-count">{{ cardsIn('').length }}</span>
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
              <span v-if="!isMirror(c)" class="cat-act" title="镜像分类到策展台（含现有卡片）" @click.stop="openMirrorCat(c)">📤</span>
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
                <span v-if="!isMirror(ch)" class="cat-act" title="镜像分类到策展台（含现有卡片）" @click.stop="openMirrorCat(ch)">📤</span>
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

      <!-- 右 · 内容区（R65-F1：卡片/列表/看板三视图，对齐策展台） -->
      <div class="cur-main">
        <div class="cur-sec-label">
          {{ viewLabel }}
          <span>原生 {{ viewNativeCount }} · 投射 {{ viewProjCount }}<template v-if="viewLiveCount"> · 源镜像 {{ viewLiveCount }}</template></span>
        </div>

        <!-- ===== 卡片视图：R55-A1 统一混排网格 ｜ R59-T10 父分类分区 ｜ R65 批量勾选 ===== -->
        <template v-if="viewMode==='card'">
        <template v-for="sec in sectionsView" :key="sec.key">
          <div v-if="sec.title" class="cur-sec-label sec-child" :class="{ proj: sec.isMirror }">
            {{ sec.icon }} {{ sec.title }}
            <span>原生 {{ sec.n }} · 投射 {{ sec.p }}<template v-if="sec.l"> · 源镜像 {{ sec.l }}</template></span>
          </div>
          <div class="cur-grid" @dragover="onAreaDragOver($event, sec.key)" @drop="onAreaDrop($event, sec.key)">
          <template v-for="m in sec.cards" :key="sec.key + m.type + m.id">
            <!-- 原生卡 -->
            <div v-if="m.type === 'native' && m.r" class="cur-card native" :class="{ pinned: m.r.pinned, selected: batchMode && selectedIds.has(m.r.id) }"
              draggable="true" @dragstart="onCardDragStart($event, m.r)" @dragover.prevent @drop.stop="onAnyCardDrop($event, m.r, false)" @dragend="clearDragState"
              @click="batchMode ? toggleSelect(m.r!.id) : onCardClick(() => openResource(m.r!))" @dblclick="onCardDblClick(() => openCard(m.r!))"
              :title="'单击详情 · 双击打开链接 · 拖拽移入其他分类/与镜像卡相互排列'">
              <div v-if="batchMode" class="cc-batch-check" :class="{on: selectedIds.has(m.r.id)}">{{ selectedIds.has(m.r.id)?'✓':'' }}</div>
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
                <span class="cc-act" title="镜像到策展台" @click.stop="openMirrorCard(m.r)">📡</span>
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
                  <span class="cc-act" title="定位到源策展台" @click.stop="locateSource(cardById(m.p.cardId)!)">🎯</span>
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
                  <span class="cc-act" title="定位到源策展台" @click.stop="locateSource(cardById(m.p!.cardId)!)">🎯</span>
                </div>
              </template>
            </div>
          </template>
          <div v-if="!sec.cards.length" class="cur-empty-native">当前分组还没有卡片 —— 右上角「＋ 新建卡片」，或从采集浮层（Ctrl+Shift+J）入台</div>
          </div>
        </template>
        <div v-if="!isParentView && !viewMixed.length" class="cur-empty">
          当前分类还是空的 —— 顶部「＋ 新建卡片」，或从采集浮层（Ctrl+Shift+J）把资源收入资源台；需要策展时用 📡/📤 镜像到策展台
        </div>
        </template>

        <!-- ===== 列表视图（R65-F1） ===== -->
        <div v-else-if="viewMode==='list'">
          <template v-for="sec in sectionsView" :key="sec.key">
            <div v-if="sec.title" class="cur-sec-label sec-child" :class="{ proj: sec.isMirror }">{{ sec.icon }} {{ sec.title }} <span>{{ sec.cards.length }} 张</span></div>
            <div class="res-list">
              <div v-for="m in sec.cards" :key="sec.key + m.type + m.id" class="res-row" :class="{ selected: batchMode && m.type==='native' && m.r && selectedIds.has(m.r.id) }"
                @click="rowClick(m)" @dblclick="rowDblClick(m)">
                <div v-if="batchMode && m.type==='native' && m.r" class="cc-batch-check inline" :class="{on: selectedIds.has(m.r.id)}" @click.stop="toggleSelect(m.r.id)">{{ selectedIds.has(m.r.id)?'✓':'' }}</div>
                <span v-else-if="m.type!=='native'" class="cc-badge">📡</span>
                <span class="rr-title" :class="{ mirror: m.type!=='native' }">{{ rowCard(m)?.title }}</span>
                <span class="rr-f">{{ rowCard(m)?.link }}</span>
                <span class="rr-actions">
                  <span v-if="m.type==='native' && m.r" class="rr-action" :class="{on: m.r.pinned}" @click.stop="togglePin(m.r)">📌</span>
                  <span v-if="m.type==='native' && m.r" class="rr-action delete" @click.stop="deleteNative(m.r)">🗑</span>
                  <span v-if="m.type!=='native'" class="rr-action" @click.stop="rowCard(m) && openCard(rowCard(m)!)" title="打开链接">↗</span>
                </span>
              </div>
            </div>
          </template>
        </div>

        <!-- ===== 看板视图（R65-F1：未分类 + 根分类两轴，卡片可拖入换列） ===== -->
        <div v-else-if="viewMode==='kanban'" class="kanban">
          <div v-for="col in kanbanCols" :key="col.key" class="kanban-col"
            @dragover="onAreaDragOver($event, col.key)" @drop="onAreaDrop($event, col.key)">
            <div class="kc-header">
              <span class="kc-name">{{ col.mirror ? '📡' : '📂' }} {{ col.name }}</span>
              <span class="kc-count">{{ mixedCardsOf(col.key).length }}</span>
            </div>
            <div class="kc-body">
              <div v-for="m in mixedCardsOf(col.key)" :key="m.type + m.id" class="kc-card" :class="{ pinned: m.type==='native' && m.r?.pinned }"
                :draggable="true" @dragstart="m.type==='native' && m.r ? onCardDragStart($event, m.r) : (m.p && onProjDragStart($event, m.p))"
                @click="rowClick(m)" @dblclick="rowDblClick(m)">
                <div class="kc-card-title"><span v-if="m.type!=='native'" class="cc-badge">📡</span>{{ rowCard(m)?.title }}</div>
                <div class="kc-card-footer">
                  <span v-if="(m.r || cardById(m.p?.cardId))?.link" class="kc-card-link">🔗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- R65-F1：批量操作浮动栏 -->
    <Transition name="batch">
      <div v-if="batchMode && selectedIds.size" class="batch-bar">
        <span class="batch-count">已选 {{ selectedIds.size }} 张</span>
        <button class="batch-btn" @click="selectAllVisible">全选/反选</button>
        <button class="batch-btn" @click="batchOpen">🔗 批量打开链接</button>
        <button class="batch-btn" @click="openBatchMove">📦 移动到…</button>
        <button class="batch-btn danger" @click="batchDelete">🗑 批量删除</button>
        <button class="batch-btn" @click="selectedIds.clear()">取消</button>
      </div>
    </Transition>

    <!-- R65-F1：资源卡详情抽屉（单击打开，共享 ResourceEditForm，对齐策展台） -->
    <div class="overlay" :class="{open: drawerOpen}" @click="closeDrawer"></div>
    <div class="drawer" :class="{open: drawerOpen}">
      <div class="dr-body">
        <ResourceEditForm
          :model="editingResource"
          height-key="cur-note"
          :show-close="true"
          @save="saveResource"
          @close="closeDrawer"
        />
      </div>
      <div class="dr-footer">
        <button class="dr-footer-btn danger" @click="deleteCurrentResource">🗑 删除</button>
        <button class="dr-footer-btn" @click="copyLink">🔗 复制链接</button>
        <button class="dr-footer-btn" @click="openCard(editingResource)">↗ 打开链接</button>
        <button class="dr-footer-btn primary" @click="saveResource">✓ 保存</button>
      </div>
    </div>

    <!-- R65-F1：导入弹窗（书签导入 / 本地文件导入） -->
    <div class="modal-overlay" :class="{open: importModalOpen}" @click.self="importModalOpen=false">
      <div class="modal">
        <div class="modal-header">
          <span style="font-size:16px">⬇</span>
          <span class="mh-title">导入资源到资源台</span>
          <div class="modal-close" @click="importModalOpen=false">×</div>
        </div>
        <div class="modal-body">
          <div class="modal-option" @click="bookmarkInput?.click()">
            <span class="mo-icon">🔖</span>
            <div>
              <div class="mo-name">导入书签文件</div>
              <div class="mo-desc">选择浏览器导出的书签 HTML，文件夹结构生成为分类（最多 2 级），链接+标题按原归类写入资源卡</div>
            </div>
          </div>
          <div class="modal-option" @click="fileImport">
            <span class="mo-icon">📁</span>
            <div>
              <div class="mo-name">本地文件导入</div>
              <div class="mo-desc">获取文件名写入资源卡，双击打开前补全完整路径即可本地打开</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <input ref="bookmarkInput" type="file" accept=".html,.htm" style="display:none" @change="handleBookmarkImport" />
    <input ref="fileImportInput" type="file" multiple style="display:none" @change="handleFileImport" />

    <!-- R65-F1：书签导入文件夹选择 -->
    <div class="modal-overlay" :class="{open: bookmarkModalOpen}" @click.self="bookmarkModalOpen=false">
      <div class="modal">
        <div class="modal-header">
          <span style="font-size:16px">🔖</span>
          <span class="mh-title">选择要导入的书签文件夹</span>
          <div class="modal-close" @click="bookmarkModalOpen=false">×</div>
        </div>
        <div class="modal-body bk-body">
          <div class="bk-hint">导入后将按文件夹结构生成分类（前 2 级，同名自动合并），卡片归入原文件夹对应的分类；更深层级转为标签。后续可自行增删改分类。</div>
          <label class="bk-all"><input type="checkbox" :checked="allBkChecked" @change="toggleAllBk" /> 全部导入（{{ bkTotalCount }} 个书签）</label>
          <div class="bk-list">
            <label v-for="f in bkFolders" :key="f.path" class="bk-item">
              <input type="checkbox" v-model="f.checked" />
              <span class="bk-name">📁 {{ f.path }}</span>
              <span class="bk-count">{{ f.count }} 个书签</span>
            </label>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="bookmarkModalOpen=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmBookmarkImport">✓ 导入所选</button>
        </div>
      </div>
    </div>

    <!-- R65-F1：批量移动弹窗（目标 = 资源台分类树） -->
    <div class="modal-overlay" :class="{open: moveModalOpen}" @click.self="moveModalOpen=false">
      <div class="modal" style="width:420px">
        <div class="modal-header">
          <span style="font-size:16px">📦</span>
          <span class="mh-title">移动 {{ selectedIds.size }} 张资源卡</span>
          <div class="modal-close" @click="moveModalOpen=false">×</div>
        </div>
        <div class="modal-body">
          <div class="mc-field"><label>目标分类</label>
            <select v-model="moveTarget" class="bk-count" style="width:100%;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;font-size:12.5px;color:var(--text)">
              <option v-for="o in moveCatOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer-row">
          <button class="dr-footer-btn" @click="moveModalOpen=false">取消</button>
          <button class="dr-footer-btn primary" @click="confirmBatchMove">✓ 移动</button>
        </div>
      </div>
    </div>

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
    <!-- R61：镜像到策展台（单卡/分类） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="mirrorModal" class="modal-mask" @click.self="mirrorModal = null">
          <div class="modal-card">
            <div class="mc-title">{{ mirrorModal.kind === 'card' ? '📡 镜像卡片到策展台' : '📤 镜像分类到策展台' }}</div>
            <div class="mc-field"><label>目标策展台 *</label>
              <select v-model="mirrorModal.toWs">
                <option v-for="b in boards" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>
            <div v-if="mirrorModal.kind === 'card'" class="mc-field"><label>落入分类</label>
              <select v-model="mirrorModal.toCat">
                <option value="">未分类（该台）</option>
                <option v-for="c in mirrorTargetCats" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div v-else class="mc-field"><label>说明</label>
              <div class="mc-ro">「{{ mirrorModal.catName }}」将物化为目标台的镜像分类，现有卡片一并投射；此后源分类新增卡片需手动再镜像。</div>
            </div>
            <div class="mc-foot">
              <button class="mini-btn" @click="mirrorModal = null">取消</button>
              <button class="mini-btn primary" @click="confirmMirror">镜像</button>
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
/* R72：卡片视图列数由 --grid-cols 驱动（4/5/6/7）；容器放不下 N 列时自动降列，卡片最小 240px */
.cur-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(240px, calc((100% - (var(--grid-cols, 5) - 1) * 10px) / var(--grid-cols, 5))), 1fr)); gap: 10px; }
.cur-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 6px;
  /* R71：屏外卡片跳过渲染（对齐策展台 .res-card 的 R55-F4 做法） */
  content-visibility: auto; contain-intrinsic-size: auto 132px; }
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
.mc-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.fade-enter-active, .fade-leave-active { transition: opacity .18s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ===== R65-F1：工具条（对齐策展台） ===== */
.view-tabs { display: flex; background: var(--surface-2); border-radius: 8px; padding: 3px; gap: 2px; }
.view-tab { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; color: var(--text-2); transition: all .15s; display: flex; align-items: center; gap: 4px; }
.view-tab:hover { color: var(--text); }
.view-tab.active { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.toolbar-search { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); transition: all .15s; }
.toolbar-search:focus-within { border-color: var(--accent); }
.toolbar-search input { border: none; outline: none; font-size: 12px; width: 150px; background: transparent; color: var(--text); }
.toolbar-search .s-icon { color: var(--text-3); font-size: 13px; }
.toolbar-batch { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; white-space: nowrap; }
.toolbar-batch:hover { border-color: var(--accent); color: var(--accent); }
.toolbar-batch.active { background: var(--accent-light); border-color: var(--accent); color: var(--accent); font-weight: 600; }

/* ===== R65-F1：批量勾选框 + 浮动栏 ===== */
.cc-batch-check { position: absolute; top: 8px; left: 8px; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border-strong); background: var(--surface); display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; z-index: 3; }
.cc-batch-check.on { background: var(--accent); border-color: var(--accent); }
.cc-batch-check.inline { position: static; flex-shrink: 0; }
.cur-card.selected { outline: 2px solid var(--accent); outline-offset: -2px; }
.batch-bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 150; display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); flex-wrap: wrap; }
.batch-count { font-size: 12.5px; font-weight: 700; color: var(--accent); margin-right: 4px; }
.batch-btn { padding: 6px 13px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all .15s; font-family: inherit; }
.batch-btn:hover { border-color: var(--accent); color: var(--accent); }
.batch-btn.danger { color: #F85149; border-color: color-mix(in srgb, #F85149 30%, var(--border)); }
.batch-btn.danger:hover { background: #F85149; color: #fff; border-color: #F85149; }
.batch-enter-active, .batch-leave-active { transition: all .2s cubic-bezier(.16,1,.3,1); }
.batch-enter-from, .batch-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ===== R65-F1：抽屉 ===== */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 200; opacity: 0; pointer-events: none; transition: opacity .25s; }
.overlay.open { opacity: 1; pointer-events: auto; }
.drawer { position: fixed; top: 0; right: 0; width: 440px; height: 100%; background: var(--surface); z-index: 201; transform: translateX(100%); transition: transform .3s cubic-bezier(.4,0,.2,1); box-shadow: 0 10px 36px rgba(0,0,0,.08); display: flex; flex-direction: column; }
.drawer.open { transform: translateX(0); }
.dr-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
.dr-footer { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
.dr-footer-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px; border-radius: 8px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all .15s; font-family: inherit; }
.dr-footer-btn:hover { border-color: var(--accent); color: var(--accent); }
.dr-footer-btn.danger:hover { border-color: #F85149; color: #F85149; }
.dr-footer-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }

/* ===== R65-F1：导入/移动弹窗（modal-overlay 体系） ===== */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 300; display: none; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: var(--surface); border-radius: 12px; box-shadow: 0 10px 36px rgba(0,0,0,.12); width: 480px; max-width: 90vw; overflow: hidden; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.modal-header .mh-title { font-size: 14px; font-weight: 600; color: var(--text); flex: 1; }
.modal-close { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 16px; }
.modal-close:hover { background: var(--surface-3); color: var(--text); }
.modal-body { padding: 18px 20px; max-height: 50vh; overflow-y: auto; }
.modal-footer-row { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; }
.modal-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 10px; cursor: pointer; transition: all .15s; }
.modal-option:hover { border-color: var(--accent); background: var(--accent-light); }
.modal-option .mo-icon { font-size: 20px; }
.modal-option .mo-name { font-size: 13px; font-weight: 500; color: var(--text); }
.modal-option .mo-desc { font-size: 10.5px; color: var(--text-3); margin-top: 2px; line-height: 1.5; }
.bk-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.7; padding: 8px 10px; background: var(--surface-2); border-radius: 6px; margin-bottom: 8px; }
.bk-all { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text); padding: 6px 0 10px; cursor: pointer; }
.bk-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.bk-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.bk-item:hover { background: var(--surface-2); }
.bk-name { flex: 1; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-count { font-size: 10.5px; color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; }

/* ===== R65-F1：列表视图 ===== */
.res-list { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-bottom: 10px; }
.res-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all .1s;
  content-visibility: auto; contain-intrinsic-size: auto 42px; }
.res-row:last-child { border-bottom: none; }
.res-row:hover { background: var(--surface-2); }
.res-row.selected { background: var(--accent-light); }
.rr-title { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rr-title.mirror { color: var(--text-2); }
.rr-f { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rr-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.res-row:hover .rr-actions { opacity: 1; }
.rr-action { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all .1s; }
.rr-action:hover { background: var(--surface-3); color: var(--text); }
.rr-action.delete:hover { color: #F85149; }
.rr-action.on { color: #d99a1e; }

/* ===== R65-F1：看板视图 ===== */
.kanban { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 10px; min-height: 400px; }
.kanban-col { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; width: 260px; flex-shrink: 0; display: flex; flex-direction: column; max-height: calc(100vh - 220px); }
.kc-header { position: sticky; top: 0; z-index: 1; background: var(--surface-2); padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.kc-name { font-size: 12px; font-weight: 600; color: var(--text); }
.kc-count { font-size: 10px; background: var(--surface); color: var(--text-3); padding: 1px 7px; border-radius: 99px; }
.kc-body { padding: 8px; overflow-y: auto; flex: 1; min-height: 60px; }
.kc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; margin-bottom: 7px; cursor: pointer; transition: all .15s; }
.kc-card:hover { border-color: var(--accent); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 8%, transparent); }
.kc-card.pinned { border-left: 3px solid var(--accent); }
.kc-card-title { font-size: 12px; font-weight: 500; color: var(--text); line-height: 1.4; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kc-card-footer { display: flex; align-items: center; gap: 5px; }
.kc-card-link { font-size: 10px; margin-left: auto; }
</style>
