<script setup lang="ts">
/**
 * 知源灯塔 · 纯展示（D1 + O19 极简版）
 * 项目区 = 已投射灯塔（📡）的项目：仅显示项目名 + 指标数 + 任务数，两列紧凑。
 * 点击项目名 → 右侧滑出项目详情抽屉（可编辑，实时同步罗盘）。
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCompass } from '../../stores/compass'
import { useAppStore } from '../../stores/app'
import ModuleCard from '@/shared/components/ModuleCard.vue'
import ProjectDetailDrawer from '../ProjectDetailDrawer.vue'
import type { Project } from '@/shared/models'

const router = useRouter()
const { d, visionText, missionText, allProjects } = useCompass()
const store = useAppStore()

const showVision = computed(() => d.value.compass.vision.pinnedToLighthouse)
const showMission = computed(() => d.value.compass.mission.pinnedToLighthouse)
/** 灯塔项目区 = 已投射灯塔的项目 */
const beaconProjects = computed(() => allProjects().filter(p => p.pinnedToLighthouse))

function projectTaskCount(projectId: string): number {
  return d.value.tasks.filter(t => !t.deletedAt && t.projectId === projectId).length
}
function openTree() { router.push('/compass/tree') }

// O19：点击项目 → 右侧详情抽屉
const drawerOpen = ref(false)
const drawerProjectId = ref<string | null>(null)
function openProject(p: Project) {
  drawerProjectId.value = p.id
  drawerOpen.value = true
}
</script>

<template>
  <ModuleCard icon-name="radio" title="知源灯塔" en="COMPASS LIGHTHOUSE">
    <template #actions>
      <div class="lh-top-action" @click="openTree">在罗盘中查看完整内容 →</div>
    </template>
    <div class="lh-body">
      <!-- 核心愿景（方向树 📡 控制显示） -->
      <div v-if="showVision" class="lh-section">
        <div class="lh-label">核心愿景</div>
        <div class="lh-content" :class="{empty: !visionText}" @click="openTree" title="在方向树中查看与编辑">
          {{ visionText || '尚未设定愿景 · 点击前往方向树设定 →' }}
        </div>
      </div>

      <!-- 核心使命（方向树 📡 控制显示） -->
      <div v-if="showMission" class="lh-section">
        <div class="lh-label">核心使命</div>
        <div class="lh-content" :class="{empty: !missionText}" @click="openTree" title="在方向树中查看与编辑">
          {{ missionText || '尚未设定使命 · 点击前往方向树设定 →' }}
        </div>
      </div>

      <div class="lh-divider" />

      <!-- 阶段主攻（已投射灯塔的项目 · 极简单行卡，两列） -->
      <div class="lh-section lh-grow">
        <div class="lh-label">阶段主攻 · 已投射项目</div>
        <div v-if="beaconProjects.length" class="lh-projects">
          <div v-for="p in beaconProjects" :key="p.id" class="lh-project" @click="openProject(p)" title="点击查看项目详情">
            <span class="lhp-name" :title="p.name">{{ p.name }}</span>
            <span class="lhp-nums">
              <span class="n" title="成功指标">🎯 {{ p.metrics.length }}</span>
              <span class="n" title="任务">📋 {{ projectTaskCount(p.id) }}</span>
            </span>
          </div>
        </div>
        <div v-else class="lh-empty" @click="openTree">
          尚未投射项目 → 在方向树中打开项目节点的 📡 投射开关
        </div>
      </div>
    </div>
  </ModuleCard>

  <!-- 项目详情抽屉（点击项目名滑出） -->
  <ProjectDetailDrawer :open="drawerOpen" :project-id="drawerProjectId" @close="drawerOpen = false" />
</template>

<style scoped>
.lh-body { flex: 1; display: flex; flex-direction: column; }

.lh-section { margin-bottom: 10px; }
.lh-grow { flex: 1; }
.lh-label { font-size: 12px; font-weight: 500; color: var(--text-2); margin-bottom: 4px; }
.lh-content { font-size: 13.5px; color: var(--text); line-height: 1.7; padding: 7px 10px; border-radius: var(--radius-xs); cursor: pointer; transition: background .15s; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.lh-content:hover { background: var(--surface-2); }
.lh-content.empty { color: var(--text-3); }

.lh-divider { height: 1px; background: var(--border); margin: 8px 0 12px; }

/* 极简单行项目卡（两列） */
.lh-projects { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lh-project { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); cursor: pointer; transition: all .15s; }
.lh-project:hover { border-color: var(--accent); background: var(--surface); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 8%, transparent); transform: translateY(-1px); }
.lhp-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lh-project:hover .lhp-name { color: var(--accent); }
.lhp-nums { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.lhp-nums .n { font-size: 10px; color: var(--text-3); background: var(--surface-3); padding: 1px 7px; border-radius: 99px; white-space: nowrap; }

.lh-empty { font-size: 12px; color: var(--text-3); padding: 8px 10px; cursor: pointer; border-radius: var(--radius-xs); transition: all .15s; }
.lh-empty:hover { color: var(--accent); background: var(--accent-light); }
.lh-action { font-size: 13px; color: var(--accent); font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: gap .15s; }
.lh-action:hover { gap: 8px; color: var(--accent-hover); }
.lh-top-action { font-size: 11.5px; color: var(--accent); cursor: pointer; white-space: nowrap; }
.lh-top-action:hover { text-decoration: underline; }
</style>
