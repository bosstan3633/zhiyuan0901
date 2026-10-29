/**
 * Content Script · 全局浮层 / 搜索域（自 overlay-impl.ts 拆出，V3.9.23 结构优化）
 *
 * 数据读写与缓存（R128-A1 走仓库）+ 全局搜索浮层（居中 Raycast 式）+ 今日三件事写入。
 * 与宿主 overlay-impl.ts 共同组成同一份浮层运行时（同域、共享模块状态）。
 */
import { matchPinyin, ensurePinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { K } from '@/shared/storage/keys'
import {
  loadData as repoLoadData, getData as repoGetData, saveDataNow as repoSaveNow, subscribe as repoSubscribe
} from '@/shared/storage/repository'
import { CURATION_WS_ID } from '@/shared/models'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { detachTaskFromMetrics } from '@/shared/utils/taskLinks'
import {
  safeSend, uid, ensureRoot, focusWhenReady, openOverlay, closeOverlay, showToast, ROOT_ID
} from './overlay-impl'
import { typeLabel, query0, buildSearchMaps, parseOverlayQuery, linkShort, escapeHtml, openSearchLocator, openSearchResult } from './overlay-query'
import type { SearchMaps } from './overlay-query'

// ============ 数据读写（R128-A1：统一走 repository） ============
/** 仓库缓存即最新树（storage.onChanged 由仓库统一保活），不再自行 get/set 整树 */
async function loadData(): Promise<any> {
  try {
    await repoLoadData()
    return repoGetData()
  } catch { return null }
}
async function saveData(_d?: any) {
  // 入参仍是同一份仓库树引用（历史上各处都是 loadData→改→saveData(d)），落盘以仓库缓存为准，
  // 从而共享 flushCardEvents（WCE 口径）与 JSON 纯净清洗。
  await repoSaveNow()
}
// ============ 数据缓存（B36：搜索/采集每次按键不再重复读 storage） ============
let dataCache: any = null
let dataCacheAt = 0
// R68-F1：已完成项目显隐口径（与方向台 showDoneProjects 同源，读 zy_ui_v2；缺省=显示）
let showDoneProjectsCache = true
async function loadShowDonePref() {
  try {
    const r = await chrome.storage.local.get(K.UI)
    showDoneProjectsCache = (r[K.UI] as any)?.showDoneProjects !== false
  } catch { showDoneProjectsCache = true }
}
/** R68-F1：项目完成口径（对齐 newtab isProjectDone：手动 done/archived 或全部任务完成派生） */
function isProjDone(p: any, d: any): boolean {
  if (p.status === 'done' || p.status === 'archived') return true
  const ts = (d.tasks || []).filter((t: any) => !t.deletedAt && t.projectId === p.id)
  return ts.length > 0 && ts.every((t: any) => t.status === 'done')
}
/**
 * R128-A1：读取入口签名不变，数据源换成仓库缓存——
 * 原「300s TTL + 自挂 onChanged 刷新」退役：仓库 attachStorageSync 已把外部写入合并进同一份缓存，
 * 本页不再有陈旧快照，也不再对整库重复 parse（采集卡顿的正源）。
 * `force` 形参保留（历史语义：绕开 TTL 取最新分类树），现在等价于「确保已加载」。
 */
async function getData(force = false): Promise<any> {
  const d = await loadData()
  dataCache = d
  dataCacheAt = Date.now()
  void loadShowDonePref()
  ;(window as any).__zyDataCache = d
  return d
}
// R68-F1：界面偏好变化（已完成项目显隐）实时生效；数据变化改由仓库统一合并后回调（见下方 repoSubscribe）
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[K.UI]) void loadShowDonePref()
  })
}
// R128-A1：仓库每次落盘 / 外部合并后回调——重指向缓存并失效计数缓存（REQ-031 P-031-3 口径不变）
repoSubscribe((d: any) => {
  dataCache = d
  dataCacheAt = Date.now()
  ;(window as any).__zyDataCache = d
  invalidateCountCache()
})

/** R78（A7）：今日三件事——已入选任务的 sourceId 集合（浮层打开时读取，供结果项置灰去重） */
let todayFocusSourceIds = new Set<string>()
/** R78（A7）：三件事已满时的两段式替换——记录待替换槽位（0..2），关闭浮层即清空 */
let pendingReplaceSlot: number | null = null
/** R78（A7）：三件事槽位硬上限（与 shared/models 的「每天最多 3 个」及 CompassHome.FOCUS_LIMIT 一致） */
const FOCUS_LIMIT = 3
// ============ 选区捕获 ============
// 第廿二轮加固体系已抽到 ./selection：信号层负责注册监听（含子帧转发），
// 浮层实现层只读缓存。这样子帧无需加载本文件即可完成选区捕获。
// ============ 全局搜索浮层（居中 Raycast 式） ============
let searchType: 'all' | 'res' | 'task' | 'curio' | 'ws' | 'proj' = 'all'
let searchSelIndex = 0
/** R60-3：选中项锚点 = 卡片 id。下标会随补跑/重排漂移，id 不会——与 R48-A2 的点击修复统一口径 */
let searchSelId = ''
let searchResults: any[] = []
let lastQuery = ''
/** R97（A9）：高亮词 = 去掉 `#`/`@` 指令后的 kw（runSearch 每次刷新；hl 只吃它） */
let hlKw = ''

