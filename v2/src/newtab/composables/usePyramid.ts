/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 金字塔域 composable——层级/布局数据、SVG 连线、真全屏（宿主 .ws-page）、
 * 节点拖拽落点、节点菜单、打包成节点、节点关联卡选择器、Markdown 模板导入写入链。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 * 拖拽状态消费 useResourceDragDrop 的 dragState（原宿主共享 let 变量的机械改写）。
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick, type ComputedRef, type Ref } from 'vue'
import { showToast } from '@/shared/components/toast'
import { uid } from '@/shared/utils'
import { setOverlayFsHost } from '@/shared/utils/overlayHost'
import { setThesis, isMirrorView, canMountInNode, projectCardToBoard, type MirrorView } from '@/shared/storage/hub'
import { parsePyramidTemplate, type PyramidParseResult, type PyramidNode } from '@/shared/utils/mdImport'
import type { CatIndex } from '@/shared/utils/catIndex'
import { CURATION_WS_ID, type AppData, type ResourceCard, type Category } from '@/shared/models'
import { POOL_DISPLAY_NAME } from '@/shared/utils/wsName'
import type { WsStore } from './useResourceView'
import type { DragState } from './useResourceDragDrop'

export interface PyNode { cat: Category; depth: number; cards: ResourceCard[] }

export interface PyramidCtx {
  store: WsStore
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  wsCats: ComputedRef<Category[]>
  catIdx: ComputedRef<CatIndex<Category>>
  allResources: ComputedRef<ResourceCard[]>
  thesisCard: ComputedRef<ResourceCard | null>
  viewMode: Ref<'card'|'list'|'kanban'|'pyramid'>
  pyFold: Ref<'l2' | 'l3' | 'all'>
  activeCategory: Ref<string>
  catFlashId: Ref<string | null>
  setViewMode: (m: 'card'|'list'|'kanban'|'pyramid') => void
  openInputModal: (title: string, value: string, cb: (v: string) => void) => void
  // 层级工具（宿主树工具域）
  pyDepthOf: (c: Category) => number
  pyHeightOf: (c: Category) => number
  pyLevelOf: (c: Category) => number
  childIds: (catId: string) => string[]
  // useResourceDragDrop
  dragState: DragState
  onCatDragEnd: () => void
  clearCardDropTarget: () => void
  // useWorkspaceMirror
  moveMirrorTo: (m: MirrorView, catId: string) => void
  // useCategoryCrud
  normalizeCatOrders: (rootId: string) => void
  openCreateCat: (parentId: string) => void
  startCatRename: (c: Category) => void
  deleteCategory: (c: Category) => Promise<void> | void
  // useWorkspaceBatch
  selectedCards: () => ResourceCard[]
  selectedIds: Ref<Set<string>>
}

