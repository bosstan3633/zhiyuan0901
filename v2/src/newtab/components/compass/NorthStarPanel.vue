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

// R45-1（V2.20.0）：周期三档 日/周/累计（撤月档），下排新增/删除卡随档位联动
const period = ref<'day' | 'week' | 'all'>('day')
const metrics = computed(() => northStarMetrics(period.value))
const periodLabel = computed(() => period.value === 'day' ? '今日' : period.value === 'week' ? '本周' : '累计')

// ---- 下钻抽屉 ----
// 第卌四轮 T-02：撤出 groups/resources（迁往设置页策展台全景/仪表盘），新增 today-add/today-del
type DrawerType = 'dhi' | 'wce' | 'wrr' | 'today-add' | 'today-del' | 'tasks'
const drawerOpen = ref(false)
const drawerType = ref<DrawerType>('dhi')
const drawerTitle = computed(() => ({
  dhi: '🧭 方向健康度明细 · 战略目标 / 推进项目',
  wce: '💡 好奇探索明细 · WCE',
  wrr: '🟢 有效复用明细 · WRR',
  'today-add': `📈 新增卡片明细 · ${periodLabel.value}`,
  'today-del': `📉 删除卡片明细 · ${periodLabel.value}`,
  tasks: '📥 未归档任务 · 待归档清单'
}[drawerType.value]))
/** R45-1：新增/删除卡片口径说明（随档位联动，本地维护，compass.formulas 不含） */
const localFormulas = computed<Record<string, string>>(() => {
  const win = period.value === 'day' ? '今天 0 点' : period.value === 'week' ? '本周一 0 点' : '建库以来'
  return {
    'today-add': `新增卡片 = ${win}创建的三卡总数（资源+任务+好奇，实时派生自 createdAt，随上方周期切换）`,
    'today-del': `删除卡片 = ${win}软删除的三卡总数（派生自 deletedAt，可在回收站恢复，随上方周期切换）`
  }
})
const drawerFormula = computed(() => localFormulas.value[drawerType.value] || (formulas as Record<string, string>)[drawerType.value] || '')

function openDrawer(type: DrawerType) {
  drawerType.value = type
  drawerOpen.value = true
}

// ---- 战略目标 / 推进项目：项目列表 → 点击打开可编辑项目抽屉（R70：原 DHI 口径已于 R64 退役） ----
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

// ---- R45-1：新增/删除卡片（纯派生 createdAt/deletedAt，零新增存储；窗口随周期三档联动） ----
function startOf(ts: number, unit: 'day' | 'week'): number {
  const dt = new Date(ts); dt.setHours(0, 0, 0, 0)
  if (unit === 'day') return dt.getTime()
  const dow = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - dow)
  return dt.getTime()
}
type FlatCard = { kind: 'resource' | 'task' | 'curiosity'; id: string; title: string; createdAt: number; deletedAt?: number; importedAt?: number }
const allCardsFlat = computed<FlatCard[]>(() => [
  ...d.value.resources.map(r => ({ kind: 'resource' as const, id: r.id, title: r.title || '（无标题）', createdAt: r.createdAt || 0, deletedAt: r.deletedAt, importedAt: r.importedAt })),
  ...d.value.tasks.map(t => ({ kind: 'task' as const, id: t.id, title: t.title || '（无标题）', createdAt: t.createdAt || 0, deletedAt: t.deletedAt, importedAt: t.importedAt })),
  ...d.value.curiosities.map(c => ({ kind: 'curiosity' as const, id: c.id, title: c.question || '（无标题）', createdAt: c.createdAt || 0, deletedAt: c.deletedAt, importedAt: c.importedAt }))
])
function kindIcon(kind: FlatCard['kind']): string { return kind === 'resource' ? '📇' : kind === 'task' ? '✅' : '💡' }
/** 日档只显 HH:mm；周/累计档显 MM-DD HH:mm */
function fmtStamp(ts?: number): string {
  if (!ts) return ''
  const dt = new Date(ts)
  const hm = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  return period.value === 'day' ? hm : `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${hm}`
}
function kindSub(list: FlatCard[]): string {
  const n = { resource: 0, task: 0, curiosity: 0 }
  for (const x of list) n[x.kind]++
  return `资源${n.resource}·任务${n.task}·好奇${n.curiosity}`
}
/** 周期窗口起点：日=今天 0 点 / 周=本周一 0 点 / 累计=0（全量） */
const periodStart = computed(() => period.value === 'all' ? 0 : startOf(Date.now(), period.value))
const todayAddList = computed(() =>
  allCardsFlat.value.filter(x => !x.deletedAt && x.createdAt >= periodStart.value)
    .sort((a, b) => b.createdAt - a.createdAt))
