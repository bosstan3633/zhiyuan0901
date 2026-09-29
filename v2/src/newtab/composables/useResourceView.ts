/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 资源视图域 composable——视图模式 / 排序 / 筛选 / 搜索 / 分组分区 / 增量渲染 / 看板列。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 * 依赖经由 ctx 注入（与 useCategoryCrud / useWorkspaceBatch 同一接线范式）。
 */
import { ref, computed, watch, nextTick, onMounted, onActivated, onUnmounted } from 'vue'
import type { ComputedRef } from 'vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import { useCardCols, CARD_COLS_DEFAULT } from '@/shared/utils/cardCols'
import { readWsView, writeWsView } from '@/shared/utils/wsView'
import { linkStateOf } from '@/shared/utils/link'
import { markRank } from '@/shared/utils/marksort'
import { buildBucketIndex, type CatIndex } from '@/shared/utils/catIndex'
import type { curationMetrics } from '@/shared/storage/hub'
import type { AppData, ResourceCard, Category, UIPrefs } from '@/shared/models'

/** R115：宿主 Pinia store 的结构子集（结构性兼容，避免索引签名不匹配） */
export interface WsStore { ui: UIPrefs | null; persist(): void; /** R148-P0b：只落热度统计（不重写整库）；R173-T2：immediate 跳过防抖（页隐藏补写用） */ persistHot?(immediate?: boolean): void }

export interface ResourceGroup { key: string; title: string; count: number; /** R122：含全部子分类的合计（原型「直属 N · 含 M 个子分类共 K」） */ total: number; items: ResourceCard[]; depth: number }

export interface ResourceViewCtx {
  store: WsStore
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  allResources: ComputedRef<ResourceCard[]>
  /** R122：指标条数据源（hub.curationMetrics）——由宿主传入，宿主与其他域共用同一实例 */
  metrics: ComputedRef<ReturnType<typeof curationMetrics>>
  thesisCard: ComputedRef<ResourceCard | null>
  categories: ComputedRef<Category[]>
  wsCats: ComputedRef<Category[]>
  catIdx: ComputedRef<CatIndex<Category>>
  resBucket: ComputedRef<Map<string, ResourceCard[]>>
  rootCats: ComputedRef<Category[]>
  childCatsOf: (pid: string) => Category[]
  familyIds: (catId: string) => string[]
  isUncat: (r: ResourceCard, validIds: { has(id: string): boolean }) => boolean
}

