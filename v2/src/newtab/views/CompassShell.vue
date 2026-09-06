<script setup lang="ts">
import Icon from '@/shared/components/Icon.vue'
/**
 * 方向台 · 一级工作区（R49 V2.22.0 三大系统页改版）
 * 满宽模块化：指标条（方向状态）→ 主航线（愿景→使命→战略目标→项目）→ 项目总览
 * 二级覆盖层：完整方向树（/compass/tree）、项目详情（/compass/projects）
 */
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompass } from '../stores/compass'
import { useAppStore } from '../stores/app'
import { saveUIPrefs } from '@/shared/storage/repository'
import { uid } from '@/shared/utils'
import { useConfirm } from '@/shared/components/confirm'
import { showToast } from '@/shared/components/toast'
import type { Project } from '@/shared/models'
import LighthousePanel from '../components/compass/LighthousePanel.vue'
import TaskManagerPanel from '../components/compass/TaskManagerPanel.vue'

const router = useRouter()
const route = useRoute()
const isChildActive = computed(() => route.matched.length > 1 && route.path !== '/compass')
const store = useAppStore()
const { d, allProjects, projectProgress, isProjectStalled, isProjectDone } = useCompass()

// R55-B3：/compass?zone=task → 滚动定位到任务调度模块并高亮（置于声明之后，避免 TDZ）
watch(() => route.query.zone, (z) => {
  if (z !== 'task') return
  nextTick(() => {
    const el = document.getElementById('task-mgmt-module')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('module-flash')
    setTimeout(() => el.classList.remove('module-flash'), 1500)
  })
}, { immediate: true })

// ---- 已完成项目显隐（C6：与主航线/完整方向树三处同步；R52-BUG-2 口径统一 isProjectDone） ----
const showDone = computed(() => store.ui?.showDoneProjects !== false)
function toggleShowDone() {
  const next = !showDone.value
  if (store.ui) store.ui.showDoneProjects = next
  saveUIPrefs({ showDoneProjects: next })
}
/** 项目总览（按显隐开关过滤） */
const visibleProjects = computed(() => allProjects().filter(p => showDone.value || !isProjectDone(p)))

const projectsCount = computed(() => visibleProjects.value.length)
const pinnedCount = computed(() => visibleProjects.value.filter(p => p.pinnedToLighthouse).length)
const doneProjects = computed(() => allProjects().filter(p => isProjectDone(p)).length)

/** 项目总览卡（C5：名称/战略目标/🎯/📋/状态） */
function goalNameOf(p: Project): string {
  const dir = d.value.compass.directions.find(d2 => d2.projects.some(x => x.id === p.id))
  return dir?.name || '—'
}
function openProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}
function openTree() {
  router.push('/compass/tree')
}
const stalled = (p: Project) => isProjectStalled(p)

/* ================= C8 项目总览管理增强：新建 / 编辑 / 删除 / 置顶分组 / 拖拽排序 ================= */
/** 项目列表按 order 稳定（渲染 computed 不原地 sort 红线：先副本再排） */
function sortedCopy(list: Project[]): Project[] {
  return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}
const pinnedGroup = computed<Project[]>(() => sortedCopy(visibleProjects.value.filter(p => p.pinned)))
const normalGroup = computed<Project[]>(() => sortedCopy(visibleProjects.value.filter(p => !p.pinned)))

