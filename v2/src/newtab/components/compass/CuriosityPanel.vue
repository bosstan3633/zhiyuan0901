<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCuriosity, type CuriStatus } from '../../stores/curiosity'
// R129-B12：台名剥图标走全站唯一口径（此处原为 /[^s]+s/ 漏写转义，图标一直在下拉里重复显示）
// R4-Ep：可选台列表与「id→展示名」都走 wsName.ts 单源，不再从这里自己 filter 原始 workspaces 数组
import { selectableWsOptions, wsNameById } from '@/shared/utils/wsName'
import { CURATION_WS_ID } from '@/shared/models'
// R129-B5：链接协议白名单与打开通道全站唯一实现
import { toOpenableRawLink, openExternalLink } from '@/shared/utils/link'
import { useAppStore } from '../../stores/app'
import type { CuriosityCard, AssetMeta, FieldDef } from '@/shared/models'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import Drawer from '@/shared/components/Drawer.vue'
// R113-N2：LifecyclePanel / useLifecycle 移除——生命周期入口收敛到 设置→总览
import { showToast } from '@/shared/components/toast'
import TagPicker from '@/shared/components/TagPicker.vue'
import AssetManager from '@/shared/components/AssetManager.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import MaturityBadge from '@/shared/components/MaturityBadge.vue'
import { curioMaturity } from '@/shared/utils/maturity'
import type { ResourceCard } from '@/shared/models'
import { emitOpenDrawer } from '@/shared/utils/bus'
// R117（04-61 C3）：当日新增角标（自然日口径）——卡片 / 列表 / 看板三视图同一枚
import NewBadge from '@/shared/components/NewBadge.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import { useBatchSelect, addTagToCards } from '../../composables/useBatchSelect'
import DeckBatchBar from './DeckBatchBar.vue'
import DeckControls from './DeckControls.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useCardCols } from '@/shared/utils/cardCols'
import { useTaHeight } from '@/shared/utils/taHeight'
import { onOpenDrawer } from '@/shared/utils/bus'
import { recordCardOpen } from '@/shared/storage/stats'
import {
  addCurioSupportLink,
  removeCurioSupportLink,
} from '@/shared/utils/supportLinks'
import AiEntryButton from '@/shared/components/AiEntryButton.vue'
import ArmDeleteButton from '@/shared/components/ArmDeleteButton.vue'
import {
  archivedHintCount as archivedHintCountOf,
  curioExtValue,
  filterCuriosities,
  flattenProjectOptions,
  groupCuriosities,
  isCurioFieldVisible,
  kanbanColumnsOf,
  shortDate,
  shortSource,
  statusCountsOf,
  supportCandidatesOf,
  supportRowsOf,
  visibleCurioExtFields,
} from './curiosityPanelCore'
// R181 结构优化：转化弹窗 + 资源支撑闭环外提
import { useCurioConvert, useCurioSupport } from './curiosityPanelBridges'

const { curiosities, STATUS_MAP, update, setStatus, remove, convertToTask, convertToResource } = useCuriosity()
const store = useAppStore()
const d = computed(() => store.data!)
const route = useRoute()
const router = useRouter()

const props = withDefaults(defineProps<{
  /** 独立二级页：隐藏新建入口（本面板本来无新建），空态主行动改为清空筛选。 */
  secondaryMode?: boolean
}>(), { secondaryMode: false })

const searchQuery = ref('')

// 高亮定位（B4：搜索好奇卡结果跳转；R51：声明顺序修复——viewMode/statusFilter 须先于 immediate watcher）
const highlightId = ref<string | null>(null)
const viewMode = ref<'card' | 'list' | 'kanban'>(
  store.ui?.curioViewMode || (props.secondaryMode ? 'list' : 'card')
)
function setViewMode(next: 'card' | 'list' | 'kanban'): void {
  viewMode.value = next
  if (store.ui) store.ui.curioViewMode = next
  saveUIPrefs({ curioViewMode: next })
}
// R72：卡片视图横向列数（4/5/6/7，记忆 UIPrefs.cardCols.curio；网格模板由 --grid-cols 驱动）
const curioCols = useCardCols('curio', store.ui)
/** R3-Cc2：控制行值域配置（视图三档 + 状态胶囊带计数由 statusCounts 现算） */
const CURIO_VIEWS = [{ id: 'card', label: '▦ 卡片', title: '卡片视图' }, { id: 'list', label: '列表', title: '列表视图' }, { id: 'kanban', label: '▥ 看板', title: '看板视图' }]
const curioFilters = computed(() => [
  { id: 'all', label: '全部', count: statusCounts.value.all || 0 },
  ...Object.entries(STATUS_MAP).map(([key, v]) => ({ id: key, label: `${v.icon} ${v.label}`, count: statusCounts.value[key] || 0 }))
])
const statusFilter = ref<CuriStatus | 'all'>('all')
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string') return
  // R117（04-61 B）：按 `?hk=` 认领——调度台首页同页还有任务卡消费者（认领 'task'），
  // 不认领时直接让路；只有真正滚到目标才清 query，避免把另一个消费者要用的 hl 清掉。
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk && hk !== 'curio') return
  highlightId.value = hl
  statusFilter.value = 'all'
  setTimeout(() => {
    const el = document.querySelector(`[data-czid="${hl}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => { highlightId.value = null }, 2000)
      router.replace({ path: route.path })
    } else if (hk === 'curio') {
      router.replace({ path: route.path })
    }
  }, 350)
}, { immediate: true })

// 第卅六轮 REQ-039：搜索浮层单击 → 好奇心卡高亮
onMounted(() => {
  const off = onOpenDrawer((p) => {
    if (p.kind === 'curio') {
      highlightId.value = p.id
      setTimeout(() => document.querySelector(`[data-czid="${p.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      setTimeout(() => { highlightId.value = (highlightId.value === p.id ? null : highlightId.value) }, 2000)
    }
  })
  onUnmounted(() => { off() })
})

