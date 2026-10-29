import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted, shallowRef, defineAsyncComponent } from 'vue'
import { showToast } from '@/shared/components/toast'
import { CURATION_WS_ID } from '@/shared/models'
import { recordResourceOpen, recordCardOpen, recordWorkspaceOpen } from '@/shared/storage/stats'
import { toOpenableUrl, toOpenableRawLink, openExternalLink, linkPlaceholderFor } from '@/shared/utils/link'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
import { softDeleteTaskToTrash } from '@/shared/utils/taskLinks'
import type { useGlobalPopups, SearchResult } from './useGlobalPopups'

export function useGlobalPopupsRows(deps: Pick<ReturnType<typeof useGlobalPopups>, 'searchQuery' | 'flatList' | 'runAiEntry' | 'recordSearch' | 'd' | 'store' | 'closeAll' | 'router' | 'currentType' | 'selIndex' | 'syncIdFromIndex' | 'searchQueryRaw' | 'setSearchQuery' | 'typeLabel' | 'resultsEl' | 'selectedId' | 'syncIndexFromId' | 'convertMenuId' | 'convertToResource' | 'convertToTask'>): {
  escapeHtmlTitle: (t: string) => string
  hlTitle: (title: string) => string
  runFlat: (index: number) => void
  runFlatLocator: (index: number) => void
  openLinkOrLocate: (item: SearchResult) => void
  locateOnly: (item: SearchResult) => void
  runSearch: () => void
  setType: (t: 'task' | 'res' | 'curio' | 'all' | 'ws' | 'proj') => void
  clearFilter: () => void
  onSearchKeydown: (e: KeyboardEvent) => void
  scrollToSelected: () => void
  pickRow: (item: SearchResult, ev?: MouseEvent) => void
  selectHover: (item: SearchResult) => void
  lastOpenId: string
  lastOpenTs: number
  openItem: (item: SearchResult) => void
  openResLink: (item: SearchResult) => void
  editItem: (item: SearchResult) => void
  isStarred: (item: SearchResult) => boolean
  toggleStar: (item: SearchResult) => void
  deleteItem: (item: SearchResult) => Promise<void>
  toggleConvertMenu: (id: string) => void
  convertCurio: (item: SearchResult, target: 'task' | 'res') => void
} {
  const { searchQuery, flatList, runAiEntry, recordSearch, d, store, closeAll, router, currentType, selIndex, syncIdFromIndex, searchQueryRaw, setSearchQuery, typeLabel, resultsEl, selectedId, syncIndexFromId, convertMenuId, convertToResource, convertToTask } = deps
function escapeHtmlTitle(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function hlTitle(title: string): string {
  const q = searchQuery.value.trim()
  if (!q) return escapeHtmlTitle(title)
  // R70：先在**原始标题**上定位，再对切片分别转义。
  // 此前是「先整体转义、再按原始查询长度切分」——转义会把 & 变成 &amp;（长度变化），
  // 于是标题 AT&T 搜 & 时切片落到实体中间，渲染出 AT&amp;T（用户看到字面量）。
  const i = title.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return escapeHtmlTitle(title)
  return escapeHtmlTitle(title.slice(0, i))
    + '<mark class="gp-hl">' + escapeHtmlTitle(title.slice(i, i + q.length)) + '</mark>'
    + escapeHtmlTitle(title.slice(i + q.length))
}
function runFlat(index: number) {
  // R120 键位统一：单击 / Enter —— 打开卡片链接（无链接则定位到卡片所在处）
  const it = flatList.value[index]
  if (!it) return
  if (it.kind === 'ai') { runAiEntry(it.entry); return }
  if (it.kind === 'qa') { it.qa.run(); return }
  if (it.kind === 'tgl') { it.tg.run(); return }
  openLinkOrLocate(it.item)
}

function runFlatLocator(index: number) {
  // R120 键位统一：Ctrl+Enter —— **仅定位到卡片所在处**（不再打开详情抽屉）
  const it = flatList.value[index]
  if (!it) return
  if (it.kind === 'ai') { runAiEntry(it.entry); return }
  if (it.kind === 'qa') { it.qa.run(); return }
  if (it.kind === 'tgl') { it.tg.run(); return }
  locateOnly(it.item)
}

/** R120 键位统一 + W5 扩展：单击 / Enter —— 打开卡片链接优先（res/task/curio 三类卡都有链接字段了）；
    无链接/不可打开则定位到卡片所在处（proj/ws 走既有打开语义） */
function openLinkOrLocate(item: SearchResult) {
  recordSearch(searchQuery.value) // R161-②：这次检索被用出去了，记账
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    if (toOpenableUrl(r.linkType, r.link)) { openResLink(item); return }
    openItem(item)
    return
  }
  if (item.type === 'task') {
    const t = item.raw as TaskCard
    const url = toOpenableRawLink(t.link)
    if (url) {
      recordCardOpen(d.value, t)
      store.persistHot()
      openExternalLink(url)
      closeAll()
      return
    }
    openItem(item)
    return
  }
  if (item.type === 'curio') {
    const c = item.raw as CuriosityCard
    const url = toOpenableRawLink(c.sourceUrl)
    if (url) {
      recordCardOpen(d.value, c)
      store.persistHot()
      openExternalLink(url)
      closeAll()
      return
    }
    openItem(item)
    return
  }
  // proj / ws：无"外链"概念，走既有打开语义
  openItem(item)
}

/** R120 键位统一：Ctrl+Enter —— 仅定位到卡片所在处（资源卡带所在分类；不开详情抽屉） */
function locateOnly(item: SearchResult) {
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    /* R2-④（本轮）：池卡的居所是调度台「资源卡池」这张卡——`/workspace/zy-curation` 自 R179
       资源台退役后恒落 Workspace.vue「策展台不存在」死页（R1.5 拍 theme-audit 时已实证该 id 用户不可达），
       所以定位改靶到首页 + `?hk=res`（CompassHome 的 watch 负责切到池 tab，PoolCardsPanel 负责高亮滚动）。
       台内原生卡（论点卡等 workspaceId≠池 id）仍走策展台深链，那条路是通的。 */
    if (r.workspaceId === CURATION_WS_ID) {
      router.push({ path: '/deck/resource', query: { hl: item.id, hk: 'res' } })
      closeAll()
      showToast('已定位到资源卡池')
      return
    }
    const query: Record<string, string> = { hl: item.id, hk: 'res' }
    if (r.categoryId) query.cat = r.categoryId
    router.push({ path: `/workspace/${r.workspaceId}`, query })
    closeAll()
    showToast('已定位到卡片所在处')
    return
  }
  if (item.type === 'task') {
    router.push({ path: '/deck/task', query: { hl: item.id, hk: 'task' } })
    closeAll()
    showToast('已定位到任务卡片')
    return
  }
  if (item.type === 'curio') {
    router.push({ path: '/deck/curiosity', query: { hl: item.id, hk: 'curio' } })
    closeAll()
    showToast('已定位到好奇心卡片')
    return
  }
  // ws / proj：打开目标页即视为"定位到所在处"
  openItem(item)
}