const todayDelList = computed(() =>
  allCardsFlat.value.filter(x => x.deletedAt && x.deletedAt >= periodStart.value)
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)))
const todayAddSub = computed(() => {
  // R48-B2 双口径：窗口内有导入卡时，副标提示「含导入 N」（导入继承原 createdAt，不混入新建数）
  const imp = todayAddList.value.filter(x => x.importedAt && x.importedAt >= periodStart.value).length
  return kindSub(todayAddList.value) + (imp ? ` · 含导入${imp}` : '')
})
const todayDelSub = computed(() => kindSub(todayDelList.value))

// ---- 链接打开（WRR 抽屉复用；第卅二轮 REQ-010 统一打开通道） ----
function openResLink(r: ResourceCard) {
  recordResourceOpen(d.value, r)
  store.persistHot()
  const url = toOpenableUrl(r.linkType, r.link)
  if (url) openExternalLink(url)
}

// ---- O23 未归档任务：第卌四轮 T-01 双重有效性校验（bug 根因修复） ----
// 旧判定只看 !t.metricId——悬挂引用（指标已被删/导入残留）被假归档，3/10 实际应 10/10。
// 新判定：项目存在 + 指标存在于该项目之下，二者缺一或失效 → 未归档，并给出原因徽标。
const projectById = computed(() => {
  const m = new Map<string, { id: string; name: string; metrics: { id: string }[] }>()
  for (const dir of d.value.compass.directions) for (const p of dir.projects) m.set(p.id, p)
  return m
})
function taskArchiveIssue(t: { projectId?: string; metricId?: string }): string {
  if (!t.projectId) return '未挂项目'
  const proj = projectById.value.get(t.projectId)
  if (!proj) return '⚠ 项目失效'
  if (!t.metricId) return '未挂指标'
  if (!proj.metrics.some(mt => mt.id === t.metricId)) return '⚠ 指标失效'
  return ''
}
const unarchivedTasks = computed(() =>
  d.value.tasks.filter(t => !t.deletedAt && taskArchiveIssue(t) !== '')
)
// R43-3 未归档任务 N/M 分母：全部未删除任务数（含已归档）
const totalTasks = computed(() => d.value.tasks.filter(t => !t.deletedAt).length)
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
  <ModuleCard title="方向状态" en="NORTH STAR">
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
      <span class="ns-name">方向状态</span>
      <span class="ns-en">NORTH STAR</span>
    </template>

    <template #actions>
      <div class="period-switch">
        <button v-for="p in (['day','week','all'] as const)" :key="p"
          class="period-btn" :class="{active: period === p}" @click="period = p">
          {{ p === 'day' ? '日' : p === 'week' ? '周' : '累计' }}
        </button>
      </div>
    </template>

    <div class="ns-body">
      <div class="ns-matrix">
        <div class="ns-card top" @click="openDrawer('dhi')">
          <div class="ns-label">🧭 方向状态 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ metrics.dhi.goals }} 战略目标</div>
          <div class="ns-sub">{{ metrics.dhi.pushing }} 项目推进中</div>
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
        <div class="ns-card bottom" @click="openDrawer('today-add')">
          <div class="ns-label">📈 新增卡片 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ todayAddList.length }}</div>
          <div class="ns-sub">{{ todayAddSub }} · {{ periodLabel }}</div>
        </div>
        <div class="ns-card bottom" @click="openDrawer('today-del')">
          <div class="ns-label">📉 删除卡片 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ todayDelList.length }}</div>
          <div class="ns-sub">{{ todayDelSub }} · {{ periodLabel }}</div>
        </div>
        <div class="ns-card bottom" @click="openDrawer('tasks')">
          <div class="ns-label">📥 未归档任务 <span class="ns-hint">↗</span></div>
          <div class="ns-value">{{ unarchivedTasks.length }}/{{ totalTasks }}</div>
          <div class="ns-sub">未挂指标 · 不分期</div>
        </div>
      </div>
    </div>

    <!-- 六指标下钻抽屉 -->
    <Drawer :open="drawerOpen" :title="drawerTitle" width="460px" @close="drawerOpen = false">
      <div class="nd-formula">📐 {{ drawerFormula }}</div>

      <!-- 战略目标 / 推进项目 -->
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
          <div v-if="!wrrTop.length" class="nd-empty">还没有资源被打开过——去资源台双击卡片或搜索打开</div>
        </div>
      </template>

      <!-- 第卌四轮 T-02：今日新增明细（R48-B2：导入卡带 ⇪ 徽标，双口径可辨） -->
      <template v-else-if="drawerType === 'today-add'">
        <div class="dhi-list">
          <div v-for="x in todayAddList" :key="x.kind + x.id" class="nd-item">
            <div class="nd-name text">{{ kindIcon(x.kind) }} {{ x.title }}<span v-if="x.importedAt && x.importedAt >= periodStart" class="ns-imp-badge" title="本次导入 · 继承原创建时间">⇪ 导入</span></div>
            <div class="nd-meta">{{ fmtStamp(x.importedAt && x.importedAt >= periodStart ? x.importedAt : x.createdAt) }}</div>
          </div>
          <div v-if="!todayAddList.length" class="nd-empty">{{ periodLabel }}还没有新增卡片——去采集一张，这里立刻 +1</div>
        </div>
        <div class="nd-tip">实时派生自卡片 createdAt · 导入卡带 ⇪ 徽标（继承原创建时间）</div>
      </template>

      <!-- 第卌四轮 T-02：今日删除明细 -->
      <template v-else-if="drawerType === 'today-del'">
        <div class="dhi-list">
          <div v-for="x in todayDelList" :key="x.kind + x.id" class="nd-item">
            <div class="nd-name text">{{ kindIcon(x.kind) }} {{ x.title }}</div>
            <div class="nd-meta">{{ fmtStamp(x.deletedAt) }}</div>
          </div>
          <div v-if="!todayDelList.length" class="nd-empty">{{ periodLabel }}没有删除卡片</div>
        </div>
        <div class="nd-tip">软删除可在 回收站 恢复 · 永久删除会记入操作日志</div>
      </template>

      <!-- O23 未归档任务：级联归档（关联成功后即时从清单消失） -->
      <template v-else>
        <div class="dhi-list">
          <div v-for="t in unarchivedTasks" :key="t.id" class="nd-task-row">
            <div class="nd-task-head">
              <div class="nd-name text">{{ t.title }}</div>
              <div class="nd-tag warn">{{ taskArchiveIssue(t) }}</div>
            </div>
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
.ns-name { font-size: var(--fs-title); font-weight: 600; color: var(--text); letter-spacing: .3px; }
.ns-en { font-size: var(--fs-micro); color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; margin-left: 2px; }

