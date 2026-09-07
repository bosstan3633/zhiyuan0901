<script setup lang="ts">
/**
 * R49-C2/C3/C6 + R50-F4 + R51-F19 + R52-F4 主航线 · 方向台核心模块
 * R57-F4 模块化重排：第一行 = 愿景｜使命 两列并列卡；第二行 = 战略目标模块网格
 *   （每模块 = 目标头 + 项目小模块 chip-proj，点击进项目详情；>6 折「更多 N」）
 * - R52-F4（修订 R51-F18）：主航线呈现全部项目（无论是否投射，📡 仅作区分标记）
 * - R52-BUG-2：已完成项目口径 = isProjectDone（手动 done/archived 或全任务完成派生）
 * - R51-F15：DHI 明细定位——监听 zy-locate-goal，滚动到对应战略目标模块并闪烁高亮
 * - 已完成项目受全局显隐开关控制；原愿景/使命树状折叠随重排退役
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompass } from '../../stores/compass'
import { useAppStore } from '../../stores/app'
import { saveUIPrefs } from '@/shared/storage/repository'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import type { Project } from '@/shared/models'

const router = useRouter()
const { d, visionText, missionText, allProjects, projectProgress, isProjectDone } = useCompass()
const store = useAppStore()

// ---- 显隐开关（C6 三处同步） ----
const showDone = computed(() => store.ui?.showDoneProjects !== false)
function toggleShowDone() {
  const next = !showDone.value
  if (store.ui) store.ui.showDoneProjects = next
  saveUIPrefs({ showDoneProjects: next })
}

/** 已投射标记（C4：口径=CompassNode/Project 自身 pinnedToLighthouse；战略目标层无投射，REQ-001） */
const showVision = computed(() => d.value.compass.vision.pinnedToLighthouse)
const showMission = computed(() => d.value.compass.mission.pinnedToLighthouse)

/** 项目按显隐开关过滤（R52-BUG-2：口径统一为 isProjectDone——手动 done/archived 或全任务完成派生） */
function projectsOf(dirIdx: number): Project[] {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return []
  return dir.projects.filter(p => showDone.value || !isProjectDone(p))
}
/** R52-F4（修订 R51-F18 口径）：主航线呈现全部项目（无论是否投射，📡 仅作标记）；>6 折「更多 N」行内展开 */
const CHIP_LIMIT = 6
const expandedGoals = ref<Set<string>>(new Set())
function chipsOf(dirIdx: number): Project[] {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return []
  const list = projectsOf(dirIdx).slice()
  list.sort((a, b) => (Number(b.isFocused) - Number(a.isFocused)) || (Number(b.pinnedToLighthouse || false) - Number(a.pinnedToLighthouse || false)) || (a.order ?? 999) - (b.order ?? 999))
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
/** R51-F15：DHI 明细定位 → 滚动到对应战略目标模块并闪烁 */
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
const doneCount = computed(() => allProjects().filter(p => isProjectDone(p)).length)
/** R57-F4：战略目标进度（模块头展示，复用 projectProgress 口径） */
function goalPct(dirIdx: number): number {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir || !dir.projects.length) return 0
  const total = dir.projects.reduce((a, p) => a + projectProgress(p).pct, 0)
  return Math.round(total / dir.projects.length)
}

function openProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}
function openTree() { router.push('/compass/tree') }
</script>