async function openSearch() {
  // V2.21：唤起即用——浮层与纯文本搜索立即生效，拼音字典并行后台加载，不阻塞首帧
  void ensurePinyin()
  searchType = 'all'
  searchSelIndex = 0
  searchSelId = ''
  openOverlay('center', closeOverlay)
  const root = ensureRoot()
  const panel = document.createElement('div')
  panel.className = 'zy-panel'
  panel.innerHTML = `
    <div class="zy-search-head">
      <div class="zy-search-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </div>
      <span id="__zy_chip__" class="zy-search-chip" style="display:none"><span id="__zy_chip_label__"></span><span class="zy-chip-x" id="__zy_chip_x__">×</span></span>
      <input id="__zy_si__" type="text" class="zy-search-input" placeholder="搜索全部卡片…" autocomplete="off" spellcheck="false">
      <!-- R92（D2）：按钮**保持直接关闭**（显式点击 = 明确要关），只有键盘 Esc 走两段式 -->
      <button class="zy-esc-btn" id="__zy_esc__" title="关闭浮层（键盘 Esc 会先清空搜索框，空了才关闭）">Esc</button>
    </div>
    <div class="zy-type-tabs" id="__zy_tabs__"></div>
    <div class="zy-results" id="__zy_results__"></div>
    <div class="zy-foot">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>⏎</kbd> 打开</span>
      <span><kbd>→</kbd> 三件事</span>
      <span><kbd>Tab</kbd> 切换类型</span>
      <span><kbd>Esc</kbd> 关闭</span>
      <span class="zy-foot-brand">知源调度台 · 万千可调用，自有我方向</span>
    </div>
  `
  root.appendChild(panel)
  const input = document.getElementById('__zy_si__') as HTMLInputElement
  // R92（D1）：改走 focusWhenReady —— 原 50ms 延迟会让"唤起后立刻打字"的前几个字符丢失
  focusWhenReady(input)
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  input.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => runSearch(input.value), 60) // REQ-046：输入防抖 90→60ms（速度第一）
  })
  input.addEventListener('keydown', onSearchKeydown)
  document.getElementById('__zy_esc__')?.addEventListener('click', closeOverlay)
  document.getElementById('__zy_chip_x__')?.addEventListener('click', () => {
    searchType = 'all'
    searchSelIndex = 0
    renderTypeTabs()
    runSearch(input?.value || '')
  })
  renderTypeTabs()
  runSearch('')
}
/**
 * B29：搜索框前过滤 chip —— 显示当前类型，点 × 复位为「搜全部」。
 *
 * R93（A5）：**chip 只在有输入时出现**。
 * 改前 chip 与下方类型 Tab 行**同时**表达同一个 searchType，屏幕上有两份；
 * 无输入时 Tab 行就在眼前、其 active 态已经说清当前类型，chip 是纯冗余 ⇒ 此时不显示。
 * 有输入时相反：输入框内容长、注意力在框内，chip 紧邻输入框最能说明「当前只看 X」。
 *
 * ⚠ 提案原文是"Tab 行只在有输入时出现、chip 常驻"；本实现**反过来**，
 * 因为无输入时隐藏 Tab 行会砍掉"打开浮层直接点『任务卡』浏览全部任务"这条真实路径
 * （空态只有四个「打开 X 页面」快捷操作 + 近期最常用，没有类型入口）。详见任务书 §2.1。
 */
function updateChip() {
  const chip = document.getElementById('__zy_chip__')
  if (!chip) return
  const label = document.getElementById('__zy_chip_label__')
  chip.style.display = (searchType === 'all' || !lastQuery) ? 'none' : 'inline-flex'
  if (label) label.textContent = typeLabel(searchType)
}

// REQ-031 P-031-3：类型计数缓存——仅数据变更时重算（onChanged 失效），避免每键全量 filter ×5
let countCache: Record<string, number> | null = null
function invalidateCountCache() { countCache = null }
function computeCounts(): Record<string, number> {
  const d = dataCache || (window as any).__zyDataCache
  const c: Record<string, number> = { all: 0, res: 0, task: 0, curio: 0, ws: 0, proj: 0 }
  if (d) {
    for (const r of d.resources || []) if (!r.deletedAt) c.res++
    for (const t of d.tasks || []) if (!t.deletedAt) c.task++
    for (const x of d.curiosities || []) if (!x.deletedAt) c.curio++
    for (const w of d.workspaces || []) if (!w.archived && w.id !== CURATION_WS_ID) c.ws++
    for (const dir of (d.compass && d.compass.directions) || []) for (const p of dir.projects || []) { if (!p.archived && (showDoneProjectsCache || !isProjDone(p, d))) c.proj++ }
    c.all = c.res + c.task + c.curio
  }
  countCache = c
  return c
}
function countByType(type: string): number {
  return (countCache || computeCounts())[type] || 0
}

function renderTypeTabs() {
  const tabs = document.getElementById('__zy_tabs__')
  if (!tabs) return
  // REQ-031 P-031-3：仅 searchType 变化才重建 tab DOM；纯输入只更新计数
  const current = tabs.getAttribute('data-search-type')
  if (current === searchType && tabs.children.length) {
    tabs.querySelectorAll('.zy-type-tab').forEach(el => {
      const cnt = el.querySelector('.cnt')
      if (cnt) cnt.textContent = String(countByType((el as HTMLElement).dataset.type as string))
    })
    updateChip()
    return
  }
  const types = [
    { key: 'all', label: '🔍 搜全部' },
    { key: 'res', label: '📄 资源卡' },
    { key: 'task', label: '✅ 任务卡' },
    { key: 'curio', label: '💡 好奇心' },
    { key: 'ws', label: '🗂 策展台' },
    { key: 'proj', label: '📦 项目' }
  ]
  tabs.setAttribute('data-search-type', searchType)
  tabs.innerHTML = types.map(t => {
    const count = countByType(t.key as any)
    return `<div class="zy-type-tab${searchType === t.key ? ' active' : ''}" data-type="${t.key}">${t.label} <span class="cnt">${count}</span></div>`
  }).join('')
  tabs.querySelectorAll('.zy-type-tab').forEach(el => {
    el.addEventListener('click', () => {
      searchType = (el as HTMLElement).dataset.type as any
      searchSelIndex = 0
      renderTypeTabs()
      renderResults()
    })
  })
  updateChip()
}

