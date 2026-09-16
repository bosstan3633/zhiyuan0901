/**
 * R117（04-61 B）资源台**定位域** composable —— 自 views/Workspace.vue 原位迁出（04-59 宿主 ≤1500 行验收线）。
 *
 * 两条定位链路共用一套「先切分类、再滚卡片」：
 *  - `?hl=<cardId>[&cat=<catId>]` 卡片定位（全局检索 / 仪表盘下钻 / 周报 drill 的落点，R49-G3 起）
 *  - `?cat=<catId>` 分类定位（该分类下有卡 → 高亮第一张；无卡 → 高亮分类行本身）
 *
 * 两处关键（R117 修复）：
 *  ① 带 `?cat=` 时必须**切到目标卡所在分类并展开其祖先**——旧实现里 `?hl=` 分支无条件
 *     `activeCategory='all'`，等于只做切片级高亮、没有「定位到具体位置」；
 *  ② R112/R116 增量渲染之后目标卡可能尚未进渲染集，`querySelector` 会找不到节点 ⇒
 *     必须先调 `ensureCardRendered`，否则定位**静默失败**。
 */
import { watch, nextTick, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { Category, ResourceCard } from '@/shared/models'
import { showToast } from '@/shared/components/toast'

export interface WsLocateCtx {
  route: RouteLocationNormalizedLoaded
  router: Router
  /** 本台分类（已按 order 排好） */
  categories: ComputedRef<Category[]>
  /** 左树折叠集合（定位时展开目标分类的祖先） */
  collapsedCats: Ref<Set<string>>
  activeCategory: Ref<string>
  viewMode: Ref<'card' | 'list' | 'kanban' | 'pyramid'>
  highlightId: Ref<string | null>
  catFlashId: Ref<string | null>
  searchQuery: Ref<string>
  debouncedQuery: Ref<string>
  /** 本台可见卡（boardCardsOf 口径） */
  allResources: ComputedRef<ResourceCard[]>
  /** 分类家族 id（含自身与全部子孙） */
  familyIds: (catId: string) => string[]
  /** 增量渲染前置——把目标卡纳入渲染集（返回 false = 该卡本轮不可渲染） */
  ensureCardRendered: (id: string) => boolean
}

export function useWsLocate(ctx: WsLocateCtx) {
  const {
    route, router, categories, collapsedCats, activeCategory, viewMode,
    highlightId, catFlashId, searchQuery, debouncedQuery, allResources, familyIds, ensureCardRendered,
  } = ctx

  /**
   * R117（04-61 B）：切到目标分类（含展开祖先）——`?hl=` 与 `?cat=` 共用。
   * 返回 false = 分类不存在（调用方自行决定回落行为）。
   */
  function applyCatLocate(cat: string): boolean {
    const c = categories.value.find(x => x.id === cat)
    if (!c) return false
    activeCategory.value = cat
    // 展开全部祖先（折叠态下定位会落空）
    let p = c.parentId ? categories.value.find(x => x.id === c.parentId) : null
    while (p) { collapsedCats.value.delete(p.id); p = p.parentId ? categories.value.find(x => x.id === p!.parentId) : null }
    return true
  }

  // ---- 卡片定位：?hl=[&cat=] ----
  watch(() => route.query.hl, (hl) => {
    if (!hl || typeof hl !== 'string') return
    highlightId.value = hl
    // R117（04-61 B）：带 ?cat= 时切到目标卡所在分类；无 cat 才回落「全部」
    const catQ = typeof route.query.cat === 'string' ? route.query.cat : ''
    if (!(catQ && applyCatLocate(catQ))) activeCategory.value = 'all'
    searchQuery.value = ''
    debouncedQuery.value = ''
    // 金字塔视图没有卡片行节点，定位前先切回卡片视图（其余视图保持用户当前选择）
    if (viewMode.value === 'pyramid') viewMode.value = 'card'
    nextTick(() => {
      setTimeout(() => {
        // 增量渲染前置：目标卡可能尚未渲染
        const known = ensureCardRendered(hl)
        nextTick(() => {
          const el = document.querySelector(`[data-rid="${hl}"]`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          else if (!known) showToast('⚠ 该卡片不在当前视图（可能被筛选或已归档）')
          setTimeout(() => { highlightId.value = null }, 2000)
        })
      }, 300)
    })
    router.replace({ path: route.path })
  }, { immediate: true })

  // ---- 分类定位：?cat=（有卡 → 选中 + 高亮第一张；无卡 → 高亮分类行） ----
  watch(() => route.query.cat, (cat) => {
    if (!cat || typeof cat !== 'string' || typeof route.query.hl === 'string') return
    if (!applyCatLocate(cat)) return
    const family = new Set(familyIds(cat))
    const first = allResources.value.find(r => family.has(r.categoryId || ''))
    nextTick(() => {
      setTimeout(() => {
        if (first) {
          highlightId.value = first.id
          // 同样先确保目标卡在渲染集里（增量渲染前置）
          ensureCardRendered(first.id)
          nextTick(() => {
            document.querySelector(`[data-rid="${first.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => { highlightId.value = null }, 2000)
          })
        } else {
          catFlashId.value = cat
          document.querySelector(`[data-catid="${cat}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => { catFlashId.value = null }, 2000)
        }
      }, 300)
    })
    router.replace({ path: route.path })
  }, { immediate: true })

  return { applyCatLocate }
}
