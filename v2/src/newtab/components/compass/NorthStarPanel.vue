<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCompass } from '../../stores/compass'
import { useAppStore } from '../../stores/app'
import { recordResourceOpen } from '../../stores/compass'
import { toOpenableUrl, openExternalLink } from '@/shared/utils/link'
import { uid } from '@/shared/utils'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import Drawer from '@/shared/components/Drawer.vue'
import ProjectDetailDrawer from '../ProjectDetailDrawer.vue'
import type { ResourceCard } from '@/shared/models'

const { northStarMetrics, formulas, allProjects, projectProgress } = useCompass()
const store = useAppStore()
const d = computed(() => store.data!)

const period = ref<'week' | 'month' | 'all'>('week')
const metrics = computed(() => northStarMetrics(period.value))
const periodLabel = computed(() => period.value === 'week' ? '本周' : period.value === 'month' ? '本月' : '累计')

// ---- 下钻抽屉 ----
type DrawerType = 'dhi' | 'wce' | 'wrr' | 'groups' | 'resources' | 'tasks'
const drawerOpen = ref(false)
const drawerType = ref<DrawerType>('dhi')
const drawerTitle = computed(() => ({
  dhi: '🧭 方向健康度明细 · DHI',
  wce: '💡 好奇探索明细 · WCE',
  wrr: '🟢 有效复用明细 · WRR',
  groups: '🗂 模块分组明细（按工作台）',
  resources: '🔗 链接卡片明细',
  tasks: '📥 未归档任务 · 待归档清单'
}[drawerType.value]))
const drawerFormula = computed(() => (formulas as Record<string, string>)[drawerType.value] || '')

function openDrawer(type: DrawerType) {
  drawerType.value = type
  drawerOpen.value = true
}

// ---- DHI：项目列表 → 点击打开可编辑项目抽屉 ----
const projects = computed(() => allProjects())
const dhiList = computed(() => projects.value.map(p => {
  const prog = projectProgress(p)
  const recentTask = d.value.tasks
    .filter(t => !t.deletedAt && t.projectId === p.id)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
  const stagnant = recentTask ? Date.now() - (recentTask.updatedAt || 0) > 14 * 86400_000 : prog.total > 0
  return { project: p, ...prog, stagnant }
}))
const projDrawerOpen = ref(false)
const projDrawerId = ref<string | null>(null)
function openProject(p: { id: string }) {
  projDrawerId.value = p.id
  projDrawerOpen.value = true
}

// ---- WCE：好奇心列表 ----
const statusLabel: Record<string, string> = { todo: '待探索', doing: '探索中', done: '已求证', shelf: '已搁置' }
const wceList = computed(() =>
  d.value.curiosities
    .filter(c => !c.deletedAt)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 20)
)

// ---- WRR：打开次数 Top 资源 ----
const wrrTop = computed(() =>
  [...d.value.resources.filter(r => !r.deletedAt)]
    .sort((a, b) => (b.callCount || 0) - (a.callCount || 0))
    .filter(r => (r.callCount || 0) > 0)
    .slice(0, 10)
)
function wsName(id: string): string {
  return d.value.workspaces.find(w => w.id === id)?.name || '未知'
}

// ---- 第卅一轮：模块分组（模块卡，点击弹窗查看卡片清单；不可编辑，顺序在顶部 Tab 拖拽调整） ----
const groupRows = computed(() =>
  d.value.workspaces
    .filter(w => !w.archived)
    .map(w => ({
      workspace: w,
      folders: d.value.categories
        .filter(c => c.workspaceId === w.id)
        .sort((a, b) => a.order - b.order)
    }))
)
function cardCountOf(wsId: string): number {
  return d.value.resources.filter(r => !r.deletedAt && r.workspaceId === wsId).length
}
const wsPopupOpen = ref(false)
const wsPopupId = ref<string | null>(null)
const wsPopup = computed(() => d.value.workspaces.find(w => w.id === wsPopupId.value) || null)
const wsPopupCards = computed(() => wsPopupId.value ? d.value.resources.filter(r => !r.deletedAt && r.workspaceId === wsPopupId.value) : [])
/** 第卅三轮 REQ-025：抽屉内平铺分类（含卡数），点击分类直接进入卡片列表弹窗（三次点击→两次） */
const catCountMap = computed(() => {
  const m = new Map<string, number>()
  for (const r of d.value.resources) {
    if (r.deletedAt) continue
    const k = r.categoryId || '__none__'
    m.set(k, (m.get(k) || 0) + 1)
  }
  return m
})
function catCount(catId: string): number { return catCountMap.value.get(catId) || 0 }
function uncatCountOf(wsId: string): number {
  return d.value.resources.filter(r => !r.deletedAt && r.workspaceId === wsId && !r.categoryId).length
}
function openWsPopup(wsId: string, catId?: string | null) {
  wsPopupId.value = wsId
  activeCatId.value = catId ?? null
  wsPopupLevel.value = 'cards'
  wsPopupOpen.value = true
}

