<script setup lang="ts">
import { computed, ref, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from './stores/app'
import { uid, dateKey } from '@/shared/utils'
import type { Workspace } from '@/shared/models'
import Toast from '@/shared/components/Toast.vue'
import { showToast } from '@/shared/components/toast'
import GlobalPopups from './components/GlobalPopups.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import Icon from '@/shared/components/Icon.vue'
import logoUrl from '@/assets/logo.png'
import { getBytesInUse, subscribeSaveError, clearLastSaveError } from '@/shared/storage/repository'
import { emitOpenDrawer } from '@/shared/utils/bus'
import ResourceDetailDrawer from './components/ResourceDetailDrawer.vue'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
// B30a：全局渲染错误边界——捕获后保持导航可用，内容区显示错误卡片，杜绝整页不可用
const renderError = ref<string | null>(null)
onErrorCaptured((err) => {
  console.error('[知源] 渲染错误已拦截：', err)
  renderError.value = (err instanceof Error ? err.message : String(err)) || '未知渲染错误'
  return false
})
function reloadPage() { location.reload() }
const globalPopups = ref<InstanceType<typeof GlobalPopups> | null>(null)

const themes = [
  { id: 'linear', name: '深空薰衣草', dot: '#5E6AD2' },
  { id: 'green', name: '原野绿', dot: '#10A56E' },
  { id: 'night', name: '暗夜红', dot: '#E8374A' },
  { id: 'apple', name: '极简白', dot: '#0071E3' },
  { id: 'raycast', name: '光速黑', dot: '#FF6363' },
  { id: 'notion', name: '纸墨白', dot: '#2383E2' }
]

// 工作台折叠状态
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

const visibleWorkspaces = computed(() => {
  if (workspacesCollapsed.value && activeWorkspaceId.value) {
    return store.workspaces.filter(w => w.id === activeWorkspaceId.value)
  }
  return store.workspaces
})

function navigate(path: string) { router.push(path) }

const activeTab = computed(() => {
  if (route.path === '/') return 'home'
  if (route.path.startsWith('/compass')) return 'compass'
  if (route.path.startsWith('/settings')) return 'settings'
  return activeWorkspaceId.value || 'home'
})

/** 罗盘 Tab 点击：固定进入今日行动（O15） */
function openCompass() {
  navigate('/compass/actions')
}

// 工作台 CRUD
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
  showToast(`工作台「${name}」已创建`)
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
  renameDraft.value = menuWs.value.name.replace(/^[^\s]+\s/, '')
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
function deleteWorkspace() {
  if (!menuWs.value) return
  const ws = menuWs.value
  if (!confirm(`确认删除工作台「${ws.name}」？其中的资源卡将移至待分类。`)) { closeMenu(); return }
  ws.archived = true
  // 资源卡移至第一个可用工作台的待分类
  const otherWs = store.data!.workspaces.find(w => !w.archived && w.id !== ws.id)
  if (otherWs) {
    let cat = store.data!.categories.find(c => c.workspaceId === otherWs.id && c.name === '待分类')
    if (!cat) {
      cat = { id: uid('cat'), workspaceId: otherWs.id, name: '待分类', order: 0 }
      store.data!.categories.push(cat)
    }
    store.data!.resources.filter(r => r.workspaceId === ws.id).forEach(r => {
      r.workspaceId = otherWs.id
      r.categoryId = cat!.id
    })
  }
  store.persist()
  closeMenu()
  if (activeWorkspaceId.value === ws.id) navigate('/')
  showToast('工作台已删除')
}

// ===== 全局快捷键 =====
// Esc 关闭弹窗；Ctrl+1=知源罗盘、Ctrl+2/3…=工作台（修饰键可配置）；首页不设快捷键（刷新自动回首页）
// 第廿九轮拍板：快捷键跟随位置——switchToIndex 按导航顺序取工作台，拖动 Tab 调位后映射随之变化
function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

function switchToIndex(n: number) {
  // n=1 → 知源罗盘；n>=2 → 第 n-1 个工作台
  if (n === 1) { openCompass(); return }
  const ws = store.workspaces[n - 2]
  if (ws) navigate(`/workspace/${ws.id}`)
}

// ===== 第廿九轮：工作台 Tab 拖拽排序 =====
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
  showToast('✓ 已调整工作台顺序')
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.code === 'Escape') {
    globalPopups.value?.closeAll()
    return
  }
  // O18：工作台切换修饰键五种可选（默认 Alt）
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
  // 第卅六轮 REQ-038：初始化时拉一次容量，给顶栏备份提醒红点用
  refreshBytes().catch(() => {})
  // 监听 storage onChanged，更新容量（兜底：首次安装或 import 后变化）
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes as Record<string, chrome.storage.StorageChange>)['zy_data_v2']) {
        refreshBytes().catch(() => {})
      }
    })
  } catch {}
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
    // 工作台单例定位（G）：跳转到目标工作台并高亮资源卡
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
      if (msg.drawer && (msg.drawer as any).kind && (msg.drawer as any).id) {
        // 微延迟，等 router 切到目标页 + 对应组件 onMounted 注册监听
        setTimeout(() => emitOpenDrawer(msg.drawer), 80)
      }
    }
  })
})
onUnmounted(() => { window.removeEventListener('keydown', onGlobalKeydown, true) })

