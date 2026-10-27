/**
 * Content Script · 全局浮层 / 纯函数域（自 overlay-impl.ts 拆出，V3.9.23 结构优化）
 *
 * 查询解析、搜索关联 Map、结果打开/定位路由、以及 HTML 转义等工具函数。
 * 这里只放「不持有搜索选中态」的纯逻辑；与宿主/搜索域同处一份运行时。
 */
import { CURATION_WS_ID } from '@/shared/models'
import { wsDisplayNameOf, POOL_DISPLAY_NAME } from '@/shared/utils/wsName'
import { toOpenableUrl } from '@/shared/utils/link'
import { safeSend, closeOverlay, showToast } from './overlay-impl'
import { loadData, saveData } from './overlay-search'

function typeLabel(t: 'all'|'res'|'task'|'curio'|'ws'|'proj'): string {
  return t === 'res' ? '📄 资源卡' : t === 'task' ? '✅ 任务卡' : t === 'curio' ? '💡 好奇心' : t === 'ws' ? '🗂 策展台' : t === 'proj' ? '📦 项目' : '🔍 搜全部'
}
function query0(q: string): string { return (q || '').trim().toLowerCase() }
// REQ-031 P-031-1：搜索关联 Map 化——一次遍历构建 ws/cat/project 名称 Map + 策展台卡数累加，查找 O(1)
interface SearchMaps {
  wsName: Map<string, string>
  catName: Map<string, string>
  projName: Map<string, string>
  wsCount: Map<string, number>
}
function buildSearchMaps(d: any): SearchMaps {
  const wsName = new Map<string, string>()
  const catName = new Map<string, string>()
  const projName = new Map<string, string>()
  const wsCount = new Map<string, number>()
  // R4-Dg：台名走 wsName.ts 口径（此前裸取 w.name 会带图标前缀，与本页 1019 行的分组标题不一致）；
  // 池卡（zy-curation）单独覆盖成「资源卡池」——存量库里那枚历史实体的名字仍叫「资源台」。
  for (const w of d.workspaces || []) wsName.set(w.id, wsDisplayNameOf(w) || '未知')
  wsName.set(CURATION_WS_ID, POOL_DISPLAY_NAME)
  for (const c of d.categories || []) catName.set(c.id, c.name || '')
  for (const dir of d.compass?.directions || [])
    for (const p of dir.projects || []) projName.set(p.id, p.name)
  for (const r of d.resources || []) {
    if (r.deletedAt) continue
    wsCount.set(r.workspaceId, (wsCount.get(r.workspaceId) || 0) + 1)
  }
  return { wsName, catName, projName, wsCount }
}

/**
 * R97（A9）：浮层搜索前缀直筛——`#标签` / `@项目`。
 * - `#x` 计入 tags：**全部命中才算**（交集，「直筛是收窄不是扩大」，对齐主应用 R89 matchCard 口径）；
 * - `@x` 计入 proj：收窄到「任务（项目名命中）+ 项目实体（名称命中）」——资源/好奇/策展台不属于任何项目，排除；
 * - 其余词 = kw：全文 blob / 拼音 / 高亮共用；
 * - **单个 `#` / `@`（后缀为空）回落为普通词**——避免边输入边筛把结果打空（R89 同款惯例）。
 * content script 纯 Vanilla，就地实现（不引主应用模块，见 v2/README 已知地雷）。
 */
function parseOverlayQuery(q: string): { tags: string[]; proj: string; kw: string } {
  const tags: string[] = []
  let proj = ''
  const words: string[] = []
  for (const tok of (q || '').trim().split(/\s+/)) {
    if (!tok) continue
    if (tok.length > 1 && tok[0] === '#') tags.push(tok.slice(1).toLowerCase())
    else if (tok.length > 1 && tok[0] === '@') proj = tok.slice(1).toLowerCase()
    else words.push(tok.toLowerCase())
  }
  return { tags, proj, kw: words.join(' ') }
}
/**
 * R2-④：资源卡定位路由（两入口共用一份口径）。
 * 池卡的居所是调度台「资源卡池」这张卡——`/workspace/zy-curation` 自 R179 资源台退役后
 * 恒落 Workspace.vue「策展台不存在」死页，往那儿推等于把用户送进死胡同；台内原生卡仍走该台深链。
 */
function resLocateRoute(r: any): string {
  if (!r) return '/'
  const id = encodeURIComponent(String(r.id))
  if (r.workspaceId === CURATION_WS_ID) return '/?hl=' + id + '&hk=res'
  const cat = r.categoryId ? '&cat=' + encodeURIComponent(String(r.categoryId)) : ''
  return '/workspace/' + r.workspaceId + '?hl=' + id + '&hk=res' + cat
}
function openSearchLocator(item: any) {
  // R120 键位统一：Ctrl+Enter = **仅定位到卡片所在处**（不再打开详情抽屉）。
  // 单击/Enter = 打开卡片链接（见 openSearchResult）；两入口（网页浮层 / 应用内搜索）语义一致。
  // 走 zy-open-route（background 有处理），携带 hl + hk（+ 资源卡带 cat）供消费端认领高亮。
  const openRoute = (route: string) => {
    safeSend({ type: 'zy-open-route', route })
  }
  if (item.type === 'qa') {
    openRoute(item.qa.route)
    closeOverlay()
    return
  }
  if (item.type === 'ws') {
    // 策展台条目：打开该台（工作台 id 非卡片 id，不带 hl）
    openRoute('/workspace/' + item.id)
    showToast('🎯 已定位到策展台')
    closeOverlay()
    return
  }
  if (item.type === 'proj') {
    openRoute('/compass/projects?p=' + item.id)
    showToast('🎯 已定位到项目详情')
    closeOverlay()
    return
  }
  if (item.type === 'res') {
    openRoute(resLocateRoute(item.raw))
    showToast(item.raw?.workspaceId === CURATION_WS_ID ? '🎯 已定位到资源卡池' : '🎯 已定位到卡片所在处')
  } else if (item.type === 'task') {
    openRoute('/?hl=' + item.id + '&hk=task')
    showToast('🎯 已定位到任务卡片')
  } else {
    openRoute('/?hl=' + item.id + '&hk=curio')
    showToast('🎯 已定位到好奇心卡片')
  }
  closeOverlay()
}

