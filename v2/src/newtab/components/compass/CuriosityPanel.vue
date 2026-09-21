<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCuriosity, type CuriStatus } from '../../stores/curiosity'
// R129-B12：台名剥图标走全站唯一口径（此处原为 /[^s]+s/ 漏写转义，图标一直在下拉里重复显示）
import { wsDisplayNameOf } from '@/shared/utils/wsName'
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
import { curioMaturity, curioRelated } from '@/shared/utils/maturity'
import type { ResourceCard } from '@/shared/models'
import { emitOpenDrawer } from '@/shared/utils/bus'
// R117（04-61 C3）：当日新增角标（自然日口径）——卡片 / 列表 / 看板三视图同一枚
import NewBadge from '@/shared/components/NewBadge.vue'
import EmptyState from '@/shared/components/EmptyState.vue'
import ContextMenu from '@/shared/components/ContextMenu.vue'
import ColsPicker from '@/shared/components/ColsPicker.vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useCardCols } from '@/shared/utils/cardCols'
import { markRank } from '@/shared/utils/marksort'
import { useTaHeight } from '@/shared/utils/taHeight'
import { onOpenDrawer } from '@/shared/utils/bus'
import { visibleFields } from '@/shared/utils/fields'
import { recordCardOpen } from '@/shared/storage/stats'
import ZhiMark from '@/shared/components/ZhiMark.vue'

const { curiosities, STATUS_MAP, update, setStatus, remove, convertToTask, convertToResource } = useCuriosity()
const store = useAppStore()
const d = computed(() => store.data!)
const route = useRoute()
const router = useRouter()

// 高亮定位（B4：搜索好奇卡结果跳转；R51：声明顺序修复——viewMode/statusFilter 须先于 immediate watcher）
const highlightId = ref<string | null>(null)
const viewMode = ref<'card' | 'list' | 'kanban'>('card')
// R72：卡片视图横向列数（4/5/6/7，记忆 UIPrefs.cardCols.curio；网格模板由 --grid-cols 驱动）
const curioCols = useCardCols('curio', store.ui)
const statusFilter = ref<CuriStatus | 'all'>('all')
watch(() => route.query.hl, (hl) => {
  if (!hl || typeof hl !== 'string' || route.path !== '/') return
  // R117（04-61 B）：按 `?hk=` 认领——调度台首页同页还有任务卡消费者（认领 'task'），
  // 不认领时直接让路；只有真正滚到目标才清 query，避免把另一个消费者要用的 hl 清掉。
  const hk = typeof route.query.hk === 'string' ? route.query.hk : ''
  if (hk && hk !== 'curio') return
  highlightId.value = hl
  statusFilter.value = 'all'
  viewMode.value = 'card'
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
  // R110-LC（T3）：默认视图排除已归档好奇卡（只在 ⏳ 生命周期面板中查看 / 恢复）
  const alive = curiosities.value.filter(c => !c.lifecycleArchived)
  const list = statusFilter.value === 'all'
    ? alive
    : alive.filter(c => c.status === statusFilter.value)
  const dirMul = sortDir.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const r = markRank(b) - markRank(a)
    if (r !== 0) return r
    if (a.sortOrder != null || b.sortOrder != null) {
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
    }
    return dirMul * ((a.createdAt || 0) - (b.createdAt || 0))
  })
})
/** R110-LC（T3）：当前筛选口径下的归档卡数——底部降级提示（≥1 才显示） */
const archivedHintCount = computed(() => curiosities.value
  .filter(c => c.lifecycleArchived && (statusFilter.value === 'all' || c.status === statusFilter.value)).length)

// R113-N2：生命周期入口收敛到 设置→总览（原 R110-LC 面板接线移除）
const pinnedCount = computed(() => filtered.value.filter(c => c.pinned).length)

const statusCounts = computed(() => {
  const counts: Record<string, number> = { all: curiosities.value.length }
  for (const c of curiosities.value) counts[c.status] = (counts[c.status] || 0) + 1
  return counts
})

const kanbanCols = computed(() => {
  const statuses: CuriStatus[] = ['todo', 'doing', 'done', 'shelf']
  return statuses.map(s => ({
    status: s,
    ...STATUS_MAP[s],
    // REQ-035：列内 sortOrder 优先、无 sortOrder 回退时间（filter 新数组再 sort，不改原树）
    items: curiosities.value
      .filter(c => c.status === s && !c.lifecycleArchived)
      .sort((a, b) => {
        if (a.sortOrder != null || b.sortOrder != null) {
          return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        }
        return (a.createdAt || 0) - (b.createdAt || 0)
      })
  }))
})