async function runSearch(q: string, opts?: { mergeAppend?: boolean }) {
  lastQuery = (q || '').trim()
  hlKw = parseOverlayQuery(lastQuery).kw // R97（A9）：高亮与 ws 树过滤共用去指令后的 kw
  let d: any = null
  try {
    d = await getData()
  } catch (e) { console.error('[知源] 搜索数据读取失败', e) }
  renderTypeTabs()
  const results: any[] = []
  if (!d) { searchResults = []; renderResults(); return }
  try {
    // REQ-031 P-031-1：一次构建关联 Map（ws/cat/project 名称 + 卡数累加），collectResults 内 O(1) 查找
    const maps = buildSearchMaps(d)
    collectResults(d, query0(q), results, maps)
  } catch (e) {
    // B35/B36：任何数据形态异常都不允许搜索区空白
    console.error('[知源] 搜索执行异常', e)
  }
  // R48-A2：拼音补跑走「冻结顺序、仅追加」——已有结果保持原位不重排（用户正在浏览/点击时列表不得跳动），
  // 仅把拼音新命中的条目追加到末尾；普通检索（用户主动输入/切类型）仍全量重算 + 重排。
  if (opts?.mergeAppend && searchResults.length && lastQuery) {
    const keyOf = (x: any) => (x?.type || '') + ':' + String(x?.id || x?.title || '')
    const seen = new Set(searchResults.map(keyOf))
    for (const r of results) {
      if (!seen.has(keyOf(r))) { searchResults.push(r); seen.add(keyOf(r)) }
    }
  } else {
    searchResults = results
    // 第卅三轮 REQ-020：全局检索加权排序（与应用内搜索同口径）—— 置顶 > 星标 > 命中度，稳定排序
    searchResults.sort((a: any, b: any) => {
      const rank = (x: any) => x?.raw ? (x.raw.pinned ? 2 : x.raw.starred ? 1 : 0) : 0
      return rank(b) - rank(a)
    })
  }
  searchSelIndex = Math.min(searchSelIndex < 0 ? 0 : searchSelIndex, Math.max(searchResults.length - 1, -1))
  // R60-3：按 id 恢复选中项——补跑/重排后不再把用户当前选中弹回第一条
  if (searchSelId) {
    const k = searchResults.findIndex((r: any) => String(r?.id || '') === searchSelId)
    if (k >= 0) searchSelIndex = k
  }
  { const cur: any = searchResults[searchSelIndex]; searchSelId = cur ? String(cur.id || '') : '' }
  renderResults()  // V2.21：拼音字典异步加载，未就绪时 matchPinyin 降级为 false（纯文本匹配照常生效）。
  // 字典到位后自动用同一查询词补跑一次，把拼音/首字母命中补进结果——用户无需任何感知。
  armPinyinRefresh()
}

/**
 * 拼音字典就绪后刷新结果（一次性、有守卫）。
 * 仅在「有查询词 + 字典未就绪 + 浮层仍打开」时补跑，避免无谓重算。
 */