/** 新建项目（选所属战略目标） */
const createOpen = ref(false)
const createDirId = ref('')
const createName = ref('')
function openCreate() {
  if (!d.value.compass.directions.length) { showToast('还没有战略目标——请先到完整方向树创建'); openTree(); return }
  createDirId.value = d.value.compass.directions[0]!.id
  createName.value = ''
  createOpen.value = true
}
function confirmCreate() {
  const name = createName.value.trim()
  if (!name) { showToast('请输入项目名称'); return }
  const dir = d.value.compass.directions.find(x => x.id === createDirId.value)
  if (!dir) { showToast('请选择所属战略目标'); return }
  const proj: Project = { id: uid('proj'), name, isFocused: false, pinnedToLighthouse: false, pinned: false, progress: 0, status: 'active', order: dir.projects.length, metrics: [] }
  dir.projects.push(proj)
  store.persist()
  createOpen.value = false
  showToast(`✓ 项目「${name}」已创建`)
}
/** 原位改名（contenteditable blur 保存；编辑中禁用拖拽防冲突） */
const editingProjId = ref<string | null>(null)
function renameProject(p: Project, e: FocusEvent) {
  editingProjId.value = null
  const v = (e.target as HTMLElement).textContent?.trim()
  if (v && v !== p.name) { p.name = v; store.persist(); showToast('✓ 项目名已更新') }
  else if (e.target) (e.target as HTMLElement).textContent = p.name
}
function onNameEnter(e: KeyboardEvent) { (e.target as HTMLElement).blur() }
/** 删除项目（摘除式：任务转未归档、指标随项目移除、不进回收站——D1 拍板口径） */
async function removeProject(p: Project) {
  const taskCount = d.value.tasks.filter(t => !t.deletedAt && t.projectId === p.id).length
  const ok = await useConfirm({
    title: '删除项目',
    message: taskCount ? `确定删除「${p.name}」？\n其下 ${taskCount} 个任务将转为「未归档任务」（不删除，可重新关联），${p.metrics.length} 个成功指标随项目移除。` : `确定删除「${p.name}」？`,
    confirmText: '确认删除',
    danger: true
  })
  if (!ok) return
  const metricIds = new Set(p.metrics.map(m => m.id))
  for (const t of d.value.tasks) {
    if (t.projectId === p.id) { t.projectId = undefined; t.metricId = undefined; t.updatedAt = Date.now() }
    else if (t.metricId && metricIds.has(t.metricId)) { t.metricId = undefined; t.updatedAt = Date.now() }
  }
  for (const dir of d.value.compass.directions) {
    const idx = dir.projects.findIndex(x => x.id === p.id)
    if (idx >= 0) { dir.projects.splice(idx, 1); break }
  }
  store.persist()
  showToast(`已删除「${p.name}」` + (taskCount ? `，${taskCount} 个任务转为未归档` : ''))
}
/** 置顶切换（与 📡投射独立） */
function togglePin(p: Project) {
  p.pinned = !p.pinned
  store.persist()
  showToast(p.pinned ? '📌 已置顶' : '已取消置顶')
}
/** 组内拖拽排序（order 全量规整回写，与工作台 Tab 同模式） */
let dragProjId: string | null = null
let dragFromPinned = false
function onProjDragStart(e: DragEvent, p: Project) {
  dragProjId = p.id
  dragFromPinned = !!p.pinned
  ;(e.currentTarget as HTMLElement).classList.add('dragging')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onProjDragEnd(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('dragging')
  dragProjId = null
}
function onProjDrop(e: DragEvent, target: Project) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  if (!dragProjId || dragProjId === target.id) { dragProjId = null; return }
  if (dragFromPinned !== !!target.pinned) {
    showToast('跨区移动请先用 📌 置顶/取消置顶')
    dragProjId = null
    return
  }
  const sectionIds = (target.pinned ? pinnedGroup.value : normalGroup.value).map(x => x.id)
  const fi = sectionIds.indexOf(dragProjId)
  const ti = sectionIds.indexOf(target.id)
  if (fi < 0 || ti < 0) { dragProjId = null; return }
  sectionIds.splice(ti, 0, sectionIds.splice(fi, 1)[0])
  sectionIds.forEach((id, i) => {
    const x = allProjects().find(v => v.id === id)
    if (x) x.order = i
  })
  store.persist()
  dragProjId = null
  showToast('✓ 已调整排序')
}
function onProjDragOver(e: DragEvent, p: Project) {
  if (!dragProjId || dragProjId === p.id || dragFromPinned !== !!p.pinned) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).classList.add('drag-over')
}
function onProjDragLeave(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
}
</script>