<template>
  <ModuleCard icon-name="radio" title="主航线" en="MAIN ROUTE">
    <template #actions>
      <div class="mr-tools">
        <span class="mr-tool" :class="{ off: !showDone }" @click="toggleShowDone" title="已完成项目显示/隐藏（主航线·项目总览·完整方向树三处同步）">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}<span v-if="doneCount && showDone">（{{ doneCount }}）</span></span>
        <span class="mr-tool accent" @click="openTree">完整方向树 →</span>
      </div>
    </template>

    <!-- R57-F4 第一行两列 ｜ R59-T6：愿景/使命 accent 凸显（与战略目标模块区分），整卡可点击进入完整方向树 -->
    <div class="mr-vm-row">
      <div class="mr-vm-card" title="点击进入完整方向树（愿景层）" @click="openTree">
        <div class="mr-vm-head"><span class="mr-tier tier-vision">愿景</span><span v-if="showVision" class="mr-chip chip-project">📡 已投射</span><span class="mr-vm-go">进入方向树 ›</span></div>
        <div class="mr-vm-text" :class="{ empty: !visionText }">{{ visionText || '尚未设定愿景' }}</div>
      </div>
      <div class="mr-vm-card" title="点击进入完整方向树（使命层）" @click="openTree">
        <div class="mr-vm-head"><span class="mr-tier">使命</span><span v-if="showMission" class="mr-chip chip-project">📡 已投射</span><span class="mr-vm-go">进入方向树 ›</span></div>
        <div class="mr-vm-text" :class="{ empty: !missionText }">{{ missionText || '尚未设定使命' }}</div>
      </div>
    </div>

    <!-- R57-F4：第二行 = 战略目标模块网格（模块内含项目小模块） -->
    <div class="mr-goals-grid">
      <div v-for="(dir, di) in d.compass.directions" :key="dir.id" class="mr-goal-card" :data-dir-id="dir.id">
        <div class="mgc-head">
          <span class="mr-tier tier-goal">目标</span>
          <span class="mgc-name" :title="dir.name">{{ dir.name }}</span>
          <span class="mgc-pct">{{ goalPct(di) }}%</span>
          <span class="mr-meta">项目 {{ projectsOf(di).length }}</span>
        </div>
        <div class="mgc-projects">
          <span v-for="p in chipsOf(di)" :key="p.id" class="chip-proj" :class="{ accent: p.isFocused }"
            :title="p.name + ' · 点击进入项目详情'" @click="openProject(p)">
            <span v-if="p.pinnedToLighthouse">📡</span>{{ p.name }}
          </span>
          <span v-if="moreOf(di)" class="chip-more" title="展开其余项目" @click="toggleMore(dir.id)">更多 {{ moreOf(di) }}</span>
          <span v-if="!projectsOf(di).length" class="mgc-empty">暂无项目——去完整方向树创建</span>
        </div>
      </div>
      <div v-if="!d.compass.directions.length" class="mr-empty" @click="openTree">还没有战略目标 → 去完整方向树创建</div>
    </div>
  </ModuleCard>
</template>

<style scoped>
.mr-tools { display: flex; align-items: center; gap: 10px; }
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

/* R57-F4 第一行 ｜ R59-T6：愿景/使命 accent 凸显 + 可点击进方向树 */
.mr-vm-row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-bottom: 10px; }
.mr-vm-card { background: color-mix(in srgb, var(--accent) 7%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border)); border-radius: var(--radius-sm); padding: 10px 14px 11px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; transition: all .15s; }
.mr-vm-card:hover { border-color: var(--accent); box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 16%, transparent); transform: translateY(-1px); }
.mr-vm-head { display: flex; align-items: center; gap: 8px; }
.mr-vm-go { margin-left: auto; font-size: 10.5px; color: var(--accent); opacity: .8; }
.mr-vm-card:hover .mr-vm-go { opacity: 1; text-decoration: underline; }
.mr-vm-text { font-size: 13.5px; font-weight: 600; color: var(--text); line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mr-vm-text.empty { color: var(--text-4); font-weight: 400; }

/* R57-F4：第二行 战略目标模块网格 */
.mr-goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; }
.mr-goal-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 9px; }
.mgc-head { display: flex; align-items: center; gap: 8px; }
.tier-goal { background: var(--accent-light); color: var(--accent); }
.mgc-name { font-size: 13px; font-weight: 650; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mgc-pct { font-size: 11px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.mgc-projects { display: flex; flex-wrap: wrap; gap: 6px; }
/* 项目小模块 */
.chip-proj { font-size: 11px; padding: 4px 10px; border-radius: 8px; font-weight: 500; background: var(--surface); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; transition: all .12s; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip-proj:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.chip-proj.accent { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); color: var(--accent); }
.chip-more { font-size: 11px; padding: 4px 10px; border-radius: 8px; background: transparent; border: 1px dashed var(--border-strong); color: var(--text-3); cursor: pointer; }
.chip-more:hover { color: var(--accent); border-color: var(--accent); }
.mgc-empty { font-size: 11px; color: var(--text-4); }

/* R51-F15：DHI 明细定位闪烁 */
.mr-goal-card.goal-flash { animation: goalFlash 1.2s ease; }
@keyframes goalFlash { 0%, 100% { background: var(--surface-2); box-shadow: none; } 30% { background: var(--accent-light); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); } }

@media (max-width: 1080px) {
  .mr-vm-row { grid-template-columns: 1fr; }
}
</style>