let pinyinRefreshArmed = false
function armPinyinRefresh(): void {
  if (pinyinRefreshArmed) return
  if (!lastQuery || isPinyinReady()) return
  pinyinRefreshArmed = true
  onPinyinReady(() => {
    pinyinRefreshArmed = false
    const root = document.getElementById(ROOT_ID)
    if (!root || !root.classList.contains('open')) return
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    if (!input) return
    // R48-A2：mergeAppend —— 补跑只追加拼音新命中，冻结既有顺序，杜绝点击瞬间行序错位
    void runSearch(input.value, { mergeAppend: true })
  })
}
function hl(title: string): string {
  const esc = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // R97（A9）：高亮只吃 kw——`#标签` / `@项目` 是指令，不该在标题里找 "#x" 高亮
  const q = hlKw
  if (!q) return esc
  const i = esc.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return esc
  // R77（A1）：高亮底改用当前主题强调色、文字用主题文字色（原先写死成 linear 主题的那两个色值）
  return esc.slice(0, i) + '<mark class="zy-hl" style="background:color-mix(in srgb, var(--zy-accent) 32%, transparent);color:var(--zy-text);border-radius:3px;">' + esc.slice(i, i + q.length) + '</mark>' + esc.slice(i + q.length)
}
function collectResults(d: any, query: string, results: any[], maps: SearchMaps) {
  const pq = parseOverlayQuery(query)
  const kw = pq.kw
  const match = (text: string) => !kw || text.toLowerCase().includes(kw)
  // R97（A9）：`#标签` 交集判据——卡的 tags 必须包含查询里的每一个标签（小写精确比对，与主应用 matchCard 一致）
  const hasAllTags = (tags: any) => pq.tags.every(t => (Array.isArray(tags) ? tags : []).map((x: any) => String(x).toLowerCase()).includes(t))
  // R97（A9）：`@项目` 收窄判据——按项目名子串命中
  const projHit = (name: any) => !pq.proj || String(name || '').toLowerCase().includes(pq.proj)
  // 第十九轮：拼音/首字母命中（按标题）

  // 资源卡
  if (searchType === 'all' || searchType === 'res') {
    d.resources?.filter((r: any) => !r.deletedAt).forEach((r: any) => {
      if (pq.proj) return // R97（A9）：`@项目` 下资源卡不隶属项目，排除
      const ws = maps.wsName.get(r.workspaceId)
      const cat = maps.catName.get(r.categoryId)
      const blob = r.title + ' ' + (r.description || '') + ' ' + (Array.isArray(r.tags) ? r.tags : []).join(',') + ' ' + (r.link || '')
      if (hasAllTags(r.tags) && (match(blob) || matchPinyin(r.title || '', kw))) {
        results.push({
          type: 'res', iconClass: 'res', iconText: '📄', id: r.id,
          title: r.title, ws: ws || '未知', cat: cat || '待分类',
          badges: [], link: r.link ? { type: r.linkType, text: linkShort(r.link) } : null,
          summary: r.description, raw: r
        })
      }
    })
  }
  // 任务卡
  if (searchType === 'all' || searchType === 'task') {
    d.tasks?.filter((t: any) => !t.deletedAt).forEach((t: any) => {
      const projName = maps.projName.get(t.projectId) || '未归属'
      const badges: any[] = []
      if (t.priority === 'high') badges.push({ type: 'prio-high', text: '🔴 高' })
      else if (t.priority === 'medium') badges.push({ type: 'prio-mid', text: '🟡 中' })
      badges.push({ type: `status-${t.status}`, text: t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始' })
      // R58-B4：命中字段两端同构——任务补标签 + 项目名（与应用内一致）
      const tTags = Array.isArray(t.tags) ? t.tags.join(' ') : ''
      const blob = t.title + ' ' + (t.description || '') + ' ' + tTags + ' ' + projName
      if (hasAllTags(t.tags) && projHit(projName) && (match(blob) || matchPinyin(t.title || '', kw))) {
        const statusIcon = t.status === 'done' ? '✓' : t.status === 'doing' ? '◐' : '○'
        results.push({
          type: 'task', iconClass: `task-${t.status}`, iconText: statusIcon, id: t.id,
          title: t.title, ws: '任务中心', cat: projName, badges, summary: t.description, raw: t
        })
      }
    })
  }
  // 好奇心
  if (searchType === 'all' || searchType === 'curio') {
    d.curiosities?.filter((c: any) => !c.deletedAt).forEach((c: any) => {
      if (pq.proj) return // R97（A9）：好奇心不隶属项目，排除
      const statusText = c.status === 'todo' ? '🔵 待探索' : c.status === 'doing' ? '🟡 探索中' : c.status === 'done' ? '🟢 已求证' : '⚪ 已搁置'
      const cTags = Array.isArray(c.tags) ? c.tags.join(' ') : ''
      if (hasAllTags(c.tags) && (match(c.question + ' ' + cTags) || matchPinyin(c.question || '', kw))) {
        results.push({
          type: 'curio', iconClass: 'curio', iconText: '💡', id: c.id,
          title: c.question, ws: '调度台', cat: '好奇心',
          badges: [{ type: 'curio-status', text: statusText }], raw: c
        })
      }
    })
  }

  // 第卅二轮 REQ-008：检索范围扩展至策展台实体（模糊匹配策展台名称，专属图标）
  // R68-F1：口径对齐台签栏（app store workspaces getter）——排除资源台本体实体（固定 Tab，非台签策展台）+ 已归档，历史遗留实体不再混入
  if (searchType === 'all' || searchType === 'ws') {
    d.workspaces?.filter((w: any) => !w.archived && w.id !== CURATION_WS_ID).forEach((w: any) => {
      // R97（A9）：`#标签` / `@项目` 是卡片级收窄，策展台实体两不沾，指令在场时排除
      if (pq.tags.length || pq.proj) return
      if (match(w.name || '') || matchPinyin(w.name || '', kw)) {
        const cardCount = maps.wsCount.get(w.id) || 0
        results.push({
          type: 'ws', iconClass: 'ws', iconText: '🗂', id: w.id,
          title: w.name, ws: '策展台', cat: cardCount + ' 张资源卡',
          badges: [{ type: 'ws-badge', text: '策展台' }], raw: w
        })
      }
    })
  }

  // R49-G：项目实体（点击直达项目详情 /compass/projects?p=）
  // R68-F1：口径对齐方向台——尊重 showDoneProjects 开关（zy_ui_v2，默认显示），已完成/归档项目不再混入「历史版本项目」
  if (searchType === 'all' || searchType === 'proj') {
    ;((d.compass && d.compass.directions) || []).forEach((dir: any) => {
      ;(dir.projects || []).forEach((p: any) => {
        if (!showDoneProjectsCache && isProjDone(p, d)) return
        const badges: any[] = []
        if (p.isFocused) badges.push({ type: 'prio-high', text: '🎯 主攻' })
        if (p.status === 'archived') badges.push({ type: 'curio-status', text: '已完成' })
        // R97（A9）：项目实体本身即 `@项目` 的命中对象；`#标签` 是卡片级收窄，排除实体
        if (!pq.tags.length && projHit(p.name) && (match(p.name || '') || matchPinyin(p.name || '', kw))) {
          results.push({
            type: 'proj', iconClass: 'ws', iconText: '📦', id: p.id,
            title: p.name, ws: '方向台', cat: dir.name || '—',
            badges, raw: p
          })
        }
      })
    })
  }

}

const QUICK_ACTIONS_ZY = [
  { label: '打开方向台', icon: 'compass', route: '/compass' },
  { label: '打开项目详情', icon: 'layout', route: '/compass/projects' },
  // R3-B1：树即方向台一级，「打开方向树」与「打开方向台」同目的地，重复项退役
  { label: '打开设置', icon: 'settings', route: '/settings' }
]

function bindResultEvents(el: HTMLElement) {
  // R48-A2：点击以目标 id 为准——不再依赖行序号。拼音补跑/重渲染期间 searchResults 可能被
  // 替换或重排，按 idx 取值会「点 A 开 B」；按 id 在最新结果集中解析，错位窗口内点到的永远是那张卡。
  const resolveResult = (elm: HTMLElement): any => {
    const id = elm.dataset.id
    if (id) {
      const hit = searchResults.find(r => String(r?.id || '') === id)
      if (hit) return hit
    }
    const idx = parseInt(elm.dataset.idx || '-1')
    return idx >= 0 ? searchResults[idx] : undefined
  }
  el.querySelectorAll('.zy-result-item').forEach(elm => {
    const e = elm as HTMLElement
    // R120 键位统一：单击 / Enter = 打开卡片链接（无链接则定位）；Ctrl+Enter = 仅定位到卡片所在处；双击不单独定义（去重）
    const focusElm = e.querySelector('.zy-ri-focus')
    e.title = '单击/Enter → 打开链接（无链接则定位） · Ctrl+Enter → 定位到卡片所在处' + (focusElm ? ' · → 加入今日三件事' : '')
    // R55-H2：🗑 直接删除（无二次确认，软删进回收站）——先于行点击，阻断打开链接
    const delBtn = e.querySelector('.zy-ri-del') as HTMLElement | null
    if (delBtn) {
      delBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation()
        const id = delBtn.dataset.delId || ''
        const d2 = await getData()
        if (!d2) return
        const hit = (d2.resources || []).find((r: any) => r.id === id) ||
          (d2.tasks || []).find((r: any) => r.id === id) ||
          (d2.curiosities || []).find((r: any) => r.id === id)
        if (!hit || hit.deletedAt) return
        hit.deletedAt = Date.now()
        // R141：任务软删同口径摘净 metric.taskIds 引用（与回收站恢复/撤销回填闭环一致）
        if ((d2.tasks || []).some((x: any) => x.id === id)) detachTaskFromMetrics(d2 as any, String(id))
        await saveData(d2)
        searchResults = searchResults.filter(r => String(r?.id || '') !== id)
        renderResults()
        showToast('已删除，可在回收站恢复')
      })
    }
    // R78（A7）：「→ 三件事」按钮——先于行点击，阻断打开链接/定位
    const focusBtn = e.querySelector('.zy-ri-focus') as HTMLElement | null
    if (focusBtn) {
      focusBtn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const fid = focusBtn.dataset.focusId || ''
        const hit = searchResults.find(r => String(r?.id || '') === fid)
        if (hit) void addTaskToDailyFocus(hit)
      })
    }
    e.addEventListener('click', () => {
      const item = resolveResult(e)
      if (item) openSearchResult(item)
    })
    e.addEventListener('dblclick', () => {
      // 双击 = 开链接；click 已处理，此处仅作兜底（300ms 去重保证只开一次）
      const item = resolveResult(e)
      if (item) openSearchResult(item)
    })
    e.addEventListener('mouseenter', () => {
      searchSelIndex = parseInt(e.dataset.idx || '0')
      // R60-3：同步 id 锚点——hover 之后即便结果集因拼音补跑而重排，Enter 打开的仍是这一张
      searchSelId = e.dataset.id || ''
      document.querySelectorAll('.zy-result-item').forEach((e2, j) => e2.classList.toggle('sel', j === searchSelIndex))
    })
  })
}

