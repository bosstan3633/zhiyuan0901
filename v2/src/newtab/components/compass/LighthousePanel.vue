<script setup lang="ts">
/**
 * R49-C2/C3/C6 + R50-F4 + R51-F19 + R52-F4 + R121 主航线 · 方向台核心模块
 * R121（V2.89.0 方向台 UI 迭代，对齐原型）：
 * - A2 愿景/使命锚点条：中性卡（tag + 文本 ｜ 进入方向树 ›）
 * - A3 主攻聚焦条：chip 带 selected 态；单击 = 选中联动下方展板；双击 = 进入项目详情页
 * - A4 主航线：**固定 3 列**目标卡网格（>3 换行）；目标卡头 meta 合并一行「期限 · N 项目 (主攻 n) · pct%」
 * - A5 项目行卡：全宽行（🎯/名称/停滞标 + `pct% · done/total` + 迷你进度条 + selected 态）
 * - 右键菜单（零占位）：置顶/取消置顶 · 上移/下移 · 设为主攻/取消 · 进入项目详情
 * 保留：状态筛选（>12 项目门控）· 「更多 N」· 目标卡内联新建项目 · 目标定位闪烁 · 已完成显隐
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompass, FOCUS_PROJECT_LIMIT } from '../../stores/compass'
import { useAppStore } from '../../stores/app'
import { showToast } from '@/shared/components/toast'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import type { Project } from '@/shared/models'

const router = useRouter()
const { d, visionText, missionText, allProjects, projectProgress, isProjectStalled, isProjectDone,
  focusedProjects, toggleFocusProject, addProjectToDir, showDone } = useCompass()
const store = useAppStore()

const props = defineProps<{ ovFilter?: 'all' | 'active' | 'stalled' | 'done'; toolsGate?: boolean; selectedId?: string }>()
const emit = defineEmits<{
  (e: 'update:ovFilter', v: 'all' | 'active' | 'stalled' | 'done'): void
  (e: 'select-project', id: string): void
}>()
const filterActive = computed(() => (props.ovFilter || 'all') !== 'all')
/** 未做状态筛选的可见数（showDone 口径）——供空态文案区分「真没项目」与「被筛没了」 */
function rawVisibleCount(dirIdx: number): number {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return 0
  return dir.projects.filter(p => showDone.value || !isProjectDone(p)).length
}

/** 项目按显隐开关过滤 + 状态筛选（计数/芯片全部跟随所见） */
function projectsOf(dirIdx: number): Project[] {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return []
  const list = dir.projects.filter(p => showDone.value || !isProjectDone(p))
  const f = props.ovFilter || 'all'
  if (f === 'all') return list
  return list.filter(p => {
    const st = projMeta.value.get(p.id)
    if (f === 'stalled') return !!st?.stall
    if (f === 'done') return !!st?.finished
    return !st?.finished && !st?.stall // active
  })
}
/** 主航线呈现全部项目（🎯 主攻置前）；>6 折「更多 N」行内展开 */
const CHIP_LIMIT = 6
const expandedGoals = ref<Set<string>>(new Set())
function chipsOf(dirIdx: number): Project[] {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return []
  const list = projectsOf(dirIdx).slice()
  list.sort((a, b) => (Number(b.isFocused) - Number(a.isFocused)) || (a.order ?? 999) - (b.order ?? 999))
  if (expandedGoals.value.has(dir.id)) return list
  return list.slice(0, CHIP_LIMIT)
}
function moreOf(dirIdx: number): number {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir || expandedGoals.value.has(dir.id)) return 0
  return Math.max(0, projectsOf(dirIdx).length - CHIP_LIMIT)
}
function toggleMore(dirId: string) {
  if (expandedGoals.value.has(dirId)) expandedGoals.value.delete(dirId)
  else expandedGoals.value.add(dirId)
}
/** R51-F15：战略目标明细定位 → 滚动到对应战略目标卡并闪烁 */
function onLocateGoal(e: Event) {
  const dirId = (e as CustomEvent).detail?.dirId as string
  if (!dirId) return
  const el = document.querySelector(`[data-dir-id="${dirId}"]`) as HTMLElement | null
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('goal-flash')
  setTimeout(() => el.classList.remove('goal-flash'), 1400)
}
onMounted(() => {
  window.addEventListener('zy-locate-goal', onLocateGoal)
  document.addEventListener('click', closeMenu, true)
  document.addEventListener('scroll', closeMenu, true)
})
onUnmounted(() => {
  window.removeEventListener('zy-locate-goal', onLocateGoal)
  document.removeEventListener('click', closeMenu, true)
  document.removeEventListener('scroll', closeMenu, true)
})
/** 项目进度/停滞/完成预计算（R83 红线：不在模板里逐项调函数） */
const projMeta = computed(() => {
  const m = new Map<string, { pct: number; done: number; total: number; stall: boolean; finished: boolean }>()
  for (const p of allProjects()) {
    const pr = projectProgress(p)
    m.set(p.id, { pct: pr.pct, done: pr.done, total: pr.total, stall: isProjectStalled(p), finished: isProjectDone(p) })
  }
  return m
})
function goalPct(dirIdx: number): number {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir || !dir.projects.length) return 0
  const total = dir.projects.reduce((a, p) => a + projectProgress(p).pct, 0)
  return Math.round(total / dir.projects.length)
}
function termText(term?: 'long' | 'mid' | 'short'): string {
  return term === 'long' ? '远期' : term === 'mid' ? '中期' : term === 'short' ? '近期' : ''
}
function focusedOf(dirIdx: number): number {
  return projectsOf(dirIdx).filter(p => p.isFocused).length
}
function openProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}
function openTree() { router.push('/compass/tree') }

