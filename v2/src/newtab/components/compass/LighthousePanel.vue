<script setup lang="ts">
/**
 * R49-C2/C3/C6 + R50-F4 主航线 · 方向台核心模块
 * 树状：愿景 → 使命 → 战略目标（行内嵌项目 chip：已投射在前、最多 2 个 +「更多 N」滚动定位项目总览）
 * - 点击项目 chip 进项目详情（/compass/projects?p=）；「更多」平滑滚动至项目总览并闪烁高亮
 * - 愿景/使命层可折叠；战略目标行不再纵向展开，为主航线/项目总览节省纵向空间
 * - 已完成（archived）项目受全局显隐开关控制（UIPrefs.showDoneProjects，与项目总览/完整方向树三处同步）
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCompass } from '../../stores/compass'
import { useAppStore } from '../../stores/app'
import { saveUIPrefs } from '@/shared/storage/repository'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import type { Project } from '@/shared/models'

const router = useRouter()
const { d, visionText, missionText, allProjects, projectProgress } = useCompass()
const store = useAppStore()

// ---- 显隐开关（C6 三处同步） ----
const showDone = computed(() => store.ui?.showDoneProjects !== false)
function toggleShowDone() {
  const next = !showDone.value
  if (store.ui) store.ui.showDoneProjects = next
  saveUIPrefs({ showDoneProjects: next })
}

// ---- 折叠状态（R50-F4：战略目标行内嵌项目 chip，不再展开；仅愿景/使命可折叠） ----
const expanded = ref<Set<string>>(new Set(['vision', 'mission']))
function expandAll() {
  expanded.value.add('vision'); expanded.value.add('mission')
}
function collapseAll() {
  expanded.value.clear()
}
function toggle(key: string) {
  if (expanded.value.has(key)) expanded.value.delete(key)
  else expanded.value.add(key)
}

/** 已投射标记（C4：口径=CompassNode/Project 自身 pinnedToLighthouse；战略目标层无投射，REQ-001） */
const showVision = computed(() => d.value.compass.vision.pinnedToLighthouse)
const showMission = computed(() => d.value.compass.mission.pinnedToLighthouse)

/** 项目按显隐开关过滤 */
function projectsOf(dirIdx: number): Project[] {
  const dir = d.value.compass.directions[dirIdx]
  if (!dir) return []
  return dir.projects.filter(p => showDone.value || p.status !== 'archived')
}
/** R50-F4：目标行内嵌项目 chip（已投射在前，最多 2 个 + 更多） */
function chipsOf(dirIdx: number): Project[] {
  const list = [...projectsOf(dirIdx)]
  list.sort((a, b) => (Number(b.pinnedToLighthouse) - Number(a.pinnedToLighthouse)) || (a.order ?? 999) - (b.order ?? 999))
  return list.slice(0, 2)
}
function moreOf(dirIdx: number): number {
  return Math.max(0, projectsOf(dirIdx).length - 2)
}
/** 更多 → 滚动定位到项目总览模块并高亮闪烁 */
function goMore() {
  const el = document.querySelector('.ov-card')
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.add('ov-flash')
  setTimeout(() => el.classList.remove('ov-flash'), 1400)
}
const doneCount = computed(() => allProjects().filter(p => p.status === 'archived').length)

function openProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}
function openTree() { router.push('/compass/tree') }
</script>

