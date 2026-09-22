<script setup lang="ts">
import { computed, ref, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { wsDisplayNameOf } from '@/shared/utils/wsName'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from './stores/app'
import { useCompass } from './stores/compass'
import { uid } from '@/shared/utils'
import { CURATION_WS_ID, type Workspace } from '@/shared/models'
import Toast from '@/shared/components/Toast.vue'
import { showToast } from '@/shared/components/toast'
import GlobalPopups from './components/GlobalPopups.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useConfirm } from '@/shared/components/confirm'
// R146（回退契约）：策展台「归档 / 删除」两语义真源
import { archiveWorkspace, deckCardCount } from '@/shared/utils/compassCrud'
import Icon from '@/shared/components/Icon.vue'
import logoUrl from '@/assets/logo.png'
import { getBytesInUse, subscribeSaveError, clearLastSaveError } from '@/shared/storage/repository'
import { emitOpenDrawer } from '@/shared/utils/bus'
import { runSync } from '@/shared/storage/airtable'
import ResourceDetailDrawer from './components/ResourceDetailDrawer.vue'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const compassData = useCompass().d
// B30a：全局渲染错误边界——捕获后保持导航可用，内容区显示错误卡片，杜绝整页不可用
const renderError = ref<string | null>(null)
onErrorCaptured((err) => {
  console.error('[知源] 渲染错误已拦截：', err)
  renderError.value = (err instanceof Error ? err.message : String(err)) || '未知渲染错误'
  return false
})
function reloadPage() { location.reload() }
const globalPopups = ref<InstanceType<typeof GlobalPopups> | null>(null)

// R53-D：主题精简为四套（删除 原野绿/暗夜红；存量 green/night 由 repository 启动迁移到深空薰衣草）
const themes = [
  { id: 'linear', name: '深空薰衣草', dot: '#5E6AD2' },
  { id: 'raycast', name: '光速黑', dot: '#5E6AD2' },
  { id: 'apple', name: '极简白', dot: '#5E6AD2' },
  { id: 'notion', name: '纸墨白', dot: '#5E6AD2' }
]

/** R106（F2）→ R108（F10）修订：资源台/策展台容器与调度台/方向台统一为 1440 居中后，
 *  顶栏三档简化为：主页面（调度台/方向台/资源台/策展台）1440 居中 · 设置 1200 · 手册 1120；
 *  顶栏左缘 = 当前页正文左缘（三页切换零跳动感）。 */
const topbarAlign = computed(() => {
  const p = route.path
  if (p.startsWith('/settings')) return 'align-settings'
  if (p.startsWith('/manual')) return 'align-manual'
  return 'align-page'
})

// 策展台折叠状态
const workspacesCollapsed = ref(false)
const themeOpen = ref(false)

function toggleTheme(e: MouseEvent) {
  e.stopPropagation()
  themeOpen.value = !themeOpen.value
}
function selectTheme(id: string) {
  store.setTheme(id)
  themeOpen.value = false
}
const activeWorkspaceId = computed(() => {
  const match = route.path.match(/^\/workspace\/(.+)/)
  return match ? match[1] : null
})

// R105（E2）：策展台 >5 时页签收起——默认只显示前 5 个 + 「≪ N」溢出指示，hover/点击「≪ N」展开全部；
// 当前所在台在前 5 之外时始终显示（"我在哪"不可丢）。与既有 «/» 手动折叠（仅工作台页生效）正交。
const E2_TAB_MAX = 5
const wsOverflowOpen = ref(false)
const wsOverflow = computed(() => store.workspaces.length > E2_TAB_MAX)
const visibleWorkspaces = computed(() => {
  if (workspacesCollapsed.value && activeWorkspaceId.value) {
    return store.workspaces.filter(w => w.id === activeWorkspaceId.value)
  }
  if (wsOverflow.value && !wsOverflowOpen.value) {
    const active = activeWorkspaceId.value
    const head = store.workspaces.slice(0, E2_TAB_MAX)
    if (active && !head.some(w => w.id === active)) {
      const act = store.workspaces.find(w => w.id === active)
      if (act) return [...head.slice(0, E2_TAB_MAX - 1), act]
    }
    return head
  }
  return store.workspaces
})
const hiddenWsCount = computed(() => (wsOverflow.value && !wsOverflowOpen.value)
  ? store.workspaces.length - visibleWorkspaces.value.length
  : 0)

function navigate(path: string) { router.push(path) }

const activeTab = computed(() => {
  if (route.path === '/') return 'home'
  if (route.path.startsWith('/compass')) return 'compass'
  if (route.path.startsWith('/curation')) return 'curation'
  // R73（R16 收敛）：/curation 已 redirect 到 /workspace/zy-curation ⇒ hub 工作区同样点亮「资源台」Tab
  if (activeWorkspaceId.value === CURATION_WS_ID) return 'curation'
  if (route.path.startsWith('/settings')) return 'settings'
  return activeWorkspaceId.value || 'home'
})

/** 方向台 Tab 点击（R49：调度台/方向台/资源台三系统页 + 用户策展台） */
function openCompass() {
  navigate('/compass')
}
/** 资源台（R61：原策展中心转正——资源卡唯一存储与镜像源头） */
function openResource() {
  navigate('/curation')
}

// 策展台 CRUD
const addingWs = ref(false)
const newWsName = ref('')
const wsIcons = ['💼', '🛠', '📚', '🎨', '🔬', '🌱', '✍️', '🎯']

function addWorkspace() {
  addingWs.value = true
  newWsName.value = ''
  setTimeout(() => {
    const input = document.getElementById('ws-name-input') as HTMLInputElement
    input?.focus()
  }, 50)
}
function confirmAddWs() {
  // B31：Enter 与 blur 双触发守卫——先关输入框并清空名称，保证只创建一次
  if (!addingWs.value) return
  const name = newWsName.value.trim()
  addingWs.value = false
  newWsName.value = ''
  if (!name) { return }
  const ws: Workspace = {
    id: uid('ws'),
    name: `${wsIcons[store.workspaces.length % wsIcons.length]} ${name}`,
    icon: wsIcons[store.workspaces.length % wsIcons.length],
    color: '#3A6B4C',
    coverTheme: 'deep-sea',
    order: store.workspaces.length,
    archived: false
  }
  store.data!.workspaces.push(ws)
  // 自动创建待分类
  store.data!.categories.push({
    id: uid('cat'), workspaceId: ws.id, name: '待分类', order: 0
  })
  store.persist()
  navigate(`/workspace/${ws.id}`)
  showToast(`策展台「${name}」已创建`)
}

// 右键菜单
const menuWs = ref<Workspace | null>(null)
const menuPos = ref({ x: 0, y: 0 })
const renamingWs = ref<string | null>(null)
const renameDraft = ref('')

function onTabContextMenu(e: MouseEvent, ws: Workspace) {
  e.preventDefault()
  menuWs.value = ws
  menuPos.value = { x: e.clientX, y: e.clientY }
}
function closeMenu() { menuWs.value = null }

function startRename() {
  if (!menuWs.value) return
  renamingWs.value = menuWs.value.id
  renameDraft.value = wsDisplayNameOf(menuWs.value)
  closeMenu()
  setTimeout(() => {
    const input = document.getElementById('ws-rename-input') as HTMLInputElement
    input?.focus()
    input?.select()
  }, 50)
}
function confirmRename() {
  if (!renamingWs.value) return
  const ws = store.data!.workspaces.find(w => w.id === renamingWs.value)
  if (ws && renameDraft.value.trim()) {
    ws.name = `${ws.icon} ${renameDraft.value.trim()}`
    store.persist()
    showToast('已重命名')
  }
  renamingWs.value = null
}
/** R146（回退契约）：台签右键这项**不是删除而是归档**——原实现 archived=true + 卡搬走，
 *  却与 ⚙ 菜单里"卡进回收站"的真删除共用「删除策展台」同名，两入口两种数据命运。
 *  现改名并接真源 archiveWorkspace；原生 confirm 换应用内确认（四主题一致）。 */
async function archiveDeck() {
  const ws = menuWs.value
  closeMenu()
  if (!ws || !store.data) return
  if (ws.id === CURATION_WS_ID) { showToast('ℹ 资源台为系统空间，不在此归档'); return }
  const n = deckCardCount(store.data, ws.id)
  if (!(await useConfirm({ title: '归档策展台', message: `确定归档「${wsDisplayNameOf(ws)}」？\n其下 ${n} 张资源卡将搬到其它策展台的「待分类」（卡片不删），此台从标签栏收起，可在设置 · 重置与回滚附近找回。`, confirmText: '归档' }))) return
  const r = archiveWorkspace(store.data, ws)
  store.persist()
  if (activeWorkspaceId.value === ws.id) navigate('/')
  showToast(`📦 已归档「${wsDisplayNameOf(ws).slice(0, 14)}」· ${r.moved} 张卡移至待分类`)
}

// ===== 全局快捷键 =====
// Esc 关闭弹窗；修饰键+数字 = 应用内切台（R117 拍板：1 调度台 / 2 方向台 / 3 资源台 / 4+ 策展台）
// 调度台刷新自动回首页。
function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

function switchToIndex(n: number) {
  // R117（04-61 C3）拍板改口径：**Alt+1 调度台（落地首页）/ Alt+2 方向台 / Alt+3 资源台 / Alt+4.. 用户策展台**
  // （台签顺序计数，拖拽改序后数字键跟随顺序，不绑定具体台）。
  // 旧口径 R68-F3（1=方向台、2=资源台、3+=策展台）废止——调度台是默认落地页，占 1 号位更好记。
  if (n === 1) { navigate('/'); return }
  if (n === 2) { openCompass(); return }
  if (n === 3) { openResource(); return }
  const ws = store.workspaces[n - 4]
  if (ws) navigate(`/workspace/${ws.id}`)
  else showToast(`没有第 ${n} 号台（当前共 ${store.workspaces.length} 个策展台）`)
}

// ===== 第廿九轮：策展台 Tab 拖拽排序 =====
let dragWsId: string | null = null
const wsDropMark = ref('')
function onWsTabDragStart(e: DragEvent, ws: Workspace) {
  dragWsId = ws.id
  e.dataTransfer?.setData('text/plain', ws.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onWsTabDragOver(e: DragEvent, ws: Workspace) {
  if (!dragWsId || dragWsId === ws.id) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const after = (e.clientX - rect.left) / rect.width > 0.5
  wsDropMark.value = ws.id + (after ? '-r' : '-l')
}
function onWsTabDragLeave(ws: Workspace) {
  if (wsDropMark.value.startsWith(ws.id)) wsDropMark.value = ''
}
function onWsTabDragEnd() { dragWsId = null; wsDropMark.value = '' }
function onWsTabDrop(e: DragEvent, ws: Workspace) {
  e.preventDefault(); e.stopPropagation()
  const after = wsDropMark.value.endsWith('-r')
  wsDropMark.value = ''
  if (!dragWsId || dragWsId === ws.id) { dragWsId = null; return }
  // 顺序权威=导航顺序：按插入位重排后全量规整 order 回写（B8 教训）
  const list = [...store.workspaces]
  const from = list.findIndex(w => w.id === dragWsId)
  if (from < 0) { dragWsId = null; return }
  const [moved] = list.splice(from, 1)
  const ti = list.findIndex(w => w.id === ws.id)
  if (ti < 0) { list.splice(from, 0, moved); dragWsId = null; return }
  list.splice(after ? ti + 1 : ti, 0, moved)
  list.forEach((w, i) => { w.order = i })
  store.persist()
  dragWsId = null
  showToast('✓ 已调整策展台顺序')
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.code === 'Escape') {
    globalPopups.value?.closeAll()
    return
  }
  // O18：应用内切台修饰键五种可选（默认 Alt）
  const mod = store.ui?.wsSwitchMod || 'alt'
  let modPressed = false
  if (mod === 'ctrl') modPressed = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
  else if (mod === 'alt') modPressed = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
  else if (mod === 'ctrl-shift') modPressed = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey
  else if (mod === 'alt-shift') modPressed = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey
  else modPressed = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
  // B3：? 呼出快捷键速查
  if (e.key === '?' && !isEditableTarget(e)) { e.preventDefault(); globalPopups.value?.openPanel('shortcuts'); return }
  if (modPressed && /^Digit[1-9]$/.test(e.code) && !isEditableTarget(e)) {
    e.preventDefault()
    switchToIndex(Number(e.code.slice(5)))
  }
}
onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown, true)
  // R131-C6a：启动 idle 预热退役——每开一个新标签页都后台拉 ~312KB 拼音字典，与「按需加载」交付口径相悖；
  // 字典改由搜索面板打开时 ensurePinyin（GlobalPopups）/ 网页浮层唤起时（overlay-impl）加载，
  // pinyinReady 就绪后结果链自动补跑拼音命中（V2.21 既有机制），首屏与多标签页内存不再为该预热买单。
  // 第卅六轮 REQ-038：初始化时拉一次容量，给顶栏备份提醒红点用
  refreshBytes().catch(() => {})
  // 监听 storage onChanged，更新容量（兜底：首次安装或 import 后变化）
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes as Record<string, chrome.storage.StorageChange>)['zy_data_v2']) {
        refreshBytes().catch(() => {})
      }
    })
  } catch (e) { console.warn('[zy] storage.onChanged 监听注册失败（扩展上下文失效），容量红点将不会实时更新', e) }
  // 第卅六轮 REQ-038：保存失败（quota/serial）→ Toast 告警
  subscribeSaveError((e) => {
    const tag = e.kind === 'quota' ? '配额超限' : e.kind === 'serial' ? '序列化失败' : '写入异常'
    const sz = e.bytesInUse != null ? `（已用 ${Math.round(e.bytesInUse / 1024)} KB）` : ''
    showToast(`⚠ 数据保存失败：${tag}${sz}，请清理或导出后重试`, {
      label: '查看', cb: () => { clearLastSaveError(); navigate('/settings?page=about') }
    })
  })
  // 监听 background 发来的消息（扩展快捷键触发）
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'zy-ping') { sendResponse({ ok: true }); return true }
    if (msg?.type === 'zy-where') { sendResponse({ path: route.path }); return true }
    if (msg?.type === 'zy-open-search') globalPopups.value?.openPanel('search')
    else if (msg?.type === 'zy-open-capture') globalPopups.value?.openPanel('capture')
    else if (msg?.type === 'zy-open-curiosity') globalPopups.value?.openPanel('curio')
    else if (msg?.type === 'zy-open-task-capture') globalPopups.value?.openPanel('taskcapture')
    // 策展台单例定位（G）：跳转到目标策展台并高亮资源卡
    else if (msg?.type === 'zy-locate') {
      const wsId: string = msg.wsId || ''
      const hl: string = msg.hl || ''
      if (wsId) {
        router.push({ path: `/workspace/${wsId}`, query: hl ? { hl } : undefined })
      }
    }
    // 通用路由跳转（B4：搜索结果定位任务/好奇心；第卅六轮扩展 drawer 参数）
    else if (msg?.type === 'zy-route') {
      if (msg.route) router.push(msg.route).catch(() => {})
      // R67-F4：模块直达锚点（好奇心培养/项目调度）——路由落位后派发全局事件
      if (msg.anchor) {
        const anchor = String(msg.anchor)
        setTimeout(() => window.dispatchEvent(new CustomEvent('zy-goto-anchor', { detail: anchor })), 150)
      }
      if (msg.drawer && (msg.drawer as any).kind && (msg.drawer as any).id) {
        // 微延迟，等 router 切到目标页 + 对应组件 onMounted 注册监听
        setTimeout(() => emitOpenDrawer(msg.drawer), 80)
      }
    }
    // R49-I4：background 命令透传 toast（资源台占位提示等）
    else if (msg?.type === 'zy-toast' && msg.text) {
      showToast(String(msg.text))
    }
    // R63-8/63-10：background 触发 Airtable 同步（命令/轮询）——只在 newtab 上下文写数据
    else if (msg?.type === 'zy-airtable-sync') {
      runAirtableSync(msg.silent !== false)
    }
  })
  // R63-8：background 开的新页带自动同步标记 → 挂载后执行一次
  if (new URLSearchParams(location.search).has('zy-autosync')) {
    setTimeout(() => runAirtableSync(new URLSearchParams(location.search).get('zy-autosync') === '1'), 1500)
  }
  // R67-F4：background 开的新页带模块直达标记（?zy-anchor=curiosity|project）→ 视图挂载后定位闪烁
  const zyAnchor = new URLSearchParams(location.search).get('zy-anchor')
  if (zyAnchor) setTimeout(() => window.dispatchEvent(new CustomEvent('zy-goto-anchor', { detail: zyAnchor })), 900)
})

