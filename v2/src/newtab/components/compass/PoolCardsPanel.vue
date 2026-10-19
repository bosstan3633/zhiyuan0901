<script setup lang="ts">
/**
 * R2-③ 建面板 → R2-④⑤ 收口 → R2-⑧ 管理面收编：资源卡池面板
 * —— 资源台退役后，池卡的唯一管理面。
 * 已有：搜索 + 网格 + 单击开详情（记一次调出）+ 软删带撤销 + `?hl=&hk=res` 定位高亮。
 * R2-⑧ 补：新建单卡 / 本地文件导入入口重落（R179 parked 的那条）/ 批量选择（打标签·删除）/ 增量渲染上限。
 * R3-Ca 补：列表视图 / 「待打标」筛选（R179 迁移时承诺的兜底出口）/ 批量反选 / 右键菜单（置顶·复制链接·删除）。
 * ★有意偏离记账（更新）：**看板视图仍不做**——资源卡没有状态字段，看板无列可分；列表视图已补上，
 *   它与网格不是"信息重叠"而是密度差（列表标签全展开、一屏看得多）。
 * 数据口径：workspaceId=CURATION_WS_ID（隐藏池 id，R179 定案）且未软删。
 */
import Icon from '@/shared/components/Icon.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../stores/app'
import { CURATION_WS_ID, type ResourceCard } from '@/shared/models'
import { uid } from '@/shared/utils'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { showToast } from '@/shared/components/toast'
import { saveUIPrefs } from '@/shared/storage/repository'
import { recordResourceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { projectCardToBoard } from '@/shared/storage/hub'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import NewBadge from '@/shared/components/NewBadge.vue'
import { useWorkspaceImport } from '../../composables/useWorkspaceImport'
import { useBatchSelect, addTagToCards } from '../../composables/useBatchSelect'
import DeckBatchBar from './DeckBatchBar.vue'
import DeckControls from './DeckControls.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const props = withDefaults(defineProps<{
  /** 独立二级页：隐藏新建/本地导入入口，空态主行动改为清空筛选。 */
  secondaryMode?: boolean
}>(), { secondaryMode: false })

const query = ref('')
/** R3-Ca：视图两档（网格/列表）——与任务、好奇面板同口径存组件内 ref，不落盘（三面板一致，别在这里单开持久化）
 *  ★W15-T2（用户拍板 2026-10-16）：**默认改列表** —— 池卡 261 张，网格一屏只放得下十几张且标签要折行，
 *  列表才是一屏看更多的那个（网格保留为可选视图，不删）。 */
const viewMode = ref<'card' | 'list'>('list')
/** R3-Ca：「待打标」筛选——池卡由标签组织，无标签=召回不上的存量，这条是 R179 迁移时承诺的兜底出口 */
const onlyUntagged = ref(false)
type CalledFilter = 'all' | 'called' | 'never'
const calledFilter = ref<CalledFilter>('all')
// V3.9.1：首页「本周复用」进入资源二级页时直接落到“已调出”，保持入口语义。
if (route.query.called === 'called') calledFilter.value = 'called'
/* W5（V3.8.5）#3：排序接线 DeckControls —— 三档（最近更新默认 / 最近采集 / 最近调出）+ 方向钮。
   偏好键用 `pool`（新键，不碰 useResourceView 的 `sortPrefs.res`——那是策展台资源台的口径）。
   置顶恒浮顶（与档位/方向无关，右键菜单的置顶动作语义即"钉在最上面"）。 */
type PoolSortBy = 'updated' | 'created' | 'called'
const POOL_SORTS = [
  { id: 'updated', label: '最近更新' },
  { id: 'created', label: '最近采集' },
  { id: 'called', label: '最近调出' }
]
const POOL_SORT_KEYS: PoolSortBy[] = ['updated', 'created', 'called']
const savedPoolSort = store.ui?.sortPrefs?.pool?.by
const sortBy = ref<PoolSortBy>(POOL_SORT_KEYS.includes(savedPoolSort as PoolSortBy) ? savedPoolSort as PoolSortBy : 'updated')
const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.pool?.dir === 'asc') ? 'asc' : 'desc')
watch([sortBy, sortDir], () => {
  const sp = { ...(store.ui?.sortPrefs || {}), pool: { by: sortBy.value, dir: sortDir.value } }
  if (store.ui) store.ui.sortPrefs = sp
  saveUIPrefs({ sortPrefs: sp })
})
function toggleSortDir() { sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc' }
const poolCards = computed(() => {
  const q = query.value.trim().toLowerCase()
  const dirMul = sortDir.value === 'asc' ? 1 : -1
  const keyOf = (r: ResourceCard): number =>
    sortBy.value === 'created' ? (r.createdAt || 0)
    : sortBy.value === 'called' ? (r.callCount || 0)
    : (r.updatedAt || 0)
  return (store.data?.resources || [])
    .filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
    .filter(r => !q || r.title.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q)))
    .filter(r => !onlyUntagged.value || !(r.tags || []).length)
    .filter(r => calledFilter.value === 'all' || (calledFilter.value === 'called' ? !!r.lastCalledAt : !r.lastCalledAt))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (keyOf(b) - keyOf(a)) * dirMul)
})
const poolTotal = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID).length)
const untaggedCount = computed(() => (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID && !(r.tags || []).length).length)
/** R3-Cc2：控制行的值域在这里配置，模板里不写第二套按钮 */
const poolViews = [{ id: 'card', label: '▦ 网格', title: '网格视图' }, { id: 'list', label: '列表', title: '列表视图（一屏看更多，标签全展开）' }]