export function usePyramid(ctx: PyramidCtx) {
  const { store, d, workspaceId, wsCats, catIdx, allResources, thesisCard, viewMode, pyFold,
    activeCategory, catFlashId, setViewMode, openInputModal,
    pyDepthOf, pyHeightOf, pyLevelOf, childIds,
    dragState, onCatDragEnd, clearCardDropTarget,
    moveMirrorTo, normalizeCatOrders, openCreateCat, startCatRename, deleteCategory,
    selectedCards, selectedIds } = ctx

  /** R108（T3）：金字塔 Markdown 模板导入写入链——
   *  论点（本台未设且 md 含 H1 → 建论点卡 + setThesis）→ 逐层建分类（同父同名复用）→
   *  每分类节点建一张同名台内卡（正文=节点描述）；完成后切到金字塔视图呈现。 */
  const pyramidImportOpen = ref(false)
  function confirmPyramidImport(payload: { pyramid?: PyramidParseResult }) {
    const pyr = payload.pyramid
    if (!pyr || !pyr.thesis) { showToast('未识别到中心论点——不写入'); return }
    let nodeTotal = 0
    const cnt = (n: PyramidNode) => { nodeTotal++; (n.children || []).forEach(cnt) }
    cnt(pyr.thesis)
    if (nodeTotal > 200) { showToast('⚠ 单次导入建议不超过 200 个节点——请分批导入'); return }
    let catCount = 0, cardCount = 0, reused = 0
    const ensureCat = (name: string, parentId?: string): Category => {
      const found = d.value.categories.find(c => c.workspaceId === workspaceId.value && !c.deletedAt && (c.parentId || undefined) === parentId && c.name === name)
      if (found) { reused++; return found }
      const cat: Category = { id: uid('cat'), workspaceId: workspaceId.value, name, order: d.value.categories.filter(c => c.workspaceId === workspaceId.value && (c.parentId || undefined) === parentId).length }
      if (parentId) cat.parentId = parentId
      d.value.categories.push(cat)
      catCount++
      return cat
    }
    const ensureNodeCard = (cat: Category, name: string, desc: string) => {
      const dup = d.value.resources.find(r => !r.deletedAt && r.workspaceId === workspaceId.value && r.categoryId === cat.id && r.title === name)
      if (dup) { reused++; return }
      d.value.resources.unshift({
        id: uid('res'), kind: 'resource', title: name, linkType: 'url', link: '',
        workspaceId: workspaceId.value, categoryId: cat.id,
        description: desc || undefined, tags: [], customFields: {}, pinned: false, callCount: 0,
        createdAt: Date.now(), updatedAt: Date.now()
      })
      cardCount++
    }
    const walk = (nodes: PyramidNode[], parentId?: string) => {
      for (const n of nodes) {
        const cat = ensureCat(n.name, parentId)
        ensureNodeCard(cat, n.name, n.desc)
        walk(n.children || [], cat.id)
      }
    }
    if (!thesisCard.value && pyr.thesis && !pyr.thesis.virtual) {
      const card: ResourceCard = {
        id: uid('res'), kind: 'resource', title: pyr.thesis.name, linkType: 'url', link: '',
        workspaceId: workspaceId.value, categoryId: '',
        description: pyr.thesis.desc || undefined, tags: [], customFields: {}, pinned: false, callCount: 0,
        createdAt: Date.now(), updatedAt: Date.now()
      }
      d.value.resources.unshift(card)
      setThesis(d.value, workspaceId.value, card.id)
      cardCount++
    } else if (pyr.thesis && thesisCard.value) {
      reused++
    }
    walk(pyr.thesis.children, undefined)
    store.persist()
    pyramidImportOpen.value = false
    setViewMode('pyramid')
    showToast(`✓ 已导入：分类 ${catCount} · 卡片 ${cardCount}${reused ? `（复用/忽略 ${reused}）` : ''}——已切换到金字塔视图`)
  }

  // ===== R62-5/6/8：金字塔视图逻辑 =====
  /** 节点深度（根=0）——R70：带 visited 显式防环（此前仅靠「parentId 单向链」的假设） */
  // （pyDepthOf 现居宿主树工具域——useCategoryCrud 亦消费）

  /** 金字塔层级数据：按分类深度铺开（深度0=L2）；卡片=直属（排除主题卡，主题卡是 L1 根）
   *  R65-F3：各层节点按树先序（DFS）排序——同父节点严格紧邻，兄弟顺序跟随父节点位置 */
  const pyramidLevels = computed<PyNode[][]>(() => {
    const byDepth = new Map<number, PyNode[]>()
    for (const c of wsCats.value) {
      const depth = pyDepthOf(c)
      if (!byDepth.has(depth)) byDepth.set(depth, [])
      byDepth.get(depth)!.push({ cat: c, depth, cards: [] })
    }
    // R65-F3：树先序遍历序号（同父紧邻的依据）
    const dfsOrder = new Map<string, number>()
    let seq = 0
    const seenDfs = new Set<string>()  // R70：防环
    const walk = (pid: string) => {
      for (const c of (pid ? (catIdx.value.childrenOf.get(pid) || []) : catIdx.value.roots)) {
        if (seenDfs.has(c.id)) continue
        seenDfs.add(c.id)
        dfsOrder.set(c.id, seq++)
        walk(c.id)
      }
    }
    walk('')
    for (const arr of byDepth.values()) arr.sort((a, b) => (dfsOrder.get(a.cat.id) ?? 0) - (dfsOrder.get(b.cat.id) ?? 0))
    // R71：先建「分类 id → 节点」表，卡片一次遍历即可归位（此前每张卡都要逐层 arr.find，O(卡数×分类数)）
    const nodeByCat = new Map<string, PyNode>()
    for (const arr of byDepth.values()) for (const n of arr) nodeByCat.set(n.cat.id, n)
    for (const r of allResources.value) {
      if (r.isThesis) continue
      nodeByCat.get(r.categoryId || "")?.cards.push(r)
    }
    return [...byDepth.keys()].sort((a, b) => a - b).map(k => byDepth.get(k)!)
  })
  /** R66-F5：居中树布局——叶子节点各占 1 列（树先序），父节点跨「其子组全部列」：
   *  父模块横向恒等于子组横向并居中悬于其上；子组永不跨入其他父节点的横向空间（列独占）；
   *  宽度自适应（列宽 minmax(170px,250px)），整体不占满横向空间。 */
  const pyLayout = computed<{ cols: number; cells: { cat: Category; depth: number; colStart: number; colSpan: number; cards: ResourceCard[] }[] }>(() => {
    // R98（W7）：层级折叠——超过 maxDepth 的节点不再下钻（按叶子布点）。在布局层收口而非渲染层
    // v-if 隐藏：父节点的 colSpan 只跨**可见**子组的列，折叠后居中树几何仍然自洽（不会留下空跨列）。
    const maxDepth = pyFold.value === 'l2' ? 0 : pyFold.value === 'l3' ? 1 : Number.POSITIVE_INFINITY
    const cardsBy = new Map<string, ResourceCard[]>()
    for (const r of allResources.value) {
      if (r.isThesis) continue
      const arr = cardsBy.get(r.categoryId || "") || []
      arr.push(r)
      cardsBy.set(r.categoryId || "", arr)
    }
    const cells: { cat: Category; depth: number; colStart: number; colSpan: number; cards: ResourceCard[] }[] = []
    let leafSeq = 0
    /** R70：visited——环状树不得让后序布点无限递归 */
    const placed = new Set<string>()
    /** 后序布点：叶子占新列；父节点跨其子组全部列（列独占，兄弟子树互不侵入） */
    const placeCat = (cat: Category, depth: number): { start: number; span: number } => {
      placed.add(cat.id)
      // R98（W7）：到达折叠深度 → 按叶子收口（子树不入列，父节点自身直属卡照常呈现）
      const kids = depth >= maxDepth ? [] : (catIdx.value.childrenOf.get(cat.id) || []).filter(x => !placed.has(x.id))
      if (!kids.length) {
        const col = leafSeq++
        cells.push({ cat, depth, colStart: col, colSpan: 1, cards: cardsBy.get(cat.id) || [] })
        return { start: col, span: 1 }
      }
      let start = Infinity
      let end = -1
      for (const k of kids) {
        const sub = placeCat(k, depth + 1)
        start = Math.min(start, sub.start)
        end = Math.max(end, sub.start + sub.span - 1)
      }
      const span = end - start + 1
      cells.push({ cat, depth, colStart: start, colSpan: span, cards: cardsBy.get(cat.id) || [] })
      return { start, span }
    }
    for (const root of catIdx.value.roots) placeCat(root, 0)
    // R70：环内节点无根可达，此前被静默忽略——分类与其卡会从金字塔里凭空消失（数据静默丢失）。
    // 补一轮纳入布局，保证「树里有多少节点，金字塔里就渲染多少节点」。
    for (const c of wsCats.value) { if (!placed.has(c.id)) placeCat(c, 0) }
    return { cols: Math.max(leafSeq, 1), cells }
  })
  /** 同级顺序调整（⟨ 前移 / ⟩ 后移） */
  function moveCatSibling(cat: Category, dir: -1 | 1) {
    const pid = cat.parentId || ''
    const sibs = wsCats.value.filter(c => (c.parentId || '') === pid).sort((a, b) => a.order - b.order)
    const i = sibs.findIndex(c => c.id === cat.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sibs.length) return
    const tmp = sibs[i]!; sibs[i] = sibs[j]!; sibs[j] = tmp
    sibs.forEach((c, k) => { c.order = k })
    store.persist()
  }

  // ===== R65-F3：节点关联资源卡（资源台全量卡选择器 → 镜像到节点）=====
  const linkCardsModal = ref<{ catId: string; catName: string; picked: Set<string> } | null>(null)
  const linkCardsQ = ref('')
  /** R126（诉求 3）：资源台分类过滤（含子分类；__uncat__ = 未分类） */
  const linkCardsCat = ref('')
  const linkCatOptions = computed<{ id: string; label: string }[]>(() => {
    const cats = (d.value.categories || []).filter(c => c.workspaceId === CURATION_WS_ID && !(c as { deletedAt?: number }).deletedAt)
    const out: { id: string; label: string }[] = []
    for (const root of cats.filter(c => !c.parentId)) {
      out.push({ id: root.id, label: root.name })
      for (const ch of cats.filter(c => c.parentId === root.id)) out.push({ id: ch.id, label: '　└ ' + ch.name })
    }
    return out
  })
  function openLinkCards(cat: Category) {
    linkCardsQ.value = ''
    linkCardsCat.value = ''
    linkCardsModal.value = { catId: cat.id, catName: cat.name, picked: new Set() }
  }
  function toggleLinkPick(id: string) {
    const m = linkCardsModal.value
    if (!m) return
    if (m.picked.has(id)) m.picked.delete(id)
    else m.picked.add(id)
  }
  /** 弹窗候选的**共同底座**：资源卡池在册卡 + 分类过滤。
   *  关键词只影响**可见列表**，不进底座——与检索面板同一条纪律：AI 的候选不该被"字面没命中"提前砍掉，
   *  否则"换个说法也能召回"这个功能本身就白做了。 */
  const linkBase = computed<{ r: ResourceCard; mirrored: boolean }[]>(() => {
    if (!linkCardsModal.value) return []
    const mirroredSet = new Set((d.value.curationProjections || [])
      .filter(p => p.kind === 'card' && p.targetWsId === workspaceId.value).map(p => p.cardId))
    const catSel = linkCardsCat.value
    const catIds = catSel && catSel !== '__uncat__'
      ? new Set<string>([catSel, ...(d.value.categories || []).filter(c => c.parentId === catSel).map(c => c.id)])
      : null
    // R129-B3：「未分类」与资源台待分类同判据——无分类 **或** 分类已删/失效（悬空卡不隐身）
    const curCatIds = new Set((d.value.categories || [])
      .filter(c => c.workspaceId === CURATION_WS_ID && !(c as { deletedAt?: number }).deletedAt).map(c => c.id))
    return d.value.resources
      .filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
      .filter(r => !catSel || (catSel === '__uncat__' ? (!r.categoryId || !curCatIds.has(r.categoryId)) : catIds!.has(r.categoryId || '')))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
      .map(r => ({ r, mirrored: mirroredSet.has(r.id) }))
  })
  /** 候选 = 底座 + 关键词过滤（关键词为空时即底座全量） */
  const linkCandidates = computed<{ r: ResourceCard; mirrored: boolean }[]>(() => {
    const q = linkCardsQ.value.trim().toLowerCase()
    if (!q) return linkBase.value
    return linkBase.value.filter(c => (c.r.title + ' ' + (c.r.link || '')).toLowerCase().includes(q))
  })
  function confirmLinkCards() {
    const m = linkCardsModal.value
    if (!m) return
    const targets = [...m.picked].filter(id => !linkCandidates.value.find(c => c.r.id === id)?.mirrored)
    if (!targets.length) { showToast('未选择可镜像的资源卡'); return }
    let ok = 0
    for (const id of targets) {
      if (projectCardToBoard(d.value, id, workspaceId.value, m.catId)) ok++
    }
    store.persist()
    linkCardsModal.value = null
    showToast(ok ? `📡 已镜像 ${ok} 张资源卡到「${m.catName}」` : 'ℹ 所选卡片均已在该台镜像中')
  }

  // ===== R161-④：关联资源卡弹窗里的 AI 检索 =====
  // 与检索面板（GlobalPopups）**同源**：同一个 semanticSearch、同一条「只读不写库」纪律、
  // 同一套「全字段投料 + 只投链接地址不抓正文」口径（R161-③）；差别只在候选池固定为「资源台可镜像卡」。
  const linkAiBusy = ref(false)
  const linkAiHits = ref<Record<string, { why: string; weak: boolean }>>({})
  const linkAiNote = ref('')
  const linkAiScope = ref('')
  const linkAiFed = ref({ scanned: 0, total: 0 })
  const linkAiTook = ref(0)
  let linkAiCtl: AbortController | null = null
  const linkAiOn = computed(() => Object.keys(linkAiHits.value).length > 0)
  function linkAiReset(): void {
    linkAiHits.value = {}; linkAiNote.value = ''; linkAiScope.value = ''
    linkAiFed.value = { scanned: 0, total: 0 }; linkAiTook.value = 0
  }
  /** R161-③ 同口径：卡片自定义字段折成一行文本（链接只投地址本身，不抓网页内容） */
  function linkAiFieldText(card: ResourceCard): string {
    const cf = card.customFields
    if (!cf) return ''
    const parts: string[] = []
    for (const k of Object.keys(cf)) {
      const v = cf[k]
      if (v == null || v === '') continue
      parts.push(`${k}:${String(v).replace(/\s+/g, ' ')}`)
      if (parts.join(' ').length >= 120) break
    }
    return parts.join(' ').slice(0, 120)
  }
  /** 跑动态（供按钮文案用）：与检索面板一样不许假装有进度 */
  const linkAiProgress = computed(() => (linkAiBusy.value ? '检索中…' : 'AI 检索'))
  async function linkAiRun(): Promise<void> {
    if (linkAiBusy.value) { linkAiCtl?.abort(); return }
    const q = linkCardsQ.value.trim()
    if (!q) { showToast('先在关键词框里写下你要找什么（一句话就行），再点 AI 检索'); return }
    const pool = linkBase.value
    if (pool.length < 2) { showToast('资源卡池里可镜像的卡太少（不足 2 张），先去池里多攒几张再来'); return }
    const catName = (id?: string) => d.value.categories.find(c => c.id === id)?.name || ''
    const cands = pool.map(c => ({
      id: c.r.id, type: 'res', title: c.r.title, ws: POOL_DISPLAY_NAME, cat: catName(c.r.categoryId),
      summary: c.r.description, tags: c.r.tags, callCount: c.r.callCount, updatedAt: c.r.updatedAt,
      fields: linkAiFieldText(c.r), link: c.r.link || undefined,
    }))
    linkAiBusy.value = true
    const ctl = new AbortController(); linkAiCtl = ctl
    const t0 = Date.now()
    try {
      // AI 栈全程懒引（与检索面板一致：绝不静态 import '@/shared/ai/'）
      const [{ loadAiConfig, aiReady, aiConfig }, { semanticSearch }] = await Promise.all([
        import('@/shared/ai/config'), import('@/shared/ai/select'),
      ])
      await loadAiConfig()
      if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
      const out = await semanticSearch(q, cands, aiConfig.value.depth, { signal: ctl.signal })
      linkAiTook.value = Date.now() - t0
      linkAiFed.value = { scanned: out.scanned, total: out.total }
      linkAiNote.value = out.note || ''
      linkAiScope.value = out.scope || ''
      const map: Record<string, { why: string; weak: boolean }> = {}
      for (const h of out.hits) map[h.id] = { why: h.why || '', weak: !!h.weak }
      linkAiHits.value = map
      showToast(out.hits.length ? `✓ AI 挑出 ${out.hits.length} 条（看了 ${out.scanned}/${out.total} 张）` : 'AI 认为这批候选里没有贴合的——换个说法再问')
    } catch (e) {
      linkAiReset()
      if ((e as Error).name === 'AbortError') { showToast('已取消 AI 检索（未采用任何结果）'); return }
      showToast('⚠ AI 检索失败：' + ((e as Error).message || String(e)).slice(0, 80))
    } finally { if (linkAiCtl === ctl) linkAiCtl = null; linkAiBusy.value = false }
  }
  /** 关键词 / 分类 / 开关弹窗一换，AI 结果就指着不相干的卡了——与检索面板同一条纪律：立刻清 */
  watch([linkCardsQ, linkCardsCat, linkCardsModal], () => { linkAiCtl?.abort(); linkAiReset() })
  /** 展示列表：有 AI 结果 → 命中置顶；**字面没命中的命中卡也要补进来**（否则召回等于没做） */
  const linkShowList = computed(() => {
    const base = linkCandidates.value
    if (!linkAiOn.value) return base
    const rank = new Map(Object.keys(linkAiHits.value).map((id, i) => [id, i]))
    const seen = new Set(base.map(c => c.r.id))
    const extra = linkBase.value.filter(c => rank.has(c.r.id) && !seen.has(c.r.id))
    return [...base, ...extra].sort((a, b) => {
      const ra = rank.has(a.r.id) ? rank.get(a.r.id)! : 1e9
      const rb = rank.has(b.r.id) ? rank.get(b.r.id)! : 1e9
      if (ra !== rb) return ra - rb
      return Number(b.r.pinned) - Number(a.r.pinned) || b.r.updatedAt - a.r.updatedAt
    })
  })
  /** 命中的卡即使当前不可镜像（已在该台）也不该藏起来——用户有权知道"AI 认为该台需要这张" */
  function linkAiHitOf(id: string): { why: string; weak: boolean } | null {
    return linkAiHits.value[id] || null
  }

  // ===== R64-F11：金字塔 SVG 结构连线（根→L2、父节点→子节点，贝塞尔细线） =====
  const pyWrapRef = ref<HTMLElement | null>(null)

  // ===== R110-FS → R113-N5（T10）：金字塔真全屏（宿主上移 .pyramid → .ws-page） =====
  /** 全屏中（真全屏或降级覆盖层） */
  const pyFs = ref(false)
  /** true = 走 CSS fixed 覆盖层（requestFullscreen 不存在或被拒时） */
  const pyFsFallback = ref(false)
  /** R113-N5：全屏宿主 = Workspace 根节点——工具条 / 弹窗 / 抽屉全部纳入全屏子树 */
  const wsPageRef = ref<HTMLElement | null>(null)
  // R129-B6：卸载标记——enterPyFullscreen 在 await 之后若组件已销毁（切台/keep-alive 淘汰），
  // 不能再把已脱离文档的宿主交给 setOverlayFsHost（残留引用 + 浮层渲染到死节点）
  let pyDisposed = false
  async function enterPyFullscreen() {
    const el = wsPageRef.value
    if (!el) return
    if (typeof el.requestFullscreen === 'function') {
      try {
        await el.requestFullscreen()
        if (pyDisposed) return
        pyFs.value = true
        pyFsFallback.value = false
        setOverlayFsHost(el)
        nextTick(drawPyLinks)
        return
      } catch { /* 老浏览器 / 策略拒绝 → 落到降级路线 */ }
    }
    pyFsFallback.value = true
    pyFs.value = true
    setOverlayFsHost(el)
    nextTick(drawPyLinks)
  }
  function exitPyFullscreen() {
    setOverlayFsHost(null)
    if (pyFsFallback.value) { pyFsFallback.value = false; pyFs.value = false; nextTick(drawPyLinks); return }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => { pyFs.value = false })
    else { pyFs.value = false; nextTick(drawPyLinks) }
  }
  function togglePyFullscreen() { pyFs.value ? exitPyFullscreen() : void enterPyFullscreen() }
  /** 真全屏下 ESC 由浏览器接管，只在状态变化时同步本组件的 pyFs（不手动拦 ESC） */
  function onPyFsChange() {
    const on = !!document.fullscreenElement
    if (!on) { pyFs.value = false; pyFsFallback.value = false; setOverlayFsHost(null) }
    else setOverlayFsHost(wsPageRef.value)
    nextTick(drawPyLinks)
  }
  /** 降级覆盖层下自行监听 ESC + 锁定背景滚动 */
  function onPyFsKeydown(e: KeyboardEvent) { if (e.key === 'Escape' && pyFsFallback.value) exitPyFullscreen() }
  onMounted(() => {
    document.addEventListener('fullscreenchange', onPyFsChange)
    document.addEventListener('keydown', onPyFsKeydown)
  })
  onUnmounted(() => {
    pyDisposed = true
    document.removeEventListener('fullscreenchange', onPyFsChange)
    document.removeEventListener('keydown', onPyFsKeydown)
    // R129-B6：卸载时若 resize 节流的尾随计时器仍在排队，clear 掉——否则 150ms 后
    // drawPyLinks 会对已销毁组件的 ref 全量重算
    if (pyLinksTimer) { clearTimeout(pyLinksTimer); pyLinksTimer = null }
  })
  /** 全屏中切走金字塔视图 / 切台 → 退出全屏（否则全屏元素被 v-if 卸载，浏览器层会残留黑屏） */
  watch([viewMode, workspaceId], () => { if (pyFs.value) exitPyFullscreen() })

  const pyLinkPaths = ref<string[]>([])
  function drawPyLinks() {
    const wrap = pyWrapRef.value
    if (!wrap || viewMode.value !== 'pyramid') { pyLinkPaths.value = []; return }
    // R66-F5：横向滚动时连线画布覆盖全部滚动区（CSS 不再定宽，由 JS 设定）
    const svgEl = wrap.querySelector('svg.py-links-svg')
    if (svgEl) { svgEl.setAttribute('width', String(wrap.scrollWidth)); svgEl.setAttribute('height', String(wrap.scrollHeight)) }
    const wr = wrap.getBoundingClientRect()
    const anchor = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - wr.left + r.width / 2, top: r.top - wr.top, bottom: r.bottom - wr.top }
    }
    const link = (a: { x: number; bottom: number }, b: { x: number; top: number }) => {
      // R66-F5：横平竖直直角折线（父底中点 ↓ 横移 ↑/↓ 子顶中点），替代贝塞尔曲线
      const mid = (a.bottom + b.top) / 2
      return `M ${a.x} ${a.bottom} L ${a.x} ${mid} L ${b.x} ${mid} L ${b.x} ${b.top}`
    }
    const lines: string[] = []
    const allNodes = [...wrap.querySelectorAll('[data-pyid]')] as HTMLElement[]
    // R114-59：每节点只读一次 rect（原先同一节点最多读 2 次）；分类用 Map 反查
    // （原先根级 filter 回调里逐节点 wsCats.find，O(节点×分类)——profile 实测该函数单体 505ms，交互窗口最大热点）
    const anchors = new Map<string, { x: number; top: number; bottom: number }>()
    for (const el of allNodes) {
      const r = el.getBoundingClientRect()
      anchors.set(el.dataset.pyid!, { x: r.left - wr.left + r.width / 2, top: r.top - wr.top, bottom: r.bottom - wr.top })
    }
    const catById = new Map(wsCats.value.map(c => [c.id, c]))
    const rootEl = wrap.querySelector('.py-root-card, .py-root-empty')
    if (rootEl) {
      const rc = anchor(rootEl)
      for (const el of allNodes) {
        const cat = catById.get(el.dataset.pyid!)
        if (cat && !cat.parentId) lines.push(link(rc, anchors.get(el.dataset.pyid!)!))
      }
    }
    for (const c of wsCats.value) {
      if (!c.parentId) continue
      const pe = anchors.get(c.parentId); const ce = anchors.get(c.id)
      if (!pe || !ce) continue
      lines.push(link(pe, ce))
    }
    pyLinkPaths.value = lines
  }
  watch([pyLayout, viewMode, thesisCard], () => nextTick(drawPyLinks))
  // R65-F7：resize 重绘节流（150ms 尾随，防拖拽窗口时高频全量重算）
  let pyLinksTimer: ReturnType<typeof setTimeout> | null = null
  function pyLinksThrottled() {
    if (pyLinksTimer) return
    pyLinksTimer = setTimeout(() => { pyLinksTimer = null; drawPyLinks() }, 150)
  }

  // 节点拖拽状态（卡片走 dragState.card；分类走 dragState.cat）
  const pyDropTarget = ref('')
  const pyDropMode = ref<'' | 'child' | 'before' | 'after'>('')
  const pyRootDrop = ref(false)
  function onPyDragOver(e: DragEvent, cat: Category) {
    if (dragState.card && !dragState.cat) {
      // 卡片拖入：整节点高亮为归属落点
      pyDropTarget.value = cat.id; pyDropMode.value = 'child'
      return
    }
    if (!dragState.cat || dragState.cat === cat.id) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    pyDropMode.value = y > rect.height * 0.75 ? 'before' : 'child'
    pyDropTarget.value = cat.id
  }
  function onPyDrop(e: DragEvent, cat: Category) {
    e.preventDefault(); e.stopPropagation()
    const targetId = pyDropTarget.value; const mode = pyDropMode.value
    pyDropTarget.value = ''; pyDropMode.value = ''
    // ① 卡片落节点 = 改归属（canMountInNode 校验：金字塔节点只挂资源卡）
    if (dragState.card && !dragState.cat) {
      if (!canMountInNode(dragState.card)) { showToast('⚠ 金字塔节点只允许挂资源卡'); return }
      if (isMirrorView(dragState.card)) { moveMirrorTo(dragState.card, cat.id) }
      else {
        dragState.card.categoryId = cat.id
        dragState.card.updatedAt = Date.now()
        store.persist()
        showToast(`✓ 已挂入「${cat.name}」`)
      }
      dragState.card = null
      clearCardDropTarget()
      return
    }
    // ② 分类落节点：上沿=同级排序，其余=挂子级（成环 + 层级校验）
    const draggedId = dragState.cat
    onCatDragEnd()
    if (!draggedId || draggedId === targetId) return
    const dragged = wsCats.value.find(c => c.id === draggedId)
    const target = wsCats.value.find(c => c.id === targetId)
    if (!dragged || !target) return
    if (childIds(dragged.id).includes(target.id)) { showToast('不能移动到自己的子分类'); return }
    if (mode === 'before') {
      moveCatSibling(target, 1) // 空出目标位
      dragged.parentId = target.parentId || undefined
      const sibs = wsCats.value.filter(c => (c.parentId || '') === (target.parentId || '') && c.id !== draggedId).sort((a, b) => a.order - b.order)
      const ti = sibs.findIndex(c => c.id === targetId)
      sibs.splice(Math.max(0, ti), 0, dragged)
      sibs.forEach((c, i) => { c.order = i })
      store.persist()
      return
    }
    if (pyLevelOf(target) + pyHeightOf(dragged) > 4) {
      showToast(`ℹ 最多 4 级——「${dragged.name}」（含 ${pyHeightOf(dragged) - 1} 层子级）放入后将超出层级上限`)
      return
    }
    dragged.parentId = target.id
    dragged.pinned = undefined
    dragged.order = wsCats.value.filter(c => c.parentId === target.id).length - 1
    normalizeCatOrders('')
    store.persist()
    showToast(`✓ 「${dragged.name}」已挂入「${target.name}」`)
  }
  function onPyRootDragOver() {
    if (!dragState.cat) return
    pyRootDrop.value = true
  }
  /** 根区落点：分类升为一级；卡片拖到根 = 提示（主题卡唯一，不收卡） */
  function onPyRootDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation()
    pyRootDrop.value = false
    if (dragState.card && !dragState.cat) { showToast('🏛 中心论点位不收卡——请拖到具体节点'); dragState.card = null; return }
    const draggedId = dragState.cat
    onCatDragEnd()
    if (!draggedId) return
    const dragged = wsCats.value.find(c => c.id === draggedId)
    if (!dragged || !dragged.parentId) return
    dragged.parentId = undefined
    dragged.order = catIdx.value.roots.length
    normalizeCatOrders('')
    store.persist()
    showToast(`✓ 「${dragged.name}」已升为一级节点`)
  }
  /** 金字塔节点点击定位：与左侧树联动（选中 + 闪节点） */
  function selectPyNode(cat: Category) {
    activeCategory.value = cat.id
    catFlashId.value = cat.id
    setTimeout(() => { if (catFlashId.value === cat.id) catFlashId.value = null }, 1600)
  }

  // ===== R62-6：节点菜单（⋯ 6 项） =====
  const nodeMenu = ref<{ open: boolean; x: number; y: number; catId: string }>({ open: false, x: 0, y: 0, catId: '' })
  function openNodeMenu(e: MouseEvent, cat: Category) {
    nodeMenu.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 240), catId: cat.id }
  }
  function nmCat(): Category | null { return wsCats.value.find(c => c.id === nodeMenu.value.catId) || null }
  function nmCreateChild() {
    const cat = nmCat(); nodeMenu.value.open = false
    if (cat) openCreateCat(cat.id)
  }
  function nmCreateSibling() {
    const cat = nmCat(); nodeMenu.value.open = false
    if (cat) openCreateCat(cat.parentId || '')
  }
  function nmPack() {
    const cat = nmCat(); nodeMenu.value.open = false
    packIntoNode(cat || undefined)
  }
  function nmRename() {
    const cat = nmCat(); nodeMenu.value.open = false
    if (cat) startCatRename(cat)
  }
  async function nmDelete() {
    const cat = nmCat(); nodeMenu.value.open = false
    if (cat) await deleteCategory(cat)
  }
  /** R62-6：打包所选卡片成节点（batchBar / 节点菜单共用；入参节点 = 挂其下，否则建一级） */
  function packIntoNode(parentCat?: Category) {
    const natives = selectedCards().filter(r => !isMirrorView(r))
    if (!selectedIds.value.size) { showToast('请先开启「☑ 批量管理」选择卡片'); return }
    if (!natives.length) { showToast('📡 所选均为镜像卡——镜像只是引用，打包请在它的源卡上做'); return }
    const mirrorNote = selectedIds.value.size - natives.length
    openInputModal(parentCat ? `🗂 新节点（挂「${parentCat.name}」下）` : '🗂 新节点（一级）', '', (name) => {
      if (parentCat && pyLevelOf(parentCat) + 1 > 4) { showToast('ℹ 最多 4 级——该节点已处于最深层'); return }
      const siblings = wsCats.value.filter(c => (c.parentId || '') === (parentCat?.id || ''))
      const cat: Category = { id: uid('cat'), workspaceId: workspaceId.value, name, order: siblings.length, parentId: parentCat?.id || undefined }
      d.value.categories.push(cat)
      natives.forEach(r => { r.categoryId = cat.id; r.updatedAt = Date.now() })
      store.persist()
      selectedIds.value.clear()
      showToast(`✓ 已打包 ${natives.length} 张卡入「${name}」${mirrorNote ? `（${mirrorNote} 张镜像卡未移动）` : ''}`)
    })
  }

  return {
    pyramidImportOpen, confirmPyramidImport,
    pyramidLevels, pyLayout, moveCatSibling,
    linkCardsModal, linkCardsQ, linkCardsCat, linkCatOptions, openLinkCards, toggleLinkPick, linkCandidates, confirmLinkCards,
    linkAiBusy, linkAiHits, linkAiNote, linkAiScope, linkAiFed, linkAiTook, linkAiOn, linkAiProgress, linkAiRun, linkShowList, linkAiHitOf,
    pyWrapRef, pyFs, pyFsFallback, wsPageRef,
    enterPyFullscreen, exitPyFullscreen, togglePyFullscreen,
    pyLinkPaths, drawPyLinks, pyLinksThrottled,
    pyDropTarget, pyDropMode, pyRootDrop, onPyDragOver, onPyDrop, onPyRootDragOver, onPyRootDrop,
    selectPyNode,
    nodeMenu, openNodeMenu, nmCreateChild, nmCreateSibling, nmPack, nmRename, nmDelete,
    packIntoNode,
  }
}