function runSearch() { /* reactive, no-op */ }
function setType(t: 'all'|'res'|'task'|'curio'|'ws'|'proj') { currentType.value = t }
function clearFilter() { currentType.value = 'all' }

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); selIndex.value = Math.min(selIndex.value+1, flatList.value.length-1); syncIdFromIndex(); scrollToSelected() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selIndex.value = Math.max(selIndex.value-1, 0); syncIdFromIndex(); scrollToSelected() }
  else if (e.key === 'Enter') {
    e.preventDefault()
    if (selIndex.value < 0 || selIndex.value >= flatList.value.length) return
    // R120 键位统一：Enter = 打开卡片链接（无链接则定位）；Ctrl+Enter = 仅定位到卡片所在处
    if (e.ctrlKey || e.metaKey) runFlatLocator(selIndex.value)
    else runFlat(selIndex.value)
  }
  else if (e.key === 'Tab') {
    // B29：Tab 过滤类型——输入「任务/资源/好奇/全部」+ Tab 直达对应类型；否则四类循环切换。
    // 关键词被视为指令（消费掉），普通关键词保留；chip 与类型 Tab 行高亮同步更新
    e.preventDefault()
    const q = searchQueryRaw.value.trim()
    const kw = ([['任务', 'task'], ['资源', 'res'], ['好奇心', 'curio'], ['好奇', 'curio'], ['策展台', 'ws'], ['工作台', 'ws'], ['项目', 'proj'], ['全部', 'all']] as const).find(([k]) => k === q)
    if (kw) { currentType.value = kw[1]; setSearchQuery('') }
    else {
      const cycle: Array<'all'|'res'|'task'|'curio'|'ws'|'proj'> = ['all', 'res', 'task', 'curio', 'ws', 'proj']
      currentType.value = cycle[(cycle.indexOf(currentType.value) + 1) % cycle.length]
    }
    selIndex.value = 0
    showToast('' + typeLabel(currentType.value))
  }
  else if (e.key === 'Escape') { closeAll() }
}