// ---- 第卅二轮 REQ-013/014：模块分组明细重构 —— 二级=分类名+数量，三级=分类下资源卡列表（支持返回上一层） ----
const wsPopupLevel = ref<'cats' | 'cards'>('cats')
const activeCatId = ref<string | null>(null)
const wsPopupCats = computed(() => {
  if (!wsPopupId.value) return []
  const cats = d.value.categories
    .filter(c => c.workspaceId === wsPopupId.value)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return cats.map(c => ({ id: c.id, name: c.name, count: d.value.resources.filter(r => !r.deletedAt && r.categoryId === c.id).length }))
})
const wsPopupUncatCount = computed(() =>
  wsPopupId.value ? d.value.resources.filter(r => !r.deletedAt && r.workspaceId === wsPopupId.value && !r.categoryId).length : 0
)
const activeCatName = computed(() => {
  if (!activeCatId.value) return '📥 待分类'
  return d.value.categories.find(c => c.id === activeCatId.value)?.name || '📥 待分类'
})
const activeCatCards = computed(() => {
  if (!wsPopupId.value) return []
  return wsPopupCards.value.filter(r => activeCatId.value ? r.categoryId === activeCatId.value : !r.categoryId)
})
function openCatCards(catId: string | null) { activeCatId.value = catId; wsPopupLevel.value = 'cards' }
function backToCats() { wsPopupLevel.value = 'cats'; activeCatId.value = null }
/** 卡片行类型图标（REQ-014：列表项含标题与类型图标） */
function linkTypeIcon(r: ResourceCard): string {
  return r.linkType === 'file' ? '📄' : r.linkType === 'obsidian' ? '📝' : '🌐'
}

function wsDisplayName(w: { icon?: string; name: string }): string {
  return (w.icon || '📁') + ' ' + w.name.replace(/^[^\s]+\s/, '')
}

// ---- 第卅一轮：链接卡片明细（全量 + 搜索 + 按模块分组） ----
const resSearch = ref('')
const allLinkCards = computed(() => d.value.resources.filter(r => !r.deletedAt && (r.link || '').trim()))
const filteredLinkCards = computed(() => {
  const q = resSearch.value.trim().toLowerCase()
  if (!q) return allLinkCards.value
  return allLinkCards.value.filter(r => {
    const hay = [r.title, r.link, wsName(r.workspaceId), catNameOf(r), ...(Array.isArray(r.tags) ? r.tags : [])].join(' ').toLowerCase()
    return hay.includes(q)
  })
})
const groupedLinkCards = computed(() => {
  const groups: { wsId: string; name: string; cards: ResourceCard[] }[] = []
  for (const w of d.value.workspaces.filter(w => !w.archived)) {
    const cards = filteredLinkCards.value.filter(r => r.workspaceId === w.id)
    if (cards.length) groups.push({ wsId: w.id, name: wsDisplayName(w), cards })
  }
  const other = filteredLinkCards.value.filter(r => !d.value.workspaces.some(w => w.id === r.workspaceId))
  if (other.length) groups.push({ wsId: '__none__', name: '🗂 未归类', cards: other })
  return groups
})
function catNameOf(r: ResourceCard): string {
  return d.value.categories.find(c => c.id === r.categoryId)?.name || '待分类'
}
function linkHost(r: ResourceCard): string {
  if (r.linkType === 'file') return '📄 ' + (r.link.split(/[\\/]/).pop() || r.link)
  if (r.linkType === 'obsidian') return 'Obsidian'
  try { return new URL(r.link).host } catch { return r.link.slice(0, 40) }
}