// 第卅二轮 REQ-007：好奇心时间排序方向（默认倒序=新捕获在前）+ 偏好本地记忆（UIPrefs.sortPrefs.curio）
const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.curio?.dir === 'asc') ? 'asc' : 'desc')
watch(sortDir, () => {
  const sp = { ...(store.ui?.sortPrefs || {}), curio: { by: 'createdAt', dir: sortDir.value } }
  if (store.ui) store.ui.sortPrefs = sp
  saveUIPrefs({ sortPrefs: sp })
})
function toggleSortDir() { sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc' }

/** 置顶优先分组：markRank 分区（置顶 > 星标 > 普通）不变；
 *  第卅五轮 REQ-035：组内 sortOrder 优先、未拖拽的卡（无 sortOrder）回退捕获时间方向排序
 *  —— 拖拽写入的自定义顺序不再被时间排序覆盖 */
const filtered = computed(() => {
  return filterCuriosities(curiosities.value, statusFilter.value, searchQuery.value, sortDir.value)
})
/** R110-LC（T3）：当前筛选口径下的归档卡数——底部降级提示（≥1 才显示） */
const archivedHintCount = computed(() => archivedHintCountOf(curiosities.value, statusFilter.value))

// R113-N2：生命周期入口收敛到 设置→总览（原 R110-LC 面板接线移除）
const pinnedCount = computed(() => filtered.value.filter(c => c.pinned).length)

/* ★W17-C05（2026-10-20 用户拍板）：两段文字标签升级为可折叠组头——
 * 组 = 已置顶 / 全部好奇心（数据源仍是 pinnedCount 分区），折叠状态只存在组件内、不持久化。 */
const curioGroups = computed(() => {
  return groupCuriosities(filtered.value)
})
const collapsedGroups = ref<Set<string>>(new Set())
const allGroupsCollapsed = computed(() => curioGroups.value.length > 0 && curioGroups.value.every(g => collapsedGroups.value.has(g.id)))
/** 全局开关文案：任一组展开时给「全部折叠」，全收起时给「全部展开」 */
const allGroupsLabel = computed(() => allGroupsCollapsed.value ? '▾ 全部展开' : '▸ 全部折叠')
function isGroupCollapsed(id: string): boolean { return collapsedGroups.value.has(id) }
function toggleGroupCollapsed(id: string): void {
  const next = new Set(collapsedGroups.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedGroups.value = next
}
function toggleAllGroups(): void {
  collapsedGroups.value = allGroupsCollapsed.value ? new Set() : new Set(curioGroups.value.map(g => g.id))
}

const statusCounts = computed(() => {
  return statusCountsOf(curiosities.value)
})
/**
 * R167：「已转化」计数——转化即出路的卡当场软删离场，池里（含四个状态 chip）再也数不到它，
 * 探索有没有产出必须换个地方记账。口径：**转任务与归档资源都算一条**；
 * 回收站里点"恢复"= 撤销这次转化（戳记同时清除，本计数随之回落）。
 */
const convertedCount = computed(() => (d.value.curiosities || []).filter(c => c.convertedAt).length)

function clearCurioFilter(): void {
  statusFilter.value = 'all'
  searchQuery.value = ''
}

const kanbanCols = computed(() => {
  return kanbanColumnsOf(curiosities.value, STATUS_MAP)
})

const detailId = ref<string | null>(null)
// R48 详情重设计：状态下拉 chip（头部一枚，替代四个大按钮）
const curioStatusMenuOpen = ref(false)
/** 第卅三轮 REQ-024：详情文本框高度（默认 180px，拖拽记忆） */
const { taH: detailH, startTaResize: startDetailResize } = useTaHeight('curio-detail', store.ui)
const detailItem = computed(() => curiosities.value.find(c => c.id === detailId.value) || null)
// R181 结构优化：转化弹窗 + 资源支撑闭环外提（历史字符串锚点随聚合表回读宿主）
const {
  convertOpen, convertTarget, convertItem, convertWsId, convertCatId, convertProjId, convertMetId,
  convWorkspaces, convCategories, convProjects, convMetrics,
  openConvert, onConvertProjChange, confirmConvert,
} = useCurioConvert({ store, convertToResource, convertToTask, clearDetail: () => { detailId.value = null } })
const {
  curioSupportDraft, curioSupportRows, curioSupportCands,
  addCurioSupport, removeCurioSupport, openCurioSupportResource,
} = useCurioSupport({ store, d, detailItem })
const editDraft = ref('')
function openDetail(id: string) {
  detailId.value = id
  const c = curiosities.value.find(x => x.id === id)
  if (c) {
    editDraft.value = c.question
    // R47-B4：调起详情 = 一次「调用」，计入热度
    recordCardOpen(d.value, c)
    store.persistHot()
  }
}
defineExpose({ openDetail })
function saveDetail() {
  if (detailId.value && editDraft.value.trim()) {
    update(detailId.value, { question: editDraft.value.trim() })
    showToast('已更新')
    detailId.value = null // 第卅三轮 REQ-015：保存后关闭抽屉
  }
}
/** REQ-048：好奇心附件变更即时持久化 */
function onCurioAssetsChange(v: AssetMeta[]) {
  if (detailId.value) update(detailId.value, { assets: v })
}
/** 第卌二轮 REQ-061：好奇卡 HTML 上传联动——标题（question）取文件名（仅空标题/旧文件名时覆盖，q-2 拍板）；第卌四轮 T-08 泛化支持 PDF */
function onCurioHtmlAdded(meta: AssetMeta, replacedOld: AssetMeta | null) {
  if (!detailItem.value) return
  const stem = (meta.name || '').replace(/\.(html?|pdf)$/i, '')
  const oldStems = [replacedOld, ...(detailItem.value.assets || []).filter(a => a.kind === meta.kind && a.id !== meta.id)]
    .filter((a): a is AssetMeta => !!a)
    .map(a => (a.name || '').replace(/\.(html?|pdf)$/i, ''))
  const cur = (detailItem.value.question || '').trim()
  if (!cur || oldStems.includes(cur)) {
    if (stem) update(detailItem.value.id, { question: stem })
  } else {
    showToast(`已替换原 ${meta.kind === 'pdf' ? 'PDF' : 'HTML'}；标题保留手打内容，可自行编辑`)
  }
}

// ---- 置顶 ----
// B5：右键菜单 + B6 拖拽插入线
const ctx = ref({ open: false, x: 0, y: 0 })
const ctxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
const ctxTarget = ref<CuriosityCard | null>(null)
function openCurioCtx(e: MouseEvent, c: CuriosityCard) {
  ctxTarget.value = c
  ctxItems.value = [
    { label: '打开详情', icon: 'arrowright', cb: () => openDetail(c.id) },
    { label: c.pinned ? '取消置顶' : '置顶', icon: 'pin', cb: () => togglePin(c.id) },
    { label: c.starred ? '取消星标' : '星标', icon: 'star', cb: () => toggleStar(c.id) },
    { label: '转为任务', icon: 'check', cb: () => openConvert(c, 'task') },
    { label: '删除', icon: 'trash', danger: true, cb: () => deleteCard(c) }
  ]
  ctx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 220) }
}
const dropMark = ref('')
// 第廿八轮：轴向参数化——卡片网格 X 轴判定，列表/看板（纵向堆叠）Y 轴判定
function markDrop(e: DragEvent, key: string, axis: 'x' | 'y') {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const after = axis === 'x'
    ? (e.clientX - rect.left) / rect.width > 0.5
    : (e.clientY - rect.top) / rect.height > 0.5
  dropMark.value = key + (after ? '-b' : '-t')
}
function clearDropMark() { dropMark.value = '' }