const detailId = ref<string | null>(null)
// R48 详情重设计：状态下拉 chip（头部一枚，替代四个大按钮）
const curioStatusMenuOpen = ref(false)
/** 第卅三轮 REQ-024：详情文本框高度（默认 180px，拖拽记忆） */
const { taH: detailH, startTaResize: startDetailResize } = useTaHeight('curio-detail', store.ui)
const detailItem = computed(() => curiosities.value.find(c => c.id === detailId.value) || null)
// R142（反馈 #4）：挂载资源区——直接关联 relatedResourceIds 可编辑；其挂载任务的资源并入展示（并集只读）
const relSearch = ref('')
function curioRelUnion(c: CuriosityCard): ResourceCard[] { return curioRelated(d.value, c) }
function relCandidates(c: CuriosityCard): ResourceCard[] {
  const q = relSearch.value.trim().toLowerCase()
  if (!q) return []
  const have = new Set(c.relatedResourceIds || [])
  return (d.value.resources || []).filter(r => !r.deletedAt && !have.has(r.id) && r.title.toLowerCase().includes(q)).slice(0, 8)
}
function toggleCurioRel(c: CuriosityCard, rid: string) {
  const arr = c.relatedResourceIds || []
  update(c.id, { relatedResourceIds: arr.includes(rid) ? arr.filter(x => x !== rid) : [...arr, rid] })
}
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
function saveDetail() {
  if (detailId.value && editDraft.value.trim()) {
    update(detailId.value, { question: editDraft.value.trim() })
    showToast('✓ 已更新')
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
  showToast(next ? '📌 已置顶，将在专区顶部展示' : '已取消置顶')
}
/** 第卅三轮 REQ-020：好奇心星标切换（独立于置顶，可叠加） */
function toggleStar(id: string) {
  const c = curiosities.value.find(x => x.id === id)
  if (!c) return
  const next = !c.starred
  update(id, { starred: next, updatedAt: Date.now() })
  showToast(next ? '⭐ 已星标，搜索时优先展示' : '已取消星标')
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
  showToast(`已删除「${c.question.slice(0, 20)}」`, { label: '撤销', cb: () => {
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
      showToast(`✓ 已移至「${STATUS_MAP[status].label}」`)
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
  showToast('✓ 已调整排序')
}
function onCzKanbanDrop(e: DragEvent, status: CuriStatus) {
  e.preventDefault()
  if (!dragCzId) return
  const c = curiosities.value.find(x => x.id === dragCzId)
  if (c && c.status !== status) {
    setStatus(dragCzId, status)
    showToast(`✓ 已移至「${STATUS_MAP[status].label}」`)
  }
  dragCzId = null
}

// ---- 转化（选策展台/分类 或 项目/指标）----
const convertOpen = ref(false)
const convertTarget = ref<'task' | 'res'>('task')
const convertItem = ref<CuriosityCard | null>(null)
const convertWsId = ref('')
const convertCatId = ref('')
const convertProjId = ref('')
const convertMetId = ref('')

const convWorkspaces = computed(() => store.data!.workspaces.filter(w => !w.archived))
const convCategories = computed(() =>
  store.data!.categories.filter(c => c.workspaceId === convertWsId.value)
)
/** 全部项目（跨方向扁平），带所属方向名 */
const convProjects = computed(() => {
  const list: { id: string; name: string; dir: string; metrics: { id: string; title: string }[] }[] = []
  for (const dir of store.data!.compass.directions) {
    for (const p of dir.projects) {
      list.push({ id: p.id, name: p.name, dir: dir.name, metrics: p.metrics.map(m => ({ id: m.id, title: m.title })) })
    }
  }
  return list
})
const convMetrics = computed(() =>
  convProjects.value.find(p => p.id === convertProjId.value)?.metrics || []
)

function openConvert(c: CuriosityCard, target: 'task' | 'res') {
  convertItem.value = c
  convertTarget.value = target
  convertWsId.value = convWorkspaces.value[0]?.id || ''
  convertCatId.value = ''
  convertProjId.value = ''
  convertMetId.value = ''
  convertOpen.value = true
}
/** R70：项目下拉变更 → 无条件复位指标：
 *  - 项目清空后遗留的旧指标 → convertToTask(c, undefined, 'X') 会产出「有指标无项目」的非法任务（R49 起点名）；
 *  - 项目 A→B 切换后旧指标不在 B 的指标列表内，同属非法。
 *  convertToTask 内另有数据层兜底（双保险）。 */
function onConvertProjChange() { convertMetId.value = '' }
function confirmConvert() {
  const c = convertItem.value
  if (!c) return
  if (convertTarget.value === 'res') {
    if (!convertWsId.value) { showToast('请选择策展台'); return }
    const ws = convWorkspaces.value.find(w => w.id === convertWsId.value)
    convertToResource(c, convertWsId.value, convertCatId.value || undefined)
    showToast(`✓ 已归档至「${ws?.name || ''}」资源台`)
  } else {
    const proj = convProjects.value.find(p => p.id === convertProjId.value)
    const wasShelf = c.status === 'shelf'
    convertToTask(c, convertProjId.value || undefined, convertMetId.value || undefined)
    showToast(proj ? `✓ 已转为任务，归属「${proj.name}」` : '✓ 已转为任务，进入任务中心')
    // 第卌轮 REQ-050：搁置 → 任务按「待开始」处理，显式提示
    if (wasShelf) showToast('ℹ 已搁置的好奇心转为任务后按「待开始」处理')
  }
  convertOpen.value = false
  detailId.value = null
}

/* ===== R144 · G2：转化研判（批量=当前筛选口径下的待探索池；R151 起同一通道支持单卡入口） ===== */
const AiDrawer = defineAsyncComponent(() => import('../AiSuggestionDrawer.vue'))
const aiJob = shallowRef<import('@/shared/ai/job').AiJob | null>(null)
async function aiTriage(one?: CuriosityCard) {
  const d = store.data
  if (!d) return
  const pool = one ? [one] : filtered.value.filter(c => c.status === 'todo' || c.status === 'doing')
  if (!one && pool.length < 3) { showToast('待探索池少于 3 条——先多攒几条好奇心再研判'); return }
  if (one && one.status !== 'todo' && one.status !== 'doing') { showToast('这条已是「已转任务」或「已搁置」——先改回待探索再研判'); return }
  const [{ loadAiConfig, aiReady, aiConfig }, { buildCurioTriageJob }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/batchG')])
  await loadAiConfig()
  if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
  aiJob.value = buildCurioTriageJob({
    d, depth: aiConfig.value.depth, persist: () => store.persist(), pool, single: !!one,
    onConvert: (c, title) => {
      if (c.deletedAt) return false
      const t = convertToTask(c)
      t.title = title.slice(0, 40)
      t.description = ((t.description ? t.description + '\n\n' : '') + '💡 源自好奇研判：' + c.question.slice(0, 80))
      return true
    },
  })
}

const batchMode = ref(false)
const selected = ref<Set<string>>(new Set())
function toggleSelect(id: string) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}
function batchDelete() {
  selected.value.forEach(id => remove(id))
  selected.value.clear()
  batchMode.value = false
  showToast('已批量删除')
}
function batchSetStatus(status: CuriStatus) {
  selected.value.forEach(id => setStatus(id, status))
  selected.value.clear()
  batchMode.value = false
  showToast('已批量更新状态')
}

function fmtDate(ts?: number) {
  if (!ts) return ''
  const dt = new Date(ts)
  return `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// 第卌轮 REQ-051：好奇心卡正面补充字段流（按 fieldConfig.curiosity 显隐/排序）
// R117（04-61 D）：只有 question/status/createdAt 三个骨架 key 不进扩展行——**其余全部参与**，
// 且状态胶囊 / 创建时间 / 来源链接也改为受字段设置控制（此前硬编码渲染 + sourceUrl 从不渲染，
// 用户报「设置无效」）。字段设计一处开关即控卡片正面。
const CZ_SKELETON_KEYS = ['question', 'status', 'createdAt']
/** 该字段是否可见（骨架字段的显隐判定） */
function cShow(key: string): boolean { return visibleFields(d.value.fieldConfig, 'curiosity').some(f => f.key === key) }
const curioExtFields = computed(() =>
  visibleFields(d.value.fieldConfig, 'curiosity').filter(f => !CZ_SKELETON_KEYS.includes(f.key))
)
function curioExtVal(c: CuriosityCard, f: FieldDef): string {
  const v = c.customFields?.[f.key]
  return v == null ? '' : String(v)
}
/** R117（04-61 D）：来源链接短显示（域名 + 路径，超长截断） */
function srcShort(url: string): string {
  try {
    const u = new URL(url)
    return (u.hostname + u.pathname).replace(/^www\./, '').slice(0, 42)
  } catch { return url.slice(0, 42) }
}
</script>

<template>
  <ModuleCard icon-name="bulb" title="好奇心培育" en="CURIOSITY">
    <template #actions>
      <button class="cz-batch-btn ai" title="AI 逐条研判待探索池：哪些值得转成任务、哪些继续养着、哪些可以放下（勾选采纳才写库）" @click="aiTriage()"><ZhiMark :size="13" /> 转化研判</button>
      <button class="cz-batch-btn" :class="{active: batchMode}" @click="batchMode = !batchMode">
        {{ batchMode ? '完成' : '☑ 批量管理' }}
      </button>
    </template>

    <div class="cz-body">
      <div class="cz-filters">
        <button class="cz-filter" :class="{active: statusFilter === 'all'}" @click="statusFilter = 'all'">
          全部 <span class="cz-count">{{ statusCounts.all || 0 }}</span>
        </button>
        <button v-for="(s, key) in STATUS_MAP" :key="key"
          class="cz-filter" :class="{active: statusFilter === key}"
          @click="statusFilter = key as CuriStatus">
          {{ s.icon }} {{ s.label }} <span class="cz-count">{{ statusCounts[key] || 0 }}</span>
        </button>
        <div class="cz-views">
          <!-- R72：卡片视图横向列数（4/5/6/7，仅卡片视图出现） -->
          <ColsPicker v-if="viewMode === 'card'" v-model="curioCols" label="列数" />
          <!-- 第卅二轮 REQ-007：时间排序方向（默认倒序，偏好本地记忆） -->
          <button class="cz-view-btn cz-sort-dir" :title="sortDir==='desc' ? '捕获时间倒序（新→旧），点击切换正序' : '捕获时间正序（旧→新），点击切换倒序'" @click="toggleSortDir">{{ sortDir==='desc' ? '↓' : '↑' }}</button>
          <button class="cz-view-btn" :class="{active: viewMode === 'card'}" @click="viewMode = 'card'" title="卡片视图">▦</button>
          <button class="cz-view-btn" :class="{active: viewMode === 'list'}" @click="viewMode = 'list'" title="列表视图">☰</button>
          <button class="cz-view-btn" :class="{active: viewMode === 'kanban'}" @click="viewMode = 'kanban'" title="看板视图">▥</button>
          <!-- R113-N2：⏳ 入口移除——生命周期收敛到 设置→总览 -->
        </div>
      </div>

      <Transition name="expand">
        <div v-if="batchMode && selected.size" class="cz-batch-bar">
          <span>已选 {{ selected.size }} 项</span>
          <button class="mini-btn" @click="batchSetStatus('doing')">标记探索中</button>
          <button class="mini-btn" @click="batchSetStatus('done')">标记已求证</button>
          <button class="mini-btn" @click="batchSetStatus('shelf')">标记已搁置</button>
          <button class="mini-btn danger" @click="batchDelete">删除</button>
        </div>
      </Transition>

      <!-- R110-LC（T3）：归档卡已从默认视图隐藏——降级提示（R113-N2 起点击跳 设置→总览·资源生命周期） -->
      <div v-if="archivedHintCount" class="cz-archived-hint" @click="router.push('/settings?page=lifecycle')">
        📦 另有 {{ archivedHintCount }} 张已归档好奇卡未显示（点此在 设置 → 总览 · 资源生命周期 中查看 / 恢复）
      </div>

      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="cz-grid" :style="{ '--grid-cols': String(curioCols) }">
        <template v-for="(c, i) in filtered" :key="c.id">
          <div v-if="pinnedCount && i === 0" class="cz-group-label">📌 已置顶</div>
          <div v-else-if="pinnedCount && i === pinnedCount" class="cz-group-label">全部好奇心</div>
          <div class="cz-card"
            :class="{selected: selected.has(c.id), pinned: c.pinned, flash: highlightId===c.id, 'drop-line-t': dropMark===c.id+'-t', 'drop-line-b': dropMark===c.id+'-b'}"
            :data-czid="c.id" draggable="true"
            @click="onCardClick(c.id)" @dblclick="onCardDblClick(c)"
            @dragstart="onCzDragStart($event, c.id)" @dragend="onCzDragEnd"
            @dragover.prevent="markDrop($event, c.id, 'x')" @dragleave="clearDropMark" @drop="onCzDrop($event, c.id)"
            @contextmenu.prevent="openCurioCtx($event, c)">
            <span v-if="batchMode" class="cz-check" @click.stop="toggleSelect(c.id)">{{ selected.has(c.id) ? '☑' : '☐' }}</span>
            <!-- R117（04-61 D）：状态胶囊受「状态」字段显隐控制（批量态下仍让位给勾选框） -->
            <span v-if="cShow('status')" class="cz-status" :class="STATUS_MAP[c.status].cls">{{ STATUS_MAP[c.status].icon }} {{ STATUS_MAP[c.status].label }}</span>
            <button class="cz-pin-corner" :class="{on: c.pinned}" @click.stop="togglePin(c.id)" title="置顶">📌</button>
            <button class="cz-star-corner" :class="{on: c.starred}" @click.stop="toggleStar(c.id)" title="星标">⭐</button>
            <div class="cz-title"><NewBadge :at="c.createdAt" />{{ c.question }}</div>
            <div class="cz-matrow"><MaturityBadge :m="curioMaturity(c, curioRelUnion(c).length)" /><span v-if="curioRelUnion(c).length" class="cz-rel-n" :title="'关联资源 ' + curioRelUnion(c).length + ' 张（含其挂载任务）'">🔗{{ curioRelUnion(c).length }}</span></div>
            <!-- 第卌轮 REQ-051：附件徽章 + 标签/自定义字段（字段设计控制显隐排序）
                 R117（04-61 D）：补齐「来源链接」渲染——此前设置里开启也在卡片上不显示 -->
            <div v-if="curioExtFields.length" class="cz-ext">
              <template v-for="f in curioExtFields" :key="f.key">
                <AssetBadge v-if="f.key === 'assets'" :assets="c.assets" />
                <span v-else-if="f.key === 'tags' && c.tags?.length" class="cz-ext-tags">
                  <span v-for="t in c.tags" :key="t" class="cz-ext-tag">#{{ t }}</span>
                </span>
                <a v-else-if="f.key === 'sourceUrl' && toOpenableRawLink(c.sourceUrl)" class="cz-ext-src" :href="toOpenableRawLink(c.sourceUrl)"
                  target="_blank" rel="noreferrer" :title="c.sourceUrl" @click.stop>🔗 {{ srcShort(c.sourceUrl || '') }}</a>
                <!-- R129-B5：协议不在白名单（含只有文件名的本地路径）→ 不再渲染可点链接，降级为纯文本 -->
                <span v-else-if="f.key === 'sourceUrl' && c.sourceUrl" class="cz-ext-src" :title="c.sourceUrl" @click.stop>🔗 {{ srcShort(c.sourceUrl) }}</span>
                <span v-else-if="f.key.startsWith('custom_') && curioExtVal(c, f)" class="cz-ext-custom">
                  <span class="cz-ext-lbl">{{ f.label }}:</span>{{ curioExtVal(c, f) }}
                </span>
              </template>
            </div>
            <!-- R117（04-61 D）：创建时间受字段设置控制（原为硬编码 unconditional 渲染） -->
            <div v-if="cShow('createdAt')" class="cz-meta">📅 {{ fmtDate(c.createdAt) }}</div>
            <div class="cz-hover-bar">
              <button class="cz-hover-btn primary" @click.stop="openConvert(c, 'task')">转为任务</button>
              <button class="cz-hover-btn" @click.stop="openConvert(c, 'res')">归档资源</button>
              <button class="cz-hover-btn ai" @click.stop="aiTriage(c)" title="AI 研判这条好奇：值不值得转成任务（判据=对不对得上愿景与活跃目标）"><ZhiMark :size="13" /> 研判</button>
              <button class="cz-hover-btn danger" @click.stop="deleteCard(c)" title="删除">🗑</button>
            </div>
          </div>
        </template>
        <div v-if="!filtered.length" class="cz-empty">
          <div class="cz-empty-icon">💡</div>
          <div>还没有好奇心 · 按 Ctrl+Shift+I 一键采集（支持选中网页文本后采集）</div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else-if="viewMode === 'list'" class="cz-list">
        <template v-for="(c, i) in filtered" :key="c.id">
          <div v-if="pinnedCount && i === 0" class="cz-group-label">📌 已置顶</div>
          <div v-else-if="pinnedCount && i === pinnedCount" class="cz-group-label">全部好奇心</div>
          <div class="cz-list-item" draggable="true"
            @click="onCardClick(c.id)" @dblclick="onCardDblClick(c)"
            @dragstart="onCzDragStart($event, c.id)" @dragend="onCzDragEnd"
            @dragover.prevent="markDrop($event, c.id, 'y')" @dragleave="clearDropMark" @drop="onCzDrop($event, c.id)"
            @contextmenu.prevent="openCurioCtx($event, c)"
            :class="dropMark===c.id+'-t' ? 'drop-line-t' : dropMark===c.id+'-b' ? 'drop-line-b' : ''">
            <span v-if="batchMode" class="cz-check" @click.stop="toggleSelect(c.id)">{{ selected.has(c.id) ? '☑' : '☐' }}</span>
            <span v-else-if="c.pinned" class="cz-pin-flag">📌</span>
            <span v-else-if="c.starred" class="cz-star-flag">⭐</span>
            <span v-if="cShow('status')" class="cz-status" :class="STATUS_MAP[c.status].cls">{{ STATUS_MAP[c.status].icon }}</span>
            <span class="cz-list-text"><NewBadge :at="c.createdAt" />{{ c.question }}</span>
            <MaturityBadge :m="curioMaturity(c, curioRelUnion(c).length)" />
            <AssetBadge v-if="curioExtFields.some(f => f.key === 'assets')" :assets="c.assets" class="cz-list-assets" />
            <!-- R117（04-61 D）：列表视图同步受字段设置控制 -->
            <span v-if="cShow('createdAt')" class="cz-list-date">{{ fmtDate(c.createdAt) }}</span>
            <div class="cz-list-actions">
              <button class="mini-btn" :class="{pinon: c.pinned}" @click.stop="togglePin(c.id)" title="置顶">📌</button>
              <button class="mini-btn" :class="{pinon: c.starred}" @click.stop="toggleStar(c.id)" title="星标">⭐</button>
              <button class="mini-btn" @click.stop="openConvert(c, 'task')">转任务</button>
              <button class="mini-btn" @click.stop="openConvert(c, 'res')">归档</button>
              <button class="mini-btn ai" @click.stop="aiTriage(c)" title="AI 研判这条好奇：值不值得转成任务"><ZhiMark :size="12" /></button>
              <button class="mini-btn danger" @click.stop="deleteCard(c)">🗑</button>
            </div>
          </div>
        </template>
        <EmptyState v-if="!filtered.length" icon="bulb" title="还没有好奇心"
            desc="按 Ctrl+Shift+I 一键采集（支持先选中网页文字）"
            action-label="盘一盘方向树" @action="$router ? null : null" />
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
            <div v-for="c in col.items" :key="c.id" class="cz-kanban-card" :class="{'drop-line-t': dropMark===c.id+'-t', 'drop-line-b': dropMark===c.id+'-b'}" draggable="true"
              @click="onCardClick(c.id)" @dblclick="onCardDblClick(c)"
              @dragstart="onCzDragStart($event, c.id)" @dragend="onCzDragEnd"
              @dragover.prevent.stop="markDrop($event, c.id, 'y')" @dragleave="clearDropMark" @drop.stop="onCzDrop($event, c.id, col.status)">
              <button class="cz-pin-corner" :class="{on: c.pinned}" @click.stop="togglePin(c.id)" title="置顶">📌</button>
              <button class="cz-star-corner" :class="{on: c.starred}" @click.stop="toggleStar(c.id)" title="星标">⭐</button>
              <div class="cz-kanban-text"><NewBadge :at="c.createdAt" />{{ c.question }}</div>
              <MaturityBadge :m="curioMaturity(c, curioRelUnion(c).length)" />
              <div class="cz-kanban-meta">
                <AssetBadge v-if="curioExtFields.some(f => f.key === 'assets')" :assets="c.assets" />
                <span>{{ fmtDate(c.createdAt) }}</span>
                <button class="cz-kb-ai" @click.stop="aiTriage(c)" title="AI 研判这条好奇：值不值得转成任务"><ZhiMark :size="12" /></button>
                <button class="cz-kb-del" @click.stop="deleteCard(c)" title="删除">🗑</button>
              </div>
            </div>
            <div v-if="!col.items.length" class="cz-kanban-empty">拖拽卡片到此列</div>
          </div>
        </div>
      </div>
    </div>

    <!-- R113-N2：生命周期面板移除——入口收敛到 设置→总览 -->

    <!-- R48 详情重设计：状态收进头部下拉 chip；摘录升为 Hero 引用体；元数据一行小字；附件折叠 -->
    <Drawer :open="!!detailItem" :title="detailItem ? '好奇心详情' : ''" @close="detailId = null; curioStatusMenuOpen = false">
      <template #title-extra>
        <div v-if="detailItem" class="ds-status-wrap" @click.stop>
          <button class="ds-status-chip2" :class="STATUS_MAP[detailItem.status].cls" @click.stop="curioStatusMenuOpen = !curioStatusMenuOpen">{{ STATUS_MAP[detailItem.status].icon }} {{ STATUS_MAP[detailItem.status].label }}</button>
          <div v-if="curioStatusMenuOpen" class="ds-status-menu">
            <div v-for="(s, key) in STATUS_MAP" :key="key" class="mi" :class="{on: detailItem.status === key}"
              @click.stop="setStatus(detailItem.id, key as CuriStatus); curioStatusMenuOpen = false">{{ s.icon }} {{ s.label }}</div>
          </div>
        </div>
        <AssetBadge v-if="detailItem?.assets?.length" :assets="detailItem.assets" />
        <MaturityBadge v-if="detailItem" lg :m="curioMaturity(detailItem, curioRelUnion(detailItem).length)" />
      </template>
      <template v-if="detailItem">
        <!-- Hero：摘录即主角（第卅三轮 REQ-015 Ctrl+Enter 保存；REQ-024 高度拖拽记忆） -->
        <div class="ds-hero-label">摘录 <span class="hint">— 点击即编辑 · Ctrl+↩ 保存并关闭</span></div>
        <div class="ta-wrap ds-quote-wrap">
          <textarea v-model="editDraft" rows="4" class="ds-quote" :style="{ height: detailH + 'px' }"
            @keydown.ctrl.enter.prevent="saveDetail" @keydown.meta.enter.prevent="saveDetail" />
          <div class="ta-resize" @mousedown="startDetailResize" title="拖拽调节高度（记忆保存）"></div>
        </div>
        <!-- 元数据一行小字（O24 来源链接可点） -->
        <div class="ds-meta" style="margin-top:12px">
          <span>捕获 {{ new Date(detailItem.createdAt || Date.now()).toLocaleDateString('zh-CN') }}</span>
          <span v-if="detailItem.updatedAt" title="最近一次修改时间">更新 {{ new Date(detailItem.updatedAt).toLocaleString('zh-CN', { hour12: false }) }}</span>
          <a v-if="detailItem.sourceUrl" class="lnk ds-src-link" :title="detailItem.sourceUrl" @click.prevent="openSourceUrl(detailItem.sourceUrl!)">{{ detailItem.sourceTitle || detailItem.sourceUrl }}</a>
        </div>
        <div class="detail-link-add" style="margin-top:10px">
          <input v-model="detailItem.sourceUrl" placeholder="来源链接（网页 / 本地路径 / obsidian://，失焦即保存）…" class="detail-link-input"
            @change="update(detailItem.id, { sourceUrl: detailItem.sourceUrl })" />
        </div>
        <div style="margin-top:12px">
          <TagPicker v-model="detailItem.tags" @update:model-value="update(detailItem.id, { tags: $event })" />
        </div>
        <div style="margin-top:12px">
          <div class="cz-rel-label">🔗 挂载资源卡 <span class="hint">— 查证材料 · 转任务时随迁（任务自带的资源也在此并集展示）</span></div>
          <div v-for="r in curioRelUnion(detailItem)" :key="r.id" class="cz-rel-row">
            <a class="lnk" :title="r.title" @click.prevent="emitOpenDrawer({ kind: 'res', id: r.id })">📄 {{ r.title }}</a>
            <button v-if="(detailItem.relatedResourceIds || []).includes(r.id)" class="cz-rel-x" title="取消直接关联" @click="toggleCurioRel(detailItem, r.id)">✕</button>
            <span v-else class="cz-rel-via" title="来自挂载该好奇心的任务">经任务挂载</span>
          </div>
          <div v-if="!curioRelUnion(detailItem).length" class="cz-rel-empty">暂无关联资源 · 下方搜索挂载</div>
          <input v-model="relSearch" class="detail-link-input" placeholder="🔍 搜索资源卡标题并挂载…" />
          <div v-for="r in relCandidates(detailItem)" :key="r.id" class="cz-rel-cand" @click="toggleCurioRel(detailItem, r.id)">＋ {{ r.title }}</div>
        </div>
        <details class="ds-details" style="margin-top:14px">
          <summary>📎 附件 <span v-if="detailItem.assets?.length" class="cnt">({{ detailItem.assets.length }})</span><span class="right">图片弹窗预览 / HTML 新标签打开</span></summary>
          <AssetManager v-model="detailItem.assets" :owner-id="detailItem.id" @update:model-value="onCurioAssetsChange" @html-added="onCurioHtmlAdded" />
        </details>
      </template>
      <template #footer>
        <button class="mini-btn" :class="{pinon: detailItem?.pinned}" @click="detailItem && togglePin(detailItem.id)">{{ detailItem?.pinned ? '📌 已置顶' : '📌 置顶' }}</button>
        <button class="mini-btn" @click="detailItem && openConvert(detailItem, 'task')">转为任务</button>
        <button class="mini-btn" @click="detailItem && openConvert(detailItem, 'res')">归档为资源</button>
        <button class="mini-btn" @click="detailItem && aiTriage(detailItem)"><ZhiMark :size="12" /> 研判</button>
        <button class="mini-btn primary" style="margin-left:auto" @click="saveDetail">保存 <span style="font-size:10px;opacity:.75;margin-left:2px">⏎</span></button>
      </template>
    </Drawer>

    <!-- 转化弹窗：选目标位置 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="convertOpen" class="cz-modal-overlay" @click.self="convertOpen = false">
          <div class="cz-modal">
            <div class="cz-modal-head">
              <span>{{ convertTarget === 'task' ? '✅ 转为任务' : '📄 归档为资源' }}</span>
              <button class="mini-btn" @click="convertOpen = false">×</button>
            </div>
            <div class="cz-modal-sub">{{ convertItem?.question }}</div>

            <template v-if="convertTarget === 'res'">
              <label class="cz-modal-label">存入策展台</label>
              <select v-model="convertWsId" class="cz-modal-select">
                <option v-for="w in convWorkspaces" :key="w.id" :value="w.id">{{ w.icon }} {{ wsDisplayNameOf(w) }}</option>
              </select>
              <label class="cz-modal-label">分类（默认待分类）</label>
              <select v-model="convertCatId" class="cz-modal-select">
                <option value="">📥 待分类</option>
                <option v-for="cat in convCategories" :key="cat.id" :value="cat.id">📂 {{ cat.name }}</option>
              </select>
            </template>

            <template v-else>
              <label class="cz-modal-label">所属攻坚项目（可选）</label>
              <!-- R70：项目变更时复位指标（见 onConvertProjChange）——此前只 disabled 不清空，可提交出「有指标无项目」的非法任务 -->
              <select v-model="convertProjId" class="cz-modal-select" @change="onConvertProjChange">
                <option value="">暂不归属</option>
                <option v-for="p in convProjects" :key="p.id" :value="p.id">📦 {{ p.name }}（{{ p.dir }}）</option>
              </select>
              <label class="cz-modal-label">成功指标（可选）</label>
              <select v-model="convertMetId" class="cz-modal-select" :disabled="!convertProjId">
                <option value="">暂不归属</option>
                <option v-for="m in convMetrics" :key="m.id" :value="m.id">🎯 {{ m.title }}</option>
              </select>
            </template>

            <div class="cz-modal-foot">
              <button class="mini-btn" @click="convertOpen = false">取消</button>
              <button class="mini-btn primary" @click="confirmConvert">✓ 确认转化</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ContextMenu :state="ctx" :items="ctxItems" @close="ctx.open = false" />
    <AiDrawer v-if="aiJob" :job="aiJob" @close="aiJob = null" />
  </ModuleCard>
</template>

<style scoped>
.cz-batch-btn { padding: 5px 12px; border-radius: 8px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); }
.cz-batch-btn:hover { border-color: var(--border-strong); }
.cz-batch-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.cz-add-row { background: var(--surface-2); border: 1px solid var(--accent); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 14px; box-shadow: 0 0 0 3px var(--accent-glow); }
.cz-add-input { width: 100%; border: none; outline: none; background: transparent; font-size: 14px; font-family: inherit; line-height: 1.7; color: var(--text); resize: vertical; }
.cz-add-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
.mini-btn { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); }
.mini-btn:hover { border-color: var(--border-strong); color: var(--text); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); border-color: var(--danger); }
/* R48 详情重设计补充 */
.ds-src-link { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: bottom; }
.ds-status-wrap { margin-left: 8px; }
.ds-status-chip2:active { transform: scale(.97); }
.cz-filters { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.cz-filter { font-size: 12px; padding: 5px 12px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); cursor: pointer; transition: all var(--dur); border: none; font-family: inherit; display: flex; align-items: center; gap: 4px; }
.cz-filter:hover { background: var(--border); }
.cz-filter.active { background: var(--accent); color: #fff; }
.cz-count { font-size: 10px; opacity: .7; }
.cz-views { display: flex; gap: 2px; margin-left: auto; }
.cz-view-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 14px; transition: all var(--dur); border: none; background: transparent; }
/* 第卅二轮 REQ-007：时间排序方向切换 */
.cz-sort-dir { font-size: 13px; font-weight: 600; margin-right: 2px; border: 1px solid var(--border); background: var(--surface); font-family: inherit; }
.cz-sort-dir:hover { border-color: var(--accent); color: var(--accent); }
.cz-view-btn:hover { background: var(--surface-3); color: var(--text-2); }
.cz-view-btn.active { background: var(--accent-light); color: var(--accent); }
/* R110-LC（T3）：归档降级提示条 */
.cz-archived-hint { margin: 6px 0 0; padding: 6px 12px; border: 1px dashed var(--border-strong); border-radius: 8px; font-size: 11.5px; color: var(--text-3); cursor: pointer; transition: all var(--dur); }
.cz-archived-hint:hover { border-color: var(--accent); color: var(--accent); }
.cz-batch-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--accent-light); border-radius: var(--radius-sm); margin-bottom: 14px; font-size: 12px; color: var(--accent); font-weight: 500; }
/* R72：卡片视图列数由 --grid-cols 驱动（4/5/6/7）；容器放不下 N 列时自动降列，卡片最小 200px */
.cz-grid { display: grid; /* R106（F3）：精确 N 列——选中 N 即渲染 N 列，卡片宽度自适应收缩（含看板外全部视图） */ grid-template-columns: repeat(var(--grid-cols, 4), minmax(0, 1fr)); gap: 12px; }
.cz-card.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.cz-card.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.cz-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; cursor: pointer; transition: all var(--dur); position: relative; overflow: hidden; min-width: 0; /* R107（F8） */ }
.cz-card.flash { animation: cz-flash 2s ease-out; }
@keyframes cz-flash { 0%,60% { background: var(--accent-light); box-shadow: 0 0 0 2px var(--accent); } 100% { background: var(--surface-2); box-shadow: none; } }
.cz-card.dragging { opacity: .4; }
.cz-card.drag-over { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
.cz-hover-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.mini-btn.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }
.mini-btn.danger:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.cz-kanban-col.drag-over { box-shadow: 0 0 0 2px var(--accent-glow); }
.cz-kanban-card.dragging { opacity: .4; }
.cz-list-item.drop-line-t, .cz-kanban-card.drop-line-t { box-shadow: inset 0 2px 0 var(--accent); }
.cz-list-item.drop-line-b, .cz-kanban-card.drop-line-b { box-shadow: inset 0 -2px 0 var(--accent); }
.cz-kb-ai { border: none; background: transparent; color: var(--text-4); cursor: pointer; font-size: 11px; padding: 0 2px; font-family: inherit; display: inline-flex; align-items: center; }
.cz-kb-del { margin-left: auto; border: none; background: transparent; color: var(--text-4); cursor: pointer; font-size: 11px; padding: 0 2px; font-family: inherit; }
.cz-kb-del:hover { color: var(--danger); }
.cz-card:hover { border-color: var(--accent); background: var(--surface); transform: translateY(-1px); box-shadow: var(--shadow); }
.cz-card.selected { border-color: var(--accent); background: var(--accent-light); }
.cz-check { position: absolute; top: 8px; right: 8px; font-size: 14px; z-index: 2; }
.cz-status { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 99px; margin-bottom: 8px; font-weight: 500; }
.cz-status.pending { background: var(--accent-light); color: var(--accent); }
.cz-status.exploring { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.cz-status.verified { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.cz-status.shelved { background: var(--surface-3); color: var(--text-3); }
.cz-title { font-size: 13px; font-weight: 500; color: var(--text); line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cz-meta { font-size: 10px; color: var(--text-3); }
.cz-hover-bar { position: absolute; bottom: 0; left: 0; right: 0; background: var(--surface); border-top: 1px solid var(--border); padding: 8px 10px; display: flex; gap: 6px; transform: translateY(100%); transition: transform .2s; }
.cz-card:hover .cz-hover-bar { transform: translateY(0); }
.cz-hover-btn { font-size: 10px; padding: 4px 8px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); transition: all var(--dur); flex: 1; text-align: center; font-family: inherit; }
.cz-hover-btn:hover { border-color: var(--accent); color: var(--accent); }
.cz-hover-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.cz-empty { grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-3); font-size: 13px; }
.cz-empty-icon { font-size: 36px; opacity: .4; margin-bottom: 8px; }
.cz-list { display: flex; flex-direction: column; gap: 4px; }
.cz-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-xs); cursor: pointer; transition: background .1s; }
.cz-list-item:hover { background: var(--surface-2); }
.cz-list-text { flex: 1; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cz-list-date { font-size: 11px; color: var(--text-3); }
.cz-list-actions { display: flex; gap: 4px; opacity: 0; transition: opacity var(--dur); }
.cz-list-item:hover .cz-list-actions { opacity: 1; }
.cz-kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.cz-kanban-col { background: var(--surface-2); border-radius: var(--radius-sm); padding: 10px; min-height: 200px; }
.cz-kanban-head { font-size: 12px; font-weight: 600; color: var(--text-2); padding: 4px 6px 10px; display: flex; align-items: center; justify-content: space-between; }
.cz-kanban-count { font-size: 10px; background: var(--surface-3); color: var(--text-3); padding: 1px 7px; border-radius: 99px; }
.cz-kanban-body { display: flex; flex-direction: column; gap: 8px; }
.cz-kanban-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 10px; cursor: pointer; transition: all var(--dur); }
.cz-kanban-card:hover { border-color: var(--accent); box-shadow: var(--shadow); }
.cz-kanban-text { font-size: 12.5px; color: var(--text); line-height: 1.5; margin-bottom: 6px; }
.cz-kanban-meta { font-size: 10px; color: var(--text-3); }
.cz-kanban-empty { text-align: center; padding: 20px; font-size: 11px; color: var(--text-4); border: 1px dashed var(--border); border-radius: var(--radius-xs); }
.detail-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.status-chip { padding: 5px 12px; border-radius: 99px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all var(--dur); }
.status-chip:hover { border-color: var(--border-strong); }
.status-chip.active.pending { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.status-chip.active.exploring { background: var(--tag-warn-bg); color: var(--tag-warn-text); border-color: var(--tag-warn-text); }
.status-chip.active.verified { background: var(--tag-ok-bg); color: var(--tag-ok-text); border-color: var(--tag-ok-text); }
.status-chip.active.shelved { background: var(--surface-3); color: var(--text-2); border-color: var(--border-strong); }
.detail-textarea { width: 100%; min-height: 96px; max-height: 400px; border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 12px; font-size: 14px; font-family: inherit; line-height: 1.7; color: var(--text); background: var(--surface); outline: none; resize: vertical; }
.detail-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
/* 第卅三轮 REQ-024：文本框拖拽手柄（高度经 UIPrefs.taHeights 记忆） */
.ta-wrap { position: relative; }
.ta-resize { position: absolute; right: 3px; bottom: 3px; width: 16px; height: 12px; cursor: ns-resize; z-index: 2; opacity: .45; border-right: 3px solid var(--text-3); border-bottom: 3px solid var(--text-3); border-bottom-right-radius: 3px; }
.ta-resize:hover { opacity: .9; }
.detail-meta { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; font-size: 11.5px; color: var(--text-3); }
.detail-src { display: flex; align-items: center; gap: 6px; margin: 8px 0 6px; padding: 6px 9px; background: var(--surface-2); border: 1px dashed var(--border); border-radius: 8px; font-size: 11.5px; min-width: 0; }
.detail-src .ds-ico { flex-shrink: 0; }
.detail-src .ds-link { color: var(--accent); cursor: pointer; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.detail-src .ds-link:hover { text-decoration: underline; }
.detail-src .ds-title { color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.detail-link-add { display: flex; gap: 8px; margin-top: 12px; }
.detail-link-input { flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 12px; font-family: inherit; outline: none; }
/* R142（反馈 #4）：挂载资源区 + 成熟度徽标行 */
.cz-matrow { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
.cz-rel-n { font-size: 10.5px; color: var(--text-4); }
.cz-rel-label { font-size: 11px; color: var(--text-3); margin-bottom: 6px; }
.cz-rel-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 2px; font-size: 12px; }
.cz-rel-x { border: none; background: transparent; color: var(--text-4); cursor: pointer; font-family: inherit; }
.cz-rel-x:hover { color: var(--danger); }
.cz-rel-via { font-size: 10px; color: var(--text-4); }
.cz-rel-empty { font-size: 11.5px; color: var(--text-4); padding: 2px 0 6px; }
.cz-rel-cand { font-size: 12px; padding: 4px 6px; border-radius: 6px; cursor: pointer; color: var(--text-2); }
.cz-rel-cand:hover { background: var(--surface-2); color: var(--accent); }
.detail-link-input:focus { border-color: var(--accent); }
.expand-enter-active, .expand-leave-active { transition: all var(--dur) ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }

/* 置顶与分组 */
.cz-card.pinned { border-left: 3px solid var(--accent); }
.cz-pin-flag { position: absolute; top: 8px; right: 8px; font-size: 12px; }
.cz-star-flag { position: absolute; top: 8px; right: 8px; font-size: 12px; }
/* 第十七轮：置顶常驻右上角（默认半隐，hover 显现，置顶态常亮） */
.cz-pin-corner { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: .3; transition: all var(--dur) ease; z-index: 2; }
/* 第卅三轮 REQ-020：星标角落按钮（与置顶并排左移） */
.cz-star-corner { position: absolute; top: 8px; right: 36px; width: 24px; height: 24px; border: none; background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: .3; transition: all var(--dur) ease; z-index: 2; }
.cz-card:hover .cz-pin-corner, .cz-kanban-card:hover .cz-pin-corner, .cz-card:hover .cz-star-corner, .cz-kanban-card:hover .cz-star-corner { opacity: .8; }
.cz-pin-corner:hover, .cz-star-corner:hover { opacity: 1 !important; background: var(--surface-3); }
.cz-pin-corner.on { opacity: 1; background: var(--accent-light); }
.cz-star-corner.on { opacity: 1; background: color-mix(in srgb, #f5b942 18%, transparent); }
.mini-btn.pinon { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
.cz-group-label { grid-column: 1 / -1; font-size: 11px; font-weight: 600; color: var(--text-3); padding: 2px 2px 0; letter-spacing: .5px; }
.cz-list .cz-group-label { padding: 6px 2px 2px; }
.mini-btn.pinon { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.cz-hover-btn.on { background: var(--accent); color: #fff; border-color: var(--accent); }

/* 转化弹窗 */
.cz-modal-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,.28); display: flex; align-items: flex-start; justify-content: center; padding-top: 20vh; }
.cz-modal { width: 400px; max-width: 92vw; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 18px 20px; }
.cz-modal-head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.cz-modal-sub { font-size: 12px; color: var(--text-3); line-height: 1.6; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cz-modal-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-3); margin: 10px 0 5px; }
.cz-modal-select { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px; font-size: 12.5px; color: var(--text); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; }
.cz-modal-select:focus { border-color: var(--accent); }
.cz-modal-select:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }
.cz-modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
/* 第卌轮 REQ-051：卡片正面补充字段流（附件徽章 / 标签 / 自定义） */
.cz-ext { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 7px; }
.cz-ext-tags { display: inline-flex; flex-wrap: wrap; gap: 3px; }
.cz-ext-tag { font-size: 10px; line-height: 1; padding: 2px 7px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); }
.cz-ext-custom { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--text-2); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cz-ext-lbl { color: var(--text-3); }
/* R117（04-61 D）：来源链接（字段设置开启后才渲染）——走链接蓝，长 URL 截断 */
.cz-ext-src { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--accent); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
.cz-ext-src:hover { text-decoration: underline; }
.cz-list-assets { margin: 0 2px; }
</style>