// 卡片行交互：单击（260ms 判定）=详情抽屉；双击=打开链接（三卡统一交互）
const detailRes = ref<ResourceCard | null>(null)
let resClickTimer: ReturnType<typeof setTimeout> | null = null
function onCardRowClick(r: ResourceCard) {
  if (resClickTimer) { window.clearTimeout(resClickTimer); resClickTimer = null; return }
  resClickTimer = setTimeout(() => { resClickTimer = null; detailRes.value = r }, 260)
}
function onCardRowDblClick(r: ResourceCard) {
  if (resClickTimer) { window.clearTimeout(resClickTimer); resClickTimer = null }
  openResLink(r)
}

// ---- 链接卡片：打开 / 跳转工作台（第卅二轮 REQ-010：统一打开通道；不可打开→跳转工作台定位） ----
function openResLink(r: ResourceCard) {
  recordResourceOpen(d.value, r)
  store.persist()
  const url = toOpenableUrl(r.linkType, r.link)
  if (url) openExternalLink(url)
  else openProjectWorkspace(r)
}
function openProjectWorkspace(r: ResourceCard) {
  chrome.runtime.sendMessage({ type: 'zy-locate-workspace', wsId: r.workspaceId, hl: r.id })
}

// ---- O23：未归档任务（指标缺失也算未归档）+ 级联归档操作 ----
const unarchivedTasks = computed(() =>
  d.value.tasks.filter(t => !t.deletedAt && !t.metricId)
)
function projectName(projectId?: string): string {
  if (!projectId) return ''
  return allProjects().find(p => p.id === projectId)?.name || ''
}
function metricsOf(projectId?: string) {
  if (!projectId) return []
  return allProjects().find(p => p.id === projectId)?.metrics || []
}
function changeTaskProject(taskId: string, e: Event) {
  const pid = (e.target as HTMLSelectElement).value
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  t.projectId = pid || undefined
  t.metricId = undefined // 项目变化后重置指标，待用户重选
  t.updatedAt = Date.now()
  store.persist()
}
function changeTaskMetric(taskId: string, e: Event) {
  const mid = (e.target as HTMLSelectElement).value
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const oldMetricId = t.metricId
  t.metricId = mid || undefined
  // 同步 metric.taskIds
  for (const dir of d.value.compass.directions) {
    for (const p of dir.projects) {
      for (const m of p.metrics) {
        if (m.id === oldMetricId) m.taskIds = m.taskIds.filter(id => id !== taskId)
        if (m.id === mid && !m.taskIds.includes(taskId)) m.taskIds.push(taskId)
      }
    }
  }
  t.updatedAt = Date.now()
  store.persist()
}
</script>