// 角标 = 今日三件事未完成数（≤3），挂知源罗盘主 Tab
const taskBadge = computed(() => {
  if (!store.data) return 0
  const list = store.data.dailyFocus[dateKey(new Date())] || []
  return list.filter(s => !s.done).length
})

// 第卅六轮 REQ-038：备份提醒红点（30 天未导出 或 容量超 5 MB，且开关启用）
const BACKUP_REMIND_DAYS = 30
const BACKUP_REMIND_BYTES = 5 * 1024 * 1024
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
      <nav class="tabs">
        <!-- 固定页 -->
        <div class="tab" :class="{active: activeTab === 'home'}" @click="navigate('/')">
          <img :src="logoUrl" class="home-logo" alt="知源工作台">首页
        </div>
        <div class="tab" :class="{active: activeTab === 'compass'}" @click="openCompass">
          <Icon name="compass" :size="15" />知源罗盘<span v-if="taskBadge" class="badge">{{ taskBadge }}</span>
        </div>

        <div class="tab-divider" />

        <!-- 工作台列表（第廿九轮：Tab 拖拽排序，仅工作台区间内换位，固定页锚点不变） -->
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
            <span>{{ ws.icon || '📁' }}</span>{{ ws.name.replace(/^[^\s]+\s/, '') }}
          </template>
        </div>

        <!-- 新增工作台 -->
        <div v-if="addingWs" class="tab adding">
          <input
            id="ws-name-input"
            v-model="newWsName"
            class="tab-rename-input"
            placeholder="工作台名称…"
            @keydown.enter="confirmAddWs"
            @keydown.esc="addingWs = false"
            @blur="confirmAddWs"
          />
        </div>
        <div v-else class="tab tab-add" title="新增工作台" @click="addWorkspace">＋</div>

        <!-- 折叠/展开 -->
        <div v-if="store.workspaces.length > 1" class="tab tab-collapse"
          :title="workspacesCollapsed ? '展开工作台' : '收起工作台'"
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
    </header>

    <main class="page-container">
      <template v-if="!renderError">
        <!-- C1：移除 out-in 过渡（每次切换强制串行两段动画 ~300ms），切换即时渲染 -->
        <router-view v-slot="{ Component }">
          <component :is="Component" />
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
        <div class="ctx-item danger" @click="deleteWorkspace">🗑 删除工作台</div>
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
.topbar { position: sticky; top: 0; z-index: 100; height: 56px; display: flex; align-items: center; padding: 0 20px; gap: 2px; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.tabs { display: flex; align-items: center; gap: 2px; flex: 1; overflow-x: auto; }
.home-logo { width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; }
.tab { padding: 7px 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; color: var(--text-2); cursor: pointer; display: flex; align-items: center; gap: 7px; transition: color .15s ease, background .15s ease; position: relative; white-space: nowrap; }
.tab:hover { background: var(--surface-3); color: var(--text); }
.tab.active { color: var(--accent); font-weight: 600; }
.tab.active { color: var(--text); }
.tab.active::after { content: ''; position: absolute; bottom: -14px; left: 12px; right: 12px; height: 2px; background: var(--accent); border-radius: 2px; }
.tab .badge { background: var(--danger); color: #fff; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 99px; min-width: 16px; text-align: center; }
.tab-divider { width: 1px; height: 20px; background: var(--border); margin: 0 6px; }
.tab.drop-line-l { box-shadow: inset 2px 0 0 var(--accent); }
.tab.drop-line-r { box-shadow: inset -2px 0 0 var(--accent); }
.tab-add { padding: 8px 12px; color: var(--text-3); font-size: 16px; font-weight: 300; }
.tab-add:hover { color: var(--accent); }
.tab-collapse { padding: 8px 10px; color: var(--text-3); font-size: 13px; }
.tab-rename-input { border: 1px solid var(--accent); border-radius: 6px; padding: 2px 8px; font-size: 13px; font-family: inherit; outline: none; width: 100px; background: var(--surface); color: var(--text); box-shadow: 0 0 0 3px var(--accent-glow); }
.tab.adding { padding: 4px 10px; }
/* B30a：错误边界卡片 */
.render-error { margin: 60px auto; max-width: 520px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px 30px; text-align: center; box-shadow: var(--shadow); }
.render-error .re-icon { font-size: 38px; margin-bottom: 10px; }
.render-error .re-title { font-size: 14.5px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
.render-error .re-msg { font-size: 12px; color: var(--tag-danger-text); background: var(--tag-danger-bg); border-radius: 8px; padding: 8px 12px; word-break: break-all; margin-bottom: 16px; }
.render-error .re-actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 12px; }
.render-error .re-btn { padding: 8px 18px; border-radius: 9px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.render-error .re-btn:hover { background: var(--accent-hover); }
.render-error .re-hint { font-size: 11px; color: var(--text-3); }

.topbar-right { display: flex; align-items: center; gap: 8px; }
.theme-select { position: relative; }
.theme-btn { border: 1px solid transparent; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; color: var(--text-2); cursor: pointer; background: var(--surface); transition: all .15s; font-family: inherit; }
.theme-btn:hover { border-color: var(--border-strong); }
.theme-caret { font-size: 9px; opacity: .6; }
.theme-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.theme-dropdown { position: absolute; top: calc(100% + 6px); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; min-width: 130px; z-index: 200; }
.theme-option { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 7px; font-size: 12px; color: var(--text-2); cursor: pointer; transition: all .1s; }
.theme-option:hover { background: var(--surface-3); color: var(--text); }
.theme-option.active { color: var(--accent); font-weight: 600; }
.theme-check { margin-left: auto; font-size: 11px; }
.fade-enter-active, .fade-leave-active { transition: opacity .15s, transform .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.icon-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; color: var(--text-2); transition: all .15s; font-size: 16px; position: relative; }
.icon-btn:hover { background: var(--surface-3); color: var(--text); }
/* 第卅六轮 REQ-038：备份提醒红点（顶栏设置按钮） */
.icon-btn-bell.has-dot .bell-dot { display: block; }
.bell-dot { display: none; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 2px var(--bg, #fff); }
.page-container { flex: 1; }


.ctx-menu { position: fixed; z-index: 300; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-lg); padding: 5px; min-width: 140px; }
.ctx-item { padding: 8px 12px; border-radius: 7px; font-size: 12.5px; color: var(--text-2); cursor: pointer; transition: all .1s; }
.ctx-item:hover { background: var(--surface-3); color: var(--text); }
.ctx-item.danger:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }
</style>