/* ===== ★W15-T3（用户拍板 2026-10-16）链接类型分组 =====
 * 口径已澄清定案（用户确认"一张卡只会拥有一个类别的链接"）：
 *   link 为空 → 'none'（含"选了本地槽但没填值"）
 *   linkType=file → 'file'（**含只存了文件名打不开的卡** —— 用户视角它就是本地文件卡）
 *   linkType=obsidian → 'obsidian'
 *   其余 → 'url'（**只收 http/https**，obsidian:// 在协议层也是 URL，不许重复计入）
 * 组序固定：本地文件 → URL → Obsidian → 无链接（无链接垫底：它最不需要被优先找到）。
 * 为什么按当前槽归唯一组：三槽设计允许一张卡存多条链，若"命中即入多个组"，各组张数相加会远大于池内
 * 总数，头部「261 张」与分组计数对不上账，用户会以为数据错乱。若将来真有卡填了多条，副槽用行尾小徽标提示。 */
type PoolGroup = 'file' | 'url' | 'obsidian' | 'none'
const POOL_GROUPS: { id: PoolGroup; label: string; title: string }[] = [
  { id: 'file', label: '本地文件', title: '链接指向本机文件（仅存文件名、打不开的也算这一类）' },
  { id: 'url', label: '含 URL 链接', title: '链接是网页地址（http/https）' },
  { id: 'obsidian', label: 'Obsidian 链接', title: 'obsidian:// 协议链接' },
  { id: 'none', label: '○ 无链接', title: '没有链接的卡（纯文字卡 / 只选了槽没填值）' }
]
function groupOf(r: ResourceCard): PoolGroup {
  if (!(r.link || '').trim()) return 'none'
  if (r.linkType === 'file') return 'file'
  if (r.linkType === 'obsidian') return 'obsidian'
  // ★V3.8.25（B1-a 顺手清账）：原为 `startsWith('http') ? 'url' : 'url'` —— 两支同值，
  // 是 G1 批量剥离留下的死三元（P0-S3 只认 `? '' : ''`，空格版/同字面量版都漏了）。
  // 走到这里已经排除了 none/file/obsidian，剩下的就是 url 一类，判定条件本身没有意义。
  return 'url'
}
/** 当前选中的分组（'' = 不分组，按排序档位平铺） */
const groupBy = ref<'' | PoolGroup>('')
const groupCounts = computed(() => {
  const m: Record<PoolGroup, number> = { file: 0, url: 0, obsidian: 0, none: 0 }
  for (const r of poolCards.value) m[groupOf(r)]++
  return m
})
/** 分组视图 = 只保留当前分组 + 空组不渲染（组序按 POOL_GROUPS 定义，池内无卡的小组直接不出现） */
const groupSections = computed(() => {
  if (!groupBy.value) return []
  const all = poolCards.value
  return [{ id: groupBy.value as PoolGroup, cards: all.filter(r => groupOf(r) === groupBy.value) }]
    .filter(s => s.cards.length > 0)
})
function toggleGroup(id: string) { groupBy.value = groupBy.value === id ? '' : (id as PoolGroup) }
watch(groupBy, () => { visibleCount.value = PAGE })

/* ===== ★W15-T3 镜像到策展台（行内入口）=====
 * 与详情抽屉 ResourceDetailDrawer 走**同一个** projectCardToBoard 口径（不另写一套投射逻辑），
 * 目标台用行内小下拉选（不为一个下拉再加一层弹窗），选过的台记忆为下次默认。 */
const mirrorBoards = computed(() =>
  (store.data?.workspaces || []).filter(w => w.kind !== 'resource' && w.id !== CURATION_WS_ID && !w.archived))
