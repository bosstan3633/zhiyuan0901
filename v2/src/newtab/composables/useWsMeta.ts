/**
 * R115（04-59 技术债第三批 · Workspace.vue 物理拆分）：
 * 台元信息域 composable——台名/图标/描述编辑、⚙ 菜单动作（重命名/描述/导出/删除）。
 * 实现自 views/Workspace.vue 原位迁出、零行为变更；标识符经解构保留原绑定——模板零改动。
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { showToast } from '@/shared/components/toast'
import { useConfirm } from '@/shared/components/confirm'
import { CURATION_WS_ID, type AppData, type Workspace } from '@/shared/models'
import { wsDisplayNameOf, wsNameWithIcon } from '@/shared/utils/wsName'
// R146（回退契约）：删除策展台走真源（卡与分类软删 + 3 秒整台撤销）
import { deckCardCount, deleteDeck, restoreDeck } from '@/shared/utils/compassCrud'

export interface WsMetaCtx {
  store: { persist(): void }
  d: ComputedRef<AppData>
  workspaceId: ComputedRef<string>
  workspace: ComputedRef<Workspace | undefined>
  router: Router
  settingsMenuOpen: Ref<boolean>
  openInputModal: (title: string, value: string, cb: (v: string) => void) => void
}

export function useWsMeta(ctx: WsMetaCtx) {
  const { store, d, workspaceId, workspace, router, settingsMenuOpen, openInputModal } = ctx

  /** B32：名称展示统一剥离 icon 前缀（R129-B12：仅当确有 icon 且前缀匹配时才剥） */
  const wsDisplayName = computed(() => wsDisplayNameOf(workspace.value))
  function onNameBlur(e: FocusEvent) {
    const name = (e.target as HTMLElement).textContent?.trim()
    if (name && workspace.value) {
      // 保持「图标前缀 + 名称」的数据约定，同步回写
      workspace.value.name = wsNameWithIcon(workspace.value.icon, name)
      store.persist()
    }
  }
  function onNameEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }

  // ===== B32：图标管理 =====
  const WS_ICONS = ['💼', '🛠', '📚', '🎨', '🔬', '🌱', '✍️', '🎯', '🏠', '❤️', '⭐', '🔥', '💡', '📈', '🧠', '🚀', '🎵', '🏀', '🍎', '🌿', '🐘', '🦊', '🐳', '📌']
  const iconPickOpen = ref(false)
  const iconCustom = ref('')
  const iconPickPos = ref({ left: 0, top: 0 })
  function toggleIconPick(e: MouseEvent) {
    iconPickOpen.value = !iconPickOpen.value
    if (iconPickOpen.value) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      iconPickPos.value = {
        left: Math.min(r.left, window.innerWidth - 290),
        top: Math.min(r.bottom + 8, window.innerHeight - 320)
      }
    }
  }
  function setWsIcon(icon: string) {
    if (!workspace.value) return
    if (icon && !/^\p{Extended_Pictographic}$/u.test(icon)) { showToast('请输入单个 emoji 图标'); return }
    const raw = wsDisplayNameOf(workspace.value)
    workspace.value.icon = icon || ''
    workspace.value.name = wsNameWithIcon(icon, raw)
    store.persist()
    iconPickOpen.value = false
    iconCustom.value = ''
    showToast(icon ? '✓ 图标已更新' : '已删除图标（导航将显示默认图标）')
  }
  function onDescBlur(e: FocusEvent) {
    const desc = (e.target as HTMLElement).textContent?.trim()
    if (workspace.value) { workspace.value.desc = desc || ''; store.persist() }
  }
  function onDescEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }
  function renameWs() {
    const current = wsDisplayNameOf(workspace.value)
    settingsMenuOpen.value = false
    openInputModal('✏️ 重命名策展台', current, (v) => {
      if (!workspace.value) return
      workspace.value.name = wsNameWithIcon(workspace.value.icon, v)
      store.persist()
      showToast('✓ 已重命名')
    })
  }
  function editDesc() {
    settingsMenuOpen.value = false
    openInputModal('📝 编辑策展台描述', workspace.value?.desc || '', (v) => {
      if (!workspace.value) return
      workspace.value.desc = v
      store.persist()
      showToast('✓ 描述已更新')
    })
  }
  function exportWorkspace() {
    const ws = workspace.value
    if (!ws) return
    const wsId = workspaceId.value
    // R56-I：改为 AppData 子集同构导出——旧自定义形状 {workspace,categories,resources} 缺 version/tagTree/
    // tasks/curiosities/compass/stats，导入端版本校验直接拒绝，标签体系等全局数据随之丢失。
    // 现为 ...d 全量展开（全局段随行）+ 策展台段按当前台过滤；导出物可直接走「导入数据」并集合并。
    // R70：剥离 Airtable 凭证与映射——导出物会被分享/传网盘，明文 PAT 泄露＝对方可读写用户 Base。
    // 与设置页「导出数据」同口径：数据可带走，凭证不随行。
    const rootForExport = { ...d.value } as Record<string, unknown>
    delete rootForExport.airtableSync
    const data = JSON.parse(JSON.stringify({
      ...rootForExport,
      workspaces: [ws],
      categories: d.value.categories.filter(c => c.workspaceId === wsId),
      resources: d.value.resources.filter(r => r.workspaceId === wsId)
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${ws.name}_数据.json`
    a.click(); URL.revokeObjectURL(url)
    showToast('✓ 策展台数据已导出（含标签树/罗盘/任务/好奇心等全局段）')
    settingsMenuOpen.value = false
  }
  async function deleteWorkspace() {
    // R58-B1：资源台是全局策展空间，不可从此入口删除
    if (workspaceId.value === CURATION_WS_ID) { showToast('ℹ 资源台为系统空间，不在此删除'); return }
    // R146（回退契约）：接真源 deleteDeck——确认里报出会被带进回收站的卡数，删除后 3 秒可整台撤销
    const n = deckCardCount(d.value, workspaceId.value)
    if (!(await useConfirm({ title: '删除策展台', message: `确定删除策展台「${wsDisplayNameOf(workspace.value)}」？\n其中 ${n} 张资源卡与全部分类将移入回收站（可恢复）；台本身从标签栏移除，3 秒内可撤销，超时后需在回收站逐张恢复。`, confirmText: '确认删除' }))) return
    const snap = deleteDeck(d.value, workspaceId.value)
    if (!snap) { showToast('⚠ 该策展台已不存在'); return }
    store.persist()
    router.push('/compass')
    showToast(`已删除策展台「${wsDisplayNameOf(snap.ws).slice(0, 14)}」· ${snap.cardIds.length} 张卡进回收站`, { label: '撤销', cb: () => {
      restoreDeck(d.value, snap)
      store.persist()
      showToast(`✓ 已恢复策展台「${wsDisplayNameOf(snap.ws).slice(0, 14)}」及其 ${snap.cardIds.length} 张卡`)
    } })
  }

  return {
    wsDisplayName, onNameBlur, onNameEnter,
    WS_ICONS, iconPickOpen, iconCustom, iconPickPos, toggleIconPick, setWsIcon,
    onDescBlur, onDescEnter, renameWs, editDesc, exportWorkspace, deleteWorkspace,
  }
}