// ---- R63：Airtable 同步执行器（单例防重入；配置缺失静默跳过，手动触发给 toast） ----
let atSyncBusy = false
async function runAirtableSync(withToast: boolean): Promise<void> {
  if (atSyncBusy) return
  const s = store.data?.airtableSync
  if (!s?.pat || !s.baseId || !s.tableId) {
    if (withToast) showToast('请先在 设置 → Airtable 同步 完成连接配置')
    return
  }
  atSyncBusy = true
  try {
    const r = await runSync(store.data!)
    store.persist()
    if (withToast) showToast(`✓ Airtable 同步完成：推送 ${r.pushed} 条 · 调用 ${r.calls} 次`)
  } catch (e) {
    store.persist()
    if (withToast) showToast('✗ Airtable 同步失败：' + (e instanceof Error ? e.message : String(e)))
  } finally { atSyncBusy = false }
}
onUnmounted(() => { window.removeEventListener('keydown', onGlobalKeydown, true) })

// R45-5（V2.20.0）：资源引擎 Tab 角标彻底移除——不做任务管理平台，去掉任务数催办感（理念对齐：项目驱动）

// 第卅六轮 REQ-038：备份提醒红点（30 天未导出 或 容量超 50 MB，且开关启用）
// 第卅八轮 V2.14.3：已申请 unlimitedStorage 容量不受限，5MB 提醒线失去意义 → 上调 50MB（用户拍板）
const BACKUP_REMIND_DAYS = 30
const BACKUP_REMIND_BYTES = 50 * 1024 * 1024
const bytesInUse = ref(0)
async function refreshBytes() { bytesInUse.value = await getBytesInUse() }
const backupReminderDot = computed(() => {
  const ui: any = store.ui || {}
  if (ui.backupReminderEnabled === false) return false
  const last = typeof ui.lastBackupAt === 'number' ? ui.lastBackupAt : 0
  const ageDays = last ? (Date.now() - last) / 86400000 : Infinity
  if (ageDays > BACKUP_REMIND_DAYS) return true
  if (bytesInUse.value > BACKUP_REMIND_BYTES) return true
  return false
})

