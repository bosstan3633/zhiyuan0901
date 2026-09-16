<script setup lang="ts">
/**
 * R49-C2/C3/C6 + R50-F4 + R51-F19 + R52-F4 主航线 · 方向台核心模块
 * R57-F4 模块化重排：第一行 = 愿景｜使命 两列并列卡；第二行 = 战略目标模块网格
 *   （每模块 = 目标头 + 项目小模块 chip-proj，点击进项目详情；>6 折「更多 N」）
 * - R52-F4（修订 R51-F18）：主航线呈现全部项目（R60：原 📡 投射标记已取消，改以 🎯 主攻作区分）
 * - R52-BUG-2：已完成项目口径 = isProjectDone（手动 done/archived 或全任务完成派生）
 * - R51-F15：战略目标明细定位——监听 zy-locate-goal，滚动到对应战略目标模块并闪烁高亮
 * - 已完成项目受全局显隐开关控制；原愿景/使命树状折叠随重排退役
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
  focusedProjects, toggleFocusProject, addProjectToDir, showDone, toggleShowDone } = useCompass()
const store = useAppStore()

/**
 * R99（M8）：主航线状态筛选——与项目总览**共用同一份 `ovFilter`**（CompassShell 持有，v-model 传入，
 * 一处切换两处生效）。状态判定复用 projMeta 预计算（R83 红线：不在模板里逐项调判定函数）。
 * 门控与 D-B 同口径：项目数 >12 才出现（`toolsGate` 由宿主传入，单一来源）——≤12 时两处都不显示
 * 控件，避免「主航线筛了、项目总览没控件却跟着变少」的分裂观感（偏离登记 04-48）。
 */
const props = defineProps<{ ovFilter?: 'all' | 'active' | 'stalled' | 'done'; toolsGate?: boolean }>()
const emit = defineEmits<{ (e: 'update:ovFilter', v: 'all' | 'active' | 'stalled' | 'done'): void }>()
const filterActive = computed(() => (props.ovFilter || 'all') !== 'all')
/** 未做状态筛选的可见数（showDone 口径）——供空态文案区分「真没项目」与「被筛没了」 */
function rawVisibleCount(dirIdx: number): number {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return 0
  return dir.projects.filter(p => showDone.value || !isProjectDone(p)).length
}

// R86（T0）：显隐开关改由 store 提供（showDone / toggleShowDone）——三处模块共用同一份实现。

/** R60：原投射标记已随功能退役——愿景/使命无条件呈现，重心标记仅保留 🎯 主攻 */

/** 项目按显隐开关过滤（R52-BUG-2：口径统一为 isProjectDone——手动 done/archived 或全任务完成派生）
 *  R99（M8）：叠加状态筛选（与项目总览共用 ovFilter）——计数/芯片/主攻数全部跟随所见（D-B「所见即所数」口径）；
 *  goalPct 不受影响（它直算 dir.projects，衡量的是目标本身而非当前视图）。 */
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
/** R52-F4（修订 R51-F18 口径）：主航线呈现全部项目（R60：🎯 主攻置前作区分）；>6 折「更多 N」行内展开 */
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
/** R51-F15：战略目标明细定位 → 滚动到对应战略目标模块并闪烁 */
function onLocateGoal(e: Event) {
  const dirId = (e as CustomEvent).detail?.dirId as string
  if (!dirId) return
  const el = document.querySelector(`[data-dir-id="${dirId}"]`) as HTMLElement | null
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('goal-flash')
  setTimeout(() => el.classList.remove('goal-flash'), 1400)
}
onMounted(() => window.addEventListener('zy-locate-goal', onLocateGoal))
onUnmounted(() => window.removeEventListener('zy-locate-goal', onLocateGoal))
// R86（M7）：`doneCount` 随主航线的显隐开关一并移除——页头那处改用 CompassShell 既有的 `doneProjects`（同口径）
/** R57-F4：战略目标进度（模块头展示，复用 projectProgress 口径） */
/**
 * R83（M3）· 性能红线：项目进度/停滞/完成**预计算成索引**，不在模板里逐 chip 调函数。
 * `projectProgress` / `isProjectStalled` 内部都要遍历 d.tasks；在模板里对每个 chip 调一次
 * 就是 O(项目数 × 任务数) 每次重渲染（R71 确立的"模板方法调用消除"）。
 */
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