// ============ R78（A7）：浮层内「加入今日三件事」（仅任务卡） ============
/** 今日键：本地时区 YYYY-MM-DD，与 CompassHome.dateStr 口径一致 */
function todayKeyStr(): string {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate())
}
/** A7-a：刷新「已入选今日三件事」的任务 id 集合（结果项置灰去重用）。
 *  渲染前调用一次即可——每次写入后会同步 dataCache 并再次调用，保证集合不陈旧。 */
function refreshTodayFocus() {
  const list: any[] = dataCache?.dailyFocus?.[todayKeyStr()] || []
  todayFocusSourceIds = new Set(list.map((s: any) => String(s?.sourceId || '')).filter(Boolean))
}
/** A7-b：就地刷新所有「→ 三件事」按钮的置灰与文案（不整表重渲染，避免打断输入焦点与选中行） */
function refreshFocusButtons() {
  document.querySelectorAll<HTMLElement>('.zy-ri-focus').forEach(b => {
    const on = todayFocusSourceIds.has(b.dataset.focusId || '')
    b.classList.toggle('on', on)
    b.textContent = on ? '✓ 已入选' : '→ 三件事'
    b.title = on ? '已在今日三件事中（点击定位）' : '加入今日三件事（→）'
  })
}
/** A7-e：任务定位分流——挂了项目/指标 → 项目详情；否则 → 调度台任务调度模块高亮 */
function focusLocateTask(item: any) {
  const t = item?.raw || item
  const id = String(t?.id || item?.id || '')
  const route = t?.projectId ? '/compass/projects?p=' + t.projectId : '/?hl=' + id
  try { chrome.runtime.sendMessage({ type: 'zy-open-route', route }) } catch { /* ignore */ }
  showToast(t?.projectId ? '↗ 已定位到项目详情' : '↗ 已定位到调度台的任务')
  closeOverlay()
}
/** A7-d：把任务卡加入今日三件事
 *  ① 去重：已入选则不再写库，直接定位；
 *  ② ≤3 硬上限：满则两段式替换（首次只提示，再按一次才落库，防误替换）；
 *  ③ 跨上下文合并：读写一律绕过 1500ms 缓存——loadData 取最新快照 → 改 → saveData → 同步 dataCache，
 *     把「读—改—写」压在一次往返内，避免与新标签页的整体覆盖写互相吃掉（lost update）。 */
async function addTaskToDailyFocus(item: any) {
  const t = item?.raw || item
  const taskId = String(t?.id || '')
  if (!taskId) return
  if (todayFocusSourceIds.has(taskId)) { showToast('该任务已在今日三件事中'); focusLocateTask(item); return }
  const key = todayKeyStr()
  const d = await loadData() // 绕过缓存，取 storage 最新快照
  if (!d) { showToast('数据加载失败'); return }
  d.dailyFocus = d.dailyFocus || {}
  const list: any[] = d.dailyFocus[key] || []
  // 与 CompassHome.selectTaskForSlot 完全同构，保证调度台三件事卡片能直接识别
  const slot = {
    id: uid('focus'), sourceType: 'task', sourceId: taskId,
    text: String(t?.title || '快速任务'), done: t?.status === 'done', doneAt: t?.completedAt
  }
  let replaced = -1
  if (list.length >= FOCUS_LIMIT) {
    if (pendingReplaceSlot === null) {
      pendingReplaceSlot = 0
      showToast('今日三件事已满 3/3 · 再按一次替换第 1 件')
      return
    }
    replaced = Math.min(Math.max(pendingReplaceSlot, 0), FOCUS_LIMIT - 1)
    list[replaced] = slot
    pendingReplaceSlot = null
  } else {
    list.push(slot)
  }
  d.dailyFocus[key] = list
  await saveData(d)
  dataCache = d; dataCacheAt = Date.now() // 同步缓存，后续读不再取到旧快照
  refreshTodayFocus()
  showToast(replaced >= 0 ? '已替换今日第 ' + (replaced + 1) + ' 件事' : '已加入今日三件事（' + list.length + '/' + FOCUS_LIMIT + '）')
  refreshFocusButtons()
}