function togglePin(id: string) {
  const c = curiosities.value.find(x => x.id === id)
  if (!c) return
  const next = !c.pinned
  update(id, { pinned: next })
  showToast(next ? '已置顶，将在专区顶部展示' : '已取消置顶')
}
/** 第卅三轮 REQ-020：好奇心星标切换（独立于置顶，可叠加） */
function toggleStar(id: string) {
  const c = curiosities.value.find(x => x.id === id)
  if (!c) return
  const next = !c.starred
  update(id, { starred: next, updatedAt: Date.now() })
  showToast(next ? '已星标，搜索时优先展示' : '已取消星标')
}

// ---- O7：单击详情 / 双击打开来源链接（与资源卡一致） ----
let clickTimer: ReturnType<typeof setTimeout> | null = null
function onCardClick(id: string) {
  if (batchMode.value) { toggleSelect(id); return }
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return }
  clickTimer = setTimeout(() => { clickTimer = null; openDetail(id) }, 260)
}
function openSourceUrl(url: string) {
  // R129-B5：协议过滤与打开通道统一走 shared/utils/link（原此处自写一份白名单）
  const t = toOpenableRawLink(url)
  if (t) openExternalLink(t)
}

function onCardDblClick(c: CuriosityCard) {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  // 第十三轮：链接字段统一口径（sourceUrl 即好奇心的链接，支持 URL / 本地路径 / obsidian://）
  const url = toOpenableRawLink(c.sourceUrl)
  if (url) openExternalLink(url)
  else {
    openDetail(c.id)
    showToast('该好奇心还没有链接，可在详情中添加')
  }
}

// ---- O6：卡片删除（删除入口在卡片上，不在详情页） ----
async function deleteCard(c: CuriosityCard) {
  remove(c.id)
  if (detailId.value === c.id) detailId.value = null
  // B2：撤销
  showToast(`已移入回收站「${c.question.slice(0, 20)}」`, { label: '撤销', cb: () => {
    const cur = d.value.curiosities.find(x => x.id === c.id)
    if (cur) { cur.deletedAt = undefined; store.persist() }
  } })
}

// ---- O5：拖拽（卡片排序 + 看板跨状态列改状态） ----
let dragCzId: string | null = null
function onCzDragStart(e: DragEvent, id: string) {
  dragCzId = id
  ;(e.currentTarget as HTMLElement).classList.add('dragging')
  e.dataTransfer!.effectAllowed = 'move'
}
function onCzDragEnd(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('dragging')
  dragCzId = null
}
function onCzDrop(e: DragEvent, targetId: string, status?: CuriStatus) {
  e.preventDefault(); e.stopPropagation()
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  const after = dropMark.value.endsWith('-b')
  clearDropMark()
  if (!dragCzId || dragCzId === targetId) return
  const list = d.value.curiosities
  const movedId = dragCzId
  const fi = list.findIndex(x => x.id === movedId)
  if (fi < 0) { dragCzId = null; return }
  // 第廿八轮：看板跨状态列落卡 = 状态随列（列空白区落点仍走 onCzKanbanDrop）
  if (status) {
    const c = list[fi]
    if (c.status !== status) {
      setStatus(movedId, status)
      showToast(`已移至「${STATUS_MAP[status].label}」`)
    }
  }
  const [moved] = list.splice(fi, 1)
  const ti = list.findIndex(x => x.id === targetId)
  if (ti < 0) { list.splice(fi, 0, moved); dragCzId = null; return }
  list.splice(after ? ti + 1 : ti, 0, moved)
  // 第卅五轮 REQ-035：卡片/列表排序拖拽（无 status）→ 按当前物理顺序全量重写 sortOrder 固化，
  // 渲染层组内 sortOrder 优先消费；看板跨列（有 status）只改状态不重写（避免打乱各列排序）
  if (!status) {
    list.forEach((c, i) => { c.sortOrder = i })
  }
  store.persist()
  dragCzId = null
  showToast('已调整排序')
}
function onCzKanbanDrop(e: DragEvent, status: CuriStatus) {
  e.preventDefault()
  if (!dragCzId) return
  const c = curiosities.value.find(x => x.id === dragCzId)
  if (c && c.status !== status) {
    setStatus(dragCzId, status)
    showToast(`已移至「${STATUS_MAP[status].label}」`)
  }
  dragCzId = null
}