<template>
  <!-- R50-B1/B2：子路由激活时满宽渲染二级页（完整方向树/项目详情），否则渲染三模块 -->
  <RouterView v-if="isChildActive" />
  <div v-else class="page">
    <div class="page-head">
      <div class="crumb"><b>方向台</b> · 主航线与项目全景</div>
      <div class="spacer" />
      <button class="mini-btn" @click="openTree"><Icon name="branch" :size="13" /> 完整方向树</button>
    </div>

    <!-- 模块一 · 主航线（R55-D1：方向状态四格已迁调度台顶部） -->
    <section class="module">
      <LighthousePanel />
    </section>

    <!-- 模块三 · 项目总览（满宽 3 列） -->
    <section class="module">
      <div class="ov-card">
        <div class="ov-head">
          <span class="ic"><Icon name="layout" :size="16" /></span>
          <span class="nm">项目总览</span>
          <span class="en">PROJECT OVERVIEW</span>
          <span class="ds">{{ projectsCount }} 项目 · {{ pinnedCount }} 已投射<template v-if="showDone"> · {{ doneProjects }} 已完成</template></span>
          <span class="ov-toggle" :class="{ off: !showDone }" @click="toggleShowDone" title="与主航线/完整方向树三处同步">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}</span>
          <span class="ov-link" @click="openTree">去方向树管理 ›</span>
          <button class="ov-add" @click="openCreate">＋ 新建项目</button>
        </div>
        <!-- 📌 置顶组 -->
        <div v-if="pinnedGroup.length" class="ov-section">
          <div class="ov-sec-label">📌 已置顶 <span>{{ pinnedGroup.length }}</span></div>
          <div class="ov-grid">
            <div v-for="p in pinnedGroup" :key="p.id" class="ov-card-item" :class="{focused: p.isFocused, archived: p.status === 'archived'}" :draggable="editingProjId !== p.id"
              @dragstart="onProjDragStart($event, p)" @dragend="onProjDragEnd" @dragover.prevent="onProjDragOver($event, p)" @dragleave="onProjDragLeave" @drop="onProjDrop($event, p)"
              @click="openProject(p)">
              <div class="ov-name">
                <span class="ov-pname" contenteditable="true" spellcheck="false" @click.stop @focus="editingProjId = p.id" @blur="renameProject(p, $event)" @keydown.enter.prevent="onNameEnter">{{ p.name }}</span>
                <span v-if="p.isFocused" class="chip chip-accent">🎯 主攻</span>
                <span v-if="p.pinnedToLighthouse" class="chip">📡 已投射</span>
                <span v-if="stalled(p)" class="chip chip-warn">⚠ 停滞</span>
              </div>
              <div class="ov-goal">服务战略目标 · {{ goalNameOf(p) }}</div>
              <div class="ov-meta">
                <span>🎯 {{ p.metrics.length }}</span>
                <span>📋 {{ projectProgress(p).total }}</span>
                <span class="ov-progress"><i :style="{ width: projectProgress(p).pct + '%' }" /></span>
                <span class="ov-pct">{{ projectProgress(p).pct }}%</span>
              </div>
              <div class="ov-tools" @click.stop>
                <button class="ov-tool on" title="取消置顶" @click.stop="togglePin(p)">📌</button>
                <button class="ov-tool" title="投射灯塔" :class="{on: p.pinnedToLighthouse}" @click.stop="p.pinnedToLighthouse = !p.pinnedToLighthouse; store.persist()">📡</button>
                <button class="ov-tool danger" title="删除项目（任务转未归档）" @click.stop="removeProject(p)">🗑</button>
              </div>
            </div>
          </div>
        </div>
        <!-- 全部组 -->
        <div class="ov-section">
          <div class="ov-sec-label" :style="pinnedGroup.length ? '' : 'margin-top:0'">📦 全部项目 <span>{{ normalGroup.length }}</span></div>
          <div class="ov-grid">
            <div v-for="p in normalGroup" :key="p.id" class="ov-card-item" :class="{focused: p.isFocused, archived: p.status === 'archived'}" :draggable="editingProjId !== p.id"
              @dragstart="onProjDragStart($event, p)" @dragend="onProjDragEnd" @dragover.prevent="onProjDragOver($event, p)" @dragleave="onProjDragLeave" @drop="onProjDrop($event, p)"
              @click="openProject(p)">
              <div class="ov-name">
                <span class="ov-pname" contenteditable="true" spellcheck="false" @click.stop @focus="editingProjId = p.id" @blur="renameProject(p, $event)" @keydown.enter.prevent="onNameEnter">{{ p.name }}</span>
                <span v-if="p.isFocused" class="chip chip-accent">🎯 主攻</span>
                <span v-if="p.pinnedToLighthouse" class="chip">📡 已投射</span>
                <span v-if="stalled(p)" class="chip chip-warn">⚠ 停滞</span>
              </div>
              <div class="ov-goal">服务战略目标 · {{ goalNameOf(p) }}</div>
              <div class="ov-meta">
                <span>🎯 {{ p.metrics.length }}</span>
                <span>📋 {{ projectProgress(p).total }}</span>
                <span class="ov-progress"><i :style="{ width: projectProgress(p).pct + '%' }" /></span>
                <span class="ov-pct">{{ projectProgress(p).pct }}%</span>
              </div>
              <div class="ov-tools" @click.stop>
                <button class="ov-tool" title="置顶" @click.stop="togglePin(p)">📌</button>
                <button class="ov-tool" title="投射灯塔" :class="{on: p.pinnedToLighthouse}" @click.stop="p.pinnedToLighthouse = !p.pinnedToLighthouse; store.persist()">📡</button>
                <button class="ov-tool danger" title="删除项目（任务转未归档）" @click.stop="removeProject(p)">🗑</button>
              </div>
            </div>
            <div class="ov-add-card" @click="openCreate"><span>＋</span><span>新建 / 规划项目</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 模块四 · 任务调度（R55-B1：全域任务管理自调度台迁入，默认展开；卡片/列表/看板三视图与筛选全量保留） -->
    <section class="module" id="task-mgmt-module">
      <TaskManagerPanel />
    </section>

    <!-- 新建项目弹窗 -->
    <Transition name="fade">
      <div v-if="createOpen" class="ov-overlay" @click="createOpen = false" />
    </Transition>
    <Transition name="pop">
      <div v-if="createOpen" class="ov-modal">
        <div class="ov-modal-head">
          <span>📦 新建 / 规划项目</span>
          <span class="ov-modal-close" @click="createOpen = false">×</span>
        </div>
        <div class="ov-modal-body">
          <div class="ovm-label">所属战略目标</div>
          <select v-model="createDirId" class="ovm-select">
            <option v-for="dir in d.compass.directions" :key="dir.id" :value="dir.id">🎯 {{ dir.name }}</option>
          </select>
          <div class="ovm-label">项目名称</div>
          <input v-model="createName" class="ovm-input" placeholder="如「产品视觉重构」…" @keydown.enter.prevent="confirmCreate" @keydown.esc="createOpen = false" autofocus>
        </div>
        <div class="ov-modal-foot">
          <button class="ovm-btn" @click="createOpen = false">取消</button>
          <button class="ovm-btn primary" @click="confirmCreate">✓ 创建</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 48px; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-left: 22px; }