/** R83（M2）：期限映射；未设期限由模板 v-if 挡掉（不显示，不留空位） */
function termText(term?: 'long' | 'mid' | 'short'): string {
  return term === 'long' ? '远期' : term === 'mid' ? '中期' : term === 'short' ? '近期' : ''
}
/** R83（M2）：主攻项目数（只在 >0 时显示——写「主攻 0」是噪音） */
function focusedOf(dirIdx: number): number {
  return projectsOf(dirIdx).filter(p => p.isFocused).length
}
function openProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}
function openTree() { router.push('/compass/tree') }

/** R85（M5-②）：项目小卡 hover 的「🎯 设为主攻」——store 返回结构化结果（超限会被拒绝），由调用方 toast */
function onToggleFocus(p: Project) {
  showToast(toggleFocusProject(p.id).msg)
}

/**
 * R85（M5-①）：目标卡底「＋ 新建项目」——**内联输入，不弹窗**。
 * 弹窗是"管理"，内联输入是"预置"；且省掉一次与父组件 CompassShell 的跨组件通信
 * （`openCreate` 弹窗在 CompassShell，子组件要点它得 emit）。预选该目标：直接挂到 dir.id 下。
 * 创建走 `addProjectToDir`——四处新建出口共用的共享函数（R85 T0-B）。
 */
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
        <!-- R86（D-A）：分工标签——主航线 = 看主线（读为主）。
             R86（M7）：原「👁 已完成项目」开关**已移除**，收敛到方向台页头一处（R86/M7）。
             R117（04-61 C）：原文案指向的「项目总览」已退役 ⇒ 改写去向（下方项目详情 / 完整方向树）。
             ⚠「完整方向树 →」是导航入口不是开关，保留。 -->
        <span class="mod-role" title="主航线 = 看主线（读为主）：一眼看清主线推进到哪；要新建项目，去下方项目详情的左栏目录；改名/删除项目在项目详情内；目标级管理在完整方向树">看主线</span>
        <span class="mr-tool accent" @click="openTree">完整方向树 →</span>
        <!-- R99（M8）：状态筛选——R117 项目总览退役后为页内唯一筛选控件（门控：项目数 >12） -->
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

    <!-- R57-F4 第一行两列 ｜ R59-T6 accent 凸显 ｜ R83（M1）：两张占地方的卡 → 一条 44px 锚点条
         —— 首屏最贵的位置不该被两块卡占着；完整内容仍在完整方向树里，此处只是"锚点"（单行省略 + title 全文） -->
    <div class="mr-vm-bar" title="点击进入完整方向树（愿景 / 使命层）" @click="openTree">
      <span class="mr-tier tier-vision">愿景</span>
      <span class="mr-vm-text" :class="{ empty: !visionText }" :title="visionText">{{ visionText || '尚未设定愿景' }}</span>
      <span class="mr-vm-sep" />
      <span class="mr-tier">使命</span>
      <span class="mr-vm-text" :class="{ empty: !missionText }" :title="missionText">{{ missionText || '尚未设定使命' }}</span>
      <span class="mr-vm-go">进入方向树 ›</span>
    </div>

    <!-- R85（M4）：主攻聚焦条——锚点条之下，横排全部主攻项目（跨目标一览 + 直达入口）。
         改前 `focusedProjects` 这个 computed 已存在却**零消费**：主攻只在各目标卡内的 chip 上有 🎯 标记，
         没有跨目标的一览。无主攻时给一行轻引导，并把「最多 2 个」的规则**说在前面**——
         而不是等用户点下去才被拒。 -->
    <div class="mr-focus-bar" :class="{ empty: !focusedProjects.length }">
      <template v-if="focusedProjects.length">
        <span class="mr-tier tier-focus">主攻</span>
        <span v-for="p in focusedProjects" :key="p.id" class="fp-item" :class="{ done: projMeta.get(p.id)?.finished }"
          :title="p.name + ' · 点击进入项目详情'" @click="openProject(p)">
          <span class="fp-mark">🎯</span>
          <span class="fp-name">{{ p.name }}</span>
          <span class="fp-pct">{{ projMeta.get(p.id)?.pct || 0 }}%</span>
        </span>
      </template>
      <span v-else class="fp-hint">🎯 尚无主攻项目 —— 在项目小卡上点「🎯」即可指定（最多 {{ FOCUS_PROJECT_LIMIT }} 个）</span>
    </div>

    <!-- R57-F4：第二行 = 战略目标模块网格（模块内含项目小模块） -->
    <div class="mr-goals-grid">
      <div v-for="(dir, di) in d.compass.directions" :key="dir.id" class="mr-goal-card" :data-dir-id="dir.id">
        <div class="mgc-head">
          <span class="mr-tier tier-goal">目标</span>
          <span class="mgc-name" :title="dir.name">{{ dir.name }}</span>
          <!-- R83（M2）：期限 + 主攻数 + 进度口径 tooltip——此前只有光秃秃的百分比 -->
          <span class="mr-meta">项目 {{ projectsOf(di).length }}<template v-if="focusedOf(di)">（主攻 {{ focusedOf(di) }}）</template></span>
          <span v-if="dir.term" class="mgc-term">{{ termText(dir.term) }}</span>
          <span class="mgc-pct">{{ goalPct(di) }}%<span class="mgc-pct-tip" title="各项目进度的算术平均；项目有任务时 = 已完成任务 / 全部任务，无任务时取项目手动进度">ⓘ</span></span>
          <!-- R85（M5-③）：目标卡 hover 的 ⋯ = 在完整方向树中打开——**把重操作导流出去**，
               合 D-A 的「主航线 = 读为主」。不做目标管理菜单：CompassTree 已有完整目标级操作，不造第二套。 -->
          <span class="mgc-more" title="在完整方向树中打开" @click="openTree">⋯</span>
        </div>
        <div class="mgc-projects">
          <!-- R83（M3）：一行光秃秃的名字 → 两行小卡（主攻/停滞 + 迷你进度条 + pct% · done/total） -->
          <span v-for="p in chipsOf(di)" :key="p.id" class="chip-proj" :class="{ accent: p.isFocused, done: projMeta.get(p.id)?.finished }"
            :title="p.name + ' · 点击进入项目详情'" @click="openProject(p)">
            <span class="cp-row">
              <span v-if="p.isFocused" class="cp-mark" title="主攻项目">🎯</span>
              <span class="cp-name">{{ p.name }}</span>
              <span v-if="projMeta.get(p.id)?.stall" class="cp-flag" title="有任务但近 14 天无推进/完成活动">停滞</span>
              <!-- R85（M5-②）：hover 才显的两个动作。常态 `display:none` ⇒ **零占位**，名字照常占满整行 -->
              <span class="cp-acts">
                <span class="cp-act" :title="p.isFocused ? '取消主攻' : '设为主攻（最多 ' + FOCUS_PROJECT_LIMIT + ' 个）'" @click.stop="onToggleFocus(p)">🎯</span>
                <span class="cp-act" title="进入项目详情" @click.stop="openProject(p)">›</span>
              </span>
            </span>
            <span class="cp-row cp-foot">
              <span class="cp-bar"><i :style="{ width: (projMeta.get(p.id)?.pct || 0) + '%' }" /></span>
              <span class="cp-pct">{{ projMeta.get(p.id)?.pct || 0 }}% · {{ projMeta.get(p.id)?.done || 0 }}/{{ projMeta.get(p.id)?.total || 0 }}</span>
            </span>
          </span>
          <span v-if="moreOf(di)" class="chip-more" title="展开其余项目" @click="toggleMore(dir.id)">更多 {{ moreOf(di) }}</span>
          <!-- R85（M5-①）：目标卡底「＋ 新建项目」——内联输入、预选该目标。
               与 chips 同排（**零额外行高**）；创建走 `addProjectToDir`（四处出口共用的共享函数）。 -->
          <input v-if="addingDir === dir.id" v-model="addName" v-focus class="chip-add-input" placeholder="项目名称，回车创建"
            @keyup.enter="confirmAdd(dir.id)" @keyup.esc="cancelAdd" @blur="cancelAdd" />
          <span v-else class="chip-add" title="在此目标下新建项目" @click="startAdd(dir.id)">＋ 新建项目</span>
          <!-- R99（M8）：空态区分「真没项目」与「被筛没了」 -->
          <span v-if="!projectsOf(di).length" class="mgc-empty">{{ filterActive && rawVisibleCount(di) ? '无符合当前筛选的项目' : '暂无项目' }}</span>
        </div>
      </div>
      <div v-if="!d.compass.directions.length" class="mr-empty" @click="openTree">还没有战略目标 → 去完整方向树创建</div>
    </div>
  </ModuleCard>
