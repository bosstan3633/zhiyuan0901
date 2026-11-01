<script setup lang="ts">
/**
 * V3.9.31（W11-12 拆件）：项目全景页头的「⋯ 更多操作」菜单 —— 自 CompassPano 拆出。
 *
 * 为什么拆：CompassPano 长期顶着 400 行帽（本判据曾在 V3.9.x 以同理由拆出 CompassPanoLane），
 * 本轮 F4/F5 的页头行动区增补让宿主再次触顶。菜单是自足块——本地开合态、两个动作、
 * 诊断两态挂件——拆出后宿主回到帽内，行为与拆出前逐字节等价：focusout 收口、
 * 动作先收口再 emit、诊断仍走 useProjectDiag 单例（F4-1 口径不变，塔/详情两宿主照旧）。
 * 壳样式（.ph-more* / .ph-menu / .ph-mi / .ph-diag）随宿主一起迁入本组件 scoped 块。
 */
import { ref } from 'vue'
import Icon from '@/shared/components/Icon.vue'
import CompassTowerStatus from './CompassTowerStatus.vue'
import type { ProjectMeta } from '../../views/compassMeta'
import type { ProjectDiagnosis } from '@/shared/ai/projectDiagnose'

defineProps<{
  projId: string
  hue: string
  meta: ProjectMeta
  diag?: ProjectDiagnosis | null
  stale?: boolean
}>()

const emit = defineEmits<{
  (e: 'importTemplate', projId: string): void
  (e: 'aiMetric', projId: string): void
  (e: 'diagRun', projId: string): void
  (e: 'diagReport', projId: string): void
}>()

/** 「⋯」用一个本地开合态；点外部由 focusout 收口。 */
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function onFocusout(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (!next || !root.value?.contains(next)) open.value = false
}
</script>

<template>
  <div ref="root" class="ph-more-wrap" @focusout="onFocusout">
    <button class="ph-more" :class="{ on: open }" :aria-expanded="open" aria-haspopup="menu" title="更多项目操作" @click="open = !open">⋯</button>
    <div v-if="open" class="ph-menu" role="menu">
      <button class="ph-mi" role="menuitem" @click="open = false; emit('importTemplate', projId)">
        <Icon name="filetext" :size="13"/> 导入模板
      </button>
      <button class="ph-mi" role="menuitem" @click="open = false; emit('aiMetric', projId)">
        <Icon name="sparkle" :size="13"/> AI 建议指标
      </button>
      <CompassTowerStatus class="ph-diag" :proj-id="projId" :hue="hue"
        :meta="meta" :diag="diag" :stale="stale"
        @diag-run="(id) => { open = false; emit('diagRun', id) }"
        @diag-report="(id) => { open = false; emit('diagReport', id) }"
      />
    </div>
  </div>
</template>

<style scoped>
/* 自 CompassPano scoped 块原样迁入（类名不变；宿主侧同名规则随拆件删除，避免两份漂移） */
.ph-more-wrap { position: relative; }
.ph-more {
  display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: transparent; color: var(--text-2); font-family: inherit;
  font-size: var(--fs-sub); cursor: pointer;
}
.ph-more:hover, .ph-more.on { color: var(--accent-ink); border-color: var(--accent); background: var(--accent-light); }
.ph-menu {
  position: absolute; right: 0; top: calc(100% + 5px); z-index: 30; width: 230px; padding: 5px;
  display: flex; flex-direction: column; gap: 2px; background: var(--surface);
  border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); }
.ph-mi {
  display: flex; align-items: center; gap: 7px; width: 100%; min-height: 30px; padding: 6px 8px;
  border: 0; border-radius: var(--radius-xs); background: transparent; color: var(--text-2);
  font-family: inherit; font-size: var(--fs-sub); text-align: left; cursor: pointer;
}
.ph-mi:hover { background: var(--surface-2); color: var(--text); }
.ph-diag { padding: 4px 3px; border-top: 1px solid var(--border); margin-top: 2px; }
</style>