.page-head .crumb { font-size: 13px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 700; font-size: 19px; letter-spacing: .3px; }
.page-head .spacer { flex: 1; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }

.module { margin-top: 18px; }
/* R55-B3：zone=task 定位高亮 */
.module.module-flash { animation: moduleFlash 1.4s ease; }
@keyframes moduleFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); } }
.module:first-of-type { margin-top: 0; }

/* 项目总览（满宽 3 列，Linear 卡片） */
.ov-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid rgba(0,0,0,.025); }
.ov-head { display: flex; align-items: center; gap: 8px; padding: 16px 20px 12px; flex-wrap: wrap; }
.ov-head .ic { color: var(--accent); display: flex; align-items: center; }
.ov-head .nm { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
.ov-head .en { font-size: 9px; color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; }
.ov-head .ds { font-size: 11.5px; color: var(--text-3); margin-left: 6px; flex: 1; }
.ov-link { font-size: 11.5px; color: var(--accent); cursor: pointer; }
.ov-link:hover { text-decoration: underline; }
.ov-toggle { font-size: 11px; color: var(--text-3); cursor: pointer; white-space: nowrap; }
.ov-toggle:hover { color: var(--accent); }
.ov-toggle.off { opacity: .6; }
.ov-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 20px 18px; }
.ov-card-item { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 13px 15px; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 7px; }
.ov-card-item:hover { border-color: var(--border-strong); background: var(--surface); transform: translateY(-1px); }
.ov-card-item.focused { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.ov-card-item.archived { opacity: .55; }
/* R50-F4：主航线「更多」滚动定位高亮 */
.ov-card.ov-flash { animation: ovFlash 1.2s ease; }
@keyframes ovFlash { 0%, 100% { border-color: var(--border); box-shadow: none; } 30% { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); } }
.ov-name { font-size: 13.5px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.chip { font-size: 9.5px; padding: 1px 7px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); font-weight: 500; white-space: nowrap; }
.chip-accent { background: var(--accent-light); color: var(--accent); }
.chip-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.ov-goal { font-size: 11px; color: var(--text-3); }
.ov-meta { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.ov-progress { flex: 1; height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; }
.ov-progress > i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s ease; }
.ov-pct { font-weight: 700; color: var(--text); }
.ov-empty { grid-column: 1 / -1; text-align: center; padding: 30px; font-size: 12.5px; color: var(--text-3); }

