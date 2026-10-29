import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted, shallowRef, defineAsyncComponent } from 'vue'
import type { Ref, ShallowRef, ComputedRef } from 'vue'
import { showToast } from '@/shared/components/toast'
import { saveUIPrefs } from '@/shared/storage/repository'
import type { ResourceCard, TaskCard, CuriosityCard, Workspace, Category, AnyCard } from '@/shared/models'
import type { useGlobalPopups, SearchResult, AiCand, AiHit, AiOut } from './useGlobalPopups'

export function useGlobalPopupsSearch(deps: Pick<ReturnType<typeof useGlobalPopups>, 'activePanel' | 'currentType' | 'allResults' | 'searchQuery' | 'store'>): {
  aiSearch: ShallowRef<AiOut | null>
  aiBusy: Ref<boolean>
  aiSecs: Ref<number>
  aiChars: Ref<number>
  aiTook: Ref<number>
  aiScanned: Ref<number>
  aiTotal: Ref<number>
  aiFound: Ref<number>
  aiDur: (ms: number) => string
  aiAbortCtl: AbortController | null
  aiTick: ReturnType<typeof setInterval> | null
  aiCancelMsg: string | undefined
  aiCache: Map<string, AiOut>
  aiStopTick: () => void
  aiAbort: (msg: string | null) => void
  cardFieldText: (card: AnyCard) => string
  aiCands: ComputedRef<AiCand[]>
  aiProgress: ComputedRef<string>
  aiMoreBatches: ComputedRef<number>
  aiSearchRun: (allScope: boolean) => Promise<void>
  aiHitById: ComputedRef<Record<string, { why: string; weak: boolean }>>
  aiTopRows: ComputedRef<{ hit: AiHit; item: SearchResult }[]>
  SEARCH_HIST_MAX: number
  searchHistory: Ref<{ q: string; n: number; at: number }[]>
  topSearches: ComputedRef<{ q: string; n: number; at: number }[]>
  recordedQ: string
  recordSearch: (qRaw: string) => void
} {
  const { activePanel, currentType, allResults, searchQuery, store } = deps
/* ===== R161-②：常用检索词 =====
 * 记的是"这个词真的被用出去过"（打开/定位了某一行的那一刻），不是半截输入 ——
 * 按 120ms 防抖记账会把 `d`/`db`/`dbs` 全记一遍，那叫输入历史，不叫检索历史。
 * 存本地偏好（UIPrefs，不随数据同步）：换机器不该把别人的搜索习惯带过去。
 *
 * R181：这组状态随「检索域」整体下沉到本模块 —— `recordedQ` 保持**普通 let**（不是 ref），
 * 是为了让下方 watch 与 recordSearch 里的 `recordedQ = ''` / `q === recordedQ` 原样不动：
 * 历史判据（R161-② / R136-1 / R146-6）钉的是这两行原文，ref 化会把锚点改形。 */
const SEARCH_HIST_MAX = 20
const searchHistory = ref<{ q: string; n: number; at: number }[]>(
  Array.isArray((store.ui as { searchHistory?: unknown } | null)?.searchHistory)
    ? ((store.ui as { searchHistory: { q: string; n: number; at: number }[] }).searchHistory)
    : []
)
/** 检索框下方只铺 3 条：按次数降序，同次按最近 */
const topSearches = computed(() => searchHistory.value.slice()
  .sort((a, b) => b.n - a.n || b.at - a.at).slice(0, 3))
/** 同一句检索只记一次：点开某一行会走到 closeAll，"打开"与"关闭"不该被记成两次 */
let recordedQ = ''
function recordSearch(qRaw: string): void {
  const q = qRaw.trim()
  if (q.length < 2 || q === recordedQ) return
  recordedQ = q
  const old = searchHistory.value.find(h => h.q === q)
  const list = [{ q, n: (old?.n || 0) + 1, at: Date.now() }, ...searchHistory.value.filter(h => h.q !== q)]
  searchHistory.value = list.slice(0, SEARCH_HIST_MAX)
  saveUIPrefs({ searchHistory: searchHistory.value })
}
const aiSearch = shallowRef<AiOut | null>(null)
const aiBusy = ref(false)
const aiSecs = ref(0)
const aiChars = ref(0)
const aiTook = ref(0)
const aiScanned = ref(0)
const aiTotal = ref(0)
const aiFound = ref(0)
/** 回执里的耗时：亚秒说毫秒，不把 13ms 报成「1s」 */
function aiDur(ms: number) { return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's' }
/**
 * 契约形状的真源在 shared/ai/select.ts（AiSearchCand / AiSearchHit / AiSearchOut）。
 * 这里刻意不写任何指向 AI 目录的 import（连 import type 都不写）：R138-1 是按字面量钉入口
 * chunk 的，类型导入同样会命中那条守卫——宁可留三行同形声明，也不给启动链开豁免。
 */
let aiAbortCtl: AbortController | null = null
let aiTick: ReturnType<typeof setInterval> | null = null
/** 取消话术：undefined=没取消 · ''=静默取消（改词/关浮层，不打扰用户） · 非空=要点名提示 */
let aiCancelMsg: string | undefined
/** 同词同类型不重复外发（清除后再点秒回）；全库扫是显式慢路径，不进缓存 */
const aiCache = new Map<string, AiOut>()
function aiStopTick() { if (aiTick) { clearInterval(aiTick); aiTick = null } }
function aiAbort(msg: string | null) {
  aiStopTick()
  if (aiAbortCtl) { aiCancelMsg = msg ?? ''; aiAbortCtl.abort(); aiAbortCtl = null }
}
watch(activePanel, (p) => { if (p !== 'search') aiAbort(null) })
/** 候选=库内三类卡（不受字面命中限制，这正是与旧「AI 理解」的分工差别）；跟着类型 tab 收窄，切到「任务卡」就只投任务。
 *  ★只在点击时求值：模板里不引用它——那会让每次键入渲染都重扫一遍全库建候选数组（浮层是热路径）。 */
/**
 * R161-③：把卡片的**全部自定义字段**折成一行文本投给模型。
 * 只投有值的字段、单卡上限 120 字 —— 字段是用户自己填的语义，信息密度常高于描述本身。
 * 注意边界：这里只取字段**内容**，不做任何联网动作（链接只投地址，不抓正文）。
 */
function cardFieldText(card: AnyCard): string {
  const cf = card.customFields
  if (!cf) return ''
  const parts: string[] = []
  for (const k of Object.keys(cf)) {
    const v = cf[k]
    if (v == null || v === '') continue
    parts.push(`${k}:${String(v).replace(/\s+/g, ' ')}`)
    if (parts.join('').length >= 120) break
  }
  return parts.join('').slice(0, 120)
}
const aiCands = computed<AiCand[]>(() => {
  const want = currentType.value === 'all' ? null : currentType.value
  if (want === 'ws' || want === 'proj') return [] // 台/项目不参与语义召回（它们不是"卡"）
  const out: AiCand[] = []
  for (const r of allResults.value) {
    if (r.archived) continue
    if (want && r.type !== want) continue
    if (r.type !== 'res' && r.type !== 'task' && r.type !== 'curio') continue
    const raw = r.raw as AnyCard
    out.push({
      id: r.id, type: r.type, title: r.title, ws: r.ws, cat: r.cat, summary: r.summary,
      tags: (raw as { tags?: string[] }).tags, callCount: (raw as { callCount?: number }).callCount, updatedAt: raw.updatedAt,
      // R161-③：全字段投料——自定义字段 + 链接地址（只有地址，不抓网页内容）
      fields: cardFieldText(raw), link: (raw as { link?: string }).link || undefined,
    })
  }
  return out
})
/** 跑动态一句话：批扫点名"已扫 a/b 张 + 已命中 k"；单次投料没有中间进度，就报库内张数与已回字数（不假装有进度） */
const aiProgress = computed(() => {
  if (!aiBusy.value) return 'AI 检索'
  const mid = aiScanned.value > 0
    ? `已扫 ${aiScanned.value}/${aiTotal.value} 张${aiFound.value ? ` · 已命中 ${aiFound.value}`: ''}`
    : `库内 ${aiTotal.value} 张里挑`
  return `检索中 ${aiSecs.value}s · ${mid}${aiChars.value ? ` · 已回 ${aiChars.value} 字`: ''}`
})
const aiMoreBatches = computed(() => {
  const s = aiSearch.value
  return s ? Math.max(1, Math.ceil(s.total / Math.max(60, s.scanned))) : 1
})
async function aiSearchRun(allScope: boolean) {
  if (aiBusy.value) { aiAbort('已取消 AI 检索（未采用任何结果）'); return }
  if (aiSearch.value && !allScope) { aiSearch.value = null; return }
  const q = searchQuery.value.trim()
  const cands = aiCands.value
  if (!q) { showToast('先写下你要找什么（一句话就行），再点 AI 检索'); return }
  if (cands.length < 2) { showToast('库里还没有可检索的卡（资源/任务/好奇至少 2 条才谈得上挑）'); return }
  const key = `${q}|${currentType.value}|${cands.length}`
  if (!allScope) {
    const cached = aiCache.get(key)
    if (cached) {
      aiSearch.value = cached.hits.length ? cached : null
      showToast(cached.hits.length ? `秒回（这句刚问过）：AI 挑出 ${cached.hits.length} 条` : 'AI 认为库里没有贴合这句的——换个说法或全库扫')
      return
    }
  }
  aiBusy.value = true; aiSecs.value = 0; aiChars.value = 0; aiCancelMsg = undefined
  aiScanned.value = 0; aiTotal.value = cands.length; aiFound.value = 0
  const ctl = new AbortController(); aiAbortCtl = ctl
  aiTick = setInterval(() => { aiSecs.value++ }, 1000)
  const t0 = Date.now()
  try {
    const [{ loadAiConfig, aiReady, aiConfig }, { semanticSearch, semanticSearchAll }] = await Promise.all([import('@/shared/ai/config'), import('@/shared/ai/select')])
    await loadAiConfig()
    if (!aiReady.value) { showToast('请先在 设置 → AI 助手 完成接入（地址/Key/模型）'); return }
    const depth = aiConfig.value.depth
    const out = allScope
      ? await semanticSearchAll(q, cands, depth, {
        signal: ctl.signal,
        onDelta: (n) => { aiChars.value = n },
        onProgress: (p) => { aiScanned.value = p.scanned; aiTotal.value = p.total; aiFound.value = p.found },
      })
      : await semanticSearch(q, cands, depth, { signal: ctl.signal, onDelta: (n) => { aiChars.value = n } })
    aiTook.value = Date.now() - t0
    aiScanned.value = out.scanned; aiTotal.value = out.total
    if (allScope) showToast(out.hits.length ? `全库扫完：${out.batches} 批 / ${out.scanned} 张 · 挑出 ${out.hits.length} 条 · ${aiDur(aiTook.value)}` : `全库 ${out.scanned} 张都看了，没有真正贴合这句的`)
    else {
      if (aiCache.size >= 12) aiCache.delete(aiCache.keys().next().value as string)
      aiCache.set(key, out)
      aiSearch.value = out.hits.length ? out : null
      showToast(out.hits.length ? `AI 挑出 ${out.hits.length} 条（看了 ${out.scanned}/${out.total} 张）· ${aiDur(aiTook.value)}` : 'AI 认为这批候选里没有贴合的——换个说法，或点「全库分批扫」')
    }
    if (allScope) aiSearch.value = out.hits.length ? out : null
  } catch (e) {
    if (aiCancelMsg !== undefined) { if (aiCancelMsg) showToast(aiCancelMsg); return }
    aiSearch.value = null
    showToast('AI 检索失败：' + ((e as Error).message || String(e)).slice(0, 80))
  } finally { aiStopTick(); if (aiAbortCtl === ctl) aiAbortCtl = null; aiBusy.value = false }
}
/** R152：id → 命中信息（模板按行查表，不再另列一组） */
const aiHitById = computed<Record<string, { why: string; weak: boolean }>>(() => {
  const out: Record<string, { why: string; weak: boolean }> = {}
  for (const h of aiSearch.value?.hits || []) out[h.id] = { why: h.why || '', weak: !!h.weak }
  return out
})
const aiTopRows = computed(() => {
  if (!aiSearch.value) return [] as { hit: AiHit; item: SearchResult }[]
  return aiSearch.value.hits
    .map(hit => ({ hit, item: allResults.value.find(r => r.id === hit.id) }))
    .filter((x): x is { hit: AiHit; item: SearchResult } => !!x.item)
})
watch(searchQuery, () => { aiSearch.value = null; aiAbort(''); recordedQ = '' })
/** 类型 tab 一换，候选集就换了——旧结果留着会指着不相干的卡 */
watch(currentType, () => { aiSearch.value = null; aiAbort('') })

  return {
    aiSearch, aiBusy, aiSecs, aiChars, aiTook, aiScanned, aiTotal, aiFound, aiDur, aiAbortCtl, aiTick, aiCancelMsg, aiCache, aiStopTick, aiAbort, cardFieldText, aiCands, aiProgress, aiMoreBatches, aiSearchRun, aiHitById, aiTopRows,
    SEARCH_HIST_MAX, searchHistory, topSearches, recordedQ, recordSearch,
  }
}