</script>

<template>
  <div class="app-shell" @click="menuWs && closeMenu(); themeOpen && (themeOpen = false)">
    <header class="topbar">
      <div class="topbar-inner" :class="topbarAlign">
      <nav class="tabs" @mouseleave="wsOverflowOpen = false">
        <!-- 固定页：调度台 / 方向台 / 资源台（R49 三大系统页） -->
        <div class="tab" :class="{active: activeTab === 'home'}" @click="navigate('/')">
          <img :src="logoUrl" class="home-logo" alt="知源调度台">调度台
        </div>
        <div class="tab" :class="{active: activeTab === 'compass'}" @click="openCompass">
          <Icon name="compass" :size="15" />方向台
        </div>
        <div class="tab tab-reserved" :class="{active: activeTab === 'curation'}" title="资源台 · 资源卡唯一存储与镜像源头" @click="openResource">
          <Icon name="layout" :size="15" />资源台
        </div>

        <div class="tab-divider" />

        <!-- 策展台列表（第廿九轮：Tab 拖拽排序，仅策展台区间内换位，固定页锚点不变） -->
        <div
          v-for="ws in visibleWorkspaces" :key="ws.id"
          class="tab" :class="{active: activeTab === ws.id, 'drop-line-l': wsDropMark === ws.id + '-l', 'drop-line-r': wsDropMark === ws.id + '-r'}"
          :draggable="renamingWs !== ws.id"
          @click="navigate(`/workspace/${ws.id}`)"
          @contextmenu="onTabContextMenu($event, ws)"
          @dragstart="onWsTabDragStart($event, ws)" @dragend="onWsTabDragEnd"
          @dragover="onWsTabDragOver($event, ws)" @dragleave="onWsTabDragLeave(ws)" @drop="onWsTabDrop($event, ws)"
        >
          <template v-if="renamingWs === ws.id">
            <input
              id="ws-rename-input"
              v-model="renameDraft"
              class="tab-rename-input"
              @click.stop
              @keydown.enter="confirmRename"
              @keydown.esc="renamingWs = null"
              @blur="confirmRename"
            />
          </template>
          <template v-else>
            <span>{{ ws.icon || '📁' }}</span>{{ wsDisplayNameOf(ws) }}
          </template>
        </div>

        <!-- R105（E2）：溢出指示——hover 展开（离开顶栏自动收起），点击亦可保持展开 -->
        <div v-if="hiddenWsCount > 0" class="tab tab-overflow"
          :title="`其余 ${hiddenWsCount} 个策展台`"
          @mouseenter="wsOverflowOpen = true" @click.stop="wsOverflowOpen = !wsOverflowOpen">
          ≪ {{ hiddenWsCount }}
        </div>

        <!-- 新增策展台 -->
        <div v-if="addingWs" class="tab adding">
          <input
            id="ws-name-input"
            v-model="newWsName"
            class="tab-rename-input"
            placeholder="策展台名称…"
            @keydown.enter="confirmAddWs"
            @keydown.esc="addingWs = false"
            @blur="confirmAddWs"
          />
        </div>
        <div v-else class="tab tab-add" title="新增策展台" @click="addWorkspace">＋</div>

        <!-- 折叠/展开 -->
        <div v-if="store.workspaces.length > 1" class="tab tab-collapse"
          :title="workspacesCollapsed ? '展开策展台' : '收起策展台'"
          @click="workspacesCollapsed = !workspacesCollapsed">
          {{ workspacesCollapsed ? '»' : '«' }}
        </div>
      </nav>

      <div class="topbar-right">
        <div class="theme-select">
          <button class="theme-btn" @click="toggleTheme">
            <span class="theme-dot" :style="{ background: themes.find(t => t.id === store.theme)?.dot }"></span>
            {{ themes.find(t => t.id === store.theme)?.name }}
            <span class="theme-caret">▾</span>
          </button>
          <Transition name="fade">
            <div v-if="themeOpen" class="theme-dropdown">
              <div v-for="t in themes" :key="t.id" class="theme-option" :class="{active: store.theme === t.id}" @click="selectTheme(t.id)">
                <span class="theme-dot" :style="{ background: t.dot }"></span>
                {{ t.name }}
                <span v-if="store.theme === t.id" class="theme-check">✓</span>
              </div>
            </div>
          </Transition>
        </div>
        <div class="icon-btn" title="全局搜索 (Ctrl+K)" @click="globalPopups?.openPanel('search')"><Icon name="search" :size="16" /></div>
        <div class="icon-btn icon-btn-bell" :class="{ 'has-dot': backupReminderDot }" title="设置" @click="navigate('/settings')">
          <Icon name="settings" :size="16" />
          <span v-if="backupReminderDot" class="bell-dot" title="建议导出备份" />
        </div>
      </div>
      </div><!-- /topbar-inner（R105-F2：顶栏与正文容器对齐） -->
    </header>

    <main class="page-container">
      <template v-if="!renderError">
        <!-- C1：移除 out-in 过渡（每次切换强制串行两段动画 ~300ms），切换即时渲染
             R65-F7：KeepAlive 缓存调度台/资源台/策展台三主视图——切台免重挂载（595ms 基线的主要构成）；
             三视图均以 store 响应式数据为源，缓存仅省去 DOM 重建与首次计算
             R73（R16 收敛）：资源台两入口合一后不再有独立视图；R74 旧入口组件已删除。
             R148-P1a：设置页与回收站纳入缓存——设置页 3500+ 行、挂载即算 lcCards/gFlat/tagUsage，
             每次进都全量重挂是"切模块卡"的主要来源之一（实测冷挂 190ms / 二挂 101ms） -->
        <router-view v-slot="{ Component }">
          <keep-alive include="CompassHomeView,WorkspaceView,CompassShell,GlobalSettingsView,RecycleBinView">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </template>
      <!-- B30a：渲染错误兜底卡片（替代黑屏，保持系统可用） -->
      <div v-else class="render-error">
        <div class="re-icon">⚠️</div>
        <div class="re-title">页面渲染出错（已拦截，系统其余功能不受影响）</div>
        <div class="re-msg">{{ renderError }}</div>
        <div class="re-actions">
          <button class="re-btn" @click="renderError = null">🔄 重试渲染</button>
          <button class="re-btn" @click="reloadPage">刷新页面</button>
        </div>
        <div class="re-hint">💡 若反复出现，请按 F12 打开控制台截图完整报错并反馈</div>
      </div>
    </main>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="menuWs" class="ctx-menu" :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }" @click.stop>
        <div class="ctx-item" @click="startRename">✏️ 重命名</div>
        <div class="ctx-item" @click="archiveDeck">📦 归档此台（卡移至待分类）</div>
      </div>
    </Teleport>

    <GlobalPopups ref="globalPopups" />
    <ResourceDetailDrawer />
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
/* R123（原型）：顶栏 48px（原 56px），对齐原型 top-nav */
.topbar { position: sticky; top: 0; z-index: var(--z-sticky); height: 48px; display: flex; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
/* R106（F2）：顶栏内容容器按路由对齐各页正文容器（左缘一致） */
.topbar-inner { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; }
/* R155-①：全局容器统一 1440（原注释写 1560，但 align-page 实际早已是 1440 ⇒ 属注释漂移，非事实）。
   设置页 1200 / 手册 1120 一并对齐到 1440，并把 padding 统一为 36px——
   仅统一 max-width 而留不同 padding，左缘仍会差 12px，"跨台对齐"不成立。 */
.topbar-inner.align-page { max-width: 1440px; margin: 0 auto; padding: 0 36px; }
.topbar-inner.align-settings { max-width: 1440px; margin: 0 auto; padding: 0 36px; }
.topbar-inner.align-manual { max-width: 1440px; margin: 0 auto; padding: 0 36px; }
.tabs { display: flex; align-items: center; gap: 2px; flex: 1; overflow-x: auto; }
.home-logo { width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; }
/* R123（原型）：tab 6×12、active = 浅紫填充块（accent-light + accent 600），下划线退役 */
.tab { padding: 6px 12px; border-radius: var(--radius-xs); font-size: var(--fs-body); font-weight: 500; color: var(--text-2); cursor: pointer; display: flex; align-items: center; gap: 7px; transition: color var(--dur) ease, background var(--dur) ease; position: relative; white-space: nowrap; }
.tab:hover { background: var(--surface-2); color: var(--text); }
.tab.active { color: var(--accent); background: var(--accent-light); font-weight: 600; }
/* R45-5：.badge 样式随角标移除一并清理（全应用已无渲染点） */
.tab-divider { width: 1px; height: 20px; background: var(--border); margin: 0 6px; }
/* R49：资源台占位（下轮交付）——弱化呈现 */
.tab.tab-reserved { opacity: .45; }
.tab.tab-reserved:hover { opacity: .8; }
.tab.drop-line-l { box-shadow: inset 2px 0 0 var(--accent); }
.tab.drop-line-r { box-shadow: inset -2px 0 0 var(--accent); }
.tab-add { padding: 8px 12px; color: var(--text-3); font-size: 16px; font-weight: 300; }
.tab-add:hover { color: var(--accent); }
.tab-collapse { padding: 8px 10px; color: var(--text-3); font-size: var(--fs-body); }
/* R105（E2）：溢出指示页签——accent 提示可展开 */
.tab-overflow { color: var(--accent); background: var(--accent-light); font-variant-numeric: tabular-nums; }
.tab-rename-input { border: 1px solid var(--accent); border-radius: 6px; padding: 2px 8px; font-size: var(--fs-body); font-family: inherit; outline: none; width: 100px; background: var(--surface); color: var(--text); box-shadow: 0 0 0 3px var(--accent-glow); }
.tab.adding { padding: 4px 10px; }
/* B30a：错误边界卡片 */
.render-error { margin: 60px auto; max-width: 520px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px 30px; text-align: center; box-shadow: var(--shadow); }
.render-error .re-icon { font-size: 38px; margin-bottom: 10px; }
.render-error .re-title { font-size: var(--fs-title); font-weight: 700; color: var(--text); margin-bottom: 8px; }
.render-error .re-msg { font-size: var(--fs-sub); color: var(--tag-danger-text); background: var(--tag-danger-bg); border-radius: 8px; padding: 8px 12px; word-break: break-all; margin-bottom: 16px; }
.render-error .re-actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 12px; }
.render-error .re-btn { padding: 8px 18px; border-radius: 9px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-body); font-weight: 600; cursor: pointer; font-family: inherit; }
.render-error .re-btn:hover { background: var(--accent-hover); }
.render-error .re-hint { font-size: var(--fs-caption); color: var(--text-3); }

