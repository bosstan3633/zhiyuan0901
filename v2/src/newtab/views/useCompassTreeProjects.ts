import { ref, computed, nextTick, onMounted, onUnmounted, watch, defineAsyncComponent, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { uid } from '@/shared/utils'
import { taskMaturity, metricMaturity, projectMaturity, directionMaturity } from '@/shared/utils/maturity'
import type { Direction, Project, Metric, TaskCard, ID } from '@/shared/models'
import { showToast } from '@/shared/components/toast'
import CompassSpine from '../components/compass/CompassSpine.vue'
import type { ProjectMeta } from './compassMeta'
import CompassRiskModal, { type RiskProjectGroup } from '../components/compass/CompassRiskModal.vue'
import type { useCompassTree } from './useCompassTree'

export function useCompassTreeProjects(deps: Pick<ReturnType<typeof useCompassTree>, 'compassMeta' | 'findProject' | 'd' | 'layerOpen' | 'layerView' | 'activeLayer' | 'ensureTower' | 'projFoldOverride' | 'writeProjFold' | 'expandedMetrics' | 'viewMode' | 'dirFilter' | 'riskOnly' | 'router' | 'panoId' | 'openPano' | 'visionText' | 'missionText' | 'allProjects' | 'store'>): {
  layerRows5: ComputedRef<{ id: string; title: string; dirName: string; projName: string; projId: string; total: number; done: number; pct: number; orphan: boolean }[]>
  layerRows6: ComputedRef<{ id: string; title: string; status: 'done' | 'todo' | 'doing'; metricId: string | null; metricTitle: string | null; projName: string | null; projId: string; dirName: string | null; orphan: boolean }[]>
  onLayerOpen: (lv: 1 | 2) => void
  onLayerList: (lv: 3 | 5 | 6) => void
  onLocateLayer: (lv: 4) => void
  spineRef: Ref<any>
  heroToSpine: () => void
  locateCompassTarget: (target: { projId: string; metricId?: string; taskId?: string }) => void
  flashLocated: (el: HTMLElement) => void
  locationTaskPool: () => void
  onListLocate: (target: { projId: string; metricId?: string; taskId?: string }) => void
  onListEditDir: (id: string) => void
  onDirFilter: (id: string) => void
  toggleRiskOnly: () => void
  gotoOrphans: () => void
  riskOpen: Ref<boolean>
  riskGroups: ComputedRef<RiskProjectGroup[]>
  showRiskReport: () => void
  showTaskGrade: (taskId: string) => void
  bindOrphan: (taskId: string) => void
  toggleMetric: (id: string) => void
  editingField: Ref<string | null>
  focusEditField: (field: string) => void
  startEdit: (field: string, e: MouseEvent) => void
  saveEdit: (field: string, e: FocusEvent | KeyboardEvent) => void
  cancelEdit: () => void
  directionForm: Ref<{ open: boolean; direction: Direction | null }>
  openDirectionCreate: () => void
  openDirectionEdit: (id: string) => void
  saveDirectionForm: (value: { name: string; term: 'long' | 'mid' | 'short'; status: 'archived' | 'active' | 'paused' }) => void
} {
  const { compassMeta, findProject, d, layerOpen, layerView, activeLayer, ensureTower, projFoldOverride, writeProjFold, expandedMetrics, viewMode, dirFilter, riskOnly, router, panoId, openPano, visionText, missionText, allProjects, store } = deps
const layerRows5 = computed(() => {
  const out: { id: string; title: string; dirName: string; projName: string; projId: string; total: number; done: number; pct: number; orphan: boolean }[] = []
  for (const g of compassMeta.value.dirs) {
    for (const pm of g.projects) {
      const proj = findProject(pm.id)
      for (const m of pm.metrics) out.push({
        id: m.id, title: m.title, dirName: g.dir.name,
        projName: proj?.name || pm.id, projId: pm.id,
        total: m.total, done: m.done, pct: m.pct, orphan: m.orphanMetric
      })
    }
  }
  return out
})
const layerRows6 = computed(() => {
  const meta = compassMeta.value
  /* metricId → 归属路径（dirs 一次遍历建表，行内不再各自 find） */
  const path = new Map<string, { dirName: string; projName: string; projId: string; metricId: string; metricTitle: string }>()
  for (const g of meta.dirs) for (const pm of g.projects) {
    const proj = findProject(pm.id)
    for (const m of pm.metrics) path.set(m.id, { dirName: g.dir.name, projName: proj?.name || pm.id, projId: pm.id, metricId: m.id, metricTitle: m.title })
  }
  return d.value.tasks.filter(t => !t.deletedAt).map(t => {
    const p = t.metricId ? path.get(t.metricId) : undefined
    return {
      id: t.id, title: t.title, status: t.status,
      metricId: p?.metricId || null,
      metricTitle: p?.metricTitle || null,
      projName: p?.projName || null,
      projId: p?.projId || t.projectId || '',
      dirName: p?.dirName || null,
      orphan: !p
    }
  })
})

/** 层级 1/2 面板：同层再点收起（★双向可达，判据 W11-3；★F7 收窄：第 3 层迁出改走 layerView） */
function onLayerOpen(lv: 1 | 2) {
  layerOpen.value = layerOpen.value === lv ? null : lv
  if (layerOpen.value) {
    /* 与专属列表互斥：开面板即关列表（层板与列表都占同一条视线路径） */
    layerView.value = null
    /* ★W12：面板开在骨架条之下（第 1/2 层正文已搬进面板），滚到面板而不是"愿景卡" */
    nextTick(() => document.getElementById('lvpanel-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
}
/** ★F7 新增（用户拍板 2026-10-16）：层级专属列表视图 3/5/6 —— 同层再点收起（双向可达），
 *  收起即恢复打开列表前的 viewMode（viewMode 本就不被改，占位靠模板 v-if/v-else-if 链互斥）。 */
function onLayerList(lv: 3 | 5 | 6) {
  layerView.value = layerView.value === lv ? null : lv
  if (layerView.value) {
    layerOpen.value = null
    nextTick(() => document.getElementById('lvlist-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
}
/** 层级 4：定位到项目舱并闪一下（★F7 收窄：5/6 的定位语义由专属列表行内「定位」入口承担） */
function onLocateLayer(lv: 4) {
  layerOpen.value = null
  layerView.value = null
  activeLayer.value = lv
  ensureTower(`定位第 ${lv} 层`).then(() => {
    document.querySelector('[data-tower]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    showToast('第 4 层 · 每个项目一个独立舱，色条即项目身份')
  })
}

/* ★V3.9.19（04-73 一处不两说 · 用户拍板 2026-10-24）：hero 六层读数去重后的下钻入口 ——
 *  展开骨架条（六层计数的唯一账本，含折叠徽章计数与六层口径 tooltip）并打开第 1 层面板。
 *  复用 onLayerOpen(1)（自带与列表互斥、滚动到位）；骨架条展开走子组件暴露的 expandSpine。 */
const spineRef = ref<InstanceType<typeof CompassSpine> | null>(null)
function heroToSpine() {
  spineRef.value?.expandSpine()
  onLayerOpen(1)
  showToast('六层结构计数都在这条骨架上 · 已展开第 1 层（愿景原文）')
}
/** 定位到项目 / 指标 / 任务三级中的最具体一级。 */
function locateCompassTarget(target: { projId: string; metricId?: string; taskId?: string }) {
  const { projId, metricId, taskId } = target
  if (!projId) {
    if (taskId) locationTaskPool()
    else showToast('该目标没有可定位的项目')
    return
  }
  layerView.value = null
  layerOpen.value = null
  riskOpen.value = false
  const proj = findProject(projId)
  if (!proj) {
    if (taskId) locationTaskPool()
    else showToast('项目已不在')
    return
  }
  projFoldOverride.value[projId] = true
  writeProjFold()
  if (metricId) expandedMetrics.value.add(metricId)
  viewMode.value = 'tower'
  dirFilter.value = ''
  riskOnly.value = false
  nextTick(() => {
    ensureTower('定位任务').then(() => {
      const selector = metricId && taskId
        ? `[data-tower="${projId}"] [data-metric="${metricId}"] [data-task="${taskId}"]`
        : taskId
          ? `[data-tower="${projId}"] [data-task="${taskId}"]`
          : metricId
            ? `[data-tower="${projId}"] [data-metric="${metricId}"]`
            : `[data-tower="${projId}"]`
      nextTick(() => {
        const el = document.querySelector(selector) as HTMLElement | null
        if (!el) {
          if (taskId && !metricId) {
            const orphan = document.querySelector(`[data-tower="${projId}"] .tw-orphans [data-task="${taskId}"]`) as HTMLElement | null
            if (orphan) flashLocated(orphan)
            else showToast('任务已不在该项目')
          } else {
            const fallback = document.querySelector(`[data-tower="${projId}"]`) as HTMLElement | null
            if (fallback) flashLocated(fallback)
            else showToast('定位目标已不在')
          }
          return
        }
        flashLocated(el)
      })
    })
  })
}
function flashLocated(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('w11-flash')
  setTimeout(() => el.classList.remove('w11-flash'), 1400)
}
function locationTaskPool() {
  showToast('该任务未归项目，正在打开任务池', {
    label: '去任务池',
    cb: () => void router.push('/deck/task')
  })
}
function onListLocate(target: { projId: string; metricId?: string; taskId?: string }) {
  const { projId, metricId, taskId } = target
  if (!projId) {
    if (taskId) locationTaskPool()
    else showToast('该目标没有可定位的项目')
    return
  }
  const pm = compassMeta.value.byProject.get(projId)
  if (!pm) {
    if (taskId) locationTaskPool()
    else showToast('项目已不在')
    return
  }
  layerView.value = null
  layerOpen.value = null
  riskOpen.value = false
  dirFilter.value = ''
  openPano(projId)
  nextTick(() => {
    const selector = taskId
      ? `[data-metric="${metricId}"] [data-task="${taskId}"], [data-task="${taskId}"]`
      : metricId
        ? `[data-metric="${metricId}"]`
        : '.pano'
    nextTick(() => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el) {
        flashLocated(el)
        if (taskId) showToast('已切到项目全景并定位任务')
        else if (metricId) showToast('已切到项目全景并定位指标')
        return
      }
      if (taskId && !metricId) {
        const orphan = document.querySelector(`[data-task="${taskId}"]`) as HTMLElement | null
        if (orphan) { flashLocated(orphan); showToast('已切到项目全景并定位收容任务'); return }
      }
      showToast(taskId ? '任务已不在该项目' : '定位目标已不在')
    })
  })
}
/**
 * ★F7 列表第 3 层行内编辑：关掉层级列表回到项目塔，再就地进入该目标标题编辑。
 *   与「新建即编辑」共用 focusEditField —— 两条入口必须同一条聚焦链路，
 *   否则列表里点编辑会因 contenteditable 尚未渲染而静默落空。
 */
function onListEditDir(id: string) {
  openDirectionEdit(id)
}
/** 战略目标过滤：芯片 / 目标卡 / 分组头 三处同源 */
function onDirFilter(id: string) {
  dirFilter.value = dirFilter.value === id ? '' : id
  const nm = dirFilter.value
    ? (d.value.compass.directions.find(x => x.id === id)?.name || '')
    : ''
  showToast(nm ? `已聚焦「${nm}」· 其余目标的项目舱已隐藏` : '已恢复全部战略目标')
  if (nm) nextTick(() => document.querySelector('.dir-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function toggleRiskOnly() {
  riskOnly.value = !riskOnly.value
  showToast(riskOnly.value ? '只看断链：缺任务指标 + 无归属任务' : '已恢复全部内容')
}
/** 跳到第一条无归属收容区（全景下则先把主体切到那个有缺口的项目，再进全景的收容泳道） */
function gotoOrphans() {
  riskOnly.value = false
  /* 优先在当前全景主体里找 —— 不然会出现"点了收容却跳去别的项目"的错觉 */
  const pool: ProjectMeta[] = viewMode.value === 'pano' && panoId.value
    ? compassMeta.value.byProject.get(panoId.value)
      ? [compassMeta.value.byProject.get(panoId.value) as ProjectMeta]
      : []
    : compassMeta.value.dirs.flatMap(g => g.projects)
  const hit = pool.find(p => p.orphanTasks.length) || compassMeta.value.dirs.flatMap(g => g.projects).find(p => p.orphanTasks.length)
  if (!hit) { showToast('当前没有无归属任务'); return }
  openPano(hit.id)
  nextTick(() => {
    const el = document.querySelector('.lane.orph')
    if (!el) { showToast('已切到该项目 · 它没有无归属任务'); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('w11-flash')
    setTimeout(() => el.classList.remove('w11-flash'), 1400)
    showToast(`${hit.orphanTasks.length} 条任务在本项目内但没挂任何成功指标 · 泳道区最右侧的红色收容道`)
  })
}
/** 断链清单：只读弹窗，行可定位；不提供下载。 */
const riskOpen = ref(false)
const riskGroups = computed<RiskProjectGroup[]>(() => {
  const groups: RiskProjectGroup[] = []
  for (const g of compassMeta.value.dirs) {
    for (const pm of g.projects) {
      const proj = findProject(pm.id)
      const metrics = pm.metrics.filter(m => m.orphanMetric).map(m => ({
        id: m.id, title: m.title, acceptance: m.acceptance, projId: pm.id
      }))
      const tasks = pm.orphanTasks.map(t => ({ id: t.id, title: t.title, projId: pm.id }))
      if (!metrics.length && !tasks.length) continue
      groups.push({
        id: pm.id, projId: pm.id,
        dirName: g.dir.name, projName: proj?.name || pm.id,
        metrics, tasks
      })
    }
  }
  return groups
})
function showRiskReport() {
  if (!compassMeta.value.counts.risk) { showToast('当前无断链'); return }
  riskOpen.value = true
}
/** 任务成熟度详情（从任务行的小徽标点进来） */
function showTaskGrade(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  const m = taskMaturity(t)
  showToast(`${m.grade} · ${m.label}${m.reasons.length ? '｜' + m.reasons.slice(0, 3).join('；') : '｜四维齐备'}`)
}
/** 给无归属任务挂指标：进任务抽屉让用户选，本函数只做引导（写入口径唯一在任务侧） */
function bindOrphan(taskId: string) {
  const t = d.value.tasks.find(x => x.id === taskId)
  if (!t) return
  showToast(`「${t.title.slice(0, 14)}」尚无成功指标：请先在指标卡里新建一条，或用任务详情挂载`)
}

function toggleMetric(id: string) {
  if (expandedMetrics.value.has(id)) expandedMetrics.value.delete(id)
  else expandedMetrics.value.add(id)
}

// ---- 编辑状态（contenteditable方案）----
const editingField = ref<string | null>(null)

/** ★编辑聚焦：进入编辑态后滚到该字段、聚焦并全选（新建即编辑 / 栏内编辑与点标题编辑共用） */
function focusEditField(field: string) {
  nextTick(() => {
    const el = document.querySelector('[data-edit="' + field + '"]') as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

function startEdit(field: string, e: MouseEvent) {
  e.stopPropagation()
  editingField.value = field
  focusEditField(field)
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
  showToast('已保存')
}

function cancelEdit() {
  editingField.value = null
}

// ---- CRUD：战略目标新建 / 编辑共用中央表单（V3.9.22）----
const directionForm = ref<{ open: boolean; direction: Direction | null }>({ open: false, direction: null })

function openDirectionCreate() {
  directionForm.value = { open: true, direction: null }
}

function openDirectionEdit(id: string) {
  const direction = d.value.compass.directions.find(x => x.id === id)
  if (!direction) { showToast('战略目标已不在'); return }
  directionForm.value = { open: true, direction }
}

function saveDirectionForm(value: { name: string; term: 'long' | 'mid' | 'short'; status: Direction['status'] }) {
  if (directionForm.value.direction) {
    const direction = directionForm.value.direction
    direction.name = value.name
    direction.term = value.term
    direction.status = value.status
    store.persist()
    directionForm.value = { open: false, direction: null }
    showToast(`已更新战略目标「${value.name}」`)
    return
  }

  const direction: Direction = {
    id: uid('dir'),
    name: value.name,
    status: value.status,
    term: value.term,
    projects: []
  }
  d.value.compass.directions.push(direction)
  store.persist()
  directionForm.value = { open: false, direction: null }

  dirFilter.value = ''
  riskOnly.value = false
  layerView.value = null
  layerOpen.value = null
  viewMode.value = 'tower'
  nextTick(() => {
    const el = document.querySelector(`[data-dir-id="${direction.id}"]`) as HTMLElement | null
    if (!el) { showToast(`已创建「${value.name}」`); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('goal-flash')
    setTimeout(() => el.classList.remove('goal-flash'), 1500)
    showToast(`已创建战略目标「${value.name}」`)
  })
}

/**
 * R85（T0-B）：改调共享 `addProjectToDir`——改前这里**缺 `pinned` 与 `order`**，
 * 导致方向树新建的项目在主航线排序（`chipsOf` 的 `a.order ?? 999`）里永远排在最后。
 * 「新攻坚项目」这个默认名是方向树的既有行为，保留（改名属范围外）。
 */

  return {
    layerRows5, layerRows6, onLayerOpen, onLayerList, onLocateLayer, spineRef, heroToSpine, locateCompassTarget, flashLocated, locationTaskPool, onListLocate, onListEditDir, onDirFilter, toggleRiskOnly, gotoOrphans, riskOpen, riskGroups, showRiskReport, showTaskGrade, bindOrphan, toggleMetric, editingField, focusEditField, startEdit, saveEdit, cancelEdit, directionForm, openDirectionCreate, openDirectionEdit, saveDirectionForm,
  }
}