const mirrorWsId = ref('')
const mirrorOpenFor = ref<string | null>(null)
/** 已镜像过的卡（curationProjections 里有该卡的 card 记录）⇒ 行上标「已镜像」，防重复镜像 */
function isMirrored(r: ResourceCard): boolean {
  return (store.data?.curationProjections || []).some(p => p.kind === 'card' && p.cardId === r.id)
}
function openMirror(r: ResourceCard) {
  mirrorOpenFor.value = mirrorOpenFor.value === r.id ? null : r.id
  if (!mirrorWsId.value && mirrorBoards.value.length) mirrorWsId.value = mirrorBoards.value[0].id
}
function doMirror(r: ResourceCard) {
  const wsId = mirrorWsId.value
  if (!wsId) { showToast('请先在行内选一个目标策展台'); return }
  if (!store.data) { showToast('数据未就绪'); return }
  const rec = projectCardToBoard(store.data, r.id, wsId)
  if (!rec) { showToast('该台已经镜像过这张卡'); return }
  store.persist()
  const name = (store.data.workspaces || []).find(w => w.id === wsId)?.name || '策展台'
  mirrorOpenFor.value = null
  showToast(`已镜像到「${name}」（源卡仍在资源卡池）`)
}
/** 胶囊组没有"再点一次取消"的语义（点谁选谁），这里补上：再点「待打标」= 回到全部 */
function onPoolFilter(v: string) {
  if (v === 'untagged') { onlyUntagged.value = !onlyUntagged.value; calledFilter.value = 'all'; return }
  onlyUntagged.value = false
  calledFilter.value = v === 'called' || v === 'never' ? v : 'all'
}
const poolFilters = computed(() => [
  { id: 'all', label: '全部', count: poolTotal.value },
  { id: 'untagged', label: '待打标', count: untaggedCount.value, title: '无标签的卡在任何筛选下都召回不到——这里单独捞出来补标' },
  { id: 'called', label: '已调出', count: (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID && r.lastCalledAt).length, title: '至少被打开过一次' },
  { id: 'never', label: '从未调出', count: (store.data?.resources || []).filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID && !r.lastCalledAt).length, title: '还没有被打开过的卡' }
])
const activeFilter = computed(() => onlyUntagged.value ? 'untagged' : calledFilter.value)
function clearPoolFilter(): void {
  query.value = ''
  onlyUntagged.value = false
  calledFilter.value = 'all'
}

/* ===== R2-⑧ 增量渲染：默认一屏 60 张，滚动到底自动追加（260 张实测 449ms/longtask 0，
   但线性上涨到 500+ 就是首屏成本——上限先立住，不必等它变慢再补） ===== */
const PAGE = 60
const visibleCount = ref(PAGE)
watch(query, () => { visibleCount.value = PAGE })
watch([sortBy, sortDir], () => { visibleCount.value = PAGE })
const rendered = computed(() => poolCards.value.slice(0, visibleCount.value))
const hasMore = computed(() => poolCards.value.length > visibleCount.value)
function renderMore() { if (hasMore.value) visibleCount.value += PAGE }
let sentinel: HTMLElement | null = null
let io: IntersectionObserver | null = null
const setSentinel = (el: unknown) => {
  if (io) { io.disconnect(); io = null }
  sentinel = (el as HTMLElement | null) ?? null
  if (!sentinel || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) renderMore() }, { rootMargin: '240px' })
  io.observe(sentinel)
}
onBeforeUnmount(() => { io?.disconnect(); io = null })

/**
 * R2-④：`?hl=&hk=res` 卡片定位消费者（⌘K / 网页浮层 / AI 面板直达同一条链路）。
 * 纪律照 `useWsLocate.ts:61-68`：**hk 指明别的卡型就让路**——调度台同页挂着任务卡与好奇卡两个
 * hl 消费者，抢着处理会把别人的定位抹掉（R152 真机报过的那类 bug）。
 */
const highlightId = ref<string | null>(null)
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk && hk !== 'res') return
  const hit = (store.data?.resources || []).find(r => r.id === hl && !r.deletedAt)
  if (!hit) return
  if (hit.workspaceId !== CURATION_WS_ID) { showToast('这张卡不在资源卡池（在策展台内）'); return }
  query.value = '' // 过滤态下目标卡可能根本不在渲染列表里，定位先清过滤
  visibleCount.value = Math.max(visibleCount.value, poolCards.value.findIndex(r => r.id === hl) + 1) // 目标卡在分页之外时先把它渲出来
  highlightId.value = hl
  nextTick(() => {
    setTimeout(() => {
      document.querySelector(`[data-rid="${hl}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => { highlightId.value = null }, 2000)
    }, 120)
  })
  router.replace({ path: route.path })
}, { immediate: true })

// ---- 三卡交互统一（单击详情 / 双击打开卡内链接，与任务、好奇面板同款 260ms 去重） ----
let pcpClickTimer: ReturnType<typeof setTimeout> | null = null
function openCard(r: ResourceCard) {
  if (batchMode.value) { toggleSel(r.id); return }
  if (pcpClickTimer) { clearTimeout(pcpClickTimer); pcpClickTimer = null; return }
  pcpClickTimer = setTimeout(() => {
    pcpClickTimer = null
    emitOpenDrawer({ kind: 'res', id: r.id })
  }, 260)
}
/** 二级页深链 `?hl=`：直接打开右侧资源详情，不依赖 260ms 单击去重计时器。 */
function openDetail(id: string) {
  const r = (store.data?.resources || []).find(x => x.id === id && !x.deletedAt)
  if (r) emitOpenDrawer({ kind: 'res', id: r.id })
}
defineExpose({ openDetail })
function openCardLink(r: ResourceCard) {
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { showToast('该卡片还没有可打开的链接，可在详情中添加'); return }
  recordResourceOpen(store.data!, r)
  store.persistHot()
  openExternalLink(url)
}
function onCardDblClick(r: ResourceCard) {
  if (batchMode.value) return
  if (pcpClickTimer) { clearTimeout(pcpClickTimer); pcpClickTimer = null }
  openCardLink(r)
}
function removeCard(r: { id: string; title: string }) {
  const live = (store.data?.resources || []).find(x => x.id === r.id)
  if (!live) return
  live.deletedAt = Date.now()
  store.persist()
  showToast(`已删除「${live.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = (store.data?.resources || []).find(x => x.id === r.id)
    if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
  } })
}

/* ===== R3-Ca 右键菜单（与好奇面板共用 ContextMenu 单根；池卡此前只有单击开详情，
   置顶/复制链接这类"不想开详情"的动作没有出口） ===== */
const ctx = ref({ open: false, x: 0, y: 0 })
const ctxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
function openCtx(e: MouseEvent, r: ResourceCard) {
  e.preventDefault()
  ctxItems.value = [
    { label: '打开详情', icon: 'eye', cb: () => emitOpenDrawer({ kind: 'res', id: r.id }) },
    { label: r.pinned ? '取消置顶' : '置顶', cb: () => { r.pinned = !r.pinned; r.updatedAt = Date.now(); store.persist() } },
    ...(r.link ? [{ label: '复制链接', cb: () => { void navigator.clipboard?.writeText(r.link).then(() => showToast('链接已复制'), () => showToast('复制失败（浏览器未授权剪贴板）')) } }] : []),
    { label: '删除（进回收站）', icon: 'trash', danger: true, cb: () => removeCard(r) }
  ]
  ctx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 220) }
}

