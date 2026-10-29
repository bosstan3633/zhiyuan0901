/**
 * 策展画布辅助域：Markdown 模板导入与节点关联资源选择器。
 * 旧金字塔四视图、SVG 连线、节点菜单与批量打包已退役；现役画布交互由
 * useCurationMindMap + CurationMindMap 收口。
 */
import { ref, computed, watch, type ComputedRef } from 'vue'
import { showToast } from '@/shared/components/toast'
import { uid } from '@/shared/utils'
import { setThesis, projectCardToBoard } from '@/shared/storage/hub'
import { parsePyramidTemplate, type PyramidParseResult, type PyramidNode } from '@/shared/utils/mdImport'
import { CURATION_WS_ID, type AppData, type ResourceCard, type Category } from '@/shared/models'
import { POOL_DISPLAY_NAME } from '@/shared/utils/wsName'
import type { WsStore } from './useResourceView'
import type { useCurationMindMap } from './useCurationMindMap'

export interface PyramidCtx {
  store: WsStore
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  thesisCard: ComputedRef<ResourceCard | null>
  mind: ReturnType<typeof useCurationMindMap>
}

export function usePyramid(ctx: PyramidCtx) {
  const { store, d, workspaceId, thesisCard, mind } = ctx

  /** Markdown 模板只写两份数据：可选的 L1 论点卡 + Category 论证树。 */
  const pyramidImportOpen = ref(false)
  function confirmPyramidImport(payload: { pyramid?: PyramidParseResult }) {
    const pyr = payload.pyramid
    if (!pyr || !pyr.thesis) { showToast('未识别到中心论点——不写入'); return }
    let nodeTotal = 0
    const cnt = (n: PyramidNode) => { nodeTotal++; (n.children || []).forEach(cnt) }
    cnt(pyr.thesis)
    if (nodeTotal > 200) { showToast('⚠ 单次导入建议不超过 200 个节点——请分批导入'); return }
    let catCount = 0, reused = 0
    const ensureCat = (name: string, parentId?: string): Category => {
      const found = d.value.categories.find(c => c.workspaceId === workspaceId.value && !c.deletedAt && (c.parentId || undefined) === parentId && c.name === name)
      if (found) { reused++; return found }
      const cat: Category = { id: uid('cat'), workspaceId: workspaceId.value, name, order: d.value.categories.filter(c => c.workspaceId === workspaceId.value && (c.parentId || undefined) === parentId).length }
      if (parentId) cat.parentId = parentId
      d.value.categories.push(cat)
      catCount++
      return cat
    }
    const walk = (nodes: PyramidNode[], parentId?: string) => {
      for (const n of nodes) {
        const cat = ensureCat(n.name, parentId)
        if (n.desc) cat.description = n.desc
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
    } else if (pyr.thesis && thesisCard.value) {
      reused++
    }
    walk(pyr.thesis.children, undefined)
    store.persist()
    pyramidImportOpen.value = false
    mind.selectedId.value = 'root'
    showToast(`✓ 已导入论证结构：新增 ${catCount} 个分支${reused ? `，复用 ${reused} 个` : ''}`)
  }

  // ===== R65-F3：节点关联资源卡（资源台全量卡选择器 → 镜像到节点）=====
  const linkCardsModal = ref<{ catId: string; catName: string; picked: Set<string> } | null>(null)
  const linkCardsQ = ref('')
  function openLinkCards(cat: Category) {
    linkCardsQ.value = ''
    linkCardsModal.value = { catId: cat.id, catName: cat.name, picked: new Set() }
  }
  function toggleLinkPick(id: string) {
    const m = linkCardsModal.value
    if (!m) return
    if (m.picked.has(id)) m.picked.delete(id)
    else m.picked.add(id)
  }
  /** 弹窗候选的**共同底座**：资源卡池全部可镜像卡。
   *  关键词只影响**可见列表**，不进底座——与检索面板同一条纪律：AI 的候选不该被"字面没命中"提前砍掉，
   *  否则"换个说法也能召回"这个功能本身就白做了。 */
  const linkBase = computed<{ r: ResourceCard; mirrored: boolean }[]>(() => {
    if (!linkCardsModal.value) return []
    const mirroredSet = new Set((d.value.curationProjections || [])
      .filter(p => p.kind === 'card' && p.targetWsId === workspaceId.value).map(p => p.cardId))
    return d.value.resources
      .filter(r => !r.deletedAt && r.workspaceId === CURATION_WS_ID)
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
  /** 关键词 / 开关弹窗一换，AI 结果就指着不相干的卡了——与检索面板同一条纪律：立刻清 */
  watch([linkCardsQ, linkCardsModal], () => { linkAiCtl?.abort(); linkAiReset() })
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

  return {
    pyramidImportOpen, confirmPyramidImport,
    linkCardsModal, linkCardsQ, openLinkCards, toggleLinkPick, linkCandidates, confirmLinkCards,
    linkAiBusy, linkAiHits, linkAiNote, linkAiScope, linkAiFed, linkAiTook, linkAiOn, linkAiProgress, linkAiRun, linkShowList, linkAiHitOf,
  }
}