/* C8 管理增强 */
.ov-add { border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 11.5px; font-weight: 600; border-radius: 8px; padding: 5px 13px; cursor: pointer; font-family: inherit; transition: all .15s; }
.ov-add:hover { background: var(--accent-hover); }
.ov-section { padding: 0 20px 12px; }
.ov-section:last-child { padding-bottom: 18px; }
.ov-sec-label { font-size: 11.5px; font-weight: 600; color: var(--text-2); margin: 10px 0 10px; display: flex; align-items: center; gap: 6px; }
.ov-sec-label span { font-size: 10px; color: var(--text-3); background: var(--surface-3); padding: 1px 8px; border-radius: 99px; font-variant-numeric: tabular-nums; }
.ov-card-item { position: relative; }
.ov-card-item.dragging { opacity: .4; }
.ov-card-item.drag-over { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent); }
.ov-pname { outline: none; border-radius: 5px; padding: 1px 4px; margin: -1px -4px; cursor: text; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ov-pname:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.ov-pname:focus { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.ov-tools { position: absolute; top: 8px; right: 8px; display: none; gap: 3px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 2px; box-shadow: 0 1px 4px rgba(0,0,0,.12); z-index: 2; }
.ov-card-item:hover .ov-tools { display: flex; }
.ov-tool { width: 22px; height: 22px; border: none; border-radius: 5px; background: transparent; color: var(--text-3); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ov-tool:hover { background: var(--surface-3); color: var(--text); }
.ov-tool.on { color: var(--accent); background: var(--accent-light); }
.ov-tool.danger:hover { color: var(--danger); }
.ov-add-card { border: 1.5px dashed var(--border-strong); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 96px; cursor: pointer; color: var(--text-3); font-size: 12.5px; transition: all .15s; }
.ov-add-card:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

/* 新建弹窗 */
.ov-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 220; }
.ov-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 420px; max-width: 94vw; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 221; }
.ov-modal-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.ov-modal-head span:first-child { flex: 1; }
.ov-modal-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; }
.ov-modal-close:hover { background: var(--surface-3); color: var(--text); }
.ov-modal-body { padding: 16px 20px; }
.ovm-label { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 6px; }
.ovm-select { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; margin-bottom: 12px; }
.ovm-input { width: 100%; padding: 10px 13px; background: var(--surface-2); border-radius: 8px; font-size: 13px; color: var(--text); border: 1px solid transparent; outline: none; font-family: inherit; }
.ovm-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }
.ov-modal-foot { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border); }
.ovm-btn { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12px; cursor: pointer; font-family: inherit; }
.ovm-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.ovm-btn.primary:hover { background: var(--accent-hover); }

.pop-enter-active, .pop-leave-active { transition: all .18s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.96); }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 1080px) {
  .ov-grid { grid-template-columns: 1fr; }
}
</style>