// ---- 转化（选策展台/分类 或 项目/指标）---- 已外提见 curiosityPanelBridges.ts useCurioConvert

/* ===== R144 · G2：转化研判（批量=当前筛选口径下的待探索池；R151 起同一通道支持单卡入口） ===== */
const AiDrawer = defineAsyncComponent(() => import('../AiSuggestionDrawer.vue'))
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
// R165-A（方案 A 标准）：单卡研判入口从页脚升头部标题行右侧；busy 防重复起任务，三态凭 aiTouchedAt（batchG 采纳时落戳）
const aiBusy = ref(false)
async function aiTriage(one?: CuriosityCard) {
  const d = store.data
  if (!d || aiBusy.value) return
  const pool = one ? [one] : filtered.value.filter(c => c.status === 'todo' || c.status === 'doing')
  if (!one && pool.length < 3) { showToast('待探索池少于 3 条——先多攒几条好奇心再研判'); return }
  if (one && one.status !== 'todo' && one.status !== 'doing') { showToast('这条已是「已转任务」或「已搁置」——先改回待探索再研判'); return }
  aiBusy.value = true
  try {
    const [{ loadAiConfig, aiReady, aiConfig }, { buildCurioTriageJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/batchG')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    aiJob.value = buildCurioTriageJob({
      d, depth: aiConfig.value.depth, persist: () => store.persist(), pool, single: !!one,
      onConvert: (c, title) => {
        if (c.deletedAt) return false
        const t = convertToTask(c)
        t.title = title.slice(0, 40)
        t.description = ((t.description ? t.description + '\n\n' : '') + '源自好奇研判：' + c.question.slice(0, 80))
        return true
      },
    })
  } finally { aiBusy.value = false }
}
/** R165-A：来源链接动作贴对象 */
function copySourceUrl(c: CuriosityCard) {
  if (!c.sourceUrl) { showToast('来源为空'); return }
  navigator.clipboard?.writeText(c.sourceUrl).then(() => showToast('来源已复制')).catch(() => {})
}

const batchMode = ref(false)
/* R3-Cb：批量选择收归 useBatchSelect——改前面板**没有全选**，且退出批量态不清空 selected，
   下一轮进来上一轮的勾选还在（两次之间可见集合可能已变），而批量动作里就有删除。 */
const { selected, allSelected: allCurioSelected, toggle: toggleSelect, selectAll, invert: invertSelect, clear: clearSelection, setMode: setBatchMode } =
  useBatchSelect(() => filtered.value.map(c => c.id))
function batchAddTag(t: string) {
  const n = addTagToCards(d.value.curiosities, selected.value, t)
  store.persist()
  showToast(`已给 ${n} 张卡加标签「${t}」（只加不减，去标签到卡详情里改）`)
}
function batchDelete() {
  selected.value.forEach(id => remove(id))
  selected.value.clear()
  batchMode.value = false
  showToast('已批量删除所选——已移入回收站，可恢复')
}
function batchSetStatus(status: CuriStatus) {
  selected.value.forEach(id => setStatus(id, status))
  selected.value.clear()
  batchMode.value = false
  showToast('已批量更新状态')
}

function fmtDate(ts?: number) {
  return shortDate(ts)
}

// 第卌轮 REQ-051：好奇心卡正面补充字段流（按 fieldConfig.curiosity 显隐/排序）
// R117（04-61 D）：只有 question/status/createdAt 三个骨架 key 不进扩展行——**其余全部参与**，
// 且状态胶囊 / 创建时间 / 来源链接也改为受字段设置控制（此前硬编码渲染 + sourceUrl 从不渲染，
// 用户报「设置无效」）。字段设计一处开关即控卡片正面。
/** 该字段是否可见（骨架字段的显隐判定） */
function cShow(key: string): boolean { return isCurioFieldVisible(d.value.fieldConfig, key) }
const curioExtFields = computed(() =>
  visibleCurioExtFields(d.value.fieldConfig)
)
function curioExtVal(c: CuriosityCard, f: FieldDef): string {
  return curioExtValue(c, f)
}
/** R117（04-61 D）：来源链接短显示（域名 + 路径，超长截断） */
function srcShort(url: string): string {
  return shortSource(url)
}
</script>

