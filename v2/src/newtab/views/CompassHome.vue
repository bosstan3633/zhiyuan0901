<script setup lang="ts">
// 第卌五轮 T-03：好奇心专区头部 Tab——好奇心卡库（默认）｜任务卡库，各自整体卡片数量徽标（V2.20.1 改名）
import { ref, computed } from 'vue'
import LighthousePanel from '../components/compass/LighthousePanel.vue'
import NorthStarPanel from '../components/compass/NorthStarPanel.vue'
import CuriosityPanel from '../components/compass/CuriosityPanel.vue'
import TaskManagerPanel from '../components/compass/TaskManagerPanel.vue'
import { useCompass } from '../stores/compass'

const { d } = useCompass()
const zone = ref<'curio' | 'task'>('curio')
const curioCount = computed(() => (d.value.curiosities || []).filter(c => !c.deletedAt).length)
const taskCount = computed(() => (d.value.tasks || []).filter(t => !t.deletedAt).length)
</script>

<template>
  <div class="page">
    <!-- 上部 · 战略全景区（左右双栏等高） -->
    <section class="module strategy">
      <LighthousePanel />
      <NorthStarPanel />
    </section>

    <!-- 下部 · 好奇心专区（Tab：好奇心卡库 默认 ｜ 任务卡库） -->
    <section class="module">
      <div class="zone-tabs">
        <div class="zone-tab" :class="{active: zone==='curio'}" @click="zone='curio'">
          💡 好奇心卡库<span class="zc">{{ curioCount }}</span>
        </div>
        <div class="zone-tab" :class="{active: zone==='task'}" @click="zone='task'">
          📋 任务卡库<span class="zc">{{ taskCount }}</span>
        </div>
        <span class="zone-en">CURIOSITY ZONE · 好奇心驱动的方向校准</span>
      </div>
      <CuriosityPanel v-show="zone==='curio'" />
      <TaskManagerPanel v-if="zone==='task'" />
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 1440px; margin: 0 auto; padding: 20px 24px 48px; }
.module { margin-top: 24px; }
.module:first-child { margin-top: 0; }

/* 战略区双栏等高 */
.strategy { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }
.strategy > :deep(.module-card) { height: 100%; }

/* 专区 Tab（第卌五轮 T-03） */
.zone-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: -6px; padding: 0 4px; }
.zone-tab { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 9px 9px 0 0; font-size: 13px; font-weight: 600; color: var(--text-3); cursor: pointer; transition: all .15s; border: 1px solid transparent; border-bottom: none; user-select: none; }
.zone-tab:hover { color: var(--text-2); }
.zone-tab.active { background: var(--surface); color: var(--accent); border-color: rgba(0,0,0,.025); box-shadow: 0 -1px 4px rgba(0,0,0,.04); }
.zone-tab .zc { font-size: 10px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--surface-3); color: var(--text-3); font-variant-numeric: tabular-nums; }
.zone-tab.active .zc { background: var(--accent-light); color: var(--accent); }
.zone-en { font-size: 9px; color: var(--text-4); letter-spacing: 1.4px; text-transform: uppercase; margin-left: 8px; }

@media (max-width: 1080px) {
  .strategy { grid-template-columns: 1fr; }
}
</style>
