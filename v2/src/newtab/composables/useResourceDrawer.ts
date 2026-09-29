/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 资源编辑抽屉域 composable——单击/双击分流、编辑抽屉 CRUD、镜像只读详情、
 * 一键清理镜像、置顶/星标、右键菜单。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 * 初始化序：晚于 useResourceOpen / useWorkspaceBatch / useWorkspaceMirror（消费其返回值）。
 */
import { ref, reactive, computed, watch, onUnmounted, nextTick, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { uid } from '@/shared/utils'
import { isMirrorView, removeProjection } from '@/shared/storage/hub'
import { recordResourceOpen } from '@/shared/storage/stats'
import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'
import type { AppData, ResourceCard, ArgumentCard, Category, AssetMeta } from '@/shared/models'
import type { WsStore } from './useResourceView'

export interface ResourceDrawerCtx {
  store: WsStore
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  router: Router
  categories: ComputedRef<Category[]>
  activeCategory: Ref<string>
  thesisCard: ComputedRef<ResourceCard | null>
  // —— 跨域依赖（初始化序保证已就绪）——
  openResourceLink: (r: ResourceCard) => void
  openImageAsset: (meta: AssetMeta) => void | Promise<void>
  setThesisCard: (r: ResourceCard) => void
  unsetThesis: () => void
  // useWorkspaceBatch
  batchMode: Ref<boolean>
  toggleSelect: (id: string) => void
  openMoveOne: (r: ResourceCard) => void
  // useWorkspaceMirror
  removeMirror: (r: ResourceCard) => void
  locateMirrorSource: (r: ResourceCard) => void
}

export function useResourceDrawer(ctx: ResourceDrawerCtx) {
  const { store, d, workspaceId, router, categories, activeCategory, thesisCard,
    openResourceLink, openImageAsset, setThesisCard, unsetThesis,
    batchMode, toggleSelect, openMoveOne,
    removeMirror, locateMirrorSource } = ctx

  // 单击（详情）与双击（打开链接）区分
  let clickTimer: ReturnType<typeof setTimeout> | null = null
  function onCardClick(r: ResourceCard) {
    if (batchMode.value) { toggleSelect(r.id); return }
    if (isMirrorView(r)) {
      // R106（F4）：镜像卡单击 = 打开只读详情（编辑定位回源卡；双击打开链接照常）
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return }
      clickTimer = setTimeout(() => { clickTimer = null; openMirrorDetail(r) }, 260)
      return
    }
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return }
    clickTimer = setTimeout(() => { clickTimer = null; openResource(r) }, 260)
  }
  function onCardDblClick(r: ResourceCard) {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
    openResourceLink(r)
  }

  // ===== 资源卡编辑抽屉 =====
  const drawerOpen = ref(false)
  const editingResource = reactive<ResourceCard>(emptyResource())
  const isNewResource = ref(false)

  // 表单主体已抽至共享 ResourceEditForm（REQ-042/#61）；此处仅保留宿主动作：打开/保存/删除/复制/跳转

  function emptyResource(): ResourceCard {
    // R126：必须显式带 isThesis:false——否则「确立中心论点」入口设置的标记会泄漏给后续新建卡（保存即覆盖 L1）
    return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: workspaceId.value, categoryId: '', description: '', tags: [], customFields: {}, pinned: false, isThesis: false, callCount: 0, createdAt: 0, updatedAt: 0, assets: [] }
  }

  /**
   * R162（严重 bug 修复）：单例 reactive 复用必须**先清键再灌入**。
   * 病根：Object.assign 不清除"本次源对象没有的键"——上一张卡的 assets / sourceType / linkType 等
   * 可选字段会残留给下一张卡（实测：给 A 卡上传 HTML 后，所有卡详情都显示该附件；在 B 卡保存还会写进 B）。
   */
  function resetEditing(target: ResourceCard, src: ResourceCard): void {
    for (const k of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[k]
    Object.assign(target, JSON.parse(JSON.stringify(src)))
  }

  /**
   * R73-S4a（L4）：资源台聚合哨兵回落。
   * 当前分类处于「全部」（聚合根）或「待分类」时，新建卡 / 导入文件 / 空白区落卡
   * 一律回落「未分类」（''），**不得把聚合键写进数据层**。
   * 口径与 CurationCenter 的 newCardCatId() 一致（'all' = 全部分类聚合根，'uncat' = 待分类）。
   */
  function newCardCatId(): string {
    const c = activeCategory.value
    return (c && c !== 'uncat' && c !== 'all') ? c : ''
  }

  // ===== R1.5：论证节点卡（V3.7.0 第 4 卡种）台内新建 =====
  // 台内新建此前仍建资源卡（uid('res') + workspaceId=台）——违反池语义不变量（资源卡唯一居所=
  // 资源卡池 zy-curation，台内呈现一律走引用式投射）。改建议论卡（台内原生卡种）。
  const argOpen = ref(false)
  const argDraft = reactive({ title: '', content: '' })
  function openNewArgument() {
    argDraft.title = ''
    argDraft.content = ''
    argOpen.value = true
  }
  function saveArgument() {
    const title = argDraft.title.trim()
    if (!title) { showToast('请输入论证要点'); return }
    const wsId = workspaceId.value
    const siblings = (d.value.argCards || []).filter(a => a.workspaceId === wsId)
    const card: ArgumentCard = {
      id: uid('arg'), kind: 'argument', title,
      content: argDraft.content.trim() || undefined,
      workspaceId: wsId,
      order: siblings.reduce((m, a) => Math.max(m, a.order ?? 0), -1) + 1,
      linkedResourceIds: [],
      customFields: {}, createdAt: Date.now(), updatedAt: Date.now(),
    }
    if (!d.value.argCards) d.value.argCards = []
    d.value.argCards.push(card)
    store.persist()
    argOpen.value = false
    showToast('✓ 论证节点卡已创建')
  }
  /** 删除论证节点卡：R1.5 过渡实现为硬删（argCards 不进回收站族——R2 DeckTabs 收编时接软删/撤销） */
  async function deleteArgument(a: ArgumentCard) {
    if (!(await useConfirm({
      title: '删除论证节点卡',
      message: `将删除「${a.title.slice(0, 24)}」，不可恢复（回收站暂不覆盖论证卡）。继续？`,
      confirmText: '确认删除'
    }))) return
    d.value.argCards = (d.value.argCards || []).filter(x => x.id !== a.id)
    store.persist()
    showToast('论证节点卡已删除')
  }
  /** 台内论证节点卡（卡片视图过渡呈现段的数据源；R2 DeckTabs 收编） */
  const argCardsOfWs = computed(() => (d.value.argCards || []).filter(a => a.workspaceId === workspaceId.value))

  function openNewResource() {
    resetEditing(editingResource, emptyResource())
    editingResource.id = uid('res')
    editingResource.createdAt = Date.now()
    // R73-S4a：聚合/待分类视图下回落未分类（与导入、空白区落卡同口径）
    editingResource.categoryId = newCardCatId()
    isNewResource.value = true
    drawerOpen.value = true
  }
  function addResourceToCategory(catId: string) {
    resetEditing(editingResource, emptyResource())
    editingResource.id = uid('res')
    editingResource.createdAt = Date.now()
    editingResource.categoryId = catId
    isNewResource.value = true
    drawerOpen.value = true
  }
  /** R106（F4）：镜像卡只读详情态——表单禁交互、footer 换定位按钮、Ctrl+Enter=定位源卡。
   *  V3.7.0（R179）：旧定位深链 /curation?hl= 随资源台页退役（redirect 落首页、query 即丢）——
   *  改与 ⌘K/卡片 🎯 同口径：落地调度台（R2 3张卡上线后接 ?hk 卡片高亮）。 */
  const drawerReadonly = ref(false)
  function openMirrorDetail(r: ResourceCard) {
    resetEditing(editingResource, r)
    isNewResource.value = false
    drawerReadonly.value = true
    drawerOpen.value = true
  }
  /** R106（F7）：一键清理本台全部镜像卡——只删投射记录（removeProjection），源卡保留在资源卡池。
   *  确认框报数；空台直接提示。源卡如需重新入台，走节点「🔗 关联资源卡」拉取（推送侧已随 R179 退役）。 */
  async function cleanAllMirrors() {
    const n = (d.value.curationProjections || []).filter(pp => pp.targetWsId === workspaceId.value).length
    if (!n) { showToast('ℹ 本台没有镜像卡'); return }
    if (!(await useConfirm({
      title: '清理本台镜像卡',
      message: `将移出本台全部 ${n} 张镜像卡（只删引用，源卡保留在资源卡池；需要时可在节点重新关联）。继续？`,
      confirmText: '确认清理'
    }))) return
    let removed = 0
    for (const pp of [...(d.value.curationProjections || [])]) {
      if (pp.targetWsId === workspaceId.value && removeProjection(d.value, pp.id)) removed++
    }
    store.persist()
    showToast(`✓ 已清理 ${removed} 张镜像卡（源卡保留在资源卡池）`)
  }
  function locateMirrorSourceCard() {
    drawerReadonly.value = false
    closeDrawer()
    router.push('/')
    showToast(`↗ 源卡在资源卡池 · ${editingResource.title.slice(0, 20)}`)
  }
  function openResource(r: ResourceCard) {
    drawerReadonly.value = false
    resetEditing(editingResource, r)
    isNewResource.value = false
    drawerOpen.value = true
    // 单击打开详情 = 一次调用（WRR 口径）
    recordResourceOpen(d.value, r)
    store.persistHot?.()
  }
  /**
   * R167：AI 采纳后把抽屉里的表单同步成**已落库**的值。
   * 采纳是直接写库（R154 拍板①），而本抽屉编辑的是 `editingResource` 副本——不同步就会
   * "AI 明明写了、抽屉还显示旧字"，用户再点保存反而把 AI 的结果覆盖回去。
   */
  function syncEditingFromStore(): void {
    const live = d.value.resources.find(x => x.id === editingResource.id && !x.deletedAt)
    if (!live) return
    editingResource.title = live.title
    editingResource.description = live.description
    editingResource.tags = [...(live.tags || [])]
    editingResource.categoryId = live.categoryId
    editingResource.aiTouchedAt = live.aiTouchedAt
  }

  // R106（F4）：只读详情期 Ctrl+Enter = 定位源卡——document 捕获（焦点常在 body，元素级绑不住）；closeDrawer/watch 双路摘除
  function onRoCtrlEnter(e: KeyboardEvent) {
    if (!drawerOpen.value || !drawerReadonly.value) return
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); locateMirrorSourceCard() }
  }
  watch(drawerReadonly, (v) => {
    if (v) document.addEventListener('keydown', onRoCtrlEnter, true)
    else document.removeEventListener('keydown', onRoCtrlEnter, true)
  })
  watch(drawerOpen, (v) => { if (!v) { drawerReadonly.value = false; document.removeEventListener('keydown', onRoCtrlEnter, true) } })
  onUnmounted(() => document.removeEventListener('keydown', onRoCtrlEnter, true))

  function closeDrawer() { drawerOpen.value = false }
  function saveResource() {
    if (drawerReadonly.value) { showToast('📡 镜像卡为引用——编辑请到源卡'); return } // R106（F4）：只读守卫（防 Tab 聚焦写穿）
    if (!editingResource.title.trim()) { showToast('请输入标题'); return }
    if (isNewResource.value) {
      d.value.resources.unshift({ ...editingResource })
    } else {
      const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
      if (idx >= 0) d.value.resources[idx] = { ...editingResource }
    }
    store.persist()
    drawerOpen.value = false
    showToast('✓ 已保存')
  }
  async function deleteCurrentResource() {
    const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
    if (idx >= 0) d.value.resources[idx].deletedAt = Date.now()
    store.persist()
    drawerOpen.value = false
    const target = idx >= 0 ? d.value.resources[idx] : null
    showToast(target ? `已删除「${target.title.slice(0, 20)}」` : '资源卡已删除', { label: '撤销', cb: () => {
      // REQ-030：按 id 从当前数据树查找（persist 后 onChanged 会整树替换引用，闭包旧引用已失效）
      const cur = d.value.resources.find(x => x.id === editingResource.id)
      if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
    } })
  }
  async function deleteResource(r: ResourceCard) {
    if (isMirrorView(r)) { removeMirror(r); return }
    r.deletedAt = Date.now()
    store.persist()
    // REQ-030：3 秒内可撤销（按 id 定位当前树，根治引用替换导致的撤销失效）
    showToast(`已删除「${r.title.slice(0, 20)}」`, { label: '撤销', cb: () => {
      const cur = d.value.resources.find(x => x.id === r.id)
      if (cur && cur.deletedAt) { cur.deletedAt = undefined; store.persist() }
    } })
  }
  function togglePin(r: ResourceCard) {
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——置顶请在源卡处操作'); return }
    r.pinned = !r.pinned
    r.updatedAt = Date.now()
    store.persist()
    showToast(r.pinned ? '📌 已置顶' : '已取消置顶')
  }
  /** 第卅三轮 REQ-020：星标切换（独立于置顶，可叠加） */
  function toggleStar(r: ResourceCard) {
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——星标请在源卡处操作'); return }
    r.starred = !r.starred
    r.updatedAt = Date.now()
    store.persist()
    showToast(r.starred ? '⭐ 已星标，搜索时优先展示' : '已取消星标')
  }
  function copyLink() {
    if (!editingResource.link) { showToast('无链接'); return }
    navigator.clipboard.writeText(editingResource.link).then(() => showToast('✓ 链接已复制'))
  }
  /**
   * R87（R7-②）：「⚠ 待补全」徽标的一键补全 —— 打开详情抽屉并把光标送进链接输入框。
   * 镜像卡是策展台里的只读引用（与 📌⭐🗑 同款拦截），补全得上源卡（池内真身）。
   */
  const resFormRef = ref<InstanceType<typeof ResourceEditForm> | null>(null)
  function fixLink(r: ResourceCard) {
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——补全路径请到源卡'); return }
    openResource(r)
    nextTick(() => resFormRef.value?.focusLink())
  }

  // B5：右键菜单
  const resCtx = ref({ open: false, x: 0, y: 0 })
  const resCtxItems = ref<{ label: string; icon?: string; danger?: boolean; cb: () => void }[]>([])
  function openResCtx(e: MouseEvent, r: ResourceCard) {
    if (isMirrorView(r)) {
      // R61：镜像卡右键——只读引用语义（打开/复制/定位源/移出镜像）
      resCtxItems.value = [
        { label: '打开链接', icon: 'arrowright', cb: () => openResourceLink(r) },
        { label: '复制链接', icon: 'copy', cb: () => { if (r.link) { navigator.clipboard.writeText(r.link); showToast('✓ 链接已复制') } } },
        { label: '🎯 定位到源卡', icon: 'folder', cb: () => locateMirrorSource(r) },
        { label: '✕ 移出镜像', icon: 'trash', danger: true, cb: () => removeMirror(r) }
      ]
    } else {
      // R158（拍板④/任务书⑤）：右键重排——「高频在卡面、长尾在右键」。置顶/星标从卡面一级条降级后在此前置；
      // 链接类相邻（打开/复制）；危险项（删除）恒居底。卡面一级 = AI徽标/移动/删除/⋯（⋯ 复用本菜单）。
      resCtxItems.value = [
        { label: '打开链接', icon: 'arrowright', cb: () => openResourceLink(r) },
        { label: '复制链接', icon: 'copy', cb: () => { if (r.link) { navigator.clipboard.writeText(r.link); showToast('✓ 链接已复制') } } },
        // R90（R10）：编辑——右键直达抽屉。此前右键菜单只有"打开链接"，要**改**内容必须先单击卡进详情
        { label: '✏️ 编辑详情', icon: 'edit', cb: () => openResource(r) },
        { label: r.pinned ? '取消置顶' : '置顶', icon: 'pin', cb: () => togglePin(r) },
        // R90（R10）：星标——toggleStar 能力早就在、hover 动作条早早就有 ⭐，右键此前一直缺
        { label: r.starred ? '☆ 取消星标' : '⭐ 星标', icon: 'star', cb: () => toggleStar(r) },
        { label: '移动分类', icon: 'folder', cb: () => openMoveOne(r) },
        // V3.7.0（R179）：「📡 镜像到策展台」随资源台退役——真身唯一入池，策展台经投射引用（推送入口退役，拉取走挂载/投射）。
        // R62-3：中心论点（每台一张；设即替换旧论点）
        r.isThesis
          ? { label: '取消中心论点', icon: 'target', cb: () => unsetThesis() }
          : { label: '🏛 设为中心论点', icon: 'target', cb: () => setThesisCard(r) },
        { label: '删除', icon: 'trash', danger: true, cb: () => deleteResource(r) }
      ]
    }
    resCtx.value = { open: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 240) }
  }

  return {
    onCardClick, onCardDblClick,
    drawerOpen, editingResource, isNewResource, drawerReadonly,
    newCardCatId, openNewResource, addResourceToCategory, openMirrorDetail,
    argOpen, argDraft, openNewArgument, saveArgument, argCardsOfWs, deleteArgument,
    cleanAllMirrors, locateMirrorSourceCard, openResource, closeDrawer, syncEditingFromStore,
    saveResource, deleteCurrentResource, deleteResource, togglePin, toggleStar, copyLink,
    resFormRef, fixLink, resCtx, resCtxItems, openResCtx,
  }
}

export type { Category }