</template>

<style scoped>
.mr-tools { display: flex; align-items: center; gap: 10px; }
/* R86（D-A）分工标签 —— R117（04-61 C）：原定义在 CompassShell 的 :deep(.mod-role)（一份覆盖两处：
   主航线 + 项目总览）。项目总览退役后本组件是唯一消费者，样式随之内聚，避免跨文件隐式依赖。 */
.mod-role { flex-shrink: 0; font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 99px; cursor: help; }
/* R99（M8）：主航线状态筛选——观感沿用原项目总览 .ov-filter（R117 后为页内唯一状态筛选） */
.mr-filter { font-family: inherit; font-size: 11.5px; padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); outline: none; cursor: pointer; }
.mr-filter:focus { border-color: var(--accent); }
.mr-tool { font-size: 11.5px; color: var(--text-3); cursor: pointer; white-space: nowrap; transition: color .12s; }
.mr-tool:hover { color: var(--accent); }
.mr-tool.accent { color: var(--accent); }
.mr-tool.accent:hover { text-decoration: underline; }
.mr-tool.off { opacity: .6; }

.mr-tier { font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--text-3); background: var(--surface-3); padding: 2px 8px; border-radius: 99px; flex-shrink: 0; min-width: 38px; text-align: center; }
.tier-vision { background: var(--accent-light); color: var(--accent); }
.mr-chip { font-size: 9.5px; padding: 2px 7px; border-radius: 99px; font-weight: 500; flex-shrink: 0; white-space: nowrap; }
.chip-project { background: var(--surface-3); color: var(--text-2); }
.mr-meta { font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0; }
.mr-empty { font-size: 11.5px; color: var(--text-4); padding: 6px 12px; cursor: pointer; }

