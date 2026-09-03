<script setup lang="ts">
// 第卌五轮 T-03/T-04：今日行动页重构
// - 全域任务管理整体迁出 → components/compass/TaskManagerPanel.vue（资源罗盘 · 我的好奇心 Tab）
// - 任务详情抽屉 → 共享组件 TaskDetailDrawer.vue（双击三件事卡打开）
// - 今日三件事新交互：呼吸灯引导（原有）/ 单击联动下方项目策展 / 双击任务详情 / 可删除后重选
// - 今日三件事下方空白区 → 「项目策展」面板：左列项目名+愿景/使命只读+战略目标+四项大数值；右列按成功指标分组任务
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useCompass } from '../stores/compass'
import { uid } from '@/shared/utils'
import { visibleFields } from '@/shared/utils/fields'
import type { TaskCard, Project, FocusSlot, Direction } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import Icon from '@/shared/components/Icon.vue'
import AssetBadge from '@/shared/components/AssetBadge.vue'
import TaskDetailDrawer from '../components/compass/TaskDetailDrawer.vue'

const router = useRouter()
const store = useAppStore()
const { d, visionText, missionText, allProjects, projectProgress } = useCompass()

const drawerRef = ref<InstanceType<typeof TaskDetailDrawer> | null>(null)

// ---- 日期工具 ----
function formatDate(dt: Date): string {
  const week = ['周日','周一','周二','周三','周四','周五','周六']
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${week[dt.getDay()]}`
}
function dateStr(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}

// ---- 主攻项目速览条 ----
const focusProjects = computed(() => allProjects().filter(p => p.isFocused).slice(0, 2))
function projectDirName(projId: string): string {
  for (const dir of d.value.compass.directions) {
    if (dir.projects.some(p => p.id === projId)) return dir.name
  }
  return '未分类'
}
function gotoProjectCuration(projId: string) {
  router.push({ path: '/compass/projects', query: { p: projId } })
}

// ---- 今日三件事 ----
const todayDate = ref(new Date())
function shiftDate(n: number) { todayDate.value = new Date(todayDate.value.getTime() + n * 86400_000) }
const todayFocusList = computed<FocusSlot[]>(() => {
  const key = dateStr(todayDate.value)
  return (d.value.dailyFocus?.[key] || []).slice(0, 3)
})
function todayTaskForSlot(slot: FocusSlot): TaskCard | null {
  if (slot.sourceType === 'task' && slot.sourceId) {
    return d.value.tasks.find(t => !t.deletedAt && t.id === slot.sourceId) || null
  }
  return null
}
/** 第卌五轮 T-04：三件事卡 → 选中索引（默认第一件事），联动下方项目策展 */
const focusSelIdx = ref(0)
const focusTasks = computed<(TaskCard | null)[]>(() => todayFocusList.value.map(s => todayTaskForSlot(s)))
const selTask = computed<TaskCard | null>(() => focusTasks.value[focusSelIdx.value] || focusTasks.value.find(t => !!t) || null)
function onFocusCardClick(idx: number) {
  focusSelIdx.value = idx
}

// 任务选取弹窗
const pickerOpen = ref(false)
const pickerSlot = ref(0)
const pickerSearch = ref('')
function openPicker(slot: number) {
  pickerSlot.value = Math.min(slot, 2)
  pickerSearch.value = ''
  pickerOpen.value = true
}
function selectTaskForSlot(task: TaskCard) {
  const key = dateStr(todayDate.value)
  if (!d.value.dailyFocus[key]) d.value.dailyFocus[key] = []
  const list = d.value.dailyFocus[key]
  const slot: FocusSlot = {
    id: uid('focus'),
    sourceType: 'task',
    sourceId: task.id,
    text: task.title,
    done: task.status === 'done',
    doneAt: task.completedAt
  }
  if (list[pickerSlot.value]) list[pickerSlot.value] = slot
  else list.push(slot)
  store.persist()
  pickerOpen.value = false
  focusSelIdx.value = Math.min(pickerSlot.value, 2)
  showToast('✓ 已添加到今日三件事')
}
const pickerCandidates = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  return d.value.tasks
    .filter(t => !t.deletedAt)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) // 第十七轮：置顶优先
    .slice(0, 30)
})
/** B25：已完成或已选入今日三件事的任务置灰不可选 */
const pickedIds = computed(() => new Set(todayFocusList.value.map(s => s.sourceId)))
function pickerDisabled(t: TaskCard): boolean {
  return t.status === 'done' || pickedIds.value.has(t.id)
}
function selectTaskGuarded(t: TaskCard) {
  if (pickerDisabled(t)) { showToast(t.status === 'done' ? '该任务已完成' : '该任务已选入今日三件事'); return }
  selectTaskForSlot(t)
}
function removeTodaySlot(idx: number) {
  const key = dateStr(todayDate.value)
  if (d.value.dailyFocus[key]) {
    d.value.dailyFocus[key].splice(idx, 1)
    store.persist()
  }
}
function copyYesterday() {
  const today = dateStr(todayDate.value)
  const yesterday = dateStr(new Date(todayDate.value.getTime() - 86400_000))
  const yesterdayList = d.value.dailyFocus[yesterday]
  if (!yesterdayList || !yesterdayList.length) {
    showToast('昨日无三件事记录')
    return
  }
  d.value.dailyFocus[today] = JSON.parse(JSON.stringify(yesterdayList))
  d.value.dailyFocus[today].forEach(s => { s.done = false; s.doneAt = undefined })
  store.persist()
  showToast('✓ 已复制昨日三件事')
}
// ---- 第十七轮：导出弹窗（自定义时间范围 + 6 字段 CSV） ----
const exportOpen = ref(false)
const exportFrom = ref(dateStr(new Date()))
const exportTo = ref(dateStr(new Date()))
function openExportModal() {
  exportFrom.value = dateStr(new Date())
  exportTo.value = dateStr(new Date())
  exportOpen.value = true
}
function statusLabelOf(t?: TaskCard | null, done?: boolean): string {
  if (t) return t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待开始'
  return done ? '已完成' : '未完成'
}
const exportBusy = ref(false)
function doExport() {
  const from = exportFrom.value
  const to = exportTo.value
  if (!from || !to) { showToast('请选择起止日期'); return }
  if (from > to) { showToast('开始日期不能晚于结束日期'); return }
  const rows: string[][] = []
  for (const key of Object.keys(d.value.dailyFocus || {}).sort()) {
    if (key < from || key > to) continue
    for (const slot of d.value.dailyFocus[key] || []) {
      const t = slot.sourceType === 'task' && slot.sourceId
        ? d.value.tasks.find(x => x.id === slot.sourceId && !x.deletedAt) : null
      const proj = t ? projectName(t.projectId) : ''
      const met = t && t.metricId ? metricName(t.metricId) : ''
      rows.push([
        slot.text || (t?.title ?? ''),
        proj,
        proj && met !== '未关联' ? `${proj} / ${met}` : '',
        statusLabelOf(t, slot.done),
        key,
        t?.createdAt ? new Date(t.createdAt).toLocaleString('zh-CN') : '',
        t?.pinned ? '是' : '',
        t?.starred ? '是' : ''
      ])
    }
  }
  if (!rows.length) { showToast('所选范围内没有三件事记录'); return }
  exportBusy.value = true
  const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"'
  const csv = '任务内容,所属项目,项目→成功指标,任务状态,安排时间,创建时间,置顶,星标\n'
    + rows.map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `任务导出_${from}_${to}.csv`
  a.click(); URL.revokeObjectURL(url)
  exportOpen.value = false
  exportBusy.value = false
  showToast(`✓ 已导出 ${rows.length} 条记录`)
}
function toggleTodayDone(slot: FocusSlot) {
  slot.done = !slot.done
  slot.doneAt = slot.done ? Date.now() : undefined
  if (slot.sourceType === 'task' && slot.sourceId) {
    const t = d.value.tasks.find(x => x.id === slot.sourceId)
    if (t) {
      t.status = slot.done ? 'done' : 'todo'
      t.completedAt = slot.doneAt
      t.updatedAt = Date.now()
    }
  }
  store.persist()
}

// ---- 公共名称工具 ----
function projectName(projId?: string): string {
  if (!projId) return '未关联'
  return allProjects().find(x => x.id === projId)?.name || '未关联'
}
function metricName(metricId?: string): string {
  if (!metricId) return '未关联'
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      const m = proj.metrics.find(x => x.id === metricId)
      if (m) return m.title
    }
  }
  return '未关联'
}

// ---- R40 REQ-051：附件字段可见性（三件事卡正面徽章显隐） ----
const tFields = computed(() => visibleFields(d.value.fieldConfig, 'task'))
const taskAssetsOn = computed(() => tFields.value.some(f => f.key === 'assets'))

// ================= 项目策展面板（第卌五轮 T-04） =================
function goalOf(p: Project): Direction | null {
  for (const dir of d.value.compass.directions) {
    if (dir.projects.some(x => x.id === p.id)) return dir
  }
  return null
}
const curProject = computed<Project | null>(() => {
  const pid = selTask.value?.projectId
  if (!pid) return null
  return allProjects().find(p => p.id === pid) || null
})
const projMetrics = computed(() => curProject.value?.metrics || [])
const projTasks = computed(() =>
  curProject.value ? d.value.tasks.filter(t => !t.deletedAt && t.projectId === curProject.value!.id) : []
)
const projDoneCount = computed(() => projTasks.value.filter(t => t.status === 'done').length)
const projDoingCount = computed(() => projTasks.value.filter(t => t.status === 'doing').length)
/** 右列：按成功指标分组（+ 未归类），空指标组隐藏 */
const metricGroups = computed(() => {
  const p = curProject.value
  if (!p) return []
  const groups = p.metrics.map(m => ({ key: m.id, title: m.title, tasks: projTasks.value.filter(t => t.metricId === m.id) }))
  const mids = new Set(p.metrics.map(m => m.id))
  const orphan = projTasks.value.filter(t => !t.metricId || !mids.has(t.metricId))
  if (orphan.length) groups.push({ key: '__none__', title: '未归类任务', tasks: orphan })
  return groups
})
const dirTermLabel = (dir: Direction | null) =>
  dir?.term === 'long' ? '远期' : dir?.term === 'short' ? '近期' : dir?.term === 'mid' ? '中期' : ''
function syncMetricTaskIds(taskId: string, oldMetricId?: string, newMetricId?: string) {
  for (const dir of d.value.compass.directions) {
    for (const proj of dir.projects) {
      for (const m of proj.metrics) {
        if (oldMetricId && m.id === oldMetricId) m.taskIds = m.taskIds.filter(x => x !== taskId)
        if (newMetricId && m.id === newMetricId && !m.taskIds.includes(taskId)) m.taskIds.push(taskId)
      }
    }
  }
}
/** 新建任务：预设项目（可预设指标），创建后直接打开详情抽屉 */
function createProjectTask(metricId?: string) {
  const p = curProject.value
  if (!p) { showToast('请先在今日三件事选择已关联项目的任务'); return }
  const task: TaskCard = {
    id: uid('tk'),
    kind: 'task',
    title: '新任务',
    status: 'todo',
    priority: 'medium',
    projectId: p.id,
    metricId,
    mountedResourceIds: [],
    mountedCuriosityIds: [],
    customFields: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  if (metricId) syncMetricTaskIds(task.id, undefined, metricId)
  d.value.tasks.unshift(task)
  store.persist()
  drawerRef.value?.open(task)
  showToast('✓ 新任务已创建')
  nextTick(() => {
    const el = document.querySelector('.ts-title') as HTMLTextAreaElement | null
    if (el) { el.focus(); el.select() }
  })
}
/** 关联任务：从任务库选一个未属于该项目的任务挂进来（跨项目必清原指标） */
const linkPickerOpen = ref(false)
const linkSearch = ref('')
function openLinkPicker() {
  if (!curProject.value) { showToast('请先在今日三件事选择已关联项目的任务'); return }
  linkSearch.value = ''
  linkPickerOpen.value = true
}
const linkCandidates = computed(() => {
  const q = linkSearch.value.trim().toLowerCase()
  const pid = curProject.value?.id
  return d.value.tasks
    .filter(t => !t.deletedAt && t.projectId !== pid)
    .filter(t => !q || t.title.toLowerCase().includes(q))
    .slice(0, 30)
})
function linkTaskToProject(t: TaskCard) {
  const p = curProject.value
  if (!p) return
  const oldMetric = t.metricId
  t.projectId = p.id
  t.metricId = undefined
  syncMetricTaskIds(t.id, oldMetric, undefined)
  t.updatedAt = Date.now()
  store.persist()
  linkPickerOpen.value = false
  showToast('✓ 已关联到「' + p.name + '」（原指标已清空）')
}

// ---- B9：Ctrl+←/→ 切换三件事日期（非输入焦点时） ----
function onDateKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (el?.isContentEditable) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); shiftDate(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); shiftDate(1) }
}
onMounted(() => { document.addEventListener('keydown', onDateKey, true) })
onUnmounted(() => { document.removeEventListener('keydown', onDateKey, true) })
</script>

<template>
  <div class="actions-page">
    <div class="page-head">
      <div class="crumb">知源引擎 <span class="sep">/</span> <b>今日行动</b> · 让轨迹被自己看见</div>
      <div class="spacer" />
      <div class="hint-chip">今日三件事呼吸灯 · 单击联动项目 · 双击看详情</div>
    </div>

    <!-- 主攻项目速览条 -->
    <div class="focus-strip">
      <span class="flab">🎯 主攻项目</span>
      <div v-for="proj in focusProjects" :key="proj.id" class="focus-chip" @click="gotoProjectCuration(proj.id)">
        <span class="fcn">{{ proj.name }}</span>
        <span class="progress bar"><i :style="{width: projectProgress(proj).pct + '%'}" /></span>
        <span class="fp">{{ projectProgress(proj).pct }}%</span>
        <span class="go">进入策展 →</span>
      </div>
      <div v-if="!focusProjects.length" class="focus-empty">暂无主攻项目，去方向树标记</div>
      <span class="all-link" @click="router.push('/compass/projects')">全部项目 → 项目策展</span>
    </div>

    <!-- 今日三件事 -->
    <div class="card module">
      <div class="card-head">
        <span class="ic"><Icon name="flame" :size="17" /></span><span class="nm">今日三件事</span><span class="en">TODAY'S FOCUS</span><span class="ds">锁定今日最重要的 3 件事</span>
        <div class="date-nav">
          <div class="dn" @click="shiftDate(-1)">‹</div>
          <div class="dd">{{ formatDate(todayDate) }}</div>
          <div class="dn" @click="shiftDate(1)">›</div>
        </div>
      </div>
      <div class="today-body">
        <div class="today-toolbar">
          <button class="mini-btn" @click="openPicker(todayFocusList.length)"><Icon name="clipboard" :size="13" />从库选取</button>
          <button class="mini-btn" @click="copyYesterday"><Icon name="copy" :size="13" />复制昨日</button>
          <button class="mini-btn" @click="openExportModal"><Icon name="download" :size="13" />导出</button>
        </div>
        <div class="today-cards">
          <template v-for="(slot, idx) in todayFocusList" :key="idx">
            <div v-if="todayTaskForSlot(slot)" class="today-card" :class="{done: slot.done, sel: focusSelIdx===idx}"
              @click="onFocusCardClick(idx)" @dblclick="drawerRef?.open(todayTaskForSlot(slot)!)">
              <div class="tc-num">{{ String(idx+1).padStart(2,'0') }}</div>
              <div class="tc-row">
                <div class="tc-check" :class="{done: slot.done}" @click.stop="toggleTodayDone(slot)">{{ slot.done?'✓':'' }}</div>
                <div class="tc-title">{{ slot.text }}</div>
              </div>
              <div class="tc-meta">
                <span class="tag accent">📦 {{ projectName(todayTaskForSlot(slot)?.projectId) }}</span>
                <span class="tag warn">🎯 {{ metricName(todayTaskForSlot(slot)?.metricId) }}</span>
                <AssetBadge v-if="taskAssetsOn && todayTaskForSlot(slot)?.assets?.length" :assets="todayTaskForSlot(slot)!.assets" />
              </div>
              <div class="tc-remove" @click.stop="removeTodaySlot(idx)" title="移除">×</div>
            </div>
          </template>
          <div v-for="n in (3 - todayFocusList.length)" :key="'empty-'+n" class="today-card empty-card" @click="openPicker(todayFocusList.length)">
            <div class="tc-num">{{ String(todayFocusList.length + n).padStart(2,'0') }}</div>
            <div class="tc-title empty-t">＋ 从任务库选取</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 项目策展（第卌五轮 T-04）：呈现今日三件事所隶属的项目 -->
    <div class="card module curation">
      <div class="card-head">
        <span class="ic"><Icon name="target" :size="17" /></span><span class="nm">项目策展</span><span class="en">PROJECT SPOTLIGHT</span><span class="ds">当前任务隶属项目的全景速览 · 单击上方任务卡联动切换</span>
      </div>

      <div v-if="curProject" class="cur-body">
        <!-- 左列 -->
        <div class="cur-left">
          <div class="cur-proj-name">📦 {{ curProject.name }}</div>

          <div class="cur-vision-row">
            <div class="cur-mini" :title="visionText">
              <div class="cur-mini-lab">🔭 愿景 · Vision</div>
              <div class="cur-mini-txt">{{ visionText || '尚未设定愿景' }}</div>
            </div>
            <div class="cur-mini" :title="missionText">
              <div class="cur-mini-lab">💡 使命 · Mission</div>
              <div class="cur-mini-txt">{{ missionText || '尚未设定使命' }}</div>
            </div>
          </div>

          <div class="cur-goal">
            <div class="cur-goal-lab">🎯 战略目标 · STRATEGIC DIRECTION</div>
            <div class="cur-goal-name">{{ goalOf(curProject)?.name || '—' }}</div>
            <div class="cur-goal-meta">
              <span v-if="dirTermLabel(goalOf(curProject))" class="tag">{{ dirTermLabel(goalOf(curProject)) }}</span>
              <span class="cur-goal-pct">项目进度 {{ projectProgress(curProject).pct }}%</span>
              <span class="cur-goal-link" @click="gotoProjectCuration(curProject.id)">进入完整策展 ›</span>
            </div>
          </div>

          <div class="cur-stats">
            <div class="cur-stat"><div class="cs-num">{{ projMetrics.length }}</div><div class="cs-lab">成功指标</div></div>
            <div class="cur-stat"><div class="cs-num">{{ projTasks.length }}</div><div class="cs-lab">任务总数</div></div>
            <div class="cur-stat"><div class="cs-num ok">{{ projDoneCount }}</div><div class="cs-lab">已完成</div></div>
            <div class="cur-stat"><div class="cs-num warn">{{ projDoingCount }}</div><div class="cs-lab">进行中</div></div>
          </div>
        </div>

        <!-- 右列：按成功指标分组 -->
        <div class="cur-right">
          <div class="cur-right-head">
            <span class="crr-title">任务 · 按成功指标分组</span>
            <div class="crr-actions">
              <button class="mini-btn" @click="openLinkPicker">🔗 关联任务</button>
              <button class="mini-btn primary" @click="createProjectTask()"><span>＋</span>新建任务</button>
            </div>
          </div>
          <div class="cur-groups">
            <div v-for="grp in metricGroups" :key="grp.key" class="cur-group">
              <div class="cg-head">
                <span class="cg-name" :class="{none: grp.key==='__none__'}">{{ grp.key==='__none__' ? '🗂 ' + grp.title : '🎯 ' + grp.title }}</span>
                <span class="cg-count">{{ grp.tasks.length }}</span>
                <button class="cg-add" title="在此指标下新建任务" @click="createProjectTask(grp.key==='__none__' ? undefined : grp.key)">＋</button>
              </div>
              <div class="cg-tasks">
                <div v-for="t in grp.tasks" :key="t.id" class="cg-task" :class="{'is-done': t.status==='done'}" @dblclick="drawerRef?.open(t)" @click="drawerRef?.open(t)">
                  <span class="cg-dot" :class="'st-'+t.status">{{ t.status==='done'?'✓':t.status==='doing'?'◐':'○' }}</span>
                  <span class="cg-t">{{ t.title }}</span>
                  <span class="cg-st">{{ t.status==='done'?'已完成':t.status==='doing'?'进行中':'待开始' }}</span>
                </div>
                <div v-if="!grp.tasks.length" class="cg-empty">暂无任务</div>
              </div>
            </div>
            <div v-if="!metricGroups.length" class="cg-empty" style="padding:24px">该项目还没有成功指标与任务——去方向树规划，或直接「新建任务」</div>
          </div>
        </div>
      </div>

      <div v-else class="cur-empty">
        <div class="ce-icon">🧭</div>
        <div class="ce-title">上方三件事尚未指向项目</div>
        <div class="ce-desc">单击任务卡联动项目；若任务还未关联项目，可在任务详情（双击打开）中选择所属项目</div>
        <button class="mini-btn" @click="router.push('/compass/projects')">前往项目策展</button>
      </div>
    </div>

    <!-- ===== 任务选取弹窗 ===== -->
    <Transition name="fade">
      <div v-if="pickerOpen" class="overlay" @click="pickerOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="pickerOpen" class="picker-modal">
        <div class="pm-head">
          <span>📋 从任务库选取</span>
          <div class="pm-close" @click="pickerOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="pickerSearch" placeholder="搜索任务..."></div>
          <div v-for="task in pickerCandidates" :key="task.id" class="picker-item"
            :class="{disabled: pickerDisabled(task)}" @click="selectTaskGuarded(task)">
            <div class="pi-check">{{ pickerDisabled(task) ? '—' : '＋' }}</div>
            <div class="pi-info">
              <div class="pi-title">{{ task.title }}</div>
              <div class="pi-meta">
                <span class="tag accent">{{ projectName(task.projectId) }}</span> <AssetBadge v-if="taskAssetsOn && task.assets?.length" :assets="task.assets" class="kc-assets" />
                <span class="tag" :class="{ok: task.status==='done'}">{{ task.status==='done'?'✅ 已完成':task.status==='doing'?'◐ 进行中':'○ 待开始' }}</span>
                <span v-if="pickedIds.has(task.id)" class="tag">已选入</span>
              </div>
            </div>
          </div>
          <div v-if="!pickerCandidates.length" class="list-empty">暂无任务</div>
        </div>
      </div>
    </Transition>

    <!-- ===== 关联任务弹窗（项目策展） ===== -->
    <Transition name="fade">
      <div v-if="linkPickerOpen" class="overlay" @click="linkPickerOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="linkPickerOpen" class="picker-modal">
        <div class="pm-head">
          <span>🔗 关联任务到「{{ curProject?.name }}」</span>
          <div class="pm-close" @click="linkPickerOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="search-box" style="margin:0 0 12px"><span>🔍</span><input v-model="linkSearch" placeholder="搜索任务..."></div>
          <div v-for="task in linkCandidates" :key="task.id" class="picker-item" @click="linkTaskToProject(task)">
            <div class="pi-check">＋</div>
            <div class="pi-info">
              <div class="pi-title">{{ task.title }}</div>
              <div class="pi-meta">
                <span class="tag accent">{{ projectName(task.projectId) }}</span>
                <span class="tag" :class="{ok: task.status==='done'}">{{ task.status==='done'?'✅ 已完成':task.status==='doing'?'◐ 进行中':'○ 待开始' }}</span>
              </div>
            </div>
          </div>
          <div v-if="!linkCandidates.length" class="list-empty">没有可关联的任务（均属本项目或库为空）</div>
        </div>
      </div>
    </Transition>

    <!-- ===== 第十七轮：三件事导出弹窗（时间范围） ===== -->
    <Transition name="fade">
      <div v-if="exportOpen" class="overlay" @click="exportOpen=false" />
    </Transition>
    <Transition name="modal">
      <div v-if="exportOpen" class="picker-modal" style="width:400px">
        <div class="pm-head">
          <span>⬇ 导出三件事任务（CSV）</span>
          <div class="pm-close" @click="exportOpen=false">×</div>
        </div>
        <div class="pm-body">
          <div class="ts-label-pm">时间范围（按三件事安排日期）</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="date" v-model="exportFrom" class="ts-select-pm" style="flex:1">
            <span style="color:var(--text-3)">→</span>
            <input type="date" v-model="exportTo" class="ts-select-pm" style="flex:1">
          </div>
          <div class="ce-desc" style="margin-top:10px">导出字段：任务内容 / 所属项目 / 项目→成功指标 / 任务状态 / 安排时间 / 创建时间</div>
        </div>
        <div class="modal-footer-row" style="display:flex;gap:8px;padding:14px 20px;border-top:1px solid var(--border);justify-content:flex-end">
          <button class="mini-btn" @click="exportOpen=false">取消</button>
          <button class="mini-btn primary" :disabled="exportBusy" @click="doExport">{{ exportBusy ? "导出中…" : "✓ 导出 CSV" }}</button>
        </div>
      </div>
    </Transition>

    <!-- 任务详情抽屉（共享组件） -->
    <TaskDetailDrawer ref="drawerRef" />
  </div>
</template>

<style scoped>
.actions-page { max-width: 1180px; margin: 0 auto; }
.page-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.page-head .crumb { font-size: 12.5px; color: var(--text-2); }
.page-head .crumb b { color: var(--text); font-weight: 600; }
.page-head .crumb .sep { color: var(--text-4); margin: 0 6px; }
.page-head .spacer { flex: 1; }
.hint-chip { font-size: 10.5px; color: var(--text-3); background: var(--surface); border: 1px dashed var(--border-strong); padding: 3px 10px; border-radius: 99px; }

.card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid rgba(0,0,0,.025); }
.card-head { display: flex; align-items: center; gap: 8px; padding: 16px 20px 10px; flex-wrap: wrap; }
.card-head .ic { font-size: 16px; color: var(--accent); display: flex; align-items: center; }
.card-head .nm { font-size: 15px; font-weight: 600; letter-spacing: .3px; }
.card-head .en { font-size: 9px; color: var(--text-3); letter-spacing: 1.4px; text-transform: uppercase; }
.card-head .ds { font-size: 11.5px; color: var(--text-3); margin-left: 6px; flex: 1; }
.module { margin-bottom: 18px; }
.mini-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px; font-size: 11.5px; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-family: inherit; transition: all .15s; user-select: none; }
.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
.mini-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.mini-btn.primary:hover { background: var(--accent-hover); }
.tag { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--tag-neutral-bg); color: var(--tag-neutral-text); font-weight: 500; white-space: nowrap; }
.tag.accent { background: var(--accent-light); color: var(--accent); }
.tag.warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }
.tag.ok { background: var(--tag-ok-bg); color: var(--tag-ok-text); }
.kc-assets { margin-left: 2px; }
.progress { height: 5px; background: var(--surface-3); border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; }
.progress > i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s ease; }

/* 主攻速览条 */
.focus-strip { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 13px 18px; margin-bottom: 18px; flex-wrap: wrap; }
.focus-strip .flab { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: .5px; display: flex; align-items: center; gap: 5px; }
.focus-chip { display: flex; align-items: center; gap: 9px; background: var(--accent-light); border-radius: 8px; padding: 7px 13px; cursor: pointer; transition: all .15s; }
.focus-chip:hover { background: var(--accent); }
.focus-chip .fcn { font-size: 12.5px; font-weight: 600; color: var(--accent); }
.focus-chip .bar { width: 64px; }
.focus-chip .fp { font-size: 11px; font-weight: 700; color: var(--accent); }
.focus-chip .go { font-size: 10.5px; color: var(--text-3); }
.focus-strip .all-link { margin-left: auto; font-size: 11.5px; color: var(--accent); cursor: pointer; font-weight: 500; }
.focus-strip .all-link:hover { text-decoration: underline; }
.focus-empty { font-size: 11.5px; color: var(--text-3); }

/* 今日三件事 */
.date-nav { display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.date-nav .dn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); font-size: 14px; }
.date-nav .dn:hover { background: var(--surface-3); }
.date-nav .dd { padding: 0 12px; font-size: 12px; font-weight: 500; border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-width: 128px; text-align: center; }
.today-body { padding: 0 20px 16px; }
.today-toolbar { display: flex; gap: 6px; margin-bottom: 10px; }
.today-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
/* R43-3 紧凑化 + 呼吸灯视觉引导；R46-OPT 复选框并入标题行 + 呼吸灯增强 */
.today-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px 11px; cursor: pointer; transition: all .15s ease; position: relative; display: flex; flex-direction: column; }
.today-card:not(.empty-card) { animation: tcBreathe 4s ease-in-out infinite; }
@keyframes tcBreathe {
  0%,100% { box-shadow: 0 0 0 0 transparent; border-color: var(--border); }
  50% { box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 18%, transparent); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
}
.today-card:hover { border-color: var(--border-strong); background: var(--surface); }
/* T-04/R46：选中态停止呼吸改常亮（避免干扰），accent 边框 + 浅底 */
.today-card.sel { border-color: var(--accent); background: var(--accent-light); animation: none; box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 22%, transparent); }
.today-card.done { opacity: .6; animation: none; }
.today-card.done .tc-title { text-decoration: line-through; color: var(--text-3); }
.today-card.empty-card { opacity: .55; border-style: dashed; background: transparent; align-items: center; justify-content: center; }
.today-card.empty-card:hover { opacity: .9; border-color: var(--accent); color: var(--accent); }
.tc-num { position: absolute; top: 10px; right: 12px; font-size: 11px; color: var(--text-3); font-weight: 600; }
.tc-row { display: flex; align-items: flex-start; gap: 8px; }
.tc-check { width: 16px; height: 16px; border-radius: 5px; border: 2px solid var(--border-strong); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10px; color: #fff; background: var(--surface); margin-top: 2px; }
.tc-check.done { background: var(--success); border-color: var(--success); }
.tc-title { font-size: 14px; font-weight: 600; line-height: 1.4; flex: 1; }
.tc-title.empty-t { color: var(--text-3); font-weight: 400; }
.tc-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.tc-meta .tag { font-size: 11px; padding: 1px 7px; }
/* R46-OPT：移除 × 移到编号左侧（右上区域），hover 出现，不再与复选框同角 */
.tc-remove { position: absolute; top: 7px; right: 32px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 13px; color: var(--text-3); cursor: pointer; opacity: 0; transition: all .15s; }
.today-card:hover .tc-remove { opacity: 1; }
.tc-remove:hover { background: var(--danger); color: #fff; }

/* ================= 项目策展面板（T-04） ================= */
.curation .cur-body { display: grid; grid-template-columns: 380px 1fr; gap: 18px; padding: 0 20px 18px; align-items: start; }
.cur-proj-name { font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: .3px; margin-bottom: 10px; }
.cur-vision-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.cur-mini { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 11px; }
.cur-mini-lab { font-size: 9.5px; font-weight: 700; color: var(--text-3); letter-spacing: .8px; margin-bottom: 3px; }
.cur-mini-txt { font-size: 11px; color: var(--text-2); line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cur-goal { background: var(--accent-light); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 12px; }
.cur-goal-lab { font-size: 9.5px; font-weight: 700; color: var(--accent); letter-spacing: 1px; margin-bottom: 4px; }
.cur-goal-name { font-size: 17px; font-weight: 700; color: var(--accent); line-height: 1.4; }
.cur-goal-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.cur-goal-pct { font-size: 11px; color: var(--text-2); }
.cur-goal-link { font-size: 11px; color: var(--accent); cursor: pointer; margin-left: auto; }
.cur-goal-link:hover { text-decoration: underline; }
.cur-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cur-stat { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 6px; text-align: center; }
.cs-num { font-size: 22px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.2; }
.cs-num.ok { color: var(--success); }
.cs-num.warn { color: var(--warning, #e67e22); }
.cs-lab { font-size: 10px; color: var(--text-3); margin-top: 2px; }

/* 右列：按成功指标分组 */
.cur-right { min-width: 0; }
.cur-right-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.crr-title { font-size: 12.5px; font-weight: 700; color: var(--text-2); }
.crr-actions { display: flex; gap: 6px; }
.cur-groups { display: flex; flex-direction: column; gap: 10px; }
.cur-group { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.cg-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface-3); }
.cg-name { font-size: 12px; font-weight: 700; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-name.none { color: var(--text-3); }
.cg-count { font-size: 10px; color: var(--text-3); background: var(--surface); padding: 1px 8px; border-radius: 99px; }
.cg-add { width: 20px; height: 20px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-2); font-size: 12px; cursor: pointer; line-height: 1; }
.cg-add:hover { border-color: var(--accent); color: var(--accent); }
.cg-tasks { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 4px; }
.cg-task { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 7px; cursor: pointer; transition: background .12s; }
.cg-task:hover { background: var(--surface); }
.cg-task.is-done .cg-t { text-decoration: line-through; color: var(--text-3); }
.cg-dot { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text-3); }
.cg-dot.st-doing { color: var(--tag-warn-text); border-color: var(--tag-warn-text); }
.cg-dot.st-done { background: var(--success); border-color: var(--success); color: #fff; }
.cg-t { font-size: 12.5px; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cg-st { font-size: 10px; color: var(--text-4); flex-shrink: 0; }
.cg-empty { font-size: 11px; color: var(--text-4); text-align: center; padding: 8px; }

/* 空态 */
.cur-empty { padding: 34px 20px 38px; text-align: center; }
.ce-icon { font-size: 30px; opacity: .45; margin-bottom: 6px; }
.ce-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
.ce-desc { font-size: 11.5px; color: var(--text-3); margin-bottom: 12px; line-height: 1.7; }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 200; }
.picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 480px; max-width: 92vw; max-height: 70vh; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 201; display: flex; flex-direction: column; overflow: hidden; }
.pm-head { padding: 15px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; font-size: 14px; font-weight: 600; }
.pm-head span:first-child { flex: 1; }
.pm-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; color: var(--text-3); font-size: 17px; }
.pm-close:hover { background: var(--surface-3); color: var(--text); }
.pm-body { flex: 1; overflow-y: auto; padding: 14px 20px; }
.picker-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-2); border-radius: 8px; margin-bottom: 6px; cursor: pointer; transition: all .1s; }
.picker-item:hover { background: var(--accent-light); }
.picker-item.disabled { opacity: .38; cursor: not-allowed; }
.picker-item.disabled:hover { background: var(--surface-2); }
.pi-check { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.pi-info { flex: 1; min-width: 0; }
.pi-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.pi-meta { display: flex; gap: 5px; flex-wrap: wrap; }
.search-box { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.search-box:focus-within { border-color: var(--accent); }
.search-box input { border: none; outline: none; font-size: 12px; width: 150px; background: transparent; color: var(--text); font-family: inherit; }
.list-empty { text-align: center; padding: 30px; font-size: 13px; color: var(--text-3); }
.ts-label-pm { font-size: 10.5px; font-weight: 700; color: var(--text-3); letter-spacing: .5px; margin-bottom: 7px; }
.ts-select-pm { width: 100%; padding: 9px 12px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--text); border: 1px solid transparent; outline: none; cursor: pointer; font-family: inherit; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.modal-enter-active, .modal-leave-active { transition: all .15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(.95); }
@media (max-width: 1080px) { .today-cards { grid-template-columns: 1fr; } .curation .cur-body { grid-template-columns: 1fr; } }
</style>
