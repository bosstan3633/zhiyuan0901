/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 资源编辑抽屉域 composable——单击/双击分流、编辑抽屉 CRUD、镜像只读详情、
 * 一键清理镜像、置顶/星标、右键菜单。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 * 初始化序：晚于 useResourceOpen / useWorkspaceBatch / useWorkspaceMirror（消费其返回值）。
 */
import { ref, reactive, watch, onUnmounted, nextTick, type ComputedRef, type Ref } from 'vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import type { Router } from 'vue-router'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { uid } from '@/shared/utils'
import { isMirrorView, removeProjection } from '@/shared/storage/hub'
import { recordResourceOpen } from '@/shared/storage/stats'
import ResourceEditForm from '@/newtab/components/ResourceEditForm.vue'
import type { AppData, ResourceCard, TaskCard, Category, AssetMeta } from '@/shared/models'
import type { WsStore } from './useResourceView'

export interface ResourceDrawerCtx {
  store: WsStore
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  router: Router
  isHub: ComputedRef<boolean>
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
  openMountOne: (r: ResourceCard) => void
  mountedTaskCount: (r: ResourceCard) => number
  // useWorkspaceMirror
  openMirrorCard: (r: ResourceCard) => void
  removeMirror: (r: ResourceCard) => void
  locateMirrorSource: (r: ResourceCard) => void
}