function scrollToSelected() {
  nextTick(() => {
    const el = resultsEl.value?.querySelector('.gp-result-item.selected') as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  })
}

/**
 * R60-1：点击搜索结果 —— 直接以「结果对象」为准，彻底绕开下标。
 * 原实现 `openItem(filteredResults.value[i])`，模板传入的 i = grp.offset+j，
 * 而 offset 是按类型分组累计的，与排序后的混合列表下标并不对应 → 点 A 开 B。
 * R120 键位统一：单击 = 打开卡片链接（无链接则定位）；双击不单独定义（300ms 去重保证不双开）。
 */
function pickRow(item: SearchResult, ev?: MouseEvent) {
  selectedId.value = item.id
  syncIndexFromId()
  // R152：把键盘约定平移到鼠标——Ctrl/⌘+单击 = 只定位（与 Ctrl+Enter 同义），单击/Enter 仍是打开
  if (ev && (ev.ctrlKey || ev.metaKey)) { locateOnly(item); return }
  openLinkOrLocate(item)
}
/** R60-1：hover 只改高亮不开卡，同样以 id 为准（保证 Enter 打开的与高亮的是同一条） */
function selectHover(item: SearchResult) {
  if (selectedId.value === item.id && selIndex.value >= 0) return
  selectedId.value = item.id
  syncIndexFromId()
}

// 第卅七轮 REQ-045：300ms 同项去重——单击/双击都走 openItem，避免双击双开
let lastOpenId = ''
let lastOpenTs = 0
function openItem(item: SearchResult) {
  const now = Date.now()
  if (item?.id && item.id === lastOpenId && now - lastOpenTs < 300) return
  if (item?.id) { lastOpenId = item.id; lastOpenTs = now }
  if (item.type === 'ws') {
    // 第卅二轮 REQ-008：策展台条目 → 直接打开对应策展台
    recordWorkspaceOpen(d.value, d.value.workspaces.find(w => w.id === item.id))
    // R173-T3：同上——台热度走热度键小载荷，不重写整库
    store.persistHot()
    router.push(`/workspace/${item.id}`)
    closeAll()
    return
  }
  if (item.type === 'proj') {
    // R49-G：项目条目 → 直达项目详情（二级页）
    router.push({ path: '/compass/projects', query: { p: item.id } })
    closeAll()
    showToast('↗ 已打开项目详情')
    return
  }
  if (item.type === 'res') {
    const r = item.raw as ResourceCard
    /* V3.7.0（R179）资源台退役 → R2-④ 定位改靶：无链接的资源卡不再只回一句「已回调度台」的
       空话，而是与 Ctrl+Enter 同一条定位链路（池卡落「资源卡池」并高亮该卡）。
       外开仍走行内「↗ 打开链接」（openResLink），不改 R120 三键契约。 */
    if (r.link && !toOpenableUrl(r.linkType, r.link)) showToast('本地文件缺少完整路径 · 先定位到卡')
    locateOnly(item)
    return
  }
  if (item.type === 'task') {
    recordCardOpen(d.value, d.value.tasks.find(t => t.id === item.id))
    store.persistHot()
    // R117（04-61 B）：hk 显式分派——调度台同时挂着任务卡与好奇心卡两个 hl 消费者
    router.push({ path: '/deck/task', query: { hl: item.id, hk: 'task' } })
    showToast('↗ 已定位到任务卡片')
  } else {
    recordCardOpen(d.value, d.value.curiosities.find(c => c.id === item.id))
    store.persistHot()
    router.push({ path: '/deck/curiosity', query: { hl: item.id, hk: 'curio' } })
    showToast('↗ 已定位到好奇心卡片')
  }
  closeAll()
}

/**
 * R117（04-61 B）：搜索结果行内「↗ 打开链接」——把旧默认行为（外开）显式化为按钮。
 * 无链接/链接不可打开时降级为定位（等价单击）。
 */
function openResLink(item: SearchResult) {
  const r = item.raw as ResourceCard
  const url = toOpenableUrl(r.linkType, r.link)
  if (!url) { openItem(item); return }
  recordResourceOpen(d.value, r)
  store.persistHot()
  openExternalLink(url)
  closeAll()
}