.period-switch { display: flex; gap: 2px; background: var(--surface-3); border-radius: 8px; padding: 3px; }
.period-btn { padding: 4px 12px; border-radius: 6px; border: none; background: transparent; font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; font-family: inherit; font-weight: 500; transition: all var(--dur); }
.period-btn:hover { color: var(--text-2); }
.period-btn.active { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }

.ns-body { flex: 1; display: flex; flex-direction: column; }
/* 第卅五轮 REQ-033：2×3 指标网格撑满卡片高度，与左侧主航线下边缘对齐（去掉状态条后无冗余留白） */
.ns-matrix { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-auto-rows: 1fr; gap: 10px; flex: 1; }
.ns-card { border-radius: var(--radius-xs); padding: 12px 14px; cursor: pointer; transition: all var(--dur); border: 1px solid transparent; display: flex; flex-direction: column; justify-content: center; }
.ns-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.ns-card.top { background: var(--accent-light); }
.ns-card.bottom { background: var(--surface-3); }
.ns-label { font-size: var(--fs-caption); color: var(--text-2); margin-bottom: 4px; display: flex; align-items: center; }
.ns-hint { margin-left: auto; font-size: var(--fs-tiny); opacity: 0; transition: opacity var(--dur); color: var(--accent); }
.ns-card:hover .ns-hint { opacity: 1; }
.ns-value { font-size: 20px; font-weight: 600; color: var(--text); line-height: 1.2; letter-spacing: -.2px; font-variant-numeric: tabular-nums; }
.ns-card.top .ns-value { color: var(--accent); }
.ns-sub { font-size: var(--fs-tiny); color: var(--text-3); margin-top: 3px; }