export function useResourceDrawer(ctx: ResourceDrawerCtx) {
  const { store, d, workspaceId, router, isHub, categories, activeCategory, thesisCard,
    openResourceLink, openImageAsset, setThesisCard, unsetThesis,
    batchMode, toggleSelect, openMoveOne, openMountOne, mountedTaskCount,
    openMirrorCard, removeMirror, locateMirrorSource } = ctx

  // 单击（详情）与双击（打开链接）区分
  let clickTimer: ReturnType<typeof setTimeout> | null = null
  function onCardClick(r: ResourceCard) {
    if (batchMode.value) { toggleSelect(r.id); return }
    if (isMirrorView(r)) {
      // R106（F4）：镜像卡单击 = 打开只读详情（编辑定位回资源台；双击打开链接照常）
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
  let drawerOriginalWsId = '' // REQ-004：跨策展台迁移检测基准（打开/新建时记录）

  function emptyResource(): ResourceCard {
    // R126：必须显式带 isThesis:false——否则「确立中心论点」入口设置的标记会泄漏给后续新建卡（保存即覆盖 L1）
    return { id: '', kind: 'resource', title: '', linkType: 'url', link: '', workspaceId: workspaceId.value, categoryId: '', description: '', tags: [], customFields: {}, pinned: false, isThesis: false, callCount: 0, createdAt: 0, updatedAt: 0 }
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

  function openNewResource() {
    Object.assign(editingResource, emptyResource())
    editingResource.id = uid('res')
    editingResource.createdAt = Date.now()
    drawerOriginalWsId = editingResource.workspaceId
    // R73-S4a：聚合/待分类视图下回落未分类（与导入、空白区落卡同口径）
    editingResource.categoryId = newCardCatId()
    isNewResource.value = true
    drawerOpen.value = true
  }
  function addResourceToCategory(catId: string) {
    Object.assign(editingResource, emptyResource())
    editingResource.id = uid('res')
    editingResource.createdAt = Date.now()
    editingResource.categoryId = catId
    drawerOriginalWsId = editingResource.workspaceId
    isNewResource.value = true
    drawerOpen.value = true
  }
  /** R106（F4）：镜像卡只读详情态——表单禁交互、footer 换定位按钮、Ctrl+Enter=定位源卡。
   *  镜像 id 即源卡 id（boardCardsOf 浅拷贝），定位走 /curation?hl=<id>（redirect 透传 query）。 */
  const drawerReadonly = ref(false)
  function openMirrorDetail(r: ResourceCard) {
    Object.assign(editingResource, JSON.parse(JSON.stringify(r)))
    drawerOriginalWsId = editingResource.workspaceId
    isNewResource.value = false
    drawerReadonly.value = true
    drawerOpen.value = true
  }
  /** R106（F7）：一键清理本台全部镜像卡——只删投射记录（removeProjection），源卡保留在资源台。
   *  确认框报数；空台直接提示。源卡如需重建镜像，走资源台 📡 推送即可。 */
  async function cleanAllMirrors() {
    const n = (d.value.curationProjections || []).filter(pp => pp.targetWsId === workspaceId.value).length
    if (!n) { showToast('ℹ 本台没有镜像卡'); return }
    if (!(await useConfirm({
      title: '清理本台镜像卡',
      message: `将移出本台全部 ${n} 张镜像卡（只删引用，源卡保留在资源台；可随时重新镜像）。继续？`,
      confirmText: '确认清理'
    }))) return
    let removed = 0
    for (const pp of [...(d.value.curationProjections || [])]) {
      if (pp.targetWsId === workspaceId.value && removeProjection(d.value, pp.id)) removed++
    }
    store.persist()
    showToast(`✓ 已清理 ${removed} 张镜像卡（源卡保留在资源台）`)
  }
  function locateMirrorSourceCard() {
    const id = editingResource.id
    drawerReadonly.value = false
    closeDrawer()
    router.push('/curation?hl=' + id)
    showToast('↗ 已定位到资源台源卡')
  }
  function openResource(r: ResourceCard) {
    drawerReadonly.value = false
    Object.assign(editingResource, JSON.parse(JSON.stringify(r)))
    drawerOriginalWsId = editingResource.workspaceId
    isNewResource.value = false
    drawerOpen.value = true
    // 单击打开详情 = 一次调用（WRR 口径）
    recordResourceOpen(d.value, r)
    store.persist()
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
    if (drawerReadonly.value) { showToast('📡 镜像卡为引用——请到资源台编辑'); return } // R106（F4）：只读守卫（防 Tab 聚焦写穿）
    if (!editingResource.title.trim()) { showToast('请输入标题'); return }
    // REQ-004：检测是否跨策展台迁移，保存后给出迁移反馈
    const wsChanged = editingResource.workspaceId !== drawerOriginalWsId
    if (isNewResource.value) {
      d.value.resources.unshift({ ...editingResource })
    } else {
      const idx = d.value.resources.findIndex(r => r.id === editingResource.id)
      if (idx >= 0) d.value.resources[idx] = { ...editingResource }
    }
    store.persist()
    drawerOpen.value = false
    if (wsChanged) {
      const target = d.value.workspaces.find(w => w.id === editingResource.workspaceId)
      showToast(`✓ 已保存并迁移至「${wsDisplayNameOf(target) || '目标策展台'}」`)
    } else {
      showToast('✓ 已保存')
    }
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
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——置顶请在资源台操作'); return }
    r.pinned = !r.pinned
    r.updatedAt = Date.now()
    store.persist()
    showToast(r.pinned ? '📌 已置顶' : '已取消置顶')
  }
  /** 第卅三轮 REQ-020：星标切换（独立于置顶，可叠加） */
  function toggleStar(r: ResourceCard) {
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——星标请在资源台操作'); return }
    r.starred = !r.starred
    r.updatedAt = Date.now()
    store.persist()
    showToast(r.starred ? '⭐ 已星标，搜索时优先展示' : '已取消星标')
  }
  function copyLink() {
    if (!editingResource.link) { showToast('无链接'); return }
    navigator.clipboard.writeText(editingResource.link).then(() => showToast('✓ 链接已复制'))
  }
  // 挂载任务点击（共享表单 emit goto-task）→ 跳任务中心
  function goToTask(t: TaskCard) {
    router.push('/')
    showToast(`已跳转任务中心：${t.title}`)
  }

  /**
   * R87（R7-②）：「⚠ 待补全」徽标的一键补全 —— 打开详情抽屉并把光标送进链接输入框。
   * 镜像卡是策展台里的只读引用（与 📌⭐🗑 同款拦截），补全得上资源台真身卡。
   */
  const resFormRef = ref<InstanceType<typeof ResourceEditForm> | null>(null)
  function fixLink(r: ResourceCard) {
    if (isMirrorView(r)) { showToast('📡 镜像卡为引用——补全路径请到资源台'); return }
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
        { label: '🎯 定位到资源台', icon: 'folder', cb: () => locateMirrorSource(r) },
        { label: '✕ 移出镜像', icon: 'trash', danger: true, cb: () => removeMirror(r) }
      ]
    } else {
      resCtxItems.value = [
        { label: '打开链接', icon: 'arrowright', cb: () => openResourceLink(r) },
        { label: '复制链接', icon: 'copy', cb: () => { if (r.link) { navigator.clipboard.writeText(r.link); showToast('✓ 链接已复制') } } },
        // R90（R10）：编辑——右键直达抽屉。此前右键菜单只有"打开链接"，要**改**内容必须先单击卡进详情
        { label: '✏️ 编辑详情', icon: 'edit', cb: () => openResource(r) },
        { label: '移动分类', icon: 'folder', cb: () => openMoveOne(r) },
        // R82（R4）：挂载到任务——与动作条同一入口的两条路径之一。镜像分支不提供（只读引用）。
        { label: mountedTaskCount(r) ? `挂载到任务（已挂 ${mountedTaskCount(r)}）` : '挂载到任务…', icon: 'clipboard', cb: () => openMountOne(r) },
        // R90（R10）：镜像到策展台——**仅资源台真身卡**有语义（策展台的卡源头就是资源台，再推给别的台无意义）。
        // openMirrorCard 内部已对「还没有策展台」给提示，此处不重复兜底。
        ...(isHub.value ? [{ label: '📡 镜像到策展台', icon: 'share', cb: () => openMirrorCard(r) }] : []),
        { label: r.pinned ? '取消置顶' : '置顶', icon: 'pin', cb: () => togglePin(r) },
        // R90（R10）：星标——toggleStar 能力早就在、hover 动作条早早就有 ⭐，右键此前一直缺
        { label: r.starred ? '☆ 取消星标' : '⭐ 星标', icon: 'star', cb: () => toggleStar(r) },
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
    cleanAllMirrors, locateMirrorSourceCard, openResource, closeDrawer,
    saveResource, deleteCurrentResource, deleteResource, togglePin, toggleStar, copyLink, goToTask,
    resFormRef, fixLink, resCtx, resCtxItems, openResCtx,
  }
}

export type { Category }
