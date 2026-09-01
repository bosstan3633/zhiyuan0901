<script setup lang="ts">
import LighthousePanel from '../components/compass/LighthousePanel.vue'
import NorthStarPanel from '../components/compass/NorthStarPanel.vue'
import CuriosityPanel from '../components/compass/CuriosityPanel.vue'
</script>

<template>
  <div class="page">
    <!-- 上部 · 战略全景区（左右双栏等高） -->
    <section class="module strategy">
      <LighthousePanel />
      <NorthStarPanel />
    </section>

    <!-- 下部 · 好奇心管理专区（扩容承载） -->
    <section class="module">
      <CuriosityPanel />
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

@media (max-width: 1080px) {
  .strategy { grid-template-columns: 1fr; }
}
</style>