<template>
  <ModuleCard icon-name="radio" title="主航线" en="MAIN ROUTE">
    <template #actions>
      <div class="mr-tools">
        <span class="mr-tool" @click="expandAll" title="展开全部层级">⊞ 展开</span>
        <span class="mr-tool" @click="collapseAll" title="收起为愿景/使命根">⊟ 收起</span>
        <span class="mr-tool" :class="{ off: !showDone }" @click="toggleShowDone" title="已完成项目显示/隐藏（主航线·项目总览·完整方向树三处同步）">👁 已完成项目：{{ showDone ? '显示' : '隐藏' }}<span v-if="doneCount && showDone">（{{ doneCount }}）</span></span>
        <span class="mr-tool accent" @click="openTree">完整方向树 →</span>
      </div>
    </template>

    <div class="mr-tree">
      <!-- 愿景 -->
      <div class="mr-row level-vision" :class="{ open: expanded.has('vision') }" @click="toggle('vision')">
        <span class="mr-caret" :class="{ open: expanded.has('vision') }">▸</span>
        <span class="mr-tier">愿景</span>
        <span v-if="showVision" class="mr-chip chip-project">📡 已投射</span>
        <span class="mr-text" :class="{ empty: !visionText }">{{ visionText || '尚未设定愿景' }}</span>
      </div>

      <!-- 使命 -->
      <div v-show="expanded.has('vision')" class="mr-children">
        <div class="mr-row level-mission" :class="{ open: expanded.has('mission') }" @click="toggle('mission')">
          <span class="mr-caret" :class="{ open: expanded.has('mission') }">▸</span>
          <span class="mr-tier">使命</span>
          <span v-if="showMission" class="mr-chip chip-project">📡 已投射</span>
          <span class="mr-text" :class="{ empty: !missionText }">{{ missionText || '尚未设定使命' }}</span>
        </div>

        <!-- 战略目标行（R50-F4：项目以 chip 内嵌，已投射在前 · 最多 2 个 + 更多） -->
        <div v-show="expanded.has('mission')" class="mr-children">
          <template v-for="(dir, di) in d.compass.directions" :key="dir.id">
            <div class="mr-row level-goal">
              <span class="mr-tier">目标</span>
              <span class="mr-text strong">{{ dir.name }}</span>
              <span class="mr-goals">
                <span v-for="p in chipsOf(di)" :key="p.id" class="mr-chip chip-proj" :class="{ accent: p.isFocused }"
                  :title="p.name + ' · 点击进入项目详情'" @click.stop="openProject(p)">
                  <span v-if="p.pinnedToLighthouse">📡</span>{{ p.name }}
                </span>
                <span v-if="moreOf(di)" class="mr-chip chip-more" title="定位到项目总览" @click.stop="goMore">更多 {{ moreOf(di) }}</span>
              </span>
              <span class="mr-meta">项目 {{ projectsOf(di).length }}</span>
            </div>
          </template>
          <div v-if="!d.compass.directions.length" class="mr-empty" @click="openTree">还没有战略目标 → 去完整方向树创建</div>
        </div>
      </div>
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

.mr-tree { display: flex; flex-direction: column; }
.mr-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-xs); cursor: pointer; transition: background .12s, border-color .12s; border: 1px solid transparent; min-height: 34px; }
.mr-row:hover { background: var(--surface-2); }
.mr-caret { width: 14px; text-align: center; font-size: 10px; color: var(--text-3); transition: transform .15s; flex-shrink: 0; }
.mr-caret.open { transform: rotate(90deg); }
.mr-caret.leaf { transform: none; color: var(--text-4); }
.mr-tier { font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--text-3); background: var(--surface-3); padding: 2px 8px; border-radius: 99px; flex-shrink: 0; min-width: 38px; text-align: center; }
.mr-text { flex: 1; min-width: 0; font-size: 13px; color: var(--text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mr-text.strong { font-weight: 600; color: var(--text); }
.mr-text.accent { color: var(--accent); }
.mr-text.empty { color: var(--text-4); font-weight: 400; }
.mr-meta { font-size: 10.5px; color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0; }

.mr-chip { font-size: 9.5px; padding: 2px 7px; border-radius: 99px; font-weight: 500; flex-shrink: 0; white-space: nowrap; }
.chip-accent { background: var(--accent-light); color: var(--accent); }
.chip-project { background: var(--surface-3); color: var(--text-2); }
.chip-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }

/* R50-F4：目标行内嵌项目 chip */
.mr-goals { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
.chip-proj { background: var(--surface-3); color: var(--text-2); cursor: pointer; transition: all .12s; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.chip-proj:hover { background: var(--accent-light); color: var(--accent); }
.chip-proj.accent { background: var(--accent-light); color: var(--accent); }
.chip-more { background: transparent; border: 1px dashed var(--border-strong); color: var(--text-3); cursor: pointer; }
.chip-more:hover { color: var(--accent); border-color: var(--accent); }

.mr-children { margin-left: 22px; padding-left: 10px; border-left: 1px solid var(--border); }

/* 层级色彩（克制，Linear 发丝线体系） */
.level-vision .mr-text { color: var(--accent); font-weight: 600; font-size: 13.5px; }
.level-vision .mr-tier { background: var(--accent-light); color: var(--accent); }
.level-mission { border-left: none; }
.level-goal { cursor: default; }
.mr-empty { font-size: 11.5px; color: var(--text-4); padding: 6px 12px 6px 30px; }
</style>