function renderResults() {
  const el = document.getElementById('__zy_results__')
  if (!el) return
  refreshTodayFocus() // R78（A7-a）：每次渲染前对齐一次已入选集合
  // B1：浏览模式（空查询 + 全部）= 快捷操作 + 最近调出（近 7 天，R97-A8）+ 近期最常用（R47-B4：全类型按调用次数降序）
  if (!lastQuery && searchType === 'all') {
    const dc = dataCache
    const heat: any[] = []
    const pushHeat = function (x: any, type: string, iconText: string, title: string) {
      if (x && !x.deletedAt && (x.callCount || 0) > 0) heat.push({ type: type, iconClass: type === 'ws' ? 'ws' : type, iconText: iconText, id: x.id, title: title, ws: '', cat: '', badges: [], raw: x })
    }
    ;(dc && dc.resources ? dc.resources : []).forEach(function (r: any) { pushHeat(r, 'res', '📄', r.title) })
    ;(dc && dc.tasks ? dc.tasks : []).forEach(function (t: any) { pushHeat(t, 'task', '✅', t.title) })
    ;(dc && dc.curiosities ? dc.curiosities : []).forEach(function (c: any) { pushHeat(c, 'curio', '💡', c.question) })
    ;(dc && dc.workspaces ? dc.workspaces : []).forEach(function (w: any) { pushHeat(w, 'ws', '🗂', w.name) })
    heat.sort(function (a: any, b: any) {
      const dc2 = (b.raw.callCount || 0) - (a.raw.callCount || 0)
      return dc2 !== 0 ? dc2 : (b.raw.lastCalledAt || 0) - (a.raw.lastCalledAt || 0)
    })
    // R97（A8）：「最近调出」= 近 7 天有调出记录的卡（lastCalledAt 降序，≤8 条）——
    // 「用过多久」和「用得多频」是两个问题：上周刚翻过的资料不该被三个月没用 20 次的工具压下去。
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const nowTs = Date.now()
    const recentCalled = heat
      .filter(function (x: any) { return (x.raw.lastCalledAt || 0) >= nowTs - WEEK_MS })
      .sort(function (a: any, b: any) { return (b.raw.lastCalledAt || 0) - (a.raw.lastCalledAt || 0) })
      .slice(0, 8)
    const recentIdSet = new Set(recentCalled.map(function (x: any) { return String(x.id || '') }))
    // 「近期最常用」沿用 callCount 口径，排除上一段已出现的卡（同卡不在空态出现两次）
    const hot = heat.filter(function (x: any) { return !recentIdSet.has(String(x.id || '')) }).slice(0, 8)
    // R97 顺带修正：热词行此前一律标 type:'res'/📄——Enter/点击对任务/好奇/策展台行会
    // 误按资源逻辑分发（策展台行定位 /workspace/undefined；任务/好奇不写 bumpHeat 计数）。
    // 现按 pushHeat 时的真实 type 分发（行仍带 data-id，bindResultEvents 按 id 解析不受影响）。
    const toRow = function (r: any) {
      return { type: r.type, iconClass: r.iconClass, iconText: r.iconText, id: r.id, title: r.title, ws: '', cat: '', badges: [], raw: r.raw }
    }
    searchResults = [
      ...QUICK_ACTIONS_ZY.map(function (qa) { return { type: 'qa', qa: qa } }),
      ...recentCalled.map(toRow),
      ...hot.map(toRow)
    ]
    searchSelIndex = searchResults.length ? 0 : -1
    { const cur: any = searchResults[searchSelIndex]; searchSelId = cur ? String(cur.id || '') : '' }
    const qaHtml = QUICK_ACTIONS_ZY.map(function (qa, i) {
      return '<div class="zy-result-item' + (i === searchSelIndex ? ' sel' : '') + '" data-idx="' + i + '">' +
        '<div class="zy-ri-icon res">↵</div>' +
        '<div class="zy-ri-main"><div class="zy-ri-title">' + qa.label + '</div></div></div>'
    }).join('')
    const heatRowHtml = function (r: any, j: number, base: number) {
      return '<div class="zy-result-item' + (base + j === searchSelIndex ? ' sel' : '') + '" data-idx="' + (base + j) + '" data-id="' + escapeHtml(String(r.id || '')) + '">' +
        '<div class="zy-ri-icon ' + escapeHtml(r.iconClass) + '">' + escapeHtml(r.iconText) + '</div>' +
        '<div class="zy-ri-main"><div class="zy-ri-title">' + escapeHtml(r.title) + '</div></div>' +
        '<span class="zy-ri-link url">🔥' + (r.raw.callCount || 0) + '</span></div>'
    }
    const recentHtml = recentCalled.length
      ? '<div class="zy-group-title">🕐 最近调出 · 近 7 天</div>' + recentCalled.map(function (r: any, j: number) { return heatRowHtml(r, j, QUICK_ACTIONS_ZY.length) }).join('')
      : ''
    const hotHtml = hot.length
      ? '<div class="zy-group-title">🔥 近期最常用 · 按调用次数</div>' + hot.map(function (r: any, j: number) { return heatRowHtml(r, j, QUICK_ACTIONS_ZY.length + recentCalled.length) }).join('')
      : ''
    el.innerHTML = '<div class="zy-group-title">快捷操作</div>' + qaHtml + recentHtml + hotHtml
    bindResultEvents(el)
    return
  }
  // R49-G2：策展台类型 → 策展台→分类树（点击分类定位：有卡高亮第一张，无卡高亮分类行）
  if (searchType === 'ws') {
    const d2: any = dataCache || (window as any).__zyDataCache
    const q = hlKw // R97（A9）：树名过滤吃去指令后的 kw，`#`/`@` 不该拿来匹配台名
    const wss = (d2?.workspaces || []).filter((w: any) => !w.archived && (!q || (w.name || '').toLowerCase().includes(q)))
    let treeHtml = ''
    for (const w of wss) {
      const cats = (d2?.categories || []).filter((c: any) => c.workspaceId === w.id && (!q || (c.name || '').toLowerCase().includes(q)))
      const wsCards = (d2?.resources || []).filter((r: any) => !r.deletedAt && r.workspaceId === w.id).length
      treeHtml += '<div class="zy-group-title">🗂 ' + escapeHtml(wsDisplayNameOf(w)) + ' <span style="color:var(--zy-text-4);font-weight:400">' + wsCards + ' 张卡</span></div>'
      for (const c of cats) {
        const fam = new Set<string>([c.id, ...(d2?.categories || []).filter((x: any) => x.parentId === c.id).map((x: any) => x.id)])
        const cnt = (d2?.resources || []).filter((r: any) => !r.deletedAt && r.workspaceId === w.id && fam.has(r.categoryId || '')).length
        treeHtml += '<div class="zy-result-item" data-wscat="' + escapeHtml(w.id) + '" data-catid="' + escapeHtml(c.id) + '">' +
          '<div class="zy-ri-icon ws">📁</div>' +
          '<div class="zy-ri-main"><div class="zy-ri-title">' + escapeHtml(c.name || '') + '</div>' +
          '<div class="zy-ri-meta"><span class="zy-badge cat">' + cnt + ' 张卡</span>' + (cnt ? '' : '<span class="zy-badge">空分类 · 定位到分类</span>') + '</div></div>' +
          '<span class="zy-ri-link url">定位 ↗</span></div>'
      }
      if (!cats.length) treeHtml += '<div class="zy-group-more">该策展台暂无分类</div>'
    }
    el.innerHTML = treeHtml || '<div class="zy-empty"><div class="icon">🗂</div><div class="text">没有匹配的策展台</div></div>'
    el.querySelectorAll<HTMLElement>('.zy-result-item[data-wscat]').forEach(n => {
      n.addEventListener('click', () => {
        const wsId = n.dataset.wscat || ''
        const catId = n.dataset.catid || ''
        safeSend({ type: 'zy-open-route', route: '/workspace/' + wsId + '?cat=' + catId })
        showToast('↗ 已定位到分类')
        closeOverlay()
      })
    })
    return
  }
  if (!searchResults.length) {
    el.innerHTML = '<div class="zy-empty"><div class="icon">🪹</div><div class="text">没有匹配的卡片<br><span style="font-size:var(--zy-fs-xs)">试试更短的关键词</span></div></div>'
    return
  }
  const groups = [
    { label: '📄 资源卡', type: 'res' },
    { label: '✅ 任务卡', type: 'task' },
    { label: '💡 好奇心', type: 'curio' },
    { label: '🗂 策展台', type: 'ws' },
    { label: '📦 项目', type: 'proj' }
  ]
  // REQ-031 P-031-2：单次 for 按 type 归桶（去掉 filter + indexOf 嵌套，O(n)）
  const buckets: Record<string, any[]> = { res: [], task: [], curio: [], ws: [], proj: [] }
  for (const r of searchResults) if (buckets[r.type]) buckets[r.type].push(r)
  // REQ-046 速度优化：每组最多渲染 30 条，防 DOM 爆炸（超大结果集首屏秒出）
  const MAX_PER_GROUP = 30
  let html = ''
  let offset = 0
  for (const g of groups) {
    const items = buckets[g.type]
    if (!items.length) continue
    const shown = items.slice(0, MAX_PER_GROUP)
    const rest = items.length - shown.length
    html += '<div class="zy-group-title">' + g.label + ' <span style="color:var(--zy-text-4);font-weight:400">' + items.length + '</span></div>'
    shown.forEach(function (item: any, j: number) {
      const i = offset + j
      const badgesHtml = item.badges.map(function (b: any) { return '<span class="zy-badge ' + escapeHtml(b.type) + '">' + escapeHtml(b.text) + '</span>' }).join('')
      // R128-A4：link 文本 = 用户自填 URL（采集时来自任意网页）——不过转义即成 innerHTML 注入点
      const linkHtml = item.link ? '<span class="zy-ri-link ' + escapeHtml(item.link.type) + '">' + (item.link.type === 'url' ? '🔗' : item.link.type === 'file' ? '📁' : '📝') + ' ' + escapeHtml(item.link.text) + '</span>' : ''
      const summaryHtml = item.summary ? '<div class="zy-ri-summary">' + hl(item.summary) + '</div>' : ''
      // R55-H2：三卡结果行提供直接删除（无二次确认，软删进回收站）
      const delHtml = (g.type === 'res' || g.type === 'task' || g.type === 'curio')
        ? '<span class="zy-ri-del" data-del-id="' + escapeHtml(String(item.id || '')) + '" title="直接删除（可回收站恢复）">🗑</span>'
        : ''
      // R78（A7-b）：仅任务卡提供「加入今日三件事」；已入选的置灰并改文案
      const inFocus = todayFocusSourceIds.has(String(item.id || ''))
      const focusHtml = g.type === 'task'
        ? '<span class="zy-ri-focus' + (inFocus ? ' on' : '') + '" data-focus-id="' + escapeHtml(String(item.id || '')) + '" title="' +
          (inFocus ? '已在今日三件事中（点击定位）' : '加入今日三件事（→）') + '">' + (inFocus ? '✓ 已入选' : '→ 三件事') + '</span>'
        : ''
      html += '<div class="zy-result-item' + (i === searchSelIndex ? ' sel' : '') + '" data-idx="' + i + '" data-id="' + escapeHtml(String(item.id || '')) + '">' +
        '<div class="zy-ri-icon ' + escapeHtml(item.iconClass) + '">' + escapeHtml(item.iconText) + '</div>' +
        '<div class="zy-ri-main">' +
        '<div class="zy-ri-title">' + hl(item.title) + '</div>' +
        '<div class="zy-ri-meta"><span class="zy-badge ws">' + escapeHtml(item.ws) + '</span><span class="zy-badge cat">' + escapeHtml(item.cat) + '</span>' + badgesHtml + linkHtml + '</div>' +
        summaryHtml + '</div>' + focusHtml + delHtml + '</div>'
    })
    if (rest > 0) html += '<div class="zy-group-more">… 还有 ' + rest + ' 条，输入更精确的关键词</div>'
    offset += items.length
  }
  el.innerHTML = html
  bindResultEvents(el)
}

