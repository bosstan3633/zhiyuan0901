<script setup lang="ts">
/**
 * R49-C2/C3/C6 主航线 · 方向台核心模块
 * 树状：愿景 → 使命 → 战略目标 → 项目为止（指标/任务进项目详情）
 * - 项目行：名称 + 主攻/已投射/停滞 chip + 🎯指标数·📋任务数·进度%，点击进项目详情（/compass/projects?p=）
 * - 一键展开全部/收起全部；愿景/使命/战略目标层仍可单独折叠
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
const { d, visionText, missionText, allProjects, projectProgress, isProjectStalled } = useCompass()
const store = useAppStore()

// ---- 显隐开关（C6 三处同步） ----
const showDone = computed(() => store.ui?.showDoneProjects !== false)
function toggleShowDone() {
  const next = !showDone.value
  if (store.ui) store.ui.showDoneProjects = next
  saveUIPrefs({ showDoneProjects: next })
}

// ---- 折叠状态（愿景/使命/战略目标层可单独折叠；默认全展开） ----
const expanded = ref<Set<string>>(new Set(['vision', 'mission']))
function expandAll() {
  expanded.value.add('vision'); expanded.value.add('mission')
  d.value.compass.directions.forEach(dir => expanded.value.add(dir.id))
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
const doneCount = computed(() => allProjects().filter(p => p.status === 'archived').length)

function openProject(p: Project) {
  router.push({ path: '/compass/projects', query: { p: p.id } })
}
function projectTaskCount(projectId: string): number {
  return d.value.tasks.filter(t => !t.deletedAt && t.projectId === projectId).length
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

        <!-- 战略目标 → 项目 -->
        <div v-show="expanded.has('mission')" class="mr-children">
          <template v-for="(dir, di) in d.compass.directions" :key="dir.id">
            <div class="mr-row level-goal" :class="{ open: expanded.has(dir.id) }" @click="toggle(dir.id)">
              <span class="mr-caret" :class="{ open: expanded.has(dir.id) }">▸</span>
              <span class="mr-tier">目标</span>
              <span class="mr-text strong">{{ dir.name }}</span>
              <span class="mr-meta">项目 {{ projectsOf(di).length }}</span>
            </div>
            <!-- 项目行（到项目层为止） -->
            <div v-show="expanded.has(dir.id)" class="mr-children">
              <div v-for="p in projectsOf(di)" :key="p.id" class="mr-row level-project" :class="{ focused: p.isFocused }" @click="openProject(p)" title="点击进入项目详情">
                <span class="mr-caret leaf">·</span>
                <span class="mr-tier">项目</span>
                <span class="mr-text strong" :class="{ accent: p.isFocused }">{{ p.name }}</span>
                <span v-if="p.isFocused" class="mr-chip chip-accent">🎯 主攻</span>
                <span v-if="p.pinnedToLighthouse" class="mr-chip chip-project">📡</span>
                <span v-if="isProjectStalled(p)" class="mr-chip chip-warn">⚠ 停滞</span>
                <span class="mr-meta">🎯 {{ p.metrics.length }} · 📋 {{ projectTaskCount(p.id) }} · {{ projectProgress(p).pct }}%</span>
                <span class="mr-progress"><i :style="{ width: projectProgress(p).pct + '%' }" /></span>
              </div>
              <div v-if="!projectsOf(di).length" class="mr-empty">该项目下暂无可见项目</div>
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
.mr-progress { width: 72px; height: 4px; background: var(--surface-3); border-radius: 99px; overflow: hidden; flex-shrink: 0; }
.mr-progress > i { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s ease; }

.mr-chip { font-size: 9.5px; padding: 2px 7px; border-radius: 99px; font-weight: 500; flex-shrink: 0; white-space: nowrap; }
.chip-accent { background: var(--accent-light); color: var(--accent); }
.chip-project { background: var(--surface-3); color: var(--text-2); }
.chip-warn { background: var(--tag-warn-bg); color: var(--tag-warn-text); }

.mr-children { margin-left: 22px; padding-left: 10px; border-left: 1px solid var(--border); }

/* 层级色彩（克制，Linear 发丝线体系） */
.level-vision .mr-text { color: var(--accent); font-weight: 600; font-size: 13.5px; }
.level-vision .mr-tier { background: var(--accent-light); color: var(--accent); }
.level-mission { border-left: none; }
.level-project.focused { background: color-mix(in srgb, var(--accent) 6%, transparent); border-color: color-mix(in srgb, var(--accent) 25%, var(--border)); }
.mr-empty { font-size: 11.5px; color: var(--text-4); padding: 6px 12px 6px 30px; }
</style>