/* ===== R2-⑧ 新建单卡（标题必填，链接/标签可选；采集仍是主要入口，这里补「我知道要什么」的场景） ===== */
const newOpen = ref(false)
const newDraft = ref({ title: '', link: '', tags: '' })
function openNew() {
  if (props.secondaryMode) return
  newDraft.value = { title: '', link: '', tags: '' }
  newOpen.value = true
}
function parseTags(s: string): string[] {
  return Array.from(new Set(s.split(/[,，;；]/).map(t => t.trim()).filter(Boolean)))
}
function createCard() {
  const title = newDraft.value.title.trim()
  if (!title) { showToast('请输入标题'); return }
  const link = newDraft.value.link.trim()
  const now = Date.now()
  const card: ResourceCard = {
    id: uid('rc'), kind: 'resource', title,
    linkType: /^file:\/\//i.test(link) ? 'file' : /^obsidian:/i.test(link) ? 'obsidian' : 'url',
    link, workspaceId: CURATION_WS_ID, categoryId: '',
    description: '', tags: parseTags(newDraft.value.tags), assets: [], customFields: {},
    pinned: false, callCount: 0, createdAt: now, updatedAt: now
  }
  store.data!.resources.unshift(card)
  store.persist()
  newOpen.value = false
  query.value = ''
  showToast(`已入池「${title.slice(0, 20)}」`)
}

/* ===== R2-⑧ 本地文件导入：入口重落到这里（R179 把链路 parked 在 Workspace.vue:673，
   并写明「本地文件导入迁调度台 3张卡『新建』弹窗」）。实现仍复用 useWorkspaceImport 一条口径，
   只是把 workspaceId 钉成池 id、分类留空（池卡由标签组织，R179 已删分类控件）。 ===== */
const { fileImportInput, fileImport, handleFileImport } = useWorkspaceImport({
  d: computed(() => store.data!),
  workspaceId: computed(() => CURATION_WS_ID),
  newCardCatId: () => '',
  persist: () => store.persist()
})

/* ===== R2-⑧ 批量 → R3-Cb 选择与打标口径收归 useBatchSelect 一份实现 ===== */
const batchMode = ref(false)
const { selected, size: selSize, allSelected, toggle: toggleSel, selectAll, invert: invertSel, clear: clearSel, setMode } = useBatchSelect(() => poolCards.value.map(r => r.id))
function toggleBatch() { batchMode.value = setMode(!batchMode.value) }
function applyTagToSelected(t: string) {
  const n = addTagToCards(store.data!.resources, selected.value, t)
  store.persist()
  showToast(`已给 ${n} 张卡加标签「${t}」（只加不减，去标签到卡详情里改）`)
}
function deleteSelected() {
  const ids = Array.from(selected.value)
  if (!ids.length) { showToast('还没选中卡片'); return }
  const now = Date.now()
  for (const r of store.data!.resources) if (ids.includes(r.id) && !r.deletedAt) r.deletedAt = now
  store.persist()
  clearSel()
  showToast(`已删除 ${ids.length} 张卡 · 进回收站`, { label: '撤销', cb: () => {
    for (const r of store.data!.resources) if (ids.includes(r.id) && r.deletedAt === now) r.deletedAt = undefined
    store.persist()
  } })
}
</script>