/* R57-F4 第一行 ｜ R59-T6 accent 凸显 ｜ R83（M1）：两张卡 → 一条 44px 锚点条（首屏让出约 40px 给目标网格） */
.mr-vm-bar { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; margin-bottom: 10px; background: color-mix(in srgb, var(--accent) 7%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border)); border-radius: var(--radius-sm); cursor: pointer; transition: all .15s; }
.mr-vm-bar:hover { border-color: var(--accent); box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 16%, transparent); }
.mr-vm-text { flex: 1.2; min-width: 0; font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mr-vm-text.empty { color: var(--text-4); font-weight: 400; }
/* 使命段沿用原 1.2fr:1fr 的重心比例（愿景 1.2 / 使命 1 ⇒ 1 : 0.833） */
.mr-vm-sep { flex: 0 0 1px; align-self: stretch; margin: 9px 2px; background: var(--border); }
.mr-vm-sep ~ .mr-vm-text { flex: 1; }
.mr-vm-go { flex-shrink: 0; font-size: 10.5px; color: var(--accent); opacity: .8; white-space: nowrap; }
.mr-vm-bar:hover .mr-vm-go { opacity: 1; text-decoration: underline; }

/* R85（M4）：主攻聚焦条——锚点条之下，一行 ≤40px，横排全部主攻项目（跨目标一览 + 直达入口） */
.mr-focus-bar { display: flex; align-items: center; gap: 8px; min-height: 34px; max-height: 40px; padding: 0 12px; margin-bottom: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.mr-focus-bar.empty { border-style: dashed; }
.tier-focus { background: var(--accent-light); color: var(--accent); }
.fp-item { display: flex; align-items: center; gap: 5px; flex-shrink: 0; max-width: 240px; padding: 3px 10px; border-radius: 99px; background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border)); color: var(--text); cursor: pointer; transition: all .12s; }
.fp-item:hover { border-color: var(--accent); background: var(--accent-light); }
/* 已完成的主攻仍要能看到（并可从聚焦条取消掉），只降透明度——对齐 .chip-proj.done 既有口径 */
.fp-item.done { opacity: .55; }
.fp-mark { flex-shrink: 0; font-size: 10px; }
.fp-name { min-width: 0; font-size: 11.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fp-pct { flex-shrink: 0; font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.fp-hint { font-size: 11.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* R85（M5-③）：目标卡 hover 的 ⋯——常态 display:none（零占位），hover 才出 */
.mgc-more { display: none; flex-shrink: 0; padding: 0 4px; font-size: 14px; line-height: 1; color: var(--text-3); cursor: pointer; }
.mr-goal-card:hover .mgc-more { display: block; }
.mgc-more:hover { color: var(--accent); }

/* R85（M5-②）：项目小卡 hover 动作——常态 display:none 零占位，hover 才 flex（名字自动收缩让位） */
.cp-acts { display: none; gap: 2px; flex-shrink: 0; margin-left: auto; }
.chip-proj:hover .cp-acts { display: flex; }
.cp-act { flex-shrink: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 9.5px; color: var(--text-3); background: var(--surface-2); }
.cp-act:hover { color: var(--accent); background: var(--accent-light); }

/* R85（M5-①）：目标卡底「＋ 新建项目」——与 chips 同排的 dashed 小卡（对齐 .chip-more 既有观感） */
.chip-add { font-size: 11px; padding: 4px 10px; border-radius: 8px; background: transparent; border: 1px dashed var(--border-strong); color: var(--text-3); cursor: pointer; white-space: nowrap; }
.chip-add:hover { color: var(--accent); border-color: var(--accent); }
.chip-add-input { width: 150px; min-width: 120px; font-family: inherit; font-size: 11.5px; padding: 4px 9px; border-radius: 8px; border: 1px solid var(--accent); background: var(--surface); color: var(--text); outline: none; }

/* R57-F4：第二行 战略目标模块网格 */
/* R99（M6）：网格顶对齐——「更多 N」展开只长自己这张卡，不再把同排邻卡拉伸变形（撑破网格） */
.mr-goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; align-items: start; }
.mr-goal-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 9px; }
.mgc-head { display: flex; align-items: center; gap: 8px; }
.tier-goal { background: var(--accent-light); color: var(--accent); }
.mgc-name { font-size: 13px; font-weight: 650; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mgc-pct { font-size: 11px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.mgc-projects { display: flex; flex-wrap: wrap; gap: 6px; }
/* R83（M3）：项目小模块 —— 一行光名字 → 两行小卡（主攻/停滞 + 迷你进度条 + pct% · done/total） */
.chip-proj { display: flex; flex-direction: column; gap: 4px; width: 168px; min-width: 150px; max-width: 210px; padding: 6px 9px 7px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; transition: all .12s; }
.chip-proj:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.chip-proj.accent { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); color: var(--accent); }
/* 已完成降透明度——对齐 .archived 的既有口径（CompassShell.vue:337 的 opacity .55） */
.chip-proj.done { opacity: .55; }
.cp-row { display: flex; align-items: center; gap: 4px; min-width: 0; }
.cp-mark { flex-shrink: 0; font-size: 10px; }
.cp-name { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 500; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-flag { flex-shrink: 0; font-size: 9px; padding: 1px 4px; border-radius: 3px; background: var(--tag-warn-bg); color: var(--warning); white-space: nowrap; }
.cp-foot { gap: 6px; }
.cp-bar { flex: 1; min-width: 0; height: 3px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
.cp-bar i { display: block; height: 100%; border-radius: 99px; background: var(--accent); }
.cp-pct { flex-shrink: 0; font-size: 9.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.chip-more { font-size: 11px; padding: 4px 10px; border-radius: 8px; background: transparent; border: 1px dashed var(--border-strong); color: var(--text-3); cursor: pointer; }
.chip-more:hover { color: var(--accent); border-color: var(--accent); }
.mgc-empty { font-size: 11px; color: var(--text-4); }

/* R51-F15：战略目标明细定位闪烁 */
.mr-goal-card.goal-flash { animation: goalFlash 1.2s ease; }
@keyframes goalFlash { 0%, 100% { background: var(--surface-2); box-shadow: none; } 30% { background: var(--accent-light); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); } }

@media (max-width: 1080px) {
  .mr-vm-row { grid-template-columns: 1fr; }
}
</style>