export function useResourceView(ctx: ResourceViewCtx) {
  const { store, d, workspaceId, allResources, metrics, thesisCard, categories, wsCats, catIdx, resBucket, rootCats, childCatsOf, familyIds, isUncat } = ctx

  // ===== 视图状态 =====
  /**
   * R84（W2-②）：视图模式改为**按台记忆**并持久化。
   * - 改前 `ref('card')` 纯内存 ⇒ 切台/重开都回到卡片视图，原文"用户切过视图后记忆其选择"无从谈起。
   * - 现在：① 该台已存偏好 → 用它；② 无偏好 → **已设中心论点 ⇒ 金字塔，否则卡片**。
   * - ⚠ 不复用 UIPrefs.viewMode（全局死字段、且不含 pyramid）；用 UIPrefs.wsViewMode[<台 id>]。
   */
  const viewMode = ref<'card'|'list'|'kanban'|'pyramid'>('card')
  function applyWsView() {
    const saved = readWsView(store.ui, workspaceId.value)
    viewMode.value = saved || (thesisCard.value ? 'pyramid' : 'card')
  }
  function setViewMode(m: 'card'|'list'|'kanban'|'pyramid') {
    viewMode.value = m
    writeWsView(store.ui, workspaceId.value, m)
  }
  // R84（W2-②）：切台时重算视图偏好——不同台各有各的选择，不能把 A 台的金字塔串到 B 台
  watch(workspaceId, () => nextTick(applyWsView))
  /** R98（W7）：金字塔层级折叠——`仅 L2 / 到 L3 / 全部`。**本地视图态，不进 UIPrefs**（视图态
   *  持久化会造成「每次打开都被折叠」，与 D-B 拍板同口径）；同一组件跨台复用，折叠态跟随会话。 */
  const pyFold = ref<'l2' | 'l3' | 'all'>('all')
  // R72：卡片视图横向列数（4/5/6/7，记忆 UIPrefs.cardCols.res；网格模板由 --grid-cols 驱动）
  // V3.7.0（R179）：各策展台同一组件同一网格 ⇒ 共用 'res' 键，列数跨台一致
  const resCols = useCardCols('res', store.ui)
  /** R87（R5-①）：排序档位白名单——sortPrefs.res.by 是持久化字段，防止未来退役档位后读到死值卡住 UI */
  const SORT_BY_KEYS = ['manual', 'recent', 'visited', 'hot', 'title']
  /** R87（R5-②）：筛选档位白名单（4 类型 + 4 状态）；筛选是临时视图态，**不进 UIPrefs**——
   *  持久化会造成「下次打开发现卡少了」的困惑，与既有行为一致 */
  // R89（W5）：加 starred（⭐ 星标）——W5 的另两项 hot 排序与 hasAssets 筛选已在 R87 顺带交付
  // （R16 收敛后资源台与策展台同为同一工具条，R5 与 W5 是同一份实现）
  const FILTER_KEYS = ['all', 'url', 'file', 'obsidian', 'hasLink', 'brokenPath', 'hasAssets', 'starred', 'hot']
  const sortBy = ref('manual')
  // 第卅二轮 REQ-007：时间排序方向（默认倒序）+ 排序偏好本地记忆（UIPrefs.sortPrefs.res）
  const sortDir = ref<'asc' | 'desc'>((store.ui?.sortPrefs?.res?.dir === 'asc') ? 'asc' : 'desc')
  const filterBy = ref('all')
  const searchQuery = ref('')
  // REQ-031 P-031-5：应用内搜索 150ms 防抖——输入框即时回显，过滤计算延迟触发（快速键入不卡顿）
  const debouncedQuery = ref('')
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, (v) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => { debouncedQuery.value = v }, 150)
  })
  // R129-B6：卸载时清掉排队中的防抖尾写（组件销毁后不再改 ref）
  onUnmounted(() => { if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null } })
  const activeCategory = ref('all')

  if (store.ui?.sortPrefs?.res?.by && SORT_BY_KEYS.includes(store.ui.sortPrefs.res.by)) sortBy.value = store.ui.sortPrefs.res.by
  watch([sortBy, sortDir], () => {
    const sp = { ...(store.ui?.sortPrefs || {}), res: { by: sortBy.value, dir: sortDir.value } }
    if (store.ui) store.ui.sortPrefs = sp
    saveUIPrefs({ sortPrefs: sp })
  })
  function toggleSortDir() { sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc' }

  // 第卅三轮 REQ-026：密度档位（compact/cozy，记忆 UIPrefs.density，html[data-density] 驱动 tokens 变量）
  const density = computed({
    get: () => store.ui?.density || 'cozy',
    set: (v: 'compact' | 'cozy') => {
      if (store.ui) store.ui.density = v
      saveUIPrefs({ density: v })
      if (v === 'compact') document.documentElement.setAttribute('data-density', 'compact')
      else document.documentElement.removeAttribute('data-density')
    }
  })

  const activeCategoryLabel = computed(() => {
    if (activeCategory.value === 'all') return '全部'
    if (activeCategory.value === 'uncat') return '待分类'
    return categories.value.find(c => c.id === activeCategory.value)?.name || '分组'
  })

  /** R87（R5 收尾）：当前是否有生效的过滤（类型/状态筛选 或 搜索词）——空态据此换文案与动作 */
  const hasActiveFilter = computed(() => filterBy.value !== 'all' || !!debouncedQuery.value.trim())
  const FILTER_LABELS: Record<string, string> = {
    all: '全部', url: 'URL链接', file: '本地文件', obsidian: 'Obsidian',
    hasLink: '有链接', brokenPath: '⚠ 待补全路径', hasAssets: '有附件', starred: '⭐ 星标', hot: '高频调用 🔥'
  }
  const filterLabel = computed(() => FILTER_LABELS[filterBy.value] || '全部')

  // ===== R89（R6）：搜索判据 =====
  /**
   * 解析查询串：`#前端 #待读 关键词` → `{ tags:['前端','待读'], kw:'关键词' }`。
   * 单个 `#`（长度 1）不算标签，回落为普通词，避免边输入边筛选。
   */
  function parseQuery(raw: string): { tags: string[]; kw: string } {
    const tags: string[] = []
    const rest: string[] = []
    for (const tok of (raw || '').trim().split(/\s+/)) {
      if (!tok) continue
      if (tok.length > 1 && tok.startsWith('#')) tags.push(tok.slice(1).toLowerCase())
      else rest.push(tok.toLowerCase())
    }
    return { tags, kw: rest.join(' ') }
  }
  /**
   * 卡片是否命中查询（三视图共用——它们都走 filteredResources）。
   * - `#标签`：**全部命中才算**（取交集）。"直筛"是收窄，不是扩大。
   * - 普通词：标题 / 描述 / 标签 / **自定义字段值**。
   *   ⚠ 自定义字段此前能在卡片上显示（`fieldValue` 的 `custom_` 分支）却搜不到——R6 要补的就是这一处。
   */
  function matchCard(r: ResourceCard, p: { tags: string[]; kw: string }): boolean {
    const cardTags = (Array.isArray(r.tags) ? r.tags : []).map(t => t.toLowerCase())
    for (const t of p.tags) {
      if (cardTags.includes(t)) continue
      if (cardTags.some(c => c.split('/').pop() === t)) continue
      return false
    }
    if (!p.kw) return true
    if (r.title.toLowerCase().includes(p.kw)) return true
    if ((r.description || '').toLowerCase().includes(p.kw)) return true
    if (cardTags.some(t => t.includes(p.kw))) return true
    // R105（W10）：链接文本纳入搜索（title + link + description + tags 统一口径，与浮层 res blob 同源；
    // 拍板 2026-09-12：W10 的「link 是否纳入」按提案原文纳入）
    if ((r.link || '').toLowerCase().includes(p.kw)) return true
    for (const v of Object.values(r.customFields || {})) {
      if (v != null && String(v).toLowerCase().includes(p.kw)) return true
    }
    return false
  }
  function resetFilters() {
    filterBy.value = 'all'
    searchQuery.value = ''
    debouncedQuery.value = ''
  }

  /** 排序档位的中文标签（生效值徽标与气泡共用；与 SORT_BY_KEYS 同序） */
  const SORT_LABELS: Record<string, string> = {
    manual: '手动拖拽', recent: '最近添加', visited: '最近访问', hot: '调用最多', title: '标题 A-Z'
  }
  /**
   * 当前**非默认**的视图设置（W3 的「生效值徽标」）。
   * 全默认时返回空数组 ⇒ 按钮上不挂任何 chip（没有筛选时不喧哗）。
   */
  const filterSummary = computed<string[]>(() => {
    const out: string[] = []
    if (sortBy.value !== 'manual') out.push(SORT_LABELS[sortBy.value] || sortBy.value)
    if (filterBy.value !== 'all') out.push(filterLabel.value)
    if (density.value !== 'cozy') out.push('紧凑')
    // 列数只在卡片视图出现，非卡片视图时不该算作"生效中"
    if (viewMode.value === 'card' && resCols.value !== CARD_COLS_DEFAULT.res) out.push(resCols.value + ' 列')
    return out
  })
  /** 徽标挤不下时的兜底：hover 给出全部生效值 */
  const filterPopTitle = computed(() => filterSummary.value.length
    ? '当前生效：' + filterSummary.value.join(' · ') + '（点击展开筛选面板）'
    : '排序 · 类型筛选 · 密度 · 列数（点击展开筛选面板）')
  /** 气泡底部的「重置全部」：四项回默认，并清空搜索 */
  function resetAllFilters() {
    sortBy.value = 'manual'
    filterBy.value = 'all'
    density.value = 'cozy'
    resCols.value = CARD_COLS_DEFAULT.res
    resetFilters()
  }
  /** R87（R7）：链接三态的卡片级封装——三视图徽标、筛选、双击 toast 共用同一个判据 */
  function isBrokenPath(r: ResourceCard): boolean {
    return linkStateOf(r.linkType, r.link) === 'incomplete'
  }
  /** R87（R5-②）：8 档筛选谓词表。类型四档沿用 linkType 直判（保留既有持久化值），状态四档为语义谓词 */
  const FILTER_PREDICATES: Record<string, (r: ResourceCard) => boolean> = {
    url: (r) => r.linkType === 'url',
    file: (r) => r.linkType === 'file',
    obsidian: (r) => r.linkType === 'obsidian',
    hasLink: (r) => linkStateOf(r.linkType, r.link) !== 'none',
    brokenPath: (r) => isBrokenPath(r),
    hasAssets: (r) => (r.assets?.length || 0) > 0,
    starred: (r) => !!r.starred,
    // R122：高频调用筛档（原型「高频调用 🔥」）——口径拍板 callCount ≥ 3
    hot: (r) => (r.callCount || 0) >= 3
  }

  // 筛选（第八轮：点击父分类 = 聚合显示本级 + 全部子分类）
  /** R110-LC（T3）：统一视图过滤管线（分类 → 筛选器 → 搜索），归档提示与默认列表复用同一口径 */
  function applyViewFilters(list: ResourceCard[]): ResourceCard[] {
    let out = list
    // R129-B3：待分类判据与左树计数（uncategorizedCount）、分组（resourceGroups 的 uncat 桶）
    // 合一流派——统一走 isUncat（无分类 **或** 分类已失效）。此前这里用严格 !r.categoryId，
    // 悬空卡（categoryId 指向已删分类）被侧栏计入「待分类」却在点进去时消失。
    if (activeCategory.value === 'uncat') out = out.filter(r => isUncat(r, catIdx.value.byId))
    else if (activeCategory.value !== 'all') {
      // R112 性能：`ids.includes()` 在 filter 内是 O(卡数 × 家族规模)，改为 Set.has 的 O(卡数)
      const ids = new Set(familyIds(activeCategory.value))
      out = out.filter(r => r.categoryId && ids.has(r.categoryId))
    }
    const pred = FILTER_PREDICATES[filterBy.value]
    if (pred) out = out.filter(pred)
    // R89（R6）：搜索判据收敛到 parseQuery + matchCard 一处（自定义字段纳入、`#标签` 直筛）
    if (debouncedQuery.value.trim()) {
      const p = parseQuery(debouncedQuery.value)
      out = out.filter(r => matchCard(r, p))
    }
    return out
  }
  const filteredResources = computed(() => applyViewFilters(allResources.value).filter(r => !r.lifecycleArchived))
  /** R110-LC（T3）：归档卡从默认视图消失，「另有 N 张已归档卡片」降级提示（按当前检索口径命中数） */
  const archivedHintCount = computed(() => applyViewFilters(allResources.value.filter(r => r.lifecycleArchived)).length)

  // 排序（第卅二轮 REQ-007：时间类排序支持正/倒序方向）
  function applySort(list: ResourceCard[]): ResourceCard[] {
    const out = [...list]
    const dirMul = sortDir.value === 'asc' ? 1 : -1
    // R56-V1：手动（默认）态 = 拖拽序优先（curOrder），无拖拽序的最新在前
    if (sortBy.value === 'manual') {
      const hasDrag = out.some(r => r.curOrder != null)
      if (!hasDrag) { out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return out }
      out.sort((a, b) => (a.curOrder ?? 999999) - (b.curOrder ?? 999999))
      return out
    }
    if (sortBy.value === 'recent') out.sort((a,b) => dirMul * ((a.createdAt||0) - (b.createdAt||0)))
    else if (sortBy.value === 'visited') out.sort((a,b) => dirMul * ((a.lastCalledAt||0) - (b.lastCalledAt||0)))
    // R87（R5-①）：调用最多 —— callCount 降序，同热度用最近调用时间兜底（避免零热度段次序随机）
    else if (sortBy.value === 'hot') out.sort((a,b) => ((b.callCount||0) - (a.callCount||0)) || ((b.lastCalledAt||0) - (a.lastCalledAt||0)))
    else if (sortBy.value === 'title') out.sort((a,b) => a.title.localeCompare(b.title, 'zh-CN'))
    return out
  }

  // REQ-028 F-028-1：分组视图分区内置顶排序——先按当前排序规则，再按 marksort 权重稳定重排（置顶>星标>普通）
  function applyGroupSort(list: ResourceCard[]): ResourceCard[] {
    const sorted = applySort(list)
    // 稳定排序：同权重保持 applySort 相对序（manual 保持拖拽序）
    return sorted.sort((a, b) => markRank(b) - markRank(a))
  }

  // 全量可见列表（批量全选 / 空状态共用）
  const sortedResources = computed(() => applySort(filteredResources.value))

  // ===== REQ-027：卡片/列表视图取消全平铺，按分类分组分区 =====
  /** F-027-4 折叠增强：点击分组标题折叠/展开（内存态，不持久化） */
  const collapsedGroups = ref<Set<string>>(new Set())
  function toggleGroupCollapse(key: string) {
    const s = new Set(collapsedGroups.value)
    if (s.has(key)) s.delete(key); else s.add(key)
    collapsedGroups.value = s
  }
  /**
   * 分区规则（R64-F9 树状递归分组：子分类不再混入父组平铺，逐级下钻、depth 缩进呈现层级）：
   * - 「全部」：按左树顺序逐分类 walk——直属卡一组（组标题=分类名），子分类递归（depth+1）；
   *   无分类卡归「待分类」分区置于最前
   * - 选中父分类：直属卡一组，其下子分类递归
   * 分区内按当前排序规则排列（applyGroupSort；manual 保持数组序=手动拖拽序）。
   */
  const resourceGroups = computed<ResourceGroup[]>(() => {
    const filtered = filteredResources.value
    const groups: ResourceGroup[] = []
    const validIds = catIdx.value.byId
    /** R71：先按分类分桶一次，后续所有「某分类的卡」都是 O(1) 取用——
     *  此前每个节点都要对 filtered 全量 filter（O(节点数×卡数)），并对每个子节点再扫一遍判空 */
    const bucket = buildBucketIndex(filtered, (r) => r.categoryId || '')
    const uncat = applyGroupSort(filtered.filter(r => isUncat(r, validIds)))
    if (uncat.length) groups.push({ key: 'uncat', title: '待分类', count: uncat.length, total: uncat.length, items: uncat, depth: 0 })
    /** 子树内是否有卡（含直属）——查分桶，空分支不生成组 */
    const subtreeHasCards = (catId: string) => {
      for (const id of catIdx.value.family(catId)) if ((bucket.get(id) || []).length) return true
      return false
    }
    const seenGroup = new Set<string>()  // R70：防环
    const walk = (catId: string, name: string, depth: number) => {
      if (seenGroup.has(catId)) return
      seenGroup.add(catId)
      const direct = applyGroupSort(bucket.get(catId) || [])
      // R122：合计=家族内全部（直属 + 子分类），供「直属 N · 含 M 个子分类共 K」文案
      const total = Array.from(catIdx.value.family(catId)).reduce((sum, id) => sum + (bucket.get(id) || []).length, 0)
      if (direct.length) groups.push({ key: catId, title: name, count: direct.length, total, items: direct, depth })
      for (const sub of childCatsOf(catId)) {
        if (subtreeHasCards(sub.id)) walk(sub.id, sub.name, depth + 1)
      }
    }
    if (activeCategory.value === 'all') {
      for (const root of rootCats.value) {
        if (subtreeHasCards(root.id)) walk(root.id, root.name, 0)
      }
    } else if (activeCategory.value !== 'uncat') {
      const sel = wsCats.value.find(c => c.id === activeCategory.value)
      if (sel) walk(sel.id, sel.name, 0)
    }
    return groups
  })
  /**
   * R112 性能（P0）：**增量渲染**。
   * CPU profile 实测：切台/搜索窗口内 Vue `track`（依赖收集）占 19~21%、proxy `get` 占 9.6%，
   * 叠加 `insertBefore`/`createElement`/`setElementText` 与 GC —— 瓶颈是「一次渲染数百张卡 DOM ×
   * 每卡十余次响应式读取」，而非算法本身。`.res-card` 虽已有 `content-visibility:auto`（R55-F4，
   * 跳过屏外卡的 layout/paint），但 **Vue 仍会为全部卡片创建 VNode/DOM 并逐卡读取响应式值**。
   * 故：数据与分组保持全量不变，仅「已渲染份额」按需递增——滚动到接近底部再追加一屏。
   * （等轻量虚拟滚动收益，但不破坏拖拽/分组/选中的既有结构。）
   */
  const RENDER_STEP = 32
  const renderLimit = ref(RENDER_STEP)
  const totalVisibleCount = computed(() => resourceGroups.value.reduce((s, g) => s + g.items.length, 0))
  const renderedGroups = computed<ResourceGroup[]>(() => {
    const groups = resourceGroups.value
    if (renderLimit.value >= totalVisibleCount.value) return groups
    const out: ResourceGroup[] = []
    let budget = renderLimit.value
    for (const g of groups) {
      if (budget <= 0) break
      if (g.items.length <= budget) { out.push(g); budget -= g.items.length }
      else { out.push({ ...g, items: g.items.slice(0, budget) }); budget = 0 }
    }
    return out
  })
  const renderedCount = computed(() => renderedGroups.value.reduce((s, g) => s + g.items.length, 0))
  const hasMoreToRender = computed(() => renderedCount.value < totalVisibleCount.value)
  /** 资源区滚动容器（.ws-content）滚到距底 400px 内时追加一屏 */
  function onContentScroll(e: Event) {
    if (!hasMoreToRender.value) return
    const el = e.target as HTMLElement
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) renderLimit.value += RENDER_STEP
  }
  /** 「加载更多」按钮（滚动监听之外的显式入口，保证键盘/小程序场景可达） */
  function renderMore() { if (hasMoreToRender.value) renderLimit.value += RENDER_STEP }
  /**
   * R117（04-61 B）：**定位前置**——R112/R116 之后卡片/列表/看板都是增量渲染，
   * 目标卡可能不在已渲染集里，`scrollIntoView` 找不到节点 ⇒ 定位**静默失败**。
   * 本方法把渲染预算抬到足以容纳目标卡，并展开其所在分组；返回 false = 该卡不在当前视图
   * （被筛选/不在当前台），调用方应给出提示而不是"看起来什么都没发生"。
   */
  function ensureCardRendered(id: string): boolean {
    let hit = -1
    let seen = 0
    let hitCard: ResourceCard | null = null
    for (const g of resourceGroups.value) {
      const i = g.items.findIndex(r => r.id === id)
      if (i >= 0) { hit = seen + i + 1; hitCard = g.items[i] ?? null; break }
      seen += g.items.length
    }
    if (hit < 0) return false
    if (hit > renderLimit.value) renderLimit.value = Math.min(totalVisibleCount.value, hit + RENDER_STEP)
    // 看板：抬升目标所在列的列内限额（与列体滚动追加同一入口）。
    // R173-T1：改按**目标卡的分类 key** 取列——列已窗口化，视口外的列不在 kanbanColumns 里，
    // 按列遍历会漏掉它。
    // R173-T3 收口：列窗口化后目标列若不在窗内 ⇒ 节点根本不渲染。先把窗口滚到目标列
    // （scrollLeft 定位 + 立即重量收敛），并给 kc-card 补 data-rid/flash（模板侧）——
    // R117 时代「看板定位静默落空」到此为止（此前注记的"留给 T3 收口"即此）。
    if (hitCard && viewMode.value === 'kanban') {
      const key = hitCard.categoryId || ''
      const ci = kanbanCategories.value.findIndex(c => c.key === key)
      const wrap = kanbanWrapRef.value
      if (ci >= 0 && wrap && (ci < kanbanFirst.value || ci > kanbanLast.value)) {
        wrap.scrollLeft = Math.max(0, (ci - KANBAN_COL_BUFFER) * KANBAN_COL_PITCH)
        measureKanbanWin(wrap)
      }
      const i = resourcesByCategory(key).findIndex(r => r.id === id)
      if (i >= 0 && i + 1 > kanbanLimitOf(key)) kanbanColLimit.value = { ...kanbanColLimit.value, [key]: i + 1 + KANBAN_COL_STEP }
    }
    // 目标所在分组被折叠时先展开（否则节点不在 DOM 里）
    for (const g of resourceGroups.value) {
      if (g.items.some(r => r.id === id) && collapsedGroups.value.has(g.key)) { toggleGroupCollapse(g.key); break }
    }
    return true
  }
  // 换台 / 换视图 / 换分类 / 改检索词 / 改排序 → 渲染份额复位（否则会带着上个上下文的大份额）
  // R116：看板列限额一并复位
  watch([workspaceId, viewMode, activeCategory, debouncedQuery, sortBy, sortDir], () => { renderLimit.value = RENDER_STEP; kanbanColLimit.value = {} })
  /** R98（W9）：分组标题补「含 N 个子分类」——组内 count 是**直属**口径（walk 只 push 有直属卡的组），
   *  与左树的聚合数不同源；同屏「左树 A 显示 5 / 分组 A 显示 3」会被当成对不上账，须写明。
   *  子分类各自的卡有自己的组（walk 递归）；待分类无子分类。 */
  function groupChildCount(key: string): number {
    if (key === 'uncat') return 0
    return catIdx.value.childrenOf.get(key)?.length || 0
  }

  const kanbanCategories = computed(() => {
    const cats: { key: string; name: string }[] = []
    for (const root of rootCats.value) {
      cats.push({ key: root.id, name: root.name })
      for (const id of catIdx.value.descendants(root.id)) {
        const c = catIdx.value.byId.get(id)
        if (c) cats.push({ key: c.id, name: catIdx.value.pathOf(c.id) })
      }
    }
    cats.push({ key: '', name: '待分类' })
    return cats
  })

  function resourcesByCategory(catId: string) {
    // R56-V1：看板列内与卡片/列表视图同口径——applySort 消费（手动=拖拽序 curOrder 优先，无拖拽序最新在前）
    // R71：改走分桶索引（此前每列一次全量 filter）
    return applySort(resBucket.value.get(catId || '') || [])
  }
  /** R71：看板列（名字 + 计数 + 卡列表）一次算好——模板此前每列把 resourcesByCategory 调两次
   *  （一次计数、一次渲染），等于每列对全量卡 filter+sort 两遍 */
  // R116 性能：看板列**增量渲染**（与 R112 卡片/列表 RENDER_STEP 同构）——large 档看板切换 786ms
  // 的主体是 N 列 × 全量卡一次性挂载。列体滚动近底自动追加 + 列底显式入口；
  // count 恒为全量长度（数据口径不变），切片只影响渲染集 items。
  /** R168：档位 **20 → 6**。原注释只写"每列初始 20 张"，但真实库（资源台 380 卡 / 33 个分类列）下
   *  20 × 33 = 660 ≥ 全量 ⇒ **整台卡一次挂满**：真库实测切到看板 DOM +3520 节点、主线程阻塞 488ms
   *  （长任务 146/82/198/62），是全站最慢的一次交互。降到 6 后首屏约 198 张（真库过半），
   *  其余靠列内滚动或点「显示更多 N 张」续一屏——`onKanbanColScroll` / `kanbanMore` 一字未改，不新增代码路径。 */
  const KANBAN_COL_STEP = 6
  const kanbanColLimit = ref<Record<string, number>>({})
  function kanbanLimitOf(key: string) { return kanbanColLimit.value[key] || KANBAN_COL_STEP }
  function kanbanMore(key: string) {
    const full = resourcesByCategory(key).length
    if (kanbanLimitOf(key) < full) kanbanColLimit.value[key] = kanbanLimitOf(key) + KANBAN_COL_STEP
  }
  /** 列体（.kc-body）滚到距底 60px 内追加一屏（列高固定 260px 窄栏，阈值小于卡片/列表的 400px） */
  function onKanbanColScroll(e: Event, key: string) {
    const el = e.target as HTMLElement
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) kanbanMore(key)
  }
  /** R173-T1：列**窗口化**改视图驱动——R169 立的是「列数 > 60 才裁剪」，而真库是 50 台 / 33 列（48 台资源台），
   *  阈值永不触发、等于没做（R172 实测切看板 +1143 节点 / 阻塞 249ms，仍是全站最慢的同屏切换）。
   *  新口径：只渲染「滚动位置 ± 缓冲」内的列；窗口外两侧渲染**等宽 ghost 占位**（1 节点/列）保住
   *  横向几何与滚动条位置，滚到位即原位换真列。拖拽源列由 setKanbanDragCol 钉住（见下）。 */
  const KANBAN_COL_PITCH = 274   // 列宽 260 + 间距 14（workspace.css `.kanban-col` 宽 / `.kanban` gap）——改版式须同步此数
  const KANBAN_COL_BUFFER = 2    // 视口外两侧各多渲染 2 列（≈548px）：补窗总落后滚动事件一拍，缓冲吸收甩动
  const kanbanWrapRef = ref<HTMLElement | null>(null)
  const kanbanFirst = ref(0)
  const kanbanLast = ref(7)
  // ★空闲哨兵必须是 null 而非 ''：'' 是「待分类」列的**合法 key**（kanbanCategories 末尾 push），
  //   若用 '' 表示空闲，findIndex 会恒命中待分类列，被当成「永远钉着最后一列」——
  //   hi 遂恒 = n-1（窗口右缘永远收不回来），实测表现为「切看板仍是全量 23 列」。
  const kanbanDragKey = ref<string | null>(null)
  /** HTML5 拖拽期间钉住拖拽源列：源节点被摘除后 dragend 可能不触发（dropMark/dragState 残留）。
   *  dragstart 置（可为 '' = 待分类列）、dragend 清 null；窗口外的列会被卸载，故必须显式留住它 */
  function setKanbanDragCol(key: string | null) { kanbanDragKey.value = key }
  /** 量一次视口 → 收敛窗口。容器未布局（宽 0，含 keep-alive 停用期）时不动窗口，交给下一次滚动/缩放/归位再量 */
  function measureKanbanWin(el: HTMLElement) {
    const n = kanbanCategories.value.length
    if (!n || !el.clientWidth) return
    const first = Math.max(0, Math.floor(el.scrollLeft / KANBAN_COL_PITCH) - KANBAN_COL_BUFFER)
    const last = Math.min(n - 1, Math.ceil((el.scrollLeft + el.clientWidth) / KANBAN_COL_PITCH) + KANBAN_COL_BUFFER)
    if (first !== kanbanFirst.value) kanbanFirst.value = first
    if (last !== kanbanLast.value) kanbanLast.value = last
  }
  /** 横向滚动（.kanban）→ 收敛窗口 */
  function onKanbanWinScroll(e: Event) { measureKanbanWin(e.target as HTMLElement) }
  function onKanbanWinResize() { const el = kanbanWrapRef.value; if (el) measureKanbanWin(el) }
  watch(kanbanWrapRef, (el) => { if (el) measureKanbanWin(el) })
  // 视口缩放与 keep-alive 归位都要重量：停用期容器宽 0 量不了，回来时视图可能已变宽
  onMounted(() => window.addEventListener('resize', onKanbanWinResize))
  onActivated(onKanbanWinResize)
  onUnmounted(() => window.removeEventListener('resize', onKanbanWinResize))
  // 换台/换视图后钉住的列作废（列 key 属于上一上下文）
  watch([workspaceId, viewMode], () => { kanbanDragKey.value = null })
  /** 窗口 ∪ 钉住的列 → 渲染区间 [lo, hi]（必须连续：ghost 只补两侧，中间不留洞） */
  const kanbanWinRange = computed(() => {
    const cats = kanbanCategories.value
    const n = cats.length
    const held = kanbanDragKey.value === null ? -1 : cats.findIndex(c => c.key === kanbanDragKey.value)
    return {
      lo: Math.max(0, held >= 0 ? Math.min(kanbanFirst.value, held) : kanbanFirst.value),
      hi: Math.min(Math.max(0, n - 1), held >= 0 ? Math.max(kanbanLast.value, held) : kanbanLast.value),
      n,
    }
  })
  const kanbanColumns = computed(() => {
    const { lo, hi } = kanbanWinRange.value
    const win = kanbanCategories.value.slice(lo, hi + 1)
    return win.map(c => {
      const items = resourcesByCategory(c.key)
      const shown = items.slice(0, kanbanLimitOf(c.key))
      return { key: c.key, name: c.name, items: shown, count: items.length, hiddenCount: items.length - shown.length }
    })
  })
  /** 窗口外两侧的 ghost 占位列数（等宽空壳：透明且无内容，只保几何；滚到即原位换真列） */
  const kanbanGhostL = computed(() => kanbanWinRange.value.lo)
  const kanbanGhostR = computed(() => Math.max(0, kanbanWinRange.value.n - 1 - kanbanWinRange.value.hi))

  // ===== R122（原型）：资源台指标条尾注 + 一级状态快捷筛选 =====
  /** R122（原型）：最近更新时间（今天/昨天显示 HH:mm；更早不显示时间，仅日期由页头 lastUpdateText 承载） */
  const lastUpdateTime = computed(() => {
    const latest = metrics.value.lastUpdatedAt
    if (!latest || Date.now() - latest >= 172800000) return ''
    return new Date(latest).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  })
  /** R122（原型）：附件构成尾注「N图 · NPDF · NHTML」（与下钻抽屉同源 attachmentItems） */
  const assetKindBreakdown = computed(() => {
    const n: Record<string, number> = {}
    for (const it of metrics.value.attachmentItems || []) n[it.kind] = (n[it.kind] || 0) + 1
    return [['image', '图'], ['pdf', 'PDF'], ['html', 'HTML']]
      .filter(([k]) => n[k]).map(([k, l]) => String(n[k]) + l).join(' · ')
  })
  /** R122（原型）：一级状态快捷筛选（与筛选气泡同源 filterBy；其余档位回落显示「全部状态」，
   *  筛选按钮徽标仍如实呈现全部激活条件） */
  const quickFilter = computed({
    get: () => (['hasAssets', 'hot', 'brokenPath'].includes(filterBy.value) ? filterBy.value : 'all'),
    set: (v: string) => { filterBy.value = v }
  })

  return {
    viewMode, applyWsView, setViewMode, pyFold, resCols,
    metrics, lastUpdateTime, assetKindBreakdown, quickFilter,
    SORT_BY_KEYS, SORT_LABELS, FILTER_KEYS, FILTER_LABELS,
    sortBy, sortDir, filterBy, searchQuery, debouncedQuery, activeCategory,
    toggleSortDir, density, activeCategoryLabel,
    hasActiveFilter, filterLabel, parseQuery, matchCard, resetFilters,
    filterSummary, filterPopTitle, resetAllFilters, isBrokenPath, FILTER_PREDICATES,
    applyViewFilters, filteredResources, archivedHintCount,
    applySort, applyGroupSort, sortedResources,
    collapsedGroups, toggleGroupCollapse, resourceGroups,
    RENDER_STEP, renderLimit, totalVisibleCount, renderedGroups, renderedCount, hasMoreToRender,
    onContentScroll, renderMore, ensureCardRendered, groupChildCount,
    kanbanCategories, resourcesByCategory, kanbanColumns,
    KANBAN_COL_STEP, kanbanLimitOf, kanbanMore, onKanbanColScroll,
    kanbanWrapRef, kanbanGhostL, kanbanGhostR, setKanbanDragCol, onKanbanWinScroll,
  }
}

export type ResourceView = ReturnType<typeof useResourceView>