<template>
  <div class="pcp">
    <!-- R3-Cc2：控制行收归 DeckControls——顺序/样式一份实现，池的值域（两档视图 + 全部/待打标）以数据传入 -->
    <DeckControls panel="pool" search search-ph="快速过滤标题 / 标签..." :query="query" @search="query = $event"
      :filters="poolFilters" :filter="activeFilter" @filter="onPoolFilter"
      :views="poolViews" :view="viewMode" @view="viewMode = $event as 'card' | 'list'"
      :sorts="POOL_SORTS" :sort="sortBy" @sort="sortBy = $event as PoolSortBy"
      :sort-dir="sortDir" :sort-dir-titles="['当前倒序，点击切换正序', '当前正序，点击切换倒序']" @sort-dir="toggleSortDir"
      :batch-labels="['批量', '退出批量']" :batch-on="batchMode" @batch="toggleBatch"
      :new-label="secondaryMode ? '' : '＋ 新建卡'" new-title="新建单张资源卡（采集走 Ctrl+Shift+J）" @create="openNew">
      <button v-if="!secondaryMode" class="pcp-btn" title="图片 / HTML / PDF，一文件一卡（本体存本地 IndexedDB）" @click="fileImport()"><Icon name="inbox" :size="13"/> 导入本地文件</button>
      <!-- ★W15-T3（用户拍板 2026-10-16）链接类型分组下拉：组序固定 本地文件 → URL → Obsidian → 无链接（垫底）；
           再点一次同一组 = 取消分组（回到平铺）。分组只在列表视图生效（网格不做分组，避免一屏信息过载）。 -->
      <div v-if="viewMode === 'list'" class="pcp-groupbar">
        <button class="pcp-btn" :class="{ on: !groupBy }" title="不分组，按排序档位平铺" @click="groupBy = ''">不分组</button>
        <button v-for="g in POOL_GROUPS" :key="g.id" class="pcp-btn" :class="{ on: groupBy === g.id }"
          :title="g.title" :disabled="!groupCounts[g.id]" @click="toggleGroup(g.id)">
          {{ g.label }} <span class="pcp-gcount">{{ groupCounts[g.id] }}</span>
        </button>
      </div>
      <template #count><span class="pcp-count"><b>{{ poolCards.length }}</b> / 全部 {{ poolTotal }} 张</span></template>
    </DeckControls>

    <!-- R3-Cc：批量栏收归 DeckBatchBar 一份实现（全选/反选/打标签三处同源，卡型动作走默认槽） -->
    <DeckBatchBar v-if="batchMode" :size="selSize" :total="poolCards.length" :all-selected="allSelected"
      unit="张" @select-all="selectAll" @invert="invertSel" @apply-tag="applyTagToSelected">
      <button class="pcp-btn sm danger" :disabled="!selSize" @click="deleteSelected"><Icon name="trash" :size="13"/> 删除（进回收站）</button>
    </DeckBatchBar>

    <!-- 新建单卡浮层：v-if 不开即零节点（全站浮层纪律） -->
    <div v-if="!secondaryMode && newOpen" class="pcp-mask" @click.self="newOpen = false">
      <div class="pcp-pop">
        <div class="pcp-pop-h">＋ 新建资源卡<span class="pcp-pop-x" @click="newOpen = false">×</span></div>
        <label>标题<input v-model="newDraft.title" placeholder="这张卡叫什么" @keydown.enter="createCard"></label>
        <label>链接<input v-model="newDraft.link" placeholder="https://…（可留空，之后在详情里补）"></label>
        <label>标签<input v-model="newDraft.tags" placeholder="逗号分隔，如 AI工具/知识库,写作"></label>
        <div class="pcp-pop-f">
          <span class="pcp-pop-hint">采集仍走 Ctrl+Shift+J（带网页上下文）；这里只补「我知道要什么」的卡</span>
          <button class="pcp-btn primary" @click="createCard">存入卡池</button>
        </div>
      </div>
    </div>

    <!-- G3（V3.8.27）：三种"空"收进同一个契约组件——区别只在 是什么/怎么开始/主行动，结构不再各写一套。
         class="pcp-empty" 保留：theme-audit.cjs 的场景探针按这个选择器取面板，不能丢。 -->
    <EmptyState v-if="!poolCards.length" class="pcp-empty" icon="folder"
      :size="(onlyUntagged || query || calledFilter !== 'all') ? 'inline' : 'section'"
      :title="onlyUntagged ? '池里每张卡都有标签了' : (query ? `没有匹配「${query}」的资源卡` : (calledFilter !== 'all' ? '这个调用状态没有资源卡' : '资源卡池还空着'))"
      :hint="onlyUntagged ? '切回「全部」即可看到池里的卡。' : (query ? '清空过滤词，或换个更短的关键词。' : (calledFilter !== 'all' ? '切换到「全部」即可看到池里的卡。' : '用 Ctrl+Shift+J 从任意网页采集第一张卡。'))"
      :action-label="(onlyUntagged || query || calledFilter !== 'all') ? '清空筛选' : ''" @action="clearPoolFilter" />

    <!-- R3-Ca 列表视图：一屏看更多 + 标签全展开（网格留作默认，两档共用同一份 poolCards 与分页） -->
    <div v-else-if="viewMode === 'list'" class="pcp-list">
      <!-- ★W15-T3：分组视图下每组带一个组头（组名 + 张数）；无链接组永远垫底 -->
      <template v-if="groupBy">
        <div v-for="sec in groupSections" :key="sec.id" class="pcp-group-sec">
          <div class="pcp-group-h">
            <span class="n">{{ (POOL_GROUPS.find(g => g.id === sec.id)?.label) || sec.id }}</span>
            <span class="c">{{ sec.cards.length }} 张</span>
          </div>
          <div v-for="r in sec.cards" :key="r.id" class="pcp-row" :class="{ flash: highlightId === r.id, picked: selected.has(r.id) }"
            :data-rid="r.id" :title="r.title + ' · 单击打开详情 · 双击打开链接 · 右键更多'"
            @click="openCard(r)" @dblclick="onCardDblClick(r)" @contextmenu="openCtx($event, r)">
            <span v-if="batchMode" class="pcp-check"><Icon v-if="selected.has(r.id)" name="check" :size="12"/></span>
            <span class="pcp-r-title"><NewBadge :at="r.createdAt" /><span v-if="r.pinned" class="pcp-pin" title="已置顶"><Icon name="pin" :size="13"/></span>{{ r.title }}
              <span v-if="isMirrored(r)" class="pcp-mirror-badge" title="这张卡已镜像到某个策展台"><Icon name="mirror" :size="13"/> 已镜像</span></span>
            <span class="pcp-r-tags">
              <span v-if="!(r.tags || []).length" class="pcp-tag-none" title="无标签——任何筛选都召回不到它">无标签</span>
              <span v-for="t in (r.tags || [])" :key="t" class="pcp-tag">{{ t }}</span>
            </span>
            <span class="pcp-r-marks">
              <span v-if="r.link" class="pcp-mark" title="已挂链接"><Icon name="link" :size="13"/></span>
              <span v-if="r.assets?.length" class="pcp-mark" title="有附件"><Icon name="paperclip" :size="13"/>{{ r.assets.length }}</span>
            </span>
            <span class="pcp-date">{{ new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
            <!-- ★W15-T2/T3：删除与镜像从 hover 才出改为**常驻行末**（原先藏在 hover 里，用户找不到"不进详情就能删"） -->
            <span class="pcp-r-acts">
              <span class="pcp-mirror-wrap">
                <button v-if="!batchMode" class="pcp-act" :class="{ on: mirrorOpenFor === r.id }"
                  :title="isMirrored(r) ? '这张卡已镜像过（点可再镜像到其他台）' : '镜像到策展台（引用投射，源卡仍在池里）'"
                  @click.stop="openMirror(r)"><Icon name="mirror" :size="13"/></button>
                <span v-if="mirrorOpenFor === r.id && mirrorBoards.length" class="pcp-mirror-pop" @click.stop>
                  <select v-model="mirrorWsId" class="pcp-mirror-sel">
                    <option v-for="w in mirrorBoards" :key="w.id" :value="w.id">{{ w.name }}</option>
                  </select>
                  <button class="pcp-act primary" title="确认镜像到所选策展台" @click.stop="doMirror(r)"><Icon name="check" :size="13"/> 镜像</button>
                </span>
              </span>
              <button v-if="!batchMode" class="pcp-del" title="删除（进回收站，可撤销）" @click.stop="removeCard(r)"><Icon name="trash" :size="13"/></button>
            </span>
          </div>
        </div>
      </template>
      <template v-else>
      <div v-for="r in rendered" :key="r.id" class="pcp-row" :class="{ flash: highlightId === r.id, picked: selected.has(r.id) }" :data-rid="r.id"
        :title="batchMode ? '点击选中 / 取消' : r.title + ' · 单击打开详情 · 双击打开链接 · 右键更多'" @click="openCard(r)" @dblclick="onCardDblClick(r)" @contextmenu="openCtx($event, r)">
        <span v-if="batchMode" class="pcp-check"><Icon v-if="selected.has(r.id)" name="check" :size="12"/></span>
        <span class="pcp-r-title"><NewBadge :at="r.createdAt" /><span v-if="r.pinned" class="pcp-pin" title="已置顶"><Icon name="pin" :size="13"/></span>{{ r.title }}
          <span v-if="isMirrored(r)" class="pcp-mirror-badge" title="这张卡已镜像到某个策展台"><Icon name="mirror" :size="13"/> 已镜像</span></span>
        <span class="pcp-r-tags">
          <span v-if="!(r.tags || []).length" class="pcp-tag-none" title="无标签——任何筛选都召回不到它">无标签</span>
          <span v-for="t in (r.tags || [])" :key="t" class="pcp-tag">{{ t }}</span>
        </span>
        <span class="pcp-r-marks">
          <span v-if="r.link" class="pcp-mark" title="已挂链接"><Icon name="link" :size="13"/></span>
          <span v-if="r.assets?.length" class="pcp-mark" title="有附件"><Icon name="paperclip" :size="13"/>{{ r.assets.length }}</span>
        </span>
        <span class="pcp-date">{{ new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
        <!-- ★W15-T2/T3：删除与镜像常驻行末（原先 hover 才出 = 事实上找不到） -->
        <span class="pcp-r-acts">
          <span class="pcp-mirror-wrap">
            <button v-if="!batchMode" class="pcp-act" :class="{ on: mirrorOpenFor === r.id }"
              :title="isMirrored(r) ? '这张卡已镜像过（点可再镜像到其他台）' : '镜像到策展台（引用投射，源卡仍在池里）'"
              @click.stop="openMirror(r)"><Icon name="mirror" :size="13"/></button>
            <span v-if="mirrorOpenFor === r.id && mirrorBoards.length" class="pcp-mirror-pop" @click.stop>
              <select v-model="mirrorWsId" class="pcp-mirror-sel">
                <option v-for="w in mirrorBoards" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
              <button class="pcp-act primary" title="确认镜像到所选策展台" @click.stop="doMirror(r)"><Icon name="check" :size="13"/> 镜像</button>
            </span>
          </span>
          <button v-if="!batchMode" class="pcp-del" title="删除（进回收站，可撤销）" @click.stop="removeCard(r)"><Icon name="trash" :size="13"/></button>
        </span>
      </div>
      </template>
    </div>

    <div v-else class="pcp-grid">
      <div v-for="r in rendered" :key="r.id" class="pcp-card" :class="{ flash: highlightId === r.id, picked: selected.has(r.id) }" :data-rid="r.id"
        :title="batchMode ? '点击选中 / 取消' : r.title + ' · 单击打开详情 · 双击打开链接 · 右键更多'" @click="openCard(r)" @dblclick="onCardDblClick(r)" @contextmenu="openCtx($event, r)">
        <div class="pcp-top">
          <div class="pcp-title">
            <NewBadge :at="r.createdAt" />
            <span v-if="r.pinned" class="pcp-pin" title="已置顶"><Icon name="pin" :size="13"/></span>{{ r.title }}
          </div>
          <span v-if="batchMode" class="pcp-check"><Icon v-if="selected.has(r.id)" name="check" :size="12"/></span>
          <button v-else class="pcp-del" title="删除（进回收站，可撤销）" @click.stop="removeCard(r)"><Icon name="trash" :size="13"/></button>
        </div>
        <div class="pcp-foot">
          <span v-if="r.link" class="pcp-mark" title="已挂链接"><Icon name="link" :size="13"/></span>
          <span v-if="r.assets?.length" class="pcp-mark" title="有附件"><Icon name="paperclip" :size="13"/></span>
          <span v-for="t in (r.tags || []).slice(0, 3)" :key="t" class="pcp-tag">{{ t }}</span>
          <span class="pcp-date">{{ new Date(r.updatedAt || r.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
        </div>
      </div>
    </div>

    <ContextMenu :state="ctx" :items="ctxItems" @close="ctx.open = false" />

    <div v-if="hasMore" :ref="setSentinel" class="render-more" @click="renderMore">
      ↓ 已显示 {{ rendered.length }} / {{ poolCards.length }} 张 —— 点此加载更多
    </div>
    <input ref="fileImportInput" type="file" multiple accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.avif,.ico,.html,.htm,.pdf,application/pdf,text/html" class="pci-file" @change="handleFileImport">
  </div>
</template>

<style scoped>
/* B1-c：文件选择器只作触发器，不占版面（原内联 display:none） */
.pci-file { display: none; }
/* R2-③：池卡网格——与 DeckTabs 卡片语言同款（surface + hairline + hover 抬升） */
.pcp { min-height: 120px; }
.pcp-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: var(--radius-sm); padding: 5px 11px; font-size: var(--fs-sub); font-weight: 600; cursor: pointer; font-family: inherit; transition: all var(--dur); }
.pcp-btn:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text); }
.pcp-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.pcp-btn.primary { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.pcp-btn.on { border-color: var(--text); background: var(--text); color: var(--bg); }
.pcp-btn.sm { padding: 4px 9px; font-size: var(--fs-caption); }
.pcp-btn.danger { border-color: var(--danger-border); color: var(--danger); }
.pcp-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, .45); display: flex; align-items: center; justify-content: center; z-index: 60; }
.pcp-pop { width: min(420px, 92vw); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px 18px; box-shadow: var(--shadow-lg); }
.pcp-pop-h { font-size: var(--fs-body); font-weight: 700; color: var(--text); margin-bottom: 12px; display: flex; align-items: center; }
.pcp-pop-x { margin-left: auto; cursor: pointer; color: var(--text-3); font-size: var(--fs-body); padding: 0 6px; }
.pcp-pop label { display: block; font-size: var(--fs-caption); color: var(--text-3); margin-bottom: 10px; }
.pcp-pop input { display: block; width: 100%; margin-top: 4px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: var(--radius-sm); padding: 6px 9px; font-size: var(--fs-sub); font-family: inherit; outline: none; }
.pcp-pop input:focus { border-color: var(--accent); }
.pcp-pop-f { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.pcp-pop-hint { font-size: var(--fs-caption); color: var(--text-4); flex: 1; }
/* G3（V3.8.27）：原 .pcp-empty 的 padding/字号已由 EmptyState 三档尺寸接管；class 仅留作外部门禁选择器 */
.pcp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.pcp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; min-height: 94px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; cursor: pointer; transition: all var(--dur) ease; }
.pcp-card:hover { border-color: var(--border-strong); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.pcp-card.picked { border-color: var(--accent); background: var(--accent-light); }
/* R2-④：定位高亮——与 workspace.css 的 .res-card.flash 同一视觉语言（该表在调度台不加载，故本地定义） */
.pcp-card.flash, .pcp-row.flash { animation: pcp-flash 2s ease-out; }
@keyframes pcp-flash {
  0% { box-shadow: 0 0 0 3px var(--accent), 0 4px 20px color-mix(in srgb, var(--accent) 35%, transparent); background: var(--accent-light); }
  60% { box-shadow: 0 0 0 3px var(--accent); background: var(--accent-light); }
  100% { box-shadow: none; }
}
.pcp-top { display: flex; align-items: flex-start; gap: 6px; }
.pcp-title { flex: 1; min-width: 0; font-size: var(--fs-body); font-weight: 600; line-height: 1.4; color: var(--text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.pcp-pin { flex-shrink: 0; font-size: var(--fs-tiny); }
.pcp-check { flex-shrink: 0; width: 18px; height: 18px; border: 1px solid var(--border-strong); border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-caption); color: var(--accent); }
.pcp-del { border: none; background: transparent; color: var(--text-3); cursor: pointer; font-size: var(--fs-caption); border-radius: 5px; padding: 2px 5px; flex-shrink: 0; transition: color var(--dur-fast), background var(--dur-fast); font-family: inherit; }
.pcp-card:hover .pcp-del { opacity: 1; }
.pcp-del:hover { color: var(--danger); background: var(--danger-bg-soft); }
/* ★W15-T2/T3（用户拍板 2026-10-16）：行末动作区**常驻**（原先 opacity:0 只在 hover 出现，
   等于"不进详情就能删"这件事事实上没有出口）——低对比度常驻、hover 转 danger。 */
.pcp-r-acts { display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; }
.pcp-act {
  border: none; background: transparent; color: var(--text-3); cursor: pointer;
  font-size: var(--fs-caption); border-radius: 5px; padding: 2px 6px; font-family: inherit;
  transition: color var(--dur-fast), background var(--dur-fast);
}
.pcp-act:hover { color: var(--accent-ink); background: var(--accent-light); }
.pcp-act.on { color: var(--accent-ink); background: var(--accent-light); }
.pcp-act.primary { color: var(--accent); font-weight: 700; }
.pcp-mirror-wrap { position: relative; display: inline-flex; }
.pcp-mirror-pop {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 30;
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 6px;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg); white-space: nowrap;
}
.pcp-mirror-sel {
  font-family: inherit; font-size: var(--fs-caption); color: var(--text);
  background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs);
  padding: 3px 6px; max-width: 180px;
}
.pcp-mirror-badge { font-size: var(--fs-micro); color: var(--accent-ink); background: var(--accent-light); border-radius: 99px; padding: 1px 6px; margin-left: 6px; }
/* ★W15-T3 分组下拉 + 组头 */
.pcp-groupbar { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.pcp-gcount { color: var(--text-4); font-variant-numeric: tabular-nums; margin-left: 2px; }
.pcp-group-sec { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.pcp-group-h {
  display: flex; align-items: baseline; gap: 8px; padding: 4px 10px 2px;
  font-size: var(--fs-caption); font-weight: 700; color: var(--text-2);
}
.pcp-group-h .c { font-weight: 400; color: var(--text-4); font-variant-numeric: tabular-nums; }
.pcp-foot { display: flex; align-items: center; gap: 5px; font-size: var(--fs-tiny); color: var(--text-3); flex-wrap: wrap; }
.pcp-mark { flex-shrink: 0; }
.pcp-tag { padding: 0 6px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
.pcp-date { margin-left: auto; font-variant-numeric: tabular-nums; flex-shrink: 0; }
/* R3-Ca：视图切换段控件 + 列表视图（行高固定、标签全展开；★W15-T2 行末动作常驻——与网格同一套令牌） */
.pcp-list { display: flex; flex-direction: column; gap: 4px; }
.pcp-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color var(--dur) ease, background var(--dur) ease; }
.pcp-row:hover { border-color: var(--border-strong); }
.pcp-row.picked { border-color: var(--accent); background: var(--accent-light); }
.pcp-r-title { flex: 0 1 auto; min-width: 120px; font-size: var(--fs-sub); font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcp-r-tags { flex: 1 1 auto; min-width: 0; display: inline-flex; gap: 4px; overflow: hidden; }
.pcp-r-marks { flex-shrink: 0; display: inline-flex; gap: 4px; font-size: var(--fs-tiny); color: var(--text-3); }
.pcp-tag-none { padding: 0 6px; border-radius: 99px; background: var(--tag-warn-bg); color: var(--tag-warn-text); white-space: nowrap; font-size: var(--fs-tiny); }
.render-more { margin-top: 12px; padding: 9px; text-align: center; font-size: var(--fs-sub); color: var(--text-3); border: 1px dashed var(--border); border-radius: var(--radius-sm); cursor: pointer; }
.render-more:hover { color: var(--accent); border-color: var(--accent); }
</style>