/** R121（A3/A5）：单击 = 选中并联动下方展板（不发页面跳转）；双击 = 进入项目详情页 */
function selectProject(p: Project) {
  emit('select-project', p.id)
}

/** R85（M5-②）：设为主攻（store 返回结构化结果，超限会被拒绝） */
function onToggleFocus(p: Project) {
  showToast(toggleFocusProject(p.id).msg)
}

/* ================= R121：项目行卡右键菜单（零占位） =================
 * 原「置顶分组 + 拖拽排序」能力（R117 迁至左栏的）随左栏移除收敛到此处：
 * 置顶/取消置顶 · 上移/下移 · 设为主攻/取消 · 进入项目详情。 */
const menu = ref<{ x: number; y: number; proj: Project; dirId: string } | null>(null)
function openMenu(e: MouseEvent, p: Project, dirId: string) {
  e.preventDefault()
  menu.value = { x: e.clientX, y: e.clientY, proj: p, dirId }
}
function closeMenu() { if (menu.value) menu.value = null }
function togglePin(p: Project) {
  p.pinned = !p.pinned
  store.persist()
  showToast(p.pinned ? '📌 已置顶' : '已取消置顶')
}
/** 上移/下移：在该目标的可见排序列表内与相邻项交换 order（排序口径与主航线呈现一致） */
function moveProject(p: Project, dirId: string, delta: -1 | 1) {
  const dir = d.value.compass.directions.find(x => x.id === dirId)
  if (!dir) return
  const list = dir.projects.slice().sort((a, b) => (Number(b.isFocused) - Number(a.isFocused)) || (a.order ?? 999) - (b.order ?? 999))
  const i = list.findIndex(x => x.id === p.id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return
  const a = list[i]!, b = list[j]!
  const ao = a.order ?? i, bo = b.order ?? j
  a.order = bo; b.order = ao
  if (a.order === b.order) { a.order = ao; b.order = bo; return }
  store.persist()
  showToast(delta === -1 ? '↑ 已上移' : '↓ 已下移')
}

/** R85（M5-①）：目标卡底「＋ 新建项目」——内联输入，不弹窗，预选该目标 */
const addingDir = ref('')
const addName = ref('')
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
function startAdd(dirId: string) { addingDir.value = dirId; addName.value = '' }
function cancelAdd() { addingDir.value = '' }
function confirmAdd(dirId: string) {
  const name = addName.value.trim()
  if (!name) { cancelAdd(); return }
  const proj = addProjectToDir(dirId, name)
  cancelAdd()
  if (proj) showToast(`✓ 项目「${name}」已创建`)
}
</script>

<template>
  <ModuleCard icon-name="radio" title="主航线" en="MAIN ROUTE">
    <template #actions>
      <div class="mr-tools">
        <span class="mod-role" title="主航线 = 看主线（读为主）：一眼看清主线推进到哪；新建项目在目标卡内，改名/删除在项目详情">看主线</span>
        <span class="mr-tool accent" @click="openTree">完整方向树 →</span>
        <select v-if="toolsGate" class="mr-filter" :value="props.ovFilter || 'all'"
          @change="emit('update:ovFilter', ($event.target as HTMLSelectElement).value as 'all' | 'active' | 'stalled' | 'done')"
          title="按状态筛选项目（口径同项目卡：停滞 = 有任务但近 14 天无推进）">
          <option value="all">全部</option>
          <option value="active">进行中</option>
          <option value="stalled">停滞</option>
          <option value="done">已完成</option>
        </select>
      </div>
    </template>

    <!-- A2：愿景/使命 锚点条（中性卡，≤44px；点击进入完整方向树） -->
    <div class="vm-bar" title="点击进入完整方向树（愿景 / 使命层）" @click="openTree">
      <div class="vm-item">
        <span class="vm-tag">愿景</span>
        <span class="vm-text" :class="{ empty: !visionText }" :title="visionText">{{ visionText || '尚未设定愿景' }}</span>
      </div>
      <span class="vm-divider" />
      <div class="vm-item">
        <span class="vm-tag">使命</span>
        <span class="vm-text" :class="{ empty: !missionText }" :title="missionText">{{ missionText || '尚未设定使命' }}</span>
      </div>
      <span class="vm-go">进入方向树 ›</span>
    </div>

    <!-- A3：主攻聚焦条（≤40px；chip selected 态 = 下方展板当前项目） -->
    <div class="focus-bar" :class="{ empty: !focusedProjects.length }">
      <template v-if="focusedProjects.length">
        <span class="fs-badge">⚑ 主攻</span>
        <span v-for="p in focusedProjects" :key="p.id" class="fs-chip"
          :class="{ selected: p.id === props.selectedId, done: projMeta.get(p.id)?.finished }"
          :title="p.name + ' · 单击联动下方展板 · 双击进入项目详情'"
          @click="selectProject(p)" @dblclick="openProject(p)">
          <span class="fs-name">{{ p.name }}</span>
          <span class="fs-pct">{{ projMeta.get(p.id)?.pct || 0 }}%</span>
        </span>
        <span class="fs-hint">在项目卡上点击可直接在下方联动展板</span>
      </template>
      <span v-else class="fp-hint">⚑ 尚无主攻项目 —— 在项目行卡右键即可指定（最多 {{ FOCUS_PROJECT_LIMIT }} 个）</span>
    </div>

    <!-- A4/A5：战略目标 3 列网格（>3 换行）｜ 项目行卡（迷你进度条 + selected 态） -->
    <div class="goals-grid">
      <div v-for="(dir, di) in d.compass.directions" :key="dir.id" class="goal-card" :data-dir-id="dir.id">
        <div class="gc-head">
          <span class="gc-name" :title="dir.name">{{ dir.name }}</span>
          <span class="gc-more" title="在完整方向树中打开" @click="openTree">⋯</span>
        </div>
        <div class="gc-meta">
          <template v-if="termText(dir.term)">{{ termText(dir.term) }} · </template>
          {{ projectsOf(di).length }} 项目<template v-if="focusedOf(di)">（主攻 {{ focusedOf(di) }}）</template> · {{ goalPct(di) }}%
        </div>
        <div class="gc-projects">
          <div v-for="p in chipsOf(di)" :key="p.id" class="proj-row"
            :class="{ selected: p.id === props.selectedId, done: projMeta.get(p.id)?.finished, focused: p.isFocused }"
            :title="p.name + ' · 单击联动下方展板 · 双击进入项目详情 · 右键更多操作'"
            @click="selectProject(p)" @dblclick="openProject(p)" @contextmenu="openMenu($event, p, dir.id)">
            <div class="pr-top">
              <span class="pr-title">
                <span v-if="p.isFocused" class="pr-mark" title="主攻项目">⚑</span>
                <span class="pr-name">{{ p.name }}</span>
                <span v-if="projMeta.get(p.id)?.stall" class="pr-flag" title="有任务但近 14 天无推进/完成活动">停滞</span>
              </span>
              <span class="pr-meta" :class="{ ok: projMeta.get(p.id)?.finished }">{{ projMeta.get(p.id)?.pct || 0 }}% · {{ projMeta.get(p.id)?.done || 0 }}/{{ projMeta.get(p.id)?.total || 0 }}</span>
            </div>
            <div class="mini-bar"><i :style="{ width: (projMeta.get(p.id)?.pct || 0) + '%' }" /></div>
            <span class="pr-acts">
              <span class="pr-act" :title="p.isFocused ? '取消主攻' : '设为主攻（最多 ' + FOCUS_PROJECT_LIMIT + ' 个）'" @click.stop="onToggleFocus(p)">⚑</span>
              <span class="pr-act" title="进入项目详情" @click.stop="openProject(p)">›</span>
            </span>
          </div>
          <span v-if="moreOf(di)" class="chip-more" title="展开其余项目" @click="toggleMore(dir.id)">更多 {{ moreOf(di) }}</span>
          <input v-if="addingDir === dir.id" v-model="addName" v-focus class="chip-add-input" placeholder="项目名称，回车创建"
            @keyup.enter="confirmAdd(dir.id)" @keyup.esc="cancelAdd" @blur="cancelAdd" />
          <span v-else class="chip-add" title="在此目标下新建项目" @click="startAdd(dir.id)">＋ 新建项目</span>
          <span v-if="!projectsOf(di).length" class="mgc-empty">{{ filterActive && rawVisibleCount(di) ? '无符合当前筛选的项目' : '暂无项目' }}</span>
        </div>
      </div>
      <div v-if="!d.compass.directions.length" class="mr-empty" @click="openTree">还没有战略目标 → 去完整方向树创建</div>
    </div>

    <!-- R121：项目行卡右键菜单（置顶 / 上移下移 / 主攻 / 详情） -->
    <Teleport to="body">
      <div v-if="menu" class="proj-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
        <div class="pm-item" @click="togglePin(menu.proj); closeMenu()">{{ menu.proj.pinned ? '📌 取消置顶' : '📌 置顶' }}</div>
        <div class="pm-item" @click="moveProject(menu.proj, menu.dirId, -1); closeMenu()">↑ 上移</div>
        <div class="pm-item" @click="moveProject(menu.proj, menu.dirId, 1); closeMenu()">↓ 下移</div>
        <div class="pm-sep" />
        <div class="pm-item" @click="onToggleFocus(menu.proj); closeMenu()">⚑ {{ menu.proj.isFocused ? '取消主攻' : '设为主攻' }}</div>
        <div class="pm-item" @click="openProject(menu.proj); closeMenu()">📄 进入项目详情</div>
      </div>
    </Teleport>
  </ModuleCard>
</template>

<style scoped>
.mr-tools { display: flex; align-items: center; gap: 10px; }
.mod-role { flex-shrink: 0; font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 99px; cursor: help; }
.mr-filter { font-family: inherit; font-size: 11.5px; padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); outline: none; cursor: pointer; }
.mr-filter:focus { border-color: var(--accent); }
.mr-tool { font-size: 11.5px; color: var(--text-3); cursor: pointer; white-space: nowrap; transition: color .12s; }
.mr-tool:hover { color: var(--accent); }
.mr-tool.accent { color: var(--accent); }
.mr-tool.accent:hover { text-decoration: underline; }
.mr-empty { font-size: 11.5px; color: var(--text-4); padding: 6px 12px; cursor: pointer; }