<template>
  <ModuleCard title="知源北极星" en="NORTH STAR">
    <template #title>
      <!-- 北极星可视化图标：四芒星 + 光晕 -->
      <span class="ns-star" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <circle cx="12" cy="12" r="11" fill="var(--accent-light)" />
          <path d="M12 2 L13.7 10.3 L22 12 L13.7 13.7 L12 22 L10.3 13.7 L2 12 L10.3 10.3 Z"
            fill="var(--accent)" />
          <circle cx="12" cy="12" r="1.6" fill="var(--surface)" />
        </svg>
      </span>
      <span class="ns-name">知源北极星</span>
      <span class="ns-en">NORTH STAR</span>
    </template>

    <template #actions>
      <div class="period-switch">
        <button v-for="p in (['week','month','all'] as const)" :key="p"
          class="period-btn" :class="{active: period === p}" @click="period = p">
          {{ p === 'week' ? '周' : p === 'month' ? '月' : '累计' }}
        </button>
      </div>
    </template>

    <div class="ns-body">
      <div class="ns-matrix">
        <div class="ns-card top" @click="openDrawer('dhi')">
          <div class="ns-label">🧭 DHI <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ metrics.dhi.label }}</div>
          <div class="ns-sub">{{ metrics.dhi.sub }}</div>
        </div>
        <div class="ns-card top" @click="openDrawer('wce')">
          <div class="ns-label">💡 WCE <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ metrics.wce.label }}</div>
          <div class="ns-sub">{{ metrics.wce.sub }}</div>
        </div>
        <div class="ns-card top" @click="openDrawer('wrr')">
          <div class="ns-label">🟢 WRR <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ metrics.wrr.label }}</div>
          <div class="ns-sub">{{ metrics.wrr.sub }}</div>
        </div>
        <div class="ns-card bottom" @click="openDrawer('groups')">
          <div class="ns-label">🗂 模块分组 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ metrics.categories }}</div>
        </div>
        <div class="ns-card bottom" @click="openDrawer('resources')">
          <div class="ns-label">🔗 链接卡片 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ metrics.resources }}</div>
        </div>
        <div class="ns-card bottom" @click="openDrawer('tasks')">
          <div class="ns-label">📥 未归档任务 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ unarchivedTasks.length }}</div>
        </div>
      </div>
    </div>

    <!-- 六指标下钻抽屉 -->
    <Drawer :open="drawerOpen" :title="drawerTitle" width="460px" @close="drawerOpen = false">
      <div class="nd-formula">📐 {{ drawerFormula }}</div>

      <!-- DHI -->
      <template v-if="drawerType === 'dhi'">
        <div class="dhi-list">
          <div v-for="item in dhiList" :key="item.project.id" class="nd-item clickable" @click="openProject(item.project)">
            <div class="nd-name">{{ item.project.name }}</div>
            <div v-if="item.stagnant" class="nd-tag warn">⚠ 停滞</div>
            <div v-else class="nd-meta">{{ item.done }}/{{ item.total }}</div>
            <div class="nd-progress"><div class="nd-bar" :style="{width: item.pct + '%'}" /></div>
            <span class="nd-edit-hint">✎</span>
          </div>
          <div v-if="!dhiList.length" class="nd-empty">暂无项目，去六层思维树创建</div>
          <div class="nd-tip">点击项目可编辑指标与任务，实时同步罗盘</div>
        </div>
      </template>

      <!-- WCE -->
      <template v-else-if="drawerType === 'wce'">
        <div class="dhi-list">
          <div v-for="c in wceList" :key="c.id" class="nd-item">
            <div class="nd-name text">{{ c.question }}</div>
            <div class="nd-meta">{{ statusLabel[c.status] }}</div>
          </div>
          <div v-if="!wceList.length" class="nd-empty">暂无好奇心卡</div>
        </div>
      </template>

      <!-- WRR -->
      <template v-else-if="drawerType === 'wrr'">
        <div class="nd-stat-row">
          <div class="nd-stat"><b>{{ metrics.wrr.label }}</b><span>累计打开</span></div>
          <div class="nd-stat"><b>{{ metrics.wrr.sub }}</b><span>{{ periodLabel }}</span></div>
        </div>
        <div class="dhi-list">
          <div v-for="r in wrrTop" :key="r.id" class="nd-item clickable" @click="openResLink(r)">
            <div class="nd-name text">{{ r.title }}</div>
            <div class="nd-meta">🔥{{ r.callCount }}次</div>
            <span class="nd-edit-hint">↗</span>
          </div>
          <div v-if="!wrrTop.length" class="nd-empty">还没有资源被打开过——去工作台双击卡片或搜索打开</div>
        </div>
      </template>

      <!-- 模块分组（第卅一轮：模块卡；第卅三轮 REQ-025：抽屉内直接平铺分类，点击直达卡片列表） -->
      <template v-else-if="drawerType === 'groups'">
        <div class="nd-flat">
          <template v-for="grp in groupRows" :key="grp.workspace.id">
            <div class="nd-flat-ws">
              <span class="nd-flat-ws-name">{{ grp.workspace.icon || '📁' }} {{ grp.workspace.name.replace(/^[^\s]+\s/, '') }}</span>
              <span class="nd-count">{{ cardCountOf(grp.workspace.id) }} 张卡</span>
            </div>
            <div v-if="grp.folders.length || uncatCountOf(grp.workspace.id)" class="nd-flat-cats">
              <div v-for="c in grp.folders" :key="c.id" class="nw-row clickable"
                :title="'查看「' + c.name + '」的卡片'" @click="openWsPopup(grp.workspace.id, c.id)">
                <div class="nd-row-main">
                  <div class="nw-row-title">📂 {{ c.name }}</div>
                </div>
                <div class="nw-row-side"><span class="nw-chip">{{ catCount(c.id) }} 张卡</span><span class="nd-ws-go">›</span></div>
              </div>
              <div v-if="uncatCountOf(grp.workspace.id)" class="nw-row clickable" @click="openWsPopup(grp.workspace.id, null)">
                <div class="nd-row-main">
                  <div class="nw-row-title">📥 待分类</div>
                </div>
                <div class="nw-row-side"><span class="nw-chip">{{ uncatCountOf(grp.workspace.id) }} 张卡</span><span class="nd-ws-go">›</span></div>
              </div>
            </div>
            <div v-else class="nd-flat-empty">暂无分类，去工作台侧栏创建</div>
          </template>
          <div v-if="!groupRows.length" class="nd-empty">暂无工作台</div>
        </div>
        <div class="nd-tip">按工作台分区平铺 · 点击分类直接查看卡片清单 · 顺序在顶部导航拖拽 Tab 调整 · 分类增删改在工作台侧栏</div>
      </template>

      <!-- 链接卡片（第卅一轮：全量 + 搜索 + 按模块分组 + 单击详情/双击打开） -->
      <template v-else-if="drawerType === 'resources'">
        <input class="nd-search" v-model="resSearch" placeholder="🔍 搜索标题 / 标签 / 链接 / 模块…" />
        <template v-for="g in groupedLinkCards" :key="g.wsId">
          <div class="nd-group-name">{{ g.name }}<span class="nd-count">{{ g.cards.length }}</span></div>
          <div class="dhi-list">
            <div v-for="r in g.cards" :key="r.id" class="nd-item clickable" :title="'单击查看详情 · 双击打开链接'"
              @click="onCardRowClick(r)" @dblclick="onCardRowDblClick(r)">
              <div class="nd-row-main">
                <div class="nd-name text">{{ r.title }}</div>
                <div class="nd-sub-line">{{ linkHost(r) }} · {{ catNameOf(r) }}</div>
              </div>
              <span v-if="r.callCount" class="nd-fire">🔥{{ r.callCount }}</span>
            </div>
          </div>
        </template>
        <div v-if="!filteredLinkCards.length" class="nd-empty">{{ resSearch ? '没有匹配的卡片，换个关键词试试' : '暂无含链接的资源卡' }}</div>
        <div class="nd-tip">单击查看详情 · 双击打开链接 · 支持按标题/标签/链接/模块搜索</div>
      </template>

      <!-- O23 未归档任务：级联归档（关联成功后即时从清单消失） -->
      <template v-else>
        <div class="dhi-list">
          <div v-for="t in unarchivedTasks" :key="t.id" class="nd-task-row">
            <div class="nd-name text">{{ t.title }}</div>
            <div class="nd-task-links">
              <select class="nd-select" :value="t.projectId || ''" @change="changeTaskProject(t.id, $event)">
                <option value="">📦 未关联项目</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">📦 {{ p.name }}</option>
              </select>
              <select class="nd-select" :value="t.metricId || ''" :disabled="!t.projectId" @change="changeTaskMetric(t.id, $event)" title="关联成功指标后即完成归档">
                <option value="">🎯 未关联指标</option>
                <option v-for="m in metricsOf(t.projectId)" :key="m.id" :value="m.id">🎯 {{ m.title }}</option>
              </select>
            </div>
          </div>
          <div v-if="!unarchivedTasks.length" class="nd-empty">🎉 没有未归档任务——所有任务都已挂到成功指标</div>
        </div>
        <div class="nd-tip">📥 未归档 = 未挂成功指标的任务（含未挂项目的）。先选项目再选指标，关联成功后任务立即从清单消失，任务中心与罗盘同步生效</div>
      </template>
    </Drawer>

    <!-- 第卅二轮 REQ-013/014：模块分组下钻弹窗（二级=分类名+数量；三级=分类下资源卡列表，可返回上一层） -->
    <Teleport to="body">
      <div v-if="wsPopupOpen" class="nw-overlay" @click.self="wsPopupOpen = false">
        <div class="nw-panel">
          <div class="nw-head">
            <button v-if="wsPopupLevel === 'cards'" class="nw-back" @click="backToCats" title="返回上一层">‹ 返回</button>
            <div class="nw-title">{{ wsPopup ? wsDisplayName(wsPopup) : '' }}<template v-if="wsPopupLevel === 'cards'"> / {{ activeCatName }}</template> · {{ wsPopupLevel === 'cats' ? '分类清单' : '资源卡列表' }}<span class="nw-count">{{ wsPopupLevel === 'cats' ? wsPopupCats.length + (wsPopupUncatCount ? 1 : 0) : activeCatCards.length }}</span></div>
            <button class="nw-close" @click="wsPopupOpen = false">×</button>
          </div>
          <div class="nw-body">
            <!-- 二级：分类名 + 资源卡数量 -->
            <template v-if="wsPopupLevel === 'cats'">
              <div v-for="c in wsPopupCats" :key="c.id" class="nw-row clickable" @click="openCatCards(c.id)">
                <div class="nd-row-main">
                  <div class="nw-row-title">📂 {{ c.name }}</div>
                </div>
                <div class="nw-row-side"><span class="nw-chip">{{ c.count }} 张卡</span><span class="nd-ws-go">›</span></div>
              </div>
              <div v-if="wsPopupUncatCount" class="nw-row clickable" @click="openCatCards(null)">
                <div class="nd-row-main">
                  <div class="nw-row-title">📥 待分类</div>
                </div>
                <div class="nw-row-side"><span class="nw-chip">{{ wsPopupUncatCount }} 张卡</span><span class="nd-ws-go">›</span></div>
              </div>
              <div v-if="!wsPopupCats.length && !wsPopupUncatCount" class="nd-empty">该模块暂无分类 · 去工作台侧栏创建</div>
            </template>
            <!-- 三级：分类下资源卡列表 -->
            <template v-else>
              <div v-for="r in activeCatCards" :key="r.id" class="nw-row" title="单击查看详情 · 双击打开链接"
                @click="onCardRowClick(r)" @dblclick="onCardRowDblClick(r)">
                <div class="nd-row-main">
                  <div class="nw-row-title">{{ linkTypeIcon(r) }} {{ r.title }}</div>
                  <div class="nw-row-sub">{{ linkHost(r) }}</div>
                </div>
                <div class="nw-row-side">
                  <span v-if="r.callCount" class="nd-fire">🔥{{ r.callCount }}</span>
                </div>
              </div>
              <div v-if="!activeCatCards.length" class="nd-empty">该分类暂无资源卡</div>
            </template>
          </div>
          <div class="nw-foot">{{ wsPopupLevel === 'cats' ? '点击分类查看资源卡列表' : '单击查看详情 · 双击打开链接' }}</div>
        </div>
      </div>
    </Teleport>

    <!-- 第卅一轮：卡片详情抽屉（单击打开） -->
    <Drawer :open="!!detailRes" title="🔗 卡片详情" @close="detailRes = null">
      <template v-if="detailRes">
        <div class="nr-title">{{ detailRes.title }}</div>
        <div class="nr-row"><span class="nr-k">链接</span><span class="nr-v link">{{ detailRes.link }}</span></div>
        <div class="nr-row"><span class="nr-k">类型</span><span class="nr-v">{{ detailRes.linkType === 'url' ? '🌐 网页' : detailRes.linkType === 'file' ? '📄 本地文件' : 'Obsidian' }}</span></div>
        <div class="nr-row"><span class="nr-k">模块</span><span class="nr-v">{{ wsName(detailRes.workspaceId).replace(/^[^\s]+\s/, '') }} / {{ catNameOf(detailRes) }}</span></div>
        <div class="nr-row" v-if="detailRes.description"><span class="nr-k">描述</span><span class="nr-v">{{ detailRes.description }}</span></div>
        <div class="nr-row" v-if="Array.isArray(detailRes.tags) && detailRes.tags.length"><span class="nr-k">标签</span><span class="nr-v">#{{ detailRes.tags.join(' #') }}</span></div>
        <div class="nr-actions">
          <button class="nd-btn" @click="detailRes && openResLink(detailRes)">↗ 打开链接</button>
          <button class="nd-btn ghost" @click="detailRes && openProjectWorkspace(detailRes)">📂 前往工作台</button>
        </div>
      </template>
    </Drawer>

    <ProjectDetailDrawer :open="projDrawerOpen" :project-id="projDrawerId" @close="projDrawerOpen = false" />
  </ModuleCard>