.topbar-right { display: flex; align-items: center; gap: 8px; }
.theme-select { position: relative; }
.theme-btn { border: 1px solid transparent; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; background: var(--surface); transition: all var(--dur); font-family: inherit; }
.theme-btn:hover { border-color: var(--border-strong); }
.theme-caret { font-size: var(--fs-micro); opacity: .6; }
.theme-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.theme-dropdown { position: absolute; top: calc(100% + 6px); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; min-width: 130px; z-index: var(--z-overlay); }
.theme-option { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 7px; font-size: var(--fs-sub); color: var(--text-2); cursor: pointer; transition: all .1s; }
.theme-option:hover { background: var(--surface-3); color: var(--text); }
.theme-option.active { color: var(--accent); font-weight: 600; }
.theme-check { margin-left: auto; font-size: var(--fs-caption); }
.fade-enter-active, .fade-leave-active { transition: opacity var(--dur), transform var(--dur); }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.icon-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; color: var(--text-2); transition: all var(--dur); font-size: 16px; position: relative; }
.icon-btn:hover { background: var(--surface-3); color: var(--text); }
/* 第卅六轮 REQ-038：备份提醒红点（顶栏设置按钮） */
.icon-btn-bell.has-dot .bell-dot { display: block; }
.bell-dot { display: none; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 2px var(--bg, #fff); }
.page-container { flex: 1; }


.ctx-menu { position: fixed; z-index: var(--z-modal); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; min-width: 140px; }
.ctx-item { padding: 8px 12px; border-radius: 7px; font-size: var(--fs-body); color: var(--text-2); cursor: pointer; transition: all .1s; }
.ctx-item:hover { background: var(--surface-3); color: var(--text); }
.ctx-item.danger:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }
</style>
