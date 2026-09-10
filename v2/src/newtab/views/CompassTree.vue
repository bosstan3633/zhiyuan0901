<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { matchPinyin, isPinyinReady, onPinyinReady } from '@/shared/utils/pinyin'
import { toOpenableRawLink, toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { recordResourceOpen } from '@/shared/storage/stats'
import Drawer from '@/shared/components/Drawer.vue'
import { saveUIPrefs } from '@/shared/storage/repository'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import ProjectDetailDrawer from '../components/ProjectDetailDrawer.vue'
import TaskAddDrawer from '../components/TaskAddDrawer.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress, toggleFocusProject, isProjectDone } = useCompass()

// ---- R54-A1：来源感知返回（?from=proj&p= → 项目详情；默认方向台）+ A3 定位 + A4 Esc ----
const fromProjId = computed(() => route.query.from === 'proj' && typeof route.query.p === 'string' ? route.query.p : '')
const fromProjName = computed(() => fromProjId.value ? allProjects().find(p => p.id === fromProjId.value)?.name || '项目详情' : '')
function goBack() {
  if (fromProjId.value) router.push({ path: '/compass/projects', query: { p: fromProjId.value } })
  else router.push('/compass')
}
function locateHlGoal() {
  const dirId = route.query.hl
  if (!dirId || typeof dirId !== 'string') return
  expandedDirs.value.add(dirId)
  nextTick(() => {
    const el = document.querySelector(`[data-dir-id="${dirId}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('goal-flash')
    setTimeout(() => el.classList.remove('goal-flash'), 1500)
  })
}
function onPageEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (document.querySelector('.task-sidebar, .overlay, .modal-mask')) return
  e.preventDefault()
  goBack()
}
onMounted(() => {
  document.addEventListener('keydown', onPageEsc, true)
  locateHlGoal()
})
onUnmounted(() => document.removeEventListener('keydown', onPageEsc, true))
watch(() => route.query.hl, () => locateHlGoal())

// ---- 展开状态 ----
const expandedDirs = ref<Set<string>>(new Set())
const expandedMetrics = ref<Set<string>>(new Set())
/** B26：默认全局展开——数据变化时补齐缺失的展开 id（手动收起的保持折叠） */
function expandAllNodes() {
  d.value.compass.directions.forEach(dir => {
    expandedDirs.value.add(dir.id)
    dir.projects.forEach(proj => proj.metrics.forEach(m => expandedMetrics.value.add(m.id)))
  })
}
watch(() => d.value?.compass.directions, () => expandAllNodes(), { deep: true, immediate: true })

/** R49-C7：一键展开/收起全部（展开=全层级展开；收起=全部战略目标与指标折叠） */
function collapseAllNodes() {
  expandedDirs.value.clear()
  expandedMetrics.value.clear()
}

// ---- R49-C6：已完成（archived）项目显隐（与主航线/项目总览三处同步） ----
const showDone = computed(() => store.ui?.showDoneProjects !== false)
function toggleShowDone() {
  const next = !showDone.value
  if (store.ui) store.ui.showDoneProjects = next
  saveUIPrefs({ showDoneProjects: next })
}
function visibleProjectsOf(dir: Direction): Project[] {
  // R52-BUG-2：口径统一 isProjectDone（手动 done/archived 或全任务完成派生），修复「已完成项目显隐」开关失效
  // R59-T3：主攻项目置前（稳定排序，组内保持原有顺序）
  return dir.projects
    .filter(p => showDone.value || !isProjectDone(p))
    .slice()
    .sort((a, b) => (Number(b.isFocused) - Number(a.isFocused)))
}
const treeStats = computed(() => ({
  dirs: d.value.compass.directions.length,
  projects: d.value.compass.directions.reduce((s, dir) => s + visibleProjectsOf(dir).length, 0),
  metrics: d.value.compass.directions.reduce((s, dir) => s + dir.projects.reduce((s2, p) => s2 + p.metrics.length, 0), 0),
  tasks: d.value.tasks.filter(t => !t.deletedAt).length
}))

function toggleDir(id: string) {
  if (expandedDirs.value.has(id)) expandedDirs.value.delete(id)
  else expandedDirs.value.add(id)
}
function toggleMetric(id: string) {
  if (expandedMetrics.value.has(id)) expandedMetrics.value.delete(id)
  else expandedMetrics.value.add(id)
}

// ---- 编辑状态（contenteditable方案）----
const editingField = ref<string | null>(null)

function startEdit(field: string, e: MouseEvent) {
  e.stopPropagation()
  editingField.value = field
  nextTick(() => {
    const el = document.querySelector('[data-edit="' + field + '"]') as HTMLElement | null
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

function saveEdit(field: string, e: FocusEvent | KeyboardEvent) {
  const el = e.target as HTMLElement
  const val = el.innerText.trim()
  if (!val) {
    // 恢复原值
    editingField.value = null
    return
  }
  if (field === 'vision') {
    visionText.value = val
  } else if (field === 'mission') {
    missionText.value = val
  } else {
    const [type, id] = field.split('-')
    if (type === 'dir') {
      const dir = d.value.compass.directions.find(x => x.id === id)
      if (dir) dir.name = val
    } else if (type === 'proj') {
      const p = allProjects().find(x => x.id === id)
      if (p) p.name = val
    } else if (type === 'metric') {
      for (const dir of d.value.compass.directions) {
        for (const proj of dir.projects) {
          const m = proj.metrics.find(x => x.id === id)
          if (m) { m.title = val; break }
        }
      }
    } else if (type === 'task') {
      const t = d.value.tasks.find(x => x.id === id)
      if (t) { t.title = val; t.updatedAt = Date.now() }
    }
    store.persist()
  }
  editingField.value = null
  showToast('✓ 已保存')
}

function cancelEdit() {
  editingField.value = null
}

// ---- CRUD（不自动进入编辑模式）----
function addDirection() {
  const dir: Direction = {
    id: uid('dir'),
    name: '新战略目标',
    status: 'active',
    term: 'mid',
    projects: []
  }
  d.value.compass.directions.push(dir)
  store.persist()
  expandedDirs.value.add(dir.id)
  showToast('✓ 战略目标已创建，点击标题编辑')
}

function addProject(dirId: string) {
  const dir = d.value.compass.directions.find(x => x.id === dirId)
  if (!dir) return
  const proj: Project = {
    id: uid('proj'),
    name: '新攻坚项目',
    isFocused: false,
    progress: 0,
    status: 'active',
    metrics: []
  }
  dir.projects.push(proj)
  store.persist()
  showToast('✓ 项目已创建')
}

function addMetric(projId: string) {
  const proj = allProjects().find(x => x.id === projId)
  if (!proj) return
  const metric: Metric = {
    id: uid('met'),
    title: '新成功指标',
    taskIds: []
  }
  proj.metrics.push(metric)
  store.persist()
  expandedMetrics.value.add(metric.id)
  showToast('✓ 指标已创建')
}

/** 第卅三轮 REQ-016：添加任务双模式（新建 / 关联）→ 共享抽屉 TaskAddDrawer */
const taskAdd = ref<{ metricId: string; projId: string } | null>(null)
function openTaskAdd(metricId: string, projId: string) {
  taskAdd.value = { metricId, projId }
}
/** R51-B6：创建成功后直接打开详情抽屉 */
const detailRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)
function onTaskCreated(t: TaskCard) { detailRef.value?.open(t) }
const taskAddMetricTitle = computed(() => {
  if (!taskAdd.value) return ''
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === taskAdd.value!.metricId)
      if (m) return m.title
    }
  }
  return ''
})

function toggleTask(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  t.status = t.status === 'done' ? 'todo' : 'done'
  t.completedAt = t.status === 'done' ? Date.now() : undefined
  t.updatedAt = Date.now()
  store.persist()
}

function deleteNode(type: string, id: string) {
  if (type === 'dir') {
    const idx = d.value.compass.directions.findIndex(x => x.id === id)
    if (idx >= 0) d.value.compass.directions.splice(idx, 1)
  } else if (type === 'proj') {
    for (const dir of d.value.compass.directions) {
      const idx = dir.projects.findIndex(x => x.id === id)
      if (idx >= 0) { dir.projects.splice(idx, 1); break }
    }
  } else if (type === 'metric') {
    for (const dir of d.value.compass.directions) {
      for (const proj of dir.projects) {
        const idx = proj.metrics.findIndex(x => x.id === id)
        if (idx >= 0) { proj.metrics.splice(idx, 1); break }
      }
    }
  } else if (type === 'task') {
    const t = d.value.tasks.find(x => x.id === id)
    if (t) t.deletedAt = Date.now()
  }
  store.persist()
  showToast('已删除')
}

// ---- 任务数据 ----
function tasksForMetric(metricId: string): TaskCard[] {
  // REQ-034：按 id 去重双保险
  const seen = new Set<string>()
  return d.value.tasks
    .filter(t => !t.deletedAt && t.metricId === metricId)
    .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

// ---- 停滞检测 ----
function isStagnant(dir: Direction): boolean {
  const projIds = dir.projects.map(p => p.id)
  const recentTask = d.value.tasks
    .filter(t => !t.deletedAt && projIds.includes(t.projectId || ''))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  if (!recentTask && dir.projects.length > 0) return true
  return recentTask ? Date.now() - (recentTask.updatedAt || 0) > 14 * 86400_000 : false
}

// ---- 六层悬浮目录（左侧，快速定位 + 滚动高亮） ----
const tocItems = [
  { n: 1, name: '愿景' },
  { n: 2, name: '使命' },
  { n: 3, name: '战略目标' },
  { n: 4, name: '攻坚项目' },
  { n: 5, name: '成功指标' },
  { n: 6, name: '任务' }
]
const activeLayer = ref(1)
const canvasEl = ref<HTMLElement | null>(null)
function scrollToLayer(n: number) {
  activeLayer.value = n
  const el = document.getElementById('layer-' + n)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function onCanvasScroll() {
  const canvas = canvasEl.value
  if (!canvas) return
  const canvasTop = canvas.getBoundingClientRect().top
  let current = 1
  for (const item of tocItems) {
    const el = document.getElementById('layer-' + item.n)
    if (el && el.getBoundingClientRect().top - canvasTop <= 80) current = item.n
  }
  activeLayer.value = current
}

// ---- DHI ----
const dhiStatus = computed(() => {
  const dirs = d.value.compass.directions
  if (!dirs.length) return { label: '待聚焦', cls: 'warning' }
  const active = dirs.filter(d => !isStagnant(d)).length
  if (active === dirs.length) return { label: '清晰', cls: '' }
  if (active >= dirs.length / 2) return { label: '关注', cls: 'warning' }
  return { label: '需聚焦', cls: 'warning' }
})

// ---- N1：愿景/使命关联资源卡/好奇心卡 ----
// R59-T4：关联卡片升级为居中弹窗选择器（关键词+拼音过滤、全量滚动、勾选即存）
const pinyinOn = ref(isPinyinReady())
onPinyinReady(() => { pinyinOn.value = true })
const linkModal = ref<{ node: 'vision' | 'mission' } | null>(null)
const linkQ = ref('')
function toggleLinkPop(node: 'vision' | 'mission') {
  linkModal.value = linkModal.value?.node === node ? null : { node }
  linkQ.value = ''
}
function closeLinkModal() { linkModal.value = null }
function linkIds(node: 'vision' | 'mission', kind: 'res' | 'curio'): ID[] {
  const c = d.value.compass[node]
  if (!c) return []
  return (kind === 'res' ? c.linkedResourceIds : c.linkedCuriosityIds) || []
}
function linkCount(node: 'vision' | 'mission'): number {
  return linkIds(node, 'res').length + linkIds(node, 'curio').length
}
function isLinked(node: 'vision' | 'mission', kind: 'res' | 'curio', id: string): boolean {
  return linkIds(node, kind).includes(id)
}
function toggleLinked(node: 'vision' | 'mission', kind: 'res' | 'curio', id: string) {
  const c = d.value.compass[node]
  if (!c) return
  const key = kind === 'res' ? 'linkedResourceIds' : 'linkedCuriosityIds'
  const arr: ID[] = c[key] || []
  c[key] = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]
  store.persist()
}
function resTitle(id: string): string {
  return d.value.resources.find(r => r.id === id && !r.deletedAt)?.title || '(已删除资源)'
}
function curioTitle(id: string): string {
  return d.value.curiosities.find(c => c.id === id && !c.deletedAt)?.question || '(已删除好奇)'
}
/** B24：点击关联卡片标题 → 右侧滑出通用详情抽屉；第卅二轮 REQ-012：双击按统一通道打开链接 */
const peek = ref<{ kind: 'res' | 'curio'; id: string } | null>(null)
function openChipLink(kind: 'res' | 'curio', id: string) {
  if (kind === 'res') {
    const r = d.value.resources.find(x => x.id === id && !x.deletedAt)
    const url = r ? toOpenableUrl(r.linkType, r.link) : ''
    if (!r || !url) { showToast('该卡片没有可打开的链接'); return }
    // WRR 口径：关联卡片打开同样计入调用统计（与资源台/搜索/北极星一致）
    recordResourceOpen(d.value, r)
    store.persist()
    openExternalLink(url)
  } else {
    const c = d.value.curiosities.find(x => x.id === id && !x.deletedAt)
    const url = toOpenableRawLink(c?.sourceUrl)
    if (!url) { showToast('该好奇心没有来源链接'); return }
    openExternalLink(url)
  }
}
const peekData = computed(() => {
  if (!peek.value) return null
  if (peek.value.kind === 'res') {
    const r = d.value.resources.find(x => x.id === peek.value!.id && !x.deletedAt)
    if (!r) return null
    const lt = r.linkType === 'file' ? '本地文件' : r.linkType === 'obsidian' ? 'Obsidian' : '网页链接'
    return { kind: 'res' as const, title: r.title, link: r.link || '', linkType: lt, desc: r.description || '', tags: r.tags || [] }
  }
  const c = d.value.curiosities.find(x => x.id === peek.value!.id && !x.deletedAt)
  if (!c) return null
  const lt = !c.sourceUrl ? '' : c.sourceUrl.startsWith('file:') ? '本地文件' : c.sourceUrl.startsWith('obsidian:') ? 'Obsidian' : '网页链接'
  return { kind: 'curio' as const, title: c.question, link: c.sourceUrl || '', linkType: lt, desc: '', tags: c.tags || [] }
})
/** REQ-010：peek 抽屉链接统一走打开通道（chrome.tabs 优先，file 盘符归一化） */
function openPeekLink() {
  const c = peekData.value
  if (!c || !c.link) return
  const url = toOpenableRawLink(c.link)
  if (!url) { showToast('链接不可打开（本地文件缺少完整路径）'); return }
  openExternalLink(url)
}
function linkCandidates(kind: 'res' | 'curio') {
  const q = linkQ.value.trim().toLowerCase()
  const hit = (text: string) => !!text && (!q || text.toLowerCase().includes(q) || (pinyinOn.value && matchPinyin(text, q)))
  if (kind === 'res') {
    return d.value.resources.filter(r => !r.deletedAt && hit(r.title)).map(r => ({ id: r.id, title: r.title }))
  }
  return d.value.curiosities.filter(c => !c.deletedAt && hit(c.question)).map(c => ({ id: c.id, title: c.question }))
}
// R60：愿景/使命/项目的「灯塔投射」开关与数据字段均已移除；重心语义由「🎯 主攻 isFocused」承担

// 第卅二轮 REQ-003：项目卡"打开项目"→ 项目全景透视抽屉（可增删改指标与任务，实时同步方向树）
const projDrawerOpen = ref(false)
const projDrawerId = ref<string | null>(null)
function openProjectDrawer(projId: string) {
  projDrawerId.value = projId
  projDrawerOpen.value = true
}

// 第卅六轮 REQ-039：搜索浮层单击 → 项目详情抽屉
import { onOpenDrawer } from '@/shared/utils/bus'
let unsubProjDrawer: (() => void) | null = null
onMounted(() => {
  unsubProjDrawer = onOpenDrawer((p) => {
    if (p.kind === 'project') openProjectDrawer(p.id)
  })
})
onUnmounted(() => { unsubProjDrawer?.() })

// 滚动监听挂到外层滚动容器（罗盘容器的 .comp-content）
let scrollParent: HTMLElement | null = null
onMounted(() => {
  scrollParent = (canvasEl.value?.closest('.comp-content') as HTMLElement) || null
  scrollParent?.addEventListener('scroll', onCanvasScroll, { passive: true })
})
onUnmounted(() => {
  scrollParent?.removeEventListener('scroll', onCanvasScroll)
})
</script>

<template>
  <div class="compass-layout">
    <!-- 六层悬浮目录 -->

      <div class="tree-page-head">
        <div class="crumb"><span class="crumb-up" title="返回方向台" @click="router.push('/compass')">方向台</span><span class="crumb-sep"> / </span><b>完整方向树</b> · 六层思维链全深度</div>
        <div class="spacer"></div>
        <!-- R54-A1：来源感知返回（从项目详情进入时返回该项目详情） -->
        <button class="tree-tool accent" @click="goBack" :title="fromProjId ? '返回项目详情' : '返回方向台'">← {{ fromProjId ? '返回项目详情' : '返回方向台' }}</button>
        <div class="tree-stats">愿景 1 · 使命 1 · 战略目标 {{ treeStats.dirs }} · 项目 {{ treeStats.projects }} · 指标 {{ treeStats.metrics }} · 任务 {{ treeStats.tasks }}</div>
        <button class="tree-tool" @click="expandAllNodes" title="展开全部层级">⊞ 展开</button>
        <button class="tree-tool" @click="collapseAllNodes" title="收起全部战略目标与指标">⊟ 收起</button>
        <button class="tree-tool" :class="{ off: !showDone }" @click="toggleShowDone" title="与主航线/项目总览三处同步">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}</button>
        <div class="dhi-badge" :class="dhiStatus.cls">
          <span>🧭</span>
          <span>方向健康度：{{ dhiStatus.label }}</span>
        </div>
      </div>

      <!-- 画布 -->
      <div class="tree-layout">
      <aside class="layer-toc">
        <div class="lt-title">🧭 六层思维链</div>
        <div v-for="item in tocItems" :key="item.n" class="lt-item"
          :class="{active: activeLayer === item.n}" @click="scrollToLayer(item.n)">
          <span class="lt-num">{{ item.n }}</span>
          <span class="lt-name">{{ item.name }}</span>
        </div>
        <div class="lt-hint">点击快速定位</div>
      </aside>
      <div class="canvas" ref="canvasEl" @scroll="onCanvasScroll">
        <div class="canvas-inner">

          <!-- 第1层：愿景 -->
          <div class="layer-header" id="layer-1">
            <div class="layer-num">1</div>
            <div class="layer-name">愿景</div>
            <div class="layer-desc">· 终极方向，回答"我想到达哪里"</div>
          </div>
          <div class="node vision-node">
            <div class="layer-label">VISION · 核心愿景</div>
            <div class="node-title editable"
              :class="{editing: editingField === 'vision'}"
              :data-edit="'vision'"
              :contenteditable="editingField === 'vision'"
              @click="startEdit('vision', $event)"
              @blur="saveEdit('vision', $event)"
              @keydown.enter.ctrl.prevent="saveEdit('vision', $event)"
              @keydown.esc="cancelEdit">{{ visionText || '点击设定你的核心愿景…' }}</div>
            <div class="node-meta">
              <span class="proj-toggle" @click.stop="toggleLinkPop('vision')">
                🔗 关联卡片
                <span class="link-count">{{ linkCount('vision') }}</span>
              </span>
            </div>
            <div v-if="linkCount('vision')" class="linked-chips" @click.stop>
              <span v-for="rid in linkIds('vision', 'res')" :key="'vr' + rid" class="linked-chip" :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico">📄</span><span class="lc-text">{{ resTitle(rid) }}</span></span>
              <span v-for="cid in linkIds('vision', 'curio')" :key="'vc' + cid" class="linked-chip" :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico">💡</span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
            </div>
          </div>

          <div class="tree-connector"><svg width="2" height="20"><line x1="1" y1="0" x2="1" y2="20" stroke="var(--border-strong)" stroke-width="1.5" stroke-dasharray="4,3" /></svg></div>

          <!-- 第2层：使命 -->
          <div class="layer-header" id="layer-2">
            <div class="layer-num">2</div>
            <div class="layer-name">使命</div>
            <div class="layer-desc">· 行动准则，回答"我如何到达那里"</div>
          </div>
          <div class="node mission-node">
            <div class="node-top">
              <span class="node-tag mission-tag">MISSION</span>
            </div>
            <div class="node-title editable"
              :class="{editing: editingField === 'mission'}"
              :data-edit="'mission'"
              :contenteditable="editingField === 'mission'"
              @click="startEdit('mission', $event)"
              @blur="saveEdit('mission', $event)"
              @keydown.enter.ctrl.prevent="saveEdit('mission', $event)"
              @keydown.esc="cancelEdit">{{ missionText || '点击设定你的核心使命…' }}</div>
            <div class="node-meta">
              <span class="proj-toggle" @click.stop="toggleLinkPop('mission')">
                🔗 关联卡片
                <span class="link-count">{{ linkCount('mission') }}</span>
              </span>
            </div>
            <div v-if="linkCount('mission')" class="linked-chips" @click.stop>
              <span v-for="rid in linkIds('mission', 'res')" :key="'mr' + rid" class="linked-chip" :title="resTitle(rid) + '（双击打开链接）'" @click="peek = { kind: 'res', id: rid }" @dblclick="openChipLink('res', rid)"><span class="lc-ico">📄</span><span class="lc-text">{{ resTitle(rid) }}</span></span>
              <span v-for="cid in linkIds('mission', 'curio')" :key="'mc' + cid" class="linked-chip" :title="curioTitle(cid) + '（双击打开来源）'" @click="peek = { kind: 'curio', id: cid }" @dblclick="openChipLink('curio', cid)"><span class="lc-ico">💡</span><span class="lc-text">{{ curioTitle(cid) }}</span></span>
            </div>
          </div>

          <div class="tree-connector"><svg width="2" height="20"><line x1="1" y1="0" x2="1" y2="20" stroke="var(--border-strong)" stroke-width="1.5" stroke-dasharray="4,3" /></svg></div>

          <!-- 第3层：战略目标 -->
          <div class="layer-header" id="layer-3">
            <div class="layer-num">3</div>
            <div class="layer-name">战略目标</div>
            <div class="layer-desc">· Directions，阶段方向</div>
            <button class="add-btn-inline" @click="addDirection"><span>＋</span>添加战略目标</button>
          </div>

          <div v-if="!d.compass.directions.length" class="empty-state">
            <div class="empty-icon">🎯</div>
            <div>还没有战略目标，点击上方"添加战略目标"开始</div>
          </div>

          <div class="goals-row">
            <div v-for="dir in d.compass.directions" :key="dir.id" class="goal-col">
              <div class="node goal-node" :class="{stagnant: isStagnant(dir)}" :data-dir-id="dir.id" @click="toggleDir(dir.id)">
                <div class="node-top">
                  <span v-if="isStagnant(dir)" class="stagnant-tag">⚠ 停滞</span>
                  <span class="node-tag dir-tag">DIRECTION</span>
                  <span class="expand-icon">{{ expandedDirs.has(dir.id) ? '▼' : '▶' }}</span>
                </div>
                <div class="node-title editable"
                  :class="{editing: editingField === 'dir-' + dir.id}"
                  :data-edit="'dir-' + dir.id"
                  :contenteditable="editingField === 'dir-' + dir.id"
                  @click="startEdit('dir-' + dir.id, $event)"
                  @blur="saveEdit('dir-' + dir.id, $event)"
                  @keydown.enter.prevent="saveEdit('dir-' + dir.id, $event)"
                  @keydown.esc="cancelEdit">{{ dir.name }}</div>
                <div class="progress-bar"><div class="progress-fill" :style="{width: (dir.projects.reduce((s,p)=>s+projectProgress(p).pct,0)/(dir.projects.length||1)) + '%'}" /></div>
                <div class="node-meta">
                  <span>{{ dir.projects.length }} 攻坚项目</span>
                  <span>{{ dir.projects.reduce((s,p)=>s+p.metrics.length,0) }} 指标</span>
                  <span>{{ d.tasks.filter(t=>!t.deletedAt && dir.projects.some(p=>p.id===t.projectId)).length }} 任务</span>
                </div>
                <div class="node-actions">
                  <div class="node-action" @click.stop="addProject(dir.id)" title="添加项目">＋</div>
                  <div class="node-action danger" @click.stop="deleteNode('dir', dir.id)" title="删除">🗑</div>
                </div>
              </div>

              <!-- 视觉引导线 + 第4-6层 -->
              <div v-if="expandedDirs.has(dir.id)" class="sub-tree">
                <div class="guide-line" />
                <div class="sub-layer">
                  <!-- 第4层：攻坚项目 -->
                  <div class="sub-layer-label" id="layer-4">
                    <div class="sub-layer-num">4</div>
                    <div class="sub-layer-name">攻坚项目</div>
                    <div class="sub-layer-add" @click.stop="addProject(dir.id)">＋ 添加</div>
                  </div>

                  <div v-for="(proj, pIdx) in visibleProjectsOf(dir)" :key="proj.id" class="project-branch">
                    <div class="branch-connector">
                      <div class="branch-h" />
                      <div class="branch-v" />
                    </div>
                    <div class="node project-node" :class="{primary: proj.isFocused}">
                      <div class="node-top">
                        <span v-if="proj.isFocused" class="primary-badge">主攻</span>
                        <span class="node-tag proj-tag">PROJECT</span>
                        <button class="focus-btn" :class="{on: proj.isFocused}" @click.stop="toggleFocusProject(proj.id)"
                          :title="proj.isFocused ? '主攻项目（再次点击取消）——主攻项目在列表置前并以强调色区分' : '设为主攻项目——列表置前并以强调色区分'">🎯 主攻</button>
                      </div>
                      <div class="node-title editable"
                        :class="{editing: editingField === 'proj-' + proj.id}"
                        :data-edit="'proj-' + proj.id"
                        :contenteditable="editingField === 'proj-' + proj.id"
                        @click="startEdit('proj-' + proj.id, $event)"
                        @blur="saveEdit('proj-' + proj.id, $event)"
                        @keydown.enter.prevent="saveEdit('proj-' + proj.id, $event)"
                        @keydown.esc="cancelEdit">{{ proj.name }}</div>
                      <div class="node-meta">
                        <span>📊 {{ proj.metrics.length }} 指标</span>
                        <span>📋 {{ d.tasks.filter(t=>!t.deletedAt && t.projectId===proj.id).length }} 任务</span>
                        <span :class="proj.status==='active'?'status-active':'status-paused'">● {{ proj.status==='active'?'推进中':'规划中' }}</span>
                      </div>
                      <div class="node-actions">
                        <div class="node-action" @click.stop="openProjectDrawer(proj.id)" title="打开项目全景">🗂</div>
                        <!-- R54-A2：进入项目详情页（方向树 ↔ 项目详情闭环） -->
                        <div class="node-action" @click.stop="router.push({ path: '/compass/projects', query: { p: proj.id, from: 'tree' } })" title="进入项目详情页">📄</div>
                        <div class="node-action" @click.stop="addMetric(proj.id)" title="添加指标">＋</div>
                        <div class="node-action danger" @click.stop="deleteNode('proj', proj.id)" title="删除">🗑</div>
                      </div>

                      <!-- 第5层：成功指标 -->
                      <div class="sub-layer metrics-wrap" id="layer-5">
                        <div class="sub-layer-label">
                          <div class="sub-layer-num">5</div>
                          <div class="sub-layer-name">成功指标</div>
                          <div class="sub-layer-add" @click.stop="addMetric(proj.id)">＋ 添加</div>
                        </div>

                        <div v-for="metric in proj.metrics" :key="metric.id">
                          <div class="metric-item" :class="{expanded: expandedMetrics.has(metric.id)}" @click="toggleMetric(metric.id)">
                            <div class="metric-status" :class="tasksForMetric(metric.id).every(t=>t.status==='done') && tasksForMetric(metric.id).length ? 'done' : tasksForMetric(metric.id).some(t=>t.status==='doing') ? 'doing' : 'todo'">
                              {{ tasksForMetric(metric.id).every(t=>t.status==='done') && tasksForMetric(metric.id).length ? '✓' : tasksForMetric(metric.id).some(t=>t.status==='doing') ? '◐' : '○' }}
                            </div>
                            <div class="metric-name editable"
                              :class="{editing: editingField === 'metric-' + metric.id}"
                              :data-edit="'metric-' + metric.id"
                              :contenteditable="editingField === 'metric-' + metric.id"
                              @click.stop="startEdit('metric-' + metric.id, $event)"
                              @blur="saveEdit('metric-' + metric.id, $event)"
                              @keydown.enter.prevent="saveEdit('metric-' + metric.id, $event)"
                              @keydown.esc="cancelEdit">{{ metric.title }}</div>
                            <div class="metric-progress">{{ tasksForMetric(metric.id).filter(t=>t.status==='done').length }}/{{ tasksForMetric(metric.id).length }}</div>
                            <div class="metric-task-count">📋 {{ tasksForMetric(metric.id).length }}任务</div>
                            <div class="metric-expand-icon">{{ expandedMetrics.has(metric.id) ? '▼' : '▶' }}</div>
                            <div class="metric-actions" @click.stop>
                              <div class="node-action" @click="openTaskAdd(metric.id, proj.id)" title="添加任务（新建 / 关联）">＋</div>
                              <div class="node-action danger" @click="deleteNode('metric', metric.id)" title="删除">🗑</div>
                            </div>
                          </div>

                          <!-- 第6层：任务 -->
                          <Transition name="expand">
                            <div v-if="expandedMetrics.has(metric.id)" class="tasks-wrap" id="layer-6">
                              <div class="tasks-header">
                                <div class="th-num">6</div>
                                <div class="th-name">任务</div>
                                <div class="th-count">{{ tasksForMetric(metric.id).length }}项</div>
                                <div class="th-add" @click.stop="openTaskAdd(metric.id, proj.id)">＋ 添加</div>
                              </div>
                              <div v-for="task in tasksForMetric(metric.id)" :key="task.id" class="task-item" :class="{done: task.status==='done'}">
                                <div class="task-check" :class="{done: task.status==='done'}" @click.stop="toggleTask(task.id)">
                                  {{ task.status==='done' ? '✓' : '' }}
                                </div>
                                <div class="task-text editable"
                                  :class="{editing: editingField === 'task-' + task.id}"
                                  :data-edit="'task-' + task.id"
                                  :contenteditable="editingField === 'task-' + task.id"
                                  @click.stop="startEdit('task-' + task.id, $event)"
                                  @blur="saveEdit('task-' + task.id, $event)"
                                  @keydown.enter.prevent="saveEdit('task-' + task.id, $event)"
                                  @keydown.esc="cancelEdit">{{ task.title }}</div>
                                <span class="task-meta">{{ task.priority==='high'?'高优':task.priority==='medium'?'中优':'低优' }}</span>
                                <div class="task-actions" @click.stop>
                                  <div class="node-action danger" @click="deleteNode('task', task.id)" title="删除">🗑</div>
                                </div>
                              </div>
                              <div v-if="!tasksForMetric(metric.id).length" class="tasks-empty">暂无任务，点击"＋ 添加"创建</div>
                            </div>
                          </Transition>
                        </div>

                        <div v-if="!proj.metrics.length" class="empty-sub">暂无成功指标</div>
                      </div>
                    </div>
                  </div>

                  <div v-if="!visibleProjectsOf(dir).length" class="empty-sub">暂无可见攻坚项目（已完成项目可能已隐藏），点击上方"＋ 添加"创建</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部说明 -->
          <div class="footer-hint">
            💡 点击标题即可编辑 · Enter保存 / Esc取消 · 点击战略目标展开④⑤⑥层 · 点击指标展开任务
          </div>

        </div>
      </div>
      </div>

    <!-- R59-T4：关联卡片选择器（居中弹窗：关键词+拼音过滤 / 资源+好奇分区 / 全量滚动 / 勾选即存） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="linkModal" class="lm-mask" @click.self="closeLinkModal">
          <div class="lm-box">
            <div class="lm-head">
              <span>🔗 关联卡片 · {{ linkModal.node === 'vision' ? '愿景' : '使命' }}</span>
              <span class="lm-count">已选 {{ linkCount(linkModal.node) }}</span>
              <div class="pm-close" @click="closeLinkModal">×</div>
            </div>
            <div class="lm-body">
              <input v-model="linkQ" class="lm-search" placeholder="关键词或拼音首字母过滤（如 sj）…" v-focus @keydown.esc.stop="closeLinkModal">
              <div class="link-pop-sec">📄 资源卡（{{ linkCandidates('res').length }}）</div>
              <div class="lm-list">
                <label v-for="r in linkCandidates('res')" :key="r.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'res', r.id)" @change="toggleLinked(linkModal.node, 'res', r.id)">
                  <span :title="r.title">{{ r.title }}</span>
                </label>
                <div v-if="!linkCandidates('res').length" class="link-pop-empty">无匹配资源卡</div>
              </div>
              <div class="link-pop-sec">💡 好奇心卡（{{ linkCandidates('curio').length }}）</div>
              <div class="lm-list">
                <label v-for="c in linkCandidates('curio')" :key="c.id" class="link-pop-item">
                  <input type="checkbox" :checked="isLinked(linkModal.node, 'curio', c.id)" @change="toggleLinked(linkModal.node, 'curio', c.id)">
                  <span :title="c.title">{{ c.title }}</span>
                </label>
                <div v-if="!linkCandidates('curio').length" class="link-pop-empty">无匹配好奇心卡</div>
              </div>
            </div>
            <div class="lm-foot">
              <span class="lm-tip">勾选即时保存 · 单击已关联卡片可在下方芯片处查看（双击打开）</span>
              <button class="mini-btn primary" @click="closeLinkModal">完成</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- B24：关联卡片详情抽屉 -->
    <Drawer :open="!!peekData" :title="peek?.kind === 'res' ? '📄 资源卡详情' : '💡 好奇心卡详情'" @close="peek = null">
      <template v-if="peekData">
        <div class="peek-row"><span class="peek-label">标题</span><div class="peek-val strong">{{ peekData.title }}</div></div>
        <div class="peek-row"><span class="peek-label">来源</span><div class="peek-val">{{ peekData.kind === 'res' ? '资源台' : '我的好奇心' }}{{ peekData.linkType ? ' · ' + peekData.linkType : '' }}</div></div>
        <div v-if="peekData.link" class="peek-row"><span class="peek-label">链接</span><div class="peek-val link">{{ peekData.link }}</div></div>
        <div v-if="peekData.desc" class="peek-row"><span class="peek-label">描述</span><div class="peek-val">{{ peekData.desc }}</div></div>
        <div v-if="peekData.tags.length" class="peek-row"><span class="peek-label">标签</span><div class="peek-val"><span v-for="t in peekData.tags" :key="t" class="peek-tag">#{{ t }}</span></div></div>
        <button v-if="peekData.link" class="peek-open" @click="openPeekLink">↗ 打开链接</button>
      </template>
    </Drawer>

    <!-- 第卅二轮 REQ-003：项目全景透视抽屉 -->
    <ProjectDetailDrawer :open="projDrawerOpen" :project-id="projDrawerId" @close="projDrawerOpen = false" />

    <!-- 第卅三轮 REQ-016：指标添加任务双模式（新建 / 关联） -->
    <TaskAddDrawer :open="!!taskAdd" :metric-id="taskAdd?.metricId || ''" :project-id="taskAdd?.projId || ''"
      :metric-title="taskAddMetricTitle" @close="taskAdd = null" @created="onTaskCreated" />

  <!-- R51-B6：创建成功后直接打开详情抽屉 -->
  <TaskDetailDrawer ref="detailRef" />

    
  </div>
</template>

<style scoped>
.compass-layout { display: block; min-height: 100%; padding: 20px 24px 48px; max-width: 1440px; margin: 0 auto; }
.tree-layout { display: flex; gap: 20px; align-items: flex-start; }
/* N1：愿景/使命关联卡片 */
.node { position: relative; }
.link-count { font-size: 10px; color: var(--accent); background: var(--accent-light); padding: 1px 7px; border-radius: 99px; font-weight: 600; }
/* R59-T4：关联卡片选择器（居中弹窗） */
.lm-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 640; display: flex; align-items: center; justify-content: center; }
.lm-box { width: 520px; max-width: 94vw; max-height: 82vh; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.lm-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px; font-size: 14px; font-weight: 700; color: var(--text); }
.lm-count { font-size: 11px; font-weight: 500; color: var(--accent); background: var(--accent-light); border-radius: 99px; padding: 2px 10px; }
.lm-head .pm-close { margin-left: auto; cursor: pointer; color: var(--text-3); font-size: 18px; padding: 0 4px; }
.lm-head .pm-close:hover { color: var(--text); }
.lm-body { padding: 0 18px 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; flex: 1; }
.lm-search { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px 11px; font-size: 12.5px; outline: none; font-family: inherit; background: var(--surface-2); color: var(--text); margin-bottom: 6px; }
.lm-search:focus { border-color: var(--accent); }
.lm-list { max-height: 30vh; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; padding: 4px; margin-bottom: 6px; }
.lm-foot { display: flex; align-items: center; gap: 10px; padding: 10px 18px 14px; border-top: 1px solid var(--border); }
.lm-tip { flex: 1; font-size: 11px; color: var(--text-4); }
.mini-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 12px; border-radius: 8px; padding: 5px 12px; cursor: pointer; font-family: inherit; }
.mini-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.link-pop-sec { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding: 6px 4px 3px; }
.link-pop-item { display: flex; align-items: center; gap: 8px; padding: 6px 6px; border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--text-2); }
.link-pop-item:hover { background: var(--surface-2); color: var(--text); }
.link-pop-item span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link-pop-empty { padding: 12px; text-align: center; color: var(--text-4); font-size: 11.5px; }
/* B24：关联卡片标题 chips + 详情抽屉 */
.linked-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding-left: 2px; }
/* 第卅三轮 REQ-017：关联卡片由胶囊 chip 改为卡片形态（两行截断 + 卡片圆角） */
.linked-chip { display: inline-flex; align-items: flex-start; gap: 5px; width: 168px; min-height: 34px; padding: 6px 9px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 11.5px; line-height: 1.45; color: var(--text-2); cursor: pointer; transition: all .12s; overflow: hidden; }
.linked-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.lc-ico { flex-shrink: 0; font-size: 12px; }
.lc-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }
.peek-row { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px dashed var(--border); }
.peek-label { width: 42px; flex-shrink: 0; font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; padding-top: 2px; }
.peek-val { flex: 1; min-width: 0; font-size: 13px; color: var(--text); line-height: 1.6; word-break: break-all; }
.peek-val.strong { font-weight: 700; font-size: 14.5px; }
.peek-val.link { color: var(--info-blue); }
.peek-tag { display: inline-block; font-size: 10.5px; color: var(--accent); background: var(--accent-light); padding: 1px 8px; border-radius: 99px; margin: 0 4px 4px 0; }
.peek-open { width: 100%; margin-top: 14px; padding: 10px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.peek-open:hover { background: var(--accent-hover); }

/* 侧边栏 */
.sidebar { width: 56px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 12px 0; gap: 4px; flex-shrink: 0; }
.sidebar-logo { width: 36px; height: 36px; border-radius: 8px; background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 4px; cursor: pointer; transition: all .15s ease; }
.sidebar-logo:hover { background: var(--accent); transform: scale(1.05); }
.sidebar-item { width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; color: var(--text-3); transition: all .15s ease; position: relative; }
.sidebar-item:hover { background: var(--surface-3); color: var(--text-2); }
.sidebar-item.active { background: var(--accent-light); color: var(--accent); }
.sidebar-item .tip { position: absolute; left: 48px; background: #1A1D23; color: #fff; font-size: 11px; padding: 4px 9px; border-radius: 6px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s; z-index: 100; }
.sidebar-item:hover .tip { opacity: 1; }
.sidebar-divider { width: 24px; height: 1px; background: var(--border); margin: 4px 0; }
.sidebar-bottom { margin-top: auto; display: flex; flex-direction: column; gap: 4px; align-items: center; }

/* 主区 */
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.topbar { height: 48px; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; gap: 12px; flex-shrink: 0; }
.breadcrumb { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-2); }
.breadcrumb .root { color: var(--accent); font-weight: 600; cursor: pointer; }
.breadcrumb .sep { color: var(--text-3); }
.breadcrumb .current { color: var(--text); font-weight: 500; }
.dhi-badge { display: flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 99px; background: var(--accent-light); font-size: 11.5px; font-weight: 500; color: var(--accent); }
.dhi-badge.warning { background: var(--tag-warn-bg); color: var(--tag-warn-text); }

/* 画布（左侧为悬浮目录预留空间） */
.canvas { flex: 1; min-width: 0; padding: 0 4px 20px; }
.canvas-inner { max-width: 1000px; margin: 0 auto; min-width: 700px; }

.tree-page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.tree-page-head .crumb { font-size: 12.5px; color: var(--text-2); }
.tree-page-head .crumb b { color: var(--text); font-weight: 700; font-size: 19px; letter-spacing: .3px; }
.tree-page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
.tree-page-head .spacer { flex: 1; }
/* R49-C7：顶部统计 + 展开收起/显隐工具 */
.tree-stats { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.tree-tool { border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 11.5px; border-radius: 8px; padding: 5px 11px; cursor: pointer; font-family: inherit; transition: all .15s; white-space: nowrap; }
.tree-tool:hover { border-color: var(--accent); color: var(--accent); }
.tree-tool.off { opacity: .6; }
/* R52-F8/R54-A1：返回入口（accent 强调）+ 面包屑上级可点 */
.tree-tool.accent { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
.tree-page-head .crumb .crumb-up { cursor: pointer; color: var(--text-3); }
.tree-page-head .crumb .crumb-up:hover { color: var(--accent); }
.tree-page-head .crumb .crumb-sep { color: var(--text-4); }
/* R54-A3：?hl 定位闪烁 */
.node.goal-node.goal-flash { animation: treeGoalFlash 1.4s ease; }
@keyframes treeGoalFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); border-color: var(--accent); } }

/* D8：六层目录 = 布局内左栏 + sticky 跟随（目录在左，内容在右，随滚动吸附） */
.layer-toc { position: sticky; top: 16px; align-self: flex-start; width: 200px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 10px; display: flex; flex-direction: column; gap: 3px; box-shadow: var(--shadow); max-height: calc(100vh - 120px); overflow-y: auto; }
.lt-title { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: .5px; padding: 0 8px 10px; }
.lt-item { display: flex; align-items: center; gap: 8px; padding: 8px 9px; border-radius: 8px; cursor: pointer; transition: all .15s; border: 1px solid transparent; }
.lt-item:hover { background: var(--surface-3); }
.lt-item.active { background: var(--accent-light); border-color: color-mix(in srgb, var(--accent) 25%, transparent); }
.lt-item.active .lt-name { color: var(--accent); font-weight: 600; }
.lt-num { width: 20px; height: 20px; border-radius: 6px; background: var(--surface-3); color: var(--text-2); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
.lt-item.active .lt-num { background: var(--accent); color: #fff; }
.lt-name { font-size: 12.5px; color: var(--text-2); }
.lt-hint { margin-top: auto; font-size: 10px; color: var(--text-4); text-align: center; padding-top: 12px; }

/* 层标题 */
.layer-header { display: flex; align-items: center; gap: 9px; margin: 20px 0 10px; }
.layer-header:first-child { margin-top: 0; }
.layer-num { width: 24px; height: 24px; border-radius: 6px; background: var(--accent); color: #fff; font-size: 11.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.layer-name { font-size: 14px; font-weight: 600; color: var(--text); }
.layer-desc { font-size: 11px; color: var(--text-3); margin-left: 3px; }
.add-btn-inline { margin-left: auto; display: flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: #fff; transition: all .15s; font-family: inherit; }
.add-btn-inline:hover { background: var(--accent-hover); }

/* 节点通用 */
.node { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; cursor: pointer; transition: all .15s ease; position: relative; overflow: hidden; }
.node:hover { border-color: var(--border-strong); background: var(--surface-2); }
.node .node-top { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.node .node-tag { font-size: 9.5px; padding: 2px 7px; border-radius: 99px; font-weight: 500; flex-shrink: 0; }
.node .node-title { font-size: 13.5px; font-weight: 500; color: var(--text); line-height: 1.5; flex: 1; min-width: 0; }
.node .node-title.editable { cursor: text; outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; transition: background .15s; }
.node .node-title.editable:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.node .node-title.editable.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.node .node-meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 10.5px; color: var(--text-3); flex-wrap: wrap; }
.node .node-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 2px; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
.node:hover .node-actions { opacity: 1; }
/* R68-F4：操作按钮主题感知——原硬编码不透明白底 + 浅灰图标，深色主题（近黑画布）下对比度崩坏看不到入口 */
.node-action { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; color: var(--text-2); transition: all .15s; background: var(--surface-3); border: 1px solid var(--border); }
.node-action:hover { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.node-action.danger:hover { color: var(--danger); }

/* 愿景节点 */
.vision-node { background: linear-gradient(135deg, var(--accent-light), color-mix(in srgb, var(--accent-light) 50%, var(--surface))); border-color: color-mix(in srgb, var(--accent) 18%, var(--border)); padding: 16px 20px; }
.vision-node .node-title { font-size: 16px; font-weight: 600; color: var(--accent); line-height: 1.55; }
.vision-node .layer-label { font-size: 9.5px; color: var(--accent); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 5px; }

/* 使命节点 */
.mission-node { background: var(--surface-2); border-left: 3px solid var(--accent); }
.mission-tag { background: var(--accent-light); color: var(--accent); }

/* 连线 */
.tree-connector { display: flex; justify-content: center; margin: 4px 0; }

/* 战略目标 */
.goals-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.goal-col { display: flex; flex-direction: column; }
.goal-node { border-top: 3px solid var(--accent); }
.goal-node.stagnant { border-top-color: var(--stagnant); }
.goal-node .expand-icon { margin-left: auto; margin-right: 52px; font-size: 10px; color: var(--text-3); transition: transform .2s; }
/* Bug1：项目卡右上同样预留（🎯/📡 开关 vs ＋/🗑） */
.project-node .node-top { padding-right: 58px; }
.dir-tag { background: var(--accent-light); color: var(--accent); }
.progress-bar { height: 4px; background: var(--surface-3); border-radius: 99px; margin-top: 7px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 99px; transition: width .3s; }
.stagnant-tag { background: var(--tag-danger-bg); color: var(--danger); font-size: 9.5px; padding: 2px 7px; border-radius: 99px; font-weight: 500; }
.status-active { color: var(--success); }
.status-paused { color: var(--warning); }

/* 子树引导线 */
.sub-tree { position: relative; margin-top: 0; }
.guide-line { position: absolute; left: 50%; top: 0; width: 2px; height: 16px; background: linear-gradient(to bottom, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent)); transform: translateX(-50%); }
.sub-layer { margin-top: 16px; padding-top: 0; }
.sub-layer-label { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.sub-layer-num { width: 18px; height: 18px; border-radius: 5px; background: var(--surface-3); color: var(--text-2); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sub-layer-name { font-size: 11.5px; font-weight: 600; color: var(--text-2); }
.sub-layer-add { margin-left: auto; font-size: 10.5px; color: var(--text-3); cursor: pointer; padding: 2px 8px; border-radius: 5px; transition: all .15s; }
.sub-layer-add:hover { color: var(--accent); background: var(--accent-light); }

/* 项目分支引导线 */
.project-branch { position: relative; padding-left: 24px; margin-bottom: 10px; }
.branch-connector { position: absolute; left: 0; top: 0; bottom: 0; width: 24px; }
.branch-h { position: absolute; left: 0; top: 24px; width: 24px; height: 2px; background: linear-gradient(to right, color-mix(in srgb, var(--accent) 40%, transparent), color-mix(in srgb, var(--accent) 20%, transparent)); }
.branch-v { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, color-mix(in srgb, var(--accent) 30%, transparent), color-mix(in srgb, var(--accent) 10%, transparent)); }

/* 项目节点 */
.project-node { margin-bottom: 0; }
/* R59-T3：主攻项目——强调色凸显（边+底色+左侧强调条），与普通项目一眼区分 */
.project-node.primary { border: 1px solid var(--accent); background: var(--accent-light); box-shadow: inset 3px 0 0 var(--accent), 0 0 12px color-mix(in srgb, var(--accent) 14%, transparent); }
.project-node.primary .node-title { color: var(--accent); }
.focus-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 600; color: var(--text-3); background: var(--surface-3); border: 1px solid var(--border); border-radius: 99px; padding: 2px 10px; cursor: pointer; font-family: inherit; transition: all .12s; flex-shrink: 0; }
.focus-btn:hover { border-color: var(--accent); color: var(--accent); }
.focus-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.primary-badge { background: var(--accent); color: #fff; font-size: 9.5px; padding: 2px 7px; border-radius: 99px; font-weight: 500; }
.proj-tag { background: var(--surface-3); color: var(--text-2); }

/* 指标 */
.metrics-wrap { margin-top: 8px; }
.metric-item { display: flex; align-items: center; gap: 9px; padding: 8px 12px; background: var(--surface-2); border-radius: var(--radius-xs); margin-bottom: 6px; cursor: pointer; transition: all .15s; border: 1px solid transparent; position: relative; }
.metric-item:hover { background: var(--surface); border-color: var(--border); }
.metric-item.expanded { background: var(--surface); border-color: color-mix(in srgb, var(--accent) 20%, var(--border)); border-bottom-left-radius: 0; border-bottom-right-radius: 0; margin-bottom: 0; }
.metric-status { width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; }
.metric-status.done { background: var(--success); }
.metric-status.doing { background: var(--warning); }
.metric-status.todo { background: var(--text-3); }
.metric-name { font-size: 12.5px; color: var(--text); flex: 1; outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; cursor: text; transition: background .15s; }
.metric-name:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.metric-name.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.metric-progress { font-size: 10.5px; color: var(--text-3); font-weight: 500; }
.metric-task-count { font-size: 10px; color: var(--accent); background: var(--accent-light); padding: 2px 7px; border-radius: 99px; font-weight: 500; flex-shrink: 0; }
.metric-expand-icon { font-size: 10px; color: var(--text-3); transition: transform .2s; flex-shrink: 0; }
.metric-item.expanded .metric-expand-icon { transform: rotate(90deg); }
.metric-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.metric-item:hover .metric-actions { opacity: 1; }

/* 任务 */
.tasks-wrap { background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 15%, var(--border)); border-top: none; border-radius: 0 0 var(--radius-xs) var(--radius-xs); padding: 8px 12px 10px; margin-bottom: 6px; position: relative; }
.tasks-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px dashed var(--border); }
.tasks-header .th-num { width: 16px; height: 16px; border-radius: 4px; background: var(--accent-light); color: var(--accent); font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.tasks-header .th-name { font-size: 10.5px; font-weight: 600; color: var(--text-2); }
.tasks-header .th-count { font-size: 10px; color: var(--text-3); margin-left: auto; }
.tasks-header .th-add { font-size: 10px; color: var(--text-3); cursor: pointer; padding: 1px 6px; border-radius: 4px; transition: all .15s; }
.tasks-header .th-add:hover { color: var(--accent); background: var(--accent-light); }
.task-item { display: flex; align-items: center; gap: 7px; padding: 5px 9px 5px 20px; font-size: 12px; color: var(--text-2); cursor: pointer; transition: all .15s; border-radius: 5px; position: relative; }
.task-item::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0; width: 1px; background: var(--border); }
.task-item::after { content: ''; position: absolute; left: 10px; top: 50%; width: 6px; height: 1px; background: var(--border-strong); }
.task-item:hover { background: var(--surface-2); color: var(--text); }
.task-check { width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid var(--border-strong); flex-shrink: 0; cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; font-size: 9px; }
.task-check:hover { border-color: var(--accent); }
.task-check.done { background: var(--success); border-color: var(--success); color: #fff; }
.task-item.done .task-text { text-decoration: line-through; color: var(--text-3); }
.task-text { flex: 1; outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; cursor: text; transition: background .15s; }
.task-text:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.task-text.editing { background: color-mix(in srgb, var(--accent) 8%, transparent); box-shadow: 0 0 0 2px var(--accent-glow); }
.task-meta { font-size: 9.5px; color: var(--text-3); }
.task-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.task-item:hover .task-actions { opacity: 1; }
.tasks-empty { text-align: center; padding: 12px; font-size: 11px; color: var(--text-3); }
.empty-sub { text-align: center; padding: 16px; font-size: 11px; color: var(--text-3); }
.empty-state { text-align: center; padding: 40px 20px; color: var(--text-3); font-size: 13px; }
.empty-icon { font-size: 32px; opacity: .4; margin-bottom: 8px; }

/* 节点链接弹窗开关（愿景/使命关联资源） */
.proj-toggle { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.toggle { position: relative; width: 30px; height: 16px; border-radius: 99px; background: var(--border-strong); cursor: pointer; transition: background .2s; flex-shrink: 0; }
.toggle.on { background: var(--accent); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.toggle.on::after { transform: translateX(14px); }

/* 底部 */
.footer-hint { margin-top: 28px; padding: 14px; text-align: center; font-size: 11px; color: var(--text-3); line-height: 1.8; border-top: 1px solid var(--border); }

/* 动画 */
.expand-enter-active, .expand-leave-active { transition: all .15s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; margin-top: 0; padding-top: 0; }
</style>