</template>

<style scoped>
/* 北极星图标 */
.ns-star { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; }
.ns-star svg { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 45%, transparent)); animation: ns-twinkle 3.4s ease-in-out infinite; }
@keyframes ns-twinkle {
  0%, 100% { opacity: .85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.07); }
}
.ns-name { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: .3px; }
.ns-en { font-size: 9px; color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; margin-left: 2px; }

.period-switch { display: flex; gap: 2px; background: var(--surface-3); border-radius: 8px; padding: 3px; }
.period-btn { padding: 4px 12px; border-radius: 6px; border: none; background: transparent; font-size: 11.5px; color: var(--text-3); cursor: pointer; font-family: inherit; font-weight: 500; transition: all .15s; }
.period-btn:hover { color: var(--text-2); }
.period-btn.active { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }

.ns-body { flex: 1; display: flex; flex-direction: column; }
/* 第卅五轮 REQ-033：2×3 指标网格撑满卡片高度，与左侧灯塔下边缘对齐（去掉状态条后无冗余留白） */
.ns-matrix { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-auto-rows: 1fr; gap: 10px; flex: 1; }
.ns-card { border-radius: var(--radius-xs); padding: 12px 14px; cursor: pointer; transition: all .15s; border: 1px solid transparent; display: flex; flex-direction: column; justify-content: center; }
.ns-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.ns-card.top { background: var(--accent-light); }
.ns-card.bottom { background: var(--surface-3); }
.ns-label { font-size: 11px; color: var(--text-2); margin-bottom: 4px; display: flex; align-items: center; }
.ns-hint { margin-left: auto; font-size: 10px; opacity: 0; transition: opacity .15s; color: var(--accent); }
.ns-card:hover .ns-hint { opacity: 1; }
.ns-value { font-size: 20px; font-weight: 600; color: var(--text); line-height: 1.2; letter-spacing: -.2px; font-variant-numeric: tabular-nums; }
.ns-card.top .ns-value { color: var(--accent); }
.ns-sub { font-size: 10px; color: var(--text-3); margin-top: 3px; }