/* ===== A2：愿景/使命锚点条（中性卡） ===== */
.vm-bar { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 14px; margin-bottom: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); cursor: pointer; transition: border-color .15s; }
.vm-bar:hover { border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); }
.vm-item { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1.2; }
.vm-item + .vm-divider + .vm-item { flex: 1; }
.vm-tag { flex-shrink: 0; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--surface-2); color: var(--text-2); }
.vm-text { min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vm-text.empty { color: var(--text-4); font-weight: 400; }
.vm-divider { width: 1px; height: 14px; background: var(--border); flex-shrink: 0; }
.vm-go { flex-shrink: 0; margin-left: 12px; font-size: 12px; color: var(--text-3); white-space: nowrap; }
.vm-bar:hover .vm-go { color: var(--accent); }

/* ===== A3：主攻聚焦条（chip selected 态） ===== */
.focus-bar { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 14px; margin-bottom: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); overflow: hidden; }
.focus-bar.empty { border-style: dashed; box-shadow: none; }
.fs-badge { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; background: var(--accent-light); color: var(--accent); font-size: 11.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
.fs-chip { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; max-width: 280px; padding: 3px 9px; border-radius: 4px; background: var(--surface-2); cursor: pointer; transition: background .15s; }
.fs-chip:hover { background: var(--surface-3); }
.fs-chip.selected { border: 1px solid var(--accent); background: var(--surface); padding: 2px 8px; }
.fs-chip.done { opacity: .55; }
.fs-name { min-width: 0; font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fs-pct { flex-shrink: 0; font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.fs-hint { margin-left: auto; flex-shrink: 0; font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
.fp-hint { font-size: 11.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ===== A4/A5：战略目标 3 列网格 + 项目行卡 ===== */
.goals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-items: start; }
.goal-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.gc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.gc-name { font-size: 13px; font-weight: 700; color: var(--text); min-width: 0; }
.gc-meta { font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.gc-more { display: none; flex-shrink: 0; padding: 0 4px; font-size: 14px; line-height: 1; color: var(--text-3); cursor: pointer; }
.goal-card:hover .gc-more { display: block; }
.gc-more:hover { color: var(--accent); }
.gc-projects { display: flex; flex-direction: column; gap: 6px; }
.proj-row { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: all .15s ease; }
.proj-row:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.proj-row.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.proj-row.done { opacity: .6; }
.pr-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.pr-title { display: flex; align-items: center; gap: 5px; min-width: 0; font-weight: 600; color: var(--text); }
.pr-mark { flex-shrink: 0; color: var(--accent); font-size: 10px; }
.pr-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pr-flag { flex-shrink: 0; font-size: 9px; padding: 1px 4px; border-radius: 3px; background: var(--tag-warn-bg); color: var(--warning); }
.pr-meta { flex-shrink: 0; font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.pr-meta.ok { color: var(--success); }
.mini-bar { height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.mini-bar i { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
.proj-row.done .mini-bar i { background: var(--success); }
/* 行内 hover 动作（常态零占位） */
.pr-acts { display: none; position: absolute; top: 6px; right: 8px; gap: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1px; }
.proj-row:hover .pr-acts { display: inline-flex; }
.proj-row:hover .pr-meta { visibility: hidden; }
.pr-act { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 10px; color: var(--text-3); background: var(--surface-2); }
.pr-act:hover { color: var(--accent); background: var(--accent-light); }
.chip-more { font-size: 11px; padding: 4px 10px; border-radius: 8px; background: transparent; border: 1px dashed var(--border-strong); color: var(--text-3); cursor: pointer; align-self: flex-start; }
.chip-more:hover { color: var(--accent); border-color: var(--accent); }
.chip-add { font-size: 11px; padding: 4px 10px; border-radius: 8px; background: transparent; border: 1px dashed var(--border-strong); color: var(--text-3); cursor: pointer; white-space: nowrap; align-self: flex-start; }
.chip-add:hover { color: var(--accent); border-color: var(--accent); }
.chip-add-input { width: 150px; font-family: inherit; font-size: 11.5px; padding: 4px 9px; border-radius: 8px; border: 1px solid var(--accent); background: var(--surface); color: var(--text); outline: none; }
.mgc-empty { font-size: 11px; color: var(--text-4); }

/* R51-F15：目标卡定位闪烁 */
.goal-card.goal-flash { animation: goalFlash 1.2s ease; }
@keyframes goalFlash { 0%, 100% { background: var(--surface-2); box-shadow: none; } 30% { background: var(--accent-light); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); } }

/* R121：项目行卡右键菜单 */
.proj-menu { position: fixed; z-index: 400; min-width: 148px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-lg); padding: 4px; font-size: 12px; }
.pm-item { padding: 6px 10px; border-radius: 6px; cursor: pointer; color: var(--text-2); white-space: nowrap; }
.pm-item:hover { background: var(--accent-light); color: var(--accent); }
.pm-sep { height: 1px; background: var(--border); margin: 4px 6px; }

@media (max-width: 1180px) {
  .goals-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 980px) {
  .goals-grid { grid-template-columns: 1fr; }
}
</style>