/* 下钻抽屉 */
.nd-formula { font-size: var(--fs-sub); color: var(--accent-ink); background: var(--accent-light); border-radius: 8px; padding: 9px 12px; line-height: 1.6; margin-bottom: 14px; }
.dhi-list .nd-item { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 8px; display: flex; align-items: center; gap: 10px; background: var(--surface); }
.nd-item.clickable { cursor: pointer; }
.nd-item.clickable:hover { border-color: var(--accent); background: var(--accent-light); }
.nd-name { font-size: var(--fs-body); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nd-name.text { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.nd-meta { font-size: var(--fs-caption); color: var(--text-3); white-space: nowrap; }
.nd-tag.warn { font-size: var(--fs-tiny); color: var(--tag-warn-text); background: var(--tag-warn-bg); padding: 2px 8px; border-radius: 99px; font-weight: 500; }
.nd-progress { width: 80px; height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; flex-shrink: 0; }
.nd-bar { height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s; }
.nd-item.stagnant { border-color: var(--danger); }
.nd-edit-hint { font-size: var(--fs-sub); color: var(--text-3); cursor: pointer; flex-shrink: 0; }
.nd-edit-hint:hover { color: var(--accent); }
.nd-empty { text-align: center; padding: 32px; color: var(--text-3); font-size: var(--fs-body); }
.nd-tip { margin-top: 12px; font-size: var(--fs-caption); color: var(--text-3); text-align: center; }
/* R48-B2：导入卡徽标（双口径可辨） */
.ns-imp-badge { display: inline-block; margin-left: 6px; font-size: var(--fs-micro); font-weight: 600; padding: 0 6px; border-radius: 99px; background: var(--accent-light); color: var(--accent-ink); vertical-align: 1px; }

.nd-stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.nd-stat { background: var(--surface-2); border-radius: var(--radius-xs); padding: 12px; text-align: center; }
.nd-stat b { display: block; font-size: 18px; color: var(--accent); }
.nd-stat span { font-size: var(--fs-caption); color: var(--text-3); }

.nd-group { margin-bottom: 16px; }
.nd-group-name { font-size: var(--fs-sub); font-weight: 700; color: var(--text-2); margin-bottom: 6px; }
.nd-drag { color: var(--text-4); font-size: var(--fs-caption); cursor: grab; flex-shrink: 0; }
.nd-input { flex: 1; min-width: 0; border: 1px solid transparent; background: transparent; outline: none; font-size: var(--fs-body); color: var(--text); font-family: inherit; border-radius: 5px; padding: 3px 6px; margin: -3px -6px; }
.nd-input:focus { border-color: var(--accent); background: var(--surface); }
.nd-edit { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.nd-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
.nd-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: var(--fs-caption); cursor: pointer; font-family: inherit; }
.nd-btn.ghost { background: var(--surface); border-color: var(--border); color: var(--text-2); }
.nd-task-row { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); margin-bottom: 8px; background: var(--surface); }
.nd-task-head { display: flex; align-items: center; gap: 8px; }
.nd-task-head .nd-name { flex: 1; }
.nd-task-links { display: flex; gap: 6px; margin-top: 8px; }
.nd-select { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: var(--fs-caption); color: var(--text-2); background: var(--surface); outline: none; font-family: inherit; cursor: pointer; }
.nd-select:focus { border-color: var(--accent); }
.nd-select:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }

/* 第卌四轮 T-02：模块分组/链接卡片下钻 UI 已撤卡（wsPopup/nd-ws/nd-flat/nw-* 死样式全清），全景下钻由设置页「策展台全景」承接 */

/* 第卌一轮：卡片详情抽屉 */
.nr-title { font-size: var(--fs-title); font-weight: 600; color: var(--text); line-height: 1.5; margin-bottom: 14px; }
.nr-row { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-sub); }
.nr-k { width: 40px; flex-shrink: 0; color: var(--text-4); }
.nr-v { flex: 1; min-width: 0; color: var(--text-2); word-break: break-all; line-height: 1.6; }
.nr-v.link { color: var(--accent); }
.nr-actions { display: flex; gap: 8px; margin-top: 16px; }
</style>