// 300ms 同项去重：单击/双击都走 openSearchResult，避免双击双开
let lastOpenId = ''
let lastOpenTs = 0
/** R47-B4：content 端通用热度计数（task/curio/ws），与 newtab 端 recordCardOpen 口径一致 */
function bumpHeat(kind: 'task' | 'curio' | 'ws', id: string) {
  loadData().then((d2: any) => {
    if (!d2) return
    const pool = kind === 'ws' ? d2.workspaces : kind === 'task' ? d2.tasks : d2.curiosities
    const hit = pool?.find((x: any) => x.id === id)
    if (hit) { hit.callCount = (hit.callCount || 0) + 1; hit.lastCalledAt = Date.now(); saveData(d2) }
  })
}
function openSearchResult(item: any) {
  const now = Date.now()
  if (item?.id && item.id === lastOpenId && now - lastOpenTs < 300) return
  if (item?.id) { lastOpenId = item.id; lastOpenTs = now }
  // R120 键位统一：单击/Enter —— 打开卡片链接；无链接则定位到卡片所在处（Ctrl+Enter 走 openSearchLocator 仅定位）
  if (item.type === 'qa') {
    safeSend({ type: 'zy-open-route', route: item.qa.route })
    closeOverlay()
    return
  }
  if (item.type === 'ws') {
    bumpHeat('ws', item.id)
    safeSend({ type: 'zy-open-route', route: '/workspace/' + item.id })
    closeOverlay()
    return
  }
  if (item.type === 'proj') {
    // R49-G：项目条目 → 直达项目详情（二级页）
    safeSend({ type: 'zy-open-route', route: '/compass/projects?p=' + item.id })
    showToast('↗ 已打开项目详情')
    closeOverlay()
    return
  }
  if (item.type === 'res') {
    const r = item.raw
    if (r.link) {
      // 打开即计数（WRR 口径：搜索打开也算被打开）
      r.callCount = (r.callCount || 0) + 1
      r.lastCalledAt = Date.now()
      loadData().then(d2 => {
        if (d2) {
          const hit = d2.resources?.find((x: any) => x.id === r.id)
          if (hit) { hit.callCount = r.callCount; hit.lastCalledAt = r.lastCalledAt }
          saveData(d2)
        }
      })
      // R128-A4：打开链接统一走 toOpenableUrl——此前此处按 linkType 直接开裸 r.link，
      // 绕过了 R70-14 的伪协议黑名单（录入/导入的 javascript:、data: 链接点击即在宿主页执行）。
      const openable = toOpenableUrl(r.linkType, r.link)
      if (openable) window.open(openable, '_blank')
      else if (r.linkType === 'file') {
        showToast('⚠ 本地文件缺少完整路径，请到资源卡池补全')
        safeSend({ type: 'zy-open-route', route: resLocateRoute(r) })
      } else showToast('⚠ 该链接协议不被允许打开')
    } else {
      safeSend({ type: 'zy-open-route', route: resLocateRoute(r) })
      showToast(r.workspaceId === CURATION_WS_ID ? '↗ 已定位到资源卡池' : '↗ 已定位到卡片所在策展台')
    }
  } else if (item.type === 'task') {
    bumpHeat('task', item.id)
    safeSend({ type: 'zy-open-route', route: '/?hl=' + item.id })
    showToast('↗ 已定位到调度台的任务')
  } else {
    bumpHeat('curio', item.id)
    safeSend({ type: 'zy-open-route', route: '/?hl=' + item.id })
    showToast('↗ 已定位到调度台好奇心')
  }
  closeOverlay()
}
// ============ 工具函数 ============
/** 第八轮：分类按层级平铺（子分类显示为「父 / 子」），供下拉选项使用 */
function treeCatLabels(cats: any[]): any[] {
  const list = cats || []
  const roots = list
    .filter((c: any) => !c.parentId || !list.some((p: any) => p.id === c.parentId))
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  const out: any[] = []
  for (const r0 of roots) {
    out.push({ id: r0.id, label: r0.name })
    for (const ch of list.filter((c: any) => c.parentId === r0.id).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))) {
      out.push({ id: ch.id, label: r0.name + ' / ' + ch.name })
    }
  }
  return out
}
function linkShort(link: string) {
  if (link.startsWith('http')) return link.replace(/^https?:\/\//, '').substring(0, 30)
  if (link.startsWith('obsidian')) return 'Obsidian笔记'
  const parts = link.split(/[\\/]/)
  return parts[parts.length - 1].substring(0, 25)
}
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hostname = u.hostname.toLowerCase()
    u.hash = ''
    const utm = ['utm_', 'spm', 'from', 'gclid', 'fbclid']
    u.searchParams.forEach((_, key) => { if (utm.some(p => key.startsWith(p))) u.searchParams.delete(key) })
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    u.pathname = path
    return u.toString()
  } catch { return raw.trim() }
}

function escapeHtml(s: string) {
  // REQ-031 P-031-4：createElement → 正则白名单替换（高频路径提速 ~10 倍）
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export { typeLabel, query0, buildSearchMaps, parseOverlayQuery, resLocateRoute, openSearchLocator, openSearchResult, linkShort, normalizeUrl, escapeHtml, treeCatLabels }
export type { SearchMaps }