/* 下钻抽屉 */
.nd-formula { font-size: 11.5px; color: var(--accent); background: var(--accent-light); border-radius: 8px; padding: 9px 12px; line-height: 1.6; margin-bottom: 14px; }
.dhi-list .nd-item { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 8px; display: flex; align-items: center; gap: 10px; background: var(--surface); }
.nd-item.clickable { cursor: pointer; }
.nd-item.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.nd-name { font-size: 13px; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nd-name.text { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.nd-meta { font-size: 11px; color: var(--text-3); white-space: nowrap; }
.nd-tag.warn { font-size: 10px; color: var(--tag-warn-text); background: var(--tag-warn-bg); padding: 2px 8px; border-radius: 99px; font-weight: 500; }
.nd-progress { width: 80px; height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; flex-shrink: 0; }
.nd-bar { height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s; }
.nd-item.stagnant { border-color: var(--danger); }
.nd-edit-hint { font-size: 12px; color: var(--text-3); cursor: pointer; flex-shrink: 0; }
.nd-edit-hint:hover { color: var(--accent); }
.nd-empty { text-align: center; padding: 32px; color: var(--text-3); font-size: 13px; }
.nd-tip { margin-top: 12px; font-size: 11px; color: var(--text-3); text-align: center; }

.nd-stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.nd-stat { background: var(--surface-2); border-radius: var(--radius-xs); padding: 12px; text-align: center; }
.nd-stat b { display: block; font-size: 18px; color: var(--accent); }
.nd-stat span { font-size: 10.5px; color: var(--text-3); }

.nd-group { margin-bottom: 16px; }
.nd-group-name { font-size: 12px; font-weight: 700; color: var(--text-2); margin-bottom: 6px; }
.nd-drag { color: var(--text-4); font-size: 11px; cursor: grab; flex-shrink: 0; }
.nd-input { flex: 1; min-width: 0; border: 1px solid transparent; background: transparent; outline: none; font-size: 12.5px; color: var(--text); font-family: inherit; border-radius: 5px; padding: 3px 6px; margin: -3px -6px; }
.nd-input:focus { border-color: var(--accent); background: var(--surface); }
.nd-edit { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.nd-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
.nd-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 11px; cursor: pointer; font-family: inherit; }
.nd-btn.ghost { background: var(--surface); border-color: var(--border); color: var(--text-2); }
.nd-task-row { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 8px; background: var(--surface); }
.nd-task-links { display: flex; gap: 6px; margin-top: 8px; }
.nd-select { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 11px; color: var(--text-2); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; }
.nd-select:focus { border-color: var(--accent); }
.nd-select:disabled { opacity: .5; cursor: not-allowed; }

/* 第卅一轮：模块分组·模块卡 */
.nd-ws-list { display: flex; flex-direction: column; gap: 8px; }
.nd-ws-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); transition: all .15s; }
.nd-ws-card.clickable { cursor: pointer; }
.nd-ws-card.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.nd-ws-icon { width: 34px; height: 34px; border-radius: 8px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.nd-ws-main { flex: 1; min-width: 0; }
.nd-ws-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
.nd-ws-meta { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.nd-ws-go { font-size: 16px; color: var(--text-4); transition: all .15s; }
.nd-ws-card:hover .nd-ws-go { color: var(--accent); transform: translateX(2px); }

/* 第卅三轮 REQ-025：模块分组平铺（工作台分区 → 分类行，点击直达卡片列表） */
.nd-flat { display: flex; flex-direction: column; gap: 4px; }
.nd-flat-ws { display: flex; align-items: center; justify-content: space-between; padding: 14px 4px 6px; border-bottom: 1px solid var(--border); }
.nd-flat-ws:first-child { padding-top: 4px; }
.nd-flat-ws-name { font-size: 13px; font-weight: 700; color: var(--text); }
.nd-flat-cats { display: flex; flex-direction: column; gap: 6px; padding: 6px 0 4px; }
.nd-flat-empty { font-size: 11.5px; color: var(--text-3); padding: 6px 4px 10px; }

/* 第卅一轮：链接卡片搜索 + 分组 + 行 */
.nd-search { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: 12.5px; font-family: inherit; outline: none; margin-bottom: 12px; transition: border-color .15s; }
.nd-search:focus { border-color: var(--accent); }
.nd-search::placeholder { color: var(--text-4); }
.nd-group-name { font-size: 11.5px; font-weight: 700; color: var(--text-2); margin: 12px 0 7px; display: flex; align-items: center; gap: 6px; }
.nd-count { font-size: 10px; color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 1px 7px; font-weight: 500; }
.nd-row-main { flex: 1; min-width: 0; }
.nd-sub-line { font-size: 10.5px; color: var(--text-4); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nd-fire { font-size: 10.5px; color: var(--curio-amber, #E8A33D); flex-shrink: 0; }

/* 第卅一轮：模块卡片清单弹窗 */
.nw-overlay { position: fixed; inset: 0; background: var(--overlay-bg, rgba(0,0,0,.4)); z-index: 300; display: flex; align-items: center; justify-content: center; }
.nw-panel { width: 560px; max-width: 92vw; max-height: 78vh; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; }
.nw-head { padding: 15px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; }
.nw-title { font-size: 13.5px; font-weight: 600; color: var(--text); flex: 1; }
.nw-count { margin-left: 8px; font-size: 10.5px; color: var(--accent); background: var(--accent-light); border-radius: 99px; padding: 1px 8px; font-weight: 500; }
.nw-close { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; color: var(--text-3); font-size: 17px; cursor: pointer; font-family: inherit; }
.nw-back { flex-shrink: 0; margin-right: 10px; padding: 3px 10px; border-radius: 7px; border: 1px solid var(--border); background: transparent; color: var(--text-2); font-size: 11.5px; cursor: pointer; font-family: inherit; }
.nw-back:hover { border-color: var(--accent); color: var(--accent); }
.nw-row.clickable:hover { border-color: var(--accent); }
.nw-close:hover { background: var(--surface-3); color: var(--text); }
.nw-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
.nw-row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 6px; background: var(--surface); cursor: pointer; transition: all .15s; }
.nw-row:hover { border-color: var(--accent); background: var(--accent-light); }
.nw-row-title { font-size: 12.5px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nw-row-sub { font-size: 10.5px; color: var(--text-4); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nw-row-side { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.nw-chip { font-size: 10px; color: var(--text-3); background: var(--surface-3); border-radius: 99px; padding: 2px 8px; white-space: nowrap; }
.nw-foot { padding: 10px 18px; border-top: 1px solid var(--border); font-size: 10.5px; color: var(--text-4); text-align: center; }

/* 第卅一轮：卡片详情抽屉 */
.nr-title { font-size: 14.5px; font-weight: 600; color: var(--text); line-height: 1.5; margin-bottom: 14px; }
.nr-row { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.nr-k { width: 40px; flex-shrink: 0; color: var(--text-4); }
.nr-v { flex: 1; min-width: 0; color: var(--text-2); word-break: break-all; line-height: 1.6; }
.nr-v.link { color: var(--accent); }
.nr-actions { display: flex; gap: 8px; margin-top: 16px; }
</style>