<template>
  <ModuleCard icon-name="bulb" title="好奇心卡" en="CURIOSITY">

    <div class="cz-body">
      <!-- R3-Cc2：控制行收归 DeckControls（好奇的值域=状态胶囊带计数 + 三视图；批量管理从标题行进来） -->
      <DeckControls panel="curio" search search-ph="搜索好奇心..." :query="searchQuery" @search="searchQuery = $event"
        :filters="curioFilters" :filter="statusFilter" @filter="statusFilter = $event as CuriStatus | 'all'"
        :views="CURIO_VIEWS" :view="viewMode" @view="setViewMode($event as 'card' | 'list' | 'kanban')"
        :sort-dir="sortDir" :sort-dir-titles="['捕获时间倒序（新→旧），点击切换正序', '捕获时间正序（旧→新），点击切换倒序']" @sort-dir="toggleSortDir"
        :batch-on="batchMode" @batch="batchMode = setBatchMode(!batchMode)">
        <ColsPicker v-if="viewMode === 'card'" v-model="curioCols" label="列数" />
        <!-- R167：转化即出路的账——离场的卡只能在这里被看见 -->
        <span class="cz-converted" :title="convertedCount ? `已转出 ${convertedCount} 条（转任务 / 归档资源都算）· 在回收站点「恢复」即撤销这次转化` : '还没有好奇心被转出'">› 已转化 <b>{{ convertedCount }}</b></span>
        <button class="cz-batch-btn ai" title="AI 逐条研判待探索池：哪些值得转成任务、哪些继续养着、哪些可以放下（勾选采纳才写库）" @click="aiTriage()"><AiEntryButton variant="inline" label="转化研判" /></button>
      </DeckControls>

      <Transition name="expand">
        <DeckBatchBar v-if="batchMode" :size="selected.size" :total="filtered.length" :all-selected="allCurioSelected"
          @select-all="selectAll" @invert="invertSelect" @apply-tag="batchAddTag">
          <button class="mini-btn" :disabled="!selected.size" @click="batchSetStatus('doing')">标记探索中</button>
          <button class="mini-btn" :disabled="!selected.size" @click="batchSetStatus('done')">标记已求证</button>
          <button class="mini-btn" :disabled="!selected.size" @click="batchSetStatus('shelf')">标记已搁置</button>
          <button class="mini-btn danger" :disabled="!selected.size" @click="batchDelete">删除</button>
        </DeckBatchBar>
      </Transition>

      <!-- R110-LC（T3）：归档卡已从默认视图隐藏——降级提示（R113-N2 起点击跳 设置→总览·资源生命周期） -->
      <div v-if="archivedHintCount" class="cz-archived-hint" v-pressable @click="router.push('/profile#lifecycle')">
        <Icon name="package" :size="13"/> 另有 {{ archivedHintCount }} 张已归档好奇卡未显示（点此在 设置 › 总览 · 资源生命周期 中查看 / 恢复）
      </div>

      <!-- 零结果空态独立于视图链，避免打断 v-if / v-else-if 导致卡片与看板同时渲染。 -->
      <EmptyState v-if="!filtered.length" class="cz-empty" size="section" icon="bulb"
        :title="searchQuery.trim() ? '没有匹配的好奇心' : '还没有好奇心'"
        :hint="secondaryMode ? '当前搜索或状态筛选没有结果。清空筛选后可继续浏览全部好奇心。' : '按 Ctrl+Shift+I 一键采集；选中网页文本再采集，会自动带上原文。'"
        :action-label="secondaryMode ? '清空筛选' : ''" @action="clearCurioFilter" />

      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card'" class="cz-groups">
        <section v-for="g in curioGroups" :key="g.id" class="cz-group">
          <div class="cz-group-head">
            <button class="cz-group-label cz-group-toggle" :aria-expanded="!isGroupCollapsed(g.id)"
              :title="isGroupCollapsed(g.id) ? '展开该组' : '收起该组'" @click="toggleGroupCollapsed(g.id)">
              <span class="cz-group-ar">{{ isGroupCollapsed(g.id) ? '▸' : '▾' }}</span>
              <Icon v-if="g.id === 'pin'" name="pin" :size="13"/> {{ g.name }}
            </button>
            <span class="cz-group-cnt">{{ g.items.length }} 张</span>
          </div>
          <div v-if="!isGroupCollapsed(g.id)" class="cz-grid" :style="{ '--grid-cols': String(curioCols) }">
          <template v-for="c in g.items" :key="c.id">
          <div class="cz-card" v-pressable
            :class="{selected: selected.has(c.id), pinned: c.pinned, flash: highlightId===c.id, 'drop-line-t': dropMark===c.id+'-t', 'drop-line-b': dropMark===c.id+'-b'}"
            :data-czid="c.id" draggable="true"
            @click="onCardClick(c.id)" @dblclick="onCardDblClick(c)"
            @dragstart="onCzDragStart($event, c.id)" @dragend="onCzDragEnd"
            @dragover.prevent="markDrop($event, c.id, 'x')" @dragleave="clearDropMark" @drop="onCzDrop($event, c.id)"
            @contextmenu.prevent="openCurioCtx($event, c)">
            <span v-if="batchMode" class="cz-check" v-pressable @click.stop="toggleSelect(c.id)"><Icon v-if="selected.has(c.id)" name="checksquare" :size="13"/><Icon v-else name="square" :size="13"/></span>
            <!-- R117（04-61 D）：状态胶囊受「状态」字段显隐控制（批量态下仍让位给勾选框） -->
            <span v-if="cShow('status')" class="cz-status" :class="STATUS_MAP[c.status].cls">{{ STATUS_MAP[c.status].icon }} {{ STATUS_MAP[c.status].label }}</span>
            <button class="cz-pin-corner" :class="{on: c.pinned}" @click.stop="togglePin(c.id)" title="置顶"><Icon name="pin" :size="13"/></button>
            <button class="cz-star-corner" :class="{on: c.starred}" @click.stop="toggleStar(c.id)" title="星标"><Icon name="star" :size="13"/></button>
            <div class="cz-title"><NewBadge :at="c.createdAt" />{{ c.question }}</div>
            <div class="cz-matrow"><MaturityBadge :m="curioMaturity(c)" /></div>
            <!-- 第卌轮 REQ-051：附件徽章 + 标签/自定义字段（字段设计控制显隐排序）
                 R117（04-61 D）：补齐「来源链接」渲染——此前设置里开启也在卡片上不显示 -->
            <div v-if="curioExtFields.length" class="cz-ext">
              <template v-for="f in curioExtFields" :key="f.key">
                <AssetBadge v-if="f.key === 'assets'" :assets="c.assets" />
                <span v-else-if="f.key === 'tags' && c.tags?.length" class="cz-ext-tags">
                  <span v-for="t in c.tags" :key="t" class="cz-ext-tag">#{{ t }}</span>
                </span>
                <a v-else-if="f.key === 'sourceUrl' && toOpenableRawLink(c.sourceUrl)" class="cz-ext-src" :href="toOpenableRawLink(c.sourceUrl)"
                  target="_blank" rel="noreferrer" :title="c.sourceUrl" @click.stop><Icon name="link" :size="13"/> {{ srcShort(c.sourceUrl || '') }}</a>
                <!-- R129-B5：协议不在白名单（含只有文件名的本地路径）→ 不再渲染可点链接，降级为纯文本 -->
                <span v-else-if="f.key === 'sourceUrl' && c.sourceUrl" class="cz-ext-src" data-a11y-container :title="c.sourceUrl" @click.stop><Icon name="link" :size="13"/> {{ srcShort(c.sourceUrl) }}</span>
                <span v-else-if="f.key.startsWith('custom_') && curioExtVal(c, f)" class="cz-ext-custom">
                  <span class="cz-ext-lbl">{{ f.label }}:</span>{{ curioExtVal(c, f) }}
                </span>
              </template>
            </div>
            <!-- R117（04-61 D）：创建时间受字段设置控制（原为硬编码 unconditional 渲染） -->
            <div v-if="cShow('createdAt')" class="cz-meta"><Icon name="calendar" :size="13"/> {{ fmtDate(c.createdAt) }}</div>
            <div class="cz-hover-bar">
              <button class="cz-hover-btn primary" @click.stop="openConvert(c, 'task')">转为任务</button>
              <button class="cz-hover-btn" @click.stop="openConvert(c, 'res')">归档资源</button>
              <button class="cz-hover-btn ai" @click.stop="aiTriage(c)" title="AI 研判这条好奇：值不值得转成任务（判据=对不对得上愿景与活跃目标）"><AiEntryButton variant="inline" label="研判" /></button>
              <button class="cz-hover-btn danger" @click.stop="deleteCard(c)" title="删除"><Icon name="trash" :size="13"/></button>
            </div>
          </div>
        </template>
          </div>
        </section>
      </div>
      <!-- 列表视图 -->
      <div v-else-if="viewMode === 'list'" class="cz-list">
        <section v-for="g in curioGroups" :key="g.id" class="cz-group">
          <div class="cz-group-head">
            <button class="cz-group-label cz-group-toggle" :aria-expanded="!isGroupCollapsed(g.id)"
              :title="isGroupCollapsed(g.id) ? '展开该组' : '收起该组'" @click="toggleGroupCollapsed(g.id)">
              <span class="cz-group-ar">{{ isGroupCollapsed(g.id) ? '▸' : '▾' }}</span>
              <Icon v-if="g.id === 'pin'" name="pin" :size="13"/> {{ g.name }}
            </button>
            <span class="cz-group-cnt">{{ g.items.length }} 张</span>
          </div>
          <template v-if="!isGroupCollapsed(g.id)">
        <template v-for="c in g.items" :key="c.id">
          <div class="cz-list-item" v-pressable draggable="true"
            :data-czid="c.id"
            @click="onCardClick(c.id)" @dblclick="onCardDblClick(c)"
            @dragstart="onCzDragStart($event, c.id)" @dragend="onCzDragEnd"
            @dragover.prevent="markDrop($event, c.id, 'y')" @dragleave="clearDropMark" @drop="onCzDrop($event, c.id)"
            @contextmenu.prevent="openCurioCtx($event, c)"
            :class="dropMark===c.id+'-t' ? 'drop-line-t' : dropMark===c.id+'-b' ? 'drop-line-b' : ''">
            <span v-if="batchMode" class="cz-check" v-pressable @click.stop="toggleSelect(c.id)"><Icon v-if="selected.has(c.id)" name="checksquare" :size="13"/><Icon v-else name="square" :size="13"/></span>
            <span v-else-if="c.pinned" class="cz-pin-flag"><Icon name="pin" :size="13"/></span>
            <span v-else-if="c.starred" class="cz-star-flag"><Icon name="star" :size="13"/></span>
            <span v-if="cShow('status')" class="cz-status" :class="STATUS_MAP[c.status].cls">{{ STATUS_MAP[c.status].icon }}</span>
            <span class="cz-list-text"><NewBadge :at="c.createdAt" />{{ c.question }}</span>
            <MaturityBadge :m="curioMaturity(c)" />
            <AssetBadge v-if="curioExtFields.some(f => f.key === 'assets')" :assets="c.assets" class="cz-list-assets" />
            <!-- R117（04-61 D）：列表视图同步受字段设置控制 -->
            <span v-if="cShow('createdAt')" class="cz-list-date">{{ fmtDate(c.createdAt) }}</span>
            <div class="cz-list-actions">
              <button class="mini-btn" :class="{pinon: c.pinned}" @click.stop="togglePin(c.id)" title="置顶"><Icon name="pin" :size="13"/></button>
              <button class="mini-btn" :class="{pinon: c.starred}" @click.stop="toggleStar(c.id)" title="星标"><Icon name="star" :size="13"/></button>
              <button class="mini-btn" @click.stop="openConvert(c, 'task')">转任务</button>
              <button class="mini-btn" @click.stop="openConvert(c, 'res')">归档</button>
              <button class="mini-btn ai" @click.stop="aiTriage(c)" title="AI 研判这条好奇：值不值得转成任务"><AiEntryButton /></button>
              <button class="mini-btn danger" @click.stop="deleteCard(c)"><Icon name="trash" :size="13"/></button>
            </div>
          </div>
        </template>
          </template>
        </section>
      </div>

      <!-- 看板视图（跨列拖拽改状态） -->
      <div v-else class="cz-kanban">
        <div v-for="col in kanbanCols" :key="col.status" class="cz-kanban-col"
          @dragover.prevent @drop="onCzKanbanDrop($event, col.status)">
          <div class="cz-kanban-head">
            <span>{{ col.icon }} {{ col.label }}</span>
            <span class="cz-kanban-count">{{ col.items.length }}</span>
          </div>
          <div class="cz-kanban-body">
            <div v-for="c in col.items" :key="c.id" class="cz-kanban-card" v-pressable :class="{'drop-line-t': dropMark===c.id+'-t', 'drop-line-b': dropMark===c.id+'-b'}" draggable="true"
              :data-czid="c.id"
              @click="onCardClick(c.id)" @dblclick="onCardDblClick(c)"
              @dragstart="onCzDragStart($event, c.id)" @dragend="onCzDragEnd"
              @dragover.prevent.stop="markDrop($event, c.id, 'y')" @dragleave="clearDropMark" @drop.stop="onCzDrop($event, c.id, col.status)">
              <button class="cz-pin-corner" :class="{on: c.pinned}" @click.stop="togglePin(c.id)" title="置顶"><Icon name="pin" :size="13"/></button>
              <button class="cz-star-corner" :class="{on: c.starred}" @click.stop="toggleStar(c.id)" title="星标"><Icon name="star" :size="13"/></button>
              <div class="cz-kanban-text"><NewBadge :at="c.createdAt" />{{ c.question }}</div>
              <MaturityBadge :m="curioMaturity(c)" />
              <div class="cz-kanban-meta">
                <AssetBadge v-if="curioExtFields.some(f => f.key === 'assets')" :assets="c.assets" />
                <span>{{ fmtDate(c.createdAt) }}</span>
                <button class="cz-kb-ai" @click.stop="aiTriage(c)" title="AI 研判这条好奇：值不值得转成任务"><AiEntryButton /></button>
                <button class="cz-kb-del" @click.stop="deleteCard(c)" title="删除"><Icon name="trash" :size="13"/></button>
              </div>
            </div>
            <div v-if="!col.items.length" class="cz-kanban-empty">拖拽卡片到此列</div>
          </div>
        </div>
      </div>
    </div>

    <!-- R113-N2：生命周期面板移除——入口收敛到 设置→总览 -->

    <!-- R167（OPPO 质感 · 模块化重排）：
         ① 头部只留两样（状态 chip + 成熟度）——原状六样挤在一行（状态/附件徽标/成熟度/AI chip/📌/研判钮），
            460px 下必然换行挤爆；📌 置顶不在这里重复（卡面悬停钮与右键菜单都有）。
         ② AI 入口降到正文首行「一行两格」，与 R166 任务卡三入口 / R167 资源卡同语言。
         ③ 三块分组面板：来源与标签 / 问题原文（焦点，整块撑高）/ 流转与凭证。
         ④ ★转化即离场：转任务或归档资源后本条软删出池（回收站可撤），池头部新增「已转化」计数——
            卡一走池里就数不到它，"探索有没有产出"必须换个地方记账。 -->
    <Drawer :open="!!detailItem" width="520px" @close="detailId = null; curioStatusMenuOpen = false">
      <template #title>
        <div class="ds-kicker">好奇心卡</div>
        <div class="cz-h1q">{{ detailItem ? detailItem.question.split('\n')[0].slice(0, 28) + (detailItem.question.split('\n')[0].length > 28 ? '…' : '') : '' }}</div>
      </template>
      <template #title-extra>
        <div v-if="detailItem" class="ds-status-wrap" data-a11y-container @click.stop>
          <button class="ds-status-chip2" :class="STATUS_MAP[detailItem.status].cls" @click.stop="curioStatusMenuOpen = !curioStatusMenuOpen">{{ STATUS_MAP[detailItem.status].icon }} {{ STATUS_MAP[detailItem.status].label }}</button>
          <div v-if="curioStatusMenuOpen" class="ds-status-menu">
            <div v-for="(s, key) in STATUS_MAP" :key="key" class="mi" v-pressable :class="{on: detailItem.status === key}"
              @click.stop="setStatus(detailItem.id, key as CuriStatus); curioStatusMenuOpen = false">{{ s.icon }} {{ s.label }}</div>
          </div>
        </div>
        <MaturityBadge v-if="detailItem" lg :m="curioMaturity(detailItem)" />
      </template>
      <template v-if="detailItem">
        <!-- AI 入口：一枚（研判）。判词写进详情是**弹窗内的次级动作**（job.secondary），
             不在这里并列——它只在"刚跑完一次研判"的上下文里才有意义。 -->
        <div class="ds-ai-strip one">
          <button class="ds-ai-cell" :disabled="aiBusy" title="AI 研判这条好奇：值不值得转成任务（判据对得上愿景与活跃目标；勾选采纳才落库）。判词可另存进正文，不动状态。" @click="aiTriage(detailItem)">
            <span class="ico"><AiEntryButton variant="icon" :spin="aiBusy" /></span>
            <span class="tx"><b>{{ detailItem.aiTouchedAt ? '↻ 重新研判' : '研判要不要转' }}</b><small>比对愿景与活跃目标 · 勾选才动卡</small></span>
          </button>
          <span v-if="detailItem.aiTouchedAt" class="ds-ai-when">最近 · {{ new Date(detailItem.aiTouchedAt).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</span>
        </div>

        <section class="ds-pnl">
          <div class="ds-pnl-h"><b>来源与标签</b><i>转任务时来源随卡带走</i><span class="r" v-if="detailItem.callCount">打开 {{ detailItem.callCount }} 次</span></div>
          <div class="ds-kv"><span class="k">来源</span><span class="v">
            <input v-model="detailItem.sourceUrl" placeholder="来源链接（网页 / 本地路径 / obsidian://，失焦即保存）…" class="ds-in"
              @change="update(detailItem.id, { sourceUrl: detailItem.sourceUrl })" />
            <button class="ds-ib" title="打开来源" @click="detailItem.sourceUrl && openSourceUrl(detailItem.sourceUrl)"><Icon name="external" :size="13"/></button>
            <button class="ds-ib" title="复制来源" @click="copySourceUrl(detailItem)">⧉</button>
          </span></div>
          <div class="ds-kv"><span class="k">标签</span><span class="v">
            <TagPicker v-model="detailItem.tags" @update:model-value="update(detailItem.id, { tags: $event })" />
          </span></div>
        </section>

        <section class="ds-pnl">
          <div class="ds-pnl-h"><b>资源支撑</b><i>点标题打开原文 · 解绑只删关联记录</i><span class="r">{{ curioSupportRows.length }} 张</span></div>
          <div v-if="curioSupportRows.length" class="ds-sup-list">
            <div v-for="row in curioSupportRows" :key="row.link.id" class="ds-sup-row">
              <button type="button" class="ds-sup-name" :title="row.resource.title" @click="openCurioSupportResource(row.resource)">
                <Icon name="link" :size="12"/> {{ row.resource.title }}
              </button>
              <button type="button" class="ds-sup-remove" title="解除关联（资源池源卡状态不变）" aria-label="解除资源关联" @click="removeCurioSupport(row.link.id)">×</button>
            </div>
          </div>
          <div v-else class="ds-sup-empty">还没有资源支撑。可在下方搜索资源池并手动关联。</div>
          <div class="ds-sup-add">
            <input v-model="curioSupportDraft" list="curio-support-cands" placeholder="搜索资源标题，回车关联…" @keydown.enter.prevent="addCurioSupport">
            <datalist id="curio-support-cands">
              <option v-for="r in curioSupportCands" :key="r.id" :value="r.title" />
            </datalist>
            <button type="button" class="mini-btn" :disabled="!curioSupportDraft.trim()" @click="addCurioSupport">关联</button>
          </div>
        </section>

        <!-- 焦点：问题原文整块撑高（R165-A 正名：现状标签「摘录」实绑 question；REQ-015 Ctrl+Enter 保存；REQ-024 高度拖拽记忆） -->
        <section class="ds-pnl hero">
          <div class="ds-pnl-h"><b>问题原文</b><i>点进去即编辑 · Ctrl+<Icon name="arrowleft" :size="13"/> 保存并关闭</i><span class="r">{{ editDraft.length }} 字</span></div>
          <div class="ta-wrap ds-quote-wrap">
            <textarea v-model="editDraft" rows="4" class="ds-hero-note" :style="{ height: detailH + 'px' }"
              @keydown.ctrl.enter.prevent="saveDetail" @keydown.meta.enter.prevent="saveDetail" />
            <div class="ta-resize" @mousedown="startDetailResize" title="拖拽调节高度（记忆保存）"></div>
          </div>
        </section>

        <section class="ds-pnl">
          <div class="ds-pnl-h"><b>流转与凭证</b><i>都有后果，不静默</i></div>
          <div class="ds-kv clk" v-pressable @click="openConvert(detailItem, 'task')"><span class="k">转任务</span><span class="v">建 1 张任务卡 · 本条<b class="cz-strong">从池中离场</b>（回收站可撤）· 已转化 +1<span class="go">›</span></span></div>
          <div class="ds-kv clk" v-pressable @click="openConvert(detailItem, 'res')"><span class="k">归档资源</span><span class="v">建 1 张资源卡 · 本条<b class="cz-strong">从池中离场</b>（回收站可撤）· 已转化 +1<span class="go">›</span></span></div>
          <details class="ds-details">
            <summary>附件 · 时间 <span v-if="detailItem.assets?.length" class="cnt">({{ detailItem.assets.length }})</span><span class="right">捕获 {{ new Date(detailItem.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span></summary>
            <AssetManager v-model="detailItem.assets" :owner-id="detailItem.id" @update:model-value="onCurioAssetsChange" @html-added="onCurioHtmlAdded" />
            <div class="ds-meta ds-meta-top">
              <span v-if="detailItem.updatedAt">更新 {{ new Date(detailItem.updatedAt).toLocaleString('zh-CN', { hour12: false }) }}</span>
              <AssetBadge v-if="detailItem.assets?.length" :assets="detailItem.assets" />
            </div>
          </details>
        </section>
      </template>
      <!-- R165-A：页脚收敛两钮——删除（二次确认，详情原先不能删）+ 保存 -->
      <template #footer>
        <ArmDeleteButton @confirm="detailItem && deleteCard(detailItem)" />
        <button class="mini-btn primary cz-save" @click="saveDetail"><Icon name="check" :size="13"/> 保存 <span class="cz-enter-hint">Enter</span></button>
      </template>
    </Drawer>

    <!-- 转化弹窗：选目标位置 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="convertOpen" class="cz-modal-overlay" @click.self="convertOpen = false">
          <div class="cz-modal">
            <div class="cz-modal-head">
              <span><Icon :name="convertTarget === 'task' ? 'branch' : 'save'" :size="13"/> {{ convertTarget === 'task' ? '转为任务' : '归档为资源' }}</span>
              <button class="mini-btn" @click="convertOpen = false">×</button>
            </div>
            <div class="cz-modal-sub">{{ convertItem?.question }}</div>

            <template v-if="convertTarget === 'res'">
              <label class="cz-modal-label">存入位置</label>
              <select v-model="convertWsId" class="cz-modal-select">
                <option v-for="w in convWorkspaces" :key="w.id" :value="w.id">{{ w.label }}</option>
              </select>
              <label class="cz-modal-label">分类（默认待分类）</label>
              <select v-model="convertCatId" class="cz-modal-select">
                <option value=""><Icon name="inbox" :size="13"/> 待分类</option>
                <option v-for="cat in convCategories" :key="cat.id" :value="cat.id"><Icon name="folderopen" :size="13"/> {{ cat.name }}</option>
              </select>
            </template>

            <template v-else>
              <label class="cz-modal-label">所属攻坚项目（可选）</label>
              <!-- R70：项目变更时复位指标（见 onConvertProjChange）——此前只 disabled 不清空，可提交出「有指标无项目」的非法任务 -->
              <select v-model="convertProjId" class="cz-modal-select" @change="onConvertProjChange">
                <option value="">暂不归属</option>
                <option v-for="p in convProjects" :key="p.id" :value="p.id"><Icon name="package" :size="13"/> {{ p.name }}（{{ p.dir }}）</option>
              </select>
              <label class="cz-modal-label">成功指标（可选）</label>
              <select v-model="convertMetId" class="cz-modal-select" :disabled="!convertProjId">
                <option value="">暂不归属</option>
                <option v-for="m in convMetrics" :key="m.id" :value="m.id"><Icon name="target" :size="13"/> {{ m.title }}</option>
              </select>
            </template>

            <div class="cz-modal-foot">
              <button class="mini-btn" @click="convertOpen = false">取消</button>
              <button class="mini-btn primary" @click="confirmConvert"><Icon name="check" :size="13"/> 确认转化</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ContextMenu :state="ctx" :items="ctxItems" @close="ctx.open = false" />
    <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
  </ModuleCard>
</template>

<style scoped src="./CuriosityPanel.css"></style>