function editItem(item: SearchResult) {
  showToast('编辑功能（开发中）')
}

/** 第卅三轮 REQ-019/020：搜索结果行星标切换（点亮持久化，置顶>星标>命中度） */
function isStarred(item: SearchResult): boolean {
  return !!(item.raw as AnyCard).starred
}
function toggleStar(item: SearchResult) {
  const card = item.raw as AnyCard
  card.starred = !card.starred
  card.updatedAt = Date.now()
  store.persist()
  showToast(card.starred ? '已星标，搜索时优先展示' : '已取消星标')
}

async function deleteItem(item: SearchResult) {
  // R55-H1：检索结果删除免二次确认（软删，可撤销 / 回收站恢复）
  // R146（回退契约）：① 任务改走 softDeleteTaskToTrash——原裸赋值 deletedAt 不摘 metric.taskIds，
  //   破坏 R141 的双向不变量；② 回执点名 + 给撤销（原只有一句"可在回收站恢复"，既不知删了哪张，
  //   也没有回收站的路）。
  const raw = item.raw as ResourceCard | TaskCard | CuriosityCard
  const name = ('title' in raw ? (raw as ResourceCard).title : (raw as CuriosityCard).question) || '未命名'
  if (item.type === 'task') softDeleteTaskToTrash(store.data!, raw as TaskCard)
  else raw.deletedAt = Date.now()
  store.persist()
  showToast(`已删除「${name.slice(0, 16)}」· 回收站可恢复`, { label: '撤销', cb: () => {
    if (!raw.deletedAt) return
    raw.deletedAt = undefined
    if (item.type === 'task') {
      const t = raw as TaskCard
      if (t.metricId) for (const dir of store.data!.compass.directions) for (const p of dir.projects) for (const m of p.metrics)
        if (m.id === t.metricId && !m.taskIds.includes(t.id)) m.taskIds.push(t.id)
    }
    store.persist()
    showToast('已撤销删除')
  } })
}

function toggleConvertMenu(id: string) {
  convertMenuId.value = convertMenuId.value === id ? null : id
}

function convertCurio(item: SearchResult, target: 'res'|'task') {
  const c = item.raw as CuriosityCard
  /**
   * R4-Dk：两个出口都接回唯一实现 `useCuriosity`（此前面板自己手搓一份卡）。改前四处偏差：
   *  ① 落点写 `d.value.workspaces[0]?.id`——存量库里那枚恰好是 zy-curation，默认库里第一枚是
   *    「事业策展台」（defaults.ts），所以同一个动作在两种库形状下落进完全不同的台；池才是新卡默认居所（R2-⑧）。
   *  ② 「查看」直推 `/workspace/${r.workspaceId}`：池 id 自 R179 起恒落 Workspace「策展台不存在」死页。
   *    R2-④ 清这族死链时判据是**路由字面量扫描**，变量拼法它看不见——本行就是漏网的那一个入口。
   *  ③ 手搓的卡只带 title：标签/附件/星标/置顶/自定义字段整片丢，任务还不按好奇心状态映射。
   *  ④ 不写 convertedAt/convertedTo ⇒ 池头部「已转化」计数与 CuriosityPanel 那条路对不上同一个动作。
   */
  if (target === 'res') {
    const r = convertToResource(c, CURATION_WS_ID, '')
    closeAll()
    showToast('已转化为资源卡，存入资源卡池', { label: '查看', cb: () => {
      // 与 locateOnly 同一改靶口径：池卡的居所是调度台「资源卡池」，不是策展台深链
      router.push({ path: '/deck/resource', query: { hl: r.id, hk: 'res' } })
    } })
    return
  }
  const t = convertToTask(c)
  closeAll()
  showToast('已转化为任务，前往任务调度', { label: '查看', cb: () => router.push({ path: '/deck/task', query: { hl: t.id, hk: 'task' } }) })
}

  return {
    escapeHtmlTitle, hlTitle, runFlat, runFlatLocator, openLinkOrLocate, locateOnly, runSearch, setType, clearFilter, onSearchKeydown, scrollToSelected, pickRow, selectHover, lastOpenId, lastOpenTs, openItem, openResLink, editItem, isStarred, toggleStar, deleteItem, toggleConvertMenu, convertCurio,
  }
}