void 0;

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchSelIndex = Math.min(searchSelIndex + 1, searchResults.length - 1)
    searchSelId = String((searchResults[searchSelIndex] || {}).id || '')
    document.querySelectorAll('.zy-result-item').forEach((el, i) => el.classList.toggle('sel', i === searchSelIndex))
    document.querySelector('.zy-result-item.sel')?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchSelIndex = Math.max(searchSelIndex - 1, 0)
    searchSelId = String((searchResults[searchSelIndex] || {}).id || '')
    document.querySelectorAll('.zy-result-item').forEach((el, i) => el.classList.toggle('sel', i === searchSelIndex))
    document.querySelector('.zy-result-item.sel')?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (!searchSelIndex && searchSelIndex !== 0) return
    // R60-3：优先按 id 解析——补跑/重排后下标会漂移，id 永远指向用户选中的那一张
    const selItem =
      (searchSelId ? searchResults.find((r: any) => String(r?.id || '') === searchSelId) : undefined) ||
      searchResults[searchSelIndex]
    if (selItem) {
      if (e.ctrlKey || e.metaKey) {
        // R120：Ctrl+Enter = 仅定位到卡片所在处（不打开详情抽屉）
        openSearchLocator(selItem)
      } else {
        // R120：Enter = 打开链接（无链接则定位到卡片所在处）
        openSearchResult(selItem)
      }
    }
  } else if (e.key === 'ArrowRight') {
    // R78（A7-c）：→ 加入今日三件事（仅任务卡）。两处克制：
    // ① 不动 Ctrl+Enter——它已是「仅定位到卡片所在处」；
    // ② → 在搜索框里本就是「光标右移」，故仅当光标已在末尾（右移本就无意义）时才截获，不抢编辑键位。
    const inp = document.getElementById('__zy_si__') as HTMLInputElement | null
    const atEnd = !inp || (inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length)
    if (!atEnd) return
    const selItem =
      (searchSelId ? searchResults.find((r: any) => String(r?.id || '') === searchSelId) : undefined) ||
      searchResults[searchSelIndex]
    if (!selItem || selItem.type !== 'task') return
    e.preventDefault(); e.stopPropagation()
    void addTaskToDailyFocus(selItem)
  } else if (e.key === 'Tab') {
    // B29：Tab 过滤类型——输入「任务/资源/好奇/全部」+ Tab 直达对应类型；否则四类循环切换。
    // 关键词被视为指令（消费掉），普通关键词保留；搜索框 chip 与类型 Tab 行同步更新
    e.preventDefault()
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    const q = (input?.value || '').trim()
    const kw = ([['任务', 'task'], ['资源', 'res'], ['好奇心', 'curio'], ['好奇', 'curio'], ['策展台', 'ws'], ['工作台', 'ws'], ['项目', 'proj'], ['全部', 'all']] as const).find(([k]) => k === q)
    if (kw) {
      searchType = kw[1]
      if (input) input.value = ''
    } else {
      const cycle: Array<'all'|'res'|'task'|'curio'|'ws'|'proj'> = ['all', 'res', 'task', 'curio', 'ws', 'proj']
      searchType = cycle[(cycle.indexOf(searchType) + 1) % cycle.length]
    }
    searchSelIndex = 0
    renderTypeTabs()
    runSearch(input?.value || '')
    showToast('🔍 ' + typeLabel(searchType))
  } else if (e.key === 'Escape') {
    // R92（D2）：两段式——**有内容先清空，空再关闭**。
    // 原实现直接 closeOverlay()，反射性按一下 Esc 就把整段查询丢掉（再唤起要重打）。
    // ⚠ 键位与右端「Esc」按钮（#__zy_esc__）刻意不同：按钮是**显式点击意图**，保持直接关闭。
    // 二者语义不同是有意的，别当成 bug 统一掉。
    const input = document.getElementById('__zy_si__') as HTMLInputElement | null
    if (input && input.value) {
      e.preventDefault(); e.stopPropagation()
      input.value = ''
      searchSelIndex = 0
      searchSelId = ''
      renderTypeTabs()
      runSearch('')
    } else {
      closeOverlay()
    }
  }
}

/** R97（D5）+ R92（D2）：document 级 Esc 在搜索浮层内的复位入口——清空选中并重跑查询 */
function resetSearchAndRerun() {
  searchSelIndex = 0
  searchSelId = ''
  renderTypeTabs()
  void runSearch('')
}
/** R78（A7）：浮层关闭时作废两段式替换的中间态 */
function cancelPendingReplace() { pendingReplaceSlot = null }

export { openSearch, resetSearchAndRerun, cancelPendingReplace, loadData, saveData, getData }
